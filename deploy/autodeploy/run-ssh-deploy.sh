#!/usr/bin/env bash
# Deploy once; confirm the result using only read-only evidence.
set -euo pipefail

readonly status_reconcile_seconds=2700
readonly status_timeout_seconds=90
readonly status_kill_grace_seconds=5
readonly status_initial_backoff_seconds=60
readonly status_max_backoff_seconds=240
readonly status_max_attempts=13
# Exit 4 is reserved for a status that did not acquire the lock and therefore
# cannot have queried the CI API. Limit retries even if a peer returns it early.
readonly status_lock_busy_rc=4
readonly status_final_busy_retries=3

run_deploy() {
  local sha="$1" rc attempt evidence start now previous deadline remaining wait_seconds timeout_seconds backoff_seconds final_attempt busy_retries
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid deployment SHA" >&2; return 1; }
  local ssh_args=(
    -i "$RUNNER_TEMP/deploy_key" -o IdentitiesOnly=yes
    -o "UserKnownHostsFile=$RUNNER_TEMP/known_hosts" -o StrictHostKeyChecking=yes
    -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=3
    -o 'ProxyCommand=cloudflared access ssh --hostname %h'
    "ubuntu@${DEPLOY_HOST}"
  )
  # Bound the initial SSH session independently from the reconciliation window.
  if timeout --kill-after="${status_kill_grace_seconds}s" "${status_reconcile_seconds}s" ssh "${ssh_args[@]}" "$sha"; then
    echo "SSH completed; verifying deployment evidence without redeploying" >&2
  else
    rc=$?
    # A client timeout or kill, like a disconnect, leaves the remote outcome unknown.
    if [[ "$rc" != 255 && "$rc" != 124 && "$rc" != 137 ]]; then return "$rc"; fi
    echo "SSH disconnected; verifying deployment evidence without redeploying" >&2
  fi
  # The 45-minute window exceeds the agent's 30-minute lock acquisition wait.
  # It is still bounded because remote execution has no finite duration limit.
  start="$(date +%s)" || return 1
  [[ "$start" =~ ^[0-9]+$ ]] || return 1
  deadline=$((start + status_reconcile_seconds)); previous="$start"
  backoff_seconds="$status_initial_backoff_seconds"
  for ((attempt = 1; attempt <= status_max_attempts; attempt++)); do
    now="$(date +%s)" || return 1
    [[ "$now" =~ ^[0-9]+$ ]] && (( now >= previous )) || return 1
    previous="$now"; remaining=$((deadline - now))
    (( remaining > 0 )) || break
    final_attempt=0
    if (( attempt == status_max_attempts || remaining <= status_timeout_seconds + status_kill_grace_seconds )); then
      final_attempt=1
      wait_seconds=$((remaining - status_timeout_seconds))
      if (( wait_seconds > 0 )); then
        sleep "$wait_seconds"
        now="$(date +%s)" || return 1
        [[ "$now" =~ ^[0-9]+$ ]] && (( now >= previous )) || return 1
        previous="$now"; remaining=$((deadline - now))
        (( remaining > 0 )) || break
      fi
    fi
    timeout_seconds="$status_timeout_seconds"
    if (( final_attempt )); then
      (( remaining < timeout_seconds )) && timeout_seconds="$remaining"
    elif (( remaining - status_timeout_seconds - status_kill_grace_seconds < timeout_seconds )); then
      timeout_seconds=$((remaining - status_timeout_seconds - status_kill_grace_seconds))
    fi
    busy_retries=0
    while true; do
      rc=0
      evidence="$(timeout --kill-after="${status_kill_grace_seconds}s" "${timeout_seconds}s" ssh "${ssh_args[@]}" "status $sha")" || rc=$?
      if (( rc == 0 )) && printf '%s\n' "$evidence" | grep -Eq "^[0-9TZ:.-]+ memecatch-autodeploy: verified deployed ${sha}$"; then
        now="$(date +%s)" || return 1
        [[ "$now" =~ ^[0-9]+$ ]] && (( now >= previous && now <= deadline )) || return 1
        printf '%s\n' "$evidence"
        echo "Deployment evidence verified"
        return 0
      fi
      (( final_attempt && rc == status_lock_busy_rc && busy_retries < status_final_busy_retries )) || break
      now="$(date +%s)" || return 1
      [[ "$now" =~ ^[0-9]+$ ]] && (( now >= previous )) || return 1
      previous="$now"; remaining=$((deadline - now))
      (( remaining > 1 )) || break
      echo "Deployment status lock busy; retrying read-only status" >&2
      sleep 1
      now="$(date +%s)" || return 1
      [[ "$now" =~ ^[0-9]+$ ]] && (( now >= previous )) || return 1
      previous="$now"; remaining=$((deadline - now))
      (( remaining > 0 )) || break
      timeout_seconds="$status_timeout_seconds"
      (( remaining < timeout_seconds )) && timeout_seconds="$remaining"
      busy_retries=$((busy_retries + 1))
    done
    echo "Deployment status not verified (attempt $attempt)" >&2
    now="$(date +%s)" || return 1
    [[ "$now" =~ ^[0-9]+$ ]] && (( now >= previous )) || return 1
    previous="$now"; remaining=$((deadline - now))
    (( remaining > 0 )) || break
    (( ! final_attempt )) || break
    # Reserve the last request for near the end of the window, even when
    # earlier status calls fail immediately or consume varying amounts of time.
    wait_seconds="$backoff_seconds"
    if (( attempt == status_max_attempts - 1 )); then
      wait_seconds=$((remaining - status_timeout_seconds))
    elif (( wait_seconds > remaining - status_timeout_seconds - status_kill_grace_seconds )); then
      wait_seconds=$((remaining - status_timeout_seconds - status_kill_grace_seconds))
    fi
    (( wait_seconds < 0 )) && wait_seconds=0
    (( wait_seconds > 0 )) && sleep "$wait_seconds"
    if (( backoff_seconds < status_max_backoff_seconds )); then
      backoff_seconds=$((backoff_seconds * 2))
      (( backoff_seconds > status_max_backoff_seconds )) && backoff_seconds="$status_max_backoff_seconds"
    fi
  done
  echo "::error::Deployment outcome remains unverified" >&2
  return 1
}

(return 0 2>/dev/null) || run_deploy "${GITHUB_SHA:-}"
