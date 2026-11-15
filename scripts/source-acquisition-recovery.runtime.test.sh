#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/memecatch-recovery-pg.XXXXXX")
PORT=$((54000 + RANDOM % 1000))
SOCKET="$TMP/socket"
DB=memecatch_recovery_test

cleanup() {
  pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

initdb -D "$TMP/data" --auth=trust >/dev/null
mkdir -p "$SOCKET"
pg_ctl -D "$TMP/data" -o "-p $PORT -k $SOCKET" -w start >/dev/null

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET" -p "$PORT" -d postgres <<'SQL'
create database memecatch_recovery_test;
create role authenticated;
create role anon;
create role service_role bypassrls;
SQL

psql -X -v ON_ERROR_STOP=1 -v recovery_migration="$ROOT/supabase/migrations/20260912010000_source_acquisition_recovery.sql" -h "$SOCKET" -p "$PORT" -d "$DB" <<'SQL'
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
create table public.media_sources (id uuid primary key);
create function public.is_operator() returns boolean language sql stable as $$
  select current_setting('app.is_operator', true) = 'on'
$$;
\i :recovery_migration

set role service_role;
select * from public.record_source_acquisition_failure(
  'youtube:video-a', null, 'attempt-1', 'youtube', 'video-a',
  'https://www.youtube.com/watch?v=video-a', 'provider_transient', true,
  '2026-09-12 00:00:00+00', null
);
do $$
declare r record;
begin
  select * into r from public.source_acquisition_recovery where source_key = 'youtube:video-a';
  if r.attempt_count <> 1 or r.next_retry_at <> '2026-09-12 00:05:00+00' then raise exception 'initial backoff failed'; end if;
end $$;

select * from public.record_source_acquisition_failure(
  'youtube:video-a', null, 'attempt-2', 'youtube', 'video-a',
  'https://www.youtube.com/watch?v=video-a', 'provider_transient', true,
  '2026-09-12 00:10:00+00', null
);
select * from public.record_source_acquisition_failure(
  'youtube:video-a', null, 'attempt-old', 'youtube', 'video-a',
  'https://www.youtube.com/watch?v=video-a', 'provider_transient', true,
  '2026-09-12 00:05:00+00', null
);
select * from public.record_source_acquisition_failure(
  'youtube:video-a', null, 'attempt-2', 'youtube', 'video-a',
  'https://www.youtube.com/watch?v=video-a', 'provider_transient', true,
  '2026-09-12 00:10:00+00', null
);
do $$
declare r record; h integer;
begin
  select * into r from public.source_acquisition_recovery where source_key = 'youtube:video-a';
  select count(*) into h from public.source_acquisition_failures where source_key = 'youtube:video-a';
  if r.attempt_count <> 2 or r.last_attempt_idempotency_key <> 'attempt-2'
     or r.next_retry_at <> '2026-09-12 00:20:00+00' or h <> 3 then
    raise exception 'ordering or idempotency failed';
  end if;
end $$;

select * from public.record_source_acquisition_failure(
  'instagram:post-a', null, 'permanent-1', 'instagram', 'post-a', null,
  'provider_uncertain', false, '2026-09-12 00:00:00+00', null
);
select * from public.record_source_acquisition_failure(
  'tiktok:post-a', null, 'future-1', 'tiktok', null, null,
  'provider_transient', true, '2026-09-12 01:00:00+00', null
);
do $$
declare due integer; future integer; permanent integer;
begin
  select count(*) into due from public.list_due_source_acquisition_recovery('2026-09-12 00:21:00+00', 10) where source_key = 'youtube:video-a';
  select count(*) into future from public.list_due_source_acquisition_recovery('2026-09-12 00:21:00+00', 10) where source_key = 'tiktok:post-a';
  select count(*) into permanent from public.list_due_source_acquisition_recovery('2026-09-12 00:21:00+00', 10) where source_key = 'instagram:post-a';
  if due <> 1 or future <> 0 or permanent <> 0 then raise exception 'due filter failed'; end if;
end $$;

select * from public.resolve_source_acquisition_failure('youtube:video-a', 'attempt-1', '2026-09-12 00:00:00+00', '2026-09-12 00:30:00+00');
select * from public.resolve_source_acquisition_failure('youtube:video-a', 'attempt-2', '2026-09-12 00:10:00+00', '2026-09-12 00:30:00+00');
do $$
declare r record;
begin
  select * into r from public.source_acquisition_recovery where source_key = 'youtube:video-a';
  if r.resolved_at is null or r.next_retry_at is not null then raise exception 'stale resolution guard failed'; end if;
end $$;

reset role;
set role authenticated;
set app.is_operator = 'off';
do $$ begin
  if (select count(*) from public.source_acquisition_recovery) <> 0 then
    raise exception 'nonoperator read unexpectedly returned rows';
  end if;
end $$;
set app.is_operator = 'on';
do $$ begin
  if (select count(*) from public.source_acquisition_recovery) = 0 then
    raise exception 'operator read unexpectedly denied';
  end if;
end $$;
reset role;
set role service_role;
select count(*) from public.source_acquisition_recovery;
select count(*) from public.source_acquisition_failures where source_id is null and external_id is null;
\echo RUNTIME_RECOVERY_SQL_TESTS_OK
SQL
