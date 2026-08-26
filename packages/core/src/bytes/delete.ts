import { PDFDocument } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * Delete the given 1-based pages, returning what remains.
 *
 * Page numbers may be given in any order and repeats are ignored. Surviving
 * pages keep their original relative order.
 */
export async function deletePagesBytes(
  input: Uint8Array,
  pageNumbers: number[]
): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'deletePagesBytes requires the document as a Uint8Array'
  );
  assert(
    Array.isArray(pageNumbers) && pageNumbers.length > 0,
    'deletePagesBytes requires at least one page number'
  );
  for (const pageNumber of pageNumbers) {
    assert(
      Number.isInteger(pageNumber) && pageNumber >= 1,
      `deletePagesBytes needs every page to be a 1-based whole number, got ${pageNumber}`
    );
  }

  const source = await PDFDocument.load(input);
  const pageCount = source.getPageCount();

  const doomed = new Set(pageNumbers);
  for (const pageNumber of doomed) {
    assert(
      pageNumber <= pageCount,
      `deletePagesBytes page ${pageNumber} is out of range, the document has ${pageCount} page(s)`
    );
  }
  assert(
    doomed.size < pageCount,
    'deletePagesBytes would delete every page, leaving nothing to write'
  );

  const kept = Array.from(source.getPageIndices()).filter(
    (index) => !doomed.has(index + 1)
  );

  const result = await PDFDocument.create();
  const copied = await result.copyPages(source, kept);
  for (const page of copied) {
    result.addPage(page);
  }

  return result.save();
}
