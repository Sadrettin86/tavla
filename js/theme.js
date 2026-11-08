// Tahta teması, geometri ve statik tahta çizimi (tasarım taslağıyla aynı çizim kodu)

export const F = (n) => Math.round(n * 10) / 10;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(p) {
  let d = `M${F(p[0][0])} ${F(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${F(c1[0])} ${F(c1[1])} ${F(c2[0])} ${F(c2[1])} ${F(p2[0])} ${F(p2[1])}`;
  }
  return d;
}

const pts = (arr) => arr.map((p) => `${F(p[0])},${F(p[1])}`).join(' ');

// ---------------------------------------------------------------- temalar
export const THEMES = {
  ceviz: {
    key: 'ceviz', name: 'Ceviz',
    frame: { base: '#4b2b19', hi: '#73452a', lo: '#26140b', grain: '#1b0d06', grainOp: 0.6, band: '#5c361f' },
    field: { base: '#b4804d', hi: '#c99561', lo: '#93653a', grain: '#6a4123', grainOp: 0.34, band: '#a06f40' },
    tri: [
      { base: '#ecd3a2', tip: '#d7b176', line: '#9c7240' },
      { base: '#913220', tip: '#6f2213', line: '#4a1309' },
    ],
    tray: { base: '#3b2314', lo: '#1a0d06' },
    hinge: { hi: '#f6d98a', base: '#c39442', lo: '#6b4815' },
    inlay: '#ecd09a',
    w: { base: '#f3e8d4', hi: '#fffbf2', lo: '#c8b391', rim: '#9a8565', ring: '#b39d79', slab: '#e8dbc2' },
    b: { base: '#2d1a13', hi: '#5c3c2d', lo: '#110705', rim: '#080302', ring: '#4f3326', slab: '#3a2219' },
    accent: '#f4c15a', accentSoft: '#fff1c9', danger: '#ff6b3d',
    texture: 'wood', sedef: false,
  },
  sedef: {
    key: 'sedef', name: 'Sedefli',
    frame: { base: '#2b1611', hi: '#4c2a1f', lo: '#130806', grain: '#0b0403', grainOp: 0.55, band: '#3a1f17' },
    field: { base: '#5b2c1b', hi: '#723a24', lo: '#41200f', grain: '#2a1209', grainOp: 0.36, band: '#4e2516' },
    tri: [
      { base: '#f4efe6', tip: '#dfe9e5', line: '#8fa3a0', sedef: true },
      { base: '#1c110d', tip: '#120a07', line: '#e9e0d2' },
    ],
    tray: { base: '#180c08', lo: '#0b0503' },
    hinge: { hi: '#f6d98a', base: '#c39442', lo: '#6b4815' },
    inlay: '#efe6d8',
    w: { base: '#f1e6d0', hi: '#fffaf0', lo: '#c4ad87', rim: '#97805f', ring: '#b49b74', slab: '#e6d7bc', dot: true },
    b: { base: '#21140f', hi: '#4d3328', lo: '#0b0504', rim: '#050201', ring: '#3d281f', slab: '#2d1c15', dot: true },
    accent: '#ffd36b', accentSoft: '#fff3cf', danger: '#ff6b3d',
    texture: 'wood', sedef: true,
  },
  gece: {
    key: 'gece', name: 'Gece',
    frame: { base: '#1b2331', hi: '#2f3c53', lo: '#0c1018', grain: '#06090e', grainOp: 0.35, band: '#202a3b' },
    field: { base: '#142339', hi: '#1b2e4a', lo: '#0d182a', grain: '#091222', grainOp: 0.0, band: '#14233a' },
    tri: [
      { base: '#3b6c96', tip: '#2a5174', line: '#8cc4ef' },
      { base: '#6d3f74', tip: '#53305b', line: '#d1a6da' },
    ],
    tray: { base: '#0b121e', lo: '#05080e' },
    hinge: { hi: '#eef3fa', base: '#9aa7ba', lo: '#4a5466' },
    inlay: '#7fb7e6',
    w: { base: '#e7ecf3', hi: '#ffffff', lo: '#b2bdcc', rim: '#8794a7', ring: '#a5b0c0', slab: '#d9e0ea' },
    b: { base: '#161d29', hi: '#3b4860', lo: '#06080d', rim: '#5bd2ff', ring: '#2c3a52', slab: '#1d2635', rimLight: true },
    accent: '#62e2ff', accentSoft: '#d7f8ff', danger: '#ff7a59',
    texture: 'felt', sedef: false,
  },
};

// ---------------------------------------------------------------- geometri
export function geometry(W, H) {
  const frame = Math.round(H * 0.05);
  const trayW = Math.round(W * 0.073);
  const gap = Math.max(7, Math.round(frame * 0.7));
  const playW = W - 2 * frame - trayW - gap;
  const pw = playW / 13.1;
  const barW = playW - 12 * pw;
  const px0 = frame, px1 = frame + playW;
  const py0 = frame, py1 = H - frame, ph = py1 - py0;
  const r = Math.min(pw / 2 - 0.7, ph / 20);
  const triH = ph * 0.415;
  const barX0 = px0 + 6 * pw, barX1 = barX0 + barW;
  const trayX0 = px1 + gap, trayX1 = trayX0 + trayW;
  const colX = (c) => (c < 6 ? px0 + c * pw : barX1 + (c - 6) * pw);
  const col = (p) => (p <= 12 ? 12 - p : p - 13);
  const isTop = (p) => p >= 13;
  const cx = (p) => colX(col(p)) + pw / 2;
  const slot = (p, i, n = 5) => {
    const step = n > 5 ? (ph / 2 - 2 * r) / (n - 1) : 2 * r;
    const off = r + i * step;
    return { x: cx(p), y: isTop(p) ? py0 + off : py1 - off };
  };
  const midY = (py0 + py1) / 2;
  const barSlot = (c, i) => ({
    x: (barX0 + barX1) / 2,
    y: c === 'b' ? midY - r - 4 - i * 2 * r : midY + r + 4 + i * 2 * r,
  });
  return {
    W, H, frame, trayW, gap, playW, pw, barW, px0, px1, py0, py1, ph, r, triH,
    barX0, barX1, trayX0, trayX1, colX, col, isTop, cx, slot, barSlot, midY,
    right: { x: (barX1 + px1) / 2, y: midY },
    left: { x: (px0 + barX0) / 2, y: midY },
  };
}

