// Sesler kodla üretilir (Web Audio). Ses dosyası yok, telif derdi yok.
export class Sound {
  constructor() {
    this.enabled = true;
    this.voice = true;
    this.ctx = null;
    this.noise = null;
    this.trVoice = null;
    this.unlockedSpeech = false;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.2;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* ses yoksa oyun yine çalışır */ }
    if (!this.unlockedSpeech && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
        this.unlockedSpeech = true;
        this.pickVoice();
        if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = () => this.pickVoice();
      } catch (e) { /* yok say */ }
    }
  }

  pickVoice() {
    const vs = speechSynthesis.getVoices();
    this.trVoice = vs.find((v) => /^tr(-|_|$)/i.test(v.lang)) || null;
  }

  get ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; }
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

  // --- oyun sesleri
  dice() {
    if (!this.ok) return;
    const t0 = this.t;
    let t = t0;
    for (let i = 0; i < 9; i++) {
      t += 0.03 + Math.random() * 0.06;
      this.burst(t, { f: 2600 + Math.random() * 1800, q: 6, gain: 0.25 + Math.random() * 0.2, decay: 0.035 });
    }
    // tahtaya düşüş: iki tok vuruş
    for (const [dt, gn] of [[0.08, 0.7], [0.2, 0.45]]) {
      this.burst(t + dt, { f: 1500, q: 2.5, gain: gn, decay: 0.06 });
      this.tone(t + dt, { f: 210, f2: 120, gain: 0.35 * gn, decay: 0.08 });
    }
  }

  place() {
    if (!this.ok) return;
    const t = this.t;
    this.burst(t, { f: 2100, q: 2.8, gain: 0.55, decay: 0.045 });
    this.tone(t, { f: 190, f2: 110, gain: 0.32, decay: 0.09 });
  }

  hit() {
    if (!this.ok) return;
    const t = this.t;
    this.burst(t, { f: 2600, q: 2, gain: 0.8, decay: 0.05 });
    this.tone(t, { f: 140, f2: 60, gain: 0.5, decay: 0.16 });
    // savrulma
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(600, t + 0.03); fl.frequency.exponentialRampToValueAtTime(3200, t + 0.28);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + 0.03); g.gain.exponentialRampToValueAtTime(0.22, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    src.connect(fl).connect(g).connect(this.master); src.start(t + 0.03, 0.2, 0.4);
    this.burst(t + 0.3, { f: 1700, q: 2.5, gain: 0.4, decay: 0.05 });
  }

  bearOff() {
    if (!this.ok) return;
    const t = this.t;
    this.burst(t, { f: 1600, q: 2, gain: 0.35, decay: 0.05 });
    this.tone(t + 0.02, { f: 520, f2: 880, type: 'triangle', gain: 0.12, decay: 0.16 });
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
    if (!this.enabled || !this.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'tr-TR';
      if (this.trVoice) u.voice = this.trVoice;
      u.rate = 1.02; u.pitch = 1.0; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) { /* yok say */ }
  }
}
