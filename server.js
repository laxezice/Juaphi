// จั่วผี: เซิร์ฟเวอร์ห้องเกม เสิร์ฟหน้าเว็บจาก public/ และคุยกับผู้เล่นผ่าน WebSocket ที่ /ws
// สถานะทั้งหมดอยู่ในหน่วยความจำ รีสตาร์ตแล้วห้องหาย กติกาอยู่ใน game/
// แต่ละเครื่องได้รับเฉพาะสิ่งที่ viewFor() คืนให้ กับส่วนลับของอีเวนต์ที่ส่งถึงตัวเอง

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const G = require('./game/game');
const { summarizeRooms, startAdminSocket } = require('./admin');
const { viewFor } = require('./game/view');
const { makeRng } = require('./game/deck');
const { botMove } = require('./game/bot');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');
const MIN_PLAYERS = 2;
const MAX_SEATS = 8;                                         // รวมคนดู
const NOPE_MS = Number(process.env.JUAPHI_NOPE_MS) || 2500;  // เวลากด "ไม่!"
const GRACE_MS = Number(process.env.JUAPHI_GRACE_MS) || 15000; // หลุดเกินเท่านี้ ระบบทำแทน / ย้ายหัวห้อง
const SEED = process.env.JUAPHI_SEED ? Number(process.env.JUAPHI_SEED) : null; // ใช้ในเทสต์เท่านั้น
const LOBBY_DROP_MS = 60 * 1000;      // หลุดตอนไม่ได้เล่นอยู่นานเท่านี้ ตัดชื่อออก
const ROOM_IDLE_MS = 30 * 60 * 1000;  // ไม่มีใครออนไลน์นานเท่านี้ ลบห้อง
const VERSION = Date.now().toString(36);  // เปลี่ยนทุกครั้งที่เซิร์ฟเวอร์เริ่ม (deploy) ใช้ต่อท้าย URL ของโค้ดหน้าเว็บ
const BOT_MS = Number(process.env.JUAPHI_BOT_MS) || 900;      // บอตคิดนาน BOT_MS ถึง 2×BOT_MS ก่อนทำอะไร
const BOT_NAMES = ['บอตปอบ', 'บอตกระสือ', 'บอตกระหัง', 'บอตตานี', 'บอตกุมาร', 'บอตเปรต', 'บอตโขมด'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- HTTP ----------
function serveFile(res, file) {
  const notFound = () => { res.writeHead(404); res.end('not found'); };
  try {
    fs.readFile(file, (err, data) => {
      if (err) return notFound();
      const ext = path.extname(file);
      // หน้าเว็บกับโค้ด: ให้เบราว์เซอร์ถามใหม่ทุกครั้ง (deploy แล้วได้ของใหม่ทันที) ส่วนภาพกับเสียงเก็บไว้ได้
      const cache = ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400';
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache });
      res.end(data);
    });
  } catch {
    notFound();
  }
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = '/'; }
  if (p.includes('\0')) { res.writeHead(400); return res.end(); }
  if (p === '/' || p === '/index.html') {
    // ใส่เลขรุ่นลงใน URL ของโค้ด (Cloudflare ให้เบราว์เซอร์เก็บ .js ไว้ 4 ชม. ทับ Cache-Control ของเรา)
    return fs.readFile(path.join(PUBLIC, 'index.html'), 'utf8', (err, html) => {
      if (err) { res.writeHead(500); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
      res.end(html.replaceAll('__V__', VERSION));
    });
  }
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (p === '/api/art') {
    // ไฟล์ภาพการ์ดที่มีอยู่จริงใน public/cards (.webp หรือ .png) หน้าเว็บจะได้ไม่ต้องลองโหลดไฟล์ที่ไม่มี
    let names = [];
    try { names = fs.readdirSync(path.join(PUBLIC, 'cards')).filter((f) => /\.(webp|png)$/.test(f)); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(names));
  }
  if (p === '/api/sounds') {
    // ไฟล์เสียงที่มีอยู่ใน public/sounds (ไม่มีไฟล์ไหน หน้าเว็บใช้เสียงสังเคราะห์แทน)
    let names = [];
    try { names = fs.readdirSync(path.join(PUBLIC, 'sounds')).filter((f) => /\.(ogg|mp3|wav)$/.test(f)); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(names));
  }
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
    code: newCode(), hostId: null, players: [], names: {}, game: null, rng: null, extras: true,   // ห้องใหม่เปิดการ์ดเสริมไว้ก่อน
    windowTimer: null, windowEndsAt: 0, takeoverTimer: null, takeoverFor: null, idleTimer: null,
  };
  rooms.set(r.code, r);
  return r;
}

