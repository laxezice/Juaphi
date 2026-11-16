# Deploys juaphi to the server in one command, from this PC (run from anywhere in the repo):
#   powershell -ExecutionPolicy Bypass -File tools\deploy\deploy.ps1                  deploy main
#   powershell -ExecutionPolicy Bypass -File tools\deploy\deploy.ps1 -Ref <commit>    deploy a commit on main (roll back)
#   ... -Force    deploy even while players are online (the restart closes their rooms)
# Pushes main to the server's repo (remote "server"), refreshes the server's copy of tools/deploy from it, then runs
# update.sh there. Data in /var/lib/juaphi is untouched.
# First time: run setup-server.sh on the server,  git remote add server root@129.121.129.56:/opt/juaphi.git , and ssh to the
# server once by hand so its host key is known (this script uses BatchMode and cannot answer that prompt).

param([string]$Ref = 'main', [string]$Server = 'root@129.121.129.56', [switch]$Force)

$ErrorActionPreference = 'Stop'
Set-Location (git rev-parse --show-toplevel)

# The restart closes rooms that live in memory: stop first if anyone is playing (rooms.sh exits 2), unless -Force.
# The first deploy has no rooms.sh on the server yet, and an app without an admin socket lists nothing: both go on.
if (-not $Force) {
  ssh -o BatchMode=yes $Server "[ ! -f /opt/juaphi/tools/deploy/rooms.sh ] || bash /opt/juaphi/tools/deploy/rooms.sh juaphi"
  if ($LASTEXITCODE -eq 2) { throw 'players are online (rooms above): deploy later, or again with -Force to close their rooms' }
}

Write-Host "deploying $Ref ($(git log --oneline -1 $Ref))"
git push server main
if ($LASTEXITCODE -ne 0) { throw 'git push server main failed' }

ssh -o BatchMode=yes $Server "git --git-dir=/opt/juaphi.git --work-tree=/opt/juaphi checkout -f main -- tools/deploy && bash /opt/juaphi/tools/deploy/update.sh $Ref"
if ($LASTEXITCODE -ne 0) { throw 'the update on the server failed' }
Write-Host 'deployed: https://juaphi.laxezice.win'
