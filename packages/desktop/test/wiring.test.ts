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

    const wanted = [...script.matchAll(/element<[^>]+>\('([^']+)'\)/g)].map(
      (match) => match[1] as string
    );
    expect(wanted.length).toBeGreaterThan(0);

    const present = new Set(
      [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1] as string)
    );

    expect(wanted.filter((id) => !present.has(id))).toEqual([]);
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
