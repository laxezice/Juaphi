// จั่วผี: เซิร์ฟเวอร์ห้องเกม เสิร์ฟหน้าเว็บจาก public/ และคุยกับผู้เล่นผ่าน WebSocket ที่ /ws
// สถานะทั้งหมดอยู่ในหน่วยความจำ รีสตาร์ตแล้วห้องหาย กติกาอยู่ใน game/
// แต่ละเครื่องได้รับเฉพาะสิ่งที่ viewFor() คืนให้ กับส่วนลับของอีเวนต์ที่ส่งถึงตัวเอง

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const G = require('./game/game');
const { viewFor } = require('./game/view');
const { makeRng } = require('./game/deck');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');
const VENDOR = path.join(__dirname, 'node_modules', 'three', 'build');
const MIN_PLAYERS = 2;
const MAX_SEATS = 8;                                         // รวมคนดู
const NOPE_MS = Number(process.env.JUAPHI_NOPE_MS) || 3000;  // เวลากด "ไม่!"
const GRACE_MS = Number(process.env.JUAPHI_GRACE_MS) || 15000; // หลุดเกินเท่านี้ ระบบทำแทน / ย้ายหัวห้อง
const SEED = process.env.JUAPHI_SEED ? Number(process.env.JUAPHI_SEED) : null; // ใช้ในเทสต์เท่านั้น
const LOBBY_DROP_MS = 60 * 1000;      // หลุดตอนไม่ได้เล่นอยู่นานเท่านี้ ตัดชื่อออก
const ROOM_IDLE_MS = 30 * 60 * 1000;  // ไม่มีใครออนไลน์นานเท่านี้ ลบห้อง

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- HTTP ----------
function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = '/'; }
  if (p === '/') p = '/index.html';
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (p === '/vendor/three.module.js' || p === '/vendor/three.core.js') return serveFile(res, path.join(VENDOR, path.basename(p)));
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  serveFile(res, file);
});

// ---------- ห้อง ----------
/** @type {Map<string, any>} */
const rooms = new Map();
const newId = () => crypto.randomBytes(9).toString('base64url');

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)];
    if (!rooms.has(c)) return c;
  }
}

function createRoom() {
  const r = {
    code: newCode(), hostId: null, players: [], names: {}, game: null, rng: null,
    windowTimer: null, windowEndsAt: 0, takeoverTimer: null, takeoverFor: null, idleTimer: null,
  };
  rooms.set(r.code, r);
  return r;
}

const hostName = (r) => r.players.find((p) => p.id === r.hostId)?.name || '';
const inGame = (r) => !!r.game && !r.game.winner;

function listRooms() {
  const out = [];
  for (const r of rooms.values()) {
    if (!r.players.some((p) => p.online)) continue;
    out.push({ code: r.code, name: `ห้องของ ${hostName(r)}`, players: r.players.length, max: MAX_SEATS, status: inGame(r) ? 'play' : 'lobby' });
  }
  out.sort((a, b) => (a.status === b.status ? 0 : a.status === 'lobby' ? -1 : 1) || a.code.localeCompare(b.code));
  return out;
}

