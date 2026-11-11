// จั่วผี: กติกาทั้งหมด ไม่ยุ่งกับเครือข่ายหรือหน้าจอ
// ทุกการกระทำผ่าน act() ซึ่งคืน { ok, events } หรือ { ok:false, error }
// event มีส่วนสาธารณะ และ secret: { to: [...ids], ...ข้อมูลลับ } ที่เซิร์ฟเวอร์ส่งให้เฉพาะคนใน to

const { buildDeck, shuffle } = require('./deck');

/**
 * @param {string[]} playerIds ตามลำดับที่นั่ง
 * @param {{extras?: boolean, first?: string}} [opts] extras = ใส่การ์ดเสริมลงกอง, first = คนเริ่มก่อน (ไม่ระบุ = ที่นั่งแรก)
 */
function createGame(playerIds, rng, { extras = false, first } = {}) {
  const { hands, deck } = buildDeck(playerIds.length, rng, { extras });
  return {
    players: playerIds.map((id, i) => ({ id, hand: hands[i], alive: true, grudge: false })),
    deck,
    discard: [],
    current: playerIds.includes(first) ? first : playerIds[0],
    turnsLeft: 1,
    cursed: false,
    dir: 1,          // ทิศการเล่น 1 = ตามที่นั่ง, -1 = ย้อนกลับ (การ์ดเดินถอยหลัง)
    extras,
    pending: null,
    winner: null,
    firstOut: null,  // คนแรกที่โดนผีตกรอบ (เกมถัดไปเริ่มที่คนนี้)
  };
}

const fail = (error) => ({ ok: false, error });
const done = (events) => ({ ok: true, events });
const find = (g, id) => g.players.find((p) => p.id === id);
const alive = (g) => g.players.filter((p) => p.alive);

