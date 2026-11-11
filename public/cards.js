// ข้อมูลการ์ดที่หน้าเว็บใช้ ชื่อ คำอธิบายสั้น และสี
export const CARD_INFO = {
  ghost: { name: 'ผี', text: 'จั่วได้แล้วไม่มียันต์ = ตกรอบ', color: '#7a1f2b' },
  talisman: { name: 'ยันต์', text: 'ปัดเป่าผีให้เอง แล้วเสียบผีกลับเข้ากอง', color: '#b8862b' },
  nope: { name: 'ไม่!', text: 'ยกเลิกการ์ดที่เพิ่งเล่น ใช้ซ้อนกันได้', color: '#b0352f' },
  sneak: { name: 'ย่องหนี', text: 'จบตาโดยไม่ต้องจั่ว', color: '#2f6f8f' },
  curse: { name: 'สาปส่ง', text: 'จบตาไม่ต้องจั่ว คนถัดไปเล่น 2 ตา', color: '#6b3fa0' },
  curse2: { name: 'สาปส่ง ×2', text: 'จบตาไม่ต้องจั่ว คนถัดไปเล่น 3 ตา', color: '#4e2a86' },
  mirror: { name: 'ส่องกระจก', text: 'แอบดูการ์ด 3 ใบบนกอง', color: '#3f8f7a' },
  wind: { name: 'ลมพัด', text: 'สับกองจั่ว', color: '#4d7f9e' },
  beg: { name: 'ขอของ', text: 'เลือกเพื่อน ให้เขายกการ์ดให้ 1 ใบ', color: '#a0613f' },
  imp1: { name: 'กุมารทอง', imp: true, text: 'ผีน้อย · คู่ = ขโมย · สามใบ = ทวง', color: '#9c7a1c' },
  imp2: { name: 'กระสือ', imp: true, text: 'ผีน้อย · คู่ = ขโมย · สามใบ = ทวง', color: '#5a7f9c' },
  imp3: { name: 'กระหัง', imp: true, text: 'ผีน้อย · คู่ = ขโมย · สามใบ = ทวง', color: '#8a7a4a' },
  imp4: { name: 'ปอบ', imp: true, text: 'ผีน้อย · คู่ = ขโมย · สามใบ = ทวง', color: '#8f2f3a' },
  imp5: { name: 'ตานี', imp: true, text: 'ผีน้อย · คู่ = ขโมย · สามใบ = ทวง', color: '#3f7a3f' },
};

export const KIND_ORDER = Object.keys(CARD_INFO);

// ---------- วาดหน้าการ์ดลง canvas (ใช้เป็น texture ในฉาก 3 มิติ) ----------
const GLYPH = { ghost: 'ผี', talisman: 'ยันต์', nope: 'ไม่!', curse2: '×2', mirror: '◎', wind: '〜' };
export const CARD_W = 500;
export const CARD_H = 700; // 5:7

