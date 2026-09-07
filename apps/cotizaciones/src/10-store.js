/* ══ ESTADO, RED Y SINCRONIZACIÓN ═════════════════════════════════════════
 *
 * Un solo modelo en el closure. La UI y el agente IA mutan EXACTAMENTE las
 * mismas funciones, así que el lienzo se repinta solo cuando el agente actúa
 * (APP-SPEC §5).
 *
 * Colaboración multiusuario (APP-SPEC §5.1), con `gantt` como referencia:
 *   1. Fusionar, no reemplazar: cada línea lleva su `updatedAt` y gana la más
 *      reciente POR LÍNEA, no por documento. Dos personas que tocan líneas
 *      distintas de la misma cotización no se pisan.
 *   2. Lápidas para las bajas (`deletedLines`), si no lo que borra una
 *      persona reaparece desde la pantalla de la otra.
 *   3. Leer-fusionar-escribir antes de cada PUT: el backend hace merge de
 *      campos de primer nivel, así que el array `lines` se reemplaza entero
 *      y la fusión tiene que ocurrir aquí.
 *   4. Auto-reparación de la ventana de red entre el read y el write, acotada
 *      a lo propio y reciente para no resucitar lo que borró otra persona.
 *   5. No repintar de más: se compara una firma de lo visible y solo se emite
 *      si cambió.
 *   6. Cadencia según el foco: rápido enfocada, lenta de fondo, en pausa si
 *      la pestaña no se ve.
 */

const instanceId = shell.app && shell.app.instanceId;
const teamId = shell.app && shell.app.teamId;

/** Base del API del tenant, deducida de una URL que el propio host arma. */
function apiBase() {
  try {
    const raw = shell.assetUrl ? shell.assetUrl('x').split('/api/apps/')[0] : '';
    return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
  } catch (e) { return window.location.origin; }
}
const API = apiBase();
const req = (url, init) => (shell.authFetch ? shell.authFetch(url, init) : fetch(url, init));
const INSTANCE_URL = API + '/api/app-instances/' + encodeURIComponent(s(instanceId));

// ── Modelo ──────────────────────────────────────────────────────────────
let model = {
  // Datos
  def: { id: KIND_DEF, issuer: defaultIssuer(), rules: defaultRules(), updatedAt: '', metaUpdatedAt: '' },
  docs: [],            // cotizaciones y plantillas (kind quote | template)
  catalog: [],         // ítems y servicios prefijados
  mails: [],           // plantillas de correo
  // Catálogos de OTRAS apps (Productos, ProductLab, Clientes) leídos con
  // `shell.data`. No se persisten: son un espejo de lectura que se refresca
  // al abrir la pestaña o al pulsar recargar.
  ext: {
    loading: false, loaded: false, error: null, at: '',
    products: [], sources: [],
    customers: [], customerSources: [],
  },
  // Entorno
  me: null,
  settings: {},        // valores de ⚙️ Configurar
  docName: '',
  loaded: false,
  error: null,
  // Vista (compartida por usuario y agente)
  tab: 'quotes',
  openId: '',          // documento abierto en el editor
  search: '',
  filterStatus: '',
  sort: { by: 'date', dir: 'desc' },
  sync: { at: '', saving: 0, offline: false },
};

const listeners = new Set();
const emit = () => listeners.forEach((l) => { try { l(Object.assign({}, model)); } catch (e) { /* un oyente roto no rompe al resto */ } });
const setModel = (patch) => { model = Object.assign({}, model, patch); emit(); };
const getModel = () => model;

/** Documentos con escritura en vuelo o encolada: no deben caerse al fusionar. */
const pendingWrite = new Set();
/** Documentos borrados localmente cuyo DELETE aún no confirma el servidor. */
const pendingDelete = new Set();
/** Documentos que aún no existen en el servidor (creación en camino). */
const pendingCreate = new Set();
const saveTimers = new Map();

/** Serializa TODA la red mutante: sin carreras entre refresh y guardados. */
let chain = Promise.resolve();
function serial(fn) {
  const run = () => Promise.resolve().then(fn).catch((e) => { console.warn('[cotizaciones] sync', e); });
  chain = chain.then(run, run);
  return chain;
}

