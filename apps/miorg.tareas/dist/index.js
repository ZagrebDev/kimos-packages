/**
 * Tareas del Equipo — app de EJEMPLO de terceros con la superficie COMPLETA
 * del AppShell v1. Escrita sin minificar y comentada para servir de plantilla.
 *
 * Qué demuestra (y dónde buscarlo en este archivo):
 *   1. Persistencia por DOCUMENTO: `shell.saveData` / `shell.loadData` con
 *      debounce (patrón Kanban/FossFLOW).                     → save(), load()
 *   2. Parámetros ⚙️ Configurar: `configSchema` en el manifest + lectura con
 *      `shell.config.get()` / `.onChange()`.                  → initConfig()
 *   3. Menú 🗂️ Documentos (Guardar versión / Historial):
 *      `shell.documents.onSerialize` / `.onLoad`.             → initDocuments()
 *   4. Agente IA: `shell.agent.register` con tools, snapshot y validación de
 *      inputs (permiso agent.control).                        → initAgent()
 *   5. Datos de OTRA app: `shell.data.listInstances/listItems` con permiso
 *      data.read:miorg.encuestas (degrada con gracia si la otra app no está
 *      instalada o el permiso no fue concedido).              → EncuestasTab
 *   6. La versión SIEMPRE a la vista (APP_VERSION en la cabecera y en el
 *      snapshot del agente) — regla §7.a de APP-SPEC.md.
 *
 * Reglas de oro que este archivo respeta (APP-SPEC.md §3):
 *   - React del host (`globalThis.React`), sin JSX, sin dependencias runtime.
 *   - Estado DENTRO de mount() (closure): una copia por ventana.
 *   - CSS con clase raíz `.miorg-tareas`; la raíz ocupa 100% sin desbordar.
 *   - unmount() limpia timers, listeners, config y agente.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  // Mantener en sincronía con manifest.json (regla §7.a de APP-SPEC.md).
  const APP_VERSION = '1.0.0';
  const instanceId = shell.app && shell.app.instanceId;

  // ── 1. Estado + persistencia por documento ────────────────────────────────
  // Un único objeto modelo en el closure. Cada mutación pasa por commit(),
  // que notifica a la UI y agenda un saveData() con debounce.
  let model = { tasks: [] }; // tasks: [{ id, text, done, updatedAt }]
  let settings = { showDone: true, accent: '#19ACB1', maxTasks: 50 };
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l(snapshotState()); };
  function snapshotState() { return { model, settings }; }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      // saveData persiste el documento de ESTA instancia (blob JSON).
      shell.saveData(model).catch(() => {
        shell.notify({ level: 'error', text: 'No se pudo guardar. Reintenta.' });
      });
    }, 600);
  }
  function commit(next) { model = next; emit(); scheduleSave(); }

  async function load() {
    try {
      const data = await shell.loadData();
      if (data && Array.isArray(data.tasks)) model = { ...model, ...data };
    } catch (e) { /* primera apertura: no hay documento aún */ }
    emit();
  }

  // ── Mutaciones (las usan LA UI y EL AGENTE por igual: la ventana se repinta
  //    sola cuando el agente actúa porque ambos pasan por commit()) ──────────
  function addTask(text) {
    const clean = String(text || '').trim().slice(0, 500);
    if (!clean) return { success: false, error: 'La tarea no puede estar vacía.' };
    if (model.tasks.length >= (Number(settings.maxTasks) || 50)) {
      return { success: false, error: 'Se alcanzó el máximo de tareas (' + settings.maxTasks + '). Ajústalo en ⚙️ Configurar.' };
    }
    const task = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: clean, done: false, updatedAt: new Date().toISOString() };
    commit({ ...model, tasks: [...model.tasks, task] });
    return { success: true, message: 'Tarea añadida.', id: task.id };
  }
  function setDone(id, done) {
    const idx = model.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return { success: false, error: 'No existe la tarea ' + id + '.' };
    const tasks = model.tasks.slice();
    tasks[idx] = { ...tasks[idx], done: !!done, updatedAt: new Date().toISOString() };
    commit({ ...model, tasks });
    return { success: true, message: done ? 'Tarea completada.' : 'Tarea reabierta.' };
  }
  function removeTask(id) {
    if (!model.tasks.some((t) => t.id === id)) return { success: false, error: 'No existe la tarea ' + id + '.' };
    commit({ ...model, tasks: model.tasks.filter((t) => t.id !== id) });
    return { success: true, message: 'Tarea eliminada.' };
  }

  // ── 2. Parámetros ⚙️ Configurar (shell.config) ────────────────────────────
  // El host genera el formulario desde configSchema y persiste los valores;
  // aquí solo se leen y se reacciona a los cambios.
  let offConfig = null;
  async function initConfig() {
    if (!(shell.config && shell.config.get)) return; // host sin soporte: valores por defecto
    try {
      const s = await shell.config.get();
      if (s && typeof s === 'object') settings = { ...settings, ...s };
      emit();
      offConfig = shell.config.onChange((next) => {
        settings = { ...settings, ...(next || {}) };
        emit();
      });
    } catch (e) { /* sin config guardada aún */ }
  }

  // ── 3. Versiones 🗂️ (shell.documents) ─────────────────────────────────────
  // "Guardar versión" captura lo que devuelva onSerialize; "Restaurar" entrega
  // ese mismo objeto a onLoad.
  function initDocuments() {
    if (!shell.documents) return;
    shell.documents.onSerialize(() => ({ model }));
    shell.documents.onLoad((doc) => {
      if (doc && doc.model && Array.isArray(doc.model.tasks)) {
        model = doc.model;
        emit();
        scheduleSave();
      }
    });
  }

  // ── 4. Agente IA (shell.agent) ────────────────────────────────────────────
  // El agente de la empresa ve getSnapshot() y despacha acciones que pasan por
  // LAS MISMAS funciones que la UI. Valida todo input: puede venir fuera de rango.
  let offAgent = null;
  function initAgent() {
    if (!(shell.agent && shell.agent.register)) return;
    offAgent = shell.agent.register({
      label: 'Tareas del Equipo',
      description: 'Lista de tareas del documento abierto: añadir, completar y eliminar tareas.',
      tools: [
        { name: 'ADD_TASK', description: 'Añade una tarea a la lista.',
          inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Texto de la tarea.' } }, required: ['text'] } },
        { name: 'COMPLETE_TASK', description: 'Marca una tarea como completada (o la reabre con done=false).',
          inputSchema: { type: 'object', properties: { id: { type: 'string' }, done: { type: 'boolean' } }, required: ['id'] } },
        { name: 'REMOVE_TASK', description: 'Elimina una tarea.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      ],
      // El snapshot incluye los IDs (el agente los necesita para actuar) y la
      // versión del build (así puede responder qué versión corre).
      getSnapshot: () => ({
        version: APP_VERSION,
        tasks: model.tasks.map((t) => ({ id: t.id, text: t.text, done: t.done })),
      }),
      dispatchAction: async (action) => {
        const { type, payload } = action || {};
        const p = payload && typeof payload === 'object' ? payload : {};
        if (type === 'ADD_TASK') return addTask(p.text);
        if (type === 'COMPLETE_TASK') return setDone(String(p.id || ''), p.done !== false);
        if (type === 'REMOVE_TASK') return removeTask(String(p.id || ''));
        return { success: false, error: 'Acción desconocida: ' + String(type) };
      },
    });
  }

  // ── 5. Datos de OTRA app (shell.data) ─────────────────────────────────────
  // Requiere el permiso data.read:miorg.encuestas del manifest (el superadmin
  // lo ve y aprueba al instalar). El RBAC del usuario es siempre el techo.
  // Degrada con gracia: si la otra app no está o el permiso fue denegado,
  // la pestaña lo explica en vez de romper.
  async function loadEncuestas() {
    if (!(shell.data && shell.data.listInstances)) {
      return { error: 'Este host no expone shell.data.' };
    }
    try {
      const instances = await shell.data.listInstances('miorg.encuestas');
      const rows = [];
      for (const inst of (instances || []).slice(0, 10)) {
        let total = 0;
        try {
          const items = await shell.data.listItems(inst.id);
          total = (items || []).filter((i) => i && i.kind === 'submission').length;
        } catch (e) { /* instancia sin acceso: se omite el conteo */ }
        rows.push({ id: inst.id, name: inst.name || inst.id, respuestas: total });
      }
      return { rows };
    } catch (e) {
      return { error: 'Sin acceso a los datos de miorg.encuestas (¿está instalada? ¿se aprobó el permiso data.read?).' };
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  function TareasTab({ state }) {
    const [draft, setDraft] = useState('');
    const tasks = state.settings.showDone ? state.model.tasks : state.model.tasks.filter((t) => !t.done);
    const submit = () => {
      const r = addTask(draft);
      if (r.success) setDraft('');
      else shell.notify({ level: 'warn', text: r.error });
    };
    return h('div', { className: 'ta-list-wrap' }, [
      h('div', { key: 'new', className: 'ta-new' }, [
        h('input', {
          key: 'i', className: 'ta-input', placeholder: 'Nueva tarea…', value: draft,
          onChange: (e) => setDraft(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter') submit(); },
        }),
        h('button', { key: 'b', className: 'ta-btn ta-btn-primary', onClick: submit }, 'Añadir'),
      ]),
      tasks.length === 0
        ? h('div', { key: 'e', className: 'ta-muted' }, 'Sin tareas. Añade una, o pídeselo al agente IA.')
        : h('div', { key: 'l', className: 'ta-list' }, tasks.map((t) => h('div', { key: t.id, className: 'ta-item' + (t.done ? ' ta-item-done' : '') }, [
            h('label', { key: 'l', className: 'ta-item-label' }, [
              h('input', { key: 'c', type: 'checkbox', checked: !!t.done, onChange: (e) => setDone(t.id, e.target.checked) }),
              h('span', { key: 't', className: 'ta-item-text' }, t.text),
            ]),
            h('button', { key: 'x', className: 'ta-btn ta-btn-danger', title: 'Eliminar', onClick: () => removeTask(t.id) }, '✕'),
          ]))),
    ]);
  }

  function EncuestasTab() {
    const [data, setData] = useState(null);
    useEffect(() => { let on = true; loadEncuestas().then((d) => { if (on) setData(d); }); return () => { on = false; }; }, []);
    if (!data) return h('div', { className: 'ta-muted' }, 'Cargando…');
    if (data.error) return h('div', { className: 'ta-muted' }, data.error);
    if (!data.rows.length) return h('div', { className: 'ta-muted' }, 'No hay encuestas visibles para tu usuario.');
    return h('div', { className: 'ta-list' }, data.rows.map((r) => h('div', { key: r.id, className: 'ta-item' }, [
      h('span', { key: 'n', className: 'ta-item-text' }, '📊 ' + r.name),
      h('span', { key: 'c', className: 'ta-count' }, r.respuestas + ' respuestas'),
    ])));
  }

  function Component() {
    const [state, setState] = useState(snapshotState());
    const [tab, setTab] = useState('tareas');
    useEffect(() => { listeners.add(setState); return () => listeners.delete(setState); }, []);

    if (!instanceId) {
      return h('div', { className: 'miorg-tareas' },
        h('div', { className: 'ta-empty' }, 'Crea un documento desde la pantalla de bienvenida: cada uno es una lista de tareas distinta.'));
    }

    const pending = state.model.tasks.filter((t) => !t.done).length;
    return h('div', { className: 'miorg-tareas', style: { '--ta-accent-user': state.settings.accent } }, [
      h('div', { key: 'head', className: 'ta-head' }, [
        h('div', { key: 't', className: 'ta-title' }, [
          '✅ Tareas del Equipo ',
          h('span', { key: 'v', className: 'ta-ver', title: 'Tareas del Equipo v' + APP_VERSION }, 'v' + APP_VERSION),
        ]),
        h('span', { key: 'p', className: 'ta-count' }, pending + ' pendientes'),
        h('div', { key: 'tabs', className: 'ta-tabs' }, [
          h('button', { key: '1', className: 'ta-tab' + (tab === 'tareas' ? ' ta-tab-active' : ''), onClick: () => setTab('tareas') }, 'Tareas'),
          h('button', { key: '2', className: 'ta-tab' + (tab === 'encuestas' ? ' ta-tab-active' : ''), onClick: () => setTab('encuestas') }, 'Encuestas'),
        ]),
      ]),
      h('div', { key: 'body', className: 'ta-body' },
        tab === 'tareas' ? h(TareasTab, { state }) : h(EncuestasTab)),
    ]);
  }

  // ── Arranque ──────────────────────────────────────────────────────────────
  void load();
  void initConfig();
  initDocuments();
  initAgent();

  return {
    Component,
    unmount() {
      clearTimeout(saveTimer);
      listeners.clear();
      if (typeof offConfig === 'function') offConfig();
      if (typeof offAgent === 'function') offAgent();
    },
  };
}
