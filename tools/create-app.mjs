#!/usr/bin/env node
/**
 * create-app.mjs — scaffolder de apps de KIMOS. Genera el esqueleto completo
 * de una app (manifest + bundle + CSS con tokens del tema + README) con las
 * capacidades del AppShell ya cableadas, para no partir de una copia a mano.
 *
 * Standalone: funciona igual dentro de este repo o desde el creator pack
 * (no lee nada fuera de sus argumentos).
 *
 * Uso:
 *   node tools/create-app.mjs <id> [opciones]
 *
 *   <id>                     kebab-case con namespace propio: miorg.mi-app
 *   --name "Mi App"          nombre visible (default: derivado del id)
 *   --icon 🧩                emoji para la Tienda
 *   --features a,b,c         capacidades a incluir (default: savedata,config,documents,agent)
 *       savedata             documento JSON por instancia (saveData/loadData)
 *       items                CRUD de colección por instancia (shell.items)
 *       config               parámetros ⚙️ (configSchema + shell.config)
 *       documents            versiones 🗂️ (shell.documents)
 *       agent                herramientas para el agente IA (agent.control)
 *       public               gateway público (public.read + public.submit + embed)
 *       data:<templateId>    lectura de datos de otra app (data.read:<templateId>)
 *   --dir <carpeta>          destino (default: ./<id>)
 *
 * Ejemplos:
 *   node tools/create-app.mjs miorg.inventario --name "Inventario" --icon 📦
 *   node tools/create-app.mjs miorg.panel --features items,agent,data:contact-forms
 *
 * Después: edita dist/index.js, verifica con tools/verify-app.mjs y empaqueta
 * con tools/pack.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';

const APP_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const KNOWN_FEATURES = new Set(['savedata', 'items', 'config', 'documents', 'agent', 'public']);

function fail(msg) { console.error('✖ ' + msg); process.exit(1); }

// ── Argumentos ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const id = args[0] && !args[0].startsWith('-') ? args[0].trim() : '';
if (!id) fail('Uso: node tools/create-app.mjs <id> [--name "Mi App"] [--icon 🧩] [--features savedata,config,documents,agent] [--dir carpeta]');
if (!APP_ID_RE.test(id)) fail("`id` inválido (minúsculas/dígitos/. _ -). Usa namespace propio: 'miorg.mi-app'.");
if (!id.includes('.')) console.warn("! El id no tiene namespace ('miorg.mi-app'): sin él puede chocar con apps oficiales.");

function opt(flag, dflt = '') {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const displayName = opt('--name', id.split('.').pop().split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const icon = opt('--icon', '🧩');
const rawFeatures = opt('--features', 'savedata,config,documents,agent').split(',').map((f) => f.trim()).filter(Boolean);
const outDir = opt('--dir', path.join(process.cwd(), id));

const features = new Set();
const dataReads = [];
for (const f of rawFeatures) {
  if (f.startsWith('data:')) { dataReads.push(f.slice(5)); features.add('data'); continue; }
  if (!KNOWN_FEATURES.has(f)) fail(`Feature desconocida '${f}'. Válidas: ${[...KNOWN_FEATURES].join(', ')}, data:<templateId>.`);
  features.add(f);
}
if (features.has('savedata') && features.has('items')) {
  console.warn('! savedata + items a la vez: es válido, pero la mayoría de apps usa uno u otro (documento vs colección).');
}

const has = (f) => features.has(f);
const cssClass = id.replace(/[^a-z0-9]+/g, '-');       // miorg.mi-app → miorg-mi-app
const prefix = cssClass.split('-').map((s) => s[0] || '').join('').slice(0, 4) || 'app'; // prefijo corto de clases

// ── manifest.json ─────────────────────────────────────────────────────────────
const permissions = ['instance.read', 'instance.write'];
if (has('agent')) permissions.push('agent.control');
if (has('public')) permissions.push('public.read', 'public.submit');
for (const t of dataReads) permissions.push(`data.read:${t}`);

const manifest = {
  id,
  name: displayName,
  version: '1.0.0',
  description: `${displayName} — describe aquí qué hace tu app (texto de la Tienda).`,
  icon,
  author: 'Tu nombre / organización',
  entry: 'dist/index.js',
  css: 'dist/index.css',
  appShellApi: '1.x',
  multiInstance: true,
  permissions,
};
if (has('config')) {
  manifest.configSchema = {
    title: `Preferencias de ${displayName}`,
    fields: [
      { key: 'accent', label: 'Color de acento', type: 'color' },
      { key: 'maxItems', label: 'Máximo de elementos', type: 'number', min: 1, max: 200 },
    ],
  };
  manifest.defaultConfig = { accent: '#19ACB1', maxItems: 50 };
}

// ── dist/index.js ─────────────────────────────────────────────────────────────
const L = [];
L.push(`/**`);
L.push(` * ${displayName} — app de KIMOS generada con tools/create-app.mjs.`);
L.push(` *`);
L.push(` * Reglas de oro (APP-SPEC.md §3): React del host (globalThis.React), sin`);
L.push(` * JSX, estado DENTRO de mount() (closure), CSS con clase raíz, y unmount()`);
L.push(` * limpia timers/listeners/agente. Si guardas datos: multiInstance en el manifest.`);
L.push(` */`);
L.push(`export default function mount(shell) {`);
L.push(`  const React = globalThis.React;`);
L.push(`  if (!React || typeof React.createElement !== 'function') {`);
L.push(`    throw new Error('globalThis.React no disponible: el host debe exponer React.');`);
L.push(`  }`);
L.push(`  const h = React.createElement;`);
L.push(`  const { useState, useEffect } = React;`);
L.push(``);
L.push(`  // Mantener en sincronía con manifest.json (regla §7.a de APP-SPEC.md):`);
L.push(`  // súbelos JUNTOS en cada entrega y píntala en la cabecera.`);
L.push(`  const APP_VERSION = '1.0.0';`);
L.push(`  const instanceId = shell.app && shell.app.instanceId;`);
L.push(``);
L.push(`  // ── Estado (closure: una copia por ventana) ───────────────────────────`);
L.push(`  let model = { entries: [] }; // ajusta el modelo a tu dominio`);
if (has('config')) L.push(`  let settings = { accent: '#19ACB1', maxItems: 50 };`);
L.push(`  const listeners = new Set();`);
if (has('config')) L.push(`  const emit = () => { for (const l of listeners) l({ model, settings }); };`);
else L.push(`  const emit = () => { for (const l of listeners) l({ model }); };`);
L.push(``);
if (has('savedata')) {
  L.push(`  // ── Persistencia por documento: saveData con debounce ─────────────────`);
  L.push(`  let saveTimer = null;`);
  L.push(`  function scheduleSave() {`);
  L.push(`    clearTimeout(saveTimer);`);
  L.push(`    saveTimer = setTimeout(() => {`);
  L.push(`      shell.saveData(model).catch(() => shell.notify({ level: 'error', text: 'No se pudo guardar.' }));`);
  L.push(`    }, 600);`);
  L.push(`  }`);
  L.push(`  function commit(next) { model = next; emit(); scheduleSave(); }`);
  L.push(``);
  L.push(`  async function load() {`);
  L.push(`    try {`);
  L.push(`      const data = await shell.loadData();`);
  L.push(`      if (data && Array.isArray(data.entries)) model = { ...model, ...data };`);
  L.push(`    } catch (e) { /* primera apertura */ }`);
  L.push(`    emit();`);
  L.push(`  }`);
} else {
  L.push(`  function commit(next) { model = next; emit(); }`);
}
if (has('items')) {
  L.push(``);
  L.push(`  // ── Colección por instancia (shell.items): filas/tarjetas/envíos ──────`);
  L.push(`  async function refreshItems() {`);
  L.push(`    if (!instanceId) return;`);
  L.push(`    try {`);
  L.push(`      const items = await shell.items.list();`);
  L.push(`      commit({ ...model, entries: items });`);
  L.push(`    } catch (e) { shell.notify({ level: 'error', text: 'No se pudieron cargar los datos.' }); }`);
  L.push(`  }`);
  L.push(`  // shell.items.create({...}) / .update(id, {...}) / .remove(id) para mutar.`);
}
L.push(``);
L.push(`  // ── Mutaciones: LA UI y EL AGENTE usan las mismas funciones ───────────`);
L.push(`  function addEntry(text) {`);
L.push(`    const clean = String(text || '').trim().slice(0, 500);`);
L.push(`    if (!clean) return { success: false, error: 'El texto no puede estar vacío.' };`);
if (has('config')) {
  L.push(`    if (model.entries.length >= (Number(settings.maxItems) || 50)) {`);
  L.push(`      return { success: false, error: 'Máximo de elementos alcanzado (ajústalo en ⚙️).' };`);
  L.push(`    }`);
}
L.push(`    const entry = { id: 'e' + Date.now().toString(36), text: clean, updatedAt: new Date().toISOString() };`);
L.push(`    commit({ ...model, entries: [...model.entries, entry] });`);
L.push(`    return { success: true, message: 'Añadido.', id: entry.id };`);
L.push(`  }`);
L.push(`  function removeEntry(id) {`);
L.push(`    if (!model.entries.some((e) => e.id === id)) return { success: false, error: 'No existe ' + id + '.' };`);
L.push(`    commit({ ...model, entries: model.entries.filter((e) => e.id !== id) });`);
L.push(`    return { success: true, message: 'Eliminado.' };`);
L.push(`  }`);
if (has('config')) {
  L.push(``);
  L.push(`  // ── Parámetros ⚙️ (shell.config): el host genera el formulario ────────`);
  L.push(`  let offConfig = null;`);
  L.push(`  async function initConfig() {`);
  L.push(`    if (!(shell.config && shell.config.get)) return;`);
  L.push(`    try {`);
  L.push(`      const s = await shell.config.get();`);
  L.push(`      if (s && typeof s === 'object') settings = { ...settings, ...s };`);
  L.push(`      emit();`);
  L.push(`      offConfig = shell.config.onChange((next) => { settings = { ...settings, ...(next || {}) }; emit(); });`);
  L.push(`    } catch (e) { /* sin config guardada aún */ }`);
  L.push(`  }`);
}
if (has('documents')) {
  L.push(``);
  L.push(`  // ── Versiones 🗂️ (shell.documents): Guardar versión / Historial ───────`);
  L.push(`  function initDocuments() {`);
  L.push(`    if (!shell.documents) return;`);
  L.push(`    shell.documents.onSerialize(() => ({ model }));`);
  L.push(`    shell.documents.onLoad((doc) => {`);
  L.push(`      if (doc && doc.model) { model = doc.model; emit();${has('savedata') ? ' scheduleSave();' : ''} }`);
  L.push(`    });`);
  L.push(`  }`);
}
if (has('agent')) {
  L.push(``);
  L.push(`  // ── Agente IA (shell.agent): valida TODO input del agente ─────────────`);
  L.push(`  let offAgent = null;`);
  L.push(`  function initAgent() {`);
  L.push(`    if (!(shell.agent && shell.agent.register)) return;`);
  L.push(`    offAgent = shell.agent.register({`);
  L.push(`      label: '${displayName}',`);
  L.push(`      description: 'Describe aquí qué puede hacer el agente en tu app.',`);
  L.push(`      tools: [`);
  L.push(`        { name: 'ADD_ENTRY', description: 'Añade un elemento.',`);
  L.push(`          inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },`);
  L.push(`        { name: 'REMOVE_ENTRY', description: 'Elimina un elemento por id.',`);
  L.push(`          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },`);
  L.push(`      ],`);
  L.push(`      // Incluye los IDs (el agente los necesita para actuar) y la versión.`);
  L.push(`      getSnapshot: () => ({ version: APP_VERSION, entries: model.entries.map((e) => ({ id: e.id, text: e.text })) }),`);
  L.push(`      dispatchAction: async (action) => {`);
  L.push(`        const { type, payload } = action || {};`);
  L.push(`        const p = payload && typeof payload === 'object' ? payload : {};`);
  L.push(`        if (type === 'ADD_ENTRY') return addEntry(p.text);`);
  L.push(`        if (type === 'REMOVE_ENTRY') return removeEntry(String(p.id || ''));`);
  L.push(`        return { success: false, error: 'Acción desconocida: ' + String(type) };`);
  L.push(`      },`);
  L.push(`    });`);
  L.push(`  }`);
}
if (has('data')) {
  L.push(``);
  L.push(`  // ── Datos de OTRA app (shell.data) — permisos: ${dataReads.map((t) => 'data.read:' + t).join(', ')} ──`);
  L.push(`  async function loadExternal() {`);
  L.push(`    if (!(shell.data && shell.data.listInstances)) return { error: 'Host sin shell.data.' };`);
  L.push(`    try {`);
  L.push(`      const instances = await shell.data.listInstances('${dataReads[0]}');`);
  L.push(`      // const items = await shell.data.listItems(instances[0].id);`);
  L.push(`      return { instances };`);
  L.push(`    } catch (e) { return { error: 'Sin acceso (¿app instalada? ¿permiso aprobado?).' }; }`);
  L.push(`  }`);
}
if (has('public')) {
  L.push(``);
  L.push(`  // ── Gateway público: opt-in POR INSTANCIA en items/definition ─────────`);
  L.push(`  // GET  /api/public/app/{instanceId}/definition  → definition.public.data`);
  L.push(`  // POST /api/public/app/{instanceId}/submit/{canal} → items kind='submission'`);
  L.push(`  async function publicar(enabled) {`);
  L.push(`    const def = {`);
  L.push(`      id: 'definition', kind: 'definition',`);
  L.push(`      public: { enabled: !!enabled, channels: ['mensaje'], data: { title: '${displayName}' } },`);
  L.push(`    };`);
  L.push(`    try {`);
  L.push(`      const items = await shell.items.list();`);
  L.push(`      const exists = items.some((i) => i.id === 'definition' || i.kind === 'definition');`);
  L.push(`      if (exists) await shell.items.update('definition', def); else await shell.items.create(def);`);
  L.push(`      shell.notify({ level: 'success', text: enabled ? 'Publicado.' : 'Despublicado.' });`);
  L.push(`    } catch (e) { shell.notify({ level: 'error', text: 'No se pudo publicar.' }); }`);
  L.push(`  }`);
  L.push(`  // Sirve tu widget como asset público: assets/embed.js →`);
  L.push(`  // /api/apps/${id}/asset/embed.js (mira apps/miorg.encuestas del creator pack).`);
}
L.push(``);
L.push(`  // ── UI ─────────────────────────────────────────────────────────────────`);
L.push(`  function Component() {`);
if (has('config')) L.push(`    const [state, setState] = useState({ model, settings });`);
else L.push(`    const [state, setState] = useState({ model });`);
L.push(`    const [draft, setDraft] = useState('');`);
L.push(`    useEffect(() => {`);
L.push(`      listeners.add(setState);`);
if (has('items')) {
  L.push(`      void refreshItems();`);
  L.push(`      // Colaboración: refresco periódico cuando la ventana se ve (APP-SPEC §5.1).`);
  L.push(`      const t = setInterval(() => {`);
  L.push(`        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refreshItems();`);
  L.push(`      }, 30000);`);
  L.push(`      return () => { listeners.delete(setState); clearInterval(t); };`);
} else {
  L.push(`      return () => listeners.delete(setState);`);
}
L.push(`    }, []);`);
L.push(``);
L.push(`    if (!instanceId) {`);
L.push(`      return h('div', { className: '${cssClass}' },`);
L.push(`        h('div', { className: '${prefix}-empty' }, 'Crea un documento desde la pantalla de bienvenida.'));`);
L.push(`    }`);
L.push(``);
L.push(`    const submit = () => {`);
L.push(`      const r = addEntry(draft);`);
L.push(`      if (r.success) setDraft(''); else shell.notify({ level: 'warn', text: r.error });`);
L.push(`    };`);
L.push(``);
const styleRoot = has('config')
  ? `{ className: '${cssClass}', style: { '--x-accent-user': state.settings.accent } }`
  : `{ className: '${cssClass}' }`;
L.push(`    return h('div', ${styleRoot}, [`);
L.push(`      h('div', { key: 'head', className: '${prefix}-head' }, [`);
L.push(`        h('div', { key: 't', className: '${prefix}-title' }, [`);
L.push(`          '${icon} ${displayName} ',`);
L.push(`          h('span', { key: 'v', className: '${prefix}-ver', title: '${displayName} v' + APP_VERSION }, 'v' + APP_VERSION),`);
L.push(`        ]),`);
L.push(`      ]),`);
L.push(`      h('div', { key: 'body', className: '${prefix}-body' }, [`);
L.push(`        h('div', { key: 'new', className: '${prefix}-new' }, [`);
L.push(`          h('input', {`);
L.push(`            key: 'i', className: '${prefix}-input', placeholder: 'Nuevo elemento…', value: draft,`);
L.push(`            onChange: (e) => setDraft(e.target.value),`);
L.push(`            onKeyDown: (e) => { if (e.key === 'Enter') submit(); },`);
L.push(`          }),`);
L.push(`          h('button', { key: 'b', className: '${prefix}-btn ${prefix}-btn-primary', onClick: submit }, 'Añadir'),`);
L.push(`        ]),`);
L.push(`        state.model.entries.length === 0`);
L.push(`          ? h('div', { key: 'e', className: '${prefix}-muted' }, 'Sin elementos todavía.')`);
L.push(`          : state.model.entries.map((entry) => h('div', { key: entry.id, className: '${prefix}-item' }, [`);
L.push(`              h('span', { key: 't', className: '${prefix}-item-text' }, entry.text),`);
L.push(`              h('button', { key: 'x', className: '${prefix}-btn ${prefix}-btn-danger', onClick: () => removeEntry(entry.id) }, '✕'),`);
L.push(`            ])),`);
L.push(`      ]),`);
L.push(`    ]);`);
L.push(`  }`);
L.push(``);
L.push(`  // ── Arranque ───────────────────────────────────────────────────────────`);
if (has('savedata')) L.push(`  void load();`);
if (has('config')) L.push(`  void initConfig();`);
if (has('documents')) L.push(`  initDocuments();`);
if (has('agent')) L.push(`  initAgent();`);
L.push(``);
L.push(`  return {`);
L.push(`    Component,`);
L.push(`    unmount() {`);
if (has('savedata')) L.push(`      clearTimeout(saveTimer);`);
L.push(`      listeners.clear();`);
if (has('config')) L.push(`      if (typeof offConfig === 'function') offConfig();`);
if (has('agent')) L.push(`      if (typeof offAgent === 'function') offAgent();`);
L.push(`    },`);
L.push(`  };`);
L.push(`}`);
L.push(``);
const bundle = L.join('\n');

// ── dist/index.css ────────────────────────────────────────────────────────────
const css = `/* ${displayName} — scope .${cssClass}, tema-consciente (APP-SPEC.md §9).
 * Ni un color propio cableado: todo sale de los tokens del tema del host
 * (shadcn/HSL) con fallback al tema claro. La raíz NO pinta fondo (debajo está
 * el fondo del escritorio); las superficies son "vidrio" (translúcido + blur). */
.${cssClass} {
  --x-fg: hsl(var(--foreground, 220 25% 6%));
  --x-muted: hsl(var(--muted-foreground, 215 20% 32%) / 0.75);
  --x-border: hsl(var(--border, 214 18% 82%) / 0.6);
  --x-glass: hsl(var(--card, 0 0% 100%) / 0.6);
  --x-surface: hsl(var(--muted, 220 14% 94%) / 0.45);
  --x-accent: var(--x-accent-user, hsl(var(--primary, 182 75% 40%)));
  --x-accent-fg: hsl(var(--primary-foreground, 0 0% 100%));
  --x-radius: var(--radius, 0.5rem);

  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: Inter, system-ui, sans-serif;
  color: var(--x-fg);
  background: transparent;
  overflow: hidden;
}
.${cssClass} .${prefix}-head { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--x-border); flex-shrink: 0; background: var(--x-glass); backdrop-filter: blur(10px); }
.${cssClass} .${prefix}-title { font-weight: 700; font-size: 14px; flex: 1; }
.${cssClass} .${prefix}-ver { font-size: 10px; font-weight: 500; color: var(--x-muted); }
.${cssClass} .${prefix}-body { flex: 1; overflow-y: auto; padding: 14px; }
.${cssClass} .${prefix}-empty { display: flex; align-items: center; justify-content: center; height: 100%; min-height: 160px; font-size: 14px; text-align: center; padding: 20px; }
.${cssClass} .${prefix}-muted { color: var(--x-muted); font-size: 13px; }
.${cssClass} .${prefix}-new { display: flex; gap: 8px; margin-bottom: 12px; }
.${cssClass} .${prefix}-input { flex: 1; border: 1px solid hsl(var(--input, 214 18% 82%)); border-radius: var(--x-radius); padding: 8px 12px; font-size: 13px; font-family: inherit; color: var(--x-fg); background: var(--x-glass); }
.${cssClass} .${prefix}-input:focus { outline: 2px solid var(--x-accent); outline-offset: -1px; }
.${cssClass} .${prefix}-btn { border: none; border-radius: var(--x-radius); padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.${cssClass} .${prefix}-btn-primary { background: var(--x-accent); color: var(--x-accent-fg); }
.${cssClass} .${prefix}-btn-danger { background: transparent; color: var(--x-muted); padding: 4px 8px; }
.${cssClass} .${prefix}-btn-danger:hover { color: #ef4444; }
.${cssClass} .${prefix}-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; border: 1px solid var(--x-border); border-radius: var(--x-radius); margin-bottom: 6px; background: var(--x-glass); backdrop-filter: blur(10px); }
.${cssClass} .${prefix}-item-text { font-size: 13px; word-break: break-word; }

/* Modo noche: retoca SOLO los colores semánticos ilegibles sobre oscuro. */
.dark .${cssClass} .${prefix}-btn-danger:hover { color: #f87171; }
`;

// ── README.md ─────────────────────────────────────────────────────────────────
const readme = `# ${icon} ${displayName}

App de KIMOS generada con \`create-app.mjs\` (features: ${rawFeatures.join(', ')}).

## Desarrollo

1. Edita \`dist/index.js\` (sin JSX; React del host vía \`globalThis.React\`).
2. Verifica: \`node tools/verify-app.mjs ${id}\`
3. Empaqueta: \`node tools/pack.mjs ${id}\` → \`${id}-1.0.0.kapp\`
4. Instala: Tienda de KIMOS → "Instalar desde archivo" (superadmin).

Al publicar un cambio, sube la versión en \`manifest.json\` y en el
\`APP_VERSION\` del bundle **a la vez** (y actualiza la tabla de abajo).
Nunca reutilices un número ya entregado: el host cachea el bundle por versión.

## Versionado

Versión actual: **1.0.0**

| Versión | Qué trae |
|---|---|
| 1.0.0 | Esqueleto inicial. |
`;

// ── Escritura ─────────────────────────────────────────────────────────────────
if (fs.existsSync(path.join(outDir, 'manifest.json'))) fail(`Ya existe una app en ${outDir}. Elige otro destino con --dir.`);
fs.mkdirSync(path.join(outDir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'dist', 'index.js'), bundle);
fs.writeFileSync(path.join(outDir, 'dist', 'index.css'), css);
fs.writeFileSync(path.join(outDir, 'README.md'), readme);

console.log(`✔ App '${id}' generada en ${outDir}`);
console.log(`  features: ${rawFeatures.join(', ')}`);
console.log(`  permisos: [${permissions.join(', ')}]`);
console.log('');
console.log('Siguientes pasos:');
console.log(`  1. Edita ${path.join(outDir, 'dist', 'index.js')}`);
console.log(`  2. node tools/verify-app.mjs ${outDir}`);
console.log(`  3. node tools/pack.mjs ${outDir}`);