const meLabel = () => (model.me && (model.me.name || model.me.email || model.me.id)) || '';

// ── Acceso a los datos del modelo ───────────────────────────────────────
const rulesOf = () => normalizeRules(model.def && model.def.rules);
const issuerOf = () => normalizeIssuer(model.def && model.def.issuer);
const quotesOf = () => model.docs.filter((d) => d.kind === KIND_QUOTE);
const templatesOf = () => model.docs.filter((d) => d.kind === KIND_TEMPLATE);
const docById = (id) => model.docs.find((d) => d.id === id) || null;
const catalogById = (id) => model.catalog.find((c) => c.id === id) || null;
const mailById = (id) => model.mails.find((m) => m.id === id) || null;
const openDoc = () => (model.openId ? docById(model.openId) : null);

// ── Normalización de items ──────────────────────────────────────────────
/** Clasifica un item crudo del backend en su tipo del modelo. */
function kindOf(item) {
  const k = s(item && item.kind);
  if (k === KIND_DEF || k === KIND_QUOTE || k === KIND_TEMPLATE || k === KIND_CATALOG || k === KIND_MAIL) return k;
  // Items previos a que existiera `kind`: si tienen líneas, son cotizaciones.
  return Array.isArray(item && item.lines) ? KIND_QUOTE : '';
}

function normalizeDefinition(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    id: s(r.id) || KIND_DEF,
    kind: KIND_DEF,
    name: s(r.name) || 'Ajustes del cotizador',
    issuer: normalizeIssuer(r.issuer),
    rules: normalizeRules(r.rules),
    // Bloque `public` del gateway público (APP-SPEC §7.b): la app lo escribe
    // solo cuando se publica una cotización con enlace.
    public: isObj(r.public) ? r.public : { enabled: false },
    metaUpdatedAt: s(r.metaUpdatedAt),
    updatedBy: s(r.updatedBy),
  };
}

function normalizeMail(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    id: s(r.id) || uid('m'),
    kind: KIND_MAIL,
    name: s(r.name) || 'Correo sin nombre',
    subject: s(r.subject),
    body: s(r.body),
    to: s(r.to),
    cc: s(r.cc),
    bcc: s(r.bcc),
    replyTo: s(r.replyTo),
    attachPdf: r.attachPdf !== false,
    isDefault: r.isDefault === true,
    updatedAt: s(r.updatedAt),
    updatedBy: s(r.updatedBy),
  };
}

// ── Fusión sin pérdida ──────────────────────────────────────────────────
/** Campos de cabecera del documento: se resuelven en bloque por `metaUpdatedAt`. */
const META_FIELDS = [
  'name', 'subtitle', 'number', 'numberSeq', 'status', 'date', 'validUntil', 'validDays',
  'client', 'currency', 'symbol', 'decimals', 'locale', 'taxPct', 'discountPct',
  'discountAmount', 'advanceEnabled', 'advancePct', 'notes', 'paymentInfo', 'blocks', 'mail',
];

function mergeLines(localLines, remoteLines, tombs) {
  const tombAt = new Map(tombs.map((d) => [d.id, s(d.at)]));
  const remoteById = new Map(arr(remoteLines).map((l) => [l.id, l]));
  const out = [];
  const seen = new Set();
  const take = (l) => {
    if (!l || !l.id || seen.has(l.id)) return;
    const dead = tombAt.get(l.id);
    if (dead && dead > s(l.updatedAt)) return;   // borrada después de su última edición
    seen.add(l.id);
    out.push(l);
  };
  // El orden que ve quien está mirando la pantalla manda; lo nuevo del otro
  // lado se añade al final (no saltan las filas mientras se trabaja).
  for (const ll of arr(localLines)) {
    const rl = remoteById.get(ll.id);
    take(!rl || s(ll.updatedAt) >= s(rl.updatedAt) ? ll : rl);
  }
  for (const rl of arr(remoteLines)) take(rl);
  return out;
}

