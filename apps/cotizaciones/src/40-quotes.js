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
