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

// Firebase SDK bir kez yüklenir (oda ve açık oyunlar listesi aynı bağlantıyı kullanır)
let fbP = null;
function loadFirebase() {
  if (!fbP) {
    fbP = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`),
    ]).then(([A, D]) => {
      const app = A.getApps().length ? A.getApp() : A.initializeApp(firebaseConfig);
      return { D, db: D.getDatabase(app) };
    });
    fbP.catch(() => { fbP = null; });
  }
  return fbP;
}

// ------------------------------------------------------------------ açık oyunlar listesi
// lobby/{oda}: { host, w, b, wi, bi, to, st: open|play|over, t, on: {istemci: true} }
// "on": odadaki oyunculardan bağlı olanlar. Kimse bağlı değilse liste o oyunu göstermez.
export function onlineCount(e) {
  const now = Date.now();
  return Object.values((e && e.on) || {}).filter((v) => v === true || (typeof v === 'number' && now - v < 6000)).length;
}

export async function watchLobby(cb, onErr) {
  if (testMode()) return watchLocalLobby(cb);
  if (!firebaseReady()) return () => {};
  const { D, db } = await loadFirebase();
  const q = D.query(D.ref(db, 'lobby'), D.orderByChild('t'), D.limitToLast(60));
  return D.onValue(q, (snap) => cb(snap.val() || {}), (e) => onErr && onErr(e));
}

// Listeden bir oyunu kaldır (herkes kaldırabilir)
export async function removeLobbyEntry(id) {
  if (testMode()) { writeLocalLobby((L) => { delete L[id]; }); return; }
  if (!firebaseReady()) return;
  const { D, db } = await loadFirebase();
  await D.remove(D.ref(db, `lobby/${id}`));
}

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
  publish() {}
  unpublish() {}
  lobbyOnline() {}
  close() {}
}

// ------------------------------------------------------------------ Firebase Realtime Database
class FirebaseRoom {
  constructor(id, me, h) { this.id = id; this.me = { ...me }; this.h = h; this.unsubs = []; }

  async init() {
    const { D, db } = await loadFirebase();
    this.D = D;
    this.db = db;
    const base = `rooms/${this.id}`;
    this.lobbyRef = D.ref(db, `lobby/${this.id}`);
    this.onRef = D.ref(db, `lobby/${this.id}/on/${this.me.id}`);
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
      if (on && this.lobbyOn) this.lobbyOnline(true);
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

  // açık oyunlar listesindeki kayıt
  unpublish() { return this.D.remove(this.lobbyRef).catch(() => {}); }

  publish(info) {
    return this.D.update(this.lobbyRef, { ...info, t: this.D.serverTimestamp() }).catch(() => {});
  }

  // listede "bağlı oyuncu" işareti; bağlantı kopunca sunucu kendisi siler
  lobbyOnline(on) {
    const D = this.D;
    this.lobbyOn = on;
    if (on) return D.onDisconnect(this.onRef).remove().then(() => D.set(this.onRef, true)).catch(() => {});
    D.onDisconnect(this.onRef).cancel().catch(() => {});
    return D.remove(this.onRef).catch(() => {});
  }

  close() {
    for (const u of this.unsubs) { try { u(); } catch (e) { /* yok say */ } }
    try { this.D.onDisconnect(this.myRef).cancel(); this.D.remove(this.myRef); } catch (e) { /* yok say */ }
    if (this.lobbyOn) this.lobbyOnline(false);
  }
}

// ------------------------------------------------------------------ yerel test (?yerel ile açılır)
class LocalRoom {
  constructor(id, me, h) {
    this.id = id;
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
    if (this.lobbyOn) writeLocalLobby((L) => { if (L[this.id]) L[this.id].on = { ...(L[this.id].on || {}), [this.me.id]: Date.now() }; });
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
  unpublish() { writeLocalLobby((L) => { delete L[this.id]; }); }
  publish(info) { writeLocalLobby((L) => { L[this.id] = { ...(L[this.id] || {}), ...info, t: Date.now() }; }); }
  lobbyOnline(on) {
    this.lobbyOn = on;
    writeLocalLobby((L) => {
      if (!L[this.id]) return;
      const o = { ...(L[this.id].on || {}) };
      if (on) o[this.me.id] = Date.now(); else delete o[this.me.id];
      L[this.id].on = o;
    });
  }
  sendChat(msg) {
    const m = { ...msg, from: this.me.id, ts: Date.now() };
    this.ch.postMessage({ t: 'chat', msg: m });
    this.h.onChat(m);
  }
  close() {
    clearInterval(this.iv); clearInterval(this.iv2);
    if (this.lobbyOn) this.lobbyOnline(false);
    this.ch.postMessage({ t: 'bye', id: this.me.id });
    this.ch.close();
  }
}

const LOBBY_K = 'tavla:yerel:lobby';
function readLocalLobby() { try { return JSON.parse(localStorage.getItem(LOBBY_K)) || {}; } catch (e) { return {}; } }
function writeLocalLobby(fn) {
  const L = readLocalLobby();
  fn(L);
  localStorage.setItem(LOBBY_K, JSON.stringify(L));
  const ch = new BroadcastChannel(LOBBY_K);
  ch.postMessage(L);
  ch.close();
}
function watchLocalLobby(cb) {
  const ch = new BroadcastChannel(LOBBY_K);
  ch.onmessage = (e) => cb(e.data || readLocalLobby());
  cb(readLocalLobby());
  const iv = setInterval(() => cb(readLocalLobby()), 2000);
  return () => { ch.close(); clearInterval(iv); };
}
