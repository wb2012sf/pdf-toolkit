import assert from 'node:assert';
import { glob, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

/** How to order the resolved files. */
export type SortMode = 'name' | 'name-desc';

/** `*`, `?` and `[...]` are the wildcards a shell would expand. */
const WILDCARD = /[*?[\]]/;

/**
 * Rewrite each letter as a character class, so `*.pdf` also finds `A.PDF`.
 *
 * Node's glob has no case-insensitive option, and doing it by hand would mean
 * reimplementing the matcher. This delegates all the real work to fs.glob.
 */
function ignoreCase(pattern: string): string {
  let out = '';
  let inClass = false;

  for (const char of pattern) {
    if (char === '[') {
      inClass = true;
      out += char;
    } else if (char === ']') {
      inClass = false;
      out += char;
    } else if (/[a-zA-Z]/.test(char)) {
      const pair = `${char.toLowerCase()}${char.toUpperCase()}`;
      // Inside an existing class both letters are just more members of it.
      // Wrapping them in another class would nest, which does not match.
      out += inClass ? pair : `[${pair}]`;
    } else {
      out += char;
    }
  }

  return out;
}

/** Plain string compare, matching what a shell expansion would give. */
function byName(left: string, right: string): number {
  const a = basename(left);
  const b = basename(right);
  if (a !== b) {
    return a < b ? -1 : 1;
  }
  // Same file name in different directories, keep the result stable.
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Expand one wildcard pattern within its own directory.
 *
 * `exclude` drops the destination, so `merge *.pdf -o merged.pdf` does not
 * fold its own previous output back in when run a second time.
 */
async function expand(
  pattern: string,
  exclude: string | undefined
): Promise<string[]> {
  const directory = dirname(pattern);
  const name = basename(pattern);
  assert(
    !directory.includes('**') && !name.includes('**'),
    `recursive patterns are not supported, "${pattern}" would need to walk subdirectories`
  );

  const matches: string[] = [];
  for await (const entry of glob(ignoreCase(name), { cwd: directory })) {
    const path = join(directory, entry);
    if (exclude !== undefined && resolve(path) === resolve(exclude)) {
      continue;
    }
    // A directory can match *.pdf; merging one is never what was meant.
    const info = await stat(path);
    if (info.isFile()) {
      matches.push(path);
    }
  }

  assert(matches.length > 0, `"${pattern}" matched no files`);

  return matches.sort(byName);
}

/**
 * Turn command line file arguments into a concrete, ordered list of paths.
 *
 * An argument containing `*`, `?` or `[...]` is expanded here, which is what
 * makes wildcards work in PowerShell and cmd, neither of which expands them
 * for the program the way a POSIX shell does. Anything else is passed through
 * untouched, including a path that does not exist, so the operation itself
 * can report it with a message that names the operation.
 *
 * Ordering: an expansion is always sorted, since directory order is not
 * meaningful, while explicitly listed files keep the order they were typed
 * unless `sort` says otherwise. Comparison is a plain string compare on the
 * file name, so `page10.pdf` precedes `page2.pdf`, matching a shell.
 */
export async function resolveInputs(
  args: string[],
  sort?: SortMode,
  exclude?: string
): Promise<string[]> {
  assert(
    Array.isArray(args) && args.length > 0,
    'resolveInputs requires at least one file or pattern'
  );

  const resolved: string[] = [];
  let expanded = false;

  for (const arg of args) {
    assert(
      typeof arg === 'string' && arg.length > 0,
      'resolveInputs requires every file or pattern to be a non-empty string'
    );

    if (WILDCARD.test(arg)) {
      resolved.push(...(await expand(arg, exclude)));
      expanded = true;
    } else {
      resolved.push(arg);
    }
  }

  if (sort !== undefined) {
    assert(
      sort === 'name' || sort === 'name-desc',
      `--sort accepts name or name-desc, got "${sort}"`
    );
    resolved.sort(byName);
    if (sort === 'name-desc') {
      resolved.reverse();
    }
  } else if (expanded && args.length > 1) {
    // A single pattern is already sorted by expand. With several arguments
    // the pieces still need ordering relative to each other.
    resolved.sort(byName);
  }

  return resolved;
}
