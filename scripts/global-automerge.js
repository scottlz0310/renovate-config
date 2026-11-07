#!/usr/bin/env node
/**
 * 集中型オートマージ。GitHub App のインストール先リポジトリを巡回し、
 * 1 リポジトリにつき最大 1 本の Renovate PR をスカッシュマージする。
 *
 * 使い方: GH_TOKEN=<App の installation token> bun scripts/global-automerge.js [--dry-run] [--repo owner/name]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const LABEL_CANDIDATE = "automerge-candidate";
export const LABEL_LOCKFILE = "lockfile-maintenance";
// major-manual-review は major 更新、manual-verification-required は android-sdk の targetSdk 更新。
// グループ PR ではこれらと automerge-candidate が同居しうるため、除外ラベルとして扱う。
export const EXCLUDE_LABELS = [
	"major-manual-review",
	"manual-verification-required",
];
const BASE_BRANCHES = ["main", "master"];
const RENOVATE_BRANCH_PREFIX = "renovate/";
// GitHub App 版 (app/renovate)、bot アカウント名 (renovate[bot])、PAT 運用 (renovate) を許容する。
const RENOVATE_AUTHOR = /^(app\/)?renovate(\[bot\])?$/;
const PASSING_CONCLUSIONS = ["SUCCESS", "NEUTRAL", "SKIPPED"];
const MERGEABLE_STATES = ["CLEAN", "HAS_HOOKS"];

const execFileAsync = promisify(execFile);

/**
 * @typedef {(args: string[]) => Promise<string>} Gh gh CLI を実行して標準出力を返す。テストで差し替える。
 */

/** @type {Gh} */
export async function runGh(args) {
	try {
		const { stdout } = await execFileAsync("gh", args, {
			maxBuffer: 32 * 1024 * 1024,
		});
		return stdout;
	} catch (error) {
		const stderr = error.stderr?.toString().trim();
		throw new Error(
			`gh ${args.slice(0, 3).join(" ")} が失敗しました: ${stderr || error.message}`,
			{ cause: error },
		);
	}
}

function lines(output) {
	return output.split("\n").filter((line) => line !== "");
}

function hasLabel(pr, name) {
	return pr.labels.some((label) => label.name === name);
}

export function isWorkBranch(name) {
	return (
		!BASE_BRANCHES.includes(name) && !name.startsWith(RENOVATE_BRANCH_PREFIX)
	);
}

/** マージ候補にできる Renovate 製 PR か（CI などの状態は見ない）。 */
export function isCandidate(pr) {
	return (
		hasLabel(pr, LABEL_CANDIDATE) &&
		!EXCLUDE_LABELS.some((name) => hasLabel(pr, name)) &&
		!pr.isDraft &&
		!pr.isCrossRepository &&
		pr.headRefName.startsWith(RENOVATE_BRANCH_PREFIX) &&
		RENOVATE_AUTHOR.test(pr.author?.login ?? "") &&
		BASE_BRANCHES.includes(pr.baseRefName)
	);
}

/** チェックが 1 件以上あり、すべて完了かつ成功（スキップ・中立を含む）か。 */
export function checksPassed(rollup) {
	if (rollup.length === 0) return false;
	return rollup.every((check) =>
		check.__typename === "StatusContext"
			? check.state === "SUCCESS"
			: check.status === "COMPLETED" &&
				PASSING_CONCLUSIONS.includes(check.conclusion),
	);
}

function notReadyReason(pr) {
	if (!checksPassed(pr.statusCheckRollup)) return "CI が未完了または失敗";
	if (pr.mergeable !== "MERGEABLE") return `mergeable=${pr.mergeable}`;
	if (!MERGEABLE_STATES.includes(pr.mergeStateStatus)) {
		return `mergeStateStatus=${pr.mergeStateStatus}`;
	}
	return null;
}

/**
 * マージ対象を最大 1 本選ぶ。
 * 個別更新（Priority 1）が 1 本でも open なら lockfile maintenance（Priority 2）は選ばない。
 * 先頭の PR が CI 失敗でも後続が詰まらないよう、マージ可能な最古の PR を選ぶ。
 *
 * @param {object[]} prs
 * @param {(pr: object) => Promise<boolean>} isUpToDate base に追従済みか
 */
