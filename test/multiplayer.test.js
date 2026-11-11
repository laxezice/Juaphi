// Task 5: เซิร์ฟเวอร์ ห้อง รายการห้อง ตัวจับเวลา และข้อมูลลับ
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomInt } = require('node:crypto');
const path = require('node:path');
const { WebSocket } = require('ws');
const { createGame } = require('../game/game');
const { makeRng } = require('../game/deck');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer(t, env = {}) {
  const port = randomInt(33000, 49000);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const clients = [];
  t.after(() => { clients.forEach((c) => c.ws.terminate()); server.kill(); });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Server exited: ${code}`)));
  });
  async function client(name) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const c = { name, ws, msgs: [], state: null, rooms: null, id: null, room: null, secret: 'sec-' + name, errors: [] };
    c.send = (m) => ws.send(JSON.stringify(m));
    ws.on('message', (data) => {
      const m = JSON.parse(data);
      c.msgs.push({ raw: String(data), m });
      if (m.t === 'state') c.state = m;
      if (m.t === 'rooms') c.rooms = m.rooms;
      if (m.t === 'joined') { c.id = m.id; c.room = m.room; }
      if (m.t === 'error') c.errors.push(m.msg);
    });
    await new Promise((r) => ws.once('open', r));
    c.send({ t: 'hello' });
    clients.push(c);
    return c;
  }
  return { port, client };
}

async function waitFor(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await sleep(15);
  }
  throw new Error('timed out');
}

async function setupRoom(srv, names) {
  const [host, ...rest] = await Promise.all(names.map((n) => srv.client(n)));
  host.send({ t: 'create', name: host.name, secret: host.secret });
  await waitFor(() => host.room);
  for (const c of rest) {
    c.send({ t: 'join', room: host.room, name: c.name, secret: c.secret });
    await waitFor(() => c.room);
  }
  await waitFor(() => host.state && host.state.room.players.length === names.length);
  return [host, ...rest];
}

// ---------- จากการรีวิว ----------

test('a path with a null byte does not crash the server', async (t) => {
  const srv = await startServer(t);
  const r = await fetch(`http://127.0.0.1:${srv.port}/%00`);
  assert.notEqual(r.status, 200);
  await sleep(100);
  assert.equal((await fetch(`http://127.0.0.1:${srv.port}/healthz`)).status, 200);
});

test('an oversized websocket message does not crash the server', async (t) => {
  const srv = await startServer(t);
  const c = await srv.client('A');
  c.ws.on('error', () => {});
  c.ws.send('x'.repeat(64 * 1024));
  await new Promise((r) => c.ws.once('close', r));
  await sleep(100);
  assert.equal((await fetch(`http://127.0.0.1:${srv.port}/healthz`)).status, 200);
});

test('a second draw sent with a stale seq is ignored (double-tap while cursed)', async (t) => {
  let seed = 1;
  for (; seed < 500; seed++) {
    const g = createGame(['x', 'y', 'z'], makeRng(seed));
    if (g.players[0].hand.some((c) => c.kind === 'curse') && g.deck[0].kind !== 'ghost' && g.deck[1].kind !== 'ghost') break;
  }
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30', JUAPHI_SEED: String(seed) });
  const [a, b] = await setupRoom(srv, ['A', 'B', 'C']);
  void createGame;
  a.send({ t: 'start' });
  await waitFor(() => a.state.game);
  const curse = a.state.game.me.hand.find((c) => c.kind === 'curse');
  a.send({ t: 'act', seq: a.state.seq, action: { type: 'play', uids: [curse.uid] } });
  await waitFor(() => b.state.game.current === b.id && b.state.game.turnsLeft === 2 && !b.state.game.pending);
  const seq = b.state.seq;
  const before = b.state.game.me.hand.length;
  b.send({ t: 'act', seq, action: { type: 'draw' } });
  b.send({ t: 'act', seq, action: { type: 'draw' } });
  await sleep(300);
  const g = b.state.game;
  assert.equal(g.me.hand.length, before + 1, 'only one draw should happen');
  assert.equal(g.current, b.id);
  assert.equal(g.turnsLeft, 1);
});

