import assert from 'node:assert';

/** Parse one `N` or `N-M` entry, appending the pages it names. */
function parseEntry(entry: string, flagName: string, into: number[]): void {
  const trimmed = entry.trim();
  assert(
    trimmed.length > 0,
    `${flagName} has an empty page entry, check for a stray comma in the list`
  );

  const bounds = trimmed.split('-');
  assert(
    bounds.length <= 2,
    `${flagName} value "${trimmed}" is not a page range, write it as N or N-M`
  );

  const parsed = bounds.map((bound) => {
    const value = bound.trim();
    assert(
      /^\d+$/.test(value),
      `${flagName} value "${trimmed}" is not a page number`
    );
    const page = Number(value);
    assert(
      page >= 1,
      `${flagName} value "${trimmed}" is not 1-based, pages start at 1`
    );
    return page;
  });

  const [first, last] = parsed;
  assert(first !== undefined, `${flagName} value "${trimmed}" is empty`);
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
 * Parse a CLI page specification such as `1,3,5-7` into 1-based page numbers.
 *
 * Pages come back in the order written, repeats included, because the core
 * operations disagree about what a repeat means: extract copies the page
 * twice, delete ignores the repeat, reorder rejects it. Deciding here would
 * take that choice away from them. `flagName` only shapes error messages.
 */
export function parsePageSpec(spec: string, flagName: string): number[] {
  assert(
    typeof spec === 'string' && spec.trim().length > 0,
    `${flagName} requires at least one page number`
  );

  const pages: number[] = [];
  for (const entry of spec.split(',')) {
    parseEntry(entry, flagName, pages);
  }
  return pages;
}
