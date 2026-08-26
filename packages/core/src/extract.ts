import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractPagesBytes } from './bytes/extract.js';

/**
 * Extract the given 1-based pages into a new PDF.
 *
 * Pages appear in the order they are listed, so extract doubles as a "take
 * these pages, in this sequence" operation. A page listed more than once is
 * copied more than once. The input is only read.
 *
 * This is the filesystem wrapper. The work is in extractPagesBytes, which has
 * no filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function extractPages(
  inputPath: string,
  pageNumbers: number[],
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'extractPages requires a non-empty input path'
  );
  assert(
    Array.isArray(pageNumbers) && pageNumbers.length > 0,
    'extractPages requires at least one page number'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'extractPages requires a non-empty output path'
  );

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `extractPages refuses to overwrite an input file: ${inputPath}`
  );

  const result = await extractPagesBytes(
    await readFile(inputPath),
    pageNumbers
  );
  await writeFile(outputPath, result);
}
