#!/usr/bin/env bash
# Checks server/src/storage.rs against the real lib/object-storage.ts.
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
#
# /api/media/signed on Next and on Axum
# -------------------------------------
# Step 2 and 3 also write media-targets.txt, the requests to compare with
# parity.mjs. Keep the directory, start both servers on it within the hour the
# URLs are valid for, and run the harness:
#
#   export STORAGE_PARITY_DIR="$(mktemp -d)"
#   server/parity/storage-parity.sh
#   # Next (production build), port 3001, and Axum in front of it, port 3100,
#   # both with the values of the "env" object in $STORAGE_PARITY_DIR/ts.json:
#   #   OBJECT_SIGNING_SECRET, BETTER_AUTH_SECRET, NEXT_PUBLIC_SITE_URL,
#   #   LOCAL_OBJECT_STORAGE_DIR
#   # and no R2_* value. Axum also needs the RELEASE_SHA of the Next build.
#   node server/parity/parity.mjs http://127.0.0.1:3001 http://127.0.0.1:3100 \
#     "$STORAGE_PARITY_DIR/media-targets.txt"
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
