// จั่วผี: สิ่งที่ผู้เล่นแต่ละคนเห็นได้ เซิร์ฟเวอร์ส่งแค่สิ่งที่ฟังก์ชันนี้คืนให้
// ห้ามใส่ลำดับกอง มือคนอื่น หรือตำแหน่งเสียบผีลงในนี้

const { diggable } = require('./game');

function publicPending(pd) {
  if (!pd) return null;
  switch (pd.kind) {
    case 'insert': return { kind: 'insert', player: pd.player };
    case 'give': return { kind: 'give', from: pd.from, to: pd.to };
    case 'dig': return { kind: 'dig', player: pd.player };
    case 'fate': return { kind: 'fate', player: pd.player, n: pd.n };
    case 'window': return {
      kind: 'window',
      actor: pd.actor,
      kinds: pd.play.cards.map((c) => c.kind),
      target: pd.play.target ?? null,
      name: pd.play.name ?? null,
      nopeCount: pd.nopes.length,
    };
    default: return { kind: pd.kind };
  }
}

/** @param {string|null} playerId null = คนดู */
function viewFor(g, playerId) {
  const v = {
    players: g.players.map((p) => ({ id: p.id, handCount: p.hand.length, alive: p.alive, grudge: p.grudge })),
    deckCount: g.deck.length,
    discardTop: g.discard.length ? g.discard[g.discard.length - 1] : null,
    current: g.current,
    turnsLeft: g.turnsLeft,
    cursed: g.cursed,
    dir: g.dir === -1 ? -1 : 1,
    extras: !!g.extras,   // คนที่ถึงตากำลังโดนสาปอยู่ไหม (หน้าเว็บใช้คำนวณว่าสาปต่อจะทบเป็นกี่ตา)
    pending: publicPending(g.pending),
    winner: g.winner,
  };
  const me = playerId != null && g.players.find((p) => p.id === playerId);
  if (me) {
    v.me = { hand: me.hand, alive: me.alive, grudge: me.grudge };
    const pd = g.pending;
    // ตัวเลือกส่วนตัวของคนที่ต้องเลือกอยู่: การ์ดในกองทิ้งที่ขุดได้ / การ์ดบนกองที่จะเรียงใหม่
    if (pd && pd.kind === 'dig' && pd.player === me.id) v.me.dig = diggable(g);
    if (pd && pd.kind === 'fate' && pd.player === me.id) v.me.fate = g.deck.slice(0, pd.n);
  }
  return v;
}

module.exports = { viewFor };
