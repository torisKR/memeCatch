#!/bin/bash
# Proves an .in() filter on an enum column against a throwaway Postgres.
# Does not use the application database.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
server="memecatch-enum-pg"
port="55434"
password="postgres"

docker rm -f "$server" >/dev/null 2>&1 || true
trap 'docker rm -f "$server" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$server" \
  -e POSTGRES_PASSWORD="$password" \
  -p "127.0.0.1:${port}:5432" \
  postgres:16 >/dev/null

# pg_isready turns true on the entrypoint's temporary server, then that
# server restarts. A single follow-up check dies in that window and
# hides its error because stdout is discarded. Wait until init has
# finished and a query succeeds.
ready=0
for _ in $(seq 1 90); do
  if docker logs "$server" 2>&1 | grep -q "init process complete" \
    && docker exec "$server" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "select 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "enum postgres did not become ready" >&2
  docker logs "$server" >&2 || true
  exit 1
fi

cd "$root"
DATABASE_URL="postgresql://postgres:${password}@127.0.0.1:${port}/postgres" \
  pnpm exec vitest run lib/db/execute-enum.integration.test.ts
