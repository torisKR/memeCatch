#!/bin/bash
# Owner-run data move from Supabase into the memecatch Postgres.
# Refuses to run unless MEMECATCH_ALLOW_SUPABASE_DUMP=owner-approved.
# Do not point SUPABASE_DB_URL at production from an unattended agent.
#
# The live database is not modified until the scratch copy matches the source.
# Seed rows are truncated only inside that scratch database. A failure drops
# the scratch database and leaves the target where it was.
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

valid_ident() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
}

quote_ident() {
  printf '"%s"' "$1"
}

public_dump=""
auth_dump=""
source_counts=""
target_counts=""
table_list=""
target_db=""
scratch_db=""
previous_db=""
scratch_url=""
swapped=0
scratch_created=0
connections_closed=0
renamed_away=0

admin_psql() {
  psql -d postgres -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  local status=$?
  if [[ "$renamed_away" == "1" && "$swapped" != "1" && -n "$previous_db" && -n "$target_db" ]]; then
    admin_psql -c "ALTER DATABASE $(quote_ident "$previous_db") RENAME TO $(quote_ident "$target_db");" || true
    renamed_away=0
  fi
  if [[ "$connections_closed" == "1" && -n "$target_db" ]]; then
    admin_psql -c "ALTER DATABASE $(quote_ident "$target_db") ALLOW_CONNECTIONS true;" || true
    connections_closed=0
  fi
  if [[ "$swapped" != "1" && "$scratch_created" == "1" && -n "$scratch_db" ]]; then
    echo "memecatch: migration failed. Dropping ${scratch_db}. ${target_db} was not replaced." >&2
    admin_psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${scratch_db}' AND pid <> pg_backend_pid();" || true
    admin_psql -c "DROP DATABASE IF EXISTS $(quote_ident "$scratch_db");" || true
  fi
  rm -f ${public_dump:+"$public_dump"} ${auth_dump:+"$auth_dump"} ${source_counts:+"$source_counts"} ${target_counts:+"$target_counts"} ${table_list:+"$table_list"} ${PGPASSFILE:+"$PGPASSFILE"}
  return "$status"
}
trap cleanup EXIT

public_dump="$(mktemp)"
auth_dump="$(mktemp)"
source_counts="$(mktemp)"
target_counts="$(mktemp)"
table_list="$(mktemp)"

pg_env_from_url "$SUPABASE_DB_URL"
pg_dump -Fc --schema=public --no-owner --file="$public_dump"
pg_dump -Fc --table=auth.users --no-owner --file="$auth_dump"
{
  pg_restore -l "$public_dump"
  pg_restore -l "$auth_dump"
} | sed -n 's/^[0-9][0-9]*; [0-9][0-9]* [0-9][0-9]* TABLE DATA \([^ ][^ ]*\) \([^ ][^ ]*\).*/\1|\2/p' \
  | sort -u > "$table_list"
if [[ ! -s "$table_list" ]]; then
  echo "memecatch: source dumps contain no table data" >&2
  exit 1
fi

: > "$source_counts"
while IFS='|' read -r schema table; do
  [[ -z "$table" ]] && continue
  valid_ident "$schema" || { echo "memecatch: unsafe schema name in dump" >&2; exit 1; }
  valid_ident "$table" || { echo "memecatch: unsafe table name in dump" >&2; exit 1; }
  count="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM $(quote_ident "$schema").$(quote_ident "$table")")"
  printf '%s.%s %s\n' "$schema" "$table" "$count" >> "$source_counts"
done < "$table_list"

pg_env_from_url "$DATABASE_URL"
target_db="$PGDATABASE"
valid_ident "$target_db" || { echo "memecatch: target database name must be a plain identifier" >&2; exit 1; }
if [[ "$target_db" == "postgres" || "$target_db" == "template0" || "$target_db" == "template1" ]]; then
  echo "memecatch: refusing to migrate into ${target_db}" >&2
  exit 1
