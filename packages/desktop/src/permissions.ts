import type { PdfPermissions } from '@pdf-toolkit/core/bytes';

/** The permissions offered on screen, in the order they are shown. */
export const PERMISSION_LABELS: readonly [keyof PdfPermissions, string][] = [
  ['print', 'Printing'],
  ['printHighQuality', 'High resolution printing'],
  ['modify', 'Changing the contents'],
  ['copy', 'Copying text and graphics'],
  ['annotate', 'Adding annotations'],
  ['fillForms', 'Filling in form fields'],
  ['accessibility', 'Extraction for accessibility'],
  ['assemble', 'Inserting, rotating and deleting pages'],
];

/**
 * Turn a set of "allowed" checkboxes into the permissions to forbid.
 *
 * The screen shows each permission ticked, meaning allowed, because that is
 * the state a document starts in. Only the ones that came back unticked are
 * sent, so anything the user did not touch stays allowed rather than being
 * restated. Getting this inverted would silently forbid everything, which is
 * why it is a function with a test rather than a loop in the wiring.
 */
export function forbiddenPermissions(
  allowed: ReadonlyMap<keyof PdfPermissions, boolean>
): Partial<PdfPermissions> {
  const forbidden: Partial<PdfPermissions> = {};
  for (const [name, isAllowed] of allowed) {
    if (!isAllowed) {
      forbidden[name] = false;
    }
  }
  return forbidden;
}
