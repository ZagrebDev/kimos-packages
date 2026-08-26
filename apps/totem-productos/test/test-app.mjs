// Smoke test: monta la app con shell/React simulados y ejercita la carga de
// catálogos (products con opciones/variantes, productlab crudo con motor de
// precios, productlab con JSON público v2), el dedupe por storeRef, el agente
// (las acciones mueven la vista), la publicación del snapshot y el modo
// vitrina pública (fetch del endpoint público + localStorage).
//
//   node apps/totem-productos/test/test-app.mjs

const calls = [];
globalThis.React = {
  createElement: (t, p, ...c) => ({ t, p, c }),
  Fragment: 'fragment',
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: (v) => ({ current: v }),
};

const localStore = new Map();
globalThis.window = {
  location: { origin: 'http://kimos.local', href: 'http://kimos.local/', search: '' },
  localStorage: {
    getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
    setItem: (k, v) => localStore.set(k, String(v)),
  },
};
globalThis.document = { visibilityState: 'visible' };

const assert = (cond, msg) => { if (!cond) { console.error('✖ ' + msg); process.exitCode = 1; } else console.log('✔ ' + msg); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fixtures ─────────────────────────────────────────────────────────────────
// Instancia de products: un producto simple, uno con opciones/variantes y uno
// enlazado a ProductLab (debe deduplicarse).
const productsItems = [
  { id: 'definition', kind: 'definition', settings: {} },
  { id: 'prod-simple', name: 'Taza Kimos', sku: 'TZ-01', price: 5990, stock: 10, status: 'active', imageUrl: 'https://cdn/t.png', description: '<p>Taza de <b>cerámica</b>.</p>' },
  {
    id: 'prod-opts', name: 'Polera Estampada', sku: 'PL-01', price: 1000, status: 'active',
    compareAtPrice: 1500,
    options: [
      { name: 'Color', optionType: 'option', values: [{ name: 'Rojo' }, { name: 'Azul' }] },
      { name: 'Envoltorio', optionType: 'addon', addonPrice: 500, values: [{ name: 'Regalo' }] },
    ],
    variants: [
      { options: { Color: 'Rojo' }, price: 1000 },
      { options: { Color: 'Azul' }, price: 1200 },
    ],
  },
  { id: 'prod-linked', name: 'Mesa Roble (tienda)', price: 50000, status: 'active' },
];

// Instancia de productlab SIN publicar → motor de precios local.
// cmp-a 10000 → 10000·1.25·1.19 = 14875 ; cmp-b 20000 → 29750
// delta v-b = round((29750-14875)/100)·100 = 14900
const plRawItems = [
  {
    id: 'definition', kind: 'definition',
    rules: { currency: 'CLP', currencySymbol: '$', currencyDecimals: 0, locale: 'es-CL', salesTaxPct: 19, marginBasis: 'cost', marginDefaultPct: 25, deltaRoundTo: 100, roundMode: 'none', leadTimeDays: 3 },
    public: { enabled: false },
  },
  { id: 'cmp-a', kind: 'component', name: 'Roble', type: 'madera', cost: 10000, currency: 'CLP', specs: 'Roble macizo', deliveryDays: 2, stock: 5, active: true, imageUrl: 'https://cdn/roble.png' },
  { id: 'cmp-b', kind: 'component', name: 'Nogal', type: 'madera', cost: 20000, currency: 'CLP', deliveryDays: 4, stock: null, active: true },
  { id: 'cmp-agotado', kind: 'component', name: 'Cerezo', type: 'madera', cost: 1, currency: 'CLP', stock: 0, active: true },
  {
    id: 'eq-mesa', kind: 'producto', name: 'Mesa Roble', sku: 'MESA-1', status: 'active', priceMode: 'auto', price: 50000,
    imageUrl: 'https://cdn/mesa.png', galleryImages: ['https://cdn/mesa2.png'],
    storeRef: { instanceId: 'p-inst', itemId: 'prod-linked', sku: 'MESA-1', name: 'Mesa Roble' },
    deliveryMode: 'max',
    groups: [
      {
        id: 'g-mad', typeId: 'madera', label: 'Madera', photoStep: true, defaultValueId: 'v-a',
        values: [
          { id: 'v-a', label: 'Roble', componentIds: ['cmp-a'] },
          { id: 'v-b', label: 'Nogal', componentIds: ['cmp-b'] },
          { id: 'v-x', label: 'Cerezo', componentIds: ['cmp-agotado'] },   // agotado: no se ofrece
          { id: 'v-f', label: 'Relleno', componentIds: [], fallback: true }, // fallback: no se ofrece
        ],
      },
      { id: 'g-base', typeId: 'madera', label: 'Estructura', baseStep: true, values: [{ id: 'v-s', label: 'Std', componentIds: [] }] },
    ],
    presets: [{ id: 'pre-1', name: 'Premium', selection: { 'g-mad': 'v-b' } }],
    storefront: { specs: [{ id: 's1', group: '', label: 'Alto', value: '75 cm' }], style: { accentColor: '#AA3366', radius: 4 } },
  },
  { id: 'eq-off', kind: 'equipo', name: 'Producto inactivo', status: 'inactive', price: 1, groups: [] },
];

// Instancia de productlab QUE publica el JSON v2 resuelto.
const plPubItems = [
  {
    id: 'definition', kind: 'definition',
    rules: { currency: 'CLP', currencySymbol: '$', currencyDecimals: 0, locale: 'es-CL' },
    public: {
      enabled: true, channels: [],
      data: {
        version: 2, currency: 'CLP',
        productos: [{
          sku: 'CAM-001', name: 'Camisa Clásica', basePrice: 157100, deliveryDays: 6, leadTimeDays: 3, deliveryMode: 'max',
          imageUrl: 'https://cdn/cam.png', images: ['https://cdn/cam.png'],
          description: '<p>Camisa de lino.</p>',
          storefront: { specs: [{ group: '', label: 'Cuello', value: 'Italiano' }], style: { accentColor: '#112233', radius: 10 } },
          presets: [{ id: 'p1', name: 'Verano', selection: [{ group: 'Tela', value: 'Lino' }] }],
          groups: [{
            id: 'g1', label: 'Tela', nota: '', affectsPhoto: false, dependsOn: null,
            values: [
              { id: 'v-alg', name: 'Algodón', desc: '1× Algodón 20/1', delta: 0, isDefault: true, deliveryDays: 2 },
              { id: 'v-lino', name: 'Lino', desc: '', delta: 12000, isDefault: false, deliveryDays: 4 },
              { id: 'v-fb', name: 'No aplica', fallback: true, delta: 0 },
            ],
          }],
        }],
      },
    },
  },
];

// ── Shell simulado (escritorio) ──────────────────────────────────────────────
const store = new Map(); // items de NUESTRA instancia
let agentReg = null;
const shell = {
  app: { appId: 'totem-productos', instanceId: 'inst-1', teamId: 'team-1' },
  assetUrl: (p) => 'http://kimos.local/api/apps/totem-productos/asset/' + p,
  notify: (m) => calls.push(['notify', m.level, m.text]),
  window: { setTitle: () => {} },
  items: {
    list: async () => Array.from(store.values()),
    create: async (item) => { store.set(item.id, item); return item; },
    update: async (id, item) => { store.set(id, { ...store.get(id), ...item }); return store.get(id); },
    remove: async (id) => { store.delete(id); },
  },
  authFetch: async () => ({ ok: true, json: async () => ({}) }),  // presencia = modo escritorio
  agent: { register: (reg) => { agentReg = reg; return () => { agentReg = null; }; } },
  data: {
    listInstances: async (tpl) => {
      if (tpl === 'products') return [{ id: 'p-inst', name: 'Productos' }];
      if (tpl === 'productlab') return [{ id: 'pl-raw', name: 'ProductLab Muebles' }, { id: 'pl-pub', name: 'ProductLab Camisas' }];
      return [];
    },
    listItems: async (iid) => {
      if (iid === 'p-inst') return productsItems;
      if (iid === 'pl-raw') return plRawItems;
      if (iid === 'pl-pub') return plPubItems;
      return [];
    },
  },
  config: { get: async () => ({ modo: 'auto', segundosInactividad: 90 }), onChange: () => () => {} },
};

const mod = await import('../dist/index.js');
const app1 = mod.default(shell);
await espera(80);

// ── Carga y normalización ──
let snap = agentReg.getSnapshot();
assert(snap.version === '1.0.0', 'snapshot declara la versión');
const nombres = snap.productos.map((p) => p.nombre).sort();
assert(snap.productos.length === 4, '4 productos visibles (dedupe del enlazado): ' + nombres.join(', '));
assert(nombres.indexOf('Mesa Roble (tienda)') === -1, 'el producto de products enlazado a ProductLab se deduplica');

const mesa = snap.productos.find((p) => p.nombre === 'Mesa Roble');
assert(mesa && mesa.personalizable, 'Mesa Roble (PL crudo) es personalizable');
assert(mesa.pasos.length === 1 && mesa.pasos[0].paso === 'Madera', 'paso baseStep oculto; queda solo "Madera"');
assert(mesa.pasos[0].valores.join(',') === 'Roble,Nogal', 'valores agotados y fallback no se ofrecen');

const camisa = snap.productos.find((p) => p.nombre === 'Camisa Clásica');
assert(camisa && camisa.personalizable && camisa.pasos[0].valores.indexOf('No aplica') === -1, 'JSON público v2: fallback filtrado');

const polera = snap.productos.find((p) => p.nombre === 'Polera Estampada');
assert(polera && polera.personalizable && polera.pasos.length === 2, 'opciones/variantes de products → 2 pasos');

// ── Agente: acciones que mueven la pantalla ──
let r = await agentReg.dispatchAction({ type: 'MOSTRAR_PRODUCTO', payload: { producto: 'mesa roble' } });
assert(r.success, 'MOSTRAR_PRODUCTO abre la ficha: ' + r.message);
snap = agentReg.getSnapshot();
assert(snap.pantalla.productoAbierto === 'Mesa Roble', 'la ficha abierta se refleja en el snapshot');

r = await agentReg.dispatchAction({ type: 'ABRIR_PERSONALIZACION', payload: { producto: 'Mesa Roble' } });
assert(r.success, 'ABRIR_PERSONALIZACION: ' + r.message);

r = await agentReg.dispatchAction({ type: 'ELEGIR_OPCION', payload: { paso: 'Madera', valor: 'Nogal' } });
assert(r.success && r.message.indexOf('64.900') !== -1, 'delta del motor de precios (50.000 + 14.900): ' + r.message);

r = await agentReg.dispatchAction({ type: 'ELEGIR_OPCION', payload: { paso: 'Madera', valor: 'Titanio' } });
assert(!r.success && r.error.indexOf('Roble') !== -1, 'valor desconocido → error accionable con las opciones válidas');

r = await agentReg.dispatchAction({ type: 'VER_RESUMEN', payload: {} });
assert(r.success, 'VER_RESUMEN');
snap = agentReg.getSnapshot();
assert(snap.pantalla.personalizacionEnCurso && snap.pantalla.personalizacionEnCurso.seleccion[0].valor === 'Nogal', 'la selección viva viaja en el snapshot');

r = await agentReg.dispatchAction({ type: 'APLICAR_PRESET', payload: { producto: 'Camisa Clásica', preset: 'Verano' } });
assert(r.success && r.message.indexOf('169.100') !== -1, 'preset por nombres del JSON público (157.100 + 12.000): ' + r.message);

r = await agentReg.dispatchAction({ type: 'ELEGIR_OPCION', payload: { producto: 'Polera Estampada', paso: 'Color', valor: 'Azul' } });
assert(r.success && r.message.indexOf('1.200') !== -1, 'delta desde variantes de products: ' + r.message);

r = await agentReg.dispatchAction({ type: 'VOLVER_AL_INICIO', payload: {} });
assert(r.success, 'VOLVER_AL_INICIO');

r = await agentReg.dispatchAction({ type: 'FILTRAR_CATEGORIA', payload: { categoria: 'Sillas' } });
assert(!r.success, 'categoría inexistente → error accionable');

// ── Publicación ──
r = await agentReg.dispatchAction({ type: 'PUBLICAR_VITRINA', payload: {} });
assert(r.success, 'PUBLICAR_VITRINA: ' + r.message);
const def = store.get('definition');
assert(def && def.public && def.public.enabled === true, 'definition.public.enabled queda en true');
assert(def.public.data && def.public.data.productos.length === 4, 'el snapshot publicado trae los 4 productos');
assert(def.public.data.style && typeof def.public.data.style.radius === 'number', 'el snapshot incluye los estilos');

app1.unmount();
assert(agentReg === null, 'unmount desregistra el agente');

// ── Modo vitrina pública (sin authFetch, fetch del gateway público) ──────────
globalThis.window.location.search = '?vitrina=tok123&catalogo=inst-1';
globalThis.fetch = async (url) => {
  if (url.indexOf('/api/public/app/inst-1/definition/version') !== -1) return { ok: true, json: async () => ({ v: def.public.data.updatedAt }) };
  if (url.indexOf('/api/public/app/inst-1/definition') !== -1) return { ok: true, json: async () => ({ instanceId: 'inst-1', data: def.public.data }) };
  return { ok: false, status: 404, json: async () => ({}) };
};
let agentPub = null;
const shellPub = {
  app: { appId: 'totem-productos' },   // sin instanceId ni authFetch: host público
  assetUrl: (p) => 'http://kimos.local/api/apps/totem-productos/asset/' + p,
  notify: () => {},
  window: { setTitle: () => {} },
  items: { list: async () => [], create: async (i) => i, update: async (id, i) => i, remove: async () => {} },
  agent: { register: (reg) => { agentPub = reg; return () => { agentPub = null; }; } },
  data: { listInstances: async () => [], listItems: async () => [] },
};
const app2 = mod.default(shellPub);
await espera(80);
let snapPub = agentPub.getSnapshot();
assert(snapPub.modo === 'vitrina-publica', 'modo vitrina pública detectado (sin authFetch)');
assert(snapPub.productos.length === 4, 'la vitrina pública carga el snapshot publicado');
assert(localStore.get('kimos.totem-productos.catalogo') === 'inst-1', 'el instanceId queda recordado en localStorage');
r = await agentPub.dispatchAction({ type: 'MOSTRAR_PRODUCTO', payload: { producto: 'Camisa Clásica' } });
assert(r.success, 'el agente también opera en la vitrina pública: ' + r.message);
r = await agentPub.dispatchAction({ type: 'IR_A_PESTANA', payload: { pestana: 'estilos' } });
assert(!r.success, 'las pestañas de gestión no existen en la vitrina pública');
app2.unmount();

// ── Render smoke: el árbol de cada vista se construye sin lanzar ─────────────
// (React simulado: useState devuelve el valor inicial, useEffect no corre.)
function renderProfundo(nodo, depth) {
  if (nodo == null || depth > 40) return;
  if (Array.isArray(nodo)) { nodo.forEach((x) => renderProfundo(x, depth + 1)); return; }
  if (typeof nodo !== 'object') return;
  if (typeof nodo.t === 'function') { renderProfundo(nodo.t({ ...(nodo.p || {}), children: nodo.c }), depth + 1); return; }
  renderProfundo(nodo.c, depth + 1);
}
const app3 = mod.default(shell);
await espera(80);
const reg3 = agentReg;
for (const tab of ['vitrina', 'catalogo', 'estilos', 'publicacion']) {
  await reg3.dispatchAction({ type: 'IR_A_PESTANA', payload: { pestana: tab } });
  try { renderProfundo(app3.Component(), 0); assert(true, 'render de la pestaña "' + tab + '"'); }
  catch (e) { assert(false, 'render de la pestaña "' + tab + '": ' + e.message); }
}
await reg3.dispatchAction({ type: 'IR_A_PESTANA', payload: { pestana: 'vitrina' } });
await reg3.dispatchAction({ type: 'MOSTRAR_PRODUCTO', payload: { producto: 'Mesa Roble' } });
try { renderProfundo(app3.Component(), 0); assert(true, 'render de la ficha de producto'); }
catch (e) { assert(false, 'render de la ficha de producto: ' + e.message); }
await reg3.dispatchAction({ type: 'ABRIR_PERSONALIZACION', payload: { producto: 'Mesa Roble' } });
await reg3.dispatchAction({ type: 'VER_RESUMEN', payload: {} });
try { renderProfundo(app3.Component(), 0); assert(true, 'render del configurador con resumen'); }
catch (e) { assert(false, 'render del configurador con resumen: ' + e.message); }
app3.unmount();

console.log(process.exitCode ? '\n✖ Hay fallos.' : '\n✔ Smoke test OK.');
