import { describe, expect, it, vi } from "vitest";
import {
	checksPassed,
	isCandidate,
	isWorkBranch,
	listRepositories,
	main,
	NO_CANDIDATES,
	processRepository,
	renderSummary,
	selectMergeTarget,
} from "../scripts/global-automerge.js";

const ok = {
	__typename: "CheckRun",
	status: "COMPLETED",
	conclusion: "SUCCESS",
};

function pr(overrides: Record<string, unknown> = {}) {
	return {
		number: 1,
		title: "chore(deps): update foo",
		createdAt: "2026-11-01T00:00:00Z",
		headRefName: "renovate/foo-1.x",
		headRefOid: "sha1",
		baseRefName: "main",
		isDraft: false,
		isCrossRepository: false,
		author: { login: "app/renovate" },
		labels: [{ name: "dependencies" }, { name: "automerge-candidate" }],
		mergeable: "MERGEABLE",
		mergeStateStatus: "CLEAN",
		statusCheckRollup: [ok],
		...overrides,
	};
}

const lockfile = (overrides: Record<string, unknown> = {}) =>
	pr({
		number: 99,
		headRefName: "renovate/lock-file-maintenance",
		labels: [{ name: "automerge-candidate" }, { name: "lockfile-maintenance" }],
		...overrides,
	});

const upToDate = async () => true;

describe("isWorkBranch", () => {
	it.each([
		["main", false],
		["master", false],
		["renovate/foo-1.x", false],
		["feat/x", true],
		["dependabot/npm/foo", true],
		["gh-pages", true],
	])("%s は作業ブランチ=%s", (name, expected) => {
		expect(isWorkBranch(name)).toBe(expected);
	});
});

describe("checksPassed", () => {
	it.each([
		["空は不成功", [], false],
		["すべて成功", [ok, ok], true],
		[
			"スキップと中立は成功扱い",
			[
				{ ...ok, conclusion: "SKIPPED" },
				{ ...ok, conclusion: "NEUTRAL" },
			],
			true,
		],
		["失敗を含む", [ok, { ...ok, conclusion: "FAILURE" }], false],
		[
			"実行中を含む",
			[ok, { ...ok, status: "IN_PROGRESS", conclusion: "" }],
			false,
		],
		[
			"コミットステータス成功",
			[{ __typename: "StatusContext", state: "SUCCESS" }],
			true,
		],
		[
			"コミットステータス保留",
			[{ __typename: "StatusContext", state: "PENDING" }],
			false,
		],
	])("%s", (_name, rollup, expected) => {
		expect(checksPassed(rollup)).toBe(expected);
	});
});

describe("isCandidate", () => {
	it.each([
		["通常の Renovate PR", {}, true],
		["bot 名 renovate[bot]", { author: { login: "renovate[bot]" } }, true],
		["他者の PR", { author: { login: "someone" } }, false],
		["renovate/ 以外のブランチ", { headRefName: "feat/x" }, false],
		["fork からの PR", { isCrossRepository: true }, false],
		["ドラフト", { isDraft: true }, false],
		["main/master 以外が base", { baseRefName: "release/1" }, false],
		["ラベルなし", { labels: [] }, false],
		[
			"major-manual-review が同居するグループ PR",
			{
				labels: [
					{ name: "automerge-candidate" },
					{ name: "major-manual-review" },
				],
			},
			false,
		],
		[
			"manual-verification-required",
			{
				labels: [
					{ name: "automerge-candidate" },
					{ name: "manual-verification-required" },
				],
			},
			false,
		],
	])("%s", (_name, overrides, expected) => {
		expect(isCandidate(pr(overrides))).toBe(expected);
	});
});

