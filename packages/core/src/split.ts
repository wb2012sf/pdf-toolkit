import assert from 'node:assert';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { PDFDocument } from 'pdf-lib';

/**
 * Split a PDF into one single-page file per source page.
 *
 * Output files are named after the input's stem, `<stem>-page-<n>.pdf`, with
 * the page number zero padded so a plain lexical sort matches page order. The
 * input is only read, never written. Returns the written paths in page order.
 */
export async function splitPdf(
  inputPath: string,
  outputDir: string
): Promise<string[]> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'splitPdf requires a non-empty input path'
  );
  assert(
    typeof outputDir === 'string' && outputDir.length > 0,
    'splitPdf requires a non-empty output directory'
  );

  const source = await PDFDocument.load(await readFile(inputPath));
  const pageCount = source.getPageCount();
  assert(
    pageCount > 0,
    `splitPdf requires a PDF with at least one page: ${inputPath}`
  );

  await mkdir(outputDir, { recursive: true });

  const stem = parse(inputPath).name;
  // Widen past three digits only when the document needs it, so a lexical
  // sort still matches page order for documents over 999 pages.
  const digits = Math.max(3, String(pageCount).length);
  const written: string[] = [];

  for (let index = 0; index < pageCount; index++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(source, [index]);
    assert(page, `splitPdf could not copy page ${index + 1} of ${inputPath}`);
    single.addPage(page);

    const pageNumber = String(index + 1).padStart(digits, '0');
    const outputPath = join(outputDir, `${stem}-page-${pageNumber}.pdf`);
    await writeFile(outputPath, await single.save());
    written.push(outputPath);
  }

  return written;
}