fi
scratch_db="${target_db}_import"
previous_db="${target_db}_premigrate"
valid_ident "$scratch_db" || { echo "memecatch: scratch database name is too long" >&2; exit 1; }
valid_ident "$previous_db" || { echo "memecatch: previous database name is too long" >&2; exit 1; }
if [[ -n "$(psql -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname = '${scratch_db}'")" ]]; then
  echo "memecatch: ${scratch_db} already exists. Drop it before retrying." >&2
  exit 1
fi
if [[ -n "$(psql -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname = '${previous_db}'")" ]]; then
  echo "memecatch: ${previous_db} already exists. Drop the previous copy before retrying." >&2
  exit 1
fi

connections_closed=1
admin_psql -c "ALTER DATABASE $(quote_ident "$target_db") ALLOW_CONNECTIONS false;"
admin_psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${target_db}' AND pid <> pg_backend_pid();"
admin_psql -c "CREATE DATABASE $(quote_ident "$scratch_db") TEMPLATE $(quote_ident "$target_db");"
scratch_created=1
admin_psql -c "ALTER DATABASE $(quote_ident "$target_db") ALLOW_CONNECTIONS true;"
connections_closed=0

scratch_url="$(
  DATABASE_URL="$DATABASE_URL" SCRATCH_DB="$scratch_db" python3 - <<'PY'
import os, urllib.parse
url = urllib.parse.urlparse(os.environ["DATABASE_URL"])
print(urllib.parse.urlunparse(url._replace(path="/" + os.environ["SCRATCH_DB"])))
PY
)"
pg_env_from_url "$scratch_url"

truncate_list=""
while IFS='|' read -r schema table; do
  [[ -z "$table" ]] && continue
  truncate_list+="$(quote_ident "$schema").$(quote_ident "$table"), "
done < "$table_list"
truncate_list="${truncate_list%, }"
psql -v ON_ERROR_STOP=1 <<SQL
BEGIN;
TRUNCATE ${truncate_list} RESTART IDENTITY CASCADE;
COMMIT;
SQL

: > "$target_counts"
while IFS='|' read -r schema table; do
  [[ -z "$table" ]] && continue
  count="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM $(quote_ident "$schema").$(quote_ident "$table")")"
  if [[ "$count" != "0" ]]; then
    echo "memecatch: ${schema}.${table} still has ${count} rows after truncate" >&2
    exit 1
  fi
done < "$table_list"

psql -v ON_ERROR_STOP=1 -f "$here/../../supabase/migrations/20261110130000_auth_users_supabase_columns.sql"
# One transaction, with FK and user triggers disabled, so a Postgres 17 data
# dump can land on Postgres 16 without a half-loaded scratch database.
{
  printf '%s\n' 'BEGIN;' 'SET LOCAL session_replication_role = replica;'
  pg_restore --data-only --no-owner -f - "$public_dump" | awk -f "$here/filter-pg17-dump.awk"
  pg_restore --data-only --no-owner -f - "$auth_dump" | awk -f "$here/filter-pg17-dump.awk"
  printf '%s\n' 'COMMIT;'
} | psql -v ON_ERROR_STOP=1 -d "$PGDATABASE"

: > "$target_counts"
while IFS='|' read -r schema table; do
  [[ -z "$table" ]] && continue
  count="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM $(quote_ident "$schema").$(quote_ident "$table")")"
  printf '%s.%s %s\n' "$schema" "$table" "$count" >> "$target_counts"
done < "$table_list"
if ! diff -u "$source_counts" "$target_counts"; then
  echo "memecatch: restored row counts do not match the source" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -f "$here/better-auth-tables.sql"
psql -v ON_ERROR_STOP=1 -f "$here/map-auth-users.sql"
psql -v ON_ERROR_STOP=1 -f "$here/verify.sql"

admin_psql -c "ALTER DATABASE $(quote_ident "$target_db") ALLOW_CONNECTIONS false;"
connections_closed=1
admin_psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('${target_db}', '${scratch_db}') AND pid <> pg_backend_pid();"
admin_psql -c "ALTER DATABASE $(quote_ident "$target_db") RENAME TO $(quote_ident "$previous_db");"
renamed_away=1
admin_psql -c "ALTER DATABASE $(quote_ident "$scratch_db") RENAME TO $(quote_ident "$target_db");"
swapped=1
renamed_away=0
connections_closed=0
admin_psql -c "ALTER DATABASE $(quote_ident "$target_db") ALLOW_CONNECTIONS true;"
admin_psql -c "ALTER DATABASE $(quote_ident "$previous_db") ALLOW_CONNECTIONS true;"
echo "memecatch: catalog restore finished. Previous database kept as ${previous_db}."
