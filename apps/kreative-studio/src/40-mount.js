
// ═══════════════════════════════════════════════════════════════════════════
// ADAPTADORES + UI · mount(shell)
// Todo lo que toca el mundo exterior (React, red, almacenamiento, agente)
// vive aquí dentro. El dominio de arriba no sabe que esto existe.
// ═══════════════════════════════════════════════════════════════════════════

export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;
  const useRef = React.useRef || ((v) => ({ current: v }));
  const useMemo = React.useMemo || ((fn) => fn());

  const instanceId = shell.app && shell.app.instanceId;
  const teamId = shell.app && shell.app.teamId;

  function apiBase() {
    try {
      const raw = typeof shell.assetUrl === 'function' ? shell.assetUrl('x').split('/api/apps/')[0] : '';
      return new URL(raw || '/', globalThis.window ? window.location.href : 'http://localhost/').toString().replace(/\/$/, '');
    } catch (e) { return globalThis.window ? window.location.origin : ''; }
  }
  const API = apiBase();

  const notify = (level, text) => {
    try { if (typeof shell.notify === 'function') shell.notify({ level, text: s(text) }); } catch (e) { /* host sin toasts */ }
  };

  // ── Estado (uno por ventana: vive en el closure, nunca en el módulo) ────
  let model = migrate(emptyCampaign());
  let assets = [];      // items kind:'asset'  (AGENTE 11)
  let ledger = [];      // items kind:'cost'   (AGENTE 12)
  let ui = { view: 'dashboard', busy: false, sceneSel: null, formatSel: null, promptCap: 'video',
    platformSel: null, assetFilter: 'all', flowSel: null, ready: false, error: '',
    worldTab: 'areas', worldArea: null, worldStaff: null };

  // ── Tema ────────────────────────────────────────────────────────────────
  // El modo Vivo depende de la hora, así que se guarda la hora actual en el
  // estado y un temporizador la refresca: sin eso, la ventana se quedaría con
  // la luz del momento en que se abrió.
  let hourNow = new Date().getHours();
  const currentTheme = () => resolveTheme(obj(model.settings).theme, hourNow);
  const clockTimer = setInterval(() => {
    const h0 = new Date().getHours();
    if (h0 === hourNow) return;
    hourNow = h0;
    if (currentTheme().live) emit();      // solo repinta si de verdad afecta
  }, 60000);

  const listeners = new Set();
  const emit = () => { listeners.forEach((l) => { try { l({}); } catch (e) { /* componente desmontado */ } }); };

  let saveTimer = null;
  function scheduleSave() {
    if (typeof shell.saveData !== 'function') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      model.updatedAt = nowIso();
      Promise.resolve(shell.saveData({ campaign: model })).catch((e) => notify('error', 'No se pudo guardar: ' + ((e && e.message) || 'error')));
    }, 700);
  }

  /** Mutación central: UI y agente pasan siempre por aquí. */
  function commit(next, opts) {
    const o = obj(opts);
    if (next) model = next;
    if (!o.noSave) scheduleSave();
    emit();
    if (typeof shell.window === 'object' && shell.window && typeof shell.window.setTitle === 'function') {
      try { shell.window.setTitle('Kreative Studio — ' + s(model.title)); } catch (e) { /* opcional */ }
    }
  }
  function setUi(patch) { ui = Object.assign({}, ui, obj(patch)); emit(); }

  // ── Directorio de usuarios de KIMOS ────────────────────────────────────
  // El responsable de un departamento NO es texto libre: es un usuario de la
  // organización. La lista la sirve el host en `/api/identity/actors`, la
  // misma que usan Kanban y Gantt para asignar trabajo, con el RBAC del
  // usuario como techo. Solo se guardan en el documento el id y el nombre;
  // el directorio no se persiste.
  let directory = { users: [], loaded: false, error: '' };

  async function loadDirectory() {
    if (typeof shell.authFetch !== 'function') {
      directory = { users: [], loaded: true,
        error: 'Este host no expone el directorio de usuarios, así que no se puede elegir responsable.' };
      return;
    }
    try {
      const res = await shell.authFetch(API + '/api/identity/actors', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const users = arr(obj(data).actors)
        .filter((a) => obj(a).active !== false && s(obj(a).kind || obj(a).type) !== 'agent')
        .map((a) => ({ id: s(a.id), name: s(a.displayName || a.name || a.email || a.id), email: s(a.email) }))
        .filter((a) => a.id);
      directory = { users, loaded: true,
        error: users.length ? '' : 'El directorio no devolvió ningún usuario.' };
    } catch (e) {
      directory = { users: [], loaded: true,
        error: 'No se pudo leer el directorio de usuarios: ' + ((e && e.message) || 'error') };
    }
    if (!cancelled) emit();
  }

  /** Busca un usuario por id, nombre o correo. Para la UI y para el agente. */
  function findUser(needle) {
    const q = norm(needle);
    if (!q) return null;
    const list = arr(directory.users);
    return list.find((u) => u.id === s(needle))
      || list.find((u) => norm(u.email) === q)
      || list.find((u) => norm(u.name) === q)
      || list.find((u) => norm(u.name).indexOf(q) >= 0)
      || null;
  }

  // ── Puerto de persistencia de assets y costes (shell.items) ────────────
  const hasItems = shell.items && typeof shell.items.list === 'function';

  async function loadItems() {
    if (!hasItems) return;
    try {
      const list = arr(await shell.items.list());
      // `kind` es el discriminador del item en la instancia; el tipo de medio
      // del asset viaja en `assetKind` para que no se pisen entre sí.
      assets = list.filter((x) => s(x.kind) === 'asset')
        .map((x) => normalizeAsset(Object.assign({}, x, { kind: s(x.assetKind) }), model));
      ledger = list.filter((x) => s(x.kind) === 'cost');
    } catch (e) { /* sin permiso o host reducido: la app sigue funcionando */ }
  }

  async function saveAsset(raw) {
    const a = normalizeAsset(raw, model);
    const item = Object.assign({}, a, { kind: 'asset', assetKind: a.kind });
    if (!hasItems) {
      const i = assets.findIndex((x) => x.id === a.id);
      if (i >= 0) assets[i] = a; else assets.push(a);
      syncJobs(true);
      emit();
      return a;
    }
    const exists = assets.some((x) => x.id === a.id);
    try {
      if (exists) await shell.items.update(a.id, item); else await shell.items.create(item);
      const i = assets.findIndex((x) => x.id === a.id);
      if (i >= 0) assets[i] = a; else assets.push(a);
      syncJobs(true);
      emit();
      return a;
    } catch (e) { throw new Error('No se pudo guardar el asset: ' + ((e && e.message) || 'error')); }
  }

  async function removeAsset(id) {
    const i = assets.findIndex((x) => x.id === s(id));
    if (i < 0) return false;
    if (hasItems) { try { await shell.items.remove(s(id)); } catch (e) { throw new Error('No se pudo borrar: ' + ((e && e.message) || 'error')); } }
    assets.splice(i, 1);
    syncJobs(true);
    emit();
    return true;
  }

  async function addCost(entry) {
    const e = obj(entry);
    const rec = {
      id: newId('cost'), kind: 'cost', at: nowIso(),
      providerId: s(e.providerId), jobId: s(e.jobId) || null, sceneId: s(e.sceneId) || null,
      amountUsd: round(num(e.amountUsd, 0), 4), tokens: num(e.tokens, 0), calls: Math.max(1, num(e.calls, 1)),
      seconds: round(num(e.seconds, 0), 2), images: num(e.images, 0), note: s(e.note),
    };
    if (hasItems) { try { await shell.items.create(rec); } catch (err) { /* se contabiliza en memoria igualmente */ } }
    ledger.push(rec);
    return rec;
  }

  // ── Puerto de catálogo (lectura de ProductLab vía shell.data) ──────────
  // Permiso `data.read:productlab`. El RBAC del usuario es siempre el techo:
  // solo se ven instancias de equipos a los que ya tiene acceso.
  const hasData = shell.data && typeof shell.data.listInstances === 'function';

  async function listCatalogs() {
    if (!hasData) return [];
    try { return arr(await shell.data.listInstances('productlab')); } catch (e) { return []; }
  }

  /** Productos de un catálogo de ProductLab, con su moneda y marca. */
  async function readCatalog(instanceId) {
    if (!hasData || typeof shell.data.listItems !== 'function') return null;
    const items = arr(await shell.data.listItems(s(instanceId)));
    const definition = items.find((x) => s(x.kind) === 'definition') || {};
    const rules = obj(definition.rules);
    return {
      instanceId: s(instanceId),
      currency: s(rules.currency) || 'USD',
      brandName: s(definition.brandName),
      storeName: s(definition.storeName),
      products: items.filter((x) => s(x.kind) === 'producto').map((p) => ({
        id: s(p.id), name: s(p.name), sku: s(p.sku), status: s(p.status),
        price: num(p.price, 0), raw: p,
      })),
    };
  }

  /**
   * Traduce un producto de ProductLab al brief de una campaña.
   * Se mapea lo que de verdad alimenta la creatividad: nombre, precio, fotos
   * y las especificaciones (que son los atributos reales del producto). Los
   * pasos configurables se anotan porque «personalizable» es un argumento de
   * venta, no un detalle técnico.
   */
  function productToBrief(product, catalog) {
    const p = obj(obj(product).raw || product);
    const cat = obj(catalog);
    const photos = uniq(arr(p.galleryImages).map(s).concat([s(obj(p.storeRef).imageUrl)])).filter(Boolean);
    const specs = arr(obj(p.storefront).specs)
      .map((x) => [s(x.label), s(x.value)].filter(Boolean).join(': '))
      .filter((x) => x.length > 2);
    const steps = arr(p.groups).map((g) => s(g.label)).filter(Boolean);
    return {
      productName: s(p.name),
      priceText: num(p.price, 0) ? String(num(p.price, 0)) : '',
      currency: s(cat.currency) || 'USD',
      usp: specs.slice(0, 8).map((x) => punct(x)).join(' '),
      extraNotes: [
        steps.length ? 'Personalizable en: ' + steps.join(', ') + '.' : '',
        s(p.sku) ? 'SKU ' + s(p.sku) + '.' : '',
        obj(p.model3d).enabled ? 'Tiene modelo 3D y vista AR en la tienda.' : '',
        s(cat.brandName) ? 'Marca: ' + s(cat.brandName) + '.' : '',
      ].filter(Boolean).join(' '),
      photos: photos.map((url, i) => ({ id: newId('photo'), url, caption: '', isHero: i === 0 })),
      sourceRef: { app: 'productlab', instanceId: s(cat.instanceId), itemId: s(p.id), sku: s(p.sku), at: nowIso() },
    };
  }

  /** Vuelca el producto en el brief conservando lo que el usuario ya escribió. */
  function applyProductToBrief(product, catalog, opts) {
    const o = obj(opts);
    const mapped = productToBrief(product, catalog);
    if (!s(mapped.productName).trim()) throw new Error('El producto no tiene nombre en ProductLab.');
    patch((m) => {
      const keep = !!o.keepExisting;
      m.brief.productName = mapped.productName;
      if (mapped.priceText && (!keep || !s(m.brief.priceText).trim())) m.brief.priceText = mapped.priceText;
      if (mapped.currency && (!keep || !s(m.brief.currency).trim())) m.brief.currency = mapped.currency;
      if (mapped.usp && (!keep || !s(m.brief.usp).trim())) m.brief.usp = mapped.usp;
      if (mapped.extraNotes && (!keep || !s(m.brief.extraNotes).trim())) m.brief.extraNotes = mapped.extraNotes;
      const known = new Set(arr(m.brief.photos).map((x) => x.url));
      for (const ph of mapped.photos) if (!known.has(ph.url)) m.brief.photos.push(ph);
      if (arr(m.brief.photos).length && !m.brief.photos.some((x) => x.isHero)) m.brief.photos[0].isHero = true;
      m.brief.sourceRef = mapped.sourceRef;
      if (!s(m.title).trim() || m.title === 'Nueva campaña') m.title = mapped.productName;
      logLine(m, 'success', 'Producto «' + mapped.productName + '» importado desde ProductLab ('
        + mapped.photos.length + ' foto(s), ' + (mapped.usp ? 'con' : 'sin') + ' especificaciones).');
    });
    return mapped;
  }

  // ── Puerto de archivos (subida al área pública de KIMOS) ───────────────
  async function uploadFile(file, folder) {
    if (typeof shell.authFetch !== 'function') throw new Error('authFetch no disponible en este host.');
    const maxMB = 64;
    if (file.size > maxMB * 1024 * 1024) throw new Error('máximo ' + maxMB + ' MB');
    const safe = s(file.name || 'archivo').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
    const path = 'imagenes/kreative-studio/' + (s(folder) ? slug(folder) + '/' : '')
      + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-' + safe;
    const fd = new FormData();
    fd.append('path', path);
    fd.append('file', file);
    const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(s(d.detail) || 'HTTP ' + res.status);
    }
    return API + '/api/public/files/' + path;
  }

  /** Descarga a fichero local (exportaciones). */
  function download(filename, content, mime) {
    try {
      const blob = new Blob([s(content)], { type: s(mime) || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = s(filename);
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('success', 'Descargado: ' + filename);
    } catch (e) { notify('error', 'No se pudo descargar: ' + ((e && e.message) || 'error')); }
  }
  function copyText(text, what) {
    const t = s(text);
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(() => notify('success', (s(what) || 'Texto') + ' copiado.'),
          () => notify('warn', 'No se pudo copiar al portapapeles.'));
        return;
      }
    } catch (e) { /* fallback abajo */ }
    notify('info', 'Copia manual:\n' + t.slice(0, 200));
  }

  // ── Operaciones de dominio expuestas a UI y agente ─────────────────────
  /**
   * Reconcilia el estado de los trabajos con los assets ya registrados. Se
   * llama tras el pipeline y tras cualquier cambio en la Biblioteca: si no,
   * regenerar la producción borraría el progreso real y la lista de
   * pendientes mentiría.
   */
  function syncJobs(silent) {
    if (!model.production) return;
    const before = arr(model.production.jobs).map((j) => j.status + j.id).join('|');
    const next = JSON.parse(JSON.stringify(model));
    reconcileJobs(next, assets);
    const after = arr(next.production.jobs).map((j) => j.status + j.id).join('|');
    if (before !== after) commit(next, silent ? { noSave: false } : undefined);
  }

  function runStages(only, label) {
    const res = runPipeline(model, { only, ledger });
    reconcileJobs(res.campaign, assets);
    commit(res.campaign);
    const errs = res.run.stages.filter((x) => x.status === 'error');
    if (errs.length) notify('error', 'Fallaron ' + errs.length + ' etapa(s): ' + errs.map((x) => x.name).join(', '));
    else notify('success', (s(label) || 'Pipeline') + ' completado en ' + res.run.ms + ' ms.');
    return res.run;
  }

  function generateAll(intentText) {
    setUi({ busy: true });
    try {
      const res = generateCampaign(model, intentText, { ledger });
      reconcileJobs(res.campaign, assets);
      commit(res.campaign);
      const errs = res.run.stages.filter((x) => x.status === 'error');
      if (errs.length) notify('warn', 'Campaña generada con ' + errs.length + ' aviso(s).');
      else notify('success', 'Campaña completa generada en ' + res.run.ms + ' ms.');
      setUi({ busy: false, view: 'dashboard' });
      return res.run;
    } catch (e) {
      setUi({ busy: false });
      notify('error', 'Error al generar: ' + ((e && e.message) || 'desconocido'));
      return null;
    }
  }

  function patch(fn, opts) {
    const next = JSON.parse(JSON.stringify(model));
    fn(next);
    next.updatedAt = nowIso();
    commit(next, opts);
    return next;
  }

  /**
   * Aplica una mutación del mapa de la organización (WorldSkin).
   *
   * Las mutaciones del paquete no lanzan: devuelven `{ world, ok, error }`.
   * Aquí se traduce eso a la interfaz —guardar y avisar, o solo avisar— para
   * que un dato imposible (un área que no cabe, un mapa que se encogería sobre
   * un departamento) no deje el documento a medias.
   */
  function applyWorld(fn, opts) {
    const o = obj(opts);
    let r = null;
    try { r = fn(model.world); } catch (e) { r = { ok: false, error: (e && e.message) || 'error inesperado' }; }
    if (!r || !r.ok) { notify('error', s(r && r.error) || 'No se pudo cambiar el mapa.'); return false; }
    patch((m) => { m.world = r.world; logLine(m, 'info', 'Organización · ' + s(r.message)); });
    if (!o.quiet) notify('success', s(r.message));
    return true;
  }

  /** Vuelve a ejecutar las etapas que dependen de lo que acaba de cambiar. */
  function refreshFrom(stageId) {
    const idx = PIPELINE_ORDER.indexOf(s(stageId));
    if (idx < 0) return;
    const only = PIPELINE_ORDER.slice(idx).filter((id) => {
      const a = agentById(id);
      return a && arr(a.requires).every((k) => model[k] || a.writes === k);
    });
    if (only.length) runStages(only, 'Actualización');
  }

  function createVersion(label) {
    const snapshot = JSON.parse(JSON.stringify(model));
    delete snapshot.versions;
    delete snapshot.log;
    const v = { id: newId('ver'), label: s(label) || ('Versión ' + (arr(model.versions).length + 1)),
      at: nowIso(), summary: summarize(model), snapshot };
    patch((m) => { m.versions = arr(m.versions).concat([v]).slice(-VERSIONS_MAX); logLine(m, 'info', 'Versión guardada: ' + v.label); });
    notify('success', 'Versión guardada: ' + v.label);
    return v;
  }

  function restoreVersion(id) {
    const v = arr(model.versions).find((x) => x.id === s(id));
    if (!v) return false;
    const keepVersions = arr(model.versions);
    const keepLog = arr(model.log);
    const restored = migrate(Object.assign({}, v.snapshot, { versions: keepVersions, log: keepLog }));
    logLine(restored, 'info', 'Restaurada la versión «' + v.label + '».');
    commit(restored);
    notify('success', 'Versión restaurada: ' + v.label);
    return true;
  }

  // ── Carga inicial ──────────────────────────────────────────────────────
  let cancelled = false;
  (async function boot() {
    try {
      const data = typeof shell.loadData === 'function' ? await shell.loadData() : null;
      if (cancelled) return;
      if (data && data.campaign) model = migrate(data.campaign);
      else if (data && data.brief) model = migrate(data);
      await loadItems();
      if (cancelled) return;
      // El directorio no bloquea la apertura: la app sirve sin él, solo no
      // deja elegir responsable hasta que llega.
      loadDirectory();
      reconcileJobs(model, assets);
      // Campaña recién creada: se abre por la Guía. Quien ya tiene trabajo
      // hecho entra directo al Panel, que es lo que espera.
      const virgin = !s(model.brief.productName).trim() && !model.concept && !arr(model.brief.photos).length;
      setUi({ ready: true, view: virgin ? 'guide' : 'dashboard' });
      commit(null, { noSave: true });
    } catch (e) {
      if (!cancelled) { setUi({ ready: true, error: (e && e.message) || 'error de carga' }); }
    }
  })();

  // ── Config (⚙️) y Documentos (🗂️) de AppShell v2 ───────────────────────
  let offConfig = null; let offSerialize = null; let offLoad = null;
  function applySettings(cfg) {
    const c0 = obj(cfg);
    const next = JSON.parse(JSON.stringify(model));
    let touched = false;
    if (isHex(c0.accent)) { next.brand.palette.secondary = s(c0.accent).trim(); touched = true; }
    if (c0.defaultStyle && STYLES.some((x) => x.id === c0.defaultStyle) && !next.concept) { next.styleId = s(c0.defaultStyle); touched = true; }
    if (c0.currency && s(c0.currency).trim()) { next.settings.currency = s(c0.currency).trim().toUpperCase(); touched = true; }
    if (typeof c0.autoSubtitles === 'boolean') { next.settings.subtitles = c0.autoSubtitles; touched = true; }
    if (num(c0.heroDuration, 0) > 0) { next.settings.heroDurationSec = clamp(num(c0.heroDuration, 30), 5, 180); touched = true; }
    if (touched) commit(next);
  }
  try {
    if (shell.config && typeof shell.config.get === 'function') {
      Promise.resolve(shell.config.get()).then((cfg) => { if (!cancelled) applySettings(cfg); }).catch(() => {});
      if (typeof shell.config.onChange === 'function') offConfig = shell.config.onChange(applySettings);
    }
    if (shell.documents) {
      if (typeof shell.documents.onSerialize === 'function') offSerialize = shell.documents.onSerialize(() => ({ campaign: model }));
      if (typeof shell.documents.onLoad === 'function') {
        offLoad = shell.documents.onLoad((doc) => {
          const d = obj(doc);
          if (d.campaign) { model = migrate(d.campaign); commit(null, { noSave: true }); notify('info', 'Documento cargado.'); }
        });
      }
    }
  } catch (e) { /* host AppShell v1: capacidades opcionales ausentes */ }
