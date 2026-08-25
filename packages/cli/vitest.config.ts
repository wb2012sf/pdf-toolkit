import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Run the CLI tests against core's TypeScript sources so the suite does
      // not depend on packages/core having been built first.
      '@pdf-toolkit/core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url)
      ),
    },
  },
});
