#!/usr/bin/env bash
# The behaviour scenarios against the server alone, from the repository root:
# a fresh test database from the migrations with the standard seeds, the
# OpenAI stub on loopback HTTPS, a release build of the server, Playwright.
#
#   server/behaviour/run.sh [playwright args]   # up, the scenarios, down
#   server/behaviour/run.sh up                  # leave it running, print the env
#   server/behaviour/run.sh down
#
# Needs the release binary (cargo build --release in server/, or SERVER_BIN),
# Docker, openssl and node_modules. TEST_DB_CONTAINER, BEHAVIOUR_PORT and
# BEHAVIOUR_STUB_PORT pick the container and ports. Nothing reaches outside
# the machine: the server's only configured outside service is the stub.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
export TEST_DB_CONTAINER="${TEST_DB_CONTAINER:-memecatch-behaviour-pg}"
port="${BEHAVIOUR_PORT:-3001}"
stub_port="${BEHAVIOUR_STUB_PORT:-3444}"
server_bin="${SERVER_BIN:-$root/server/target/release/memecatch-server}"
state="${TMPDIR:-/tmp}/memecatch-behaviour-$TEST_DB_CONTAINER"

# The seeds every scenario starts from, in this order (README.md).
SEEDS=(seed b2-catalog b2-seed b2b-seed b3-seed b4-seed b5-seed b6-community b6-meme-community b6-submit b7-seed)

# By the PIDs this script wrote, never by name.
stop_pid() {
  [[ -f "$state/$1.pid" ]] || return 0
  kill "$(cat "$state/$1.pid")" 2>/dev/null || true
  rm -f "$state/$1.pid"
}

down() {
  stop_pid server
  stop_pid stub
  server/scripts/test-db.sh down
  rm -rf "$state"
}

seed() {
  local name="$1"
  # One transaction per file (b4-seed.sql uses `set local`).
  if [[ -f "server/behaviour/seeds/$name.mjs" ]]; then
    node "server/behaviour/seeds/$name.mjs"
  else
    cat "server/behaviour/seeds/$name.sql"
  fi | docker exec -i "$TEST_DB_CONTAINER" psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -X -q -1 >/dev/null
}

# A throwaway CA and a certificate for 127.0.0.1 that it signed.
certificates() {
  openssl req -x509 -newkey rsa:2048 -nodes -keyout "$state/ca.key" -out "$state/ca.pem" -days 2 -subj "/CN=behaviour stub CA" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign" 2>/dev/null
  openssl req -newkey rsa:2048 -nodes -keyout "$state/stub.key" -out "$state/stub.csr" -subj "/CN=127.0.0.1" 2>/dev/null
  printf 'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' >"$state/ext.cnf"
  openssl x509 -req -in "$state/stub.csr" -CA "$state/ca.pem" -CAkey "$state/ca.key" -CAcreateserial \
    -out "$state/stub.pem" -days 2 -extfile "$state/ext.cnf" 2>/dev/null
}

# Until `url` answers at all (any status); `curl` options after the URL.
wait_for() {
  local what="$1" url="$2"
  shift 2
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "$@" "$url" && return 0
    sleep 1
  done
  echo "$what did not answer at $url" >&2
  return 1
}

up() {
  [[ -x "$server_bin" ]] || { echo "no server binary at $server_bin (cargo build --release in server/)" >&2; exit 1; }
  down
  mkdir -p "$state"
  server/scripts/test-db.sh up >"$state/database-url"
  for name in "${SEEDS[@]}"; do seed "$name"; done

  certificates
  node server/behaviour/openai-stub.mjs "$state/stub.pem" "$state/stub.key" "$stub_port" >"$state/stub.log" 2>&1 &
  echo $! >"$state/stub.pid"
  wait_for "the OpenAI stub" "https://127.0.0.1:$stub_port/" --cacert "$state/ca.pem"

  # Production mode on a loopback site origin: the session cookie is
  # `__Secure-`, which a browser keeps over plain HTTP only on loopback.
  # MEMECATCH_SIGNING_SECRET and CRON_SECRET as production has them (without
  # the first the analytics and view routes answer 503); a GA id so that the
  # pages push their events (lib.mjs aborts the tag's download). The
  # community is on (NEXT_PUBLIC_COMMUNITY_ENABLED unset), as the comment and
  # post scenarios need, though production's build.env has it off.
  (
    cd server
    env -u NEXT_PUBLIC_COMMUNITY_ENABLED DATABASE_URL="$(cat "$state/database-url")" \
      PORT="$port" NODE_ENV=production NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$port" \
      BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" NEXT_PUBLIC_GA_ID=G-BEHAVIOUR \
      MEMECATCH_SIGNING_SECRET=behaviour-signing-0123456789abcdef CRON_SECRET="$CRON_SECRET" \
      OPENAI_API_KEY=behaviour-openai-key OPENAI_REVIEW_BASE_URL="https://127.0.0.1:$stub_port/v1" \
      AXUM_EXTRA_CA_CERTS="$state/ca.pem" INDEXNOW_DISABLED=1 AXUM_PUBLIC_DIR=../public \
      "$server_bin" >"$state/server.log" 2>&1 &
    echo $! >"$state/server.pid"
  )
  wait_for "the server" "http://127.0.0.1:$port/" -f
}

print_env() {
  cat <<EOF
export TEST_DB_CONTAINER=$TEST_DB_CONTAINER
export DATABASE_URL=$(cat "$state/database-url")
export BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
export CRON_SECRET=$CRON_SECRET
export AXUM_URL=http://127.0.0.1:$port
# server log: $state/server.log
EOF
}

# The server's secrets, which the scenarios use too (session.mjs signs
# cookies with the first, lib.mjs expires the page caches with the second).
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-behaviour-secret-0123456789abcdef}"
export CRON_SECRET="${CRON_SECRET:-behaviour-cron-secret}"
case "${1:-}" in
  up) up; print_env ;;
  down) down ;;
  *)
    trap down EXIT
    up
    DATABASE_URL="$(cat "$state/database-url")" AXUM_URL="http://127.0.0.1:$port" \
      node_modules/.bin/playwright test -c server/behaviour/playwright.config.mjs "$@"
    ;;
esac
