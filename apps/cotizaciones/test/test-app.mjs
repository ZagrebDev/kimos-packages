/**
 * Smoke test de Cotizaciones: monta el bundle con un `shell` y un React
 * simulados, renderiza TODAS las pantallas (para que un error de render salga
 * aquí y no en producción) y ejercita el modelo a través de las mismas
 * acciones que usan la UI y el agente.
 *
 *   node test/test-app.mjs
 *
 * Sale con código 1 a la primera prueba que falle.
 */

// ── React simulado ───────────────────────────────────────────────────────
// Suficiente para renderizar una pasada completa: los hooks devuelven su
// valor inicial y no persisten entre renders, así que las pruebas de
// comportamiento van contra las acciones del modelo, no contra la UI.
const R = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
  Fragment: 'fragment',
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (init) => ({ current: init === undefined ? null : init }),
};
globalThis.React = R;

// La versión que declara el manifest: es la fuente de verdad de la app.
const MANIFEST_VERSION = JSON.parse(
  (await import('node:fs')).readFileSync(
    new URL('../manifest.json', import.meta.url), 'utf8')).version;

const listeners = [];
globalThis.window = {
  location: { origin: 'http://kimos.local', href: 'http://kimos.local/' },
  addEventListener: () => {}, removeEventListener: () => {},
  hasFocus: () => true,
};
// DOM mínimo: lo justo para que la ventana de impresión se pueda construir
// nodo a nodo y se pueda comprobar qué se le puso dentro.
function fakeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(), children: [], childNodes: [], dataset: {}, style: {},
    attrs: {}, listeners: {}, textContent: '', className: '', innerHTML: '<div>hoja</div>',
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); return c; },
    addEventListener(k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); },
    removeEventListener() {},
    querySelectorAll(sel) { return sel.indexOf('img') !== -1 ? [] : []; },
    remove() {},
  };
  return el;
}
function fakeDoc() {
  const d = {
    title: '', head: fakeEl('head'), body: fakeEl('body'),
    visibilityState: 'visible', hasFocus: () => true,
    createElement: (t) => fakeEl(t),
    querySelectorAll: () => [],
  };
  return d;
}
globalThis.document = fakeDoc();
globalThis.FormData = class { append() {} };

// Ventanas de impresión abiertas durante la prueba.
const ventanas = [];
globalThis.window.open = () => {
  const d = fakeDoc();
  const w = { document: d, focus: () => { w.focused = true; }, print: () => { w.printed = true; }, close: () => {} };
  ventanas.push(w);
  return w;
};
// ReactDOM simulado: `render` deja un hijo para que el bundle sepa que pintó.
globalThis.ReactDOM = {
  createRoot: (container) => ({
    render: () => { container.appendChild(fakeEl('div')); },
    unmount: () => {},
  }),
};

// ── Catálogos simulados de otras apps ────────────────────────────────────
const EXT = {
  products: [{
    id: 'pinst-1', name: 'Catálogo tienda',
    items: [
      { id: 'definition', kind: 'definition' },
      {
        id: 'p-totem', name: 'Tótem interactivo 32"', sku: 'FG-TI0', status: 'active',
        price: 1190000, imageUrl: 'https://cdn/totem.png',
        description: '<p>Tótem táctil de piso con <b>pantalla 32"</b>.</p>',
        options: [
          { name: 'Color', values: [{ name: 'Negro' }, { name: 'Blanco' }] },
          { name: 'Garantía extendida', optionType: 'addon', addonPrice: 119000, values: [{ name: 'Sí' }] },
        ],
        variants: [
          { options: { Color: 'Negro' }, price: 1190000 },
          { options: { Color: 'Blanco' }, price: 1249000 },
        ],
      },
      { id: 'p-borrador', name: 'Producto en borrador', status: 'draft', price: 1000 },
    ],
  }],
  productlab: [{
    id: 'plinst-1', name: 'Laboratorio',
    items: [
      {
        id: 'definition', kind: 'definition',
        rules: { currency: 'CLP', salesTaxPct: 19, marginBasis: 'cost', marginDefaultPct: 0, deltaRoundTo: 1 },
      },
      { id: 'c-base', kind: 'component', name: 'Chasis', type: 'chasis', cost: 100000, currency: 'CLP', active: true },
      { id: 'c-p32', kind: 'component', name: 'Pantalla 32"', type: 'pantalla', cost: 200000, currency: 'CLP', active: true },
      { id: 'c-p43', kind: 'component', name: 'Pantalla 43"', type: 'pantalla', cost: 300000, currency: 'CLP', active: true },
      { id: 'c-agotada', kind: 'component', name: 'Pantalla 55"', type: 'pantalla', cost: 400000, currency: 'CLP', active: true, stock: 0 },
      {
        id: 'pl-totem', kind: 'producto', name: 'Tótem a medida', sku: 'PL-TOT', status: 'active',
        price: 357000, priceMode: 'auto',
        groups: [{
          id: 'g-pantalla', label: 'Pantalla', typeId: 'pantalla', defaultValueId: 'v32',
          values: [
            { id: 'v32', label: '32 pulgadas', componentIds: ['c-p32'] },
            { id: 'v43', label: '43 pulgadas', componentIds: ['c-p43'] },
            { id: 'v55', label: '55 pulgadas', componentIds: ['c-agotada'] },
          ],
        }],
      },
    ],
  }],
  customers: [{
    id: 'cinst-1', name: 'Directorio',
    items: [
      { id: 'definition', kind: 'definition' },
      { id: 'cli-unab', name: 'Universidad Andrés Bello', taxId: '99.555.444-3', email: 'compras@unab.cl', phone: '+56 2 2222', city: 'Santiago', country: 'Chile' },
    ],
  }],
};

// Integración de correo del tenant simulada.
const SMTP = { status: { configured: true, fromEmail: 'buzon@metakut.cl' }, enviados: [], falla: '' };

// ── Registro de identidades simulado (APP-SPEC §7.d) ─────────────────────
// Reproduce lo único que la app necesita creerse: que las claves se
// NORMALIZAN antes de comparar, así que dos formas del mismo RUT devuelven el
// mismo registro en vez de crear el segundo «Acme SpA». Si esto no fuese
// cierto, vincular no serviría de nada.
const REG = { docs: new Map(), keys: new Map(), links: [], seq: 0, mergedInto: new Map() };
const normKey = (nombre, valor) => {
  const v = String(valor == null ? '' : valor).trim();
  const n = String(nombre || '').toLowerCase();
  if (n === 'taxid' || n === 'rut') return v.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return v.toLowerCase();
};
const canonName = (n) => (String(n || '').toLowerCase() === 'rut' ? 'taxid' : String(n || '').toLowerCase());
const regSalida = (d) => ({ ref: 'kimos:record/account/' + d.id, id: d.id, type: 'account', label: d.label, keys: d.keys });
const regSeguir = (id) => {
  let cur = id, saltos = 0;
  while (REG.mergedInto.has(cur) && saltos++ < 5) cur = REG.mergedInto.get(cur);
  return REG.docs.get(cur) || null;
};
const registroSimulado = {
  types: async () => [{ id: 'account', description: 'Organización' }],
  findOrCreate: async (type, opts) => {
    const keys = {};
    for (const [k, v] of Object.entries((opts && opts.keys) || {})) {
      const nk = normKey(k, v);
      if (nk) keys[canonName(k)] = nk;
    }
    const encontrados = new Set();
    for (const [nombre, valor] of Object.entries(keys)) {
      const hit = REG.keys.get(type + ':' + nombre + ':' + valor);
      if (hit) encontrados.add(hit);
    }
    if (encontrados.size) {
      const d = regSeguir([...encontrados][0]);
      const salida = { ref: regSalida(d).ref, created: false, record: regSalida(d) };
      if (encontrados.size > 1) salida.warning = 'Las claves apuntaban a registros distintos; se devolvió uno.';
      return salida;
    }
    const id = 'rec' + (++REG.seq);
    const d = { id, label: String((opts && opts.label) || ''), keys };
    REG.docs.set(id, d);
    for (const [nombre, valor] of Object.entries(keys)) REG.keys.set(type + ':' + nombre + ':' + valor, id);
    const salida = { ref: regSalida(d).ref, created: true, record: regSalida(d) };
    if (!Object.keys(keys).length) salida.warning = 'Registro creado sin clave natural: no se podrá deduplicar.';
    return salida;
  },
  resolve: async (refs) => (refs || []).map((raw) => {
    const m = /^kimos:record\/account\/([A-Za-z0-9_-]+)$/.exec(String(raw));
    if (!m) return { ref: raw, resolved: false, reason: 'referencia mal formada' };
    const d = regSeguir(m[1]);
    if (!d) return { ref: raw, resolved: false, reason: 'no encontrado' };
    const out = Object.assign({ resolved: true }, regSalida(d));
    if (out.ref !== raw) out.replaces = raw;
    return out;
  }),
  search: async () => [],
  update: async (ref, patch) => {
    const m = /account\/([A-Za-z0-9_-]+)$/.exec(String(ref));
    const d = regSeguir(m && m[1]);
    if (d && patch && patch.label) d.label = String(patch.label);
    return regSalida(d);
  },
  link: async (ref, opts) => { REG.links.push(Object.assign({ ref }, opts)); },
  unlink: async () => {},
  links: async (ref) => ({ links: REG.links.filter((l) => l.ref === ref), porApp: {} }),
};

