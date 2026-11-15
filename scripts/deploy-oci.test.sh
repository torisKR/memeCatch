#!/usr/bin/env bash
# The live VM already runs memeCatch's own Caddy on 80/443. A redeploy must
# keep that mode, including when the shell did not export MEMECATCH_CADDY,
# and must not treat the project's own listener as a foreign proxy.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
script="$root/scripts/deploy-oci.sh"
tmp="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$tmp" "$err"' EXIT

plan() {
  local env_file="$1" ports="$2" own="$3"
  shift 3
  env \
    MEMECATCH_ENV_FILE="$env_file" \
    DEPLOY_OCI_PRINT_PLAN=1 \
    DEPLOY_OCI_PORTS_BUSY="$ports" \
    DEPLOY_OCI_OWN_CADDY_RUNNING="$own" \
    "$@" \
    bash "$script"
}

printf 'MEMECATCH_CADDY="own"\nBETTER_AUTH_SECRET=super-secret-value\n' >"$tmp"
own_plan="$(plan "$tmp" yes yes)"
[[ "$own_plan" == *$'\nmode=own\n'* || "$own_plan" == mode=own* ]]
[[ "$own_plan" == *"-f docker-compose.yml -f docker-compose.own-caddy.yml"* ]]
[[ "$own_plan" == *"health=http://127.0.0.1/api/health"* ]]
[[ "$own_plan" != *super-secret-value* ]]

if plan "$tmp" yes no >"$err" 2>"$err"; then
  echo "foreign listener on 80/443 was accepted" >&2
  exit 1
fi
[[ "$(cat "$err")" == *"another process"* ]]

printf 'OTHER=1\n' >"$tmp"
shared_plan="$(plan "$tmp" yes yes)"
[[ "$shared_plan" == *"mode=shared"* ]]
[[ "$shared_plan" == *"-f docker-compose.yml -f docker-compose.shared-proxy.yml"* ]]
[[ "$shared_plan" == *"health=http://127.0.0.1:12730/api/health"* ]]

override_plan="$(plan "$tmp" yes yes MEMECATCH_CADDY=own)"
[[ "$override_plan" == *"mode=own"* ]]

stub="$(mktemp -d)"
trap 'rm -f "$tmp" "$err"; rm -rf "$stub"' EXIT
cat >"$stub/docker" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$test_calls"
STUB
cat >"$stub/curl" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "$stub/docker" "$stub/curl"
calls="$stub/calls"
PATH="$stub:$PATH" test_calls="$calls" MEMECATCH_ENV_FILE="$tmp" DEPLOY_OCI_FORCE_RECREATE=1 bash "$script" >/dev/null
grep -q 'up -d --no-deps --force-recreate app' "$calls" || { echo 'manual deploy did not recreate app' >&2; exit 1; }
: >"$calls"
PATH="$stub:$PATH" test_calls="$calls" MEMECATCH_ENV_FILE="$tmp" bash "$script" >/dev/null
if grep -q -- '--force-recreate' "$calls"; then echo 'automatic deploy recreated app unconditionally' >&2; exit 1; fi

echo "deploy-oci plan ok"
