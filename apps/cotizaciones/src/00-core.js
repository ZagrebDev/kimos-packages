/* ══ NÚCLEO ═══════════════════════════════════════════════════════════════
 *
 * Modelo de datos: **una instancia = un cotizador** (el espacio de trabajo de
 * un equipo). Todo lo que vive dentro son *items* de esa instancia
 * (`shell.items`), distinguidos por su campo `kind`:
 *
 *   definition   Ajustes del cotizador: emisor, correlativo, reglas de precio,
 *                pie de pago. Item único (se crea al vuelo la primera vez).
 *   quote        Una cotización.
 *   template     Una cotización tipo, reutilizable (misma forma que `quote`).
 *   catalog      Un ítem o servicio prefijado del banco propio.
 *   mail         Una plantilla de correo.
 *
 * Se eligió item-por-cotización y no un único blob con `saveData` por las
 * mismas razones que WorkOffice: dos personas que editan cotizaciones
 * distintas escriben registros distintos (APP-SPEC §5.1), y el peso del
 * cotizador entero no entra en cada guardado.
 *
 * Este fragmento no toca red ni React: solo utilidades puras, normalización
 * del modelo y el motor de totales. Se puede razonar (y probar) aparte.
 */

// ── Constantes del modelo ───────────────────────────────────────────────
const KIND_QUOTE = 'quote';
const KIND_TEMPLATE = 'template';
const KIND_CATALOG = 'catalog';
const KIND_MAIL = 'mail';
const KIND_DEF = 'definition';

/** Estados del ciclo de vida de una cotización (el orden es el del tablero). */
const STATUSES = [
  ['draft', 'Borrador', '#6B7280'],
  ['sent', 'Enviada', '#2563EB'],
  ['accepted', 'Aceptada', '#0B8A42'],
  ['rejected', 'Rechazada', '#C40000'],
  ['expired', 'Vencida', '#B36B00'],
];
const STATUS_LABEL = new Map(STATUSES.map(([k, l]) => [k, l]));
const STATUS_COLOR = new Map(STATUSES.map(([k, , c]) => [k, c]));
const isStatus = (v) => STATUS_LABEL.has(v);

/** Ventana de vida de una lápida: pasado ese plazo ya nadie la necesita. */
const TOMB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Espera antes de persistir una edición (se agrupan las teclas seguidas). */
const SAVE_DEBOUNCE_MS = 900;
/** Cadencia de sincronización con la ventana enfocada / de fondo (§5.1). */
const SYNC_FOCUSED_MS = 12000;
const SYNC_BACKGROUND_MS = 45000;
/** Reparación de escrituras perdidas: solo lo propio y reciente. */
const REPAIR_WINDOW_MS = 60000;

// ── Utilidades puras ────────────────────────────────────────────────────
const s = (v) => (v == null ? '' : String(v));
const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const stamp = () => new Date().toISOString();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);

