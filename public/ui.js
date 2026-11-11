// หน้าจอทั้งหมดที่เป็น HTML: หน้าแรก ห้องรอ ปุ่มในเกม กล่องเลือก และบันทึกเหตุการณ์
import { net, on, connect, send, setName, createRoom, joinRoom, leaveRoom, act, forgetRoom } from './net.js';
import { CARD_INFO, KIND_ORDER, EXTRA_KINDS, kindsFor, describeSelection, deckCount } from './cards.js';
import { openTray, openOrderTray, closeTray, trayKey, onTrayChange, cardEl, openPanel, closePanel } from './tray.js';
import * as sound from './sound.js';
import { revealGhost } from './reveal.js';

const $ = (id) => document.getElementById(id);
const NOPE_MS = 2500;
const MAX_SEATS = 8;   // ต้องตรงกับ server.js
const RING_LEN = 2 * Math.PI * 46;   // เส้นรอบวงของวงแหวนนับเวลารอบปุ่ม ไม่! (r = 46 ใน index.html)
let scene = null;
let selected = new Set();
let modalKey = null;      // กล่องที่เปิดอยู่เพื่อเรื่องอะไร
let modalResolve = null;
let targetIds = null;     // id ที่แตะป้ายชื่อเลือกได้ตอนกำลังเลือกเป้าหมาย
let pendingInvite = null; // เปิดลิงก์เชิญแต่ยังไม่ได้ใส่ชื่อ

const S = () => net.state;
const G = () => net.state && net.state.game;
const nameOf = (id) => {
  const s = S();
  if (!s) return '?';
  if (id === s.you) return 'คุณ';
  return s.room.names[id] || s.room.players.find((p) => p.id === id)?.name || '?';
};
const cardName = (k) => (CARD_INFO[k]?.imp ? `ผีน้อย${CARD_INFO[k].name}` : CARD_INFO[k]?.name || k);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- ข้อความแจ้ง ----------
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

function log(text) {
  const d = document.createElement('div');
  d.textContent = text;
  $('log').append(d);
  while ($('log').children.length > 5) $('log').firstChild.remove();
  setTimeout(() => d.remove(), 6000);
}

/** อธิบายอีเวนต์เป็นภาษาคน */
export function describe(e, you, nameOf) {
  const n = nameOf;
  switch (e.type) {
    case 'start':
      if (!e.player) return 'เริ่มเกม! ระวังผีในกอง';
      return `เริ่มเกม! ${n(e.player)} เริ่มก่อน${e.reason === 'firstOut' ? ' (ตกรอบคนแรกเมื่อรอบที่แล้ว)' : ' (สุ่ม)'}`;
    case 'draw': {
      const how = e.for ? `โดนผีเข้า จั่วแทน ${n(e.for)}` : e.bottom ? 'จั่วก้นกอง' : 'จั่ว';
      return e.player === you && e.card ? `คุณ${how}ได้ ${cardName(e.card.kind)}` : `${n(e.player)} ${how}การ์ด`;
    }
    case 'possess': return e.empty ? null : `${n(e.from)} ทำให้ผีเข้า ${n(e.to)}!`;
    case 'blackout': return 'ไฟดับ! ทุกคนส่งการ์ดสุ่มให้คนถัดไป';
    case 'pass':
      if (!e.card) return null;
      return e.to === you ? `ในความมืด คุณได้ ${cardName(e.card.kind)} จาก ${n(e.from)}` : `ในความมืด คุณเสีย ${cardName(e.card.kind)} ให้ ${n(e.to)}`;
    case 'dig': return e.empty ? 'กองทิ้งไม่มีอะไรให้ขุด' : `${n(e.player)} ขุด ${cardName(e.card.kind)} ขึ้นจากหลุมศพ`;
    case 'fate': return `${n(e.player)} ผูกดวงการ์ด ${e.n} ใบบนกอง`;
    case 'reverse': return 'เดินถอยหลัง! ลำดับการเล่นกลับทิศ';
    case 'ghost': return e.saved ? `${n(e.player)} จั่วได้ผี! แต่มียันต์ปัดเป่าไว้` : `${n(e.player)} โดนผีหลอก ตกรอบ!`;
    case 'insert': return `${n(e.player)} แอบเสียบผีกลับเข้ากอง`;
    case 'play': {
      const ks = e.kinds;
      const what = ks.length > 1 ? `ผีน้อย${CARD_INFO[ks[0]].name} ${ks.length} ใบ` : cardName(ks[0]);
      return `${n(e.player)} เล่น ${what}${e.target ? ` ใส่ ${n(e.target)}` : ''}${e.name ? ` (ทวง ${cardName(e.name)})` : ''}`;
    }
    case 'nope': return `${n(e.player)}: ไม่!`;
    case 'resolve': return e.cancelled ? `${cardName(e.kinds[0])} ถูกยกเลิก` : null;
    case 'mirror': return e.player === you ? null : `${n(e.player)} ส่องกระจกดูการ์ดบนกอง`;
    case 'wind': return 'ลมพัด! กองถูกสับ';
    case 'give':
      if (e.empty) return `${n(e.from)} ไม่มีการ์ดให้`;
      return e.card ? `${n(e.from)} ให้ ${cardName(e.card.kind)} กับ ${n(e.to)}` : `${n(e.from)} ยกการ์ดให้ ${n(e.to)}`;
    case 'steal':
      if (e.empty) return `${n(e.from)} ไม่มีการ์ดให้ขโมย`;
      return e.card ? `${n(e.to)} ขโมย ${cardName(e.card.kind)} จาก ${n(e.from)}` : `${n(e.to)} ขโมยการ์ดจาก ${n(e.from)}`;
    case 'demand': return e.got ? `${n(e.to)} ทวง ${cardName(e.name)} จาก ${n(e.from)} ได้` : `${n(e.from)} ไม่มี ${cardName(e.name)}`;
    case 'grudge': return `วิญญาณ ${n(e.from)} อาฆาต ${n(e.to)}! ${cardName(e.card.kind)} ถูกทิ้ง`;
    case 'left': return `${n(e.player)} ออกจากเกม`;
    case 'win': return `${n(e.player)} รอดคนสุดท้าย ชนะ!`;
    default: return null;
  }
}

