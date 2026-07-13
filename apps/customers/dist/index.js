/**
 * Clientes — app oficial instalable (v2.0, bundle real en kimos-packages).
 *
 * Directorio de clientes GENÉRICO (CRM liviano): los items pueden crearse
 * por API/agente o importarse desde Jumpseller. Funciones: lista con
 * búsqueda, detalle con datos de contacto, notas internas del equipo (se
 * preservan en cada re-sync) y sincronización manual desde la integración.
 *
 * Bundle ESM puro sobre el contrato AppShell: globalThis.React + shell.items
 * (CRUD de la instancia) + shell.authFetch (sync e integración).
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useCallback } = React;

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
  const SYNC_ENDPOINT = API + '/api/integrations/jumpseller/sync-customers-to-apps';

  const s = (v) => (v == null ? '' : String(v));
  const fmtDateOnly = (v) => {
    if (!s(v)) return '—';
    try { return new Date(s(v)).toLocaleDateString(); } catch (e) { return s(v); }
  };

  function Component() {
    const [items, setItems] = useState(null);         // null = cargando
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);
    const [selected, setSelected] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [msg, setMsg] = useState(null);
    const [hasBinding, setHasBinding] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [instConfig, setInstConfig] = useState({});

    const load = useCallback(async () => {
      try {
        const list = await shell.items.list();
        setItems(list.filter((it) => it && it.kind !== 'definition'));
        setError(null);
      } catch (e) {
        setError(e && e.message ? e.message : 'No se pudo cargar.');
        setItems([]);
      }
      try {
        const res = await shell.authFetch(API + '/api/app-instances/' + instanceId, { cache: 'no-store' });
        if (res.ok) {
          const inst = await res.json();
          const config = (inst && inst.config) || {};
          setInstConfig(config);
          const bindings = config.integrationBindings || [];
          setHasBinding(bindings.some((b) => b && b.integration === 'jumpseller'));
        }
      } catch (e) { /* la app funciona sin leer config */ }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
      if (!msg) return undefined;
      const t = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(t);
    }, [msg]);

    const doSync = async () => {
      if (syncing) return;
      setSyncing(true); setMsg(null);
      try {
        const res = await shell.authFetch(SYNC_ENDPOINT, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setMsg({ kind: 'err', text: s(data.detail) || 'Error ' + res.status });
        else { setMsg({ kind: 'ok', text: 'Sincronizado: ' + s(data.fetched != null ? data.fetched : '?') + ' clientes de Jumpseller.' }); await load(); }
      } catch (e) {
        setMsg({ kind: 'err', text: e && e.message ? e.message : 'Error de red' });
      } finally { setSyncing(false); }
    };

    const toggleBinding = async () => {
      const bindings = (instConfig.integrationBindings || []).filter((b) => b && b.integration !== 'jumpseller');
      if (!hasBinding) bindings.push({ integration: 'jumpseller', syncMode: 'pull' });
      const nextConfig = Object.assign({}, instConfig, { integrationBindings: bindings });
      setHasBinding(!hasBinding);
      setInstConfig(nextConfig);
      try {
        await shell.authFetch(API + '/api/app-instances/' + instanceId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: nextConfig }),
        });
      } catch (e) {
        setMsg({ kind: 'err', text: 'No se pudo guardar la vinculación.' });
      }
    };

    const saveNotes = async (item, notes) => {
      if (s(item.notes) === notes) return;
      try {
        await shell.items.update(item.id, { notes });
        setItems((prev) => (prev || []).map((i) => (i.id === item.id ? Object.assign({}, i, { notes }) : i)));
      } catch (e) {
        shell.notify({ level: 'error', text: 'No se pudieron guardar las notas.' });
      }
    };

    const removeItem = async (item) => {
      if (!window.confirm('¿Eliminar a "' + s(item.name || item.id) + '"' + ' de esta app? (No afecta a Jumpseller.)')) return;
      try {
        await shell.items.remove(item.id);
        setItems((prev) => (prev || []).filter((i) => i.id !== item.id));
        setSelected(null);
      } catch (e) {
        shell.notify({ level: 'error', text: 'No se pudo eliminar.' });
      }
    };

    const statuses = [];

    const visible = useMemo(() => {
      const needle = search.trim().toLowerCase();
      return (items || [])
        .filter((it) => !statusFilter || s(it.status) === statusFilter)
        .filter((it) => !needle || ['name', 'email', 'phone', 'city', 'country']
          .some((k) => s(it[k]).toLowerCase().includes(needle)))
        .sort((a, b) => s(a.name).localeCompare(s(b.name)));
    }, [items, search, statusFilter]);

    // ── Render ───────────────────────────────────────────────────────────
    if (items === null) return h('div', { className: 'kimos-customers' }, h('div', { className: 'kc-empty' }, 'Cargando…'));

    return h('div', { className: 'kimos-customers' },
      // Toolbar
      h('div', { className: 'kc-toolbar' },
        h('input', {
          className: 'kc-search', placeholder: 'Buscar clientes…',
          value: search, onChange: (e) => setSearch(e.target.value),
        }),
        statuses.length > 1 && h('div', { className: 'kc-chips' },
          statuses.map(([st, n]) => h('button', {
            key: st,
            className: 'kc-filter' + (statusFilter === st ? ' kc-filter-active' : ''),
            onClick: () => setStatusFilter(statusFilter === st ? null : st),
          }, st + ' · ' + n)),
        ),
        h('div', { className: 'kc-spacer' }),
        h('span', { className: 'kc-count' }, visible.length + ' de ' + items.length),
        hasBinding && h('button', { className: 'kc-btn kc-btn-primary', disabled: syncing, onClick: doSync },
          syncing ? 'Sincronizando…' : '⟳ Jumpseller'),
        h('button', { className: 'kc-btn', title: 'Integración', onClick: () => setShowConfig(!showConfig) }, '⚙'),
      ),
      showConfig && h('div', { className: 'kc-config' },
        h('div', null,
          h('div', { className: 'kc-config-title' }, 'Importar desde Jumpseller'),
          h('div', { className: 'kc-config-help' }, 'Al vincular, esta app se llena con los clientes de la tienda. Las notas internas se preservan en cada re-sync.'),
        ),
        h('button', { className: 'kc-toggle' + (hasBinding ? ' kc-toggle-on' : ''), onClick: toggleBinding, role: 'switch', 'aria-checked': hasBinding },
          h('span', { className: 'kc-toggle-dot' })),
      ),
      msg && h('div', { className: 'kc-msg kc-msg-' + msg.kind }, msg.text),
      error && h('div', { className: 'kc-msg kc-msg-err' }, error),

      // Lista
      items.length === 0
        ? h('div', { className: 'kc-empty' },
            h('div', { className: 'kc-empty-icon' }, '👥'),
            h('p', null, 'Aún no hay clientes'),
            hasBinding
              ? h('button', { className: 'kc-btn kc-btn-primary', disabled: syncing, onClick: doSync }, syncing ? 'Sincronizando…' : 'Sincronizar Jumpseller')
              : h('p', { className: 'kc-empty-hint' }, 'Vincula Jumpseller con el botón ⚙ de arriba para importar los clientes.'))
        : h('div', { className: 'kc-table-wrap' },
            h('table', { className: 'kc-table' },
              h('thead', null, h('tr', null,
                ['Cliente', 'Teléfono', 'Ciudad', 'País', 'Cliente desde'].map((c) =>
                  h('th', { key: c }, c)),
              )),
              h('tbody', null, visible.map((it) => h('tr', { key: it.id, onClick: () => setSelected(it) },
                h('td', null,
                  h('div', { className: 'kc-strong' }, s(it.name) || '—'),
                  s(it.email) && h('div', { className: 'kc-sub' }, s(it.email)),
                ),
                h('td', null, s(it.phone) || '—'),
                h('td', null, s(it.city) || '—'),
                h('td', null, s(it.country) || '—'),
                h('td', { className: 'kc-sub' }, fmtDateOnly(it.customerSince)),
              ))),
            )),

      // Detalle
      selected && h('div', { className: 'kc-overlay' },
        h('button', { className: 'kc-overlay-bg', onClick: () => setSelected(null), 'aria-label': 'Cerrar' }),
        h('div', { className: 'kc-panel' },
          h('div', { className: 'kc-panel-head' },
            h('span', { className: 'kc-panel-title' }, s(selected.name || selected.email || selected.id)),
            h('button', { className: 'kc-btn kc-btn-danger', title: 'Eliminar', onClick: () => removeItem(selected) }, '🗑'),
            h('button', { className: 'kc-btn', onClick: () => setSelected(null) }, '✕'),
          ),
          h('div', { className: 'kc-panel-body' },
            [['Email', s(selected.email) ? h('a', { href: 'mailto:' + s(selected.email), className: 'kc-link' }, s(selected.email)) : ''],
             ['Teléfono', s(selected.phone)],
             ['Ciudad', s(selected.city)],
             ['Región', s(selected.region)],
             ['País', s(selected.country)],
             ['Cliente desde', fmtDateOnly(selected.customerSince)],
            ].map(([label, value]) => (value && value !== '') ? h('div', { key: label, className: 'kc-field' },
              h('div', { className: 'kc-field-label' }, label),
              h('div', { className: 'kc-field-value' }, value),
            ) : null),
            Array.isArray(selected.sourceLinks) && selected.sourceLinks.some((l) => l && l.integration === 'jumpseller') &&
              h('p', { className: 'kc-synced' }, '✓ Sincronizado con Jumpseller'),
            h('div', { className: 'kc-field kc-notes' },
              h('div', { className: 'kc-field-label' }, 'Notas internas'),
              h('textarea', {
                className: 'kc-textarea', rows: 3,
                defaultValue: s(selected.notes),
                placeholder: 'Notas del equipo (no se envían a la integración)',
                onBlur: (e) => saveNotes(selected, e.target.value),
              }),
            ),
          ),
        ),
      ),
    );
  }

  return { Component };
}
