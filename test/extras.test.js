// การ์ดเสริม: ไฟดับ ผีเข้า ขุดหลุมศพ ผูกดวง เดินถอยหลัง จั่วก้นกอง
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { act, resolvePending, createGame, autoAct, removePlayer, waitingOn } = require('../game/game');
const { buildDeck, DECK_TABLE, EXTRA_TABLE } = require('../game/deck');
const { viewFor } = require('../game/view');
const { rig, player, kinds, uidOf, makeRng } = require('./helpers');

const R = makeRng(5);
const play = (g, id, kind, extra = {}) => act(g, id, { type: 'play', uids: [uidOf(g, id, kind)], ...extra }, R);
const playNow = (g, id, kind, extra) => { const r = play(g, id, kind, extra); assert.equal(r.ok, true, r.error); return resolvePending(g, R); };

test('extra cards are only in the deck when the option is on', () => {
  const count = (o) => { const { hands, deck } = buildDeck(4, makeRng(3), o); return [...hands.flat(), ...deck]; };
  const plain = count({});
  const extra = count({ extras: true });
  for (const k of Object.keys(EXTRA_TABLE)) {
    assert.equal(plain.filter((c) => c.kind === k).length, 0);
    assert.equal(extra.filter((c) => c.kind === k).length, EXTRA_TABLE[k][0]);
  }
  const base = Object.values(DECK_TABLE).reduce((s, v) => s + v[0], 0);
  assert.equal(extra.length - plain.length, Object.values(EXTRA_TABLE).reduce((s, v) => s + v[0], 0));
  assert.ok(plain.length > base);
  assert.equal(createGame(['A', 'B'], makeRng(1), { extras: true }).extras, true);
  assert.equal(viewFor(createGame(['A', 'B'], makeRng(1)), 'A').extras, false);
});

test('reverse flips the play order and ends the turn without drawing', () => {
  const g = rig({ A: ['reverse'], B: [], C: [], D: [] }, ['mirror', 'wind']);
  playNow(g, 'A', 'reverse');
  assert.equal(g.dir, -1);
  assert.equal(g.current, 'D');
  assert.equal(g.deck.length, 2);
  assert.equal(viewFor(g, 'B').dir, -1);
});

test('a curse after a reverse goes to the player on the other side', () => {
  const g = rig({ A: ['reverse', 'curse'], B: [], C: [] }, ['mirror', 'wind', 'beg']);
  g.turnsLeft = 2;
  playNow(g, 'A', 'reverse');
  assert.equal(g.current, 'A');
  playNow(g, 'A', 'curse');
  assert.equal(g.current, 'C');
  assert.equal(g.turnsLeft, 2);
});

test('bottom draws the last card of the deck and ends the turn', () => {
  const g = rig({ A: ['bottom'], B: [] }, ['ghost', 'mirror', 'wind']);
  const r = playNow(g, 'A', 'bottom');
  assert.deepEqual(kinds(player(g, 'A').hand), ['wind']);
  assert.deepEqual(kinds(g.deck), ['ghost', 'mirror']);
  assert.equal(g.current, 'B');
  assert.equal(r.events.find((e) => e.type === 'draw').bottom, true);
});

test('bottom can still find a ghost: talisman saves, then the drawer inserts it', () => {
  const g = rig({ A: ['bottom', 'talisman'], B: [] }, ['mirror', 'ghost']);
  playNow(g, 'A', 'bottom');
  assert.equal(g.pending.kind, 'insert');
  assert.equal(g.pending.player, 'A');
});

test('possess makes the target draw for you, then your turn ends', () => {
  const g = rig({ A: ['possess'], B: [], C: [] }, ['mirror', 'wind']);
  const r = playNow(g, 'A', 'possess', { target: 'C' });
  assert.deepEqual(kinds(player(g, 'C').hand), ['mirror']);
  assert.equal(g.current, 'B');
  const draw = r.events.find((e) => e.type === 'draw');
  assert.equal(draw.player, 'C');
  assert.equal(draw.for, 'A');
  assert.deepEqual(draw.secret.to, ['C']);
});

