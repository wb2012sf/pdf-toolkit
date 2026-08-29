import { assert } from './assert.js';
import { libpdf } from './libpdf.js';

/** Something the signer noticed but carried on through. */
export interface SignatureWarning {
  /** A stable code such as CHAIN_INCOMPLETE or MDP_VIOLATION. */
  code: string;
  /** Wording meant for a person. */
  message: string;
}

/** How to sign, and what to record about why. */
export interface SignOptions {
  /** A PKCS#12 file, holding the private key and its certificate. */
  certificate: Uint8Array;
  /** The password that opens that file. */
  password: string;
  /** Recorded in the signature, such as "I approve this document". */
  reason?: string;
  /** Recorded in the signature, such as a city or an office. */
  location?: string;
  /** Recorded in the signature, such as an email address. */
  contactInfo?: string;
  /**
   * Which signature field to use.
   *
   * An existing empty field is signed if the name matches one, otherwise a
   * field is created. Left out, the first empty field is used, or a new one
   * is made. The signature is invisible either way: placing a visible one
   * needs coordinates, and this package has no way to show a page.
   */
  fieldName?: string;
}

/**
 * A signed document, and anything the signer wanted to say about it.
 *
 * Unlike every other operation here this does not simply return bytes, because
 * signing can succeed and still have something to say, with codes such as
 * MDP_VIOLATION or CHAIN_INCOMPLETE. Dropping those on the floor would hide
 * the one part of the result a caller cannot work out for itself.
 *
 * Note what is not in here: whether anyone will trust the signature. That is
 * decided by the reader against its own trust list, so a self-signed
 * certificate signs cleanly with no warnings at all and still shows as
 * "validity unknown" in Acrobat.
 */
export interface SignatureResult {
  bytes: Uint8Array;
  warnings: SignatureWarning[];
}

/**
 * Sign a document with a certificate, cryptographically rather than visually.
 *
 * Everything happens on this machine. LibPDF also ships signers backed by
 * cloud key services; they are deliberately not used here, because this
 * package promises that nothing leaves the machine it runs on.
 */
export async function signPdfBytes(
  input: Uint8Array,
  options: SignOptions
): Promise<SignatureResult> {
  assert(
    input instanceof Uint8Array,
    'signPdfBytes requires the document as a Uint8Array'
  );
  assert(
    typeof options === 'object' && options !== null,
    'signPdfBytes requires an options object'
  );
  assert(
    options.certificate instanceof Uint8Array,
    'signPdfBytes requires the certificate as a Uint8Array'
  );
  assert(
    options.certificate.length > 0,
    'signPdfBytes requires a certificate with some content'
  );
  assert(
    typeof options.password === 'string',
    'signPdfBytes requires the certificate password as a string'
  );
  for (const name of [
    'reason',
    'location',
    'contactInfo',
    'fieldName',
  ] as const) {
    const value = options[name];
    assert(
      value === undefined || typeof value === 'string',
      `signPdfBytes requires ${name} to be a string when given`
    );
  }

  const { certificate, password, reason, location, contactInfo, fieldName } =
    options;

  const { P12Signer, PDF } = await libpdf();
  const signer = await P12Signer.create(certificate, password);
  const doc = await PDF.load(input);

  const result = await doc.sign({
    signer,
    ...(reason === undefined ? {} : { reason }),
    ...(location === undefined ? {} : { location }),
    ...(contactInfo === undefined ? {} : { contactInfo }),
    ...(fieldName === undefined ? {} : { fieldName }),
  });

  return {
    bytes: result.bytes,
    warnings: result.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
    })),
  };
}
