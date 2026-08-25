#!/usr/bin/env bash
set -euo pipefail

# First-time setup for the pdf-toolkit monorepo.
# Run this once after cloning the repo on the VPS.

mkdir -p packages/core/src packages/core/test
mkdir -p packages/cli/src packages/cli/test

if [ ! -f packages/core/src/index.ts ]; then
  echo "export {};" > packages/core/src/index.ts
fi

if [ ! -f packages/cli/src/index.ts ]; then
  echo "export {};" > packages/cli/src/index.ts
fi

npm install

echo ""
echo "Scaffold ready. package-lock.json was generated, commit it."
echo "Next: point Claude Code at CLAUDE.md and start with a failing test"
echo "in packages/core/test for the first operation (e.g. merge)."
