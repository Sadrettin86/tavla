// 3B zarlar (CSS). Tahtanın üstündeki katmanda durur.
const PIPS = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [28, 50], [28, 76], [72, 24], [72, 50], [72, 76]],
};
const OPP = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };
const SIDES = { 1: [2, 3], 2: [3, 1], 3: [1, 2], 4: [5, 1], 5: [1, 3], 6: [2, 4] };
const FINAL = [[-16, -22, -9], [-14, -27, 11]];

function face(v, tf) {
  const pips = PIPS[v].map(([x, y]) => `<span class="pip" style="left:${x}%;top:${y}%"></span>`).join('');
  return `<span class="face" style="transform:${tf}">${pips}</span>`;
}

function cubeHTML(v, s) {
  const h = (s / 2).toFixed(1);
  const [top, right] = SIDES[v];
  return [
    face(v, `translateZ(${h}px)`),
    face(OPP[v], `rotateY(180deg) translateZ(${h}px)`),
    face(right, `rotateY(90deg) translateZ(${h}px)`),
    face(OPP[right], `rotateY(-90deg) translateZ(${h}px)`),
    face(top, `rotateX(90deg) translateZ(${h}px)`),
    face(OPP[top], `rotateX(-90deg) translateZ(${h}px)`),
  ].join('');
}

const rot = (r) => `rotateX(${r[0]}deg) rotateY(${r[1]}deg) rotateZ(${r[2]}deg)`;

export class DiceView {
  constructor(layer, board) {
    this.layer = layer;
    this.board = board;
    this.last = null;
    this.skin = 'kemik';
  }

  setSkin(k) { this.skin = k; this.layer.dataset.skin = k; }

  clear() { this.layer.innerHTML = ''; this.last = null; }

  // dice: [{v, x, y, used, label}] tahta koordinatlarıyla
  layout(list) {
    const out = [];
    for (const d of list) {
      const p = this.board.toPx(d.x, d.y);
      out.push({ ...d, px: p.x, py: p.y, s: Math.max(18, 30 * p.u * (d.scale || 1)) });
    }
    return out;
  }

  build(list, extra = '') {
    this.layer.innerHTML = '';
    const nodes = [];
    for (const [i, d] of list.entries()) {
      const w = document.createElement('div');
      w.className = 'die-wrap' + (d.used ? ' used' : '');
      w.style.cssText = `left:${d.px - d.s / 2}px;top:${d.py - d.s / 2}px;width:${d.s}px;height:${d.s}px;perspective:${d.s * 9}px`;
      w.innerHTML = `<span class="die-shadow"></span><span class="die" style="width:${d.s}px;height:${d.s}px;transform:${rot(FINAL[i % 2])}">${cubeHTML(d.v, d.s)}</span>` +
        (d.label ? `<span class="die-label">${d.label}</span>` : '');
      this.layer.appendChild(w);
      nodes.push(w);
    }
    if (extra) this.layer.insertAdjacentHTML('beforeend', extra);
    return nodes;
  }

  // values: zar değerleri; side: 'right' | 'left'; used: hangi zar kullanıldı; left: çiftte kalan hamle
  spec(values, { side = 'right', used = [], left = null } = {}) {
    const c = side === 'right' ? this.board.right : this.board.left;
    const list = values.map((v, i) => ({ v, x: c.x + (i === 0 ? -21 : 21), y: c.y + (i === 0 ? -1 : 2), used: !!used[i] }));
    let extra = '';
    if (left != null) {
      const p = this.board.toPx(c.x, c.y + 26);
      extra = `<div class="dbl-left" style="left:${p.x}px;top:${p.y}px">${[0, 1, 2, 3].map((k) => `<i class="${k < left ? 'on' : ''}"></i>`).join('')}</div>`;
    }
    return { list, extra };
  }

  show(values, opts = {}) {
    const { list, extra } = this.spec(values, opts);
    this.last = { values, opts };
    this.build(this.layout(list), extra);
  }

  async roll(values, opts = {}) {
    const { list, extra } = this.spec(values, opts);
    this.last = { values, opts };
    const nodes = this.build(this.layout(list), extra);
    const fromRight = (opts.side || 'right') === 'right';
    const anims = nodes.map((w, i) => {
      const s = parseFloat(w.style.width);
      const dx = (fromRight ? 1 : -1) * s * (3.2 + i * 0.6);
      const dy = -s * (1.4 + i * 0.5);
      const cube = w.querySelector('.die');
      const r0 = [360 + Math.random() * 540, 360 + Math.random() * 540, Math.random() * 360];
      cube.animate([{ transform: rot(r0) }, { transform: rot(FINAL[i % 2]) }], { duration: 760 + i * 60, easing: 'cubic-bezier(.12,.72,.24,1)' });
      return w.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.15}px)`, opacity: 1, offset: 0.4 },
        { transform: 'translate(0px, 0px)', offset: 0.72 },
        { transform: `translate(0px, ${-s * 0.18}px)`, offset: 0.84 },
        { transform: 'translate(0px, 0px)' },
      ], { duration: 760 + i * 60, easing: 'cubic-bezier(.2,.6,.35,1)' }).finished;
    });
    await Promise.all(anims);
  }

  // açılış zarları: izleyicinin zarı sağda, rakibinki solda
  showOpening(mine, theirs, labels, { animateMine = false, animateTheirs = false } = {}) {
    const R = this.board.right, L = this.board.left;
    const list = [];
    if (theirs) list.push({ v: theirs, x: L.x, y: L.y, label: labels[1], anim: animateTheirs, side: 'left' });
    if (mine) list.push({ v: mine, x: R.x, y: R.y, label: labels[0], anim: animateMine, side: 'right' });
    const laid = this.layout(list);
    const nodes = this.build(laid);
    return Promise.all(nodes.map((w, i) => {
      if (!list[i].anim) return null;
      const s = parseFloat(w.style.width);
      const dir = list[i].side === 'right' ? 1 : -1;
      w.querySelector('.die').animate([{ transform: rot([500, 400, 90]) }, { transform: rot(FINAL[i % 2]) }], { duration: 760, easing: 'cubic-bezier(.12,.72,.24,1)' });
      return w.animate([{ transform: `translate(${dir * s * 3}px, ${-s * 1.5}px)`, opacity: 0 }, { transform: 'translate(0,0)', opacity: 1 }], { duration: 760, easing: 'cubic-bezier(.2,.6,.35,1)' }).finished;
    }));
  }

  relayout() {
    if (!this.last) return;
    this.show(this.last.values, this.last.opts);
  }
}