test('each takeover waits a full grace period, even for players offline a long time', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30', JUAPHI_GRACE_MS: '400' });
  const [a, b, c] = await setupRoom(srv, ['A', 'B', 'C']);
  a.send({ t: 'start' });
  await waitFor(() => a.state.game);
  b.ws.close(); c.ws.close();
  await sleep(600); // B, C หลุดนานกว่า grace แล้ว
  const draws = () => a.msgs.filter(({ m }) => m.t === 'event' && (m.e.type === 'draw' || m.e.type === 'ghost')).length;
  const n0 = draws();
  a.send({ t: 'act', seq: a.state.seq, action: { type: 'draw' } });
  await waitFor(() => draws() > n0);
  await sleep(250);
  assert.equal(draws(), n0 + 1, 'B must not be auto-played before a full grace period');
  await waitFor(() => draws() > n0 + 1, 2000);
});

test('nobody online in the game: the game pauses instead of playing itself', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30', JUAPHI_GRACE_MS: '150' });
  const [a, b] = await setupRoom(srv, ['A', 'B']);
  a.send({ t: 'start' });
  await waitFor(() => a.state.game);
  const deck = a.state.game.deckCount;
  const code = a.room;
  a.ws.close(); b.ws.close();
  await sleep(800);
  const a2 = await srv.client('A');
  a2.send({ t: 'join', room: code, name: 'A', secret: a.secret });
  await waitFor(() => a2.state && a2.state.game);
  assert.equal(a2.state.game.deckCount, deck);
});

test('starting a game seats only players who are online', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30' });
  const [a, b, c] = await setupRoom(srv, ['A', 'B', 'C']);
  c.ws.close();
  await waitFor(() => a.state.room.players.find((p) => p.id === c.id).online === false);
  a.send({ t: 'start' });
  await waitFor(() => a.state.game);
  assert.equal(a.state.game.players.length, 2);
  assert.ok(!a.state.game.players.some((p) => p.id === c.id));
  void b;
});

test('joining a room that no longer exists, or acting outside a room, gets a no-room error', async (t) => {
  const srv = await startServer(t);
  const c = await srv.client('A');
  c.send({ t: 'act', action: { type: 'draw' } });
  c.send({ t: 'join', room: 'ZZZZ', name: 'A', secret: c.secret });
  await waitFor(() => c.msgs.filter(({ m }) => m.t === 'error').length >= 2);
  const errs = c.msgs.filter(({ m }) => m.t === 'error').map(({ m }) => m.code);
  assert.deepEqual(errs, ['no-room', 'no-room']);
});

test('opening the same seat in another tab tells the old tab it was replaced', async (t) => {
  const srv = await startServer(t);
  const [a] = await setupRoom(srv, ['A', 'B']);
  const a2 = await srv.client('A');
  a2.send({ t: 'join', room: a.room, name: 'A', secret: a.secret });
  await waitFor(() => a.msgs.some(({ m }) => m.t === 'replaced'));
});

test('/api/art lists the card images that exist, and three.js is served', async (t) => {
  const srv = await startServer(t);
  const fs = require('node:fs');
  const file = path.join(__dirname, '..', 'public', 'cards', 'zz-test.png');
  fs.writeFileSync(file, 'x');
  t.after(() => fs.rmSync(file, { force: true }));
  const art = await (await fetch(`http://127.0.0.1:${srv.port}/api/art`)).json();
  assert.ok(Array.isArray(art));
  assert.ok(art.includes('zz-test'));
  const three = await fetch(`http://127.0.0.1:${srv.port}/vendor/three.module.js`);
  assert.equal(three.status, 200);
  const evil = await fetch(`http://127.0.0.1:${srv.port}/..%2fpackage.json`);
  assert.notEqual(evil.status, 200);
});

test('room list shows open rooms live, and a started game deals private hands', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '50' });
  const a = await srv.client('A');
  const b = await srv.client('B');
  await waitFor(() => b.rooms);
  assert.deepEqual(b.rooms, []);
  a.send({ t: 'create', name: 'A', secret: a.secret });
  await waitFor(() => b.rooms && b.rooms.length === 1);
  assert.equal(b.rooms[0].code, a.room);
  assert.equal(b.rooms[0].name, 'ห้องของ A');
  assert.equal(b.rooms[0].players, 1);
  assert.equal(b.rooms[0].max, 8);
  assert.equal(b.rooms[0].status, 'lobby');

  b.send({ t: 'join', room: a.room, name: 'B', secret: b.secret });
  await waitFor(() => a.state && a.state.room.players.length === 2);
  b.send({ t: 'start' });
  await sleep(100);
  assert.equal(a.state.game, null, 'only the host may start');
  a.send({ t: 'start' });
  await waitFor(() => a.state.game && b.state.game);
  assert.equal(a.state.game.me.hand.length, 8);
  assert.equal(b.state.game.me.hand.length, 8);
  const aUids = a.state.game.me.hand.map((c) => c.uid);
  for (const u of aUids) assert.ok(!b.msgs.some((x) => x.raw.includes(`"${u}"`)), 'A hand leaked to B');
  await waitFor(() => b.rooms[0].status === 'play');
});