// ---------- กล่องเลือก ----------
function openModal(key, title, build, { grid = false, cancellable = true } = {}) {
  closeModal();
  modalKey = key;
  $('modal-title').textContent = title;
  const body = $('modal-body');
  body.innerHTML = '';
  body.classList.toggle('grid', grid);
  $('modal-cancel').hidden = !cancellable;
  $('modal-cancel').textContent = 'ยกเลิก';
  $('modal').hidden = false;
  return new Promise((resolve) => {
    modalResolve = resolve;
    build(body, finishModal);
  });
}

/** ปิดกล่องพร้อมคำตอบ (ต่างจาก closeModal ที่ตอบ null) */
function finishModal(value) {
  const r = modalResolve;
  modalResolve = null;
  closeModal();
  if (r) r(value);
}

function closeModal() {
  const r = modalResolve;
  modalKey = null;
  modalResolve = null;
  targetIds = null;
  $('modal').hidden = true;
  if (r) r(null);
}

function cardFace(kind) {
  const info = CARD_INFO[kind];
  const d = document.createElement('div');
  d.className = 'cardface';
  d.style.background = info.color;
  d.innerHTML = `<span>${esc(info.imp ? `ผีน้อย ${info.name}` : info.name)}</span><small>${esc(info.text)}</small>`;
  return d;
}

function chip(label, onClick) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

/** needCards: ต้องมีการ์ดในมือถึงเลือกได้ (ผีเข้าเลือกคนมือว่างได้) */
function pickTarget(title, { needCards = true } = {}) {
  const g = G();
  const ids = g.players.filter((p) => p.alive && (!needCards || p.handCount > 0) && p.id !== S().you).map((p) => p.id);
  if (!ids.length) { toast('ไม่มีใครมีการ์ดให้เลือก'); return Promise.resolve(null); }
  const pr = openModal('target', title, (body, done) => {
    for (const id of ids) {
      const p = g.players.find((x) => x.id === id);
      body.append(chip(`${nameOf(id)} · ${p.handCount} ใบ`, () => done(id)));
    }
  });
  targetIds = { ids, done: finishModal };
  return pr;
}

function pickName(target) {
  return openTray({
    key: 'name',
    title: 'ทวงการ์ดอะไร?',
    detail: `ถ้า ${nameOf(target)} มีการ์ดใบนี้ ต้องยกให้คุณ ถ้าไม่มีก็ไม่ได้อะไร`,
    cards: kindsFor(G() && G().extras).map((k) => ({ kind: k, key: k })),
    confirm: (c) => `ทวง ${cardName(c.kind)}`,
  });
}

// ---------- การเล่น ----------
function handCards() {
  const g = G();
  return g && g.me ? g.me.hand : [];
}

function toggleCard(uid) {
  const g = G();
  if (!g || !g.me || !g.me.alive) return;
  if (selected.has(uid)) selected.delete(uid);
  else {
    // เลือกการ์ดคนละแบบ = เริ่มเลือกใหม่ ยกเว้นผีน้อยแบบเดียวกัน
    const card = handCards().find((c) => c.uid === uid);
    const first = handCards().find((c) => selected.has(c.uid));
    if (first && (first.kind !== card.kind || !CARD_INFO[card.kind].imp || selected.size >= 3)) selected.clear();
    selected.add(uid);
  }
  render();
}

async function playSelected() {
  const cards = handCards().filter((c) => selected.has(c.uid));
  const sel = describeSelection(cards);
  if (!sel.ok) return toast(sel.label);
  const action = { type: 'play', uids: cards.map((c) => c.uid) };
  if (sel.needTarget) {
    const possess = cards[0].kind === 'possess';
    const title = possess ? 'ให้ผีเข้าใคร? (เขาจั่วแทนคุณ)' : cards.length > 1 ? 'ขโมยการ์ดจากใคร?' : 'ขอการ์ดจากใคร?';
    action.target = await pickTarget(title, { needCards: !possess });
    if (!action.target) return;
  }
  if (sel.needName) {
    action.name = await pickName(action.target);
    if (!action.name) return;
  }
  selected.clear();
  act(action);
}

function showMirror(cards) {
  if (!cards.length) return toast('ส่องกระจก: กองว่าง');
  openTray({
    key: 'mirror',
    tagText: 'ส่องกระจก',
    title: `การ์ด ${cards.length} ใบบนกอง`,
    detail: 'ซ้ายสุดคือใบที่จะถูกจั่วต่อไป เห็นแค่คุณคนเดียว',
    cards: cards.map((c, i) => ({ kind: c.kind, key: i, tag: i === 0 ? 'บนสุด' : `ใบที่ ${i + 1}` })),
    pick: 0,
    confirm: 'จำไว้แล้ว',
    cancel: null,
  });
}

function openInsert(g) {
  const n = g.deckCount;
  openModal('insert', 'เสียบผีกลับเข้ากองตรงไหน?', (body, done) => {
    const range = document.createElement('input');
    range.type = 'range'; range.min = 0; range.max = n; range.value = 0;
    const out = document.createElement('div');
    const labels = document.createElement('div');
    labels.className = 'range-labels';
    labels.innerHTML = '<span>บนสุด</span><span>ใต้สุด</span>';
    const say = () => {
      const v = Number(range.value);
      out.textContent = v === 0 ? 'บนสุด (คนถัดไปจั่วได้ทันที)' : v === n ? 'ใต้สุดของกอง' : `ใบที่ ${v + 1} จากบน`;
    };
    range.oninput = say; say();
    body.append(out, range, labels, chip('เสียบตรงนี้', () => done(Number(range.value))));
  }, { cancellable: false }).then((index) => { if (index != null) act({ type: 'insert', index }); });
}

