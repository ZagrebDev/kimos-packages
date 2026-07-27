// Smoke test ProductLab: monta la app con shell/React simulados y ejercita el motor
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
  id: 'prod-1', name: 'Mesa Nórdica 120', sku: 'PL-N1', price: 111,
  imageUrl: 'https://cdn/x.png',
  sourceLinks: [{ integration: 'jumpseller', sourceId: '424242' }],
  images: ['https://cdn/x.png', 'https://cdn/g2.png'], // galería completa (pull v2)
  // Estado previo en la tienda: ids que deben PRESERVARSE al regenerar
  options: [{ name: 'Cubierta', optionType: 'option', sourceOptionId: '900',
    values: [{ name: 'Roble', sourceValueId: '901' }] }],
  variants: [],
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
    if (method === 'GET' && url.includes('/api/storage/teams/team-1/files/download')) {
      return { ok: true, blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) };
    }
    if (method === 'POST' && url.includes('/api/v2/files')) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({}) };
  },
  agent: { register: (reg) => { agentReg = reg; return () => { agentReg = null; }; } },
  data: {
    listInstances: async (tpl) => (tpl === 'products' ? [{ id: 'p-inst', name: 'Productos' }] : []),
    listItems: async (iid) => (iid === 'p-inst' ? Array.from(productsStore.values()) : []),
  },
};

const { default: mount } = await import(new URL('../dist/index.js', import.meta.url).href);
let app = mount(shell);
if (typeof app.unmount !== 'function' || !app.Component) throw new Error('contrato mount() incompleto');
if (!agentReg) throw new Error('el agente no se registró');

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

// ── 1. Componentes (2 CPUs; 2 RAMs ALTERNATIVAS del mismo valor genérico) ──
await act('UPSERT_COMPONENT', { name: 'Cubierta Roble 120', type: 'material', cost: 120000, currency: 'CLP', tags: 'linea:nordica', supplierUrl: 'https://prov.cl/roble' });
await act('UPSERT_COMPONENT', { name: 'Cubierta Nogal 120', type: 'material', cost: 300, currency: 'USD', tags: 'linea:nordica', supplierUrl: 'https://prov.cl/nogal' });
await act('UPSERT_COMPONENT', { name: 'Módulo Estante A', type: 'capacidad', cost: 45000, specs: '5600MHz CL36', requires: 'certificado', stock: 5 });
await act('UPSERT_COMPONENT', { name: 'Módulo Estante B', type: 'capacidad', cost: 47000, specs: '5200MHz CL38', requires: 'certificado' });
await act('SET_MARGIN', { type: 'material', marginPct: 20 });
await act('SET_MARGIN', { type: 'default', marginPct: 30 });
await act('SET_COMPONENT_COST', { component: 'Cubierta Roble 120', cost: 110000 });

const snap = agentReg.getSnapshot();
const byName = (n) => snap.components.find((c) => c.name === n);
const r5 = byName('Cubierta Roble 120'), r7 = byName('Cubierta Nogal 120');
const ramA = byName('Módulo Estante A'), ramB = byName('Módulo Estante B');
// base 'cost': 110000×1.20×1.19=157080→157100 · 285000×1.20×1.19→407000 · 45000×1.30×1.19=69615→69600
expectEq('salePrice R5', r5.salePrice, 157100);
expectEq('salePrice R7', r7.salePrice, 407000);
expectEq('salePrice RAM-A', ramA.salePrice, 69600);
if (ramA.stock !== 5 || ramB.stock !== null) throw new Error('stock mal registrado');
if (!r5.verifiedAt) throw new Error('verifiedAt no quedó marcado');

