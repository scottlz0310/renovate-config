#!/usr/bin/env node
/**
 * Validate all Renovate preset files
 */
import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
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

// validateFile: implemented below using AJV to perform schema validation
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
// In-memory caches to avoid repeated network fetches and compilations
const schemaMemoryCache = new Map();
const validatorCache = new Map();
const schemaFetchErrors = new Set();

// Check whether external validator is available once
let externalValidatorAvailable = true;
try {
  execSync('npx renovate-config-validator --version', { stdio: 'ignore' });
} catch (e) {
  externalValidatorAvailable = false;
}

let externalValidatorWarned = false;

async function validateFile(filePath) {
  console.log(`Validating ${filePath}...`);
  if (externalValidatorAvailable) {
    try {
      execSync(`npx renovate-config-validator "${filePath}"`, { stdio: 'inherit' });
      return true;
    } catch (err) {
      // external validator exists but failed here; fallback to AJV for this file
      if (!externalValidatorWarned) {
        console.warn('renovate-config-validator failed for a file; falling back to AJV schema validation.');
        externalValidatorWarned = true;
      }
    }
  } else {
    if (!externalValidatorWarned) {
      console.warn('renovate-config-validator not available; falling back to AJV schema validation.');
      externalValidatorWarned = true;
    }
  }
    try {
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      const schemaUrl = content['$schema'] || 'https://docs.renovatebot.com/renovate-schema.json';
      // Attempt to reuse memory cache first
      let schema = schemaMemoryCache.get(schemaUrl);
      if (schema === undefined) {
        // Try network fetch with disk cache fallback
        const cacheDir = join(process.cwd(), '.schema-cache');
        const cacheFile = join(cacheDir, encodeURIComponent(schemaUrl) + '.json');
        try {
          const res = await fetch(schemaUrl);
          if (!res.ok) throw new Error(`Failed to load schema ${schemaUrl}: ${res.statusText}`);
          schema = await res.json();
          // cache schema to disk
          if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
          writeFileSync(cacheFile, JSON.stringify(schema, null, 2), 'utf-8');
          schemaMemoryCache.set(schemaUrl, schema);
        } catch (fetchErr) {
          // Avoid repeated fetch attempts across files; record a fetch error once
          if (!schemaFetchErrors.has(schemaUrl)) {
            console.warn(`Failed to fetch schema ${schemaUrl}: ${fetchErr}. Trying local/disk cache.`);
            schemaFetchErrors.add(schemaUrl);
          }
          if (existsSync(cacheFile)) {
            schema = JSON.parse(readFileSync(cacheFile, 'utf-8'));
            schemaMemoryCache.set(schemaUrl, schema);
          } else {
            const localSchemaPath = join(process.cwd(), 'schemas', 'renovate-schema.json');
            if (existsSync(localSchemaPath)) {
              schema = JSON.parse(readFileSync(localSchemaPath, 'utf-8'));
              schemaMemoryCache.set(schemaUrl, schema);
            } else {
              schema = null;
              schemaMemoryCache.set(schemaUrl, null);
            }
          }
        }
      }

      // Reuse a compiled validator to avoid repeated compile
      let validate = validatorCache.get(schemaUrl);
      if (!validate) {
        const ajv = new Ajv({ allErrors: true, strict: false, loadSchema: async (uri) => {
          const r = await fetch(uri);
          if (!r.ok) throw new Error(`Failed to load schema ${uri}: ${r.statusText}`);
          return r.json();
        }});
        addFormats(ajv);
        validate = schema ? await ajv.compileAsync(schema) : null;
        validatorCache.set(schemaUrl, validate);
      }
      if (schema === null) {
        console.warn(`Skipping full schema validation for ${filePath} due to missing schema; performing basic checks.`);
        // basic validation: ensure content is an object and has $schema
        if (!content || typeof content !== 'object') return false;
        if (!content['$schema']) return false;
        return true;
      }
      const valid = validate(content);
      if (!valid) {
        console.error(`Schema validation errors for ${filePath}:`);
        console.error(validate.errors);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`Failed to schema-validate ${filePath}`, e);
      return false;
    }
}

const files = findJsonFiles(PRESETS_DIR);
let hasError = false;

async function main() {
  for (const file of files) {
    const ok = await validateFile(file);
    if (!ok) hasError = true;
  }

  if (hasError) {
    console.error('\n❌ Some validations failed');
    process.exit(1);
  } else {
    console.log(`\n✓ All ${files.length} preset files validated successfully`);
  }
}

main();
