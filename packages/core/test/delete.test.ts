import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deletePagesBytes } from '../src/bytes/delete.js';
import { deletePages } from '../src/delete.js';
import {
  type PageSize,
  makeTestPdf,
  pageSizesOf,
  pageSizesOfBytes,
} from './helpers.js';

const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
  [204, 205],
  [206, 207],
  [208, 209],
];

describe('deletePagesBytes', () => {
  it('removes the named pages and keeps the rest in order', async () => {
    const result = await deletePagesBytes(await makeTestPdf(SIZES), [2, 4]);

    expect(await pageSizesOfBytes(result)).toEqual([
      SIZES[0],
      SIZES[2],
      SIZES[4],
    ]);
  });

  it('ignores duplicates and accepts any order', async () => {
    const result = await deletePagesBytes(await makeTestPdf(SIZES), [4, 2, 4]);

    expect(await pageSizesOfBytes(result)).toEqual([
      SIZES[0],
      SIZES[2],
      SIZES[4],
    ]);
  });

  it('refuses to delete every page', async () => {
    await expect(
      deletePagesBytes(await makeTestPdf(SIZES), [1, 2, 3, 4, 5])
    ).rejects.toThrow(/would delete every page/);
  });

  it('rejects a page past the end', async () => {
    await expect(
      deletePagesBytes(await makeTestPdf(SIZES), [6])
    ).rejects.toThrow(/out of range/);
  });

  it('rejects a page below one', async () => {
    await expect(
      deletePagesBytes(await makeTestPdf(SIZES), [0])
    ).rejects.toThrow(/1-based whole number/);
  });
});

describe('deletePages', () => {
  let dir: string | undefined;
  let inputPath: string;
  let outputPath: string;

  async function fixture(sizes: PageSize[] = SIZES): Promise<void> {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    inputPath = join(dir, 'doc.pdf');
    outputPath = join(dir, 'out.pdf');
    await writeFile(inputPath, await makeTestPdf(sizes));
  }

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('removes the named pages and keeps the rest in order', async () => {
    await fixture();

    await deletePages(inputPath, [2, 4], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([
      SIZES[0],
      SIZES[2],
      SIZES[4],
    ]);
  });

  it('accepts page numbers out of order and ignores duplicates', async () => {
    await fixture();

    await deletePages(inputPath, [4, 2, 4], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([
      SIZES[0],
      SIZES[2],
      SIZES[4],
    ]);
  });

  it('deletes a single page', async () => {
    await fixture();

    await deletePages(inputPath, [1], outputPath);

    expect(await pageSizesOf(outputPath)).toEqual(SIZES.slice(1));
  });

  it('leaves the input file untouched', async () => {
    await fixture();

    await deletePages(inputPath, [3], outputPath);

    expect(await pageSizesOf(inputPath)).toEqual(SIZES);
  });

  it('refuses to write over its own input', async () => {
    await fixture();

    await expect(deletePages(inputPath, [3], inputPath)).rejects.toThrow(
      /overwrite an input file/
    );
    expect(await pageSizesOf(inputPath)).toEqual(SIZES);
  });

  it('refuses to delete every page', async () => {
    await fixture();

    await expect(
      deletePages(inputPath, [1, 2, 3, 4, 5], outputPath)
    ).rejects.toThrow(/would delete every page/);
  });

  it('rejects a page number past the end of the document', async () => {
    await fixture();

    await expect(deletePages(inputPath, [6], outputPath)).rejects.toThrow(
      /out of range/
    );
  });

  it('rejects a page number below one', async () => {
    await fixture();

    await expect(deletePages(inputPath, [0], outputPath)).rejects.toThrow(
      /1-based whole number/
    );
  });

  it('rejects a non-integer page number', async () => {
    await fixture();

    await expect(deletePages(inputPath, [1.5], outputPath)).rejects.toThrow(
      /1-based whole number/
    );
  });

  it('rejects an empty page list', async () => {
    await fixture();

    await expect(deletePages(inputPath, [], outputPath)).rejects.toThrow(
      /at least one page number/
    );
  });

  it('rejects an empty output path', async () => {
    await fixture();

    await expect(deletePages(inputPath, [1], '')).rejects.toThrow(
      /non-empty output path/
    );
  });
});
