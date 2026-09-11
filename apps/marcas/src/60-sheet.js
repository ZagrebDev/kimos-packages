/* ══ LA HOJA DEL SISTEMA VISUAL ═══════════════════════════════════════════
 *
 * Una plana por marca con lo necesario para identificarla y aplicarla:
 * logotipo, paleta, tipografía, elementos y principios. Es la pieza que se
 * imprime, se manda a una imprenta o se le pasa a alguien que va a diseñar
 * algo para la empresa.
 *
 * Dos decisiones que la sostienen:
 *
 *   · **La misma hoja en pantalla y en papel.** No hay un maquetador para
 *     ver y otro para imprimir: la ventana de impresión renderiza ESTE mismo
 *     componente. Si se ve bien aquí, sale bien impreso.
 *   · **Vacío es vacío.** Una sección que la marca no tiene no se pinta con
 *     un hueco ni con texto de relleno: desaparece. Una hoja con cinco
 *     recuadros vacíos no comunica que la marca está a medias, comunica que
 *     el sistema está roto.
 *
 * La retícula sigue la del ejemplo que la motivó (tres columnas arriba, dos
 * abajo), pero se reordena sola según qué secciones tenga la marca.
 */

/** Lo que la hoja necesita saber, resuelto una vez. */
function hojaContexto(brand, opts) {
  const b = normalizeBrand(brand);
  const o = isObj(opts) ? opts : {};
  const activas = arr(o.secciones && o.secciones.length ? o.secciones : SECCIONES.map((x) => x[0]));

  const logos = b.logos.filter((l) => l.url);
  const disponible = {
    logos: logos.length > 0,
    palette: b.palette.length > 0,
    typography: b.typography.length > 0,
    // La forma se enseña solo si la marca la declara, igual que el resto:
    // una lámina que explica la forma «por defecto» estaría describiendo el
    // tema del tenant, no la marca.
    form: !!b.form,
    ecosystems: b.ecosystems.length > 0,
    principles: b.principles.length > 0,
  };
  // `lamina` acota a las secciones de una de las dos planas. Sin ella salen
  // todas, que es lo que se imprime.
  const deLamina = s(o.lamina)
    ? (LAMINAS.find((x) => x[0] === s(o.lamina)) || [null, null, []])[2]
    : null;
  const secciones = SECCIONES
    .map((x) => x[0])
    .filter((k) => activas.indexOf(k) >= 0 && disponible[k]
      && (!deLamina || deLamina.indexOf(k) >= 0));

  const base = colorPorRol(b, 'base');
  const acento = colorPorRol(b, 'accent');
  return {
    brand: b,
    logos,
    secciones,
    base,
    acento,
    // El color sobre el que se pinta la cabecera de la hoja. Si la marca no
    // fija un principal, la hoja usa el color de texto del tema del host en
    // vez de inventarse uno.
    cabeceraFondo: base ? base.hex : '',
    cabeceraTexto: base ? base.foreground : '',
    logoCabecera: logoParaFondo(b, base ? 'dark' : 'light'),
    fecha: (o.fecha || new Date().toISOString().slice(0, 7)).replace('-', ' / '),
    nota: s(o.nota),
    lamina: s(o.lamina),
    laminaLabel: (LAMINAS.find((x) => x[0] === s(o.lamina)) || [null, ''])[1],
    // Qué láminas tienen algo que enseñar. Una vacía no se ofrece ni se
    // imprime: una plana en blanco no dice «la marca está a medias», dice
    // que el sistema está roto.
    laminasConContenido: LAMINAS
      .filter(([, , claves]) => claves.some((k) => disponible[k] && activas.indexOf(k) >= 0))
      .map(([k]) => k),
  };
}

const numSeccion = (ctx, clave) => {
  const i = ctx.secciones.indexOf(clave);
  return i < 0 ? '' : String(i + 1).padStart(2, '0');
};

// ── Secciones ───────────────────────────────────────────────────────────

function HojaLogos(props) {
  const { ctx } = props;
  return h('section', { className: 'mk-hs mk-hs-logos' }, [
    h(SecHead, { key: 'h', num: numSeccion(ctx, 'logos'), title: 'Logotipo' }),
    h('div', { key: 'g', className: 'mk-hs-logos-grid' },
      ctx.logos.slice(0, 4).map((l) => h(LogoBox, { key: l.key, logo: l, brand: ctx.brand }))),
  ]);
}

