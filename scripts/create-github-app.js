#!/usr/bin/env node
/**
 * 集中型オートマージ用の GitHub App を Manifest フローで作成し、Client ID と秘密鍵を登録する。
 * 登録先: GitHub の Variable / Secret と、Cloudflare Workers の Secret（定期実行 Worker 用）。
 * 秘密鍵・client_secret・webhook_secret は画面にもディスクにも出さない（鍵はメモリから標準入力へ渡す）。
 *
 * 前提: gh にログイン済みで、wrangler にログイン済み（`bunx wrangler login`）。
 * 使い方: bun scripts/create-github-app.js [--no-open]
 * 既存の App の鍵を差し替えるときは scripts/sync-worker-secrets.js を使う。
 */
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
	buildManifest,
	currentRepository,
	gh,
	manifestActionUrl,
	ownerType,
	putWorkerSecrets,
	SECRET_NAME,
	VARIABLE_NAME,
} from "./github-app-lib.js";

const HOST = "127.0.0.1";
const TIMEOUT_MS = 10 * 60 * 1000;
const EXPECTED_PERMISSIONS = {
	contents: "write",
	pull_requests: "write",
	actions: "write",
	checks: "read",
	statuses: "read",
	metadata: "read",
};

function escapeAttr(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function safeEqual(a, b) {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

async function main() {
	const { owner, repo } = currentRepository();
	const fullName = `${owner}/${repo}`;
	const type = ownerType(owner);
	const state = randomBytes(24).toString("hex");
	const noOpen = process.argv.includes("--no-open");
	let consumed = false;

	function formPage(port) {
		const manifest = buildManifest({
			owner,
			repo,
			redirectUrl: `http://${HOST}:${port}/callback`,
		});
		return `<!doctype html><meta charset="utf-8"><title>GitHub App 作成</title>
<form id="f" method="post" action="${manifestActionUrl(type, owner, state)}">
<input type="hidden" name="manifest" value="${escapeAttr(JSON.stringify(manifest))}">
<noscript><button>GitHub で App を作成する</button></noscript></form>
<script>document.getElementById("f").submit()</script>`;
	}

	async function convertAndRegister(code) {
		const response = await fetch(
			`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
			{
				method: "POST",
				headers: {
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
					"User-Agent": "global-automerge-app-setup",
				},
			},
		);
		if (response.status !== 201) {
			throw new Error(`manifest の変換に失敗しました: HTTP ${response.status}`);
		}
		const app = await response.json();
		for (const key of ["slug", "html_url", "client_id", "pem"]) {
			if (typeof app[key] !== "string" || app[key] === "") {
				throw new Error(`変換結果に ${key} がありません`);
			}
		}
		if (app.owner?.login !== owner) {
			throw new Error(`想定外の所有者です: ${app.owner?.login}`);
		}
		const mismatched = Object.entries(EXPECTED_PERMISSIONS).filter(
			([name, level]) => app.permissions?.[name] !== level,
		);
		if (mismatched.length > 0) {
			throw new Error(
				`権限が想定と異なります: ${mismatched.map(([name]) => name).join(", ")}`,
			);
		}

		const lostKeyHint = `App は作成済みです。鍵は失われたため、${app.html_url} の「Generate a private key」で作り直し、登録してください（GitHub: gh secret set ${SECRET_NAME}、Cloudflare: bun scripts/sync-worker-secrets.js <pem>）。`;
		try {
			gh([
				"variable",
				"set",
				VARIABLE_NAME,
				"-R",
				fullName,
				"--body",
				app.client_id,
			]);
			gh(["secret", "set", SECRET_NAME, "-R", fullName], app.pem);
		} catch (error) {
			throw new Error(`${error.message}\n${lostKeyHint}`);
		}
		try {
			putWorkerSecrets(app.client_id, app.pem);
		} catch (error) {
			throw new Error(
				`${error.message}\nGitHub 側は登録済みです。Worker を一度デプロイしてから、鍵を作り直して scripts/sync-worker-secrets.js <pem> を実行してください。`,
			);
		}
		return app;
	}

	const server = createServer(async (req, res) => {
		const url = new URL(req.url ?? "/", `http://${HOST}`);
		try {
			if (req.method === "GET" && url.pathname === "/") {
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				res.end(formPage(server.address().port));
				return;
			}
			if (req.method === "GET" && url.pathname === "/callback") {
				const code = url.searchParams.get("code") ?? "";
				const returned = url.searchParams.get("state") ?? "";
				if (
					consumed ||
					!safeEqual(returned, state) ||
					!/^[\w-]{10,200}$/.test(code)
				) {
					res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
					res.end("不正なリクエストです。");
					return;
				}
				consumed = true;
				const app = await convertAndRegister(code);
				res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
				res.end(
					"App を作成し、Client ID と秘密鍵を登録しました。このタブは閉じてかまいません。",
				);
				console.log(`作成した App: ${app.slug} (${app.html_url})`);
				console.log(
					`インストール: https://github.com/apps/${app.slug}/installations/new`,
				);
				finish(0);
				return;
			}
			res.writeHead(404);
			res.end();
		} catch (error) {
			console.error(`エラー: ${error.message}`);
			res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("失敗しました。ターミナルのエラーを確認してください。");
			finish(1);
		}
	});

	function finish(code) {
		// 応答を返し終えてから止める。
		setTimeout(() => {
			server.close();
			process.exit(code);
		}, 300);
	}

	server.listen(0, HOST, () => {
		const { port } = server.address();
		const entry = `http://${HOST}:${port}/`;
		console.log(`待機中: ${entry}`);
		if (!noOpen) {
			spawn("cmd.exe", ["/c", "start", '""', entry], {
				stdio: "ignore",
				detached: true,
			}).unref();
			console.log(
				"ブラウザで GitHub の確認画面が開きます。内容を確認して「Create GitHub App」を押してください。",
			);
		}
		setTimeout(() => {
			console.error("10 分以内に承認がなかったため中止しました。");
			finish(1);
		}, TIMEOUT_MS).unref();
	});
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	await main();
}
