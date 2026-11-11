#!/bin/bash
# Restore one encrypted memecatch dump into an empty database.
# Usage: MEMECATCH_RESTORE_CONFIRM=restore DATABASE_URL=postgres://... restore.sh dump.dump.gz.age
# The target must have no user tables. The restore runs in one transaction.
set -euo pipefail

dump="${1:-}"
if [[ "${MEMECATCH_RESTORE_CONFIRM:-}" != "restore" ]]; then
  echo "Refusing to restore. Set MEMECATCH_RESTORE_CONFIRM=restore." >&2
  exit 1
fi
if [[ -z "$dump" || -z "${DATABASE_URL:-}" ]]; then
  echo "usage: MEMECATCH_RESTORE_CONFIRM=restore DATABASE_URL=postgres://... restore.sh dump.dump.gz.age" >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$here/pg-env.sh" ]]; then
  source "$here/pg-env.sh"
else
  source "$here/../postgres/pg-env.sh"
fi
pg_env_from_url "$DATABASE_URL"

tables="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')")"
if [[ "$tables" != "0" ]]; then
  echo "Refusing to restore into a database that already has ${tables} tables." >&2
  exit 1
fi

plain="$(mktemp)"
compressed="$(mktemp)"
identity="$(mktemp)"
umask 077
trap 'rm -f "$plain" "$compressed" "$identity" "${PGPASSFILE:-}"' EXIT

if [[ "$dump" == *.age ]]; then
  if [[ -z "${BACKUP_AGE_IDENTITY:-}" ]]; then
    echo "BACKUP_AGE_IDENTITY is required to decrypt the backup" >&2
    exit 1
  fi
  printf '%s\n' "$BACKUP_AGE_IDENTITY" > "$identity"
  rm -f "$compressed"
  age -d -i "$identity" -o "$compressed" "$dump"
  gzip -dc "$compressed" > "$plain"
else
  gzip -dc "$dump" > "$plain"
fi

pg_restore --single-transaction --no-owner --exit-on-error -d "$PGDATABASE" "$plain"
echo "memecatch restore: database restored"
