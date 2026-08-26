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
echo "Dependencies installed. Next:"
echo "  npm run build    compile core, then the cli"
echo "  npm test         typecheck and run the suite"
echo ""
echo "README.md covers usage, CLAUDE.md the conventions for changing this."
