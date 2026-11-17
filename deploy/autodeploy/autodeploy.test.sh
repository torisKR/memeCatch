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
mkdir -p "$repo/db/migrations/nested"
echo 'select 2;' >"$repo/db/migrations/nested/new.sql"
echo ignored >"$repo/db/migrations/nested/readme.txt"
nested="$(commit nested)"
[[ "$(new_migrations "$mig" "$nested")" == db/migrations/nested/new.sql ]] || fail "nested migration not detected"
echo 'select 3;' >>"$repo/db/migrations/20990101000000_x.sql"
changed="$(commit changed)"
[[ "$(new_migrations "$nested" "$changed")" == db/migrations/20990101000000_x.sql ]] || fail "changed migration not detected"
# Real Git detects the move as R with similarity, which --diff-filter=AM alone
# drops. Both pure renames and renames with content changes need approval.
for n in $(seq 1 100); do printf 'select %s;\n' "$n"; done >"$repo/db/migrations/old.sql"
rename_base="$(commit rename_base)"
git -C "$repo" mv db/migrations/old.sql db/migrations/renamed.sql
echo 'select 101;' >>"$repo/db/migrations/renamed.sql"
rename_changed="$(commit rename_changed)"
git -C "$repo" diff --find-renames --name-status "$rename_base" "$rename_changed" -- db/migrations/ | grep -q '^R[0-9]' || fail "rename fixture was not detected by real git"
[[ "$(new_migrations "$rename_base" "$rename_changed")" == db/migrations/renamed.sql ]] || fail "renamed and changed migration was missed"
git -C "$repo" mv db/migrations/renamed.sql db/migrations/pure-rename.sql
rename_pure="$(commit rename_pure)"
[[ "$(new_migrations "$rename_changed" "$rename_pure")" == db/migrations/pure-rename.sql ]] || fail "renamed migration was missed"
missing_sha=1111111111111111111111111111111111111111
if new_migrations "$missing_sha" "$mig" >/dev/null 2>&1; then fail "missing running commit was accepted"; fi
if new_migrations "$mig" "$missing_sha" >/dev/null 2>&1; then fail "missing target commit was accepted"; fi
if new_migrations invalid "$mig" >/dev/null 2>&1; then fail "invalid running SHA was accepted"; fi
# A valid commit object with an unavailable tree makes the real git diff fail.
broken_tree_commit="$(printf 'tree 2222222222222222222222222222222222222222\nauthor t <t@t> 1 +0000\ncommitter t <t@t> 1 +0000\n\nbroken tree\n' | git -C "$repo" hash-object -t commit -w --stdin)"
git -C "$repo" cat-file -e "${broken_tree_commit}^{commit}" || fail "broken tree fixture is not a commit"
if new_migrations "$broken_tree_commit" "$mig" >/dev/null 2>&1; then fail "git diff failure was accepted"; fi
real_new_migrations="$(declare -f new_migrations)"
test_real_git="$(command -v git)"
export test_real_git

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
  fetch) exit 0 ;;
  merge-base) [[ "$4" == "$test_running" && "$3" != "$test_running" ]] && exit 1; exit 0 ;;
  ls-remote)
    if [[ -n "${test_remote_flip_after:-}" ]]; then
      count=0; [[ -f "$test_remote_flip_after" ]] && count="$(cat "$test_remote_flip_after")"
      count=$((count + 1)); printf '%s\n' "$count" >"$test_remote_flip_after"
      if (( count >= 3 )); then printf '%s\trefs/heads/main\n' 1111111111111111111111111111111111111111; else printf '%s\trefs/heads/main\n' "$test_head"; fi
    elif [[ -n "${test_remote_sequence:-}" ]]; then
      if [[ -f "$test_remote_sequence" ]]; then echo -e "1111111111111111111111111111111111111111\trefs/heads/main"; else : >"$test_remote_sequence"; printf '%s\trefs/heads/main\n' "$test_head"; fi
    else
      printf '%s\trefs/heads/main\n' "${test_remote_head:-$test_head}"
    fi ;;

  rev-parse) echo "$test_head" ;;
  cat-file|diff)
    if [[ "${test_real_diff:-}" == 1 ]]; then exec "$test_real_git" -C "$test_real_git_root" "$@"; fi
    exit 0 ;;
  reset) echo reset >>"$test_calls"; exit 0 ;;
  status) exit 0 ;;
  *) exit 1 ;;
