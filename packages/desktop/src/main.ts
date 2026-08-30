import {
  type EncryptionAlgorithm,
  type FormFieldInfo,
  deletePagesBytes,
  extractPagesBytes,
  fillFormBytes,
  flattenFormBytes,
  insertPagesBytes,
  mergePdfBytes,
  pageFileName,
  parsePageSpec,
  protectPdfBytes,
  readFormFieldsBytes,
  reorderPagesBytes,
  rotatePagesBytes,
  signPdfBytes,
  splitPdfBytes,
  unlockPdfBytes,
} from '@pdf-toolkit/core/bytes';
import { type SingleFileDrop, createFileDrop } from './fileDrop.js';
import {
  type PickedFile,
  moveDown,
  moveUp,
  removeAt,
  sortByName,
  stemOf,
  suggestOutputName,
} from './fileList.js';
import {
  type ControlState,
  collectValues,
  controlFor,
  displayValue,
  labelFor,
  whyNotEditable,
} from './formFields.js';
import { describeSkipped, partitionPdfs } from './pdfFiles.js';
import { PERMISSION_LABELS, forbiddenPermissions } from './permissions.js';
import { PDF, ZIP, buildZip, saveBytes, withExtension } from './save.js';

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

/** Read a drop zone, failing with a message aimed at the person reading it. */
function requireFile(drop: SingleFileDrop, what: string): Uint8Array {
  const file = drop.current();
  if (file === undefined) {
    throw new Error(`Choose ${what} first.`);
  }
  return file.bytes;
}

function nameOf(drop: SingleFileDrop, fallback: string): string {
  return drop.current()?.name ?? fallback;
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
  'protect',
  'unlock',
  'form',
  'sign',
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

const dropzone = element<HTMLElement>('merge-zone');
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

async function addFiles(incoming: FileList | File[]): Promise<void> {
  const { pdfs, skipped } = partitionPdfs(Array.from(incoming));

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

  const note = describeSkipped(skipped);
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
      const written = await saveBytes(
        merged,
        withExtension(mergeOutput.value, '.pdf'),
        PDF
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Merged ${files.length} files into ${written}.`;
    })
);

// --- split -----------------------------------------------------------------

const splitFile = createFileDrop('split-zone', (_file, note, isError) => {
  suggestSplitFile();
  say(note, isError);
});
const splitOutput = element<HTMLInputElement>('split-output');
const splitRun = element<HTMLButtonElement>('split-run');

function suggestSplitFile(): void {
  splitOutput.value = `${stemOf(nameOf(splitFile, 'pages'))}-pages.zip`;
}

splitRun.addEventListener(
  'click',
  () =>
    void run(splitRun, async () => {
      const bytes = requireFile(splitFile, 'a PDF');
      const pages = await splitPdfBytes(bytes);
      const stem = stemOf(nameOf(splitFile, 'document'));
      const zip = buildZip(
        pages.map((page, index) => ({
          name: pageFileName(stem, index + 1, pages.length),
          bytes: page,
        }))
      );
      const written = await saveBytes(
        zip,
        withExtension(splitOutput.value, '.zip'),
        ZIP
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Split into ${pages.length} pages, saved as ${written}.`;
    })
);

// --- delete ----------------------------------------------------------------

const deleteFile = createFileDrop('delete-zone', (_file, note, isError) => {
  suggestDeleteFile();
  say(note, isError);
});
const deletePages = element<HTMLInputElement>('delete-pages');
const deleteOutput = element<HTMLInputElement>('delete-output');
const deleteRun = element<HTMLButtonElement>('delete-run');

function suggestDeleteFile(): void {
  deleteOutput.value = `${stemOf(nameOf(deleteFile, 'document'))}-edited.pdf`;
}

