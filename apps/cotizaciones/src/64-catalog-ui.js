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
      h(Input, { value: it.group, list: 'cz-grupos', onChange: (e) => set({ group: e.target.value }) })),
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