/** คนที่ยังรอดคนถัดไปตามทิศการเล่น */
function nextAlive(g, fromId) {
  const i = g.players.findIndex((p) => p.id === fromId);
  const n = g.players.length;
  const dir = g.dir === -1 ? -1 : 1;
  for (let k = 1; k <= n; k++) {
    const p = g.players[(((i + dir * k) % n) + n) % n];
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
  if (!g.firstOut) g.firstOut = p.id;
  g.discard.push(...p.hand);
  p.hand = [];
  p.alive = false;
  p.grudge = true;
}

function doDraw(g, me) {
  if (g.current !== me.id) return fail('ยังไม่ถึงตาคุณ');
  if (g.pending) return fail('รอให้เรื่องตรงหน้าจบก่อน');
  const events = [];
  receive(g, me, g.deck.shift(), events);
  return done(events);
}

/**
 * คนจั่วได้การ์ดใบหนึ่ง (จากบนกอง ก้นกอง หรือจั่วแทนคนที่ถึงตาเพราะโดนผีเข้า)
 * ตาที่จบคือตาของ g.current เสมอ extra = ข้อมูลเพิ่มใน event (เช่น bottom, for)
 */
function receive(g, me, card, events, extra = {}) {
  if (card.kind !== 'ghost') {
    me.hand.push(card);
    events.push({ type: 'draw', player: me.id, ...extra, secret: { to: [me.id], card } });
    endTurn(g);
    return;
  }
  const ti = me.hand.findIndex((c) => c.kind === 'talisman');
  if (ti >= 0) {
    g.discard.push(me.hand.splice(ti, 1)[0]);
    g.pending = { kind: 'insert', player: me.id, ghost: card };
    events.push({ type: 'ghost', player: me.id, saved: true, ...extra });
    return;
  }
  kill(g, me);
  g.discard.push(card);
  events.push({ type: 'ghost', player: me.id, saved: false, ...extra });
  checkWinner(g, events);
  if (g.winner) return;
  if (g.current === me.id) passTurn(g, nextAlive(g, me.id), 1, false);
  else endTurn(g);   // คนที่โดนผีเข้าตาย ตาของคนที่ถึงตาจบไปหนึ่งตา
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

const EXTRAS = new Set(['blackout', 'possess', 'grave', 'fate', 'reverse', 'bottom']);
const SINGLE = new Set(['sneak', 'curse', 'curse2', 'mirror', 'wind', 'beg', ...EXTRAS]);
const IMPS = new Set(['imp1', 'imp2', 'imp3', 'imp4', 'imp5']);
const ALL_KINDS = new Set(['ghost', 'talisman', 'nope', ...SINGLE, ...IMPS]);
/** การ์ดในกองทิ้งที่ "ขุดหลุมศพ" หยิบได้: ไม่ใช่ผี และไม่ใช่ขุดหลุมศพด้วยกัน (กันวนไม่จบ) */
const diggable = (g) => g.discard.filter((c) => c.kind !== 'ghost' && c.kind !== 'grave');
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
  if (cards.length === 1 && k === 'possess') {
    const t = find(g, target);
    if (!t || t.id === me.id) return 'เลือกคนที่จะให้ผีเข้า';
    if (!t.alive) return 'คนนี้ตกรอบไปแล้ว';
    return null;
  }
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
  } else if (k === 'reverse') {
    g.dir = g.dir === -1 ? 1 : -1;
    events.push({ type: 'reverse', player: actor.id, dir: g.dir });
    endTurn(g);
  } else if (k === 'bottom') {
    receive(g, actor, g.deck.pop(), events, { bottom: true });
  } else if (k === 'possess') {
    const t = find(g, target);
    if (!t || !t.alive) events.push({ type: 'possess', from: actor.id, to: target, empty: true });
    else {
      events.push({ type: 'possess', from: actor.id, to: t.id });
      receive(g, t, g.deck.shift(), events, { for: actor.id });
    }
  } else if (k === 'blackout') {
    // สุ่มทุกคนก่อน แล้วค่อยส่งพร้อมกัน (ใบที่ได้รับไม่ถูกส่งต่ออีกทอด)
    events.push({ type: 'blackout', player: actor.id });
    const moves = alive(g).filter((p) => p.hand.length)
      .map((p) => ({ from: p, to: find(g, nextAlive(g, p.id)), card: p.hand[randomIndex(p.hand.length, rng)] }));
    for (const m of moves) if (m.to && m.to !== m.from) moveCard(m.from, m.to, m.card);
    for (const m of moves) if (m.to && m.to !== m.from) events.push({ type: 'pass', from: m.from.id, to: m.to.id, secret: { to: [m.from.id, m.to.id], card: m.card } });
  } else if (k === 'grave') {
    if (!diggable(g).length) events.push({ type: 'dig', player: actor.id, empty: true });
    else g.pending = { kind: 'dig', player: actor.id };
  } else if (k === 'fate') {
    const n = Math.min(3, g.deck.length);
    if (n) g.pending = { kind: 'fate', player: actor.id, n };
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

/** ขุดหลุมศพ: หยิบการ์ดจากกองทิ้งขึ้นมือ (การ์ดในกองทิ้งทุกคนเห็นอยู่แล้ว ใบที่หยิบจึงไม่ใช่ความลับ) */
function doDig(g, me, uid) {
  const pd = g.pending;
  if (!pd || pd.kind !== 'dig' || pd.player !== me.id) return fail('ตอนนี้ไม่ได้ขุดหลุมศพ');
  const card = diggable(g).find((c) => c.uid === uid);
  if (!card) return fail('เลือกการ์ดจากกองทิ้ง (ยกเว้นผี)');
  g.discard.splice(g.discard.indexOf(card), 1);
  me.hand.push(card);
  g.pending = null;
  return done([{ type: 'dig', player: me.id, card }]);
}

/** ผูกดวง: order = uid ของการ์ดบนกองตามลำดับใหม่ (ใบแรก = บนสุด) */
function doFate(g, me, order) {
  const pd = g.pending;
  if (!pd || pd.kind !== 'fate' || pd.player !== me.id) return fail('ตอนนี้ไม่ได้ผูกดวง');
  const top = g.deck.slice(0, pd.n);
  if (!Array.isArray(order) || order.length !== top.length || new Set(order).size !== top.length) return fail('เรียงการ์ดให้ครบทุกใบ');
  const cards = order.map((u) => top.find((c) => c.uid === u));
  if (cards.some((c) => !c)) return fail('เรียงการ์ดให้ครบทุกใบ');
  g.deck.splice(0, top.length, ...cards);
  g.pending = null;
  return done([{ type: 'fate', player: me.id, n: top.length }]);
}

function doGrudge(g, me, targetId, rng) {
  if (me.alive) return fail('ใช้อาฆาตได้เฉพาะตอนเป็นวิญญาณ');
  if (!me.grudge) return fail('ใช้อาฆาตไปแล้ว');
  if (g.pending) return fail('รอให้เรื่องตรงหน้าจบก่อน');
  const t = find(g, targetId);
  if (!t || !t.alive) return fail('เลือกคนที่ยังรอดอยู่');
  if (!t.hand.length) return fail('คนนี้ไม่มีการ์ดในมือ');
  const card = t.hand.splice(randomIndex(t.hand.length, rng), 1)[0];
  g.discard.push(card);
  me.grudge = false;
  return done([{ type: 'grudge', from: me.id, to: t.id, card }]);
}

/** คนที่เกมรออยู่ (ถึงตา, ต้องเสียบผี, ต้องให้การ์ด) null ระหว่างช่วงเวลา "ไม่!" หรือเกมจบ */
function waitingOn(g) {
  if (g.winner) return null;
  const pd = g.pending;
  if (!pd) return g.current;
  if (pd.kind === 'insert') return pd.player;
  if (pd.kind === 'give') return pd.from;
  if (pd.kind === 'dig' || pd.kind === 'fate') return pd.player;
  return null;
}

/** ระบบทำแทนคนที่เกมรออยู่ (หลุดนานเกินไป) */
function autoAct(g, rng) {
  const id = waitingOn(g);
  if (!id) return fail('ไม่มีใครให้ทำแทน');
  const me = find(g, id);
  const pd = g.pending;
  if (pd && pd.kind === 'insert') return doInsert(g, me, randomIndex(g.deck.length + 1, rng));
  if (pd && pd.kind === 'give') return doGive(g, me, me.hand[randomIndex(me.hand.length, rng)].uid);
  if (pd && pd.kind === 'dig') { const c = diggable(g); return doDig(g, me, c[randomIndex(c.length, rng)].uid); }
  if (pd && pd.kind === 'fate') return doFate(g, me, g.deck.slice(0, pd.n).map((c) => c.uid));
  return doDraw(g, me);
}

/** คนออกจากห้องหรือโดนเตะกลางเกม */
function removePlayer(g, id, rng) {
  const p = find(g, id);
  if (!p || !p.alive || g.winner) return [];
  const events = [];
  const pd = g.pending;
  if (pd && pd.kind === 'window' && pd.actor === id) {
    g.pending = null;
    events.push({ type: 'resolve', player: id, kinds: pd.play.cards.map((c) => c.kind), cancelled: true });
  } else if (pd && pd.kind === 'give' && pd.from === id) {
    if (p.hand.length) events.push(...doGive(g, p, p.hand[randomIndex(p.hand.length, rng)].uid).events);
    g.pending = null;
  } else if (pd && pd.kind === 'give' && pd.to === id) {
    // คนที่ขอของออกไปแล้ว ไม่ต้องให้
    g.pending = null;
  } else if (pd && pd.kind === 'insert' && pd.player === id) {
    g.deck.splice(randomIndex(g.deck.length + 1, rng), 0, pd.ghost);
    g.pending = null;
  } else if (pd && (pd.kind === 'dig' || pd.kind === 'fate') && pd.player === id) {
    g.pending = null;
  }
  g.discard.push(...p.hand);
  p.hand = [];
  p.alive = false;
  p.grudge = false;
  const ghosts = g.deck.map((c, i) => (c.kind === 'ghost' ? i : -1)).filter((i) => i >= 0);
  if (ghosts.length) g.deck.splice(ghosts[randomIndex(ghosts.length, rng)], 1);
  events.push({ type: 'left', player: id });
  checkWinner(g, events);
  if (!g.winner && g.current === id) passTurn(g, nextAlive(g, id), 1, false);
  return events;
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
    case 'grudge':
      return doGrudge(g, me, action.target, rng);
    case 'dig':
      return doDig(g, me, action.uid);
    case 'fate':
      return doFate(g, me, action.order);
    default:
      return fail('คำสั่งไม่ถูกต้อง');
  }
}

module.exports = { createGame, act, resolvePending, removePlayer, waitingOn, autoAct, nextAlive, diggable, ALL_KINDS, EXTRAS };