deleteRun.addEventListener(
  'click',
  () =>
    void run(deleteRun, async () => {
      const bytes = requireFile(deleteFile, 'a PDF');
      const pages = parsePageSpec(deletePages.value, 'Pages to delete');
      const result = await deletePagesBytes(bytes, pages);
      const written = await saveBytes(
        result,
        withExtension(deleteOutput.value, '.pdf'),
        PDF
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Deleted ${pages.length} page(s), saved as ${written}.`;
    })
);

// --- insert ----------------------------------------------------------------

const insertBase = createFileDrop(
  'insert-base-zone',
  (_file, note, isError) => {
    suggestInsertBase();
    say(note, isError);
  }
);
const insertSource = createFileDrop(
  'insert-source-zone',
  (_file, note, isError) => {
    suggestInsertSource();
    say(note, isError);
  }
);
const insertAt = element<HTMLInputElement>('insert-at');
const insertOutput = element<HTMLInputElement>('insert-output');
const insertRun = element<HTMLButtonElement>('insert-run');

function suggestInsertBase(): void {
  insertOutput.value = `${stemOf(nameOf(insertBase, 'document'))}-inserted.pdf`;
}

/** The inserted document does not affect the output name. */
function suggestInsertSource(): void {}

insertRun.addEventListener(
  'click',
  () =>
    void run(insertRun, async () => {
      const base = requireFile(insertBase, 'a base PDF');
      const source = requireFile(insertSource, 'a PDF to insert');
      const at = Number(insertAt.value);
      const result = await insertPagesBytes(base, source, at);
      const written = await saveBytes(
        result,
        withExtension(insertOutput.value, '.pdf'),
        PDF
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Inserted at page ${at}, saved as ${written}.`;
    })
);

// --- reorder ---------------------------------------------------------------

const reorderFile = createFileDrop('reorder-zone', (_file, note, isError) => {
  suggestReorderFile();
  say(note, isError);
});
const reorderOrder = element<HTMLInputElement>('reorder-order');
const reorderOutput = element<HTMLInputElement>('reorder-output');
const reorderRun = element<HTMLButtonElement>('reorder-run');

function suggestReorderFile(): void {
  reorderOutput.value = `${stemOf(
    nameOf(reorderFile, 'document')
  )}-reordered.pdf`;
}

reorderRun.addEventListener(
  'click',
  () =>
    void run(reorderRun, async () => {
      const bytes = requireFile(reorderFile, 'a PDF');
      const order = parsePageSpec(reorderOrder.value, 'New order');
      const result = await reorderPagesBytes(bytes, order);
      const written = await saveBytes(
        result,
        withExtension(reorderOutput.value, '.pdf'),
        PDF
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Reordered ${order.length} pages, saved as ${written}.`;
    })
);

// --- rotate ----------------------------------------------------------------

const rotateFile = createFileDrop('rotate-zone', (_file, note, isError) => {
  suggestRotateFile();
  say(note, isError);
});
const rotateDegrees = element<HTMLSelectElement>('rotate-degrees');
const rotatePagesField = element<HTMLInputElement>('rotate-pages');
const rotateOutput = element<HTMLInputElement>('rotate-output');
const rotateRun = element<HTMLButtonElement>('rotate-run');

function suggestRotateFile(): void {
  rotateOutput.value = `${stemOf(nameOf(rotateFile, 'document'))}-rotated.pdf`;
}

rotateRun.addEventListener(
  'click',
  () =>
    void run(rotateRun, async () => {
      const bytes = requireFile(rotateFile, 'a PDF');
      const degrees = Number(rotateDegrees.value);
      // Blank means every page, matching the CLI where --pages is optional.
      const spec = rotatePagesField.value.trim();
      const pages = spec.length > 0 ? parsePageSpec(spec, 'Pages') : undefined;
      const result = await rotatePagesBytes(bytes, degrees, pages);
      const written = await saveBytes(
        result,
        withExtension(rotateOutput.value, '.pdf'),
        PDF
      );
      const scope =
        pages === undefined ? 'every page' : `${pages.length} page(s)`;
      return written === undefined
        ? 'Save cancelled.'
        : `Rotated ${scope} by ${degrees}, saved as ${written}.`;
    })
);

// --- extract ---------------------------------------------------------------

const extractFile = createFileDrop('extract-zone', (_file, note, isError) => {
  suggestExtractFile();
  say(note, isError);
});
const extractPagesField = element<HTMLInputElement>('extract-pages');
const extractOutput = element<HTMLInputElement>('extract-output');
const extractRun = element<HTMLButtonElement>('extract-run');

function suggestExtractFile(): void {
  extractOutput.value = `${stemOf(
    nameOf(extractFile, 'document')
  )}-extract.pdf`;
}

extractRun.addEventListener(
  'click',
  () =>
    void run(extractRun, async () => {
      const bytes = requireFile(extractFile, 'a PDF');
      const pages = parsePageSpec(extractPagesField.value, 'Pages');
      const result = await extractPagesBytes(bytes, pages);
      const written = await saveBytes(
        result,
        withExtension(extractOutput.value, '.pdf'),
        PDF
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Extracted ${pages.length} page(s), saved as ${written}.`;
    })
);

// --- protect ---------------------------------------------------------------

const protectFile = createFileDrop('protect-zone', (_file, note, isError) => {
  protectOutput.value = `${stemOf(
    nameOf(protectFile, 'document')
  )}-protected.pdf`;
  say(note, isError);
});
const protectPassword = element<HTMLInputElement>('protect-password');
const protectOwner = element<HTMLInputElement>('protect-owner');
const protectAlgorithm = element<HTMLSelectElement>('protect-algorithm');
const protectOutput = element<HTMLInputElement>('protect-output');
const protectRun = element<HTMLButtonElement>('protect-run');

/** One box per permission, ticked, since a document starts unrestricted. */
const permissionBoxes = new Map<string, HTMLInputElement>();
for (const [name, label] of PERMISSION_LABELS) {
  const wrapper = document.createElement('label');
  wrapper.className = 'checkbox';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = true;
  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(box, text);
  element<HTMLElement>('protect-permissions').append(wrapper);
  permissionBoxes.set(name, box);
}

protectRun.addEventListener(
  'click',
  () =>
    void run(protectRun, async () => {
      const bytes = requireFile(protectFile, 'a PDF');
      const allowed = new Map(
        PERMISSION_LABELS.map(([name]): [typeof name, boolean] => [
          name,
          permissionBoxes.get(name)?.checked !== false,
        ])
      );
      const result = await protectPdfBytes(bytes, {
        ...(protectPassword.value.length === 0
          ? {}
          : { userPassword: protectPassword.value }),
        ...(protectOwner.value.length === 0
          ? {}
          : { ownerPassword: protectOwner.value }),
        algorithm: protectAlgorithm.value as EncryptionAlgorithm,
        permissions: forbiddenPermissions(allowed),
      });
      const written = await saveBytes(
        result,
        withExtension(protectOutput.value, '.pdf'),
        PDF
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Protected, saved as ${written}. Keep the password: without it this file cannot be opened again.`;
    })
);

// --- unlock ----------------------------------------------------------------

// This zone accepts documents pdf-lib cannot open, because that is the point
// of it. Every other zone rejects them.
const unlockFile = createFileDrop(
  'unlock-zone',
  (_file, note, isError) => {
    unlockOutput.value = `${stemOf(
      nameOf(unlockFile, 'document')
    )}-unlocked.pdf`;
    say(note, isError);
  },
  { acceptUnreadable: true }
);
const unlockPassword = element<HTMLInputElement>('unlock-password');
const unlockOutput = element<HTMLInputElement>('unlock-output');
const unlockRun = element<HTMLButtonElement>('unlock-run');

unlockRun.addEventListener(
  'click',
  () =>
    void run(unlockRun, async () => {
      const bytes = requireFile(unlockFile, 'a protected PDF');
      const result = await unlockPdfBytes(bytes, unlockPassword.value);
      const written = await saveBytes(
        result,
        withExtension(unlockOutput.value, '.pdf'),
        PDF
      );
      return written === undefined
        ? 'Save cancelled.'
        : `Unlocked, saved as ${written}.`;
    })
);

// --- form ------------------------------------------------------------------

const formFile = createFileDrop('form-zone', (file, note, isError) => {
  formOutput.value = `${stemOf(nameOf(formFile, 'document'))}-filled.pdf`;
  say(note, isError);
  if (file !== undefined) {
    void loadFormFields(file.bytes);
  }
});
const formFieldsBox = element<HTMLElement>('form-fields');
const formEmpty = element<HTMLParagraphElement>('form-empty');
const formFlatten = element<HTMLInputElement>('form-flatten');
const formOutput = element<HTMLInputElement>('form-output');
const formRun = element<HTMLButtonElement>('form-run');

let formFields: FormFieldInfo[] = [];
/** How to read the control standing in for each editable field. */
const formControls = new Map<string, () => ControlState>();

/** A field's current value as text a control can hold. */
function firstString(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
}

/**
 * Build one control per field.
 *
 * This is the whole reason form filling works with no page view: the fields
 * describe themselves well enough to draw an ordinary web form from them.
 */
function renderFormFields(): void {
  formFieldsBox.replaceChildren();
  formControls.clear();

  for (const field of formFields) {
    const row = document.createElement('label');
    row.className = 'field';
    const caption = document.createElement('span');
    caption.textContent = `${labelFor(field)}${field.required ? ' *' : ''}`;
    row.append(caption);

    const kind = controlFor(field);

    // No control does not mean nothing to show. A read only field usually
    // carries the value that matters most on the form, so it is displayed
    // rather than reduced to the word "read only".
    if (kind === undefined) {
      const shown = document.createElement('input');
      shown.type = 'text';
      shown.value = displayValue(field);
      shown.disabled = true;
      const note = document.createElement('em');
      note.className = 'muted';
      note.textContent = whyNotEditable(field) ?? '';
      row.append(shown, note);
      formFieldsBox.append(row);
      continue;
    }

    if (kind === 'checkbox') {
      const box = document.createElement('input');
      box.type = 'checkbox';
      // A checkbox stores "Off" when clear; anything else counts as ticked.
      box.checked = field.value !== 'Off' && field.value !== false;
      row.append(box);
      formControls.set(field.name, () => box.checked);
    } else if (kind === 'radio') {
      // A radio group is several inputs sharing a name, not a dropdown.
      const group = document.createElement('span');
      group.className = 'radios';
      const chosen = typeof field.value === 'string' ? field.value : '';
      for (const option of field.options ?? []) {
        const item = document.createElement('label');
        item.className = 'radio';
        const button = document.createElement('input');
        button.type = 'radio';
        button.name = `radio-${field.name}`;
        button.value = option.value;
        button.checked = option.value === chosen;
        const caption = document.createElement('span');
        // display is the readable wording; value is what gets stored.
        caption.textContent = option.display;
        item.append(button, caption);
        group.append(item);
      }
      row.append(group);
      formControls.set(field.name, () => {
        const picked = group.querySelector<HTMLInputElement>(
          'input[type="radio"]:checked'
        );
        return picked?.value ?? '';
      });
    } else if (kind === 'multiselect') {
      const select = document.createElement('select');
      select.multiple = true;
      select.size = Math.min(6, Math.max(3, field.options?.length ?? 3));
      const chosen = new Set(Array.isArray(field.value) ? field.value : []);
      for (const option of field.options ?? []) {
        const item = document.createElement('option');
        item.value = option.value;
        item.textContent = option.display;
        item.selected = chosen.has(option.value);
        select.append(item);
      }
      row.append(select);
      formControls.set(field.name, () =>
        Array.from(select.selectedOptions).map((option) => option.value)
      );
    } else if (kind === 'select') {
      const select = document.createElement('select');
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '(none)';
      select.append(blank);
      for (const option of field.options ?? []) {
        const item = document.createElement('option');
        item.value = option.value;
        item.textContent = option.display;
        select.append(item);
      }
      select.value = firstString(field.value);
      row.append(select);
      formControls.set(field.name, () => select.value);
    } else if (kind === 'combo') {
      // Editable: the listed options are suggestions, not the only answers,
      // so this is a text box with a datalist rather than a select.
      const input = document.createElement('input');
      input.type = 'text';
      input.value = firstString(field.value);
      const list = document.createElement('datalist');
      list.id = `options-${field.name}`;
      for (const option of field.options ?? []) {
        const item = document.createElement('option');
        item.value = option.value;
        list.append(item);
      }
      input.setAttribute('list', list.id);
      row.append(input, list);
      formControls.set(field.name, () => input.value);
    } else {
      const input = document.createElement(
        kind === 'textarea' ? 'textarea' : 'input'
      ) as HTMLInputElement | HTMLTextAreaElement;
      if (input instanceof HTMLInputElement) {
        input.type = 'text';
      } else {
        input.rows = 3;
      }
      input.value = firstString(field.value);
      // A form asking for four digits says so, and the box should hold to it.
      if (field.maxLength !== undefined) {
        input.maxLength = field.maxLength;
      }
      row.append(input);
      formControls.set(field.name, () => input.value);
    }

    formFieldsBox.append(row);
  }

  formEmpty.hidden = formFields.length > 0;
  formEmpty.textContent =
    formFields.length > 0 ? '' : 'This document has no form fields.';
  formRun.disabled = formControls.size === 0;
}

async function loadFormFields(bytes: Uint8Array): Promise<void> {
  try {
    formFields = await readFormFieldsBytes(bytes);
  } catch {
    formFields = [];
  }
  renderFormFields();
}

formRun.addEventListener(
  'click',
  () =>
    void run(formRun, async () => {
      const bytes = requireFile(formFile, 'a PDF');
      const held = new Map<string, ControlState>();
      for (const [name, read] of formControls) {
        held.set(name, read());
      }
      const filled = await fillFormBytes(
        bytes,
        collectValues(formFields, held)
      );
      const result = formFlatten.checked
        ? await flattenFormBytes(filled)
        : filled;
      const written = await saveBytes(
        result,
        withExtension(formOutput.value, '.pdf'),
        PDF
      );
      if (written === undefined) {
        return 'Save cancelled.';
      }
      return formFlatten.checked
        ? `Filled and flattened, saved as ${written}.`
        : `Filled ${formControls.size} field(s), saved as ${written}.`;
    })
);

// --- sign ------------------------------------------------------------------

const signFile = createFileDrop('sign-zone', (_file, note, isError) => {
  signOutput.value = `${stemOf(nameOf(signFile, 'document'))}-signed.pdf`;
  say(note, isError);
});
const signCertificate = element<HTMLInputElement>('sign-certificate');
const signPassword = element<HTMLInputElement>('sign-password');
const signReason = element<HTMLInputElement>('sign-reason');
const signLocation = element<HTMLInputElement>('sign-location');
const signOutput = element<HTMLInputElement>('sign-output');
const signRun = element<HTMLButtonElement>('sign-run');

signRun.addEventListener(
  'click',
  () =>
    void run(signRun, async () => {
      const bytes = requireFile(signFile, 'a PDF');
      const chosen = signCertificate.files?.[0];
      if (chosen === undefined) {
        throw new Error('Choose a .p12 or .pfx certificate first.');
      }
      const signed = await signPdfBytes(bytes, {
        certificate: new Uint8Array(await chosen.arrayBuffer()),
        password: signPassword.value,
        ...(signReason.value.length === 0 ? {} : { reason: signReason.value }),
        ...(signLocation.value.length === 0
          ? {}
          : { location: signLocation.value }),
      });
      const written = await saveBytes(
        signed.bytes,
        withExtension(signOutput.value, '.pdf'),
        PDF
      );
      if (written === undefined) {
        return 'Save cancelled.';
      }
      // Signing can succeed and still have something to say, so say it.
      const said =
        signed.warnings.length === 0
          ? ''
          : ` ${signed.warnings.map((warning) => warning.message).join(' ')}`;
      return `Signed, saved as ${written}.${said}`;
    })
);

show('merge');
renderList();
