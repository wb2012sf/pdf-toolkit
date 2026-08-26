import { describe, expect, it } from 'vitest';
import {
  type PickedFile,
  moveDown,
  moveUp,
  removeAt,
  sortByName,
  suggestOutputName,
} from '../src/fileList.js';

/** Bytes are irrelevant to ordering, so keep them minimal and distinct. */
function file(name: string): PickedFile {
  return { name, bytes: new Uint8Array([name.length]) };
}

const LIST = [file('b.pdf'), file('a.pdf'), file('c.pdf')];

function names(files: PickedFile[]): string[] {
  return files.map((f) => f.name);
}

describe('moveUp', () => {
  it('swaps an entry with the one above it', () => {
    expect(names(moveUp(LIST, 1))).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('leaves the first entry alone rather than wrapping', () => {
    expect(names(moveUp(LIST, 0))).toEqual(names(LIST));
  });

  it('does not mutate the list it was given', () => {
    const before = names(LIST);
    moveUp(LIST, 2);
    expect(names(LIST)).toEqual(before);
  });

  it('ignores an index past the end', () => {
    expect(names(moveUp(LIST, 9))).toEqual(names(LIST));
  });
});

describe('moveDown', () => {
  it('swaps an entry with the one below it', () => {
    expect(names(moveDown(LIST, 0))).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('leaves the last entry alone rather than wrapping', () => {
    expect(names(moveDown(LIST, 2))).toEqual(names(LIST));
  });

  it('does not mutate the list it was given', () => {
    const before = names(LIST);
    moveDown(LIST, 0);
    expect(names(LIST)).toEqual(before);
  });
});

describe('removeAt', () => {
  it('drops the entry at the index', () => {
    expect(names(removeAt(LIST, 1))).toEqual(['b.pdf', 'c.pdf']);
  });

  it('ignores an index that is not there', () => {
    expect(names(removeAt(LIST, 9))).toEqual(names(LIST));
  });

  it('does not mutate the list it was given', () => {
    const before = names(LIST);
    removeAt(LIST, 0);
    expect(names(LIST)).toEqual(before);
  });
});

describe('sortByName', () => {
  it('sorts ascending', () => {
    expect(names(sortByName(LIST, 'asc'))).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('sorts descending', () => {
    expect(names(sortByName(LIST, 'desc'))).toEqual([
      'c.pdf',
      'b.pdf',
      'a.pdf',
    ]);
  });

  it('compares as plain strings, matching the CLI', () => {
    // scan10 before scan2, the same surprise the CLI documents.
    const scans = [file('scan2.pdf'), file('scan10.pdf'), file('scan1.pdf')];

    expect(names(sortByName(scans, 'asc'))).toEqual([
      'scan1.pdf',
      'scan10.pdf',
      'scan2.pdf',
    ]);
  });

  it('does not mutate the list it was given', () => {
    const before = names(LIST);
    sortByName(LIST, 'desc');
    expect(names(LIST)).toEqual(before);
  });
});

describe('suggestOutputName', () => {
  // Deliberately not derived from the first file. With several inputs the
  // "first" one is an arbitrary thing to name the result after, and a plain
  // name is easier to predict.
  it('is the same whatever the files are called', () => {
    expect(suggestOutputName(LIST)).toBe('merged.pdf');
  });

  it('does not vary with a single file either', () => {
    expect(suggestOutputName([file('Report.PDF')])).toBe('merged.pdf');
  });

  it('is the same for an empty list', () => {
    expect(suggestOutputName([])).toBe('merged.pdf');
  });
});
