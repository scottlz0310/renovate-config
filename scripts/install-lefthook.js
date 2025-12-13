#!/usr/bin/env node
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const initCwd = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : null;
const cwd = resolve(process.cwd());

// Avoid running when this repo is being installed as a dependency (e.g. via git URL).
if (!initCwd || initCwd !== cwd) process.exit(0);

// Common opt-outs.
if (process.env.CI || process.env.SKIP_LEFTHOOK === "1") process.exit(0);

try {
	execSync("npx lefthook install", { stdio: "inherit" });
} catch {
	// Don't fail installs just because git hooks couldn't be installed.
	console.warn("Warning: lefthook install failed; skipping.");
}
