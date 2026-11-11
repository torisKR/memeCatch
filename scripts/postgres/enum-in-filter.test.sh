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

for _ in $(seq 1 60); do
  if docker exec "$server" pg_isready -U postgres >/dev/null; then
    break
  fi
  sleep 1
done
docker exec "$server" pg_isready -U postgres >/dev/null

cd "$root"
DATABASE_URL="postgresql://postgres:${password}@127.0.0.1:${port}/postgres" \
  pnpm exec vitest run lib/db/execute-enum.integration.test.ts
