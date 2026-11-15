#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
server="memecatch-upload-quota-$$"
trap 'docker rm -f "$server" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$server" -e POSTGRES_PASSWORD=postgres postgres:16 >/dev/null
for _ in $(seq 1 60); do
  if docker exec "$server" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$server" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
SQL
docker exec -i "$server" psql -U postgres -v ON_ERROR_STOP=1 < "$root/db/migrations/20261116010000_community_upload_storage_quota.sql" >/dev/null
psql_cmd=(docker exec -i "$server" psql -U postgres -v ON_ERROR_STOP=1 -At)
user_id=11111111-1111-4111-8111-111111111111
"${psql_cmd[@]}" -c 'GRANT EXECUTE ON FUNCTION public.reserve_community_upload_storage(uuid, bigint) TO anon, authenticated' >/dev/null
for role in anon authenticated; do
  if "${psql_cmd[@]}" -c "SET ROLE $role; SELECT public.reserve_community_upload_storage('$user_id', 1)" >/dev/null 2>&1; then
    echo "$role unexpectedly reserved storage" >&2; exit 1
  fi
done
"${psql_cmd[@]}" -c "INSERT INTO public.community_upload_storage_quota VALUES ('user:$user_id', 499, 499)" >/dev/null
jobs=()
for _ in $(seq 1 8); do
  ("${psql_cmd[@]}" -c "SET ROLE service_role; SELECT public.reserve_community_upload_storage('$user_id', 1)" >/dev/null 2>&1 || true) &
  jobs+=("$!")
done
for job in "${jobs[@]}"; do wait "$job"; done
[[ $("${psql_cmd[@]}" -c "SELECT reserved_objects FROM public.community_upload_storage_quota WHERE scope = 'user:$user_id'") == 500 ]]
[[ $("${psql_cmd[@]}" -c "SELECT reserved_objects FROM public.community_upload_storage_quota WHERE scope = 'global'") == 1 ]]
# Committed reservations survive process/database restarts and failed PUTs:
# no release is called on failure, so the database counter remains unchanged.
docker restart "$server" >/dev/null
[[ $("${psql_cmd[@]}" -c "SELECT reserved_objects FROM public.community_upload_storage_quota WHERE scope = 'user:$user_id'") == 500 ]]
echo 'community upload quota: permission, concurrency and persistence passed'
