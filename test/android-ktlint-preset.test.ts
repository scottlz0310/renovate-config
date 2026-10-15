import { readFileSync } from "node:fs";
import { extractPackageFile } from "renovate/dist/modules/manager/custom/regex/index.js";
import { matchRegexOrGlob } from "renovate/dist/util/string-match.js";
import { describe, expect, it } from "vitest";

const preset = JSON.parse(
	readFileSync(
		new URL("../presets/languages/android.json", import.meta.url),
		"utf8",
	),
);
const manager = preset.customManagers.find(
	(m: { depNameTemplate: string }) => m.depNameTemplate === "ktlint/ktlint",
);

function extract(content: string, fileName = ".ktlint-version") {
	return extractPackageFile(content, fileName, manager);
}

describe("Android プリセットの ktlint 版検出", () => {
	it.each([
		[".ktlint-version", true],
		["android/.ktlint-version", true],
		["ktlint-version", false],
		[".ktlint-version.bak", false],
		["not.ktlint-version", false],
	])("対象ファイル %s: %s", (path, expected) => {
		expect(
			manager.managerFilePatterns.some((pattern: string) =>
				matchRegexOrGlob(path, pattern),
			),
		).toBe(expected);
	});

	it.each([
		["1.8.0\n", "1.8.0"],
		["1.8.0", "1.8.0"],
		["1.8.0\r\n", "1.8.0"],
		["  1.10.2  \n", "1.10.2"],
	])("版を抽出する: %j", (content, expected) => {
		expect(extract(content)?.deps).toMatchObject([
			{
				depName: "ktlint/ktlint",
				currentValue: expected,
				datasource: "github-releases",
			},
		]);
	});

	it.each([
		["v1.8.0\n"],
		["1.8\n"],
		["1.8.0-rc.1\n"],
		["ktlint 1.8.0\n"],
		["\n"],
	])("x.y.z 以外の記述は検出しない: %j", (content) => {
		expect(extract(content)).toBeNull();
	});
});
