// ห้องที่เปิดอยู่ สำหรับคนที่อยู่บนเซิร์ฟเวอร์ (tools/deploy/rooms.ps1 และ deploy.ps1 เช็กก่อนรีสตาร์ต)
// เป็น HTTP เล็กๆ บน Unix socket ใน RuntimeDirectory ของ unit (/run/juaphi/admin.sock)
// Cloudflare ส่งต่อแค่พอร์ต TCP ผู้เล่นเลยเข้าถึงไม่ได้ และไม่ต้องมีรหัสผ่าน มีแค่ root กับ user juaphi ที่เปิด socket ได้
// รันบนเครื่องตัวเอง (ไม่มี RUNTIME_DIRECTORY) จะไม่เปิดอะไร
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

/**
 * ห้องทั้งหมดในรูปแบบที่ทุกเกมบนเครื่องใช้ร่วมกัน มีแต่ตัวเลข ไม่มีชื่อคน
 * { code, state: 'waiting' | 'playing', players, online, idleMin }
 */
function summarizeRooms(rooms, now = Date.now()) {
  return [...rooms.values()].map((r) => ({
    code: r.code,
    state: r.game && !r.game.winner ? 'playing' : 'waiting',
    players: r.players.length,
    online: r.players.filter((p) => p.online).length,
    idleMin: Math.floor((now - (r.lastActive || now)) / 60000),
  }));
}

function startAdminSocket(list) {
  const dir = process.env.RUNTIME_DIRECTORY;
  if (!dir) return null;
  const sock = path.join(dir.split(':')[0], 'admin.sock');
  try { fs.unlinkSync(sock); } catch { /* ไม่มีอยู่แล้ว */ }
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/rooms') {
      let body;
      try { body = JSON.stringify(list()); } catch (e) { res.writeHead(500); return res.end(String(e)); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(body);
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(sock, () => fs.chmodSync(sock, 0o660));
  server.on('error', (e) => console.error('admin socket:', e.message));
  return server;
}

module.exports = { summarizeRooms, startAdminSocket };
