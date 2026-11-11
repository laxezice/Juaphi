// สมองบอต: ดูจากมุมมองของบอต (viewFor) แล้วคืนคำสั่งเดียว หรือ null ถ้ายังไม่ต้องทำอะไร
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { act, resolvePending } = require('../game/game');
const { viewFor } = require('../game/view');
const { botMove } = require('../game/bot');
const { rig, uidOf, makeRng } = require('./helpers');

const R = makeRng(5);
const always = () => 0;      // สุ่มได้ค่าต่ำสุดเสมอ
const never = () => 0.999;   // สุ่มได้ค่าสูงสุดเสมอ
const ok = (g, id, a) => assert.equal(act(g, id, a, R).ok, true, JSON.stringify(a));

test('not its turn and nothing pending: does nothing', () => {
  const g = rig({ A: ['sneak'], B: ['wind'] }, ['mirror']);
  assert.equal(botMove(viewFor(g, 'B'), 'B', R, {}), null);
});

test('on its turn it returns a legal action', () => {
  for (let seed = 1; seed < 30; seed++) {
    const g = rig({ A: ['sneak', 'beg', 'imp1', 'imp1', 'mirror', 'nope', 'talisman'], B: ['wind'] }, ['mirror', 'wind']);
    const a = botMove(viewFor(g, 'A'), 'A', makeRng(seed), {});
    ok(g, 'A', a);
  }
});

test('never plays talisman or nope as an action', () => {
  const g = rig({ A: ['talisman', 'nope'], B: ['wind'] }, ['mirror']);
  for (let i = 0; i < 20; i++) assert.equal(botMove(viewFor(g, 'A'), 'A', makeRng(i), {}).type, 'draw');
});

test('inserts the ghost at a legal position', () => {
  const g = rig({ A: ['talisman'], B: [] }, ['ghost', 'mirror', 'wind']);
  ok(g, 'A', { type: 'draw' });
  const a = botMove(viewFor(g, 'A'), 'A', R, {});
  assert.equal(a.type, 'insert');
  ok(g, 'A', a);
});

test('gives a card from its own hand when begged', () => {
  const g = rig({ A: ['beg'], B: ['wind', 'sneak'] }, ['mirror']);
  ok(g, 'A', { type: 'play', uids: [uidOf(g, 'A', 'beg')], target: 'B' });
  resolvePending(g, R);
  const a = botMove(viewFor(g, 'B'), 'B', R, {});
  assert.equal(a.type, 'give');
  ok(g, 'B', a);
});

test('decides once per No! window whether to No!, and never No!s its own play', () => {
  const g = rig({ A: ['sneak', 'nope'], B: ['nope'] }, ['mirror']);
  ok(g, 'A', { type: 'play', uids: [uidOf(g, 'A', 'sneak')] });
  assert.equal(botMove(viewFor(g, 'A'), 'A', always, {}), null);
  const memo = {};
  assert.equal(botMove(viewFor(g, 'B'), 'B', never, memo), null);
  // ตัดสินใจไปแล้วสำหรับ window นี้ สุ่มใหม่ก็ไม่เปลี่ยน
  assert.equal(botMove(viewFor(g, 'B'), 'B', always, memo), null);
  const a = botMove(viewFor(g, 'B'), 'B', always, {});
  assert.equal(a.type, 'nope');
  ok(g, 'B', a);
});

test('a dead bot may use its grudge on a living player with cards', () => {
  const g = rig({ A: [], B: ['wind'], C: ['sneak'] }, ['ghost', 'mirror']);
  ok(g, 'A', { type: 'draw' });
  const a = botMove(viewFor(g, 'A'), 'A', always, {});
  assert.equal(a.type, 'grudge');
  ok(g, 'A', a);
  assert.equal(botMove(viewFor(g, 'A'), 'A', always, {}), null);
});

test('a watcher (no hand) or a finished game: does nothing', () => {
  const g = rig({ A: [], B: [] }, ['ghost']);
  assert.equal(botMove(viewFor(g, null), 'Z', R, {}), null);
  ok(g, 'A', { type: 'draw' });
  assert.equal(botMove(viewFor(g, 'B'), 'B', R, {}), null);
});