// ---------------------------------------------------------------- ahşap
function grain(R, x, y, w, h, dir, color, op, density = 0.3, waviness = 1) {
  const L = dir === 'h' ? w : h;
  const T = dir === 'h' ? h : w;
  const n = Math.max(5, Math.round(T * density));
  const wa = [R() * 6.28, R() * 6.28, R() * 6.28];
  const wf = [0.4 + R() * 0.7, 1.2 + R() * 1.4, 2.6 + R() * 3];
  const amp = [T * 0.05 * waviness, T * 0.018 * waviness, T * 0.007 * waviness];
  const segs = Math.max(5, Math.round(L / 24));
  let out = '';
  for (let i = 0; i < n; i++) {
    const base = ((i + 0.5 + (R() - 0.5) * 0.8) / n) * T;
    const oph = R() * 6.28, of = 1 + R() * 3, oa = (0.2 + R() * 1.1) * waviness;
    const p = [];
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const off = base + amp[0] * Math.sin(u * 6.28 * wf[0] + wa[0]) + amp[1] * Math.sin(u * 6.28 * wf[1] + wa[1]) + amp[2] * Math.sin(u * 6.28 * wf[2] + wa[2]) + oa * Math.sin(u * 6.28 * of + oph);
      p.push(dir === 'h' ? [x + u * L, y + off] : [x + off, y + u * L]);
    }
    const sw = 0.35 + Math.pow(R(), 2.2) * 1.9;
    const o = op * (0.2 + R() * 0.8);
    out += `<path d="${smooth(p)}" fill="none" stroke="${color}" stroke-width="${F(sw)}" stroke-opacity="${F(o * 100) / 100}" stroke-linecap="round"></path>`;
  }
  return out;
}

function bands(R, x, y, w, h, dir, color, count = 4) {
  // geniş, yumuşak renk dalgaları (ahşaptaki ton farkı)
  let out = '';
  for (let i = 0; i < count; i++) {
    const t = R();
    const sw = (dir === 'h' ? h : w) * (0.08 + R() * 0.16);
    const p = [];
    const segs = 6;
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const off = t * (dir === 'h' ? h : w) + Math.sin(u * 5 + i) * sw * 0.4;
      p.push(dir === 'h' ? [x + u * w, y + off] : [x + off, y + u * h]);
    }
    out += `<path d="${smooth(p)}" fill="none" stroke="${color}" stroke-width="${F(sw)}" stroke-opacity="${F((0.06 + R() * 0.1) * 100) / 100}" stroke-linecap="round"></path>`;
  }
  return out;
}

// ---------------------------------------------------------------- tanımlar
function defs(T, id) {
  const o = [];
  T.tri.forEach((t, k) => {
    o.push(`<linearGradient id="${id}-t${k}u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.base}"></stop><stop offset="1" stop-color="${t.tip}"></stop></linearGradient>`);
    o.push(`<linearGradient id="${id}-t${k}d" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${t.base}"></stop><stop offset="1" stop-color="${t.tip}"></stop></linearGradient>`);
  });
  for (const c of ['w', 'b']) {
    const k = T[c];
    o.push(`<radialGradient id="${id}-${c}Body" cx="0.36" cy="0.3" r="0.78"><stop offset="0" stop-color="${k.hi}"></stop><stop offset="0.55" stop-color="${k.base}"></stop><stop offset="1" stop-color="${k.lo}"></stop></radialGradient>`);
    o.push(`<radialGradient id="${id}-${c}Dish" cx="0.66" cy="0.72" r="0.9"><stop offset="0" stop-color="${k.hi}" stop-opacity="0.9"></stop><stop offset="0.55" stop-color="${k.base}"></stop><stop offset="1" stop-color="${k.lo}"></stop></radialGradient>`);
    o.push(`<linearGradient id="${id}-${c}Slab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.hi}"></stop><stop offset="0.45" stop-color="${k.slab}"></stop><stop offset="1" stop-color="${k.lo}"></stop></linearGradient>`);
  }
  o.push(`<radialGradient id="${id}-spec" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"></stop><stop offset="1" stop-color="#ffffff" stop-opacity="0"></stop></radialGradient>`);
  o.push(`<linearGradient id="${id}-sedef" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf9f2"></stop><stop offset="0.27" stop-color="#d9efec"></stop><stop offset="0.5" stop-color="#f6e2ee"></stop><stop offset="0.74" stop-color="#dde8fb"></stop><stop offset="1" stop-color="#fcf3e3"></stop></linearGradient>`);
  o.push(`<linearGradient id="${id}-brassV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${T.hinge.lo}"></stop><stop offset="0.35" stop-color="${T.hinge.hi}"></stop><stop offset="0.6" stop-color="${T.hinge.base}"></stop><stop offset="1" stop-color="${T.hinge.lo}"></stop></linearGradient>`);
  o.push(`<linearGradient id="${id}-shT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.5"></stop><stop offset="1" stop-color="#000000" stop-opacity="0"></stop></linearGradient>`);
  o.push(`<linearGradient id="${id}-shB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.22"></stop><stop offset="1" stop-color="#000000" stop-opacity="0"></stop></linearGradient>`);
  o.push(`<linearGradient id="${id}-shL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.4"></stop><stop offset="1" stop-color="#000000" stop-opacity="0"></stop></linearGradient>`);
  o.push(`<linearGradient id="${id}-shR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.4"></stop><stop offset="1" stop-color="#000000" stop-opacity="0"></stop></linearGradient>`);
  o.push(`<filter id="${id}-sh1" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.3"></feGaussianBlur></filter>`);
  o.push(`<filter id="${id}-sh2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.8"></feGaussianBlur></filter>`);
  o.push(`<filter id="${id}-bsh" x="-15%" y="-15%" width="130%" height="140%"><feGaussianBlur stdDeviation="10"></feGaussianBlur></filter>`);
  o.push(`<filter id="${id}-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>`);
  o.push(`<filter id="${id}-texH" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.5" numOctaves="2" seed="5"></feTurbulence><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 -0.32"></feColorMatrix><feComposite in2="SourceAlpha" operator="in"></feComposite></filter>`);
  o.push(`<filter id="${id}-texV" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.5 0.012" numOctaves="2" seed="9"></feTurbulence><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 -0.32"></feColorMatrix><feComposite in2="SourceAlpha" operator="in"></feComposite></filter>`);
  o.push(`<filter id="${id}-felt" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="2"></feTurbulence><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.75 0 0 0 -0.22"></feColorMatrix><feComposite in2="SourceAlpha" operator="in"></feComposite></filter>`);
  o.push(`<marker id="${id}-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${T.accentSoft}" fill-opacity="0.75"></path></marker>`);
  return o.join('');
}

