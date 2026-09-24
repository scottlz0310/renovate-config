import { readFileSync } from "node:fs";
import { extractPackageFile } from "renovate/dist/modules/manager/custom/regex/index.js";
import { applyPackageRules } from "renovate/dist/util/package-rules/index.js";
import { matchRegexOrGlob } from "renovate/dist/util/string-match.js";
import { describe, expect, it } from "vitest";

interface PackageRule {
	matchDatasources?: string[];
	matchManagers?: string[];
	matchRegistryUrls?: string[];
	matchUpdateTypes?: string[];
	groupName: string;
	semanticCommitScope?: string;
}

interface Preset {
	customManagers: {
		customType: "regex";
		managerFilePatterns: string[];
		matchStrings: string[];
		datasourceTemplate: string;
		registryUrlTemplate: string;
	}[];
	packageRules: PackageRule[];
}

const powershell = JSON.parse(
	readFileSync(
		new URL("../presets/languages/powershell.json", import.meta.url),
		"utf8",
	),
) as Preset;
const csharp = JSON.parse(
	readFileSync(
		new URL("../presets/languages/csharp.json", import.meta.url),
		"utf8",
	),
) as Pick<Preset, "packageRules">;
const manager = powershell.customManagers[0];

if (!manager) throw new Error("PowerShell custom manager not found");

const annotation =
	"# renovate: datasource=nuget registryUrl=https://www.powershellgallery.com/api/v2 depName=Pester";

describe("languages/powershell preset", () => {
	it.each([
		[".github/workflows/powershell-tests.yml", true],
		[".github/workflows/tests.yaml", true],
		["scripts/install.ps1", true],
		["modules/Helpers.psm1", true],
		["module.psd1", true],
		["tests.yml", false],
		[".github/workflows/nested/tests.yml", false],
	])("file pattern for %s matches: %s", (fileName, expected) => {
		expect(
			manager.managerFilePatterns.some((pattern) =>
				matchRegexOrGlob(fileName, pattern),
			),
		).toBe(expected);
	});

	it.each([
		[
			"workflow",
			`      ${annotation}\n      Install-Module Pester -RequiredVersion 5.7.1 -Force`,
		],
		[
			"script",
			`${annotation}\nInstall-Module -Name Pester -RequiredVersion '5.7.1' -Force`,
		],
	])("extracts %s module version", (_name, content) => {
		const result = extractPackageFile(content, "scripts/install.ps1", manager);
		expect(result?.deps).toMatchObject([
			{
				depName: "Pester",
				currentValue: "5.7.1",
				datasource: "nuget",
				registryUrls: ["https://www.powershellgallery.com/api/v2"],
			},
		]);
	});

	it.each(["5", "5.7", "5.7.1", "5.7.1.0"])(
		"extracts the complete version %s",
		(version) => {
			const content = `${annotation}\nInstall-Module Pester -RequiredVersion ${version} -Force`;
			expect(
				extractPackageFile(content, "scripts/install.ps1", manager)?.deps[0],
			).toMatchObject({
				depName: "Pester",
				currentValue: version,
			});
		},
	);

	it.each(["5.7.1", "5.7.1.0"])(
		"updates only the captured version %s",
		(version) => {
			const content = `${annotation}\nInstall-Module Pester -RequiredVersion ${version} -Force`;
			const dependency = extractPackageFile(
				content,
				"scripts/install.ps1",
				manager,
			)?.deps[0];
			if (!dependency?.replaceString || !dependency.currentValue) {
				throw new Error("Pester dependency was not extracted");
			}
			const updated = content.replace(
				dependency.replaceString,
				dependency.replaceString.replace(dependency.currentValue, "6.0.0"),
			);
			expect(updated).toBe(
				`${annotation}\nInstall-Module Pester -RequiredVersion 6.0.0 -Force`,
			);
		},
	);

	it("uses the module name in the command when the annotation is stale", () => {
		const content = `${annotation}\nInstall-Module OtherModule -RequiredVersion 5.7.1 -Force`;
		expect(
			extractPackageFile(content, "scripts/install.ps1", manager)?.deps[0],
		).toMatchObject({
			depName: "OtherModule",
			currentValue: "5.7.1",
		});
	});

	it.each([
		"Install-Module Pester -RequiredVersion 5.7.1 -Force",
		`${annotation}\nInstall-Module Pester -MinimumVersion 5.7.1 -Force`,
		`${annotation}\n# Install-Module Pester -RequiredVersion 5.7.1`,
		`${annotation}\nInstall-Module Pester -RequiredVersion 5.7.1.0.2 -Force`,
	])("ignores command without a matching annotation: %s", (content) => {
		expect(
			extractPackageFile(content, "scripts/install.ps1", manager),
		).toBeNull();
	});

	it.each([
		["major", [powershell, csharp]],
		["minor", [csharp, powershell]],
	])(
		"keeps PowerShell grouping with %s updates regardless of preset order",
		async (updateType, presets) => {
			const result = await applyPackageRules({
				manager: "custom.regex",
				datasource: "nuget",
				depName: "Pester",
				registryUrls: ["https://www.powershellgallery.com/api/v2"],
				updateType,
				packageRules: presets.flatMap((preset) => preset.packageRules),
			});
			expect(result.groupName).toBe("PowerShell modules");
			expect(result.semanticCommitScope).toBe("deps-powershell");
		},
	);

	it("keeps NuGet packages in the C# group", async () => {
		const result = await applyPackageRules({
			manager: "nuget",
			datasource: "nuget",
			depName: "Newtonsoft.Json",
			updateType: "minor",
			packageRules: [...powershell.packageRules, ...csharp.packageRules],
		});
		expect(result.groupName).toBe("C# minor and patch updates");
		expect(result.semanticCommitScope).toBe("deps-csharp");
	});
});
