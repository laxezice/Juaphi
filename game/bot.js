// จั่วผี: สมองบอต ดูจากมุมมองของบอตเอง (viewFor) เหมือนผู้เล่นคนหนึ่ง ไม่แอบดูกองหรือมือคนอื่น
// คืนคำสั่งหนึ่งคำสั่ง (รูปเดียวกับที่ผู้เล่นส่ง) หรือ null ถ้ายังไม่ต้องทำอะไร
// memo: ของประจำตัวบอตแต่ละตัว ใช้จำว่าตัดสินใจเรื่อง "ไม่!" ของ window นี้ไปแล้ว

const PLAY_CHANCE = 0.45;   // ตาตัวเอง โอกาสเล่นการ์ดก่อนจั่ว
const NOPE_CHANCE = 0.3;    // คนอื่นเล่นการ์ด โอกาสกด "ไม่!"
const GRUDGE_CHANCE = 0.25; // ตายแล้ว โอกาสใช้อาฆาตในแต่ละครั้งที่สถานการณ์เปลี่ยน
const SINGLE = ['sneak', 'curse', 'curse2', 'mirror', 'wind'];
const IMPS = ['imp1', 'imp2', 'imp3', 'imp4', 'imp5'];

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function botMove(v, you, rng, memo) {
  const me = v.me;
  if (!me || v.winner) return null;
  const pd = v.pending;
  const others = v.players.filter((p) => p.id !== you && p.alive && p.handCount > 0);

  if (pd && pd.kind === 'window') {
    if (!me.alive || pd.actor === you) return null;
    const key = `${pd.actor}|${pd.kinds.join()}|${pd.target}|${pd.nopeCount}`;
    if (memo.windowKey === key) return memo.windowMove;
    const nope = me.hand.find((c) => c.kind === 'nope');
    const move = nope && rng() < NOPE_CHANCE ? { type: 'nope', uid: nope.uid } : null;
    memo.windowKey = key;
    memo.windowMove = move;
    return move;
  }
  if (pd && pd.kind === 'insert') return pd.player === you ? { type: 'insert', index: Math.floor(rng() * (v.deckCount + 1)) } : null;
  if (pd && pd.kind === 'give') return pd.from === you && me.hand.length ? { type: 'give', uid: pick(me.hand, rng).uid } : null;
  if (pd) return null;

  if (!me.alive) {
    if (me.grudge && others.length && rng() < GRUDGE_CHANCE) return { type: 'grudge', target: pick(others, rng).id };
    return null;
  }
  if (v.current !== you) return null;

  const options = me.hand.filter((c) => SINGLE.includes(c.kind)).map((c) => ({ type: 'play', uids: [c.uid] }));
  if (others.length) {
    for (const c of me.hand.filter((x) => x.kind === 'beg')) options.push({ type: 'play', uids: [c.uid], target: pick(others, rng).id });
    for (const k of IMPS) {
      const same = me.hand.filter((c) => c.kind === k);
      if (same.length >= 2) options.push({ type: 'play', uids: [same[0].uid, same[1].uid], target: pick(others, rng).id });
    }
  }
  if (options.length && rng() < PLAY_CHANCE) return pick(options, rng);
  return { type: 'draw' };
}

module.exports = { botMove };
