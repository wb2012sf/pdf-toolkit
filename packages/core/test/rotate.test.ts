import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rotatePagesBytes } from '../src/bytes/rotate.js';
import { rotatePages } from '../src/rotate.js';
import {
  type PageSize,
  makeTestPdf,
  pageRotationsOf,
  pageRotationsOfBytes,
  pageSizesOf,
} from './helpers.js';

const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
  [204, 205],
  [206, 207],
];

describe('rotatePagesBytes', () => {
  it('rotates every page when no selection is given', async () => {
    const result = await rotatePagesBytes(await makeTestPdf(SIZES), 90);

    expect(await pageRotationsOfBytes(result)).toEqual([90, 90, 90, 90]);
  });

  it('rotates only the named pages', async () => {
    const result = await rotatePagesBytes(await makeTestPdf(SIZES), 90, [2, 4]);

    expect(await pageRotationsOfBytes(result)).toEqual([0, 90, 0, 90]);
  });

  it('normalizes a negative rotation', async () => {
    const result = await rotatePagesBytes(await makeTestPdf(SIZES), -90);

    expect(await pageRotationsOfBytes(result)).toEqual([270, 270, 270, 270]);
  });

  it('adds to an existing rotation', async () => {
    const once = await rotatePagesBytes(await makeTestPdf(SIZES), 90);
    const twice = await rotatePagesBytes(once, 90);

    expect(await pageRotationsOfBytes(twice)).toEqual([180, 180, 180, 180]);
  });

  it('rejects a rotation that is not a multiple of 90', async () => {
    await expect(
      rotatePagesBytes(await makeTestPdf(SIZES), 45)
    ).rejects.toThrow(/multiple of 90/);
  });
});

describe('rotatePages', () => {
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

  it('rotates every page when no selection is given', async () => {
    await fixture();

    await rotatePages(inputPath, 90, outputPath);

    expect(await pageRotationsOf(outputPath)).toEqual([90, 90, 90, 90]);
  });

  it('rotates only the named pages', async () => {
    await fixture();

    await rotatePages(inputPath, 90, outputPath, [2, 4]);

    expect(await pageRotationsOf(outputPath)).toEqual([0, 90, 0, 90]);
  });

  it('adds to the rotation a page already has', async () => {
    await fixture();
    const once = join(dir as string, 'once.pdf');

    await rotatePages(inputPath, 90, once);
    await rotatePages(once, 90, outputPath);

    expect(await pageRotationsOf(outputPath)).toEqual([180, 180, 180, 180]);
  });

  it('normalizes a negative rotation', async () => {
    await fixture();

    await rotatePages(inputPath, -90, outputPath);

    expect(await pageRotationsOf(outputPath)).toEqual([270, 270, 270, 270]);
  });

  it('normalizes a rotation of a full turn or more', async () => {
    await fixture();

    await rotatePages(inputPath, 450, outputPath);

    expect(await pageRotationsOf(outputPath)).toEqual([90, 90, 90, 90]);
  });

  it('accepts a zero rotation and copies the document unchanged', async () => {
    await fixture();

    await rotatePages(inputPath, 0, outputPath);

    expect(await pageRotationsOf(outputPath)).toEqual([0, 0, 0, 0]);
    expect(await pageSizesOf(outputPath)).toEqual(SIZES);
  });

  it('ignores duplicate page numbers', async () => {
    await fixture();

    await rotatePages(inputPath, 90, outputPath, [2, 2]);

    expect(await pageRotationsOf(outputPath)).toEqual([0, 90, 0, 0]);
  });

  it('leaves the input file untouched', async () => {
    await fixture();

    await rotatePages(inputPath, 90, outputPath);

    expect(await pageRotationsOf(inputPath)).toEqual([0, 0, 0, 0]);
  });

  it('refuses to write over its own input', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 90, inputPath)).rejects.toThrow(
      /overwrite an input file/
    );
    expect(await pageRotationsOf(inputPath)).toEqual([0, 0, 0, 0]);
  });

  it('rejects a rotation that is not a multiple of 90', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 45, outputPath)).rejects.toThrow(
      /multiple of 90/
    );
  });

  it('rejects a non-integer rotation', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 90.5, outputPath)).rejects.toThrow(
      /multiple of 90/
    );
  });

  it('rejects an empty page selection', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 90, outputPath, [])).rejects.toThrow(
      /at least one page number/
    );
  });

  it('rejects a page number past the end of the document', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 90, outputPath, [5])).rejects.toThrow(
      /out of range/
    );
  });

  it('rejects a page number below one', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 90, outputPath, [0])).rejects.toThrow(
      /1-based whole number/
    );
  });

  it('rejects a non-integer page number', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 90, outputPath, [1.5])).rejects.toThrow(
      /1-based whole number/
    );
  });

  it('rejects an empty output path', async () => {
    await fixture();

    await expect(rotatePages(inputPath, 90, '')).rejects.toThrow(
      /non-empty output path/
    );
  });
});
