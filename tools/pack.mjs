#!/usr/bin/env node
/**
 * pack.mjs — empaquetador de apps de Kimos (Fase 8). Valida una carpeta de app
 * y genera un comprimido `.kapp` (ZIP) instalable por sideload desde la Tienda.
 *
 * Uso:
 *   node tools/pack.mjs apps/fossflow [salida.kapp]
 *
 * El `.kapp` contiene en su raíz: manifest.json + dist/** + assets/** (+ README).
 * Sin dependencias: implementa un ZIP por método "store" (sin compresión), que
 * el backend (zipfile) lee sin problema.
 */
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_PERMISSIONS = new Set(['instance.read', 'instance.write', 'agent.control', 'public.read', 'public.submit']);
const APP_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const VERSION_RE = /^\d+(\.\d+){0,2}([-.][0-9A-Za-z-]+)*$/;
const INCLUDE_TOP = new Set(['manifest.json', 'dist', 'assets', 'README.md']);

function fail(msg) { console.error('✖ ' + msg); process.exit(1); }

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── ZIP (store) ───────────────────────────────────────────────────────────────
function dosDateTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}
function buildZip(entries) {
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const size = e.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(size, 18); lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, e.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(size, 20); ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + e.data.length;
  }
  const localPart = Buffer.concat(locals);
  const centralPart = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralPart.length, 12); eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, eocd]);
}

// ── Recolección de archivos ───────────────────────────────────────────────────
function walk(dir, rel, out) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, r, out);
    else out.push({ name: r, data: fs.readFileSync(abs) });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const appDir = process.argv[2];
if (!appDir) fail('Uso: node tools/pack.mjs <carpeta-app> [salida.kapp]');
if (!fs.existsSync(path.join(appDir, 'manifest.json'))) fail(`No existe ${appDir}/manifest.json`);

let manifest;
try { manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'manifest.json'), 'utf8')); }
catch (e) { fail('manifest.json no es JSON válido: ' + e.message); }

const id = String(manifest.id || '').trim();
const version = String(manifest.version || '').trim();
if (!APP_ID_RE.test(id)) fail("`id` inválido (minúsculas/dígitos/. _ -; recomendado namespacing 'org.app').");
if (!VERSION_RE.test(version)) fail('`version` inválida (usa SemVer, p.ej. 1.0.0).');
const perms = manifest.permissions || [];
if (!Array.isArray(perms) || perms.some((p) => !ALLOWED_PERMISSIONS.has(p)))
  fail(`\`permissions\` inválidos. Permitidos: ${[...ALLOWED_PERMISSIONS].join(', ')}.`);
const entry = String(manifest.entry || 'dist/index.js');
if (!fs.existsSync(path.join(appDir, entry))) fail(`No existe el bundle '${entry}'.`);

const entries = [];
for (const top of fs.readdirSync(appDir)) {
  if (!INCLUDE_TOP.has(top)) continue;
  const abs = path.join(appDir, top);
  if (fs.statSync(abs).isDirectory()) walk(abs, top, entries);
  else entries.push({ name: top, data: fs.readFileSync(abs) });
}

const out = process.argv[3] || `${id}-${version}.kapp`;
fs.writeFileSync(out, buildZip(entries));
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`✔ ${out} (${entries.length} archivos, ${kb} KB)`);
console.log(`  id=${id} v${version} · entry=${entry} · permisos=[${perms.join(', ')}]`);
console.log(`  Instálalo en la Tienda → "Instalar desde archivo" (superadmin).`);
