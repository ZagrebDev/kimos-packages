/* ══ CHROME Y ENRUTADO ════════════════════════════════════════════════════
 *
 * Dos vistas y una lista. La app es pequeña a propósito: su trabajo es que la
 * marca esté bien definida, no reinventar un editor gráfico.
 */

function Cartera(props) {
  const { m } = props;
  const ro = !puedeEditar();
  return h('aside', { className: 'mk-cartera' }, [
    h('div', { key: 'h', className: 'mk-cartera-hd' }, [
      h('span', { key: 't' }, 'Marcas'),
      h('span', { key: 'n', className: 'mk-cartera-n' }, String(m.brands.length)),
      ro ? null : h(IconBtn, {
        key: 'a', icon: '+', title: 'Nueva marca', onClick: () => actNuevaMarca(),
      }),
    ]),
    h('ul', { key: 'l', className: 'mk-cartera-l' }, m.brands.map((b) => {
      const r = resumenDe(b);
      const base = colorPorRol(b, 'base');
      return h('li', { key: b.id }, h('button', {
        className: cx('mk-cartera-it', m.selectedId === b.id && 'on'),
        onClick: () => actSeleccionar(b.id),
      }, [
        h('span', { key: 'c', className: 'mk-cartera-color', style: base ? { background: base.hex } : null }),
        h('span', { key: 'b', className: 'mk-cartera-txt' }, [
          h('span', { key: 'n', className: 'mk-cartera-nm' }, b.name || 'Sin nombre'),
          h('span', { key: 'm', className: 'mk-cartera-meta' },
            r.colores + ' color(es) · ' + r.logos + ' logo(s)'),
        ]),
        b.isDefault ? h('span', { key: 'a', className: 'mk-tag', title: 'La usan por defecto las apps' }, 'activa') : null,
        r.avisos ? h('span', { key: 'w', className: 'mk-tag mk-tag-warn', title: r.avisos + ' aviso(s)' }, String(r.avisos)) : null,
      ]));
    })),
  ]);
}

function Barra(props) {
  const { m, b } = props;
  const ro = !puedeEditar();
  const avisos = b ? avisosDe(b) : [];
  return h('div', { className: 'mk-barra' }, [
    h('div', { key: 'id', className: 'mk-barra-id' }, [
      h('span', { key: 'n', className: 'mk-barra-nm' }, (b && b.name) || '—'),
      m.dirty ? h('span', { key: 'd', className: 'mk-tag mk-tag-warn' }, 'sin guardar') : null,
      b && b.isDefault ? h('span', { key: 'a', className: 'mk-tag' }, 'activa') : null,
    ]),
    h('div', { key: 'tabs', className: 'mk-tabs' }, [
      h(Btn, { key: 's', size: 'sm', active: m.tab === 'sistema', onClick: () => actSetTab('sistema') }, 'Hoja'),
      h(Btn, { key: 'e', size: 'sm', active: m.tab === 'editor', onClick: () => actSetTab('editor') }, 'Editar'),
    ]),
    h('span', { key: 'sp', className: 'mk-sp' }),
    avisos.length ? h('span', {
      key: 'w', className: 'mk-barra-avisos', title: avisos.join('\n'),
    }, '⚠ ' + avisos.length) : null,
    m.dirty ? h(Btn, { key: 'x', size: 'sm', onClick: actDescartar }, 'Descartar') : null,
    (!ro && m.dirty) ? h(Btn, {
      key: 'g', size: 'sm', variant: 'primary', disabled: m.saving, onClick: actGuardar,
    }, m.saving ? 'Guardando…' : 'Guardar') : null,
    h(Btn, { key: 'p', size: 'sm', onClick: () => actImprimirHoja() }, '🖨 Hoja'),
    h('span', { key: 'v', className: 'mk-ver', title: 'Versión de la app' }, 'v' + APP_VERSION),
  ]);
}

