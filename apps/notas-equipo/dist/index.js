/**
 * Notas de Equipo — app instalable multi-instancia (v2.1).
 *
 * Cada nota es un item de la instancia (`shell.items`), así que dos personas
 * escribiendo notas distintas nunca se pisan: el CRUD ya es por nota.
 *
 * v2.1
 *   - **Etiquetar escribiendo `@`**: al teclear `@` en el redactor se despliega
 *     la lista de la organización (personas y agentes IA) filtrada mientras se
 *     escribe; ↑↓ para moverse, Enter/Tab para etiquetar, Esc para cerrar.
 *   - La lista junta los **actores humanos** (`/api/identity/actors`) y los
 *     **agentes IA** (`/api/identity/agents`), marcados con 🤖.
 *   - Lo escrito y los chips van sincronizados: etiquetar deja `@Nombre` en el
 *     texto, y quitar un chip borra ese `@Nombre`. Al guardar, cualquier
 *     `@Nombre` escrito a mano también queda etiquetado.
 *
 * v2.0
 *   - Notas EDITABLES (texto, responsable y personas mencionadas).
 *   - **Responsable** de la nota y **menciones** a las personas a las que va
 *     dirigida (chips + @Nombre dentro del texto, resaltado al leer).
 *   - Redactor de verdad: área multilínea donde Enter hace salto de línea
 *     (se envía con el botón o Ctrl/⌘+Enter) y barra de formato — negrita,
 *     cursiva, tachado, código, viñetas, numeración, cita, título y enlace.
 *     El formato se guarda como texto plano con marcas tipo markdown y se
 *     pinta como elementos React (nunca innerHTML), así que no hay forma de
 *     inyectar HTML desde una nota.
 *   - Aspecto unificado con el resto de KIMOS (mismos tokens de tema que
 *     ProductLab): fondo transparente, superficies de vidrio, día y noche.
 *   - El equipo ve las notas de los demás sin recargar (sincronización
 *     periódica mientras la ventana se ve).
 *
 * Bundle ESM puro: usa `globalThis.React` (expuesto por el host), sin JSX y
 * sin empaquetar React. Contrato AppShellV1: mount(shell) -> {Component, unmount}.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo } = React;

  // Versión de la app: se muestra en la cabecera para saber, al probar, qué
  // build está instalado. Mantener en sincronía con manifest.json.
  const APP_VERSION = '2.1.0';

  const instanceId = shell.app && shell.app.instanceId;
  const teamId = shell.app && shell.app.teamId;

  function apiBase() {
    try {
      const raw = shell.assetUrl ? shell.assetUrl('x').split('/api/apps/')[0] : '';
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) { return window.location.origin; }
  }
  const API = apiBase();
  const req = (url, init) => (shell.authFetch ? shell.authFetch(url, init) : fetch(url, init));

  const s = (v) => (v == null ? '' : String(v));
  const stamp = () => new Date().toISOString();
  const canon = (v) => s(v).trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const SYNC_MS = 15000;

  // ── Estado del módulo ───────────────────────────────────────────────────
  let model = {
    notes: [], members: [], me: null, docName: '',
    loaded: false, offline: false, tab: 'all',
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l({ ...model }));
  const setModel = (patch) => { model = Object.assign({}, model, patch); emit(); };
  const meLabel = () => (model.me && (model.me.name || model.me.id)) || '';
  const meId = () => (model.me && model.me.id) || '';

  const isNote = (it) => it && it.kind !== 'definition';
  function normalizeNote(n) {
    return Object.assign({ text: '', responsibleId: '', responsibleName: '', mentionIds: [], mentionNames: [] }, n, {
      mentionIds: Array.isArray(n.mentionIds) ? n.mentionIds : [],
      mentionNames: Array.isArray(n.mentionNames) ? n.mentionNames : [],
    });
  }
  const noteTime = (n) => s(n.updatedAt) || s(n.createdAt) || '';
  const sortNotes = (list) => list.slice().sort((a, b) => (noteTime(b) > noteTime(a) ? 1 : noteTime(b) < noteTime(a) ? -1 : 0));

  // ── Carga y sincronización ──────────────────────────────────────────────
  async function refresh() {
    if (!instanceId) { setModel({ loaded: true }); return; }
    try {
      const items = await shell.items.list();
      const notes = sortNotes((items || []).filter(isNote).map(normalizeNote));
      // Solo se repinta si algo cambió: no molesta a quien está escribiendo.
      if (JSON.stringify(notes) !== JSON.stringify(model.notes) || !model.loaded || model.offline) {
        setModel({ notes, loaded: true, offline: false });
      }
    } catch (e) {
      setModel({ loaded: true, offline: true });
    }
  }

  let loadedOnce = false;
  async function load() {
    if (loadedOnce) return;
    loadedOnce = true;
    await refresh();
    try {
      const res = await req(API + '/api/identity/actors', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({
          members: mergeMembers(model.members, (data.actors || []).filter((a) => a && a.active !== false)
            .map((a) => ({ id: s(a.id), name: s(a.displayName || a.name || a.email || a.id), kind: actorKind(a) }))),
        });
      }
    } catch (e) { /* opcional */ }
    // Agentes IA de la organización: se etiquetan igual que una persona.
    try {
      const res = await req(API + '/api/identity/agents', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setModel({
          members: mergeMembers(model.members, (data.agents || []).filter((a) => a && a.active !== false)
            .map((a) => ({ id: s(a.id), name: s(a.name || a.displayName || a.id), kind: 'ai' }))),
        });
      }
    } catch (e) { /* opcional */ }
    try {
      const res = await req(API + '/api/identity/me', { cache: 'no-store' });
      if (res.ok) {
        const me = await res.json();
        setModel({ me: { id: s(me.id), name: s(me.displayName || me.name || me.email || me.id) } });
      }
    } catch (e) { /* opcional */ }
    if (instanceId) {
      try {
        const res = await req(API + '/api/app-instances/' + instanceId, { cache: 'no-store' });
        if (res.ok) setModel({ docName: s(((await res.json()) || {}).name) });
      } catch (e) { /* opcional */ }
    }
  }

  let syncSubs = 0;
  let syncTimer = null;
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    if (!syncSubs) return;
    syncTimer = setTimeout(() => {
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      (hidden ? Promise.resolve() : refresh()).then(scheduleSync);
    }, SYNC_MS);
  }
  function onWake() { if (syncSubs) refresh().then(scheduleSync); }
  function startSync() {
    syncSubs += 1;
    if (syncSubs === 1) {
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake);
      if (typeof window !== 'undefined') window.addEventListener('focus', onWake);
      scheduleSync();
    }
    return () => {
      syncSubs = Math.max(0, syncSubs - 1);
      if (syncSubs) return;
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
    };
  }

  // ── Personas y agentes IA ───────────────────────────────────────────────
  /** ¿Este actor es un agente IA o una persona? (el backend lo puede decir de
   *  varias formas; si no lo dice, es una persona). */
  function actorKind(a) {
    if (a.isAgent === true || a.isBot === true || a.agent === true) return 'ai';
    const raw = canon([a.kind, a.type, a.actorType, a.category].filter(Boolean).join(' '));
    return /(^| )(ai|ia|bot|agent|agente|assistant|asistente|virtual)( |$)/.test(raw) ? 'ai' : 'human';
  }
  const isAi = (m) => !!m && m.kind === 'ai';
  /** Une listas de personas sin repetir (ni por id ni por nombre): humanos
   *  primero, luego los agentes IA, cada grupo alfabético. */
  function mergeMembers(...lists) {
    const out = [];
    const seen = new Set();
    for (const list of lists) {
      for (const m of list || []) {
        if (!m || !m.id || !m.name) continue;
        const keys = [m.id, 'n:' + canon(m.name)];
        if (keys.some((k) => seen.has(k))) continue;
        keys.forEach((k) => seen.add(k));
        out.push({ id: m.id, name: m.name, kind: m.kind === 'ai' ? 'ai' : 'human' });
      }
    }
    return out.sort((a, b) => (isAi(a) === isAi(b) ? a.name.localeCompare(b.name) : (isAi(a) ? 1 : -1)));
  }

  const escapeRx = (v) => s(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** Personas escritas como `@Nombre` dentro del texto (para que etiquetar a
   *  mano, sin pasar por el menú, también cuente). */
  function mentionsInText(text) {
    const body = s(text);
    if (body.indexOf('@') < 0) return [];
    return model.members
      .filter((m) => new RegExp('@' + escapeRx(m.name) + '(?![\\p{L}\\p{N}_])', 'iu').test(body))
      .map((m) => m.id);
  }
  /** Agrega al par (ids, names) las personas mencionadas en el texto. */
  function withTextMentions(text, ids, names) {
    const outIds = [...ids], outNames = [...names];
    for (const id of mentionsInText(text)) {
      if (outIds.includes(id)) continue;
      const m = model.members.find((x) => x.id === id);
      if (m) { outIds.push(m.id); outNames.push(m.name); }
    }
    return { ids: outIds, names: outNames };
  }

  function findMember(ref) {
    const raw = s(ref).trim();
    if (!raw) return null;
    const needle = canon(raw);
    return model.members.find((m) => m.id === raw)
      || model.members.find((m) => canon(m.name) === needle)
      || model.members.filter((m) => canon(m.name).includes(needle))[0]
      || null;
  }
  function resolvePeople(list) {
    const ids = [], names = [], missing = [];
    for (const ref of list || []) {
      const m = findMember(ref);
      if (m) { ids.push(m.id); names.push(m.name); } else missing.push(s(ref));
    }
    return { ids, names, missing };
  }
  const memberNames = () => model.members.map((m) => '"' + m.name + '"').join(', ') || '(no hay personas cargadas)';

  // ── Mutaciones (UI y agente comparten estas funciones) ──────────────────
  async function addNote(fields) {
    const text = s(fields.text).replace(/\s+$/, '');
    if (!text.trim()) return { success: false, error: 'La nota está vacía.' };
    const resp = fields.responsible ? findMember(fields.responsible) : null;
    if (fields.responsible && !resp) {
      return { success: false, error: 'Responsable "' + fields.responsible + '" no encontrado. Personas: ' + memberNames() + '.' };
    }
    const men = resolvePeople(fields.mentions);
    if (men.missing.length) {
      return { success: false, error: 'No encontré a: ' + men.missing.join(', ') + '. Personas: ' + memberNames() + '.' };
    }
    const tagged = withTextMentions(text, men.ids, men.names);
    const payload = {
      text,
      responsibleId: resp ? resp.id : '',
      responsibleName: resp ? resp.name : '',
      mentionIds: tagged.ids, mentionNames: tagged.names,
      createdAt: stamp(), createdBy: meLabel(), createdById: meId(),
      updatedAt: stamp(), updatedBy: meLabel(),
    };
    try {
      const created = await shell.items.create(payload);
      setModel({ notes: sortNotes([normalizeNote(created), ...model.notes]), offline: false });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar la nota.' });
      return { success: false, error: 'No se pudo guardar la nota.' };
    }
    return { success: true, message: 'Nota agregada' + (resp ? ' (responsable: ' + resp.name + ')' : '') + '.' };
  }

  function findNote(ref) {
    const raw = s(ref).trim();
    if (!raw) return null;
    const needle = canon(raw);
    const byId = model.notes.find((n) => n.id === raw);
    if (byId) return byId;
    const exact = model.notes.find((n) => canon(n.text) === needle);
    if (exact) return exact;
    const partial = model.notes.filter((n) => canon(n.text).includes(needle));
    return partial.length === 1 ? partial[0] : null;
  }

  async function updateNote(ref, patch) {
    const note = findNote(ref);
    if (!note) {
      const sample = model.notes.slice(0, 10).map((n) => '"' + s(n.text).slice(0, 40) + '"').join(', ');
      return { success: false, error: 'Nota no encontrada. Notas actuales: ' + (sample || '(ninguna)') + '.' };
    }
    const next = {};
    if (patch.text != null) {
      if (!s(patch.text).trim()) return { success: false, error: 'El texto de la nota no puede quedar vacío.' };
      next.text = s(patch.text).replace(/\s+$/, '');
    }
    if (patch.responsible != null) {
      const raw = s(patch.responsible).trim();
      const resp = raw ? findMember(raw) : null;
      if (raw && !resp) return { success: false, error: 'Responsable "' + raw + '" no encontrado. Personas: ' + memberNames() + '.' };
      next.responsibleId = resp ? resp.id : '';
      next.responsibleName = resp ? resp.name : '';
    }
    if (patch.mentions != null) {
      const men = resolvePeople(patch.mentions);
      if (men.missing.length) {
        return { success: false, error: 'No encontré a: ' + men.missing.join(', ') + '. Personas: ' + memberNames() + '.' };
      }
      next.mentionIds = men.ids; next.mentionNames = men.names;
    }
    if (!Object.keys(next).length) {
      return { success: false, error: 'Nada que cambiar. Campos válidos: text, responsible, mentions.' };
    }
    // Lo escrito manda: los `@Nombre` del texto también quedan etiquetados.
    const finalText = next.text != null ? next.text : s(note.text);
    const tagged = withTextMentions(
      finalText,
      next.mentionIds != null ? next.mentionIds : (note.mentionIds || []),
      next.mentionNames != null ? next.mentionNames : (note.mentionNames || []),
    );
    next.mentionIds = tagged.ids;
    next.mentionNames = tagged.names;
    next.updatedAt = stamp();
    next.updatedBy = meLabel();
    const optimistic = Object.assign({}, note, next);
    setModel({ notes: sortNotes(model.notes.map((n) => (n.id === note.id ? optimistic : n))) });
    try {
      const saved = await shell.items.update(note.id, next);
      setModel({ notes: sortNotes(model.notes.map((n) => (n.id === note.id ? normalizeNote(saved) : n))), offline: false });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar el cambio.' });
      void refresh();
      return { success: false, error: 'No se pudo guardar el cambio.' };
    }
    return { success: true, message: 'Nota actualizada.' };
  }

  async function removeNote(ref) {
    const note = findNote(ref);
    if (!note) return { success: false, error: 'Nota no encontrada.' };
    const before = model.notes;
    setModel({ notes: model.notes.filter((n) => n.id !== note.id) });
    try { await shell.items.remove(note.id); }
    catch (e) {
      setModel({ notes: before });
      return { success: false, error: 'No se pudo eliminar la nota.' };
    }
    return { success: true, message: 'Nota eliminada.' };
  }

  // ── Formato: marcas tipo markdown → elementos React ─────────────────────
  // Se guarda TEXTO PLANO con marcas. Al pintar se construyen elementos React,
  // nunca HTML: una nota no puede inyectar marcado en la app.

  /** Trocea una línea en **negrita**, *cursiva*, ~~tachado~~, `código`,
   *  enlaces y @menciones (contra los nombres reales del equipo). */
  function inline(line, key) {
    const people = model.members.slice().sort((a, b) => b.name.length - a.name.length);
    const out = [];
    let buf = '';
    let i = 0;
    let n = 0;
    const flush = () => { if (buf) { out.push(buf); buf = ''; } };
    const push = (el) => { flush(); out.push(el); };
    const pair = (mark, tag, cls) => {
      const end = line.indexOf(mark, i + mark.length);
      if (end < 0) return false;
      const inner = line.slice(i + mark.length, end);
      if (!inner.trim()) return false;
      push(h(tag, { key: key + '-' + (n++), className: cls }, inner));
      i = end + mark.length;
      return true;
    };
    while (i < line.length) {
      const rest = line.slice(i);
      if (rest.startsWith('**') && pair('**', 'strong')) continue;
      if (rest.startsWith('~~') && pair('~~', 'del')) continue;
      if (rest.startsWith('`') && pair('`', 'code')) continue;
      if (rest[0] === '*' && rest[1] !== '*' && pair('*', 'em')) continue;
      if (rest[0] === '_' && rest[1] !== '_' && pair('_', 'em')) continue;
      const url = rest.match(/^https?:\/\/[^\s<>()]+/);
      if (url) {
        push(h('a', { key: key + '-' + (n++), href: url[0], target: '_blank', rel: 'noopener noreferrer' }, url[0]));
        i += url[0].length;
        continue;
      }
      if (rest[0] === '@') {
        const hit = people.find((p) => canon(rest.slice(1, 1 + p.name.length)) === canon(p.name));
        const word = (hit && hit.name) || (rest.slice(1).match(/^[^\s,.;:]+/) || [''])[0];
        if (word) {
          push(h('span', { key: key + '-' + (n++), className: 'nt-mention' + (isAi(hit) ? ' nt-mention-ai' : '') },
            (isAi(hit) ? '🤖 @' : '@') + word));
          i += 1 + word.length;
          continue;
        }
      }
      buf += line[i];
      i += 1;
    }
    flush();
    return out;
  }

  /** Bloques: títulos, viñetas, numeración, citas y párrafos. */
  function RichText({ text }) {
    const lines = s(text).split('\n');
    const blocks = [];
    let i = 0;
    let k = 0;
    while (i < lines.length) {
      const line = lines[i];
      const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const quote = line.match(/^\s*>\s?(.*)$/);
      const head = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (bullet || numbered) {
        const ordered = !!numbered;
        const items = [];
        while (i < lines.length) {
          const m2 = lines[i].match(ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/);
          if (!m2) break;
          items.push(h('li', { key: 'li' + (k++) }, inline(m2[1], 'li' + k)));
          i += 1;
        }
        blocks.push(h(ordered ? 'ol' : 'ul', { key: 'b' + (k++) }, items));
        continue;
      }
      if (quote) {
        const parts = [];
        while (i < lines.length) {
          const m2 = lines[i].match(/^\s*>\s?(.*)$/);
          if (!m2) break;
          parts.push(m2[1]);
          i += 1;
        }
        blocks.push(h('blockquote', { key: 'b' + (k++) }, inline(parts.join(' '), 'q' + k)));
        continue;
      }
      if (head) {
        blocks.push(h(head[1].length <= 2 ? 'h3' : 'h4', { key: 'b' + (k++) }, inline(head[2], 'h' + k)));
        i += 1;
        continue;
      }
      // Párrafo: junta líneas seguidas y conserva sus saltos (white-space: pre-wrap).
      const parts = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim() || /^\s*([-*+]\s+|\d+[.)]\s+|>|#{1,6}\s)/.test(l)) break;
        parts.push(l);
        i += 1;
      }
      if (parts.length) {
        blocks.push(h('p', { key: 'b' + (k++) }, parts.flatMap((l, j) => {
          const seg = inline(l, 'p' + k + '-' + j);
          return j === 0 ? seg : [h('br', { key: 'br' + k + '-' + j }), ...seg];
        })));
      } else {
        i += 1;   // línea en blanco
      }
    }
    return h('div', { className: 'nt-rich' }, blocks);
  }

  // ── Agente ──────────────────────────────────────────────────────────────
  const TOOLS = [
    { name: 'ADD_NOTE', description: 'Agrega una nota. Admite responsable y personas mencionadas, y formato con marcas (**negrita**, *cursiva*, "- " para viñetas, "1. " para numeración).',
      inputSchema: { type: 'object', properties: {
        text: { type: 'string', description: 'Texto de la nota; \\n para saltos de línea.' },
        responsible: { type: 'string', description: 'id o nombre de la persona responsable' },
        mentions: { type: 'array', items: { type: 'string' }, description: 'personas o agentes IA a los que va dirigida (también sirve escribir @Nombre dentro del texto)' },
      }, required: ['text'] } },
    { name: 'UPDATE_NOTE', description: 'Edita una nota existente: texto, responsable y/o menciones.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'string', description: 'id de la nota (o parte de su texto)' },
        text: { type: 'string' },
        responsible: { type: 'string', description: 'vacío para dejarla sin responsable' },
        mentions: { type: 'array', items: { type: 'string' } },
      }, required: ['id'] } },
    { name: 'DELETE_NOTE', description: 'Elimina una nota por su id (o por parte de su texto).',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'LIST_NOTES', description: 'Lista las notas actuales de esta instancia.',
      inputSchema: { type: 'object', properties: {} } },
  ];
  const ACTION_ALIASES = {
    CREATE_NOTE: 'ADD_NOTE', NEW_NOTE: 'ADD_NOTE',
    EDIT_NOTE: 'UPDATE_NOTE', UPDATE_NOTE_TEXT: 'UPDATE_NOTE',
    SET_NOTE_RESPONSIBLE: 'UPDATE_NOTE', ASSIGN_NOTE: 'UPDATE_NOTE', MENTION_NOTE: 'UPDATE_NOTE',
    REMOVE_NOTE: 'DELETE_NOTE', GET_NOTES: 'LIST_NOTES',
  };

  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'Notas de Equipo',
      description: 'Bloc de notas del equipo: listar, agregar, EDITAR y eliminar notas, '
        + 'con responsable y menciones a las personas a las que van dirigidas.',
      tools: TOOLS,
      getSnapshot: () => ({
        version: APP_VERSION,
        document: model.docName || undefined,
        total: model.notes.length,
        personas: model.members.map((m) => ({ id: m.id, name: m.name, tipo: isAi(m) ? 'agente IA' : 'persona' })),
        notas: model.notes.map((n) => ({
          id: n.id, text: n.text,
          responsable: n.responsibleName || null,
          dirigidaA: n.mentionNames || [],
          autor: n.createdBy || null,
          actualizada: noteTime(n) || null,
        })),
      }),
      dispatchAction: async (action) => {
        const type = ACTION_ALIASES[action.type] || action.type;
        const p = (action && action.payload) || {};
        const ref = p.id != null ? p.id : (p.note != null ? p.note : p.noteId);
        const mentions = Array.isArray(p.mentions) ? p.mentions
          : (Array.isArray(p.mentionNames) ? p.mentionNames : (p.mention != null ? [p.mention] : null));
        const responsible = p.responsible != null ? p.responsible
          : (p.responsibleName != null ? p.responsibleName : p.responsibleId);
        try {
          if (type === 'ADD_NOTE') return await addNote({ text: p.text, responsible, mentions });
          if (type === 'UPDATE_NOTE') {
            return await updateNote(ref, {
              text: p.text,
              responsible: responsible,
              mentions: mentions,
            });
          }
          if (type === 'DELETE_NOTE') return await removeNote(ref);
          if (type === 'LIST_NOTES') {
            await refresh();
            return {
              success: true,
              message: model.notes.length
                ? ('Hay ' + model.notes.length + ' nota(s): ' + model.notes.map((n) => {
                  const extra = [];
                  if (n.responsibleName) extra.push('responsable ' + n.responsibleName);
                  if ((n.mentionNames || []).length) extra.push('para ' + n.mentionNames.join(', '));
                  return '"' + s(n.text).replace(/\n+/g, ' ').slice(0, 90) + '"' + (extra.length ? ' (' + extra.join('; ') + ')' : '');
                }).join(' · '))
                : 'No hay notas todavía.',
            };
          }
          return { success: false, error: 'Acción desconocida: ' + action.type + '. Acciones válidas: ' + TOOLS.map((t) => t.name).join(', ') + '.' };
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  /** Iniciales para el avatar del menú de @menciones. */
  function initials(name) {
    const parts = s(name).trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  /** Candidatos para el menú de `@`: empiezan por lo escrito, luego el resto. */
  function matchMembers(members, query) {
    const needle = canon(query);
    if (!needle) return members;
    const starts = [], has = [];
    for (const m of members) {
      const c = canon(m.name);
      if (c.startsWith(needle)) starts.push(m);
      else if (c.includes(needle) || canon(m.id).includes(needle)) has.push(m);
    }
    return starts.concat(has);
  }
  /** `@` escrito justo antes del cursor (o null si el cursor no está en uno). */
  function mentionTrigger(text, caret) {
    const upto = s(text).slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at < 0) return null;
    const before = at > 0 ? upto[at - 1] : '';
    if (before && !/[\s(["'*_~>-]/.test(before)) return null;   // parte de un correo, no una mención
    const query = upto.slice(at + 1);
    if (query.length > 32 || /[\n@]/.test(query)) return null;
    return { start: at, query };
  }

  /** Selector de personas (chips). `multi` para las menciones. */
  function PeoplePick({ members, value, onChange, multi, empty }) {
    const sel = multi ? (value || []) : (value ? [value] : []);
    if (!members.length) return h('span', { className: 'nt-muted' }, 'Sin personas en el equipo');
    return h('div', { className: 'nt-people-pick' },
      !multi && h('button', {
        type: 'button', className: 'nt-chip nt-chip-btn' + (sel.length ? '' : ' nt-chip-active'),
        onClick: () => onChange(''),
      }, empty || 'Sin asignar'),
      members.map((m) => {
        const on = sel.includes(m.id);
        return h('button', {
          key: m.id, type: 'button',
          className: 'nt-chip nt-chip-btn' + (on ? ' nt-chip-active' : ''),
          onClick: () => {
            if (!multi) { onChange(on ? '' : m.id); return; }
            onChange(on ? sel.filter((x) => x !== m.id) : [...sel, m.id]);
          },
        }, (isAi(m) ? '🤖 ' : '') + (on && multi ? '@' : '') + m.name);
      }),
    );
  }

  /**
   * Redactor: barra de formato + área multilínea. Enter = salto de línea
   * (redactar de verdad); se envía con el botón o con Ctrl/⌘+Enter.
   */
  function Editor({ value, onChange, onSubmit, onCancel, members, responsible, onResponsible, mentions, onMentions, submitLabel, autoFocus }) {
    const ref = useRef(null);
    const [showPeople, setShowPeople] = useState(false);
    // Menú de @menciones: {start, query} del `@` que se está escribiendo.
    const [at, setAt] = useState(null);
    const [pick, setPick] = useState(0);
    const closedAt = useRef(-1);
    const listRef = useRef(null);

    const options = useMemo(() => (at ? matchMembers(members, at.query).slice(0, 8) : []), [at, members]);
    const menuOpen = !!at && options.length > 0;
    const active = options[Math.min(pick, options.length - 1)];

    useEffect(() => {
      const el = listRef.current && listRef.current.querySelector('.nt-mention-opt-on');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }, [pick, menuOpen]);

    /** Recalcula el menú a partir del texto y de dónde está el cursor. */
    const syncMenu = (text, caret) => {
      const t = mentionTrigger(text, caret);
      if (!t || closedAt.current === t.start) { setAt(null); return; }
      closedAt.current = -1;
      setAt(t);
      setPick(0);
    };
    const closeMenu = () => { if (at) closedAt.current = at.start; setAt(null); };
    const caretNow = () => (ref.current ? ref.current.selectionStart : s(value).length);
    const putCaret = (pos) => setTimeout(() => {
      const ta = ref.current;
      if (ta) { ta.focus(); ta.setSelectionRange(pos, pos); }
    }, 0);

    /** Etiqueta a alguien: deja `@Nombre` en el texto y su chip en la nota. */
    const tag = (member) => {
      if (!member || !at) return;
      const caret = caretNow();
      const txt = '@' + member.name + ' ';
      onChange(value.slice(0, at.start) + txt + value.slice(caret));
      if (!(mentions || []).includes(member.id)) onMentions([...(mentions || []), member.id]);
      closedAt.current = -1;
      setAt(null);
      putCaret(at.start + txt.length);
    };
    /** Al destildar a alguien, se va también su `@Nombre` del texto. */
    const untag = (member) => {
      if (!member) return;
      const rx = new RegExp('[ \\t]?@' + escapeRx(member.name) + '(?![\\p{L}\\p{N}_])', 'giu');
      if (rx.test(value)) onChange(value.replace(rx, ''));
    };

    /** Envuelve la selección (o inserta un ejemplo si no hay selección). */
    const wrap = (mark, sample) => {
      const ta = ref.current;
      if (!ta) return;
      const a = ta.selectionStart, b = ta.selectionEnd;
      const sel = value.slice(a, b) || sample;
      const next = value.slice(0, a) + mark + sel + mark + value.slice(b);
      onChange(next);
      const pos = a + mark.length + sel.length + mark.length;
      setTimeout(() => { ta.focus(); ta.setSelectionRange(a + mark.length, a + mark.length + sel.length); }, 0);
      return pos;
    };
    /** Prefija cada línea seleccionada (viñetas, numeración, cita, título). */
    const prefix = (make) => {
      const ta = ref.current;
      if (!ta) return;
      const a = ta.selectionStart, b = ta.selectionEnd;
      const start = value.lastIndexOf('\n', a - 1) + 1;
      const endRaw = value.indexOf('\n', b);
      const end = endRaw < 0 ? value.length : endRaw;
      const chunk = value.slice(start, end) || '';
      const lines = chunk.split('\n');
      const done = lines.map((l, i) => make(l.replace(/^\s*([-*+]\s+|\d+[.)]\s+|>\s?|#{1,6}\s+)/, ''), i)).join('\n');
      const next = value.slice(0, start) + done + value.slice(end);
      onChange(next);
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start, start + done.length); }, 0);
    };
    const insert = (txt) => {
      const ta = ref.current;
      if (!ta) return;
      const a = ta.selectionStart;
      const next = value.slice(0, a) + txt + value.slice(ta.selectionEnd);
      onChange(next);
      setTimeout(() => { ta.focus(); ta.setSelectionRange(a + txt.length, a + txt.length); }, 0);
    };

    const tool = (label, title, cls, onClick) => h('button', {
      key: title, type: 'button', className: 'nt-tool' + (cls ? ' ' + cls : ''),
      title, onMouseDown: (e) => e.preventDefault(), onClick,
    }, label);

    return h('div', { className: 'nt-composer' },
      h('div', { className: 'nt-toolbar' },
        tool('B', 'Negrita', 'nt-tool-b', () => wrap('**', 'negrita')),
        tool('I', 'Cursiva', 'nt-tool-i', () => wrap('*', 'cursiva')),
        tool('S', 'Tachado', 'nt-tool-s', () => wrap('~~', 'tachado')),
        tool('</>', 'Código', 'nt-tool-code', () => wrap('`', 'código')),
        h('span', { className: 'nt-toolsep', key: 'sep1' }),
        tool('H', 'Título', null, () => prefix((l) => '## ' + l)),
        tool('•', 'Viñetas', null, () => prefix((l) => '- ' + l)),
        tool('1.', 'Numeración', null, () => prefix((l, i) => (i + 1) + '. ' + l)),
        tool('❝', 'Cita', null, () => prefix((l) => '> ' + l)),
        tool('🔗', 'Enlace', null, () => insert('https://')),
        h('span', { className: 'nt-toolsep', key: 'sep2' }),
        tool('@', 'Etiquetar escribiendo @ (personas y agentes IA)', null, () => {
          const a = caretNow();
          const txt = (a > 0 && !/\s/.test(value[a - 1]) ? ' ' : '') + '@';
          const end = ref.current ? ref.current.selectionEnd : a;
          onChange(value.slice(0, a) + txt + value.slice(end));
          closedAt.current = -1;
          setAt({ start: a + txt.length - 1, query: '' });
          setPick(0);
          putCaret(a + txt.length);
        }),
        tool('👥', 'Elegir de la lista del equipo', null, () => setShowPeople(!showPeople)),
        h('span', { className: 'nt-spacer', key: 'sp' }),
        h('span', { className: 'nt-muted', key: 'hint' },
          h('span', { className: 'nt-kbd' }, '@'), ' etiqueta · Enter = salto de línea · ',
          h('span', { className: 'nt-kbd' }, 'Ctrl+Enter'), ' envía'),
      ),
      h('div', { className: 'nt-ta-wrap' },
        h('textarea', {
          ref, className: 'nt-textarea', value, autoFocus: !!autoFocus,
          placeholder: 'Escribe la nota…  @ para etiquetar, **negrita**, *cursiva*, "- " para viñetas.',
          role: 'combobox', 'aria-expanded': menuOpen, 'aria-autocomplete': 'list',
          onChange: (e) => { onChange(e.target.value); syncMenu(e.target.value, e.target.selectionStart); },
          onClick: (e) => syncMenu(value, e.target.selectionStart),
          onBlur: () => setAt(null),
          onKeyUp: (e) => {
            if (menuOpen && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) syncMenu(value, e.target.selectionStart);
          },
          onKeyDown: (e) => {
            if (menuOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setPick((i) => (i + 1) % options.length); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setPick((i) => (i - 1 + options.length) % options.length); return; }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); tag(active); return; }
              if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit(); return; }
            if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel(); }
          },
        }),
        menuOpen && h('div', { className: 'nt-mentions', role: 'listbox' },
          h('div', { className: 'nt-mentions-hd' },
            at.query ? 'Etiquetar a “' + at.query + '”' : 'Etiquetar a…'),
          h('div', { className: 'nt-mentions-list', ref: listRef },
            options.map((mem, i) => h('button', {
              key: mem.id, type: 'button', role: 'option', 'aria-selected': i === pick,
              className: 'nt-mention-opt' + (i === pick ? ' nt-mention-opt-on' : ''),
              onMouseDown: (e) => e.preventDefault(),
              onMouseEnter: () => setPick(i),
              onClick: () => tag(mem),
            },
              h('span', { className: 'nt-mention-av' + (isAi(mem) ? ' nt-mention-av-ai' : '') },
                isAi(mem) ? '🤖' : initials(mem.name)),
              h('span', { className: 'nt-mention-nm' }, mem.name),
              isAi(mem) && h('span', { className: 'nt-mention-tag' }, 'Agente IA'),
              (mentions || []).includes(mem.id) && h('span', { className: 'nt-mention-on' }, '✓'),
            ))),
          h('div', { className: 'nt-mentions-ft' },
            h('span', { className: 'nt-kbd' }, '↑↓'), ' moverse · ',
            h('span', { className: 'nt-kbd' }, 'Enter'), ' etiquetar · ',
            h('span', { className: 'nt-kbd' }, 'Esc'), ' cerrar'),
        ),
      ),
      showPeople && h('div', { className: 'nt-field' }, 'Etiquetar:',
        h(PeoplePick, {
          members, value: mentions, multi: true,
          onChange: (ids) => {
            const added = ids.filter((x) => !(mentions || []).includes(x));
            const gone = (mentions || []).filter((x) => !ids.includes(x));
            onMentions(ids);
            // Chips y texto van juntos: marcar deja el @nombre, desmarcar lo quita.
            for (const id of added) {
              const mem = members.find((x) => x.id === id);
              if (mem && value.indexOf('@' + mem.name) < 0) insert((value && !/\s$/.test(value) ? ' ' : '') + '@' + mem.name + ' ');
            }
            for (const id of gone) untag(members.find((x) => x.id === id));
          },
        })),
      h('div', { className: 'nt-composer-foot' },
        h('span', { className: 'nt-field' }, 'Responsable:',
          h('select', {
            className: 'nt-select', value: responsible || '',
            onChange: (e) => onResponsible(e.target.value),
          },
            h('option', { value: '' }, 'Sin asignar'),
            members.map((m) => h('option', { key: m.id, value: m.id }, (isAi(m) ? '🤖 ' : '') + m.name)))),
        (mentions || []).length > 0 && h('span', { className: 'nt-field' }, 'Dirigida a:',
          (mentions || []).map((id) => {
            const mem = members.find((x) => x.id === id);
            return mem && h('button', {
              key: id, type: 'button', className: 'nt-chip nt-chip-btn nt-chip-active',
              title: 'Quitar la etiqueta de ' + mem.name,
              onClick: () => { onMentions((mentions || []).filter((x) => x !== id)); untag(mem); },
            }, (isAi(mem) ? '🤖 ' : '') + '@' + mem.name, h('span', { className: 'nt-chip-x' }, '×'));
          })),
        h('span', { className: 'nt-spacer' }),
        onCancel && h('button', { className: 'nt-btn', onClick: onCancel }, 'Cancelar'),
        h('button', {
          className: 'nt-btn nt-btn-primary', onClick: onSubmit, disabled: !s(value).trim(),
        }, submitLabel || 'Agregar nota'),
      ),
    );
  }

  function Note({ note, m, onEdit }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [resp, setResp] = useState('');
    const [mentions, setMentions] = useState([]);
    const mine = (note.mentionIds || []).includes(meId());

    const startEdit = () => {
      setDraft(s(note.text));
      setResp(s(note.responsibleId));
      setMentions([...(note.mentionIds || [])]);
      setEditing(true);
    };
    const save = async () => {
      const res = await onEdit(note.id, { text: draft, responsible: resp, mentions });
      if (res && res.success === false) shell.notify({ level: 'error', text: res.error });
      else setEditing(false);
    };

    if (editing) {
      return h('div', { className: 'nt-note' },
        h(Editor, {
          value: draft, onChange: setDraft, onSubmit: save, onCancel: () => setEditing(false),
          members: m.members, responsible: resp, onResponsible: setResp,
          mentions, onMentions: setMentions, submitLabel: 'Guardar', autoFocus: true,
        }),
      );
    }

    const when = noteTime(note);
    return h('div', { className: 'nt-note' + (mine ? ' nt-note-mine' : '') },
      h('div', { className: 'nt-note-head' },
        h('div', { className: 'nt-note-people' },
          note.responsibleName
            ? h('span', { className: 'nt-chip nt-chip-resp', title: 'Responsable de la nota' }, '◆ ' + note.responsibleName)
            : h('span', { className: 'nt-chip', title: 'Sin responsable' }, 'Sin responsable'),
          (note.mentionNames || []).map((nm, i) => {
            const mem = m.members.find((x) => x.id === (note.mentionIds || [])[i]) || m.members.find((x) => canon(x.name) === canon(nm));
            return h('span', {
              key: nm + i, className: 'nt-chip nt-chip-active',
              title: isAi(mem) ? 'Dirigida a un agente IA' : 'Dirigida a',
            }, (isAi(mem) ? '🤖 ' : '') + '@' + nm);
          }),
        ),
        h('div', { className: 'nt-note-tools' },
          h('button', { className: 'nt-mini', title: 'Editar nota', onClick: startEdit }, '✎ Editar'),
          h('button', {
            className: 'nt-mini nt-danger', title: 'Eliminar nota',
            onClick: () => { if (window.confirm('¿Eliminar esta nota?')) void removeNote(note.id); },
          }, '🗑'),
        ),
      ),
      h(RichText, { text: note.text }),
      h('div', { className: 'nt-note-meta' },
        (note.createdBy ? note.createdBy + ' · ' : '')
        + (when ? when.slice(0, 10) + ' ' + when.slice(11, 16) : '')
        + (note.updatedBy && note.updatedAt && note.updatedAt !== note.createdAt ? ' · editada por ' + note.updatedBy : '')),
    );
  }

  function Component() {
    const [m, setM] = useState({ ...model });
    const [text, setText] = useState('');
    const [resp, setResp] = useState('');
    const [mentions, setMentions] = useState([]);

    useEffect(() => { listeners.add(setM); return () => listeners.delete(setM); }, []);
    useEffect(() => { load(); return startSync(); }, []);

    const visible = useMemo(() => {
      if (m.tab === 'mine') return m.notes.filter((n) => (n.mentionIds || []).includes(meId()));
      if (m.tab === 'resp') return m.notes.filter((n) => n.responsibleId && n.responsibleId === meId());
      return m.notes;
    }, [m.notes, m.tab, m.me]);

    const mineCount = m.notes.filter((n) => (n.mentionIds || []).includes(meId())).length;
    const respCount = m.notes.filter((n) => n.responsibleId && n.responsibleId === meId()).length;

    const submit = async () => {
      const res = await addNote({ text, responsible: resp, mentions });
      if (res.success) { setText(''); setMentions([]); }
      else shell.notify({ level: 'error', text: res.error });
    };

    if (!instanceId) {
      return h('div', { className: 'kimos-notas' },
        h('div', { className: 'nt-empty' },
          h('div', { className: 'nt-empty-icon' }, '🗒️'),
          h('div', null, 'Crea un documento desde la pantalla de bienvenida: cada uno es un bloc de notas distinto del equipo.'),
          h('div', { className: 'nt-ver' }, 'v' + APP_VERSION)));
    }

    return h('div', { className: 'kimos-notas' },
      h('div', { className: 'nt-hd' },
        h('div', { className: 'nt-hd-title' },
          h('span', null, '🗒️ ' + (m.docName || 'Notas de Equipo')),
          h('span', { className: 'nt-hd-sub' }, m.notes.length + (m.notes.length === 1 ? ' nota' : ' notas')),
          h('span', { className: 'nt-ver', title: 'Notas de Equipo v' + APP_VERSION }, 'v' + APP_VERSION),
        ),
        h('div', { className: 'nt-tabbar' },
          h('button', { className: 'nt-tab' + (m.tab === 'all' ? ' nt-tab-active' : ''), onClick: () => setModel({ tab: 'all' }) },
            'Todas'),
          h('button', { className: 'nt-tab' + (m.tab === 'mine' ? ' nt-tab-active' : ''), onClick: () => setModel({ tab: 'mine' }) },
            'Para mí', mineCount > 0 && h('span', { className: 'nt-tab-count' }, mineCount)),
          h('button', { className: 'nt-tab' + (m.tab === 'resp' ? ' nt-tab-active' : ''), onClick: () => setModel({ tab: 'resp' }) },
            'A mi cargo', respCount > 0 && h('span', { className: 'nt-tab-count' }, respCount)),
        ),
        h('div', { className: 'nt-hd-actions' },
          h('span', {
            className: 'nt-live' + (m.offline ? ' nt-live-off' : ''),
            title: m.offline ? 'Sin conexión: reintentando' : 'Las notas del equipo se actualizan solas',
          }, h('span', { className: 'nt-live-dot' }), m.offline ? 'Sin conexión' : 'En vivo'),
        ),
      ),

      h('div', { className: 'nt-body' },
        !m.loaded
          ? h('div', { className: 'nt-empty' }, 'Cargando…')
          : visible.length === 0
            ? h('div', { className: 'nt-empty' },
                h('div', { className: 'nt-empty-icon' }, '🗒️'),
                h('div', null, m.tab === 'mine' ? 'No hay notas dirigidas a ti.'
                  : m.tab === 'resp' ? 'No tienes notas a tu cargo.'
                  : 'Sin notas todavía. Escribe la primera abajo.'))
            : visible.map((n) => h(Note, { key: n.id, note: n, m, onEdit: updateNote })),
      ),

      h(Editor, {
        value: text, onChange: setText, onSubmit: submit,
        members: m.members, responsible: resp, onResponsible: setResp,
        mentions, onMentions: setMentions,
      }),
    );
  }

  return {
    Component,
    unmount() {
      listeners.clear();
      syncSubs = 0;
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
      if (typeof unregisterAgent === 'function') {
        try { unregisterAgent(); } catch (e) { /* noop */ }
      }
    },
  };
}
