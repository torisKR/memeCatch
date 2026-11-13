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

echo "deploy-oci plan ok"
