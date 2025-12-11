/**
 * Interactive prompts using @clack/prompts
 */
import * as p from '@clack/prompts';
import {
    DETECTION_RULES,
    OPTION_PRESETS,
    ScanResult,
    getAllDetectedPresets
} from './detector.js';
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

  // Build a single combined options list: adds category headers and then items
  const combinedOptions: { value: string; label: string; hint?: string; disabled?: boolean }[] = [];

  function header(label: string, id: string) {
    // prepend emoji to make headers visually distinct
    const emoji = id === 'languages' ? '📚' : id === 'tools' ? '🛠️' : '⚙️';
    return { value: `__header__${id}`, label: `${emoji} ${label}`, disabled: true };
  }

  const languageOptions = DETECTION_RULES.filter((r) => r.category === 'languages').map((r) => ({
    value: `${r.category}/${r.preset}`,
    label: `${r.label}${detectedPresets.has(r.preset) ? ' (detected)' : ''}`,
    hint: detectedPresets.has(r.preset) ? 'recommended' : undefined,
  }));

  const toolOptions = DETECTION_RULES.filter((r) => r.category === 'tools').map((r) => ({
    value: `${r.category}/${r.preset}`,
    label: `${r.label}${detectedPresets.has(r.preset) ? ' (detected)' : ''}`,
    hint: detectedPresets.has(r.preset) ? 'recommended' : undefined,
  }));

  const optionOptions = OPTION_PRESETS.map((o) => ({
    value: `options/${o.preset}`,
    label: o.label,
    hint: o.description,
  }));

  if (languageOptions.length > 0) {
    combinedOptions.push(header('Languages', 'languages'));
    combinedOptions.push(...languageOptions);
  }

  if (toolOptions.length > 0) {
    combinedOptions.push(header('Tools', 'tools'));
    combinedOptions.push(...toolOptions);
  }

  if (optionOptions.length > 0) {
    combinedOptions.push(header('Options', 'options'));
    combinedOptions.push(...optionOptions);
  }

  // Compute initial values based on detected presets
  const initialValues = Array.from(detectedPresets).map((p) => {
    // Determine category
    const rule = DETECTION_RULES.find((r) => r.preset === p);
    if (rule) return `${rule.category}/${p}`;
    const opt = OPTION_PRESETS.find((o) => o.preset === p);
    if (opt) return `options/${p}`;
    return p; // fallback (should not happen)
  });

  p.log.info('Use Space to toggle selection, Enter to confirm');

  // Helper: paged multiselect for long option lists
  async function pagedMultiselect(
    optionsList: { value: string; label: string; hint?: string; disabled?: boolean }[],
    initial: string[],
    pageSize = 12
  ): Promise<string[] | symbol> {
    let pageIndex = 0;
    const pages = [] as { value: string; label: string; hint?: string; disabled?: boolean }[][];

    // Build sections grouped by header (header + following items)
    const sections: { value: string; label: string; hint?: string; disabled?: boolean }[][] = [];
    let currentSection: { value: string; label: string; hint?: string; disabled?: boolean }[] = [];
    for (const opt of optionsList) {
      if (opt.value && opt.value.toString().startsWith('__header__')) {
        if (currentSection.length > 0) sections.push(currentSection);
        currentSection = [opt];
      } else {
        if (currentSection.length === 0) currentSection = [ { value: '__header__unknown', label: '', disabled: true } ];
        currentSection.push(opt);
      }
    }
    if (currentSection.length > 0) sections.push(currentSection);

    // Turn sections into pages while trying not to split a category across pages unless it exceeds pageSize
    let currentPage: { value: string; label: string; hint?: string; disabled?: boolean }[] = [];
    let currentSelectableCount = 0;
    for (const section of sections) {
      const header = section[0];
      const items = section.slice(1);
      let idx = 0;

      while (idx < items.length) {
        const remainingCapacity = pageSize - currentSelectableCount;
        if (remainingCapacity <= 0) {
          // finish current page
          pages.push(currentPage);
          currentPage = [];
          currentSelectableCount = 0;
          continue;
        }

        const chunkSize = Math.min(remainingCapacity, items.length - idx);
        const chunk = items.slice(idx, idx + chunkSize);

        // Add header if starting a new page
        if (currentPage.length === 0) currentPage.push(header);
        currentPage.push(...chunk);
        currentSelectableCount += chunk.length;
        idx += chunkSize;

        if (currentSelectableCount >= pageSize) {
          pages.push(currentPage);
          currentPage = [];
          currentSelectableCount = 0;
        }
      }

      // If the section had no items (only header), then include header on its own page
      if (items.length === 0) {
        if (currentPage.length === 0) currentPage.push(header);
        pages.push(currentPage);
        currentPage = [];
        currentSelectableCount = 0;
      }
    }

    if (currentPage.length > 0) pages.push(currentPage);

    let selections = new Set(initial);

    while (true) {
      const currentPage = pages[pageIndex];
      const pageOptions = currentPage.filter((opt) => !opt.disabled);
      const currentInitial = pageOptions
        .filter((opt) => selections.has(opt.value))
        .map((opt) => opt.value);

      // filter out header items from selection UI by making them `disabled` (if supported)
        // Include header items inline; they are marked as disabled and won't be selectable
        const pageSelected = await p.multiselect({
          message: `Presets (Page ${pageIndex + 1}/${pages.length}) - Space to toggle, Enter to confirm`,
          options: currentPage as any,
          initialValues: currentInitial,
          required: false,
        });

      // (no-op) the prompt above includes headers; keep pageOptions for initial values & merging

      if (p.isCancel(pageSelected)) return pageSelected;

      // Merge selections for this page
      for (const opt of pageOptions) {
        if ((pageSelected as string[]).includes(opt.value)) selections.add(opt.value);
        else selections.delete(opt.value);
      }

      // If single page, just return
      if (pages.length === 1) return Array.from(selections);

      // Navigation: Next / Previous / Done / Cancel
      const nav = await p.select({
        message: 'Navigation',
        options: [
          { value: 'next', label: 'Next page' },
          { value: 'prev', label: 'Previous page' },
          { value: 'done', label: 'Done (finish selection)' },
        ],
      });

      if (p.isCancel(nav)) return nav;
      if (nav === 'done') return Array.from(selections);
      if (nav === 'next') pageIndex = Math.min(pageIndex + 1, pages.length - 1);
      if (nav === 'prev') pageIndex = Math.max(pageIndex - 1, 0);
    }
  }

  let selected: string[] | symbol;

  if (combinedOptions.length > 12) {
    selected = await pagedMultiselect(combinedOptions, initialValues, 12);
  } else {
    // For the single page case, print header labels and filter out header entries when calling the prompt
        // For single page, include header items inline but ensure initial values don't include headers
        const singlePageOptions = combinedOptions as any;
        const singleInitial = initialValues.filter((v) => !v.startsWith('__header__'));
        selected = await p.multiselect({
          message: 'Select presets (Languages / Tools / Options):',
          options: singlePageOptions,
          initialValues: singleInitial,
          required: false,
        });
  }

  if (p.isCancel(selected)) return selected;

  // Parse selected values into categories
  const languages: string[] = [];
  const tools: string[] = [];
  const options: string[] = [];

  for (const sel of selected as string[]) {
    const parts = sel.split('/');
    // ignore headers
    if (sel.startsWith('__header__')) continue;
    if (parts.length !== 2) continue;
    const [category, preset] = parts;
    if (category === 'languages') languages.push(preset);
    else if (category === 'tools') tools.push(preset);
    else if (category === 'options') options.push(preset);
  }

  return {
    languages,
    tools,
    options,
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
