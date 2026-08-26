import { PDFDocument } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * Merge PDFs held in memory, in the given order.
 *
 * Pages are appended in the order the documents are given. Nothing here
 * touches the filesystem, so this runs unchanged in a browser or a webview.
 */
export async function mergePdfBytes(inputs: Uint8Array[]): Promise<Uint8Array> {
  assert(Array.isArray(inputs), 'mergePdfBytes requires an array of documents');
  assert(inputs.length > 0, 'mergePdfBytes requires at least one document');

  for (const input of inputs) {
    assert(
      input instanceof Uint8Array,
      'mergePdfBytes requires every document to be a Uint8Array'
    );
  }

  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const source = await PDFDocument.load(input);
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) {
      merged.addPage(page);
    }
  }

  return merged.save();
}
