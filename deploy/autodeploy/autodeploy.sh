#!/usr/bin/env bash
# Pull-based deploy agent for the OCI VM. A systemd timer runs it every few minutes.
#
# The VM pulls; nothing pushes into it. GitHub holds no SSH key, host, or token
# for this machine, and port 22 can stay closed to the internet. The repository
# is public, so `git fetch` over https and the check-runs API need no credentials.
#
# One run:
#   1. fetch origin/main; stop if it is already the running release
#   2. stop unless the CI `check` run for that commit succeeded
#   3. stop if the commit adds files under db/migrations/ (apply them by hand,
#      then `touch $STATE_DIR/allow-<sha>`)
#   4. build images on the VM, tag the running ones for rollback, deploy
#   5. confirm the public site (through Cloudflare) reports the new release
#   6. on any failure after step 4, restore the previous images and checkout
#
# Two callers:
#   - GitHub Actions, over SSH through a Cloudflare Tunnel, with a key whose
#     authorized_keys entry forces this script (SSH_ORIGINAL_COMMAND carries the
#     commit to deploy). "Strict": anything that is not a deploy or a no-op
#     exits 3 so the GitHub run fails visibly, and a re-run retries a failed SHA.
#   - an optional systemd timer (deploy/autodeploy/install.sh --with-timer),
#     which quietly retries on the next tick.
#
# The agent runs from $STATE_DIR/bin, outside the checkout. A rollback can reset
# the checkout to a commit that predates this file; the running copy must survive
# that. It replaces itself with the checkout's version only after a good deploy.
set -euo pipefail

REPO="${AUTODEPLOY_REPO:-torisKR/memeCatch}"
ROOT="${AUTODEPLOY_ROOT:-/opt/memecatch}"
STATE_DIR="${AUTODEPLOY_STATE_DIR:-/var/lib/memecatch-autodeploy}"
PUBLIC_URL="${AUTODEPLOY_PUBLIC_URL:-https://catchmeme.com}"
CHECK_NAME="${AUTODEPLOY_CHECK_NAME:-check}"
KEEP_IMAGES="${AUTODEPLOY_KEEP_IMAGES:-3}"
BUILD_HEARTBEAT_SECONDS=30

log() { printf '%s memecatch-autodeploy: %s\n' "$(date -u +%FT%TZ)" "$*"; }

# CI state of a commit: success | pending | failure.
# Reads the check-runs JSON on stdin so tests can feed fixtures.
ci_state_from_json() {
  jq -r --arg name "$CHECK_NAME" '
    [.check_runs[] | select(.name == $name)] | sort_by(.started_at) | last
    | if . == null then "pending"
      elif .status != "completed" then "pending"
      elif .conclusion == "success" then "success"
      else "failure" end'
}

ci_state() {
  local sha="$1"
  curl -fsS --max-time 20 \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/commits/${sha}/check-runs?check_name=${CHECK_NAME}" \
    | ci_state_from_json
}

# Release SHA baked into the running app image at build time, or empty.
# Read the image, not the container: compose also passes RELEASE_SHA from .env,
# and a stale value there would make the container env lie about the release.
running_sha() {
  local image
  image="$(docker inspect memecatch-app-1 --format '{{.Image}}' 2>/dev/null)" || return 0
  docker image inspect "$image" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | sed -n 's/^RELEASE_SHA=//p' | head -1
}

# Added or changed migration files between two commits.
new_migrations() {
  local from="$1" to="$2"
  git -C "$ROOT" diff --name-only --diff-filter=AM "$from" "$to" -- db/migrations/ | grep '\.sql$' || true
}

# Image a compose service currently runs.
service_image() {
  docker inspect "memecatch-$1-1" --format '{{.Config.Image}}' 2>/dev/null
}

# Snapshot name for a service. Always a local repository, whatever registry the
# running image came from: deploy-oci.sh pulls any ghcr.io/ reference, and a
# snapshot exists only on this VM.
rollback_ref() {
  local service="$1" sha="$2"
  case "$service" in
    app) printf 'memecatch:rollback-%s\n' "$sha" ;;
    *) printf 'memecatch-%s:rollback-%s\n' "${service#mpe-}" "$sha" ;;
  esac
}

