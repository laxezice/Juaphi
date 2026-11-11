// Task 4: อาฆาต คนออกกลางเกม ระบบเล่นแทน
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { act, resolvePending, removePlayer, waitingOn, autoAct } = require('../game/game');
const { rig, player, kinds, uidOf, snap, makeRng } = require('./helpers');

const R = makeRng(21);

/** ฆ่า A ด้วยการจั่วผีโดยไม่มียันต์ */
function killA(hands, deck) {
  const g = rig(hands, ['ghost', ...deck]);
  act(g, 'A', { type: 'draw' }, R);
  assert.equal(player(g, 'A').alive, false);
  return g;
}

test('a dead player can grudge once: one random card discarded, public', () => {
  const g = killA({ A: [], B: ['wind', 'beg'], C: ['sneak'] }, ['mirror']);
  const r = act(g, 'A', { type: 'grudge', target: 'B' }, R);
  assert.equal(r.ok, true);
  assert.equal(player(g, 'B').hand.length, 1);
  assert.equal(player(g, 'A').grudge, false);
  const ev = r.events.find((e) => e.type === 'grudge');
  assert.equal(ev.from, 'A');
  assert.equal(ev.to, 'B');
  assert.ok(['wind', 'beg'].includes(ev.card.kind));
  assert.equal(g.discard[g.discard.length - 1], ev.card);
  assert.equal(act(g, 'A', { type: 'grudge', target: 'C' }, R).ok, false);
});

test('a living player cannot grudge', () => {
  const g = rig({ A: [], B: ['wind'] }, ['mirror']);
  assert.equal(act(g, 'A', { type: 'grudge', target: 'B' }, R).ok, false);
});

test('grudge is blocked during a window and at an empty hand or a dead target', () => {
  const g = killA({ A: [], B: ['sneak'], C: [], D: ['wind'] }, ['mirror']);
  assert.equal(act(g, 'A', { type: 'grudge', target: 'C' }, R).ok, false);
  player(g, 'D').alive = false;
  assert.equal(act(g, 'A', { type: 'grudge', target: 'D' }, R).ok, false);
  act(g, 'B', { type: 'play', uids: [uidOf(g, 'B', 'sneak')] }, R);
  const before = snap(g);
  assert.equal(act(g, 'A', { type: 'grudge', target: 'B' }, R).ok, false);
  assert.deepEqual(snap(g), before);
});

test('grudge works out of turn and while someone owes a give is blocked', () => {
  const g = killA({ A: [], B: ['beg'], C: ['wind', 'nope'] }, ['mirror']);
  act(g, 'B', { type: 'play', uids: [uidOf(g, 'B', 'beg')], target: 'C' }, R);
  resolvePending(g, R);
  assert.equal(g.pending.kind, 'give');
  assert.equal(act(g, 'A', { type: 'grudge', target: 'C' }, R).ok, false);
});

test('removing the current living player drops one ghost and passes the turn', () => {
  const g = rig({ A: ['wind'], B: [], C: [], D: [] }, ['ghost', 'mirror', 'ghost', 'ghost']);
  const ev = removePlayer(g, 'A', R);
  assert.ok(Array.isArray(ev));
  assert.equal(kinds(g.deck).filter((k) => k === 'ghost').length, 2);
  assert.equal(player(g, 'A').alive, false);
  assert.equal(player(g, 'A').grudge, false);
  assert.deepEqual(player(g, 'A').hand, []);
  assert.ok(kinds(g.discard).includes('wind'));
  assert.equal(g.current, 'B');
  assert.equal(g.turnsLeft, 1);
});

test('removing a player from a 2-player game makes the other the winner', () => {
  const g = rig({ A: [], B: [] }, ['ghost', 'mirror']);
  const ev = removePlayer(g, 'B', R);
  assert.equal(g.winner, 'A');
  assert.ok(ev.some((e) => e.type === 'win' && e.player === 'A'));
});

test('removing a player who owes a give hands the beggar a random card', () => {
  const g = rig({ A: ['beg'], B: ['wind'], C: [] }, ['mirror']);
  act(g, 'A', { type: 'play', uids: [uidOf(g, 'A', 'beg')], target: 'B' }, R);
  resolvePending(g, R);
  removePlayer(g, 'B', R);
  assert.equal(g.pending, null);
  assert.deepEqual(kinds(player(g, 'A').hand), ['wind']);
  assert.equal(g.current, 'A');
});

