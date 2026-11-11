// จั่วผี: กติกาทั้งหมด ไม่ยุ่งกับเครือข่ายหรือหน้าจอ
// ทุกการกระทำผ่าน act() ซึ่งคืน { ok, events } หรือ { ok:false, error }
// event มีส่วนสาธารณะ และ secret: { to: [...ids], ...ข้อมูลลับ } ที่เซิร์ฟเวอร์ส่งให้เฉพาะคนใน to

const { buildDeck, shuffle } = require('./deck');

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

const SINGLE = new Set(['sneak', 'curse', 'curse2', 'mirror', 'wind', 'beg']);
const IMPS = new Set(['imp1', 'imp2', 'imp3', 'imp4', 'imp5']);
const ALL_KINDS = new Set(['ghost', 'talisman', 'nope', ...SINGLE, ...IMPS]);
const randomIndex = (n, rng) => Math.floor(rng() * n);

/** ตรวจว่าการ์ดชุดนี้เล่นได้ไหม คืนข้อความผิดพลาด หรือ null ถ้าเล่นได้ */
function checkPlay(g, me, cards, target, name) {
  const k = cards[0].kind;
  const needTarget = () => {
    const t = find(g, target);
    if (!t || t.id === me.id) return 'เลือกเพื่อนที่จะเล่นด้วย';
    if (!t.alive) return 'คนนี้ตกรอบไปแล้ว';
    if (!t.hand.length) return 'คนนี้ไม่มีการ์ดในมือ';
    return null;
  };
  if (cards.length === 1 && SINGLE.has(k)) return k === 'beg' ? needTarget() : null;
  if (IMPS.has(k) && (cards.length === 2 || cards.length === 3) && cards.every((c) => c.kind === k)) {
    if (cards.length === 3 && !ALL_KINDS.has(name)) return 'ระบุชื่อการ์ดที่ต้องการ';
    return needTarget();
  }
  if (cards.length === 1 && IMPS.has(k)) return 'ผีน้อยต้องเล่นเป็นคู่หรือสามใบแบบเดียวกัน';
  if (cards.length === 1) return 'การ์ดใบนี้เล่นเองไม่ได้';
  return 'เล่นการ์ดชุดนี้ด้วยกันไม่ได้';
}

function doPlay(g, me, action) {
  if (g.current !== me.id) return fail('ยังไม่ถึงตาคุณ');
  if (g.pending) return fail('รอให้เรื่องตรงหน้าจบก่อน');
  const uids = action.uids;
  if (!Array.isArray(uids) || !uids.length || new Set(uids).size !== uids.length) return fail('เลือกการ์ดใหม่');
  const cards = uids.map((u) => me.hand.find((c) => c.uid === u));
  if (cards.some((c) => !c)) return fail('ไม่มีการ์ดใบนี้ในมือ');
  const target = typeof action.target === 'string' ? action.target : null;
  const name = cards.length === 3 ? action.name : undefined;
  const err = checkPlay(g, me, cards, target, name);
  if (err) return fail(err);
  me.hand = me.hand.filter((c) => !uids.includes(c.uid));
  g.discard.push(...cards);
  const play = { cards, target };
  if (name !== undefined) play.name = name;
  g.pending = { kind: 'window', actor: me.id, play, nopes: [] };
  return done([{ type: 'play', player: me.id, kinds: cards.map((c) => c.kind), target, ...(name !== undefined ? { name } : {}) }]);
}

function doNope(g, me, uid) {
  if (!g.pending || g.pending.kind !== 'window') return fail('ตอนนี้ไม่มีอะไรให้ "ไม่!"');
  const i = me.hand.findIndex((c) => c.uid === uid && c.kind === 'nope');
  if (i < 0) return fail('คุณไม่มีการ์ด "ไม่!"');
  const card = me.hand.splice(i, 1)[0];
  g.discard.push(card);
  g.pending.nopes.push({ by: me.id, uid });
  return done([{ type: 'nope', player: me.id }]);
}

function moveCard(from, to, card) {
  from.hand = from.hand.filter((c) => c !== card);
  to.hand.push(card);
}

function doGive(g, me, uid) {
  const pd = g.pending;
  if (!pd || pd.kind !== 'give' || pd.from !== me.id) return fail('ตอนนี้ไม่ได้ต้องให้การ์ดใคร');
  const card = me.hand.find((c) => c.uid === uid);
  if (!card) return fail('ไม่มีการ์ดใบนี้ในมือ');
  moveCard(me, find(g, pd.to), card);
  g.pending = null;
  return done([{ type: 'give', from: me.id, to: pd.to, secret: { to: [me.id, pd.to], card } }]);
}

/** ปิดช่วงเวลา "ไม่!" แล้วให้การ์ดมีผล ถ้าจำนวน "ไม่!" เป็นเลขคู่ เซิร์ฟเวอร์เรียกตอนหมดเวลา */
function resolvePending(g, rng) {
  const pd = g.pending;
  if (!pd || pd.kind !== 'window') return fail('ไม่มีอะไรให้ตัดสิน');
  g.pending = null;
  const { cards, target, name } = pd.play;
  const kinds = cards.map((c) => c.kind);
  const cancelled = pd.nopes.length % 2 === 1;
  const events = [{ type: 'resolve', player: pd.actor, kinds, cancelled }];
  if (cancelled) return done(events);
  const actor = find(g, pd.actor);
  const k = kinds[0];
  if (k === 'sneak') endTurn(g);
  else if (k === 'curse' || k === 'curse2') {
    const turns = (g.cursed ? g.turnsLeft : 0) + (k === 'curse2' ? 3 : 2);
    passTurn(g, nextAlive(g, actor.id), turns, true);
  } else if (k === 'mirror') {
    events.push({ type: 'mirror', player: actor.id, secret: { to: [actor.id], cards: g.deck.slice(0, 3) } });
  } else if (k === 'wind') {
    shuffle(g.deck, rng);
    events.push({ type: 'wind', player: actor.id });
  } else {
    const t = find(g, target);
    if (k === 'beg') {
      if (!t.alive || !t.hand.length) events.push({ type: 'give', from: t.id, to: actor.id, empty: true });
      else g.pending = { kind: 'give', from: t.id, to: actor.id };
    } else if (kinds.length === 2) {
      if (!t.alive || !t.hand.length) events.push({ type: 'steal', from: t.id, to: actor.id, empty: true });
      else {
        const card = t.hand[randomIndex(t.hand.length, rng)];
        moveCard(t, actor, card);
        events.push({ type: 'steal', from: t.id, to: actor.id, secret: { to: [t.id, actor.id], card } });
      }
    } else {
      const card = t.alive && t.hand.find((c) => c.kind === name);
      if (card) moveCard(t, actor, card);
      events.push({ type: 'demand', from: t.id, to: actor.id, name, got: !!card });
    }
  }
  return done(events);
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
    case 'play':
      if (!me.alive) return fail('คุณตกรอบแล้ว');
      return doPlay(g, me, action);
    case 'nope':
      if (!me.alive) return fail('คุณตกรอบแล้ว');
      return doNope(g, me, action.uid);
    case 'give':
      return doGive(g, me, action.uid);
    default:
      return fail('คำสั่งไม่ถูกต้อง');
  }
}

module.exports = { createGame, act, resolvePending, nextAlive, ALL_KINDS };
