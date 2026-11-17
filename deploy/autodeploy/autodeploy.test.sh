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

# Long quiet commands emit progress without hiding their exit status or leaving
# a heartbeat process behind after the command finishes.
heartbeat_output="$stub/heartbeat-output"
BUILD_HEARTBEAT_SECONDS=0.02 run_with_heartbeat "test build" bash -c 'sleep 0.07' >"$heartbeat_output"
heartbeat_count="$(grep -c 'test build still running' "$heartbeat_output")"
(( heartbeat_count >= 2 )) || fail "quiet command emitted too few heartbeats ($heartbeat_count)"
sleep 0.05
[[ "$(grep -c 'test build still running' "$heartbeat_output")" == "$heartbeat_count" ]] \
  || fail "heartbeat continued after the command finished"
BUILD_HEARTBEAT_SECONDS=31.337 run_with_heartbeat "child cleanup" bash -c 'sleep 0.05'
pgrep -f '^sleep 31[.]337$' >/dev/null && fail "heartbeat sleep child survived command completion"
rc=0
BUILD_HEARTBEAT_SECONDS=0.01 run_with_heartbeat "failing build" bash -c 'sleep 0.03; exit 7' >/dev/null || rc=$?
[[ "$rc" == 7 ]] || fail "heartbeat wrapper hid command failure (got $rc)"

# Deterministically signal between heartbeat spawn and heartbeat_pid assignment.
# The DEBUG hook records $! before sending TERM, making the startup race exact.
race="$stub/heartbeat-startup-race"
mkdir -p "$race"
race_pid_file="$race/heartbeat.pid"
race_rc=0
(
  set -T
  trap 'if [[ "$BASH_COMMAND" == "heartbeat_pid=\$!" ]]; then trap - DEBUG; printf "%s\n" "$!" >"$race_pid_file"; kill -TERM "$BASHPID"; fi' DEBUG
  BUILD_HEARTBEAT_SECONDS=300 run_with_heartbeat "startup race" bash -c 'exec 9>&-; sleep 300'
) 2>"$race/stderr" || race_rc=$?
race_heartbeat="$(cat "$race_pid_file")"
race_alive=0
kill -0 "$race_heartbeat" 2>/dev/null && race_alive=1
kill "$race_heartbeat" 2>/dev/null || true
[[ "$race_rc" != 0 ]] || fail "startup signal unexpectedly reported success"
[[ "$race_alive" == 0 ]] || fail "startup signal left heartbeat running"
! grep -q 'unbound variable' "$race/stderr" || fail "startup signal hit an unbound heartbeat_pid"
grep -q 'exec 9>&-' "$here/autodeploy.sh" || fail "heartbeat logger may inherit the deploy lock"

# Deterministically signal the inner logger after sleep starts but before its PID
# reaches sleeper. The logger must recover that active job and reap it promptly.
inner_race="$stub/heartbeat-sleeper-race"
mkdir -p "$inner_race"
inner_pid_file="$inner_race/sleeper.pid"
(
  set -T
  trap 'if [[ "$BASH_COMMAND" == "sleeper=\$!" ]]; then trap - DEBUG; printf "%s\n" "$!" >"$inner_pid_file"; kill -TERM "$BASHPID"; fi' DEBUG
  BUILD_HEARTBEAT_SECONDS=300 run_with_heartbeat "inner race" bash -c 'sleep 0.1'
) 2>"$inner_race/stderr"
inner_sleeper="$(cat "$inner_pid_file")"
inner_alive=0
kill -0 "$inner_sleeper" 2>/dev/null && inner_alive=1
kill "$inner_sleeper" 2>/dev/null || true
[[ "$inner_alive" == 0 ]] || fail "inner logger signal left heartbeat sleep running"
! grep -q 'unbound variable' "$inner_race/stderr" || fail "inner logger signal hit an unbound sleeper"

# Rollback redeploys exactly the snapshots recorded before the deploy, even when
# the replaced containers now run differently named images (GHCR -> local build).
STATE_DIR="$stub/state"; mkdir -p "$STATE_DIR"
cat >"$stub/docker" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$stub_calls"
case "$1 $2" in
  "inspect memecatch-app-1") [[ "$*" == *Config.Image* ]] && echo "${stub_app_image}" || echo sha256:app ;;
  "inspect memecatch-mpe-worker-1") [[ "$*" == *Config.Image* ]] && echo "${stub_worker_image}" || echo sha256:worker ;;
  "inspect memecatch-scheduler-1") [[ "$*" == *Config.Image* ]] && echo memecatch-scheduler || echo sha256:sched ;;
  "inspect memecatch-backup-1") [[ "$*" == *Config.Image* ]] && echo memecatch-backup || echo sha256:backup ;;
