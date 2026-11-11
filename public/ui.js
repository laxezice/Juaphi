// หน้าจอทั้งหมดที่เป็น HTML: หน้าแรก ห้องรอ ปุ่มในเกม กล่องเลือก และบันทึกเหตุการณ์
import { net, on, connect, send, setName, createRoom, joinRoom, leaveRoom, act } from './net.js';
import { CARD_INFO, KIND_ORDER, describeSelection } from './cards.js';

const $ = (id) => document.getElementById(id);
const NOPE_MS = 3000;
let scene = null;
let selected = new Set();
let modalKey = null;      // กล่องที่เปิดอยู่เพื่อเรื่องอะไร
let modalResolve = null;
let targetIds = null;     // id ที่แตะป้ายชื่อเลือกได้ตอนกำลังเลือกเป้าหมาย

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
    case 'start': return 'เริ่มเกม! ระวังผีในกอง';
    case 'draw': return e.player === you && e.card ? `คุณจั่วได้ ${cardName(e.card.kind)}` : `${n(e.player)} จั่วการ์ด`;
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

function pickTarget(title) {
  const g = G();
  const ids = g.players.filter((p) => p.alive && p.handCount > 0 && p.id !== S().you).map((p) => p.id);
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

function pickName() {
  return openModal('name', 'ทวงการ์ดอะไร?', (body, done) => {
    for (const k of KIND_ORDER) body.append(chip(cardName(k), () => done(k)));
  }, { grid: true });
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
    action.target = await pickTarget(cards.length > 1 ? 'ขโมยการ์ดจากใคร?' : 'ขอการ์ดจากใคร?');
    if (!action.target) return;
  }
  if (sel.needName) {
    action.name = await pickName();
    if (!action.name) return;
  }
  selected.clear();
  act(action);
}

