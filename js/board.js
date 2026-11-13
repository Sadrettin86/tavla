// Tahta görünümü: statik tahta resmi + pullar, vurgular, dokunma alanları ve animasyonlar.
import { THEMES, geometry, renderBoard, checkerDefs, checkerParts, F } from './theme.js';

// PX/PY: tahta resminin gölge payı. VX/VY: ekranda bırakılan pay (dar tutuldu, tahta büyük görünsün;
// gölge kenardan taşabilir).
const W = 520, H = 362, PX = 14, PY = 12, VX = 0, VY = 0;
export const VIEW_W = W + 2 * VX, VIEW_H = H + 2 * VY;
const NS = 'http://www.w3.org/2000/svg';

const el = (tag, attrs = {}, html = '') => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
};
const pts = (arr) => arr.map((p) => `${F(p[0])},${F(p[1])}`).join(' ');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

export class BoardView {
  constructor(wrap, { onTap }) {
    this.wrap = wrap;
    this.onTap = onTap;
    this.g = geometry(W, H);
    this.viewer = 'w';
    this.themeKey = null;
    this.svg = el('svg', { viewBox: `${-VX} ${-VY} ${VIEW_W} ${VIEW_H}`, class: 'board-svg', role: 'img', 'aria-label': 'Tavla tahtası' });
    this.defs = el('defs');
    this.bg = el('image', { x: -PX, y: -PY, width: W + 2 * PX, height: H + 2 * PY, preserveAspectRatio: 'none' });
    this.lHl = el('g', { class: 'l-hl' });
    this.lLast = el('g', { class: 'l-last' });
    this.lOff = el('g', { class: 'l-off' });
    this.lUnder = el('g', { class: 'l-under' });
    this.lChk = el('g', { class: 'l-chk' });
    this.lSel = el('g', { class: 'l-sel' });
    this.lFx = el('g', { class: 'l-fx' });
    this.lHit = el('g', { class: 'l-hit' });
    for (const l of [this.defs, this.bg, this.lHl, this.lLast, this.lOff, this.lUnder, this.lChk, this.lSel, this.lFx, this.lHit]) this.svg.appendChild(l);
    wrap.appendChild(this.svg);
    this.pool = { w: [], b: [] };
    this.stacks = {};
    this.buildHitAreas();
    this.svg.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]');
      if (t) this.onTap(t.dataset.t);
    });
  }

  // ---------------------------------------------------------- koordinatlar
  disp(a) { return this.viewer === 'b' ? 25 - a : a; }
  slot(a, i, n) { return this.g.slot(this.disp(a), i, n); }
  barSlot(c, i) { return this.g.barSlot(c === this.viewer ? 'w' : 'b', i); }
  offSlot(c, i) {
    const { py0, py1, ph, trayX0, trayX1 } = this.g;
    const slabH = Math.min(9.5, (ph / 2 - 12) / 15);
    const mine = c === this.viewer;
    return { x: (trayX0 + trayX1) / 2, y: mine ? py1 - 5 - (i + 0.5) * slabH : py0 + 5 + (i + 0.5) * slabH, slabH };
  }
  // ekran koordinatı (CSS piksel, sarmalayıcıya göre)
  toPx(x, y) {
    const u = this.wrap.clientWidth / VIEW_W;
    return { x: (x + VX) * u, y: (y + VY) * u, u };
  }
  get right() { return this.g.right; }
  get left() { return this.g.left; }

  // ---------------------------------------------------------- tema
  setTheme(key) {
    if (this.themeKey === key) return;
    this.themeKey = key;
    const T = THEMES[key] || THEMES.ceviz;
    this.T = T;
    const empty = { pts: {}, bar: {}, off: {} };
    const { svg } = renderBoard({ W, H, theme: T, pos: empty, id: 'bg', seed: 21, pad: [PX, PY] });
    this.bg.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    this.defs.innerHTML = checkerDefs(T, 'k') +
      `<filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>`;
    // pul havuzunu yeniden oluştur
    this.lChk.innerHTML = '';
    for (const c of ['w', 'b']) {
      this.pool[c] = [];
      for (let i = 0; i < 15; i++) {
        const parts = checkerParts(T, 'k', c, this.g.r);
        const g = el('g', { class: 'chk', 'data-c': c }, `<g class="shw">${parts.shadow}</g><g class="ci">${parts.body}</g>`);
        g.style.display = 'none';
        this.lChk.appendChild(g);
        this.pool[c].push(g);
      }
    }
    if (this.G) this.render(this.G);
  }

  setViewer(c) {
    if (this.viewer === c) return;
    this.viewer = c;
    this.buildHitAreas();
    if (this.G) this.render(this.G);
  }

  buildHitAreas() {
    const { py0, py1, midY, pw, barX0, barX1, trayX0, trayX1 } = this.g;
    this.lHit.innerHTML = '';
    for (let a = 1; a <= 24; a++) {
      const v = this.disp(a);
      const top = v >= 13;
      const x = this.g.colX(this.g.col(v));
      this.lHit.appendChild(el('rect', { x: F(x), y: F(top ? py0 - 6 : midY), width: F(pw), height: F((py1 - py0) / 2 + 6), fill: 'transparent', 'data-t': String(a) }));
    }
    this.lHit.appendChild(el('rect', { x: F(barX0), y: F(py0), width: F(barX1 - barX0), height: F(py1 - py0), fill: 'transparent', 'data-t': 'bar' }));
    this.lHit.appendChild(el('rect', { x: F(trayX0 - 4), y: F(py0), width: F(trayX1 - trayX0 + 8), height: F(py1 - py0), fill: 'transparent', 'data-t': 'off' }));
  }

  // ---------------------------------------------------------- çizim
  setPos(e, x, y) { e.style.transform = `translate(${F(x)}px, ${F(y)}px)`; e._x = x; e._y = y; }

  render(G) {
    this.G = G;
    if (!this.T) return;
    const b = G.board;
    const used = { w: 0, b: 0 };
    this.stacks = {};
    const order = [];
    for (let a = 1; a <= 24; a++) {
      const v = b.p[a];
      if (!v) continue;
      const c = v > 0 ? 'w' : 'b';
      const n = Math.abs(v);
      const st = (this.stacks['p' + a] = []);
      for (let i = 0; i < n; i++) {
        const e = this.pool[c][used[c]++];
        const s = this.slot(a, i, n);
        this.setPos(e, s.x, s.y);
        e.style.display = '';
        st.push(e);
        order.push(e);
      }
    }
    for (const c of ['w', 'b']) {
      const st = (this.stacks['bar' + c] = []);
      for (let i = 0; i < b.bar[c]; i++) {
        const e = this.pool[c][used[c]++];
        const s = this.barSlot(c, i);
        this.setPos(e, s.x, s.y);
        e.style.display = '';
        st.push(e);
        order.push(e);
      }
    }
    for (const c of ['w', 'b']) for (let i = used[c]; i < 15; i++) this.pool[c][i].style.display = 'none';
    for (const e of order) this.lChk.appendChild(e);
    this.drawOff(b.off);
  }

  // toplanan pullar (tepside yatık)
  drawOff(offs) {
    let off = '';
    const { trayX0, trayX1 } = this.g;
    for (const c of ['w', 'b']) {
      for (let i = 0; i < offs[c]; i++) {
        const s = this.offSlot(c, i);
        off += `<rect x="${F(trayX0 + 4)}" y="${F(s.y - s.slabH / 2)}" width="${F(trayX1 - trayX0 - 8)}" height="${F(s.slabH - 0.8)}" rx="${F(s.slabH * 0.42)}" fill="url(#k-${c}Slab)" stroke="${this.T[c].rim}" stroke-width="0.5" stroke-opacity="0.8"></rect>`;
      }
    }
    this.lOff.innerHTML = off;
  }

  topOf(key) { const s = this.stacks[key]; return s && s.length ? s[s.length - 1] : null; }

  // ---------------------------------------------------------- vurgular
  clearMarks() {
    this.lHl.innerHTML = '';
    this.lSel.innerHTML = '';
    for (const c of ['w', 'b']) for (const e of this.pool[c]) e.classList.remove('sel');
  }

  mark({ selected = null, dests = null, movable = null, color = 'w' } = {}) {
    const T = this.T;
    const { py0, py1, triH, pw, trayX0, trayX1, r } = this.g;
    let hl = '', sel = '';
    const b = this.G.board;
    if (movable && !selected) {
      for (const a of movable) {
        let e = a === 'bar' ? this.topOf('bar' + color) : this.topOf('p' + a);
        if (e) sel += `<circle class="hint-ring" cx="${F(e._x)}" cy="${F(e._y)}" r="${F(r + 2.2)}" fill="${T.accent}" fill-opacity="0.12" stroke="${T.accent}" stroke-width="2.2" filter="url(#glow)"></circle>`;
      }
    }
    for (const cc of ['w', 'b']) for (const e of this.pool[cc]) e.classList.remove('sel');
    if (selected != null) {
      const e = selected === 'bar' ? this.topOf('bar' + color) : this.topOf('p' + selected);
      if (e) {
        sel += `<circle cx="${F(e._x)}" cy="${F(e._y)}" r="${F(r + 3)}" fill="none" stroke="${T.accent}" stroke-width="2.4" filter="url(#glow)"></circle>`;
        e.classList.add('sel');
        this.lChk.appendChild(e);
      }
    }
    if (dests) {
      for (const [to, chain] of dests) {
        const hit = chain.some((m) => m.hit);
        const col = hit ? T.danger : T.accent;
        if (to === 'off') {
          hl += `<rect x="${F(trayX0 + 1)}" y="${F(py0 + 1)}" width="${F(trayX1 - trayX0 - 2)}" height="${F(py1 - py0 - 2)}" rx="3" fill="${col}" fill-opacity="0.34" stroke="${col}" stroke-width="2.8" filter="url(#glow)" class="pulse-strong"></rect>`;
          continue;
        }
        const v = this.disp(to);
        const top = v >= 13;
        const x0 = this.g.colX(this.g.col(v)) + 0.7, x1 = x0 + pw - 1.4, xm = (x0 + x1) / 2;
        const by = top ? py0 : py1, ty = top ? py0 + triH : py1 - triH;
        hl += `<polygon points="${pts([[x0, by], [x1, by], [xm, ty]])}" fill="${col}" fill-opacity="0.4" stroke="${col}" stroke-width="2.8" stroke-linejoin="round" filter="url(#glow)" class="pulse-strong"></polygon>`;
        const cnt = Math.abs(b.p[to]);
        const own = cnt && (b.p[to] > 0) === (color === 'w');
        const idx = own ? cnt : 0;
        const s = this.slot(to, idx, Math.max(idx + 1, 1));
        if (hit && chain[chain.length - 1].hit) {
          sel += `<circle cx="${F(s.x)}" cy="${F(s.y)}" r="${F(r + 3.2)}" fill="${T.danger}" fill-opacity="0.18" stroke="${T.danger}" stroke-width="2.8" stroke-dasharray="5 3" filter="url(#glow)" class="pulse-strong"></circle>`;
          sel += `<circle class="dest-ping" cx="${F(s.x)}" cy="${F(s.y)}" r="${F(r + 1)}" fill="none" stroke="${T.danger}" stroke-width="2.4"></circle>`;
        }
        else {
          // pulun ineceği yer: dolu hedef ve dışa yayılan halka
          sel += `<circle cx="${F(s.x)}" cy="${F(s.y)}" r="${F(r - 0.5)}" fill="${col}" fill-opacity="0.38" stroke="#fff6d8" stroke-width="2" stroke-opacity="0.85" class="pulse-strong"></circle>`;
          sel += `<circle class="dest-ping" cx="${F(s.x)}" cy="${F(s.y)}" r="${F(r)}" fill="none" stroke="${col}" stroke-width="2.4"></circle>`;
        }
      }
    }
    this.lHl.innerHTML = hl;
    this.lSel.innerHTML = sel;
  }

  // rakibin son hamlesi: çıktığı yerde kesikli halka
  markLast(last) {
    if (!last || !last.moves || !last.moves.length || !this.T) { this.lLast.innerHTML = ''; return; }
    const { r } = this.g;
    const b = this.G.board;
    let s = '';
    const seen = {};
    for (const m of last.moves) {
      if (m.from === 'bar') continue;
      const n = Math.abs(b.p[m.from]) + (seen[m.from] || 0);
      seen[m.from] = (seen[m.from] || 0) + 1;
      const sl = this.slot(m.from, Math.min(n, 4), Math.max(n + 1, 1));
      s += `<circle cx="${F(sl.x)}" cy="${F(sl.y)}" r="${F(r - 1.5)}" fill="none" stroke="${this.T.accentSoft}" stroke-width="1.1" stroke-dasharray="2.5 2.5" stroke-opacity="0.6"></circle>`;
    }
    this.lLast.innerHTML = s;
  }

  // ---------------------------------------------------------- animasyonlar
  posOf(kind, c, a, i, n) {
    if (kind === 'bar') return this.barSlot(c, i);
    if (kind === 'off') return this.offSlot(c, i);
    return this.slot(a, i, n);
  }

  // Uçuş yolu: kirişin ortasından tahtanın ortasına doğru bükülen yay (pul tahtadan taşmaz)
  arcCtrl(x0, y0, x1, y1, h, bend) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    if (bend === 'center') {
      const tx = W / 2 - mx, ty = this.g.midY - my;
      if (tx * nx + ty * ny < 0) { nx = -nx; ny = -ny; }
    } else if (bend === 'ccw') { nx = -nx; ny = -ny; }
    return { cx: mx + nx * h, cy: my + ny * h };
  }

  // Örneklenmiş ara kareler: havalanma (büyüme), iniş (ezilip toparlanma) ya da tepsiye yatma
  arcFrames(x0, y0, x1, y1, { h, lift = 1.22, end = 'land', start = 'flat', bend = 'center' }) {
    const { cx, cy } = this.arcCtrl(x0, y0, x1, y1, h, bend);
    const N = 16, kf = [];
    const T = (x, y, sx, sy = sx) => `translate(${F(x)}px, ${F(y)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const s = 1 + (lift - 1) * Math.sin(Math.PI * t);
      kf.push({ transform: i === 0 && start === 'slab' ? T(x, y, 1, 0.32) : T(x, y, s), offset: +(t * 0.84).toFixed(4) });
    }
    if (end === 'slab') {
      kf.push({ transform: T(x1, y1, 1.04, 0.5), offset: 0.92 });
      kf.push({ transform: T(x1, y1, 1, 0.32), offset: 1 });
    } else {
      kf.push({ transform: T(x1, y1 + 0.8, 1.1, 0.86), offset: 0.9 });
      kf.push({ transform: T(x1, y1 - 0.6, 0.96, 1.05), offset: 0.95 });
      kf.push({ transform: T(x1, y1, 1), offset: 1 });
    }
    return kf;
  }

  // Bir pulu yay çizerek uçur: büyüyerek havalanır, gölgesi ayrılıp açılır, arkasında iz bırakır.
  // flips: havada takla (kırılan pul için)
  fly(e, x1, y1, { dur, h, lift = 1.32, trail = true, end = 'land', start = 'flat', flips = 0, bend = 'center', streak = null, tilt = true } = {}) {
    const easing = 'cubic-bezier(.33,.06,.3,1)';
    if (reducedMotion()) { trail = false; flips = 0; streak = null; tilt = false; }
    const kf = this.arcFrames(e._x, e._y, x1, y1, { h, lift, end, start, bend });
    if (streak) this.streak(e._x, e._y, x1, y1, h, bend, streak, dur, easing);
    e.classList.remove('sel');
    this.lChk.appendChild(e);
    if (trail) {
      for (const [k, op] of [[1, 0.42], [2, 0.32], [3, 0.24], [4, 0.17], [5, 0.11], [6, 0.07], [7, 0.04]]) {
        const gh = e.cloneNode(true);
        gh.classList.add('ghost');
        const gs = gh.querySelector('.shw');
        if (gs) gs.remove();
        // iz yalnızca animasyon sürerken görünür; bitince kendiliğinden kaybolur
        gh.style.opacity = '0';
        this.lChk.insertBefore(gh, e);
        const drop = () => gh.remove();
        gh.animate(kf.map((f) => ({ ...f, opacity: op })), { duration: dur, delay: k * 26, easing, fill: 'backwards' }).finished.then(drop, drop);
      }
    }
    const sh = e.querySelector('.shw');
    if (sh) {
      sh.animate([
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: 'translate(6px, 11px) scale(1.25)', opacity: 0.35, offset: 0.42 },
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0.84 },
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      ], { duration: dur, easing });
    }
    if (flips) {
      const ci = e.querySelector('.ci');
      const n = flips * 8, fk = [];
      for (let i = 0; i <= n; i++) fk.push({ transform: `scale(${Math.cos((2 * Math.PI * flips * i) / n).toFixed(3)}, 1)`, offset: +((i / n) * 0.84).toFixed(4) });
      fk.push({ transform: 'scale(1, 1)', offset: 1 });
      if (ci) ci.animate(fk, { duration: dur, easing });
    } else if (tilt && end !== 'slab') {
      // havada hafifçe yan yatar, sonra düzelir
      const ci = e.querySelector('.ci');
      const sx = 0.8 + Math.random() * 0.06;
      if (ci) ci.animate([
        { transform: 'scale(1, 1)' },
        { transform: `scale(${sx}, 1.02)`, offset: 0.3 },
        { transform: 'scale(1.03, 0.86)', offset: 0.6 },
        { transform: 'scale(1, 1)', offset: 0.84 },
        { transform: 'scale(1, 1)' },
      ], { duration: dur, easing });
    }
    // son konum önce yazılır; animasyon bitince sıçrama olmaz
    if (end === 'slab') { e.style.transform = `translate(${F(x1)}px, ${F(y1)}px) scale(1, 0.32)`; e._x = x1; e._y = y1; }
    else this.setPos(e, x1, y1);
    return e.animate(kf, { duration: dur, easing }).finished.catch(() => {});
  }

  // Yere inişte tahtada yayılan halka ve toz
  ripple(x, y, color, big = false) {
    if (!this.T) return;
    const r = this.g.r;
    const g = el('g', { class: 'ripple', transform: `translate(${F(x)} ${F(y)})` });
    const ring = el('circle', { r: F(r * 1.02), fill: 'none', stroke: color, 'stroke-width': big ? '2.2' : '1.6' });
    g.appendChild(ring);
    this.lUnder.appendChild(g);
    ring.animate([{ transform: 'scale(0.85)', opacity: 0.95 }, { transform: `scale(${big ? 2.1 : 1.75})`, opacity: 0 }], { duration: big ? 620 : 520, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    const n = big ? 11 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const dot = el('circle', { r: F(0.7 + Math.random() * 1.1), fill: big ? color : '#efcf9a', 'fill-opacity': '0.9' });
      g.appendChild(dot);
      const d0 = r * 0.9, d = r * (1.25 + Math.random() * (big ? 1.1 : 0.7));
      dot.animate([
        { transform: `translate(${F(Math.cos(a) * d0)}px, ${F(Math.sin(a) * d0)}px)`, opacity: 1 },
        { transform: `translate(${F(Math.cos(a) * d)}px, ${F(Math.sin(a) * d)}px)`, opacity: 0 },
      ], { duration: 380 + Math.random() * 240, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    }
    setTimeout(() => g.remove(), 800);
  }

  // Komşu pulun küçük sarsıntısı (kalkış ya da iniş anı)
  nudge(e, strength) {
    if (!e || reducedMotion()) return;
    const ci = e.querySelector('.ci');
    if (!ci) return;
    const k = strength ? [{ transform: 'scale(1)' }, { transform: 'scale(1.07, 0.9)', offset: 0.3 }, { transform: 'scale(0.98, 1.03)', offset: 0.65 }, { transform: 'scale(1)' }]
      : [{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: 0.4 }, { transform: 'scale(1)' }];
    ci.animate(k, { duration: strength ? 320 : 240, easing: 'ease-out' });
  }

  // Kalkıştan önce pul hafifçe çöker (hazırlanma)
  crouch(e, ms = 110) {
    if (!e || reducedMotion()) return Promise.resolve();
    const ci = e.querySelector('.ci');
    if (!ci) return Promise.resolve();
    return ci.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1, 0.84)', offset: 0.7 }, { transform: 'scale(1.06, 0.9)' }], { duration: ms, easing: 'ease-in' }).finished.catch(() => {});
  }

  // Uçuş yolunda pulu izleyen, sonra sönen ışık izi
  streak(x0, y0, x1, y1, h, bend, color, dur, easing) {
    const { cx, cy } = this.arcCtrl(x0, y0, x1, y1, h, bend);
    const r = this.g.r;
    const path = el('path', { d: `M${F(x0)} ${F(y0)} Q${F(cx)} ${F(cy)} ${F(x1)} ${F(y1)}`, fill: 'none', stroke: color, 'stroke-width': F(r * 0.95), 'stroke-linecap': 'round', pathLength: '1', 'stroke-dasharray': '1 1', 'stroke-opacity': '0.28' });
    const core = el('path', { d: path.getAttribute('d'), fill: 'none', stroke: '#fff', 'stroke-width': F(r * 0.28), 'stroke-linecap': 'round', pathLength: '1', 'stroke-dasharray': '1 1', 'stroke-opacity': '0.5' });
    const g = el('g', { class: 'streak' });
    g.appendChild(path); g.appendChild(core);
    this.lUnder.appendChild(g);
    for (const p of [path, core]) p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.84 }, { strokeDashoffset: 0 }], { duration: dur, easing, fill: 'forwards' });
    g.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: dur + 380, fill: 'forwards' }).finished.then(() => g.remove(), () => g.remove());
  }

  // Tahta sarsılır
  shake(power = 1) {
    if (reducedMotion()) return;
    const k = [0, -4, 3.5, -2.5, 1.6, -0.8, 0].map((v, i) => ({ transform: `translate(${(v * power).toFixed(2)}px, ${((i % 2 ? 1.6 : -1.2) * power * (i < 6 ? 1 : 0)).toFixed(2)}px)` }));
    this.svg.animate(k, { duration: 360, easing: 'ease-out' });
  }

  // Kırılma anı: parlama, kıymıklar
  smash(x, y, color) {
    if (!this.T || reducedMotion()) return;
    const r = this.g.r;
    const g = el('g', { transform: `translate(${F(x)} ${F(y)})` });
    this.lFx.appendChild(g);
    const flash = el('circle', { r: F(r * 1.1), fill: '#fff' });
    g.appendChild(flash);
    flash.animate([{ transform: 'scale(0.5)', opacity: 0.95 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
    const vc = this.T[color] || {};
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
      const s = r * (0.22 + Math.random() * 0.22);
      const sh = el('polygon', { points: `0,${F(-s)} ${F(s * 0.8)},${F(s * 0.6)} ${F(-s * 0.7)},${F(s * 0.5)}`, fill: i % 3 ? (vc.base || '#fff') : this.T.danger, stroke: vc.rim || '#0006', 'stroke-width': '0.5' });
      g.appendChild(sh);
      const d = r * (1.8 + Math.random() * 1.8);
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d;
      const rot = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360);
      sh.animate([
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${F(dx * 0.7)}px, ${F(dy * 0.7 - r * 0.6)}px) rotate(${F(rot * 0.6)}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${F(dx)}px, ${F(dy + r * 0.9)}px) rotate(${F(rot)}deg) scale(0.4)`, opacity: 0 },
      ], { duration: 620 + Math.random() * 260, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(() => g.remove(), 1000);
  }

  // İnişte etrafa saçılan küçük kıvılcımlar
  sparkle(x, y, color, n = 7) {
    if (reducedMotion()) return;
    const r = this.g.r;
    const g = el('g', { transform: `translate(${F(x)} ${F(y)})` });
    this.lFx.appendChild(g);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const s = 1.4 + Math.random() * 1.4;
      const star = el('path', { d: `M0 ${-s * 1.8}L${s * 0.45} ${-s * 0.45}L${s * 1.8} 0L${s * 0.45} ${s * 0.45}L0 ${s * 1.8}L${-s * 0.45} ${s * 0.45}L${-s * 1.8} 0L${-s * 0.45} ${-s * 0.45}Z`, fill: color });
      g.appendChild(star);
      const d0 = r * 0.7, d1 = r * (1.6 + Math.random() * 0.9);
      star.animate([
        { transform: `translate(${F(Math.cos(a) * d0)}px, ${F(Math.sin(a) * d0)}px) scale(0.4) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${F(Math.cos(a) * d1)}px, ${F(Math.sin(a) * d1)}px) scale(1) rotate(90deg)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(${F(Math.cos(a) * d1 * 1.1)}px, ${F(Math.sin(a) * d1 * 1.1 + 3)}px) scale(0.2) rotate(160deg)`, opacity: 0 },
      ], { duration: 520 + Math.random() * 220, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    }
    setTimeout(() => g.remove(), 900);
  }

  // m: {from, to, hit}; before: hamleden önceki durum
  async animateMove(m, c, before, { onLand, onHit } = {}) {
    const e = this.topOf(m.from === 'bar' ? 'bar' + c : 'p' + m.from);
    if (!e) return;
    const b = before.board;
    let dest;
    if (m.to === 'off') dest = this.offSlot(c, b.off[c]);
    else {
      const cnt = Math.abs(b.p[m.to]);
      const own = cnt && (b.p[m.to] > 0) === (c === 'w');
      dest = this.slot(m.to, own ? cnt : 0, own ? cnt + 1 : 1);
    }
    const dist = Math.hypot(dest.x - e._x, dest.y - e._y);
    const dur = Math.round(Math.min(860, 440 + dist * 0.95));
    const h = Math.min(90, 22 + dist * 0.3);
    // kalkarken: kaynak yığındaki alttaki pul hafifçe sarsılır
    const src = this.stacks[m.from === 'bar' ? 'bar' + c : 'p' + m.from] || [];
    this.nudge(src[src.length - 2], 0);
    // inerken: hedefteki kendi pulu çarpmayı hisseder
    const destStack = m.to === 'off' ? [] : (this.stacks['p' + m.to] || []);
    const victim = m.hit ? this.topOf('p' + m.to) : null;
    // kalkmadan önce hafif çöküş
    await this.crouch(e);
    let hitDone = Promise.resolve();
    if (victim) {
      hitDone = wait(dur * 0.84).then(() => {
        onHit && onHit(dest.x, dest.y);
        const opp = c === 'w' ? 'b' : 'w';
        this.smash(dest.x, dest.y, opp);
        this.shake(1);
        const bs = this.barSlot(opp, b.bar[opp]);
        return this.fly(victim, bs.x, bs.y, { dur: 820, h: 84, lift: 1.5, flips: 3, streak: this.T.danger }).then(() => {
          this.ripple(bs.x, bs.y, this.T.danger, true);
          this.sparkle(bs.x, bs.y, this.T.danger, 10);
          this.nudge(victim, 1);
          this.shake(0.45);
        });
      });
    }
    const landed = wait(dur * 0.86).then(() => {
      this.ripple(dest.x, dest.y, m.hit ? this.T.danger : m.to === 'off' ? this.T.accent : this.T.accentSoft, m.to === 'off' || m.hit);
      this.sparkle(dest.x, dest.y, m.to === 'off' ? this.T.accent : '#fff3cf', m.to === 'off' ? 12 : 9);
      // hedefteki yığın yukarıdan aşağı sarsılır
      destStack.slice().reverse().forEach((x, i) => { if (!m.hit && i < 4) setTimeout(() => this.nudge(x, i === 0 ? 1 : 0), i * 45); });
      onLand && onLand(m.to === 'off');
    });
    await this.fly(e, dest.x, dest.y, { dur, h, end: m.to === 'off' ? 'slab' : 'land', streak: m.to === 'off' ? this.T.accent : this.T.accentSoft });
    await landed;
    await hitDone;
  }

  // Geri alınan hamle: pul geldiği yere döner, kırılan pul yerine oturur
  async animateUndo(m, c, before, { onLand } = {}) {
    let e;
    if (m.to === 'off') {
      // tepsideki son pul kalkıp geri döner
      e = this.pool[c].find((x) => x.style.display === 'none');
      if (!e || !before.off[c]) return;
      const s = this.offSlot(c, before.off[c] - 1);
      this.drawOff({ ...before.off, [c]: before.off[c] - 1 });
      e.style.display = '';
      e.style.transform = `translate(${F(s.x)}px, ${F(s.y)}px) scale(1, 0.32)`;
      e._x = s.x; e._y = s.y;
    } else e = this.topOf('p' + m.to);
    if (!e) return;
    let dest;
    if (m.from === 'bar') dest = this.barSlot(c, before.bar[c]);
    else { const cnt = Math.abs(before.p[m.from]); dest = this.slot(m.from, cnt, cnt + 1); }
    const victim = m.hit ? this.topOf('bar' + (c === 'w' ? 'b' : 'w')) : null;
    const dist = Math.hypot(dest.x - e._x, dest.y - e._y);
    const jobs = [this.fly(e, dest.x, dest.y, { dur: Math.round(Math.min(640, 340 + dist * 0.7)), h: Math.min(50, 12 + dist * 0.2), lift: 1.16, trail: false, start: m.to === 'off' ? 'slab' : 'flat' })];
    if (victim) {
      const s0 = this.slot(m.to, 0, 1);
      jobs.push(this.fly(victim, s0.x, s0.y, { dur: 600, h: 48, lift: 1.22, trail: false, flips: 1 }));
    }
    await Promise.all(jobs);
    this.ripple(dest.x, dest.y, this.T.accentSoft);
    onLand && onLand();
  }

  // Yeni el: pullar tahtanın ortasından savrularak yerlerine konar
  async dealIn(onTick) {
    if (!this.T || reducedMotion()) return;
    const cx = (this.g.barX0 + this.g.barX1) / 2, cy = this.g.midY;
    const els = [], tops = new Set();
    for (let a = 1; a <= 24; a++) {
      const st = this.stacks['p' + a];
      if (st && st.length) { els.push(...st); tops.add(st[st.length - 1]); }
    }
    for (const e of els) e.classList.remove('sel');
    const jobs = els.map((e, i) => {
      const kf = this.arcFrames(cx, cy, e._x, e._y, { h: 46, lift: 1.3, bend: 'cw' });
      kf.forEach((k) => { k.opacity = Math.min(1, k.offset / 0.14); });
      kf[0].transform = `translate(${F(cx)}px, ${F(cy)}px) scale(0.3, 0.3)`;
      const delay = i * 20;
      if (onTick && i % 4 === 0) setTimeout(onTick, delay + 440);
      const drop = tops.has(e) ? setTimeout(() => this.ripple(e._x, e._y, this.T.accentSoft), delay + 440) : 0;
      return e.animate(kf, { duration: 520, delay, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'backwards' }).finished.catch(() => clearTimeout(drop));
    });
    await Promise.all(jobs);
  }

  // vuruş efekti
  burst(x, y, color) {
    const g = el('g', { class: 'burst', transform: `translate(${F(x)} ${F(y)})` });
    let h = `<circle r="20" fill="none" stroke="${color}" stroke-width="3"></circle><circle r="28" fill="none" stroke="${color}" stroke-width="1.6" stroke-opacity="0.55"></circle><circle r="36" fill="none" stroke="#ffd27a" stroke-width="1" stroke-opacity="0.4"></circle>`;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.25;
      const d0 = 18, d1 = 32 + Math.random() * 14;
      h += `<line x1="${F(Math.cos(a) * d0)}" y1="${F(Math.sin(a) * d0)}" x2="${F(Math.cos(a) * d1)}" y2="${F(Math.sin(a) * d1)}" stroke="${i % 3 ? '#ffd27a' : color}" stroke-width="${F(1.4 + Math.random() * 1.2)}" stroke-linecap="round"></line>`;
    }
    g.innerHTML = `<g class="burst-in">${h}</g>`;
    this.lFx.appendChild(g);
    setTimeout(() => g.remove(), 800);
  }
}
