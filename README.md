```
██████╗ ██████╗ ███████╗        ████████╗ ██████╗  ██████╗ ██╗     ██╗  ██╗██╗████████╗
██╔══██╗██╔══██╗██╔════╝        ╚══██╔══╝██╔═══██╗██╔═══██╗██║     ██║ ██╔╝██║╚══██╔══╝
██████╔╝██║  ██║█████╗  ██████╗    ██║   ██║   ██║██║   ██║██║     █████╔╝ ██║   ██║
██╔═══╝ ██║  ██║██╔══╝  ╚═════╝    ██║   ██║   ██║██║   ██║██║     ██╔═██╗ ██║   ██║
██║     ██████╔╝██║                ██║   ╚██████╔╝╚██████╔╝███████╗██║  ██╗██║   ██║
╚═╝     ╚═════╝ ╚═╝                ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝
```

Page level PDF manipulation from the command line: merge, split, insert,
delete, reorder, rotate, extract.

Nothing is overwritten unless you say so. Every command writes to a new file
and only touches the input when `--in-place` is passed.

## Getting started

### 1. Node 24

Install the runtime first. This is a one time, machine wide step with nvm and
has nothing to do with this repository, so run it from anywhere, before you
have the code.

**macOS and Linux.** nvm-sh reads the pinned version from `.nvmrc`. If you do
not already have it, install it from <https://github.com/nvm-sh/nvm> and open
a new shell first.

```bash
nvm install    # from inside the repo, or: nvm install 24
nvm use
```

**Windows.** nvm is not part of Windows and does not come with Node, so
`nvm install` fails with *"The term 'nvm' is not recognized"* until you
install it. The Windows version is nvm-windows, a different project from the
nvm used above.

Use winget, which is built into current Windows:

```powershell
winget install CoreyButler.NVMforWindows
```

This is the route to prefer. winget resolves the package from Microsoft's
curated manifest repository and verifies its hash for you, so there is
nothing to check by hand and no browser download to get wrong.

If winget is unavailable, download from
<https://github.com/coreybutler/nvm-windows/releases/latest>. Take
`nvm-setup.zip` rather than the bare `nvm-setup.exe`: the project publishes a
checksum for the zip and not for the exe, so the zip is the one you can
actually verify before running.

```powershell
certutil -hashfile nvm-setup.zip MD5
```

Compare that against `nvm-setup.zip.checksum.txt` on the same release page,
then extract and run the installer inside. MD5 is weak against a determined
attacker, but it does catch a corrupted or substituted download. Expect
SmartScreen to warn either way; you can check the publisher through
right-click, Properties, Digital Signatures.

**Then close the shell and open a new one.** The installer edits `PATH`, and
an already open session will not see it. In a new Administrator PowerShell:

```powershell
nvm install 24.19.0
nvm use 24.19.0
```

Name the full version: nvm-windows does not read `.nvmrc`. `nvm use` writes a
symlink under `C:\Program Files\nodejs`, which is why the shell has to be
elevated, otherwise it fails with a permissions error.

If this machine only ever needs one version of Node, you can skip nvm
altogether and install Node 24 with the Windows installer from
<https://nodejs.org>. Confirm with `node -v` that you get a 24.x version;
the project requires `>=24 <25`.

### 2. Get the code

```bash
git clone https://github.com/wb2012sf/pdf-toolkit.git
cd pdf-toolkit
```

If that asks for credentials, the repository is not public to you, and the
clone needs an SSH key on the machine or `gh auth login` followed by
`gh repo clone wb2012sf/pdf-toolkit`.

### 3. Install and build

These read `package.json`, so run them from inside the repository.

**macOS and Linux**:

```bash
./bootstrap.sh   # installs dependencies
npm run build
```

**Windows**: `bootstrap.sh` is a bash script that PowerShell and cmd cannot
run, and you do not need it. It creates directories and files that are
already in the repository and then runs `npm install`, so on a fresh clone
only that last step does anything:

```powershell
npm install
npm run build
```

