import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildZip, withExtension } from '../src/save.js';

describe('withExtension', () => {
  it('adds the extension when it is missing', () => {
    expect(withExtension('report', '.pdf')).toBe('report.pdf');
  });

  it('leaves an existing extension alone rather than doubling it', () => {
    expect(withExtension('report.pdf', '.pdf')).toBe('report.pdf');
  });

  it('recognises the extension whatever case it is in', () => {
    expect(withExtension('REPORT.PDF', '.pdf')).toBe('REPORT.PDF');
  });

  it('trims surrounding spaces', () => {
    expect(withExtension('  report  ', '.pdf')).toBe('report.pdf');
  });

  it('falls back when the name is blank', () => {
    expect(withExtension('   ', '.zip')).toBe('output.zip');
  });

  it('handles a name that only differs by extension', () => {
    expect(withExtension('pages', '.zip')).toBe('pages.zip');
  });
});

describe('buildZip', () => {
  it('round trips its entries', () => {
    // Delivery needs a DOM or the desktop shell, but the archive itself is
    // pure, so it is built separately and checked here.
    const zip = buildZip([
      { name: 'doc-page-001.pdf', bytes: new Uint8Array([1, 2, 3]) },
      { name: 'doc-page-002.pdf', bytes: new Uint8Array([4, 5]) },
    ]);

    const unzipped = unzipSync(zip);

    expect(Object.keys(unzipped).sort()).toEqual([
      'doc-page-001.pdf',
      'doc-page-002.pdf',
    ]);
    expect(unzipped['doc-page-001.pdf']).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('keeps the names the CLI would use', () => {
    const zip = buildZip([
      { name: 'scan-page-001.pdf', bytes: new Uint8Array([1]) },
    ]);

    expect(Object.keys(unzipSync(zip))).toEqual(['scan-page-001.pdf']);
  });

  it('handles an empty list', () => {
    expect(Object.keys(unzipSync(buildZip([])))).toEqual([]);
  });
});
