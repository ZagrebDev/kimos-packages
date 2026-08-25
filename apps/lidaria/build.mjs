#!/usr/bin/env node
/**
 * build.mjs — arma `dist/index.js` con el núcleo + los datos + la app.
 *
 * El host sirve el bundle tal cual (no hay compilación), así que el "build" es
 * una concatenación con dos verificaciones que evitan los dos errores que de
 * verdad ocurren: publicar con la versión desalineada, y publicar un bundle al
 * que le falta el núcleo.
 *
 *   node apps/lidaria/build.mjs
 *
 * `src/nucleo.js` y `src/payload.json` son COPIAS GENERADAS desde el repo
 * kimos-LiDARia (`node tools/build-kimos-payload.mjs`). No se editan aquí.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(DIR, 'src/app.js'), 'utf8');
const nucleo = readFileSync(join(DIR, 'src/nucleo.js'), 'utf8');
const payload = JSON.parse(readFileSync(join(DIR, 'src/payload.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));

const declarada = (app.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
if (declarada !== manifest.version) {
  console.error(`APP_VERSION (${declarada}) != manifest.version (${manifest.version}). Sube ambas.`);
  process.exit(1);
}

const MARCA = 'const DATOS = /* DATOS_INLINE */ null;';
if (!app.includes(MARCA)) {
  console.error('No se encontró la marca DATOS_INLINE en src/app.js');
  process.exit(1);
}

// Funciones del núcleo que la app usa por nombre: si el aplanado dejara de
// exponer alguna, el bundle fallaría en runtime dentro del shell y sería un
// dolor de cabeza de depurar. Mejor que falle aquí.
const NECESARIAS = ['function detectar', 'function identificar', 'function resolver', 'function diagnosticar',
  'function economiaCartera', 'function economiaModulo', 'function auditar', 'function evaluar',
  'const SUPUESTOS_BASE', 'const CAP_POR_ID'];
const faltan = NECESARIAS.filter((n) => !nucleo.includes(n));
if (faltan.length) {
  console.error('El núcleo copiado no expone: ' + faltan.join(', ') + '. Regenera src/nucleo.js desde kimos-LiDARia.');
  process.exit(1);
}

// `</` se escapa por si el bundle terminara embebido en un documento HTML.
const inline = JSON.stringify(payload).replace(/<\//g, '<\\/');

const salida = [
  '/* LiDARia ' + manifest.version + ' — bundle generado por apps/lidaria/build.mjs.',
  '   No editar a mano: se regenera desde src/app.js + src/nucleo.js + src/payload.json. */',
  '',
  nucleo,
  '',
  app.replace(MARCA, 'const DATOS = ' + inline + ';'),
].join('\n');

writeFileSync(join(DIR, 'dist/index.js'), salida);

console.log(
  'dist/index.js escrito · v' + manifest.version + ' · ' + (salida.length / 1024).toFixed(0) + ' KB · '
  + 'núcleo ' + payload.nucleo + ' · ' + payload.devices.equipos.length + ' equipos · '
  + payload.modules.modulos.length + ' módulos · ' + payload.licencias.bibliotecas.length + ' bibliotecas evaluadas',
);