// เลขรุ่นจาก index.html ต่อท้าย URL ภาพ deploy ใหม่แล้วได้ภาพใหม่ทันที
const VERSION = (typeof document !== 'undefined' && document.querySelector('meta[name=juaphi-version]')?.content) || '';
let artList = null;
/** id การ์ด -> ชื่อไฟล์ภาพ ถ้ามีทั้ง .webp และ .png ใช้ .webp เพราะเล็กกว่ามาก */
async function availableArt() {
  if (!artList) {
    artList = fetch('/api/art').then((r) => r.json()).then((files) => {
      const map = new Map();
      for (const f of files) {
        const [id, ext] = f.split('.');
        if (!map.has(id) || ext === 'webp') map.set(id, f);
      }
      return map;
    }).catch(() => new Map());
  }
  return artList;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** ตัดบรรทัดภาษาไทยตามคำ (ไม่ตัดกลางคำ) */
function wrapThai(ctx, text, maxW) {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  const words = seg ? [...seg.segment(text)].map((s) => s.segment) : text.split(/(\s+)/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && ctx.measureText(line + w).width > maxW) { lines.push(line.trim()); line = w.trimStart(); }
    else line += w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let fontsReady = null;
function waitFonts() {
  if (!fontsReady) {
    fontsReady = document.fonts
      ? Promise.all([document.fonts.load('600 60px Mitr', 'ผี'), document.fonts.load('400 30px Sarabun', 'ผี')]).catch(() => {})
      : Promise.resolve();
  }
  return fontsReady;
}

/** หน้าการ์ด: ภาพจาก public/cards/<kind>.png ถ้ามี ไม่มีก็ใช้สีพื้น แล้วเขียนชื่อกับคำอธิบายทับแถบล่าง */
export async function drawCardFace(kind) {
  await waitFonts();
  const info = CARD_INFO[kind];
  const c = document.createElement('canvas');
  c.width = CARD_W; c.height = CARD_H;
  const ctx = c.getContext('2d');
  const file = (await availableArt()).get(kind);
  const art = file ? await loadImage(`/cards/${file}?v=${VERSION}`) : null;

  roundRect(ctx, 0, 0, CARD_W, CARD_H, 36);
  ctx.save();
  ctx.clip();
  if (art) ctx.drawImage(art, 0, 0, CARD_W, CARD_H);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
    g.addColorStop(0, info.color);
    g.addColorStop(1, '#120f1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    // ลายยันต์จางๆ ตรงกลาง
    ctx.strokeStyle = 'rgba(255,230,180,0.18)';
    ctx.lineWidth = 4;
    for (let r = 50; r <= 150; r += 50) { ctx.beginPath(); ctx.arc(CARD_W / 2, 250, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.moveTo(CARD_W / 2, 250);
      ctx.lineTo(CARD_W / 2 + Math.cos(a) * 150, 250 + Math.sin(a) * 150);
    }
    ctx.stroke();
    // อักษรตัวแรกของชื่อใหญ่ๆ กลางวง ให้แยกการ์ดออกได้ในพริบตา
    ctx.fillStyle = 'rgba(255,240,210,0.92)';
    ctx.font = '600 150px Mitr, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(GLYPH[kind] || info.name.slice(0, 1), CARD_W / 2, 255);
  }
  // แถบล่าง
  const band = ctx.createLinearGradient(0, CARD_H * 0.62, 0, CARD_H);
  band.addColorStop(0, 'rgba(10,8,16,0)');
  band.addColorStop(0.25, 'rgba(10,8,16,0.85)');
  band.addColorStop(1, 'rgba(10,8,16,0.95)');
  ctx.fillStyle = band;
  ctx.fillRect(0, CARD_H * 0.62, CARD_W, CARD_H * 0.38);
  // แถบชื่อด้านบน อ่านได้แม้การ์ดซ้อนกันในมือ
  const topBand = ctx.createLinearGradient(0, 0, 0, 120);
  topBand.addColorStop(0, 'rgba(10,8,16,0.92)');
  topBand.addColorStop(0.7, 'rgba(10,8,16,0.75)');
  topBand.addColorStop(1, 'rgba(10,8,16,0)');
  ctx.fillStyle = topBand;
  ctx.fillRect(0, 0, CARD_W, 120);
  ctx.fillStyle = info.color;
  ctx.fillRect(0, 0, 16, 92);
  ctx.fillStyle = '#ffe9b8';
  ctx.font = '600 62px Mitr, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(info.name, 34, 72);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffe9b8';
  ctx.font = '600 58px Mitr, sans-serif';
  ctx.fillText(info.imp ? `ผีน้อย ${info.name}` : info.name, CARD_W / 2, CARD_H * 0.76);
  ctx.fillStyle = 'rgba(241,233,218,0.92)';
  ctx.font = '400 30px Sarabun, sans-serif';
  wrapThai(ctx, info.text, CARD_W - 70).slice(0, 3).forEach((l, i) => ctx.fillText(l, CARD_W / 2, CARD_H * 0.84 + i * 36));

  ctx.lineWidth = 10;
  ctx.strokeStyle = info.color;
  roundRect(ctx, 5, 5, CARD_W - 10, CARD_H - 10, 32);
  ctx.stroke();
  return c;
}

/** หลังการ์ด: public/cards/back.png ถ้ามี ไม่มีก็วาดลายยันต์ */
export async function drawCardBack() {
  const c = document.createElement('canvas');
  c.width = CARD_W; c.height = CARD_H;
  const ctx = c.getContext('2d');
  const backFile = (await availableArt()).get('back');
  const art = backFile ? await loadImage(`/cards/${backFile}?v=${VERSION}`) : null;
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 36);
  ctx.clip();
  if (art) { ctx.drawImage(art, 0, 0, CARD_W, CARD_H); return c; }
  const g = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, 40, CARD_W / 2, CARD_H / 2, CARD_H * 0.7);
  g.addColorStop(0, '#5a1a22');
  g.addColorStop(1, '#14080c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = 'rgba(230,176,77,0.75)';
  ctx.lineWidth = 6;
  roundRect(ctx, 24, 24, CARD_W - 48, CARD_H - 48, 24);
  ctx.stroke();
  ctx.lineWidth = 4;
  const cx = CARD_W / 2, cy = CARD_H / 2;
  for (let r = 40; r <= 160; r += 40) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const b = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 3;
    ctx.moveTo(cx + Math.cos(a) * 160, cy + Math.sin(a) * 160);
    ctx.lineTo(cx + Math.cos(b) * 160, cy + Math.sin(b) * 160);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,176,77,0.9)';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200, 6, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}
const SINGLE = new Set(['sneak', 'curse', 'curse2', 'mirror', 'wind', 'beg']);

/**
 * ดูว่าการ์ดที่เลือกเล่นได้ไหม
 * @returns {{ ok: boolean, label: string, needTarget?: boolean, needName?: boolean }}
 */
export function describeSelection(cards) {
  if (!cards.length) return { ok: false, label: 'เลือกการ์ดที่จะเล่น' };
  const k = cards[0].kind;
  const same = cards.every((c) => c.kind === k);
  if (cards.length === 1 && SINGLE.has(k)) return { ok: true, label: `เล่น ${CARD_INFO[k].name}`, needTarget: k === 'beg' };
  if (same && CARD_INFO[k].imp && cards.length === 2) return { ok: true, label: 'ขโมยการ์ด (คู่ผีน้อย)', needTarget: true };
  if (same && CARD_INFO[k].imp && cards.length === 3) return { ok: true, label: 'ทวงการ์ด (ผีน้อยสามใบ)', needTarget: true, needName: true };
  if (cards.length === 1 && CARD_INFO[k].imp) return { ok: false, label: 'ผีน้อยต้องเลือกคู่หรือสามใบแบบเดียวกัน' };
  if (cards.length === 1 && k === 'nope') return { ok: false, label: '"ไม่!" ใช้ตอนคนอื่นเล่นการ์ด' };
  if (cards.length === 1) return { ok: false, label: 'การ์ดใบนี้เล่นเองไม่ได้' };
  return { ok: false, label: 'การ์ดชุดนี้เล่นด้วยกันไม่ได้' };
}