// ---------------------------------------------------------------- parçalar
export function checkerSVG(T, id, c, x, y, r, opt = {}) {
  const k = T[c];
  const lift = !!opt.lift;
  const sdx = lift ? 3.2 : 1.1, sdy = lift ? 5.5 : 2.1;
  let s = `<g${opt.opacity != null ? ` opacity="${opt.opacity}"` : ''}>`;
  s += `<circle cx="${F(x + sdx)}" cy="${F(y + sdy)}" r="${F(r * 0.97)}" fill="#000000" fill-opacity="${lift ? 0.42 : 0.5}" filter="url(#${id}-${lift ? 'sh2' : 'sh1'})"></circle>`;
  s += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r)}" fill="url(#${id}-${c}Body)"></circle>`;
  s += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r - 0.6)}" fill="none" stroke="${k.rim}" stroke-width="${k.rimLight ? 1.3 : 1.1}" stroke-opacity="${k.rimLight ? 0.75 : 0.9}"></circle>`;
  s += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r * 0.73)}" fill="url(#${id}-${c}Dish)"></circle>`;
  s += `<circle cx="${F(x + 0.45)}" cy="${F(y + 0.55)}" r="${F(r * 0.73)}" fill="none" stroke="${k.lo}" stroke-width="1.2" stroke-opacity="0.7"></circle>`;
  s += `<circle cx="${F(x - 0.35)}" cy="${F(y - 0.45)}" r="${F(r * 0.73)}" fill="none" stroke="${k.hi}" stroke-width="0.8" stroke-opacity="0.65"></circle>`;
  if (k.dot) {
    s += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r * 0.22)}" fill="url(#${id}-sedef)" stroke="${c === 'w' ? '#9b8462' : '#000000'}" stroke-width="0.5" stroke-opacity="0.6"></circle>`;
  } else {
    s += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r * 0.4)}" fill="none" stroke="${k.ring}" stroke-width="0.8" stroke-opacity="0.55"></circle>`;
  }
  s += `<ellipse cx="${F(x - r * 0.3)}" cy="${F(y - r * 0.38)}" rx="${F(r * 0.5)}" ry="${F(r * 0.28)}" fill="url(#${id}-spec)" fill-opacity="${c === 'w' ? 0.9 : 0.55}" transform="rotate(-30 ${F(x - r * 0.3)} ${F(y - r * 0.38)})"></ellipse>`;
  s += '</g>';
  return s;
}

function star8(cx, cy, R, fill, stroke, sw = 0.6) {
  const p = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? R : R * 0.62;
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return `<polygon points="${pts(p)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"></polygon>`;
}

function diamond(cx, cy, hw, hh, fill, stroke) {
  return `<polygon points="${pts([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]])}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"></polygon>`;
}