# Snapshot every running service before a deploy and record exactly what was
# saved. Restore reads this record; it never re-derives names from containers
# that the failed deploy has already replaced.
#
# Call this before building: compose rebuilds reuse names like
# memecatch-worker:local, and the image they replace can disappear once it loses
# its last tag. A service whose image is already gone is skipped with a warning
# (a rollback then leaves that service on the new image).
tag_rollback() {
  local sha="$1" service image id ref record="$STATE_DIR/rollback-$1.refs"
  : >"$record"
  for service in app mpe-worker scheduler backup; do
    image="$(service_image "$service")" || continue
    id="$(docker inspect "memecatch-$service-1" --format '{{.Image}}')" || continue
    ref="$(rollback_ref "$service" "$sha")"
    if docker tag "$id" "$ref" 2>/dev/null; then
      printf '%s %s\n' "$service" "$ref" >>"$record"
    else
      log "warning: cannot snapshot $service ($id is gone); its rollback keeps the new image"
    fi
  done
}

# Image references to redeploy for the snapshot of <sha>, as KEY=VALUE lines.
# app and mpe-worker take their image from compose variables; scheduler and
# backup are compose-built under fixed names, so their snapshots are retagged.
rollback_env() {
  local record="$STATE_DIR/rollback-$1.refs" service ref
  [[ -f "$record" ]] || return 1
  while read -r service ref; do
    case "$service" in
      app) printf 'MEMECATCH_IMAGE=%s\n' "$ref" ;;
      mpe-worker) printf 'MEMECATCH_WORKER_IMAGE=%s\n' "$ref" ;;
      scheduler | backup) docker tag "$ref" "memecatch-$service:local" ;;
    esac
  done <"$record"
}

restore_rollback() {
  local sha="$1" env=()
  mapfile -t env < <(rollback_env "$sha") || true
  git -C "$ROOT" reset -q --keep "$sha"
  env RELEASE_SHA="$sha" "${env[@]}" bash "$ROOT/scripts/deploy-oci.sh"
}

# --build-arg list from deploy/build.env (public values only).
build_args() {
  local file="$1" key value
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    printf -- '--build-arg\n%s=%s\n' "$key" "$value"
  done <"$file"
}

# Callers run this under `if !`, where bash turns errexit off; chain with && so a
# failed app build can never fall through to a "successful" auxiliary build.
build_images() {
  local sha="$1" args=()
  mapfile -t args < <(build_args "$ROOT/deploy/build.env") || return 1
  ( cd "$ROOT" \
    && nice -n 10 docker build -q -f Dockerfile --build-arg "RELEASE_SHA=${sha}" "${args[@]}" \
      -t "memecatch:release-${sha}" . >/dev/null \
    && nice -n 10 docker compose -p memecatch -f docker-compose.yml build -q mpe-worker scheduler backup )
}

# Quiet Docker builds can leave the SSH channel without application output for
# several minutes. Emit progress in addition to the client's SSH keepalives and
# preserve the wrapped command's status. Cleanup covers normal wrapper exit and
# startup failures. It deliberately does not change or guarantee the wrapped
# build's pre-existing behavior when an ancestor disappears or signals arrive
# while the foreground build is running.
run_with_heartbeat() (
  local label="$1" heartbeat_pid=""
  shift

  # Invoked directly and through finish_heartbeat's EXIT trap.
  # shellcheck disable=SC2329
  cleanup_heartbeat() {
    local pid="$heartbeat_pid"
    if [[ -z "$pid" ]]; then
      pid="$(jobs -pr | head -1)" || true
    fi
    [[ -n "$pid" ]] || return 0
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    heartbeat_pid=""
  }

  # Invoked by the EXIT trap below.
  # shellcheck disable=SC2329
  finish_heartbeat() {
    local status=$?
    trap - EXIT
    cleanup_heartbeat
    exit "$status"
  }

  # Install before spawning so a signal between `&` and `$!` cannot bypass
  # cleanup or expand an unset heartbeat_pid under `set -u`.
  trap finish_heartbeat EXIT
  (
    local sleeper=""

    # Invoked by the TERM/INT trap below.
    # shellcheck disable=SC2329
    cleanup_sleeper() {
      local pid="$sleeper"
      if [[ -z "$pid" ]]; then
        pid="$(jobs -pr | head -1)" || true
      fi
      [[ -n "$pid" ]] || return 0
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      sleeper=""
    }

    trap 'cleanup_sleeper; exit 0' TERM INT
    # The logger does not participate in deploy exclusion. If its parent exits,
    # it must not independently keep main's flock open via inherited fd 9.
    exec 9>&-
    while true; do
      sleep "$BUILD_HEARTBEAT_SECONDS" &
      sleeper=$!
      wait "$sleeper" || exit 0
      sleeper=""
      log "$label still running"
    done
  ) &
  heartbeat_pid=$!
  "$@"
)