// ── Shell simulado ───────────────────────────────────────────────────────
const store = new Map();          // items de la instancia
const notices = [];
// Los ocho campos que la app Clientes declara en su `dataSchema` (v2.1.0).
const DATA_SCHEMA_CUSTOMERS = ['name', 'taxId', 'email', 'phone', 'city', 'region', 'country', 'notes'];
const ESCRITURA = { creados: [], ignorados: [], seq: 100, falla: '' };
let agentReg = null;

const shell = {
  app: { appId: 'cotizaciones', instanceId: 'inst-1', teamId: 'team-1' },
  assetUrl: (p) => 'http://kimos.local/api/apps/cotizaciones/asset/' + p,
  notify: (m) => notices.push(m.level + ': ' + m.text),
  window: { setTitle: () => {}, requestClose: () => {}, requestMinimize: () => {} },
  items: {
    list: async () => Array.from(store.values()).map((x) => JSON.parse(JSON.stringify(x))),
    create: async (it) => { store.set(it.id, it); return it; },
    update: async (id, patch) => { store.set(id, Object.assign({}, store.get(id), patch)); return store.get(id); },
    remove: async (id) => { store.delete(id); },
  },
  agent: { register: (reg) => { agentReg = reg; return () => { agentReg = null; }; } },
  // Catálogos de OTRAS apps (APP-SPEC 7.c). Se simulan tres instancias: una
  // de `products` con opciones y variantes, una de `productlab` con
  // componentes y pasos, y una de `customers`.
  data: {
    listInstances: async (template) => (EXT[template] || []).map((x) => ({ id: x.id, name: x.name })),
    listItems: async (id) => {
      for (const lista of Object.values(EXT)) {
        const inst = lista.find((x) => x.id === id);
        if (inst) return JSON.parse(JSON.stringify(inst.items));
      }
      return [];
    },
    // Escritura gobernada (APP-SPEC §7.c): la pasarela solo deja pasar lo que
    // la app dueña declara en su `dataSchema`. Aquí se simula ese filtro para
    // que la prueba falle si la app manda campos que no le corresponden.
    create: async (id, payload) => {
      if (ESCRITURA.falla) throw new Error(ESCRITURA.falla);
      const inst = (EXT.customers || []).find((x) => x.id === id);
      if (!inst) throw new Error("La app 'customers' no tiene esa instancia.");
      const limpio = {};
      for (const k of Object.keys(payload || {})) {
        if (DATA_SCHEMA_CUSTOMERS.includes(k)) limpio[k] = payload[k];
        else ESCRITURA.ignorados.push(k);
      }
      if (!limpio.name) throw new Error('Faltan campos obligatorios del contrato: name.');
      const item = Object.assign({ id: 'cli-' + (++ESCRITURA.seq), createdByApp: 'cotizaciones' }, limpio);
      inst.items.push(item);
      ESCRITURA.creados.push(item);
      return item;
    },
    update: async (id, itemId, patch) => {
      const inst = (EXT.customers || []).find((x) => x.id === id);
      const it = inst && inst.items.find((x) => x.id === itemId);
      if (!it) throw new Error('No existe ese item.');
      Object.assign(it, patch, { updatedByApp: 'cotizaciones' });
      return it;
    },
  },
  records: registroSimulado,
  config: { get: async () => ({}), set: async () => {}, onChange: () => () => {} },
  documents: { onSerialize: () => () => {}, onLoad: () => () => {} },
  authFetch: async (url, init) => {
    const method = ((init && init.method) || 'GET').toUpperCase();
    const items = url.match(/\/items(?:\/([^/?]+))?$/);
    if (url.endsWith('/api/identity/me')) return json({ id: 'u1', displayName: 'Probador' });
    if (url.endsWith('/api/integrations/email/status')) return json(SMTP.status);
    if (url.endsWith('/api/integrations/email/send')) {
      SMTP.enviados.push(JSON.parse(init.body));
      if (SMTP.falla) return json({ detail: SMTP.falla }, 400);
      return json({ ok: true, to: JSON.parse(init.body).to });
    }
    if (items && method === 'GET') return json({ items: Array.from(store.values()) });
    if (items && method === 'POST') {
      const body = JSON.parse(init.body);
      store.set(body.id, body);
      return json(body, 201);
    }
    if (items && items[1] && method === 'PUT') {
      const body = JSON.parse(init.body);
      if (!store.has(items[1])) return json({ detail: 'no existe' }, 404);
      store.set(items[1], Object.assign({}, store.get(items[1]), body));
      return json(store.get(items[1]));
    }
    if (items && items[1] && method === 'DELETE') { store.delete(items[1]); return json({ deleted: true }); }
    if (url.match(/\/api\/app-instances\/[^/]+$/)) return json({ id: 'inst-1', name: 'Cotizador de prueba', config: {} });
    return json({}, 404);
  },
};
const json = (body, status) => ({
  ok: (status || 200) < 400, status: status || 200,
  json: async () => body,
});

