/**
 * Cotizaciones v1.2.2 — app oficial de KIMOS.
 *
 * ARCHIVO GENERADO por tools/build.mjs a partir de src/. No editar a mano:
 * los cambios van en src/*.js y se recompila con `node tools/build.mjs`.
 *
 * Contrato AppShell v1 (kimos-packages/APP-SPEC.md):
 *   - ESM único que exporta `default mount(shell) -> { Component, unmount }`.
 *   - Usa `globalThis.React` (nunca empaqueta su propia copia).
 *   - Sin JSX: todo con `React.createElement`.
 *   - Estado dentro del closure de mount(): una instancia = un cotizador.
 *   - Nunca `innerHTML`/`dangerouslySetInnerHTML`: el texto que escribe el
 *     usuario (o que llega del catálogo de otra app) se pinta siempre como
 *     elementos React, también en la ventana de impresión.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef, useCallback, Fragment } = React;

  // Versión visible en pantalla: al probar, confirma qué build tomó el host.
  // La inyecta tools/build.mjs desde manifest.json (APP-SPEC §7.a).
  const APP_VERSION = '1.2.2';

// ══════════════════════════════════════════════════════════════════════
// src/00-core.js
// ══════════════════════════════════════════════════════════════════════
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

/**
 * Estados del ciclo de vida de una cotización (el orden es el del tablero).
 *
 * El color NO vive aquí: cada estado lleva su clase (`cz-st-{estado}`) y el
 * color lo pone el CSS, que tiene su variante de modo noche. Un rojo pensado
 * para fondo claro sobre fondo oscuro no se lee, y desde JS no hay forma de
 * saber en qué modo está el escritorio.
 */
const STATUSES = [
  ['draft', 'Borrador'],
  ['sent', 'Enviada'],
  ['accepted', 'Aceptada'],
  ['rejected', 'Rechazada'],
  ['expired', 'Vencida'],
];
const STATUS_LABEL = new Map(STATUSES.map(([k, l]) => [k, l]));
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
    // Papel de la exportación a PDF.
    paper: 'a4',
    pageMargin: 16,
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
    paper: ['a4', 'letter', 'legal'].indexOf(s(r.paper)) !== -1 ? s(r.paper) : d.paper,
    pageMargin: clamp(Math.round(num(r.pageMargin != null ? r.pageMargin : d.pageMargin)), 5, 40),
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
    // Identidad del cliente en la plataforma (`kimos:record/account/…`), si
    // se vinculó. Los campos de arriba siguen siendo la INSTANTÁNEA: una
    // propuesta enviada hace ocho meses se imprime igual aunque el registro
    // se renombre o desaparezca. Ver src/66-records.js y APP-SPEC §7.d.
    recordRef: s(r.recordRef),
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
    // Enlace público de la propuesta publicada, si se generó.
    publicUrl: s(r.publicUrl),
    publishedAt: s(r.publishedAt),
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
    // Plantilla marcada como predeterminada: es la que usa "Nueva cotización"
    // sin preguntar nada.
    isDefault: r.isDefault === true,
    // Revisiones: una cotización enviada no se reescribe, se revisa. La
    // revisión conserva el número con sufijo (-R2) y apunta a la anterior;
    // la anterior queda marcada como sustituida.
    revision: Math.max(0, Math.round(num(r.revision))),
    revisionOf: s(r.revisionOf),
    supersededBy: s(r.supersededBy),
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
    // Una revisión reutiliza el número de su original (COT-2026-0001-R2):
    // no consume correlativo.
    if (s(q.revisionOf)) continue;
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
  copy.isDefault = false;
  copy.revision = 0;
  copy.revisionOf = '';
  copy.supersededBy = '';
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

// ══════════════════════════════════════════════════════════════════════
// src/10-store.js
// ══════════════════════════════════════════════════════════════════════
/* ══ ESTADO, RED Y SINCRONIZACIÓN ═════════════════════════════════════════
 *
 * Un solo modelo en el closure. La UI y el agente IA mutan EXACTAMENTE las
 * mismas funciones, así que el lienzo se repinta solo cuando el agente actúa
 * (APP-SPEC §5).
 *
 * Colaboración multiusuario (APP-SPEC §5.1), con `gantt` como referencia:
 *   1. Fusionar, no reemplazar: cada línea lleva su `updatedAt` y gana la más
 *      reciente POR LÍNEA, no por documento. Dos personas que tocan líneas
 *      distintas de la misma cotización no se pisan.
 *   2. Lápidas para las bajas (`deletedLines`), si no lo que borra una
 *      persona reaparece desde la pantalla de la otra.
 *   3. Leer-fusionar-escribir antes de cada PUT: el backend hace merge de
 *      campos de primer nivel, así que el array `lines` se reemplaza entero
 *      y la fusión tiene que ocurrir aquí.
 *   4. Auto-reparación de la ventana de red entre el read y el write, acotada
 *      a lo propio y reciente para no resucitar lo que borró otra persona.
 *   5. No repintar de más: se compara una firma de lo visible y solo se emite
 *      si cambió.
 *   6. Cadencia según el foco: rápido enfocada, lenta de fondo, en pausa si
 *      la pestaña no se ve.
 */

const instanceId = shell.app && shell.app.instanceId;
const teamId = shell.app && shell.app.teamId;

/** Base del API del tenant, deducida de una URL que el propio host arma. */
function apiBase() {
  try {
    const raw = shell.assetUrl ? shell.assetUrl('x').split('/api/apps/')[0] : '';
    return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
  } catch (e) { return window.location.origin; }
}
const API = apiBase();
const req = (url, init) => (shell.authFetch ? shell.authFetch(url, init) : fetch(url, init));
const INSTANCE_URL = API + '/api/app-instances/' + encodeURIComponent(s(instanceId));

// ── Modelo ──────────────────────────────────────────────────────────────
let model = {
  // Datos
  def: { id: KIND_DEF, issuer: defaultIssuer(), rules: defaultRules(), updatedAt: '', metaUpdatedAt: '' },
  docs: [],            // cotizaciones y plantillas (kind quote | template)
  catalog: [],         // ítems y servicios prefijados
  mails: [],           // plantillas de correo
  // Catálogos de OTRAS apps (Productos, ProductLab, Clientes) leídos con
  // `shell.data`. No se persisten: son un espejo de lectura que se refresca
  // al abrir la pestaña o al pulsar recargar.
  ext: {
    loading: false, loaded: false, error: null, at: '',
    products: [], sources: [],
    customers: [], customerSources: [],
  },
  // Entorno
  me: null,
  settings: {},        // valores de ⚙️ Configurar
  docName: '',
  loaded: false,
  error: null,
  // Vista (compartida por usuario y agente)
  tab: 'quotes',
  openId: '',          // documento abierto en el editor
  editorView: 'data',  // 'data' (formulario) | 'design' (lienzo visual)
  search: '',
  filterStatus: '',
  sort: { by: 'date', dir: 'desc' },
  sync: { at: '', saving: 0, offline: false },
};

const listeners = new Set();
const emit = () => listeners.forEach((l) => { try { l(Object.assign({}, model)); } catch (e) { /* un oyente roto no rompe al resto */ } });
const setModel = (patch) => { model = Object.assign({}, model, patch); emit(); };
const getModel = () => model;

/** Documentos con escritura en vuelo o encolada: no deben caerse al fusionar. */
const pendingWrite = new Set();
/** Documentos borrados localmente cuyo DELETE aún no confirma el servidor. */
const pendingDelete = new Set();
/** Documentos que aún no existen en el servidor (creación en camino). */
const pendingCreate = new Set();
const saveTimers = new Map();

/** Serializa TODA la red mutante: sin carreras entre refresh y guardados. */
let chain = Promise.resolve();
function serial(fn) {
  const run = () => Promise.resolve().then(fn).catch((e) => { console.warn('[cotizaciones] sync', e); });
  chain = chain.then(run, run);
  return chain;
}

const meLabel = () => (model.me && (model.me.name || model.me.email || model.me.id)) || '';

// ── Acceso a los datos del modelo ───────────────────────────────────────
const rulesOf = () => normalizeRules(model.def && model.def.rules);
const issuerOf = () => normalizeIssuer(model.def && model.def.issuer);
const quotesOf = () => model.docs.filter((d) => d.kind === KIND_QUOTE);
const templatesOf = () => model.docs.filter((d) => d.kind === KIND_TEMPLATE);
const docById = (id) => model.docs.find((d) => d.id === id) || null;
const catalogById = (id) => model.catalog.find((c) => c.id === id) || null;
const mailById = (id) => model.mails.find((m) => m.id === id) || null;
const openDoc = () => (model.openId ? docById(model.openId) : null);

// ── Normalización de items ──────────────────────────────────────────────
/** Clasifica un item crudo del backend en su tipo del modelo. */
function kindOf(item) {
  const k = s(item && item.kind);
  if (k === KIND_DEF || k === KIND_QUOTE || k === KIND_TEMPLATE || k === KIND_CATALOG || k === KIND_MAIL) return k;
  // Items previos a que existiera `kind`: si tienen líneas, son cotizaciones.
  return Array.isArray(item && item.lines) ? KIND_QUOTE : '';
}

function normalizeDefinition(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    id: s(r.id) || KIND_DEF,
    kind: KIND_DEF,
    name: s(r.name) || 'Ajustes del cotizador',
    issuer: normalizeIssuer(r.issuer),
    rules: normalizeRules(r.rules),
    // Bloque `public` del gateway público (APP-SPEC §7.b): la app lo escribe
    // solo cuando se publica una cotización con enlace.
    public: isObj(r.public) ? r.public : { enabled: false },
    metaUpdatedAt: s(r.metaUpdatedAt),
    updatedBy: s(r.updatedBy),
  };
}

function normalizeMail(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    id: s(r.id) || uid('m'),
    kind: KIND_MAIL,
    name: s(r.name) || 'Correo sin nombre',
    subject: s(r.subject),
    body: s(r.body),
    to: s(r.to),
    cc: s(r.cc),
    bcc: s(r.bcc),
    replyTo: s(r.replyTo),
    // Adjuntar la propuesta como archivo HTML autocontenido, y/o incluir un
    // botón con su enlace publicado. El PDF no se puede adjuntar solo: lo
    // escribe el diálogo de impresión del navegador en el disco del usuario
    // y la página nunca lo recibe (ver src/85-mail.js).
    attachProposal: r.attachProposal === true,
    includeLink: r.includeLink !== false,
    isDefault: r.isDefault === true,
    updatedAt: s(r.updatedAt),
    updatedBy: s(r.updatedBy),
  };
}

// ── Fusión sin pérdida ──────────────────────────────────────────────────
/** Campos de cabecera del documento: se resuelven en bloque por `metaUpdatedAt`. */
const META_FIELDS = [
  'name', 'subtitle', 'number', 'numberSeq', 'status', 'date', 'validUntil', 'validDays',
  'client', 'currency', 'symbol', 'decimals', 'locale', 'taxPct', 'discountPct',
  'discountAmount', 'advanceEnabled', 'advancePct', 'notes', 'paymentInfo', 'blocks', 'mail',
];

function mergeLines(localLines, remoteLines, tombs) {
  const tombAt = new Map(tombs.map((d) => [d.id, s(d.at)]));
  const remoteById = new Map(arr(remoteLines).map((l) => [l.id, l]));
  const out = [];
  const seen = new Set();
  const take = (l) => {
    if (!l || !l.id || seen.has(l.id)) return;
    const dead = tombAt.get(l.id);
    if (dead && dead > s(l.updatedAt)) return;   // borrada después de su última edición
    seen.add(l.id);
    out.push(l);
  };
  // El orden que ve quien está mirando la pantalla manda; lo nuevo del otro
  // lado se añade al final (no saltan las filas mientras se trabaja).
  for (const ll of arr(localLines)) {
    const rl = remoteById.get(ll.id);
    take(!rl || s(ll.updatedAt) >= s(rl.updatedAt) ? ll : rl);
  }
  for (const rl of arr(remoteLines)) take(rl);
  return out;
}

function mergeDoc(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const meta = s(remote.metaUpdatedAt) > s(local.metaUpdatedAt) ? remote : local;
  const tombs = pruneTombs([...arr(local.deletedLines), ...arr(remote.deletedLines)]);
  const merged = Object.assign({}, remote, local);
  for (const f of META_FIELDS) merged[f] = meta[f];
  merged.metaUpdatedAt = s(meta.metaUpdatedAt);
  merged.deletedLines = tombs;
  merged.lines = mergeLines(local.lines, remote.lines, tombs);
  // La bitácora es un registro que solo crece: se unen los dos lados.
  merged.events = mergeEvents(local.events, remote.events);
  return merged;
}

/** Eventos: unión sin duplicados (misma marca de tiempo, tipo y autor). */
function mergeEvents(a, b) {
  const seen = new Set();
  const out = [];
  for (const e of [...arr(a), ...arr(b)]) {
    if (!e) continue;
    const key = s(e.at) + '|' + s(e.type) + '|' + s(e.by) + '|' + s(e.detail);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out.sort((x, y) => s(x.at).localeCompare(s(y.at)));
}

/** Fusión de una lista de items simples (banco de ítems, correos): por `updatedAt`. */
function mergeSimpleLists(local, remote) {
  const remoteById = new Map(remote.map((x) => [x.id, x]));
  const out = [];
  const seen = new Set();
  for (const l of local) {
    const r = remoteById.get(l.id);
    if (r) { out.push(s(l.updatedAt) >= s(r.updatedAt) ? l : r); seen.add(l.id); }
    else if (pendingWrite.has(l.id) || pendingCreate.has(l.id)) { out.push(l); seen.add(l.id); }
    // Si no está arriba y no tenemos escritura pendiente, otro lo borró.
  }
  for (const r of remote) if (!seen.has(r.id) && !pendingDelete.has(r.id)) out.push(r);
  return out;
}

function mergeDocLists(local, remote) {
  const remoteById = new Map(remote.map((d) => [d.id, d]));
  const out = [];
  const seen = new Set();
  for (const ld of local) {
    const rd = remoteById.get(ld.id);
    if (rd) { out.push(mergeDoc(ld, rd)); seen.add(ld.id); }
    else if (pendingWrite.has(ld.id) || pendingCreate.has(ld.id)) { out.push(ld); seen.add(ld.id); }
  }
  for (const rd of remote) if (!seen.has(rd.id) && !pendingDelete.has(rd.id)) out.push(rd);
  return out;
}

// ── Red ─────────────────────────────────────────────────────────────────
async function fetchItems() {
  if (shell.items && shell.items.list) return await shell.items.list();
  const res = await req(INSTANCE_URL + '/items', { cache: 'no-store' });
  if (!res.ok) throw new Error('items ' + res.status);
  return ((await res.json()) || {}).items || [];
}

async function fetchInstance() {
  const res = await req(INSTANCE_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('instancia ' + res.status);
  return (await res.json()) || {};
}

/** Lo que se persiste: el modelo limpio, sin los sellos que pone el backend. */
function serializeItem(item) {
  const out = Object.assign({}, item);
  delete out.createdAt;
  delete out.updatedAt;   // lo pone el backend
  return out;
}

async function putItem(item) {
  const res = await req(INSTANCE_URL + '/items/' + encodeURIComponent(item.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeItem(item)),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* cuerpo vacío */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

async function postItem(item) {
  const res = await req(INSTANCE_URL + '/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeItem(item)),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* cuerpo vacío */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

async function deleteItem(id) {
  const res = await req(INSTANCE_URL + '/items/' + encodeURIComponent(id), { method: 'DELETE' });
  return { ok: res.ok || res.status === 404, status: res.status };
}

// ── Sincronización ──────────────────────────────────────────────────────
/** Firma de lo visible: si no cambió, no se repinta (§5.1 punto 5). */
const viewSignature = (mm) => JSON.stringify([
  mm.docs, mm.catalog, mm.mails, mm.def, mm.docName, mm.loaded, mm.error,
]);

function applyRemote(items, instance) {
  const raw = arr(items);
  const remoteDocs = [];
  const remoteCatalog = [];
  const remoteMails = [];
  let remoteDef = null;
  for (const it of raw) {
    const k = kindOf(it);
    if (k === KIND_DEF) remoteDef = normalizeDefinition(it);
    else if (k === KIND_QUOTE || k === KIND_TEMPLATE) remoteDocs.push(normalizeQuote(it));
    else if (k === KIND_CATALOG) remoteCatalog.push(normalizeCatalogItem(it));
    else if (k === KIND_MAIL) remoteMails.push(normalizeMail(it));
  }

  const patch = {
    docs: mergeDocLists(model.docs, remoteDocs),
    catalog: mergeSimpleLists(model.catalog, remoteCatalog),
    mails: mergeSimpleLists(model.mails, remoteMails),
    loaded: true,
    error: null,
  };
  // Los ajustes del cotizador se resuelven por `metaUpdatedAt`, igual que la
  // cabecera de un documento: quien guardó después manda.
  if (remoteDef) {
    patch.def = s(remoteDef.metaUpdatedAt) > s(model.def.metaUpdatedAt) && !pendingWrite.has(remoteDef.id)
      ? remoteDef
      : model.def;
  }
  if (instance) {
    patch.docName = s(instance.name);
  }

  const next = Object.assign({}, model, patch);
  const quiet = viewSignature(next) === viewSignature(model) && !model.sync.offline;
  next.sync = Object.assign({}, model.sync, { at: stamp(), offline: false });
  model = next;
  if (!quiet) emit();
  repairLostWrites(remoteDocs);
}

/**
 * Auto-reparación. Si una línea NUESTRA y RECIENTE ya no está en el servidor
 * y nadie la borró (no hay lápida que la tape: si la hubiera, la fusión la
 * habría descartado), es que otra escritura la pisó en la ventana entre
 * nuestro read y nuestro write. Se repone guardando de nuevo.
 *
 * Acotado a lo propio y reciente a propósito: así nunca resucita lo que borró
 * otra persona, ni siquiera desde un cliente de una versión vieja que no
 * escriba lápidas.
 */
function repairLostWrites(remoteDocs) {
  const me = meLabel();
  const remoteById = new Map(remoteDocs.map((d) => [d.id, d]));
  const mineAndFresh = (by, at) => {
    if (by !== me || !at) return false;
    const age = Date.now() - Date.parse(at);
    return !isNaN(age) && age >= 0 && age < REPAIR_WINDOW_MS;
  };
  for (const d of model.docs) {
    if (pendingWrite.has(d.id) || pendingCreate.has(d.id)) continue;
    const rd = remoteById.get(d.id);
    if (!rd) continue;
    const remoteIds = new Set(arr(rd.lines).map((l) => l.id));
    const lostLine = arr(d.lines).some((l) => !remoteIds.has(l.id) && mineAndFresh(l.updatedBy, l.updatedAt));
    const lostTomb = arr(d.deletedLines).some((t) => remoteIds.has(t.id) && mineAndFresh(t.by, t.at));
    if (lostLine || lostTomb) queueSave(d.id);
  }
}

async function doRefresh(withInstance) {
  try {
    const [items, instance] = await Promise.all([
      fetchItems(),
      withInstance ? fetchInstance().catch(() => null) : Promise.resolve(null),
    ]);
    applyRemote(items, instance);
    return items;
  } catch (e) {
    setModel({
      loaded: true,
      error: model.loaded ? model.error : ((e && e.message) || 'No se pudo cargar el cotizador.'),
      sync: Object.assign({}, model.sync, { offline: true }),
    });
    return null;
  }
}
const refresh = (withInstance) => serial(() => doRefresh(withInstance !== false));

/** Busca un item del modelo por id, sea del tipo que sea. */
function anyById(id) {
  return docById(id) || catalogById(id) || mailById(id)
    || (model.def && model.def.id === id ? model.def : null);
}

/**
 * Guardado leer-fusionar-escribir: relee del servidor, fusiona lo ajeno con
 * lo propio y recién ahí escribe. Ningún cambio de otra persona se pierde por
 * el hecho de que nosotros hayamos guardado después.
 *
 * Queda una ventana mínima —el viaje de red entre el read y el write— que
 * cubre la auto-reparación de `applyRemote`.
 */
async function doSave(id) {
  const items = await fetchItems().catch(() => null);
  if (items) applyRemote(items, null);
  else setModel({ sync: Object.assign({}, model.sync, { offline: true }) });

  const merged = anyById(id);
  if (!merged) return;                      // dejó de existir (borrado local o remoto)

  const creating = pendingCreate.has(id);
  const res = creating ? await postItem(merged) : await putItem(merged);
  if (res.ok) {
    pendingCreate.delete(id);
    setModel({ sync: Object.assign({}, model.sync, { at: stamp(), offline: false }) });
    return;
  }
  // Un PUT contra un item que aún no existe: se crea. Y al revés, un POST
  // contra uno que ya existe (409/400 por carrera): se actualiza.
  if (res.status === 404 && !creating) {
    const retry = await postItem(merged);
    if (retry.ok) { setModel({ sync: Object.assign({}, model.sync, { at: stamp(), offline: false }) }); return; }
  }
  setModel({ sync: Object.assign({}, model.sync, { offline: true }) });
  shell.notify({ level: 'error', text: 'No se pudo guardar; se reintentará.' });
}

function queueSave(id) {
  if (!id) return;
  pendingWrite.add(id);
  if (saveTimers.has(id)) clearTimeout(saveTimers.get(id));
  saveTimers.set(id, setTimeout(() => {
    saveTimers.delete(id);
    setModel({ sync: Object.assign({}, model.sync, { saving: model.sync.saving + 1 }) });
    serial(() => doSave(id)).then(() => {
      pendingWrite.delete(id);
      setModel({ sync: Object.assign({}, model.sync, { saving: Math.max(0, model.sync.saving - 1) }) });
    });
  }, SAVE_DEBOUNCE_MS));
}

/** Fuerza la salida de todo lo pendiente (al cerrar la ventana o al exportar). */
function flushPending() {
  for (const [id, timer] of saveTimers) {
    clearTimeout(timer);
    saveTimers.delete(id);
    serial(() => doSave(id));
  }
  return chain;
}

// ── Mutaciones del modelo ───────────────────────────────────────────────
/**
 * Sustituye un documento por su versión editada, sella la edición y encola el
 * guardado. `meta` marca que cambió la cabecera (y no solo una línea), que es
 * lo que decide quién gana al fusionar.
 */
function commitDoc(id, mutate, opts) {
  const o = isObj(opts) ? opts : {};
  const idx = model.docs.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const before = model.docs[idx];
  const next = normalizeQuote(mutate(JSON.parse(JSON.stringify(before))) || before);
  if (o.meta !== false) next.metaUpdatedAt = stamp();
  next.updatedBy = meLabel();
  const docs = model.docs.slice();
  docs[idx] = next;
  setModel({ docs });
  queueSave(id);
  return next;
}

/** Sella una línea como recién editada por mí (para la fusión por línea). */
function touchLine(line) {
  return Object.assign({}, normalizeLine(line), { updatedAt: stamp(), updatedBy: meLabel() });
}

/** Añade un evento a la bitácora de seguimiento del documento. */
function logEvent(doc, type, detail) {
  const events = arr(doc.events).slice();
  events.push({ at: stamp(), by: meLabel(), type: s(type), detail: s(detail) });
  // La bitácora no crece sin límite: se conservan los 200 últimos.
  doc.events = events.slice(-200);
  return doc;
}

function createDoc(doc) {
  const next = normalizeQuote(doc);
  next.updatedBy = meLabel();
  next.metaUpdatedAt = stamp();
  logEvent(next, 'created', next.kind === KIND_TEMPLATE ? 'Plantilla creada' : 'Cotización creada');
  pendingCreate.add(next.id);
  setModel({ docs: model.docs.concat([next]) });
  queueSave(next.id);
  return next;
}

function removeDoc(id) {
  const doc = docById(id);
  if (!doc) return false;
  pendingDelete.add(id);
  pendingCreate.delete(id);
  if (saveTimers.has(id)) { clearTimeout(saveTimers.get(id)); saveTimers.delete(id); }
  setModel({
    docs: model.docs.filter((d) => d.id !== id),
    openId: model.openId === id ? '' : model.openId,
  });
  serial(async () => {
    const res = await deleteItem(id);
    if (res.ok) pendingDelete.delete(id);
    else shell.notify({ level: 'error', text: 'No se pudo eliminar; vuelve a intentarlo.' });
  });
  return true;
}

/** Alta/edición/baja de los items simples (banco de ítems y correos). */
function upsertSimple(listKey, item, normalize) {
  const next = Object.assign(normalize(item), { updatedAt: stamp(), updatedBy: meLabel() });
  const list = model[listKey];
  const idx = list.findIndex((x) => x.id === next.id);
  const out = list.slice();
  if (idx < 0) { pendingCreate.add(next.id); out.push(next); } else out[idx] = next;
  setModel({ [listKey]: out });
  queueSave(next.id);
  return next;
}

function removeSimple(listKey, id) {
  const list = model[listKey];
  if (!list.some((x) => x.id === id)) return false;
  pendingDelete.add(id);
  pendingCreate.delete(id);
  if (saveTimers.has(id)) { clearTimeout(saveTimers.get(id)); saveTimers.delete(id); }
  setModel({ [listKey]: list.filter((x) => x.id !== id) });
  serial(async () => {
    const res = await deleteItem(id);
    if (res.ok) pendingDelete.delete(id);
    else shell.notify({ level: 'error', text: 'No se pudo eliminar; vuelve a intentarlo.' });
  });
  return true;
}

const upsertCatalog = (item) => upsertSimple('catalog', item, normalizeCatalogItem);
const removeCatalog = (id) => removeSimple('catalog', id);
const upsertMail = (item) => upsertSimple('mails', item, normalizeMail);
const removeMail = (id) => removeSimple('mails', id);

/** Guarda los ajustes del cotizador (emisor + reglas). */
function commitDefinition(mutate) {
  const before = model.def;
  const next = normalizeDefinition(mutate(JSON.parse(JSON.stringify(before))) || before);
  next.metaUpdatedAt = stamp();
  next.updatedBy = meLabel();
  // Si el item aún no existe arriba, el PUT devuelve 404 y `doSave` lo crea:
  // no hace falta saber aquí si es alta o edición.
  setModel({ def: next });
  queueSave(next.id);
  return next;
}

// ── Carga inicial y ciclo de vida ───────────────────────────────────────
let syncTimer = null;
let loadedOnce = false;

/** Cadencia según el foco: rápida enfocada, lenta de fondo, en pausa si no se ve. */
function scheduleSync() {
  if (syncTimer) clearInterval(syncTimer);
  const period = document.hasFocus && document.hasFocus() ? SYNC_FOCUSED_MS : SYNC_BACKGROUND_MS;
  syncTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    refresh(false);
  }, period);
}
const onFocusChange = () => scheduleSync();

async function load() {
  if (loadedOnce) return;
  loadedOnce = true;
  await refresh(true);

  // El item `definition` se crea la primera vez que se abre el cotizador, así
  // los ajustes tienen dónde vivir antes de que nadie los toque. El id es
  // fijo, de modo que dos personas abriendo a la vez escriben el mismo
  // documento en vez de duplicarlo.
  if (!s(model.def.metaUpdatedAt)) {
    pendingCreate.add(KIND_DEF);
    queueSave(KIND_DEF);
  }

  // Quién soy: la fusión necesita distinguir lo propio de lo ajeno.
  try {
    const res = await req(API + '/api/identity/me', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const a = (data && (data.actor || data)) || {};
      setModel({ me: { id: s(a.id), name: s(a.displayName || a.name), email: s(a.email) } });
    }
  } catch (e) { /* opcional: sin identidad la app funciona igual */ }

  // Parámetros de ⚙️ Configurar.
  if (shell.config && shell.config.get) {
    try { setModel({ settings: (await shell.config.get()) || {} }); } catch (e) { /* opcional */ }
  }

  scheduleSync();
}

let offConfig = null;
let offAgent = null;

/** Limpieza al cerrar la ventana: timers, listeners y agente (APP-SPEC §8). */
function teardown() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  try { window.removeEventListener('focus', onFocusChange); } catch (e) { /* no-op */ }
  try { window.removeEventListener('blur', onFocusChange); } catch (e) { /* no-op */ }
  flushPending();
  if (offConfig) { try { offConfig(); } catch (e) { /* no-op */ } offConfig = null; }
  if (offAgent) { try { offAgent(); } catch (e) { /* no-op */ } offAgent = null; }
  listeners.clear();
}

// ══════════════════════════════════════════════════════════════════════
// src/20-ui.js
// ══════════════════════════════════════════════════════════════════════
/* ══ COMPONENTES BASE ═════════════════════════════════════════════════════
 *
 * Piezas de UI compartidas por toda la app. Ni un color cableado: todo sale
 * de las variables `--cz-*` del CSS, que a su vez cuelgan de los tokens del
 * tema del host (APP-SPEC §9), así la app cambia de día/noche y de acento
 * junto con KIMOS.
 *
 * Regla de seguridad de la casa: NADA de `dangerouslySetInnerHTML`. El texto
 * que escribe el usuario —o el que llega del catálogo de otra app— se pinta
 * siempre como elementos React.
 */

const cx = (...xs) => xs.filter(Boolean).join(' ');

/** Botón. `variant`: default (outline) · primary · ghost · danger. */
function Btn(props) {
  const p = props || {};
  const { variant, size, active, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button',
    className: cx('cz-btn', variant && 'cz-btn-' + variant, size === 'sm' && 'cz-btn-sm',
      size === 'lg' && 'cz-btn-lg', active && 'on', className),
  }, rest), children);
}

/** Botón cuadrado de solo icono; el nombre va en el tooltip. */
function IconBtn(props) {
  const p = props || {};
  const { icon, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button', className: cx('cz-ico', className),
  }, rest), icon || children);
}

/** Campo de texto controlado. */
function Input(props) {
  const p = props || {};
  const { className, mono, invalid, ...rest } = p;
  return h('input', Object.assign({
    className: cx('cz-in', mono && 'cz-mono', invalid && 'cz-in-bad', className),
  }, rest));
}

/**
 * Área de texto que crece con su contenido: en una cotización las
 * descripciones son de largo muy variable y una barra de scroll dentro de
 * una celda hace imposible leerlas.
 */
function AutoArea(props) {
  const p = props || {};
  const { className, minRows, ...rest } = p;
  const ref = useRef(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }, []);
  useEffect(fit, [p.value, fit]);
  return h('textarea', Object.assign({
    ref, rows: minRows || 1, className: cx('cz-in cz-area', className),
    onInput: fit,
  }, rest));
}

function Select(props) {
  const p = props || {};
  const { options, className, children, ...rest } = p;
  return h('select', Object.assign({ className: cx('cz-in cz-sel', className) }, rest),
    children || arr(options).map((o) => h('option', {
      key: s(o.value), value: o.value, disabled: o.disabled,
    }, s(o.label))));
}

/** Interruptor de sí/no, con la etiqueta como parte del área pulsable. */
function Toggle(props) {
  const p = props || {};
  return h('label', { className: cx('cz-toggle', p.className) }, [
    h('input', {
      key: 'i', type: 'checkbox', checked: !!p.checked, disabled: p.disabled,
      onChange: (e) => p.onChange && p.onChange(e.target.checked),
    }),
    h('span', { key: 'b', className: 'cz-toggle-box' }),
    p.label ? h('span', { key: 'l', className: 'cz-toggle-lbl' }, p.label) : null,
  ]);
}

/** Fila etiqueta + control de los formularios. */
function Field(props) {
  const p = props || {};
  return h('label', { className: cx('cz-field', p.wide && 'cz-field-wide', p.className) }, [
    h('span', { key: 'l', className: 'cz-field-lbl' }, [
      p.label,
      p.hint ? h('span', { key: 'h', className: 'cz-field-hint', title: p.hint }, ' ⓘ') : null,
    ]),
    h('span', { key: 'c', className: 'cz-field-ctl' }, p.children),
    p.help ? h('span', { key: 'e', className: 'cz-field-help' }, p.help) : null,
  ]);
}

/** Campo numérico con formato: se edita en crudo y se formatea al salir. */
function NumField(props) {
  const p = props || {};
  const [raw, setRaw] = useState(null);
  const shown = raw != null ? raw : (p.value === '' || p.value == null ? '' : numberFmt(p.value, p.decimals, p.locale));
  return h('input', {
    className: cx('cz-in cz-mono', p.align === 'right' && 'cz-right', p.className),
    inputMode: 'decimal',
    value: shown,
    placeholder: p.placeholder,
    disabled: p.disabled,
    title: p.title,
    onFocus: (e) => { setRaw(p.value === '' || p.value == null ? '' : String(p.value)); setTimeout(() => { try { e.target.select(); } catch (err) { /* no-op */ } }, 0); },
    onChange: (e) => {
      setRaw(e.target.value);
      if (p.live) p.onChange(e.target.value === '' ? '' : num(e.target.value));
    },
    onBlur: () => {
      const v = raw == null ? p.value : (s(raw).trim() === '' ? '' : num(raw));
      setRaw(null);
      if (!p.live) p.onChange(v);
      else if (s(raw).trim() === '') p.onChange('');
    },
    onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });
}

/**
 * Chip de estado. El color lo pone la clase, no un estilo en línea: así el
 * CSS puede dar una variante legible en modo noche, cosa que desde JS no se
 * puede decidir. El nombre del estado va SIEMPRE como texto, de modo que
 * nadie dependa del color para leerlo.
 */
function StatusChip(props) {
  const st = isStatus(props && props.status) ? props.status : 'draft';
  return h('span', {
    className: 'cz-chip cz-chip-status cz-st-' + st,
    title: 'Estado: ' + STATUS_LABEL.get(st),
  }, STATUS_LABEL.get(st));
}

function Chip(props) {
  const p = props || {};
  return h(p.onClick ? 'button' : 'span', {
    className: cx('cz-chip', p.on && 'on', p.className),
    onClick: p.onClick,
    title: p.title,
    type: p.onClick ? 'button' : undefined,
  }, p.children);
}

/** Pantalla de estado vacío: qué falta y qué hacer al respecto. */
function Empty(props) {
  const p = props || {};
  return h('div', { className: 'cz-empty' }, [
    h('div', { key: 'i', className: 'cz-empty-ico' }, p.icon || '🧾'),
    h('div', { key: 't', className: 'cz-empty-title' }, p.title),
    p.text ? h('div', { key: 'x', className: 'cz-empty-text' }, p.text) : null,
    p.action ? h('div', { key: 'a', className: 'cz-empty-action' }, p.action) : null,
  ]);
}