/** Número tolerante: acepta "1.234.567", "$ 990.000", "12,5" y "19%". */
function num(v, def) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const fallback = def === undefined ? 0 : def;
  const raw = s(v).trim();
  if (!raw) return fallback;
  // Se limpia todo lo que no sea dígito, signo o separador…
  let t = raw.replace(/[^0-9,.\-]/g, '');
  if (!/\d/.test(t)) return fallback;            // "nada", "%", "—"
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  // …y se decide cuál de los dos separadores es el decimal.
  if (lastDot >= 0 && lastComma >= 0) {
    // Con ambos presentes, el último que aparece es el decimal.
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // Una sola coma: decimal si deja 1-2 dígitos detrás, si no es de miles.
    t = t.length - lastComma - 1 <= 2 ? t.replace(',', '.') : t.replace(/,/g, '');
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    // Solo puntos, en grupos exactos de tres: son separadores de miles
    // ("1.234.567", "990.000"). Con cualquier otra forma ("1.5", "12.34") el
    // punto es el decimal, que es como se escribe en un campo con centavos.
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

/** Normaliza para comparar sin acentos ni mayúsculas (búsqueda tolerante). */
const canon = (v) => s(v).trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Fecha ISO corta (YYYY-MM-DD) o '' si no se entiende. */
function isoDate(v) {
  const t = s(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);
/**
 * Suma días a una fecha ISO. Con `businessDays`, el conteo empieza el día
 * SIGUIENTE y se saltan sábados y domingos: una cotización del lunes válida
 * por 5 días hábiles vence el lunes siguiente, no el viernes.
 */
function addDays(iso, days, businessDays) {
  const base = isoDate(iso) || today();
  const d = new Date(base + 'T12:00:00Z');
  let left = Math.max(0, Math.round(num(days)));
  if (!businessDays) {
    d.setUTCDate(d.getUTCDate() + left);
  } else {
    while (left > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) left--;
    }
  }
  return d.toISOString().slice(0, 10);
}
/** Fecha legible en español, sin depender del locale del navegador. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaLarga(iso) {
  const t = isoDate(iso);
  if (!t) return '';
  const [y, m, d] = t.split('-').map(Number);
  return Number(d) + ' de ' + (MESES[m - 1] || '') + ' de ' + y;
}
function fechaCorta(iso) {
  const t = isoDate(iso);
  if (!t) return '';
  const [y, m, d] = t.split('-');
  return d + '-' + m + '-' + y;
}
/** Días que faltan (negativo = vencida). '' si no hay fecha. */
function diasHasta(iso) {
  const t = isoDate(iso);
  if (!t) return null;
  const ms = Date.parse(t + 'T12:00:00Z') - Date.parse(today() + 'T12:00:00Z');
  return Math.round(ms / 86400000);
}

// ── Dinero ──────────────────────────────────────────────────────────────
/**
 * Monedas conocidas: cuántos decimales usa cada una por defecto. No es una
 * tabla de cambio (la app no convierte: cotiza en la moneda elegida), solo
 * evita que el peso chileno salga con centavos y el dólar sin ellos.
 */
const CURRENCIES = [
  { code: 'CLP', symbol: '$', decimals: 0, label: 'Peso chileno' },
  { code: 'UF', symbol: 'UF ', decimals: 2, label: 'Unidad de fomento' },
  { code: 'USD', symbol: 'US$', decimals: 2, label: 'Dólar' },
  { code: 'EUR', symbol: '€', decimals: 2, label: 'Euro' },
  { code: 'MXN', symbol: '$', decimals: 2, label: 'Peso mexicano' },
  { code: 'COP', symbol: '$', decimals: 0, label: 'Peso colombiano' },
  { code: 'PEN', symbol: 'S/', decimals: 2, label: 'Sol' },
  { code: 'ARS', symbol: '$', decimals: 2, label: 'Peso argentino' },
  { code: 'BRL', symbol: 'R$', decimals: 2, label: 'Real' },
];
const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Redondeo a los decimales de la moneda, evitando el 0.1+0.2 del binario. */
function roundTo(n, decimals) {
  const d = clamp(Math.round(num(decimals)), 0, 6);
  const f = Math.pow(10, d);
  return Math.round((num(n) + Number.EPSILON) * f) / f;
}

/** Formatea un monto con el símbolo y los decimales de la moneda del documento. */
function money(n, cur) {
  const c = cur || {};
  const decimals = clamp(Math.round(num(c.decimals)), 0, 6);
  const locale = s(c.locale) || 'es-CL';
  const v = roundTo(n, decimals);
  let body;
  try {
    body = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(v);
  } catch (e) {
    body = v.toFixed(decimals);
  }
  const sym = c.symbol == null ? '$' : s(c.symbol);
  return sym + (sym.endsWith(' ') ? '' : ' ') + body;
}
/** Número sin símbolo (para inputs y para la columna cantidad). */
function numberFmt(n, decimals, locale) {
  const d = clamp(Math.round(num(decimals)), 0, 6);
  try {
    return new Intl.NumberFormat(s(locale) || 'es-CL', {
      minimumFractionDigits: 0, maximumFractionDigits: d,
    }).format(num(n));
  } catch (e) { return String(num(n)); }
}

// ── Emisor y ajustes del cotizador (item `definition`) ───────────────────
function defaultIssuer() {
  return {
    name: '', taxId: '', tagline: '', address: '', phone: '', email: '', web: '',
    logoUrl: '', accentColor: '',
    // Pie de la propuesta: datos de transferencia / condiciones de pago.
    paymentInfo: '',
  };
}

function defaultRules() {
  return {
    currency: 'CLP',
    symbol: '$',
    decimals: 0,
    locale: 'es-CL',
    // 'net'  → los precios se escriben netos y el impuesto se suma.
    // 'gross'→ los precios ya incluyen impuesto y se desglosa hacia atrás.
    priceMode: 'net',
    taxPct: 19,
    taxLabel: 'IVA',
    // Vigencia por defecto de una cotización nueva.
    validDays: 15,
    validBusinessDays: true,
    // Abono/saldo: el reparto del pago que usan las propuestas de la casa.
    advanceEnabled: true,
    advancePct: 60,
    // Prefijo y ancho del correlativo: COT-2026-0001
    numberPrefix: 'COT',
    numberIncludeYear: true,
    numberPad: 4,
    // Notas que arrastra toda cotización nueva (una por línea).
    defaultNotes: [],
    // Los precios de los catálogos de OTRAS apps (Productos, ProductLab)
    // vienen con impuesto incluido: son precio de venta al público. Al
    // traerlos a una cotización que se escribe en netos hay que quitárselo,
    // y esta bandera dice si hay que hacerlo. Si el catálogo de la casa
    // guardara netos, se apaga.
    catalogPricesIncludeTax: true,
  };
}

function normalizeIssuer(raw) {
  const d = defaultIssuer();
  const r = isObj(raw) ? raw : {};
  const out = {};
  for (const k of Object.keys(d)) out[k] = s(r[k] == null ? d[k] : r[k]);
  return out;
}

function normalizeRules(raw) {
  const d = defaultRules();
  const r = isObj(raw) ? raw : {};
  const code = s(r.currency || d.currency).toUpperCase();
  const known = CURRENCY_BY_CODE.get(code);
  return {
    currency: code || d.currency,
    symbol: r.symbol != null && s(r.symbol) !== '' ? s(r.symbol) : s(known ? known.symbol : d.symbol),
    decimals: clamp(Math.round(num(r.decimals != null ? r.decimals : (known ? known.decimals : d.decimals))), 0, 6),
    locale: s(r.locale) || d.locale,
    priceMode: r.priceMode === 'gross' ? 'gross' : 'net',
    taxPct: clamp(num(r.taxPct != null ? r.taxPct : d.taxPct), 0, 100),
    taxLabel: s(r.taxLabel) || d.taxLabel,
    validDays: clamp(Math.round(num(r.validDays != null ? r.validDays : d.validDays)), 0, 3650),
    validBusinessDays: r.validBusinessDays !== false,
    advanceEnabled: r.advanceEnabled !== false,
    advancePct: clamp(num(r.advancePct != null ? r.advancePct : d.advancePct), 0, 100),
    numberPrefix: s(r.numberPrefix != null ? r.numberPrefix : d.numberPrefix),
    numberIncludeYear: r.numberIncludeYear !== false,
    numberPad: clamp(Math.round(num(r.numberPad != null ? r.numberPad : d.numberPad)), 1, 8),
    defaultNotes: arr(r.defaultNotes).map(s).filter(Boolean),
    catalogPricesIncludeTax: r.catalogPricesIncludeTax !== false,
  };
}

/** La moneda efectiva de un documento: la suya si la fijó, si no la del cotizador. */
function currencyOf(doc, rules) {
  const r = rules || defaultRules();
  const d = isObj(doc) ? doc : {};
  const code = s(d.currency || r.currency).toUpperCase();
  const known = CURRENCY_BY_CODE.get(code);
  return {
    code,
    symbol: s(d.symbol || r.symbol || (known ? known.symbol : '$')),
    decimals: clamp(Math.round(num(d.decimals != null && d.decimals !== '' ? d.decimals : r.decimals)), 0, 6),
    locale: s(d.locale || r.locale || 'es-CL'),
  };
}

// ── Cliente ─────────────────────────────────────────────────────────────
function normalizeClient(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    name: s(r.name),
    taxId: s(r.taxId || r.rut),
    contact: s(r.contact),
    email: s(r.email),
    phone: s(r.phone),
    address: s(r.address),
    notes: s(r.notes),
    // Origen si vino de la app Clientes: permite volver a la ficha.
    sourceApp: s(r.sourceApp),
    sourceInstanceId: s(r.sourceInstanceId),
    sourceItemId: s(r.sourceItemId),
  };
}

