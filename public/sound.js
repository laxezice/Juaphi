// เสียงในเกม: 'shuffle' (สับกอง), 'card' (เล่น/ย้ายการ์ด), 'draw' (จั่ว)
// ถ้ามีไฟล์ public/sounds/<ชื่อ>.ogg|mp3|wav ใช้ไฟล์นั้น ไม่มีก็สังเคราะห์เสียงไพ่ด้วย Web Audio
// ปิดเสียงได้ (จำไว้ในเครื่อง) เบราว์เซอร์ยอมให้เล่นเสียงหลังผู้ใช้แตะหน้าจอครั้งแรกเท่านั้น

const VERSION = document.querySelector('meta[name=juaphi-version]')?.content || '';
const KEY = 'juaphi:muted';
let ctx = null;
let files = null;
const buffers = new Map();
let noise = null;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
const listeners = [];

export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
  listeners.forEach((fn) => fn(muted));
}
export const onMuteChange = (fn) => listeners.push(fn);

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
/** เรียกตอนผู้ใช้แตะหน้าจอ ให้เบราว์เซอร์อนุญาตเสียง */
export function unlock() { audio(); }

async function buffer(name) {
  if (!buffers.has(name)) {
    buffers.set(name, (async () => {
      if (!files) files = fetch('/api/sounds').then((r) => r.json()).catch(() => []);
      const file = (await files).find((f) => f.replace(/\.\w+$/, '') === name);
      if (!file) return null;
      const data = await (await fetch(`/sounds/${file}?v=${VERSION}`)).arrayBuffer();
      return await audio().decodeAudioData(data);
    })().catch(() => null));
  }
  return buffers.get(name);
}

/** เล่นเสียง delay = วินาทีที่รอก่อนเล่น */
export async function play(name, { gain = 1, delay = 0 } = {}) {
  if (muted) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  const buf = await buffer(name);
  const t = a.currentTime + delay;
  if (buf) {
    const src = a.createBufferSource();
    src.buffer = buf;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(g).connect(a.destination);
    src.start(t);
    return;
  }
  if (SYNTH[name]) SYNTH[name](a, t, gain);
}

// ---------- เสียงสังเคราะห์ (ใช้เมื่อไม่มีไฟล์) ----------
function noiseBuffer(a) {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** เสียงไพ่ถูกับโต๊ะ: เสียงซ่าผ่านตัวกรอง ขึ้นเร็วแล้วจางลง */
function swish(a, t, { freq = 2800, to = freq, dur = 0.1, q = 0.9, level = 0.5 } = {}) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(freq, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** เสียงไพ่แตะโต๊ะ (ต่ำ สั้น) */
function tap(a, t, level = 0.25) {
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.05);
  const g = a.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.07);
}

const SYNTH = {
  card(a, t, gain) {
    swish(a, t, { freq: 2600, to: 1500, dur: 0.12, level: 0.45 * gain });
    tap(a, t + 0.1, 0.22 * gain);
  },
  draw(a, t, gain) {
    swish(a, t, { freq: 3600, to: 1900, dur: 0.09, q: 1.2, level: 0.4 * gain });
  },
  shuffle(a, t, gain) {
    // เสียงรัวไพ่: แตะสั้นๆ ถี่ๆ แล้วจบด้วยไพ่เคาะรวมกอง
    let at = t;
    for (let i = 0; i < 16; i++) {
      swish(a, at, { freq: 3000 + Math.random() * 1500, dur: 0.025, q: 1.5, level: (0.18 + Math.random() * 0.12) * gain });
      at += 0.026 + Math.random() * 0.014;
    }
    swish(a, at + 0.05, { freq: 2200, to: 1200, dur: 0.14, level: 0.4 * gain });
    tap(a, at + 0.16, 0.25 * gain);
  },
};
