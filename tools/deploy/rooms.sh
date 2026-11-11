#!/usr/bin/env bash
# Lists the open rooms of the games on this machine (read-only):  rooms.sh            every app with an admin socket
#                                                                  rooms.sh <app>      one app
# Each app answers on /run/<app>/admin.sock (admin-socket.js in its repo). Exit 2 when a room has players online
# (deploy.ps1 stops on it), else 0.
set -uo pipefail

live=0
found=0
for s in /run/${1:-*}/admin.sock; do
  [ -S "$s" ] || continue
  found=1
  app=$(basename "$(dirname "$s")")
  if ! json=$(curl -s --fail --max-time 3 --unix-socket "$s" http://admin/rooms); then
    echo "$app: the admin socket did not answer"
    continue
  fi
  APP="$app" node -e '
    const rooms = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const on = rooms.filter((r) => r.online > 0);
    console.log(`${process.env.APP}: ${rooms.length} room(s), ${on.length} with players online`);
    for (const r of rooms) {
      console.log(`  ${String(r.code).padEnd(8)} ${String(r.state).padEnd(8)} players ${r.players}  online ${r.online}  idle ${r.idleMin} min${r.note ? "  " + r.note : ""}`);
    }
    process.exit(on.length > 0 ? 2 : 0);' <<<"$json"
  [ $? -eq 2 ] && live=1
done
[ "$found" = 1 ] || echo "no admin socket${1:+ for $1} (the app does not list its rooms yet)"
[ "$live" = 1 ] && exit 2
exit 0
