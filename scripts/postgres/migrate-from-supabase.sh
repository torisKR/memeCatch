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

here="$(cd "$(dirname "$0")" && pwd)"
source "$here/../../deploy/postgres/pg-env.sh"

counts_for() {
  local out="$1"
  : > "$out"
  local schema table count
  while IFS='|' read -r schema table; do
    [[ -z "$table" ]] && continue
    count="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM ${schema}.\"${table}\"")"
    printf '%s.%s %s\n' "$schema" "$table" "$count" >> "$out"
  done < <(psql -At -F '|' -v ON_ERROR_STOP=1 -c "SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND ((n.nspname = 'public' AND c.relname ~ '^[a-z_][a-z0-9_]*$') OR (n.nspname = 'auth' AND c.relname = 'users')) ORDER BY 1, 2")
}

public_dump="$(mktemp)"
auth_dump="$(mktemp)"
source_counts="$(mktemp)"
target_counts="$(mktemp)"
trap 'rm -f "$public_dump" "$auth_dump" "$source_counts" "$target_counts" "${PGPASSFILE:-}"' EXIT

pg_env_from_url "$SUPABASE_DB_URL"
pg_dump -Fc --schema=public --file="$public_dump"
pg_dump -Fc --table=auth.users --file="$auth_dump"
counts_for "$source_counts"

pg_env_from_url "$DATABASE_URL"
pg_restore --data-only --no-owner --exit-on-error --single-transaction -d "$PGDATABASE" "$public_dump"
pg_restore --data-only --no-owner --exit-on-error --single-transaction -d "$PGDATABASE" "$auth_dump"
counts_for "$target_counts"
if ! diff -u "$source_counts" "$target_counts"; then
  echo "memecatch: restored row counts do not match the source" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -f "$here/map-auth-users.sql"
psql -v ON_ERROR_STOP=1 -f "$here/verify.sql"
echo "memecatch: catalog restore finished. Run deploy/postgres apply-catalog-seed if collectible cards are still empty."
