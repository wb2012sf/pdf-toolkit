import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

/**
 * Delete the given 1-based pages from a PDF, writing what remains to a new
 * file. Page numbers may be given in any order, and repeats are ignored.
 * Surviving pages keep their original relative order. The input is only read.
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

  for (const pageNumber of pageNumbers) {
    assert(
      Number.isInteger(pageNumber) && pageNumber >= 1,
      `deletePages needs every page to be a 1-based whole number, got ${pageNumber}`
    );
  }

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `deletePages refuses to overwrite an input file: ${inputPath}`
  );

  const source = await PDFDocument.load(await readFile(inputPath));
  const pageCount = source.getPageCount();

  const doomed = new Set(pageNumbers);
  for (const pageNumber of doomed) {
    assert(
      pageNumber <= pageCount,
      `deletePages page ${pageNumber} is out of range, ${inputPath} has ${pageCount} page(s)`
    );
  }
  assert(
    doomed.size < pageCount,
    `deletePages would delete every page of ${inputPath}, leaving nothing to write`
  );

  const keptIndices = Array.from(source.getPageIndices()).filter(
    (index) => !doomed.has(index + 1)
  );

  const result = await PDFDocument.create();
  const copied = await result.copyPages(source, keptIndices);
  for (const page of copied) {
    result.addPage(page);
  }

  await writeFile(outputPath, await result.save());
}