esac
STUB
chmod +x "$stub/git"
# Exercise the real health verifier through a controlled Docker CLI, not a
# mocked verifier. The image SHA and the state come from the inspected app.
cat >"$stub/docker" <<'STUB'
#!/usr/bin/env bash
case "$1 $2" in
  "inspect memecatch-app-1")
    [[ "${test_inspect_error:-0}" != 1 ]] || exit 1
    running="${test_container_running:-true}"
    if [[ -n "${test_stop_on_public:-}" && -f "$test_stop_on_public" ]]; then running=false; fi
    printf '%s %s %s\n' sha256:app "$running" "${test_container_health:-healthy}" ;;
  "image inspect")
    [[ "${test_image_error:-0}" != 1 && "${3:-}" == sha256:app ]] || exit 1
    printf 'RELEASE_SHA=%s\n' "$test_running" ;;
  *) exit 1 ;;
esac
STUB
chmod +x "$stub/docker"
printf '#!/usr/bin/env bash\nexit 0\n' >"$stub/flock"
chmod +x "$stub/flock"
running_sha() { echo "$test_running"; }
ci_state() {
  if [[ -n "${test_ci_transition:-}" && -f "$test_ci_transition" ]]; then
    [[ "$test_ci_after" != error ]] || return 1
    echo "$test_ci_after"
  else
    echo "$test_ci"
  fi
}
new_migrations() { printf '%s' "${test_migrations:-}"; }
tag_rollback() { echo snapshot >>"$test_calls"; }
checkout_target() { return 0; }
build_images() {
  echo build >>"$test_calls"
  if [[ -n "${test_ci_transition:-}" ]]; then : >"$test_ci_transition"; fi
  return 0
}
public_release_is() { return 0; }
public_release_once() {
  if [[ -n "${test_stop_on_public:-}" ]]; then : >"$test_stop_on_public"; fi
  [[ "${test_public:-ok}" == ok ]]
}
self_update() { :; }
prune_images() { :; }
test_head=0123456789abcdef0123456789abcdef01234567
test_running="$test_head"; test_ci=success; test_calls="$stub/manual-calls"
export test_head test_running test_ci test_calls
printf '%s\n' "$test_head" >"$stub/manual-state/deployed"
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


# Status is read-only and only confirms the exact running main with completed
# CI, a success marker, the running image and a matching public observation.
[[ "$(SSH_ORIGINAL_COMMAND="status $test_head" requested_sha)" == "$test_head" ]] || fail "status SHA rejected"
SSH_ORIGINAL_COMMAND="status $test_head" requested_status || fail "status request not recognized"
[[ -z "$(SSH_ORIGINAL_COMMAND="status $test_head; id" requested_sha)" ]] || fail "injected status accepted"
rm -f "$stub/manual-state/failed-$test_head"
: >"$stub/manual-state/lock"
: >"$test_calls"
( PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="status $test_head" main ) >/dev/null || fail "verified status rejected"
[[ ! -s "$test_calls" ]] || fail "status executed a deployment"
for status_case in missing_marker wrong_marker wrong_image stopped unhealthy starting missing_health inspect_error image_error failed_ci missing_ci failed_marker bad_public stale_main; do
  printf '%s\n' "$test_head" >"$stub/manual-state/deployed"
  rm -f "$stub/manual-state/failed-$test_head"
  rc=0
  case "$status_case" in
    missing_marker) rm "$stub/manual-state/deployed" ;;
    wrong_marker) printf '%040d\n' 1 >"$stub/manual-state/deployed" ;;
    failed_marker) : >"$stub/manual-state/failed-$test_head" ;;
  esac
  ( case "$status_case" in
      wrong_image) test_running=1111111111111111111111111111111111111111 ;;
      stopped) export test_container_running=false ;;
      unhealthy) export test_container_health=unhealthy ;;
      starting) export test_container_health=starting ;;
      missing_health) export test_container_health=missing ;;
      inspect_error) export test_inspect_error=1 ;;
      image_error) export test_image_error=1 ;;
      failed_ci) test_ci=failure ;;
      missing_ci) test_ci=pending ;;
      bad_public) test_public=bad ;;
      stale_main) export test_remote_head=1111111111111111111111111111111111111111 ;;
    esac
    PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="status $test_head" main
  ) >/dev/null 2>&1 || rc=$?
  [[ "$rc" == 3 ]] || fail "status $status_case accepted or returned $rc"
  [[ ! -s "$test_calls" ]] || fail "status $status_case attempted deployment"
