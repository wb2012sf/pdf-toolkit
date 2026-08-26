import { mergePdfBytes } from '@pdf-toolkit/core/bytes';
import {
  type PickedFile,
  moveDown,
  moveUp,
  removeAt,
  sortByName,
  suggestOutputName,
} from './fileList.js';

/**
 * DOM wiring for the merge screen.
 *
 * All ordering logic lives in fileList.ts, which is tested without a browser.
 * What is left here is reading files, rendering the list, and handing bytes
 * to the engine, so there is little to get wrong that a test could catch.
 */

/** Look up an element that the page is expected to contain. */
function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`the page is missing #${id}`);
  }
  return found as T;
}

const dropzone = element<HTMLElement>('dropzone');
const picker = element<HTMLInputElement>('picker');
const pickButton = element<HTMLButtonElement>('pick');
const list = element<HTMLOListElement>('files');
const emptyNote = element<HTMLParagraphElement>('empty');
const mergeButton = element<HTMLButtonElement>('merge');
const sortAscButton = element<HTMLButtonElement>('sort-asc');
const sortDescButton = element<HTMLButtonElement>('sort-desc');
const clearButton = element<HTMLButtonElement>('clear');
const outputName = element<HTMLInputElement>('output-name');
const status = element<HTMLParagraphElement>('status');

let files: PickedFile[] = [];
/** Whether the user has typed their own output name, so we stop suggesting. */
let outputNameEdited = false;

function say(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function render(): void {
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
      render();
    });

    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '↓';
    down.title = 'Move down';
    down.disabled = index === files.length - 1;
    down.addEventListener('click', () => {
      files = moveDown(files, index);
      render();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '✕';
    remove.title = `Remove ${file.name}`;
    remove.addEventListener('click', () => {
      files = removeAt(files, index);
      refreshSuggestedName();
      render();
    });

    buttons.append(up, down, remove);
    row.append(position, name, size, buttons);
    list.append(row);
  }

  const hasFiles = files.length > 0;
  mergeButton.disabled = files.length < 1;
  sortAscButton.disabled = !hasFiles;
  sortDescButton.disabled = !hasFiles;
  clearButton.disabled = !hasFiles;
}

function refreshSuggestedName(): void {
  if (!outputNameEdited) {
    outputName.value = suggestOutputName(files);
  }
}

/** Keep only PDFs, so a stray file dropped alongside them is not merged. */
function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function addFiles(incoming: FileList | File[]): Promise<void> {
  const candidates = Array.from(incoming);
  const pdfs = candidates.filter(isPdf);
  const skipped = candidates.length - pdfs.length;

  if (pdfs.length === 0) {
    say(
      skipped > 0 ? 'Those are not PDFs, so nothing was added.' : '',
      skipped > 0
    );
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
  render();

  const note = skipped > 0 ? `, skipped ${skipped} that were not PDFs` : '';
  say(`Added ${added.length} file${added.length === 1 ? '' : 's'}${note}.`);
}

async function merge(): Promise<void> {
  mergeButton.disabled = true;
  say('Merging…');

  try {
    const merged = await mergePdfBytes(files.map((file) => file.bytes));
    const name = outputName.value.trim() || suggestOutputName(files);
    save(merged, name.endsWith('.pdf') ? name : `${name}.pdf`);
    say(`Merged ${files.length} files into ${name}.`);
  } catch (error) {
    // The engine's asserts carry the useful message, so show it as-is.
    say(error instanceof Error ? error.message : String(error), true);
  } finally {
    mergeButton.disabled = files.length < 1;
  }
}

/**
 * Hand the result to the user.
 *
 * A blob download is the browser way. Under Tauri this becomes the native
 * save dialog, which is the one place this file will need to change.
 */
function save(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

pickButton.addEventListener('click', () => picker.click());

picker.addEventListener('change', () => {
  if (picker.files !== null) {
    void addFiles(picker.files);
  }
  // Reset, so picking the same file twice still fires a change event.
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

// Dropping anywhere else should not make the browser navigate to the file.
for (const name of ['dragover', 'drop'] as const) {
  window.addEventListener(name, (event) => event.preventDefault());
}

sortAscButton.addEventListener('click', () => {
  files = sortByName(files, 'asc');
  refreshSuggestedName();
  render();
});

sortDescButton.addEventListener('click', () => {
  files = sortByName(files, 'desc');
  refreshSuggestedName();
  render();
});

clearButton.addEventListener('click', () => {
  files = [];
  outputNameEdited = false;
  refreshSuggestedName();
  render();
  say('');
});

outputName.addEventListener('input', () => {
  outputNameEdited = outputName.value.trim().length > 0;
});

mergeButton.addEventListener('click', () => void merge());

render();
