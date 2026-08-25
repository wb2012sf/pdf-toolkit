import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { insertPages } from '../src/insert.js';
import {
  emptyPagePdf,
  makeTestPdf,
  pageSizesOf,
  type PageSize,
} from './helpers.js';

const BASE: PageSize[] = [
  [100, 101],
  [102, 103],
  [104, 105],
  [106, 107],
];
const INSERT: PageSize[] = [
  [500, 501],
  [502, 503],
];

describe('insertPages', () => {
  let dir: string | undefined;
  let basePath: string;
  let insertPath: string;
  let outputPath: string;

  async function fixture(): Promise<void> {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    basePath = join(dir, 'base.pdf');
    insertPath = join(dir, 'insert.pdf');
    outputPath = join(dir, 'out.pdf');
    await writeFile(basePath, await makeTestPdf(BASE));
    await writeFile(insertPath, await makeTestPdf(INSERT));
  }

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('inserts every page of the source at the given position', async () => {
    await fixture();

    await insertPages(basePath, insertPath, 3, outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([
      BASE[0],
      BASE[1],
      INSERT[0],
      INSERT[1],
      BASE[2],
      BASE[3],
    ]);
  });

  it('prepends when the position is 1', async () => {
    await fixture();

    await insertPages(basePath, insertPath, 1, outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([...INSERT, ...BASE]);
  });

  it('appends when the position is one past the last page', async () => {
    await fixture();

    await insertPages(basePath, insertPath, BASE.length + 1, outputPath);

    expect(await pageSizesOf(outputPath)).toEqual([...BASE, ...INSERT]);
  });

  it('leaves both input files untouched', async () => {
    await fixture();

    await insertPages(basePath, insertPath, 2, outputPath);

    expect(await pageSizesOf(basePath)).toEqual(BASE);
    expect(await pageSizesOf(insertPath)).toEqual(INSERT);
  });

  it('refuses to write over the base input', async () => {
    await fixture();

    await expect(
      insertPages(basePath, insertPath, 2, basePath)
    ).rejects.toThrow(/overwrite an input file/);
    expect(await pageSizesOf(basePath)).toEqual(BASE);
  });

  it('refuses to write over the inserted input', async () => {
    await fixture();

    await expect(
      insertPages(basePath, insertPath, 2, insertPath)
    ).rejects.toThrow(/overwrite an input file/);
    expect(await pageSizesOf(insertPath)).toEqual(INSERT);
  });

  it('rejects a position past one after the last page', async () => {
    await fixture();

    await expect(
      insertPages(basePath, insertPath, BASE.length + 2, outputPath)
    ).rejects.toThrow(/out of range/);
  });

  it('rejects a position below one', async () => {
    await fixture();

    await expect(
      insertPages(basePath, insertPath, 0, outputPath)
    ).rejects.toThrow(/1-based whole number/);
  });

  it('rejects a non-integer position', async () => {
    await fixture();

    await expect(
      insertPages(basePath, insertPath, 2.5, outputPath)
    ).rejects.toThrow(/1-based whole number/);
  });

  it('rejects an insert document with no pages', async () => {
    await fixture();
    const emptyPath = join(dir as string, 'empty.pdf');
    await writeFile(emptyPath, emptyPagePdf());

    await expect(
      insertPages(basePath, emptyPath, 2, outputPath)
    ).rejects.toThrow(/no pages to insert/);
  });

  it('rejects an empty output path', async () => {
    await fixture();

    await expect(insertPages(basePath, insertPath, 1, '')).rejects.toThrow(
      /non-empty output path/
    );
  });
});
