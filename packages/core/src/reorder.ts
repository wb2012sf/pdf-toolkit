import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { reorderPagesBytes } from './bytes/reorder.js';

/**
 * Rearrange a PDF's pages into the given order, writing a new file.
 *
 * `order` is the new sequence of 1-based source page numbers and must be a
 * complete permutation: every page exactly once, nothing repeated or omitted.
 * Use extract to select a subset. The input is only read.
 *
 * This is the filesystem wrapper. The work is in reorderPagesBytes, which has
 * no filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function reorderPages(
  inputPath: string,
  order: number[],
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'reorderPages requires a non-empty input path'
  );
  assert(
    Array.isArray(order) && order.length > 0,
    'reorderPages requires at least one page number'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'reorderPages requires a non-empty output path'
  );

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `reorderPages refuses to overwrite an input file: ${inputPath}`
  );

  const result = await reorderPagesBytes(await readFile(inputPath), order);
  await writeFile(outputPath, result);
}
