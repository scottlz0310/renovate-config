/**
 * Project type detector
 */
import { dirname, join } from "node:path";
let fastGlobFn;
async function getFastGlob() {
    if (!fastGlobFn) {
        const mod = await import("fast-glob");
        // biome-ignore lint/suspicious/noExplicitAny: fast-glob import hack
        fastGlobFn = mod.default;
    }
    return fastGlobFn;
}
const DETECTION_RULES = [
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
        preset: "biome",
        category: "tools",
        label: "Biome",
        patterns: ["biome.json", "biome.jsonc"],
    },
    {
        preset: "precommit",
        category: "tools",
        label: "Pre-commit",
        patterns: [".pre-commit-config.yaml"],
    },
    {
        preset: "lefthook",
        category: "tools",
        label: "Lefthook",
        patterns: [
            ".lefthook.yml",
            ".lefthook.yaml",
            "lefthook.yml",
            "lefthook.yaml",
        ],
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
async function detectPresetsInDir(cwd) {
    const results = [];
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
async function findMonorepoPackages(cwd) {
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
export async function scanProject(cwd) {
    const rootPresets = await detectPresetsInDir(cwd);
    const packageDirs = await findMonorepoPackages(cwd);
    const isMonorepo = packageDirs.length > 0;
    const packages = [];
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
export function getAllDetectedPresets(scanResult) {
    const presets = new Set();
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
//# sourceMappingURL=detector.js.map