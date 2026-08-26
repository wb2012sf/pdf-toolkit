import { PDFDocument } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * Rearrange a document into the given page order.
 *
 * `order` must be a complete permutation: every page exactly once, nothing
 * repeated or omitted. That keeps a reorder lossless, and turns a typo into a
 * clear failure rather than a silently dropped page.
 */
export async function reorderPagesBytes(
  input: Uint8Array,
  order: number[]
): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'reorderPagesBytes requires the document as a Uint8Array'
  );
  assert(
    Array.isArray(order) && order.length > 0,
    'reorderPagesBytes requires at least one page number'
  );
  for (const pageNumber of order) {
    assert(
      Number.isInteger(pageNumber) && pageNumber >= 1,
      `reorderPagesBytes needs every page to be a 1-based whole number, got ${pageNumber}`
    );
  }

  const source = await PDFDocument.load(input);
  const pageCount = source.getPageCount();

  const seen = new Set<number>();
  for (const pageNumber of order) {
    assert(
      pageNumber <= pageCount,
      `reorderPagesBytes page ${pageNumber} is out of range, the document has ${pageCount} page(s)`
    );
    assert(
      !seen.has(pageNumber),
      `reorderPagesBytes lists page ${pageNumber} more than once, every page must appear exactly once`
    );
    seen.add(pageNumber);
  }
  assert(
    order.length === pageCount,
    `reorderPagesBytes must list every page exactly once, got ${order.length} page number(s) for a ${pageCount} page document`
  );

  const result = await PDFDocument.create();
  const copied = await result.copyPages(
    source,
    order.map((pageNumber) => pageNumber - 1)
  );
  for (const page of copied) {
    result.addPage(page);
  }

  return result.save();
}
