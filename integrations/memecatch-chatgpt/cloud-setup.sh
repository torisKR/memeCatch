#!/usr/bin/env bash
set -euo pipefail

# Run inside the MemeCatch repository after the Cloud environment has cloned
# https://github.com/torisKR/memeCatch. This script does not create a Cloud VM.
test -f package.json
test -f pnpm-lock.yaml
node -e 'const m=Number(process.versions.node.split(".")[0]); if(m<22) throw new Error("Node 22+ is required")'
test "$(node -p 'require("./package.json").name')" = memecatch
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit --incremental false
pnpm exec vitest run

# Build separately after approved environment variables are available.
# pnpm build
