#!/usr/bin/env bash
# The reservation functions, record_meme_view, the extensions grant and the
# support inquiry limit (db/migrations/20261124090000..090500) on a fresh
# database built from every migration: the pgTAP file, then concurrent sessions.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
server="${MEMECATCH_TEST_PG:-memecatch-d1-pg-$(date +%s)-$$}"

cleanup() {
  docker rm -f "$server" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$server" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=memecatch \
  -v "$root/deploy/postgres:/sql:ro" \
  -v "$root/db/migrations:/migrations:ro" \
  -v "$root/db/tests:/tests:ro" \
  pgvector/pgvector:pg16 >/dev/null

ready=0
for _ in $(seq 1 90); do
  if docker logs "$server" 2>&1 | grep -q "init process complete" \
    && docker exec "$server" psql -v ON_ERROR_STOP=1 -U postgres -d memecatch -c 'select 1' >/dev/null 2>&1; then
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

docker exec -e DEBIAN_FRONTEND=noninteractive "$server" bash -ceu '
  apt-get update >/dev/null
  apt-get install -y --no-install-recommends \
    postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl >/dev/null
  rm -rf /var/lib/apt/lists/*
'
docker exec -i "$server" psql -v ON_ERROR_STOP=1 -U postgres -d memecatch \
  -f /sql/00-bootstrap.sql >/dev/null
docker exec -i "$server" psql -v ON_ERROR_STOP=1 -U postgres -d memecatch \
  -c 'create extension if not exists pgtap with schema extensions' >/dev/null
docker exec \
  -e MEMECATCH_DB_PASSWORD=d1-test \
  -e MEMECATCH_BACKUP_DB_PASSWORD=d1-test-backup \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=memecatch \
  "$server" bash -ceu '
    if ! bash /sql/init.sh >/tmp/memecatch-init.log 2>&1; then
      cat /tmp/memecatch-init.log >&2
      exit 1
    fi
  '

docker exec -e PGOPTIONS='-c search_path=public,extensions' \
  "$server" pg_prove --username postgres --dbname memecatch /tests/db_missing_functions.test.sql

psql_cmd=(docker exec -i "$server" psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -At -q)
user_a=d2000000-0000-4000-8000-00000000000a
user_b=d2000000-0000-4000-8000-00000000000b
user_c=d2000000-0000-4000-8000-00000000000c
user_d=d2000000-0000-4000-8000-00000000000d
viewer=$(printf 'e%.0s' $(seq 1 64))
viewer_same=$(printf 'f%.0s' $(seq 1 64))

"${psql_cmd[@]}" <<SQL
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('$user_a', 'd2-a@example.com', now(), '{"nickname":"d2_user_a"}', now(), now()),
       ('$user_b', 'd2-b@example.com', now(), '{"nickname":"d2_user_b"}', now(), now()),
       ('$user_c', 'd2-c@example.com', now(), '{"nickname":"d2_user_c"}', now(), now()),
       ('$user_d', 'd2-d@example.com', now(), '{"nickname":"d2_user_d"}', now(), now());
insert into public.memes (id, title, slug, moderation_status)
select ('d2100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'D2 fixture ' || i, 'd2-fixture-' || i, 'approved'
from generate_series(1, 105) i;
insert into public.meme_export_requests (user_id)
select '$user_a' from generate_series(1, 25);
insert into public.oembed_request_attempts (user_id)
select '$user_b' from generate_series(1, 95);
insert into public.view_events (meme_id, session_hash)
select ('d2100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, '$viewer'
from generate_series(1, 95) i;
SQL

# One request: its own session and transaction, as lib/db and server/src/db.rs run it.
as_role() {
  local role="$1" user="$2" statement="$3"
  "${psql_cmd[@]}" >/dev/null 2>&1 <<SQL
set session authorization memecatch;
begin;
select set_config('app.user_id', '$user', true);
select set_config('request.jwt.claims', '{"role":"$role"}', true);
set local role $role;
$statement;
commit;
SQL
}

# count sessions at once; @N@ in the statement is the session number.
run_each() {
  local count="$1" role="$2" user="$3" template="$4"
  local jobs=()
  for i in $(seq 1 "$count"); do
    (as_role "$role" "$user" "${template//@N@/$i}" || true) &
    jobs+=("$!")
  done
  for job in "${jobs[@]}"; do wait "$job"; done
}

expect() {
  local label="$1" want="$2" query="$3" got
  got="$("${psql_cmd[@]}" -c "$query")"
  if [[ "$got" != "$want" ]]; then
    echo "not ok - $label: expected $want, got $got" >&2
    exit 1
  fi
  echo "ok - $label"
}

run_each 10 authenticated "$user_a" 'select public.reserve_meme_export()'
expect 'export: 10 concurrent requests at 25/30 reserve exactly 5' 30 \
  "select count(*) from public.meme_export_requests where user_id = '$user_a'"

run_each 10 authenticated "$user_b" 'select public.reserve_oembed_request()'
expect 'oEmbed: 10 concurrent requests at 95/100 reserve exactly 5' 100 \
  "select count(*) from public.oembed_request_attempts where user_id = '$user_b'"

run_each 10 authenticated "$user_c" 'select public.reserve_submission_attempt()'
expect 'submission: 10 concurrent attempts reserve exactly 5' 5 \
  "select count(*) from public.submission_attempts where user_id = '$user_c'"

run_each 10 service_role '' \
  "select public.record_meme_view(('d2100000-0000-4000-8000-' || lpad((95 + @N@)::text, 12, '0'))::uuid, '$viewer')"
expect 'views: 10 concurrent memes at 95/100 record exactly 5' 100 \
  "select count(*) from public.view_events where session_hash = '$viewer'"

run_each 8 service_role '' \
  "select public.record_meme_view('d2100000-0000-4000-8000-000000000001', '$viewer_same')"
expect 'views: 8 concurrent views of one meme record one row' 1 \
  "select count(*) from public.view_events where session_hash = '$viewer_same'"
# A duplicate returns false; it is not an error.
as_role service_role '' \
  "select public.record_meme_view('d2100000-0000-4000-8000-000000000001', '$viewer_same')"
echo "ok - views: a duplicate is not an error"

run_each 20 authenticated "$user_d" \
  "insert into public.support_inquiries (user_id, category, subject, body) values ('$user_d', 'other', 'concurrent @N@', 'body')"
expect 'support: 20 concurrent inquiries land exactly 10' 10 \
  "select count(*) from public.support_inquiries where user_id = '$user_d'"

# R12-4: without the grant, the vector functions fail for the request roles.
denied="$("${psql_cmd[@]}" 2>&1 <<'SQL' || true
begin;
revoke usage on schema extensions from anon, authenticated, service_role;
set session authorization memecatch;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select count(*) from public.match_meme_embeddings(
  array[1.0::double precision] || array_fill(0.0::double precision, array[383]), 5, null);
rollback;
SQL
)"
if [[ "$denied" != *"permission denied for schema extensions"* ]]; then
  echo "not ok - extensions: expected permission denied without the grant, got: $denied" >&2
  exit 1
fi
echo "ok - extensions: without 20261124090400 anon gets permission denied for schema extensions"

echo 'db missing functions: grants, limits and concurrency passed'
