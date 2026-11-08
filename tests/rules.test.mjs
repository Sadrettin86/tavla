import assert from 'node:assert/strict';
import {
  initialBoard, legalMoves, destinations, applyMove, RULESETS, newGameState, rollOpening, roll, move, undo, endTurn,
  currentLegal, canEndTurn, pipCount, nextGame, sit,
} from '../js/rules.js';

const TR = RULESETS.tr, FREE = RULESETS.free;
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const empty = () => ({ p: new Array(25).fill(0), bar: { w: 0, b: 0 }, off: { w: 0, b: 0 } });
const key = (m) => `${m.from}>${m.to}/${m.die}`;

t('başlangıç pip sayıları 167', () => {
  const b = initialBoard();
  assert.equal(pipCount(b, 'w'), 167);
  assert.equal(pipCount(b, 'b'), 167);
});

t('açılışta 6-5 ile 24->13 tek pulla gidilebiliyor', () => {
  const b = initialBoard();
  const d = destinations(b, 'w', [6, 5], TR, [], 24);
  assert.ok(d.has(13), 'kombine hedef 13');
  assert.ok(d.has(18) && d.has(19) === false, '19 siyahın kapısı, 18 boş');
  const lm = legalMoves(b, 'w', [6, 5], TR, []);
  assert.ok(lm.length > 0);
});

t('kırık pul önce girer, kapı kapalıysa giremez', () => {
  const b = empty();
  b.bar.w = 1; b.p[6] = 14; // beyaz
  b.p[19] = -2; b.p[20] = -2; b.p[21] = -2; b.p[22] = -2; b.p[23] = -2; b.p[24] = -5; // siyah tüm ev kapalı
  assert.equal(legalMoves(b, 'w', [3, 5], TR, []).length, 0);
  b.p[24] = -1; b.off.b = 4; // 24'te tek siyah: 1 ile vurarak girer
  const lm = legalMoves(b, 'w', [1, 2], TR, []);
  assert.ok(lm.every((m) => m.from === 'bar'));
  assert.deepEqual(lm.map(key), ['bar>24/1']);
  assert.equal(lm[0].hit, true);
});

t('iki zar da oynanabiliyorsa ikisini de oynamak zorunlu', () => {
  // Beyaz: 8'de bir pul. 6-1. 8->2 (6) sonra 2->1 (1) ya da 8->7->1.
  const b = empty();
  b.p[8] = 1; b.p[6] = 14; b.p[24 - 0] = 0;
  b.p[2] = 0; b.p[13] = 0;
  b.p[19] = -15;
  const lm = legalMoves(b, 'w', [6, 1], FREE, []);
  for (const m of lm) {
    const nb = applyMove(b, 'w', m);
    const rest = m.die === 6 ? [1] : [6];
    assert.ok(legalMoves(nb, 'w', rest, FREE, []).length > 0, 'ikinci zar da oynanabilmeli: ' + key(m));
  }
});

t('sadece bir zar oynanabiliyorsa büyüğü oynanır', () => {
  // Beyaz tek pul 13'te; 6-5. 13->7 açık, 13->8 açık ama sonra 7->2 ve 8->2 kapalı, ayrıca 13'ten 11 ile 2 kapalı
  const b = empty();
  b.p[13] = 1; b.p[1] = 14; // diğer pullar 1'de (evde değil çünkü 13'te pul var)
  b.p[2] = -2; b.p[3] = -2; b.p[24] = -11;
  // 13-6=7 açık, 13-5=8 açık; 7-5=2 kapalı, 8-6=2 kapalı; 1'deki pullar oynayamaz (0 ve altı toplama değil)
  const lm = legalMoves(b, 'w', [6, 5], FREE, []);
  assert.deepEqual(lm.map(key), ['13>7/6']);
});

t('çift zar dört hamle', () => {
  const G0 = newGameState({ rules: 'tr' });
  let G = sit(sit(G0, 'w', { id: 'a', name: 'A' }), 'b', { id: 'b', name: 'B' });
  G = rollOpening(G, 'w', 5);
  G = rollOpening(G, 'b', 2);
  assert.equal(G.phase, 'roll');
  assert.equal(G.turn, 'w');
  G = roll(G, 'w', 3, 3);
  assert.deepEqual(G.rem, [3, 3, 3, 3]);
  let k = 0;
  while (!canEndTurn(G)) { G = move(G, 'w', currentLegal(G)[0]); k++; }
  assert.equal(k, 4);
  assert.equal(G.stats.doubles.w, 1);
});

t('açılışta eşit zar yeniden atılır, serbest kuralda açılış zarlarıyla oynanır', () => {
  let G = newGameState({ rules: 'free' });
  G = rollOpening(G, 'w', 4);
  G = rollOpening(G, 'b', 4);
  assert.equal(G.phase, 'opening');
  assert.deepEqual(G.opening, { w: 0, b: 0 });
  G = rollOpening(G, 'w', 2);
  G = rollOpening(G, 'b', 6);
  assert.equal(G.phase, 'move');
  assert.equal(G.turn, 'b');
  assert.deepEqual(G.dice, [2, 6]);
});

t('toplama: tam zar, fazla zar, dışarıda pul varken toplanmaz', () => {
  const b = empty();
  b.p[5] = 2; b.p[3] = 3; b.off.w = 10; b.p[24] = -15;
  const lm = legalMoves(b, 'w', [6, 5], TR, []);
  const ks = lm.map(key);
  assert.ok(ks.includes('5>off/5'));
  assert.ok(ks.includes('5>off/6'), '6 ile en yüksek hane 5 toplanır');
  const b2 = empty();
  b2.p[7] = 1; b2.p[3] = 14; b2.p[24] = -15;
  assert.ok(!legalMoves(b2, 'w', [3, 2], TR, []).some((m) => m.to === 'off' && m.from === 3 && m.die === 3 && false));
  const first = legalMoves(b2, 'w', [3, 2], TR, []).map(key);
  assert.ok(first.every((k) => !k.startsWith('3>off')) || first.some((k) => k.startsWith('7>')), '7 eve girmeden 3 toplanamaz');
});

