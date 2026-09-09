/**
 * Kimos WorkOffice v1.0.0 — suite ofimática de KIMOS.
 *
 * ARCHIVO GENERADO por tools/build.mjs a partir de src/. No editar a mano:
 * los cambios van en src/*.js y se recompila con `node tools/build.mjs`.
 *
 * Contrato AppShell v1 (kimos-packages/APP-SPEC.md):
 *   - ESM único que exporta `default mount(shell) -> { Component, unmount }`.
 *   - Usa `globalThis.React` (nunca empaqueta su propia copia).
 *   - Sin JSX: todo con `React.createElement`.
 *   - Estado dentro del closure de mount(): una instancia = un espacio de trabajo.
 *   - Nunca `innerHTML`/`dangerouslySetInnerHTML`: el contenido del usuario se
 *     pinta siempre como elementos React (ver docs/SEGURIDAD.md).
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

  // Versión visible en pantalla: al probar, confirma qué build tomó el host.
  // Se sincroniza sola desde manifest.json al compilar (APP-SPEC §7.a).
  const APP_VERSION = '1.0.0';

// ══════════════════════════════════════════════════════════════════════
// src/00-core.js
// ══════════════════════════════════════════════════════════════════════
/* ══ NÚCLEO ═══════════════════════════════════════════════════════════════
 *
 * Modelo de datos de la suite: **una instancia = un espacio de trabajo**, y
 * cada archivo (documento, hoja, presentación, nota, evento) es un *item* de
 * esa instancia (`shell.items`). Se eligió item-por-archivo y no un único blob
 * con `saveData` por tres razones:
 *
 *   1. **Nadie se pisa.** El CRUD ya es por archivo: dos personas editando
 *      archivos distintos escriben registros distintos (APP-SPEC §5.1).
 *   2. **Escala.** El peso del espacio de trabajo no entra en cada guardado;
 *      se guarda solo el archivo tocado.
 *   3. **Se puede listar sin abrir.** El explorador (Inicio) pinta nombres,
 *      fechas y autores sin cargar el contenido de cada archivo.
 *
 * Todo lo que sigue vive dentro del closure de `mount(shell)`: el estado es de
 * la ventana, nunca del módulo.
 */

// ── Identidad de la ventana ─────────────────────────────────────────────
const instanceId = shell.app && shell.app.instanceId;
const teamId = shell.app && shell.app.teamId;

// ── Utilidades base ─────────────────────────────────────────────────────
const s = (v) => (v == null ? '' : String(v));
const stamp = () => new Date().toISOString();
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/** Número tolerante: acepta "1.234,56", "1,234.56", "45%", "$ 1.200". */
function num(v, fallback) {
  if (typeof v === 'number') return isFinite(v) ? v : (fallback || 0);
  const raw = s(v).trim();
  if (!raw) return fallback === undefined ? 0 : fallback;
  let t = raw.replace(/[\s $€£]/g, '');
  const pct = /%$/.test(t);
  if (pct) t = t.slice(0, -1);
  // "1.234,56" (es) vs "1,234.56" (en): manda el separador que va último.
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma >= 0) {
    t = /,\d{3}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const out = parseFloat(t);
  if (!isFinite(out)) return fallback === undefined ? 0 : fallback;
  return pct ? out / 100 : out;
}

/** Comparación insensible a mayúsculas, tildes y puntuación (buscador). */
const canon = (v) => s(v).trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

let uidSeq = 0;
const uid = (p) => (p || 'x') + '_' + Date.now().toString(36) + '_'
  + (uidSeq++).toString(36) + Math.random().toString(36).slice(2, 6);

function debounce(fn, ms) {
  let t = null;
  const wrapped = function () {
    const args = arguments;
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn.apply(null, args); }, ms);
  };
  wrapped.cancel = () => { if (t) { clearTimeout(t); t = null; } };
  wrapped.flushNow = function () { if (t) { clearTimeout(t); t = null; fn.apply(null, arguments); } };
  return wrapped;
}

// ── Fechas (todo en horario local; se guarda ISO) ───────────────────────
const pad2 = (n) => (n < 10 ? '0' + n : String(n));
/** "2026-08-25" de un Date local (sin saltar de día por UTC). */
const isoDay = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayISO = () => isoDay(new Date());
/** Parsea "2026-08-25" como fecha LOCAL (new Date(str) la leería como UTC). */
function dayToDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(v));
  if (!m) { const d = new Date(s(v)); return isNaN(d) ? null : d; }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function addDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Fecha corta legible: "25 ago 2026". */
function fmtDay(v) {
  const d = dayToDate(v);
  if (!d) return s(v);
  return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
}
/** "hace 5 min" / "ayer 14:03" / "25 ago 2026" — para listas de archivos. */
function fmtWhen(iso) {
  const t = s(iso); if (!t) return '';
  const d = new Date(t); if (isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  const hhmm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  if (diff < 60000) return 'recién';
  if (diff < 3600000) return 'hace ' + Math.floor(diff / 60000) + ' min';
  if (isoDay(d) === todayISO()) return 'hoy ' + hhmm;
  if (isoDay(d) === isoDay(addDays(new Date(), -1))) return 'ayer ' + hhmm;
  return fmtDay(isoDay(d));
}

// ── Tipos de archivo de la suite ────────────────────────────────────────
const KINDS = {
  doc: { id: 'doc', icon: '📄', label: 'Documento', plural: 'Documentos', module: 'docs' },
  sheet: { id: 'sheet', icon: '📊', label: 'Hoja de cálculo', plural: 'Hojas de cálculo', module: 'sheets' },
  deck: { id: 'deck', icon: '🖼️', label: 'Presentación', plural: 'Presentaciones', module: 'slides' },
  note: { id: 'note', icon: '🗒️', label: 'Nota', plural: 'Notas', module: 'notes' },
  event: { id: 'event', icon: '📅', label: 'Evento', plural: 'Calendario', module: 'calendar' },
};
const MODULES = [
  { id: 'drive', icon: '🏠', label: 'Inicio', kind: null },
  { id: 'docs', icon: '📄', label: 'Documentos', kind: 'doc' },
  { id: 'sheets', icon: '📊', label: 'Hojas', kind: 'sheet' },
  { id: 'slides', icon: '🖼️', label: 'Presentaciones', kind: 'deck' },
  { id: 'notes', icon: '🗒️', label: 'Notas', kind: 'note' },
  { id: 'calendar', icon: '📅', label: 'Calendario', kind: 'event' },
];
const kindOf = (f) => (f && KINDS[f.kind] ? f.kind : 'doc');
const isFile = (it) => !!(it && it.kind && KINDS[it.kind]);

// ── Preferencias (⚙️ Configurar del host) ───────────────────────────────
const DEFAULT_CFG = {
  startModule: 'drive', autosave: true, dense: false,
  weekStart: '1', currency: 'CLP', kimosData: true,
};

// ── Estado observable ───────────────────────────────────────────────────
let model = {
  loaded: false,
  offline: false,
  saveState: 'idle',      // idle | pending | saving | saved | error
  lastSavedAt: '',
  files: [],
  me: null,
  members: [],
  spaceName: '',
  module: 'drive',
  openId: '',             // archivo abierto en el módulo actual
  trash: false,
  query: '',
  palette: false,
  cfg: Object.assign({}, DEFAULT_CFG),
  external: { gantt: [], notes: [], loadedAt: '' },
};
const listeners = new Set();
let emitScheduled = false;
function emit() {
  // Agrupa ráfagas de mutaciones en un solo repintado (teclear en una celda
  // dispara varias): evita repintar la grilla una vez por tecla.
  if (emitScheduled) return;
  emitScheduled = true;
  Promise.resolve().then(() => {
    emitScheduled = false;
    const snap = Object.assign({}, model);
    listeners.forEach((l) => { try { l(snap); } catch (e) { /* un listener roto no frena al resto */ } });
  });
}
function setModel(patch) { model = Object.assign({}, model, patch); emit(); }

const meLabel = () => (model.me && (model.me.name || model.me.id)) || '';
const meId = () => (model.me && model.me.id) || '';

// ── Acceso a la API del host ────────────────────────────────────────────
function apiBase() {
  try {
    const raw = shell.assetUrl ? shell.assetUrl('x').split('/api/apps/')[0] : '';
    return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
  } catch (e) { return (typeof window !== 'undefined' && window.location.origin) || ''; }
}
const API = apiBase();
const req = (url, init) => (shell.authFetch ? shell.authFetch(url, init) : fetch(url, init));

function notify(level, text) {
  try { shell.notify({ level, text }); } catch (e) { /* el host puede no tener toasts */ }
}

// ── Cola serializada de red ─────────────────────────────────────────────
// Un guardado nunca debe cruzarse con un refresco: si se cruzan, el refresco
// puede pisar en pantalla lo que el guardado acaba de mandar (APP-SPEC §5.1.6).
let chain = Promise.resolve();
function enqueue(fn) {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

/* ── Almacén de archivos ────────────────────────────────────────────────
 * `files` en el modelo es siempre la verdad de la pantalla. El servidor se
 * consulta por debajo y se **fusiona** por archivo (nunca se reemplaza la
 * lista entera), de modo que lo que estás editando no desaparece porque otra
 * persona guardó otra cosa.
 */
const AUTOSAVE_MS = 1200;      // guardar tras dejar de escribir
const SYNC_FOCUS_MS = 20000;   // refrescar con la ventana enfocada
const SYNC_BLUR_MS = 60000;    // …y más lento de fondo
const NEW_GRACE_MS = 20000;    // margen de auto-reparación para lo recién creado

const dirty = new Map();       // id -> patch pendiente de enviar
const localOnly = new Map();   // id -> ts de creación local (aún no confirmada)

function normalizeFile(f) {
  const kind = KINDS[f && f.kind] ? f.kind : 'doc';
  return Object.assign({
    name: KINDS[kind].label, star: false, trashed: false, data: {},
    createdAt: '', createdBy: '', createdById: '', updatedAt: '', updatedBy: '', updatedById: '',
  }, f, { kind, data: (f && f.data) || {} });
}
const fileTime = (f) => s(f && (f.updatedAt || f.createdAt));
const byRecent = (a, b) => (fileTime(b) > fileTime(a) ? 1 : fileTime(b) < fileTime(a) ? -1 : 0);
const getFile = (id) => model.files.find((f) => f.id === id) || null;
const filesOfKind = (kind) => model.files.filter((f) => f.kind === kind && !f.trashed).sort(byRecent);

/** Firma barata del listado: evita repintar cuando el servidor no trajo nada nuevo. */
function filesSignature(list) {
  return list.map((f) => f.id + ':' + fileTime(f) + ':' + (f.trashed ? 1 : 0) + ':' + (f.star ? 1 : 0)
    + ':' + f.name.length).join('|');
}

async function refresh(force) {
  if (!instanceId || !shell.items) { setModel({ loaded: true, offline: !instanceId }); return; }
  let remote;
  try {
    remote = await shell.items.list();
  } catch (e) {
    setModel({ loaded: true, offline: true });
    return;
  }
  const remoteFiles = (remote || []).filter(isFile).map(normalizeFile);
  const byId = new Map(remoteFiles.map((f) => [f.id, f]));
  const merged = [];

  // 1. Lo remoto manda… salvo que aquí haya algo más nuevo o sin guardar.
  for (const r of remoteFiles) {
    const local = getFile(r.id);
    if (!local) { merged.push(r); continue; }
    if (dirty.has(r.id)) { merged.push(local); continue; }         // se está escribiendo
    merged.push(fileTime(local) > fileTime(r) ? local : r);        // gana el más reciente
  }
  // 2. Auto-reparación acotada: lo propio y recién creado que el servidor aún
  //    no devuelve no se borra de la pantalla (APP-SPEC §5.1.4). Pasado el
  //    margen, si sigue sin estar, es que se borró desde otra sesión.
  for (const local of model.files) {
    if (byId.has(local.id)) continue;
    const born = localOnly.get(local.id);
    if (dirty.has(local.id) || (born && Date.now() - born < NEW_GRACE_MS)) merged.push(local);
  }
  merged.sort(byRecent);

  const changed = force || !model.loaded || model.offline
    || filesSignature(merged) !== filesSignature(model.files);
  if (changed) setModel({ files: merged, loaded: true, offline: false });
  else if (!model.loaded) setModel({ loaded: true, offline: false });
}

/** Crea un archivo. Optimista: aparece en pantalla antes del viaje de red. */
async function createFile(kind, name, data) {
  const k = KINDS[kind] ? kind : 'doc';
  const payload = normalizeFile({
    kind: k,
    name: s(name).trim() || nextFreeName(k),
    data: data || {},
    createdAt: stamp(), createdBy: meLabel(), createdById: meId(),
    updatedAt: stamp(), updatedBy: meLabel(), updatedById: meId(),
  });
  if (!instanceId || !shell.items) {
    // Sin instancia no hay persistencia (APP-SPEC §2): se trabaja en memoria y
    // se avisa, en vez de fingir que se guardó.
    const local = Object.assign({ id: uid(k) }, payload);
    setModel({ files: [local].concat(model.files).sort(byRecent), offline: true });
    return local;
  }
  const tempId = uid(k);
  const optimistic = Object.assign({ id: tempId }, payload);
  localOnly.set(tempId, Date.now());
  setModel({ files: [optimistic].concat(model.files).sort(byRecent) });
  try {
    const created = normalizeFile(await enqueue(() => shell.items.create(payload)));
    localOnly.delete(tempId);
    localOnly.set(created.id, Date.now());
    setModel({
      files: model.files.map((f) => (f.id === tempId ? created : f)).sort(byRecent),
      offline: false,
    });
    return created;
  } catch (e) {
    localOnly.delete(tempId);
    setModel({ files: model.files.filter((f) => f.id !== tempId), offline: true });
    notify('error', 'No se pudo crear el archivo. Revisa la conexión.');
    return null;
  }
}

/** Aplica un cambio en pantalla ya y lo agenda para guardar (autoguardado). */
function patchFile(id, patch, opts) {
  const f = getFile(id);
  if (!f) return null;
  const next = Object.assign({}, f, patch, {
    updatedAt: stamp(), updatedBy: meLabel(), updatedById: meId(),
  });
  setModel({ files: model.files.map((x) => (x.id === id ? next : x)) });
  const pending = Object.assign({}, dirty.get(id) || {}, patch, {
    updatedAt: next.updatedAt, updatedBy: next.updatedBy, updatedById: next.updatedById,
  });
  dirty.set(id, pending);
  if (model.saveState !== 'saving') setModel({ saveState: 'pending' });
  if (opts && opts.immediate) { flushSaves(); } else if (model.cfg.autosave !== false) { scheduleSave(); }
  return next;
}

const scheduleSave = debounce(() => { void flushSaves(); }, AUTOSAVE_MS);

/** Vacía la cola de pendientes. Devuelve true si todo quedó guardado. */
async function flushSaves() {
  scheduleSave.cancel();
  if (!dirty.size) { if (model.saveState === 'pending') setModel({ saveState: 'idle' }); return true; }
  if (!instanceId || !shell.items) { setModel({ saveState: 'error', offline: true }); return false; }
  const batch = Array.from(dirty.entries());
  dirty.clear();
  setModel({ saveState: 'saving' });
  let ok = true;
  for (const entry of batch) {
    const id = entry[0];
    const patch = entry[1];
    if (localOnly.has(id) && !getFile(id)) continue;               // se borró mientras tanto
    try {
      await enqueue(() => shell.items.update(id, patch));
    } catch (e) {
      ok = false;
      // Se devuelve a la cola: el próximo intento lo reenvía con lo más nuevo.
      dirty.set(id, Object.assign({}, patch, dirty.get(id) || {}));
    }
  }
  if (ok) setModel({ saveState: 'saved', lastSavedAt: stamp(), offline: false });
  else { setModel({ saveState: 'error', offline: true }); notify('warn', 'No se pudo guardar todo: se reintentará.'); }
  if (ok) setTimeout(() => { if (model.saveState === 'saved' && !dirty.size) setModel({ saveState: 'idle' }); }, 2500);
  return ok;
}

/** Papelera: borrar es reversible; el borrado definitivo es explícito. */
function trashFile(id) { return patchFile(id, { trashed: true }, { immediate: true }); }
function restoreFile(id) { return patchFile(id, { trashed: false }, { immediate: true }); }

async function destroyFile(id) {
  const f = getFile(id);
  if (!f) return false;
  dirty.delete(id);
  setModel({ files: model.files.filter((x) => x.id !== id), openId: model.openId === id ? '' : model.openId });
  localOnly.delete(id);
  if (!instanceId || !shell.items) return true;
  try { await enqueue(() => shell.items.remove(id)); return true; } catch (e) {
    setModel({ files: [f].concat(model.files).sort(byRecent), offline: true });
    notify('error', 'No se pudo eliminar el archivo.');
    return false;
  }
}

async function duplicateFile(id) {
  const f = getFile(id);
  if (!f) return null;
  return createFile(f.kind, nextFreeName(f.kind, s(f.name) + ' (copia)'), clone(f.data));
}

/** Nombre libre: "Documento", "Documento 2", "Documento 3"… */
function nextFreeName(kind, base) {
  const stem = s(base).trim() || (KINDS[kind] ? KINDS[kind].label : 'Archivo');
  const taken = new Set(model.files.filter((f) => f.kind === kind).map((f) => canon(f.name)));
  if (!taken.has(canon(stem))) return stem;
  for (let i = 2; i < 999; i++) if (!taken.has(canon(stem + ' ' + i))) return stem + ' ' + i;
  return stem + ' ' + Date.now();
}

/** Buscador global: nombre + contenido, con un extracto de dónde coincide. */
function searchFiles(query) {
  const q = canon(query);
  if (!q) return [];
  const terms = q.split(' ').filter(Boolean);
  const out = [];
  for (const f of model.files) {
    if (f.trashed) continue;
    const hay = canon(f.name);
    const body = canon(fileText(f)).slice(0, 20000);
    const inName = terms.every((t) => hay.indexOf(t) >= 0);
    const inBody = terms.every((t) => body.indexOf(t) >= 0);
    if (!inName && !inBody) continue;
    out.push({ file: f, where: inName ? 'nombre' : 'contenido', excerpt: inName ? '' : excerptAround(fileText(f), terms[0]) });
  }
  return out.sort((a, b) => (a.where === b.where ? byRecent(a.file, b.file) : a.where === 'nombre' ? -1 : 1)).slice(0, 40);
}

function excerptAround(text, term) {
  const flat = s(text).replace(/\s+/g, ' ');
  const i = canon(flat).indexOf(term);
  if (i < 0) return flat.slice(0, 90);
  return (i > 30 ? '…' : '') + flat.slice(Math.max(0, i - 30), i + 70) + '…';
}

/** Texto plano de un archivo, para buscar y para el agente. Cada módulo
 *  registra aquí su extractor al cargarse (`textExtractors`). */
const textExtractors = {};
function fileText(f) {
  const fn = textExtractors[f && f.kind];
  if (!fn) return s(f && f.name);
  try { return s(f.name) + '\n' + s(fn(f)); } catch (e) { return s(f && f.name); }
}

// ── Carga inicial ───────────────────────────────────────────────────────
let loadedOnce = false;
async function loadAll() {
  if (loadedOnce) return;
  loadedOnce = true;

  // Preferencias del host (⚙️ Configurar). Retrocompatible: si el host es v1
  // y no expone `shell.config`, quedan los valores por defecto.
  if (shell.config && typeof shell.config.get === 'function') {
    try {
      const cfg = await shell.config.get();
      if (cfg) setModel({ cfg: Object.assign({}, DEFAULT_CFG, cfg) });
    } catch (e) { /* opcional */ }
    if (typeof shell.config.onChange === 'function') {
      try {
        const off = shell.config.onChange((cfg) => setModel({ cfg: Object.assign({}, DEFAULT_CFG, cfg || {}) }));
        if (typeof off === 'function') teardownTasks.push(off);
      } catch (e) { /* opcional */ }
    }
  }

  await refresh(true);

  const start = s(model.cfg.startModule) || 'drive';
  if (MODULES.some((m) => m.id === start)) setModel({ module: start });

  // Quién soy (autoría de los archivos) y quiénes son mis compañeros.
  try {
    const res = await req(API + '/api/identity/me', { cache: 'no-store' });
    if (res.ok) {
      const me = await res.json();
      setModel({ me: { id: s(me.id), name: s(me.displayName || me.name || me.email || me.id) } });
    }
  } catch (e) { /* opcional: sin identidad la app funciona igual */ }
  try {
    const res = await req(API + '/api/identity/actors', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setModel({
        members: (data.actors || []).filter((a) => a && a.active !== false)
          .map((a) => ({ id: s(a.id), name: s(a.displayName || a.name || a.email || a.id) })),
      });
    }
  } catch (e) { /* opcional */ }
  // Nombre del documento/instancia, para la cabecera.
  if (instanceId) {
    try {
      const res = await req(API + '/api/app-instances/' + instanceId, { cache: 'no-store' });
      if (res.ok) {
        const inst = await res.json();
        const nm = s(inst && (inst.name || (inst.instance && inst.instance.name)));
        if (nm) setModel({ spaceName: nm });
      }
    } catch (e) { /* opcional */ }
  }
}

// ── Ciclo de vida y sincronización ──────────────────────────────────────
const teardownTasks = [];
let syncTimer = null;
let stopped = false;

function scheduleSync() {
  if (stopped) return;
  if (syncTimer) clearTimeout(syncTimer);
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const focused = typeof document !== 'undefined' && document.hasFocus && document.hasFocus();
  const delay = hidden ? SYNC_BLUR_MS * 2 : (focused ? SYNC_FOCUS_MS : SYNC_BLUR_MS);
  syncTimer = setTimeout(async () => {
    // Con la pestaña oculta no se pide nada: solo se reprograma.
    if (!(typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
      if (!dirty.size) { try { await refresh(false); } catch (e) { /* reintenta al próximo ciclo */ } }
    }
    scheduleSync();
  }, delay);
}

function onWake() { if (!stopped && !dirty.size) void refresh(false); scheduleSync(); }

function startLifecycle() {
  void loadAll();
  scheduleSync();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake);
  if (typeof window !== 'undefined') window.addEventListener('focus', onWake);
}

function teardown() {
  stopped = true;
  // Lo que quedó sin guardar se manda ahora: cerrar la ventana no debe perder
  // los últimos segundos de escritura.
  if (dirty.size) { try { void flushSaves(); } catch (e) { /* nada más que hacer */ } }
  scheduleSave.cancel();
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
  if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
  listeners.clear();
  while (teardownTasks.length) {
    const fn = teardownTasks.pop();
    try { if (typeof fn === 'function') fn(); } catch (e) { /* limpiar nunca debe lanzar */ }
  }
}

// ══════════════════════════════════════════════════════════════════════
// src/10-ui.js
// ══════════════════════════════════════════════════════════════════════
/* ══ PRIMITIVAS DE INTERFAZ ════════════════════════════════════════════════
 *
 * Piezas compartidas por los cinco módulos, para que todo se vea y se comporte
 * igual: mismos botones, mismo menú, mismo diálogo, mismo vacío. El aspecto
 * sale entero de los tokens del tema del host (APP-SPEC §9): aquí no hay ni un
 * color cableado.
 *
 * Regla de seguridad que atraviesa este archivo: **el contenido del usuario
 * nunca se convierte en HTML**. El formato enriquecido se guarda como texto
 * plano con marcas y se pinta como elementos React (`MarkText`), así que un
 * documento no puede inyectar etiquetas ni scripts. Ver docs/SEGURIDAD.md.
 */

/** Suscribe un componente al estado de la ventana. */
function useModel() {
  const [snap, setSnap] = useState(() => Object.assign({}, model));
  useEffect(() => {
    listeners.add(setSnap);
    setSnap(Object.assign({}, model));
    return () => { listeners.delete(setSnap); };
  }, []);
  return snap;
}

const cx = function () {
  const out = [];
  for (let i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
  return out.join(' ');
};

// ── Botones ─────────────────────────────────────────────────────────────
function Btn(p) {
  return h('button', {
    type: 'button',
    className: cx('wo-btn', p.variant && 'wo-btn-' + p.variant, p.active && 'wo-btn-on', p.className),
    onClick: p.onClick,
    disabled: !!p.disabled,
    title: p.title || p.label || '',
    'aria-pressed': p.active != null ? !!p.active : undefined,
    'aria-label': p.label ? undefined : (p.title || undefined),
  }, p.icon ? h('span', { className: 'wo-btn-i', 'aria-hidden': 'true' }, p.icon) : null,
     p.label ? h('span', { className: 'wo-btn-t' }, p.label) : null);
}

function IconBtn(p) {
  return h('button', {
    type: 'button',
    className: cx('wo-ibtn', p.active && 'wo-btn-on', p.danger && 'wo-ibtn-danger', p.className),
    onClick: p.onClick, disabled: !!p.disabled, title: p.title || '', 'aria-label': p.title || '',
    'aria-pressed': p.active != null ? !!p.active : undefined,
  }, p.icon);
}

const Sep = () => h('span', { className: 'wo-sep', 'aria-hidden': 'true' });

// ── Campos ──────────────────────────────────────────────────────────────
function Field(p) {
  return h('label', { className: cx('wo-field', p.wide && 'wo-field-wide') },
    p.label ? h('span', { className: 'wo-field-l' }, p.label) : null,
    p.children);
}

function TextInput(p) {
  return h('input', {
    className: cx('wo-in', p.className), type: p.type || 'text', value: s(p.value),
    placeholder: p.placeholder || '', onChange: (e) => p.onChange(e.target.value),
    onKeyDown: p.onKeyDown, disabled: !!p.disabled, min: p.min, max: p.max, step: p.step,
    autoFocus: !!p.autoFocus, 'aria-label': p.ariaLabel || p.placeholder || undefined,
  });
}

function Select(p) {
  return h('select', {
    className: cx('wo-in', 'wo-select', p.className), value: s(p.value),
    onChange: (e) => p.onChange(e.target.value), disabled: !!p.disabled,
    'aria-label': p.ariaLabel || undefined, title: p.title || undefined,
  }, (p.options || []).map((o) => h('option', { key: s(o.value), value: s(o.value) }, o.label)));
}

// ── Menú desplegable (acciones de archivo, insertar, etc.) ───────────────
function Menu(p) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const items = (p.items || []).filter(Boolean);
  return h('span', { className: 'wo-menu', ref: box },
    p.trigger
      ? p.trigger({ open, toggle: () => setOpen(!open) })
      : h(IconBtn, { icon: p.icon || '⋯', title: p.title || 'Acciones', active: open, onClick: () => setOpen(!open) }),
    open ? h('div', { className: cx('wo-menu-pop', p.align === 'left' && 'wo-menu-left'), role: 'menu' },
      items.map((it, i) => (it.divider
        ? h('div', { key: 'd' + i, className: 'wo-menu-div' })
        : h('button', {
          key: it.key || it.label || i, type: 'button', role: 'menuitem',
          className: cx('wo-menu-it', it.danger && 'wo-menu-danger', it.active && 'wo-menu-on'),
          disabled: !!it.disabled,
          onClick: () => { setOpen(false); if (it.onClick) it.onClick(); },
        }, h('span', { className: 'wo-menu-i', 'aria-hidden': 'true' }, it.icon || ''),
           h('span', { className: 'wo-menu-t' }, it.label),
           it.hint ? h('span', { className: 'wo-menu-k' }, it.hint) : null)))) : null);
}

// ── Diálogo ─────────────────────────────────────────────────────────────
function Modal(p) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); p.onClose(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [p.onClose]);
  return h('div', { className: 'wo-modal-bg', onMouseDown: (e) => { if (e.target === e.currentTarget) p.onClose(); } },
    h('div', { className: cx('wo-modal', p.wide && 'wo-modal-wide'), role: 'dialog', 'aria-modal': 'true', 'aria-label': p.title },
      h('div', { className: 'wo-modal-hd' },
        h('div', { className: 'wo-modal-t' }, p.title),
        h(IconBtn, { icon: '✕', title: 'Cerrar', onClick: p.onClose })),
      h('div', { className: 'wo-modal-bd' }, p.children),
      p.actions ? h('div', { className: 'wo-modal-ft' }, p.actions) : null));
}

/** Confirmación para lo que no se puede deshacer (borrado definitivo). */
function ConfirmModal(p) {
  return h(Modal, {
    title: p.title, onClose: p.onCancel,
    actions: [
      h(Btn, { key: 'c', label: 'Cancelar', onClick: p.onCancel }),
      h(Btn, { key: 'k', label: p.okLabel || 'Eliminar', variant: p.danger ? 'danger' : 'primary', onClick: p.onOk }),
    ],
  }, h('p', { className: 'wo-modal-msg' }, p.message));
}

// ── Vacíos y avisos ─────────────────────────────────────────────────────
function EmptyState(p) {
  return h('div', { className: 'wo-empty' },
    h('div', { className: 'wo-empty-i', 'aria-hidden': 'true' }, p.icon || '📂'),
    h('div', { className: 'wo-empty-t' }, p.title),
    p.hint ? h('div', { className: 'wo-empty-h' }, p.hint) : null,
    p.action || null);
}

