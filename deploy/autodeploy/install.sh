#!/usr/bin/env bash
# Install or update the autodeploy timer on the VM. Run from /opt/memecatch.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
sudo install -m 644 "$root/deploy/autodeploy/memecatch-autodeploy.service" /etc/systemd/system/
sudo install -m 644 "$root/deploy/autodeploy/memecatch-autodeploy.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now memecatch-autodeploy.timer
systemctl list-timers memecatch-autodeploy.timer --no-pager