test('removing the player whose play is in a window cancels it', () => {
  const g = rig({ A: ['sneak'], B: [], C: [] }, ['ghost', 'mirror', 'ghost']);
  act(g, 'A', { type: 'play', uids: [uidOf(g, 'A', 'sneak')] }, R);
  removePlayer(g, 'A', R);
  assert.equal(g.pending, null);
  assert.equal(g.current, 'B');
});

test('removing the player who must insert a ghost puts it back at random', () => {
  const g = rig({ A: ['talisman'], B: [], C: [] }, ['ghost', 'mirror', 'wind', 'ghost']);
  act(g, 'A', { type: 'draw' }, R);
  removePlayer(g, 'A', R);
  assert.equal(g.pending, null);
  // ผีที่จั่วได้กลับเข้ากอง แล้วเอาออก 1 ใบเพราะคนรอดลดลง: 2 คนรอด เหลือผี 1
  assert.equal(kinds(g.deck).filter((k) => k === 'ghost').length, 1);
  assert.equal(g.current, 'B');
});

test('removing a dead or unknown player changes nothing important', () => {
  const g = killA({ A: [], B: [], C: [] }, ['mirror']);
  const cur = g.current;
  removePlayer(g, 'A', R);
  removePlayer(g, 'Z', R);
  assert.equal(g.current, cur);
});

test('waitingOn names who the game waits for in each state', () => {
  const g = rig({ A: ['talisman', 'sneak'], B: ['beg'], C: ['wind'] }, ['ghost', 'mirror', 'wind']);
  assert.equal(waitingOn(g), 'A');
  act(g, 'A', { type: 'play', uids: [uidOf(g, 'A', 'sneak')] }, R);
  assert.equal(waitingOn(g), null);
  resolvePending(g, R);
  assert.equal(waitingOn(g), 'B');
  act(g, 'B', { type: 'play', uids: [uidOf(g, 'B', 'beg')], target: 'C' }, R);
  resolvePending(g, R);
  assert.equal(waitingOn(g), 'C');
});

test('waitingOn is the inserter during an insert, null after a win', () => {
  const g = rig({ A: ['talisman'], B: [] }, ['ghost', 'mirror']);
  act(g, 'A', { type: 'draw' }, R);
  assert.equal(waitingOn(g), 'A');
  const g2 = rig({ A: [], B: [] }, ['ghost']);
  act(g2, 'A', { type: 'draw' }, R);
  assert.equal(waitingOn(g2), null);
});

test('autoAct draws for the current player', () => {
  const g = rig({ A: [], B: [] }, ['mirror', 'wind']);
  const r = autoAct(g, R);
  assert.equal(r.ok, true);
  assert.deepEqual(kinds(player(g, 'A').hand), ['mirror']);
  assert.equal(g.current, 'B');
});

test('autoAct inserts the ghost and passes the turn', () => {
  const g = rig({ A: ['talisman'], B: [] }, ['ghost', 'mirror', 'wind']);
  act(g, 'A', { type: 'draw' }, R);
  autoAct(g, R);
  assert.equal(g.pending, null);
  assert.equal(kinds(g.deck).filter((k) => k === 'ghost').length, 1);
  assert.equal(g.deck.length, 3);
  assert.equal(g.current, 'B');
});

test('autoAct gives a random card for the begged player', () => {
  const g = rig({ A: ['beg'], B: ['wind'] }, ['mirror']);
  act(g, 'A', { type: 'play', uids: [uidOf(g, 'A', 'beg')], target: 'B' }, R);
  resolvePending(g, R);
  autoAct(g, R);
  assert.deepEqual(kinds(player(g, 'A').hand), ['wind']);
});

test('autoAct with nothing to wait for is rejected', () => {
  const g = rig({ A: ['sneak'], B: [] }, ['mirror']);
  act(g, 'A', { type: 'play', uids: [uidOf(g, 'A', 'sneak')] }, R);
  assert.equal(autoAct(g, R).ok, false);
});
