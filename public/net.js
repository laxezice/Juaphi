// ต่อ WebSocket กลับเข้าห้องเดิมเองเมื่อหลุด และเก็บสถานะล่าสุด

const store = {
  get(k) { try { return localStorage.getItem('juaphi:' + k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem('juaphi:' + k) : localStorage.setItem('juaphi:' + k, v); } catch {} },
};

function randomSecret() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const net = {
  ws: null,
  state: null,
  rooms: [],
  room: store.get('room'),
  secret: store.get('secret') || randomSecret(),
  name: store.get('name') || '',
  listeners: { state: [], event: [], rooms: [], error: [], status: [], kicked: [], replaced: [], noroom: [] },
  replaced: false,
  retry: 0,
};
store.set('secret', net.secret);

const emit = (k, v) => net.listeners[k].forEach((fn) => fn(v));
export const on = (k, fn) => net.listeners[k].push(fn);

export function send(msg) {
  if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify(msg));
}

export function connect() {
  net.replaced = false;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  net.ws = ws;
  ws.onopen = () => {
    net.retry = 0;
    emit('status', 'online');
    send({ t: 'hello' });
    if (net.room) send({ t: 'join', room: net.room, name: net.name, secret: net.secret });
  };
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    // ออกจากห้องแล้ว สถานะที่ยังค้างมาจากห้องเดิมไม่ต้องสนใจ
    if (m.t === 'state') { if (!net.room) return; net.state = m; emit('state', m); }
    else if (m.t === 'event') emit('event', m.e);
    else if (m.t === 'rooms') { net.rooms = m.rooms; emit('rooms', m.rooms); }
    else if (m.t === 'joined') { net.room = m.room; store.set('room', m.room); }
    else if (m.t === 'kicked') { forgetRoom(); emit('kicked'); }
    else if (m.t === 'replaced') { net.replaced = true; emit('replaced'); }
    else if (m.t === 'error') {
      if (m.code === 'stale') return emit('error', '');
      // ห้องหายไปแล้ว (เช่น เซิร์ฟเวอร์รีสตาร์ต) ลืมห้องเดิมแล้วกลับหน้าแรก
      if (m.code === 'no-room') { const had = !!net.state; forgetRoom(); emit('noroom'); if (had) emit('state', null); }
      emit('error', m.msg);
    }
  };
  ws.onclose = () => {
    if (net.ws !== ws) return;
    if (net.replaced) return;   // อีกแท็บเอาที่นั่งไปแล้ว ไม่ต่อใหม่จนกว่าผู้ใช้จะกด
    emit('status', 'offline');
    const wait = Math.min(5000, 500 * 2 ** net.retry++);
    setTimeout(connect, wait);
  };
}

export function forgetRoom() {
  net.room = null;
  net.state = null;
  store.set('room', null);
}

export function setName(name) {
  net.name = name;
  store.set('name', name);
}

export function createRoom() {
  send({ t: 'create', name: net.name, secret: net.secret });
}

export function joinRoom(code) {
  send({ t: 'join', room: code, name: net.name, secret: net.secret });
}

export function leaveRoom() {
  send({ t: 'leave' });
  forgetRoom();
  emit('state', null);
}

// แนบเลขลำดับสถานะที่เห็นอยู่ เซิร์ฟเวอร์ปัดทิ้งการกดซ้ำ
export const act = (action) => send({ t: 'act', seq: net.state ? net.state.seq : undefined, action });
