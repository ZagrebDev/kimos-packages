/**
 * FossFLOW — app instalable de Kimos: creador de diagramas de flujo isométricos.
 *
 * Bundle ESM autocontenido. Usa React desde globalThis (lo expone el shell).
 * Sin JSX, sin dependencias externas, sin WebGL/Three.js — proyección isométrica
 * 2D dibujada en SVG puro.
 *
 * Contrato (ver kimos-enterprice/frontend/src/v2/app-shell/contract.ts):
 *   export default function mount(shell): { Component, unmount? }
 *
 * Arquitectura State-Driven (modelo FossFLOW):
 *   model = {
 *     title: string,
 *     nodes:       [ { id, label, type, x, y, z, color, icon } ],   // x,y,z = grilla discreta
 *     connections: [ { id, from, to, label, color } ]               // from/to = id de nodo
 *   }
 *
 * El modelo vive en el closure de mount() (uno por instancia/ventana). Tanto la
 * UI del usuario como el agente mutan el MISMO modelo a través de los mismos
 * helpers; cada mutación emite a los listeners (repintado reactivo) y agenda un
 * guardado con debounce. Así, una acción en segundo plano del agente repinta el
 * lienzo de inmediato.
 */

// ── Geometría isométrica (constantes puras) ──────────────────────────────────
// Proyección clásica 2:1. Ejes de grilla a 30°/150° aproximados por la razón
// ancho/alto del tile. project() mapea (x,y) plano → ejes isométricos.
const TILE_W = 64;            // ancho del rombo de tile
const TILE_H = 32;            // alto del rombo de tile (2:1)
const HW = TILE_W / 2;        // semiancho
const HH = TILE_H / 2;        // semialto
const TILE_Z = 26;            // px de elevación por unidad z
const CUBE_H = 22;            // altura visual del bloque (nodo)
const FOOT = 0.82;            // factor de huella del cubo respecto al tile
const HWf = HW * FOOT;
const HHf = HH * FOOT;
const GRID = 12;              // semilado de la grilla dibujada (de -GRID a +GRID)

// Tipos de nodo con icono y color por defecto.
const TYPES = {
  server:   { label: 'Servidor', icon: '🖥️', color: '#3b82f6' },
  database: { label: 'Base de datos', icon: '🗄️', color: '#8b5cf6' },
  cloud:    { label: 'Nube', icon: '☁️', color: '#06b6d4' },
  service:  { label: 'Servicio', icon: '⚙️', color: '#f59e0b' },
  user:     { label: 'Usuario', icon: '👤', color: '#22c55e' },
  queue:    { label: 'Cola', icon: '📨', color: '#ec4899' },
  storage:  { label: 'Almacenamiento', icon: '💾', color: '#14b8a6' },
  generic:  { label: 'Nodo', icon: '📦', color: '#64748b' },
};
const TYPE_ORDER = ['server', 'database', 'cloud', 'service', 'user', 'queue', 'storage', 'generic'];

// ── Proyección y utilidades de color (puras) ─────────────────────────────────

/** (x,y,z) de grilla → coordenadas en el espacio del grupo SVG (antes de pan/zoom). */
function project(x, y, z) {
  return {
    sx: (x - y) * HW,
    sy: (x + y) * HH - (z || 0) * TILE_Z,
  };
}

/** Espacio del grupo (sx,sy) a la elevación z → grilla entera más cercana (snapping). */
function unproject(sx, sy, z) {
  const yy = sy + (z || 0) * TILE_Z;
  const a = sx / HW;   // x - y
  const b = yy / HH;   // x + y
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '64748b';
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('');
}
/** pct>0 aclara hacia blanco, pct<0 oscurece hacia negro. */
function shade(hex, pct) {
  const { r, g, b } = hexToRgb(hex);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

function genId(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4);
}