If you would rather use the POSIX instructions verbatim, Git Bash (bundled
with Git for Windows) and WSL both run them unchanged.

Everything after setup is an npm script and behaves the same on all three
platforms. CI runs the build, the full test suite and a CLI smoke check on
Windows as well as Linux.

### 4. Run it

There are three ways to invoke it and they all run the same program, so pick
whichever suits you. Every one of them needs `npm run build` to have run,
because they all end up at `packages/cli/dist/index.js`.

**a. From inside the repository, nothing to set up.** `npm install` already
created the shortcut:

```bash
npx pdf-toolkit merge a.pdf b.pdf -o out.pdf
```

This only works from the repository directory or a subdirectory of it. Run it
from elsewhere and npx goes looking for a published package instead, failing
with *"could not determine executable to run"*.

**b. By explicit path, from anywhere**, with no shortcut involved:

```bash
node /path/to/pdf-toolkit/packages/cli/dist/index.js merge a.pdf b.pdf -o out.pdf
```

**c. As a normal command anywhere on the machine.** One time setup, run from
the repository:

```bash
npm link -w @pdf-toolkit/cli
```

after which `pdf-toolkit` works from any directory:

```bash
pdf-toolkit merge a.pdf b.pdf -o out.pdf
```

On Windows this creates a `pdf-toolkit.cmd` shim, so it behaves the same in
PowerShell. Undo it with `npm unlink -g @pdf-toolkit/cli`.

### Troubleshooting setup

Most of these are the same thing wearing different hats: **a shell keeps the
PATH it started with.** Anything that changes PATH needs a new shell, not a
reinstall.

**`nvm : The term 'nvm' is not recognized`**

nvm-windows is not installed, or it is and this shell was already open when
it went in. Install it per step 1, then close the shell and open a new one.

**`npm` or `node` not recognized, though `nvm install` succeeded**

Installing a version does not activate it. Run `nvm use 24.19.0` in an
Administrator PowerShell, then open a new shell.

```powershell
nvm list   # the active version is marked with *
```

If nothing is marked, nothing is active, which is why there is no `node` and
no `npm`.

**`nvm use` fails with a permissions error**

It writes a symlink under `C:\Program Files\nodejs`, so the shell has to be
elevated. Run PowerShell as Administrator.

**`./bootstrap.sh` is not recognized on Windows**

It is a bash script. Use `npm install` instead, per step 3, or run
`bash bootstrap.sh` from Git Bash or WSL.

**`node -v` reports something other than 24.x**

nvm switches machine wide, so another project can leave a different version
active. `nvm list` shows what is installed and `nvm use 24.19.0` switches
back. The project requires `>=24 <25` and will refuse to install otherwise.

**`git clone` asks for credentials or fails with a permission error**

The repository is not public to you, so the clone needs to prove who you are.
Use an SSH key on that machine, or `gh auth login` followed by
`gh repo clone wb2012sf/pdf-toolkit`.

### Troubleshooting after a pull

**Anything is "not recognized", or an import cannot be resolved, right after
`git pull`**

Run `npm install`. A pull brings new source, not new dependencies, so any
commit that added one leaves the tree half updated. This has already caught
people out twice: `fflate` when split arrived, and the Tauri CLI when the
desktop shell did. Make it a habit:

```bash
git pull && npm install
```

**`'tauri' is not recognized`**

The same thing: `@tauri-apps/cli` is a dependency and needs installing. It
hoists to the repository root's `node_modules/.bin`, not into
`packages/desktop`, which is normal for a workspace and not the problem.

**`failed to run 'cargo metadata' ... program not found`**

`tauri dev` and `tauri build` compile Rust, and there is no toolchain on the
machine. You probably do not need one:

- To work on the interface, `npm run dev` runs the same screens in a browser
  with no Rust involved. Only the save differs.
- To just use the app, download an installer from the releases page rather
  than compiling your own.

If you do want the native dev loop, install both, then reopen the shell:

```powershell
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools
```

