/* ══ AJUSTES DEL COTIZADOR ════════════════════════════════════════════════
 *
 * Dos bloques que se guardan en el item `definition` de la instancia:
 *
 *   Emisor  Quién cotiza: razón social, identificación fiscal, contacto,
 *           logo y datos de pago. Es la cabecera y el pie de toda propuesta,
 *           así que se escribe una vez y no en cada cotización.
 *   Reglas  Cómo se cotiza: moneda, si los precios se escriben netos o con
 *           impuesto incluido, el impuesto, la vigencia por defecto, el
 *           reparto abono/saldo, el formato del correlativo y las notas que
 *           arrastra toda cotización nueva.
 *
 * Nada de esto es retroactivo salvo donde el documento no fijó lo suyo: una
 * cotización guarda su propia moneda e impuesto al crearse, de modo que subir
 * el IVA hoy no reescribe lo que se cotizó el año pasado.
 */

function SettingsTab(props) {
  const m = props.m;
  const issuer = normalizeIssuer(m.def.issuer);
  const rules = normalizeRules(m.def.rules);
  const ejemplo = nextNumber(m.docs, rules).number;
  const cur = currencyOf(null, rules);

  return h('div', { className: 'cz-tab cz-settings' }, [
    // ── Emisor ───────────────────────────────────────────────────────
    h('section', { key: 'em', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Emisor'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Encabeza y firma todas las cotizaciones.'),
        h('span', { key: 'sp', className: 'cz-recbar-sp' }),
        h(BrandImportBtn, { key: 'b' }),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'n', label: 'Razón social' },
          h(Input, { value: issuer.name, placeholder: 'METAKUT SPA', onChange: (e) => actPatchIssuer({ name: e.target.value }) })),
        h(Field, { key: 'r', label: 'RUT / ID fiscal' },
          h(Input, { mono: true, value: issuer.taxId, placeholder: '77.718.188-2', onChange: (e) => actPatchIssuer({ taxId: e.target.value }) })),
        h(Field, { key: 'e', label: 'Correo' },
          h(Input, { type: 'email', value: issuer.email, placeholder: 'info@empresa.cl', onChange: (e) => actPatchIssuer({ email: e.target.value }) })),
        h(Field, { key: 'p', label: 'Teléfono' },
          h(Input, { value: issuer.phone, placeholder: '+56 9 …', onChange: (e) => actPatchIssuer({ phone: e.target.value }) })),
        h(Field, { key: 'w', label: 'Sitio web' },
          h(Input, { value: issuer.web, placeholder: 'kimos.dev', onChange: (e) => actPatchIssuer({ web: e.target.value }) })),
        h(Field, { key: 'd', label: 'Dirección' },
          h(Input, { value: issuer.address, placeholder: 'Calle 123, Comuna, Ciudad', onChange: (e) => actPatchIssuer({ address: e.target.value }) })),
        h(Field, { key: 'sl', label: 'Bajada', wide: true, help: 'Una línea bajo la razón social en la propuesta.' },
          h(Input, { value: issuer.tagline, placeholder: 'Soluciones de atención y gestión', onChange: (e) => actPatchIssuer({ tagline: e.target.value }) })),
        h(Field, { key: 'lg', label: 'Logo', wide: true, help: 'PNG o SVG con fondo transparente se ve mejor en el PDF.' },
          h(ImageField, { value: issuer.logoUrl, folder: 'logos', onChange: (v) => actPatchIssuer({ logoUrl: v }) })),
        h(Field, {
          key: 'pi', label: 'Datos de pago / transferencia', wide: true,
          help: 'Se copian al pie de cada cotización nueva; cada una puede cambiarlos.',
        }, h(AutoArea, {
          minRows: 4, value: issuer.paymentInfo,
          placeholder: 'METAKUT SPA\n77.718.188-2\nBanco de Chile\nCuenta Vista\n2532924267\ninfo@kimos.dev',
          onChange: (e) => actPatchIssuer({ paymentInfo: e.target.value }),
        })),
      ]),
    ]),

    // ── Reglas de cotización ─────────────────────────────────────────
    h('section', { key: 'ru', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Reglas de cotización'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Valores con los que nace cada cotización nueva.'),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'c', label: 'Moneda' }, h(Select, {
          value: rules.currency,
          onChange: (e) => {
            const c = CURRENCY_BY_CODE.get(e.target.value);
            actPatchRules({ currency: e.target.value, symbol: c ? c.symbol : '$', decimals: c ? c.decimals : 0 });
          },
          options: CURRENCIES.map((c) => ({ value: c.code, label: c.code + ' · ' + c.label })),
        })),
        h(Field, { key: 'sy', label: 'Símbolo', help: 'Ejemplo: ' + money(1234567, cur) },
          h(Input, { mono: true, value: rules.symbol, onChange: (e) => actPatchRules({ symbol: e.target.value }) })),
        h(Field, { key: 'pm', label: 'Los precios se escriben…', wide: true }, h(Select, {
          value: rules.priceMode,
          onChange: (e) => actPatchRules({ priceMode: e.target.value }),
          options: [
            { value: 'net', label: 'Netos — el impuesto se suma al final (lo habitual en Chile)' },
            { value: 'gross', label: 'Con impuesto incluido — se desglosa hacia atrás' },
          ],
        })),
        h(Field, { key: 'tl', label: 'Nombre del impuesto' },
          h(Input, { value: rules.taxLabel, placeholder: 'IVA', onChange: (e) => actPatchRules({ taxLabel: e.target.value }) })),
        h(Field, { key: 'tp', label: 'Impuesto %' },
          h(NumField, { value: rules.taxPct, decimals: 2, onChange: (v) => actPatchRules({ taxPct: num(v) }) })),
        h(Field, { key: 'vd', label: 'Vigencia por defecto' }, h('div', { className: 'cz-inline' }, [
          h(NumField, { key: 'n', value: rules.validDays, onChange: (v) => actPatchRules({ validDays: num(v) }) }),
          h(Toggle, {
            key: 't', checked: rules.validBusinessDays, label: 'días hábiles',
            onChange: (v) => actPatchRules({ validBusinessDays: v }),
          }),
        ])),
        h(Field, {
          key: 'ci', label: 'Precios del catálogo del sistema', wide: true,
          help: 'Los catálogos de Productos y ProductLab guardan el precio de venta al público. Si esta instancia guarda netos, apágalo.',
        }, h(Toggle, {
          checked: rules.catalogPricesIncludeTax,
          label: rules.catalogPricesIncludeTax ? 'Vienen con impuesto incluido (se descuenta al cotizar en netos)' : 'Ya vienen netos',
          onChange: (v) => actPatchRules({ catalogPricesIncludeTax: v }),
        })),
        h(Field, { key: 'ad', label: 'Abono y saldo' }, h('div', { className: 'cz-inline' }, [
          h(Toggle, {
            key: 't', checked: rules.advanceEnabled, label: 'desglosar',
            onChange: (v) => actPatchRules({ advanceEnabled: v }),
          }),
          rules.advanceEnabled ? h(NumField, {
            key: 'n', value: rules.advancePct, decimals: 2,
            onChange: (v) => actPatchRules({ advancePct: num(v) }),
          }) : null,
          rules.advanceEnabled ? h('span', { key: 'u', className: 'cz-unit' }, '% de abono') : null,
        ])),
      ]),
    ]),

    // ── Papel ────────────────────────────────────────────────────────
    h('section', { key: 'pa', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Papel del PDF'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Tamaño y márgenes con los que se exporta la propuesta.'),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'p', label: 'Tamaño' }, h(Select, {
          value: rules.paper, onChange: (e) => actPatchRules({ paper: e.target.value }),
          options: PAPER_SIZES.map(([k, label]) => ({ value: k, label })),
        })),
        h(Field, { key: 'm', label: 'Margen', help: rules.pageMargin + ' mm por lado' }, h('input', {
          type: 'range', min: 5, max: 40, value: rules.pageMargin, className: 'cz-range',
          onChange: (e) => actPatchRules({ pageMargin: num(e.target.value) }),
        })),
      ]),
    ]),

    // ── Correlativo ──────────────────────────────────────────────────
    h('section', { key: 'nu', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Numeración'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'La siguiente cotización será ' + (ejemplo || '—')),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'p', label: 'Prefijo' },
          h(Input, { mono: true, value: rules.numberPrefix, placeholder: 'COT', onChange: (e) => actPatchRules({ numberPrefix: e.target.value }) })),
        h(Field, { key: 'd', label: 'Dígitos' },
          h(NumField, { value: rules.numberPad, onChange: (v) => actPatchRules({ numberPad: num(v) }) })),
        h(Field, { key: 'y', label: 'Incluir el año', wide: true },
          h(Toggle, {
            checked: rules.numberIncludeYear,
            label: rules.numberIncludeYear ? 'Sí: el correlativo se reinicia cada año' : 'No: correlativo continuo',
            onChange: (v) => actPatchRules({ numberIncludeYear: v }),
          })),
      ]),
    ]),

    // ── Notas por defecto ────────────────────────────────────────────
    h('section', { key: 'no', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Notas por defecto'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Las arrastra cada cotización nueva; después se editan una a una.'),
      ]),
      h(TextList, {
        key: 'l', value: rules.defaultNotes,
        placeholder: 'Formas de pago: abono 60% contra orden de compra, saldo 40% al término.',
        onChange: (v) => actPatchRules({ defaultNotes: v }),
      }),
    ]),

    // ── Dónde vive esto ──────────────────────────────────────────────
    h('div', { key: 'ft', className: 'cz-settings-ft' },
      'Los ajustes viven en esta instancia del cotizador. Un equipo puede tener varios '
      + '(por marca o por unidad de negocio) y cada uno lleva su emisor, su correlativo y sus reglas.'),
  ]);
}

/**
 * «Traer de la marca del sistema»: rellena el emisor con la marca del tenant
 * en vez de reescribir aquí razón social, RUT y logo que ya están definidos
 * una vez para todo KIMOS (APP-SPEC §7.f).
 *
 * Los colores NO se traen: el host ya inyecta los de la marca como tokens del
 * tema, y esta app no cablea ninguno (APP-SPEC §9), así que se re-marca sola.
 */
function BrandImportBtn() {
  const [ocupado, setOcupado] = useState(false);
  const motivo = marcaNoDisponible();
  if (motivo) return h('span', { className: 'cz-card-note', title: motivo }, 'sin marca del sistema');
  return h(Btn, {
    size: 'sm', disabled: ocupado,
    title: 'Rellena estos campos con la marca definida para todo KIMOS. Después puedes ajustarlos solo para este cotizador.',
    onClick: () => {
      setOcupado(true);
      Promise.resolve().then(actImportBrand).then(() => setOcupado(false), () => setOcupado(false));
    },
  }, ocupado ? 'Trayendo…' : '🏷 Traer de la marca');
}
