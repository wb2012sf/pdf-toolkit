import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mergePdfBytes } from './bytes/merge.js';

/**
 * Merge multiple PDFs into one, in the given order.
 *
 * Pages are appended in the order the input paths are given, not in any
 * order derived from the filesystem. The inputs are only read, never written.
 *
 * This is the filesystem wrapper. The work is in mergePdfBytes, which has no
 * filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function mergePdfs(
  inputPaths: string[],
  outputPath: string
): Promise<void> {
  assert(
    Array.isArray(inputPaths),
    'mergePdfs requires an array of input paths'
  );
  assert(inputPaths.length > 0, 'mergePdfs requires at least one input path');
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'mergePdfs requires a non-empty output path'
  );
  for (const inputPath of inputPaths) {
    assert(
      typeof inputPath === 'string' && inputPath.length > 0,
      'mergePdfs requires every input path to be a non-empty string'
    );
  }

  // Non-destructive by default: writing the merge back onto a source would
  // destroy input the caller still expects to be intact.
  const resolvedOutput = resolve(outputPath);
  for (const inputPath of inputPaths) {
    assert(
      resolve(inputPath) !== resolvedOutput,
      `mergePdfs refuses to overwrite an input file: ${inputPath}`
    );
  }

  const inputs: Uint8Array[] = [];
  for (const inputPath of inputPaths) {
    inputs.push(await readFile(inputPath));
  }

  await writeFile(outputPath, await mergePdfBytes(inputs));
}
