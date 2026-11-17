#!/bin/bash
# Production-build HTTP regression for localized detail status handling.
# Uses an isolated local PostgreSQL 17 cluster and never contacts production.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
standalone="$root/.next/standalone"
scratch="$(mktemp -d /private/tmp/memecatch-localized-soft404.XXXXXX)"
pg_data="$scratch/pgdata"
pg_socket="$scratch/socket"
# Keep parallel agents from sharing fixed test ports. The isolated socket is
# authoritative; TCP is enabled only because the standalone app uses a URL.
pg_port=$((54000 + ($$ % 5000)))
app_port=$((60000 + ($$ % 5000)))
app_pid=""

cleanup() {
  if [[ -n "$app_pid" ]]; then kill "$app_pid" >/dev/null 2>&1 || true; fi
  pg_ctl -D "$pg_data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$scratch"
}
trap cleanup EXIT

if [[ ! -f "$standalone/server.js" ]]; then
  echo "standalone server missing; run pnpm build first" >&2
  exit 1
fi
for command in initdb pg_ctl createdb psql curl; do
  command -v "$command" >/dev/null || {
    echo "required command missing: $command" >&2
    exit 1
  }
done
if [[ "$(postgres --version)" != *" 17."* ]]; then
  echo "PostgreSQL 17 is required for this regression" >&2
  exit 1
fi

initdb -D "$pg_data" -A trust --no-locale --encoding=UTF8 -U postgres >/dev/null
mkdir -p "$pg_socket"
pg_ctl -D "$pg_data" -l "$scratch/postgres.log" \
  -o "-k $pg_socket -p $pg_port" start >/dev/null
createdb -h "$pg_socket" -p "$pg_port" -U postgres memecatch

# Homebrew PostgreSQL does not include pgvector. These detail-route fixtures do
# not use semantic search, so only vector-specific migrations are omitted.
sed -E '/CREATE EXTENSION IF NOT EXISTS vector/Id' \
  "$root/deploy/postgres/00-bootstrap.sql" \
  | psql -v ON_ERROR_STOP=1 -h "$pg_socket" -p "$pg_port" -U postgres -d memecatch >/dev/null
psql -v ON_ERROR_STOP=1 -h "$pg_socket" -p "$pg_port" -U postgres -d memecatch <<'SQL' >/dev/null
create role memecatch login password 'local-soft404';
grant connect on database memecatch to memecatch;
SQL

