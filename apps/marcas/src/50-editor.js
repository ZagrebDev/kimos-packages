/* ══ EDITOR ═══════════════════════════════════════════════════════════════
 *
 * Una sección por pieza de la marca. Cada campo dice, cuando importa, qué
 * consecuencia tiene fuera de esta app: un color sin rol no lo usará nadie,
 * un logo sin fondo declarado acabará en blanco sobre blanco.
 */

// ── Identidad ───────────────────────────────────────────────────────────

function EdIdentidad(props) {
  const { b, ro } = props;
  const set = (campo) => (e) => actSetCampo(campo, e.target.value);
  return h('div', { className: 'mk-ed' }, [
    h(SecHead, { key: 'h', title: 'Identidad' }),
    h('div', { key: 'g', className: 'mk-grid2' }, [
      h(Field, { key: 'n', label: 'Nombre de la marca' },
        h(Input, { value: b.name, disabled: ro, placeholder: 'PlayerPro', onChange: set('name') })),
      h(Field, { key: 't', label: 'Bajada', help: 'La frase que acompaña al nombre. Sale en la hoja y en los banners de ejemplo.' },
        h(Input, { value: b.tagline, disabled: ro, placeholder: 'Computadores que rinden', onChange: set('tagline') })),
      h(Field, { key: 'd', label: 'Descripción', wide: true },
        h(Area, { value: b.description, disabled: ro, rows: 2, onChange: set('description') })),
      h(Field, { key: 'ln', label: 'Razón social', help: 'Quién emite legalmente bajo esta marca.' },
        h(Input, { value: b.legalName, disabled: ro, onChange: set('legalName') })),
      h(Field, { key: 'rt', label: 'RUT / ID fiscal' },
        h(Input, { mono: true, value: b.taxId, disabled: ro, placeholder: '77.718.188-2', onChange: set('taxId') })),
      h(Field, { key: 'e', label: 'Correo' },
        h(Input, { type: 'email', value: b.email, disabled: ro, onChange: set('email') })),
      h(Field, { key: 'p', label: 'Teléfono' },
        h(Input, { value: b.phone, disabled: ro, onChange: set('phone') })),
      h(Field, { key: 'w', label: 'Sitio web' },
        h(Input, { value: b.website, disabled: ro, onChange: set('website') })),
      h(Field, { key: 'a', label: 'Dirección' },
        h(Input, { value: b.address, disabled: ro, onChange: set('address') })),
      h(Field, { key: 'f', label: 'Pie', wide: true, help: 'Texto legal o de uso que cierra la hoja y los documentos.' },
        h(Input, { value: b.footer, disabled: ro, placeholder: 'Uso interno · Diseño y Marketing', onChange: set('footer') })),
      h(Field, { key: 'bk', label: 'Datos de pago', wide: true, help: 'Los usa Cotizaciones al emitir bajo esta marca.' },
        h(Area, { value: b.bankDetails, disabled: ro, rows: 3, onChange: set('bankDetails') })),
    ]),
  ]);
}

// ── Paleta ──────────────────────────────────────────────────────────────

