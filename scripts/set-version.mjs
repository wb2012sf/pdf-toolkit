#!/usr/bin/env node
// Set the version everywhere it is declared.
//
//   npm run version:set 0.2.0
//
// The release workflow refuses to build when a tag disagrees with
// tauri.conf.json, and a test asserts all six files agree, so the point of
// this is to make the six-way edit one command rather than something to
// remember at 6pm on a Friday.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Files whose "version": "x.y.z" should be rewritten. */
const JSON_FILES = [
  'package.json',
  'packages/core/package.json',
  'packages/cli/package.json',
  'packages/desktop/package.json',
  'packages/desktop/src-tauri/tauri.conf.json',
];

const CARGO = 'packages/desktop/src-tauri/Cargo.toml';

// commander is told the version as a literal, and it is what `pdf-toolkit
// --version` prints. Miss it and the CLI cheerfully reports the previous
// release.
const PROGRAM = 'packages/cli/src/program.ts';

const version = process.argv[2];

if (version === undefined || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`usage: npm run version:set 1.2.3
  got: ${version ?? '(nothing)'}

Three numbers, no leading v: the tag adds that.`);
  process.exit(1);
}

// Rewrite the line rather than parsing and re-serialising, so formatting,
// key order and comments survive untouched.
// The check is that the declaration was found, not that it changed. A file
// already at the target version is fine, and conflating the two makes a
// re-run after a partial failure impossible, which is exactly when you want
// one.
for (const file of JSON_FILES) {
  const path = join(ROOT, file);
  const before = readFileSync(path, 'utf8');
  const pattern = /^(\s*"version"\s*:\s*)"[^"]*"/m;
  if (!pattern.test(before)) {
    console.error(`no version field found in ${file}, refusing to continue`);
    process.exit(1);
  }
  writeFileSync(path, before.replace(pattern, `$1"${version}"`));
  console.log(`  ${file}`);
}

// Only the [package] version, anchored to the start of a line. Dependency
// versions are inline, as `tauri = { version = "2", ... }`, and must not move.
const cargoPath = join(ROOT, CARGO);
const cargoBefore = readFileSync(cargoPath, 'utf8');
const cargoPattern = /^version = "[^"]*"/m;
if (!cargoPattern.test(cargoBefore)) {
  console.error(`no package version found in ${CARGO}, refusing to continue`);
  process.exit(1);
}
writeFileSync(
  cargoPath,
  cargoBefore.replace(cargoPattern, `version = "${version}"`)
);
console.log(`  ${CARGO}`);

const programPath = join(ROOT, PROGRAM);
const programBefore = readFileSync(programPath, 'utf8');
const programPattern = /\.version\('[^']*'\)/;
if (!programPattern.test(programBefore)) {
  console.error(
    `no .version(...) call found in ${PROGRAM}, refusing to continue`
  );
  process.exit(1);
}
writeFileSync(
  programPath,
  programBefore.replace(programPattern, `.version('${version}')`)
);
console.log(`  ${PROGRAM}`);

// The lockfile records each workspace's own version, so leaving it behind
// puts package.json and the lock out of step.
console.log('\nrefreshing package-lock.json');
const npm = spawnSync('npm', ['install', '--package-lock-only'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});
if (npm.status !== 0) {
  console.error('npm install --package-lock-only failed');
  process.exit(1);
}

console.log(`\nSet to ${version}. Next:

  npm test
  git commit -am "chore: ${version}"
  git tag v${version}
  git push origin main v${version}

The tag has to point at the commit that declares the version, so commit
before tagging.`);
