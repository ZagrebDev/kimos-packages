/**
 * custom.js es quien inyecta los otros assets. Jumpseller lo sirve minificado
 * y con su propio timestamp (`custom.min.js?1784967522`), y durante un tiempo
 * ese timestamp se le pegaba a los demás archivos: sus URLs no cambiaban nunca
 * y el navegador seguía devolviendo la versión anterior por mucho que se
 * volvieran a subir. Aquí se comprueba que ya no ocurre.
 */
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const THEME = path.join(AQUI, '..');
const VIEJO = '?1784967522';   // el timestamp con el que llega custom.js

const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/p.html') {
    r.writeHead(200, { 'Content-Type': 'text/html' });
    return r.end('<section class="product-page"><div class="product-page__wrapper"></div></section>'
      + '<script>window.jQuery=function(){};</script>'
      + '<script src="/assets/custom.min.js' + VIEJO + '"></script>');
  }
  const f = path.join(THEME, u.replace(/^\/assets\//, '').replace(/\.min\./, '.'));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('x'); }
  r.writeHead(200, { 'Content-Type': u.endsWith('.css') ? 'text/css' : 'text/javascript' });
  fs.createReadStream(f).pipe(r);
});
await new Promise(x => srv.listen(8807, x));

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage();
const pedidas = [];
p.on('request', (req) => { if (/kimos-/.test(req.url())) pedidas.push(req.url()); });
await p.goto('http://localhost:8807/p.html');
await p.waitForTimeout(800);
await b.close(); srv.close();

const fallos = [];
const ok = (n, c, d) => { console.log((c ? '✔ ' : '✘ ') + n + (d ? ' · ' + d : '')); if (!c) fallos.push(n); };

console.log('URLs inyectadas:'); pedidas.forEach(u => console.log('   ' + u));
ok('se inyectaron los assets de la ficha', pedidas.length >= 2, pedidas.length + ' peticiones');
ok('NINGUNA hereda el timestamp de custom.js (era lo que congelaba el caché)',
  pedidas.every(u => u.indexOf(VIEJO.slice(1)) === -1));
ok('todas llevan la marca propia ?kv=', pedidas.length > 0 && pedidas.every(u => /[?&]kv=/.test(u)));

if (fallos.length) process.exit(1);
console.log('\nCarga de assets OK ✔ — subir un archivo nuevo ya se ve');