function EdColor(props) {
  const { c, ro, otros } = props;
  // El contraste contra el resto de la paleta es lo que decide si dos colores
  // se pueden usar juntos. Se calcula contra el principal, que es el fondo
  // más probable.
  const contra = props.base && props.base.key !== c.key ? contraste(c.hex, props.base.hex) : null;
  return h('div', { className: 'mk-row' }, [
    h('label', { key: 'sw', className: 'mk-row-sw', style: { background: c.hex } }, [
      h('input', {
        key: 'i', type: 'color', value: c.hex, disabled: ro,
        onChange: (e) => actSetColor(c.key, { hex: e.target.value }),
        'aria-label': 'Color de ' + c.name,
      }),
    ]),
    h(Input, {
      key: 'n', className: 'mk-row-nm', value: c.name, disabled: ro,
      placeholder: 'Nombre', onChange: (e) => actSetColor(c.key, { name: e.target.value }),
    }),
    h(Input, {
      key: 'h', className: 'mk-row-hex', mono: true, value: c.hex, disabled: ro,
      invalid: !esHexValido(c.hex),
      onChange: (e) => actSetColor(c.key, { hex: e.target.value }),
    }),
    h(Select, {
      key: 'r', className: 'mk-row-rol', value: c.role, disabled: ro,
      options: COLOR_ROLES.map((x) => [x[0], x[1]]),
      title: (COLOR_ROLES.find((x) => x[0] === c.role) || [])[2] || '',
      onChange: (e) => actSetColor(c.key, { role: e.target.value }),
    }),
    h('span', {
      key: 'c',
      className: cx('mk-row-contra', contra !== null && contra < 3 && 'mk-warn'),
      title: contra !== null ? 'Contraste contra el color principal. Por debajo de 3:1 no se distinguen.' : '',
    }, contra !== null ? contra + ':1' : ''),
    ro ? null : h('span', { key: 'a', className: 'mk-row-acts' }, [
      h(IconBtn, { key: 'u', icon: '↑', title: 'Subir', onClick: () => actMoveColor(c.key, -1) }),
      h(IconBtn, { key: 'd', icon: '↓', title: 'Bajar', onClick: () => actMoveColor(c.key, 1) }),
      h(IconBtn, { key: 'x', icon: '🗑', title: 'Quitar', onClick: () => actRemoveColor(c.key) }),
    ]),
  ]);
}

function EdPaleta(props) {
  const { b, ro } = props;
  const base = colorPorRol(b, 'base');
  return h('div', { className: 'mk-ed' }, [
    h(SecHead, {
      key: 'h', title: 'Paleta',
      right: ro ? null : h(Btn, { size: 'sm', onClick: () => actAddColor() }, '+ Color'),
    }),
    h('p', { key: 'x', className: 'mk-nota' },
      'El ROL es lo que hace utilizable el color desde otra app: sin él, Cotizaciones o ProductLab no saben cuál de seis es el fondo y cuál el acento.'),
    b.palette.length
      ? h('div', { key: 'l', className: 'mk-rows' },
        b.palette.map((c) => h(EdColor, { key: c.key, c, ro, base })))
      : h(Empty, { key: 'e', icon: '🎨', title: 'Sin colores todavía' }),
  ]);
}

// ── Logotipos ───────────────────────────────────────────────────────────

function EdLogo(props) {
  const { l, ro, b } = props;
  const [subiendo, setSubiendo] = useState(false);
  return h('div', { className: 'mk-card' }, [
    h('div', { key: 'p', className: 'mk-card-prev' }, h(LogoBox, { logo: l, brand: b })),
    h('div', { key: 'f', className: 'mk-card-form' }, [
      h(Field, { key: 'n', label: 'Nombre' },
        h(Input, { value: l.name, disabled: ro, onChange: (e) => actSetLogo(l.key, { name: e.target.value }) })),
      h(Field, {
        key: 'b', label: 'Va sobre',
        help: 'Sin esto, una app puede poner el logo blanco sobre papel blanco.',
      }, h(Select, {
        value: l.background, disabled: ro, options: LOGO_BACKGROUNDS,
        onChange: (e) => actSetLogo(l.key, { background: e.target.value }),
      })),
      h(Field, { key: 'u', label: 'Archivo o URL', wide: true },
        h('div', { className: 'mk-inline' }, [
          h(Input, {
            key: 'i', value: l.url, disabled: ro, placeholder: 'https://…  o  /api/public/files/…',
            onChange: (e) => actSetLogo(l.key, { url: e.target.value }),
          }),
          ro ? null : h('label', { key: 'up', className: 'mk-btn mk-btn-sm' }, [
            subiendo ? 'Subiendo…' : '⬆ Subir',
            h('input', {
              key: 'f', type: 'file', accept: 'image/*', hidden: true,
              onChange: async (e) => {
                const file = e.target.files && e.target.files[0];
                e.target.value = '';
                if (!file) return;
                setSubiendo(true);
                await actSubirLogo(l.key, file);
                setSubiendo(false);
              },
            }),
          ]),
        ])),
      h(Field, { key: 'm', label: 'Tamaño mínimo' },
        h(Input, { value: l.minWidth, disabled: ro, placeholder: '24 px / 15 mm', onChange: (e) => actSetLogo(l.key, { minWidth: e.target.value }) })),
      h(Field, { key: 'c', label: 'Área de resguardo' },
        h(Input, { value: l.clearSpace, disabled: ro, placeholder: 'La altura del isotipo', onChange: (e) => actSetLogo(l.key, { clearSpace: e.target.value }) })),
    ]),
    ro ? null : h('div', { key: 'a', className: 'mk-card-acts' },
      h(IconBtn, { icon: '🗑', title: 'Quitar logotipo', onClick: () => actRemoveLogo(l.key) })),
  ]);
}

