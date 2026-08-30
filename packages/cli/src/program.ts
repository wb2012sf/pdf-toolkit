import assert from 'node:assert';
import {
  type EncryptionAlgorithm,
  type FormFieldInfo,
  type FormFieldValue,
  type PdfPermissions,
  type SignatureWarning,
  deletePages,
  extractPages,
  fillForm,
  flattenForm,
  insertPages,
  mergePdfs,
  protectPdf,
  readFormFields,
  reorderPages,
  rotatePages,
  signPdf,
  splitPdf,
  unlockPdf,
} from '@pdf-toolkit/core';
import { Command } from 'commander';
import { writeResult } from './inPlace.js';
import { type SortMode, resolveInputs } from './inputs.js';
import { parsePageSpec } from './pages.js';

interface OutputOptions {
  output?: string | undefined;
  inPlace?: boolean | undefined;
}

/** Parse a whole-number flag such as --at or --degrees. */
function parseWholeNumber(value: string, flagName: string): number {
  assert(
    /^-?\d+$/.test(value.trim()),
    `${flagName} needs a whole number, got "${value}"`
  );
  return Number(value.trim());
}

/**
 * Commander sets a `--no-x` flag to true unless it was passed, so the
 * permissions to send are exactly the ones that came back false. Anything the
 * user did not mention is left out and stays allowed.
 */
function forbiddenPermissions(
  flags: Partial<Record<keyof PdfPermissions, boolean>>
): Partial<PdfPermissions> {
  const permissions: Partial<PdfPermissions> = {};
  for (const [name, allowed] of Object.entries(flags)) {
    if (allowed === false) {
      permissions[name as keyof PdfPermissions] = false;
    }
  }
  return permissions;
}

/**
 * Parse one repeated `--set name=value` pair.
 *
 * Only the first `=` splits, so a value may contain more of them. "true" and
 * "false" become booleans because that is what a checkbox needs; everything
 * else stays the string it was typed as.
 */
function collectFieldValue(
  pair: string,
  collected: Record<string, FormFieldValue>
): Record<string, FormFieldValue> {
  const split = pair.indexOf('=');
  assert(split > 0, `--set needs field=value, got "${pair}"`);
  const name = pair.slice(0, split);
  const raw = pair.slice(split + 1);
  const value = raw === 'true' ? true : raw === 'false' ? false : raw;
  return { ...collected, [name]: value };
}

/** One field, described for someone reading a terminal. */
function describeField(field: FormFieldInfo): string {
  const parts = [`${field.name}  [${field.type}]`];
  if (field.label !== field.name) {
    parts.push(`  label: ${field.label}`);
  }
  if (field.pageNumber !== undefined) {
    parts.push(`  page: ${field.pageNumber}`);
  }
  if (field.options !== undefined && field.options.length > 0) {
    parts.push(
      `  options: ${field.options.map((option) => option.value).join(', ')}`
    );
  }
  const flags = [
    field.required ? 'required' : undefined,
    field.readOnly ? 'read only' : undefined,
  ].filter((flag) => flag !== undefined);
  if (flags.length > 0) {
    parts.push(`  ${flags.join(', ')}`);
  }
  return parts.join('\n');
}

/** Attach the shared destination flags to a single-input command. */
function withDestination(command: Command): Command {
  return command
    .option('-o, --output <file>', 'write the result to this file')
    .option('--in-place', 'overwrite the input file instead', false);
}