/** Qué secciones salen en la hoja: lo parametrizable, sin inventar un editor
 *  de plantillas que nadie pidió. */
function HojaOpciones(props) {
  const { m, b } = props;
  const ctx = hojaContexto(b, { secciones: m.hojaSecciones });
  const conContenido = arr(ctx.laminasConContenido);
  return h('div', { className: 'mk-hoja-opts mk-noprint' }, [
    // Las dos planas: identidad (quién es la marca) y forma (cómo se
    // construye lo que se hace con ella). Se imprimen las dos; en pantalla
    // se ve una cada vez.
    h('div', { key: 'lam', className: 'mk-laminas' }, LAMINAS.map(([clave, label]) => h(Btn, {
      key: clave, size: 'sm', active: m.lamina === clave,
      disabled: conContenido.indexOf(clave) < 0,
      title: conContenido.indexOf(clave) < 0 ? 'La marca todavía no tiene nada en esta lámina' : '',
      onClick: () => actSetLamina(clave),
    }, label))),
    h('span', { key: 'l', className: 'mk-hoja-opts-l' }, 'En la hoja:'),
    SECCIONES.map(([k, label]) => {
      const tiene = k === 'logos' ? ctx.logos.length : (k === 'form' ? (b.form ? 1 : 0) : arr(b[k]).length);
      return h('label', {
        key: k,
        className: cx('mk-check', !tiene && 'mk-check-off'),
        title: tiene ? '' : 'La marca todavía no tiene esta sección',
      }, [
        h('input', {
          key: 'i', type: 'checkbox', disabled: !tiene,
          checked: m.hojaSecciones.indexOf(k) >= 0 && !!tiene,
          onChange: () => actToggleSeccionHoja(k),
        }),
        h('span', { key: 's' }, label),
      ]);
    }),
  ]);
}

function App() {
  const [m, setM] = useState(getModel);
  useEffect(() => suscribir(setM), []);
  useEffect(() => {
    cargar();
    const off = registrarAgente();
    return () => { if (off) off(); };
  }, []);

  if (m.loading) {
    return h('div', { className: 'kimos-marcas' }, h(Empty, { icon: '⏳', title: 'Cargando marcas…' }));
  }
  if (m.error) {
    return h('div', { className: 'kimos-marcas' }, h(Empty, {
      icon: '⚠️', title: 'No se pudo abrir el registro de marcas', text: m.error,
      action: h(Btn, { variant: 'primary', onClick: () => cargar() }, 'Reintentar'),
    }));
  }
  if (!m.brands.length) {
    return h('div', { className: 'kimos-marcas' }, h(Empty, {
      icon: '🎨',
      title: 'Todavía no hay ninguna marca',
      text: 'Una marca guarda los logotipos, la paleta y las tipografías de la empresa, y queda disponible para que Cotizaciones, ProductLab y el resto de apps emitan con ella.',
      action: puedeEditar()
        ? h(Btn, { variant: 'primary', onClick: () => actNuevaMarca() }, 'Crear la primera marca')
        : h('span', { className: 'mk-nota' }, 'Pídele a un administrador que cree la primera.'),
    }));
  }

  const b = seleccionada();
  return h('div', { className: 'kimos-marcas' }, [
    h(Cartera, { key: 'c', m }),
    h('main', { key: 'm', className: 'mk-main' }, b ? [
      h(Barra, { key: 'b', m, b }),
      m.tab === 'editor'
        ? h(Editor, { key: 'e', m, b })
        : h('div', { key: 's', className: 'mk-hoja-wrap' }, [
          h(HojaOpciones, { key: 'o', m, b }),
          h(Avisos, { key: 'a', avisos: avisosDe(b) }),
          h(Hoja, { key: 'h', brand: b, secciones: m.hojaSecciones, lamina: m.lamina }),
        ]),
    ] : h(Empty, { icon: '👈', title: 'Elige una marca' })),
  ]);
}
