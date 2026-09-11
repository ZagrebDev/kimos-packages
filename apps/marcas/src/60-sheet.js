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
    ecosystems: b.ecosystems.length > 0,
    principles: b.principles.length > 0,
  };
  const secciones = SECCIONES
    .map((x) => x[0])
    .filter((k) => activas.indexOf(k) >= 0 && disponible[k]);

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

const SECCION_COMP = {
  logos: HojaLogos,
  palette: HojaPaleta,
  typography: HojaTipografia,
  ecosystems: HojaEcosistemas,
  principles: HojaPrincipios,
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
