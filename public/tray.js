// แถวเลือกการ์ดแบบเห็นภาพ (แบบเดียวกับ VanguardG): ป้ายคำสั่งด้านบน การ์ดใหญ่เรียงด้านล่าง
// แตะการ์ดเพื่อเลือก (ยกขึ้นพร้อมเรืองทอง) แล้วกดยืนยัน ในมือถือปัดแถวการ์ดซ้ายขวาได้
// และแผงเต็มจอ (รายการการ์ด, คอมโบ)
import { CARD_INFO, cardFaceUrl } from './cards.js';
import { attachTrayScroll } from './tray-scroll.js';

const $ = (id) => document.getElementById(id);
let current = null;   // { key, resolve }
let listener = () => {};

/** ui บอกฉาก 3 มิติให้ซ่อนการ์ดในมือตอนแถวนี้เปิด */
export function onTrayChange(fn) { listener = fn; }
export const trayKey = () => (current ? current.key : null);

function showTray() {
  $('tray-layer').hidden = false;
  document.body.classList.add('tray-open');
  const row = $('tray-cards');
  row.tabIndex = 0;
  row.setAttribute('aria-label', 'แถวการ์ด ใช้ลูกศรซ้ายขวาเพื่อเลื่อน');
  attachTrayScroll(row, { prev: $('tray-prev'), next: $('tray-next'), hint: $('tray-help') }).reset();
}

function makePickable(el, choose) {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-pressed', 'false');
  el.onclick = choose;
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) choose(); }
  };
}

/** รูปการ์ดหนึ่งใบ (ภาพจริงถ้ามี ไม่มีก็การ์ดที่วาดเอง) */
export function cardEl(kind, { tag, cls = '' } = {}) {
  const el = document.createElement('div');
  el.className = `tcard ${cls}`.trim();
  el.title = CARD_INFO[kind]?.name || kind;
  el.style.setProperty('--c', CARD_INFO[kind]?.color || '#333');
  const img = document.createElement('img');
  img.alt = CARD_INFO[kind]?.name || kind;
  img.draggable = false;
  cardFaceUrl(kind).then((u) => { img.src = u; });
  el.append(img);
  if (tag) {
    const t = document.createElement('span');
    t.className = 'ttag';
    t.textContent = tag;
    el.append(t);
  }
  return el;
}

/**
 * เปิดแถวเลือกการ์ด
 * cards: [{ kind, key, tag? }]  pick: 1 = เลือกหนึ่งใบ, 0 = ดูอย่างเดียว
 * confirm: ข้อความปุ่มยืนยัน หรือฟังก์ชัน (card) => ข้อความ   cancel: ข้อความปุ่มยกเลิก หรือ null ถ้ายกเลิกไม่ได้
 * คืน key ของการ์ดที่เลือก (pick 1), true (pick 0 กดปุ่ม), หรือ null ถ้ายกเลิก/ถูกปิด
 */
export function openTray({ key, title, detail = '', tagText = 'เลือกการ์ด', cards, pick = 1, confirm = 'ยืนยัน', cancel = 'ยกเลิก' }) {
  closeTray();
  $('tray-tag').textContent = tagText;
  $('tray-title').textContent = title;
  $('tray-detail').textContent = detail;
  $('tray-detail').hidden = !detail;
  const row = $('tray-cards');
  row.innerHTML = '';
  let chosen = null;
  const ok = $('tray-ok');
  const label = () => (typeof confirm === 'function' ? (chosen !== null ? confirm(cards.find((c) => c.key === chosen)) : 'เลือกการ์ดก่อน') : confirm);
  const refresh = () => {
    ok.textContent = label();
    ok.disabled = pick === 1 && chosen === null;
    for (const el of row.children) {
      const selected = chosen !== null && el.dataset.key === String(chosen);
      el.classList.toggle('selected', selected);
      if (pick) el.setAttribute('aria-pressed', String(selected));
    }
  };
  cards.forEach((c, i) => {
    const el = cardEl(c.kind, { tag: c.tag, cls: pick ? 'pickable' : '' });
    el.dataset.key = String(c.key);
    el.style.animationDelay = `${Math.min(i, 10) * 25}ms`;
    if (pick) {
      makePickable(el, () => { chosen = chosen === c.key ? null : c.key; refresh(); });
      // แตะซ้ำใบที่เลือกอยู่ = ยืนยันเลย
      el.ondblclick = () => { chosen = c.key; refresh(); ok.click(); };
    }
    row.append(el);
  });
  $('tray-cancel').hidden = !cancel;
  if (cancel) $('tray-cancel').textContent = cancel;
  showTray();
  refresh();
  listener(true);
  return new Promise((resolve) => {
    current = { key, resolve };
    ok.onclick = () => finish(pick === 1 ? chosen : true);
    $('tray-cancel').onclick = () => finish(null);
  });
}