// ── 2. Equipos: uno v2.1 (valores con alternativas) y uno v2.0 (migración) ──
store.set('eq-test', {
  id: 'eq-test', kind: 'producto', name: 'Mesa Nórdica 120', sku: 'PL-N1', status: 'active',
  extraCosts: [{ id: 'ec1', label: 'Armado', cost: 80000, currency: 'CLP' }],
  baseComponentIds: [],
  groups: [
    { id: 'g1', typeId: 'material', label: 'Cubierta', defaultValueId: 'v-r5', values: [
      { id: 'v-r5', label: 'Roble', componentIds: [r5.id] },
      { id: 'v-r7', label: 'Nogal', componentIds: [r7.id] },
    ] },
    { id: 'g2', typeId: 'capacidad', label: 'Estantes', defaultValueId: 'v-16', values: [
      { id: 'v-16', label: '2 estantes', componentIds: [ramA.id, ramB.id] },
    ] },
    // Paso sin alternativas disponibles: debe EXCLUIRSE de opciones, variantes
    // y JSON público (no puede llegar a Jumpseller una opción sin valores).
    { id: 'g3', typeId: 'accesorio', label: 'Accesorios', defaultValueId: 'v-ssd', values: [
      { id: 'v-ssd', label: 'Kit ruedas', componentIds: [] },
    ] },
  ],
  deliveryExtraDays: null, // vacío en el formulario → debe usar la regla global (3)
  productRef: { instanceId: 'p-inst', itemId: 'prod-1', sourceId: '424242', sku: 'PL-N1', name: 'Mesa Nórdica 120' },
  imageUrl: 'https://old/rota.png', // copia local obsoleta: debe refrescarse al aplicar
  storefront: { hero: { bgImageUrl: 'https://cdn/fondo.jpg', photoPos: 'right', photoVAlign: 'bottom', photoSize: 'l', float: true,
    items: [{ id: 'hi1', title: 'Terminación premium', text: 'Sellado premium', side: 'left' }] },
    specs: [{ id: 'sp1', group: 'Base', label: 'Estructura', value: 'Madera certificada' }] },
  price: 0,
});
store.set('eq-old', { // forma v2.0: componentIds directos + base{cost}
  id: 'eq-old', kind: 'producto', name: 'Mesa Legacy', status: 'active', price: 0,
  base: { cost: 50000, currency: 'CLP' },
  groups: [{ id: 'og1', typeId: 'material', label: 'Cubierta', componentIds: [r5.id], defaultId: r5.id }],
  // Builder con datos sucios: al guardar (recalc de equipo NO enlazado pasa
  // por saveEquipo) debe normalizarse — patrón inválido → clasico, bloque
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

// Remontar con useEffect real para que load() cargue los equipos
app.unmount();
const cleanups = [];
globalThis.React.useEffect = (fn) => { const c = fn(); if (typeof c === 'function') cleanups.push(c); };
app = mount(shell);
app.Component({});
await new Promise((res) => setTimeout(res, 100));

const snap2 = agentReg.getSnapshot();
const eqSnap = snap2.productos.find((e) => e.id === 'eq-test');
// armado 80000×1.25×1.19=119000 · R5 157080 · RAM-A (más barata disp.) 69615 → 345695 → 345990
expectEq('equipo computedPrice', eqSnap.computedPrice, 345990);
if (!eqSnap.linked) throw new Error('equipo debería estar enlazado');
if (!eqSnap.warnings.some((w) => w.indexOf('certificado') !== -1)) throw new Error('falta warning de compatibilidad ddr5');
// migración v2.0: 50000×1.25×1.19=74375 + 157080 = 231455 → 231990
const eqOld = snap2.productos.find((e) => e.id === 'eq-old');
expectEq('equipo migrado computedPrice', eqOld.computedPrice, 231990);

// ── 3. Aplicar a la tienda: variantes con precio por combinación ──
await act('RECALC_PRICES', { apply: true });
const saved = store.get('eq-test');
expectEq('price persistido', saved.price, 345990);
if (!saved.lastPush || saved.lastPush.status !== 'synced') throw new Error('lastPush no quedó synced');
expectEq('imageUrl refrescada desde la tienda', saved.imageUrl, 'https://cdn/x.png');
if (!saved.storefront || saved.storefront.hero.photoPos !== 'right' || saved.storefront.specs.length !== 1) throw new Error('la ficha de tienda (hero/specs) no se preservó al aplicar');
const prod = productsStore.get('prod-1');
expectEq('producto price', prod.price, 345990);
const optCpu = prod.options.find((o) => o.name === 'Cubierta');
if (optCpu.sourceOptionId !== '900') throw new Error('no se preservó sourceOptionId');
if (optCpu.values.find((v) => v.name === 'Roble').sourceValueId !== '901') throw new Error('no se preservó sourceValueId');
if (optCpu.values.some((v) => v.name.indexOf('Estante A') !== -1 || v.name.indexOf('Roble 120') !== -1)) throw new Error('los valores deben ser etiquetas genéricas sin marca');
const vR5 = prod.variants.find((v) => v.options['Cubierta'] === 'Roble');
const vR7 = prod.variants.find((v) => v.options['Cubierta'] === 'Nogal');
expectEq('variante R5', vR5.price, 345990);
expectEq('variante R7', vR7.price, 595990); // 119000+406980+69615=595595→595990
if (vR5.options['Estantes'] !== '2 estantes') throw new Error('variante sin la opción Estantes genérica');
expectEq('opciones aplicadas (paso sin valores disponibles excluido)', prod.options.length, 2);
if (prod.variants.some((v) => v.options['Accesorios'] != null)) throw new Error('las variantes no deben incluir el paso vacío');

// ── 3b. JSON público republicado: paso vacío fuera y días de armado por regla ──
const pubData = store.get('definition').public.data;
if (!pubData) throw new Error('el recálculo aplicado no republicó el JSON público');
const pubEq = pubData.productos.find((e) => e.sku === 'PL-N1');
expectEq('grupos publicados (paso vacío excluido)', pubEq.groups.length, 2);
expectEq('assemblyDays publicado (campo vacío → regla global)', pubEq.assemblyDays, 3);
expectEq('deliveryDays publicado (max entrega 0 + armado 3)', pubEq.deliveryDays, 3);

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
const pubLegacy = pubData.productos.find((e) => e.name === 'Mesa Legacy');
expectEq('builder publicado en el JSON (sección hero)', (pubLegacy.storefront.pageSections || []).filter((x) => x.kind === 'hero').length, 1);
const pubTabs = pubLegacy.storefront.tabs;
expectEq('tabs: orden por defecto publicado', (pubTabs.order || []).join(','), 'explorar,specs,fotos');
if (pubTabs.showSpecs !== true || pubTabs.showFotos !== true) throw new Error('tabs.showSpecs/showFotos deben ser true por defecto');

// ── 4. Alternativas: se agota la más barata → toma la siguiente disponible ──
await act('UPSERT_COMPONENT', { name: 'Módulo Estante A', stock: 0 });
await act('RECALC_PRICES', { apply: true });
// RAM-B 47000×1.30×1.19=72709 → 119000+157080+72709=348789 → 348990
expectEq('price tras agotarse RAM-A', store.get('eq-test').price, 348990);
expectEq('variante R5 actualizada', productsStore.get('prod-1').variants.find((v) => v.options['Cubierta'] === 'Roble').price, 348990);

// ── 5. Re-aplicar preserva sourceVariantId ──
const ids1 = productsStore.get('prod-1').variants.map((v) => v.sourceVariantId).sort();
await act('APPLY_PRODUCTO', { producto: 'Mesa Nórdica 120' });
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
expectEq('salePrice R5 (margen sobre venta)', agentReg.getSnapshot().components.find((c) => c.name === 'Cubierta Roble 120').salePrice, 163600);

// ── 7. Render profundo (componentes de función invocados) ──
globalThis.React.createElement = (t, p, ...c) => {
  if (typeof t === 'function') return t(Object.assign({}, p || {}, { children: c }));
  return { t, p, c };
};
const tree = app.Component({});
if (!tree || tree.p.className !== 'kimos-productlab') throw new Error('render raíz inesperado');
console.log('render profundo OK (' + store.size + ' items en el modelo)');

// ── 8. Tools nuevas del agente (v3.1): equipos, pasos, ficha, enlace, stock, publicación ──
await new Promise((res) => setTimeout(res, 50)); // drenar el load() pendiente del render de la sección 7
await act('UPSERT_PRODUCTO', { name: 'Mesa Agente', sku: 'PL-AG' });
await act('SET_PRODUCTO_STEPS', { producto: 'Mesa Agente', steps: [
  { label: 'Cubierta', type: 'material', default: 'Nogal', values: [
    { label: 'Roble', components: ['Cubierta Roble 120'] },
    { label: 'Nogal', components: ['Cubierta Nogal 120', 'NoExiste XYZ'] }, // inexistente → aviso, no error
  ] },
] });
const eqAg = Array.from(store.values()).find((x) => x.kind === 'producto' && x.name === 'Mesa Agente');
expectEq('agente: pasos creados', eqAg.groups.length, 1);
expectEq('agente: default por label', eqAg.groups[0].defaultValueId, eqAg.groups[0].values[1].id);
if (eqAg.groups[0].values[1].componentIds.length !== 1) throw new Error('el componente inexistente debía filtrarse');

await act('SET_STOREFRONT', { producto: 'Mesa Agente',
  pageSections: [{ kind: 'hero', pattern: 'apilado', bgImageUrl: 'https://cdn/fondo-agente.jpg', slots: { middle: [{ type: 'text', text: 'Hola', size: 'zz' }] } }],
  specs: [{ label: 'Material', value: 'Roble' }], photosNote: 'Nota agente' });
const sfAg = store.get(eqAg.id).storefront;
expectEq('agente: ficha normalizada (hero + specs/fotos/nota fijas)', sfAg.pageSections.length, 4);
expectEq('agente: tamaño de texto inválido normalizado a l', sfAg.pageSections[0].slots.middle[0].size, 'l');
expectEq('agente: nota guardada', sfAg.photosNote, 'Nota agente');
if ((store.get(eqAg.id).galleryImages || []).indexOf('https://cdn/fondo-agente.jpg') === -1) throw new Error('el fondo usado no se cosechó en la galería del equipo');

await act('LINK_PRODUCT', { producto: 'Mesa Agente', product: '424242' });
if (!store.get(eqAg.id).productRef || store.get(eqAg.id).productRef.itemId !== 'prod-1') throw new Error('LINK_PRODUCT no enlazó por id Jumpseller');

await act('SET_STOCK', { items: [{ component: 'Módulo Estante B', stock: 3 }, { component: 'Cubierta Roble 120', stock: null }] });
expectEq('agente: stock masivo aplicado', agentReg.getSnapshot().components.find((c) => c.name === 'Módulo Estante B').stock, 3);

await act('PUBLISH_CONFIG', { enabled: true });
if (store.get('definition').public.enabled !== true) throw new Error('PUBLISH_CONFIG no publicó');

const snapAg = agentReg.getSnapshot();
const seAg = snapAg.productos.find((e) => e.name === 'Mesa Agente');
if (!seAg.steps || seAg.steps[0].values[1].alternatives[0] !== 'Cubierta Nogal 120') throw new Error('snapshot sin pasos/alternativas');
if (!seAg.storefront || seAg.storefront.pageSections.length !== 4) throw new Error('snapshot sin storefront');
if (!snapAg.builderRef || snapAg.builderRef.patterns.length !== 12 || snapAg.builderRef.blockTypes.indexOf('html') === -1) throw new Error('builderRef ausente o incompleto');
const seN1 = snapAg.productos.find((e) => e.name === 'Mesa Nórdica 120' && e.linked);
expectEq('agente: galería del producto en snapshot', (seN1.productImages || []).length, 2);

// IMPORT_IMAGE: adjunto del chat (path del storage del equipo) → URL pública
// + con {equipo} queda también en la galería de ese equipo
const imp = await act('IMPORT_IMAGE', { url: 'chat/foto.png', name: 'foto.png', producto: 'Mesa Agente' });
if (imp.message.indexOf('/api/public/files/imagenes/productlab/') === -1) throw new Error('IMPORT_IMAGE no devolvió la URL pública');
const impUrl = imp.message.match(/https?:[^ ]+productlab\/[^ ]+/)[0];
if ((store.get(eqAg.id).galleryImages || []).indexOf(impUrl) === -1) throw new Error('IMPORT_IMAGE no dejó la imagen en la galería del equipo');
const galSnap = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Agente');
if ((galSnap.galleryImages || []).indexOf(impUrl) === -1 || galSnap.galleryImages.indexOf('https://cdn/fondo-agente.jpg') === -1) throw new Error('snapshot sin galleryImages del equipo');

// ── Robustez de payloads del agente (v3.3.1) ─────────────────────────────
// Los LLM del chat no ven siempre el schema exacto y mandan alias
// (equipoId/id/name) o el payload como string JSON. La app debe resolverlos
// igual, y ante una referencia mala devolver un error que liste los equipos
// para que el agente se autocorrija.
const alias1 = await act('SET_STOREFRONT', { productoId: 'Mesa Agente', photosNote: 'Nota vía alias' });
if (alias1.message.indexOf('Mesa Agente') === -1) throw new Error('alias equipoId no resolvió el equipo');
const alias2 = await act('APPLY_PRODUCTO', { id: 'Mesa Agente' });
if (alias2.message.indexOf('aplicado') === -1 && !alias2.success) throw new Error('alias id no resolvió el equipo');
const alias3 = await act('SET_STOREFRONT', JSON.stringify({ producto: 'PL-AG', photosNote: 'Nota vía sku + payload string' }));
if (alias3.message.indexOf('Mesa Agente') === -1) throw new Error('payload string / sku no resolvió el equipo');
const badRef = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'No Existe 9000', photosNote: 'x' } });
if (badRef.success || badRef.error.indexOf('Productos existentes') === -1 || badRef.error.indexOf('Mesa Agente') === -1) {
  throw new Error('el error de equipo no encontrado no lista los equipos existentes: ' + badRef.error);
}
const noRef = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { photosNote: 'x' } });
if (noRef.success || noRef.error.indexOf('Falta el campo "producto"') === -1) throw new Error('falta de referencia sin error didáctico: ' + noRef.error);
console.log('agente: alias de payload (equipoId/id/sku/string) y errores didácticos OK');