test('a scripted 3-player game never leaks secrets to the wrong player', { timeout: 30000 }, async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30', JUAPHI_SEED: '7' });
  const ps = await setupRoom(srv, ['A', 'B', 'C']);
  ps[0].send({ t: 'start' });
  await waitFor(() => ps.every((p) => p.state.game));

  const used = new Set();
  const step = (p) => {
    const g = p.state.game;
    if (!g || g.winner) return;
    const hand = g.me.hand;
    const pd = g.pending;
    if (pd && pd.kind === 'window') return;
    if (pd && pd.kind === 'insert') { if (pd.player === p.id) p.send({ t: 'act', action: { type: 'insert', index: 0 } }); return; }
    if (pd && pd.kind === 'give') { if (pd.from === p.id) p.send({ t: 'act', action: { type: 'give', uid: hand[0].uid } }); return; }
    if (!g.me.alive) {
      if (g.me.grudge) {
        const t2 = g.players.find((x) => x.alive && x.handCount > 0);
        if (t2) p.send({ t: 'act', action: { type: 'grudge', target: t2.id } });
      }
      return;
    }
    if (g.current !== p.id) return;
    const other = g.players.find((x) => x.id !== p.id && x.alive && x.handCount > 0);
    const pick = (k) => hand.find((c) => c.kind === k && !used.has(c.uid));
    const mirror = pick('mirror');
    const beg = pick('beg');
    const pair = ['imp1', 'imp2', 'imp3', 'imp4', 'imp5'].map((k) => hand.filter((c) => c.kind === k)).find((h) => h.length >= 2);
    let action = { type: 'draw' };
    if (mirror) action = { type: 'play', uids: [mirror.uid] };
    else if (beg && other) action = { type: 'play', uids: [beg.uid], target: other.id };
    else if (pair && other) action = { type: 'play', uids: [pair[0].uid, pair[1].uid], target: other.id };
    if (action.uids) action.uids.forEach((u) => used.add(u));
    p.send({ t: 'act', action });
  };
  const end = Date.now() + 20000;
  while (Date.now() < end && !ps[0].state.game.winner) {
    ps.forEach(step);
    await sleep(40);
  }
  assert.ok(ps[0].state.game.winner, 'game should finish');

  // การ์ดที่ทุกคนรู้ได้: เคยขึ้นกองทิ้ง หรือถูกเปิดในอีเวนต์สาธารณะ
  const pub = new Set();
  for (const p of ps) for (const { m } of p.msgs) {
    if (m.t === 'state' && m.game && m.game.discardTop) pub.add(m.game.discardTop.uid);
    if (m.t === 'event' && m.e.type === 'grudge') pub.add(m.e.card.uid);
  }
  let sawMirror = false;
  for (const p of ps) {
    const own = new Set();
    for (const { raw, m } of p.msgs) {
      if (m.t === 'state' && m.game && m.game.me) m.game.me.hand.forEach((c) => own.add(c.uid));
      if (m.t === 'event') {
        assert.equal(m.e.secret, undefined, 'raw secret object must never be sent');
        if (m.e.type === 'insert') assert.equal(m.e.index, undefined);
        if (m.e.type === 'mirror' && m.e.player === p.id) { sawMirror = true; m.e.cards.forEach((c) => own.add(c.uid)); }
        if (m.e.type === 'mirror' && m.e.player !== p.id) assert.equal(m.e.cards, undefined);
        if (m.e.card && (m.e.type === 'draw' || m.e.type === 'give' || m.e.type === 'steal')) own.add(m.e.card.uid);
      }
      assert.ok(!/"deck"\s*:/.test(raw), 'deck array sent');
      for (const u of raw.match(/"c\d+"/g) || []) {
        const uid = u.slice(1, -1);
        assert.ok(own.has(uid) || pub.has(uid), `${p.name} saw a card it should not know: ${uid} in ${raw.slice(0, 200)}`);
      }
    }
  }
  assert.ok(sawMirror, 'the script should have played a mirror (seed 7)');
});

