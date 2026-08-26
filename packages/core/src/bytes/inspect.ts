import { PDFDocument } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * How many pages a document has.
 *
 * Reading only, so zero is reported rather than refused; each operation
 * decides for itself whether an empty document is acceptable. Bytes that are
 * not a readable PDF throw, which lets a caller reject a file when it is
 * chosen instead of when an operation is finally run.
 */
export async function pageCountOf(input: Uint8Array): Promise<number> {
  assert(
    input instanceof Uint8Array,
    'pageCountOf requires the document as a Uint8Array'
  );

  const doc = await PDFDocument.load(input);
  return doc.getPageCount();
}
