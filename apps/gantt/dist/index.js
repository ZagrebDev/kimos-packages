/**
 * Planificación (Gantt) — app oficial instalable (v4.0, bundle real).
 *
 * COMPATIBLE con las instancias existentes (mismo modelo de datos):
 *   - Items = planes: {id, name, shortName, owner, ownerId, teamMemberIds,
 *     objective, tasks[], color, progress}.
 *   - Tareas embebidas: {id, name, responsibleId/Name, periods: boolean[],
 *     progress 0-100, status, taskStartDate/EndDate, notes, entityIds, extra}.
 *   - Config de instancia: {periods, periodGranularity, periodsCount,
 *     planLabel, taskLabel, timelineStartDate, enabledEntityTypeIds, ...}.
 *
 * Novedades v4.0
 *   1. Colaboración multiusuario: sincronización periódica (patrón de
 *      contact-forms/productlab) + FUSIÓN sin pérdida. Dos personas pueden
 *      trabajar a la vez sobre el mismo plan; cada tarea lleva su `updatedAt`
 *      y gana la edición más reciente, tarea por tarea (no el último PUT
 *      completo). Las bajas se propagan con lápidas (`deletedTasks`) para que
 *      una tarea borrada no reaparezca. Cada guardado es leer-fusionar-escribir
 *      con CAS (`_expectedUpdatedAt`): si alguien escribió en el intertanto se
 *      reintenta sobre la copia fresca en vez de pisarla.
 *   2. Fechas ↔ barra: `taskStartDate`/`taskEndDate` determinan y pintan los
 *      recuadros de la línea temporal; el clic en las celdas define el rango.
 *   3. Filtros por período y responsable + orden por CUALQUIER columna
 *      (incluidas las de período).
 *   4. Agente con paridad total sobre lo que se puede hacer en la app:
 *      editar planes (incluida la descripción/objetivo), tareas, fechas,
 *      períodos, atributos, filtros, orden, línea temporal y el nombre del
 *      documento.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo } = React;

  const instanceId = shell.app && shell.app.instanceId;
  const teamId = shell.app && shell.app.teamId;

  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) { return window.location.origin; }
  }
  const API = apiBase();
  const req = (url, init) => (shell.authFetch ? shell.authFetch(url, init) : fetch(url, init));
  const INSTANCE_URL = API + '/api/app-instances/' + instanceId;

  const s = (v) => (v == null ? '' : String(v));
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const stamp = () => new Date().toISOString();
  /** Normaliza para matching tolerante (acentos, mayúsculas, separadores). */
  const canon = (v) => s(v).trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const STATUS = [
    ['pending', 'Pendiente'], ['in_progress', 'En Curso'],
    ['completed', 'Completado'], ['blocked', 'Bloqueado'],
  ];
  const STATUS_CLASS = {
    pending: 'kg-st-pending', in_progress: 'kg-st-progress',
    completed: 'kg-st-done', blocked: 'kg-st-blocked',
  };
  const STATUS_ALIASES = {
    pendiente: 'pending', pending: 'pending', todo: 'pending', 'por hacer': 'pending',
    'en curso': 'in_progress', 'en progreso': 'in_progress', doing: 'in_progress',
    in_progress: 'in_progress', 'in progress': 'in_progress', progreso: 'in_progress',
    completado: 'completed', completada: 'completed', completed: 'completed',
    done: 'completed', hecho: 'completed', terminado: 'completed', finalizado: 'completed',
    bloqueado: 'blocked', bloqueada: 'blocked', blocked: 'blocked', trabado: 'blocked',
  };
  const normStatus = (v) => STATUS_ALIASES[canon(v)] || (STATUS.some(([k]) => k === v) ? v : '');
  const GRANULARITIES = [
    ['daily', 'Diaria'], ['weekly', 'Semanal'], ['biweekly', 'Quincenal'],
    ['monthly', 'Mensual'], ['quarterly', 'Trimestral'],
  ];
  /** Vida de una lápida de tarea: pasado ese plazo ya no puede reaparecer. */
  const TOMB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  /** Cadencia de sincronización según el foco de la ventana. */
  const SYNC_ACTIVE_MS = 4000;
  const SYNC_IDLE_MS = 15000;
  const SAVE_DEBOUNCE_MS = 500;

  function ymd(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  const today = () => ymd(new Date());
  /** Fecha ISO corta (YYYY-MM-DD) o '' si no parsea. */
  function isoDate(v) {
    const raw = s(v).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? '' : ymd(d);
  }
  const dmy = (v) => {
    const iso = isoDate(v);
    return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
  };

  function buildPeriods(granularity, count, anchor) {
    const size = granularity === 'daily' ? 1 : granularity === 'weekly' ? 7
      : granularity === 'biweekly' ? 14 : granularity === 'monthly' ? 30 : 90;
    const prefix = granularity === 'daily' ? 'D' : granularity === 'weekly' ? 'W'
      : granularity === 'biweekly' ? 'B' : granularity === 'monthly' ? 'M' : 'Q';
    const n = clamp(Math.round(count) || 8, 1, granularity === 'daily' ? 90 : 24);
    const start0 = anchor ? new Date(anchor + 'T12:00:00') : new Date();
    const out = [];
    for (let i = 0; i < n; i++) {
      const start = new Date(start0.getTime() + i * size * 86400000);
      const end = new Date(start.getTime() + (size - 1) * 86400000);
      out.push({
        id: 'p' + (i + 1),
        shortName: granularity === 'daily' ? (start.getDate() + '/' + (start.getMonth() + 1)) : (prefix + (i + 1)),
        name: granularity === 'daily' ? ymd(start) : (prefix + (i + 1)),
        startDate: ymd(start), endDate: ymd(end),
      });
    }
    return out;
  }
  const ganttProgress = (g) => {
    const tasks = (g.tasks || []);
    if (!tasks.length) return 0;
    return Math.round(tasks.reduce((sum, t) => sum + (Number(t.progress) || 0), 0) / tasks.length);
  };

  // ── Fechas ↔ períodos ───────────────────────────────────────────────────
  // Las fechas mandan: si la tarea tiene inicio (y fin), los recuadros que se
  // pintan son EXACTAMENTE los períodos que ese rango cruza. Si no tiene
  // fechas, se conservan los períodos marcados a mano (datos históricos).

  /** Períodos que cruza [start, end]; null si la tarea no tiene fechas. */
  function periodsForRange(periods, startDate, endDate) {
    const a = isoDate(startDate), b = isoDate(endDate);
    if (!a && !b) return null;
    const lo = a || b, hi = b || a;
    const from = lo <= hi ? lo : hi, to = lo <= hi ? hi : lo;
    return periods.map((p) => s(p.startDate) <= to && from <= s(p.endDate));
  }
  /** Primer/último período marcado: {from, to} o null. */
  function rangeOfPeriods(arr) {
    let from = -1, to = -1;
    for (let i = 0; i < (arr || []).length; i++) {
      if (arr[i]) { if (from < 0) from = i; to = i; }
    }
    return from < 0 ? null : { from, to };
  }
  /** Fechas efectivas de la tarea (propias o derivadas de sus períodos). */
  function taskDates(t, periods) {
    const start = isoDate(t.taskStartDate), end = isoDate(t.taskEndDate);
    if (start || end) return { start: start || end, end: end || start, own: true };
    const r = rangeOfPeriods(t.periods);
    if (!r || !periods[r.from]) return { start: '', end: '', own: false };
    return { start: s(periods[r.from].startDate), end: s((periods[r.to] || periods[r.from]).endDate), own: false };
  }
  const isOverdue = (t, periods) => {
    const d = taskDates(t, periods);
    return !!(d.end && d.end < today() && t.status !== 'completed');
  };

  // ── Fusión sin pérdida (colaboración) ───────────────────────────────────
  // Regla: gana la edición MÁS RECIENTE **por tarea**, no el último PUT del
  // plan completo. Así dos personas editando tareas distintas del mismo plan
  // no se pisan. Las bajas viajan como lápidas para no "resucitar" tareas.

  const tombOf = (g) => (Array.isArray(g && g.deletedTasks) ? g.deletedTasks : []);
  function pruneTombs(list) {
    const limit = Date.now() - TOMB_TTL_MS;
    const byId = new Map();
    for (const d of list || []) {
      if (!d || !d.id) continue;
      const at = s(d.at);
      const prev = byId.get(d.id);
      if (!prev || at > s(prev.at)) byId.set(d.id, { id: d.id, at, by: s(d.by) });
    }
    return Array.from(byId.values()).filter((d) => {
      const ms = Date.parse(d.at);
      return isNaN(ms) || ms >= limit;
    });
  }
  function mergeTasks(localTasks, remoteTasks, tombs) {
    const tombAt = new Map(tombs.map((d) => [d.id, s(d.at)]));
    const remoteById = new Map((remoteTasks || []).map((t) => [t.id, t]));
    const out = [];
    const seen = new Set();
    const take = (t) => {
      if (!t || !t.id || seen.has(t.id)) return;
      const dead = tombAt.get(t.id);
      if (dead && dead > s(t.updatedAt)) return;  // borrada después de su última edición
      seen.add(t.id);
      out.push(t);
    };
    // El orden que ve quien está mirando la pantalla manda; lo nuevo del otro
    // lado se añade al final (no saltan las filas mientras se trabaja).
    for (const lt of localTasks || []) {
      const rt = remoteById.get(lt.id);
      take(!rt || s(lt.updatedAt) >= s(rt.updatedAt) ? lt : rt);
    }
    for (const rt of remoteTasks || []) take(rt);
    return out;
  }
  /** Campos de cabecera del plan: se resuelven en bloque por `metaUpdatedAt`. */
  const META_FIELDS = ['name', 'shortName', 'objective', 'owner', 'ownerId', 'teamMemberIds', 'color'];
  function mergeGantt(local, remote) {
    if (!local) return remote;
    if (!remote) return local;
    const meta = s(remote.metaUpdatedAt) > s(local.metaUpdatedAt) ? remote : local;
    const tombs = pruneTombs([...tombOf(local), ...tombOf(remote)]);
    const merged = Object.assign({}, remote, local);
    for (const f of META_FIELDS) merged[f] = meta[f];
    merged.metaUpdatedAt = s(meta.metaUpdatedAt);
    merged.deletedTasks = tombs;
    merged.tasks = mergeTasks(local.tasks, remote.tasks, tombs);
    merged.progress = ganttProgress(merged);
    return merged;
  }
  function mergeGanttLists(local, remote) {
    const remoteById = new Map(remote.map((g) => [g.id, g]));
    const out = [];
    const seen = new Set();
    for (const lg of local) {
      const rg = remoteById.get(lg.id);
      if (rg) { out.push(mergeGantt(lg, rg)); seen.add(lg.id); }
      else if (pendingWrite.has(lg.id)) { out.push(lg); seen.add(lg.id); }
      // Si no está en el servidor y no tenemos escritura pendiente, otro lo borró.
    }
    for (const rg of remote) {
      if (!seen.has(rg.id) && !pendingDelete.has(rg.id)) out.push(rg);
    }
    return out;
  }

  // ── Estado del módulo (closure) ─────────────────────────────────────────
  let model = {
    gantts: [], periods: [], members: [], entityTypes: [], entities: [],
    enabledEntityTypeIds: [], rawConfig: {},
    planLabel: 'Plan', taskLabel: 'Tarea',
    granularity: 'weekly', periodsCount: 8, timelineStartDate: '',
    docName: '', me: null, isAdmin: false, loaded: false, error: null,
    // Vista compartida por usuario y agente (el agente puede filtrar/ordenar).
    tab: '', filterOwner: '', filterPeriod: '', sort: null,
    sync: { at: '', saving: 0, offline: false },
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l({ ...model }));
  const setModel = (patch) => { model = Object.assign({}, model, patch); emit(); };

  /** Planes con escritura en vuelo o encolada (no deben caerse en la fusión). */
  const pendingWrite = new Set();
  /** Planes borrados localmente cuyo DELETE aún no confirma el servidor. */
  const pendingDelete = new Set();
  const saveTimers = new Map();
  /** Serializa TODA la red mutante: sin carreras entre refresh y guardados. */
  let chain = Promise.resolve();
  function serial(fn) {
    const run = () => Promise.resolve().then(fn).catch((e) => { console.warn('[gantt] sync', e); });
    chain = chain.then(run, run);
    return chain;
  }
  const meLabel = () => (model.me && (model.me.name || model.me.id)) || '';

  // ── Normalización ───────────────────────────────────────────────────────
  function normalizeTask(t, periods) {
    const base = Object.assign(
      { periods: [], progress: 0, status: 'pending', notes: '', entityIds: [], extra: {} },
      t,
    );
    base.status = normStatus(base.status) || 'pending';
    base.progress = clamp(Math.round(Number(base.progress) || 0), 0, 100);
    base.taskStartDate = isoDate(base.taskStartDate);
    base.taskEndDate = isoDate(base.taskEndDate);
    base.entityIds = Array.isArray(base.entityIds) ? base.entityIds : [];
    // Las fechas mandan sobre los recuadros; sin fechas, se respeta lo marcado.
    const fromDates = periodsForRange(periods, base.taskStartDate, base.taskEndDate);
    base.periods = fromDates || periods.map((_, i) => !!(t.periods || [])[i]);
    return base;
  }
  function normalizeGantt(g, periods) {
    const out = Object.assign({ tasks: [], teamMemberIds: [], color: '#3b82f6' }, g);
    // Sellos del servidor: no forman parte del modelo (el de CAS se lee del
    // item recién traído, no de aquí) y ensuciarían la detección de cambios.
    delete out.createdAt;
    delete out.updatedAt;
    out.deletedTasks = pruneTombs(tombOf(g));
    out.tasks = (g.tasks || []).filter((t) => t && t.id).map((t) => normalizeTask(t, periods));
    out.progress = ganttProgress(out);
    return out;
  }
  const isPlanItem = (it) => it && it.kind !== 'definition' && s(it.name);
  /** Lo que se persiste del plan (sin campos derivados del servidor). */
  function serializeGantt(g) {
    const out = Object.assign({}, g);
    delete out.createdAt;
    delete out.updatedAt;   // lo pone el backend
    return out;
  }

  function periodsFromConfig(config) {
    return Array.isArray(config.periods) && config.periods.length
      ? config.periods
      : buildPeriods(config.periodGranularity || 'weekly', config.periodsCount || 8, config.timelineStartDate);
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
  /**
   * PUT del plan con control de concurrencia optimista: `_expectedUpdatedAt`
   * es el sello que leímos; si el backend lo soporta y no coincide devuelve
   * 409 con la copia vigente y reintentamos fusionando sobre ella.
   */
  async function putGantt(g, expected) {
    const body = serializeGantt(g);
    if (expected) body._expectedUpdatedAt = expected;
    const res = await req(INSTANCE_URL + '/items/' + encodeURIComponent(g.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* cuerpo vacío */ }
    return { ok: res.ok, status: res.status, data: data || {} };
  }

  // ── Sincronización ──────────────────────────────────────────────────────
  /** Firma de lo que se ve en pantalla: si no cambió, no se repinta. */
  const viewSignature = (mm) => JSON.stringify([
    mm.gantts, mm.periods, mm.planLabel, mm.taskLabel, mm.granularity,
    mm.periodsCount, mm.timelineStartDate, mm.enabledEntityTypeIds, mm.docName,
    mm.loaded, mm.error,
  ]);

  /**
   * Fusiona en el modelo lo que hay en el servidor (items + config).
   *
   * Se emite SOLO si algo cambió: con una sincronización cada pocos segundos,
   * repintar siempre molestaría a quien está escribiendo en un campo.
   */
  function applyRemote(items, instance) {
    const config = (instance && instance.config) || model.rawConfig || {};
    const periods = (Array.isArray(config.periods) && config.periods.length)
      ? config.periods
      : (model.periods.length ? model.periods : periodsFromConfig(config));
    const remote = (items || []).filter(isPlanItem).map((g) => normalizeGantt(g, periods));
    const local = model.gantts.map((g) => normalizeGantt(g, periods));
    const patch = {
      gantts: mergeGanttLists(local, remote),
      periods,
      loaded: true, error: null,
    };
    if (instance) {
      patch.rawConfig = config;
      patch.docName = s(instance.name);
      patch.planLabel = s(config.planLabel) || 'Plan';
      patch.taskLabel = s(config.taskLabel) || 'Tarea';
      patch.granularity = s(config.periodGranularity) || 'weekly';
      patch.periodsCount = Number(config.periodsCount) || periods.length;
      patch.timelineStartDate = s(config.timelineStartDate);
      patch.enabledEntityTypeIds = config.enabledEntityTypeIds || [];
    }
    const next = Object.assign({}, model, patch);
    const quiet = viewSignature(next) === viewSignature(model) && !model.sync.offline;
    next.sync = Object.assign({}, model.sync, { at: stamp(), offline: false });
    model = next;
    if (!quiet) emit();
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
        error: model.loaded ? model.error : ((e && e.message) || 'No se pudo cargar.'),
        sync: Object.assign({}, model.sync, { offline: true }),
      });
      return null;
    }
  }
  const refresh = (withInstance) => serial(() => doRefresh(withInstance !== false));

  /**
   * Guardado leer-fusionar-escribir: relee el plan del servidor, fusiona lo
   * ajeno con lo propio y recién ahí escribe. Ningún cambio de otra persona
   * se pierde por el simple hecho de que nosotros hayamos guardado después.
   */
  async function doSave(id) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let expected = null;
      const items = await fetchItems().catch(() => null);
      if (items) {
        applyRemote(items, null);
        const remote = items.find((it) => it && it.id === id);
        expected = remote ? s(remote.updatedAt) : null;
      } else {
        setModel({ sync: Object.assign({}, model.sync, { offline: true }) });
      }
      const merged = model.gantts.find((g) => g.id === id);
      if (!merged) return;   // el plan dejó de existir (borrado local o remoto)
      const res = await putGantt(merged, expected);
      if (res.ok) {
        setModel({ sync: Object.assign({}, model.sync, { at: stamp(), offline: false }) });
        return;
      }
      if (res.status === 409) continue;                   // alguien escribió: reintenta
      if (res.status === 404) { pendingDelete.delete(id); return; }
      shell.notify({ level: 'error', text: 'No se pudo guardar el plan.' });
      return;
    }
    shell.notify({ level: 'warn', text: 'El plan cambió mientras guardabas; revisa el resultado.' });
  }

  function queueSave(id) {
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
  function flushPending() {
    for (const [id, timer] of saveTimers) {
      clearTimeout(timer);
      saveTimers.delete(id);
      serial(() => doSave(id));
    }
  }

  async function persistConfig() {
    const config = Object.assign({}, model.rawConfig, {
      periods: model.periods,
      periodGranularity: model.granularity,
      periodsCount: model.periodsCount,
      timelineStartDate: model.timelineStartDate,
      planLabel: model.planLabel,
      taskLabel: model.taskLabel,
      enabledEntityTypeIds: model.enabledEntityTypeIds,
    });
    model.rawConfig = config;
    try {
      const res = await req(INSTANCE_URL, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error('config ' + res.status);
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar la configuración.' });
    }
  }

  // ── Carga inicial ───────────────────────────────────────────────────────
  let loadedOnce = false;
  async function load() {
    if (loadedOnce) return;
    loadedOnce = true;
    await refresh(true);
    try {
      const res = await req(API + '/api/identity/actors', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({
          members: (data.actors || []).filter((a) => a && a.active !== false)
            .map((a) => ({ id: a.id, name: a.displayName || a.name || a.email || a.id })),
        });
      }
    } catch (e) { /* opcional */ }
    try {
      const res = await req(API + '/api/entities', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({ entityTypes: data.entityTypes || [], entities: data.entities || [] });
      }
    } catch (e) { /* opcional */ }
    try {
      const res = await req(API + '/api/identity/me', { cache: 'no-store' });
      if (res.ok) {
        const me = await res.json();
        setModel({
          me: { id: s(me.id), name: s(me.displayName || me.name || me.email || me.id) },
          isAdmin: me.role === 'superadmin' || !!(teamId && me.team_roles && me.team_roles[teamId] === 'admin'),
        });
      }
    } catch (e) { /* opcional */ }
  }

  // Bucle de sincronización: rápido con la ventana en foco, lento si está de
  // fondo, en pausa si la pestaña no se ve (mismo criterio que las otras apps
  // de kimos-packages, pero con fusión en vez de reemplazo).
  let syncSubs = 0;
  let syncTimer = null;
  function syncDelay() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
    const focused = typeof document === 'undefined' || typeof document.hasFocus !== 'function' || document.hasFocus();
    return focused ? SYNC_ACTIVE_MS : SYNC_IDLE_MS;
  }
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    if (!syncSubs) return;
    const delay = syncDelay();
    if (delay == null) { syncTimer = setTimeout(scheduleSync, SYNC_IDLE_MS); return; }
    syncTimer = setTimeout(() => { refresh(true).then(scheduleSync); }, delay);
  }
  function onWake() { if (syncSubs) refresh(true).then(scheduleSync); }
  function startSync() {
    syncSubs += 1;
    if (syncSubs > 1) return () => stopSync();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake);
    if (typeof window !== 'undefined') window.addEventListener('focus', onWake);
    scheduleSync();
    return () => stopSync();
  }
  function stopSync() {
    syncSubs = Math.max(0, syncSubs - 1);
    if (syncSubs) return;
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
    if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
  }

  // ── Búsqueda tolerante de planes y tareas ───────────────────────────────
  function findGantt(ref) {
    const raw = s(ref).trim();
    if (!raw) return model.gantts.length === 1 ? model.gantts[0] : null;
    const needle = canon(raw);
    const exact = model.gantts.find((g) => g.id === raw)
      || model.gantts.find((g) => canon(g.name) === needle || canon(g.shortName) === needle);
    if (exact) return exact;
    const partial = model.gantts.filter((g) => {
      const n = canon(g.name), sn = canon(g.shortName);
      return (needle && (n.includes(needle) || needle.includes(n) || sn === needle));
    });
    return partial.length === 1 ? partial[0] : null;
  }
  function ganttCandidates() {
    return model.gantts.map((g) => '"' + g.name + '"').join(', ') || '(ninguno)';
  }
  function findTask(g, ref) {
    const raw = s(ref).trim();
    if (!raw) return null;
    const needle = canon(raw);
    const tasks = g.tasks || [];
    const byId = tasks.find((t) => t.id === raw);
    if (byId) return byId;
    const byName = tasks.find((t) => canon(t.name) === needle);
    if (byName) return byName;
    const partial = tasks.filter((t) => canon(t.name).includes(needle));
    return partial.length === 1 ? partial[0] : null;
  }
  /** Resuelve tarea en un plan concreto o en TODOS (ids únicos, nombres únicos). */
  function locateTask(ganttRef, taskRef) {
    const raw = s(taskRef).trim();
    if (!raw) return { error: 'Falta la tarea (id o nombre).' };
    const scoped = s(ganttRef).trim() ? findGantt(ganttRef) : null;
    if (s(ganttRef).trim() && !scoped) {
      return { error: 'Plan "' + ganttRef + '" no encontrado. Planes: ' + ganttCandidates() + '.' };
    }
    const pool = scoped ? [scoped] : model.gantts;
    const hits = [];
    for (const g of pool) {
      const t = findTask(g, raw);
      if (t) hits.push({ gantt: g, task: t });
    }
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      return {
        error: '"' + raw + '" está en varios planes: ' + hits.map((x) => '"' + x.gantt.name + '"').join(', ')
          + '. Repite la acción indicando también `gantt`.',
      };
    }
    const names = pool.flatMap((g) => (g.tasks || []).map((t) => '"' + t.name + '"')).slice(0, 40);
    return { error: 'Tarea "' + raw + '" no encontrada. Tareas disponibles: ' + (names.join(', ') || '(ninguna)') + '.' };
  }
  function findMember(ref) {
    const raw = s(ref).trim();
    if (!raw) return null;
    const needle = canon(raw);
    return model.members.find((m) => m.id === raw)
      || model.members.find((m) => canon(m.name) === needle)
      || model.members.filter((m) => canon(m.name).includes(needle))[0]
      || null;
  }

  // ── Mutaciones (las mismas para la UI y para el agente) ─────────────────
  function replaceGantt(next, opts) {
    const g = Object.assign({}, next);
    g.progress = ganttProgress(g);
    if (opts && opts.meta) { g.metaUpdatedAt = stamp(); g.updatedBy = meLabel(); }
    setModel({ gantts: model.gantts.map((x) => (x.id === g.id ? g : x)) });
    queueSave(g.id);
    return g;
  }
  function writeTask(g, task) {
    const stamped = Object.assign({}, task, { updatedAt: stamp(), updatedBy: meLabel() });
    const exists = (g.tasks || []).some((t) => t.id === stamped.id);
    return replaceGantt(Object.assign({}, g, {
      tasks: exists
        ? g.tasks.map((t) => (t.id === stamped.id ? stamped : t))
        : [...(g.tasks || []), stamped],
    }));
  }

  async function addGantt(fields) {
    const member = fields.ownerId ? findMember(fields.ownerId) : (fields.owner ? findMember(fields.owner) : null);
    const g = normalizeGantt({
      id: uid('gantt'),
      name: s(fields.name).trim() || 'Nuevo plan',
      shortName: (s(fields.shortName).trim() || s(fields.name).trim() || 'Plan').slice(0, 24),
      objective: s(fields.objective) || '',
      owner: member ? member.name : (s(fields.owner) || 'Sin asignar'),
      ownerId: member ? member.id : '',
      teamMemberIds: member ? [member.id] : [],
      color: s(fields.color) || 'hsl(' + Math.floor(Math.random() * 360) + ', 60%, 45%)',
      progress: 0,
      tasks: [],
      deletedTasks: [],
      metaUpdatedAt: stamp(),
      updatedBy: meLabel(),
    }, model.periods);
    pendingWrite.add(g.id);
    setModel({ gantts: [...model.gantts, g] });
    try {
      if (shell.items && shell.items.create) await shell.items.create(serializeGantt(g));
      else await putGantt(g, null);
    } catch (e) {
      setModel({ gantts: model.gantts.filter((x) => x.id !== g.id) });
      pendingWrite.delete(g.id);
      return { success: false, error: 'No se pudo crear el plan.' };
    }
    pendingWrite.delete(g.id);
    return { success: true, message: 'Plan "' + g.name + '" creado.', ganttId: g.id };
  }

  function updateGantt(ganttRef, patch) {
    const g = findGantt(ganttRef);
    if (!g) return { success: false, error: 'Plan "' + s(ganttRef) + '" no encontrado. Planes: ' + ganttCandidates() + '.' };
    const next = Object.assign({}, g);
    const changed = [];
    if (patch.name != null && s(patch.name).trim()) {
      next.name = s(patch.name).trim();
      if (patch.shortName == null && canon(g.shortName) === canon(g.name)) next.shortName = next.name.slice(0, 24);
      changed.push('nombre');
    }
    if (patch.shortName != null && s(patch.shortName).trim()) { next.shortName = s(patch.shortName).trim().slice(0, 24); changed.push('sigla'); }
    if (patch.objective != null) { next.objective = s(patch.objective); changed.push('descripción'); }
    if (patch.color != null && s(patch.color).trim()) { next.color = s(patch.color).trim(); changed.push('color'); }
    if (patch.ownerId != null || patch.owner != null) {
      const member = findMember(patch.ownerId || patch.owner);
      next.ownerId = member ? member.id : '';
      next.owner = member ? member.name : (s(patch.owner) || 'Sin asignar');
      next.teamMemberIds = member ? Array.from(new Set([...(g.teamMemberIds || []), member.id])) : (g.teamMemberIds || []);
      changed.push('responsable');
    }
    if (!changed.length) {
      return { success: false, error: 'Nada que cambiar. Campos válidos: name, shortName, objective (la descripción del plan), ownerId, color.' };
    }
    replaceGantt(next, { meta: true });
    return { success: true, message: 'Plan "' + next.name + '": ' + changed.join(', ') + ' actualizado.' };
  }

  async function deleteGantt(ganttRef) {
    const g = findGantt(ganttRef);
    if (!g) return { success: false, error: 'Plan "' + s(ganttRef) + '" no encontrado. Planes: ' + ganttCandidates() + '.' };
    pendingDelete.add(g.id);
    setModel({
      gantts: model.gantts.filter((x) => x.id !== g.id),
      tab: model.tab === g.id ? '' : model.tab,
    });
    try {
      if (shell.items && shell.items.remove) await shell.items.remove(g.id);
      else await req(INSTANCE_URL + '/items/' + encodeURIComponent(g.id), { method: 'DELETE' });
    } catch (e) {
      pendingDelete.delete(g.id);
      return { success: false, error: 'No se pudo eliminar.' };
    }
    pendingDelete.delete(g.id);
    return { success: true, message: 'Plan "' + g.name + '" eliminado.' };
  }

  function addTask(ganttRef, fields) {
    const g = findGantt(ganttRef);
    if (!g) return { success: false, error: 'Plan "' + s(ganttRef) + '" no encontrado. Planes: ' + ganttCandidates() + '.' };
    const member = findMember(fields.responsibleId || fields.responsibleName || fields.responsible);
    const task = normalizeTask({
      id: uid('task'),
      name: s(fields.name).trim() || 'Nueva tarea',
      responsibleId: member ? member.id : '',
      responsibleName: member ? member.name : s(fields.responsibleName || fields.responsible),
      periods: model.periods.map(() => false),
      progress: clamp(Math.round(Number(fields.progress) || 0), 0, 100),
      status: normStatus(fields.status) || 'pending',
      taskStartDate: isoDate(fields.taskStartDate || fields.startDate),
      taskEndDate: isoDate(fields.taskEndDate || fields.endDate),
      notes: s(fields.notes), entityIds: [], extra: {},
    }, model.periods);
    writeTask(g, task);
    return { success: true, message: 'Tarea "' + task.name + '" añadida a ' + g.name + '.', taskId: task.id };
  }

  function updateTask(ganttRef, taskRef, patch) {
    const hit = locateTask(ganttRef, taskRef);
    if (hit.error) return { success: false, error: hit.error };
    const next = Object.assign({}, hit.task, patch);
    // Quitar las fechas también despinta la barra (si no, quedaría un tramo
    // marcado sin fechas que lo justifiquen).
    const touchedDates = Object.prototype.hasOwnProperty.call(patch, 'taskStartDate')
      || Object.prototype.hasOwnProperty.call(patch, 'taskEndDate');
    if (touchedDates && !isoDate(next.taskStartDate) && !isoDate(next.taskEndDate)) {
      next.periods = model.periods.map(() => false);
    }
    writeTask(hit.gantt, normalizeTask(next, model.periods));
    return { success: true, message: 'Tarea "' + hit.task.name + '" actualizada.' };
  }

  function deleteTask(ganttRef, taskRef) {
    const hit = locateTask(ganttRef, taskRef);
    if (hit.error) return { success: false, error: hit.error };
    const g = hit.gantt, t = hit.task;
    replaceGantt(Object.assign({}, g, {
      tasks: (g.tasks || []).filter((x) => x.id !== t.id),
      // Lápida: si otra persona todavía la tiene en pantalla, no reaparece.
      deletedTasks: pruneTombs([...tombOf(g), { id: t.id, at: stamp(), by: meLabel() }]),
    }));
    return { success: true, message: 'Tarea "' + t.name + '" eliminada.' };
  }

  /** Fija el rango de la tarea por índices de período (o lo limpia con from<0). */
  function setTaskRangeByIndex(g, t, from, to) {
    if (from < 0 || to < 0) {
      return writeTask(g, normalizeTask(Object.assign({}, t, {
        taskStartDate: '', taskEndDate: '', periods: model.periods.map(() => false),
      }), model.periods));
    }
    const lo = clamp(Math.min(from, to), 0, model.periods.length - 1);
    const hi = clamp(Math.max(from, to), 0, model.periods.length - 1);
    return writeTask(g, normalizeTask(Object.assign({}, t, {
      taskStartDate: s(model.periods[lo].startDate),
      taskEndDate: s(model.periods[hi].endDate),
    }), model.periods));
  }
  /** Clic en una celda: define, extiende o encoge el rango de la tarea. */
  function toggleCell(g, t, i) {
    const cur = rangeOfPeriods(t.periods);
    if (!cur) return setTaskRangeByIndex(g, t, i, i);
    if (cur.from === i && cur.to === i) return setTaskRangeByIndex(g, t, -1, -1);
    if (i < cur.from) return setTaskRangeByIndex(g, t, i, cur.to);
    if (i > cur.to) return setTaskRangeByIndex(g, t, cur.from, i);
    if (i === cur.from) return setTaskRangeByIndex(g, t, i, i);
    return setTaskRangeByIndex(g, t, cur.from, i);   // encoger por el final
  }

  function regenerateTimeline(granularity, count, startDate) {
    const gran = GRANULARITIES.some(([k]) => k === granularity) ? granularity : model.granularity;
    const n = clamp(Math.round(Number(count) || model.periodsCount || 8), 1, gran === 'daily' ? 90 : 24);
    const anchor = isoDate(startDate);
    const periods = buildPeriods(gran, n, anchor);
    // Las tareas con fechas se re-pintan sobre la nueva escala; las que solo
    // tienen recuadros marcados conservan sus índices (dato histórico).
    const gantts = model.gantts.map((g) => Object.assign({}, g, {
      tasks: (g.tasks || []).map((t) => normalizeTask(t, periods)),
    }));
    setModel({
      periods, gantts, granularity: gran, periodsCount: n, timelineStartDate: anchor,
      filterPeriod: '',
    });
    persistConfig();
    for (const g of gantts) queueSave(g.id);
    return { success: true, message: 'Línea temporal regenerada: ' + n + ' períodos (' + gran + ').' };
  }

  async function renameDocument(name) {
    const clean = s(name).trim();
    if (!clean) return { success: false, error: 'Falta el nuevo nombre del documento.' };
    try {
      const res = await req(INSTANCE_URL, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      if (!res.ok) throw new Error('rename ' + res.status);
    } catch (e) {
      return { success: false, error: 'No se pudo renombrar el documento.' };
    }
    setModel({ docName: clean });
    try { shell.window.setTitle(clean); } catch (e) { /* opcional */ }
    return { success: true, message: 'Documento renombrado a "' + clean + '".' };
  }

  // ── Agente ──────────────────────────────────────────────────────────────
  // Paridad con la UI: todo lo que una persona puede hacer en la app, el
  // agente lo puede hacer también — incluida la descripción del plan, que
  // antes no tenía acción y hacía fallar UPDATE_GANTT.

  const TOOLS = [
    { name: 'ADD_GANTT', description: 'Crea un plan.', inputSchema: { type: 'object', properties: {
      name: { type: 'string' }, shortName: { type: 'string', description: 'sigla corta para la pestaña' },
      objective: { type: 'string', description: 'descripción/objetivo del plan' },
      ownerId: { type: 'string', description: 'id o nombre del responsable' }, color: { type: 'string' } }, required: ['name'] } },
    { name: 'UPDATE_GANTT', description: 'Edita un plan: nombre, sigla, descripción (objective), responsable o color.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string', description: 'id o nombre del plan (alias: ganttId)' },
      name: { type: 'string' }, shortName: { type: 'string' },
      objective: { type: 'string', description: 'descripción del plan (alias: description)' },
      ownerId: { type: 'string' }, color: { type: 'string' } }, required: ['gantt'] } },
    { name: 'DELETE_GANTT', description: 'Elimina un plan completo con sus tareas.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' } }, required: ['gantt'] } },
    { name: 'SELECT_GANTT', description: 'Abre la pestaña de un plan (o el resumen con gantt vacío).', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' } } } },
    { name: 'ADD_TASK', description: 'Añade una tarea a un plan.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, name: { type: 'string' }, responsibleId: { type: 'string', description: 'id o nombre' },
      status: { type: 'string', description: 'pending|in_progress|completed|blocked' }, progress: { type: 'number' },
      startDate: { type: 'string', description: 'YYYY-MM-DD (alias: taskStartDate)' },
      endDate: { type: 'string', description: 'YYYY-MM-DD (alias: taskEndDate)' },
      notes: { type: 'string' } }, required: ['name'] } },
    { name: 'UPDATE_TASK', description: 'Edita cualquier campo de una tarea (nombre, responsable, estado, avance, fechas, notas).', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string', description: 'id o nombre de la tarea (alias: taskId)' },
      name: { type: 'string' }, responsibleId: { type: 'string' }, status: { type: 'string' }, progress: { type: 'number' },
      startDate: { type: 'string' }, endDate: { type: 'string' }, notes: { type: 'string' } }, required: ['task'] } },
    { name: 'UPDATE_TASK_PROGRESS', description: 'Avance 0-100 de una tarea.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string' }, progress: { type: 'number' } }, required: ['task', 'progress'] } },
    { name: 'UPDATE_TASK_STATUS', description: 'Estado: pending|in_progress|completed|blocked.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string' }, status: { type: 'string' } }, required: ['task', 'status'] } },
    { name: 'UPDATE_TASK_DATES', description: 'Fechas de inicio/fin de la tarea; son las que pintan los recuadros de la gantt.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string' },
      taskStartDate: { type: 'string', description: 'YYYY-MM-DD' }, taskEndDate: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['task'] } },
    { name: 'SET_TASK_PERIOD', description: 'Marca/desmarca un período (índice desde 0) de una tarea.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string' }, periodIndex: { type: 'number' }, active: { type: 'boolean' } }, required: ['task', 'periodIndex'] } },
    { name: 'UPDATE_TASK_PERIODS', description: 'Fija el tramo de la tarea por períodos: lista de booleanos o from/to.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string' }, periods: { type: 'array', items: { type: 'boolean' } },
      from: { type: 'number' }, to: { type: 'number' } }, required: ['task'] } },
    { name: 'ASSIGN_ENTITY', description: 'Reemplaza los atributos de una tarea por la lista indicada (lista vacía = ninguno).', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string' }, entityNames: { type: 'array', items: { type: 'string' } } }, required: ['task'] } },
    { name: 'DELETE_TASK', description: 'Elimina una tarea.', inputSchema: { type: 'object', properties: {
      gantt: { type: 'string' }, task: { type: 'string' } }, required: ['task'] } },
    { name: 'SET_FILTER', description: 'Filtra la vista por responsable y/o período. clear:true limpia.', inputSchema: { type: 'object', properties: {
      ownerName: { type: 'string' }, ownerId: { type: 'string' },
      period: { type: 'string', description: 'id, sigla o índice del período' }, clear: { type: 'boolean' } } } },
    { name: 'SET_SORT', description: 'Ordena las tareas por una columna.', inputSchema: { type: 'object', properties: {
      column: { type: 'string', description: 'name|responsible|status|progress|start|end o la sigla/índice de un período' },
      direction: { type: 'string', description: 'asc|desc' }, clear: { type: 'boolean' } } } },
    { name: 'SET_TIMELINE', description: 'Regenera la línea temporal (solo admins del equipo).', inputSchema: { type: 'object', properties: {
      granularity: { type: 'string', description: 'daily|weekly|biweekly|monthly|quarterly' },
      periodsCount: { type: 'number' }, startDate: { type: 'string', description: 'YYYY-MM-DD' } } } },
    { name: 'SET_LABELS', description: 'Cambia cómo se llaman los planes y las tareas en esta app.', inputSchema: { type: 'object', properties: {
      planLabel: { type: 'string' }, taskLabel: { type: 'string' } } } },
    { name: 'RENAME_DOCUMENT', description: 'Renombra el documento (la instancia abierta de Planificación).', inputSchema: { type: 'object', properties: {
      name: { type: 'string' } }, required: ['name'] } },
  ];

  /** Sinónimos aceptados de tipo de acción (el agente no siempre acierta el nombre). */
  const ACTION_ALIASES = {
    UPDATE_PLAN: 'UPDATE_GANTT', EDIT_GANTT: 'UPDATE_GANTT', UPDATE_GANTT_OBJECTIVE: 'UPDATE_GANTT',
    UPDATE_GANTT_DESCRIPTION: 'UPDATE_GANTT', RENAME_GANTT: 'UPDATE_GANTT', SET_GANTT_COLOR: 'UPDATE_GANTT',
    ADD_PLAN: 'ADD_GANTT', CREATE_GANTT: 'ADD_GANTT', CREATE_PLAN: 'ADD_GANTT',
    DELETE_PLAN: 'DELETE_GANTT', REMOVE_GANTT: 'DELETE_GANTT',
    OPEN_GANTT: 'SELECT_GANTT', SELECT_PLAN: 'SELECT_GANTT',
    CREATE_TASK: 'ADD_TASK', EDIT_TASK: 'UPDATE_TASK',
    UPDATE_TASK_NAME: 'UPDATE_TASK', UPDATE_TASK_NOTES: 'UPDATE_TASK',
    UPDATE_TASK_RESPONSIBLE: 'UPDATE_TASK', SET_TASK_RESPONSIBLE: 'UPDATE_TASK',
    SET_TASK_DATES: 'UPDATE_TASK_DATES', SET_TASK_PERIODS: 'UPDATE_TASK_PERIODS',
    REMOVE_TASK: 'DELETE_TASK', CLEAR_FILTER: 'SET_FILTER', SET_FILTERS: 'SET_FILTER',
    SORT_TASKS: 'SET_SORT', SET_ORDER: 'SET_SORT',
    SET_PERIODS: 'SET_TIMELINE', UPDATE_TIMELINE: 'SET_TIMELINE',
    RENAME_INSTANCE: 'RENAME_DOCUMENT', RENAME_APP: 'RENAME_DOCUMENT',
  };
  /** Sinónimos de campos del payload (contrato histórico incluido). */
  function readPayload(p) {
    const v = Object.assign({}, p);
    const alias = (to, ...froms) => {
      if (v[to] != null && s(v[to]) !== '') return;
      for (const f of froms) if (v[f] != null && s(v[f]) !== '') { v[to] = v[f]; return; }
    };
    alias('gantt', 'ganttId', 'plan', 'planId', 'ganttName', 'planName');
    alias('task', 'taskId', 'tarea', 'taskName');
    alias('name', 'title', 'nombre', 'newName');
    alias('objective', 'description', 'descripcion', 'descripción', 'objetivo');
    alias('responsibleId', 'responsible', 'responsibleName', 'ownerId', 'owner', 'responsable');
    alias('startDate', 'taskStartDate', 'fechaInicio', 'start');
    alias('endDate', 'taskEndDate', 'fechaFin', 'end');
    alias('periodIndex', 'period', 'periodo', 'índice', 'index');
    alias('progress', 'avance', 'percent');
    alias('notes', 'notas', 'note');
    alias('column', 'sortBy', 'sortColumn', 'columna', 'key');
    alias('direction', 'dir', 'order', 'orden');
    return v;
  }

  const offAgent = shell.agent && shell.agent.register ? shell.agent.register({
    label: 'Planificación',
    description: 'Planes con tareas por períodos: crear y editar planes (incluida su descripción), '
      + 'tareas, responsables, estados, avance, fechas (que pintan la gantt), períodos, atributos, '
      + 'filtros, orden, línea temporal y el nombre del documento.',
    tools: TOOLS,
    getSnapshot: () => ({
      document: model.docName || undefined,
      labels: { plan: model.planLabel, task: model.taskLabel },
      periods: model.periods.map((p, i) => ({ i, id: p.id, name: p.shortName, from: p.startDate, to: p.endDate })),
      activeFilters: {
        responsable: model.filterOwner
          ? ((model.members.find((m) => m.id === model.filterOwner) || {}).name || model.filterOwner) : null,
        periodo: model.filterPeriod || null,
        orden: model.sort ? model.sort.key + ':' + model.sort.dir : null,
      },
      settings: {
        allowedUsers: model.members.map((m) => ({ id: m.id, name: m.name })),
        entityTypes: model.entityTypes.map((t) => ({ id: t.id, name: t.name, enabled: (model.enabledEntityTypeIds || []).includes(t.id) })),
        entities: model.entities.map((e) => ({
          id: e.id, name: e.name,
          typeName: (model.entityTypes.find((t) => t.id === e.typeId) || {}).name || '',
        })),
        timeline: { granularity: model.granularity, periodsCount: model.periodsCount, startDate: model.timelineStartDate },
        canEditTimeline: model.isAdmin,
      },
      plans: model.gantts.map((g) => ({
        id: g.id, name: g.name, shortName: g.shortName, objective: g.objective,
        owner: g.owner || null, progress: ganttProgress(g),
        tasks: (g.tasks || []).map((t) => {
          const d = taskDates(t, model.periods);
          return {
            id: t.id, name: t.name, status: t.status, progress: t.progress,
            responsible: t.responsibleName || null,
            startDate: d.start || null, endDate: d.end || null,
            isOverdue: isOverdue(t, model.periods) || undefined,
            notes: t.notes || undefined,
            entities: (t.entityIds || []).map((id) => (model.entities.find((e) => e.id === id) || {}).name).filter(Boolean),
            periods: (t.periods || []).map((b, i) => (b ? i : -1)).filter((i) => i >= 0),
          };
        }),
      })),
    }),
    dispatchAction: async (action) => {
      const type = ACTION_ALIASES[action.type] || action.type;
      const p = readPayload((action && action.payload) || {});
      switch (type) {
        case 'ADD_GANTT':
          return addGantt({ name: p.name, shortName: p.shortName, objective: p.objective, ownerId: p.responsibleId, color: p.color });
        case 'UPDATE_GANTT':
          return updateGantt(p.gantt, {
            name: p.name, shortName: p.shortName, objective: p.objective,
            ownerId: p.responsibleId, color: p.color,
          });
        case 'DELETE_GANTT': return deleteGantt(p.gantt);
        case 'SELECT_GANTT': {
          if (!s(p.gantt).trim()) { setModel({ tab: '' }); return { success: true, message: 'Resumen abierto.' }; }
          const g = findGantt(p.gantt);
          if (!g) return { success: false, error: 'Plan "' + s(p.gantt) + '" no encontrado. Planes: ' + ganttCandidates() + '.' };
          setModel({ tab: g.id });
          return { success: true, message: 'Plan "' + g.name + '" abierto.' };
        }
        case 'ADD_TASK':
          return addTask(p.gantt, {
            name: p.name, responsibleId: p.responsibleId, status: p.status, progress: p.progress,
            startDate: p.startDate, endDate: p.endDate, notes: p.notes,
          });
        case 'UPDATE_TASK': {
          const patch = {};
          if (p.name != null && s(p.name).trim()) patch.name = s(p.name).trim();
          if (p.notes != null) patch.notes = s(p.notes);
          if (p.progress != null) patch.progress = clamp(Math.round(Number(p.progress) || 0), 0, 100);
          if (p.status != null) {
            const st = normStatus(p.status);
            if (!st) return { success: false, error: 'Estado inválido: "' + p.status + '". Válidos: ' + STATUS.map(([k]) => k).join(', ') + '.' };
            patch.status = st;
          }
          if (p.responsibleId != null) {
            const member = findMember(p.responsibleId);
            if (!member && s(p.responsibleId).trim()) {
              return { success: false, error: 'Responsable "' + p.responsibleId + '" no encontrado. Disponibles: ' + model.members.map((m) => '"' + m.name + '"').join(', ') + '.' };
            }
            patch.responsibleId = member ? member.id : '';
            patch.responsibleName = member ? member.name : '';
          }
          if (p.startDate != null) patch.taskStartDate = isoDate(p.startDate);
          if (p.endDate != null) patch.taskEndDate = isoDate(p.endDate);
          if (!Object.keys(patch).length) {
            return { success: false, error: 'Nada que cambiar. Campos válidos: name, responsibleId, status, progress, startDate, endDate, notes.' };
          }
          return updateTask(p.gantt, p.task, patch);
        }
        case 'UPDATE_TASK_PROGRESS':
          return updateTask(p.gantt, p.task, { progress: clamp(Math.round(Number(p.progress) || 0), 0, 100) });
        case 'UPDATE_TASK_STATUS': {
          const st = normStatus(p.status);
          if (!st) return { success: false, error: 'Estado inválido: "' + p.status + '". Válidos: ' + STATUS.map(([k]) => k).join(', ') + '.' };
          return updateTask(p.gantt, p.task, { status: st });
        }
        case 'UPDATE_TASK_DATES': {
          const patch = {};
          if (p.startDate != null) patch.taskStartDate = isoDate(p.startDate);
          if (p.endDate != null) patch.taskEndDate = isoDate(p.endDate);
          if (!Object.keys(patch).length) return { success: false, error: 'Indica taskStartDate y/o taskEndDate en formato YYYY-MM-DD.' };
          return updateTask(p.gantt, p.task, patch);
        }
        case 'SET_TASK_PERIOD': {
          const hit = locateTask(p.gantt, p.task);
          if (hit.error) return { success: false, error: hit.error };
          const max = model.periods.length - 1;
          const idx = clamp(Math.round(Number(p.periodIndex) || 0), 0, max);
          const active = p.active !== false;
          const cur = rangeOfPeriods(hit.task.periods);
          if (!active) {
            if (!cur || idx < cur.from || idx > cur.to) {
              return { success: true, message: 'La tarea ya no cubría ese período.' };
            }
            if (idx === cur.from && idx === cur.to) setTaskRangeByIndex(hit.gantt, hit.task, -1, -1);
            else if (idx === cur.from) setTaskRangeByIndex(hit.gantt, hit.task, idx + 1, cur.to);
            else setTaskRangeByIndex(hit.gantt, hit.task, cur.from, idx - 1);
          } else if (!cur) setTaskRangeByIndex(hit.gantt, hit.task, idx, idx);
          else setTaskRangeByIndex(hit.gantt, hit.task, Math.min(cur.from, idx), Math.max(cur.to, idx));
          return { success: true, message: 'Período ' + (idx + 1) + (active ? ' marcado' : ' desmarcado') + ' en "' + hit.task.name + '".' };
        }
        case 'UPDATE_TASK_PERIODS': {
          const hit = locateTask(p.gantt, p.task);
          if (hit.error) return { success: false, error: hit.error };
          const max = model.periods.length - 1;
          let from = -1, to = -1;
          if (Array.isArray(p.periods)) {
            const r = rangeOfPeriods(p.periods.map((x) => !!x));
            if (r) { from = r.from; to = r.to; }
          } else if (p.from != null || p.to != null) {
            from = clamp(Math.round(Number(p.from != null ? p.from : p.to) || 0), 0, max);
            to = clamp(Math.round(Number(p.to != null ? p.to : p.from) || 0), 0, max);
          } else {
            return { success: false, error: 'Indica `periods` (lista de booleanos) o `from`/`to` (índices desde 0, máximo ' + max + ').' };
          }
          setTaskRangeByIndex(hit.gantt, hit.task, from, to);
          return { success: true, message: 'Tramo de "' + hit.task.name + '" actualizado.' };
        }
        case 'ASSIGN_ENTITY': {
          const hit = locateTask(p.gantt, p.task);
          if (hit.error) return { success: false, error: hit.error };
          const names = Array.isArray(p.entityNames) ? p.entityNames : (Array.isArray(p.entityIds) ? p.entityIds : null);
          if (!names) {
            return { success: false, error: 'Indica `entityNames` (lista de nombres de atributo). Disponibles: '
              + (model.entities.map((e) => '"' + e.name + '"').join(', ') || '(ninguno)') + '.' };
          }
          const ids = [];
          const missing = [];
          for (const n of names) {
            const ent = model.entities.find((e) => e.id === n || canon(e.name) === canon(n));
            if (ent) ids.push(ent.id); else missing.push(s(n));
          }
          if (missing.length) {
            return { success: false, error: 'Atributos no encontrados: ' + missing.join(', ') + '. Disponibles: '
              + (model.entities.map((e) => '"' + e.name + '"').join(', ') || '(ninguno)') + '.' };
          }
          return updateTask(p.gantt, p.task, { entityIds: ids });
        }
        case 'DELETE_TASK': return deleteTask(p.gantt, p.task);
        case 'SET_FILTER': {
          if (p.clear) { setModel({ filterOwner: '', filterPeriod: '' }); return { success: true, message: 'Filtros limpiados.' }; }
          const patch = {};
          if (p.responsibleId != null || p.ownerName != null) {
            const raw = p.responsibleId != null ? p.responsibleId : p.ownerName;
            if (!s(raw).trim()) patch.filterOwner = '';
            else {
              const member = findMember(raw);
              if (!member) {
                return { success: false, error: 'Responsable "' + raw + '" no encontrado. Disponibles: '
                  + model.members.map((m) => '"' + m.name + '"').join(', ') + '.' };
              }
              patch.filterOwner = member.id;
            }
          }
          if (p.periodIndex != null) {
            const raw = s(p.periodIndex).trim();
            if (!raw) patch.filterPeriod = '';
            else {
              const byIndex = /^\d+$/.test(raw) ? model.periods[Number(raw)] : null;
              const found = byIndex || model.periods.find((x) => x.id === raw || canon(x.shortName) === canon(raw) || canon(x.name) === canon(raw));
              if (!found) {
                return { success: false, error: 'Período "' + raw + '" no existe. Períodos: '
                  + model.periods.map((x) => '"' + x.shortName + '"').join(', ') + '.' };
              }
              patch.filterPeriod = found.id;
            }
          }
          if (!Object.keys(patch).length) return { success: false, error: 'Indica ownerName, period y/o clear:true.' };
          setModel(patch);
          return { success: true, message: 'Filtros aplicados.' };
        }
        case 'SET_SORT': {
          if (p.clear || !s(p.column).trim()) { setModel({ sort: null }); return { success: true, message: 'Orden manual restaurado.' }; }
          const raw = s(p.column).trim();
          const key = resolveSortKey(raw);
          if (!key) {
            return { success: false, error: 'Columna "' + raw + '" no existe. Válidas: name, responsible, status, progress, start, end o una sigla de período ('
              + model.periods.map((x) => x.shortName).join(', ') + ').' };
          }
          const dir = canon(p.direction) === 'desc' ? 'desc' : 'asc';
          setModel({ sort: { key, dir } });
          return { success: true, message: 'Tareas ordenadas por ' + raw + ' (' + dir + ').' };
        }
        case 'SET_TIMELINE': {
          if (!model.isAdmin) return { success: false, error: 'Solo un admin del equipo puede cambiar la línea temporal.' };
          if (p.granularity != null && !GRANULARITIES.some(([k]) => k === p.granularity)) {
            return { success: false, error: 'Granularidad inválida: "' + p.granularity + '". Válidas: ' + GRANULARITIES.map(([k]) => k).join(', ') + '.' };
          }
          return regenerateTimeline(
            p.granularity != null ? p.granularity : model.granularity,
            p.periodsCount != null ? p.periodsCount : model.periodsCount,
            p.startDate != null ? p.startDate : model.timelineStartDate,
          );
        }
        case 'SET_LABELS': {
          const patch = {};
          if (s(p.planLabel).trim()) patch.planLabel = s(p.planLabel).trim();
          if (s(p.taskLabel).trim()) patch.taskLabel = s(p.taskLabel).trim();
          if (!Object.keys(patch).length) return { success: false, error: 'Indica planLabel y/o taskLabel.' };
          setModel(patch);
          persistConfig();
          return { success: true, message: 'Etiquetas actualizadas.' };
        }
        case 'RENAME_DOCUMENT': return await renameDocument(p.name);
        default:
          return {
            success: false,
            error: 'Acción desconocida: ' + action.type + '. Acciones válidas en Planificación: '
              + TOOLS.map((t) => t.name).join(', ') + '.',
          };
      }
    },
  }) : null;

  // ── Filtros y orden ─────────────────────────────────────────────────────
  const SORT_COLUMNS = { name: 'Tarea', responsible: 'Responsable', status: 'Estado', progress: 'Avance', start: 'Inicio', end: 'Fin' };
  function resolveSortKey(raw) {
    const needle = canon(raw);
    if (SORT_COLUMNS[raw]) return raw;
    const byName = Object.keys(SORT_COLUMNS).find((k) => canon(SORT_COLUMNS[k]) === needle || k === needle);
    if (byName) return byName;
    if (/^p:\d+$/.test(raw)) return raw;
    if (/^\d+$/.test(raw) && model.periods[Number(raw)]) return 'p:' + Number(raw);
    const idx = model.periods.findIndex((p) => p.id === raw || canon(p.shortName) === needle || canon(p.name) === needle);
    return idx >= 0 ? 'p:' + idx : '';
  }
  function sortValue(t, key, periods) {
    if (key.startsWith('p:')) {
      const i = Number(key.slice(2));
      return (t.periods || [])[i] ? 0 : 1;   // primero las que cubren ese período
    }
    const d = taskDates(t, periods);
    switch (key) {
      case 'name': return canon(t.name);
      case 'responsible': return canon(t.responsibleName);
      case 'status': return STATUS.findIndex(([k]) => k === t.status);
      case 'progress': return Number(t.progress) || 0;
      case 'start': return d.start;
      case 'end': return d.end;
      default: return '';
    }
  }
  const isEmptyValue = (v) => v === '' || v == null || v === -1;
  function sortTasks(tasks, sort, periods) {
    if (!sort) return tasks;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return tasks
      .map((t, i) => ({ t, i }))
      .sort((a, b) => {
        const va = sortValue(a.t, sort.key, periods);
        const vb = sortValue(b.t, sort.key, periods);
        const ea = isEmptyValue(va), eb = isEmptyValue(vb);
        if (ea !== eb) return ea ? 1 : -1;             // los vacíos, siempre al final
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return a.i - b.i;                               // estable
      })
      .map((x) => x.t);
  }
  function filterTasks(tasks, m) {
    const pIdx = m.filterPeriod ? m.periods.findIndex((p) => p.id === m.filterPeriod) : -1;
    return tasks.filter((t) => {
      if (m.filterOwner && t.responsibleId !== m.filterOwner) return false;
      if (pIdx >= 0 && !(t.periods || [])[pIdx]) return false;
      return true;
    });
  }
  const viewTasks = (g, m) => sortTasks(filterTasks(g.tasks || [], m), m.sort, m.periods);

  // ── UI ──────────────────────────────────────────────────────────────────
  function ProgressCells({ value, onChange }) {
    return h('span', { className: 'kg-progress' },
      [25, 50, 75, 100].map((level) => h('span', {
        key: level,
        className: 'kg-progress-cell' + (value >= level ? (value >= 100 ? ' kg-progress-done' : ' kg-progress-on') : ''),
        title: level + '%',
        onClick: () => onChange(level === value ? level - 25 : level),
      })),
      h('span', { className: 'kg-progress-num' }, (value || 0) + '%'),
    );
  }

  function SortTh({ label, sortKey, m, className, title }) {
    const active = m.sort && m.sort.key === sortKey;
    return h('th', {
      className: (className || '') + ' kg-th-sort' + (active ? ' kg-th-sorted' : ''),
      title: title || ('Ordenar por ' + label),
      onClick: () => {
        if (!active) setModel({ sort: { key: sortKey, dir: 'asc' } });
        else if (m.sort.dir === 'asc') setModel({ sort: { key: sortKey, dir: 'desc' } });
        else setModel({ sort: null });
      },
    }, label, h('span', { className: 'kg-caret' }, active ? (m.sort.dir === 'asc' ? '▲' : '▼') : ''));
  }

  function Component() {
    const [m, setM] = useState({ ...model });
    useEffect(() => { listeners.add(setM); return () => listeners.delete(setM); }, []);
    useEffect(() => { load(); return startSync(); }, []);

    const [editTask, setEditTask] = useState(null); // {ganttId, orig, task}
    const [editPlan, setEditPlan] = useState(null); // {id, name, shortName, objective, ownerId, color}
    const [settings, setSettings] = useState(null); // borrador de ⚙ (no lo pisa el sync)
    const [newPlan, setNewPlan] = useState(null);

    const active = m.gantts.find((g) => g.id === m.tab) || null;
    const enabledTypes = useMemo(
      () => (m.entityTypes || []).filter((t) => (m.enabledEntityTypeIds || []).includes(t.id)),
      [m.entityTypes, m.enabledEntityTypeIds],
    );
    const enabledEntities = useMemo(() => {
      const ids = new Set(enabledTypes.map((t) => t.id));
      return (m.entities || []).filter((e) => ids.has(e.typeId));
    }, [m.entities, enabledTypes]);
    const todayIdx = useMemo(
      () => m.periods.findIndex((p) => s(p.startDate) <= today() && today() <= s(p.endDate)),
      [m.periods],
    );

    if (!m.loaded) return h('div', { className: 'kimos-gantt' }, h('div', { className: 'kg-empty' }, 'Cargando…'));
    if (m.error) return h('div', { className: 'kimos-gantt' }, h('div', { className: 'kg-empty' }, m.error));

    const filtersOn = !!(m.filterOwner || m.filterPeriod);
    const syncLabel = m.sync.offline ? 'Sin conexión — reintentando'
      : m.sync.saving ? 'Guardando…'
      : 'En vivo · sincronizado ' + (m.sync.at ? m.sync.at.slice(11, 19) : '—');

    const openTaskEditor = (g, t) => setEditTask({
      ganttId: g.id, orig: JSON.parse(JSON.stringify(t)), task: JSON.parse(JSON.stringify(t)),
    });

    return h('div', { className: 'kimos-gantt' },
      // Pestañas de planes
      h('div', { className: 'kg-tabs' },
        h('button', { className: 'kg-tab' + (m.tab === '' ? ' kg-tab-active' : ''), onClick: () => setModel({ tab: '' }) }, 'Resumen'),
        m.gantts.map((g) => h('button', {
          key: g.id,
          className: 'kg-tab' + (m.tab === g.id ? ' kg-tab-active' : ''),
          style: m.tab === g.id ? { borderBottomColor: g.color } : undefined,
          onClick: () => setModel({ tab: g.id }),
        }, g.shortName || g.name)),
        h('button', { className: 'kg-tab kg-tab-new', onClick: () => setNewPlan({ name: '', objective: '', ownerId: '' }) },
          '+ ' + m.planLabel),
        h('span', { className: 'kg-spacer' }),
        h('span', {
          className: 'kg-live' + (m.sync.offline ? ' kg-live-off' : m.sync.saving ? ' kg-live-busy' : ''),
          title: syncLabel + '. Varias personas pueden editar a la vez: los cambios se fusionan tarea a tarea.',
        }, h('span', { className: 'kg-live-dot' }), m.sync.offline ? 'Sin conexión' : m.sync.saving ? 'Guardando' : 'En vivo'),
        m.isAdmin && h('button', {
          className: 'kg-btn', title: 'Ajustes de la línea temporal',
          onClick: () => setSettings(settings ? null : {
            granularity: m.granularity, periodsCount: m.periodsCount, timelineStartDate: m.timelineStartDate,
            planLabel: m.planLabel, taskLabel: m.taskLabel, enabledEntityTypeIds: [...(m.enabledEntityTypeIds || [])],
          }),
        }, '⚙'),
      ),

      // Ajustes (admins) — sobre un borrador, para que el sync no lo pise
      settings && m.isAdmin && h('div', { className: 'kg-settings' },
        h('label', { className: 'kg-label' }, 'Granularidad',
          h('select', { className: 'kg-input', value: settings.granularity,
            onChange: (e) => setSettings({ ...settings, granularity: e.target.value }) },
            GRANULARITIES.map(([k, l]) => h('option', { key: k, value: k }, l)))),
        h('label', { className: 'kg-label' }, 'Períodos',
          h('input', { className: 'kg-input', type: 'number', min: 1, max: 90, value: settings.periodsCount,
            onChange: (e) => setSettings({ ...settings, periodsCount: Number(e.target.value) || 8 }) })),
        h('label', { className: 'kg-label' }, 'Inicio',
          h('input', { className: 'kg-input', type: 'date', value: settings.timelineStartDate,
            onChange: (e) => setSettings({ ...settings, timelineStartDate: e.target.value }) })),
        h('label', { className: 'kg-label' }, 'Nombre de plan',
          h('input', { className: 'kg-input', value: settings.planLabel,
            onChange: (e) => setSettings({ ...settings, planLabel: e.target.value }) })),
        h('label', { className: 'kg-label' }, 'Nombre de tarea',
          h('input', { className: 'kg-input', value: settings.taskLabel,
            onChange: (e) => setSettings({ ...settings, taskLabel: e.target.value }) })),
        (m.entityTypes || []).length > 0 && h('div', { className: 'kg-label' }, 'Atributos visibles',
          h('div', { className: 'kg-entpick' }, m.entityTypes.map((t) => {
            const on = settings.enabledEntityTypeIds.includes(t.id);
            return h('button', { key: t.id, type: 'button', className: 'kg-chip kg-chip-btn' + (on ? ' kg-chip-active' : ''),
              onClick: () => setSettings({
                ...settings,
                enabledEntityTypeIds: on
                  ? settings.enabledEntityTypeIds.filter((x) => x !== t.id)
                  : [...settings.enabledEntityTypeIds, t.id],
              }) }, t.name);
          }))),
        h('button', { className: 'kg-btn kg-btn-primary', onClick: () => {
          setModel({
            planLabel: s(settings.planLabel).trim() || 'Plan',
            taskLabel: s(settings.taskLabel).trim() || 'Tarea',
            enabledEntityTypeIds: settings.enabledEntityTypeIds,
          });
          regenerateTimeline(settings.granularity, settings.periodsCount, settings.timelineStartDate);
          setSettings(null);
        } }, 'Aplicar y regenerar'),
        h('button', { className: 'kg-btn', onClick: () => setSettings(null) }, 'Cancelar'),
      ),

      // Contenido
      m.tab === '' || !active
        ? // Resumen
          h('div', { className: 'kg-dash' },
            m.gantts.length === 0 && h('div', { className: 'kg-empty' },
              h('div', { className: 'kg-empty-icon' }, '📊'),
              h('p', null, 'Aún no hay ' + m.planLabel.toLowerCase() + 'es'),
              h('button', { className: 'kg-btn kg-btn-primary', onClick: () => setNewPlan({ name: '', objective: '', ownerId: '' }) },
                'Crear ' + m.planLabel.toLowerCase())),
            m.gantts.map((g) => {
              const tasks = g.tasks || [];
              const byStatus = {};
              for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
              const prog = ganttProgress(g);
              const late = tasks.filter((t) => isOverdue(t, m.periods)).length;
              return h('div', { key: g.id, className: 'kg-card', onClick: () => setModel({ tab: g.id }) },
                h('div', { className: 'kg-card-head' },
                  h('span', { className: 'kg-dot', style: { background: g.color } }),
                  h('span', { className: 'kg-card-name' }, g.name),
                  h('span', { className: 'kg-card-prog' }, prog + '%'),
                ),
                s(g.objective) && h('div', { className: 'kg-card-obj' }, g.objective),
                h('div', { className: 'kg-bar' }, h('div', { className: 'kg-bar-fill', style: { width: prog + '%', background: g.color } })),
                h('div', { className: 'kg-card-meta' },
                  h('span', null, tasks.length + ' tareas'),
                  STATUS.map(([k, l]) => byStatus[k] ? h('span', { key: k, className: 'kg-chip ' + STATUS_CLASS[k] }, byStatus[k] + ' ' + l.toLowerCase()) : null),
                  late > 0 && h('span', { className: 'kg-chip kg-st-blocked' }, late + ' atrasada' + (late > 1 ? 's' : '')),
                  s(g.owner) && h('span', { className: 'kg-owner' }, g.owner),
                ),
              );
            }),
          )
        : // Vista del plan
          h('div', { className: 'kg-planview' },
            h('div', { className: 'kg-plan-head' },
              h('span', { className: 'kg-dot', style: { background: active.color } }),
              h('div', { className: 'kg-plan-titles' },
                h('div', { className: 'kg-plan-name' }, active.name),
                h('div', { className: 'kg-plan-obj' + (s(active.objective) ? '' : ' kg-plan-obj-empty') },
                  s(active.objective) || 'Sin descripción — usa ✎ para añadirla'),
              ),
              h('span', { className: 'kg-card-prog' }, ganttProgress(active) + '%'),
              h('button', { className: 'kg-mini', title: 'Editar plan (nombre, descripción, responsable, color)',
                onClick: () => setEditPlan({
                  id: active.id, name: active.name, shortName: s(active.shortName),
                  objective: s(active.objective), ownerId: s(active.ownerId), color: s(active.color),
                }) }, '✎'),
              h('button', { className: 'kg-mini kg-danger', title: 'Eliminar plan', onClick: () => {
                if (window.confirm('¿Eliminar "' + active.name + '" y sus ' + (active.tasks || []).length + ' tarea(s)?')) {
                  deleteGantt(active.id);
                }
              } }, '🗑'),
            ),

            // Filtros
            h('div', { className: 'kg-filters' },
              h('select', {
                className: 'kg-select', value: m.filterOwner, title: 'Filtrar por responsable',
                onChange: (e) => setModel({ filterOwner: e.target.value }),
              },
                h('option', { value: '' }, 'Responsable: todos'),
                m.members.map((x) => h('option', { key: x.id, value: x.id }, x.name))),
              h('select', {
                className: 'kg-select', value: m.filterPeriod, title: 'Filtrar por período',
                onChange: (e) => setModel({ filterPeriod: e.target.value }),
              },
                h('option', { value: '' }, 'Período: todos'),
                m.periods.map((p) => h('option', { key: p.id, value: p.id },
                  p.shortName + ' · ' + dmy(p.startDate) + '–' + dmy(p.endDate)))),
              m.sort && h('span', { className: 'kg-chip' },
                'Orden: ' + (SORT_COLUMNS[m.sort.key] || ('período ' + (Number(m.sort.key.slice(2)) + 1)))
                + (m.sort.dir === 'asc' ? ' ↑' : ' ↓')),
              (filtersOn || m.sort) && h('button', {
                className: 'kg-mini', title: 'Limpiar filtros y orden',
                onClick: () => setModel({ filterOwner: '', filterPeriod: '', sort: null }),
              }, '✕ limpiar'),
              h('span', { className: 'kg-spacer' }),
              h('span', { className: 'kg-muted' },
                filtersOn
                  ? viewTasks(active, m).length + ' de ' + (active.tasks || []).length + ' tareas'
                  : (active.tasks || []).length + ' tareas'),
            ),

            h('div', { className: 'kg-timeline-wrap' },
              h('table', { className: 'kg-timeline' },
                h('thead', null, h('tr', null,
                  h(SortTh, { label: m.taskLabel, sortKey: 'name', m, className: 'kg-th-task' }),
                  h(SortTh, { label: 'Responsable', sortKey: 'responsible', m }),
                  h(SortTh, { label: 'Estado', sortKey: 'status', m }),
                  h(SortTh, { label: 'Avance', sortKey: 'progress', m }),
                  h(SortTh, { label: 'Inicio', sortKey: 'start', m }),
                  h(SortTh, { label: 'Fin', sortKey: 'end', m }),
                  m.periods.map((p, i) => h(SortTh, {
                    key: p.id, label: p.shortName, sortKey: 'p:' + i, m,
                    className: 'kg-th-period' + (i === todayIdx ? ' kg-th-today' : ''),
                    title: p.startDate + ' → ' + p.endDate + ' · clic para ordenar por este período',
                  })),
                  h('th', null, ''),
                )),
                h('tbody', null,
                  viewTasks(active, m).map((t) => {
                    const d = taskDates(t, m.periods);
                    const range = rangeOfPeriods(t.periods);
                    const span = range ? (range.to - range.from + 1) : 0;
                    const filled = range ? Math.round(span * (Number(t.progress) || 0) / 100) : 0;
                    const outside = !!(d.start && !range);
                    return h('tr', { key: t.id, className: t.status === 'blocked' ? 'kg-row-blocked' : '' },
                      h('td', { className: 'kg-td-task' },
                        h('button', { className: 'kg-taskname', title: 'Editar tarea',
                          onClick: () => openTaskEditor(active, t) }, t.name),
                        isOverdue(t, m.periods) && h('span', { className: 'kg-chip kg-st-blocked kg-late', title: 'Fin ' + d.end }, 'atrasada'),
                        outside && h('span', { className: 'kg-chip kg-late', title: d.start + ' → ' + d.end }, 'fuera del rango'),
                      ),
                      h('td', null,
                        h('select', { className: 'kg-input kg-input-sm', value: t.responsibleId || '',
                          onChange: (e) => {
                            const member = m.members.find((x) => x.id === e.target.value);
                            updateTask(active.id, t.id, { responsibleId: member ? member.id : '', responsibleName: member ? member.name : '' });
                          } },
                          h('option', { value: '' }, '—'),
                          m.members.map((x) => h('option', { key: x.id, value: x.id }, x.name)))),
                      h('td', null,
                        h('select', { className: 'kg-input kg-input-sm ' + (STATUS_CLASS[t.status] || ''), value: t.status,
                          onChange: (e) => updateTask(active.id, t.id, { status: e.target.value }) },
                          STATUS.map(([k, l]) => h('option', { key: k, value: k }, l)))),
                      h('td', null, h(ProgressCells, { value: t.progress || 0,
                        onChange: (v) => updateTask(active.id, t.id, { progress: v }) })),
                      h('td', null, h('input', {
                        className: 'kg-input kg-input-date', type: 'date', value: isoDate(t.taskStartDate) || d.start,
                        title: 'Inicio — define dónde empieza la barra',
                        onChange: (e) => updateTask(active.id, t.id, {
                          taskStartDate: e.target.value,
                          taskEndDate: isoDate(t.taskEndDate) || d.end || e.target.value,
                        }),
                      })),
                      h('td', null, h('input', {
                        className: 'kg-input kg-input-date', type: 'date', value: isoDate(t.taskEndDate) || d.end,
                        title: 'Fin — define dónde termina la barra',
                        onChange: (e) => updateTask(active.id, t.id, {
                          taskStartDate: isoDate(t.taskStartDate) || d.start || e.target.value,
                          taskEndDate: e.target.value,
                        }),
                      })),
                      m.periods.map((p, i) => {
                        const on = !!(t.periods || [])[i];
                        const isStart = !!range && i === range.from;
                        const isEnd = !!range && i === range.to;
                        const done = !!range && i < range.from + filled;
                        return h('td', {
                          key: p.id,
                          className: 'kg-cell' + (i === todayIdx ? ' kg-cell-today' : ''),
                          title: on
                            ? (d.start + ' → ' + d.end + ' · clic para ajustar el rango')
                            : (p.shortName + ': ' + p.startDate + ' → ' + p.endDate + ' · clic para planificar aquí'),
                          onClick: () => toggleCell(active, t, i),
                        }, on && h('span', {
                          className: 'kg-seg' + (done ? ' kg-seg-done' : '') + (isStart ? ' kg-seg-start' : '') + (isEnd ? ' kg-seg-end' : '')
                            + (t.status === 'blocked' ? ' kg-seg-blocked' : ''),
                          style: { background: active.color },
                        }));
                      }),
                      h('td', null, h('button', { className: 'kg-mini kg-danger', title: 'Eliminar tarea',
                        onClick: () => { if (window.confirm('¿Eliminar "' + t.name + '"?')) deleteTask(active.id, t.id); } }, '🗑')),
                    );
                  }),
                  h('tr', null, h('td', { colSpan: 7 + m.periods.length, className: 'kg-td-add' },
                    h('button', { className: 'kg-btn', onClick: () => {
                      const name = window.prompt('Nombre de la ' + m.taskLabel.toLowerCase() + ':');
                      if (name && name.trim()) addTask(active.id, { name: name.trim() });
                    } }, '+ ' + m.taskLabel))),
                ),
              ),
            ),
          ),

      // Modal: nuevo plan
      newPlan && h('div', { className: 'kg-overlay' },
        h('button', { className: 'kg-overlay-bg', onClick: () => setNewPlan(null), 'aria-label': 'Cerrar' }),
        h('div', { className: 'kg-panel' },
          h('div', { className: 'kg-panel-head' },
            h('span', { className: 'kg-panel-title' }, 'Nuevo ' + m.planLabel.toLowerCase()),
            h('button', { className: 'kg-mini', onClick: () => setNewPlan(null) }, '✕')),
          h('div', { className: 'kg-panel-body' },
            h('label', { className: 'kg-label' }, 'Nombre',
              h('input', { className: 'kg-input', autoFocus: true, value: newPlan.name,
                onChange: (e) => setNewPlan({ ...newPlan, name: e.target.value }) })),
            h('label', { className: 'kg-label' }, 'Descripción / objetivo',
              h('textarea', { className: 'kg-input', rows: 3, value: newPlan.objective,
                onChange: (e) => setNewPlan({ ...newPlan, objective: e.target.value }) })),
            h('label', { className: 'kg-label' }, 'Responsable',
              h('select', { className: 'kg-input', value: newPlan.ownerId,
                onChange: (e) => setNewPlan({ ...newPlan, ownerId: e.target.value }) },
                h('option', { value: '' }, 'Sin asignar'),
                m.members.map((x) => h('option', { key: x.id, value: x.id }, x.name)))),
          ),
          h('div', { className: 'kg-panel-foot' },
            h('button', { className: 'kg-btn', onClick: () => setNewPlan(null) }, 'Cancelar'),
            h('button', { className: 'kg-btn kg-btn-primary', onClick: async () => {
              if (!newPlan.name.trim()) return;
              const res = await addGantt({ name: newPlan.name, objective: newPlan.objective, ownerId: newPlan.ownerId });
              setNewPlan(null);
              if (res.ganttId) setModel({ tab: res.ganttId });
            } }, 'Crear')),
        ),
      ),

      // Panel: editar plan (nombre, descripción, responsable, color)
      editPlan && h('div', { className: 'kg-overlay' },
        h('button', { className: 'kg-overlay-bg', onClick: () => setEditPlan(null), 'aria-label': 'Cerrar' }),
        h('div', { className: 'kg-panel' },
          h('div', { className: 'kg-panel-head' },
            h('span', { className: 'kg-panel-title' }, 'Editar ' + m.planLabel.toLowerCase()),
            h('button', { className: 'kg-mini', onClick: () => setEditPlan(null) }, '✕')),
          h('div', { className: 'kg-panel-body' },
            h('label', { className: 'kg-label' }, 'Nombre',
              h('input', { className: 'kg-input', autoFocus: true, value: editPlan.name,
                onChange: (e) => setEditPlan({ ...editPlan, name: e.target.value }) })),
            h('label', { className: 'kg-label' }, 'Sigla (pestaña)',
              h('input', { className: 'kg-input', maxLength: 24, value: editPlan.shortName,
                onChange: (e) => setEditPlan({ ...editPlan, shortName: e.target.value }) })),
            h('label', { className: 'kg-label' }, 'Descripción / objetivo',
              h('textarea', { className: 'kg-input', rows: 4, value: editPlan.objective,
                onChange: (e) => setEditPlan({ ...editPlan, objective: e.target.value }) })),
            h('div', { className: 'kg-row' },
              h('label', { className: 'kg-label' }, 'Responsable',
                h('select', { className: 'kg-input', value: editPlan.ownerId,
                  onChange: (e) => setEditPlan({ ...editPlan, ownerId: e.target.value }) },
                  h('option', { value: '' }, 'Sin asignar'),
                  m.members.map((x) => h('option', { key: x.id, value: x.id }, x.name)))),
              h('label', { className: 'kg-label' }, 'Color',
                h('input', { className: 'kg-input', type: 'color', value: /^#/.test(editPlan.color) ? editPlan.color : '#3b82f6',
                  onChange: (e) => setEditPlan({ ...editPlan, color: e.target.value }) }))),
          ),
          h('div', { className: 'kg-panel-foot' },
            h('button', { className: 'kg-btn', onClick: () => setEditPlan(null) }, 'Cancelar'),
            h('button', { className: 'kg-btn kg-btn-primary', onClick: () => {
              updateGantt(editPlan.id, {
                name: editPlan.name, shortName: editPlan.shortName, objective: editPlan.objective,
                ownerId: editPlan.ownerId, color: editPlan.color,
              });
              setEditPlan(null);
            } }, 'Guardar')),
        ),
      ),

      // Panel: editar tarea
      editTask && h('div', { className: 'kg-overlay' },
        h('button', { className: 'kg-overlay-bg', onClick: () => setEditTask(null), 'aria-label': 'Cerrar' }),
        h('div', { className: 'kg-panel' },
          h('div', { className: 'kg-panel-head' },
            h('span', { className: 'kg-panel-title' }, 'Editar ' + m.taskLabel.toLowerCase()),
            h('button', { className: 'kg-mini', onClick: () => setEditTask(null) }, '✕')),
          h('div', { className: 'kg-panel-body' },
            h('label', { className: 'kg-label' }, 'Nombre',
              h('input', { className: 'kg-input', value: editTask.task.name,
                onChange: (e) => setEditTask({ ...editTask, task: { ...editTask.task, name: e.target.value } }) })),
            h('div', { className: 'kg-row' },
              h('label', { className: 'kg-label' }, 'Responsable',
                h('select', { className: 'kg-input', value: s(editTask.task.responsibleId),
                  onChange: (e) => {
                    const member = m.members.find((x) => x.id === e.target.value);
                    setEditTask({ ...editTask, task: { ...editTask.task,
                      responsibleId: member ? member.id : '', responsibleName: member ? member.name : '' } });
                  } },
                  h('option', { value: '' }, 'Sin asignar'),
                  m.members.map((x) => h('option', { key: x.id, value: x.id }, x.name)))),
              h('label', { className: 'kg-label' }, 'Estado',
                h('select', { className: 'kg-input', value: editTask.task.status,
                  onChange: (e) => setEditTask({ ...editTask, task: { ...editTask.task, status: e.target.value } }) },
                  STATUS.map(([k, l]) => h('option', { key: k, value: k }, l))))),
            h('div', { className: 'kg-row' },
              h('label', { className: 'kg-label' }, 'Inicio',
                h('input', { className: 'kg-input', type: 'date', value: s(editTask.task.taskStartDate),
                  onChange: (e) => setEditTask({ ...editTask, task: { ...editTask.task, taskStartDate: e.target.value } }) })),
              h('label', { className: 'kg-label' }, 'Fin',
                h('input', { className: 'kg-input', type: 'date', value: s(editTask.task.taskEndDate),
                  onChange: (e) => setEditTask({ ...editTask, task: { ...editTask.task, taskEndDate: e.target.value } }) }))),
            h('div', { className: 'kg-hint' }, 'Las fechas determinan qué recuadros de la línea temporal se pintan.'),
            h('label', { className: 'kg-label' }, 'Notas',
              h('textarea', { className: 'kg-input', rows: 3, value: s(editTask.task.notes),
                onChange: (e) => setEditTask({ ...editTask, task: { ...editTask.task, notes: e.target.value } }) })),
            enabledTypes.map((type) => {
              const typeEntities = enabledEntities.filter((e2) => e2.typeId === type.id);
              if (!typeEntities.length) return null;
              return h('div', { key: type.id, className: 'kg-label' }, type.name,
                h('div', { className: 'kg-entpick' }, typeEntities.map((ent) => {
                  const on = (editTask.task.entityIds || []).includes(ent.id);
                  return h('button', { key: ent.id, type: 'button',
                    className: 'kg-chip kg-chip-btn' + (on ? ' kg-chip-active' : ''),
                    style: { borderColor: ent.color },
                    onClick: () => {
                      const cur = new Set(editTask.task.entityIds || []);
                      if (on) cur.delete(ent.id); else cur.add(ent.id);
                      setEditTask({ ...editTask, task: { ...editTask.task, entityIds: Array.from(cur) } });
                    } }, ent.name);
                })));
            }),
          ),
          h('div', { className: 'kg-panel-foot' },
            h('button', { className: 'kg-btn', onClick: () => setEditTask(null) }, 'Cancelar'),
            h('button', { className: 'kg-btn kg-btn-primary', onClick: () => {
              // Solo los campos que realmente tocaste: si otra persona editó
              // otro campo de la misma tarea mientras el panel estaba abierto,
              // su cambio no se pierde.
              const patch = {};
              for (const k of Object.keys(editTask.task)) {
                if (JSON.stringify(editTask.task[k]) !== JSON.stringify(editTask.orig[k])) patch[k] = editTask.task[k];
              }
              if (Object.keys(patch).length) updateTask(editTask.ganttId, editTask.task.id, patch);
              setEditTask(null);
            } }, 'Guardar')),
        ),
      ),
    );
  }

  return {
    Component,
    unmount() {
      if (offAgent) offAgent();
      flushPending();
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      syncSubs = 0;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
      listeners.clear();
    },
  };
}
