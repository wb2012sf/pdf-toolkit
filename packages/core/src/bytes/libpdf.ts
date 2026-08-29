/**
 * Load LibPDF on demand.
 *
 * Every operation that needs it goes through here rather than importing it at
 * the top of the file, and the reason is the browser bundle. A static import
 * anywhere in this layer puts LibPDF in the main chunk, so a page that only
 * ever merges two documents still pays for the encryption, forms and signing
 * code. Importing it dynamically lets the bundler split it out, and the four
 * operations that need it pull it in the first time one of them runs.
 *
 * The module is cached after the first call, by the module system rather than
 * by anything here, so calling this per operation costs nothing after the
 * first.
 *
 * pdf-lib stays a static import in the page operations. It is the smaller
 * half and every one of those operations needs it immediately, so deferring
 * it would buy nothing.
 */
export async function libpdf(): Promise<typeof import('@libpdf/core')> {
  return import('@libpdf/core');
}
