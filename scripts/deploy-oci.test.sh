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

# MEMECATCH_AXUM puts the Axum server in front of Next. It is off unless the
# value is exactly 1, and off must plan what this script planned before the
# flag existed, byte for byte.
plan_own_off=$'memecatch: MEMECATCH_CADDY=own. Starting memeCatch\'s own Caddy.\nmode=own\nfiles=-f docker-compose.yml -f docker-compose.own-caddy.yml\nhealth=http://127.0.0.1/api/health'
plan_shared_off=$'memecatch: shared proxy on 127.0.0.1:12730. Paste deploy/Caddyfile.site into the existing reverse proxy.\nmemecatch: this script will not edit that proxy. Set MEMECATCH_CADDY=own only when 80 and 443 are free.\nmode=shared\nfiles=-f docker-compose.yml -f docker-compose.shared-proxy.yml\nhealth=http://127.0.0.1:12730/api/health'
printf 'OTHER=1\n' >"$tmp"
[[ "$(plan "$tmp" yes yes)" == "$plan_shared_off" ]] || { echo 'shared plan changed with the flag off' >&2; exit 1; }
[[ "$(plan "$tmp" yes yes MEMECATCH_CADDY=own)" == "$plan_own_off" ]] || { echo 'own plan changed with the flag off' >&2; exit 1; }
for value in 0 true yes on 11 ' 1'; do
  [[ "$(plan "$tmp" yes yes MEMECATCH_AXUM="$value")" == "$plan_shared_off" ]] || { echo "MEMECATCH_AXUM='$value' turned Axum on" >&2; exit 1; }
  printf 'MEMECATCH_AXUM=%s\n' "$value" >"$tmp"
  [[ "$(plan "$tmp" yes yes)" == "$plan_shared_off" ]] || { echo "MEMECATCH_AXUM='$value' in the env file turned Axum on" >&2; exit 1; }
  printf 'OTHER=1\n' >"$tmp"
done

# On, from the env file or the environment, in both Caddy modes: the same
# mode and health URL, with docker-compose.axum.yml last in the file list.
printf 'MEMECATCH_AXUM="1"\n' >"$tmp"
axum_shared="$(plan "$tmp" yes yes)"
[[ "$axum_shared" == *$'\nmode=shared\nfiles=-f docker-compose.yml -f docker-compose.shared-proxy.yml -f docker-compose.axum.yml\nhealth=http://127.0.0.1:12730/api/health' ]]
axum_own="$(plan "$tmp" yes yes MEMECATCH_CADDY=own)"
[[ "$axum_own" == *$'\nmode=own\nfiles=-f docker-compose.yml -f docker-compose.own-caddy.yml -f docker-compose.axum.yml\nhealth=http://127.0.0.1/api/health' ]]
# The environment wins over the env file, as for MEMECATCH_CADDY.
[[ "$(plan "$tmp" yes yes MEMECATCH_AXUM=0)" == "$plan_shared_off" ]] || { echo 'MEMECATCH_AXUM=0 did not override the env file' >&2; exit 1; }
printf 'OTHER=1\n' >"$tmp"
[[ "$(plan "$tmp" yes yes MEMECATCH_AXUM=1)" == "$axum_shared" ]] || { echo 'MEMECATCH_AXUM=1 from the environment was ignored' >&2; exit 1; }

# The docker calls of a deploy, with the containers' health under test control.
cat >"$stub/docker" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$test_calls"
case "$*" in
  "ps -aq --filter label=com.docker.compose.project=memecatch --filter label=com.docker.compose.service=next") printf '%s\n' "${test_stale_next:-}" ;;
  "inspect memecatch-app-1 "*) printf '%s\n' "${test_app_health-healthy}" ;;
  "inspect memecatch-next-1 "*) printf '%s\n' "${test_next_health-healthy}" ;;
esac
STUB
printf '#!/usr/bin/env bash\nexit 0\n' >"$stub/sleep"
chmod +x "$stub/sleep"
deploy() { : >"$calls"; env PATH="$stub:$PATH" test_calls="$calls" MEMECATCH_ENV_FILE="$tmp" "$@" bash "$script" >/dev/null 2>&1; }
line_of() { grep -n -x -- "$1" "$calls" | head -1 | cut -d: -f1; }
# Both calls were made, the first before the second.
in_order() { [[ -n "$(line_of "$1")" && -n "$(line_of "$2")" ]] && (( $(line_of "$1") < $(line_of "$2") )); }
axum_files='compose -p memecatch -f docker-compose.yml -f docker-compose.shared-proxy.yml -f docker-compose.axum.yml'

