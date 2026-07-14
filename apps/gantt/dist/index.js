/**
 * Planificación (Gantt) — app oficial instalable (v3.0, bundle real).
 *
 * Migración 1:1 de la app del producto al contrato AppShell. COMPATIBLE con
 * las instancias existentes:
 *   - Items = planes: {id, name, shortName, owner, ownerId, teamMemberIds,
 *     objective, tasks[], color, progress}.
 *   - Tareas embebidas: {id, name, responsibleId/Name, periods: boolean[],
 *     progress 0-100, status, taskStartDate/EndDate, notes, entityIds, extra}.
 *   - Config de instancia: {periods, periodGranularity, periodsCount,
 *     planLabel, taskLabel, timelineStartDate, enabledEntityTypeIds, ...}.
 *
 * Funciones: pestañas por plan + dashboard de avance, línea temporal por
 * períodos (click para marcar/desmarcar), barra de progreso 25/50/75/100,
 * estados, responsables, editor de tarea (fechas, notas, entidades), ajustes
 * de períodos para admins y control por agente (shell.agent.register).
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

  const s = (v) => (v == null ? '' : String(v));
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const STATUS = [
    ['pending', 'Pendiente'], ['in_progress', 'En Curso'],
    ['completed', 'Completado'], ['blocked', 'Bloqueado'],
  ];
  const STATUS_CLASS = {
    pending: 'kg-st-pending', in_progress: 'kg-st-progress',
    completed: 'kg-st-done', blocked: 'kg-st-blocked',
  };
  const GRANULARITIES = [
    ['daily', 'Diaria'], ['weekly', 'Semanal'], ['biweekly', 'Quincenal'],
    ['monthly', 'Mensual'], ['quarterly', 'Trimestral'],
  ];

  function ymd(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
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

  // ── Estado del módulo (closure) ─────────────────────────────────────────
  let model = {
    gantts: [], periods: [], members: [], entityTypes: [], entities: [],
    enabledEntityTypeIds: [], rawConfig: {},
    planLabel: 'Plan', taskLabel: 'Tarea',
    granularity: 'weekly', periodsCount: 8, timelineStartDate: '',
    isAdmin: false, loaded: false, error: null,
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l({ ...model }));
  const setModel = (patch) => { model = Object.assign({}, model, patch); emit(); };

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
      await shell.authFetch(API + '/api/app-instances/' + instanceId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
    } catch (e) { shell.notify({ level: 'error', text: 'No se pudo guardar la configuración.' }); }
  }
  async function persistGantt(g) {
    try { await shell.items.update(g.id, g); }
    catch (e) { shell.notify({ level: 'error', text: 'No se pudo guardar el plan.' }); }
  }

  async function load() {
    try {
      const [items, instRes] = await Promise.all([
        shell.items.list(),
        shell.authFetch(API + '/api/app-instances/' + instanceId, { cache: 'no-store' }),
      ]);
      let config = {};
      if (instRes.ok) config = ((await instRes.json()) || {}).config || {};
      const periods = Array.isArray(config.periods) && config.periods.length
        ? config.periods
        : buildPeriods(config.periodGranularity || 'weekly', config.periodsCount || 8, config.timelineStartDate);
      const gantts = (items || [])
        .filter((it) => it && it.kind !== 'definition' && s(it.name))
        .map((g) => Object.assign({ tasks: [], teamMemberIds: [], color: '#3b82f6' }, g, {
          tasks: (g.tasks || []).map((t) => Object.assign({ periods: [], progress: 0, status: 'pending' }, t, {
            // Normalizar largo de periods al timeline actual.
            periods: periods.map((_, i) => !!(t.periods || [])[i]),
          })),
        }));
      setModel({
        gantts, periods, rawConfig: config,
        planLabel: s(config.planLabel) || 'Plan',
        taskLabel: s(config.taskLabel) || 'Tarea',
        granularity: s(config.periodGranularity) || 'weekly',
        periodsCount: Number(config.periodsCount) || periods.length,
        timelineStartDate: s(config.timelineStartDate),
        enabledEntityTypeIds: config.enabledEntityTypeIds || [],
        loaded: true, error: null,
      });
    } catch (e) {
      setModel({ loaded: true, error: (e && e.message) || 'No se pudo cargar.' });
    }
    try {
      const res = await shell.authFetch(API + '/api/identity/actors', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({ members: (data.actors || []).filter((a) => a && a.active !== false)
          .map((a) => ({ id: a.id, name: a.displayName || a.name || a.email || a.id })) });
      }
    } catch (e) { /* opcional */ }
    try {
      const res = await shell.authFetch(API + '/api/entities', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({ entityTypes: data.entityTypes || [], entities: data.entities || [] });
      }
    } catch (e) { /* opcional */ }
    try {
      const res = await shell.authFetch(API + '/api/identity/me', { cache: 'no-store' });
      if (res.ok) {
        const me = await res.json();
        setModel({ isAdmin: me.role === 'superadmin' || (teamId && me.team_roles && me.team_roles[teamId] === 'admin') });
      }
    } catch (e) { /* opcional */ }
  }

  // ── Mutaciones (UI + agente) ────────────────────────────────────────────
  function findGantt(idOrName) {
    const needle = s(idOrName).trim().toLowerCase();
    return model.gantts.find((g) => g.id === idOrName)
      || model.gantts.find((g) => s(g.name).toLowerCase() === needle || s(g.shortName).toLowerCase() === needle);
  }
  function findTask(g, idOrName) {
    const needle = s(idOrName).trim().toLowerCase();
    return (g.tasks || []).find((t) => t.id === idOrName)
      || (g.tasks || []).find((t) => s(t.name).toLowerCase() === needle);
  }
  function replaceGantt(next) {
    next.progress = ganttProgress(next);
    setModel({ gantts: model.gantts.map((g) => (g.id === next.id ? next : g)) });
    persistGantt(next);
  }

  async function addGantt(fields) {
    const g = {
      id: uid('gantt'),
      name: s(fields.name).trim() || 'Nuevo plan',
      shortName: (s(fields.shortName).trim() || s(fields.name).trim() || 'Plan').slice(0, 24),
      objective: s(fields.objective) || '',
      owner: s(fields.owner) || 'Sin asignar',
      ownerId: s(fields.ownerId) || '',
      teamMemberIds: fields.ownerId ? [fields.ownerId] : [],
      color: 'hsl(' + Math.floor(Math.random() * 360) + ', 60%, 45%)',
      progress: 0,
      tasks: [],
    };
    setModel({ gantts: [...model.gantts, g] });
    try { await shell.items.create(g); }
    catch (e) { return { success: false, error: 'No se pudo crear el plan.' }; }
    return { success: true, message: 'Plan "' + g.name + '" creado.', ganttId: g.id };
  }

  async function deleteGantt(idOrName) {
    const g = findGantt(idOrName);
    if (!g) return { success: false, error: 'Plan no encontrado.' };
    setModel({ gantts: model.gantts.filter((x) => x.id !== g.id) });
    try { await shell.items.remove(g.id); }
    catch (e) { return { success: false, error: 'No se pudo eliminar.' }; }
    return { success: true, message: 'Plan "' + g.name + '" eliminado.' };
  }

  function addTask(ganttRef, fields) {
    const g = findGantt(ganttRef);
    if (!g) return { success: false, error: 'Plan no encontrado.' };
    const member = fields.responsibleId ? model.members.find((m) => m.id === fields.responsibleId) : null;
    const task = {
      id: uid('task'),
      name: s(fields.name).trim() || 'Nueva tarea',
      responsibleId: member ? member.id : '',
      responsibleName: member ? member.name : s(fields.responsibleName) || '',
      periods: model.periods.map(() => false),
      progress: 0, status: 'pending',
      notes: s(fields.notes) || '', entityIds: [], extra: {},
    };
    replaceGantt(Object.assign({}, g, { tasks: [...(g.tasks || []), task] }));
    return { success: true, message: 'Tarea "' + task.name + '" añadida a ' + g.name + '.', taskId: task.id };
  }

  function updateTask(ganttRef, taskRef, patch) {
    const g = findGantt(ganttRef);
    if (!g) return { success: false, error: 'Plan no encontrado.' };
    const t = findTask(g, taskRef);
    if (!t) return { success: false, error: 'Tarea no encontrada.' };
    const nextTask = Object.assign({}, t, patch);
    replaceGantt(Object.assign({}, g, {
      tasks: g.tasks.map((x) => (x.id === t.id ? nextTask : x)),
    }));
    return { success: true, message: 'Tarea actualizada.' };
  }

  function deleteTask(ganttRef, taskRef) {
    const g = findGantt(ganttRef);
    if (!g) return { success: false, error: 'Plan no encontrado.' };
    const t = findTask(g, taskRef);
    if (!t) return { success: false, error: 'Tarea no encontrada.' };
    replaceGantt(Object.assign({}, g, { tasks: g.tasks.filter((x) => x.id !== t.id) }));
    return { success: true, message: 'Tarea "' + t.name + '" eliminada.' };
  }

  // ── Agente ──────────────────────────────────────────────────────────────
  const offAgent = shell.agent && shell.agent.register ? shell.agent.register({
    label: 'Planificación',
    description: 'Planes con tareas por períodos: crear planes/tareas, avance, estados y períodos.',
    tools: [
      { name: 'ADD_GANTT', description: 'Crea un plan.', inputSchema: { type: 'object', properties: {
        name: { type: 'string' }, objective: { type: 'string' }, ownerId: { type: 'string' } }, required: ['name'] } },
      { name: 'ADD_TASK', description: 'Añade una tarea a un plan (id o nombre).', inputSchema: { type: 'object', properties: {
        gantt: { type: 'string' }, name: { type: 'string' }, responsibleId: { type: 'string' } }, required: ['gantt', 'name'] } },
      { name: 'UPDATE_TASK_PROGRESS', description: 'Avance 0-100 de una tarea.', inputSchema: { type: 'object', properties: {
        gantt: { type: 'string' }, task: { type: 'string' }, progress: { type: 'number' } }, required: ['gantt', 'task', 'progress'] } },
      { name: 'UPDATE_TASK_STATUS', description: 'Estado: pending|in_progress|completed|blocked.', inputSchema: { type: 'object', properties: {
        gantt: { type: 'string' }, task: { type: 'string' }, status: { type: 'string' } }, required: ['gantt', 'task', 'status'] } },
      { name: 'SET_TASK_PERIOD', description: 'Marca/desmarca un período (índice desde 0) de una tarea.', inputSchema: { type: 'object', properties: {
        gantt: { type: 'string' }, task: { type: 'string' }, period: { type: 'number' }, active: { type: 'boolean' } }, required: ['gantt', 'task', 'period'] } },
      { name: 'DELETE_TASK', description: 'Elimina una tarea.', inputSchema: { type: 'object', properties: {
        gantt: { type: 'string' }, task: { type: 'string' } }, required: ['gantt', 'task'] } },
      { name: 'DELETE_GANTT', description: 'Elimina un plan completo.', inputSchema: { type: 'object', properties: {
        gantt: { type: 'string' } }, required: ['gantt'] } },
    ],
    getSnapshot: () => ({
      periods: model.periods.map((p) => p.shortName),
      plans: model.gantts.map((g) => ({
        id: g.id, name: g.name, objective: g.objective, progress: ganttProgress(g),
        tasks: (g.tasks || []).map((t) => ({
          id: t.id, name: t.name, status: t.status, progress: t.progress,
          responsible: t.responsibleName || null,
          periods: (t.periods || []).map((b, i) => (b ? i : -1)).filter((i) => i >= 0),
        })),
      })),
    }),
    dispatchAction: async (action) => {
      const p = (action && action.payload) || {};
      switch (action.type) {
        case 'ADD_GANTT': {
          const member = p.ownerId ? model.members.find((m) => m.id === p.ownerId) : null;
          return addGantt({ name: p.name, objective: p.objective, ownerId: p.ownerId, owner: member ? member.name : '' });
        }
        case 'ADD_TASK': return addTask(p.gantt, { name: p.name, responsibleId: p.responsibleId });
        case 'UPDATE_TASK_PROGRESS': return updateTask(p.gantt, p.task, { progress: clamp(Number(p.progress) || 0, 0, 100) });
        case 'UPDATE_TASK_STATUS': {
          const ok = STATUS.some(([k]) => k === p.status);
          if (!ok) return { success: false, error: 'Estado inválido: ' + p.status };
          return updateTask(p.gantt, p.task, { status: p.status });
        }
        case 'SET_TASK_PERIOD': {
          const g = findGantt(p.gantt);
          const t = g && findTask(g, p.task);
          if (!t) return { success: false, error: 'Plan o tarea no encontrados.' };
          const idx = clamp(Math.round(Number(p.period) || 0), 0, model.periods.length - 1);
          const periods = model.periods.map((_, i) => (i === idx ? (p.active !== false) : !!(t.periods || [])[i]));
          return updateTask(p.gantt, p.task, { periods });
        }
        case 'DELETE_TASK': return deleteTask(p.gantt, p.task);
        case 'DELETE_GANTT': return deleteGantt(p.gantt);
        default: return { success: false, error: 'Acción desconocida: ' + action.type };
      }
    },
  }) : null;

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

  function Component() {
    const [m, setM] = useState({ ...model });
    useEffect(() => { listeners.add(setM); return () => listeners.delete(setM); }, []);
    useEffect(() => { load(); }, []);

    const [tab, setTab] = useState('');          // '' = dashboard
    const [filterOwner, setFilterOwner] = useState('');
    const [editTask, setEditTask] = useState(null); // {ganttId, task draft}
    const [showSettings, setShowSettings] = useState(false);
    const [newPlan, setNewPlan] = useState(null);   // {name, objective, ownerId}

    const active = m.gantts.find((g) => g.id === tab) || null;
    const enabledTypes = useMemo(
      () => (m.entityTypes || []).filter((t) => (m.enabledEntityTypeIds || []).includes(t.id)),
      [m.entityTypes, m.enabledEntityTypeIds],
    );
    const enabledEntities = useMemo(() => {
      const ids = new Set(enabledTypes.map((t) => t.id));
      return (m.entities || []).filter((e) => ids.has(e.typeId));
    }, [m.entities, enabledTypes]);

    if (!m.loaded) return h('div', { className: 'kimos-gantt' }, h('div', { className: 'kg-empty' }, 'Cargando…'));
    if (m.error) return h('div', { className: 'kimos-gantt' }, h('div', { className: 'kg-empty' }, m.error));

    const visibleTasks = (g) => (g.tasks || [])
      .filter((t) => !filterOwner || t.responsibleId === filterOwner);

    return h('div', { className: 'kimos-gantt' },
      // Tabs de planes
      h('div', { className: 'kg-tabs' },
        h('button', { className: 'kg-tab' + (tab === '' ? ' kg-tab-active' : ''), onClick: () => setTab('') }, 'Resumen'),
        m.gantts.map((g) => h('button', {
          key: g.id,
          className: 'kg-tab' + (tab === g.id ? ' kg-tab-active' : ''),
          style: tab === g.id ? { borderBottomColor: g.color } : undefined,
          onClick: () => setTab(g.id),
        }, g.shortName || g.name)),
        h('button', { className: 'kg-tab kg-tab-new', onClick: () => setNewPlan({ name: '', objective: '', ownerId: '' }) },
          '+ ' + m.planLabel),
        h('span', { className: 'kg-spacer' }),
        m.members.length > 0 && h('select', {
          className: 'kg-select', value: filterOwner, onChange: (e) => setFilterOwner(e.target.value),
        },
          h('option', { value: '' }, 'Responsable: todos'),
          m.members.map((x) => h('option', { key: x.id, value: x.id }, x.name))),
        m.isAdmin && h('button', { className: 'kg-btn', onClick: () => setShowSettings(!showSettings) }, '⚙'),
      ),

      // Ajustes de períodos (admins)
      showSettings && m.isAdmin && h('div', { className: 'kg-settings' },
        h('label', { className: 'kg-label' }, 'Granularidad',
          h('select', { className: 'kg-input', value: m.granularity,
            onChange: (e) => setModel({ granularity: e.target.value }) },
            GRANULARITIES.map(([k, l]) => h('option', { key: k, value: k }, l)))),
        h('label', { className: 'kg-label' }, 'Períodos',
          h('input', { className: 'kg-input', type: 'number', min: 1, max: 90, value: m.periodsCount,
            onChange: (e) => setModel({ periodsCount: Number(e.target.value) || 8 }) })),
        h('label', { className: 'kg-label' }, 'Inicio',
          h('input', { className: 'kg-input', type: 'date', value: m.timelineStartDate,
            onChange: (e) => setModel({ timelineStartDate: e.target.value }) })),
        h('button', { className: 'kg-btn kg-btn-primary', onClick: () => {
          const periods = buildPeriods(model.granularity, model.periodsCount, model.timelineStartDate);
          // Reajustar el largo de periods de TODAS las tareas al nuevo timeline.
          const gantts = model.gantts.map((g) => Object.assign({}, g, {
            tasks: (g.tasks || []).map((t) => Object.assign({}, t, {
              periods: periods.map((_, i) => !!(t.periods || [])[i]),
            })),
          }));
          setModel({ periods, gantts });
          persistConfig();
          for (const g of gantts) persistGantt(g);
          setShowSettings(false);
        } }, 'Regenerar línea temporal'),
      ),

      // Contenido
      tab === '' || !active
        ? // Dashboard
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
              return h('div', { key: g.id, className: 'kg-card', onClick: () => setTab(g.id) },
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
                  s(g.owner) && h('span', { className: 'kg-owner' }, g.owner),
                ),
              );
            }),
          )
        : // Vista del plan: línea temporal
          h('div', { className: 'kg-planview' },
            h('div', { className: 'kg-plan-head' },
              h('span', { className: 'kg-dot', style: { background: active.color } }),
              h('div', { className: 'kg-plan-titles' },
                h('div', { className: 'kg-plan-name' }, active.name),
                s(active.objective) && h('div', { className: 'kg-plan-obj' }, active.objective),
              ),
              h('span', { className: 'kg-card-prog' }, ganttProgress(active) + '%'),
              h('button', { className: 'kg-mini', title: 'Renombrar', onClick: () => {
                const name = window.prompt('Nombre del ' + m.planLabel.toLowerCase() + ':', active.name);
                if (name && name.trim()) replaceGantt(Object.assign({}, active, { name: name.trim(), shortName: name.trim().slice(0, 24) }));
              } }, '✎'),
              h('button', { className: 'kg-mini kg-danger', title: 'Eliminar plan', onClick: () => {
                if (window.confirm('¿Eliminar "' + active.name + '" y sus ' + (active.tasks || []).length + ' tarea(s)?')) {
                  deleteGantt(active.id); setTab('');
                }
              } }, '🗑'),
            ),
            h('div', { className: 'kg-timeline-wrap' },
              h('table', { className: 'kg-timeline' },
                h('thead', null, h('tr', null,
                  h('th', { className: 'kg-th-task' }, m.taskLabel),
                  h('th', null, 'Responsable'),
                  h('th', null, 'Estado'),
                  h('th', null, 'Avance'),
                  m.periods.map((p) => h('th', { key: p.id, className: 'kg-th-period', title: p.startDate + ' → ' + p.endDate }, p.shortName)),
                  h('th', null, ''),
                )),
                h('tbody', null,
                  visibleTasks(active).map((t) => h('tr', { key: t.id, className: t.status === 'blocked' ? 'kg-row-blocked' : '' },
                    h('td', { className: 'kg-td-task' },
                      h('button', { className: 'kg-taskname', title: 'Editar tarea',
                        onClick: () => setEditTask({ ganttId: active.id, task: JSON.parse(JSON.stringify(t)) }) }, t.name),
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
                    m.periods.map((p, i) => h('td', {
                      key: p.id,
                      className: 'kg-cell' + ((t.periods || [])[i] ? ' kg-cell-on' : ''),
                      style: (t.periods || [])[i] ? { background: active.color } : undefined,
                      onClick: () => {
                        const periods = m.periods.map((_, j) => (j === i ? !(t.periods || [])[i] : !!(t.periods || [])[j]));
                        updateTask(active.id, t.id, { periods });
                      },
                    })),
                    h('td', null, h('button', { className: 'kg-mini kg-danger', title: 'Eliminar tarea',
                      onClick: () => { if (window.confirm('¿Eliminar "' + t.name + '"?')) deleteTask(active.id, t.id); } }, '🗑')),
                  )),
                  h('tr', null, h('td', { colSpan: 5 + m.periods.length, className: 'kg-td-add' },
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
            h('label', { className: 'kg-label' }, 'Objetivo',
              h('textarea', { className: 'kg-input', rows: 2, value: newPlan.objective,
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
              const member = m.members.find((x) => x.id === newPlan.ownerId);
              const res = await addGantt({ name: newPlan.name, objective: newPlan.objective,
                ownerId: newPlan.ownerId, owner: member ? member.name : '' });
              setNewPlan(null);
              if (res.ganttId) setTab(res.ganttId);
            } }, 'Crear')),
        ),
      ),

      // Panel: editar tarea (fechas, notas, entidades)
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
              h('label', { className: 'kg-label' }, 'Inicio real',
                h('input', { className: 'kg-input', type: 'date', value: s(editTask.task.taskStartDate),
                  onChange: (e) => setEditTask({ ...editTask, task: { ...editTask.task, taskStartDate: e.target.value } }) })),
              h('label', { className: 'kg-label' }, 'Fin real',
                h('input', { className: 'kg-input', type: 'date', value: s(editTask.task.taskEndDate),
                  onChange: (e) => setEditTask({ ...editTask, task: { ...editTask.task, taskEndDate: e.target.value } }) }))),
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
              updateTask(editTask.ganttId, editTask.task.id, editTask.task);
              setEditTask(null);
            } }, 'Guardar')),
        ),
      ),
    );
  }

  return {
    Component,
    unmount() { if (offAgent) offAgent(); listeners.clear(); },
  };
}
