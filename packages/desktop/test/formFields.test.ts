import type { FormFieldInfo } from '@pdf-toolkit/core/bytes';
import { describe, expect, it } from 'vitest';
import {
  collectValues,
  controlFor,
  labelFor,
  whyNotEditable,
} from '../src/formFields.js';

function field(over: Partial<FormFieldInfo>): FormFieldInfo {
  return {
    name: 'a',
    type: 'text',
    label: 'a',
    value: '',
    readOnly: false,
    required: false,
    ...over,
  };
}

describe('controlFor', () => {
  it('maps each editable kind to a control', () => {
    expect(controlFor(field({ type: 'text' }))).toBe('text');
    expect(controlFor(field({ type: 'checkbox' }))).toBe('checkbox');
    expect(controlFor(field({ type: 'dropdown' }))).toBe('choice');
    expect(controlFor(field({ type: 'listbox' }))).toBe('choice');
    expect(controlFor(field({ type: 'radio' }))).toBe('choice');
  });

  it('gives a read only field no control, whatever its kind', () => {
    expect(controlFor(field({ type: 'text', readOnly: true }))).toBeUndefined();
  });

  it('gives a signature or button field no control', () => {
    expect(controlFor(field({ type: 'signature' }))).toBeUndefined();
    expect(controlFor(field({ type: 'button' }))).toBeUndefined();
    expect(controlFor(field({ type: 'unknown' }))).toBeUndefined();
  });
});

describe('collectValues', () => {
  it('sends a text field as a string', () => {
    const fields = [field({ name: 'who', type: 'text' })];

    expect(collectValues(fields, new Map([['who', 'Ada']]))).toEqual({
      who: 'Ada',
    });
  });

  it('sends a checkbox as a boolean, ticked or not', () => {
    const fields = [field({ name: 'agree', type: 'checkbox' })];

    expect(collectValues(fields, new Map([['agree', true]]))).toEqual({
      agree: true,
    });
    expect(collectValues(fields, new Map([['agree', false]]))).toEqual({
      agree: false,
    });
  });

  it('wraps a listbox value in an array, since that is what it takes', () => {
    const fields = [field({ name: 'langs', type: 'listbox' })];

    expect(collectValues(fields, new Map([['langs', 'de']]))).toEqual({
      langs: ['de'],
    });
  });

  it('sends an empty listbox as an empty array, not an empty string', () => {
    const fields = [field({ name: 'langs', type: 'listbox' })];

    expect(collectValues(fields, new Map([['langs', '']]))).toEqual({
      langs: [],
    });
  });

  it('leaves out a field that has no control', () => {
    // Sending a read only or signature field back would be rejected by the
    // engine, and there is nothing the screen could have changed anyway.
    const fields = [
      field({ name: 'locked', type: 'text', readOnly: true }),
      field({ name: 'sig', type: 'signature' }),
      field({ name: 'who', type: 'text' }),
    ];

    const held = new Map<string, string | boolean>([
      ['locked', 'nope'],
      ['sig', 'nope'],
      ['who', 'Ada'],
    ]);

    expect(collectValues(fields, held)).toEqual({ who: 'Ada' });
  });

  it('leaves out a field no control reported a value for', () => {
    const fields = [field({ name: 'who', type: 'text' })];

    expect(collectValues(fields, new Map())).toEqual({});
  });
});

describe('labelFor', () => {
  it('prefers the label, which is where the /TU entry lands', () => {
    expect(labelFor(field({ name: 'f1_07[0]', label: 'Your name' }))).toBe(
      'Your name'
    );
  });

  it('falls back to the name when the label is empty', () => {
    expect(labelFor(field({ name: 'f1_07[0]', label: '' }))).toBe('f1_07[0]');
  });
});

describe('whyNotEditable', () => {
  it('says nothing about a field that can be edited', () => {
    expect(whyNotEditable(field({ type: 'text' }))).toBeUndefined();
  });

  it('explains a read only field', () => {
    expect(whyNotEditable(field({ readOnly: true }))).toBe('read only');
  });

  it('points a signature field at the tab that handles it', () => {
    expect(whyNotEditable(field({ type: 'signature' }))).toMatch(/Sign tab/);
  });
});
