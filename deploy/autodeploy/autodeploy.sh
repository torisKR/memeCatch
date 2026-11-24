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
# With MEMECATCH_AXUM=1 (docs/axum-migration/PLAN.md) a release is two
# containers: `app` is the Axum server and `next` is the Next app behind it.
# Step 2 then also needs the CI `server` run, step 4 also builds the Axum image
# (after checking that the disk has room for it) and snapshots both containers,
# and the release counts as running only when both run images of the commit.
# Without the flag nothing below differs from a Next-only deploy.
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
KEEP_IMAGES="${AUTODEPLOY_KEEP_IMAGES:-2}"
BUILD_HEARTBEAT_SECONDS=30
# The CI job that tests server/ and builds its image. Required with Axum in front.
SERVER_CHECK_NAME=server
# Free space, in MB, that Docker's data directory must have before the Axum
# image is built. Postgres keeps its data on the same disk, and a full disk
# stops it. Measured (docs/oci-setup.md, "Disk"): a build with nothing cached
# writes 1.7 GB, all of which stays in the build cache, plus its 150 MB image,
# and the Next and worker images of the same run write up to 1.9 GB before it
# starts. That is 3.8 GB, rounded up. A later build reuses the cache and writes
# about 40 MB, but Docker can drop the cache at any time, so every run is held
# to the cold figure.
# AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB replaces it (see server_build_min_free_mb).
SERVER_BUILD_MIN_FREE_MB=4000
# Set to 1 by main when MEMECATCH_AXUM=1; one reading decides the whole run.
AXUM=""

log() { printf '%s memecatch-autodeploy: %s\n' "$(date -u +%FT%TZ)" "$*"; }

