// Tavla kural motoru. DOM'a dokunmaz; oyun durumu düz JSON nesnesidir,
// böylece Firebase'e olduğu gibi yazılıp okunabilir.
//
// Tahta: p[1..24]; artı değer beyaz, eksi değer siyah pul sayısı.
// Beyaz 24'ten 1'e, siyah 1'den 24'e oynar. Beyazın evi 1-6, siyahın evi 19-24.

export const other = (c) => (c === 'w' ? 'b' : 'w');

// Türk usulü: açılışta büyük atan zarı yeniden atar, yeni eli kazanan başlar, mars 2 sayı.
// Katı kurallar kapalı: vur-kaç yasağı (noHitRun) ve toplarken içeride oynama yasağı (noWaste) yok.
export const RULESETS = {
  tr: { key: 'tr', name: 'Türk tavlası', openingReroll: true, winnerStarts: true, noHitRun: false, noWaste: false },
  free: { key: 'free', name: 'Serbest', openingReroll: false, winnerStarts: false, noHitRun: false, noWaste: false },
};

export function initialBoard() {
  const p = new Array(25).fill(0);
  p[24] = 2; p[13] = 5; p[8] = 3; p[6] = 5;
  p[1] = -2; p[12] = -5; p[17] = -3; p[19] = -5;
  return { p, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 } };
}

export const cloneBoard = (b) => ({ p: b.p.slice(), bar: { w: b.bar.w, b: b.bar.b }, off: { w: b.off.w, b: b.off.b } });
const absP = (c, rel) => (c === 'w' ? rel : 25 - rel);
export const count = (b, c, a) => (c === 'w' ? Math.max(0, b.p[a]) : Math.max(0, -b.p[a]));
const oppCount = (b, c, a) => count(b, other(c), a);
export const isHome = (c, a) => (c === 'w' ? a >= 1 && a <= 6 : a >= 19 && a <= 24);

export function allHome(b, c) {
  if (b.bar[c] > 0) return false;
  for (let a = 1; a <= 24; a++) if (count(b, c, a) > 0 && !isHome(c, a)) return false;
  return true;
}

export function pipCount(b, c) {
  let s = b.bar[c] * 25;
  for (let a = 1; a <= 24; a++) {
    const n = count(b, c, a);
    if (n) s += n * (c === 'w' ? a : 25 - a);
  }
  return s;
}

// Tek bir zar değeri için yapılabilecek hamleler.
export function movesForDie(b, c, d, rules, locked) {
  const out = [];
  if (b.bar[c] > 0) {
    const a = absP(c, 25 - d);
    const oc = oppCount(b, c, a);
    if (oc < 2) out.push({ from: 'bar', to: a, die: d, hit: oc === 1 });
    return out;
  }
  const bearing = allHome(b, c);
  const normal = [];
  const bearOff = [];
  for (let r = 24; r >= 1; r--) {
    const a = absP(c, r);
    if (count(b, c, a) === 0) continue;
    if (locked && locked.includes(a)) continue;
    const t = r - d;
    if (t >= 1) {
      const ta = absP(c, t);
      const oc = oppCount(b, c, ta);
      if (oc < 2) normal.push({ from: a, to: ta, die: d, hit: oc === 1 });
    } else if (bearing) {
      if (t === 0) bearOff.push({ from: a, to: 'off', die: d, hit: false });
      else {
        let higher = false;
        for (let rr = r + 1; rr <= 6; rr++) if (count(b, c, absP(c, rr)) > 0) { higher = true; break; }
        if (!higher) bearOff.push({ from: a, to: 'off', die: d, hit: false });
      }
    }
  }
  // Katı kural (açıksa): toplanabilecek pul varken o zarla içeride oynanmaz
  if (rules && rules.noWaste && bearOff.length) return bearOff;
  return normal.concat(bearOff);
}

