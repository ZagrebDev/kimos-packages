// Smoke test v2.1: monta la app con shell/React simulados y ejercita el motor
// de precios (base del margen, valores genéricos con alternativas, stock,
// migración v2.0) a través de las tools del agente y los endpoints simulados
// de la instancia de la app products.
const calls = [];
globalThis.React = {
  createElement: (t, p, ...c) => ({ t, p, c }),
  Fragment: 'fragment',
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
};
globalThis.window = { location: { origin: 'http://kimos.local', href: 'http://kimos.local/' }, confirm: () => true, prompt: () => null };

const store = new Map();        // items de NUESTRA instancia
const productsStore = new Map(); // items de la instancia de la app products
productsStore.set('prod-1', {
  id: 'prod-1', name: 'Camisa Clásica', sku: 'CAM-001', price: 111,
  imageUrl: 'https://cdn/x.png',
  sourceLinks: [{ integration: 'jumpseller', sourceId: '424242' }],
  images: ['https://cdn/x.png', 'https://cdn/g2.png'], // galería completa (pull v2)
  description: 'Camisa de algodón peinado, costura reforzada.', // texto de la tienda
  // Estado previo en la tienda: ids que deben PRESERVARSE al regenerar
  options: [{ name: 'Tela', optionType: 'option', sourceOptionId: '900',
    values: [{ name: 'Algodón', sourceValueId: '901' }] }],
  variants: [],
});
// Catálogo de la app de computadores (esquema legacy: kind 'equipo',
// productRef, rules con ivaPct/usdRate/assemblyDays y roundMode 'end990').
const uploads = new Map();   // URL pública → contenido (export/import)
const legacyStore = new Map();
legacyStore.set('definition', {
  id: 'definition', kind: 'definition',
  types: [{ id: 'cpu', label: 'Procesador' }, { id: 'ram', label: 'Memoria RAM' }],
  rules: { ivaPct: 19, usdRate: 950, marginBasis: 'cost', marginDefaultPct: 25, marginBasePct: 25,
    marginByType: { cpu: 20 }, roundMode: 'end990', deltaRoundTo: 100, assemblyDays: 3, staleDays: 30 },
  storeBaseUrl: 'https://hubpro.cl',
});
legacyStore.set('cmp-r5', { id: 'cmp-r5', kind: 'component', name: 'Ryzen 5 8500G', type: 'cpu',
  cost: 110000, currency: 'CLP', specs: '6 núcleos', supplierName: 'PC Factory', supplierUrl: 'https://p/1',
  deliveryDays: 2, stock: 4, tags: ['socket:am5'], active: true, verifiedAt: '2026-07-01T10:00:00.000Z' });
legacyStore.set('cmp-ram', { id: 'cmp-ram', kind: 'component', name: 'RAM Kingston 16GB', type: 'ram',
  cost: 45000, currency: 'CLP', requires: ['ddr5'], deliveryDays: 3, stock: null, active: true });
legacyStore.set('eq-pc', { id: 'eq-pc', kind: 'equipo', name: 'PC Gamer N1', sku: 'PPRO-N1', status: 'active',
  baseComponentIds: ['cmp-r5'], extraCosts: [{ id: 'ec1', label: 'Armado', cost: 80000, currency: 'CLP' }],
  groups: [{ id: 'g-ram', typeId: 'ram', label: 'Memoria', defaultValueId: 'v-16',
    values: [{ id: 'v-16', label: '16GB DDR5', componentIds: ['cmp-ram'] }] }],
  productRef: { instanceId: 'p-inst', itemId: 'prod-1', sourceId: '424242', sku: 'PPRO-N1', name: 'PC Gamer N1' },
  storefront: { specs: [{ id: 'sp1', group: '', label: 'Gabinete', value: 'ATX' }], photosNote: 'Fotos referenciales' },
  deliveryMode: 'max', price: 345990,
});

let agentReg = null;
const shell = {
  app: { appId: 'productlab', instanceId: 'inst-1', teamId: 'team-1' },
  assetUrl: (p) => 'http://kimos.local/api/apps/productlab/asset/' + p,
  notify: (m) => calls.push(['notify', m.level, m.text]),
  items: {
    list: async () => Array.from(store.values()),
    create: async (item) => { store.set(item.id, item); return item; },
    update: async (id, item) => { store.set(id, { ...store.get(id), ...item }); return store.get(id); },
    remove: async (id) => { store.delete(id); },
  },
  authFetch: async (url, opts) => {
    const method = (opts && opts.method) || 'GET';
    const body = opts && typeof opts.body === 'string' ? JSON.parse(opts.body) : null; // FormData pasa de largo
    const putMatch = url.match(/\/api\/app-instances\/(p-inst)\/items\/([^/]+)$/);
    if (method === 'PUT' && putMatch) {
      const it = productsStore.get(putMatch[2]);
      if (!it) return { ok: false, status: 404, json: async () => ({ detail: 'Item no encontrado' }) };
      productsStore.set(putMatch[2], { ...it, ...body });
      return { ok: true, json: async () => productsStore.get(putMatch[2]) };
    }
    if (method === 'POST' && url.includes('/api/app-instances/p-inst/items/sync-push')) {
      const iid = body.itemIds[0];
      const it = productsStore.get(iid);
      const patched = {
        options: (it.options || []).map((o, oi) => ({ ...o, sourceOptionId: o.sourceOptionId || 'o' + oi,
          values: (o.values || []).map((v, vi) => ({ ...v, sourceValueId: v.sourceValueId || 'v' + oi + vi })) })),
        variants: (it.variants || []).map((v, vi) => ({ ...v, sourceVariantId: v.sourceVariantId || 'var' + vi })),
      };
      productsStore.set(iid, { ...it, ...patched, syncStatus: 'synced' });
      return { ok: true, json: async () => ({ ok: true, processed: 1,
        results: { [iid]: { ok: true, results: { jumpseller: { ok: true } }, itemPatch: patched } },
        syncStatusByItem: { [iid]: 'synced' } }) };
    }
    // Instancia AJENA (app de computadores) para probar la migración: se lee
    // con authFetch y el RBAC del usuario, igual que en producción.
    if (method === 'GET' && url.endsWith('/api/app-instances')) {
      return { ok: true, json: async () => ({ instances: [
        { id: 'inst-1', name: 'ProductLab', templateId: 'productlab' },
        { id: 'old-pc', name: 'Computadores HubPro', templateId: 'hubpro.computadores' },
      ] }) };
    }
    if (method === 'GET' && url.includes('/api/app-instances/old-pc/items')) {
      return { ok: true, json: async () => ({ items: Array.from(legacyStore.values()) }) };
    }
    if (method === 'GET' && url.includes('/api/app-instances/sin-acceso/items')) {
      return { ok: false, status: 403, json: async () => ({ detail: 'Sin acceso a la instancia.' }) };
    }
    if (method === 'GET' && url.includes('/api/storage/teams/team-1/files/download')) {
      return { ok: true, blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) };
    }
    if (method === 'POST' && url.includes('/api/v2/files')) {
      // Guarda el contenido subido para poder releerlo por su URL pública
      // (export → import de ida y vuelta).
      try {
        const path = opts.body.get('path');
        const file = opts.body.get('file');
        uploads.set('http://kimos.local/api/public/files/' + path, await file.text());
      } catch (e) { /* FormData simulado */ }
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (method === 'GET' && uploads.has(url)) {
      return { ok: true, text: async () => uploads.get(url), json: async () => JSON.parse(uploads.get(url)) };
    }
    return { ok: true, json: async () => ({}) };
  },
  agent: { register: (reg) => { agentReg = reg; return () => { agentReg = null; }; } },
  data: {
    listInstances: async (tpl) => (tpl === 'products' ? [{ id: 'p-inst', name: 'Productos' }] : []),
    listItems: async (iid) => (iid === 'p-inst' ? Array.from(productsStore.values()) : []),
  },
};

// La app es GENÉRICA: no cablea rubro, moneda, impuesto ni redondeo. El test
// siembra la definición como lo haría una fábrica de ropa (tipos propios) y
// fija reglas explícitas — de paso valida la parametrización.
store.set('definition', {
  id: 'definition', kind: 'definition',
  types: [
    { id: 'tela', label: 'Tela' },
    { id: 'avios', label: 'Avíos' },
    { id: 'acabado', label: 'Acabado' },
    { id: 'other', label: 'Otro' },
  ],
  rules: {
    currency: 'CLP', currencySymbol: '$', currencyDecimals: 0, locale: 'es-CL',
    fx: { USD: 950 },
    salesTaxLabel: 'IVA', salesTaxPct: 19,
    marginBasis: 'cost', marginDefaultPct: 25, marginBasePct: 25, marginByType: {},
    roundMode: 'ending', roundTo: 1000, roundEnding: 990,
    deltaRoundTo: 100, leadTimeDays: 3, staleDays: 30,
  },
  public: { enabled: false, channels: [], data: null },
});

const { default: mount } = await import(new URL('../dist/index.js', import.meta.url).href);
const cleanups = [];
globalThis.React.useEffect = (fn) => { const c = fn(); if (typeof c === 'function') cleanups.push(c); };
let app = mount(shell);
if (typeof app.unmount !== 'function' || !app.Component) throw new Error('contrato mount() incompleto');
if (!agentReg) throw new Error('el agente no se registró');
app.Component({});
await new Promise((res) => setTimeout(res, 50)); // que load() traiga la definición sembrada

const act = async (type, payload) => {
  const r = await agentReg.dispatchAction({ type, payload });
  console.log(type, '→', JSON.stringify(r));
  if (!r.success) throw new Error('acción falló: ' + type + ': ' + r.error);
  return r;
};
const expectEq = (label, got, want) => {
  console.log(label + ':', got, '(esperado ' + want + ')');
  if (got !== want) throw new Error(label + ' incorrecto: ' + got + ' ≠ ' + want);
};

