#!/bin/bash
# Dump the memecatch database and upload it to R2. No-ops when R2 is not configured.
# Never reads or writes any other database.
set -euo pipefail

if [[ -z "${R2_ACCOUNT_ID:-}" || -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" || -z "${R2_BACKUP_BUCKET:-}" ]]; then
  echo "memecatch backup: R2 backup settings are unset, skipping"
  exit 0
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="/tmp/memecatch-${stamp}.dump.gz"
pg_dump -Fc --dbname="${DATABASE_URL}" | gzip -c > "$file"
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=auto
endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
aws s3 cp --endpoint-url "$endpoint" "$file" "s3://${R2_BACKUP_BUCKET}/memecatch/${stamp}.dump.gz"
rm -f "$file"

retention="${BACKUP_RETENTION_DAYS:-14}"
cutoff="$(date -u -d "${retention} days ago" +%Y%m%dT%H%M%SZ 2>/dev/null || date -u -v-"${retention}"d +%Y%m%dT%H%M%SZ)"
aws s3 ls --endpoint-url "$endpoint" "s3://${R2_BACKUP_BUCKET}/memecatch/" | while read -r _ _ _ name; do
  key="${name%.dump.gz}"
  if [[ "$key" < "$cutoff" ]]; then
    aws s3 rm --endpoint-url "$endpoint" "s3://${R2_BACKUP_BUCKET}/memecatch/${name}"
  fi
done
echo "memecatch backup: uploaded ${stamp}.dump.gz"