/** Indicador de guardado: el usuario nunca debe dudar si su trabajo está a salvo. */
function SaveDot(p) {
  const st = p.state;
  const map = {
    idle: { t: p.lastSavedAt ? 'Guardado ' + fmtWhen(p.lastSavedAt) : 'Sin cambios', c: '' },
    pending: { t: 'Cambios sin guardar…', c: 'wo-save-pending' },
    saving: { t: 'Guardando…', c: 'wo-save-pending' },
    saved: { t: 'Guardado', c: 'wo-save-ok' },
    error: { t: 'Sin conexión: reintentando', c: 'wo-save-err' },
  };
  const it = map[st] || map.idle;
  return h('span', { className: cx('wo-save', it.c), title: it.t },
    h('span', { className: 'wo-save-dot', 'aria-hidden': 'true' }),
    h('span', { className: 'wo-save-t' },
      st === 'error' ? 'Sin conexión' : (st === 'saving' || st === 'pending' ? 'Guardando' : 'Guardado')));
}

// ── Texto con formato (marcas → elementos React, jamás HTML) ─────────────
/**
 * Gramática mínima, la misma en Documentos, Notas y Presentaciones:
 *   **negrita**  *cursiva*  ~~tachado~~  `código`  [texto](https://url)
 * Se parsea a nodos y se pinta con createElement. Al no existir un camino
 * hacia innerHTML, un archivo no puede inyectar marcado en el escritorio.
 */
const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;

function safeHref(url) {
  const u = s(url).trim();
  // Solo esquemas de navegación: nada de javascript:, data: ni vbscript:.
  return /^(https?:\/\/|mailto:)[^\s]+$/i.test(u) ? u : null;
}

function MarkText(p) {
  const text = s(p.text);
  if (!text) return null;
  const out = [];
  let last = 0; let k = 0; let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.indexOf('**') === 0) out.push(h('strong', { key: k++ }, tok.slice(2, -2)));
    else if (tok.indexOf('~~') === 0) out.push(h('s', { key: k++ }, tok.slice(2, -2)));
    else if (tok.charAt(0) === '`') out.push(h('code', { key: k++, className: 'wo-code' }, tok.slice(1, -1)));
    else if (tok.charAt(0) === '[') {
      const cut = tok.indexOf('](');
      const label = tok.slice(1, cut);
      const href = safeHref(tok.slice(cut + 2, -1));
      out.push(href
        ? h('a', { key: k++, href, target: '_blank', rel: 'noopener noreferrer nofollow', className: 'wo-link' }, label)
        : label);
    } else out.push(h('em', { key: k++ }, tok.slice(1, -1)));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return h(Fragment, null, out);
}

/** Quita las marcas: para buscar, exportar a CSV y resumir al agente. */
function plainText(text) {
  return s(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1').replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1');
}

/** Envuelve la selección de un textarea con una marca (barra de formato). */
function wrapSelection(el, before, after) {
  if (!el) return null;
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  const v = el.value;
  const sel = v.slice(start, end) || '';
  const close = after == null ? before : after;
  const next = v.slice(0, start) + before + sel + close + v.slice(end);
  const caret = start + before.length + sel.length;
  return { value: next, start: caret, end: caret };
}

// ── Descargas e impresión ───────────────────────────────────────────────
/** Descarga un texto como archivo. El nombre se sanea: nunca sale una ruta. */
function download(filename, text, mime) {
  try {
    const safe = s(filename).replace(/[^\w.\- ]+/g, '_').trim().slice(0, 120) || 'archivo';
    const blob = new Blob([s(text)], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = safe; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    return true;
  } catch (e) { notify('error', 'El navegador bloqueó la descarga.'); return false; }
}

/**
 * Impresión / "Guardar como PDF": se abre una ventana y se construye su
 * contenido **nodo a nodo** (createElement + textContent). Nada de
 * `document.write` con HTML armado a mano: el texto del usuario no se
 * interpreta jamás como marcado.
 */
function printPage(title, build) {
  let win = null;
  try { win = window.open('', '_blank', 'noopener,width=900,height=1200'); } catch (e) { win = null; }
  if (!win) { notify('warn', 'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.'); return false; }
  const d = win.document;
  d.title = s(title) || 'Kimos WorkOffice';
  const style = d.createElement('style');
  style.textContent = PRINT_CSS;
  d.head.appendChild(style);
  const root = d.createElement('div');
  root.className = 'sheet';
  d.body.appendChild(root);
  try { build(d, root); } catch (e) { root.textContent = 'No se pudo preparar la impresión.'; }
  win.focus();
  setTimeout(() => { try { win.print(); } catch (e) { /* el usuario puede imprimir a mano */ } }, 250);
  return true;
}

const PRINT_CSS = [
  '@page { margin: 18mm; }',
  'body { font: 12pt/1.6 Inter, system-ui, sans-serif; color: #111; margin: 0; padding: 24px; }',
  '.sheet { max-width: 800px; margin: 0 auto; }',
  'h1 { font-size: 22pt; margin: 0 0 12px; } h2 { font-size: 16pt; margin: 20px 0 8px; }',
  'h3 { font-size: 13pt; margin: 16px 0 6px; }',
  'p { margin: 0 0 10px; } ul, ol { margin: 0 0 10px 22px; }',
  'blockquote { margin: 0 0 10px; padding-left: 12px; border-left: 3px solid #bbb; color: #444; }',
  'pre { background: #f4f4f5; padding: 10px; border-radius: 6px; white-space: pre-wrap; font-size: 10pt; }',
  'table { border-collapse: collapse; width: 100%; font-size: 10pt; }',
  'td, th { border: 1px solid #ccc; padding: 4px 7px; text-align: left; }',
  'th { background: #f4f4f5; }',
  '.slide { page-break-after: always; border: 1px solid #ddd; border-radius: 8px; padding: 28px; margin-bottom: 18px; min-height: 380px; }',
  '.slide:last-child { page-break-after: auto; }',
  '.notes { color: #555; font-size: 10pt; border-top: 1px dashed #ccc; margin-top: 14px; padding-top: 8px; }',
].join('\n');

/** Pinta texto con formato en la ventana de impresión (sin pasar por HTML). */
function printInline(d, parent, text) {
  const t = s(text);
  let last = 0; let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(t)) !== null) {
    if (m.index > last) parent.appendChild(d.createTextNode(t.slice(last, m.index)));
    const tok = m[0];
    let el;
    if (tok.indexOf('**') === 0) { el = d.createElement('strong'); el.textContent = tok.slice(2, -2); }
    else if (tok.indexOf('~~') === 0) { el = d.createElement('s'); el.textContent = tok.slice(2, -2); }
    else if (tok.charAt(0) === '`') { el = d.createElement('code'); el.textContent = tok.slice(1, -1); }
    else if (tok.charAt(0) === '[') {
      const cut = tok.indexOf('](');
      const href = safeHref(tok.slice(cut + 2, -1));
      el = d.createElement(href ? 'a' : 'span');
      if (href) el.setAttribute('href', href);
      el.textContent = tok.slice(1, cut);
    } else { el = d.createElement('em'); el.textContent = tok.slice(1, -1); }
    parent.appendChild(el);
    last = m.index + tok.length;
  }
  if (last < t.length) parent.appendChild(d.createTextNode(t.slice(last)));
}

// ── Portapapeles ────────────────────────────────────────────────────────
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(s(text)); return true; }
  } catch (e) { /* permiso denegado: se prueba el camino viejo */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = s(text); ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

// ── Nombre de archivo editable en la barra del módulo ────────────────────
function FileTitle(p) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  useEffect(() => { setDraft(p.name); }, [p.name]);
  const commit = () => {
    setEditing(false);
    const nm = s(draft).trim().slice(0, 120);
    if (nm && nm !== p.name) p.onRename(nm); else setDraft(p.name);
  };
  if (editing) {
    return h('input', {
      className: 'wo-title-in', value: draft, autoFocus: true,
      onChange: (e) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); setDraft(p.name); setEditing(false); }
      },
      'aria-label': 'Nombre del archivo',
    });
  }
  return h('button', {
    type: 'button', className: 'wo-title', title: 'Clic para renombrar',
    onClick: () => setEditing(true),
  }, p.icon ? h('span', { 'aria-hidden': 'true' }, p.icon + ' ') : null, p.name || 'Sin título');
}

// ══════════════════════════════════════════════════════════════════════
// src/20-formula.js
// ══════════════════════════════════════════════════════════════════════
/* ══ MOTOR DE FÓRMULAS ═════════════════════════════════════════════════════
 *
 * Analizador y evaluador de fórmulas estilo Excel/Sheets, escrito a mano y sin
 * dependencias: tokenizador → parser descendente recursivo → evaluación
 * perezosa con memoria y detección de referencias circulares.
 *
 * Por qué a mano y no una librería: el bundle se sirve tal cual al navegador
 * dentro del escritorio de KIMOS (APP-SPEC §3). Traer un evaluador de terceros
 * significaría ejecutar código ajeno en la sesión del usuario y engordar el
 * bundle; el subconjunto que cubre el 99 % del uso real cabe en este archivo y
 * es auditable de una sentada.
 *
 * Nunca se usa `eval` ni `new Function`: una fórmula es datos, no código. Lo
 * peor que puede hacer una celda hostil es devolver `#VALUE!`.
 *
 * Tipos de valor que circulan por el motor:
 *   number · string · boolean
 *   { __d: n }        fecha (n = días desde 1970-01-01, hora local)
 *   { e: '#VALUE!' }  error
 *   Array<Array<v>>   rango (solo válido como argumento de función)
 */

const ERR = {
  value: '#VALUE!', div0: '#DIV/0!', name: '#NAME?', ref: '#REF!',
  num: '#NUM!', na: '#N/A', circ: '#CIRC!', parse: '#ERROR!',
};
const err = (code) => ({ e: code });
const isErr = (v) => !!(v && typeof v === 'object' && typeof v.e === 'string');
const isDate = (v) => !!(v && typeof v === 'object' && typeof v.__d === 'number');
const isRange = (v) => Array.isArray(v);
const dateVal = (days) => ({ __d: Math.round(days * 1e6) / 1e6 });

// ── Direcciones A1 ──────────────────────────────────────────────────────
const MAX_COLS = 702;    // hasta ZZ: más que suficiente y acota la memoria
const MAX_ROWS = 20000;

function colName(i) {
  let n = Math.floor(i); let out = '';
  if (n < 0) return 'A';
  do { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
}
function colIndex(name) {
  const t = s(name).toUpperCase();
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i) - 64;
    if (c < 1 || c > 26) return -1;
    n = n * 26 + c;
  }
  return n - 1;
}
const addrOf = (r, c) => colName(c) + (r + 1);
const ADDR_RE = /^\$?([A-Za-z]{1,3})\$?(\d{1,6})$/;
function parseAddr(a) {
  const m = ADDR_RE.exec(s(a).trim());
  if (!m) return null;
  const c = colIndex(m[1]); const r = parseInt(m[2], 10) - 1;
  if (c < 0 || r < 0 || c >= MAX_COLS || r >= MAX_ROWS) return null;
  return { r, c };
}

// ── Fechas ──────────────────────────────────────────────────────────────
const DAY_MS = 86400000;
/** Días locales desde 1970-01-01 (sin desfase por zona horaria). */
function daysFromDate(d) {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAY_MS);
}
function dateFromDays(n) {
  const base = new Date(1970, 0, 1);
  base.setDate(base.getDate() + Math.floor(n));
  return base;
}
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isoToDays(t) {
  const m = ISO_RE.exec(s(t).trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return null;
  return daysFromDate(d);
}
const daysToIso = (n) => isoDay(dateFromDays(n));

// ── Coerciones ──────────────────────────────────────────────────────────
const NUM_RE = /^-?(\d+([.,]\d+)?|[.,]\d+)$/;

function toNumber(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : err(ERR.num);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isDate(v)) return v.__d;
  if (isErr(v)) return v;
  if (isRange(v)) return err(ERR.value);
  const t = s(v).trim();
  if (!t) return 0;
  const iso = isoToDays(t);
  if (iso != null) return iso;
  if (/%$/.test(t) && NUM_RE.test(t.slice(0, -1).trim())) return num(t.slice(0, -1)) / 100;
  if (!NUM_RE.test(t)) return err(ERR.value);
  return num(t);
}

function toText(v) {
  if (v == null) return '';
  if (isErr(v)) return v.e;
  if (isDate(v)) return daysToIso(v.__d);
  if (typeof v === 'boolean') return v ? 'VERDADERO' : 'FALSO';
  if (typeof v === 'number') return trimNum(v);
  if (isRange(v)) return '';
  return s(v);
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (isErr(v)) return v;
  if (typeof v === 'number') return v !== 0;
  if (isDate(v)) return v.__d !== 0;
  const t = canon(v);
  if (t === 'verdadero' || t === 'true' || t === 'si' || t === 'sí') return true;
  if (t === 'falso' || t === 'false' || t === 'no' || t === '') return false;
  const n2 = toNumber(v);
  return isErr(n2) ? err(ERR.value) : n2 !== 0;
}

/** Número a texto sin ceros de más: 3 → "3", 3.5 → "3,5" (coma decimal). */
function trimNum(n) {
  if (!isFinite(n)) return '#NUM!';
  const r = Math.round(n * 1e10) / 1e10;
  return String(r).replace('.', ',');
}

// ── Tokenizador ─────────────────────────────────────────────────────────
const T = { num: 'num', str: 'str', ref: 'ref', range: 'range', name: 'name', op: 'op', open: '(', close: ')', sep: ',' };

function tokenize(src) {
  const t = s(src);
  const out = [];
  let i = 0;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isAlpha = (c) => /[A-Za-zÁÉÍÓÚÑáéíóúñ_]/.test(c);
  while (i < t.length) {
    const c = t[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '"') {                                   // "texto" con "" escapado
      let j = i + 1; let buf = '';
      while (j < t.length) {
        if (t[j] === '"') { if (t[j + 1] === '"') { buf += '"'; j += 2; continue; } break; }
        buf += t[j]; j++;
      }
      if (j >= t.length) return { error: ERR.parse };   // comilla sin cerrar
      out.push({ t: T.str, v: buf }); i = j + 1; continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(t[i + 1]))) {
      // La coma decimal se acepta SOLO entre dígitos (2,5). En cualquier otra
      // posición la coma separa argumentos, igual que el punto y coma. Es la
      // regla que hace convivir `=SUMA(A1;A2)` con `2,5` en un teclado en
      // español, sin obligar a nadie a cambiar de costumbre.
      let j = i; let dot = false;
      while (j < t.length) {
        const ch = t[j];
        if (isDigit(ch)) { j++; continue; }
        if ((ch === '.' || ch === ',') && !dot && isDigit(t[j + 1])) { dot = true; j++; continue; }
        break;
      }
      const raw = t.slice(i, j).replace(',', '.');
      const val = parseFloat(raw);
      if (!isFinite(val)) return { error: ERR.parse };
      out.push({ t: T.num, v: val }); i = j; continue;
    }
    if (isAlpha(c) || c === '$') {
      let j = i;
      while (j < t.length && /[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ_.$]/.test(t[j])) j++;
      let word = t.slice(i, j);
      // ¿A1:B9? El rango se reconoce entero para no confundirlo con dos refs.
      if (t[j] === ':' && ADDR_RE.test(word)) {
        let k = j + 1;
        while (k < t.length && /[A-Za-z0-9$]/.test(t[k])) k++;
        const b = t.slice(j + 1, k);
        if (ADDR_RE.test(b)) { out.push({ t: T.range, a: word, b }); i = k; continue; }
      }
      if (ADDR_RE.test(word) && t[j] !== '(') { out.push({ t: T.ref, v: word }); i = j; continue; }
      out.push({ t: T.name, v: word.toUpperCase() }); i = j; continue;
    }
    if (c === '(') { out.push({ t: T.open }); i++; continue; }
    if (c === ')') { out.push({ t: T.close }); i++; continue; }
    if (c === ',' || c === ';') { out.push({ t: T.sep }); i++; continue; }
    const two = t.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') { out.push({ t: T.op, v: two }); i += 2; continue; }
    if ('+-*/^&%=<>'.indexOf(c) >= 0) { out.push({ t: T.op, v: c }); i++; continue; }
    return { error: ERR.parse };
  }
  return { tokens: out };
}

// ── Parser (descendente recursivo) ──────────────────────────────────────
/*
 * Precedencia, de menor a mayor — la misma de Excel:
 *   comparación (= <> < > <= >=)  →  concatenación (&)  →  + -  →  * /
 *   →  unario + -  →  potencia (^, asociativa por la derecha)  →  % postfijo
 */
function parseFormula(src) {
  const lex = tokenize(src);
  if (lex.error) return { error: lex.error };
  const tk = lex.tokens;
  let p = 0;
  const peek = () => tk[p];
  const eat = () => tk[p++];
  let failed = null;
  const fail = (code) => { if (!failed) failed = code || ERR.parse; return { k: 'err', code: failed }; };

  function parseExpr() { return parseCmp(); }

  function parseCmp() {
    let left = parseConcat();
    while (peek() && peek().t === T.op && ['=', '<>', '<', '>', '<=', '>='].indexOf(peek().v) >= 0) {
      const op = eat().v;
      left = { k: 'bin', op, a: left, b: parseConcat() };
    }
    return left;
  }
  function parseConcat() {
    let left = parseAdd();
    while (peek() && peek().t === T.op && peek().v === '&') {
      eat();
      left = { k: 'bin', op: '&', a: left, b: parseAdd() };
    }
    return left;
  }
  function parseAdd() {
    let left = parseMul();
    while (peek() && peek().t === T.op && (peek().v === '+' || peek().v === '-')) {
      const op = eat().v;
      left = { k: 'bin', op, a: left, b: parseMul() };
    }
    return left;
  }
  function parseMul() {
    let left = parsePow();
    while (peek() && peek().t === T.op && (peek().v === '*' || peek().v === '/')) {
      const op = eat().v;
      left = { k: 'bin', op, a: left, b: parsePow() };
    }
    return left;
  }
  // El unario se resuelve ANTES que la potencia: -2^2 = 4, como Excel
  // (y a diferencia de la convención matemática, donde sería -4).
  function parsePow() {
    const base = parseUnary();
    if (peek() && peek().t === T.op && peek().v === '^') {
      eat();
      return { k: 'bin', op: '^', a: base, b: parsePow() };   // asociativa por la derecha
    }
    return base;
  }
  function parseUnary() {
    if (peek() && peek().t === T.op && (peek().v === '-' || peek().v === '+')) {
      const op = eat().v;
      return { k: 'un', op, a: parseUnary() };
    }
    return parsePostfix();
  }
  function parsePostfix() {
    let node = parsePrimary();
    while (peek() && peek().t === T.op && peek().v === '%') { eat(); node = { k: 'pct', a: node }; }
    return node;
  }
  function parsePrimary() {
    const tok = peek();
    if (!tok) return fail();
    if (tok.t === T.num) { eat(); return { k: 'num', v: tok.v }; }
    if (tok.t === T.str) { eat(); return { k: 'str', v: tok.v }; }
    if (tok.t === T.ref) { eat(); return { k: 'ref', v: tok.v }; }
    if (tok.t === T.range) { eat(); return { k: 'range', a: tok.a, b: tok.b }; }
    if (tok.t === T.open) {
      eat();
      const inner = parseExpr();
      if (!peek() || peek().t !== T.close) return fail();
      eat();
      return inner;
    }
    if (tok.t === T.name) {
      eat();
      if (peek() && peek().t === T.open) {
        eat();
        const args = [];
        if (peek() && peek().t === T.close) { eat(); return { k: 'call', name: tok.v, args }; }
        for (;;) {
          args.push(parseExpr());
          const nx = peek();
          if (!nx) return fail();
          if (nx.t === T.sep) { eat(); continue; }
          if (nx.t === T.close) { eat(); break; }
          return fail();
        }
        return { k: 'call', name: tok.v, args };
      }
      const up = tok.v;
      if (up === 'VERDADERO' || up === 'TRUE') return { k: 'bool', v: true };
      if (up === 'FALSO' || up === 'FALSE') return { k: 'bool', v: false };
      return { k: 'name', v: up };     // nombre desconocido → #NAME? al evaluar
    }
    return fail();
  }

  const ast = parseExpr();
  if (failed) return { error: failed };
  if (p < tk.length) return { error: ERR.parse };
  return { ast };
}

// ── Evaluador ───────────────────────────────────────────────────────────
/**
 * `ctx` = { get(r, c) -> valor evaluado de una celda, now: Date }.
 * `get` es responsabilidad de la hoja: es quien memoriza y detecta ciclos.
 */
function evalAst(node, ctx) {
  if (!node) return err(ERR.parse);
  switch (node.k) {
    case 'num': return node.v;
    case 'str': return node.v;
    case 'bool': return node.v;
    case 'err': return err(node.code || ERR.parse);
    case 'name': return err(ERR.name);
    case 'ref': {
      const a = parseAddr(node.v);
      if (!a) return err(ERR.ref);
      return ctx.get(a.r, a.c);
    }
    case 'range': return readRange(node, ctx);
    case 'pct': {
      const v = toNumber(evalAst(node.a, ctx));
      return isErr(v) ? v : v / 100;
    }
    case 'un': {
      const v = evalAst(node.a, ctx);
      if (isErr(v)) return v;
      const n1 = toNumber(v);
      if (isErr(n1)) return n1;
      return node.op === '-' ? -n1 : n1;
    }
    case 'bin': return evalBin(node, ctx);
    case 'call': return callFn(node, ctx);
    default: return err(ERR.parse);
  }
}

function readRange(node, ctx) {
  const a = parseAddr(node.a); const b = parseAddr(node.b);
  if (!a || !b) return err(ERR.ref);
  const r0 = Math.min(a.r, b.r); const r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c); const c1 = Math.max(a.c, b.c);
  if ((r1 - r0 + 1) * (c1 - c0 + 1) > 200000) return err(ERR.num);
  const rows = [];
  for (let r = r0; r <= r1; r++) {
    const row = [];
    for (let c = c0; c <= c1; c++) row.push(ctx.get(r, c));
    rows.push(row);
  }
  return rows;
}

function evalBin(node, ctx) {
  const a = evalAst(node.a, ctx);
  if (isErr(a)) return a;
  const b = evalAst(node.b, ctx);
  if (isErr(b)) return b;
  const op = node.op;
  if (op === '&') return toText(a) + toText(b);
  if (['=', '<>', '<', '>', '<=', '>='].indexOf(op) >= 0) return compare(a, b, op);
  const na = toNumber(a); if (isErr(na)) return na;
  const nb = toNumber(b); if (isErr(nb)) return nb;
  let out;
  if (op === '+') out = na + nb;
  else if (op === '-') out = na - nb;
  else if (op === '*') out = na * nb;
  else if (op === '/') { if (nb === 0) return err(ERR.div0); out = na / nb; }
  else if (op === '^') { out = Math.pow(na, nb); if (!isFinite(out)) return err(ERR.num); }
  else return err(ERR.parse);
  // Fecha ± número sigue siendo fecha; fecha − fecha son días (como Excel).
  if (op === '+' || op === '-') {
    const da = isDate(a); const db = isDate(b);
    if (da && db) return out;
    if (da || db) return dateVal(out);
  }
  return out;
}

function compare(a, b, op) {
  let x = a; let y = b;
  const bothNumish = (v) => typeof v === 'number' || isDate(v) || typeof v === 'boolean';
  if (bothNumish(x) || bothNumish(y)) {
    const nx = toNumber(x); const ny = toNumber(y);
    if (!isErr(nx) && !isErr(ny)) { x = nx; y = ny; }
    else { x = canon(toText(a)); y = canon(toText(b)); }
  } else { x = canon(toText(a)); y = canon(toText(b)); }
  switch (op) {
    case '=': return x === y;
    case '<>': return x !== y;
    case '<': return x < y;
    case '>': return x > y;
    case '<=': return x <= y;
    case '>=': return x >= y;
    default: return err(ERR.parse);
  }
}

/** Aplana argumentos (rangos incluidos) y aplica `fn` a cada valor. */
function eachValue(args, fn) {
  for (let i = 0; i < args.length; i++) {
    const v = args[i];
    if (isRange(v)) {
      for (let r = 0; r < v.length; r++) for (let c = 0; c < v[r].length; c++) fn(v[r][c], true);
    } else fn(v, false);
  }
}

/** Números de una lista de argumentos; el texto no numérico se ignora (como Excel). */
function numbersOf(args) {
  const out = [];
  let bad = null;
  eachValue(args, (v, fromRange) => {
    if (bad) return;
    if (isErr(v)) { bad = v; return; }
    if (v === '' || v == null) return;
    if (typeof v === 'string' && fromRange) return;      // texto dentro de un rango: se salta
    const n1 = toNumber(v);
    if (isErr(n1)) { if (!fromRange) bad = n1; return; }
    out.push(n1);
  });
  return bad || out;
}

/**
 * Normalización suave: minúsculas y sin tildes, pero **conservando la
 * puntuación**. `canon` no sirve para comodines porque borraría el `*`.
 */
const soft = (v) => s(v).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Criterio de SUMAR.SI / CONTAR.SI: ">10", "<>0", "manzana", "*ana*".
 * Devuelve un predicado sobre el valor de la celda.
 */
function criterion(spec) {
  const raw = isErr(spec) ? '' : toText(spec).trim();
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(raw);
  const op = m[1] || '=';
  const rest = m[2];
  const asNum = NUM_RE.test(rest.trim()) ? num(rest) : (isoToDays(rest.trim()) != null ? isoToDays(rest.trim()) : null);
  const hasWild = /[*?]/.test(rest) && (op === '=' || op === '<>');
  let re = null;
  if (hasWild) {
    const pattern = soft(rest).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    re = new RegExp('^' + pattern + '$');
  }
  return (v) => {
    if (isErr(v)) return false;
    if (re) { const hit = re.test(soft(toText(v))); return op === '<>' ? !hit : hit; }
    if (asNum != null) {
      const n1 = toNumber(v);
      if (isErr(n1)) return op === '<>';
      switch (op) {
        case '=': return n1 === asNum;
        case '<>': return n1 !== asNum;
        case '<': return n1 < asNum;
        case '>': return n1 > asNum;
        case '<=': return n1 <= asNum;
        case '>=': return n1 >= asNum;
        default: return false;
      }
    }
    const a = canon(toText(v)); const b = canon(rest);
    switch (op) {
      case '=': return a === b;
      case '<>': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
      default: return false;
    }
  };
}

const flat = (v) => { const out = []; eachValue([v], (x) => out.push(x)); return out; };

// ── Catálogo de funciones ───────────────────────────────────────────────
/*
 * Cada entrada: { min, max, lazy?, fn(args, ctx) }.
 * `lazy: true` recibe los NODOS sin evaluar (SI y SI.ERROR no deben evaluar la
 * rama que no corresponde, igual que en Excel).
 * Los nombres van en español y en inglés: la misma hoja funciona la copie quien
 * la copie desde Excel o desde Sheets.
 */
const FN = {};
function defFn(names, spec) { names.split(' ').forEach((n) => { FN[n] = spec; }); }

defFn('SUMA SUM', { min: 1, fn: (a) => { const n1 = numbersOf(a); return isErr(n1) ? n1 : n1.reduce((x, y) => x + y, 0); } });
defFn('PRODUCTO PRODUCT', { min: 1, fn: (a) => { const n1 = numbersOf(a); return isErr(n1) ? n1 : (n1.length ? n1.reduce((x, y) => x * y, 1) : 0); } });
defFn('PROMEDIO AVERAGE', { min: 1, fn: (a) => { const n1 = numbersOf(a); if (isErr(n1)) return n1; return n1.length ? n1.reduce((x, y) => x + y, 0) / n1.length : err(ERR.div0); } });
defFn('MIN', { min: 1, fn: (a) => { const n1 = numbersOf(a); if (isErr(n1)) return n1; return n1.length ? Math.min.apply(null, n1) : 0; } });
defFn('MAX', { min: 1, fn: (a) => { const n1 = numbersOf(a); if (isErr(n1)) return n1; return n1.length ? Math.max.apply(null, n1) : 0; } });
defFn('CONTAR COUNT', { min: 1, fn: (a) => { const n1 = numbersOf(a); return isErr(n1) ? n1 : n1.length; } });
defFn('CONTARA COUNTA', {
  min: 1,
  fn: (a) => { let n1 = 0; eachValue(a, (v) => { if (v !== '' && v != null && !(typeof v === 'string' && !v)) n1++; }); return n1; },
});
defFn('CONTAR.BLANCO COUNTBLANK', {
  min: 1,
  fn: (a) => { let n1 = 0; eachValue(a, (v) => { if (v === '' || v == null) n1++; }); return n1; },
});
defFn('MEDIANA MEDIAN', {
  min: 1,
  fn: (a) => {
    const n1 = numbersOf(a); if (isErr(n1)) return n1;
    if (!n1.length) return err(ERR.num);
    const x = n1.slice().sort((p, q) => p - q); const mid = Math.floor(x.length / 2);
    return x.length % 2 ? x[mid] : (x[mid - 1] + x[mid]) / 2;
  },
});
defFn('DESVEST STDEV', {
  min: 1,
  fn: (a) => {
    const n1 = numbersOf(a); if (isErr(n1)) return n1;
    if (n1.length < 2) return err(ERR.div0);
    const mu = n1.reduce((x, y) => x + y, 0) / n1.length;
    return Math.sqrt(n1.reduce((acc, v) => acc + (v - mu) * (v - mu), 0) / (n1.length - 1));
  },
});
defFn('ABS', { min: 1, max: 1, fn: (a) => { const n1 = toNumber(a[0]); return isErr(n1) ? n1 : Math.abs(n1); } });
defFn('ENTERO INT', { min: 1, max: 1, fn: (a) => { const n1 = toNumber(a[0]); return isErr(n1) ? n1 : Math.floor(n1); } });
defFn('RAIZ SQRT', { min: 1, max: 1, fn: (a) => { const n1 = toNumber(a[0]); if (isErr(n1)) return n1; return n1 < 0 ? err(ERR.num) : Math.sqrt(n1); } });
defFn('POTENCIA POWER', {
  min: 2, max: 2,
  fn: (a) => {
    const x = toNumber(a[0]); if (isErr(x)) return x;
    const y = toNumber(a[1]); if (isErr(y)) return y;
    const out = Math.pow(x, y);
    return isFinite(out) ? out : err(ERR.num);
  },
});
defFn('RESIDUO MOD', {
  min: 2, max: 2,
  fn: (a) => {
    const x = toNumber(a[0]); if (isErr(x)) return x;
    const y = toNumber(a[1]); if (isErr(y)) return y;
    if (y === 0) return err(ERR.div0);
    return x - y * Math.floor(x / y);
  },
});
/**
 * Corre la coma `digits` posiciones usando la notación exponencial del propio
 * número. Multiplicar por 10^n arrastra el error binario y hace que
 * REDONDEAR(1,005;2) devuelva 1 en vez de 1,01 — que es justo el error que un
 * usuario detecta al primer día de trabajo con precios.
 */
