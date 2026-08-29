import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type ProtectOptions, protectPdfBytes } from './bytes/protect.js';

export type {
  EncryptionAlgorithm,
  PdfPermissions,
  ProtectOptions,
} from './bytes/protect.js';

/**
 * Encrypt a PDF with a password, writing the protected copy to a new file.
 *
 * The input is only read. Refusing to write over it matters more here than
 * anywhere else in this package: the output cannot be opened without the
 * password, so overwriting the source would be unrecoverable if the password
 * were mistyped.
 *
 * This is the filesystem wrapper. The work is in protectPdfBytes, which has no
 * filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function protectPdf(
  inputPath: string,
  options: ProtectOptions,
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'protectPdf requires a non-empty input path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'protectPdf requires a non-empty output path'
  );
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `protectPdf refuses to overwrite an input file: ${inputPath}`
  );

  const result = await protectPdfBytes(await readFile(inputPath), options);
  await writeFile(outputPath, result);
}