// ── Líneas de la cotización ─────────────────────────────────────────────
/**
 * Una línea es una fila de la tabla de la propuesta. `source` guarda de dónde
 * salió (manual, banco propio, app Productos o ProductLab) para poder volver a
 * la ficha, refrescar el precio o reconstruir la configuración elegida.
 */
function normalizeLine(raw) {
  const r = isObj(raw) ? raw : {};
  const src = isObj(r.source) ? r.source : {};
  return {
    id: s(r.id) || uid('l'),
    title: s(r.title || r.name),
    description: s(r.description),
    qty: num(r.qty != null ? r.qty : 1, 1),
    qtyLabel: s(r.qtyLabel),          // texto que reemplaza la cantidad ("2 (sep/oct)")
    unit: s(r.unit),                  // unidad de medida opcional ("mes", "u.")
    unitPrice: num(r.unitPrice),
    discountPct: clamp(num(r.discountPct), 0, 100),
    taxable: r.taxable !== false,
    imageUrl: s(r.imageUrl),
    sku: s(r.sku),
    optional: r.optional === true,    // no suma al total; se ofrece aparte
    source: {
      kind: ['manual', 'catalog', 'product', 'productlab'].indexOf(s(src.kind)) !== -1 ? s(src.kind) : 'manual',
      instanceId: s(src.instanceId),
      itemId: s(src.itemId),
      productId: s(src.productId),
      variantId: s(src.variantId),
      // Combinación elegida en ProductLab: [{ stepId, stepName, valueId, valueName, qty }]
      selection: arr(src.selection).map((v) => ({
        stepId: s(v && v.stepId), stepName: s(v && v.stepName),
        valueId: s(v && v.valueId), valueName: s(v && v.valueName),
        qty: num(v && v.qty, 1),
      })),
      capturedAt: s(src.capturedAt),
      capturedPrice: src.capturedPrice == null ? null : num(src.capturedPrice),
    },
    updatedAt: s(r.updatedAt),
    updatedBy: s(r.updatedBy),
  };
}

