import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mergePdfBytes } from '../src/bytes/merge.js';
import { mergePdfs } from '../src/merge.js';
import {
  type PageSize,
  makeTestPdf,
  pageSizesOf,
  pageSizesOfBytes,
} from './helpers.js';

// Distinct page sizes act as identity tags, so the merged document proves
// which source each page came from and in what order.
const A_SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
];
const B_SIZES: PageSize[] = [
  [300, 301],
  [302, 303],
  [304, 305],
];

describe('mergePdfBytes', () => {
  it('combines pages from several documents in order', async () => {
    const merged = await mergePdfBytes([
      await makeTestPdf(A_SIZES),
      await makeTestPdf(B_SIZES),
    ]);

    expect(await pageSizesOfBytes(merged)).toEqual([...A_SIZES, ...B_SIZES]);
  });

  it('follows the order it is given', async () => {
    const merged = await mergePdfBytes([
      await makeTestPdf(B_SIZES),
      await makeTestPdf(A_SIZES),
    ]);

    expect(await pageSizesOfBytes(merged)).toEqual([...B_SIZES, ...A_SIZES]);
  });

  it('accepts a single document', async () => {
    const merged = await mergePdfBytes([await makeTestPdf(A_SIZES)]);

    expect(await pageSizesOfBytes(merged)).toEqual(A_SIZES);
  });

  it('touches no filesystem, so it runs in a browser', async () => {
    // The whole point of this layer: bytes in, bytes out, nothing else.
    const merged = await mergePdfBytes([await makeTestPdf(A_SIZES)]);

    expect(merged).toBeInstanceOf(Uint8Array);
  });

  it('rejects an empty list', async () => {
    await expect(mergePdfBytes([])).rejects.toThrow(/at least one document/);
  });
});

describe('mergePdfs', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('combines pages from multiple PDFs in order', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const pathA = join(dir, 'a.pdf');
    const pathB = join(dir, 'b.pdf');
    const outPath = join(dir, 'out.pdf');

    await writeFile(pathA, await makeTestPdf(A_SIZES));
    await writeFile(pathB, await makeTestPdf(B_SIZES));

    await mergePdfs([pathA, pathB], outPath);

    expect(await pageSizesOf(outPath)).toEqual([...A_SIZES, ...B_SIZES]);
  });

  it('follows the input order it is given, not the order on disk', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const pathA = join(dir, 'a.pdf');
    const pathB = join(dir, 'b.pdf');
    const outPath = join(dir, 'out.pdf');

    await writeFile(pathA, await makeTestPdf(A_SIZES));
    await writeFile(pathB, await makeTestPdf(B_SIZES));

    await mergePdfs([pathB, pathA], outPath);

    expect(await pageSizesOf(outPath)).toEqual([...B_SIZES, ...A_SIZES]);
  });

  it('leaves the input files untouched', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const pathA = join(dir, 'a.pdf');
    const pathB = join(dir, 'b.pdf');
    const outPath = join(dir, 'out.pdf');

    await writeFile(pathA, await makeTestPdf(A_SIZES));
    await writeFile(pathB, await makeTestPdf(B_SIZES));

    await mergePdfs([pathA, pathB], outPath);

    expect(await pageSizesOf(pathA)).toEqual(A_SIZES);
    expect(await pageSizesOf(pathB)).toEqual(B_SIZES);
  });

  it('rejects an empty input list', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const outPath = join(dir, 'out.pdf');

    await expect(mergePdfs([], outPath)).rejects.toThrow(
      /at least one input path/
    );
  });

  it('refuses to write over one of its own inputs', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const pathA = join(dir, 'a.pdf');
    const pathB = join(dir, 'b.pdf');

    await writeFile(pathA, await makeTestPdf(A_SIZES));
    await writeFile(pathB, await makeTestPdf(B_SIZES));

    await expect(mergePdfs([pathA, pathB], pathA)).rejects.toThrow(
      /overwrite an input file/
    );
    expect(await pageSizesOf(pathA)).toEqual(A_SIZES);
  });

  it('rejects an empty output path', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const pathA = join(dir, 'a.pdf');
    await writeFile(pathA, await makeTestPdf(A_SIZES));

    await expect(mergePdfs([pathA], '')).rejects.toThrow(
      /non-empty output path/
    );
  });
});
