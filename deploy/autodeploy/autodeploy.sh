#!/usr/bin/env bash
# Pull-based deploy agent for the OCI VM. A systemd timer runs it every few minutes.
#
# The VM pulls; nothing pushes into it. GitHub holds no SSH key, host, or token
# for this machine, and port 22 can stay closed to the internet. The repository
# is public, so `git fetch` over https and the check-runs API need no credentials.
#
# One run:
#   1. fetch origin/main; stop if it is already the running release
#   2. stop unless the CI `check` and `server` runs for that commit succeeded
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
# A release is the server (`app`, Dockerfile.server) with the mpe-worker,
# scheduler and backup images. Step 2 needs the CI `check` and `server` runs,
# and step 4 first checks that the disk has room for the server build.
# After the deploy a few read-only routes are asked once and their status and
# headers logged (log_routes).
#
# The release before the cutover ran the Next app as `next` behind the server
# (MEMECATCH_AXUM/MEMECATCH_NEXT). This agent no longer reads those flags;
# docs/oci-setup.md, "Cutover", says how that release is rolled back to.
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
# The CI job that tests server/ and builds its image.
SERVER_CHECK_NAME=server
# Free space, in MB, that Docker's data directory must have before the images
# are built. Postgres keeps its data on the same disk, and a full disk stops
# it. Measured (docs/oci-setup.md, "Disk"): a server build with nothing cached
# writes 1.7 GB, all of which stays in the build cache, plus its image, and
# the worker image of the same run writes up to 1.9 GB more. That is 3.8 GB,
# rounded up. A later build reuses the cache and writes about 40 MB, but
# Docker can drop the cache at any time, so every run is held to the cold
# figure.
# AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB replaces it (see server_build_min_free_mb).
SERVER_BUILD_MIN_FREE_MB=4000
# Read-only requests asked after a deploy, with no session, that write
# nothing; their status and these headers are logged.
NATIVE_COMPARE_PATHS=(/api/health /robots.txt /llms.txt /feed.xml /sitemap.xml /manifest.webmanifest /api/daily-quiz /api/media/signed)
NATIVE_COMPARE_HEADERS=(content-type cache-control content-language x-memecatch-release-sha strict-transport-security x-content-type-options x-frame-options)

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

# The free space the build needs, in MB. An override that is not a number
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

# The CI jobs a deploy needs: those that check what it ships. `check` (the
# TypeScript checks, the worker and backup images) and `server`.
required_checks() {
  printf '%s\n' "$CHECK_NAME" "$SERVER_CHECK_NAME"
}

ci_state() {
  local sha="$1" runs name state result=success
  # One request returns the latest run of every check of the commit, so each
  # name costs nothing against GitHub's unauthenticated rate limit. A failure
  # in any wins over a run that has not finished.
  runs="$(curl -fsS --max-time 20 \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/commits/${sha}/check-runs?per_page=100")" || return 1
  while read -r name; do
    state="$(ci_state_from_json "$name" <<<"$runs")" || return 1
    case "$state" in
      success) ;;
      failure) echo failure; return 0 ;;
      *) result=pending ;;
    esac
  done < <(required_checks)
  echo "$result"
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