/**
 * Build the pdf-toolkit command tree.
 *
 * Commands are non-destructive by default: each writes to --output, and only
 * touches the input when --in-place is passed explicitly. Merge and split are
 * the exceptions with no --in-place, because merge has several inputs and no
 * obvious one to overwrite, and split produces a directory of files.
 */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name('pdf-toolkit')
    .description('Page level PDF manipulation')
    .version('0.2.0');

  program
    .command('merge')
    .description('merge PDFs into one, in the order given')
    .argument('<inputs...>', 'PDF files to merge, wildcards allowed')
    .requiredOption('-o, --output <file>', 'write the merged PDF here')
    .option(
      '-s, --sort <mode>',
      'order the inputs by file name: name or name-desc'
    )
    .action(
      async (
        inputs: string[],
        options: { output: string; sort?: string | undefined }
      ) => {
        const files = await resolveInputs(
          inputs,
          options.sort as SortMode | undefined,
          options.output
        );
        await mergePdfs(files, options.output);
      }
    );

  program
    .command('split')
    .description('split a PDF into one file per page')
    .argument('<input>', 'PDF file to split')
    .requiredOption('-o, --output-dir <dir>', 'write the page files here')
    .action(async (input: string, options: { outputDir: string }) => {
      await splitPdf(input, options.outputDir);
    });

  withDestination(
    program
      .command('delete')
      .description('delete pages from a PDF')
      .argument('<input>', 'PDF file to read')
      .requiredOption('-p, --pages <spec>', 'pages to delete, such as 1,3,5-7')
  ).action(
    async (input: string, options: OutputOptions & { pages: string }) => {
      const pages = parsePageSpec(options.pages, '--pages');
      await writeResult(
        input,
        options.output,
        options.inPlace === true,
        (target) => deletePages(input, pages, target)
      );
    }
  );

  withDestination(
    program
      .command('insert')
      .description('insert every page of one PDF into another')
      .argument('<base>', 'PDF file to insert into')
      .argument('<insert>', 'PDF file whose pages are inserted')
      .requiredOption(
        '--at <page>',
        'page number the first inserted page takes'
      )
  ).action(
    async (
      base: string,
      insert: string,
      options: OutputOptions & { at: string }
    ) => {
      const at = parseWholeNumber(options.at, '--at');
      await writeResult(
        base,
        options.output,
        options.inPlace === true,
        (target) => insertPages(base, insert, at, target)
      );
    }
  );

  withDestination(
    program
      .command('reorder')
      .description('rearrange a PDF into a new page order')
      .argument('<input>', 'PDF file to read')
      .requiredOption(
        '--order <spec>',
        'every page exactly once, such as 3,1,2 or 5-1'
      )
  ).action(
    async (input: string, options: OutputOptions & { order: string }) => {
      const order = parsePageSpec(options.order, '--order');
      await writeResult(
        input,
        options.output,
        options.inPlace === true,
        (target) => reorderPages(input, order, target)
      );
    }
  );

  withDestination(
    program
      .command('rotate')
      .description('rotate pages by a multiple of 90 degrees')
      .argument('<input>', 'PDF file to read')
      .requiredOption('-d, --degrees <n>', 'rotation to add, such as 90 or -90')
      .option('-p, --pages <spec>', 'pages to rotate, default every page')
  ).action(
    async (
      input: string,
      options: OutputOptions & { degrees: string; pages?: string | undefined }
    ) => {
      const degrees = parseWholeNumber(options.degrees, '--degrees');
      const pages =
        options.pages === undefined
          ? undefined
          : parsePageSpec(options.pages, '--pages');
      await writeResult(
        input,
        options.output,
        options.inPlace === true,
        (target) => rotatePages(input, degrees, target, pages)
      );
    }
  );

  withDestination(
    program
      .command('extract')
      .description('extract pages into a new PDF')
      .argument('<input>', 'PDF file to read')
      .requiredOption('-p, --pages <spec>', 'pages to extract, in this order')
  ).action(
    async (input: string, options: OutputOptions & { pages: string }) => {
      const pages = parsePageSpec(options.pages, '--pages');
      await writeResult(
        input,
        options.output,
        options.inPlace === true,
        (target) => extractPages(input, pages, target)
      );
    }
  );

  withDestination(
    program
      .command('protect')
      .description('encrypt a PDF with a password')
      .argument('<input>', 'PDF file to read')
      .option(
        '-p, --password <password>',
        'password required to open the result'
      )
      .option(
        '--owner-password <password>',
        'password that lifts the restrictions for whoever holds it'
      )
      .option(
        '-a, --algorithm <name>',
        'RC4-40, RC4-128, AES-128 or AES-256, default AES-256'
      )
      .option('--no-print', 'forbid printing')
      .option('--no-print-high-quality', 'allow only low resolution printing')
      .option('--no-modify', 'forbid changing the contents')
      .option('--no-copy', 'forbid copying text and graphics')
      .option('--no-annotate', 'forbid adding or changing annotations')
      .option('--no-fill-forms', 'forbid filling in form fields')
      .option('--no-accessibility', 'forbid extraction for accessibility')
      .option('--no-assemble', 'forbid inserting, rotating and deleting pages')
  ).action(
    async (
      input: string,
      options: OutputOptions & {
        password?: string | undefined;
        ownerPassword?: string | undefined;
        algorithm?: string | undefined;
      } & Partial<Record<keyof PdfPermissions, boolean>>
    ) => {
      const {
        output,
        inPlace,
        password,
        ownerPassword,
        algorithm,
        ...permissionFlags
      } = options;
      assert(
        password !== undefined || ownerPassword !== undefined,
        'pass --password, --owner-password, or both'
      );

      await writeResult(input, output, inPlace === true, (target) =>
        protectPdf(
          input,
          {
            ...(password === undefined ? {} : { userPassword: password }),
            ...(ownerPassword === undefined ? {} : { ownerPassword }),
            ...(algorithm === undefined
              ? {}
              : { algorithm: algorithm as EncryptionAlgorithm }),
            permissions: forbiddenPermissions(permissionFlags),
          },
          target
        )
      );
    }
  );

  withDestination(
    program
      .command('unlock')
      .description('remove password protection from a PDF')
      .argument('<input>', 'protected PDF file to read')
      .requiredOption(
        '-p, --password <password>',
        'a password that opens the document'
      )
  ).action(
    async (input: string, options: OutputOptions & { password: string }) => {
      await writeResult(
        input,
        options.output,
        options.inPlace === true,
        (target) => unlockPdf(input, options.password, target)
      );
    }
  );

  withDestination(
    program
      .command('sign')
      .description('sign a PDF with a certificate, invisibly')
      .argument('<input>', 'PDF file to sign')
      .requiredOption(
        '-c, --certificate <file>',
        'PKCS#12 file holding the key and certificate, .p12 or .pfx'
      )
      .requiredOption(
        '-p, --password <password>',
        'password that opens the certificate file'
      )
      .option('--reason <text>', 'why the document is being signed')
      .option('--location <text>', 'where it is being signed')
      .option('--contact <text>', 'how to reach the signer')
      .option(
        '--field <name>',
        'signature field to use, created if it does not exist'
      )
  ).action(
    async (
      input: string,
      options: OutputOptions & {
        certificate: string;
        password: string;
        reason?: string | undefined;
        location?: string | undefined;
        contact?: string | undefined;
        field?: string | undefined;
      }
    ) => {
      let warnings: SignatureWarning[] = [];
      await writeResult(
        input,
        options.output,
        options.inPlace === true,
        async (target) => {
          warnings = await signPdf(
            input,
            {
              certificatePath: options.certificate,
              password: options.password,
              ...(options.reason === undefined
                ? {}
                : { reason: options.reason }),
              ...(options.location === undefined
                ? {}
                : { location: options.location }),
              ...(options.contact === undefined
                ? {}
                : { contactInfo: options.contact }),
              ...(options.field === undefined
                ? {}
                : { fieldName: options.field }),
            },
            target
          );
        }
      );

      // Signing can succeed and still have something to say. Say it.
      for (const warning of warnings) {
        process.stderr.write(`warning: ${warning.code}: ${warning.message}\n`);
      }
    }
  );

  program
    .command('fields')
    .description('list the form fields in a PDF')
    .argument('<input>', 'PDF file to read')
    .action(async (input: string) => {
      const fields = await readFormFields(input);
      if (fields.length === 0) {
        process.stdout.write('This document has no form fields.\n');
        return;
      }
      process.stdout.write(`${fields.map(describeField).join('\n\n')}\n`);
    });

  withDestination(
    program
      .command('fill')
      .description('fill form fields by name')
      .argument('<input>', 'PDF file to read')
      .requiredOption(
        '-s, --set <field=value>',
        'set a field, repeat for each one; true and false set a checkbox',
        collectFieldValue,
        {}
      )
  ).action(
    async (
      input: string,
      options: OutputOptions & { set: Record<string, FormFieldValue> }
    ) => {
      await writeResult(
        input,
        options.output,
        options.inPlace === true,
        (target) => fillForm(input, options.set, target)
      );
    }
  );

  withDestination(
    program
      .command('flatten')
      .description('bake a form into the page, leaving it no longer editable')
      .argument('<input>', 'PDF file to read')
  ).action(async (input: string, options: OutputOptions) => {
    await writeResult(
      input,
      options.output,
      options.inPlace === true,
      (target) => flattenForm(input, target)
    );
  });

  return program;
}
