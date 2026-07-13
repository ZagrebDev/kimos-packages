/**
 * Agentes Web — app instalable multiInstance.
 *
 * Cada instancia es UN agente de chat incrustable en sitios externos (el mismo
 * widget flotante del Panel HTML, pero gestionado desde esta app, sin panel):
 *   - Pestaña Conversaciones: registro de las conversaciones recibidas por el
 *     widget (transcripción, leído/no leído, eliminar).
 *   - Pestaña Diseño: agente vinculado, textos, colores, posición, publicado,
 *     registro de mensajes on/off.
 *   - Pestaña Incrustar: snippets de script / iframe para pegar en cualquier web.
 *
 * Modelo de datos (items de la instancia, compartidos con el backend público):
 *   items/definition        → definición del widget (kind='definition')
 *   items/conv_{visitor}    → conversaciones registradas (kind='conversation')
 *
 * El backend expone los endpoints públicos en /api/public/web-agents/{instanceId}/…
 * (webAgentsAPI.py en kimos-enterprice). Requiere que el agente vinculado tenga
 * scope="public". Bundle ESM puro: usa globalThis.React.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  const instanceId = shell.app && shell.app.instanceId;

  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) {
      return window.location.origin;
    }
  }
  const base = apiBase();
  const publicBase = base + '/api/public/web-agents/' + (instanceId || '');

  function defaultDefinition() {
    return {
      id: 'definition',
      kind: 'definition',
      enabled: false,
      agentId: '',
      displayName: '',
      welcome: '',
      greeting: '',
      primary: '#19ACB1',
      mode: 'light',
      radius: 'round',
      position: 'right',
      logMessages: true,
    };
  }

  // ── Estado del closure ────────────────────────────────────────────────────
  let definition = null;
  let definitionExists = false;
  let conversations = [];
  let agents = [];          // agentes del enterprise (para el selector)
  let loading = true;
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l({ definition, conversations, agents, loading }); };

  function sortConvs(list) {
    return list.slice().sort((a, b) => String(b.lastMessageAt || b.updatedAt || '').localeCompare(String(a.lastMessageAt || a.updatedAt || '')));
  }

  async function refresh() {
    if (!instanceId) { loading = false; emit(); return; }
    try {
      const items = await shell.items.list();
      const def = items.find((i) => i.id === 'definition' || i.kind === 'definition');
      conversations = sortConvs(items.filter((i) => i.kind === 'conversation'));
      if (def) { definition = def; definitionExists = true; }
      else if (!definition) definition = defaultDefinition();
    } catch (e) {
      console.error('[web-agents] refresh', e);
      if (!definition) definition = defaultDefinition();
    }
    loading = false;
    emit();
  }

  async function loadAgents() {
    if (typeof shell.authFetch !== 'function') return;
    try {
      const res = await shell.authFetch(base + '/api/identity/agents');
      if (!res.ok) return;
      const data = await res.json();
      agents = (data.agents || []).map((a) => ({
        id: a.id,
        name: a.name || a.displayName || a.id,
        scope: a.scope || 'internal',
      }));
      emit();
    } catch (e) { /* selector opcional */ }
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
      shell.notify({ level: 'success', text: 'Agente web guardado.' });
    } catch (e) {
      console.error('[web-agents] save', e);
      shell.notify({ level: 'error', text: 'No se pudo guardar el agente web.' });
    }
  }

  async function setConvStatus(id, status) {
    try {
      await shell.items.update(id, { status });
      conversations = sortConvs(conversations.map((c) => (c.id === id ? { ...c, status } : c)));
      emit();
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo actualizar la conversación.' });
    }
  }

  async function markAllRead() {
    const pending = conversations.filter((c) => (c.status || 'new') === 'new');
    for (const c of pending) {
      try { await shell.items.update(c.id, { status: 'read' }); } catch (e) { /* noop */ }
    }
    conversations = sortConvs(conversations.map((c) => ((c.status || 'new') === 'new' ? { ...c, status: 'read' } : c)));
    emit();
    if (pending.length) shell.notify({ level: 'success', text: pending.length + ' conversación(es) marcadas como leídas.' });
  }

  async function deleteConv(id) {
    try {
      await shell.items.remove(id);
      conversations = conversations.filter((c) => c.id !== id);
      emit();
      shell.notify({ level: 'info', text: 'Conversación eliminada.' });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo eliminar la conversación.' });
    }
  }

  // ── Documentos (AppShell v2): versionar la definición del widget ─────────
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

  // ── Agente (control de esta app por el agente del escritorio) ────────────
  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'Agentes Web',
      description: 'Gestiona un agente de chat incrustable: lista las conversaciones registradas, las marca como leídas, las elimina y publica/despublica el widget.',
      tools: [
        { name: 'LIST_CONVERSATIONS', description: 'Lista las conversaciones registradas por el widget.', inputSchema: { type: 'object', properties: {} } },
        { name: 'MARK_READ', description: 'Marca una conversación como leída.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'DELETE_CONVERSATION', description: 'Elimina una conversación por id.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'SET_PUBLISHED', description: 'Publica (true) o despublica (false) el widget.', inputSchema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } },
      ],
      getSnapshot: () => ({
        agentWebId: instanceId || null,
        publicado: !!(definition && definition.enabled),
        agenteVinculado: (definition && definition.agentId) || null,
        totalConversaciones: conversations.length,
        nuevas: conversations.filter((c) => (c.status || 'new') === 'new').length,
        conversaciones: conversations.slice(0, 20).map((c) => ({
          id: c.id, status: c.status || 'new', lastMessageAt: c.lastMessageAt,
          mensajes: (c.messages || []).length,
          ultimo: (c.messages || []).length ? c.messages[c.messages.length - 1].text : '',
        })),
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          if (type === 'LIST_CONVERSATIONS') {
            await refresh();
            return { success: true, message: conversations.length ? ('Hay ' + conversations.length + ' conversación(es).') : 'No hay conversaciones.' };
          }
          if (type === 'MARK_READ') {
            await setConvStatus(String(p.id || ''), 'read');
            return { success: true, message: 'Conversación marcada como leída.' };
          }
          if (type === 'DELETE_CONVERSATION') {
            await deleteConv(String(p.id || ''));
            return { success: true, message: 'Conversación eliminada.' };
          }
          if (type === 'SET_PUBLISHED') {
            if (!definition) return { success: false, error: 'Definición no cargada aún.' };
            await saveDefinition({ ...definition, enabled: !!p.enabled });
            return { success: true, message: p.enabled ? 'Widget publicado.' : 'Widget despublicado.' };
          }
          return { success: false, error: 'Acción no soportada: ' + type };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      },
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────
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

  // ── Pestaña: Conversaciones ───────────────────────────────────────────────
  function ConvsTab({ state }) {
    const [openId, setOpenId] = useState(null);
    const [filter, setFilter] = useState('all'); // all | new
    const all = state.conversations;
    const newCount = all.filter((c) => (c.status || 'new') === 'new').length;
    const convs = filter === 'new' ? all.filter((c) => (c.status || 'new') === 'new') : all;
    if (state.loading) return h('div', { className: 'kwa-empty' }, 'Cargando…');
    if (!all.length) {
      return h('div', { className: 'kwa-empty' }, [
        h('div', { key: 'i', style: { fontSize: 40 } }, '💬'),
        h('div', { key: 't' }, 'Sin conversaciones todavía.'),
        h('div', { key: 'd', className: 'kwa-muted' }, 'Cuando alguien hable con el widget incrustado, la conversación aparecerá aquí.'),
      ]);
    }
    return h('div', null, [
      h('div', { key: 'filters', className: 'kwa-filters' },
        [['all', 'Todas (' + all.length + ')'], ['new', 'Nuevas (' + newCount + ')']].map(([id, label]) => h('button', {
          key: id,
          className: 'kwa-chip' + (filter === id ? ' kwa-chip-active' : ''),
          onClick: () => setFilter(id),
        }, label)).concat(newCount > 0 ? [
          h('button', { key: 'allread', className: 'kwa-chip kwa-filters-right', onClick: () => void markAllRead() }, '✓ Marcar todo leído'),
        ] : [])),
      convs.length === 0 && h('div', { key: 'none', className: 'kwa-muted', style: { padding: '12px 4px' } }, 'Nada en este filtro.'),
      h('div', { key: 'list', className: 'kwa-list' }, convs.map((cv) => {
      const status = cv.status || 'new';
      const msgs = cv.messages || [];
      const last = msgs.length ? msgs[msgs.length - 1].text : '(vacía)';
      const open = openId === cv.id;
      return h('div', { key: cv.id, className: 'kwa-conv' + (status === 'new' ? ' kwa-conv-new' : '') }, [
        h('div', {
          key: 'head', className: 'kwa-conv-head',
          onClick: () => {
            setOpenId(open ? null : cv.id);
            if (!open && status === 'new') void setConvStatus(cv.id, 'read');
          },
        }, [
          h('span', { key: 'dot', className: 'kwa-dot kwa-dot-' + status }),
          h('span', { key: 'vis', className: 'kwa-conv-visitor' }, 'Visitante ' + String(cv.visitorId || '').slice(0, 10)),
          h('span', { key: 'last', className: 'kwa-conv-last' }, String(last)),
          h('span', { key: 'n', className: 'kwa-conv-count' }, msgs.length + ' msg'),
          h('span', { key: 'date', className: 'kwa-conv-date' }, fmtDate(cv.lastMessageAt || cv.updatedAt)),
        ]),
        open && h('div', { key: 'body', className: 'kwa-conv-body' }, [
          h('div', { key: 'transcript', className: 'kwa-transcript' },
            msgs.map((m, i) => h('div', { key: i, className: 'kwa-bubble kwa-bubble-' + (m.role === 'user' ? 'user' : 'agent') }, [
              h('div', { key: 't', className: 'kwa-bubble-text' }, String(m.text || '')),
              h('div', { key: 'a', className: 'kwa-bubble-at' }, fmtDate(m.at)),
            ]))),
          cv.meta && cv.meta.origin && h('div', { key: 'org', className: 'kwa-muted', style: { marginTop: 6 } }, 'Origen: ' + cv.meta.origin),
          h('div', { key: 'actions', className: 'kwa-conv-actions' }, [
            status !== 'new' && h('button', { key: 'unread', className: 'kwa-btn kwa-btn-ghost', onClick: () => void setConvStatus(cv.id, 'new') }, 'Marcar no leída'),
            h('button', { key: 'del', className: 'kwa-btn kwa-btn-danger', onClick: () => { if (window.confirm('¿Eliminar esta conversación?')) void deleteConv(cv.id); } }, 'Eliminar'),
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
    if (!draft) return h('div', { className: 'kwa-empty' }, 'Cargando…');

    const up = (patch) => { setDraft({ ...draft, ...patch }); setDirty(true); };
    const selectedAgent = state.agents.find((a) => a.id === draft.agentId);
    const agentNotPublic = !!selectedAgent && selectedAgent.scope !== 'public';

    const row = (label, node, help) => h('div', { className: 'kwa-form-row' }, [
      h('label', { key: 'l', className: 'kwa-label' }, label),
      node,
      help ? h('div', { key: 'h', className: 'kwa-muted', style: { marginTop: 3 } }, help) : null,
    ]);

    return h('div', { className: 'kwa-design' }, [
      h('div', { key: 'agent', className: 'kwa-card' }, [
        h('div', { key: 'h', className: 'kwa-card-title' }, 'Agente vinculado'),
        row('Agente',
          state.agents.length
            ? h('select', { key: 'i', className: 'kwa-input', value: draft.agentId || '', onChange: (e) => up({ agentId: e.target.value }) },
                [h('option', { key: '', value: '' }, '— Selecciona un agente —')].concat(
                  state.agents.map((a) => h('option', { key: a.id, value: a.id }, a.name + (a.scope === 'public' ? ' (público)' : ' (interno)')))))
            : h('input', { key: 'i', className: 'kwa-input kwa-mono', placeholder: 'id-del-agente', value: draft.agentId || '', onChange: (e) => up({ agentId: e.target.value }) }),
          'El agente debe tener scope "public" para responder fuera de la sesión.'),
        agentNotPublic && h('div', { key: 'warn', className: 'kwa-warn' },
          'El agente seleccionado no es público: el widget se mostrará pero el chat quedará deshabilitado hasta que un admin lo marque como público.'),
        row('Nombre a mostrar', h('input', { key: 'i', className: 'kwa-input', placeholder: '(por defecto, el nombre del agente)', value: draft.displayName || '', onChange: (e) => up({ displayName: e.target.value }) })),
        row('Mensaje de bienvenida', h('input', { key: 'i', className: 'kwa-input', placeholder: '¡Hola! ¿En qué puedo ayudarte?', maxLength: 300, value: draft.welcome || '', onChange: (e) => up({ welcome: e.target.value }) }), 'Primer mensaje del agente al abrir el chat.'),
        row('Saludo junto a la burbuja', h('input', { key: 'i', className: 'kwa-input', placeholder: 'Ej: ¿Te ayudo? (vacío = solo el icono)', maxLength: 160, value: draft.greeting || '', onChange: (e) => up({ greeting: e.target.value }) }), 'Texto que aparece al lado del icono flotante sin abrir el chat.'),
      ]),

      h('div', { key: 'look', className: 'kwa-card' }, [
        h('div', { key: 'h', className: 'kwa-card-title' }, 'Apariencia'),
        h('div', { key: 'grid', className: 'kwa-inline' }, [
          h('div', { key: 'c', className: 'kwa-form-row' }, [
            h('label', { key: 'l', className: 'kwa-label' }, 'Color principal'),
            h('input', { key: 'i', type: 'color', className: 'kwa-color', value: draft.primary || '#19ACB1', onChange: (e) => up({ primary: e.target.value }) }),
          ]),
          h('div', { key: 'm', className: 'kwa-form-row' }, [
            h('label', { key: 'l', className: 'kwa-label' }, 'Tema'),
            h('select', { key: 'i', className: 'kwa-input', value: draft.mode || 'light', onChange: (e) => up({ mode: e.target.value }) }, [
              h('option', { key: 'l', value: 'light' }, 'Claro'),
              h('option', { key: 'd', value: 'dark' }, 'Oscuro'),
            ]),
          ]),
          h('div', { key: 'r', className: 'kwa-form-row' }, [
            h('label', { key: 'l', className: 'kwa-label' }, 'Bordes'),
            h('select', { key: 'i', className: 'kwa-input', value: draft.radius || 'round', onChange: (e) => up({ radius: e.target.value }) }, [
              h('option', { key: 'ro', value: 'round' }, 'Redondeados'),
              h('option', { key: 'sq', value: 'square' }, 'Rectos'),
            ]),
          ]),
          h('div', { key: 'p', className: 'kwa-form-row' }, [
            h('label', { key: 'l', className: 'kwa-label' }, 'Posición'),
            h('select', { key: 'i', className: 'kwa-input', value: draft.position || 'right', onChange: (e) => up({ position: e.target.value }) }, [
              h('option', { key: 'r', value: 'right' }, 'Abajo a la derecha'),
              h('option', { key: 'l', value: 'left' }, 'Abajo a la izquierda'),
            ]),
          ]),
        ]),
      ]),

      h('div', { key: 'flags', className: 'kwa-card' }, [
        h('div', { key: 'h', className: 'kwa-card-title' }, 'Publicación y registro'),
        h('label', { key: 'en', className: 'kwa-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: !!draft.enabled, onChange: (e) => up({ enabled: e.target.checked }) }),
          h('span', { key: 's' }, draft.enabled ? 'Publicado — el widget responde en sitios externos' : 'Despublicado — el widget no responde'),
        ]),
        h('label', { key: 'log', className: 'kwa-switch', style: { marginTop: 8 } }, [
          h('input', { key: 'c', type: 'checkbox', checked: draft.logMessages !== false, onChange: (e) => up({ logMessages: e.target.checked }) }),
          h('span', { key: 's' }, 'Registrar conversaciones en la pestaña Conversaciones'),
        ]),
      ]),

      h('div', { key: 'save', className: 'kwa-savebar' }, [
        dirty && h('span', { key: 's', className: 'kwa-muted' }, 'Cambios sin guardar'),
        h('button', {
          key: 'b', className: 'kwa-btn kwa-btn-primary', disabled: !dirty || !(draft.agentId || '').trim(),
          onClick: () => { setDirty(false); void saveDefinition(draft); },
        }, 'Guardar agente web'),
      ]),
    ]);
  }

  // ── Pestaña: Incrustar ────────────────────────────────────────────────────
  function EmbedTab({ state }) {
    if (!instanceId) return h('div', { className: 'kwa-empty' }, 'Esta ventana no tiene instancia.');
    const def = state.definition || {};
    const scriptSnippet = '<script src="' + publicBase + '/widget.js" async></script>';
    const iframeSnippet =
      '<iframe src="' + publicBase + '/widget?layout=panel"\n' +
      '  style="border:0;width:100%;height:600px" title="Chat"></iframe>';

    const block = (title, desc, code, label, previewUrl) => h('div', { className: 'kwa-card' }, [
      h('div', { key: 'h', className: 'kwa-card-title' }, title),
      h('div', { key: 'd', className: 'kwa-muted', style: { marginBottom: 8 } }, desc),
      h('pre', { key: 'c', className: 'kwa-code' }, code),
      h('div', { key: 'a', className: 'kwa-snippet-actions' }, [
        h('button', { key: 'b', className: 'kwa-btn kwa-btn-primary', onClick: () => copy(code, label) }, 'Copiar'),
        previewUrl && h('button', { key: 'p', className: 'kwa-btn kwa-btn-ghost', onClick: () => window.open(previewUrl, '_blank', 'noopener') }, 'Vista previa'),
      ]),
    ]);

    return h('div', { className: 'kwa-design' }, [
      !def.enabled && h('div', { key: 'warn', className: 'kwa-warn' },
        'El agente web está despublicado: el widget no cargará. Actívalo en la pestaña Diseño.'),
      h('div', { key: 'id', className: 'kwa-card' }, [
        h('div', { key: 'h', className: 'kwa-card-title' }, 'ID del agente web'),
        h('pre', { key: 'c', className: 'kwa-code' }, instanceId),
        h('div', { key: 'd', className: 'kwa-muted' }, 'URL base pública: ' + publicBase),
      ]),
      block('Opción 1 — Widget flotante (recomendada)',
        'Pega este script antes de </body>. Muestra la burbuja flotante con el chat en la posición configurada.',
        scriptSnippet, 'Snippet del widget'),
      block('Opción 2 — Panel fijo (iframe)',
        'Chat siempre visible dentro de un recuadro de tamaño fijo. Útil en editores que no permiten scripts.',
        iframeSnippet, 'Snippet de iframe', publicBase + '/widget?layout=panel'),
    ]);
  }

  // ── Componente raíz ───────────────────────────────────────────────────────
  function Component() {
    const [state, setState] = useState({ definition, conversations, agents, loading });
    const [tab, setTab] = useState('convs');

    useEffect(() => {
      listeners.add(setState);
      void refresh();
      void loadAgents();
      const timer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refresh();
      }, 30000);
      return () => { listeners.delete(setState); clearInterval(timer); };
    }, []);

    if (!instanceId) {
      return h('div', { className: 'kimos-web-agents' },
        h('div', { className: 'kwa-empty' }, [
          h('div', { key: 'i', style: { fontSize: 40 } }, '🤖'),
          h('div', { key: 't' }, 'Crea una instancia para tener un agente web.'),
          h('div', { key: 'd', className: 'kwa-muted' }, 'Cada documento de esta app es un agente incrustable distinto. Ábrela desde el menú principal y crea o abre uno en la pantalla de bienvenida.'),
        ]));
    }

    const news = state.conversations.filter((c) => (c.status || 'new') === 'new').length;
    const tabs = [
      ['convs', '💬 Conversaciones' + (news ? ' (' + news + ')' : '')],
      ['design', '🛠️ Diseño'],
      ['embed', '🔗 Incrustar'],
    ];

    return h('div', { className: 'kimos-web-agents' }, [
      h('div', { key: 'tabs', className: 'kwa-tabs' },
        tabs.map(([id, label]) => h('button', {
          key: id,
          className: 'kwa-tab' + (tab === id ? ' kwa-tab-active' : ''),
          onClick: () => setTab(id),
        }, label)).concat([
          h('button', { key: 'refresh', className: 'kwa-tab kwa-tab-right', title: 'Actualizar', onClick: () => void refresh() }, '⟳'),
        ])),
      h('div', { key: 'body', className: 'kwa-body' },
        tab === 'convs' ? h(ConvsTab, { state })
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
