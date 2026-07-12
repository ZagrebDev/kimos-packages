/**
 * Encuesta Rápida — app de EJEMPLO de terceros (multiInstance).
 *
 * Demuestra el patrón "cero backend a medida": todo lo público pasa por el
 * gateway genérico de la plataforma, habilitado por los permissions del
 * manifest (public.read + public.submit) y el opt-in en definition.public.
 *
 *   - La app guarda la encuesta en items/definition con el bloque `public`
 *     ({ enabled, channels: ['respuesta'], data: {…} }).
 *   - El widget (assets/embed.js, servido público como asset) lee
 *     GET /api/public/app/{id}/definition y postea a /submit/respuesta.
 *   - Las respuestas llegan como items kind='submission' y se gestionan
 *     aquí con shell.items — sin ningún endpoint a medida.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  const APP_ID = 'miorg.encuestas';
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
  const embedSrc = base + '/api/apps/' + APP_ID + '/asset/embed.js';

  function defaultDefinition() {
    return {
      id: 'definition',
      kind: 'definition',
      // Bloque leído por el gateway público (/api/public/app/...):
      public: {
        enabled: false,
        channels: ['respuesta'],
        data: {
          title: 'Tu opinión nos importa',
          question: '¿Cómo calificarías tu experiencia?',
          options: ['Excelente', 'Buena', 'Regular', 'Mala'],
          askComment: true,
          commentLabel: 'Cuéntanos más (opcional)',
          button: 'Enviar',
          thanks: '¡Gracias por tu respuesta!',
          accent: '#19ACB1',
        },
      },
    };
  }

  // ── Estado del closure ────────────────────────────────────────────────────
  let definition = null;
  let definitionExists = false;
  let responses = [];
  let loading = true;
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l({ definition, responses, loading }); };

  async function refresh() {
    if (!instanceId) { loading = false; emit(); return; }
    try {
      const items = await shell.items.list();
      const def = items.find((i) => i.id === 'definition' || i.kind === 'definition');
      responses = items.filter((i) => i.kind === 'submission')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      if (def) { definition = def; definitionExists = true; }
      else if (!definition) definition = defaultDefinition();
    } catch (e) {
      console.error('[encuestas] refresh', e);
      if (!definition) definition = defaultDefinition();
    }
    loading = false;
    emit();
  }

  async function saveDefinition(next) {
    definition = next;
    emit();
    try {
      if (definitionExists) await shell.items.update('definition', next);
      else { await shell.items.create(next); definitionExists = true; }
      shell.notify({ level: 'success', text: 'Encuesta guardada.' });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar la encuesta.' });
    }
  }

  async function deleteResponse(id) {
    try {
      await shell.items.remove(id);
      responses = responses.filter((r) => r.id !== id);
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
    const done = () => shell.notify({ level: 'success', text: 'Copiado al portapapeles.' });
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done);
  }

  // ── Pestaña: Resultados ───────────────────────────────────────────────────
  function ResultsTab({ state }) {
    if (state.loading) return h('div', { className: 'enc-empty' }, 'Cargando…');
    const pub = (state.definition && state.definition.public) || {};
    const options = (pub.data && pub.data.options) || [];
    const total = state.responses.length;
    const counts = options.map((opt) => ({
      opt,
      n: state.responses.filter((r) => (r.data || {}).opcion === opt).length,
    }));
    return h('div', { className: 'enc-design' }, [
      h('div', { key: 'sum', className: 'enc-card' }, [
        h('div', { key: 'h', className: 'enc-card-title' }, 'Resultados (' + total + ' respuestas)'),
        total === 0
          ? h('div', { key: 'e', className: 'enc-muted' }, 'Aún no hay respuestas. Incrusta la encuesta y compártela.')
          : h('div', { key: 'bars' }, counts.map(({ opt, n }) => {
              const pct = total ? Math.round((n / total) * 100) : 0;
              return h('div', { key: opt, className: 'enc-bar-row' }, [
                h('div', { key: 'l', className: 'enc-bar-label' }, opt + ' — ' + n + ' (' + pct + '%)'),
                h('div', { key: 'b', className: 'enc-bar-track' },
                  h('div', { className: 'enc-bar-fill', style: { width: pct + '%' } })),
              ]);
            })),
      ]),
      h('div', { key: 'list', className: 'enc-card' }, [
        h('div', { key: 'h', className: 'enc-card-title' }, 'Respuestas individuales'),
        state.responses.length === 0
          ? h('div', { key: 'e', className: 'enc-muted' }, 'Sin respuestas.')
          : state.responses.map((r) => h('div', { key: r.id, className: 'enc-resp' }, [
              h('div', { key: 'main', className: 'enc-resp-main' }, [
                h('span', { key: 'o', className: 'enc-resp-opt' }, String((r.data || {}).opcion || '—')),
                (r.data || {}).comentario && h('span', { key: 'c', className: 'enc-resp-comment' }, '“' + r.data.comentario + '”'),
              ]),
              h('div', { key: 'meta', className: 'enc-resp-meta' }, [
                h('span', { key: 'd' }, fmtDate(r.createdAt)),
                h('button', { key: 'x', className: 'enc-btn enc-btn-danger', onClick: () => { if (window.confirm('¿Eliminar respuesta?')) void deleteResponse(r.id); } }, '✕'),
              ]),
            ])),
      ]),
    ]);
  }

  // ── Pestaña: Diseño ───────────────────────────────────────────────────────
  function DesignTab({ state }) {
    const def = state.definition;
    const [draft, setDraft] = useState(def);
    const [dirty, setDirty] = useState(false);
    useEffect(() => { if (!dirty) setDraft(def); }, [def]);
    if (!draft) return h('div', { className: 'enc-empty' }, 'Cargando…');

    const pub = draft.public || {};
    const data = pub.data || {};
    const upData = (patch) => {
      setDraft({ ...draft, public: { ...pub, data: { ...data, ...patch } } });
      setDirty(true);
    };
    const upPub = (patch) => { setDraft({ ...draft, public: { ...pub, ...patch } }); setDirty(true); };

    const row = (label, node) => h('div', { className: 'enc-form-row' }, [
      h('label', { key: 'l', className: 'enc-label' }, label), node,
    ]);

    return h('div', { className: 'enc-design' }, [
      h('div', { key: 'c1', className: 'enc-card' }, [
        h('div', { key: 'h', className: 'enc-card-title' }, 'Encuesta'),
        row('Título', h('input', { key: 'i', className: 'enc-input', value: data.title || '', onChange: (e) => upData({ title: e.target.value }) })),
        row('Pregunta', h('input', { key: 'i', className: 'enc-input', value: data.question || '', onChange: (e) => upData({ question: e.target.value }) })),
        row('Opciones (separadas por coma)', h('input', {
          key: 'i', className: 'enc-input',
          value: (data.options || []).join(', '),
          onChange: (e) => upData({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }),
        })),
        row('Mensaje de agradecimiento', h('input', { key: 'i', className: 'enc-input', value: data.thanks || '', onChange: (e) => upData({ thanks: e.target.value }) })),
        h('label', { key: 'ac', className: 'enc-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: !!data.askComment, onChange: (e) => upData({ askComment: e.target.checked }) }),
          h('span', { key: 's' }, 'Pedir comentario opcional'),
        ]),
        h('label', { key: 'en', className: 'enc-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: pub.enabled === true, onChange: (e) => upPub({ enabled: e.target.checked }) }),
          h('span', { key: 's' }, pub.enabled ? 'Publicada — el gateway acepta respuestas' : 'Despublicada — el gateway responde 403'),
        ]),
      ]),
      h('div', { key: 'save', className: 'enc-savebar' }, [
        dirty && h('span', { key: 's', className: 'enc-muted' }, 'Cambios sin guardar'),
        h('button', {
          key: 'b', className: 'enc-btn enc-btn-primary',
          disabled: !dirty || !(data.options || []).length,
          onClick: () => { setDirty(false); void saveDefinition(draft); },
        }, 'Guardar encuesta'),
      ]),
    ]);
  }

  // ── Pestaña: Incrustar ────────────────────────────────────────────────────
  function EmbedTab({ state }) {
    const pub = (state.definition && state.definition.public) || {};
    const snippet =
      '<div data-kimos-encuesta="' + instanceId + '"></div>\n' +
      '<script src="' + embedSrc + '"\n        data-instance="' + instanceId + '" async></script>';
    return h('div', { className: 'enc-design' }, [
      pub.enabled !== true && h('div', { key: 'w', className: 'enc-warn' },
        'La encuesta está despublicada: el gateway rechazará las respuestas. Actívala en Diseño.'),
      h('div', { key: 'c', className: 'enc-card' }, [
        h('div', { key: 'h', className: 'enc-card-title' }, 'Incrustar en tu web'),
        h('div', { key: 'd', className: 'enc-muted', style: { marginBottom: 8 } },
          'El widget es un asset de esta app (sin backend a medida): lee la encuesta por el gateway público y envía las respuestas por el canal "respuesta".'),
        h('pre', { key: 'code', className: 'enc-code' }, snippet),
        h('button', { key: 'b', className: 'enc-btn enc-btn-primary', onClick: () => copy(snippet) }, 'Copiar'),
      ]),
    ]);
  }

  // ── Raíz ──────────────────────────────────────────────────────────────────
  function Component() {
    const [state, setState] = useState({ definition, responses, loading });
    const [tab, setTab] = useState('results');
    useEffect(() => {
      listeners.add(setState);
      void refresh();
      const t = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refresh();
      }, 30000);
      return () => { listeners.delete(setState); clearInterval(t); };
    }, []);

    if (!instanceId) {
      return h('div', { className: 'kimos-encuestas' },
        h('div', { className: 'enc-empty' }, 'Crea un documento desde la pantalla de bienvenida: cada uno es una encuesta distinta.'));
    }
    const tabs = [['results', '📊 Resultados'], ['design', '🛠️ Diseño'], ['embed', '🔗 Incrustar']];
    return h('div', { className: 'kimos-encuestas' }, [
      h('div', { key: 'tabs', className: 'enc-tabs' },
        tabs.map(([id, label]) => h('button', {
          key: id, className: 'enc-tab' + (tab === id ? ' enc-tab-active' : ''), onClick: () => setTab(id),
        }, label)).concat([
          h('button', { key: 'r', className: 'enc-tab enc-tab-right', title: 'Actualizar', onClick: () => void refresh() }, '⟳'),
        ])),
      h('div', { key: 'body', className: 'enc-body' },
        tab === 'results' ? h(ResultsTab, { state }) : tab === 'design' ? h(DesignTab, { state }) : h(EmbedTab, { state })),
    ]);
  }

  return { Component, unmount() { listeners.clear(); } };
}
