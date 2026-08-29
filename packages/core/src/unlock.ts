import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unlockPdfBytes } from './bytes/unlock.js';

/**
 * Remove password protection from a PDF, writing the result to a new file.
 *
 * The password must be one that opens the document; a wrong one fails rather
 * than producing a file that cannot be read back. The input is only read.
 *
 * This is the filesystem wrapper. The work is in unlockPdfBytes, which has no
 * filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function unlockPdf(
  inputPath: string,
  password: string,
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'unlockPdf requires a non-empty input path'
  );
  assert(
    typeof password === 'string',
    'unlockPdf requires the password as a string'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'unlockPdf requires a non-empty output path'
  );
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `unlockPdf refuses to overwrite an input file: ${inputPath}`
  );

  const result = await unlockPdfBytes(await readFile(inputPath), password);
  await writeFile(outputPath, result);
}
