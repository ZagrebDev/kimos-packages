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