// ---------------------------------------------------------------- tahta
// pos: { pts: {24:['w',1], ...}, bar:{w,b}, off:{w,b} }
// hl:  { selected:{p,i}, targets:[{p,hit}], last:[{from,fi,to,ti}], flight:{p,i} (kırılan pul uçuşu), dim:false }
export function renderBoard({ W, H, theme, pos, hl = {}, id = 'b', seed = 11, shadow = true, title = 'Tavla tahtası', pad = null }) {
  const T = typeof theme === 'string' ? THEMES[theme] : theme;
  const g = geometry(W, H);
  const R = rng(seed);
  const s = [];
  const { frame: fr, px0, px1, py0, py1, ph, pw, r, triH, barX0, barX1, trayX0, trayX1 } = g;
  const rx = Math.round(fr * 0.85);

  // zemin gölgesi
  if (shadow) s.push(`<rect x="8" y="14" width="${W - 16}" height="${H - 10}" rx="${rx + 4}" fill="#000000" fill-opacity="0.6" filter="url(#${id}-bsh)"></rect>`);

  // ---- çerçeve (gönye kesimli dört parça)
  const clips = [];
  const frameParts = [
    { k: 'top', poly: [[0, 0], [W, 0], [W - fr, fr], [fr, fr]], dir: 'h', box: [0, 0, W, fr] },
    { k: 'bot', poly: [[0, H], [W, H], [W - fr, H - fr], [fr, H - fr]], dir: 'h', box: [0, H - fr, W, fr] },
    { k: 'lef', poly: [[0, 0], [fr, fr], [fr, H - fr], [0, H]], dir: 'v', box: [0, 0, fr, H] },
    { k: 'rig', poly: [[W, 0], [W - fr, fr], [W - fr, H - fr], [W, H]], dir: 'v', box: [W - fr, 0, fr, H] },
    { k: 'div', poly: [[px1, py0], [trayX0, py0], [trayX0, py1], [px1, py1]], dir: 'v', box: [px1, py0, trayX0 - px1, ph] },
  ];
  clips.push(`<clipPath id="${id}-outer"><rect x="0" y="0" width="${W}" height="${H}" rx="${rx}"></rect></clipPath>`);
  for (const fp of frameParts) clips.push(`<clipPath id="${id}-c${fp.k}"><polygon points="${pts(fp.poly)}"></polygon></clipPath>`);
  clips.push(`<clipPath id="${id}-cfield"><rect x="${F(px0)}" y="${F(py0)}" width="${F(px1 - px0)}" height="${F(ph)}"></rect></clipPath>`);
  clips.push(`<clipPath id="${id}-cbar"><rect x="${F(barX0)}" y="${F(py0)}" width="${F(barX1 - barX0)}" height="${F(ph)}"></rect></clipPath>`);

  s.push(`<g clip-path="url(#${id}-outer)">`);
  for (const fp of frameParts) {
    const [bx, by, bw, bh] = fp.box;
    s.push(`<g clip-path="url(#${id}-c${fp.k})">`);
    s.push(`<rect x="${F(bx)}" y="${F(by)}" width="${F(bw)}" height="${F(bh)}" fill="${T.frame.base}"></rect>`);
    if (T.texture === 'wood' || T.key === 'gece') {
      s.push(bands(R, bx, by, bw, bh, fp.dir, T.frame.band, 3));
      s.push(grain(R, bx, by, bw, bh, fp.dir, T.frame.grain, T.frame.grainOp, 0.75, T.key === 'gece' ? 0.15 : 1));
      s.push(`<rect x="${F(bx)}" y="${F(by)}" width="${F(bw)}" height="${F(bh)}" fill="#000000" opacity="${T.key === 'gece' ? 0.25 : 0.45}" filter="url(#${id}-tex${fp.dir === 'h' ? 'H' : 'V'})"></rect>`);
    }
    s.push('</g>');
  }
  // gönye ek yerleri
  for (const [a, b] of [[[0, 0], [fr, fr]], [[W, 0], [W - fr, fr]], [[0, H], [fr, H - fr]], [[W, H], [W - fr, H - fr]]]) {
    s.push(`<line x1="${F(a[0])}" y1="${F(a[1])}" x2="${F(b[0])}" y2="${F(b[1])}" stroke="${T.frame.lo}" stroke-width="0.9" stroke-opacity="0.8"></line>`);
  }
  // çerçeve ışık/gölge kenarları
  s.push(`<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="${rx - 0.5}" fill="none" stroke="${T.frame.hi}" stroke-width="1.5" stroke-opacity="0.55"></rect>`);
  s.push(`<rect x="0.3" y="0.3" width="${W - 0.6}" height="${H - 0.6}" rx="${rx}" fill="none" stroke="#000000" stroke-width="0.6" stroke-opacity="0.6"></rect>`);
  s.push(`<rect x="0" y="${H - fr * 0.45}" width="${W}" height="${F(fr * 0.45)}" fill="#000000" opacity="0.22"></rect>`);
  // çerçeve ortasında ince fileto (ceviz, gece)
  if (!T.sedef) {
    const m = fr * 0.5;
    s.push(`<rect x="${F(m)}" y="${F(m)}" width="${F(W - 2 * m)}" height="${F(H - 2 * m)}" rx="${F(rx * 0.5)}" fill="none" stroke="${T.inlay}" stroke-width="0.9" stroke-opacity="${T.key === 'gece' ? 0.35 : 0.42}"></rect>`);
    s.push(`<rect x="${F(m + 1.3)}" y="${F(m + 1.3)}" width="${F(W - 2 * m - 2.6)}" height="${F(H - 2 * m - 2.6)}" rx="${F(rx * 0.45)}" fill="none" stroke="#000000" stroke-width="0.6" stroke-opacity="0.35"></rect>`);
  }

  // sedef kakma şerit
  if (T.sedef) {
    const m = fr / 2;
    const step = fr * 1.25;
    for (let x = fr * 1.6; x < W - fr * 1.4; x += step) {
      s.push(diamond(x, m, fr * 0.3, fr * 0.19, `url(#${id}-sedef)`, '#000000'));
      s.push(diamond(x, H - m, fr * 0.3, fr * 0.19, `url(#${id}-sedef)`, '#000000'));
      s.push(`<circle cx="${F(x + step / 2)}" cy="${F(m)}" r="${F(fr * 0.07)}" fill="#efe6d8" fill-opacity="0.8"></circle>`);
      s.push(`<circle cx="${F(x + step / 2)}" cy="${F(H - m)}" r="${F(fr * 0.07)}" fill="#efe6d8" fill-opacity="0.8"></circle>`);
    }
    for (let y = fr * 1.6; y < H - fr * 1.4; y += step) {
      s.push(diamond(m, y, fr * 0.19, fr * 0.3, `url(#${id}-sedef)`, '#000000'));
      s.push(diamond(W - m, y, fr * 0.19, fr * 0.3, `url(#${id}-sedef)`, '#000000'));
    }
    for (const [cx, cy] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) s.push(star8(cx, cy, fr * 0.42, `url(#${id}-sedef)`, '#000000'));
    for (let y = py0 + 10; y < py1 - 6; y += 14) s.push(`<circle cx="${F((px1 + trayX0) / 2)}" cy="${F(y)}" r="${F(Math.min(1.6, g.gap * 0.18))}" fill="#efe6d8" fill-opacity="0.75"></circle>`);
  }
  s.push('</g>');

  // ---- oyun alanı
  s.push(`<g clip-path="url(#${id}-cfield)">`);
  s.push(`<rect x="${F(px0)}" y="${F(py0)}" width="${F(px1 - px0)}" height="${F(ph)}" fill="${T.field.base}"></rect>`);
  if (T.texture === 'wood') {
    s.push(bands(R, px0, py0, px1 - px0, ph, 'h', T.field.band, 5));
    s.push(grain(R, px0, py0, px1 - px0, ph, 'h', T.field.grain, T.field.grainOp, 0.16, 1));
    s.push(`<rect x="${F(px0)}" y="${F(py0)}" width="${F(px1 - px0)}" height="${F(ph)}" fill="#000000" opacity="0.32" filter="url(#${id}-texH)"></rect>`);
  } else {
    s.push(`<rect x="${F(px0)}" y="${F(py0)}" width="${F(px1 - px0)}" height="${F(ph)}" fill="#000000" opacity="0.55" filter="url(#${id}-felt)"></rect>`);
  }

  // haneler (üçgenler)
  for (let c = 0; c < 12; c++) {
    for (const top of [true, false]) {
      const k = (c + (top ? 0 : 1)) % 2;
      const t = T.tri[k];
      const x0 = g.colX(c) + 0.7, x1 = g.colX(c) + pw - 0.7, xm = g.colX(c) + pw / 2;
      const by = top ? py0 : py1, ty = top ? py0 + triH : py1 - triH;
      const poly = [[x0, by], [x1, by], [xm, ty]];
      s.push(`<polygon points="${pts(poly)}" fill="url(#${id}-t${k}${top ? 'u' : 'd'})"></polygon>`);
      if (t.sedef) {
        // sedef katmanları
        const cid = `${id}-tc${c}${top ? 'u' : 'd'}`;
        clips.push(`<clipPath id="${cid}"><polygon points="${pts(poly)}"></polygon></clipPath>`);
        s.push(`<g clip-path="url(#${cid})"><rect x="${F(x0)}" y="${F(Math.min(by, ty))}" width="${F(x1 - x0)}" height="${F(triH)}" fill="url(#${id}-sedef)" opacity="0.85"></rect>`);
        let lines = '';
        for (let q = 0; q < 7; q++) {
          const yy = Math.min(by, ty) + R() * triH;
          lines += `<path d="M${F(x0 - 2)} ${F(yy)} Q ${F(xm)} ${F(yy + (R() - 0.5) * 10)} ${F(x1 + 2)} ${F(yy + (R() - 0.5) * 6)}" fill="none" stroke="#8fb3b6" stroke-width="${F(0.3 + R() * 0.6)}" stroke-opacity="${F(0.25 + R() * 0.3)}"></path>`;
        }
        s.push(lines + '</g>');
      }
      s.push(`<polygon points="${pts(poly)}" fill="none" stroke="${t.line}" stroke-width="0.9" stroke-opacity="0.75" stroke-linejoin="round"></polygon>`);
      // iç kakma çizgisi
      const cxm = (x0 + x1 + xm) / 3, cym = (by + by + ty) / 3;
      const inner = poly.map(([px, py]) => [cxm + (px - cxm) * 0.72, cym + (py - cym) * 0.72]);
      s.push(`<polygon points="${pts(inner)}" fill="none" stroke="${t.line}" stroke-width="0.6" stroke-opacity="${t.sedef ? 0.5 : 0.4}" stroke-linejoin="round"></polygon>`);
      if (T.sedef && !t.sedef) s.push(`<circle cx="${F(xm)}" cy="${F(ty + (top ? -5 : 5))}" r="1.4" fill="url(#${id}-sedef)"></circle>`);
    }
  }
  // çerçeveden düşen iç gölge
  s.push(`<rect x="${F(px0)}" y="${F(py0)}" width="${F(px1 - px0)}" height="12" fill="url(#${id}-shT)"></rect>`);
  s.push(`<rect x="${F(px0)}" y="${F(py1 - 8)}" width="${F(px1 - px0)}" height="8" fill="url(#${id}-shB)"></rect>`);
  s.push(`<rect x="${F(px0)}" y="${F(py0)}" width="9" height="${F(ph)}" fill="url(#${id}-shL)"></rect>`);
  s.push(`<rect x="${F(px1 - 7)}" y="${F(py0)}" width="7" height="${F(ph)}" fill="url(#${id}-shR)" opacity="0.6"></rect>`);
  // orta çubuğun gölgesi
  s.push(`<rect x="${F(barX1)}" y="${F(py0)}" width="8" height="${F(ph)}" fill="url(#${id}-shL)" opacity="0.8"></rect>`);
  s.push(`<rect x="${F(barX0 - 6)}" y="${F(py0)}" width="6" height="${F(ph)}" fill="url(#${id}-shR)" opacity="0.55"></rect>`);
  s.push('</g>');

  // ---- orta çubuk (kırık pullar burada durur)
  s.push(`<g clip-path="url(#${id}-cbar)">`);
  s.push(`<rect x="${F(barX0)}" y="${F(py0)}" width="${F(barX1 - barX0)}" height="${F(ph)}" fill="${T.frame.base}"></rect>`);
  s.push(grain(R, barX0, py0, barX1 - barX0, ph, 'v', T.frame.grain, T.frame.grainOp, 0.35, T.key === 'gece' ? 0.15 : 1));
  s.push(`<rect x="${F(barX0)}" y="${F(py0)}" width="${F(barX1 - barX0)}" height="${F(ph)}" fill="#000000" opacity="0.4" filter="url(#${id}-texV)"></rect>`);
  s.push('</g>');
  const bm = (barX0 + barX1) / 2;
  s.push(`<line x1="${F(barX0 + 0.6)}" y1="${F(py0)}" x2="${F(barX0 + 0.6)}" y2="${F(py1)}" stroke="${T.frame.hi}" stroke-width="1.2" stroke-opacity="0.7"></line>`);
  s.push(`<line x1="${F(barX1 - 0.6)}" y1="${F(py0)}" x2="${F(barX1 - 0.6)}" y2="${F(py1)}" stroke="#000000" stroke-width="1.2" stroke-opacity="0.45"></line>`);
  // katlanma yeri: iki yarının buluştuğu ek
  s.push(`<line x1="${F(bm)}" y1="0" x2="${F(bm)}" y2="${H}" stroke="#000000" stroke-width="1.6" stroke-opacity="0.7"></line>`);
  s.push(`<line x1="${F(bm - 1.2)}" y1="0" x2="${F(bm - 1.2)}" y2="${H}" stroke="${T.frame.hi}" stroke-width="0.7" stroke-opacity="0.45"></line>`);
  s.push(`<line x1="${F(bm + 1.3)}" y1="0" x2="${F(bm + 1.3)}" y2="${H}" stroke="${T.frame.hi}" stroke-width="0.6" stroke-opacity="0.3"></line>`);
  // menteşe topuzları (çerçevenin üst ve alt kenarında)
  for (const [ky, kh] of [[-2.5, fr * 0.62], [H - fr * 0.62 + 2.5, fr * 0.62]]) {
    const kw = 6.5;
    s.push(`<rect x="${F(bm - kw / 2 + 0.6)}" y="${F(ky + 1)}" width="${kw}" height="${F(kh)}" rx="2.4" fill="#000000" fill-opacity="0.45" filter="url(#${id}-sh1)"></rect>`);
    s.push(`<rect x="${F(bm - kw / 2)}" y="${F(ky)}" width="${kw}" height="${F(kh)}" rx="2.4" fill="url(#${id}-brassV)" stroke="${T.hinge.lo}" stroke-width="0.5"></rect>`);
    s.push(`<line x1="${F(bm - kw / 2)}" y1="${F(ky + kh / 2)}" x2="${F(bm + kw / 2)}" y2="${F(ky + kh / 2)}" stroke="${T.hinge.lo}" stroke-width="0.6"></line>`);
  }
  if (T.sedef) {
    s.push(star8((barX0 + barX1) / 2, g.midY, (barX1 - barX0) * 0.33, `url(#${id}-sedef)`, '#000000', 0.6));
    s.push(diamond((barX0 + barX1) / 2, g.midY - (barX1 - barX0) * 0.62, (barX1 - barX0) * 0.12, (barX1 - barX0) * 0.2, `url(#${id}-sedef)`, '#000000'));
    s.push(diamond((barX0 + barX1) / 2, g.midY + (barX1 - barX0) * 0.62, (barX1 - barX0) * 0.12, (barX1 - barX0) * 0.2, `url(#${id}-sedef)`, '#000000'));
  }

  // ---- toplama kutusu
  s.push(`<rect x="${F(trayX0)}" y="${F(py0)}" width="${F(trayX1 - trayX0)}" height="${F(ph)}" fill="${T.tray.base}"></rect>`);
  s.push(`<rect x="${F(trayX0)}" y="${F(py0)}" width="${F(trayX1 - trayX0)}" height="${F(ph)}" fill="#ffffff" opacity="0.5" filter="url(#${id}-felt)"></rect>`);
  s.push(`<rect x="${F(trayX0)}" y="${F(py0)}" width="${F(trayX1 - trayX0)}" height="12" fill="url(#${id}-shT)"></rect>`);
  s.push(`<rect x="${F(trayX0)}" y="${F(py1 - 6)}" width="${F(trayX1 - trayX0)}" height="6" fill="url(#${id}-shB)"></rect>`);
  s.push(`<rect x="${F(trayX0)}" y="${F(py0)}" width="7" height="${F(ph)}" fill="url(#${id}-shL)"></rect>`);
  s.push(`<line x1="${F(trayX0 + 4)}" y1="${F(g.midY)}" x2="${F(trayX1 - 4)}" y2="${F(g.midY)}" stroke="#000000" stroke-width="1" stroke-opacity="0.5"></line>`);
  s.push(`<line x1="${F(trayX0 + 4)}" y1="${F(g.midY + 1)}" x2="${F(trayX1 - 4)}" y2="${F(g.midY + 1)}" stroke="${T.frame.hi}" stroke-width="0.6" stroke-opacity="0.35"></line>`);
  // kakma fileto
  if (!T.sedef) {
    s.push(`<rect x="${F(px0 - fr * 0.42)}" y="${F(py0 - fr * 0.42)}" width="${F(px1 - px0 + fr * 0.84)}" height="${F(ph + fr * 0.84)}" fill="none" stroke="${T.inlay}" stroke-width="0.7" stroke-opacity="${T.key === 'gece' ? 0.28 : 0.32}"></rect>`);
  }

  // ---- açık hedefler (pulların altında)
  const counts = {};
  for (const [p, v] of Object.entries(pos.pts || {})) counts[p] = v;
  const tgt = hl.targets || [];
  for (const tg of tgt) {
    const c = g.col(tg.p), top = g.isTop(tg.p);
    const x0 = g.colX(c) + 0.7, x1 = g.colX(c) + pw - 0.7, xm = g.colX(c) + pw / 2;
    const by = top ? py0 : py1, ty = top ? py0 + triH : py1 - triH;
    const col = tg.hit ? T.danger : T.accent;
    s.push(`<polygon points="${pts([[x0, by], [x1, by], [xm, ty]])}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.8" stroke-linejoin="round" filter="url(#${id}-glow)"></polygon>`);
    s.push(`<polygon points="${pts([[x0, by], [x1, by], [xm, ty]])}" fill="none" stroke="${T.accentSoft}" stroke-width="0.7" stroke-opacity="0.9" stroke-linejoin="round"></polygon>`);
  }

  // ---- pullar
  const sel = hl.selected;
  const flight = hl.flight;
  for (const [pk, [c, n]] of Object.entries(pos.pts || {})) {
    const p = +pk;
    for (let i = 0; i < n; i++) {
      if (sel && sel.p === p && sel.i === i) continue;
      const sl = g.slot(p, i, n);
      s.push(checkerSVG(T, id, c, sl.x, sl.y, r));
    }
  }
  // kırık pullar
  for (const c of ['b', 'w']) {
    const n = (pos.bar || {})[c] || 0;
    for (let i = 0; i < n; i++) {
      const sl = g.barSlot(c, i);
      s.push(checkerSVG(T, id, c, sl.x, sl.y, r * 0.96));
    }
  }
  // toplanan pullar
  const slabH = Math.min(9.5, (ph / 2 - 12) / 15);
  const slabW = trayX1 - trayX0 - 8;
  for (const c of ['w', 'b']) {
    const n = (pos.off || {})[c] || 0;
    for (let i = 0; i < n; i++) {
      const y = c === 'w' ? py1 - 5 - (i + 1) * slabH : py0 + 5 + i * slabH;
      s.push(`<rect x="${F(trayX0 + 4)}" y="${F(y)}" width="${F(slabW)}" height="${F(slabH - 0.8)}" rx="${F(slabH * 0.42)}" fill="url(#${id}-${c}Slab)" stroke="${T[c].rim}" stroke-width="0.5" stroke-opacity="0.8"></rect>`);
    }
  }

  // ---- hedef halkaları (inecek yer)
  for (const tg of tgt) {
    const n = counts[tg.p] ? counts[tg.p][1] : 0;
    const own = counts[tg.p] && counts[tg.p][0] === 'w';
    const idx = tg.hit ? 0 : own ? n : 0;
    const sl = g.slot(tg.p, idx, Math.max(n + 1, 1));
    if (tg.hit) {
      s.push(`<circle cx="${F(sl.x)}" cy="${F(sl.y)}" r="${F(r + 3.2)}" fill="none" stroke="${T.danger}" stroke-width="2" stroke-dasharray="4 3" filter="url(#${id}-glow)"></circle>`);
    } else {
      s.push(`<circle cx="${F(sl.x)}" cy="${F(sl.y)}" r="${F(r - 1)}" fill="${T.accent}" fill-opacity="0.16" stroke="${T.accent}" stroke-width="1.6" stroke-dasharray="3.5 3"></circle>`);
    }
  }

  // ---- son hamle izi
  for (const lm of hl.last || []) {
    const a = g.slot(lm.from, lm.fi), b = g.slot(lm.to, lm.ti);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const k = lm.bend ?? 0.22;
    const qx = (a.x + b.x) / 2 + nx * len * k, qy = (a.y + b.y) / 2 + ny * len * k;
    s.push(`<circle cx="${F(a.x)}" cy="${F(a.y)}" r="${F(r - 1.5)}" fill="none" stroke="${T.accentSoft}" stroke-width="1" stroke-dasharray="2.5 2.5" stroke-opacity="0.55"></circle>`);
    // ok, hedef pulun kenarında bitsin
    const ex = b.x - (b.x - qx) / Math.hypot(b.x - qx, b.y - qy) * (r + 2);
    const ey = b.y - (b.y - qy) / Math.hypot(b.x - qx, b.y - qy) * (r + 2);
    const sx = a.x + (qx - a.x) / Math.hypot(qx - a.x, qy - a.y) * (r - 1);
    const sy = a.y + (qy - a.y) / Math.hypot(qx - a.x, qy - a.y) * (r - 1);
    s.push(`<path d="M${F(sx)} ${F(sy)} Q${F(qx)} ${F(qy)} ${F(ex)} ${F(ey)}" fill="none" stroke="${T.accentSoft}" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round" stroke-opacity="0.8" marker-end="url(#${id}-arr)"></path>`);
  }

  // ---- uçan kırık pul (vuruş anı)
  if (flight) {
    const a = g.slot(flight.p, flight.i);
    const b = g.barSlot('b', 0);
    const qx = b.x + 4, qy = a.y + 30;
    // iz
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * qx + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * qy + t * t * b.y;
      s.push(`<circle cx="${F(x)}" cy="${F(y)}" r="${F(r * (0.25 + t * 0.6))}" fill="${T.b.base}" fill-opacity="${F((0.05 + t * 0.22) * 100) / 100}"></circle>`);
    }
    for (const t of [0.42, 0.7]) {
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * qx + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * qy + t * t * b.y;
      s.push(checkerSVG(T, id, 'b', x, y, r * 0.96, { opacity: t < 0.5 ? 0.22 : 0.42 }));
    }
  }

  // ---- seçili (kaldırılmış) pul
  if (sel) {
    const n = counts[sel.p] ? counts[sel.p][1] : 1;
    const sl = g.slot(sel.p, sel.i, n);
    const y = sl.y + (g.isTop(sel.p) ? 1.5 : -1.5);
    s.push(checkerSVG(T, id, counts[sel.p] ? counts[sel.p][0] : 'w', sl.x, y, r + 0.8, { lift: true }));
    s.push(`<circle cx="${F(sl.x)}" cy="${F(y)}" r="${F(r + 3)}" fill="none" stroke="${T.accent}" stroke-width="2.2" filter="url(#${id}-glow)"></circle>`);
  }

  const vb = pad ? `${-pad[0]} ${-pad[1]} ${W + 2 * pad[0]} ${H + 2 * pad[1]}` : `0 0 ${W} ${H}`;
  const vw = pad ? W + 2 * pad[0] : W, vh = pad ? H + 2 * pad[1] : H;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="${vb}" role="img" aria-label="${title}" style="display:block;overflow:visible"><defs>${defs(T, id)}${clips.join('')}</defs>${s.join('')}</svg>`;
  return { svg, g, T };
}

// ---------------------------------------------------------------- masa zemini (koyu ahşap) ve küçük pul simgesi
export function tableBG(W, H, seed = 3, opt = {}) {
  const R = rng(seed);
  const id = 'tb' + seed;
  const plank = opt.plank ?? 128;
  let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#170f0a"></rect>`;
  s += bands(R, 0, 0, W, H, 'h', '#24170f', 6);
  for (let y = 0; y < H; y += plank) {
    s += grain(R, 0, y, W, plank, 'h', '#070402', 0.55, 0.07, 0.8);
    if (y > 0) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#050302" stroke-width="1.6" stroke-opacity="0.9"></line><line x1="0" y1="${y + 1.5}" x2="${W}" y2="${y + 1.5}" stroke="#3a2618" stroke-width="0.7" stroke-opacity="0.5"></line>`;
  }
  const lx = opt.lightX ?? W / 2, ly = opt.lightY ?? H * 0.42;
  s += `<defs><radialGradient id="${id}-l" cx="${F(lx)}" cy="${F(ly)}" r="${F(Math.max(W, H) * 0.55)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb46a" stop-opacity="0.13"></stop><stop offset="1" stop-color="#ffb46a" stop-opacity="0"></stop></radialGradient><radialGradient id="${id}-v" cx="${F(W / 2)}" cy="${F(H / 2)}" r="${F(Math.hypot(W, H) * 0.56)}" gradientUnits="userSpaceOnUse"><stop offset="0.55" stop-color="#000000" stop-opacity="0"></stop><stop offset="1" stop-color="#000000" stop-opacity="0.6"></stop></radialGradient></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}-l)"></rect><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}-v)"></rect>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" style="position:absolute;left:0;top:0;display:block">${s}</svg>`;
}

