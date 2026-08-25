#!/usr/bin/env node
import { buildProgram } from './program.js';

export { buildProgram } from './program.js';

/**
 * Report a failure as a one line message rather than a stack trace. Bad input
 * is the expected failure here, and a wall of frames buries what went wrong.
 */
async function main(): Promise<void> {
  try {
    await buildProgram().parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`pdf-toolkit: ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
