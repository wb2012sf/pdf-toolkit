import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../src/program.js';

type PageSize = [number, number];

const SIZES: PageSize[] = [
  [200, 201],
  [202, 203],
  [204, 205],
  [206, 207],
  [208, 209],
];

async function makeTestPdf(sizes: PageSize[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const size of sizes) {
    doc.addPage(size);
  }
  return doc.save();
}

async function pageSizesOf(path: string): Promise<PageSize[]> {
  const doc = await PDFDocument.load(await readFile(path));
  return doc
    .getPages()
    .map(
      (page): PageSize => [
        Math.round(page.getWidth()),
        Math.round(page.getHeight()),
      ]
    );
}

async function rotationsOf(path: string): Promise<number[]> {
  const doc = await PDFDocument.load(await readFile(path));
  return doc.getPages().map((page) => page.getRotation().angle);
}

/** Run the CLI as a user would type it, without letting commander exit. */
async function run(...argv: string[]): Promise<void> {
  const program = buildProgram();
  program.exitOverride();
  program.configureOutput({
    writeOut: () => undefined,
    writeErr: () => undefined,
  });
  await program.parseAsync(argv, { from: 'user' });
}

describe('pdf-toolkit CLI', () => {
  let dir: string | undefined;
  let docPath: string;
  let otherPath: string;
  let outPath: string;

  async function fixture(): Promise<void> {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-cli-'));
    docPath = join(dir, 'doc.pdf');
    otherPath = join(dir, 'other.pdf');
    outPath = join(dir, 'out.pdf');
    await writeFile(docPath, await makeTestPdf(SIZES));
    await writeFile(otherPath, await makeTestPdf([[500, 501]]));
  }

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('exposes a subcommand for every operation', () => {
    const names = buildProgram()
      .commands.map((command) => command.name())
      .sort();

    expect(names).toEqual([
      'delete',
      'extract',
      'insert',
      'merge',
      'protect',
      'reorder',
      'rotate',
      'split',
      'unlock',
    ]);
  });

  it('merges files in the order given', async () => {
    await fixture();

    await run('merge', docPath, otherPath, '--output', outPath);

    expect(await pageSizesOf(outPath)).toEqual([...SIZES, [500, 501]]);
  });

  it('expands a wildcard, which PowerShell does not do for us', async () => {
    await fixture();
    const merged = join(dir as string, 'merged.pdf');

    await run('merge', join(dir as string, '*.pdf'), '--output', merged);

    // doc.pdf then other.pdf, sorted by name.
    expect(await pageSizesOf(merged)).toEqual([...SIZES, [500, 501]]);
  });

  it('reverses the inputs with --sort name-desc', async () => {
    await fixture();
    const merged = join(dir as string, 'merged.pdf');

    await run(
      'merge',
      join(dir as string, '*.pdf'),
      '--sort',
      'name-desc',
      '--output',
      merged
    );

    expect(await pageSizesOf(merged)).toEqual([[500, 501], ...SIZES]);
  });

  it('rejects an unknown sort mode', async () => {
    await fixture();

    await expect(
      run('merge', docPath, '--sort', 'size', '--output', outPath)
    ).rejects.toThrow(/name or name-desc/);
  });

  it('reports a wildcard that matches nothing', async () => {
    await fixture();

    await expect(
      run('merge', join(dir as string, '*.docx'), '--output', outPath)
    ).rejects.toThrow(/matched no files/);
  });

  it('splits into one file per page', async () => {
    await fixture();
    const outDir = join(dir as string, 'burst');

    await run('split', docPath, '--output-dir', outDir);

    expect((await readdir(outDir)).sort()).toEqual([
      'doc-page-001.pdf',
      'doc-page-002.pdf',
      'doc-page-003.pdf',
      'doc-page-004.pdf',
      'doc-page-005.pdf',
    ]);
  });

  it('deletes the pages named by a range spec', async () => {
    await fixture();

    await run('delete', docPath, '--pages', '2-3', '--output', outPath);

    expect(await pageSizesOf(outPath)).toEqual([SIZES[0], SIZES[3], SIZES[4]]);
  });

  it('inserts one document into another at a position', async () => {
    await fixture();

    await run('insert', docPath, otherPath, '--at', '2', '--output', outPath);

    expect(await pageSizesOf(outPath)).toEqual([
      SIZES[0],
      [500, 501],
      SIZES[1],
      SIZES[2],
      SIZES[3],
      SIZES[4],
    ]);
  });

  it('reorders pages', async () => {
    await fixture();

    await run('reorder', docPath, '--order', '5-1', '--output', outPath);

    expect(await pageSizesOf(outPath)).toEqual([...SIZES].reverse());
  });

  it('rotates the whole document by default', async () => {
    await fixture();

    await run('rotate', docPath, '--degrees', '90', '--output', outPath);

    expect(await rotationsOf(outPath)).toEqual([90, 90, 90, 90, 90]);
  });

  it('rotates only the selected pages', async () => {
    await fixture();

    await run(
      'rotate',
      docPath,
      '--degrees',
      '-90',
      '--pages',
      '2,4',
      '--output',
      outPath
    );

    expect(await rotationsOf(outPath)).toEqual([0, 270, 0, 270, 0]);
  });

  it('extracts pages in the order requested', async () => {
    await fixture();

    await run('extract', docPath, '--pages', '4,1', '--output', outPath);

    expect(await pageSizesOf(outPath)).toEqual([SIZES[3], SIZES[0]]);
  });

  it('writes a new file and leaves the input alone by default', async () => {
    await fixture();

    await run('delete', docPath, '--pages', '1', '--output', outPath);

    expect(await pageSizesOf(docPath)).toEqual(SIZES);
  });

  it('overwrites the input only when --in-place is passed', async () => {
    await fixture();

    await run('delete', docPath, '--pages', '1', '--in-place');

    expect(await pageSizesOf(docPath)).toEqual(SIZES.slice(1));
  });

  it('leaves no temporary files behind after --in-place', async () => {
    await fixture();

    await run('rotate', docPath, '--degrees', '90', '--in-place');

    expect((await readdir(dir as string)).sort()).toEqual([
      'doc.pdf',
      'other.pdf',
    ]);
  });

  it('leaves the input intact when an --in-place run fails', async () => {
    await fixture();

    await expect(
      run('delete', docPath, '--pages', '9', '--in-place')
    ).rejects.toThrow(/out of range/);

    expect(await pageSizesOf(docPath)).toEqual(SIZES);
    expect((await readdir(dir as string)).sort()).toEqual([
      'doc.pdf',
      'other.pdf',
    ]);
  });

  it('requires either --output or --in-place', async () => {
    await fixture();

    await expect(run('delete', docPath, '--pages', '1')).rejects.toThrow(
      /--output <file>.*--in-place/s
    );
  });

  it('rejects --output together with --in-place', async () => {
    await fixture();

    await expect(
      run('delete', docPath, '--pages', '1', '--output', outPath, '--in-place')
    ).rejects.toThrow(/not both/);
  });

  it('reports a bad page spec against the flag that carried it', async () => {
    await fixture();

    await expect(
      run('extract', docPath, '--pages', '1,nope', '--output', outPath)
    ).rejects.toThrow(/--pages value "nope" is not a page number/);
  });

  it('rejects a rotation that is not a multiple of 90', async () => {
    await fixture();

    await expect(
      run('rotate', docPath, '--degrees', '45', '--output', outPath)
    ).rejects.toThrow(/multiple of 90/);
  });

  it('rejects a non-numeric insert position', async () => {
    await fixture();

    await expect(
      run('insert', docPath, otherPath, '--at', 'x', '--output', outPath)
    ).rejects.toThrow(/--at/);
  });
  it('protects a PDF and unlocks it again', async () => {
    await fixture();
    const lockedPath = join(dir as string, 'locked.pdf');

    await run(
      'protect',
      docPath,
      '--password',
      'hunter2',
      '--output',
      lockedPath
    );
    // pdf-lib is the oracle: it cannot write encryption, so a refusal from it
    // is independent evidence the file really is protected.
    await expect(pageSizesOf(lockedPath)).rejects.toThrow(/encrypted/i);

    await run(
      'unlock',
      lockedPath,
      '--password',
      'hunter2',
      '--output',
      outPath
    );
    expect(await pageSizesOf(outPath)).toEqual(SIZES);
  });

  it('forbids a permission when asked, leaving the rest alone', async () => {
    await fixture();
    const lockedPath = join(dir as string, 'locked.pdf');

    await run(
      'protect',
      docPath,
      '--password',
      'pw',
      '--no-copy',
      '--output',
      lockedPath
    );

    await run('unlock', lockedPath, '--password', 'pw', '--output', outPath);
    expect(await pageSizesOf(outPath)).toEqual(SIZES);
  });

  it('rejects protect with no password of either kind', async () => {
    await fixture();

    await expect(run('protect', docPath, '--output', outPath)).rejects.toThrow(
      /--password, --owner-password, or both/
    );
  });

  it('rejects an algorithm it cannot write', async () => {
    await fixture();

    await expect(
      run(
        'protect',
        docPath,
        '--password',
        'pw',
        '--algorithm',
        'ROT13',
        '--output',
        outPath
      )
    ).rejects.toThrow(/algorithm must be one of/);
  });

  it('rejects unlocking with the wrong password', async () => {
    await fixture();
    const lockedPath = join(dir as string, 'locked.pdf');
    await run(
      'protect',
      docPath,
      '--password',
      'right',
      '--output',
      lockedPath
    );

    await expect(
      run('unlock', lockedPath, '--password', 'wrong', '--output', outPath)
    ).rejects.toThrow(/password was not accepted/);
  });
});
