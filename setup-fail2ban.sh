#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root: sudo bash setup-fail2ban.sh" >&2
  exit 1
fi
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v apt-get >/dev/null
command -v systemctl >/dev/null
apt-get update
apt-get install -y fail2ban python3-systemd
install -m 0644 "$project_dir/fail2ban/wacko-sshd.local" /etc/fail2ban/jail.d/wacko-sshd.local
fail2ban-client -t
systemctl enable --now fail2ban
systemctl restart fail2ban
fail2ban-client status sshd