# On: Next comes up and passes its health check before `app` is replaced, and
# `app` is replaced by itself before the containers that are slow to stop.
deploy MEMECATCH_AXUM=1 || { echo 'Axum deploy failed with both containers healthy' >&2; exit 1; }
in_order "$axum_files up -d --wait --wait-timeout 180 next" "$axum_files up -d --no-deps app" || { echo 'next was not brought up healthy before app was replaced' >&2; exit 1; }
in_order "$axum_files up -d --no-deps app" "$axum_files up -d" || { echo 'app was not replaced on its own before the other containers' >&2; exit 1; }
if grep -q -- '--force-recreate' "$calls"; then echo 'Axum deploy recreated containers unconditionally' >&2; exit 1; fi
if grep -qE '^(ps|rm) ' "$calls"; then echo 'Axum deploy looked for a container to remove' >&2; exit 1; fi
# A manual redeploy recreates Next first, then the listener.
deploy MEMECATCH_AXUM=1 DEPLOY_OCI_FORCE_RECREATE=1
in_order "$axum_files up -d --no-deps --force-recreate --wait --wait-timeout 180 next" "$axum_files up -d --no-deps --force-recreate app" || { echo 'manual Axum redeploy did not recreate next before app' >&2; exit 1; }
# ...and the listener only once: each recreate is a moment without one.
[[ "$(grep -c -- '--force-recreate app' "$calls")" == 1 ]] || { echo "manual Axum redeploy recreated app more than once: $(cat "$calls")" >&2; exit 1; }
# The health gate fails when either container is not healthy, even though the
# health URL answers (the curl stub always does).
for failing in test_app_health=unhealthy test_next_health=unhealthy test_next_health=starting test_app_health=; do
  if deploy MEMECATCH_AXUM=1 "$failing"; then echo "Axum deploy passed the health gate with $failing" >&2; exit 1; fi
done
deploy test_next_health=unhealthy || { echo 'a deploy without the flag looked at the next container health' >&2; exit 1; }
[[ "$(grep -c '^compose ' "$calls")" == 1 ]] || { echo 'a deploy without the flag ran more than its one compose command' >&2; exit 1; }
# The Next image is pulled for the service that runs it.
deploy MEMECATCH_AXUM=1 MEMECATCH_IMAGE=ghcr.io/example/memecatch:1
grep -q -x -- "$axum_files pull next" "$calls" || { echo 'Axum deploy did not pull the Next image for next' >&2; exit 1; }
deploy MEMECATCH_IMAGE=ghcr.io/example/memecatch:1
grep -q -x -- 'compose -p memecatch -f docker-compose.yml -f docker-compose.shared-proxy.yml pull app' "$calls" || { echo 'deploy without the flag did not pull app' >&2; exit 1; }

# Off after on: the `next` container an Axum deploy left is removed, after
# `app` is Next again, and nothing else is.
deploy test_stale_next=abc123
in_order 'compose -p memecatch -f docker-compose.yml -f docker-compose.shared-proxy.yml up -d' 'rm -f abc123' || { echo 'the leftover next container was not removed after app was replaced' >&2; exit 1; }
[[ "$(grep -c '^rm ' "$calls")" == 1 ]] || { echo 'more than the next container was removed' >&2; exit 1; }
if grep -q 'axum' "$calls"; then echo 'deploy without the flag named docker-compose.axum.yml' >&2; exit 1; fi
# Off with nothing left behind removes nothing.
deploy
if grep -q '^rm ' "$calls"; then echo 'deploy without the flag removed a container' >&2; exit 1; fi

# MEMECATCH_NEXT=0 leaves Next out. Only the value 0, only with
# MEMECATCH_AXUM=1; any other value, or none, plans what was planned before.
printf 'OTHER=1\n' >"$tmp"
for value in 1 false no off ' 0' 00 ''; do
  [[ "$(plan "$tmp" yes yes MEMECATCH_NEXT="$value")" == "$plan_shared_off" ]] || { echo "MEMECATCH_NEXT='$value' changed the plan without Axum" >&2; exit 1; }
  [[ "$(plan "$tmp" yes yes MEMECATCH_AXUM=1 MEMECATCH_NEXT="$value")" == "$axum_shared" ]] || { echo "MEMECATCH_NEXT='$value' turned Next off" >&2; exit 1; }
