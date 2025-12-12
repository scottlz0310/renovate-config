/**
 * Renovate config generator
 */
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';

const REPO_OWNER = 'scottlz0310';
const REPO_NAME = 'renovate-config';
const PRESETS_PATH = 'presets';

export interface GenerateOptions {
  languages: string[];
  tools: string[];
  options: string[];
}

export interface OutputFile {
  path: string;
  relativePath: string;
  content: string;
  isRoot: boolean;
}

function buildPresetRef(category: string, preset: string): string {
  if (category === 'default') {
    return `github>${REPO_OWNER}/${REPO_NAME}//${PRESETS_PATH}/default`;
  }
  return `github>${REPO_OWNER}/${REPO_NAME}//${PRESETS_PATH}/${category}/${preset}`;
}

function generateRootConfig(options: GenerateOptions): object {
  // Use a Set to avoid duplicate extends while preserving insertion order
  const extendsSet = new Set<string>();
  extendsSet.add(buildPresetRef('default', 'default'));

  for (const lang of options.languages) {
    extendsSet.add(buildPresetRef('languages', lang));
  }

  for (const tool of options.tools) {
    extendsSet.add(buildPresetRef('tools', tool));
  }

  for (const opt of options.options) {
    extendsSet.add(buildPresetRef('options', opt));
  }

  return {
    $schema: 'https://docs.renovatebot.com/renovate-schema.json',
    extends: Array.from(extendsSet),
  };
}

function generatePackageConfig(rootRelativePath: string): object {
  return {
    $schema: 'https://docs.renovatebot.com/renovate-schema.json',
    extends: [rootRelativePath],
  };
}

export function prepareOutputFiles(
  rootPath: string,
  packagePaths: string[],
  options: GenerateOptions
): OutputFile[] {
  const files: OutputFile[] = [];

  // Root config
  const rootConfig = generateRootConfig(options);
  const rootFilePath = join(rootPath, 'renovate.json');
  files.push({
    path: rootFilePath,
    relativePath: './renovate.json',
    content: JSON.stringify(rootConfig, null, 2),
    isRoot: true,
  });

  // Package configs (inherit from root)
  for (const pkgPath of packagePaths) {
    const pkgFilePath = join(rootPath, pkgPath, 'renovate.json');
    const relativeToRoot = relative(join(rootPath, pkgPath), rootPath);
    const pkgConfig = generatePackageConfig(relativeToRoot);

    files.push({
      path: pkgFilePath,
      relativePath: `./${pkgPath}/renovate.json`,
      content: JSON.stringify(pkgConfig, null, 2),
      isRoot: false,
    });
  }

  return files;
}

export async function writeOutputFiles(files: OutputFile[]): Promise<void> {
  for (const file of files) {
    // Ensure the target directory exists
    const dir = dirname(file.path) || '.';
    await mkdir(dir, { recursive: true });
    await writeFile(file.path, file.content + '\n', 'utf-8');
  }
}
