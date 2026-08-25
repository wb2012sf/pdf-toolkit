import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

/**
 * Extract the given 1-based pages into a new PDF.
 *
 * Pages appear in the order they are listed, so extract doubles as a "take
 * these pages, in this sequence" operation. A page listed more than once is
 * copied more than once, which is the only unambiguous reading of a repeat.
 * The input is only read.
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

  for (const pageNumber of pageNumbers) {
    assert(
      Number.isInteger(pageNumber) && pageNumber >= 1,
      `extractPages needs every page to be a 1-based whole number, got ${pageNumber}`
    );
  }

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `extractPages refuses to overwrite an input file: ${inputPath}`
  );

  const source = await PDFDocument.load(await readFile(inputPath));
  const pageCount = source.getPageCount();
  for (const pageNumber of pageNumbers) {
    assert(
      pageNumber <= pageCount,
      `extractPages page ${pageNumber} is out of range, ${inputPath} has ${pageCount} page(s)`
    );
  }

  const result = await PDFDocument.create();
  const copied = await result.copyPages(
    source,
    pageNumbers.map((pageNumber) => pageNumber - 1)
  );
  for (const page of copied) {
    result.addPage(page);
  }

  await writeFile(outputPath, await result.save());
}
