/**
 * Pedidos — app oficial instalable (v2.0, bundle real en kimos-packages).
 *
 * Gestión de pedidos GENÉRICA: los items pueden crearse por API/agente o
 * importarse desde Jumpseller (config.integrationBindings de la instancia).
 * Funciones: lista con búsqueda y filtro por estado, detalle con productos
 * del pedido, notas internas del equipo (se preservan en cada re-sync) y
 * sincronización manual desde la integración.
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
  const SYNC_ENDPOINT = API + '/api/integrations/jumpseller/sync-orders-to-apps';

  const s = (v) => (v == null ? '' : String(v));
  const money = (value, currency) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return '—';
    try {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency', currency: s(currency) || 'CLP', maximumFractionDigits: 0,
      }).format(n);
    } catch (e) { return String(n); }
  };
  const fmtDate = (v) => {
    if (!s(v)) return '—';
    try { return new Date(s(v)).toLocaleString(); } catch (e) { return s(v); }
  };
  const STATUS_CLASS = {
    paid: 'ko-chip-ok', pending_payment: 'ko-chip-warn',
    canceled: 'ko-chip-err', abandoned: 'ko-chip-muted',
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
        else { setMsg({ kind: 'ok', text: 'Sincronizado: ' + s(data.fetched != null ? data.fetched : '?') + ' pedidos de Jumpseller.' }); await load(); }
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
      if (!window.confirm('¿Eliminar el pedido #' + s(item.number || item.id) + ' de esta app? (No afecta a Jumpseller.)')) return;
      try {
        await shell.items.remove(item.id);
        setItems((prev) => (prev || []).filter((i) => i.id !== item.id));
        setSelected(null);
      } catch (e) {
        shell.notify({ level: 'error', text: 'No se pudo eliminar.' });
      }
    };

    const statuses = useMemo(() => {
      const seen = new Map();
      for (const it of items || []) {
        const st = s(it.status);
        if (st) seen.set(st, (seen.get(st) || 0) + 1);
      }
      return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    }, [items]);

    const visible = useMemo(() => {
      const needle = search.trim().toLowerCase();
      return (items || [])
        .filter((it) => !statusFilter || s(it.status) === statusFilter)
        .filter((it) => !needle || ['number', 'customerName', 'customerEmail', 'status', 'trackingNumber']
          .some((k) => s(it[k]).toLowerCase().includes(needle)))
        .sort((a, b) => s(b.orderDate || b.updatedAt).localeCompare(s(a.orderDate || a.updatedAt)));
    }, [items, search, statusFilter]);

    const chip = (it) => h('span', {
      className: 'ko-chip ' + (STATUS_CLASS[s(it.statusEnum).toLowerCase()] || 'ko-chip-muted'),
    }, s(it.status) || 'Desconocido');

    // ── Render ───────────────────────────────────────────────────────────
    if (items === null) return h('div', { className: 'kimos-orders' }, h('div', { className: 'ko-empty' }, 'Cargando…'));

    return h('div', { className: 'kimos-orders' },
      // Toolbar
      h('div', { className: 'ko-toolbar' },
        h('input', {
          className: 'ko-search', placeholder: 'Buscar pedidos…',
          value: search, onChange: (e) => setSearch(e.target.value),
        }),
        statuses.length > 1 && h('div', { className: 'ko-chips' },
          statuses.map(([st, n]) => h('button', {
            key: st,
            className: 'ko-filter' + (statusFilter === st ? ' ko-filter-active' : ''),
            onClick: () => setStatusFilter(statusFilter === st ? null : st),
          }, st + ' · ' + n)),
        ),
        h('div', { className: 'ko-spacer' }),
        h('span', { className: 'ko-count' }, visible.length + ' de ' + items.length),
        hasBinding && h('button', { className: 'ko-btn ko-btn-primary', disabled: syncing, onClick: doSync },
          syncing ? 'Sincronizando…' : '⟳ Jumpseller'),
        h('button', { className: 'ko-btn', title: 'Integración', onClick: () => setShowConfig(!showConfig) }, '⚙'),
      ),
      showConfig && h('div', { className: 'ko-config' },
        h('div', null,
          h('div', { className: 'ko-config-title' }, 'Importar desde Jumpseller'),
          h('div', { className: 'ko-config-help' }, 'Al vincular, esta app se llena con los pedidos de la tienda. Las notas internas se preservan en cada re-sync.'),
        ),
        h('button', { className: 'ko-toggle' + (hasBinding ? ' ko-toggle-on' : ''), onClick: toggleBinding, role: 'switch', 'aria-checked': hasBinding },
          h('span', { className: 'ko-toggle-dot' })),
      ),
      msg && h('div', { className: 'ko-msg ko-msg-' + msg.kind }, msg.text),
      error && h('div', { className: 'ko-msg ko-msg-err' }, error),

      // Lista
      items.length === 0
        ? h('div', { className: 'ko-empty' },
            h('div', { className: 'ko-empty-icon' }, '🛒'),
            h('p', null, 'Aún no hay pedidos'),
            hasBinding
              ? h('button', { className: 'ko-btn ko-btn-primary', disabled: syncing, onClick: doSync }, syncing ? 'Sincronizando…' : 'Sincronizar Jumpseller')
              : h('p', { className: 'ko-empty-hint' }, 'Vincula Jumpseller con el botón ⚙ de arriba para importar los pedidos.'))
        : h('div', { className: 'ko-table-wrap' },
            h('table', { className: 'ko-table' },
              h('thead', null, h('tr', null,
                ['#', 'Cliente', 'Estado', 'Items', 'Total', 'Fecha'].map((c, i) =>
                  h('th', { key: c, className: i >= 3 && i <= 4 ? 'ko-right' : '' }, c)),
              )),
              h('tbody', null, visible.map((it) => h('tr', { key: it.id, onClick: () => setSelected(it) },
                h('td', { className: 'ko-mono' }, s(it.number) || '—'),
                h('td', null,
                  h('div', { className: 'ko-strong' }, s(it.customerName) || '—'),
                  s(it.customerEmail) && h('div', { className: 'ko-sub' }, s(it.customerEmail)),
                ),
                h('td', null, chip(it)),
                h('td', { className: 'ko-right' }, s(it.itemsCount) || '—'),
                h('td', { className: 'ko-right ko-strong' }, money(it.total, it.currency)),
                h('td', { className: 'ko-sub' }, fmtDate(it.orderDate)),
              ))),
            )),

      // Detalle
      selected && h('div', { className: 'ko-overlay' },
        h('button', { className: 'ko-overlay-bg', onClick: () => setSelected(null), 'aria-label': 'Cerrar' }),
        h('div', { className: 'ko-panel' },
          h('div', { className: 'ko-panel-head' },
            h('span', { className: 'ko-panel-title' }, 'Pedido #' + s(selected.number || selected.id)),
            h('button', { className: 'ko-btn ko-btn-danger', title: 'Eliminar', onClick: () => removeItem(selected) }, '🗑'),
            h('button', { className: 'ko-btn', onClick: () => setSelected(null) }, '✕'),
          ),
          h('div', { className: 'ko-panel-body' },
            [['Estado', chip(selected)],
             ['Fecha del pedido', fmtDate(selected.orderDate)],
             ['Cliente', s(selected.customerName)],
             ['Email', s(selected.customerEmail)],
             ['Teléfono', s(selected.customerPhone)],
             ['Total', h('strong', null, money(selected.total, selected.currency))],
             ['Método de pago', s(selected.paymentMethod)],
             ['Envío', s(selected.shippingMethod)],
             ['Estado de envío', s(selected.fulfillmentStatus)],
             ['N° de seguimiento', s(selected.trackingNumber)],
            ].map(([label, value]) => (value && value !== '') ? h('div', { key: label, className: 'ko-field' },
              h('div', { className: 'ko-field-label' }, label),
              h('div', { className: 'ko-field-value' }, value),
            ) : null),
            s(selected.trackingUrl) && h('div', { className: 'ko-field' },
              h('div', { className: 'ko-field-label' }, 'Seguimiento'),
              h('a', { href: s(selected.trackingUrl), target: '_blank', rel: 'noopener noreferrer', className: 'ko-link' }, 'Abrir seguimiento'),
            ),
            Array.isArray(selected.products) && selected.products.length > 0 && h('div', { className: 'ko-field' },
              h('div', { className: 'ko-field-label' }, 'Productos'),
              h('div', { className: 'ko-products' }, selected.products.map((p, i) =>
                h('div', { key: i, className: 'ko-product' },
                  h('span', { className: 'ko-product-name' }, s(p && p.name) || 'Producto'),
                  h('span', { className: 'ko-sub' }, '×' + s((p && p.qty) || 1) + ' · ' + money(p && p.price, selected.currency)),
                ))),
            ),
            Array.isArray(selected.sourceLinks) && selected.sourceLinks.some((l) => l && l.integration === 'jumpseller') &&
              h('p', { className: 'ko-synced' }, '✓ Sincronizado con Jumpseller'),
            h('div', { className: 'ko-field ko-notes' },
              h('div', { className: 'ko-field-label' }, 'Notas internas'),
              h('textarea', {
                className: 'ko-textarea', rows: 3,
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
