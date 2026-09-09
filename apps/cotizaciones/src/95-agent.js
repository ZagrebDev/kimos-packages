/* ══ AGENTE IA ════════════════════════════════════════════════════════════
 *
 * El agente hace EXACTAMENTE lo que puede hacer una persona, porque despacha
 * a las mismas acciones `act*` que usa la UI (APP-SPEC §5 y §6). No hay un
 * camino paralelo que pueda quedar desincronizado, y como el modelo emite al
 * mutar, la pantalla se repinta sola cuando el agente actúa.
 *
 * Dos criterios que gobiernan todo lo de aquí:
 *
 *   Referencias humanas. Un agente no tiene los ids delante: recibe «la
 *   cotización de la UNAB» o «COT-2026-0007». Cada resolutor acepta id,
 *   número o nombre aproximado, y cuando hay varias coincidencias lo DICE en
 *   vez de elegir una al azar — equivocarse de cotización al cambiarle el
 *   precio es caro.
 *
 *   Todo input se valida. `getSnapshot` da los ids y los datos suficientes
 *   para saber sobre qué actuar ANTES de despachar, y cada acción normaliza
 *   lo que recibe: el agente puede mandar cualquier cosa.
 */

// ── Resolución de referencias ───────────────────────────────────────────
/**
 * Encuentra un documento por id, número o nombre. Devuelve
 * `{ doc }`, `{ error }` o `{ ambiguo: [...] }`.
 */
function resolverDoc(ref, kind) {
  const r = s(ref).trim();
  if (!r) return { error: 'Falta la referencia de la cotización.' };
  const lista = kind ? model.docs.filter((d) => d.kind === kind) : model.docs;

  const porId = lista.find((d) => d.id === r);
  if (porId) return { doc: porId };
  const porNumero = lista.filter((d) => canon(d.number) === canon(r));
  if (porNumero.length === 1) return { doc: porNumero[0] };

  const q = canon(r);
  const exactos = lista.filter((d) => canon(d.name) === q);
  if (exactos.length === 1) return { doc: exactos[0] };
  const parciales = lista.filter((d) => quoteHaystack(d).indexOf(q) !== -1);
  if (parciales.length === 1) return { doc: parciales[0] };
  if (parciales.length > 1) {
    return {
      ambiguo: parciales.slice(0, 8).map((d) => (d.number ? d.number + ' · ' : '') + d.name),
      error: 'Hay ' + parciales.length + ' que coinciden con «' + r + '». Precisa cuál: '
        + parciales.slice(0, 8).map((d) => (d.number ? d.number + ' · ' : '') + d.name).join(' | '),
    };
  }
  return { error: 'No encontré ninguna cotización que coincida con «' + r + '».' };
}

/** Igual, para un ítem del banco propio. */
function resolverCatalogo(ref) {
  const r = s(ref).trim();
  if (!r) return { error: 'Falta la referencia del ítem del catálogo.' };
  const porId = model.catalog.find((c) => c.id === r);
  if (porId) return { item: porId };
  const q = canon(r);
  const cand = model.catalog.filter((c) => !c.archived && canon(c.name + ' ' + c.sku + ' ' + c.group).indexOf(q) !== -1);
  if (cand.length === 1) return { item: cand[0] };
  if (cand.length > 1) return { error: 'Hay varios ítems que coinciden con «' + r + '»: ' + cand.slice(0, 8).map((c) => c.name).join(' | ') };
  return { error: 'No hay ningún ítem del catálogo que coincida con «' + r + '».' };
}

/** Y para un producto del catálogo del sistema. */
function resolverProducto(ref) {
  const r = s(ref).trim();
  if (!r) return { error: 'Falta la referencia del producto.' };
  const porKey = model.ext.products.find((p) => p.key === r || p.id === r);
  if (porKey) return { prod: porKey };
  const q = canon(r);
  const cand = model.ext.products.filter((p) => canon(p.name + ' ' + p.sku).indexOf(q) !== -1);
  if (cand.length === 1) return { prod: cand[0] };
  if (cand.length > 1) return { error: 'Hay varios productos que coinciden con «' + r + '»: ' + cand.slice(0, 8).map((p) => p.name + (p.sku ? ' (' + p.sku + ')' : '')).join(' | ') };
  return { error: 'No hay ningún producto que coincida con «' + r + '». Prueba BUSCAR_PRODUCTOS primero.' };
}

/** Una línea dentro de un documento, por id o por el nombre del ítem. */
function resolverLinea(doc, ref) {
  const r = s(ref).trim();
  const porId = arr(doc.lines).find((l) => l.id === r);
  if (porId) return { line: porId };
  const q = canon(r);
  const cand = arr(doc.lines).filter((l) => canon(l.title).indexOf(q) !== -1);
  if (cand.length === 1) return { line: cand[0] };
  if (cand.length > 1) return { error: 'Hay varias líneas que coinciden con «' + r + '»: ' + cand.map((l) => l.title).join(' | ') };
  return { error: 'No encontré la línea «' + r + '» en esa cotización.' };
}

/**
 * Selección de ProductLab expresada por NOMBRES —que es como la escribe un
 * agente— traducida a los ids que entiende el motor.
 */
