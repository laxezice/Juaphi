// ผีร้าย (ตัวเลือกห้อง): ผีใบหนึ่งในกองเป็นผีร้าย จั่วได้ต้องใช้ยันต์ทั้งหมดในมือปัดเป่า (user, 2026-11-14)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { act, resolvePending, createGame, removePlayer, waitingOn, diggable } = require('../game/game');
const { buildDeck } = require('../game/deck');
const { viewFor } = require('../game/view');
const { botMove } = require('../game/bot');
const { rig, player, kinds, makeRng } = require('./helpers');

const R = makeRng(9);
const draw = (g, id) => { const r = act(g, id, { type: 'draw' }, R); assert.equal(r.ok, true, r.error); return r.events; };

test('with the option on, one of the ghosts is an evil ghost and the ghost total stays players - 1', () => {
  for (const n of [2, 4, 7]) {
    const all = (o) => { const { hands, deck } = buildDeck(n, makeRng(n), o); return [...hands.flat(), ...deck].map((c) => c.kind); };
    const plain = all({});
    const evil = all({ evil: true });
    assert.equal(plain.filter((k) => k === 'evil').length, 0);
    assert.equal(evil.filter((k) => k === 'evil').length, 1);
    assert.equal(evil.filter((k) => k === 'ghost').length, n - 2);
    assert.equal(evil.length, plain.length);
  }
  const g = createGame(['A', 'B', 'C'], makeRng(1), { evil: true });
  assert.equal(g.evil, true);
  assert.equal(viewFor(g, 'A').evil, true);
  assert.equal(viewFor(createGame(['A', 'B'], makeRng(1)), 'A').evil, false);
  // ผีร้ายไม่อยู่ในมือใครตอนแจก
  for (const p of g.players) assert.ok(!kinds(p.hand).includes('evil'));
});

test('drawing the evil ghost uses every talisman in hand, then the drawer hides it back', () => {
  const g = rig({ A: ['talisman', 'sneak', 'talisman', 'talisman'], B: [] }, ['evil', 'mirror']);
  const events = draw(g, 'A');
  assert.deepEqual(events.map((e) => [e.type, e.saved, e.evil, e.used]), [['ghost', true, true, 3]]);
  assert.deepEqual(kinds(player(g, 'A').hand), ['sneak']);
  assert.equal(g.discard.filter((c) => c.kind === 'talisman').length, 3);
  assert.equal(g.pending.kind, 'insert');
  const r = act(g, 'A', { type: 'insert', index: 1 }, R);
  assert.equal(r.ok, true);
  assert.equal(r.events[0].evil, true);
  assert.deepEqual(kinds(g.deck), ['mirror', 'evil']);
  assert.equal(g.current, 'B');
});

test('the evil ghost with no talisman knocks the drawer out', () => {
  const g = rig({ A: ['sneak'], B: [], C: [] }, ['evil', 'mirror']);
  const events = draw(g, 'A');
  assert.deepEqual(events.map((e) => [e.type, e.saved, e.evil]), [['ghost', false, true]]);
  assert.equal(player(g, 'A').alive, false);
  assert.equal(g.current, 'B');
  assert.ok(!diggable(g).some((c) => c.kind === 'evil'), 'grave cannot dig up the evil ghost');
});

test('a normal ghost still costs only one talisman', () => {
  const g = rig({ A: ['talisman', 'talisman'], B: [] }, ['ghost']);
  const events = draw(g, 'A');
  assert.equal(events[0].evil, undefined);
  assert.deepEqual(kinds(player(g, 'A').hand), ['talisman']);
});

test('a player leaving takes the evil ghost out of the deck when it is the only ghost left', () => {
  const g = rig({ A: [], B: [], C: [] }, ['mirror', 'evil', 'wind']);
  removePlayer(g, 'C', R);
  assert.deepEqual(kinds(g.deck), ['mirror', 'wind']);
});

test('bot-only games with the evil ghost always finish', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = makeRng(seed);
    const n = 2 + (seed % 7);
    const ids = Array.from({ length: n }, (_, i) => `P${i}`);
    const g = createGame(ids, rng, { evil: true, extras: seed % 2 === 0 });
    const memos = Object.fromEntries(ids.map((id) => [id, {}]));
    let steps = 0;
    while (!g.winner) {
      assert.ok(++steps < 5000, `seed ${seed} stalled`);
      if (g.pending && g.pending.kind === 'window') {
        const noper = ids.map((id) => [id, botMove(viewFor(g, id), id, rng, memos[id])]).find(([, m]) => m);
        if (noper) assert.equal(act(g, noper[0], noper[1], rng).ok, true);
        else assert.equal(resolvePending(g, rng).ok, true);
        continue;
      }
      const id = waitingOn(g);
      const m = botMove(viewFor(g, id), id, rng, memos[id]);
      assert.ok(m, `seed ${seed}: bot ${id} had no move for ${g.pending && g.pending.kind}`);
      const r = act(g, id, m, rng);
      assert.equal(r.ok, true, `seed ${seed}: ${r.error} ${JSON.stringify(m)}`);
    }
  }
});
