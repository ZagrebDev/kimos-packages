/**
 * Buzón de Sugerencias — app de EJEMPLO de terceros (multiInstance).
 *
 * Superficie MÍNIMA del gateway público: solo `public.submit` en el manifest.
 * El widget (assets/embed.js) no lee nada — solo postea sugerencias al canal
 * 'sugerencia', que llegan como items kind='submission' y se leen aquí con
 * shell.items. La definición solo necesita el opt-in del gateway.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  const APP_ID = 'miorg.buzon';
  const instanceId = shell.app && shell.app.instanceId;

  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) {
      return window.location.origin;
    }
  }
  const embedSrc = apiBase() + '/api/apps/' + APP_ID + '/asset/embed.js';

  function defaultDefinition() {
    return {
      id: 'definition',
      kind: 'definition',
      // Opt-in mínimo del gateway: sin `data` pública (no hay public.read).
      public: { enabled: false, channels: ['sugerencia'] },
    };
  }

  let definition = null;
  let definitionExists = false;
  let suggestions = [];
  let loading = true;
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l({ definition, suggestions, loading }); };

  async function refresh() {
    if (!instanceId) { loading = false; emit(); return; }
    try {
      const items = await shell.items.list();
      const def = items.find((i) => i.id === 'definition' || i.kind === 'definition');
      suggestions = items.filter((i) => i.kind === 'submission')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      if (def) { definition = def; definitionExists = true; }
      else if (!definition) definition = defaultDefinition();
    } catch (e) {
      if (!definition) definition = defaultDefinition();
    }
    loading = false;
    emit();
  }

  async function setEnabled(enabled) {
    const next = { ...(definition || defaultDefinition()), public: { ...((definition || {}).public || {}), enabled, channels: ['sugerencia'] } };
    definition = next;
    emit();
    try {
      if (definitionExists) await shell.items.update('definition', next);
      else { await shell.items.create(next); definitionExists = true; }
      shell.notify({ level: 'success', text: enabled ? 'Buzón publicado.' : 'Buzón despublicado.' });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar.' });
    }
  }

  async function removeSuggestion(id) {
    try {
      await shell.items.remove(id);
      suggestions = suggestions.filter((s) => s.id !== id);
      emit();
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo eliminar.' });
    }
  }

  function fmtDate(iso) {
    try { const d = new Date(iso); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5); }
    catch (e) { return String(iso || ''); }
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => shell.notify({ level: 'success', text: 'Copiado.' }));
    }
  }

  function Component() {
    const [state, setState] = useState({ definition, suggestions, loading });
    useEffect(() => {
      listeners.add(setState);
      void refresh();
      const t = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refresh();
      }, 30000);
      return () => { listeners.delete(setState); clearInterval(t); };
    }, []);

    if (!instanceId) {
      return h('div', { className: 'kimos-buzon' },
        h('div', { className: 'buz-empty' }, 'Crea un documento desde la pantalla de bienvenida: cada uno es un buzón distinto.'));
    }

    const pub = (state.definition && state.definition.public) || {};
    const snippet =
      '<div data-kimos-buzon="' + instanceId + '"></div>\n' +
      '<script src="' + embedSrc + '"\n        data-instance="' + instanceId + '"\n' +
      '        data-title="Buzón de sugerencias" async></script>';

    return h('div', { className: 'kimos-buzon' }, [
      h('div', { key: 'head', className: 'buz-head' }, [
        h('div', { key: 't', className: 'buz-title' }, '📮 Buzón de Sugerencias'),
        h('label', { key: 'en', className: 'buz-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: pub.enabled === true, onChange: (e) => void setEnabled(e.target.checked) }),
          h('span', { key: 's' }, pub.enabled === true ? 'Publicado' : 'Despublicado'),
        ]),
        h('button', { key: 'r', className: 'buz-btn buz-btn-ghost', title: 'Actualizar', onClick: () => void refresh() }, '⟳'),
      ]),
      h('div', { key: 'body', className: 'buz-body' }, [
        h('div', { key: 'embed', className: 'buz-card' }, [
          h('div', { key: 'h', className: 'buz-card-title' }, 'Incrustar en tu web'),
          h('pre', { key: 'c', className: 'buz-code' }, snippet),
          h('button', { key: 'b', className: 'buz-btn buz-btn-primary', onClick: () => copy(snippet) }, 'Copiar'),
        ]),
        h('div', { key: 'list', className: 'buz-card' }, [
          h('div', { key: 'h', className: 'buz-card-title' }, 'Sugerencias recibidas (' + state.suggestions.length + ')'),
          state.loading
            ? h('div', { key: 'l', className: 'buz-muted' }, 'Cargando…')
            : state.suggestions.length === 0
              ? h('div', { key: 'e', className: 'buz-muted' }, 'Aún no hay sugerencias.')
              : state.suggestions.map((s) => h('div', { key: s.id, className: 'buz-item' }, [
                  h('div', { key: 'tx', className: 'buz-item-text' }, String((s.data || {}).sugerencia || '')),
                  h('div', { key: 'meta', className: 'buz-item-meta' }, [
                    h('span', { key: 'd' }, fmtDate(s.createdAt)),
                    h('button', { key: 'x', className: 'buz-btn buz-btn-danger', onClick: () => { if (window.confirm('¿Eliminar sugerencia?')) void removeSuggestion(s.id); } }, '✕'),
                  ]),
                ])),
        ]),
      ]),
    ]);
  }

  return { Component, unmount() { listeners.clear(); } };
}
