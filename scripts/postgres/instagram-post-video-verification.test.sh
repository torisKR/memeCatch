#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
server="memecatch-instagram-video-pgtap-$(date +%s)-$$"
db_password="instagram-video-pgtap-ci"
migration_count="$({
  find "$root/db/migrations" -maxdepth 1 -type f -name '*.sql' \
    ! -name '20261007083649_meme_collectible_catalog_seed.sql' \
    ! -name '20261103_seed_curated_memes.sql'
} | wc -l | tr -d ' ')"

cleanup() {
  docker rm -f "$server" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$server" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=memecatch \
  -e MEMECATCH_DB_PASSWORD="$db_password" \
  -e MEMECATCH_BACKUP_DB_PASSWORD=instagram-video-pgtap-backup \
  -v "$root/deploy/postgres:/sql:ro" \
  -v "$root/db/migrations:/migrations:ro" \
  -v "$root/db/tests:/tests:ro" \
  pgvector/pgvector:pg16 >/dev/null

ready=0
for _ in $(seq 1 90); do
  if docker logs "$server" 2>&1 | grep -q "init process complete" \
    && docker exec "$server" psql -v ON_ERROR_STOP=1 -U postgres -d memecatch -c 'select 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "instagram post video pgTAP postgres did not become ready" >&2
  docker logs "$server" >&2 || true
  exit 1
fi

docker exec \
  -e DEBIAN_FRONTEND=noninteractive \
  "$server" bash -ceu '
    apt-get update
    apt-get install -y --no-install-recommends \
      postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
    rm -rf /var/lib/apt/lists/*
  '

# Install the test-only extension before the project bootstrap hardens default
# function privileges. The SQL test still owns its transactional role grants.
docker exec -i "$server" psql -v ON_ERROR_STOP=1 -U postgres -d memecatch \
  -f /sql/00-bootstrap.sql >/dev/null
docker exec -i "$server" psql -v ON_ERROR_STOP=1 -U postgres -d memecatch \
  -c 'create extension if not exists pgtap with schema extensions' >/dev/null

echo "bootstrapping ${migration_count} project migrations (production catalog seeds excluded)"
docker exec \
  -e MEMECATCH_DB_PASSWORD="$db_password" \
  -e MEMECATCH_BACKUP_DB_PASSWORD=instagram-video-pgtap-backup \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=memecatch \
  "$server" bash -ceu '
    if ! bash /sql/init.sh >/tmp/memecatch-init.log 2>&1; then
      cat /tmp/memecatch-init.log >&2
      exit 1
    fi
  '

docker exec \
  -e PGOPTIONS='-c search_path=public,extensions' \
  "$server" pg_prove --username postgres --dbname memecatch \
  /tests/instagram_post_video_verification.test.sql
