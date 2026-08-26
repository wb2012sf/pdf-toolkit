import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { insertPagesBytes } from './bytes/insert.js';

/**
 * Insert every page of one PDF into another at a 1-based position.
 *
 * `atPage` is the page number the first inserted page takes in the result, so
 * 1 prepends and one past the last page appends. Both inputs are only read.
 *
 * This is the filesystem wrapper. The work is in insertPagesBytes, which has
 * no filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function insertPages(
  basePath: string,
  insertPath: string,
  atPage: number,
  outputPath: string
): Promise<void> {
  assert(
    typeof basePath === 'string' && basePath.length > 0,
    'insertPages requires a non-empty base path'
  );
  assert(
    typeof insertPath === 'string' && insertPath.length > 0,
    'insertPages requires a non-empty insert path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'insertPages requires a non-empty output path'
  );

  // Non-destructive by default: neither source may be the destination.
  const resolvedOutput = resolve(outputPath);
  for (const inputPath of [basePath, insertPath]) {
    assert(
      resolve(inputPath) !== resolvedOutput,
      `insertPages refuses to overwrite an input file: ${inputPath}`
    );
  }

  const result = await insertPagesBytes(
    await readFile(basePath),
    await readFile(insertPath),
    atPage
  );
  await writeFile(outputPath, result);
}