// ── 1. Componentes (2 telas; 2 botones ALTERNATIVOS del mismo valor genérico) ──
await act('UPSERT_COMPONENT', { name: 'Algodón 20/1 (Prov. Sur)', type: 'tela', cost: 120000, currency: 'CLP', tags: 'tela:algodon', supplierUrl: 'https://prov.cl/r5' });
await act('UPSERT_COMPONENT', { name: 'Lino europeo (Prov. UE)', type: 'tela', cost: 300, currency: 'USD', tags: 'tela:algodon', supplierUrl: 'https://prov.cl/r7' });
await act('UPSERT_COMPONENT', { name: 'Botón nácar (Prov. A)', type: 'avios', cost: 45000, specs: 'Nácar 18L, 4 agujeros', requires: 'ojal:reforzado', stock: 5 });
await act('UPSERT_COMPONENT', { name: 'Botón nácar (Prov. B)', type: 'avios', cost: 47000, specs: 'Nácar 18L, alterno', requires: 'ojal:reforzado' });
await act('UPSERT_COMPONENT', { name: 'Acabado agotado', type: 'acabado', cost: 5000, stock: 0 });
await act('SET_MARGIN', { type: 'tela', marginPct: 20 });
await act('SET_MARGIN', { type: 'default', marginPct: 30 });
await act('SET_COMPONENT_COST', { component: 'Algodón 20/1 (Prov. Sur)', cost: 110000 });

const snap = agentReg.getSnapshot();
const byName = (n) => snap.components.find((c) => c.name === n);
const r5 = byName('Algodón 20/1 (Prov. Sur)'), r7 = byName('Lino europeo (Prov. UE)');
const ramA = byName('Botón nácar (Prov. A)'), ramB = byName('Botón nácar (Prov. B)');
const agotado = byName('Acabado agotado');
// base 'cost': 110000×1.20×1.19=157080→157100 · 285000×1.20×1.19→407000 · 45000×1.30×1.19=69615→69600
expectEq('salePrice tela algodón', r5.salePrice, 157100);
expectEq('salePrice tela lino (USD)', r7.salePrice, 407000);
expectEq('salePrice botón A', ramA.salePrice, 69600);
if (ramA.stock !== 5 || ramB.stock !== null) throw new Error('stock mal registrado');
if (!r5.verifiedAt) throw new Error('verifiedAt no quedó marcado');

// ── 2. Productos: uno v2.1 (valores con alternativas) y uno v2.0 (migración) ──
store.set('eq-test', {
  id: 'eq-test', kind: 'producto', name: 'Camisa Clásica', sku: 'CAM-001', status: 'active',
  extraCosts: [{ id: 'ec1', label: 'Confección', cost: 80000, currency: 'CLP' }],
  baseComponentIds: [],
  groups: [
    { id: 'g1', typeId: 'tela', label: 'Tela', defaultValueId: 'v-r5', values: [
      { id: 'v-r5', label: 'Algodón', componentIds: [r5.id] },
      { id: 'v-r7', label: 'Lino', componentIds: [r7.id] },
    ] },
    { id: 'g2', typeId: 'avios', label: 'Botones', defaultValueId: 'v-16', values: [
      { id: 'v-16', label: 'Nácar', componentIds: [ramA.id, ramB.id] },
    ] },
    // Paso cuyas alternativas existen pero están agotadas: debe EXCLUIRSE de
    // opciones, variantes y JSON público (no puede llegar a Jumpseller una
    // opción sin valores). Ojo: un valor SIN componentes es otra cosa —una
    // opción que no agrega costo— y sí se publica (se cubre más abajo).
    { id: 'g3', typeId: 'acabado', label: 'Acabado', defaultValueId: 'v-ssd', values: [
      { id: 'v-ssd', label: 'Premium', componentIds: [agotado.id] },
    ] },
  ],
  deliveryExtraDays: null, // vacío en el formulario → debe usar la regla global (3)
  storeRef: { instanceId: 'p-inst', itemId: 'prod-1', sourceId: '424242', sku: 'CAM-001', name: 'Camisa Clásica' },
  imageUrl: 'https://old/rota.png', // copia local obsoleta: debe refrescarse al aplicar
  storefront: { hero: { bgImageUrl: 'https://cdn/fondo.jpg', photoPos: 'right', photoVAlign: 'bottom', photoSize: 'l', float: true,
    items: [{ id: 'hi1', title: 'Costura reforzada', text: 'Doble pespunte', side: 'left' }] },
    specs: [{ id: 'sp1', group: 'Base', label: 'Cuello', value: 'Italiano' }] },
  price: 0,
});
store.set('eq-old', { // forma v2.0: componentIds directos + base{cost}
  id: 'eq-old', kind: 'producto', name: 'Camisa Legacy', status: 'active', price: 0,
  base: { cost: 50000, currency: 'CLP' },
  groups: [{ id: 'og1', typeId: 'tela', label: 'Tela', componentIds: [r5.id], defaultId: r5.id }],
  // Builder con datos sucios: al guardar (recalc de producto NO enlazado pasa
  // por saveProducto) debe normalizarse — patrón inválido → clasico, bloque
  // desconocido filtrado, CTA con label por defecto, tamaño inválido → l.
  storefront: { heroes: [
    { pattern: 'nope', slots: {
      top: [{ type: 'cta' }, { type: 'bogus' }],
      center: [{ type: 'text', text: 'Texto central', size: 'zz' }],
      middle: [{ type: 'photo' }], // 'middle' no existe en clasico: se descarta
    } },
  ] },
});

// Publicación activa: el recálculo aplicado debe republicar el JSON solo.
const defPub = store.get('definition');
defPub.public = { enabled: true, channels: [], data: null };
store.set('definition', defPub);

// Remontar para que load() recoja los productos escritos directo al store
app.unmount();
app = mount(shell);
app.Component({});
await new Promise((res) => setTimeout(res, 100));

const snap2 = agentReg.getSnapshot();
const eqSnap = snap2.productos.find((e) => e.id === 'eq-test');
// armado 80000×1.25×1.19=119000 · R5 157080 · RAM-A (más barata disp.) 69615 → 345695 → 345990
expectEq('producto computedPrice', eqSnap.computedPrice, 345990);
if (!eqSnap.linked) throw new Error('producto debería estar enlazado');
if (!eqSnap.warnings.some((w) => w.indexOf('ojal:reforzado') !== -1)) throw new Error('falta warning de compatibilidad ojal:reforzado');
// migración v2.0: 50000×1.25×1.19=74375 + 157080 = 231455 → 231990
const eqOld = snap2.productos.find((e) => e.id === 'eq-old');
expectEq('producto migrado computedPrice', eqOld.computedPrice, 231990);

// ── 3. Aplicar a la tienda: variantes con precio por combinación ──
await act('RECALC_PRICES', { apply: true });
const saved = store.get('eq-test');
expectEq('price persistido', saved.price, 345990);
if (!saved.lastPush || saved.lastPush.status !== 'synced') throw new Error('lastPush no quedó synced');
expectEq('imageUrl refrescada desde la tienda', saved.imageUrl, 'https://cdn/x.png');
if (!saved.storefront || saved.storefront.hero.photoPos !== 'right' || saved.storefront.specs.length !== 1) throw new Error('la ficha de tienda (hero/specs) no se preservó al aplicar');
const prod = productsStore.get('prod-1');
expectEq('producto price', prod.price, 345990);
const optCpu = prod.options.find((o) => o.name === 'Tela');
if (optCpu.sourceOptionId !== '900') throw new Error('no se preservó sourceOptionId');
if (optCpu.values.find((v) => v.name === 'Algodón').sourceValueId !== '901') throw new Error('no se preservó sourceValueId');
if (optCpu.values.some((v) => v.name.indexOf('Kingston') !== -1 || v.name.indexOf('8500G') !== -1)) throw new Error('los valores deben ser etiquetas genéricas sin marca');
const vR5 = prod.variants.find((v) => v.options['Tela'] === 'Algodón');
const vR7 = prod.variants.find((v) => v.options['Tela'] === 'Lino');
expectEq('variante R5', vR5.price, 345990);
expectEq('variante R7', vR7.price, 595990); // 119000+406980+69615=595595→595990
if (vR5.options['Botones'] !== 'Nácar') throw new Error('variante sin la opción Memoria genérica');
expectEq('opciones aplicadas (paso sin valores disponibles excluido)', prod.options.length, 2);
if (prod.variants.some((v) => v.options['Acabado'] != null)) throw new Error('las variantes no deben incluir el paso vacío');

// ── 3b. JSON público republicado: paso vacío fuera y días de armado por regla ──
const pubData = store.get('definition').public.data;
if (!pubData) throw new Error('el recálculo aplicado no republicó el JSON público');
const pubEq = pubData.productos.find((e) => e.sku === 'CAM-001');
expectEq('grupos publicados (paso vacío excluido)', pubEq.groups.length, 2);
expectEq('assemblyDays publicado (campo vacío → regla global)', pubEq.assemblyDays, 3);
expectEq('deliveryDays publicado (max entrega 0 + armado 3)', pubEq.deliveryDays, 3);
// La ficha de la tienda necesita TODAS las fotos y el texto del producto: con
// solo imageUrl el theme no puede pintar galería ni descripción.
expectEq('galería completa publicada', (pubEq.images || []).join(','), 'https://cdn/x.png,https://cdn/g2.png');
expectEq('descripción de la tienda publicada', pubEq.description, 'Camisa de algodón peinado, costura reforzada.');

// ── 3c. Builder v3 (pageSections): migración heroes→secciones + normalización ──
const pageSecs = store.get('eq-old').storefront.pageSections;
const hb = pageSecs.find((x) => x.kind === 'hero');
expectEq('builder: patrón inválido → clasico', hb.pattern, 'clasico');
expectEq('builder: bloque desconocido filtrado', hb.slots.top.length, 1);
expectEq('builder: CTA con label por defecto', hb.slots.top[0].label, 'Configurar');
expectEq('builder: alineación por defecto center', hb.slots.top[0].align, 'center');
expectEq('builder: tamaño de texto inválido → l', hb.slots.center[0].size, 'l');
if (hb.slots.middle != null) throw new Error('el contenedor "middle" no existe en el patrón clasico: debía descartarse');
expectEq('builder: secciones specs+fotos+nota garantizadas', pageSecs.filter((x) => x.kind !== 'hero').length, 3);
const pubLegacy = pubData.productos.find((e) => e.name === 'Camisa Legacy');
expectEq('builder publicado en el JSON (sección hero)', (pubLegacy.storefront.pageSections || []).filter((x) => x.kind === 'hero').length, 1);
const pubTabs = pubLegacy.storefront.tabs;
expectEq('tabs: orden por defecto publicado', (pubTabs.order || []).join(','), 'explorar,specs,fotos');
if (pubTabs.showSpecs !== true || pubTabs.showFotos !== true) throw new Error('tabs.showSpecs/showFotos deben ser true por defecto');

