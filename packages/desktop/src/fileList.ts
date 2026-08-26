/** One PDF the user has picked, held in memory. */
export interface PickedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** Which way `sortByName` orders the list. */
export type SortDirection = 'asc' | 'desc';

/**
 * Reordering helpers for the merge list.
 *
 * Every one returns a new array rather than mutating, so the caller can treat
 * the list as state it replaces, and an out of range index is a no-op rather
 * than an error: these come from clicks on a list that may have changed.
 */

/** Swap an entry with the one above it. */
export function moveUp(files: PickedFile[], index: number): PickedFile[] {
  if (index <= 0 || index >= files.length) {
    return files.slice();
  }
  const next = files.slice();
  const above = next[index - 1] as PickedFile;
  const current = next[index] as PickedFile;
  next[index - 1] = current;
  next[index] = above;
  return next;
}

/** Swap an entry with the one below it. */
export function moveDown(files: PickedFile[], index: number): PickedFile[] {
  if (index < 0 || index >= files.length - 1) {
    return files.slice();
  }
  return moveUp(files, index + 1);
}

/** Drop the entry at the index. */
export function removeAt(files: PickedFile[], index: number): PickedFile[] {
  if (index < 0 || index >= files.length) {
    return files.slice();
  }
  return files.filter((_, position) => position !== index);
}

/**
 * Order by file name.
 *
 * A plain string comparison, deliberately the same as the CLI's `--sort`, so
 * `scan10.pdf` comes before `scan2.pdf` in both places rather than the two
 * disagreeing about what "by name" means.
 */
export function sortByName(
  files: PickedFile[],
  direction: SortDirection
): PickedFile[] {
  const sorted = files
    .slice()
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    );
  return direction === 'desc' ? sorted.reverse() : sorted;
}

/** A file name without its .pdf extension, whatever case that was in. */
export function stemOf(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

/**
 * The default file name to save a merge under.
 *
 * Deliberately not derived from the inputs. Naming it after the first file
 * privileges an arbitrary one of several, and a name that changes as you add
 * and remove files is harder to predict than one that does not. The save
 * dialog is where the real choice happens.
 */
export function suggestOutputName(_files: PickedFile[]): string {
  return 'merged.pdf';
}
