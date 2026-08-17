#!/usr/bin/env node
/**
 * build.mjs — genera dist/index.js inyectando src/data.json en src/app.js.
 *
 * El host sirve el bundle tal cual (no hay paso de compilación), así que el
 * "build" se limita a incrustar los datos del estudio y verificar que la
 * versión declarada en el código coincida con la del manifest.
 *
 *   node apps/estudio-mercado/build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(DIR, 'src/app.js'), 'utf8');
const datos = JSON.parse(readFileSync(join(DIR, 'src/data.json'), 'utf8'));
const visual = JSON.parse(readFileSync(join(DIR, 'src/visual.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));

const declarada = (app.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
if (declarada !== manifest.version) {
  console.error(`APP_VERSION (${declarada}) != manifest.version (${manifest.version}). Sube ambas.`);
  process.exit(1);
}

// JSON.stringify produce un literal válido; se escapa `</` por si el bundle
// termina embebido en un documento HTML.
const inline = (o) => JSON.stringify(o).replace(/<\//g, '<\\/');

const marcas = [
  ['const DATA = /* DATOS_INLINE */ null;', `const DATA = ${inline(datos)};`],
  ['const VIS = /* VISUAL_INLINE */ null;', `const VIS = ${inline(visual)};`],
];
let salida = app;
for (const [marca, valor] of marcas) {
  if (!salida.includes(marca)) {
    console.error(`No se encontró la marca ${marca.split('/* ')[1].split(' */')[0]} en src/app.js`);
    process.exit(1);
  }
  salida = salida.replace(marca, valor);
}
writeFileSync(join(DIR, 'dist/index.js'), salida);

console.log(
  `dist/index.js escrito · v${manifest.version} · ${(salida.length / 1024).toFixed(0)} KB · ` +
  `${datos.modulos.length} módulos, ${datos.competidores.length} planes, ${datos.demanda.paises.length} mercados, ` +
  `${visual.scores.length} dimensiones de diagnóstico`
);