// ── Validación estricta del builder vía agente (v3.4.0) ──────────────────
// builderRef debe publicar el contrato completo (sectionShape/blockSchema/example)
const bref = agentReg.getSnapshot().builderRef;
if (!bref.sectionShape || !bref.blockSchema || !bref.blockSchema.items || !bref.example || bref.example.pattern !== 'clasico') {
  throw new Error('builderRef sin contrato completo (sectionShape/blockSchema/example)');
}
// Bloques con type inventado → rechazo con detalle (nada se pierde en silencio)
const badBlocks = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: { top: [{ type: 'feature-list', items: [{ title: 'X' }] }] } },
] } });
if (badBlocks.success || badBlocks.error.indexOf('type inválido "feature-list"') === -1 || badBlocks.error.indexOf('builderRef') === -1) {
  throw new Error('bloque inválido no rechazado con detalle: ' + JSON.stringify(badBlocks));
}
// Contenedor que no existe en el patrón → rechazo con las celdas válidas
const badCell = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: { arriba: [{ type: 'title' }] } },
] } });
if (badCell.success || badCell.error.indexOf('"arriba" no existe') === -1 || badCell.error.indexOf('top') === -1) {
  throw new Error('contenedor inválido no rechazado: ' + JSON.stringify(badCell));
}
// "blocks" en vez de "slots" → rechazo que enseña la clave correcta
const badKey = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', blocks: [{ type: 'title' }] },
] } });
if (badKey.success || badKey.error.indexOf('"slots"') === -1) throw new Error('clave blocks no detectada: ' + JSON.stringify(badKey));
// Payload bien formado (según builderRef.example) → guarda y detalla los bloques
const goodSf = await act('SET_STOREFRONT', { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', height: 'l', bgColor: '#1D1D1B', slots: {
    top: [{ type: 'title' }, { type: 'text', text: 'Potencia total', size: 'xl' }],
    center: [{ type: 'photo', size: 'l' }],
    right: [{ type: 'cta', label: 'Configurar' }],
  } },
  { kind: 'specs', show: true }, { kind: 'fotos', show: true }, { kind: 'note', show: true },
] });
if (goodSf.message.indexOf('Detalle: hero 1 [clasico]') === -1 || goodSf.message.indexOf('top: title+text') === -1) {
  throw new Error('mensaje sin detalle de bloques: ' + goodSf.message);
}
// Anti-borrado: vaciar una ficha con bloques requiere allowEmpty:true
const wipe = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: {} }, { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] } });
if (wipe.success || wipe.error.indexOf('allowEmpty') === -1) throw new Error('guardia anti-borrado no actuó: ' + JSON.stringify(wipe));
const wipeOk = await act('SET_STOREFRONT', { producto: 'Mesa Agente', allowEmpty: true, pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: {} }, { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] });
if (!wipeOk.success) throw new Error('allowEmpty no permitió vaciar: ' + JSON.stringify(wipeOk));
// v3.5.1: bloques bajo una clave equivocada (content) o hero sin ningún bloque
// válido → rechazo con ejemplo inline (antes se guardaba "con éxito" vacío)
const badContent = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', content: [{ type: 'title' }, { type: 'items', items: [{ title: 'X' }] }] },
  { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] } });
