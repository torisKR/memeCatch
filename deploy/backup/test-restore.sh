#!/bin/bash
# Dump the local database, encrypt it, restore it into a scratch database, and
# compare per-table counts plus a meme id checksum. Does not contact Supabase or R2.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$here/pg-env.sh" ]]; then
  source "$here/pg-env.sh"
else
  source "$here/../postgres/pg-env.sh"
fi

pg_env_from_url "$DATABASE_URL"
source_url="$DATABASE_URL"

snapshot() {
  local out="$1"
  : > "$out"
  local table count
  while read -r table; do
    [[ -z "$table" ]] && continue
    count="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.\"${table}\"")"
    printf '%s %s\n' "$table" "$count" >> "$out"
  done < <(psql -At -v ON_ERROR_STOP=1 -c "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname ~ '^[a-z_][a-z0-9_]*$' ORDER BY 1")
}

checksum() {
  psql -At -v ON_ERROR_STOP=1 -c "SELECT md5(coalesce(string_agg(id::text, ',' ORDER BY id), '')) FROM public.memes;"
}

source_counts="$(mktemp)"
restored_counts="$(mktemp)"
plain="$(mktemp)"
encrypted="$(mktemp --suffix=.dump.gz.age)"
keydir="$(mktemp -d)"
key="$keydir/identity.txt"
recipient_file="$(mktemp)"
umask 077
trap 'rm -rf "$source_counts" "$restored_counts" "$plain" "$encrypted" "$keydir" "$recipient_file" "${PGPASSFILE:-}"' EXIT

snapshot "$source_counts"
source_sum="$(checksum)"
pg_dump -Fc -f "$plain"
age-keygen -o "$key" >/dev/null
age-keygen -y "$key" > "$recipient_file"
rm -f "$encrypted"
gzip -c "$plain" | age -R "$recipient_file" -o "$encrypted"
if gzip -t "$encrypted" 2>/dev/null; then
  echo "memecatch restore proof: backup was not encrypted" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS memecatch_restore_proof;"
psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE memecatch_restore_proof;"

scratch="$(
  DATABASE_URL="$source_url" python3 - <<'PY'
import os, urllib.parse
url = urllib.parse.urlparse(os.environ["DATABASE_URL"])
print(urllib.parse.urlunparse(url._replace(path="/memecatch_restore_proof")))
PY
)"
identity="$(cat "$key")"
MEMECATCH_RESTORE_CONFIRM=restore BACKUP_AGE_IDENTITY="$identity" DATABASE_URL="$scratch" \
  bash "$here/restore.sh" "$encrypted"

pg_env_from_url "$scratch"
snapshot "$restored_counts"
restored_sum="$(checksum)"
pg_env_from_url "$source_url"
psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS memecatch_restore_proof;"

if ! diff -u "$source_counts" "$restored_counts"; then
  echo "memecatch restore proof: table counts differ" >&2
  exit 1
fi
if [[ "$source_sum" != "$restored_sum" || -z "$source_sum" ]]; then
  echo "memecatch restore proof: meme checksum differs" >&2
  exit 1
fi
echo "memecatch restore proof: counts match, memes checksum ${source_sum}"
