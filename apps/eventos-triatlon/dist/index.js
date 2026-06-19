/**
 * Eventos Triatlón — app instalable multi-instancia (ESQUELETO / Fase 4).
 *
 * Cada INSTANCIA = un evento (p.ej. "Triatlón Antofagasta 2026"), creado por un
 * equipo. Construida SOBRE la plataforma genérica v2:
 *   - Fase 1: acceso por equipo (allowlist desde la Tienda).
 *   - Fase 2: instancias por equipo (multiInstance).
 *   - Fase 3: registro de COMPETIDORES por instancia vía `shell.items`.
 *   - Config del evento (nombre, costo) por instancia vía `shell.saveData/loadData`.
 *   - Control por agente autorizado (tools por instancia).
 *
 * Es un ESQUELETO: la UI del tótem es un placeholder mínimo data-driven. El
 * flujo/visual definitivo del tótem se reemplaza aquí dentro sin tocar la
 * integración de plataforma (items + config + agente).
 *
 * Bundle ESM puro: usa `globalThis.React`. Contrato AppShellV1.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  // ── Estado por instancia ────────────────────────────────────────────────
  let competidores = [];           // items de la instancia: {id, rut, nombre, tipo, inscrito, pagado}
  let evento = { nombre: 'Evento sin nombre', costoNoFederado: 15000 };
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l({ competidores: competidores.slice(), evento: { ...evento } }); };

  function normRut(v) {
    return String(v == null ? '' : v).replace(/[^0-9kK]/g, '').toUpperCase();
  }
  function fmtRut(v) {
    const s = normRut(v);
    if (s.length < 2) return s;
    const body = s.slice(0, -1), dv = s.slice(-1);
    return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
  }
  function findByRut(rut) {
    const n = normRut(rut);
    return competidores.find((c) => normRut(c.rut) === n);
  }

  async function refresh() {
    try { competidores = await shell.items.list(); } catch (e) { competidores = []; }
    try {
      const cfg = await shell.loadData();
      if (cfg && typeof cfg === 'object') evento = { ...evento, ...cfg };
    } catch (e) { /* sin config aún */ }
    emit();
  }

  async function addCompetidor({ rut, nombre, tipo }) {
    const n = normRut(rut);
    if (n.length < 7) return { ok: false, message: 'RUT inválido o incompleto.' };
    if (findByRut(n)) return { ok: false, message: 'Ese RUT ya está registrado en el evento.' };
    const t = (tipo === 'federado') ? 'federado' : 'nofederado';
    const created = await shell.items.create({ rut: n, nombre: String(nombre || '').trim(), tipo: t, inscrito: false, pagado: false });
    competidores = competidores.concat([created]);
    emit();
    return { ok: true, message: 'Competidor agregado: ' + (created.nombre || fmtRut(n)) + ' (' + t + ').' };
  }
  async function removeCompetidor(rut) {
    const c = findByRut(rut);
    if (!c) return { ok: false, message: 'No existe un competidor con ese RUT.' };
    await shell.items.remove(c.id);
    competidores = competidores.filter((x) => x.id !== c.id);
    emit();
    return { ok: true, message: 'Competidor eliminado.' };
  }
  async function registrar(rut) {
    const c = findByRut(rut);
    if (!c) return { ok: false, message: 'El RUT ' + fmtRut(rut) + ' no está registrado en el evento. Consulta en boletería.' };
    if (c.tipo === 'federado') {
      const upd = await shell.items.update(c.id, { inscrito: true });
      competidores = competidores.map((x) => (x.id === c.id ? { ...x, ...upd, inscrito: true } : x));
      emit();
      return { ok: true, message: 'Competidor FEDERADO ' + (c.nombre || '') + ' inscrito, sin costo. Puede retirar su KIT.' };
    }
    return { ok: true, message: 'Competidor NO federado ' + (c.nombre || '') + '. Requiere pago de $' + evento.costoNoFederado + '. Usa CONFIRMAR_PAGO para confirmar.' };
  }
  async function confirmarPago(rut) {
    const c = findByRut(rut);
    if (!c) return { ok: false, message: 'No existe un competidor con ese RUT.' };
    if (c.tipo === 'federado') return { ok: false, message: 'Un competidor federado no requiere pago.' };
    const upd = await shell.items.update(c.id, { inscrito: true, pagado: true });
    competidores = competidores.map((x) => (x.id === c.id ? { ...x, ...upd, inscrito: true, pagado: true } : x));
    emit();
    return { ok: true, message: 'Pago de $' + evento.costoNoFederado + ' confirmado. ' + (c.nombre || '') + ' puede retirar su KIT.' };
  }
  async function setEventName(nombre) {
    const nm = String(nombre || '').trim();
    if (!nm) return { ok: false, message: 'El nombre del evento no puede estar vacío.' };
    evento = { ...evento, nombre: nm };
    try { await shell.saveData({ nombre: nm, costoNoFederado: evento.costoNoFederado }); } catch (e) { /* best-effort */ }
    emit();
    return { ok: true, message: 'Evento renombrado a "' + nm + '".' };
  }

  // ── Control por agente autorizado ───────────────────────────────────────
  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'Eventos Triatlón',
      description: 'Gestión de un evento de triatlón (instancia): registro de competidores, validación e inscripción.',
      tools: [
        { name: 'REGISTRAR', description: 'Valida un RUT contra el registro del evento e inscribe si corresponde. payload: { rut }', inputSchema: { type: 'object', properties: { rut: { type: 'string' } }, required: ['rut'] } },
        { name: 'CONFIRMAR_PAGO', description: 'Confirma el pago de un competidor no federado. payload: { rut }', inputSchema: { type: 'object', properties: { rut: { type: 'string' } }, required: ['rut'] } },
        { name: 'ADD_COMPETITOR', description: 'Agrega un competidor al evento. payload: { rut, nombre, tipo: federado|nofederado }', inputSchema: { type: 'object', properties: { rut: { type: 'string' }, nombre: { type: 'string' }, tipo: { type: 'string', enum: ['federado', 'nofederado'] } }, required: ['rut'] } },
        { name: 'REMOVE_COMPETITOR', description: 'Elimina un competidor por su RUT. payload: { rut }', inputSchema: { type: 'object', properties: { rut: { type: 'string' } }, required: ['rut'] } },
        { name: 'LIST_COMPETITORS', description: 'Lista los competidores del evento.', inputSchema: { type: 'object', properties: {} } },
        { name: 'SET_EVENT_NAME', description: 'Renombra el evento. payload: { nombre }', inputSchema: { type: 'object', properties: { nombre: { type: 'string' } }, required: ['nombre'] } },
      ],
      getSnapshot: () => ({
        evento: evento.nombre,
        costoNoFederado: evento.costoNoFederado,
        totalCompetidores: competidores.length,
        competidores: competidores.map((c) => ({ rut: fmtRut(c.rut), nombre: c.nombre, tipo: c.tipo, inscrito: !!c.inscrito })),
        instrucciones: 'Para inscribir a alguien por su RUT usa REGISTRAR { rut }. Si es no federado, luego CONFIRMAR_PAGO { rut }. Informa siempre el resultado.',
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          if (type === 'REGISTRAR') { const r = await registrar(p.rut); return { success: r.ok, message: r.message, error: r.ok ? undefined : r.message }; }
          if (type === 'CONFIRMAR_PAGO') { const r = await confirmarPago(p.rut); return { success: r.ok, message: r.message, error: r.ok ? undefined : r.message }; }
          if (type === 'ADD_COMPETITOR') { const r = await addCompetidor(p); return { success: r.ok, message: r.message, error: r.ok ? undefined : r.message }; }
          if (type === 'REMOVE_COMPETITOR') { const r = await removeCompetidor(p.rut); return { success: r.ok, message: r.message, error: r.ok ? undefined : r.message }; }
          if (type === 'LIST_COMPETITORS') { await refresh(); return { success: true, message: competidores.length ? ('Competidores: ' + competidores.map((c) => (c.nombre || fmtRut(c.rut)) + ' (' + c.tipo + ')').join('; ')) : 'No hay competidores registrados.' }; }
          if (type === 'SET_EVENT_NAME') { const r = await setEventName(p.nombre); return { success: r.ok, message: r.message, error: r.ok ? undefined : r.message }; }
          return { success: false, error: 'Acción no soportada: ' + type };
        } catch (e) { return { success: false, error: String(e) }; }
      },
    });
  }

  // ── UI placeholder (data-driven) ────────────────────────────────────────
  function Component() {
    const [state, setState] = useState({ competidores: competidores.slice(), evento: { ...evento } });
    const [rut, setRut] = useState('');
    const [result, setResult] = useState(null);
    const [nuevo, setNuevo] = useState({ rut: '', nombre: '', tipo: 'nofederado' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      listeners.add(setState);
      refresh().finally(() => setLoading(false));
      return () => { listeners.delete(setState); };
    }, []);

    const doRegistrar = async () => { const r = await registrar(rut); setResult(r); };

    const card = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, margin: '0 0 12px' };
    const btn = (bg) => ({ padding: '8px 14px', background: bg, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 });
    const input = { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' };

    return h('div', { style: { height: '100%', overflowY: 'auto', padding: 20, fontFamily: 'system-ui, sans-serif', color: '#0A192F', background: '#fff' } }, [
      h('div', { key: 'hd', style: { marginBottom: 12 } }, [
        h('div', { key: 'n', style: { fontWeight: 800, fontSize: 20 } }, '🏊 ' + state.evento.nombre),
        h('div', { key: 'm', style: { fontSize: 12, color: '#6b7280' } }, (shell.app.instanceId ? ('Instancia ' + shell.app.instanceId) : 'Sin instancia — créala desde Apps') + ' · ' + state.competidores.length + ' competidor(es)'),
      ]),
      // Tótem
      h('div', { key: 'totem', style: card }, [
        h('div', { key: 't', style: { fontWeight: 700, marginBottom: 8 } }, 'Tótem — Validar / Registrar'),
        h('div', { key: 'row', style: { display: 'flex', gap: 8 } }, [
          h('input', { key: 'r', value: rut, placeholder: 'RUT (ej. 13.036.971-8)', onChange: (e) => setRut(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') void doRegistrar(); }, style: { ...input, flex: 1 } }),
          h('button', { key: 'b', onClick: () => void doRegistrar(), style: btn('#0A192F') }, 'Registrar'),
        ]),
        result ? h('div', { key: 'res', style: { marginTop: 10, fontSize: 14, color: result.ok ? '#047857' : '#b91c1c' } }, result.message) : null,
      ]),
      // Competidores
      h('div', { key: 'comp', style: card }, [
        h('div', { key: 't', style: { fontWeight: 700, marginBottom: 8 } }, 'Competidores'),
        h('div', { key: 'add', style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 } }, [
          h('input', { key: 'r', value: nuevo.rut, placeholder: 'RUT', onChange: (e) => setNuevo({ ...nuevo, rut: e.target.value }), style: { ...input, width: 140 } }),
          h('input', { key: 'n', value: nuevo.nombre, placeholder: 'Nombre', onChange: (e) => setNuevo({ ...nuevo, nombre: e.target.value }), style: { ...input, flex: 1, minWidth: 140 } }),
          h('select', { key: 's', value: nuevo.tipo, onChange: (e) => setNuevo({ ...nuevo, tipo: e.target.value }), style: input }, [
            h('option', { key: 'nf', value: 'nofederado' }, 'No federado'),
            h('option', { key: 'f', value: 'federado' }, 'Federado'),
          ]),
          h('button', { key: 'b', onClick: () => { void addCompetidor(nuevo); setNuevo({ rut: '', nombre: '', tipo: 'nofederado' }); }, style: btn('#19ACB1') }, 'Agregar'),
        ]),
        loading
          ? h('div', { key: 'l', style: { color: '#6b7280', fontSize: 14 } }, 'Cargando…')
          : state.competidores.length === 0
            ? h('div', { key: 'e', style: { color: '#9ca3af', fontSize: 14 } }, 'Sin competidores. Agrega el primero o pídeselo al agente.')
            : state.competidores.map((c) => h('div', { key: c.id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 } }, [
                h('span', { key: 'i', style: {} }, (c.nombre || '(sin nombre)') + ' · ' + fmtRut(c.rut) + ' · ' + c.tipo + (c.inscrito ? ' · ✅ inscrito' : '')),
                h('button', { key: 'd', onClick: () => void removeCompetidor(c.rut), style: { border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 13 } }, 'Eliminar'),
              ])),
      ]),
    ]);
  }

  return {
    Component,
    unmount() {
      listeners.clear();
      if (typeof unregisterAgent === 'function') { try { unregisterAgent(); } catch (e) { /* noop */ } }
    },
  };
}