function HojaPaleta(props) {
  const { ctx } = props;
  return h('section', { className: 'mk-hs mk-hs-paleta' }, [
    h(SecHead, { key: 'h', num: numSeccion(ctx, 'palette'), title: 'Paleta' }),
    h('div', { key: 'g', className: 'mk-hs-sw' },
      ctx.brand.palette.map((c) => h(Swatch, { key: c.key, color: c }))),
  ]);
}

function HojaTipografia(props) {
  const { ctx } = props;
  // El tamaño de la muestra baja con el uso: un titular se enseña grande y un
  // dato pequeño, que es como se van a ver de verdad.
  const tam = { headings: 22, accent: 18, body: 14, data: 12 };
  return h('section', { className: 'mk-hs mk-hs-tipo' }, [
    h(SecHead, { key: 'h', num: numSeccion(ctx, 'typography'), title: 'Tipografía' }),
    h('div', { key: 'l', className: 'mk-tipos' }, ctx.brand.typography.map((t) =>
      h('div', { key: t.key, className: 'mk-tipo' }, [
        h('span', { key: 'm', className: 'mk-tipo-meta' },
          [t.family, t.usageLabel, t.weights.join('/')].filter(Boolean).join(' · ')),
        h('span', {
          key: 's',
          className: 'mk-tipo-sample',
          // La familia de la marca, con la del host detrás: si la fuente no
          // está cargada en este equipo, la muestra sigue siendo legible.
          style: {
            fontFamily: '"' + t.family + '", ' + (t.usage === 'data' ? 'ui-monospace, monospace' : 'inherit'),
            fontSize: (tam[t.usage] || 14) + 'px',
            fontWeight: t.usage === 'headings' ? 700 : 500,
          },
        }, t.sample || 'Ejemplo de texto con esta tipografía.'),
      ]))),
  ]);
}

/**
 * Elementos visuales: cómo se ve la marca aplicada, por ecosistema.
 *
 * Es la sección que convierte una tabla de colores en un sistema: enseña una
 * barra, un banner y unas etiquetas con los colores de esa variante, que es
 * donde se descubre que el acento no contrasta contra la base.
 */
function HojaEcosistemas(props) {
  const { ctx } = props;
  const b = ctx.brand;
  return h('section', { className: 'mk-hs mk-hs-eco' }, [
    h(SecHead, { key: 'h', num: numSeccion(ctx, 'ecosystems'), title: 'Elementos visuales' }),
    h('div', { key: 'g', className: 'mk-ecos' }, b.ecosystems.slice(0, 3).map((e) => {
      const base = colorPorClave(b, e.baseColorKey) || ctx.base;
      const acento = colorPorClave(b, e.accentColorKey) || ctx.acento;
      const fondo = base ? base.hex : '#1d1d1b';
      const texto = base ? base.foreground : '#ffffff';
      const acc = acento ? acento.hex : fondo;
      const accTexto = acento ? acento.foreground : texto;
      const logo = logoParaFondo(b, 'dark');
      return h('div', { key: e.key, className: 'mk-eco' }, [
        h('div', { key: 'hd', className: 'mk-eco-hd', style: { background: fondo, color: texto } }, [
          h('span', { key: 'n', className: 'mk-eco-nm' }, e.name),
          h('span', { key: 't', className: 'mk-eco-tag', style: { background: acc, color: accTexto } },
            [base && base.name, acento && acento.name].filter(Boolean).join(' · ')),
        ]),
        h('div', { key: 'nv', className: 'mk-eco-nav', style: { background: fondo, color: texto } }, [
          logo ? h('img', { key: 'l', src: logo.url, alt: '' }) : null,
          h('span', { key: 'a', className: 'mk-eco-link', style: { color: acc } }, 'Activo'),
          h('span', { key: 'b', className: 'mk-eco-link' }, 'Sección'),
          h('span', { key: 'sp', className: 'mk-sp' }),
          h('span', { key: 'c', className: 'mk-eco-btn', style: { background: acc, color: accTexto } }, 'Acción'),
        ]),
        h('div', { key: 'bn', className: 'mk-eco-banner', style: { background: fondo, color: texto } }, [
          h('h4', { key: 't' }, [
            s(b.tagline) || 'Titular de campaña ',
            h('em', { key: 'e', style: { color: acc } }, 'con acento.'),
          ]),
          e.note ? h('span', { key: 'n', className: 'mk-eco-note' }, e.note) : null,
        ]),
        h('div', { key: 'ch', className: 'mk-eco-chips' }, [
          h('span', { key: '1', className: 'mk-chip', style: { background: acc, color: accTexto } }, 'Destacado'),
          h('span', { key: '2', className: 'mk-chip', style: { background: fondo, color: texto } }, 'Neutro'),
          h('span', { key: '3', className: 'mk-chip mk-chip-out', style: { borderColor: fondo, color: fondo } }, 'Contorno'),
        ]),
      ]);
    })),
  ]);
}

