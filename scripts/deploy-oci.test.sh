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
case "$*" in "inspect memecatch-app-1 "*) echo healthy ;; esac
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

# The deploy agent of the release before the cutover passes MEMECATCH_AXUM,
# MEMECATCH_NEXT and MEMECATCH_IMAGE (docs/oci-setup.md, "Cutover"); they
# change nothing now: the plan is the same byte for byte.
plan_own=$'memecatch: MEMECATCH_CADDY=own. Starting memeCatch\'s own Caddy.\nmode=own\nfiles=-f docker-compose.yml -f docker-compose.own-caddy.yml\nhealth=http://127.0.0.1/api/health'
plan_shared=$'memecatch: shared proxy on 127.0.0.1:12730. Paste deploy/Caddyfile.site into the existing reverse proxy.\nmemecatch: this script will not edit that proxy. Set MEMECATCH_CADDY=own only when 80 and 443 are free.\nmode=shared\nfiles=-f docker-compose.yml -f docker-compose.shared-proxy.yml\nhealth=http://127.0.0.1:12730/api/health'
printf 'OTHER=1\n' >"$tmp"
[[ "$(plan "$tmp" yes yes)" == "$plan_shared" ]] || { echo 'shared plan changed' >&2; exit 1; }
[[ "$(plan "$tmp" yes yes MEMECATCH_CADDY=own)" == "$plan_own" ]] || { echo 'own plan changed' >&2; exit 1; }
for flags in "MEMECATCH_AXUM=1 MEMECATCH_NEXT=0" "MEMECATCH_AXUM=1 MEMECATCH_NEXT=1" "MEMECATCH_AXUM=0" "MEMECATCH_NEXT=0" "MEMECATCH_IMAGE=memecatch:release-x"; do
  # shellcheck disable=SC2086 # the flags are words
  [[ "$(plan "$tmp" yes yes $flags)" == "$plan_shared" ]] || { echo "$flags changed the plan" >&2; exit 1; }
done
printf 'MEMECATCH_AXUM=1\nMEMECATCH_NEXT=0\n' >"$tmp"
[[ "$(plan "$tmp" yes yes)" == "$plan_shared" ]] || { echo 'the old flags in the env file changed the plan' >&2; exit 1; }
printf 'OTHER=1\n' >"$tmp"

# The docker calls of a deploy, with the container's health under test control.
cat >"$stub/docker" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$test_calls"
case "$*" in
  "ps -aq --filter label=com.docker.compose.project=memecatch --filter label=com.docker.compose.service=next") printf '%s\n' "${test_stale_next:-}" ;;
  "inspect memecatch-app-1 "*) printf '%s\n' "${test_app_health-healthy}" ;;
esac
STUB
printf '#!/usr/bin/env bash\nexit 0\n' >"$stub/sleep"
chmod +x "$stub/sleep"
deploy() { : >"$calls"; env PATH="$stub:$PATH" test_calls="$calls" MEMECATCH_ENV_FILE="$tmp" "$@" bash "$script" >/dev/null 2>&1; }
line_of() { grep -n -x -- "$1" "$calls" | head -1 | cut -d: -f1; }
# Both calls were made, the first before the second.
in_order() { [[ -n "$(line_of "$1")" && -n "$(line_of "$2")" ]] && (( $(line_of "$1") < $(line_of "$2") )); }
files='compose -p memecatch -f docker-compose.yml -f docker-compose.shared-proxy.yml'

# `app` by itself first, then the rest; two compose commands in all.
deploy || { echo 'deploy failed with app healthy' >&2; exit 1; }
in_order "$files up -d --no-deps app" "$files up -d" || { echo "app was not replaced on its own first: $(cat "$calls")" >&2; exit 1; }
[[ "$(grep -c '^compose ' "$calls")" == 2 ]] || { echo "deploy ran other compose commands: $(cat "$calls")" >&2; exit 1; }
if grep -q -- '--force-recreate' "$calls"; then echo 'deploy recreated containers unconditionally' >&2; exit 1; fi
if grep -qE -- '(--wait| next$|inspect memecatch-next-1|axum|no-next)' "$calls"; then echo "deploy named the Next service or the old files: $(cat "$calls")" >&2; exit 1; fi
# The health gate fails when the container is not healthy, even though the
# health URL answers (the curl stub always does).
for failing in test_app_health=unhealthy test_app_health=starting test_app_health=; do
  if deploy "$failing"; then echo "deploy passed the health gate with $failing" >&2; exit 1; fi
done
# A manual redeploy recreates the listener once.
deploy DEPLOY_OCI_FORCE_RECREATE=1
[[ "$(grep -c -- '--force-recreate' "$calls")" == 1 ]] || { echo "manual redeploy recreated more than app: $(cat "$calls")" >&2; exit 1; }
grep -q -x -- "$files up -d --no-deps --force-recreate app" "$calls" || { echo "manual redeploy did not recreate app: $(cat "$calls")" >&2; exit 1; }
# Registry images are pulled for their services; a Next image is not.
deploy MEMECATCH_SERVER_IMAGE=ghcr.io/example/server:1 MEMECATCH_WORKER_IMAGE=ghcr.io/example/worker:1 MEMECATCH_IMAGE=ghcr.io/example/memecatch:1
grep -q -x -- "$files pull app" "$calls" || { echo 'the server image was not pulled' >&2; exit 1; }
grep -q -x -- "$files pull mpe-worker" "$calls" || { echo 'the worker image was not pulled' >&2; exit 1; }
[[ "$(grep -c ' pull ' "$calls")" == 2 ]] || { echo "more than two pulls: $(cat "$calls")" >&2; exit 1; }

# The cutover: the `next` container of the release before is removed once
# `app` is up, and nothing else is.
deploy test_stale_next=abc123
in_order "$files up -d" 'rm -f abc123' || { echo "the next container was not removed after app was replaced: $(cat "$calls")" >&2; exit 1; }
[[ "$(grep -c '^rm ' "$calls")" == 1 ]] || { echo 'more than the next container was removed' >&2; exit 1; }
# Nothing left behind: nothing removed.
deploy
if grep -q '^rm ' "$calls"; then echo 'deploy removed a container' >&2; exit 1; fi

echo "deploy-oci plan ok"
