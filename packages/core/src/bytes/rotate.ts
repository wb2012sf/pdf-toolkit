import { PDFDocument, degrees } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * Rotate pages by a multiple of 90 degrees.
 *
 * The rotation is relative: it is added to whatever rotation a page already
 * carries, then normalized into [0, 360). Omit `pageNumbers` to rotate the
 * whole document; repeats in it are ignored.
 */
export async function rotatePagesBytes(
  input: Uint8Array,
  degreesDelta: number,
  pageNumbers?: number[]
): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'rotatePagesBytes requires the document as a Uint8Array'
  );
  assert(
    Number.isInteger(degreesDelta) && degreesDelta % 90 === 0,
    `rotatePagesBytes needs a rotation that is a whole multiple of 90 degrees, got ${degreesDelta}`
  );
  if (pageNumbers !== undefined) {
    assert(
      Array.isArray(pageNumbers) && pageNumbers.length > 0,
      'rotatePagesBytes requires at least one page number when a selection is given'
    );
    for (const pageNumber of pageNumbers) {
      assert(
        Number.isInteger(pageNumber) && pageNumber >= 1,
        `rotatePagesBytes needs every page to be a 1-based whole number, got ${pageNumber}`
      );
    }
  }

  const doc = await PDFDocument.load(input);
  const pages = doc.getPages();

  let selected: Set<number> | undefined;
  if (pageNumbers !== undefined) {
    selected = new Set(pageNumbers);
    for (const pageNumber of selected) {
      assert(
        pageNumber <= pages.length,
        `rotatePagesBytes page ${pageNumber} is out of range, the document has ${pages.length} page(s)`
      );
    }
  }

  for (const [index, page] of pages.entries()) {
    if (selected !== undefined && !selected.has(index + 1)) {
      continue;
    }
    // Normalize into [0, 360) so a negative or multi-turn delta still lands
    // on one of the four rotations a PDF viewer understands.
    const angle =
      (((page.getRotation().angle + degreesDelta) % 360) + 360) % 360;
    page.setRotation(degrees(angle));
  }

  return doc.save();
}
