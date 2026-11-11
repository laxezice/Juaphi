// กระดาน 2D (HTML ล้วน ไม่ใช้ three.js): ใช้แทน scene.js ได้เลย หน้าที่เหมือนกันทุกอย่าง
//   createBoard(root, hooks) -> { setState(state, selected), playEvent(e, state), setHandHidden(v) }
// คนอื่นอยู่ด้านบน กองจั่วกับกองทิ้งอยู่กลางจอ การ์ดในมืออยู่ล่างสุด
// แตะการ์ด = hooks.onCardTap, แตะที่นั่ง = hooks.onPlayerTap, แตะกองจั่ว = hooks.onDeckTap
import { cardFaceUrl, drawCardBack, KIND_ORDER } from './cards.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HAND_BOTTOM = 14;
const LIFT = 22;   // การ์ดที่เลือกยกขึ้นกี่ px

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** มุมเอียงคงที่ของการ์ดใบหนึ่ง (ไม่สั่นทุกครั้งที่วาดใหม่) */
const tilt = (uid) => { let h = 0; for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h % 13) - 6) * 1.2; };

export async function createBoard(root, hooks) {
  // เตรียมภาพการ์ดทุกใบไว้ก่อน
  const [backUrl, ...faces] = await Promise.all([
    drawCardBack().then((c) => c.toDataURL('image/webp', 0.88)),
    ...KIND_ORDER.map((k) => cardFaceUrl(k)),
  ]);
  const face = Object.fromEntries(KIND_ORDER.map((k, i) => [k, faces[i]]));
  const img = (src, cls = '') => { const i = el('img', cls); i.src = src; i.alt = ''; i.draggable = false; return i; };

  root.innerHTML = '';
  root.classList.add('board2d');
  const seatsBox = el('div', 'b2-seats');
  const center = el('div', 'b2-center');
  const deck = el('button', 'b2-deck');
  deck.type = 'button';
  deck.setAttribute('aria-label', 'กองจั่ว แตะเพื่อจั่ว');
  for (let i = 0; i < 3; i++) deck.append(img(backUrl, `b2-deck-card l${i}`));
  const deckCount = el('span', 'b2-count');
  deck.append(deckCount);
  const discard = el('div', 'b2-discard');
  const discardImg = img('', 'b2-discard-card');
  discard.append(el('div', 'b2-discard-slot'), discardImg);
  center.append(deck, discard);
  const hand = el('div', 'b2-hand');
  // วงลูกศรรอบกองกลาง: ลูกศรทองวิ่งตามทิศการเล่น (ตามเข็ม = ซ้ายไปขวาตามแถวที่นั่ง)
  const SVG = 'http://www.w3.org/2000/svg';
  const orbit = document.createElementNS(SVG, 'svg');
  orbit.setAttribute('class', 'b2-orbit');
  orbit.setAttribute('aria-hidden', 'true');
  root.append(seatsBox, orbit, center, hand);
  let orbitKey = '';
  /** วาดวงรีรอบกองกลางใหม่เมื่อขนาดหรือทิศเปลี่ยน */
  function drawOrbit(dir) {
    const r = center.getBoundingClientRect();
    if (!r.width) return;
    const w = Math.round(r.width + 70);
    const h = Math.round(r.height + 56);
    const key = `${w}x${h}:${dir}`;
    if (key === orbitKey) return;
    orbitKey = key;
    const rx = w / 2 - 10;
    const ry = h / 2 - 10;
    const cx = w / 2;
    const cy = h / 2;
    // เริ่มที่จุดซ้าย แล้ววนตามเข็ม (sweep = 1 บนจอที่แกน y ชี้ลง)
    const d = `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 1 ${2 * rx} 0 a ${rx} ${ry} 0 1 1 ${-2 * rx} 0`;
    const rev = dir === -1;
    const motion = (begin) => `<animateMotion dur="7s" repeatCount="indefinite" begin="${begin}s" rotate="${rev ? 'auto-reverse' : 'auto'}"`
      + (rev ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : '') + '><mpath href="#b2-orbit-path"/></animateMotion>';
    orbit.setAttribute('viewBox', `0 0 ${w} ${h}`);
    orbit.style.width = `${w}px`;
    orbit.style.height = `${h}px`;
    orbit.innerHTML = `<path id="b2-orbit-path" class="b2-orbit-ring" d="${d}"/>`
      + [0, -7 / 3, -14 / 3].map((b) => `<path class="b2-orbit-arrow" d="M -9 -11 L 7 0 L -9 11">${motion(b)}</path>`).join('');
  }

  deck.onclick = () => hooks.onDeckTap && hooks.onDeckTap();

  const seats = new Map();     // id -> { box, plate, backs }
  const handCards = new Map(); // uid -> element
  let last = null;
  let handHidden = false;

  // ---------- ที่นั่งคนอื่น ----------
  function seatFor(id) {
    if (seats.has(id)) return seats.get(id);
    const box = el('button', 'b2-seat');
    box.type = 'button';
    const backs = el('div', 'b2-backs');
    const plate = el('div', 'b2-plate');
    box.append(backs, plate);
    box.onclick = () => hooks.onPlayerTap(id);
    seatsBox.append(box);
    const s = { id, box, plate, backs, key: '' };
    seats.set(id, s);
    return s;
  }

  function renderSeats(s) {
    const g = s.game;
    const others = g.players.filter((p) => p.id !== s.you);
    // เรียงตามที่นั่งจริง เริ่มจากคนถัดจากเรา (ทิศปกติ ตาเดินจากซ้ายไปขวา) เดินถอยหลังแล้วที่นั่งไม่ย้าย ลูกศรกลับทางแทน
    const i = g.players.findIndex((p) => p.id === s.you);
    const n = g.players.length;
    const dist = (p) => (((g.players.indexOf(p) - i) % n) + n) % n;
    if (i >= 0) others.sort((a, b) => dist(a) - dist(b));
    const keep = new Set(others.map((p) => p.id));
    for (const [id, st] of seats) if (!keep.has(id)) { st.box.remove(); seats.delete(id); }
    seatsBox.querySelectorAll('.b2-flow').forEach((a) => a.remove());
    others.forEach((p, k) => {
      const st = seatFor(p.id);
      // ลูกศรเล็กระหว่างที่นั่ง ชี้ทางที่ตาเดิน
      if (k) seatsBox.append(el('span', 'b2-flow', '›'));
      seatsBox.append(st.box);   // เรียงตามลำดับ
      const name = s.room.names[p.id] || '?';
      const current = !g.winner && g.current === p.id;
      const key = `${name}|${p.handCount}|${p.alive}|${p.grudge}|${current}|${g.turnsLeft}`;
      if (st.key === key) return;
      st.key = key;
      st.box.classList.toggle('current', current);
      st.box.classList.toggle('dead', !p.alive);
      // ที่นั่งแบบเรียบ: หลังการ์ดใบเดียวมีตัวเลขจำนวนใบ + ชื่อ (ไม่กางการ์ดหลายใบให้รก)
      const sub = !p.alive ? (p.grudge ? 'วิญญาณ · อาฆาตได้' : 'วิญญาณ') : '';
      const turns = current && g.turnsLeft > 1 ? `<i class="b2-turns">${g.turnsLeft} ตา</i>` : '';
      st.plate.innerHTML = `<b>${esc(name)}</b>${sub ? `<small>${sub}</small>` : ''}${turns}`;
      st.backs.innerHTML = '';
      st.backs.hidden = !p.alive;
      if (p.alive) {
        st.backs.append(img(backUrl, 'b2-back'));
        st.backs.append(el('span', 'b2-n', String(p.handCount)));
      }
    });
  }

  // ---------- การ์ดในมือ ----------
  function renderHand(cards, selected) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cardH = Math.round(Math.min(190, Math.max(120, H * 0.21), W * 0.42));
    const cardW = Math.round(cardH * 5 / 7);
    const n = cards.length;
    const avail = Math.min(W - 48, 1100);   // เผื่อขอบไว้ให้การ์ดริมที่เอียงออก
    const step = n > 1 ? Math.min(cardW + 8, (avail - cardW) / (n - 1)) : 0;
    const total = n ? cardW + step * (n - 1) : 0;
    hand.style.setProperty('--cw', `${cardW}px`);
    hand.style.setProperty('--ch', `${cardH}px`);
    const seen = new Set();
    cards.forEach((c, i) => {
      seen.add(c.uid);
      let e = handCards.get(c.uid);
      if (!e) {
        e = el('button', 'b2-card');
        e.type = 'button';
        e.append(img(face[c.kind]));
        e.onclick = () => hooks.onCardTap(c.uid);
        hand.append(e);
        handCards.set(c.uid, e);
      }
      const off = i - (n - 1) / 2;
      e.style.left = `calc(50% - ${total / 2}px + ${i * step}px)`;
      e.style.zIndex = String(10 + i);
      e.style.setProperty('--rot', `${off * Math.min(2.5, 14 / Math.max(n, 1))}deg`);
      e.style.setProperty('--dip', `${Math.abs(off) * Math.min(3, 30 / Math.max(n, 1))}px`);
      e.classList.toggle('selected', selected.has(c.uid));
    });
    for (const [uid, e] of handCards) if (!seen.has(uid)) { e.remove(); handCards.delete(uid); }
    // ui.js วางปุ่มและข้อความเหนือมือจากค่านี้
    const top = n ? HAND_BOTTOM + cardH + LIFT + 8 : HAND_BOTTOM;
    document.documentElement.style.setProperty('--hand-h', `${top}px`);
  }

  // ---------- วาดจากสถานะ ----------
  function apply(s, selected) {
    last = s;
    const g = s && s.game;
    root.hidden = !g;
    if (!g) {
      handCards.forEach((e) => e.remove());
      handCards.clear();
      document.documentElement.style.setProperty('--hand-h', `${HAND_BOTTOM}px`);
      return;
    }
    renderSeats(s);
    deck.hidden = g.deckCount <= 0;
    deckCount.textContent = `${g.deckCount} ใบ`;
    deck.style.setProperty('--depth', String(Math.min(3, Math.ceil(g.deckCount / 10))));
    const dir = g.dir === -1 ? -1 : 1;
    root.classList.toggle('rev', dir === -1);
    drawOrbit(dir);
    if (g.discardTop) {
      discardImg.src = face[g.discardTop.kind];
      discardImg.style.setProperty('--tilt', `${tilt(g.discardTop.uid)}deg`);
      discardImg.hidden = false;
    } else discardImg.hidden = true;
    hand.hidden = handHidden;
    renderHand(g.me && g.me.alive ? g.me.hand : [], selected || new Set());
    // กองกลางอยู่กึ่งกลางระหว่างแถวที่นั่งกับมือ
    root.style.setProperty('--seats-b', `${Math.round(seatsBox.getBoundingClientRect().bottom)}px`);
  }

  // ---------- ภาพเคลื่อนไหว ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  function rectOf(id) {
    if (last && id === last.you) {
      const r = hand.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: window.innerHeight - 90 };
    }
    const st = seats.get(id);
    const r = (st ? st.box : deck).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const centerOf = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  /** การ์ดบินจากจุดหนึ่งไปอีกจุด (src = ภาพหน้า/หลัง) */
  function fly(src, from, to, { ms = 480, scale = 1 } = {}) {
    if (reduced) return Promise.resolve();
    const f = img(src, 'b2-fly');
    f.style.left = `${from.x}px`;
    f.style.top = `${from.y}px`;
    f.style.transform = 'translate(-50%, -50%) scale(0.6)';
    document.body.append(f);
    f.getBoundingClientRect();
    f.style.transition = `left ${ms}ms cubic-bezier(.3,.7,.3,1), top ${ms}ms cubic-bezier(.3,.7,.3,1), transform ${ms}ms ease`;
    f.style.left = `${to.x}px`;
    f.style.top = `${to.y}px`;
    f.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${(Math.random() * 16 - 8).toFixed(1)}deg)`;
    return wait(ms).then(() => f.remove());
  }

  /** ดวงวิญญาณลอยจากคนหนึ่งไปอีกคน (อาฆาต, ผีเข้า) */
  async function wisp(a, b) {
    if (reduced) return;
    const w = el('div', 'b2-wisp');
    w.style.left = `${a.x}px`;
    w.style.top = `${a.y}px`;
    document.body.append(w);
    w.getBoundingClientRect();
    w.style.left = `${b.x}px`;
    w.style.top = `${b.y}px`;
    await wait(800);
    w.remove();
  }

  function pulse(target, cls, ms) {
    target.classList.remove(cls);
    target.getBoundingClientRect();
    target.classList.add(cls);
    setTimeout(() => target.classList.remove(cls), ms);
  }

  async function animate(e, s) {
    const you = s && s.you;
    switch (e.type) {
      case 'draw':
        return fly(e.player === you && e.card ? face[e.card.kind] : backUrl, centerOf(deck), rectOf(e.player));
      case 'play':
        await Promise.all(e.kinds.map((k, i) => wait(i * 80).then(() => fly(face[k], rectOf(e.player), centerOf(discard), { scale: 1.1 }))));
        return;
      case 'nope': {
        fly(face.nope, rectOf(e.player), centerOf(discard), { ms: 380, scale: 1.1 });
        const pop = el('div', 'b2-pop', 'ไม่!');
        const c = centerOf(discard);
        pop.style.left = `${c.x}px`;
        pop.style.top = `${c.y}px`;
        document.body.append(pop);
        await wait(750);
        pop.remove();
        return;
      }
      case 'ghost': {
        const st = seats.get(e.player);
        if (st) pulse(st.box, 'alert', 3600);
        await wait(1600);
        return fly(e.saved ? face.talisman : face.ghost, rectOf(e.player), centerOf(discard), { scale: 1.1 });
      }
      case 'insert':
        return fly(backUrl, rectOf(e.player), centerOf(deck), { ms: 600 });
      case 'wind':
        pulse(deck, 'shuffle', 800);
        return wait(800);
      case 'give':
      case 'steal':
      case 'demand':
        if (e.empty || e.got === false) return;
        return fly(e.card && (e.to === you || e.from === you) ? face[e.card.kind] : backUrl, rectOf(e.from), rectOf(e.to));
      case 'possess': {
        if (e.empty) return;
        await wisp(rectOf(e.from), rectOf(e.to));
        const st = seats.get(e.to);
        if (st) pulse(st.box, 'alert', 1200);
        return;
      }
      case 'blackout':
        pulse(root, 'blackout', 1400);
        return wait(500);
      case 'pass':
        return fly(e.card && (e.to === you || e.from === you) ? face[e.card.kind] : backUrl, rectOf(e.from), rectOf(e.to), { ms: 420 });
      case 'dig':
        if (e.empty) return;
        return fly(face[e.card.kind], centerOf(discard), rectOf(e.player));
      case 'fate':
        pulse(deck, 'fate', 900);
        return wait(500);
      case 'reverse': {
        pulse(orbit, 'flash', 1200);
        const pop = el('div', 'b2-pop b2-pop-rev', e.dir === -1 ? '↺ กลับทิศ!' : '↻ กลับทิศ!');
        const c = centerOf(center);
        pop.style.left = `${c.x}px`;
        pop.style.top = `${c.y}px`;
        document.body.append(pop);
        await wait(900);
        pop.remove();
        return;
      }
      case 'grudge': {
        const b = rectOf(e.to);
        await wisp(rectOf(e.from), b);
        return fly(face[e.card.kind], b, centerOf(discard));
      }
      case 'win': {
        const st = seats.get(e.player);
        if (st) pulse(st.box, 'winner', 2500);
        return;
      }
      default:
    }
  }

  let queue = Promise.resolve();
  window.addEventListener('resize', () => { if (last) apply(last, lastSel); });
  let lastSel = new Set();

  return {
    setState(s, selected) { lastSel = selected || new Set(); apply(s, lastSel); },
    playEvent(e, s) { queue = queue.then(() => animate(e, s)).catch((err) => console.warn(err)); },
    setHandHidden(v) { handHidden = v; hand.hidden = v; },
    debug: { seats, handCards },
  };
}
