import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDFs into one, in the given order.
 *
 * Pages are appended in the order the input paths are given, not in any
 * order derived from the filesystem. The inputs are only read, never written.
 */
export async function mergePdfs(
  inputPaths: string[],
  outputPath: string
): Promise<void> {
  assert(Array.isArray(inputPaths), 'mergePdfs requires an array of input paths');
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

  const merged = await PDFDocument.create();
  for (const inputPath of inputPaths) {
    const source = await PDFDocument.load(await readFile(inputPath));
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) {
      merged.addPage(page);
    }
  }

  await writeFile(outputPath, await merged.save());
}