// ── 4. Alternativas: se agota la más barata → toma la siguiente disponible ──
await act('UPSERT_COMPONENT', { name: 'Botón nácar (Prov. A)', stock: 0 });
await act('RECALC_PRICES', { apply: true });
// RAM-B 47000×1.30×1.19=72709 → 119000+157080+72709=348789 → 348990
expectEq('price tras agotarse RAM-A', store.get('eq-test').price, 348990);
expectEq('variante R5 actualizada', productsStore.get('prod-1').variants.find((v) => v.options['Tela'] === 'Algodón').price, 348990);

// ── 5. Re-aplicar preserva sourceVariantId ──
const ids1 = productsStore.get('prod-1').variants.map((v) => v.sourceVariantId).sort();
await act('APPLY_PRODUCTO', { producto: 'Camisa Clásica' });
const ids2 = productsStore.get('prod-1').variants.map((v) => v.sourceVariantId).sort();
if (JSON.stringify(ids1) !== JSON.stringify(ids2)) throw new Error('re-aplicar regeneró variantes');
console.log('re-aplicación preserva sourceVariantId ✔ (' + ids2.join(', ') + ')');

// ── 6. Base del margen 'sale': venta = costo ÷ (1 − m) ──
const def = store.get('definition');
def.rules.marginBasis = 'sale';
store.set('definition', def);
app.unmount();
app = mount(shell);
app.Component({});
await new Promise((res) => setTimeout(res, 100));
// R5: 110000 ÷ (1−0.20) = 137500 × 1.19 = 163625 → 163600
expectEq('salePrice tela algodón (margen sobre venta)', agentReg.getSnapshot().components.find((c) => c.name === 'Algodón 20/1 (Prov. Sur)').salePrice, 163600);

// ── 7. Render profundo (componentes de función invocados) ──
globalThis.React.createElement = (t, p, ...c) => {
  if (typeof t === 'function') return t(Object.assign({}, p || {}, { children: c }));
  return { t, p, c };
};
const tree = app.Component({});
if (!tree || tree.p.className !== 'kimos-productlab') throw new Error('render raíz inesperado');
console.log('render profundo OK (' + store.size + ' items en el modelo)');

// ── 8. Tools nuevas del agente (v3.1): productos, pasos, ficha, enlace, stock, publicación ──
await new Promise((res) => setTimeout(res, 50)); // drenar el load() pendiente del render de la sección 7
await act('UPSERT_PRODUCTO', { name: 'Chaqueta Agente', sku: 'CHA-AG' });
// Hero de arranque: un producto recién creado tiene que llegar con una sección
// hero usable; sin ella la pestaña Explorar de la tienda sale vacía.
const eqNuevo = Array.from(store.values()).find((x) => x.kind === 'producto' && x.name === 'Chaqueta Agente');
const heroIni = (eqNuevo.storefront.pageSections || []).filter((x) => x.kind === 'hero');
expectEq('producto nuevo: hero de arranque sembrado', heroIni.length, 1);
expectEq('hero de arranque: nombre + descripción + botón', (heroIni[0].slots.left || []).map((b) => b.type).join(','), 'title,description,cta');
expectEq('hero de arranque: foto del producto', (heroIni[0].slots.right || []).map((b) => b.type).join(','), 'photo');
if (eqNuevo.storefront.heroSeeded !== true) throw new Error('el hero de arranque debe marcarse como sembrado');
await act('SET_PRODUCTO_STEPS', { producto: 'Chaqueta Agente', steps: [
  { label: 'Tela', type: 'tela', default: 'Lino', values: [
    { label: 'Algodón', components: ['Algodón 20/1 (Prov. Sur)'] },
    { label: 'Lino', components: ['Lino europeo (Prov. UE)', 'NoExiste XYZ'] }, // inexistente → aviso, no error
  ] },
] });
const eqAg = Array.from(store.values()).find((x) => x.kind === 'producto' && x.name === 'Chaqueta Agente');
expectEq('agente: pasos creados', eqAg.groups.length, 1);
expectEq('agente: default por label', eqAg.groups[0].defaultValueId, eqAg.groups[0].values[1].id);
if (eqAg.groups[0].values[1].componentIds.length !== 1) throw new Error('el componente inexistente debía filtrarse');

await act('SET_STOREFRONT', { producto: 'Chaqueta Agente',
  pageSections: [{ kind: 'hero', pattern: 'apilado', bgImageUrl: 'https://cdn/fondo-agente.jpg', slots: { middle: [{ type: 'text', text: 'Hola', size: 'zz' }] } }],
  specs: [{ label: 'Tela', value: 'Algodón' }], photosNote: 'Nota agente' });
const sfAg = store.get(eqAg.id).storefront;
expectEq('agente: ficha normalizada (hero + specs/fotos/nota fijas)', sfAg.pageSections.length, 4);
expectEq('agente: tamaño de texto inválido normalizado a l', sfAg.pageSections[0].slots.middle[0].size, 'l');
expectEq('agente: nota guardada', sfAg.photosNote, 'Nota agente');
if ((store.get(eqAg.id).galleryImages || []).indexOf('https://cdn/fondo-agente.jpg') === -1) throw new Error('el fondo usado no se cosechó en la galería del producto');

await act('LINK_PRODUCT', { producto: 'Chaqueta Agente', product: '424242' });
if (!store.get(eqAg.id).storeRef || store.get(eqAg.id).storeRef.itemId !== 'prod-1') throw new Error('LINK_PRODUCT no enlazó por id Jumpseller');

await act('SET_STOCK', { items: [{ component: 'Botón nácar (Prov. B)', stock: 3 }, { component: 'Algodón 20/1 (Prov. Sur)', stock: null }] });
expectEq('agente: stock masivo aplicado', agentReg.getSnapshot().components.find((c) => c.name === 'Botón nácar (Prov. B)').stock, 3);

await act('PUBLISH_CONFIG', { enabled: true });
if (store.get('definition').public.enabled !== true) throw new Error('PUBLISH_CONFIG no publicó');

const snapAg = agentReg.getSnapshot();
const seAg = snapAg.productos.find((e) => e.name === 'Chaqueta Agente');
if (!seAg.steps || seAg.steps[0].values[1].alternatives[0] !== 'Lino europeo (Prov. UE)') throw new Error('snapshot sin pasos/alternativas');
if (!seAg.storefront || seAg.storefront.pageSections.length !== 4) throw new Error('snapshot sin storefront');
if (!snapAg.builderRef || snapAg.builderRef.patterns.length !== 12 || snapAg.builderRef.blockTypes.indexOf('html') === -1) throw new Error('builderRef ausente o incompleto');
const seN1 = snapAg.productos.find((e) => e.name === 'Camisa Clásica' && e.linked);
expectEq('agente: galería del producto en snapshot', (seN1.productImages || []).length, 2);

// IMPORT_IMAGE: adjunto del chat (path del storage del producto) → URL pública
// + con {producto} queda también en la galería de ese producto
const imp = await act('IMPORT_IMAGE', { url: 'chat/foto.png', name: 'foto.png', producto: 'Chaqueta Agente' });
if (imp.message.indexOf('/api/public/files/imagenes/productlab/') === -1) throw new Error('IMPORT_IMAGE no devolvió la URL pública');
const impUrl = imp.message.match(/https?:[^ ]+productlab\/[^ ]+/)[0];
if ((store.get(eqAg.id).galleryImages || []).indexOf(impUrl) === -1) throw new Error('IMPORT_IMAGE no dejó la imagen en la galería del producto');
const galSnap = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente');
if ((galSnap.galleryImages || []).indexOf(impUrl) === -1 || galSnap.galleryImages.indexOf('https://cdn/fondo-agente.jpg') === -1) throw new Error('snapshot sin galleryImages del producto');

// ── Robustez de payloads del agente (v3.3.1) ─────────────────────────────
// Los LLM del chat no ven siempre el schema exacto y mandan alias
// (productoId/id/name) o el payload como string JSON. La app debe resolverlos
// igual, y ante una referencia mala devolver un error que liste los productos
// para que el agente se autocorrija.
const alias1 = await act('SET_STOREFRONT', { productoId: 'Chaqueta Agente', photosNote: 'Nota vía alias' });
if (alias1.message.indexOf('Chaqueta Agente') === -1) throw new Error('alias productoId no resolvió el producto');
const alias2 = await act('APPLY_PRODUCTO', { id: 'Chaqueta Agente' });
if (alias2.message.indexOf('aplicado') === -1 && !alias2.success) throw new Error('alias id no resolvió el producto');
const alias3 = await act('SET_STOREFRONT', JSON.stringify({ producto: 'CHA-AG', photosNote: 'Nota vía sku + payload string' }));
if (alias3.message.indexOf('Chaqueta Agente') === -1) throw new Error('payload string / sku no resolvió el producto');
const badRef = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'No Existe 9000', photosNote: 'x' } });
if (badRef.success || badRef.error.indexOf('Productos existentes') === -1 || badRef.error.indexOf('Chaqueta Agente') === -1) {
  throw new Error('el error de producto no encontrado no lista los productos existentes: ' + badRef.error);
}
const noRef = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { photosNote: 'x' } });
if (noRef.success || noRef.error.indexOf('Falta el campo "producto"') === -1) throw new Error('falta de referencia sin error didáctico: ' + noRef.error);
console.log('agente: alias de payload (productoId/id/sku/string) y errores didácticos OK');