if (badContent.success || badContent.error.indexOf('"content" no existe') === -1) throw new Error('clave content no detectada: ' + JSON.stringify(badContent));
const emptyHero = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', bgImageUrl: 'https://cdn/f.jpg' }, { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
] } });
if (emptyHero.success || emptyHero.error.indexOf('SIN ningún bloque válido') === -1 || emptyHero.error.indexOf('Ejemplo mínimo') === -1) {
  throw new Error('hero sin bloques no rechazado con ejemplo: ' + JSON.stringify(emptyHero));
}
const badSlotsArr = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Agente', pageSections: [
  { kind: 'hero', pattern: 'clasico', slots: ['top', 'left', 'center'] },
] } });
if (badSlotsArr.success || badSlotsArr.error.indexOf('OBJETO') === -1) throw new Error('slots como lista no detectado: ' + JSON.stringify(badSlotsArr));
console.log('agente: validación estricta del builder (rechazos didácticos + anti-borrado + detalle) OK');

// ── COMPOSE_HERO (v3.6.0): campos planos → la app compone la estructura ──
const composed = await act('COMPOSE_HERO', { producto: 'Mesa Agente', headline: 'Crea sin límites',
  features: [{ title: 'Textura a elección' }, { title: 'Hecho a medida', text: 'Producción local' }],
  ctaLabel: 'Configura el tuyo', bgColor: '#1D1D1B', pattern: 'clasico' });