for migration in "$root"/db/migrations/*.sql; do
  base="$(basename "$migration")"
  case "$base" in
    *meme_collectible_catalog_seed.sql|*seed_curated_memes.sql|\
    20261003123428_meme_catalog_vectors.sql|\
    20261004002839_meme_reference_search_rank.sql|\
    20261004002846_meme_embedding_reindex_lease.sql)
      continue
      ;;
  esac
  sed -E \
    -e '/create extension if not exists pg_net/Id' \
    -e '/create extension if not exists pg_cron/Id' \
    "$migration" \
    | psql -v ON_ERROR_STOP=1 -h "$pg_socket" -p "$pg_port" -U postgres -d memecatch >/dev/null
done
psql -v ON_ERROR_STOP=1 -h "$pg_socket" -p "$pg_port" -U postgres -d memecatch \
  -f "$root/deploy/postgres/99-app-identity.sql" >/dev/null

psql -v ON_ERROR_STOP=1 -h "$pg_socket" -p "$pg_port" -U postgres -d memecatch <<'SQL' >/dev/null
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000001', 'reviewer@local.invalid');
update public.profiles
set nickname = 'Local reviewer'
where id = '00000000-0000-4000-8000-000000000001';

insert into public.memes (
  id, short_id, title, slug, summary, description, origin,
  moderation_status, published_at, updated_at
)
values
  ('10000000-0000-4000-8000-000000000001', 'gnact78h', 'Canonical valid', 'canonical-valid',
   '검증용 요약', repeat('밈', 210), repeat('유래', 40), 'approved', now(), '2026-11-18T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'miss0001', 'Missing translation', 'missing-translation',
   '검증용 요약', repeat('밈', 210), repeat('유래', 40), 'approved', now(), '2026-11-18T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'stale001', 'Stale translation', 'stale-translation',
   '검증용 요약', repeat('밈', 210), repeat('유래', 40), 'approved', now(), '2026-11-18T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', 'thin0001', 'Thin original', 'thin-original',
   '짧은 요약', '짧은 설명', '짧은 유래', 'approved', now(), '2026-11-18T00:00:00Z');

insert into public.tags (id, name) values
  ('20000000-0000-4000-8000-000000000001', 'fixture-one'),
  ('20000000-0000-4000-8000-000000000002', 'fixture-two'),
  ('20000000-0000-4000-8000-000000000003', 'fixture-three');
insert into public.meme_tags_map (meme_id, tag_id)
select meme.id, tag.id
from public.memes meme
cross join public.tags tag
where meme.short_id in ('gnact78h', 'miss0001', 'stale001');

insert into public.meme_sources (meme_id, platform, source_url, title)
select meme.id, 'fixture', 'https://example.com/' || meme.short_id || '/' || source.n,
       'Fixture source ' || source.n
from public.memes meme
cross join (values (1), (2)) source(n)
where meme.short_id in ('gnact78h', 'miss0001', 'stale001');

insert into public.meme_contents (
  meme_id, type, platform, url, is_representative, availability, moderation_status
)
select id, 'image', 'fixture', 'https://example.com/' || short_id || '.jpg', true, 'live', 'approved'
from public.memes
where short_id in ('gnact78h', 'miss0001', 'stale001');

insert into public.meme_translations (
  meme_id, locale, localized_slug, title, summary, description, origin,
  status, source_updated_at, provider, model, reviewed_at, reviewed_by
)
values
  ('10000000-0000-4000-8000-000000000001', 'ja', 'valid-ja', '有効な翻訳', '有効な要約',
   '有効な説明', '有効な由来', 'reviewed', '2026-11-18T00:00:00Z', 'fixture', 'fixture', now(),
   '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000003', 'ja', 'stale-ja', '古い翻訳', '古い要約',
   '古い説明', '古い由来', 'stale', '2026-11-18T00:00:00Z', 'fixture', 'fixture', null, null),
  ('10000000-0000-4000-8000-000000000004', 'ja', 'thin-ja', '薄い翻訳', '薄い要約',
   '薄い説明', '薄い由来', 'reviewed', '2026-11-18T00:00:00Z', 'fixture', 'fixture', now(),
   '00000000-0000-4000-8000-000000000001');
SQL

DATABASE_URL="postgresql://memecatch:local-soft404@127.0.0.1:${pg_port}/memecatch" \
  pnpm exec vitest run lib/db/deadline.integration.test.ts

if [[ ! -d "$standalone/.next/static" ]]; then
  mkdir -p "$standalone/.next"
  cp -a "$root/.next/static" "$standalone/.next/static"
fi
if [[ ! -d "$standalone/public" ]]; then
  cp -a "$root/public" "$standalone/public"
fi

cd "$standalone"
DATABASE_URL="postgresql://memecatch:local-soft404@127.0.0.1:${pg_port}/memecatch" \
  BETTER_AUTH_SECRET="local-soft404-integration-secret" \
  NEXT_PUBLIC_SITE_URL="http://127.0.0.1:${app_port}" \
  HOSTNAME=127.0.0.1 \
  PORT="$app_port" \
  node server.js >"$scratch/next.log" 2>&1 &
app_pid=$!

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${app_port}/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" != "1" ]]; then
  tail -n 100 "$scratch/next.log" >&2 || true
  exit 1
fi

assert_status() {
  local path="$1"
  local expected="$2"
  local name="$3"
  local headers="$scratch/${name}.headers"
  local body="$scratch/${name}.body"
  local status
  status="$(curl --path-as-is -sS -D "$headers" -o "$body" -w '%{http_code}' \
    -H 'Sec-Fetch-Mode: navigate' "http://127.0.0.1:${app_port}${path}")"
  if [[ "$status" != "$expected" ]]; then
    echo "$name expected HTTP $expected, got $status" >&2
    tail -n 100 "$scratch/next.log" >&2 || true
    exit 1
  fi
}

assert_status "/ja/memes/miss0001-any" 404 missing
assert_status "/ja/memes/stale001-any" 404 stale
assert_status "/ja/memes/thin0001-any" 404 thin
assert_status "/ja/memes/gnact78h-valid-ja" 200 valid
assert_status "/ja/memes/cssqxwmb-duplicate" 308 alias

grep -q "有効な翻訳" "$scratch/valid.body"
alias_location="$(awk 'BEGIN { IGNORECASE=1 } /^location:/ { sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit }' "$scratch/alias.headers")"
if [[ "$alias_location" != "/ja/memes/gnact78h-valid-ja" ]]; then
  echo "alias Location mismatch: $alias_location" >&2
  exit 1
fi

echo "localized soft-404 standalone checks passed: missing=404 stale=404 thin=404 valid=200 alias=308"
