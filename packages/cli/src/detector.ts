/**
 * Project type detector
 */
import { dirname, join } from "node:path";

interface DetectionRule {
	preset: string;
	category: "languages" | "tools";
	label: string;
	patterns: string[];
}

interface DetectionResult {
	preset: string;
	category: "languages" | "tools";
	label: string;
	matchedFiles: string[];
}

interface PackageLocation {
	path: string;
	relativePath: string;
	detectedPresets: DetectionResult[];
}

export interface ScanResult {
	root: PackageLocation;
	packages: PackageLocation[];
	isMonorepo: boolean;
}

type FastGlobFn = (
	patterns: string | readonly string[],
	// biome-ignore lint/suspicious/noExplicitAny: fast-glob options
	options?: any,
) => Promise<string[]>;
let fastGlobFn: FastGlobFn | undefined;

async function getFastGlob(): Promise<FastGlobFn> {
	if (!fastGlobFn) {
		const mod = await import("fast-glob");
		// biome-ignore lint/suspicious/noExplicitAny: fast-glob import hack
		fastGlobFn = (mod as any).default as FastGlobFn;
	}
	return fastGlobFn;
}

const DETECTION_RULES: DetectionRule[] = [
	// Languages
	{
		preset: "nodejs",
		category: "languages",
		label: "Node.js",
		patterns: ["package.json"],
	},
	{
		preset: "typescript",
		category: "languages",
		label: "TypeScript",
		patterns: ["tsconfig.json"],
	},
	{
		preset: "python",
		category: "languages",
		label: "Python",
		patterns: ["pyproject.toml", "uv.lock"],
	},
	{
		preset: "docker",
		category: "languages",
		label: "Docker",
		patterns: [
			"Dockerfile",
			"docker-compose.yml",
			"docker-compose.yaml",
			"compose.yml",
			"compose.yaml",
		],
	},
	{
		preset: "go",
		category: "languages",
		label: "Go",
		patterns: ["go.mod"],
	},
	{
		preset: "rust",
		category: "languages",
		label: "Rust",
		patterns: ["Cargo.toml"],
	},
	{
		preset: "csharp",
		category: "languages",
		label: "C#",
		patterns: ["*.csproj", "*.sln"],
	},
	{
		preset: "cpp",
		category: "languages",
		label: "C++",
		patterns: ["CMakeLists.txt", "conanfile.txt", "vcpkg.json"],
	},
	// Tools
	{
		preset: "precommit",
		category: "tools",
		label: "Pre-commit",
		patterns: [".pre-commit-config.yaml"],
	},
];

export const OPTION_PRESETS = [
	{
		preset: "automerge",
		label: "Auto-merge",
		description: "Auto-merge minor/patch updates",
	},
	{
		preset: "schedule",
		label: "Schedule",
		description: "Scheduled updates (Mon 3am JST)",
	},
	{
		preset: "security",
		label: "Security",
		description: "Prioritize security updates",
	},
	{
		preset: "production",
		label: "Production",
		description: "Conservative settings",
	},
	{
		preset: "monorepo",
		label: "Monorepo",
		description: "Monorepo-specific settings",
	},
];

async function detectPresetsInDir(cwd: string): Promise<DetectionResult[]> {
	const results: DetectionResult[] = [];
	const fg = await getFastGlob();

	for (const rule of DETECTION_RULES) {
		const matches = await fg(rule.patterns, {
			cwd,
			onlyFiles: true,
			deep: 1,
		});

		if (matches.length > 0) {
			results.push({
				preset: rule.preset,
				category: rule.category,
				label: rule.label,
				matchedFiles: matches,
			});
		}
	}

	return results;
}

async function findMonorepoPackages(cwd: string): Promise<string[]> {
	const fg = await getFastGlob();
	// Check common monorepo patterns
	const patterns = [
		"packages/*/package.json",
		"apps/*/package.json",
		"libs/*/package.json",
		"services/*/package.json",
	];

	const matches = await fg(patterns, {
		cwd,
		onlyFiles: true,
	});

	return matches.map((m) => dirname(m));
}

export async function scanProject(cwd: string): Promise<ScanResult> {
	const rootPresets = await detectPresetsInDir(cwd);
	const packageDirs = await findMonorepoPackages(cwd);
	const isMonorepo = packageDirs.length > 0;

	const packages: PackageLocation[] = [];

	for (const packageDir of packageDirs) {
		const fullPath = join(cwd, packageDir);
		const presets = await detectPresetsInDir(fullPath);

		packages.push({
			path: fullPath,
			relativePath: packageDir,
			detectedPresets: presets,
		});
	}

	return {
		root: {
			path: cwd,
			relativePath: ".",
			detectedPresets: rootPresets,
		},
		packages,
		isMonorepo,
	};
}

export function getAllDetectedPresets(scanResult: ScanResult): Set<string> {
	const presets = new Set<string>();

	for (const result of scanResult.root.detectedPresets) {
		presets.add(result.preset);
	}

	for (const pkg of scanResult.packages) {
		for (const result of pkg.detectedPresets) {
			presets.add(result.preset);
		}
	}

	return presets;
}

export { DETECTION_RULES };
