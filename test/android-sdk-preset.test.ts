import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GlobalConfig } from "renovate/dist/config/global.js";
import { CustomDatasource } from "renovate/dist/modules/datasource/custom/index.js";
import { extractPackageFile } from "renovate/dist/modules/manager/custom/regex/index.js";
import { applyPackageRules } from "renovate/dist/util/package-rules/index.js";
import { matchRegexOrGlob } from "renovate/dist/util/string-match.js";
import { lookupUpdates } from "renovate/dist/workers/repository/process/lookup/index.js";
import { doAutoReplace } from "renovate/dist/workers/repository/update/branch/auto-replace.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isCandidate } from "../scripts/global-automerge.js";
import { OPTION_PRESETS } from "../src/detector.js";
import { prepareOutputFiles } from "../src/generator.js";

function readPreset(name: string) {
	return JSON.parse(
		readFileSync(new URL(`../presets/${name}.json`, import.meta.url), "utf8"),
	);
}

const defaultPreset = readPreset("default");
const androidPreset = readPreset("languages/android");
const preset = readPreset("options/android-sdk");
const [compileManager, targetManager] = preset.customManagers;
const fileName = "android/app/build.gradle.kts";
const REPOSITORY_XML_URL =
	"https://dl.google.com/android/repository/repository2-3.xml";

function gradle(compile: string, target: string, newline = "\n") {
	return [
		"android {",
		`    compileSdk = ${compile}`,
		"    defaultConfig {",
		"        minSdk = 26",
		`        targetSdk = ${target}`,
		"        versionCode = 36",
		"    }",
		"}",
		"",
	].join(newline);
}

function gradleBlock(
	compileBlockLines: string[],
	target: string,
	newline = "\n",
	indent = "    ",
) {
	return [
		"android {",
		...compileBlockLines,
		`${indent}defaultConfig {`,
		`${indent}${indent}minSdk = 26`,
		`${indent}${indent}targetSdk = ${target}`,
		`${indent}${indent}versionCode = 36`,
		`${indent}}`,
		"}",
		"",
	].join(newline);
}

function extract(content: string, manager = targetManager) {
	return extractPackageFile(content, fileName, manager);
}

function remotePackage(
	path: string,
	apiLevel: string,
	options: { codename?: string | null; channel?: string } = {},
) {
	const channel = options.channel ?? "channel-0";
	const codenameTag =
		options.codename === undefined
			? "      <codename></codename>\n"
			: options.codename === null
				? ""
				: `      <codename>${options.codename}</codename>\n`;
	return [
		`  <remotePackage path="${path}">`,
		'    <type-details xsi:type="sdk:platformDetailsType">',
		`      <api-level>${apiLevel}</api-level>`,
		codenameTag.trimEnd(),
		"    </type-details>",
		`    <channelRef ref="${channel}"/>`,
		"  </remotePackage>",
	]
		.filter(Boolean)
		.join("\n");
}

const repositoryXml = [
	"<?xml version='1.0' encoding='utf-8'?>",
	"<sdk:sdk-repository>",
	remotePackage("platforms;android-canary-20261104", "37.2", {
		codename: "CANARY",
	}),
	remotePackage("platforms;android-37.2-beta3", "37.1", { codename: "DEV" }),
	remotePackage("platforms;android-37.2-beta1", "37.1", {
		codename: "CinnamonBun",
	}),
	remotePackage("platforms;android-CANARY", "37.1", { codename: "CANARY" }),
	remotePackage("platforms;android-38.0", "38.0", { channel: "channel-1" }),
	remotePackage("platforms;android-37.2", "37.2"),
	remotePackage("platforms;android-37.1", "37.1", { codename: "" }),
	remotePackage("platforms;android-37.0", "37.0"),
	remotePackage("platforms;android-36.1", "36.1", { codename: null }),
	remotePackage("platforms;android-36-ext19", "36x", { codename: null }),
	remotePackage("platforms;android-36", "36", { codename: null }),
	remotePackage("platforms;android-35", "35", { codename: null }),
	"</sdk:sdk-repository>",
].join("\n");