describe("selectMergeTarget", () => {
	it("個別更新はマージ可能な最古を選ぶ（先頭が CI 失敗でも後続を選ぶ）", async () => {
		const failing = pr({
			number: 1,
			createdAt: "2026-11-01T00:00:00Z",
			statusCheckRollup: [{ ...ok, conclusion: "FAILURE" }],
		});
		const second = pr({ number: 2, createdAt: "2026-11-02T00:00:00Z" });
		const third = pr({ number: 3, createdAt: "2026-11-03T00:00:00Z" });
		const result = await selectMergeTarget([third, second, failing], upToDate);
		expect(result.target?.number).toBe(2);
		expect(result.priority).toBe(1);
		expect(result.skipped).toEqual([
			{ number: 1, reason: "CI が未完了または失敗" },
		]);
	});

	it("base に未追従の PR は飛ばして次を選ぶ", async () => {
		const behind = pr({ number: 1, headRefOid: "behind" });
		const next = pr({ number: 2, createdAt: "2026-11-02T00:00:00Z" });
		const result = await selectMergeTarget(
			[behind, next],
			async (candidate) => candidate.headRefOid !== "behind",
		);
		expect(result.target?.number).toBe(2);
		expect(result.skipped).toEqual([{ number: 1, reason: "base に未追従" }]);
	});

	it("個別更新が open の間は、lockfile maintenance が成功していても選ばない", async () => {
		const pending = pr({
			number: 1,
			statusCheckRollup: [{ ...ok, status: "IN_PROGRESS", conclusion: "" }],
		});
		const result = await selectMergeTarget([pending, lockfile()], upToDate);
		expect(result.target).toBeNull();
		expect(result.priority).toBe(1);
	});

	it("個別更新が無ければ lockfile maintenance を選ぶ", async () => {
		const result = await selectMergeTarget([lockfile()], upToDate);
		expect(result.target?.number).toBe(99);
		expect(result.priority).toBe(2);
	});

	it("major と同居する PR は個別更新として数えず、lockfile を止めない", async () => {
		const mixed = pr({
			labels: [
				{ name: "automerge-candidate" },
				{ name: "major-manual-review" },
			],
		});
		const result = await selectMergeTarget([mixed, lockfile()], upToDate);
		expect(result.target?.number).toBe(99);
	});

	it.each([
		["mergeable が UNKNOWN", { mergeable: "UNKNOWN" }],
		["mergeStateStatus が BLOCKED", { mergeStateStatus: "BLOCKED" }],
		["mergeStateStatus が DIRTY", { mergeStateStatus: "DIRTY" }],
		["チェックが 0 件", { statusCheckRollup: [] }],
	])("%s の PR は選ばない", async (_name, overrides) => {
		const result = await selectMergeTarget([pr(overrides)], upToDate);
		expect(result.target).toBeNull();
	});
});

type Call = string[];

/** 引数の先頭に応じて応答を返す gh のスタブ。呼び出しも記録する。 */
function fakeGh(responses: {
	prs?: unknown[];
	branches?: string[];
	behindBy?: string;
}) {
	const calls: Call[] = [];
	const gh = vi.fn(async (args: string[]) => {
		calls.push(args);
		if (args[0] === "pr" && args[1] === "list") {
			return JSON.stringify(responses.prs ?? []);
		}
		if (args[0] === "api" && args[2].endsWith("/branches")) {
			return `${(responses.branches ?? ["main"]).join("\n")}\n`;
		}
		if (args[0] === "api" && args[1].includes("/compare/")) {
			return `${responses.behindBy ?? "0"}\n`;
		}
		if (args[0] === "pr" && args[1] === "merge") return "";
		throw new Error(`想定外の gh 呼び出し: ${args.join(" ")}`);
	});
	return { gh, calls };
}

const merged = (calls: Call[]) =>
	calls.filter((args) => args[0] === "pr" && args[1] === "merge");

describe("processRepository", () => {
	it("候補が無ければブランチ走査もせずに終える", async () => {
		const { gh, calls } = fakeGh({ prs: [] });
		await expect(processRepository("o/r", { gh, dryRun: false })).resolves.toBe(
			"候補 PR なし",
		);
		expect(calls).toHaveLength(1);
	});

	it("作業ブランチがあればマージしない", async () => {
		const { gh, calls } = fakeGh({
			prs: [pr()],
			branches: ["main", "renovate/foo-1.x", "feat/wip"],
		});
		const result = await processRepository("o/r", { gh, dryRun: false });
		expect(result).toContain("feat/wip");
		expect(merged(calls)).toHaveLength(0);
	});

	it("条件を満たせば head SHA を固定して 1 本だけスカッシュマージする", async () => {
		const { gh, calls } = fakeGh({
			prs: [
				pr({ number: 1, headRefOid: "aaa" }),
				pr({ number: 2, headRefOid: "bbb", createdAt: "2026-11-02T00:00:00Z" }),
			],
			branches: ["main", "renovate/foo-1.x"],
		});
		const result = await processRepository("o/r", { gh, dryRun: false });
		expect(result).toContain("#1");
		expect(merged(calls)).toEqual([
			[
				"pr",
				"merge",
				"1",
				"-R",
				"o/r",
				"--squash",
				"--delete-branch",
				"--match-head-commit",
				"aaa",
			],
		]);
	});

	it("dry-run ではマージしない", async () => {
		const { gh, calls } = fakeGh({ prs: [pr()] });
		const result = await processRepository("o/r", { gh, dryRun: true });
		expect(result).toContain("[dry-run]");
		expect(merged(calls)).toHaveLength(0);
	});

	it("base に未追従ならマージしない", async () => {
		const { gh, calls } = fakeGh({ prs: [pr()], behindBy: "2" });
		const result = await processRepository("o/r", { gh, dryRun: false });
		expect(result).toContain("マージ可能な PR なし");
		expect(merged(calls)).toHaveLength(0);
	});
});

