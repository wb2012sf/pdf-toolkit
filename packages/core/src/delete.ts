import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deletePagesBytes } from './bytes/delete.js';

/**
 * Delete the given 1-based pages from a PDF, writing what remains to a new
 * file. Page numbers may be given in any order, and repeats are ignored.
 * Surviving pages keep their original relative order. The input is only read.
 *
 * This is the filesystem wrapper. The work is in deletePagesBytes, which has
 * no filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function deletePages(
  inputPath: string,
  pageNumbers: number[],
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'deletePages requires a non-empty input path'
  );
  assert(
    Array.isArray(pageNumbers) && pageNumbers.length > 0,
    'deletePages requires at least one page number'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'deletePages requires a non-empty output path'
  );

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `deletePages refuses to overwrite an input file: ${inputPath}`
  );

  const result = await deletePagesBytes(await readFile(inputPath), pageNumbers);
  await writeFile(outputPath, result);
}