function selectionDesdeNombres(prod, entrada) {
  const sel = {};
  const avisos = [];
  if (!isObj(entrada)) return { sel, avisos };
  for (const clave of Object.keys(entrada)) {
    const g = arr(prod.groups).find((x) => x.id === clave || canon(x.label) === canon(clave));
    if (!g) { avisos.push('El producto no tiene el paso «' + clave + '».'); continue; }
    const valorRef = s(entrada[clave]);
    const v = arr(g.values).find((x) => x.id === valorRef || canon(x.name) === canon(valorRef));
    if (!v) {
      avisos.push('«' + valorRef + '» no es un valor de ' + g.label + '. Opciones: ' + g.values.map((x) => x.name).join(', '));
      continue;
    }
    sel[g.id] = v.id;
  }
  return { sel, avisos };
}

// ── Retrato del estado ──────────────────────────────────────────────────
/** Resumen de una cotización para el agente: ids y lo justo para decidir. */
function retratoDoc(d, rules, detallado) {
  const t = computeTotals(d, rules);
  const base = {
    id: d.id,
    numero: d.number,
    nombre: d.name,
    asunto: d.subtitle,
    estado: effectiveStatus(d, rules),
    estadoTexto: STATUS_LABEL.get(effectiveStatus(d, rules)),
    cliente: d.client.name,
    fecha: d.date,
    venceEl: validUntilOf(d, rules),
    lineas: arr(d.lines).length,
    total: t.total,
    totalTexto: money(t.total, t.currency),
    moneda: t.currency.code,
  };
  if (d.revision) base.revision = d.revision;
  if (d.supersededBy) base.sustituidaPor = d.supersededBy;
  if (d.publicUrl) base.enlace = d.publicUrl;
  if (!detallado) return base;
  return Object.assign(base, {
    clienteFicha: d.client,
    subtotal: t.subtotal,
    impuesto: t.tax,
    impuestoPct: t.taxPct,
    abono: t.advanceEnabled ? t.advance : null,
    saldo: t.advanceEnabled ? t.balance : null,
    descuento: t.discount,
    notas: d.notes,
    datosDePago: d.paymentInfo,
    items: arr(d.lines).map((l) => ({
      id: l.id,
      titulo: l.title,
      descripcion: l.description,
      cantidad: l.qty,
      cantidadTexto: l.qtyLabel,
      precioUnitario: l.unitPrice,
      totalLinea: lineDisplayTotal(l, { taxPct: t.taxPct, priceMode: rules.priceMode }),
      exento: !l.taxable,
      opcional: l.optional,
      origen: l.source.kind,
      combinacion: arr(l.source.selection).map((x) => x.stepName + ': ' + x.valueName),
    })),
    bloques: bloquesDe(d).map((b) => ({ id: b.id, tipo: b.type, ancho: b.w })),
    historial: arr(d.events).slice(-10),
  });
}

function agentSnapshot() {
  const rules = rulesOf();
  const issuer = issuerOf();
  const abierta = openDoc();
  const resumen = pipelineSummary();
  const cur = currencyOf(null, rules);
  return {
    version: APP_VERSION,
    cotizador: {
      nombre: model.docName,
      emisor: { nombre: issuer.name, rut: issuer.taxId, correo: issuer.email },
      moneda: rules.currency,
      impuesto: rules.taxPct,
      impuestoNombre: rules.taxLabel,
      preciosSeEscriben: rules.priceMode === 'gross' ? 'con impuesto incluido' : 'netos',
      vigenciaPorDefecto: rules.validDays + (rules.validBusinessDays ? ' días hábiles' : ' días'),
      abonoPct: rules.advanceEnabled ? rules.advancePct : null,
      siguienteNumero: nextNumber(model.docs, rules).number,
      emisorConfigurado: !!issuer.name,
    },
    vista: { pestaña: model.tab, editor: model.editorView, busqueda: model.search, filtroEstado: model.filterStatus },
    abierta: abierta ? retratoDoc(abierta, rules, true) : null,
    resumen: {
      cotizaciones: resumen.count,
      enJuego: money(resumen.open, cur),
      ganado: money(resumen.won, cur),
      total: money(resumen.total, cur),
      porEstado: Object.keys(resumen.byStatus).reduce((acc, k) => {
        acc[STATUS_LABEL.get(k) || k] = resumen.byStatus[k].count;
        return acc;
      }, {}),
    },
    // Solo las últimas: el retrato tiene que caber en el contexto del agente.
    cotizaciones: quotesOf().slice()
      .sort((a, b) => s(b.date).localeCompare(s(a.date)))
      .slice(0, 25)
      .map((d) => retratoDoc(d, rules, false)),
    plantillas: templatesOf().map((d) => ({ id: d.id, nombre: d.name, lineas: d.lines.length, predeterminada: d.isDefault })),
    catalogoPropio: model.catalog.filter((c) => !c.archived).slice(0, 60)
      .map((c) => ({ id: c.id, nombre: c.name, grupo: c.group, precio: c.unitPrice, usos: c.usageCount })),
    catalogoDelSistema: model.ext.loaded
      ? {
        cargado: true,
        productos: model.ext.products.slice(0, 60).map((p) => ({
          id: p.key, nombre: p.name, sku: p.sku, origen: p.source, precio: p.price,
          pasos: arr(p.groups).map((g) => ({ paso: g.label, valores: g.values.map((v) => v.name) })),
        })),
      }
      : { cargado: false, nota: 'Usa BUSCAR_PRODUCTOS o RECARGAR_CATALOGO para leer Productos y ProductLab.' },
    plantillasDeCorreo: model.mails.map((x) => ({ id: x.id, nombre: x.name, asunto: x.subject, predeterminada: x.isDefault })),
    requiereAtencion: requiereAtencion(quotesOf(), rules).slice(0, 10)
      .map((x) => ({ id: x.doc.id, numero: x.doc.number, nombre: x.doc.name, motivo: x.motivo })),
    variablesDeCorreo: MAIL_VARS.map(([k, label]) => '{{' + k + '}} — ' + label),
    tiposDeBloque: BLOCK_TYPES.map((b) => b.type),
  };
}