// ── Validación estricta del builder vía agente (v3.4.0) ──────────────────
// builderRef debe publicar el contrato completo (sectionShape/blockSchema/example)
const bref = agentReg.getSnapshot().builderRef;
if (!bref.sectionShape || !bref.blockSchema || !bref.blockSchema.items || !bref.example || bref.example.pattern !== 'clasico') {
  throw new Error('builderRef sin contrato completo (sectionShape/blockSchema/example)');
}
// Bloques con type inventado → rechazo con detalle (nada se pierde en silencio)
const badBlocks = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: { top: [{ type: 'feature-list', items: [{ title: 'X' }] }] } },
] } });
if (badBlocks.success || badBlocks.error.indexOf('type inválido "feature-list"') === -1 || badBlocks.error.indexOf('builderRef') === -1) {
  throw new Error('bloque inválido no rechazado con detalle: ' + JSON.stringify(badBlocks));
}
// Contenedor que no existe en el patrón → rechazo con las celdas válidas
const badCell = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: { arriba: [{ type: 'title' }] } },
] } });
if (badCell.success || badCell.error.indexOf('"arriba" no existe') === -1 || badCell.error.indexOf('top') === -1) {
  throw new Error('contenedor inválido no rechazado: ' + JSON.stringify(badCell));
}
// "blocks" en vez de "slots" → rechazo que enseña la clave correcta
const badKey = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', blocks: [{ type: 'title' }] },
] } });
if (badKey.success || badKey.error.indexOf('"slots"') === -1) throw new Error('clave blocks no detectada: ' + JSON.stringify(badKey));
// Payload bien formado (según builderRef.example) → guarda y detalla los bloques
const goodSf = await act('SET_STOREFRONT', { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', height: 'l', bgColor: '#1D1D1B', slots: {
    top: [{ type: 'title' }, { type: 'text', text: 'Hecha a tu medida', size: 'xl' }],
    center: [{ type: 'photo', size: 'l' }],
    right: [{ type: 'cta', label: 'Configurar' }],
  } },
  { kind: 'specs', show: true }, { kind: 'fotos', show: true }, { kind: 'note', show: true },
] });
if (goodSf.message.indexOf('Detalle: hero 1 [clasico]') === -1 || goodSf.message.indexOf('top: title+text') === -1) {
  throw new Error('mensaje sin detalle de bloques: ' + goodSf.message);
}
// Anti-borrado: vaciar una ficha con bloques requiere allowEmpty:true
const wipe = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: {} }, { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] } });
if (wipe.success || wipe.error.indexOf('allowEmpty') === -1) throw new Error('guardia anti-borrado no actuó: ' + JSON.stringify(wipe));
const wipeOk = await act('SET_STOREFRONT', { producto: 'Chaqueta Agente', allowEmpty: true, pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: {} }, { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] });
if (!wipeOk.success) throw new Error('allowEmpty no permitió vaciar: ' + JSON.stringify(wipeOk));
// Vaciar es una decisión del usuario: el hero de arranque NO puede reaparecer.
const trasVaciar = store.get(eqAg.id).storefront.pageSections.filter((x) => x.kind === 'hero');
expectEq('hero de arranque no reaparece tras vaciar', trasVaciar.length, 1);
expectEq('… y sigue siendo el hero vacío que dejó el usuario', Object.keys(trasVaciar[0].slots).filter((c) => trasVaciar[0].slots[c].length).length, 0);
// v3.5.1: bloques bajo una clave equivocada (content) o hero sin ningún bloque
// válido → rechazo con ejemplo inline (antes se guardaba "con éxito" vacío)
const badContent = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', content: [{ type: 'title' }, { type: 'items', items: [{ title: 'X' }] }] },
  { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] } });
if (badContent.success || badContent.error.indexOf('"content" no existe') === -1) throw new Error('clave content no detectada: ' + JSON.stringify(badContent));
const emptyHero = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', bgImageUrl: 'https://cdn/f.jpg' }, { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] } });
if (emptyHero.success || emptyHero.error.indexOf('SIN ningún bloque válido') === -1 || emptyHero.error.indexOf('Ejemplo mínimo') === -1) {
  throw new Error('hero sin bloques no rechazado con ejemplo: ' + JSON.stringify(emptyHero));
}
const badSlotsArr = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Chaqueta Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: ['top', 'left', 'center'] },
] } });
if (badSlotsArr.success || badSlotsArr.error.indexOf('OBJETO') === -1) throw new Error('slots como lista no detectado: ' + JSON.stringify(badSlotsArr));
console.log('agente: validación estricta del builder (rechazos didácticos + anti-borrado + detalle) OK');

// ── COMPOSE_HERO (v3.6.0): campos planos → la app compone la estructura ──
const composed = await act('COMPOSE_HERO', { producto: 'Chaqueta Agente', headline: 'Crea sin límites',
  features: [{ title: 'Corte entallado' }, { title: 'Tallas 36 a 48', text: 'Todo el rango disponible' }],
  ctaLabel: 'Configura el tuyo', bgColor: '#1D1D1B', pattern: 'clasico' });
if (composed.message.indexOf('2 características') === -1 || composed.message.indexOf('[clasico]') === -1) {
  throw new Error('COMPOSE_HERO sin detalle esperado: ' + composed.message);
}
const composedEq = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente');
const composedHero = composedEq.storefront.pageSections.find((x) => x.kind === 'hero');
const nBlocks = Object.keys(composedHero.slots).reduce((a, k) => a + composedHero.slots[k].length, 0);
if (nBlocks < 4) throw new Error('COMPOSE_HERO dejó pocos bloques: ' + nBlocks);
if (!composedHero.slots.center || composedHero.slots.center[0].type !== 'photo') throw new Error('foto no quedó al centro');
if (!composedHero.slots.left || composedHero.slots.left[0].type !== 'items' || composedHero.slots.left[0].items.length !== 2) throw new Error('features no quedaron como items');
if (!composedHero.slots.bottom || composedHero.slots.bottom[0].type !== 'cta') throw new Error('CTA no quedó abajo');
// Reemplazo del mismo hero conservando el fondo cuando no se envía uno nuevo
const composed2 = await act('COMPOSE_HERO', { producto: 'Chaqueta Agente', headline: 'Calce perfecto', features: [{ title: 'Puño doble' }] });
const hero2 = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente').storefront.pageSections.filter((x) => x.kind === 'hero');
if (hero2.length !== 1) throw new Error('COMPOSE_HERO duplicó heros: ' + hero2.length);
if (hero2[0].bgColor !== '#1D1D1B') throw new Error('no conservó el fondo: ' + hero2[0].bgColor);
// v3.6.1: reparto de features entre ambos laterales
const split = await act('COMPOSE_HERO', { producto: 'Chaqueta Agente', headline: 'Reparto', featuresRightCount: 2,
  features: [{ title: 'F1' }, { title: 'F2' }, { title: 'F3' }, { title: 'F4' }, { title: 'F5' }] });
const splitHero = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente').storefront.pageSections.find((x) => x.kind === 'hero');
if (splitHero.slots.left[0].items.length !== 3 || !splitHero.slots.right || splitHero.slots.right[0].items.length !== 2) {
  throw new Error('reparto incorrecto: izq=' + splitHero.slots.left[0].items.length + ' der=' + (splitHero.slots.right && splitHero.slots.right[0] ? splitHero.slots.right[0].items.length : 0));
}
console.log('agente: COMPOSE_HERO (composición plana, reemplazo, fondo conservado y reparto 3/2) OK');

// ── Dropshipping (v3.5.0): impuesto %, entrega en serie, producto sin pasos ──
// Impuesto adicional %: se suma al costo ANTES del margen — misma base, +10%.
await act('UPSERT_COMPONENT', { name: 'Insumo Importado', type: 'other', cost: 100000, currency: 'CLP', deliveryDays: 12 });
await act('UPSERT_COMPONENT', { name: 'Insumo Importado c/Aduana', type: 'other', cost: 100000, currency: 'CLP', taxPct: 10, deliveryDays: 12 });
await act('UPSERT_COMPONENT', { name: 'Courier Local', type: 'other', cost: 8000, currency: 'CLP', deliveryDays: 3 });
const snapTax = agentReg.getSnapshot();
const cBase = snapTax.components.find((c) => c.name === 'Insumo Importado');
const cTax = snapTax.components.find((c) => c.name === 'Insumo Importado c/Aduana');
const ratio = cTax.salePrice / cBase.salePrice;
if (cTax.taxPct !== 10 || ratio < 1.08 || ratio > 1.12) throw new Error('taxPct no afecta el precio (~+10%): ' + cBase.salePrice + ' → ' + cTax.salePrice);

// Entrega en serie: 12 + 3 = 15 (con extra 0) vs 12 en paralelo.
await act('UPSERT_PRODUCTO', { name: 'Drop One', sku: 'DROP-1', deliveryExtraDays: 0, deliveryMode: 'sum' });
await act('SET_PRODUCTO_STEPS', { producto: 'Drop One', steps: [
  { label: 'Producto', values: [{ label: 'Insumo Importado c/Aduana', components: ['Insumo Importado c/Aduana'] }] },
  { label: 'Logística', values: [{ label: 'Courier Local', components: ['Courier Local'] }] },
] });
let seDrop = agentReg.getSnapshot().productos.find((e) => e.name === 'Drop One');
if (seDrop.deliveryMode !== 'sum' || seDrop.deliveryDays !== 15) throw new Error('entrega en serie incorrecta: ' + seDrop.deliveryMode + ' / ' + seDrop.deliveryDays + 'd (esperado sum / 15d)');
await act('UPSERT_PRODUCTO', { name: 'Drop One', deliveryMode: 'max' });
seDrop = agentReg.getSnapshot().productos.find((e) => e.name === 'Drop One');
if (seDrop.deliveryDays !== 12) throw new Error('entrega en paralelo incorrecta: ' + seDrop.deliveryDays + 'd (esperado 12d)');
await act('UPSERT_PRODUCTO', { name: 'Drop One', deliveryMode: 'sum' });

// Producto sin pasos: aplicar a la tienda como producto simple (sin variantes).
await act('SET_PRODUCTO_STEPS', { producto: 'Drop One', steps: [] });
await act('LINK_PRODUCT', { producto: 'Drop One', product: 'Camisa Clásica' });
const applySimple = await act('APPLY_PRODUCTO', { producto: 'Drop One' });
if (applySimple.message.indexOf('producto simple sin variantes') === -1) throw new Error('APPLY sin pasos no aplicó como producto simple: ' + applySimple.message);

// Publicación: deliveryMode y baseDeliveryDays viajan al theme.
await act('PUBLISH_CONFIG', { enabled: true });
const pubDrop = store.get('definition').public.data.productos.find((e) => e.sku === 'DROP-1');
if (!pubDrop || pubDrop.deliveryMode !== 'sum' || typeof pubDrop.baseDeliveryDays !== 'number' || (pubDrop.groups || []).length !== 0) {
  throw new Error('JSON público sin deliveryMode/baseDeliveryDays o con grupos fantasma: ' + JSON.stringify(pubDrop && { m: pubDrop.deliveryMode, b: pubDrop.baseDeliveryDays, g: (pubDrop.groups || []).length }));
}
console.log('dropshipping: impuesto % (+' + Math.round((ratio - 1) * 100) + '%), entrega sum/max (15d/12d), producto sin pasos aplicado y publicado OK');

