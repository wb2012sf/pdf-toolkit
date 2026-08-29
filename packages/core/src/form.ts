import assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type FormFieldInfo,
  type FormFieldValue,
  fillFormBytes,
  flattenFormBytes,
  readFormFieldsBytes,
} from './bytes/form.js';

export type {
  FormFieldInfo,
  FormFieldOption,
  FormFieldType,
  FormFieldValue,
} from './bytes/form.js';

/**
 * Describe the form fields in a PDF on disk.
 *
 * Reading only, so there is no output path and nothing is written.
 */
export async function readFormFields(
  inputPath: string
): Promise<FormFieldInfo[]> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'readFormFields requires a non-empty input path'
  );

  return readFormFieldsBytes(await readFile(inputPath));
}

/**
 * Fill form fields by name, writing the filled copy to a new file.
 *
 * This is the filesystem wrapper. The work is in fillFormBytes, which has no
 * filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function fillForm(
  inputPath: string,
  values: Record<string, FormFieldValue>,
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'fillForm requires a non-empty input path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'fillForm requires a non-empty output path'
  );
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `fillForm refuses to overwrite an input file: ${inputPath}`
  );

  const result = await fillFormBytes(await readFile(inputPath), values);
  await writeFile(outputPath, result);
}

/**
 * Bake a form into the page content, writing the result to a new file.
 *
 * This is the filesystem wrapper. The work is in flattenFormBytes, which has
 * no filesystem dependency and so also runs in a browser or a Tauri webview.
 */
export async function flattenForm(
  inputPath: string,
  outputPath: string
): Promise<void> {
  assert(
    typeof inputPath === 'string' && inputPath.length > 0,
    'flattenForm requires a non-empty input path'
  );
  assert(
    typeof outputPath === 'string' && outputPath.length > 0,
    'flattenForm requires a non-empty output path'
  );
  assert(
    resolve(inputPath) !== resolve(outputPath),
    `flattenForm refuses to overwrite an input file: ${inputPath}`
  );

  const result = await flattenFormBytes(await readFile(inputPath));
  await writeFile(outputPath, result);
}
