#!/usr/bin/env bash
# Deploy once; confirm the result using only read-only evidence.
set -euo pipefail

run_deploy() {
  local sha="$1" rc attempt evidence
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid deployment SHA" >&2; return 1; }
  local ssh_args=(
    -i "$RUNNER_TEMP/deploy_key" -o IdentitiesOnly=yes
    -o "UserKnownHostsFile=$RUNNER_TEMP/known_hosts" -o StrictHostKeyChecking=yes
    -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=3
    -o 'ProxyCommand=cloudflared access ssh --hostname %h'
    "ubuntu@${DEPLOY_HOST}"
  )
  if ssh "${ssh_args[@]}" "$sha"; then
    echo "SSH completed; verifying deployment evidence without redeploying" >&2
  else
    rc=$?
    if [[ "$rc" != 255 ]]; then return "$rc"; fi
    echo "SSH disconnected; verifying deployment evidence without redeploying" >&2
  fi
  for ((attempt = 1; attempt <= 8; attempt++)); do
    if evidence="$(timeout 90s ssh "${ssh_args[@]}" "status $sha")" &&
      printf '%s\n' "$evidence" | grep -Eq "^[0-9TZ:.-]+ memecatch-autodeploy: verified deployed ${sha}$"; then
      printf '%s\n' "$evidence"
      echo "Deployment evidence verified"
      return 0
    fi
    echo "Deployment status not verified (attempt $attempt/8)" >&2
    if (( attempt < 8 )); then sleep 15; fi
  done
  echo "::error::Deployment outcome remains unverified" >&2
  return 1
}

(return 0 2>/dev/null) || run_deploy "${GITHUB_SHA:-}"
