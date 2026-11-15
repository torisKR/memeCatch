#!/usr/bin/env bash
# Install or update the deploy agent on the VM. Run from /opt/memecatch.
#   bash deploy/autodeploy/install.sh              agent only (GitHub Actions calls it)
#   bash deploy/autodeploy/install.sh --with-timer also poll main every 3 minutes
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
# The agent runs from outside the checkout (see autodeploy.sh header).
sudo install -d -o "$(id -un)" -g "$(id -gn)" -m 755 /var/lib/memecatch-autodeploy /var/lib/memecatch-autodeploy/bin
install -m 755 "$root/deploy/autodeploy/autodeploy.sh" /var/lib/memecatch-autodeploy/bin/autodeploy.sh
sudo install -m 644 "$root/deploy/autodeploy/memecatch-autodeploy.service" /etc/systemd/system/
sudo install -m 644 "$root/deploy/autodeploy/memecatch-autodeploy.timer" /etc/systemd/system/
sudo systemctl daemon-reload
if [[ "${1:-}" == --with-timer ]]; then
  sudo systemctl enable --now memecatch-autodeploy.timer
else
  sudo systemctl disable --now memecatch-autodeploy.timer 2>/dev/null || true
fi
systemctl list-timers memecatch-autodeploy.timer --all --no-pager | head -3