/**
 * Diálogo modal. Se monta dentro de la ventana de la app (no en el body) para
 * que herede el tema y quede recortado por la ventana del shell.
 */
function Modal(props) {
  const p = props || {};
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && p.onClose) p.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.onClose]);
  if (!p.open) return null;
  return h('div', {
    className: 'cz-modal-back',
    onMouseDown: (e) => { if (e.target === e.currentTarget && p.onClose) p.onClose(); },
  }, h('div', { className: cx('cz-modal', p.wide && 'cz-modal-wide', p.full && 'cz-modal-full') }, [
    h('div', { key: 'h', className: 'cz-modal-hd' }, [
      h('div', { key: 't', className: 'cz-modal-title' }, p.title),
      h(IconBtn, { key: 'x', icon: '✕', title: 'Cerrar', onClick: p.onClose }),
    ]),
    h('div', { key: 'b', className: 'cz-modal-body' }, p.children),
    p.footer ? h('div', { key: 'f', className: 'cz-modal-ft' }, p.footer) : null,
  ]));
}

/**
 * Confirmación. Devuelve una promesa que resuelve a true/false, para poder
 * escribir `if (await confirm(...))` en los manejadores sin encadenar estados.
 */
function useConfirm() {
  const [state, setState] = useState(null);
  const ask = useCallback((opts) => new Promise((resolve) => {
    setState(Object.assign({ resolve }, isObj(opts) ? opts : { text: s(opts) }));
  }), []);
  const close = (val) => { if (state && state.resolve) state.resolve(val); setState(null); };
  const node = h(Modal, {
    open: !!state,
    title: (state && state.title) || 'Confirmar',
    onClose: () => close(false),
    footer: [
      h(Btn, { key: 'c', onClick: () => close(false) }, (state && state.cancelLabel) || 'Cancelar'),
      h(Btn, {
        key: 'o',
        variant: state && state.danger ? 'danger' : 'primary',
        onClick: () => close(true),
      }, (state && state.okLabel) || 'Confirmar'),
    ],
  }, h('div', { className: 'cz-confirm-text' }, (state && state.text) || ''));
  return [ask, node];
}

/** Buscador con el aspa para limpiar. */
function SearchBox(props) {
  const p = props || {};
  return h('div', { className: 'cz-search' }, [
    h('span', { key: 'i', className: 'cz-search-ico' }, '🔎'),
    h('input', {
      key: 'in', className: 'cz-in cz-search-in', value: p.value || '',
      placeholder: p.placeholder || 'Buscar…',
      onChange: (e) => p.onChange(e.target.value),
    }),
    p.value ? h(IconBtn, { key: 'x', icon: '✕', title: 'Limpiar', onClick: () => p.onChange('') }) : null,
  ]);
}

/** Indicador de sincronización: guardando · al día · sin conexión. */
function SyncDot(props) {
  const sy = (props && props.sync) || {};
  const state = sy.offline ? 'off' : (sy.saving > 0 ? 'busy' : 'ok');
  const label = sy.offline
    ? 'Sin conexión con el servidor: los cambios se reintentan solos.'
    : (sy.saving > 0 ? 'Guardando…' : (sy.at ? 'Al día · última sincronización ' + new Date(sy.at).toLocaleTimeString() : 'Al día'));
  return h('span', { className: cx('cz-sync', 'cz-sync-' + state), title: label }, [
    h('span', { key: 'd', className: 'cz-sync-dot' }),
    h('span', { key: 't', className: 'cz-sync-txt' }, sy.offline ? 'Sin conexión' : (sy.saving > 0 ? 'Guardando' : 'Guardado')),
  ]);
}

