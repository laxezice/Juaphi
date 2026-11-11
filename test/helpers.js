// ตัวช่วยสร้างสถานะเกมแบบกำหนดเองในเทสต์
const { createGame } = require('../game/game');
const { makeRng } = require('../game/deck');

let n = 1000;
const c = (kind) => ({ uid: 'x' + (++n), kind });

/**
 * สร้างเกมแล้วแทนที่มือและกองด้วยการ์ดที่ระบุ
 * hands: { A: ['talisman','sneak'], ... }  deck: ['mirror','ghost',...] (ตัวแรก = บนสุด)
 */
function rig(hands, deck, seed = 1) {
  const ids = Object.keys(hands);
  const g = createGame(ids, makeRng(seed));
  for (const p of g.players) p.hand = hands[p.id].map(c);
  g.deck = deck.map(c);
  g.discard = [];
  return g;
}

const player = (g, id) => g.players.find((p) => p.id === id);
const kinds = (cards) => cards.map((x) => x.kind);
const uidOf = (g, id, kind) => player(g, id).hand.find((x) => x.kind === kind).uid;
const snap = (g) => JSON.parse(JSON.stringify(g));

module.exports = { rig, player, kinds, uidOf, snap, makeRng };