done
# Without Axum there would be nothing to answer: refused before any docker
# call, from the environment or the env file.
for source in env file; do
  if [[ "$source" == env ]]; then
    printf 'OTHER=1\n' >"$tmp"; set -- MEMECATCH_NEXT=0
  else
    printf 'MEMECATCH_NEXT=0\n' >"$tmp"; set --
  fi
  if plan "$tmp" yes yes "$@" >"$err" 2>&1; then echo "MEMECATCH_NEXT=0 without Axum was planned ($source)" >&2; exit 1; fi
  grep -q 'needs MEMECATCH_AXUM=1' "$err" || { echo "the refusal does not say why: $(cat "$err")" >&2; exit 1; }
  if deploy "$@"; then echo "MEMECATCH_NEXT=0 without Axum deployed ($source)" >&2; exit 1; fi
  [[ ! -s "$calls" ]] || { echo "MEMECATCH_NEXT=0 without Axum ran docker: $(cat "$calls")" >&2; exit 1; }
done
set --
# On, from the env file or the environment, in both Caddy modes: the Axum
# file list, then docker-compose.no-next.yml.
printf 'MEMECATCH_AXUM=1\nMEMECATCH_NEXT="0"\n' >"$tmp"
alone_shared="$(plan "$tmp" yes yes)"
[[ "$alone_shared" == *$'\nmode=shared\nfiles=-f docker-compose.yml -f docker-compose.shared-proxy.yml -f docker-compose.axum.yml -f docker-compose.no-next.yml\nhealth=http://127.0.0.1:12730/api/health' ]] || { echo "plan without Next: $alone_shared" >&2; exit 1; }
[[ "$(plan "$tmp" yes yes MEMECATCH_CADDY=own)" == *$'\nmode=own\nfiles=-f docker-compose.yml -f docker-compose.own-caddy.yml -f docker-compose.axum.yml -f docker-compose.no-next.yml\nhealth=http://127.0.0.1/api/health' ]] || { echo 'own plan without Next' >&2; exit 1; }
[[ "$(plan "$tmp" yes yes MEMECATCH_NEXT=1)" == "$axum_shared" ]] || { echo 'MEMECATCH_NEXT=1 did not override the env file' >&2; exit 1; }
printf 'OTHER=1\n' >"$tmp"
[[ "$(plan "$tmp" yes yes MEMECATCH_AXUM=1 MEMECATCH_NEXT=0)" == "$alone_shared" ]] || { echo 'MEMECATCH_NEXT=0 from the environment was ignored' >&2; exit 1; }

# Deploy without Next: `app` alone first, then the rest; nothing waits for or
# names `next`, and a Next container's health is not looked at.
alone_files="$axum_files -f docker-compose.no-next.yml"
alone=(MEMECATCH_AXUM=1 MEMECATCH_NEXT=0)
deploy "${alone[@]}" test_next_health= || { echo 'deploy without Next failed with app healthy' >&2; exit 1; }
in_order "$alone_files up -d --no-deps app" "$alone_files up -d" || { echo "app was not replaced on its own first: $(cat "$calls")" >&2; exit 1; }
[[ "$(grep -c '^compose ' "$calls")" == 2 ]] || { echo "deploy without Next ran other compose commands: $(cat "$calls")" >&2; exit 1; }
if grep -qE -- '(--wait| next$|inspect memecatch-next-1)' "$calls"; then echo "deploy without Next looked at next: $(cat "$calls")" >&2; exit 1; fi
for failing in test_app_health=unhealthy test_app_health=starting test_app_health=; do
  if deploy "${alone[@]}" "$failing"; then echo "deploy without Next passed the health gate with $failing" >&2; exit 1; fi
done
# The Next container an Axum deploy left is removed once `app` answers alone.
deploy "${alone[@]}" test_stale_next=abc123
in_order "$alone_files up -d" 'rm -f abc123' || { echo "the next container was not removed after app was replaced: $(cat "$calls")" >&2; exit 1; }
[[ "$(grep -c '^rm ' "$calls")" == 1 ]] || { echo 'more than the next container was removed' >&2; exit 1; }
# A manual redeploy recreates the listener once; no Next image is pulled.
deploy "${alone[@]}" DEPLOY_OCI_FORCE_RECREATE=1
[[ "$(grep -c -- '--force-recreate' "$calls")" == 1 ]] || { echo "manual redeploy without Next recreated more than app: $(cat "$calls")" >&2; exit 1; }
grep -q -x -- "$alone_files up -d --no-deps --force-recreate app" "$calls" || { echo "manual redeploy without Next did not recreate app: $(cat "$calls")" >&2; exit 1; }
deploy "${alone[@]}" MEMECATCH_IMAGE=ghcr.io/example/memecatch:1 MEMECATCH_WORKER_IMAGE=ghcr.io/example/worker:1
if grep -q -- ' pull app\| pull next' "$calls"; then echo 'deploy without Next pulled a Next image' >&2; exit 1; fi
grep -q -x -- "$alone_files pull mpe-worker" "$calls" || { echo 'deploy without Next did not pull the worker' >&2; exit 1; }

echo "deploy-oci plan ok"
