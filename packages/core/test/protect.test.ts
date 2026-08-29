import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import { protectPdfBytes } from '../src/bytes/protect.js';
import { unlockPdfBytes } from '../src/bytes/unlock.js';
import { protectPdf } from '../src/protect.js';
import { unlockPdf } from '../src/unlock.js';
import {
  type PageSize,
  makeTestPdf,
  pageSizesOf,
  pageSizesOfBytes,
} from './helpers.js';

// Distinct sizes act as identity tags, so a round trip proves the pages came
// back intact rather than merely counting them.
const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
];

const PASSWORD = 'open-sesame';
const OWNER = 'the-owner';

/**
 * Whether pdf-lib refuses to load these bytes because they are encrypted.
 *
 * pdf-lib is the oracle here on purpose. It cannot write encryption, so it has
 * no stake in LibPDF being right, and a refusal from an independent library is
 * real evidence that the output is genuinely protected.
 */
async function isEncryptedToPdfLib(bytes: Uint8Array): Promise<boolean> {
  try {
    await PDFDocument.load(bytes);
    return false;
  } catch (error) {
    return /encrypted/i.test(error instanceof Error ? error.message : '');
  }
}

describe('protectPdfBytes', () => {
  it('produces a document pdf-lib refuses as encrypted', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
    });

    expect(await isEncryptedToPdfLib(locked)).toBe(true);
  });

  it('returns bytes, touching no filesystem', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
    });

    expect(locked).toBeInstanceOf(Uint8Array);
  });

  it('accepts an owner password alone', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      ownerPassword: OWNER,
    });

    expect(await isEncryptedToPdfLib(locked)).toBe(true);
  });

  it('refuses a document that is already protected', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
    });

    await expect(
      protectPdfBytes(locked, { userPassword: 'another' })
    ).rejects.toThrow(/already protected/);
  });

  it('rejects being given no password at all', async () => {
    await expect(protectPdfBytes(await makeTestPdf(SIZES), {})).rejects.toThrow(
      /user password, an owner password, or both/
    );
  });

  it('rejects an empty password as no password', async () => {
    await expect(
      protectPdfBytes(await makeTestPdf(SIZES), { userPassword: '' })
    ).rejects.toThrow(/user password, an owner password, or both/);
  });

  it('rejects an algorithm it cannot write', async () => {
    await expect(
      protectPdfBytes(await makeTestPdf(SIZES), {
        userPassword: PASSWORD,
        // Deliberately outside the union, which is what a CLI flag can hand us.
        algorithm: 'AES-512' as never,
      })
    ).rejects.toThrow(/algorithm must be one of/);
  });

  it('rejects a permission it does not know', async () => {
    await expect(
      protectPdfBytes(await makeTestPdf(SIZES), {
        userPassword: PASSWORD,
        permissions: { shred: false } as never,
      })
    ).rejects.toThrow(/does not know the permission "shred"/);
  });

  it('rejects a permission that is not a boolean', async () => {
    await expect(
      protectPdfBytes(await makeTestPdf(SIZES), {
        userPassword: PASSWORD,
        permissions: { copy: 'no' } as never,
      })
    ).rejects.toThrow(/"copy" to be true or false/);
  });

  it('rejects anything that is not a Uint8Array', async () => {
    await expect(
      protectPdfBytes('not bytes' as never, { userPassword: PASSWORD })
    ).rejects.toThrow(/Uint8Array/);
  });
});

describe('unlockPdfBytes', () => {
  it('restores a document pdf-lib can read, pages intact', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
    });

    const opened = await unlockPdfBytes(locked, PASSWORD);

    expect(await isEncryptedToPdfLib(opened)).toBe(false);
    expect(await pageSizesOfBytes(opened)).toEqual(SIZES);
  });

  it('accepts the owner password too', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
      ownerPassword: OWNER,
    });

    expect(await pageSizesOfBytes(await unlockPdfBytes(locked, OWNER))).toEqual(
      SIZES
    );
  });

  it('refuses a wrong password rather than writing an unreadable file', async () => {
    // The trap this guards: LibPDF's loader accepts a wrong password and
    // reports it through isAuthenticated. Saving from there produces a file
    // that looks fine and whose contents cannot be recovered.
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
    });

    await expect(unlockPdfBytes(locked, 'wrong')).rejects.toThrow(
      /password was not accepted/
    );
  });

  it('refuses an empty password on a document that needs one', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
    });

    await expect(unlockPdfBytes(locked, '')).rejects.toThrow(
      /password was not accepted/
    );
  });

  it('says so plainly when the document is not protected', async () => {
    await expect(
      unlockPdfBytes(await makeTestPdf(SIZES), PASSWORD)
    ).rejects.toThrow(/is not protected/);
  });

  it('rejects anything that is not a Uint8Array', async () => {
    await expect(
      unlockPdfBytes('not bytes' as never, PASSWORD)
    ).rejects.toThrow(/Uint8Array/);
  });

  it('rejects a password that is not a string', async () => {
    const locked = await protectPdfBytes(await makeTestPdf(SIZES), {
      userPassword: PASSWORD,
    });

    await expect(unlockPdfBytes(locked, 42 as never)).rejects.toThrow(
      /password as a string/
    );
  });
});

describe('protectPdf and unlockPdf', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('writes a protected copy and reads it back through unlock', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    const locked = join(dir, 'locked.pdf');
    const opened = join(dir, 'opened.pdf');
    await writeFile(source, await makeTestPdf(SIZES));

    await protectPdf(source, { userPassword: PASSWORD }, locked);
    await unlockPdf(locked, PASSWORD, opened);

    expect(await pageSizesOf(opened)).toEqual(SIZES);
  });

  it('leaves the input untouched', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    const locked = join(dir, 'locked.pdf');
    await writeFile(source, await makeTestPdf(SIZES));

    await protectPdf(source, { userPassword: PASSWORD }, locked);

    expect(await pageSizesOf(source)).toEqual(SIZES);
  });

  it('refuses to write a protected file over its own input', async () => {
    // Worth its own test: the output cannot be opened without the password,
    // so overwriting the source here is the one unrecoverable mistake.
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    await writeFile(source, await makeTestPdf(SIZES));

    await expect(
      protectPdf(source, { userPassword: PASSWORD }, source)
    ).rejects.toThrow(/refuses to overwrite an input file/);
  });

  it('refuses to write an unlocked file over its own input', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    const locked = join(dir, 'locked.pdf');
    await writeFile(source, await makeTestPdf(SIZES));
    await protectPdf(source, { userPassword: PASSWORD }, locked);

    await expect(unlockPdf(locked, PASSWORD, locked)).rejects.toThrow(
      /refuses to overwrite an input file/
    );
  });

  it('leaves no output file behind when the password is wrong', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    const locked = join(dir, 'locked.pdf');
    const opened = join(dir, 'opened.pdf');
    await writeFile(source, await makeTestPdf(SIZES));
    await protectPdf(source, { userPassword: PASSWORD }, locked);

    await expect(unlockPdf(locked, 'wrong', opened)).rejects.toThrow(
      /password was not accepted/
    );
    // The check runs before anything is written, so no half file is left.
    await expect(stat(opened)).rejects.toThrow();
  });
});
