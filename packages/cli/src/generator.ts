/**
 * Renovate config generator
 */
import { writeFile } from 'fs/promises';
import { join, relative } from 'path';

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

export function generateRootConfig(options: GenerateOptions): object {
  const extends_: string[] = [
    buildPresetRef('default', 'default'),
  ];

  for (const lang of options.languages) {
    extends_.push(buildPresetRef('languages', lang));
  }

  for (const tool of options.tools) {
    extends_.push(buildPresetRef('tools', tool));
  }

  for (const opt of options.options) {
    extends_.push(buildPresetRef('options', opt));
  }

  return {
    $schema: 'https://docs.renovatebot.com/renovate-schema.json',
    extends: extends_,
  };
}

export function generatePackageConfig(rootRelativePath: string): object {
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
    await writeFile(file.path, file.content + '\n', 'utf-8');
  }
}