function openGive(g) {
  openTray({
    key: 'give',
    tagText: 'ขอของ',
    title: `${nameOf(g.pending.to)} ขอการ์ดจากคุณ`,
    detail: 'เลือก 1 ใบจากมือที่จะยกให้',
    cards: g.me.hand.map((c) => ({ kind: c.kind, key: c.uid })),
    confirm: (c) => `ให้ ${cardName(c.kind)}`,
    cancel: null,
  }).then((uid) => { if (uid) act({ type: 'give', uid }); });
}

/** ขุดหลุมศพ: เลือกการ์ดจากกองทิ้ง (ใบล่าสุดอยู่ซ้าย) */
function openDig(g) {
  const cards = [...g.me.dig].reverse();
  openTray({
    key: 'dig',
    tagText: 'ขุดหลุมศพ',
    title: 'หยิบการ์ดจากกองทิ้ง 1 ใบ',
    detail: 'ซ้ายสุดคือใบที่เพิ่งทิ้งล่าสุด (ผีขุดไม่ได้)',
    cards: cards.map((c) => ({ kind: c.kind, key: c.uid })),
    confirm: (c) => `หยิบ ${cardName(c.kind)}`,
    cancel: null,
  }).then((uid) => { if (uid) act({ type: 'dig', uid }); });
}

/** ผูกดวง: แตะการ์ดตามลำดับที่อยากให้อยู่จากบนลงล่าง ตัวเลขบนการ์ด = ลำดับใหม่ */
function openFate(g) {
  const top = g.me.fate;
  openOrderTray({
    key: 'fate',
    tagText: 'ผูกดวง',
    title: `เรียงการ์ด ${top.length} ใบบนกองใหม่`,
    detail: 'แตะการ์ดตามลำดับที่อยากให้อยู่จากบนลงล่าง เลข 1 = บนสุด (ใบที่จะถูกจั่วต่อไป) · เห็นแค่คุณคนเดียว',
    cards: top.map((c, i) => ({ kind: c.kind, key: c.uid, tag: `เดิมใบที่ ${i + 1}` })),
  }).then((order) => { if (order) act({ type: 'fate', order }); });
}

async function doGrudge() {
  const target = await pickTarget('อาฆาตใคร? (สุ่มทิ้งการ์ดเขา 1 ใบ ใช้ได้ครั้งเดียว)');
  if (target) act({ type: 'grudge', target });
}

// ---------- วาดหน้าจอ ----------
function showScreen(id) {
  for (const s of ['home', 'lobby', 'game']) $(s).hidden = s !== id;
  document.body.dataset.screen = id;
}

function renderHome() {
  showScreen('home');
  $('create').textContent = pendingInvite ? `เข้าห้อง ${pendingInvite}` : 'สร้างห้องใหม่';
  $('name').placeholder = pendingInvite ? 'ใส่ชื่อแล้วกดเข้าห้อง' : 'เช่น ต้น';
  const list = $('room-list');
  list.innerHTML = '';
  for (const r of net.rooms) {
    const li = document.createElement('li');
    const full = r.players >= r.max;
    li.innerHTML = `<div><b>${esc(r.name)}</b><div class="muted">${r.players}/${r.max} คน · รหัส ${esc(r.code)}${r.extras ? ' · <span class="extra-tag">+การ์ดเสริม</span>' : ''}</div></div>
      <span class="badge ${r.status}">${r.status === 'play' ? (full ? 'เต็ม' : 'กำลังเล่น · เข้าไปดู') : full ? 'เต็ม' : 'รอคน · เข้าร่วม'}</span>`;
    li.onclick = () => {
      if (!ensureName()) return;
      joinRoom(r.code);
    };
    list.append(li);
  }
  $('no-rooms').hidden = net.rooms.length > 0;
}

function ensureName() {
  const v = $('name').value.trim();
  if (!v) { toast('ใส่ชื่อก่อน'); $('name').focus(); return false; }
  setName(v);
  return true;
}

function renderLobby(s) {
  showScreen('lobby');
  $('lobby-name').textContent = s.room.name;
  $('lobby-code').textContent = s.room.code;
  const isHost = s.room.hostId === s.you;
  const ul = $('lobby-players');
  ul.innerHTML = '';
  for (const p of s.room.players) {
    const li = document.createElement('li');
    if (!p.online) li.className = 'offline';
    li.innerHTML = `<span>${esc(p.name)}${p.bot ? ' <span class="badge">บอต</span>' : ''}${p.id === s.room.hostId ? ' 👑' : ''}${p.id === s.you ? ' (คุณ)' : ''}${p.online ? '' : ' · หลุด'}</span>`;
    if (isHost && p.id !== s.you) li.append(chip(p.bot ? 'เอาออก' : 'เตะ', () => send({ t: 'kick', id: p.id })));
    ul.append(li);
  }
  const full = s.room.players.length >= MAX_SEATS;
  $('add-bot').hidden = !isHost;
  $('add-bot').disabled = full;
  $('add-bot').textContent = full ? `ห้องเต็มแล้ว (${MAX_SEATS} ที่)` : 'เพิ่มบอต';
  renderExtras(s, 'extras');
  $('start').hidden = !isHost;
  $('start').disabled = s.room.players.length < 2;
  $('lobby-hint').textContent = isHost
    ? (s.room.players.length < 2 ? 'รอเพื่อนอย่างน้อยอีก 1 คน หรือเพิ่มบอตมาเล่นด้วย' : `พร้อมแล้ว ${s.room.players.length} คน`)
    : 'รอหัวห้องกดเริ่มเกม';
}

/** สวิตช์ "การ์ดเสริม" (ห้องรอ / กล่องจบเกม): หัวห้องกดได้ คนอื่นเห็นสถานะ */
function renderExtras(s, id) {
  const box = $(id);
  const isHost = s.room.hostId === s.you;
  box.querySelector('input').checked = !!s.room.extras;
  box.querySelector('input').disabled = !isHost;
  box.classList.toggle('readonly', !isHost);
  box.hidden = !isHost && !s.room.extras;
}

