import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const BYTES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'bytes'
);

/**
 * The bytes layer exists so the web and desktop front ends can run the
 * operations in a browser or a Tauri webview. A bundler externalizes `node:`
 * imports for the browser, so a single one of them breaks the page at
 * runtime, and nothing else in the suite would notice: every other test runs
 * under Node, where those imports work fine.
 */
describe('the bytes layer stays free of Node builtins', () => {
  it('imports no node: module anywhere', async () => {
    const files = (await readdir(BYTES_DIR)).filter((name) =>
      name.endsWith('.ts')
    );
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(join(BYTES_DIR, file), 'utf8');
      for (const match of source.matchAll(/from '(node:[^']+)'/g)) {
        offenders.push(`${file} imports ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('imports nothing from the filesystem wrappers either', async () => {
    // A wrapper pulls in node:fs transitively, which is just as fatal.
    const files = (await readdir(BYTES_DIR)).filter((name) =>
      name.endsWith('.ts')
    );

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(join(BYTES_DIR, file), 'utf8');
      for (const match of source.matchAll(/from '(\.\.\/[^']+)'/g)) {
        offenders.push(`${file} imports ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
