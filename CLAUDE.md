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

Revisit these in v2 with LibPDF (`@libpdf/core`), not pdf-lib. It covers four
of the five, OCR being the exception. See **v2 groundwork** at the end of this
file for what was verified and in what order it is worth doing.
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
  - Exception: `packages/core/src/bytes/` uses its own `assert` from
    `./assert.js`, same contract, no builtin. A bundler externalizes `node:`
    imports for the browser, so `node:assert` there would break the page at
    runtime. `test/bytes-purity.test.ts` fails if any `node:` import appears
    in that directory.
- TDD: write the failing vitest test before the implementation, for every function
  in `packages/core`.
- Non-destructive by default: every command writes to a new output file unless
  `--in-place` is explicitly passed. Never silently overwrite the input file.
- No em dashes anywhere: code comments, commit messages, CLI output, docs.

## Repo layout
```
packages/core        the engine, in two layers
packages/core/src/bytes   Uint8Array in, Uint8Array out. No filesystem, no
                          node: imports, so it runs in a browser or a Tauri
                          webview. Import as `@pdf-toolkit/core/bytes`.
packages/core/src/*.ts    filesystem wrappers over that layer: validate path
                          arguments, refuse to overwrite an input, read and
                          write. Import as `@pdf-toolkit/core`.
packages/cli         thin commander wrapper, one subcommand per operation
packages/desktop     Vite plus vanilla TypeScript, no UI framework. Talks to
                     the bytes layer only.
packages/desktop/src-tauri  the Tauri shell: window, native save dialog, file
                     write. No custom commands, the operations all run in the
                     webview.
```
Add an operation in the bytes layer and wrap it, never the other way round,
and never a second copy of the logic for a front end.
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

## Desktop shell notes
Things that only show up in the built app, never in `npm run dev`:
- `dragDropEnabled: false` in `tauri.conf.json` is load bearing. With Tauri's
  own drag and drop handling on, the webview swallows file drops before the
  page sees them, so every drop zone silently does nothing while working fine
  in a browser. `test/tauriConfig.test.ts` guards it, since strict JSON cannot
  hold a comment saying so.
- Saving is the only code path that differs between the app and the browser.
  `src/save.ts` picks at runtime; nothing else knows.

## Known gaps
- The CLI suite resolves core through a vitest alias to its TypeScript
  sources, so it never exercises the compiled binary. CI covers that with a
  separate smoke step; keep it if the workflow is ever rewritten.

## Next up
Both of these were out of scope for v1. The Tauri desktop app has since been
built and shipped, and the rest of this section records how. The web app has
not been built, and it is optional rather than a prerequisite; see the note
further down. Nothing here is scheduled, so treat new work as new scope.

### The bytes layer is done
Core used to be filesystem only, which would have blocked both front ends: a
Tauri webview is a browser, not Node. That is resolved. All seven operations
now exist as `Uint8Array` in, `Uint8Array` out functions under
`packages/core/src/bytes/`, with the original path based API kept as thin
wrappers, so the CLI is unchanged and its tests never moved.

A front end therefore needs no server, no upload, and no second copy of the
logic:

```ts
import { mergePdfBytes, splitPdfBytes } from '@pdf-toolkit/core/bytes';
```

`pageFileName` is exported alongside them so a browser download names split
pages exactly as the CLI does.

The desktop app was planned in three steps. The first two are done and the
third is deferred, so nothing here is outstanding:
1. ~~A UI against the bytes layer.~~ Done: `packages/desktop` is a merge
   screen, `npm run dev` to work on it. Vanilla TypeScript deliberately, so
   the shipped bundle carries no framework; ordering logic lives in
   `src/fileList.ts` where it is tested without a browser, and `src/main.ts`
   is glue.
2. ~~The Tauri shell around it.~~ Done: `npm run tauri:dev` for the window,
   `npm run tauri:build` for the installer. `src/save.ts` decides at runtime
   between the native save dialog and a blob download, and it is the only
   file that knows the difference.
3. Command line mode in the same binary, so `pdf-toolkit merge ...` still
   works for anyone who prefers typing. Tauri v2 has a CLI plugin for
   parsing the arguments. **Deferred on 2026-08-29, no date to revisit.** The
   Node CLI in `packages/cli` already covers the actual use, so the only gain
   would be dropping the Node prerequisite, and that did not justify two
   costs. The engine is JavaScript in the webview and there must never be a
   second copy of it in Rust, so this mode would have to boot a hidden webview
   to do the work. Worse, `main.rs` sets `windows_subsystem = "windows"` in
   release builds, so the process has no console and anything it prints is
   lost in PowerShell; the ways round that (AttachConsole, a separate console
   shim next to the GUI binary, or exit codes only) each cost something and
   none have been tried on Windows. Settle that behaviour on Windows first if
   this is ever picked up.

The shell cannot be built on this VPS: no Rust toolchain, no webview
libraries, no passwordless sudo. The **Desktop build** workflow compiles it on
a Windows runner instead, by hand or on a `v*` tag rather than per push, since
Windows runner minutes are expensive. That job is the only automated check the
Rust side gets.

All seven operations are in the UI, one tab each. Split returns a zip, since
a page cannot write a folder; under Tauri that becomes a native folder picker
and the fflate dependency can go.

The page spec parser lives in `packages/core/src/bytes/pages.ts` so the CLI
and the UI share it. `packages/cli/src/pages.ts` is only a re-export.

