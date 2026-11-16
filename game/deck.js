// จั่วผี: จัดชุดการ์ดตามจำนวนคน แจกไพ่ และสับกอง
// deck[0] คือการ์ดใบบนสุดของกอง

const HAND_SIZE = 7;
// (user, 2026-11-16) กองเยอะไป: กองจั่วหลังแจกเหลือเท่านี้ใน 2-4 คน (นับผีกับยันต์สำรองด้วย)
const DECK_AFTER_DEAL = 30;
// (user, 2026-11-16) เกินสี่คน กองหลังแจกเพิ่มคนละ DECK_GROW ใบ
const DECK_GROW = 5;
/** กองจั่วหลังแจกในเกม n คน: 2-4 คน = DECK_AFTER_DEAL, 5 คน = +5, 6 คน = +10 ... */
const deckAfterDeal = (n) => DECK_AFTER_DEAL + DECK_GROW * Math.max(0, n - 4);

// สัดส่วนการ์ดแต่ละแบบ [2-5 คน, 6-8 คน] แก้ตัวเลขกติกาตรงนี้ได้
// ตารางนี้เป็นแค่สัดส่วน: poolCounts ย่อ/ขยายให้กองหลังแจกเหลือ deckAfterDeal(n) ใบ
const DECK_TABLE = {
  nope: [7, 14],
  sneak: [5, 10],
  curse: [4, 8],
  curse2: [1, 2],
  mirror: [6, 12],
  wind: [5, 10],
  beg: [5, 10],
  imp1: [4, 8],
  imp2: [4, 8],
  imp3: [4, 8],
  imp4: [4, 8],
  imp5: [4, 8],
  wild: [3, 6],   // ผีน้อยแปลงร่าง: นับเป็นผีน้อยแบบไหนก็ได้
};
// การ์ดเสริม: ใส่เพิ่มเมื่อหัวห้องเปิดตัวเลือก "การ์ดเสริม"
const EXTRA_TABLE = {
  blackout: [2, 4],  // ไฟดับ
  possess: [2, 4],   // ผีเข้า
  grave: [2, 4],     // ขุดหลุมศพ
  fate: [2, 4],      // ผูกดวง
  reverse: [2, 4],   // เดินถอยหลัง
  bottom: [2, 4],    // จั่วก้นกอง
};
const SPARE_TALISMANS = [2, 3];

/**
 * จำนวนการ์ดแต่ละแบบที่ใส่ในเกม n คน: ย่อหรือขยายตารางตามสัดส่วน ให้กองหลังแจกเหลือ deckAfterDeal(n) ใบพอดี
 * (นับผีกับยันต์สำรองที่ใส่ทีหลังด้วย)
 * (user, 2026-11-16) ปัดเศษเป็นกลุ่ม: ผีน้อยทุกแบบเท่ากัน การ์ดเสริมทุกแบบเท่ากัน ทุกแบบปัดแบบปกติ (ใบที่น้อยอย่าง
 * สาปส่ง ×2 เลยไม่ลดลงเมื่อคนเพิ่ม) แล้วการ์ดเดี่ยวแบ่งที่เหลือตามสัดส่วน
 */
function poolCounts(n, { extras = false } = {}) {
  const col = n >= 6 ? 1 : 0;
  const table = extras ? { ...DECK_TABLE, ...EXTRA_TABLE } : DECK_TABLE;
  const kinds = Object.keys(table);
  const total = kinds.reduce((s, k) => s + table[k][col], 0);
  const target = deckAfterDeal(n) + HAND_SIZE * n - (n - 1) - SPARE_TALISMANS[col];
  const groups = [kinds.filter((k) => /^imp\d$/.test(k)), ...(extras ? [Object.keys(EXTRA_TABLE)] : [])];
  const grouped = new Set(groups.flat());
  const exact = (k) => (table[k][col] * target) / total;
  const out = {};
  for (const g of groups) { const c = Math.max(1, Math.round(exact(g[0]))); for (const k of g) out[k] = c; }
  // การ์ดเดี่ยวแบ่งที่เหลือตามสัดส่วนของมันเอง แล้วส่วนต่างจากการปัดเพิ่มลดที่ใบเยอะสุดก่อน (เท่ากันใช้ลำดับในตาราง)
  const singles = kinds.filter((k) => !grouped.has(k));
  const room = target - [...grouped].reduce((s, k) => s + out[k], 0);
  const singlesTotal = singles.reduce((s, k) => s + table[k][col], 0);
  const share = (k) => (table[k][col] * room) / singlesTotal;
  for (const k of singles) out[k] = Math.max(1, Math.floor(share(k)));
  let left = target - kinds.reduce((s, k) => s + out[k], 0);
  // ที่ยังขาด: ให้ใบที่เศษเหลือมากสุดก่อน (ใบที่ได้ขั้นต่ำ 1 ไปแล้วเศษติดลบ ไม่ได้เพิ่ม)
  const byRest = [...singles].sort((x, y) => (share(y) - out[y]) - (share(x) - out[x]));
  for (let i = 0; left > 0; i = (i + 1) % byRest.length) { out[byRest[i]] += 1; left -= 1; }
  // ขั้นต่ำ 1 ใบทำให้เกิน: ลดจากใบที่มีมากสุด
  while (left < 0) { const k = singles.reduce((x, y) => (out[y] > out[x] ? y : x)); out[k] -= 1; left += 1; }
  return out;
}

/** ตัวสุ่มที่กำหนดผลได้ (mulberry32) ใช้ในเทสต์ */
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates สับในที่ คืน array เดิม */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * แจกการ์ดตอนเริ่มเกม ทุกคนได้ยันต์ 1 ใบ + การ์ด HAND_SIZE ใบจากกองที่ยังไม่มีผี/ยันต์
 * แล้วค่อยใส่ผี (จำนวนคน - 1) กับยันต์สำรองลงกองแล้วสับ
 * evil = ห้องเปิด "ผีร้าย": ผีใบหนึ่งในนั้นเป็นผีร้าย (จำนวนผีรวมเท่าเดิม)
 * @returns {{ hands: {uid:string,kind:string}[][], deck: {uid:string,kind:string}[] }}
 */
function buildDeck(playerCount, rng, { extras = false, evil = false } = {}) {
  const col = playerCount >= 6 ? 1 : 0;
  let n = 0;
  const card = (kind) => ({ uid: 'c' + (++n), kind });
  const pool = [];
  for (const [kind, count] of Object.entries(poolCounts(playerCount, { extras }))) {
    for (let i = 0; i < count; i++) pool.push(card(kind));
  }
  shuffle(pool, rng);
  const hands = [];
  for (let p = 0; p < playerCount; p++) {
    hands.push([card('talisman'), ...pool.splice(0, HAND_SIZE)]);
  }
  for (let i = 0; i < playerCount - 1; i++) pool.push(card(evil && i === 0 ? 'evil' : 'ghost'));
  for (let i = 0; i < SPARE_TALISMANS[col]; i++) pool.push(card('talisman'));
  shuffle(pool, rng);
  return { hands, deck: pool };
}

module.exports = { HAND_SIZE, DECK_AFTER_DEAL, DECK_GROW, deckAfterDeal, DECK_TABLE, EXTRA_TABLE, SPARE_TALISMANS, poolCounts, makeRng, shuffle, buildDeck };