function renderHand(g) {
  const box = $('hand');
  box.hidden = !!scene || !g.me || !g.me.alive;
  if (box.hidden) return;
  box.innerHTML = '';
  for (const c of g.me.hand) {
    const info = CARD_INFO[c.kind];
    const b = document.createElement('button');
    b.style.background = info.color;
    b.className = selected.has(c.uid) ? 'sel' : '';
    b.innerHTML = `<span>${esc(info.imp ? `ผีน้อย ${info.name}` : info.name)}</span><small>${esc(info.text)}</small>`;
    b.onclick = () => toggleCard(c.uid);
    box.append(b);
  }
}

// ---------- ลำดับการโต้ตอบระหว่างช่วงกด "ไม่!" ----------
let chain = null;      // { actor, kinds, target, name, nopes: [playerId|null], result: null | 'cancelled' | 'done' }
let chainTimer = null;

/** สาปส่งจะทำให้ใครต้องเล่นกี่ตา: (ตาที่คนสาปเหลือ ถ้ากำลังโดนสาปอยู่) + 2 หรือ + 3 ตามกติกา */
function curseStack(g, actor, kind) {
  if (!g || (kind !== 'curse' && kind !== 'curse2')) return null;
  const i = g.players.findIndex((p) => p.id === actor);
  const n = g.players.length;
  const dir = g.dir === -1 ? -1 : 1;
  let next = null;
  for (let k = 1; k <= n && !next; k++) {
    const p = g.players[(((i + dir * k) % n) + n) % n];
    if (p.alive && p.id !== actor) next = p.id;
  }
  const owed = g.current === actor && g.cursed ? g.turnsLeft : 0;
  return { next, turns: owed + (kind === 'curse2' ? 3 : 2), owed };
}

function chainEvent(e) {
  if (e.type === 'play') {
    clearTimeout(chainTimer);
    chain = { actor: e.player, kinds: e.kinds, target: e.target, name: e.name, nopes: [], result: null, stack: curseStack(G(), e.player, e.kinds[0]) };
  } else if (e.type === 'nope' && chain && !chain.result) chain.nopes.push(e.player);
  else if (e.type === 'resolve' && chain && !chain.result) {
    // โชว์ผลค้างไว้สักครู่ก่อนหาย
    chain.result = e.cancelled ? 'cancelled' : 'done';
    clearTimeout(chainTimer);
    chainTimer = setTimeout(() => { chain = null; renderChain(); }, 1800);
  } else return;
  renderChain(true);
}

/** fromEvent: เรียกจากอีเวนต์ซึ่งมาถึงก่อนสถานะเกมใหม่ ยังไม่ต้องเทียบกับสถานะ */
function renderChain(fromEvent = false) {
  const g = G();
  const pd = g && g.pending;
  // เข้ามากลางทาง (รีเฟรชหน้า) สร้างจากสถานะเกม ไม่รู้ว่าใครกด ไม่! บ้าง
  if (!chain && pd && pd.kind === 'window') {
    chain = { actor: pd.actor, kinds: pd.kinds, target: pd.target, name: pd.name, nopes: Array(pd.nopeCount).fill(null), result: null, stack: curseStack(g, pd.actor, pd.kinds[0]) };
  }
  // สถานะบอกว่าไม่มีช่วงกด ไม่! แล้วแต่เราไม่ได้รับผลตัดสิน (เช่น คนเล่นออกจากห้อง) ล้างทิ้ง
  if (!fromEvent && chain && !chain.result && !(pd && pd.kind === 'window')) chain = null;
  const box = $('chain');
  box.hidden = !chain || !g;
  document.body.classList.toggle('chain-open', !box.hidden);
  if (box.hidden) return;

  const n = chain.nopes.length;
  // นับจากใบล่าสุดย้อนกลับ: ใบล่าสุดมีผล ใบก่อนหน้าถูกยกเลิก สลับกันไป
  const live = (pos) => (n - pos) % 2 === 0;   // pos 0 = ใบที่เล่น, 1.. = ไม่! ใบที่ 1..
  const row = $('chain-cards');
  row.innerHTML = '';
  const group = document.createElement('div');
  group.className = 'chain-play';
  chain.kinds.forEach((k, j) => {
    const el = cardEl(k, j === 0 ? { tag: nameOf(chain.actor) } : {});
    if (!live(0)) el.classList.add('cancelled');
    group.append(el);
  });
  row.append(group);
  chain.nopes.forEach((p, i) => {
    const arrow = document.createElement('span');
    arrow.className = 'chain-arrow';
    arrow.textContent = '◀';
    const el = cardEl('nope', { tag: p ? nameOf(p) : 'ไม่!' });
    if (!live(i + 1)) el.classList.add('cancelled');
    row.append(arrow, el);
  });

  const cname = chain.kinds.length > 1 ? `ผีน้อย${CARD_INFO[chain.kinds[0]].name} ${chain.kinds.length} ใบ` : cardName(chain.kinds[0]);
  const target = chain.target ? ` ใส่ ${nameOf(chain.target)}` : '';
  let text;
  let tone = '';
  if (chain.result === 'cancelled') { text = `${cname} ถูกยกเลิก`; tone = 'bad'; }
  else if (chain.result === 'done') { text = `${cname} มีผล${target}`; tone = 'good'; }
  else if (n === 0) text = `${nameOf(chain.actor)} เล่น ${cname}${target}`;
  else if (n % 2) { text = `ตอนนี้: ${cname} จะถูกยกเลิก`; tone = 'bad'; }
  else { text = `ตอนนี้: ${cname} จะมีผล${target}`; tone = 'good'; }
  // สาปส่ง: บอกว่าคนถัดไปจะต้องเล่นกี่ตา (ทบจากที่ค้างอยู่)
  const st = chain.stack;
  if (st && st.next && chain.result !== 'cancelled' && !(chain.result === null && n % 2)) {
    const tb = st.owed ? ` (ค้าง ${st.owed} + ${st.turns - st.owed})` : '';
    text += ` → ${nameOf(st.next)} ต้องเล่น ${st.turns} ตา${tb}`;
  }
  $('chain-status').textContent = text;
  $('chain-status').className = `chain-status ${tone}`.trim();
}

