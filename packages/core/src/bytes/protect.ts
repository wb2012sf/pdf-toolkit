import { assert } from './assert.js';
import { libpdf } from './libpdf.js';

/** Encryption algorithms LibPDF can write. */
export type EncryptionAlgorithm = 'RC4-40' | 'RC4-128' | 'AES-128' | 'AES-256';

const ALGORITHMS: readonly EncryptionAlgorithm[] = [
  'RC4-40',
  'RC4-128',
  'AES-128',
  'AES-256',
];

/**
 * What a reader is allowed to do with a protected document.
 *
 * These are the PDF permission bits, named rather than numbered. Every one
 * defaults to allowed, so a caller only names what it wants to forbid. They
 * are advisory: a reader that ignores them is not prevented from doing so by
 * anything in the file.
 */
export interface PdfPermissions {
  print: boolean;
  printHighQuality: boolean;
  modify: boolean;
  copy: boolean;
  annotate: boolean;
  fillForms: boolean;
  accessibility: boolean;
  assemble: boolean;
}

const PERMISSION_NAMES: readonly (keyof PdfPermissions)[] = [
  'print',
  'printHighQuality',
  'modify',
  'copy',
  'annotate',
  'fillForms',
  'accessibility',
  'assemble',
];

/** How to protect a document. At least one password is required. */
export interface ProtectOptions {
  /** Required to open the document at all. */
  userPassword?: string;
  /**
   * Grants full rights, lifting the permissions below for whoever has it.
   *
   * In a PDF it is also what authorises changing the protection in place, but
   * this package never does that: protecting an already protected document is
   * refused, so the way to change it here is unlock and then protect again.
   */
  ownerPassword?: string;
  /** Permissions to forbid. Anything not named stays allowed. */
  permissions?: Partial<PdfPermissions>;
  /** Defaults to AES-256, the strongest LibPDF writes. */
  algorithm?: EncryptionAlgorithm;
}

/**
 * Encrypt a document with a password.
 *
 * This is the first operation here that runs on LibPDF rather than pdf-lib,
 * because pdf-lib cannot write encryption at all. See the engine note in
 * CLAUDE.md: one operation, one engine, never both in the same file.
 */
export async function protectPdfBytes(
  input: Uint8Array,
  options: ProtectOptions
): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'protectPdfBytes requires the document as a Uint8Array'
  );
  assert(
    typeof options === 'object' && options !== null,
    'protectPdfBytes requires an options object'
  );

  const { userPassword, ownerPassword, permissions, algorithm } = options;

  for (const [name, value] of [
    ['userPassword', userPassword],
    ['ownerPassword', ownerPassword],
  ] as const) {
    assert(
      value === undefined || typeof value === 'string',
      `protectPdfBytes requires ${name} to be a string when given`
    );
  }

  // Encrypting with neither password produces a file anyone can open and
  // nobody can re-protect, which is never what the caller meant.
  assert(
    (userPassword !== undefined && userPassword.length > 0) ||
      (ownerPassword !== undefined && ownerPassword.length > 0),
    'protectPdfBytes requires a user password, an owner password, or both'
  );

  assert(
    algorithm === undefined || ALGORITHMS.includes(algorithm),
    `protectPdfBytes algorithm must be one of ${ALGORITHMS.join(', ')}, got "${String(algorithm)}"`
  );

  if (permissions !== undefined) {
    assert(
      typeof permissions === 'object' && permissions !== null,
      'protectPdfBytes requires permissions to be an object when given'
    );
    for (const [name, value] of Object.entries(permissions)) {
      assert(
        (PERMISSION_NAMES as readonly string[]).includes(name),
        `protectPdfBytes does not know the permission "${name}", expected one of ${PERMISSION_NAMES.join(', ')}`
      );
      assert(
        typeof value === 'boolean',
        `protectPdfBytes requires permission "${name}" to be true or false`
      );
    }
  }

  const { PDF } = await libpdf();
  const doc = await PDF.load(input);

  // Changing the protection on an already protected document needs owner
  // access, and quietly re-encrypting one is not what a caller asking to
  // protect a file expects. Refuse and let them unlock it first.
  assert(
    !doc.isEncrypted,
    'protectPdfBytes: the document is already protected, unlock it first'
  );

  doc.setProtection({
    ...(userPassword === undefined ? {} : { userPassword }),
    ...(ownerPassword === undefined ? {} : { ownerPassword }),
    ...(permissions === undefined ? {} : { permissions }),
    algorithm: algorithm ?? 'AES-256',
  });

  return doc.save();
}
