import { describe, expect, it } from 'vitest';
import { prepareOutputFiles } from '../src/generator';

describe('generator.generateConfig', () => {
  it('generates extends with repo path and presets', () => {
    const files = prepareOutputFiles('.', [], {
      languages: ['nodejs'],
      tools: [],
      options: ['automerge'],
    });
    const root = files.find((f) => f.isRoot);
    const config = JSON.parse(root!.content);

    expect((config as any).extends).toContain('github>scottlz0310/renovate-config//presets/default');
    expect((config as any).extends).toContain('github>scottlz0310/renovate-config//presets/languages/nodejs');
    expect((config as any).extends).toContain('github>scottlz0310/renovate-config//presets/options/automerge');
  });
});