// ── Herramientas ────────────────────────────────────────────────────────
const T_STR = { type: 'string' };
const T_NUM = { type: 'number' };
const T_BOOL = { type: 'boolean' };
const tool = (name, description, props, required) => ({
  name, description,
  inputSchema: { type: 'object', properties: props || {}, required: required || [] },
});

const AGENT_TOOLS = [
  tool('BUSCAR_COTIZACIONES', 'Busca cotizaciones por texto (cliente, número, ítem) y/o estado. Devuelve ids para actuar sobre ellas.',
    { texto: T_STR, estado: { type: 'string', enum: STATUSES.map(([k]) => k) }, limite: T_NUM }),
  tool('VER_COTIZACION', 'Devuelve el detalle completo de una cotización: líneas, totales, notas e historial.',
    { cotizacion: T_STR }, ['cotizacion']),
  tool('ABRIR_COTIZACION', 'Abre una cotización en el editor, a la vista de la persona.',
    { cotizacion: T_STR }, ['cotizacion']),
  tool('IR_A', 'Cambia de pestaña: quotes, templates, catalog, mails, board o settings.',
    { pestaña: { type: 'string', enum: TAB_IDS }, vistaEditor: { type: 'string', enum: ['data', 'design'] } }),

  tool('CREAR_COTIZACION', 'Crea una cotización. Con `plantilla` la replica; `items` permite crearla ya con sus líneas.', {
    nombre: T_STR, asunto: T_STR, plantilla: T_STR,
    cliente: T_STR, clienteRut: T_STR, clienteCorreo: T_STR, clienteContacto: T_STR,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { titulo: T_STR, descripcion: T_STR, cantidad: T_NUM, precioUnitario: T_NUM, unidad: T_STR, exento: T_BOOL, opcional: T_BOOL },
        required: ['titulo'],
      },
    },
  }),
  tool('DUPLICAR_COTIZACION', 'Replica una cotización existente en una nueva, en borrador y con número propio.',
    { cotizacion: T_STR, nombre: T_STR, quitarCliente: T_BOOL }, ['cotizacion']),
  tool('CREAR_REVISION', 'Emite una revisión de una cotización ya enviada. La original se conserva tal cual y queda marcada como sustituida.',
    { cotizacion: T_STR }, ['cotizacion']),
  tool('GUARDAR_COMO_PLANTILLA', 'Guarda una cotización como cotización tipo reutilizable.',
    { cotizacion: T_STR, nombre: T_STR }, ['cotizacion']),
  tool('ELIMINAR_COTIZACION', 'Elimina una cotización. No se puede deshacer.',
    { cotizacion: T_STR }, ['cotizacion']),

  tool('ACTUALIZAR_COTIZACION', 'Cambia los datos de cabecera: nombre, asunto, fecha, vigencia, impuesto, descuentos, abono, notas o datos de pago.', {
    cotizacion: T_STR, nombre: T_STR, asunto: T_STR, fecha: T_STR, diasDeVigencia: T_NUM,
    impuestoPct: T_NUM, descuentoPct: T_NUM, descuentoMonto: T_NUM, abonoPct: T_NUM,
    notas: { type: 'array', items: T_STR }, datosDePago: T_STR,
  }, ['cotizacion']),
  tool('ACTUALIZAR_CLIENTE', 'Cambia la ficha del cliente de una cotización.',
    { cotizacion: T_STR, nombre: T_STR, rut: T_STR, contacto: T_STR, correo: T_STR, telefono: T_STR, direccion: T_STR }, ['cotizacion']),
  tool('VINCULAR_CLIENTE', 'Reconoce al cliente de la cotización en todo KIMOS: si ya existe (mismo RUT o correo) lo reutiliza, y si no, lo registra. Con `guardarEnDirectorio` además crea su ficha en la app Clientes.',
    { cotizacion: T_STR, guardarEnDirectorio: T_BOOL, directorio: T_STR }, ['cotizacion']),
  tool('ACTUALIZAR_CLIENTE_DESDE_DIRECTORIO', 'Vuelve a leer el cliente vinculado y refresca su ficha en la cotización (por si cambió de nombre o se fusionó con otro).',
    { cotizacion: T_STR }, ['cotizacion']),
  tool('CAMBIAR_ESTADO', 'Cambia el estado: draft, sent, accepted, rejected o expired.',
    { cotizacion: T_STR, estado: { type: 'string', enum: STATUSES.map(([k]) => k) }, nota: T_STR }, ['cotizacion', 'estado']),

  tool('AGREGAR_ITEM', 'Añade una línea escrita a mano a la cotización.',
    { cotizacion: T_STR, titulo: T_STR, descripcion: T_STR, cantidad: T_NUM, cantidadTexto: T_STR, unidad: T_STR, precioUnitario: T_NUM, exento: T_BOOL, opcional: T_BOOL, posicion: T_NUM },
    ['cotizacion', 'titulo']),
  tool('ACTUALIZAR_ITEM', 'Cambia una línea existente. `item` acepta su id o el nombre del ítem.',
    { cotizacion: T_STR, item: T_STR, titulo: T_STR, descripcion: T_STR, cantidad: T_NUM, cantidadTexto: T_STR, precioUnitario: T_NUM, descuentoPct: T_NUM, exento: T_BOOL, opcional: T_BOOL },
    ['cotizacion', 'item']),
  tool('QUITAR_ITEM', 'Quita una línea de la cotización.', { cotizacion: T_STR, item: T_STR }, ['cotizacion', 'item']),
  tool('MOVER_ITEM', 'Reordena una línea dentro de la cotización (posición desde 0).',
    { cotizacion: T_STR, item: T_STR, posicion: T_NUM }, ['cotizacion', 'item', 'posicion']),

  tool('BUSCAR_PRODUCTOS', 'Busca en el catálogo del sistema (apps Productos y ProductLab). Devuelve sus pasos y valores para poder configurarlos.',
    { texto: T_STR, limite: T_NUM }),
  tool('AGREGAR_PRODUCTO', 'Cotiza un producto del catálogo del sistema. `combinacion` usa nombres de paso y de valor, p. ej. { "Pantalla": "43 pulgadas" }.',
    { cotizacion: T_STR, producto: T_STR, combinacion: { type: 'object' }, cantidad: T_NUM }, ['cotizacion', 'producto']),
  tool('AGREGAR_DEL_CATALOGO', 'Inserta un ítem o servicio del banco propio como línea.',
    { cotizacion: T_STR, item: T_STR, cantidad: T_NUM }, ['cotizacion', 'item']),
  tool('GUARDAR_ITEM_EN_CATALOGO', 'Guarda una línea de la cotización en el banco propio para reutilizarla.',
    { cotizacion: T_STR, item: T_STR, grupo: T_STR }, ['cotizacion', 'item']),
  tool('ACTUALIZAR_PRECIO_DESDE_CATALOGO', 'Vuelve a preguntarle el precio al catálogo para una línea que salió de él.',
    { cotizacion: T_STR, item: T_STR }, ['cotizacion', 'item']),

  tool('AGREGAR_BLOQUE', 'Añade un bloque al lienzo de la propuesta (texto, imagen, separador, salto de página…).',
    { cotizacion: T_STR, tipo: { type: 'string', enum: BLOCK_TYPES.map((b) => b.type) }, texto: T_STR, url: T_STR, ancho: T_NUM, posicion: T_NUM, tamaño: T_STR, alineacion: T_STR },
    ['cotizacion', 'tipo']),
  tool('ACTUALIZAR_BLOQUE', 'Cambia un bloque del lienzo.',
    { cotizacion: T_STR, bloque: T_STR, texto: T_STR, url: T_STR, ancho: T_NUM, tamaño: T_STR, alineacion: T_STR, titulo: T_STR }, ['cotizacion', 'bloque']),
  tool('QUITAR_BLOQUE', 'Quita un bloque del lienzo.', { cotizacion: T_STR, bloque: T_STR }, ['cotizacion', 'bloque']),

  tool('EXPORTAR_PDF', 'Abre la ventana de impresión con la propuesta lista para guardar como PDF.', { cotizacion: T_STR }, ['cotizacion']),
  tool('PUBLICAR_ENLACE', 'Publica la propuesta como página y devuelve su enlace público.', { cotizacion: T_STR }, ['cotizacion']),
  tool('PREPARAR_CORREO', 'Resuelve una plantilla de correo contra la cotización y devuelve destinatario, asunto y cuerpo, SIN enviar nada.',
    { cotizacion: T_STR, plantilla: T_STR }, ['cotizacion']),
  tool('ENVIAR_CORREO', 'Envía la cotización por correo. Confirma con la persona antes de usarla: manda un correo real desde el buzón de la empresa.',
    { cotizacion: T_STR, para: T_STR, copia: T_STR, asunto: T_STR, mensaje: T_STR, incluirEnlace: T_BOOL, plantilla: T_STR }, ['cotizacion']),

  tool('RESUMEN', 'Estado del embudo: valor en juego, ganado, reparto por estado y qué requiere atención.', {}),
  tool('RECARGAR_CATALOGO', 'Vuelve a leer los catálogos de Productos, ProductLab y Clientes.', {}),
];