function shiftDecimal(n1, digits) {
  if (!isFinite(n1) || n1 === 0) return n1;
  const parts = String(n1).split('e');
  const exp = (parts[1] ? Number(parts[1]) : 0) + digits;
  const out = Number(parts[0] + 'e' + exp);
  return isFinite(out) ? out : n1 * Math.pow(10, digits);
}
function roundTo(n1, digits, mode) {
  const d = Math.max(-10, Math.min(10, Math.floor(digits || 0)));
  const x = shiftDecimal(n1, d);
  const r = mode === 'up' ? (x < 0 ? Math.floor(x) : Math.ceil(x))
    : mode === 'down' ? (x < 0 ? Math.ceil(x) : Math.floor(x))
      // Redondeo comercial: 2,5 → 3 y −2,5 → −3 (JS daría −2).
      : (x < 0 ? -Math.round(-x) : Math.round(x));
  return shiftDecimal(r, -d);
}
defFn('REDONDEAR ROUND', { min: 1, max: 2, fn: (a) => wrapRound(a, 'half') });
defFn('REDONDEAR.MAS ROUNDUP', { min: 1, max: 2, fn: (a) => wrapRound(a, 'up') });
defFn('REDONDEAR.MENOS ROUNDDOWN', { min: 1, max: 2, fn: (a) => wrapRound(a, 'down') });
function wrapRound(a, mode) {
  const n1 = toNumber(a[0]); if (isErr(n1)) return n1;
  const d = a.length > 1 ? toNumber(a[1]) : 0; if (isErr(d)) return d;
  return roundTo(n1, d, mode);
}
defFn('SUMAPRODUCTO SUMPRODUCT', {
  min: 2,
  fn: (a) => {
    const cols = a.map((v) => flat(v).map(toNumber));
    for (const col of cols) for (const v of col) if (isErr(v)) return v;
    const len = cols[0].length;
    if (cols.some((c) => c.length !== len)) return err(ERR.value);
    let total = 0;
    for (let i = 0; i < len; i++) { let p = 1; for (const c of cols) p *= c[i]; total += p; }
    return total;
  },
});

// Lógica
defFn('SI IF', {
  min: 2, max: 3, lazy: true,
  fn: (nodes, ctx) => {
    const cond = toBool(evalAst(nodes[0], ctx));
    if (isErr(cond)) return cond;
    if (cond) return evalAst(nodes[1], ctx);
    return nodes.length > 2 ? evalAst(nodes[2], ctx) : false;
  },
});
defFn('SI.ERROR IFERROR', {
  min: 2, max: 2, lazy: true,
  fn: (nodes, ctx) => {
    const v = evalAst(nodes[0], ctx);
    return isErr(v) ? evalAst(nodes[1], ctx) : v;
  },
});
defFn('Y AND', {
  min: 1,
  fn: (a) => {
    let out = true; let bad = null;
    eachValue(a, (v) => { if (bad) return; const b = toBool(v); if (isErr(b)) { bad = b; return; } if (!b) out = false; });
    return bad || out;
  },
});
defFn('O OR', {
  min: 1,
  fn: (a) => {
    let out = false; let bad = null;
    eachValue(a, (v) => { if (bad) return; const b = toBool(v); if (isErr(b)) { bad = b; return; } if (b) out = true; });
    return bad || out;
  },
});
defFn('NO NOT', { min: 1, max: 1, fn: (a) => { const b = toBool(a[0]); return isErr(b) ? b : !b; } });
defFn('ESERROR ISERROR', { min: 1, max: 1, lazy: true, fn: (n1, ctx) => isErr(evalAst(n1[0], ctx)) });
defFn('ESNUMERO ISNUMBER', { min: 1, max: 1, fn: (a) => typeof a[0] === 'number' || isDate(a[0]) });
defFn('ESTEXTO ISTEXT', { min: 1, max: 1, fn: (a) => typeof a[0] === 'string' && a[0] !== '' });
defFn('ESBLANCO ISBLANK', { min: 1, max: 1, fn: (a) => a[0] === '' || a[0] == null });

// Condicionales sobre rangos
function pairRangeCriteria(range, spec, sumRange) {
  const cells = isRange(range) ? range : [[range]];
  const test = criterion(spec);
  const target = sumRange === undefined ? null : (isRange(sumRange) ? sumRange : [[sumRange]]);
  const hits = [];
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!test(cells[r][c])) continue;
      if (!target) { hits.push(cells[r][c]); continue; }
      const row = target[r] || [];
      hits.push(row[c] === undefined ? '' : row[c]);
    }
  }
  return hits;
}
defFn('CONTAR.SI COUNTIF', { min: 2, max: 2, fn: (a) => pairRangeCriteria(a[0], a[1]).length });
defFn('SUMAR.SI SUMIF', {
  min: 2, max: 3,
  fn: (a) => {
    const hits = pairRangeCriteria(a[0], a[1], a.length > 2 ? a[2] : undefined);
    const n1 = numbersOf([[hits]]);
    return isErr(n1) ? n1 : n1.reduce((x, y) => x + y, 0);
  },
});
defFn('PROMEDIO.SI AVERAGEIF', {
  min: 2, max: 3,
  fn: (a) => {
    const hits = pairRangeCriteria(a[0], a[1], a.length > 2 ? a[2] : undefined);
    const n1 = numbersOf([[hits]]);
    if (isErr(n1)) return n1;
    return n1.length ? n1.reduce((x, y) => x + y, 0) / n1.length : err(ERR.div0);
  },
});

// Búsqueda
defFn('BUSCARV VLOOKUP', {
  min: 3, max: 4,
  fn: (a) => {
    const table = isRange(a[1]) ? a[1] : null;
    if (!table) return err(ERR.value);
    const colIdx = toNumber(a[2]); if (isErr(colIdx)) return colIdx;
    if (colIdx < 1 || colIdx > (table[0] || []).length) return err(ERR.ref);
    const exact = a.length > 3 ? !toBool(a[3]) : true;
    const key = a[0];
    const keyTxt = canon(toText(key));
    const keyNum = toNumber(key);
    let best = null;
    for (let r = 0; r < table.length; r++) {
      const cell = table[r][0];
      if (exact) {
        const same = (!isErr(keyNum) && !isErr(toNumber(cell)) && typeof cell !== 'string')
          ? toNumber(cell) === keyNum : canon(toText(cell)) === keyTxt;
        if (same) return table[r][colIdx - 1];
      } else {
        const cn = toNumber(cell);
        if (!isErr(cn) && !isErr(keyNum) && cn <= keyNum) best = table[r][colIdx - 1];
      }
    }
    return best === null ? err(ERR.na) : best;
  },
});
defFn('COINCIDIR MATCH', {
  min: 2, max: 3,
  fn: (a) => {
    const list = flat(a[1]);
    const keyTxt = canon(toText(a[0]));
    for (let i = 0; i < list.length; i++) if (canon(toText(list[i])) === keyTxt) return i + 1;
    return err(ERR.na);
  },
});
defFn('INDICE INDEX', {
  min: 2, max: 3,
  fn: (a) => {
    const table = isRange(a[0]) ? a[0] : [[a[0]]];
    const r = toNumber(a[1]); if (isErr(r)) return r;
    const c = a.length > 2 ? toNumber(a[2]) : 1; if (isErr(c)) return c;
    const row = table[Math.floor(r) - 1];
    if (!row) return err(ERR.ref);
    const v = row[Math.floor(c) - 1];
    return v === undefined ? err(ERR.ref) : v;
  },
});

// Texto
defFn('CONCATENAR CONCAT CONCATENATE', {
  min: 1,
  fn: (a) => { let out = ''; eachValue(a, (v) => { if (isErr(v)) return; out += toText(v); }); return out; },
});
defFn('IZQUIERDA LEFT', { min: 1, max: 2, fn: (a) => cut(a, 'l') });
defFn('DERECHA RIGHT', { min: 1, max: 2, fn: (a) => cut(a, 'r') });
function cut(a, side) {
  const t = toText(a[0]);
  const n1 = a.length > 1 ? toNumber(a[1]) : 1;
  if (isErr(n1)) return n1;
  if (n1 < 0) return err(ERR.value);
  return side === 'l' ? t.slice(0, Math.floor(n1)) : (n1 === 0 ? '' : t.slice(-Math.floor(n1)));
}
defFn('EXTRAE MID', {
  min: 3, max: 3,
  fn: (a) => {
    const t = toText(a[0]);
    const start = toNumber(a[1]); if (isErr(start)) return start;
    const len = toNumber(a[2]); if (isErr(len)) return len;
    if (start < 1 || len < 0) return err(ERR.value);
    return t.substr(Math.floor(start) - 1, Math.floor(len));
  },
});
defFn('LARGO LEN', { min: 1, max: 1, fn: (a) => toText(a[0]).length });
defFn('MAYUSC UPPER', { min: 1, max: 1, fn: (a) => toText(a[0]).toUpperCase() });
defFn('MINUSC LOWER', { min: 1, max: 1, fn: (a) => toText(a[0]).toLowerCase() });
defFn('NOMPROPIO PROPER', {
  min: 1, max: 1,
  fn: (a) => toText(a[0]).toLowerCase().replace(/(^|[\s-])(\S)/g, (m0, p1, p2) => p1 + p2.toUpperCase()),
});
defFn('ESPACIOS TRIM', { min: 1, max: 1, fn: (a) => toText(a[0]).replace(/\s+/g, ' ').trim() });
defFn('REPETIR REPT', {
  min: 2, max: 2,
  fn: (a) => {
    const n1 = toNumber(a[1]); if (isErr(n1)) return n1;
    const times = Math.floor(n1);
    if (times < 0 || times > 5000) return err(ERR.value);
    return toText(a[0]).repeat(times);
  },
});
defFn('SUSTITUIR SUBSTITUTE', {
  min: 3, max: 3,
  fn: (a) => {
    const t = toText(a[0]); const from = toText(a[1]);
    if (!from) return t;
    return t.split(from).join(toText(a[2]));
  },
});
defFn('HALLAR SEARCH FIND', {
  min: 2, max: 3,
  fn: (a) => {
    const needle = canon(toText(a[0]));
    const hay = canon(toText(a[1]));
    const from = a.length > 2 ? Math.max(0, Math.floor(toNumber(a[2])) - 1) : 0;
    const i = hay.indexOf(needle, from);
    return i < 0 ? err(ERR.na) : i + 1;
  },
});
defFn('VALOR VALUE', { min: 1, max: 1, fn: (a) => toNumber(a[0]) });
defFn('TEXTO TEXT', {
  min: 1, max: 2,
  fn: (a) => {
    const v = a[0];
    const fmt = canon(a.length > 1 ? toText(a[1]) : '');
    if (fmt.indexOf('fecha') >= 0 || fmt === 'dd mm yyyy' || fmt === 'yyyy mm dd') {
      const n1 = toNumber(v); return isErr(n1) ? n1 : fmtDay(daysToIso(n1));
    }
    if (fmt.indexOf('0 00') >= 0 || fmt.indexOf('miles') >= 0) {
      const n1 = toNumber(v); return isErr(n1) ? n1 : groupNum(n1, 2);
    }
    if (fmt.indexOf('%') >= 0 || fmt.indexOf('porcentaje') >= 0) {
      const n1 = toNumber(v); return isErr(n1) ? n1 : trimNum(roundTo(n1 * 100, 2, 'half')) + '%';
    }
    return toText(v);
  },
});

// Fechas
defFn('HOY TODAY', { min: 0, max: 0, fn: (a, ctx) => dateVal(daysFromDate(ctx.now)) });
defFn('AHORA NOW', {
  min: 0, max: 0,
  fn: (a, ctx) => dateVal(daysFromDate(ctx.now)
    + (ctx.now.getHours() * 3600 + ctx.now.getMinutes() * 60) / 86400),
});
defFn('FECHA DATE', {
  min: 3, max: 3,
  fn: (a) => {
    const y = toNumber(a[0]); if (isErr(y)) return y;
    const mo = toNumber(a[1]); if (isErr(mo)) return mo;
    const d = toNumber(a[2]); if (isErr(d)) return d;
    const dt = new Date(Math.floor(y), Math.floor(mo) - 1, Math.floor(d));
    if (isNaN(dt.getTime())) return err(ERR.num);
    return dateVal(daysFromDate(dt));
  },
});
function datePart(v, part) {
  const n1 = toNumber(v); if (isErr(n1)) return n1;
  const d = dateFromDays(n1);
  if (part === 'y') return d.getFullYear();
  if (part === 'm') return d.getMonth() + 1;
  if (part === 'd') return d.getDate();
  return d.getDay() + 1;                       // DIASEM: domingo = 1, como Excel
}
defFn('ANO AÑO YEAR', { min: 1, max: 1, fn: (a) => datePart(a[0], 'y') });
defFn('MES MONTH', { min: 1, max: 1, fn: (a) => datePart(a[0], 'm') });
defFn('DIA DAY', { min: 1, max: 1, fn: (a) => datePart(a[0], 'd') });
defFn('DIASEM WEEKDAY', { min: 1, max: 2, fn: (a) => datePart(a[0], 'w') });
defFn('DIAS DAYS', {
  min: 2, max: 2,
  fn: (a) => {
    const x = toNumber(a[0]); if (isErr(x)) return x;
    const y = toNumber(a[1]); if (isErr(y)) return y;
    return x - y;
  },
});

function callFn(node, ctx) {
  const spec = FN[node.name];
  if (!spec) return err(ERR.name);
  const n1 = node.args.length;
  if (n1 < (spec.min || 0)) return err(ERR.value);
  if (spec.max != null && n1 > spec.max) return err(ERR.value);
  if (spec.lazy) return spec.fn(node.args, ctx);
  const args = [];
  for (let i = 0; i < node.args.length; i++) {
    const v = evalAst(node.args[i], ctx);
    if (isErr(v) && node.name !== 'ESERROR') return v;
    args.push(v);
  }
  try { return spec.fn(args, ctx); } catch (e) { return err(ERR.value); }
}

/** Nombres de función disponibles, para la ayuda y el autocompletado. */
const FN_NAMES = Object.keys(FN).sort();

// ── Hoja: evaluación perezosa con memoria y ciclos ──────────────────────
/**
 * `cells` es un mapa plano `{ "A1": { v: "=SUMA(B1:B9)" }, … }`.
 * Devuelve `{ get(r,c), values }`: se evalúa solo lo que se pide (una hoja de
 * 50 000 celdas con 12 visibles no recalcula 50 000).
 */
function makeSheetEval(cells, opts) {
  const now = (opts && opts.now) || new Date();
  const memo = new Map();
  const visiting = new Set();
  const asts = new Map();

  function rawAt(r, c) {
    const cell = cells[addrOf(r, c)];
    return cell ? cell.v : '';
  }

  /** Literal de celda: número, booleano, fecha ISO o texto. */
  function literal(raw) {
    if (raw == null) return '';
    if (typeof raw === 'number') return raw;
    const t = s(raw).trim();
    if (!t) return '';
    if (NUM_RE.test(t)) return num(t);
    if (/^-?[\d.,]+%$/.test(t)) return num(t);
    const iso = isoToDays(t);
    if (iso != null) return dateVal(iso);
    const cn = canon(t);
    if (cn === 'verdadero' || cn === 'true') return true;
    if (cn === 'falso' || cn === 'false') return false;
    return s(raw);
  }

  function get(r, c) {
    if (r < 0 || c < 0) return err(ERR.ref);
    const key = r + ':' + c;
    if (memo.has(key)) return memo.get(key);
    if (visiting.has(key)) return err(ERR.circ);       // A1 = A1 + 1
    const raw = rawAt(r, c);
    const t = typeof raw === 'string' ? raw : s(raw);
    if (t.charAt(0) !== '=') {
      const v = literal(raw);
      memo.set(key, v);
      return v;
    }
    visiting.add(key);
    let out;
    try {
      let parsed = asts.get(key);
      if (!parsed) { parsed = parseFormula(t.slice(1)); asts.set(key, parsed); }
      out = parsed.error ? err(parsed.error) : evalAst(parsed.ast, ctx);
      if (isRange(out)) out = err(ERR.value);          // un rango no es un valor de celda
    } catch (e) {
      out = err(ERR.value);
    }
    visiting.delete(key);
    memo.set(key, out);
    return out;
  }

  const ctx = { get, now };
  return { get, ctx, addr: (a) => { const p = parseAddr(a); return p ? get(p.r, p.c) : err(ERR.ref); } };
}

// ── Presentación de valores ─────────────────────────────────────────────
const CURRENCY = {
  CLP: { sym: '$', dec: 0 }, USD: { sym: 'US$', dec: 2 }, EUR: { sym: '€', dec: 2 },
  MXN: { sym: 'MX$', dec: 2 }, COP: { sym: 'CO$', dec: 0 }, ARS: { sym: 'AR$', dec: 2 },
};

/** Miles con punto y decimales con coma (convención es-CL/es-ES). */
function groupNum(n1, dec) {
  if (!isFinite(n1)) return '#NUM!';
  const neg = n1 < 0;
  const fixed = Math.abs(n1).toFixed(Math.max(0, Math.min(10, dec)));
  const parts = fixed.split('.');
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + int + (parts[1] ? ',' + parts[1] : '');
}

/**
 * Texto que se pinta en la celda. `fmt`:
 *   '' (auto) · 'number' · 'money' · 'percent' · 'date' · 'text'
 */
function formatValue(v, fmt, currency) {
  if (isErr(v)) return v.e;
  if (v === '' || v == null) return '';
  if (fmt === 'text') return toText(v);
  if (fmt === 'date') {
    const n1 = toNumber(v);
    return isErr(n1) ? toText(v) : fmtDay(daysToIso(n1));
  }
  if (fmt === 'percent') {
    const n1 = toNumber(v);
    return isErr(n1) ? toText(v) : groupNum(n1 * 100, decimalsOf(n1 * 100, 2)) + '%';
  }
  if (fmt === 'money') {
    const n1 = toNumber(v);
    if (isErr(n1)) return toText(v);
    const cur = CURRENCY[currency] || CURRENCY.CLP;
    return cur.sym + ' ' + groupNum(n1, cur.dec);
  }
  if (fmt === 'number') {
    const n1 = toNumber(v);
    return isErr(n1) ? toText(v) : groupNum(n1, decimalsOf(n1, 2));
  }
  // Automático: las fechas se ven como fecha, los números con miles.
  if (isDate(v)) return fmtDay(daysToIso(v.__d));
  if (typeof v === 'number') return groupNum(v, decimalsOf(v, 4));
  return toText(v);
}
/** Decimales que hay que mostrar (sin inventar ceros). */
function decimalsOf(n1, max) {
  if (!isFinite(n1)) return 0;
  const r = Math.abs(n1 - Math.round(n1));
  if (r < 1e-10) return 0;
  const t = String(Math.round(n1 * Math.pow(10, max)) / Math.pow(10, max));
  const dot = t.indexOf('.');
  return dot < 0 ? 0 : Math.min(max, t.length - dot - 1);
}

/** ¿La celda se alinea a la derecha? (números y fechas, como toda hoja). */
const isNumericValue = (v) => typeof v === 'number' || isDate(v) || typeof v === 'boolean';

// ── Reescritura de referencias (copiar/pegar, insertar y borrar filas) ──
/**
 * Recorre una fórmula y sustituye cada referencia con `mapFn(r, c, absR, absC)`.
 * Trabaja sobre los tokens, no con expresiones regulares sueltas, para no tocar
 * lo que va dentro de un texto entre comillas.
 */
