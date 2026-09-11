/* ══ SEGUIMIENTO ══════════════════════════════════════════════════════════
 *
 * El tablero para gestionar el embudo: qué hay, cuánto vale, qué vence y qué
 * pide atención hoy.
 *
 * Decisiones de visualización, en el orden en que se toman:
 *
 * 1. FORMA ANTES QUE COLOR. Las cifras de cabecera son números sueltos, así
 *    que van como fichas de dato (KPI), no como un gráfico de una barra. El
 *    reparto por estado es magnitud comparada → barras. La evolución mensual
 *    es una serie temporal → columnas. Lo que pide atención es una lista, no
 *    un gráfico.
 *
 * 2. NI UNA PALETA CATEGÓRICA. La tentación era pintar cada estado de un
 *    color, pero eso pone verde («ganada») y rojo («perdida») a distinguir el
 *    dato más importante del tablero, y ese par tiene una separación de ΔE 4
 *    bajo deuteranopia: para una parte de las personas son el mismo color.
 *    Así que la magnitud la codifica la LONGITUD de la barra en un solo tono
 *    y la identidad la llevan la etiqueta y el chip de estado, que ya son
 *    texto. Nadie depende del color para leer el tablero.
 *
 * 3. EL TONO SALE DE LA TINTA DEL TEMA, no del acento. El acento de KIMOS es
 *    un cian claro: como relleno sobre fondo claro no llega a 3:1 de
 *    contraste. Derivar la barra de `--foreground` garantiza el contraste en
 *    modo día y en modo noche por construcción, sin cablear ningún color
 *    (APP-SPEC §9). El acento queda para el chrome interactivo.
 *
 * 4. Énfasis en vez de más colores: la columna del mes en curso va a tinta
 *    plena y el resto atenuadas.
 */

/** Agrupa las cotizaciones por mes de emisión, en orden cronológico. */
function porMes(quotes, rules, meses) {
  const n = clamp(Math.round(num(meses, 12)), 3, 24);
  const hoy = new Date();
  const claves = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    claves.push({
      key: d.toISOString().slice(0, 7),
      label: MESES[d.getUTCMonth()].slice(0, 3),
      year: d.getUTCFullYear(),
      total: 0, count: 0, won: 0,
    });
  }
  const byKey = new Map(claves.map((c) => [c.key, c]));
  for (const q of arr(quotes)) {
    const c = byKey.get(s(q.date).slice(0, 7));
    if (!c) continue;
    const t = computeTotals(q, rules).total;
    c.total += t;
    c.count++;
    if (effectiveStatus(q, rules) === 'accepted') c.won += t;
  }
  return claves;
}

/** Lo que pide atención hoy, ordenado por urgencia. */
function requiereAtencion(quotes, rules) {
  const out = [];
  for (const q of arr(quotes)) {
    const st = effectiveStatus(q, rules);
    const until = validUntilOf(q, rules);
    const dias = diasHasta(until);
    if (q.supersededBy) continue;              // ya la relevó una revisión
    if (st === 'expired') {
      out.push({ doc: q, orden: 0, motivo: 'Venció' + (until ? ' el ' + fechaCorta(until) : '') + ' sin respuesta' });
    } else if (st === 'sent' && dias != null && dias <= 3) {
      out.push({
        doc: q, orden: 1,
        motivo: dias <= 0 ? 'Vence hoy' : 'Vence en ' + dias + (dias === 1 ? ' día' : ' días'),
      });
    } else if (st === 'draft') {
      const edad = diasHasta(q.date);
      if (edad != null && edad <= -7) out.push({ doc: q, orden: 2, motivo: 'Borrador de hace ' + Math.abs(edad) + ' días, sin enviar' });
    }
  }
  return out.sort((a, b) => a.orden - b.orden || s(a.doc.date).localeCompare(s(b.doc.date)));
}

/** Los clientes que más pesan, por valor cotizado. */
function porCliente(quotes, rules, limite) {
  const mapa = new Map();
  for (const q of arr(quotes)) {
    const nombre = s(q.client.name) || 'Sin cliente';
    const clave = canon(nombre) || 'sin-cliente';
    const t = computeTotals(q, rules).total;
    const acc = mapa.get(clave) || { nombre, total: 0, ganado: 0, count: 0 };
    acc.total += t;
    acc.count++;
    if (effectiveStatus(q, rules) === 'accepted') acc.ganado += t;
    mapa.set(clave, acc);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, clamp(Math.round(num(limite, 6)), 1, 20));
}

