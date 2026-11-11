// จั่วผี: กติกาทั้งหมด ไม่ยุ่งกับเครือข่ายหรือหน้าจอ
// ทุกการกระทำผ่าน act() ซึ่งคืน { ok, events } หรือ { ok:false, error }
// event มีส่วนสาธารณะ และ secret: { to: [...ids], ...ข้อมูลลับ } ที่เซิร์ฟเวอร์ส่งให้เฉพาะคนใน to

const { buildDeck } = require('./deck');

/** @param {string[]} playerIds ตามลำดับที่นั่ง */
function createGame(playerIds, rng) {
  const { hands, deck } = buildDeck(playerIds.length, rng);
  return {
    players: playerIds.map((id, i) => ({ id, hand: hands[i], alive: true, grudge: false })),
    deck,
    discard: [],
    current: playerIds[0],
    turnsLeft: 1,
    cursed: false,
    pending: null,
    winner: null,
  };
}

const fail = (error) => ({ ok: false, error });
const done = (events) => ({ ok: true, events });
const find = (g, id) => g.players.find((p) => p.id === id);
const alive = (g) => g.players.filter((p) => p.alive);

/** คนที่ยังรอดคนถัดไปตามลำดับที่นั่ง */
function nextAlive(g, fromId) {
  const i = g.players.findIndex((p) => p.id === fromId);
  for (let k = 1; k <= g.players.length; k++) {
    const p = g.players[(i + k) % g.players.length];
    if (p.alive) return p.id;
  }
  return null;
}

/** จบหนึ่งตา ถ้าหมดตาที่ต้องเล่น ส่งให้คนถัดไป */
function endTurn(g) {
  g.turnsLeft -= 1;
  if (g.turnsLeft <= 0) passTurn(g, nextAlive(g, g.current), 1, false);
}

function passTurn(g, to, turns, cursed) {
  g.current = to;
  g.turnsLeft = turns;
  g.cursed = cursed;
}

/** ถ้าเหลือคนรอดคนเดียว ตั้งผู้ชนะ */
function checkWinner(g, events) {
  const left = alive(g);
  if (left.length === 1 && !g.winner) {
    g.winner = left[0].id;
    g.pending = null;
    events.push({ type: 'win', player: g.winner });
  }
}

/** ตาย: มือลงกองทิ้ง ได้สิทธิ์อาฆาต */
function kill(g, p) {
  g.discard.push(...p.hand);
  p.hand = [];
  p.alive = false;
  p.grudge = true;
}

function doDraw(g, me) {
  if (g.current !== me.id) return fail('ยังไม่ถึงตาคุณ');
  if (g.pending) return fail('รอให้เรื่องตรงหน้าจบก่อน');
  const card = g.deck.shift();
  const events = [];
  if (card.kind !== 'ghost') {
    me.hand.push(card);
    events.push({ type: 'draw', player: me.id, secret: { to: [me.id], card } });
    endTurn(g);
    return done(events);
  }
  const ti = me.hand.findIndex((c) => c.kind === 'talisman');
  if (ti >= 0) {
    g.discard.push(me.hand.splice(ti, 1)[0]);
    g.pending = { kind: 'insert', player: me.id, ghost: card };
    events.push({ type: 'ghost', player: me.id, saved: true });
    return done(events);
  }
  kill(g, me);
  g.discard.push(card);
  events.push({ type: 'ghost', player: me.id, saved: false });
  checkWinner(g, events);
  if (!g.winner) passTurn(g, nextAlive(g, me.id), 1, false);
  return done(events);
}

function doInsert(g, me, index) {
  const pd = g.pending;
  if (!pd || pd.kind !== 'insert' || pd.player !== me.id) return fail('ตอนนี้ไม่ได้ต้องเสียบผีกลับ');
  if (!Number.isInteger(index) || index < 0 || index > g.deck.length) return fail('ตำแหน่งไม่ถูกต้อง');
  g.deck.splice(index, 0, pd.ghost);
  g.pending = null;
  endTurn(g);
  return done([{ type: 'insert', player: me.id }]);
}

/** @returns {{ok:true, events:object[]} | {ok:false, error:string}} */
function act(g, playerId, action, rng) {
  if (!action || typeof action.type !== 'string') return fail('คำสั่งไม่ถูกต้อง');
  if (g.winner) return fail('เกมจบแล้ว');
  const me = find(g, playerId);
  if (!me) return fail('คุณไม่ได้อยู่ในเกมนี้');
  switch (action.type) {
    case 'draw':
      if (!me.alive) return fail('คุณตกรอบแล้ว');
      return doDraw(g, me);
    case 'insert':
      return doInsert(g, me, action.index);
    default:
      return fail('คำสั่งไม่ถูกต้อง');
  }
}

module.exports = { createGame, act, nextAlive };
