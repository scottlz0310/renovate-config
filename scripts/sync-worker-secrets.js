#!/usr/bin/env node
/**
 * ダウンロードした GitHub App の秘密鍵 (PEM) を PKCS#8 に変換し、Cloudflare Workers の Secret に登録する。
 * 鍵の紛失・ローテーション時に再実行できる。変換結果はディスクに書かない。
 *
 * 前提: gh と wrangler (`bunx wrangler login`) にログイン済みで、Worker をデプロイ済み。
 * 使い方: bun scripts/sync-worker-secrets.js <秘密鍵.pem>
 */
import { readFileSync } from "node:fs";
import {
	currentRepository,
	gh,
	putWorkerSecrets,
	VARIABLE_NAME,
} from "./github-app-lib.js";

const pemPath = process.argv[2];
if (!pemPath) {
	console.error("使い方: bun scripts/sync-worker-secrets.js <秘密鍵.pem>");
	process.exit(1);
}

const { owner, repo } = currentRepository();
const clientId = gh([
	"variable",
	"get",
	VARIABLE_NAME,
	"-R",
	`${owner}/${repo}`,
]).trim();
console.log(putWorkerSecrets(clientId, readFileSync(pemPath)));
