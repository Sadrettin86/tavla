// Yeni sürüm damgası basar: index.html (sürüm etiketi, CSS, ana betik, modül haritası) ve version.json.
// Böylece telefon eski dosyaları önbellekten karıştırmaz; açık uygulama yeni sürümü görünce kendini yeniler.
// Kullanım: node tools/surum.mjs   (her yayından önce)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const v = process.argv[2] || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const mods = readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js')).sort();
const map = { imports: Object.fromEntries(mods.map((m) => [`./js/${m}`, `./js/${m}?v=${v}`])) };

const file = new URL('index.html', root);
let html = readFileSync(file, 'utf8');
const swap = (re, to) => {
  if (!re.test(html)) throw new Error('index.html içinde bulunamadı: ' + re);
  html = html.replace(re, to);
};
swap(/<meta name="tavla-version" content="[^"]*">/, `<meta name="tavla-version" content="${v}">`);
swap(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">\n${JSON.stringify(map, null, 2)}\n</script>`);
swap(/href="css\/style\.css(\?v=[^"]*)?"/, `href="css/style.css?v=${v}"`);
swap(/src="js\/main\.js(\?v=[^"]*)?"/, `src="js/main.js?v=${v}"`);
writeFileSync(file, html);
writeFileSync(new URL('version.json', root), JSON.stringify({ v }) + '\n');
console.log('sürüm', v);
