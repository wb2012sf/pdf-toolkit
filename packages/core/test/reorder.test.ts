import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reorderPages } from '../src/reorder.js';
import { makeTestPdf, pageSizesOf, type PageSize } from './helpers.js';

const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
  [204, 205],
  [206, 207],
  [208, 209],
];

describe('reorderPages', () => {
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

  it('rearranges pages into the given order', async () => {
    await fixture();

    await reorderPages(inputPath, [3, 1, 5, 2, 4], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([
      SIZES[2],
      SIZES[0],
      SIZES[4],
      SIZES[1],
      SIZES[3],
    ]);
  });

  it('reverses a document', async () => {
    await fixture();

    await reorderPages(inputPath, [5, 4, 3, 2, 1], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([...SIZES].reverse());
  });

  it('accepts the identity order and copies the document unchanged', async () => {
    await fixture();

    await reorderPages(inputPath, [1, 2, 3, 4, 5], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual(SIZES);
  });

  it('leaves the input file untouched', async () => {
    await fixture();

    await reorderPages(inputPath, [5, 4, 3, 2, 1], outputPath);

    expect(await pageSizesOf(inputPath)).toEqual(SIZES);
  });

  it('refuses to write over its own input', async () => {
    await fixture();

    await expect(
      reorderPages(inputPath, [5, 4, 3, 2, 1], inputPath)
    ).rejects.toThrow(/overwrite an input file/);
    expect(await pageSizesOf(inputPath)).toEqual(SIZES);
  });

  it('rejects an order that repeats a page', async () => {
    await fixture();

    await expect(
      reorderPages(inputPath, [1, 2, 2, 4, 5], outputPath)
    ).rejects.toThrow(/more than once/);
  });

  it('rejects an order that omits a page', async () => {
    await fixture();

    await expect(
      reorderPages(inputPath, [1, 2, 3, 4], outputPath)
    ).rejects.toThrow(/every page exactly once/);
  });

  it('rejects an order longer than the document', async () => {
    await fixture();

    // The extra entry can only be a page that does not exist, so the
    // out-of-range check names it before the length check runs.
    await expect(
      reorderPages(inputPath, [1, 2, 3, 4, 5, 6], outputPath)
    ).rejects.toThrow(/page 6 is out of range/);
  });

  it('rejects a page number past the end of the document', async () => {
    await fixture();

    await expect(
      reorderPages(inputPath, [1, 2, 3, 4, 6], outputPath)
    ).rejects.toThrow(/out of range/);
  });

  it('rejects a page number below one', async () => {
    await fixture();

    await expect(
      reorderPages(inputPath, [0, 1, 2, 3, 4], outputPath)
    ).rejects.toThrow(/1-based whole number/);
  });

  it('rejects a non-integer page number', async () => {
    await fixture();

    await expect(
      reorderPages(inputPath, [1, 2, 3, 4, 5.5], outputPath)
    ).rejects.toThrow(/1-based whole number/);
  });

  it('rejects an empty order', async () => {
    await fixture();

    await expect(reorderPages(inputPath, [], outputPath)).rejects.toThrow(
      /at least one page number/
    );
  });

  it('rejects an empty output path', async () => {
    await fixture();

    await expect(
      reorderPages(inputPath, [1, 2, 3, 4, 5], '')
    ).rejects.toThrow(/non-empty output path/);
  });
});