# The release <sha> is what answers: `app` runs an image of that commit and is
# healthy.
running_app_healthy_for_sha() {
  container_healthy_for_sha memecatch-app-1 "$1"
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
# that the server image (service `app`) is `server` (see tag_rollback).
rollback_ref() {
  local service="$1" sha="$2"
  printf 'memecatch-%s:rollback-%s\n' "${service#mpe-}" "$sha"
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
# `app` is recorded only when it runs a server image: after a hand rollback to
# the release before the cutover it runs the Next app, which this agent cannot
# restore (docs/oci-setup.md, "Cutover").
tag_rollback() {
  local sha="$1" service role image id ref record="$STATE_DIR/rollback-$1.refs"
  : >"$record"
  for service in app mpe-worker scheduler backup; do
    image="$(service_image "$service")" || continue
    id="$(docker inspect "memecatch-$service-1" --format '{{.Image}}')" || continue
    role="$service"
    if [[ "$service" == app ]]; then
      if [[ "$image" != *memecatch-server:* ]]; then
        log "warning: app runs $image, not a server image; its rollback keeps the new image"
        continue
      fi
      role=server
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
# The server and mpe-worker images come from compose variables; scheduler and
# backup are compose-built under fixed names, so their snapshots are retagged.
rollback_env() {
  local record="$STATE_DIR/rollback-$1.refs" role ref
  [[ -f "$record" ]] || return 1
  while read -r role ref; do
    case "$role" in
      server) printf 'MEMECATCH_SERVER_IMAGE=%s\n' "$ref" ;;
      mpe-worker) printf 'MEMECATCH_WORKER_IMAGE=%s\n' "$ref" ;;
      scheduler | backup) docker tag "$ref" "memecatch-$role:local" ;;
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

# The server image for <sha>, built with RELEASE_SHA and deploy/build.env (as
# $2...): the release header, site URL and analytics IDs it reads from its
# image environment when it starts. Run from the checkout.
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
    && build_server_image "$sha" "${args[@]}" \
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

# The status and NATIVE_COMPARE_HEADERS of GET <url>, one per line
# ("status 200", "content-type text/plain"; an absent header is empty, a
# request that got no answer is status 000). Asked from inside the compose
# network: the scheduler has curl. The Host and
# protocol are the public site's, as Caddy forwards them.
native_response() {
  local url="$1" host="${PUBLIC_URL#*://}" head header
  host="${host%%/*}"
  head="$(docker exec memecatch-scheduler-1 curl -sS -o /dev/null -D - --max-time 10 \
    -H "Host: ${host}" -H 'X-Forwarded-Proto: https' "$url" 2>/dev/null | tr -d '\r')" || true
  printf 'status %s\n' "$(awk 'NR == 1 && /^HTTP\// { print $2 }' <<<"$head" | grep . || echo 000)"
  for header in "${NATIVE_COMPARE_HEADERS[@]}"; do
    printf '%s %s\n' "$header" "$(awk -v name="$header" -F': ' 'tolower($1) == name { value = substr($0, length($1) + 3) } END { print value }' <<<"$head")"
  done
}

# After a deploy: the read-only requests, logged. Nothing is sent with a
# session and nothing is written; the health gate and the public release
# check decide the deploy.
log_routes() {
  local path
  for path in "${NATIVE_COMPARE_PATHS[@]}"; do
    log "route ${path}: $(native_response "http://app:3000${path}" | tr '\n' ' ')"
  done
}

# The public site answers / with the release header, and not with an error:
# curl -f still prints the headers of a 4xx or 5xx HEAD answer. The
# same test as public_release_once, which `status` repeats.
public_release_is() {
  local sha="$1" seen
  for _ in $(seq 1 20); do
    seen="$(curl -fsSI --max-time 15 "$PUBLIC_URL/" 2>/dev/null \
      | tr -d '\r' | awk -F': ' 'tolower($1) == "x-memecatch-release-sha" { print $2 }')" || seen=""
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
# server build needs (2026-11-24, a deploy refused with 3,900 MB free).
# The Next app's images (repository `memecatch`) are kept by nothing any more:
# the first deploy after the cutover removes them, which ends the way back to
# the release before it (docs/oci-setup.md, "Cutover").
prune_images() {
  local repo kind
  docker images --format '{{.Repository}}:{{.Tag}}' memecatch | grep -E '^memecatch:(release|rollback)-' \
    | xargs -r docker rmi >/dev/null 2>&1 || true
  for repo in memecatch-server memecatch-worker memecatch-scheduler memecatch-backup; do
    for kind in release rollback; do
      docker images --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' "$repo" \
        | grep "|${repo}:${kind}-" | sort -r | tail -n "+$((KEEP_IMAGES + 1))" | cut -d'|' -f2 \
        | xargs -r docker rmi >/dev/null 2>&1 || true
    done
  done
  docker image prune -f >/dev/null 2>&1 || true
  # The build cache grows by about 1.7 GB per deploy and shares the disk with
  # Postgres; three such deploys left the VM under the build margin
  # (2026-11-24). Keep at most AUTODEPLOY_BUILD_CACHE_MAX (3gb) of it, newest first. Only unused
  # cache goes: images, containers and volumes stay. The VM's other apps share
  # this builder, so their old cache goes too (owner's decision, 2026-11-24).
  docker builder prune -f --max-used-space "${AUTODEPLOY_BUILD_CACHE_MAX:-3gb}" >/dev/null 2>&1 || true
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
      show_deploy_log "$(requested_sha)"
      log "verified deployed $(requested_sha)"
      exit 0
    else
      status_rc=$?
    fi
    show_deploy_log "$(requested_sha)"
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

  # The images are built on this disk. Refuse while nothing has changed yet;
  # an unreadable figure is not room.
  free_mb="$(docker_free_mb)" || free_mb=""
  min_free_mb="$(server_build_min_free_mb)"
  [[ "$free_mb" =~ ^[0-9]+$ ]] \
    || not_deployed "cannot read the free space of Docker's data directory; not building the images"
  (( free_mb >= min_free_mb )) \
    || not_deployed "Docker's data directory has ${free_mb} MB free and building the images needs ${min_free_mb} MB (AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB); free some, for example with docker builder prune, and re-run. Nothing was changed"

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

  # RELEASE_SHA from the shell overrides any stale value in .env.
  if RELEASE_SHA="$target" MEMECATCH_SERVER_IMAGE="memecatch-server:release-${target}" \
    DEPLOY_OCI_FORCE_RECREATE="$force" bash "$ROOT/scripts/deploy-oci.sh" \
    && public_release_is "$target"; then
    log_routes
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

# A dropped SSH session must not stop a deploy halfway. On 2026-11-24 (run
# 45336656538) the session broke while images were building; the agent went on
# to start the new containers, then died writing to the dead channel before it
# recorded the release, and CI waited 45 minutes for evidence that never came.
#
# So an SSH deploy runs as a second copy of this script in a session of its
# own: input from /dev/null, output to $STATE_DIR/deploy-<sha>.log, SIGHUP and
# SIGPIPE ignored. It finishes, records the release or rolls back, and writes
# its exit status next to the log. This side only relays the log and that
# status to the client; if the client goes away this side dies and the copy
# does not notice. `status <sha>` prints the end of the log on stderr.
run_detached() {
  local sha log status_file pid offset=0 size
  sha="$(requested_sha)"
  mkdir -p "$STATE_DIR"
  find "$STATE_DIR" -maxdepth 1 -name 'deploy-*' -mtime +14 -delete 2>/dev/null || true
  log="$STATE_DIR/deploy-${sha}.log"
  status_file="$STATE_DIR/deploy-${sha}.status"
  rm -f "$status_file"
  : >"$log"
  ( trap '' HUP PIPE
    exec setsid env AUTODEPLOY_DETACHED=1 AUTODEPLOY_STATUS_FILE="$status_file" bash "$0" ) \
    </dev/null >>"$log" 2>&1 &
  pid=$!
  while true; do
    size="$(wc -c <"$log")"
    if (( size > offset )); then
      tail -c "+$((offset + 1))" "$log" | head -c "$((size - offset))"
      offset="$size"
    fi
    if [[ -s "$status_file" ]]; then
      # Anything written between the last read and the status.
      tail -c "+$((offset + 1))" "$log"
      exit "$(cat "$status_file")"
    fi
    if ! jobs -rp | grep -qx "$pid"; then
      [[ -s "$status_file" ]] && continue
      log "the deploy ended without an exit status; see $log"
      exit 1
    fi
    sleep 1
  done
}

# The end of the log of the last SSH deploy of <sha>, on stderr, for `status`.
show_deploy_log() {
  local log="$STATE_DIR/deploy-$1.log"
  [[ -s "$log" ]] || return 0
  printf 'last lines of %s:\n' "$log" >&2
  tail -n 30 "$log" | sed 's/^/  /' >&2
}

entry() {
  if [[ -n "${AUTODEPLOY_STATUS_FILE:-}" ]]; then
    trap 'printf "%s\n" "$?" >"$AUTODEPLOY_STATUS_FILE"' EXIT
  elif [[ -n "${SSH_CONNECTION:-}" && -z "${AUTODEPLOY_DETACHED:-}" && -n "$(requested_sha)" ]] && ! requested_status; then
    run_detached
  fi
  main "$@"
}

# Run when executed; only define functions when sourced (the test sources it).
(return 0 2>/dev/null) || entry "$@"
