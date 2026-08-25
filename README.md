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

## Requirements

Node 24, pinned in `.nvmrc`. With nvm:

```bash
nvm use          # reads .nvmrc
./bootstrap.sh   # installs dependencies
npm run build
```

The binary is then at `packages/cli/dist/index.js`. Run it directly, or
`npm link -w @pdf-toolkit/cli` to get `pdf-toolkit` on your PATH.

## Commands

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
