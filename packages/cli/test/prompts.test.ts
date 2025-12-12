import { describe, expect, it, vi } from 'vitest';

// We'll mock @clack/prompts to capture calls
vi.mock('@clack/prompts', () => ({
  multiselect: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  isCancel: (_v: any) => false,
  log: { info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

import * as p from '@clack/prompts';
import type { ScanResult } from '../src/detector.js';
import { selectPresets } from '../src/prompts';

describe('prompts.selectPresets', () => {
  it('selects languages, then tools, then options', async () => {
    const multiselect = p.multiselect as unknown as any;

    let languageOptions: any[] | undefined;

    (multiselect as any)
      .mockImplementationOnce(async (args: any) => {
        languageOptions = args.options;
        return ['nodejs'];
      })
      .mockImplementationOnce(async () => ['precommit'])
      .mockImplementationOnce(async () => ['automerge']);

    const mockScanResult: ScanResult = {
      root: {
        path: '.',
        relativePath: '.',
        detectedPresets: [
          { preset: 'nodejs', category: 'languages', label: 'Node.js', matchedFiles: ['package.json'] },
          { preset: 'precommit', category: 'tools', label: 'Pre-commit', matchedFiles: ['.pre-commit-config.yaml'] },
        ],
      },
      packages: [],
      isMonorepo: false,
    };

    const result = await selectPresets(mockScanResult);

    expect(result).toEqual({ languages: ['nodejs'], tools: ['precommit'], options: ['automerge'] });

    expect(Array.isArray(languageOptions)).toBe(true);
    const nodeOption = languageOptions!.find((o: any) => o.value === 'nodejs');
    expect(nodeOption).toBeTruthy();
    expect(nodeOption.hint).toBe('recommended');
  });
});
