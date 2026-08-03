#!/usr/bin/env node
/**
 * build.mjs — genera `dist/index.js` concatenando los fragmentos de `src/`
 * en orden alfabético (los nombres empiezan por NN- para fijar el orden).
 *
 * Los fragmentos NO son módulos independientes: comparten el mismo ámbito
 * (los que empiezan por 4x/5x viven dentro de `mount()`). El host sirve el
 * bundle tal cual, así que no hay minificado ni transpilación: lo que se
 * escribe es lo que se ejecuta.
 *
 *   node apps/kreative-studio/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const srcDir = path.join(here, 'src');
const outFile = path.join(here, 'dist', 'index.js');

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
if (!files.length) { console.error('✖ No hay fragmentos en src/'); process.exit(1); }

const parts = files.map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8').replace(/\s+$/, ''));
const bundle = parts.join('\n') + '\n';

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, bundle, 'utf8');

const lines = bundle.split('\n').length;
console.log('✔ dist/index.js — ' + files.length + ' fragmentos, ' + lines + ' líneas, '
  + (Buffer.byteLength(bundle, 'utf8') / 1024).toFixed(1) + ' KB');
for (const f of files) console.log('   · ' + f);
