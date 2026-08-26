import { zipSync } from 'fflate';

/**
 * Handing results back to the user.
 *
 * Two ways out, chosen at runtime. In the desktop app a native save dialog
 * picks the path and Rust writes the file, because a webview will not run a
 * blob download. Served in a browser, the blob download is all there is.
 *
 * Nothing else in the app knows which is in play.
 */

/** A file type offered in the native save dialog. */
export interface SaveKind {
  readonly extension: 'pdf' | 'zip';
  readonly label: string;
}

export const PDF: SaveKind = { extension: 'pdf', label: 'PDF' };
export const ZIP: SaveKind = { extension: 'zip', label: 'Zip archive' };

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

/** Build the zip a split hands back. */
export function buildZip(
  entries: { name: string; bytes: Uint8Array }[]
): Uint8Array {
  const contents: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    contents[entry.name] = entry.bytes;
  }
  // level 0: PDFs are already compressed, so deflating again costs time and
  // saves almost nothing.
  return zipSync(contents, { level: 0 });
}

/** Whether the page is running inside the desktop shell. */
function inTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

const MEDIA_TYPES: Record<SaveKind['extension'], string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
};

/** Offer the bytes as a download, the only route a plain browser has. */
function download(bytes: Uint8Array, name: string, kind: SaveKind): void {
  const blob = new Blob([bytes as BlobPart], {
    type: MEDIA_TYPES[kind.extension],
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Write the bytes wherever the user chooses.
 *
 * Returns the name or path written, or undefined if the native dialog was
 * cancelled, so the caller can report accurately rather than claiming a save
 * that did not happen.
 */
export async function saveBytes(
  bytes: Uint8Array,
  name: string,
  kind: SaveKind = PDF
): Promise<string | undefined> {
  if (!inTauri()) {
    download(bytes, name, kind);
    return name;
  }

  // Imported here rather than at the top so a browser build never loads the
  // desktop plugins, and vite can split them into their own chunk.
  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const path = await save({
    defaultPath: name,
    filters: [{ name: kind.label, extensions: [kind.extension] }],
  });
  if (path === null) {
    return undefined;
  }

  await writeFile(path, bytes);
  return path;
}
