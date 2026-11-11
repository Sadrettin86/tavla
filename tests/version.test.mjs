// index.html ile version.json aynı sürümde mi, her modül sürümlü yükleniyor mu
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const v = html.match(/<meta name="tavla-version" content="([^"]+)">/)[1];
assert.equal(JSON.parse(readFileSync(new URL('version.json', root), 'utf8')).v, v, 'version.json ile index.html aynı sürümde olmalı');
const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
for (const f of readdirSync(new URL('js/', root)).filter((x) => x.endsWith('.js'))) {
  assert.equal(map.imports[`./js/${f}`], `./js/${f}?v=${v}`, `${f} modül haritasında yok (node tools/surum.mjs çalıştır)`);
}
assert.ok(html.includes(`src="js/main.js?v=${v}"`), 'ana betik sürümlü değil');
assert.ok(html.includes(`href="css/style.css?v=${v}"`), 'CSS sürümlü değil');
console.log('sürüm testi geçti:', v);