export function checkerIcon(theme, c, size, id) {
  const T = typeof theme === 'string' ? THEMES[theme] : theme;
  const r = size / 2 - 2.5;
  const k = T[c];
  const d = `<radialGradient id="${id}-${c}Body" cx="0.36" cy="0.3" r="0.78"><stop offset="0" stop-color="${k.hi}"></stop><stop offset="0.55" stop-color="${k.base}"></stop><stop offset="1" stop-color="${k.lo}"></stop></radialGradient><radialGradient id="${id}-${c}Dish" cx="0.66" cy="0.72" r="0.9"><stop offset="0" stop-color="${k.hi}" stop-opacity="0.9"></stop><stop offset="0.55" stop-color="${k.base}"></stop><stop offset="1" stop-color="${k.lo}"></stop></radialGradient><radialGradient id="${id}-spec" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"></stop><stop offset="1" stop-color="#ffffff" stop-opacity="0"></stop></radialGradient><linearGradient id="${id}-sedef" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf9f2"></stop><stop offset="0.5" stop-color="#f6e2ee"></stop><stop offset="1" stop-color="#dde8fb"></stop></linearGradient><filter id="${id}-sh1" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1"></feGaussianBlur></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="display:block;flex:none"><defs>${d}</defs>${checkerSVG(T, id, c, size / 2 - 0.6, size / 2 - 1, r)}</svg>`;
}