/**
 * แถวเรียงลำดับการ์ด: แตะการ์ดตามลำดับที่ต้องการ ตัวเลขบนการ์ดคือลำดับ (1 = แรกสุด)
 * ใบที่ยังไม่ได้แตะต่อท้ายตามลำดับเดิม (เลขจาง) แตะซ้ำ = เอาออก ปุ่มซ้าย = เริ่มใหม่
 * คืน key ทุกใบตามลำดับใหม่ หรือ null ถ้าถูกปิด
 */
export function openOrderTray({ key, title, detail = '', tagText = 'เรียงการ์ด', cards }) {
  closeTray();
  $('tray-tag').textContent = tagText;
  $('tray-title').textContent = title;
  $('tray-detail').textContent = detail;
  $('tray-detail').hidden = !detail;
  const row = $('tray-cards');
  row.innerHTML = '';
  let chosen = [];
  const order = () => [...chosen, ...cards.map((c) => c.key).filter((k) => !chosen.includes(k))];
  const ok = $('tray-ok');
  const reset = $('tray-cancel');
  const els = cards.map((c, i) => {
    const el = cardEl(c.kind, { tag: c.tag, cls: 'pickable' });
    el.dataset.key = String(c.key);
    el.style.animationDelay = `${Math.min(i, 10) * 25}ms`;
    const num = document.createElement('span');
    num.className = 'torder';
    el.append(num);
    makePickable(el, () => {
      const at = chosen.indexOf(c.key);
      if (at >= 0) chosen.splice(at, 1); else chosen.push(c.key);
      refresh();
    });
    row.append(el);
    return el;
  });
  function refresh() {
    const o = order();
    els.forEach((el, i) => {
      const k = cards[i].key;
      const set = chosen.includes(k);
      const num = el.querySelector('.torder');
      num.textContent = String(o.indexOf(k) + 1);
      num.classList.toggle('set', set);
      el.classList.toggle('selected', set);
      el.setAttribute('aria-pressed', String(set));
    });
    ok.textContent = chosen.length ? 'ยืนยันลำดับนี้' : 'คงลำดับเดิม';
    ok.disabled = false;
    reset.hidden = !chosen.length;
  }
  reset.textContent = 'เริ่มใหม่';
  showTray();
  refresh();
  listener(true);
  return new Promise((resolve) => {
    current = { key, resolve };
    ok.onclick = () => finish(order());
    reset.onclick = () => { chosen = []; refresh(); };
  });
}

function finish(value) {
  const c = current;
  current = null;
  $('tray-layer').hidden = true;
  document.body.classList.remove('tray-open');
  listener(false);
  if (c) c.resolve(value);
}

/** ปิดแถว (สถานการณ์เปลี่ยน) ตอบ null */
export function closeTray() { if (current) finish(null); }

// ---------- แผงเต็มจอ ----------
export function openPanel(title, build) {
  $('panel-title').textContent = title;
  const body = $('panel-body');
  body.innerHTML = '';
  build(body);
  $('panel').hidden = false;
  $('panel').scrollTop = 0;
}
export function closePanel() { $('panel').hidden = true; }
