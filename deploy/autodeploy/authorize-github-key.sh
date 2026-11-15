#!/usr/bin/env bash
# Authorize the GitHub Actions deploy key on the VM, for one thing only.
#   bash deploy/autodeploy/authorize-github-key.sh <public-key-file>
#
# The entry forces the deploy agent and `restrict` turns off the shell, PTY,
# and port, agent, and X11 forwarding. Whatever the client asks to run is only
# passed to the agent as SSH_ORIGINAL_COMMAND, which accepts a commit SHA on
# origin/main and nothing else. A leaked key can trigger a deploy of a commit
# that passed CI; it cannot open a shell.
set -euo pipefail
pub="${1:?public key file}"
read -r type key _ <"$pub"
[[ "$type" == ssh-ed25519 && -n "$key" ]] || { echo "need an ssh-ed25519 public key" >&2; exit 1; }
entry="restrict,command=\"/var/lib/memecatch-autodeploy/bin/autodeploy.sh\" $type $key github-actions-memecatch-deploy"
auth="$HOME/.ssh/authorized_keys"
install -d -m 700 "$HOME/.ssh"
touch "$auth" && chmod 600 "$auth"
# Replace any earlier GitHub deploy entry; leave every other key alone.
grep -v ' github-actions-memecatch-deploy$' "$auth" >"$auth.new" || true
printf '%s\n' "$entry" >>"$auth.new"
mv -f "$auth.new" "$auth"
echo "authorized github-actions-memecatch-deploy (forced command)"
