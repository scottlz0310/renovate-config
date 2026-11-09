import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	createAppJwt,
	dispatchAutomerge,
	type Env,
} from "../workers/automerge-trigger/index.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const env: Env = {
	GITHUB_APP_CLIENT_ID: "Iv1.test",
	GITHUB_APP_PRIVATE_KEY: pem,
	TARGET_REPOSITORY: "scottlz0310/renovate-config",
	WORKFLOW_FILE: "global-automerge.yml",
	WORKFLOW_REF: "main",
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

describe("createAppJwt", () => {
	it("RS256 の JWT を iss / iat / exp 付きで生成する", async () => {
		const jwt = await createAppJwt("Iv1.test", pem, 1_000_000);
		const [header, payload] = jwt.split(".").slice(0, 2);
		expect(JSON.parse(atob(header))).toEqual({ alg: "RS256", typ: "JWT" });
		expect(JSON.parse(atob(payload))).toEqual({
			iss: "Iv1.test",
			iat: 999_940,
			exp: 1_000_540,
		});
	});

	it("PKCS#1 形式の鍵は変換を促して拒否する", async () => {
		await expect(
			createAppJwt(
				"Iv1.test",
				"-----BEGIN RSA PRIVATE KEY-----\nAA\n-----END RSA PRIVATE KEY-----",
				0,
			),
		).rejects.toThrow("PKCS#8");
	});
});

describe("dispatchAutomerge", () => {
	it("Installation Token を発行して workflow_dispatch を実行する", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json({ id: 42 }))
			.mockResolvedValueOnce(json({ token: "ghs_x" }, 201))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));

		await dispatchAutomerge(env, fetcher, 1_000_000);

		const calls = fetcher.mock.calls.map(([url, init]) => [
			init.method,
			url,
			init.headers.Authorization.startsWith("Bearer ghs_"),
			init.body,
		]);
		expect(calls).toEqual([
			[
				"GET",
				"https://api.github.com/repos/scottlz0310/renovate-config/installation",
				false,
				undefined,
			],
			[
				"POST",
				"https://api.github.com/app/installations/42/access_tokens",
				false,
				JSON.stringify({
					repositories: ["renovate-config"],
					permissions: { actions: "write" },
				}),
			],
			[
				"POST",
				"https://api.github.com/repos/scottlz0310/renovate-config/actions/workflows/global-automerge.yml/dispatches",
				true,
				JSON.stringify({ ref: "main" }),
			],
		]);
	});

	it.each([
		["Installation 取得", 0],
		["Token 発行", 1],
		["dispatch", 2],
	])("%s が失敗したらエラーを伝播する", async (_name, failAt) => {
		const responses = [
			() => json({ id: 42 }),
			() => json({ token: "ghs_x" }, 201),
			() => new Response(null, { status: 204 }),
		];
		responses[failAt] = () => new Response("denied", { status: 403 });
		const fetcher = vi.fn();
		for (const make of responses)
			fetcher.mockImplementationOnce(async () => make());

		await expect(dispatchAutomerge(env, fetcher, 0)).rejects.toThrow("403");
	});

	it("TARGET_REPOSITORY が不正ならエラーにする", async () => {
		await expect(
			dispatchAutomerge({ ...env, TARGET_REPOSITORY: "invalid" }, vi.fn()),
		).rejects.toThrow("owner/name");
	});
});