/** Editor de una lista de textos (las notas de la propuesta). */
function TextList(props) {
  const p = props || {};
  const items = arr(p.value);
  const set = (i, v) => { const next = items.slice(); next[i] = v; p.onChange(next); };
  const del = (i) => p.onChange(items.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    const t = next[i]; next[i] = next[j]; next[j] = t;
    p.onChange(next);
  };
  return h('div', { className: 'cz-textlist' }, [
    ...items.map((t, i) => h('div', { key: 'r' + i, className: 'cz-textlist-row' }, [
      h('span', { key: 'b', className: 'cz-textlist-bullet' }, '–'),
      h(AutoArea, {
        key: 'a', value: t, placeholder: p.placeholder || 'Nota…',
        onChange: (e) => set(i, e.target.value),
      }),
      h('div', { key: 'x', className: 'cz-textlist-acts' }, [
        h(IconBtn, { key: 'u', icon: '↑', title: 'Subir', disabled: i === 0, onClick: () => move(i, -1) }),
        h(IconBtn, { key: 'd', icon: '↓', title: 'Bajar', disabled: i === items.length - 1, onClick: () => move(i, 1) }),
        h(IconBtn, { key: 'r', icon: '🗑', title: 'Quitar', onClick: () => del(i) }),
      ]),
    ])),
    h(Btn, {
      key: 'add', size: 'sm', className: 'cz-textlist-add',
      onClick: () => p.onChange(items.concat([''])),
    }, '+ Añadir nota'),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/25-files.js
// ══════════════════════════════════════════════════════════════════════
/* ══ ARCHIVOS ═════════════════════════════════════════════════════════════
 *
 * Subida de imágenes (logo del emisor, fotos de los ítems, imágenes del
 * lienzo) al almacenamiento del tenant.
 *
 * El camino bueno es `shell.files` (APP-SPEC §7.e): la RUTA la decide el
 * host, no la app, y eso da aislamiento por app, cuota atribuible y limpieza
 * al desinstalar. Antes se hacía a mano con `authFetch` a `/api/v2/files`,
 * eligiendo nosotros la ruta; ese camino se conserva SOLO como respaldo para
 * un host que todavía no exponga `shell.files`, porque una cotización sin
 * poder subir su logo no es una cotización.
 *
 * Por qué NO se guardan como data-URI dentro del documento: una imagen de
 * medio mega dentro del item lo haría rebotar en cada guardado y viajaría
 * entero en cada sincronización. La cotización guarda solo la URL.
 */

const MAX_IMAGE_MB = 8;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/** Nombre de archivo seguro: sin rutas, sin acentos, sin espacios. */
function safeFileName(name, fallback) {
  const base = s(name).split(/[\\/]/).pop();
  const clean = canon(base.replace(/\.[a-z0-9]+$/i, '')).replace(/\s+/g, '-').slice(0, 60);
  const ext = (s(base).match(/\.([a-z0-9]{1,5})$/i) || [])[1] || '';
  return (clean || s(fallback) || 'archivo') + (ext ? '.' + ext.toLowerCase() : '');
}

/**
 * Sube un archivo y devuelve su URL pública. `folder` agrupa por uso
 * (`logos`, `items`, `lienzo`) para que el gestor de Archivos del tenant no
 * quede con un cajón de sastre.
 */
async function uploadImage(file, folder) {
  if (!file) throw new Error('No hay archivo.');
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error('La imagen supera los ' + MAX_IMAGE_MB + ' MB.');
  // El tipo lo valida la app: la plataforma no adivina qué es aceptable aquí.
  if (file.type && IMAGE_TYPES.indexOf(file.type) === -1) throw new Error('Formato no admitido: usa PNG, JPG, WEBP o SVG.');

  if (shell.files && typeof shell.files.upload === 'function') {
    return shell.files.upload(file, { folder: s(folder) || 'imagenes', maxMB: MAX_IMAGE_MB });
  }
  return subirALaAntigua(file, folder);
}

/**
 * Respaldo para un host sin `shell.files`: la app elige la ruta, que es
 * justo lo que `shell.files` vino a quitarle. Se mantiene para no dejar sin
 * logo a un tenant que no haya actualizado el shell, y debería desaparecer
 * cuando ya no queden.
 */
async function subirALaAntigua(file, folder) {
  if (!shell.authFetch) throw new Error('Este host no permite subir archivos.');
  const path = 'imagenes/cotizaciones/' + (s(folder) ? s(folder) + '/' : '')
    + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-'
    + safeFileName(file.name, 'imagen');

  const fd = new FormData();
  fd.append('path', path);
  fd.append('file', file);
  const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(s(d.detail) || 'No se pudo subir (HTTP ' + res.status + ').');
  }
  return API + '/api/public/files/' + path;
}

/**
 * Campo de imagen reutilizable: URL editable + botón de subida + miniatura.
 * Se usa para el logo del emisor y para las imágenes de ítems y del lienzo.
 */
function ImageField(props) {
  const p = props || {};
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef(null);

  const elegir = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';                       // permite reelegir el mismo archivo
    if (!file) return;
    setSubiendo(true);
    try {
      const url = await uploadImage(file, p.folder);
      p.onChange(url);
      shell.notify({ level: 'success', text: 'Imagen subida.' });
    } catch (err) {
      shell.notify({ level: 'error', text: (err && err.message) || 'No se pudo subir la imagen.' });
    } finally { setSubiendo(false); }
  };

  return h('div', { className: cx('cz-imgfield', p.className) }, [
    p.value ? h('img', {
      key: 'p', className: 'cz-imgfield-thumb', src: p.value, alt: '',
      onError: (e) => { e.target.style.opacity = '.25'; },
    }) : h('div', { key: 'p', className: 'cz-imgfield-thumb cz-imgfield-empty' }, '🖼'),
    h('div', { key: 'c', className: 'cz-imgfield-ctl' }, [
      h(Input, {
        key: 'u', value: p.value || '', placeholder: p.placeholder || 'URL de la imagen',
        onChange: (e) => p.onChange(e.target.value),
      }),
      h('div', { key: 'b', className: 'cz-imgfield-btns' }, [
        h(Btn, {
          key: 's', size: 'sm', disabled: subiendo,
          onClick: () => inputRef.current && inputRef.current.click(),
        }, subiendo ? 'Subiendo…' : 'Subir…'),
        p.value ? h(Btn, { key: 'x', size: 'sm', onClick: () => p.onChange('') }, 'Quitar') : null,
      ]),
      h('input', {
        key: 'f', ref: inputRef, type: 'file', accept: 'image/*',
        style: { display: 'none' }, onChange: elegir,
      }),
    ]),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/30-actions.js
// ══════════════════════════════════════════════════════════════════════
/* ══ ACCIONES ═════════════════════════════════════════════════════════════
 *
 * La capa de "qué puede hacer la app", entre la UI y el estado. Existe
 * separada por una razón concreta: el agente IA tiene que poder hacer
 * EXACTAMENTE lo mismo que una persona, y la única forma de garantizarlo es
 * que ambos llamen a estas funciones (APP-SPEC §5 y §6). La UI no muta el
 * modelo por su cuenta y el agente no tiene un camino paralelo.
 *
 * Todas devuelven algo útil (el documento resultante, o null si no se pudo)
 * y ninguna asume que sus argumentos vengan bien: el agente puede mandar
 * cualquier cosa.
 */

// ── Vista ───────────────────────────────────────────────────────────────
const TABS = [
  ['quotes', 'Cotizaciones', '🧾'],
  ['templates', 'Plantillas', '📑'],
  ['catalog', 'Catálogo', '📦'],
  ['mails', 'Correos', '✉️'],
  ['board', 'Seguimiento', '📊'],
  ['settings', 'Ajustes', '⚙️'],
];
const TAB_IDS = TABS.map(([id]) => id);

function actSetTab(tab) {
  const t = TAB_IDS.indexOf(s(tab)) !== -1 ? s(tab) : 'quotes';
  setModel({ tab: t, openId: t === 'quotes' || t === 'templates' ? model.openId : '' });
  return t;
}
const actSetSearch = (q) => { setModel({ search: s(q) }); return s(q); };
const actSetFilterStatus = (st) => {
  const v = isStatus(st) ? s(st) : '';
  setModel({ filterStatus: v });
  return v;
};
function actSetSort(by, dir) {
  const cols = ['number', 'name', 'client', 'date', 'validUntil', 'status', 'total'];
  const col = cols.indexOf(s(by)) !== -1 ? s(by) : 'date';
  const d = s(dir) === 'asc' ? 'asc' : (s(dir) === 'desc' ? 'desc' : (model.sort.by === col && model.sort.dir === 'desc' ? 'asc' : 'desc'));
  setModel({ sort: { by: col, dir: d } });
  return { by: col, dir: d };
}

function actOpen(id) {
  const d = docById(s(id));
  if (!d) return null;
  setModel({ openId: d.id, tab: d.kind === KIND_TEMPLATE ? 'templates' : 'quotes' });
  return d;
}
const actCloseEditor = () => { setModel({ openId: '' }); return true; };

/** Formulario o lienzo: las dos caras del mismo documento. */
const EDITOR_VIEWS = [['data', 'Datos', '▤'], ['design', 'Diseño', '🎨']];
function actSetEditorView(view) {
  const v = EDITOR_VIEWS.some(([k]) => k === s(view)) ? s(view) : 'data';
  setModel({ editorView: v });
  return v;
}

// ── Documentos ──────────────────────────────────────────────────────────
/**
 * Crea una cotización. Si se pasa `templateId`, se replica esa plantilla
 * (o esa cotización: duplicar y crear-desde-plantilla son la misma operación
 * con distinto origen).
 */
function actNewQuote(opts) {
  const o = isObj(opts) ? opts : {};
  const rules = rulesOf();
  const asTemplate = o.kind === KIND_TEMPLATE;
  const numbering = asTemplate ? { seq: null, number: '' } : nextNumber(model.docs, rules);

  const src = o.templateId ? docById(s(o.templateId)) : null;
  if (o.templateId && !src) return null;

  let doc;
  if (src) {
    doc = cloneDoc(src, {
      kind: asTemplate ? KIND_TEMPLATE : KIND_QUOTE,
      name: s(o.name) || (src.kind === KIND_TEMPLATE ? src.name : src.name + ' (copia)'),
      number: numbering.number,
      numberSeq: numbering.seq,
      by: meLabel(),
      clearClient: o.clearClient === true,
      keepClient: o.keepClient === true,
    });
  } else {
    doc = blankQuote(rules, {
      kind: asTemplate ? KIND_TEMPLATE : KIND_QUOTE,
      name: s(o.name),
      number: numbering.number,
      numberSeq: numbering.seq,
    });
    doc.paymentInfo = issuerOf().paymentInfo;
  }
  if (isObj(o.client)) doc.client = normalizeClient(Object.assign({}, doc.client, o.client));
  if (s(o.subtitle)) doc.subtitle = s(o.subtitle);
  if (arr(o.lines).length) doc.lines = arr(o.lines).map((l) => touchLine(l));

  const created = createDoc(doc);
  if (o.open !== false) setModel({ openId: created.id, tab: asTemplate ? 'templates' : 'quotes' });
  return created;
}

/** Duplica una cotización existente para modificarla sin tocar la original. */
function actDuplicate(id, opts) {
  const o = isObj(opts) ? opts : {};
  const src = docById(s(id));
  if (!src) return null;
  return actNewQuote({
    templateId: src.id,
    kind: o.asTemplate ? KIND_TEMPLATE : KIND_QUOTE,
    name: s(o.name),
    clearClient: o.clearClient === true,
    keepClient: o.keepClient === true,
    open: o.open,
  });
}

/** Guarda la cotización como cotización tipo, reutilizable en las siguientes. */
function actSaveAsTemplate(id, name) {
  const src = docById(s(id));
  if (!src) return null;
  const t = actNewQuote({
    templateId: src.id,
    kind: KIND_TEMPLATE,
    name: s(name) || (src.name + ' (tipo)'),
    open: false,
  });
  if (t) shell.notify({ level: 'success', text: 'Guardada como cotización tipo: ' + t.name });
  return t;
}

/** Cambia los campos de cabecera. Solo se aceptan los que el modelo conoce. */
const PATCHABLE = new Set([
  'name', 'subtitle', 'number', 'status', 'date', 'validUntil', 'validDays', 'currency',
  'symbol', 'decimals', 'locale', 'taxPct', 'discountPct', 'discountAmount',
  'advanceEnabled', 'advancePct', 'notes', 'paymentInfo', 'blocks', 'mail',
]);

function actPatchDoc(id, patch) {
  if (!isObj(patch)) return null;
  return commitDoc(s(id), (d) => {
    for (const k of Object.keys(patch)) {
      if (!PATCHABLE.has(k)) continue;
      d[k] = patch[k];
    }
    return d;
  });
}

function actPatchClient(id, patch) {
  if (!isObj(patch)) return null;
  return commitDoc(s(id), (d) => {
    d.client = normalizeClient(Object.assign({}, d.client, patch));
    return d;
  });
}

/** Cambio de estado con registro en la bitácora (es lo que se sigue después). */
function actSetStatus(id, status, detail) {
  if (!isStatus(status)) return null;
  const before = docById(s(id));
  if (!before || before.status === status) return before;
  return commitDoc(s(id), (d) => {
    d.status = s(status);
    return logEvent(d, 'status', (STATUS_LABEL.get(before.status) || before.status)
      + ' → ' + (STATUS_LABEL.get(status) || status) + (s(detail) ? ' · ' + s(detail) : ''));
  });
}

function actRenameDoc(id, name) {
  if (!s(name).trim()) return null;
  return actPatchDoc(id, { name: s(name).trim() });
}

function actRemoveDoc(id) { return removeDoc(s(id)); }

// ── Líneas ──────────────────────────────────────────────────────────────
function actAddLine(id, line, atIndex) {
  const l = touchLine(Object.assign({ id: uid('l') }, isObj(line) ? line : {}));
  const doc = commitDoc(s(id), (d) => {
    const lines = arr(d.lines).slice();
    const at = atIndex == null ? lines.length : clamp(Math.round(num(atIndex)), 0, lines.length);
    lines.splice(at, 0, l);
    d.lines = lines;
    return d;
  }, { meta: false });
  return doc ? l : null;
}

function actUpdateLine(id, lineId, patch) {
  if (!isObj(patch)) return null;
  let updated = null;
  commitDoc(s(id), (d) => {
    d.lines = arr(d.lines).map((l) => {
      if (l.id !== s(lineId)) return l;
      updated = touchLine(Object.assign({}, l, patch, { id: l.id }));
      return updated;
    });
    return d;
  }, { meta: false });
  return updated;
}

function actRemoveLine(id, lineId) {
  let removed = false;
  commitDoc(s(id), (d) => {
    const before = arr(d.lines).length;
    d.lines = arr(d.lines).filter((l) => l.id !== s(lineId));
    removed = d.lines.length < before;
    if (removed) {
      // Lápida: sin esto la línea reaparece desde la pantalla de otra persona.
      d.deletedLines = pruneTombs(arr(d.deletedLines).concat([{ id: s(lineId), at: stamp(), by: meLabel() }]));
    }
    return d;
  }, { meta: false });
  return removed;
}

/** Reordena una línea. `toIndex` se recorta al rango válido. */
function actMoveLine(id, lineId, toIndex) {
  let moved = false;
  commitDoc(s(id), (d) => {
    const lines = arr(d.lines).slice();
    const from = lines.findIndex((l) => l.id === s(lineId));
    if (from < 0) return d;
    const to = clamp(Math.round(num(toIndex)), 0, lines.length - 1);
    if (to === from) return d;
    const [it] = lines.splice(from, 1);
    lines.splice(to, 0, Object.assign({}, it, { updatedAt: stamp(), updatedBy: meLabel() }));
    d.lines = lines;
    moved = true;
    return d;
  }, { meta: false });
  return moved;
}

/** Duplica una línea justo debajo de la original. */
function actDuplicateLine(id, lineId) {
  const doc = docById(s(id));
  if (!doc) return null;
  const i = arr(doc.lines).findIndex((l) => l.id === s(lineId));
  if (i < 0) return null;
  const copy = Object.assign({}, doc.lines[i], { id: uid('l') });
  return actAddLine(id, copy, i + 1);
}

// ── Banco de ítems y servicios prefijados ───────────────────────────────
function actUpsertCatalogItem(item) {
  if (!isObj(item)) return null;
  return upsertCatalog(item);
}
const actRemoveCatalogItem = (id) => removeCatalog(s(id));

/** Inserta un ítem del banco como línea de la cotización. */
function actAddCatalogToQuote(quoteId, catalogId, overrides) {
  const c = catalogById(s(catalogId));
  if (!c) return null;
  const line = Object.assign(lineFromCatalog(c), isObj(overrides) ? overrides : {});
  const added = actAddLine(quoteId, line);
  if (added) upsertCatalog(Object.assign({}, c, { usageCount: c.usageCount + 1 }));
  return added;
}

/** Guarda una línea de la cotización en el banco, para reutilizarla después. */
function actSaveLineToCatalog(quoteId, lineId, group) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const line = arr(doc.lines).find((l) => l.id === s(lineId));
  if (!line) return null;
  const item = upsertCatalog(catalogFromLine(line, group));
  shell.notify({ level: 'success', text: 'Guardado en el catálogo: ' + item.name });
  return item;
}

// ── Ajustes del cotizador ───────────────────────────────────────────────
function actPatchIssuer(patch) {
  if (!isObj(patch)) return null;
  return commitDefinition((d) => {
    d.issuer = normalizeIssuer(Object.assign({}, d.issuer, patch));
    return d;
  });
}

function actPatchRules(patch) {
  if (!isObj(patch)) return null;
  return commitDefinition((d) => {
    d.rules = normalizeRules(Object.assign({}, d.rules, patch));
    return d;
  });
}

// ── Consultas (las usa el listado y también el agente) ──────────────────
/** Cotizaciones filtradas y ordenadas tal como se ven en pantalla. */
function visibleDocs(kind) {
  const rules = rulesOf();
  const k = kind === KIND_TEMPLATE ? KIND_TEMPLATE : KIND_QUOTE;
  const q = canon(model.search);
  let list = model.docs.filter((d) => d.kind === k);
  if (q) list = list.filter((d) => quoteHaystack(d).indexOf(q) !== -1);
  if (model.filterStatus && k === KIND_QUOTE) {
    list = list.filter((d) => effectiveStatus(d, rules) === model.filterStatus);
  }
  const { by, dir } = model.sort;
  const sign = dir === 'asc' ? 1 : -1;
  const key = (d) => {
    if (by === 'total') return computeTotals(d, rules).total;
    if (by === 'client') return canon(d.client.name);
    if (by === 'status') return s(effectiveStatus(d, rules));
    if (by === 'name') return canon(d.name);
    if (by === 'number') return num((s(d.number).match(/(\d+)\s*$/) || [])[1]);
    if (by === 'validUntil') return s(validUntilOf(d, rules));
    return s(d.date);
  };
  return list.slice().sort((a, b) => {
    const ka = key(a); const kb = key(b);
    if (ka < kb) return -1 * sign;
    if (ka > kb) return 1 * sign;
    return s(a.id).localeCompare(s(b.id));
  });
}

/** Resumen del cotizador: lo que ve el tablero y lo que lee el agente. */
function pipelineSummary() {
  const rules = rulesOf();
  const out = { count: 0, byStatus: {}, total: 0, open: 0, won: 0, currency: currencyOf(null, rules) };
  for (const [k] of STATUSES) out.byStatus[k] = { count: 0, total: 0 };
  for (const d of quotesOf()) {
    const st = effectiveStatus(d, rules);
    const t = computeTotals(d, rules).total;
    out.count++;
    out.total += t;
    if (!out.byStatus[st]) out.byStatus[st] = { count: 0, total: 0 };
    out.byStatus[st].count++;
    out.byStatus[st].total += t;
    if (st === 'sent') out.open += t;
    if (st === 'accepted') out.won += t;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════
// src/40-quotes.js
// ══════════════════════════════════════════════════════════════════════
/* ══ LISTADO Y EDITOR DE COTIZACIONES ═════════════════════════════════════
 *
 * Dos pantallas sobre el mismo modelo: la lista (qué hay y en qué estado) y
 * el editor de una cotización (cabecera, cliente, líneas, totales y notas).
 * La pestaña de Plantillas reutiliza ambas: una cotización tipo es una
 * cotización con `kind: 'template'`, sin número ni cliente.
 */

// ── Listado ─────────────────────────────────────────────────────────────
function QuotesTab(props) {
  const m = props.m;
  const kind = props.kind === KIND_TEMPLATE ? KIND_TEMPLATE : KIND_QUOTE;
  const esPlantilla = kind === KIND_TEMPLATE;
  const rules = normalizeRules(m.def.rules);
  const list = visibleDocs(kind);
  const total = m.docs.filter((d) => d.kind === kind).length;
  const [ask, confirmNode] = useConfirm();
  const [nueva, setNueva] = useState(false);
  // Una plantilla se crea en blanco y se llena; una cotización casi siempre
  // parte de algo, así que ahí se pregunta de qué.
  const crear = () => (esPlantilla ? actNewQuote({ kind }) : setNueva(true));

  const th = (id, label, extra) => h('th', {
    key: id,
    className: cx('cz-th', extra, m.sort.by === id && 'on'),
    onClick: () => actSetSort(id),
    title: 'Ordenar por ' + label,
  }, [label, m.sort.by === id ? h('span', { key: 'a', className: 'cz-th-arrow' }, m.sort.dir === 'asc' ? ' ▲' : ' ▼') : null]);

  const cabecera = h('div', { className: 'cz-listbar' }, [
    h(SearchBox, {
      key: 'q', value: m.search, onChange: actSetSearch,
      placeholder: esPlantilla ? 'Buscar plantilla…' : 'Buscar por número, cliente, ítem…',
    }),
    !esPlantilla ? h('div', { key: 'f', className: 'cz-filters' }, [
      h(Chip, { key: 'all', on: !m.filterStatus, onClick: () => actSetFilterStatus('') }, 'Todas'),
      ...STATUSES.map(([k, label]) => h(Chip, {
        key: k, on: m.filterStatus === k, onClick: () => actSetFilterStatus(m.filterStatus === k ? '' : k),
      }, label)),
    ]) : null,
    h('div', { key: 'sp', className: 'cz-spacer' }),
    h(Btn, {
      key: 'new', variant: 'primary',
      onClick: crear,
    }, esPlantilla ? '+ Nueva plantilla' : '+ Nueva cotización'),
    nueva ? h(NewQuoteModal, { key: 'nq', m, onClose: () => setNueva(false) }) : null,
  ]);

  if (!total) {
    return h('div', { className: 'cz-tab' }, [
      cabecera,
      h(Empty, {
        key: 'e',
        icon: esPlantilla ? '📑' : '🧾',
        title: esPlantilla ? 'Aún no hay cotizaciones tipo' : 'Aún no hay cotizaciones',
        text: esPlantilla
          ? 'Una cotización tipo es una propuesta predeterminada que se reutiliza: se crea desde cero aquí, o se guarda desde cualquier cotización con “Guardar como tipo”.'
          : 'Crea la primera y añade sus líneas a mano, desde el catálogo de ítems prefijados o desde el catálogo de productos del sistema.',
        action: h(Btn, { variant: 'primary', onClick: crear },
          esPlantilla ? 'Crear cotización tipo' : 'Crear la primera cotización'),
      }),
      confirmNode,
    ]);
  }

  return h('div', { className: 'cz-tab' }, [
    cabecera,
    h('div', { key: 't', className: cx('cz-tablewrap', m.settings.denseTables && 'dense') },
      h('table', { className: 'cz-table' }, [
        h('thead', { key: 'h' }, h('tr', null, [
          !esPlantilla ? th('number', 'Nº') : null,
          th('name', esPlantilla ? 'Plantilla' : 'Cotización'),
          !esPlantilla ? th('client', 'Cliente') : null,
          th('date', 'Fecha'),
          !esPlantilla ? th('validUntil', 'Vence') : null,
          !esPlantilla ? th('status', 'Estado') : null,
          th('total', 'Total', 'cz-right'),
          h('th', { key: 'a', className: 'cz-th cz-th-acts' }, ''),
        ])),
        h('tbody', { key: 'b' }, list.map((d) => {
          const t = computeTotals(d, rules);
          const st = effectiveStatus(d, rules);
          const until = validUntilOf(d, rules);
          const dias = diasHasta(until);
          return h('tr', {
            key: d.id, className: 'cz-tr', onClick: () => actOpen(d.id),
            title: 'Abrir ' + d.name,
          }, [
            !esPlantilla ? h('td', { key: 'n', className: 'cz-mono cz-dim' }, d.number || '—') : null,
            h('td', { key: 'name' }, [
              h('div', { key: 'a', className: 'cz-cell-title' }, [
                d.name,
                d.isDefault ? h('span', { key: 'd', className: 'cz-star', title: 'Plantilla predeterminada' }, ' ⭐') : null,
              ]),
              d.subtitle ? h('div', { key: 'b', className: 'cz-cell-sub' }, d.subtitle) : null,
              d.supersededBy ? h('div', { key: 'c', className: 'cz-cell-sub cz-warn' }, 'sustituida por una revisión') : null,
            ]),
            !esPlantilla ? h('td', { key: 'c' }, [
              h('div', { key: 'a' }, d.client.name || '—'),
              d.client.taxId ? h('div', { key: 'b', className: 'cz-cell-sub cz-mono' }, d.client.taxId) : null,
            ]) : null,
            h('td', { key: 'd', className: 'cz-mono cz-dim' }, fechaCorta(d.date)),
            !esPlantilla ? h('td', { key: 'v', className: 'cz-mono cz-dim' }, [
              until ? fechaCorta(until) : '—',
              until && st === 'sent' && dias != null && dias <= 3
                ? h('div', { key: 'w', className: cx('cz-cell-sub', dias < 0 ? 'cz-bad' : 'cz-warn') },
                  dias < 0 ? 'vencida' : (dias === 0 ? 'vence hoy' : 'en ' + dias + ' d'))
                : null,
            ]) : null,
            !esPlantilla ? h('td', { key: 's' }, h(StatusChip, { status: st })) : null,
            h('td', { key: 't', className: 'cz-mono cz-right cz-strong' }, money(t.total, t.currency)),
            h('td', { key: 'a', className: 'cz-td-acts', onClick: (e) => e.stopPropagation() }, [
              h(IconBtn, {
                key: 'd', icon: '⧉', title: esPlantilla ? 'Duplicar plantilla' : 'Duplicar cotización',
                onClick: () => actDuplicate(d.id, { asTemplate: esPlantilla }),
              }),
              esPlantilla ? h(IconBtn, {
                key: 'u', icon: '▶', title: 'Crear una cotización desde esta plantilla',
                onClick: () => actNewQuote({ templateId: d.id }),
              }) : null,
              esPlantilla ? h(IconBtn, {
                key: 's', icon: d.isDefault ? '⭐' : '☆',
                className: d.isDefault ? 'on' : '',
                title: d.isDefault ? 'Es la plantilla predeterminada; pulsa para dejar de serlo' : 'Usar esta plantilla como predeterminada al crear una cotización',
                onClick: () => actSetDefaultTemplate(d.isDefault ? '' : d.id),
              }) : null,
              h(IconBtn, {
                key: 'x', icon: '🗑', title: 'Eliminar',
                onClick: async () => {
                  const ok = await ask({
                    title: 'Eliminar', danger: true, okLabel: 'Eliminar',
                    text: '¿Eliminar «' + d.name + '»? No se puede deshacer.',
                  });
                  if (ok) actRemoveDoc(d.id);
                },
              }),
            ]),
          ]);
        })),
      ])),
    !list.length ? h('div', { key: 'nf', className: 'cz-nores' }, 'Ningún resultado con esos filtros.') : null,
    confirmNode,
  ]);
}

// ── Editor ──────────────────────────────────────────────────────────────
function QuoteEditor(props) {
  const m = props.m;
  const doc = props.doc;
  const esPlantilla = doc.kind === KIND_TEMPLATE;
  const rules = normalizeRules(m.def.rules);
  const issuer = normalizeIssuer(m.def.issuer);
  const totals = computeTotals(doc, rules);
  const cur = totals.currency;
  const until = validUntilOf(doc, rules);
  const [ask, confirmNode] = useConfirm();
  const [panel, setPanel] = useState('');   // panel lateral desplegado
  const [preview, setPreview] = useState(false);
  const [enviar, setEnviar] = useState(false);

  const patch = (p) => actPatchDoc(doc.id, p);
  const patchClient = (p) => actPatchClient(doc.id, p);

  return h('div', { className: 'cz-editor' }, [
    // ── Barra del documento ──────────────────────────────────────────
    h('div', { key: 'bar', className: 'cz-docbar' }, [
      h(IconBtn, { key: 'b', icon: '←', title: 'Volver al listado', onClick: actCloseEditor }),
      h('div', { key: 'id', className: 'cz-docbar-id' }, [
        h(Input, {
          key: 'n', className: 'cz-docbar-name', value: doc.name,
          placeholder: esPlantilla ? 'Nombre de la plantilla' : 'Nombre de la cotización',
          onChange: (e) => patch({ name: e.target.value }),
        }),
        !esPlantilla ? h('span', { key: 'num', className: 'cz-docbar-num cz-mono' }, doc.number || '—') : null,
      ]),
      h('div', { key: 'vw', className: 'cz-segmented cz-docbar-view' }, EDITOR_VIEWS.map(([k, label, icon]) => h('button', {
        key: k, type: 'button', className: cx('cz-seg', m.editorView === k && 'on'),
        title: k === 'design' ? 'Componer la propuesta visualmente: bloques, textos e imágenes' : 'Editar los datos de la cotización',
        onClick: () => actSetEditorView(k),
      }, [
        h('span', { key: 'i' }, icon),
        h('span', { key: 'l', className: 'cz-seg-lbl' }, label),
      ]))),
      !esPlantilla ? h(Select, {
        key: 'st', className: 'cz-docbar-status', value: effectiveStatus(doc, rules),
        title: 'Estado de la cotización',
        onChange: (e) => actSetStatus(doc.id, e.target.value),
        options: STATUSES.map(([k, l]) => ({ value: k, label: l })),
      }) : null,
      h('div', { key: 'sp', className: 'cz-spacer' }),
      !esPlantilla ? h(Btn, {
        key: 'snd', size: 'sm',
        title: 'Enviar la cotización por correo con el SMTP de la empresa',
        onClick: () => setEnviar(true),
      }, '✉ Enviar') : null,
      h(Btn, {
        key: 'pv', size: 'sm', variant: 'primary',
        title: 'Ver la propuesta como se imprimirá, exportarla a PDF o publicar su enlace',
        onClick: () => setPreview(true),
      }, '👁 Vista previa'),
      h(Btn, {
        key: 'dup', size: 'sm', title: 'Crear una copia editable de esta cotización',
        onClick: () => actDuplicate(doc.id, { asTemplate: esPlantilla }),
      }, '⧉ Duplicar'),
      !esPlantilla && doc.status !== 'draft' && !doc.supersededBy ? h(Btn, {
        key: 'rev', size: 'sm',
        title: 'Emitir una revisión: la cotización enviada se conserva tal cual y la nueva lleva el mismo número con sufijo',
        onClick: () => actNewRevision(doc.id),
      }, '↻ Revisar') : null,
      !esPlantilla ? h(Btn, {
        key: 'tpl', size: 'sm', title: 'Guardar esta cotización como cotización tipo reutilizable',
        onClick: () => actSaveAsTemplate(doc.id),
      }, '📑 Guardar como tipo') : h(Btn, {
        key: 'use', size: 'sm', variant: 'primary', title: 'Crear una cotización desde esta plantilla',
        onClick: () => actNewQuote({ templateId: doc.id }),
      }, '▶ Usar plantilla'),
      esPlantilla ? h(Btn, {
        key: 'def', size: 'sm', active: doc.isDefault,
        title: doc.isDefault ? 'Es la plantilla predeterminada' : 'Usar esta plantilla al crear una cotización nueva',
        onClick: () => actSetDefaultTemplate(doc.isDefault ? '' : doc.id),
      }, doc.isDefault ? '⭐ Predeterminada' : '☆ Predeterminada') : null,
    ]),

    // ── Cuerpo ───────────────────────────────────────────────────────
    !esPlantilla ? h(RevisionBar, { key: 'rb', doc }) : null,
    m.editorView === 'design'
      ? h(CanvasEditor, { key: 'canvas', m, doc })
      : h('div', { key: 'body', className: 'cz-editor-body' }, [
      h('div', { key: 'main', className: 'cz-editor-main' }, [
        h(DocHeaderPanel, { key: 'hd', doc, m, rules, issuer, until, esPlantilla, patch, patchClient }),
        h(LinesTable, { key: 'ln', doc, m, rules, cur, totals, ask }),
        h(NotesPanel, { key: 'nt', doc, issuer, patch }),
      ]),
      h('div', { key: 'side', className: 'cz-editor-side' }, [
        h(TotalsPanel, { key: 'tot', doc, rules, totals, patch }),
        h(EventsPanel, { key: 'ev', doc, open: panel === 'events', onToggle: () => setPanel(panel === 'events' ? '' : 'events') }),
      ]),
    ]),
    preview ? h(PreviewModal, { key: 'pv', m, doc, onClose: () => setPreview(false) }) : null,
    enviar ? h(SendMailModal, { key: 'sm', m, doc, onClose: () => setEnviar(false) }) : null,
    confirmNode,
  ]);
}

// ── Cabecera del documento: emisor, cliente, fechas ──────────────────────
function DocHeaderPanel(props) {
  const { doc, m, rules, issuer, until, esPlantilla, patch, patchClient } = props;
  const [picker, setPicker] = useState(false);
  return h('section', { className: 'cz-card' }, [
    picker ? h(ClientPickerModal, { key: 'cp', m, quoteId: doc.id, onClose: () => setPicker(false) }) : null,
    h('div', { key: 'h', className: 'cz-card-hd' }, [
      h('h3', { key: 't' }, esPlantilla ? 'Datos de la plantilla' : 'Cliente y vigencia'),
      issuer.name
        ? h('span', { key: 'i', className: 'cz-card-note' }, 'Emite: ' + issuer.name + (issuer.taxId ? ' · ' + issuer.taxId : ''))
        : h('span', { key: 'i', className: 'cz-card-note cz-warn' }, 'Falta configurar el emisor en Ajustes'),
    ]),
    h('div', { key: 'g', className: 'cz-grid2' }, [
      !esPlantilla ? h(Field, { key: 'cn', label: 'Cliente' }, h('div', { className: 'cz-inline cz-nowrap' }, [
        h(Input, {
          key: 'i', value: doc.client.name, placeholder: 'Razón social o nombre',
          onChange: (e) => patchClient({ name: e.target.value }),
        }),
        h(IconBtn, {
          key: 'b', icon: '👥', title: 'Traer un cliente del directorio (app Clientes)',
          onClick: () => setPicker(true),
        }),
      ])) : null,
      !esPlantilla ? h(Field, { key: 'ct', label: 'RUT / ID fiscal' },
        h(Input, { mono: true, value: doc.client.taxId, placeholder: '77.718.188-2', onChange: (e) => patchClient({ taxId: e.target.value }) })) : null,
      !esPlantilla ? h(Field, { key: 'cc', label: 'Contacto' },
        h(Input, { value: doc.client.contact, placeholder: 'Nombre de quien recibe', onChange: (e) => patchClient({ contact: e.target.value }) })) : null,
      !esPlantilla ? h(Field, { key: 'ce', label: 'Correo' },
        h(Input, { type: 'email', value: doc.client.email, placeholder: 'contacto@empresa.cl', onChange: (e) => patchClient({ email: e.target.value }) })) : null,
      h(Field, { key: 'sub', label: 'Asunto de la propuesta', wide: true, help: 'Aparece bajo el título: “Proceso Matrícula DEMRE — Enero 2027”.' },
        h(Input, { value: doc.subtitle, placeholder: 'Motivo o proyecto que se cotiza', onChange: (e) => patch({ subtitle: e.target.value }) })),
      !esPlantilla ? h(Field, { key: 'dt', label: 'Fecha' },
        h(Input, { type: 'date', value: doc.date, onChange: (e) => patch({ date: e.target.value }) })) : null,
      h(Field, {
        key: 'vd', label: 'Vigencia',
        help: esPlantilla ? 'Días que arrastrará cada cotización creada desde esta plantilla.'
          : (until ? 'Vence el ' + fechaLarga(until) + (rules.validBusinessDays ? ' (días hábiles)' : '') : 'Sin vencimiento'),
      }, h('div', { className: 'cz-inline' }, [
        h(NumField, {
          key: 'n', value: doc.validDays == null ? rules.validDays : doc.validDays,
          onChange: (v) => patch({ validDays: v === '' ? null : v, validUntil: '' }),
        }),
        h('span', { key: 'u', className: 'cz-unit' }, rules.validBusinessDays ? 'días hábiles' : 'días'),
      ])),
    ]),
    !esPlantilla ? h(ClientRecordBar, { key: 'rb', doc }) : null,
  ]);
}

/**
 * Estado de la identidad del cliente, bajo la ficha.
 *
 * Se pinta SIEMPRE, también cuando no hay vínculo: que una cotización viva
 * solo con su copia del cliente es legítimo, pero conviene VERLO, porque es
 * justo la situación que produce el segundo «Acme SpA» meses después.
 */
function ClientRecordBar(props) {
  const { doc } = props;
  const [ocupado, setOcupado] = useState('');
  const v = estadoVinculo(doc);
  const sinRegistro = registroNoDisponible();
  const puedeEscribir = !!(shell.data && typeof shell.data.create === 'function');
  const yaEnDirectorio = s(doc.client.sourceItemId) !== '';
  const correr = (nombre, fn) => {
    setOcupado(nombre);
    Promise.resolve().then(fn).then(() => setOcupado(''), () => setOcupado(''));
  };

  return h('div', { className: 'cz-recbar' }, [
    h('span', { key: 'd', className: 'cz-recdot cz-recdot-' + v.estado }),
    h('span', { key: 't', className: 'cz-recbar-txt' }, v.texto),
    h('span', { key: 'sp', className: 'cz-recbar-sp' }),
    sinRegistro
      ? h('span', { key: 'no', className: 'cz-card-note', title: sinRegistro }, 'sin directorio del sistema')
      : (v.estado === 'vinculado'
        ? h(Btn, {
          key: 'r', size: 'sm', disabled: ocupado === 'ref',
          title: 'Vuelve a leer el cliente del directorio por si cambió de nombre o se fusionó con otro',
          onClick: () => correr('ref', () => actRefreshClientRecord(doc.id)),
        }, ocupado === 'ref' ? 'Actualizando…' : 'Actualizar ficha')
        : h(Btn, {
          key: 'v', size: 'sm', variant: 'primary', disabled: ocupado === 'link',
          title: 'Reconoce a este cliente en todo KIMOS. Si ya existe, se reutiliza en vez de crear otro.',
          onClick: () => correr('link', () => actLinkClientRecord(doc.id)),
        }, ocupado === 'link' ? 'Vinculando…' : 'Vincular con el sistema')),
    (puedeEscribir && !yaEnDirectorio) ? h(Btn, {
      key: 'p', size: 'sm', disabled: ocupado === 'push',
      title: 'Guarda esta ficha en la app Clientes para no volver a escribirla',
      onClick: () => correr('push', () => actPushClientToDirectory(doc.id)),
    }, ocupado === 'push' ? 'Añadiendo…' : 'Añadir a Clientes') : null,
  ]);
}

// ── Tabla de líneas ─────────────────────────────────────────────────────
/**
 * Las filas se reordenan arrastrando (drag&drop nativo, sin dependencias).
 * `dragId` vive en el componente y no en el modelo: es estado de interacción,
 * no del documento, y no tiene por qué viajar a los demás usuarios.
 */
function LinesTable(props) {
  const { doc, m, rules, cur, totals, ask } = props;
  const [dragId, setDragId] = useState('');
  const [overId, setOverId] = useState('');
  const [picker, setPicker] = useState('');       // '' | 'own' | 'sys'
  const lines = arr(doc.lines);

  const drop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(''); setOverId(''); return; }
    const to = lines.findIndex((l) => l.id === targetId);
    if (to >= 0) actMoveLine(doc.id, dragId, to);
    setDragId(''); setOverId('');
  };

  return h('section', { className: 'cz-card cz-card-lines' }, [
    h('div', { key: 'h', className: 'cz-card-hd' }, [
      h('h3', { key: 't' }, 'Ítems'),
      h('span', { key: 'c', className: 'cz-card-note' },
        lines.length + (lines.length === 1 ? ' línea' : ' líneas')
        + (totals.optionalCount ? ' · ' + totals.optionalCount + ' opcional(es) fuera del total' : '')),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, {
        key: 'own', size: 'sm', title: 'Insertar un ítem o servicio del banco propio',
        onClick: () => setPicker('own'),
      }, '📦 Del catálogo'),
      h(Btn, {
        key: 'sys', size: 'sm', title: 'Cotizar un producto de las apps Productos o ProductLab',
        onClick: () => setPicker('sys'),
      }, '🛒 Del sistema'),
      h(Btn, {
        key: 'add', size: 'sm', variant: 'primary',
        onClick: () => actAddLine(doc.id, { title: '', qty: 1, unitPrice: 0 }),
      }, '+ Línea'),
    ]),
    picker === 'own' ? h(CatalogPickerModal, { key: 'pk', m, quoteId: doc.id, onClose: () => setPicker('') }) : null,
    picker === 'sys' ? h(ProductPickerModal, { key: 'pk', m, quoteId: doc.id, onClose: () => setPicker('') }) : null,
    h('div', { key: 'w', className: 'cz-tablewrap' }, h('table', { className: 'cz-table cz-lines' }, [
      h('thead', { key: 'h' }, h('tr', null, [
        h('th', { key: 'g', className: 'cz-th cz-th-grip' }, ''),
        h('th', { key: 'i', className: 'cz-th' }, 'ITEM'),
        h('th', { key: 'd', className: 'cz-th' }, 'DESCRIPCIÓN'),
        h('th', { key: 'q', className: 'cz-th cz-right' }, 'CANTIDAD'),
        h('th', { key: 'u', className: 'cz-th cz-right' }, rules.priceMode === 'gross' ? 'PRECIO UNIT' : 'NETO UNIT'),
        h('th', { key: 't', className: 'cz-th cz-right' }, rules.priceMode === 'gross' ? 'TOTAL' : 'NETO TOTAL'),
        h('th', { key: 'a', className: 'cz-th cz-th-acts' }, ''),
      ])),
      h('tbody', { key: 'b' }, lines.map((l, i) => h(LineRow, {
        key: l.id, doc, line: l, index: i, cur, rules, ask,
        dragging: dragId === l.id, over: overId === l.id,
        onDragStart: () => setDragId(l.id),
        onDragOver: () => setOverId(l.id),
        onDragEnd: () => { setDragId(''); setOverId(''); },
        onDrop: () => drop(l.id),
      }))),
    ])),
    !lines.length ? h('div', { key: 'e', className: 'cz-lines-empty' }, [
      h('span', { key: 't' }, 'Sin líneas todavía. '),
      h(Btn, { key: 'a', size: 'sm', onClick: () => actAddLine(doc.id, { title: '', qty: 1, unitPrice: 0 }) }, 'Añadir la primera'),
    ]) : null,
  ]);
}

function LineRow(props) {
  const { doc, line, index, cur, rules, ask, dragging, over } = props;
  const l = line;
  const set = (p) => actUpdateLine(doc.id, l.id, p);
  const totalLinea = lineDisplayTotal(l, {
    taxPct: doc.taxPct == null ? rules.taxPct : doc.taxPct,
    priceMode: rules.priceMode,
  });
  const origen = l.source && l.source.kind !== 'manual' ? l.source.kind : '';

  return h('tr', {
    className: cx('cz-tr cz-linerow', dragging && 'dragging', over && 'over', l.optional && 'optional'),
    onDragOver: (e) => { e.preventDefault(); props.onDragOver(); },
    onDrop: (e) => { e.preventDefault(); props.onDrop(); },
  }, [
    h('td', {
      key: 'g', className: 'cz-td-grip', draggable: true, title: 'Arrastra para reordenar',
      onDragStart: props.onDragStart, onDragEnd: props.onDragEnd,
    }, [
      h('span', { key: 'n', className: 'cz-linenum' }, index + 1),
      h('span', { key: 'g', className: 'cz-grip' }, '⠿'),
    ]),
    h('td', { key: 'i', className: 'cz-td-item' }, [
      h(AutoArea, {
        key: 't', value: l.title, placeholder: 'Nombre del ítem',
        onChange: (e) => set({ title: e.target.value }),
      }),
      origen ? h('span', {
        key: 'o', className: 'cz-src', title: origen === 'catalog' ? 'Viene del catálogo propio de ítems'
          : (origen === 'product' ? 'Viene de la app Productos' : 'Viene de ProductLab'),
      }, origen === 'catalog' ? '📦' : (origen === 'product' ? '🛒' : '🧪')) : null,
    ]),
    h('td', { key: 'd', className: 'cz-td-desc' }, h(AutoArea, {
      value: l.description, placeholder: 'Descripción que verá el cliente',
      onChange: (e) => set({ description: e.target.value }),
    })),
    h('td', { key: 'q', className: 'cz-td-qty' }, [
      h(NumField, {
        key: 'n', value: l.qty, align: 'right', decimals: 2, locale: cur.locale,
        onChange: (v) => set({ qty: num(v) }),
      }),
      h(Input, {
        key: 'l', className: 'cz-qtylabel', value: l.qtyLabel,
        placeholder: 'etiqueta', title: 'Texto que reemplaza la cantidad en la propuesta impresa, p. ej. “2 (sep / oct)”.',
        onChange: (e) => set({ qtyLabel: e.target.value }),
      }),
    ]),
    h('td', { key: 'u', className: 'cz-td-price' }, h(NumField, {
      value: l.unitPrice, align: 'right', decimals: cur.decimals, locale: cur.locale,
      onChange: (v) => set({ unitPrice: num(v) }),
    })),
    h('td', { key: 't', className: 'cz-mono cz-right cz-strong' }, [
      money(totalLinea, cur),
      !l.taxable ? h('div', { key: 'x', className: 'cz-cell-sub' }, 'exento') : null,
      l.discountPct ? h('div', { key: 'd', className: 'cz-cell-sub' }, '−' + l.discountPct + '%') : null,
    ]),
    h('td', { key: 'a', className: 'cz-td-acts' }, [
      h(IconBtn, {
        key: 'o', icon: l.optional ? '☑' : '☐',
        className: l.optional ? 'on' : '',
        title: l.optional ? 'Opcional: no suma al total' : 'Marcar como opcional (se ofrece aparte y no suma al total)',
        onClick: () => set({ optional: !l.optional }),
      }),
      h(IconBtn, {
        key: 'x', icon: l.taxable ? '%' : '⊘',
        className: l.taxable ? '' : 'on',
        title: l.taxable ? 'Afecto a impuesto' : 'Exento de impuesto',
        onClick: () => set({ taxable: !l.taxable }),
      }),
      origen ? h(IconBtn, {
        key: 'p', icon: '⟳',
        title: 'Volver a preguntarle el precio al catálogo' + (l.source.capturedAt ? ' (capturado el ' + fechaCorta(l.source.capturedAt) + ')' : ''),
        onClick: () => actRefreshLinePrice(doc.id, l.id),
      }) : h(IconBtn, {
        key: 's', icon: '📦', title: 'Guardar este ítem en el catálogo para reutilizarlo',
        onClick: () => actSaveLineToCatalog(doc.id, l.id),
      }),
      h(IconBtn, { key: 'd', icon: '⧉', title: 'Duplicar línea', onClick: () => actDuplicateLine(doc.id, l.id) }),
      h(IconBtn, {
        key: 'r', icon: '🗑', title: 'Quitar línea',
        onClick: async () => {
          if (!s(l.title) && !s(l.description) && !l.unitPrice) { actRemoveLine(doc.id, l.id); return; }
          const ok = await ask({ title: 'Quitar línea', danger: true, okLabel: 'Quitar', text: '¿Quitar «' + (l.title || 'esta línea') + '»?' });
          if (ok) actRemoveLine(doc.id, l.id);
        },
      }),
    ]),
  ]);
}

// ── Totales ─────────────────────────────────────────────────────────────
function TotalsPanel(props) {
  const { doc, rules, totals, patch } = props;
  const cur = totals.currency;
  const [abierto, setAbierto] = useState(false);
  const fila = (label, value, cls) => h('div', { key: label, className: cx('cz-tot-row', cls) }, [
    h('span', { key: 'l', className: 'cz-tot-lbl' }, label),
    h('span', { key: 'v', className: 'cz-tot-val cz-mono' }, value),
  ]);

  return h('section', { className: 'cz-card cz-card-totals' }, [
    h('div', { key: 'h', className: 'cz-card-hd' }, [
      h('h3', { key: 't' }, 'Totales'),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(IconBtn, {
        key: 'c', icon: abierto ? '▴' : '▾',
        title: abierto ? 'Ocultar ajustes del documento' : 'Ajustar impuesto, descuento y abono de esta cotización',
        onClick: () => setAbierto(!abierto),
      }),
    ]),
    h('div', { key: 'r', className: 'cz-tot' }, [
      fila(rules.priceMode === 'gross' ? 'Subtotal' : 'Subtotal neto', money(totals.subtotal, cur)),
      totals.discount ? fila('Descuento', '− ' + money(totals.discount, cur), 'cz-tot-disc') : null,
      totals.netExempt ? fila('Exento', money(totals.netExempt, cur)) : null,
      fila(rules.taxLabel + ' (' + numberFmt(totals.taxPct, 2, cur.locale) + '%)', money(totals.tax, cur)),
      fila('TOTAL', money(totals.total, cur), 'cz-tot-total'),
      totals.advanceEnabled ? fila('Abono (' + numberFmt(totals.advancePct, 2, cur.locale) + '%)', money(totals.advance, cur), 'cz-tot-split') : null,
      totals.advanceEnabled ? fila('Saldo (' + numberFmt(100 - totals.advancePct, 2, cur.locale) + '%)', money(totals.balance, cur), 'cz-tot-split') : null,
      totals.optionalCount ? fila('Opcionales (aparte)', money(totals.optionalTotal, cur), 'cz-tot-opt') : null,
    ]),
    abierto ? h('div', { key: 'a', className: 'cz-tot-adj' }, [
      h(Field, { key: 'cur', label: 'Moneda' }, h(Select, {
        value: doc.currency || rules.currency,
        onChange: (e) => {
          const c = CURRENCY_BY_CODE.get(e.target.value);
          patch({ currency: e.target.value, symbol: c ? c.symbol : '', decimals: c ? c.decimals : '' });
        },
        options: CURRENCIES.map((c) => ({ value: c.code, label: c.code + ' · ' + c.label })),
      })),
      h(Field, { key: 'tax', label: rules.taxLabel + ' %' }, h(NumField, {
        value: doc.taxPct == null ? rules.taxPct : doc.taxPct, decimals: 2,
        onChange: (v) => patch({ taxPct: v === '' ? null : num(v) }),
      })),
      h(Field, { key: 'dp', label: 'Descuento %' }, h(NumField, {
        value: doc.discountPct, decimals: 2,
        onChange: (v) => patch({ discountPct: num(v) }),
      })),
      h(Field, { key: 'da', label: 'Descuento monto' }, h(NumField, {
        value: doc.discountAmount, decimals: cur.decimals, locale: cur.locale,
        onChange: (v) => patch({ discountAmount: num(v) }),
      })),
      h(Field, { key: 'ae', label: 'Abono y saldo' }, h(Toggle, {
        checked: totals.advanceEnabled,
        label: totals.advanceEnabled ? 'Se desglosa' : 'No se desglosa',
        onChange: (v) => patch({ advanceEnabled: v }),
      })),
      totals.advanceEnabled ? h(Field, { key: 'ap', label: 'Abono %' }, h(NumField, {
        value: doc.advancePct == null ? rules.advancePct : doc.advancePct, decimals: 2,
        onChange: (v) => patch({ advancePct: v === '' ? null : num(v) }),
      })) : null,
    ]) : null,
  ]);
}

// ── Notas y condiciones ─────────────────────────────────────────────────
function NotesPanel(props) {
  const { doc, issuer, patch } = props;
  return h('section', { className: 'cz-card' }, [
    h('div', { key: 'h', className: 'cz-card-hd' }, [
      h('h3', { key: 't' }, 'Notas y condiciones'),
      h('span', { key: 'n', className: 'cz-card-note' }, 'Salen al pie de la propuesta, una por línea.'),
    ]),
    h(TextList, {
      key: 'l', value: doc.notes, placeholder: 'Cotización válida por 15 días hábiles.',
      onChange: (v) => patch({ notes: v }),
    }),
    h(Field, {
      key: 'p', label: 'Datos de pago / transferencia', wide: true,
      help: issuer.paymentInfo && !doc.paymentInfo ? 'Vacío = se usan los datos del emisor configurados en Ajustes.' : '',
    }, h(AutoArea, {
      minRows: 3, value: doc.paymentInfo, placeholder: issuer.paymentInfo || 'Banco, tipo de cuenta, número, correo de aviso…',
      onChange: (e) => patch({ paymentInfo: e.target.value }),
    })),
  ]);
}

// ── Bitácora de seguimiento ─────────────────────────────────────────────
function EventsPanel(props) {
  const { doc, open, onToggle } = props;
  const events = arr(doc.events).slice().reverse();
  return h('section', { className: 'cz-card cz-card-events' }, [
    h('div', { key: 'h', className: 'cz-card-hd', onClick: onToggle, style: { cursor: 'pointer' } }, [
      h('h3', { key: 't' }, 'Historial'),
      h('span', { key: 'c', className: 'cz-card-note' }, events.length + ' evento(s)'),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h('span', { key: 'a', className: 'cz-dim' }, open ? '▴' : '▾'),
    ]),
    open ? h('ul', { key: 'l', className: 'cz-events' }, events.length
      ? events.map((e, i) => h('li', { key: i, className: 'cz-event' }, [
        h('span', { key: 'd', className: 'cz-event-at cz-mono' }, e.at ? new Date(e.at).toLocaleString() : ''),
        h('span', { key: 't', className: 'cz-event-txt' }, e.detail || e.type),
        e.by ? h('span', { key: 'b', className: 'cz-event-by' }, e.by) : null,
      ]))
      : [h('li', { key: 'e', className: 'cz-dim' }, 'Sin eventos todavía.')]) : null,
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/45-templates.js
// ══════════════════════════════════════════════════════════════════════
/* ══ PLANTILLAS, REVISIONES Y CREACIÓN ════════════════════════════════════
 *
 * Tres formas de no empezar de cero, que son las tres que aparecen en el
 * trabajo real:
 *
 *   Cotización tipo   Una propuesta predeterminada que se reutiliza tal cual.
 *                     Se puede marcar UNA como predeterminada: entonces
 *                     "Nueva cotización" la usa sin preguntar nada.
 *   Duplicar          Partir de una cotización ya hecha —normalmente para
 *                     otro cliente— y cambiarle lo que toque.
 *   Revisar           Lo que pasa cuando el cliente pide cambios sobre una
 *                     cotización YA ENVIADA: no se reescribe la que salió
 *                     (fuera hay una copia con ese número y esos precios),
 *                     se emite una revisión con el mismo número y sufijo
 *                     -R2, enlazada con la anterior, y la anterior queda
 *                     marcada como sustituida.
 */

// ── Plantilla predeterminada ────────────────────────────────────────────
const defaultTemplate = () => templatesOf().find((t) => t.isDefault) || null;

/** Marca (o desmarca) la plantilla predeterminada. Solo puede haber una. */
function actSetDefaultTemplate(templateId) {
  const id = s(templateId);
  const t = id ? docById(id) : null;
  if (id && (!t || t.kind !== KIND_TEMPLATE)) return null;
  for (const d of templatesOf()) {
    const debe = d.id === id;
    if (d.isDefault !== debe) commitDoc(d.id, (x) => { x.isDefault = debe; return x; });
  }
  return t;
}

// ── Revisiones ──────────────────────────────────────────────────────────
/** El número de una revisión: el del original con sufijo -R2, -R3… */
function numeroRevision(base, revision) {
  const raw = s(base).replace(/-R\d+$/i, '');
  return raw ? raw + '-R' + Math.max(2, Math.round(num(revision, 2))) : '';
}

/**
 * Emite una revisión de una cotización. La original NO se toca más allá de
 * dejarla apuntando a su relevo: lo que se envió al cliente tiene que seguir
 * consultable tal como salió.
 */
function actNewRevision(id, opts) {
  const o = isObj(opts) ? opts : {};
  const src = docById(s(id));
  if (!src || src.kind !== KIND_QUOTE) return null;

  // La cadena de revisiones se cuenta desde el original de la serie.
  const raizId = s(src.revisionOf) || src.id;
  const raiz = docById(raizId) || src;
  const hechas = quotesOf().filter((q) => s(q.revisionOf) === raizId).length;
  const revision = Math.max(2, hechas + 2);

  const copy = cloneDoc(src, { kind: KIND_QUOTE, name: s(o.name) || src.name, by: meLabel() });
  copy.number = numeroRevision(raiz.number, revision) || src.number;
  copy.numberSeq = raiz.numberSeq;
  copy.revision = revision;
  copy.revisionOf = raizId;
  copy.duplicateOf = '';
  copy.client = normalizeClient(src.client);       // una revisión es del mismo cliente
  logEvent(copy, 'revision', 'Revisión ' + revision + ' de ' + (raiz.number || raiz.name));

  const created = createDoc(copy);
  commitDoc(src.id, (d) => {
    d.supersededBy = created.id;
    return logEvent(d, 'superseded', 'Sustituida por la revisión ' + revision + ' (' + created.number + ')');
  });
  setModel({ openId: created.id, tab: 'quotes' });
  shell.notify({ level: 'success', text: 'Revisión ' + revision + ' creada: ' + created.number });
  return created;
}

/** La serie completa de una cotización, de la original a la última revisión. */
function serieDe(doc) {
  if (!doc) return [];
  const raizId = s(doc.revisionOf) || doc.id;
  const raiz = docById(raizId);
  const revs = quotesOf().filter((q) => s(q.revisionOf) === raizId);
  return (raiz ? [raiz] : []).concat(revs.sort((a, b) => a.revision - b.revision));
}

// ── Diálogo de creación ─────────────────────────────────────────────────
/**
 * "Nueva cotización" con su punto de partida. Si hay una plantilla
 * predeterminada, el diálogo la trae elegida: el camino de un clic sigue
 * siendo un clic, pero se puede cambiar antes de crear.
 */
function NewQuoteModal(props) {
  const { m, onClose } = props;
  const plantillas = templatesOf();
  const recientes = quotesOf().slice().sort((a, b) => s(b.date).localeCompare(s(a.date))).slice(0, 8);
  const porDefecto = defaultTemplate();
  const [origen, setOrigen] = useState(() => (porDefecto ? 'template:' + porDefecto.id : 'blank'));
  const [nombre, setNombre] = useState('');
  const rules = normalizeRules(m.def.rules);
  const cur = currencyOf(null, rules);

  const crear = () => {
    const [tipo, id] = origen.split(':');
    if (tipo === 'blank') actNewQuote({ name: nombre });
    else actNewQuote({ templateId: id, name: nombre, clearClient: tipo === 'quote' });
    onClose();
  };

  const opcion = (valor, titulo, detalle) => h('button', {
    key: valor, type: 'button', className: cx('cz-pickrow', origen === valor && 'on'),
    onClick: () => setOrigen(valor),
  }, [
    h('span', { key: 'r', className: cx('cz-radio', origen === valor && 'on') }),
    h('div', { key: 'm', className: 'cz-pickrow-main' }, [
      h('div', { key: 't', className: 'cz-pickrow-name' }, titulo),
      detalle ? h('div', { key: 'd', className: 'cz-pickrow-desc' }, detalle) : null,
    ]),
  ]);

  return h(Modal, {
    open: true, title: 'Nueva cotización', onClose,
    footer: [
      h(Btn, { key: 'c', onClick: onClose }, 'Cancelar'),
      h(Btn, { key: 'k', variant: 'primary', onClick: crear }, 'Crear'),
    ],
  }, [
    h(Field, { key: 'n', label: 'Nombre', wide: true },
      h(Input, { value: nombre, autoFocus: true, placeholder: 'Propuesta …', onChange: (e) => setNombre(e.target.value) })),
    h('div', { key: 'l', className: 'cz-picklist cz-picklist-radio' }, [
      h('div', { key: 'h1', className: 'cz-picklist-hd' }, 'Empezar'),
      opcion('blank', 'En blanco', 'Solo con las notas y las reglas del cotizador.'),
      plantillas.length ? h('div', { key: 'h2', className: 'cz-picklist-hd' }, 'Desde una cotización tipo') : null,
      ...plantillas.map((t) => opcion('template:' + t.id, t.name + (t.isDefault ? ' ⭐' : ''),
        t.lines.length + ' línea(s) · ' + money(computeTotals(t, rules).total, cur))),
      recientes.length ? h('div', { key: 'h3', className: 'cz-picklist-hd' }, 'Replicando una cotización reciente') : null,
      ...recientes.map((q) => opcion('quote:' + q.id, q.name,
        [q.number, q.client.name, money(computeTotals(q, rules).total, cur)].filter(Boolean).join(' · '))),
    ]),
    h('div', { key: 'f', className: 'cz-inspector-help' },
      'Replicar una cotización copia sus líneas y su maqueta, pero no su cliente ni su número: la copia nace en borrador con correlativo propio.'),
  ]);
}

/** Aviso y accesos de la serie de revisiones, en la cabecera del editor. */
function RevisionBar(props) {
  const { doc } = props;
  const serie = serieDe(doc);
  if (serie.length < 2 && !s(doc.supersededBy) && !s(doc.revisionOf)) return null;
  const sustituta = s(doc.supersededBy) ? docById(doc.supersededBy) : null;

  return h('div', { className: cx('cz-revbar', sustituta && 'old') }, [
    sustituta
      ? h('span', { key: 'w' }, 'Esta cotización quedó sustituida por su revisión ' + (sustituta.number || sustituta.name) + '.')
      : h('span', { key: 'w' }, doc.revision ? 'Revisión ' + doc.revision + ' de ' + (serie[0] ? serie[0].number : '') : 'Cotización original de la serie.'),
    h('div', { key: 'sp', className: 'cz-spacer' }),
    ...serie.map((q) => h(Btn, {
      key: q.id, size: 'sm', active: q.id === doc.id,
      title: q.name + ' · ' + fechaCorta(q.date),
      onClick: () => actOpen(q.id),
    }, q.revision ? 'R' + q.revision : 'Original')),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/50-settings.js
// ══════════════════════════════════════════════════════════════════════
/* ══ AJUSTES DEL COTIZADOR ════════════════════════════════════════════════
 *
 * Dos bloques que se guardan en el item `definition` de la instancia:
 *
 *   Emisor  Quién cotiza: razón social, identificación fiscal, contacto,
 *           logo y datos de pago. Es la cabecera y el pie de toda propuesta,
 *           así que se escribe una vez y no en cada cotización.
 *   Reglas  Cómo se cotiza: moneda, si los precios se escriben netos o con
 *           impuesto incluido, el impuesto, la vigencia por defecto, el
 *           reparto abono/saldo, el formato del correlativo y las notas que
 *           arrastra toda cotización nueva.
 *
 * Nada de esto es retroactivo salvo donde el documento no fijó lo suyo: una
 * cotización guarda su propia moneda e impuesto al crearse, de modo que subir
 * el IVA hoy no reescribe lo que se cotizó el año pasado.
 */

function SettingsTab(props) {
  const m = props.m;
  const issuer = normalizeIssuer(m.def.issuer);
  const rules = normalizeRules(m.def.rules);
  const ejemplo = nextNumber(m.docs, rules).number;
  const cur = currencyOf(null, rules);

  return h('div', { className: 'cz-tab cz-settings' }, [
    // ── Emisor ───────────────────────────────────────────────────────
    h('section', { key: 'em', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Emisor'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Encabeza y firma todas las cotizaciones.'),
        h('span', { key: 'sp', className: 'cz-recbar-sp' }),
        h(BrandImportBtn, { key: 'b' }),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'n', label: 'Razón social' },
          h(Input, { value: issuer.name, placeholder: 'METAKUT SPA', onChange: (e) => actPatchIssuer({ name: e.target.value }) })),
        h(Field, { key: 'r', label: 'RUT / ID fiscal' },
          h(Input, { mono: true, value: issuer.taxId, placeholder: '77.718.188-2', onChange: (e) => actPatchIssuer({ taxId: e.target.value }) })),
        h(Field, { key: 'e', label: 'Correo' },
          h(Input, { type: 'email', value: issuer.email, placeholder: 'info@empresa.cl', onChange: (e) => actPatchIssuer({ email: e.target.value }) })),
        h(Field, { key: 'p', label: 'Teléfono' },
          h(Input, { value: issuer.phone, placeholder: '+56 9 …', onChange: (e) => actPatchIssuer({ phone: e.target.value }) })),
        h(Field, { key: 'w', label: 'Sitio web' },
          h(Input, { value: issuer.web, placeholder: 'kimos.dev', onChange: (e) => actPatchIssuer({ web: e.target.value }) })),
        h(Field, { key: 'd', label: 'Dirección' },
          h(Input, { value: issuer.address, placeholder: 'Calle 123, Comuna, Ciudad', onChange: (e) => actPatchIssuer({ address: e.target.value }) })),
        h(Field, { key: 'sl', label: 'Bajada', wide: true, help: 'Una línea bajo la razón social en la propuesta.' },
          h(Input, { value: issuer.tagline, placeholder: 'Soluciones de atención y gestión', onChange: (e) => actPatchIssuer({ tagline: e.target.value }) })),
        h(Field, { key: 'lg', label: 'Logo', wide: true, help: 'PNG o SVG con fondo transparente se ve mejor en el PDF.' },
          h(ImageField, { value: issuer.logoUrl, folder: 'logos', onChange: (v) => actPatchIssuer({ logoUrl: v }) })),
        h(Field, {
          key: 'pi', label: 'Datos de pago / transferencia', wide: true,
          help: 'Se copian al pie de cada cotización nueva; cada una puede cambiarlos.',
        }, h(AutoArea, {
          minRows: 4, value: issuer.paymentInfo,
          placeholder: 'METAKUT SPA\n77.718.188-2\nBanco de Chile\nCuenta Vista\n2532924267\ninfo@kimos.dev',
          onChange: (e) => actPatchIssuer({ paymentInfo: e.target.value }),
        })),
      ]),
    ]),

    // ── Reglas de cotización ─────────────────────────────────────────
    h('section', { key: 'ru', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Reglas de cotización'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Valores con los que nace cada cotización nueva.'),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'c', label: 'Moneda' }, h(Select, {
          value: rules.currency,
          onChange: (e) => {
            const c = CURRENCY_BY_CODE.get(e.target.value);
            actPatchRules({ currency: e.target.value, symbol: c ? c.symbol : '$', decimals: c ? c.decimals : 0 });
          },
          options: CURRENCIES.map((c) => ({ value: c.code, label: c.code + ' · ' + c.label })),
        })),
        h(Field, { key: 'sy', label: 'Símbolo', help: 'Ejemplo: ' + money(1234567, cur) },
          h(Input, { mono: true, value: rules.symbol, onChange: (e) => actPatchRules({ symbol: e.target.value }) })),
        h(Field, { key: 'pm', label: 'Los precios se escriben…', wide: true }, h(Select, {
          value: rules.priceMode,
          onChange: (e) => actPatchRules({ priceMode: e.target.value }),
          options: [
            { value: 'net', label: 'Netos — el impuesto se suma al final (lo habitual en Chile)' },
            { value: 'gross', label: 'Con impuesto incluido — se desglosa hacia atrás' },
          ],
        })),
        h(Field, { key: 'tl', label: 'Nombre del impuesto' },
          h(Input, { value: rules.taxLabel, placeholder: 'IVA', onChange: (e) => actPatchRules({ taxLabel: e.target.value }) })),
        h(Field, { key: 'tp', label: 'Impuesto %' },
          h(NumField, { value: rules.taxPct, decimals: 2, onChange: (v) => actPatchRules({ taxPct: num(v) }) })),
        h(Field, { key: 'vd', label: 'Vigencia por defecto' }, h('div', { className: 'cz-inline' }, [
          h(NumField, { key: 'n', value: rules.validDays, onChange: (v) => actPatchRules({ validDays: num(v) }) }),
          h(Toggle, {
            key: 't', checked: rules.validBusinessDays, label: 'días hábiles',
            onChange: (v) => actPatchRules({ validBusinessDays: v }),
          }),
        ])),
        h(Field, {
          key: 'ci', label: 'Precios del catálogo del sistema', wide: true,
          help: 'Los catálogos de Productos y ProductLab guardan el precio de venta al público. Si esta instancia guarda netos, apágalo.',
        }, h(Toggle, {
          checked: rules.catalogPricesIncludeTax,
          label: rules.catalogPricesIncludeTax ? 'Vienen con impuesto incluido (se descuenta al cotizar en netos)' : 'Ya vienen netos',
          onChange: (v) => actPatchRules({ catalogPricesIncludeTax: v }),
        })),
        h(Field, { key: 'ad', label: 'Abono y saldo' }, h('div', { className: 'cz-inline' }, [
          h(Toggle, {
            key: 't', checked: rules.advanceEnabled, label: 'desglosar',
            onChange: (v) => actPatchRules({ advanceEnabled: v }),
          }),
          rules.advanceEnabled ? h(NumField, {
            key: 'n', value: rules.advancePct, decimals: 2,
            onChange: (v) => actPatchRules({ advancePct: num(v) }),
          }) : null,
          rules.advanceEnabled ? h('span', { key: 'u', className: 'cz-unit' }, '% de abono') : null,
        ])),
      ]),
    ]),

    // ── Papel ────────────────────────────────────────────────────────
    h('section', { key: 'pa', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Papel del PDF'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Tamaño y márgenes con los que se exporta la propuesta.'),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'p', label: 'Tamaño' }, h(Select, {
          value: rules.paper, onChange: (e) => actPatchRules({ paper: e.target.value }),
          options: PAPER_SIZES.map(([k, label]) => ({ value: k, label })),
        })),
        h(Field, { key: 'm', label: 'Margen', help: rules.pageMargin + ' mm por lado' }, h('input', {
          type: 'range', min: 5, max: 40, value: rules.pageMargin, className: 'cz-range',
          onChange: (e) => actPatchRules({ pageMargin: num(e.target.value) }),
        })),
      ]),
    ]),

    // ── Correlativo ──────────────────────────────────────────────────
    h('section', { key: 'nu', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Numeración'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'La siguiente cotización será ' + (ejemplo || '—')),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'p', label: 'Prefijo' },
          h(Input, { mono: true, value: rules.numberPrefix, placeholder: 'COT', onChange: (e) => actPatchRules({ numberPrefix: e.target.value }) })),
        h(Field, { key: 'd', label: 'Dígitos' },
          h(NumField, { value: rules.numberPad, onChange: (v) => actPatchRules({ numberPad: num(v) }) })),
        h(Field, { key: 'y', label: 'Incluir el año', wide: true },
          h(Toggle, {
            checked: rules.numberIncludeYear,
            label: rules.numberIncludeYear ? 'Sí: el correlativo se reinicia cada año' : 'No: correlativo continuo',
            onChange: (v) => actPatchRules({ numberIncludeYear: v }),
          })),
      ]),
    ]),

    // ── Notas por defecto ────────────────────────────────────────────
    h('section', { key: 'no', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Notas por defecto'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Las arrastra cada cotización nueva; después se editan una a una.'),
      ]),
      h(TextList, {
        key: 'l', value: rules.defaultNotes,
        placeholder: 'Formas de pago: abono 60% contra orden de compra, saldo 40% al término.',
        onChange: (v) => actPatchRules({ defaultNotes: v }),
      }),
    ]),

    // ── Dónde vive esto ──────────────────────────────────────────────
    h('div', { key: 'ft', className: 'cz-settings-ft' },
      'Los ajustes viven en esta instancia del cotizador. Un equipo puede tener varios '
      + '(por marca o por unidad de negocio) y cada uno lleva su emisor, su correlativo y sus reglas.'),
  ]);
}

