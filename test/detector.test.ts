import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllDetectedPresets, scanProject } from "../src/detector.js";

describe("detector.scanProject", () => {
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
