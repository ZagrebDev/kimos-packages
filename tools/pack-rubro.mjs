#!/usr/bin/env node
/**
 * pack-rubro.mjs — empaquetador de packs de rubro de LiDARia (`.krub`).
 *
 * Hermano de `tools/pack.mjs`: mismo criterio (validar primero, comprimir
 * después, sin dependencias) aplicado a la otra cosa que un tercero puede
 * crear para KIMOS. Un `.kapp` añade una APP; un `.krub` añade CONOCIMIENTO a
 * la app LiDARia: un rubro nuevo con su tolerancia, sus módulos en orden, su
 * flujo, sus KPI, su normativa y su material de prospección.
 *
 *   node tools/pack-rubro.mjs mi-rubro.json [salida.krub]
 *
 * El `.krub` es un ZIP con `pack.json` en la raíz (+ `README.md` si existe uno
 * junto al pack, con el mismo nombre y extensión .md). Se carga desde
 * LiDARia → Rubros → "Ampliar la base de conocimiento".
 *
 * La validación no se reimplementa aquí: se importa del núcleo de LiDARia, que
 * es el mismo que corre en la app. Si divergieran, un pack podría pasar el
 * empaquetador y ser rechazado al cargarlo, que es la peor experiencia posible.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const fallar = (m) => { console.error('✖ ' + m); process.exit(1); };
const leer = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* El núcleo vive junto a la app en este repositorio y junto a esta herramienta
   dentro del Creator Pack (donde no hay repo). Se busca en los dos sitios. */
const CANDIDATOS_NUCLEO = [
  join(RAIZ, 'apps/lidaria/src/nucleo.mjs'),
  join(AQUI, 'lidaria-nucleo.mjs'),
];
const rutaNucleo = CANDIDATOS_NUCLEO.filter(existsSync)[0];
if (!rutaNucleo) fallar('No se encontró el núcleo de LiDARia (apps/lidaria/src/nucleo.mjs o tools/lidaria-nucleo.mjs).');
const { validarPack, cargarPacks, RUBRO_PACK_API } = await import(pathToFileURL(rutaNucleo).href);

/* Los catálogos contra los que se valida: módulos y equipos de LiDARia. */
const CANDIDATOS_PAYLOAD = [
  join(RAIZ, 'apps/lidaria/src/payload.json'),
  join(AQUI, 'lidaria-payload.json'),
];
const rutaPayload = CANDIDATOS_PAYLOAD.filter(existsSync)[0];
if (!rutaPayload) fallar('No se encontró el catálogo de LiDARia (apps/lidaria/src/payload.json).');
const payload = leer(rutaPayload);
const catalogos = {
  modulos: payload.modules.modulos.map((m) => m.id),
  equipos: payload.devices.equipos.map((e) => e.id),
};

/* ------------------------------- ZIP (store) ------------------------------ */
// Mismo método que tools/pack.mjs: sin compresión, sin dependencias.

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function fechaDos(d) {
  const hora = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const fecha = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { hora, fecha };
}
function construirZip(entradas) {
  const { hora, fecha } = fechaDos(new Date());
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const e of entradas) {
    const nombre = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const tam = e.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt16LE(hora, 10); lh.writeUInt16LE(fecha, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(tam, 18); lh.writeUInt32LE(tam, 22);
    lh.writeUInt16LE(nombre.length, 26); lh.writeUInt16LE(0, 28);
    locales.push(lh, nombre, e.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(hora, 12); ch.writeUInt16LE(fecha, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(tam, 20); ch.writeUInt32LE(tam, 24);
    ch.writeUInt16LE(nombre.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrales.push(ch, nombre);
    offset += lh.length + nombre.length + e.data.length;
  }
  const parteLocal = Buffer.concat(locales);
  const parteCentral = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8); fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(parteCentral.length, 12); fin.writeUInt32LE(parteLocal.length, 16);
  return Buffer.concat([parteLocal, parteCentral, fin]);
}

/* --------------------------------- empaque -------------------------------- */

const entrada = process.argv[2];
if (!entrada) fallar('Uso: node tools/pack-rubro.mjs <pack.json> [salida.krub]');
const rutaPack = resolve(entrada);
if (!existsSync(rutaPack)) fallar('No existe ' + rutaPack);

const pack = leer(rutaPack);
const v = validarPack(pack, catalogos);
v.avisos.forEach((a) => console.log('  · ' + a));
if (!v.ok) { v.errores.forEach((e) => console.error('  ✖ ' + e)); fallar('el pack no pasa la validación.'); }

const carga = cargarPacks(payload.rubros, [pack], catalogos);
if (carga.errores.length) { carga.errores.forEach((e) => console.error('  ✖ ' + e)); fallar('el pack choca con el catálogo de rubros.'); }

const entradas = [{ name: 'pack.json', data: Buffer.from(JSON.stringify(pack, null, 2), 'utf8') }];
const readmeJunto = join(dirname(rutaPack), basename(rutaPack).replace(/\.json$/, '') + '.md');
if (existsSync(readmeJunto)) entradas.push({ name: 'README.md', data: readFileSync(readmeJunto) });

const salida = process.argv[3]
  ? resolve(process.argv[3])
  : join(dirname(rutaPack), pack.id + '-' + pack.version + '.krub');
writeFileSync(salida, construirZip(entradas));

const nuevos = carga.rubros.filter((r) => String(r.origen || '').indexOf(pack.id) >= 0);
console.log('✔ ' + basename(salida) + ' (' + (statSync(salida).size / 1024).toFixed(1) + ' KB) · '
  + 'rubroPackApi ' + RUBRO_PACK_API + ' · ' + pack.rubros.length + ' entrada(s) → '
  + nuevos.map((r) => r.nombre).join(', '));
console.log('  Instalar: KIMOS → LiDARia → Rubros → Ampliar la base de conocimiento.');
