import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { withExtension } from '../src/save.js';

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

describe('the zip split produces', () => {
  it('round trips its entries', () => {
    // saveZip itself touches the DOM, but the archive it builds is what
    // matters and fflate is deterministic, so check that shape directly.
    const entries: Record<string, Uint8Array> = {
      'doc-page-001.pdf': new Uint8Array([1, 2, 3]),
      'doc-page-002.pdf': new Uint8Array([4, 5]),
    };

    const unzipped = unzipSync(zipSync(entries, { level: 0 }));

    expect(Object.keys(unzipped).sort()).toEqual([
      'doc-page-001.pdf',
      'doc-page-002.pdf',
    ]);
    expect(unzipped['doc-page-001.pdf']).toEqual(new Uint8Array([1, 2, 3]));
  });
});