/** มีคนจริง (ไม่ใช่บอต) ออนไลน์อยู่ในห้องไหม */
const humanOnline = (r) => r.players.some((p) => p.online && !p.bot);
const hostName = (r) => r.players.find((p) => p.id === r.hostId)?.name || '';
const inGame = (r) => !!r.game && !r.game.winner;

function listRooms() {
  const out = [];
  for (const r of rooms.values()) {
    if (!humanOnline(r)) continue;
    out.push({ code: r.code, name: `ห้องของ ${hostName(r)}`, players: r.players.length, max: MAX_SEATS, status: inGame(r) ? 'play' : 'lobby', extras: r.extras });
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
    seq: r.seq,
    you: p.id,
    room: {
      code: r.code,
      name: `ห้องของ ${hostName(r)}`,
      hostId: r.hostId,
      extras: r.extras,   // ตัวเลือกห้อง: ใส่การ์ดเสริมในเกมถัดไป
      players: r.players.map((x) => ({ id: x.id, name: x.name, online: x.online, seat: x.seat, bot: !!x.bot })),
      names: r.names,
    },
    game: r.game ? viewFor(r.game, seatedInGame ? p.id : null) : null,
    windowLeftMs: r.game && r.game.pending && r.game.pending.kind === 'window' ? Math.max(0, r.windowEndsAt - Date.now()) : 0,
  };
}

function broadcast(r) {
  r.seq = (r.seq || 0) + 1;   // ทุกสถานะมีเลขลำดับ คำสั่งที่อ้างเลขเก่า (กดซ้ำ) จะถูกปัดทิ้ง
  r.lastActive = Date.now();  // ไว้บอกว่าห้องเงียบมากี่นาที (admin.js)
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
  // หัวห้องต้องเป็นคนจริงเสมอ
  const next = r.players.find((p) => p.online && !p.bot) || r.players.find((p) => !p.bot);
  r.hostId = next ? next.id : null;
}

// ---------- เกม ----------
function afterChange(r, events) {
  if (events && events.length) deliver(r, events);
  const g = r.game;
  if (g && g.winner) for (const p of r.players) if (!p.online) armDrop(r, p);
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
  scheduleBots(r);
  broadcast(r);
}

/** ทำคำสั่งของผู้เล่นหรือบอต คืนข้อความผิดพลาด หรือ null ถ้าสำเร็จ */
function runAct(r, p, action) {
  const before = r.game.pending;
  const res = G.act(r.game, p.id, action, r.rng);
  if (!res.ok) return res.error;
  // "ไม่!" หรือเล่นการ์ดใหม่ เริ่มนับเวลาใหม่
  if (action.type === 'nope' || (action.type === 'play' && before !== r.game.pending)) r.windowEndsAt = 0;
  afterChange(r, res.events);
  return null;
}

/** ให้บอตที่มีเรื่องต้องทำ คิดสักครู่แล้วทำ หยุดทั้งหมดถ้าไม่มีคนจริงออนไลน์ */
function scheduleBots(r) {
  const g = r.game;
  for (const p of r.players) {
    if (!p.bot || p.botTimer) continue;
    if (!g || g.winner || !humanOnline(r) || !g.players.some((x) => x.id === p.id)) continue;
    if (!botMove(viewFor(g, p.id), p.id, Math.random, p.memo)) continue;
    p.botTimer = setTimeout(() => {
      p.botTimer = null;
      if (r.game !== g || !r.players.includes(p) || !humanOnline(r)) return;
      const move = botMove(viewFor(g, p.id), p.id, Math.random, p.memo);
      if (!move || runAct(r, p, move)) scheduleBots(r);
    }, BOT_MS + Math.random() * BOT_MS);
  }
}

