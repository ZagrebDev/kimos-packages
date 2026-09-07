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