// ── Normalización del modelo (defensiva ante datos externos/agente) ──────────
function normalizeModel(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const title = typeof src.title === 'string' && src.title.trim() ? src.title : 'Diagrama de flujo';
  const seen = new Set();
  const nodes = [];
  if (Array.isArray(src.nodes)) {
    for (const n of src.nodes) {
      if (!n || typeof n !== 'object') continue;
      const id = String(n.id || genId('n')).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const type = n.type && TYPES[n.type] ? n.type : 'generic';
      const def = TYPES[type];
      nodes.push({
        id,
        label: typeof n.label === 'string' && n.label ? n.label : def.label,
        type,
        x: Number.isFinite(n.x) ? Math.round(n.x) : 0,
        y: Number.isFinite(n.y) ? Math.round(n.y) : 0,
        z: Number.isFinite(n.z) ? Math.round(n.z) : 0,
        color: typeof n.color === 'string' && n.color ? n.color : def.color,
        icon: typeof n.icon === 'string' && n.icon ? n.icon : def.icon,
      });
    }
  }
  const validIds = new Set(nodes.map((n) => n.id));
  const cseen = new Set();
  const connections = [];
  if (Array.isArray(src.connections)) {
    for (const c of src.connections) {
      if (!c || typeof c !== 'object') continue;
      const from = String(c.from || '').trim();
      const to = String(c.to || '').trim();
      if (!from || !to || from === to) continue;
      if (!validIds.has(from) || !validIds.has(to)) continue;
      const id = String(c.id || genId('c')).trim();
      if (cseen.has(id)) continue;
      cseen.add(id);
      connections.push({
        id,
        from,
        to,
        label: typeof c.label === 'string' ? c.label : '',
        color: typeof c.color === 'string' && c.color ? c.color : '#94a3b8',
      });
    }
  }
  return { title, nodes, connections };
}

