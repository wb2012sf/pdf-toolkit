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
./bootstrap.sh                          # first-time setup
npm test --workspaces --if-present      # run all tests
npm run build --workspaces --if-present
npm run lint --workspaces --if-present
```

## TDD in practice
`packages/core/src/merge.ts` and `packages/core/test/merge.test.ts` are the
template: a stub that asserts its inputs and throws "not implemented", plus a
test that already defines what correct looks like. That test is red right now.
Making it green, without weakening it, is the first task. Every other
operation (split, insert, delete, reorder, rotate, extract) follows the same
shape: stub with asserts, test first, then implement.

## Definition of done for v1
- merge, split, insert, delete, reorder, rotate, extract all implemented in
  `packages/core`, each with a vitest test written before the implementation
- `packages/cli` exposes each operation as a subcommand
- every command defaults to non-destructive output
- `npm audit` clean at moderate level or above
