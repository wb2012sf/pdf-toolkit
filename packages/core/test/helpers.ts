import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

/** A page's [width, height], rounded to whole points. */
export type PageSize = [number, number];

/**
 * Build an in-memory PDF whose pages have the given sizes. Distinct sizes act
 * as identity tags, so a test can prove which source page ended up where.
 */
export async function makeTestPdf(sizes: PageSize[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const size of sizes) {
    doc.addPage(size);
  }
  return doc.save();
}

/** Read a PDF from disk and report each page's rotation in degrees. */
export async function pageRotationsOf(path: string): Promise<number[]> {
  const doc = await PDFDocument.load(await readFile(path));
  return doc.getPages().map((page) => page.getRotation().angle);
}

/**
 * Bytes of a PDF whose page tree is genuinely empty.
 *
 * pdf-lib cannot produce one: saving a document with no pages emits a file
 * that loads back with a single page, so this is hand rolled.
 */
export function emptyPagePdf(): Uint8Array {
  const raw = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [] /Count 0 >>',
    'endobj',
    'trailer',
    '<< /Root 1 0 R /Size 3 >>',
    '%%EOF',
    '',
  ].join('\n');
  return new Uint8Array(Buffer.from(raw, 'latin1'));
}

/** Read a PDF from disk and report its page sizes in page order. */
export async function pageSizesOf(path: string): Promise<PageSize[]> {
  const doc = await PDFDocument.load(await readFile(path));
  return doc
    .getPages()
    .map((page): PageSize => [
      Math.round(page.getWidth()),
      Math.round(page.getHeight()),
    ]);
}
