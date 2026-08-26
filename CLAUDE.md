# PDF Toolkit

## What this is
A CLI tool for page-level PDF manipulation: merge, split, insert, delete, reorder,
rotate, extract. Later phases add a web app and a Tauri-based Windows desktop app
that reuse the same core engine. This is not a Preview clone yet, page operations
only.

## Explicitly out of scope for v1
- Password-protected / encrypted PDFs
- Digital signatures
- Annotations, form filling, OCR

Revisit encryption and signatures in v2 with LibPDF (`@libpdf/core`), not pdf-lib.
Do not add `qpdf` or any crypto-handling dependency during v1.

## Stack
- TypeScript, strict mode, no `any`
- Node.js 24 (see `.nvmrc`), don't rely on Node 22-only or Node 26-only APIs
- npm workspaces monorepo (`packages/core`, `packages/cli`)
- Core engine: `pdf-lib`
- CLI: `commander`
- Tests: `vitest`
- Lint/format: Biome (single tool, single config, fast). Only add ESLint+Prettier
  if Biome hits a real limitation, don't run both.

## Conventions
- Every exported function has explicit parameter and return types.
- Validate all external input (file paths, page ranges, CLI flags) at the boundary
  with `assert` from `node:assert`. Fail loudly with a clear message. Don't let bad
  input reach pdf-lib silently.
- TDD: write the failing vitest test before the implementation, for every function
  in `packages/core`.
- Non-destructive by default: every command writes to a new output file unless
  `--in-place` is explicitly passed. Never silently overwrite the input file.
- No em dashes anywhere: code comments, commit messages, CLI output, docs.

## Repo layout
```
packages/core   pure functions wrapping pdf-lib, no CLI/IO concerns beyond
                reading/writing file paths passed in as arguments
packages/cli    thin commander wrapper, one subcommand per core function
```
`package-lock.json` is the lockfile of record. Always commit it. Run
`npm audit --audit-level=moderate` before any release.

## Environment
- Primary dev loop: this VPS. Claude Code runs here headless (auth via
  `claude setup-token`, not a browser login).
- Git is the sync path to Windows: push here, pull on Windows/WSL only when
  testing a Tauri build or producing the Windows executable. Don't attempt to
  build the `.exe` from this VPS.
- Keep Claude Code's write access scoped to this project directory if this VPS
  runs anything else.

## Commands
```
./bootstrap.sh       # first-time setup
npm test             # typecheck then run all tests
npm run build        # core first, then cli
npm run typecheck    # typecheck src and tests without running them
npm run lint         # biome check across the monorepo
npm run format       # biome check --write, applies safe fixes
npm run audit        # npm audit at moderate and above
```

## TDD in practice
Every operation followed the same shape and any new one should too: write a
stub that asserts its inputs and throws "not implemented", write the test that
defines what correct looks like, watch it fail, then implement. Do not weaken
a test to make it pass. `packages/core/src/merge.ts` with its test is the
template to copy.

Validation is tiered, which keeps failures specific. Argument shape is checked
in the stub's asserts, anything needing only the arguments (integer page
numbers, the overwrite guard) runs before the file is read, and anything
needing the document (page ranges, permutation completeness) runs after it
loads. A bad call therefore fails before doing partial work.

Two things worth knowing before writing fixtures:
- pdf-lib cannot produce a zero page PDF. Saving a page-less document emits a
  file that loads back with one page. Use `emptyPagePdf()` from
  `packages/core/test/helpers.ts`, which is hand rolled for that reason.
- Give fixture pages distinct sizes and assert the exact sequence. Asserting
  page counts alone lets a wrong page order pass.

## Definition of done for v1
All four are met as of 2026-08-25.
- [x] merge, split, insert, delete, reorder, rotate, extract implemented in
  `packages/core`, each with a vitest test written before the implementation
- [x] `packages/cli` exposes each operation as a subcommand
- [x] every command defaults to non-destructive output, `--in-place` is opt in
- [x] `npm audit` clean at moderate level or above

Beyond that list the repo also has Biome wired up, tests covered by the
typecheck, and GitHub Actions running build, test, lint, a CLI smoke check and
audit on every push plus weekly.

## Known gaps
- The CLI suite resolves core through a vitest alias to its TypeScript
  sources, so it never exercises the compiled binary. CI covers that with a
  separate smoke step; keep it if the workflow is ever rewritten.

## Next up
Not started, and explicitly out of scope for v1: the web app and the Tauri
desktop app.

### Core cannot be reused as it stands
The plan was that both front ends would reuse `packages/core` unchanged. They
cannot. Every operation takes file paths and imports `node:fs/promises`, so
none of them run in a browser, and none run in a Tauri webview either, which
is a browser and not Node. This is the decision that gates both phases, so
settle it before writing any UI.

Two ways out:

1. **Split core into a bytes layer.** Each operation becomes a pure
   `Uint8Array` in, `Uint8Array` out function, with today's path based
   signature kept as a thin fs wrapper that the CLI keeps calling. The 76
   core tests stay meaningful, the CLI does not change, and the browser runs
   pdf-lib directly: no server, no upload, PDFs never leave the machine, and
   the web app deploys as static files. One refactor serves both the web app
   and Tauri.
2. **A Node server calling core as-is.** No core changes today, but it needs
   upload and download, temp file lifecycle and cleanup, request size limits,
   and a process running somewhere. PDFs travel over the network. Tauri would
   still need option 1 later, so this defers the work rather than avoiding it.

Option 1 is the recommendation. Do not write a second browser only copy of
the operations: two implementations of the same seven operations will drift,
which is the exact thing sharing an engine was meant to prevent.

### Tauri needs more than Node
Building the Windows executable also needs the Rust toolchain, Microsoft C++
Build Tools, and the WebView2 runtime, which ships with Windows 11. That is
on top of Node, and it is why the `.exe` is built on Windows rather than
here. See the note in Environment above.
