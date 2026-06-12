/**
 * Panel HTML — app instalable de Kimos.
 *
 * Bundle ESM autocontenido. Usa React desde el global (window.React) que
 * expone el sistema huésped para que los hooks funcionen contra la misma
 * instancia de React del shell.
 *
 * Contrato (ver kimos-enterprice/src/v2/app-shell/contract.ts):
 *   export default function mount(shell): { Component }
 *
 * Persistencia: shell.saveData/loadData ↔ /equipos/{tid}/data/{instId}/instance.json
 */

const DEFAULT_HTML = [
  '<!doctype html>',
  '<html lang="es">',
  '<head>',
  '  <meta charset="utf-8" />',
  '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
  '  <title>Panel HTML</title>',
  '  <style>',
  '    body { margin: 0; padding: 40px; font-family: -apple-system, system-ui, sans-serif; color: #1f2328; background: #ffffff; }',
  '    h1 { margin: 0 0 12px; font-size: 24px; }',
  '    p { margin: 0; color: #656d76; line-height: 1.6; }',
  '    .card { max-width: 560px; padding: 24px; border: 1px solid #d1d9e0; border-radius: 12px; }',
  '  </style>',
  '</head>',
  '<body>',
  '  <div class="card">',
  '    <h1>Hola desde Panel HTML 👋</h1>',
  '    <p>Esta es una instancia nueva. Haz clic en <strong>Editar HTML</strong> para escribir tu propio contenido. Lo que guardes queda en <code>/equipos/&lt;tu-equipo&gt;/data/&lt;esta-instancia&gt;/instance.json</code>.</p>',
  '  </div>',
  '</body>',
  '</html>',
].join('\n');

export default function mount(shell) {
  const R = globalThis.React;
  if (!R) {
    return {
      Component() {
        return null;
      },
    };
  }
  const { useEffect, useState, useCallback } = R;
  const h = R.createElement;

  function notify(level, text) {
    try {
      shell.notify({ level, text });
    } catch {
      /* no-op */
    }
  }

  function Component() {
    const [html, setHtml] = useState(DEFAULT_HTML);
    const [draft, setDraft] = useState(DEFAULT_HTML);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
      let cancelled = false;
      shell
        .loadData()
        .then(function (data) {
          if (cancelled) return;
          const incoming =
            (data && typeof data === 'object' && typeof data.html === 'string' && data.html.trim() && data.html) ||
            DEFAULT_HTML;
          setHtml(incoming);
          setDraft(incoming);
          // Si no hay nada guardado, mostramos el editor para que empiece.
          if (!data) setEditing(true);
        })
        .catch(function () {
          setEditing(true);
        })
        .finally(function () {
          if (!cancelled) setLoading(false);
        });
      return function () {
        cancelled = true;
      };
    }, []);

    const handleEdit = useCallback(function () {
      setDraft(html);
      setDirty(false);
      setEditing(true);
    }, [html]);

    const handleCancel = useCallback(function () {
      setEditing(false);
      setDirty(false);
      setDraft(html);
    }, [html]);

    const handleSave = useCallback(async function () {
      setSaving(true);
      try {
        await shell.saveData({ html: draft });
        setHtml(draft);
        setDirty(false);
        setEditing(false);
        notify('success', 'Panel guardado');
      } catch (err) {
        const msg = (err && err.message) || 'No se pudo guardar';
        notify('error', msg);
      } finally {
        setSaving(false);
      }
    }, [draft]);

    if (loading) {
      return h(
        'div',
        { className: 'kimos-panel-html', style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground, #888)', fontSize: '13px' } },
        'Cargando panel…',
      );
    }

    const toolbar = h(
      'div',
      {
        className: 'khp-toolbar',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border, #2a2a2a)',
          flex: '0 0 auto',
          background: 'var(--background, transparent)',
        },
      },
      h('span', { className: 'khp-title', style: { fontSize: '13px', fontWeight: 600, flex: 1 } }, 'Panel HTML'),
      editing
        ? [
            h(
              'button',
              {
                key: 'cancel',
                onClick: handleCancel,
                className: 'khp-btn khp-btn-ghost',
                disabled: saving,
              },
              'Cancelar',
            ),
            h(
              'button',
              {
                key: 'save',
                onClick: handleSave,
                className: 'khp-btn khp-btn-primary',
                disabled: saving || !dirty,
              },
              saving ? 'Guardando…' : 'Guardar',
            ),
          ]
        : h(
            'button',
            {
              key: 'edit',
              onClick: handleEdit,
              className: 'khp-btn khp-btn-primary',
            },
            'Editar HTML',
          ),
    );

    const body = editing
      ? h('textarea', {
          className: 'khp-editor',
          value: draft,
          onChange: function (e) {
            setDraft(e.target.value);
            setDirty(true);
          },
          spellCheck: false,
        })
      : h('iframe', {
          className: 'khp-iframe',
          srcDoc: html,
          sandbox: 'allow-scripts allow-forms allow-modals',
          title: 'Panel HTML',
        });

    return h(
      'div',
      {
        className: 'kimos-panel-html',
        style: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background, #0b0f17)', color: 'var(--foreground, #e6edf3)' },
      },
      toolbar,
      h('div', { className: 'khp-body', style: { flex: 1, minHeight: 0, display: 'flex' } }, body),
    );
  }

  return { Component };
}
