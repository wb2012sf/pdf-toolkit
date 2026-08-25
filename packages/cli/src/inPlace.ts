import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Resolve where a command should write, run it there, and report the path.
 *
 * Without `--in-place` this is just the requested output path. With it, the
 * core operation still writes a separate file, because every one of them
 * refuses to write over its own input; the result is then renamed onto the
 * input. The rename is atomic within a directory, so the input is either the
 * old file or the new one, never a half written mix. A failure removes the
 * temporary file and leaves the input untouched.
 */
export async function writeResult(
  inputPath: string,
  output: string | undefined,
  inPlace: boolean,
  run: (outputPath: string) => Promise<void>
): Promise<string> {
  assert(
    output !== undefined || inPlace,
    'pass --output <file> to choose where to write, or --in-place to overwrite the input'
  );
  assert(
    !(output !== undefined && inPlace),
    'pass either --output <file> or --in-place, not both'
  );

  if (output !== undefined) {
    await run(output);
    return output;
  }

  // Same directory as the input, so the rename stays on one filesystem.
  const scratch = join(dirname(inputPath), `.pdf-toolkit-${randomUUID()}.tmp`);
  try {
    await run(scratch);
    await rename(scratch, inputPath);
  } catch (error) {
    await rm(scratch, { force: true });
    throw error;
  }
  return inputPath;
}