// ── 9. GENÉRICO: multi-moneda y redondeo parametrizables ─────────────────
// Nada está cableado a Chile: se cambia la moneda de costo, el impuesto y el
// modo de redondeo por configuración y el motor responde.
const reload = async (rulesPatch) => {
  const d = store.get('definition');
  d.rules = Object.assign({}, d.rules, rulesPatch);
  store.set('definition', d);
  app.unmount();
  app = mount(shell);
  app.Component({});
  await new Promise((res) => setTimeout(res, 100));
};

// Sin margen ni impuesto para aislar la conversión de moneda.
await reload({ fx: { USD: 950, EUR: 1100 }, salesTaxLabel: 'VAT', salesTaxPct: 0,
  marginDefaultPct: 0, marginByType: {}, roundMode: 'none', deltaRoundTo: 1 });
await act('UPSERT_COMPONENT', { name: 'Tela EUR', type: 'tela', cost: 10, currency: 'EUR' });
expectEq('moneda de costo EUR convertida a base (10 × 1100)',
  agentReg.getSnapshot().components.find((c) => c.name === 'Tela EUR').salePrice, 11000);
// Una moneda sin tipo de cambio declarado NO se inventa: cae a la base.
await act('UPSERT_COMPONENT', { name: 'Tela GBP', type: 'tela', cost: 10, currency: 'GBP' });
expectEq('moneda desconocida cae a la base (sin inventar cambio)',
  agentReg.getSnapshot().components.find((c) => c.name === 'Tela GBP').salePrice, 10);

await act('UPSERT_PRODUCTO', { name: 'Test Redondeo' });
await act('SET_PRODUCTO_STEPS', { producto: 'Test Redondeo', steps: [
  { label: 'Tela', values: [{ label: 'EUR', components: ['Tela EUR'] }] },
] });
const priceOf = () => agentReg.getSnapshot().productos.find((e) => e.name === 'Test Redondeo').computedPrice;
expectEq('redondeo none', priceOf(), 11000);
await reload({ roundMode: 'nearest', roundTo: 2500 });
expectEq('redondeo nearest (múltiplo 2500)', priceOf(), 10000);
await reload({ roundMode: 'up', roundTo: 2500 });
expectEq('redondeo up (múltiplo 2500)', priceOf(), 12500);
await reload({ roundMode: 'ending', roundTo: 1000, roundEnding: 990 });
expectEq('redondeo ending (terminación 990)', priceOf(), 11990);
// El impuesto de venta es un parámetro, no un 19% fijo.
await reload({ roundMode: 'none', salesTaxPct: 21 });
expectEq('impuesto de venta parametrizable (21%)', priceOf(), Math.round(11000 * 1.21));
console.log('genérico: multi-moneda (EUR/GBP), 4 modos de redondeo e impuesto parametrizable OK');

// ── 10. Visor 3D OPCIONAL ────────────────────────────────────────────────
// Nada de lo anterior tiene modelo 3D: eso ya demuestra que la app funciona
// entera sin él. Aquí se comprueba el ciclo completo cuando sí se usa.
const sin3d = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente');
if (sin3d.model3d !== null) throw new Error('un producto sin modelo debe exponer model3d: null');

// Referencia a una parte inexistente → se poda sola (no rompe nada).
const m3bad = await agentReg.dispatchAction({ type: 'SET_MODEL3D', payload: { producto: 'Chaqueta Agente' } });
if (m3bad.success || m3bad.error.indexOf('url') === -1) throw new Error('SET_MODEL3D sin datos debía enseñar el formato: ' + JSON.stringify(m3bad));

await act('SET_MODEL3D', { producto: 'Chaqueta Agente',
  url: 'https://cdn/chaqueta.glb', publish: true, rotation: [0, 0, 0], realSizeCm: 78,
  parts: [
    { id: 'cuerpo', label: 'Cuerpo', materials: ['Tela_Cuerpo'], defaultColor: '#3b5a8a' },
    { id: 'forro', label: 'Forro', materials: ['Tela_Forro'], defaultColor: '#cccccc' },
    { label: 'Rota', materials: [] }, // sin materiales → se descarta con aviso
  ],
  finishes: [{ id: 'lana', label: 'Lana', color: '#7a6a55', texture: 'https://cdn/lana.webp', textureScale: 2 }],
});
const m3 = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente').model3d;
expectEq('3D: partes válidas guardadas (la incompleta se descarta)', m3.parts.length, 2);
expectEq('3D: acabados guardados', m3.finishes.length, 1);
expectEq('3D: medida real guardada (habilita "Ver en tu espacio")', m3.realSizeCm, 78);
if (!m3.enabled || m3.publish !== true) throw new Error('3D: enabled/publish no quedaron bien');

// Vincular pasos con efectos 3D, incluida una parte inexistente que debe podarse.
await act('SET_PRODUCTO_STEPS', { producto: 'Chaqueta Agente', steps: [
  { label: 'Color', values: [
    { label: 'Azul', components: ['Algodón 20/1 (Prov. Sur)'], model3d: [{ partId: 'cuerpo', type: 'color', color: '#2244aa' }] },
    { label: 'Lana', components: ['Lino europeo (Prov. UE)'], model3d: [
      { partId: 'cuerpo', type: 'finish', finishId: 'lana' },
      { partId: 'forro', type: 'hide' },
      { partId: 'no-existe', type: 'color', color: '#fff' },
    ] },
  ] },
] });
const stepsAg = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente').steps;
expectEq('3D: efectos del primer valor', stepsAg[0].values[0].model3d.length, 1);
expectEq('3D: efecto a parte inexistente podado', stepsAg[0].values[1].model3d.length, 2);

// El JSON público lleva el contrato 3D (mismo que consume el motor).
await act('PUBLISH_CONFIG', { enabled: true });
const pub3d = store.get('definition').public.data.productos.find((e) => e.name === 'Chaqueta Agente');
if (!pub3d.model3d || pub3d.model3d.url !== 'https://cdn/chaqueta.glb' || pub3d.model3d.parts.length !== 2) {
  throw new Error('JSON público sin contrato 3D: ' + JSON.stringify(pub3d.model3d));
}
// Sin medida real la tienda no puede ofrecer AR a una escala inventada.
expectEq('3D: medida real publicada', pub3d.model3d.realSizeCm, 78);
const pubVal = pub3d.groups[0].values.find((v) => v.name === 'Lana');
expectEq('3D: efectos del valor publicados', (pubVal.model3d || []).length, 2);
// Un producto sin 3D no ensucia el JSON público.
const pubSin3d = store.get('definition').public.data.productos.find((e) => e.name === 'Camisa Clásica');
if (pubSin3d.model3d !== null) throw new Error('un producto sin 3D debe publicar model3d: null');

// publish=false → el 3D deja de viajar al theme (pero se conserva en la app).
await act('SET_MODEL3D', { producto: 'Chaqueta Agente', publish: false });
await act('PUBLISH_CONFIG', { enabled: true });
const pubOff = store.get('definition').public.data.productos.find((e) => e.name === 'Chaqueta Agente');
if (pubOff.model3d !== null) throw new Error('con publish=false el 3D no debe publicarse');
if (!agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente').model3d) {
  throw new Error('despublicar no debe borrar el 3D de la app');
}

// Quitar el 3D limpia también los efectos de los pasos.
await act('SET_MODEL3D', { producto: 'Chaqueta Agente', remove: true });
const gone = agentReg.getSnapshot().productos.find((e) => e.name === 'Chaqueta Agente');
if (gone.model3d !== null) throw new Error('remove no quitó el 3D');
if (gone.steps[0].values.some((v) => (v.model3d || []).length)) throw new Error('quitar el 3D debe limpiar los efectos de los pasos');
console.log('3D opcional: alta, partes/acabados, efectos por valor, poda de referencias, publicación condicional y borrado OK');

// ── 11. Precio fijo, valores sin costo y pasos generados desde el 3D ──────
// Reproduce el caso real: un PACK con precio fijo, cuyos pasos existen solo
// para personalizar y visualizar, sin recargos ni costos modelados.
await act('UPSERT_PRODUCTO', { name: 'Pack 2 Pisos', sku: 'PACK-2', priceMode: 'fixed', fixedPrice: 100000 });
await act('SET_MODEL3D', { producto: 'Pack 2 Pisos', url: 'https://cdn/pack.glb',
  parts: [
    { id: 'sup1', label: 'Superficie 1', materials: ['Sup_1'], defaultFinish: 'natural' },
    { id: 'est1', label: 'Estructura 1', materials: ['Est_1'], defaultFinish: 'natural' },
    { id: 'sup2', label: 'Superficie 2', materials: ['Sup_2'], defaultFinish: 'natural' },
    { id: 'est2', label: 'Estructura 2', materials: ['Est_2'], defaultFinish: 'natural' },
  ],
  finishes: [
    { id: 'natural', label: 'Natural', color: '#ffffff', texture: 'https://cdn/w.webp' },
    { id: 'carbonizado', label: 'Carbonizado', color: '#3f4147', texture: 'https://cdn/w.webp' },
  ] });

// Un paso SIN valores debe rechazar TODA la llamada, no guardarse vacío.
const vacio = await agentReg.dispatchAction({ type: 'SET_PRODUCTO_STEPS', payload: { producto: 'Pack 2 Pisos',
  steps: [{ label: 'Superficie Hanoi 1' }, { label: 'Estructura Hanoi 1' }] } });
if (vacio.success || vacio.error.indexOf('SIN valores') === -1 || vacio.error.indexOf('values') === -1) {
  throw new Error('un paso sin valores debía rechazarse con detalle: ' + JSON.stringify(vacio));
}
if ((agentReg.getSnapshot().productos.find((e) => e.name === 'Pack 2 Pisos').steps || []).length !== 0) {
  throw new Error('el rechazo no debe dejar pasos a medio guardar');
}

// Alias en español (values→valores, label→nombre, components→componentes).
await act('SET_PRODUCTO_STEPS', { producto: 'Pack 2 Pisos', steps: [
  { nombre: 'Prueba alias', valores: [{ nombre: 'Uno' }, 'Dos'] },
] });
const alias = agentReg.getSnapshot().productos.find((e) => e.name === 'Pack 2 Pisos');
expectEq('alias en español (valores/nombre + valor como string)', alias.steps[0].values.map((v) => v.label).join(','), 'Uno,Dos');

