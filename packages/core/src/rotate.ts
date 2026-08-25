import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Rotate pages of a PDF by a multiple of 90 degrees, writing a new file.
 *
 * The rotation is relative: it is added to whatever rotation a page already
 * carries, then normalized into [0, 360). `pageNumbers` selects 1-based pages
 * to turn, and repeats are ignored; omit it to rotate the whole document.
 * The input is only read.
 */
export async function rotatePages(
  inputPath: string,
  degreesDelta: number,
  outputPath: string,
  pageNumbers?: number[]
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'rotatePages requires a non-empty input path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'rotatePages requires a non-empty output path'
  );

  assert(
    Number.isInteger(degreesDelta) && degreesDelta % 90 === 0,
    `rotatePages needs a rotation that is a whole multiple of 90 degrees, got ${degreesDelta}`
  );
  if (pageNumbers !== undefined) {
    assert(
      Array.isArray(pageNumbers) && pageNumbers.length > 0,
      'rotatePages requires at least one page number when a selection is given'
    );
    for (const pageNumber of pageNumbers) {
      assert(
        Number.isInteger(pageNumber) && pageNumber >= 1,
        `rotatePages needs every page to be a 1-based whole number, got ${pageNumber}`
      );
    }
  }

  // Non-destructive by default: the caller still expects the source intact.
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `rotatePages refuses to overwrite an input file: ${inputPath}`
  );

  const doc = await PDFDocument.load(await readFile(inputPath));
  const pages = doc.getPages();

  let selected: Set<number> | undefined;
  if (pageNumbers !== undefined) {
    selected = new Set(pageNumbers);
    for (const pageNumber of selected) {
      assert(
        pageNumber <= pages.length,
        `rotatePages page ${pageNumber} is out of range, ${inputPath} has ${pages.length} page(s)`
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

  await writeFile(outputPath, await doc.save());
}