public_release_is() {
  local sha="$1" seen
  for _ in $(seq 1 20); do
    seen="$(curl -fsSI --max-time 15 "$PUBLIC_URL/" 2>/dev/null \
      | tr -d '\r' | awk -F': ' 'tolower($1) == "x-memecatch-release-sha" { print $2 }')"
    [[ "$seen" == "$sha" ]] && return 0
    sleep 6
  done
  return 1
}

# Install the checkout's agent as the running copy (atomic rename).
self_update() {
  local src="$ROOT/deploy/autodeploy/autodeploy.sh" dest="$STATE_DIR/bin/autodeploy.sh"
  [[ -f "$src" ]] || return 0
  mkdir -p "$STATE_DIR/bin"
  cmp -s "$src" "$dest" 2>/dev/null && return 0
  cp "$src" "$dest.new" && chmod 755 "$dest.new" && mv -f "$dest.new" "$dest"
  log "agent updated from ${src}"
}

# Keep the newest $KEEP_IMAGES release and rollback tags per repository.
prune_images() {
  local repo kind
  for repo in memecatch memecatch-worker memecatch-scheduler memecatch-backup; do
    for kind in release rollback; do
      docker images --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' "$repo" \
        | grep "|${repo}:${kind}-" | sort -r | tail -n "+$((KEEP_IMAGES + 1))" | cut -d'|' -f2 \
        | xargs -r docker rmi >/dev/null 2>&1 || true
    done
  done
  docker image prune -f >/dev/null 2>&1 || true
}

STRICT=""
[[ -n "${SSH_CONNECTION:-}" || -n "${AUTODEPLOY_STRICT:-}" ]] && STRICT=1

# Stop without deploying: a failure for a GitHub run, a quiet retry for the timer.
not_deployed() {
  log "$1"
  if [[ -n "$STRICT" ]]; then exit 3; fi
  exit 0
}

# The commit a GitHub run asked for, or empty. Only a full SHA is accepted.
requested_sha() {
  local req="${SSH_ORIGINAL_COMMAND:-}"
  [[ "$req" =~ ^redeploy\ [0-9a-f]{40}$ ]] && { printf '%s\n' "${req#redeploy }"; return; }
  [[ "$req" =~ ^[0-9a-f]{40}$ ]] && printf '%s\n' "$req"
  return 0
}

requested_redeploy() {
  [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^redeploy\ [0-9a-f]{40}$ ]]
}

