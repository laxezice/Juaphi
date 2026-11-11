const { test } = require('node:test');
const assert = require('node:assert/strict');
const { act } = require('../game/game');
const { rig, player, kinds, snap, makeRng } = require('./helpers');

const R = makeRng(9);

// ---------- Task 2: ตาเล่น การจั่ว ผี ----------

test('a player who is not current cannot draw and nothing changes', () => {
  const g = rig({ A: ['sneak'], B: ['wind'] }, ['mirror', 'wind']);
  const before = snap(g);
  const r = act(g, 'B', { type: 'draw' }, R);
  assert.equal(r.ok, false);
  assert.ok(r.error);
  assert.deepEqual(snap(g), before);
});

test('a normal draw adds the card to the hand and passes the turn', () => {
  const g = rig({ A: ['sneak'], B: ['wind'], C: [] }, ['mirror', 'wind']);
  const r = act(g, 'A', { type: 'draw' }, R);
  assert.equal(r.ok, true);
  assert.deepEqual(kinds(player(g, 'A').hand), ['sneak', 'mirror']);
  assert.equal(g.deck.length, 1);
  assert.equal(g.current, 'B');
  assert.equal(g.turnsLeft, 1);
  const ev = r.events.find((e) => e.type === 'draw');
  assert.equal(ev.player, 'A');
  assert.equal(ev.card, undefined);
  assert.deepEqual(ev.secret.to, ['A']);
  assert.equal(ev.secret.card.kind, 'mirror');
});

test('ghost with a talisman: talisman discarded, insert pending, turn kept', () => {
  const g = rig({ A: ['talisman', 'sneak'], B: [], C: [] }, ['ghost', 'wind', 'nope', 'beg']);
  const r = act(g, 'A', { type: 'draw' }, R);
  assert.equal(r.ok, true);
  assert.deepEqual(kinds(player(g, 'A').hand), ['sneak']);
  assert.deepEqual(kinds(g.discard), ['talisman']);
  assert.equal(g.pending.kind, 'insert');
  assert.equal(g.pending.player, 'A');
  assert.equal(g.current, 'A');
  assert.deepEqual(r.events.find((e) => e.type === 'ghost'), { type: 'ghost', player: 'A', saved: true });

  assert.equal(act(g, 'B', { type: 'insert', index: 0 }, R).ok, false);
  assert.equal(act(g, 'A', { type: 'insert', index: -1 }, R).ok, false);
  assert.equal(act(g, 'A', { type: 'insert', index: 4 }, R).ok, false);
  assert.equal(act(g, 'A', { type: 'draw' }, R).ok, false);

  const r2 = act(g, 'A', { type: 'insert', index: 2 }, R);
  assert.equal(r2.ok, true);
  assert.deepEqual(kinds(g.deck), ['wind', 'nope', 'ghost', 'beg']);
  assert.equal(g.pending, null);
  assert.equal(g.current, 'B');
  const ins = r2.events.find((e) => e.type === 'insert');
  assert.deepEqual(ins, { type: 'insert', player: 'A' });
});

test('insert at the bottom (index = deck length) is allowed', () => {
  const g = rig({ A: ['talisman'], B: [] }, ['ghost', 'wind']);
  act(g, 'A', { type: 'draw' }, R);
  assert.equal(act(g, 'A', { type: 'insert', index: 1 }, R).ok, true);
  assert.deepEqual(kinds(g.deck), ['wind', 'ghost']);
});

test('ghost without a talisman: player dies, hand discarded, gets a grudge, turn moves on', () => {
  const g = rig({ A: ['sneak', 'wind'], B: [], C: [] }, ['ghost', 'mirror']);
  const r = act(g, 'A', { type: 'draw' }, R);
  assert.equal(r.ok, true);
  const a = player(g, 'A');
  assert.equal(a.alive, false);
  assert.equal(a.grudge, true);
  assert.deepEqual(a.hand, []);
  assert.deepEqual(kinds(g.discard).sort(), ['ghost', 'sneak', 'wind']);
  assert.equal(g.discard[g.discard.length - 1].kind, 'ghost');
  assert.deepEqual(kinds(g.deck), ['mirror']);
  assert.equal(g.current, 'B');
  assert.equal(g.winner, null);
  assert.deepEqual(r.events.find((e) => e.type === 'ghost'), { type: 'ghost', player: 'A', saved: false });
});

test('with two players the survivor wins and the game stops', () => {
  const g = rig({ A: [], B: ['sneak'] }, ['ghost', 'mirror']);
  const r = act(g, 'A', { type: 'draw' }, R);
  assert.equal(g.winner, 'B');
  assert.ok(r.events.some((e) => e.type === 'win' && e.player === 'B'));
  assert.equal(act(g, 'B', { type: 'draw' }, R).ok, false);
});

test('dead players are skipped when the turn passes', () => {
  const g = rig({ A: [], B: [], C: [] }, ['wind', 'ghost', 'mirror', 'beg']);
  act(g, 'A', { type: 'draw' }, R); // A ได้ wind
  act(g, 'B', { type: 'draw' }, R); // B โดนผี ตาย
  assert.equal(g.current, 'C');
  act(g, 'C', { type: 'draw' }, R);
  assert.equal(g.current, 'A');
});

test('a dead player cannot draw', () => {
  const g = rig({ A: [], B: [], C: [] }, ['ghost', 'mirror']);
  act(g, 'A', { type: 'draw' }, R);
  g.current = 'A';
  assert.equal(act(g, 'A', { type: 'draw' }, R).ok, false);
});

test('an unknown action is rejected', () => {
  const g = rig({ A: [], B: [] }, ['mirror']);
  assert.equal(act(g, 'A', { type: 'teleport' }, R).ok, false);
  assert.equal(act(g, 'A', null, R).ok, false);
});
