import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Point at the bytes layer's TypeScript source, so the dev server and
      // the tests do not depend on packages/core having been built, and so a
      // change to an operation shows up without a rebuild step.
      '@pdf-toolkit/core/bytes': fileURLToPath(
        new URL('../core/src/bytes/index.ts', import.meta.url)
      ),
    },
  },
  build: {
    // Tauri serves these as files, so keep paths relative rather than
    // absolute from a web root.
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  base: './',
});
