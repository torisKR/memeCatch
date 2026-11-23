#!/bin/bash
# Deploy the memecatch compose project on the shared OCI VM.
# It never stops, removes, or edits containers and services outside project memecatch.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export CLOUDFLARE_TRUSTED_PROXIES="${CLOUDFLARE_TRUSTED_PROXIES:-$(tr '\n' ' ' < deploy/cloudflare-proxies.txt)}"

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

env_file="${MEMECATCH_ENV_FILE:-$ROOT/.env}"
caddy_mode="${MEMECATCH_CADDY:-}"
if [[ -z "$caddy_mode" ]]; then
  caddy_mode="$(dotenv_value MEMECATCH_CADDY "$env_file")"
fi
# MEMECATCH_AXUM=1 puts the Axum server in front of Next
# (docs/axum-migration/PLAN.md). Read like MEMECATCH_CADDY. Only the value 1
# turns it on; anything else, or nothing, deploys Next alone.
axum="${MEMECATCH_AXUM:-}"
if [[ -z "$axum" ]]; then
  axum="$(dotenv_value MEMECATCH_AXUM "$env_file")"
fi

port_busy() {
  local port="$1"
  if [[ -n "${DEPLOY_OCI_PORTS_BUSY:-}" ]]; then
    [[ "${DEPLOY_OCI_PORTS_BUSY}" == "yes" ]]
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -Eq "(^|[^0-9])${port}$"
    return
  fi
  netstat -ltn | awk '{print $4}' | grep -Eq "(^|[^0-9])${port}$"
}

own_caddy_running() {
  if [[ -n "${DEPLOY_OCI_OWN_CADDY_RUNNING:-}" ]]; then
    [[ "${DEPLOY_OCI_OWN_CADDY_RUNNING}" == "yes" ]]
    return
  fi
  docker ps \
    --filter label=com.docker.compose.project=memecatch \
    --filter label=com.docker.compose.service=caddy \
    --filter status=running \
    -q | grep -q .
}

files=(-f docker-compose.yml)
health_url="http://127.0.0.1:12730/api/health"
mode="shared"
if [[ "$caddy_mode" == "own" ]]; then
  if ! own_caddy_running && { port_busy 80 || port_busy 443; }; then
    echo "memecatch: MEMECATCH_CADDY=own but 80 or 443 is already in use by another process. Not starting a second proxy." >&2
    exit 1
  fi
  echo "memecatch: MEMECATCH_CADDY=own. Starting memeCatch's own Caddy."
  mode="own"
  files+=(-f docker-compose.own-caddy.yml)
  health_url="http://127.0.0.1/api/health"
else
  echo "memecatch: shared proxy on 127.0.0.1:12730. Paste deploy/Caddyfile.site into the existing reverse proxy."
  echo "memecatch: this script will not edit that proxy. Set MEMECATCH_CADDY=own only when 80 and 443 are free."
  files+=(-f docker-compose.shared-proxy.yml)
fi
# The service that runs the Next image: `app`, or `next` behind Axum.
next_service=app
if [[ "$axum" == 1 ]]; then
  echo "memecatch: MEMECATCH_AXUM=1. Axum listens as app:3000 and proxies to Next on next:3001."
  files+=(-f docker-compose.axum.yml)
  next_service=next
fi

if [[ "${DEPLOY_OCI_PRINT_PLAN:-}" == "1" ]]; then
  printf 'mode=%s\n' "$mode"
  printf 'files=%s\n' "${files[*]}"
  printf 'health=%s\n' "$health_url"
  exit 0
fi

# Longer than Next's health check takes to give up (12 tries, 10 s apart).
next_wait_seconds=180

force_recreate=()
if [[ "${DEPLOY_OCI_FORCE_RECREATE:-}" == "1" ]]; then
  force_recreate=(--force-recreate)
fi

if [[ "${MEMECATCH_IMAGE:-}" == ghcr.io/* ]]; then
  docker compose -p memecatch "${files[@]}" pull "$next_service"
fi
if [[ "${MEMECATCH_WORKER_IMAGE:-}" == ghcr.io/* ]]; then
  docker compose -p memecatch "${files[@]}" pull mpe-worker
fi
if [[ "$axum" == 1 ]]; then
  # Next first, beside the listener that is still serving, and `app` only
  # after Next's health check passes. If Next never becomes healthy this stops
  # here and `app` is left as it was.
  docker compose -p memecatch "${files[@]}" up -d --wait --wait-timeout "$next_wait_seconds" next
  if [[ "${DEPLOY_OCI_FORCE_RECREATE:-}" == "1" ]]; then
    docker compose -p memecatch "${files[@]}" up -d --no-deps --force-recreate --wait --wait-timeout "$next_wait_seconds" next
  fi
  # Then the listener, by itself. The `up -d` below replaces every container
  # whose image changed and starts none of them until all the old ones have
  # stopped. The worker can take most of its 10 s grace period to stop, and
  # with `app` in that batch the site has no listener for as long (measured:
  # 10 s together, 0.3 s alone). A manual redeploy recreates it here, once.
  docker compose -p memecatch "${files[@]}" up -d --no-deps "${force_recreate[@]}" app
fi
docker compose -p memecatch "${files[@]}" up -d
if [[ "${DEPLOY_OCI_FORCE_RECREATE:-}" == "1" && "$axum" != 1 ]]; then
  docker compose -p memecatch "${files[@]}" up -d --no-deps --force-recreate app
fi
if [[ "$axum" != 1 ]]; then
  # An earlier MEMECATCH_AXUM=1 deploy leaves a `next` container that this
  # file list no longer names. `app` is Next again by now, so remove that
  # container, and only it: a second Next would keep its own connection pool
  # and memory limit.
  stale_next="$(docker ps -aq \
    --filter label=com.docker.compose.project=memecatch \
    --filter label=com.docker.compose.service=next)"
  if [[ -n "$stale_next" ]]; then
    echo "memecatch: MEMECATCH_AXUM is off. Removing the Next container that ran behind Axum."
    # shellcheck disable=SC2086 # one container id per word
    docker rm -f $stale_next >/dev/null
  fi
fi

# With Axum in front, /api/health is Axum's and already asks Next. The
# containers' own health checks must agree as well, so the gate does not
# depend on what answers at the health URL.
axum_pair_healthy() {
  local service status
  for service in app next; do
    status="$(docker inspect "memecatch-$service-1" \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>/dev/null)" || return 1
    [[ "$status" == healthy ]] || return 1
  done
}

for _ in $(seq 1 60); do
  if curl -fsS "$health_url" >/dev/null && { [[ "$axum" != 1 ]] || axum_pair_healthy; }; then
    echo "memecatch: healthy at ${health_url}"
    exit 0
  fi
  sleep 2
done
echo "memecatch: health check failed at ${health_url}" >&2
docker compose -p memecatch ps
exit 1
