#!/bin/bash
# Build is separate. This runs test-restore.sh inside the backup image
# against a throwaway Postgres, then removes that Postgres.
set -euo pipefail

image="memecatch-backup:ci"
server="memecatch-restore-proof-pg"
port="55433"

docker rm -f "$server" >/dev/null 2>&1 || true
trap 'docker rm -f "$server" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$server" --network host \
  -e POSTGRES_PASSWORD=postgres postgres:16 postgres -c port="$port" >/dev/null
ready=0
for _ in $(seq 1 90); do
  if docker logs "$server" 2>&1 | grep -q "init process complete" \
    && docker exec "$server" psql -v ON_ERROR_STOP=1 -U postgres -p "$port" -d postgres -c "select 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "restore postgres did not become ready" >&2
  docker logs "$server" >&2 || true
  exit 1
fi
docker exec -i "$server" psql -U postgres -p "$port" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.memes (id uuid PRIMARY KEY);
INSERT INTO public.memes VALUES ('11111111-1111-4111-8111-111111111111');
CREATE TABLE public.tags (name text PRIMARY KEY);
INSERT INTO public.tags VALUES ('tag');
SQL

envfile="$(mktemp)"
chmod 600 "$envfile"
cat > "$envfile" <<EOF
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/postgres
EOF
docker run --rm --network host \
  --env-file "$envfile" \
  --entrypoint bash "$image" /usr/local/bin/test-restore.sh
rm -f "$envfile"
