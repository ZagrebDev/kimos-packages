/**
 * Panel HTML — app instalable de Kimos.
 *
 * Bundle ESM autocontenido. Usa React desde globalThis (lo expone el shell).
 *
 * Contrato:
 *   export default function mount(shell): { Component }
 *
 * Persistencia: shell.saveData/loadData ↔ instance.json (config.html).
 *
 * v0.8.887: bundle reescrito desde cero siguiendo el patrón de Kanban
 * (estilos inline robustos, sin depender exclusivamente del index.css; sin
 * "loading state" que pueda quedarse pegado; iframe con srcDoc).
 */

const DEFAULT_HTML =
  '<!doctype html>\n' +
  '<html lang="es">\n' +
  '<head>\n' +
  '  <meta charset="utf-8" />\n' +
  '  <meta name="viewport" content="width=device-width,initial-scale=1" />\n' +
  '  <title>Panel HTML</title>\n' +
  '  <style>\n' +
  '    body { margin: 0; padding: 40px; font-family: -apple-system, system-ui, sans-serif; color: #1f2328; background: #ffffff; }\n' +
  '    h1 { margin: 0 0 12px; font-size: 24px; }\n' +
  '    p { margin: 0; color: #656d76; line-height: 1.6; }\n' +
  '    .card { max-width: 560px; padding: 24px; border: 1px solid #d1d9e0; border-radius: 12px; }\n' +
  '  </style>\n' +
  '</head>\n' +
  '<body>\n' +
  '  <div class="card">\n' +
  '    <h1>Hola desde Panel HTML 👋</h1>\n' +
  '    <p>Click en <strong>Editar HTML</strong> arriba para escribir tu propio contenido. Se guarda en esta instancia.</p>\n' +
  '  </div>\n' +
  '</body>\n' +
  '</html>';

export default function mount(shell) {
  const R = globalThis.React;
  if (!R) {
    return {
      Component() {
        return null;
      },
    };
  }
  const { useState, useEffect, useCallback } = R;
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
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Carga inicial — NO bloquea el render (sin "Cargando…" pegado).
    useEffect(() => {
      let cancelled = false;
      shell
        .loadData()
        .then(function (data) {
          if (cancelled) return;
          if (data && typeof data === 'object' && typeof data.html === 'string' && data.html.trim()) {
            setHtml(data.html);
            setDraft(data.html);
          }
        })
        .catch(function () {
          /* sin datos previos: arranca con DEFAULT_HTML */
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

    // Estilos inline para que la app funcione incluso si el CSS no cargó.
    const sRoot = {
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--background, #0b0f17)',
      color: 'var(--foreground, #e6edf3)',
      overflow: 'hidden',
    };
    const sToolbar = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 10px',
      borderBottom: '1px solid var(--border, #2a2a2a)',
      flex: '0 0 auto',
      minHeight: '36px',
    };
    const sTitle = { fontSize: '12px', fontWeight: 600, flex: 1, opacity: 0.85 };
    const sBtn = (variant) => ({
      appearance: 'none',
      border: '1px solid transparent',
      borderRadius: '6px',
      padding: '5px 10px',
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
      background:
        variant === 'primary'
          ? 'hsl(var(--primary, 178 96% 59%))'
          : 'transparent',
      color:
        variant === 'primary'
          ? 'hsl(var(--primary-foreground, 220 20% 10%))'
          : 'var(--foreground, #e6edf3)',
      borderColor:
        variant === 'ghost' ? 'transparent' : 'var(--border, #2a2a2a)',
    });
    const sBody = { flex: '1 1 auto', minHeight: 0, display: 'flex' };
    const sEditor = {
      flex: '1 1 auto',
      width: '100%',
      height: '100%',
      border: 0,
      padding: '12px',
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      fontSize: '12px',
      lineHeight: 1.5,
      background: 'hsl(var(--background, 220 20% 8%))',
      color: 'hsl(var(--foreground, 220 20% 95%))',
      resize: 'none',
      outline: 'none',
    };
    const sIframe = {
      flex: '1 1 auto',
      width: '100%',
      height: '100%',
      border: 0,
      background: '#ffffff',
    };

    const toolbar = h(
      'div',
      { style: sToolbar },
      h('span', { style: sTitle }, 'Panel HTML'),
      editing
        ? [
            h(
              'button',
              {
                key: 'cancel',
                onClick: handleCancel,
                disabled: saving,
                style: sBtn('ghost'),
              },
              'Cancelar',
            ),
            h(
              'button',
              {
                key: 'save',
                onClick: handleSave,
                disabled: saving || !dirty,
                style: sBtn('primary'),
              },
              saving ? 'Guardando…' : 'Guardar',
            ),
          ]
        : h(
            'button',
            { key: 'edit', onClick: handleEdit, style: sBtn('primary') },
            'Editar HTML',
          ),
    );

    const body = editing
      ? h('textarea', {
          value: draft,
          onChange: function (e) {
            setDraft(e.target.value);
            setDirty(true);
          },
          spellCheck: false,
          style: sEditor,
        })
      : h('iframe', {
          srcDoc: html,
          sandbox: 'allow-scripts allow-forms allow-modals',
          title: 'Panel HTML',
          style: sIframe,
        });

    return h('div', { style: sRoot }, toolbar, h('div', { style: sBody }, body));
  }

  return { Component };
}