function EdLogos(props) {
  const { b, ro } = props;
  return h('div', { className: 'mk-ed' }, [
    h(SecHead, {
      key: 'h', title: 'Logotipos',
      right: ro ? null : h(Btn, { size: 'sm', onClick: () => actAddLogo() }, '+ Logotipo'),
    }),
    b.logos.length
      ? h('div', { key: 'l', className: 'mk-cards' }, b.logos.map((l) => h(EdLogo, { key: l.key, l, ro, b })))
      : h(Empty, { key: 'e', icon: '🏷', title: 'Sin logotipos todavía' }),
  ]);
}

// ── Tipografías ─────────────────────────────────────────────────────────

function EdTipografias(props) {
  const { b, ro } = props;
  return h('div', { className: 'mk-ed' }, [
    h(SecHead, {
      key: 'h', title: 'Tipografías',
      right: ro ? null : h(Btn, { size: 'sm', onClick: () => actAddFont() }, '+ Tipografía'),
    }),
    h('p', { key: 'x', className: 'mk-nota' },
      'El USO dice para qué es cada familia. Quien aplique la marca no tiene que adivinar cuál era la de titulares.'),
    b.typography.length
      ? h('div', { key: 'l', className: 'mk-rows' }, b.typography.map((t) => h('div', { key: t.key, className: 'mk-row mk-row-wrap' }, [
        h(Input, {
          key: 'f', className: 'mk-row-nm', value: t.family, disabled: ro, placeholder: 'Inter',
          onChange: (e) => actSetFont(t.key, { family: e.target.value }),
        }),
        h(Select, {
          key: 'u', className: 'mk-row-rol', value: t.usage, disabled: ro, options: TYPE_USAGES,
          onChange: (e) => actSetFont(t.key, { usage: e.target.value }),
        }),
        h(Input, {
          key: 'w', className: 'mk-row-hex', value: t.weights.join(' '), disabled: ro, placeholder: '400 600',
          title: 'Pesos, separados por espacios',
          onChange: (e) => actSetFont(t.key, { weights: e.target.value.split(/[\s,]+/) }),
        }),
        h(Input, {
          key: 's', className: 'mk-row-full', value: t.sample, disabled: ro,
          placeholder: 'Texto de muestra que saldrá en la hoja',
          onChange: (e) => actSetFont(t.key, { sample: e.target.value }),
        }),
        ro ? null : h(IconBtn, { key: 'x', icon: '🗑', title: 'Quitar', onClick: () => actRemoveFont(t.key) }),
      ])))
      : h(Empty, { key: 'e', icon: '🔤', title: 'Sin tipografías todavía' }),
  ]);
}

// ── Ecosistemas ─────────────────────────────────────────────────────────