# The last value of KEY in an env file, without surrounding quotes. The same
# reading as dotenv_value in scripts/deploy-oci.sh, repeated here because the
# agent runs from outside the checkout and must not depend on a file in it.
dotenv_value() {
  local key="$1" file="$2" value
  [[ -f "$file" ]] || return 0
  value="$(awk -v key="$key" 'index($0, key "=") == 1 { val = substr($0, length(key) + 2) } END { print val }' "$file")"
  value="${value%$'\r'}"
  if [[ ${#value} -ge 2 && "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
    value="${value:1:${#value}-2}"
  elif [[ ${#value} -ge 2 && "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

# A deploy setting, read as scripts/deploy-oci.sh reads MEMECATCH_CADDY: its
# value in the environment ($2) first, then the env file. The env file matters
# here: sshd gives the forced command no variables of the operator's choosing.
setting() {
  local value="$2"
  [[ -n "$value" ]] || value="$(dotenv_value "$1" "${MEMECATCH_ENV_FILE:-$ROOT/.env}")"
  printf '%s' "$value"
}

# Whether this deploy puts Axum in front of Next. Only the value 1 is on.
axum_enabled() {
  [[ "$(setting MEMECATCH_AXUM "${MEMECATCH_AXUM:-}")" == 1 ]]
}

# The free space the Axum build needs, in MB. An override that is not a number
# is ignored, so a typing mistake cannot switch the check off.
server_build_min_free_mb() {
  local value
  value="$(setting AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB "${AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB:-}")"
  [[ "$value" =~ ^[0-9]+$ ]] || value="$SERVER_BUILD_MIN_FREE_MB"
  printf '%s' "$value"
}

# CI state of one check of a commit: success | pending | failure.
# Reads the check-runs JSON on stdin so tests can feed fixtures. The check is
# $1, or the `check` job when no name is given.
ci_state_from_json() {
  jq -r --arg name "${1:-$CHECK_NAME}" '
    [.check_runs[] | select(.name == $name)] | sort_by(.started_at) | last
    | if . == null then "pending"
      elif .status != "completed" then "pending"
      elif .conclusion == "success" then "success"
      else "failure" end'
}

ci_state() {
  local sha="$1" runs name state result=success
  if [[ -z "$AXUM" ]]; then
    curl -fsS --max-time 20 \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${REPO}/commits/${sha}/check-runs?check_name=${CHECK_NAME}" \
      | ci_state_from_json
    return
  fi
  # With Axum in front a red `server` job must stop the deploy too. One request
  # returns the latest run of every check of the commit, so the second name
  # costs nothing against GitHub's unauthenticated rate limit. A failure in
  # either wins over a run that has not finished.
  runs="$(curl -fsS --max-time 20 \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/commits/${sha}/check-runs?per_page=100")" || return 1
  for name in "$CHECK_NAME" "$SERVER_CHECK_NAME"; do
    state="$(ci_state_from_json "$name" <<<"$runs")" || return 1
    case "$state" in
      success) ;;
      failure) echo failure; return 0 ;;
      *) result=pending ;;
    esac
  done
  echo "$result"
}

# Release SHA baked into the running app image at build time, or empty.
# Read the image, not the container: compose also passes RELEASE_SHA from .env,
# and a stale value there would make the container env lie about the release.
# With Axum in front `app` is the Axum image, which carries the SHA the same
# way (Dockerfile.server). `next` is replaced first, so after an interrupted
# deploy `app` still names the older release and the deploy runs again.
running_sha() {
  local image
  image="$(docker inspect memecatch-app-1 --format '{{.Image}}' 2>/dev/null)" || return 0
  docker image inspect "$image" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | sed -n 's/^RELEASE_SHA=//p' | head -1
}

# Bind health and image identity to one container inspection. Missing health
# checks and Docker inspection failures are unverified, never success.
container_healthy_for_sha() {
  local name="$1" expected="$2" container image running health extra sha
  container="$(docker inspect "$name" --format '{{.Image}} {{.State.Running}} {{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null)" || return 1
  read -r image running health extra <<<"$container"
  [[ -n "$image" && "$running" == true && "$health" == healthy && -z "$extra" ]] || return 1
  sha="$(docker image inspect "$image" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^RELEASE_SHA=//p' | head -1)" || return 1
  [[ "$sha" == "$expected" ]]
}

# The release <sha> is what answers: the listener and, with Axum in front, the
# Next app behind it both run an image of that commit and are healthy.
running_app_healthy_for_sha() {
  container_healthy_for_sha memecatch-app-1 "$1" || return 1
  [[ -z "$AXUM" ]] || container_healthy_for_sha memecatch-next-1 "$1"
}

# Added or changed migration files between two commits.
new_migrations() {
  local from="$1" to="$2"
  [[ "$from" =~ ^[0-9a-f]{40}$ && "$to" =~ ^[0-9a-f]{40}$ ]] || return 1
  git -C "$ROOT" cat-file -e "${from}^{commit}" || return 1
  git -C "$ROOT" cat-file -e "${to}^{commit}" || return 1
  git -C "$ROOT" diff --no-renames --name-only --diff-filter=AM "$from" "$to" -- ':(glob)db/migrations/**/*.sql'
}

# Image a compose service currently runs.
service_image() {
  docker inspect "memecatch-$1-1" --format '{{.Config.Image}}' 2>/dev/null
}

# Snapshot name for an image role. Always a local repository, whatever registry
# the running image came from: deploy-oci.sh pulls any ghcr.io/ reference, and a
# snapshot exists only on this VM. The roles are the compose services, except
# that the Next image is always `app` and the Axum image is always `server`
# (see tag_rollback).
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
#
# The record names what each image is, not which service ran it, because the
# `app` service runs either image. The containers decide, not MEMECATCH_AXUM:
# the flag says what this deploy will run, the snapshot says what ran before
# it, and they differ on the deploy that turns the flag on or off.
tag_rollback() {
  local sha="$1" service role image id ref record="$STATE_DIR/rollback-$1.refs"
  : >"$record"
  for service in app next mpe-worker scheduler backup; do
    image="$(service_image "$service")" || continue
    id="$(docker inspect "memecatch-$service-1" --format '{{.Image}}')" || continue
    role="$service"
    if [[ "$service" == app && "$image" == *memecatch-server:* ]]; then
      role=server
    elif [[ "$service" == next ]]; then
      # `next` is the release's Next image only behind Axum. Beside a Next
      # `app` it is the leftover of an interrupted switch.
      grep -q '^server ' "$record" || continue
      role=app
    fi
    ref="$(rollback_ref "$role" "$sha")"
    if docker tag "$id" "$ref" 2>/dev/null; then
      printf '%s %s\n' "$role" "$ref" >>"$record"
    else
      log "warning: cannot snapshot $service ($id is gone); its rollback keeps the new image"
    fi
  done
}

# Image references to redeploy for the snapshot of <sha>, as KEY=VALUE lines.
# The Next, Axum and mpe-worker images come from compose variables; scheduler
# and backup are compose-built under fixed names, so their snapshots are
# retagged. MEMECATCH_AXUM is always set: a rollback restores the containers
# the snapshot was taken from, whatever the flag says now.
rollback_env() {
  local record="$STATE_DIR/rollback-$1.refs" role ref axum=0
  [[ -f "$record" ]] || return 1
  while read -r role ref; do
    case "$role" in
      app) printf 'MEMECATCH_IMAGE=%s\n' "$ref" ;;
      server) axum=1; printf 'MEMECATCH_SERVER_IMAGE=%s\n' "$ref" ;;
      mpe-worker) printf 'MEMECATCH_WORKER_IMAGE=%s\n' "$ref" ;;
      scheduler | backup) docker tag "$ref" "memecatch-$role:local" ;;
    esac
  done <"$record"
  printf 'MEMECATCH_AXUM=%s\n' "$axum"
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

