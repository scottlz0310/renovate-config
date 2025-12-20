#!/usr/bin/env node
import { extname, isAbsolute, join } from "node:path";
/**
 * Renovate Config Init CLI
 */
import * as p from "@clack/prompts";
import { DETECTION_RULES, getAllDetectedPresets, OPTION_PRESETS, scanProject, } from "./detector.js";
import { prepareOutputFiles, writeOutputFiles, } from "./generator.js";
import { confirmOutputLocations, displayResults, displayScanResult, selectPresets, } from "./prompts.js";
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        yes: args.includes("--yes") || args.includes("-y"),
        dryRun: args.includes("--dry-run"),
        help: args.includes("--help") || args.includes("-h"),
    };
    // Support --presets=comma,separated or --presets <value>
    const presetsArg = args.find((a) => a.startsWith("--presets="));
    if (presetsArg) {
        result.presets = presetsArg.split("=")[1] || "";
    }
    else {
        const idx = args.indexOf("--presets");
        if (idx !== -1 && args.length > idx + 1)
            result.presets = args[idx + 1];
    }
    // Support --output=path or --output <path>
    const outputArg = args.find((a) => a.startsWith("--output="));
    if (outputArg) {
        result.output = outputArg.split("=")[1] || "";
    }
    else {
        const idx2 = args.indexOf("--output");
        if (idx2 !== -1 && args.length > idx2 + 1)
            result.output = args[idx2 + 1];
    }
    return result;
}
function showHelp() {
    console.log(`
renovate-config-init - Initialize Renovate configuration with auto-detection

Usage:
  renovate-config-init [options]

Options:
  -y, --yes      Accept detected presets without prompting
  --dry-run      Show what would be created without writing files
  --presets      Comma-separated list of presets to apply (e.g. nodejs,typescript)
                 (invalid presets cause an error in non-interactive mode)
  --output       Output path for root renovate.json (file or directory)
  -h, --help     Show this help message
`);
}
async function main() {
    const cwd = process.cwd();
    const args = parseArgs();
    if (args.help) {
        showHelp();
        process.exit(0);
    }
    p.intro("Renovate Config Initializer");
    // Scan project
    const spinner = p.spinner();
    spinner.start("Scanning project structure...");
    const scanResult = await scanProject(cwd);
    spinner.stop("Scan complete");
    // Display scan result
    displayScanResult(scanResult);
    let selected;
    // If presets passed via CLI, parse and apply
    if (args.presets) {
        const list = args.presets
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const langs = [];
        const tools = [];
        const opts = [];
        const unknown = [];
        for (const pstr of list) {
            // Accept both forms: 'nodejs' or 'languages/nodejs'
            const parts = pstr.split("/");
            const presetName = parts.length > 1 ? parts[1] : parts[0];
            const categoryHint = parts.length > 1 ? parts[0] : undefined;
            if (categoryHint === "languages" ||
                DETECTION_RULES.some((r) => r.preset === presetName && r.category === "languages")) {
                langs.push(presetName);
                continue;
            }
            if (categoryHint === "tools" ||
                DETECTION_RULES.some((r) => r.preset === presetName && r.category === "tools")) {
                tools.push(presetName);
                continue;
            }
            if (OPTION_PRESETS.some((o) => o.preset === presetName)) {
                opts.push(presetName);
                continue;
            }
            unknown.push(pstr);
        }
        if (unknown.length > 0) {
            // In non-interactive mode, treat unknown presets as an error to be strict
            p.log.warn(`Unknown presets ignored: ${unknown.join(", ")}`);
            if (args.presets) {
                p.log.error(`Unknown presets specified: ${unknown.join(", ")}`);
                process.exit(1);
            }
        }
        selected = {
            languages: Array.from(new Set(langs)),
            tools: Array.from(new Set(tools)),
            options: Array.from(new Set(opts)),
        };
    }
    else if (args.yes) {
        // Auto-select detected presets
        const detectedPresets = getAllDetectedPresets(scanResult);
        selected = {
            languages: Array.from(detectedPresets).filter((preset) => DETECTION_RULES.some((r) => r.preset === preset && r.category === "languages")),
            tools: Array.from(detectedPresets).filter((preset) => DETECTION_RULES.some((r) => r.preset === preset && r.category === "tools")),
            options: [],
        };
        p.log.info(`Auto-selected: ${[...selected.languages, ...selected.tools].join(", ") || "none"}`);
    }
    else {
        // Interactive selection
        const result = await selectPresets(scanResult);
        if (p.isCancel(result)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }
        selected = result;
    }
    // Prepare output files
    const packagePaths = scanResult.packages.map((pkg) => pkg.relativePath);
    const files = prepareOutputFiles(cwd, packagePaths, selected);
    // If user specified an output path, override root file location
    if (args.output) {
        const outputRaw = args.output;
        // Determine if this is a filename or directory
        const isJsonFile = extname(outputRaw) === ".json";
        const fullPath = isAbsolute(outputRaw) ? outputRaw : join(cwd, outputRaw);
        const rootFile = files.find((f) => f.isRoot);
        if (rootFile) {
            if (isJsonFile) {
                rootFile.path = fullPath;
                // set relativePath for display
                const rel = outputRaw.startsWith(".") ? outputRaw : `./${outputRaw}`;
                rootFile.relativePath = rel;
            }
            else {
                // directory specified
                const newPath = join(fullPath, "renovate.json");
                rootFile.path = newPath;
                const relDir = outputRaw.startsWith(".") ? outputRaw : `./${outputRaw}`;
                rootFile.relativePath = `${relDir}/renovate.json`;
            }
        }
    }
    if (args.dryRun) {
        p.log.info("Dry run - would create:");
        for (const file of files) {
            console.log(`  ${file.relativePath}`);
            console.log(file.content);
            console.log("");
        }
        p.outro("Dry run complete.");
        process.exit(0);
    }
    // Confirm output locations (skip if --yes)
    if (!args.yes) {
        const confirmed = await confirmOutputLocations(files);
        if (p.isCancel(confirmed) || !confirmed) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }
    }
    // Write files
    await writeOutputFiles(files);
    // Display results
    displayResults(files);
    p.outro("Happy renovating!");
}
main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map