// ── Motor de totales ────────────────────────────────────────────────────
/**
 * Cadena de cálculo, en este orden y sin atajos:
 *
 *   1. Cada línea: `cantidad × precio unitario`, menos su descuento propio.
 *      En modo `gross` el precio escrito ya trae impuesto, así que primero se
 *      le quita para que todo el resto de la cadena opere sobre netos.
 *   2. Subtotal = suma de las líneas NO opcionales (las opcionales se cotizan
 *      aparte y nunca entran en el total).
 *   3. Descuento del documento: primero el porcentaje, después el monto fijo.
 *   4. El descuento se reparte entre la parte afecta y la exenta en proporción
 *      a lo que pesa cada una — si no, un descuento global cambiaría el
 *      impuesto de forma arbitraria.
 *   5. Impuesto sobre la parte afecta ya descontada.
 *   6. Abono y saldo sobre el total con impuesto.
 *
 * Todo se redondea a los decimales de la moneda al final de cada tramo, para
 * que lo que se ve en pantalla sume exactamente lo que dice el total.
 */
function lineNet(line, rules) {
  const l = normalizeLine(line);
  const taxPct = num(rules && rules.taxPct);
  // En modo `gross` el precio escrito ya trae impuesto y hay que quitárselo,
  // pero SOLO si la línea es afecta: el precio de una línea exenta ya es neto.
  const gross = (rules && rules.priceMode) === 'gross' && l.taxable;
  const unitNet = gross ? l.unitPrice / (1 + taxPct / 100) : l.unitPrice;
  return l.qty * unitNet * (1 - l.discountPct / 100);
}