The Build Tools installer needs the **Desktop development with C++** workload
ticked; the default selection leaves out the MSVC linker Tauri links with.
Check with `cargo --version` before trying again.

**The installer is blocked by SmartScreen**

The bundles are unsigned, so Windows warns about an unrecognised publisher.
Choose "More info" then "Run anyway", or sign the bundle if this is ever
distributed to anyone else.

## Commands

Everything below is written as `pdf-toolkit`, which is form **c** from step 4.
If you have not linked, substitute one of the others, for example
`npx pdf-toolkit merge ...` from inside the repository.

```bash
pdf-toolkit merge   <inputs...>      -o <file>  [--sort name|name-desc]
pdf-toolkit split   <input>          -o <dir>
pdf-toolkit delete  <input>          -p <pages>       [-o <file> | --in-place]
pdf-toolkit insert  <base> <insert>  --at <page>      [-o <file> | --in-place]
pdf-toolkit reorder <input>          --order <pages>  [-o <file> | --in-place]
pdf-toolkit rotate  <input>          -d <degrees> [-p <pages>]
                                                      [-o <file> | --in-place]
pdf-toolkit extract <input>          -p <pages>       [-o <file> | --in-place]
```

### merge

Appends whole documents in the order given.

```bash
pdf-toolkit merge cover.pdf body.pdf appendix.pdf -o book.pdf
```

**Wildcards.** `merge` expands `*`, `?` and `[abc]` itself, which is what
makes this work in PowerShell and cmd. Neither expands wildcards for the
program, unlike a POSIX shell:

```bash
pdf-toolkit merge *.pdf -o book.pdf
```

Matching ignores case, so `*.pdf` also picks up `SCAN.PDF` on every platform.
Patterns cover one directory: `**` is refused rather than quietly treated as
`*`. A pattern that matches nothing is an error, not an empty merge.

The destination is left out of the expansion, so running
`merge *.pdf -o merged.pdf` twice in the same folder does not fold the first
result into the second. Naming a file explicitly is different: it is taken at
face value, and merging a file onto itself is refused.

**Ordering.** Files listed by hand keep the order you typed. An expansion is
sorted, since directory order means nothing. `--sort` sets it explicitly:

```bash
pdf-toolkit merge *.pdf --sort name      -o book.pdf   # ascending, the default
pdf-toolkit merge *.pdf --sort name-desc -o book.pdf   # descending
```

Sorting is a plain string comparison on the file name, the same as a shell
would give. That means **`scan10.pdf` sorts before `scan2.pdf`**, so pad
numbered files (`scan02.pdf`) if you want numeric order. `split` already pads
its output for this reason.

### split

Bursts a document into one file per page, named `<stem>-page-NNN.pdf`. The
number is zero padded so a plain lexical sort matches page order. The output
directory is created if missing.

```bash
pdf-toolkit split book.pdf -o pages/
# pages/book-page-001.pdf, book-page-002.pdf, ...
```

### delete

Removes the named pages. Survivors keep their relative order. Repeats in the
list are ignored. Deleting every page is refused, since a zero page PDF is not
a useful artifact.

```bash
pdf-toolkit delete book.pdf -p 2,5-7 -o trimmed.pdf
```

### insert

Puts every page of one document into another. `--at` is the page number the
first inserted page takes in the result, so `1` prepends and one past the last
page appends.

```bash
pdf-toolkit insert body.pdf cover.pdf --at 1 -o book.pdf   # prepend
pdf-toolkit insert body.pdf notes.pdf --at 4 -o book.pdf   # before old page 4
```

### reorder

Rearranges a document. `--order` must be a complete permutation: every page
exactly once, nothing repeated or omitted. That keeps a reorder lossless and
turns a typo into a clear error rather than a silently dropped page. To select
a subset, use `extract`.

```bash
pdf-toolkit reorder book.pdf --order 3,1,2,4-10 -o fixed.pdf
pdf-toolkit reorder book.pdf --order 10-1 -o reversed.pdf
```