function HojaPrincipios(props) {
  const { ctx } = props;
  return h('section', { className: 'mk-hs mk-hs-pp' }, [
    h(SecHead, { key: 'h', num: numSeccion(ctx, 'principles'), title: 'Principios y reglas' }),
    h('div', { key: 'l', className: 'mk-pps' }, ctx.brand.principles.map((p, i) =>
      h('div', { key: i, className: 'mk-pp' }, [
        h('span', { key: 'n', className: 'mk-pp-n', style: ctx.acento ? { color: ctx.acento.hex } : null },
          String(i + 1).padStart(2, '0')),
        h('div', { key: 'b' }, [
          h('div', { key: 't', className: 'mk-pp-t' }, p.title),
          p.text ? h('div', { key: 'd', className: 'mk-pp-d' }, p.text) : null,
        ]),
      ]))),
  ]);
}

// ── Lámina 2: la forma ──────────────────────────────────────────────────
/**
 * La forma no se entiende leyendo «radio 0, sin sombra»: se entiende viendo
 * un botón, una tarjeta, un campo y una burbuja de chat con esa forma puesta.
 * Por eso la lámina 2 son COMPONENTES REALES, no una tabla de valores.
 *
 * Son los mismos cuatro que aparecen en todo KIMOS, el chat de agentes
 * incluido: si se ven bien aquí, se ven bien en el sistema.
 */
function MuestrasDeForma(props) {
  const { ctx } = props;
  const b = ctx.brand;
  const f = b.form || formaPorDefecto();
  const base = ctx.base;
  const acento = ctx.acento;
  const borde = colorPorRol(b, 'border');
  const superficie = colorPorRol(b, 'surface');

  const colBorde = borde ? borde.hex : 'currentColor';
  const colSup = superficie ? superficie.hex : 'transparent';
  const caja = (extra) => cajaDeForma(f, Object.assign({ borderColor: colBorde }, extra));

  return h('div', { className: 'mk-muestras' }, [
    // Botones: lo primero donde se nota una esquina.
    h('div', { key: 'b', className: 'mk-muestra' }, [
      h('span', { key: 'l', className: 'mk-muestra-l' }, 'Botones'),
      h('div', { key: 'c', className: 'mk-muestra-c' }, [
        h('span', {
          key: '1', className: 'mk-m-btn',
          style: caja({
            background: acento ? acento.hex : 'transparent',
            color: acento ? acento.foreground : 'inherit',
            borderColor: acento ? acento.hex : colBorde,
          }),
        }, 'Principal'),
        h('span', { key: '2', className: 'mk-m-btn', style: caja({ background: 'transparent' }) }, 'Secundario'),
      ]),
    ]),
    // Tarjeta: donde se ve la sombra y el filete.
    h('div', { key: 'c', className: 'mk-muestra' }, [
      h('span', { key: 'l', className: 'mk-muestra-l' }, 'Tarjeta'),
      h('div', { key: 'c', className: 'mk-muestra-c' },
        h('div', { className: 'mk-m-card', style: caja({ background: colSup }) }, [
          h('b', { key: 't' }, b.name || 'Título'),
          h('span', { key: 'd' }, s(b.tagline) || 'Una línea de contenido dentro de la tarjeta.'),
        ])),
    ]),
    // Campo: la forma también manda en los formularios.
    h('div', { key: 'i', className: 'mk-muestra' }, [
      h('span', { key: 'l', className: 'mk-muestra-l' }, 'Campo'),
      h('div', { key: 'c', className: 'mk-muestra-c' },
        h('span', { className: 'mk-m-input', style: caja({ background: 'transparent' }) }, 'Texto de ejemplo')),
    ]),
    // Chat: el que motivó la lámina. Las burbujas también cuelgan del radio.
    h('div', { key: 'ch', className: 'mk-muestra' }, [
      h('span', { key: 'l', className: 'mk-muestra-l' }, 'Chat del agente'),
      h('div', { key: 'c', className: 'mk-muestra-c mk-m-chat' }, [
        h('span', {
          key: '1', className: 'mk-m-burbuja',
          style: caja({ background: colSup, borderColor: colBorde }),
        }, '¿Cuánto llevamos cotizado este mes?'),
        h('span', {
          key: '2', className: 'mk-m-burbuja mk-m-burbuja-yo',
          style: caja({
            background: base ? base.hex : 'transparent',
            color: base ? base.foreground : 'inherit',
            borderColor: base ? base.hex : colBorde,
          }),
        }, 'Van 12 propuestas por 48,3 millones.'),
      ]),
    ]),
  ]);
}