function EdEcosistemas(props) {
  const { b, ro } = props;
  const opciones = [['', '—']].concat(b.palette.map((c) => [c.key, c.name]));
  return h('div', { className: 'mk-ed' }, [
    h(SecHead, {
      key: 'h', title: 'Ecosistemas',
      right: ro ? null : h(Btn, { size: 'sm', onClick: () => actAddEco() }, '+ Ecosistema'),
    }),
    h('p', { key: 'x', className: 'mk-nota' },
      'Variantes de la MISMA marca: comparten logotipo y tipografías y cambian qué color hace de base. Apuntan a la paleta, así que si el color cambia, cambia en un solo sitio.'),
    b.ecosystems.length
      ? h('div', { key: 'l', className: 'mk-rows' }, b.ecosystems.map((e) => h('div', { key: e.key, className: 'mk-row mk-row-wrap' }, [
        h(Input, {
          key: 'n', className: 'mk-row-nm', value: e.name, disabled: ro, placeholder: 'Retail',
          onChange: (ev) => actSetEco(e.key, { name: ev.target.value }),
        }),
        h(Select, {
          key: 'b', className: 'mk-row-rol', value: e.baseColorKey, disabled: ro, options: opciones,
          title: 'Color base de esta variante',
          onChange: (ev) => actSetEco(e.key, { baseColorKey: ev.target.value }),
        }),
        h(Select, {
          key: 'a', className: 'mk-row-rol', value: e.accentColorKey, disabled: ro, options: opciones,
          title: 'Acento de esta variante',
          onChange: (ev) => actSetEco(e.key, { accentColorKey: ev.target.value }),
        }),
        h(Input, {
          key: 'x', className: 'mk-row-full', value: e.note, disabled: ro, placeholder: 'Cuándo se usa',
          onChange: (ev) => actSetEco(e.key, { note: ev.target.value }),
        }),
        ro ? null : h(IconBtn, { key: 'r', icon: '🗑', title: 'Quitar', onClick: () => actRemoveEco(e.key) }),
      ])))
      : h(Empty, { key: 'e', icon: '🧩', title: 'Sin ecosistemas', text: 'Añade uno si la marca se aplica de más de una forma.' }),
  ]);
}

// ── Principios ──────────────────────────────────────────────────────────

function EdPrincipios(props) {
  const { b, ro } = props;
  return h('div', { className: 'mk-ed' }, [
    h(SecHead, {
      key: 'h', title: 'Principios y reglas',
      right: ro ? null : h(Btn, { size: 'sm', onClick: () => actAddPrincipio() }, '+ Principio'),
    }),
    b.principles.length
      ? h('div', { key: 'l', className: 'mk-rows' }, b.principles.map((p, i) => h('div', { key: i, className: 'mk-row mk-row-wrap' }, [
        h(Input, {
          key: 't', className: 'mk-row-nm', value: p.title, disabled: ro, placeholder: 'Limpio y directo',
          onChange: (e) => actSetPrincipio(i, { title: e.target.value }),
        }),
        h(Input, {
          key: 'd', className: 'mk-row-full', value: p.text, disabled: ro,
          placeholder: 'Fondo blanco, jerarquía clara, bordes rectos.',
          onChange: (e) => actSetPrincipio(i, { text: e.target.value }),
        }),
        ro ? null : h(IconBtn, { key: 'x', icon: '🗑', title: 'Quitar', onClick: () => actRemovePrincipio(i) }),
      ])))
      : h(Empty, { key: 'e', icon: '📐', title: 'Sin principios', text: 'Son las reglas que alguien de fuera necesita para no romper la marca.' }),
  ]);
}

const EDITORES = {
  identidad: EdIdentidad,
  logos: EdLogos,
  palette: EdPaleta,
  typography: EdTipografias,
  ecosystems: EdEcosistemas,
  principles: EdPrincipios,
};

const SECCIONES_EDITOR = [['identidad', 'Identidad']].concat(
  SECCIONES.map((x) => [x[0], x[0] === 'logos' ? 'Logotipos' : x[1]]));

function Editor(props) {
  const { m, b } = props;
  const ro = !puedeEditar();
  const Comp = EDITORES[m.seccion] || EdIdentidad;
  return h('div', { className: 'mk-editor' }, [
    h('nav', { key: 'n', className: 'mk-subnav' }, SECCIONES_EDITOR.map(([k, label]) =>
      h(Btn, {
        key: k, size: 'sm', active: m.seccion === k, onClick: () => actSetSeccion(k),
      }, label))),
    h('div', { key: 'c', className: 'mk-editor-body' }, h(Comp, { b, ro })),
  ]);
}
