import { readFileSync } from "node:fs";
import { getConfig } from "renovate/dist/config/defaults.js";
import { GlobalConfig } from "renovate/dist/config/global.js";
import { resolveConfigPresets } from "renovate/dist/config/presets/index.js";
import { mergeChildConfig } from "renovate/dist/config/utils.js";
import platformApis from "renovate/dist/modules/platform/api.js";
import { setPlatformApi } from "renovate/dist/modules/platform/index.js";
import { init, reset } from "renovate/dist/util/cache/memory/index.js";
import { GithubHttp } from "renovate/dist/util/http/github.js";
import { applyPackageRules } from "renovate/dist/util/package-rules/index.js";
import { ensureDependencyDashboard } from "renovate/dist/workers/repository/dependency-dashboard.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPTION_PRESETS } from "../src/detector.js";

const ensureIssue = vi.fn();
const githubApi = platformApis.get("github");

const prefix = "github>scottlz0310/renovate-config";
const deprecated = [
	"schedule",
	"production",
	"automerge",
	"security",
	"monorepo",
];

function readPreset(path: string) {
	return JSON.parse(
		readFileSync(new URL(`../${path}.json`, import.meta.url), "utf8"),
	);
}

async function resolve(extendsList: string[]) {
	const { config } = await resolveConfigPresets({
		repository: "another-owner/consumer",
		extends: extendsList,
	});
	return mergeChildConfig(getConfig(), config);
}

beforeEach(() => {
	init();
	GlobalConfig.set({ platform: "github", endpoint: "https://api.github.com/" });
	platformApis.set("github", {
		...githubApi,
		ensureIssue,
		maxBodyLength: () => 65536,
		massageMarkdown: (body: string) => body,
	});
	setPlatformApi("github");
	vi.spyOn(GithubHttp.prototype, "getJsonUnchecked").mockImplementation(
		async (url: string) => {
			const path = url.replace(
				/^(?:https:\/\/api\.github\.com\/)?repos\/scottlz0310\/renovate-config\/contents\//,
				"",
			);
			if (path === url || !/^(default|presets\/[\w/-]+)\.json$/.test(path)) {
				throw new Error(`想定外のプリセット取得先: ${url}`);
			}
			return {
				body: {
					content: Buffer.from(
						JSON.stringify(readPreset(path.slice(0, -5))),
					).toString("base64"),
				},
			};
		},
	);
	ensureIssue.mockClear();
});

afterEach(() => {
	vi.restoreAllMocks();
	platformApis.set("github", githubApi);
	setPlatformApi("github");
	reset();
	GlobalConfig.reset();
});

describe("標準プリセットの入口と更新方針", () => {
	it("直下は別名だけを持ち、設定の重複を許さない", () => {
		const alias = readPreset("default");
		expect(Object.keys(alias).sort()).toEqual([
			"$schema",
			"description",
			"extends",
		]);
		expect(alias.extends).toEqual([`${prefix}//presets/default`]);
	});

	it.each([prefix, "local>scottlz0310/renovate-config"])(
		"別リポジトリから %s を参照しても標準設定と一致する",
		async (entry) => {
			const alias = await resolve([entry]);
			const direct = await resolve([`${prefix}//presets/default`]);
			delete alias.description;
			delete direct.description;
			expect(alias).toEqual(direct);
			expect(GithubHttp.prototype.getJsonUnchecked).toHaveBeenCalledWith(
				expect.stringMatching(
					/repos\/scottlz0310\/renovate-config\/contents\/presets\/default\.json$/,
				),
				expect.anything(),
			);
		},
	);

	it.each(["major", "minor", "patch"])(
		"旧5 options併用後も %s 更新はスケジュールなし・3日待機・手動マージになる",
		async (updateType) => {
			const config = await resolve([
				prefix,
				...deprecated.map((name) => `${prefix}//presets/options/${name}`),
			]);
			const result = await applyPackageRules({
				...config,
				manager: "github-actions",
				datasource: "github-tags",
				depName: "actions/checkout",
				currentValue: "v7",
				updateType,
			});
			expect(result).toMatchObject({
				schedule: [],
				minimumReleaseAge: "3 days",
				internalChecksFilter: "strict",
				automerge: false,
				dependencyDashboardApproval: false,
				groupName: "GitHub Actions",
			});
			expect(config.lockFileMaintenance.minimumReleaseAge).toBeNull();
		},
	);

	it.each([
		["npm", "npm", "1 day"],
		["node-version", "nodenv", "5 days"],
	])("%s の既存個別待機日数を維持する", async (datasource, manager, age) => {
		const config = await resolve([
			prefix,
			`${prefix}//presets/languages/nodejs`,
		]);
		const result = await applyPackageRules({
			...config,
			datasource,
			manager,
			depName: datasource === "npm" ? "example" : "node",
			updateType: "patch",
		});
		expect(result.minimumReleaseAge).toBe(age);
	});
});

describe("非推奨 options の削除案内", () => {
	it("CLI の選択肢は Android SDK だけにする", () => {
		expect(OPTION_PRESETS.map((option) => option.preset)).toEqual([
			"android-sdk",
		]);
	});

	it.each(deprecated)("%s は警告表示だけを持つ", (name) => {
		expect(Object.keys(readPreset(`presets/options/${name}`)).sort()).toEqual([
			"$schema",
			"dependencyDashboardFooter",
			"description",
		]);
	});

	it.each([...deprecated.map((name) => [[name]]), [deprecated]])(
		"%j の参照中は更新PRがなくても Dashboard に削除案内が生成される",
		async (names) => {
			const config = await resolve([
				prefix,
				...names.map((name) => `${prefix}//presets/options/${name}`),
			]);
			await ensureDependencyDashboard(
				config,
				[],
				{},
				{ result: "no-migration" },
			);
			const body = ensureIssue.mock.calls[0][0].body;
			expect(body).toContain("非推奨の options プリセットが参照されています");
			for (const name of names) expect(body).toContain(`options/${name}`);
			expect(body).toContain("extends で参照している項目を削除してください");
		},
	);

	it("旧 options の参照を削除すると Dashboard から警告が消える", async () => {
		await ensureDependencyDashboard(
			await resolve([prefix]),
			[],
			{},
			{
				result: "no-migration",
			},
		);
		expect(ensureIssue.mock.calls[0][0].body).not.toContain("非推奨の options");
	});
});
