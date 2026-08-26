import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { rotatePagesBytes } from './bytes/rotate.js';

/**
 * Rotate pages of a PDF by a multiple of 90 degrees, writing a new file.
 *
 * The rotation is relative: it is added to whatever rotation a page already
 * carries, then normalized into [0, 360). `pageNumbers` selects 1-based pages
 * to turn, and repeats are ignored; omit it to rotate the whole document.
 * The input is only read.
 *
 * This is the filesystem wrapper. The work is in rotatePagesBytes, which has
 * no filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function rotatePages(
  inputPath: string,
  degreesDelta: number,
  outputPath: string,
  pageNumbers?: number[]
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'rotatePages requires a non-empty input path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'rotatePages requires a non-empty output path'
  );

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `rotatePages refuses to overwrite an input file: ${inputPath}`
  );

  const result = await rotatePagesBytes(
    await readFile(inputPath),
    degreesDelta,
    pageNumbers
  );
  await writeFile(outputPath, result);
}
