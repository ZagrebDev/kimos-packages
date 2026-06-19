/**
 * Notas de Equipo — app instalable de EJEMPLO (multiInstance) para validar la
 * plataforma v2 end-to-end:
 *   - Fase 1: acceso por equipo (allowlist `teams` desde la Tienda).
 *   - Fase 2: cada equipo crea sus instancias (HomeLauncher → "Apps" → Nueva).
 *   - Fase 3: datos por instancia vía `shell.items` (subcolección de la instancia).
 *   - Agente: control por agente autorizado (tools ADD_NOTE / DELETE_NOTE / LIST_NOTES).
 *
 * Bundle ESM puro: usa `globalThis.React` (expuesto por el host en main.tsx),
 * sin empaquetar su propia copia de React. Cumple el contrato AppShellV1:
 *   export default function mount(shell) -> { Component, unmount? }
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  // Estado por instancia (mount se llama una vez por ventana).
  let notes = [];
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l(notes.slice()); };

  async function refresh() {
    try { notes = await shell.items.list(); } catch (e) { notes = []; }
    emit();
    return notes;
  }
  async function addNote(text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) return { ok: false, message: 'La nota está vacía.' };
    const created = await shell.items.create({ text: t, createdAt: new Date().toISOString() });
    notes = notes.concat([created]);
    emit();
    return { ok: true, message: 'Nota agregada: "' + t + '".' };
  }
  async function removeNote(id) {
    const key = String(id || '');
    await shell.items.remove(key);
    notes = notes.filter((n) => n.id !== key);
    emit();
    return { ok: true, message: 'Nota eliminada.' };
  }

  // ── Control por agente autorizado ───────────────────────────────────────
  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'Notas de Equipo',
      description: 'Bloc de notas por equipo (instancia). Puede listar, agregar y eliminar notas.',
      tools: [
        {
          name: 'ADD_NOTE',
          description: 'Agrega una nota a esta instancia.',
          inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Texto de la nota.' } }, required: ['text'] },
        },
        {
          name: 'DELETE_NOTE',
          description: 'Elimina una nota por su id.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        },
        {
          name: 'LIST_NOTES',
          description: 'Lista las notas actuales de esta instancia.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      getSnapshot: () => ({
        total: notes.length,
        notas: notes.map((n) => ({ id: n.id, text: n.text })),
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          if (type === 'ADD_NOTE') {
            const r = await addNote(p.text);
            return { success: r.ok, message: r.message, error: r.ok ? undefined : r.message };
          }
          if (type === 'DELETE_NOTE') {
            const r = await removeNote(p.id);
            return { success: true, message: r.message };
          }
          if (type === 'LIST_NOTES') {
            await refresh();
            return {
              success: true,
              message: notes.length
                ? ('Hay ' + notes.length + ' nota(s): ' + notes.map((n) => n.text).join('; '))
                : 'No hay notas todavía.',
            };
          }
          return { success: false, error: 'Acción no soportada: ' + type };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      },
    });
  }

  // ── UI (React del host, sin JSX) ────────────────────────────────────────
  function Component() {
    const [items, setItems] = useState(notes.slice());
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      listeners.add(setItems);
      refresh().finally(() => setLoading(false));
      return () => { listeners.delete(setItems); };
    }, []);

    const submit = () => {
      const v = text;
      setText('');
      void addNote(v);
    };

    return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', color: '#0A192F', background: '#fff' } }, [
      h('div', { key: 'header', style: { padding: '16px 20px', borderBottom: '1px solid #e5e7eb' } }, [
        h('div', { key: 't', style: { fontWeight: 700, fontSize: 16 } }, '🗒️ Notas de Equipo'),
        h('div', { key: 's', style: { fontSize: 12, color: '#6b7280', marginTop: 2 } },
          (shell.app.instanceId ? ('Instancia: ' + shell.app.instanceId) : 'Sin instancia (crea una desde Apps)')
          + (shell.app.teamId ? (' · equipo ' + shell.app.teamId) : '')),
      ]),
      h('div', { key: 'body', style: { flex: 1, overflowY: 'auto', padding: '8px 20px' } },
        loading
          ? h('div', { style: { color: '#6b7280', fontSize: 14, padding: '12px 0' } }, 'Cargando…')
          : items.length === 0
            ? h('div', { style: { color: '#9ca3af', fontSize: 14, padding: '12px 0' } }, 'Sin notas todavía. Agrega la primera abajo.')
            : items.map((n) => h('div', {
                key: n.id,
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' },
              }, [
                h('span', { key: 'tx', style: { fontSize: 14 } }, String(n.text || '')),
                h('button', {
                  key: 'del',
                  onClick: () => void removeNote(n.id),
                  style: { border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 13 },
                }, 'Eliminar'),
              ]))
      ),
      h('div', { key: 'input', style: { display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb' } }, [
        h('input', {
          key: 'in',
          value: text,
          placeholder: 'Nueva nota…',
          onChange: (e) => setText(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter') submit(); },
          style: { flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' },
        }),
        h('button', {
          key: 'add',
          onClick: submit,
          style: { padding: '8px 16px', background: '#19ACB1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
        }, 'Agregar'),
      ]),
    ]);
  }

  return {
    Component,
    unmount() {
      listeners.clear();
      if (typeof unregisterAgent === 'function') {
        try { unregisterAgent(); } catch (e) { /* noop */ }
      }
    },
  };
}
