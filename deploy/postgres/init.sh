#!/bin/bash
# First-boot schema load for the memecatch database. Runs as the Postgres
# entrypoint user. Does not touch any other database or cluster.
set -euo pipefail

if [[ -z "${MEMECATCH_DB_PASSWORD:-}" ]]; then
  echo "MEMECATCH_DB_PASSWORD is required" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB")

echo "memecatch: bootstrap"
"${PSQL[@]}" -f /sql/00-bootstrap.sql

# Dollar-quote the password so quotes and backslashes stay literal.
PW_TAG="pw$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
"${PSQL[@]}" -v ON_ERROR_STOP=1 <<SQL
DO \$do\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'memecatch') THEN
    CREATE ROLE memecatch LOGIN PASSWORD \$${PW_TAG}\$${MEMECATCH_DB_PASSWORD}\$${PW_TAG}\$;
  ELSE
    ALTER ROLE memecatch WITH LOGIN PASSWORD \$${PW_TAG}\$${MEMECATCH_DB_PASSWORD}\$${PW_TAG}\$;
  END IF;
END
\$do\$;
SQL
"${PSQL[@]}" -c "GRANT CONNECT ON DATABASE \"${POSTGRES_DB}\" TO memecatch;"

echo "memecatch: migrations"
shopt -s nullglob
mapfile -t files < <(find /migrations -maxdepth 1 -type f -name '*.sql' | sort)
for file in "${files[@]}"; do
  base=$(basename "$file")
  # The collectible catalog seed asserts 1000 approved production memes.
  # An empty database (and a partial curated seed) cannot satisfy it.
  # scripts/postgres/apply-catalog-seed.sh runs it after the catalog restore.
  if [[ "$base" == *meme_collectible_catalog_seed.sql || "$base" == *seed_curated_memes.sql ]]; then
    echo "memecatch: defer $base until the production catalog is loaded"
    continue
  fi
  echo "memecatch: apply $base"
  # pg_net and pg_cron are not in the vanilla image. The compose scheduler
  # owns those jobs. Everything else in the file still runs.
  sed -E \
    -e '/create extension if not exists pg_net/Id' \
    -e '/create extension if not exists pg_cron/Id' \
    "$file" | "${PSQL[@]}"
done

echo "memecatch: app identity"
"${PSQL[@]}" -f /sql/99-app-identity.sql
echo "memecatch: schema ready"
