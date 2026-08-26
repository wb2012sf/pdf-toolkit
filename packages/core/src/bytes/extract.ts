import { PDFDocument } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * Extract the given 1-based pages into a new document.
 *
 * Pages appear in the order they are listed, and a page listed more than once
 * is copied more than once, the only unambiguous reading of a repeat.
 */
export async function extractPagesBytes(
  input: Uint8Array,
  pageNumbers: number[]
): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'extractPagesBytes requires the document as a Uint8Array'
  );
  assert(
    Array.isArray(pageNumbers) && pageNumbers.length > 0,
    'extractPagesBytes requires at least one page number'
  );
  for (const pageNumber of pageNumbers) {
    assert(
      Number.isInteger(pageNumber) && pageNumber >= 1,
      `extractPagesBytes needs every page to be a 1-based whole number, got ${pageNumber}`
    );
  }

  const source = await PDFDocument.load(input);
  const pageCount = source.getPageCount();
  for (const pageNumber of pageNumbers) {
    assert(
      pageNumber <= pageCount,
      `extractPagesBytes page ${pageNumber} is out of range, the document has ${pageCount} page(s)`
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

  return result.save();
}