/** ถ้าคนที่เกมรออยู่หลุด รอ GRACE_MS (นับจากตอนที่เริ่มรอเขา) แล้วทำแทน
 *  ถ้าไม่มีใครในเกมออนไลน์เลย หยุดรอไว้ก่อน เกมจะได้ไม่เล่นตัวเองจนจบ */
function scheduleTakeover(r) {
  const g = r.game;
  const id = g ? G.waitingOn(g) : null;
  const p = id && r.players.find((x) => x.id === id);
  const offline = !p || !p.online;
  const anyoneHere = g && g.players.some((gp) => r.players.some((x) => x.id === gp.id && x.online && !x.bot));
  if (!id || !offline || !anyoneHere) {
    clearTimeout(r.takeoverTimer);
    r.takeoverTimer = null;
    r.takeoverFor = null;
    return;
  }
  const key = `${id}:${g.pending ? g.pending.kind : 'turn'}:${g.turnsLeft}:${g.deck.length}`;
  if (r.takeoverFor === key) return;
  clearTimeout(r.takeoverTimer);
  r.takeoverFor = key;
  const since = Date.now();   // เริ่มนับจากตอนที่เริ่มรอคนนี้ ไม่ใช่ตอนที่เขาหลุด
  r.takeoverTimer = setTimeout(() => {
    r.takeoverTimer = null;
    r.takeoverFor = null;
    if (r.game !== g || G.waitingOn(g) !== id) return scheduleTakeover(r);
    const res = G.autoAct(g, r.rng);
    afterChange(r, res.ok ? res.events : []);
  }, Math.max(0, since + GRACE_MS - Date.now()));
}

function armDrop(r, p) {
  if (p.dropTimer) return;
  p.dropTimer = setTimeout(() => { p.dropTimer = null; if (!p.online && r.players.includes(p)) removeFromRoom(r, p); }, LOBBY_DROP_MS);
}

function startGame(r) {
  // แจกเฉพาะคนที่ออนไลน์ คนที่หลุดอยู่ได้ดูก่อนแล้วเล่นเกมถัดไป
  const seated = r.players.filter((p) => p.online).slice(0, MAX_SEATS);
  for (const p of r.players) p.seat = seated.includes(p) ? 'player' : 'watch';
  for (const p of seated) { clearTimeout(p.dropTimer); p.dropTimer = null; r.names[p.id] = p.name; if (p.bot) p.memo = {}; }
  r.rng = SEED != null ? makeRng(SEED) : Math.random;
  // คนเริ่ม: คนที่ตกรอบคนแรกในเกมก่อน ถ้าไม่มี (เกมแรกของห้อง หรือคนนั้นไม่ได้เล่นรอบนี้) สุ่ม
  // ตอนเทสต์ (JUAPHI_SEED) ให้ที่นั่งแรกเริ่มเสมอ ผลจะได้ตายตัว
  const ids = seated.map((p) => p.id);
  const prev = r.game && r.game.firstOut;
  const fromPrev = !!prev && ids.includes(prev);
  const first = fromPrev ? prev : ids[SEED != null ? 0 : Math.floor(Math.random() * ids.length)];
  r.game = G.createGame(ids, r.rng, { extras: r.extras, first });
  r.windowEndsAt = 0;
  afterChange(r, [{ type: 'start', player: first, reason: fromPrev ? 'firstOut' : 'random' }]);
}

function removeFromRoom(r, p) {
  clearTimeout(p.dropTimer);
  clearTimeout(p.botTimer);
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
  // เหลือแต่บอต ปิดห้อง
  if (!r.players.some((x) => !x.bot)) deleteRoom(r);
}

