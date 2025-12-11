#!/usr/bin/env node
/**
 * Renovate Config Init CLI
 */
import * as p from '@clack/prompts';
import { scanProject, getAllDetectedPresets, DETECTION_RULES } from './detector.js';
import { prepareOutputFiles, writeOutputFiles, GenerateOptions } from './generator.js';
import {
  displayScanResult,
  selectPresets,
  confirmOutputLocations,
  displayResults,
} from './prompts.js';

function parseArgs(): { yes: boolean; dryRun: boolean; help: boolean } {
  const args = process.argv.slice(2);
  return {
    yes: args.includes('--yes') || args.includes('-y'),
    dryRun: args.includes('--dry-run'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function showHelp(): void {
  console.log(`
renovate-config-init - Initialize Renovate configuration with auto-detection

Usage:
  renovate-config-init [options]

Options:
  -y, --yes      Accept detected presets without prompting
  --dry-run      Show what would be created without writing files
  -h, --help     Show this help message
`);
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  p.intro('Renovate Config Initializer');

  // Scan project
  const spinner = p.spinner();
  spinner.start('Scanning project structure...');

  const scanResult = await scanProject(cwd);

  spinner.stop('Scan complete');

  // Display scan result
  displayScanResult(scanResult);

  let selected: GenerateOptions;

  if (args.yes) {
    // Auto-select detected presets
    const detectedPresets = getAllDetectedPresets(scanResult);
    selected = {
      languages: Array.from(detectedPresets).filter((preset) =>
        DETECTION_RULES.some((r) => r.preset === preset && r.category === 'languages')
      ),
      tools: Array.from(detectedPresets).filter((preset) =>
        DETECTION_RULES.some((r) => r.preset === preset && r.category === 'tools')
      ),
      options: [],
    };
    p.log.info(`Auto-selected: ${[...selected.languages, ...selected.tools].join(', ') || 'none'}`);
  } else {
    // Interactive selection
    const result = await selectPresets(scanResult);

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
    selected = result;
  }

  // Prepare output files
  const packagePaths = scanResult.packages.map((pkg) => pkg.relativePath);
  const files = prepareOutputFiles(cwd, packagePaths, selected);

  if (args.dryRun) {
    p.log.info('Dry run - would create:');
    for (const file of files) {
      console.log(`  ${file.relativePath}`);
      console.log(file.content);
      console.log('');
    }
    p.outro('Dry run complete.');
    process.exit(0);
  }

  // Confirm output locations (skip if --yes)
  if (!args.yes) {
    const confirmed = await confirmOutputLocations(files);

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  // Write files
  await writeOutputFiles(files);

  // Display results
  displayResults(files);

  p.outro('Happy renovating!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
