import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * main.ts looks elements up by id and throws when one is missing. That only
 * shows up when the page is opened, and nothing else in the suite runs a
 * browser, so a rename in the markup would otherwise reach the user first.
 */
describe('the page and the script agree on element ids', () => {
  it('every id main.ts asks for exists in index.html', async () => {
    const script = await readFile(join(ROOT, 'src', 'main.ts'), 'utf8');
    const html = await readFile(join(ROOT, 'index.html'), 'utf8');

    const wanted = [
      ...script.matchAll(/element<[^>]+>\('([^']+)'\)/g),
      // Drop zones are looked up the same way, by id, inside createFileDrop.
      ...script.matchAll(/createFileDrop\('([^']+)'/g),
    ].map((match) => match[1] as string);
    expect(wanted.length).toBeGreaterThan(0);

    const present = new Set(
      [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1] as string)
    );

    expect(wanted.filter((id) => !present.has(id))).toEqual([]);
  });

  it('every drop zone has the parts createFileDrop expects', async () => {
    // It looks for a file input, a button and a .chosen element inside the
    // zone, and throws when any is missing.
    const script = await readFile(join(ROOT, 'src', 'main.ts'), 'utf8');
    const html = await readFile(join(ROOT, 'index.html'), 'utf8');

    const zoneIds = [...script.matchAll(/createFileDrop\('([^']+)'/g)].map(
      (match) => match[1] as string
    );
    expect(zoneIds.length).toBeGreaterThan(0);

    const incomplete: string[] = [];
    for (const id of zoneIds) {
      const zone = html.match(
        new RegExp(`<div[^>]*id="${id}"[\\s\\S]*?</div>`)
      )?.[0];
      if (zone === undefined) {
        incomplete.push(`${id} is missing`);
        continue;
      }
      if (!zone.includes('type="file"')) incomplete.push(`${id} has no input`);
      if (!zone.includes('<button')) incomplete.push(`${id} has no button`);
      if (!zone.includes('class="chosen"'))
        incomplete.push(`${id} has no .chosen`);
    }

    expect(incomplete).toEqual([]);
  });

  it('every tab has a panel, and the script knows every tab', async () => {
    // show() hides `panel-${name}` for each name in OPERATIONS, so a tab with
    // no panel does nothing when clicked and a panel absent from OPERATIONS
    // is never hidden again once shown. Neither is visible from any other
    // test, since nothing here runs a browser.
    const script = await readFile(join(ROOT, 'src', 'main.ts'), 'utf8');
    const html = await readFile(join(ROOT, 'index.html'), 'utf8');

    const tabs = [...html.matchAll(/data-op="([^"]+)"/g)].map(
      (match) => match[1] as string
    );
    const panels = [...html.matchAll(/id="panel-([^"]+)"/g)].map(
      (match) => match[1] as string
    );
    const listed = (
      script.match(/const OPERATIONS = \[([\s\S]*?)\] as const;/)?.[1] ?? ''
    )
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
      .filter((entry) => entry.length > 0);

    expect(tabs.length).toBeGreaterThan(0);
    expect([...tabs].sort()).toEqual([...panels].sort());
    expect([...listed].sort()).toEqual([...tabs].sort());
  });

  it('never lets a display rule defeat the hidden attribute', async () => {
    // How the tabs broke once: .panel was given display:grid, and an author
    // display rule beats the browser's own [hidden] { display: none }. Every
    // panel stayed on screen at once and switching tabs did nothing visible.
    // Nothing else catches it, since the markup and the script are both fine.
    //
    // Limited to classes the markup itself marks hidden. A class hidden only
    // from TypeScript would slip through, so keep display rules off those.
    const css = await readFile(join(ROOT, 'src', 'style.css'), 'utf8');
    const html = await readFile(join(ROOT, 'index.html'), 'utf8');

    // Every class the markup ever marks hidden. Asking per class rather than
    // parsing the whole stylesheet, because the @media block's nested braces
    // defeat any simple rule splitter and quietly make this check vacuous.
    const hiddenClasses = new Set<string>();
    for (const tag of html.matchAll(/<[^>]*\bhidden\b[^>]*>/g)) {
      const classes = (tag[0] as string).match(/class="([^"]*)"/);
      for (const name of (classes?.[1] ?? '').split(/\s+/)) {
        if (name.length > 0) {
          hiddenClasses.add(name);
        }
      }
    }
    expect(hiddenClasses.size).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const name of hiddenClasses) {
      const rule = css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
      const display = rule?.[1]?.match(/display\s*:\s*([a-z-]+)/);
      if (display === undefined || display === null) {
        continue;
      }
      if (display[1] !== 'none' && !css.includes(`.${name}[hidden]`)) {
        offenders.push(
          `.${name} sets display:${display[1]} but has no .${name}[hidden] override`
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the markup loads the script and the stylesheet', async () => {
    const html = await readFile(join(ROOT, 'index.html'), 'utf8');

    expect(html).toContain('src="./src/main.ts"');
    expect(html).toContain('href="./src/style.css"');
  });

  it('main.ts talks to the engine through the bytes layer only', async () => {
    // Importing the filesystem entry point would drag node:fs into the
    // bundle and break the page.
    const script = await readFile(join(ROOT, 'src', 'main.ts'), 'utf8');

    expect(script).toContain("from '@pdf-toolkit/core/bytes'");
    expect(script).not.toMatch(/from '@pdf-toolkit\/core'/);
  });
});