// ── Pantalla ────────────────────────────────────────────────────────────
function BoardTab(props) {
  const m = props.m;
  const rules = normalizeRules(m.def.rules);
  const cur = currencyOf(null, rules);
  const quotes = quotesOf();
  const resumen = pipelineSummary();
  const meses = porMes(quotes, rules, 12);
  const atencion = requiereAtencion(quotes, rules);
  const clientes = porCliente(quotes, rules, 6);

  if (!quotes.length) {
    return h('div', { className: 'cz-tab' }, h(Empty, {
      icon: '📊',
      title: 'Nada que seguir todavía',
      text: 'Cuando haya cotizaciones, aquí verás cuánto hay en juego, qué está por vencer y qué se ganó.',
      action: h(Btn, { variant: 'primary', onClick: () => actSetTab('quotes') }, 'Ir a Cotizaciones'),
    }));
  }

  const cerradas = resumen.byStatus.accepted.count + resumen.byStatus.rejected.count;
  const conversion = cerradas ? Math.round((resumen.byStatus.accepted.count / cerradas) * 100) : null;
  const ticket = resumen.count ? resumen.total / resumen.count : 0;

  return h('div', { className: 'cz-tab cz-board' }, [
    // ── Fichas de dato ───────────────────────────────────────────────
    h('div', { key: 'kpi', className: 'cz-kpis' }, [
      h(Kpi, { key: 'a', label: 'En juego', value: money(resumen.open, cur), sub: resumen.byStatus.sent.count + ' enviada(s) vigente(s)', destacado: true }),
      h(Kpi, { key: 'b', label: 'Ganado', value: money(resumen.won, cur), sub: resumen.byStatus.accepted.count + ' aceptada(s)' }),
      h(Kpi, { key: 'c', label: 'Cotizado en total', value: money(resumen.total, cur), sub: resumen.count + ' cotización(es)' }),
      h(Kpi, {
        key: 'd', label: 'Tasa de cierre',
        value: conversion == null ? '—' : conversion + '%',
        sub: conversion == null ? 'aún no hay cerradas' : cerradas + ' cerrada(s)',
      }),
      h(Kpi, { key: 'e', label: 'Ticket medio', value: money(ticket, cur), sub: 'por cotización' }),
    ]),

    // ── Requiere atención ────────────────────────────────────────────
    h('section', { key: 'at', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Requiere atención'),
        h('span', { key: 'n', className: 'cz-card-note' },
          atencion.length ? atencion.length + ' cotización(es)' : 'nada pendiente por ahora'),
      ]),
      atencion.length
        ? h('ul', { key: 'l', className: 'cz-atlist' }, atencion.slice(0, 12).map(({ doc, motivo }) => h('li', {
          key: doc.id, className: 'cz-atrow',
        }, [
          h('button', {
            key: 'b', type: 'button', className: 'cz-atrow-b', onClick: () => actOpen(doc.id),
          }, [
            h('span', { key: 'n', className: 'cz-mono cz-dim' }, doc.number || '—'),
            h('span', { key: 't', className: 'cz-atrow-t' }, doc.name),
            h('span', { key: 'c', className: 'cz-atrow-c cz-dim' }, doc.client.name || '—'),
            h('span', { key: 'm', className: 'cz-atrow-m' }, motivo),
            h('span', { key: 'v', className: 'cz-mono cz-strong' }, money(computeTotals(doc, rules).total, cur)),
          ]),
        ])))
        : h('div', { key: 'e', className: 'cz-dim' }, 'Ninguna vence pronto, ninguna venció sin respuesta y no hay borradores olvidados.'),
    ]),

    // ── Reparto por estado ───────────────────────────────────────────
    h('section', { key: 'st', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Por estado'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'La longitud de la barra es el valor cotizado.'),
      ]),
      h('table', { key: 'tb', className: 'cz-table cz-magtable' }, [
        h('thead', { key: 'h' }, h('tr', null, [
          h('th', { key: 's', className: 'cz-th' }, 'Estado'),
          h('th', { key: 'c', className: 'cz-th cz-right' }, 'Nº'),
          h('th', { key: 'b', className: 'cz-th' }, ''),
          h('th', { key: 'v', className: 'cz-th cz-right' }, 'Valor'),
        ])),
        h('tbody', { key: 'b' }, STATUSES.map(([k, label]) => {
          const fila = resumen.byStatus[k] || { count: 0, total: 0 };
          const max = Math.max.apply(null, STATUSES.map(([j]) => (resumen.byStatus[j] || {}).total || 0).concat([1]));
          return h('tr', { key: k, className: cx('cz-magrow', !fila.count && 'vacia') }, [
            h('td', { key: 's' }, h(StatusChip, { status: k })),
            h('td', { key: 'c', className: 'cz-mono cz-right' }, fila.count || '—'),
            h('td', { key: 'b', className: 'cz-magcell' }, h('div', {
              className: 'cz-bar', title: label + ': ' + money(fila.total, cur) + ' en ' + fila.count + ' cotización(es)',
            }, h('div', { className: 'cz-bar-fill', style: { width: (fila.total / max * 100).toFixed(1) + '%' } }))),
            h('td', { key: 'v', className: 'cz-mono cz-right cz-strong' }, fila.total ? money(fila.total, cur) : '—'),
          ]);
        })),
      ]),
    ]),

    // ── Evolución mensual ────────────────────────────────────────────
    h('section', { key: 'mes', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Cotizado por mes'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Últimos 12 meses · el mes en curso destacado'),
      ]),
      h(ColumnChart, { key: 'c', datos: meses, cur }),
    ]),

    // ── Clientes ─────────────────────────────────────────────────────
    h('section', { key: 'cl', className: 'cz-card' }, [
      h('div', { key: 'h', className: 'cz-card-hd' }, [
        h('h3', { key: 't' }, 'Clientes con más peso'),
        h('span', { key: 'n', className: 'cz-card-note' }, 'Por valor cotizado; en oscuro, lo ya ganado.'),
      ]),
      h('table', { key: 'tb', className: 'cz-table cz-magtable' }, [
        h('thead', { key: 'h' }, h('tr', null, [
          h('th', { key: 'c', className: 'cz-th' }, 'Cliente'),
          h('th', { key: 'n', className: 'cz-th cz-right' }, 'Nº'),
          h('th', { key: 'b', className: 'cz-th' }, ''),
          h('th', { key: 'v', className: 'cz-th cz-right' }, 'Cotizado'),
        ])),
        h('tbody', { key: 'b' }, clientes.map((c) => {
          const max = clientes[0].total || 1;
          return h('tr', { key: c.nombre, className: 'cz-magrow' }, [
            h('td', { key: 'c' }, c.nombre),
            h('td', { key: 'n', className: 'cz-mono cz-right' }, c.count),
            h('td', { key: 'b', className: 'cz-magcell' }, h('div', {
              className: 'cz-bar',
              title: c.nombre + ': ' + money(c.total, cur) + ' cotizado, ' + money(c.ganado, cur) + ' ganado',
            }, [
              h('div', { key: 'f', className: 'cz-bar-fill', style: { width: (c.total / max * 100).toFixed(1) + '%' } }),
              c.ganado ? h('div', { key: 'w', className: 'cz-bar-won', style: { width: (c.ganado / max * 100).toFixed(1) + '%' } }) : null,
            ])),
            h('td', { key: 'v', className: 'cz-mono cz-right cz-strong' }, money(c.total, cur)),
          ]);
        })),
      ]),
    ]),
  ]);
}

