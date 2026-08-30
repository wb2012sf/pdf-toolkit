import type { FormFieldInfo, FormFieldValue } from '@pdf-toolkit/core/bytes';

/**
 * Which kind of control stands in for a field on the page.
 *
 * More than one maps to a text field or a choice field, because the flags
 * matter: a multiline field needs a box rather than a line, an editable combo
 * has to accept a value that is not on its list, and a listbox that takes
 * several answers cannot be a plain select.
 */
export type FieldControl =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'combo'
  | 'multiselect';

/**
 * The control that represents this field, or undefined when it has none.
 *
 * A read only field has no control because it cannot be edited, but it still
 * has a value worth showing, so callers should display it rather than skip it.
 * A signature or button field is not something this screen can fill in.
 */
export function controlFor(field: FormFieldInfo): FieldControl | undefined {
  if (field.readOnly) {
    return undefined;
  }
  switch (field.type) {
    case 'text':
      return field.multiline ? 'textarea' : 'text';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'dropdown':
      return field.editable ? 'combo' : 'select';
    case 'listbox':
      return field.multiSelect ? 'multiselect' : 'select';
    default:
      return undefined;
  }
}

/** What a control currently holds, before it becomes a field value. */
export type ControlState = string | boolean | string[];

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
      values[field.name] = asList(state);
    } else {
      values[field.name] = Array.isArray(state)
        ? (state[0] ?? '')
        : String(state);
    }
  }

  return values;
}

/** A listbox value, whether one option was chosen or several. */
function asList(state: ControlState): string[] {
  if (Array.isArray(state)) {
    return state;
  }
  const single = String(state);
  return single.length === 0 ? [] : [single];
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

/** What a read only field should show, since it still carries a value. */
export function displayValue(field: FormFieldInfo): string {
  const { value } = field;
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  // A checkbox stores "Off" when clear, which is jargon on a read only field.
  return value === 'Off' ? 'No' : value;
}