function rewriteRefs(formula, mapFn) {
  const t = s(formula);
  if (t.charAt(0) !== '=') return t;
  const lex = tokenize(t.slice(1));
  if (lex.error) return t;
  let out = '=';
  for (const tok of lex.tokens) {
    if (tok.t === T.ref) out += mapRef(tok.v, mapFn);
    else if (tok.t === T.range) out += mapRef(tok.a, mapFn) + ':' + mapRef(tok.b, mapFn);
    else if (tok.t === T.str) out += '"' + tok.v.replace(/"/g, '""') + '"';
    else if (tok.t === T.num) out += String(tok.v);
    else if (tok.t === T.name) out += tok.v;
    else if (tok.t === T.open) out += '(';
    else if (tok.t === T.close) out += ')';
    else if (tok.t === T.sep) out += ';';
    else out += tok.v;
  }
  return out;
}
function mapRef(ref, mapFn) {
  const raw = s(ref);
  const absC = raw.indexOf('$') === 0;
  const absR = /\$\d/.test(raw);
  const a = parseAddr(raw);
  if (!a) return raw;
  const next = mapFn(a.r, a.c, absR, absC);
  if (next === null) return ERR.ref;
  return (absC ? '$' : '') + colName(next.c) + (absR ? '$' : '') + (next.r + 1);
}
/** Desplaza las referencias relativas: rellenar y pegar en otra posición. */
function shiftFormula(formula, dr, dc) {
  return rewriteRefs(formula, (r, c, absR, absC) => {
    const nr = absR ? r : r + dr;
    const nc = absC ? c : c + dc;
    if (nr < 0 || nc < 0) return null;
    return { r: nr, c: nc };
  });
}

// ══════════════════════════════════════════════════════════════════════
// src/30-sheets.js
// ══════════════════════════════════════════════════════════════════════
/* ══ HOJA DE CÁLCULO ═══════════════════════════════════════════════════════
 *
 * Grilla virtualizada + barra de fórmulas + varias hojas por archivo.
 *
 * Ideas tomadas de los repositorios de referencia (ver docs/INVESTIGACION-UX.md):
 *   · **ReactGrid** — la grilla no monta 20 000 filas: pinta solo la ventana
 *     visible y reserva el alto restante con un espaciador. Mover el foco con
 *     las flechas no vuelve a montar nada.
 *   · **Univer** — separación estricta entre *documento* (celdas y estilos),
 *     *motor* (fórmulas, en src/20-formula.js) y *vista*. El documento es JSON
 *     plano y serializable, así que guardar, deshacer, exportar y el agente IA
 *     usan exactamente el mismo camino.
 *
 * Ninguno de los dos se empaqueta como dependencia: el bundle debe seguir
 * siendo autocontenido y usar el React del host (APP-SPEC §3).
 */

const COL_W = 108;        // ancho por defecto de columna
const ROW_H = 28;         // alto de fila (24 en modo compacto)
const ROW_H_DENSE = 24;
const HEAD_H = 30;        // alto de la fila de encabezados
const ROWNUM_W = 54;      // ancho de la columna de números de fila
const DEFAULT_COLS = 26;  // A…Z
const DEFAULT_ROWS = 200;
const OVERSCAN = 6;       // filas de más, arriba y abajo, para que no parpadee

const CELL_FORMATS = [
  { value: '', label: 'Automático' },
  { value: 'number', label: 'Número' },
  { value: 'money', label: 'Moneda' },
  { value: 'percent', label: 'Porcentaje' },
  { value: 'date', label: 'Fecha' },
  { value: 'text', label: 'Texto' },
];

// ── Documento ───────────────────────────────────────────────────────────
function newSheet(name) {
  return { id: uid('sh'), name: s(name) || 'Hoja 1', cells: {}, cols: {}, rows: DEFAULT_ROWS, ncols: DEFAULT_COLS };
}
function newSheetDoc() { return { sheets: [newSheet('Hoja 1')], active: 0 }; }

/** Normaliza un documento venga de donde venga (archivo viejo, importación, agente). */
function sheetDoc(data) {
  const d = data && typeof data === 'object' ? data : {};
  let sheets = Array.isArray(d.sheets) ? d.sheets : [];
  sheets = sheets.filter((x) => x && typeof x === 'object').map((x, i) => ({
    id: s(x.id) || uid('sh'),
    name: s(x.name) || 'Hoja ' + (i + 1),
    cells: x.cells && typeof x.cells === 'object' ? x.cells : {},
    cols: x.cols && typeof x.cols === 'object' ? x.cols : {},
    rows: Math.max(1, Math.min(MAX_ROWS, Math.floor(num(x.rows, DEFAULT_ROWS)) || DEFAULT_ROWS)),
    ncols: Math.max(1, Math.min(MAX_COLS, Math.floor(num(x.ncols, DEFAULT_COLS)) || DEFAULT_COLS)),
  }));
  if (!sheets.length) sheets = [newSheet('Hoja 1')];
  const active = Math.max(0, Math.min(sheets.length - 1, Math.floor(num(d.active, 0))));
  return { sheets, active };
}

const cellAt = (sheet, r, c) => sheet.cells[addrOf(r, c)] || null;
const rawAt = (sheet, r, c) => { const x = cellAt(sheet, r, c); return x ? s(x.v) : ''; };

/** Escribe celdas y devuelve una hoja nueva (sin mutar la anterior). */
function withCells(sheet, changes) {
  const cells = Object.assign({}, sheet.cells);
  let maxR = sheet.rows; let maxC = sheet.ncols;
  Object.keys(changes).forEach((addr) => {
    const next = changes[addr];
    if (next == null || (!s(next.v) && !next.f && !next.b && !next.i && !next.a)) delete cells[addr];
    else cells[addr] = next;
    const at = parseAddr(addr);
    if (at) { if (at.r + 1 > maxR) maxR = at.r + 1; if (at.c + 1 > maxC) maxC = at.c + 1; }
  });
  return Object.assign({}, sheet, {
    cells,
    rows: Math.min(MAX_ROWS, maxR),
    ncols: Math.min(MAX_COLS, maxC),
  });
}

/** Une el valor nuevo con el estilo existente de la celda. */
function mergeCell(prev, patch) {
  const next = Object.assign({}, prev || {}, patch);
  Object.keys(next).forEach((k) => {
    if (next[k] === '' && k !== 'v') delete next[k];
    if (next[k] === false) delete next[k];
  });
  if (!s(next.v)) delete next.v;
  return next;
}

// ── Selección ───────────────────────────────────────────────────────────
const normSel = (sel) => ({
  r1: Math.min(sel.r1, sel.r2), r2: Math.max(sel.r1, sel.r2),
  c1: Math.min(sel.c1, sel.c2), c2: Math.max(sel.c1, sel.c2),
});
const inSel = (sel, r, c) => { const n1 = normSel(sel); return r >= n1.r1 && r <= n1.r2 && c >= n1.c1 && c <= n1.c2; };
const selSize = (sel) => { const n1 = normSel(sel); return (n1.r2 - n1.r1 + 1) * (n1.c2 - n1.c1 + 1); };

// ── CSV ─────────────────────────────────────────────────────────────────
/** Analizador CSV/TSV tolerante: comillas, saltos dentro de celda y CRLF. */
function parseDelimited(text, delim) {
  const t = s(text).replace(/\r\n?/g, '\n');
  const rows = [];
  let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
      continue;
    }
    if (c === '"' && !cell) { quoted = true; continue; }
    if (c === delim) { row.push(cell); cell = ''; continue; }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
/** Adivina el separador mirando la primera línea (coma, punto y coma o tabulador). */
function guessDelim(text) {
  const line = s(text).split(/\r?\n/)[0] || '';
  const count = (ch) => (line.split(ch).length - 1);
  const tab = count('\t'); const semi = count(';'); const comma = count(',');
  if (tab >= semi && tab >= comma && tab > 0) return '\t';
  return semi > comma ? ';' : ',';
}
function toCsvCell(v) {
  const t = s(v);
  return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

// ── Deshacer (por archivo, en memoria) ──────────────────────────────────
const undoStacks = new Map();   // fileId -> { undo: [], redo: [] }
const UNDO_MAX = 80;
function undoStack(fileId) {
  if (!undoStacks.has(fileId)) undoStacks.set(fileId, { undo: [], redo: [] });
  return undoStacks.get(fileId);
}
function pushUndo(fileId, entry) {
  const st = undoStack(fileId);
  st.undo.push(entry);
  if (st.undo.length > UNDO_MAX) st.undo.shift();
  st.redo.length = 0;
}

// ── Editor ──────────────────────────────────────────────────────────────
function SheetEditor(p) {
  const file = p.file;
  const cfg = p.cfg || {};
  const doc = useMemo(() => sheetDoc(file.data), [file.data]);
  const si = Math.min(doc.active, doc.sheets.length - 1);
  const sheet = doc.sheets[si];
  const rowH = cfg.dense ? ROW_H_DENSE : ROW_H;

  const [sel, setSel] = useState({ r1: 0, c1: 0, r2: 0, c2: 0 });
  const [editing, setEditing] = useState(null);     // { r, c, value, fromBar }
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);
  const [resizing, setResizing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState(null);
  const scroller = useRef(null);
  const editorRef = useRef(null);
  const clip = useRef(null);                        // portapapeles interno (con fórmulas)

  const evalSheet = useMemo(() => makeSheetEval(sheet.cells, { now: new Date() }), [sheet.cells]);
  const colW = (c) => Math.max(48, Math.floor(num(sheet.cols[c], COL_W) || COL_W));
  const totalW = useMemo(() => {
    let w = 0;
    for (let c = 0; c < sheet.ncols; c++) w += colW(c);
    return w;
  }, [sheet.cols, sheet.ncols]);

  // Ventana visible: solo estas filas se montan (ReactGrid §docs).
  const first = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const visible = Math.ceil(viewport / rowH) + OVERSCAN * 2;
  const last = Math.min(sheet.rows - 1, first + visible);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const measure = () => setViewport(el.clientHeight || 600);
    measure();
    let ro = null;
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(measure); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, []);

  // ── Escritura ─────────────────────────────────────────────────────────
  const commitDoc = (nextDoc, undoEntry) => {
    if (undoEntry) pushUndo(file.id, undoEntry);
    patchFile(file.id, { data: nextDoc });
  };
  const replaceSheet = (nextSheet, undoEntry) => {
    const sheets = doc.sheets.slice();
    sheets[si] = nextSheet;
    commitDoc({ sheets, active: si }, undoEntry);
  };

  /** Aplica un mapa `{A1: cellOrNull}` guardando el inverso para deshacer. */
  const applyChanges = (changes) => {
    const before = {};
    Object.keys(changes).forEach((a) => { before[a] = sheet.cells[a] ? Object.assign({}, sheet.cells[a]) : null; });
    replaceSheet(withCells(sheet, changes), { sheetId: sheet.id, cells: before });
  };

  const setCellValue = (r, c, value) => {
    const addr = addrOf(r, c);
    applyChanges({ [addr]: mergeCell(sheet.cells[addr], { v: s(value) }) });
  };

  const styleSelection = (patch) => {
    const n1 = normSel(sel);
    const changes = {};
    for (let r = n1.r1; r <= n1.r2; r++) {
      for (let c = n1.c1; c <= n1.c2; c++) {
        const addr = addrOf(r, c);
        const prev = sheet.cells[addr];
        if (!prev && !s(patch.v)) {
          const only = Object.keys(patch).every((k) => !patch[k]);
          if (only) continue;
        }
        changes[addr] = mergeCell(prev, patch);
      }
    }
    if (Object.keys(changes).length) applyChanges(changes);
  };

  const toggleStyle = (key) => {
    const n1 = normSel(sel);
    const cur = cellAt(sheet, n1.r1, n1.c1);
    const on = !!(cur && cur[key]);
    styleSelection({ [key]: !on });
  };

  const clearSelection = () => {
    const n1 = normSel(sel);
    const changes = {};
    for (let r = n1.r1; r <= n1.r2; r++) {
      for (let c = n1.c1; c <= n1.c2; c++) {
        const addr = addrOf(r, c);
        if (sheet.cells[addr]) changes[addr] = mergeCell(sheet.cells[addr], { v: '' });
      }
    }
    if (Object.keys(changes).length) applyChanges(changes);
  };

  const undo = () => {
    const st = undoStack(file.id);
    const entry = st.undo.pop();
    if (!entry) { notify('info', 'No hay nada que deshacer.'); return; }
    const idx = doc.sheets.findIndex((x) => x.id === entry.sheetId);
    if (idx < 0) return;
    const target = doc.sheets[idx];
    const redo = {};
    Object.keys(entry.cells).forEach((a) => { redo[a] = target.cells[a] ? Object.assign({}, target.cells[a]) : null; });
    st.redo.push({ sheetId: entry.sheetId, cells: redo });
    const sheets = doc.sheets.slice();
    sheets[idx] = withCells(target, entry.cells);
    patchFile(file.id, { data: { sheets, active: doc.active } });
  };
  const redo = () => {
    const st = undoStack(file.id);
    const entry = st.redo.pop();
    if (!entry) return;
    const idx = doc.sheets.findIndex((x) => x.id === entry.sheetId);
    if (idx < 0) return;
    const target = doc.sheets[idx];
    const back = {};
    Object.keys(entry.cells).forEach((a) => { back[a] = target.cells[a] ? Object.assign({}, target.cells[a]) : null; });
    st.undo.push({ sheetId: entry.sheetId, cells: back });
    const sheets = doc.sheets.slice();
    sheets[idx] = withCells(target, entry.cells);
    patchFile(file.id, { data: { sheets, active: doc.active } });
  };

  // ── Filas y columnas ──────────────────────────────────────────────────
  /**
   * Insertar o borrar mueve las celdas Y reescribe las fórmulas para que
   * sigan apuntando a lo mismo. Sin esto, insertar una fila arriba rompe en
   * silencio todas las sumas de la hoja — el fallo más caro de una planilla.
   */
  const shiftRowsCols = (kind, at, delta) => {
    const cells = {};
    const remap = (r, c) => {
      if (kind === 'row') return { r: r >= at ? r + delta : r, c };
      return { r, c: c >= at ? c + delta : c };
    };
    let dropped = 0;
    Object.keys(sheet.cells).forEach((addr) => {
      const a = parseAddr(addr);
      if (!a) return;
      if (delta < 0) {
        const pos = kind === 'row' ? a.r : a.c;
        if (pos >= at && pos < at - delta) { dropped++; return; }   // la que se borra
      }
      const next = remap(a.r, a.c);
      if (next.r < 0 || next.c < 0) return;
      const cell = Object.assign({}, sheet.cells[addr]);
      if (s(cell.v).charAt(0) === '=') {
        cell.v = rewriteRefs(cell.v, (rr, cc) => {
          const m = remap(rr, cc);
          if (delta < 0) {
            const pos = kind === 'row' ? rr : cc;
            if (pos >= at && pos < at - delta) return null;         // apuntaba a lo borrado
          }
          return m;
        });
      }
      cells[addrOf(next.r, next.c)] = cell;
    });
    const cols = {};
    Object.keys(sheet.cols).forEach((k) => {
      const c = Math.floor(num(k, -1));
      if (c < 0) return;
      if (kind === 'col') {
        if (delta < 0 && c >= at && c < at - delta) return;
        cols[c >= at ? c + delta : c] = sheet.cols[k];
      } else cols[c] = sheet.cols[k];
    });
    const next = Object.assign({}, sheet, {
      cells, cols,
      rows: Math.max(1, Math.min(MAX_ROWS, sheet.rows + (kind === 'row' ? delta : 0))),
      ncols: Math.max(1, Math.min(MAX_COLS, sheet.ncols + (kind === 'col' ? delta : 0))),
    });
    // Esta operación toca toda la hoja: se guarda la hoja entera para deshacer.
    pushUndo(file.id, { sheetId: sheet.id, cells: fullSnapshot(sheet) });
    const sheets = doc.sheets.slice();
    sheets[si] = next;
    patchFile(file.id, { data: { sheets, active: si } });
    if (dropped) notify('info', dropped + ' celda(s) eliminada(s).');
  };
  /** Instantánea completa: para deshacer operaciones que mueven la hoja entera. */
  function fullSnapshot(sh) {
    const snap = {};
    Object.keys(sh.cells).forEach((a) => { snap[a] = Object.assign({}, sh.cells[a]); });
    // Las direcciones que quedarán ocupadas y hoy están vacías deben volver a vacío.
    for (let r = 0; r < Math.min(sh.rows, MAX_ROWS); r++) {
      for (let c = 0; c < sh.ncols; c++) {
        const a = addrOf(r, c);
        if (!(a in snap)) snap[a] = null;
      }
    }
    return snap;
  }

  // ── Portapapeles ──────────────────────────────────────────────────────
  const selectionTsv = (raw) => {
    const n1 = normSel(sel);
    const lines = [];
    for (let r = n1.r1; r <= n1.r2; r++) {
      const row = [];
      for (let c = n1.c1; c <= n1.c2; c++) {
        row.push(raw ? rawAt(sheet, r, c)
          : formatValue(evalSheet.get(r, c), (cellAt(sheet, r, c) || {}).f || '', cfg.currency));
      }
      lines.push(row.join('\t'));
    }
    return lines.join('\n');
  };

  const doCopy = (cut) => {
    const n1 = normSel(sel);
    const cells = [];
    for (let r = n1.r1; r <= n1.r2; r++) {
      const row = [];
      for (let c = n1.c1; c <= n1.c2; c++) row.push(cellAt(sheet, r, c) ? Object.assign({}, sheet.cells[addrOf(r, c)]) : null);
      cells.push(row);
    }
    clip.current = { r: n1.r1, c: n1.c1, cells };
    void copyText(selectionTsv(true));
    if (cut) clearSelection();
  };

  const pasteCells = (grid, origin) => {
    const n1 = normSel(sel);
    const changes = {};
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const tr = n1.r1 + r; const tc = n1.c1 + c;
        if (tr >= MAX_ROWS || tc >= MAX_COLS) continue;
        const src = grid[r][c];
        const addr = addrOf(tr, tc);
        if (src == null) { changes[addr] = null; continue; }
        const cell = Object.assign({}, src);
        // Las referencias relativas se corren igual que en Excel al pegar.
        if (origin && s(cell.v).charAt(0) === '=') {
          cell.v = shiftFormula(cell.v, tr - (origin.r + r), tc - (origin.c + c));
        }
        changes[addr] = cell;
      }
    }
    if (Object.keys(changes).length) applyChanges(changes);
  };

  const onPaste = (e) => {
    if (editing) return;
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    e.preventDefault();
    if (clip.current && (!text || text === selectionTsvOf(clip.current))) {
      pasteCells(clip.current.cells, { r: clip.current.r, c: clip.current.c });
      return;
    }
    if (!text) { if (clip.current) pasteCells(clip.current.cells, { r: clip.current.r, c: clip.current.c }); return; }
    const rows = parseDelimited(text, guessDelim(text));
    pasteCells(rows.map((row) => row.map((v) => ({ v: s(v) }))), null);
  };
  function selectionTsvOf(c) {
    return c.cells.map((row) => row.map((x) => (x ? s(x.v) : '')).join('\t')).join('\n');
  }

  // ── Teclado ───────────────────────────────────────────────────────────
  const moveTo = (r, c, extend) => {
    const nr = Math.max(0, Math.min(MAX_ROWS - 1, r));
    const nc = Math.max(0, Math.min(MAX_COLS - 1, c));
    setSel(extend ? { r1: sel.r1, c1: sel.c1, r2: nr, c2: nc } : { r1: nr, c1: nc, r2: nr, c2: nc });
    ensureVisible(nr);
  };
  const ensureVisible = (r) => {
    const el = scroller.current;
    if (!el) return;
    const top = r * rowH;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowH > el.scrollTop + el.clientHeight - HEAD_H) el.scrollTop = top + rowH - el.clientHeight + HEAD_H;
  };

  const startEdit = (r, c, seed) => {
    setEditing({ r, c, value: seed != null ? seed : rawAt(sheet, r, c) });
  };
  const commitEdit = (move) => {
    if (!editing) return;
    setCellValue(editing.r, editing.c, editing.value);
    const r = editing.r; const c = editing.c;
    setEditing(null);
    if (move === 'down') moveTo(r + 1, c, false);
    else if (move === 'right') moveTo(r, c + 1, false);
    else moveTo(r, c, false);
  };

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (editing) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit('down'); }
      else if (e.key === 'Tab') { e.preventDefault(); commitEdit('right'); }
      else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
      return;
    }
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (mod && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); doCopy(false); return; }
    if (mod && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); doCopy(true); return; }
    if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleStyle('b'); return; }
    if (mod && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); toggleStyle('i'); return; }
    if (mod && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      setSel({ r1: 0, c1: 0, r2: Math.max(0, sheet.rows - 1), c2: Math.max(0, sheet.ncols - 1) });
      return;
    }
    const step = mod ? 10 : 1;
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); moveTo(sel.r2 - step, sel.c2, e.shiftKey); return;
      case 'ArrowDown': e.preventDefault(); moveTo(sel.r2 + step, sel.c2, e.shiftKey); return;
      case 'ArrowLeft': e.preventDefault(); moveTo(sel.r2, sel.c2 - step, e.shiftKey); return;
      case 'ArrowRight': e.preventDefault(); moveTo(sel.r2, sel.c2 + step, e.shiftKey); return;
      case 'Tab': e.preventDefault(); moveTo(sel.r2, sel.c2 + (e.shiftKey ? -1 : 1), false); return;
      case 'Enter': e.preventDefault(); startEdit(sel.r2, sel.c2); return;
      case 'F2': e.preventDefault(); startEdit(sel.r2, sel.c2); return;
      case 'Home': e.preventDefault(); moveTo(sel.r2, 0, e.shiftKey); return;
      case 'End': e.preventDefault(); moveTo(sel.r2, Math.max(0, sheet.ncols - 1), e.shiftKey); return;
      case 'PageDown': e.preventDefault(); moveTo(sel.r2 + Math.floor(viewport / rowH), sel.c2, e.shiftKey); return;
      case 'PageUp': e.preventDefault(); moveTo(sel.r2 - Math.floor(viewport / rowH), sel.c2, e.shiftKey); return;
      case 'Delete': case 'Backspace': e.preventDefault(); clearSelection(); return;
      default: break;
    }
    // Escribir directamente sobre la celda reemplaza su contenido, como Excel.
    if (!mod && !e.altKey && e.key.length === 1) { e.preventDefault(); startEdit(sel.r2, sel.c2, e.key); }
  };

  // ── Redimensionar columnas ────────────────────────────────────────────
  useEffect(() => {
    if (!resizing) return undefined;
    const move = (ev) => {
      const w = Math.max(48, Math.min(600, resizing.w0 + (ev.clientX - resizing.x0)));
      const cols = Object.assign({}, sheet.cols); cols[resizing.c] = w;
      const sheets = doc.sheets.slice(); sheets[si] = Object.assign({}, sheet, { cols });
      patchFile(file.id, { data: { sheets, active: si } });
    };
    const up = () => setResizing(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [resizing, sheet, si, doc.sheets, file.id]);

  useEffect(() => {
    if (!dragging) return undefined;
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [dragging]);

  // ── Hojas del archivo ─────────────────────────────────────────────────
  const addSheet = () => {
    const names = doc.sheets.map((x) => canon(x.name));
    let n1 = doc.sheets.length + 1;
    while (names.indexOf(canon('Hoja ' + n1)) >= 0) n1++;
    const sheets = doc.sheets.concat([newSheet('Hoja ' + n1)]);
    commitDoc({ sheets, active: sheets.length - 1 });
  };
  const removeSheet = (idx) => {
    if (doc.sheets.length < 2) { notify('warn', 'El archivo necesita al menos una hoja.'); return; }
    const sheets = doc.sheets.filter((x, i) => i !== idx);
    commitDoc({ sheets, active: Math.max(0, Math.min(sheets.length - 1, idx - 1)) });
  };
  const renameSheet = (idx, name) => {
    const sheets = doc.sheets.slice();
    sheets[idx] = Object.assign({}, sheets[idx], { name: s(name).trim().slice(0, 40) || sheets[idx].name });
    commitDoc({ sheets, active: doc.active });
  };

  // ── Importar y exportar ───────────────────────────────────────────────
  const exportCsv = () => {
    const lines = [];
    for (let r = 0; r < sheet.rows; r++) {
      const row = [];
      let any = false;
      for (let c = 0; c < sheet.ncols; c++) {
        const v = formatValue(evalSheet.get(r, c), (cellAt(sheet, r, c) || {}).f || '', cfg.currency);
        if (v) any = true;
        row.push(toCsvCell(v));
      }
      if (any || r < 1) lines.push(row.join(';'));
    }
    download(file.name + '.csv', '﻿' + lines.join('\n'), 'text/csv');
  };

  const importText = (text, mode) => {
    const rows = parseDelimited(text, guessDelim(text));
    if (!rows.length) { notify('warn', 'No se encontró ninguna fila.'); return; }
    const changes = {};
    const base = mode === 'append' ? lastUsedRow(sheet) + 1 : 0;
    rows.forEach((row, r) => row.forEach((v, c) => {
      if (base + r >= MAX_ROWS || c >= MAX_COLS) return;
      // Lo importado entra como TEXTO: un CSV nunca debe traer fórmulas que se
      // evalúen solas al abrirlo (ver docs/SEGURIDAD.md, inyección en CSV).
      const val = s(v).charAt(0) === '=' ? "'" + s(v) : s(v);
      if (val) changes[addrOf(base + r, c)] = { v: val };
    }));
    if (mode === 'replace') {
      pushUndo(file.id, { sheetId: sheet.id, cells: fullSnapshot(sheet) });
      const sheets = doc.sheets.slice();
      sheets[si] = withCells(Object.assign({}, sheet, { cells: {} }), changes);
      patchFile(file.id, { data: { sheets, active: si } });
    } else applyChanges(changes);
    notify('success', rows.length + ' fila(s) importada(s).');
  };

  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt,text/csv,text/plain';
    input.onchange = () => {
      const f2 = input.files && input.files[0];
      if (!f2) return;
      if (f2.size > 8 * 1024 * 1024) { notify('error', 'El archivo supera los 8 MB.'); return; }
      const reader = new FileReader();
      reader.onload = () => importText(s(reader.result), 'replace');
      reader.onerror = () => notify('error', 'No se pudo leer el archivo.');
      reader.readAsText(f2, 'utf-8');
    };
    input.click();
  };

  // ── Datos de otras apps de KIMOS ──────────────────────────────────────
  const importKimos = async (source) => {
    setDialog(null);
    const rows = await fetchKimosRows(source);
    if (!rows || !rows.length) { notify('warn', 'No hay datos disponibles de ' + source + '.'); return; }
    const changes = {};
    rows.forEach((row, r) => row.forEach((v, c) => {
      if (r >= MAX_ROWS || c >= MAX_COLS) return;
      const val = s(v).charAt(0) === '=' ? "'" + s(v) : s(v);
      if (val) changes[addrOf(r, c)] = Object.assign({ v: val }, r === 0 ? { b: true } : {});
    }));
    pushUndo(file.id, { sheetId: sheet.id, cells: fullSnapshot(sheet) });
    const sheets = doc.sheets.slice();
    sheets[si] = withCells(Object.assign({}, sheet, { cells: {} }), changes);
    patchFile(file.id, { data: { sheets, active: si } });
    notify('success', (rows.length - 1) + ' registro(s) traídos de ' + source + '.');
  };

  // ── Resumen de la selección ───────────────────────────────────────────
  const stats = useMemo(() => {
    const n1 = normSel(sel);
    if (selSize(sel) > 20000) return null;
    let count = 0; let numeric = 0; let sum = 0;
    for (let r = n1.r1; r <= n1.r2; r++) {
      for (let c = n1.c1; c <= n1.c2; c++) {
        const v = evalSheet.get(r, c);
        if (v === '' || v == null) continue;
        count++;
        if (isErr(v)) continue;
        const x = toNumber(v);
        if (!isErr(x) && (typeof v === 'number' || isDate(v) || typeof v === 'boolean' || NUM_RE.test(s(rawAt(sheet, r, c)).trim()))) { numeric++; sum += x; }
      }
    }
    return { count, numeric, sum, avg: numeric ? sum / numeric : 0 };
  }, [sel, evalSheet, sheet]);

  const active = { r: sel.r2, c: sel.c2 };
  const activeCell = cellAt(sheet, active.r, active.c) || {};
  const activeRaw = rawAt(sheet, active.r, active.c);
  const n = normSel(sel);

  // ── Pintado ───────────────────────────────────────────────────────────
  const colHeads = [];
  for (let c = 0; c < sheet.ncols; c++) {
    const selectedCol = c >= n.c1 && c <= n.c2;
    colHeads.push(h('div', {
      key: 'ch' + c,
      className: cx('wo-gh', selectedCol && 'wo-gh-on'),
      style: { width: colW(c) + 'px' },
      onMouseDown: (e) => { if (e.button === 0) setSel({ r1: 0, c1: c, r2: Math.max(0, sheet.rows - 1), c2: c }); },
      title: 'Columna ' + colName(c),
    }, colName(c),
      h('span', {
        className: 'wo-gh-grip',
        onMouseDown: (e) => { e.preventDefault(); e.stopPropagation(); setResizing({ c, x0: e.clientX, w0: colW(c) }); },
        title: 'Arrastra para cambiar el ancho',
      })));
  }

  const rows = [];
  for (let r = first; r <= last; r++) {
    const cellsOfRow = [];
    for (let c = 0; c < sheet.ncols; c++) {
      const cell = cellAt(sheet, r, c);
      const isEditing = editing && editing.r === r && editing.c === c;
      const value = evalSheet.get(r, c);
      const fmt = (cell && cell.f) || '';
      const text = isEditing ? '' : formatValue(value, fmt, cfg.currency);
      const alignRight = (cell && cell.a) ? cell.a === 'right' : (fmt ? fmt !== 'text' : isNumericValue(value));
      cellsOfRow.push(h('div', {
        key: 'c' + c,
        className: cx('wo-gc',
          inSel(sel, r, c) && 'wo-gc-sel',
          r === active.r && c === active.c && 'wo-gc-active',
          isErr(value) && 'wo-gc-err',
          cell && cell.b && 'wo-gc-b', cell && cell.i && 'wo-gc-i'),
        style: {
          width: colW(c) + 'px',
          textAlign: (cell && cell.a) ? cell.a : (alignRight ? 'right' : 'left'),
        },
        onMouseDown: (e) => {
          if (e.button !== 0) return;
          if (editing) commitEdit(null);
          if (e.shiftKey) setSel({ r1: sel.r1, c1: sel.c1, r2: r, c2: c });
          else { setSel({ r1: r, c1: c, r2: r, c2: c }); setDragging(true); }
        },
        onMouseEnter: () => { if (dragging) setSel((prev) => ({ r1: prev.r1, c1: prev.c1, r2: r, c2: c })); },
        onDoubleClick: () => startEdit(r, c),
        title: isErr(value) ? errorHelp(value.e) : undefined,
      }, isEditing
        ? h('input', {
          ref: editorRef, className: 'wo-gc-in', value: editing.value, autoFocus: true,
          onChange: (e) => setEditing(Object.assign({}, editing, { value: e.target.value })),
          onBlur: () => commitEdit(null),
          'aria-label': 'Celda ' + addrOf(r, c),
        })
        : text));
    }
    rows.push(h('div', {
      key: 'r' + r, className: 'wo-gr', style: { height: rowH + 'px', top: (r * rowH) + 'px' },
    },
      h('div', {
        className: cx('wo-gn', r >= n.r1 && r <= n.r2 && 'wo-gh-on'),
        onMouseDown: () => setSel({ r1: r, c1: 0, r2: r, c2: Math.max(0, sheet.ncols - 1) }),
        title: 'Fila ' + (r + 1),
      }, r + 1),
      cellsOfRow));
  }

  const fmtOptions = CELL_FORMATS;
  const selLabel = selSize(sel) > 1
    ? addrOf(n.r1, n.c1) + ':' + addrOf(n.r2, n.c2)
    : addrOf(active.r, active.c);

  return h('div', { className: 'wo-sheet' },
    // Barra de herramientas
    h('div', { className: 'wo-tools' },
      h(IconBtn, { icon: '↶', title: 'Deshacer (Ctrl+Z)', onClick: undo }),
      h(IconBtn, { icon: '↷', title: 'Rehacer (Ctrl+Y)', onClick: redo }),
      h(Sep),
      h(IconBtn, { icon: 'B', title: 'Negrita (Ctrl+B)', active: !!activeCell.b, onClick: () => toggleStyle('b'), className: 'wo-ibtn-b' }),
      h(IconBtn, { icon: 'I', title: 'Cursiva (Ctrl+I)', active: !!activeCell.i, onClick: () => toggleStyle('i'), className: 'wo-ibtn-it' }),
      h(Sep),
      h(IconBtn, { icon: '⇤', title: 'Alinear a la izquierda', active: activeCell.a === 'left', onClick: () => styleSelection({ a: 'left' }) }),
      h(IconBtn, { icon: '↔', title: 'Centrar', active: activeCell.a === 'center', onClick: () => styleSelection({ a: 'center' }) }),
      h(IconBtn, { icon: '⇥', title: 'Alinear a la derecha', active: activeCell.a === 'right', onClick: () => styleSelection({ a: 'right' }) }),
      h(Sep),
      h(Select, {
        value: activeCell.f || '', options: fmtOptions, ariaLabel: 'Formato de celda',
        title: 'Formato de las celdas seleccionadas',
        onChange: (v) => styleSelection({ f: v }),
      }),
      h(Sep),
      h(Menu, {
        icon: '＋', title: 'Insertar y eliminar',
        items: [
          { icon: '⬆️', label: 'Insertar fila encima', onClick: () => shiftRowsCols('row', n.r1, 1) },
          { icon: '⬇️', label: 'Insertar fila debajo', onClick: () => shiftRowsCols('row', n.r2 + 1, 1) },
          { icon: '⬅️', label: 'Insertar columna a la izquierda', onClick: () => shiftRowsCols('col', n.c1, 1) },
          { icon: '➡️', label: 'Insertar columna a la derecha', onClick: () => shiftRowsCols('col', n.c2 + 1, 1) },
          { divider: true },
          { icon: '🗑️', label: 'Eliminar fila(s)', danger: true, onClick: () => shiftRowsCols('row', n.r1, -(n.r2 - n.r1 + 1)) },
          { icon: '🗑️', label: 'Eliminar columna(s)', danger: true, onClick: () => shiftRowsCols('col', n.c1, -(n.c2 - n.c1 + 1)) },
        ],
      }),
      h(Menu, {
        icon: '⇄', title: 'Importar y exportar',
        items: [
          { icon: '📥', label: 'Importar CSV…', onClick: pickFile },
          { icon: '📤', label: 'Exportar CSV', onClick: exportCsv },
          { icon: '📋', label: 'Copiar como texto', onClick: () => { void copyText(selectionTsv(false)); notify('success', 'Selección copiada.'); } },
          { divider: true },
          {
            icon: '🔗', label: 'Traer datos de KIMOS…',
            disabled: cfg.kimosData === false,
            onClick: () => setDialog('kimos'),
          },
          { divider: true },
          { icon: '🖨️', label: 'Imprimir / PDF', onClick: () => printSheet(file, sheet, evalSheet, cfg) },
        ],
      })),

    // Barra de fórmulas
    h('div', { className: 'wo-fbar' },
      h('span', { className: 'wo-fbar-ref', title: 'Celda o rango activo' }, selLabel),
      h('span', { className: 'wo-fbar-fx', 'aria-hidden': 'true' }, 'ƒx'),
      h('input', {
        className: 'wo-fbar-in',
        value: editing && editing.fromBar ? editing.value : (editing ? editing.value : activeRaw),
        placeholder: 'Valor o fórmula: =SUMA(A1:A10)',
        'aria-label': 'Contenido de la celda ' + addrOf(active.r, active.c),
        onChange: (e) => setEditing({ r: active.r, c: active.c, value: e.target.value, fromBar: true }),
        onKeyDown: (e) => {
          if (e.key === 'Enter') { e.preventDefault(); commitEdit('down'); }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
        },
        onFocus: () => { if (!editing) setEditing({ r: active.r, c: active.c, value: activeRaw, fromBar: true }); },
      })),

    // Grilla
    h('div', {
      className: 'wo-grid', ref: scroller, tabIndex: 0, role: 'grid',
      'aria-label': 'Hoja ' + sheet.name,
      onScroll: (e) => setScrollTop(e.currentTarget.scrollTop),
      onKeyDown, onPaste,
    },
      h('div', { className: 'wo-grid-head', style: { width: (ROWNUM_W + totalW) + 'px' } },
        h('div', { className: 'wo-gh wo-gh-corner', style: { width: ROWNUM_W + 'px' }, onMouseDown: () => setSel({ r1: 0, c1: 0, r2: sheet.rows - 1, c2: sheet.ncols - 1 }), title: 'Seleccionar todo' }),
        colHeads),
      h('div', {
        className: 'wo-grid-body',
        style: { height: (sheet.rows * rowH) + 'px', width: (ROWNUM_W + totalW) + 'px' },
      }, rows)),

    // Pestañas de hojas + resumen
    h('div', { className: 'wo-sbar' },
      h('div', { className: 'wo-stabs' },
        doc.sheets.map((sh, i) => h('span', { key: sh.id, className: cx('wo-stab', i === si && 'wo-stab-on') },
          h('button', {
            type: 'button', className: 'wo-stab-b',
            onDoubleClick: () => setDialog({ kind: 'rename', idx: i, value: sh.name }),
            onClick: () => commitDoc({ sheets: doc.sheets, active: i }),
            title: sh.name + ' — doble clic para renombrar',
          }, sh.name),
          i === si && doc.sheets.length > 1
            ? h('button', { type: 'button', className: 'wo-stab-x', title: 'Eliminar hoja', onClick: () => setDialog({ kind: 'delSheet', idx: i }) }, '✕')
            : null)),
        h(IconBtn, { icon: '＋', title: 'Añadir hoja', onClick: addSheet })),
      stats ? h('div', { className: 'wo-stats' },
        h('span', null, 'Celdas: ', h('b', null, stats.count)),
        stats.numeric ? h('span', null, 'Suma: ', h('b', null, groupNum(stats.sum, decimalsOf(stats.sum, 2)))) : null,
        stats.numeric ? h('span', null, 'Promedio: ', h('b', null, groupNum(stats.avg, decimalsOf(stats.avg, 2)))) : null) : null),

    dialog === 'kimos' ? h(KimosImportDialog, { onClose: () => setDialog(null), onPick: importKimos }) : null,
    dialog && dialog.kind === 'rename' ? h(RenameSheetDialog, {
      value: dialog.value,
      onClose: () => setDialog(null),
      onOk: (v) => { renameSheet(dialog.idx, v); setDialog(null); },
    }) : null,
    dialog && dialog.kind === 'delSheet' ? h(ConfirmModal, {
      title: 'Eliminar la hoja',
      message: 'Se eliminará "' + doc.sheets[dialog.idx].name + '" y todo su contenido. Esta acción no se puede deshacer.',
      danger: true,
      onCancel: () => setDialog(null),
      onOk: () => { removeSheet(dialog.idx); setDialog(null); },
    }) : null);
}

function RenameSheetDialog(p) {
  const [v, setV] = useState(p.value);
  return h(Modal, {
    title: 'Renombrar la hoja', onClose: p.onClose,
    actions: [
      h(Btn, { key: 'c', label: 'Cancelar', onClick: p.onClose }),
      h(Btn, { key: 'k', label: 'Guardar', variant: 'primary', onClick: () => p.onOk(v) }),
    ],
  }, h(Field, { label: 'Nombre', wide: true },
    h(TextInput, {
      value: v, onChange: setV, autoFocus: true,
      onKeyDown: (e) => { if (e.key === 'Enter') p.onOk(v); },
    })));
}

/** Última fila con algo escrito (para "añadir al final"). */
function lastUsedRow(sheet) {
  let max = -1;
  Object.keys(sheet.cells).forEach((a) => { const at = parseAddr(a); if (at && at.r > max) max = at.r; });
  return max;
}

/** Explicación en castellano de cada error: el código solo no ayuda a nadie. */
function errorHelp(code) {
  const map = {
    '#DIV/0!': 'División por cero: revisa el divisor.',
    '#VALUE!': 'Un valor no es del tipo esperado (texto donde iba un número).',
    '#NAME?': 'Función o nombre desconocido. Revisa cómo se escribe.',
    '#REF!': 'La fórmula apunta a una celda que ya no existe.',
    '#NUM!': 'Resultado numérico imposible (raíz de un negativo, desbordamiento).',
    '#N/A': 'No se encontró el valor buscado.',
    '#CIRC!': 'Referencia circular: la celda se usa a sí misma.',
    '#ERROR!': 'La fórmula está mal escrita. Revisa paréntesis y comillas.',
  };
  return map[code] || 'Error en la fórmula.';
}

function printSheet(file, sheet, evalSheet, cfg) {
  printPage(file.name, (d, root) => {
    const hd = d.createElement('h1'); hd.textContent = file.name + ' · ' + sheet.name;
    root.appendChild(hd);
    const table = d.createElement('table');
    const maxR = Math.min(sheet.rows, lastUsedRow(sheet) + 1) || 1;
    let maxC = 0;
    Object.keys(sheet.cells).forEach((a) => { const at = parseAddr(a); if (at && at.c + 1 > maxC) maxC = at.c + 1; });
    maxC = Math.max(1, maxC);
    for (let r = 0; r < maxR; r++) {
      const tr = d.createElement('tr');
      for (let c = 0; c < maxC; c++) {
        const cell = sheet.cells[addrOf(r, c)] || {};
        const td = d.createElement(cell.b ? 'th' : 'td');
        td.textContent = formatValue(evalSheet.get(r, c), cell.f || '', cfg.currency);
        if (cell.a) td.style.textAlign = cell.a;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    root.appendChild(table);
  });
}

// Texto de una hoja para el buscador global y para el agente.
textExtractors.sheet = (f) => {
  const doc = sheetDoc(f.data);
  return doc.sheets.map((sh) => sh.name + '\n'
    + Object.keys(sh.cells).map((a) => s(sh.cells[a].v)).join(' ')).join('\n');
};

// ══════════════════════════════════════════════════════════════════════
// src/35-kimos-data.js
// ══════════════════════════════════════════════════════════════════════
/* ══ PUENTE CON EL RESTO DE KIMOS ══════════════════════════════════════════
 *
 * WorkOffice no reimplementa lo que la plataforma ya tiene: lo *lee*. Con
 * `shell.data` (APP-SPEC §7.c) trae, siempre en **solo lectura**:
 *
 *   Productos  → filas a una hoja de cálculo (catálogo, precios, stock)
 *   Clientes   → filas a una hoja (y combinación de correspondencia en Documentos)
 *   Pedidos    → filas a una hoja para informes
 *   Planificación (gantt) → sus tareas se ven en el Calendario
 *   Notas de Equipo → se ven junto a las notas personales, sin duplicarlas
 *
 * Tres reglas que no se negocian:
 *   1. **El RBAC del usuario es el techo.** El permiso de la app nunca amplía lo
 *      que la persona ya puede ver; si no tiene acceso al equipo, no llega nada.
 *   2. **Solo lectura.** WorkOffice jamás escribe en otra app. Si el usuario
 *      quiere cambiar un precio, lo hace en Productos, que es su dueño.
 *   3. **Degradación limpia.** Sin permiso, sin host v2 o sin red, la función
 *      se apaga con un aviso claro; nunca rompe la app ni deja la pantalla a medias.
 *
 * El análisis de qué se integra y qué NO (para no duplicar apps existentes)
 * está en docs/INTEGRACION-KIMOS.md.
 */

const KIMOS_SOURCES = [
  {
    id: 'products', label: 'Productos', icon: '📦',
    hint: 'Catálogo con precio y stock.',
    columns: [
      ['SKU', (it) => it.sku || it.code || it.id],
      ['Nombre', (it) => it.name || it.title],
      ['Precio', (it) => it.price != null ? it.price : it.salePrice],
      ['Stock', (it) => it.stock != null ? it.stock : it.quantity],
      ['Categoría', (it) => it.category || it.type],
      ['Actualizado', (it) => it.updatedAt],
    ],
  },
  {
    id: 'customers', label: 'Clientes', icon: '👥',
    hint: 'Contactos con correo y teléfono.',
    columns: [
      ['Nombre', (it) => it.name || it.displayName],
      ['Correo', (it) => it.email],
      ['Teléfono', (it) => it.phone],
      ['Empresa', (it) => it.company || it.organization],
      ['Ciudad', (it) => it.city],
      ['Actualizado', (it) => it.updatedAt],
    ],
  },
  {
    id: 'orders', label: 'Pedidos', icon: '🛒',
    hint: 'Pedidos con total y estado.',
    columns: [
      ['Nº', (it) => it.number || it.code || it.id],
      ['Cliente', (it) => it.customerName || it.customer],
      ['Total', (it) => it.total != null ? it.total : it.amount],
      ['Estado', (it) => it.status || it.state],
      ['Fecha', (it) => it.date || it.createdAt],
    ],
  },
];

const kimosCache = new Map();     // sourceId -> { at, items }
const KIMOS_TTL = 60000;

/** ¿Se puede leer otra app? Depende del host, del permiso y de la preferencia. */
function kimosAvailable() {
  return !!(shell.data && typeof shell.data.listInstances === 'function' && model.cfg.kimosData !== false);
}

/** Items crudos de una app, uniendo todas las instancias que el usuario ve. */
async function fetchKimosItems(templateId) {
  if (!kimosAvailable()) return null;
  const hit = kimosCache.get(templateId);
  if (hit && Date.now() - hit.at < KIMOS_TTL) return hit.items;
  try {
    const instances = await shell.data.listInstances(templateId);
    const all = [];
    for (const inst of (instances || []).slice(0, 12)) {     // tope defensivo
      try {
        const items = await shell.data.listItems(inst.id);
        (items || []).forEach((it) => {
          if (it && it.kind !== 'definition') all.push(Object.assign({ _instance: s(inst.name || inst.id) }, it));
        });
      } catch (e) { /* una instancia sin acceso no debe tumbar el resto */ }
    }
    kimosCache.set(templateId, { at: Date.now(), items: all });
    return all;
  } catch (e) {
    return null;
  }
}

/** Filas listas para volcar en una hoja: la primera es el encabezado. */
async function fetchKimosRows(templateId) {
  const src = KIMOS_SOURCES.find((x) => x.id === templateId);
  if (!src) return null;
  const items = await fetchKimosItems(templateId);
  if (!items) return null;
  const head = src.columns.map((c) => c[0]);
  const rows = items.map((it) => src.columns.map((c) => {
    let v;
    try { v = c[1](it); } catch (e) { v = ''; }
    if (v == null) return '';
    if (typeof v === 'object') return '';
    // Las fechas ISO largas se recortan al día: en una hoja nadie quiere la hora UTC.
    const t = s(v);
    return /^\d{4}-\d{2}-\d{2}T/.test(t) ? t.slice(0, 10) : t;
  }));
  return [head].concat(rows);
}

/** Tareas de la app Planificación (gantt) que el calendario superpone. */
async function fetchGanttTasks() {
  const items = await fetchKimosItems('gantt');
  if (!items) return [];
  const out = [];
  items.forEach((it) => {
    const plan = s(it.name || it.title || it._instance);
    const tasks = Array.isArray(it.tasks) ? it.tasks : [];
    tasks.forEach((t) => {
      const start = s(t && (t.start || t.startDate));
      const end = s(t && (t.end || t.endDate)) || start;
      if (!/^\d{4}-\d{2}-\d{2}/.test(start)) return;
      out.push({
        id: 'gantt:' + s(it.id) + ':' + s(t.id || t.name),
        title: s(t.name || t.title || 'Tarea'),
        day: start.slice(0, 10),
        endDay: /^\d{4}-\d{2}-\d{2}/.test(end) ? end.slice(0, 10) : start.slice(0, 10),
        owner: s(t.owner || t.responsible || t.responsibleName),
        source: 'gantt',
        plan,
      });
    });
  });
  return out.slice(0, 500);
}

/** Notas del equipo (app notas-equipo) para verlas junto a las personales. */
async function fetchTeamNotes() {
  const items = await fetchKimosItems('notas-equipo');
  if (!items) return [];
  return items.slice(0, 200).map((it) => ({
    id: 'team:' + s(it.id),
    text: s(it.text),
    author: s(it.createdBy),
    at: s(it.updatedAt || it.createdAt),
    responsible: s(it.responsibleName),
    source: 'notas-equipo',
  })).filter((x) => x.text);
}

/** Refresca lo externo (calendario y notas) sin bloquear la interfaz. */
async function refreshExternal(force) {
  if (!kimosAvailable()) {
    if (model.external.gantt.length || model.external.notes.length) {
      setModel({ external: { gantt: [], notes: [], loadedAt: '' } });
    }
    return;
  }
  const age = model.external.loadedAt ? Date.now() - new Date(model.external.loadedAt).getTime() : Infinity;
  if (!force && age < KIMOS_TTL) return;
  const gantt = await fetchGanttTasks();
  const notes = await fetchTeamNotes();
  setModel({ external: { gantt, notes, loadedAt: stamp() } });
}

/** Diálogo para elegir qué app de KIMOS traer a la hoja. */
function KimosImportDialog(p) {
  const [busy, setBusy] = useState('');
  const disponible = kimosAvailable();
  return h(Modal, {
    title: 'Traer datos de KIMOS', onClose: p.onClose,
    actions: [h(Btn, { key: 'c', label: 'Cerrar', onClick: p.onClose })],
  },
    h('p', { className: 'wo-modal-msg' },
      'Se reemplaza el contenido de la hoja actual con los datos de la app elegida. ',
      h('b', null, 'Es una copia de solo lectura'),
      ': cambiarla aquí no modifica la app de origen.'),
    !disponible
      ? h('div', { className: 'wo-warn' },
        'No hay acceso a los datos de otras apps. Revisa que la app esté instalada con el permiso '
        + '"data.read" y que la preferencia "Traer datos de otras apps de KIMOS" esté activa en ⚙️ Configurar.')
      : h('div', { className: 'wo-picklist' },
        KIMOS_SOURCES.map((src) => h('button', {
          key: src.id, type: 'button', className: 'wo-pick', disabled: !!busy,
          onClick: async () => { setBusy(src.id); await p.onPick(src.id); setBusy(''); },
        },
          h('span', { className: 'wo-pick-i', 'aria-hidden': 'true' }, src.icon),
          h('span', { className: 'wo-pick-t' },
            h('b', null, src.label),
            h('span', { className: 'wo-pick-h' }, busy === src.id ? 'Trayendo datos…' : src.hint))))));
}

// ══════════════════════════════════════════════════════════════════════
// src/40-docs.js
// ══════════════════════════════════════════════════════════════════════
/* ══ DOCUMENTOS ════════════════════════════════════════════════════════════
 *
 * Editor por **bloques** (párrafo, título, lista, cita, código, tarea,
 * separador), no un `contenteditable`.
 *
 * Por qué bloques y no contenteditable: `contenteditable` guarda HTML, y HTML
 * guardado es HTML que alguien tiene que volver a pintar — el camino directo a
 * una inyección en el escritorio de KIMOS. Aquí cada bloque es **texto plano**
 * con marcas (`**negrita**`, `*cursiva*`, `[enlace](https://…)`) que se pintan
 * como elementos React (`MarkText`). El documento es JSON pequeño, comparable,
 * exportable a Markdown y legible por el agente IA.
 *
 * Efecto lateral buscado: el mismo texto se ve igual en Documentos, en Notas y
 * en Presentaciones, y se puede mover entre módulos sin convertir nada.
 */

const BLOCK_TYPES = [
  { id: 'p', label: 'Texto', icon: '¶', tag: 'p' },
  { id: 'h1', label: 'Título 1', icon: 'H1', tag: 'h1' },
  { id: 'h2', label: 'Título 2', icon: 'H2', tag: 'h2' },
  { id: 'h3', label: 'Título 3', icon: 'H3', tag: 'h3' },
  { id: 'ul', label: 'Lista', icon: '•', tag: 'li' },
  { id: 'ol', label: 'Lista numerada', icon: '1.', tag: 'li' },
  { id: 'todo', label: 'Tarea', icon: '☐', tag: 'li' },
  { id: 'quote', label: 'Cita', icon: '❝', tag: 'blockquote' },
  { id: 'code', label: 'Código', icon: '</>', tag: 'pre' },
  { id: 'hr', label: 'Separador', icon: '—', tag: 'hr' },
];
const BLOCK_BY_ID = {};
BLOCK_TYPES.forEach((b) => { BLOCK_BY_ID[b.id] = b; });

const newBlock = (type, text) => ({ id: uid('b'), t: BLOCK_BY_ID[type] ? type : 'p', x: s(text) });
function newDocDoc() { return { blocks: [newBlock('h1', ''), newBlock('p', '')] }; }

function docDoc(data) {
  const d = data && typeof data === 'object' ? data : {};
  let blocks = Array.isArray(d.blocks) ? d.blocks : [];
  blocks = blocks.filter((b) => b && typeof b === 'object').map((b) => ({
    id: s(b.id) || uid('b'),
    t: BLOCK_BY_ID[b.t] ? b.t : 'p',
    x: s(b.x),
    c: !!b.c,
  }));
  if (!blocks.length) blocks = newDocDoc().blocks;
  return { blocks };
}

/** Texto plano del documento: buscador, exportación y resumen para el agente. */
const docPlain = (doc) => doc.blocks.map((b) => (b.t === 'hr' ? '———' : plainText(b.x))).join('\n');

/** Markdown de ida y vuelta: lo que se exporta se puede volver a pegar. */
function docToMarkdown(doc) {
  const out = [];
  let olCount = 0;
  doc.blocks.forEach((b) => {
    if (b.t === 'ol') olCount++; else olCount = 0;
    switch (b.t) {
      case 'h1': out.push('# ' + b.x); break;
      case 'h2': out.push('## ' + b.x); break;
      case 'h3': out.push('### ' + b.x); break;
      case 'ul': out.push('- ' + b.x); break;
      case 'ol': out.push(olCount + '. ' + b.x); break;
      case 'todo': out.push('- [' + (b.c ? 'x' : ' ') + '] ' + b.x); break;
      case 'quote': out.push('> ' + b.x); break;
      case 'code': out.push('```\n' + b.x + '\n```'); break;
      case 'hr': out.push('---'); break;
      default: out.push(b.x);
    }
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Markdown → bloques: pegar un texto de fuera entra ordenado, no como un ladrillo. */
function markdownToBlocks(text) {
  const lines = s(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let inCode = false;
  let codeBuf = [];
  lines.forEach((line) => {
    if (/^```/.test(line)) {
      if (inCode) { blocks.push(newBlock('code', codeBuf.join('\n'))); codeBuf = []; inCode = false; }
      else inCode = true;
      return;
    }
    if (inCode) { codeBuf.push(line); return; }
    if (/^#{1}\s+/.test(line)) { blocks.push(newBlock('h1', line.replace(/^#\s+/, ''))); return; }
    if (/^#{2}\s+/.test(line)) { blocks.push(newBlock('h2', line.replace(/^##\s+/, ''))); return; }
    if (/^#{3,}\s+/.test(line)) { blocks.push(newBlock('h3', line.replace(/^#{3,}\s+/, ''))); return; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push(newBlock('hr', '')); return; }
    const todo = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (todo) { const b = newBlock('todo', todo[2]); b.c = todo[1].toLowerCase() === 'x'; blocks.push(b); return; }
    if (/^\s*[-*]\s+/.test(line)) { blocks.push(newBlock('ul', line.replace(/^\s*[-*]\s+/, ''))); return; }
    if (/^\s*\d+[.)]\s+/.test(line)) { blocks.push(newBlock('ol', line.replace(/^\s*\d+[.)]\s+/, ''))); return; }
    if (/^\s*>\s?/.test(line)) { blocks.push(newBlock('quote', line.replace(/^\s*>\s?/, ''))); return; }
    if (!line.trim()) return;
    blocks.push(newBlock('p', line));
  });
  if (inCode && codeBuf.length) blocks.push(newBlock('code', codeBuf.join('\n')));
  return blocks.length ? blocks : [newBlock('p', s(text))];
}

// ── Editor ──────────────────────────────────────────────────────────────
function DocEditor(p) {
  const file = p.file;
  const doc = useMemo(() => docDoc(file.data), [file.data]);
  const [focus, setFocus] = useState('');       // id del bloque con el cursor
  const [outline, setOutline] = useState(false);
  const [merge, setMerge] = useState(false);
  const refs = useRef({});
  const pendingFocus = useRef(null);

  const write = (blocks) => patchFile(file.id, { data: { blocks } });

  const setBlock = (id, patch) => {
    write(doc.blocks.map((b) => (b.id === id ? Object.assign({}, b, patch) : b)));
  };
  const indexOfBlock = (id) => doc.blocks.findIndex((b) => b.id === id);

  const insertAfter = (id, type, text) => {
    const i = indexOfBlock(id);
    const b = newBlock(type || 'p', text || '');
    const blocks = doc.blocks.slice();
    blocks.splice(i < 0 ? blocks.length : i + 1, 0, b);
    write(blocks);
    pendingFocus.current = { id: b.id, at: 0 };
    return b;
  };
  const removeBlock = (id) => {
    if (doc.blocks.length < 2) { setBlock(id, { x: '', t: 'p' }); return; }
    const i = indexOfBlock(id);
    const prev = doc.blocks[i - 1];
    write(doc.blocks.filter((b) => b.id !== id));
    if (prev) pendingFocus.current = { id: prev.id, at: prev.x.length };
  };
  const moveBlock = (id, delta) => {
    const i = indexOfBlock(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= doc.blocks.length) return;
    const blocks = doc.blocks.slice();
    const tmp = blocks[i]; blocks[i] = blocks[j]; blocks[j] = tmp;
    write(blocks);
  };

  // Coloca el cursor donde corresponde tras dividir, unir o crear un bloque.
  useEffect(() => {
    const want = pendingFocus.current;
    if (!want) return;
    pendingFocus.current = null;
    const el = refs.current[want.id];
    if (!el) return;
    el.focus();
    const at = Math.min(want.at, el.value.length);
    try { el.setSelectionRange(at, at); } catch (e) { /* algunos navegadores lo rechazan */ }
    setFocus(want.id);
  }, [doc.blocks]);

  const applyMark = (id, before, after) => {
    const el = refs.current[id];
    const next = wrapSelection(el, before, after);
    if (!next) return;
    setBlock(id, { x: next.value });
    pendingFocus.current = { id, at: next.start };
  };

  const onKeyDown = (e, b, i) => {
    const el = e.target;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); applyMark(b.id, '**'); return; }
    if (mod && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); applyMark(b.id, '*'); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (b.t === 'code') return;                    // en código, Enter es salto de línea
      e.preventDefault();
      const at = el.selectionStart;
      const before = el.value.slice(0, at);
      const after = el.value.slice(at);
      // Enter en una lista vacía la cierra y vuelve a párrafo (como todos los editores).
      if (!before.trim() && !after.trim() && ['ul', 'ol', 'todo'].indexOf(b.t) >= 0) {
        setBlock(b.id, { t: 'p' });
        return;
      }
      const keep = ['ul', 'ol', 'todo'].indexOf(b.t) >= 0 ? b.t : 'p';
      const blocks = doc.blocks.slice();
      blocks[i] = Object.assign({}, b, { x: before });
      const nb = newBlock(keep, after);
      blocks.splice(i + 1, 0, nb);
      write(blocks);
      pendingFocus.current = { id: nb.id, at: 0 };
      return;
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.t !== 'p') { e.preventDefault(); setBlock(b.id, { t: 'p' }); return; }
      const prev = doc.blocks[i - 1];
      if (!prev) return;
      e.preventDefault();
      if (prev.t === 'hr') { write(doc.blocks.filter((x) => x.id !== prev.id)); return; }
      const blocks = doc.blocks.slice();
      blocks[i - 1] = Object.assign({}, prev, { x: prev.x + b.x });
      blocks.splice(i, 1);
      write(blocks);
      pendingFocus.current = { id: prev.id, at: prev.x.length };
      return;
    }
    if (e.key === 'ArrowUp' && el.selectionStart === 0 && doc.blocks[i - 1]) {
      e.preventDefault();
      pendingFocus.current = { id: doc.blocks[i - 1].id, at: doc.blocks[i - 1].x.length };
      setFocus(doc.blocks[i - 1].id);
      const prevEl = refs.current[doc.blocks[i - 1].id];
      if (prevEl) { prevEl.focus(); try { prevEl.setSelectionRange(prevEl.value.length, prevEl.value.length); } catch (e2) { /* noop */ } }
      return;
    }
    if (e.key === 'ArrowDown' && el.selectionStart === el.value.length && doc.blocks[i + 1]) {
      e.preventDefault();
      const nextEl = refs.current[doc.blocks[i + 1].id];
      setFocus(doc.blocks[i + 1].id);
      if (nextEl) { nextEl.focus(); try { nextEl.setSelectionRange(0, 0); } catch (e2) { /* noop */ } }
    }
  };

  /** Atajos de Markdown al escribir: "## " se vuelve título sin tocar el ratón. */
  const onChangeBlock = (b, value) => {
    const shortcuts = [
      [/^#\s/, 'h1'], [/^##\s/, 'h2'], [/^###\s/, 'h3'],
      [/^[-*]\s/, 'ul'], [/^\d+[.)]\s/, 'ol'], [/^>\s/, 'quote'], [/^```\s?/, 'code'],
      [/^\[\]\s/, 'todo'], [/^\[ \]\s/, 'todo'],
    ];
    if (b.t === 'p') {
      for (const sc of shortcuts) {
        if (sc[0].test(value)) {
          setBlock(b.id, { t: sc[1], x: value.replace(sc[0], '') });
          pendingFocus.current = { id: b.id, at: 0 };
          return;
        }
      }
      if (/^---\s?$/.test(value)) {
        setBlock(b.id, { t: 'hr', x: '' });
        insertAfter(b.id, 'p', '');
        return;
      }
    }
    setBlock(b.id, { x: value });
  };

  const onPasteBlock = (e, b, i) => {
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (!text || !/\n/.test(text)) return;         // pegar una línea es lo normal
    e.preventDefault();
    const parsed = markdownToBlocks(text);
    const blocks = doc.blocks.slice();
    const el = e.target;
    const at = el.selectionStart;
    const head = el.value.slice(0, at);
    const tail = el.value.slice(at);
    blocks[i] = Object.assign({}, b, { x: head + parsed[0].x });
    const rest = parsed.slice(1);
    if (tail) rest.push(newBlock('p', tail));
    blocks.splice(i + 1, 0, ...rest);
    write(blocks);
    if (rest.length) pendingFocus.current = { id: rest[rest.length - 1].id, at: 0 };
  };

  const stats = useMemo(() => {
    const text = docPlain(doc);
    const words = text.split(/\s+/).filter(Boolean).length;
    return { words, chars: text.length, blocks: doc.blocks.length };
  }, [doc]);

  const headings = doc.blocks.filter((b) => b.t === 'h1' || b.t === 'h2' || b.t === 'h3');
  const cur = doc.blocks.find((b) => b.id === focus) || doc.blocks[0];

  const exportMd = () => download(file.name + '.md', docToMarkdown(doc), 'text/markdown');
  const print = () => printPage(file.name, (d, root) => {
    let ulOpen = null;
    doc.blocks.forEach((b) => {
      const listType = b.t === 'ul' || b.t === 'todo' ? 'ul' : (b.t === 'ol' ? 'ol' : null);
      if (ulOpen && ulOpen.tag !== listType) ulOpen = null;
      if (listType) {
        if (!ulOpen) { const l = d.createElement(listType); root.appendChild(l); ulOpen = { tag: listType, el: l }; }
        const li = d.createElement('li');
        if (b.t === 'todo') li.appendChild(d.createTextNode((b.c ? '☑ ' : '☐ ')));
        printInline(d, li, b.x);
        ulOpen.el.appendChild(li);
        return;
      }
      ulOpen = null;
      if (b.t === 'hr') { root.appendChild(d.createElement('hr')); return; }
      const el = d.createElement(BLOCK_BY_ID[b.t] ? BLOCK_BY_ID[b.t].tag : 'p');
      if (b.t === 'code') el.textContent = b.x; else printInline(d, el, b.x);
      root.appendChild(el);
    });
  });

  return h('div', { className: 'wo-doc' },
    h('div', { className: 'wo-tools' },
      h(Select, {
        value: cur ? cur.t : 'p', ariaLabel: 'Tipo de bloque', title: 'Tipo del bloque actual',
        options: BLOCK_TYPES.map((b) => ({ value: b.id, label: b.label })),
        onChange: (v) => { if (cur) setBlock(cur.id, { t: v }); },
      }),
      h(Sep),
      h(IconBtn, { icon: 'B', title: 'Negrita (Ctrl+B)', className: 'wo-ibtn-b', onClick: () => cur && applyMark(cur.id, '**') }),
      h(IconBtn, { icon: 'I', title: 'Cursiva (Ctrl+I)', className: 'wo-ibtn-it', onClick: () => cur && applyMark(cur.id, '*') }),
      h(IconBtn, { icon: 'S', title: 'Tachado', className: 'wo-ibtn-s', onClick: () => cur && applyMark(cur.id, '~~') }),
      h(IconBtn, { icon: '‹›', title: 'Código', onClick: () => cur && applyMark(cur.id, '`') }),
      h(IconBtn, { icon: '🔗', title: 'Enlace', onClick: () => cur && applyMark(cur.id, '[', '](https://)') }),
      h(Sep),
      h(IconBtn, { icon: '⬆', title: 'Subir el bloque', onClick: () => cur && moveBlock(cur.id, -1) }),
      h(IconBtn, { icon: '⬇', title: 'Bajar el bloque', onClick: () => cur && moveBlock(cur.id, 1) }),
      h(Sep),
      h(IconBtn, { icon: '📑', title: 'Índice del documento', active: outline, onClick: () => setOutline(!outline) }),
      h(Menu, {
        icon: '⇄', title: 'Exportar',
        items: [
          { icon: '📝', label: 'Exportar Markdown', onClick: exportMd },
          { icon: '📋', label: 'Copiar todo como texto', onClick: () => { void copyText(docToMarkdown(doc)); notify('success', 'Documento copiado.'); } },
          { icon: '🖨️', label: 'Imprimir / PDF', onClick: print },
          { divider: true },
          {
            icon: '👥', label: 'Combinar con Clientes…',
            disabled: !kimosAvailable(),
            onClick: () => setMerge(true),
          },
        ],
      })),

    h('div', { className: 'wo-doc-body' },
      outline ? h('nav', { className: 'wo-outline', 'aria-label': 'Índice' },
        h('div', { className: 'wo-outline-t' }, 'Índice'),
        headings.length
          ? headings.map((b) => h('button', {
            key: b.id, type: 'button', className: cx('wo-outline-i', 'wo-outline-' + b.t),
            onClick: () => {
              const el = refs.current[b.id];
              if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); setFocus(b.id); }
            },
          }, plainText(b.x) || 'Sin título'))
          : h('div', { className: 'wo-outline-e' }, 'Añade títulos para verlos aquí.')) : null,

      h('div', { className: 'wo-page' },
        doc.blocks.map((b, i) => h(DocBlock, {
          key: b.id, block: b, index: i, focused: focus === b.id,
          refs, onFocus: () => setFocus(b.id),
          onChange: (v) => onChangeBlock(b, v),
          onKeyDown: (e) => onKeyDown(e, b, i),
          onPaste: (e) => onPasteBlock(e, b, i),
          onToggle: () => setBlock(b.id, { c: !b.c }),
          onRemove: () => removeBlock(b.id),
          number: b.t === 'ol' ? countOl(doc.blocks, i) : 0,
        })),
        h('button', {
          type: 'button', className: 'wo-doc-add',
          onClick: () => insertAfter(doc.blocks[doc.blocks.length - 1].id, 'p', ''),
        }, '+ Añadir bloque'))),

    h('div', { className: 'wo-sbar' },
      h('div', { className: 'wo-stats' },
        h('span', null, h('b', null, stats.words), ' palabra', stats.words === 1 ? '' : 's'),
        h('span', null, h('b', null, stats.chars), ' caracteres'),
        h('span', null, h('b', null, stats.blocks), ' bloques'))),

    merge ? h(MailMergeDialog, { doc, file, onClose: () => setMerge(false) }) : null);
}

/** Numeración de una lista numerada: reinicia cuando se corta la racha. */
function countOl(blocks, i) {
  let n = 1;
  for (let k = i - 1; k >= 0; k--) { if (blocks[k].t === 'ol') n++; else break; }
  return n;
}

function DocBlock(p) {
  const b = p.block;
  const ta = useRef(null);
  useEffect(() => {
    p.refs.current[b.id] = ta.current;
    return () => { delete p.refs.current[b.id]; };
  }, [b.id]);
  // El área crece con el texto: nunca aparece una barra de scroll dentro de un párrafo.
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }, [b.x, b.t]);

  if (b.t === 'hr') {
    return h('div', { className: 'wo-b wo-b-hr', onClick: p.onFocus },
      h('hr', { className: 'wo-hr' }),
      h(IconBtn, { icon: '✕', title: 'Quitar el separador', className: 'wo-b-x', onClick: p.onRemove }));
  }

  const placeholder = b.t === 'h1' ? 'Título del documento'
    : b.t === 'h2' || b.t === 'h3' ? 'Subtítulo'
      : b.t === 'code' ? 'Código'
        : b.t === 'quote' ? 'Cita'
          : 'Escribe aquí. Prueba "## " para un título o "- " para una lista.';

  return h('div', { className: cx('wo-b', 'wo-b-' + b.t, p.focused && 'wo-b-on') },
    b.t === 'ul' ? h('span', { className: 'wo-bullet', 'aria-hidden': 'true' }, '•') : null,
    b.t === 'ol' ? h('span', { className: 'wo-bullet' , 'aria-hidden': 'true' }, p.number + '.') : null,
    b.t === 'todo' ? h('input', {
      type: 'checkbox', className: 'wo-check', checked: !!b.c, onChange: p.onToggle,
      'aria-label': 'Marcar la tarea como hecha',
    }) : null,
    h('textarea', {
      ref: ta, className: cx('wo-b-in', b.c && b.t === 'todo' && 'wo-b-done'),
      value: b.x, rows: 1, placeholder,
      spellCheck: true,
      onChange: (e) => p.onChange(e.target.value),
      onFocus: p.onFocus,
      onKeyDown: p.onKeyDown,
      onPaste: p.onPaste,
      'aria-label': (BLOCK_BY_ID[b.t] || {}).label || 'Bloque',
    }),
    // Vista con formato: lo que se escribe con marcas se ve aplicado al salir.
    !p.focused && b.x && b.t !== 'code'
      ? h('div', { className: 'wo-b-view', onMouseDown: (e) => { e.preventDefault(); if (ta.current) ta.current.focus(); } },
        h(MarkText, { text: b.x }))
      : null);
}

/**
 * Combinación de correspondencia con la app Clientes: genera un documento por
 * cliente sustituyendo {{nombre}}, {{correo}}, {{empresa}}… Es el caso de uso
 * que más pide una oficina y KIMOS ya tiene los datos: no hay que copiarlos.
 */
function MailMergeDialog(p) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await fetchKimosRows('customers');
      if (alive) setRows(data || []);
    })();
    return () => { alive = false; };
  }, []);

  const doc = docDoc(p.file.data);
  const head = rows && rows[0] ? rows[0] : [];
  const body = rows ? rows.slice(1) : [];
  const fields = head.map((x) => canon(x).replace(/ /g, ''));

  const run = async () => {
    setBusy(true);
    const md = docToMarkdown(doc);
    let made = 0;
    for (const row of body.slice(0, 100)) {
      let text = md;
      fields.forEach((f, i) => {
        const re = new RegExp('\\{\\{\\s*' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\}\\}', 'gi');
        text = text.replace(re, s(row[i]));
      });
      const name = nextFreeName('doc', p.file.name + ' — ' + (s(row[0]) || 'cliente'));
      const created = await createFile('doc', name, { blocks: markdownToBlocks(text) });
      if (created) made++;
    }
    setBusy(false);
    p.onClose();
    notify('success', made + ' documento(s) generados.');
  };

  return h(Modal, {
    title: 'Combinar con Clientes', onClose: p.onClose,
    actions: [
      h(Btn, { key: 'c', label: 'Cancelar', onClick: p.onClose }),
      h(Btn, {
        key: 'k', label: busy ? 'Generando…' : 'Generar documentos', variant: 'primary',
        disabled: busy || !body.length, onClick: run,
      }),
    ],
  },
    h('p', { className: 'wo-modal-msg' },
      'Se crea una copia de este documento por cada cliente, sustituyendo los campos que escribas entre llaves dobles.'),
    rows === null
      ? h('div', { className: 'wo-muted' }, 'Consultando la app Clientes…')
      : !body.length
        ? h('div', { className: 'wo-warn' }, 'No hay clientes visibles para tu usuario.')
        : h('div', null,
          h('div', { className: 'wo-muted' }, body.length + ' cliente(s) disponibles. Campos que puedes usar:'),
          h('div', { className: 'wo-chips' },
            fields.map((f, i) => h('code', { key: f + i, className: 'wo-chip' }, '{{' + f + '}}')))));
}

