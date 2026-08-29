import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type SignOptions,
  type SignatureWarning,
  signPdfBytes,
} from './bytes/sign.js';

export type {
  SignOptions,
  SignatureResult,
  SignatureWarning,
} from './bytes/sign.js';

/** Signing options for a file on disk, where the certificate is a path too. */
export interface SignFileOptions extends Omit<SignOptions, 'certificate'> {
  /** Path to the PKCS#12 file holding the key and its certificate. */
  certificatePath: string;
}

/**
 * Sign a PDF with a certificate, writing the signed copy to a new file.
 *
 * Returns whatever the signer wanted to report rather than swallowing it,
 * which is usually nothing. Whether a reader will trust the result is not
 * reported here and cannot be: that is the reader's judgement against its own
 * trust list.
 *
 * This is the filesystem wrapper. The work is in signPdfBytes, which has no
 * filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function signPdf(
  inputPath: string,
  options: SignFileOptions,
  outputPath: string
): Promise<SignatureWarning[]> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'signPdf requires a non-empty input path'
  );
  assert(
    typeof options === 'object' && options !== null,
    'signPdf requires an options object'
  );
  assert(
    typeof options.certificatePath === 'string' &&
      options.certificatePath.length > 0,
    'signPdf requires a non-empty certificate path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'signPdf requires a non-empty output path'
  );
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `signPdf refuses to overwrite an input file: ${inputPath}`
  );

  const { certificatePath, ...rest } = options;
  const result = await signPdfBytes(await readFile(inputPath), {
    ...rest,
    certificate: await readFile(certificatePath),
  });

  await writeFile(outputPath, result.bytes);
  return result.warnings;
}