/**
 * Precio de catálogo → precio que se escribe en la línea de la cotización.
 *
 * Los catálogos de Productos y ProductLab guardan el precio de venta al
 * público (con impuesto). Una cotización escrita en netos necesita el neto,
 * así que hay que quitárselo; una escrita con impuesto incluido lo necesita
 * tal cual. `catalogPricesIncludeTax` cubre el caso contrario: catálogos que
 * ya guardan precios netos.
 */
function precioParaCotizar(precioCatalogo, rules, taxPctDoc) {
  const r = normalizeRules(rules);
  const taxPct = taxPctDoc == null || taxPctDoc === '' ? r.taxPct : clamp(num(taxPctDoc), 0, 100);
  const p = num(precioCatalogo);
  const factor = 1 + taxPct / 100;
  if (r.priceMode === 'gross') return r.catalogPricesIncludeTax ? p : p * factor;
  return r.catalogPricesIncludeTax ? p / factor : p;
}

/**
 * El monto de la columna de la derecha: en modo neto es el neto de la línea,
 * y en modo con impuesto incluido es lo que el cliente ve escrito (neto más
 * su impuesto, si la línea es afecta).
 */
function lineDisplayTotal(line, rules) {
  const l = normalizeLine(line);
  const net = lineNet(l, rules);
  const gross = (rules && rules.priceMode) === 'gross' && l.taxable;
  return gross ? net * (1 + num(rules && rules.taxPct) / 100) : net;
}

function computeTotals(doc, rules) {
  const r = normalizeRules(rules);
  const cur = currencyOf(doc, r);
  const d = isObj(doc) ? doc : {};
  const lines = arr(d.lines).map(normalizeLine);
  const active = lines.filter((l) => !l.optional);
  const optional = lines.filter((l) => l.optional);

  const taxPct = d.taxPct == null || d.taxPct === '' ? r.taxPct : clamp(num(d.taxPct), 0, 100);
  const effRules = { taxPct, priceMode: r.priceMode };

  let netTaxable = 0;
  let netExempt = 0;
  for (const l of active) {
    const v = lineNet(l, effRules);
    if (l.taxable) netTaxable += v; else netExempt += v;
  }
  const subtotal = netTaxable + netExempt;

  const discPct = clamp(num(d.discountPct), 0, 100);
  const discFixed = Math.max(0, num(d.discountAmount));
  const discount = Math.min(subtotal, subtotal * (discPct / 100) + discFixed);
  // Reparto proporcional: sin esto, un descuento global movería el impuesto.
  const share = subtotal > 0 ? netTaxable / subtotal : 0;
  const taxableAfter = Math.max(0, netTaxable - discount * share);
  const exemptAfter = Math.max(0, netExempt - discount * (1 - share));

  const net = roundTo(taxableAfter + exemptAfter, cur.decimals);
  const tax = roundTo(taxableAfter * (taxPct / 100), cur.decimals);
  const total = roundTo(net + tax, cur.decimals);

  const advanceOn = d.advanceEnabled == null ? r.advanceEnabled : d.advanceEnabled !== false;
  const advancePct = clamp(num(d.advancePct == null || d.advancePct === '' ? r.advancePct : d.advancePct), 0, 100);
  const advance = advanceOn ? roundTo(total * (advancePct / 100), cur.decimals) : 0;
  const balance = advanceOn ? roundTo(total - advance, cur.decimals) : 0;

  return {
    currency: cur,
    taxPct,
    lines: active.length,
    subtotal: roundTo(subtotal, cur.decimals),
    discount: roundTo(discount, cur.decimals),
    netTaxable: roundTo(taxableAfter, cur.decimals),
    netExempt: roundTo(exemptAfter, cur.decimals),
    net,
    tax,
    total,
    advanceEnabled: advanceOn,
    advancePct,
    advance,
    balance,
    optionalTotal: roundTo(
      optional.reduce((a, l) => a + lineNet(l, effRules) * (1 + (l.taxable ? taxPct / 100 : 0)), 0),
      cur.decimals,
    ),
    optionalCount: optional.length,
  };
}

