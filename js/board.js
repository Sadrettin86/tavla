// Tahta görünümü: statik tahta resmi + pullar, vurgular, dokunma alanları ve animasyonlar.
import { THEMES, geometry, renderBoard, checkerDefs, checkerMarkup, F } from './theme.js';

const W = 520, H = 362, PX = 14, PY = 12;
export const VIEW_W = W + 2 * PX, VIEW_H = H + 2 * PY;
const NS = 'http://www.w3.org/2000/svg';

const el = (tag, attrs = {}, html = '') => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
};
const pts = (arr) => arr.map((p) => `${F(p[0])},${F(p[1])}`).join(' ');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class BoardView {
  constructor(wrap, { onTap }) {
    this.wrap = wrap;
    this.onTap = onTap;
    this.g = geometry(W, H);
    this.viewer = 'w';
    this.themeKey = null;
    this.svg = el('svg', { viewBox: `${-PX} ${-PY} ${VIEW_W} ${VIEW_H}`, class: 'board-svg', role: 'img', 'aria-label': 'Tavla tahtası' });
    this.defs = el('defs');
    this.bg = el('image', { x: -PX, y: -PY, width: VIEW_W, height: VIEW_H, preserveAspectRatio: 'none' });
    this.lHl = el('g', { class: 'l-hl' });
    this.lLast = el('g', { class: 'l-last' });
    this.lOff = el('g', { class: 'l-off' });
    this.lChk = el('g', { class: 'l-chk' });
    this.lSel = el('g', { class: 'l-sel' });
    this.lFx = el('g', { class: 'l-fx' });
    this.lHit = el('g', { class: 'l-hit' });
    for (const l of [this.defs, this.bg, this.lHl, this.lLast, this.lOff, this.lChk, this.lSel, this.lFx, this.lHit]) this.svg.appendChild(l);
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
    return { x: (x + PX) * u, y: (y + PY) * u, u };
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
        const g = el('g', { class: 'chk', 'data-c': c }, checkerMarkup(T, 'k', c, this.g.r));
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
    // toplanan pullar
    let off = '';
    const { trayX0, trayX1 } = this.g;
    for (const c of ['w', 'b']) {
      for (let i = 0; i < b.off[c]; i++) {
        const s = this.offSlot(c, i);
        off += `<rect x="${F(trayX0 + 4)}" y="${F(s.y - s.slabH / 2)}" width="${F(trayX1 - trayX0 - 8)}" height="${F(s.slabH - 0.8)}" rx="${F(s.slabH * 0.42)}" fill="url(#k-${c}Slab)" stroke="${this.T[c].rim}" stroke-width="0.5" stroke-opacity="0.8"></rect>`;
      }
    }
    this.lOff.innerHTML = off;
  }

  topOf(key) { const s = this.stacks[key]; return s && s.length ? s[s.length - 1] : null; }

  // ---------------------------------------------------------- vurgular
  clearMarks() { this.lHl.innerHTML = ''; this.lSel.innerHTML = ''; }

  mark({ selected = null, dests = null, movable = null, color = 'w' } = {}) {
    const T = this.T;
    const { py0, py1, triH, pw, trayX0, trayX1, r } = this.g;
    let hl = '', sel = '';
    const b = this.G.board;
    if (movable && !selected) {
      for (const a of movable) {
        let e = a === 'bar' ? this.topOf('bar' + color) : this.topOf('p' + a);
        if (e) sel += `<circle cx="${F(e._x)}" cy="${F(e._y)}" r="${F(r + 1.6)}" fill="none" stroke="${T.accent}" stroke-width="1.4" stroke-opacity="0.55" stroke-dasharray="2 3"></circle>`;
      }
    }
    if (selected != null) {
      const e = selected === 'bar' ? this.topOf('bar' + color) : this.topOf('p' + selected);
      if (e) sel += `<circle cx="${F(e._x)}" cy="${F(e._y)}" r="${F(r + 3)}" fill="none" stroke="${T.accent}" stroke-width="2.4" filter="url(#glow)"></circle>`;
    }
    if (dests) {
      for (const [to, chain] of dests) {
        const hit = chain.some((m) => m.hit);
        const col = hit ? T.danger : T.accent;
        if (to === 'off') {
          hl += `<rect x="${F(trayX0 + 1)}" y="${F(py0 + 1)}" width="${F(trayX1 - trayX0 - 2)}" height="${F(py1 - py0 - 2)}" rx="3" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="1.8" filter="url(#glow)" class="pulse"></rect>`;
          continue;
        }
        const v = this.disp(to);
        const top = v >= 13;
        const x0 = this.g.colX(this.g.col(v)) + 0.7, x1 = x0 + pw - 1.4, xm = (x0 + x1) / 2;
        const by = top ? py0 : py1, ty = top ? py0 + triH : py1 - triH;
        hl += `<polygon points="${pts([[x0, by], [x1, by], [xm, ty]])}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.8" stroke-linejoin="round" filter="url(#glow)" class="pulse"></polygon>`;
        const cnt = Math.abs(b.p[to]);
        const own = cnt && (b.p[to] > 0) === (color === 'w');
        const idx = own ? cnt : 0;
        const s = this.slot(to, idx, Math.max(idx + 1, 1));
        if (hit && chain[chain.length - 1].hit) sel += `<circle cx="${F(s.x)}" cy="${F(s.y)}" r="${F(r + 3.2)}" fill="none" stroke="${T.danger}" stroke-width="2" stroke-dasharray="4 3" filter="url(#glow)"></circle>`;
        else hl += `<circle cx="${F(s.x)}" cy="${F(s.y)}" r="${F(r - 1)}" fill="${col}" fill-opacity="0.16" stroke="${col}" stroke-width="1.6" stroke-dasharray="3.5 3"></circle>`;
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

  // m: {from, to, hit}; Gbefore: hamleden önceki durum
  async animateMove(m, c, before, { onLand, onHit } = {}) {
    const fromKey = m.from === 'bar' ? 'bar' + c : 'p' + m.from;
    const e = this.topOf(fromKey);
    if (!e) return;
    const b = before.board;
    let dest;
    if (m.to === 'off') dest = this.offSlot(c, b.off[c]);
    else {
      const cnt = Math.abs(b.p[m.to]);
      const own = cnt && (b.p[m.to] > 0) === (c === 'w');
      const idx = own ? cnt : 0;
      dest = this.slot(m.to, idx, own ? cnt + 1 : 1);
    }
    const x0 = e._x, y0 = e._y;
    const dist = Math.hypot(dest.x - x0, dest.y - y0);
    const dur = Math.min(520, 230 + dist * 0.75);
    const mx = (x0 + dest.x) / 2, my = (y0 + dest.y) / 2 - Math.min(46, 12 + dist * 0.16);
    this.lChk.appendChild(e);
    let hitDone = Promise.resolve();
    const victim = m.hit ? this.topOf('p' + m.to) : null;
    this.setPos(e, dest.x, dest.y); // son konum önce yazılır, animasyon bitince sıçrama olmaz
    const anim = e.animate([
      { transform: `translate(${F(x0)}px, ${F(y0)}px) scale(1)` },
      { transform: `translate(${F(mx)}px, ${F(my)}px) scale(1.12)`, offset: 0.5 },
      { transform: `translate(${F(dest.x)}px, ${F(dest.y)}px) scale(1)` },
    ], { duration: dur, easing: 'cubic-bezier(.33,.66,.36,1)' });
    if (victim) {
      hitDone = wait(dur * 0.82).then(() => {
        onHit && onHit(dest.x, dest.y);
        const bs = this.barSlot(c === 'w' ? 'b' : 'w', b.bar[c === 'w' ? 'b' : 'w']);
        this.lChk.appendChild(victim);
        const vx = victim._x, vy = victim._y;
        this.setPos(victim, bs.x, bs.y);
        return victim.animate([
          { transform: `translate(${F(vx)}px, ${F(vy)}px) rotate(0deg) scale(1)` },
          { transform: `translate(${F((vx + bs.x) / 2 + 6)}px, ${F(Math.min(vy, bs.y) - 30)}px) rotate(160deg) scale(1.15)`, offset: 0.45 },
          { transform: `translate(${F(bs.x)}px, ${F(bs.y)}px) rotate(360deg) scale(1)` },
        ], { duration: 520, easing: 'cubic-bezier(.3,.6,.3,1)' }).finished;
      });
    }
    await anim.finished;
    onLand && onLand(m.to === 'off');
    await hitDone;
  }

  // vuruş efekti
  burst(x, y, color) {
    const g = el('g', { class: 'burst', transform: `translate(${F(x)} ${F(y)})` });
    let h = `<circle r="20" fill="none" stroke="${color}" stroke-width="2.6"></circle><circle r="27" fill="none" stroke="${color}" stroke-width="1.4" stroke-opacity="0.5"></circle>`;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      const d0 = 19, d1 = 30 + Math.random() * 10;
      h += `<line x1="${F(Math.cos(a) * d0)}" y1="${F(Math.sin(a) * d0)}" x2="${F(Math.cos(a) * d1)}" y2="${F(Math.sin(a) * d1)}" stroke="${i % 3 ? '#ffd27a' : color}" stroke-width="${F(1.4 + Math.random() * 1.2)}" stroke-linecap="round"></line>`;
    }
    g.innerHTML = `<g class="burst-in">${h}</g>`;
    this.lFx.appendChild(g);
    setTimeout(() => g.remove(), 800);
  }
}
