// บอตสำหรับลองเล่น: node tools/bot.js <รหัสห้อง> [ชื่อ] [พอร์ต หรือที่อยู่เว็บ]
//   node tools/bot.js ABCD ผีบอต 3000
//   node tools/bot.js ABCD ผีบอต https://juaphi.laxezice.win
// เข้าห้องแล้วเล่นแบบสุ่มๆ (เล่นการ์ดบ้าง จั่วบ้าง กด "ไม่!" บ้าง)
const { WebSocket } = require('ws');

const [room, name = 'บอต' + Math.floor(Math.random() * 100), where = process.env.PORT || 3000] = process.argv.slice(2);
if (!room) { console.log('ใช้: node tools/bot.js <รหัสห้อง> [ชื่อ] [พอร์ต หรือที่อยู่เว็บ]'); process.exit(1); }

const url = /^https?:\/\//.test(String(where)) ? String(where).replace(/^http/, 'ws').replace(/\/$/, '') + '/ws' : `ws://localhost:${where}/ws`;
const ws = new WebSocket(url);
const send = (m) => ws.send(JSON.stringify(m));
const act = (action) => send({ t: 'act', action });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let state = null;
let busy = false;

ws.on('open', () => send({ t: 'join', room, name, secret: 'bot-' + name }));
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.t === 'error') console.log(name, 'error:', m.msg);
  if (m.t === 'state') { state = m; think(); }
});
ws.on('close', () => process.exit(0));

function think() {
  if (busy || !state || !state.game) return;
  busy = true;
  setTimeout(() => { busy = false; move(); }, 700 + Math.random() * 900);
}

function move() {
  const g = state && state.game;
  if (!g || g.winner || !g.me) return;
  const me = g.me;
  const you = state.you;
  const pd = g.pending;
  const others = g.players.filter((p) => p.id !== you && p.alive && p.handCount > 0);
  if (pd && pd.kind === 'window') {
    const nope = me.alive && pd.actor !== you && me.hand.find((c) => c.kind === 'nope');
    if (nope && Math.random() < 0.35) act({ type: 'nope', uid: nope.uid });
    return;
  }
  if (pd && pd.kind === 'insert' && pd.player === you) return act({ type: 'insert', index: Math.floor(Math.random() * (g.deckCount + 1)) });
  if (pd && pd.kind === 'give' && pd.from === you) return act({ type: 'give', uid: pick(me.hand).uid });
  if (pd) return;
  if (!me.alive) {
    if (me.grudge && others.length && Math.random() < 0.3) act({ type: 'grudge', target: pick(others).id });
    return;
  }
  if (g.current !== you) return;
  const singles = me.hand.filter((c) => ['sneak', 'curse', 'curse2', 'mirror', 'wind'].includes(c.kind) || (c.kind === 'beg' && others.length));
  if (singles.length && Math.random() < 0.4) {
    const c = pick(singles);
    return act({ type: 'play', uids: [c.uid], target: c.kind === 'beg' ? pick(others).id : undefined });
  }
  act({ type: 'draw' });
}
