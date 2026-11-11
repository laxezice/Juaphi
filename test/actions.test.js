// Task 3: การ์ดแอ็กชัน ช่วงเวลา "ไม่!" ผีน้อย
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { act, resolvePending } = require('../game/game');
const { rig, player, kinds, uidOf, snap, makeRng } = require('./helpers');

const R = makeRng(11);

const play = (g, id, ks, extra = {}) => {
  const hand = [...player(g, id).hand];
  const uids = ks.map((k) => {
    const i = hand.findIndex((c) => c.kind === k);
    return hand.splice(i, 1)[0].uid;
  });
  return act(g, id, { type: 'play', uids, ...extra }, R);
};
const nope = (g, id) => act(g, id, { type: 'nope', uid: uidOf(g, id, 'nope') }, R);

test('sneak opens a window, then ends the turn without drawing', () => {
  const g = rig({ A: ['sneak'], B: [], C: [] }, ['mirror', 'wind']);
  const r = play(g, 'A', ['sneak']);
  assert.equal(r.ok, true);
  assert.equal(g.pending.kind, 'window');
  assert.deepEqual(kinds(g.discard), ['sneak']);
  assert.deepEqual(r.events.find((e) => e.type === 'play'), { type: 'play', player: 'A', kinds: ['sneak'], target: null });
  const rr = resolvePending(g, R);
  assert.equal(rr.ok, true);
  assert.equal(rr.events[0].type, 'resolve');
  assert.equal(rr.events[0].cancelled, false);
  assert.equal(g.current, 'B');
  assert.equal(g.deck.length, 2);
  assert.deepEqual(player(g, 'A').hand, []);
});

test('curse stacking follows the spec example', () => {
  const g = rig({ A: ['curse2'], B: ['curse'], C: [] }, ['mirror', 'wind', 'beg', 'nope', 'sneak']);
  play(g, 'A', ['curse2']); resolvePending(g, R);
  assert.equal(g.current, 'B');
  assert.equal(g.turnsLeft, 3);
  act(g, 'B', { type: 'draw' }, R);
  assert.equal(g.current, 'B');
  assert.equal(g.turnsLeft, 2);
  play(g, 'B', ['curse']); resolvePending(g, R);
  assert.equal(g.current, 'C');
  assert.equal(g.turnsLeft, 4);
});

test('a curse on a normal turn gives the next player 2 turns', () => {
  const g = rig({ A: ['curse'], B: [], C: [] }, ['mirror']);
  play(g, 'A', ['curse']); resolvePending(g, R);
  assert.equal(g.current, 'B');
  assert.equal(g.turnsLeft, 2);
});

test('a curse on the last cursed turn still stacks (1 + 2)', () => {
  const g = rig({ A: ['curse'], B: ['curse'], C: [] }, ['mirror', 'wind']);
  play(g, 'A', ['curse']); resolvePending(g, R);
  act(g, 'B', { type: 'draw' }, R);
  assert.equal(g.turnsLeft, 1);
  play(g, 'B', ['curse']); resolvePending(g, R);
  assert.equal(g.current, 'C');
  assert.equal(g.turnsLeft, 3);
});

test('after a cursed player finishes, the next normal curse is back to 2', () => {
  const g = rig({ A: ['curse'], B: [], C: ['curse'] }, ['mirror', 'wind', 'beg']);
  play(g, 'A', ['curse']); resolvePending(g, R);
  act(g, 'B', { type: 'draw' }, R);
  act(g, 'B', { type: 'draw' }, R);
  assert.equal(g.current, 'C');
  play(g, 'C', ['curse']); resolvePending(g, R);
  assert.equal(g.turnsLeft, 2);
});

test('sneak while cursed only skips one of the owed turns', () => {
  const g = rig({ A: ['curse'], B: ['sneak'], C: [] }, ['mirror']);
  play(g, 'A', ['curse']); resolvePending(g, R);
  play(g, 'B', ['sneak']); resolvePending(g, R);
  assert.equal(g.current, 'B');
  assert.equal(g.turnsLeft, 1);
});

test('one No! cancels the play; the card is still discarded', () => {
  const g = rig({ A: ['sneak'], B: ['nope'], C: [] }, ['mirror']);
  play(g, 'A', ['sneak']);
  const n = nope(g, 'B');
  assert.equal(n.ok, true);
  assert.deepEqual(n.events, [{ type: 'nope', player: 'B' }]);
  assert.equal(g.pending.nopes.length, 1);
  const rr = resolvePending(g, R);
  assert.equal(rr.events[0].cancelled, true);
  assert.equal(g.current, 'A');
  assert.equal(g.pending, null);
  assert.deepEqual(kinds(g.discard), ['sneak', 'nope']);
});

