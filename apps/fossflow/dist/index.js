/**
 * FossFLOW — app instalable de Kimos: creador de diagramas de flujo isométricos.
 *
 * Bundle ESM autocontenido. Usa React desde globalThis (lo expone el shell).
 * Sin JSX, sin paso de build, sin WebGL/Three.js — proyección isométrica 2D en
 * SVG puro.
 *
 * Contrato (kimos-enterprice/frontend/src/v2/app-shell/contract.ts):
 *   export default function mount(shell): { Component, unmount? }
 *
 * Arquitectura State-Driven (modelo FossFLOW):
 *   model = {
 *     title: string,
 *     nodes:       [ { id, label, type, x, y, z, color, icon:{kind,value} } ],
 *     connections: [ { id, from, to, label, color, dashed, bidir } ]
 *   }
 *
 * Iconos generalistas:
 *   - emoji   (offline, catálogo por categorías)
 *   - iconify (librería libre 200k+ iconos vía api.iconify.design — requiere red)
 *   - url     (imagen/SVG importada por URL o data-URI)
 *
 * El modelo vive en el closure de mount() (uno por instancia). UI del usuario y
 * agente mutan el MISMO modelo por los mismos helpers → repintado reactivo +
 * guardado con debounce.
 */

// ── Geometría isométrica (constantes puras) ──────────────────────────────────
const TILE_W = 64, TILE_H = 32;
const HW = TILE_W / 2, HH = TILE_H / 2;
const TILE_Z = 26;            // px de elevación por unidad z
const SLAB = 5;               // grosor de la baldosa (no es un cubo)
const FOOT = 0.92;            // huella de la baldosa respecto al tile
const HWf = HW * FOOT, HHf = HH * FOOT;
const ICON_SIZE = 38;         // tamaño del icono (billboard)
const GRID = 14;              // semilado de la grilla

// Tipos de nodo (color + emoji por defecto). El icono real es libre.
const TYPES = {
  server:   { label: 'Servidor', icon: '🖥️', color: '#3b82f6' },
  database: { label: 'Base de datos', icon: '🗄️', color: '#8b5cf6' },
  cloud:    { label: 'Nube', icon: '☁️', color: '#06b6d4' },
  service:  { label: 'Servicio', icon: '⚙️', color: '#f59e0b' },
  user:     { label: 'Usuario', icon: '👤', color: '#22c55e' },
  process:  { label: 'Proceso', icon: '⚡', color: '#ef4444' },
  decision: { label: 'Decisión', icon: '🔀', color: '#eab308' },
  data:     { label: 'Datos', icon: '📊', color: '#14b8a6' },
  generic:  { label: 'Nodo', icon: '📦', color: '#64748b' },
};
const TYPE_ORDER = ['server', 'database', 'cloud', 'service', 'user', 'process', 'decision', 'data', 'generic'];

// Catálogo de emojis por categoría (offline, generalista).
const EMOJI_CATEGORIES = [
  { name: 'Flujo', items: ['▶️', '⏹️', '🔀', '🔁', '🔂', '↪️', '↩️', '⤴️', '⤵️', '✅', '❌', '⚠️', '❓', '⏳', '🚦', '🏁'] },
  { name: 'Red / Infra', items: ['🖥️', '💻', '🖧', '🌐', '☁️', '🛰️', '📡', '🔌', '🧱', '🛡️', '🔒', '🔑', '🗄️', '🗃️', '💾', '🧮'] },
  { name: 'Datos', items: ['📊', '📈', '📉', '🗂️', '📁', '📂', '📄', '📋', '🧾', '🔢', '🔣', '🧠', '🤖', '⚙️', '🛠️', '🔧'] },
  { name: 'Personas', items: ['👤', '👥', '🧑‍💻', '👨‍💼', '👩‍💼', '🧑‍🔧', '🧑‍🏭', '🧑‍⚕️', '🧑‍🏫', '🧑‍🌾', '👮', '🕵️', '🙋', '🤝', '📞', '✉️'] },
  { name: 'Negocio', items: ['🏢', '🏭', '🏬', '🏦', '🛒', '🛍️', '💰', '💳', '💵', '🧰', '📦', '🚚', '✈️', '⛴️', '🏷️', '🧷'] },
  { name: 'Lugares', items: ['🏠', '🏥', '🏫', '🏛️', '🗺️', '📍', '🧭', '🌍', '🌎', '🌏', '⛰️', '🏝️', '🛣️', '🏗️', '🚏', '🅿️'] },
  { name: 'Símbolos', items: ['⭐', '💡', '🔔', '🔖', '📌', '🧩', '🎯', '🔥', '💧', '⚡', '♻️', '⚖️', '⏱️', '🔋', '📶', '🆗'] },
];
// Acceso rápido en la paleta superior.
const QUICK_EMOJIS = ['🖥️', '💻', '☁️', '🗄️', '🌐', '⚙️', '👤', '👥', '🏢', '📊', '📦', '🔀', '⚡', '✅', '⚠️', '🔒', '📡', '🤖'];

// Conjuntos curados de Iconify (requieren red; se previsualizan vía <img>).
const ICONIFY_STARTERS = [
  { name: 'Red', items: ['mdi:server', 'mdi:server-network', 'mdi:router-network', 'mdi:lan', 'mdi:firewall', 'mdi:wan', 'mdi:cloud', 'mdi:cloud-outline', 'mdi:web', 'mdi:dns', 'mdi:ip-network', 'mdi:access-point'] },
  { name: 'Dispositivos', items: ['mdi:laptop', 'mdi:desktop-tower', 'mdi:cellphone', 'mdi:monitor', 'mdi:printer', 'mdi:harddisk', 'mdi:nas', 'mdi:database', 'mdi:memory', 'mdi:cpu-64-bit', 'mdi:usb', 'mdi:router-wireless'] },
  { name: 'Cloud / Logos', items: ['logos:aws', 'logos:google-cloud', 'logos:microsoft-azure', 'logos:docker-icon', 'logos:kubernetes', 'logos:nginx', 'logos:postgresql', 'logos:redis', 'logos:mongodb-icon', 'logos:python', 'logos:javascript', 'logos:react'] },
  { name: 'Negocio', items: ['mdi:account', 'mdi:account-group', 'mdi:office-building', 'mdi:cart', 'mdi:cash', 'mdi:credit-card', 'mdi:truck', 'mdi:package-variant', 'mdi:warehouse', 'mdi:factory', 'mdi:store', 'mdi:email'] },
  { name: 'Formas / Flujo', items: ['mdi:rhombus', 'mdi:rectangle', 'mdi:circle-outline', 'mdi:hexagon', 'mdi:ray-start-arrow', 'mdi:ray-end', 'mdi:arrow-decision', 'mdi:source-branch', 'mdi:sync', 'mdi:cog', 'mdi:check-circle', 'mdi:alert' ] },
];