textExtractors.doc = (f) => docPlain(docDoc(f.data));

// ══════════════════════════════════════════════════════════════════════
// src/50-slides.js
// ══════════════════════════════════════════════════════════════════════
/* ══ PRESENTACIONES ════════════════════════════════════════════════════════
 *
 * Diapositivas con plantilla, notas del orador y modo presentación a pantalla
 * completa. El contenido es el mismo texto con marcas que usa Documentos: una
 * presentación se arma copiando y pegando desde un documento, sin convertir.
 *
 * El modo presentación no abre otra ventana ni pide permisos: ocupa la ventana
 * de la app en pantalla completa, se maneja con ←/→/Espacio/Esc y muestra el
 * reloj y las notas solo a quien presenta.
 */

const LAYOUTS = [
  { id: 'title', label: 'Portada', hint: 'Título grande y bajada' },
  { id: 'bullets', label: 'Título y viñetas', hint: 'Lo más usado' },
  { id: 'body', label: 'Título y texto', hint: 'Párrafo libre' },
  { id: 'two', label: 'Dos columnas', hint: 'Compara dos cosas' },
  { id: 'quote', label: 'Cita', hint: 'Una frase que se recuerde' },
  { id: 'blank', label: 'Solo texto', hint: 'Sin título' },
];

