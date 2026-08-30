import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fillFormBytes,
  flattenFormBytes,
  readFormFieldsBytes,
} from '../src/bytes/form.js';
import { fillForm, flattenForm, readFormFields } from '../src/form.js';
import {
  formFieldCountOfBytes,
  formValuesOfBytes,
  makeFormPdf,
  makeTestPdf,
  makeVariedFormPdf,
} from './helpers.js';

describe('readFormFieldsBytes', () => {
  it('describes every field, by name and kind', async () => {
    const fields = await readFormFieldsBytes(await makeFormPdf());

    expect(fields.map((field) => [field.name, field.type])).toEqual([
      ['applicant.name', 'text'],
      ['agree', 'checkbox'],
      ['country', 'dropdown'],
    ]);
  });

  it('offers the choices a dropdown accepts', async () => {
    const fields = await readFormFieldsBytes(await makeFormPdf());
    const country = fields.find((field) => field.name === 'country');

    expect(country?.options?.map((option) => option.value)).toEqual([
      'CH',
      'DE',
      'FR',
    ]);
  });

  it('falls back to the field name when there is no label', async () => {
    // These fixtures carry no /TU entry, so the name is all there is. A real
    // form usually has one, and that is what a person should be shown.
    const fields = await readFormFieldsBytes(await makeFormPdf());

    expect(fields.map((field) => field.label)).toEqual([
      'applicant.name',
      'agree',
      'country',
    ]);
  });

  it('reports which page a field sits on', async () => {
    const fields = await readFormFieldsBytes(await makeFormPdf());

    expect(fields.map((field) => field.pageNumber)).toEqual([1, 1, 1]);
  });

  it('gives an empty list for a document with no form', async () => {
    expect(await readFormFieldsBytes(await makeTestPdf([[200, 201]]))).toEqual(
      []
    );
  });

  it('rejects anything that is not a Uint8Array', async () => {
    await expect(readFormFieldsBytes('not bytes' as never)).rejects.toThrow(
      /Uint8Array/
    );
  });
});

describe('fillFormBytes', () => {
  it('sets values pdf-lib then reads back', async () => {
    const filled = await fillFormBytes(await makeFormPdf(), {
      'applicant.name': 'Ada Lovelace',
      agree: true,
      country: 'DE',
    });

    expect(await formValuesOfBytes(filled)).toEqual({
      name: 'Ada Lovelace',
      agree: true,
      country: ['DE'],
    });
  });

  it('leaves fields it was not asked about alone', async () => {
    const filled = await fillFormBytes(await makeFormPdf(), {
      'applicant.name': 'Grace Hopper',
    });

    expect(await formValuesOfBytes(filled)).toEqual({
      name: 'Grace Hopper',
      agree: false,
      country: [],
    });
  });

  it('refuses a field name the document does not have', async () => {
    // LibPDF's own fill() reports this in a skipped list and carries on, so a
    // typo would quietly do nothing. This is the guard against that.
    await expect(
      fillFormBytes(await makeFormPdf(), { aplicant: 'typo' })
    ).rejects.toThrow(/no field called "aplicant"/);
  });

  it('names every unknown field, not just the first', async () => {
    await expect(
      fillFormBytes(await makeFormPdf(), { one: 'x', two: 'y' })
    ).rejects.toThrow(/"one", "two"/);
  });

  it('says so plainly when the document has no form', async () => {
    await expect(
      fillFormBytes(await makeTestPdf([[200, 201]]), { anything: 'x' })
    ).rejects.toThrow(/has no form/);
  });

  it('rejects an empty set of values', async () => {
    await expect(fillFormBytes(await makeFormPdf(), {})).rejects.toThrow(
      /at least one field/
    );
  });

  it('rejects anything that is not a Uint8Array', async () => {
    await expect(
      fillFormBytes('not bytes' as never, { agree: true })
    ).rejects.toThrow(/Uint8Array/);
  });
});

