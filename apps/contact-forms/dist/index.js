/**
 * Formularios de Contacto — app instalable multiInstance.
 *
 * Cada instancia es UN formulario de contacto incrustable en sitios externos:
 *   - Pestaña Mensajes: bandeja de entrada de envíos recibidos (leer/archivar/eliminar).
 *   - Pestaña Diseño: editor de campos y ajustes (título, email de aviso, color, publicado).
 *   - Pestaña Incrustar: snippets de script / iframe / API para pegar en cualquier web.
 *
 * Modelo de datos (items de la instancia, compartidos con el backend público):
 *   items/definition        → definición del formulario (kind='definition')
 *   items/{uuid}            → mensajes recibidos (kind='submission', status new|read|archived)
 *
 * El backend expone los endpoints públicos en /api/public/contact-forms/{instanceId}/…
 * (contactFormsAPI.py en kimos-enterprice). Bundle ESM puro: usa globalThis.React.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  const instanceId = shell.app && shell.app.instanceId;

  // Base pública del API: shell.assetUrl devuelve `${API_URL}/api/apps/...`;
  // recortamos y resolvemos contra el origin por si API_URL es relativo.
  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) {
      return window.location.origin;
    }
  }
  const publicBase = apiBase() + '/api/public/contact-forms/' + (instanceId || '');

  const FIELD_TYPES = [
    ['text', 'Texto'],
    ['email', 'Email'],
    ['tel', 'Teléfono'],
    ['textarea', 'Texto largo'],
    ['select', 'Selección'],
  ];

  function defaultDefinition() {
    return {
      id: 'definition',
      kind: 'definition',
      enabled: true,
      title: 'Contáctanos',
      description: 'Completa el formulario y te responderemos a la brevedad.',
      buttonLabel: 'Enviar mensaje',
      successMessage: '¡Mensaje enviado! Te contactaremos pronto.',
      notifyEmail: '',
      accentColor: '#19ACB1',
      theme: 'light',
      fields: [
        { key: 'company', label: 'Empresa', type: 'text', required: true, maxLength: 120, placeholder: '' },
        { key: 'name', label: 'Nombre de contacto', type: 'text', required: true, maxLength: 120, placeholder: '' },
        { key: 'email', label: 'Email', type: 'email', required: true, maxLength: 255, placeholder: '' },
        { key: 'phone', label: 'Teléfono', type: 'tel', required: false, maxLength: 40, placeholder: '' },
        { key: 'message', label: 'Mensaje', type: 'textarea', required: true, maxLength: 1500, placeholder: '' },
      ],
    };
  }

  // ── Estado del closure (una instancia = una ventana) ──────────────────────
  let definition = null;      // item 'definition' (null hasta cargar)
  let definitionExists = false;
  let messages = [];          // items kind='submission'
  let loading = true;
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l({ definition, messages, loading }); };

  function sortMessages(list) {
    return list.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  async function refresh() {
    if (!instanceId) { loading = false; emit(); return; }
    try {
      const items = await shell.items.list();
      const def = items.find((i) => i.id === 'definition' || i.kind === 'definition');
      messages = sortMessages(items.filter((i) => i.kind === 'submission'));
      if (def) { definition = def; definitionExists = true; }
      else if (!definition) definition = defaultDefinition();
    } catch (e) {
      console.error('[contact-forms] refresh', e);
      if (!definition) definition = defaultDefinition();
    }
    loading = false;
    emit();
  }

  async function saveDefinition(next) {
    definition = next;
    emit();
    try {
      if (definitionExists) {
        await shell.items.update('definition', next);
      } else {
        await shell.items.create(next);
        definitionExists = true;
      }
      shell.notify({ level: 'success', text: 'Formulario guardado.' });
    } catch (e) {
      console.error('[contact-forms] save', e);
      shell.notify({ level: 'error', text: 'No se pudo guardar el formulario.' });
    }
  }

  async function setMessageStatus(id, status) {
    try {
      await shell.items.update(id, { status });
      messages = sortMessages(messages.map((m) => (m.id === id ? { ...m, status } : m)));
      emit();
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo actualizar el mensaje.' });
    }
  }

  async function markAllRead() {
    const pending = messages.filter((m) => (m.status || 'new') === 'new');
    for (const m of pending) {
      try { await shell.items.update(m.id, { status: 'read' }); } catch (e) { /* noop */ }
    }
    messages = sortMessages(messages.map((m) => ((m.status || 'new') === 'new' ? { ...m, status: 'read' } : m)));
    emit();
    if (pending.length) shell.notify({ level: 'success', text: pending.length + ' mensaje(s) marcados como leídos.' });
  }

  async function deleteMessage(id) {
    try {
      await shell.items.remove(id);
      messages = messages.filter((m) => m.id !== id);
      emit();
      shell.notify({ level: 'info', text: 'Mensaje eliminado.' });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo eliminar el mensaje.' });
    }
  }

  // ── Documentos (AppShell v2): versionar el diseño del formulario ─────────
  // "Guardar versión" e "Historial (restaurar)" del menú 🗂️ operan sobre la
  // definición: restaurar una versión re-aplica ese diseño del formulario.
  let offDocs = null;
  if (shell.documents && typeof shell.documents.onSerialize === 'function') {
    const offSer = shell.documents.onSerialize(() => ({ definition }));
    const offLoad = shell.documents.onLoad((cfg) => {
      if (cfg && cfg.definition && cfg.definition.kind === 'definition') {
        void saveDefinition({ ...cfg.definition, id: 'definition' });
      }
    });
    offDocs = () => { try { offSer(); offLoad(); } catch (e) { /* noop */ } };
  }

  // ── Agente ────────────────────────────────────────────────────────────────
  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'Formularios de Contacto',
      description: 'Gestiona un formulario de contacto incrustable: lista mensajes recibidos, los marca como leídos, los elimina, y publica/despublica el formulario.',
      tools: [
        { name: 'LIST_MESSAGES', description: 'Lista los mensajes recibidos por el formulario.', inputSchema: { type: 'object', properties: {} } },
        { name: 'MARK_READ', description: 'Marca un mensaje como leído.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'DELETE_MESSAGE', description: 'Elimina un mensaje por id.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'SET_PUBLISHED', description: 'Publica (true) o despublica (false) el formulario.', inputSchema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } },
      ],
      getSnapshot: () => ({
        formId: instanceId || null,
        publicado: !!(definition && definition.enabled),
        totalMensajes: messages.length,
        nuevos: messages.filter((m) => (m.status || 'new') === 'new').length,
        mensajes: messages.slice(0, 30).map((m) => ({ id: m.id, status: m.status || 'new', createdAt: m.createdAt, data: m.data })),
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          if (type === 'LIST_MESSAGES') {
            await refresh();
            return { success: true, message: messages.length ? ('Hay ' + messages.length + ' mensaje(s).') : 'No hay mensajes.' };
          }
          if (type === 'MARK_READ') {
            await setMessageStatus(String(p.id || ''), 'read');
            return { success: true, message: 'Mensaje marcado como leído.' };
          }
          if (type === 'DELETE_MESSAGE') {
            await deleteMessage(String(p.id || ''));
            return { success: true, message: 'Mensaje eliminado.' };
          }
          if (type === 'SET_PUBLISHED') {
            if (!definition) return { success: false, error: 'Definición no cargada aún.' };
            await saveDefinition({ ...definition, enabled: !!p.enabled });
            return { success: true, message: p.enabled ? 'Formulario publicado.' : 'Formulario despublicado.' };
          }
          return { success: false, error: 'Acción no soportada: ' + type };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      },
    });
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  function copy(text, label) {
    const done = () => shell.notify({ level: 'success', text: (label || 'Código') + ' copiado al portapapeles.' });
    const fail = () => shell.notify({ level: 'error', text: 'No se pudo copiar.' });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) { fail(); }
    }
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5);
    } catch (e) { return String(iso || ''); }
  }

  // ── Pestaña: Mensajes ─────────────────────────────────────────────────────
  function InboxTab({ state }) {
    const [openId, setOpenId] = useState(null);
    const [filter, setFilter] = useState('all'); // all | new | archived
    const all = state.messages;
    const counts = {
      all: all.length,
      new: all.filter((m) => (m.status || 'new') === 'new').length,
      archived: all.filter((m) => m.status === 'archived').length,
    };
    const msgs = filter === 'all'
      ? all.filter((m) => m.status !== 'archived')
      : all.filter((m) => (filter === 'new' ? (m.status || 'new') === 'new' : m.status === 'archived'));
    if (state.loading) return h('div', { className: 'kcf-empty' }, 'Cargando…');
    if (!all.length) {
      return h('div', { className: 'kcf-empty' }, [
        h('div', { key: 'i', style: { fontSize: 40 } }, '📭'),
        h('div', { key: 't' }, 'Sin mensajes todavía.'),
        h('div', { key: 'd', className: 'kcf-muted' }, 'Cuando alguien envíe el formulario incrustado, el mensaje aparecerá aquí.'),
      ]);
    }
    const filters = [['all', 'Bandeja (' + (counts.all - counts.archived) + ')'], ['new', 'Nuevos (' + counts.new + ')'], ['archived', 'Archivados (' + counts.archived + ')']];
    return h('div', null, [
      h('div', { key: 'filters', className: 'kcf-filters' },
        filters.map(([id, label]) => h('button', {
          key: id,
          className: 'kcf-chip' + (filter === id ? ' kcf-chip-active' : ''),
          onClick: () => setFilter(id),
        }, label)).concat(counts.new > 0 ? [
          h('button', { key: 'allread', className: 'kcf-chip kcf-filters-right', onClick: () => void markAllRead() }, '✓ Marcar todo leído'),
        ] : [])),
      msgs.length === 0 && h('div', { key: 'none', className: 'kcf-muted', style: { padding: '12px 4px' } }, 'Nada en este filtro.'),
      h('div', { key: 'list', className: 'kcf-list' }, msgs.map((m) => {
      const status = m.status || 'new';
      const data = m.data || {};
      const first = Object.values(data)[0] || '(sin datos)';
      const open = openId === m.id;
      return h('div', { key: m.id, className: 'kcf-msg' + (status === 'new' ? ' kcf-msg-new' : '') }, [
        h('div', {
          key: 'head', className: 'kcf-msg-head',
          onClick: () => {
            setOpenId(open ? null : m.id);
            if (!open && status === 'new') void setMessageStatus(m.id, 'read');
          },
        }, [
          h('span', { key: 'dot', className: 'kcf-dot kcf-dot-' + status }),
          h('span', { key: 'first', className: 'kcf-msg-first' }, String(first)),
          h('span', { key: 'date', className: 'kcf-msg-date' }, fmtDate(m.createdAt)),
        ]),
        open && h('div', { key: 'body', className: 'kcf-msg-body' }, [
          h('table', { key: 'tbl', className: 'kcf-table' },
            h('tbody', null, Object.keys(data).map((k) =>
              h('tr', { key: k }, [
                h('td', { key: 'k', className: 'kcf-td-key' }, k),
                h('td', { key: 'v' }, String(data[k])),
              ])
            ))),
          m.meta && m.meta.origin && h('div', { key: 'org', className: 'kcf-muted', style: { marginTop: 6 } }, 'Origen: ' + m.meta.origin),
          h('div', { key: 'actions', className: 'kcf-msg-actions' }, [
            status !== 'new' && h('button', { key: 'unread', className: 'kcf-btn kcf-btn-ghost', onClick: () => void setMessageStatus(m.id, 'new') }, 'Marcar no leído'),
            status !== 'archived' && h('button', { key: 'arch', className: 'kcf-btn kcf-btn-ghost', onClick: () => void setMessageStatus(m.id, 'archived') }, 'Archivar'),
            h('button', { key: 'del', className: 'kcf-btn kcf-btn-danger', onClick: () => { if (window.confirm('¿Eliminar este mensaje?')) void deleteMessage(m.id); } }, 'Eliminar'),
          ]),
        ]),
      ]);
      })),
    ]);
  }

  // ── Pestaña: Diseño ───────────────────────────────────────────────────────
  function DesignTab({ state }) {
    const def = state.definition;
    const [draft, setDraft] = useState(def);
    const [dirty, setDirty] = useState(false);
    useEffect(() => { if (!dirty) setDraft(def); }, [def]);
    if (!draft) return h('div', { className: 'kcf-empty' }, 'Cargando…');

    const up = (patch) => { setDraft({ ...draft, ...patch }); setDirty(true); };
    const upField = (i, patch) => {
      const fields = draft.fields.slice();
      fields[i] = { ...fields[i], ...patch };
      up({ fields });
    };
    const moveField = (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= draft.fields.length) return;
      const fields = draft.fields.slice();
      const t = fields[i]; fields[i] = fields[j]; fields[j] = t;
      up({ fields });
    };
    const removeField = (i) => up({ fields: draft.fields.filter((_, x) => x !== i) });
    const addField = () => {
      const n = draft.fields.length + 1;
      up({ fields: draft.fields.concat([{ key: 'campo' + n, label: 'Campo ' + n, type: 'text', required: false, maxLength: 500, placeholder: '' }]) });
    };
    const keyOk = (k) => /^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/.test(k);
    const keysValid = draft.fields.every((f) => keyOk(f.key)) &&
      new Set(draft.fields.map((f) => f.key)).size === draft.fields.length;

    const row = (label, node) => h('div', { className: 'kcf-form-row' }, [
      h('label', { key: 'l', className: 'kcf-label' }, label), node,
    ]);

    return h('div', { className: 'kcf-design' }, [
      h('div', { key: 'general', className: 'kcf-card' }, [
        h('div', { key: 'h', className: 'kcf-card-title' }, 'Ajustes generales'),
        row('Título', h('input', { key: 'i', className: 'kcf-input', value: draft.title || '', onChange: (e) => up({ title: e.target.value }) })),
        row('Descripción', h('input', { key: 'i', className: 'kcf-input', value: draft.description || '', onChange: (e) => up({ description: e.target.value }) })),
        row('Texto del botón', h('input', { key: 'i', className: 'kcf-input', value: draft.buttonLabel || '', onChange: (e) => up({ buttonLabel: e.target.value }) })),
        row('Mensaje de éxito', h('input', { key: 'i', className: 'kcf-input', value: draft.successMessage || '', onChange: (e) => up({ successMessage: e.target.value }) })),
        row('Notificar por email a', h('input', { key: 'i', className: 'kcf-input', type: 'email', placeholder: 'opcional — requiere SMTP configurado', value: draft.notifyEmail || '', onChange: (e) => up({ notifyEmail: e.target.value }) })),
        h('div', { key: 'inline', className: 'kcf-inline' }, [
          h('div', { key: 'c', className: 'kcf-form-row' }, [
            h('label', { key: 'l', className: 'kcf-label' }, 'Color de acento'),
            h('input', { key: 'i', type: 'color', className: 'kcf-color', value: draft.accentColor || '#19ACB1', onChange: (e) => up({ accentColor: e.target.value }) }),
          ]),
          h('div', { key: 't', className: 'kcf-form-row' }, [
            h('label', { key: 'l', className: 'kcf-label' }, 'Tema del widget'),
            h('select', { key: 'i', className: 'kcf-input', value: draft.theme || 'light', onChange: (e) => up({ theme: e.target.value }) }, [
              h('option', { key: 'l', value: 'light' }, 'Claro'),
              h('option', { key: 'd', value: 'dark' }, 'Oscuro'),
            ]),
          ]),
          h('div', { key: 'e', className: 'kcf-form-row' }, [
            h('label', { key: 'l', className: 'kcf-label' }, 'Publicado'),
            h('label', { key: 'i', className: 'kcf-switch' }, [
              h('input', { key: 'c', type: 'checkbox', checked: !!draft.enabled, onChange: (e) => up({ enabled: e.target.checked }) }),
              h('span', { key: 's' }, draft.enabled ? 'Sí — recibe envíos' : 'No — rechaza envíos'),
            ]),
          ]),
        ]),
      ]),

      h('div', { key: 'fields', className: 'kcf-card' }, [
        h('div', { key: 'h', className: 'kcf-card-title' }, 'Campos del formulario'),
        !keysValid && h('div', { key: 'warn', className: 'kcf-warn' },
          'Las claves deben ser únicas y usar solo letras, números, "_" o "-" (empezando por letra).'),
        h('div', { key: 'list' }, draft.fields.map((f, i) =>
          h('div', { key: i, className: 'kcf-field-row' }, [
            h('div', { key: 'grid', className: 'kcf-field-grid' }, [
              h('input', { key: 'key', className: 'kcf-input kcf-mono' + (keyOk(f.key) ? '' : ' kcf-input-err'), title: 'Clave (nombre técnico del campo)', value: f.key, onChange: (e) => upField(i, { key: e.target.value }) }),
              h('input', { key: 'label', className: 'kcf-input', title: 'Etiqueta visible', value: f.label, onChange: (e) => upField(i, { label: e.target.value }) }),
              h('select', { key: 'type', className: 'kcf-input', value: f.type, onChange: (e) => upField(i, { type: e.target.value }) },
                FIELD_TYPES.map(([v, l]) => h('option', { key: v, value: v }, l))),
              h('label', { key: 'req', className: 'kcf-check' }, [
                h('input', { key: 'c', type: 'checkbox', checked: !!f.required, onChange: (e) => upField(i, { required: e.target.checked }) }),
                h('span', { key: 's' }, 'Req.'),
              ]),
            ]),
            f.type === 'select' && h('input', {
              key: 'opts', className: 'kcf-input', style: { marginTop: 6 },
              placeholder: 'Opciones separadas por coma',
              value: (f.options || []).join(', '),
              onChange: (e) => upField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }),
            }),
            h('div', { key: 'act', className: 'kcf-field-actions' }, [
              h('button', { key: 'up', className: 'kcf-btn kcf-btn-ghost', disabled: i === 0, onClick: () => moveField(i, -1) }, '↑'),
              h('button', { key: 'dn', className: 'kcf-btn kcf-btn-ghost', disabled: i === draft.fields.length - 1, onClick: () => moveField(i, 1) }, '↓'),
              h('button', { key: 'rm', className: 'kcf-btn kcf-btn-danger', onClick: () => removeField(i) }, '✕'),
            ]),
          ])
        )),
        h('button', { key: 'add', className: 'kcf-btn kcf-btn-ghost', style: { marginTop: 8 }, onClick: addField }, '+ Agregar campo'),
      ]),

      h('div', { key: 'save', className: 'kcf-savebar' }, [
        dirty && h('span', { key: 's', className: 'kcf-muted' }, 'Cambios sin guardar'),
        h('button', {
          key: 'b', className: 'kcf-btn kcf-btn-primary', disabled: !dirty || !keysValid || !draft.fields.length,
          onClick: () => { setDirty(false); void saveDefinition(draft); },
        }, 'Guardar formulario'),
      ]),
    ]);
  }

  // ── Pestaña: Incrustar ────────────────────────────────────────────────────
  function EmbedTab({ state }) {
    if (!instanceId) return h('div', { className: 'kcf-empty' }, 'Esta ventana no tiene instancia.');
    const def = state.definition || {};
    const scriptSnippet =
      '<div data-kimos-contact-form="' + instanceId + '"></div>\n' +
      '<script src="' + publicBase + '/embed.js" async></script>';
    const iframeSnippet =
      '<iframe src="' + publicBase + '/embed"\n' +
      '  style="border:0;width:100%;min-height:560px" title="' + (def.title || 'Formulario de contacto') + '"></iframe>';
    const apiSnippet =
      'fetch("' + publicBase + '/submissions", {\n' +
      '  method: "POST",\n' +
      '  headers: { "Content-Type": "application/json" },\n' +
      '  body: JSON.stringify({\n' +
      (def.fields || []).map((f) => '    ' + f.key + ': "..."').join(',\n') + '\n' +
      '  })\n' +
      '});';

    const block = (title, desc, code, label, previewUrl) => h('div', { className: 'kcf-card' }, [
      h('div', { key: 'h', className: 'kcf-card-title' }, title),
      h('div', { key: 'd', className: 'kcf-muted', style: { marginBottom: 8 } }, desc),
      h('pre', { key: 'c', className: 'kcf-code' }, code),
      h('div', { key: 'a', className: 'kcf-snippet-actions' }, [
        h('button', { key: 'b', className: 'kcf-btn kcf-btn-primary', onClick: () => copy(code, label) }, 'Copiar'),
        previewUrl && h('button', { key: 'p', className: 'kcf-btn kcf-btn-ghost', onClick: () => window.open(previewUrl, '_blank', 'noopener') }, 'Vista previa'),
      ]),
    ]);

    return h('div', { className: 'kcf-design' }, [
      !def.enabled && h('div', { key: 'warn', className: 'kcf-warn' },
        'El formulario está despublicado: los envíos serán rechazados. Actívalo en la pestaña Diseño.'),
      h('div', { key: 'id', className: 'kcf-card' }, [
        h('div', { key: 'h', className: 'kcf-card-title' }, 'ID del formulario'),
        h('pre', { key: 'c', className: 'kcf-code' }, instanceId),
        h('div', { key: 'd', className: 'kcf-muted' }, 'URL base pública: ' + publicBase),
      ]),
      block('Opción 1 — Script (recomendada)',
        'Pega este código donde quieras que aparezca el formulario. El widget hereda el color y tema configurados.',
        scriptSnippet, 'Snippet de script'),
      block('Opción 2 — iframe',
        'Aislamiento total de estilos. Útil en CMS que no permiten scripts.',
        iframeSnippet, 'Snippet de iframe', publicBase + '/embed'),
      block('Opción 3 — API (formulario propio)',
        'Si tu sitio ya tiene un formulario con su propio diseño (por ejemplo FIGIT), envía los datos por POST y gestiona los mensajes desde esta app.',
        apiSnippet, 'Ejemplo de API'),
    ]);
  }

  // ── Componente raíz ───────────────────────────────────────────────────────
  function Component() {
    const [state, setState] = useState({ definition, messages, loading });
    const [tab, setTab] = useState('inbox');

    useEffect(() => {
      listeners.add(setState);
      void refresh();
      const timer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refresh();
      }, 30000);
      return () => { listeners.delete(setState); clearInterval(timer); };
    }, []);

    if (!instanceId) {
      return h('div', { className: 'kimos-contact-forms' },
        h('div', { className: 'kcf-empty' }, [
          h('div', { key: 'i', style: { fontSize: 40 } }, '📬'),
          h('div', { key: 't' }, 'Crea una instancia para tener un formulario.'),
          h('div', { key: 'd', className: 'kcf-muted' }, 'Cada documento de esta app es un formulario incrustable distinto. Ábrela desde el menú principal y crea o abre uno en la pantalla de bienvenida.'),
        ]));
    }

    const news = state.messages.filter((m) => (m.status || 'new') === 'new').length;
    const tabs = [
      ['inbox', '📥 Mensajes' + (news ? ' (' + news + ')' : '')],
      ['design', '🛠️ Diseño'],
      ['embed', '🔗 Incrustar'],
    ];

    return h('div', { className: 'kimos-contact-forms' }, [
      h('div', { key: 'tabs', className: 'kcf-tabs' },
        tabs.map(([id, label]) => h('button', {
          key: id,
          className: 'kcf-tab' + (tab === id ? ' kcf-tab-active' : ''),
          onClick: () => setTab(id),
        }, label)).concat([
          h('button', { key: 'refresh', className: 'kcf-tab kcf-tab-right', title: 'Actualizar', onClick: () => void refresh() }, '⟳'),
        ])),
      h('div', { key: 'body', className: 'kcf-body' },
        tab === 'inbox' ? h(InboxTab, { state })
          : tab === 'design' ? h(DesignTab, { state })
            : h(EmbedTab, { state })),
    ]);
  }

  return {
    Component,
    unmount() {
      listeners.clear();
      if (typeof offDocs === 'function') { try { offDocs(); } catch (e) { /* noop */ } }
      if (typeof unregisterAgent === 'function') {
        try { unregisterAgent(); } catch (e) { /* noop */ }
      }
    },
  };
}
