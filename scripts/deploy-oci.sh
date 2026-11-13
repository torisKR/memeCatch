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
if [[ -z "${MEMECATCH_CADDY:-}" ]]; then
  MEMECATCH_CADDY="$(dotenv_value MEMECATCH_CADDY "$env_file")"
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
if [[ "${MEMECATCH_CADDY:-}" == "own" ]]; then
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

if [[ "${DEPLOY_OCI_PRINT_PLAN:-}" == "1" ]]; then
  printf 'mode=%s\n' "$mode"
  printf 'files=%s\n' "${files[*]}"
  printf 'health=%s\n' "$health_url"
  exit 0
fi

if [[ "${MEMECATCH_IMAGE:-}" == ghcr.io/* ]]; then
  docker compose -p memecatch "${files[@]}" pull app
fi
if [[ "${MEMECATCH_WORKER_IMAGE:-}" == ghcr.io/* ]]; then
  docker compose -p memecatch "${files[@]}" pull mpe-worker
fi
docker compose -p memecatch "${files[@]}" up -d

for _ in $(seq 1 60); do
  if curl -fsS "$health_url" >/dev/null; then
    echo "memecatch: healthy at ${health_url}"
    exit 0
  fi
  sleep 2
done
echo "memecatch: health check failed at ${health_url}" >&2
docker compose -p memecatch ps
exit 1