/** Ficha de dato: un número con su etiqueta y su contexto. */
function Kpi(props) {
  const p = props || {};
  return h('div', { className: cx('cz-kpi', p.destacado && 'on') }, [
    h('div', { key: 'l', className: 'cz-kpi-l' }, p.label),
    h('div', { key: 'v', className: 'cz-kpi-v cz-mono' }, p.value),
    p.sub ? h('div', { key: 's', className: 'cz-kpi-s' }, p.sub) : null,
  ]);
}

/**
 * Columnas de una sola serie. Sin librería: la altura de cada columna es el
 * dato, el mes en curso va a tinta plena y el resto atenuadas (énfasis en
 * lugar de más colores), y cada columna lleva su valor en el tooltip.
 */
function ColumnChart(props) {
  const { datos, cur } = props;
  const max = Math.max.apply(null, arr(datos).map((d) => d.total).concat([1]));
  const ultimo = arr(datos).length - 1;
  return h('div', { className: 'cz-cols' }, arr(datos).map((d, i) => h('div', {
    key: d.key, className: cx('cz-col', i === ultimo && 'on', !d.total && 'vacia'),
    title: d.label + ' ' + d.year + ': ' + money(d.total, cur) + ' en ' + d.count + ' cotización(es)'
      + (d.won ? ' · ' + money(d.won, cur) + ' ganado' : ''),
  }, [
    h('div', { key: 'b', className: 'cz-col-bar' }, h('div', {
      className: 'cz-col-fill',
      // Altura mínima visible para un mes con datos: una barra de 0 px no se
      // distingue de un mes sin nada, y son cosas distintas.
      style: { height: d.total ? Math.max(3, (d.total / max) * 100) + '%' : '0' },
    })),
    h('div', { key: 'l', className: 'cz-col-l' }, d.label),
  ])));
}