export async function selectMergeTarget(prs, isUpToDate) {
	const candidates = prs
		.filter(isCandidate)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	const individual = candidates.filter((pr) => !hasLabel(pr, LABEL_LOCKFILE));
	const priority = individual.length > 0 ? 1 : 2;
	const pool =
		priority === 1
			? individual
			: candidates.filter((pr) => hasLabel(pr, LABEL_LOCKFILE));

	const skipped = [];
	for (const pr of pool) {
		const reason = notReadyReason(pr);
		if (reason) {
			skipped.push({ number: pr.number, reason });
		} else if (await isUpToDate(pr)) {
			return { target: pr, priority, skipped };
		} else {
			skipped.push({ number: pr.number, reason: "base に未追従" });
		}
	}
	return { target: null, priority, skipped, candidateCount: pool.length };
}

const PR_FIELDS = [
	"number",
	"title",
	"createdAt",
	"headRefName",
	"headRefOid",
	"baseRefName",
	"isDraft",
	"isCrossRepository",
	"author",
	"labels",
	"mergeable",
	"mergeStateStatus",
	"statusCheckRollup",
].join(",");

/**
 * 1 リポジトリを処理する。結果の要約文を返す。
 *
 * @param {string} repo owner/name
 * @param {{ gh: Gh, dryRun: boolean }} deps
 */
export async function processRepository(repo, { gh, dryRun }) {
	const prs = JSON.parse(
		await gh([
			"pr",
			"list",
			"-R",
			repo,
			"--state",
			"open",
			"--label",
			LABEL_CANDIDATE,
			"--limit",
			"200",
			"--json",
			PR_FIELDS,
		]),
	);
	if (!prs.some(isCandidate)) return "候補 PR なし";

	const branches = lines(
		await gh([
			"api",
			"--paginate",
			`repos/${repo}/branches`,
			"--jq",
			".[].name",
		]),
	);
	const workBranches = branches.filter(isWorkBranch);
	if (workBranches.length > 0) {
		return `作業ブランチあり (${workBranches.join(", ")}) のためスキップ`;
	}

	const { target, priority, skipped } = await selectMergeTarget(
		prs,
		async (pr) =>
			(
				await gh([
					"api",
					`repos/${repo}/compare/${pr.baseRefName}...${pr.headRefOid}`,
					"--jq",
					".behind_by",
				])
			).trim() === "0",
	);
	const skippedText = skipped
		.map(({ number, reason }) => `#${number}: ${reason}`)
		.join(", ");
	if (!target) {
		return `マージ可能な PR なし (Priority ${priority}${skippedText ? `; ${skippedText}` : ""})`;
	}

	const summary = `#${target.number} ${target.title} (Priority ${priority})`;
	if (dryRun) return `[dry-run] マージ対象: ${summary}`;
	await gh([
		"pr",
		"merge",
		String(target.number),
		"-R",
		repo,
		"--squash",
		"--delete-branch",
		"--match-head-commit",
		target.headRefOid,
	]);
	return `マージ: ${summary}`;
}

/** App のインストール先（アーカイブ済みを除く）を返す。範囲は App のインストール設定で決まる。 */
export async function listRepositories(gh) {
	return lines(
		await gh([
			"api",
			"--paginate",
			"/installation/repositories",
			"--jq",
			".repositories[] | select(.archived | not) | .full_name",
		]),
	);
}

/**
 * @param {string[]} argv
 * @param {{ gh: Gh, log: (message: string) => void }} deps
 * @returns {Promise<number>} 終了コード
 */
export async function main(argv, { gh, log }) {
	const dryRun = argv.includes("--dry-run");
	const repoIndex = argv.indexOf("--repo");
	const only = repoIndex === -1 ? undefined : argv[repoIndex + 1];
	if (repoIndex !== -1 && !only) {
		throw new Error("--repo には owner/name を指定してください");
	}

	const repos = only ? [only] : await listRepositories(gh);
	const failures = [];
	// リポジトリ間は独立。1 件の失敗で他を止めず、最後に失敗として終了コードへ反映する。
	for (const repo of repos) {
		try {
			log(`${repo}: ${await processRepository(repo, { gh, dryRun })}`);
		} catch (error) {
			failures.push(repo);
			log(`${repo}: エラー: ${error.message}`);
		}
	}
	if (failures.length > 0) {
		log(
			`${failures.length} 件のリポジトリで失敗しました: ${failures.join(", ")}`,
		);
		return 1;
	}
	return 0;
}

if (import.meta.main) {
	process.exitCode = await main(process.argv.slice(2), {
		gh: runGh,
		log: console.log,
	});
}