describe('flattenFormBytes', () => {
  it('leaves no editable fields behind', async () => {
    const filled = await fillFormBytes(await makeFormPdf(), {
      'applicant.name': 'Ada Lovelace',
      agree: true,
    });

    const flat = await flattenFormBytes(filled);

    expect(await formFieldCountOfBytes(filled)).toBe(3);
    expect(await formFieldCountOfBytes(flat)).toBe(0);
  });

  it('says so plainly when the document has no form', async () => {
    await expect(
      flattenFormBytes(await makeTestPdf([[200, 201]]))
    ).rejects.toThrow(/has no form/);
  });

  it('rejects anything that is not a Uint8Array', async () => {
    await expect(flattenFormBytes('not bytes' as never)).rejects.toThrow(
      /Uint8Array/
    );
  });
});

describe('the filesystem wrappers', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('reads, fills and flattens through paths', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'form.pdf');
    const filled = join(dir, 'filled.pdf');
    const flat = join(dir, 'flat.pdf');
    await writeFile(source, await makeFormPdf());

    expect((await readFormFields(source)).map((field) => field.name)).toEqual([
      'applicant.name',
      'agree',
      'country',
    ]);

    await fillForm(source, { 'applicant.name': 'Ada Lovelace' }, filled);
    await flattenForm(filled, flat);

    expect((await readFormFields(flat)).length).toBe(0);
  });

  it('refuses to write over its own input', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pdf-toolkit-'));
    const source = join(dir, 'form.pdf');
    await writeFile(source, await makeFormPdf());

    await expect(fillForm(source, { agree: true }, source)).rejects.toThrow(
      /refuses to overwrite an input file/
    );
  });
});

describe('the field varieties a real form uses', () => {
  async function fieldNamed(name: string) {
    const fields = await readFormFieldsBytes(await makeVariedFormPdf());
    const found = fields.find((field) => field.name === name);
    expect(found, `no field called ${name}`).toBeDefined();
    return found as NonNullable<typeof found>;
  }

  it('reports a length limit, so a PIN box can enforce four digits', async () => {
    expect((await fieldNamed('pin')).maxLength).toBe(4);
  });

  it('leaves maxLength off a field that states no limit', async () => {
    // Fields report 0 for "no limit", which is not a limit of zero.
    expect((await fieldNamed('comments')).maxLength).toBeUndefined();
  });

  it('reports a multiline field, which needs more than one line of box', async () => {
    expect((await fieldNamed('comments')).multiline).toBe(true);
    expect((await fieldNamed('pin')).multiline).toBe(false);
  });

  it('keeps the value of a read only field, so it can still be shown', async () => {
    const reference = await fieldNamed('reference');

    expect(reference.readOnly).toBe(true);
    expect(reference.value).toBe('PRE-FILLED-123');
  });

  it('reports a combo box that accepts a value of its own', async () => {
    expect((await fieldNamed('city')).editable).toBe(true);
  });

  it('reports a listbox that takes more than one answer', async () => {
    expect((await fieldNamed('hobbies')).multiSelect).toBe(true);
  });

  it('labels a radio group readably while keeping the value it stores', async () => {
    // The appearance state is what the field stores and what fill() takes,
    // and it is frequently just "0" and "1". The export value is the wording
    // a person should see. Showing the wrong one either confuses the reader
    // or produces a value the document rejects.
    const contact = await fieldNamed('contact');

    expect(contact.type).toBe('radio');
    expect(contact.options).toEqual([
      { value: '0', display: 'Email' },
      { value: '1', display: 'Phone' },
    ]);
  });

  it('still fills every one of them', async () => {
    const filled = await fillFormBytes(await makeVariedFormPdf(), {
      pin: '1234',
      comments: 'Two\nlines',
      city: 'Geneva',
      hobbies: ['Chess', 'Reading'],
      // The stored value, not the label: see the radio test above.
      contact: '1',
    });

    const after = await readFormFieldsBytes(filled);
    const value = (name: string) =>
      after.find((field) => field.name === name)?.value;

    expect(value('pin')).toBe('1234');
    expect(value('comments')).toBe('Two\nlines');
    // Not one of the listed options, which is the point of an editable combo.
    expect(value('city')).toBe('Geneva');
    expect(value('hobbies')).toEqual(['Chess', 'Reading']);
    expect(value('contact')).toBe('1');
  });
});
