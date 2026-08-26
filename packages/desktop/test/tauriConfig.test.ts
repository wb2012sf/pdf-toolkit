import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function config(): Promise<Record<string, never>> {
  const text = await readFile(
    join(ROOT, 'src-tauri', 'tauri.conf.json'),
    'utf8'
  );
  return JSON.parse(text);
}

/**
 * Settings in tauri.conf.json that are not obvious and would be easy to drop.
 *
 * The file is strict JSON, so it cannot carry a comment saying why, and none
 * of this shows up until someone runs the built app on Windows.
 */
describe('the tauri window config', () => {
  it('leaves drag and drop to the page', async () => {
    // With Tauri's own handling on, the webview swallows file drops at the OS
    // level and the page's drop event never fires, so the drop zones look
    // broken in the app while working fine in a browser.
    const app = (await config()).app as unknown as {
      windows: { dragDropEnabled?: boolean }[];
    };

    expect(app.windows[0]?.dragDropEnabled).toBe(false);
  });

  it('has a product name without spaces', async () => {
    // productName becomes the exe name, the installer file name and the
    // release asset name. A space there is sanitised into a dot by GitHub
    // and percent encoded in the download URL, so it is avoided rather than
    // worked around. The window title is separate and stays readable.
    const name = (await config()).productName as unknown as string;

    expect(name).not.toMatch(/\s/);
  });

  it('keeps a readable window title', async () => {
    const app = (await config()).app as unknown as {
      windows: { title?: string }[];
    };

    expect(app.windows[0]?.title).toBe('PDF Toolkit');
  });

  it('keeps a content security policy', async () => {
    const app = (await config()).app as unknown as {
      security: { csp?: string | null };
    };

    expect(app.security.csp).toBeTruthy();
  });

  it('matches the version the package reports', async () => {
    // The release workflow refuses to publish when the tag disagrees with
    // this; keeping it level with package.json avoids the surprise.
    const declared = (await config()).version as unknown as string;
    const pkg = JSON.parse(
      await readFile(join(ROOT, 'package.json'), 'utf8')
    ) as { version: string };

    expect(declared).toBe(pkg.version);
  });
});
