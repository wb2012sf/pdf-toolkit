import { describe, expect, it } from 'vitest';
import { pageCountOf } from '../src/bytes/inspect.js';
import { type PageSize, emptyPagePdf, makeTestPdf } from './helpers.js';

const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
  [204, 205],
];

describe('pageCountOf', () => {
  it('counts the pages', async () => {
    expect(await pageCountOf(await makeTestPdf(SIZES))).toBe(3);
  });

  it('counts a single page', async () => {
    expect(await pageCountOf(await makeTestPdf([[300, 301]]))).toBe(1);
  });

  it('reports zero for a document with an empty page tree', async () => {
    // Not an error here: the operations decide whether zero is acceptable,
    // and this only reports what is there.
    expect(await pageCountOf(emptyPagePdf())).toBe(0);
  });

  it('does not modify the bytes it was given', async () => {
    const bytes = await makeTestPdf(SIZES);
    const before = bytes.slice();

    await pageCountOf(bytes);

    expect(bytes).toEqual(before);
  });

  it('rejects something that is not a Uint8Array', async () => {
    await expect(
      pageCountOf('not bytes' as unknown as Uint8Array)
    ).rejects.toThrow(/Uint8Array/);
  });

  it('rejects bytes that are not a PDF at all', async () => {
    // The UI relies on this to reject a bad file when it is dropped, rather
    // than letting it fail later inside an operation.
    await expect(pageCountOf(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});
