import {
  deletePagesBytes,
  extractPagesBytes,
  insertPagesBytes,
  mergePdfBytes,
  pageFileName,
  parsePageSpec,
  reorderPagesBytes,
  rotatePagesBytes,
  splitPdfBytes,
} from '@pdf-toolkit/core/bytes';
import {
  type PickedFile,
  moveDown,
  moveUp,
  removeAt,
  sortByName,
  stemOf,
  suggestOutputName,
} from './fileList.js';
import { saveBytes, saveZip, withExtension } from './save.js';

/**
 * DOM wiring.
 *
 * Ordering logic lives in fileList.ts and delivery in save.ts, both tested
 * without a browser. What is left here is reading inputs, calling the engine
 * and reporting the result.
 */

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`the page is missing #${id}`);
  }
  return found as T;
}

const status = element<HTMLParagraphElement>('status');

function say(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

/** Read a file input, failing with a message aimed at the person reading it. */
async function requireFile(
  input: HTMLInputElement,
  what: string
): Promise<Uint8Array> {
  const file = input.files?.[0];
  if (file === undefined) {
    throw new Error(`Choose ${what} first.`);
  }
  return new Uint8Array(await file.arrayBuffer());
}

function nameOf(input: HTMLInputElement, fallback: string): string {
  return input.files?.[0]?.name ?? fallback;
}

/**
 * Run an operation, turning any failure into a readable line.
 *
 * The engine's asserts already say what is wrong and name the page number, so
 * the message is shown as it is rather than being rewritten.
 */
async function run(button: HTMLButtonElement, work: () => Promise<string>) {
  const wasDisabled = button.disabled;
  button.disabled = true;
  say('Working…');
  try {
    say(await work());
  } catch (error) {
    say(error instanceof Error ? error.message : String(error), true);
  } finally {
    button.disabled = wasDisabled;
  }
}

// --- tabs ------------------------------------------------------------------

const tabs = element<HTMLElement>('tabs');
const OPERATIONS = [
  'merge',
  'split',
  'delete',
  'insert',
  'reorder',
  'rotate',
  'extract',
] as const;

function show(operation: string): void {
  for (const name of OPERATIONS) {
    element<HTMLElement>(`panel-${name}`).hidden = name !== operation;
  }
  for (const button of tabs.querySelectorAll('button')) {
    const isCurrent = button.dataset.op === operation;
    button.setAttribute('aria-current', String(isCurrent));
  }
  say('');
}

tabs.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest('button');
  const operation = button?.dataset.op;
  if (operation !== undefined) {
    show(operation);
  }
});

// --- merge -----------------------------------------------------------------

const dropzone = element<HTMLElement>('dropzone');
const picker = element<HTMLInputElement>('picker');
const list = element<HTMLOListElement>('files');
const emptyNote = element<HTMLParagraphElement>('empty');
const mergeRun = element<HTMLButtonElement>('merge-run');
const sortAsc = element<HTMLButtonElement>('sort-asc');
const sortDesc = element<HTMLButtonElement>('sort-desc');
const clearButton = element<HTMLButtonElement>('clear');
const mergeOutput = element<HTMLInputElement>('merge-output');

let files: PickedFile[] = [];
/** Once the user names the output themselves, stop suggesting one. */
let outputEdited = false;

function refreshSuggestedName(): void {
  if (!outputEdited) {
    mergeOutput.value = suggestOutputName(files);
  }
}