# The Axum image for <sha>, built with the same build args as the Next image
# of the commit (RELEASE_SHA and deploy/build.env, as $2...). Run from the
# checkout. Next fixes its release header, site URL and analytics IDs when it
# is built; Axum reads the same values from its image when it starts, and the
# routes and pages it answers itself must send what Next would.
build_server_image() {
  local sha="$1"
  shift
  nice -n 10 docker build -q -f Dockerfile.server --build-arg "RELEASE_SHA=${sha}" "$@" \
    -t "memecatch-server:release-${sha}" . >/dev/null
}

# Callers run this under `if !`, where bash turns errexit off; chain with && so a
# failed app build can never fall through to a "successful" auxiliary build.
build_images() {
  local sha="$1" args=()
  mapfile -t args < <(build_args "$ROOT/deploy/build.env") || return 1
  ( cd "$ROOT" \
    && nice -n 10 docker build -q -f Dockerfile --build-arg "RELEASE_SHA=${sha}" "${args[@]}" \
      -t "memecatch:release-${sha}" . >/dev/null \
    && { [[ -z "$AXUM" ]] || build_server_image "$sha" "${args[@]}"; } \
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

# A single observation for read-only status; retries belong to the caller.
public_release_once() {
  local sha="$1" seen
  seen="$(curl -fsSI --max-time 15 "$PUBLIC_URL/" 2>/dev/null \
    | tr -d '\r' | awk -F': ' 'tolower($1) == "x-memecatch-release-sha" { print $2 }')" || return 1
  [[ "$seen" == "$sha" ]]
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

# Keep the newest $KEEP_IMAGES release and rollback tags per repository. Two, not
# three: the 2.8 GB worker image times three left the VM under the 4,000 MB the
# Axum build needs (2026-11-24, a deploy refused with 3,900 MB free).
prune_images() {
  local repo kind
  for repo in memecatch memecatch-server memecatch-worker memecatch-scheduler memecatch-backup; do
    for kind in release rollback; do
      docker images --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' "$repo" \
        | grep "|${repo}:${kind}-" | sort -r | tail -n "+$((KEEP_IMAGES + 1))" | cut -d'|' -f2 \
        | xargs -r docker rmi >/dev/null 2>&1 || true
    done
  done
  docker image prune -f >/dev/null 2>&1 || true
}

# Free space, in MB, on the filesystem that holds Docker's data directory.
docker_free_mb() {
  local dir
  dir="$(docker info --format '{{.DockerRootDir}}')" || return 1
  df -Pm "$dir" | awk 'NR == 2 { print $4 }'
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
  [[ "$req" =~ ^status\ [0-9a-f]{40}$ ]] && { printf '%s\n' "${req#status }"; return; }
  [[ "$req" =~ ^redeploy\ [0-9a-f]{40}$ ]] && { printf '%s\n' "${req#redeploy }"; return; }
  [[ "$req" =~ ^[0-9a-f]{40}$ ]] && printf '%s\n' "$req"
  return 0
}

requested_redeploy() {
  [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^redeploy\ [0-9a-f]{40}$ ]]
}

requested_status() {
  [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^status\ [0-9a-f]{40}$ ]]
}

# A marker is written only after the migration gate, deployment and public
# release check succeed. Require all independent evidence; an image alone may
# belong to an interrupted deploy. Call under the deploy lock.
confirmed_deployment() {
  local sha="$1" marker state
  [[ -f "$STATE_DIR/deployed" && ! -e "$STATE_DIR/failed-$sha" ]] || return 1
  marker="$(cat "$STATE_DIR/deployed")" || return 1
  [[ "$marker" == "$sha" ]] || return 1
  running_app_healthy_for_sha "$sha" || return 1
  state="$(ci_state "$sha")" || return 1
  [[ "$state" == success ]] || return 1
  public_release_once "$sha" || return 1
  running_app_healthy_for_sha "$sha"
}

remote_main_is() {
  local sha="$1" head
  head="$(timeout 10s git -C "$ROOT" ls-remote --exit-code origin refs/heads/main | awk '$2 == "refs/heads/main" { print $1 }')" || return 1
  [[ "$head" == "$sha" ]]
}

# Read-only status for reconciling a disconnected SSH call. It cannot deploy or
# create state. A shared lock waits for the original exclusive deploy to finish.
verify_deployment_status() (
  local sha="$1"
  [[ -f "$STATE_DIR/lock" ]] || return 1
  exec 8<"$STATE_DIR/lock" || return 1
  local lock_rc
  flock -s -w 30 -E 4 8 || { lock_rc=$?; [[ "$lock_rc" == 4 ]] && return 4; return 1; }
  remote_main_is "$sha" || return 1
  confirmed_deployment "$sha" || return 1
  # A new main may arrive during the public/CI checks.
  remote_main_is "$sha"
)

main() {
  if axum_enabled; then AXUM=1; fi
  # Over SSH a full commit SHA is mandatory: a missing or malformed request
  # must never fall back to deploying whatever origin/main points at. Checked
  # first, so a bare key probe does no git, CI, or docker work.
  if [[ -n "${SSH_CONNECTION:-}" && -z "$(requested_sha)" ]]; then
    not_deployed "an SSH deploy must name a full commit SHA; got '${SSH_ORIGINAL_COMMAND:-}'"
  fi
  if requested_status; then
    [[ -n "${SSH_CONNECTION:-}" ]] || not_deployed "status requires SSH"
    local status_rc=0
    if verify_deployment_status "$(requested_sha)"; then
      log "verified deployed $(requested_sha)"
      exit 0
    else
      status_rc=$?
    fi
    if [[ "$status_rc" == 4 ]]; then log "deployment status lock busy"; exit 4; fi
    not_deployed "deployment status could not be verified for $(requested_sha)"
  fi
  mkdir -p "$STATE_DIR"
  exec 9>"$STATE_DIR/lock"
  if [[ -n "$STRICT" ]]; then
    flock -w 1800 9 || not_deployed "another deploy held the lock for 30 minutes"
  else
    flock -n 9 || { log "another run is in progress"; exit 0; }
  fi

  git -C "$ROOT" fetch -q origin main
  local target current state migrations req force="" running free_mb min_free_mb
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
    [[ "$req" == "$target" ]] || not_deployed "requested commit is not current origin/main"
    if [[ -z "$force" ]] && git -C "$ROOT" merge-base --is-ancestor "$req" "$current" 2>/dev/null; then
      [[ "$req" == "$target" && "$req" == "$running" ]] || not_deployed "requested commit is not the running origin/main"
      confirmed_deployment "$req" || not_deployed "running commit lacks verified deployment evidence"
      remote_main_is "$req" || not_deployed "origin/main changed during deployment verification"
      log "verified deployed $req"
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

  migrations="$(new_migrations "$current" "$target")" \
    || not_deployed "cannot determine migrations from ${current:0:7} to ${target:0:7}; refusing to deploy"
  if [[ -n "$migrations" && ! -e "$STATE_DIR/allow-$target" ]]; then
    printf '  %s\n' $migrations
    not_deployed "${target:0:7} adds the migrations above; apply them, then touch $STATE_DIR/allow-$target and re-run"
  fi

  if [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]]; then
    log "tracked files changed in $ROOT; refusing to deploy"
    exit 1
  fi

  # The Axum image is built on this disk. Refuse while nothing has changed yet;
  # an unreadable figure is not room.
  if [[ -n "$AXUM" ]]; then
    free_mb="$(docker_free_mb)" || free_mb=""
    min_free_mb="$(server_build_min_free_mb)"
    [[ "$free_mb" =~ ^[0-9]+$ ]] \
      || not_deployed "cannot read the free space of Docker's data directory; not building the Axum image"
    (( free_mb >= min_free_mb )) \
      || not_deployed "Docker's data directory has ${free_mb} MB free and building the Axum image needs ${min_free_mb} MB (AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB); free some, for example with docker builder prune, and re-run. Nothing was changed"
  fi

  if [[ -n "$req" ]]; then
    remote_main_is "$target" || not_deployed "origin/main changed before deployment"
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

  # A build can take minutes. Recheck both the latest main and the latest CI
  # observation, then main once more after that potentially slow CI query.
  local activation_error=""
  if ! remote_main_is "$target"; then
    activation_error="origin/main changed or could not be verified during image build"
  elif ! state="$(ci_state "$target")"; then
    activation_error="CI could not be verified after image build"
  elif [[ "$state" != success ]]; then
    activation_error="CI is $state after image build"
  elif ! remote_main_is "$target"; then
    activation_error="origin/main changed during final CI verification"
  fi
  if [[ -n "$activation_error" ]]; then
    git -C "$ROOT" reset -q --keep "$current" || not_deployed "could not restore checkout after activation gate failed"
    not_deployed "$activation_error; not deploying"
  fi

  # RELEASE_SHA from the shell overrides any stale value in .env. MEMECATCH_AXUM
  # is passed either way, so the script deploys what this run decided and built
  # even if the env file changed since; MEMECATCH_SERVER_IMAGE is read only
  # with the flag on.
  if RELEASE_SHA="$target" MEMECATCH_IMAGE="memecatch:release-${target}" \
    MEMECATCH_AXUM="${AXUM:-0}" MEMECATCH_SERVER_IMAGE="memecatch-server:release-${target}" \
    DEPLOY_OCI_FORCE_RECREATE="$force" bash "$ROOT/scripts/deploy-oci.sh" \
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
