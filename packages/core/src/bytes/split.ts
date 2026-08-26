import { PDFDocument } from 'pdf-lib';
import { assert } from './assert.js';

/**
 * Name for one page of a split document, zero padded so a lexical sort
 * matches page order. Shared, so a browser download can name files the same
 * way the CLI does.
 */
export function pageFileName(
  stem: string,
  pageNumber: number,
  pageCount: number
): string {
  assert(
    typeof stem === 'string' && stem.length > 0,
    'pageFileName requires a non-empty stem'
  );
  // Widen past three digits only when the document needs it, so the lexical
  // sort still matches page order beyond 999 pages.
  const digits = Math.max(3, String(pageCount).length);
  return `${stem}-page-${String(pageNumber).padStart(digits, '0')}.pdf`;
}

/**
 * Split a PDF into one single-page document per source page, in page order.
 *
 * Naming is the caller's business, since it is a filesystem concern; use
 * pageFileName to match what the CLI produces.
 */
export async function splitPdfBytes(input: Uint8Array): Promise<Uint8Array[]> {
  assert(
    input instanceof Uint8Array,
    'splitPdfBytes requires the document as a Uint8Array'
  );

  const source = await PDFDocument.load(input);
  const pageCount = source.getPageCount();
  assert(pageCount > 0, 'splitPdfBytes requires a PDF with at least one page');

  const pages: Uint8Array[] = [];
  for (let index = 0; index < pageCount; index++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(source, [index]);
    assert(page, `splitPdfBytes could not copy page ${index + 1}`);
    single.addPage(page);
    pages.push(await single.save());
  }

  return pages;
}