async function releases(packageName: string, xml = repositoryXml) {
	const datasource = new CustomDatasource();
	const request = vi
		.spyOn(datasource.http, "getPlain")
		.mockResolvedValue({ body: xml });
	const result = await datasource.getReleases({
		datasource: "custom.android-sdk",
		packageName,
		customDatasources: preset.customDatasources,
	});
	expect(request).toHaveBeenCalledWith(REPOSITORY_XML_URL);
	return result?.releases.map(
		(release: { version: string }) => release.version,
	);
}

async function runAutoReplace(
	manager: typeof compileManager,
	content: string,
	update: {
		newValue: string;
		newMajor?: number;
		newMinor?: number;
	},
) {
	const localDir = await mkdtemp(join(tmpdir(), "renovate-android-sdk-"));
	const previousConfig = GlobalConfig.get();
	GlobalConfig.set({ ...previousConfig, localDir });
	try {
		const dependency = extract(content, manager)?.deps[0];
		expect(dependency).toBeDefined();
		const options = await applyPackageRules({
			...dependency,
			packageRules: preset.packageRules,
		});
		return await doAutoReplace(
			{
				...manager,
				...options,
				manager: "regex",
				packageFile: fileName,
				depIndex: 0,
				newValue: update.newValue,
				newVersion: update.newValue,
				...(update.newMajor !== undefined ? { newMajor: update.newMajor } : {}),
				...(update.newMinor !== undefined ? { newMinor: update.newMinor } : {}),
			},
			content,
			false,
		);
	} finally {
		GlobalConfig.set(previousConfig);
		await rm(localDir, { recursive: true, force: true });
	}
}

async function runLookupWithXml(content: string, xml = repositoryXml) {
	const originalGetReleases = CustomDatasource.prototype.getReleases;
	vi.spyOn(CustomDatasource.prototype, "getReleases").mockImplementation(
		async function (this: CustomDatasource, config) {
			vi.spyOn(this.http, "getPlain").mockResolvedValue({ body: xml });
			return originalGetReleases.call(this, config);
		},
	);
	const dependency = extract(content, compileManager)?.deps[0];
	expect(dependency).toBeDefined();
	const merged = await applyPackageRules({
		...defaultPreset,
		...dependency,
		manager: "custom.regex",
		customDatasources: preset.customDatasources,
		minimumReleaseAgeBehaviour: "timestamp-required",
		updatePinnedDependencies: true,
		separateMajorMinor: true,
		packageRules: [
			...defaultPreset.packageRules,
			...androidPreset.packageRules,
			...preset.packageRules,
		],
	});
	const lookupResult = (await lookupUpdates(merged)).unwrap();
	return { dependency, merged, lookupResult };
}

afterEach(() => vi.restoreAllMocks());