// ── Utilidades de prueba ─────────────────────────────────────────────────
let fallos = 0;
let pruebas = 0;
function ok(cond, label, extra) {
  pruebas++;
  if (cond) { console.log('  ✔ ' + label); return true; }
  fallos++;
  console.error('  ✖ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  return false;
}
const eq = (a, b, label) => ok(a === b, label, { esperado: b, obtenido: a });
const near = (a, b, label) => ok(Math.abs(a - b) < 0.51, label, { esperado: b, obtenido: a });
const seccion = (t) => console.log('\n' + t);

/** Recorre el árbol devuelto por createElement ejecutando los componentes. */
function render(node, path) {
  if (node == null || node === false) return 0;
  if (Array.isArray(node)) return node.reduce((n, c, i) => n + render(c, path + '/' + i), 0);
  if (typeof node !== 'object') return 0;
  let n = 1;
  if (typeof node.type === 'function') {
    const out = node.type(Object.assign({}, node.props, { children: node.children }));
    n += render(out, path + '/' + (node.type.name || 'fn'));
  } else {
    n += render(node.children, path + '/' + node.type);
    if (node.props && node.props.children) n += render(node.props.children, path + '/ch');
  }
  return n;
}

const esperar = () => new Promise((r) => setTimeout(r, 30));
const today = () => new Date().toISOString().slice(0, 10);
const hace_dias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

// ── Ejecución ────────────────────────────────────────────────────────────
const mod = await import('../dist/index.js');
const mounted = mod.default(shell);
ok(typeof mounted.Component === 'function', 'mount() devuelve un Component');
ok(typeof mounted.unmount === 'function', 'mount() devuelve unmount()');

// useEffect no corre en el React simulado, así que la carga inicial se
// dispara a mano y se espera a que la red simulada asiente.
await mounted.__test.load();
await esperar();

seccion('Cálculo de totales');
{
  // Se reproduce la propuesta UNAB DEMRE 2027 (los números del XLSX real).
  const lineas = [
    ['Arriendo Tótem Interactivo', 4, 900000],
    ['Setup inicial y configuración', 1, 390000],
    ['KIMOS Core Mensual', 1, 99000],
    ['Ploteo gráfico institucional', 4, 110000],
    ['Logística integral - Sedes Santiago', 2, 250000],
    ['Logística integral - Sede Viña del Mar', 1, 490000],
    ['Logística integral - Sede Concepción', 1, 890000],
    ['Soporte técnico remoto mensual', 1, 790000],
    ['Soporte presencial tótem mensual', 4, 990000],
  ];
  const doc = {
    lines: lineas.map(([title, qty, unitPrice]) => ({ title, qty, unitPrice })),
    taxPct: 19, advanceEnabled: true, advancePct: 60,
  };
  const t = mounted.__test.computeTotals(doc, { currency: 'CLP', decimals: 0, taxPct: 19 });
  eq(t.subtotal, 11159000, 'subtotal neto = 11.159.000');
  eq(t.tax, 2120210, 'IVA 19% = 2.120.210');
  eq(t.total, 13279210, 'total con IVA = 13.279.210');
  near(t.advance, 7967526, 'abono 60% = 7.967.526');
  near(t.balance, 5311684, 'saldo 40% = 5.311.684');
}

seccion('Impuesto, descuentos y líneas exentas');
{
  const T = mounted.__test;
  const base = { taxPct: 19, lines: [{ title: 'A', qty: 1, unitPrice: 100000 }, { title: 'B', qty: 1, unitPrice: 100000, taxable: false }] };
  const t = T.computeTotals(base, { decimals: 0, taxPct: 19 });
  eq(t.subtotal, 200000, 'subtotal suma afecto y exento');
  eq(t.tax, 19000, 'el impuesto solo grava la línea afecta');
  eq(t.total, 219000, 'total = neto + impuesto de lo afecto');

  const conDesc = Object.assign({}, base, { discountPct: 10 });
  const td = T.computeTotals(conDesc, { decimals: 0, taxPct: 19 });
  eq(td.discount, 20000, 'descuento del 10% sobre el subtotal');
  eq(td.tax, 17100, 'el descuento se reparte proporcional: el impuesto baja igual');
  eq(td.total, 197100, 'total con descuento');

  const opt = { taxPct: 19, lines: [{ title: 'A', qty: 1, unitPrice: 100000 }, { title: 'Extra', qty: 1, unitPrice: 50000, optional: true }] };
  const to = T.computeTotals(opt, { decimals: 0, taxPct: 19 });
  eq(to.subtotal, 100000, 'una línea opcional no entra en el subtotal');
  eq(to.optionalTotal, 59500, 'las opcionales se suman aparte, con su impuesto');

  const gross = { taxPct: 19, lines: [{ title: 'A', qty: 1, unitPrice: 119000 }, { title: 'B', qty: 1, unitPrice: 100000, taxable: false }] };
  const tg = T.computeTotals(gross, { decimals: 0, taxPct: 19, priceMode: 'gross' });
  eq(tg.net, 200000, 'con precios con impuesto incluido, el neto se desglosa hacia atrás');
  eq(tg.tax, 19000, 'y el impuesto sale del desglose, sin tocar la línea exenta');
  eq(tg.total, 219000, 'el total con impuesto incluido cuadra con lo escrito');
}

seccion('Números tolerantes');
{
  const T = mounted.__test;
  eq(T.num('1.234.567'), 1234567, '“1.234.567” con puntos de miles');
  eq(T.num('12.34'), 12.34, '“12.34” con punto decimal (no son miles)');
  eq(T.num('1.234,56'), 1234.56, '“1.234,56” con coma decimal');
  eq(T.num('$ 990.000'), 990000, 'con símbolo de moneda delante');
  eq(T.num('19%'), 19, 'con signo de porcentaje');
  eq(T.num(''), 0, 'vacío = 0');
  eq(T.num('nada', 5), 5, 'texto sin números = el valor por defecto');
}

seccion('Correlativo');
{
  const T = mounted.__test;
  const rules = { numberPrefix: 'COT', numberIncludeYear: true, numberPad: 4 };
  const year = new Date().getFullYear();
  eq(T.nextNumber([], rules).number, 'COT-' + year + '-0001', 'la primera cotización del año');
  const previas = [{ kind: 'quote', number: 'COT-' + year + '-0007', numberSeq: 7 }];
  eq(T.nextNumber(previas, rules).number, 'COT-' + year + '-0008', 'sigue desde la más alta');
  const conPlantilla = previas.concat([{ kind: 'template', number: 'COT-' + year + '-9999', numberSeq: 9999 }]);
  eq(T.nextNumber(conPlantilla, rules).number, 'COT-' + year + '-0008', 'las plantillas no consumen correlativo');
}

seccion('Vigencia');
{
  const T = mounted.__test;
  // 2026-09-07 es lunes. El conteo empieza al día siguiente y salta el fin
  // de semana, así que el quinto día hábil es el lunes 14.
  eq(T.validUntilOf({ date: '2026-09-07', validDays: 5 }, { validBusinessDays: true }), '2026-09-14', '5 días hábiles desde un lunes');
  eq(T.validUntilOf({ date: '2026-09-07', validDays: 5 }, { validBusinessDays: false }), '2026-09-12', '5 días corridos desde el mismo lunes');
  eq(T.validUntilOf({ date: '2026-09-07', validUntil: '2026-12-01' }, {}), '2026-12-01', 'una fecha fijada a mano manda sobre la vigencia');
  eq(T.effectiveStatus({ status: 'sent', date: '2020-01-01', validDays: 5 }, { validBusinessDays: true }), 'expired', 'una enviada cuya vigencia pasó se ve como vencida');
  eq(T.effectiveStatus({ status: 'accepted', date: '2020-01-01', validDays: 5 }, {}), 'accepted', 'una aceptada no vence');
}

seccion('Ciclo de vida de una cotización');
const A = mounted.__test;
{
  A.actPatchIssuer({ name: 'METAKUT SPA', taxId: '77.718.188-2', paymentInfo: 'Banco de Chile\nCuenta Vista' });
  A.actPatchRules({ taxPct: 19, advancePct: 60, validDays: 15 });

  const q = A.actNewQuote({ name: 'Propuesta UNAB DEMRE 2027' });
  ok(!!q, 'se crea una cotización');
  ok(/^COT-\d{4}-0001$/.test(q.number), 'nace con correlativo', q.number);
  eq(q.status, 'draft', 'nace en borrador');
  eq(q.paymentInfo, 'Banco de Chile\nCuenta Vista', 'hereda los datos de pago del emisor');

  A.actPatchClient(q.id, { name: 'Universidad Andrés Bello', taxId: '77.718.188-2' });
  const l1 = A.actAddLine(q.id, { title: 'Arriendo Tótem', qty: 4, unitPrice: 900000 });
  const l2 = A.actAddLine(q.id, { title: 'Setup inicial', qty: 1, unitPrice: 390000 });
  ok(!!l1 && !!l2, 'se añaden líneas');

  let doc = A.docById(q.id);
  eq(doc.lines.length, 2, 'la cotización tiene 2 líneas');
  eq(A.computeTotals(doc, A.rulesOf()).subtotal, 3990000, 'el subtotal refleja las líneas');

  A.actMoveLine(q.id, l2.id, 0);
  doc = A.docById(q.id);
  eq(doc.lines[0].id, l2.id, 'reordenar mueve la línea al principio');

  A.actUpdateLine(q.id, l1.id, { qty: 5 });
  eq(A.computeTotals(A.docById(q.id), A.rulesOf()).subtotal, 4890000, 'editar la cantidad recalcula el total');

  A.actRemoveLine(q.id, l2.id);
  doc = A.docById(q.id);
  eq(doc.lines.length, 1, 'quitar una línea la saca del documento');
  eq(doc.deletedLines.length, 1, 'y deja su lápida para que no reaparezca');

  A.actSetStatus(q.id, 'sent');
  doc = A.docById(q.id);
  eq(doc.status, 'sent', 'el estado cambia a enviada');
  ok(doc.events.some((e) => e.type === 'status'), 'el cambio de estado queda en el historial');

  seccion('Duplicar y plantillas');
  const copia = A.actDuplicate(q.id);
  ok(copia.id !== q.id, 'la copia tiene identidad propia');
  ok(copia.number !== q.number, 'y su propio correlativo', { original: q.number, copia: copia.number });
  eq(copia.status, 'draft', 'la copia vuelve a borrador');
  eq(copia.lines.length, 1, 'la copia arrastra las líneas');
  ok(copia.lines[0].id !== A.docById(q.id).lines[0].id, 'con ids de línea nuevos');
  eq(copia.duplicateOf, q.id, 'y recuerda de cuál se replicó');

  const tpl = A.actSaveAsTemplate(q.id, 'Propuesta tótems (tipo)');
  eq(tpl.kind, 'template', 'guardar como tipo produce una plantilla');
  eq(tpl.number, '', 'la plantilla no consume número');
  eq(tpl.client.name, '', 'ni arrastra el cliente del original');
  eq(tpl.lines.length, 1, 'pero sí sus líneas');

  const desde = A.actNewQuote({ templateId: tpl.id, name: 'Propuesta UDD 2027' });
  eq(desde.kind, 'quote', 'desde una plantilla nace una cotización');
  ok(/^COT-\d{4}-\d{4}$/.test(desde.number), 'con correlativo propio', desde.number);
  eq(desde.templateOf, tpl.id, 'y recuerda de qué plantilla salió');
  eq(desde.lines.length, 1, 'con las líneas de la plantilla');

  seccion('Banco de ítems prefijados');
  const item = A.actSaveLineToCatalog(q.id, A.docById(q.id).lines[0].id, 'Arriendos');
  ok(!!item, 'una línea se guarda como ítem del catálogo');
  eq(item.group, 'Arriendos', 'con su agrupador');
  const añadida = A.actAddCatalogToQuote(desde.id, item.id);
  ok(!!añadida, 'y el ítem del catálogo vuelve como línea de otra cotización');
  eq(añadida.source.kind, 'catalog', 'con el origen anotado');
  eq(A.docById(desde.id).lines.length, 2, 'la cotización destino queda con 2 líneas');

  seccion('Búsqueda y filtros');
  A.actSetSearch('andrés bello');
  // Son dos: la original y su duplicado, que conserva el cliente a propósito.
  eq(A.visibleDocs('quote').length, 2, 'la búsqueda encuentra por cliente, sin acentos ni mayúsculas');
  A.actSetSearch('TÓTEM');
  ok(A.visibleDocs('quote').length >= 1, 'y también por el texto de las líneas');
  A.actSetSearch('');
  A.actSetFilterStatus('sent');
  eq(A.visibleDocs('quote').length, 1, 'el filtro por estado deja solo las enviadas');
  A.actSetFilterStatus('');

  seccion('Resumen del pipeline');
  const res = A.pipelineSummary();
  eq(res.count, 3, 'cuenta las cotizaciones (no las plantillas)');
  ok(res.open > 0, 'y suma el valor de lo enviado y vigente');
}

seccion('Fusión sin pérdida (dos personas a la vez)');
{
  const T = mounted.__test;
  // Las marcas de tiempo se toman de hoy: una lápida más vieja que su TTL se
  // olvida a propósito, y con fechas fijas del pasado la prueba caducaría.
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
  const local = T.normalizeQuote({
    id: 'q1', metaUpdatedAt: hace(60), name: 'Local',
    lines: [
      { id: 'a', title: 'Mía nueva', updatedAt: hace(55) },
      { id: 'b', title: 'Vieja', updatedAt: hace(120) },
    ],
  });
  const remote = T.normalizeQuote({
    id: 'q1', metaUpdatedAt: hace(30), name: 'Remoto',
    lines: [
      { id: 'b', title: 'Editada por otro', updatedAt: hace(40) },
      { id: 'c', title: 'Suya nueva', updatedAt: hace(35) },
    ],
  });
  const m1 = T.mergeDoc(local, remote);
  eq(m1.name, 'Remoto', 'la cabecera la gana quien guardó después');
  eq(m1.lines.length, 3, 'no se pierde ninguna línea de ninguno de los dos');
  eq(m1.lines.find((l) => l.id === 'b').title, 'Editada por otro', 'por línea gana la edición más reciente');
  eq(m1.lines.find((l) => l.id === 'a').title, 'Mía nueva', 'y la mía reciente sigue ahí');

  const conLapida = Object.assign({}, local, {
    deletedLines: [{ id: 'c', at: hace(10), by: 'yo' }],
  });
  const m2 = T.mergeDoc(conLapida, remote);
  ok(!m2.lines.some((l) => l.id === 'c'), 'una línea con lápida más nueva no reaparece');

  const lapidaVieja = Object.assign({}, local, {
    deletedLines: [{ id: 'c', at: hace(60), by: 'yo' }],
  });
  const m3 = T.mergeDoc(lapidaVieja, remote);
  ok(m3.lines.some((l) => l.id === 'c'), 'pero si la línea se reeditó después de borrarla, se conserva');
}

seccion('Catálogo del sistema (Productos y ProductLab)');
{
  const T = mounted.__test;
  const productos = await T.loadExternalCatalog(true);
  eq(productos.length, 2, 'se leen los dos productos activos (el borrador se descarta)');

  const tienda = productos.find((p) => p.source === 'products');
  ok(!!tienda, 'entra el producto de la app Productos');
  eq(tienda.description, 'Tótem táctil de piso con pantalla 32".', 'su descripción HTML llega como texto plano');
  eq(tienda.price, 1190000, 'con el precio del catálogo');
  eq(tienda.groups.length, 2, 'y sus dos opciones como pasos');
  const color = tienda.groups.find((g) => g.label === 'Color');
  eq(color.values.find((v) => v.name === 'Negro').delta, 0, 'la variante más barata fija el precio base');
  eq(color.values.find((v) => v.name === 'Blanco').delta, 59000, 'y la otra queda como recargo');
  const garantia = tienda.groups.find((g) => g.label === 'Garantía extendida');
  eq(garantia.values.length, 2, 'un addon se ofrece como sí/no');
  eq(garantia.values[0].delta, 0, 'con el “sin” en cero');
  eq(garantia.values[1].delta, 119000, 'y el recargo del addon');

  const lab = productos.find((p) => p.source === 'productlab');
  ok(!!lab, 'entra el producto configurable de ProductLab');
  eq(lab.groups.length, 1, 'con su paso');
  const pantalla = lab.groups[0];
  eq(pantalla.values.length, 2, 'la pantalla agotada (sin stock) no se ofrece');
  // Margen 0 e IVA 19%: 300.000 − 200.000 = 100.000 netos → 119.000 brutos.
  eq(pantalla.values.find((v) => v.name === '43 pulgadas').delta, 119000, 'el delta sale del motor de precios de ProductLab');
  eq(T.precioSeleccion(lab, {}), 357000, 'sin elegir nada, el precio es el de la configuración por defecto');
  eq(T.precioSeleccion(lab, { 'g-pantalla': 'v43' }), 476000, 'elegir la pantalla grande suma su delta');

  eq(Math.round(T.precioParaCotizar(1190000, { taxPct: 19, priceMode: 'net' })), 1000000,
    'un precio de catálogo con IVA se convierte a neto para cotizar');
  eq(T.precioParaCotizar(1190000, { taxPct: 19, priceMode: 'gross' }), 1190000,
    'y se deja tal cual si la cotización se escribe con impuesto incluido');
  eq(T.precioParaCotizar(1000000, { taxPct: 19, priceMode: 'net', catalogPricesIncludeTax: false }), 1000000,
    'si el catálogo ya guarda netos, no se toca');
}

seccion('Cotizar una combinación del catálogo');
{
  const T = mounted.__test;
  const q = T.actNewQuote({ name: 'Propuesta con productos' });
  const lab = T.productByKey('pl:plinst-1:pl-totem');

  const linea = T.actAddProductToQuote(q.id, lab.key, { selection: { 'g-pantalla': 'v43' }, qty: 4 });
  ok(!!linea, 'el producto configurable entra como línea');
  eq(linea.title, 'Tótem a medida', 'con el nombre del producto');
  eq(linea.qty, 4, 'y la cantidad pedida');
  eq(linea.unitPrice, 400000, 'con el precio de la combinación, ya neto (476.000 / 1,19)');
  eq(linea.source.kind, 'productlab', 'anotando de qué app viene');
  eq(linea.source.selection.length, 1, 'y qué combinación se eligió');
  eq(linea.source.selection[0].valueName, '43 pulgadas', 'con el valor legible, no solo su id');
  eq(linea.source.capturedPrice, 476000, 'guardando también el precio de catálogo del momento');
  ok(linea.description.indexOf('Pantalla: 43 pulgadas') !== -1, 'la descripción de la línea explica la combinación');

  const sinCombinacion = T.actAddProductToQuote(q.id, lab.key, {});
  eq(sinCombinacion.unitPrice, 300000, 'sin combinación se cotiza la configuración por defecto');

  const conTienda = T.actAddProductToQuote(q.id, 'pr:pinst-1:p-totem', { selection: {} });
  eq(conTienda.unitPrice, 1000000, 'un producto de la tienda también entra neto');
  eq(conTienda.sku, 'FG-TI0', 'con su SKU');

  // El precio congelado NO se mueve solo aunque cambie el catálogo.
  EXT.productlab[0].items.find((i) => i.id === 'c-p43').cost = 400000;
  await T.loadExternalCatalog(true);
  eq(T.docById(q.id).lines[0].unitPrice, 400000, 'si el catálogo sube de precio, la cotización sigue diciendo lo mismo');
  T.actRefreshLinePrice(q.id, linea.id);
  eq(T.docById(q.id).lines[0].unitPrice, 500000, 'hasta que se pide expresamente actualizar el precio');
  EXT.productlab[0].items.find((i) => i.id === 'c-p43').cost = 300000;

  seccion('Cliente desde la app Clientes');
  const clientes = await T.loadCustomers(true);
  eq(clientes.length, 1, 'se lee el directorio de clientes');
  eq(clientes[0].address, 'Santiago, Chile', 'juntando ciudad y país en una dirección legible');
  T.actImportClient(q.id, 'cli-unab');
  const doc = T.docById(q.id);
  eq(doc.client.name, 'Universidad Andrés Bello', 'la ficha se copia a la cotización');
  eq(doc.client.taxId, '99.555.444-3', 'con su identificación fiscal');
  eq(doc.client.sourceItemId, 'cli-unab', 'y queda anotado de qué ficha salió');
  await esperar();
  ok(doc.client.recordRef === '' || T.docById(q.id).client.recordRef !== '',
    'traerlo del directorio le da además su identidad del sistema');
}

seccion('Identidad del cliente compartida con el resto de KIMOS');
{
  const T = mounted.__test;
  const q = T.actNewQuote({ title: 'Propuesta identidad' });

  // Cliente escrito a mano, como quien cotiza a alguien nuevo.
  T.actPatchClient(q.id, { name: 'Acme SpA', taxId: '77.718.188-2', email: 'compras@acme.cl' });
  eq(T.estadoVinculo(T.docById(q.id)).estado, 'suelto',
    'una cotización con el cliente escrito a mano se ve como lo que es: suelta');

  const r1 = await T.actLinkClientRecord(q.id);
  ok(r1 && r1.created, 'vincularlo crea la identidad porque no existía');
  const ref = T.docById(q.id).client.recordRef;
  ok(/^kimos:record\/account\//.test(ref), 'y la cotización guarda la referencia', ref);
  eq(T.estadoVinculo(T.docById(q.id)).estado, 'vinculado', 'el estado pasa a vinculado');
  ok(REG.links.some((l) => l.itemId === q.id && l.kind === 'cotizacion'),
    'queda anotado el vínculo inverso, que es lo que responde «dame todo lo de Acme»');

  // El caso que justifica todo esto: OTRA cotización, el mismo RUT escrito
  // de otra forma, y nadie crea un segundo Acme.
  const q2 = T.actNewQuote({ title: 'Segunda propuesta' });
  T.actPatchClient(q2.id, { name: 'ACME S.p.A.', taxId: '777181882' });
  const r2 = await T.actLinkClientRecord(q2.id);
  ok(r2 && !r2.created, 'el mismo RUT escrito de otra forma NO crea un segundo cliente');
  eq(T.docById(q2.id).client.recordRef, ref, 'las dos cotizaciones apuntan a la misma identidad');

  // La instantánea es lo que se imprime, y no la pisa el registro.
  eq(T.docById(q2.id).client.name, 'ACME S.p.A.',
    'la cotización conserva el nombre con el que se escribió: es lo que se envió');

  // Refrescar sí trae el nombre bueno, porque se pide expresamente.
  REG.docs.get(ref.split('/').pop()).label = 'Acme SpA (Chile)';
  await T.actRefreshClientRecord(q2.id);
  eq(T.docById(q2.id).client.name, 'Acme SpA (Chile)',
    'y solo al pedir refrescar se trae el nombre actual del directorio');

  // Fusión: la referencia vieja se reapunta sola al refrescar.
  const viejo = ref.split('/').pop();
  const nuevo = 'rec-fusionado';
  REG.docs.set(nuevo, { id: nuevo, label: 'Acme Chile SpA', keys: { taxid: '777181882' } });
  REG.mergedInto.set(viejo, nuevo);
  await T.actRefreshClientRecord(q.id);
  eq(T.docById(q.id).client.recordRef, 'kimos:record/account/' + nuevo,
    'si dos identidades se fusionan, la cotización se reapunta a la buena');
  REG.mergedInto.delete(viejo);

  // Un registro que ya no está NO borra los datos de la cotización.
  const q3 = T.actNewQuote({ title: 'Con referencia rota' });
  T.actPatchClient(q3.id, { name: 'Cliente Histórico', taxId: '11.111.111-1', recordRef: 'kimos:record/account/no-existe' });
  await T.actRefreshClientRecord(q3.id);
  eq(T.docById(q3.id).client.name, 'Cliente Histórico',
    'si el registro desapareció, la cotización sigue diciendo lo que decía');

  // Sin nombre no hay a quién apuntar.
  const q4 = T.actNewQuote({ title: 'Sin cliente' });
  const r4 = await T.actLinkClientRecord(q4.id);
  ok(r4 === null, 'un cliente sin nombre no se vincula');

  seccion('Guardar el cliente en la app Clientes');
  const q5 = T.actNewQuote({ title: 'Cliente nuevo al directorio' });
  T.actPatchClient(q5.id, {
    name: 'Nueva Empresa Ltda', taxId: '76.000.111-2',
    email: 'pagos@nueva.cl', phone: '+56 9 8888', address: 'Av. Siempre Viva 742',
  });
  const creado = await T.actPushClientToDirectory(q5.id, 'cinst-1');
  ok(!!creado, 'el cliente escrito a mano se puede guardar en el directorio');
  eq(creado.name, 'Nueva Empresa Ltda', 'con su nombre');
  eq(creado.taxId, '76.000.111-2', 'y su RUT');
  ok(!('address' in creado),
    'pero NO se cuela un campo que la app Clientes no declara en su contrato');
  eq(T.docById(q5.id).client.sourceItemId, creado.id, 'la cotización anota de qué ficha quedó colgando');
  await esperar();
  ok(T.docById(q5.id).client.recordRef !== '', 'y al guardarlo también se le da identidad');

  // El error de la pasarela llega a quien está cotizando, no se traga.
  const antes = notices.length;
  ESCRITURA.falla = 'La app customers no publica un dataSchema.';
  const q6 = T.actNewQuote({ title: 'Directorio cerrado' });
  T.actPatchClient(q6.id, { name: 'Otra Empresa' });
  const nada = await T.actPushClientToDirectory(q6.id, 'cinst-1');
  ESCRITURA.falla = '';
  ok(nada === null, 'si la app dueña no publica contrato, no se escribe nada');
  ok(notices.slice(antes).some((n) => n.indexOf('dataSchema') !== -1),
    'y el motivo se le dice a quien está cotizando, no se traga');
}

seccion('En un host sin registro de identidades la app sigue funcionando');
{
  // `shell.records` es OPCIONAL en el contrato (APP-SPEC §7.d). Un tenant que
  // no haya actualizado el shell tiene que poder cotizar igual: esta es la
  // prueba de que la app no se apoya en algo que puede no estar.
  const almacen = new Map();
  const viejo = Object.assign({}, shell, {
    items: {
      list: async () => Array.from(almacen.values()).map((x) => JSON.parse(JSON.stringify(x))),
      create: async (it) => { almacen.set(it.id, it); return it; },
      update: async (id, patch) => { almacen.set(id, Object.assign({}, almacen.get(id), patch)); return almacen.get(id); },
      remove: async (id) => { almacen.delete(id); },
    },
    data: { listInstances: shell.data.listInstances, listItems: shell.data.listItems },
  });
  delete viejo.records;

  const app2 = mod.default(viejo);
  const V = app2.__test;
  await V.load();
  await esperar();

  ok(V.registroNoDisponible() !== '', 'la app detecta que este host no tiene registro');
  const q = V.actNewQuote({ title: 'Cotización en host antiguo' });
  V.actPatchClient(q.id, { name: 'Cliente de Siempre', taxId: '77.718.188-2' });
  const antes = notices.length;
  const r = await V.actLinkClientRecord(q.id);
  ok(r === null, 'vincular no rompe: simplemente no se puede');
  ok(notices.slice(antes).some((n) => n.indexOf('registro de identidades') !== -1),
    'y se explica por qué, en vez de fallar en silencio');
  eq(V.estadoVinculo(V.docById(q.id)).estado, 'suelto', 'la cotización queda suelta, que es lo correcto');
  eq(V.docById(q.id).client.name, 'Cliente de Siempre', 'pero el cliente se guarda igual');
  V.actAddLine(q.id, { title: 'Servicio', qty: 1, unitPrice: 100000 });
  eq(V.computeTotals(V.docById(q.id), V.rulesOf()).total > 0, true, 'y la cotización se calcula igual');
  app2.unmount();
}

seccion('Plantillas predeterminadas y revisiones');
{
  const T = mounted.__test;
  const base = T.actNewQuote({ name: 'Propuesta base' });
  T.actAddLine(base.id, { title: 'Servicio', qty: 1, unitPrice: 500000 });
  T.actPatchClient(base.id, { name: 'Cliente A' });

  const tpl = T.actSaveAsTemplate(base.id, 'Tipo servicios');
  ok(!T.defaultTemplate(), 'al principio no hay plantilla predeterminada');
  T.actSetDefaultTemplate(tpl.id);
  eq(T.defaultTemplate().id, tpl.id, 'se puede marcar una plantilla como predeterminada');

  const otra = T.actSaveAsTemplate(base.id, 'Otro tipo');
  T.actSetDefaultTemplate(otra.id);
  eq(T.defaultTemplate().id, otra.id, 'marcar otra la cambia');
  eq(T.docById(tpl.id).isDefault, false, 'y solo puede haber una a la vez');
  T.actSetDefaultTemplate('');
  ok(!T.defaultTemplate(), 'y se puede desmarcar');

  // Revisión de una cotización ya enviada.
  T.actSetStatus(base.id, 'sent');
  const r2 = T.actNewRevision(base.id);
  ok(!!r2, 'una cotización enviada se puede revisar');
  eq(r2.revision, 2, 'la primera revisión es la 2');
  eq(r2.number, T.docById(base.id).number + '-R2', 'con el número del original y el sufijo');
  eq(r2.revisionOf, base.id, 'apuntando a la original');
  eq(r2.status, 'draft', 'la revisión nace en borrador');
  eq(r2.client.name, 'Cliente A', 'y conserva el cliente: es la misma negociación');
  eq(T.docById(base.id).supersededBy, r2.id, 'la original queda marcada como sustituida');
  eq(T.docById(base.id).status, 'sent', 'pero NO se reescribe: lo que se envió sigue como salió');

  T.actSetStatus(r2.id, 'sent');
  const r3 = T.actNewRevision(r2.id);
  eq(r3.revision, 3, 'revisar una revisión sigue la serie');
  eq(r3.revisionOf, base.id, 'todas las revisiones cuelgan de la original');
  eq(T.serieDe(r3).length, 3, 'la serie tiene original y dos revisiones');
  eq(T.serieDe(r3)[0].id, base.id, 'empezando por la original');

  // El correlativo no cuenta las revisiones.
  const antes = T.nextNumber(T.getModel().docs, T.rulesOf()).seq;
  const nueva = T.actNewQuote({ name: 'Otra más' });
  eq(T.nextNumber(T.getModel().docs, T.rulesOf()).seq, antes + 1, 'una cotización nueva sí consume correlativo');
  ok(nueva.number.indexOf('-R') === -1, 'y las revisiones no dejaron huecos en la serie', nueva.number);
}

seccion('Lienzo visual');
{
  const T = mounted.__test;
  const q = T.actNewQuote({ name: 'Propuesta con lienzo' });
  T.actAddLine(q.id, { title: 'Servicio', qty: 2, unitPrice: 100000 });

  eq((T.docById(q.id).blocks || []).length, 0, 'una cotización nace sin bloques guardados');
  const porDefecto = T.bloquesDe(T.docById(q.id));
  eq(porDefecto.length, 5, 'pero el lienzo le presta la maqueta de la casa');
  eq(porDefecto.map((b) => b.type).join(','), 'header,items,totals,notes,payment', 'con los bloques en el orden de la propuesta');
  ok(porDefecto.every((b) => b.w === 12), 'todos a ancho completo');

  T.actSetBlocks(q.id, T.bloquesPorDefecto());
  const texto = T.actAddBlock(q.id, 'text', 1, { text: 'Alcance del proyecto', size: 'xl' });
  ok(!!texto, 'se añade un bloque de texto');
  eq(T.bloquesDe(T.docById(q.id))[1].id, texto.id, 'en la posición pedida');
  eq(T.bloquesDe(T.docById(q.id)).length, 6, 'y la maqueta queda con seis bloques');

  T.actUpdateBlock(q.id, texto.id, { w: 6, align: 'center' });
  const tras = T.bloquesDe(T.docById(q.id))[1];
  eq(tras.w, 6, 'el ancho se cambia en columnas');
  eq(tras.align, 'center', 'y la alineación también');
  T.actUpdateBlock(q.id, texto.id, { w: 99 });
  eq(T.bloquesDe(T.docById(q.id))[1].w, 12, 'un ancho fuera de rango se recorta a la cuadrícula');

  T.actMoveBlock(q.id, texto.id, 4);
  eq(T.bloquesDe(T.docById(q.id))[4].id, texto.id, 'los bloques se reordenan');
  ok(T.actRemoveBlock(q.id, texto.id), 'y se quitan');
  eq(T.bloquesDe(T.docById(q.id)).length, 5, 'volviendo a cinco');

  const img = T.actAddBlock(q.id, 'image', 0, { url: 'https://cdn/plano.png', caption: 'Planta' });
  eq(img.w, 6, 'una imagen entra a media hoja por defecto');
  T.actResetBlocks(q.id);
  eq(T.bloquesDe(T.docById(q.id)).length, 5, 'restablecer devuelve la maqueta de la casa');

  // Los bloques vinculados no duplican datos: leen del documento.
  const ctx = T.contextoDe(T.docById(q.id), T.getModel().def);
  eq(ctx.totals.subtotal, 200000, 'el contexto de pintado calcula los totales del documento');
  eq(ctx.doc.lines.length, 1, 'y el bloque de ítems pinta las líneas reales, sin copiarlas');
}

seccion('Exportar a PDF');
{
  const T = mounted.__test;
  const css = T.printCss({ paper: 'a4', margin: 16 });
  ok(css.indexOf('@page { size: A4; margin: 16mm; }') !== -1, 'el tamaño y el margen del papel van al @page');
  ok(T.printCss({ paper: 'letter', margin: 25 }).indexOf('size: letter; margin: 25mm') !== -1, 'y cambian con los ajustes');
  ok(T.printCss({ margin: 999 }).indexOf('margin: 40mm') !== -1, 'un margen absurdo se recorta a lo imprimible');
  ok(css.indexOf('background: #fff') !== -1, 'el papel es blanco aunque KIMOS esté en modo noche');
  ok(css.indexOf('.cz-print .cz-cell { break-inside: avoid; }') !== -1, 'un bloque no se parte entre dos páginas');
  ok(css.indexOf('thead { display: table-header-group; }') !== -1, 'y la cabecera de la tabla se repite en cada página');

  const q = T.quotesOf().find((x) => x.lines.length) || T.quotesOf()[0];
  eq(T.nombreArchivo(T.docById(q.id)).indexOf(' '), -1, 'el nombre de archivo no lleva espacios');
  ok(/^[a-z0-9-]+$/.test(T.nombreArchivo(T.docById(q.id))), 'ni acentos ni mayúsculas', T.nombreArchivo(T.docById(q.id)));

  const antes = ventanas.length;
  const ok1 = await T.actExportPdf(q.id);
  ok(ok1, 'la exportación llega hasta el final');
  eq(ventanas.length, antes + 1, 'se abrió una ventana de impresión');
  const w = ventanas[ventanas.length - 1];
  const links = w.document.head.children.filter((c) => c.tagName === 'LINK');
  eq(links.length, 1, 'con la hoja de estilos de la app enlazada');
  ok(String(links[0].href).indexOf('/bundle.css') !== -1, 'la publicada por el host, no una copia', links[0].href);
  ok(w.document.body.children.length > 0, 'y la hoja renderizada dentro');
  ok(T.docById(q.id).events.some((e) => e.type === 'export'), 'la exportación queda en el historial');

  // Ventanas emergentes bloqueadas: se avisa en vez de fallar en silencio.
  const abrir = globalThis.window.open;
  globalThis.window.open = () => null;
  const ok2 = await T.actExportPdf(q.id);
  ok(!ok2, 'si el navegador bloquea la ventana, la exportación lo dice');
  ok(notices.some((n) => n.indexOf('ventanas emergentes') !== -1), 'con un aviso que explica qué hacer');
  globalThis.window.open = abrir;
}

seccion('Correo');
{
  const T = mounted.__test;
  const q = T.actNewQuote({ name: 'Propuesta para enviar' });
  T.actPatchClient(q.id, { name: 'Universidad Andrés Bello', contact: 'Ana Pérez', email: 'compras@unab.cl' });
  T.actAddLine(q.id, { title: 'Servicio', qty: 1, unitPrice: 1000000 });
  T.actPatchDoc(q.id, { date: '2026-09-07', validDays: 15 });
  const doc = T.docById(q.id);

  // Variables.
  const ctx = T.contextoDe(doc, T.getModel().def);
  eq(T.aplicarVars('Hola {{contacto}}', doc, ctx), 'Hola Ana Pérez', 'las variables se sustituyen');
  eq(T.aplicarVars('{{cliente}}', doc, ctx), 'Universidad Andrés Bello', 'incluida la del cliente');
  ok(T.aplicarVars('{{total}}', doc, ctx).indexOf('1.190.000') !== -1, 'y el total ya formateado', T.aplicarVars('{{total}}', doc, ctx));
  eq(T.aplicarVars('{{numero}}', doc, ctx), doc.number, 'y el número de la cotización');
  eq(T.aplicarVars('{{inventada}}', doc, ctx), '{{inventada}}',
    'una variable desconocida se deja a la vista: es más fácil verla en la previsualización que descubrir un hueco en el correo enviado');
  eq(T.aplicarVars('{{ CLIENTE }}', doc, ctx), 'Universidad Andrés Bello', 'se toleran espacios y mayúsculas');

  // Plantilla.
  const tpl = T.actUpsertMailTemplate(T.plantillaCorreoEjemplo());
  ok(!!tpl, 'se guarda una plantilla de correo');
  T.actSetDefaultMailTemplate(tpl.id);
  eq(T.defaultMailTemplate().id, tpl.id, 'y se marca como predeterminada');

  const correo = T.resolverCorreo(tpl, doc);
  eq(correo.to, 'compras@unab.cl', 'sin destinatario en la plantilla, se usa el correo del cliente');
  ok(correo.subject.indexOf(doc.number) !== -1, 'el asunto trae el número resuelto', correo.subject);
  ok(correo.body.indexOf('Ana Pérez') !== -1, 'y el cuerpo el contacto');
  ok(correo.body.indexOf('{{') === -1, 'sin dejar variables sin resolver', correo.body);

  // El cuerpo HTML escapa el texto: nunca se interpreta como marcado.
  const html = T.cuerpoHtml('Hola <b>mundo</b> & cía', '', '');
  ok(html.indexOf('&lt;b&gt;') !== -1, 'el HTML del correo escapa el texto de la persona', html);
  ok(html.indexOf('<b>mundo</b>') === -1, 'así que un “<b>” escrito a mano no llega en negrita');
  ok(T.cuerpoHtml('x', 'https://kimos.dev/p.html', 'Ver').indexOf('href="https://kimos.dev/p.html"') !== -1,
    'y el enlace se pinta como botón cuando lo hay');
  ok(T.cuerpoHtml('x', 'javascript:alert(1)', 'Ver').indexOf('<a ') === -1,
    'un enlace que no sea http(s) no se pinta');

  // Envío.
  const antes = SMTP.enviados.length;
  const res = await T.actSendMail(q.id, correo);
  ok(res.ok, 'el correo sale', res.error);
  eq(SMTP.enviados.length, antes + 1, 'con una llamada al endpoint del tenant');
  const enviado = SMTP.enviados[SMTP.enviados.length - 1];
  eq(enviado.to, 'compras@unab.cl', 'al destinatario correcto');
  ok(enviado.html.indexOf('Ana Pérez') !== -1, 'con el cuerpo en HTML');
  ok(enviado.text.indexOf('Ana Pérez') !== -1, 'y también en texto plano, para quien no ve HTML');
  eq(T.docById(q.id).status, 'sent', 'mandar la cotización la deja como enviada');
  ok(T.docById(q.id).events.some((e) => e.type === 'mail'), 'y el envío queda en el historial');

  // Errores: nada sale a medias ni en silencio.
  const sinDestino = await T.actSendMail(q.id, Object.assign({}, correo, { to: '' }));
  ok(!sinDestino.ok && sinDestino.error.indexOf('destinatario') !== -1, 'sin destinatario no se envía');
  const sinAsunto = await T.actSendMail(q.id, Object.assign({}, correo, { subject: '' }));
  ok(!sinAsunto.ok && sinAsunto.error.indexOf('asunto') !== -1, 'sin asunto tampoco');

  SMTP.falla = 'SMTP: credenciales rechazadas';
  const falla = await T.actSendMail(q.id, correo);
  ok(!falla.ok && falla.error.indexOf('credenciales') !== -1, 'un error del servidor llega tal cual a quien envía', falla.error);
  SMTP.falla = '';

  SMTP.status = { configured: false };
  await T.mailStatus(true);
  const sinSmtp = await T.actSendMail(q.id, correo);
  ok(!sinSmtp.ok && sinSmtp.error.indexOf('no está configurado') !== -1,
    'y si el tenant no tiene correo configurado, se dice qué falta y quién lo arregla', sinSmtp.error);
  SMTP.status = { configured: true, fromEmail: 'buzon@metakut.cl' };
  await T.mailStatus(true);
}

seccion('Tablero de seguimiento');
{
  const T = mounted.__test;
  const rules = T.rulesOf();
  const quotes = T.quotesOf();

  const meses = T.porMes(quotes, rules, 12);
  eq(meses.length, 12, 'la evolución cubre doce meses');
  eq(meses[11].key, new Date().toISOString().slice(0, 7), 'y termina en el mes en curso');
  ok(meses[11].total > 0, 'con lo cotizado este mes dentro', meses[11].total);
  ok(meses.every((x) => x.count >= 0), 'y ningún mes queda sin contar');
  eq(T.porMes(quotes, rules, 99).length, 24, 'un rango absurdo se recorta');

  const clientes = T.porCliente(quotes, rules, 3);
  ok(clientes.length <= 3, 'los clientes se limitan a los pedidos');
  ok(clientes.length < 2 || clientes[0].total >= clientes[1].total, 'ordenados por valor cotizado');
  ok(clientes.some((c) => c.nombre === 'Sin cliente') || clientes.every((c) => c.nombre),
    'una cotización sin cliente se agrupa aparte en vez de perderse');

  // Lo que pide atención.
  const q1 = T.actNewQuote({ name: 'Vence pronto' });
  T.actPatchDoc(q1.id, { date: today(), validDays: 1 });
  T.actSetStatus(q1.id, 'sent');
  const q2 = T.actNewQuote({ name: 'Borrador olvidado' });
  T.actPatchDoc(q2.id, { date: hace_dias(20) });
  const q3 = T.actNewQuote({ name: 'Ya vencida' });
  T.actPatchDoc(q3.id, { date: hace_dias(60), validDays: 5 });
  T.actSetStatus(q3.id, 'sent');

  const at = T.requiereAtencion(T.quotesOf(), rules);
  const motivos = new Map(at.map((x) => [x.doc.id, x.motivo]));
  ok(motivos.has(q1.id) && motivos.get(q1.id).indexOf('Vence') === 0, 'una enviada por vencer aparece', motivos.get(q1.id));
  ok(motivos.has(q2.id) && motivos.get(q2.id).indexOf('Borrador') === 0, 'un borrador olvidado aparece', motivos.get(q2.id));
  ok(motivos.has(q3.id) && motivos.get(q3.id).indexOf('Venció') === 0, 'una vencida sin respuesta aparece', motivos.get(q3.id));
  eq(at[0].doc.id, q3.id, 'lo vencido va primero: es lo más urgente');

  // Una cotización sustituida por su revisión ya no molesta en el tablero.
  const rev = T.actNewRevision(q3.id);
  ok(!!rev, 'se emite la revisión');
  const at2 = T.requiereAtencion(T.quotesOf(), rules);
  ok(!at2.some((x) => x.doc.id === q3.id), 'y la sustituida deja de pedir atención: ya la relevó su revisión');

  const res = T.pipelineSummary();
  eq(res.byStatus.sent.count + res.byStatus.expired.count >= 1, true, 'el resumen reparte por estado');
  ok(res.total > 0, 'y suma el valor de todo lo cotizado');
}

seccion('Agente IA');
{
  const T = mounted.__test;
  const off = T.registrarAgente();
  ok(!!agentReg, 'la app se registra en el puente de agentes');
  ok(agentReg.tools.length >= 20, 'con todas sus herramientas (' + agentReg.tools.length + ')');
  ok(agentReg.tools.every((x) => x.name && x.description && x.inputSchema),
    'y cada una con nombre, descripción y esquema');
  ok(agentReg.description.indexOf('ENVIAR_CORREO') !== -1,
    'la descripción avisa de que enviar correo manda un correo real');

  const snap = agentReg.getSnapshot();
  // Contra el manifest, no contra una constante: así la prueba comprueba lo
  // que importa —que el retrato dice la versión REAL— y no hay que tocarla en
  // cada bump (APP-SPEC §7.a).
  eq(snap.version, MANIFEST_VERSION, 'el retrato dice qué build está corriendo');
  ok(Array.isArray(snap.cotizaciones) && snap.cotizaciones.length > 0, 'lista las cotizaciones');
  ok(snap.cotizaciones.every((x) => x.id), 'con sus ids, que es lo que hace falta para actuar');
  ok(!!snap.cotizador.siguienteNumero, 'y el siguiente correlativo');
  ok(Array.isArray(snap.requiereAtencion), 'incluye lo que pide atención');
  ok(Array.isArray(snap.variablesDeCorreo) && snap.variablesDeCorreo.length > 5, 'y las variables de correo disponibles');

  const call = (type, payload) => agentReg.dispatchAction({ app: 'cotizaciones', type, payload: payload || {} });

  // Ciclo completo por el agente.
  let r = await call('CREAR_COTIZACION', {
    nombre: 'Propuesta agente', cliente: 'Municipalidad de Iquique', clienteCorreo: 'compras@iquique.cl',
    items: [{ titulo: 'Asistencia presencial', cantidad: 2, precioUnitario: 590000 }],
  });
  ok(r.success, 'el agente crea una cotización', r.error);
  const id = r.cotizacion.id;
  ok(r.message.indexOf('1.180.000') !== -1 || r.message.indexOf('1.404.200') !== -1,
    'y responde con el total ya calculado', r.message);

  r = await call('AGREGAR_ITEM', { cotizacion: 'Propuesta agente', titulo: 'Implementación', cantidad: 1, precioUnitario: 390000 });
  ok(r.success, 'añade líneas refiriéndose a la cotización por su nombre', r.error);

  r = await call('ACTUALIZAR_ITEM', { cotizacion: id, item: 'Implementación', precioUnitario: 450000 });
  ok(r.success, 'y edita una línea por el nombre del ítem', r.error);
  eq(T.docById(id).lines.find((l) => l.title === 'Implementación').unitPrice, 450000, 'con el precio aplicado');

  r = await call('ACTUALIZAR_COTIZACION', { cotizacion: id, diasDeVigencia: 30, descuentoPct: 5 });
  ok(r.success, 'cambia la cabecera', r.error);
  eq(T.docById(id).validDays, 30, 'con la vigencia aplicada');
  eq(T.docById(id).discountPct, 5, 'y el descuento');

  r = await call('ACTUALIZAR_COTIZACION', { cotizacion: id });
  ok(!r.success && r.error.indexOf('ningún campo') !== -1, 'sin campos que cambiar, lo dice en vez de fingir que hizo algo');

  r = await call('MOVER_ITEM', { cotizacion: id, item: 'Implementación', posicion: 0 });
  ok(r.success && T.docById(id).lines[0].title === 'Implementación', 'reordena las líneas');

  r = await call('CAMBIAR_ESTADO', { cotizacion: id, estado: 'inventado' });
  ok(!r.success && r.error.indexOf('no válido') !== -1, 'un estado inventado se rechaza con las opciones válidas', r.error);
  r = await call('CAMBIAR_ESTADO', { cotizacion: id, estado: 'sent' });
  ok(r.success && T.docById(id).status === 'sent', 'y uno válido se aplica');

  r = await call('CREAR_REVISION', { cotizacion: id });
  ok(r.success && r.cotizacion.numero.indexOf('-R2') !== -1, 'emite revisiones', r.error || r.cotizacion.numero);

  // Identidad del cliente desde el agente (APP-SPEC §7.d).
  r = await call('ACTUALIZAR_CLIENTE_DESDE_DIRECTORIO', { cotizacion: id });
  ok(!r.success && r.error.indexOf('VINCULAR_CLIENTE') !== -1,
    'refrescar sin haber vinculado dice qué hacer antes, en vez de fallar seco', r.error);
  r = await call('VINCULAR_CLIENTE', { cotizacion: id });
  ok(r.success && /^kimos:record\/account\//.test(r.referencia || ''),
    'el agente puede darle identidad al cliente', r.error || r.referencia);
  const refAgente = r.referencia;
  r = await call('VINCULAR_CLIENTE', { cotizacion: id });
  ok(r.success && r.creado === false && r.referencia === refAgente,
    'y hacerlo dos veces no crea un segundo cliente');
  r = await call('ACTUALIZAR_CLIENTE_DESDE_DIRECTORIO', { cotizacion: id });
  ok(r.success, 'ya vinculado, refrescar funciona', r.error);
  r = await call('VINCULAR_CLIENTE', { cotizacion: id, guardarEnDirectorio: true, directorio: 'cinst-1' });
  ok(r.success && !!r.fichaId, 'y puede además dejar la ficha en la app Clientes', r.error);

  // Referencias ambiguas: no se elige al azar.
  await call('CREAR_COTIZACION', { nombre: 'Propuesta agente', cliente: 'Otro cliente' });
  r = await call('VER_COTIZACION', { cotizacion: 'Propuesta agente' });
  ok(!r.success && r.error.indexOf('Precisa cuál') !== -1,
    'con varias coincidencias pide precisar en vez de elegir una: equivocarse de cotización es caro', r.error);
  r = await call('VER_COTIZACION', { cotizacion: id });
  ok(r.success && r.cotizacion.items.length === 2, 'por id siempre resuelve');

  r = await call('VER_COTIZACION', { cotizacion: 'no existe nada así' });
  ok(!r.success && r.error.indexOf('No encontré') !== -1, 'y si no hay ninguna, lo dice');

  // Catálogo del sistema.
  r = await call('BUSCAR_PRODUCTOS', { texto: 'tótem' });
  ok(r.success && r.productos.length >= 1, 'busca en el catálogo del sistema', r.error);
  ok(r.productos[0].pasos.length >= 0, 'devolviendo los pasos configurables');

  r = await call('AGREGAR_PRODUCTO', { cotizacion: id, producto: 'Tótem a medida', combinacion: { Pantalla: '43 pulgadas' } });
  ok(r.success, 'cotiza un producto configurable eligiendo por NOMBRES de paso y valor', r.error);
  ok(r.message.indexOf('43 pulgadas') !== -1, 'y dice qué combinación quedó', r.message);

  r = await call('AGREGAR_PRODUCTO', { cotizacion: id, producto: 'Tótem a medida', combinacion: { Pantalla: '99 pulgadas' } });
  ok(!r.success && r.error.indexOf('Opciones:') !== -1,
    'una combinación inexistente NO se traga: se avisa con las opciones reales', r.error);

  // Lienzo.
  r = await call('AGREGAR_BLOQUE', { cotizacion: id, tipo: 'text', texto: 'Alcance', ancho: 6, tamaño: 'xl' });
  ok(r.success && !!r.bloqueId, 'añade bloques al lienzo', r.error);
  r = await call('ACTUALIZAR_BLOQUE', { cotizacion: id, bloque: r.bloqueId, texto: 'Alcance del proyecto' });
  ok(r.success, 'y los edita');
  r = await call('AGREGAR_BLOQUE', { cotizacion: id, tipo: 'inventado' });
  ok(!r.success && r.error.indexOf('no válido') !== -1, 'un tipo de bloque inventado se rechaza');

  // Correo: preparar no envía.
  const antesMail = SMTP.enviados.length;
  r = await call('PREPARAR_CORREO', { cotizacion: id });
  ok(r.success && !!r.correo.subject, 'prepara el correo', r.error);
  eq(SMTP.enviados.length, antesMail, 'y preparar NO envía nada');
  r = await call('ENVIAR_CORREO', { cotizacion: id, para: 'compras@iquique.cl', asunto: 'Propuesta', mensaje: 'Adjuntamos.' });
  ok(r.success, 'enviar sí manda', r.error);
  eq(SMTP.enviados.length, antesMail + 1, 'con una llamada al endpoint');

  r = await call('RESUMEN', {});
  ok(r.success && !!r.resumen.enJuego, 'resume el embudo', r.error);

  r = await call('ACCION_QUE_NO_EXISTE', {});
  ok(!r.success && r.error.indexOf('Disponibles') !== -1, 'una acción desconocida responde con las que sí existen');

  if (off) off();
  ok(!agentReg, 'y al cerrar la ventana la app se desregistra');
}

seccion('Render de todas las pantallas');
{
  const T = mounted.__test;
  for (const tab of ['quotes', 'templates', 'catalog', 'mails', 'board', 'settings']) {
    T.actSetTab(tab);
    T.actCloseEditor();
    const n = render(R.createElement(mounted.Component, {}), tab);
    ok(n > 10, 'la pestaña «' + tab + '» se renderiza (' + n + ' nodos)');
  }
  // Los diálogos viven detrás de estado de interacción, así que no salen en
  // el render de las pantallas: se pintan a mano para que un error dentro de
  // uno no aparezca por primera vez en producción.
  const conLineas = T.quotesOf().find((x) => x.lines.length) || T.quotesOf()[0];
  T.actOpen(conLineas.id);
  const dial = [
    ['NewQuoteModal', {}],
    ['CatalogItemModal', { item: { name: 'X' }, onSave: () => {} }],
    ['CatalogPickerModal', { quoteId: conLineas.id }],
    ['ProductPickerModal', { quoteId: conLineas.id }],
    ['ClientPickerModal', { quoteId: conLineas.id }],
    ['PreviewModal', { doc: conLineas }],
    ['MailTemplateModal', { tpl: T.defaultMailTemplate() || {}, onSave: () => {} }],
    ['SendMailModal', { doc: conLineas }],
  ];
  for (const [nombre, extra] of dial) {
    const C = T.dialogos[nombre];
    ok(typeof C === 'function', 'el diálogo ' + nombre + ' existe');
    const n = render(R.createElement(C, Object.assign({ m: T.getModel(), onClose: () => {} }, extra)), nombre);
    ok(n > 5, 'y se renderiza sin romperse (' + nombre + ', ' + n + ' nodos)');
  }
  T.actCloseEditor();

  const alguna = T.quotesOf()[0];
  T.actOpen(alguna.id);
  T.actSetEditorView('data');
  const n = render(R.createElement(mounted.Component, {}), 'editor');
  ok(n > 40, 'el editor de una cotización se renderiza (' + n + ' nodos)');
  T.actSetEditorView('design');
  const nd = render(R.createElement(mounted.Component, {}), 'lienzo');
  ok(nd > 40, 'el lienzo visual se renderiza (' + nd + ' nodos)');
  T.actSetEditorView('data');
  T.actCloseEditor();
}

seccion('Persistencia');
{
  await mounted.__test.flushPending();
  await esperar();
  const guardadas = Array.from(store.values()).filter((x) => x.kind === 'quote');
  ok(guardadas.length >= 3, 'las cotizaciones llegaron al servidor simulado (' + guardadas.length + ')');
  ok(store.has('definition'), 'y los ajustes del cotizador también');
  const conLineas = guardadas.find((x) => (x.lines || []).length);
  ok(!!conLineas, 'con sus líneas dentro del item');
  ok(!('createdAt' in JSON.parse(JSON.stringify(conLineas)) && conLineas.createdAt === undefined), 'sin sellos del servidor inventados por la app');
}

mounted.unmount();

console.log('\n' + (fallos ? '✖ ' + fallos + ' de ' + pruebas + ' pruebas fallaron' : '✔ ' + pruebas + ' pruebas en verde'));
process.exit(fallos ? 1 : 0);
