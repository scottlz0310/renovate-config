import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	appName,
	buildManifest,
	manifestActionUrl,
	toPkcs8Pem,
	workerSecretsJson,
} from "../scripts/github-app-lib.js";

const pkcs1 = generateKeyPairSync("rsa", { modulusLength: 2048 })
	.privateKey.export({ type: "pkcs1", format: "pem" })
	.toString();

describe("toPkcs8Pem", () => {
	it("PKCS#1 の鍵を PKCS#8 に変換する", () => {
		expect(pkcs1).toContain("BEGIN RSA PRIVATE KEY");
		expect(toPkcs8Pem(pkcs1)).toContain("BEGIN PRIVATE KEY");
	});

	it("不正な鍵は例外にする", () => {
		expect(() => toPkcs8Pem("not a key")).toThrow();
	});
});

describe("workerSecretsJson", () => {
	it("Client ID と PKCS#8 の鍵を Worker の Secret 名で返す", () => {
		const parsed = JSON.parse(workerSecretsJson("Iv1.x", pkcs1));
		expect(parsed.GITHUB_APP_CLIENT_ID).toBe("Iv1.x");
		expect(parsed.GITHUB_APP_PRIVATE_KEY).toContain("BEGIN PRIVATE KEY");
	});
});

describe("manifestActionUrl", () => {
	it.each([
		[
			"Organization",
			"https://github.com/organizations/o/settings/apps/new?state=s",
		],
		["User", "https://github.com/settings/apps/new?state=s"],
	])("%s の作成先 URL", (type, expected) => {
		expect(manifestActionUrl(type, "o", "s")).toBe(expected);
	});
});

describe("buildManifest", () => {
	it("所有者から App 名を導出し、Worker 用の actions: write を要求する", () => {
		const manifest = buildManifest({
			owner: "o",
			repo: "r",
			redirectUrl: "http://127.0.0.1:1/callback",
		});
		expect(manifest.name).toBe(appName("o"));
		expect(manifest.default_permissions.actions).toBe("write");
		expect(manifest.hook_attributes.active).toBe(false);
	});
});