function showMirror(cards) {
  openModal('mirror', 'ส่องกระจก: การ์ด 3 ใบบนกอง (ซ้าย = บนสุด)', (body) => {
    if (!cards.length) body.append('กองว่าง');
    for (const c of cards) body.append(cardFace(c.kind));
    $('modal-cancel').textContent = 'ปิด';
  }, { grid: true });
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
  openModal('give', `${nameOf(g.pending.to)} ขอการ์ด เลือกให้ 1 ใบ`, (body, done) => {
    for (const c of g.me.hand) {
      const f = cardFace(c.kind);
      f.style.cursor = 'pointer';
      f.onclick = () => done(c.uid);
      body.append(f);
    }
  }, { grid: true, cancellable: false }).then((uid) => { if (uid) act({ type: 'give', uid }); });
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
  const list = $('room-list');
  list.innerHTML = '';
  for (const r of net.rooms) {
    const li = document.createElement('li');
    const full = r.players >= r.max;
    li.innerHTML = `<div><b>${esc(r.name)}</b><div class="muted">${r.players}/${r.max} คน · รหัส ${esc(r.code)}</div></div>
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
    li.innerHTML = `<span>${esc(p.name)}${p.id === s.room.hostId ? ' 👑' : ''}${p.id === s.you ? ' (คุณ)' : ''}${p.online ? '' : ' · หลุด'}</span>`;
    if (isHost && p.id !== s.you) li.append(chip('เตะ', () => send({ t: 'kick', id: p.id })));
    ul.append(li);
  }
  $('start').hidden = !isHost;
  $('start').disabled = s.room.players.length < 2;
  $('lobby-hint').textContent = isHost
    ? (s.room.players.length < 2 ? 'รอเพื่อนอย่างน้อยอีก 1 คน' : `พร้อมแล้ว ${s.room.players.length} คน`)
    : 'รอหัวห้องกดเริ่มเกม';
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
    : `${g.current === you ? 'ตาของคุณ' : `ตาของ ${nameOf(g.current)}`}${g.turnsLeft > 1 ? ` · ต้องเล่นอีก ${g.turnsLeft} ตา` : ''} · กอง ${g.deckCount} ใบ`;

  // ปุ่ม
  const canNope = me && me.alive && pd && pd.kind === 'window' && me.hand.some((c) => c.kind === 'nope');
  $('nope').hidden = !canNope;
  const idle = mine && !pd && !g.winner;
  $('draw').hidden = !idle;
  const sel = describeSelection(handCards().filter((c) => selected.has(c.uid)));
  $('play').hidden = !idle || selected.size === 0;
  $('play').textContent = sel.label;
  $('play').disabled = !sel.ok;
  $('grudge').hidden = !(me && !me.alive && me.grudge && !pd && !g.winner);

  // แถบนับเวลา "ไม่!"
  const bar = $('window-bar');
  bar.hidden = !(pd && pd.kind === 'window');
  if (!bar.hidden) {
    const span = bar.firstElementChild;
    const key = `${pd.actor}:${pd.kinds.join()}:${pd.nopeCount}`;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      span.style.transition = 'none';
      span.style.transform = `scaleX(${Math.min(1, s.windowLeftMs / NOPE_MS)})`;
      span.getBoundingClientRect();
      span.style.transition = `transform ${s.windowLeftMs}ms linear`;
      span.style.transform = 'scaleX(0)';
    }
  } else bar.dataset.key = '';

  // คำแนะนำ
  let prompt = '';
  if (g.winner) prompt = '';
  else if (pd && pd.kind === 'window') {
    const what = describe({ type: 'play', player: pd.actor, kinds: pd.kinds, target: pd.target }, you, nameOf);
    prompt = `${what}${pd.nopeCount ? ` · โดน "ไม่!" ${pd.nopeCount} ครั้ง` : ''}${canNope ? ' — กด ไม่! เพื่อยกเลิก' : ''}`;
  } else if (pd && pd.kind === 'insert') prompt = pd.player === you ? 'เลือกตำแหน่งเสียบผีกลับเข้ากอง' : `${nameOf(pd.player)} กำลังเลือกที่ซ่อนผี…`;
  else if (pd && pd.kind === 'give') prompt = pd.from === you ? 'เลือกการ์ดที่จะให้' : `${nameOf(pd.from)} กำลังเลือกการ์ดให้ ${nameOf(pd.to)}`;
  else if (!me) prompt = 'คุณกำลังดูอยู่ ได้เล่นเกมถัดไป';
  else if (!me.alive) prompt = me.grudge ? 'คุณเป็นวิญญาณแล้ว ใช้อาฆาตได้ 1 ครั้งเมื่อไหร่ก็ได้' : 'คุณเป็นวิญญาณแล้ว ดูเพื่อนเล่นต่อ';
  else if (mine) prompt = selected.size ? '' : 'เล่นการ์ดกี่ใบก็ได้ แล้วกด จั่ว เพื่อจบตา';
  else prompt = `รอ ${nameOf(g.current)} เล่น`;
  $('prompt').textContent = prompt;

  // กล่องที่ต้องเปิดเอง
  if (pd && pd.kind === 'insert' && pd.player === you) { if (modalKey !== 'insert') openInsert(g); }
  else if (pd && pd.kind === 'give' && pd.from === you) { if (modalKey !== 'give') openGive(g); }
  else if (modalKey === 'insert' || modalKey === 'give') closeModal();
  // กำลังเลือกเป้าหมายอยู่แต่สถานการณ์เปลี่ยน (มีเรื่องแทรก หรือหมดตาเรา) ปิดกล่อง
  if (modalKey === 'target' && (pd || g.winner || (me && me.alive && !mine))) closeModal();

  // ผู้ชนะ
  $('winner').hidden = !g.winner;
  if (g.winner) {
    $('winner-text').textContent = g.winner === you ? 'คุณรอดคนสุดท้าย ชนะ!' : `${nameOf(g.winner)} ชนะ!`;
    const isHost = s.room.hostId === you;
    $('again').hidden = !isHost;
    $('again-hint').textContent = isHost ? '' : 'รอหัวห้องเริ่มรอบใหม่';
  }

  // รายชื่อในเมนู
  const mp = $('menu-players');
  mp.innerHTML = '';
  for (const p of s.room.players) {
    const row = document.createElement('div');
    row.className = 'row-p' + (p.online ? '' : ' offline');
    row.innerHTML = `<span>${esc(p.name)}${p.id === s.room.hostId ? ' 👑' : ''}${p.seat === 'watch' ? ' · ดูอยู่' : ''}${p.online ? '' : ' · หลุด'}</span>`;
    if (s.room.hostId === you && p.id !== you) row.append(chip('เตะ', () => { if (confirm(`เตะ ${p.name} ออกจากห้อง?`)) send({ t: 'kick', id: p.id }); }));
    mp.append(row);
  }

  renderHand(g);
}

export function render() {
  const s = S();
  if (!s) renderHome();
  else if (!s.game) renderLobby(s);
  else renderGame(s);
  if (scene) scene.setState(s && s.game ? s : null, selected);
}

// ---------- เริ่มต้น ----------
export function initUI(sceneApi) {
  scene = sceneApi;
  $('name').value = net.name;
  $('create').onclick = () => { if (ensureName()) createRoom(); };
  $('name').onkeydown = (e) => { if (e.key === 'Enter') $('create').click(); };
  $('lobby-leave').onclick = () => leaveRoom();
  $('game-leave').onclick = () => { if (confirm('ออกจากห้อง? ถ้าเกมกำลังเล่นอยู่ คุณจะตกรอบ')) { $('menu').hidden = true; leaveRoom(); } };
  $('menu-btn').onclick = () => { $('menu').hidden = !$('menu').hidden; };
  $('invite').onclick = async () => {
    const url = `${location.origin}/?room=${S().room.code}`;
    try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนใน Discord ได้เลย'); }
    catch { prompt('คัดลอกลิงก์นี้', url); }
  };
  $('start').onclick = () => send({ t: 'start' });
  $('again').onclick = () => send({ t: 'start' });
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
  on('error', (msg) => toast(msg));
  on('kicked', () => { toast('คุณถูกเชิญออกจากห้อง'); render(); });
  on('status', (st) => { $('conn').hidden = st === 'online'; });
  on('event', (e) => {
    const s = S();
    const you = s ? s.you : null;
    const text = describe(e, you, nameOf);
    if (text) log(text);
    if (e.type === 'mirror' && e.player === you && e.cards) showMirror(e.cards);
    if (scene) scene.playEvent(e, S());
  });

  // ลิงก์เชิญ ?room=CODE
  const code = new URLSearchParams(location.search).get('room');
  if (code && !net.room) {
    if (net.name) net.room = code.toUpperCase();
    else { $('name').placeholder = 'ใส่ชื่อแล้วกดเข้าห้อง'; $('create').textContent = `เข้าห้อง ${code.toUpperCase()}`; $('create').onclick = () => { if (ensureName()) joinRoom(code.toUpperCase()); }; }
  }
  history.replaceState(null, '', location.pathname);
  render();
  connect();
}

export const sceneHooks = {
  onCardTap: (uid) => toggleCard(uid),
  onPlayerTap: (id) => { if (targetIds && targetIds.ids.includes(id)) targetIds.done(id); },
};