function renderGame(s) {
  showScreen('game');
  const g = s.game;
  const me = g.me;
  const you = s.you;
  const pd = g.pending;
  const mine = me && me.alive && g.current === you;

  // ตัดการ์ดที่เลือกไว้แต่ไม่อยู่ในมือแล้ว
  const uids = new Set(me ? me.hand.map((c) => c.uid) : []);
  for (const u of [...selected]) if (!uids.has(u)) selected.delete(u);

  const turn = $('turn');
  turn.classList.toggle('mine', !!mine);
  turn.textContent = g.winner ? 'จบเกม'
    : `${g.current === you ? 'ตาของคุณ' : `ตาของ ${nameOf(g.current)}`}${g.turnsLeft > 1 ? ` · ต้องเล่นอีก ${g.turnsLeft} ตา` : ''} · กอง ${g.deckCount} ใบ${g.dir === -1 ? ' · ↺' : ''}`;
  turn.title = g.dir === -1 ? 'ลำดับการเล่นกลับทิศอยู่ (เดินถอยหลัง)' : '';

  // ปุ่ม
  const canNope = me && me.alive && pd && pd.kind === 'window' && me.hand.some((c) => c.kind === 'nope');
  $('nope').hidden = !canNope;
  const idle = mine && !pd && !g.winner;
  $('draw').hidden = !idle;
  // โดนสาปเล่นหลายตา: ป้ายบนปุ่มจั่วบอกว่าต้องจั่วอีกกี่ครั้ง (นับครั้งนี้ด้วย)
  const dt = $('draw-turns');
  const many = idle && g.turnsLeft > 1;
  dt.hidden = !many;
  if (many && dt.dataset.n !== String(g.turnsLeft)) {
    dt.dataset.n = String(g.turnsLeft);
    dt.innerHTML = `<b>×${g.turnsLeft}</b><small>อีก ${g.turnsLeft} ตา</small>`;
    dt.classList.remove('bump');
    dt.getBoundingClientRect();
    dt.classList.add('bump');
  }
  if (!many) dt.dataset.n = '';
  $('draw').setAttribute('aria-label', many ? `จั่ว (ต้องเล่นอีก ${g.turnsLeft} ตา)` : 'จั่ว');
  const sel = describeSelection(handCards().filter((c) => selected.has(c.uid)));
  $('play').hidden = !idle || selected.size === 0;
  $('play').textContent = sel.label;
  $('play').disabled = !sel.ok;
  $('grudge').hidden = !(me && !me.alive && me.grudge && !pd && !g.winner);

  // นับเวลา "ไม่!": คนที่กดได้เห็นเป็นวงแหวนรอบปุ่ม คนที่ไม่มีการ์ด ไม่! เห็นเป็นแถบยาว
  const windowOpen = !!(pd && pd.kind === 'window');
  const bar = $('window-bar');
  bar.hidden = !windowOpen || canNope;
  const ring = $('nope-ring');
  const key = windowOpen ? `${pd.actor}:${pd.kinds.join()}:${pd.nopeCount}` : '';
  if (bar.dataset.key !== key) {
    bar.dataset.key = key;
    if (windowOpen) {
      const left = s.windowLeftMs;
      const span = bar.firstElementChild;
      span.style.transition = 'none';
      span.style.transform = `scaleX(${Math.min(1, left / NOPE_MS)})`;
      // วงแหวน: เส้นรอบวงเต็ม = เวลาเต็ม ค่อยๆ หดจนหมด
      ring.style.transition = 'none';
      ring.style.strokeDashoffset = String(RING_LEN * (1 - Math.min(1, left / NOPE_MS)));
      span.getBoundingClientRect();
      ring.getBoundingClientRect();
      span.style.transition = `transform ${left}ms linear`;
      span.style.transform = 'scaleX(0)';
      ring.style.transition = `stroke-dashoffset ${left}ms linear`;
      ring.style.strokeDashoffset = String(RING_LEN);
    }
  }

  // คำแนะนำ
  let prompt = '';
  if (g.winner) prompt = '';
  else if (pd && pd.kind === 'window') {
    const what = describe({ type: 'play', player: pd.actor, kinds: pd.kinds, target: pd.target }, you, nameOf);
    prompt = `${what}${pd.nopeCount ? ` · โดน "ไม่!" ${pd.nopeCount} ครั้ง` : ''}${canNope ? ' — กด ไม่! เพื่อยกเลิก' : ''}`;
  } else if (pd && pd.kind === 'insert') prompt = pd.player === you ? 'เลือกตำแหน่งเสียบผีกลับเข้ากอง' : `${nameOf(pd.player)} กำลังเลือกที่ซ่อนผี…`;
  else if (pd && pd.kind === 'give') prompt = pd.from === you ? 'เลือกการ์ดที่จะให้' : `${nameOf(pd.from)} กำลังเลือกการ์ดให้ ${nameOf(pd.to)}`;
  else if (pd && pd.kind === 'dig') prompt = pd.player === you ? 'เลือกการ์ดจากกองทิ้ง' : `${nameOf(pd.player)} กำลังขุดหลุมศพ…`;
  else if (pd && pd.kind === 'fate') prompt = pd.player === you ? 'เรียงการ์ดบนกองใหม่' : `${nameOf(pd.player)} กำลังผูกดวงการ์ดบนกอง…`;
  else if (!me) prompt = 'คุณกำลังดูอยู่ ได้เล่นเกมถัดไป';
  else if (!me.alive) prompt = me.grudge ? 'คุณเป็นวิญญาณแล้ว ใช้อาฆาตได้ 1 ครั้งเมื่อไหร่ก็ได้' : 'คุณเป็นวิญญาณแล้ว ดูเพื่อนเล่นต่อ';
  else if (mine) prompt = selected.size ? '' : 'เล่นการ์ดกี่ใบก็ได้ แล้วกด จั่ว เพื่อจบตา';
  else prompt = `รอ ${nameOf(g.current)} เล่น`;
  $('prompt').textContent = prompt;

  // กล่องที่ต้องเปิดเอง
  if (pd && pd.kind === 'insert' && pd.player === you) { if (modalKey !== 'insert') openInsert(g); }
  else if (modalKey === 'insert') closeModal();
  if (pd && pd.kind === 'give' && pd.from === you) { if (trayKey() !== 'give') openGive(g); }
  else if (trayKey() === 'give') closeTray();
  if (pd && pd.kind === 'dig' && pd.player === you && me.dig) { if (trayKey() !== 'dig') openDig(g); }
  else if (trayKey() === 'dig') closeTray();
  if (pd && pd.kind === 'fate' && pd.player === you && me.fate) { if (trayKey() !== 'fate') openFate(g); }
  else if (trayKey() === 'fate') closeTray();
  // ทวงการ์ดค้างอยู่แต่มีเรื่องแทรกหรือหมดตา ปิดแถว
  if (trayKey() === 'name' && (pd || g.winner || !mine)) closeTray();
  // กำลังเลือกเป้าหมายอยู่แต่สถานการณ์เปลี่ยน (มีเรื่องแทรก หรือหมดตาเรา) ปิดกล่อง
  if (modalKey === 'target' && (pd || g.winner || (me && me.alive && !mine))) closeModal();

  // ผู้ชนะ
  $('winner').hidden = !g.winner;
  if (g.winner) {
    $('winner-text').textContent = g.winner === you ? 'คุณรอดคนสุดท้าย ชนะ!' : `${nameOf(g.winner)} ชนะ!`;
    const isHost = s.room.hostId === you;
    // เริ่มรอบใหม่ต้องมีคนออนไลน์อย่างน้อย 2 คน ถ้าเหลือคนเดียวให้เพิ่มบอตจากตรงนี้ได้เลย
    const online = s.room.players.filter((p) => p.online).length;
    $('again').hidden = !isHost;
    $('again').disabled = online < 2;
    $('again-bot').hidden = !isHost || s.room.players.length >= MAX_SEATS;
    $('again-hint').textContent = !isHost ? 'รอหัวห้องเริ่มรอบใหม่'
      : online < 2 ? 'เหลือคุณคนเดียว เพิ่มบอตหรือชวนเพื่อนเข้าห้องก่อนเริ่มรอบใหม่' : '';
    renderExtras(s, 'again-extras');
  }

  // รายชื่อในเมนู
  const mp = $('menu-players');
  mp.innerHTML = '';
  for (const p of s.room.players) {
    const row = document.createElement('div');
    row.className = 'row-p' + (p.online ? '' : ' offline');
    row.innerHTML = `<span>${esc(p.name)}${p.bot ? ' · บอต' : ''}${p.id === s.room.hostId ? ' 👑' : ''}${p.seat === 'watch' ? ' · ดูอยู่' : ''}${p.online ? '' : ' · หลุด'}</span>`;
    if (s.room.hostId === you && p.id !== you) row.append(chip(p.bot ? 'เอาออก' : 'เตะ', () => { if (confirm(`เอา ${p.name} ออกจากห้อง?`)) send({ t: 'kick', id: p.id }); }));
    mp.append(row);
  }
  // จบเกมแล้ว หัวห้องเพิ่มบอตก่อนเริ่มรอบใหม่ได้
  if (s.room.hostId === you && g.winner && s.room.players.length < MAX_SEATS) mp.append(chip('เพิ่มบอต', () => send({ t: 'addBot' })));

  renderHand(g);
  renderChain();
}