/**
 * «Traer de la marca del sistema»: rellena el emisor con la marca del tenant
 * en vez de reescribir aquí razón social, RUT y logo que ya están definidos
 * una vez para todo KIMOS (APP-SPEC §7.f).
 *
 * Los colores NO se traen: el host ya inyecta los de la marca como tokens del
 * tema, y esta app no cablea ninguno (APP-SPEC §9), así que se re-marca sola.
 */
function BrandImportBtn() {
  const [ocupado, setOcupado] = useState(false);
  const motivo = marcaNoDisponible();
  if (motivo) return h('span', { className: 'cz-card-note', title: motivo }, 'sin marca del sistema');
  return h(Btn, {
    size: 'sm', disabled: ocupado,
    title: 'Rellena estos campos con la marca definida para todo KIMOS. Después puedes ajustarlos solo para este cotizador.',
    onClick: () => {
      setOcupado(true);
      Promise.resolve().then(actImportBrand).then(() => setOcupado(false), () => setOcupado(false));
    },
  }, ocupado ? 'Trayendo…' : '🏷 Traer de la marca');
}

// ══════════════════════════════════════════════════════════════════════
// src/60-catalog-engine.js
// ══════════════════════════════════════════════════════════════════════
/* ══ MOTOR DEL CATÁLOGO ═══════════════════════════════════════════════════
 *
 * Traduce los catálogos de OTRAS apps a una forma común que se pueda cotizar:
 *
 *   products    Catálogo de tienda: precio, SKU, imágenes, opciones y
 *               variantes. El recargo de cada opción sale de las variantes
 *               (precio ancla + delta por valor).
 *   productlab  Productos configurables: pasos con valores, dependencias
 *               entre pasos y precio calculado desde los componentes
 *               (costo → margen → impuesto → redondeo).
 *
 * Con ProductLab hay dos caminos, y se prefiere el primero:
 *   1. La instancia PUBLICA su catálogo resuelto en `definition.public.data`
 *      (contrato v2: precio base + delta por valor). Es lo que ProductLab
 *      considera verdad y no obliga a recalcular nada.
 *   2. Si no publica, se replica su motor de precios sobre los componentes
 *      crudos. Es la misma cadena que usa `apps/totem-productos`, de donde
 *      viene esta implementación; mantenerlas alineadas es la razón de que
 *      los nombres coincidan.
 *
 * Todo aquí es puro: ni red ni estado. Lo que necesita la cotización es el
 * precio resultante de UNA combinación concreta de pasos y valores, y eso lo
 * da `precioSeleccion()`.
 */

const norm = canon;

/** Texto de la tienda (HTML) → texto plano acotado: la propuesta no pinta HTML. */
function textoPlano(html, max) {
  const t = s(html)
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    // El hueco que deja una etiqueta cerrada justo antes de un signo de
    // puntuación ("32\" ."): en una propuesta al cliente se nota.
    .replace(/ +([,.;:!?%)\]])/g, '$1')
    .replace(/\n{3,}/g, '\n\n').trim();
  if (max && t.length > max) return t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

// ── Reglas de precio de ProductLab ──────────────────────────────────────
function plRules(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    currency: s(r.currency || 'CLP'),
    currencySymbol: s(r.currencySymbol || '$'),
    currencyDecimals: clamp(Math.round(num(r.currencyDecimals)), 0, 4),
    locale: s(r.locale || 'es-CL'),
    fx: isObj(r.fx) ? r.fx : {},
    // Se usa `num(valor, defecto)` y no `|| defecto`: un margen del 0 % o un
    // impuesto del 0 % son valores legítimos, y ProductLab los respeta.
    salesTaxPct: num(r.salesTaxPct, num(r.ivaPct, 19)),
    marginBasis: r.marginBasis === 'sale' ? 'sale' : 'cost',
    marginDefaultPct: num(r.marginDefaultPct, 25),
    marginByType: isObj(r.marginByType) ? r.marginByType : {},
    // Redondeo del delta: cero no tiene sentido (se dividiría por él).
    deltaRoundTo: num(r.deltaRoundTo, 1) || 1,
    leadTimeDays: num(r.leadTimeDays),
  };
}

/**
 * Motor de precios de ProductLab: de componente a precio de venta bruto.
 * Cadena: costo (en su moneda) → tipo de cambio → quitar impuesto si el costo
 * lo trae → impuesto propio del componente → margen (sobre costo o sobre
 * venta) → impuesto de venta.
 */
function plEngine(defItem, comps) {
  const rules = plRules(defItem && defItem.rules);
  const byId = new Map(arr(comps).map((c) => [c.id, c]));
  const iva = rules.salesTaxPct / 100;

  const grossComp = (c) => {
    if (!c) return null;
    const fx = c.currency && c.currency !== rules.currency ? (num(rules.fx[c.currency]) || 1) : 1;
    const costBase = num(c.cost) * fx;
    const net = (c.costConIva ? costBase / (1 + iva) : costBase) * (1 + num(c.taxPct) / 100);
    const mt = rules.marginByType[c.type];
    const m = (mt == null || mt === '' ? rules.marginDefaultPct : num(mt, rules.marginDefaultPct)) / 100;
    const priced = rules.marginBasis === 'sale' ? (m < 1 ? net / (1 - m) : net) : net * (1 + m);
    return priced * (1 + iva);
  };
  const disponible = (c, qty) => !!c && c.active !== false && (c.stock == null || num(c.stock) >= (qty || 1));

  /** Pool efectivo del valor: sus componentes más las alternativas, por tipo. */
  const poolPorTipo = (v) => {
    const solo = new Set(arr(v.soloExacto));
    const tipos = new Map();
    arr(v.componentIds).forEach((cid) => {
      const base = byId.get(cid);
      if (!base) return;
      const alts = [base];
      if (!solo.has(cid)) arr(base.altIds).forEach((aid) => { const a = byId.get(aid); if (a) alts.push(a); });
      const lista = tipos.get(base.type) || [];
      alts.forEach((c) => { if (lista.indexOf(c) === -1) lista.push(c); });
      tipos.set(base.type, lista);
    });
    return tipos;
  };

  /** Precio bruto del valor, o null si algún tipo se quedó sin alternativa. */
  const valueGross = (v) => {
    const qty = num(v.qty) || 1;
    if (!arr(v.componentIds).length) return { gross: num(v.priceDelta), comp: null };
    let suma = 0;
    let elegido = null;
    for (const lista of poolPorTipo(v).values()) {
      let mejor = null;
      for (const c of lista) {
        if (!disponible(c, qty)) continue;
        const g = grossComp(c);
        if (g != null && (mejor == null || g < mejor.g)) mejor = { c, g };
      }
      if (!mejor) return null;             // agotado: el valor no se ofrece
      suma += mejor.g * qty;
      if (!elegido) elegido = mejor.c;
    }
    return { gross: suma + num(v.priceDelta), comp: elegido };
  };

  const roundDelta = (n) => Math.round(n / rules.deltaRoundTo) * rules.deltaRoundTo;
  return { rules, byId, grossComp, disponible, valueGross, roundDelta };
}

// ── Forma común ─────────────────────────────────────────────────────────
// Producto normalizado:
//   { key, source, id, instanceId, instanceName, name, sku, brand, price,
//     imageUrl, images[], description, specs[], stock, configurable,
//     groups[], presets[] }
// Grupo (paso): { id, label, nota, dependsOn:{groupId,valueIds}|null, values[] }
// Valor: { id, name, desc, imageUrl, delta, isDefault }

function normValor(v) {
  return {
    id: s(v.id),
    name: s(v.name || v.label),
    desc: s(v.desc || v.detalle),
    imageUrl: s(v.imageUrl),
    delta: num(v.delta),
    isDefault: v.isDefault === true,
  };
}

/** Desde el JSON público v2 de ProductLab (`definition.public.data.productos`). */
function fromPublicPL(pp, inst) {
  if (!pp || !s(pp.name)) return null;
  const groups = arr(pp.groups).map((g) => {
    const values = arr(g.values).filter((v) => v && v.fallback !== true).map(normValor).filter((v) => v.id && v.name);
    if (!values.length) return null;
    if (!values.some((v) => v.isDefault)) values[0].isDefault = true;
    const d = g.dependsOn;
    return {
      id: s(g.id), label: s(g.label || g.type), nota: s(g.nota),
      dependsOn: d && d.groupId && arr(d.valueIds).length ? { groupId: s(d.groupId), valueIds: arr(d.valueIds).map(s) } : null,
      values,
    };
  }).filter(Boolean);
  const specs = arr(pp.storefront && pp.storefront.specs)
    .map((x) => ({ group: s(x.group), label: s(x.label), value: s(x.value) })).filter((x) => x.label);
  return {
    key: 'pl:' + inst.id + ':' + s(pp.sku || pp.productId || pp.name),
    source: 'productlab', id: s(pp.sku || pp.productId || pp.name),
    instanceId: inst.id, instanceName: s(inst.name),
    name: s(pp.name), sku: s(pp.sku), brand: '',
    price: num(pp.basePrice),
    imageUrl: s(pp.imageUrl), images: arr(pp.images).map(s).filter(Boolean),
    description: textoPlano(pp.description, 900),
    specs, stock: null,
    configurable: groups.length > 0, groups,
    presets: arr(pp.presets).map((pr) => {
      // En el JSON público la selección viene por NOMBRES, no por ids.
      const sel = {};
      arr(pr.selection).forEach((par) => {
        const g = groups.find((x) => norm(x.label) === norm(par.group));
        if (!g) return;
        const v = g.values.find((x) => norm(x.name) === norm(par.value));
        if (v) sel[g.id] = v.id;
      });
      return { id: s(pr.id) || uid('pre'), name: s(pr.name), sel };
    }).filter((pr) => pr.name),
  };
}

/** Desde items crudos de ProductLab (kind `producto`/`equipo`) + motor. */
function fromRawPL(eq, engine, inst, storeItems) {
  if (!eq || !s(eq.name) || eq.status === 'inactive') return null;
  const groups = [];
  arr(eq.groups).forEach((g) => {
    if (!g || g.baseStep === true) return;
    const brutos = [];
    arr(g.values).forEach((v) => {
      if (!v || v.fallback === true) return;
      const vg = engine.valueGross(v);
      if (vg == null) return;                       // agotado: no se ofrece
      const comp = vg.comp;
      const qty = num(v.qty) || 1;
      const detalleAuto = comp ? (qty > 1 ? qty + '× ' : '') + s(comp.specs || comp.name) : '';
      let img = s(v.imageUrl);
      if (!img) {
        for (const cid of arr(v.componentIds)) {
          const c = engine.byId.get(cid);
          if (c && c.type === g.typeId && c.imageUrl) { img = s(c.imageUrl); break; }
        }
      }
      brutos.push({ id: s(v.id), name: s(v.label), desc: s(v.detalle) || detalleAuto, imageUrl: img, gross: vg.gross });
    });
    if (!brutos.length) return;
    // El delta de cada valor es su diferencia con el valor por defecto: así el
    // precio base del producto ya incluye la configuración por defecto.
    const def = brutos.find((v) => v.id === s(g.defaultValueId)) || brutos[0];
    const d = g.dependsOn;
    groups.push({
      id: s(g.id), label: s(g.label) || s(g.typeId), nota: s(g.nota),
      dependsOn: d && d.stepId && arr(d.valueIds).length ? { groupId: s(d.stepId), valueIds: arr(d.valueIds).map(s) } : null,
      values: brutos.map((v) => ({
        id: v.id, name: v.name, desc: v.desc, imageUrl: v.imageUrl,
        delta: engine.roundDelta(v.gross - def.gross), isDefault: v === def,
      })),
    });
  });

  // Precio base según el modo de precio del producto.
  const ref = eq.storeRef || null;
  const storeItem = ref && storeItems ? storeItems.get(s(ref.itemId)) : null;
  let price;
  if (eq.priceMode === 'fixed') price = num(eq.fixedPrice) || num(eq.price);
  else if (eq.priceMode === 'store') price = (storeItem && num(storeItem.price)) || num(eq.fixedPrice) || num(eq.price);
  else price = num(eq.price);

  const sf = isObj(eq.storefront) ? eq.storefront : {};
  const imgs = [];
  const push = (u) => { const x = s(u); if (x && imgs.indexOf(x) === -1) imgs.push(x); };
  push(eq.imageUrl);
  arr(eq.galleryImages).forEach(push);
  if (storeItem) (arr(storeItem.images).length ? arr(storeItem.images) : [storeItem.imageUrl]).forEach(push);

  return {
    key: 'pl:' + inst.id + ':' + s(eq.id),
    source: 'productlab', id: s(eq.id),
    instanceId: inst.id, instanceName: s(inst.name),
    name: s(eq.name), sku: s(eq.sku), brand: '',
    price: Math.round(price),
    imageUrl: imgs[0] || '', images: imgs,
    description: textoPlano(storeItem && (storeItem.description || storeItem.body), 900),
    specs: arr(sf.specs).map((x) => ({ group: s(x.group), label: s(x.label), value: s(x.value) })).filter((x) => x.label),
    stock: null,
    configurable: groups.length > 0, groups,
    presets: arr(eq.presets).map((pr) => ({
      id: s(pr.id) || uid('pre'), name: s(pr.name), sel: isObj(pr.selection) ? pr.selection : {},
    })).filter((pr) => pr.name),
  };
}

/** Pasos derivados de las opciones y variantes de un item de `products`. */
function groupsFromProducts(p) {
  const groups = [];
  const base = num(p.price);
  arr(p.options).forEach((o, oi) => {
    if (!o || !s(o.name) || !arr(o.values).length) return;
    const gid = 'opt-' + oi;
    if (o.optionType === 'addon') {
      // Un addon es sí/no con recargo fijo.
      const recargo = Math.max(0, num(o.addonPrice));
      groups.push({
        id: gid, label: s(o.name), nota: '', dependsOn: null,
        values: [{ id: gid + '-no', name: 'Sin ' + s(o.name).toLowerCase(), desc: '', imageUrl: '', delta: 0, isDefault: true }]
          .concat(arr(o.values).map((v, vi) => ({
            id: gid + '-' + vi, name: s(v.name), desc: '', imageUrl: '', delta: recargo, isDefault: false,
          }))),
      });
      return;
    }
    // Opción normal: el recargo sale de las variantes que llevan ese valor.
    const vals = arr(o.values).map((v, vi) => {
      const conValor = arr(p.variants).filter((vr) => vr && vr.options && norm(vr.options[o.name]) === norm(v.name));
      const precios = conValor.map((vr) => Number(vr.price)).filter(Number.isFinite);
      return {
        id: gid + '-' + vi, name: s(v.name), desc: '', imageUrl: '',
        delta: precios.length ? Math.round(Math.min.apply(null, precios) - base) : 0,
        isDefault: false,
      };
    }).filter((v) => v.name);
    if (!vals.length) return;
    // El valor más barato es el que fija el precio base: el resto son recargos.
    let mi = 0;
    vals.forEach((v, ix) => { if (v.delta < vals[mi].delta) mi = ix; });
    const dmin = vals[mi].delta;
    vals.forEach((v) => { v.delta -= dmin; });
    vals[mi].isDefault = true;
    groups.push({ id: gid, label: s(o.name), nota: '', dependsOn: null, values: vals });
  });
  return groups;
}

function fromProductsItem(p, inst) {
  if (!p || p.kind === 'definition' || !s(p.name)) return null;
  if (p.status && p.status !== 'active') return null;
  const imgs = [];
  arr(p.images).forEach((u) => { const x = s(u); if (x && imgs.indexOf(x) === -1) imgs.push(x); });
  if (s(p.imageUrl) && imgs.indexOf(s(p.imageUrl)) === -1) imgs.unshift(s(p.imageUrl));
  const groups = groupsFromProducts(p);
  return {
    key: 'pr:' + inst.id + ':' + s(p.id),
    source: 'products', id: s(p.id),
    instanceId: inst.id, instanceName: s(inst.name),
    name: s(p.name), sku: s(p.sku), brand: s(p.brand),
    price: num(p.price),
    imageUrl: imgs[0] || '', images: imgs,
    description: textoPlano(p.description, 900),
    specs: [], stock: typeof p.stock === 'number' ? p.stock : null,
    configurable: groups.length > 0, groups, presets: [],
  };
}

// ── Selección y precio de una combinación ───────────────────────────────
const defaultVal = (g) => arr(g.values).find((v) => v.isDefault) || arr(g.values)[0] || null;

/** Completa la selección con los valores por defecto y descarta lo inválido. */
function seleccionResuelta(prod, sel) {
  const out = {};
  const m = isObj(sel) ? sel : {};
  arr(prod && prod.groups).forEach((g) => {
    const ok = arr(g.values).some((v) => v.id === m[g.id]);
    const d = defaultVal(g);
    out[g.id] = ok ? m[g.id] : (d ? d.id : null);
  });
  return out;
}

/** Un paso dependiente solo cuenta si el paso del que depende está en su valor. */
function grupoVisible(prod, g, selMap) {
  const d = g.dependsOn;
  if (!d || !d.groupId || !arr(d.valueIds).length) return true;
  const target = arr(prod.groups).find((x) => x.id === d.groupId);
  if (!target) return true;
  return d.valueIds.indexOf(selMap[target.id]) !== -1;
}

/** Precio resultante de la combinación: base más el delta de cada paso visible. */
function precioSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  let total = num(prod && prod.price);
  arr(prod && prod.groups).forEach((g) => {
    if (!grupoVisible(prod, g, m)) return;
    const v = arr(g.values).find((x) => x.id === m[g.id]);
    if (v) total += num(v.delta);
  });
  return total;
}

/** La imagen que corresponde a la combinación (la del primer paso que la fija). */
function fotoSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  for (const g of arr(prod && prod.groups)) {
    if (!grupoVisible(prod, g, m)) continue;
    const v = arr(g.values).find((x) => x.id === m[g.id]);
    if (v && v.imageUrl) return v.imageUrl;
  }
  return s(prod && prod.imageUrl) || arr(prod && prod.images)[0] || '';
}

/** La combinación elegida, legible: [{ stepId, stepName, valueId, valueName }]. */
function detalleSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  const out = [];
  arr(prod && prod.groups).forEach((g) => {
    if (!grupoVisible(prod, g, m)) return;
    const v = arr(g.values).find((x) => x.id === m[g.id]);
    if (!v) return;
    out.push({ stepId: g.id, stepName: g.label, valueId: v.id, valueName: v.name, delta: num(v.delta) });
  });
  return out;
}

/**
 * Descripción de la línea cotizada: la del producto más la combinación
 * elegida, para que el cliente lea en la propuesta exactamente qué se le
 * está ofreciendo y no solo el nombre del producto.
 */
function descripcionSeleccion(prod, sel, incluirDescripcion) {
  const partes = [];
  if (incluirDescripcion !== false && s(prod.description)) partes.push(s(prod.description));
  const det = detalleSeleccion(prod, sel);
  if (det.length) partes.push(det.map((d) => d.stepName + ': ' + d.valueName).join(' · '));
  return partes.join('\n');
}

// ══════════════════════════════════════════════════════════════════════
// src/62-catalog-data.js
// ══════════════════════════════════════════════════════════════════════
/* ══ LECTURA DE LOS CATÁLOGOS DE OTRAS APPS ═══════════════════════════════
 *
 * `shell.data` (APP-SPEC §7.c) permite leer los datos de otras apps
 * declarando el permiso en el manifest. La app pide tres:
 *
 *   data.read:products     el catálogo de la tienda
 *   data.read:productlab   los productos configurables
 *   data.read:customers    el directorio de clientes
 *
 * El RBAC del usuario es siempre el techo: solo se ven instancias de equipos
 * a los que ya tiene acceso, y el permiso de la app nunca lo supera.
 *
 * Nada de esto se persiste en la cotización: es un espejo de lectura. Lo que
 * SÍ se guarda en la línea es el precio, la descripción y la combinación
 * elegida en el momento de cotizar, porque una cotización es una oferta con
 * fecha: si mañana sube el precio del catálogo, la cotización enviada tiene
 * que seguir diciendo lo que decía.
 */

/** Por qué no se puede leer el catálogo, o '' si sí se puede. */
function catalogoNoDisponible() {
  if (!shell.data || typeof shell.data.listInstances !== 'function') {
    return 'Este host no expone shell.data, así que no es posible leer los catálogos de otras apps.';
  }
  return '';
}

const setExt = (patch) => setModel({ ext: Object.assign({}, model.ext, patch) });

/**
 * Carga los catálogos de Productos y ProductLab y los normaliza a la forma
 * común. Una instancia sin acceso no tumba al resto: se salta y se sigue.
 */
async function loadExternalCatalog(force) {
  const motivo = catalogoNoDisponible();
  if (motivo) { setExt({ loading: false, loaded: true, error: motivo }); return []; }
  if (model.ext.loading) return model.ext.products;
  if (model.ext.loaded && !force) return model.ext.products;

  setExt({ loading: true, error: null });
  const productos = [];
  const sources = [];
  try {
    const pInsts = arr(await shell.data.listInstances('products').catch(() => []));
    const plInsts = arr(await shell.data.listInstances('productlab').catch(() => []));

    // Los items de `products` se cargan primero porque ProductLab los usa
    // para su modo de precio "store" y para heredar fotos y descripción.
    const storeItems = new Map();
    const porInstancia = [];
    for (const inst of pInsts) {
      try {
        const items = arr(await shell.data.listItems(inst.id));
        const reales = items.filter((p) => p && p.kind !== 'definition' && s(p.name));
        reales.forEach((p) => storeItems.set(s(p.id), p));
        porInstancia.push({ inst, items: reales });
      } catch (e) { /* instancia sin acceso: no tumbar el resto */ }
    }

    // ProductLab: primero el catálogo publicado; si no publica, se replica su
    // motor de precios sobre los componentes crudos.
    const vinculados = new Set();
    for (const inst of plInsts) {
      try {
        const items = arr(await shell.data.listItems(inst.id));
        const def = items.find((i) => i && (i.id === 'definition' || i.kind === 'definition'));
        const comps = items.filter((i) => i && i.kind === 'component');
        const prods = items.filter((i) => i && (i.kind === 'producto' || i.kind === 'equipo'));
        prods.forEach((eq) => { if (eq.storeRef && eq.storeRef.itemId) vinculados.add(s(eq.storeRef.itemId)); });

        const pub = def && def.public && def.public.enabled && def.public.data
          && Array.isArray(def.public.data.productos) ? def.public.data : null;
        let n = 0;
        if (pub) {
          pub.productos.forEach((pp) => { const x = fromPublicPL(pp, inst); if (x) { productos.push(x); n++; } });
        } else {
          const engine = plEngine(def, comps);
          prods.forEach((eq) => { const x = fromRawPL(eq, engine, inst, storeItems); if (x) { productos.push(x); n++; } });
        }
        sources.push({ app: 'productlab', id: inst.id, name: s(inst.name) || inst.id, count: n, published: !!pub });
      } catch (e) { /* instancia sin acceso */ }
    }

    // Productos: se omiten los que ya entran como configurables desde
    // ProductLab, para no ofrecer dos veces lo mismo.
    for (const par of porInstancia) {
      let n = 0;
      par.items.forEach((p) => {
        if (vinculados.has(s(p.id))) return;
        const x = fromProductsItem(p, par.inst);
        if (x) { productos.push(x); n++; }
      });
      sources.push({ app: 'products', id: par.inst.id, name: s(par.inst.name) || par.inst.id, count: n });
    }

    setExt({
      loading: false, loaded: true, error: null, at: stamp(),
      products: productos, sources,
    });
  } catch (e) {
    setExt({ loading: false, loaded: true, error: (e && e.message) || 'No se pudo leer el catálogo.' });
  }
  return model.ext.products;
}

/** Directorio de clientes de la app Clientes, para no retipear la ficha. */
async function loadCustomers(force) {
  if (catalogoNoDisponible()) return [];
  if (model.ext.customers.length && !force) return model.ext.customers;
  const out = [];
  const sources = [];
  try {
    const insts = arr(await shell.data.listInstances('customers').catch(() => []));
    for (const inst of insts) {
      try {
        const items = arr(await shell.data.listItems(inst.id));
        let n = 0;
        for (const c of items) {
          if (!c || c.kind === 'definition') continue;
          const name = s(c.name || c.fullName || c.company || c.email);
          if (!name) continue;
          out.push({
            id: s(c.id), instanceId: inst.id, instanceName: s(inst.name),
            name,
            taxId: s(c.taxId || c.rut || c.documentNumber),
            email: s(c.email),
            phone: s(c.phone),
            // La app Clientes guarda ciudad y país por separado; para la
            // cotización se juntan en una sola dirección legible.
            address: [s(c.address || c.street), s(c.city), s(c.country)].filter(Boolean).join(', '),
            contact: s(c.contact || c.contactName),
          });
          n++;
        }
        sources.push({ app: 'customers', id: inst.id, name: s(inst.name) || inst.id, count: n });
      } catch (e) { /* instancia sin acceso */ }
    }
  } catch (e) { /* sin app de clientes instalada: la ficha se escribe a mano */ }
  setExt({ customers: out, customerSources: sources });
  return out;
}

const productByKey = (key) => model.ext.products.find((p) => p.key === s(key)) || null;

// ── Acciones sobre el catálogo externo ──────────────────────────────────
/**
 * Inserta un producto del catálogo como línea de la cotización.
 *
 * `selection` es la combinación de pasos elegida (`{ stepId: valueId }`); si
 * viene vacía o incompleta se completa con los valores por defecto. El precio
 * se resuelve AHORA y se congela en la línea, junto con la combinación, para
 * que la cotización siga diciendo lo mismo aunque el catálogo cambie.
 */
function actAddProductToQuote(quoteId, productKey, opts) {
  const o = isObj(opts) ? opts : {};
  const doc = docById(s(quoteId));
  const prod = productByKey(productKey);
  if (!doc || !prod) return null;

  const sel = seleccionResuelta(prod, o.selection);
  const bruto = precioSeleccion(prod, sel);
  const rules = rulesOf();
  const unitPrice = o.unitPrice != null && o.unitPrice !== ''
    ? num(o.unitPrice)
    : roundTo(precioParaCotizar(bruto, rules, doc.taxPct), currencyOf(doc, rules).decimals);

  const line = normalizeLine({
    title: prod.name,
    description: o.description != null ? s(o.description) : descripcionSeleccion(prod, sel, o.includeDescription),
    qty: o.qty == null ? 1 : Math.max(0, num(o.qty)),
    unitPrice,
    sku: prod.sku,
    imageUrl: fotoSeleccion(prod, sel),
    source: {
      kind: prod.source === 'productlab' ? 'productlab' : 'product',
      instanceId: prod.instanceId,
      productId: prod.id,
      selection: detalleSeleccion(prod, sel),
      capturedAt: stamp(),
      capturedPrice: bruto,
    },
  });
  return actAddLine(quoteId, line);
}

/**
 * Vuelve a preguntarle al catálogo por el precio de una línea que salió de
 * él. No se hace solo: una cotización es una oferta con fecha, y el precio
 * solo se actualiza si la persona lo pide.
 */