if (composed.message.indexOf('2 características') === -1 || composed.message.indexOf('[clasico]') === -1) {
  throw new Error('COMPOSE_HERO sin detalle esperado: ' + composed.message);
}
const composedEq = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Agente');
const composedHero = composedEq.storefront.pageSections.find((x) => x.kind === 'hero');
const nBlocks = Object.keys(composedHero.slots).reduce((a, k) => a + composedHero.slots[k].length, 0);
if (nBlocks < 4) throw new Error('COMPOSE_HERO dejó pocos bloques: ' + nBlocks);
if (!composedHero.slots.center || composedHero.slots.center[0].type !== 'photo') throw new Error('foto no quedó al centro');
if (!composedHero.slots.left || composedHero.slots.left[0].type !== 'items' || composedHero.slots.left[0].items.length !== 2) throw new Error('features no quedaron como items');
if (!composedHero.slots.bottom || composedHero.slots.bottom[0].type !== 'cta') throw new Error('CTA no quedó abajo');
// Reemplazo del mismo hero conservando el fondo cuando no se envía uno nuevo
const composed2 = await act('COMPOSE_HERO', { producto: 'Mesa Agente', headline: 'Silencio total', features: [{ title: 'Textura roble' }] });
const hero2 = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Agente').storefront.pageSections.filter((x) => x.kind === 'hero');
if (hero2.length !== 1) throw new Error('COMPOSE_HERO duplicó heros: ' + hero2.length);
if (hero2[0].bgColor !== '#1D1D1B') throw new Error('no conservó el fondo: ' + hero2[0].bgColor);
// v3.6.1: reparto de features entre ambos laterales
const split = await act('COMPOSE_HERO', { producto: 'Mesa Agente', headline: 'Reparto', featuresRightCount: 2,
  features: [{ title: 'F1' }, { title: 'F2' }, { title: 'F3' }, { title: 'F4' }, { title: 'F5' }] });
