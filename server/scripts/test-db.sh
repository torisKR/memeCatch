#!/usr/bin/env bash
# Throwaway Postgres for `cargo test`, loaded the way production loads it: the
# image entrypoint runs deploy/postgres/init.sh over db/migrations, with the
# same mounts as docker-compose.yml.
#
#   export DATABASE_URL="$(scripts/test-db.sh up)"   # role memecatch
#   cargo test
#   scripts/test-db.sh down
#
# `up` prints only the URL on stdout; progress goes to stderr. The port is
# random, the passwords are generated per container, and no .env file is read.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
container="${TEST_DB_CONTAINER:-memecatch-axum-test-pg}"

down() {
  docker rm -f -v "$container" >/dev/null 2>&1 || true
}

random_password() {
  od -An -N16 -tx1 /dev/urandom | tr -d ' \n'
}

up() {
  down
  local app_password
  app_password="$(random_password)"
  docker run -d --name "$container" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD="$(random_password)" \
    -e POSTGRES_DB=memecatch \
    -e MEMECATCH_DB_PASSWORD="$app_password" \
    -e MEMECATCH_BACKUP_DB_PASSWORD="$(random_password)" \
    -p 127.0.0.1::5432 \
    -v "$root/deploy/postgres/init.sh:/docker-entrypoint-initdb.d/00-init.sh:ro" \
    -v "$root/deploy/postgres/00-bootstrap.sql:/sql/00-bootstrap.sql:ro" \
    -v "$root/deploy/postgres/99-app-identity.sql:/sql/99-app-identity.sql:ro" \
    -v "$root/deploy/postgres/backup-role.sh:/sql/backup-role.sh:ro" \
    -v "$root/db/migrations:/migrations:ro" \
    pgvector/pgvector:pg16 >/dev/null

  # While init.sh runs, the entrypoint's temporary server listens on the unix
  # socket only. A TCP connection succeeds once the schema is loaded and the
  # real server is up.
  local ready=0
  for _ in $(seq 1 180); do
    if [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)" != "true" ]]; then
      break
    fi
    if docker exec "$container" psql -h 127.0.0.1 -U postgres -d memecatch -qAt \
      -c "select 1 from pg_roles where rolname = 'memecatch'" 2>/dev/null | grep -q 1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" != "1" ]]; then
    echo "test database did not become ready" >&2
    docker logs --tail 60 "$container" >&2 || true
    down
    exit 1
  fi

  local port
  port="$(docker port "$container" 5432/tcp | head -n 1 | sed 's/.*://')"
  echo "test database ready in container $container on 127.0.0.1:$port" >&2
  echo "postgresql://memecatch:${app_password}@127.0.0.1:${port}/memecatch"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  *)
    echo "usage: $0 up|down" >&2
    exit 2
    ;;
esac
