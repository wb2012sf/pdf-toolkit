import { assert } from './assert.js';

/** Parse one `N` or `N-M` entry, appending the pages it names. */
function parseEntry(entry: string, label: string, into: number[]): void {
  const trimmed = entry.trim();
  assert(
    trimmed.length > 0,
    `${label} has an empty page entry, check for a stray comma in the list`
  );

  const bounds = trimmed.split('-');
  assert(
    bounds.length <= 2,
    `${label} value "${trimmed}" is not a page range, write it as N or N-M`
  );

  const parsed = bounds.map((bound) => {
    const value = bound.trim();
    assert(
      /^\d+$/.test(value),
      `${label} value "${trimmed}" is not a page number`
    );
    const page = Number(value);
    assert(
      page >= 1,
      `${label} value "${trimmed}" is not 1-based, pages start at 1`
    );
    return page;
  });

  const [first, last] = parsed;
  assert(first !== undefined, `${label} value "${trimmed}" is empty`);
  if (last === undefined || last === first) {
    into.push(first);
    return;
  }

  // Ranges run in the direction they are written, so 7-5 reverses.
  const step = last > first ? 1 : -1;
  for (let page = first; page !== last + step; page += step) {
    into.push(page);
  }
}

/**
 * Parse a page specification such as `1,3,5-7` into 1-based page numbers.
 *
 * Pages come back in the order written, repeats included, because the core
 * operations disagree about what a repeat means: extract copies the page
 * twice, delete ignores the repeat, reorder rejects it. Deciding here would
 * take that choice away from them. `label` only shapes error messages: the CLI passes a flag name, the UI
 * passes a field name.
 */
export function parsePageSpec(spec: string, label: string): number[] {
  assert(
    typeof spec === 'string' && spec.trim().length > 0,
    `${label} requires at least one page number`
  );

  const pages: number[] = [];
  for (const entry of spec.split(',')) {
    parseEntry(entry, label, pages);
  }
  return pages;
}
