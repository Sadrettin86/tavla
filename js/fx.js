// Görsel efektler: büyük yazı, konfeti, mars damgası, baloncuk, bildirim
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

export function banner(stage, word, sub = '', { tone = 'gold' } = {}) {
  const id = 'bn' + ++uid;
  const w = stage.clientWidth;
  const size = Math.max(34, Math.min(84, w * 0.12));
  const d = document.createElement('div');
  d.className = 'fx-banner';
  const grad = tone === 'red'
    ? '<stop offset="0" stop-color="#ffd2b8"></stop><stop offset="0.45" stop-color="#ff7a45"></stop><stop offset="0.6" stop-color="#d23b14"></stop><stop offset="1" stop-color="#8f1f07"></stop>'
    : '<stop offset="0" stop-color="#fff6cf"></stop><stop offset="0.42" stop-color="#ffd45e"></stop><stop offset="0.58" stop-color="#e79a1d"></stop><stop offset="0.8" stop-color="#ffcf55"></stop><stop offset="1" stop-color="#b8700f"></stop>';
  let rays = '';
  const n = 22, R = 300;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n, wd = ((Math.PI * 2) / n) * 0.34;
    rays += `<polygon points="0,0 ${(Math.cos(a - wd) * R).toFixed(1)},${(Math.sin(a - wd) * R).toFixed(1)} ${(Math.cos(a + wd) * R).toFixed(1)},${(Math.sin(a + wd) * R).toFixed(1)}" fill="url(#${id}r)"></polygon>`;
  }
  let sparks = '';
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, dd = 110 + Math.random() * 120;
    const x = Math.cos(a) * dd, y = Math.sin(a) * dd * 0.6, r = 3 + Math.random() * 6, k = r * 0.22;
    sparks += `<path class="spark" style="animation-delay:${(Math.random() * 0.4).toFixed(2)}s" d="M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z" fill="#fff3c8"></path>`;
  }
  let txt = '';
  for (let k = 7; k >= 1; k--) txt += `<text x="0" y="${k}" text-anchor="middle" dominant-baseline="middle" font-family="Ultra, Georgia, serif" font-size="${size}" fill="#3a1906" stroke="#3a1906" stroke-width="8" stroke-linejoin="round">${word}</text>`;
  txt += `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="Ultra, Georgia, serif" font-size="${size}" fill="none" stroke="#2a1204" stroke-width="9" stroke-linejoin="round">${word}</text>`;
  txt += `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="Ultra, Georgia, serif" font-size="${size}" fill="url(#${id}g)" stroke="#fff3c4" stroke-width="0.8">${word}</text>`;
  d.innerHTML = `<svg xmlns="${NS}" viewBox="-300 -200 600 400" aria-hidden="true"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${grad}</linearGradient><radialGradient id="${id}r" cx="0" cy="0" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${tone === 'red' ? '#ff8a4c' : '#ffc85a'}" stop-opacity="0.5"></stop><stop offset="0.55" stop-color="${tone === 'red' ? '#ff8a4c' : '#ffc85a'}" stop-opacity="0.14"></stop><stop offset="1" stop-color="#ffc85a" stop-opacity="0"></stop></radialGradient></defs><g class="rays">${rays}</g>${sparks}<g class="word">${txt}</g></svg>` +
    (sub ? `<div class="fx-sub">${sub}</div>` : '');
  d.setAttribute('role', 'status');
  d.setAttribute('aria-label', word + (sub ? ', ' + sub : ''));
  stage.appendChild(d);
  setTimeout(() => d.classList.add('out'), 1500);
  setTimeout(() => d.remove(), 2000);
}

export function toast(stage, text, ms = 1800) {
  const t = document.createElement('div');
  t.className = 'fx-toast';
  t.setAttribute('role', 'status');
  t.textContent = text;
  stage.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function confetti(root, ms = 3200) {
  const cv = document.createElement('canvas');
  cv.className = 'fx-confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = root.clientWidth, H = root.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  root.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#f2bb4e', '#e2572f', '#f6ead6', '#56b8ae', '#ffd98a', '#b8452b'];
  const P = [];
  for (let i = 0; i < 170; i++) {
    P.push({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
      vx: (Math.random() - 0.5) * 1.6, vy: 1.5 + Math.random() * 2.8,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25,
      w: 5 + Math.random() * 6, h: 8 + Math.random() * 10, c: colors[i % colors.length],
      s: Math.random() < 0.2 ? 'c' : 'r', ph: Math.random() * 6.28,
    });
  }
  const t0 = performance.now();
  function frame(t) {
    const el = t - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = el > ms - 600 ? Math.max(0, (ms - el) / 600) : 1;
    for (const p of P) {
      p.x += p.vx + Math.sin((t / 400) + p.ph) * 0.6; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.s === 'c') { ctx.beginPath(); ctx.arc(0, 0, p.w * 0.4, 0, 6.28); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.r * 2)), p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      ctx.restore();
    }
    if (el < ms) requestAnimationFrame(frame); else cv.remove();
  }
  requestAnimationFrame(frame);
}

export function stamp(stage, text = 'MARS!', sub = '+2 SAYI') {
  const d = document.createElement('div');
  d.className = 'fx-stamp';
  let holes = '';
  for (let i = 0; i < 60; i++) holes += `<circle cx="${((Math.random() - 0.5) * 130).toFixed(1)}" cy="${((Math.random() - 0.5) * 130).toFixed(1)}" r="${(0.4 + Math.random() * 1.6).toFixed(1)}" fill="#000"></circle>`;
  const id = 'st' + ++uid;
  d.innerHTML = `<svg xmlns="${NS}" viewBox="-80 -80 160 160" role="img" aria-label="${text}"><defs><mask id="${id}"><rect x="-80" y="-80" width="160" height="160" fill="#fff"></rect>${holes}</mask></defs><g mask="url(#${id})"><circle r="64" fill="#2a120b" fill-opacity="0.55" stroke="#e0461f" stroke-width="5"></circle><circle r="55" fill="none" stroke="#e0461f" stroke-width="1.6"></circle><text x="0" y="10" text-anchor="middle" font-family="Ultra, Georgia, serif" font-size="24" fill="#e0461f">${text}</text><text x="0" y="34" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="10" letter-spacing="2" fill="#e0461f">${sub}</text><text x="0" y="-24" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="9" letter-spacing="2" fill="#e0461f">ÇİFTE</text></g></svg>`;
  stage.appendChild(d);
  return d;
}

export function bubble(anchor, text, { light = true } = {}) {
  const old = anchor.querySelector('.bubble');
  if (old) old.remove();
  const b = document.createElement('div');
  b.className = 'bubble' + (light ? '' : ' dark');
  b.setAttribute('role', 'status');
  b.textContent = text;
  anchor.appendChild(b);
  setTimeout(() => b.classList.add('out'), 3600);
  setTimeout(() => b.remove(), 4000);
}

export function floatIcon(anchor, html) {
  const f = document.createElement('div');
  f.className = 'float-icon';
  f.innerHTML = html;
  f.style.left = 30 + Math.random() * 40 + '%';
  anchor.appendChild(f);
  setTimeout(() => f.remove(), 1900);
}