export function applyMove(b, c, m) {
  const nb = cloneBoard(b);
  const s = c === 'w' ? 1 : -1;
  if (m.from === 'bar') nb.bar[c]--;
  else nb.p[m.from] -= s;
  if (m.to === 'off') nb.off[c]++;
  else {
    if (oppCount(nb, c, m.to) === 1) { nb.p[m.to] = 0; nb.bar[other(c)]++; }
    nb.p[m.to] += s;
  }
  return nb;
}

// applyMove'un tersi (geri alma animasyonu için)
export function unapplyMove(b, c, m) {
  const nb = cloneBoard(b);
  const s = c === 'w' ? 1 : -1;
  if (m.to === 'off') nb.off[c]--;
  else {
    nb.p[m.to] -= s;
    if (m.hit) { nb.p[m.to] = -s; nb.bar[other(c)]--; }
  }
  if (m.from === 'bar') nb.bar[c]++;
  else nb.p[m.from] += s;
  return nb;
}

// Katı kural (açıksa): kendi evinde vurduğun pul o tur kaçamaz (vur-kaç yasağı)
function nextLocked(c, m, rules, locked) {
  if (!rules || !rules.noHitRun || !m.hit || m.to === 'off' || !isHome(c, m.to)) return locked;
  return (locked || []).concat([m.to]);
}

const boardKey = (b) => b.p.join(',') + '|' + b.bar.w + ',' + b.bar.b + '|' + b.off.w + ',' + b.off.b;
const without = (arr, i) => arr.slice(0, i).concat(arr.slice(i + 1));

function maxLen(b, c, rem, rules, locked, memo) {
  if (!rem.length) return 0;
  const k = boardKey(b) + '#' + rem.slice().sort().join('') + '#' + (locked ? locked.slice().sort().join('.') : '');
  const hit = memo.get(k);
  if (hit !== undefined) return hit;
  let best = 0;
  const tried = new Set();
  outer: for (let i = 0; i < rem.length; i++) {
    const d = rem[i];
    if (tried.has(d)) continue;
    tried.add(d);
    for (const m of movesForDie(b, c, d, rules, locked)) {
      const v = 1 + maxLen(applyMove(b, c, m), c, without(rem, i), rules, nextLocked(c, m, rules, locked), memo);
      if (v > best) best = v;
      if (best === rem.length) break outer;
    }
  }
  memo.set(k, best);
  return best;
}

// Şu anki durumda oynanabilecek tek adımlık hamleler (tüm zarları kullanma ve büyük zar kuralı dahil)
export function legalMoves(b, c, rem, rules, locked) {
  if (!rem || !rem.length) return [];
  const memo = new Map();
  const L = maxLen(b, c, rem, rules, locked, memo);
  if (L === 0) return [];
  let res = [];
  const tried = new Set();
  for (let i = 0; i < rem.length; i++) {
    const d = rem[i];
    if (tried.has(d)) continue;
    tried.add(d);
    for (const m of movesForDie(b, c, d, rules, locked)) {
      const v = 1 + maxLen(applyMove(b, c, m), c, without(rem, i), rules, nextLocked(c, m, rules, locked), memo);
      if (v === L) res.push(m);
    }
  }
  if (L === 1 && rem.length === 2 && rem[0] !== rem[1]) {
    const big = Math.max(rem[0], rem[1]);
    if (res.some((m) => m.die === big)) res = res.filter((m) => m.die === big);
  }
  return res;
}

// Bir pulun tek dokunuşla gidebileceği yerler (iki zarı tek pulla oynama dahil)
export function destinations(b, c, rem, rules, locked, from) {
  const out = new Map(); // hedef -> hamle zinciri
  function walk(board, r, lk, pos, chain) {
    if (chain.length >= 4) return;
    for (const m of legalMoves(board, c, r, rules, lk)) {
      if (m.from !== pos) continue;
      const key = m.to;
      const next = chain.concat([m]);
      if (!out.has(key) || out.get(key).length > next.length) out.set(key, next);
      if (m.to !== 'off') {
        const i = r.indexOf(m.die);
        walk(applyMove(board, c, m), without(r, i), nextLocked(c, m, rules, lk), m.to, next);
      }
    }
  }
  walk(b, rem, locked, from, []);
  return out;
}

