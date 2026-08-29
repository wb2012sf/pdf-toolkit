import type { FormFieldInfo, FormFieldValue } from '@pdf-toolkit/core/bytes';

/** Which kind of control stands in for a field on the page. */
export type FieldControl = 'text' | 'checkbox' | 'choice';

/**
 * The control that represents this field, or undefined when it has none.
 *
 * A read only field is shown but never edited, and a signature or button
 * field is not something this screen can fill in, so both come back
 * undefined rather than being rendered as an input that does nothing.
 */
export function controlFor(field: FormFieldInfo): FieldControl | undefined {
  if (field.readOnly) {
    return undefined;
  }
  switch (field.type) {
    case 'text':
      return 'text';
    case 'checkbox':
      return 'checkbox';
    case 'dropdown':
    case 'listbox':
    case 'radio':
      return 'choice';
    default:
      return undefined;
  }
}

/** What a control currently holds, before it is turned into a field value. */
export type ControlState = string | boolean;

/**
 * Turn what the controls hold into values the engine will accept.
 *
 * Fields with no control are left out entirely, so a read only or signature
 * field is never sent back. A listbox takes an array where the others take a
 * single value, which is the one place the shapes differ.
 */
export function collectValues(
  fields: readonly FormFieldInfo[],
  held: ReadonlyMap<string, ControlState>
): Record<string, FormFieldValue> {
  const values: Record<string, FormFieldValue> = {};

  for (const field of fields) {
    if (controlFor(field) === undefined) {
      continue;
    }
    const state = held.get(field.name);
    if (state === undefined) {
      continue;
    }

    if (field.type === 'checkbox') {
      values[field.name] = state === true || state === 'true';
    } else if (field.type === 'listbox') {
      const single = String(state);
      values[field.name] = single.length === 0 ? [] : [single];
    } else {
      values[field.name] = String(state);
    }
  }

  return values;
}

/** How the field should be labelled on screen. */
export function labelFor(field: FormFieldInfo): string {
  return field.label.length > 0 ? field.label : field.name;
}

/** A one line summary of a field that cannot be edited, for the reason why. */
export function whyNotEditable(field: FormFieldInfo): string | undefined {
  if (controlFor(field) !== undefined) {
    return undefined;
  }
  if (field.readOnly) {
    return 'read only';
  }
  if (field.type === 'signature') {
    return 'signature field, use the Sign tab';
  }
  return `${field.type} field, not editable here`;
}
