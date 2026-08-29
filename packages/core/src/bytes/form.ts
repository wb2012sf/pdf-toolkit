import { type FormField, PDF, type PDFForm, type PdfRef } from '@libpdf/core';
import { assert } from './assert.js';

/** The kinds of field LibPDF reports. */
export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'listbox'
  | 'signature'
  | 'button'
  | 'unknown'
  | 'non-terminal';

/** A value a field can be set to, by kind of field. */
export type FormFieldValue = string | boolean | string[] | null;

/** One choice offered by a dropdown, listbox or radio group. */
export interface FormFieldOption {
  /** What gets stored in the document. */
  value: string;
  /** What a person should see. Falls back to the value when there is no label. */
  display: string;
}

/**
 * Everything a caller needs to render one field without seeing the page.
 *
 * `label` is the point of this type. Field names are frequently machine
 * generated, along the lines of `topmostSubform[0].Page1[0].f1_07[0]`, while
 * the PDF `/TU` entry is written for a person and is what a screen reader
 * announces. Prefer it, fall back to the name when it is absent.
 */
export interface FormFieldInfo {
  name: string;
  type: FormFieldType;
  label: string;
  value: FormFieldValue;
  readOnly: boolean;
  required: boolean;
  /** Present only for the field types that offer a fixed set of choices. */
  options?: FormFieldOption[];
  /** Which page the field appears on, 1-based, when it is placed at all. */
  pageNumber?: number;
}

/**
 * Describe every form field in a document.
 *
 * Reading only. A document with no form gives an empty array rather than an
 * error, so a caller can ask before deciding whether to offer filling at all.
 */
export async function readFormFieldsBytes(
  input: Uint8Array
): Promise<FormFieldInfo[]> {
  assert(
    input instanceof Uint8Array,
    'readFormFieldsBytes requires the document as a Uint8Array'
  );

  const doc = await PDF.load(input);
  const form = doc.getForm();
  if (form === null) {
    return [];
  }

  const pageRefs = doc.getPages().map((page) => page.ref);

  return form.getFields().map((field): FormFieldInfo => {
    const options = readOptions(field);
    const pageNumber = readPageNumber(field, pageRefs);
    return {
      name: field.name,
      type: field.type,
      // The /TU entry is written for a person; the name often is not.
      label: field.alternateName ?? field.name,
      value: field.getValue() as FormFieldValue,
      readOnly: field.isReadOnly(),
      required: field.isRequired(),
      ...(options === undefined ? {} : { options }),
      ...(pageNumber === undefined ? {} : { pageNumber }),
    };
  });
}

/** Only some field kinds offer a fixed set of choices, so this is a guard. */
interface OffersOptions {
  getOptions: () => (string | FormFieldOption)[];
}

function offersOptions(field: FormField): field is FormField & OffersOptions {
  return typeof (field as Partial<OffersOptions>).getOptions === 'function';
}

/** The fixed choices a field offers, for the kinds of field that offer any. */
function readOptions(field: FormField): FormFieldOption[] | undefined {
  if (!offersOptions(field)) {
    return undefined;
  }
  // Choice fields give {value, display}; a radio group gives plain strings.
  return field
    .getOptions()
    .map((option) =>
      typeof option === 'string' ? { value: option, display: option } : option
    );
}

/**
 * Which page a field is drawn on, 1-based.
 *
 * A field is placed by its widget annotations, so an unplaced field has none
 * and gets no page number at all rather than a misleading page 1.
 */
function readPageNumber(
  field: FormField,
  pageRefs: readonly PdfRef[]
): number | undefined {
  const owner = field.getWidgets()[0]?.pageRef;
  if (owner === undefined || owner === null) {
    return undefined;
  }
  const index = pageRefs.findIndex(
    (ref) =>
      ref.objectNumber === owner.objectNumber &&
      ref.generation === owner.generation
  );
  return index === -1 ? undefined : index + 1;
}

/**
 * Fill form fields by name, returning the updated document.
 *
 * Every name given must exist. LibPDF's own `fill` reports an unknown name in
 * a `skipped` list and carries on, which would let a typo silently do nothing;
 * this refuses instead, naming the fields it did not recognise.
 */
export async function fillFormBytes(
  input: Uint8Array,
  values: Record<string, FormFieldValue>
): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'fillFormBytes requires the document as a Uint8Array'
  );
  assert(
    typeof values === 'object' && values !== null && !Array.isArray(values),
    'fillFormBytes requires an object of field names to values'
  );
  assert(
    Object.keys(values).length > 0,
    'fillFormBytes requires at least one field to fill'
  );

  const doc = await PDF.load(input);
  const form = requireForm(doc, 'fillFormBytes');

  const result = form.fill(values);
  // fill() reports an unrecognised name here and carries on. Left alone that
  // turns a typo into a silent no-op, which is exactly the failure this
  // project refuses to ship.
  assert(
    result.skipped.length === 0,
    result.skipped.length === 1
      ? `fillFormBytes: this document has no field called "${result.skipped[0]}"`
      : `fillFormBytes: this document has no fields called ${result.skipped
          .map((name) => `"${name}"`)
          .join(', ')}`
  );

  form.updateAppearances();
  return doc.save();
}

/** The document's form, or a clear refusal when it has none. */
function requireForm(doc: PDF, caller: string): PDFForm {
  const form = doc.getForm();
  assert(form !== null, `${caller}: this document has no form to work with`);
  return form;
}

/**
 * Bake the form into the page content, leaving the values visible but no
 * longer editable.
 *
 * This is one way, which is the point of it: a flattened form cannot be
 * changed by a later reader. The caller keeps the original if it wants one.
 */
export async function flattenFormBytes(input: Uint8Array): Promise<Uint8Array> {
  assert(
    input instanceof Uint8Array,
    'flattenFormBytes requires the document as a Uint8Array'
  );

  const doc = await PDF.load(input);
  requireForm(doc, 'flattenFormBytes').flatten();
  return doc.save();
}