// ------------------------------------------------------------------ oyun durumu
export function newGameState({ to = 5, rules = 'tr', theme = 'ceviz' } = {}) {
  return {
    v: 1,
    seq: 0,
    rules,
    theme,
    match: { to, score: { w: 0, b: 0 }, game: 1, lastWinner: null },
    players: { w: null, b: null },
    board: initialBoard(),
    phase: 'opening', // opening | roll | move | gameover | matchover
    turn: null,
    opening: { w: 0, b: 0 },
    dice: null,
    rem: [],
    moves: [],
    start: null,
    locked: [],
    last: null,
    result: null,
    stats: { doubles: { w: 0, b: 0 }, hits: { w: 0, b: 0 }, mars: { w: 0, b: 0 } },
    log: [],
  };
}

const R = (G) => RULESETS[G.rules] || RULESETS.tr;

function stamp(G, action) {
  G.seq += 1;
  action.seq = G.seq;
  G.log = (G.log || []).concat([action]).slice(-12);
  return G;
}

const copy = (G) => JSON.parse(JSON.stringify(G));

export function rollOpening(G0, c, die) {
  if (G0.phase !== 'opening' || G0.opening[c]) return null;
  const G = copy(G0);
  G.opening[c] = die;
  stamp(G, { t: 'open', by: c, die });
  const { w, b } = G.opening;
  if (w && b) {
    if (w === b) {
      stamp(G, { t: 'openTie', w, b });
      G.opening = { w: 0, b: 0 };
    } else {
      const starter = w > b ? 'w' : 'b';
      G.turn = starter;
      stamp(G, { t: 'openWin', by: starter, w, b });
      if (R(G).openingReroll) {
        G.phase = 'roll';
      } else {
        startTurn(G, starter, [w, b]);
        stamp(G, { t: 'roll', by: starter, dice: G.dice.slice(), opening: true });
      }
    }
  }
  return G;
}

function startTurn(G, c, dice) {
  G.opening = { w: 0, b: 0 };
  G.turn = c;
  G.dice = dice.slice();
  G.rem = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice.slice();
  G.moves = [];
  G.locked = [];
  G.start = cloneBoard(G.board);
  G.phase = 'move';
  if (dice[0] === dice[1]) G.stats.doubles[c] += 1;
}

export function roll(G0, c, d1, d2) {
  if (G0.phase !== 'roll' || G0.turn !== c) return null;
  const G = copy(G0);
  startTurn(G, c, [d1, d2]);
  stamp(G, { t: 'roll', by: c, dice: [d1, d2] });
  return G;
}

export function currentLegal(G) {
  if (G.phase !== 'move') return [];
  return legalMoves(G.board, G.turn, G.rem, R(G), G.locked);
}

export function canEndTurn(G) {
  return G.phase === 'move' && currentLegal(G).length === 0;
}

const sameMove = (a, b) => a.from === b.from && a.to === b.to && a.die === b.die;

export function move(G0, c, m) {
  if (G0.phase !== 'move' || G0.turn !== c) return null;
  const legal = currentLegal(G0).find((x) => sameMove(x, m));
  if (!legal) return null;
  const G = copy(G0);
  G.board = applyMove(G.board, c, legal);
  G.rem.splice(G.rem.indexOf(legal.die), 1);
  G.moves.push(legal);
  G.locked = nextLocked(c, legal, R(G), G.locked) || [];
  if (legal.hit) G.stats.hits[c] += 1;
  stamp(G, { t: 'move', by: c, m: legal });
  if (G.board.off[c] === 15) finishGame(G, c);
  return G;
}