// BUILD_3D_STEPS: el agente arma los 4 pasos solo, ya vinculados al 3D.
const b3d = await act('BUILD_3D_STEPS', { producto: 'Pack 2 Pisos' });
if (b3d.message.indexOf('Superficie 1') === -1) throw new Error('BUILD_3D_STEPS sin detalle: ' + b3d.message);
const pack = agentReg.getSnapshot().productos.find((e) => e.name === 'Pack 2 Pisos');
expectEq('pasos generados desde el modelo', pack.steps.length, 4);
expectEq('valores por paso (un acabado cada uno)', pack.steps[0].values.length, 2);
expectEq('vínculo 3D generado', pack.steps[0].values[1].model3d[0].finishId, 'carbonizado');
expectEq('cada parte a su propio paso', pack.steps[3].values[0].model3d[0].partId, 'est2');
// Todos los valores son vendibles aunque NO tengan componentes ni costo.
if (!pack.steps.every((s) => s.values.every((v) => v.available))) throw new Error('los valores sin componentes deben ser vendibles');

// Precio fijo: TODAS las combinaciones valen lo mismo, sin redondeo.
expectEq('precio del pack (fijo, exacto)', pack.computedPrice, 100000);
expectEq('combinaciones', pack.variantCombos, 16);
await act('LINK_PRODUCT', { producto: 'Pack 2 Pisos', product: '424242' });
await act('APPLY_PRODUCTO', { producto: 'Pack 2 Pisos' });
const packProd = productsStore.get('prod-1');
expectEq('variantes aplicadas', packProd.variants.length, 16);
const precios = Array.from(new Set(packProd.variants.map((v) => v.price)));
expectEq('todas las variantes al mismo precio', precios.join(','), '100000');
expectEq('precio del producto en la tienda', packProd.price, 100000);
// Con precio fijo no se muestran recargos en la tienda.
await act('PUBLISH_CONFIG', { enabled: true });
const pubPack = store.get('definition').public.data.productos.find((e) => e.sku === 'PACK-2');
if (pubPack.groups.some((g) => g.values.some((v) => v.delta !== 0))) throw new Error('con precio fijo los deltas deben ser 0');

// Recargo por paso sin modelar costos: +15.000 en un valor.
const packItem = Array.from(store.values()).find((x) => x.kind === 'producto' && x.name === 'Pack 2 Pisos');
packItem.groups[0].values[1].priceDelta = 15000;
await act('SET_PRODUCTO_STEPS', { producto: 'Pack 2 Pisos', steps: packItem.groups.map((g) => ({
  label: g.label, default: (g.values.find((v) => v.id === g.defaultValueId) || {}).label,
  values: g.values.map((v) => ({ label: v.label, priceDelta: v.priceDelta, model3d: v.model3d })),
})) });
await act('APPLY_PRODUCTO', { producto: 'Pack 2 Pisos' });
const conRecargo = productsStore.get('prod-1').variants;
const caro = conRecargo.filter((v) => v.price === 115000).length;
expectEq('el recargo por valor se aplica sobre el precio fijo', caro, 8);
expectEq('la configuración por defecto sigue costando lo fijado',
  agentReg.getSnapshot().productos.find((e) => e.name === 'Pack 2 Pisos').computedPrice, 100000);

// priceMode "store": toma el precio que ya tiene el producto en el catálogo.
productsStore.set('prod-1', Object.assign({}, productsStore.get('prod-1'), { price: 87990, costPerItem: 30000 }));
await act('UPSERT_PRODUCTO', { name: 'Pack 2 Pisos', priceMode: 'store' });
app.unmount(); app = mount(shell); app.Component({});
await new Promise((res) => setTimeout(res, 100));
const desdeTienda = agentReg.getSnapshot().productos.find((e) => e.name === 'Pack 2 Pisos');
expectEq('precio tomado del catálogo', desdeTienda.computedPrice, 87990);
expectEq('costo de Jumpseller visible para el agente', desdeTienda.storeCost, 30000);
console.log('precio fijo/del catálogo, valores sin costo, recargo por paso, rechazo de pasos vacíos y BUILD_3D_STEPS OK');

// ── 12. GUARDIA DE PRECIO CERO ────────────────────────────────────────────
// Esto escribe en una tienda viva: un precio 0 no es "gratis", es un dato que
// falta, y publicarlo pone el producto a $0 a la venta. Se comprueba que NO se
// aplique nada y que el precio de la tienda quede intacto.
const precioAntes = productsStore.get('prod-1').price;
const varsAntes = JSON.stringify(productsStore.get('prod-1').variants);

// (a) auto sin ningún costo — el caso de los pasos generados desde el 3D,
//     cuyos valores no llevan componentes.
await act('UPSERT_PRODUCTO', { name: 'Pack 2 Pisos', priceMode: 'auto', fixedPrice: 0 });
const cero = await agentReg.dispatchAction({ type: 'APPLY_PRODUCTO', payload: { producto: 'Pack 2 Pisos' } });
if (cero.success) throw new Error('¡se aplicó un producto a precio 0! ' + JSON.stringify(cero));
if (cero.error.indexOf('$0 en la tienda') === -1 || cero.error.indexOf('precio automático') === -1) {
  throw new Error('el error no explica la causa: ' + cero.error);
}
expectEq('precio 0: la tienda queda intacta', productsStore.get('prod-1').price, precioAntes);
expectEq('precio 0: las variantes quedan intactas', JSON.stringify(productsStore.get('prod-1').variants) === varsAntes, true);

// (b) modo "store" sin catálogo legible: NO puede caer a 0, manda el último
//     precio conocido del producto.
const eqStore = { id: 'eq-precio', kind: 'producto', name: 'Sin catálogo', priceMode: 'store',
  fixedPrice: 0, price: 45990, groups: [], storeRef: { instanceId: 'inst-x', itemId: 'no-existe' } };
store.set(eqStore.id, eqStore);
app.unmount(); app = mount(shell); app.Component({});
await new Promise((res) => setTimeout(res, 100));
const snapPrecio = agentReg.getSnapshot().productos.find((e) => e.name === 'Sin catálogo');
expectEq('modo tienda sin catálogo: no colapsa a 0', snapPrecio.computedPrice, 45990);
console.log('guardia de precio cero OK');

// ── 13. El agente cambia el producto que tengo abierto en el editor ────────
// El agente escribe en el modelo, no en el formulario. Antes el editor seguía
// mostrando lo viejo y al pulsar Guardar pisaba lo que el agente acababa de
// hacer; había que cerrar sin guardar y reabrir la app para ver los cambios.
const { decidirRecarga, agentEdit } = app.__test;
const abierto = { id: 'eq-x', name: 'X', updatedAt: '2026-07-25T10:00:00.000Z' };
const base = JSON.stringify(abierto);
expectEq('sin cambios de nadie: el editor no se toca',
  decidirRecarga(abierto, { id: 'eq-x', updatedAt: '2026-07-25T10:00:00.000Z' }, base), 'nada');
expectEq('el agente cambió y yo no había tocado nada: se recarga solo',
  decidirRecarga(abierto, { id: 'eq-x', updatedAt: '2026-07-25T10:05:00.000Z' }, base), 'recargar');
expectEq('el agente cambió y yo tenía edición sin guardar: se pregunta',
  decidirRecarga(Object.assign({}, abierto, { name: 'X editado' }),
    { id: 'eq-x', updatedAt: '2026-07-25T10:05:00.000Z' }, base), 'preguntar');
// Y la acción deja dicho a qué sección llevar al usuario.
await act('SET_MODEL3D', { producto: 'Chaqueta Agente', url: 'https://cdn/x.glb',
  parts: [{ id: 'p1', label: 'P', materials: ['M'] }] });
expectEq('tras SET_MODEL3D el editor salta al visor 3D', agentEdit.section, 'modelo3d');
await act('SET_STOREFRONT', { producto: 'Chaqueta Agente', allowEmpty: true, pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: { top: [{ type: 'title' }] } },
] });
expectEq('tras SET_STOREFRONT el editor salta a la ficha', agentEdit.section, 'ficha');
console.log('sincronía agente → editor OK');

// ── ProductLab 2.0: cantidades (qty), pasos dependientes, secciones imagen y estilo ──
// Reglas conocidas para aserciones de precio exactas.
const defPL = store.get('definition');
defPL.rules = {
  currency: 'CLP', currencySymbol: '$', currencyDecimals: 0, locale: 'es-CL',
  fx: { USD: 950 }, salesTaxLabel: 'IVA', salesTaxPct: 19,
  marginBasis: 'cost', marginDefaultPct: 30, marginBasePct: 25, marginByType: {},
  roundMode: 'ending', roundTo: 1000, roundEnding: 990,
  deltaRoundTo: 100, leadTimeDays: 0, staleDays: 30,
};
store.set('definition', defPL);
app.unmount(); app = mount(shell); app.Component({});
await new Promise((res) => setTimeout(res, 60));

await act('UPSERT_COMPONENT', { name: 'Módulo Cajón', type: 'other', cost: 20000, currency: 'CLP', stock: 3, deliveryDays: 2 });
await act('UPSERT_PRODUCTO', { name: 'Mesa Modular', sku: 'PL-MOD', deliveryExtraDays: 0 });
await act('SET_PRODUCTO_STEPS', { producto: 'Mesa Modular', steps: [
  { label: 'Cubierta', default: 'Roble', values: [{ label: 'Roble' }, { label: 'Nogal', recargo: 15000 }] },
  // Paso DEPENDIENTE: solo visible con cubierta Roble; default SIN costo;
  // "2 cajones" usa el MISMO componente ×2 (cantidad); "4 cajones" excede el
  // stock (3) y debe quedar no disponible.
  { label: 'Cajones', default: 'Sin cajones', dependsOn: { step: 'Cubierta', values: ['Roble'] }, values: [
    { label: 'Sin cajones' },
    { label: '2 cajones', qty: 2, components: ['Módulo Cajón'] },
    { label: '4 cajones', qty: 4, components: ['Módulo Cajón'] },
  ] },
] });
const seMod = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Modular');
const stepCaj = seMod.steps[1];
if (!stepCaj.dependsOn || stepCaj.dependsOn.step !== 'Cubierta' || stepCaj.dependsOn.values.join(',') !== 'Roble') {
  throw new Error('dependsOn no quedó en el snapshot: ' + JSON.stringify(stepCaj.dependsOn));
}
const v2c = stepCaj.values.find((v) => v.label === '2 cajones');
const v4c = stepCaj.values.find((v) => v.label === '4 cajones');
const vSinCaj = stepCaj.values.find((v) => v.label === 'Sin cajones');
expectEq('qty persistida', v2c.qty, 2);
// 20000×1.30×1.19 = 30940 × 2 = 61880 → redondeo de recargos (100) → 61900
expectEq('delta 2 cajones (precio × cantidad)', v2c.delta, 61900);
if (v4c.available) throw new Error('"4 cajones" (qty 4 > stock 3) debía quedar no disponible');
if (!vSinCaj.available || vSinCaj.delta !== 0) throw new Error('valor sin costo debía estar disponible con delta 0');

