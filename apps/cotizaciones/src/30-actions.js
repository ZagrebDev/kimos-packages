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