esac
exit 0
STUB
: >"$calls"
PATH="$stub:$PATH" stub_calls="$calls" stub_app_image=ghcr.io/toriskr/memecatch:old stub_worker_image=ghcr.io/toriskr/memecatch-worker:old tag_rollback s1
grep -q "^tag sha256:worker memecatch-worker:rollback-s1$" "$calls" || fail "worker snapshot not taken"
# The deploy then replaced both containers with local images; restore must ignore that.
mapfile -t env < <(PATH="$stub:$PATH" stub_calls="$calls" stub_app_image=memecatch:release-new stub_worker_image=memecatch-worker:local rollback_env s1)
[[ " ${env[*]} " == *" MEMECATCH_IMAGE=memecatch:rollback-s1 "* ]] || fail "app rollback ref: ${env[*]}"
[[ " ${env[*]} " == *" MEMECATCH_WORKER_IMAGE=memecatch-worker:rollback-s1 "* ]] || fail "worker rollback ref: ${env[*]}"
grep -q "^tag memecatch-scheduler:rollback-s1 memecatch-scheduler:local$" "$calls" || fail "scheduler not restored"
# Snapshots never carry a registry prefix that deploy-oci.sh would try to pull.
[[ "$(grep -c ghcr.io "$STATE_DIR/rollback-s1.refs")" == 0 ]] || fail "snapshot kept a ghcr.io name"
[[ "$(rollback_ref backup s1)" == memecatch-backup:rollback-s1 ]] || fail "backup snapshot name"

# A service whose image is already gone is skipped, not fatal, and is not recorded.
: >"$calls"
cat >"$stub/docker" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$stub_calls"
case "$1 $2" in
  "inspect memecatch-app-1") [[ "$*" == *Config.Image* ]] && echo memecatch:release-old || echo sha256:app ;;
  "inspect memecatch-mpe-worker-1") [[ "$*" == *Config.Image* ]] && echo memecatch-worker:local || echo sha256:gone ;;
  "inspect "*) [[ "$*" == *Config.Image* ]] && echo "${2#memecatch-}" | sed 's/-1$//;s/^/memecatch-/' || echo sha256:other ;;
  "tag sha256:gone") exit 1 ;;
esac
exit 0
STUB
PATH="$stub:$PATH" stub_calls="$calls" tag_rollback s2 >/dev/null || fail "missing image aborted the snapshot"
grep -q "^app memecatch:rollback-s2$" "$STATE_DIR/rollback-s2.refs" || fail "app snapshot missing"
grep -q "^mpe-worker" "$STATE_DIR/rollback-s2.refs" && fail "unsnapshotted worker was recorded"

# Every compose-built service names its image, so `compose up` recreates it after a rebuild.
for svc in mpe-worker scheduler backup; do
  awk -v s="  $svc:" '$0 == s {f=1; next} f && /^  [a-z]/ {exit} f && /^    image:/ {found=1} END {exit !found}' "$root/docker-compose.yml" \
    || fail "$svc has no image: in docker-compose.yml"
done

# Snapshots are taken before the build, which can drop the replaced image.
snap_line="$(grep -n 'tag_rollback "\$current"' "$here/autodeploy.sh" | cut -d: -f1)"
build_line="$(sed -n '/if ! run_with_heartbeat .* build_images/=' "$here/autodeploy.sh")"
(( snap_line > 0 && snap_line < build_line )) || fail "tag_rollback must run before build_images"

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

# The checkout always lands on exactly the commit being built, even when HEAD
# is already ahead of it (an interrupted deploy left a newer tree checked out).
git -C "$repo" reset -q --hard "$mig"
checkout_target "$code" || fail "checkout_target failed"
[[ "$(git -C "$repo" rev-parse HEAD)" == "$code" ]] || fail "HEAD is not the requested commit"
checkout_target "$mig" && [[ "$(git -C "$repo" rev-parse HEAD)" == "$mig" ]] || fail "forward checkout failed"

