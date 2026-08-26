import assert from 'node:assert';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { pageFileName, splitPdfBytes } from './bytes/split.js';

/**
 * Split a PDF into one single-page file per source page.
 *
 * Output files are named after the input's stem, `<stem>-page-<n>.pdf`, with
 * the page number zero padded so a plain lexical sort matches page order. The
 * input is only read, never written. Returns the written paths in page order.
 *
 * This is the filesystem wrapper. The work is in splitPdfBytes, which has no
 * filesystem dependency and so also runs in a browser or a Tauri webview.
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

  const pages = await splitPdfBytes(await readFile(inputPath));

  await mkdir(outputDir, { recursive: true });

  const stem = parse(inputPath).name;
  const written: string[] = [];
  for (const [index, page] of pages.entries()) {
    const outputPath = join(
      outputDir,
      pageFileName(stem, index + 1, pages.length)
    );
    await writeFile(outputPath, page);
    written.push(outputPath);
  }

  return written;
}