export default function mount(shell) {
  const R = globalThis.React;
  if (!R || typeof R.createElement !== 'function') {
    return { Component() { return null; } };
  }
  const { useState, useEffect, useRef, useCallback, useMemo } = R;
  const h = R.createElement;

  function notify(level, text) {
    try { shell.notify({ level, text }); } catch { /* no-op */ }
  }

  // ── Estado del modelo, cerrado por instancia ───────────────────────────────
  let model = normalizeModel(null);
  let loaded = false;
  const listeners = new Set();
  let saveTimer = null;

  function emit() {
    for (const l of listeners) {
      try { l(model); } catch { /* no-op */ }
    }
  }
  function scheduleSave() {
    if (!loaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      shell.saveData({ model }).catch((err) => {
        notify('error', (err && err.message) || 'No se pudo guardar el diagrama');
      });
    }, 600);
  }
  function commit(next) {
    model = next;
    emit();
    scheduleSave();
  }

  // ── Operaciones del modelo (compartidas por UI y agente) ───────────────────
  function nodeById(id) { return model.nodes.find((n) => n.id === id) || null; }

  function findFreeCell(prefX, prefY) {
    const occ = new Set(model.nodes.map((n) => n.x + ',' + n.y));
    const cx = Number.isFinite(prefX) ? Math.round(prefX) : 0;
    const cy = Number.isFinite(prefY) ? Math.round(prefY) : 0;
    if (!occ.has(cx + ',' + cy)) return { x: cx, y: cy };
    // Búsqueda en espiral cuadrada alrededor de la celda preferida.
    for (let r = 1; r <= GRID; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const k = (cx + dx) + ',' + (cy + dy);
          if (!occ.has(k)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return { x: cx, y: cy };
  }

  function addNode(attrs) {
    const a = attrs || {};
    const type = a.type && TYPES[a.type] ? a.type : 'generic';
    const def = TYPES[type];
    let x = Number.isFinite(a.x) ? Math.round(a.x) : null;
    let y = Number.isFinite(a.y) ? Math.round(a.y) : null;
    if (x === null || y === null) {
      const cell = findFreeCell(x, y);
      x = cell.x; y = cell.y;
    }
    const node = {
      id: a.id ? String(a.id) : genId('n'),
      label: typeof a.label === 'string' && a.label ? a.label : def.label,
      type,
      x, y,
      z: Number.isFinite(a.z) ? Math.round(a.z) : 0,
      color: typeof a.color === 'string' && a.color ? a.color : def.color,
      icon: typeof a.icon === 'string' && a.icon ? a.icon : def.icon,
    };
    commit({ ...model, nodes: [...model.nodes, node] });
    return node;
  }

  function updateNode(id, patch) {
    const p = patch || {};
    let found = null;
    const nodes = model.nodes.map((n) => {
      if (n.id !== id) return n;
      const type = p.type && TYPES[p.type] ? p.type : n.type;
      found = {
        ...n,
        type,
        label: typeof p.label === 'string' && p.label ? p.label : n.label,
        x: Number.isFinite(p.x) ? Math.round(p.x) : n.x,
        y: Number.isFinite(p.y) ? Math.round(p.y) : n.y,
        z: Number.isFinite(p.z) ? Math.round(p.z) : n.z,
        color: typeof p.color === 'string' && p.color ? p.color : n.color,
        icon: typeof p.icon === 'string' && p.icon ? p.icon : n.icon,
      };
      return found;
    });
    if (found) commit({ ...model, nodes });
    return found;
  }

  function deleteNode(id) {
    if (!nodeById(id)) return false;
    commit({
      ...model,
      nodes: model.nodes.filter((n) => n.id !== id),
      connections: model.connections.filter((c) => c.from !== id && c.to !== id),
    });
    return true;
  }

  function addConnection(from, to, label) {
    const f = String(from || '');
    const t = String(to || '');
    if (!nodeById(f) || !nodeById(t)) return { ok: false, message: 'Origen o destino inexistente.' };
    if (f === t) return { ok: false, message: 'No se puede conectar un nodo consigo mismo.' };
    if (model.connections.some((c) => c.from === f && c.to === t)) {
      return { ok: false, message: 'Esa conexión ya existe.' };
    }
    const conn = { id: genId('c'), from: f, to: t, label: typeof label === 'string' ? label : '', color: '#94a3b8' };
    commit({ ...model, connections: [...model.connections, conn] });
    return { ok: true, conn };
  }

  function updateConnection(id, patch) {
    const p = patch || {};
    let found = null;
    const connections = model.connections.map((c) => {
      if (c.id !== id) return c;
      found = {
        ...c,
        label: typeof p.label === 'string' ? p.label : c.label,
        color: typeof p.color === 'string' && p.color ? p.color : c.color,
      };
      return found;
    });
    if (found) commit({ ...model, connections });
    return found;
  }

  function deleteConnection(id) {
    if (!model.connections.some((c) => c.id === id)) return false;
    commit({ ...model, connections: model.connections.filter((c) => c.id !== id) });
    return true;
  }

  function setTitle(title) {
    commit({ ...model, title: typeof title === 'string' && title.trim() ? title : model.title });
  }
  function clearAll() {
    commit({ ...model, nodes: [], connections: [] });
  }
  function replaceModel(raw) {
    commit(normalizeModel(raw));
  }

  // ── Control por agente autorizado ──────────────────────────────────────────
  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'FossFLOW',
      description: 'Diagrama de flujo isométrico. Permite crear, mover, conectar y eliminar nodos en una grilla (x,y,z), y reemplazar el diagrama completo.',
      tools: [
        { name: 'ADD_NODE', description: 'Agrega un nodo. type ∈ ' + TYPE_ORDER.join('|') + '. x,y,z opcionales (grilla entera); si faltan se ubica en una celda libre.',
          inputSchema: { type: 'object', properties: {
            label: { type: 'string' }, type: { type: 'string' },
            x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }, color: { type: 'string' },
          } } },
        { name: 'UPDATE_NODE', description: 'Modifica un nodo por id (label/type/color/x/y/z).',
          inputSchema: { type: 'object', properties: {
            id: { type: 'string' }, label: { type: 'string' }, type: { type: 'string' },
            x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }, color: { type: 'string' },
          }, required: ['id'] } },
        { name: 'MOVE_NODE', description: 'Reubica un nodo en la grilla.',
          inputSchema: { type: 'object', properties: {
            id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
          }, required: ['id', 'x', 'y'] } },
        { name: 'DELETE_NODE', description: 'Elimina un nodo (y sus conexiones) por id.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'ADD_CONNECTION', description: 'Conecta dos nodos por id (flujo from → to).',
          inputSchema: { type: 'object', properties: {
            from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' },
          }, required: ['from', 'to'] } },
        { name: 'DELETE_CONNECTION', description: 'Elimina una conexión por id.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'SET_TITLE', description: 'Cambia el título del diagrama.',
          inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
        { name: 'SET_MODEL', description: 'Reemplaza el diagrama completo con un modelo FossFLOW { title, nodes, connections }.',
          inputSchema: { type: 'object', properties: { model: { type: 'object' } }, required: ['model'] } },
        { name: 'CLEAR', description: 'Vacía el diagrama (nodos y conexiones).',
          inputSchema: { type: 'object', properties: {} } },
        { name: 'GET_STATE', description: 'Devuelve el estado actual del diagrama.',
          inputSchema: { type: 'object', properties: {} } },
      ],
      getSnapshot: () => ({
        title: model.title,
        nodeCount: model.nodes.length,
        connectionCount: model.connections.length,
        coords: 'grilla entera (x,y), z = elevación',
        nodes: model.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type, x: n.x, y: n.y, z: n.z })),
        connections: model.connections.map((c) => ({ id: c.id, from: c.from, to: c.to, label: c.label })),
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          switch (type) {
            case 'ADD_NODE': {
              const n = addNode(p);
              return { success: true, message: 'Nodo "' + n.label + '" agregado (id ' + n.id + ') en (' + n.x + ',' + n.y + ').' };
            }
            case 'UPDATE_NODE': {
              const n = updateNode(String(p.id || ''), p);
              return n ? { success: true, message: 'Nodo ' + n.id + ' actualizado.' }
                       : { success: false, error: 'No existe el nodo ' + p.id };
            }
            case 'MOVE_NODE': {
              const n = updateNode(String(p.id || ''), { x: p.x, y: p.y, z: p.z });
              return n ? { success: true, message: 'Nodo ' + n.id + ' movido a (' + n.x + ',' + n.y + ',' + n.z + ').' }
                       : { success: false, error: 'No existe el nodo ' + p.id };
            }
            case 'DELETE_NODE':
              return deleteNode(String(p.id || ''))
                ? { success: true, message: 'Nodo eliminado.' }
                : { success: false, error: 'No existe el nodo ' + p.id };
            case 'ADD_CONNECTION': {
              const r = addConnection(p.from, p.to, p.label);
              return r.ok ? { success: true, message: 'Conexión creada (' + r.conn.from + ' → ' + r.conn.to + ').' }
                          : { success: false, error: r.message };
            }
            case 'DELETE_CONNECTION':
              return deleteConnection(String(p.id || ''))
                ? { success: true, message: 'Conexión eliminada.' }
                : { success: false, error: 'No existe la conexión ' + p.id };
            case 'SET_TITLE':
              setTitle(p.title);
              return { success: true, message: 'Título actualizado.' };
            case 'SET_MODEL':
              replaceModel(p.model);
              return { success: true, message: 'Diagrama reemplazado: ' + model.nodes.length + ' nodo(s), ' + model.connections.length + ' conexión(es).' };
            case 'CLEAR':
              clearAll();
              return { success: true, message: 'Diagrama vaciado.' };
            case 'GET_STATE':
              return { success: true, message: model.title + ': ' + model.nodes.length + ' nodo(s), ' + model.connections.length + ' conexión(es).' };
            default:
              return { success: false, error: 'Acción no soportada: ' + type };
          }
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  // ── Render de geometría isométrica (helpers de presentación) ────────────────
  function cubeGeometry(node) {
    const P = project(node.x, node.y, node.z);
    // Diamante de huella a nivel del suelo.
    const gN = [P.sx, P.sy - HHf], gE = [P.sx + HWf, P.sy], gS = [P.sx, P.sy + HHf], gW = [P.sx - HWf, P.sy];
    const up = (pt) => [pt[0], pt[1] - CUBE_H];
    const tN = up(gN), tE = up(gE), tS = up(gS), tW = up(gW);
    const toStr = (pts) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return {
      P,
      top: toStr([tN, tE, tS, tW]),
      left: toStr([tW, tS, gS, gW]),
      right: toStr([tS, tE, gE, gS]),
      topColor: shade(node.color, 0.18),
      leftColor: shade(node.color, -0.10),
      rightColor: shade(node.color, -0.28),
      // Anclas para texto/icono.
      iconY: P.sy - CUBE_H - HHf + 2,
      labelY: P.sy + HHf + 13,
    };
  }

  // Ruta ortogonal en el plano de grilla: A → esquina(bx,ay) → B (proyectadas).
  function connectionPath(from, to) {
    const A = project(from.x, from.y, from.z);
    const C = project(to.x, from.y, from.z);
    const B = project(to.x, to.y, to.z);
    return [A, C, B].map((p, i) => (i === 0 ? 'M' : 'L') + p.sx.toFixed(1) + ' ' + p.sy.toFixed(1)).join(' ');
  }

  // ── Componente React (lienzo) ───────────────────────────────────────────────
  function Component() {
    const [m, setM] = useState(model);
    const [loadingState, setLoadingState] = useState(true);
    const [view, setView] = useState({ panX: 360, panY: 170, scale: 1 });
    const [selected, setSelected] = useState(null);        // { kind:'node'|'conn', id }
    const [connectMode, setConnectMode] = useState(false);
    const [connectFrom, setConnectFrom] = useState(null);
    const [editingTitle, setEditingTitle] = useState(false);

    const svgRef = useRef(null);
    const viewRef = useRef(view);
    const interactRef = useRef({ mode: null });
    const movedRef = useRef(false);
    viewRef.current = view;

    // Carga inicial + suscripción a mutaciones del modelo (UI + agente).
    useEffect(() => {
      listeners.add(setM);
      let cancelled = false;
      Promise.resolve(shell.loadData()).then((data) => {
        if (cancelled) return;
        const cfg = data && typeof data === 'object' ? data : null;
        model = normalizeModel(cfg && cfg.model ? cfg.model : cfg);
        loaded = true;
        setM(model);
      }).catch(() => { loaded = true; }).finally(() => {
        if (!cancelled) setLoadingState(false);
      });
      return () => { cancelled = true; listeners.delete(setM); };
    }, []);

    const clientToGroup = useCallback((evt) => {
      const svg = svgRef.current;
      if (!svg) return { gx: 0, gy: 0 };
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { gx: 0, gy: 0 };
      const usr = pt.matrixTransform(ctm.inverse());
      const v = viewRef.current;
      return { gx: (usr.x - v.panX) / v.scale, gy: (usr.y - v.panY) / v.scale };
    }, []);

    // ── Interacción: drag de nodos + pan del lienzo ──────────────────────────
    const onNodePointerDown = useCallback((evt, node) => {
      evt.stopPropagation();
      if (connectMode) {
        if (!connectFrom) { setConnectFrom(node.id); setSelected({ kind: 'node', id: node.id }); }
        else if (connectFrom === node.id) { setConnectFrom(null); }
        else {
          const r = addConnection(connectFrom, node.id);
          if (!r.ok) notify('warn', r.message);
          setConnectFrom(null);
        }
        return;
      }
      try { evt.currentTarget.setPointerCapture(evt.pointerId); } catch { /* no-op */ }
      interactRef.current = { mode: 'drag', nodeId: node.id, z: node.z };
      movedRef.current = false;
      setSelected({ kind: 'node', id: node.id });
    }, [connectMode, connectFrom]);

    const onSvgPointerDown = useCallback((evt) => {
      if (interactRef.current.mode) return;
      const v = viewRef.current;
      interactRef.current = { mode: 'pan', startX: evt.clientX, startY: evt.clientY, panX: v.panX, panY: v.panY };
      movedRef.current = false;
    }, []);

    const onSvgPointerMove = useCallback((evt) => {
      const it = interactRef.current;
      if (!it.mode) return;
      if (it.mode === 'drag') {
        const { gx, gy } = clientToGroup(evt);
        const cell = unproject(gx, gy, it.z || 0);
        const node = nodeById(it.nodeId);
        if (node && (node.x !== cell.x || node.y !== cell.y)) {
          movedRef.current = true;
          updateNode(it.nodeId, { x: cell.x, y: cell.y });
        }
      } else if (it.mode === 'pan') {
        const dx = evt.clientX - it.startX;
        const dy = evt.clientY - it.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
        setView((vw) => ({ ...vw, panX: it.panX + dx, panY: it.panY + dy }));
      }
    }, [clientToGroup]);

    const endInteract = useCallback(() => {
      const it = interactRef.current;
      interactRef.current = { mode: null };
      if (it.mode === 'pan' && !movedRef.current) setSelected(null);
    }, []);

    const onSvgDoubleClick = useCallback((evt) => {
      if (connectMode) return;
      const { gx, gy } = clientToGroup(evt);
      const cell = unproject(gx, gy, 0);
      const n = addNode({ x: cell.x, y: cell.y, type: 'generic' });
      setSelected({ kind: 'node', id: n.id });
    }, [clientToGroup, connectMode]);

    const onWheel = useCallback((evt) => {
      evt.preventDefault();
      setView((vw) => {
        const factor = evt.deltaY < 0 ? 1.1 : 1 / 1.1;
        const scale = Math.max(0.4, Math.min(2.4, vw.scale * factor));
        return { ...vw, scale };
      });
    }, []);

    const zoomBy = (factor) => setView((vw) => ({ ...vw, scale: Math.max(0.4, Math.min(2.4, vw.scale * factor)) }));
    const resetView = () => setView({ panX: 360, panY: 170, scale: 1 });

    // Orden pintor: más lejano (x+y menor) primero.
    const sortedNodes = useMemo(
      () => m.nodes.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z || (a.id < b.id ? -1 : 1)),
      [m.nodes],
    );
    const nodeMap = useMemo(() => {
      const map = {};
      for (const n of m.nodes) map[n.id] = n;
      return map;
    }, [m.nodes]);

    const selectedNode = selected && selected.kind === 'node' ? nodeMap[selected.id] : null;
    const selectedConn = selected && selected.kind === 'conn' ? m.connections.find((c) => c.id === selected.id) : null;

    // ── Grilla isométrica ────────────────────────────────────────────────────
    const gridLines = useMemo(() => {
      const lines = [];
      for (let i = -GRID; i <= GRID; i++) {
        const a = project(i, -GRID, 0), b = project(i, GRID, 0);
        lines.push(h('line', { key: 'gx' + i, x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, className: 'ff-grid-line' }));
        const c = project(-GRID, i, 0), d = project(GRID, i, 0);
        lines.push(h('line', { key: 'gy' + i, x1: c.sx, y1: c.sy, x2: d.sx, y2: d.sy, className: 'ff-grid-line' }));
      }
      return lines;
    }, []);

    if (loadingState) {
      return h('div', { className: 'kimos-fossflow ff-loading' }, 'Cargando diagrama…');
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return h('div', { className: 'kimos-fossflow' },
      // Barra de herramientas
      h('div', { className: 'ff-toolbar' },
        editingTitle
          ? h('input', {
              className: 'ff-title-input', autoFocus: true, defaultValue: m.title,
              onBlur: (e) => { setTitle(e.target.value); setEditingTitle(false); },
              onKeyDown: (e) => { if (e.key === 'Enter') { setTitle(e.target.value); setEditingTitle(false); } if (e.key === 'Escape') setEditingTitle(false); },
            })
          : h('span', { className: 'ff-title', title: 'Doble click para renombrar', onDoubleClick: () => setEditingTitle(true) }, '🧊 ' + m.title),
        h('span', { className: 'ff-stats' }, m.nodes.length + ' nodo' + (m.nodes.length === 1 ? '' : 's') + ' · ' + m.connections.length + ' conexión' + (m.connections.length === 1 ? '' : 'es')),
        h('div', { className: 'ff-spacer' }),
        h('button', {
          className: 'ff-btn' + (connectMode ? ' ff-btn-active' : ''),
          title: 'Modo conexión: clic en origen y luego en destino',
          onClick: () => { setConnectMode((v) => !v); setConnectFrom(null); },
        }, connectMode ? '🔗 Conectando…' : '🔗 Conectar'),
        h('div', { className: 'ff-zoom' },
          h('button', { className: 'ff-icon-btn', title: 'Alejar', onClick: () => zoomBy(1 / 1.1) }, '−'),
          h('button', { className: 'ff-icon-btn', title: 'Ajustar', onClick: resetView }, '⤢'),
          h('button', { className: 'ff-icon-btn', title: 'Acercar', onClick: () => zoomBy(1.1) }, '+'),
        ),
      ),
      // Paleta de tipos de nodo
      h('div', { className: 'ff-palette' },
        TYPE_ORDER.map((t) => h('button', {
          key: t, className: 'ff-pal-btn', title: 'Agregar ' + TYPES[t].label,
          onClick: () => { const n = addNode({ type: t }); setSelected({ kind: 'node', id: n.id }); },
        }, TYPES[t].icon + ' ' + TYPES[t].label)),
      ),
      // Lienzo + inspector
      h('div', { className: 'ff-stage' },
        h('svg', {
          ref: svgRef, className: 'ff-canvas', xmlns: 'http://www.w3.org/2000/svg',
          onPointerDown: onSvgPointerDown, onPointerMove: onSvgPointerMove,
          onPointerUp: endInteract, onPointerLeave: endInteract,
          onDoubleClick: onSvgDoubleClick, onWheel,
        },
          h('defs', null,
            h('marker', { id: 'ff-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
              h('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#64748b' })),
          ),
          h('g', { transform: 'translate(' + view.panX + ',' + view.panY + ') scale(' + view.scale + ')' },
            h('g', { className: 'ff-grid' }, gridLines),
            // Conexiones (en el plano del suelo)
            h('g', { className: 'ff-connections' },
              m.connections.map((c) => {
                const a = nodeMap[c.from], b = nodeMap[c.to];
                if (!a || !b) return null;
                const mid = project(b.x, a.y, a.z);
                const isSel = selectedConn && selectedConn.id === c.id;
                return h('g', { key: c.id, className: 'ff-conn' + (isSel ? ' ff-conn-sel' : ''),
                  onPointerDown: (e) => { e.stopPropagation(); setSelected({ kind: 'conn', id: c.id }); } },
                  h('path', { d: connectionPath(a, b), className: 'ff-conn-hit' }),
                  h('path', { d: connectionPath(a, b), className: 'ff-conn-line', stroke: isSel ? '#19ACB1' : c.color, markerEnd: 'url(#ff-arrow)' }),
                  c.label ? h('text', { x: mid.sx, y: mid.sy - 4, className: 'ff-conn-label' }, c.label) : null,
                );
              }),
            ),
            // Nodos (cubos isométricos)
            h('g', { className: 'ff-nodes' },
              sortedNodes.map((node) => {
                const g = cubeGeometry(node);
                const isSel = selected && selected.kind === 'node' && selected.id === node.id;
                const isFrom = connectFrom === node.id;
                return h('g', {
                  key: node.id,
                  className: 'ff-node' + (isSel ? ' ff-node-sel' : '') + (isFrom ? ' ff-node-from' : '') + (connectMode ? ' ff-node-link' : ''),
                  onPointerDown: (e) => onNodePointerDown(e, node),
                },
                  h('ellipse', { cx: g.P.sx, cy: g.P.sy, rx: HWf, ry: HHf, className: 'ff-node-shadow' }),
                  h('polygon', { points: g.left, fill: g.leftColor, className: 'ff-face' }),
                  h('polygon', { points: g.right, fill: g.rightColor, className: 'ff-face' }),
                  h('polygon', { points: g.top, fill: g.topColor, className: 'ff-face ff-face-top' }),
                  h('text', { x: g.P.sx, y: g.iconY, className: 'ff-node-icon' }, node.icon),
                  h('text', { x: g.P.sx, y: g.labelY, className: 'ff-node-label' }, node.label),
                );
              }),
            ),
          ),
        ),
        // Inspector lateral
        (selectedNode || selectedConn)
          ? h('div', { className: 'ff-inspector' },
              selectedNode
                ? h('div', null,
                    h('div', { className: 'ff-insp-head' }, 'Nodo'),
                    h('label', { className: 'ff-lbl' }, 'Etiqueta'),
                    h('input', { className: 'ff-input', value: selectedNode.label,
                      onChange: (e) => updateNode(selectedNode.id, { label: e.target.value }) }),
                    h('label', { className: 'ff-lbl' }, 'Tipo'),
                    h('select', { className: 'ff-input', value: selectedNode.type,
                      onChange: (e) => updateNode(selectedNode.id, { type: e.target.value, icon: TYPES[e.target.value].icon, color: TYPES[e.target.value].color }) },
                      TYPE_ORDER.map((t) => h('option', { key: t, value: t }, TYPES[t].icon + ' ' + TYPES[t].label))),
                    h('label', { className: 'ff-lbl' }, 'Color'),
                    h('input', { className: 'ff-color', type: 'color', value: selectedNode.color,
                      onChange: (e) => updateNode(selectedNode.id, { color: e.target.value }) }),
                    h('div', { className: 'ff-row' },
                      h('div', null, h('label', { className: 'ff-lbl' }, 'X'),
                        h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.x,
                          onChange: (e) => updateNode(selectedNode.id, { x: parseInt(e.target.value, 10) }) })),
                      h('div', null, h('label', { className: 'ff-lbl' }, 'Y'),
                        h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.y,
                          onChange: (e) => updateNode(selectedNode.id, { y: parseInt(e.target.value, 10) }) })),
                      h('div', null, h('label', { className: 'ff-lbl' }, 'Z'),
                        h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.z,
                          onChange: (e) => updateNode(selectedNode.id, { z: parseInt(e.target.value, 10) }) })),
                    ),
                    h('button', { className: 'ff-btn ff-btn-danger ff-block',
                      onClick: () => { deleteNode(selectedNode.id); setSelected(null); } }, '🗑️ Eliminar nodo'),
                  )
                : h('div', null,
                    h('div', { className: 'ff-insp-head' }, 'Conexión'),
                    h('div', { className: 'ff-insp-sub' }, (nodeMap[selectedConn.from]?.label || selectedConn.from) + ' → ' + (nodeMap[selectedConn.to]?.label || selectedConn.to)),
                    h('label', { className: 'ff-lbl' }, 'Etiqueta'),
                    h('input', { className: 'ff-input', value: selectedConn.label,
                      onChange: (e) => updateConnection(selectedConn.id, { label: e.target.value }) }),
                    h('button', { className: 'ff-btn ff-btn-danger ff-block',
                      onClick: () => { deleteConnection(selectedConn.id); setSelected(null); } }, '🗑️ Eliminar conexión'),
                  ),
            )
          : h('div', { className: 'ff-inspector ff-inspector-empty' },
              h('p', null, 'Doble clic en el lienzo para crear un nodo, o usa la paleta.'),
              h('p', null, 'Arrastra para moverlo (con snapping a la grilla). Arrastra el fondo para desplazar; rueda para zoom.'),
              h('p', null, 'Un agente autorizado puede crear y conectar nodos: el lienzo se actualiza solo.'),
            ),
      ),
    );
  }

  return {
    Component,
    unmount() {
      if (saveTimer) clearTimeout(saveTimer);
      listeners.clear();
      if (typeof unregisterAgent === 'function') {
        try { unregisterAgent(); } catch { /* no-op */ }
      }
    },
  };
}
