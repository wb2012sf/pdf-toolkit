import { PDFDocument } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * Insert every page of one document into another.
 *
 * `atPage` is the page number the first inserted page takes in the result,
 * so 1 prepends and one past the last page appends.
 */
export async function insertPagesBytes(
  base: Uint8Array,
  insert: Uint8Array,
  atPage: number
): Promise<Uint8Array> {
  assert(
    base instanceof Uint8Array,
    'insertPagesBytes requires the base document as a Uint8Array'
  );
  assert(
    insert instanceof Uint8Array,
    'insertPagesBytes requires the inserted document as a Uint8Array'
  );
  assert(
    Number.isInteger(atPage) && atPage >= 1,
    `insertPagesBytes needs the position to be a 1-based whole number, got ${atPage}`
  );

  const baseDoc = await PDFDocument.load(base);
  const insertDoc = await PDFDocument.load(insert);

  const baseCount = baseDoc.getPageCount();
  assert(
    atPage <= baseCount + 1,
    `insertPagesBytes position ${atPage} is out of range, the document has ${baseCount} page(s) so the last position is ${baseCount + 1}`
  );
  assert(
    insertDoc.getPageCount() > 0,
    'insertPagesBytes found no pages to insert'
  );

  const result = await PDFDocument.create();
  const splitAt = atPage - 1;
  const baseIndices = Array.from(baseDoc.getPageIndices());

  // Copy per source document: copyPages only accepts indices from one donor.
  const leading = await result.copyPages(
    baseDoc,
    baseIndices.slice(0, splitAt)
  );
  const middle = await result.copyPages(
    insertDoc,
    Array.from(insertDoc.getPageIndices())
  );
  const trailing = await result.copyPages(baseDoc, baseIndices.slice(splitAt));

  for (const page of [...leading, ...middle, ...trailing]) {
    result.addPage(page);
  }

  return result.save();
}