const splitHero = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Agente').storefront.pageSections.find((x) => x.kind === 'hero');
if (splitHero.slots.left[0].items.length !== 3 || !splitHero.slots.right || splitHero.slots.right[0].items.length !== 2) {
  throw new Error('reparto incorrecto: izq=' + splitHero.slots.left[0].items.length + ' der=' + (splitHero.slots.right && splitHero.slots.right[0] ? splitHero.slots.right[0].items.length : 0));
}
console.log('agente: COMPOSE_HERO (composición plana, reemplazo, fondo conservado y reparto 3/2) OK');

// ── Dropshipping (v3.5.0): impuesto %, entrega en serie, producto sin pasos ──
// Impuesto adicional %: se suma al costo ANTES del margen — misma base, +10%.
await act('UPSERT_COMPONENT', { name: 'Quest Base', type: 'other', cost: 100000, currency: 'CLP', deliveryDays: 12 });
await act('UPSERT_COMPONENT', { name: 'Quest Taxed', type: 'other', cost: 100000, currency: 'CLP', taxPct: 10, deliveryDays: 12 });
await act('UPSERT_COMPONENT', { name: 'Courier Local', type: 'other', cost: 8000, currency: 'CLP', deliveryDays: 3 });
const snapTax = agentReg.getSnapshot();
const cBase = snapTax.components.find((c) => c.name === 'Quest Base');
const cTax = snapTax.components.find((c) => c.name === 'Quest Taxed');
const ratio = cTax.salePrice / cBase.salePrice;
if (cTax.taxPct !== 10 || ratio < 1.08 || ratio > 1.12) throw new Error('taxPct no afecta el precio (~+10%): ' + cBase.salePrice + ' → ' + cTax.salePrice);