function HojaForma(props) {
  const { ctx } = props;
  const f = ctx.brand.form || formaPorDefecto();
  const declarada = !!ctx.brand.form;
  const ficha = [
    ['Esquinas', labelDe(CORNER_STYLES, f.cornerStyle) + (f.cornerStyle === 'square' ? '' : ' · ' + f.radius + ' px')],
    ['Borde', f.borderWidth ? f.borderWidth + ' px' : 'Sin borde'],
    ['Elevación', labelDe(ELEVATIONS, f.elevation)],
    ['Densidad', labelDe(DENSITIES, f.density)],
  ];
  return h('section', { className: 'mk-hs mk-hs-forma' }, [
    h(SecHead, {
      key: 'h', num: numSeccion(ctx, 'form'), title: 'Forma',
      right: declarada ? null : h('span', { className: 'mk-sechead-nota' }, 'sin definir · manda el tema del sistema'),
    }),
    h('div', { key: 'g', className: 'mk-forma-grid' }, [
      h('dl', { key: 'f', className: 'mk-forma-ficha' }, ficha.map(([k, v]) => [
        h('dt', { key: k + 'k' }, k),
        h('dd', { key: k + 'v' }, v),
      ])),
      h(MuestrasDeForma, { key: 'm', ctx }),
    ]),
  ]);
}

const SECCION_COMP = {
  logos: HojaLogos,
  palette: HojaPaleta,
  typography: HojaTipografia,
  ecosystems: HojaEcosistemas,
  principles: HojaPrincipios,
  form: HojaForma,
};

// ── La hoja ─────────────────────────────────────────────────────────────

/**
 * La plana completa. `opts.secciones` decide cuáles salen; una que la marca
 * no tenga se cae sola aunque esté pedida.
 */
function Hoja(props) {
  const p = props || {};
  const ctx = hojaContexto(p.brand, p);
  const b = ctx.brand;

  if (!ctx.secciones.length) {
    return h('div', { className: 'mk-hoja mk-hoja-vacia' },
      h(Empty, {
        icon: '📄',
        title: 'Todavía no hay nada que enseñar',
        text: 'Añade al menos un logotipo o un color y la hoja aparece sola.',
      }));
  }

  // La retícula del ejemplo: tres arriba y dos abajo. Con menos secciones se
  // reparte lo que haya en vez de dejar huecos.
  const arriba = ctx.secciones.slice(0, 3);
  const abajo = ctx.secciones.slice(3);

  const fila = (claves, clase) => (claves.length
    ? h('div', { key: clase, className: 'mk-hoja-row ' + clase, 'data-n': claves.length },
      claves.map((k) => h(SECCION_COMP[k], { key: k, ctx })))
    : null);

  return h('div', { className: 'mk-hoja' }, [
    h('header', {
      key: 'hd',
      className: 'mk-hoja-hd',
      style: ctx.cabeceraFondo ? { background: ctx.cabeceraFondo, color: ctx.cabeceraTexto } : null,
    }, [
      ctx.logoCabecera && ctx.logoCabecera.url
        ? h('img', { key: 'l', className: 'mk-hoja-logo', src: ctx.logoCabecera.url, alt: b.name })
        : h('span', { key: 'l', className: 'mk-hoja-nm' }, b.name),
      h('span', { key: 'd', className: 'mk-hoja-div' }),
      h('h2', { key: 't' }, 'Sistema Visual'),
      ctx.laminaLabel ? h('span', { key: 'l', className: 'mk-hoja-lamina' }, ctx.laminaLabel) : null,
      h('span', { key: 'sp', className: 'mk-sp' }),
      h('span', { key: 'f', className: 'mk-hoja-meta' }, ctx.fecha),
    ]),
    fila(arriba, 'mk-hoja-r1'),
    fila(abajo, 'mk-hoja-r2'),
    h('footer', {
      key: 'ft',
      className: 'mk-hoja-ft',
      style: ctx.cabeceraFondo ? { background: ctx.cabeceraFondo, color: ctx.cabeceraTexto } : null,
    }, [
      h('span', { key: 'n' }, [b.name, b.tagline].filter(Boolean).join(' · ')),
      h('span', { key: 'sp', className: 'mk-sp' }),
      h('span', { key: 'p', className: 'mk-hoja-puntos' }, b.palette.slice(0, 6).map((c) =>
        h('i', { key: c.key, style: { background: c.hex } }))),
      h('span', { key: 'x' }, ctx.nota || s(b.footer) || 'Uso interno'),
    ]),
  ]);
}