function actRefreshLinePrice(quoteId, lineId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const line = arr(doc.lines).find((l) => l.id === s(lineId));
  if (!line || line.source.kind === 'manual') return null;

  if (line.source.kind === 'catalog') {
    const c = catalogById(line.source.itemId);
    if (!c) { shell.notify({ level: 'warn', text: 'El ítem ya no está en el catálogo propio.' }); return null; }
    return actUpdateLine(quoteId, lineId, {
      unitPrice: c.unitPrice,
      source: Object.assign({}, line.source, { capturedAt: stamp(), capturedPrice: c.unitPrice }),
    });
  }

  const prod = model.ext.products.find((p) => p.instanceId === line.source.instanceId && p.id === line.source.productId);
  if (!prod) { shell.notify({ level: 'warn', text: 'El producto ya no está en el catálogo; el precio se deja como estaba.' }); return null; }
  // La combinación guardada viaja por ids de paso y valor: se rehidrata.
  const sel = {};
  arr(line.source.selection).forEach((d) => { if (d.stepId) sel[d.stepId] = d.valueId; });
  const bruto = precioSeleccion(prod, sel);
  const rules = rulesOf();
  const unitPrice = roundTo(precioParaCotizar(bruto, rules, doc.taxPct), currencyOf(doc, rules).decimals);
  const antes = line.unitPrice;
  const out = actUpdateLine(quoteId, lineId, {
    unitPrice,
    source: Object.assign({}, line.source, { capturedAt: stamp(), capturedPrice: bruto }),
  });
  shell.notify({
    level: unitPrice === antes ? 'info' : 'success',
    text: unitPrice === antes ? 'El precio del catálogo no ha cambiado.' : 'Precio actualizado desde el catálogo.',
  });
  return out;
}

/** Copia la ficha de un cliente de la app Clientes a la cotización. */
function actImportClient(quoteId, customerId) {
  const c = model.ext.customers.find((x) => x.id === s(customerId));
  if (!c) return null;
  const out = commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient({
      name: c.name, taxId: c.taxId, contact: c.contact, email: c.email,
      phone: c.phone, address: c.address,
      sourceApp: 'customers', sourceInstanceId: c.instanceId, sourceItemId: c.id,
    });
    return d;
  });
  // Traerlo del directorio ya dice quién es, así que se le da su identidad
  // del sistema sin preguntar. En silencio: el usuario pidió importar un
  // cliente, no gestionar identidades. Si no se puede (host antiguo, sin
  // permiso), la cotización queda igual de utilizable.
  try { actLinkClientRecord(s(quoteId), { silent: true }); } catch (e) { /* opcional */ }
  return out;
}

// ══════════════════════════════════════════════════════════════════════
// src/64-catalog-ui.js
// ══════════════════════════════════════════════════════════════════════
/* ══ PANTALLAS DEL CATÁLOGO ═══════════════════════════════════════════════
 *
 * Dos catálogos conviven en la misma pestaña, porque desde el punto de vista
 * de quien cotiza son lo mismo —cosas que se insertan en una propuesta— pero
 * se comportan distinto:
 *
 *   Ítems y servicios propios   Se crean y se editan aquí. Es el banco de
 *                               líneas recurrentes (setup, logística,
 *                               soporte…), lo que más se repite en una
 *                               cotización de servicios.
 *   Catálogo del sistema        Solo lectura: viene de las apps Productos y
 *                               ProductLab. Los configurables se cotizan
 *                               eligiendo su combinación de pasos.
 */

// ── Pestaña Catálogo ────────────────────────────────────────────────────
function CatalogTab(props) {
  const m = props.m;
  const [fuente, setFuente] = useState('propios');
  const [editando, setEditando] = useState(null);
  const [ask, confirmNode] = useConfirm();

  useEffect(() => { if (fuente === 'sistema') void loadExternalCatalog(false); }, [fuente]);

  return h('div', { className: 'cz-tab' }, [
    h('div', { key: 'bar', className: 'cz-listbar' }, [
      h('div', { key: 'f', className: 'cz-filters' }, [
        h(Chip, { key: 'p', on: fuente === 'propios', onClick: () => setFuente('propios') },
          '📦 Ítems y servicios propios (' + m.catalog.filter((c) => !c.archived).length + ')'),
        h(Chip, { key: 's', on: fuente === 'sistema', onClick: () => setFuente('sistema') },
          '🛒 Catálogo del sistema' + (m.ext.loaded ? ' (' + m.ext.products.length + ')' : '')),
      ]),
      h(SearchBox, { key: 'q', value: m.search, onChange: actSetSearch, placeholder: 'Buscar en el catálogo…' }),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      fuente === 'propios'
        ? h(Btn, { key: 'n', variant: 'primary', onClick: () => setEditando(normalizeCatalogItem({})) }, '+ Nuevo ítem')
        : h(Btn, { key: 'r', onClick: () => void loadExternalCatalog(true), disabled: m.ext.loading },
          m.ext.loading ? 'Leyendo…' : '⟳ Recargar catálogo'),
    ]),
    fuente === 'propios'
      ? h(CatalogOwnList, { key: 'own', m, ask, onEdit: setEditando })
      : h(CatalogSystemList, { key: 'sys', m }),
    editando ? h(CatalogItemModal, {
      key: 'ed', item: editando, m,
      onClose: () => setEditando(null),
      onSave: (it) => { actUpsertCatalogItem(it); setEditando(null); },
    }) : null,
    confirmNode,
  ]);
}

function CatalogOwnList(props) {
  const { m, ask, onEdit } = props;
  const q = canon(m.search);
  const list = m.catalog
    .filter((c) => !c.archived)
    .filter((c) => !q || canon(c.name + ' ' + c.description + ' ' + c.group + ' ' + c.sku).indexOf(q) !== -1)
    .slice()
    .sort((a, b) => canon(a.group + ' ' + a.name).localeCompare(canon(b.group + ' ' + b.name)));
  const cur = currencyOf(null, normalizeRules(m.def.rules));

  if (!m.catalog.filter((c) => !c.archived).length) {
    return h(Empty, {
      icon: '📦',
      title: 'El banco de ítems está vacío',
      text: 'Guarda aquí lo que repites en cada propuesta —setup, logística, soporte, arriendos— y lo insertas en una cotización con un clic. También puedes guardar cualquier línea de una cotización con el botón 📦 de su fila.',
      action: h(Btn, { variant: 'primary', onClick: () => onEdit(normalizeCatalogItem({})) }, 'Crear el primer ítem'),
    });
  }

  return h('div', { className: cx('cz-tablewrap', m.settings.denseTables && 'dense') },
    h('table', { className: 'cz-table' }, [
      h('thead', { key: 'h' }, h('tr', null, [
        h('th', { key: 'n', className: 'cz-th' }, 'Ítem'),
        h('th', { key: 'g', className: 'cz-th' }, 'Grupo'),
        h('th', { key: 'u', className: 'cz-th cz-right' }, 'Precio'),
        h('th', { key: 'v', className: 'cz-th cz-right' }, 'Usos'),
        h('th', { key: 'a', className: 'cz-th cz-th-acts' }, ''),
      ])),
      h('tbody', { key: 'b' }, list.map((c) => h('tr', {
        key: c.id, className: 'cz-tr', onClick: () => onEdit(c),
      }, [
        h('td', { key: 'n' }, [
          h('div', { key: 't', className: 'cz-cell-title' }, c.name),
          c.description ? h('div', { key: 'd', className: 'cz-cell-sub' }, c.description.slice(0, 120)) : null,
        ]),
        h('td', { key: 'g', className: 'cz-dim' }, c.group || '—'),
        h('td', { key: 'u', className: 'cz-mono cz-right' }, [
          money(c.unitPrice, cur),
          !c.taxable ? h('div', { key: 'x', className: 'cz-cell-sub' }, 'exento') : null,
        ]),
        h('td', { key: 'v', className: 'cz-mono cz-right cz-dim' }, c.usageCount || '—'),
        h('td', { key: 'a', className: 'cz-td-acts', onClick: (e) => e.stopPropagation() }, [
          h(IconBtn, {
            key: 'd', icon: '⧉', title: 'Duplicar ítem',
            onClick: () => actUpsertCatalogItem(Object.assign({}, c, { id: uid('c'), name: c.name + ' (copia)', usageCount: 0 })),
          }),
          h(IconBtn, {
            key: 'x', icon: '🗑', title: 'Eliminar del catálogo',
            onClick: async () => {
              const ok = await ask({ title: 'Eliminar ítem', danger: true, okLabel: 'Eliminar', text: '¿Eliminar «' + c.name + '» del catálogo? Las cotizaciones que ya lo usan no cambian.' });
              if (ok) actRemoveCatalogItem(c.id);
            },
          }),
        ]),
      ]))),
    ]));
}

function CatalogSystemList(props) {
  const m = props.m;
  const ext = m.ext;
  const q = canon(m.search);
  const rules = normalizeRules(m.def.rules);
  const cur = currencyOf(null, rules);

  if (ext.loading && !ext.products.length) return h('div', { className: 'cz-loading' }, 'Leyendo los catálogos de Productos y ProductLab…');
  if (ext.error) {
    return h(Empty, {
      icon: '⚠️', title: 'No se pudo leer el catálogo', text: ext.error,
      action: h(Btn, { onClick: () => void loadExternalCatalog(true) }, 'Reintentar'),
    });
  }
  if (!ext.products.length) {
    return h(Empty, {
      icon: '🛒',
      title: 'No hay productos que cotizar',
      text: 'Esta pestaña muestra el catálogo de la app Productos y los productos configurables de ProductLab a los que tengas acceso. Si acabas de crearlos, recarga.',
      action: h(Btn, { onClick: () => void loadExternalCatalog(true) }, '⟳ Recargar'),
    });
  }

  const list = ext.products
    .filter((p) => !q || canon(p.name + ' ' + p.sku + ' ' + p.brand + ' ' + p.description).indexOf(q) !== -1)
    .slice()
    .sort((a, b) => canon(a.name).localeCompare(canon(b.name)));

  return h('div', { className: 'cz-catsys' }, [
    h('div', { key: 'src', className: 'cz-sources' }, ext.sources.map((f) => h(Chip, {
      key: f.app + f.id,
      title: f.app === 'productlab'
        ? (f.published ? 'ProductLab publica su catálogo resuelto: se usa ese precio.' : 'ProductLab no publica: se replica su motor de precios.')
        : 'Catálogo de la app Productos',
    }, (f.app === 'productlab' ? '🧪 ' : '🛒 ') + f.name + ' · ' + f.count))),
    h('div', { key: 'g', className: 'cz-cards' }, list.map((p) => h('div', { key: p.key, className: 'cz-prodcard' }, [
      p.imageUrl
        ? h('img', { key: 'i', className: 'cz-prodcard-img', src: p.imageUrl, alt: '', loading: 'lazy' })
        : h('div', { key: 'i', className: 'cz-prodcard-img cz-prodcard-noimg' }, p.source === 'productlab' ? '🧪' : '🛒'),
      h('div', { key: 'b', className: 'cz-prodcard-body' }, [
        h('div', { key: 'n', className: 'cz-prodcard-name' }, p.name),
        h('div', { key: 's', className: 'cz-prodcard-meta' }, [
          p.sku ? h('span', { key: 'k', className: 'cz-mono' }, p.sku) : null,
          p.configurable ? h('span', { key: 'c', className: 'cz-prodcard-tag' }, p.groups.length + ' paso(s)') : null,
        ]),
        h('div', { key: 'p', className: 'cz-prodcard-price cz-mono' }, [
          money(precioParaCotizar(p.price, rules), cur),
          h('span', { key: 'u', className: 'cz-prodcard-unit' },
            rules.priceMode === 'gross' ? '' : ' neto'),
        ]),
      ]),
    ]))),
    h('div', { key: 'ft', className: 'cz-catsys-ft' },
      'Solo lectura. Para cotizar un producto, ábrelo desde una cotización con «+ Del sistema»: ahí eliges su combinación y se inserta con el precio resuelto.'),
  ]);
}

// ── Editor de un ítem del banco propio ──────────────────────────────────
function CatalogItemModal(props) {
  const { item, m, onClose, onSave } = props;
  const [it, setIt] = useState(() => normalizeCatalogItem(item));
  const set = (p) => setIt(Object.assign({}, it, p));
  const cur = currencyOf(null, normalizeRules(m.def.rules));
  const grupos = Array.from(new Set(m.catalog.map((c) => c.group).filter(Boolean)));

  return h(Modal, {
    open: true, title: item.name ? 'Editar ítem del catálogo' : 'Nuevo ítem del catálogo', onClose,
    footer: [
      h(Btn, { key: 'c', onClick: onClose }, 'Cancelar'),
      h(Btn, { key: 's', variant: 'primary', disabled: !s(it.name).trim(), onClick: () => onSave(it) }, 'Guardar'),
    ],
  }, h('div', { className: 'cz-grid2' }, [
    h(Field, { key: 'n', label: 'Nombre', wide: true },
      h(Input, { value: it.name, placeholder: 'Setup inicial y configuración', autoFocus: true, onChange: (e) => set({ name: e.target.value }) })),
    h(Field, { key: 'd', label: 'Descripción', wide: true, help: 'Es lo que verá el cliente en la columna DESCRIPCIÓN.' },
      h(AutoArea, { minRows: 3, value: it.description, placeholder: 'DISEÑO, PERSONALIZACIÓN E IMPLEMENTACIÓN DE FLUJOS…', onChange: (e) => set({ description: e.target.value }) })),
    h(Field, { key: 'g', label: 'Grupo', help: grupos.length ? 'Existentes: ' + grupos.join(', ') : 'Libre: “Servicios”, “Logística”…' },
      h(Input, { value: it.group, onChange: (e) => set({ group: e.target.value }) })),
    h(Field, { key: 'k', label: 'SKU / código' },
      h(Input, { mono: true, value: it.sku, onChange: (e) => set({ sku: e.target.value }) })),
    h(Field, { key: 'p', label: 'Precio unitario' },
      h(NumField, { value: it.unitPrice, decimals: cur.decimals, locale: cur.locale, onChange: (v) => set({ unitPrice: num(v) }) })),
    h(Field, { key: 'q', label: 'Cantidad por defecto' },
      h(NumField, { value: it.qty, decimals: 2, onChange: (v) => set({ qty: num(v) }) })),
    h(Field, { key: 'u', label: 'Unidad', help: 'Opcional: “mes”, “sede”, “evento”.' },
      h(Input, { value: it.unit, onChange: (e) => set({ unit: e.target.value }) })),
    h(Field, { key: 't', label: 'Impuesto' },
      h(Toggle, { checked: it.taxable, label: it.taxable ? 'Afecto' : 'Exento', onChange: (v) => set({ taxable: v }) })),
    h(Field, { key: 'i', label: 'Imagen', wide: true },
      h(ImageField, { value: it.imageUrl, folder: 'items', onChange: (v) => set({ imageUrl: v }) })),
  ]));
}

// ── Selector de ítems propios para insertar en una cotización ───────────
function CatalogPickerModal(props) {
  const { m, quoteId, onClose } = props;
  const [q, setQ] = useState('');
  const [puestos, setPuestos] = useState([]);
  const cur = currencyOf(docById(quoteId), normalizeRules(m.def.rules));
  const needle = canon(q);
  const list = m.catalog
    .filter((c) => !c.archived)
    .filter((c) => !needle || canon(c.name + ' ' + c.description + ' ' + c.group).indexOf(needle) !== -1)
    .slice()
    .sort((a, b) => (b.usageCount - a.usageCount) || canon(a.name).localeCompare(canon(b.name)));

  const insertar = (c) => {
    const l = actAddCatalogToQuote(quoteId, c.id);
    if (l) setPuestos(puestos.concat([c.id]));
  };

  return h(Modal, {
    open: true, wide: true, title: 'Insertar del catálogo propio', onClose,
    footer: [
      h('span', { key: 'n', className: 'cz-dim' }, puestos.length ? puestos.length + ' línea(s) añadida(s)' : ''),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, { key: 'c', variant: 'primary', onClick: onClose }, 'Listo'),
    ],
  }, [
    h(SearchBox, { key: 'q', value: q, onChange: setQ, placeholder: 'Buscar ítem o servicio…' }),
    !m.catalog.filter((c) => !c.archived).length
      ? h(Empty, { key: 'e', icon: '📦', title: 'El banco de ítems está vacío', text: 'Guarda una línea de esta cotización con el botón 📦 de su fila y volverá a aparecer aquí.' })
      : h('div', { key: 'l', className: 'cz-picklist' }, list.map((c) => h('button', {
        key: c.id, type: 'button', className: 'cz-pickrow', onClick: () => insertar(c),
      }, [
        h('div', { key: 'a', className: 'cz-pickrow-main' }, [
          h('div', { key: 'n', className: 'cz-pickrow-name' }, [
            c.name,
            c.group ? h('span', { key: 'g', className: 'cz-pickrow-tag' }, c.group) : null,
          ]),
          c.description ? h('div', { key: 'd', className: 'cz-pickrow-desc' }, c.description.slice(0, 140)) : null,
        ]),
        h('div', { key: 'p', className: 'cz-pickrow-price cz-mono' }, money(c.unitPrice, cur)),
        h('span', { key: 'x', className: 'cz-pickrow-add' }, puestos.indexOf(c.id) !== -1 ? '✓' : '+'),
      ]))),
  ]);
}

// ── Selector de productos del sistema, con su configurador ──────────────
function ProductPickerModal(props) {
  const { m, quoteId, onClose } = props;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);           // producto elegido
  const [combo, setCombo] = useState({});         // combinación de pasos
  const [qty, setQty] = useState(1);
  const [incluirDesc, setIncluirDesc] = useState(true);
  const doc = docById(quoteId);
  const rules = normalizeRules(m.def.rules);
  const cur = currencyOf(doc, rules);

  useEffect(() => { void loadExternalCatalog(false); }, []);

  const needle = canon(q);
  const list = m.ext.products
    .filter((p) => !needle || canon(p.name + ' ' + p.sku + ' ' + p.brand).indexOf(needle) !== -1)
    .slice()
    .sort((a, b) => canon(a.name).localeCompare(canon(b.name)));

  const elegir = (p) => {
    setSel(p);
    setCombo(seleccionResuelta(p, {}));
    setQty(1);
  };

  const bruto = sel ? precioSeleccion(sel, combo) : 0;
  const unitario = sel ? roundTo(precioParaCotizar(bruto, rules, doc && doc.taxPct), cur.decimals) : 0;

  const insertar = () => {
    const l = actAddProductToQuote(quoteId, sel.key, { selection: combo, qty, includeDescription: incluirDesc });
    if (l) { shell.notify({ level: 'success', text: 'Añadido: ' + sel.name }); onClose(); }
  };

  const cuerpo = sel
    ? h('div', { className: 'cz-conf' }, [
      h('div', { key: 'hd', className: 'cz-conf-hd' }, [
        h(Btn, { key: 'b', size: 'sm', onClick: () => setSel(null) }, '← Otro producto'),
        h('div', { key: 'n', className: 'cz-conf-name' }, sel.name),
        h('span', { key: 's', className: 'cz-chip' }, sel.source === 'productlab' ? '🧪 ProductLab' : '🛒 Productos'),
      ]),
      h('div', { key: 'bd', className: 'cz-conf-body' }, [
        h('div', { key: 'l', className: 'cz-conf-pasos' }, [
          ...(sel.configurable
            ? sel.groups.filter((g) => grupoVisible(sel, g, combo)).map((g) => h('div', { key: g.id, className: 'cz-conf-paso' }, [
              h('div', { key: 'l', className: 'cz-conf-paso-lbl' }, [
                g.label,
                g.nota ? h('span', { key: 'n', className: 'cz-conf-paso-nota' }, g.nota) : null,
              ]),
              h('div', { key: 'v', className: 'cz-conf-valores' }, g.values.map((v) => h('button', {
                key: v.id, type: 'button',
                className: cx('cz-conf-valor', combo[g.id] === v.id && 'on'),
                title: v.desc,
                onClick: () => setCombo(seleccionResuelta(sel, Object.assign({}, combo, { [g.id]: v.id }))),
              }, [
                h('span', { key: 'n', className: 'cz-conf-valor-n' }, v.name),
                v.delta ? h('span', { key: 'd', className: 'cz-conf-valor-d cz-mono' },
                  (v.delta > 0 ? '+' : '−') + money(Math.abs(precioParaCotizar(v.delta, rules, doc && doc.taxPct)), cur)) : null,
              ]))),
            ]))
            : [h('div', { key: 'nc', className: 'cz-dim' }, 'Este producto no tiene pasos configurables: se cotiza tal cual.')]),
          sel.presets && sel.presets.length ? h('div', { key: 'pre', className: 'cz-conf-paso' }, [
            h('div', { key: 'l', className: 'cz-conf-paso-lbl' }, 'Combinaciones guardadas'),
            h('div', { key: 'v', className: 'cz-conf-valores' }, sel.presets.map((pr) => h('button', {
              key: pr.id, type: 'button', className: 'cz-conf-valor',
              onClick: () => setCombo(seleccionResuelta(sel, pr.sel)),
            }, pr.name))),
          ]) : null,
        ]),
        h('div', { key: 'r', className: 'cz-conf-side' }, [
          sel.imageUrl || fotoSeleccion(sel, combo)
            ? h('img', { key: 'i', className: 'cz-conf-img', src: fotoSeleccion(sel, combo), alt: '' })
            : null,
          h('div', { key: 'p', className: 'cz-conf-precio' }, [
            h('div', { key: 'l', className: 'cz-conf-precio-lbl' }, rules.priceMode === 'gross' ? 'Precio unitario' : 'Neto unitario'),
            h('div', { key: 'v', className: 'cz-conf-precio-v cz-mono' }, money(unitario, cur)),
            rules.priceMode !== 'gross' && rules.catalogPricesIncludeTax
              ? h('div', { key: 'g', className: 'cz-conf-precio-nota' }, 'Catálogo: ' + money(bruto, cur) + ' con impuesto')
              : null,
          ]),
          h(Field, { key: 'q', label: 'Cantidad' },
            h(NumField, { value: qty, decimals: 2, onChange: (v) => setQty(Math.max(0, num(v))) })),
          h(Toggle, {
            key: 'd', checked: incluirDesc, label: 'Incluir la descripción del producto',
            onChange: setIncluirDesc,
          }),
          h('div', { key: 't', className: 'cz-conf-total' }, [
            h('span', { key: 'l' }, 'Total de la línea '),
            h('span', { key: 'v', className: 'cz-mono cz-strong' }, money(unitario * qty, cur)),
          ]),
        ]),
      ]),
    ])
    : h('div', null, [
      h(SearchBox, { key: 'q', value: q, onChange: setQ, placeholder: 'Buscar producto por nombre o SKU…' }),
      m.ext.loading && !m.ext.products.length
        ? h('div', { key: 'l', className: 'cz-loading' }, 'Leyendo los catálogos…')
        : (m.ext.error
          ? h(Empty, { key: 'e', icon: '⚠️', title: 'No se pudo leer el catálogo', text: m.ext.error })
          : (!list.length
            ? h(Empty, { key: 'e', icon: '🛒', title: 'Sin productos', text: 'No hay productos en las apps Productos ni ProductLab a los que tengas acceso.' })
            : h('div', { key: 'l', className: 'cz-picklist' }, list.map((p) => h('button', {
              key: p.key, type: 'button', className: 'cz-pickrow', onClick: () => elegir(p),
            }, [
              p.imageUrl ? h('img', { key: 'i', className: 'cz-pickrow-img', src: p.imageUrl, alt: '', loading: 'lazy' }) : null,
              h('div', { key: 'a', className: 'cz-pickrow-main' }, [
                h('div', { key: 'n', className: 'cz-pickrow-name' }, [
                  p.name,
                  h('span', { key: 'g', className: 'cz-pickrow-tag' }, p.source === 'productlab' ? '🧪 configurable' : '🛒 catálogo'),
                ]),
                h('div', { key: 'd', className: 'cz-pickrow-desc' },
                  [p.sku, p.instanceName, p.configurable ? p.groups.length + ' paso(s)' : ''].filter(Boolean).join(' · ')),
              ]),
              h('div', { key: 'p', className: 'cz-pickrow-price cz-mono' }, money(precioParaCotizar(p.price, rules, doc && doc.taxPct), cur)),
              h('span', { key: 'x', className: 'cz-pickrow-add' }, '›'),
            ]))))),
    ]);

  return h(Modal, {
    open: true, wide: true, title: 'Cotizar del catálogo del sistema', onClose,
    footer: sel ? [
      h(Btn, { key: 'c', onClick: onClose }, 'Cancelar'),
      h(Btn, { key: 'i', variant: 'primary', onClick: insertar }, 'Añadir a la cotización'),
    ] : null,
  }, cuerpo);
}

// ── Selector de cliente desde la app Clientes ───────────────────────────
function ClientPickerModal(props) {
  const { m, quoteId, onClose } = props;
  const [q, setQ] = useState('');
  useEffect(() => { void loadCustomers(false); }, []);
  const needle = canon(q);
  const list = m.ext.customers
    .filter((c) => !needle || canon(c.name + ' ' + c.taxId + ' ' + c.email).indexOf(needle) !== -1)
    .slice(0, 200);

  return h(Modal, {
    open: true, title: 'Traer un cliente del directorio', onClose,
    footer: [h(Btn, { key: 'c', onClick: onClose }, 'Cerrar')],
  }, [
    h(SearchBox, { key: 'q', value: q, onChange: setQ, placeholder: 'Buscar cliente…' }),
    !m.ext.customers.length
      ? h(Empty, {
        key: 'e', icon: '👥', title: 'Sin clientes que traer',
        text: 'Esta ventana lee la app Clientes. Si no está instalada o no tienes acceso a sus instancias, escribe la ficha a mano en la cotización.',
      })
      : h('div', { key: 'l', className: 'cz-picklist' }, list.map((c) => h('button', {
        key: c.id, type: 'button', className: 'cz-pickrow',
        onClick: () => { actImportClient(quoteId, c.id); onClose(); },
      }, [
        h('div', { key: 'a', className: 'cz-pickrow-main' }, [
          h('div', { key: 'n', className: 'cz-pickrow-name' }, c.name),
          h('div', { key: 'd', className: 'cz-pickrow-desc' }, [c.taxId, c.email, c.phone].filter(Boolean).join(' · ') || c.instanceName),
        ]),
        h('span', { key: 'x', className: 'cz-pickrow-add' }, '+'),
      ]))),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/66-records.js
// ══════════════════════════════════════════════════════════════════════
// ── El cliente de la cotización, ligado al resto de KIMOS ───────────────
/**
 * src/66-records.js — identidad compartida del cliente (`shell.records`).
 *
 * El problema que resuelve: hasta ahora cada cotización guardaba su copia del
 * cliente ("Acme SpA", su RUT, su correo). Clientes guardaba la suya y
 * Prospección guardaría la tercera. Tres Acmes y ninguna vista completa.
 *
 * La solución NO es que la cotización deje de guardar el cliente. Es guardar
 * DOS cosas:
 *
 *   · `client.recordRef` — la referencia a la identidad de la plataforma
 *     (`kimos:record/account/…`). Es lo que permite decir «esta cotización y
 *     ese proyecto son del mismo cliente».
 *   · `client.name`, `taxId`, `email`… — la instantánea, como hasta ahora.
 *
 * La instantánea NO es redundancia: es lo que hace que una cotización enviada
 * hace ocho meses siga imprimiéndose igual aunque el registro se renombre o
 * desaparezca. Una propuesta que se envió al cliente no cambia sola
 * (mismo criterio que las revisiones en 45-templates.js).
 *
 * Todo esto es opcional en los dos sentidos: si el host no expone
 * `shell.records`, la app funciona exactamente como antes y el cliente se
 * escribe a mano. Ver APP-SPEC §7.d.
 */

const RECORD_TYPE = 'account';

/** '' si se puede usar el registro; si no, el motivo, para poder explicarlo. */
function registroNoDisponible() {
  if (!shell.records || typeof shell.records.findOrCreate !== 'function') {
    return 'Este host todavía no expone el registro de identidades, así que el cliente se guarda solo en esta cotización.';
  }
  return '';
}

/**
 * Claves con las que se reconoce a un cliente, en orden de fiabilidad.
 *
 * El RUT identifica a la empresa; el correo, a menudo, solo a la persona que
 * escribió. Se mandan las dos y la plataforma normaliza («77.718.188-2» y
 * «777181882» son la misma), pero el orden importa cuando apuntan a sitios
 * distintos.
 */
function clavesDeCliente(client) {
  const c = isObj(client) ? client : {};
  const keys = {};
  if (s(c.taxId).trim()) keys.taxId = s(c.taxId).trim();
  if (s(c.email).trim()) keys.email = s(c.email).trim();
  return keys;
}

/** Un cliente sin nombre ni claves no es vinculable: no hay a quién apuntar. */
function clienteVinculable(client) {
  const c = isObj(client) ? client : {};
  if (!s(c.name).trim()) return 'Escribe primero el nombre del cliente.';
  return '';
}

/**
 * Vincula el cliente de una cotización con la identidad del sistema.
 *
 * `findOrCreate` REUTILIZA si ya existe: eso es exactamente lo que evita el
 * segundo «Acme SpA». Devuelve `{ ref, created, warning }` o `null` si no se
 * pudo (y en ese caso ya avisó por pantalla: la cotización sigue siendo
 * válida sin vínculo).
 */
async function actLinkClientRecord(quoteId, opts) {
  const o = isObj(opts) ? opts : {};
  const doc = docById(s(quoteId));
  if (!doc) return null;

  const motivo = registroNoDisponible();
  if (motivo) {
    if (!o.silent) shell.notify({ level: 'warn', text: motivo });
    return null;
  }
  const falta = clienteVinculable(doc.client);
  if (falta) {
    if (!o.silent) shell.notify({ level: 'warn', text: falta });
    return null;
  }

  const keys = clavesDeCliente(doc.client);
  let res;
  try {
    res = await shell.records.findOrCreate(RECORD_TYPE, { keys, label: s(doc.client.name).trim() });
  } catch (e) {
    if (!o.silent) {
      shell.notify({ level: 'error', text: 'No se pudo vincular con el directorio: ' + ((e && e.message) || 'error') });
    }
    return null;
  }
  if (!isObj(res) || !s(res.ref)) return null;

  const registro = isObj(res.record) ? res.record : {};
  commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient(Object.assign({}, d.client, { recordRef: s(res.ref) }));
    return d;
  });

  // Anotar el vínculo inverso: es lo que después responde «dame todo lo de
  // Acme» desde cualquier app. Si falla, el vínculo directo ya está guardado
  // y la cotización es utilizable, así que no se convierte en un error.
  try {
    if (typeof shell.records.link === 'function' && s(shell.app && shell.app.instanceId)) {
      await shell.records.link(s(res.ref), {
        instanceId: s(shell.app.instanceId),
        itemId: s(quoteId),
        kind: doc.kind === KIND_TEMPLATE ? 'plantilla' : 'cotizacion',
        label: s(doc.number) || s(doc.title) || s(doc.client.name),
      });
    }
  } catch (e) { /* el índice inverso es una comodidad, no una condición */ }

  if (!o.silent) {
    // El aviso de la plataforma (claves que apuntaban a registros distintos,
    // o un cliente sin ninguna clave natural) es la única señal temprana de
    // un duplicado: se muestra tal cual, no se traga.
    if (s(res.warning)) shell.notify({ level: 'warn', text: s(res.warning) });
    else if (res.created) shell.notify({ level: 'success', text: 'Cliente registrado en el directorio del sistema.' });
    else {
      shell.notify({
        level: 'success',
        text: 'Vinculado con «' + (s(registro.label) || s(doc.client.name)) + '», que ya existía en el sistema.',
      });
    }
  }
  return { ref: s(res.ref), created: !!res.created, warning: s(res.warning), record: registro };
}

/**
 * Vuelve a leer el registro y refresca la instantánea del cliente.
 *
 * Dos casos que importan:
 *   · El registro cambió de nombre → se actualiza lo que se imprimirá.
 *   · El registro se fusionó con otro (`replaces`) → se reapunta la
 *     referencia, o quedaría colgando de una identidad que ya no es la buena.
 *
 * Si el registro ya no existe NO se borra nada: la cotización conserva su
 * instantánea y solo se avisa.
 */
async function actRefreshClientRecord(quoteId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const ref = s(doc.client.recordRef);
  if (!ref) return null;

  const motivo = registroNoDisponible();
  if (motivo || typeof shell.records.resolve !== 'function') {
    shell.notify({ level: 'warn', text: motivo || 'Este host no permite refrescar el cliente.' });
    return null;
  }

  let lista;
  try {
    lista = arr(await shell.records.resolve([ref]));
  } catch (e) {
    shell.notify({ level: 'error', text: 'No se pudo leer el directorio: ' + ((e && e.message) || 'error') });
    return null;
  }
  const r = lista[0];
  if (!isObj(r) || r.resolved === false) {
    shell.notify({
      level: 'warn',
      text: 'Ese cliente ya no está en el directorio; la cotización conserva los datos con los que se hizo.',
    });
    return null;
  }

  const keys = isObj(r.keys) ? r.keys : {};
  const next = commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient(Object.assign({}, d.client, {
      name: s(r.label) || s(d.client.name),
      // El registro solo guarda claves: lo que no conoce no se pisa.
      taxId: s(keys.taxid) || s(d.client.taxId),
      email: s(keys.email) || s(d.client.email),
      recordRef: s(r.ref) || ref,
    }));
    return d;
  });

  if (s(r.replaces)) {
    shell.notify({ level: 'info', text: 'Ese cliente se había fusionado con otro; la cotización ya apunta al correcto.' });
  } else {
    shell.notify({ level: 'success', text: 'Cliente actualizado desde el directorio.' });
  }
  return next;
}

/**
 * Guarda el cliente escrito a mano en la app Clientes.
 *
 * Es lo que cierra el círculo: cotizar a alguien nuevo deja de ser un callejón
 * sin salida donde el cliente vive solo dentro de una cotización.
 *
 * Requiere `data.write:customers` en el manifest Y que la app Clientes
 * publique su `dataSchema` (APP-SPEC §7.c). Si no cumple una de las dos, la
 * plataforma lo rechaza y aquí solo se explica.
 */