describe("Android SDK プリセット", () => {
	it.each([
		["build.gradle.kts", true],
		[fileName, true],
		["app/build.gradle", false],
		["gradle/libs.versions.toml", false],
		["app/not-build.gradle.kts", false],
	])("対象ファイル %s: %s", (path, expected) => {
		expect(
			compileManager.managerFilePatterns.some((pattern: string) =>
				matchRegexOrGlob(path, pattern),
			),
		).toBe(expected);
	});

	it.each(["\n", "\r\n"])("整数代入を抽出する（改行 %j）", (newline) => {
		const content = gradle("37", "34", newline);
		expect(extract(content, compileManager)?.deps).toMatchObject([
			{
				depName: "android-compile-sdk",
				currentValue: "37.0",
				packageName: "latest",
				indentation: "    ",
				replaceString: `${newline}    compileSdk = 37`,
			},
		]);
		expect(extract(content)?.deps).toMatchObject([
			{
				depName: "android-target-sdk",
				currentValue: "34",
				packageName: "37",
				depType: "targetSdk",
				datasource: "custom.android-sdk",
			},
		]);
	});

	it.each([
		["35", "35.0", "latest-major"],
		["36", "36.0", "latest-major"],
		["37", "37.0", "latest"],
		["38", "38.0", "latest"],
	])(
		"整数代入の API レベルに応じて packageName を切り替える: compileSdk = %s -> %s (%s)",
		(compile, expectedValue, expectedPackageName) => {
			expect(
				extract(gradle(compile, "34"), compileManager)?.deps[0],
			).toMatchObject({
				currentValue: expectedValue,
				packageName: expectedPackageName,
			});
		},
	);

	it.each([
		[
			"minorApiLevel あり",
			[
				"    compileSdk {",
				"        version = release(37) {",
				"            minorApiLevel = 1",
				"        }",
				"    }",
			],
			"37.1",
			"37",
		],
		[
			"API 36 のブロック構文（AGP 8.13+ 確定）",
			["    compileSdk {", "        version = release(36)", "    }"],
			"36.0",
			"36",
		],
		[
			"it.minorApiLevel あり",
			[
				"    compileSdk {",
				"        version = release(37) {",
				"            it.minorApiLevel = 2",
				"        }",
				"    }",
			],
			"37.2",
			"37",
		],
		[
			"minorApiLevel = 0",
			[
				"    compileSdk {",
				"        version = release(37) {",
				"            minorApiLevel = 0",
				"        }",
				"    }",
			],
			"37.0",
			"37",
		],
		[
			"minorApiLevel なし",
			["    compileSdk {", "        version = release(37)", "    }"],
			"37.0",
			"37",
		],
		[
			"行末コメント付きブロック",
			[
				"    compileSdk { // AGP 9",
				"        version = release(37) { // API 37",
				"            minorApiLevel = 1 // QPR1",
				"        }",
				"    } // end",
			],
			"37.1",
			"37",
		],
	])(
		"AGP 9 ブロック構文を抽出する: %s",
		(_label, blockLines, expectedCompile, expectedCap) => {
			for (const newline of ["\n", "\r\n"]) {
				const content = gradleBlock(blockLines, "36", newline);
				expect(extract(content, compileManager)?.deps).toMatchObject([
					{
						depName: "android-compile-sdk",
						currentValue: expectedCompile,
						packageName: "latest",
						indentation: "    ",
					},
				]);
				expect(extract(content)?.deps).toMatchObject([
					{
						depName: "android-target-sdk",
						currentValue: "36",
						packageName: expectedCap,
						depType: "targetSdk",
					},
				]);
			}
		},
	);

	it.each(["libs.versions.targetSdk.get().toInt()", "36 + 1", '"36"', "36.1"])(
		"整数以外の targetSdk を無視する: %s",
		(value) => expect(extract(gradle("37", value))).toBeNull(),
	);

	it.each(["libs.versions.compileSdk.get().toInt()", "36 + 1", '"37"'])(
		"compileSdk が対応形式でない場合は targetSdk も提案しない: %s",
		(value) => {
			expect(extract(gradle(value, "36"))).toBeNull();
			expect(extract(gradle(value, "36"), compileManager)).toBeNull();
		},
	);

	it.each([
		[
			"preview 構文",
			["    compileSdk {", '        version = preview("CinnamonBun")', "    }"],
		],
		[
			"sdkExtension を含むブロック",
			[
				"    compileSdk {",
				"        version = release(37) {",
				"            minorApiLevel = 1",
				"            sdkExtension = 23",
				"        }",
				"    }",
			],
		],
		[
			"sdkExtension のみのブロック",
			[
				"    compileSdk {",
				"        version = release(37) {",
				"            sdkExtension = 22",
				"        }",
				"    }",
			],
		],
	])("未対応のブロック構文を安全に無視する: %s", (_label, blockLines) => {
		const content = gradleBlock(blockLines, "36");
		expect(extract(content, compileManager)).toBeNull();
		expect(extract(content)).toBeNull();
	});

	it("コメントアウトされた値と Android ブロック外の値を無視する", () => {
		const content =
			"compileSdk = 37\ntargetSdk = 36\nandroid {\n    // compileSdk = 37\n    // targetSdk = 36\n}\n";
		expect(extract(content)).toBeNull();
		expect(extract(content, compileManager)).toBeNull();
	});

	it("行末コメントを含む整数代入の値を抽出する", () => {
		expect(
			extract(gradle("37 // API", "36 // 検証済み"))?.deps[0],
		).toMatchObject({
			currentValue: "36",
			packageName: "37",
		});
	});

	it("Google SDK Repository XML から安定版 API レベルのみ取得し X.Y に正規化する", async () => {
		expect(await releases("latest")).toEqual([
			"37.2",
			"37.1",
			"37.0",
			"36.1",
			"36.0",
			"35.0",
		]);
		expect(await releases("latest-major")).toEqual(["37.0", "36.0", "35.0"]);
	});

	it.each([
		["空 XML", "<sdk:sdk-repository></sdk:sdk-repository>", "latest", []],
		[
			"空 XML（latest-major）",
			"<sdk:sdk-repository></sdk:sdk-repository>",
			"latest-major",
			[],
		],
		[
			"空 XML（targetSdk）",
			"<sdk:sdk-repository></sdk:sdk-repository>",
			"36",
			[],
		],
		[
			"1 件のみ（latest）",
			`<sdk:sdk-repository>\n${remotePackage("platforms;android-36", "36", { codename: null })}\n</sdk:sdk-repository>`,
			"latest",
			["36.0"],
		],
		[
			"1 件のみ（latest-major）",
			`<sdk:sdk-repository>\n${remotePackage("platforms;android-36", "36", { codename: null })}\n</sdk:sdk-repository>`,
			"latest-major",
			["36.0"],
		],
		[
			"1 件のみ（targetSdk）",
			`<sdk:sdk-repository>\n${remotePackage("platforms;android-36", "36", { codename: null })}\n</sdk:sdk-repository>`,
			"36",
			["36"],
		],
	])("XML 件数の境界ケースを扱う: %s", async (_label, xml, pkg, expected) => {
		expect(await releases(pkg, xml)).toEqual(expected);
	});

	it.each([
		["36", ["36", "35"]],
		["37", ["37", "36", "35"]],
		["34", []],
	])(
		"targetSdk の候補を compileSdk=%s 以下のメジャー整数版のみに制限する",
		async (compile, expected) => {
			const dependency = extract(gradle(compile, "34"))?.deps[0];
			expect(await releases(dependency.packageName)).toEqual(expected);
		},
	);

	it("AGP 9 ブロック構文の compileSdk でも targetSdk の候補をメジャー部以下に制限する", async () => {
		const before = extract(
			gradleBlock(
				[
					"    compileSdk {",
					"        version = release(36) {",
					"            minorApiLevel = 1",
					"        }",
					"    }",
				],
				"35",
			),
		)?.deps[0];
		const after = extract(
			gradleBlock(
				[
					"    compileSdk {",
					"        version = release(37) {",
					"            minorApiLevel = 2",
					"        }",
					"    }",
				],
				"35",
			),
		)?.deps[0];
		expect(await releases(before.packageName)).toEqual(["36", "35"]);
		expect(await releases(after.packageName)).toEqual(["37", "36", "35"]);
	});

	it("AGP 8.13 未満の既存利用先（compileSdk = 36）では 36.1 へのブロック変換を提案せずメジャー整数更新のみ行う", async () => {
		const content = gradle("36 // AGP 8.12.3", "35");
		const { merged, lookupResult } = await runLookupWithXml(content);
		expect(lookupResult.ok).toBe(true);
		expect(lookupResult.val?.updates).toEqual([
			expect.objectContaining({
				updateType: "major",
				newValue: "37.0",
				newMajor: 37,
				newMinor: 0,
			}),
		]);
		const majorUpdate = lookupResult.val?.updates?.[0];
		const ruled = await applyPackageRules({
			...merged,
			...majorUpdate,
			packageRules: [
				...defaultPreset.packageRules,
				...androidPreset.packageRules,
				...preset.packageRules,
			],
		});
		expect(ruled.addLabels).toContain("major-manual-review");
		expect(ruled.addLabels).not.toContain("automerge-candidate");
		expect(
			isCandidate({
				labels: (ruled.addLabels ?? []).map((name: string) => ({ name })),
				isDraft: false,
				isCrossRepository: false,
				headRefName: "renovate/android-sdk",
				author: { login: "app/renovate" },
				baseRefName: "main",
			}),
		).toBe(false);

		const replaced = await runAutoReplace(compileManager, content, {
			newValue: majorUpdate.newValue,
			newMajor: majorUpdate.newMajor,
			newMinor: majorUpdate.newMinor,
		});
		expect(replaced).toBe(gradle("37 // AGP 8.12.3", "35"));
	});

	it("AGP 8.13+ で既にブロック構文（release(36)）を使う利用先は 36.1 のマイナー更新を提案する", async () => {
		const content = gradleBlock(
			["    compileSdk {", "        version = release(36)", "    }"],
			"35",
		);
		const { lookupResult } = await runLookupWithXml(content);
		expect(lookupResult.val?.updates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					updateType: "minor",
					newValue: "36.1",
					newMajor: 36,
					newMinor: 1,
				}),
			]),
		);
	});

	it.each([
		{
			name: "整数代入からマイナー版へ更新すると AGP 9 ブロック構文へ変換し行末コメントを保持する（LF）",
			content: gradle("37 // API 37", "36 // API 36", "\n"),
			update: { newValue: "37.2", newMajor: 37, newMinor: 2 },
			expected: [
				"android {",
				"    compileSdk {",
				"        version = release(37) {",
				"            minorApiLevel = 2",
				"        }",
				"    } // API 37",
				"    defaultConfig {",
				"        minSdk = 26",
				"        targetSdk = 36 // API 36",
				"        versionCode = 36",
				"    }",
				"}",
				"",
			].join("\n"),
		},
		{
			name: "整数代入からマイナー版へ更新すると CRLF と行末コメントを保持する",
			content: gradle("37 // API 37", "36 // API 36", "\r\n"),
			update: { newValue: "37.2", newMajor: 37, newMinor: 2 },
			expected: [
				"android {",
				"    compileSdk {",
				"        version = release(37) {",
				"            minorApiLevel = 2",
				"        }",
				"    } // API 37",
				"    defaultConfig {",
				"        minSdk = 26",
				"        targetSdk = 36 // API 36",
				"        versionCode = 36",
				"    }",
				"}",
				"",
			].join("\r\n"),
		},
		{
			name: "整数代入からメジャー .0 版へ更新すると整数代入・改行・行末コメントを維持する（CRLF）",
			content: gradle("37 // API 37", "36 // API 36", "\r\n"),
			update: { newValue: "38.0", newMajor: 38, newMinor: 0 },
			expected: gradle("38 // API 37", "36 // API 36", "\r\n"),
		},
		{
			name: "AGP 9 ブロック構文のマイナー更新（37.1 → 37.2）",
			content: gradleBlock(
				[
					"    compileSdk {",
					"        version = release(37) {",
					"            minorApiLevel = 1",
					"        }",
					"    }",
				],
				"36",
			),
			update: { newValue: "37.2", newMajor: 37, newMinor: 2 },
			expected: gradleBlock(
				[
					"    compileSdk {",
					"        version = release(37) {",
					"            minorApiLevel = 2",
					"        }",
					"    }",
				],
				"36",
			),
		},
		{
			name: "行末コメント付き AGP 9 ブロック構文のマイナー更新で全コメントと CRLF を保持する",
			content: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) { // API 37",
					"            minorApiLevel = 1 // QPR1",
					"        }",
					"    } // end",
				],
				"36",
				"\r\n",
			),
			update: { newValue: "37.2", newMajor: 37, newMinor: 2 },
			expected: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) { // API 37",
					"            minorApiLevel = 2 // QPR1",
					"        }",
					"    } // end",
				],
				"36",
				"\r\n",
			),
		},
		{
			name: "AGP 9 ブロック構文の it.minorApiLevel とコメントと CRLF を維持して更新する",
			content: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) { // API 37",
					"            it.minorApiLevel = 1 // QPR1",
					"        }",
					"    }",
				],
				"36",
				"\r\n",
			),
			update: { newValue: "37.2", newMajor: 37, newMinor: 2 },
			expected: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) { // API 37",
					"            it.minorApiLevel = 2 // QPR1",
					"        }",
					"    }",
				],
				"36",
				"\r\n",
			),
		},
		{
			name: "AGP 9 ブロック構文のメジャー更新（37.2 → 38.0）で外側コメントと CRLF を保持し minorApiLevel ブロックを外す",
			content: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) { // API 37",
					"            minorApiLevel = 2 // QPR2",
					"        }",
					"    } // end",
				],
				"36",
				"\r\n",
			),
			update: { newValue: "38.0", newMajor: 38, newMinor: 0 },
			expected: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(38)",
					"    } // end",
				],
				"36",
				"\r\n",
			),
		},
		{
			name: "minorApiLevel なしブロックからマイナー版（37.0 → 37.2）へ更新しコメントと CRLF を保持する",
			content: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) // API 37",
					"    } // end",
				],
				"36",
				"\r\n",
			),
			update: { newValue: "37.2", newMajor: 37, newMinor: 2 },
			expected: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) { // API 37",
					"            minorApiLevel = 2",
					"        }",
					"    } // end",
				],
				"36",
				"\r\n",
			),
		},
		{
			name: "minorApiLevel なしブロックからメジャー版（37.0 → 38.0）へ更新しコメントと CRLF を保持する",
			content: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(37) // API 37",
					"    } // end",
				],
				"36",
				"\r\n",
			),
			update: { newValue: "38.0", newMajor: 38, newMinor: 0 },
			expected: gradleBlock(
				[
					"    compileSdk { // AGP 9",
					"        version = release(38) // API 37",
					"    } // end",
				],
				"36",
				"\r\n",
			),
		},
		{
			name: "2 スペースインデントのブロック構文でインデント幅を保持する",
			content: gradleBlock(
				[
					"  compileSdk {",
					"    version = release(37) {",
					"      minorApiLevel = 1",
					"    }",
					"  }",
				],
				"36",
				"\n",
				"  ",
			),
			update: { newValue: "37.2", newMajor: 37, newMinor: 2 },
			expected: gradleBlock(
				[
					"  compileSdk {",
					"    version = release(37) {",
					"      minorApiLevel = 2",
					"    }",
					"  }",
				],
				"36",
				"\n",
				"  ",
			),
		},
	])("compileSdk 自動置換: $name", async ({ content, update, expected }) => {
		expect(await runAutoReplace(compileManager, content, update)).toBe(
			expected,
		);
	});

	it("AGP 9 ブロック構文の下でも targetSdk 更新で他の値と行末コメントを変えない", async () => {
		const content = gradleBlock(
			[
				"    compileSdk {",
				"        version = release(37) {",
				"            minorApiLevel = 2",
				"        }",
				"    }",
			],
			"36 // API 36",
		);
		expect(
			await runAutoReplace(targetManager, content, { newValue: "37" }),
		).toBe(content.replace("targetSdk = 36", "targetSdk = 37"));
	});

	it("default プリセット併用時も minimumReleaseAge: null により timestamp なしの更新が pending にならない", async () => {
		vi.spyOn(CustomDatasource.prototype, "getReleases").mockResolvedValue({
			releases: [
				{ version: "38.0", isStable: true },
				{ version: "37.2", isStable: true },
				{ version: "37.1", isStable: true },
				{ version: "37.0", isStable: true },
			],
		});
		const dependency = extract(gradle("37", "36"), compileManager)?.deps[0];
		const merged = await applyPackageRules({
			...defaultPreset,
			...dependency,
			manager: "custom.regex",
			customDatasources: preset.customDatasources,
			minimumReleaseAgeBehaviour: "timestamp-required",
			updatePinnedDependencies: true,
			separateMajorMinor: true,
			packageRules: [
				...defaultPreset.packageRules,
				...androidPreset.packageRules,
				...preset.packageRules,
			],
		});
		expect(merged.minimumReleaseAge).toBeNull();

		const lookupResult = (await lookupUpdates(merged)).unwrap();
		expect(lookupResult.ok).toBe(true);
		expect(lookupResult.val?.updates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					updateType: "minor",
					newValue: "37.2",
					newMajor: 37,
					newMinor: 2,
				}),
				expect.objectContaining({
					updateType: "major",
					newValue: "38.0",
					newMajor: 38,
					newMinor: 0,
				}),
			]),
		);
		for (const update of lookupResult.val?.updates ?? []) {
			expect(update.pendingChecks).toBeUndefined();
		}
	});

	it("最新マイナー版（37.2）では不要な更新を提案しない", async () => {
		vi.spyOn(CustomDatasource.prototype, "getReleases").mockResolvedValue({
			releases: [
				{ version: "37.2", isStable: true },
				{ version: "37.1", isStable: true },
				{ version: "37.0", isStable: true },
			],
		});
		const content = gradleBlock(
			[
				"    compileSdk {",
				"        version = release(37) {",
				"            minorApiLevel = 2",
				"        }",
				"    }",
			],
			"36",
		);
		const dependency = extract(content, compileManager)?.deps[0];
		const merged = await applyPackageRules({
			...defaultPreset,
			...dependency,
			manager: "custom.regex",
			customDatasources: preset.customDatasources,
			minimumReleaseAgeBehaviour: "timestamp-required",
			updatePinnedDependencies: true,
			separateMajorMinor: true,
			packageRules: [
				...defaultPreset.packageRules,
				...androidPreset.packageRules,
				...preset.packageRules,
			],
		});
		const lookupResult = (await lookupUpdates(merged)).unwrap();
		expect(lookupResult.val?.updates).toEqual([]);
	});

	it.each([
		["compileSdk", "minor", true, ["automerge-candidate"]],
		["compileSdk", "major", false, ["major-manual-review"]],
		[
			"targetSdk",
			"major",
			false,
			["major-manual-review", "manual-verification-required"],
		],
		[
			"targetSdk",
			"minor",
			false,
			["automerge-candidate", "manual-verification-required"],
		],
	])(
		"共有プリセット併用時の %s (%s): 集中型オートマージ候補=%s",
		async (depType, updateType, expectedGlobalAutomergeCandidate, expectedLabels) => {
			const result = await applyPackageRules({
				...defaultPreset,
				datasource: "custom.android-sdk",
				manager: "custom.regex",
				depType,
				currentValue: depType === "compileSdk" ? "37.0" : "36",
				updateType,
				automerge: true,
				dependencyDashboardApproval: true,
				prCreation: "not-pending",
				packageRules: [
					...defaultPreset.packageRules,
					...androidPreset.packageRules,
					...preset.packageRules,
				],
			});
			expect(result).toMatchObject({
				automerge: false,
				minimumReleaseAge: null,
				dependencyDashboardApproval: false,
				prCreation: "immediate",
				groupName: null,
			});
			for (const label of expectedLabels) {
				expect(result.addLabels).toContain(label);
			}
			const candidate = isCandidate({
				labels: (result.addLabels ?? []).map((name: string) => ({ name })),
				isDraft: false,
				isCrossRepository: false,
				headRefName: "renovate/android-sdk",
				author: { login: "app/renovate" },
				baseRefName: "main",
			});
			expect(candidate).toBe(expectedGlobalAutomergeCandidate);
			if (depType === "targetSdk") {
				expect(result.prBodyNotes.join("\n")).toContain("手動確認してください");
			} else {
				expect(result.prBodyNotes.join("\n")).not.toContain(
					"手動確認してください",
				);
			}
		},
	);

	it("CLI の任意選択に登録し、SDK プリセットを最後に生成する", () => {
		expect(
			OPTION_PRESETS.some((option) => option.preset === "android-sdk"),
		).toBe(true);
		const [root] = prepareOutputFiles(".", [], {
			languages: ["android"],
			packageManagers: [],
			tools: [],
			options: ["android-sdk", "automerge", "schedule"],
		});
		expect(JSON.parse(root.content).extends.at(-1)).toBe(
			"github>scottlz0310/renovate-config//presets/options/android-sdk",
		);
	});
});
