#!/bin/bash
# Restore one memecatch custom-format dump into an empty database.
# Usage: DATABASE_URL=postgres://... restore.sh dump.dump.gz
# Create the target database first. This does not contact Supabase.
set -euo pipefail

dump="${1:-}"
if [[ -z "$dump" || -z "${DATABASE_URL:-}" ]]; then
  echo "usage: DATABASE_URL=postgres://... restore.sh dump.dump.gz" >&2
  exit 1
fi

plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT
gzip -dc "$dump" > "$plain"
pg_restore --dbname="$DATABASE_URL" --no-owner --exit-on-error "$plain"
echo "memecatch restore: database restored"