// ── Documento (cotización o plantilla) ──────────────────────────────────
function normalizeQuote(raw) {
  const r = isObj(raw) ? raw : {};
  const out = {
    id: s(r.id) || uid('q'),
    kind: r.kind === KIND_TEMPLATE ? KIND_TEMPLATE : KIND_QUOTE,
    // `name` es el campo que el backend usa como título del item.
    name: s(r.name) || s(r.title) || 'Cotización sin título',
    subtitle: s(r.subtitle),
    number: s(r.number),
    numberSeq: r.numberSeq == null ? null : Math.round(num(r.numberSeq)),
    status: isStatus(r.status) ? r.status : 'draft',
    date: isoDate(r.date) || today(),
    validUntil: isoDate(r.validUntil),
    validDays: r.validDays == null || r.validDays === '' ? null : clamp(Math.round(num(r.validDays)), 0, 3650),
    client: normalizeClient(r.client),
    currency: s(r.currency),
    symbol: s(r.symbol),
    decimals: r.decimals == null || r.decimals === '' ? '' : clamp(Math.round(num(r.decimals)), 0, 6),
    locale: s(r.locale),
    taxPct: r.taxPct == null || r.taxPct === '' ? null : clamp(num(r.taxPct), 0, 100),
    discountPct: clamp(num(r.discountPct), 0, 100),
    discountAmount: Math.max(0, num(r.discountAmount)),
    advanceEnabled: r.advanceEnabled == null ? null : r.advanceEnabled !== false,
    advancePct: r.advancePct == null || r.advancePct === '' ? null : clamp(num(r.advancePct), 0, 100),
    lines: arr(r.lines).filter((l) => l && (l.id || l.title || l.description)).map(normalizeLine),
    notes: arr(r.notes).map(s),
    paymentInfo: s(r.paymentInfo),
    // Lienzo visual (Fase 3). Vacío = se pinta la propuesta estándar.
    blocks: arr(r.blocks),
    // Correo preparado para esta cotización (Fase 6).
    mail: isObj(r.mail) ? r.mail : null,
    // Bitácora de seguimiento: creación, envíos, cambios de estado.
    events: arr(r.events).map((e) => ({
      at: s(e && e.at), by: s(e && e.by), type: s(e && e.type), detail: s(e && e.detail),
    })).filter((e) => e.at || e.type),
    // Lápidas de líneas borradas (§5.1): sin esto, lo que borra una persona
    // reaparece desde la pantalla de la otra.
    deletedLines: pruneTombs(arr(r.deletedLines)),
    // Sello de los campos de cabecera: se resuelven en bloque al fusionar.
    metaUpdatedAt: s(r.metaUpdatedAt),
    updatedBy: s(r.updatedBy),
    templateOf: s(r.templateOf),      // plantilla de la que nació
    duplicateOf: s(r.duplicateOf),    // cotización de la que se replicó
  };
  // El backend pone createdAt/updatedAt: no forman parte del modelo y
  // ensuciarían la detección de cambios.
  return out;
}

/** Lápidas: una por id, la más reciente, y se olvidan pasado el TTL. */
function pruneTombs(list) {
  const limit = Date.now() - TOMB_TTL_MS;
  const byId = new Map();
  for (const d of arr(list)) {
    if (!d || !d.id) continue;
    const at = s(d.at);
    const prev = byId.get(d.id);
    if (!prev || at > s(prev.at)) byId.set(d.id, { id: s(d.id), at, by: s(d.by) });
  }
  return Array.from(byId.values()).filter((d) => {
    const ms = Date.parse(d.at);
    return isNaN(ms) || ms >= limit;
  });
}