function renderList(): void {
  list.replaceChildren();
  emptyNote.hidden = files.length > 0;

  for (const [index, file] of files.entries()) {
    const row = document.createElement('li');

    const position = document.createElement('span');
    position.className = 'position';
    position.textContent = String(index + 1);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.name;
    name.title = file.name;

    const size = document.createElement('span');
    size.className = 'pages';
    size.textContent = `${Math.max(1, Math.round(file.bytes.length / 1024))} KB`;

    const buttons = document.createElement('span');
    buttons.className = 'row-buttons';

    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '↑';
    up.title = 'Move up';
    up.disabled = index === 0;
    up.addEventListener('click', () => {
      files = moveUp(files, index);
      renderList();
    });

    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '↓';
    down.title = 'Move down';
    down.disabled = index === files.length - 1;
    down.addEventListener('click', () => {
      files = moveDown(files, index);
      renderList();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '✕';
    remove.title = `Remove ${file.name}`;
    remove.addEventListener('click', () => {
      files = removeAt(files, index);
      refreshSuggestedName();
      renderList();
    });

    buttons.append(up, down, remove);
    row.append(position, name, size, buttons);
    list.append(row);
  }

  const hasFiles = files.length > 0;
  mergeRun.disabled = !hasFiles;
  sortAsc.disabled = !hasFiles;
  sortDesc.disabled = !hasFiles;
  clearButton.disabled = !hasFiles;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function addFiles(incoming: FileList | File[]): Promise<void> {
  const candidates = Array.from(incoming);
  const pdfs = candidates.filter(isPdf);
  const skipped = candidates.length - pdfs.length;

  if (pdfs.length === 0) {
    say(skipped > 0 ? 'Those are not PDFs, so nothing was added.' : '', true);
    return;
  }

  const added: PickedFile[] = [];
  for (const file of pdfs) {
    added.push({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }

  files = [...files, ...added];
  refreshSuggestedName();
  renderList();

  const note = skipped > 0 ? `, skipped ${skipped} that were not PDFs` : '';
  say(`Added ${added.length} file${added.length === 1 ? '' : 's'}${note}.`);
}

element<HTMLButtonElement>('pick').addEventListener('click', () =>
  picker.click()
);

picker.addEventListener('change', () => {
  if (picker.files !== null) {
    void addFiles(picker.files);
  }
  // Reset, so choosing the same file again still fires a change event.
  picker.value = '';
});

for (const name of ['dragenter', 'dragover'] as const) {
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add('over');
  });
}
for (const name of ['dragleave', 'drop'] as const) {
  dropzone.addEventListener(name, () => dropzone.classList.remove('over'));
}
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  if (event.dataTransfer !== null) {
    void addFiles(event.dataTransfer.files);
  }
});
// Dropping elsewhere should not navigate the page to the file.
for (const name of ['dragover', 'drop'] as const) {
  window.addEventListener(name, (event) => event.preventDefault());
}

sortAsc.addEventListener('click', () => {
  files = sortByName(files, 'asc');
  refreshSuggestedName();
  renderList();
});
sortDesc.addEventListener('click', () => {
  files = sortByName(files, 'desc');
  refreshSuggestedName();
  renderList();
});
clearButton.addEventListener('click', () => {
  files = [];
  outputEdited = false;
  refreshSuggestedName();
  renderList();
  say('');
});
mergeOutput.addEventListener('input', () => {
  outputEdited = mergeOutput.value.trim().length > 0;
});

mergeRun.addEventListener(
  'click',
  () =>
    void run(mergeRun, async () => {
      const merged = await mergePdfBytes(files.map((file) => file.bytes));
      const name = withExtension(mergeOutput.value, '.pdf');
      saveBytes(merged, name);
      return `Merged ${files.length} files into ${name}.`;
    })
);

// --- split -----------------------------------------------------------------

const splitFile = element<HTMLInputElement>('split-file');
const splitOutput = element<HTMLInputElement>('split-output');
const splitRun = element<HTMLButtonElement>('split-run');

splitFile.addEventListener('change', () => {
  splitOutput.value = `${stemOf(nameOf(splitFile, 'pages'))}-pages.zip`;
});

splitRun.addEventListener(
  'click',
  () =>
    void run(splitRun, async () => {
      const bytes = await requireFile(splitFile, 'a PDF');
      const pages = await splitPdfBytes(bytes);
      const stem = stemOf(nameOf(splitFile, 'document'));
      const name = withExtension(splitOutput.value, '.zip');
      saveZip(
        pages.map((page, index) => ({
          name: pageFileName(stem, index + 1, pages.length),
          bytes: page,
        })),
        name
      );
      return `Split into ${pages.length} pages, saved as ${name}.`;
    })
);

// --- delete ----------------------------------------------------------------

const deleteFile = element<HTMLInputElement>('delete-file');
const deletePages = element<HTMLInputElement>('delete-pages');
const deleteOutput = element<HTMLInputElement>('delete-output');
const deleteRun = element<HTMLButtonElement>('delete-run');

deleteFile.addEventListener('change', () => {
  deleteOutput.value = `${stemOf(nameOf(deleteFile, 'document'))}-edited.pdf`;
});

deleteRun.addEventListener(
  'click',
  () =>
    void run(deleteRun, async () => {
      const bytes = await requireFile(deleteFile, 'a PDF');
      const pages = parsePageSpec(deletePages.value, 'Pages to delete');
      const result = await deletePagesBytes(bytes, pages);
      const name = withExtension(deleteOutput.value, '.pdf');
      saveBytes(result, name);
      return `Deleted ${pages.length} page(s), saved as ${name}.`;
    })
);

// --- insert ----------------------------------------------------------------

const insertBase = element<HTMLInputElement>('insert-base');
const insertSource = element<HTMLInputElement>('insert-source');
const insertAt = element<HTMLInputElement>('insert-at');
const insertOutput = element<HTMLInputElement>('insert-output');
const insertRun = element<HTMLButtonElement>('insert-run');

insertBase.addEventListener('change', () => {
  insertOutput.value = `${stemOf(nameOf(insertBase, 'document'))}-inserted.pdf`;
});

insertRun.addEventListener(
  'click',
  () =>
    void run(insertRun, async () => {
      const base = await requireFile(insertBase, 'a base PDF');
      const source = await requireFile(insertSource, 'a PDF to insert');
      const at = Number(insertAt.value);
      const result = await insertPagesBytes(base, source, at);
      const name = withExtension(insertOutput.value, '.pdf');
      saveBytes(result, name);
      return `Inserted at page ${at}, saved as ${name}.`;
    })
);

// --- reorder ---------------------------------------------------------------

const reorderFile = element<HTMLInputElement>('reorder-file');
const reorderOrder = element<HTMLInputElement>('reorder-order');
const reorderOutput = element<HTMLInputElement>('reorder-output');
const reorderRun = element<HTMLButtonElement>('reorder-run');

reorderFile.addEventListener('change', () => {
  reorderOutput.value = `${stemOf(
    nameOf(reorderFile, 'document')
  )}-reordered.pdf`;
});

reorderRun.addEventListener(
  'click',
  () =>
    void run(reorderRun, async () => {
      const bytes = await requireFile(reorderFile, 'a PDF');
      const order = parsePageSpec(reorderOrder.value, 'New order');
      const result = await reorderPagesBytes(bytes, order);
      const name = withExtension(reorderOutput.value, '.pdf');
      saveBytes(result, name);
      return `Reordered ${order.length} pages, saved as ${name}.`;
    })
);

// --- rotate ----------------------------------------------------------------

const rotateFile = element<HTMLInputElement>('rotate-file');
const rotateDegrees = element<HTMLSelectElement>('rotate-degrees');
const rotatePagesField = element<HTMLInputElement>('rotate-pages');
const rotateOutput = element<HTMLInputElement>('rotate-output');
const rotateRun = element<HTMLButtonElement>('rotate-run');

rotateFile.addEventListener('change', () => {
  rotateOutput.value = `${stemOf(nameOf(rotateFile, 'document'))}-rotated.pdf`;
});

rotateRun.addEventListener(
  'click',
  () =>
    void run(rotateRun, async () => {
      const bytes = await requireFile(rotateFile, 'a PDF');
      const degrees = Number(rotateDegrees.value);
      // Blank means every page, matching the CLI where --pages is optional.
      const spec = rotatePagesField.value.trim();
      const pages = spec.length > 0 ? parsePageSpec(spec, 'Pages') : undefined;
      const result = await rotatePagesBytes(bytes, degrees, pages);
      const name = withExtension(rotateOutput.value, '.pdf');
      saveBytes(result, name);
      const scope =
        pages === undefined ? 'every page' : `${pages.length} page(s)`;
      return `Rotated ${scope} by ${degrees}, saved as ${name}.`;
    })
);

// --- extract ---------------------------------------------------------------

const extractFile = element<HTMLInputElement>('extract-file');
const extractPagesField = element<HTMLInputElement>('extract-pages');
const extractOutput = element<HTMLInputElement>('extract-output');
const extractRun = element<HTMLButtonElement>('extract-run');

extractFile.addEventListener('change', () => {
  extractOutput.value = `${stemOf(
    nameOf(extractFile, 'document')
  )}-extract.pdf`;
});

extractRun.addEventListener(
  'click',
  () =>
    void run(extractRun, async () => {
      const bytes = await requireFile(extractFile, 'a PDF');
      const pages = parsePageSpec(extractPagesField.value, 'Pages');
      const result = await extractPagesBytes(bytes, pages);
      const name = withExtension(extractOutput.value, '.pdf');
      saveBytes(result, name);
      return `Extracted ${pages.length} page(s), saved as ${name}.`;
    })
);

show('merge');
renderList();