export function undo(G0, c) {
  if (G0.phase !== 'move' || G0.turn !== c || !G0.moves.length) return null;
  const G = copy(G0);
  const last = G.moves.pop();
  let b = cloneBoard(G.start);
  let lk = [];
  for (const m of G.moves) { b = applyMove(b, c, m); lk = nextLocked(c, m, R(G), lk) || []; }
  G.board = b;
  G.locked = lk;
  G.rem.push(last.die);
  G.rem.sort((x, y) => y - x);
  if (last.hit) G.stats.hits[c] -= 1;
  stamp(G, { t: 'undo', by: c, m: last });
  return G;
}

export function endTurn(G0, c) {
  if (G0.phase !== 'move' || G0.turn !== c || !canEndTurn(G0)) return null;
  const G = copy(G0);
  G.last = { by: c, dice: G.dice.slice(), moves: G.moves.slice() };
  G.turn = other(c);
  G.phase = 'roll';
  G.dice = null; G.rem = []; G.moves = []; G.start = null; G.locked = [];
  stamp(G, { t: 'end', by: c, pass: G.last.moves.length === 0 });
  return G;
}

function finishGame(G, winner) {
  const loser = other(winner);
  const mars = G.board.off[loser] === 0;
  const points = mars ? 2 : 1;
  G.match.score[winner] += points;
  if (mars) G.stats.mars[winner] += 1;
  G.match.lastWinner = winner;
  G.result = { winner, mars, points };
  G.phase = G.match.score[winner] >= G.match.to ? 'matchover' : 'gameover';
  G.rem = [];
  stamp(G, { t: 'gameover', by: winner, mars, points, match: G.phase === 'matchover' });
}

export function resign(G0, c) {
  if (G0.phase !== 'move' && G0.phase !== 'roll') return null;
  const G = copy(G0);
  const winner = other(c);
  const points = 1;
  G.match.score[winner] += points;
  G.match.lastWinner = winner;
  G.result = { winner, mars: false, points, resigned: c };
  G.phase = G.match.score[winner] >= G.match.to ? 'matchover' : 'gameover';
  stamp(G, { t: 'gameover', by: winner, mars: false, points, resigned: c, match: G.phase === 'matchover' });
  return G;
}

export function nextGame(G0) {
  if (G0.phase !== 'gameover') return null;
  const G = copy(G0);
  G.board = initialBoard();
  G.match.game += 1;
  G.result = null; G.dice = null; G.rem = []; G.moves = []; G.start = null; G.locked = []; G.last = null;
  G.opening = { w: 0, b: 0 };
  if (R(G).winnerStarts && G.match.lastWinner) {
    G.turn = G.match.lastWinner;
    G.phase = 'roll';
  } else {
    G.turn = null;
    G.phase = 'opening';
  }
  stamp(G, { t: 'newgame', game: G.match.game });
  return G;
}

export function rematch(G0) {
  if (G0.phase !== 'matchover') return null;
  const G = copy(G0);
  const players = G.players;
  const fresh = newGameState({ to: G.match.to, rules: G.rules, theme: G.theme });
  fresh.players = players;
  fresh.seq = G.seq;
  fresh.log = G.log;
  stamp(fresh, { t: 'rematch' });
  return fresh;
}

export function sit(G0, c, player) {
  if (G0.players[c] && G0.players[c].id !== player.id) return null;
  const G = copy(G0);
  G.players[c] = { id: player.id, name: player.name };
  stamp(G, { t: 'sit', by: c, name: player.name });
  return G;
}

export function reseat(G0, c, player) {
  if (!G0.players[c]) return null;
  const G = copy(G0);
  G.players[c] = { id: player.id, name: player.name };
  stamp(G, { t: 'reseat', by: c, name: player.name });
  return G;
}

export function setTheme(G0, theme) {
  const G = copy(G0);
  G.theme = theme;
  stamp(G, { t: 'theme', theme });
  return G;
}

export const rollDie = () => {
  const a = new Uint32Array(1);
  // 0..5 arası eşit dağılım için reddetme örneklemesi
  for (;;) {
    crypto.getRandomValues(a);
    if (a[0] < 4294967292) return (a[0] % 6) + 1;
  }
};
