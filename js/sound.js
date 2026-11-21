// Sesler kodla üretilir (Web Audio). Ses dosyası yok, telif derdi yok.
//
// iPhone notları:
// - Ses ancak gerçek bir dokunuşta (touchend/click) açılabilir; pointerdown dokunmatikte sayılmaz.
// - Web Audio, telefonun sessiz anahtarı açıkken susar. Ses açıksa oturumu "playback" yaparak
//   (iOS 17+) ya da eski sürümlerde sessiz bir <audio> döngüsü çalarak bunu aşıyoruz.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function silentWavURL() {
  // 0,5 sn, 8 kHz, 8 bit, tek kanal sessizlik
  const n = 4000;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class Sound {
  constructor() {
    this._enabled = true;
    this.voice = true;
    this.ctx = null;
    this.noise = null;
    this.trVoice = null;
    this.speechReady = false;
    this.silentEl = null;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.silentEl) this.silentEl.pause(); return; }
      if (this.ctx && this.ctx.state !== 'running' && this._enabled) this.ctx.resume().catch(() => {});
      if (this.silentEl && this._enabled) this.silentEl.play().catch(() => {});
    });
  }

  get enabled() { return this._enabled; }
  set enabled(on) {
    this._enabled = !!on;
    this.applySession();
    if (this.silentEl) { if (on && !document.hidden) this.silentEl.play().catch(() => {}); else this.silentEl.pause(); }
  }

  // Ses açıksa sessiz anahtarı aş; kapalıysa diğer uygulamaların sesine karışma
  applySession() {
    try { if (navigator.audioSession) navigator.audioSession.type = this._enabled ? 'playback' : 'ambient'; } catch (e) { /* desteklenmiyor */ }
  }

  // Yalnızca dokunuş/tıklama/tuş olayının içinde çağrılmalı
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.applySession();
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        this.master.connect(comp).connect(this.ctx.destination);
        // küçük oda yankısı: sesler boşlukta değil, masada çalıyormuş gibi
        this.verb = this.ctx.createConvolver();
        const irLen = Math.floor(this.ctx.sampleRate * 0.4);
        const ir = this.ctx.createBuffer(2, irLen, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = ir.getChannelData(ch);
          for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2) * (i < 40 ? i / 40 : 1);
        }
        this.verb.buffer = ir;
        this.wet = this.ctx.createGain();
        this.wet.gain.value = 0.16;
        this.verb.connect(this.wet).connect(this.master);
        const len = Math.floor(this.ctx.sampleRate * 1.2);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      // WebKit: dokunuşun içinde kısa bir sessiz tampon çalmak bağlamı kesin açar
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.ctx.destination); s.start(0);
      if (IOS && !navigator.audioSession && this._enabled && !this.silentEl) {
        const el = document.createElement('audio');
        el.setAttribute('playsinline', '');
        el.setAttribute('x-webkit-airplay', 'deny');
        el.loop = true;
        el.src = silentWavURL();
        el.play().catch(() => {});
        this.silentEl = el;
      }
    } catch (e) { /* ses yoksa oyun yine çalışır */ }
    if (!this.speechReady && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        u.lang = 'tr-TR';
        speechSynthesis.speak(u);
        this.speechReady = true;
        this.pickVoice();
        speechSynthesis.addEventListener('voiceschanged', () => this.pickVoice());
      } catch (e) { /* yok say */ }
    }
  }

  pickVoice() {
    const vs = speechSynthesis.getVoices();
    this.trVoice = vs.find((v) => /^tr(-|_|$)/i.test(v.lang)) || null;
  }

  get ok() { return this._enabled && this.ctx && this.ctx.state === 'running'; }
  get t() { return this.ctx.currentTime; }

  // --- yapı taşları
  burst(t, { f = 2000, q = 3, gain = 0.5, decay = 0.05, type = 'bandpass', len = 0.12 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(fl).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.8, len);
  }

  tone(t, { f = 440, f2 = null, type = 'sine', gain = 0.3, a = 0.005, decay = 0.2, dur = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (dur || decay));
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + a + decay + 0.05);
    return o;
  }

  // Titreşim kipi: kısa, kendiliğinden sönen sinüs (ahşabın, zarın, pulun "çınlaması")
  ring(t, f, gain, decay) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = f * (0.97 + Math.random() * 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    g.connect(this.master);
    g.connect(this.verb);
    o.start(t);
    o.stop(t + decay + 0.03);
  }

  // Çarpma: çok kısa bir tıkırtı + çarpışan cisimlerin kendi titreşimleri
  impact(t, kind, gain = 1) {
    const K = {
      // zar ahşap tahtaya: sert, parlak tık ve tahtanın tok gövdesi
      dieWood: { click: [3600, 1.1, 0.9, 0.012], modes: [[5200, 0.022, 0.22], [7600, 0.016, 0.12], [210, 0.12, 0.5], [430, 0.085, 0.3], [770, 0.06, 0.2], [1380, 0.04, 0.14]] },
      // zar zara: yalnızca ince, sert tıkırtı
      dieDie: { click: [5200, 1.8, 0.7, 0.008], modes: [[4300, 0.026, 0.28], [6200, 0.02, 0.18]] },
      // pul tahtaya: yumuşak tık ve kalın ahşap "tok"
      chkWood: { click: [1700, 1.2, 0.75, 0.02], modes: [[1250, 0.032, 0.2], [2150, 0.022, 0.12], [175, 0.14, 0.62], [350, 0.1, 0.36], [640, 0.065, 0.2]] },
      // pul pula: daha tiz, çınlayan çarpma
      chkChk: { click: [3000, 1.4, 0.85, 0.014], modes: [[2550, 0.04, 0.32], [3900, 0.028, 0.2], [1420, 0.035, 0.2]] },
    }[kind];
    const [cf, cq, cg, cd] = K.click;
    this.burst(t, { f: cf * (0.9 + Math.random() * 0.2), q: cq, gain: cg * gain, decay: cd, len: 0.05 });
    for (const [f, d, a] of K.modes) this.ring(t, f, a * gain * 0.55, d * (0.85 + Math.random() * 0.3));
  }

  // Pul tahtada kayarken çıkan hafif sürtünme
  slide() {
    if (!this.ok) return;
    const c = this.ctx, t = this.t;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(fl).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.8, 0.2);
  }

  // --- oyun sesleri
  dice(rim = false) {
    if (!this.ok) return;
    const t0 = this.t, R = Math.random;
    if (rim) this.rim(t0 + 0.47);
    // avuçta sallama: zarlar birbirine çarpar
    let t = t0;
    for (let i = 0; i < 7; i++) { t += 0.024 + R() * 0.034; this.impact(t, 'dieDie', 0.22 + R() * 0.16); }
    // atış: her zar tahtaya düşer, giderek sıklaşan ve kısılan sekmelerle durur
    for (let k = 0; k < 2; k++) {
      let tt = t0 + 0.27 + k * (0.025 + R() * 0.03), dt = 0.11 + R() * 0.035, g = 1;
      for (let n = 0; n < 7 && dt > 0.018; n++) {
        this.impact(tt, 'dieWood', g * (0.8 + R() * 0.25));
        tt += dt; dt *= 0.6 + R() * 0.06; g *= 0.58;
      }
      // son yuvarlanma: kenar üstünde küçük tıkırtılar
      for (let j = 0; j < 3; j++) this.impact(tt + j * (0.03 + R() * 0.02), 'dieWood', 0.06);
    }
    // iki zar yolda birbirine değer
    this.impact(t0 + 0.34 + R() * 0.05, 'dieDie', 0.45);
  }

  // kind: 'single' boş haneye, 'stack' kendi pullarının üstüne, 'door' kapı yapınca
  place(kind = 'single') {
    if (!this.ok) return;
    const t = this.t;
    if (kind === 'single') {
      this.impact(t, 'chkWood', 1.05);
      this.impact(t + 0.028 + Math.random() * 0.01, 'chkWood', 0.2); // küçük ikinci sekme
    } else {
      // pul pula oturur: tiz çarpma, altında tahtanın tok sesi
      this.impact(t, 'chkChk', kind === 'door' ? 1.05 : 0.85);
      this.impact(t + 0.006, 'chkWood', 0.45);
      this.impact(t + 0.034, 'chkChk', 0.16);
      if (kind === 'door') this.boom(t, 0.22);
    }
  }

  // Zar tahtanın kenarına çarpar: kalın, tok darbe
  rim(t) {
    this.impact(t, 'dieWood', 1.15);
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.master); o.connect(g).connect(this.verb); o.start(t); o.stop(t + 0.25);
    this.burst(t, { f: 700, q: 0.9, gain: 0.5, decay: 0.03, type: 'lowpass', len: 0.08 });
  }

  hit() {
    if (!this.ok) return;
    const t = this.t;
    this.impact(t, 'chkChk', 1.15);
    // savrulma
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.1;
    fl.frequency.setValueAtTime(500, t + 0.03); fl.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + 0.03); g.gain.exponentialRampToValueAtTime(0.12, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(fl).connect(g).connect(this.master); src.start(t + 0.03, 0.2, 0.45);
    // gövdeden gelen tok darbe ve çatlama
    this.boom(t, 1);
    this.collapse(t + 0.05);
    const cr = c.createBufferSource(); cr.buffer = this.noise;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const cg = c.createGain(); cg.gain.setValueAtTime(0.5, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    cr.connect(hp).connect(cg).connect(this.master); cr.start(t, 0.5, 0.12);
    // kenara düşüş
    this.impact(t + 0.76, 'chkWood', 0.9);
    this.impact(t + 0.79, 'chkChk', 0.3);
    this.boom(t + 0.76, 0.5);
    this.impact(t + 0.95, 'chkWood', 0.25);
  }

  // Bina yıkılması: çatırdama, derin gümbürtü, ufalanma ve uzun süre düşen moloz
  collapse(t) {
    const c = this.ctx, R = Math.random;
    const bus = c.createGain(); bus.gain.value = 0.55;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    bus.connect(comp); comp.connect(this.master); comp.connect(this.verb);
    const noise = (start, dur, filt, env) => {
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = filt.type; fl.Q.value = filt.q || 0.7;
      fl.frequency.setValueAtTime(filt.f0, start);
      if (filt.f1) fl.frequency.exponentialRampToValueAtTime(filt.f1, start + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, start);
      for (const [dt, v] of env) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), start + dt);
      src.connect(fl).connect(g).connect(bus);
      src.start(start, R() * 1.1); src.stop(start + dur + 0.05);
      return g;
    };
    // 1) ilk çatırdamalar: kiriş kırılıyor
    for (const dt of [0, 0.05, 0.13, 0.21, 0.34]) {
      const s0 = t + dt + R() * 0.02;
      noise(s0, 0.09, { type: 'highpass', f0: 1400 + R() * 1500 }, [[0.002, 0.3 + R() * 0.2], [0.08, 0.0001]]);
      noise(s0, 0.12, { type: 'bandpass', f0: 300 + R() * 300, q: 1.5 }, [[0.003, 0.25], [0.11, 0.0001]]);
    }
    // 2) derin gümbürtü: yavaş açılıp uzun söner
    noise(t + 0.15, 3.2, { type: 'lowpass', f0: 220, f1: 70, q: 0.9 }, [[0.25, 1.1], [0.9, 0.85], [2.0, 0.35], [3.2, 0.0001]]);
    const sub = c.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(58, t + 0.15); sub.frequency.exponentialRampToValueAtTime(26, t + 2.2);
    const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t + 0.15); sg.gain.exponentialRampToValueAtTime(0.7, t + 0.35); sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    sub.connect(sg).connect(bus); sub.start(t + 0.15); sub.stop(t + 2.5);
    // 3) ufalanma: orta frekansta dalgalı hışırtı (beton ve sıva dökülüyor)
    const cr = noise(t + 0.3, 2.6, { type: 'bandpass', f0: 900, f1: 500, q: 0.8 }, [[0.3, 0.5], [1.4, 0.3], [2.6, 0.0001]]);
    for (let k = 0; k < 26; k++) {
      const tk = t + 0.35 + k * 0.08 + R() * 0.04;
      cr.gain.setValueAtTime(0.12 + R() * 0.45 * (1 - k / 26), tk);
    }
    // 4) moloz: önce sık ve iri, sonra seyrek ve ufak parçalar
    for (let i = 0; i < 46; i++) {
      const u = Math.pow(R(), 1.7);
      const tk = t + 0.25 + u * 2.9;
      const big = 1 - u;
      this.burstTo(bus, tk, { f: 350 + R() * 2600 * (0.4 + u), q: 1.5 + R() * 4, gain: (0.15 + R() * 0.35) * (0.35 + big), decay: 0.02 + R() * 0.07 * big + 0.01 });
      if (big > 0.6 && R() < 0.5) this.burstTo(bus, tk, { f: 120 + R() * 120, q: 1, gain: 0.5 * big, decay: 0.12, type: 'lowpass' });
    }
    // 5) en sonda ince taş tozu ve birkaç küçük çakıl
    for (let i = 0; i < 8; i++) this.burstTo(bus, t + 2.6 + R() * 0.9, { f: 3000 + R() * 3000, q: 3, gain: 0.08 + R() * 0.08, decay: 0.02 });
  }

  burstTo(out, t, { f = 2000, q = 3, gain = 0.5, decay = 0.05, type = 'bandpass' } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(fl).connect(g).connect(out);
    src.start(t, Math.random() * 0.8, decay + 0.05);
  }

  boom(t, k) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.32);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75 * k, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.45);
  }

  // Oyunun son pulu tepsiye iner
  lastOff() {
    if (!this.ok) return;
    const t = this.t;
    this.impact(t, 'chkWood', 1.1);
    this.impact(t + 0.02, 'chkChk', 0.6);
    this.boom(t, 0.35);
  }

  bearOff() {
    if (!this.ok) return;
    const t = this.t;
    // tepsiye bırakılır, diğer toplanmış pullara değer
    this.impact(t, 'chkWood', 0.85);
    this.impact(t + 0.018, 'chkChk', 0.45);
    this.impact(t + 0.05, 'chkWood', 0.15);
  }

  turn() {
    if (!this.ok) return;
    const t = this.t;
    this.tone(t, { f: 659, type: 'sine', gain: 0.16, a: 0.01, decay: 0.35 });
    this.tone(t + 0.13, { f: 880, type: 'sine', gain: 0.16, a: 0.01, decay: 0.5 });
  }

  doubles() {}

  win() {}

  lose() {}

  mars() {
    if (!this.ok) return;
    const t = this.t;
    this.tone(t, { f: 70, f2: 40, gain: 0.7, decay: 0.35 });
    this.burst(t, { f: 900, q: 0.8, gain: 0.5, decay: 0.12, type: 'lowpass' });
  }

  pop() {
    if (!this.ok) return;
    this.tone(this.t, { f: 420, f2: 980, type: 'sine', gain: 0.2, decay: 0.09, dur: 0.07 });
  }

  // Gelen mesaj: MSN Messenger'ı andıran, iki notalı parlak çan
  msn() {
    if (!this.ok) return;
    const t = this.t;
    const bell = (tt, f, g) => {
      for (const [m, a, d] of [[1, 1, 0.9], [2.0, 0.35, 0.45], [3.01, 0.18, 0.25], [4.2, 0.08, 0.15]]) {
        this.tone(tt, { f: f * m, type: 'sine', gain: g * a, a: 0.004, decay: d });
      }
    };
    bell(t, 1318.5, 0.16);        // mi
    bell(t + 0.12, 1975.5, 0.15); // si
    bell(t + 0.12, 987.8, 0.06);
  }

  error() {
    if (!this.ok) return;
    const t = this.t;
    this.tone(t, { f: 180, type: 'square', gain: 0.05, decay: 0.08 });
    this.tone(t + 0.1, { f: 150, type: 'square', gain: 0.05, decay: 0.1 });
  }

  join() {
    if (!this.ok) return;
    const t = this.t;
    this.tone(t, { f: 587, gain: 0.14, decay: 0.25 });
    this.tone(t + 0.1, { f: 784, gain: 0.14, decay: 0.35 });
  }

  say(text) {
    if (!this._enabled || !this.voice || !this.speechReady || !('speechSynthesis' in window)) return;
    try {
      const busy = speechSynthesis.speaking || speechSynthesis.pending;
      if (busy) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'tr-TR';
      if (this.trVoice) u.voice = this.trVoice;
      u.rate = 1.02; u.pitch = 1.0; u.volume = 1;
      // Safari: cancel()'dan hemen sonraki speak() bazen yutuluyor
      if (busy) setTimeout(() => speechSynthesis.speak(u), 80);
      else speechSynthesis.speak(u);
    } catch (e) { /* yok say */ }
  }
}
