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

const listeners = [];
globalThis.window = {
  location: { origin: 'http://kimos.local', href: 'http://kimos.local/' },
  addEventListener: () => {}, removeEventListener: () => {},
  hasFocus: () => true,
};
globalThis.document = { visibilityState: 'visible', hasFocus: () => true, createElement: () => ({ style: {} }) };
globalThis.FormData = class { append() {} };

// ── Shell simulado ───────────────────────────────────────────────────────
const store = new Map();          // items de la instancia
const notices = [];
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
  config: { get: async () => ({}), set: async () => {}, onChange: () => () => {} },
  documents: { onSerialize: () => () => {}, onLoad: () => () => {} },
  authFetch: async (url, init) => {
    const method = ((init && init.method) || 'GET').toUpperCase();
    const items = url.match(/\/items(?:\/([^/?]+))?$/);
    if (url.endsWith('/api/identity/me')) return json({ id: 'u1', displayName: 'Probador' });
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

seccion('Render de todas las pantallas');
{
  const T = mounted.__test;
  for (const tab of ['quotes', 'templates', 'settings']) {
    T.actSetTab(tab);
    T.actCloseEditor();
    const n = render(R.createElement(mounted.Component, {}), tab);
    ok(n > 10, 'la pestaña «' + tab + '» se renderiza (' + n + ' nodos)');
  }
  const alguna = T.quotesOf()[0];
  T.actOpen(alguna.id);
  const n = render(R.createElement(mounted.Component, {}), 'editor');
  ok(n > 40, 'el editor de una cotización se renderiza (' + n + ' nodos)');
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
