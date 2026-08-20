#!/usr/bin/env node
/**
 * verify-app.mjs — verificador standalone de UNA app de KIMOS (a diferencia de
 * check-versions.mjs, no depende de la estructura de este repo: funciona sobre
 * cualquier carpeta de app, también desde el creator pack).
 *
 * Uso:
 *   node tools/verify-app.mjs <carpeta-app>
 *
 * Qué revisa (✖ = falla con exit 1; · = aviso):
 *   ✖ manifest.json válido: id, version SemVer, permissions permitidos, entry existe
 *   ✖ el bundle importa sin errores de sintaxis y exporta `default mount`
 *   ✖ APP_VERSION del bundle ≠ version del manifest
 *   ✖ "Versión actual" del README ≠ version del manifest
 *   ✖ usa shell.agent sin permiso agent.control / shell.data sin data.read:*
 *   · no declara APP_VERSION (no se puede ver en pantalla qué build corre)
 *   · empaqueta su propio React (rompe los hooks del host)
 *   · guarda datos sin multiInstance (saveData/items no persisten sin instancia)
 *   · CSS sin la clase raíz esperada (riesgo de filtrar estilos al shell)
 *   · usa shell.authFetch (endpoints internos: revisa APP-SPEC.md §7.d)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_PERMISSIONS = new Set(['instance.read', 'instance.write', 'agent.control', 'public.read', 'public.submit']);
const PARAM_PERMISSION_RE = /^data\.read:(\*|[a-z0-9][a-z0-9.\-]{0,60})$/;
const APP_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const VERSION_RE = /^\d+(\.\d+){0,2}([-.][0-9A-Za-z-]+)*$/;

const appDir = process.argv[2];
if (!appDir) { console.error('Uso: node tools/verify-app.mjs <carpeta-app>'); process.exit(1); }

const fails = [];
const warns = [];
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

// ── manifest ──────────────────────────────────────────────────────────────────
const manifestPath = path.join(appDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) { console.error(`✖ No existe ${manifestPath}`); process.exit(1); }
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
catch (e) { console.error('✖ manifest.json no es JSON válido: ' + e.message); process.exit(1); }

const id = String(manifest.id || '').trim();
const version = String(manifest.version || '').trim();
if (!APP_ID_RE.test(id)) fails.push("`id` inválido (minúsculas/dígitos/. _ -; recomendado namespacing 'org.app').");
if (!VERSION_RE.test(version)) fails.push('`version` inválida (usa SemVer, p.ej. 1.0.0).');
const perms = Array.isArray(manifest.permissions) ? manifest.permissions : [];
for (const p of perms) {
  if (!(ALLOWED_PERMISSIONS.has(p) || PARAM_PERMISSION_RE.test(p))) fails.push(`permiso desconocido: '${p}'.`);
}
const entry = String(manifest.entry || 'dist/index.js');
const entryPath = path.join(appDir, entry);
if (!fs.existsSync(entryPath)) fails.push(`no existe el bundle '${entry}'.`);

// ── bundle ────────────────────────────────────────────────────────────────────
const bundle = read(entryPath);
if (bundle) {
  // Import real: detecta errores de sintaxis y valida el export default.
  try {
    const mod = await import(pathToFileURL(path.resolve(entryPath)).href);
    if (typeof mod.default !== 'function') fails.push('el bundle no exporta `default function mount(shell)`.');
  } catch (e) {
    fails.push('el bundle no importa: ' + String(e && e.message || e).split('\n')[0]);
  }

  const declared = (bundle.match(/APP_VERSION\s*=\s*'([^']+)'|APP_VERSION\s*=\s*"([^"]+)"/) || []).slice(1).find(Boolean);
  if (declared && declared !== version) {
    fails.push(`APP_VERSION del bundle (${declared}) ≠ version del manifest (${version}).`);
  }
  if (!declared) warns.push('el bundle no declara APP_VERSION (la app debe mostrar su versión en pantalla — APP-SPEC §7.a).');

  if (/from\s+['"]react['"]|require\(\s*['"]react['"]\s*\)/.test(bundle)) {
    warns.push("el bundle parece importar su propio React: usa `globalThis.React` (dos copias rompen los hooks).");
  }

  const usesAgent = /shell\.agent\b/.test(bundle);
  const usesData = /shell\.data\b/.test(bundle);
  const usesPersistence = /shell\.(saveData|loadData|items)\b/.test(bundle);
  const usesAuthFetch = /shell\.authFetch\b/.test(bundle);
  if (usesAgent && !perms.includes('agent.control')) {
    fails.push('usa shell.agent pero el manifest no declara `agent.control`.');
  }
  if (usesData && !perms.some((p) => PARAM_PERMISSION_RE.test(p))) {
    fails.push('usa shell.data pero el manifest no declara ningún `data.read:{templateId}`.');
  }
  if (usesPersistence && !manifest.multiInstance) {
    warns.push('guarda datos (saveData/items) sin `multiInstance: true` — sin instancia NO hay persistencia (APP-SPEC §2).');
  }
  if (usesAuthFetch) {
    warns.push('usa shell.authFetch (endpoints internos con el RBAC del usuario): revisa APP-SPEC.md §7.d y pide solo lo necesario.');
  }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const cssRel = manifest.css ? String(manifest.css) : '';
if (cssRel) {
  const css = read(path.join(appDir, cssRel));
  if (!css) {
    warns.push(`el manifest declara css '${cssRel}' pero el archivo no existe.`);
  } else {
    const rootClass = id.replace(/[^a-z0-9]+/g, '-');
    const hasScope = css.includes('.' + rootClass) || (bundle && (bundle.match(/className:\s*'([a-z0-9-]+)'/) || [])[1] && css.includes('.' + (bundle.match(/className:\s*'([a-z0-9-]+)'/) || [])[1]));
    if (!hasScope) warns.push('no se encontró una clase raíz con scope en el CSS (riesgo de filtrar estilos al shell — APP-SPEC §3).');
  }
}

// ── README ────────────────────────────────────────────────────────────────────
const readme = read(path.join(appDir, 'README.md'));
const inReadme = (readme.match(/Versi[oó]n actual:\s*\**\s*([0-9][0-9A-Za-z.\-]*)/i) || [])[1];
if (inReadme && inReadme !== version) fails.push(`README dice "Versión actual: ${inReadme}" ≠ manifest (${version}).`);

// ── Salida ────────────────────────────────────────────────────────────────────
console.log((fails.length ? '✖' : warns.length ? '!' : '✔') + ` ${id || appDir} v${version}`);
for (const f of fails) console.log('    ✖ ' + f);
for (const w of warns) console.log('    · ' + w);
if (fails.length) {
  console.error(`\n✖ ${fails.length} problema(s). Corrígelos antes de empaquetar.`);
  process.exit(1);
}
console.log(`\n✔ verificación en verde${warns.length ? ` (${warns.length} aviso(s))` : ''}. Empaqueta con: node tools/pack.mjs ${appDir}`);
