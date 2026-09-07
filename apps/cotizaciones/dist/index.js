/**
 * Cotizaciones v1.0.0 — app oficial de KIMOS.
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
  const APP_VERSION = '1.0.0';

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
  // Entorno
  me: null,
  settings: {},        // valores de ⚙️ Configurar
  docName: '',
  loaded: false,
  error: null,
  // Vista (compartida por usuario y agente)
  tab: 'quotes',
  openId: '',          // documento abierto en el editor
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
    attachPdf: r.attachPdf !== false,
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

/** Chip de estado de una cotización, con el color del estado. */
function StatusChip(props) {
  const st = s(props && props.status) || 'draft';
  const color = STATUS_COLOR.get(st) || '#6B7280';
  return h('span', {
    className: 'cz-chip cz-chip-status',
    style: { '--chip': color },
    title: 'Estado: ' + (STATUS_LABEL.get(st) || st),
  }, STATUS_LABEL.get(st) || st);
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
 * lienzo) al almacenamiento del tenant, con el mismo camino que usa
 * ProductLab: `POST /api/v2/files` con la ruta de destino, y la URL pública
 * resultante bajo `/api/public/files/…`.
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
  if (!shell.authFetch) throw new Error('Este host no permite subir archivos.');
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error('La imagen supera los ' + MAX_IMAGE_MB + ' MB.');
  if (file.type && IMAGE_TYPES.indexOf(file.type) === -1) throw new Error('Formato no admitido: usa PNG, JPG, WEBP o SVG.');

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
      onClick: () => actNewQuote({ kind }),
    }, esPlantilla ? '+ Nueva plantilla' : '+ Nueva cotización'),
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
        action: h(Btn, { variant: 'primary', onClick: () => actNewQuote({ kind }) },
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
              h('div', { key: 'a', className: 'cz-cell-title' }, d.name),
              d.subtitle ? h('div', { key: 'b', className: 'cz-cell-sub' }, d.subtitle) : null,
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
      !esPlantilla ? h(Select, {
        key: 'st', className: 'cz-docbar-status', value: effectiveStatus(doc, rules),
        title: 'Estado de la cotización',
        onChange: (e) => actSetStatus(doc.id, e.target.value),
        options: STATUSES.map(([k, l]) => ({ value: k, label: l })),
      }) : null,
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, {
        key: 'dup', size: 'sm', title: 'Crear una copia editable de esta cotización',
        onClick: () => actDuplicate(doc.id, { asTemplate: esPlantilla }),
      }, '⧉ Duplicar'),
      !esPlantilla ? h(Btn, {
        key: 'tpl', size: 'sm', title: 'Guardar esta cotización como cotización tipo reutilizable',
        onClick: () => actSaveAsTemplate(doc.id),
      }, '📑 Guardar como tipo') : h(Btn, {
        key: 'use', size: 'sm', variant: 'primary', title: 'Crear una cotización desde esta plantilla',
        onClick: () => actNewQuote({ templateId: doc.id }),
      }, '▶ Usar plantilla'),
    ]),

    // ── Cuerpo ───────────────────────────────────────────────────────
    h('div', { key: 'body', className: 'cz-editor-body' }, [
      h('div', { key: 'main', className: 'cz-editor-main' }, [
        h(DocHeaderPanel, { key: 'hd', doc, rules, issuer, until, esPlantilla, patch, patchClient }),
        h(LinesTable, { key: 'ln', doc, rules, cur, totals, ask }),
        h(NotesPanel, { key: 'nt', doc, issuer, patch }),
      ]),
      h('div', { key: 'side', className: 'cz-editor-side' }, [
        h(TotalsPanel, { key: 'tot', doc, rules, totals, patch }),
        h(EventsPanel, { key: 'ev', doc, open: panel === 'events', onToggle: () => setPanel(panel === 'events' ? '' : 'events') }),
      ]),
    ]),
    confirmNode,
  ]);
}

// ── Cabecera del documento: emisor, cliente, fechas ──────────────────────
function DocHeaderPanel(props) {
  const { doc, rules, issuer, until, esPlantilla, patch, patchClient } = props;
  return h('section', { className: 'cz-card' }, [
    h('div', { key: 'h', className: 'cz-card-hd' }, [
      h('h3', { key: 't' }, esPlantilla ? 'Datos de la plantilla' : 'Cliente y vigencia'),
      issuer.name
        ? h('span', { key: 'i', className: 'cz-card-note' }, 'Emite: ' + issuer.name + (issuer.taxId ? ' · ' + issuer.taxId : ''))
        : h('span', { key: 'i', className: 'cz-card-note cz-warn' }, 'Falta configurar el emisor en Ajustes'),
    ]),
    h('div', { key: 'g', className: 'cz-grid2' }, [
      !esPlantilla ? h(Field, { key: 'cn', label: 'Cliente' },
        h(Input, { value: doc.client.name, placeholder: 'Razón social o nombre', onChange: (e) => patchClient({ name: e.target.value }) })) : null,
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
  ]);
}

// ── Tabla de líneas ─────────────────────────────────────────────────────
/**
 * Las filas se reordenan arrastrando (drag&drop nativo, sin dependencias).
 * `dragId` vive en el componente y no en el modelo: es estado de interacción,
 * no del documento, y no tiene por qué viajar a los demás usuarios.
 */
function LinesTable(props) {
  const { doc, rules, cur, totals, ask } = props;
  const [dragId, setDragId] = useState('');
  const [overId, setOverId] = useState('');
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
        key: 'add', size: 'sm', variant: 'primary',
        onClick: () => actAddLine(doc.id, { title: '', qty: 1, unitPrice: 0 }),
      }, '+ Línea'),
    ]),
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
      h(IconBtn, {
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
    },
  };
}