test('No! during the window cancels the play', async (t) => {
  // หา seed ที่คนแรกมีย่องหนี และคนที่สองมี "ไม่!"
  let seed = 1;
  for (; seed < 500; seed++) {
    const g = createGame(['x', 'y'], makeRng(seed));
    if (g.players[0].hand.some((c) => c.kind === 'sneak') && g.players[1].hand.some((c) => c.kind === 'nope')) break;
  }
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '600', JUAPHI_SEED: String(seed) });
  const [a, b] = await setupRoom(srv, ['A', 'B']);
  a.send({ t: 'start' });
  await waitFor(() => a.state.game && b.state.game);
  const sneak = a.state.game.me.hand.find((c) => c.kind === 'sneak');
  a.send({ t: 'act', action: { type: 'play', uids: [sneak.uid] } });
  await waitFor(() => b.state.game.pending && b.state.game.pending.kind === 'window');
  assert.ok(b.state.windowLeftMs > 0 && b.state.windowLeftMs <= 600);
  const nope = b.state.game.me.hand.find((c) => c.kind === 'nope');
  b.send({ t: 'act', action: { type: 'nope', uid: nope.uid } });
  await waitFor(() => a.state.game.pending && a.state.game.pending.nopeCount === 1);
  await waitFor(() => a.state.game.pending === null, 2000);
  assert.equal(a.state.game.current, a.id, 'sneak was cancelled, still A');
  assert.ok(a.msgs.some(({ m }) => m.t === 'event' && m.e.type === 'resolve' && m.e.cancelled === true));
});

test('the game plays for a disconnected current player after the grace time', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30', JUAPHI_GRACE_MS: '300' });
  const [a, b, c] = await setupRoom(srv, ['A', 'B', 'C']);
  a.send({ t: 'start' });
  await waitFor(() => b.state.game);
  assert.equal(b.state.game.current, a.id);
  a.ws.close();
  await waitFor(() => b.state.room.players.find((p) => p.id === a.id).online === false);
  await waitFor(() => b.state.game.current !== a.id || b.state.game.pending, 3000);
  assert.ok(b.state.game.deckCount < 40 || b.state.game.pending);
  void c;
});

test('a player reconnecting with the same secret gets the same hand back', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30' });
  const [a, b] = await setupRoom(srv, ['A', 'B']);
  a.send({ t: 'start' });
  await waitFor(() => b.state.game);
  const hand = b.state.game.me.hand.map((x) => x.uid).sort();
  b.ws.close();
  const b2 = await srv.client('B');
  b2.secret = b.secret;
  b2.send({ t: 'join', room: a.room, name: 'B', secret: b.secret });
  await waitFor(() => b2.state && b2.state.game);
  assert.deepEqual(b2.state.game.me.hand.map((x) => x.uid).sort(), hand);
  assert.equal(b2.id, b.id);
});

test('someone joining a game in progress watches and sees no hand', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30' });
  const [a] = await setupRoom(srv, ['A', 'B']);
  a.send({ t: 'start' });
  await waitFor(() => a.state.game);
  const d = await srv.client('D');
  d.send({ t: 'join', room: a.room, name: 'D', secret: d.secret });
  await waitFor(() => d.state && d.state.game);
  assert.equal(d.state.room.players.find((p) => p.id === d.id).seat, 'watch');
  assert.equal(d.state.game.me, undefined);
  assert.equal(d.state.game.players.length, 2);
});

test('a room accepts at most 8 people including watchers', async (t) => {
  const srv = await startServer(t);
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const ps = await setupRoom(srv, names);
  const x = await srv.client('X');
  x.send({ t: 'join', room: ps[0].room, name: 'X', secret: x.secret });
  await waitFor(() => x.errors.length);
  assert.match(x.errors[0], /เต็ม/);
});

test('leaving mid-game removes the player and the game continues', async (t) => {
  const srv = await startServer(t, { JUAPHI_NOPE_MS: '30' });
  const [a, b, c] = await setupRoom(srv, ['A', 'B', 'C']);
  a.send({ t: 'start' });
  await waitFor(() => b.state.game);
  a.send({ t: 'leave' });
  await waitFor(() => b.state.game.players.find((p) => p.id === a.id).alive === false);
  assert.equal(b.state.game.current, b.id);
  assert.ok(!b.state.room.players.some((p) => p.id === a.id));
  void c;
});