function newSlide(layout) {
  return { id: uid('sl'), l: LAYOUTS.some((x) => x.id === layout) ? layout : 'bullets', t: '', b: '', b2: '', n: '' };
}
function newDeckDoc() {
  const first = newSlide('title');
  first.t = 'Nueva presentación';
  first.b = 'Subtítulo o autor';
  return { slides: [first], active: 0 };
}
function deckDoc(data) {
  const d = data && typeof data === 'object' ? data : {};
  let slides = Array.isArray(d.slides) ? d.slides : [];
  slides = slides.filter((x) => x && typeof x === 'object').map((x) => ({
    id: s(x.id) || uid('sl'),
    l: LAYOUTS.some((y) => y.id === x.l) ? x.l : 'bullets',
    t: s(x.t), b: s(x.b), b2: s(x.b2), n: s(x.n),
  }));
  if (!slides.length) slides = newDeckDoc().slides;
  const active = Math.max(0, Math.min(slides.length - 1, Math.floor(num(d.active, 0))));
  return { slides, active };
}
const deckPlain = (d) => d.slides.map((x) => [x.t, x.b, x.b2, x.n].map(plainText).filter(Boolean).join('\n')).join('\n\n');

/** Las viñetas son una línea cada una: partir por saltos es todo el formato. */
const bulletsOf = (text) => s(text).split('\n').map((x) => x.replace(/^\s*[-*]\s?/, '')).filter((x) => x.trim());

// ── Vista de una diapositiva (misma pieza en miniatura, edición y proyección) ──
function SlideView(p) {
  const sl = p.slide;
  const scale = p.scale || 1;
  const cls = cx('wo-slide', 'wo-slide-' + sl.l, p.mini && 'wo-slide-mini');
  const style = p.mini ? undefined : { fontSize: (scale * 100) + '%' };
  const body = () => {
    if (sl.l === 'title') {
      return [h('h1', { key: 't', className: 'wo-sl-t' }, h(MarkText, { text: sl.t })),
        h('p', { key: 'b', className: 'wo-sl-sub' }, h(MarkText, { text: sl.b }))];
    }
    if (sl.l === 'quote') {
      return [h('blockquote', { key: 'q', className: 'wo-sl-quote' }, h(MarkText, { text: sl.t })),
        h('p', { key: 'a', className: 'wo-sl-by' }, h(MarkText, { text: sl.b }))];
    }
    if (sl.l === 'blank') return [h('div', { key: 'b', className: 'wo-sl-body' }, h(MarkText, { text: sl.b }))];
    const head = h('h2', { key: 'h', className: 'wo-sl-h' }, h(MarkText, { text: sl.t }));
    if (sl.l === 'bullets') {
      return [head, h('ul', { key: 'u', className: 'wo-sl-ul' },
        bulletsOf(sl.b).map((x, i) => h('li', { key: i }, h(MarkText, { text: x }))))];
    }
    if (sl.l === 'two') {
      return [head, h('div', { key: 'c', className: 'wo-sl-cols' },
        h('div', { className: 'wo-sl-col' }, bulletsOf(sl.b).map((x, i) => h('p', { key: i }, h(MarkText, { text: x })))),
        h('div', { className: 'wo-sl-col' }, bulletsOf(sl.b2).map((x, i) => h('p', { key: i }, h(MarkText, { text: x })))))];
    }
    return [head, h('div', { key: 'b', className: 'wo-sl-body' }, h(MarkText, { text: sl.b }))];
  };
  return h('div', { className: cls, style }, body());
}

// ── Modo presentación ───────────────────────────────────────────────────
function Presenter(p) {
  const [i, setI] = useState(p.start || 0);
  const [notesOn, setNotesOn] = useState(false);
  const [started] = useState(() => Date.now());
  const [, tick] = useState(0);
  const slides = p.slides;

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); p.onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') {
        e.preventDefault(); setI((x) => Math.min(slides.length - 1, x + 1)); return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault(); setI((x) => Math.max(0, x - 1)); return;
      }
      if (e.key === 'Home') { e.preventDefault(); setI(0); return; }
      if (e.key === 'End') { e.preventDefault(); setI(slides.length - 1); return; }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setNotesOn((x) => !x); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [slides.length, p.onClose]);

  const elapsed = Math.floor((Date.now() - started) / 1000);
  const clock = pad2(Math.floor(elapsed / 60)) + ':' + pad2(elapsed % 60);
  const sl = slides[Math.min(i, slides.length - 1)];

  return h('div', { className: 'wo-present', role: 'dialog', 'aria-label': 'Modo presentación' },
    h('div', { className: 'wo-present-stage', onClick: () => setI((x) => Math.min(slides.length - 1, x + 1)) },
      h(SlideView, { slide: sl, scale: 1.6 })),
    notesOn && sl.n ? h('div', { className: 'wo-present-notes' }, h(MarkText, { text: sl.n })) : null,
    h('div', { className: 'wo-present-bar' },
      h(IconBtn, { icon: '◀', title: 'Anterior (←)', onClick: () => setI(Math.max(0, i - 1)) }),
      h('span', { className: 'wo-present-n' }, (i + 1) + ' / ' + slides.length),
      h(IconBtn, { icon: '▶', title: 'Siguiente (→)', onClick: () => setI(Math.min(slides.length - 1, i + 1)) }),
      h('span', { className: 'wo-present-clock', title: 'Tiempo transcurrido' }, clock),
      h(IconBtn, { icon: '🗒️', title: 'Notas del orador (N)', active: notesOn, onClick: () => setNotesOn(!notesOn) }),
      h(IconBtn, { icon: '✕', title: 'Salir (Esc)', onClick: p.onClose })),
    h('div', { className: 'wo-present-progress' },
      h('span', { style: { width: (((i + 1) / slides.length) * 100) + '%' } })));
}

// ── Editor ──────────────────────────────────────────────────────────────
function DeckEditor(p) {
  const file = p.file;
  const doc = useMemo(() => deckDoc(file.data), [file.data]);
  const idx = Math.min(doc.active, doc.slides.length - 1);
  const sl = doc.slides[idx];
  const [presenting, setPresenting] = useState(false);

  const write = (slides, active) => patchFile(file.id, { data: { slides, active: active == null ? idx : active } });
  const setSlide = (patch) => write(doc.slides.map((x, i) => (i === idx ? Object.assign({}, x, patch) : x)));
  const addSlide = (layout) => {
    const slides = doc.slides.slice();
    slides.splice(idx + 1, 0, newSlide(layout || sl.l));
    write(slides, idx + 1);
  };
  const dupSlide = () => {
    const slides = doc.slides.slice();
    slides.splice(idx + 1, 0, Object.assign({}, sl, { id: uid('sl') }));
    write(slides, idx + 1);
  };
  const delSlide = () => {
    if (doc.slides.length < 2) { notify('warn', 'La presentación necesita al menos una diapositiva.'); return; }
    const slides = doc.slides.filter((x, i) => i !== idx);
    write(slides, Math.max(0, idx - 1));
  };
  const move = (delta) => {
    const j = idx + delta;
    if (j < 0 || j >= doc.slides.length) return;
    const slides = doc.slides.slice();
    const tmp = slides[idx]; slides[idx] = slides[j]; slides[j] = tmp;
    write(slides, j);
  };

  const print = () => printPage(file.name, (d, root) => {
    doc.slides.forEach((x) => {
      const box = d.createElement('div');
      box.className = 'slide';
      const head = d.createElement(x.l === 'title' ? 'h1' : 'h2');
      printInline(d, head, x.t || (x.l === 'blank' ? '' : ''));
      if (head.textContent) box.appendChild(head);
      const addLines = (text) => {
        bulletsOf(text).forEach((line) => { const el2 = d.createElement('p'); printInline(d, el2, line); box.appendChild(el2); });
      };
      addLines(x.b);
      if (x.l === 'two') addLines(x.b2);
      if (x.n) {
        const nt = d.createElement('div');
        nt.className = 'notes';
        printInline(d, nt, 'Notas: ' + x.n);
        box.appendChild(nt);
      }
      root.appendChild(box);
    });
  });

  const exportMd = () => {
    const out = doc.slides.map((x) => {
      const parts = [];
      if (x.t) parts.push('## ' + x.t);
      bulletsOf(x.b).forEach((l) => parts.push('- ' + l));
      if (x.l === 'two') bulletsOf(x.b2).forEach((l) => parts.push('- ' + l));
      if (x.n) parts.push('\n> Notas: ' + x.n);
      return parts.join('\n');
    }).join('\n\n---\n\n');
    download(file.name + '.md', out + '\n', 'text/markdown');
  };

  const bodyLabel = sl.l === 'title' ? 'Bajada' : sl.l === 'quote' ? 'Autor de la cita'
    : sl.l === 'body' || sl.l === 'blank' ? 'Texto' : 'Viñetas (una por línea)';
  const titleLabel = sl.l === 'quote' ? 'Frase' : 'Título';

  return h('div', { className: 'wo-deck' },
    h('div', { className: 'wo-tools' },
      h(Btn, { icon: '▶', label: 'Presentar', variant: 'primary', onClick: () => setPresenting(true), title: 'Presentar a pantalla completa' }),
      h(Sep),
      h(Menu, {
        icon: '＋', title: 'Añadir diapositiva', align: 'left',
        items: LAYOUTS.map((l) => ({ icon: '▤', label: l.label, hint: l.hint, onClick: () => addSlide(l.id) })),
      }),
      h(IconBtn, { icon: '⧉', title: 'Duplicar', onClick: dupSlide }),
      h(IconBtn, { icon: '⬆', title: 'Subir', onClick: () => move(-1) }),
      h(IconBtn, { icon: '⬇', title: 'Bajar', onClick: () => move(1) }),
      h(IconBtn, { icon: '🗑️', title: 'Eliminar', danger: true, onClick: delSlide }),
      h(Sep),
      h(Select, {
        value: sl.l, ariaLabel: 'Plantilla', title: 'Plantilla de la diapositiva',
        options: LAYOUTS.map((l) => ({ value: l.id, label: l.label })),
        onChange: (v) => setSlide({ l: v }),
      }),
      h(Menu, {
        icon: '⇄', title: 'Exportar',
        items: [
          { icon: '📝', label: 'Exportar Markdown', onClick: exportMd },
          { icon: '🖨️', label: 'Imprimir / PDF', onClick: print },
        ],
      })),

    h('div', { className: 'wo-deck-body' },
      h('div', { className: 'wo-thumbs', role: 'listbox', 'aria-label': 'Diapositivas' },
        doc.slides.map((x, i) => h('button', {
          key: x.id, type: 'button', role: 'option', 'aria-selected': i === idx,
          className: cx('wo-thumb', i === idx && 'wo-thumb-on'),
          onClick: () => write(doc.slides, i),
        },
          h('span', { className: 'wo-thumb-n' }, i + 1),
          h(SlideView, { slide: x, mini: true })))),

      h('div', { className: 'wo-deck-main' },
        h('div', { className: 'wo-deck-stage' }, h(SlideView, { slide: sl })),
        h('div', { className: 'wo-deck-form' },
          sl.l !== 'blank' ? h(Field, { label: titleLabel, wide: true },
            h(TextInput, { value: sl.t, onChange: (v) => setSlide({ t: v }), placeholder: titleLabel })) : null,
          h(Field, { label: bodyLabel, wide: true },
            h('textarea', {
              className: 'wo-in wo-ta', value: sl.b, rows: 4,
              placeholder: sl.l === 'bullets' ? 'Una idea por línea' : bodyLabel,
              onChange: (e) => setSlide({ b: e.target.value }),
              'aria-label': bodyLabel,
            })),
          sl.l === 'two' ? h(Field, { label: 'Segunda columna', wide: true },
            h('textarea', {
              className: 'wo-in wo-ta', value: sl.b2, rows: 4, placeholder: 'Una idea por línea',
              onChange: (e) => setSlide({ b2: e.target.value }), 'aria-label': 'Segunda columna',
            })) : null,
          h(Field, { label: 'Notas del orador (solo las ves tú al presentar)', wide: true },
            h('textarea', {
              className: 'wo-in wo-ta', value: sl.n, rows: 2, placeholder: 'Qué decir en esta diapositiva',
              onChange: (e) => setSlide({ n: e.target.value }), 'aria-label': 'Notas del orador',
            }))))),

    h('div', { className: 'wo-sbar' },
      h('div', { className: 'wo-stats' },
        h('span', null, 'Diapositiva ', h('b', null, idx + 1), ' de ', h('b', null, doc.slides.length)),
        h('span', { className: 'wo-muted' }, 'Presentar: ▶ o F5 · Salir: Esc'))),

    presenting ? h(Presenter, { slides: doc.slides, start: idx, onClose: () => setPresenting(false) }) : null);
}

textExtractors.deck = (f) => deckPlain(deckDoc(f.data));

// ══════════════════════════════════════════════════════════════════════
// src/60-notes.js
// ══════════════════════════════════════════════════════════════════════
/* ══ NOTAS ═════════════════════════════════════════════════════════════════
 *
 * Tablero de notas rápidas del espacio de trabajo: color, fijado, etiquetas y
 * búsqueda. Cada nota es un archivo (`kind: 'note'`), así que se busca, se
 * exporta y se mueve a la papelera igual que un documento.
 *
 * Deslinde con la app **Notas de Equipo** (ver docs/INTEGRACION-KIMOS.md):
 * aquella es el canal del equipo — notas dirigidas a personas, con responsable,
 * menciones y control por agente. Esta es la libreta del espacio de trabajo:
 * apuntes al lado del documento en el que estás. Para no duplicar, WorkOffice
 * **lee** las notas del equipo y las muestra en una pestaña aparte, en solo
 * lectura y con un enlace claro a su app: nada se copia ni se sincroniza.
 */

const NOTE_COLORS = [
  { id: '', label: 'Neutro' },
  { id: 'amber', label: 'Ámbar' },
  { id: 'green', label: 'Verde' },
  { id: 'blue', label: 'Azul' },
  { id: 'pink', label: 'Rosa' },
  { id: 'violet', label: 'Violeta' },
];

function newNoteDoc() { return { x: '', color: '', pin: false, tags: [] }; }
function noteDoc(data) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    x: s(d.x),
    color: NOTE_COLORS.some((c) => c.id === d.color) ? d.color : '',
    pin: !!d.pin,
    tags: Array.isArray(d.tags) ? d.tags.map((t) => s(t).slice(0, 24)).filter(Boolean).slice(0, 8) : [],
  };
}
/** Las etiquetas se escriben en el propio texto con #: nada que rellenar aparte. */
function tagsIn(text) {
  const out = [];
  const re = /(^|\s)#([\p{L}\p{N}_-]{2,24})/gu;
  let m;
  while ((m = re.exec(s(text))) !== null) { if (out.indexOf(m[2]) < 0) out.push(m[2]); }
  return out.slice(0, 8);
}

function NotesBoard(p) {
  const m = p.m;
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [tab, setTab] = useState('mine');
  const [editing, setEditing] = useState('');

  const notes = useMemo(() => {
    const list = filesOfKind('note').map((f) => ({ file: f, note: noteDoc(f.data) }));
    list.sort((a, b) => {
      if (a.note.pin !== b.note.pin) return a.note.pin ? -1 : 1;
      return byRecent(a.file, b.file);
    });
    return list;
  }, [m.files]);

  const allTags = useMemo(() => {
    const set = [];
    notes.forEach((n) => tagsIn(n.note.x).forEach((t) => { if (set.indexOf(t) < 0) set.push(t); }));
    return set.sort();
  }, [notes]);

  const visible = notes.filter((n) => {
    if (tag && tagsIn(n.note.x).indexOf(tag) < 0) return false;
    if (!q) return true;
    const needle = canon(q);
    return canon(n.file.name).indexOf(needle) >= 0 || canon(n.note.x).indexOf(needle) >= 0;
  });

  const team = (m.external.notes || []).filter((n) => !q || canon(n.text).indexOf(canon(q)) >= 0);

  const addNote = async () => {
    const f = await createFile('note', nextFreeName('note', 'Nota'), newNoteDoc());
    if (f) setEditing(f.id);
  };

  const setNote = (file, patch) => {
    patchFile(file.id, { data: Object.assign({}, noteDoc(file.data), patch) });
  };

  useEffect(() => { if (tab === 'team') void refreshExternal(false); }, [tab]);

  return h('div', { className: 'wo-notes' },
    h('div', { className: 'wo-tools' },
      h(Btn, { icon: '＋', label: 'Nueva nota', variant: 'primary', onClick: addNote }),
      h(Sep),
      h('input', {
        className: 'wo-in wo-search', type: 'search', value: q, placeholder: 'Buscar en las notas…',
        onChange: (e) => setQ(e.target.value), 'aria-label': 'Buscar en las notas',
      }),
      allTags.length ? h(Select, {
        value: tag, ariaLabel: 'Filtrar por etiqueta', title: 'Filtrar por etiqueta',
        options: [{ value: '', label: 'Todas las etiquetas' }].concat(allTags.map((t) => ({ value: t, label: '#' + t }))),
        onChange: setTag,
      }) : null,
      h('span', { className: 'wo-grow' }),
      h('div', { className: 'wo-tabs', role: 'tablist' },
        h('button', {
          type: 'button', role: 'tab', 'aria-selected': tab === 'mine',
          className: cx('wo-tab', tab === 'mine' && 'wo-tab-on'), onClick: () => setTab('mine'),
        }, 'Del espacio', h('span', { className: 'wo-tab-n' }, notes.length)),
        kimosAvailable() ? h('button', {
          type: 'button', role: 'tab', 'aria-selected': tab === 'team',
          className: cx('wo-tab', tab === 'team' && 'wo-tab-on'), onClick: () => setTab('team'),
          title: 'Notas de la app Notas de Equipo, en solo lectura',
        }, 'Del equipo', h('span', { className: 'wo-tab-n' }, (m.external.notes || []).length)) : null)),

    tab === 'team'
      ? h('div', { className: 'wo-board' },
        h('div', { className: 'wo-readonly-hint' },
          '👁️ Vista de solo lectura de la app ', h('b', null, 'Notas de Equipo'),
          '. Para escribir, responder o asignar una nota del equipo, abre esa app: WorkOffice no duplica sus datos.'),
        team.length
          ? team.map((n) => h('article', { key: n.id, className: 'wo-note wo-note-ro' },
            h('div', { className: 'wo-note-x' }, h(MarkText, { text: n.text })),
            h('div', { className: 'wo-note-ft' },
              h('span', null, n.author || 'Equipo'),
              n.responsible ? h('span', { className: 'wo-chip' }, '👤 ' + n.responsible) : null,
              h('span', { className: 'wo-muted' }, fmtWhen(n.at)))))
          : h(EmptyState, { icon: '🗒️', title: 'Sin notas del equipo', hint: 'No hay notas visibles para tu usuario en Notas de Equipo.' }))

      : h('div', { className: 'wo-board' },
        visible.length
          ? visible.map((n) => h(NoteCard, {
            key: n.file.id, file: n.file, note: n.note,
            editing: editing === n.file.id,
            onEdit: (on) => setEditing(on ? n.file.id : ''),
            onChange: (patch) => setNote(n.file, patch),
            onRename: (name) => patchFile(n.file.id, { name }),
            onTrash: () => { trashFile(n.file.id); setEditing(''); },
          }))
          : h(EmptyState, {
            icon: '🗒️',
            title: q || tag ? 'Ninguna nota coincide' : 'Sin notas todavía',
            hint: q || tag ? 'Prueba con otras palabras o quita el filtro.' : 'Escribe una idea rápida; usa #etiquetas para agruparlas.',
            action: h(Btn, { icon: '＋', label: 'Nueva nota', variant: 'primary', onClick: addNote }),
          })));
}

function NoteCard(p) {
  const note = p.note;
  const tags = tagsIn(note.x);
  const ta = useRef(null);
  useEffect(() => {
    if (!p.editing) return;
    const el = ta.current;
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* noop */ } }
  }, [p.editing]);

  return h('article', { className: cx('wo-note', note.color && 'wo-note-' + note.color, note.pin && 'wo-note-pin') },
    h('header', { className: 'wo-note-hd' },
      h(FileTitle, { name: p.file.name, onRename: p.onRename }),
      h(IconBtn, { icon: note.pin ? '📌' : '📍', title: note.pin ? 'Quitar de fijadas' : 'Fijar arriba', active: note.pin, onClick: () => p.onChange({ pin: !note.pin }) }),
      h(Menu, {
        items: [
          { icon: '✏️', label: p.editing ? 'Dejar de editar' : 'Editar', onClick: () => p.onEdit(!p.editing) },
          { divider: true },
        ].concat(NOTE_COLORS.map((c) => ({
          icon: c.id ? '●' : '○', label: c.label, active: note.color === c.id,
          onClick: () => p.onChange({ color: c.id }),
        }))).concat([
          { divider: true },
          { icon: '📋', label: 'Copiar el texto', onClick: () => { void copyText(note.x); notify('success', 'Nota copiada.'); } },
          { icon: '🗑️', label: 'Mover a la papelera', danger: true, onClick: p.onTrash },
        ]),
      })),
    p.editing
      ? h('textarea', {
        ref: ta, className: 'wo-note-in', value: note.x, rows: 6,
        placeholder: 'Escribe la nota. **negrita**, *cursiva*, #etiqueta',
        onChange: (e) => p.onChange({ x: e.target.value }),
        onBlur: () => p.onEdit(false),
        'aria-label': 'Texto de la nota',
      })
      : h('div', {
        className: 'wo-note-x', onClick: () => p.onEdit(true), role: 'button', tabIndex: 0,
        onKeyDown: (e) => { if (e.key === 'Enter') p.onEdit(true); },
        title: 'Clic para editar',
      }, note.x ? h(MarkText, { text: note.x }) : h('span', { className: 'wo-muted' }, 'Nota vacía. Clic para escribir.')),
    h('div', { className: 'wo-note-ft' },
      tags.map((t) => h('span', { key: t, className: 'wo-chip' }, '#' + t)),
      h('span', { className: 'wo-grow' }),
      h('span', { className: 'wo-muted', title: 'Última edición' }, fmtWhen(p.file.updatedAt))));
}

