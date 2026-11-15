#!/usr/bin/env bash
# Pure-function checks for the pull-based deploy agent. No docker, no network.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
# shellcheck source=deploy/autodeploy/autodeploy.sh
source "$here/autodeploy.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }
state() { printf '%s' "$1" | ci_state_from_json; }

# CI gate: only a completed, successful `check` run deploys.
[[ "$(state '{"check_runs":[]}')" == pending ]] || fail "no run must wait"
[[ "$(state '{"check_runs":[{"name":"check","status":"in_progress","conclusion":null,"started_at":"1"}]}')" == pending ]] || fail "in-progress must wait"
[[ "$(state '{"check_runs":[{"name":"check","status":"completed","conclusion":"success","started_at":"1"}]}')" == success ]] || fail "success must deploy"
[[ "$(state '{"check_runs":[{"name":"check","status":"completed","conclusion":"failure","started_at":"1"}]}')" == failure ]] || fail "failure must stop"
[[ "$(state '{"check_runs":[{"name":"check","status":"completed","conclusion":"cancelled","started_at":"1"}]}')" == failure ]] || fail "cancelled must stop"
# A re-run that succeeded after a failure wins (latest started_at).
[[ "$(state '{"check_runs":[{"name":"check","status":"completed","conclusion":"failure","started_at":"2026-01-01T00:00:00Z"},{"name":"check","status":"completed","conclusion":"success","started_at":"2026-01-02T00:00:00Z"}]}')" == success ]] || fail "latest re-run must win"
# Another check's success never counts.
[[ "$(state '{"check_runs":[{"name":"lint","status":"completed","conclusion":"success","started_at":"1"}]}')" == pending ]] || fail "other check must not count"

# Build args come only from public NEXT_PUBLIC_ values; comments and blanks are skipped.
mapfile -t args < <(build_args "$root/deploy/build.env")
(( ${#args[@]} > 0 )) || fail "build.env produced no args"
for ((i = 0; i < ${#args[@]}; i += 2)); do
  [[ "${args[i]}" == --build-arg ]] || fail "unexpected token ${args[i]}"
  [[ "${args[i + 1]}" == NEXT_PUBLIC_*=* ]] || fail "non-public build value: ${args[i + 1]%%=*}"
done
if grep -vE '^(#|$|NEXT_PUBLIC_[A-Z_]+=)' "$root/deploy/build.env"; then
  fail "deploy/build.env may hold only NEXT_PUBLIC_ values"
fi

# Migration gate sees added or changed files under db/migrations/ only.
repo="$(mktemp -d)"
commit() { git -C "$repo" add -A && git -C "$repo" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "$1"; git -C "$repo" rev-parse HEAD; }
git -C "$repo" init -q
base="$(commit base)"
mkdir -p "$repo/db/migrations" "$repo/app"
echo x >"$repo/app/page.tsx"
code="$(commit code)"
echo "select 1;" >"$repo/db/migrations/20990101000000_x.sql"
mig="$(commit mig)"
ROOT="$repo"
[[ -z "$(new_migrations "$base" "$code")" ]] || fail "code-only change flagged as migration"
[[ "$(new_migrations "$code" "$mig")" == db/migrations/20990101000000_x.sql ]] || fail "migration not detected"

# Build failure must propagate even under `if !` (errexit off), and must stop
# before the auxiliary compose build runs.
stub="$(mktemp -d)"
trap 'rm -rf "$repo" "$stub"' EXIT
calls="$stub/calls"
cat >"$stub/docker" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$stub_calls"
[[ "$1" == build && "${stub_fail_build:-}" == 1 ]] && exit 1
exit 0
STUB
cat >"$stub/nice" <<'STUB'
#!/usr/bin/env bash
shift 2; exec "$@"
STUB
chmod +x "$stub/docker" "$stub/nice"
mkdir -p "$repo/deploy" && cp "$root/deploy/build.env" "$repo/deploy/build.env"
if PATH="$stub:$PATH" stub_calls="$calls" stub_fail_build=1 build_images abc; then fail "failed app build reported success"; fi
grep -q "^compose" "$calls" && fail "compose build ran after the app build failed"
: >"$calls"
PATH="$stub:$PATH" stub_calls="$calls" build_images abc || fail "clean build reported failure"
grep -q "^compose" "$calls" || fail "auxiliary images were not built"

# The app snapshot name matches what restore_rollback deploys, whatever registry ran it.
[[ "$(rollback_ref app ghcr.io/toriskr/memecatch:abc s1)" == memecatch:rollback-s1 ]] || fail "app snapshot from GHCR"
[[ "$(rollback_ref app memecatch:release-abc s1)" == memecatch:rollback-s1 ]] || fail "app snapshot from local"
[[ "$(rollback_ref mpe-worker memecatch-worker:local s1)" == memecatch-worker:rollback-s1 ]] || fail "worker snapshot"
[[ "$(rollback_ref scheduler memecatch-scheduler s1)" == memecatch-scheduler:rollback-s1 ]] || fail "untagged image snapshot"

# The running agent lives outside the checkout and only changes when the checkout's
# copy differs; a checkout without the agent (an older release) leaves it alone.
STATE_DIR="$stub/state"
mkdir -p "$repo/deploy/autodeploy"
echo "v2" >"$repo/deploy/autodeploy/autodeploy.sh"
self_update >/dev/null
[[ "$(cat "$STATE_DIR/bin/autodeploy.sh")" == v2 ]] || fail "agent not installed from checkout"
rm "$repo/deploy/autodeploy/autodeploy.sh"
self_update >/dev/null
[[ "$(cat "$STATE_DIR/bin/autodeploy.sh")" == v2 ]] || fail "agent removed when checkout lacks it"
grep -q '/var/lib/memecatch-autodeploy/bin/autodeploy.sh' "$here/memecatch-autodeploy.service" || fail "service must run the out-of-checkout copy"

echo "autodeploy OK"
