// Test offline del encaje con el theme: tope de barra (header sticky) y ancho
// alineado al contenedor. Simula el caso real de hubpro (header 66px).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// jsdom es solo de pruebas y NO es dependencia del kit: instálalo donde
// quieras y apunta NODE_PATH a su node_modules, o `npm i jsdom`.
const require = createRequire(import.meta.url);
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.error('Falta jsdom (solo para pruebas): npm i jsdom, o exporta NODE_PATH a un node_modules que lo tenga.');
  process.exit(1);
}

const dom = new JSDOM(`<!doctype html><html><body>
  <header class="theme-header" style="position:sticky">HEADER</header>
  <div class="container"><section id="product-template-1"><div class="product-page__wrapper">x</div></section></div>
</body></html>`, { pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
window.innerWidth = 1600; window.innerHeight = 900;
window.requestAnimationFrame = (fn) => setTimeout(fn, 0);

// jsdom no hace layout: se simulan las medidas reales de la tienda.
const header = document.querySelector('header');
header.getBoundingClientRect = () => ({ top: 0, bottom: 66, height: 66, left: 0, right: 1600, width: 1600 });
const cont = document.querySelector('.container');
Object.defineProperty(cont, 'clientWidth', { value: 1200 });

const src = readFileSync(new URL('../kimos-configurador.js', import.meta.url), 'utf8');
// Se extraen las funciones de encaje (el módulo completo requiere un theme vivo).
const cuerpo = src.slice(src.indexOf('  var LAYOUT = {'), src.indexOf('  function mount(entry, prod, contractVer) {'));
const fn = new Function('window', 'document', 'getComputedStyle', 'requestAnimationFrame', cuerpo + `
  return { medirTop: medirTop, medirContenedor: medirContenedor, encajarConTheme: encajarConTheme };`);
const api = fn(window, document, window.getComputedStyle.bind(window), window.requestAnimationFrame);

const ok = (l, got, want) => { console.log((got === want ? '✔ ' : '✕ ') + l + ': ' + got + (got === want ? '' : ' ≠ ' + want)); if (got !== want) process.exitCode = 1; };

ok('tope medido del header sticky', api.medirTop(), 66);
ok('ancho del contenedor del theme', api.medirContenedor(document.querySelector('#product-template-1')), 1200);

// Aplicado a la raíz (modo auto → container)
const root = document.createElement('div'); root.className = 'kimos-cfg';
document.body.appendChild(root);
api.encajarConTheme(root, document.querySelector('#product-template-1'), 'auto');
ok('--kc-top aplicado', root.style.getPropertyValue('--kc-top'), '66px');
ok('--kc-maxw aplicado', root.style.getPropertyValue('--kc-maxw'), '1200px');
ok('clase de contenedor', root.classList.contains('kc-w-container'), true);

// Modo full → sin centrado, pero el tope se sigue respetando
const root2 = document.createElement('div'); root2.className = 'kimos-cfg';
document.body.appendChild(root2);
api.encajarConTheme(root2, document.querySelector('#product-template-1'), 'full');
ok('full: sin clase de contenedor', root2.classList.contains('kc-w-container'), false);
ok('full: tope igual respetado', root2.style.getPropertyValue('--kc-top'), '66px');

// Header NO sticky (estático) → no tapa, tope 0
header.style.position = 'static';
ok('header estático no descuenta', api.medirTop(), 0);

// Override manual
window.KIMOS_TOP_OFFSET = 80;
const api2 = fn(window, document, window.getComputedStyle.bind(window), window.requestAnimationFrame);
ok('KIMOS_TOP_OFFSET manda', api2.medirTop(), 80);
console.log('\nEncaje con el theme OK ✔');
