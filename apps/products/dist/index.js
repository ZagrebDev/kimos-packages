/**
 * Productos — app oficial instalable (v2.0, bundle real en kimos-packages).
 *
 * Catálogo de productos COMPATIBLE con los datos de la app nativa que
 * reemplaza: items {id,name,sku,price,stock,status,description,imageUrl,
 * variants[],entityIds[],sourceLinks[],syncStatus,extra} y config de la
 * instancia {viewMode,enabledEntityTypeIds,extraFields,integrationBindings,
 * allowedUserIds,dataSources} — el bundle solo toca las claves que gestiona
 * y preserva el resto en cada PUT (merge sobre el config crudo).
 *
 * Sincronización Jumpseller (vía shell.authFetch):
 *  - Pull:   POST /api/app-instances/{id}/items/sync-pull
 *  - Push:   POST /api/app-instances/{id}/items/sync-push {itemIds}
 *            (crea en Jumpseller los productos locales sin sourceLink y
 *             actualiza los enlazados; el backend devuelve syncStatusByItem)
 *  - Import: POST /api/integrations/jumpseller/sync-to-apps
 *
 * v2.1: gestión COMPLETA de opciones y variantes según el API oficial —
 * definiciones de opciones del producto (item.options: nombre, tipo
 * option/addon/custom, recargo addon, orden y valores) que el backend
 * sincroniza con los endpoints dedicados /products/{id}/options.json y
 * .../values.json (crear/actualizar/eliminar), variantes con barcode,
 * precio tachado (compare_at_price) y costo (cost_per_item) propios, poda de
 * variantes eliminadas, y campos de producto brand/barcode/compareAtPrice/
 * costPerItem/weight.
 *
 * Bundle ESM puro sobre el contrato AppShell: globalThis.React, sin JSX,
 * CSS con scope .kimos-products.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo } = React;

  const instanceId = shell.app && shell.app.instanceId;

  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) {
      return window.location.origin;
    }
  }
  const API = apiBase();

  // ── Helpers ───────────────────────────────────────────────────────────────
  const s = (v) => (v == null ? '' : String(v));
  const nowIso = () => new Date().toISOString();
  const norm = (v) => s(v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const newId = (prefix) => prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  const money = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return '—';
    try {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
    } catch (e) { return String(n); }
  };

  const STATUS_LABEL = { active: 'Activo', draft: 'Borrador', inactive: 'Inactivo' };
  const STATUS_CLASS = { active: 'kp-st-active', draft: 'kp-st-draft', inactive: 'kp-st-inactive' };
  const SYNC_LABEL = { synced: '↑ JS', pending: '○ pend.', sync_error: '↑ Error' };
  const SYNC_CLASS = { synced: 'kp-sync-ok', pending: 'kp-sync-warn', sync_error: 'kp-sync-err' };
  const SYNC_TITLE = {
    synced: 'Sincronizado con Jumpseller',
    pending: 'Editado localmente — pendiente de sincronizar',
    sync_error: 'Error al sincronizar con Jumpseller',
  };
  const normStatus = (v) => {
    const x = norm(v);
    return x === 'inactive' || x === 'draft' ? x : 'active';
  };

  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = s(raw.id).trim();
    const name = s(raw.name).trim();
    if (!id || !name) return null;
    let sourceLinks;
    if (Array.isArray(raw.sourceLinks)) {
      sourceLinks = raw.sourceLinks.filter((l) => l && typeof l.integration === 'string' && typeof l.sourceId === 'string');
    } else if (raw.sourceIntegration && raw.sourceId) {
      sourceLinks = [{ integration: s(raw.sourceIntegration), sourceId: s(raw.sourceId) }];
    }
    return {
      id: id,
      name: name,
      sku: raw.sku ? s(raw.sku) : undefined,
      price: typeof raw.price === 'number' ? raw.price : undefined,
      stock: typeof raw.stock === 'number' ? raw.stock : undefined,
      status: normStatus(raw.status),
      description: raw.description ? s(raw.description) : undefined,
      imageUrl: raw.imageUrl ? s(raw.imageUrl) : undefined,
      variants: Array.isArray(raw.variants) ? raw.variants : undefined,
      // Definiciones de opciones del producto (Color, Talla, …) con tipo,
      // precio addon y valores — se gestionan vía los endpoints dedicados
      // de Jumpseller en el push.
      options: Array.isArray(raw.options) ? raw.options : undefined,
      brand: raw.brand ? s(raw.brand) : undefined,
      barcode: raw.barcode ? s(raw.barcode) : undefined,
      compareAtPrice: typeof raw.compareAtPrice === 'number' ? raw.compareAtPrice : undefined,
      costPerItem: typeof raw.costPerItem === 'number' ? raw.costPerItem : undefined,
      weight: typeof raw.weight === 'number' ? raw.weight : undefined,
      entityIds: Array.isArray(raw.entityIds) ? raw.entityIds.map(s).filter(Boolean) : [],
      sourceLinks: sourceLinks,
      syncStatus: raw.syncStatus === 'synced' || raw.syncStatus === 'pending' || raw.syncStatus === 'sync_error' ? raw.syncStatus : undefined,
      createdAt: raw.createdAt ? s(raw.createdAt) : undefined,
      updatedAt: raw.updatedAt ? s(raw.updatedAt) : undefined,
      extra: raw.extra && typeof raw.extra === 'object' ? raw.extra : undefined,
    };
  }

  // ── Modelo (module closure; el Component se suscribe) ────────────────────
  let model = {
    items: [],
    allEntityTypes: [],
    allEntities: [],
    enabledEntityTypeIds: [],
    extraFields: [],
    bindings: [],
    rawConfig: {},
    viewMode: 'table',
    isAdmin: false,
    loaded: false,
    error: null,
    // filtros de vista (no persistidos)
    search: '',
    filterStatus: null,
    filterEntityIds: [],
  };
  const listeners = new Set();
  function setModel(patch) {
    model = Object.assign({}, model, patch);
    listeners.forEach((fn) => { try { fn(model); } catch (e) { /* listener roto */ } });
  }

  function enabledTypes() {
    const ok = new Set(model.enabledEntityTypeIds);
    return model.allEntityTypes.filter((t) => ok.has(t.id));
  }
  function enabledEntities() {
    const okTypes = new Set(enabledTypes().map((t) => t.id));
    return model.allEntities.filter((e) => okTypes.has(e.typeId));
  }
  function hasJsBinding() {
    return model.bindings.some((b) => b && b.integration === 'jumpseller');
  }

  // ── Carga inicial ─────────────────────────────────────────────────────────
  async function load() {
    try {
      const results = await Promise.all([
        shell.items.list(),
        shell.authFetch(API + '/api/app-instances/' + instanceId, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        shell.authFetch(API + '/api/entities').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        shell.authFetch(API + '/api/identity/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const rawItems = results[0] || [];
      const inst = results[1];
      const ent = results[2];
      const me = results[3];

      const config = (inst && inst.config) || {};
      const teamId = (shell.app && shell.app.teamId) || (inst && inst.ownerTeamId) || '';
      const isAdmin = !!me && (me.role === 'superadmin' || (me.team_roles && teamId && me.team_roles[teamId] === 'admin'));

      setModel({
        items: rawItems.map(normalizeItem).filter(Boolean),
        allEntityTypes: (ent && Array.isArray(ent.entityTypes)) ? ent.entityTypes : [],
        allEntities: (ent && Array.isArray(ent.entities)) ? ent.entities : [],
        enabledEntityTypeIds: Array.isArray(config.enabledEntityTypeIds) ? config.enabledEntityTypeIds.map(s).filter(Boolean) : [],
        extraFields: Array.isArray(config.extraFields) ? config.extraFields : [],
        bindings: Array.isArray(config.integrationBindings) ? config.integrationBindings : [],
        rawConfig: config,
        viewMode: config.viewMode === 'grid' ? 'grid' : 'table',
        isAdmin: isAdmin,
        loaded: true,
        error: null,
      });
    } catch (e) {
      setModel({ loaded: true, error: (e && e.message) || 'No se pudo cargar Productos.' });
    }
  }

  async function reloadItems() {
    try {
      const rawItems = await shell.items.list();
      setModel({ items: rawItems.map(normalizeItem).filter(Boolean) });
    } catch (e) { /* mantener estado actual */ }
  }

  // ── Persistencia de config (merge: preserva claves que no gestionamos) ────
  async function persistConfig(patch) {
    const nextConfig = Object.assign({}, model.rawConfig, patch);
    setModel({
      rawConfig: nextConfig,
      viewMode: nextConfig.viewMode === 'grid' ? 'grid' : 'table',
      enabledEntityTypeIds: Array.isArray(nextConfig.enabledEntityTypeIds) ? nextConfig.enabledEntityTypeIds : model.enabledEntityTypeIds,
      extraFields: Array.isArray(nextConfig.extraFields) ? nextConfig.extraFields : model.extraFields,
      bindings: Array.isArray(nextConfig.integrationBindings) ? nextConfig.integrationBindings : model.bindings,
    });
    try {
      const res = await shell.authFetch(API + '/api/app-instances/' + instanceId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextConfig }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar la configuración.' });
    }
  }

  // ── Mutaciones de productos (compartidas UI + agente) ─────────────────────
  function findProduct(ref) {
    const key = s(ref).trim();
    if (!key) return null;
    const byId = model.items.find((i) => i.id === key);
    if (byId) return byId;
    const needle = norm(key);
    return model.items.find((i) => norm(i.name) === needle)
      || model.items.find((i) => norm(i.name).indexOf(needle) !== -1)
      || null;
  }

  async function saveProduct(draft) {
    const validIds = new Set(enabledEntities().map((e) => e.id));
    const linked = Array.isArray(draft.sourceLinks) && draft.sourceLinks.length > 0;
    const item = Object.assign({}, draft, {
      name: s(draft.name).trim(),
      status: normStatus(draft.status),
      entityIds: (draft.entityIds || []).filter((id) => validIds.has(id)),
      // Con enlace externo, optimistamente 'pending'; el backend responde con
      // el estado real tras su auto-push (synced / sync_error).
      syncStatus: linked ? 'pending' : draft.syncStatus,
      createdAt: draft.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    if (!item.name) return { success: false, error: 'El producto requiere nombre.' };
    const isNew = !model.items.some((i) => i.id === item.id);
    setModel({
      items: isNew ? model.items.concat([item]) : model.items.map((i) => (i.id === item.id ? item : i)),
    });
    try {
      const resp = isNew ? await shell.items.create(item) : await shell.items.update(item.id, item);
      const st = resp && (resp.syncStatus === 'synced' || resp.syncStatus === 'pending' || resp.syncStatus === 'sync_error') ? resp.syncStatus : null;
      if (st) {
        setModel({ items: model.items.map((i) => (i.id === item.id ? Object.assign({}, i, { syncStatus: st }) : i)) });
      }
      return { success: true, message: 'Producto "' + item.name + '" guardado.' };
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar el producto.' });
      if (linked) {
        setModel({ items: model.items.map((i) => (i.id === item.id ? Object.assign({}, i, { syncStatus: 'sync_error' }) : i)) });
      }
      return { success: false, error: (e && e.message) || 'Error al guardar.' };
    }
  }

  async function removeProduct(id) {
    const target = model.items.find((i) => i.id === id);
    setModel({ items: model.items.filter((i) => i.id !== id) });
    try {
      await shell.items.remove(id);
      return { success: true, message: 'Producto "' + (target ? target.name : id) + '" eliminado.' };
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo eliminar el producto.' });
      await reloadItems();
      return { success: false, error: (e && e.message) || 'Error al eliminar.' };
    }
  }

  // ── Sincronización con integraciones ──────────────────────────────────────
  function pendingItemIds() {
    const js = hasJsBinding();
    return model.items.filter((it) => {
      const linked = Array.isArray(it.sourceLinks) && it.sourceLinks.length > 0;
      if (!linked) return js; // sin enlace: el push lo CREA en Jumpseller
      return it.syncStatus === 'pending' || it.syncStatus === 'sync_error';
    }).map((it) => it.id);
  }

  async function syncPull() {
    const res = await shell.authFetch(API + '/api/app-instances/' + instanceId + '/items/sync-pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: s(data.detail) || 'HTTP ' + res.status };
    await reloadItems();
    return { success: true, message: 'Productos actualizados desde las integraciones.' };
  }

  async function syncPush(itemIds) {
    const body = Array.isArray(itemIds) && itemIds.length > 0 ? { itemIds: itemIds } : {};
    const res = await shell.authFetch(API + '/api/app-instances/' + instanceId + '/items/sync-push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: s(data.detail) || 'HTTP ' + res.status };
    // El push puede CREAR productos en la integración (nuevo sourceLink) o
    // completar ids de variantes: recargar para reflejar el enlace (badge JS).
    await reloadItems();
    const sb = data.syncStatusByItem || {};
    const okCount = Object.keys(sb).filter((k) => sb[k] === 'synced').length;
    const errCount = Object.keys(sb).filter((k) => sb[k] === 'sync_error').length;
    return {
      success: true,
      processed: data.processed || 0,
      statusByItem: sb,
      message: (data.processed || 0) + ' procesados' + (okCount ? ' · ' + okCount + ' sincronizados' : '') + (errCount ? ' · ' + errCount + ' con error' : ''),
      hasErrors: errCount > 0,
    };
  }

  // ── Agente ────────────────────────────────────────────────────────────────
  function snapshot() {
    const entById = new Map(enabledEntities().map((e) => [e.id, e]));
    const typeById = new Map(enabledTypes().map((t) => [t.id, t]));
    return {
      items: model.items.map((p) => Object.assign({}, p, {
        entities: (p.entityIds || []).map((id) => entById.get(id)).filter(Boolean).map((e) => ({
          id: e.id, name: e.name, color: e.color, typeId: e.typeId,
          typeName: (typeById.get(e.typeId) || {}).name || e.typeId,
        })),
      })),
      settings: {
        viewMode: model.viewMode,
        entityTypes: enabledTypes(),
        entities: enabledEntities(),
        extraFields: model.extraFields,
        integrationBindings: model.bindings,
      },
      activeFilters: {
        status: model.filterStatus,
        searchQuery: model.search,
        entityIds: model.filterEntityIds,
        entityNames: model.filterEntityIds.map((id) => { const e = entById.get(id); return e ? e.name : id; }),
      },
    };
  }

  function resolveEntityRefs(refs) {
    const out = [];
    const ents = enabledEntities();
    for (const ref of refs || []) {
      const key = s(ref).trim();
      if (!key) continue;
      const needle = norm(key);
      const found = ents.find((e) => e.id === key || norm(e.name) === needle)
        || ents.find((e) => norm(e.name).indexOf(needle) !== -1);
      if (found && out.indexOf(found.id) === -1) out.push(found.id);
    }
    return out;
  }

  async function dispatchAction(action) {
    const p = (action && action.payload) || {};
    switch (action && action.type) {
      case 'UPSERT_PRODUCT': {
        const existing = findProduct(p.id || p.productId) || (!p.id ? findProduct(p.name) : null);
        const name = s(p.name).trim() || (existing && existing.name);
        if (!name) return { success: false, error: 'UPSERT_PRODUCT requiere name (o id de producto existente).' };
        const entityIds = Array.isArray(p.entityIds) || Array.isArray(p.entityNames)
          ? resolveEntityRefs([].concat(p.entityIds || [], p.entityNames || []))
          : (existing && existing.entityIds) || [];
        return saveProduct(Object.assign({}, existing || {}, {
          id: (existing && existing.id) || s(p.id).trim() || newId('prod'),
          name: name,
          sku: p.sku !== undefined ? s(p.sku) : (existing && existing.sku),
          price: typeof p.price === 'number' ? p.price : (existing && existing.price),
          stock: typeof p.stock === 'number' ? p.stock : (existing && existing.stock),
          status: normStatus(p.status || (existing && existing.status) || 'active'),
          description: p.description !== undefined ? s(p.description) : (existing && existing.description),
          imageUrl: p.imageUrl !== undefined ? s(p.imageUrl) : (existing && existing.imageUrl),
          entityIds: entityIds,
        }));
      }
      case 'DELETE_PRODUCT': {
        const target = findProduct(p.productId || p.id || p.productName || p.name);
        if (!target) return { success: false, error: 'No encontré el producto a eliminar (acepto id o nombre).' };
        return removeProduct(target.id);
      }
      case 'ASSIGN_ENTITY': {
        const target = findProduct(p.productId || p.id || p.name);
        if (!target) return { success: false, error: 'Producto no encontrado.' };
        const ids = resolveEntityRefs([].concat(p.entityIds || [], p.entityNames || []));
        return saveProduct(Object.assign({}, target, { entityIds: ids }));
      }
      case 'SET_FILTER': {
        if (p.clear) {
          setModel({ search: '', filterStatus: null, filterEntityIds: [] });
          return { success: true, message: 'Filtros eliminados.' };
        }
        const patch = {};
        const parts = [];
        if ('status' in p) {
          patch.filterStatus = p.status ? normStatus(p.status) : null;
          parts.push(patch.filterStatus ? 'estado: ' + patch.filterStatus : 'sin filtro de estado');
        }
        if ('searchQuery' in p) {
          patch.search = s(p.searchQuery);
          parts.push(patch.search ? 'búsqueda: "' + patch.search + '"' : 'sin búsqueda');
        }
        if ('entityIds' in p || 'entityNames' in p) {
          patch.filterEntityIds = resolveEntityRefs([].concat(p.entityIds || [], p.entityNames || []));
          parts.push(patch.filterEntityIds.length ? 'atributos: ' + patch.filterEntityIds.length : 'sin filtro de atributos');
        }
        if (!parts.length) return { success: false, error: 'SET_FILTER requiere status, searchQuery, entityIds/entityNames o clear:true.' };
        setModel(patch);
        return { success: true, message: 'Filtro aplicado — ' + parts.join(', ') + '.' };
      }
      case 'SYNC_PULL':
        return syncPull();
      case 'SYNC_PUSH': {
        const ids = Array.isArray(p.itemIds) && p.itemIds.length ? p.itemIds : pendingItemIds();
        if (!ids.length) return { success: true, message: 'Nada por sincronizar.' };
        return syncPush(ids);
      }
      default:
        return { success: false, error: 'Acción desconocida en Productos: ' + s(action && action.type) };
    }
  }

  const AGENT_TOOLS = [
    {
      name: 'UPSERT_PRODUCT',
      description: 'Crea o actualiza un producto. Resuelve el existente por id o nombre. Campos: name, sku, price, stock, status (active|draft|inactive), description, imageUrl, entityNames[].',
      inputSchema: { type: 'object', properties: {
        id: { type: 'string' }, name: { type: 'string' }, sku: { type: 'string' },
        price: { type: 'number' }, stock: { type: 'number' },
        status: { type: 'string', enum: ['active', 'draft', 'inactive'] },
        description: { type: 'string' }, imageUrl: { type: 'string' },
        entityNames: { type: 'array', items: { type: 'string' } },
      }, required: ['name'] },
    },
    {
      name: 'DELETE_PRODUCT',
      description: 'Elimina un producto por id o nombre.',
      inputSchema: { type: 'object', properties: { productId: { type: 'string' }, name: { type: 'string' } } },
    },
    {
      name: 'ASSIGN_ENTITY',
      description: 'Reemplaza los atributos (entidades) de un producto. Acepta entityNames por nombre.',
      inputSchema: { type: 'object', properties: {
        productId: { type: 'string' }, name: { type: 'string' },
        entityNames: { type: 'array', items: { type: 'string' } },
      } },
    },
    {
      name: 'SET_FILTER',
      description: 'Filtra la vista: status, searchQuery, entityNames[] o clear:true.',
      inputSchema: { type: 'object', properties: {
        status: { type: 'string' }, searchQuery: { type: 'string' },
        entityNames: { type: 'array', items: { type: 'string' } }, clear: { type: 'boolean' },
      } },
    },
    {
      name: 'SYNC_PULL',
      description: 'Trae los cambios desde las integraciones vinculadas (Jumpseller).',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'SYNC_PUSH',
      description: 'Envía a Jumpseller los productos pendientes (crea los nuevos, actualiza los editados). itemIds opcional.',
      inputSchema: { type: 'object', properties: { itemIds: { type: 'array', items: { type: 'string' } } } },
    },
  ];

  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    try {
      unregisterAgent = shell.agent.register({
        label: 'Productos',
        description: 'Catálogo de productos: crear/editar/eliminar, atributos, filtros y sincronización con Jumpseller.',
        tools: AGENT_TOOLS,
        getSnapshot: snapshot,
        dispatchAction: dispatchAction,
      });
    } catch (e) { /* agente no disponible */ }
  }

  // ── Componentes UI ────────────────────────────────────────────────────────
  function EntityChips(props) {
    // props: {entityIds, entities, max}
    const byId = new Map(props.entities.map((e) => [e.id, e]));
    const shown = (props.entityIds || []).slice(0, props.max || 4);
    const extra = (props.entityIds || []).length - shown.length;
    return h('span', { className: 'kp-entchips' },
      shown.map((eid) => {
        const ent = byId.get(eid);
        if (!ent) return null;
        return h('span', { key: eid, className: 'kp-chip', style: { borderColor: ent.color } },
          h('span', { className: 'kp-chip-dot', style: { background: ent.color } }), ent.name);
      }),
      extra > 0 ? h('span', { className: 'kp-muted-xs' }, '+' + extra) : null,
    );
  }

  function SyncBadge(props) {
    const st = props.item.syncStatus;
    if (!st) return null;
    return h('span', { className: 'kp-badge ' + SYNC_CLASS[st], title: SYNC_TITLE[st] }, SYNC_LABEL[st]);
  }

  function Component() {
    const [, force] = useState(0);
    const [editing, setEditing] = useState(null);      // draft del editor (null = cerrado)
    const [isNew, setIsNew] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [busy, setBusy] = useState(null);            // 'pull' | 'push' | 'import' | itemId
    const [msg, setMsg] = useState(null);
    const [jsStatus, setJsStatus] = useState(null);

    useEffect(() => {
      const fn = () => force((n) => n + 1);
      listeners.add(fn);
      if (!model.loaded) load();
      return () => listeners.delete(fn);
    }, []);
    useEffect(() => {
      if (!msg) return undefined;
      const t = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(t);
    }, [msg]);
    useEffect(() => {
      if (!showSettings) return;
      setJsStatus(null);
      shell.authFetch(API + '/api/integrations/jumpseller/status')
        .then((r) => r.json()).then(setJsStatus)
        .catch(() => setJsStatus({ configured: false }));
    }, [showSettings]);

    const m = model;
    const types = enabledTypes();
    const ents = enabledEntities();
    const hasBindings = m.bindings.length > 0;
    const jsBinding = hasJsBinding();
    const pending = pendingItemIds();

    const visible = useMemo(() => {
      const q = norm(m.search);
      return m.items.filter((it) => {
        if (m.filterStatus && it.status !== m.filterStatus) return false;
        if (m.filterEntityIds.length && !m.filterEntityIds.every((id) => (it.entityIds || []).indexOf(id) !== -1)) return false;
        if (q) {
          const hay = norm(it.name).indexOf(q) !== -1 || norm(it.sku).indexOf(q) !== -1 || norm(it.description).indexOf(q) !== -1;
          if (!hay) return false;
        }
        return true;
      });
    }, [m.items, m.search, m.filterStatus, m.filterEntityIds]);

    const doPull = async () => {
      if (busy) return;
      setBusy('pull');
      const r = await syncPull();
      setBusy(null);
      setMsg({ kind: r.success ? 'ok' : 'err', text: r.success ? r.message : (r.error || 'Error al actualizar.') });
    };
    const doPushAll = async () => {
      if (busy || !pending.length) return;
      setBusy('push');
      const r = await syncPush(pending);
      setBusy(null);
      setMsg({ kind: r.success && !r.hasErrors ? 'ok' : 'err', text: r.success ? r.message : (r.error || 'Error al sincronizar.') });
    };
    const doPushOne = async (item) => {
      if (busy) return;
      setBusy(item.id);
      const r = await syncPush([item.id]);
      setBusy(null);
      if (!r.success) setMsg({ kind: 'err', text: r.error || 'Error al sincronizar.' });
      else if (r.statusByItem && r.statusByItem[item.id] === 'sync_error') setMsg({ kind: 'err', text: '"' + item.name + '": error al sincronizar. Revisa credenciales/campos.' });
      else setMsg({ kind: 'ok', text: '"' + item.name + '" sincronizado con Jumpseller.' });
    };
    const doDelete = async (item) => {
      if (!window.confirm('¿Eliminar el producto "' + item.name + '"? Esta acción no se puede deshacer.')) return;
      await removeProduct(item.id);
      if (editing && editing.id === item.id) setEditing(null);
    };
    const openNew = () => {
      setIsNew(true);
      setEditing({ id: newId('prod'), name: '', sku: '', status: 'active', description: '', imageUrl: '', entityIds: [], variants: [], options: [] });
    };
    const openEdit = (item) => {
      setIsNew(false);
      setEditing(Object.assign({}, item, {
        entityIds: (item.entityIds || []).slice(),
        variants: (item.variants || []).slice(),
        options: (item.options || []).map((o) => Object.assign({}, o, { values: ((o && o.values) || []).slice() })),
      }));
    };
    const saveEditor = async () => {
      if (!editing || !s(editing.name).trim()) return;
      await saveProduct(editing);
      setEditing(null);
    };

    if (!m.loaded) {
      return h('div', { className: 'kimos-products' }, h('div', { className: 'kp-empty' }, 'Cargando productos…'));
    }
    if (m.error) {
      return h('div', { className: 'kimos-products' },
        h('div', { className: 'kp-empty' },
          h('div', null, m.error),
          h('button', { className: 'kp-btn', onClick: () => { setModel({ loaded: false, error: null }); load(); } }, 'Reintentar'),
        ));
    }

    // ── Toolbar ──
    const toolbar = h('div', { className: 'kp-toolbar' },
      h('input', {
        className: 'kp-search', value: m.search, placeholder: 'Buscar productos…',
        onChange: (e) => setModel({ search: e.target.value }),
      }),
      ['active', 'draft', 'inactive'].map((st) =>
        h('button', {
          key: st,
          className: 'kp-chip kp-chip-btn ' + (m.filterStatus === st ? STATUS_CLASS[st] + ' kp-chip-active' : ''),
          onClick: () => setModel({ filterStatus: m.filterStatus === st ? null : st }),
        }, STATUS_LABEL[st])),
      types.map((type) => {
        const typeEnts = ents.filter((e) => e.typeId === type.id);
        if (!typeEnts.length) return null;
        return h('span', { key: type.id, className: 'kp-filtergroup' },
          h('span', { className: 'kp-muted-xs' }, type.name + ':'),
          typeEnts.map((ent) => h('button', {
            key: ent.id,
            className: 'kp-chip kp-chip-btn' + (m.filterEntityIds.indexOf(ent.id) !== -1 ? ' kp-chip-active' : ''),
            style: { borderColor: ent.color },
            onClick: () => setModel({
              filterEntityIds: m.filterEntityIds.indexOf(ent.id) !== -1
                ? m.filterEntityIds.filter((x) => x !== ent.id)
                : m.filterEntityIds.concat([ent.id]),
            }),
          }, h('span', { className: 'kp-chip-dot', style: { background: ent.color } }), ent.name)),
        );
      }),
      h('span', { className: 'kp-spacer' }),
      hasBindings ? h('button', {
        className: 'kp-btn', disabled: !!busy, title: 'Traer cambios desde las integraciones (Jumpseller, …)',
        onClick: doPull,
      }, busy === 'pull' ? 'Actualizando…' : '⟳ Actualizar') : null,
      hasBindings ? h('button', {
        className: 'kp-btn' + (pending.length ? ' kp-btn-primary' : ''),
        disabled: !!busy || !pending.length,
        title: pending.length
          ? 'Enviar ' + pending.length + ' producto(s) a Jumpseller (crea los nuevos y actualiza los editados)'
          : 'Nada por sincronizar. Los productos nuevos o editados aparecen aquí.',
        onClick: doPushAll,
      }, busy === 'push' ? 'Sincronizando…' : (pending.length ? '↑ Sincronizar (' + pending.length + ')' : '↑ Sincronizar')) : null,
      h('span', { className: 'kp-viewtoggle' },
        h('button', {
          className: 'kp-mini' + (m.viewMode === 'table' ? ' kp-mini-active' : ''), title: 'Vista tabla',
          onClick: () => persistConfig({ viewMode: 'table' }),
        }, '☰'),
        h('button', {
          className: 'kp-mini' + (m.viewMode === 'grid' ? ' kp-mini-active' : ''), title: 'Vista grid',
          onClick: () => persistConfig({ viewMode: 'grid' }),
        }, '▦'),
      ),
      h('button', { className: 'kp-btn kp-btn-primary', onClick: openNew }, '+ Nuevo producto'),
      m.isAdmin ? h('button', { className: 'kp-mini', title: 'Configuración', onClick: () => setShowSettings(true) }, '⚙') : null,
    );

    // ── Tabla ──
    const table = h('div', { className: 'kp-tablewrap' },
      h('table', { className: 'kp-table' },
        h('thead', null, h('tr', null,
          h('th', null, ''),
          h('th', null, 'Producto'),
          h('th', null, 'SKU'),
          h('th', { className: 'kp-right' }, 'Precio'),
          h('th', { className: 'kp-right' }, 'Stock'),
          h('th', null, 'Estado'),
          types.length ? h('th', null, 'Atributos') : null,
          h('th', null, ''),
        )),
        h('tbody', null, visible.map((it) => h('tr', { key: it.id, onClick: () => openEdit(it) },
          h('td', null, it.imageUrl
            ? h('img', { className: 'kp-thumb', src: it.imageUrl, alt: '' })
            : h('span', { className: 'kp-thumb kp-thumb-empty' }, '📦')),
          h('td', null,
            h('div', { className: 'kp-name' }, it.name),
            it.description ? h('div', { className: 'kp-muted-xs kp-ellipsis' }, it.description) : null),
          h('td', { className: 'kp-mono' }, it.sku || '—'),
          h('td', { className: 'kp-right kp-nums' }, money(it.price)),
          h('td', { className: 'kp-right kp-nums' }, it.stock != null ? it.stock : '—'),
          h('td', null,
            h('span', { className: 'kp-badge ' + STATUS_CLASS[it.status] }, STATUS_LABEL[it.status]),
            ' ', h(SyncBadge, { item: it })),
          types.length ? h('td', null, h(EntityChips, { entityIds: it.entityIds, entities: ents, max: 4 })) : null,
          h('td', { className: 'kp-rowactions', onClick: (e) => e.stopPropagation() },
            hasBindings ? h('button', {
              className: 'kp-mini', disabled: !!busy,
              title: (it.sourceLinks && it.sourceLinks.length) ? 'Enviar cambios a Jumpseller' : 'Crear este producto en Jumpseller',
              onClick: () => doPushOne(it),
            }, busy === it.id ? '…' : '↑') : null,
            h('button', { className: 'kp-mini', title: 'Editar', onClick: () => openEdit(it) }, '✎'),
            h('button', { className: 'kp-mini kp-danger', title: 'Eliminar', onClick: () => doDelete(it) }, '🗑'),
          ),
        ))),
      ),
    );

    // ── Grid ──
    const grid = h('div', { className: 'kp-grid' }, visible.map((it) =>
      h('div', { key: it.id, className: 'kp-card', onClick: () => openEdit(it) },
        h('div', { className: 'kp-card-img' },
          it.imageUrl ? h('img', { src: it.imageUrl, alt: '' }) : h('span', { className: 'kp-card-imgempty' }, '📦'),
          h('span', { className: 'kp-badge kp-card-status ' + STATUS_CLASS[it.status] }, STATUS_LABEL[it.status]),
          it.syncStatus ? h('span', { className: 'kp-badge kp-card-sync ' + SYNC_CLASS[it.syncStatus], title: SYNC_TITLE[it.syncStatus] }, SYNC_LABEL[it.syncStatus]) : null,
          h('span', { className: 'kp-card-actions', onClick: (e) => e.stopPropagation() },
            hasBindings ? h('button', {
              className: 'kp-mini', disabled: !!busy,
              title: (it.sourceLinks && it.sourceLinks.length) ? 'Enviar cambios a Jumpseller' : 'Crear este producto en Jumpseller',
              onClick: () => doPushOne(it),
            }, busy === it.id ? '…' : '↑') : null,
            h('button', { className: 'kp-mini kp-danger', title: 'Eliminar', onClick: () => doDelete(it) }, '🗑'),
          ),
        ),
        h('div', { className: 'kp-card-body' },
          h('div', { className: 'kp-name' }, it.name),
          it.sku ? h('div', { className: 'kp-mono kp-muted-xs' }, it.sku) : null,
          h('div', { className: 'kp-card-meta' },
            h('span', { className: 'kp-price' }, money(it.price)),
            h('span', { className: 'kp-muted-xs' }, 'stock: ' + (it.stock != null ? it.stock : '—'))),
          h(EntityChips, { entityIds: it.entityIds, entities: ents, max: 3 }),
        ),
      )));

    // ── Editor ──
    const editor = editing && h('div', { className: 'kp-overlay' },
      h('button', { className: 'kp-overlay-bg', onClick: () => setEditing(null), 'aria-label': 'Cerrar' }),
      h('div', { className: 'kp-panel' },
        h('div', { className: 'kp-panel-head' },
          h('span', { className: 'kp-panel-title' }, isNew ? 'Nuevo producto' : 'Editar producto'),
          h('button', { className: 'kp-mini', onClick: () => setEditing(null) }, '✕')),
        h('div', { className: 'kp-panel-body' },
          h('label', { className: 'kp-label' }, 'Nombre *',
            h('input', { className: 'kp-input', value: editing.name, autoFocus: true, placeholder: 'Camiseta básica',
              onChange: (e) => setEditing(Object.assign({}, editing, { name: e.target.value })) })),
          h('div', { className: 'kp-row' },
            h('label', { className: 'kp-label' }, 'SKU',
              h('input', { className: 'kp-input', value: editing.sku || '', placeholder: 'CAM-01',
                onChange: (e) => setEditing(Object.assign({}, editing, { sku: e.target.value })) })),
            h('label', { className: 'kp-label' }, 'Estado',
              h('select', { className: 'kp-input', value: editing.status,
                onChange: (e) => setEditing(Object.assign({}, editing, { status: e.target.value })) },
                ['active', 'draft', 'inactive'].map((st) => h('option', { key: st, value: st }, STATUS_LABEL[st]))))),
          h('div', { className: 'kp-row' },
            h('label', { className: 'kp-label' }, 'Precio',
              h('input', { className: 'kp-input', type: 'number', value: editing.price != null ? editing.price : '', placeholder: '9990',
                onChange: (e) => setEditing(Object.assign({}, editing, { price: e.target.value === '' ? undefined : Number(e.target.value) })) })),
            h('label', { className: 'kp-label' }, 'Stock',
              h('input', { className: 'kp-input', type: 'number', value: editing.stock != null ? editing.stock : '', placeholder: '0',
                onChange: (e) => setEditing(Object.assign({}, editing, { stock: e.target.value === '' ? undefined : Number(e.target.value) })) }))),
          h('div', { className: 'kp-row' },
            h('label', { className: 'kp-label' }, 'Marca',
              h('input', { className: 'kp-input', value: editing.brand || '', placeholder: 'ACME',
                onChange: (e) => setEditing(Object.assign({}, editing, { brand: e.target.value || undefined })) })),
            h('label', { className: 'kp-label' }, 'Código de barras',
              h('input', { className: 'kp-input', value: editing.barcode || '', placeholder: 'EAN/UPC',
                onChange: (e) => setEditing(Object.assign({}, editing, { barcode: e.target.value || undefined })) }))),
          h('div', { className: 'kp-row' },
            h('label', { className: 'kp-label', title: 'Precio anterior tachado (compare_at_price de Jumpseller)' }, 'Precio antes (tachado)',
              h('input', { className: 'kp-input', type: 'number', value: editing.compareAtPrice != null ? editing.compareAtPrice : '', placeholder: '12990',
                onChange: (e) => setEditing(Object.assign({}, editing, { compareAtPrice: e.target.value === '' ? undefined : Number(e.target.value) })) })),
            h('label', { className: 'kp-label', title: 'Costo por unidad (cost_per_item de Jumpseller)' }, 'Costo',
              h('input', { className: 'kp-input', type: 'number', value: editing.costPerItem != null ? editing.costPerItem : '', placeholder: '5000',
                onChange: (e) => setEditing(Object.assign({}, editing, { costPerItem: e.target.value === '' ? undefined : Number(e.target.value) })) })),
            h('label', { className: 'kp-label' }, 'Peso (kg)',
              h('input', { className: 'kp-input', type: 'number', value: editing.weight != null ? editing.weight : '', placeholder: '0.5',
                onChange: (e) => setEditing(Object.assign({}, editing, { weight: e.target.value === '' ? undefined : Number(e.target.value) })) }))),
          h('label', { className: 'kp-label' }, 'URL de imagen',
            h('input', { className: 'kp-input', value: editing.imageUrl || '', placeholder: 'https://…',
              onChange: (e) => setEditing(Object.assign({}, editing, { imageUrl: e.target.value })) })),
          h('label', { className: 'kp-label' }, 'Descripción',
            h('textarea', { className: 'kp-input', rows: 3, value: editing.description || '',
              onChange: (e) => setEditing(Object.assign({}, editing, { description: e.target.value })) })),

          // Opciones del producto (Color, Talla, …): definiciones con tipo
          // (opción o addon con recargo), orden y valores. Se sincronizan con
          // los endpoints /products/{id}/options.json de Jumpseller; las que
          // se quitan aquí se ELIMINAN también en la tienda al sincronizar.
          h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' },
              h('span', null, 'Opciones del producto' + ((editing.options || []).length ? ' (' + editing.options.length + ')' : '')),
              h('button', { className: 'kp-mini', title: 'Añadir opción (p.ej. Color)',
                onClick: () => setEditing(Object.assign({}, editing, {
                  options: (editing.options || []).concat([{ name: '', optionType: 'option', values: [] }]),
                })) }, '+')),
            (editing.options || []).map((odef, oi) => {
              const setOption = (patch) => {
                const next = (editing.options || []).map((o) => Object.assign({}, o, { values: (o.values || []).slice() }));
                next[oi] = Object.assign({}, next[oi], patch);
                setEditing(Object.assign({}, editing, { options: next }));
              };
              const moveOption = (dir) => {
                const next = (editing.options || []).slice();
                const j = oi + dir;
                if (j < 0 || j >= next.length) return;
                const tmp = next[oi]; next[oi] = next[j]; next[j] = tmp;
                setEditing(Object.assign({}, editing, { options: next }));
              };
              return h('div', { key: oi, className: 'kp-variant' },
                h('div', { className: 'kp-variant-row' },
                  h('input', { className: 'kp-input', value: odef.name || '', placeholder: 'Nombre — p.ej. Color',
                    onChange: (e) => setOption({ name: e.target.value }) }),
                  h('select', { className: 'kp-input kp-input-sm', value: odef.optionType || 'option',
                    title: 'Opción: define variantes. Addon: extra con recargo (p.ej. envoltorio de regalo).',
                    onChange: (e) => setOption({ optionType: e.target.value }) },
                    h('option', { value: 'option' }, 'Opción'),
                    h('option', { value: 'addon' }, 'Addon'),
                    h('option', { value: 'custom' }, 'Personalizada')),
                  odef.optionType === 'addon' ? h('input', {
                    className: 'kp-input kp-input-sm', type: 'number', placeholder: 'Recargo',
                    value: odef.addonPrice != null ? odef.addonPrice : '',
                    title: 'Precio adicional del addon (addon_price)',
                    onChange: (e) => setOption({ addonPrice: e.target.value === '' ? null : Number(e.target.value) }),
                  }) : null,
                  h('button', { className: 'kp-mini', title: 'Subir', disabled: oi === 0, onClick: () => moveOption(-1) }, '↑'),
                  h('button', { className: 'kp-mini', title: 'Bajar', disabled: oi === (editing.options || []).length - 1, onClick: () => moveOption(1) }, '↓'),
                  h('button', { className: 'kp-mini kp-danger', title: 'Quitar opción (se elimina también en Jumpseller al sincronizar)',
                    onClick: () => setEditing(Object.assign({}, editing, { options: (editing.options || []).filter((_, i) => i !== oi) })) }, '🗑')),
                h('div', { className: 'kp-entpick' },
                  (odef.values || []).map((vdef, vvi) => h('span', { key: vvi, className: 'kp-chip' },
                    vdef.name,
                    h('button', { className: 'kp-chip-x', title: 'Quitar valor',
                      onClick: () => setOption({ values: (odef.values || []).filter((_, i) => i !== vvi) }) }, '×'))),
                  h('input', {
                    className: 'kp-input kp-input-sm', placeholder: '+ valor (Enter)',
                    title: 'Escribe un valor (p.ej. Negro) y presiona Enter',
                    onKeyDown: (e) => {
                      if (e.key !== 'Enter') return;
                      const val = e.target.value.trim();
                      if (!val) return;
                      if (!(odef.values || []).some((x) => norm(x.name) === norm(val))) {
                        setOption({ values: (odef.values || []).concat([{ name: val }]) });
                      }
                      e.target.value = '';
                    },
                  })),
                odef.sourceOptionId ? h('div', { className: 'kp-muted-xs' }, 'Enlazada a Jumpseller (#' + odef.sourceOptionId + ')') : null,
              );
            }),
            !(editing.options || []).length ? h('div', { className: 'kp-muted-xs' },
              'Sin opciones definidas. Las variantes también pueden crear opciones al vuelo (Color: Negro).') : null,
          ),

          // Variantes: opciones (Color: Negro, Talla: M) con precio/stock/SKU/
          // barcode/precio-tachado/costo propios. Las variantes eliminadas aquí
          // se eliminan también en Jumpseller al sincronizar.
          h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' },
              h('span', null, 'Variantes' + ((editing.variants || []).length ? ' (' + editing.variants.length + ')' : '')),
              h('button', { className: 'kp-mini', title: 'Añadir variante',
                onClick: () => setEditing(Object.assign({}, editing, {
                  variants: (editing.variants || []).concat([{ options: {}, price: editing.price != null ? editing.price : null, stock: null, sku: null }]),
                })) }, '+')),
            (editing.variants || []).map((variant, vi) => {
              const setVariant = (patch) => {
                const next = (editing.variants || []).slice();
                next[vi] = Object.assign({}, variant, patch);
                setEditing(Object.assign({}, editing, { variants: next }));
              };
              const optionsText = Object.keys(variant.options || {})
                .map((k) => (variant.options[k] ? k + ': ' + variant.options[k] : k)).join(', ');
              return h('div', { key: vi, className: 'kp-variant' },
                h('div', { className: 'kp-variant-row' },
                  h('input', {
                    className: 'kp-input', defaultValue: optionsText,
                    placeholder: 'Opciones — p.ej. Color: Negro, Talla: M',
                    title: 'Formato: Opción: Valor, separadas por coma',
                    onBlur: (e) => {
                      const opts = {};
                      e.target.value.split(',').forEach((part) => {
                        const idx = part.indexOf(':');
                        const key = (idx === -1 ? part : part.slice(0, idx)).trim();
                        if (key) opts[key] = idx === -1 ? '' : part.slice(idx + 1).trim();
                      });
                      setVariant({ options: opts });
                    },
                  }),
                  h('button', { className: 'kp-mini kp-danger', title: 'Quitar variante',
                    onClick: () => setEditing(Object.assign({}, editing, { variants: (editing.variants || []).filter((_, i) => i !== vi) })) }, '🗑')),
                h('div', { className: 'kp-variant-row' },
                  h('input', { className: 'kp-input', type: 'number', value: variant.price != null ? variant.price : '', placeholder: 'Precio',
                    onChange: (e) => setVariant({ price: e.target.value === '' ? null : Number(e.target.value) }) }),
                  h('input', { className: 'kp-input', type: 'number', value: variant.stock != null ? variant.stock : '', placeholder: 'Stock',
                    onChange: (e) => setVariant({ stock: e.target.value === '' ? null : Number(e.target.value) }) }),
                  h('input', { className: 'kp-input', value: variant.sku || '', placeholder: 'SKU',
                    onChange: (e) => setVariant({ sku: e.target.value || null }) })),
                h('div', { className: 'kp-variant-row' },
                  h('input', { className: 'kp-input', value: variant.barcode || '', placeholder: 'Código de barras',
                    onChange: (e) => setVariant({ barcode: e.target.value || null }) }),
                  h('input', { className: 'kp-input', type: 'number', value: variant.compareAtPrice != null ? variant.compareAtPrice : '', placeholder: 'Precio antes',
                    title: 'Precio anterior tachado de esta variante (compare_at_price)',
                    onChange: (e) => setVariant({ compareAtPrice: e.target.value === '' ? null : Number(e.target.value) }) }),
                  h('input', { className: 'kp-input', type: 'number', value: variant.costPerItem != null ? variant.costPerItem : '', placeholder: 'Costo',
                    title: 'Costo por unidad de esta variante (cost_per_item)',
                    onChange: (e) => setVariant({ costPerItem: e.target.value === '' ? null : Number(e.target.value) }) })),
                variant.sourceVariantId ? h('div', { className: 'kp-muted-xs' }, 'Enlazada a Jumpseller (#' + variant.sourceVariantId + ')') : null,
              );
            }),
            (editing.variants || []).length ? h('div', { className: 'kp-muted-xs' },
              'Al sincronizar, las variantes que ya no estén aquí se eliminan también en Jumpseller.') : null,
            !(editing.variants || []).length ? h('div', { className: 'kp-muted-xs' }, 'Sin variantes: el producto usa el precio y stock generales.') : null,
          ),

          // Campos personalizados (extraFields de la config de la instancia)
          m.extraFields.length ? h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' }, h('span', null, 'Campos personalizados')),
            m.extraFields.map((field) => h('label', { key: field.id, className: 'kp-label' }, field.name,
              h('input', {
                className: 'kp-input',
                type: field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text',
                value: s(((editing.extra || {})[field.id])),
                placeholder: field.placeholder || field.name,
                onChange: (e) => setEditing(Object.assign({}, editing, {
                  extra: Object.assign({}, editing.extra || {}, (() => { const o = {}; o[field.id] = e.target.value; return o; })()),
                })),
              }))),
          ) : null,

          // Atributos (entidades del workspace habilitadas en esta instancia)
          types.length ? h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' }, h('span', null, 'Atributos')),
            types.map((type) => {
              const typeEnts = ents.filter((e) => e.typeId === type.id);
              if (!typeEnts.length) return null;
              return h('div', { key: type.id, className: 'kp-enttype' },
                h('div', { className: 'kp-muted-xs' }, type.name + (type.multi ? '' : ' (única)')),
                h('div', { className: 'kp-entpick' }, typeEnts.map((ent) => {
                  const active = (editing.entityIds || []).indexOf(ent.id) !== -1;
                  return h('button', {
                    key: ent.id,
                    className: 'kp-chip kp-chip-btn' + (active ? ' kp-chip-active' : ''),
                    style: { borderColor: ent.color },
                    onClick: () => {
                      let next = (editing.entityIds || []).slice();
                      if (active) next = next.filter((x) => x !== ent.id);
                      else {
                        if (!type.multi) {
                          const sameType = new Set(typeEnts.map((e2) => e2.id));
                          next = next.filter((x) => !sameType.has(x));
                        }
                        next.push(ent.id);
                      }
                      setEditing(Object.assign({}, editing, { entityIds: next }));
                    },
                  }, h('span', { className: 'kp-chip-dot', style: { background: ent.color } }), ent.name);
                })));
            })) : null,

          (editing.sourceLinks || []).length ? h('div', { className: 'kp-sourceinfo' },
            (editing.sourceLinks || []).map((lnk) => h('div', { key: lnk.integration + lnk.sourceId },
              'Origen: ', h('strong', { className: 'kp-mono' }, lnk.integration), ' · id externo ', h('code', null, lnk.sourceId)))) : null,
        ),
        h('div', { className: 'kp-panel-foot' },
          !isNew ? h('button', { className: 'kp-btn kp-danger', onClick: () => doDelete(editing) }, 'Eliminar') : h('span', null),
          h('span', { className: 'kp-spacer' }),
          h('button', { className: 'kp-btn', onClick: () => setEditing(null) }, 'Cancelar'),
          h('button', { className: 'kp-btn kp-btn-primary', disabled: !s(editing.name).trim(), onClick: saveEditor }, isNew ? 'Crear' : 'Guardar'),
        ),
      ));

    // ── Configuración (admins) ──
    const settingsPanel = showSettings && h('div', { className: 'kp-overlay' },
      h('button', { className: 'kp-overlay-bg', onClick: () => setShowSettings(false), 'aria-label': 'Cerrar' }),
      h('div', { className: 'kp-panel' },
        h('div', { className: 'kp-panel-head' },
          h('span', { className: 'kp-panel-title' }, 'Configuración de Productos'),
          h('button', { className: 'kp-mini', onClick: () => setShowSettings(false) }, '✕')),
        h('div', { className: 'kp-panel-body' },
          h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' }, h('span', null, 'Vista por defecto')),
            h('div', { className: 'kp-entpick' },
              [['table', '☰ Tabla'], ['grid', '▦ Grid']].map((pair) => h('button', {
                key: pair[0],
                className: 'kp-chip kp-chip-btn' + (m.viewMode === pair[0] ? ' kp-chip-active' : ''),
                onClick: () => persistConfig({ viewMode: pair[0] }),
              }, pair[1])))),

          h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' }, h('span', null, 'Tipos de atributos habilitados')),
            h('div', { className: 'kp-muted-xs' }, 'Atributos del workspace (categorías, marcas, …) visibles en esta instancia.'),
            h('div', { className: 'kp-entpick' }, m.allEntityTypes.map((type) => {
              const active = m.enabledEntityTypeIds.indexOf(type.id) !== -1;
              return h('button', {
                key: type.id,
                className: 'kp-chip kp-chip-btn' + (active ? ' kp-chip-active' : ''),
                onClick: () => persistConfig({
                  enabledEntityTypeIds: active
                    ? m.enabledEntityTypeIds.filter((x) => x !== type.id)
                    : m.enabledEntityTypeIds.concat([type.id]),
                }),
              }, type.name);
            })),
            !m.allEntityTypes.length ? h('div', { className: 'kp-muted-xs' }, 'No hay tipos de atributos en el workspace todavía.') : null),

          h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' },
              h('span', null, 'Campos personalizados'),
              h('button', { className: 'kp-mini', title: 'Añadir campo',
                onClick: () => persistConfig({ extraFields: m.extraFields.concat([{ id: newId('field'), name: 'Nuevo campo', type: 'text' }]) }) }, '+')),
            m.extraFields.map((field, fi) => h('div', { key: field.id, className: 'kp-variant-row' },
              h('input', { className: 'kp-input', value: field.name,
                onChange: (e) => {
                  const next = m.extraFields.slice();
                  next[fi] = Object.assign({}, field, { name: e.target.value });
                  persistConfig({ extraFields: next });
                } }),
              h('select', { className: 'kp-input kp-input-sm', value: field.type || 'text',
                onChange: (e) => {
                  const next = m.extraFields.slice();
                  next[fi] = Object.assign({}, field, { type: e.target.value });
                  persistConfig({ extraFields: next });
                } },
                ['text', 'number', 'date', 'email', 'url'].map((t) => h('option', { key: t, value: t }, t))),
              h('button', { className: 'kp-mini kp-danger', title: 'Quitar campo',
                onClick: () => persistConfig({ extraFields: m.extraFields.filter((_, i) => i !== fi) }) }, '🗑'))),
            !m.extraFields.length ? h('div', { className: 'kp-muted-xs' }, 'Sin campos personalizados.') : null),

          h('div', { className: 'kp-section' },
            h('div', { className: 'kp-section-head' }, h('span', null, 'Jumpseller')),
            jsStatus == null
              ? h('div', { className: 'kp-muted-xs' }, 'Comprobando credenciales…')
              : jsStatus.configured
                ? h('div', { className: 'kp-okline' }, '✓ Credenciales configuradas')
                : h('div', { className: 'kp-warnline' }, '⚠ Sin credenciales. Configúralas en Integraciones antes de importar.'),
            h('label', { className: 'kp-switchline' },
              h('input', { type: 'checkbox', checked: jsBinding,
                onChange: () => persistConfig({
                  integrationBindings: jsBinding
                    ? m.bindings.filter((b) => !b || b.integration !== 'jumpseller')
                    : m.bindings.concat([{ integration: 'jumpseller', syncMode: 'pull' }]),
                }) }),
              ' Vincular esta instancia a Jumpseller (importar y sincronizar)'),
            (jsStatus && jsStatus.configured && jsBinding) ? h('button', {
              className: 'kp-btn', disabled: !!busy,
              onClick: async () => {
                setBusy('import');
                try {
                  const res = await shell.authFetch(API + '/api/integrations/jumpseller/sync-to-apps', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) setMsg({ kind: 'err', text: s(data.detail) || 'Error ' + res.status });
                  else {
                    setMsg({ kind: 'ok', text: 'Importación completada: ' + s(data.js_products_fetched != null ? data.js_products_fetched : '?') + ' productos de Jumpseller.' });
                    await reloadItems();
                  }
                } catch (e) {
                  setMsg({ kind: 'err', text: (e && e.message) || 'Error de red' });
                } finally { setBusy(null); }
              },
            }, busy === 'import' ? 'Importando…' : '⟳ Importar desde Jumpseller') : null),
        ),
        h('div', { className: 'kp-panel-foot' },
          h('span', { className: 'kp-spacer' }),
          h('button', { className: 'kp-btn kp-btn-primary', onClick: () => setShowSettings(false) }, 'Listo'),
        ),
      ));

    return h('div', { className: 'kimos-products' },
      toolbar,
      msg ? h('div', { className: 'kp-msg ' + (msg.kind === 'ok' ? 'kp-msg-ok' : 'kp-msg-err') }, msg.text) : null,
      m.items.length === 0
        ? h('div', { className: 'kp-empty' },
            h('div', { className: 'kp-empty-icon' }, '📦'),
            h('div', null, 'Aún no hay productos'),
            h('div', { className: 'kp-muted-xs' }, 'Crea el primero o impórtalos desde Jumpseller (⚙ Configuración).'),
            h('button', { className: 'kp-btn kp-btn-primary', onClick: openNew }, '+ Crear primer producto'))
        : (m.viewMode === 'grid' ? grid : table),
      m.items.length > 0 && visible.length === 0
        ? h('div', { className: 'kp-nofilter' }, 'Ningún producto coincide con los filtros activos.') : null,
      editor,
      settingsPanel,
    );
  }

  return {
    Component: Component,
    unmount: () => {
      if (unregisterAgent) { try { unregisterAgent(); } catch (e) { /* ya liberado */ } }
      listeners.clear();
    },
  };
}