// ---------------------------------------------------------------- çalışma zamanı: pul tanımları
export function checkerDefs(T, id) {
  let o = '';
  for (const c of ['w', 'b']) {
    const k = T[c];
    o += `<radialGradient id="${id}-${c}Body" cx="0.36" cy="0.3" r="0.78"><stop offset="0" stop-color="${k.hi}"></stop><stop offset="0.55" stop-color="${k.base}"></stop><stop offset="1" stop-color="${k.lo}"></stop></radialGradient>`;
    o += `<radialGradient id="${id}-${c}Dish" cx="0.66" cy="0.72" r="0.9"><stop offset="0" stop-color="${k.hi}" stop-opacity="0.9"></stop><stop offset="0.55" stop-color="${k.base}"></stop><stop offset="1" stop-color="${k.lo}"></stop></radialGradient>`;
    o += `<linearGradient id="${id}-${c}Slab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.hi}"></stop><stop offset="0.45" stop-color="${k.slab}"></stop><stop offset="1" stop-color="${k.lo}"></stop></linearGradient>`;
  }
  o += `<radialGradient id="${id}-spec" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"></stop><stop offset="1" stop-color="#ffffff" stop-opacity="0"></stop></radialGradient>`;
  o += `<radialGradient id="${id}-shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0.55" stop-color="#000000" stop-opacity="0.55"></stop><stop offset="1" stop-color="#000000" stop-opacity="0"></stop></radialGradient>`;
  o += `<linearGradient id="${id}-sedef" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf9f2"></stop><stop offset="0.27" stop-color="#d9efec"></stop><stop offset="0.5" stop-color="#f6e2ee"></stop><stop offset="0.74" stop-color="#dde8fb"></stop><stop offset="1" stop-color="#fcf3e3"></stop></linearGradient>`;
  return o;
}

