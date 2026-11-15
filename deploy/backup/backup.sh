#!/bin/bash
# Dump the memecatch database, encrypt it, and upload it to R2.
# No-ops when R2 is not configured. Never reads or writes any other database.
set -euo pipefail

if [[ -z "${R2_ACCOUNT_ID:-}" || -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" || -z "${R2_BACKUP_BUCKET:-}" ]]; then
  echo "memecatch backup: R2 backup settings are unset, skipping"
  exit 0
fi
if [[ -z "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  echo "memecatch backup: BACKUP_AGE_RECIPIENT is required when R2 backups are enabled" >&2
  exit 1
fi
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

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
plain="$(mktemp)"
encrypted="$(mktemp)"
recipient="$(mktemp)"
umask 077
printf '%s\n' "$BACKUP_AGE_RECIPIENT" > "$recipient"
trap 'rm -f "$plain" "$encrypted" "$recipient" "${PGPASSFILE:-}"' EXIT

pg_dump -Fc -f "$plain"
rm -f "$encrypted"
gzip -c "$plain" | age -R "$recipient" -o "$encrypted"

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=auto
endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
name="${stamp}.dump.gz.age"
aws s3 cp --endpoint-url "$endpoint" "$encrypted" "s3://${R2_BACKUP_BUCKET}/memecatch/${name}"

retention="${BACKUP_RETENTION_DAYS:-14}"
cutoff="$(date -u -d "${retention} days ago" +%Y%m%dT%H%M%SZ 2>/dev/null || date -u -v-"${retention}"d +%Y%m%dT%H%M%SZ)"
aws s3 ls --endpoint-url "$endpoint" "s3://${R2_BACKUP_BUCKET}/memecatch/" | while read -r _ _ _ object; do
  key="${object%.age}"
  key="${key%.dump.gz}"
  if [[ "$key" < "$cutoff" ]]; then
    aws s3 rm --endpoint-url "$endpoint" "s3://${R2_BACKUP_BUCKET}/memecatch/${object}"
  fi
done
echo "memecatch backup: uploaded ${name}"
