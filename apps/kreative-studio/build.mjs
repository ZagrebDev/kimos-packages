#!/usr/bin/env node
/**
 * build.mjs — genera `dist/index.js` y `dist/index.css`.
 *
 * JS: concatena los fragmentos de `src/` **y los del paquete vendorizado
 * `packages/kimos-worldskin/src/`**, ordenados por su prefijo numérico. Los
 * prefijos no son decorativos: fijan el orden y permiten que los fragmentos del
 * paquete se INTERCALEN con los de la app (17/19/21 en el dominio, 53 dentro de
 * `mount()`), sin que ninguno tenga que saber del otro.
 *
 * Los fragmentos NO son módulos independientes: comparten el mismo ámbito (los
 * que empiezan por 4x/5x viven dentro de `mount()`). El host sirve el bundle tal
 * cual, así que no hay minificado ni transpilación: lo que se escribe es lo que
 * se ejecuta.
 *
 * CSS: `style/app.css` + el decorado del paquete, sustituyendo su marcador
 * `%ROOT%` por la clase raíz de esta app para que quede enclaustrado.
 *
 *   node apps/kreative-studio/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const srcDir = path.join(here, 'src');
const pkgDir = path.join(here, '..', '..', 'packages', 'kimos-worldskin');
const outJs = path.join(here, 'dist', 'index.js');
const outCss = path.join(here, 'dist', 'index.css');

const ROOT_CLASS = '.kimos-kreative';

const listJs = (dir, origin) => fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, file: path.join(dir, f), origin }));

const fragments = listJs(srcDir, 'app')
  .concat(fs.existsSync(path.join(pkgDir, 'src')) ? listJs(path.join(pkgDir, 'src'), 'worldskin') : [])
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

if (!fragments.length) { console.error('✖ No hay fragmentos que compilar.'); process.exit(1); }

// Dos fragmentos con el mismo nombre se pisarían en el orden sin avisar.
const dupes = fragments.map((f) => f.name).filter((n, i, all) => all.indexOf(n) !== i);
if (dupes.length) { console.error('✖ Fragmentos duplicados: ' + dupes.join(', ')); process.exit(1); }

const bundle = fragments.map((f) => fs.readFileSync(f.file, 'utf8').replace(/\s+$/, '')).join('\n') + '\n';
fs.mkdirSync(path.dirname(outJs), { recursive: true });
fs.writeFileSync(outJs, bundle, 'utf8');

// ── Hoja de estilo ───────────────────────────────────────────────────────
const appCss = fs.readFileSync(path.join(here, 'style', 'app.css'), 'utf8').replace(/\s+$/, '');
const pkgCssFile = path.join(pkgDir, 'style', 'worldskin.css');
let css = appCss + '\n';
if (fs.existsSync(pkgCssFile)) {
  const skin = fs.readFileSync(pkgCssFile, 'utf8').replace(/%ROOT%/g, ROOT_CLASS).replace(/\s+$/, '');
  if (skin.includes('%ROOT%')) { console.error('✖ Quedan marcadores %ROOT% sin sustituir.'); process.exit(1); }
  css += '\n' + skin + '\n';
}
fs.writeFileSync(outCss, css, 'utf8');

const kb = (t) => (Buffer.byteLength(t, 'utf8') / 1024).toFixed(1) + ' KB';
console.log('✔ dist/index.js — ' + fragments.length + ' fragmentos, '
  + bundle.split('\n').length + ' líneas, ' + kb(bundle));
for (const f of fragments) console.log('   · ' + f.name + (f.origin === 'app' ? '' : '   ← ' + f.origin));
console.log('✔ dist/index.css — ' + css.split('\n').length + ' líneas, ' + kb(css));
