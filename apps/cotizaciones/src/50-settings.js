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
        h('span', { key: 'n', className: 'cz-card-note' },
          'Quién FACTURA: uno solo, aunque se cotice con varias marcas.'),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, { key: 'n', label: 'Razón social' },
          h(Input, { value: issuer.name, placeholder: 'Razón social de la empresa', onChange: (e) => actPatchIssuer({ name: e.target.value }) })),
        h(Field, { key: 'r', label: 'RUT / ID fiscal' },
          h(Input, { mono: true, value: issuer.taxId, placeholder: 'Con o sin puntos', onChange: (e) => actPatchIssuer({ taxId: e.target.value }) })),
        h(Field, { key: 'e', label: 'Correo' },
          h(Input, { type: 'email', value: issuer.email, placeholder: 'contacto@ejemplo.com', onChange: (e) => actPatchIssuer({ email: e.target.value }) })),
        h(Field, { key: 'p', label: 'Teléfono' },
          h(Input, { value: issuer.phone, placeholder: '+00 000 000 000', onChange: (e) => actPatchIssuer({ phone: e.target.value }) })),
        h(Field, { key: 'w', label: 'Sitio web' },
          h(Input, { value: issuer.web, placeholder: 'ejemplo.com', onChange: (e) => actPatchIssuer({ web: e.target.value }) })),
        h(Field, { key: 'd', label: 'Dirección' },
          h(Input, { value: issuer.address, placeholder: 'Calle 123, Comuna, Ciudad', onChange: (e) => actPatchIssuer({ address: e.target.value }) })),
        h(Field, {
          key: 'sl', label: 'Bajada', wide: true,
          help: 'Una línea bajo la razón social. Si la cotización lleva marca, manda la bajada de la marca.',
        }, h(Input, { value: issuer.tagline, placeholder: 'Una línea que describe a la empresa', onChange: (e) => actPatchIssuer({ tagline: e.target.value }) })),
        h(Field, {
          key: 'lg', label: 'Logo de respaldo', wide: true,
          help: 'El que se usa cuando la cotización NO lleva marca. Con marca, manda el logotipo de la marca.',
        }, h(ImageField, { value: issuer.logoUrl, folder: 'logos', onChange: (v) => actPatchIssuer({ logoUrl: v }) })),
        h(Field, {
          key: 'pi', label: 'Datos de pago / transferencia', wide: true,
          help: 'Se copian al pie de cada cotización nueva; cada una puede cambiarlos.',
        }, h(AutoArea, {
          minRows: 4, value: issuer.paymentInfo,
          placeholder: 'Razón social\nRUT\nBanco\nTipo de cuenta\nN.º de cuenta\nCorreo de aviso',
          onChange: (e) => actPatchIssuer({ paymentInfo: e.target.value }),
        })),
      ]),
    ]),

    // ── Marca ────────────────────────────────────────────────────────
    // El reparto que hay que entender de una vez: la marca es cómo se VE la
    // propuesta y va por cotización; el emisor es quién FACTURA y es uno.
    h('section', { key: 'br', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Marca'),
        h('span', { key: 'n', className: 'cz-card-note' },
          'Cómo se VE la propuesta: logotipo, bajada y colores.'),
      ]),
      h('div', { key: 'g', className: 'cz-grid2' }, [
        h(Field, {
          key: 'b', label: 'Marca con la que nace una cotización nueva', wide: true,
          help: 'Cada cotización guarda la suya y se puede cambiar una por una desde su ficha. '
            + 'Todas las marcas del sistema están siempre disponibles.',
        }, h(BrandDefaultField, { m })),
      ]),
    ]),

    // ── Cobro en línea ───────────────────────────────────────────────
    // Apagado por defecto: cobrar es una decisión de negocio, no algo que
    // deba empezar a pasar porque se actualizó la app.
    h(PayCard, { key: 'pay', m, rules }),

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
 * Cobro en línea: qué pasarelas se ofrecen y qué se cobra.
 *
 * Lo que se elige aquí es un SUBCONJUNTO de lo que la empresa tenga activo.
 * Las llaves de las pasarelas las pone un superadmin en Ajustes →
 * Integraciones; esta app no las ve ni puede activarlas, solo decidir cuáles
 * de las que ya funcionan aparecen en sus cotizaciones.
 */
