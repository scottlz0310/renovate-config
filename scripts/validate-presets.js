#!/usr/bin/env node
/**
 * Validate all Renovate preset files
 */
import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const PRESETS_DIR = 'presets';

function findJsonFiles(dir) {
  const files = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findJsonFiles(fullPath));
    } else if (item.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateFile(filePath) {
  console.log(`Validating ${filePath}...`);
  try {
    execSync(`npx renovate-config-validator "${filePath}"`, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

const files = findJsonFiles(PRESETS_DIR);
let hasError = false;

for (const file of files) {
  if (!validateFile(file)) {
    hasError = true;
  }
}

if (hasError) {
  console.error('\n❌ Some validations failed');
  process.exit(1);
} else {
  console.log(`\n✓ All ${files.length} preset files validated successfully`);
}
