import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

/**
 * Rearrange a PDF's pages into the given order, writing a new file.
 *
 * `order` is the new sequence of 1-based source page numbers and must be a
 * complete permutation: every page exactly once, nothing repeated or omitted.
 * That keeps a reorder lossless, and turns a typo into a clear failure rather
 * than a silently dropped page. Use extract to select a subset. Input is only
 * read.
 */
export async function reorderPages(
  inputPath: string,
  order: number[],
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'reorderPages requires a non-empty input path'
  );
  assert(
    Array.isArray(order) && order.length > 0,
    'reorderPages requires at least one page number'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'reorderPages requires a non-empty output path'
  );

  for (const pageNumber of order) {
    assert(
      Number.isInteger(pageNumber) && pageNumber >= 1,
      `reorderPages needs every page to be a 1-based whole number, got ${pageNumber}`
    );
  }

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `reorderPages refuses to overwrite an input file: ${inputPath}`
  );

  const source = await PDFDocument.load(await readFile(inputPath));
  const pageCount = source.getPageCount();

  const seen = new Set<number>();
  for (const pageNumber of order) {
    assert(
      pageNumber <= pageCount,
      `reorderPages page ${pageNumber} is out of range, ${inputPath} has ${pageCount} page(s)`
    );
    assert(
      !seen.has(pageNumber),
      `reorderPages lists page ${pageNumber} more than once, every page must appear exactly once`
    );
    seen.add(pageNumber);
  }
  assert(
    order.length === pageCount,
    `reorderPages must list every page exactly once, got ${order.length} page number(s) for a ${pageCount} page document`
  );

  const result = await PDFDocument.create();
  const copied = await result.copyPages(
    source,
    order.map((pageNumber) => pageNumber - 1)
  );
  for (const page of copied) {
    result.addPage(page);
  }

  await writeFile(outputPath, await result.save());
}