The web app is now optional rather than a prerequisite: Tauri bundles the
frontend files, it does not consume a deployed site, so the same UI can ship
as a desktop app first and be published as a page later if wanted.

### Tauri needs more than Node
Building the Windows executable also needs the Rust toolchain, Microsoft C++
Build Tools, and the WebView2 runtime, which ships with Windows 11. That is
on top of Node, and it is why the `.exe` is built on Windows rather than
here. See the note in Environment above.

## v2 groundwork
Checked on 2026-08-29 against `@libpdf/core` 0.4.1, unpacked and run in a
scratchpad. Nothing was added to this repo, since v1 still forbids a crypto
handling dependency. Redo the check before relying on any of it: this is a
pre-1.0 library and the API can move.

LibPDF covers four of the five v1 exclusions. Ranked by how well each fits
what is already built, not by how interesting it is:

1. **Encryption.** The best fit, and far easier than its place on a list of
   v1 exclusions suggests. The `qpdf` ban above was a scope guard to keep v1
   finishable, not a statement that this is hard.
   RC4-40, RC4-128, AES-128 and AES-256 across revisions R2 to R6, reading and
   writing. `PDF.load(bytes, { credentials })` opens a protected file,
   `setProtection()` applies protection with user and owner passwords and
   per-flag permissions, and `isEncrypted`, `hasUserPassword` and
   `getPermissions` inspect one. No page view is involved: bytes in, a password
   and some flags from a form, bytes out, the same shape as `rotate`. One tab
   to protect, one to unlock.
2. **Form filling.** `AcroForm` with `TextField`, `Checkbox`, `RadioGroup` and
   `Dropdown`, plus flattening. Also needs no page view, because the fields
   describe themselves: `tooltip` / `alternateName` is the PDF `/TU` entry and
   is usually human readable, and `pageIndex` plus the widget rects give
   document order. That is enough to generate an ordinary HTML form. Fall back
   to the raw field name only when `/TU` is missing, since raw names look like
   `topmostSubform[0].Page1[0].f1_07[0]`.
3. **Signatures.** Signing works, confirmed end to end below.
4. **Annotations.** Twenty classes covering highlight, ink, stamp, text and the
   rest, but annotations are inherently spatial and the app has no page view.
   The exception worth knowing: `findText` returns `bbox`, `pageIndex` and
   per-character `charBoxes`, and `rectsToQuadPoints` converts those into the
   quad points a highlight needs, so "highlight every occurrence of X" works
   with no renderer at all.

**OCR is absent and cannot be bolted on.** LibPDF's seven dependencies are
`@noble/ciphers`, `@noble/hashes`, `@scure/base`, `asn1js`, `pkijs`, `pako` and
`lru-cache`. None is a recognition engine, and OCR is impossible without one.
Do not mistake `extractText` for OCR: it reads text objects already present in
the content stream and returns nothing on a scanned page.

### Signing was verified, not assumed
A self-signed `.p12` from `openssl req -x509` plus `openssl pkcs12 -export`
signed a document on the first try, no warnings. The output carried
`/Type /Sig`, `/Filter /Adobe.PPKLite`, `/SubFilter /ETSI.CAdES.detached` and a
real `/ByteRange`, in a proper AcroForm signature field rather than a drawn
stamp. Extracting the PKCS#7 blob and checking the detached CMS signature
against exactly the bytes the `/ByteRange` covers gave "CMS Verification
successful", SHA-256 with RSA throughout.

Three things that follow from that run:
- `P12Signer.create(bytes, password)` takes a plain openssl `.p12`, with no
  special provisioning, and it creates the signature field itself when the
  document has none.
- Signing is genuinely offline. Nothing touched the network, which is what the
  app's "nothing leaves this machine" tagline promises. `GoogleKmsSigner` and
  `CloudSigner` would break that promise, so prefer `P12Signer` and treat the
  others as a deliberate decision rather than a default.
- `sign()` returns a `SignResult`, not bytes. Use `result.bytes` and check
  `result.warnings`. Every operation in the current engine returns a
  `Uint8Array` directly, so this wrapper will not look like the other seven.
  For `B-LT` and `B-LTA` the result also carries `ltvData` and the caller has
  to write the DSS incremental update itself; plain `B-B` signing needs none
  of that.

### Limits to design around
- **Signature verification is not implemented.** Signing works, checking
  somebody else's signature does not. Do not promise it.
- **A self-signed certificate shows as "validity unknown" in Acrobat.** The
  signature is cryptographically real, the vouching is not. For a green check
  the certificate has to chain to the Adobe Approved Trust List or the EU
  Trusted List, which costs a few hundred a year and requires identity
  verification. Worse for us, those CAs increasingly require the private key to
  live on a hardware token, and will not hand over a downloadable `.p12` at
  all, so a file picker for `.p12` serves self-signed and internal certificates
  and not much else.
- **Certificate based encryption is unsupported.** Password encryption only.
- **LibPDF is 0.4.1.** Pre-1.0 is the real risk here, not capability.

### Open question before any of this starts
LibPDF also does merge and split, so it could replace pdf-lib outright rather
than sit beside it. Running both means every document is parsed twice by two
libraries that can disagree about a damaged file. Decide which way before
writing the first wrapper, because it determines whether v2 is an addition or
a migration.
