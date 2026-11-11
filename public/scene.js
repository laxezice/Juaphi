// ฉาก 3 มิติ: ห้องมืด โต๊ะ เทียน กองการ์ด ป้ายชื่อ การ์ดในมือ และเอฟเฟกต์ตอนเกิดเหตุการณ์
// ปุ่มกับข้อความอยู่ใน HTML (ui.js) ส่วนนี้วาดภาพและบอก ui ว่าแตะการ์ดหรือแตะป้ายชื่อของใคร
import * as THREE from 'three';
import { drawCardFace, drawCardBack, KIND_ORDER } from './cards.js';

const CW = 0.7;
const CH = 0.98;
// การ์ดในมือชิดล่างจอ เว้นแค่ขอบนิดหน่อย (ปุ่มกับข้อความแนะนำอยู่เหนือการ์ดในมือ ui อ่านความสูงจาก --hand-h)
const HAND_BOTTOM_PX = 14;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ระยะแถบโฮมด้านล่างของ iPhone (env(safe-area-inset-bottom)) อ่านตรงๆ ไม่ได้ ต้องวัดจาก element */
let safeProbe = null;
function safeBottom() {
  if (!safeProbe) {
    safeProbe = document.createElement('div');
    safeProbe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
    document.body.append(safeProbe);
  }
  return safeProbe.offsetHeight;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

export async function createScene(canvas, hooks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  if (!renderer.getContext()) throw new Error('no webgl');
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // โต๊ะธรรมดาสว่างๆ มองกองจั่วกับการ์ดได้ชัด (เลิกใช้ห้องมืดกับเทียน ผู้ใช้บอกว่ามองกองยาก)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1a2c);
  scene.fog = new THREE.Fog(0x0f1a2c, 14, 30);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  scene.add(camera);
  const camBase = new THREE.Vector3();
  const camLook = new THREE.Vector3(0, 0, 0.4);

  // ---------- texture ----------
  const tex = {};
  const toTex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const [backCanvas, ...faces] = await Promise.all([drawCardBack(), ...KIND_ORDER.map((k) => drawCardFace(k))]);
  tex.back = toTex(backCanvas);
  KIND_ORDER.forEach((k, i) => { tex[k] = toTex(faces[i]); });

  function glowTexture(inner, outer) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return toTex(c);
  }
  const flameTex = glowTexture('rgba(255,245,200,1)', 'rgba(255,140,40,0.55)');
  const wispTex = glowTexture('rgba(220,255,240,1)', 'rgba(120,230,190,0.5)');
  const goldTex = glowTexture('rgba(255,250,220,1)', 'rgba(255,190,60,0.6)');
  const redTex = glowTexture('rgba(255,220,220,1)', 'rgba(220,40,40,0.6)');

  // ---------- พื้นเล่น (ไม่มีโต๊ะ ผู้ใช้ขอให้เหลือแค่พื้นหลัง) ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4250, 1.4));
  // ไฟหลักส่องจากด้านบน ตอนผีโผล่จะวูบลง (candleDim)
  const mainLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
  mainLight.position.set(1.5, 9, 4);
  scene.add(mainLight);
  // พื้นไล่สีฟ้า สว่างตรงกลางที่วางกอง เข้มลงเป็นน้ำเงินกรมที่ขอบ การ์ดทั้งหมดวางบนพื้นนี้
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = floorCanvas.height = 512;
  {
    const ctx = floorCanvas.getContext('2d');
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#4a86c4');
    g.addColorStop(0.45, '#2a5283');
    g.addColorStop(1, '#0f1a2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map: toTex(floorCanvas), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  scene.add(floor);

  // ไม่มีเทียนแล้ว (โต๊ะสว่าง) เหลือไว้เป็นรายการว่างให้โค้ดส่วนอื่นใช้ต่อได้
  const candles = [];
  for (const [x, z, h] of []) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, h, 16), new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.6, emissive: 0x2a1505 }));
    body.position.y = h / 2;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flame.position.y = h + 0.16;
    flame.scale.set(0.32, 0.5, 1);
    const light = new THREE.PointLight(0xff9a40, 7, 9, 1.6);
    light.position.y = h + 0.25;
    g.add(body, flame, light);
    scene.add(g);
    candles.push({ flame, light, base: 7, seed: Math.random() * 100 });
  }
  let candleDim = 1;   // ตอนผีโผล่ เทียนวูบ

  // ---------- การ์ด ----------
  const planeGeo = new THREE.PlaneGeometry(CW, CH);
  // การ์ดวาดแบบมุมโค้ง ส่วนนอกมุมโปร่งใส alphaTest ตัดทิ้งไป ไม่อย่างนั้นมุมจะเป็นสีดำ
  const backMat = new THREE.MeshStandardMaterial({ map: tex.back, roughness: 0.6, alphaTest: 0.5 });
  const faceMats = {};
  const faceMat = (k) => (faceMats[k] ||= new THREE.MeshStandardMaterial({ map: tex[k], roughness: 0.55, alphaTest: 0.5 }));
  // ด้านบนของกองจั่ว (กล่องทึบ): หลังการ์ดที่เติมมุมด้วยสีกระดาษเดียวกับขอบกอง จะได้ไม่มองทะลุกล่อง
  const deckTopCanvas = document.createElement('canvas');
  deckTopCanvas.width = backCanvas.width;
  deckTopCanvas.height = backCanvas.height;
  {
    const ctx = deckTopCanvas.getContext('2d');
    ctx.fillStyle = '#d8ccb0';
    ctx.fillRect(0, 0, deckTopCanvas.width, deckTopCanvas.height);
    ctx.drawImage(backCanvas, 0, 0);
  }
  const deckTopMat = new THREE.MeshStandardMaterial({ map: toTex(deckTopCanvas), roughness: 0.6 });

  /** การ์ดสองหน้า หันหน้าขึ้นฟ้าเมื่อวางราบ (rotation.x = -PI/2) */
  function makeCard(kind) {
    const g = new THREE.Group();
    const front = new THREE.Mesh(planeGeo, kind ? faceMat(kind) : backMat);
    const back = new THREE.Mesh(planeGeo, backMat);
    back.rotation.y = Math.PI;
    g.add(front, back);
    g.userData.front = front;
    return g;
  }
  const setFace = (card, kind) => { card.userData.front.material = kind ? faceMat(kind) : backMat; };

  // กองจั่ว
  const DECK = new THREE.Vector3(-0.55, 0, 0.1);
  const DISCARD = new THREE.Vector3(0.6, 0, 0.1);
  const deckStack = new THREE.Mesh(
    new THREE.BoxGeometry(CW, 1, CH),
    [
      new THREE.MeshStandardMaterial({ color: 0xd8ccb0 }), new THREE.MeshStandardMaterial({ color: 0xd8ccb0 }),
      deckTopMat, new THREE.MeshStandardMaterial({ color: 0x20141a }),
      new THREE.MeshStandardMaterial({ color: 0xd8ccb0 }), new THREE.MeshStandardMaterial({ color: 0xd8ccb0 }),
    ],
  );
  deckStack.position.copy(DECK);
  scene.add(deckStack);
  const deckLabel = makeLabel();
  scene.add(deckLabel.sprite);
  const discardCard = makeCard('ghost');
  discardCard.rotation.set(-Math.PI / 2, 0, 0.12);
  discardCard.position.copy(DISCARD).setY(0.01);
  scene.add(discardCard);

  // ---------- ป้ายข้อความ (sprite จาก canvas) ----------
  function makeLabel(w = 320, h = 120) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const t = toTex(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    sprite.renderOrder = 5;
    return { canvas: c, ctx: c.getContext('2d'), tex: t, sprite, key: '' };
  }
  function drawLabel(label, key, draw) {
    if (label.key === key) return;
    label.key = key;
    label.ctx.clearRect(0, 0, label.canvas.width, label.canvas.height);
    draw(label.ctx, label.canvas.width, label.canvas.height);
    label.tex.needsUpdate = true;
  }
  function pill(ctx, w, h, fill, stroke) {
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(r, 4); ctx.lineTo(w - r, 4);
    ctx.arc(w - r, h / 2, r - 4, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(r, h - 4);
    ctx.arc(r, h / 2, r - 4, Math.PI / 2, -Math.PI / 2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = stroke; ctx.stroke();
  }

  // ---------- ที่นั่ง ----------
  const seats = new Map();   // id -> { group, label, ring, backs:[] , pos }
  let layout = { rx: 2.4, rz: 2.9 };
  const ringGeo = new THREE.RingGeometry(0.55, 0.68, 48);

  function seatFor(id) {
    if (seats.has(id)) return seats.get(id);
    const group = new THREE.Group();
    const label = makeLabel();
    label.sprite.userData.playerId = id;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring, label.sprite);
    scene.add(group);
    const s = { id, group, label, ring, backs: [], pos: new THREE.Vector3() };
    seats.set(id, s);
    return s;
  }

  function placeSeats(order, you) {
    const n = order.length;
    const meIdx = Math.max(0, order.indexOf(you));
    order.forEach((id, i) => {
      const s = seatFor(id);
      const k = (i - meIdx + n) % n;
      const a = Math.PI / 2 + (k * 2 * Math.PI) / n;   // คุณอยู่ใกล้กล้อง (ล่างจอ)
      s.pos.set(Math.cos(a) * layout.rx, 0, Math.sin(a) * layout.rz);
      if (id === you) s.pos.set(0, 0, layout.rz + 0.6);
      s.group.position.copy(s.pos);
      s.isMe = id === you;
      s.label.sprite.position.set(0, 0.75, 0);
      s.label.sprite.scale.set(1.5, 0.56, 1);
      s.label.sprite.visible = !s.isMe;
    });
    for (const [id, s] of seats) if (!order.includes(id)) { scene.remove(s.group); seats.delete(id); }
  }

  function updateSeat(s, p, name, current, turnsLeft) {
    const dead = !p.alive;
    const key = `${name}|${p.handCount}|${dead}|${p.grudge}|${current}|${turnsLeft}`;
    drawLabel(s.label, key, (ctx, w, h) => {
      pill(ctx, w, h, dead ? 'rgba(40,70,64,0.55)' : 'rgba(18,14,26,0.88)', current ? '#ffc35a' : dead ? 'rgba(159,227,200,0.6)' : 'rgba(255,220,160,0.25)');
      ctx.textAlign = 'center';
      ctx.fillStyle = dead ? '#9fe3c8' : '#f6ecd8';
      ctx.font = '600 40px Mitr, sans-serif';
      const nm = name.length > 9 ? name.slice(0, 8) + '…' : name;
      ctx.fillText(dead ? `${nm}` : nm, w / 2, 56);
      ctx.font = '400 28px Sarabun, sans-serif';
      ctx.fillStyle = dead ? '#9fe3c8' : '#d8c9ad';
      const sub = dead ? (p.grudge ? 'วิญญาณ · ยังอาฆาตได้' : 'วิญญาณ') : `${p.handCount} ใบ${current && turnsLeft > 1 ? ` · ${turnsLeft} ตา` : ''}`;
      ctx.fillText(sub, w / 2, 96);
    });
    s.label.sprite.material.opacity = dead ? 0.75 : 1;
    // ตาของตัวเองบอกไว้ที่แถบบนแล้ว ไม่ต้องมีวงใต้ที่นั่ง
    s.current = current && !s.isMe;
    s.ring.material.opacity = s.current ? 0.9 : 0;
    // กองการ์ดหลังป้ายชื่อ บอกจำนวนในมือคร่าวๆ
    const want = s.isMe || dead ? 0 : Math.min(5, p.handCount);
    while (s.backs.length < want) {
      const c = makeCard(null);
      c.rotation.set(-Math.PI / 2, 0, 0);
      c.scale.setScalar(0.55);
      s.group.add(c);
      s.backs.push(c);
    }
    while (s.backs.length > want) s.group.remove(s.backs.pop());
    s.backs.forEach((c, i) => {
      c.position.set((i - (want - 1) / 2) * 0.12, 0.01 + i * 0.004, 0.05);
      c.rotation.z = (i - (want - 1) / 2) * 0.12;
    });
  }

  // ---------- การ์ดในมือ (ติดกับกล้อง) ----------
  const hand = new THREE.Group();
  camera.add(hand);
  const handCards = new Map();   // uid -> mesh
  let handLayout = { k: 0.01, cardPx: 140, hh: 1 };
  const HAND_D = 2.2;
  const handMat = (k) => new THREE.MeshBasicMaterial({ map: tex[k], transparent: true, depthTest: false, toneMapped: false });   // ไม่ปรับโทน สีขาวของการ์ดจะขาวจริง
  // แสงเรืองทองรอบการ์ดที่เลือก: วาดเป็นภาพขอบนุ่ม มุมโค้งตามการ์ด (ไม่ใช่สี่เหลี่ยมทึบ)
  const GLOW_PAD = 64;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 500 + GLOW_PAD * 2;
  glowCanvas.height = 700 + GLOW_PAD * 2;
  {
    const ctx = glowCanvas.getContext('2d');
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    ctx.shadowColor = 'rgba(255, 205, 80, 1)';
    for (const [blur, a] of [[48, 0.9], [22, 1]]) {
      ctx.shadowBlur = blur;
      ctx.fillStyle = `rgba(255, 214, 102, ${a})`;
      rr(GLOW_PAD - 6, GLOW_PAD - 6, 512, 712, 42);
      ctx.fill();
    }
  }
  const outlineMat = new THREE.MeshBasicMaterial({ map: toTex(glowCanvas), transparent: true, depthTest: false, toneMapped: false });

  function layoutHand(cards, selected, instant) {
    const W = renderer.domElement.clientWidth;
    const H = renderer.domElement.clientHeight;
    const hh = HAND_D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const k = (2 * hh) / H;
    const cardPx = Math.min(170, Math.max(110, H * 0.19), W * 0.36);
    handLayout = { k, cardPx, hh };
    const s = (cardPx * k) / CH;
    const n = cards.length;
    const cardW = cardPx * (CW / CH);
    // จอแคบแล้วการ์ดเยอะ แบ่งเป็นสองแถว แถวหลังยกขึ้นให้เห็นแถบชื่อด้านบนของการ์ด
    const rows = n > 5 && W < 600 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    const avail = W * 0.94 - cardW;
    const bottomPx = HAND_BOTTOM_PX + safeBottom();
    const baseY = -hh + (bottomPx + cardPx * 0.5) * k;
    // บอก ui ว่ามือสูงแค่ไหน (รวมระยะที่การ์ดยกขึ้นตอนเลือก) ปุ่มกับข้อความจะได้วางเหนือมือพอดี
    const handTop = n ? bottomPx + cardPx * (rows === 2 ? 1.52 : 1) + 30 : bottomPx;
    document.documentElement.style.setProperty('--hand-h', `${Math.round(handTop)}px`);
    const seen = new Set();
    cards.forEach((c, i) => {
      seen.add(c.uid);
      let m = handCards.get(c.uid);
      if (!m) {
        m = new THREE.Mesh(planeGeo, handMat(c.kind));
        m.userData.uid = c.uid;
        m.position.set(0, baseY - cardPx * k, -HAND_D);
        // กรอบทองตอนเลือก
        const outline = new THREE.Mesh(planeGeo, outlineMat);
        outline.scale.set((500 + GLOW_PAD * 2) / 500, (700 + GLOW_PAD * 2) / 700, 1);
        outline.position.z = -0.0005;
        outline.raycast = () => {};
        m.add(outline);
        m.userData.outline = outline;
        hand.add(m);
        handCards.set(c.uid, m);
      }
      const isSel = selected.has(c.uid);
      m.userData.outline.visible = isSel;
      const row = rows === 2 && i < perRow ? 0 : rows - 1;          // 0 = แถวหลัง
      const j = row === 0 || rows === 1 ? i : i - perRow;
      const inRow = rows === 1 ? n : row === 0 ? perRow : n - perRow;
      const step = inRow > 1 ? Math.min(cardW * 1.04, avail / (inRow - 1)) : 0;
      const off = j - (inRow - 1) / 2;
      const lift = isSel ? 30 : 0;
      const rowY = rows === 2 && row === 0 ? cardPx * 0.52 : 0;
      m.userData.target = new THREE.Vector3(off * step * k, baseY + (rowY + lift - Math.abs(off) * Math.min(4, 40 / inRow)) * k, -HAND_D + i * 0.001);
      m.userData.rot = -off * Math.min(0.05, 0.4 / inRow);
      m.scale.setScalar(s);
      m.renderOrder = (row === 0 && rows === 2 ? 10 : 30) + j * 2 + 1;
      m.userData.outline.renderOrder = m.renderOrder - 1;
      if (instant) { m.position.copy(m.userData.target); m.rotation.z = m.userData.rot; }
    });
    for (const [uid, m] of handCards) if (!seen.has(uid)) { hand.remove(m); handCards.delete(uid); }
  }

  // ---------- ทวีน ----------
  const tweens = [];
  const speed = reduced ? 0.4 : 1;
  function tween(ms, fn) {
    return new Promise((resolve) => tweens.push({ t0: performance.now(), ms: ms * speed, fn, resolve }));
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed));

  /** การ์ดบินจาก a ไป b แล้วหายไป */
  async function fly(kind, a, b, { flip = false, ms = 650, height = 1.4, end } = {}) {
    const c = makeCard(flip ? kind : kind);
    c.position.copy(a);
    scene.add(c);
    await tween(ms, (t) => {
      const e = ease(t);
      c.position.set(lerp(a.x, b.x, e), lerp(a.y, b.y, e) + Math.sin(Math.PI * e) * height, lerp(a.z, b.z, e));
      c.rotation.set(-Math.PI / 2 + (flip ? Math.PI * (1 - e) : 0), 0, Math.sin(Math.PI * e) * 0.6);
    });
    if (end) end(c); else scene.remove(c);
  }

  function burst(texture, at, size = 3, ms = 700) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    s.position.copy(at);
    s.renderOrder = 8;
    scene.add(s);
    return tween(ms, (t) => {
      s.scale.setScalar(size * (0.3 + t));
      s.material.opacity = 1 - t;
    }).then(() => scene.remove(s));
  }

  let shake = 0;
  const seatPos = (id) => {
    const s = seats.get(id);
    if (!s) return DECK.clone();
    return s.isMe ? new THREE.Vector3(0, 1.2, layout.rz + 1.2) : s.pos.clone().setY(0.3);
  };

  // ---------- เหตุการณ์ ----------
  let queue = Promise.resolve();
  let last = null;   // state ล่าสุด
  const top = () => DECK.clone().setY(deckStack.scale.y + 0.02);

  async function animate(e, s) {
    const you = s && s.you;
    switch (e.type) {
      case 'draw':
        return fly(e.player === you && e.card ? e.card.kind : null, top(), seatPos(e.player), { flip: e.player === you && !!e.card });
      case 'play': {
        const from = seatPos(e.player);
        const jobs = e.kinds.map((k, i) => sleep(i * 90).then(() => fly(k, from, DISCARD.clone().setY(0.05 + i * 0.01), { ms: 600, height: 1 })));
        return Promise.all(jobs);
      }
      case 'nope': {
        const label = makeLabel(320, 160);
        drawLabel(label, 'nope', (ctx, w, h) => {
          ctx.font = '600 120px Mitr, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 10; ctx.strokeStyle = '#3a0a0a';
          ctx.strokeText('ไม่!', w / 2, 120);
          ctx.fillStyle = '#ff5a4a'; ctx.fillText('ไม่!', w / 2, 120);
        });
        label.sprite.position.set(0, 1.6, 0.8);
        scene.add(label.sprite);
        fly('nope', seatPos(e.player), DISCARD.clone().setY(0.06), { ms: 450, height: 0.8 });
        await tween(700, (t) => {
          const sc = t < 0.25 ? lerp(0.2, 2.6, t / 0.25) : 2.6;
          label.sprite.scale.set(sc, sc / 2, 1);
          label.sprite.material.opacity = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        });
        scene.remove(label.sprite);
        return;
      }
      case 'ghost': {
        // วงแดงกะพริบรอบที่นั่งของคนที่จั่วได้ผี ให้รู้ว่าเป็นใคร
        const st = seats.get(e.player);
        if (st) st.alertUntil = performance.now() + 3600;
        // ฉากเปิดการ์ดผีใหญ่อยู่ใน HTML (reveal.js) ที่นี่แค่ให้ไฟวูบ แล้วการ์ดบินไปที่ของมัน
        if (!reduced) {
          await tween(400, (t) => { candleDim = 1 - 0.7 * ease(t); });
          await sleep(900);
          await tween(600, (t) => { candleDim = lerp(0.3, 1, t); });
        }
        candleDim = 1;
        if (e.saved) return fly('talisman', seatPos(e.player), DISCARD.clone().setY(0.07), { ms: 500 });
        return fly('ghost', top(), DISCARD.clone().setY(0.08), { ms: 600, height: 1 });
      }
      case 'insert':
        return fly(null, seatPos(e.player), top(), { ms: 700, height: 0.8 });
      case 'wind':
        return tween(700, (t) => {
          deckStack.rotation.y = Math.sin(t * Math.PI * 4) * 0.35 * (1 - t);
          deckStack.position.x = DECK.x + Math.sin(t * Math.PI * 6) * 0.08 * (1 - t);
        });
      case 'give':
      case 'steal':
      case 'demand':
        if (e.empty || e.got === false) return;
        return fly(e.card && (e.to === you || e.from === you) ? e.card.kind : null, seatPos(e.from), seatPos(e.to), { ms: 650, height: 1 });
      case 'grudge': {
        const wisp = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
        wisp.scale.setScalar(0.9);
        scene.add(wisp);
        const a = seatPos(e.from).setY(1);
        const b = seatPos(e.to).setY(0.6);
        await tween(900, (t) => {
          wisp.position.lerpVectors(a, b, ease(t));
          wisp.position.y += Math.sin(t * Math.PI) * 1.2;
          wisp.position.x += Math.sin(t * Math.PI * 5) * 0.15;
        });
        scene.remove(wisp);
        burst(wispTex, b, 2, 500);
        return fly(e.card.kind, b, DISCARD.clone().setY(0.07), { ms: 550, height: 0.8 });
      }
      case 'win':
        return burst(goldTex, seatPos(e.player).setY(1), 5, 1200);
      default:
    }
  }

  // ---------- ขนาดจอ ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 56 : 44;
    camera.updateProjectionMatrix();
    if (aspect < 0.8) camBase.set(0, 10.5, 6.2); else camBase.set(0, 7.2, 6.4);
    camera.position.copy(camBase);
    camera.lookAt(camLook);
    // ความกว้างโต๊ะที่เห็นได้ ป้ายชื่อไม่หลุดขอบจอ
    const dist = camBase.distanceTo(camLook);
    const halfW = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    layout = { rx: Math.min(3.1, halfW * 0.72), rz: aspect < 0.8 ? 2.6 : 2.7 };
    if (last) apply(last, lastSel, true);
  }
  window.addEventListener('resize', resize);

  // ---------- แตะ ----------
  const ray = new THREE.Raycaster();
  const pt = new THREE.Vector2();
  canvas.addEventListener('pointerdown', (ev) => {
    const r = canvas.getBoundingClientRect();
    pt.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    ray.setFromCamera(pt, camera);
    // ทดสอบกับตำแหน่งที่การ์ดกำลังจะไปถึง ไม่ใช่ตำแหน่งระหว่างเลื่อน แตะแล้วได้ใบที่เห็นเสมอ
    const saved = [];
    for (const m of handCards.values()) {
      if (!m.userData.target) continue;
      saved.push([m, m.position.clone(), m.rotation.z]);
      m.position.copy(m.userData.target);
      m.rotation.z = m.userData.rot;
      m.updateMatrixWorld();
    }
    const hits = ray.intersectObjects([...handCards.values()], false);
    for (const [m, p, r] of saved) { m.position.copy(p); m.rotation.z = r; m.updateMatrixWorld(); }
    if (hits.length) {
      hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
      hooks.onCardTap(hits[0].object.userData.uid);
      return;
    }
    const plates = ray.intersectObjects([...seats.values()].map((s) => s.label.sprite), false);
    if (plates.length) return hooks.onPlayerTap(plates[0].object.userData.playerId);
    // แตะกองจั่ว (หรือป้ายจำนวนใบ) = จั่ว
    if (deckStack.visible && ray.intersectObjects([deckStack, deckLabel.sprite], false).length && hooks.onDeckTap) hooks.onDeckTap();
  });

  // ---------- วาดจากสถานะ ----------
  let lastSel = new Set();
  let handHidden = false;
  function apply(s, selected, instant) {
    last = s;
    lastSel = selected || new Set();
    const g = s && s.game;
    const inGame = !!g;
    deckStack.visible = inGame && g.deckCount > 0;
    deckLabel.sprite.visible = inGame;
    discardCard.visible = inGame && !!g.discardTop;
    hand.visible = inGame && !handHidden;
    if (!inGame) {
      for (const [, st] of seats) scene.remove(st.group);
      seats.clear();
      layoutHand([], new Set(), true);
      return;
    }
    const h = Math.max(0.02, g.deckCount * 0.012);
    deckStack.scale.y = h;
    deckStack.position.y = h / 2;
    drawLabel(deckLabel, `d${g.deckCount}`, (ctx, w, hh) => {
      pill(ctx, w, hh, 'rgba(18,14,26,0.85)', 'rgba(255,220,160,0.3)');
      ctx.textAlign = 'center';
      ctx.font = '600 48px Mitr, sans-serif';
      ctx.fillStyle = '#f6ecd8';
      ctx.fillText(`${g.deckCount} ใบ`, w / 2, 78);
    });
    deckLabel.sprite.position.set(DECK.x, h + 0.45, DECK.z - 0.2);
    deckLabel.sprite.scale.set(0.9, 0.34, 1);
    if (g.discardTop) setFace(discardCard, g.discardTop.kind);

    const order = g.players.map((p) => p.id);
    placeSeats(order, s.you);
    for (const p of g.players) {
      const name = p.id === s.you ? 'คุณ' : s.room.names[p.id] || '?';
      updateSeat(seats.get(p.id), p, name, !g.winner && g.current === p.id, g.turnsLeft);
    }
    layoutHand(g.me && g.me.alive ? g.me.hand : [], lastSel, instant);
  }

  // ---------- วนวาด ----------
  let lastFrame = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const busy = tweens.length > 0 || shake > 0;
    if (!busy && now - lastFrame < (reduced ? 250 : 33)) return;
    lastFrame = now;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const t = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(t);
      if (t >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
    for (const c of candles) {
      const f = reduced ? 1 : 0.86 + 0.1 * Math.sin(now / 130 + c.seed) + 0.06 * Math.sin(now / 47 + c.seed * 3);
      c.light.intensity = c.base * f * candleDim;
      c.flame.scale.set(0.32 * f, 0.5 * f * (0.6 + 0.4 * candleDim), 1);
    }
    mainLight.intensity = 1.8 * (0.35 + 0.65 * candleDim);   // ผีโผล่ ไฟวูบ
    for (const st of seats.values()) {
      const alert = st.alertUntil > now;
      st.ring.material.color.setHex(alert ? 0xff3b3b : 0xffc35a);
      if (alert) { st.ring.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(now / 160)); st.ring.scale.setScalar(1.15); }
      else { st.ring.scale.setScalar(1); if (st.current) st.ring.material.opacity = 0.6 + 0.3 * Math.sin(now / 300); else st.ring.material.opacity = 0; }
    }
    // การ์ดในมือเลื่อนเข้าที่
    for (const m of handCards.values()) {
      if (!m.userData.target) continue;
      m.position.lerp(m.userData.target, reduced ? 1 : 0.22);
      m.rotation.z += (m.userData.rot - m.rotation.z) * 0.22;
    }
    camera.position.copy(camBase);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.3;
      camera.position.y += (Math.random() - 0.5) * shake * 0.2;
      shake = Math.max(0, shake - 0.03);
    }
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  }

  resize();
  requestAnimationFrame(frame);

  return {
    setState(s, selected) { apply(s, selected, false); },
    /** แถวเลือกการ์ด (HTML) เปิดอยู่ ซ่อนการ์ดในมือบนโต๊ะ */
    setHandHidden(v) { handHidden = v; hand.visible = !!(last && last.game) && !v; },
    playEvent(e, s) { queue = queue.then(() => animate(e, s)).catch((err) => console.warn(err)); },
    debug: { scene, camera, renderer, seats, handCards },
  };
}
