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
const base = JSON.parse(readFileSync(join(DIR, 'src/data.json'), 'utf8'));
const amp = JSON.parse(readFileSync(join(DIR, 'src/ampliacion.json'), 'utf8'));
const visual = JSON.parse(readFileSync(join(DIR, 'src/visual.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));

/**
 * src/data.json es el reflejo fiel de la planilla y lo regenera extraer-planilla.py.
 * Lo que se investigó despues vive en src/ampliacion.json y se fusiona aquí, para
 * que el extractor siga siendo reproducible y se vea de dónde salió cada fila.
 */
function fusionar(d, a) {
  const n = d.competidores.length;
  const apps = new Set(d.modulos.map((m) => m.app));
  const nums = new Set(d.modulos.map((m) => m.n));
  for (const m of a.modulos || []) {
    if (apps.has(m.app) || nums.has(m.n)) {
      console.error(`La ampliación repite el módulo ${m.n} "${m.app}", que ya está en data.json.`);
      process.exit(1);
    }
  }
  return Object.assign({}, d, {
    meta: Object.assign({}, d.meta, { ampliacion: a._meta.fecha }),
    modulos: d.modulos.concat(a.modulos || []),
    competidores: d.competidores.concat((a.competidores || []).map((c, i) => Object.assign({ row: n + i }, c))),
    evidencia: d.evidencia.concat(a.evidencia || []),
    notas: d.notas.concat(a.notas || []),
  });
}

const datos = fusionar(base, amp);

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
  `${datos.modulos.length} módulos (${amp.modulos.length} de la ampliación), ${datos.competidores.length} planes, ${datos.demanda.paises.length} mercados, ` +
  `${visual.scores.length} dimensiones de diagnóstico`
);
