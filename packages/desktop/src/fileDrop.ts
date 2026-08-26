import type { PickedFile } from './fileList.js';
import { describeSkipped, partitionPdfs } from './pdfFiles.js';

/**
 * A drop zone that holds one PDF.
 *
 * Merge keeps its own multi-file zone, since it also needs an ordered list.
 * Every other operation takes exactly one file, so dropping several keeps the
 * first and says so rather than silently picking one or refusing outright.
 */
export interface SingleFileDrop {
  /** The chosen file, or undefined if nothing has been chosen yet. */
  current(): PickedFile | undefined;
  /** Forget the current file and reset the zone. */
  clear(): void;
}

/** Wire the zone with this id. The markup lives in index.html. */
export function createFileDrop(
  zoneId: string,
  onChange: (file: PickedFile | undefined, note: string) => void
): SingleFileDrop {
  const found = document.getElementById(zoneId);
  if (found === null) {
    throw new Error(`the page is missing #${zoneId}`);
  }
  // Bind the narrowed values to their own names: TypeScript will not carry
  // narrowing from the checks below into the closures declared after them.
  const zone: HTMLElement = found;

  const inputEl = zone.querySelector('input[type="file"]');
  const buttonEl = zone.querySelector('button');
  const chosenEl = zone.querySelector('.chosen');
  if (
    !(inputEl instanceof HTMLInputElement) ||
    !(buttonEl instanceof HTMLButtonElement) ||
    !(chosenEl instanceof HTMLElement)
  ) {
    throw new Error(`#${zoneId} is not shaped like a drop zone`);
  }
  const input: HTMLInputElement = inputEl;
  const button: HTMLButtonElement = buttonEl;
  const chosen: HTMLElement = chosenEl;

  let picked: PickedFile | undefined;

  function render(): void {
    chosen.textContent = picked?.name ?? '';
    chosen.hidden = picked === undefined;
    zone.classList.toggle('filled', picked !== undefined);
  }

  async function take(files: FileList | File[]): Promise<void> {
    const { pdfs, skipped } = partitionPdfs(Array.from(files));
    const first = pdfs[0];

    if (first === undefined) {
      onChange(picked, 'That is not a PDF.');
      return;
    }

    picked = {
      name: first.name,
      bytes: new Uint8Array(await first.arrayBuffer()),
    };
    render();

    const extra =
      pdfs.length > 1
        ? `, ignored ${pdfs.length - 1} more since this takes one file`
        : describeSkipped(skipped);
    onChange(picked, `Using ${first.name}${extra}.`);
  }

  button.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    if (input.files !== null && input.files.length > 0) {
      void take(input.files);
    }
    // Reset, so choosing the same file again still fires a change event.
    input.value = '';
  });

  for (const name of ['dragenter', 'dragover'] as const) {
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.add('over');
    });
  }
  for (const name of ['dragleave', 'drop'] as const) {
    zone.addEventListener(name, () => zone.classList.remove('over'));
  }
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    if (event.dataTransfer !== null) {
      void take(event.dataTransfer.files);
    }
  });

  render();

  return {
    current: () => picked,
    clear: () => {
      picked = undefined;
      render();
    },
  };
}