export function render() {
  const s = S();
  if (!s || !s.game) { closeTray(); chain = null; renderChain(); }
  if (!s) renderHome();
  else if (!s.game) renderLobby(s);
  else renderGame(s);
  if (scene) scene.setState(s && s.game ? s : null, selected);
}

// ---------- แผงดูการ์ดและคอมโบ ----------
/** เกมนี้ (หรือเกมถัดไปในห้องรอ) มีการ์ดเสริมไหม */
const extrasOn = () => {
  const s = S();
  return !!(s && (s.game ? s.game.extras : s.room.extras));
};
const seatCount = () => {
  const s = S();
  return s ? (s.game ? s.game.players.length : s.room.players.length) : 4;
};

function openCardList() {
  const n = Math.max(2, seatCount());
  const hand = handCards();
  const extras = extrasOn();
  openPanel(`การ์ดทั้งหมด (เกม ${n} คน${extras ? ' · มีการ์ดเสริม' : ''})`, (body) => {
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    for (const k of kindsFor(extras)) {
      const item = document.createElement('div');
      item.className = 'card-item';
      const mine = hand.filter((c) => c.kind === k).length;
      const info = document.createElement('div');
      info.className = 'card-info';
      info.innerHTML = `<b>${esc(cardName(k))}${CARD_INFO[k].extra ? ' <span class="extra-tag">เสริม</span>' : ''}</b><span>${esc(CARD_INFO[k].text)}</span>`
        + `<small>ในเกม ${deckCount(k, n)} ใบ${mine ? ` · ในมือคุณ ${mine}` : ''}</small>`;
      item.append(cardEl(k), info);
      grid.append(item);
    }
    body.append(grid);
  });
}

function comboRow(kinds, title, text) {
  const row = document.createElement('div');
  row.className = 'combo';
  const pics = document.createElement('div');
  pics.className = 'combo-cards';
  for (const k of kinds) pics.append(cardEl(k));
  const t = document.createElement('div');
  t.className = 'combo-text';
  t.innerHTML = `<b>${esc(title)}</b><span>${esc(text)}</span>`;
  row.append(pics, t);
  return row;
}

