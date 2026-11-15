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
set -euo pipefail

REPO="${AUTODEPLOY_REPO:-torisKR/memeCatch}"
ROOT="${AUTODEPLOY_ROOT:-/opt/memecatch}"
STATE_DIR="${AUTODEPLOY_STATE_DIR:-/var/lib/memecatch-autodeploy}"
PUBLIC_URL="${AUTODEPLOY_PUBLIC_URL:-https://catchmeme.com}"
CHECK_NAME="${AUTODEPLOY_CHECK_NAME:-check}"
KEEP_IMAGES="${AUTODEPLOY_KEEP_IMAGES:-3}"

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

tag_rollback() {
  local sha="$1" service image
  for service in app mpe-worker scheduler backup; do
    image="$(service_image "$service")" || continue
    docker tag "$(docker inspect "memecatch-$service-1" --format '{{.Image}}')" "${image%%:*}:rollback-${sha}"
  done
}

restore_rollback() {
  local sha="$1" service image
  for service in mpe-worker scheduler backup; do
    image="$(service_image "$service")" || continue
    if docker image inspect "${image%%:*}:rollback-${sha}" >/dev/null 2>&1; then
      docker tag "${image%%:*}:rollback-${sha}" "$image"
    fi
  done
  git -C "$ROOT" reset -q --keep "$sha"
  RELEASE_SHA="$sha" MEMECATCH_IMAGE="memecatch:rollback-${sha}" bash "$ROOT/scripts/deploy-oci.sh"
}

# --build-arg list from deploy/build.env (public values only).
build_args() {
  local file="$1" key value
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    printf -- '--build-arg\n%s=%s\n' "$key" "$value"
  done <"$file"
}

build_images() {
  local sha="$1" args=()
  mapfile -t args < <(build_args "$ROOT/deploy/build.env")
  ( cd "$ROOT"
    nice -n 10 docker build -q -f Dockerfile --build-arg "RELEASE_SHA=${sha}" "${args[@]}" \
      -t "memecatch:release-${sha}" . >/dev/null
    nice -n 10 docker compose -p memecatch -f docker-compose.yml build -q mpe-worker scheduler backup )
}

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

main() {
  mkdir -p "$STATE_DIR"
  exec 9>"$STATE_DIR/lock"
  flock -n 9 || { log "another run is in progress"; exit 0; }

  git -C "$ROOT" fetch -q origin main
  local target current state migrations
  target="$(git -C "$ROOT" rev-parse origin/main)"
  current="$(running_sha)"
  [[ -n "$current" ]] || current="$(git -C "$ROOT" rev-parse HEAD)"

  [[ "$target" == "$current" ]] && exit 0
  [[ -e "$STATE_DIR/failed-$target" ]] && exit 0

  state="$(ci_state "$target" || echo pending)"
  case "$state" in
    success) ;;
    failure) log "CI failed on ${target:0:7}; not deploying"; touch "$STATE_DIR/failed-$target"; exit 0 ;;
    *) log "waiting for CI on ${target:0:7}"; exit 0 ;;
  esac

  migrations="$(new_migrations "$current" "$target")"
  if [[ -n "$migrations" && ! -e "$STATE_DIR/allow-$target" ]]; then
    log "${target:0:7} adds migrations; apply them, then touch $STATE_DIR/allow-$target"
    printf '  %s\n' $migrations
    exit 0
  fi

  if [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]]; then
    log "tracked files changed in $ROOT; refusing to deploy"
    exit 1
  fi

  log "deploying ${target:0:7} (running ${current:0:7})"
  git -C "$ROOT" merge -q --ff-only "$target"
  if ! build_images "$target"; then
    log "build failed for ${target:0:7}; keeping ${current:0:7}"
    git -C "$ROOT" reset -q --keep "$current"
    touch "$STATE_DIR/failed-$target"
    exit 1
  fi
  tag_rollback "$current"

  # RELEASE_SHA from the shell overrides any stale value in .env.
  if RELEASE_SHA="$target" MEMECATCH_IMAGE="memecatch:release-${target}" bash "$ROOT/scripts/deploy-oci.sh" \
    && public_release_is "$target"; then
    printf '%s\n' "$target" >"$STATE_DIR/deployed"
    log "deployed ${target:0:7}"
    prune_images
    exit 0
  fi

  log "deploy of ${target:0:7} failed; rolling back to ${current:0:7}"
  touch "$STATE_DIR/failed-$target"
  restore_rollback "$current"
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