// Entrega en serie: 12 + 3 = 15 (con extra 0) vs 12 en paralelo.
await act('UPSERT_PRODUCTO', { name: 'Drop One', sku: 'DROP-1', deliveryExtraDays: 0, deliveryMode: 'sum' });
await act('SET_PRODUCTO_STEPS', { producto: 'Drop One', steps: [
  { label: 'Producto', values: [{ label: 'Quest Taxed', components: ['Quest Taxed'] }] },
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
await act('LINK_PRODUCT', { producto: 'Drop One', product: 'Mesa Nórdica 120' });
const applySimple = await act('APPLY_PRODUCTO', { producto: 'Drop One' });
if (applySimple.message.indexOf('producto simple sin variantes') === -1) throw new Error('APPLY sin pasos no aplicó como producto simple: ' + applySimple.message);

// Publicación: deliveryMode y baseDeliveryDays viajan al theme.
await act('PUBLISH_CONFIG', { enabled: true });
const pubDrop = store.get('definition').public.data.productos.find((e) => e.sku === 'DROP-1');
if (!pubDrop || pubDrop.deliveryMode !== 'sum' || typeof pubDrop.baseDeliveryDays !== 'number' || (pubDrop.groups || []).length !== 0) {
  throw new Error('JSON público sin deliveryMode/baseDeliveryDays o con grupos fantasma: ' + JSON.stringify(pubDrop && { m: pubDrop.deliveryMode, b: pubDrop.baseDeliveryDays, g: (pubDrop.groups || []).length }));
}
console.log('dropshipping: impuesto % (+' + Math.round((ratio - 1) * 100) + '%), entrega sum/max (15d/12d), producto sin pasos aplicado y publicado OK');

// ── ProductLab: cantidades (qty), valores neutros y pasos dependientes ─────
await act('UPSERT_COMPONENT', { name: 'Módulo Cajón', type: 'accesorio', cost: 20000, currency: 'CLP', stock: 3, deliveryDays: 2 });
await act('UPSERT_PRODUCTO', { name: 'Mesa Modular', sku: 'PL-MOD', deliveryExtraDays: 0 });
await act('SET_PRODUCTO_STEPS', { producto: 'Mesa Modular', steps: [
  { label: 'Cubierta', type: 'material', default: 'Roble', values: [
    { label: 'Roble', components: ['Cubierta Roble 120'] },
    { label: 'Nogal', components: ['Cubierta Nogal 120'] },
  ] },
  // Paso DEPENDIENTE: solo visible con cubierta Roble; default NEUTRO ($0);
  // "2 cajones" usa el MISMO componente ×2 (cantidad); "4 cajones" excede el
  // stock (3) y debe quedar no disponible.
  { label: 'Cajones', type: 'accesorio', default: 'Sin cajones', dependsOn: { step: 'Cubierta', values: ['Roble'] }, values: [
    { label: 'Sin cajones', neutral: true, components: [] },
    { label: '2 cajones', qty: 2, components: ['Módulo Cajón'] },
    { label: '4 cajones', qty: 4, components: ['Módulo Cajón'] },
  ] },
] });
const seMod = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Modular');
const stepCaj = seMod.steps[1];
if (!stepCaj.dependsOn || stepCaj.dependsOn.step !== 'Cubierta' || stepCaj.dependsOn.values.join(',') !== 'Roble') {
  throw new Error('dependsOn no quedó en el snapshot: ' + JSON.stringify(stepCaj.dependsOn));
}
const vSin = stepCaj.values.find((v) => v.label === 'Sin cajones');
const v2c = stepCaj.values.find((v) => v.label === '2 cajones');
const v4c = stepCaj.values.find((v) => v.label === '4 cajones');
if (!vSin.neutral || !vSin.available || vSin.delta !== 0) throw new Error('valor neutro incorrecto: ' + JSON.stringify(vSin));
expectEq('qty persistida', v2c.qty, 2);
// margen sobre venta (sección 6): 20000÷0.70×1.19 = 34000 × 2 = 68000
expectEq('delta 2 cajones (precio × cantidad)', v2c.delta, 68000);
if (v4c.available) throw new Error('"4 cajones" (qty 4 > stock 3) debía quedar no disponible');

await act('PUBLISH_CONFIG', { enabled: true });
const pubAll = store.get('definition').public.data;
expectEq('JSON público version', pubAll.version, 2);
const pubMod = pubAll.productos.find((e) => e.sku === 'PL-MOD');
const pubCaj = pubMod.groups.find((g) => g.label === 'Cajones');
if (!pubCaj.dependsOn || pubCaj.dependsOn.groupId !== pubMod.groups[0].id || pubCaj.dependsOn.valueIds.length !== 1) {
  throw new Error('dependsOn no publicado: ' + JSON.stringify(pubCaj.dependsOn));
}
expectEq('valores publicados de Cajones (sin stock suficiente excluido)', pubCaj.values.length, 2);
expectEq('qty publicada', pubCaj.values.find((v) => v.name === '2 cajones').qty, 2);
if (pubCaj.values.find((v) => v.name === 'Sin cajones').neutral !== true) throw new Error('neutral no publicado');
console.log('ProductLab: qty, valores neutros y dependencias (snapshot + publicación) OK');

// ── ProductLab: visualizador 3D (SET_MODEL3D) ──────────────────────────────
await act('SET_MODEL3D', { producto: 'Mesa Modular', enabled: true, viewerUrl: 'https://viewer.local/', modelUrl: 'https://cdn/mesa.glb', bindStep: 'Cubierta',
  config: { parts: [{ id: 'sup', label: 'Superficie', materials: ['M1'] }], finishes: [{ id: 'roble', label: 'Roble', color: '#ffffff', texture: 'https://cdn/roble.webp', roughness: 0.7, textureScale: 0.09, grain: 0.3 }] } });
const m3 = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Modular').model3d;
if (!m3.enabled || m3.bindStep !== 'Cubierta' || !m3.hasConfig || m3.embedUrl.indexOf('def=') === -1 || m3.embedUrl.indexOf('producto=PL-MOD') === -1) {
  throw new Error('SET_MODEL3D incompleto: ' + JSON.stringify(m3));
}
const badBind = await agentReg.dispatchAction({ type: 'SET_MODEL3D', payload: { producto: 'Mesa Modular', bindStep: 'No Existe' } });
if (badBind.success || badBind.error.indexOf('Cubierta') === -1) throw new Error('bindStep inválido sin error didáctico: ' + JSON.stringify(badBind));
await act('PUBLISH_CONFIG', { enabled: true });
const pubM3 = store.get('definition').public.data.productos.find((e) => e.sku === 'PL-MOD').model3d;
if (!pubM3 || pubM3.modelUrl !== 'https://cdn/mesa.glb' || !pubM3.config || pubM3.embedUrl.indexOf('viewer.local') === -1) {
  throw new Error('model3d no publicado: ' + JSON.stringify(pubM3));
}
console.log('ProductLab: visualizador 3D configurado y publicado OK');

// ── ProductLab: secciones imagen (alto adaptable) + visor3d + estilo ───────
await act('SET_STOREFRONT', { producto: 'Mesa Modular', pageSections: [
  { kind: 'hero', pattern: 'clasico', height: 'auto', slots: { top: [{ type: 'title' }], center: [{ type: 'photo', size: 'auto' }] } },
  { kind: 'imagen', imageUrl: 'https://cdn/desc-1.png', width: 'full' },
  { kind: 'imagen', imageUrl: 'https://cdn/desc-2.png' },
  { kind: 'visor3d', height: 520 },
  { kind: 'specs' }, { kind: 'fotos' }, { kind: 'note' },
], style: { accentColor: '#0FA36B', radius: 8, cardStyle: 'compact', showDeltas: 'total' } });
const sfMod = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Modular').storefront;
const imgSecs = sfMod.pageSections.filter((x) => x.kind === 'imagen');
if (imgSecs.length !== 2 || imgSecs[0].width !== 'full' || imgSecs[1].width !== 'content') throw new Error('secciones imagen mal normalizadas: ' + JSON.stringify(imgSecs));
const v3sec = sfMod.pageSections.find((x) => x.kind === 'visor3d');
if (!v3sec || v3sec.height !== 520) throw new Error('sección visor3d mal normalizada: ' + JSON.stringify(v3sec));
const heroAuto = sfMod.pageSections.find((x) => x.kind === 'hero');
if (heroAuto.height !== 'auto' || heroAuto.slots.center[0].size !== 'auto') throw new Error('alturas auto no persistieron: ' + heroAuto.height + '/' + heroAuto.slots.center[0].size);
if (sfMod.style.accentColor !== '#0FA36B' || sfMod.style.radius !== 8 || sfMod.style.cardStyle !== 'compact' || sfMod.style.showDeltas !== 'total') {
  throw new Error('style no persistió: ' + JSON.stringify(sfMod.style));
}
const badImg = await agentReg.dispatchAction({ type: 'SET_STOREFRONT', payload: { producto: 'Mesa Modular', pageSections: [{ kind: 'imagen' }] } });
if (badImg.success || badImg.error.indexOf('imageUrl') === -1) throw new Error('sección imagen sin URL no rechazada: ' + JSON.stringify(badImg));
console.log('ProductLab: secciones imagen (alto adaptable), visor3d, alturas auto y estilo OK');

console.log('\nTodo OK ✔ — precios (ambas bases de margen), alternativas por disponibilidad, stock, migración, variantes por combinación, qty, valores neutros, dependencias, visualizador 3D, secciones imagen/estilo y agente completo');
cleanups.forEach((c) => c());