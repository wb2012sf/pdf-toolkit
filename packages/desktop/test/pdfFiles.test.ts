import { describe, expect, it } from 'vitest';
import {
  type NamedFile,
  describeSkipped,
  isPdf,
  partitionPdfs,
} from '../src/pdfFiles.js';

function file(name: string, type = ''): NamedFile {
  return { name, type };
}

describe('isPdf', () => {
  it('accepts the proper media type', () => {
    expect(isPdf(file('report', 'application/pdf'))).toBe(true);
  });

  it('accepts a .pdf name when the browser reports no type', () => {
    // Dropping from some file managers gives an empty type.
    expect(isPdf(file('report.pdf'))).toBe(true);
  });

  it('accepts an uppercase extension', () => {
    expect(isPdf(file('REPORT.PDF'))).toBe(true);
  });

  it('rejects other files', () => {
    expect(isPdf(file('notes.txt', 'text/plain'))).toBe(false);
  });

  it('rejects a name that merely contains pdf', () => {
    expect(isPdf(file('pdf-notes.txt', 'text/plain'))).toBe(false);
  });
});

describe('partitionPdfs', () => {
  it('keeps the PDFs in the order given', () => {
    const result = partitionPdfs([
      file('b.pdf'),
      file('notes.txt', 'text/plain'),
      file('a.pdf'),
    ]);

    expect(result.pdfs.map((f) => f.name)).toEqual(['b.pdf', 'a.pdf']);
  });

  it('counts what it left out', () => {
    const result = partitionPdfs([
      file('a.pdf'),
      file('notes.txt', 'text/plain'),
      file('sheet.xlsx', 'application/vnd.ms-excel'),
    ]);

    expect(result.skipped).toBe(2);
  });

  it('handles an empty selection', () => {
    expect(partitionPdfs([])).toEqual({ pdfs: [], skipped: 0 });
  });
});

describe('describeSkipped', () => {
  it('says nothing when nothing was skipped', () => {
    expect(describeSkipped(0)).toBe('');
  });

  it('reads naturally for one file', () => {
    expect(describeSkipped(1)).toBe(', skipped 1 file that was not a PDF');
  });

  it('reads naturally for several', () => {
    expect(describeSkipped(3)).toBe(', skipped 3 files that were not PDFs');
  });
});
