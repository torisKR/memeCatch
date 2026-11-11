#!/bin/bash
# Owner-run data move from Supabase into the memecatch Postgres.
# This script refuses to run unless MEMECATCH_ALLOW_SUPABASE_DUMP=owner-approved.
# Do not point it at production from an unattended agent.
set -euo pipefail

if [[ "${MEMECATCH_ALLOW_SUPABASE_DUMP:-}" != "owner-approved" ]]; then
  echo "Refusing to dump Supabase. Set MEMECATCH_ALLOW_SUPABASE_DUMP=owner-approved to run this yourself." >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" || -z "${DATABASE_URL:-}" ]]; then
  echo "SUPABASE_DB_URL and DATABASE_URL are required" >&2
  exit 1
fi

dump="$(mktemp --suffix=.dump)"
trap 'rm -f "$dump"' EXIT
pg_dump --dbname="$SUPABASE_DB_URL" --format=custom --schema=public --schema=auth --table=auth.users --file="$dump"
pg_restore --dbname="$DATABASE_URL" --no-owner --exit-on-error --data-only "$dump"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/map-auth-users.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/verify.sql"
echo "memecatch: catalog restore finished. Run deploy/postgres apply-catalog-seed if collectible cards are still empty."