### rotate

Rotation is **relative**: it is added to whatever rotation a page already
carries, then normalized into `[0, 360)`. Must be a whole multiple of 90;
negatives are fine. Omit `--pages` to rotate the whole document.

```bash
pdf-toolkit rotate scan.pdf -d 90 -o upright.pdf
pdf-toolkit rotate scan.pdf -d -90 -p 2,4 -o upright.pdf
```

### extract

Pulls pages into a new document, **in the order listed**. A page listed twice
is copied twice, the only unambiguous reading of a repeat.

```bash
pdf-toolkit extract book.pdf -p 4,1,3 -o excerpt.pdf   # that exact sequence
pdf-toolkit extract book.pdf -p 2-5 -o chapter.pdf
```

## Page specs

Anywhere a command takes pages (`-p`, `--order`), the syntax is the same.
Pages are 1-based.

| spec | means |
|---|---|
| `3` | page 3 |
| `1,3,5` | pages 1, 3 and 5 |
| `5-7` | pages 5, 6, 7 |
| `7-5` | pages 7, 6, 5, in that order |
| `1,3,5-7` | pages 1, 3, 5, 6, 7 |

Two rules that matter:

- **Order is preserved.** `4,1,3` means that sequence, not sorted.
- **Repeats are preserved.** The parser does not collapse them, because the
  operations disagree about what a repeat means: extract copies the page
  twice, delete ignores it, reorder rejects it.

## Overwriting the input

By default a command reads its input and writes somewhere else. `--in-place`
opts into overwriting:

```bash
pdf-toolkit rotate scan.pdf -d 90 --in-place
```

The result is written to a temporary file beside the input and then renamed
onto it. The rename is atomic within a filesystem, so the input ends up either
the old file or the new one, never a half written mix. If anything fails the
temporary file is removed and the input is left untouched.

`merge` and `split` have no `--in-place`: merge has several inputs and no
obvious one to overwrite, and split produces a directory of files.

## Desktop app

`packages/desktop` is a graphical front end for the same engine. It runs the
operations in the page, so nothing is uploaded anywhere.

Two ways to run it. **In a browser**, which needs only Node:

```bash
npm run dev        # dev server on http://localhost:5173
```

**As a native window**, which is what gets installed:

```bash
npm run tauri:dev     # the app, with the dev server behind it
npm run tauri:build   # produces the installer
```

All seven operations are there, one tab each. Merge takes several files:
drop them on the page or pick them, reorder with the arrows or the sort
buttons, name the output, merge. The rest take one file plus the same page
spec syntax the CLI uses, `1,3,5-7`.

Split is the one that differs. A page cannot write a folder, so it hands back
a single zip of the pages, named the same way the CLI names them.

It is plain TypeScript with no UI framework: Vite is a dev dependency, so the
shipped bundle contains the engine and nothing else.

### Building the installer

`tauri:build` needs more than Node, because it compiles a Rust binary:

- **Rust**, via <https://rustup.rs>
- **Microsoft C++ Build Tools**, for the MSVC linker
- **WebView2**, already present on Windows 11 and current Windows 10

Output lands in `packages/desktop/src-tauri/target/release/bundle/`. That
directory is gitignored; a Rust target tree runs to gigabytes.

You do not have to build it locally. The **Desktop build** workflow compiles
it on a Windows runner. It does not run on every push, since Windows runner
minutes are expensive; there are two ways to start it.

**To publish a version**, push a tag. The workflow builds and opens a draft
release with the `.msi` and `-setup.exe` attached, which anyone can then
download from the releases page with no sign in and no tooling:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag has to match the version in `src-tauri/tauri.conf.json` or the build
stops, rather than publishing a `v0.2.0` release containing a 0.1.0
installer. The release is a draft, so nothing is downloadable until you
publish it in the web UI.

**To test a build without releasing anything**, run it by hand. That uploads
the installers as a workflow artifact instead, which expires after 90 days
and needs the CLI to fetch:

```bash
gh workflow run "Desktop build" --ref main
gh run download --name pdf-toolkit-windows
```

Saving differs between the two ways of running. In the native app a system
save dialog chooses the path and the app writes the file; served in a browser
it falls back to an ordinary download, because a webview will not run one.

### Signing the installer

The released installers are **unsigned**, so Windows warns about an
unrecognised publisher. The plumbing to sign them is already in the workflow
and switches on by adding one secret, with no file to edit:

```
WINDOWS_SIGN_COMMAND
```

Set it to the full command your certificate provider's CLI needs, with `%1`
where the file path goes. Tauri runs it once per binary before bundling, so
the executable inside the installer is signed and not just the installer
around it. Anything else the command needs, such as `AZURE_CLIENT_ID`, goes
in the repository's other secrets.

With the secret absent the build is exactly as it is now, unsigned. With it
present, a step after the build fails the run if any installer comes out
unsigned, because an unsigned binary reaching a release is worse than a
failed build: nothing looks wrong until a user is warned.

Worth knowing before buying anything. Since 2023 the private key has to live
on certified hardware, so there is no `.pfx` file to drop into CI: providers
issue either a USB token, which a hosted runner cannot use, or a cloud
signing service, which it can. Azure Trusted Signing, SSL.com eSigner and
DigiCert KeyLocker are the cloud options. Only an Extended Validation
certificate clears the SmartScreen warning immediately; anything cheaper
builds reputation through download volume, which a low-traffic project may
never accumulate.

## Using the engine directly

`packages/core` comes in two layers.

**Paths**, for anything running under Node:

```ts
import { extractPages, rotatePages } from '@pdf-toolkit/core';

await extractPages('book.pdf', [4, 1, 3], 'excerpt.pdf');
await rotatePages('scan.pdf', 90, 'upright.pdf', [2, 4]);
```

**Bytes**, for anything running in a browser or a Tauri webview, where there
is no filesystem:

```ts
import { extractPagesBytes, mergePdfBytes } from '@pdf-toolkit/core/bytes';

const merged = await mergePdfBytes([first, second]); // Uint8Array in and out
```

The path functions are thin wrappers over the bytes ones, so both behave
identically and there is only one implementation of each operation. The bytes
subpath imports nothing from `node:`, which a test enforces, so bundling it
for the browser pulls in no polyfills.

Every function validates its arguments and throws with a clear message rather
than letting bad input reach pdf-lib. None of the path functions will write
over their own input.

## Not supported

Deliberately out of scope for v1: encrypted or password protected PDFs,
digital signatures, annotations, form filling, OCR. Encryption and signatures
are revisited in v2.

## Development

```bash
npm test         # typecheck, then 223 tests across the three packages
npm run build    # core first, then cli
npm run lint     # biome across the monorepo
npm run format   # biome, applying safe fixes
npm run audit    # npm audit at moderate and above
```

New operations are written test first: a stub that asserts its inputs and
throws, a test that defines correct behaviour, then the implementation. See
CLAUDE.md for the conventions in full.

## Releasing

The version is declared in six files: the four `package.json`s,
`tauri.conf.json` and `Cargo.toml`. One command sets them all, and a test
fails if they ever disagree.

```bash
npm run version:set 0.2.0
npm test
git commit -am "chore: 0.2.0"
git tag v0.2.0
git push origin main v0.2.0
```

Order matters: a tag points at a commit, so the version has to be committed
before it is tagged. The Desktop build workflow refuses to build when the tag
and `tauri.conf.json` disagree, rather than publishing a `v0.2.0` release
containing a `0.1.0` installer. It opens the release as a draft, so nothing
is downloadable until you publish it.

What the numbers mean, for an application rather than a library:

| bump | for |
|---|---|
| patch, `0.1.1` | fixes, nothing new |
| minor, `0.2.0` | a new capability |
| major, `1.0.0` | when it is done rather than in progress |

Nothing here is published to npm, so semver is a description of what changed
rather than a promise to anyone's build.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