// (0,0) merkezli pul; gölge filtre yerine yumuşak gradyanla (telefonda hızlı)
export function checkerMarkup(T, id, c, r) {
  const k = T[c];
  let s = `<ellipse class="sh" cx="1.4" cy="2.6" rx="${F(r * 1.18)}" ry="${F(r * 1.14)}" fill="url(#${id}-shadow)"></ellipse>`;
  s += `<circle r="${F(r)}" fill="url(#${id}-${c}Body)"></circle>`;
  s += `<circle r="${F(r - 0.6)}" fill="none" stroke="${k.rim}" stroke-width="${k.rimLight ? 1.3 : 1.1}" stroke-opacity="${k.rimLight ? 0.75 : 0.9}"></circle>`;
  s += `<circle r="${F(r * 0.73)}" fill="url(#${id}-${c}Dish)"></circle>`;
  s += `<circle cx="0.45" cy="0.55" r="${F(r * 0.73)}" fill="none" stroke="${k.lo}" stroke-width="1.2" stroke-opacity="0.7"></circle>`;
  s += `<circle cx="-0.35" cy="-0.45" r="${F(r * 0.73)}" fill="none" stroke="${k.hi}" stroke-width="0.8" stroke-opacity="0.65"></circle>`;
  if (k.dot) s += `<circle r="${F(r * 0.22)}" fill="url(#${id}-sedef)" stroke="${c === 'w' ? '#9b8462' : '#000000'}" stroke-width="0.5" stroke-opacity="0.6"></circle>`;
  else s += `<circle r="${F(r * 0.4)}" fill="none" stroke="${k.ring}" stroke-width="0.8" stroke-opacity="0.55"></circle>`;
  s += `<ellipse cx="${F(-r * 0.3)}" cy="${F(-r * 0.38)}" rx="${F(r * 0.5)}" ry="${F(r * 0.28)}" fill="url(#${id}-spec)" fill-opacity="${c === 'w' ? 0.9 : 0.55}" transform="rotate(-30 ${F(-r * 0.3)} ${F(-r * 0.38)})"></ellipse>`;
  return s;
}
