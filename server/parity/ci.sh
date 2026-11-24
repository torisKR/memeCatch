#!/usr/bin/env bash
# The parity gates that need no outside host, on one seeded database, against
# a Next standalone build and three Axum servers. CI runs it (`parity` job);
# locally, from the repository root:
#
#   RELEASE_SHA=ci NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 pnpm build
#   (cd server && cargo build)
#   export TEST_DB_CONTAINER=memecatch-parity-pg
#   DATABASE_URL="$(server/scripts/test-db.sh up)" bash server/parity/ci.sh [gate...]
#
# Gates (all by default): pages text public alone images csp. Each runs to the
# end; the script exits 1 when any differed, and prints each gate's time.
#
# Servers, all with the build's RELEASE_SHA and NEXT_PUBLIC_SITE_URL:
#   3001  Next (.next/standalone)
#   3100  Axum in front of it, every page switched on (the page gate)
#   3101  Axum in front of it, pages off (byte comparisons: Axum proxies pages)
#   3200  Axum without upstream (C1's mode, MEMECATCH_NEXT=0)
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
: "${DATABASE_URL:?DATABASE_URL is required (server/scripts/test-db.sh up)}"
container="${TEST_DB_CONTAINER:-memecatch-axum-test-pg}"
axum_bin="${AXUM_BIN:-$root/server/target/debug/memecatch-server}"
release="${RELEASE_SHA:-ci}"
site="${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3001}"
work="$(mktemp -d)"
standalone="$root/.next/standalone"
NEXT=http://127.0.0.1:3001
AXUM=http://127.0.0.1:3100
PROXY=http://127.0.0.1:3101
ALONE=http://127.0.0.1:3200
PAGES_ON="$(node -e '
  const src = require("fs").readFileSync(process.argv[1], "utf8");
  const list = src.match(/PAGE_ROUTE_IDS: \[&str; \d+\] = \[([^\]]*)\]/)[1];
  console.log([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).join(","));
' server/src/routes/mod.rs)"

pids=()
cleanup() {
  local pid
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  rm -rf "$work"
}
trap cleanup EXIT

psql() { docker exec -i "$container" psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q; }

seed() {
  psql <server/parity/pages/seed.sql
  psql <server/parity/pages/b2-seed.sql
  node server/parity/directory-catalog.mjs sql | psql
  psql <server/parity/pages/b2b-seed.sql
}

wait_up() {
  local url="$1" name="$2" log="$3" i
  for ((i = 0; i < 120; i++)); do
    curl -fsS -o /dev/null --max-time 5 "$url/api/health" && return 0
    sleep 1
  done
  echo "$name did not become healthy; its log:" >&2
  tail -n 50 "$log" >&2
  exit 1
}

start_next() {
  [[ -f "$standalone/server.js" ]] || { echo "no Next build: run pnpm build first" >&2; exit 1; }
  # As the image does: the build's static files and public/ beside server.js.
  rm -rf "$standalone/.next/static" "$standalone/public" "$standalone/.next/cache"
  cp -a .next/static "$standalone/.next/static"
  cp -a public "$standalone/public"
  # The ISR copies prerendered at build time (no database then) would answer
  # the first request; Next renders these from the database instead.
  rm -rf "$standalone"/.next/server/app/{news,weekly,slang}.{html,rsc,meta,segments}
  rm -rf "$standalone"/.next/server/app/collections
  ( cd "$standalone" && exec env DATABASE_URL="$DATABASE_URL" BETTER_AUTH_SECRET=parity-only-auth-secret \
      PORT=3001 HOSTNAME=127.0.0.1 node server.js ) >"$work/next.log" 2>&1 &
  pids+=($!)
  wait_up "$NEXT" Next "$work/next.log"
}

# start_axum <port> <name> NAME=VALUE...
start_axum() {
  local port="$1" name="$2"
  shift 2
  env DATABASE_URL="$DATABASE_URL" BETTER_AUTH_SECRET=parity-only-auth-secret PORT="$port" \
    RELEASE_SHA="$release" NEXT_PUBLIC_SITE_URL="$site" NODE_ENV=development \
    AXUM_PUBLIC_DIR="$standalone/public" "$@" "$axum_bin" >"$work/$name.log" 2>&1 &
  pids+=($!)
  wait_up "http://127.0.0.1:$port" "$name" "$work/$name.log"
}

failed=()
gate() {
  local name="$1" start rc=0
  shift
  start="$(date +%s)"
  echo "::group::gate $name"
  "$@" || rc=$?
  echo "::endgroup::"
  echo "gate $name: $([[ "$rc" == 0 ]] && echo same || echo "DIFFERS (exit $rc)") in $(($(date +%s) - start)) s"
  [[ "$rc" == 0 ]] || failed+=("$name")
}

gate_pages() { node server/parity/pages/pages.mjs "$NEXT" "$AXUM" --concurrency=1; }
gate_text() {
  # /api/quiz without a set draws at random: on this seed its status changes
  # from one request to the next on Next alone. cards-quiz.mjs compares it.
  grep -vxE '(HEAD )?/api/quiz' server/parity/paths.txt >"$work/paths.txt"
  node server/parity/parity.mjs "$NEXT" "$PROXY" "$work/paths.txt"
}
gate_public() {
  node server/parity/public-targets.mjs "$standalone/public" >"$work/public-targets.txt"
  node server/parity/parity.mjs "$NEXT" "$PROXY" "$work/public-targets.txt" \
    /sitemap.xml /favicon.ico /icon.svg /apple-icon.png /manifest.webmanifest
}
gate_alone() { node server/parity/parity.mjs "$NEXT" "$ALONE" server/parity/standalone-targets.txt; }
gate_images() { node server/parity/images.mjs "$NEXT" "$ALONE" "$standalone/public"; }
gate_csp() { node server/parity/csp-report.mjs "$NEXT" "$PROXY"; }

gates=("$@")
(( ${#gates[@]} )) || gates=(pages text public alone images csp)

seed
start_next
start_axum 3100 axum-pages UPSTREAM_URL="$NEXT" AXUM_PILOT_ROUTES="$PAGES_ON"
start_axum 3101 axum-proxy UPSTREAM_URL="$NEXT"
start_axum 3200 axum-alone AXUM_NO_UPSTREAM=true
for name in "${gates[@]}"; do
  declare -F "gate_$name" >/dev/null || { echo "no gate $name" >&2; exit 2; }
  gate "$name" "gate_$name"
done
if (( ${#failed[@]} )); then
  for log in "$work"/*.log; do
    echo "::group::$(basename "$log")"; tail -n 40 "$log"; echo "::endgroup::"
  done
  echo "parity: differences in ${failed[*]}" >&2
  exit 1
fi
echo "parity: every gate the same"
