import { zipSync } from 'fflate';

/**
 * Handing results back to the user.
 *
 * These are the only functions that know how the result leaves the app. Under
 * Tauri they become the native save dialog and a folder write, and nothing
 * else has to change.
 */

/** Ensure a name ends with the extension, without doubling it. */
export function withExtension(name: string, extension: string): string {
  const trimmed = name.trim();
  const fallback = `output${extension}`;
  if (trimmed.length === 0) {
    return fallback;
  }
  return trimmed.toLowerCase().endsWith(extension.toLowerCase())
    ? trimmed
    : `${trimmed}${extension}`;
}

/** Offer a single file to the user as a download. */
export function saveBytes(
  bytes: Uint8Array,
  name: string,
  type = 'application/pdf'
): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Offer many files as one zip.
 *
 * A page cannot write a folder, and firing one download per page makes the
 * browser prompt or throttle, so split hands over a single archive instead.
 */
export function saveZip(
  entries: { name: string; bytes: Uint8Array }[],
  name: string
): void {
  const contents: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    contents[entry.name] = entry.bytes;
  }
  // level 0: PDFs are already compressed, so deflating them again costs time
  // and saves almost nothing.
  const zipped = zipSync(contents, { level: 0 });
  saveBytes(zipped, name, 'application/zip');
}
