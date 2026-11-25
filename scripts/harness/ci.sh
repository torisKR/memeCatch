#!/usr/bin/env bash
# Run the local equivalents of the Docker/Rust steps in .github/workflows/ci.yml.
set -euo pipefail

case "$1" in
  rust)
    cd server
    cargo fmt --check
    cargo clippy --all-targets -- -D warnings
    trap 'scripts/test-db.sh down' EXIT
    trap 'exit 143' TERM
    trap 'exit 130' INT
    DATABASE_URL="$(scripts/test-db.sh up)"
    export DATABASE_URL
    cargo test
    ;;
  behaviour)
    (cd server && cargo build --release)
    bash server/behaviour/run.sh
    ;;
  server-image)
    tag="memecatch-server:$TEST_DB_CONTAINER"
    trap 'docker image rm "$tag" >/dev/null 2>&1 || true' EXIT
    args=()
    while IFS='=' read -r key value; do
      [[ -z "$key" || "$key" == \#* ]] || args+=(--build-arg "${key}=${value}")
    done <deploy/build.env
    docker build -f Dockerfile.server -t "$tag" --build-arg RELEASE_SHA="$2" "${args[@]}" .
    [[ "$(docker run --rm "$tag" printenv RELEASE_SHA)" == "$2" ]]
    for key in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_GA_ID NEXT_PUBLIC_ADSENSE_CLIENT NEXT_PUBLIC_COMMUNITY_ENABLED NEXT_PUBLIC_SUBMISSIONS_OPEN; do
      [[ "${key}=$(docker run --rm "$tag" printenv "$key")" == "$(grep -m1 "^${key}=" deploy/build.env)" ]]
    done
    ;;
  worker-image)
    tag="memecatch-worker:$TEST_DB_CONTAINER"
    trap 'docker image rm "$tag" >/dev/null 2>&1 || true' EXIT
    docker build -f Dockerfile.mpe-worker -t "$tag" .
    docker run --rm --entrypoint node "$tag" \
      --experimental-strip-types --import ./scripts/register-ts-paths.mjs scripts/worker-import-smoke.mjs
    ;;
  backup-image|postgres)
    # These existing CI tests use fixed names and remove their containers.
    # Refuse collisions up front and run them on a dedicated local Docker daemon.
    containers="$(docker ps -a --format '{{.Names}}')"
    if grep -Eq '^(memecatch-enum-pg|memecatch-backup-ro|memecatch-restore-proof-pg)$' <<<"$containers"; then
      echo "Error: a reserved CI test container already exists" >&2
      exit 1
    fi
    if [[ "$1" == postgres ]]; then
      for test in enum-in-filter backup-role-readonly community-upload-quota instagram-post-video-verification db-missing-functions; do
        bash "scripts/postgres/$test.test.sh"
      done
    else
      if [[ "$(docker image ls -q memecatch-backup:ci)" != "" ]]; then
        echo "Error: reserved image memecatch-backup:ci already exists" >&2
        exit 1
      fi
      trap 'docker image rm memecatch-backup:ci >/dev/null 2>&1 || true' EXIT
      docker build -f deploy/backup/Dockerfile -t memecatch-backup:ci .
      bash deploy/backup/ci-test-restore.sh
    fi
    ;;
  *)
    echo "Unknown CI step: $1" >&2
    exit 2
    ;;
esac
