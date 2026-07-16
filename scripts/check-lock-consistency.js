#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const baseRef = process.argv[2];

if (!baseRef) {
	console.error("BASE ref missing, cannot validate bun.lock consistency.");
	process.exit(1);
}

const file = "package.json";
const headJson = JSON.parse(readFileSync(file, "utf8"));
const baseJson = JSON.parse(
	execFileSync("git", ["show", `origin/${baseRef}:${file}`], {
		encoding: "utf8",
	}),
);

const keys = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
	"overrides",
	"resolutions",
	"trustedDependencies",
	"workspaces",
];

const changedKeys = keys.filter(
	(key) =>
		JSON.stringify(headJson[key] ?? {}) !== JSON.stringify(baseJson[key] ?? {}),
);

if (changedKeys.length > 0) {
	console.error(
		`Error: package.json fields [${changedKeys.join(", ")}] changed without updating bun.lock. Run 'bun install' and commit the new lockfile.`,
	);
	process.exit(1);
}

console.log(
	"package.json changes only affected metadata/scripts; no lockfile update required.",
);