test('possess needs a living target other than yourself, even one with no cards', () => {
  const g = rig({ A: ['possess', 'possess'], B: [], C: [] }, ['mirror']);
  assert.equal(play(g, 'A', 'possess', { target: 'A' }).ok, false);
  player(g, 'C').alive = false;
  assert.equal(play(g, 'A', 'possess', { target: 'C' }).ok, false);
  assert.equal(play(g, 'A', 'possess', { target: 'B' }).ok, true);
});

test('a possessed target who draws a ghost without a talisman is out; the turn moves on from the player', () => {
  const g = rig({ A: ['possess'], B: ['sneak'], C: [] }, ['ghost', 'mirror']);
  const r = playNow(g, 'A', 'possess', { target: 'C' });
  assert.equal(player(g, 'C').alive, false);
  assert.equal(r.events.find((e) => e.type === 'ghost').saved, false);
  assert.equal(g.current, 'B');
  assert.equal(g.winner, null);
});

test('a possessed target with a talisman inserts the ghost, then the player\'s turn ends', () => {
  const g = rig({ A: ['possess'], B: [], C: ['talisman'] }, ['ghost', 'mirror']);
  playNow(g, 'A', 'possess', { target: 'C' });
  assert.equal(g.pending.kind, 'insert');
  assert.equal(waitingOn(g), 'C');
  assert.equal(g.current, 'A');
  assert.equal(act(g, 'C', { type: 'insert', index: 1 }, R).ok, true);
  assert.equal(g.current, 'B');
  assert.deepEqual(kinds(g.deck), ['mirror', 'ghost']);
});

test('possessing the last other player into a ghost wins the game', () => {
  const g = rig({ A: ['possess'], B: [] }, ['ghost']);
  playNow(g, 'A', 'possess', { target: 'B' });
  assert.equal(g.winner, 'A');
});

test('blackout passes one random card from everyone to the next player, all at once', () => {
  const g = rig({ A: ['blackout', 'wind'], B: ['mirror'], C: [], D: ['beg', 'beg'] }, ['sneak']);
  const r = playNow(g, 'A', 'blackout');
  assert.deepEqual(kinds(player(g, 'A').hand), ['beg']);
  assert.deepEqual(kinds(player(g, 'B').hand), ['wind']);
  assert.deepEqual(kinds(player(g, 'C').hand), ['mirror']);
  assert.deepEqual(kinds(player(g, 'D').hand), ['beg']);
  const passes = r.events.filter((e) => e.type === 'pass');
  assert.equal(passes.length, 3);
  for (const p of passes) assert.deepEqual(p.secret.to, [p.from, p.to]);
  assert.equal(g.current, 'A');   // เล่นตาตัวเองต่อ
});

test('blackout follows the reversed direction', () => {
  const g = rig({ A: ['blackout'], B: ['mirror'], C: ['wind'] }, ['sneak']);
  g.dir = -1;
  playNow(g, 'A', 'blackout');
  assert.deepEqual(kinds(player(g, 'A').hand), ['mirror']);
  assert.deepEqual(kinds(player(g, 'C').hand), []);
  assert.deepEqual(kinds(player(g, 'B').hand), ['wind']);
});

test('grave lets the player pick a non-ghost card from the discard pile', () => {
  const g = rig({ A: ['grave'], B: [] }, ['mirror']);
  g.discard = [{ uid: 'd1', kind: 'ghost' }, { uid: 'd2', kind: 'talisman' }, { uid: 'd3', kind: 'grave' }];
  playNow(g, 'A', 'grave');
  assert.equal(g.pending.kind, 'dig');
  assert.equal(waitingOn(g), 'A');
  assert.deepEqual(viewFor(g, 'A').me.dig.map((c) => c.uid), ['d2']);
  assert.equal(viewFor(g, 'B').me.dig, undefined);
  assert.equal(act(g, 'A', { type: 'dig', uid: 'd1' }, R).ok, false);
  const r = act(g, 'A', { type: 'dig', uid: 'd2' }, R);
  assert.equal(r.ok, true);
  assert.deepEqual(kinds(player(g, 'A').hand), ['talisman']);
  assert.equal(g.pending, null);
  assert.equal(g.current, 'A');
});