function cleanText(s, max) {
  return typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

let listQueued = false;
function pushRoomList() {
  if (listQueued) return;
  listQueued = true;
  setImmediate(() => {
    listQueued = false;
    const msg = { t: 'rooms', rooms: listRooms() };
    for (const ws of wss.clients) if (ws.wantsList) send(ws, msg);
  });
}

function stateFor(r, p) {
  const seatedInGame = r.game && r.game.players.some((x) => x.id === p.id);
  return {
    t: 'state',
    you: p.id,
    room: {
      code: r.code,
      name: `ห้องของ ${hostName(r)}`,
      hostId: r.hostId,
      players: r.players.map((x) => ({ id: x.id, name: x.name, online: x.online, seat: x.seat })),
      names: r.names,
    },
    game: r.game ? viewFor(r.game, seatedInGame ? p.id : null) : null,
    windowLeftMs: r.game && r.game.pending && r.game.pending.kind === 'window' ? Math.max(0, r.windowEndsAt - Date.now()) : 0,
  };
}

function broadcast(r) {
  for (const p of r.players) send(p.ws, stateFor(r, p));
  pushRoomList();
}

/** ส่งอีเวนต์ ส่วน secret ไปเฉพาะคนใน secret.to */
function deliver(r, events) {
  for (const e of events) {
    const { secret, ...pub } = e;
    for (const p of r.players) {
      let out = pub;
      if (secret && secret.to.includes(p.id)) {
        const { to, ...priv } = secret;
        out = { ...pub, ...priv };
      }
      send(p.ws, { t: 'event', e: out });
    }
  }
}

function ensureHost(r) {
  const host = r.players.find((p) => p.id === r.hostId);
  if (host && (host.online || Date.now() - host.offlineSince < GRACE_MS)) return;
  const next = r.players.find((p) => p.online) || r.players[0];
  r.hostId = next ? next.id : null;
}

// ---------- เกม ----------
function afterChange(r, events) {
  if (events && events.length) deliver(r, events);
  const g = r.game;
  clearTimeout(r.windowTimer);
  if (g && g.pending && g.pending.kind === 'window') {
    if (!r.windowEndsAt) r.windowEndsAt = Date.now() + NOPE_MS;
    r.windowTimer = setTimeout(() => {
      r.windowEndsAt = 0;
      const res = G.resolvePending(g, r.rng);
      afterChange(r, res.ok ? res.events : []);
    }, Math.max(0, r.windowEndsAt - Date.now()));
  } else {
    r.windowEndsAt = 0;
  }
  scheduleTakeover(r);
  broadcast(r);
}

/** ถ้าคนที่เกมรออยู่หลุด รอ GRACE_MS แล้วทำแทน */
function scheduleTakeover(r) {
  const g = r.game;
  const id = g ? G.waitingOn(g) : null;
  const p = id && r.players.find((x) => x.id === id);
  const offline = !p || !p.online;
  if (!id || !offline) {
    clearTimeout(r.takeoverTimer);
    r.takeoverTimer = null;
    r.takeoverFor = null;
    return;
  }
  const key = `${id}:${g.pending ? g.pending.kind : 'turn'}:${g.turnsLeft}:${g.deck.length}`;
  if (r.takeoverFor === key) return;
  clearTimeout(r.takeoverTimer);
  r.takeoverFor = key;
  const since = p ? p.offlineSince : Date.now();
  r.takeoverTimer = setTimeout(() => {
    r.takeoverTimer = null;
    r.takeoverFor = null;
    if (r.game !== g || G.waitingOn(g) !== id) return scheduleTakeover(r);
    const res = G.autoAct(g, r.rng);
    afterChange(r, res.ok ? res.events : []);
  }, Math.max(0, since + GRACE_MS - Date.now()));
}

function startGame(r) {
  const seated = r.players.slice(0, MAX_SEATS);
  for (const p of seated) { p.seat = 'player'; r.names[p.id] = p.name; }
  r.rng = SEED != null ? makeRng(SEED) : Math.random;
  r.game = G.createGame(seated.map((p) => p.id), r.rng);
  r.windowEndsAt = 0;
  afterChange(r, [{ type: 'start' }]);
}

function removeFromRoom(r, p) {
  clearTimeout(p.dropTimer);
  if (r.game) {
    const events = G.removePlayer(r.game, p.id, r.rng);
    r.players = r.players.filter((x) => x !== p);
    ensureHost(r);
    afterChange(r, events);
  } else {
    r.players = r.players.filter((x) => x !== p);
    delete r.names[p.id];
    ensureHost(r);
    broadcast(r);
  }
  if (!r.players.length) deleteRoom(r);
}

function deleteRoom(r) {
  clearTimeout(r.windowTimer);
  clearTimeout(r.takeoverTimer);
  clearTimeout(r.idleTimer);
  rooms.delete(r.code);
  pushRoomList();
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let me = null;
  let room = null;
  const fail = (msg) => send(ws, { t: 'error', msg });

  function attach(r, p) {
    if (p.ws && p.ws !== ws) { p.ws.__replaced = true; p.ws.close(); }
    clearTimeout(p.dropTimer);
    clearTimeout(r.idleTimer);
    p.ws = ws; p.online = true;
    me = p; room = r;
    send(ws, { t: 'joined', room: r.code, secret: p.secret, id: p.id });
    ensureHost(r);
    scheduleTakeover(r);
    broadcast(r);
  }

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hello') {
      ws.wantsList = true;
      return send(ws, { t: 'rooms', rooms: listRooms() });
    }

    if (m.t === 'create' || m.t === 'join') {
      if (me) return fail('อยู่ในห้องแล้ว');
      const name = cleanText(m.name, 20);
      const secret = typeof m.secret === 'string' ? m.secret.slice(0, 64) : '';
      let r;
      if (m.t === 'create') {
        if (!name) return fail('ใส่ชื่อก่อน');
        r = createRoom();
      } else {
        r = rooms.get(String(m.room || '').toUpperCase().trim());
        if (!r) return fail('ไม่พบห้องนี้ เช็กรหัสห้องอีกที');
      }
      const back = secret && r.players.find((p) => p.secret === secret);
      if (back) return attach(r, back);
      if (!name) return fail('ใส่ชื่อก่อน');
      if (r.players.length >= MAX_SEATS) return fail(`ห้องเต็มแล้ว (${MAX_SEATS} คน)`);
      if (r.players.some((p) => p.name === name)) return fail('ชื่อนี้มีคนใช้แล้วในห้อง');
      const p = { id: newId(), secret: secret || newId(), name, ws: null, online: false, offlineSince: 0, dropTimer: null, seat: inGame(r) ? 'watch' : 'player' };
      r.players.push(p);
      if (!r.hostId) r.hostId = p.id;
      return attach(r, p);
    }

    if (!me || !room) return;
    const r = room;
    const isHost = me.id === r.hostId;

    switch (m.t) {
      case 'start': {
        if (!isHost) return fail('หัวห้องเป็นคนเริ่มเกม');
        if (inGame(r)) return fail('เกมกำลังเล่นอยู่');
        if (r.players.length < MIN_PLAYERS) return fail(`ต้องมีอย่างน้อย ${MIN_PLAYERS} คน`);
        return startGame(r);
      }
      case 'act': {
        if (!r.game) return fail('ยังไม่เริ่มเกม');
        const before = r.game.pending;
        const res = G.act(r.game, me.id, m.action, r.rng);
        if (!res.ok) return fail(res.error);
        // "ไม่!" หรือเล่นการ์ดใหม่ เริ่มนับเวลาใหม่
        if (m.action.type === 'nope' || (m.action.type === 'play' && before !== r.game.pending)) r.windowEndsAt = 0;
        return afterChange(r, res.events);
      }
      case 'kick': {
        if (!isHost) return;
        const p = r.players.find((x) => x.id === m.id);
        if (!p || p === me) return;
        send(p.ws, { t: 'kicked' });
        if (p.ws) { p.ws.__replaced = true; p.ws.close(); }
        return removeFromRoom(r, p);
      }
      case 'leave': {
        const p = me;
        me = null; room = null;
        p.ws = null;
        return removeFromRoom(r, p);
      }
      default:
    }
  });

  ws.on('close', () => {
    if (ws.__replaced || !me || !room) return;
    const p = me; const r = room;
    if (p.ws !== ws) return;
    p.online = false;
    p.offlineSince = Date.now();
    p.ws = null;
    if (!inGame(r) || !r.game.players.some((x) => x.id === p.id)) {
      p.dropTimer = setTimeout(() => { if (!p.online && r.players.includes(p)) removeFromRoom(r, p); }, LOBBY_DROP_MS);
    }
    setTimeout(() => { ensureHost(r); broadcast(r); }, GRACE_MS + 10);
    if (!r.players.some((x) => x.online)) {
      r.idleTimer = setTimeout(() => { if (!r.players.some((x) => x.online)) deleteRoom(r); }, ROOM_IDLE_MS);
    }
    scheduleTakeover(r);
    broadcast(r);
  });
});

// ตัดการเชื่อมต่อที่ตายเงียบ
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  console.log(`จั่วผี พร้อมที่ http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
