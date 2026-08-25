import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractPages } from '../src/extract.js';
import { makeTestPdf, pageSizesOf, type PageSize } from './helpers.js';

const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
  [204, 205],
  [206, 207],
  [208, 209],
];

describe('extractPages', () => {
  let dir: string | undefined;
  let inputPath: string;
  let outputPath: string;

  async function fixture(): Promise<void> {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    inputPath = join(dir, 'doc.pdf');
    outputPath = join(dir, 'out.pdf');
    await writeFile(inputPath, await makeTestPdf(SIZES));
  }

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('extracts a contiguous run of pages in document order', async () => {
    await fixture();

    await extractPages(inputPath, [2, 3, 4], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([
      SIZES[1],
      SIZES[2],
      SIZES[3],
    ]);
  });

  it('honours the order the pages are listed in', async () => {
    await fixture();

    await extractPages(inputPath, [4, 1, 3], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([
      SIZES[3],
      SIZES[0],
      SIZES[2],
    ]);
  });

  it('extracts a single page', async () => {
    await fixture();

    await extractPages(inputPath, [5], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([SIZES[4]]);
  });

  it('repeats a page that is listed more than once', async () => {
    await fixture();

    await extractPages(inputPath, [2, 2, 5], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([
      SIZES[1],
      SIZES[1],
      SIZES[4],
    ]);
  });

  it('extracts every page as a straight copy', async () => {
    await fixture();

    await extractPages(inputPath, [1, 2, 3, 4, 5], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual(SIZES);
  });

  it('leaves the input file untouched', async () => {
    await fixture();

    await extractPages(inputPath, [1, 2], outputPath);

    expect(await pageSizesOf(inputPath)).toEqual(SIZES);
  });

  it('refuses to write over its own input', async () => {
    await fixture();

    await expect(extractPages(inputPath, [1], inputPath)).rejects.toThrow(
      /overwrite an input file/
    );
    expect(await pageSizesOf(inputPath)).toEqual(SIZES);
  });

  it('rejects a page number past the end of the document', async () => {
    await fixture();

    await expect(extractPages(inputPath, [6], outputPath)).rejects.toThrow(
      /out of range/
    );
  });

  it('rejects a page number below one', async () => {
    await fixture();

    await expect(extractPages(inputPath, [0], outputPath)).rejects.toThrow(
      /1-based whole number/
    );
  });

  it('rejects a non-integer page number', async () => {
    await fixture();

    await expect(extractPages(inputPath, [2.5], outputPath)).rejects.toThrow(
      /1-based whole number/
    );
  });

  it('rejects an empty page list', async () => {
    await fixture();

    await expect(extractPages(inputPath, [], outputPath)).rejects.toThrow(
      /at least one page number/
    );
  });

  it('rejects an empty output path', async () => {
    await fixture();

    await expect(extractPages(inputPath, [1], '')).rejects.toThrow(
      /non-empty output path/
    );
  });
});
