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
  burst(t, { f = 2000, q = 3, gain = 0.5, decay = 0.05, type = 'bandpass', len = 0.12, out = null } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(fl).connect(g).connect(out || this.master);
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
  ring(t, f, gain, decay, out = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = f * (0.97 + Math.random() * 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    if (out) g.connect(out);
    else { g.connect(this.master); g.connect(this.verb); }
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
  dice() {
    if (!this.ok) return;
    const t0 = this.t, R = Math.random;
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

  place() {
    if (!this.ok) return;
    const t = this.t;
    this.impact(t, 'chkWood', 1);
    this.impact(t + 0.028 + Math.random() * 0.01, 'chkWood', 0.18); // küçük ikinci sekme
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
    // kenara düşüş
    this.impact(t + 0.68, 'chkWood', 0.7);
    this.impact(t + 0.71, 'chkChk', 0.25);
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

  doubles() {
    if (!this.ok) return;
    const t = this.t;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.07, { f, type: 'triangle', gain: 0.16, decay: 0.32 }));
  }

  win() {
    if (!this.ok) return;
    const t = this.t;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(t + i * 0.11, { f, type: 'triangle', gain: 0.18, decay: 0.4 }));
    [523, 659, 784].forEach((f) => this.tone(t + 0.7, { f, type: 'sine', gain: 0.12, a: 0.02, decay: 1.1 }));
  }

  lose() {
    if (!this.ok) return;
    const t = this.t;
    [392, 330, 262].forEach((f, i) => this.tone(t + i * 0.18, { f, type: 'triangle', gain: 0.14, decay: 0.4 }));
  }

  mars() {
    if (!this.ok) return;
    const t = this.t;
    this.tone(t, { f: 70, f2: 40, gain: 0.7, decay: 0.35 });
    this.burst(t, { f: 900, q: 0.8, gain: 0.5, decay: 0.12, type: 'lowpass' });
    const c = this.ctx;
    for (const f of [131, 165, 196]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(400, t + 0.15); fl.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + 0.15); g.gain.exponentialRampToValueAtTime(0.09, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(fl).connect(g).connect(this.master); o.start(t + 0.15); o.stop(t + 1.5);
    }
  }

  pop() {
    if (!this.ok) return;
    this.tone(this.t, { f: 420, f2: 980, type: 'sine', gain: 0.2, decay: 0.09, dur: 0.07 });
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

  // --- kahvehane ortamı
  // Uzaktan gelen konuşma uğultusu, oda uğultusu, çay bardağı/kaşık şıngırtısı, başka masalardaki tavla.
  // Hepsi kodla üretilir. ambience(true) yalnızca isteği kaydeder; ses bağlamı açılınca kendiliğinden başlar.
  ambience(on) {
    this.ambWant = !!on;
    if (on && !this.ambTimer) this.ambTimer = setInterval(() => this.ambTick(), 200);
    this.ambTick();
  }

  get ambPlaying() { return !!(this.amb && this.amb.live); }

  ambBuild() {
    const c = this.ctx;
    const A = { live: false, voices: [], nextClink: 0, nextGame: 0 };
    A.out = c.createGain(); A.out.gain.value = 0.0001;
    A.out.connect(this.master);
    const send = c.createGain(); send.gain.value = 0.9; A.out.connect(send).connect(this.verb);
    // konuşmalar: uzakta, boğuk
    A.talk = c.createBiquadFilter(); A.talk.type = 'lowpass'; A.talk.frequency.value = 1500; A.talk.Q.value = 0.5;
    const talkG = c.createGain(); talkG.gain.value = 0.55;
    A.talk.connect(talkG).connect(A.out);
    // oda uğultusu: kahverengi gürültü
    const len = c.sampleRate * 4;
    const nb = c.createBuffer(1, len, c.sampleRate);
    const d = nb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const hum = c.createBufferSource(); hum.buffer = nb; hum.loop = true;
    const hl = c.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 380;
    const hg = c.createGain(); hg.gain.value = 0.35;
    hum.connect(hl).connect(hg).connect(A.out); hum.start();
    A.hum = hum;
    // 6 ses: erkek ağırlıklı, her biri kendi perdesinde
    const bases = [105, 118, 128, 140, 165, 205];
    for (const base of bases) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base;
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.value = 600;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 7; f2.frequency.value = 1200;
      const g2 = c.createGain(); g2.gain.value = 0.5;
      const env = c.createGain(); env.gain.value = 0;
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      o.connect(f1).connect(env); o.connect(f2).connect(g2).connect(env);
      if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; env.connect(pan).connect(A.talk); } else env.connect(A.talk);
      o.start();
      A.voices.push({ o, f1, f2, env, base, next: c.currentTime + Math.random() * 2, loud: 0.5 + Math.random() * 0.5, talking: Math.random() < 0.6 });
    }
    A.nextClink = c.currentTime + 1 + Math.random() * 4;
    A.nextGame = c.currentTime + 3 + Math.random() * 6;
    this.amb = A;
  }

  ambTick() {
    if (!this.ambWant && !this.amb) { clearInterval(this.ambTimer); this.ambTimer = null; return; }
    const want = this.ambWant && this.ok && !document.hidden;
    if (!want) {
      if (this.amb && this.amb.live) { this.amb.out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25); this.amb.live = false; }
      if (!this.ambWant && this.amb && this.ctx) {
        const A = this.amb; this.amb = null;
        setTimeout(() => { try { A.hum.stop(); for (const v of A.voices) v.o.stop(); A.out.disconnect(); } catch (e) { /* yok say */ } }, 1500);
        clearInterval(this.ambTimer); this.ambTimer = null;
      }
      return;
    }
    if (!this.amb) this.ambBuild();
    const A = this.amb, c = this.ctx, now = c.currentTime, R = Math.random;
    if (!A.live) { A.out.gain.cancelScheduledValues(now); A.out.gain.setTargetAtTime(0.22, now, 1.2); A.live = true; }
    const ahead = now + 0.6;
    // ünlüler: [F1, F2] (a, e, ı, i, o, ö, u, ü)
    const V = [[730, 1250], [530, 1850], [450, 1450], [300, 2200], [500, 900], [420, 1650], [330, 850], [300, 1700]];
    for (const v of A.voices) {
      while (v.next < ahead) {
        let t = Math.max(v.next, now);
        if (!v.talking) {
          // sessizlik bitti, konuşmaya başla
          v.talking = true; v.left = 4 + Math.floor(R() * 14); v.next = t; continue;
        }
        if (v.left-- <= 0) {
          v.env.gain.setTargetAtTime(0, t, 0.05);
          v.talking = false; v.next = t + 0.8 + R() * 4; continue;
        }
        const dur = 0.09 + R() * 0.16;
        const [a, b] = V[Math.floor(R() * V.length)];
        const p = v.base * (0.9 + R() * 0.25) * (v.left < 2 ? 0.88 : 1);
        v.o.frequency.setTargetAtTime(p, t, 0.04);
        v.f1.frequency.setTargetAtTime(a, t, 0.03);
        v.f2.frequency.setTargetAtTime(b, t, 0.03);
        const lv = v.loud * (0.5 + R() * 0.5) * 0.09;
        v.env.gain.setTargetAtTime(lv, t, 0.02);
        v.env.gain.setTargetAtTime(lv * 0.15, t + dur * 0.7, 0.03); // ünsüz boşluğu
        // bazen kısa bir duraklama (kelime arası)
        v.next = t + dur + (R() < 0.22 ? 0.12 + R() * 0.3 : 0.015);
        // ara sıra kahkaha: hızlı, tiz hecelerle
        if (R() < 0.006) {
          for (let k = 0; k < 5; k++) {
            const tk = v.next + k * 0.14;
            v.o.frequency.setTargetAtTime(v.base * 1.6, tk, 0.02);
            v.f1.frequency.setTargetAtTime(750, tk, 0.02);
            v.env.gain.setTargetAtTime(v.loud * 0.11, tk, 0.015);
            v.env.gain.setTargetAtTime(0.002, tk + 0.08, 0.02);
          }
          v.next += 0.75;
        }
      }
    }
    // çay bardağı, kaşık
    if (A.nextClink < ahead) {
      const t = Math.max(A.nextClink, now);
      const n = R() < 0.4 ? 3 + Math.floor(R() * 3) : 1; // karıştırma ya da tek tık
      for (let k = 0; k < n; k++) {
        const tk = t + k * (0.11 + R() * 0.05), g = (0.18 + R() * 0.15) * (k ? 0.7 : 1);
        this.ring(tk, 3100 + R() * 1400, g, 0.18 + R() * 0.15, A.out);
        this.ring(tk, 5600 + R() * 1600, g * 0.5, 0.09, A.out);
        this.burst(tk, { f: 4500, q: 2, gain: g * 0.6, decay: 0.008, len: 0.03, out: A.out });
      }
      A.nextClink = t + 3 + R() * 9;
    }
    // başka masalarda tavla: zar ve pul tıkırtısı
    if (A.nextGame < ahead) {
      const t = Math.max(A.nextGame, now);
      const dice = R() < 0.5, n = dice ? 3 + Math.floor(R() * 3) : 1 + Math.floor(R() * 2);
      let tk = t;
      for (let k = 0; k < n; k++) {
        const g = 0.35 * (dice ? 1 - k * 0.15 : 1);
        this.burst(tk, { f: dice ? 3000 : 1600, q: 1.5, gain: g, decay: 0.012, len: 0.04, out: A.out });
        this.ring(tk, dice ? 1900 : 900, g * 0.35, 0.05, A.out);
        this.ring(tk, 230, g * 0.5, 0.08, A.out);
        tk += dice ? 0.06 + R() * 0.09 : 0.18 + R() * 0.2;
      }
      A.nextGame = t + 4 + R() * 9;
    }
  }
}