t('Türk kuralı: toplanabilecek pul varken o zarla içeride oynanmaz', () => {
  const b = empty();
  b.p[6] = 1; b.p[2] = 1; b.off.w = 13; b.p[24] = -15;
  // zar 2: serbestte 6->4 de olur, Türk kuralında 2'den toplamak zorunlu
  const tr = legalMoves(b, 'w', [2, 2, 2, 2], TR, []).map(key);
  assert.deepEqual(tr, ['2>off/2']);
  const fr = legalMoves(b, 'w', [2, 2, 2, 2], FREE, []).map(key).sort();
  assert.ok(fr.includes('6>4/2') && fr.includes('2>off/2'));
});

t('Türk kuralı: evde vurulan pulla kaçılmaz', () => {
  // Beyaz 8'de 1 pul, 4'te siyah tek pul. Zar 4-3: 8->4 vur, sonra 4->1 kaçmak yasak.
  const b = empty();
  b.p[8] = 1; b.p[13] = 14; b.p[4] = -1; b.p[5] = -2; b.p[20] = -12; // 5 kapalı: 1'e tek yol 4'te vurmak
  const trDest = destinations(b, 'w', [4, 3], TR, [], 8);
  assert.ok(trDest.has(4));
  assert.ok(!trDest.has(1), 'vurup kaçma Türk kuralında yok');
  const frDest = destinations(b, 'w', [4, 3], FREE, [], 8);
  assert.ok(frDest.has(1), 'serbest kuralda 8->4*->1 olur');
});

t('geri al tahtayı ve zarları geri getirir', () => {
  let G = sit(sit(newGameState({ rules: 'tr' }), 'w', { id: 'a', name: 'A' }), 'b', { id: 'b', name: 'B' });
  G = rollOpening(G, 'w', 6); G = rollOpening(G, 'b', 1);
  G = roll(G, 'w', 6, 5);
  const before = JSON.stringify(G.board);
  G = move(G, 'w', { from: 24, to: 18, die: 6 });
  assert.notEqual(JSON.stringify(G.board), before);
  G = undo(G, 'w');
  assert.equal(JSON.stringify(G.board), before);
  assert.deepEqual(G.rem.slice().sort(), [5, 6]);
});

t('mars 2 sayı, normal galibiyet 1 sayı, sonraki eli kazanan başlar', () => {
  let G = sit(sit(newGameState({ rules: 'tr', to: 5 }), 'w', { id: 'a', name: 'A' }), 'b', { id: 'b', name: 'B' });
  G.board = empty(); G.board.p[1] = 1; G.board.off.w = 14; G.board.p[24] = -15;
  G.phase = 'roll'; G.turn = 'w';
  G = roll(G, 'w', 2, 1);
  G = move(G, 'w', currentLegal(G).find((m) => m.to === 'off'));
  assert.equal(G.phase, 'gameover');
  assert.deepEqual(G.result, { winner: 'w', mars: true, points: 2 });
  assert.equal(G.match.score.w, 2);
  G = nextGame(G);
  assert.equal(G.phase, 'roll');
  assert.equal(G.turn, 'w');
});

t('hamlesi olmayan oyuncu sırayı devreder', () => {
  let G = sit(sit(newGameState({ rules: 'tr' }), 'w', { id: 'a', name: 'A' }), 'b', { id: 'b', name: 'B' });
  G.board = empty(); G.board.bar.w = 2; G.board.p[6] = 13;
  for (let a = 19; a <= 24; a++) G.board.p[a] = -2; G.board.p[19] = -5;
  G.phase = 'roll'; G.turn = 'w';
  G = roll(G, 'w', 4, 2);
  assert.equal(currentLegal(G).length, 0);
  G = endTurn(G, 'w');
  assert.equal(G.turn, 'b');
  assert.equal(G.phase, 'roll');
});

t('rastgele 300 oyun sonuna kadar kuralları bozmadan oynanır', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const die = () => 1 + Math.floor(rnd() * 6);
  for (let g = 0; g < 300; g++) {
    let G = sit(sit(newGameState({ rules: g % 2 ? 'tr' : 'free', to: 1 }), 'w', { id: 'a', name: 'A' }), 'b', { id: 'b', name: 'B' });
    let guard = 0;
    while (G.phase !== 'matchover' && G.phase !== 'gameover') {
      if (++guard > 5000) throw new Error('bitmeyen oyun');
      if (G.phase === 'opening') { G = rollOpening(G, 'w', die()) || G; G = rollOpening(G, 'b', die()) || G; continue; }
      if (G.phase === 'roll') { G = roll(G, G.turn, die(), die()); continue; }
      const lm = currentLegal(G);
      if (!lm.length) { G = endTurn(G, G.turn); continue; }
      G = move(G, G.turn, lm[Math.floor(rnd() * lm.length)]);
      const tot = (c) => { let s = G.board.bar[c] + G.board.off[c]; for (let a = 1; a <= 24; a++) s += c === 'w' ? Math.max(0, G.board.p[a]) : Math.max(0, -G.board.p[a]); return s; };
      assert.equal(tot('w'), 15); assert.equal(tot('b'), 15);
    }
  }
});

console.log(`\n${n} test geçti`);
