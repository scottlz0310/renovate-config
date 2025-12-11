/**
 * Interactive prompts using @clack/prompts
 */
import * as p from '@clack/prompts';
import {
  ScanResult,
  DetectionResult,
  DETECTION_RULES,
  OPTION_PRESETS,
  getAllDetectedPresets,
} from './detector.js';
import { OutputFile } from './generator.js';

export interface SelectedPresets {
  languages: string[];
  tools: string[];
  options: string[];
}

export function displayScanResult(scanResult: ScanResult): void {
  p.log.info('Detected structure:');

  const rootPresets = scanResult.root.detectedPresets
    .map((d) => d.preset)
    .join(', ');

  if (scanResult.isMonorepo) {
    console.log(`  ./                        (monorepo root)`);
  } else {
    console.log(`  ./                        (project root)`);
  }

  for (const det of scanResult.root.detectedPresets) {
    console.log(`  ├── ${det.matchedFiles[0].padEnd(20)} → ${det.label}`);
  }

  if (scanResult.isMonorepo && scanResult.packages.length > 0) {
    console.log(`  └── packages/             (${scanResult.packages.length} packages detected)`);

    for (let i = 0; i < scanResult.packages.length; i++) {
      const pkg = scanResult.packages[i];
      const prefix = i === scanResult.packages.length - 1 ? '└──' : '├──';
      const presetLabels = pkg.detectedPresets.map((d) => d.label).join(', ');
      console.log(`      ${prefix} ${pkg.relativePath.split('/').pop()}/`.padEnd(24) + (presetLabels ? ` → ${presetLabels}` : ''));
    }
  }

  console.log('');
}

export async function selectPresets(scanResult: ScanResult): Promise<SelectedPresets | symbol> {
  const detectedPresets = getAllDetectedPresets(scanResult);

  // Build options for multiselect
  const languageOptions = DETECTION_RULES
    .filter((r) => r.category === 'languages')
    .map((r) => ({
      value: r.preset,
      label: r.label + (detectedPresets.has(r.preset) ? ' (detected)' : ''),
      hint: detectedPresets.has(r.preset) ? 'recommended' : undefined,
    }));

  const toolOptions = DETECTION_RULES
    .filter((r) => r.category === 'tools')
    .map((r) => ({
      value: r.preset,
      label: r.label + (detectedPresets.has(r.preset) ? ' (detected)' : ''),
      hint: detectedPresets.has(r.preset) ? 'recommended' : undefined,
    }));

  const optionOptions = OPTION_PRESETS.map((o) => ({
    value: o.preset,
    label: o.label,
    hint: o.description,
  }));

  // Languages
  const selectedLanguages = await p.multiselect({
    message: 'Select language presets:',
    options: languageOptions,
    initialValues: Array.from(detectedPresets).filter((p) =>
      DETECTION_RULES.some((r) => r.preset === p && r.category === 'languages')
    ),
    required: false,
  });

  if (p.isCancel(selectedLanguages)) {
    return selectedLanguages;
  }

  // Tools
  const selectedTools = await p.multiselect({
    message: 'Select tool presets:',
    options: toolOptions,
    initialValues: Array.from(detectedPresets).filter((p) =>
      DETECTION_RULES.some((r) => r.preset === p && r.category === 'tools')
    ),
    required: false,
  });

  if (p.isCancel(selectedTools)) {
    return selectedTools;
  }

  // Options
  const selectedOptions = await p.multiselect({
    message: 'Select additional options:',
    options: optionOptions,
    initialValues: [],
    required: false,
  });

  if (p.isCancel(selectedOptions)) {
    return selectedOptions;
  }

  return {
    languages: selectedLanguages as string[],
    tools: selectedTools as string[],
    options: selectedOptions as string[],
  };
}

export async function confirmOutputLocations(files: OutputFile[]): Promise<boolean | symbol> {
  p.log.info('Output locations:');

  for (const file of files) {
    const suffix = file.isRoot ? '(root)' : '(inherit root)';
    console.log(`  ☑ ${file.relativePath.padEnd(40)} ${suffix}`);
  }

  console.log('');

  const confirmed = await p.confirm({
    message: 'Apply?',
    initialValue: true,
  });

  return confirmed;
}

export function displayResults(files: OutputFile[]): void {
  for (const file of files) {
    p.log.success(`Created ${file.relativePath}`);
  }

  p.log.info(`Done! ${files.length} file${files.length > 1 ? 's' : ''} created.`);
}