main() {
  # Over SSH a full commit SHA is mandatory: a missing or malformed request
  # must never fall back to deploying whatever origin/main points at. Checked
  # first, so a bare key probe does no git, CI, or docker work.
  if [[ -n "${SSH_CONNECTION:-}" && -z "$(requested_sha)" ]]; then
    not_deployed "an SSH deploy must name a full commit SHA; got '${SSH_ORIGINAL_COMMAND:-}'"
  fi
  mkdir -p "$STATE_DIR"
  exec 9>"$STATE_DIR/lock"
  if [[ -n "$STRICT" ]]; then
    flock -w 1800 9 || not_deployed "another deploy held the lock for 30 minutes"
  else
    flock -n 9 || { log "another run is in progress"; exit 0; }
  fi

  git -C "$ROOT" fetch -q origin main
  local target current state migrations req force="" running
  target="$(git -C "$ROOT" rev-parse origin/main)"
  running="$(running_sha)"
  current="$running"
  [[ -n "$current" ]] || current="$(git -C "$ROOT" rev-parse HEAD)"

  req="$(requested_sha)"
  if requested_redeploy; then
    [[ -n "${SSH_CONNECTION:-}" ]] || not_deployed "redeploy requires SSH"
    [[ -n "$running" && "$req" == "$target" && "$req" == "$running" ]] || not_deployed "redeploy requires the running origin/main commit"
    force=1
  fi
  if [[ -n "$req" ]]; then
    git -C "$ROOT" merge-base --is-ancestor "$req" "$target" 2>/dev/null \
      || not_deployed "${req:0:7} is not on origin/main; refusing"
    if [[ -z "$force" ]] && git -C "$ROOT" merge-base --is-ancestor "$req" "$current" 2>/dev/null; then
      log "running ${current:0:7} already includes ${req:0:7}"
      exit 0
    fi
    target="$req"
  fi

  if [[ "$target" == "$current" && -z "$force" ]]; then
    [[ -n "$STRICT" ]] && log "${target:0:7} is already running"
    exit 0
  fi
  if [[ -e "$STATE_DIR/failed-$target" ]]; then
    [[ -n "$STRICT" ]] || exit 0
    log "retrying ${target:0:7}, which failed before"
    rm -f "$STATE_DIR/failed-$target"
  fi

  state="$(ci_state "$target" || echo pending)"
  case "$state" in
    success) ;;
    failure) touch "$STATE_DIR/failed-$target"; not_deployed "CI failed on ${target:0:7}; not deploying" ;;
    *) not_deployed "CI has not passed on ${target:0:7} yet" ;;
  esac

  migrations="$(new_migrations "$current" "$target")"
  if [[ -n "$migrations" && ! -e "$STATE_DIR/allow-$target" ]]; then
    printf '  %s\n' $migrations
    not_deployed "${target:0:7} adds the migrations above; apply them, then touch $STATE_DIR/allow-$target and re-run"
  fi

  if [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]]; then
    log "tracked files changed in $ROOT; refusing to deploy"
    exit 1
  fi

  log "deploying ${target:0:7} (running ${current:0:7})"
  # Snapshot before building; see tag_rollback.
  tag_rollback "$current"
  checkout_target "$target" || not_deployed "could not check out ${target:0:7} in $ROOT"
  if ! run_with_heartbeat "building images for ${target:0:7}" build_images "$target"; then
    log "build failed for ${target:0:7}; keeping ${current:0:7}"
    git -C "$ROOT" reset -q --keep "$current"
    touch "$STATE_DIR/failed-$target"
    exit 1
  fi

  # RELEASE_SHA from the shell overrides any stale value in .env.
  if RELEASE_SHA="$target" MEMECATCH_IMAGE="memecatch:release-${target}" DEPLOY_OCI_FORCE_RECREATE="$force" bash "$ROOT/scripts/deploy-oci.sh" \
    && public_release_is "$target"; then
    printf '%s\n' "$target" >"$STATE_DIR/deployed"
    log "deployed ${target:0:7}"
    self_update
    prune_images
    exit 0
  fi

  log "deploy of ${target:0:7} failed; rolling back to ${current:0:7}"
  touch "$STATE_DIR/failed-$target"
  restore_rollback "$current"
  exit 1
}

# Point the checkout at exactly <sha>. `merge --ff-only` is a no-op when <sha>
# is already behind HEAD (e.g. after an interrupted deploy), which would build
# a newer tree under an older label; reset --keep moves HEAD either way and
# refuses if it would clobber local edits.
checkout_target() {
  local sha="$1"
  git -C "$ROOT" reset -q --keep "$sha" || return 1
  [[ "$(git -C "$ROOT" rev-parse HEAD)" == "$sha" ]]
}

# Run when executed; only define functions when sourced (the test sources it).
(return 0 2>/dev/null) || main "$@"