function openCombos() {
  const hand = handCards();
  openPanel('คอมโบ', (body) => {
    // คอมโบที่ทำได้ตอนนี้จากการ์ดในมือ
    const ready = KIND_ORDER.filter((k) => CARD_INFO[k].imp && hand.filter((c) => c.kind === k).length >= 2);
    if (ready.length) {
      const h = document.createElement('h3');
      h.textContent = 'ในมือคุณตอนนี้';
      body.append(h);
      for (const k of ready) {
        const n = hand.filter((c) => c.kind === k).length;
        body.append(comboRow(Array(Math.min(3, n)).fill(k), `${cardName(k)} ×${n}`,
          n >= 3 ? 'เล่นสามใบเพื่อทวงการ์ดที่ระบุ หรือเล่นแค่คู่เพื่อขโมยแบบสุ่ม' : 'เล่นคู่นี้เพื่อขโมยการ์ดเพื่อนแบบสุ่ม 1 ใบ'));
      }
    }
    const h = document.createElement('h3');
    h.textContent = 'คอมโบทั้งหมด';
    body.append(h);
    body.append(
      comboRow(['imp4', 'imp4'], 'ผีน้อยคู่ (แบบเดียวกัน)', 'เลือกเพื่อน 1 คน แล้วสุ่มขโมยการ์ดในมือเขา 1 ใบ'),
      comboRow(['imp2', 'imp2', 'imp2'], 'ผีน้อยสามใบ (แบบเดียวกัน)', 'เลือกเพื่อนแล้วระบุชื่อการ์ด ถ้าเขามีต้องยกให้คุณ ถ้าไม่มีก็ไม่ได้อะไร'),
      comboRow(['nope', 'nope'], 'ไม่! ซ้อน ไม่!', '"ไม่!" ใบที่สองยกเลิกใบแรก การ์ดที่ถูกยกเลิกจะกลับมามีผล นับเลขคี่ = ยกเลิก'),
      comboRow(['curse', 'curse2'], 'สาปส่งต่อ', 'โดนสาปแล้วสาปต่อ ตาที่ค้างทั้งหมดทบไปให้คนถัดไป บวกอีก 2 หรือ 3 ตา'),
      comboRow(['mirror', 'sneak'], 'เคล็ดลับ: ส่องกระจกแล้วหนี', 'ส่องเห็นผีอยู่บนสุด ใช้ย่องหนีหรือสาปส่งจบตาโดยไม่ต้องจั่ว'),
      comboRow(['mirror', 'wind'], 'เคล็ดลับ: ส่องกระจกแล้วสับ', 'เห็นผีบนกองแต่ไม่มีทางหนี ใช้ลมพัดสับกองเสี่ยงดวงใหม่'),
    );
    if (extrasOn()) body.append(
      comboRow(['fate', 'possess'], 'เคล็ดลับ: ผูกดวงแล้วผีเข้า', 'จัดผีไว้บนสุด แล้วให้ผีเข้าคนที่ไม่มียันต์ จั่วแทนคุณ'),
      comboRow(['mirror', 'bottom'], 'เคล็ดลับ: ส่องกระจกแล้วจั่วก้นกอง', 'เห็นผีอยู่บนสุด จั่วใบล่างแทน ผียังรอคนถัดไปอยู่'),
      comboRow(['curse', 'reverse'], 'เคล็ดลับ: สาปส่งหลังเดินถอยหลัง', 'กลับทิศก่อน คำสาปจะไปโดนคนอีกฝั่งแทน'),
      comboRow(['grave', 'talisman'], 'เคล็ดลับ: ขุดยันต์คืน', 'ยันต์ที่ใช้ไปแล้วอยู่ในกองทิ้ง ขุดกลับมาไว้กันผีได้อีกครั้ง'),
    );
  });
}

// ---------- เสียง ----------
// ไอคอนลำโพง: มีคลื่นเสียง = เปิด, มีกากบาท = ปิด
const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
const ICON_ON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' + SPEAKER
  + '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' + SPEAKER
  + '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// เสียงเบา: คลื่นเสียงเส้นเดียว
const ICON_LOW = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' + SPEAKER
  + '<path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function renderMute() {
  const vol = sound.getVolume();
  const off = sound.isMuted() || vol <= 0;
  const icon = off ? ICON_OFF : vol < 0.45 ? ICON_LOW : ICON_ON;
  // ปุ่มด้านบน: บอกสถานะเสียงตอนนี้ กดเพื่อเปิดกล่องปรับเสียง
  const b = $('mute-btn');
  b.innerHTML = icon;
  b.setAttribute('aria-label', 'ปรับเสียง');
  b.title = 'ปรับเสียง';
  b.classList.toggle('muted', off);
  // ในกล่อง: ปุ่มไอคอนปิด/เปิดเสียง กับ slider ความดัง
  const m = $('vol-mute');
  m.innerHTML = sound.isMuted() ? ICON_OFF : icon;
  m.setAttribute('aria-label', sound.isMuted() ? 'เปิดเสียง' : 'ปิดเสียง');
  m.title = sound.isMuted() ? 'เปิดเสียง' : 'ปิดเสียง';
  m.classList.toggle('muted', sound.isMuted());
  $('vol-range').value = String(Math.round(vol * 100));
  $('vol-range').disabled = sound.isMuted();
  $('vol-num').textContent = sound.isMuted() ? 'ปิด' : `${Math.round(vol * 100)}%`;
}

function toggleVolumePop(open = $('vol-pop').hidden) {
  const pop = $('vol-pop');
  pop.hidden = !open;
  if (!open) return;
  // วางกล่องใต้ปุ่มลำโพง ชิดขอบขวาของปุ่ม
  const r = $('mute-btn').getBoundingClientRect();
  pop.style.top = `${r.bottom + 8}px`;
  pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  $('menu').hidden = true;
}

/** เสียงตามเหตุการณ์ในเกม */
function soundFor(e) {
  switch (e.type) {
    case 'play': e.kinds.forEach((_, i) => sound.play('card', { delay: i * 0.09 })); break;
    case 'nope': sound.play('nope'); break;
    case 'draw': sound.play('draw'); break;
    case 'wind': sound.play('shuffle'); break;
    case 'insert': case 'grudge': case 'reverse': case 'fate': case 'possess': sound.play('card'); break;
    case 'blackout': sound.play('shuffle'); break;
    case 'dig': if (!e.empty) sound.play('card'); break;
    case 'give': case 'steal': if (!e.empty) sound.play('card'); break;
    case 'demand': if (e.got) sound.play('card'); break;
    default:
  }
}