async function actPushClientToDirectory(quoteId, instanceId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  if (!shell.data || typeof shell.data.create !== 'function') {
    shell.notify({ level: 'warn', text: 'Este host no permite escribir en otras apps.' });
    return null;
  }
  const falta = clienteVinculable(doc.client);
  if (falta) { shell.notify({ level: 'warn', text: falta }); return null; }

  // La instancia destino: la que se indique, o la única que haya. Con varias
  // y ninguna elegida no se adivina: escribir en el directorio equivocado es
  // peor que no escribir.
  let destino = s(instanceId);
  if (!destino) {
    const fuentes = arr(model.ext.customerSources);
    if (fuentes.length === 1) destino = s(fuentes[0].id);
  }
  if (!destino) {
    shell.notify({ level: 'warn', text: 'Elige a qué directorio de clientes quieres añadirlo.' });
    return null;
  }

  const c = doc.client;
  const payload = { name: s(c.name).trim() };
  if (s(c.taxId)) payload.taxId = s(c.taxId).trim();
  if (s(c.email)) payload.email = s(c.email).trim();
  if (s(c.phone)) payload.phone = s(c.phone).trim();

  let item;
  try {
    item = await shell.data.create(destino, payload);
  } catch (e) {
    shell.notify({ level: 'error', text: 'No se pudo añadir al directorio: ' + ((e && e.message) || 'error') });
    return null;
  }
  if (!isObj(item)) return null;

  commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient(Object.assign({}, d.client, {
      sourceApp: 'customers', sourceInstanceId: destino, sourceItemId: s(item.id),
    }));
    return d;
  });
  // El espejo de lectura queda viejo en cuanto se escribe: se refresca para
  // que el selector de clientes lo encuentre sin recargar la app.
  loadCustomers(true);
  shell.notify({ level: 'success', text: 'Cliente añadido al directorio.' });

  // Y se le da identidad, que es de lo que va todo esto.
  await actLinkClientRecord(s(quoteId), { silent: true });
  return item;
}

/** Estado del vínculo, para pintarlo sin repetir la lógica en la vista. */
function estadoVinculo(doc) {
  const c = (doc && doc.client) || {};
  if (s(c.recordRef)) return { estado: 'vinculado', texto: 'Cliente del sistema' };
  if (s(c.sourceApp) === 'customers') return { estado: 'directorio', texto: 'Del directorio, sin identidad' };
  return { estado: 'suelto', texto: 'Solo en esta cotización' };
}

// ── Marca del tenant ────────────────────────────────────────────────────
/**
 * El emisor de las cotizaciones puede venir de la marca del sistema
 * (`shell.brands`, APP-SPEC §7.f) en vez de reescribirse aquí.
 *
 * La marca RELLENA, no impone: se copia a los ajustes del cotizador y desde
 * ahí se puede cambiar. Un tenant con dos unidades de negocio necesita poder
 * cotizar con una razón social distinta de la marca por defecto, y quitarle
 * esa posibilidad para «mantenerlo sincronizado» sería resolver un problema
 * que no tiene a costa de uno que sí.
 */
function marcaNoDisponible() {
  if (!shell.brands || typeof shell.brands.current !== 'function') {
    return 'Este host todavía no expone las marcas del sistema; el emisor se escribe aquí.';
  }
  return '';
}

/** Copia la marca activa del tenant a los ajustes del emisor. */
async function actImportBrand() {
  const motivo = marcaNoDisponible();
  if (motivo) { shell.notify({ level: 'warn', text: motivo }); return null; }

  let marca;
  try {
    marca = await shell.brands.current();
  } catch (e) {
    shell.notify({ level: 'error', text: 'No se pudo leer la marca: ' + ((e && e.message) || 'error') });
    return null;
  }
  if (!isObj(marca)) {
    shell.notify({
      level: 'warn',
      text: 'Este KIMOS todavía no tiene una marca configurada. La define un administrador y luego se trae desde aquí.',
    });
    return null;
  }

  // El registro devuelve los atajos ya resueltos (`logoLight`, `logoDark`),
  // así que la cotización no tiene que recorrer la lista de logotipos ni
  // acertar con el fondo. Se prefiere el de fondo claro: la propuesta se
  // imprime sobre papel blanco.
  // Solo se pisa lo que la marca SÍ trae: si no tiene teléfono, no se borra
  // el que ya estaba escrito aquí.
  const patch = {};
  const poner = (campo, valor) => { if (s(valor).trim()) patch[campo] = s(valor).trim(); };
  poner('name', marca.legalName || marca.name);
  poner('taxId', marca.taxId);
  poner('email', marca.email);
  poner('phone', marca.phone);
  poner('web', marca.website);
  poner('address', marca.address);
  poner('logoUrl', marca.logoLight || marca.logoDark);
  poner('paymentInfo', marca.bankDetails);
  if (!Object.keys(patch).length) {
    shell.notify({ level: 'warn', text: 'La marca del sistema no tiene datos que traer todavía.' });
    return null;
  }

  const out = actPatchIssuer(patch);
  shell.notify({
    level: 'success',
    text: 'Emisor traído de la marca del sistema (' + s(marca.name) + '). Puedes ajustarlo para este cotizador.',
  });
  return out;
}

// ══════════════════════════════════════════════════════════════════════
// src/70-blocks.js
// ══════════════════════════════════════════════════════════════════════
/* ══ LIENZO: MODELO Y PINTADO DE BLOQUES ══════════════════════════════════
 *
 * Una propuesta es una lista de **bloques** sobre una cuadrícula de 12
 * columnas. Cada bloque declara cuántas columnas ocupa (`w`) y los bloques
 * fluyen en orden, envolviendo cuando se llena la fila. Se eligió eso y no
 * posicionamiento absoluto por una razón práctica: una cotización termina en
 * un PDF paginado, y una cuadrícula que fluye se pagina sola; con
 * coordenadas absolutas habría que resolver a mano qué cae en cada página.
 *
 * Hay dos clases de bloque:
 *
 *   Vinculados   `header`, `items`, `totals`, `notes`, `payment`. No guardan
 *                contenido: lo leen del documento. Editar una línea en la
 *                pestaña Datos cambia lo que pinta el bloque `items`, y al
 *                revés. Nunca hay dos copias del mismo dato.
 *   Propios      `text`, `image`, `spacer`, `divider`, `pagebreak`. Su
 *                contenido vive en el bloque y solo existe en el lienzo.
 *
 * ESTE MISMO pintado es el que se usa para exportar el PDF (fase 5): el
 * documento se renderiza con los mismos componentes en la ventana de
 * impresión, así que lo que se ve en el lienzo es exactamente lo que sale
 * impreso, sin un segundo maquetador que se desincronice.
 */

const GRID_COLS = 12;

/** Catálogo de bloques: qué se puede añadir al lienzo y cómo se presenta. */
const BLOCK_TYPES = [
  { type: 'header', label: 'Cabecera', icon: '🏷', w: 12, linked: true, help: 'Emisor, cliente, número y fechas. Se completa desde los datos de la cotización.' },
  { type: 'items', label: 'Tabla de ítems', icon: '▤', w: 12, linked: true, help: 'Las líneas de la cotización, tal como se imprimen.' },
  { type: 'totals', label: 'Totales', icon: '∑', w: 12, linked: true, help: 'Subtotal, impuesto, total y el desglose de abono y saldo.' },
  { type: 'notes', label: 'Notas', icon: '✎', w: 12, linked: true, help: 'Las notas y condiciones de la cotización.' },
  { type: 'payment', label: 'Datos de pago', icon: '🏦', w: 12, linked: true, help: 'Los datos de transferencia del pie.' },
  { type: 'text', label: 'Texto', icon: '¶', w: 12, help: 'Un título, un párrafo o una nota al margen.' },
  { type: 'image', label: 'Imagen', icon: '🖼', w: 6, help: 'Una foto, un plano, un render o el logo de la sede.' },
  { type: 'divider', label: 'Separador', icon: '─', w: 12, help: 'Una línea que separa secciones.' },
  { type: 'spacer', label: 'Espacio', icon: '␣', w: 12, help: 'Aire en blanco entre bloques.' },
  { type: 'pagebreak', label: 'Salto de página', icon: '⤓', w: 12, help: 'Fuerza el corte de página al exportar el PDF.' },
];
const BLOCK_BY_TYPE = new Map(BLOCK_TYPES.map((b) => [b.type, b]));
const isLinkedBlock = (type) => !!(BLOCK_BY_TYPE.get(type) || {}).linked;

const TEXT_SIZES = [['xs', 'Muy pequeño'], ['sm', 'Pequeño'], ['md', 'Normal'], ['lg', 'Grande'], ['xl', 'Título'], ['xxl', 'Portada']];
const ALIGNS = [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']];
const TONES = [['default', 'Normal'], ['dim', 'Suave'], ['accent', 'Acento'], ['invert', 'Sobre acento']];

function normalizeBlock(raw) {
  const r = isObj(raw) ? raw : {};
  const type = BLOCK_BY_TYPE.has(s(r.type)) ? s(r.type) : 'text';
  const def = BLOCK_BY_TYPE.get(type);
  return {
    id: s(r.id) || uid('b'),
    type,
    w: clamp(Math.round(num(r.w, def.w)), 1, GRID_COLS),
    // Presentación (común a todos los bloques).
    align: ALIGNS.some(([k]) => k === r.align) ? s(r.align) : 'left',
    tone: TONES.some(([k]) => k === r.tone) ? s(r.tone) : 'default',
    pad: clamp(Math.round(num(r.pad, 0)), 0, 48),
    // Contenido propio, según el tipo.
    text: s(r.text),
    size: TEXT_SIZES.some(([k]) => k === r.size) ? s(r.size) : 'md',
    url: s(r.url),
    caption: s(r.caption),
    fit: r.fit === 'contain' ? 'contain' : 'cover',
    height: clamp(Math.round(num(r.height, 180)), 40, 900),
    // Opciones de los bloques vinculados.
    showImages: r.showImages === true,      // fotos de los ítems en la tabla
    hideEmpty: r.hideEmpty !== false,        // no imprimir el bloque si no hay qué mostrar
    title: s(r.title),                       // encabezado opcional del bloque
    updatedAt: s(r.updatedAt),
    updatedBy: s(r.updatedBy),
  };
}

/**
 * Maqueta por defecto: la de las propuestas de la casa. Se siembra la primera
 * vez que se abre el lienzo de una cotización, de modo que nadie empiece
 * delante de una hoja en blanco.
 */
function bloquesPorDefecto() {
  return [
    normalizeBlock({ type: 'header', w: 12 }),
    normalizeBlock({ type: 'items', w: 12 }),
    normalizeBlock({ type: 'totals', w: 12 }),
    normalizeBlock({ type: 'notes', w: 12 }),
    normalizeBlock({ type: 'payment', w: 12 }),
  ];
}

/** Los bloques del documento, sembrando la maqueta por defecto si no hay. */
function bloquesDe(doc) {
  const list = arr(doc && doc.blocks).map(normalizeBlock);
  return list.length ? list : bloquesPorDefecto();
}

/** ¿El bloque tiene algo que mostrar? Decide si se imprime o no. */
function bloqueVacio(b, ctx) {
  const doc = ctx.doc;
  if (b.type === 'items') return !arr(doc.lines).length;
  if (b.type === 'notes') return !arr(doc.notes).filter((n) => s(n).trim()).length;
  if (b.type === 'payment') return !s(doc.paymentInfo || ctx.issuer.paymentInfo).trim();
  if (b.type === 'text') return !s(b.text).trim();
  if (b.type === 'image') return !s(b.url).trim();
  return false;
}

// ── Pintado ─────────────────────────────────────────────────────────────
/**
 * Contexto de pintado: todo lo que un bloque necesita saber, resuelto una
 * sola vez por el llamador (el lienzo o la ventana de impresión).
 */
function contextoDe(doc, def) {
  const rules = normalizeRules(def && def.rules);
  const issuer = normalizeIssuer(def && def.issuer);
  const totals = computeTotals(doc, rules);
  return { doc, rules, issuer, totals, cur: totals.currency, until: validUntilOf(doc, rules) };
}

/** Un bloque, pintado. El mismo componente sirve al lienzo y al PDF. */
function Block(props) {
  const { block: b, ctx, mode } = props;
  const edit = mode === 'edit';
  if (!edit && b.hideEmpty && bloqueVacio(b, ctx)) return null;

  const cuerpo = (() => {
    switch (b.type) {
      case 'header': return h(BlockHeader, { b, ctx });
      case 'items': return h(BlockItems, { b, ctx });
      case 'totals': return h(BlockTotals, { b, ctx });
      case 'notes': return h(BlockNotes, { b, ctx });
      case 'payment': return h(BlockPayment, { b, ctx });
      case 'text': return h(BlockText, { b, ctx, edit, onChange: props.onChange });
      case 'image': return h(BlockImage, { b, ctx, edit });
      case 'divider': return h('hr', { className: 'cz-b-hr' });
      case 'spacer': return h('div', { className: 'cz-b-spacer', style: { height: b.height } });
      case 'pagebreak': return h('div', { className: 'cz-b-pagebreak' }, edit ? '⤓ Salto de página' : '');
      default: return null;
    }
  })();

  return h('div', {
    className: cx('cz-b', 'cz-b-' + b.type, 'cz-tone-' + b.tone, 'cz-al-' + b.align),
    style: b.pad ? { padding: b.pad } : undefined,
  }, [
    b.title ? h('h3', { key: 't', className: 'cz-b-title' }, b.title) : null,
    cuerpo,
  ]);
}

function BlockHeader(props) {
  const { ctx } = props;
  const { doc, issuer, until, rules } = ctx;
  const esPlantilla = doc.kind === KIND_TEMPLATE;
  const dato = (label, value) => (s(value) ? h('div', { key: label, className: 'cz-hdblock-row' }, [
    h('span', { key: 'l', className: 'cz-hdblock-lbl' }, label),
    h('span', { key: 'v', className: 'cz-hdblock-val' }, value),
  ]) : null);

  return h('div', { className: 'cz-hdblock' }, [
    h('div', { key: 'l', className: 'cz-hdblock-emisor' }, [
      issuer.logoUrl ? h('img', { key: 'g', className: 'cz-hdblock-logo', src: issuer.logoUrl, alt: '' }) : null,
      h('div', { key: 'd', className: 'cz-hdblock-emisor-d' }, [
        h('div', { key: 'n', className: 'cz-hdblock-emisor-n' }, issuer.name || 'Sin emisor configurado'),
        issuer.taxId ? h('div', { key: 'r', className: 'cz-mono cz-dim' }, issuer.taxId) : null,
        issuer.tagline ? h('div', { key: 't', className: 'cz-dim' }, issuer.tagline) : null,
        h('div', { key: 'c', className: 'cz-dim cz-hdblock-contacto' },
          [issuer.email, issuer.phone, issuer.web].filter(Boolean).join(' · ')),
      ]),
    ]),
    h('div', { key: 'r', className: 'cz-hdblock-doc' }, [
      h('div', { key: 't', className: 'cz-hdblock-tit' }, esPlantilla ? 'COTIZACIÓN TIPO' : 'COTIZACIÓN'),
      !esPlantilla ? h('div', { key: 'n', className: 'cz-hdblock-num cz-mono' }, doc.number) : null,
      dato('Fecha', fechaCorta(doc.date)),
      !esPlantilla ? dato('Válida hasta', fechaCorta(until)) : null,
      !esPlantilla ? dato('Cliente', doc.client.name) : null,
      !esPlantilla ? dato('RUT', doc.client.taxId) : null,
      !esPlantilla ? dato('Contacto', doc.client.contact || doc.client.email) : null,
      doc.subtitle ? h('div', { key: 's', className: 'cz-hdblock-sub' }, doc.subtitle) : null,
      rules.currency !== 'CLP' ? dato('Moneda', ctx.cur.code) : null,
    ]),
  ]);
}

function BlockItems(props) {
  const { b, ctx } = props;
  const { doc, rules, cur } = ctx;
  const taxPct = doc.taxPct == null ? rules.taxPct : doc.taxPct;
  const lineRules = { taxPct, priceMode: rules.priceMode };
  const activas = arr(doc.lines).filter((l) => !l.optional);
  const opcionales = arr(doc.lines).filter((l) => l.optional);

  const fila = (l, i) => h('tr', { key: l.id, className: cx('cz-b-tr', l.optional && 'opt') }, [
    b.showImages ? h('td', { key: 'i', className: 'cz-b-td-img' },
      l.imageUrl ? h('img', { src: l.imageUrl, alt: '', className: 'cz-b-itemimg' }) : null) : null,
    h('td', { key: 'n', className: 'cz-b-td-item' }, [
      h('div', { key: 't' }, l.title),
      l.sku ? h('div', { key: 's', className: 'cz-b-sku cz-mono' }, l.sku) : null,
    ]),
    h('td', { key: 'd', className: 'cz-b-td-desc' }, parrafos(l.description)),
    h('td', { key: 'q', className: 'cz-b-td-num' }, l.qtyLabel || numberFmt(l.qty, 2, cur.locale) + (l.unit ? ' ' + l.unit : '')),
    h('td', { key: 'u', className: 'cz-b-td-num cz-mono' }, money(l.unitPrice, cur)),
    h('td', { key: 'v', className: 'cz-b-td-num cz-mono cz-strong' }, money(lineDisplayTotal(l, lineRules), cur)),
  ]);

  return h('div', null, [
    h('table', { key: 't', className: 'cz-b-table' }, [
      h('thead', { key: 'h' }, h('tr', null, [
        b.showImages ? h('th', { key: 'i', className: 'cz-b-th' }, '') : null,
        h('th', { key: 'n', className: 'cz-b-th' }, 'ITEM'),
        h('th', { key: 'd', className: 'cz-b-th' }, 'DESCRIPCIÓN'),
        h('th', { key: 'q', className: 'cz-b-th cz-b-th-num' }, 'CANTIDAD'),
        h('th', { key: 'u', className: 'cz-b-th cz-b-th-num' }, rules.priceMode === 'gross' ? 'PRECIO UNIT' : 'NETO UNIT'),
        h('th', { key: 'v', className: 'cz-b-th cz-b-th-num' }, rules.priceMode === 'gross' ? 'TOTAL' : 'NETO TOTAL'),
      ])),
      h('tbody', { key: 'b' }, activas.map(fila)),
    ]),
    opcionales.length ? h('div', { key: 'o', className: 'cz-b-opt' }, [
      h('div', { key: 't', className: 'cz-b-opt-tit' }, 'Opcionales (no incluidos en el total)'),
      h('table', { key: 'tb', className: 'cz-b-table' }, h('tbody', null, opcionales.map(fila))),
    ]) : null,
  ]);
}

function BlockTotals(props) {
  const { ctx } = props;
  const { totals: t, rules, cur } = ctx;
  const fila = (label, value, cls) => h('div', { key: label, className: cx('cz-b-tot-row', cls) }, [
    h('span', { key: 'l' }, label),
    h('span', { key: 'v', className: 'cz-mono' }, value),
  ]);
  return h('div', { className: 'cz-b-tot' }, [
    fila(rules.priceMode === 'gross' ? 'SUBTOTAL' : 'SUBTOTAL NETO', money(t.subtotal, cur)),
    t.discount ? fila('DESCUENTO', '− ' + money(t.discount, cur)) : null,
    fila((rules.taxLabel || 'IVA').toUpperCase() + ' (' + numberFmt(t.taxPct, 2, cur.locale) + '%)', money(t.tax, cur)),
    fila('TOTAL' + (t.tax ? ' ' + (rules.taxLabel || 'IVA').toUpperCase() + ' INCLUIDO' : ''), money(t.total, cur), 'cz-b-tot-total'),
    t.advanceEnabled ? fila('ABONO (' + numberFmt(t.advancePct, 2, cur.locale) + '%)', money(t.advance, cur)) : null,
    t.advanceEnabled ? fila('SALDO (' + numberFmt(100 - t.advancePct, 2, cur.locale) + '%)', money(t.balance, cur)) : null,
  ]);
}

function BlockNotes(props) {
  const notas = arr(props.ctx.doc.notes).filter((n) => s(n).trim());
  return h('div', { className: 'cz-b-notes' }, [
    h('div', { key: 't', className: 'cz-b-notes-tit' }, props.b.title ? '' : 'Notas'),
    h('ul', { key: 'l', className: 'cz-b-notes-list' }, notas.map((n, i) => h('li', { key: i }, s(n).replace(/^[-–—]\s*/, '')))),
  ]);
}

function BlockPayment(props) {
  const { b, ctx } = props;
  const texto = s(ctx.doc.paymentInfo) || s(ctx.issuer.paymentInfo);
  return h('div', { className: 'cz-b-pay' }, [
    h('div', { key: 't', className: 'cz-b-pay-tit' }, b.title ? '' : 'Datos de transferencia'),
    h('div', { key: 'v', className: 'cz-b-pay-body' }, parrafos(texto)),
  ]);
}

function BlockText(props) {
  const { b, edit, onChange } = props;
  const cls = cx('cz-b-text', 'cz-sz-' + b.size);
  if (edit && onChange) {
    return h(AutoArea, {
      className: cls, value: b.text, placeholder: 'Escribe aquí…',
      onChange: (e) => onChange({ text: e.target.value }),
    });
  }
  return h('div', { className: cls }, parrafos(b.text));
}

function BlockImage(props) {
  const { b, edit } = props;
  if (!s(b.url)) {
    return edit
      ? h('div', { className: 'cz-b-img-empty' }, 'Sin imagen: elige una en el panel de la derecha.')
      : null;
  }
  return h('figure', { className: 'cz-b-fig' }, [
    h('img', {
      key: 'i', className: 'cz-b-img', src: b.url, alt: s(b.caption),
      style: { height: b.height, objectFit: b.fit },
    }),
    b.caption ? h('figcaption', { key: 'c', className: 'cz-b-figcap' }, b.caption) : null,
  ]);
}

/**
 * Texto multilínea → párrafos. Se pinta como elementos React, nunca como
 * HTML: el texto lo escribe una persona (o llega del catálogo de otra app) y
 * no se interpreta jamás como marcado.
 */
function parrafos(texto) {
  return s(texto).split(/\n/).map((linea, i) => h('div', { key: i, className: 'cz-b-line' }, linea || ' '));
}

/** La hoja completa: los bloques del documento sobre la cuadrícula. */
function Sheet(props) {
  const { doc, def, mode } = props;
  const ctx = contextoDe(doc, def);
  const blocks = bloquesDe(doc);
  return h('div', { className: cx('cz-sheet', 'cz-sheet-' + (mode || 'preview')) },
    blocks.map((b) => h('div', {
      key: b.id, className: 'cz-cell', style: { gridColumn: 'span ' + b.w },
    }, h(Block, { block: b, ctx, mode: mode === 'edit' ? 'edit' : 'print' }))));
}

// ══════════════════════════════════════════════════════════════════════
// src/72-canvas.js
// ══════════════════════════════════════════════════════════════════════
/* ══ LIENZO: EDICIÓN VISUAL ═══════════════════════════════════════════════
 *
 * El editor de la maqueta: los bloques se ven **tal como se imprimirán** y se
 * manipulan encima. Se arrastra para reordenar, se tira del borde derecho
 * para cambiar cuántas columnas ocupa un bloque, y el panel de la derecha
 * ajusta lo suyo (tamaño de texto, imagen, aire, tono).
 *
 * El estado de interacción —qué bloque está seleccionado, cuál se está
 * arrastrando— vive en el componente y NO en el documento: no tiene por qué
 * viajar al resto de las personas que tengan la cotización abierta.
 */

// ── Acciones sobre los bloques ──────────────────────────────────────────
/** Escribe la lista completa de bloques en el documento. */
function actSetBlocks(quoteId, blocks) {
  return actPatchDoc(s(quoteId), { blocks: arr(blocks).map(normalizeBlock) });
}

function actAddBlock(quoteId, type, atIndex, props) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const def = BLOCK_BY_TYPE.get(s(type));
  if (!def) return null;
  const b = normalizeBlock(Object.assign({ type: def.type, w: def.w }, isObj(props) ? props : {}));
  b.updatedAt = stamp();
  b.updatedBy = meLabel();
  const list = bloquesDe(doc);
  const at = atIndex == null ? list.length : clamp(Math.round(num(atIndex)), 0, list.length);
  list.splice(at, 0, b);
  actSetBlocks(quoteId, list);
  return b;
}

function actUpdateBlock(quoteId, blockId, patch) {
  const doc = docById(s(quoteId));
  if (!doc || !isObj(patch)) return null;
  let out = null;
  const list = bloquesDe(doc).map((b) => {
    if (b.id !== s(blockId)) return b;
    out = normalizeBlock(Object.assign({}, b, patch, { id: b.id, updatedAt: stamp(), updatedBy: meLabel() }));
    return out;
  });
  if (out) actSetBlocks(quoteId, list);
  return out;
}

function actRemoveBlock(quoteId, blockId) {
  const doc = docById(s(quoteId));
  if (!doc) return false;
  const list = bloquesDe(doc);
  const next = list.filter((b) => b.id !== s(blockId));
  if (next.length === list.length) return false;
  actSetBlocks(quoteId, next);
  return true;
}

function actMoveBlock(quoteId, blockId, toIndex) {
  const doc = docById(s(quoteId));
  if (!doc) return false;
  const list = bloquesDe(doc);
  const from = list.findIndex((b) => b.id === s(blockId));
  if (from < 0) return false;
  const to = clamp(Math.round(num(toIndex)), 0, list.length - 1);
  if (to === from) return false;
  const [it] = list.splice(from, 1);
  list.splice(to, 0, it);
  actSetBlocks(quoteId, list);
  return true;
}

/** Vuelve a la maqueta de la casa, perdiendo los bloques propios del lienzo. */
function actResetBlocks(quoteId) {
  return actSetBlocks(quoteId, bloquesPorDefecto());
}

// ── El lienzo ───────────────────────────────────────────────────────────
function CanvasEditor(props) {
  const { m, doc } = props;
  const [selId, setSelId] = useState('');
  const [dragId, setDragId] = useState('');
  const [overId, setOverId] = useState('');
  const [menu, setMenu] = useState(false);
  const [ask, confirmNode] = useConfirm();
  const gridRef = useRef(null);

  const blocks = bloquesDe(doc);
  const sel = blocks.find((b) => b.id === selId) || null;
  const ctx = contextoDe(doc, m.def);

  // La primera vez que se abre el lienzo se siembra la maqueta por defecto,
  // para que quede guardada y editable en vez de ser un cálculo implícito.
  useEffect(() => {
    if (!arr(doc.blocks).length) actSetBlocks(doc.id, bloquesPorDefecto());
  }, [doc.id]);

  const soltar = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(''); setOverId(''); return; }
    const to = blocks.findIndex((b) => b.id === targetId);
    if (to >= 0) actMoveBlock(doc.id, dragId, to);
    setDragId(''); setOverId('');
  };

  /**
   * Redimensionado: se sigue el puntero y se traduce la distancia recorrida a
   * columnas usando el ancho real de la cuadrícula, así el bloque encaja
   * siempre en la rejilla y nunca queda a mitad de columna.
   */
  const empezarResize = (b, ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const anchoCol = grid.getBoundingClientRect().width / GRID_COLS;
    const x0 = ev.clientX;
    const w0 = b.w;
    let ultimo = w0;
    const mover = (e) => {
      const cols = clamp(w0 + Math.round((e.clientX - x0) / anchoCol), 1, GRID_COLS);
      if (cols !== ultimo) { ultimo = cols; actUpdateBlock(doc.id, b.id, { w: cols }); }
    };
    const soltarPuntero = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltarPuntero);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltarPuntero);
  };

  return h('div', { className: 'cz-canvas' }, [
    // ── Barra del lienzo ─────────────────────────────────────────────
    h('div', { key: 'tb', className: 'cz-canvas-tb' }, [
      h('div', { key: 'add', className: 'cz-menu-wrap' }, [
        h(Btn, { key: 'b', size: 'sm', variant: 'primary', onClick: () => setMenu(!menu) }, '+ Añadir bloque'),
        menu ? h('div', { key: 'm', className: 'cz-menu' }, BLOCK_TYPES.map((t) => h('button', {
          key: t.type, type: 'button', className: 'cz-menu-it',
          title: t.help,
          onClick: () => {
            const at = sel ? blocks.findIndex((b) => b.id === sel.id) + 1 : blocks.length;
            const nuevo = actAddBlock(doc.id, t.type, at);
            if (nuevo) setSelId(nuevo.id);
            setMenu(false);
          },
        }, [
          h('span', { key: 'i', className: 'cz-menu-ico' }, t.icon),
          h('span', { key: 'l', className: 'cz-menu-lbl' }, t.label),
          t.linked ? h('span', { key: 'v', className: 'cz-menu-tag', title: 'Toma su contenido de los datos de la cotización' }, 'vinculado') : null,
        ]))) : null,
      ]),
      h('span', { key: 'n', className: 'cz-canvas-note' },
        'Arrastra para reordenar · tira del borde derecho para cambiar el ancho'),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, {
        key: 'r', size: 'sm',
        title: 'Volver a la maqueta por defecto (se pierden los bloques añadidos)',
        onClick: async () => {
          const ok = await ask({
            title: 'Restablecer la maqueta', danger: true, okLabel: 'Restablecer',
            text: 'Se vuelve a la maqueta por defecto y se pierden los textos e imágenes que hayas añadido al lienzo. Los datos de la cotización no se tocan.',
          });
          if (ok) { actResetBlocks(doc.id); setSelId(''); }
        },
      }, '↺ Restablecer'),
    ]),

    // ── Hoja y panel ─────────────────────────────────────────────────
    h('div', { key: 'body', className: 'cz-canvas-body' }, [
      h('div', { key: 'paper', className: 'cz-paper', onMouseDown: (e) => { if (e.target === e.currentTarget) setSelId(''); } },
        h('div', { key: 'g', ref: gridRef, className: 'cz-sheet cz-sheet-edit' }, blocks.map((b, i) => h('div', {
          key: b.id,
          className: cx('cz-cell', 'cz-cell-edit', selId === b.id && 'sel', dragId === b.id && 'dragging', overId === b.id && 'over'),
          style: { gridColumn: 'span ' + b.w },
          onMouseDown: () => setSelId(b.id),
          onDragOver: (e) => { e.preventDefault(); setOverId(b.id); },
          onDrop: (e) => { e.preventDefault(); soltar(b.id); },
        }, [
          h('div', {
            key: 'h', className: 'cz-cell-handle', draggable: true,
            title: (BLOCK_BY_TYPE.get(b.type) || {}).label + ' — arrastra para mover',
            onDragStart: () => setDragId(b.id),
            onDragEnd: () => { setDragId(''); setOverId(''); },
          }, [
            h('span', { key: 'i' }, (BLOCK_BY_TYPE.get(b.type) || {}).icon),
            h('span', { key: 'w', className: 'cz-cell-w' }, b.w + '/' + GRID_COLS),
          ]),
          h(Block, {
            key: 'b', block: b, ctx, mode: 'edit',
            onChange: (patch) => actUpdateBlock(doc.id, b.id, patch),
          }),
          h('div', {
            key: 'r', className: 'cz-cell-resize', title: 'Arrastra para cambiar el ancho',
            onPointerDown: (e) => empezarResize(b, e),
          }),
        ])))),
      h('aside', { key: 'insp', className: 'cz-inspector' },
        sel ? h(BlockInspector, { doc, block: sel, m, onClose: () => setSelId('') })
          : h('div', { className: 'cz-inspector-empty' }, [
            h('div', { key: 't', className: 'cz-inspector-empty-t' }, 'Nada seleccionado'),
            h('div', { key: 'x', className: 'cz-dim' }, 'Pulsa un bloque de la hoja para ajustarlo, o añade uno nuevo.'),
          ])),
    ]),
    confirmNode,
  ]);
}