test('No! on No! lets the play through, and the actor may No! too', () => {
  const g = rig({ A: ['sneak', 'nope'], B: ['nope'], C: [] }, ['mirror']);
  play(g, 'A', ['sneak']);
  nope(g, 'B');
  assert.equal(nope(g, 'A').ok, true);
  resolvePending(g, R);
  assert.equal(g.current, 'B');
});

test('No! without the card, or with no window, is rejected', () => {
  const g = rig({ A: ['sneak'], B: ['nope'], C: ['wind'] }, ['mirror']);
  assert.equal(nope(g, 'B').ok, false);
  play(g, 'A', ['sneak']);
  const cw = uidOf(g, 'C', 'wind');
  assert.equal(act(g, 'C', { type: 'nope', uid: cw }, R).ok, false);
});

test('a dead player cannot No!', () => {
  const g = rig({ A: ['sneak'], B: ['nope'], C: [] }, ['mirror']);
  player(g, 'B').alive = false;
  play(g, 'A', ['sneak']);
  assert.equal(nope(g, 'B').ok, false);
});

test('during a window the current player cannot draw or play again', () => {
  const g = rig({ A: ['sneak', 'wind'], B: [] }, ['mirror']);
  play(g, 'A', ['sneak']);
  const before = snap(g);
  assert.equal(act(g, 'A', { type: 'draw' }, R).ok, false);
  assert.equal(play(g, 'A', ['wind']).ok, false);
  assert.deepEqual(snap(g), before);
});

test('resolvePending with no window is rejected', () => {
  const g = rig({ A: [], B: [] }, ['mirror']);
  assert.equal(resolvePending(g, R).ok, false);
});

test('mirror shows the top 3 only to the player', () => {
  const g = rig({ A: ['mirror'], B: [] }, ['wind', 'ghost', 'beg', 'nope']);
  play(g, 'A', ['mirror']);
  const rr = resolvePending(g, R);
  const ev = rr.events.find((e) => e.type === 'mirror');
  assert.equal(ev.player, 'A');
  assert.equal(ev.cards, undefined);
  assert.deepEqual(ev.secret.to, ['A']);
  assert.deepEqual(kinds(ev.secret.cards), ['wind', 'ghost', 'beg']);
  assert.equal(g.current, 'A');
});

test('wind shuffles the deck', () => {
  const deck = Array.from({ length: 20 }, (_, i) => (i % 2 ? 'beg' : 'wind'));
  const g = rig({ A: ['wind'], B: [] }, deck);
  const before = g.deck.map((c) => c.uid).join();
  play(g, 'A', ['wind']);
  const rr = resolvePending(g, R);
  assert.ok(rr.events.some((e) => e.type === 'wind'));
  assert.notEqual(g.deck.map((c) => c.uid).join(), before);
  assert.equal(g.deck.length, 20);
});

test('beg: the target chooses a card to give; only the target may give', () => {
  const g = rig({ A: ['beg'], B: ['wind', 'talisman'], C: [] }, ['mirror']);
  assert.equal(play(g, 'A', ['beg'], { target: 'B' }).ok, true);
  resolvePending(g, R);
  assert.deepEqual(g.pending, { kind: 'give', from: 'B', to: 'A' });
  const w = uidOf(g, 'B', 'wind');
  assert.equal(act(g, 'C', { type: 'give', uid: w }, R).ok, false);
  assert.equal(act(g, 'A', { type: 'draw' }, R).ok, false);
  const r = act(g, 'B', { type: 'give', uid: w }, R);
  assert.equal(r.ok, true);
  assert.deepEqual(kinds(player(g, 'A').hand), ['wind']);
  assert.deepEqual(kinds(player(g, 'B').hand), ['talisman']);
  const ev = r.events.find((e) => e.type === 'give');
  assert.equal(ev.card, undefined);
  assert.deepEqual([...ev.secret.to].sort(), ['A', 'B']);
  assert.equal(ev.secret.card.kind, 'wind');
  assert.equal(g.pending, null);
  assert.equal(g.current, 'A');
});

test('give with a card not in hand is rejected', () => {
  const g = rig({ A: ['beg'], B: ['wind'], C: [] }, ['mirror']);
  play(g, 'A', ['beg'], { target: 'B' });
  resolvePending(g, R);
  assert.equal(act(g, 'B', { type: 'give', uid: 'nope' }, R).ok, false);
});

