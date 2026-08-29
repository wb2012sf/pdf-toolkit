import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { signPdfBytes } from '../src/bytes/sign.js';
import { signPdf } from '../src/sign.js';
import { makeTestPdf } from './helpers.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const CERTIFICATE = join(FIXTURES, 'test-signing.p12');
const CERT_PASSWORD = 'test';

async function certificate(): Promise<Uint8Array> {
  return readFile(CERTIFICATE);
}

/** The document as one latin1 string, for looking at PDF structure directly. */
function asText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

describe('signPdfBytes', () => {
  it('writes a signature dictionary into the document', async () => {
    const { bytes } = await signPdfBytes(await makeTestPdf([[200, 201]]), {
      certificate: await certificate(),
      password: CERT_PASSWORD,
    });

    const text = asText(bytes);
    expect(text).toContain('/Type /Sig');
    expect(text).toContain('/Filter /Adobe.PPKLite');
    // PAdES rather than the legacy adbe.pkcs7.detached.
    expect(text).toContain('/SubFilter /ETSI.CAdES.detached');
    expect(text).toMatch(/\/ByteRange\s*\[/);
  });

  it('puts the signature in a real form field, not a drawing', async () => {
    const { bytes } = await signPdfBytes(await makeTestPdf([[200, 201]]), {
      certificate: await certificate(),
      password: CERT_PASSWORD,
    });

    expect(asText(bytes)).toContain('/FT /Sig');
    expect(asText(bytes)).toContain('/AcroForm');
  });

  it('records the reason and location it was given', async () => {
    const { bytes } = await signPdfBytes(await makeTestPdf([[200, 201]]), {
      certificate: await certificate(),
      password: CERT_PASSWORD,
      reason: 'I approve this document',
      location: 'Bern',
    });

    const text = asText(bytes);
    expect(text).toContain('/Reason (I approve this document)');
    expect(text).toContain('/Location (Bern)');
  });

  it('signs into a field with the name it was given', async () => {
    const { bytes } = await signPdfBytes(await makeTestPdf([[200, 201]]), {
      certificate: await certificate(),
      password: CERT_PASSWORD,
      fieldName: 'ApprovedBy',
    });

    expect(asText(bytes)).toContain('ApprovedBy');
  });

  it('leaves the original untouched, signing a copy', async () => {
    const original = await makeTestPdf([[200, 201]]);
    const before = original.slice();

    await signPdfBytes(original, {
      certificate: await certificate(),
      password: CERT_PASSWORD,
    });

    expect(Array.from(original)).toEqual(Array.from(before));
  });

  it('carries a warnings channel, empty for a clean signature', async () => {
    // Signing a self-signed certificate raises nothing: the signer has no
    // complaint, and whether a reader trusts the certificate is decided by
    // the reader, not reported here. The channel exists for what the signer
    // does report, such as MDP_VIOLATION, so it is surfaced rather than
    // dropped.
    const { warnings } = await signPdfBytes(await makeTestPdf([[200, 201]]), {
      certificate: await certificate(),
      password: CERT_PASSWORD,
    });

    expect(warnings).toEqual([]);
  });

  it('refuses a wrong certificate password', async () => {
    await expect(
      signPdfBytes(await makeTestPdf([[200, 201]]), {
        certificate: await certificate(),
        password: 'not-the-password',
      })
    ).rejects.toThrow();
  });

  it('refuses something that is not a certificate', async () => {
    await expect(
      signPdfBytes(await makeTestPdf([[200, 201]]), {
        certificate: new Uint8Array([1, 2, 3]),
        password: CERT_PASSWORD,
      })
    ).rejects.toThrow();
  });

  it('rejects an empty certificate', async () => {
    await expect(
      signPdfBytes(await makeTestPdf([[200, 201]]), {
        certificate: new Uint8Array(),
        password: CERT_PASSWORD,
      })
    ).rejects.toThrow(/certificate with some content/);
  });

  it('rejects a certificate that is not a Uint8Array', async () => {
    await expect(
      signPdfBytes(await makeTestPdf([[200, 201]]), {
        certificate: 'a path, not bytes' as never,
        password: CERT_PASSWORD,
      })
    ).rejects.toThrow(/certificate as a Uint8Array/);
  });

  it('rejects a document that is not a Uint8Array', async () => {
    await expect(
      signPdfBytes('not bytes' as never, {
        certificate: await certificate(),
        password: CERT_PASSWORD,
      })
    ).rejects.toThrow(/document as a Uint8Array/);
  });
});

describe('signPdf', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('signs a file on disk and returns the warnings', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    const signed = join(dir, 'signed.pdf');
    await writeFile(source, await makeTestPdf([[200, 201]]));

    const warnings = await signPdf(
      source,
      { certificatePath: CERTIFICATE, password: CERT_PASSWORD },
      signed
    );

    expect(asText(await readFile(signed))).toContain('/Type /Sig');
    expect(warnings).toEqual([]);
  });

  it('leaves the input untouched', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    const signed = join(dir, 'signed.pdf');
    const original = await makeTestPdf([[200, 201]]);
    await writeFile(source, original);

    await signPdf(
      source,
      { certificatePath: CERTIFICATE, password: CERT_PASSWORD },
      signed
    );

    expect(Array.from(await readFile(source))).toEqual(Array.from(original));
  });

  it('refuses to write over its own input', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    await writeFile(source, await makeTestPdf([[200, 201]]));

    await expect(
      signPdf(
        source,
        { certificatePath: CERTIFICATE, password: CERT_PASSWORD },
        source
      )
    ).rejects.toThrow(/refuses to overwrite an input file/);
  });

  it('reports a certificate path that does not exist', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'in.pdf');
    const signed = join(dir, 'signed.pdf');
    await writeFile(source, await makeTestPdf([[200, 201]]));

    await expect(
      signPdf(
        source,
        { certificatePath: join(dir, 'missing.p12'), password: 'x' },
        signed
      )
    ).rejects.toThrow(/ENOENT|no such file/i);
  });
});
