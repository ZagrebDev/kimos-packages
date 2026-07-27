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
  const APP_VERSION = '1.3.2'; // mantener en sincronía con manifest.json

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
  const apiRoot = apiBase();
  const publicBase = apiRoot + '/api/public/contact-forms/' + (instanceId || '');

  // Hosting alternativo del widget: CDN del repo público kimos-packages (el
  // mismo del que la plataforma instala los paquetes). Se usa cuando la app
  // no fue instalada como .kapp y por tanto no tiene assets subidos.
  const CDN_ASSETS = 'https://cdn.jsdelivr.net/gh/ZagrebDev/kimos-packages@main/apps/contact-forms/assets';

  const FIELD_TYPES = [
    ['text', 'Texto'],
    ['email', 'Email'],
    ['tel', 'Teléfono'],
    ['textarea', 'Texto largo'],
    ['select', 'Selección'],
  ];

  // Colores por defecto de cada base del widget (deben coincidir con los del
  // backend público contactFormsAPI.py en kimos-enterprice).
  const STYLE_BASES = {
    light: { bgColor: '#ffffff', textColor: '#111827', inputBgColor: '#ffffff', borderColor: '#d1d5db', successColor: '#059669', errorColor: '#dc2626' },
    dark: { bgColor: '#111827', textColor: '#f9fafb', inputBgColor: '#1f2937', borderColor: '#374151', successColor: '#34d399', errorColor: '#f87171' },
  };

  function defaultStyle(base, accent) {
    const b = base === 'dark' ? 'dark' : 'light';
    return {
      base: b,
      align: 'center',
      accentColor: accent || '#19ACB1',
      border: true,
      borderWidth: 1,
      rounded: true,
      fontSize: 14,
      bgOpacity: 100,
      ...STYLE_BASES[b],
    };
  }

  // Fondo con opacidad (0-100%): mismo cálculo que hace assets/embed.js.
  function bgWithOpacity(hex, opacity) {
    const pct = typeof opacity === 'number' ? Math.min(Math.max(opacity, 0), 100) : 100;
    if (pct >= 100) return hex;
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n) || h.length < 6) return hex;
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + pct / 100 + ')';
  }

  // Estilo efectivo del widget: combina `style` con los campos legados
  // `theme` / `accentColor` de definiciones guardadas antes de v1.2.
  function effectiveStyle(def) {
    if (!def) return defaultStyle('light');
    const base = (def.style && def.style.base) || def.theme || 'light';
    return { ...defaultStyle(base, def.accentColor), ...(def.style || {}) };
  }

  // Altura inicial estimada del iframe (px) según campos y tamaño de texto,
  // para que el snippet no necesite ajustes a mano aunque el sitio bloquee <script>.
  function estimateIframeHeight(def) {
    const st = effectiveStyle(def);
    const scale = (st.fontSize || 14) / 14;
    let px = 64 + (def.title ? 32 : 0) + (def.description ? 28 : 0) + 66;
    (def.fields || []).forEach((f) => { px += f.type === 'textarea' ? 152 : 80; });
    return Math.ceil(px * scale);
  }

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
      style: defaultStyle('light'),
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

  // Bloque `public` de la definición: lo lee el gateway genérico de la
  // plataforma (GET /api/public/app/{id}/definition, permission public.read).
  // Publica textos, campos Y estilo — así el widget incrustado toma los
  // cambios de diseño en vivo, sin backend a medida ni re-pegar snippets.
  function publicBlock(def) {
    return {
      enabled: !!def.enabled,
      data: {
        title: def.title || '',
        description: def.description || '',
        buttonLabel: def.buttonLabel || '',
        successMessage: def.successMessage || '',
        fields: def.fields || [],
        style: effectiveStyle(def),
      },
    };
  }

  async function saveDefinition(next) {
    next = { ...next, public: publicBlock(next) };
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

  // ── Vista previa en tiempo real del widget incrustado ────────────────────
  // Réplica visual del render de embed.js (contactFormsAPI.py): cualquier
  // cambio de apariencia en el borrador se refleja al instante, incluyendo
  // el modal superpuesto de éxito/error.
  function WidgetPreview({ def }) {
    const [modal, setModal] = useState(null); // null | 'ok' | 'err'
    const st = effectiveStyle(def);
    const dark = st.base === 'dark';
    const bw = st.border === false ? 0 : (typeof st.borderWidth === 'number' ? st.borderWidth : 1);
    const rounded = st.rounded !== false;
    const rad = rounded ? 14 : 0;
    const inRad = rounded ? 8 : 0;
    const fs = typeof st.fontSize === 'number' ? st.fontSize : 14;

    const inputStyle = {
      width: '100%', boxSizing: 'border-box', padding: '10px 12px',
      border: '1px solid ' + st.borderColor, borderRadius: inRad,
      font: 'inherit', fontSize: fs, background: st.inputBgColor, color: st.textColor,
    };
    const labelStyle = { display: 'block', fontSize: fs - 2, fontWeight: 600, margin: '12px 0 4px', color: st.textColor };

    const fieldNodes = (def.fields || []).map((f, i) => h(React.Fragment, { key: f.key + '-' + i }, [
      h('label', { key: 'l', style: labelStyle }, f.label + (f.required ? ' *' : '')),
      f.type === 'textarea'
        ? h('textarea', { key: 'i', rows: 3, readOnly: true, placeholder: f.placeholder || '', style: { ...inputStyle, resize: 'none' } })
        : f.type === 'select'
          ? h('select', { key: 'i', disabled: true, style: inputStyle }, h('option', null, f.placeholder || '—'))
          : h('input', { key: 'i', type: 'text', readOnly: true, placeholder: f.placeholder || '', style: inputStyle }),
    ]));

    const align = st.align || 'center';
    return h('div', null, [
      h('div', { key: 'stage', className: 'kcf-preview-stage' },
        h('div', { style: {
          position: 'relative', fontFamily: 'system-ui, sans-serif', maxWidth: 560,
          margin: align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0 auto 0 0',
        } }, [
          h('div', { key: 'form', style: {
            background: bgWithOpacity(st.bgColor, st.bgOpacity), color: st.textColor, padding: 20, boxSizing: 'border-box',
            border: bw > 0 ? bw + 'px solid ' + st.borderColor : 'none', borderRadius: rad, fontSize: fs,
          } }, [
            def.title && h('div', { key: 't', style: { fontSize: fs + 4, fontWeight: 700 } }, def.title),
            def.description && h('div', { key: 'd', style: { fontSize: fs - 1, opacity: 0.75, marginTop: 4 } }, def.description),
            ...fieldNodes,
            h('button', { key: 'b', type: 'button', style: {
              marginTop: 16, padding: '10px 22px', border: 'none', borderRadius: inRad,
              background: st.accentColor, color: '#fff', fontWeight: 600, fontSize: fs, cursor: 'default',
            } }, def.buttonLabel || 'Enviar'),
          ]),
          modal && h('div', { key: 'overlay', style: {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box',
            zIndex: 5, borderRadius: rad, background: dark ? 'rgba(0,0,0,.55)' : 'rgba(17,24,39,.35)',
          } }, h('div', { style: {
            background: st.bgColor, color: st.textColor, border: '1px solid ' + st.borderColor,
            borderRadius: rounded ? 12 : 0, padding: '20px 22px', maxWidth: '88%', boxSizing: 'border-box',
            textAlign: 'center', boxShadow: '0 12px 32px rgba(0,0,0,.28)',
          } }, [
            h('div', { key: 'm', style: { fontSize: fs + 1, fontWeight: 600, lineHeight: 1.45, color: modal === 'ok' ? st.successColor : st.errorColor } },
              modal === 'ok' ? (def.successMessage || '¡Mensaje enviado!') : 'No se pudo enviar. Intenta nuevamente.'),
            h('button', { key: 'c', type: 'button', onClick: () => setModal(null), style: {
              marginTop: 14, padding: '8px 20px', border: 'none', borderRadius: inRad,
              background: st.accentColor, color: '#fff', fontWeight: 600, fontSize: fs - 1, cursor: 'pointer',
            } }, 'Cerrar'),
          ])),
        ])),
      h('div', { key: 'actions', className: 'kcf-preview-actions' }, [
        h('button', { key: 'ok', className: 'kcf-btn kcf-btn-ghost', onClick: () => setModal(modal === 'ok' ? null : 'ok') }, 'Ver modal de éxito'),
        h('button', { key: 'err', className: 'kcf-btn kcf-btn-ghost', onClick: () => setModal(modal === 'err' ? null : 'err') }, 'Ver modal de error'),
      ]),
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
    const st = effectiveStyle(draft);
    // Mantiene sincronizados los campos legados theme/accentColor con `style`
    // (los usan definiciones públicas cacheadas y versiones previas del widget).
    const upStyle = (patch) => {
      const style = { ...st, ...patch };
      up({ style, theme: style.base, accentColor: style.accentColor });
    };
    // Cambiar la base re-aplica los colores por defecto de esa base como punto
    // de partida; el usuario luego ajusta los que quiera.
    const setBase = (base) => {
      const b = base === 'dark' ? 'dark' : 'light';
      upStyle({ base: b, ...STYLE_BASES[b] });
    };
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
          h('div', { key: 'e', className: 'kcf-form-row' }, [
            h('label', { key: 'l', className: 'kcf-label' }, 'Publicado'),
            h('label', { key: 'i', className: 'kcf-switch' }, [
              h('input', { key: 'c', type: 'checkbox', checked: !!draft.enabled, onChange: (e) => up({ enabled: e.target.checked }) }),
              h('span', { key: 's' }, draft.enabled ? 'Sí — recibe envíos' : 'No — rechaza envíos'),
            ]),
          ]),
        ]),
      ]),

      h('div', { key: 'appearance', className: 'kcf-card' }, [
        h('div', { key: 'h', className: 'kcf-card-title' }, 'Apariencia del widget incrustado'),
        h('div', { key: 'd', className: 'kcf-muted', style: { marginBottom: 10 } },
          'Ajusta el diseño para que combine con el sitio donde lo incrustes. Los cambios se ven al instante en la vista previa.'),
        h('div', { key: 'grid', className: 'kcf-appearance' }, [
          h('div', { key: 'controls' }, [
            h('div', { key: 'basealign', className: 'kcf-inline' }, [
              h('div', { key: 'b', className: 'kcf-form-row' }, [
                h('label', { key: 'l', className: 'kcf-label' }, 'Base'),
                h('select', { key: 'i', className: 'kcf-input', value: st.base, onChange: (e) => setBase(e.target.value) }, [
                  h('option', { key: 'l', value: 'light' }, 'Claro'),
                  h('option', { key: 'd', value: 'dark' }, 'Oscuro'),
                ]),
              ]),
              h('div', { key: 'a', className: 'kcf-form-row' }, [
                h('label', { key: 'l', className: 'kcf-label' }, 'Alineación en el contenedor'),
                h('select', { key: 'i', className: 'kcf-input', value: st.align || 'center', onChange: (e) => upStyle({ align: e.target.value }) }, [
                  h('option', { key: 'c', value: 'center' }, 'Centrado'),
                  h('option', { key: 'l', value: 'left' }, 'Izquierda'),
                  h('option', { key: 'r', value: 'right' }, 'Derecha'),
                ]),
              ]),
            ]),
            h('div', { key: 'colors', className: 'kcf-style-grid' }, [
              ['bgColor', 'Fondo'],
              ['textColor', 'Texto'],
              ['inputBgColor', 'Fondo de inputs'],
              ['accentColor', 'Botón y resaltado'],
              ['borderColor', 'Bordes'],
              ['successColor', 'Texto modal de éxito'],
              ['errorColor', 'Texto modal de error'],
            ].map(([key, label]) => h('div', { key, className: 'kcf-form-row' }, [
              h('label', { key: 'l', className: 'kcf-label' }, label),
              h('input', { key: 'i', type: 'color', className: 'kcf-color', value: st[key], onChange: (e) => upStyle({ [key]: e.target.value }) }),
            ]))),
            h('div', { key: 'opacity', className: 'kcf-form-row', style: { marginTop: 6 } }, [
              h('label', { key: 'l', className: 'kcf-label' },
                'Opacidad del fondo: ' + (typeof st.bgOpacity === 'number' ? st.bgOpacity : 100) + '%' +
                ((typeof st.bgOpacity === 'number' ? st.bgOpacity : 100) < 100 ? ' (deja ver el fondo del sitio)' : '')),
              h('input', {
                key: 'i', type: 'range', min: 0, max: 100, step: 5, className: 'kcf-range',
                value: typeof st.bgOpacity === 'number' ? st.bgOpacity : 100,
                onChange: (e) => upStyle({ bgOpacity: parseInt(e.target.value, 10) }),
              }),
            ]),
            h('div', { key: 'border', className: 'kcf-inline', style: { marginTop: 6 } }, [
              h('div', { key: 'on', className: 'kcf-form-row' }, [
                h('label', { key: 'l', className: 'kcf-label' }, 'Borde'),
                h('label', { key: 'i', className: 'kcf-check' }, [
                  h('input', { key: 'c', type: 'checkbox', checked: st.border !== false, onChange: (e) => upStyle({ border: e.target.checked }) }),
                  h('span', { key: 's' }, st.border !== false ? 'Con borde' : 'Sin borde'),
                ]),
              ]),
              st.border !== false && h('div', { key: 'w', className: 'kcf-form-row' }, [
                h('label', { key: 'l', className: 'kcf-label' }, 'Ancho (px)'),
                h('input', {
                  key: 'i', type: 'number', min: 1, max: 8, className: 'kcf-input', style: { width: 70 },
                  value: typeof st.borderWidth === 'number' ? st.borderWidth : 1,
                  onChange: (e) => upStyle({ borderWidth: Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), 8) }),
                }),
              ]),
              h('div', { key: 'r', className: 'kcf-form-row' }, [
                h('label', { key: 'l', className: 'kcf-label' }, 'Esquinas'),
                h('select', { key: 'i', className: 'kcf-input', value: st.rounded !== false ? 'rounded' : 'square', onChange: (e) => upStyle({ rounded: e.target.value === 'rounded' }) }, [
                  h('option', { key: 'ro', value: 'rounded' }, 'Redondeadas'),
                  h('option', { key: 'sq', value: 'square' }, 'Rectas'),
                ]),
              ]),
              h('div', { key: 'fs', className: 'kcf-form-row' }, [
                h('label', { key: 'l', className: 'kcf-label' }, 'Tamaño de texto (px)'),
                h('input', {
                  key: 'i', type: 'number', min: 11, max: 22, className: 'kcf-input', style: { width: 70 },
                  value: typeof st.fontSize === 'number' ? st.fontSize : 14,
                  onChange: (e) => upStyle({ fontSize: Math.min(Math.max(parseInt(e.target.value, 10) || 14, 11), 22) }),
                }),
              ]),
            ]),
          ]),
          h('div', { key: 'preview', className: 'kcf-preview-col' }, [
            h('label', { key: 'l', className: 'kcf-label' }, 'Vista previa en tiempo real'),
            h(WidgetPreview, { key: 'p', def: draft }),
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
  // El widget es un asset de esta app (assets/embed.js — sin backend a
  // medida). Se sirve desde /api/apps/contact-forms/asset/ si la instalación
  // subió los assets (.kapp); si no, desde el CDN del repo kimos-packages.
  function b64url(obj) {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function EmbedTab({ state }) {
    const [assetHost, setAssetHost] = useState(null); // null=verificando
    useEffect(() => {
      let alive = true;
      fetch(apiRoot + '/api/apps/contact-forms/asset/embed.js', { method: 'HEAD', cache: 'no-store' })
        .then((r) => { if (alive) setAssetHost(!!r.ok); })
        .catch(() => { if (alive) setAssetHost(false); });
      return () => { alive = false; };
    }, []);
    if (!instanceId) return h('div', { className: 'kcf-empty' }, 'Esta ventana no tiene instancia.');
    const def = state.definition || {};
    const widgetBase = assetHost ? apiRoot + '/api/apps/contact-forms/asset' : CDN_ASSETS;
    // Cache-buster: versión de la app + fecha de guardado. Cambia en cada
    // release y en cada guardado del diseño, para que ni el navegador ni los
    // CDNs (jsDelivr, Jumpseller) sirvan una versión antigua del widget.
    const ver = APP_VERSION + '-' + encodeURIComponent(String(def.updatedAt || Date.now()).replace(/[^0-9TZ:.-]/g, ''));

    // Snapshot que viaja en el snippet: el widget pinta al instante con esto y
    // luego se sincroniza con la definición publicada (gateway público).
    const cfg = {
      formId: instanceId,
      api: apiRoot,
      style: effectiveStyle(def),
      form: {
        title: def.title || '', description: def.description || '',
        buttonLabel: def.buttonLabel || '', successMessage: def.successMessage || '',
        fields: def.fields || [],
      },
    };
    const iframeId = 'kcf-' + instanceId;
    const cfgJson = JSON.stringify({ ...cfg, container: '#' + iframeId }).replace(/</g, '\\u003c');
    const scriptSnippet =
      '<div id="' + iframeId + '"></div>\n' +
      '<script>\n' +
      '  window.KimosContactForms = window.KimosContactForms || [];\n' +
      '  window.KimosContactForms.push(' + cfgJson + ');\n' +
      '<' + '/script>\n' +
      '<script src="' + widgetBase + '/embed.js?v=' + ver + '" async><' + '/script>';
    const iframeUrl = widgetBase + '/embed.html?v=' + ver + '#cfg=' + b64url(cfg);
    const iframeSnippet =
      '<iframe id="' + iframeId + '" src="' + iframeUrl + '"\n' +
      '  style="border:0;width:100%;height:' + estimateIframeHeight(def) + 'px" title="' + (def.title || 'Formulario de contacto') + '"></iframe>\n' +
      '<script>\n' +
      '  window.addEventListener("message", function (e) {\n' +
      '    var d = e.data || {};\n' +
      '    if (d.type === "kimos-contact-form:height" && d.formId === "' + instanceId + '") {\n' +
      '      var f = document.getElementById("' + iframeId + '");\n' +
      '      if (f) f.style.height = d.height + "px";\n' +
      '    }\n' +
      '  });\n' +
      '<' + '/script>';
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
        h('div', { key: 'w', className: 'kcf-muted', style: { marginTop: 4 } },
          'Widget servido desde: ' + (assetHost === null ? 'verificando…'
            : assetHost ? 'tu plataforma (asset de la app)'
              : 'CDN del paquete kimos-packages (instala la app como .kapp para servirlo desde tu plataforma)')),
      ]),
      block('Opción 1 — Script (recomendada)',
        'Pega este código donde quieras que aparezca el formulario. Se dibuja directo en tu página (alto natural, sin scrollbars) con el diseño configurado en Apariencia, y se sincroniza solo con los cambios que guardes aquí.',
        scriptSnippet, 'Snippet de script'),
      block('Opción 2 — iframe',
        'Aislamiento total de estilos. La altura inicial se calcula según los campos del formulario y el <script> incluido la auto-ajusta para que nunca aparezcan scrollbars. Si tu CMS elimina los <script>, deja solo el <iframe>: la altura calculada ya evita el scroll (el mensaje de éxito/error sale en un modal sobre el formulario, sin cambiar el alto).',
        iframeSnippet, 'Snippet de iframe', iframeUrl),
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
