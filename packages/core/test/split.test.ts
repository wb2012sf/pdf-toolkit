import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { splitPdf } from '../src/split.js';
import { type PageSize, makeTestPdf, pageSizesOf } from './helpers.js';

const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
  [204, 205],
  [206, 207],
  [208, 209],
];

describe('splitPdf', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('writes one single-page file per source page, in page order', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const inputPath = join(dir, 'doc.pdf');
    const outputDir = join(dir, 'out');
    await writeFile(inputPath, await makeTestPdf(SIZES));

    await splitPdf(inputPath, outputDir);

    expect((await readdir(outputDir)).sort()).toEqual([
      'doc-page-001.pdf',
      'doc-page-002.pdf',
      'doc-page-003.pdf',
      'doc-page-004.pdf',
      'doc-page-005.pdf',
    ]);

    for (const [index, size] of SIZES.entries()) {
      const page = join(outputDir, `doc-page-00${index + 1}.pdf`);
      expect(await pageSizesOf(page)).toEqual([size]);
    }
  });

  it('returns the written paths in page order', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const inputPath = join(dir, 'doc.pdf');
    const outputDir = join(dir, 'out');
    await writeFile(inputPath, await makeTestPdf(SIZES));

    const written = await splitPdf(inputPath, outputDir);

    expect(written).toEqual([
      join(outputDir, 'doc-page-001.pdf'),
      join(outputDir, 'doc-page-002.pdf'),
      join(outputDir, 'doc-page-003.pdf'),
      join(outputDir, 'doc-page-004.pdf'),
      join(outputDir, 'doc-page-005.pdf'),
    ]);
  });

  it('handles a single-page document', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const inputPath = join(dir, 'solo.pdf');
    const outputDir = join(dir, 'out');
    await writeFile(inputPath, await makeTestPdf([[300, 301]]));

    const written = await splitPdf(inputPath, outputDir);

    expect(written).toEqual([join(outputDir, 'solo-page-001.pdf')]);
    expect(await pageSizesOf(written[0] as string)).toEqual([[300, 301]]);
  });

  it('creates the output directory when it does not exist', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const inputPath = join(dir, 'doc.pdf');
    const outputDir = join(dir, 'nested', 'out');
    await writeFile(inputPath, await makeTestPdf(SIZES));

    await splitPdf(inputPath, outputDir);

    expect((await stat(outputDir)).isDirectory()).toBe(true);
  });

  it('leaves the input file untouched', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const inputPath = join(dir, 'doc.pdf');
    const outputDir = join(dir, 'out');
    await writeFile(inputPath, await makeTestPdf(SIZES));

    await splitPdf(inputPath, outputDir);

    expect(await pageSizesOf(inputPath)).toEqual(SIZES);
  });

  it('rejects an empty input path', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));

    await expect(splitPdf('', join(dir, 'out'))).rejects.toThrow(
      /non-empty input path/
    );
  });

  it('rejects an empty output directory', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const inputPath = join(dir, 'doc.pdf');
    await writeFile(inputPath, await makeTestPdf(SIZES));

    await expect(splitPdf(inputPath, '')).rejects.toThrow(
      /non-empty output directory/
    );
  });
});
