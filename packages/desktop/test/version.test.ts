import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * The version is declared in six files and they have to agree.
 *
 * The release workflow only compares the tag against tauri.conf.json, so
 * without this, Cargo.toml or a package.json could drift and nothing would
 * notice until someone wondered why the crate and the installer disagreed.
 *
 * This lives in the desktop package because that is where the two files that
 * matter most sit, and it is the only suite that already reads outside its
 * own directory. `npm run version:set` is what keeps them in step.
 */

const JSON_FILES = [
  'package.json',
  'packages/core/package.json',
  'packages/cli/package.json',
  'packages/desktop/package.json',
  'packages/desktop/src-tauri/tauri.conf.json',
];

const CARGO = 'packages/desktop/src-tauri/Cargo.toml';
const PROGRAM = 'packages/cli/src/program.ts';

async function jsonVersion(file: string): Promise<string> {
  const parsed = JSON.parse(await readFile(join(REPO, file), 'utf8')) as {
    version?: string;
  };
  expect(parsed.version, `${file} declares no version`).toBeDefined();
  return parsed.version as string;
}

async function cargoVersion(): Promise<string> {
  const text = await readFile(join(REPO, CARGO), 'utf8');
  // Anchored, so an inline dependency version cannot match by accident.
  const match = text.match(/^version = "([^"]+)"/m);
  expect(match, `${CARGO} declares no package version`).not.toBeNull();
  return (match as RegExpMatchArray)[1] as string;
}

async function programVersion(): Promise<string> {
  // What `pdf-toolkit --version` prints. commander is handed a literal, so it
  // is the one declaration no manifest keeps honest.
  const text = await readFile(join(REPO, PROGRAM), 'utf8');
  const match = text.match(/\.version\('([^']+)'\)/);
  expect(match, `${PROGRAM} declares no CLI version`).not.toBeNull();
  return (match as RegExpMatchArray)[1] as string;
}

describe('the declared version', () => {
  it('is the same in every file that declares one', async () => {
    const found: Record<string, string> = {};
    for (const file of JSON_FILES) {
      found[file] = await jsonVersion(file);
    }
    found[CARGO] = await cargoVersion();
    found[PROGRAM] = await programVersion();

    const distinct = [...new Set(Object.values(found))];
    expect(
      distinct,
      `versions disagree: ${JSON.stringify(found, null, 2)}`
    ).toHaveLength(1);
  });

  it('is three numbers, which is what the tag check expects', async () => {
    expect(await jsonVersion('package.json')).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
