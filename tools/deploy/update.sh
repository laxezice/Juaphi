#!/usr/bin/env bash
# Server side of an update (run as root by deploy.ps1 after it pushed main): check out the ref, install, build if the
# app has a build, install the unit(s), restart, check. update.sh <commit> goes back to an older version.
# The code stays owned by root; data in /var/lib/juaphi (if any) is never touched.
set -euo pipefail

APP=/opt/juaphi
REPO=/opt/juaphi.git
PORT=3030
HEALTH=/healthz
REF=${1:-main}

git --git-dir="$REPO" --work-tree="$APP" checkout -f "$REF"
echo "version: $(git --git-dir="$REPO" log --oneline -1 "$REF")"
for f in juaphi.service juaphi-backup.service juaphi-backup.timer; do
  if [ -f "$APP/tools/deploy/$f" ]; then install -m 644 "$APP/tools/deploy/$f" "/etc/systemd/system/$f"; fi
done
cd "$APP"
# --ignore-scripts: no package's install script runs as root. Drop it if a dependency needs one (a native module).
if node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)"; then
  npm ci --ignore-scripts --no-audit --no-fund
  npm run build
else
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
fi
chown -R root:root "$APP"
systemctl daemon-reload
systemctl enable juaphi >/dev/null 2>&1
if [ -f /etc/systemd/system/juaphi-backup.timer ]; then systemctl enable --now juaphi-backup.timer >/dev/null 2>&1; fi
systemctl restart juaphi

# A cold start can take a few seconds: ask for up to 15 s before calling it failed.
code=000
for _ in $(seq 15); do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${HEALTH}" || true)
  [ "$code" = 200 ] && break
done
systemctl --no-pager --lines=5 status juaphi | head -10
echo "local check: $code"
[ "$code" = 200 ] || { echo "juaphi did not answer 200: journalctl -u juaphi -n 50" >&2; exit 1; }
