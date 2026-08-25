import assert from 'node:assert';
import {
  deletePages,
  extractPages,
  insertPages,
  mergePdfs,
  reorderPages,
  rotatePages,
  splitPdf,
} from '@pdf-toolkit/core';
import { Command } from 'commander';
import { writeResult } from './inPlace.js';
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
    .version('0.1.0');

  program
    .command('merge')
    .description('merge PDFs into one, in the order given')
    .argument('<inputs...>', 'PDF files to merge')
    .requiredOption('-o, --output <file>', 'write the merged PDF here')
    .action(async (inputs: string[], options: { output: string }) => {
      await mergePdfs(inputs, options.output);
    });

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

  return program;
}