const ICONIFY_BASE = 'https://api.iconify.design';

// ── Color (puro) ─────────────────────────────────────────────────────────────
function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function hexToRgb(hex) {
  let s = String(hex || '').replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) s = '64748b';
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join(''); }
function shade(hex, pct) {
  const { r, g, b } = hexToRgb(hex);
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}
function rgba(hex, a) { const { r, g, b } = hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

// ── Proyección (puras) ───────────────────────────────────────────────────────
function project(x, y, z) { return { sx: (x - y) * HW, sy: (x + y) * HH - (z || 0) * TILE_Z }; }
function unproject(sx, sy, z) {
  const yy = sy + (z || 0) * TILE_Z;
  const a = sx / HW, b = yy / HH;
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

function genId(p) { return p + '-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4); }

// ── Iconos ───────────────────────────────────────────────────────────────────
function guessIconKind(v) {
  if (/^(https?:|data:)/i.test(v)) return 'url';
  if (/^[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]/i.test(v)) return 'iconify';
  return 'emoji';
}
function normalizeIcon(raw, fallbackEmoji) {
  if (raw && typeof raw === 'object' && raw.value) {
    const kind = (raw.kind === 'url' || raw.kind === 'iconify' || raw.kind === 'emoji') ? raw.kind : guessIconKind(String(raw.value));
    return { kind, value: String(raw.value) };
  }
  if (typeof raw === 'string' && raw.trim()) {
    const v = raw.trim();
    return { kind: guessIconKind(v), value: v };
  }
  return { kind: 'emoji', value: fallbackEmoji || '📦' };
}
function iconHref(icon) {
  if (!icon) return null;
  if (icon.kind === 'url') return icon.value;
  if (icon.kind === 'iconify') return ICONIFY_BASE + '/' + icon.value.replace(':', '/') + '.svg';
  return null; // emoji → texto
}

// ── Normalización del modelo (defensiva) ─────────────────────────────────────
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
        icon: normalizeIcon(n.icon, def.icon),
      });
    }
  }
  const valid = new Set(nodes.map((n) => n.id));
  const cseen = new Set();
  const connections = [];
  if (Array.isArray(src.connections)) {
    for (const c of src.connections) {
      if (!c || typeof c !== 'object') continue;
      const from = String(c.from || '').trim(), to = String(c.to || '').trim();
      if (!from || !to || from === to || !valid.has(from) || !valid.has(to)) continue;
      const id = String(c.id || genId('c')).trim();
      if (cseen.has(id)) continue;
      cseen.add(id);
      connections.push({
        id, from, to,
        label: typeof c.label === 'string' ? c.label : '',
        color: typeof c.color === 'string' && c.color ? c.color : '#64748b',
        dashed: !!c.dashed,
        bidir: !!c.bidir,
      });
    }
  }
  return { title, nodes, connections };
}

