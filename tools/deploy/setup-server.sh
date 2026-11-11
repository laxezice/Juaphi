#!/usr/bin/env bash
# One-time setup of juaphi on the server (run as root; safe to run again). App-only: a "juaphi" system user, the bare
# repo the PC pushes to (/opt/juaphi.git, no GitHub login on the server) and the folder the code is checked out into
# (/opt/juaphi, owned by root). Node, swap and the firewall are the machine's (setup-machine.sh); this only checks Node.
#
# Not automated: the front door, because it is shared by every app on the machine. With the Cloudflare tunnel in
# /etc/cloudflared/config.yml, add this above the final  - service: http_status:404  rule:
#     - hostname: juaphi.laxezice.win
#       service: http://127.0.0.1:3030
# then  cloudflared tunnel route dns <tunnel name> juaphi.laxezice.win  (once) and  systemctl restart cloudflared.
set -euo pipefail

APP=/opt/juaphi
REPO=/opt/juaphi.git
NEED=18

have=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/')
[ -n "$have" ] && [ "$have" -ge "$NEED" ] || { echo "Node $NEED+ is needed (the machine's setup installs it); found: ${have:-none}" >&2; exit 1; }
command -v git >/dev/null || { apt-get update -q && apt-get install -y -q git; }

id juaphi >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin juaphi
mkdir -p "$APP"
[ -d "$REPO" ] || git init --bare -q "$REPO"
git config --global --get-all safe.directory | grep -qx "$APP" || git config --global --add safe.directory "$APP"
git config --global --get-all safe.directory | grep -qx "$REPO" || git config --global --add safe.directory "$REPO"

echo "setup done: on the PC  git remote add vultr root@207.148.66.224:$REPO  (once), then run tools/deploy/deploy.ps1"