/** Fecha de vencimiento efectiva: la fijada, o la que sale de la vigencia. */
function validUntilOf(doc, rules) {
  const d = isObj(doc) ? doc : {};
  if (isoDate(d.validUntil)) return isoDate(d.validUntil);
  const r = normalizeRules(rules);
  const days = d.validDays == null ? r.validDays : num(d.validDays);
  if (!days) return '';
  return addDays(d.date, days, r.validBusinessDays);
}

/** Una cotización enviada cuya vigencia ya pasó se muestra como vencida. */
function effectiveStatus(doc, rules) {
  const d = isObj(doc) ? doc : {};
  if (d.status !== 'sent') return s(d.status) || 'draft';
  const until = validUntilOf(d, rules);
  if (until && until < today()) return 'expired';
  return 'sent';
}

// ── Ítems del banco propio (`catalog`) ──────────────────────────────────
function normalizeCatalogItem(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    id: s(r.id) || uid('c'),
    kind: KIND_CATALOG,
    name: s(r.name) || s(r.title) || 'Ítem sin nombre',
    description: s(r.description),
    group: s(r.group),                 // agrupador libre ("Servicios", "Logística")
    unitPrice: num(r.unitPrice),
    qty: num(r.qty != null ? r.qty : 1, 1),
    unit: s(r.unit),
    sku: s(r.sku),
    taxable: r.taxable !== false,
    imageUrl: s(r.imageUrl),
    currency: s(r.currency),
    archived: r.archived === true,
    usageCount: Math.max(0, Math.round(num(r.usageCount))),
    updatedAt: s(r.updatedAt),
    updatedBy: s(r.updatedBy),
  };
}

/** Un ítem del banco se vuelve línea de cotización. */
function lineFromCatalog(item) {
  const c = normalizeCatalogItem(item);
  return normalizeLine({
    title: c.name,
    description: c.description,
    qty: c.qty,
    unit: c.unit,
    unitPrice: c.unitPrice,
    taxable: c.taxable,
    imageUrl: c.imageUrl,
    sku: c.sku,
    source: { kind: 'catalog', itemId: c.id, capturedAt: stamp(), capturedPrice: c.unitPrice },
  });
}

/** Y una línea de cotización se puede guardar en el banco para reutilizarla. */
function catalogFromLine(line, group) {
  const l = normalizeLine(line);
  return normalizeCatalogItem({
    name: l.title,
    description: l.description,
    qty: l.qty,
    unit: l.unit,
    unitPrice: l.unitPrice,
    taxable: l.taxable,
    imageUrl: l.imageUrl,
    sku: l.sku,
    group: s(group),
  });
}

// ── Correlativo ─────────────────────────────────────────────────────────
/**
 * Siguiente número: se calcula mirando lo que ya existe, no un contador
 * guardado aparte. Así dos personas que crean una cotización a la vez no
 * dependen de un contador que se pise, y si alguien borra la última, el
 * número se reutiliza en vez de dejar un hueco.
 */
function nextNumber(quotes, rules) {
  const r = normalizeRules(rules);
  const year = new Date().getFullYear();
  const prefix = r.numberPrefix ? r.numberPrefix + '-' : '';
  const yearPart = r.numberIncludeYear ? year + '-' : '';
  let max = 0;
  for (const q of arr(quotes)) {
    if (!q || q.kind === KIND_TEMPLATE) continue;
    // Solo cuentan los del mismo año cuando el correlativo lleva año.
    if (r.numberIncludeYear && s(q.number).indexOf(String(year)) === -1) continue;
    const seq = q.numberSeq != null ? Math.round(num(q.numberSeq)) : 0;
    const fromText = Math.round(num((s(q.number).match(/(\d+)\s*$/) || [])[1]));
    max = Math.max(max, seq, fromText);
  }
  const seq = max + 1;
  return { seq, number: prefix + yearPart + String(seq).padStart(r.numberPad, '0') };
}

