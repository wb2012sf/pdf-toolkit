import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveInputs } from '../src/inputs.js';

describe('resolveInputs', () => {
  let dir: string | undefined;

  // Built with path.join so the tests read the same on Windows, where the
  // separator differs and path.dirname behaves differently.
  async function fixture(names: string[]): Promise<void> {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-inputs-'));
    for (const name of names) {
      await writeFile(join(dir, name), '');
    }
  }

  function at(name: string): string {
    return join(dir as string, name);
  }

  /** Compare by file name only, so paths stay readable in assertions. */
  function names(paths: string[]): string[] {
    return paths.map((path) => basename(path));
  }

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('passes literal paths through untouched, in the order given', async () => {
    await fixture(['b.pdf', 'a.pdf']);

    const resolved = await resolveInputs([at('b.pdf'), at('a.pdf')]);

    expect(names(resolved)).toEqual(['b.pdf', 'a.pdf']);
  });

  it('expands a wildcard to the matching files', async () => {
    await fixture(['a.pdf', 'b.pdf', 'notes.txt']);

    const resolved = await resolveInputs([at('*.pdf')]);

    expect(names(resolved)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('sorts an expansion lexically, so page10 precedes page2', async () => {
    await fixture(['page1.pdf', 'page2.pdf', 'page10.pdf']);

    const resolved = await resolveInputs([at('*.pdf')]);

    expect(names(resolved)).toEqual(['page1.pdf', 'page10.pdf', 'page2.pdf']);
  });

  it('matches the pattern case-insensitively', async () => {
    await fixture(['lower.pdf', 'UPPER.PDF', 'Mixed.Pdf']);

    const resolved = await resolveInputs([at('*.pdf')]);

    expect(names(resolved).sort()).toEqual([
      'Mixed.Pdf',
      'UPPER.PDF',
      'lower.pdf',
    ]);
  });

  it('honours a question mark wildcard', async () => {
    await fixture(['p1.pdf', 'p2.pdf', 'p10.pdf']);

    const resolved = await resolveInputs([at('p?.pdf')]);

    expect(names(resolved)).toEqual(['p1.pdf', 'p2.pdf']);
  });

  it('sorts descending when asked', async () => {
    await fixture(['a.pdf', 'b.pdf', 'c.pdf']);

    const resolved = await resolveInputs([at('*.pdf')], 'name-desc');

    expect(names(resolved)).toEqual(['c.pdf', 'b.pdf', 'a.pdf']);
  });

  it('sorts explicitly listed files when a sort is given', async () => {
    await fixture(['b.pdf', 'a.pdf']);

    const resolved = await resolveInputs([at('b.pdf'), at('a.pdf')], 'name');

    expect(names(resolved)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('mixes literals and patterns, sorting the whole list together', async () => {
    await fixture(['a.pdf', 'c.pdf', 'zz.pdf']);

    const resolved = await resolveInputs(
      [at('zz.pdf'), at('[ac].pdf')],
      'name'
    );

    expect(names(resolved)).toEqual(['a.pdf', 'c.pdf', 'zz.pdf']);
  });

  it('keeps the typed order for literals when no sort is given', async () => {
    await fixture(['a.pdf', 'b.pdf', 'c.pdf']);

    const resolved = await resolveInputs([at('c.pdf'), at('a.pdf')]);

    expect(names(resolved)).toEqual(['c.pdf', 'a.pdf']);
  });

  it('keeps a repeated file, rather than collapsing it', async () => {
    await fixture(['a.pdf']);

    const resolved = await resolveInputs([at('a.pdf'), at('a.pdf')]);

    expect(names(resolved)).toEqual(['a.pdf', 'a.pdf']);
  });

  it('fails clearly when a pattern matches nothing', async () => {
    await fixture(['a.pdf']);

    await expect(resolveInputs([at('*.docx')])).rejects.toThrow(
      /matched no files/
    );
  });

  it('names the pattern that matched nothing', async () => {
    await fixture(['a.pdf']);

    await expect(resolveInputs([at('nope*.pdf')])).rejects.toThrow(/nope\*/);
  });

  it('does not treat a missing literal path as a pattern', async () => {
    await fixture(['a.pdf']);

    // No wildcard, so it is passed through and left for the core operation
    // to report, which knows the operation name and gives a better message.
    const resolved = await resolveInputs([at('missing.pdf')]);

    expect(names(resolved)).toEqual(['missing.pdf']);
  });

  it('ignores directories that happen to match', async () => {
    await fixture(['a.pdf']);
    await mkdir(join(dir as string, 'nested.pdf'));

    const resolved = await resolveInputs([at('*.pdf')]);

    expect(names(resolved)).toEqual(['a.pdf']);
  });

  it('rejects a recursive pattern rather than silently ignoring it', async () => {
    await fixture(['a.pdf']);

    await expect(
      resolveInputs([join(dir as string, '**', '*.pdf')])
    ).rejects.toThrow(/recursive/);
  });

  it('omits the destination from an expansion', async () => {
    // Otherwise `merge *.pdf -o merged.pdf` folds its own previous output
    // back in on the second run.
    await fixture(['a.pdf', 'b.pdf', 'merged.pdf']);

    const resolved = await resolveInputs(
      [at('*.pdf')],
      undefined,
      at('merged.pdf')
    );

    expect(names(resolved)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('compares the destination by resolved path, not by spelling', async () => {
    await fixture(['a.pdf', 'merged.pdf']);

    const resolved = await resolveInputs(
      [at('*.pdf')],
      undefined,
      join(dir as string, '.', 'merged.pdf')
    );

    expect(names(resolved)).toEqual(['a.pdf']);
  });

  it('keeps a file named explicitly even when it is the destination', async () => {
    // Listing it by hand is unambiguous, so leave the refusal to the
    // operation, which says plainly that it will not overwrite an input.
    await fixture(['a.pdf']);

    const resolved = await resolveInputs([at('a.pdf')], undefined, at('a.pdf'));

    expect(names(resolved)).toEqual(['a.pdf']);
  });

  it('fails when the destination was the only match', async () => {
    await fixture(['merged.pdf']);

    await expect(
      resolveInputs([at('*.pdf')], undefined, at('merged.pdf'))
    ).rejects.toThrow(/matched no files/);
  });

  it('rejects an empty argument list', async () => {
    await expect(resolveInputs([])).rejects.toThrow(/at least one file/);
  });
});
