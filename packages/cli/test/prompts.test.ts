import { describe, expect, it, vi } from 'vitest';

// We'll mock @clack/prompts to capture calls
vi.mock('@clack/prompts', async () => {
  return {
    multiselect: vi.fn(),
    select: vi.fn(),
    confirm: vi.fn(),
    isCancel: (v: any) => false,
    log: { info: vi.fn(), success: vi.fn(), warn: vi.fn() },
  };
});

import * as p from '@clack/prompts';
import { ScanResult } from '../src/detector.js';
import { selectPresets } from '../src/prompts';

describe('prompts.selectPresets', () => {
  it('parses selected items into categories and includes headers in options', async () => {
    // Arrange: stub multiselect to capture the options argument and simulate selection
    const multiselect = p.multiselect as unknown as any;

    let capturedOptions: any[] | undefined;
    // have it return a set of values corresponding to language/tool/option
    (multiselect as any).mockImplementation(async (args: any) => {
      capturedOptions = args.options;
      // select nodejs, precommit, automerge
      return ['languages/nodejs', 'tools/precommit', 'options/automerge'];
    });

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

    // Assert: result shape
    expect(result).toEqual({ languages: ['nodejs'], tools: ['precommit'], options: ['automerge'] });

    // Assert that header items are present and disabled
    expect(Array.isArray(capturedOptions)).toBe(true);
    const header = capturedOptions!.find((o: any) => o.value && o.value.startsWith('__header__'));
    expect(header).toBeTruthy();
    expect(header.disabled).toBe(true);
  });
});
