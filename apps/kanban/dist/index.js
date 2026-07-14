/**
 * Kanban — app oficial instalable (v3.0, bundle real en kimos-packages).
 *
 * Migración 1:1 del Kanban del producto al contrato AppShell. COMPATIBLE con
 * las instancias existentes: mismas columnas en `instance.config.columns`
 * ({id,name,color}, `columnsLocked`) y mismas tarjetas en los items
 * ({name, description, startAt, endAt, column, owner{id,name}, entityIds,
 * order, extra}).
 *
 * Funciones: tablero por columnas con drag&drop nativo (tarjetas entre y
 * dentro de columnas), editor de tarjeta (fechas, responsable, entidades del
 * workspace, campos extra), gestión de columnas (añadir/renombrar/color/
 * eliminar/bloquear — solo admins del equipo), filtros por búsqueda/
 * responsable/entidad y control por agente (shell.agent.register).
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  const instanceId = shell.app && shell.app.instanceId;
  const teamId = shell.app && shell.app.teamId;

  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) { return window.location.origin; }
  }
  const API = apiBase();

  const s = (v) => (v == null ? '' : String(v));
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmtDate = (v) => {
    if (!s(v)) return '';
    try { return new Date(s(v)).toLocaleDateString(); } catch (e) { return s(v); }
  };
  const toDateInput = (v) => {
    if (!s(v)) return '';
    try { return new Date(s(v)).toISOString().slice(0, 10); } catch (e) { return ''; }
  };
  const fromDateInput = (v) => (v ? new Date(v + 'T12:00:00').toISOString() : '');

  const DEFAULT_COLUMNS = [
    { id: 'todo', name: 'Por hacer', color: '#94a3b8' },
    { id: 'doing', name: 'En curso', color: '#3b82f6' },
    { id: 'done', name: 'Hecho', color: '#22c55e' },
  ];

  // ── Estado del módulo (closure): UNA copia por ventana ─────────────────
  let model = {
    columns: [], cards: [], columnsLocked: false,
    enabledEntityTypeIds: [], extraFields: [],
    entityTypes: [], entities: [], members: [],
    isAdmin: false, loaded: false, error: null,
    rawConfig: {},
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l({ ...model }));
  const setModel = (patch) => { model = Object.assign({}, model, patch); emit(); };

  // ── Persistencia ────────────────────────────────────────────────────────
  async function persistConfig() {
    const config = Object.assign({}, model.rawConfig, {
      columns: model.columns,
      columnsLocked: model.columnsLocked,
      enabledEntityTypeIds: model.enabledEntityTypeIds,
      extraFields: model.extraFields,
    });
    model.rawConfig = config;
    try {
      await shell.authFetch(API + '/api/app-instances/' + instanceId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar la configuración del tablero.' });
    }
  }

  async function persistCard(card) {
    try { await shell.items.update(card.id, card); }
    catch (e) { shell.notify({ level: 'error', text: 'No se pudo guardar la tarjeta.' }); }
  }

  async function load() {
    try {
      const [items, instRes] = await Promise.all([
        shell.items.list(),
        shell.authFetch(API + '/api/app-instances/' + instanceId, { cache: 'no-store' }),
      ]);
      let config = {};
      if (instRes.ok) config = ((await instRes.json()) || {}).config || {};
      const columns = Array.isArray(config.columns) && config.columns.length
        ? config.columns.filter((c) => c && c.id)
        : DEFAULT_COLUMNS.map((c) => ({ ...c }));
      const cards = (items || [])
        .filter((it) => it && it.kind !== 'definition' && s(it.name))
        .map((it) => Object.assign({ entityIds: [], order: 0 }, it));
      setModel({
        columns,
        cards,
        columnsLocked: config.columnsLocked === true,
        enabledEntityTypeIds: config.enabledEntityTypeIds || [],
        extraFields: config.extraFields || [],
        rawConfig: config,
        loaded: true,
        error: null,
      });
    } catch (e) {
      setModel({ loaded: true, error: (e && e.message) || 'No se pudo cargar el tablero.' });
    }
    // Contexto secundario: entidades del workspace, miembros y rol — la app
    // funciona igual si alguno falla.
    try {
      const res = await shell.authFetch(API + '/api/entities', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({ entityTypes: data.entityTypes || [], entities: data.entities || [] });
      }
    } catch (e) { /* opcional */ }
    try {
      const res = await shell.authFetch(API + '/api/identity/actors', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({
          members: (data.actors || [])
            .filter((a) => a && a.active !== false)
            .map((a) => ({ id: a.id, name: a.displayName || a.name || a.email || a.id })),
        });
      }
    } catch (e) { /* opcional */ }
    try {
      const res = await shell.authFetch(API + '/api/identity/me', { cache: 'no-store' });
      if (res.ok) {
        const me = await res.json();
        const isAdmin = me.role === 'superadmin' ||
          (teamId && me.team_roles && me.team_roles[teamId] === 'admin');
        setModel({ isAdmin: !!isAdmin });
      }
    } catch (e) { /* opcional */ }
  }

  // ── Mutaciones (compartidas por UI y agente) ────────────────────────────
  function columnOf(colId) {
    return model.columns.find((c) => c.id === colId) || model.columns[0];
  }

  async function createCard(fields) {
    const col = columnOf(s(fields.column)) || model.columns[0];
    if (!col) return { success: false, error: 'El tablero no tiene columnas.' };
    const inCol = model.cards.filter((c) => c.column === col.id);
    const card = {
      id: uid('card'),
      name: s(fields.name).trim() || 'Nueva tarjeta',
      description: s(fields.description) || '',
      startAt: s(fields.startAt) || new Date().toISOString(),
      endAt: s(fields.endAt) || new Date().toISOString(),
      column: col.id,
      owner: fields.owner || undefined,
      entityIds: Array.isArray(fields.entityIds) ? fields.entityIds : [],
      order: inCol.length,
      extra: fields.extra || {},
    };
    setModel({ cards: [...model.cards, card] });
    try { await shell.items.create(card); }
    catch (e) { return { success: false, error: 'No se pudo crear la tarjeta.' }; }
    return { success: true, message: 'Tarjeta "' + card.name + '" creada en ' + col.name + '.', cardId: card.id };
  }

  async function updateCard(id, patch) {
    const card = model.cards.find((c) => c.id === id);
    if (!card) return { success: false, error: 'Tarjeta no encontrada: ' + id };
    const next = Object.assign({}, card, patch);
    setModel({ cards: model.cards.map((c) => (c.id === id ? next : c)) });
    await persistCard(next);
    return { success: true, message: 'Tarjeta actualizada.' };
  }

  async function moveCard(id, colId, order) {
    const col = columnOf(colId);
    if (!col) return { success: false, error: 'Columna no encontrada: ' + colId };
    const card = model.cards.find((c) => c.id === id);
    if (!card) return { success: false, error: 'Tarjeta no encontrada: ' + id };
    const target = model.cards
      .filter((c) => c.column === col.id && c.id !== id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = order == null ? target.length : Math.max(0, Math.min(target.length, order));
    target.splice(idx, 0, Object.assign({}, card, { column: col.id }));
    const others = model.cards.filter((c) => c.column !== col.id && c.id !== id);
    const reordered = target.map((c, i) => Object.assign({}, c, { order: i }));
    setModel({ cards: [...others, ...reordered] });
    for (const c of reordered) await persistCard(c);
    return { success: true, message: 'Tarjeta movida a ' + col.name + '.' };
  }

  async function deleteCard(id) {
    const card = model.cards.find((c) => c.id === id);
    if (!card) return { success: false, error: 'Tarjeta no encontrada: ' + id };
    setModel({ cards: model.cards.filter((c) => c.id !== id) });
    try { await shell.items.remove(id); }
    catch (e) { return { success: false, error: 'No se pudo eliminar.' }; }
    return { success: true, message: 'Tarjeta "' + card.name + '" eliminada.' };
  }

  // ── Agente ──────────────────────────────────────────────────────────────
  const offAgent = shell.agent && shell.agent.register ? shell.agent.register({
    label: 'Kanban',
    description: 'Tablero kanban: crear, mover, editar y eliminar tarjetas.',
    tools: [
      { name: 'CREATE_CARD', description: 'Crea una tarjeta. column = id o nombre de columna.',
        inputSchema: { type: 'object', properties: {
          name: { type: 'string' }, description: { type: 'string' },
          column: { type: 'string' }, ownerId: { type: 'string' },
        }, required: ['name'] } },
      { name: 'MOVE_CARD', description: 'Mueve una tarjeta a otra columna.',
        inputSchema: { type: 'object', properties: {
          cardId: { type: 'string' }, column: { type: 'string' }, order: { type: 'number' },
        }, required: ['cardId', 'column'] } },
      { name: 'UPDATE_CARD', description: 'Edita nombre/descripción/fechas de una tarjeta.',
        inputSchema: { type: 'object', properties: {
          cardId: { type: 'string' }, name: { type: 'string' },
          description: { type: 'string' }, startAt: { type: 'string' }, endAt: { type: 'string' },
        }, required: ['cardId'] } },
      { name: 'DELETE_CARD', description: 'Elimina una tarjeta.',
        inputSchema: { type: 'object', properties: { cardId: { type: 'string' } }, required: ['cardId'] } },
    ],
    getSnapshot: () => ({
      columns: model.columns.map((c) => ({ id: c.id, name: c.name })),
      cards: model.cards.map((c) => ({
        id: c.id, name: c.name, column: c.column,
        owner: c.owner ? c.owner.name : null, endAt: c.endAt || null,
      })),
    }),
    dispatchAction: async (action) => {
      const p = (action && action.payload) || {};
      const resolveCol = (v) => {
        const needle = s(v).trim().toLowerCase();
        const byId = model.columns.find((c) => c.id === v);
        const byName = model.columns.find((c) => s(c.name).toLowerCase() === needle);
        return (byId || byName || {}).id;
      };
      switch (action.type) {
        case 'CREATE_CARD': {
          const owner = p.ownerId ? model.members.find((m) => m.id === p.ownerId) : null;
          return createCard({
            name: p.name, description: p.description, column: resolveCol(p.column),
            owner: owner ? { id: owner.id, name: owner.name } : undefined,
          });
        }
        case 'MOVE_CARD': return moveCard(s(p.cardId), resolveCol(p.column), p.order);
        case 'UPDATE_CARD': {
          const patch = {};
          for (const k of ['name', 'description', 'startAt', 'endAt']) {
            if (p[k] != null) patch[k] = s(p[k]);
          }
          return updateCard(s(p.cardId), patch);
        }
        case 'DELETE_CARD': return deleteCard(s(p.cardId));
        default: return { success: false, error: 'Acción desconocida: ' + action.type };
      }
    },
  }) : null;

  // ── UI ──────────────────────────────────────────────────────────────────
  function Component() {
    const [m, setM] = useState({ ...model });
    useEffect(() => { listeners.add(setM); return () => listeners.delete(setM); }, []);
    useEffect(() => { load(); }, []);

    const [search, setSearch] = useState('');
    const [filterOwner, setFilterOwner] = useState(null);
    const [filterEntity, setFilterEntity] = useState(null);
    const [editing, setEditing] = useState(null);   // tarjeta en edición (draft)
    const [manageCols, setManageCols] = useState(false);
    const dragCard = useRef(null);
    const [dropHint, setDropHint] = useState(null); // {col, index}

    const enabledTypes = useMemo(
      () => (m.entityTypes || []).filter((t) => (m.enabledEntityTypeIds || []).includes(t.id)),
      [m.entityTypes, m.enabledEntityTypeIds],
    );
    const enabledEntities = useMemo(() => {
      const typeIds = new Set(enabledTypes.map((t) => t.id));
      return (m.entities || []).filter((e) => typeIds.has(e.typeId));
    }, [m.entities, enabledTypes]);
    const entityById = useMemo(() => {
      const map = new Map();
      for (const e of m.entities || []) map.set(e.id, e);
      return map;
    }, [m.entities]);

    const ownersInUse = useMemo(() => {
      const seen = new Map();
      for (const c of m.cards) if (c.owner && c.owner.id) seen.set(c.owner.id, c.owner);
      return Array.from(seen.values());
    }, [m.cards]);

    const visibleCards = useMemo(() => {
      const needle = search.trim().toLowerCase();
      return m.cards
        .filter((c) => !needle || s(c.name).toLowerCase().includes(needle) || s(c.description).toLowerCase().includes(needle))
        .filter((c) => !filterOwner || (c.owner && c.owner.id === filterOwner))
        .filter((c) => !filterEntity || (c.entityIds || []).includes(filterEntity));
    }, [m.cards, search, filterOwner, filterEntity]);

    // ── Drag & drop nativo ────────────────────────────────────────────────
    const onCardDragStart = (e, card) => {
      dragCard.current = card.id;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', card.id); } catch (err) { /* IE */ }
    };
    const onColDragOver = (e, colId) => {
      if (!dragCard.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Índice de inserción según la posición Y sobre las tarjetas.
      const body = e.currentTarget;
      const cardsEls = Array.from(body.querySelectorAll('[data-card-id]'));
      let index = cardsEls.length;
      for (let i = 0; i < cardsEls.length; i++) {
        const r = cardsEls[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { index = i; break; }
      }
      setDropHint((prev) => (prev && prev.col === colId && prev.index === index) ? prev : { col: colId, index });
    };
    const onColDrop = (e, colId) => {
      e.preventDefault();
      const id = dragCard.current;
      const hint = dropHint;
      dragCard.current = null;
      setDropHint(null);
      if (id) moveCard(id, colId, hint && hint.col === colId ? hint.index : null);
    };
    const onDragEnd = () => { dragCard.current = null; setDropHint(null); };

    // ── Columnas ──────────────────────────────────────────────────────────
    const addColumn = () => {
      const name = window.prompt('Nombre de la columna:');
      if (!name || !name.trim()) return;
      const col = { id: uid('col'), name: name.trim(), color: '#64748b' };
      setModel({ columns: [...model.columns, col] });
      persistConfig();
    };
    const renameColumn = (col) => {
      const name = window.prompt('Nuevo nombre:', col.name);
      if (!name || !name.trim()) return;
      setModel({ columns: model.columns.map((c) => (c.id === col.id ? { ...c, name: name.trim() } : c)) });
      persistConfig();
    };
    const recolorColumn = (col, color) => {
      setModel({ columns: model.columns.map((c) => (c.id === col.id ? { ...c, color } : c)) });
      persistConfig();
    };
    const removeColumn = (col) => {
      const inCol = m.cards.filter((c) => c.column === col.id).length;
      if (!window.confirm('¿Eliminar la columna "' + col.name + '"' + (inCol ? ' y sus ' + inCol + ' tarjeta(s)' : '') + '?')) return;
      setModel({ columns: model.columns.filter((c) => c.id !== col.id) });
      persistConfig();
      for (const c of m.cards.filter((x) => x.column === col.id)) deleteCard(c.id);
    };
    const shiftColumn = (col, dir) => {
      const idx = model.columns.findIndex((c) => c.id === col.id);
      const to = idx + dir;
      if (to < 0 || to >= model.columns.length) return;
      const next = [...model.columns];
      const [item] = next.splice(idx, 1);
      next.splice(to, 0, item);
      setModel({ columns: next });
      persistConfig();
    };

    // ── Editor de tarjeta ─────────────────────────────────────────────────
    const openNew = (colId) => setEditing({
      isNew: true,
      card: { id: '', name: '', description: '', column: colId,
        startAt: new Date().toISOString(), endAt: new Date().toISOString(),
        owner: undefined, entityIds: [], extra: {} },
    });
    const openEdit = (card) => setEditing({ isNew: false, card: JSON.parse(JSON.stringify(card)) });
    const saveEditor = async () => {
      const c = editing.card;
      if (!s(c.name).trim()) { shell.notify({ level: 'warn', text: 'La tarjeta necesita un nombre.' }); return; }
      if (editing.isNew) await createCard(c);
      else await updateCard(c.id, c);
      setEditing(null);
    };

    if (!m.loaded) return h('div', { className: 'kimos-kanban' }, h('div', { className: 'kk-empty' }, 'Cargando…'));
    if (m.error) return h('div', { className: 'kimos-kanban' }, h('div', { className: 'kk-empty' }, m.error));

    return h('div', { className: 'kimos-kanban' },
      // Toolbar
      h('div', { className: 'kk-toolbar' },
        h('input', { className: 'kk-search', placeholder: 'Buscar tarjetas…', value: search, onChange: (e) => setSearch(e.target.value) }),
        ownersInUse.length > 0 && h('select', {
          className: 'kk-select', value: filterOwner || '',
          onChange: (e) => setFilterOwner(e.target.value || null),
        },
          h('option', { value: '' }, 'Responsable: todos'),
          ownersInUse.map((o) => h('option', { key: o.id, value: o.id }, o.name)),
        ),
        enabledEntities.length > 0 && h('select', {
          className: 'kk-select', value: filterEntity || '',
          onChange: (e) => setFilterEntity(e.target.value || null),
        },
          h('option', { value: '' }, 'Atributo: todos'),
          enabledEntities.map((e2) => h('option', { key: e2.id, value: e2.id }, e2.name)),
        ),
        h('div', { className: 'kk-spacer' }),
        m.isAdmin && h('button', { className: 'kk-btn', onClick: () => setManageCols(!manageCols) },
          manageCols ? 'Cerrar columnas' : 'Columnas'),
      ),

      // Gestión de columnas (solo admins)
      manageCols && m.isAdmin && h('div', { className: 'kk-colmgr' },
        m.columns.map((col, i) => h('div', { key: col.id, className: 'kk-colmgr-row' },
          h('input', { type: 'color', value: col.color || '#64748b', onChange: (e) => recolorColumn(col, e.target.value), title: 'Color' }),
          h('span', { className: 'kk-colmgr-name' }, col.name),
          h('button', { className: 'kk-mini', disabled: i === 0, onClick: () => shiftColumn(col, -1), title: 'Mover a la izquierda' }, '←'),
          h('button', { className: 'kk-mini', disabled: i === m.columns.length - 1, onClick: () => shiftColumn(col, 1), title: 'Mover a la derecha' }, '→'),
          h('button', { className: 'kk-mini', onClick: () => renameColumn(col), title: 'Renombrar' }, '✎'),
          h('button', { className: 'kk-mini kk-danger', onClick: () => removeColumn(col), title: 'Eliminar' }, '🗑'),
        )),
        h('div', { className: 'kk-colmgr-actions' },
          h('button', { className: 'kk-btn', onClick: addColumn }, '+ Columna'),
          h('label', { className: 'kk-lock' },
            h('input', { type: 'checkbox', checked: m.columnsLocked,
              onChange: (e) => { setModel({ columnsLocked: e.target.checked }); persistConfig(); } }),
            ' Bloquear columnas'),
        ),
      ),

      // Tablero
      h('div', { className: 'kk-board' },
        m.columns.map((col) => {
          const colCards = visibleCards
            .filter((c) => c.column === col.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          return h('div', { key: col.id, className: 'kk-col' },
            h('div', { className: 'kk-col-head' },
              h('span', { className: 'kk-dot', style: { background: col.color || '#64748b' } }),
              h('span', { className: 'kk-col-name' }, col.name),
              h('span', { className: 'kk-col-count' }, String(colCards.length)),
              h('button', { className: 'kk-mini', title: 'Añadir tarjeta', onClick: () => openNew(col.id) }, '+'),
            ),
            h('div', {
              className: 'kk-col-body',
              onDragOver: (e) => onColDragOver(e, col.id),
              onDrop: (e) => onColDrop(e, col.id),
            },
              colCards.map((card, i) => {
                const hintHere = dropHint && dropHint.col === col.id && dropHint.index === i;
                return h(React.Fragment, { key: card.id },
                  hintHere && h('div', { className: 'kk-drophint' }),
                  h('div', {
                    className: 'kk-card', draggable: true, 'data-card-id': card.id,
                    onDragStart: (e) => onCardDragStart(e, card),
                    onDragEnd,
                    onClick: () => openEdit(card),
                  },
                    h('div', { className: 'kk-card-name' }, card.name),
                    s(card.description) && h('div', { className: 'kk-card-desc' }, card.description),
                    h('div', { className: 'kk-card-meta' },
                      (card.entityIds || []).slice(0, 3).map((eid) => {
                        const ent = entityById.get(eid);
                        return ent ? h('span', { key: eid, className: 'kk-tag', style: { borderColor: ent.color } },
                          h('span', { className: 'kk-tag-dot', style: { background: ent.color } }), ent.name) : null;
                      }),
                      s(card.endAt) && h('span', { className: 'kk-date' }, fmtDate(card.endAt)),
                      card.owner && card.owner.name && h('span', { className: 'kk-owner', title: card.owner.name },
                        s(card.owner.name).trim().charAt(0).toUpperCase()),
                    ),
                  ),
                );
              }),
              dropHint && dropHint.col === col.id && dropHint.index >= colCards.length &&
                h('div', { className: 'kk-drophint' }),
              colCards.length === 0 && !dropHint && h('div', { className: 'kk-col-empty' }, 'Sin tarjetas'),
            ),
          );
        }),
      ),

      // Editor de tarjeta
      editing && h('div', { className: 'kk-overlay' },
        h('button', { className: 'kk-overlay-bg', onClick: () => setEditing(null), 'aria-label': 'Cerrar' }),
        h('div', { className: 'kk-panel' },
          h('div', { className: 'kk-panel-head' },
            h('span', { className: 'kk-panel-title' }, editing.isNew ? 'Nueva tarjeta' : 'Editar tarjeta'),
            !editing.isNew && h('button', { className: 'kk-mini kk-danger', title: 'Eliminar',
              onClick: () => { deleteCard(editing.card.id); setEditing(null); } }, '🗑'),
            h('button', { className: 'kk-mini', onClick: () => setEditing(null) }, '✕'),
          ),
          h('div', { className: 'kk-panel-body' },
            h('label', { className: 'kk-label' }, 'Nombre',
              h('input', { className: 'kk-input', value: editing.card.name, autoFocus: true,
                onChange: (e) => setEditing({ ...editing, card: { ...editing.card, name: e.target.value } }) })),
            h('label', { className: 'kk-label' }, 'Descripción',
              h('textarea', { className: 'kk-input', rows: 3, value: s(editing.card.description),
                onChange: (e) => setEditing({ ...editing, card: { ...editing.card, description: e.target.value } }) })),
            h('div', { className: 'kk-row' },
              h('label', { className: 'kk-label' }, 'Inicio',
                h('input', { className: 'kk-input', type: 'date', value: toDateInput(editing.card.startAt),
                  onChange: (e) => setEditing({ ...editing, card: { ...editing.card, startAt: fromDateInput(e.target.value) } }) })),
              h('label', { className: 'kk-label' }, 'Término',
                h('input', { className: 'kk-input', type: 'date', value: toDateInput(editing.card.endAt),
                  onChange: (e) => setEditing({ ...editing, card: { ...editing.card, endAt: fromDateInput(e.target.value) } }) })),
            ),
            h('div', { className: 'kk-row' },
              h('label', { className: 'kk-label' }, 'Columna',
                h('select', { className: 'kk-input', value: editing.card.column,
                  onChange: (e) => setEditing({ ...editing, card: { ...editing.card, column: e.target.value } }) },
                  m.columns.map((c) => h('option', { key: c.id, value: c.id }, c.name)))),
              h('label', { className: 'kk-label' }, 'Responsable',
                h('select', { className: 'kk-input', value: (editing.card.owner && editing.card.owner.id) || '',
                  onChange: (e) => {
                    const member = m.members.find((x) => x.id === e.target.value);
                    setEditing({ ...editing, card: { ...editing.card, owner: member ? { id: member.id, name: member.name } : undefined } });
                  } },
                  h('option', { value: '' }, 'Sin asignar'),
                  m.members.map((x) => h('option', { key: x.id, value: x.id }, x.name)))),
            ),
            enabledTypes.map((type) => {
              const typeEntities = enabledEntities.filter((e2) => e2.typeId === type.id);
              if (!typeEntities.length) return null;
              return h('div', { key: type.id, className: 'kk-label' }, type.name,
                h('div', { className: 'kk-entpick' }, typeEntities.map((ent) => {
                  const active = (editing.card.entityIds || []).includes(ent.id);
                  return h('button', {
                    key: ent.id, type: 'button',
                    className: 'kk-tag kk-tag-btn' + (active ? ' kk-tag-active' : ''),
                    style: { borderColor: ent.color },
                    onClick: () => {
                      const cur = new Set(editing.card.entityIds || []);
                      if (active) cur.delete(ent.id); else cur.add(ent.id);
                      setEditing({ ...editing, card: { ...editing.card, entityIds: Array.from(cur) } });
                    },
                  }, h('span', { className: 'kk-tag-dot', style: { background: ent.color } }), ent.name);
                })));
            }),
            (m.extraFields || []).map((f) => h('label', { key: f.id, className: 'kk-label' }, f.name,
              h('input', { className: 'kk-input',
                value: s((editing.card.extra || {})[f.id]),
                placeholder: f.placeholder || f.name,
                onChange: (e) => setEditing({ ...editing, card: { ...editing.card,
                  extra: Object.assign({}, editing.card.extra, { [f.id]: e.target.value }) } }) }))),
          ),
          h('div', { className: 'kk-panel-foot' },
            h('button', { className: 'kk-btn', onClick: () => setEditing(null) }, 'Cancelar'),
            h('button', { className: 'kk-btn kk-btn-primary', onClick: saveEditor }, editing.isNew ? 'Crear' : 'Guardar'),
          ),
        ),
      ),
    );
  }

  return {
    Component,
    unmount() { if (offAgent) offAgent(); listeners.clear(); },
  };
}
