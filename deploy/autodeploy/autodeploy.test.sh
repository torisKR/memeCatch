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
trap 'rm -rf "$repo"' EXIT
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

echo "autodeploy OK"