function mergeDoc(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const meta = s(remote.metaUpdatedAt) > s(local.metaUpdatedAt) ? remote : local;
  const tombs = pruneTombs([...arr(local.deletedLines), ...arr(remote.deletedLines)]);
  const merged = Object.assign({}, remote, local);
  for (const f of META_FIELDS) merged[f] = meta[f];
  merged.metaUpdatedAt = s(meta.metaUpdatedAt);
  merged.deletedLines = tombs;
  merged.lines = mergeLines(local.lines, remote.lines, tombs);
  // La bitácora es un registro que solo crece: se unen los dos lados.
  merged.events = mergeEvents(local.events, remote.events);
  return merged;
}

/** Eventos: unión sin duplicados (misma marca de tiempo, tipo y autor). */
function mergeEvents(a, b) {
  const seen = new Set();
  const out = [];
  for (const e of [...arr(a), ...arr(b)]) {
    if (!e) continue;
    const key = s(e.at) + '|' + s(e.type) + '|' + s(e.by) + '|' + s(e.detail);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out.sort((x, y) => s(x.at).localeCompare(s(y.at)));
}

/** Fusión de una lista de items simples (banco de ítems, correos): por `updatedAt`. */
function mergeSimpleLists(local, remote) {
  const remoteById = new Map(remote.map((x) => [x.id, x]));
  const out = [];
  const seen = new Set();
  for (const l of local) {
    const r = remoteById.get(l.id);
    if (r) { out.push(s(l.updatedAt) >= s(r.updatedAt) ? l : r); seen.add(l.id); }
    else if (pendingWrite.has(l.id) || pendingCreate.has(l.id)) { out.push(l); seen.add(l.id); }
    // Si no está arriba y no tenemos escritura pendiente, otro lo borró.
  }
  for (const r of remote) if (!seen.has(r.id) && !pendingDelete.has(r.id)) out.push(r);
  return out;
}

function mergeDocLists(local, remote) {
  const remoteById = new Map(remote.map((d) => [d.id, d]));
  const out = [];
  const seen = new Set();
  for (const ld of local) {
    const rd = remoteById.get(ld.id);
    if (rd) { out.push(mergeDoc(ld, rd)); seen.add(ld.id); }
    else if (pendingWrite.has(ld.id) || pendingCreate.has(ld.id)) { out.push(ld); seen.add(ld.id); }
  }
  for (const rd of remote) if (!seen.has(rd.id) && !pendingDelete.has(rd.id)) out.push(rd);
  return out;
}

// ── Red ─────────────────────────────────────────────────────────────────
async function fetchItems() {
  if (shell.items && shell.items.list) return await shell.items.list();
  const res = await req(INSTANCE_URL + '/items', { cache: 'no-store' });
  if (!res.ok) throw new Error('items ' + res.status);
  return ((await res.json()) || {}).items || [];
}

async function fetchInstance() {
  const res = await req(INSTANCE_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('instancia ' + res.status);
  return (await res.json()) || {};
}

/** Lo que se persiste: el modelo limpio, sin los sellos que pone el backend. */
function serializeItem(item) {
  const out = Object.assign({}, item);
  delete out.createdAt;
  delete out.updatedAt;   // lo pone el backend
  return out;
}

async function putItem(item) {
  const res = await req(INSTANCE_URL + '/items/' + encodeURIComponent(item.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeItem(item)),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* cuerpo vacío */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

async function postItem(item) {
  const res = await req(INSTANCE_URL + '/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeItem(item)),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* cuerpo vacío */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

async function deleteItem(id) {
  const res = await req(INSTANCE_URL + '/items/' + encodeURIComponent(id), { method: 'DELETE' });
  return { ok: res.ok || res.status === 404, status: res.status };
}

// ── Sincronización ──────────────────────────────────────────────────────
/** Firma de lo visible: si no cambió, no se repinta (§5.1 punto 5). */
const viewSignature = (mm) => JSON.stringify([
  mm.docs, mm.catalog, mm.mails, mm.def, mm.docName, mm.loaded, mm.error,
]);

function applyRemote(items, instance) {
  const raw = arr(items);
  const remoteDocs = [];
  const remoteCatalog = [];
  const remoteMails = [];
  let remoteDef = null;
  for (const it of raw) {
    const k = kindOf(it);
    if (k === KIND_DEF) remoteDef = normalizeDefinition(it);
    else if (k === KIND_QUOTE || k === KIND_TEMPLATE) remoteDocs.push(normalizeQuote(it));
    else if (k === KIND_CATALOG) remoteCatalog.push(normalizeCatalogItem(it));
    else if (k === KIND_MAIL) remoteMails.push(normalizeMail(it));
  }

  const patch = {
    docs: mergeDocLists(model.docs, remoteDocs),
    catalog: mergeSimpleLists(model.catalog, remoteCatalog),
    mails: mergeSimpleLists(model.mails, remoteMails),
    loaded: true,
    error: null,
  };
  // Los ajustes del cotizador se resuelven por `metaUpdatedAt`, igual que la
  // cabecera de un documento: quien guardó después manda.
  if (remoteDef) {
    patch.def = s(remoteDef.metaUpdatedAt) > s(model.def.metaUpdatedAt) && !pendingWrite.has(remoteDef.id)
      ? remoteDef
      : model.def;
  }
  if (instance) {
    patch.docName = s(instance.name);
  }

  const next = Object.assign({}, model, patch);
  const quiet = viewSignature(next) === viewSignature(model) && !model.sync.offline;
  next.sync = Object.assign({}, model.sync, { at: stamp(), offline: false });
  model = next;
  if (!quiet) emit();
  repairLostWrites(remoteDocs);
}

/**
 * Auto-reparación. Si una línea NUESTRA y RECIENTE ya no está en el servidor
 * y nadie la borró (no hay lápida que la tape: si la hubiera, la fusión la
 * habría descartado), es que otra escritura la pisó en la ventana entre
 * nuestro read y nuestro write. Se repone guardando de nuevo.
 *
 * Acotado a lo propio y reciente a propósito: así nunca resucita lo que borró
 * otra persona, ni siquiera desde un cliente de una versión vieja que no
 * escriba lápidas.
 */
function repairLostWrites(remoteDocs) {
  const me = meLabel();
  const remoteById = new Map(remoteDocs.map((d) => [d.id, d]));
  const mineAndFresh = (by, at) => {
    if (by !== me || !at) return false;
    const age = Date.now() - Date.parse(at);
    return !isNaN(age) && age >= 0 && age < REPAIR_WINDOW_MS;
  };
  for (const d of model.docs) {
    if (pendingWrite.has(d.id) || pendingCreate.has(d.id)) continue;
    const rd = remoteById.get(d.id);
    if (!rd) continue;
    const remoteIds = new Set(arr(rd.lines).map((l) => l.id));
    const lostLine = arr(d.lines).some((l) => !remoteIds.has(l.id) && mineAndFresh(l.updatedBy, l.updatedAt));
    const lostTomb = arr(d.deletedLines).some((t) => remoteIds.has(t.id) && mineAndFresh(t.by, t.at));
    if (lostLine || lostTomb) queueSave(d.id);
  }
}

async function doRefresh(withInstance) {
  try {
    const [items, instance] = await Promise.all([
      fetchItems(),
      withInstance ? fetchInstance().catch(() => null) : Promise.resolve(null),
    ]);
    applyRemote(items, instance);
    return items;
  } catch (e) {
    setModel({
      loaded: true,
      error: model.loaded ? model.error : ((e && e.message) || 'No se pudo cargar el cotizador.'),
      sync: Object.assign({}, model.sync, { offline: true }),
    });
    return null;
  }
}
const refresh = (withInstance) => serial(() => doRefresh(withInstance !== false));

/** Busca un item del modelo por id, sea del tipo que sea. */
function anyById(id) {
  return docById(id) || catalogById(id) || mailById(id)
    || (model.def && model.def.id === id ? model.def : null);
}

/**
 * Guardado leer-fusionar-escribir: relee del servidor, fusiona lo ajeno con
 * lo propio y recién ahí escribe. Ningún cambio de otra persona se pierde por
 * el hecho de que nosotros hayamos guardado después.
 *
 * Queda una ventana mínima —el viaje de red entre el read y el write— que
 * cubre la auto-reparación de `applyRemote`.
 */
async function doSave(id) {
  const items = await fetchItems().catch(() => null);
  if (items) applyRemote(items, null);
  else setModel({ sync: Object.assign({}, model.sync, { offline: true }) });

  const merged = anyById(id);
  if (!merged) return;                      // dejó de existir (borrado local o remoto)

  const creating = pendingCreate.has(id);
  const res = creating ? await postItem(merged) : await putItem(merged);
  if (res.ok) {
    pendingCreate.delete(id);
    setModel({ sync: Object.assign({}, model.sync, { at: stamp(), offline: false }) });
    return;
  }
  // Un PUT contra un item que aún no existe: se crea. Y al revés, un POST
  // contra uno que ya existe (409/400 por carrera): se actualiza.
  if (res.status === 404 && !creating) {
    const retry = await postItem(merged);
    if (retry.ok) { setModel({ sync: Object.assign({}, model.sync, { at: stamp(), offline: false }) }); return; }
  }
  setModel({ sync: Object.assign({}, model.sync, { offline: true }) });
  shell.notify({ level: 'error', text: 'No se pudo guardar; se reintentará.' });
}

function queueSave(id) {
  if (!id) return;
  pendingWrite.add(id);
  if (saveTimers.has(id)) clearTimeout(saveTimers.get(id));
  saveTimers.set(id, setTimeout(() => {
    saveTimers.delete(id);
    setModel({ sync: Object.assign({}, model.sync, { saving: model.sync.saving + 1 }) });
    serial(() => doSave(id)).then(() => {
      pendingWrite.delete(id);
      setModel({ sync: Object.assign({}, model.sync, { saving: Math.max(0, model.sync.saving - 1) }) });
    });
  }, SAVE_DEBOUNCE_MS));
}

/** Fuerza la salida de todo lo pendiente (al cerrar la ventana o al exportar). */
function flushPending() {
  for (const [id, timer] of saveTimers) {
    clearTimeout(timer);
    saveTimers.delete(id);
    serial(() => doSave(id));
  }
  return chain;
}

// ── Mutaciones del modelo ───────────────────────────────────────────────
/**
 * Sustituye un documento por su versión editada, sella la edición y encola el
 * guardado. `meta` marca que cambió la cabecera (y no solo una línea), que es
 * lo que decide quién gana al fusionar.
 */
function commitDoc(id, mutate, opts) {
  const o = isObj(opts) ? opts : {};
  const idx = model.docs.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const before = model.docs[idx];
  const next = normalizeQuote(mutate(JSON.parse(JSON.stringify(before))) || before);
  if (o.meta !== false) next.metaUpdatedAt = stamp();
  next.updatedBy = meLabel();
  const docs = model.docs.slice();
  docs[idx] = next;
  setModel({ docs });
  queueSave(id);
  return next;
}

/** Sella una línea como recién editada por mí (para la fusión por línea). */
function touchLine(line) {
  return Object.assign({}, normalizeLine(line), { updatedAt: stamp(), updatedBy: meLabel() });
}

/** Añade un evento a la bitácora de seguimiento del documento. */
function logEvent(doc, type, detail) {
  const events = arr(doc.events).slice();
  events.push({ at: stamp(), by: meLabel(), type: s(type), detail: s(detail) });
  // La bitácora no crece sin límite: se conservan los 200 últimos.
  doc.events = events.slice(-200);
  return doc;
}

function createDoc(doc) {
  const next = normalizeQuote(doc);
  next.updatedBy = meLabel();
  next.metaUpdatedAt = stamp();
  logEvent(next, 'created', next.kind === KIND_TEMPLATE ? 'Plantilla creada' : 'Cotización creada');
  pendingCreate.add(next.id);
  setModel({ docs: model.docs.concat([next]) });
  queueSave(next.id);
  return next;
}

function removeDoc(id) {
  const doc = docById(id);
  if (!doc) return false;
  pendingDelete.add(id);
  pendingCreate.delete(id);
  if (saveTimers.has(id)) { clearTimeout(saveTimers.get(id)); saveTimers.delete(id); }
  setModel({
    docs: model.docs.filter((d) => d.id !== id),
    openId: model.openId === id ? '' : model.openId,
  });
  serial(async () => {
    const res = await deleteItem(id);
    if (res.ok) pendingDelete.delete(id);
    else shell.notify({ level: 'error', text: 'No se pudo eliminar; vuelve a intentarlo.' });
  });
  return true;
}

/** Alta/edición/baja de los items simples (banco de ítems y correos). */
function upsertSimple(listKey, item, normalize) {
  const next = Object.assign(normalize(item), { updatedAt: stamp(), updatedBy: meLabel() });
  const list = model[listKey];
  const idx = list.findIndex((x) => x.id === next.id);
  const out = list.slice();
  if (idx < 0) { pendingCreate.add(next.id); out.push(next); } else out[idx] = next;
  setModel({ [listKey]: out });
  queueSave(next.id);
  return next;
}

function removeSimple(listKey, id) {
  const list = model[listKey];
  if (!list.some((x) => x.id === id)) return false;
  pendingDelete.add(id);
  pendingCreate.delete(id);
  if (saveTimers.has(id)) { clearTimeout(saveTimers.get(id)); saveTimers.delete(id); }
  setModel({ [listKey]: list.filter((x) => x.id !== id) });
  serial(async () => {
    const res = await deleteItem(id);
    if (res.ok) pendingDelete.delete(id);
    else shell.notify({ level: 'error', text: 'No se pudo eliminar; vuelve a intentarlo.' });
  });
  return true;
}

const upsertCatalog = (item) => upsertSimple('catalog', item, normalizeCatalogItem);
const removeCatalog = (id) => removeSimple('catalog', id);
const upsertMail = (item) => upsertSimple('mails', item, normalizeMail);
const removeMail = (id) => removeSimple('mails', id);

/** Guarda los ajustes del cotizador (emisor + reglas). */
function commitDefinition(mutate) {
  const before = model.def;
  const next = normalizeDefinition(mutate(JSON.parse(JSON.stringify(before))) || before);
  next.metaUpdatedAt = stamp();
  next.updatedBy = meLabel();
  // Si el item aún no existe arriba, el PUT devuelve 404 y `doSave` lo crea:
  // no hace falta saber aquí si es alta o edición.
  setModel({ def: next });
  queueSave(next.id);
  return next;
}

// ── Carga inicial y ciclo de vida ───────────────────────────────────────
let syncTimer = null;
let loadedOnce = false;

/** Cadencia según el foco: rápida enfocada, lenta de fondo, en pausa si no se ve. */
function scheduleSync() {
  if (syncTimer) clearInterval(syncTimer);
  const period = document.hasFocus && document.hasFocus() ? SYNC_FOCUSED_MS : SYNC_BACKGROUND_MS;
  syncTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    refresh(false);
  }, period);
}
const onFocusChange = () => scheduleSync();

async function load() {
  if (loadedOnce) return;
  loadedOnce = true;
  await refresh(true);

  // El item `definition` se crea la primera vez que se abre el cotizador, así
  // los ajustes tienen dónde vivir antes de que nadie los toque. El id es
  // fijo, de modo que dos personas abriendo a la vez escriben el mismo
  // documento en vez de duplicarlo.
  if (!s(model.def.metaUpdatedAt)) {
    pendingCreate.add(KIND_DEF);
    queueSave(KIND_DEF);
  }

  // Quién soy: la fusión necesita distinguir lo propio de lo ajeno.
  try {
    const res = await req(API + '/api/identity/me', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const a = (data && (data.actor || data)) || {};
      setModel({ me: { id: s(a.id), name: s(a.displayName || a.name), email: s(a.email) } });
    }
  } catch (e) { /* opcional: sin identidad la app funciona igual */ }

  // Parámetros de ⚙️ Configurar.
  if (shell.config && shell.config.get) {
    try { setModel({ settings: (await shell.config.get()) || {} }); } catch (e) { /* opcional */ }
  }

  scheduleSync();
}

let offConfig = null;
let offAgent = null;

/** Limpieza al cerrar la ventana: timers, listeners y agente (APP-SPEC §8). */
function teardown() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  try { window.removeEventListener('focus', onFocusChange); } catch (e) { /* no-op */ }
  try { window.removeEventListener('blur', onFocusChange); } catch (e) { /* no-op */ }
  flushPending();
  if (offConfig) { try { offConfig(); } catch (e) { /* no-op */ } offConfig = null; }
  if (offAgent) { try { offAgent(); } catch (e) { /* no-op */ } offAgent = null; }
  listeners.clear();
}