function PayCard(props) {
  const { m, rules } = props;
  const pay = m.pay || { providers: [], available: [] };
  const motivo = cobroNoDisponible();
  useEffect(() => { loadPayInfo(false); }, []);

  const activas = arr(pay.providers).filter((p) => p && p.active);
  const elegidas = arr(rules.payProviders);
  const alternar = (id) => {
    const hay = elegidas.indexOf(id) >= 0;
    const next = hay ? elegidas.filter((x) => x !== id) : elegidas.concat([id]);
    // Marcarlas todas equivale a no elegir ninguna, y «ninguna» es mejor:
    // así una pasarela que se active mañana entra sola.
    actPatchRules({ payProviders: next.length === activas.length ? [] : next });
  };

  const cuerpo = () => {
    if (motivo) return h('span', { className: 'cz-card-note' }, motivo);
    if (pay.error) return h('span', { className: 'cz-card-note cz-warn' }, pay.error);
    if (pay.loading && !pay.loaded) return h('span', { className: 'cz-card-note' }, 'Leyendo pasarelas…');
    if (!activas.length) {
      return h('span', { className: 'cz-card-note' },
        'Todavía no hay ninguna pasarela de pago activa. Las configura un administrador en '
        + 'Ajustes → Integraciones → Pasarelas de pago; aquí aparecerán solas.');
    }
    return h('div', { className: 'cz-grid2' }, [
      h(Field, {
        key: 'on', label: 'Cobro en línea', wide: true,
        help: 'Cada cotización puede llevar un enlace de pago que el cliente abre y paga con tarjeta.',
      }, h(Toggle, {
        checked: rules.payEnabled, label: rules.payEnabled ? 'Activado' : 'Desactivado',
        onChange: (v) => actPatchRules({ payEnabled: v }),
      })),
      !rules.payEnabled ? null : h(Field, {
        key: 'pr', label: 'Formas de pago que se ofrecen', wide: true,
        help: elegidas.length
          ? 'Solo las marcadas. Una pasarela que se active más adelante NO entrará sola.'
          : 'Todas las que la empresa tenga activas, ahora y en el futuro. Es lo recomendable.',
      }, h('div', { className: 'cz-inline' }, activas.map((p) => h(Toggle, {
        key: p.id,
        checked: !elegidas.length || elegidas.indexOf(p.id) >= 0,
        label: p.label,
        onChange: () => alternar(p.id),
      })))),
      !rules.payEnabled ? null : h(Field, {
        key: 'ch', label: 'Qué se cobra',
        help: rules.payCharge === 'advance'
          ? 'El abono. La cotización sigue abierta por el saldo, y no se marca como ganada.'
          : 'El total de la propuesta. Al pagarse, la cotización pasa a aceptada.',
      }, h(Select, {
        value: rules.payCharge,
        onChange: (e) => actPatchRules({ payCharge: e.target.value }),
        options: [
          { value: 'total', label: 'El total de la cotización' },
          { value: 'advance', label: 'Solo el abono' + (rules.advanceEnabled ? ' (' + rules.advancePct + '%)' : ' — actívalo abajo') },
        ],
      })),
      !rules.payEnabled ? null : h(Field, {
        key: 'ex', label: 'El enlace vence en', help: 'Días desde que se genera.',
      }, h('div', { className: 'cz-inline' }, [
        h(NumField, { key: 'n', value: rules.payExpiresDays, onChange: (v) => actPatchRules({ payExpiresDays: num(v) }) }),
        h('span', { key: 'u', className: 'cz-unit' }, 'días'),
      ])),
      !rules.payEnabled ? null : h(Field, {
        key: 'os', label: 'Al marcar como enviada', wide: true,
        help: 'Genera el enlace sin que haya que pedirlo, para que entre en el PDF que se manda.',
      }, h(Toggle, {
        checked: rules.payOnSend, label: 'Generar el enlace de cobro',
        onChange: (v) => actPatchRules({ payOnSend: v }),
      })),
    ]);
  };

  return h('section', { className: 'cz-card' }, [
    h('div', { key: 'h', className: 'cz-card-hd' }, [
      h('h3', { key: 't' }, 'Cobro en línea'),
      h('span', { key: 'n', className: 'cz-card-note' }, 'Un enlace de pago en cada propuesta.'),
    ]),
    h('div', { key: 'b' }, cuerpo()),
  ]);
}

/**
 * Con qué marca NACE una cotización nueva.
 *
 * No es «la marca del cotizador»: cada cotización guarda la suya y se puede
 * cambiar una por una. Esto solo fija con cuál empieza, para no elegirla a
 * mano treinta veces cuando casi siempre es la misma.
 *
 * Vacío = la marca por defecto del registro, que es lo que quiere casi todo
 * el mundo y lo que sigue funcionando si mañana cambia cuál es.
 */
function BrandDefaultField(props) {
  const m = props.m;
  const rules = normalizeRules(m.def.rules);
  const br = m.brands || { list: [] };
  useEffect(() => { loadBrands(false); }, []);

  if (marcasNoDisponibles()) {
    return h('span', { className: 'cz-card-note' }, 'Este KIMOS no tiene registro de marcas.');
  }
  if (br.error) return h('span', { className: 'cz-card-note cz-warn' }, br.error);
  if (br.loading && !br.loaded) return h('span', { className: 'cz-card-note' }, 'Leyendo marcas…');
  if (!arr(br.list).length) {
    return h('span', { className: 'cz-card-note' },
      'Todavía no hay marcas. Se crean en la app Marcas y quedan disponibles para todas las cotizaciones.');
  }
  const porDefecto = arr(br.list).find((b) => b.isDefault === true);
  return h(Select, {
    value: rules.brandId,
    onChange: (e) => actPatchRules({ brandId: e.target.value }),
    options: [{
      value: '',
      label: 'La marca por defecto del sistema' + (porDefecto ? ' (' + s(porDefecto.name) + ')' : ''),
    }].concat(arr(br.list).map((b) => ({ value: s(b.id), label: s(b.name) }))),
  });
}

