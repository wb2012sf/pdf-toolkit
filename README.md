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
git clone git@github.com:wb2012sf/pdf-toolkit.git
cd pdf-toolkit
```

While the repository is private that clone needs credentials: either an SSH
key on the machine, or `gh auth login` and then
`gh repo clone wb2012sf/pdf-toolkit`. Once it is public, HTTPS works with no
setup at all:

```bash
git clone https://github.com/wb2012sf/pdf-toolkit.git
```

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

The repository is private. Use an SSH key on that machine, or `gh auth login`
followed by `gh repo clone wb2012sf/pdf-toolkit`.

## Commands

Everything below is written as `pdf-toolkit`, which is form **c** from step 4.
If you have not linked, substitute one of the others, for example
`npx pdf-toolkit merge ...` from inside the repository.

```bash
pdf-toolkit merge   <inputs...>      -o <file>
pdf-toolkit split   <input>          -o <dir>
pdf-toolkit delete  <input>          -p <pages>       [-o <file> | --in-place]
pdf-toolkit insert  <base> <insert>  --at <page>      [-o <file> | --in-place]
pdf-toolkit reorder <input>          --order <pages>  [-o <file> | --in-place]
pdf-toolkit rotate  <input>          -d <degrees> [-p <pages>]
                                                      [-o <file> | --in-place]
pdf-toolkit extract <input>          -p <pages>       [-o <file> | --in-place]
```

### merge

Appends whole documents in the order given, not in any order derived from the
filesystem.

```bash
pdf-toolkit merge cover.pdf body.pdf appendix.pdf -o book.pdf
```

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

## Using the engine directly

`packages/core` is plain functions over `pdf-lib` with no CLI concerns, and is
what the planned web and desktop front ends will reuse.

```ts
import { extractPages, rotatePages } from '@pdf-toolkit/core';

await extractPages('book.pdf', [4, 1, 3], 'excerpt.pdf');
await rotatePages('scan.pdf', 90, 'upright.pdf', [2, 4]);
```

Every function validates its arguments and throws a clear `AssertionError`
rather than letting bad input reach pdf-lib. None of them will write over
their own input.

## Not supported

Deliberately out of scope for v1: encrypted or password protected PDFs,
digital signatures, annotations, form filling, OCR. Encryption and signatures
are revisited in v2.

## Development

```bash
npm test         # typecheck, then 111 tests
npm run build    # core first, then cli
npm run lint     # biome across the monorepo
npm run format   # biome, applying safe fixes
npm run audit    # npm audit at moderate and above
```

New operations are written test first: a stub that asserts its inputs and
throws, a test that defines correct behaviour, then the implementation. See
CLAUDE.md for the conventions in full.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
