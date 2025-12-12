/**
 * Interactive prompts using @clack/prompts
 */
import * as p from '@clack/prompts';
import { DETECTION_RULES, OPTION_PRESETS, getAllDetectedPresets } from './detector.js';
import type { ScanResult } from './detector.js';
import { OutputFile } from './generator.js';

interface SelectedPresets {
  languages: string[];
  tools: string[];
  options: string[];
}

export function displayScanResult(scanResult: ScanResult): void {
  p.log.info('Detected structure:');

  // const rootPresets = scanResult.root.detectedPresets.map((d) => d.preset).join(', ');

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

  p.log.info('Use Space to toggle selection, Enter to confirm');

  const languageOptions = DETECTION_RULES.filter((r) => r.category === 'languages').map((r) => ({
    value: r.preset,
    label: `${r.label}${detectedPresets.has(r.preset) ? ' (detected)' : ''}`,
    hint: detectedPresets.has(r.preset) ? 'recommended' : undefined,
  }));

  const toolOptions = DETECTION_RULES.filter((r) => r.category === 'tools').map((r) => ({
    value: r.preset,
    label: `${r.label}${detectedPresets.has(r.preset) ? ' (detected)' : ''}`,
    hint: detectedPresets.has(r.preset) ? 'recommended' : undefined,
  }));

  const optionOptions = OPTION_PRESETS.map((o) => ({
    value: o.preset,
    label: o.label,
    hint: o.description,
  }));

  const selectedLanguages = await p.multiselect({
    message: 'Select Languages:',
    options: languageOptions as any,
    initialValues: languageOptions.filter((o) => detectedPresets.has(o.value)).map((o) => o.value),
    required: false,
  });
  if (p.isCancel(selectedLanguages)) return selectedLanguages;

  const selectedTools = await p.multiselect({
    message: 'Select Tools:',
    options: toolOptions as any,
    initialValues: toolOptions.filter((o) => detectedPresets.has(o.value)).map((o) => o.value),
    required: false,
  });
  if (p.isCancel(selectedTools)) return selectedTools;

  const selectedOptions = await p.multiselect({
    message: 'Select Options:',
    options: optionOptions as any,
    initialValues: [],
    required: false,
  });
  if (p.isCancel(selectedOptions)) return selectedOptions;

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
