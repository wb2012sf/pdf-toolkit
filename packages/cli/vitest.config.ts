import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Run the CLI tests against core's TypeScript sources so the suite does
    // not depend on packages/core having been built first.
    //
    // The array form matters: aliases match by prefix, so the bare
    // '@pdf-toolkit/core' entry would otherwise rewrite
    // '@pdf-toolkit/core/bytes' into '.../src/index.ts/bytes'. Listing the
    // subpath first, with a regex anchored to the end, keeps them apart.
    alias: [
      {
        find: /^@pdf-toolkit\/core\/bytes$/,
        replacement: fileURLToPath(
          new URL('../core/src/bytes/index.ts', import.meta.url)
        ),
      },
      {
        find: /^@pdf-toolkit\/core$/,
        replacement: fileURLToPath(
          new URL('../core/src/index.ts', import.meta.url)
        ),
      },
    ],
  },
});
