#!/usr/bin/env bash
# Boots Postgres, the Next standalone server, and a proxy that forwards the
# raw request target. The Hangul detail page must answer 200 with no
# self-redirect, and a short id must 308 once.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
standalone="$root/.next/standalone"
if [[ ! -f "$standalone/server.js" ]]; then
  echo "standalone server missing; run pnpm build first" >&2
  exit 1
fi

server="memecatch-hangul-pg"
pg_port="55435"
app_port="3310"
proxy_port="3311"
db_password="hangul-ci-db"
app_pid=""
proxy_pid=""

cleanup() {
  if [[ -n "${proxy_pid}" ]]; then kill "$proxy_pid" >/dev/null 2>&1 || true; fi
  if [[ -n "${app_pid}" ]]; then kill "$app_pid" >/dev/null 2>&1 || true; fi
  docker rm -f "$server" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$server" >/dev/null 2>&1 || true
docker run -d --name "$server" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=memecatch \
  -e MEMECATCH_DB_PASSWORD="$db_password" \
  -e MEMECATCH_BACKUP_DB_PASSWORD=hangul-ci-backup \
  -p "127.0.0.1:${pg_port}:5432" \
  -v "$root/deploy/postgres:/sql:ro" \
  -v "$root/supabase/migrations:/migrations:ro" \
  pgvector/pgvector:pg16 >/dev/null

# pg_isready turns true while the image entrypoint is still creating
# POSTGRES_DB. Wait until that database accepts a query.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$server" psql -v ON_ERROR_STOP=1 --username postgres --dbname memecatch -c "select 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "postgres did not become ready" >&2
  docker logs "$server" >&2 || true
  exit 1
fi

docker exec \
  -e MEMECATCH_DB_PASSWORD="$db_password" \
  -e MEMECATCH_BACKUP_DB_PASSWORD=hangul-ci-backup \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=memecatch \
  "$server" bash /sql/init.sh

docker exec -i "$server" psql -v ON_ERROR_STOP=1 -U postgres -d memecatch <<'SQL'
insert into public.memes (short_id, title, slug, moderation_status, published_at)
values ('rk3w632x', '중꺾마', '중꺾마', 'approved', now());
SQL

if [[ ! -d "$standalone/.next/static" ]]; then
  mkdir -p "$standalone/.next"
  cp -a "$root/.next/static" "$standalone/.next/static"
fi
if [[ ! -d "$standalone/public" && -d "$root/public" ]]; then
  cp -a "$root/public" "$standalone/public"
fi

mkdir -p "$root/.next"
cd "$standalone"
DATABASE_URL="postgresql://memecatch:${db_password}@127.0.0.1:${pg_port}/memecatch" \
  BETTER_AUTH_SECRET="ci-hangul-proxy-secret-not-production" \
  NEXT_PUBLIC_SITE_URL="http://127.0.0.1:${app_port}" \
  HOSTNAME="127.0.0.1" \
  PORT="$app_port" \
  node server.js >"$root/.next/hangul-standalone.log" 2>&1 &
app_pid=$!

node "$root/scripts/hangul-forward-proxy.mjs" "$proxy_port" "$app_port" \
  >"$root/.next/hangul-proxy.log" 2>&1 &
proxy_pid=$!

set +e
node "$root/scripts/hangul-proxy-check.mjs" "$proxy_port"
status=$?
set -e
if [[ "$status" != "0" ]]; then
  echo "--- standalone log ---" >&2
  tail -n 80 "$root/.next/hangul-standalone.log" >&2 || true
  exit "$status"
fi
