// Sesli sohbet: odadaki herkes herkesle doğrudan (WebRTC) bağlanır.
// Bağlantı kurma mesajları oda üzerinden (Firebase / yerel test) gider; ses hiçbir yerde kaydedilmez.
// Mobil veride doğrudan bağlantı kurulamazsa Cloudflare TURN aktarma sunucusu kullanılır.
import { turnUrl } from './voice-config.js';

const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
let iceP = null;

// TURN kimlik bilgileri Worker'dan alınır (24 saat geçerli); alınamazsa yalnız STUN
function iceServers() {
  if (!iceP) {
    iceP = (async () => {
      if (!turnUrl) return STUN;
      try {
        const r = await fetch(turnUrl, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        const list = Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
        // tarayıcılar 53. portu engeller; o adresleri at
        for (const s of list) if (Array.isArray(s.urls)) s.urls = s.urls.filter((u) => !/:53(\?|$)/.test(u));
        setTimeout(() => { iceP = null; }, 6 * 3600 * 1000);
        return list.length ? list : STUN;
      } catch (e) {
        iceP = null;
        return STUN;
      }
    })();
  }
  return iceP;
}

export const voiceSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);

export class Voice {
  // room: sendSig(to, msg) ve setPresence({ v, m }) olan oda; me: { id }
  constructor({ room, me, onChange, onSpeaking }) {
    this.room = room;
    this.me = me;
    this.onChange = onChange || (() => {});
    this.onSpeaking = onSpeaking || (() => {});
    this.peers = new Map(); // id -> { pc, audio, makingOffer, pending: [] }
    this.on = false;
    this.muted = false;
    this.stream = null;
    this.levels = new Map(); // id -> analyser
    this.speaking = new Set();
  }

  async join() {
    if (this.on) return true;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    this.on = true;
    this.muted = false;
    this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    this.watchLevel(this.me.id, this.stream);
    this.room.setPresence({ v: true, m: false });
    this.timer = setInterval(() => this.tick(), 120);
    this.sync(this.lastPresence || {});
    this.onChange();
    return true;
  }

  leave() {
    if (!this.on) return;
    this.on = false;
    for (const id of [...this.peers.keys()]) { this.room.sendSig(id, { type: 'bye' }); this.drop(id); }
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
    clearInterval(this.timer);
    this.levels.clear();
    this.speaking.clear();
    this.onSpeaking(this.speaking);
    this.room.setPresence({ v: false, m: false });
    this.onChange();
  }

  setMuted(m) {
    if (!this.on) return;
    this.muted = !!m;
    for (const t of this.stream.getAudioTracks()) t.enabled = !this.muted;
    this.room.setPresence({ v: true, m: this.muted });
    this.onChange();
  }

  // Odadaki sesli kişiler değişti: yeni gelenle bağlan, gidenle bağlantıyı kapat
  sync(presence) {
    this.lastPresence = presence || {};
    if (!this.on) return;
    const want = new Set(Object.entries(this.lastPresence).filter(([id, p]) => id !== this.me.id && p && p.v).map(([id]) => id));
    for (const id of [...this.peers.keys()]) if (!want.has(id)) this.drop(id);
    for (const id of want) if (!this.peers.has(id) && this.me.id < id) this.call(id);
  }

  async peer(id) {
    let P = this.peers.get(id);
    if (P) return P;
    const pc = new RTCPeerConnection({ iceServers: await iceServers() });
    if (this.peers.has(id)) { pc.close(); return this.peers.get(id); }
    P = { pc, audio: null, makingOffer: false, pending: [], polite: this.me.id > id };
    this.peers.set(id, P);
    if (this.stream) for (const t of this.stream.getTracks()) pc.addTrack(t, this.stream);
    pc.onicecandidate = (e) => { if (e.candidate) this.room.sendSig(id, { type: 'ice', cand: JSON.stringify(e.candidate) }); };
    pc.ontrack = (e) => {
      const st = e.streams[0] || new MediaStream([e.track]);
      if (!P.audio) {
        P.audio = new Audio();
        P.audio.autoplay = true;
        P.audio.setAttribute('playsinline', '');
      }
      P.audio.srcObject = st;
      P.audio.play().catch(() => {});
      this.watchLevel(id, st);
    };
    pc.onnegotiationneeded = async () => {
      try {
        P.makingOffer = true;
        await pc.setLocalDescription();
        this.room.sendSig(id, { type: 'offer', sdp: pc.localDescription.sdp });
      } catch (e) { /* yok say */ } finally { P.makingOffer = false; }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        // ağ değişti ya da yol kapandı: yeniden dene
        try { pc.restartIce(); } catch (e) { /* yok say */ }
      }
      this.onChange();
    };
    return P;
  }

  async call(id) {
    await this.peer(id); // izler eklenince negotiationneeded teklifi gönderir
  }

  // "Kibar eş" yöntemi: iki taraf aynı anda teklif yaparsa biri geri çekilir
  async onSig(msg) {
    if (!msg || !msg.from || msg.from === this.me.id) return;
    const id = msg.from;
    if (msg.type === 'bye') { this.drop(id); return; }
    if (!this.on) return;
    const P = await this.peer(id);
    const pc = P.pc;
    try {
      if (msg.type === 'offer' || msg.type === 'answer') {
        const desc = { type: msg.type, sdp: msg.sdp };
        const collision = msg.type === 'offer' && (P.makingOffer || pc.signalingState !== 'stable');
        if (collision && !P.polite) return;
        await pc.setRemoteDescription(desc);
        for (const c of P.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        if (msg.type === 'offer') {
          await pc.setLocalDescription();
          this.room.sendSig(id, { type: 'answer', sdp: pc.localDescription.sdp });
        }
      } else if (msg.type === 'ice') {
        const c = JSON.parse(msg.cand);
        if (pc.remoteDescription) await pc.addIceCandidate(c).catch(() => {});
        else P.pending.push(c);
      }
    } catch (e) { /* yok say */ }
  }

  drop(id) {
    const P = this.peers.get(id);
    if (!P) return;
    this.peers.delete(id);
    try { P.pc.close(); } catch (e) { /* yok say */ }
    if (P.audio) { P.audio.srcObject = null; }
    this.levels.delete(id);
    this.speaking.delete(id);
    this.onSpeaking(this.speaking);
    this.onChange();
  }

  // Konuşan kim: ses seviyesini 120 ms'de bir ölç
  watchLevel(id, stream) {
    try {
      const src = this.ctx.createMediaStreamSource(stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      this.levels.set(id, { an, buf: new Float32Array(an.fftSize), hold: 0 });
    } catch (e) { /* yok say */ }
  }

  tick() {
    let changed = false;
    for (const [id, L] of this.levels) {
      L.an.getFloatTimeDomainData(L.buf);
      let s = 0;
      for (const v of L.buf) s += v * v;
      const rms = Math.sqrt(s / L.buf.length);
      const mine = id === this.me.id;
      const talking = rms > 0.02 && !(mine && this.muted);
      if (talking) L.hold = 4; else if (L.hold > 0) L.hold--;
      const on = L.hold > 0;
      if (on !== this.speaking.has(id)) { if (on) this.speaking.add(id); else this.speaking.delete(id); changed = true; }
    }
    if (changed) this.onSpeaking(this.speaking);
  }

  // iOS: ses çalmayı bir dokunuşla yeniden başlat
  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    for (const P of this.peers.values()) if (P.audio) P.audio.play().catch(() => {});
  }

  get count() { return [...this.peers.values()].filter((P) => P.pc.connectionState === 'connected').length; }
}