describe("listRepositories", () => {
	it("App のインストール先を installation API から取得する", async () => {
		const { gh } = fakeGh({});
		gh.mockResolvedValueOnce("o/a\no/b\n");
		await expect(listRepositories(gh)).resolves.toEqual(["o/a", "o/b"]);
		expect(gh.mock.calls[0][0]).toContain("/installation/repositories");
	});
});

describe("renderSummary", () => {
	const row = (repo: string, result: string, failed = false) => ({
		repo,
		result,
		failed,
	});

	it.each([
		["実マージ", false, "## Global Automerge\n"],
		["dry-run", true, "## Global Automerge (dry-run)\n"],
	])("%s の見出しを付ける", (_name, dryRun, heading) => {
		expect(renderSummary([], { dryRun })).toContain(heading);
	});

	it("候補なしは件数にまとめ、動きのあったものだけを表にする", () => {
		const markdown = renderSummary(
			[
				row("o/a", NO_CANDIDATES),
				row("o/b", NO_CANDIDATES),
				row("o/c", "マージ: #1 chore: update foo (Priority 1)"),
				row("o/d", "エラー: 権限不足", true),
			],
			{ dryRun: false },
		);
		expect(markdown).toContain("対象 4 件 / 候補 PR なし 2 件 / 失敗 1 件");
		expect(markdown).toContain(
			"| o/c | マージ: #1 chore: update foo (Priority 1) |",
		);
		expect(markdown).toContain("| o/d | エラー: 権限不足 |");
		expect(markdown).not.toContain("| o/a |");
	});

	it("全件が候補なしなら表を出さない", () => {
		const markdown = renderSummary([row("o/a", NO_CANDIDATES)], {
			dryRun: false,
		});
		expect(markdown).not.toContain("| リポジトリ |");
	});

	it.each([
		["パイプ", "a | b", "a \\| b"],
		["改行", "a\nb", "a b"],
	])("表を壊す文字（%s）をエスケープする", (_name, input, expected) => {
		const markdown = renderSummary([row("o/a", input)], { dryRun: false });
		expect(markdown).toContain(`| o/a | ${expected} |`);
	});

	it("長すぎる結果は切り詰める", () => {
		const markdown = renderSummary([row("o/a", "x".repeat(1000), true)], {
			dryRun: false,
		});
		expect(markdown).toContain(`${"x".repeat(300)}…`);
		expect(markdown).not.toContain("x".repeat(301));
	});
});

describe("main", () => {
	it("1 件が失敗しても残りを処理し、終了コード 1 で失敗を伝える", async () => {
		const log = vi.fn();
		const gh = vi.fn(async (args: string[]) => {
			if (args.includes("/installation/repositories")) return "o/bad\no/good\n";
			if (args.includes("o/bad")) throw new Error("権限不足");
			return "[]";
		});
		await expect(main([], { gh, log })).resolves.toBe(1);
		expect(log).toHaveBeenCalledWith("o/bad: エラー: 権限不足");
		expect(log).toHaveBeenCalledWith("o/good: 候補 PR なし");
	});

	it("--repo で対象を 1 件に限定し、一覧 API を呼ばない", async () => {
		const log = vi.fn();
		const { gh, calls } = fakeGh({ prs: [] });
		await expect(main(["--repo", "o/only"], { gh, log })).resolves.toBe(0);
		expect(
			calls.some((args) => args.includes("/installation/repositories")),
		).toBe(false);
	});

	it("実行の最後に、全リポジトリの結果を Summary として 1 回渡す", async () => {
		const summary = vi.fn();
		const gh = vi.fn(async (args: string[]) => {
			if (args.includes("/installation/repositories")) return "o/bad\no/good\n";
			if (args.includes("o/bad")) throw new Error("権限不足");
			return "[]";
		});
		await main(["--dry-run"], { gh, log: vi.fn(), summary });
		expect(summary).toHaveBeenCalledTimes(1);
		const markdown = summary.mock.calls[0][0];
		expect(markdown).toContain("## Global Automerge (dry-run)");
		expect(markdown).toContain("| o/bad | エラー: 権限不足 |");
		expect(markdown).not.toContain("o/good");
	});

	it("--repo に値が無ければエラーにする", async () => {
		const { gh } = fakeGh({});
		await expect(main(["--repo"], { gh, log: vi.fn() })).rejects.toThrow(
			"--repo",
		);
	});
});