function deleteRoom(r) {
  for (const p of r.players) clearTimeout(p.botTimer);
  clearTimeout(r.windowTimer);
  clearTimeout(r.takeoverTimer);
  clearTimeout(r.idleTimer);
  rooms.delete(r.code);
  pushRoomList();
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});   // เฟรมเสียหรือใหญ่เกิน ปิดแค่ socket นี้ ไม่ให้เซิร์ฟเวอร์ล่ม
  let me = null;
  let room = null;
  const fail = (msg, code) => send(ws, code ? { t: 'error', msg, code } : { t: 'error', msg });

  function attach(r, p) {
    if (p.ws && p.ws !== ws) {
      send(p.ws, { t: 'replaced' });   // เปิดที่นั่งเดียวกันจากแท็บอื่น แท็บเก่าหยุดต่อใหม่เอง
      p.ws.__replaced = true;
      p.ws.close();
    }
    clearTimeout(p.dropTimer);
    p.dropTimer = null;
    clearTimeout(r.idleTimer);
    p.ws = ws; p.online = true;
    me = p; room = r;
    send(ws, { t: 'joined', room: r.code, secret: p.secret, id: p.id });
    ensureHost(r);
    scheduleTakeover(r);
    scheduleBots(r);
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
        if (!r) return fail('ไม่พบห้องนี้ เช็กรหัสห้องอีกที', 'no-room');
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

    if (!me || !room) return fail('คุณไม่ได้อยู่ในห้องแล้ว', 'no-room');
    const r = room;
    const isHost = me.id === r.hostId;

    switch (m.t) {
      case 'start': {
        if (!isHost) return fail('หัวห้องเป็นคนเริ่มเกม');
        if (inGame(r)) return fail('เกมกำลังเล่นอยู่');
        if (r.players.filter((p) => p.online).length < MIN_PLAYERS) return fail(`ต้องมีคนออนไลน์อย่างน้อย ${MIN_PLAYERS} คน`);
        return startGame(r);
      }
      case 'act': {
        if (!r.game) return fail('ยังไม่เริ่มเกม');
        // จั่วหรือ "ไม่!" ที่อ้างสถานะเก่า = กดซ้ำ ปัดทิ้งเงียบๆ
        const type = m.action && m.action.type;
        if ((type === 'draw' || type === 'nope') && typeof m.seq === 'number' && m.seq !== r.seq) return fail('', 'stale');
        const err = runAct(r, me, m.action);
        return err ? fail(err) : undefined;
      }
      case 'options': {
        // ตัวเลือกห้อง เปลี่ยนได้ตอนไม่มีเกมกำลังเล่น มีผลกับเกมถัดไป
        if (!isHost) return fail('หัวห้องเป็นคนตั้งค่าห้อง');
        if (inGame(r)) return fail('เปลี่ยนได้หลังจบเกม');
        if (typeof m.extras === 'boolean') r.extras = m.extras;
        return broadcast(r);
      }
      case 'addBot': {
        if (!isHost) return fail('หัวห้องเป็นคนเพิ่มบอต');
        if (r.players.length >= MAX_SEATS) return fail(`ห้องเต็มแล้ว (${MAX_SEATS} คน)`);
        const used = new Set(r.players.map((p) => p.name));
        const name = BOT_NAMES.find((n) => !used.has(n)) || `บอต${r.players.length + 1}`;
        r.players.push({
          id: newId(), secret: null, name, bot: true, ws: null, online: true, offlineSince: 0,
          dropTimer: null, botTimer: null, memo: {}, seat: inGame(r) ? 'watch' : 'player',
        });
        return broadcast(r);
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
    if (!inGame(r) || !r.game.players.some((x) => x.id === p.id)) armDrop(r, p);
    setTimeout(() => { ensureHost(r); broadcast(r); }, GRACE_MS + 10);
    if (!humanOnline(r)) {
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
  startAdminSocket(() => summarizeRooms(rooms));
});
