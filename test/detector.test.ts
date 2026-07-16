import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllDetectedPresets, scanProject } from "../src/detector.js";

describe("detector.scanProject", () => {
	it.each([
		["npm", ["package-lock.json"]],
		["pnpm", ["pnpm-lock.yaml"]],
		["bun", ["bun.lock"]],
		["bun", ["bun.lockb"]],
	] as const)("detects the %s package manager from its lockfile", async (expectedPreset, lockfiles) => {
		const dir = await mkdtemp(join(tmpdir(), "renovate-config-init-"));
		try {
			for (const lockfile of lockfiles) {
				await writeFile(join(dir, lockfile), "");
			}

			const scanResult = await scanProject(dir);
			const packageManagers = scanResult.root.detectedPresets.filter(
				(preset) => preset.category === "package-managers",
			);

			expect(packageManagers).toHaveLength(1);
			expect(packageManagers[0]?.preset).toBe(expectedPreset);
			expect(packageManagers[0]?.matchedFiles).toEqual([...lockfiles]);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("detects each package manager when multiple lockfiles coexist", async () => {
		const dir = await mkdtemp(join(tmpdir(), "renovate-config-init-"));
		try {
			for (const lockfile of [
				"package-lock.json",
				"pnpm-lock.yaml",
				"bun.lock",
			]) {
				await writeFile(join(dir, lockfile), "");
			}

			const scanResult = await scanProject(dir);
			const packageManagers = scanResult.root.detectedPresets
				.filter((preset) => preset.category === "package-managers")
				.map((preset) => preset.preset);

			expect(packageManagers).toEqual(["npm", "pnpm", "bun"]);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("detects Android projects from app Gradle module files", async () => {
		const dir = await mkdtemp(join(tmpdir(), "renovate-config-init-"));
		try {
			await mkdir(join(dir, "app"));
			await writeFile(
				join(dir, "app", "build.gradle.kts"),
				'plugins { id("com.android.application") }\n',
			);

			const scanResult = await scanProject(dir);
			const presets = getAllDetectedPresets(scanResult);

			expect(presets.has("android")).toBe(true);
			expect(
				scanResult.root.detectedPresets.some((p) => p.preset === "android"),
			).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("detects lefthook config files at project root", async () => {
		const dir = await mkdtemp(join(tmpdir(), "renovate-config-init-"));
		try {
			await writeFile(
				join(dir, ".lefthook.yml"),
				"pre-commit:\n  commands: {}\n",
			);

			const scanResult = await scanProject(dir);
			const presets = getAllDetectedPresets(scanResult);

			expect(presets.has("lefthook")).toBe(true);
			expect(
				scanResult.root.detectedPresets.some((p) => p.preset === "lefthook"),
			).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