await act('PUBLISH_CONFIG', { enabled: true });
const pubAll = store.get('definition').public.data;
expectEq('JSON público version (contrato ProductLab)', pubAll.version, 2);
const pubMod = pubAll.productos.find((e) => e.sku === 'PL-MOD');
const pubCaj = pubMod.groups.find((g) => g.label === 'Cajones');
if (!pubCaj.dependsOn || pubCaj.dependsOn.groupId !== pubMod.groups[0].id || pubCaj.dependsOn.valueIds.length !== 1) {
  throw new Error('dependsOn no publicado: ' + JSON.stringify(pubCaj.dependsOn));
}
expectEq('valores publicados de Cajones (qty sin stock suficiente excluido)', pubCaj.values.length, 2);
expectEq('qty publicada', pubCaj.values.find((v) => v.name === '2 cajones').qty, 2);
console.log('ProductLab: qty, pasos dependientes y publicación v2 OK');

// ── ProductLab 2.0: secciones imagen (alto adaptable), alturas auto y estilo ──
await act('SET_STOREFRONT', { producto: 'Mesa Modular', allowEmpty: true, pageSections: [
  { kind: 'hero', pattern: 'clasico', height: 'auto', slots: { top: [{ type: 'title' }], center: [{ type: 'photo', size: 'auto' }], bottom: [{ type: 'gallery', index: 1, size: 'auto' }] } },
  { kind: 'imagen', imageUrl: 'https://cdn/desc-1.png', width: 'full' },
  { kind: 'imagen', imageUrl: 'https://cdn/desc-2.png' },
  { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
], style: { accentColor: '#0FA36B', radius: 8, cardStyle: 'compact', showDeltas: 'total' } });
const sfMod = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Modular').storefront;
const imgSecs = sfMod.pageSections.filter((x) => x.kind === 'imagen');
// Sin width propio, la sección hereda el ancho de la ficha ('auto').
if (imgSecs.length !== 2 || imgSecs[0].width !== 'full' || imgSecs[1].width !== 'auto') throw new Error('secciones imagen mal normalizadas: ' + JSON.stringify(imgSecs));
const heroAuto = sfMod.pageSections.find((x) => x.kind === 'hero');
if (heroAuto.height !== 'auto' || heroAuto.slots.center[0].size !== 'auto' || heroAuto.slots.bottom[0].size !== 'auto') {
  throw new Error('alturas/tamaños auto no persistieron: ' + JSON.stringify({ h: heroAuto.height, p: heroAuto.slots.center[0].size, g: heroAuto.slots.bottom[0].size }));
}
if (sfMod.style.accentColor !== '#0FA36B' || sfMod.style.radius !== 8 || sfMod.style.cardStyle !== 'compact' || sfMod.style.showDeltas !== 'total') {
  throw new Error('style no persistió: ' + JSON.stringify(sfMod.style));
}
// Ancho INDEPENDIENTE por sección (hero/imagen/specs/fotos), además del
// ancho general de la ficha (style.width).
await act('SET_STOREFRONT', { producto: 'Mesa Modular', allowEmpty: true, pageSections: [
  { kind: 'hero', pattern: 'clasico', width: 'full', slots: { top: [{ type: 'title' }] } },
  { kind: 'hero', pattern: 'apilado', width: 'container', slots: { top: [{ type: 'title' }] } },
  { kind: 'hero', pattern: 'banda', slots: { left: [{ type: 'title' }] } },
  { kind: 'imagen', imageUrl: 'https://cdn/a.png', width: 'content' },   // alias histórico
  { kind: 'specs', width: 'container' }, { kind: 'fotos', width: 'full' }, { kind: 'note' },
] });
const anchos = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Modular').storefront.pageSections;
const heros3 = anchos.filter((x) => x.kind === 'hero');
expectEq('hero 1 a ancho completo', heros3[0].width, 'full');
expectEq('hero 2 en contenedor', heros3[1].width, 'container');
expectEq('hero 3 hereda de la ficha', heros3[2].width, 'auto');
expectEq('imagen: alias content → container', anchos.find((x) => x.kind === 'imagen').width, 'container');
expectEq('specs con ancho propio', anchos.find((x) => x.kind === 'specs').width, 'container');
expectEq('fotos con ancho propio', anchos.find((x) => x.kind === 'fotos').width, 'full');
expectEq('note hereda', anchos.find((x) => x.kind === 'note').width, 'auto');
await act('PUBLISH_CONFIG', { enabled: true });
const pubAnchos = store.get('definition').public.data.productos.find((e) => e.sku === 'PL-MOD').storefront.pageSections;
expectEq('ancho por sección publicado', pubAnchos.filter((x) => x.width === 'full').length, 2);

const badImg = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Modular', pageSections: [{ kind: 'imagen' }] } });
if (badImg.success || badImg.error.indexOf('imageUrl') === -1) throw new Error('sección imagen sin URL no rechazada: ' + JSON.stringify(badImg));
console.log('ProductLab: secciones imagen, tamaños auto y estilo por producto OK');

// ── ProductLab 2.5: PLANTILLAS de estilo (un look en muchos productos) ────
// Crear una plantilla copiando el estilo de un producto, y engancharlo a ella.
const tpl = await act('SET_STYLE_TEMPLATE', { name: 'Tienda oscura', from: 'Mesa Modular',
  style: { bar: { bgColor: '#101418', sticky: false, offset: 12 }, photos: { size: 'l', cols: 3 }, buyLabel: 'Personalizar' } });
const tplId = (agentReg.getSnapshot().styleTemplates[0] || {}).id;
if (!tplId) throw new Error('la plantilla no quedó en el snapshot: ' + JSON.stringify(tpl));
const tplSnap = agentReg.getSnapshot().styleTemplates[0];
// `from` copia el estilo del producto y `style` se fusiona encima (sin perder
// lo que no se envía: la barra y las fotos se mezclan campo a campo).
expectEq('plantilla: acento copiado del producto', tplSnap.style.accentColor, '#0FA36B');
expectEq('plantilla: radio copiado del producto', tplSnap.style.radius, 8);
expectEq('plantilla: fondo de barra propio', tplSnap.style.bar.bgColor, '#101418');
expectEq('plantilla: barra no pegajosa', tplSnap.style.bar.sticky, false);
expectEq('plantilla: fotos grandes', tplSnap.style.photos.size, 'l');
// El texto del botón que lleva al configurador viaja en el estilo: se cambia
// una vez y lo heredan todos los productos de la plantilla.
expectEq('plantilla: texto del botón de la barra', tplSnap.style.buyLabel, 'Personalizar');
// Enganchar UN producto: su estilo propio no se toca, pero lo que rige es la plantilla.
await act('APPLY_STYLE_TEMPLATE', { template: 'Tienda oscura', producto: 'Camisa Clásica' });
const camisa = agentReg.getSnapshot().productos.find((e) => e.name === 'Camisa Clásica');
expectEq('producto enganchado a la plantilla', camisa.storefront.styleId, tplId);
expectEq('estilo efectivo = el de la plantilla', camisa.storefront.styleEffective.accentColor, '#0FA36B');
expectEq('estilo propio intacto', camisa.storefront.style.accentColor || '', '');
await act('PUBLISH_CONFIG', { enabled: true });
const pubCamisa = store.get('definition').public.data.productos.find((e) => e.name === 'Camisa Clásica');
expectEq('publicado con el estilo resuelto', pubCamisa.storefront.style.accentColor, '#0FA36B');
expectEq('publicado con la barra de la plantilla', pubCamisa.storefront.style.bar.bgColor, '#101418');
expectEq('publicado con el texto del botón', pubCamisa.storefront.style.buyLabel, 'Personalizar');
// Editar la plantilla alcanza de golpe a todos los que la usan.
await act('SET_STYLE_TEMPLATE', { id: tplId, style: { accentColor: '#FF6A00' } });
await act('PUBLISH_CONFIG', { enabled: true });
expectEq('editar la plantilla cambia el producto',
  store.get('definition').public.data.productos.find((e) => e.name === 'Camisa Clásica').storefront.style.accentColor, '#FF6A00');
// Plantilla por defecto del catálogo: rige en los que no eligieron nada.
await act('SET_STYLE_TEMPLATE', { id: tplId, setDefault: true });
await act('PUBLISH_CONFIG', { enabled: true });
const pubMesa = store.get('definition').public.data.productos.find((e) => e.sku === 'PL-MOD');
expectEq('la plantilla por defecto alcanza al resto', pubMesa.storefront.style.bar.bgColor, '#101418');
// …salvo el que pide explícitamente su estilo propio.
await act('APPLY_STYLE_TEMPLATE', { template: 'own', producto: 'Mesa Modular' });
await act('PUBLISH_CONFIG', { enabled: true });
const pubMesaOwn = store.get('definition').public.data.productos.find((e) => e.sku === 'PL-MOD');
expectEq('"own" ignora la plantilla del catálogo', pubMesaOwn.storefront.style.bar.bgColor || '', '');
expectEq('"own" conserva el estilo propio', pubMesaOwn.storefront.style.accentColor, '#0FA36B');
// Aplicar a TODO el catálogo de una vez.
const todos = await act('APPLY_STYLE_TEMPLATE', { template: tplId, all: true });
if (!/producto\(s\) usan ahora/.test(todos.message)) throw new Error('APPLY_STYLE_TEMPLATE all sin resumen: ' + todos.message);
expectEq('todos enganchados',
  agentReg.getSnapshot().productos.filter((e) => e.storefront.styleId === tplId).length,
  agentReg.getSnapshot().productos.length);
// Plantilla inexistente: error didáctico, nada se guarda.
const tplMal = await agentReg.dispatchAction({ type: 'APPLY_STYLE_TEMPLATE', payload: { template: 'No Existe', all: true } });
if (tplMal.success || tplMal.error.indexOf('SET_STYLE_TEMPLATE') === -1) throw new Error('plantilla inexistente no rechazada: ' + JSON.stringify(tplMal));
// Borrarla devuelve a todos a su estilo propio, sin tocar nada más.
await act('DELETE_STYLE_TEMPLATE', { id: tplId });
expectEq('plantilla borrada', agentReg.getSnapshot().styleTemplates.length, 0);
expectEq('deja de ser la del catálogo', agentReg.getSnapshot().styleDefaultId, '');
await act('PUBLISH_CONFIG', { enabled: true });
expectEq('sin plantilla vuelve el estilo propio',
  store.get('definition').public.data.productos.find((e) => e.sku === 'PL-MOD').storefront.style.accentColor, '#0FA36B');
console.log('ProductLab: plantillas de estilo (crear, aplicar, editar, por defecto y borrar) OK');

// ── Aviso del paso dependiente con default de pago ────────────────────────
// Un paso oculto SIGUE aportando su default a la variante (Jumpseller exige un
// valor por opción en cada combinación): si ese default cuesta, se cobra sin
// verse. El aviso tiene que decirlo con nombres y con el importe.
await act('SET_PRODUCTO_STEPS', { producto: 'Pack 2 Pisos', steps: [
  { label: 'Plataforma', type: 'tela', values: [
    { label: 'AMD', components: ['Algodón 20/1 (Prov. Sur)'] },
    { label: 'Intel', components: ['Lino europeo (Prov. UE)'] },
  ] },
  { label: 'Procesador AMD', type: 'avios', dependsOn: { step: 'Plataforma', values: ['AMD'] }, values: [
    { label: 'Ryzen 5', components: ['Botón nácar (Prov. B)'] },
  ] },
] });
const avisosDep = agentReg.getSnapshot().productos.find((e) => e.name === 'Pack 2 Pisos').warnings || [];
const avisoDep = avisosDep.filter((w) => /Procesador AMD/.test(w))[0] || '';
if (!/depende de "Plataforma"/.test(avisoDep) || !/Jumpseller exige/.test(avisoDep) || !/No aplica/.test(avisoDep)) {
  throw new Error('el aviso del paso dependiente no explica el caso: ' + avisoDep);
}
console.log('aviso del paso dependiente:', avisoDep.slice(0, 80) + '…');
// Con un default sin costo, el aviso desaparece.
await act('SET_PRODUCTO_STEPS', { producto: 'Pack 2 Pisos', steps: [
  { label: 'Plataforma', type: 'tela', values: [
    { label: 'AMD', components: ['Algodón 20/1 (Prov. Sur)'] },
    { label: 'Intel', components: ['Lino europeo (Prov. UE)'] },
  ] },
  { label: 'Procesador AMD', type: 'avios', dependsOn: { step: 'Plataforma', values: ['AMD'] },
    default: 'No aplica', values: [
    { label: 'No aplica', components: [] },
    { label: 'Ryzen 5', components: ['Botón nácar (Prov. B)'] },
  ] },
] });
const sinAviso = (agentReg.getSnapshot().productos.find((e) => e.name === 'Pack 2 Pisos').warnings || [])
  .filter((w) => /default con precio|cuesta/.test(w) && /Procesador AMD/.test(w));
expectEq('con un default "No aplica" el aviso desaparece', sinAviso.length, 0);
console.log('ProductLab: aviso del paso dependiente explicado y resuelto OK');

// ── ProductLab 2.1: migración desde otra app + exportar/importar ──────────
// LIST_SOURCES ve la instancia ajena (y no la propia).
const src = await act('LIST_SOURCES', {});
if (src.message.indexOf('old-pc') === -1 || src.message.indexOf('hubpro.computadores') === -1) {
  throw new Error('LIST_SOURCES no listó la instancia de computadores: ' + src.message);
}
if (src.message.indexOf('inst-1') !== -1) throw new Error('LIST_SOURCES no debe listar la instancia propia');

// dryRun: informa sin escribir nada.
const antesComps = agentReg.getSnapshot().components.length;
const dry = await act('MIGRATE_FROM', { origen: 'old-pc', dryRun: true });
if (dry.message.indexOf('2 componente(s)') === -1 || dry.message.indexOf('1 producto(s)') === -1) {
  throw new Error('dryRun con conteo incorrecto: ' + dry.message);
}
expectEq('dryRun no escribe', agentReg.getSnapshot().components.length, antesComps);

// Migración real: traduce kind equipo→producto, productRef→storeRef y
// PRESERVA los ids (el paso sigue apuntando a su componente).
const mig = await act('MIGRATE_FROM', { origen: 'old-pc' });
if (mig.message.indexOf('2 nuevos') === -1) throw new Error('migración sin componentes nuevos: ' + mig.message);
const snapMig = agentReg.getSnapshot();
const migR5 = snapMig.components.find((c) => c.id === 'cmp-r5');
if (!migR5 || migR5.name !== 'Ryzen 5 8500G') throw new Error('el componente migrado no conservó su id');
expectEq('costo migrado', migR5.cost, 110000);
expectEq('verificado migrado', migR5.verifiedAt, '2026-07-01T10:00:00.000Z');
const migProd = snapMig.productos.find((e) => e.id === 'eq-pc');
if (!migProd) throw new Error('el equipo no se migró como producto');
if (!migProd.linked) throw new Error('productRef no se tradujo a storeRef (el producto quedó sin enlace)');
expectEq('paso migrado con su componente', migProd.steps[0].values[0].alternatives[0], 'RAM Kingston 16GB');
const itemProd = store.get('eq-pc');
if (itemProd.kind !== 'producto') throw new Error('el item migrado debe guardarse con kind "producto"');
if (itemProd.productRef) throw new Error('productRef debía eliminarse tras traducirlo a storeRef');
expectEq('priceMode del migrado', itemProd.priceMode, 'auto');
// Reglas legacy traducidas por los alias (ivaPct/usdRate/assemblyDays/end990).
const rMig = agentReg.getSnapshot().rules;
expectEq('impuesto desde ivaPct', rMig.salesTaxPct, 19);
expectEq('USD desde usdRate', rMig.fx.USD, 950);
expectEq('días desde assemblyDays', rMig.leadTimeDays, 3);
expectEq('redondeo desde end990', rMig.roundMode, 'ending');
if (!agentReg.getSnapshot().types.some((t) => t.id === 'cpu')) throw new Error('los tipos del origen no se trajeron');

// Idempotente: repetir no duplica.
const n1 = agentReg.getSnapshot().components.length;
const mig2 = await act('MIGRATE_FROM', { origen: 'old-pc' });
expectEq('migrar de nuevo no duplica', agentReg.getSnapshot().components.length, n1);
if (mig2.message.indexOf('2 actualizados') === -1) throw new Error('la segunda pasada debía actualizar: ' + mig2.message);

// Origen inaccesible → error didáctico.
const bad = await agentReg.dispatchAction({ type: 'MIGRATE_FROM', payload: { origen: 'sin-acceso' } });
if (bad.success || bad.error.indexOf('LIST_SOURCES') === -1) throw new Error('origen inválido sin error didáctico: ' + JSON.stringify(bad));

// Exportar → importar (ida y vuelta por URL, con el CSV de componentes).
const expCsv = await act('EXPORT_DATA', { formato: 'csv' });
const csvUrl = expCsv.message.match(/https?:\/\/[^ ]+\.csv/)[0];
if (uploads.get(csvUrl) == null) throw new Error('el CSV no se subió');
const csvText = uploads.get(csvUrl);
if (csvText.split('\n')[0].indexOf('nombre') === -1) throw new Error('CSV sin encabezado "nombre"');
if (csvText.indexOf('Ryzen 5 8500G') === -1) throw new Error('CSV sin los componentes');
// Editar el CSV como en una planilla: cambio de costo y componente nuevo.
const editado = csvText.split('\r\n')
  .map((ln) => (ln.indexOf('cmp-r5') === 0 ? ln.replace('110000', '125000') : ln))
  .concat([',Gabinete NZXT,Chasis,NZXT,ATX vidrio,39990,CLP,0,7,4,PC Factory,https://p/9,,,,,si,,'])
  .join('\r\n');
uploads.set(csvUrl, editado);
const impCsv = await act('IMPORT_DATA', { url: csvUrl });
if (impCsv.message.indexOf('1 nuevos') === -1) throw new Error('el componente nuevo del CSV no se creó: ' + impCsv.message);
const snapCsv = agentReg.getSnapshot();
expectEq('costo editado en la planilla', snapCsv.components.find((c) => c.id === 'cmp-r5').cost, 125000);
const nuevoCsv = snapCsv.components.find((c) => c.name === 'Gabinete NZXT');
if (!nuevoCsv) throw new Error('el componente agregado en el CSV no llegó');
expectEq('stock del componente nuevo (columna stock)', nuevoCsv.stock, 7);
expectEq('días de entrega del componente nuevo', nuevoCsv.deliveryDays, 4);
expectEq('costo del componente nuevo', nuevoCsv.cost, 39990);
if (!agentReg.getSnapshot().types.some((t) => t.label === 'Chasis')) throw new Error('el tipo nuevo del CSV debía crearse solo');

// Export JSON completo y reimportación en modo "skip" (no toca lo existente).
const expJson = await act('EXPORT_DATA', { formato: 'json' });
const jsonUrl = expJson.message.match(/https?:\/\/[^ ]+\.json/)[0];
const packExp = JSON.parse(uploads.get(jsonUrl));
if (packExp.format !== 'kimos.productlab.data' || !packExp.components.length || !packExp.productos.length) {
  throw new Error('export JSON incompleto: ' + JSON.stringify(Object.keys(packExp)));
}
if (!packExp.definition || !packExp.definition.rules) throw new Error('export JSON sin reglas');
const nAntes = agentReg.getSnapshot().components.length;
const impSkip = await act('IMPORT_DATA', { url: jsonUrl, mode: 'skip' });
expectEq('modo skip no crea duplicados', agentReg.getSnapshot().components.length, nAntes);
if (impSkip.message.indexOf('omitidos') === -1) throw new Error('modo skip no informó omisiones: ' + impSkip.message);
console.log('ProductLab: migración desde otra app, export/import JSON y CSV (ida y vuelta) OK');

console.log('\nTodo OK ✔ — precios (ambas bases de margen), alternativas por disponibilidad, stock, migración v2.0, variantes por combinación, agente completo, render, parametrización genérica (moneda/impuesto/redondeo), visor 3D opcional, qty, pasos dependientes, secciones imagen, estilo por producto y plantillas de estilo válidos');
cleanups.forEach((c) => c());