textExtractors.note = (f) => noteDoc(f.data).x;

// ══════════════════════════════════════════════════════════════════════
// src/70-calendar.js
// ══════════════════════════════════════════════════════════════════════
/* ══ CALENDARIO ════════════════════════════════════════════════════════════
 *
 * Vistas de mes, semana y agenda sobre los eventos del espacio de trabajo, con
 * las tareas de la app **Planificación** superpuestas en solo lectura.
 *
 * Deslinde con Planificación (docs/INTEGRACION-KIMOS.md): un plan con tareas,
 * dependencias y avance se gestiona allí; aquí se ven *cuándo* caen, junto a
 * las reuniones y los hitos del equipo. WorkOffice nunca escribe una tarea de
 * Planificación: eso duplicaría la fuente de verdad y dejaría dos números
 * distintos para el mismo trabajo.
 *
 * Cada evento es un archivo (`kind: 'event'`), así que aparece en el buscador
 * global y en la papelera como cualquier otro.
 */

const EVENT_COLORS = ['blue', 'green', 'amber', 'pink', 'violet'];

function newEventDoc(day) {
  return { day: s(day) || todayISO(), start: '09:00', end: '10:00', allDay: false, place: '', notes: '', color: 'blue' };
}
function eventDoc(data) {
  const d = data && typeof data === 'object' ? data : {};
  const day = /^\d{4}-\d{2}-\d{2}$/.test(s(d.day)) ? s(d.day) : todayISO();
  const hhmm = (v, fb) => (/^\d{2}:\d{2}$/.test(s(v)) ? s(v) : fb);
  return {
    day,
    start: hhmm(d.start, '09:00'),
    end: hhmm(d.end, '10:00'),
    allDay: !!d.allDay,
    place: s(d.place).slice(0, 120),
    notes: s(d.notes),
    color: EVENT_COLORS.indexOf(s(d.color)) >= 0 ? s(d.color) : 'blue',
  };
}
const eventsOf = (files) => files.filter((f) => f.kind === 'event' && !f.trashed)
  .map((f) => ({ file: f, ev: eventDoc(f.data) }));

/** Matriz de 6 semanas que cubre el mes, empezando el día que prefiera el usuario. */
function monthMatrix(year, month, weekStart) {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() - weekStart + 7) % 7;
  const start = addDays(first, -shift);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) days.push(addDays(start, w * 7 + d));
    weeks.push(days);
  }
  return weeks;
}

function CalendarView(p) {
  const m = p.m;
  const weekStart = m.cfg.weekStart === '0' ? 0 : 1;
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), mo: d.getMonth(), day: todayISO() }; });
  const [openId, setOpenId] = useState('');

  useEffect(() => { void refreshExternal(false); }, []);

  const own = useMemo(() => eventsOf(m.files), [m.files]);
  const plan = m.external.gantt || [];

  /** Índice día → cosas de ese día (propias y de Planificación). */
  const byDay = useMemo(() => {
    const map = {};
    const push = (day, item) => { (map[day] || (map[day] = [])).push(item); };
    own.forEach((e) => push(e.ev.day, { kind: 'event', id: e.file.id, file: e.file, ev: e.ev }));
    plan.forEach((t) => {
      // Una tarea que dura varios días aparece en cada uno, con tope defensivo.
      let d = dayToDate(t.day);
      const end = dayToDate(t.endDay) || d;
      let guard = 0;
      while (d && d <= end && guard++ < 60) { push(isoDay(d), { kind: 'plan', id: t.id + ':' + isoDay(d), task: t }); d = addDays(d, 1); }
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => {
      const ta = a.kind === 'event' ? (a.ev.allDay ? '' : a.ev.start) : '';
      const tb = b.kind === 'event' ? (b.ev.allDay ? '' : b.ev.start) : '';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    }));
    return map;
  }, [own, plan]);

  const addEvent = async (day) => {
    const f = await createFile('event', nextFreeName('event', 'Evento'), newEventDoc(day));
    if (f) setOpenId(f.id);
  };

  const go = (delta) => {
    if (view === 'month') {
      const d = new Date(cursor.y, cursor.mo + delta, 1);
      setCursor({ y: d.getFullYear(), mo: d.getMonth(), day: cursor.day });
    } else {
      const base = dayToDate(cursor.day) || new Date();
      const next = addDays(base, delta * (view === 'week' ? 7 : 30));
      setCursor({ y: next.getFullYear(), mo: next.getMonth(), day: isoDay(next) });
    }
  };
  const goToday = () => { const d = new Date(); setCursor({ y: d.getFullYear(), mo: d.getMonth(), day: todayISO() }); };

  const title = view === 'month'
    ? cap(MONTHS[cursor.mo]) + ' ' + cursor.y
    : view === 'week'
      ? 'Semana del ' + fmtDay(isoDay(weekStartOf(dayToDate(cursor.day) || new Date(), weekStart)))
      : 'Próximos 30 días';

  const openFile = openId ? getFile(openId) : null;

  return h('div', { className: 'wo-cal' },
    h('div', { className: 'wo-tools' },
      h(Btn, { icon: '＋', label: 'Nuevo evento', variant: 'primary', onClick: () => addEvent(view === 'month' ? todayISO() : cursor.day) }),
      h(Sep),
      h(IconBtn, { icon: '‹', title: 'Anterior', onClick: () => go(-1) }),
      h(Btn, { label: 'Hoy', onClick: goToday }),
      h(IconBtn, { icon: '›', title: 'Siguiente', onClick: () => go(1) }),
      h('span', { className: 'wo-cal-title' }, title),
      h('span', { className: 'wo-grow' }),
      h('div', { className: 'wo-tabs', role: 'tablist' },
        [['month', 'Mes'], ['week', 'Semana'], ['agenda', 'Agenda']].map((v) => h('button', {
          key: v[0], type: 'button', role: 'tab', 'aria-selected': view === v[0],
          className: cx('wo-tab', view === v[0] && 'wo-tab-on'), onClick: () => setView(v[0]),
        }, v[1]))),
      plan.length ? h('span', { className: 'wo-chip', title: 'Tareas de la app Planificación, en solo lectura' },
        '📊 ' + plan.length + ' de Planificación') : null),

    view === 'month' ? h(MonthGrid, {
      y: cursor.y, mo: cursor.mo, weekStart, byDay,
      onDay: (day) => { setCursor({ y: cursor.y, mo: cursor.mo, day }); setView('week'); },
      onAdd: addEvent, onOpen: setOpenId,
    }) : null,
    view === 'week' ? h(WeekList, {
      day: cursor.day, weekStart, byDay, onAdd: addEvent, onOpen: setOpenId,
    }) : null,
    view === 'agenda' ? h(AgendaList, { byDay, onOpen: setOpenId, onAdd: addEvent }) : null,

    openFile ? h(EventDialog, {
      file: openFile,
      onClose: () => setOpenId(''),
      onChange: (patch) => patchFile(openFile.id, { data: Object.assign({}, eventDoc(openFile.data), patch) }),
      onRename: (name) => patchFile(openFile.id, { name }),
      onTrash: () => { trashFile(openFile.id); setOpenId(''); },
    }) : null);
}

function weekStartOf(d, weekStart) {
  const shift = (d.getDay() - weekStart + 7) % 7;
  return addDays(d, -shift);
}

function DayChip(p) {
  if (p.item.kind === 'plan') {
    return h('span', {
      className: 'wo-ev wo-ev-plan',
      title: 'Planificación · ' + p.item.task.plan + (p.item.task.owner ? ' · ' + p.item.task.owner : '') + ' (solo lectura)',
    }, '📊 ', p.item.task.title);
  }
  const ev = p.item.ev;
  return h('button', {
    type: 'button', className: cx('wo-ev', 'wo-ev-' + ev.color),
    onClick: (e) => { e.stopPropagation(); p.onOpen(p.item.id); },
    title: p.item.file.name + (ev.place ? ' · ' + ev.place : ''),
  }, ev.allDay ? '' : ev.start + ' ', p.item.file.name);
}

function MonthGrid(p) {
  const weeks = monthMatrix(p.y, p.mo, p.weekStart);
  const heads = [];
  for (let i = 0; i < 7; i++) heads.push(cap(DAYS_SHORT[(p.weekStart + i) % 7]));
  const today = todayISO();
  return h('div', { className: 'wo-month' },
    h('div', { className: 'wo-month-hd' }, heads.map((x) => h('div', { key: x, className: 'wo-month-h' }, x))),
    h('div', { className: 'wo-month-bd' },
      weeks.map((week, wi) => h('div', { key: wi, className: 'wo-month-row' },
        week.map((d) => {
          const iso = isoDay(d);
          const items = p.byDay[iso] || [];
          const other = d.getMonth() !== p.mo;
          return h('div', {
            key: iso,
            className: cx('wo-day', other && 'wo-day-out', iso === today && 'wo-day-today'),
            onDoubleClick: () => p.onAdd(iso),
            title: 'Doble clic para crear un evento',
          },
            h('div', { className: 'wo-day-hd' },
              h('button', { type: 'button', className: 'wo-day-n', onClick: () => p.onDay(iso) }, d.getDate()),
              items.length > 3 ? h('span', { className: 'wo-day-more' }, '+' + (items.length - 3)) : null),
            items.slice(0, 3).map((it) => h(DayChip, { key: it.id, item: it, onOpen: p.onOpen })));
        })))));
}

function WeekList(p) {
  const start = weekStartOf(dayToDate(p.day) || new Date(), p.weekStart);
  const today = todayISO();
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  return h('div', { className: 'wo-week' },
    days.map((d) => {
      const iso = isoDay(d);
      const items = p.byDay[iso] || [];
      return h('section', { key: iso, className: cx('wo-wday', iso === today && 'wo-wday-today') },
        h('header', { className: 'wo-wday-hd' },
          h('span', { className: 'wo-wday-n' }, cap(DAYS_LONG[d.getDay()])),
          h('span', { className: 'wo-muted' }, fmtDay(iso)),
          h('span', { className: 'wo-grow' }),
          h(IconBtn, { icon: '＋', title: 'Añadir evento este día', onClick: () => p.onAdd(iso) })),
        items.length
          ? h('div', { className: 'wo-wday-list' }, items.map((it) => h(DayChip, { key: it.id, item: it, onOpen: p.onOpen })))
          : h('div', { className: 'wo-wday-empty' }, 'Sin nada agendado'));
    }));
}

function AgendaList(p) {
  const out = [];
  let d = new Date();
  for (let i = 0; i < 30; i++) {
    const iso = isoDay(d);
    const items = p.byDay[iso] || [];
    if (items.length) out.push({ iso, items });
    d = addDays(d, 1);
  }
  if (!out.length) {
    return h(EmptyState, {
      icon: '📅', title: 'Nada agendado en los próximos 30 días',
      hint: 'Crea un evento o abre la app Planificación para ver tareas con fecha.',
      action: h(Btn, { icon: '＋', label: 'Nuevo evento', variant: 'primary', onClick: () => p.onAdd(todayISO()) }),
    });
  }
  return h('div', { className: 'wo-agenda' },
    out.map((row) => h('section', { key: row.iso, className: 'wo-agenda-row' },
      h('div', { className: 'wo-agenda-d' },
        h('b', null, fmtDay(row.iso)),
        h('span', { className: 'wo-muted' }, cap(DAYS_LONG[(dayToDate(row.iso) || new Date()).getDay()]))),
      h('div', { className: 'wo-agenda-i' }, row.items.map((it) => h(DayChip, { key: it.id, item: it, onOpen: p.onOpen }))))));
}

function EventDialog(p) {
  const ev = eventDoc(p.file.data);
  const badRange = !ev.allDay && ev.end <= ev.start;
  return h(Modal, {
    title: 'Evento', onClose: p.onClose,
    actions: [
      h(Btn, { key: 'd', icon: '🗑️', label: 'Mover a la papelera', variant: 'danger', onClick: p.onTrash }),
      h('span', { key: 'g', className: 'wo-grow' }),
      h(Btn, { key: 'c', label: 'Listo', variant: 'primary', onClick: p.onClose }),
    ],
  },
    h(Field, { label: 'Título', wide: true },
      h(TextInput, { value: p.file.name, onChange: p.onRename, autoFocus: true, placeholder: 'Reunión de equipo' })),
    h('div', { className: 'wo-row' },
      h(Field, { label: 'Día' },
        h(TextInput, { type: 'date', value: ev.day, onChange: (v) => p.onChange({ day: v || todayISO() }) })),
      h(Field, { label: 'Todo el día' },
        h('input', {
          type: 'checkbox', className: 'wo-check', checked: ev.allDay,
          onChange: (e) => p.onChange({ allDay: e.target.checked }), 'aria-label': 'Todo el día',
        })),
      !ev.allDay ? h(Field, { label: 'Desde' },
        h(TextInput, { type: 'time', value: ev.start, onChange: (v) => p.onChange({ start: v || '09:00' }) })) : null,
      !ev.allDay ? h(Field, { label: 'Hasta' },
        h(TextInput, { type: 'time', value: ev.end, onChange: (v) => p.onChange({ end: v || '10:00' }) })) : null),
    badRange ? h('div', { className: 'wo-warn' }, 'La hora de término es anterior o igual a la de inicio.') : null,
    h(Field, { label: 'Lugar o enlace', wide: true },
      h(TextInput, { value: ev.place, onChange: (v) => p.onChange({ place: v }), placeholder: 'Sala 2 · https://meet…' })),
    h(Field, { label: 'Color', wide: true },
      h('div', { className: 'wo-colors' },
        EVENT_COLORS.map((c) => h('button', {
          key: c, type: 'button', className: cx('wo-color', 'wo-ev-' + c, ev.color === c && 'wo-color-on'),
          onClick: () => p.onChange({ color: c }), title: c, 'aria-label': 'Color ' + c,
        })))),
    h(Field, { label: 'Notas', wide: true },
      h('textarea', {
        className: 'wo-in wo-ta', value: ev.notes, rows: 3, placeholder: 'Temario, participantes, enlaces…',
        onChange: (e) => p.onChange({ notes: e.target.value }), 'aria-label': 'Notas del evento',
      })));
}

textExtractors.event = (f) => {
  const ev = eventDoc(f.data);
  return [ev.day, ev.place, ev.notes].filter(Boolean).join(' ');
};

// ══════════════════════════════════════════════════════════════════════
// src/80-drive.js
// ══════════════════════════════════════════════════════════════════════
/* ══ INICIO (EXPLORADOR DEL ESPACIO) ═══════════════════════════════════════
 *
 * La pantalla que se ve al abrir: qué hay, qué se tocó hace poco y qué se puede
 * crear. Es también el explorador que cada módulo reutiliza cuando todavía no
 * hay un archivo abierto, para que "abrir" signifique lo mismo en toda la app.
 *
 * Decisión de diseño: nada de carpetas. En una suite de equipo las carpetas
 * envejecen mal (nadie recuerda dónde guardó) y obligan a decidir antes de
 * escribir. Aquí manda el uso: recientes primero, favoritos arriba, y un
 * buscador que entra en el CONTENIDO de los archivos, no solo en el nombre.
 * Las etiquetas (#) de las notas cubren la agrupación cuando hace falta.
 */

function fileActions(file, ctx) {
  return [
    { icon: '📂', label: 'Abrir', onClick: () => ctx.open(file) },
    { icon: file.star ? '⭐' : '☆', label: file.star ? 'Quitar de favoritos' : 'Marcar como favorito', onClick: () => patchFile(file.id, { star: !file.star }, { immediate: true }) },
    { icon: '⧉', label: 'Duplicar', onClick: () => { void duplicateFile(file.id); } },
    { icon: '✏️', label: 'Renombrar', onClick: () => ctx.rename(file) },
    { divider: true },
    { icon: '🗑️', label: 'Mover a la papelera', danger: true, onClick: () => trashFile(file.id) },
  ];
}

function FileRow(p) {
  const f = p.file;
  const k = KINDS[kindOf(f)];
  return h('div', { className: 'wo-frow' },
    h('button', {
      type: 'button', className: 'wo-frow-main', onClick: () => p.ctx.open(f),
      title: 'Abrir ' + f.name,
    },
      h('span', { className: 'wo-frow-i', 'aria-hidden': 'true' }, k.icon),
      h('span', { className: 'wo-frow-t' },
        h('span', { className: 'wo-frow-n' }, f.star ? '⭐ ' : '', f.name),
        h('span', { className: 'wo-frow-m' },
          k.label,
          ' · ', fmtWhen(f.updatedAt || f.createdAt),
          f.updatedBy ? ' · ' + f.updatedBy : '')),
      p.excerpt ? h('span', { className: 'wo-frow-x' }, p.excerpt) : null),
    p.trashed
      ? h('span', { className: 'wo-frow-a' },
        h(Btn, { label: 'Restaurar', onClick: () => restoreFile(f.id) }),
        h(IconBtn, { icon: '✕', title: 'Eliminar definitivamente', danger: true, onClick: () => p.ctx.destroy(f) }))
      : h(Menu, { items: fileActions(f, p.ctx) }));
}

/** Listado de un tipo concreto: lo usan Documentos, Hojas y Presentaciones. */
function FileBrowser(p) {
  const kind = p.kind;
  const k = KINDS[kind];
  const list = filesOfKind(kind);
  const [q, setQ] = useState('');
  const shown = q ? list.filter((f) => canon(f.name).indexOf(canon(q)) >= 0 || canon(fileText(f)).indexOf(canon(q)) >= 0) : list;
  return h('div', { className: 'wo-browser' },
    h('div', { className: 'wo-tools' },
      h(Btn, { icon: '＋', label: 'Nuevo: ' + k.label.toLowerCase(), variant: 'primary', onClick: () => p.ctx.create(kind) }),
      h(Sep),
      h('input', {
        className: 'wo-in wo-search', type: 'search', value: q,
        placeholder: 'Buscar en ' + k.plural.toLowerCase() + '…',
        onChange: (e) => setQ(e.target.value), 'aria-label': 'Buscar',
      })),
    shown.length
      ? h('div', { className: 'wo-flist' }, shown.map((f) => h(FileRow, { key: f.id, file: f, ctx: p.ctx })))
      : h(EmptyState, {
        icon: k.icon,
        title: q ? 'Nada coincide con "' + q + '"' : 'Todavía no hay ' + k.plural.toLowerCase(),
        hint: q ? 'Prueba con otras palabras.' : 'Crea el primero y empieza a trabajar.',
        action: q ? null : h(Btn, { icon: '＋', label: 'Crear ' + k.label.toLowerCase(), variant: 'primary', onClick: () => p.ctx.create(kind) }),
      }));
}

function DriveView(p) {
  const m = p.m;
  const ctx = p.ctx;
  const [tab, setTab] = useState('recent');

  const alive = m.files.filter((f) => !f.trashed);
  const trashed = m.files.filter((f) => f.trashed).sort(byRecent);
  const stars = alive.filter((f) => f.star).sort(byRecent);
  const recent = alive.slice().sort(byRecent);
  const results = m.query ? searchFiles(m.query) : null;

  const counts = {};
  Object.keys(KINDS).forEach((k) => { counts[k] = alive.filter((f) => f.kind === k).length; });

  if (results) {
    return h('div', { className: 'wo-drive' },
      h('div', { className: 'wo-drive-hd' },
        h('h2', { className: 'wo-h2' }, 'Resultados para "' + m.query + '"'),
        h(Btn, { label: 'Limpiar búsqueda', onClick: () => setModel({ query: '' }) })),
      results.length
        ? h('div', { className: 'wo-flist' },
          results.map((r) => h(FileRow, { key: r.file.id, file: r.file, ctx, excerpt: r.excerpt })))
        : h(EmptyState, {
          icon: '🔎', title: 'Sin resultados',
          hint: 'Se buscó en el nombre y en el contenido de todos los archivos del espacio.',
        }));
  }

  return h('div', { className: 'wo-drive' },
    h('div', { className: 'wo-newbar' },
      Object.keys(KINDS).map((k) => h('button', {
        key: k, type: 'button', className: 'wo-new', onClick: () => ctx.create(k),
        title: 'Crear ' + KINDS[k].label.toLowerCase(),
      },
        h('span', { className: 'wo-new-i', 'aria-hidden': 'true' }, KINDS[k].icon),
        h('span', { className: 'wo-new-t' }, KINDS[k].label),
        h('span', { className: 'wo-new-n' }, counts[k] || 0)))),

    h('div', { className: 'wo-tabs wo-tabs-line', role: 'tablist' },
      [['recent', 'Recientes', recent.length], ['star', 'Favoritos', stars.length], ['trash', 'Papelera', trashed.length]]
        .map((t) => h('button', {
          key: t[0], type: 'button', role: 'tab', 'aria-selected': tab === t[0],
          className: cx('wo-tab', tab === t[0] && 'wo-tab-on'), onClick: () => setTab(t[0]),
        }, t[1], h('span', { className: 'wo-tab-n' }, t[2])))),

    tab === 'trash'
      ? (trashed.length
        ? h('div', null,
          h('div', { className: 'wo-readonly-hint' },
            '🗑️ Lo de la papelera no se ve en los módulos, pero se puede restaurar. El borrado definitivo no tiene vuelta atrás.',
            h(Btn, { label: 'Vaciar la papelera', variant: 'danger', onClick: () => ctx.emptyTrash(trashed) })),
          h('div', { className: 'wo-flist' },
            trashed.map((f) => h(FileRow, { key: f.id, file: f, ctx, trashed: true }))))
        : h(EmptyState, { icon: '🗑️', title: 'La papelera está vacía', hint: 'Lo que elimines aparecerá aquí antes de borrarse del todo.' }))
      : tab === 'star'
        ? (stars.length
          ? h('div', { className: 'wo-flist' }, stars.map((f) => h(FileRow, { key: f.id, file: f, ctx })))
          : h(EmptyState, { icon: '⭐', title: 'Sin favoritos', hint: 'Marca con ⭐ lo que abras a diario para tenerlo siempre a mano.' }))
        : (recent.length
          ? h('div', { className: 'wo-flist' }, recent.slice(0, 60).map((f) => h(FileRow, { key: f.id, file: f, ctx })))
          : h(EmptyState, {
            icon: '🧰', title: 'Tu espacio de trabajo está vacío',
            hint: 'Crea un documento, una hoja de cálculo o una presentación con los botones de arriba. Todo se guarda solo.',
          })));
}

// ══════════════════════════════════════════════════════════════════════
// src/85-agent.js
// ══════════════════════════════════════════════════════════════════════
/* ══ CONTROL POR AGENTE IA ═════════════════════════════════════════════════
 *
 * El agente usa **las mismas funciones que la interfaz** (`createFile`,
 * `patchFile`, `trashFile`): no hay un camino paralelo que pueda desincronizar
 * la pantalla del dato guardado. Cuando el agente escribe, la ventana se
 * repinta sola porque el modelo es uno solo.
 *
 * Reglas que sigue este archivo (APP-SPEC §6):
 *   · `getSnapshot()` devuelve IDs y nombres suficientes para que el agente
 *     sepa sobre qué actuar ANTES de despachar nada.
 *   · Todo input se valida y se normaliza: el agente puede mandar un rango
 *     absurdo, un tipo que no existe o un nombre que no está.
 *   · Los errores explican qué había disponible, para que el agente corrija
 *     solo en el siguiente intento en vez de insistir a ciegas.
 *   · El agente NO puede vaciar la papelera ni borrar definitivamente: lo
 *     destructivo sin vuelta atrás se queda en manos de la persona.
 */

const AGENT_TOOLS = [
  {
    name: 'LIST_FILES',
    description: 'Lista los archivos del espacio de trabajo. Opcionalmente filtra por tipo.',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['doc', 'sheet', 'deck', 'note', 'event'] } },
    },
  },
  {
    name: 'SEARCH',
    description: 'Busca texto en el nombre y en el contenido de todos los archivos.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'READ_FILE',
    description: 'Devuelve el contenido de un archivo en texto (Markdown para documentos, tabla para hojas).',
    inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] },
  },
  {
    name: 'CREATE_FILE',
    description: 'Crea un archivo. Para documentos, `content` admite Markdown; para hojas, filas separadas '
      + 'por saltos de línea y columnas por tabulador o punto y coma.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['doc', 'sheet', 'deck', 'note', 'event'] },
        name: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['kind'],
    },
  },
  {
    name: 'RENAME_FILE',
    description: 'Cambia el nombre de un archivo.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, name: { type: 'string' } }, required: ['file', 'name'] },
  },
  {
    name: 'DELETE_FILE',
    description: 'Mueve un archivo a la papelera (reversible; el borrado definitivo lo hace la persona).',
    inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] },
  },
  {
    name: 'OPEN_FILE',
    description: 'Abre un archivo en su módulo y lo deja a la vista del usuario.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] },
  },
  {
    name: 'SHEET_SET',
    description: 'Escribe en una hoja de cálculo. `cell` es una dirección A1 y `values` una tabla '
      + '(lista de filas); también acepta `value` para una sola celda. Las fórmulas empiezan con "=".',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        sheet: { type: 'string', description: 'Nombre de la hoja dentro del archivo (opcional).' },
        cell: { type: 'string', description: 'Dirección A1 donde empieza la escritura. Por defecto A1.' },
        value: { type: 'string' },
        values: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['file'],
    },
  },
  {
    name: 'DOC_APPEND',
    description: 'Añade texto en Markdown al final de un documento.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, text: { type: 'string' } }, required: ['file', 'text'] },
  },
  {
    name: 'SLIDE_ADD',
    description: 'Añade una diapositiva a una presentación.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        layout: { type: 'string', enum: ['title', 'bullets', 'body', 'two', 'quote', 'blank'] },
        title: { type: 'string' },
        body: { type: 'string', description: 'Una viñeta por línea.' },
        notes: { type: 'string' },
      },
      required: ['file'],
    },
  },
  {
    name: 'NOTE_ADD',
    description: 'Crea una nota rápida en el tablero de Notas.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'EVENT_ADD',
    description: 'Agenda un evento en el calendario.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        day: { type: 'string', description: 'Fecha AAAA-MM-DD.' },
        start: { type: 'string', description: 'Hora HH:MM.' },
        end: { type: 'string', description: 'Hora HH:MM.' },
        place: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['title', 'day'],
    },
  },
  {
    name: 'GO_TO',
    description: 'Cambia de módulo: inicio, documentos, hojas, presentaciones, notas o calendario.',
    inputSchema: { type: 'object', properties: { module: { type: 'string' } }, required: ['module'] },
  },
];

const AGENT_ALIASES = {
  NEW_FILE: 'CREATE_FILE', ADD_FILE: 'CREATE_FILE', CREATE_DOCUMENT: 'CREATE_FILE',
  GET_FILES: 'LIST_FILES', FILES: 'LIST_FILES', LIST: 'LIST_FILES',
  FIND: 'SEARCH', BUSCAR: 'SEARCH',
  SET_CELL: 'SHEET_SET', SHEET_SET_CELL: 'SHEET_SET', WRITE_CELLS: 'SHEET_SET',
  APPEND_DOC: 'DOC_APPEND', DOC_WRITE: 'DOC_APPEND',
  ADD_SLIDE: 'SLIDE_ADD', ADD_NOTE: 'NOTE_ADD', ADD_EVENT: 'EVENT_ADD',
  REMOVE_FILE: 'DELETE_FILE', TRASH_FILE: 'DELETE_FILE',
  GOTO: 'GO_TO', OPEN: 'OPEN_FILE', SHOW: 'OPEN_FILE',
};

const KIND_WORDS = {
  doc: 'doc', documento: 'doc', documentos: 'doc', document: 'doc', texto: 'doc',
  sheet: 'sheet', hoja: 'sheet', hojas: 'sheet', planilla: 'sheet', calculo: 'sheet', excel: 'sheet',
  deck: 'deck', presentacion: 'deck', presentaciones: 'deck', diapositivas: 'deck', slides: 'deck',
  note: 'note', nota: 'note', notas: 'note',
  event: 'event', evento: 'event', eventos: 'event', calendario: 'event', reunion: 'event',
};
const normKind = (v) => KIND_WORDS[canon(v).replace(/ /g, '')] || null;

/** Resuelve "el archivo X" por id o por nombre, tolerando tildes y mayúsculas. */
function findFileRef(ref, kind) {
  const raw = s(ref).trim();
  if (!raw) return null;
  const pool = model.files.filter((f) => !f.trashed && (!kind || f.kind === kind));
  const byId = pool.find((f) => f.id === raw);
  if (byId) return byId;
  const needle = canon(raw);
  return pool.find((f) => canon(f.name) === needle)
    || pool.find((f) => canon(f.name).indexOf(needle) >= 0)
    || null;
}
const fileNames = (kind) => {
  const names = model.files.filter((f) => !f.trashed && (!kind || f.kind === kind)).map((f) => f.name);
  return names.length ? names.slice(0, 25).join(', ') : '(ninguno)';
};

