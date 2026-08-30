import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

/** A page's [width, height], rounded to whole points. */
export type PageSize = [number, number];

/**
 * Build an in-memory PDF whose pages have the given sizes. Distinct sizes act
 * as identity tags, so a test can prove which source page ended up where.
 */
export async function makeTestPdf(sizes: PageSize[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const size of sizes) {
    doc.addPage(size);
  }
  return doc.save();
}

/** Report each page's rotation in degrees for an in-memory PDF. */
export async function pageRotationsOfBytes(
  bytes: Uint8Array
): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getRotation().angle);
}

/** Read a PDF from disk and report each page's rotation in degrees. */
export async function pageRotationsOf(path: string): Promise<number[]> {
  const doc = await PDFDocument.load(await readFile(path));
  return doc.getPages().map((page) => page.getRotation().angle);
}

/**
 * Bytes of a PDF whose page tree is genuinely empty.
 *
 * pdf-lib cannot produce one: saving a document with no pages emits a file
 * that loads back with a single page, so this is hand rolled.
 */
export function emptyPagePdf(): Uint8Array {
  const raw = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [] /Count 0 >>',
    'endobj',
    'trailer',
    '<< /Root 1 0 R /Size 3 >>',
    '%%EOF',
    '',
  ].join('\n');
  return new Uint8Array(Buffer.from(raw, 'latin1'));
}

/** Report the page sizes of an in-memory PDF, in page order. */
export async function pageSizesOfBytes(bytes: Uint8Array): Promise<PageSize[]> {
  const doc = await PDFDocument.load(bytes);
  return doc
    .getPages()
    .map(
      (page): PageSize => [
        Math.round(page.getWidth()),
        Math.round(page.getHeight()),
      ]
    );
}

/** Read a PDF from disk and report its page sizes in page order. */
export async function pageSizesOf(path: string): Promise<PageSize[]> {
  const doc = await PDFDocument.load(await readFile(path));
  return doc
    .getPages()
    .map(
      (page): PageSize => [
        Math.round(page.getWidth()),
        Math.round(page.getHeight()),
      ]
    );
}

/** The field values a filled form fixture is expected to carry. */
export interface FormValues {
  name: string;
  agree: boolean;
  country: string[];
}

/**
 * A PDF carrying a text field, a checkbox and a dropdown, built with pdf-lib.
 *
 * Built by the other library on purpose. LibPDF then reads and fills a form it
 * did not create, which is what a real document looks like, and pdf-lib reads
 * the result back as an independent check.
 */
export async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();

  const name = form.createTextField('applicant.name');
  name.setText('');
  name.addToPage(page, { x: 20, y: 340, width: 200, height: 20 });

  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 20, y: 300, width: 15, height: 15 });

  const country = form.createDropdown('country');
  country.setOptions(['CH', 'DE', 'FR']);
  country.addToPage(page, { x: 20, y: 260, width: 100, height: 20 });

  return doc.save();
}

/** Read the fixture's field values back with pdf-lib, the independent check. */
export async function formValuesOfBytes(
  bytes: Uint8Array
): Promise<FormValues> {
  const form = (await PDFDocument.load(bytes)).getForm();
  return {
    name: form.getTextField('applicant.name').getText() ?? '',
    agree: form.getCheckBox('agree').isChecked(),
    country: form.getDropdown('country').getSelected(),
  };
}

/** How many form fields pdf-lib can still see, which is 0 once flattened. */
export async function formFieldCountOfBytes(
  bytes: Uint8Array
): Promise<number> {
  return (await PDFDocument.load(bytes)).getForm().getFields().length;
}

/**
 * A PDF covering the field varieties a real form uses.
 *
 * The simpler fixture above is three plain fields. This one exists because
 * every one of these was missed the first time: a length limit, a multiline
 * box, a read only field carrying a value, a combo box that accepts a value
 * of its own, a listbox taking several answers, and a radio group.
 */
export async function makeVariedFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 700]);
  const form = doc.getForm();

  const pin = form.createTextField('pin');
  pin.setMaxLength(4);
  pin.addToPage(page, { x: 20, y: 640, width: 80, height: 18 });

  const comments = form.createTextField('comments');
  comments.enableMultiline();
  comments.addToPage(page, { x: 20, y: 560, width: 300, height: 60 });

  const reference = form.createTextField('reference');
  reference.setText('PRE-FILLED-123');
  reference.enableReadOnly();
  reference.addToPage(page, { x: 20, y: 520, width: 200, height: 18 });

  const city = form.createDropdown('city');
  city.setOptions(['Bern', 'Zurich']);
  city.enableEditing();
  city.addToPage(page, { x: 20, y: 470, width: 150, height: 18 });

  const hobbies = form.createOptionList('hobbies');
  hobbies.setOptions(['Chess', 'Hiking', 'Reading']);
  hobbies.enableMultiselect();
  hobbies.addToPage(page, { x: 20, y: 380, width: 150, height: 70 });

  const contact = form.createRadioGroup('contact');
  contact.addOptionToPage('Email', page, {
    x: 20,
    y: 340,
    width: 14,
    height: 14,
  });
  contact.addOptionToPage('Phone', page, {
    x: 20,
    y: 315,
    width: 14,
    height: 14,
  });

  return doc.save();
}
