/** The parts of a File this module needs, so tests need no File object. */
export interface NamedFile {
  readonly name: string;
  readonly type: string;
}

/** A dropped or picked selection, split into PDFs and everything else. */
export interface Partitioned<T extends NamedFile> {
  readonly pdfs: T[];
  readonly skipped: number;
}

/**
 * Whether a file looks like a PDF.
 *
 * The media type is the reliable signal, but dropping from some file managers
 * gives an empty type, so the extension is the fallback.
 */
export function isPdf(file: NamedFile): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Keep the PDFs, in order, and count what was left out. */
export function partitionPdfs<T extends NamedFile>(
  files: readonly T[]
): Partitioned<T> {
  const pdfs = files.filter(isPdf);
  return { pdfs, skipped: files.length - pdfs.length };
}

/** The trailing clause explaining what was ignored, empty when nothing was. */
export function describeSkipped(skipped: number): string {
  if (skipped <= 0) {
    return '';
  }
  return skipped === 1
    ? ', skipped 1 file that was not a PDF'
    : `, skipped ${skipped} files that were not PDFs`;
}
