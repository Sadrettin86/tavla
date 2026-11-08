// Oda bağlantısı. Üç tür: Firebase (online), yerel test (aynı tarayıcıda iki sekme), çevrimdışı (aynı telefonda).
import { firebaseConfig } from './firebase-config.js';

const FB_VERSION = '12.19.0';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const firebaseReady = () => !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);
export const testMode = () => new URLSearchParams(location.search).has('yerel');
export const onlineAvailable = () => firebaseReady() || testMode();

export function newRoomId() {
  const a = new Uint32Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => ALPHABET[x % ALPHABET.length]).join('');
}
export const validRoomId = (s) => /^[A-HJ-NP-Z2-9]{6}$/.test(s || '');

export async function connectRoom(id, me, handlers) {
  if (testMode()) return new LocalRoom(id, me, handlers);
  if (!firebaseReady()) throw new Error('firebase-ayari-yok');
  const r = new FirebaseRoom(id, me, handlers);
  await r.init();
  return r;
}

// ------------------------------------------------------------------ aynı telefonda
export class OfflineRoom {
  constructor(handlers) { this.h = handlers; this.G = null; this.offline = true; }
  async transact(fn) {
    const N = fn(this.G);
    if (N === undefined || N === null) return false;
    this.G = N;
    this.h.onState(N);
    return true;
  }
  setPresence() {}
  sendChat() {}
  close() {}
}

// ------------------------------------------------------------------ Firebase Realtime Database
class FirebaseRoom {
  constructor(id, me, h) { this.id = id; this.me = { ...me }; this.h = h; this.unsubs = []; }

  async init() {
    const [A, D] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`),
    ]);
    this.D = D;
    const app = A.getApps().length ? A.getApp() : A.initializeApp(firebaseConfig);
    this.db = D.getDatabase(app);
    const base = `rooms/${this.id}`;
    this.stateRef = D.ref(this.db, `${base}/state`);
    this.presRef = D.ref(this.db, `${base}/presence`);
    this.myRef = D.ref(this.db, `${base}/presence/${this.me.id}`);
    this.chatRef = D.ref(this.db, `${base}/chat`);

    this.unsubs.push(D.onValue(this.stateRef, (s) => {
      const v = s.val();
      this.h.onState(v ? JSON.parse(v) : null);
    }, (e) => this.h.onError && this.h.onError(e)));
    this.unsubs.push(D.onValue(this.presRef, (s) => this.h.onPresence(s.val() || {}), () => {}));
    this.unsubs.push(D.onValue(D.ref(this.db, '.info/connected'), (s) => {
      const on = s.val() === true;
      this.h.onConn && this.h.onConn(on);
      if (on) D.onDisconnect(this.myRef).remove().then(() => this.writePresence()).catch(() => {});
    }));
    const startKey = D.push(this.chatRef).key; // yazılmaz; sadece "bundan sonrası" için işaret
    this.unsubs.push(D.onChildAdded(D.query(this.chatRef, D.orderByKey(), D.startAfter(startKey)), (s) => this.h.onChat(s.val()), () => {}));
  }

  writePresence() {
    return this.D.set(this.myRef, { name: this.me.name || 'Oyuncu', color: this.me.color || '', at: this.D.serverTimestamp() });
  }

  setPresence(p) { Object.assign(this.me, p); return this.writePresence().catch(() => {}); }

  async transact(fn) {
    const res = await this.D.runTransaction(this.stateRef, (cur) => {
      const G = cur ? JSON.parse(cur) : null;
      const N = fn(G);
      if (N === undefined) return undefined;
      if (N === null) return null;
      return JSON.stringify(N);
    });
    return res.committed;
  }

  sendChat(msg) {
    return this.D.push(this.chatRef, { ...msg, from: this.me.id, ts: this.D.serverTimestamp() }).catch(() => {});
  }

  close() {
    for (const u of this.unsubs) { try { u(); } catch (e) { /* yok say */ } }
    try { this.D.onDisconnect(this.myRef).cancel(); this.D.remove(this.myRef); } catch (e) { /* yok say */ }
  }
}

// ------------------------------------------------------------------ yerel test (?yerel ile açılır)
class LocalRoom {
  constructor(id, me, h) {
    this.k = 'tavla:yerel:' + id;
    this.me = { ...me };
    this.h = h;
    this.peers = {};
    this.ch = new BroadcastChannel(this.k);
    this.ch.onmessage = (e) => this.onMsg(e.data);
    setTimeout(() => { this.h.onConn && this.h.onConn(true); this.h.onState(this.read()); this.beat(); }, 0);
    this.iv = setInterval(() => this.beat(), 1200);
    this.iv2 = setInterval(() => this.prune(), 2000);
  }
  read() { const v = localStorage.getItem(this.k); return v ? JSON.parse(v) : null; }
  async transact(fn) {
    const stored = this.read();
    const cur = this.last && (!stored || this.last.seq > stored.seq) ? this.last : stored;
    const N = fn(cur);
    if (N === undefined) return false;
    if (N === null) return true;
    this.last = N;
    localStorage.setItem(this.k, JSON.stringify(N));
    this.ch.postMessage({ t: 'state', G: N }); // durumu mesajla gönder: diğer sekmenin localStorage kopyası gecikebilir
    this.h.onState(N);
    return true;
  }
  beat() {
    this.peers[this.me.id] = { name: this.me.name, color: this.me.color || '', last: Date.now() };
    this.ch.postMessage({ t: 'hb', id: this.me.id, name: this.me.name, color: this.me.color || '' });
    this.emitPresence();
  }
  onMsg(m) {
    if (m.t === 'state') { if (m.G) this.last = m.G; this.h.onState(m.G || this.read()); }
    else if (m.t === 'hb') { this.peers[m.id] = { name: m.name, color: m.color, last: Date.now() }; this.emitPresence(); }
    else if (m.t === 'chat') this.h.onChat(m.msg);
    else if (m.t === 'bye') { delete this.peers[m.id]; this.emitPresence(); }
  }
  prune() {
    const now = Date.now();
    for (const [k, v] of Object.entries(this.peers)) if (now - v.last > 5000) delete this.peers[k];
    this.emitPresence();
  }
  emitPresence() {
    const o = {};
    for (const [k, v] of Object.entries(this.peers)) o[k] = { name: v.name, color: v.color };
    this.h.onPresence(o);
  }
  setPresence(p) { Object.assign(this.me, p); this.beat(); }
  sendChat(msg) {
    const m = { ...msg, from: this.me.id, ts: Date.now() };
    this.ch.postMessage({ t: 'chat', msg: m });
    this.h.onChat(m);
  }
  close() {
    clearInterval(this.iv); clearInterval(this.iv2);
    this.ch.postMessage({ t: 'bye', id: this.me.id });
    this.ch.close();
  }
}
