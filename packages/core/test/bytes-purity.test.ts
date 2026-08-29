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

  it('reaches LibPDF only through libpdf(), so it stays a lazy chunk', async () => {
    // LibPDF is about twice the size of everything else here put together.
    // One static import of it anywhere in this directory puts it back in the
    // browser bundle's entry chunk, and a page that only merges two documents
    // pays for encryption, forms and signing again. Nothing else would fail:
    // the tests pass either way and only the built bundle grows, which is why
    // this is checked here rather than left to notice later.
    const files = (await readdir(BYTES_DIR)).filter(
      (name) => name.endsWith('.ts') && name !== 'libpdf.ts'
    );

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(join(BYTES_DIR, file), 'utf8');
      for (const match of source.matchAll(
        /^import\s+(?!type\b)[^;]*?from '(@libpdf\/[^']+)'/gm
      )) {
        offenders.push(`${file} statically imports ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
