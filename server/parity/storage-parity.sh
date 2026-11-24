#!/usr/bin/env bash
# Checks server/src/storage against lib/object-storage.ts, the storage the
# mpe-worker uses: both read and write the same objects and signed URLs.
#
#   server/parity/storage-parity.sh
#
# 1. The committed fixture (server/tests/fixtures/object-storage-ts.json, which
#    `cargo test` reads) is what the TypeScript produces today.
# 2. The TypeScript writes objects into a fresh local directory and mints
#    signed URLs for them.
# 3. Rust verifies those URLs, reads those objects, lists the same folders,
#    then writes objects and mints URLs of its own.
# 4. The TypeScript verifies, reads and lists what Rust wrote.
#
# Needs Node 22.18 or newer (it runs the .ts file as it is) and the packages
# of the repository root (`npx pnpm@10 install`, for aws4fetch). It uses no
# network, no R2 and no .env file: every secret is a constant in
# storage-parity.mjs.
#
# To refresh the fixture after a change to lib/object-storage.ts:
#   node server/parity/storage-parity.mjs fixture > server/tests/fixtures/object-storage-ts.json
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
export NODE_NO_WARNINGS=1

dir="${STORAGE_PARITY_DIR:-}"
if [[ -z "$dir" ]]; then
  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' EXIT
fi

echo "== 1. the committed fixture is what lib/object-storage.ts produces now"
node server/parity/storage-parity.mjs fixture | diff - server/tests/fixtures/object-storage-ts.json
echo "identical"

echo "== 2. TypeScript writes objects and mints signed URLs"
node server/parity/storage-parity.mjs seed "$dir"

echo "== 3. Rust checks them, then writes objects and mints URLs of its own"
(cd server && STORAGE_PARITY_DIR="$dir" cargo test --quiet --test storage_parity -- --ignored --nocapture)

echo "== 4. TypeScript checks what Rust wrote"
node server/parity/storage-parity.mjs check "$dir"