// ── Despacho ────────────────────────────────────────────────────────────
const okMsg = (message, extra) => Object.assign({ success: true, message }, isObj(extra) ? extra : {});
const errMsg = (error) => ({ success: false, error });

/** Aplica al patch solo las claves que el agente mandó (no las omitidas). */
function tomar(payload, mapa) {
  const out = {};
  for (const clave of Object.keys(mapa)) {
    const v = payload[clave];
    if (v === undefined) continue;
    const [destino, transformar] = mapa[clave];
    out[destino] = transformar ? transformar(v) : v;
  }
  return out;
}

async function agentDispatch(action) {
  const tipo = s(action && action.type).toUpperCase();
  const p = isObj(action && action.payload) ? action.payload : {};
  const rules = rulesOf();

  // Resolutor común: casi todas las tools operan sobre una cotización.
  const conDoc = (kind) => {
    const r = resolverDoc(p.cotizacion, kind);
    return r.doc ? r.doc : null;
  };
  const errDoc = (kind) => resolverDoc(p.cotizacion, kind).error;

  switch (tipo) {
    case 'BUSCAR_COTIZACIONES': {
      const limite = clamp(Math.round(num(p.limite, 20)), 1, 60);
      const q = canon(p.texto);
      const estado = isStatus(p.estado) ? p.estado : '';
      const list = quotesOf()
        .filter((d) => !q || quoteHaystack(d).indexOf(q) !== -1)
        .filter((d) => !estado || effectiveStatus(d, rules) === estado)
        .sort((a, b) => s(b.date).localeCompare(s(a.date)))
        .slice(0, limite)
        .map((d) => retratoDoc(d, rules, false));
      return okMsg(list.length + ' cotización(es) encontradas.', { resultados: list });
    }

    case 'VER_COTIZACION': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      return okMsg('Detalle de ' + (r.doc.number || r.doc.name) + '.', { cotizacion: retratoDoc(r.doc, rules, true) });
    }

    case 'ABRIR_COTIZACION': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      actOpen(r.doc.id);
      return okMsg('Abierta ' + (r.doc.number || r.doc.name) + ' en pantalla.');
    }

    case 'IR_A': {
      if (s(p.pestaña)) actSetTab(p.pestaña);
      if (s(p.vistaEditor)) actSetEditorView(p.vistaEditor);
      return okMsg('Vista: ' + model.tab + (model.openId ? ' · editor en ' + model.editorView : '') + '.');
    }

    case 'CREAR_COTIZACION': {
      let templateId = '';
      if (s(p.plantilla)) {
        const r = resolverDoc(p.plantilla);
        if (!r.doc) return errMsg(r.error);
        templateId = r.doc.id;
      }
      const doc = actNewQuote({
        name: s(p.nombre),
        subtitle: s(p.asunto),
        templateId,
        client: {
          name: s(p.cliente), taxId: s(p.clienteRut),
          email: s(p.clienteCorreo), contact: s(p.clienteContacto),
        },
        lines: arr(p.items).map((it) => normalizeLine({
          title: s(it.titulo), description: s(it.descripcion),
          qty: it.cantidad == null ? 1 : num(it.cantidad),
          unitPrice: num(it.precioUnitario), unit: s(it.unidad),
          taxable: it.exento !== true, optional: it.opcional === true,
        })),
      });
      if (!doc) return errMsg('No se pudo crear la cotización.');
      const t = computeTotals(doc, rules);
      return okMsg('Creada ' + doc.number + ' «' + doc.name + '» con ' + doc.lines.length
        + ' línea(s), total ' + money(t.total, t.currency) + '.', { cotizacion: retratoDoc(doc, rules, false) });
    }

    case 'DUPLICAR_COTIZACION': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const copia = actDuplicate(r.doc.id, { name: s(p.nombre), clearClient: p.quitarCliente === true });
      if (!copia) return errMsg('No se pudo duplicar.');
      return okMsg('Duplicada en ' + copia.number + ' «' + copia.name + '».', { cotizacion: retratoDoc(copia, rules, false) });
    }

    case 'CREAR_REVISION': {
      const r = resolverDoc(p.cotizacion, KIND_QUOTE);
      if (!r.doc) return errMsg(r.error);
      if (r.doc.status === 'draft') return errMsg('Esa cotización sigue en borrador: edítala directamente en vez de revisarla. Las revisiones son para lo que ya salió.');
      const rev = actNewRevision(r.doc.id);
      if (!rev) return errMsg('No se pudo crear la revisión.');
      return okMsg('Revisión ' + rev.revision + ' creada: ' + rev.number + '.', { cotizacion: retratoDoc(rev, rules, false) });
    }

    case 'GUARDAR_COMO_PLANTILLA': {
      const r = resolverDoc(p.cotizacion, KIND_QUOTE);
      if (!r.doc) return errMsg(r.error);
      const t = actSaveAsTemplate(r.doc.id, s(p.nombre));
      return t ? okMsg('Guardada como cotización tipo «' + t.name + '».', { plantillaId: t.id }) : errMsg('No se pudo guardar como plantilla.');
    }

    case 'ELIMINAR_COTIZACION': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const nombre = (r.doc.number || '') + ' ' + r.doc.name;
      return actRemoveDoc(r.doc.id) ? okMsg('Eliminada ' + nombre.trim() + '.') : errMsg('No se pudo eliminar.');
    }

    case 'ACTUALIZAR_COTIZACION': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const patch = tomar(p, {
        nombre: ['name', s], asunto: ['subtitle', s], fecha: ['date', isoDate],
        diasDeVigencia: ['validDays', (v) => clamp(Math.round(num(v)), 0, 3650)],
        impuestoPct: ['taxPct', (v) => clamp(num(v), 0, 100)],
        descuentoPct: ['discountPct', (v) => clamp(num(v), 0, 100)],
        descuentoMonto: ['discountAmount', (v) => Math.max(0, num(v))],
        abonoPct: ['advancePct', (v) => clamp(num(v), 0, 100)],
        notas: ['notes', (v) => arr(v).map(s)],
        datosDePago: ['paymentInfo', s],
      });
      if (!Object.keys(patch).length) return errMsg('No mandaste ningún campo que cambiar.');
      if (patch.validDays !== undefined) patch.validUntil = '';   // recalcular desde la vigencia
      const out = actPatchDoc(r.doc.id, patch);
      if (!out) return errMsg('No se pudo actualizar.');
      const t = computeTotals(out, rules);
      return okMsg('Actualizada ' + (out.number || out.name) + '. Total: ' + money(t.total, t.currency) + '.',
        { cotizacion: retratoDoc(out, rules, false) });
    }

    case 'ACTUALIZAR_CLIENTE': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const patch = tomar(p, {
        nombre: ['name', s], rut: ['taxId', s], contacto: ['contact', s],
        correo: ['email', s], telefono: ['phone', s], direccion: ['address', s],
      });
      if (!Object.keys(patch).length) return errMsg('No mandaste ningún dato del cliente.');
      const out = actPatchClient(r.doc.id, patch);
      return out ? okMsg('Cliente actualizado: ' + (out.client.name || '—') + '.') : errMsg('No se pudo actualizar el cliente.');
    }

    case 'VINCULAR_CLIENTE': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const motivo = registroNoDisponible();
      if (motivo) return errMsg(motivo);
      if (p.guardarEnDirectorio) {
        // Guardar en el directorio ya vincula al final, así que no se hacen
        // las dos cosas: se haría el findOrCreate dos veces.
        const item = await actPushClientToDirectory(r.doc.id, s(p.directorio));
        if (!item) return errMsg('No se pudo guardar el cliente en el directorio.');
        const d = docById(r.doc.id);
        return okMsg('Cliente guardado en el directorio y vinculado: ' + s(d.client.name) + '.',
          { referencia: s(d.client.recordRef), fichaId: s(item.id) });
      }
      const res = await actLinkClientRecord(r.doc.id, { silent: true });
      if (!res) return errMsg('No se pudo vincular. Comprueba que el cliente tenga al menos un nombre.');
      return okMsg(
        res.created
          ? 'Cliente registrado en el sistema: ' + s(r.doc.client.name) + '.'
          : 'Vinculado con «' + (s(res.record && res.record.label) || s(r.doc.client.name)) + '», que ya existía.',
        { referencia: res.ref, creado: res.created, aviso: res.warning || undefined },
      );
    }

    case 'ACTUALIZAR_CLIENTE_DESDE_DIRECTORIO': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      if (!s(r.doc.client.recordRef)) return errMsg('Esa cotización no tiene el cliente vinculado; usa VINCULAR_CLIENTE primero.');
      const out = await actRefreshClientRecord(r.doc.id);
      if (!out) return errMsg('No se pudo refrescar el cliente desde el directorio.');
      return okMsg('Cliente actualizado desde el directorio: ' + s(out.client.name) + '.',
        { referencia: s(out.client.recordRef) });
    }

    case 'CAMBIAR_ESTADO': {
      const r = resolverDoc(p.cotizacion, KIND_QUOTE);
      if (!r.doc) return errMsg(r.error);
      if (!isStatus(p.estado)) return errMsg('Estado no válido. Usa: ' + STATUSES.map(([k]) => k).join(', ') + '.');
      const out = actSetStatus(r.doc.id, p.estado, s(p.nota));
      return out ? okMsg((out.number || out.name) + ' → ' + STATUS_LABEL.get(p.estado) + '.') : errMsg('No se pudo cambiar el estado.');
    }

    case 'AGREGAR_ITEM': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      if (!s(p.titulo).trim()) return errMsg('La línea necesita un título.');
      const l = actAddLine(r.doc.id, {
        title: s(p.titulo), description: s(p.descripcion),
        qty: p.cantidad == null ? 1 : num(p.cantidad),
        qtyLabel: s(p.cantidadTexto), unit: s(p.unidad),
        unitPrice: num(p.precioUnitario),
        taxable: p.exento !== true, optional: p.opcional === true,
      }, p.posicion);
      if (!l) return errMsg('No se pudo añadir la línea.');
      const t = computeTotals(docById(r.doc.id), rules);
      return okMsg('Añadido «' + l.title + '». Nuevo total: ' + money(t.total, t.currency) + '.', { itemId: l.id });
    }

    case 'ACTUALIZAR_ITEM': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const rl = resolverLinea(r.doc, p.item);
      if (!rl.line) return errMsg(rl.error);
      const patch = tomar(p, {
        titulo: ['title', s], descripcion: ['description', s],
        cantidad: ['qty', (v) => Math.max(0, num(v))], cantidadTexto: ['qtyLabel', s],
        precioUnitario: ['unitPrice', num], descuentoPct: ['discountPct', (v) => clamp(num(v), 0, 100)],
        exento: ['taxable', (v) => v !== true], opcional: ['optional', (v) => v === true],
      });
      if (!Object.keys(patch).length) return errMsg('No mandaste ningún campo que cambiar en la línea.');
      const out = actUpdateLine(r.doc.id, rl.line.id, patch);
      if (!out) return errMsg('No se pudo actualizar la línea.');
      const t = computeTotals(docById(r.doc.id), rules);
      return okMsg('«' + out.title + '» actualizado. Nuevo total: ' + money(t.total, t.currency) + '.');
    }

    case 'QUITAR_ITEM': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const rl = resolverLinea(r.doc, p.item);
      if (!rl.line) return errMsg(rl.error);
      const titulo = rl.line.title;
      if (!actRemoveLine(r.doc.id, rl.line.id)) return errMsg('No se pudo quitar la línea.');
      const t = computeTotals(docById(r.doc.id), rules);
      return okMsg('Quitado «' + titulo + '». Nuevo total: ' + money(t.total, t.currency) + '.');
    }

    case 'MOVER_ITEM': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const rl = resolverLinea(r.doc, p.item);
      if (!rl.line) return errMsg(rl.error);
      return actMoveLine(r.doc.id, rl.line.id, p.posicion)
        ? okMsg('«' + rl.line.title + '» movido a la posición ' + Math.round(num(p.posicion)) + '.')
        : errMsg('No se pudo mover la línea.');
    }

    case 'BUSCAR_PRODUCTOS': {
      await loadExternalCatalog(false);
      const q = canon(p.texto);
      const limite = clamp(Math.round(num(p.limite, 15)), 1, 50);
      const list = model.ext.products
        .filter((x) => !q || canon(x.name + ' ' + x.sku + ' ' + x.brand).indexOf(q) !== -1)
        .slice(0, limite)
        .map((x) => ({
          id: x.key, nombre: x.name, sku: x.sku, origen: x.source,
          precioCatalogo: x.price,
          precioParaCotizar: roundTo(precioParaCotizar(x.price, rules), currencyOf(null, rules).decimals),
          pasos: arr(x.groups).map((g) => ({ paso: g.label, valores: g.values.map((v) => v.name + (v.delta ? ' (+' + v.delta + ')' : '')) })),
        }));
      if (!model.ext.products.length) return errMsg(model.ext.error || 'No hay productos accesibles en las apps Productos ni ProductLab.');
      return okMsg(list.length + ' producto(s).', { productos: list });
    }

    case 'AGREGAR_PRODUCTO': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      await loadExternalCatalog(false);
      const rp = resolverProducto(p.producto);
      if (!rp.prod) return errMsg(rp.error);
      const { sel, avisos } = selectionDesdeNombres(rp.prod, p.combinacion);
      // Un aviso NO se traga: si el agente pidió una combinación que no
      // existe, se le dice antes de cotizar algo que no es lo que pidió.
      if (avisos.length) return errMsg(avisos.join(' '));
      const l = actAddProductToQuote(r.doc.id, rp.prod.key, { selection: sel, qty: p.cantidad == null ? 1 : num(p.cantidad) });
      if (!l) return errMsg('No se pudo añadir el producto.');
      const t = computeTotals(docById(r.doc.id), rules);
      return okMsg('Añadido «' + l.title + '»'
        + (l.source.selection.length ? ' (' + l.source.selection.map((x) => x.stepName + ': ' + x.valueName).join(', ') + ')' : '')
        + ' a ' + money(l.unitPrice, t.currency) + ' c/u. Nuevo total: ' + money(t.total, t.currency) + '.', { itemId: l.id });
    }

    case 'AGREGAR_DEL_CATALOGO': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const rc = resolverCatalogo(p.item);
      if (!rc.item) return errMsg(rc.error);
      const l = actAddCatalogToQuote(r.doc.id, rc.item.id, p.cantidad == null ? {} : { qty: Math.max(0, num(p.cantidad)) });
      if (!l) return errMsg('No se pudo insertar el ítem.');
      const t = computeTotals(docById(r.doc.id), rules);
      return okMsg('Añadido «' + l.title + '». Nuevo total: ' + money(t.total, t.currency) + '.', { itemId: l.id });
    }

    case 'GUARDAR_ITEM_EN_CATALOGO': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const rl = resolverLinea(r.doc, p.item);
      if (!rl.line) return errMsg(rl.error);
      const it = actSaveLineToCatalog(r.doc.id, rl.line.id, s(p.grupo));
      return it ? okMsg('«' + it.name + '» guardado en el catálogo propio.', { catalogoId: it.id }) : errMsg('No se pudo guardar en el catálogo.');
    }

    case 'ACTUALIZAR_PRECIO_DESDE_CATALOGO': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const rl = resolverLinea(r.doc, p.item);
      if (!rl.line) return errMsg(rl.error);
      if (rl.line.source.kind === 'manual') return errMsg('Esa línea se escribió a mano: no viene de ningún catálogo.');
      const antes = rl.line.unitPrice;
      const out = actRefreshLinePrice(r.doc.id, rl.line.id);
      if (!out) return errMsg('No se pudo actualizar el precio: el origen ya no está en el catálogo.');
      const cur = currencyOf(r.doc, rules);
      return okMsg(out.unitPrice === antes
        ? 'El precio del catálogo no ha cambiado (' + money(antes, cur) + ').'
        : 'Precio actualizado: ' + money(antes, cur) + ' → ' + money(out.unitPrice, cur) + '.');
    }

    case 'AGREGAR_BLOQUE': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      if (!BLOCK_BY_TYPE.has(s(p.tipo))) return errMsg('Tipo de bloque no válido. Usa: ' + BLOCK_TYPES.map((b) => b.type).join(', ') + '.');
      const b = actAddBlock(r.doc.id, p.tipo, p.posicion, {
        text: s(p.texto), url: s(p.url),
        w: p.ancho == null ? undefined : clamp(Math.round(num(p.ancho)), 1, GRID_COLS),
        size: s(p.tamaño), align: s(p.alineacion),
      });
      return b ? okMsg('Bloque «' + p.tipo + '» añadido al lienzo.', { bloqueId: b.id }) : errMsg('No se pudo añadir el bloque.');
    }

    case 'ACTUALIZAR_BLOQUE': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const patch = tomar(p, {
        texto: ['text', s], url: ['url', s], titulo: ['title', s],
        ancho: ['w', (v) => clamp(Math.round(num(v)), 1, GRID_COLS)],
        tamaño: ['size', s], alineacion: ['align', s],
      });
      if (!Object.keys(patch).length) return errMsg('No mandaste ningún cambio para el bloque.');
      const b = actUpdateBlock(r.doc.id, p.bloque, patch);
      return b ? okMsg('Bloque actualizado.') : errMsg('No encontré ese bloque en el lienzo.');
    }

    case 'QUITAR_BLOQUE': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      return actRemoveBlock(r.doc.id, p.bloque) ? okMsg('Bloque quitado del lienzo.') : errMsg('No encontré ese bloque en el lienzo.');
    }

    case 'EXPORTAR_PDF': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const ok = await actExportPdf(r.doc.id);
      return ok
        ? okMsg('Ventana de impresión abierta con ' + (r.doc.number || r.doc.name) + '. La persona elige «Guardar como PDF».')
        : errMsg('No se pudo abrir la ventana de impresión; puede que el navegador la haya bloqueado.');
    }

    case 'PUBLICAR_ENLACE': {
      const r = resolverDoc(p.cotizacion);
      if (!r.doc) return errMsg(r.error);
      const url = await actPublishQuote(r.doc.id);
      return url ? okMsg('Propuesta publicada.', { enlace: url }) : errMsg('No se pudo publicar la propuesta.');
    }

    case 'PREPARAR_CORREO': {
      const r = resolverDoc(p.cotizacion, KIND_QUOTE);
      if (!r.doc) return errMsg(r.error);
      let tpl = null;
      if (s(p.plantilla)) {
        tpl = model.mails.find((x) => x.id === s(p.plantilla) || canon(x.name) === canon(p.plantilla)) || null;
        if (!tpl) return errMsg('No encontré la plantilla de correo «' + s(p.plantilla) + '».');
      }
      const correo = resolverCorreo(tpl || defaultMailTemplate(), r.doc);
      return okMsg('Correo preparado (sin enviar).', { correo });
    }

    case 'ENVIAR_CORREO': {
      const r = resolverDoc(p.cotizacion, KIND_QUOTE);
      if (!r.doc) return errMsg(r.error);
      let tpl = null;
      if (s(p.plantilla)) {
        tpl = model.mails.find((x) => x.id === s(p.plantilla) || canon(x.name) === canon(p.plantilla)) || null;
        if (!tpl) return errMsg('No encontré la plantilla de correo «' + s(p.plantilla) + '».');
      }
      const base = resolverCorreo(tpl || defaultMailTemplate(), r.doc);
      const correo = Object.assign({}, base, tomar(p, {
        para: ['to', s], copia: ['cc', s], asunto: ['subject', s], mensaje: ['body', s],
        incluirEnlace: ['includeLink', (v) => v === true],
      }));
      if (!s(correo.to).trim()) return errMsg('Falta el destinatario: la cotización no tiene correo de cliente y no mandaste `para`.');
      const res = await actSendMail(r.doc.id, Object.assign({}, correo, { link: r.doc.publicUrl }));
      return res.ok ? okMsg('Cotización enviada a ' + res.to + '.') : errMsg(res.error);
    }

    case 'RESUMEN': {
      const resumen = pipelineSummary();
      const cur = currencyOf(null, rules);
      return okMsg('En juego ' + money(resumen.open, cur) + ' · ganado ' + money(resumen.won, cur)
        + ' · ' + resumen.count + ' cotización(es).', {
        resumen: {
          enJuego: money(resumen.open, cur), ganado: money(resumen.won, cur),
          total: money(resumen.total, cur),
          porEstado: Object.keys(resumen.byStatus).reduce((acc, k) => {
            acc[STATUS_LABEL.get(k) || k] = resumen.byStatus[k];
            return acc;
          }, {}),
        },
        requiereAtencion: requiereAtencion(quotesOf(), rules).slice(0, 10)
          .map((x) => ({ id: x.doc.id, numero: x.doc.number, nombre: x.doc.name, motivo: x.motivo })),
      });
    }

    case 'RECARGAR_CATALOGO': {
      await loadExternalCatalog(true);
      await loadCustomers(true);
      if (model.ext.error) return errMsg(model.ext.error);
      return okMsg(model.ext.products.length + ' producto(s) y ' + model.ext.customers.length + ' cliente(s) leídos.');
    }

    default:
      return errMsg('No conozco la acción «' + tipo + '». Disponibles: ' + AGENT_TOOLS.map((t) => t.name).join(', ') + '.');
  }
}

/** Registra la app en el puente de agentes mientras la ventana esté abierta. */
function registrarAgente() {
  if (!shell.agent || typeof shell.agent.register !== 'function') return null;
  return shell.agent.register({
    label: 'Cotizaciones',
    description: 'Crea, edita, replica, revisa, exporta y envía cotizaciones. Puede cotizar productos '
      + 'del catálogo del sistema (Productos y ProductLab) eligiendo su combinación, componer la '
      + 'propuesta visualmente y consultar el estado del embudo. Las cotizaciones se identifican por '
      + 'número, nombre o cliente; si hay varias que coinciden, lo dice en vez de elegir una. '
      + 'ENVIAR_CORREO manda un correo real desde el buzón de la empresa: confírmalo antes.',
    tools: AGENT_TOOLS,
    getSnapshot: agentSnapshot,
    dispatchAction: agentDispatch,
  });
}
