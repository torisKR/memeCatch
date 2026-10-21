#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d "/tmp/mce-refresh.XXXXXX")
PORT=$((55000 + RANDOM % 1000))
SOCKET="$TMP/socket"
DB=memecatch_refresh_eligibility_test

cleanup() {
  pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

initdb -D "$TMP/data" --auth=trust >/dev/null
mkdir -p "$SOCKET"
if ! pg_ctl -D "$TMP/data" -o "-p $PORT -k $SOCKET" -l "$TMP/postgres.log" -w start; then
  sed -n '1,160p' "$TMP/postgres.log"
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET" -p "$PORT" -d postgres <<'SQL'
create database memecatch_refresh_eligibility_test;
create role authenticated;
create role anon;
create role service_role bypassrls;
SQL

psql -X -v ON_ERROR_STOP=1 \
  -v recovery_migration="$ROOT/supabase/migrations/20260912010000_source_acquisition_recovery.sql" \
  -v eligibility_migration="$ROOT/supabase/migrations/20261013195628_source_refresh_eligibility.sql" \
  -h "$SOCKET" -p "$PORT" -d "$DB" <<'SQL'
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
create table public.media_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  platform text not null,
  external_id text,
  canonical_url text not null,
  title text,
  channel_name text,
  channel_id text,
  platform_published_at timestamptz,
  duration_seconds integer,
  public_status text,
  embeddable boolean,
  license_code text,
  made_for_kids boolean,
  thumbnail_url text,
  metadata_refreshed_at timestamptz,
  metadata_expires_at timestamptz,
  last_checked_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create function public.is_operator() returns boolean language sql stable as $$ select false $$;
\i :recovery_migration
\i :eligibility_migration

insert into public.media_sources (id, platform, external_id, canonical_url, last_checked_at, created_at)
select
  ('10000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid,
  'youtube',
  'blocked' || lpad(value::text, 4, '0'),
  'https://www.youtube.com/watch?v=blocked' || lpad(value::text, 4, '0'),
  null,
  '2026-01-01 00:00:00+00'::timestamptz + value * interval '1 second'
from generate_series(1, 1001) as value;

insert into public.source_acquisition_recovery (
  source_key, source_id, platform, external_id, canonical_url, attempt_count,
  next_retry_at, last_error_code, last_error_retryable, last_attempted_at,
  last_attempt_idempotency_key
)
select
  'youtube:blocked' || lpad(value::text, 4, '0'),
  ('10000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid,
  'youtube',
  'blocked' || lpad(value::text, 4, '0'),
  'https://www.youtube.com/watch?v=blocked' || lpad(value::text, 4, '0'),
  case when value <= 500 then 1 else 3 end,
  case
    when value <= 500 then '2026-12-01 00:00:00+00'::timestamptz
    else '2026-09-01 00:00:00+00'::timestamptz
  end,
  'provider_transient',
  true,
  '2026-10-01 00:00:00+00',
  'blocked-attempt-' || value
from generate_series(1, 1001) as value;

insert into public.media_sources (
  id, platform, external_id, canonical_url, last_checked_at, created_at
) values (
  '20000000-0000-4000-8000-000000000001', 'youtube', 'eligible001',
  'https://www.youtube.com/watch?v=eligible001', '2026-01-01 00:00:00+00',
  '2026-12-01 00:00:00+00'
);

do $$
declare selected uuid[];
begin
  select array_agg(id) into selected
    from public.list_source_refresh_candidates(
      '2026-10-01 00:00:00+00', array['youtube', 'youtube_shorts'], 10
    );
  if selected is distinct from array['20000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'eligible source starved behind unresolved recovery rows: %', selected;
  end if;
end $$;

do $$ begin
  if has_function_privilege('authenticated', 'public.list_source_refresh_candidates(timestamptz,text[],integer)', 'execute') then
    raise exception 'authenticated unexpectedly has refresh-candidate execute';
  end if;
  if not has_function_privilege('service_role', 'public.list_source_refresh_candidates(timestamptz,text[],integer)', 'execute') then
    raise exception 'service_role lacks refresh-candidate execute';
  end if;
end $$;

drop function public.list_source_refresh_candidates(timestamptz,text[],integer);

do $$ begin
  if to_regprocedure('public.list_source_refresh_candidates(timestamptz,text[],integer)') is not null then
    raise exception 'refresh-candidate rollback did not remove the function';
  end if;
end $$;

\echo RUNTIME_SOURCE_REFRESH_ELIGIBILITY_OK
SQL