/** Texto legible de cualquier archivo, para READ_FILE y para el snapshot. */
function fileToText(f) {
  if (f.kind === 'doc') return docToMarkdown(docDoc(f.data));
  if (f.kind === 'note') return noteDoc(f.data).x;
  if (f.kind === 'event') {
    const ev = eventDoc(f.data);
    return [f.name, ev.day + (ev.allDay ? ' (todo el día)' : ' ' + ev.start + '–' + ev.end),
      ev.place ? 'Lugar: ' + ev.place : '', ev.notes].filter(Boolean).join('\n');
  }
  if (f.kind === 'deck') {
    return deckDoc(f.data).slides.map((sl, i) => '--- Diapositiva ' + (i + 1) + ' (' + sl.l + ')\n'
      + [sl.t, sl.b, sl.b2, sl.n ? 'Notas: ' + sl.n : ''].filter(Boolean).join('\n')).join('\n\n');
  }
  if (f.kind === 'sheet') {
    const doc = sheetDoc(f.data);
    return doc.sheets.map((sh) => {
      const ev = makeSheetEval(sh.cells, {});
      let maxR = -1; let maxC = -1;
      Object.keys(sh.cells).forEach((a) => {
        const at = parseAddr(a);
        if (!at) return;
        if (at.r > maxR) maxR = at.r;
        if (at.c > maxC) maxC = at.c;
      });
      const lines = [];
      for (let r = 0; r <= Math.min(maxR, 200); r++) {
        const row = [];
        for (let c = 0; c <= Math.min(maxC, 40); c++) {
          row.push(formatValue(ev.get(r, c), (sh.cells[addrOf(r, c)] || {}).f || '', model.cfg.currency));
        }
        lines.push(row.join('\t'));
      }
      return '# ' + sh.name + '\n' + lines.join('\n');
    }).join('\n\n');
  }
  return s(f.name);
}

/** Contenido inicial que el agente puede pasar al crear un archivo. */
function seedData(kind, content) {
  const text = s(content);
  if (kind === 'doc') return { blocks: text ? markdownToBlocks(text) : newDocDoc().blocks };
  if (kind === 'note') return Object.assign(newNoteDoc(), { x: text });
  if (kind === 'event') return newEventDoc(/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : todayISO());
  if (kind === 'deck') {
    if (!text) return newDeckDoc();
    // Cada bloque separado por línea en blanco es una diapositiva; la primera
    // línea es el título y el resto, viñetas.
    const chunks = text.split(/\n\s*\n/).filter((x) => x.trim());
    const slides = chunks.map((chunk) => {
      const lines = chunk.split('\n').filter((x) => x.trim());
      const sl = newSlide('bullets');
      sl.t = s(lines[0]).replace(/^#+\s*/, '');
      sl.b = lines.slice(1).join('\n');
      return sl;
    });
    return { slides: slides.length ? slides : newDeckDoc().slides, active: 0 };
  }
  if (kind === 'sheet') {
    const sh = newSheet('Hoja 1');
    if (text) {
      const rows = parseDelimited(text, guessDelim(text));
      const changes = {};
      rows.forEach((row, r) => row.forEach((v, c) => {
        if (r >= MAX_ROWS || c >= MAX_COLS) return;
        if (s(v)) changes[addrOf(r, c)] = Object.assign({ v: s(v) }, r === 0 ? { b: true } : {});
      }));
      return { sheets: [withCells(sh, changes)], active: 0 };
    }
    return { sheets: [sh], active: 0 };
  }
  return {};
}

async function agentDispatch(action) {
  const type = AGENT_ALIASES[action.type] || action.type;
  const p = (action && action.payload) || {};
  const ref = p.file != null ? p.file : (p.name != null ? p.name : p.id);

  // Antes de responder sobre el contenido del espacio se relee del servidor:
  // si otra persona creó o borró algo, el agente no debe contestar con una
  // foto vieja.
  if (type === 'LIST_FILES' || type === 'SEARCH') { try { await refresh(false); } catch (e) { /* se responde con lo que hay */ } }

  if (type === 'LIST_FILES') {
    const kind = p.kind ? normKind(p.kind) : null;
    if (p.kind && !kind) return { success: false, error: 'Tipo desconocido: "' + p.kind + '". Válidos: documento, hoja, presentación, nota, evento.' };
    const list = model.files.filter((f) => !f.trashed && (!kind || f.kind === kind)).sort(byRecent);
    return {
      success: true,
      message: list.length
        ? list.length + ' archivo(s): ' + list.slice(0, 40).map((f) => KINDS[f.kind].icon + ' ' + f.name
          + ' (' + KINDS[f.kind].label.toLowerCase() + ', ' + fmtWhen(f.updatedAt) + ')').join(' · ')
        : 'El espacio de trabajo no tiene archivos todavía.',
    };
  }

  if (type === 'SEARCH') {
    const q = s(p.query).trim();
    if (!q) return { success: false, error: 'Falta el texto a buscar.' };
    const hits = searchFiles(q);
    return {
      success: true,
      message: hits.length
        ? hits.length + ' coincidencia(s): ' + hits.slice(0, 20).map((r) => r.file.name
          + (r.excerpt ? ' — "' + r.excerpt.slice(0, 80) + '"' : ' (en el nombre)')).join(' · ')
        : 'Sin resultados para "' + q + '".',
    };
  }

  if (type === 'READ_FILE') {
    const f = findFileRef(ref);
    if (!f) return { success: false, error: 'No encontré "' + s(ref) + '". Archivos: ' + fileNames() + '.' };
    const text = fileToText(f);
    return { success: true, message: KINDS[f.kind].label + ' "' + f.name + '":\n' + text.slice(0, 8000) };
  }

  if (type === 'CREATE_FILE') {
    const kind = normKind(p.kind);
    if (!kind) return { success: false, error: 'Falta el tipo. Válidos: documento, hoja, presentación, nota, evento.' };
    const name = s(p.name).trim().slice(0, 120) || nextFreeName(kind);
    const created = await createFile(kind, nextFreeName(kind, name), seedData(kind, p.content));
    if (!created) return { success: false, error: 'No se pudo crear el archivo (sin conexión).' };
    setModel({ module: KINDS[kind].module, openId: kind === 'note' || kind === 'event' ? '' : created.id });
    return { success: true, message: KINDS[kind].label + ' "' + created.name + '" creado y abierto.' };
  }

  if (type === 'RENAME_FILE') {
    const f = findFileRef(ref);
    if (!f) return { success: false, error: 'No encontré "' + s(ref) + '". Archivos: ' + fileNames() + '.' };
    const name = s(p.name || p.newName).trim().slice(0, 120);
    if (!name) return { success: false, error: 'El nombre no puede quedar vacío.' };
    patchFile(f.id, { name }, { immediate: true });
    return { success: true, message: 'Renombrado a "' + name + '".' };
  }

  if (type === 'DELETE_FILE') {
    const f = findFileRef(ref);
    if (!f) return { success: false, error: 'No encontré "' + s(ref) + '". Archivos: ' + fileNames() + '.' };
    trashFile(f.id);
    return { success: true, message: '"' + f.name + '" quedó en la papelera; se puede restaurar desde Inicio.' };
  }

  if (type === 'OPEN_FILE') {
    const f = findFileRef(ref);
    if (!f) return { success: false, error: 'No encontré "' + s(ref) + '". Archivos: ' + fileNames() + '.' };
    openFileInModule(f);
    return { success: true, message: 'Abrí "' + f.name + '".' };
  }

  if (type === 'SHEET_SET') {
    const f = findFileRef(ref, 'sheet');
    if (!f) return { success: false, error: 'No encontré la hoja "' + s(ref) + '". Hojas: ' + fileNames('sheet') + '.' };
    const doc = sheetDoc(f.data);
    let idx = doc.active;
    if (p.sheet) {
      const found = doc.sheets.findIndex((sh) => canon(sh.name) === canon(p.sheet));
      if (found < 0) return { success: false, error: 'La hoja "' + p.sheet + '" no existe en "' + f.name + '". Hojas: ' + doc.sheets.map((x) => x.name).join(', ') + '.' };
      idx = found;
    }
    const at = parseAddr(p.cell || 'A1');
    if (!at) return { success: false, error: 'Dirección inválida: "' + s(p.cell) + '". Usa formato A1.' };
    let grid = null;
    if (Array.isArray(p.values)) grid = p.values.map((row) => (Array.isArray(row) ? row : [row]));
    else if (p.value != null) grid = [[p.value]];
    else if (p.text != null) grid = parseDelimited(s(p.text), guessDelim(s(p.text)));
    if (!grid || !grid.length) return { success: false, error: 'Falta `value` o `values` con lo que escribir.' };
    if (grid.length * (grid[0].length || 1) > 20000) return { success: false, error: 'Demasiadas celdas de una vez (máximo 20 000).' };
    const changes = {};
    let written = 0;
    grid.forEach((row, r) => row.forEach((v, c) => {
      const rr = at.r + r; const cc = at.c + c;
      if (rr >= MAX_ROWS || cc >= MAX_COLS) return;
      const addr = addrOf(rr, cc);
      changes[addr] = mergeCell(doc.sheets[idx].cells[addr], { v: v == null ? '' : s(v) });
      written++;
    }));
    const sheets = doc.sheets.slice();
    sheets[idx] = withCells(sheets[idx], changes);
    patchFile(f.id, { data: { sheets, active: idx } });
    return { success: true, message: written + ' celda(s) escritas en "' + f.name + '" desde ' + addrOf(at.r, at.c) + '.' };
  }

  if (type === 'DOC_APPEND') {
    const f = findFileRef(ref, 'doc');
    if (!f) return { success: false, error: 'No encontré el documento "' + s(ref) + '". Documentos: ' + fileNames('doc') + '.' };
    const text = s(p.text);
    if (!text.trim()) return { success: false, error: 'No hay texto que añadir.' };
    const doc = docDoc(f.data);
    const blocks = doc.blocks.concat(markdownToBlocks(text));
    patchFile(f.id, { data: { blocks } });
    return { success: true, message: 'Texto añadido a "' + f.name + '".' };
  }

  if (type === 'SLIDE_ADD') {
    const f = findFileRef(ref, 'deck');
    if (!f) return { success: false, error: 'No encontré la presentación "' + s(ref) + '". Presentaciones: ' + fileNames('deck') + '.' };
    const doc = deckDoc(f.data);
    const sl = newSlide(p.layout);
    sl.t = s(p.title).slice(0, 200);
    sl.b = s(p.body);
    sl.n = s(p.notes);
    const slides = doc.slides.concat([sl]);
    patchFile(f.id, { data: { slides, active: slides.length - 1 } });
    return { success: true, message: 'Diapositiva ' + slides.length + ' añadida a "' + f.name + '".' };
  }

  if (type === 'NOTE_ADD') {
    const text = s(p.text);
    if (!text.trim()) return { success: false, error: 'La nota está vacía.' };
    const color = NOTE_COLORS.some((c) => c.id === s(p.color)) ? s(p.color) : '';
    const name = s(p.name).trim().slice(0, 120) || plainText(text).split('\n')[0].slice(0, 40) || 'Nota';
    const created = await createFile('note', nextFreeName('note', name), { x: text, color, pin: false, tags: [] });
    if (!created) return { success: false, error: 'No se pudo crear la nota.' };
    return { success: true, message: 'Nota "' + created.name + '" creada.' };
  }

  if (type === 'EVENT_ADD') {
    const title = s(p.title).trim().slice(0, 120);
    if (!title) return { success: false, error: 'Falta el título del evento.' };
    const day = /^\d{4}-\d{2}-\d{2}$/.test(s(p.day)) ? s(p.day) : null;
    if (!day) return { success: false, error: 'La fecha debe ir como AAAA-MM-DD (llegó "' + s(p.day) + '").' };
    const hhmm = (v, fb) => (/^\d{1,2}:\d{2}$/.test(s(v)) ? s(v).padStart(5, '0') : fb);
    const start = hhmm(p.start, '09:00');
    const end = hhmm(p.end, '10:00');
    const data = Object.assign(newEventDoc(day), {
      start, end, allDay: !!p.allDay, place: s(p.place).slice(0, 120), notes: s(p.notes),
    });
    if (!data.allDay && data.end <= data.start) return { success: false, error: 'La hora de término debe ser posterior a la de inicio.' };
    const created = await createFile('event', nextFreeName('event', title), data);
    if (!created) return { success: false, error: 'No se pudo agendar el evento.' };
    return { success: true, message: 'Evento "' + created.name + '" agendado el ' + fmtDay(day) + (data.allDay ? '' : ' a las ' + start) + '.' };
  }

  if (type === 'GO_TO') {
    const want = canon(p.module || p.view);
    const mod = MODULES.find((x) => x.id === want || canon(x.label) === want)
      || (normKind(p.module) ? MODULES.find((x) => x.kind === normKind(p.module)) : null);
    if (!mod) return { success: false, error: 'Módulo desconocido. Válidos: ' + MODULES.map((x) => x.label).join(', ') + '.' };
    setModel({ module: mod.id, openId: '' });
    return { success: true, message: 'Abrí ' + mod.label + '.' };
  }

  return {
    success: false,
    error: 'Acción desconocida: ' + action.type + '. Acciones válidas: ' + AGENT_TOOLS.map((t) => t.name).join(', ') + '.',
  };
}

function registerAgent() {
  if (!shell.agent || typeof shell.agent.register !== 'function') return;
  const off = shell.agent.register({
    label: 'Kimos WorkOffice',
    description: 'Suite ofimática del espacio de trabajo: crear y editar documentos, hojas de cálculo '
      + '(incluidas fórmulas), presentaciones, notas y eventos de calendario; buscar en el contenido '
      + 'de todos los archivos y abrir el que corresponda.',
    tools: AGENT_TOOLS,
    getSnapshot: () => {
      const open = model.openId ? getFile(model.openId) : null;
      return {
        version: APP_VERSION,
        espacio: model.spaceName || undefined,
        moduloActual: (MODULES.find((x) => x.id === model.module) || {}).label,
        guardado: model.saveState,
        totales: Object.keys(KINDS).reduce((acc, k) => {
          acc[KINDS[k].plural] = model.files.filter((f) => f.kind === k && !f.trashed).length;
          return acc;
        }, {}),
        archivos: model.files.filter((f) => !f.trashed).sort(byRecent).slice(0, 60).map((f) => ({
          id: f.id, nombre: f.name, tipo: KINDS[f.kind].label,
          actualizado: f.updatedAt || null, por: f.updatedBy || null,
          hojas: f.kind === 'sheet' ? sheetDoc(f.data).sheets.map((sh) => sh.name) : undefined,
        })),
        abierto: open ? { id: open.id, nombre: open.name, tipo: KINDS[open.kind].label } : null,
        enPapelera: model.files.filter((f) => f.trashed).length,
      };
    },
    dispatchAction: async (action) => {
      try { return await agentDispatch(action || {}); } catch (e) {
        return { success: false, error: String((e && e.message) || e) };
      }
    },
  });
  if (typeof off === 'function') teardownTasks.push(off);
}

// ══════════════════════════════════════════════════════════════════════
// src/90-app.js
// ══════════════════════════════════════════════════════════════════════
/* ══ LA SUITE ══════════════════════════════════════════════════════════════
 *
 * Arma la ventana: cabecera con el espacio y los módulos, el módulo activo,
 * la paleta de comandos y los atajos globales.
 *
 * Una sola ventana para las cinco herramientas (y no cinco apps sueltas)
 * porque el trabajo real salta entre ellas todo el rato: se copia una tabla al
 * informe, se pega una lista en la presentación, se agenda la reunión donde se
 * presenta. Cambiar de módulo no recarga nada ni pierde lo que estabas
 * escribiendo: es el mismo estado.
 */

/** Lleva el archivo a su módulo y lo abre. Punto único de "abrir algo". */
function openFileInModule(f) {
  if (!f) return;
  const mod = KINDS[kindOf(f)].module;
  // Notas y Calendario no tienen "archivo abierto": son tableros completos.
  setModel({ module: mod, openId: (mod === 'notes' || mod === 'calendar') ? '' : f.id, query: '', palette: false });
}

async function createAndOpen(kind) {
  const k = KINDS[kind] ? kind : 'doc';
  const seed = { doc: newDocDoc, sheet: () => ({ sheets: [newSheet('Hoja 1')], active: 0 }), deck: newDeckDoc, note: newNoteDoc, event: () => newEventDoc(todayISO()) }[k];
  const f = await createFile(k, nextFreeName(k), seed ? seed() : {});
  if (f) openFileInModule(f);
  return f;
}

// ── Paleta de comandos (Ctrl+K) ─────────────────────────────────────────
/**
 * Un solo lugar para todo: crear, buscar por contenido, saltar a un archivo y
 * ejecutar acciones. Quien usa la app a diario no vuelve a tocar el ratón; quien
 * llega nuevo la descubre porque el atajo está escrito en la cabecera.
 */
function Palette(p) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const boxRef = useRef(null);

  const commands = useMemo(() => {
    const base = [];
    Object.keys(KINDS).forEach((k) => base.push({
      id: 'new:' + k, icon: KINDS[k].icon, label: 'Nuevo: ' + KINDS[k].label.toLowerCase(),
      hint: 'Crear', run: () => { void createAndOpen(k); },
    }));
    MODULES.forEach((mod) => base.push({
      id: 'go:' + mod.id, icon: mod.icon, label: 'Ir a ' + mod.label, hint: 'Navegar',
      run: () => setModel({ module: mod.id, openId: '', palette: false }),
    }));
    base.push({
      id: 'save', icon: '💾', label: 'Guardar ahora', hint: 'Ctrl+S',
      run: () => { void flushSaves().then((ok) => notify(ok ? 'success' : 'warn', ok ? 'Todo guardado.' : 'Quedó algo sin guardar.')); },
    });
    base.push({ id: 'sync', icon: '🔄', label: 'Actualizar desde el servidor', hint: 'Equipo', run: () => { void refresh(true); void refreshExternal(true); } });
    return base;
  }, []);

  const needle = canon(q);
  const cmdHits = commands.filter((c) => !needle || canon(c.label).indexOf(needle) >= 0);
  const fileHits = q ? searchFiles(q).slice(0, 12) : model.files.filter((f) => !f.trashed).sort(byRecent).slice(0, 8).map((f) => ({ file: f, where: 'reciente', excerpt: '' }));
  const items = cmdHits.map((c) => ({ kind: 'cmd', c })).concat(fileHits.map((r) => ({ kind: 'file', r })));
  const pick = Math.max(0, Math.min(items.length - 1, i));

  const run = (it) => {
    if (!it) return;
    if (it.kind === 'cmd') { setModel({ palette: false }); it.c.run(); }
    else openFileInModule(it.r.file);
  };

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setModel({ palette: false }); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); return; }
      if (e.key === 'Enter') { e.preventDefault(); run(items[pick]); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [items, pick]);

  return h('div', { className: 'wo-modal-bg wo-pal-bg', onMouseDown: (e) => { if (e.target === e.currentTarget) setModel({ palette: false }); } },
    h('div', { className: 'wo-pal', role: 'dialog', 'aria-label': 'Paleta de comandos', ref: boxRef },
      h('input', {
        className: 'wo-pal-in', autoFocus: true, value: q, placeholder: 'Escribe para buscar archivos o ejecutar una acción…',
        onChange: (e) => { setQ(e.target.value); setI(0); }, 'aria-label': 'Buscar o ejecutar',
      }),
      h('div', { className: 'wo-pal-list', role: 'listbox' },
        items.length
          ? items.map((it, n) => (it.kind === 'cmd'
            ? h('button', {
              key: it.c.id, type: 'button', role: 'option', 'aria-selected': n === pick,
              className: cx('wo-pal-it', n === pick && 'wo-pal-on'),
              onMouseEnter: () => setI(n), onClick: () => run(it),
            }, h('span', { className: 'wo-pal-i' }, it.c.icon), h('span', { className: 'wo-pal-t' }, it.c.label),
               h('span', { className: 'wo-pal-h' }, it.c.hint))
            : h('button', {
              key: it.r.file.id, type: 'button', role: 'option', 'aria-selected': n === pick,
              className: cx('wo-pal-it', n === pick && 'wo-pal-on'),
              onMouseEnter: () => setI(n), onClick: () => run(it),
            }, h('span', { className: 'wo-pal-i' }, KINDS[kindOf(it.r.file)].icon),
               h('span', { className: 'wo-pal-t' }, it.r.file.name,
                 it.r.excerpt ? h('span', { className: 'wo-pal-x' }, it.r.excerpt) : null),
               h('span', { className: 'wo-pal-h' }, it.r.where === 'reciente' ? 'Reciente' : 'Coincidencia'))))
          : h('div', { className: 'wo-pal-empty' }, 'Nada coincide con "' + q + '".')),
      h('div', { className: 'wo-pal-ft' },
        h('span', null, '↑↓ moverse · ↵ abrir · Esc cerrar'),
        h('span', { className: 'wo-muted' }, 'Ctrl+K'))));
}

// ── Aplicación ──────────────────────────────────────────────────────────
function WorkOfficeApp() {
  const m = useModel();
  const [renaming, setRenaming] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const rootRef = useRef(null);

  const ctx = useMemo(() => ({
    open: openFileInModule,
    create: (kind) => { void createAndOpen(kind); },
    rename: (f) => setRenaming({ id: f.id, value: f.name }),
    destroy: (f) => setConfirm({
      title: 'Eliminar definitivamente',
      message: '"' + f.name + '" se borrará para siempre. Esta acción no se puede deshacer.',
      onOk: () => { void destroyFile(f.id); setConfirm(null); },
    }),
    emptyTrash: (list) => setConfirm({
      title: 'Vaciar la papelera',
      message: 'Se borrarán para siempre ' + list.length + ' archivo(s). Esta acción no se puede deshacer.',
      onOk: () => { list.forEach((f) => { void destroyFile(f.id); }); setConfirm(null); },
    }),
  }), []);

  // Atajos globales de la ventana.
  useEffect(() => {
    const key = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setModel({ palette: !model.palette }); return; }
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void flushSaves().then((ok) => notify(ok ? 'success' : 'warn', ok ? 'Guardado.' : 'No se pudo guardar todo: se reintentará.'));
        return;
      }
      if (e.key === 'F5' && model.module === 'slides' && model.openId) {
        // F5 presenta, como en cualquier suite; el navegador recargaría la página.
        e.preventDefault();
        const btn = rootRef.current && rootRef.current.querySelector('.wo-deck .wo-btn-primary');
        if (btn) btn.click();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  const open = m.openId ? getFile(m.openId) : null;
  const modDef = MODULES.find((x) => x.id === m.module) || MODULES[0];

  const body = () => {
    if (!m.loaded) return h('div', { className: 'wo-loading' }, 'Abriendo el espacio de trabajo…');
    if (m.module === 'drive') return h(DriveView, { m, ctx });
    if (m.module === 'notes') return h(NotesBoard, { m });
    if (m.module === 'calendar') return h(CalendarView, { m });
    const kind = modDef.kind;
    if (!open || open.kind !== kind || open.trashed) return h(FileBrowser, { kind, ctx });
    if (kind === 'sheet') return h(SheetEditor, { file: open, cfg: m.cfg });
    if (kind === 'doc') return h(DocEditor, { file: open, cfg: m.cfg });
    if (kind === 'deck') return h(DeckEditor, { file: open, cfg: m.cfg });
    return h(FileBrowser, { kind, ctx });
  };

  return h('div', {
    className: cx('kimos-workoffice', m.cfg.dense && 'wo-dense'),
    ref: rootRef,
  },
    h('header', { className: 'wo-hd' },
      h('div', { className: 'wo-hd-l' },
        h('button', {
          type: 'button', className: 'wo-brand', onClick: () => setModel({ module: 'drive', openId: '', query: '' }),
          title: 'Ir al inicio del espacio de trabajo',
        }, h('span', { 'aria-hidden': 'true' }, '🧰'), h('span', { className: 'wo-brand-t' }, m.spaceName || 'Kimos WorkOffice')),
        h('span', { className: 'wo-ver', title: 'Kimos WorkOffice v' + APP_VERSION }, 'v' + APP_VERSION)),

      h('nav', { className: 'wo-nav', 'aria-label': 'Módulos' },
        MODULES.map((mod) => h('button', {
          key: mod.id, type: 'button',
          className: cx('wo-navb', m.module === mod.id && 'wo-navb-on'),
          onClick: () => setModel({ module: mod.id, openId: mod.kind && open && open.kind === mod.kind ? m.openId : '', query: '' }),
          title: mod.label,
          'aria-current': m.module === mod.id ? 'page' : undefined,
        }, h('span', { className: 'wo-navb-i', 'aria-hidden': 'true' }, mod.icon),
           h('span', { className: 'wo-navb-t' }, mod.label)))),

      h('div', { className: 'wo-hd-r' },
        open && open.kind === modDef.kind
          ? h(Fragment, null,
            h(IconBtn, { icon: '‹', title: 'Volver a ' + modDef.label, onClick: () => setModel({ openId: '' }) }),
            h(FileTitle, {
              name: open.name, icon: KINDS[kindOf(open)].icon,
              onRename: (name) => patchFile(open.id, { name }, { immediate: true }),
            }),
            h(IconBtn, {
              icon: open.star ? '⭐' : '☆', title: open.star ? 'Quitar de favoritos' : 'Marcar como favorito',
              onClick: () => patchFile(open.id, { star: !open.star }, { immediate: true }),
            }))
          : h('button', {
            type: 'button', className: 'wo-searchbtn', onClick: () => setModel({ palette: true }),
            title: 'Buscar en todo el espacio (Ctrl+K)',
          }, '🔎 Buscar', h('span', { className: 'wo-kbd' }, 'Ctrl+K')),
        h(SaveDot, { state: m.saveState, lastSavedAt: m.lastSavedAt }),
        m.offline ? h('span', { className: 'wo-offline', title: 'Sin conexión con el servidor: los cambios se reintentan solos' }, '⚠️') : null)),

    h('main', { className: 'wo-main' }, body()),

    m.palette ? h(Palette, null) : null,
    renaming ? h(RenameDialog, {
      value: renaming.value,
      onClose: () => setRenaming(null),
      onOk: (v) => { patchFile(renaming.id, { name: s(v).trim().slice(0, 120) || renaming.value }, { immediate: true }); setRenaming(null); },
    }) : null,
    confirm ? h(ConfirmModal, {
      title: confirm.title, message: confirm.message, danger: true,
      onCancel: () => setConfirm(null), onOk: confirm.onOk,
    }) : null);
}

function RenameDialog(p) {
  const [v, setV] = useState(p.value);
  return h(Modal, {
    title: 'Renombrar', onClose: p.onClose,
    actions: [
      h(Btn, { key: 'c', label: 'Cancelar', onClick: p.onClose }),
      h(Btn, { key: 'k', label: 'Guardar', variant: 'primary', onClick: () => p.onOk(v) }),
    ],
  }, h(Field, { label: 'Nombre', wide: true },
    h(TextInput, { value: v, onChange: setV, autoFocus: true, onKeyDown: (e) => { if (e.key === 'Enter') p.onOk(v); } })));
}

// ── Integración con el chrome del host (AppShell v2, opcional) ───────────
/*
 * Si el host ofrece el menú 🗂️ Documentos (Guardar versión / Historial), la app
 * le entrega su espacio completo para versionarlo y sabe rehidratarse cuando el
 * usuario restaura una versión. Con un host v1 esto simplemente no existe y la
 * app funciona igual: se consulta antes de usarlo.
 */
function wireHostDocuments() {
  if (!shell.documents) return;
  try {
    if (typeof shell.documents.onSerialize === 'function') {
      shell.documents.onSerialize(() => ({
        app: 'workoffice', version: APP_VERSION,
        files: model.files.map((f) => ({
          id: f.id, kind: f.kind, name: f.name, star: !!f.star, trashed: !!f.trashed,
          data: f.data, createdAt: f.createdAt, updatedAt: f.updatedAt, updatedBy: f.updatedBy,
        })),
      }));
    }
    if (typeof shell.documents.onLoad === 'function') {
      shell.documents.onLoad(async (payload) => {
        const snap = payload && (payload.files ? payload : payload.model);
        if (!snap || !Array.isArray(snap.files)) return;
        // Restaurar una versión NO borra lo actual: se crean los archivos que
        // faltan y se actualizan los que cambiaron. Perder trabajo por restaurar
        // una versión sería peor que no tener historial.
        for (const f of snap.files.slice(0, 300)) {
          if (!isFile(f)) continue;
          const mine = getFile(f.id);
          if (mine) patchFile(f.id, { name: f.name, data: f.data, star: !!f.star, trashed: !!f.trashed });
          else await createFile(f.kind, f.name, f.data);
        }
        notify('success', 'Versión restaurada en el espacio de trabajo.');
      });
    }
  } catch (e) { /* el host puede exponer una forma distinta: nunca romper por esto */ }
}

// ── Arranque ────────────────────────────────────────────────────────────
startLifecycle();
registerAgent();
wireHostDocuments();
void refreshExternal(true);

  return {
    Component: WorkOfficeApp,
    unmount() { teardown(); },
  };
}
