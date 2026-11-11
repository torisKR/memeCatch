#!/bin/bash
# Deploy the memecatch compose project on the shared OCI VM.
# It never stops, removes, or edits containers and services outside project memecatch.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export CLOUDFLARE_TRUSTED_PROXIES="${CLOUDFLARE_TRUSTED_PROXIES:-$(tr '\n' ' ' < deploy/cloudflare-proxies.txt)}"

port_busy() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -Eq "(^|[^0-9])${port}$"
    return
  fi
  netstat -ltn | awk '{print $4}' | grep -Eq "(^|[^0-9])${port}$"
}

files=(-f docker-compose.yml)
health_url="http://127.0.0.1/api/health"
if port_busy 80 || port_busy 443; then
  echo "memecatch: 80 or 443 is already taken. Using the shared-proxy port 127.0.0.1:12730."
  echo "memecatch: add deploy/Caddyfile.site to the existing reverse proxy. This script will not edit it."
  files+=(-f docker-compose.shared-proxy.yml)
  health_url="http://127.0.0.1:12730/api/health"
else
  echo "memecatch: 80 and 443 are free. Starting memeCatch's own Caddy."
  files+=(-f docker-compose.own-caddy.yml)
fi

if [[ "${MEMECATCH_IMAGE:-}" == ghcr.io/* ]]; then
  docker compose -p memecatch "${files[@]}" pull app
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
