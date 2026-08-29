import { assert } from './assert.js';
import { libpdf } from './libpdf.js';

/**
 * Remove password protection, given a password that opens the document.
 *
 * Either password works. The owner password is the one that grants the right
 * to change protection in the first place, but a document opened with the
 * user password can still be saved without encryption, which is what this
 * does.
 *
 * The password is checked against the document rather than assumed: LibPDF's
 * loader accepts a wrong password and reports it through `isAuthenticated`
 * instead of throwing, and saving from that state writes a file whose
 * contents cannot be read back. This refuses instead.
 */
export async function unlockPdfBytes(
  input: Uint8Array,
  password: string
): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'unlockPdfBytes requires the document as a Uint8Array'
  );
  // An empty password is legitimate: a document may carry an owner password
  // only, which leaves the user password empty and the document openable.
  assert(
    typeof password === 'string',
    'unlockPdfBytes requires the password as a string'
  );

  const { PDF } = await libpdf();
  const doc = await PDF.load(input, { credentials: password });

  assert(
    doc.isEncrypted,
    'unlockPdfBytes: the document is not protected, there is nothing to remove'
  );
  // The load above succeeds whatever password it was given, so this is the
  // only thing standing between a typo and an unreadable output file.
  assert(
    doc.isAuthenticated,
    'unlockPdfBytes: the password was not accepted for this document'
  );

  doc.removeProtection();
  return doc.save();
}