test('grave with nothing to dig just resolves', () => {
  const g = rig({ A: ['grave'], B: [] }, ['mirror']);
  const r = playNow(g, 'A', 'grave');
  assert.equal(g.pending, null);
  assert.equal(r.events.at(-1).empty, true);
});

test('fate shows the top cards to the player only and lets them reorder', () => {
  const g = rig({ A: ['fate'], B: [] }, ['ghost', 'mirror', 'wind', 'beg']);
  playNow(g, 'A', 'fate');
  assert.equal(g.pending.kind, 'fate');
  const top = viewFor(g, 'A').me.fate;
  assert.deepEqual(kinds(top), ['ghost', 'mirror', 'wind']);
  assert.equal(viewFor(g, 'B').me.fate, undefined);
  assert.equal(act(g, 'A', { type: 'fate', order: [top[0].uid, top[1].uid] }, R).ok, false);
  const r = act(g, 'A', { type: 'fate', order: [top[1].uid, top[2].uid, top[0].uid] }, R);
  assert.equal(r.ok, true);
  assert.deepEqual(kinds(g.deck), ['mirror', 'wind', 'ghost', 'beg']);
  assert.equal(g.current, 'A');
});

test('fate on a short deck only uses what is there', () => {
  const g = rig({ A: ['fate'], B: [] }, ['ghost']);
  playNow(g, 'A', 'fate');
  assert.equal(g.pending.n, 1);
});

test('nope cancels the new cards like any other', () => {
  const g = rig({ A: ['reverse'], B: ['nope'] }, ['mirror']);
  play(g, 'A', 'reverse');
  act(g, 'B', { type: 'nope', uid: uidOf(g, 'B', 'nope') }, R);
  resolvePending(g, R);
  assert.equal(g.dir, 1);
  assert.equal(g.current, 'A');
});

test('autoAct and leaving finish dig and fate choices', () => {
  const g = rig({ A: ['grave', 'fate'], B: [] }, ['ghost', 'mirror']);
  g.discard = [{ uid: 'd2', kind: 'wind' }];
  playNow(g, 'A', 'grave');
  assert.equal(autoAct(g, R).ok, true);
  assert.equal(g.pending, null);
  playNow(g, 'A', 'fate');
  assert.equal(autoAct(g, R).ok, true);
  assert.equal(g.pending, null);
  const h = rig({ A: ['fate'], B: [], C: [] }, ['ghost', 'mirror']);
  playNow(h, 'A', 'fate');
  removePlayer(h, 'A', R);
  assert.equal(h.pending, null);
  assert.notEqual(h.current, 'A');
});

// ---------- บอตกับการ์ดเสริม ----------
const { botMove } = require('../game/bot');
const always = () => 0;

test('a bot digs the talisman first and pushes ghosts down when reordering', () => {
  const g = rig({ A: ['grave'], B: [] }, ['ghost', 'mirror', 'wind']);
  g.discard = [{ uid: 'd1', kind: 'wind' }, { uid: 'd2', kind: 'talisman' }];
  playNow(g, 'A', 'grave');
  assert.deepEqual(botMove(viewFor(g, 'A'), 'A', R, {}), { type: 'dig', uid: 'd2' });
  const h = rig({ A: ['fate'], B: [] }, ['ghost', 'mirror', 'wind']);
  playNow(h, 'A', 'fate');
  const m = botMove(viewFor(h, 'A'), 'A', R, {});
  assert.equal(m.type, 'fate');
  assert.equal(act(h, 'A', m, R).ok, true);
  assert.deepEqual(kinds(h.deck), ['mirror', 'wind', 'ghost']);
});

test('a bot can possess a living player with no cards', () => {
  const g = rig({ A: ['possess'], B: [] }, ['mirror']);
  const m = botMove(viewFor(g, 'A'), 'A', always, {});
  assert.deepEqual(m, { type: 'play', uids: [uidOf(g, 'A', 'possess')], target: 'B' });
});

test('bot-only games with extra cards always finish', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = makeRng(seed);
    const n = 2 + (seed % 7);
    const ids = Array.from({ length: n }, (_, i) => `P${i}`);
    const g = createGame(ids, rng, { extras: true });
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