export default function mount(shell) {
  const R = globalThis.React;
  if (!R || typeof R.createElement !== 'function') return { Component() { return null; } };
  const { useState, useEffect, useRef, useCallback, useMemo } = R;
  const h = R.createElement;

  function notify(level, text) { try { shell.notify({ level, text }); } catch { /* no-op */ } }

  // ── Estado del modelo (cerrado por instancia) ──────────────────────────────
  let model = normalizeModel(null);
  let loaded = false;
  const listeners = new Set();
  let saveTimer = null;

  function emit() { for (const l of listeners) { try { l(model); } catch { /* no-op */ } } }
  function scheduleSave() {
    if (!loaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      shell.saveData({ model }).catch((err) => notify('error', (err && err.message) || 'No se pudo guardar'));
    }, 600);
  }
  function commit(next) { model = next; emit(); scheduleSave(); }
  function nodeById(id) { return model.nodes.find((n) => n.id === id) || null; }

  function findFreeCell(prefX, prefY) {
    const occ = new Set(model.nodes.map((n) => n.x + ',' + n.y));
    const cx = Number.isFinite(prefX) ? Math.round(prefX) : 0;
    const cy = Number.isFinite(prefY) ? Math.round(prefY) : 0;
    if (!occ.has(cx + ',' + cy)) return { x: cx, y: cy };
    for (let r = 1; r <= GRID; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!occ.has((cx + dx) + ',' + (cy + dy))) return { x: cx + dx, y: cy + dy };
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
    if (x === null || y === null) { const c = findFreeCell(x, y); x = c.x; y = c.y; }
    const node = {
      id: a.id ? String(a.id) : genId('n'),
      label: typeof a.label === 'string' && a.label ? a.label : def.label,
      type, x, y,
      z: Number.isFinite(a.z) ? Math.round(a.z) : 0,
      color: typeof a.color === 'string' && a.color ? a.color : def.color,
      icon: a.icon !== undefined ? normalizeIcon(a.icon, def.icon) : normalizeIcon(def.icon, def.icon),
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
        ...n, type,
        label: typeof p.label === 'string' && p.label ? p.label : n.label,
        x: Number.isFinite(p.x) ? Math.round(p.x) : n.x,
        y: Number.isFinite(p.y) ? Math.round(p.y) : n.y,
        z: Number.isFinite(p.z) ? Math.round(p.z) : n.z,
        color: typeof p.color === 'string' && p.color ? p.color : n.color,
        icon: p.icon !== undefined ? normalizeIcon(p.icon, n.icon && n.icon.value) : n.icon,
      };
      return found;
    });
    if (found) commit({ ...model, nodes });
    return found;
  }
  function duplicateNode(id) {
    const n = nodeById(id);
    if (!n) return null;
    const cell = findFreeCell(n.x + 1, n.y);
    return addNode({ ...n, id: undefined, x: cell.x, y: cell.y, label: n.label });
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
    const f = String(from || ''), t = String(to || '');
    if (!nodeById(f) || !nodeById(t)) return { ok: false, message: 'Origen o destino inexistente.' };
    if (f === t) return { ok: false, message: 'No se puede conectar un nodo consigo mismo.' };
    if (model.connections.some((c) => (c.from === f && c.to === t) || (c.from === t && c.to === f)))
      return { ok: false, message: 'Esa conexión ya existe.' };
    const conn = { id: genId('c'), from: f, to: t, label: typeof label === 'string' ? label : '', color: '#64748b', dashed: false, bidir: false };
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
        dashed: typeof p.dashed === 'boolean' ? p.dashed : c.dashed,
        bidir: typeof p.bidir === 'boolean' ? p.bidir : c.bidir,
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
  function setTitle(title) { commit({ ...model, title: typeof title === 'string' && title.trim() ? title : model.title }); }
  function clearAll() { commit({ ...model, nodes: [], connections: [] }); }
  function replaceModel(raw) { commit(normalizeModel(raw)); }

  // ── Control por agente ─────────────────────────────────────────────────────
  let unregisterAgent = null;
  function iconToString(ic) { return ic && ic.value ? ic.value : ''; }
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'FossFLOW',
      description: 'Diagrama de flujo isométrico. Crea/mueve/conecta/elimina nodos en grilla (x,y,z). icon acepta emoji, id de Iconify (p.ej. "mdi:server", "logos:aws") o URL de imagen.',
      tools: [
        { name: 'ADD_NODE', description: 'Agrega un nodo. type ∈ ' + TYPE_ORDER.join('|') + '. icon: emoji | iconify (mdi:server) | url. x,y,z opcionales.',
          inputSchema: { type: 'object', properties: { label: { type: 'string' }, type: { type: 'string' }, icon: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }, color: { type: 'string' } } } },
        { name: 'UPDATE_NODE', description: 'Modifica un nodo por id (label/type/icon/color/x/y/z).',
          inputSchema: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, type: { type: 'string' }, icon: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }, color: { type: 'string' } }, required: ['id'] } },
        { name: 'MOVE_NODE', description: 'Reubica un nodo en la grilla.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }, required: ['id', 'x', 'y'] } },
        { name: 'DELETE_NODE', description: 'Elimina un nodo (y sus conexiones) por id.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'ADD_CONNECTION', description: 'Conecta dos nodos por id (flujo from → to).',
          inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } }, required: ['from', 'to'] } },
        { name: 'UPDATE_CONNECTION', description: 'Modifica una conexión (label/color/dashed/bidir).',
          inputSchema: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, color: { type: 'string' }, dashed: { type: 'boolean' }, bidir: { type: 'boolean' } }, required: ['id'] } },
        { name: 'DELETE_CONNECTION', description: 'Elimina una conexión por id.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'SET_TITLE', description: 'Cambia el título.', inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
        { name: 'SET_MODEL', description: 'Reemplaza el diagrama completo con { title, nodes, connections }.', inputSchema: { type: 'object', properties: { model: { type: 'object' } }, required: ['model'] } },
        { name: 'CLEAR', description: 'Vacía el diagrama.', inputSchema: { type: 'object', properties: {} } },
        { name: 'GET_STATE', description: 'Devuelve el estado actual.', inputSchema: { type: 'object', properties: {} } },
      ],
      getSnapshot: () => ({
        title: model.title,
        nodeCount: model.nodes.length,
        connectionCount: model.connections.length,
        nodes: model.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type, icon: iconToString(n.icon), x: n.x, y: n.y, z: n.z })),
        connections: model.connections.map((c) => ({ id: c.id, from: c.from, to: c.to, label: c.label, bidir: c.bidir })),
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          switch (type) {
            case 'ADD_NODE': { const n = addNode(p); return { success: true, message: 'Nodo "' + n.label + '" (id ' + n.id + ') en (' + n.x + ',' + n.y + ').' }; }
            case 'UPDATE_NODE': { const n = updateNode(String(p.id || ''), p); return n ? { success: true, message: 'Nodo ' + n.id + ' actualizado.' } : { success: false, error: 'No existe el nodo ' + p.id }; }
            case 'MOVE_NODE': { const n = updateNode(String(p.id || ''), { x: p.x, y: p.y, z: p.z }); return n ? { success: true, message: 'Nodo ' + n.id + ' → (' + n.x + ',' + n.y + ',' + n.z + ').' } : { success: false, error: 'No existe el nodo ' + p.id }; }
            case 'DELETE_NODE': return deleteNode(String(p.id || '')) ? { success: true, message: 'Nodo eliminado.' } : { success: false, error: 'No existe el nodo ' + p.id };
            case 'ADD_CONNECTION': { const r = addConnection(p.from, p.to, p.label); return r.ok ? { success: true, message: 'Conexión ' + r.conn.from + ' → ' + r.conn.to + '.' } : { success: false, error: r.message }; }
            case 'UPDATE_CONNECTION': { const c = updateConnection(String(p.id || ''), p); return c ? { success: true, message: 'Conexión ' + c.id + ' actualizada.' } : { success: false, error: 'No existe la conexión ' + p.id }; }
            case 'DELETE_CONNECTION': return deleteConnection(String(p.id || '')) ? { success: true, message: 'Conexión eliminada.' } : { success: false, error: 'No existe la conexión ' + p.id };
            case 'SET_TITLE': setTitle(p.title); return { success: true, message: 'Título actualizado.' };
            case 'SET_MODEL': replaceModel(p.model); return { success: true, message: 'Diagrama reemplazado: ' + model.nodes.length + ' nodo(s), ' + model.connections.length + ' conexión(es).' };
            case 'CLEAR': clearAll(); return { success: true, message: 'Diagrama vaciado.' };
            case 'GET_STATE': return { success: true, message: model.title + ': ' + model.nodes.length + ' nodo(s), ' + model.connections.length + ' conexión(es).' };
            default: return { success: false, error: 'Acción no soportada: ' + type };
          }
        } catch (e) { return { success: false, error: String((e && e.message) || e) }; }
      },
    });
  }

  // ── Geometría de presentación ──────────────────────────────────────────────
  function tileGeometry(node) {
    const P = project(node.x, node.y, node.z);
    const N = [P.sx, P.sy - HHf], E = [P.sx + HWf, P.sy], S = [P.sx, P.sy + HHf], W = [P.sx - HWf, P.sy];
    const dn = (pt) => [pt[0], pt[1] + SLAB];
    const toStr = (pts) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return {
      P,
      top: toStr([N, E, S, W]),
      left: toStr([W, S, dn(S), dn(W)]),
      right: toStr([S, E, dn(E), dn(S)]),
      ring: toStr([[P.sx, P.sy - HHf - 4], [P.sx + HWf + 6, P.sy], [P.sx, P.sy + HHf + 4], [P.sx - HWf - 6, P.sy]]),
      iconCY: P.sy - 20,
      labelY: P.sy + HHf + SLAB + 13,
    };
  }
  // Ruta ortogonal en el plano de grilla: A → esquina(bx,ay) → B.
  function connectionPath(a, b) {
    const pts = [project(a.x, a.y, a.z), project(b.x, a.y, a.z), project(b.x, b.y, b.z)];
    return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.sx.toFixed(1) + ' ' + p.sy.toFixed(1)).join(' ');
  }

  // ── Icono de nodo (elemento SVG) ───────────────────────────────────────────
  function nodeIconEl(node, cx, cy) {
    const ic = node.icon || { kind: 'emoji', value: '📦' };
    if (ic.kind === 'emoji') {
      return h('text', { x: cx, y: cy, className: 'ff-node-emoji', style: { fontSize: ICON_SIZE + 'px' } }, ic.value);
    }
    const href = iconHref(ic);
    return h('image', {
      href, 'xlink:href': href,
      x: cx - ICON_SIZE / 2, y: cy - ICON_SIZE / 2, width: ICON_SIZE, height: ICON_SIZE,
      preserveAspectRatio: 'xMidYMid meet', className: 'ff-node-img',
    });
  }

  // ── Selector de iconos (modal) ─────────────────────────────────────────────
  function IconPicker({ onPick, onClose }) {
    const [tab, setTab] = useState('emoji');     // 'emoji' | 'search' | 'url'
    const [cat, setCat] = useState(0);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [urlValue, setUrlValue] = useState('');

    useEffect(() => {
      if (tab !== 'search') return;
      const q = query.trim();
      if (q.length < 2) { setResults([]); setSearchError(''); return; }
      let cancelled = false;
      setSearching(true); setSearchError('');
      const t = setTimeout(() => {
        fetch(ICONIFY_BASE + '/search?query=' + encodeURIComponent(q) + '&limit=96')
          .then((r) => r.json())
          .then((j) => { if (!cancelled) setResults(Array.isArray(j.icons) ? j.icons : []); })
          .catch(() => { if (!cancelled) setSearchError('No se pudo buscar (sin conexión a la librería de iconos).'); })
          .finally(() => { if (!cancelled) setSearching(false); });
      }, 350);
      return () => { cancelled = true; clearTimeout(t); };
    }, [tab, query]);

    const pickEmoji = (e) => onPick({ kind: 'emoji', value: e });
    const pickIconify = (id) => onPick({ kind: 'iconify', value: id });
    const pickUrl = () => { const v = urlValue.trim(); if (v) onPick({ kind: guessIconKind(v) === 'iconify' ? 'iconify' : 'url', value: v }); };

    return h('div', { className: 'ff-modal-overlay', onPointerDown: onClose },
      h('div', { className: 'ff-modal', onPointerDown: (e) => e.stopPropagation() },
        h('div', { className: 'ff-modal-head' },
          h('span', null, 'Elegir icono'),
          h('button', { className: 'ff-icon-btn', onClick: onClose, title: 'Cerrar' }, '✕'),
        ),
        h('div', { className: 'ff-tabs' },
          h('button', { className: 'ff-tab' + (tab === 'emoji' ? ' ff-tab-active' : ''), onClick: () => setTab('emoji') }, 'Emojis'),
          h('button', { className: 'ff-tab' + (tab === 'search' ? ' ff-tab-active' : ''), onClick: () => setTab('search') }, '🔍 Iconify'),
          h('button', { className: 'ff-tab' + (tab === 'url' ? ' ff-tab-active' : ''), onClick: () => setTab('url') }, 'Importar URL'),
        ),
        tab === 'emoji'
          ? h('div', null,
              h('div', { className: 'ff-cat-row' },
                EMOJI_CATEGORIES.map((c, i) => h('button', { key: c.name, className: 'ff-chip' + (i === cat ? ' ff-chip-active' : ''), onClick: () => setCat(i) }, c.name)),
              ),
              h('div', { className: 'ff-emoji-grid' },
                EMOJI_CATEGORIES[cat].items.map((e, i) => h('button', { key: e + i, className: 'ff-emoji-btn', onClick: () => pickEmoji(e) }, e)),
              ),
            )
          : null,
        tab === 'search'
          ? h('div', null,
              h('input', { className: 'ff-input', placeholder: 'Buscar (ej. server, user, database, aws)…', autoFocus: true, value: query, onChange: (e) => setQuery(e.target.value) }),
              h('div', { className: 'ff-starter-note' }, 'Sugerencias rápidas:'),
              h('div', { className: 'ff-cat-row' },
                ICONIFY_STARTERS.map((c) => h('button', { key: c.name, className: 'ff-chip', onClick: () => { setQuery(''); setResults(c.items); setSearchError(''); } }, c.name)),
              ),
              searching ? h('div', { className: 'ff-muted' }, 'Buscando…') : null,
              searchError ? h('div', { className: 'ff-error' }, searchError) : null,
              h('div', { className: 'ff-icon-grid' },
                results.map((id) => h('button', { key: id, className: 'ff-icon-cell', title: id, onClick: () => pickIconify(id) },
                  h('img', { src: ICONIFY_BASE + '/' + id.replace(':', '/') + '.svg', width: 28, height: 28, loading: 'lazy', alt: id }),
                )),
              ),
            )
          : null,
        tab === 'url'
          ? h('div', null,
              h('p', { className: 'ff-muted' }, 'Pega la URL de una imagen/SVG, un data-URI, o un id de Iconify (ej. logos:docker-icon).'),
              h('input', { className: 'ff-input', placeholder: 'https://… , data:image/svg+xml… , mdi:server', autoFocus: true, value: urlValue, onChange: (e) => setUrlValue(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') pickUrl(); } }),
              urlValue.trim() ? h('div', { className: 'ff-url-preview' }, h('img', { src: guessIconKind(urlValue.trim()) === 'iconify' ? ICONIFY_BASE + '/' + urlValue.trim().replace(':', '/') + '.svg' : urlValue.trim(), width: 48, height: 48, alt: 'preview' })) : null,
              h('button', { className: 'ff-btn ff-btn-primary ff-block', onClick: pickUrl }, 'Usar este icono'),
            )
          : null,
      ),
    );
  }

  // ── Componente principal (lienzo) ──────────────────────────────────────────
  function Component() {
    const [m, setM] = useState(model);
    const [loadingState, setLoadingState] = useState(true);
    const [view, setView] = useState({ panX: 380, panY: 180, scale: 1 });
    const [selected, setSelected] = useState(null);     // { kind, id }
    const [connectMode, setConnectMode] = useState(false);
    const [connectFrom, setConnectFrom] = useState(null);
    const [wire, setWire] = useState(null);             // { fromId, sx, sy, hoverId }
    const [editingTitle, setEditingTitle] = useState(false);
    const [picker, setPicker] = useState(null);         // { targetId } | { create:true }
    const [showGrid, setShowGrid] = useState(true);

    const svgRef = useRef(null);
    const fileRef = useRef(null);
    const viewRef = useRef(view); viewRef.current = view;
    const interactRef = useRef({ mode: null });
    const movedRef = useRef(false);

    useEffect(() => {
      listeners.add(setM);
      let cancelled = false;
      Promise.resolve(shell.loadData()).then((data) => {
        if (cancelled) return;
        const cfg = data && typeof data === 'object' ? data : null;
        model = normalizeModel(cfg && cfg.model ? cfg.model : cfg);
        loaded = true; setM(model);
      }).catch(() => { loaded = true; }).finally(() => { if (!cancelled) setLoadingState(false); });
      return () => { cancelled = true; listeners.delete(setM); };
    }, []);

    // Teclado: Supr/Backspace borra, Escape cancela, Ctrl/Cmd+D duplica.
    useEffect(() => {
      const onKey = (e) => {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'Escape') { setWire(null); setConnectFrom(null); setSelected(null); setPicker(null); return; }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
          if (selected.kind === 'node') deleteNode(selected.id); else deleteConnection(selected.id);
          setSelected(null); e.preventDefault(); return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && selected && selected.kind === 'node') {
          const dup = duplicateNode(selected.id); if (dup) setSelected({ kind: 'node', id: dup.id }); e.preventDefault();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [selected]);

    const clientToGroup = useCallback((evt) => {
      const svg = svgRef.current; if (!svg) return { gx: 0, gy: 0 };
      const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      const ctm = svg.getScreenCTM(); if (!ctm) return { gx: 0, gy: 0 };
      const u = pt.matrixTransform(ctm.inverse());
      const v = viewRef.current;
      return { gx: (u.x - v.panX) / v.scale, gy: (u.y - v.panY) / v.scale };
    }, []);
    const nodeAtClient = useCallback((evt) => {
      const { gx, gy } = clientToGroup(evt);
      const cell = unproject(gx, gy, 0);
      return model.nodes.find((n) => n.x === cell.x && n.y === cell.y) || null;
    }, [clientToGroup]);

    // ── Interacción ────────────────────────────────────────────────────────
    const onNodePointerDown = useCallback((evt, node) => {
      evt.stopPropagation();
      if (connectMode) {
        if (!connectFrom) { setConnectFrom(node.id); setSelected({ kind: 'node', id: node.id }); }
        else if (connectFrom === node.id) setConnectFrom(null);
        else { const r = addConnection(connectFrom, node.id); if (!r.ok) notify('warn', r.message); setConnectFrom(null); }
        return;
      }
      try { evt.currentTarget.setPointerCapture(evt.pointerId); } catch { /* no-op */ }
      interactRef.current = { mode: 'drag', nodeId: node.id, z: node.z };
      movedRef.current = false;
      setSelected({ kind: 'node', id: node.id });
    }, [connectMode, connectFrom]);

    const onPortPointerDown = useCallback((evt, node) => {
      evt.stopPropagation();
      const P = project(node.x, node.y, node.z);
      interactRef.current = { mode: 'wire', fromId: node.id };
      setWire({ fromId: node.id, sx: P.sx, sy: P.sy - 20, hoverId: null });
    }, []);

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
        if (node && (node.x !== cell.x || node.y !== cell.y)) { movedRef.current = true; updateNode(it.nodeId, { x: cell.x, y: cell.y }); }
      } else if (it.mode === 'wire') {
        const { gx, gy } = clientToGroup(evt);
        const tgt = nodeAtClient(evt);
        setWire((w) => w ? { ...w, sx: gx, sy: gy, hoverId: tgt && tgt.id !== it.fromId ? tgt.id : null } : w);
      } else if (it.mode === 'pan') {
        const dx = evt.clientX - it.startX, dy = evt.clientY - it.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
        setView((vw) => ({ ...vw, panX: it.panX + dx, panY: it.panY + dy }));
      }
    }, [clientToGroup, nodeAtClient]);

    const onSvgPointerUp = useCallback((evt) => {
      const it = interactRef.current;
      interactRef.current = { mode: null };
      if (it.mode === 'wire') {
        const tgt = nodeAtClient(evt);
        if (tgt && tgt.id !== it.fromId) { const r = addConnection(it.fromId, tgt.id); if (!r.ok) notify('warn', r.message); }
        setWire(null); return;
      }
      if (it.mode === 'pan' && !movedRef.current) setSelected(null);
    }, [nodeAtClient]);

    const onSvgDoubleClick = useCallback((evt) => {
      if (connectMode) return;
      const { gx, gy } = clientToGroup(evt);
      const cell = unproject(gx, gy, 0);
      if (model.nodes.some((n) => n.x === cell.x && n.y === cell.y)) return;
      const n = addNode({ x: cell.x, y: cell.y, type: 'generic' });
      setSelected({ kind: 'node', id: n.id });
    }, [clientToGroup, connectMode]);

    const onWheel = useCallback((evt) => {
      evt.preventDefault();
      setView((vw) => ({ ...vw, scale: Math.max(0.35, Math.min(2.6, vw.scale * (evt.deltaY < 0 ? 1.1 : 1 / 1.1))) }));
    }, []);
    const zoomBy = (f) => setView((vw) => ({ ...vw, scale: Math.max(0.35, Math.min(2.6, vw.scale * f)) }));

    const fitView = useCallback(() => {
      if (!model.nodes.length) { setView({ panX: 380, panY: 180, scale: 1 }); return; }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of model.nodes) {
        const p = project(n.x, n.y, n.z);
        minX = Math.min(minX, p.sx - HW); maxX = Math.max(maxX, p.sx + HW);
        minY = Math.min(minY, p.sy - 60); maxY = Math.max(maxY, p.sy + HH);
      }
      const svg = svgRef.current; const rect = svg ? svg.getBoundingClientRect() : { width: 800, height: 500 };
      const w = Math.max(1, maxX - minX), hgt = Math.max(1, maxY - minY);
      const scale = Math.max(0.35, Math.min(1.8, Math.min((rect.width - 80) / w, (rect.height - 80) / hgt)));
      setView({ scale, panX: rect.width / 2 - ((minX + maxX) / 2) * scale, panY: rect.height / 2 - ((minY + maxY) / 2) * scale });
    }, []);

    // ── Export / Import ──────────────────────────────────────────────────────
    const exportJSON = useCallback(() => {
      try {
        const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (model.title || 'diagrama').replace(/[^\w\-]+/g, '_') + '.fossflow.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) { notify('error', 'No se pudo exportar'); }
    }, []);
    const importJSON = useCallback((file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { replaceModel(JSON.parse(String(reader.result))); notify('success', 'Diagrama importado'); }
        catch { notify('error', 'Archivo inválido'); }
      };
      reader.readAsText(file);
    }, []);

    const applyIcon = useCallback((icon) => {
      if (!picker) return;
      if (picker.targetId) updateNode(picker.targetId, { icon });
      else { const n = addNode({ icon }); setSelected({ kind: 'node', id: n.id }); }
      setPicker(null);
    }, [picker]);

    const sortedNodes = useMemo(() => m.nodes.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z || (a.id < b.id ? -1 : 1)), [m.nodes]);
    const nodeMap = useMemo(() => { const o = {}; for (const n of m.nodes) o[n.id] = n; return o; }, [m.nodes]);
    const selectedNode = selected && selected.kind === 'node' ? nodeMap[selected.id] : null;
    const selectedConn = selected && selected.kind === 'conn' ? m.connections.find((c) => c.id === selected.id) : null;

    const gridLines = useMemo(() => {
      if (!showGrid) return null;
      const lines = [];
      for (let i = -GRID; i <= GRID; i++) {
        const a = project(i, -GRID, 0), b = project(i, GRID, 0);
        lines.push(h('line', { key: 'gx' + i, x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, className: 'ff-grid-line' }));
        const c = project(-GRID, i, 0), d = project(GRID, i, 0);
        lines.push(h('line', { key: 'gy' + i, x1: c.sx, y1: c.sy, x2: d.sx, y2: d.sy, className: 'ff-grid-line' }));
      }
      return lines;
    }, [showGrid]);

    if (loadingState) return h('div', { className: 'kimos-fossflow ff-loading' }, 'Cargando diagrama…');

    const tBtn = (active, title, label, onClick) => h('button', { className: 'ff-btn' + (active ? ' ff-btn-active' : ''), title, onClick }, label);

    return h('div', { className: 'kimos-fossflow' },
      // Toolbar
      h('div', { className: 'ff-toolbar' },
        editingTitle
          ? h('input', { className: 'ff-title-input', autoFocus: true, defaultValue: m.title,
              onBlur: (e) => { setTitle(e.target.value); setEditingTitle(false); },
              onKeyDown: (e) => { if (e.key === 'Enter') { setTitle(e.target.value); setEditingTitle(false); } if (e.key === 'Escape') setEditingTitle(false); } })
          : h('span', { className: 'ff-title', title: 'Doble click para renombrar', onDoubleClick: () => setEditingTitle(true) }, '🧊 ' + m.title),
        h('span', { className: 'ff-stats' }, m.nodes.length + ' nodo' + (m.nodes.length === 1 ? '' : 's') + ' · ' + m.connections.length + ' conexión' + (m.connections.length === 1 ? '' : 'es')),
        h('div', { className: 'ff-spacer' }),
        tBtn(connectMode, 'Conectar: clic en origen y luego en destino (o arrastra el puerto ⊕ de un nodo)', connectMode ? '🔗 Conectando…' : '🔗 Conectar', () => { setConnectMode((v) => !v); setConnectFrom(null); }),
        tBtn(showGrid, 'Mostrar/ocultar grilla', '▦', () => setShowGrid((v) => !v)),
        h('button', { className: 'ff-btn', title: 'Exportar JSON', onClick: exportJSON }, '⤓'),
        h('button', { className: 'ff-btn', title: 'Importar JSON', onClick: () => fileRef.current && fileRef.current.click() }, '⤒'),
        h('input', { ref: fileRef, type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onChange: (e) => { importJSON(e.target.files && e.target.files[0]); e.target.value = ''; } }),
        h('div', { className: 'ff-zoom' },
          h('button', { className: 'ff-icon-btn', title: 'Alejar', onClick: () => zoomBy(1 / 1.1) }, '−'),
          h('button', { className: 'ff-icon-btn', title: 'Ajustar a contenido', onClick: fitView }, '⤢'),
          h('button', { className: 'ff-icon-btn', title: 'Acercar', onClick: () => zoomBy(1.1) }, '+'),
        ),
      ),
      // Paleta
      h('div', { className: 'ff-palette' },
        QUICK_EMOJIS.map((e) => h('button', { key: e, className: 'ff-pal-emoji', title: 'Agregar nodo ' + e, onClick: () => { const n = addNode({ icon: e }); setSelected({ kind: 'node', id: n.id }); } }, e)),
        h('button', { className: 'ff-pal-more', title: 'Catálogo de iconos / Iconify / importar', onClick: () => setPicker(selectedNode ? { targetId: selectedNode.id } : { create: true }) }, '🔍 Más iconos…'),
      ),
      // Lienzo + inspector
      h('div', { className: 'ff-stage' },
        h('svg', { ref: svgRef, className: 'ff-canvas' + (connectMode ? ' ff-canvas-connect' : ''), xmlns: 'http://www.w3.org/2000/svg',
          onPointerDown: onSvgPointerDown, onPointerMove: onSvgPointerMove, onPointerUp: onSvgPointerUp, onPointerLeave: onSvgPointerUp,
          onDoubleClick: onSvgDoubleClick, onWheel },
          h('defs', null,
            h('marker', { id: 'ff-arrow', viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
              h('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'context-stroke' })),
          ),
          h('g', { transform: 'translate(' + view.panX + ',' + view.panY + ') scale(' + view.scale + ')' },
            gridLines ? h('g', { className: 'ff-grid' }, gridLines) : null,
            // Conexiones
            h('g', { className: 'ff-connections' },
              m.connections.map((c) => {
                const a = nodeMap[c.from], b = nodeMap[c.to]; if (!a || !b) return null;
                const mid = project(b.x, a.y, a.z);
                const isSel = selectedConn && selectedConn.id === c.id;
                const stroke = isSel ? '#19ACB1' : c.color;
                const d = connectionPath(a, b);
                return h('g', { key: c.id, className: 'ff-conn' + (isSel ? ' ff-conn-sel' : ''),
                  onPointerDown: (e) => { e.stopPropagation(); setSelected({ kind: 'conn', id: c.id }); } },
                  h('path', { d, className: 'ff-conn-hit' }),
                  h('path', { d, className: 'ff-conn-line', stroke, strokeDasharray: c.dashed ? '7 5' : 'none', markerEnd: 'url(#ff-arrow)', markerStart: c.bidir ? 'url(#ff-arrow)' : 'none' }),
                  c.label ? h('text', { x: mid.sx, y: mid.sy - 5, className: 'ff-conn-label' }, c.label) : null,
                );
              }),
            ),
            // Cable temporal (drag-to-connect)
            wire ? (function () {
              const from = nodeById(wire.fromId); if (!from) return null;
              const P = project(from.x, from.y, from.z);
              return h('line', { x1: P.sx, y1: P.sy - 20, x2: wire.sx, y2: wire.sy, className: 'ff-wire' });
            })() : null,
            // Nodos
            h('g', { className: 'ff-nodes' },
              sortedNodes.map((node) => {
                const g = tileGeometry(node);
                const isSel = selected && selected.kind === 'node' && selected.id === node.id;
                const isFrom = connectFrom === node.id;
                const isHover = wire && wire.hoverId === node.id;
                return h('g', { key: node.id,
                  className: 'ff-node' + (isSel ? ' ff-node-sel' : '') + (isFrom ? ' ff-node-from' : '') + (isHover ? ' ff-node-hover' : '') + (connectMode ? ' ff-node-link' : ''),
                  onPointerDown: (e) => onNodePointerDown(e, node) },
                  h('ellipse', { cx: g.P.sx, cy: g.P.sy + SLAB, rx: HWf, ry: HHf, className: 'ff-node-shadow' }),
                  (isSel || isHover || isFrom) ? h('polygon', { points: g.ring, className: 'ff-node-ring' }) : null,
                  h('polygon', { points: g.left, fill: shade(node.color, -0.18), className: 'ff-tile-side' }),
                  h('polygon', { points: g.right, fill: shade(node.color, -0.30), className: 'ff-tile-side' }),
                  h('polygon', { points: g.top, fill: rgba(node.color, 0.22), stroke: rgba(node.color, 0.9), className: 'ff-tile-top' }),
                  nodeIconEl(node, g.P.sx, g.iconCY),
                  h('text', { x: g.P.sx, y: g.labelY, className: 'ff-node-label' }, node.label),
                  // Puerto de conexión (visible al seleccionar / en modo conectar)
                  (isSel || connectMode) ? h('g', { className: 'ff-port', onPointerDown: (e) => onPortPointerDown(e, node) },
                    h('circle', { cx: g.P.sx, cy: g.iconCY - ICON_SIZE / 2 - 8, r: 7, className: 'ff-port-dot' }),
                    h('text', { x: g.P.sx, y: g.iconCY - ICON_SIZE / 2 - 8, className: 'ff-port-plus' }, '+'),
                  ) : null,
                );
              }),
            ),
          ),
        ),
        // Inspector
        (selectedNode || selectedConn)
          ? h('div', { className: 'ff-inspector' },
              selectedNode
                ? h('div', null,
                    h('div', { className: 'ff-insp-head' }, 'Nodo'),
                    h('div', { className: 'ff-icon-preview' },
                      h('div', { className: 'ff-icon-box' },
                        selectedNode.icon.kind === 'emoji'
                          ? h('span', { style: { fontSize: '34px' } }, selectedNode.icon.value)
                          : h('img', { src: iconHref(selectedNode.icon), width: 40, height: 40, alt: 'icono' })),
                      h('button', { className: 'ff-btn ff-btn-primary', onClick: () => setPicker({ targetId: selectedNode.id }) }, 'Cambiar icono'),
                    ),
                    h('label', { className: 'ff-lbl' }, 'Etiqueta'),
                    h('input', { className: 'ff-input', value: selectedNode.label, onChange: (e) => updateNode(selectedNode.id, { label: e.target.value }) }),
                    h('label', { className: 'ff-lbl' }, 'Tipo (color base)'),
                    h('select', { className: 'ff-input', value: selectedNode.type, onChange: (e) => updateNode(selectedNode.id, { type: e.target.value, color: TYPES[e.target.value].color }) },
                      TYPE_ORDER.map((t) => h('option', { key: t, value: t }, TYPES[t].label))),
                    h('label', { className: 'ff-lbl' }, 'Color'),
                    h('input', { className: 'ff-color', type: 'color', value: selectedNode.color, onChange: (e) => updateNode(selectedNode.id, { color: e.target.value }) }),
                    h('div', { className: 'ff-row' },
                      h('div', null, h('label', { className: 'ff-lbl' }, 'X'), h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.x, onChange: (e) => updateNode(selectedNode.id, { x: parseInt(e.target.value, 10) }) })),
                      h('div', null, h('label', { className: 'ff-lbl' }, 'Y'), h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.y, onChange: (e) => updateNode(selectedNode.id, { y: parseInt(e.target.value, 10) }) })),
                      h('div', null, h('label', { className: 'ff-lbl' }, 'Z'), h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.z, onChange: (e) => updateNode(selectedNode.id, { z: parseInt(e.target.value, 10) }) })),
                    ),
                    h('div', { className: 'ff-row ff-mt' },
                      h('button', { className: 'ff-btn ff-flex', onClick: () => { const d = duplicateNode(selectedNode.id); if (d) setSelected({ kind: 'node', id: d.id }); } }, '⧉ Duplicar'),
                      h('button', { className: 'ff-btn ff-btn-danger ff-flex', onClick: () => { deleteNode(selectedNode.id); setSelected(null); } }, '🗑️ Eliminar'),
                    ),
                  )
                : h('div', null,
                    h('div', { className: 'ff-insp-head' }, 'Conexión'),
                    h('div', { className: 'ff-insp-sub' }, (nodeMap[selectedConn.from]?.label || selectedConn.from) + ' → ' + (nodeMap[selectedConn.to]?.label || selectedConn.to)),
                    h('label', { className: 'ff-lbl' }, 'Etiqueta'),
                    h('input', { className: 'ff-input', value: selectedConn.label, onChange: (e) => updateConnection(selectedConn.id, { label: e.target.value }) }),
                    h('label', { className: 'ff-lbl' }, 'Color'),
                    h('input', { className: 'ff-color', type: 'color', value: selectedConn.color, onChange: (e) => updateConnection(selectedConn.id, { color: e.target.value }) }),
                    h('div', { className: 'ff-check-row' },
                      h('label', { className: 'ff-check' }, h('input', { type: 'checkbox', checked: selectedConn.dashed, onChange: (e) => updateConnection(selectedConn.id, { dashed: e.target.checked }) }), ' Punteada'),
                      h('label', { className: 'ff-check' }, h('input', { type: 'checkbox', checked: selectedConn.bidir, onChange: (e) => updateConnection(selectedConn.id, { bidir: e.target.checked }) }), ' Bidireccional'),
                    ),
                    h('button', { className: 'ff-btn ff-btn-danger ff-block', onClick: () => { deleteConnection(selectedConn.id); setSelected(null); } }, '🗑️ Eliminar conexión'),
                  ),
            )
          : h('div', { className: 'ff-inspector ff-inspector-empty' },
              h('p', null, h('b', null, 'Crear nodo:'), ' doble clic en el lienzo, o usa la paleta de arriba.'),
              h('p', null, h('b', null, 'Iconos:'), ' selecciona un nodo y pulsa “Cambiar icono” (emojis, Iconify o importar por URL).'),
              h('p', null, h('b', null, 'Conectar:'), ' arrastra el puerto ⊕ de un nodo hasta otro, o usa el modo 🔗 Conectar.'),
              h('p', null, h('b', null, 'Mover:'), ' arrastra el nodo (snapping a la grilla). Arrastra el fondo para desplazar; rueda para zoom.'),
              h('p', { className: 'ff-muted' }, 'Atajos: Supr borra · Esc cancela · Ctrl/Cmd+D duplica. Un agente autorizado puede editar el diagrama y el lienzo se actualiza solo.'),
            ),
      ),
      picker ? h(IconPicker, { onPick: applyIcon, onClose: () => setPicker(null) }) : null,
    );
  }

  return {
    Component,
    unmount() {
      if (saveTimer) clearTimeout(saveTimer);
      listeners.clear();
      if (typeof unregisterAgent === 'function') { try { unregisterAgent(); } catch { /* no-op */ } }
    },
  };
}
