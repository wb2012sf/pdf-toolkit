import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

/**
 * Insert every page of one PDF into another at a 1-based position.
 *
 * `atPage` is the page number the first inserted page takes in the result, so
 * 1 prepends and one past the last page appends. Both inputs are only read.
 */
export async function insertPages(
  basePath: string,
  insertPath: string,
  atPage: number,
  outputPath: string
): Promise<void> {
  assert(
    typeof basePath === 'string' && basePath.length > 0,
    'insertPages requires a non-empty base path'
  );
  assert(
    typeof insertPath === 'string' && insertPath.length > 0,
    'insertPages requires a non-empty insert path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'insertPages requires a non-empty output path'
  );

  assert(
    Number.isInteger(atPage) && atPage >= 1,
    `insertPages needs the position to be a 1-based whole number, got ${atPage}`
  );

  // Non-destructive by default: neither source may be the destination.
  const resolvedOutput = resolve(outputPath);
  for (const inputPath of [basePath, insertPath]) {
    assert(
      resolve(inputPath) !== resolvedOutput,
      `insertPages refuses to overwrite an input file: ${inputPath}`
    );
  }

  const base = await PDFDocument.load(await readFile(basePath));
  const inserted = await PDFDocument.load(await readFile(insertPath));

  const baseCount = base.getPageCount();
  assert(
    atPage <= baseCount + 1,
    `insertPages position ${atPage} is out of range, ${basePath} has ${baseCount} page(s) so the last position is ${baseCount + 1}`
  );
  assert(
    inserted.getPageCount() > 0,
    `insertPages found no pages to insert in ${insertPath}`
  );

  const result = await PDFDocument.create();
  const splitAt = atPage - 1;
  const baseIndices = Array.from(base.getPageIndices());

  // Copy per source document: copyPages only accepts indices from one donor.
  const leading = await result.copyPages(base, baseIndices.slice(0, splitAt));
  const middle = await result.copyPages(
    inserted,
    Array.from(inserted.getPageIndices())
  );
  const trailing = await result.copyPages(base, baseIndices.slice(splitAt));

  for (const page of [...leading, ...middle, ...trailing]) {
    result.addPage(page);
  }

  await writeFile(outputPath, await result.save());
}