test('beg against a hand emptied before resolve gives nothing', () => {
  const g = rig({ A: ['beg'], B: ['wind'], C: [] }, ['mirror']);
  play(g, 'A', ['beg'], { target: 'B' });
  g.discard.push(...player(g, 'B').hand.splice(0));
  const rr = resolvePending(g, R);
  assert.equal(g.pending, null);
  assert.ok(rr.events.some((e) => e.type === 'give' && e.empty === true));
});

test('beg needs a living target with cards that is not yourself', () => {
  const g = rig({ A: ['beg'], B: [], C: ['wind'] }, ['mirror']);
  assert.equal(play(g, 'A', ['beg'], { target: 'B' }).ok, false);
  assert.equal(play(g, 'A', ['beg'], { target: 'A' }).ok, false);
  assert.equal(play(g, 'A', ['beg']).ok, false);
  player(g, 'C').alive = false;
  assert.equal(play(g, 'A', ['beg'], { target: 'C' }).ok, false);
});

test('an imp pair steals one random card, shown only to the two players', () => {
  const g = rig({ A: ['imp2', 'imp2'], B: ['wind'], C: [] }, ['mirror']);
  assert.equal(play(g, 'A', ['imp2', 'imp2'], { target: 'B' }).ok, true);
  const rr = resolvePending(g, R);
  assert.deepEqual(kinds(player(g, 'A').hand), ['wind']);
  const ev = rr.events.find((e) => e.type === 'steal');
  assert.equal(ev.from, 'B');
  assert.equal(ev.to, 'A');
  assert.equal(ev.card, undefined);
  assert.deepEqual([...ev.secret.to].sort(), ['A', 'B']);
});

test('mismatched imps and single imps are rejected', () => {
  const g = rig({ A: ['imp1', 'imp2', 'imp3'], B: ['wind'] }, ['mirror']);
  assert.equal(play(g, 'A', ['imp1', 'imp2'], { target: 'B' }).ok, false);
  assert.equal(play(g, 'A', ['imp1'], { target: 'B' }).ok, false);
});

test('an imp triple takes the named card if the target has it', () => {
  const g = rig({ A: ['imp4', 'imp4', 'imp4'], B: ['wind', 'talisman'], C: [] }, ['mirror']);
  assert.equal(play(g, 'A', ['imp4', 'imp4', 'imp4'], { target: 'B', name: 'talisman' }).ok, true);
  const rr = resolvePending(g, R);
  assert.deepEqual(kinds(player(g, 'A').hand), ['talisman']);
  assert.deepEqual(rr.events.find((e) => e.type === 'demand'), { type: 'demand', from: 'B', to: 'A', name: 'talisman', got: true });
});

test('an imp triple naming a missing card gets nothing', () => {
  const g = rig({ A: ['imp4', 'imp4', 'imp4'], B: ['wind'] }, ['mirror']);
  play(g, 'A', ['imp4', 'imp4', 'imp4'], { target: 'B', name: 'nope' });
  const rr = resolvePending(g, R);
  assert.deepEqual(player(g, 'A').hand, []);
  assert.equal(rr.events.find((e) => e.type === 'demand').got, false);
});

test('an imp triple needs a valid card name', () => {
  const g = rig({ A: ['imp4', 'imp4', 'imp4'], B: ['wind'] }, ['mirror']);
  assert.equal(play(g, 'A', ['imp4', 'imp4', 'imp4'], { target: 'B', name: 'dragon' }).ok, false);
  assert.equal(play(g, 'A', ['imp4', 'imp4', 'imp4'], { target: 'B' }).ok, false);
});

test('talisman, ghost and nope cannot be played as an action', () => {
  const g = rig({ A: ['talisman', 'nope', 'ghost'], B: ['wind'] }, ['mirror']);
  assert.equal(play(g, 'A', ['talisman']).ok, false);
  assert.equal(play(g, 'A', ['nope']).ok, false);
  assert.equal(play(g, 'A', ['ghost']).ok, false);
});

test('the same uid twice, or a card not in hand, is rejected', () => {
  const g = rig({ A: ['imp1', 'wind'], B: ['imp1'] }, ['mirror']);
  const u = uidOf(g, 'A', 'imp1');
  const before = snap(g);
  assert.equal(act(g, 'A', { type: 'play', uids: [u, u], target: 'B' }, R).ok, false);
  assert.equal(act(g, 'A', { type: 'play', uids: [uidOf(g, 'B', 'imp1')] }, R).ok, false);
  assert.equal(act(g, 'A', { type: 'play', uids: 'x' }, R).ok, false);
  assert.deepEqual(snap(g), before);
});

test('playing out of turn is rejected', () => {
  const g = rig({ A: [], B: ['wind'] }, ['mirror']);
  assert.equal(play(g, 'B', ['wind']).ok, false);
});
