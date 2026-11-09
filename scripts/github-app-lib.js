import { spawnSync } from "node:child_process";
import { createPrivateKey } from "node:crypto";

const WORKER_DIR = "workers/automerge-trigger";
export const VARIABLE_NAME = "GLOBAL_AUTOMERGE_CLIENT_ID";
export const SECRET_NAME = "GLOBAL_AUTOMERGE_PRIVATE_KEY";

// Cloudflare Workers の WebCrypto は PKCS#8 しか読めないが、GitHub が発行する鍵は PKCS#1 である。
export function toPkcs8Pem(pem) {
	return createPrivateKey(pem)
		.export({ type: "pkcs8", format: "pem" })
		.toString();
}

export function appName(owner) {
	return `${owner}-global-automerge`;
}

// 個人アカウントと組織で、App の作成先 URL が異なる。
export function manifestActionUrl(ownerType, owner, state) {
	const base =
		ownerType === "Organization"
			? `https://github.com/organizations/${owner}/settings/apps/new`
			: "https://github.com/settings/apps/new";
	return `${base}?state=${state}`;
}

export function buildManifest({ owner, repo, redirectUrl }) {
	return {
		name: appName(owner),
		url: `https://github.com/${owner}/${repo}`,
		description:
			"Renovate PR を 1 実行 1 リポジトリ最大 1 本ずつ集中的にスカッシュマージする。",
		redirect_url: redirectUrl,
		public: false,
		hook_attributes: {
			url: `https://github.com/${owner}/${repo}`,
			active: false,
		},
		// actions: write は Worker が workflow_dispatch を呼ぶために必要。
		default_permissions: {
			contents: "write",
			pull_requests: "write",
			actions: "write",
			checks: "read",
			statuses: "read",
		},
	};
}

export function workerSecretsJson(clientId, privateKeyPem) {
	return JSON.stringify({
		GITHUB_APP_CLIENT_ID: clientId,
		GITHUB_APP_PRIVATE_KEY: toPkcs8Pem(privateKeyPem),
	});
}

function run(command, args, { input, cwd } = {}) {
	const result = spawnSync(command, args, {
		input,
		cwd,
		encoding: "utf8",
		// Windows では bunx が .exe とは限らないため、固定引数のみ shell 経由にする。
		shell: process.platform === "win32" && command !== "gh",
	});
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.slice(0, 3).join(" ")} が失敗しました: ${(result.stderr || result.error?.message || "").trim()}`,
		);
	}
	return result.stdout;
}

export function gh(args, input) {
	return run("gh", args, { input });
}

export function currentRepository() {
	const nameWithOwner = gh([
		"repo",
		"view",
		"--json",
		"nameWithOwner",
		"--jq",
		".nameWithOwner",
	]).trim();
	const [owner, repo] = nameWithOwner.split("/");
	return { owner, repo };
}

export function ownerType(owner) {
	return gh(["api", `users/${owner}`, "--jq", ".type"]).trim();
}

// 鍵は標準入力で渡し、コマンドラインにもディスクにも残さない。
export function putWorkerSecrets(clientId, privateKeyPem) {
	return run(
		"bunx",
		["wrangler", "secret", "bulk", "--config", "wrangler.jsonc"],
		{
			input: workerSecretsJson(clientId, privateKeyPem),
			cwd: WORKER_DIR,
		},
	);
}
