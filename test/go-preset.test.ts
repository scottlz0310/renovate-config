import { readFileSync } from "node:fs";
import { extractPackageFile } from "renovate/dist/modules/manager/custom/regex/index.js";
import { matchRegexOrGlob } from "renovate/dist/util/string-match.js";
import { describe, expect, it } from "vitest";

interface RegexCustomManager {
	customType: "regex";
	matchStringsStrategy: "recursive";
	managerFilePatterns: string[];
	matchStrings: string[];
	datasourceTemplate: string;
}

interface GoPreset {
	customManagers: RegexCustomManager[];
}

const preset = JSON.parse(
	readFileSync(
		new URL("../presets/languages/go.json", import.meta.url),
		"utf8",
	),
) as GoPreset;
const manager = preset.customManagers[0];

if (!manager) {
	throw new Error("Go preset regex custom manager not found");
}

function extract(content: string) {
	return extractPackageFile(content, ".github/workflows/ci.yml", manager);
}

describe("languages/go preset", () => {
	it.each([".github/workflows/ci.yml", ".github/workflows/security.yaml"])(
		"matches GitHub Actions workflow %s",
		(fileName) => {
			expect(
				manager.managerFilePatterns.some((pattern) =>
					matchRegexOrGlob(fileName, pattern),
				),
			).toBe(true);
		},
	);

	it.each([
		"ci.yml",
		".github/actions/ci.yml",
		".github/workflows/reusable/ci.yml",
		".github/workflows/ci.json",
	])("does not match non-workflow file %s", (fileName) => {
		expect(
			manager.managerFilePatterns.some((pattern) =>
				matchRegexOrGlob(fileName, pattern),
			),
		).toBe(false);
	});

	it.each([
		{
			name: "inline run command",
			content:
				"      run: go install golang.org/x/vuln/cmd/govulncheck@v1.1.4\n",
			depName: "golang.org/x/vuln/cmd/govulncheck",
			currentValue: "v1.1.4",
		},
		{
			name: "block run command",
			content:
				"      run: |\n        go install honnef.co/go/tools/cmd/staticcheck@v0.6.1\n",
			depName: "honnef.co/go/tools/cmd/staticcheck",
			currentValue: "v0.6.1",
		},
		{
			name: "pseudo-version",
			content:
				"      run: go install example.com/tool@v0.0.0-20260902071350-abcdef123456\n",
			depName: "example.com/tool",
			currentValue: "v0.0.0-20260902071350-abcdef123456",
		},
	])("extracts $name", ({ content, depName, currentValue }) => {
		const result = extract(content);

		expect(result?.deps).toHaveLength(1);
		expect(result?.deps[0]).toMatchObject({
			depName,
			currentValue,
			datasource: "go",
		});
	});

	it.each([
		"      run: go install golang.org/x/vuln/cmd/govulncheck@latest\n",
		"      # go install golang.org/x/vuln/cmd/govulncheck@v1.1.4\n",
		"      run: echo go install golang.org/x/vuln/cmd/govulncheck@v1.1.4\n",
		"      run: go install golang.org/x/vuln/cmd/govulncheck@v1.1\n",
	])("ignores non-fixed or inactive command %#", (content) => {
		expect(extract(content)).toBeNull();
	});

	it("updates the captured fixed version without changing the package path", () => {
		const content =
			"      run: go install golang.org/x/vuln/cmd/govulncheck@v1.1.4\n";
		const result = extract(content);
		const dependency = result?.deps[0];

		if (!dependency?.replaceString || !dependency.currentValue) {
			throw new Error("go install dependency was not extracted");
		}

		const updatedReplaceString = dependency.replaceString.replace(
			dependency.currentValue,
			"v1.7.0",
		);
		const updatedContent = content.replace(
			dependency.replaceString,
			updatedReplaceString,
		);

		expect(updatedContent).toBe(
			"      run: go install golang.org/x/vuln/cmd/govulncheck@v1.7.0\n",
		);
		expect(extract(updatedContent)?.deps[0]).toMatchObject({
			depName: "golang.org/x/vuln/cmd/govulncheck",
			currentValue: "v1.7.0",
			datasource: "go",
		});
	});

	it("extracts and updates adjacent go install commands", () => {
		const content = [
			"      run: |",
			"        go install golang.org/x/vuln/cmd/govulncheck@v1.1.4",
			"        go install honnef.co/go/tools/cmd/staticcheck@v0.6.1",
			"",
		].join("\n");
		const result = extract(content);

		expect(result?.deps).toHaveLength(2);
		expect(result?.deps).toMatchObject([
			{
				depName: "golang.org/x/vuln/cmd/govulncheck",
				currentValue: "v1.1.4",
				datasource: "go",
			},
			{
				depName: "honnef.co/go/tools/cmd/staticcheck",
				currentValue: "v0.6.1",
				datasource: "go",
			},
		]);

		const replacements = new Map([
			["v1.1.4", "v1.7.0"],
			["v0.6.1", "v0.7.0"],
		]);
		const updatedContent = result?.deps.reduce((current, dependency) => {
			if (!dependency.replaceString || !dependency.currentValue) {
				throw new Error("go install dependency was not extracted");
			}

			const nextValue = replacements.get(dependency.currentValue);
			if (!nextValue) {
				throw new Error(`replacement not found for ${dependency.currentValue}`);
			}

			return current.replace(
				dependency.replaceString,
				dependency.replaceString.replace(dependency.currentValue, nextValue),
			);
		}, content);

		expect(updatedContent).toContain(
			"go install golang.org/x/vuln/cmd/govulncheck@v1.7.0",
		);
		expect(updatedContent).toContain(
			"go install honnef.co/go/tools/cmd/staticcheck@v0.7.0",
		);
		expect(extract(updatedContent ?? "")?.deps).toMatchObject([
			{
				depName: "golang.org/x/vuln/cmd/govulncheck",
				currentValue: "v1.7.0",
			},
			{
				depName: "honnef.co/go/tools/cmd/staticcheck",
				currentValue: "v0.7.0",
			},
		]);
	});
});
