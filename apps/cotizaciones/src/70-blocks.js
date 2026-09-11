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
