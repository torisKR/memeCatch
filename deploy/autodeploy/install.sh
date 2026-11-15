#!/usr/bin/env bash
# Install or update the autodeploy timer on the VM. Run from /opt/memecatch.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
# The agent runs from outside the checkout (see autodeploy.sh header).
sudo install -d -o "$(id -un)" -g "$(id -gn)" -m 755 /var/lib/memecatch-autodeploy /var/lib/memecatch-autodeploy/bin
install -m 755 "$root/deploy/autodeploy/autodeploy.sh" /var/lib/memecatch-autodeploy/bin/autodeploy.sh
sudo install -m 644 "$root/deploy/autodeploy/memecatch-autodeploy.service" /etc/systemd/system/
sudo install -m 644 "$root/deploy/autodeploy/memecatch-autodeploy.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now memecatch-autodeploy.timer
systemctl list-timers memecatch-autodeploy.timer --no-pager
