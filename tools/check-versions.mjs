#!/usr/bin/env node
/**
 * check-versions.mjs — verifica que la versión de cada app esté sincronizada
 * en todos los lugares donde vive.
 *
 * Por qué existe: la Tienda de KIMOS ofrece la actualización según el
 * **catálogo raíz** (`/manifest.json` → `apps[]`). Si se sube la versión en la
 * carpeta de la app pero no en el catálogo, la app instalada se queda con el
 * bundle viejo y no aparece nada que actualizar. Este chequeo lo detecta antes
 * de commitear.
 *
 * Qué compara, por app:
 *   1. `apps/{id}/manifest.json` → `version`      (fuente de verdad de la app)
 *   2. `/manifest.json` → `apps[] → {id}.version` (lo que lee la Tienda)
 *   3. `apps/{id}/dist/index.js` → `APP_VERSION`  (si la app la declara)
 *   4. `apps/{id}/README.md` → "Versión actual: x.y.z" (si la declara)
 *   y avisa si la `description` del catálogo quedó desfasada de la del app.
 *
 * Uso:
 *   node tools/check-versions.mjs            # todas las apps
 *   node tools/check-versions.mjs notas-equipo
 *
 * Sale con código 1 si algo está desalineado (sirve para CI o pre-commit).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const catalog = readJson(join(ROOT, 'manifest.json'));
const catalogApps = new Map((catalog.apps || []).map((a) => [a.id, a]));

const appDirs = readdirSync(join(ROOT, 'apps'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'apps', d.name, 'manifest.json')))
  .map((d) => d.name)
  .filter((id) => !only.length || only.includes(id));

let problems = 0;
let warnings = 0;
const rows = [];

for (const dir of appDirs) {
  const appManifest = readJson(join(ROOT, 'apps', dir, 'manifest.json'));
  const id = appManifest.id || dir;
  const version = String(appManifest.version || '');
  const entry = catalogApps.get(id);
  const bundle = readText(join(ROOT, 'apps', dir, appManifest.entry || 'dist/index.js'));
  const readme = readText(join(ROOT, 'apps', dir, 'README.md'));

  const declared = (bundle.match(/APP_VERSION\s*=\s*'([^']+)'|APP_VERSION\s*=\s*"([^"]+)"/) || []).slice(1).find(Boolean);
  const inReadme = (readme.match(/Versi[oó]n actual:\s*\**\s*([0-9][0-9A-Za-z.\-]*)/i) || [])[1];

  const fails = [];
  const warns = [];

  if (!entry) {
    // Las apps de ejemplo (namespace con punto: miorg.*) se distribuyen por
    // .kapp, no por el catálogo oficial: no es un error que no estén ahí.
    if (id.includes('.')) warns.push('no está en el catálogo raíz (app de ejemplo / sideload)');
    else fails.push('FALTA en el catálogo raíz /manifest.json → apps[]: la Tienda no la ve');
  } else {
    if (String(entry.version) !== version) {
      fails.push('catálogo raíz en ' + entry.version + ' ≠ manifest de la app en ' + version
        + ' → la Tienda NO ofrecerá la actualización');
    }
    if (entry.description && appManifest.description && entry.description !== appManifest.description) {
      warns.push('la descripción del catálogo raíz quedó distinta a la del manifest de la app');
    }
  }
  if (declared && declared !== version) {
    fails.push('APP_VERSION del bundle en ' + declared + ' ≠ manifest de la app en ' + version
      + ' → la app mostrará una versión que no es la instalada');
  }
  if (!declared) warns.push('el bundle no declara APP_VERSION (no se puede ver en pantalla qué build quedó)');
  if (inReadme && inReadme !== version) {
    fails.push('README dice "Versión actual: ' + inReadme + '" ≠ manifest de la app en ' + version);
  }

  problems += fails.length;
  warnings += warns.length;
  rows.push({ id, version, fails, warns });
}

for (const r of rows) {
  const mark = r.fails.length ? '✖' : (r.warns.length ? '!' : '✔');
  console.log(mark + ' ' + r.id.padEnd(18) + ' v' + r.version);
  for (const f of r.fails) console.log('    ✖ ' + f);
  for (const w of r.warns) console.log('    · ' + w);
}

console.log('');
if (problems) {
  console.error('✖ ' + problems + ' problema(s) de versionado. Sube la versión en TODOS los lugares '
    + '(manifest de la app, catálogo raíz /manifest.json, APP_VERSION del bundle y README) antes de publicar.');
  process.exit(1);
}
console.log('✔ versiones sincronizadas' + (warnings ? ' (' + warnings + ' aviso(s))' : '') + '.');
