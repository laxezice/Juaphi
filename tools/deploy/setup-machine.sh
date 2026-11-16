#!/usr/bin/env bash
# One-time setup of the game machine 129.121.129.56 (Ubuntu, shared by several games; run as root, safe to run again).
# JuaPhi was the first app moved here (2026-11-15), so the machine-wide setup lives in this repo.
# Machine-wide things only, that every app shares: Node 24 (same major as the old Vultr box 207.148.66.224), 2 GB swap, git, curl,
# sqlite3, a firewall with only SSH open (players come in through the Cloudflare tunnel), and cloudflared itself.
# The tunnel's config (/etc/cloudflared/config.yml) is shared: each app adds its own hostname to its ingress list.
set -euo pipefail

NODE=24

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git curl ca-certificates ufw sqlite3 gnupg

if ! node -v 2>/dev/null | grep -q "^v${NODE}\."; then
  if command -v node >/dev/null; then
    echo "Node $(node -v) is installed; not replacing it with $NODE here (apps use it): decide first." >&2
    exit 1
  fi
  curl -fsSL "https://deb.nodesource.com/setup_${NODE}.x" | bash -
  apt-get install -y -q nodejs
fi
node -v

if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -q
  apt-get install -y -q cloudflared
fi
cloudflared --version

ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null
ufw status | head -5
echo "machine ready: put the tunnel in /etc/cloudflared, then run each app's tools/deploy/setup-server.sh"