done
# An app stopping while the public header is checked must not be confirmed.
rm -f "$stub/stopped-during-public"
rc=0
( export test_stop_on_public="$stub/stopped-during-public"; PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="status $test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && -e "$stub/stopped-during-public" ]] || fail "status accepted app stopped during public check"
# The same-SHA no-op must not report success for a stopped or unhealthy app.
rc=0
( export test_container_running=false; PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "same-SHA no-op accepted stopped app"
for test_container_health in unhealthy missing; do
  rc=0
  ( export test_container_health; PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
  [[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "same-SHA no-op accepted $test_container_health app"
done
rm -f "$stub/manual-state/failed-$test_head"
printf '%s\n' "$test_head" >"$stub/manual-state/deployed"
# A fresh main must be checked again after all other evidence.
rc=0
( export test_remote_sequence="$stub/remote-sequence"; PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="status $test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 ]] || fail "status accepted a main change during verification"

# Exercise an actual advisory lock with Python's flock. This runs on macOS too;
# the temporary flock command only substitutes the CLI missing there.
mkdir -p "$stub/real-lock"
cat >"$stub/real-lock/flock" <<'STUB'
#!/usr/bin/env python3
import fcntl, sys
try:
    fcntl.flock(int(sys.argv[-1]), fcntl.LOCK_SH | fcntl.LOCK_NB)
except BlockingIOError:
    sys.exit(1)
STUB
chmod +x "$stub/real-lock/flock"
python3 -c 'import fcntl,sys,time; f=open(sys.argv[1],"r"); fcntl.flock(f,fcntl.LOCK_EX); open(sys.argv[2],"w").close(); time.sleep(20)' "$stub/manual-state/lock" "$stub/lock-ready" &
lock_holder=$!
for _ in $(seq 1 100); do [[ -e "$stub/lock-ready" ]] && break; sleep 0.02; done
if [[ ! -e "$stub/lock-ready" ]]; then kill "$lock_holder" 2>/dev/null || true; wait "$lock_holder" 2>/dev/null || true; fail "lock holder did not start"; fi
rc=0
( PATH="$stub/real-lock:$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="status $test_head" main ) >/dev/null 2>&1 || rc=$?
kill "$lock_holder" 2>/dev/null || true
wait "$lock_holder" 2>/dev/null || true
[[ "$rc" == 3 ]] || fail "status ignored the live deploy lock"
( PATH="$stub/real-lock:$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="status $test_head" main ) >/dev/null || fail "status failed after deploy lock released"
rm "$stub/manual-state/lock"
rc=0
( PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="status $test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -e "$stub/manual-state/lock" ]] || fail "status without a lock must fail without creating state"

# An automatic same-SHA no-op is not success without the same evidence.
rm "$stub/manual-state/deployed"
rc=0
( PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 ]] || fail "same-SHA no-op accepted without marker"
[[ ! -s "$test_calls" ]] || fail "unverified no-op executed deployment"
printf '%s\n' "$test_head" >"$stub/manual-state/deployed"

# An older request must not be deployed after main advances.
rc=0
( test_running=1111111111111111111111111111111111111111 PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND=2222222222222222222222222222222222222222 main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "stale SHA was allowed to deploy"

# A real new SHA must still go through the CI and migration approval gates.
old_sha=1111111111111111111111111111111111111111
rc=0
( test_running="$old_sha" test_ci=failure PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "new SHA bypassed the CI gate"
rm -f "$stub/manual-state/failed-$test_head"
rc=0
( test_running="$old_sha" test_migrations='db/migrations/new.sql' PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "new SHA bypassed the migration gate"
: >"$stub/manual-state/allow-$test_head"
( test_running="$old_sha" test_migrations='db/migrations/new.sql' PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null || fail "approved migration did not deploy"
grep -q '^deploy ' "$test_calls" || fail "approved migration did not activate"
rm "$stub/manual-state/allow-$test_head"
: >"$test_calls"

# Real Git rename detection must reach and block the actual deployment gate.
rc=0
( eval "$real_new_migrations"; export test_real_diff=1 test_real_git_root="$repo"; test_head="$rename_changed" test_running="$rename_base" PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$rename_changed" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "renamed and changed migration bypassed deployment gate"

# A real git object failure must fail closed even with migration approval present.
: >"$stub/manual-state/allow-$mig"
rc=0
( eval "$real_new_migrations"; export test_real_diff=1 test_real_git_root="$repo"; test_head="$mig" test_running="$missing_sha" PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$mig" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "missing running commit bypassed migration gate"
rc=0
( eval "$real_new_migrations"; export test_real_diff=1 test_real_git_root="$repo"; test_head="$mig" test_running="$broken_tree_commit" PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$mig" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 && ! -s "$test_calls" ]] || fail "git diff error bypassed migration gate"
rm "$stub/manual-state/allow-$mig"

# A CI rerun can fail, become pending, or be unreachable during image build.
for test_ci_after in failure pending error; do
  rm -f "$stub/ci-during-build"
  : >"$test_calls"
  rc=0
  ( export test_ci_transition="$stub/ci-during-build" test_ci_after; test_running="$old_sha" PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
  [[ "$rc" == 3 ]] || fail "CI $test_ci_after after build was accepted"
  grep -q '^build$' "$test_calls" || fail "CI $test_ci_after test did not reach build"
  grep -q '^reset$' "$test_calls" || fail "CI $test_ci_after did not restore checkout"
  ! grep -q '^deploy ' "$test_calls" || fail "CI $test_ci_after activated image"
done
rm -f "$stub/ci-during-build"
: >"$test_calls"
( export test_ci_transition="$stub/ci-during-build" test_ci_after=failure; test_running="$old_sha" PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT='' SSH_CONNECTION='' SSH_ORIGINAL_COMMAND='' main ) >/dev/null 2>&1 || fail "timer did not defer failed CI"
grep -q '^build$' "$test_calls" || fail "timer CI test did not reach build"
! grep -q '^deploy ' "$test_calls" || fail "timer activated image after CI failure"
: >"$test_calls"

# The target can cease to be main during a long build. It must not be activated.
rm -f "$stub/remote-during-build"
: >"$test_calls"
rc=0
( export test_remote_sequence="$stub/remote-during-build"; test_running="$old_sha" PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 ]] || fail "stale target was accepted after build"
grep -q '^build$' "$test_calls" || fail "main-change test did not reach build"
! grep -q '^deploy ' "$test_calls" || fail "stale image was activated after main changed"
: >"$test_calls"
# Also reject main advancing while the final CI request is in flight.
rm -f "$stub/remote-during-ci"
rc=0
( export test_remote_flip_after="$stub/remote-during-ci"; test_running="$old_sha" PATH="$stub:$PATH" ROOT="$manual_root" STATE_DIR="$stub/manual-state" STRICT=1 SSH_CONNECTION=test SSH_ORIGINAL_COMMAND="$test_head" main ) >/dev/null 2>&1 || rc=$?
[[ "$rc" == 3 ]] || fail "main change during final CI verification was accepted"
grep -q '^build$' "$test_calls" || fail "final main check did not reach build"
! grep -q '^deploy ' "$test_calls" || fail "main change during final CI verification activated image"
: >"$test_calls"

# Test the actual caller with a fake SSH transport. Only exit 255 starts
# read-only status retries; no test may issue the deploy command twice.
cat >"$stub/ssh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "${@: -1}" >>"$ssh_calls"
number=0; [[ -f "$ssh_count" ]] && number="$(cat "$ssh_count")"
number=$((number + 1)); printf '%s\n' "$number" >"$ssh_count"
IFS=, read -ra responses <<<"$ssh_results"
rc="${responses[number - 1]:-3}"
if (( number > 1 )) && [[ "$rc" == 0 && "${ssh_silent:-0}" != 1 ]]; then
  printf '2026-11-17T17:46:40Z memecatch-autodeploy: verified deployed %s\n' "${ssh_evidence_sha:-$GITHUB_SHA}"
fi
exit "$rc"
STUB
cat >"$stub/timeout" <<'STUB'
#!/usr/bin/env bash
shift; exec "$@"
STUB
cat >"$stub/sleep" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "$stub/ssh" "$stub/timeout" "$stub/sleep"
ssh_calls="$stub/ssh-calls"; ssh_count="$stub/ssh-count"
export ssh_calls ssh_count
for scenario in direct_success direct_success_unverified disconnect_then_success disconnect_then_retry nontransport_failure never_confirmed silent_status wrong_evidence; do
  : >"$ssh_calls"; rm -f "$ssh_count"; ssh_silent=0; ssh_evidence_sha="$test_head"
  case "$scenario" in
    direct_success) ssh_results=0,0; expected_rc=0; expected_calls=2 ;;
    direct_success_unverified) ssh_results=0,3,3,3,3,3,3,3,3; expected_rc=1; expected_calls=9 ;;
    disconnect_then_success) ssh_results=255,0; expected_rc=0; expected_calls=2 ;;
    disconnect_then_retry) ssh_results=255,255,124,0; expected_rc=0; expected_calls=4 ;;
    nontransport_failure) ssh_results=3; expected_rc=3; expected_calls=1 ;;
    never_confirmed) ssh_results=255,3,3,3,3,3,3,3,3; expected_rc=1; expected_calls=9 ;;
    silent_status) ssh_results=255,0,0,0,0,0,0,0,0; ssh_silent=1; expected_rc=1; expected_calls=9 ;;
    wrong_evidence) ssh_results=255,0,0,0,0,0,0,0,0; ssh_evidence_sha=1111111111111111111111111111111111111111; expected_rc=1; expected_calls=9 ;;
  esac
  export ssh_results ssh_silent ssh_evidence_sha
  rc=0
  ( PATH="$stub:$PATH" RUNNER_TEMP="$stub" DEPLOY_HOST=example.invalid GITHUB_SHA="$test_head" bash "$here/run-ssh-deploy.sh" ) >/dev/null 2>&1 || rc=$?
  [[ "$rc" == "$expected_rc" ]] || fail "$scenario returned $rc instead of $expected_rc"
  [[ "$(wc -l <"$ssh_calls" | tr -d ' ')" == "$expected_calls" ]] || fail "$scenario called SSH unexpectedly"
  [[ "$(head -1 "$ssh_calls")" == "$test_head" ]] || fail "$scenario did not deploy the intended SHA"
  [[ "$(grep -c "^$test_head$" "$ssh_calls")" == 1 ]] || fail "$scenario repeated a deployment"
  if (( expected_calls > 1 )); then
    [[ "$(grep -c "^status $test_head$" "$ssh_calls")" == "$((expected_calls - 1))" ]] || fail "$scenario sent a non-status retry"
  fi
done

echo "autodeploy OK"
