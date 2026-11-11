#!/bin/bash
# memecatch_backup must not write through SECURITY DEFINER functions or create
# temp tables, even after setting app.user_id. The app login still can.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
server="memecatch-backup-ro"
port="55436"
user_id="11111111-1111-4111-8111-111111111111"

docker rm -f "$server" >/dev/null 2>&1 || true
trap 'docker rm -f "$server" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$server" \
  -e POSTGRES_PASSWORD=postgres \
  -e MEMECATCH_BACKUP_DB_PASSWORD=backup \
  -p "127.0.0.1:${port}:5432" \
  postgres:16 >/dev/null

# pg_isready turns true while the entrypoint is still restarting. The next
# check then exits 2. Wait until the server accepts a query.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$server" psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres -c "select 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "postgres did not accept a query" >&2
  docker logs "$server" >&2 || true
  exit 1
fi

docker cp "$root/deploy/postgres/99-app-identity.sql" "$server:/tmp/99-app-identity.sql"
docker cp "$root/deploy/postgres/backup-role.sh" "$server:/tmp/backup-role.sh"

docker exec -i "$server" psql -U postgres -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE memecatch;"
docker exec -i "$server" psql -U postgres -v ON_ERROR_STOP=1 -d memecatch <<'SQL'
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE ROLE memecatch LOGIN NOINHERIT;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
SQL
docker exec "$server" psql -U postgres -v ON_ERROR_STOP=1 -d memecatch -f /tmp/99-app-identity.sql
docker exec -i "$server" psql -U postgres -v ON_ERROR_STOP=1 -d memecatch <<'SQL'
CREATE TABLE public.reactions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  meme_id integer NOT NULL
);
CREATE FUNCTION public.toggle_reaction(p_meme integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reactions (user_id, meme_id) VALUES (auth.uid(), p_meme);
END $$;
SQL
docker exec -u postgres -e MEMECATCH_BACKUP_DB_PASSWORD=backup "$server" \
  bash -c 'source /tmp/backup-role.sh && ensure_backup_role'

fail_as_backup() {
  local label="$1"
  local sql="$2"
  local status=0
  docker exec "$server" psql -U memecatch_backup -d memecatch -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1 || status=$?
  if [[ "$status" -eq 0 ]]; then
    echo "memecatch backup readonly: ${label} succeeded" >&2
    exit 1
  fi
}

fail_as_backup "temp table" "CREATE TEMP TABLE memecatch_backup_nope(id integer);"
fail_as_backup "toggle_reaction" "SELECT set_config('app.user_id', '${user_id}', false); SELECT public.toggle_reaction(1);"

uid_null="$(docker exec "$server" psql -U memecatch_backup -d memecatch -At -c "SELECT auth.uid() IS NULL FROM (SELECT set_config('app.user_id', '${user_id}', false)) s;")"
if [[ "$uid_null" != "t" ]]; then
  echo "memecatch backup readonly: auth.uid() returned a value (${uid_null})" >&2
  exit 1
fi

reactions="$(docker exec "$server" psql -U postgres -d memecatch -At -c "SELECT count(*) FROM public.reactions;")"
if [[ "$reactions" != "0" ]]; then
  echo "memecatch backup readonly: toggle_reaction wrote ${reactions} row(s)" >&2
  exit 1
fi

app_uid="$(docker exec "$server" psql -U memecatch -d memecatch -At -c "SELECT auth.uid()::text FROM (SELECT set_config('app.user_id', '${user_id}', false)) s;")"
if [[ "$app_uid" != "$user_id" ]]; then
  echo "memecatch backup readonly: app login auth.uid() was ${app_uid}" >&2
  exit 1
fi

docker exec -i "$server" psql -U memecatch -d memecatch -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('app.user_id', '${user_id}', true);
SET LOCAL ROLE authenticated;
SELECT public.toggle_reaction(1);
COMMIT;
SQL
written="$(docker exec "$server" psql -U postgres -d memecatch -At -c "SELECT user_id::text FROM public.reactions;")"
if [[ "$written" != "$user_id" ]]; then
  echo "memecatch backup readonly: authenticated write recorded ${written}" >&2
  exit 1
fi

docker exec -i "$server" psql -U postgres -d memecatch -v ON_ERROR_STOP=1 <<'SQL'
CREATE FUNCTION public.future_writer(p_meme integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reactions (user_id, meme_id) VALUES (auth.uid(), p_meme);
END $$;
SQL
backup_exec="$(docker exec "$server" psql -U postgres -d memecatch -At -c "SELECT has_function_privilege('memecatch_backup', 'public.future_writer(integer)', 'EXECUTE');")"
app_exec="$(docker exec "$server" psql -U postgres -d memecatch -At -c "SELECT has_function_privilege('authenticated', 'public.future_writer(integer)', 'EXECUTE');")"
if [[ "$backup_exec" != "f" || "$app_exec" != "t" ]]; then
  echo "memecatch backup readonly: future function privileges backup=${backup_exec} authenticated=${app_exec}" >&2
  exit 1
fi

echo "memecatch backup readonly: backup login cannot write or create temp tables"