// ---------- เริ่มต้น ----------
/** ฉาก 3 มิติโหลดเสร็จ เปลี่ยนจากการ์ด HTML เป็นการ์ดบนโต๊ะ */
export function attachScene(api) {
  scene = api;
  render();
}

export function initUI() {
  $('name').value = net.name;
  $('create').onclick = () => {
    if (!ensureName()) return;
    if (pendingInvite) joinRoom(pendingInvite); else createRoom();
  };
  $('name').onkeydown = (e) => { if (e.key === 'Enter') $('create').click(); };
  $('lobby-leave').onclick = () => leaveRoom();
  $('game-leave').onclick = () => { if (confirm('ออกจากห้อง? ถ้าเกมกำลังเล่นอยู่ คุณจะตกรอบ')) { $('menu').hidden = true; leaveRoom(); } };
  $('menu-btn').onclick = () => { $('menu').hidden = !$('menu').hidden; };
  $('mute-btn').onclick = () => toggleVolumePop();
  $('vol-mute').onclick = () => {
    const unmute = sound.isMuted();
    sound.setMuted(!unmute);
    if (unmute && sound.getVolume() <= 0) sound.setVolume(0.5);   // เปิดเสียงแต่ความดังเป็น 0 ตั้งไว้ครึ่งหนึ่ง
    renderMute();
    if (unmute) sound.play('card');
  };
  $('vol-range').oninput = (e) => { sound.setVolume(Number(e.target.value) / 100); renderMute(); };
  // ปล่อยมือจาก slider เล่นเสียงตัวอย่างให้ได้ยินว่าดังแค่ไหน
  $('vol-range').onchange = () => sound.play('card');
  // แตะที่อื่น กล่องปรับเสียงปิด
  document.addEventListener('pointerdown', (e) => {
    if (!$('vol-pop').hidden && !$('vol-pop').contains(e.target) && !$('mute-btn').contains(e.target)) toggleVolumePop(false);
  });
  renderMute();
  // เบราว์เซอร์อนุญาตเสียงหลังผู้ใช้แตะหน้าจอ
  document.addEventListener('pointerdown', () => sound.unlock(), { passive: true });
  $('cards-btn').onclick = () => { $('menu').hidden = true; openCardList(); };
  $('combo-btn').onclick = () => { $('menu').hidden = true; openCombos(); };
  $('panel-close').onclick = () => closePanel();
  // แถวเลือกการ์ดเปิด ซ่อนการ์ดในมือบนโต๊ะ จะได้ไม่ซ้อนกัน
  onTrayChange((open) => { if (scene && scene.setHandHidden) scene.setHandHidden(open); });
  $('invite').onclick = async () => {
    const url = `${location.origin}/?room=${S().room.code}`;
    try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนใน Discord ได้เลย'); }
    catch { prompt('คัดลอกลิงก์นี้', url); }
  };
  $('start').onclick = () => send({ t: 'start' });
  $('add-bot').onclick = () => send({ t: 'addBot' });
  $('again').onclick = () => send({ t: 'start' });
  $('again-bot').onclick = () => send({ t: 'addBot' });
  for (const id of ['extras', 'again-extras']) $(id).querySelector('input').onchange = (e) => send({ t: 'options', extras: e.target.checked });
  $('draw').onclick = () => { selected.clear(); act({ type: 'draw' }); };
  $('play').onclick = () => playSelected();
  $('nope').onclick = () => {
    const c = handCards().find((x) => x.kind === 'nope');
    if (c) act({ type: 'nope', uid: c.uid });
  };
  $('grudge').onclick = () => doGrudge();
  $('modal-cancel').onclick = () => { $('modal-cancel').textContent = 'ยกเลิก'; closeModal(); };

  on('state', () => render());
  on('rooms', () => { if (!S()) renderHome(); });
  on('error', (msg) => {
    if (msg) toast(msg);
    render();   // เปิดกล่องที่ยังค้างอยู่ใหม่ เช่น เสียบผีแล้วตำแหน่งไม่ถูก
  });
  on('noroom', () => { pendingInvite = null; });
  on('replaced', () => {
    $('conn').hidden = true;
    openModal('replaced', 'เกมนี้เปิดอยู่ในอีกแท็บหรืออีกเครื่อง', (body, done) => {
      body.append(chip('เล่นต่อในแท็บนี้', () => done(true)));
    }, { cancellable: false }).then((ok) => { if (ok) connect(); });
  });
  on('kicked', () => { toast('คุณถูกเชิญออกจากห้อง'); render(); });
  on('status', (st) => { $('conn').hidden = st === 'online'; });
  on('event', (e) => {
    const s = S();
    const you = s ? s.you : null;
    const text = describe(e, you, nameOf);
    if (text) log(text);
    chainEvent(e);
    soundFor(e);
    if (e.type === 'ghost') revealGhost(nameOf(e.player), e.saved);
    if (e.type === 'mirror' && e.player === you && e.cards) showMirror(e.cards);
    if (scene) scene.playEvent(e, S());
  });

  // ลิงก์เชิญ ?room=CODE มาก่อนห้องเดิมที่จำไว้
  const code = (new URLSearchParams(location.search).get('room') || '').toUpperCase().trim();
  if (code && code !== net.room) {
    forgetRoom();
    if (net.name) net.room = code;
    else pendingInvite = code;
  }
  history.replaceState(null, '', location.pathname);
  render();
  connect();
}

export const sceneHooks = {
  onCardTap: (uid) => toggleCard(uid),
  onPlayerTap: (id) => { if (targetIds && targetIds.ids.includes(id)) targetIds.done(id); },
  // แตะกองจั่ว = กดปุ่มจั่ว (เฉพาะตอนที่ปุ่มจั่วกดได้)
  onDeckTap: () => { if (!$('draw').hidden && trayKey() === null && $('modal').hidden) $('draw').click(); },
};
