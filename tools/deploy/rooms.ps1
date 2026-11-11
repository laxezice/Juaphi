# Lists the open rooms of the games on the server, from this PC (read-only; changes nothing):
#   powershell -ExecutionPolicy Bypass -File tools\deploy\rooms.ps1              every app with an admin socket
#   powershell -ExecutionPolicy Bypass -File tools\deploy\rooms.ps1 -App <app>   one app
# Runs tools/deploy/rooms.sh on the server. Exit code 2: a room has players online.

param([string]$App = '', [string]$Server = 'root@207.148.66.224')

ssh -o BatchMode=yes $Server "bash /opt/juaphi/tools/deploy/rooms.sh $App"
exit $LASTEXITCODE