// ── Panel del bloque seleccionado ───────────────────────────────────────
function BlockInspector(props) {
  const { doc, block: b, m } = props;
  const meta = BLOCK_BY_TYPE.get(b.type) || {};
  const set = (patch) => actUpdateBlock(doc.id, b.id, patch);
  const blocks = bloquesDe(doc);
  const idx = blocks.findIndex((x) => x.id === b.id);

  return h('div', { className: 'cz-inspector-in' }, [
    h('div', { key: 'h', className: 'cz-inspector-hd' }, [
      h('span', { key: 'i', className: 'cz-inspector-ico' }, meta.icon),
      h('span', { key: 't', className: 'cz-inspector-t' }, meta.label),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(IconBtn, { key: 'u', icon: '↑', title: 'Subir', disabled: idx <= 0, onClick: () => actMoveBlock(doc.id, b.id, idx - 1) }),
      h(IconBtn, { key: 'd', icon: '↓', title: 'Bajar', disabled: idx >= blocks.length - 1, onClick: () => actMoveBlock(doc.id, b.id, idx + 1) }),
      h(IconBtn, {
        key: 'c', icon: '⧉', title: 'Duplicar bloque',
        onClick: () => actAddBlock(doc.id, b.type, idx + 1, Object.assign({}, b, { id: undefined })),
      }),
      h(IconBtn, { key: 'x', icon: '🗑', title: 'Quitar bloque', onClick: () => { actRemoveBlock(doc.id, b.id); props.onClose(); } }),
    ]),
    meta.help ? h('div', { key: 'help', className: 'cz-inspector-help' }, meta.help) : null,

    h(Field, { key: 'w', label: 'Ancho', help: b.w + ' de ' + GRID_COLS + ' columnas' }, h('input', {
      type: 'range', min: 1, max: GRID_COLS, value: b.w, className: 'cz-range',
      onChange: (e) => set({ w: num(e.target.value) }),
    })),
    h(Field, { key: 'a', label: 'Alineación' }, h('div', { className: 'cz-segmented' }, ALIGNS.map(([k, label]) => h('button', {
      key: k, type: 'button', className: cx('cz-seg', b.align === k && 'on'), title: label,
      onClick: () => set({ align: k }),
    }, k === 'left' ? '⯇' : (k === 'center' ? '≡' : '⯈'))))),
    h(Field, { key: 'to', label: 'Tono' }, h(Select, {
      value: b.tone, onChange: (e) => set({ tone: e.target.value }),
      options: TONES.map(([k, label]) => ({ value: k, label })),
    })),
    h(Field, { key: 'ti', label: 'Encabezado del bloque', help: 'Opcional: un título encima del contenido.' },
      h(Input, { value: b.title, placeholder: '—', onChange: (e) => set({ title: e.target.value }) })),
    h(Field, { key: 'p', label: 'Margen interior', help: b.pad + ' px' }, h('input', {
      type: 'range', min: 0, max: 48, step: 2, value: b.pad, className: 'cz-range',
      onChange: (e) => set({ pad: num(e.target.value) }),
    })),

    // ── Propiedades del tipo ─────────────────────────────────────────
    b.type === 'text' ? h(Field, { key: 'sz', label: 'Tamaño del texto' }, h(Select, {
      value: b.size, onChange: (e) => set({ size: e.target.value }),
      options: TEXT_SIZES.map(([k, label]) => ({ value: k, label })),
    })) : null,
    b.type === 'text' ? h(Field, { key: 'tx', label: 'Texto', wide: true },
      h(AutoArea, { minRows: 4, value: b.text, placeholder: 'También puedes escribir directamente sobre la hoja.', onChange: (e) => set({ text: e.target.value }) })) : null,

    b.type === 'image' ? h(Field, { key: 'im', label: 'Imagen', wide: true },
      h(ImageField, { value: b.url, folder: 'lienzo', onChange: (v) => set({ url: v }) })) : null,
    b.type === 'image' ? h(Field, { key: 'cp', label: 'Pie de foto' },
      h(Input, { value: b.caption, onChange: (e) => set({ caption: e.target.value }) })) : null,
    b.type === 'image' ? h(Field, { key: 'fi', label: 'Encaje' }, h(Select, {
      value: b.fit, onChange: (e) => set({ fit: e.target.value }),
      options: [{ value: 'cover', label: 'Recortar para llenar' }, { value: 'contain', label: 'Ver completa' }],
    })) : null,
    b.type === 'image' || b.type === 'spacer' ? h(Field, {
      key: 'he', label: 'Alto', help: b.height + ' px',
    }, h('input', {
      type: 'range', min: 40, max: 700, step: 10, value: b.height, className: 'cz-range',
      onChange: (e) => set({ height: num(e.target.value) }),
    })) : null,

    b.type === 'items' ? h(Field, { key: 'si', label: 'Fotos de los ítems' }, h(Toggle, {
      checked: b.showImages, label: b.showImages ? 'Se muestran' : 'Solo texto',
      onChange: (v) => set({ showImages: v }),
    })) : null,

    meta.linked ? h(Field, { key: 'hv', label: 'Si no hay contenido' }, h(Toggle, {
      checked: b.hideEmpty, label: b.hideEmpty ? 'No se imprime el bloque' : 'Se imprime vacío',
      onChange: (v) => set({ hideEmpty: v }),
    })) : null,

    meta.linked ? h('div', { key: 'lk', className: 'cz-inspector-help' },
      'Este bloque toma su contenido de los datos de la cotización: edítalo en la pestaña Datos y aquí se actualiza solo.') : null,
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/80-export.js
// ══════════════════════════════════════════════════════════════════════
/* ══ EXPORTACIÓN: PDF Y ENLACE PÚBLICO ════════════════════════════════════
 *
 * Dos salidas del mismo documento:
 *
 *   PDF      Se abre una ventana, se renderiza en ella la MISMA hoja con los
 *            MISMOS componentes del lienzo y se llama a imprimir. El
 *            navegador ofrece "Guardar como PDF". No hay un segundo
 *            maquetador que pintar y mantener: lo que se ve en Diseño es
 *            exactamente lo que sale impreso.
 *   Enlace   La propuesta como página HTML autocontenida, subida a Archivos
 *            del tenant y servida por su URL pública. Sirve para mandar la
 *            cotización sin adjuntar nada, y es lo que enlaza el correo.
 *
 * La hoja impresa NO hereda el tema del escritorio: la ventana de impresión
 * no tiene los tokens del host, así que las variables CSS caen a sus
 * *fallbacks* —el tema claro— y el papel sale blanco con texto negro, que es
 * lo correcto en papel aunque KIMOS esté en modo noche.
 *
 * Nunca se construye HTML a mano con texto del usuario: la hoja la pinta
 * React (que escapa lo que pinta) y lo que se sube a Archivos es el
 * resultado ya renderizado.
 */

const BUNDLE_CSS_URL = API + '/api/apps/cotizaciones/bundle.css';

/**
 * Ajustes de papel. Van al `@page`, que es lo único que el navegador respeta
 * para el tamaño y los márgenes al imprimir.
 */
const PAPER_SIZES = [
  ['a4', 'A4 (210 × 297 mm)', 'A4'],
  ['letter', 'Carta (216 × 279 mm)', 'letter'],
  ['legal', 'Oficio (216 × 356 mm)', 'legal'],
];

function printCss(opts) {
  const o = isObj(opts) ? opts : {};
  const size = (PAPER_SIZES.find(([k]) => k === o.paper) || PAPER_SIZES[0])[2];
  const margin = clamp(Math.round(num(o.margin, 16)), 5, 40);
  return [
    '@page { size: ' + size + '; margin: ' + margin + 'mm; }',
    // El papel es blanco aunque KIMOS esté en modo noche: la ventana de
    // impresión no hereda los tokens del host y las variables caen a sus
    // fallbacks del tema claro.
    'html, body { background: #fff; margin: 0; padding: 0; }',
    'body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0d1117; }',
    '.cz-print { padding: 0; }',
    '.cz-print .cz-sheet { max-width: none; width: 100%; gap: 16px 18px; }',
    // Un bloque no se parte por la mitad entre dos páginas si cabe entero.
    '.cz-print .cz-cell { break-inside: avoid; }',
    '.cz-print .cz-b-table { break-inside: auto; }',
    '.cz-print .cz-b-table tr { break-inside: avoid; }',
    '.cz-print .cz-b-table thead { display: table-header-group; }',
    '.cz-print .cz-b-pagebreak { break-after: page; border: 0; height: 0; }',
    // La cabecera del documento se repite arriba de cada página impresa solo
    // si el usuario lo pide: por defecto encabeza una vez, como el original.
    o.repeatHeader ? '.cz-print .cz-b-header { position: running(header); }' : '',
    '@media screen { body { padding: 24px; background: #eceff3; }',
    '  .cz-print { max-width: 820px; margin: 0 auto; background: #fff; padding: 42px;',
    '    box-shadow: 0 4px 24px rgba(0,0,0,.12); border-radius: 4px; } }',
    '@media print { .cz-noprint { display: none !important; } }',
  ].filter(Boolean).join('\n');
}

/** Nombre de archivo de la propuesta: número, cliente y fecha. */
function nombreArchivo(doc) {
  const partes = [s(doc.number) || 'cotizacion', s(doc.client.name), s(doc.date)];
  return canon(partes.filter(Boolean).join(' ')).replace(/\s+/g, '-').slice(0, 80) || 'cotizacion';
}

/**
 * Renderiza la hoja dentro de un contenedor de OTRO documento. Sirve tanto
 * para la ventana de impresión como para el iframe oculto del que sale el
 * HTML publicable.
 */
function renderSheetInto(container, doc) {
  const RD = globalThis.ReactDOM;
  if (!RD) throw new Error('El host no expone ReactDOM: no es posible generar la hoja.');
  const el = h(Sheet, { doc, def: model.def, mode: 'print' });
  if (RD.createRoot) {
    const root = RD.createRoot(container);
    root.render(el);
    return () => { try { root.unmount(); } catch (e) { /* no-op */ } };
  }
  // React 17 y anteriores.
  RD.render(el, container);
  return () => { try { RD.unmountComponentAtNode(container); } catch (e) { /* no-op */ } };
}

/** Espera a que el árbol esté pintado, la hoja de estilos cargada y las fotos listas. */
async function esperarHoja(win, container, timeoutMs) {
  const limite = Date.now() + (timeoutMs || 6000);
  // 1. React pinta de forma asíncrona: se espera a que haya nodos.
  while (!container.childNodes.length && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 30));
  }
  // 2. Las hojas de estilo enlazadas, o el diseño sale sin maquetar.
  while (Date.now() < limite) {
    const links = Array.from(win.document.querySelectorAll('link[rel="stylesheet"]'));
    if (links.every((l) => l.sheet || l.dataset.failed === '1')) break;
    await new Promise((r) => setTimeout(r, 40));
  }
  // 3. Las imágenes: sin esto se imprimen huecos en blanco.
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
    const fin = () => res();
    img.addEventListener('load', fin, { once: true });
    img.addEventListener('error', fin, { once: true });
    setTimeout(fin, 4000);
  }))));
}

/**
 * Abre la ventana de impresión con la propuesta lista para "Guardar como PDF".
 *
 * Se abre SIN `noopener` a propósito: con esa opción `window.open` devuelve
 * null y no habría forma de escribir en la ventana ni de lanzar la impresión.
 */
async function exportarPdf(doc, opts) {
  const o = isObj(opts) ? opts : {};
  let win = null;
  try { win = window.open('', '_blank', 'width=900,height=1200'); } catch (e) { win = null; }
  if (!win) {
    shell.notify({ level: 'warn', text: 'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.' });
    return false;
  }

  const d = win.document;
  d.title = nombreArchivo(doc);
  const meta = d.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  d.head.appendChild(meta);

  // Los estilos de los bloques son LOS MISMOS del lienzo: se enlaza la hoja
  // publicada de la app en vez de copiarlos, para que no puedan divergir.
  const link = d.createElement('link');
  link.rel = 'stylesheet';
  link.href = BUNDLE_CSS_URL;
  link.addEventListener('error', () => { link.dataset.failed = '1'; });
  d.head.appendChild(link);

  const style = d.createElement('style');
  style.textContent = printCss(o);
  d.head.appendChild(style);

  const root = d.createElement('div');
  root.className = 'kimos-cotizaciones cz-print';
  d.body.appendChild(root);

  try {
    renderSheetInto(root, doc);
    await esperarHoja(win, root);
    win.focus();
    setTimeout(() => { try { win.print(); } catch (e) { /* el usuario puede imprimir a mano */ } }, 120);
    return true;
  } catch (e) {
    // La ventana queda abierta con el error a la vista: cerrarla dejaría a la
    // persona sin saber qué pasó.
    root.textContent = 'No se pudo preparar la propuesta: ' + ((e && e.message) || 'error desconocido');
    shell.notify({ level: 'error', text: (e && e.message) || 'No se pudo preparar el PDF.' });
    return false;
  }
}

/**
 * Publica la propuesta como página HTML en Archivos del tenant y devuelve su
 * URL pública.
 *
 * La hoja se pinta en un iframe oculto con los mismos componentes y se
 * serializa el resultado. El CSS se descarga y se EMBEBE, de modo que la
 * página siga viéndose igual dentro de un año aunque la app haya cambiado de
 * versión: lo que se le mandó al cliente no se altera solo.
 */
async function publicarPropuesta(doc, opts) {
  const o = isObj(opts) ? opts : {};
  const html = await construirHtmlPropuesta(doc, o);
  const nombre = nombreArchivo(doc) + '.html';
  const archivo = new File([html], nombre, { type: 'text/html' });

  // Por `shell.files` cuando el host lo tenga: la ruta la decide él y así la
  // propuesta publicada queda en el espacio de esta app, con cuota atribuible
  // y limpieza al desinstalar (APP-SPEC §7.e).
  if (shell.files && typeof shell.files.upload === 'function') {
    return shell.files.upload(archivo, { folder: 'propuestas', maxMB: 10 });
  }

  // Respaldo para un host anterior: la app elige la ruta.
  if (!shell.authFetch) throw new Error('Este host no permite subir archivos.');
  const path = 'imagenes/cotizaciones/propuestas/' + nombreArchivo(doc) + '-'
    + Date.now().toString(36) + '.html';
  const fd = new FormData();
  fd.append('path', path);
  fd.append('file', new File([html], path.split('/').pop(), { type: 'text/html' }));
  const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
  if (!res.ok) {
    const detalle = await res.json().catch(() => ({}));
    throw new Error(s(detalle.detail) || 'No se pudo publicar (HTTP ' + res.status + ').');
  }
  return API + '/api/public/files/' + path;
}

/**
 * La propuesta como documento HTML autocontenido. La misma pieza sirve para
 * publicarla como enlace y para adjuntarla a un correo.
 */
async function construirHtmlPropuesta(doc, opts) {
  const o = isObj(opts) ? opts : {};
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;';
  document.body.appendChild(iframe);
  let limpiar = null;
  try {
    const idoc = iframe.contentDocument;
    const root = idoc.createElement('div');
    root.className = 'kimos-cotizaciones cz-print';
    idoc.body.appendChild(root);
    limpiar = renderSheetInto(root, doc);
    await esperarHoja(iframe.contentWindow, root, 4000);

    let css = '';
    try {
      const res = await fetch(BUNDLE_CSS_URL, { cache: 'no-store' });
      if (res.ok) css = await res.text();
    } catch (e) { /* sin la hoja publicada quedan los estilos de impresión */ }

    // El cuerpo es la salida de React, que escapa todo lo que pinta: aquí no
    // se concatena texto del usuario dentro del HTML.
    const html = [
      '<!doctype html>',
      '<html lang="es"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + escapeHtml(s(doc.number) + ' · ' + s(doc.name)) + '</title>',
      '<style>' + css + '</style>',
      '<style>' + printCss(o) + '</style>',
      '</head><body>',
      '<div class="kimos-cotizaciones cz-print">' + root.innerHTML + '</div>',
      '</body></html>',
    ].join('\n');

    return html;
  } finally {
    if (limpiar) limpiar();
    iframe.remove();
  }
}

/** Escapado mínimo para los pocos textos que sí van dentro del HTML (el título). */
function escapeHtml(v) {
  return s(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Acciones ────────────────────────────────────────────────────────────
/** Exporta la cotización a PDF y lo anota en su historial. */
async function actExportPdf(quoteId, opts) {
  const doc = docById(s(quoteId));
  if (!doc) return false;
  const ok = await exportarPdf(doc, Object.assign({}, exportOpts(), opts));
  if (ok) commitDoc(doc.id, (d) => logEvent(d, 'export', 'Exportada a PDF'), { meta: false });
  return ok;
}

/** Publica la propuesta y guarda su enlace en el documento. */
async function actPublishQuote(quoteId, opts) {
  const doc = docById(s(quoteId));
  if (!doc) return '';
  try {
    const url = await publicarPropuesta(doc, Object.assign({}, exportOpts(), opts));
    commitDoc(doc.id, (d) => {
      d.publicUrl = url;
      d.publishedAt = stamp();
      return logEvent(d, 'publish', 'Propuesta publicada como enlace');
    });
    shell.notify({ level: 'success', text: 'Propuesta publicada: el enlace queda en la cotización.' });
    return url;
  } catch (e) {
    shell.notify({ level: 'error', text: (e && e.message) || 'No se pudo publicar la propuesta.' });
    return '';
  }
}

/** Preferencias de papel del cotizador (viven con las demás reglas). */
function exportOpts() {
  const r = rulesOf();
  return { paper: r.paper, margin: r.pageMargin, repeatHeader: false };
}

// ── Vista previa ────────────────────────────────────────────────────────
/** La propuesta tal como se imprimirá, sin salir de la app. */
function PreviewModal(props) {
  const { m, doc, onClose } = props;
  const [ocupado, setOcupado] = useState('');
  return h(Modal, {
    open: true, wide: true, full: true, title: 'Vista previa · ' + (doc.number || doc.name), onClose,
    footer: [
      doc.publicUrl ? h('a', {
        key: 'l', className: 'cz-link', href: doc.publicUrl, target: '_blank', rel: 'noopener noreferrer',
      }, 'Ver el enlace publicado') : null,
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, {
        key: 'p', disabled: !!ocupado,
        title: 'Sube la propuesta a Archivos y devuelve un enlace público para mandársela al cliente',
        onClick: async () => { setOcupado('pub'); await actPublishQuote(doc.id); setOcupado(''); },
      }, ocupado === 'pub' ? 'Publicando…' : '🔗 Publicar enlace'),
      h(Btn, {
        key: 'x', variant: 'primary', disabled: !!ocupado,
        onClick: async () => { setOcupado('pdf'); await actExportPdf(doc.id); setOcupado(''); },
      }, '⬇ Exportar PDF'),
    ],
  }, h('div', { className: 'cz-preview' }, h(Sheet, { doc, def: m.def, mode: 'preview' })));
}

// ══════════════════════════════════════════════════════════════════════
// src/85-mail.js
// ══════════════════════════════════════════════════════════════════════
/* ══ CORREO ═══════════════════════════════════════════════════════════════
 *
 * Mandar la cotización por correo con el SMTP del tenant
 * (`POST /api/integrations/email/send`), desde plantillas de correo
 * editables y reutilizables con variables.
 *
 * Sobre el adjunto, que tiene una limitación real que conviene tener a la
 * vista: el PDF lo produce el diálogo de impresión del navegador y lo
 * escribe el usuario en su disco — la página NO recibe ese archivo, así que
 * la app no puede adjuntarlo sola. De ahí los tres caminos, por orden de
 * comodidad:
 *
 *   1. Enlace a la propuesta publicada. Siempre funciona, no pesa, y el
 *      cliente ve la propuesta tal cual en el navegador.
 *   2. La propuesta como archivo HTML autocontenido, generada aquí mismo y
 *      adjuntada con un clic.
 *   3. El PDF: se exporta primero (👁 Vista previa → Exportar PDF), se
 *      guarda, y se adjunta desde el disco con «Añadir archivo».
 */

const MAIL_SEND_URL = API + '/api/integrations/email/send';
const MAIL_STATUS_URL = API + '/api/integrations/email/status';

/**
 * Variables de las plantillas. Cada una sabe resolverse desde la cotización,
 * así que la plantilla se escribe una vez y sirve para todas.
 */
const MAIL_VARS = [
  ['cliente', 'Nombre del cliente', (d) => s(d.client.name)],
  ['contacto', 'Persona de contacto', (d) => s(d.client.contact) || s(d.client.name)],
  ['numero', 'Número de la cotización', (d) => s(d.number)],
  ['titulo', 'Nombre de la cotización', (d) => s(d.name)],
  ['asunto', 'Asunto de la propuesta', (d) => s(d.subtitle)],
  ['fecha', 'Fecha de emisión', (d) => fechaLarga(d.date)],
  ['validez', 'Fecha de vencimiento', (d, c) => fechaLarga(c.until)],
  ['dias', 'Días de vigencia que quedan', (d, c) => {
    const n = diasHasta(c.until);
    return n == null ? '' : String(Math.max(0, n));
  }],
  ['total', 'Total con impuesto', (d, c) => money(c.totals.total, c.cur)],
  ['neto', 'Total neto', (d, c) => money(c.totals.net, c.cur)],
  ['abono', 'Abono', (d, c) => (c.totals.advanceEnabled ? money(c.totals.advance, c.cur) : '')],
  ['saldo', 'Saldo', (d, c) => (c.totals.advanceEnabled ? money(c.totals.balance, c.cur) : '')],
  ['emisor', 'Razón social del emisor', (d, c) => s(c.issuer.name)],
  ['firma', 'Firma del emisor', (d, c) => [s(c.issuer.name), s(c.issuer.email), s(c.issuer.phone)].filter(Boolean).join('\n')],
  ['enlace', 'Enlace a la propuesta publicada', (d) => s(d.publicUrl)],
  ['yo', 'Quien envía', () => meLabel()],
];
const MAIL_VAR_MAP = new Map(MAIL_VARS.map(([k, , fn]) => [k, fn]));

/**
 * Sustituye `{{variable}}` por su valor. Una variable desconocida se deja
 * como está a propósito: es más fácil ver el error en la previsualización
 * que descubrir un hueco en blanco en el correo que ya salió.
 */
function aplicarVars(texto, doc, ctx) {
  return s(texto).replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (todo, clave) => {
    const fn = MAIL_VAR_MAP.get(s(clave).toLowerCase());
    return fn ? s(fn(doc, ctx)) : todo;
  });
}

/** Resuelve una plantilla contra una cotización: lo que se va a mandar. */
function resolverCorreo(tpl, doc) {
  const t = normalizeMail(tpl || {});
  const ctx = contextoDe(doc, model.def);
  const r = (v) => aplicarVars(v, doc, ctx);
  return {
    templateId: t.id,
    to: r(t.to) || s(doc.client.email),
    cc: r(t.cc),
    bcc: r(t.bcc),
    replyTo: r(t.replyTo) || s(ctx.issuer.email),
    subject: r(t.subject) || ((s(doc.number) ? s(doc.number) + ' · ' : '') + s(doc.name)),
    body: r(t.body),
    attachProposal: t.attachProposal,
    includeLink: t.includeLink,
  };
}

/**
 * Cuerpo del correo en HTML.
 *
 * Se arma con `escapeHtml()` en cada trozo de texto de la persona, no
 * dejándoselo al navegador: así la función no depende del DOM (se puede
 * probar), y el escapado es explícito y está a la vista de quien lea esto en
 * vez de ser un efecto secundario de `textContent`.
 */
function cuerpoHtml(texto, enlace, etiquetaEnlace) {
  const partes = ['<div style="font: 14px/1.65 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #16181d;">'];
  for (const linea of s(texto).split(/\n/)) {
    partes.push('<div>' + (escapeHtml(linea) || '&nbsp;') + '</div>');
  }
  const url = s(enlace).trim();
  // Solo http(s): un `javascript:` en el href de un correo no tiene por qué
  // llegar nunca, aunque los clientes de correo lo ignoren.
  if (/^https?:\/\//i.test(url)) {
    partes.push(
      '<div style="margin-top: 22px;">'
      + '<a href="' + escapeHtml(url) + '"'
      + ' style="display: inline-block; padding: 11px 20px; border-radius: 6px;'
      + ' background: #16181d; color: #fff; text-decoration: none; font-weight: 600;">'
      + escapeHtml(s(etiquetaEnlace) || 'Ver la propuesta')
      + '</a></div>',
    );
  }
  partes.push('</div>');
  return partes.join('');
}

// ── Estado de la integración ────────────────────────────────────────────
/**
 * ¿Está configurado el correo del tenant? Se consulta una vez y se cachea:
 * la respuesta decide si el botón de enviar se ofrece o se explica por qué
 * no, en vez de fallar al pulsarlo.
 */
let mailStatusCache = null;
async function mailStatus(force) {
  if (mailStatusCache && !force) return mailStatusCache;
  if (!shell.authFetch) {
    mailStatusCache = { configured: false, reason: 'Este host no permite llamar al backend.' };
    return mailStatusCache;
  }
  try {
    const res = await shell.authFetch(MAIL_STATUS_URL, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    mailStatusCache = res.ok && data.configured
      ? { configured: true, fromEmail: s(data.fromEmail), fromName: s(data.fromName) }
      : { configured: false, reason: 'El correo del tenant no está configurado. Un superadministrador lo activa en Ajustes → Integraciones → Email.' };
  } catch (e) {
    mailStatusCache = { configured: false, reason: 'No se pudo consultar la integración de correo.' };
  }
  return mailStatusCache;
}

// ── Acciones ────────────────────────────────────────────────────────────
const actUpsertMailTemplate = (tpl) => (isObj(tpl) ? upsertMail(tpl) : null);
const actRemoveMailTemplate = (id) => removeMail(s(id));
const defaultMailTemplate = () => model.mails.find((m) => m.isDefault) || model.mails[0] || null;

function actSetDefaultMailTemplate(id) {
  const target = s(id);
  for (const m of model.mails) {
    const debe = m.id === target;
    if (m.isDefault !== debe) upsertMail(Object.assign({}, m, { isDefault: debe }));
  }
  return mailById(target);
}

/** Deja preparado en la cotización el correo con el que va a salir. */
function actPrepareMail(quoteId, templateId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const tpl = templateId ? mailById(s(templateId)) : defaultMailTemplate();
  const correo = resolverCorreo(tpl, doc);
  actPatchDoc(doc.id, { mail: correo });
  return correo;
}

/**
 * Envía la cotización. `payload` es lo que se ve en el diálogo, ya resuelto:
 * lo que se manda es exactamente lo que la persona leyó antes de pulsar.
 */
async function actSendMail(quoteId, payload) {
  const doc = docById(s(quoteId));
  if (!doc) return { ok: false, error: 'La cotización ya no existe.' };
  const p = isObj(payload) ? payload : {};

  const to = s(p.to).trim();
  if (!to) return { ok: false, error: 'Falta el destinatario.' };
  const subject = s(p.subject).trim();
  if (!subject) return { ok: false, error: 'Falta el asunto.' };

  const estado = await mailStatus();
  if (!estado.configured) return { ok: false, error: estado.reason };

  const enlace = p.includeLink ? s(p.link || doc.publicUrl) : '';
  const cuerpo = {
    to,
    cc: s(p.cc),
    bcc: s(p.bcc),
    replyTo: s(p.replyTo),
    subject,
    text: s(p.body) + (enlace ? '\n\n' + enlace : ''),
    html: cuerpoHtml(p.body, enlace, p.linkLabel),
    attachments: arr(p.attachments).map((a) => ({
      filename: s(a.filename),
      contentType: s(a.contentType) || 'application/octet-stream',
      contentBase64: s(a.contentBase64),
    })),
  };

  try {
    const res = await shell.authFetch(MAIL_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: s(data.detail) || 'No se pudo enviar (HTTP ' + res.status + ').' };

    const destinos = [to, s(p.cc)].filter(Boolean).join(', ');
    commitDoc(doc.id, (d) => {
      d.mail = Object.assign({}, isObj(d.mail) ? d.mail : {}, {
        to, cc: s(p.cc), subject, body: s(p.body), sentAt: stamp(), sentBy: meLabel(),
      });
      return logEvent(d, 'mail', 'Enviada por correo a ' + destinos
        + (arr(p.attachments).length ? ' · ' + arr(p.attachments).length + ' adjunto(s)' : '')
        + (enlace ? ' · con enlace' : ''));
    });
    // Mandar una cotización es, justamente, enviarla: el estado lo refleja.
    if (doc.status === 'draft') actSetStatus(doc.id, 'sent', 'por correo');
    shell.notify({ level: 'success', text: 'Cotización enviada a ' + to });
    return { ok: true, to };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'No se pudo enviar el correo.' };
  }
}

// ── Pestaña Correos ─────────────────────────────────────────────────────
function MailsTab(props) {
  const m = props.m;
  const [editando, setEditando] = useState(null);
  const [estado, setEstado] = useState(null);
  const [ask, confirmNode] = useConfirm();
  useEffect(() => { mailStatus().then(setEstado); }, []);

  const banner = estado ? h('div', {
    className: cx('cz-banner', estado.configured ? 'ok' : 'warn'),
  }, estado.configured
    ? 'El correo del tenant está configurado: los envíos salen desde ' + (estado.fromEmail || 'el buzón de la empresa') + '.'
    : estado.reason) : null;

  return h('div', { className: 'cz-tab' }, [
    banner,
    h('div', { key: 'bar', className: 'cz-listbar' }, [
      h('span', { key: 't', className: 'cz-card-note' },
        'Plantillas reutilizables para mandar cotizaciones. Las variables se sustituyen al enviar.'),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, { key: 'n', variant: 'primary', onClick: () => setEditando(normalizeMail({})) }, '+ Nueva plantilla'),
    ]),
    !m.mails.length
      ? h(Empty, {
        key: 'e', icon: '✉️',
        title: 'Aún no hay plantillas de correo',
        text: 'Escribe una vez el correo con el que mandas las cotizaciones —con variables como {{cliente}} o {{total}}— y reutilízalo en todas.',
        action: h('div', { className: 'cz-inline' }, [
          h(Btn, { key: 'n', variant: 'primary', onClick: () => setEditando(normalizeMail({})) }, 'Crear plantilla'),
          h(Btn, { key: 'e', onClick: () => setEditando(normalizeMail(plantillaCorreoEjemplo())) }, 'Empezar desde un ejemplo'),
        ]),
      })
      : h('div', { key: 'l', className: 'cz-tablewrap' }, h('table', { className: 'cz-table' }, [
        h('thead', { key: 'h' }, h('tr', null, [
          h('th', { key: 'n', className: 'cz-th' }, 'Plantilla'),
          h('th', { key: 's', className: 'cz-th' }, 'Asunto'),
          h('th', { key: 'a', className: 'cz-th cz-th-acts' }, ''),
        ])),
        h('tbody', { key: 'b' }, m.mails.map((t) => h('tr', {
          key: t.id, className: 'cz-tr', onClick: () => setEditando(t),
        }, [
          h('td', { key: 'n' }, [
            h('div', { key: 'a', className: 'cz-cell-title' }, [
              t.name,
              t.isDefault ? h('span', { key: 'd', className: 'cz-star', title: 'Plantilla de correo predeterminada' }, ' ⭐') : null,
            ]),
            h('div', { key: 'b', className: 'cz-cell-sub' }, [
              t.attachProposal ? 'adjunta la propuesta' : null,
              t.includeLink ? 'incluye el enlace' : null,
            ].filter(Boolean).join(' · ')),
          ]),
          h('td', { key: 's', className: 'cz-dim' }, t.subject || '—'),
          h('td', { key: 'a', className: 'cz-td-acts', onClick: (e) => e.stopPropagation() }, [
            h(IconBtn, {
              key: 'd', icon: t.isDefault ? '⭐' : '☆',
              className: t.isDefault ? 'on' : '',
              title: t.isDefault ? 'Es la predeterminada' : 'Usar como predeterminada al enviar',
              onClick: () => actSetDefaultMailTemplate(t.isDefault ? '' : t.id),
            }),
            h(IconBtn, {
              key: 'x', icon: '🗑', title: 'Eliminar plantilla',
              onClick: async () => {
                const ok = await ask({ title: 'Eliminar plantilla', danger: true, okLabel: 'Eliminar', text: '¿Eliminar «' + t.name + '»?' });
                if (ok) actRemoveMailTemplate(t.id);
              },
            }),
          ]),
        ]))),
      ])),
    editando ? h(MailTemplateModal, {
      key: 'ed', tpl: editando, m,
      onClose: () => setEditando(null),
      onSave: (t) => { actUpsertMailTemplate(t); setEditando(null); },
    }) : null,
    confirmNode,
  ]);
}

/** Un punto de partida razonable, para no mirar un cuadro en blanco. */
function plantillaCorreoEjemplo() {
  return {
    name: 'Envío de cotización',
    subject: 'Cotización {{numero}} · {{emisor}}',
    body: 'Estimado/a {{contacto}}:\n\n'
      + 'Junto con saludar, adjuntamos la cotización {{numero}} por un total de {{total}}, '
      + 'con vigencia hasta el {{validez}}.\n\n'
      + 'Quedamos atentos a sus comentarios.\n\n'
      + 'Saludos cordiales,\n{{firma}}',
    includeLink: true,
    attachProposal: false,
  };
}

function MailTemplateModal(props) {
  const { tpl, onClose, onSave } = props;
  const [t, setT] = useState(() => normalizeMail(tpl));
  const set = (p) => setT(Object.assign({}, t, p));
  const bodyRef = useRef(null);

  /** Inserta la variable donde está el cursor del cuerpo. */
  const insertar = (clave) => {
    const el = bodyRef.current;
    const token = '{{' + clave + '}}';
    if (!el || el.selectionStart == null) { set({ body: t.body + token }); return; }
    const i = el.selectionStart;
    const j = el.selectionEnd;
    set({ body: t.body.slice(0, i) + token + t.body.slice(j) });
    setTimeout(() => { try { el.focus(); el.setSelectionRange(i + token.length, i + token.length); } catch (e) { /* no-op */ } }, 0);
  };

  return h(Modal, {
    open: true, wide: true, title: tpl.name ? 'Editar plantilla de correo' : 'Nueva plantilla de correo', onClose,
    footer: [
      h(Btn, { key: 'c', onClick: onClose }, 'Cancelar'),
      h(Btn, { key: 's', variant: 'primary', disabled: !s(t.name).trim(), onClick: () => onSave(t) }, 'Guardar'),
    ],
  }, [
    h('div', { key: 'g', className: 'cz-grid2' }, [
      h(Field, { key: 'n', label: 'Nombre de la plantilla' },
        h(Input, { value: t.name, autoFocus: true, placeholder: 'Envío de cotización', onChange: (e) => set({ name: e.target.value }) })),
      h(Field, { key: 'to', label: 'Para', help: 'Vacío = el correo del cliente de la cotización.' },
        h(Input, { value: t.to, placeholder: '{{cliente}}', onChange: (e) => set({ to: e.target.value }) })),
      h(Field, { key: 'cc', label: 'Copia (Cc)' },
        h(Input, { value: t.cc, placeholder: 'ventas@empresa.cl', onChange: (e) => set({ cc: e.target.value }) })),
      h(Field, { key: 'bcc', label: 'Copia oculta (Cco)' },
        h(Input, { value: t.bcc, placeholder: 'registro@empresa.cl', onChange: (e) => set({ bcc: e.target.value }) })),
      h(Field, { key: 'rt', label: 'Responder a', help: 'Vacío = el correo del emisor.' },
        h(Input, { value: t.replyTo, onChange: (e) => set({ replyTo: e.target.value }) })),
      h(Field, { key: 's', label: 'Asunto', wide: true },
        h(Input, { value: t.subject, placeholder: 'Cotización {{numero}} · {{emisor}}', onChange: (e) => set({ subject: e.target.value }) })),
      h(Field, { key: 'b', label: 'Cuerpo', wide: true },
        h('textarea', {
          ref: bodyRef, className: 'cz-in cz-mailbody', rows: 10, value: t.body,
          placeholder: 'Estimado/a {{contacto}}: …',
          onChange: (e) => set({ body: e.target.value }),
        })),
    ]),
    h('div', { key: 'v', className: 'cz-vars' }, [
      h('div', { key: 't', className: 'cz-vars-t' }, 'Variables — pulsa para insertarla donde esté el cursor'),
      h('div', { key: 'l', className: 'cz-vars-l' }, MAIL_VARS.map(([k, label]) => h(Chip, {
        key: k, title: label, onClick: () => insertar(k),
      }, '{{' + k + '}}'))),
    ]),
    h('div', { key: 'o', className: 'cz-grid2' }, [
      h(Field, { key: 'l', label: 'Enlace a la propuesta' }, h(Toggle, {
        checked: t.includeLink, label: t.includeLink ? 'Se añade un botón al final' : 'Sin enlace',
        onChange: (v) => set({ includeLink: v }),
      })),
      h(Field, { key: 'a', label: 'Adjuntar la propuesta' }, h(Toggle, {
        checked: t.attachProposal, label: t.attachProposal ? 'Se adjunta como archivo HTML' : 'Sin adjunto automático',
        onChange: (v) => set({ attachProposal: v }),
      })),
    ]),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/87-send.js
// ══════════════════════════════════════════════════════════════════════
/* ══ DIÁLOGO DE ENVÍO ═════════════════════════════════════════════════════
 *
 * Lo último que ve la persona antes de que el correo salga, así que muestra
 * exactamente lo que se va a mandar: destinatarios, asunto, cuerpo ya con las
 * variables sustituidas y la lista de adjuntos.
 *
 * Sobre el adjunto, otra vez porque es la duda que aparece siempre: el PDF lo
 * genera el diálogo de impresión del navegador y lo guarda el usuario en su
 * disco — la página nunca lo recibe. Por eso se ofrece adjuntar la propuesta
 * como HTML de un clic (eso sí se puede generar aquí), enlazarla publicada, o
 * añadir a mano el PDF que se acaba de exportar.
 */

/** Lee un archivo del disco como base64, que es como viaja el adjunto. */
function leerArchivoBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const res = s(fr.result);
      resolve({
        filename: s(file.name) || 'adjunto',
        contentType: s(file.type) || 'application/octet-stream',
        contentBase64: res.indexOf(',') >= 0 ? res.slice(res.indexOf(',') + 1) : res,
        size: file.size,
      });
    };
    fr.onerror = () => reject(new Error('No se pudo leer ' + s(file.name)));
    fr.readAsDataURL(file);
  });
}