// ── Documento nuevo ─────────────────────────────────────────────────────
function blankQuote(rules, opts) {
  const r = normalizeRules(rules);
  const o = isObj(opts) ? opts : {};
  return normalizeQuote({
    kind: o.kind === KIND_TEMPLATE ? KIND_TEMPLATE : KIND_QUOTE,
    name: s(o.name) || (o.kind === KIND_TEMPLATE ? 'Cotización tipo' : 'Cotización sin título'),
    number: s(o.number),
    numberSeq: o.numberSeq,
    date: today(),
    validDays: r.validDays,
    currency: r.currency,
    symbol: r.symbol,
    decimals: r.decimals,
    locale: r.locale,
    taxPct: r.taxPct,
    advanceEnabled: r.advanceEnabled,
    advancePct: r.advancePct,
    notes: r.defaultNotes.slice(),
    lines: [],
    metaUpdatedAt: stamp(),
  });
}

/**
 * Copia profunda de un documento con identidad nueva: la usan "duplicar
 * cotización", "guardar como plantilla" y "crear desde plantilla". Se
 * renuevan TODOS los ids (documento y líneas) para que la copia no comparta
 * nada con el original, y se limpia lo que pertenece al historial del
 * original (bitácora, correo enviado, lápidas).
 */
function cloneDoc(src, opts) {
  const o = isObj(opts) ? opts : {};
  const base = normalizeQuote(src);
  const copy = JSON.parse(JSON.stringify(base));
  copy.id = uid(o.kind === KIND_TEMPLATE ? 't' : 'q');
  copy.kind = o.kind === KIND_TEMPLATE ? KIND_TEMPLATE : KIND_QUOTE;
  copy.name = s(o.name) || base.name;
  copy.lines = base.lines.map((l) => Object.assign({}, l, { id: uid('l'), updatedAt: stamp(), updatedBy: s(o.by) }));
  copy.blocks = remapBlockIds(base.blocks, base.lines, copy.lines);
  copy.events = [];
  copy.deletedLines = [];
  copy.mail = null;
  copy.metaUpdatedAt = stamp();
  copy.updatedBy = s(o.by);
  if (copy.kind === KIND_TEMPLATE) {
    // Una plantilla no arrastra número, fechas ni cliente del original.
    copy.number = '';
    copy.numberSeq = null;
    copy.status = 'draft';
    copy.date = today();
    copy.validUntil = '';
    if (o.keepClient !== true) copy.client = normalizeClient(null);
  } else {
    copy.number = s(o.number);
    copy.numberSeq = o.numberSeq == null ? null : Math.round(num(o.numberSeq));
    copy.status = 'draft';
    copy.date = today();
    copy.validUntil = '';
    if (o.clearClient) copy.client = normalizeClient(null);
  }
  if (base.kind === KIND_TEMPLATE) copy.templateOf = base.id;
  else copy.duplicateOf = base.id;
  return copy;
}

/**
 * Al clonar cambian los ids de las líneas; los bloques del lienzo que apuntan
 * a líneas concretas tienen que apuntar a las nuevas o quedarían huérfanos.
 */
function remapBlockIds(blocks, oldLines, newLines) {
  const map = new Map();
  arr(oldLines).forEach((l, i) => { if (newLines[i]) map.set(l.id, newLines[i].id); });
  // Se recorre el bloque entero: cualquier cadena que sea el id de una línea
  // vieja (esté donde esté: `lineId`, un array `lineIds`, un bloque anidado)
  // pasa a ser el id de la línea nueva equivalente.
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (isObj(v)) {
      const out = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k]);
      return out;
    }
    return typeof v === 'string' && map.has(v) ? map.get(v) : v;
  };
  return arr(blocks).map((b) => Object.assign(walk(b), { id: uid('b') }));
}

// ── Búsqueda ────────────────────────────────────────────────────────────
/** Texto sobre el que busca el listado: todo lo que identifica al documento. */
function quoteHaystack(q) {
  const d = normalizeQuote(q);
  return canon([
    d.name, d.subtitle, d.number, d.client.name, d.client.taxId, d.client.contact,
    d.client.email, STATUS_LABEL.get(d.status) || '',
    d.lines.map((l) => l.title + ' ' + l.description + ' ' + l.sku).join(' '),
    d.notes.join(' '),
  ].join(' '));
}