# GitHub runs pass only a full commit SHA; anything else is ignored.
[[ "$(SSH_ORIGINAL_COMMAND=0123456789abcdef0123456789abcdef01234567 requested_sha)" == 0123456789abcdef0123456789abcdef01234567 ]] || fail "full SHA rejected"
[[ -z "$(SSH_ORIGINAL_COMMAND='abc123; rm -rf /' requested_sha)" ]] || fail "injected command accepted"
[[ -z "$(SSH_ORIGINAL_COMMAND='bash -i' requested_sha)" ]] || fail "shell request accepted"
[[ "$(SSH_ORIGINAL_COMMAND='redeploy 0123456789abcdef0123456789abcdef01234567' requested_sha)" == 0123456789abcdef0123456789abcdef01234567 ]] || fail "redeploy SHA rejected"
SSH_ORIGINAL_COMMAND='redeploy 0123456789abcdef0123456789abcdef01234567' requested_redeploy || fail "redeploy request rejected"
[[ -z "$(SSH_ORIGINAL_COMMAND='redeploy 0123456789abcdef0123456789abcdef01234567; id' requested_sha)" ]] || fail "injected redeploy accepted"
# Over SSH, a missing or malformed SHA stops before any git, CI, or docker work.
bad="$(mktemp -d)"
rc=0
( ROOT="$bad/none" STATE_DIR="$bad/state" SSH_CONNECTION="1.2.3.4 1 5.6.7.8 22" STRICT=1 SSH_ORIGINAL_COMMAND="" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 ]] || fail "SSH run without a SHA must exit 3 (got $rc)"
rc=0
( ROOT="$bad/none" STATE_DIR="$bad/state" SSH_CONNECTION="1.2.3.4 1 5.6.7.8 22" STRICT=1 SSH_ORIGINAL_COMMAND="id" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 ]] || fail "SSH run with a non-SHA command must exit 3 (got $rc)"
rm -rf "$bad"

# Strict (GitHub) callers see "not deployed" as a failure; the timer retries quietly.
rc=0; ( STRICT=1; not_deployed "x" ) >/dev/null || rc=$?
[[ "$rc" == 3 ]] || fail "strict not_deployed must exit 3 (got $rc)"
( STRICT=""; not_deployed "x" ) >/dev/null || fail "timer not_deployed must exit 0"
# The GitHub key is installed with a forced command and `restrict`.
grep -q 'restrict,command=\\"/var/lib/memecatch-autodeploy/bin/autodeploy.sh\\"' "$here/authorize-github-key.sh" || fail "deploy key must force the agent"

# Exercise the manual path through main: it must build an already-running main
# commit, pass force-recreate, and still refuse stale commits and failed CI.
manual_root="$stub/manual"; mkdir -p "$manual_root/scripts" "$stub/manual-state"
cat >"$manual_root/scripts/deploy-oci.sh" <<'STUB'
#!/usr/bin/env bash
printf 'deploy force=%s\n' "$DEPLOY_OCI_FORCE_RECREATE" >>"$test_calls"
STUB
cat >"$stub/git" <<'STUB'
#!/usr/bin/env bash
shift 2
case "$1" in
  fetch|merge-base) exit 0 ;;
  rev-parse) echo "$test_head" ;;
  status|diff) exit 0 ;;
  *) exit 1 ;;
esac
STUB
chmod +x "$stub/git"
printf '#!/usr/bin/env bash\nexit 0\n' >"$stub/flock"
chmod +x "$stub/flock"
running_sha() { echo "$test_running"; }
ci_state() { echo "$test_ci"; }
new_migrations() { :; }
tag_rollback() { echo snapshot >>"$test_calls"; }
checkout_target() { return 0; }
build_images() { echo build >>"$test_calls"; }
public_release_is() { return 0; }
self_update() { :; }
prune_images() { :; }
test_head=0123456789abcdef0123456789abcdef01234567
test_running="$test_head"; test_ci=success; test_calls="$stub/manual-calls"
export test_head test_running test_ci test_calls
: >"$test_calls"
( PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION='test' SSH_ORIGINAL_COMMAND="redeploy $test_head" main ) >/dev/null || fail "manual redeploy failed"
grep -q '^build$' "$test_calls" || fail "manual redeploy did not build"
grep -q '^deploy force=1$' "$test_calls" || fail "manual redeploy did not request recreation"
: >"$test_calls"
( PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION='test' SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null || fail "automatic no-op failed"
[[ ! -s "$test_calls" ]] || fail "normal request rebuilt current commit"
rc=0; ( PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION='test' SSH_ORIGINAL_COMMAND='redeploy 1111111111111111111111111111111111111111' main ) >/dev/null || rc=$?
[[ "$rc" == 3 ]] || fail "redeploy allowed a non-running commit"
rc=0; ( test_ci=failure; PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION='test' SSH_ORIGINAL_COMMAND="redeploy $test_head" main ) >/dev/null || rc=$?
[[ "$rc" == 3 ]] || fail "redeploy bypassed CI failure"

echo "autodeploy OK"
