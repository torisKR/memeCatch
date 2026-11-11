#!/bin/bash
# Dump the local memecatch database and restore it into a scratch database.
# Does not contact Supabase or R2.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

dump="$(mktemp --suffix=.dump.gz)"
trap 'rm -f "$dump"' EXIT
pg_dump -Fc --dbname="$DATABASE_URL" | gzip -c > "$dump"
psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS memecatch_restore_proof;"
psql "$DATABASE_URL" -c "CREATE DATABASE memecatch_restore_proof;"
scratch="${DATABASE_URL%/*}/memecatch_restore_proof"
DATABASE_URL="$scratch" bash "$(dirname "$0")/restore.sh" "$dump"
count="$(psql "$scratch" -Atc "SELECT count(*) FROM memes;")"
psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS memecatch_restore_proof;"
echo "memecatch restore proof: memes=${count}"
test "$count" -ge 0