const MAX_ADJUNTO_MB = 10;
const MAX_TOTAL_MB = 20;
const pesoTotal = (lista) => arr(lista).reduce((a, x) => a + num(x.size), 0);
const enMb = (bytes) => (num(bytes) / (1024 * 1024)).toFixed(1);

function SendMailModal(props) {
  const { m, doc, onClose } = props;
  const [estado, setEstado] = useState(null);
  const [tplId, setTplId] = useState(() => {
    const d = defaultMailTemplate();
    return d ? d.id : '';
  });
  const [correo, setCorreo] = useState(() => resolverCorreo(defaultMailTemplate(), doc));
  const [adjuntos, setAdjuntos] = useState([]);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [verHtml, setVerHtml] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { mailStatus().then(setEstado); }, []);

  const set = (p) => setCorreo(Object.assign({}, correo, p));
  const cambiarPlantilla = (id) => {
    setTplId(id);
    setCorreo(resolverCorreo(id ? mailById(id) : null, doc));
  };

  const añadirArchivos = async (files) => {
    setError('');
    const nuevos = [];
    for (const f of Array.from(files || [])) {
      if (f.size > MAX_ADJUNTO_MB * 1024 * 1024) {
        setError('«' + f.name + '» pesa ' + enMb(f.size) + ' MB y el máximo por adjunto es ' + MAX_ADJUNTO_MB + ' MB.');
        continue;
      }
      try { nuevos.push(await leerArchivoBase64(f)); } catch (e) { setError(e.message); }
    }
    const total = pesoTotal(adjuntos) + pesoTotal(nuevos);
    if (total > MAX_TOTAL_MB * 1024 * 1024) {
      setError('Los adjuntos suman ' + enMb(total) + ' MB y el máximo es ' + MAX_TOTAL_MB + ' MB.');
      return;
    }
    setAdjuntos(adjuntos.concat(nuevos));
  };

  /** Genera la propuesta como HTML autocontenido y la deja adjunta. */
  const adjuntarPropuesta = async () => {
    setOcupado('html');
    setError('');
    try {
      const html = await construirHtmlPropuesta(doc, exportOpts());
      const bytes = new TextEncoder().encode(html);
      let bin = '';
      // En trozos: con una propuesta grande, un solo apply desborda la pila.
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      setAdjuntos(adjuntos.concat([{
        filename: nombreArchivo(doc) + '.html',
        contentType: 'text/html',
        contentBase64: btoa(bin),
        size: bytes.length,
      }]));
    } catch (e) {
      setError((e && e.message) || 'No se pudo generar la propuesta.');
    } finally { setOcupado(''); }
  };

  const publicar = async () => {
    setOcupado('link');
    const url = await actPublishQuote(doc.id);
    setOcupado('');
    if (url) set({ includeLink: true });
  };

  const enviar = async () => {
    setOcupado('send');
    setError('');
    const res = await actSendMail(doc.id, Object.assign({}, correo, {
      attachments: adjuntos,
      link: doc.publicUrl,
      linkLabel: 'Ver la propuesta ' + (doc.number || ''),
    }));
    setOcupado('');
    if (res.ok) onClose();
    else setError(res.error);
  };

  const enlaceListo = !!s(doc.publicUrl);
  const puedeEnviar = estado && estado.configured && s(correo.to).trim() && s(correo.subject).trim() && !ocupado;

  return h(Modal, {
    open: true, wide: true, title: 'Enviar por correo · ' + (doc.number || doc.name), onClose,
    footer: [
      error ? h('span', { key: 'e', className: 'cz-send-err' }, error) : null,
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, { key: 'c', onClick: onClose }, 'Cancelar'),
      h(Btn, {
        key: 's', variant: 'primary', disabled: !puedeEnviar, onClick: enviar,
      }, ocupado === 'send' ? 'Enviando…' : '✉ Enviar ahora'),
    ],
  }, [
    estado && !estado.configured
      ? h('div', { key: 'w', className: 'cz-banner warn' }, estado.reason)
      : null,
    estado && estado.configured
      ? h('div', { key: 'f', className: 'cz-banner ok' }, 'Sale desde ' + (estado.fromEmail || 'el buzón de la empresa') + ' (SMTP del tenant).')
      : null,

    h('div', { key: 'g', className: 'cz-grid2' }, [
      h(Field, { key: 't', label: 'Plantilla' }, h(Select, {
        value: tplId, onChange: (e) => cambiarPlantilla(e.target.value),
        options: [{ value: '', label: m.mails.length ? 'Sin plantilla (escribir a mano)' : 'No hay plantillas todavía' }]
          .concat(m.mails.map((x) => ({ value: x.id, label: x.name + (x.isDefault ? ' ⭐' : '') }))),
      })),
      h(Field, { key: 'to', label: 'Para' },
        h(Input, {
          value: correo.to, placeholder: 'cliente@empresa.cl',
          invalid: !!s(correo.to).trim() && s(correo.to).indexOf('@') === -1,
          onChange: (e) => set({ to: e.target.value }),
        })),
      h(Field, { key: 'cc', label: 'Copia (Cc)' },
        h(Input, { value: correo.cc, onChange: (e) => set({ cc: e.target.value }) })),
      h(Field, { key: 'bcc', label: 'Copia oculta (Cco)' },
        h(Input, { value: correo.bcc, onChange: (e) => set({ bcc: e.target.value }) })),
      h(Field, { key: 'rt', label: 'Responder a' },
        h(Input, { value: correo.replyTo, onChange: (e) => set({ replyTo: e.target.value }) })),
      h(Field, { key: 's', label: 'Asunto', wide: true },
        h(Input, { value: correo.subject, onChange: (e) => set({ subject: e.target.value }) })),
      h(Field, { key: 'b', label: 'Mensaje', wide: true },
        h('textarea', {
          className: 'cz-in cz-mailbody', rows: 10, value: correo.body,
          placeholder: 'Escribe el mensaje…',
          onChange: (e) => set({ body: e.target.value }),
        })),
    ]),

    // ── La propuesta: enlace y adjuntos ──────────────────────────────
    h('div', { key: 'adj', className: 'cz-send-adj' }, [
      h('div', { key: 't', className: 'cz-vars-t' }, 'La propuesta'),
      h('div', { key: 'l', className: 'cz-inline' }, [
        h(Toggle, {
          key: 'lk', checked: !!correo.includeLink && enlaceListo, disabled: !enlaceListo,
          label: enlaceListo ? 'Incluir el botón con el enlace publicado' : 'Aún no está publicada',
          onChange: (v) => set({ includeLink: v }),
        }),
        h(Btn, {
          key: 'pb', size: 'sm', disabled: !!ocupado, onClick: publicar,
        }, ocupado === 'link' ? 'Publicando…' : (enlaceListo ? '🔗 Volver a publicar' : '🔗 Publicar enlace')),
        h(Btn, {
          key: 'ht', size: 'sm', disabled: !!ocupado, onClick: adjuntarPropuesta,
          title: 'Genera la propuesta como archivo HTML autocontenido y la adjunta',
        }, ocupado === 'html' ? 'Generando…' : '📎 Adjuntar propuesta (HTML)'),
        h(Btn, {
          key: 'fi', size: 'sm', disabled: !!ocupado,
          onClick: () => fileRef.current && fileRef.current.click(),
        }, '📎 Añadir archivo…'),
        h('input', {
          key: 'in', ref: fileRef, type: 'file', multiple: true, style: { display: 'none' },
          onChange: (e) => { void añadirArchivos(e.target.files); e.target.value = ''; },
        }),
      ]),
      adjuntos.length ? h('ul', { key: 'ls', className: 'cz-adjlist' }, adjuntos.map((a, i) => h('li', { key: i, className: 'cz-adj' }, [
        h('span', { key: 'n', className: 'cz-adj-n' }, a.filename),
        h('span', { key: 's', className: 'cz-adj-s cz-mono' }, enMb(a.size) + ' MB'),
        h(IconBtn, { key: 'x', icon: '✕', title: 'Quitar adjunto', onClick: () => setAdjuntos(adjuntos.filter((_, j) => j !== i)) }),
      ]))) : null,
      h('div', { key: 'h', className: 'cz-inspector-help' },
        'El PDF lo genera el diálogo de impresión del navegador y lo guardas tú en tu disco: la app no lo recibe, '
        + 'así que para adjuntarlo, expórtalo primero desde 👁 Vista previa y añádelo con «Añadir archivo». '
        + 'El enlace y el HTML sí se generan aquí.'),
    ]),

    // ── Cómo se verá ─────────────────────────────────────────────────
    h('div', { key: 'pv', className: 'cz-send-prev' }, [
      h('button', {
        key: 'b', type: 'button', className: 'cz-send-prev-t', onClick: () => setVerHtml(!verHtml),
      }, (verHtml ? '▾ ' : '▸ ') + 'Cómo lo verá el cliente'),
      verHtml ? h('div', { key: 'p', className: 'cz-send-prev-body' }, [
        h('div', { key: 's', className: 'cz-send-prev-sub' }, correo.subject),
        ...s(correo.body).split('\n').map((linea, i) => h('div', { key: 'l' + i }, linea || ' ')),
        correo.includeLink && enlaceListo
          ? h('div', { key: 'cta', className: 'cz-send-prev-cta' }, 'Ver la propuesta ' + (doc.number || ''))
          : null,
      ]) : null,
    ]),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/88-board.js
// ══════════════════════════════════════════════════════════════════════
/* ══ SEGUIMIENTO ══════════════════════════════════════════════════════════
 *
 * El tablero para gestionar el embudo: qué hay, cuánto vale, qué vence y qué
 * pide atención hoy.
 *
 * Decisiones de visualización, en el orden en que se toman:
 *
 * 1. FORMA ANTES QUE COLOR. Las cifras de cabecera son números sueltos, así
 *    que van como fichas de dato (KPI), no como un gráfico de una barra. El
 *    reparto por estado es magnitud comparada → barras. La evolución mensual
 *    es una serie temporal → columnas. Lo que pide atención es una lista, no
 *    un gráfico.
 *
 * 2. NI UNA PALETA CATEGÓRICA. La tentación era pintar cada estado de un
 *    color, pero eso pone verde («ganada») y rojo («perdida») a distinguir el
 *    dato más importante del tablero, y ese par tiene una separación de ΔE 4
 *    bajo deuteranopia: para una parte de las personas son el mismo color.
 *    Así que la magnitud la codifica la LONGITUD de la barra en un solo tono
 *    y la identidad la llevan la etiqueta y el chip de estado, que ya son
 *    texto. Nadie depende del color para leer el tablero.
 *
 * 3. EL TONO SALE DE LA TINTA DEL TEMA, no del acento. El acento de KIMOS es
 *    un cian claro: como relleno sobre fondo claro no llega a 3:1 de
 *    contraste. Derivar la barra de `--foreground` garantiza el contraste en
 *    modo día y en modo noche por construcción, sin cablear ningún color
 *    (APP-SPEC §9). El acento queda para el chrome interactivo.
 *
 * 4. Énfasis en vez de más colores: la columna del mes en curso va a tinta
 *    plena y el resto atenuadas.
 */

/** Agrupa las cotizaciones por mes de emisión, en orden cronológico. */
function porMes(quotes, rules, meses) {
  const n = clamp(Math.round(num(meses, 12)), 3, 24);
  const hoy = new Date();
  const claves = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    claves.push({
      key: d.toISOString().slice(0, 7),
      label: MESES[d.getUTCMonth()].slice(0, 3),
      year: d.getUTCFullYear(),
      total: 0, count: 0, won: 0,
    });
  }
  const byKey = new Map(claves.map((c) => [c.key, c]));
  for (const q of arr(quotes)) {
    const c = byKey.get(s(q.date).slice(0, 7));
    if (!c) continue;
    const t = computeTotals(q, rules).total;
    c.total += t;
    c.count++;
    if (effectiveStatus(q, rules) === 'accepted') c.won += t;
  }
  return claves;
}

/** Lo que pide atención hoy, ordenado por urgencia. */
function requiereAtencion(quotes, rules) {
  const out = [];
  for (const q of arr(quotes)) {
    const st = effectiveStatus(q, rules);
    const until = validUntilOf(q, rules);
    const dias = diasHasta(until);
    if (q.supersededBy) continue;              // ya la relevó una revisión
    if (st === 'expired') {
      out.push({ doc: q, orden: 0, motivo: 'Venció' + (until ? ' el ' + fechaCorta(until) : '') + ' sin respuesta' });
    } else if (st === 'sent' && dias != null && dias <= 3) {
      out.push({
        doc: q, orden: 1,
        motivo: dias <= 0 ? 'Vence hoy' : 'Vence en ' + dias + (dias === 1 ? ' día' : ' días'),
      });
    } else if (st === 'draft') {
      const edad = diasHasta(q.date);
      if (edad != null && edad <= -7) out.push({ doc: q, orden: 2, motivo: 'Borrador de hace ' + Math.abs(edad) + ' días, sin enviar' });
    }
  }
  return out.sort((a, b) => a.orden - b.orden || s(a.doc.date).localeCompare(s(b.doc.date)));
}

/** Los clientes que más pesan, por valor cotizado. */
function porCliente(quotes, rules, limite) {
  const mapa = new Map();
  for (const q of arr(quotes)) {
    const nombre = s(q.client.name) || 'Sin cliente';
    const clave = canon(nombre) || 'sin-cliente';
    const t = computeTotals(q, rules).total;
    const acc = mapa.get(clave) || { nombre, total: 0, ganado: 0, count: 0 };
    acc.total += t;
    acc.count++;
    if (effectiveStatus(q, rules) === 'accepted') acc.ganado += t;
    mapa.set(clave, acc);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, clamp(Math.round(num(limite, 6)), 1, 20));
}

// ── Pantalla ────────────────────────────────────────────────────────────
function BoardTab(props) {
  const m = props.m;
  const rules = normalizeRules(m.def.rules);
  const cur = currencyOf(null, rules);
  const quotes = quotesOf();
  const resumen = pipelineSummary();
  const meses = porMes(quotes, rules, 12);
  const atencion = requiereAtencion(quotes, rules);
  const clientes = porCliente(quotes, rules, 6);

  if (!quotes.length) {
    return h('div', { className: 'cz-tab' }, h(Empty, {
      icon: '📊',
      title: 'Nada que seguir todavía',
      text: 'Cuando haya cotizaciones, aquí verás cuánto hay en juego, qué está por vencer y qué se ganó.',
      action: h(Btn, { variant: 'primary', onClick: () => actSetTab('quotes') }, 'Ir a Cotizaciones'),
    }));
  }

  const cerradas = resumen.byStatus.accepted.count + resumen.byStatus.rejected.count;
  const conversion = cerradas ? Math.round((resumen.byStatus.accepted.count / cerradas) * 100) : null;
  const ticket = resumen.count ? resumen.total / resumen.count : 0;

  return h('div', { className: 'cz-tab cz-board' }, [
    // ── Fichas de dato ───────────────────────────────────────────────
    h('div', { key: 'kpi', className: 'cz-kpis' }, [
      h(Kpi, { key: 'a', label: 'En juego', value: money(resumen.open, cur), sub: resumen.byStatus.sent.count + ' enviada(s) vigente(s)', destacado: true }),
      h(Kpi, { key: 'b', label: 'Ganado', value: money(resumen.won, cur), sub: resumen.byStatus.accepted.count + ' aceptada(s)' }),
      h(Kpi, { key: 'c', label: 'Cotizado en total', value: money(resumen.total, cur), sub: resumen.count + ' cotización(es)' }),
      h(Kpi, {
        key: 'd', label: 'Tasa de cierre',
        value: conversion == null ? '—' : conversion + '%',
        sub: conversion == null ? 'aún no hay cerradas' : cerradas + ' cerrada(s)',
      }),
      h(Kpi, { key: 'e', label: 'Ticket medio', value: money(ticket, cur), sub: 'por cotización' }),
    ]),

    // ── Requiere atención ────────────────────────────────────────────
    h('section', { key: 'at', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Requiere atención'),
        h('span', { key: 'n', className: 'cz-card-note' },
          atencion.length ? atencion.length + ' cotización(es)' : 'nada pendiente por ahora'),
      ]),
      atencion.length
        ? h('ul', { key: 'l', className: 'cz-atlist' }, atencion.slice(0, 12).map(({ doc, motivo }) => h('li', {
          key: doc.id, className: 'cz-atrow',
        }, [
          h('button', {
            key: 'b', type: 'button', className: 'cz-atrow-b', onClick: () => actOpen(doc.id),
          }, [
            h('span', { key: 'n', className: 'cz-mono cz-dim' }, doc.number || '—'),
            h('span', { key: 't', className: 'cz-atrow-t' }, doc.name),
            h('span', { key: 'c', className: 'cz-atrow-c cz-dim' }, doc.client.name || '—'),
            h('span', { key: 'm', className: 'cz-atrow-m' }, motivo),
            h('span', { key: 'v', className: 'cz-mono cz-strong' }, money(computeTotals(doc, rules).total, cur)),
          ]),
        ])))
        : h('div', { key: 'e', className: 'cz-dim' }, 'Ninguna vence pronto, ninguna venció sin respuesta y no hay borradores olvidados.'),
    ]),

    // ── Reparto por estado ───────────────────────────────────────────
    h('section', { key: 'st', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Por estado'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'La longitud de la barra es el valor cotizado.'),
      ]),
      h('table', { key: 'tb', className: 'cz-table cz-magtable' }, [
        h('thead', { key: 'h' }, h('tr', null, [
          h('th', { key: 's', className: 'cz-th' }, 'Estado'),
          h('th', { key: 'c', className: 'cz-th cz-right' }, 'Nº'),
          h('th', { key: 'b', className: 'cz-th' }, ''),
          h('th', { key: 'v', className: 'cz-th cz-right' }, 'Valor'),
        ])),
        h('tbody', { key: 'b' }, STATUSES.map(([k, label]) => {
          const fila = resumen.byStatus[k] || { count: 0, total: 0 };
          const max = Math.max.apply(null, STATUSES.map(([j]) => (resumen.byStatus[j] || {}).total || 0).concat([1]));
          return h('tr', { key: k, className: cx('cz-magrow', !fila.count && 'vacia') }, [
            h('td', { key: 's' }, h(StatusChip, { status: k })),
            h('td', { key: 'c', className: 'cz-mono cz-right' }, fila.count || '—'),
            h('td', { key: 'b', className: 'cz-magcell' }, h('div', {
              className: 'cz-bar', title: label + ': ' + money(fila.total, cur) + ' en ' + fila.count + ' cotización(es)',
            }, h('div', { className: 'cz-bar-fill', style: { width: (fila.total / max * 100).toFixed(1) + '%' } }))),
            h('td', { key: 'v', className: 'cz-mono cz-right cz-strong' }, fila.total ? money(fila.total, cur) : '—'),
          ]);
        })),
      ]),
    ]),

    // ── Evolución mensual ────────────────────────────────────────────
    h('section', { key: 'mes', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Cotizado por mes'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Últimos 12 meses · el mes en curso destacado'),
      ]),
      h(ColumnChart, { key: 'c', datos: meses, cur }),
    ]),

    // ── Clientes ─────────────────────────────────────────────────────
    h('section', { key: 'cl', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Clientes con más peso'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Por valor cotizado; en oscuro, lo ya ganado.'),
      ]),
      h('table', { key: 'tb', className: 'cz-table cz-magtable' }, [
        h('thead', { key: 'h' }, h('tr', null, [
          h('th', { key: 'c', className: 'cz-th' }, 'Cliente'),
          h('th', { key: 'n', className: 'cz-th cz-right' }, 'Nº'),
          h('th', { key: 'b', className: 'cz-th' }, ''),
          h('th', { key: 'v', className: 'cz-th cz-right' }, 'Cotizado'),
        ])),
        h('tbody', { key: 'b' }, clientes.map((c) => {
          const max = clientes[0].total || 1;
          return h('tr', { key: c.nombre, className: 'cz-magrow' }, [
            h('td', { key: 'c' }, c.nombre),
            h('td', { key: 'n', className: 'cz-mono cz-right' }, c.count),
            h('td', { key: 'b', className: 'cz-magcell' }, h('div', {
              className: 'cz-bar',
              title: c.nombre + ': ' + money(c.total, cur) + ' cotizado, ' + money(c.ganado, cur) + ' ganado',
            }, [
              h('div', { key: 'f', className: 'cz-bar-fill', style: { width: (c.total / max * 100).toFixed(1) + '%' } }),
              c.ganado ? h('div', { key: 'w', className: 'cz-bar-won', style: { width: (c.ganado / max * 100).toFixed(1) + '%' } }) : null,
            ])),
            h('td', { key: 'v', className: 'cz-mono cz-right cz-strong' }, money(c.total, cur)),
          ]);
        })),
      ]),
    ]),
  ]);
}

/** Ficha de dato: un número con su etiqueta y su contexto. */
function Kpi(props) {
  const p = props || {};
  return h('div', { className: cx('cz-kpi', p.destacado && 'on') }, [
    h('div', { key: 'l', className: 'cz-kpi-l' }, p.label),
    h('div', { key: 'v', className: 'cz-kpi-v cz-mono' }, p.value),
    p.sub ? h('div', { key: 's', className: 'cz-kpi-s' }, p.sub) : null,
  ]);
}

/**
 * Columnas de una sola serie. Sin librería: la altura de cada columna es el
 * dato, el mes en curso va a tinta plena y el resto atenuadas (énfasis en
 * lugar de más colores), y cada columna lleva su valor en el tooltip.
 */
function ColumnChart(props) {
  const { datos, cur } = props;
  const max = Math.max.apply(null, arr(datos).map((d) => d.total).concat([1]));
  const ultimo = arr(datos).length - 1;
  return h('div', { className: 'cz-cols' }, arr(datos).map((d, i) => h('div', {
    key: d.key, className: cx('cz-col', i === ultimo && 'on', !d.total && 'vacia'),
    title: d.label + ' ' + d.year + ': ' + money(d.total, cur) + ' en ' + d.count + ' cotización(es)'
      + (d.won ? ' · ' + money(d.won, cur) + ' ganado' : ''),
  }, [
    h('div', { key: 'b', className: 'cz-col-bar' }, h('div', {
      className: 'cz-col-fill',
      // Altura mínima visible para un mes con datos: una barra de 0 px no se
      // distingue de un mes sin nada, y son cosas distintas.
      style: { height: d.total ? Math.max(3, (d.total / max) * 100) + '%' : '0' },
    })),
    h('div', { key: 'l', className: 'cz-col-l' }, d.label),
  ])));
}

// ══════════════════════════════════════════════════════════════════════
// src/90-app.js
// ══════════════════════════════════════════════════════════════════════
/* ══ APLICACIÓN ═══════════════════════════════════════════════════════════
 *
 * Chrome de la app y enrutado entre pestañas, con el sistema visual de KIMOS
 * (APP-SPEC §9): cabecera `título · pestañas · acciones` en tres columnas,
 * pestañas al estilo TabsList de shadcn, superficies de vidrio y ni un color
 * cableado.
 *
 * El componente se suscribe al modelo del closure: cuando el agente IA muta
 * el estado por su cuenta, el `emit()` del store repinta esta misma vista sin
 * que la app tenga que hacer nada especial (APP-SPEC §5).
 */

/**
 * Pestañas con pantalla propia. El listado vive en `TABS` (lo lee también el
 * agente); aquí se declara qué sabe pintar cada una, de modo que una pestaña
 * anunciada sin renderer no llegue a mostrarse rota.
 */
const TAB_VIEWS = {
  quotes: (m) => h(QuotesTab, { m, kind: KIND_QUOTE }),
  templates: (m) => h(QuotesTab, { m, kind: KIND_TEMPLATE }),
  catalog: (m) => h(CatalogTab, { m }),
  mails: (m) => h(MailsTab, { m }),
  board: (m) => h(BoardTab, { m }),
  settings: (m) => h(SettingsTab, { m }),
};
const VISIBLE_TABS = TABS.filter(([id]) => !!TAB_VIEWS[id]);

function App() {
  const [m, setM] = useState(() => Object.assign({}, model));

  // Suscripción al modelo del closure: una sola fuente de verdad para la
  // persona que edita y para el agente.
  useEffect(() => {
    listeners.add(setM);
    void load();
    window.addEventListener('focus', onFocusChange);
    window.addEventListener('blur', onFocusChange);
    return () => { listeners.delete(setM); };
  }, []);

  // Agente IA: se registra mientras la ventana esté abierta y se desregistra
  // al cerrarla (el host también lo limpia, pero el contrato pide hacerlo).
  useEffect(() => {
    offAgent = registrarAgente();
    return () => { if (offAgent) { offAgent(); offAgent = null; } };
  }, []);

  // Parámetros de ⚙️ Configurar: se aplican en caliente al guardarlos.
  useEffect(() => {
    if (!shell.config || !shell.config.onChange) return undefined;
    offConfig = shell.config.onChange((cfg) => setModel({ settings: cfg || {} }));
    return () => { if (offConfig) { offConfig(); offConfig = null; } };
  }, []);

  // 🗂️ Documentos: qué se guarda al pulsar "Guardar versión" y qué se
  // restaura al volver a una versión anterior.
  useEffect(() => {
    if (!shell.documents || !shell.documents.onSerialize) return undefined;
    const offS = shell.documents.onSerialize(() => ({
      cotizador: { def: model.def, docs: model.docs, catalog: model.catalog, mails: model.mails },
    }));
    const offL = shell.documents.onLoad((cfg) => {
      const snap = cfg && cfg.cotizador;
      if (!isObj(snap)) return;
      // Restaurar es reemplazar el modelo por el de la versión y volver a
      // escribirlo: los items del servidor son la fuente de verdad, así que
      // no basta con pintarlo.
      setModel({
        def: normalizeDefinition(snap.def),
        docs: arr(snap.docs).map(normalizeQuote),
        catalog: arr(snap.catalog).map(normalizeCatalogItem),
        mails: arr(snap.mails).map(normalizeMail),
      });
      for (const d of model.docs) queueSave(d.id);
      for (const c of model.catalog) queueSave(c.id);
      for (const x of model.mails) queueSave(x.id);
      queueSave(model.def.id);
      shell.notify({ level: 'success', text: 'Versión restaurada.' });
    });
    return () => { try { offS && offS(); } catch (e) { /* no-op */ } try { offL && offL(); } catch (e) { /* no-op */ } };
  }, []);

  // El acento configurable pisa el del tema solo si el usuario eligió uno.
  const rootStyle = s(m.settings.accent) ? { '--cz-accent-override': m.settings.accent } : undefined;

  const doc = m.openId ? m.docs.find((d) => d.id === m.openId) : null;
  const vista = doc
    ? h(QuoteEditor, { m, doc })
    : (TAB_VIEWS[m.tab] || TAB_VIEWS.quotes)(m);

  return h('div', {
    className: cx('kimos-cotizaciones', s(m.settings.accent) && 'cz-accent-custom'),
    style: rootStyle,
  }, [
    h(Header, { key: 'hd', m, doc }),
    h('div', { key: 'bd', className: 'cz-body' },
      !m.loaded
        ? h('div', { className: 'cz-loading' }, 'Cargando el cotizador…')
        : (m.error
          ? h(Empty, { icon: '⚠️', title: 'No se pudo cargar', text: m.error, action: h(Btn, { onClick: () => refresh(true) }, 'Reintentar') })
          : vista)),
  ]);
}

function Header(props) {
  const { m, doc } = props;
  const rules = normalizeRules(m.def.rules);
  const resumen = pipelineSummary();

  return h('header', { className: 'cz-hd' }, [
    // Izquierda: identidad y miga de pan.
    h('div', { key: 'l', className: 'cz-hd-nav' }, [
      h('span', { key: 'i', className: 'cz-hd-ico', title: 'Cotizaciones' }, '🧾'),
      h('div', { key: 'c', className: 'cz-crumbs' }, [
        h('button', {
          key: 'r', className: cx('cz-crumb', !doc && 'on'), type: 'button',
          onClick: () => { if (doc) actCloseEditor(); },
          title: m.docName || 'Cotizador',
        }, m.docName || 'Cotizaciones'),
        doc ? h('span', { key: 's', className: 'cz-crumb-sep' }, '›') : null,
        doc ? h('span', { key: 'd', className: 'cz-crumb on', title: doc.name }, doc.number || doc.name) : null,
      ]),
      h('span', { key: 'v', className: 'cz-ver', title: 'Cotizaciones v' + APP_VERSION }, 'v' + APP_VERSION),
    ]),

    // Centro: pestañas.
    h('nav', { key: 'c', className: 'cz-bigtabs' }, VISIBLE_TABS.map(([id, label, icon]) => h('button', {
      key: id, type: 'button',
      className: cx('cz-bigtab', !doc && m.tab === id && 'on'),
      onClick: () => actSetTab(id),
      title: label,
    }, [
      h('span', { key: 'i', className: 'cz-bigtab-ico' }, icon),
      h('span', { key: 'l', className: 'cz-bigtab-lbl' }, label),
    ]))),

    // Derecha: estado y acciones.
    h('div', { key: 'r', className: 'cz-hd-acciones' }, [
      !doc && m.tab === 'quotes' && resumen.count
        ? h('span', { key: 'p', className: 'cz-hd-kpi', title: 'Valor de las cotizaciones enviadas y aún vigentes' },
          [h('span', { key: 'l', className: 'cz-hd-kpi-lbl' }, 'En juego '),
          h('span', { key: 'v', className: 'cz-mono' }, money(resumen.open, currencyOf(null, rules)))])
        : null,
      h(SyncDot, { key: 's', sync: m.sync }),
      h(IconBtn, {
        key: 'r', icon: '⟳', title: 'Sincronizar ahora',
        onClick: () => refresh(true),
      }),
    ]),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/95-agent.js
// ══════════════════════════════════════════════════════════════════════
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

  return {
    Component: App,
    unmount() { teardown(); },
    // Ventana al interior del closure para el banco de pruebas
    // (test/test-app.mjs). El host solo usa Component y unmount; esto le
    // permite a las pruebas ejercitar el modelo y las acciones sin montar un
    // navegador, que es la única forma de que el motor de cálculo y la fusión
    // multiusuario tengan pruebas de verdad.
    __test: {
      load, refresh, flushPending, getModel, setModel,
      num, computeTotals, nextNumber, validUntilOf, effectiveStatus, cloneDoc,
      normalizeQuote, normalizeRules, mergeDoc, mergeLines, pruneTombs,
      docById, catalogById, mailById, quotesOf, templatesOf, rulesOf, issuerOf,
      visibleDocs, pipelineSummary,
      actSetTab, actOpen, actCloseEditor, actSetSearch, actSetFilterStatus, actSetSort,
      actNewQuote, actDuplicate, actSaveAsTemplate, actPatchDoc, actPatchClient,
      actSetStatus, actRenameDoc, actRemoveDoc,
      actAddLine, actUpdateLine, actRemoveLine, actMoveLine, actDuplicateLine,
      actUpsertCatalogItem, actRemoveCatalogItem, actAddCatalogToQuote, actSaveLineToCatalog,
      actPatchIssuer, actPatchRules,
      loadExternalCatalog, loadCustomers, productByKey,
      actAddProductToQuote, actRefreshLinePrice, actImportClient,
      actLinkClientRecord, actRefreshClientRecord, actPushClientToDirectory,
      estadoVinculo, clavesDeCliente, registroNoDisponible,
      actImportBrand, marcaNoDisponible,
      precioParaCotizar, precioSeleccion, seleccionResuelta, detalleSeleccion,
      grupoVisible, fromProductsItem, fromRawPL, fromPublicPL, plEngine,
      bloquesDe, bloquesPorDefecto, normalizeBlock, contextoDe, BLOCK_TYPES,
      actSetEditorView, actSetBlocks, actAddBlock, actUpdateBlock, actRemoveBlock,
      actMoveBlock, actResetBlocks,
      actSetDefaultTemplate, defaultTemplate, actNewRevision, serieDe, numeroRevision,
      actExportPdf, actPublishQuote, printCss, nombreArchivo, PAPER_SIZES,
      uploadImage, safeFileName,
      aplicarVars, resolverCorreo, cuerpoHtml, mailStatus, MAIL_VARS,
      actUpsertMailTemplate, actRemoveMailTemplate, actSetDefaultMailTemplate,
      defaultMailTemplate, actPrepareMail, actSendMail, plantillaCorreoEjemplo,
      porMes, requiereAtencion, porCliente,
      registrarAgente, agentSnapshot, agentDispatch, AGENT_TOOLS,
      resolverDoc, resolverCatalogo, resolverProducto, selectionDesdeNombres,
      // Los diálogos, para que el banco de pruebas los renderice: viven
      // detrás de estado de interacción y si no se pintarían por primera vez
      // en producción.
      dialogos: {
        NewQuoteModal, CatalogItemModal, CatalogPickerModal, ProductPickerModal,
        ClientPickerModal, PreviewModal, MailTemplateModal, SendMailModal, Modal,
      },
    },
  };
}
