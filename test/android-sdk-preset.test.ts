import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GlobalConfig } from "renovate/dist/config/global.js";
import { CustomDatasource } from "renovate/dist/modules/datasource/custom/index.js";
import { extractPackageFile } from "renovate/dist/modules/manager/custom/regex/index.js";
import { applyPackageRules } from "renovate/dist/util/package-rules/index.js";
import { matchRegexOrGlob } from "renovate/dist/util/string-match.js";
import { doAutoReplace } from "renovate/dist/workers/repository/update/branch/auto-replace.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPTION_PRESETS } from "../src/detector.js";
import { prepareOutputFiles } from "../src/generator.js";

function readPreset(name: string) {
	return JSON.parse(
		readFileSync(new URL(`../presets/${name}.json`, import.meta.url), "utf8"),
	);
}

const preset = readPreset("options/android-sdk");
const [compileManager, targetManager] = preset.customManagers;
const fileName = "android/app/build.gradle.kts";

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

function extract(content: string, manager = targetManager) {
	return extractPackageFile(content, fileName, manager);
}

const apiData = {
	result: {
		releases: [
			{ name: "17", releaseDate: "2026-06-16", custom: { apiVersion: "37" } },
			{ name: "16", releaseDate: "2025-06-10", custom: { apiVersion: "36" } },
			{ name: "15", releaseDate: "2024-09-03", custom: { apiVersion: "35" } },
			{
				name: "18-beta",
				releaseDate: "2026-01-01",
				custom: { apiVersion: "38" },
			},
			{ name: "18", releaseDate: "2099-01-01", custom: { apiVersion: "38" } },
			{
				name: "19",
				releaseDate: "2026-01-01",
				custom: { apiVersion: "39-preview" },
			},
			{
				name: "4.0",
				releaseDate: "2011-10-18",
				custom: { apiVersion: "14-15" },
			},
		],
	},
};

async function releases(packageName: string) {
	const datasource = new CustomDatasource();
	const request = vi
		.spyOn(datasource.http, "getJsonUnchecked")
		.mockResolvedValue({ body: apiData });
	const result = await datasource.getReleases({
		datasource: "custom.android-sdk",
		packageName,
		customDatasources: preset.customDatasources,
	});
	expect(request).toHaveBeenCalledWith(
		"https://endoflife.date/api/v1/products/android",
	);
	return result?.releases.map(
		(release: { version: string }) => release.version,
	);
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
				currentValue: "37",
				packageName: "latest",
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

	it.each(["libs.versions.targetSdk.get().toInt()", "36 + 1", '"36"', "36.1"])(
		"整数以外の targetSdk を無視する: %s",
		(value) => expect(extract(gradle("37", value))).toBeNull(),
	);

	it.each(["libs.versions.compileSdk.get().toInt()", "36 + 1", '"37"'])(
		"compileSdk が整数でない場合は targetSdk も提案しない: %s",
		(value) => {
			expect(extract(gradle(value, "36"))).toBeNull();
			expect(extract(gradle(value, "36"), compileManager)).toBeNull();
		},
	);

	it("コメントアウトされた値と Android ブロック外の値を無視する", () => {
		const content =
			"compileSdk = 37\ntargetSdk = 36\nandroid {\n    // compileSdk = 37\n    // targetSdk = 36\n}\n";
		expect(extract(content)).toBeNull();
		expect(extract(content, compileManager)).toBeNull();
	});

	it("行末コメントを含む値を抽出する", () => {
		expect(
			extract(gradle("37 // API", "36 // 検証済み"))?.deps[0],
		).toMatchObject({
			currentValue: "36",
			packageName: "37",
		});
	});

	it("安定版・公開済みの整数 API のみ取得する", async () => {
		expect(await releases("latest")).toEqual(["37", "36", "35"]);
	});

	it.each([
		["36", ["36", "35"]],
		["37", ["37", "36", "35"]],
		["34", []],
	])(
		"targetSdk の候補を compileSdk=%s 以下に制限する",
		async (compile, expected) => {
			const dependency = extract(gradle(compile, "34"))?.deps[0];
			expect(await releases(dependency.packageName)).toEqual(expected);
		},
	);

	it("compileSdk をマージした後に targetSdk の候補が増える", async () => {
		const before = extract(gradle("36", "35"))?.deps[0];
		const after = extract(gradle("37", "35"))?.deps[0];
		expect(await releases(before.packageName)).not.toContain("37");
		expect(await releases(after.packageName)).toContain("37");
	});

	it.each([
		[compileManager, "compileSdk", "37", "38"],
		[targetManager, "targetSdk", "36", "37"],
	])(
		"SDK 更新で他の値と行末コメントを変えない（%s）",
		async (manager, field, before, after) => {
			const localDir = await mkdtemp(join(tmpdir(), "renovate-android-sdk-"));
			const previousConfig = GlobalConfig.get();
			GlobalConfig.set({ ...previousConfig, localDir });
			try {
				const content = gradle("37 // API 37", "36 // API 36");
				const dependency = extract(content, manager)?.deps[0];
				const options = await applyPackageRules({
					...dependency,
					packageRules: preset.packageRules,
				});
				const updated = await doAutoReplace(
					{
						...manager,
						...options,
						manager: "regex",
						packageFile: fileName,
						depIndex: 0,
						newValue: after,
					},
					content,
					false,
				);
				expect(updated).toBe(
					content.replace(`${field} = ${before}`, `${field} = ${after}`),
				);
			} finally {
				GlobalConfig.set(previousConfig);
				await rm(localDir, { recursive: true, force: true });
			}
		},
	);

	it.each([
		["compileSdk", "major"],
		["targetSdk", "major"],
		["compileSdk", "minor"],
		["targetSdk", "minor"],
		["compileSdk", "patch"],
		["targetSdk", "patch"],
	])(
		"共有プリセット併用時も %s の %s 更新は即時 PR・手動マージ・グループ外になる",
		async (depType, updateType) => {
			const result = await applyPackageRules({
				datasource: "custom.android-sdk",
				manager: "custom.regex",
				depType,
				currentValue: "36",
				updateType,
				automerge: true,
				dependencyDashboardApproval: true,
				prCreation: "not-pending",
				packageRules: [
					...readPreset("languages/android").packageRules,
					...preset.packageRules,
				],
			});
			expect(result).toMatchObject({
				automerge: false,
				dependencyDashboardApproval: false,
				prCreation: "immediate",
				groupName: null,
			});
			if (depType === "targetSdk") {
				expect(result.addLabels).toContain("manual-verification-required");
				expect(result.prBodyNotes.join("\n")).toContain("手動確認してください");
			} else {
				expect(result.addLabels ?? []).not.toContain(
					"manual-verification-required",
				);
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
