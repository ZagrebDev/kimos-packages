/**
 * LiDARia — consola de captura 3D de KIMOS.
 *
 * Esta app corre en el escritorio de KIMOS, que es justo donde NO hay LiDAR.
 * Por eso no intenta escanear: hace lo que el escritorio hace bien —decidir—.
 * Responde cuatro preguntas que hoy nadie en la organización puede responder:
 *
 *   1. ¿Qué puede capturar cada equipo que ya tenemos?
 *   2. ¿Qué módulos quedan cubiertos con ese parque, y cuáles no?
 *   3. ¿Cuánto cuesta construir cada módulo y en cuánto se paga?
 *   4. ¿Qué bibliotecas pueden entrar al producto sin problema legal?
 *
 * El motor es el mismo núcleo que corre en el teléfono (repo kimos-LiDARia):
 * `build.mjs` lo incrusta encima de este archivo, así que aquí se usan sus
 * funciones directamente (identificar, resolver, diagnosticar, economiaCartera,
 * auditar) sin importar nada en tiempo de ejecución.
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.0.0';

const DATOS = /* DATOS_INLINE */ null;

/* ------------------------------- utilidades ------------------------------- */

const usd = (n) => (n == null || !isFinite(n) ? '—' : '$' + Math.round(n).toLocaleString('es-CL'));
const pct = (n, d) => (n == null || !isFinite(n) ? '—' : (n * 100).toFixed(d == null ? 0 : d) + '%');
const meses = (n) => (!isFinite(n) ? 'nunca' : n.toFixed(1) + ' m');
const cm = (m) => (m == null ? '—' : (m < 0.01 ? (m * 1000).toFixed(0) + ' mm' : (m * 100).toFixed(1) + ' cm'));

const TABS = [
  ['panel', 'Panel', '🛰️'],
  ['modulos', 'Módulos', '🧩'],
  ['inventario', 'Inventario', '🎒'],
  ['equipos', 'Equipos', '📱'],
  ['negocio', 'Negocio', '📈'],
  ['plan', 'Plan', '🗺️'],
  ['licencias', 'Licencias', '⚖️'],
];

const ESTADO_ICO = { completo: '✅', degradado: '🟡', potencial: '🔓', visor: '👁️', 'no-disponible': '⛔' };
const ESTADO_LBL = { completo: 'Completo', degradado: 'Degradado', potencial: 'Al alcance', visor: 'Solo lectura', 'no-disponible': 'No disponible' };
const ORDEN_ESTADO = ['completo', 'degradado', 'potencial', 'visor', 'no-disponible'];

const equipoPorId = (id) => DATOS.devices.equipos.filter((e) => e.id === id)[0] || null;
const moduloPorId = (id) => DATOS.modules.modulos.filter((m) => m.id === id)[0] || null;
const filaMatriz = (id) => DATOS.matriz.filter((f) => f.equipo === id)[0] || null;

/** Mejor estado que alcanza un equipo para un módulo (con app nativa si existe). */
function estadoDe(equipoId, moduloId) {
  const f = filaMatriz(equipoId);
  if (!f) return 'no-disponible';
  const nativo = f.nativo && f.nativo.modulos[moduloId];
  const web = f.web && f.web.modulos[moduloId];
  const cands = [nativo, web].filter(Boolean);
  if (!cands.length) return 'no-disponible';
  return cands.sort((a, b) => ORDEN_ESTADO.indexOf(a) - ORDEN_ESTADO.indexOf(b))[0];
}

/**
 * Cobertura de la organización: con el parque registrado, qué módulos quedan
 * realmente cubiertos. Es la pregunta que decide si hay que comprar un equipo.
 */
function cobertura(inventario) {
  const porModulo = {};
  for (const m of DATOS.modules.modulos) {
    let mejor = 'no-disponible';
    const equipos = [];
    for (const item of inventario) {
      const e = estadoDe(item.equipo, m.id);
      if (ORDEN_ESTADO.indexOf(e) < ORDEN_ESTADO.indexOf(mejor)) mejor = e;
      if (e === 'completo' || e === 'degradado') equipos.push(item);
    }
    porModulo[m.id] = { estado: mejor, equipos: equipos };
  }
  const cuenta = (e) => Object.values(porModulo).filter((x) => x.estado === e).length;
  return {
    porModulo,
    resumen: {
      completos: cuenta('completo'),
      degradados: cuenta('degradado'),
      sinCubrir: cuenta('visor') + cuenta('no-disponible') + cuenta('potencial'),
      total: DATOS.modules.modulos.length,
      unidades: inventario.reduce((a, i) => a + (i.cantidad || 1), 0),
    },
  };
}

/** Qué equipo conviene sumar para cubrir un módulo que hoy no se cubre. */
function recomendarPara(moduloId, inventario) {
  const yaTengo = new Set(inventario.map((i) => i.equipo));
  const candidatos = DATOS.devices.equipos
    .filter((e) => !yaTengo.has(e.id) && estadoDe(e.id, moduloId) === 'completo')
    .map((e) => {
      // Se prefiere el equipo que además cubra más módulos: comprar una vez.
      const extra = DATOS.modules.modulos.filter((m) => estadoDe(e.id, m.id) === 'completo').length;
      return { equipo: e, cubre: extra };
    })
    .sort((a, b) => b.cubre - a.cubre);
  return candidatos.slice(0, 3);
}

function estadoInicial() {
  return {
    v: 1,
    tab: 'panel',
    inventario: [],
    sup: Object.assign({}, SUPUESTOS_BASE),
    filtro: '',
    moduloSel: null,
    diag: null,          // diagnóstico del equipo donde corre el shell
    urlApp: 'https://lidaria.kimos.dev',
    copiado: false,
  };
}

/* ---------------------------------- mount --------------------------------- */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  let estado = estadoInicial();
  const oyentes = new Set();

  function commit(patch) {
    estado = Object.assign({}, estado, patch);
    oyentes.forEach((f) => f(estado));
    programarGuardado();
  }

  let timer = null;
  function programarGuardado() {
    if (!shell || typeof shell.saveData !== 'function') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { v, tab, inventario, sup, urlApp } = estado;
      Promise.resolve(shell.saveData({ v, tab, inventario, sup, urlApp })).catch(() => {});
    }, 800);
  }

  async function restaurar() {
    if (!shell || typeof shell.loadData !== 'function') return;
    try {
      const d = await shell.loadData();
      if (!d || typeof d !== 'object') return;
      const patch = {};
      if (d.tab && TABS.some((t) => t[0] === d.tab)) patch.tab = d.tab;
      if (Array.isArray(d.inventario)) patch.inventario = d.inventario.filter((i) => i && equipoPorId(i.equipo));
      if (d.sup) patch.sup = Object.assign({}, SUPUESTOS_BASE, d.sup);
      if (typeof d.urlApp === 'string') patch.urlApp = d.urlApp;
      estado = Object.assign({}, estado, patch);
      oyentes.forEach((f) => f(estado));
    } catch (e) { /* primera apertura */ }
  }

  /** Diagnóstico del propio equipo donde corre el escritorio de KIMOS. */
  async function diagnosticarAqui() {
    try {
      const evid = await detectar(globalThis);
      evid.enShellKimos = true;
      const ident = identificar(evid, DATOS.devices, {});
      const r = resolver(evid, ident.equipo, null);
      const inf = diagnosticar(
        { caps: r.caps, potenciales: r.potenciales, evid, equipo: ident.equipo, identificacion: ident },
        DATOS.modules,
      );
      commit({ diag: inf });
    } catch (e) {
      commit({ diag: { error: String((e && e.message) || e) } });
    }
  }

  /* ------------------------------- acciones ------------------------------- */

  function agregarEquipo(equipoId, etiqueta, cantidad) {
    const e = equipoPorId(equipoId);
    if (!e) return { ok: false, error: 'Equipo desconocido: ' + equipoId };
    const n = Math.max(1, Math.min(9999, Math.round(Number(cantidad) || 1)));
    const inv = estado.inventario.slice();
    const i = inv.findIndex((x) => x.equipo === equipoId);
    if (i >= 0) inv[i] = Object.assign({}, inv[i], { cantidad: (inv[i].cantidad || 1) + n });
    else inv.push({ equipo: equipoId, etiqueta: String(etiqueta || e.nombre).slice(0, 60), cantidad: n });
    commit({ inventario: inv });
    return { ok: true, mensaje: e.nombre + ' × ' + n + ' en el inventario' };
  }

  function quitarEquipo(equipoId) {
    const inv = estado.inventario.filter((x) => x.equipo !== equipoId);
    if (inv.length === estado.inventario.length) return { ok: false, error: 'Ese equipo no está en el inventario' };
    commit({ inventario: inv });
    return { ok: true, mensaje: 'Equipo quitado' };
  }

  function setSup(clave, valor) {
    const n = Number(valor);
    if (!isFinite(n)) return { ok: false, error: 'Valor no numérico' };
    if (!(clave in SUPUESTOS_BASE)) return { ok: false, error: 'Supuesto desconocido: ' + clave };
    commit({ sup: Object.assign({}, estado.sup, { [clave]: n }) });
    return { ok: true, mensaje: clave + ' = ' + n };
  }

  function copiarEnlace() {
    const url = estado.urlApp;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          commit({ copiado: true });
          setTimeout(() => commit({ copiado: false }), 2000);
        });
      }
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Enlace copiado: ' + url });
    } catch (e) {
      if (shell && shell.notify) shell.notify({ level: 'warn', text: 'Copia manualmente: ' + url });
    }
  }

  function exportarCSV() {
    const cab = ['Equipo', 'Clase', 'Plataforma'].concat(DATOS.modules.modulos.map((m) => m.nombre));
    const filas = DATOS.devices.equipos.map((e) => [e.nombre, e.clase, e.plataforma]
      .concat(DATOS.modules.modulos.map((m) => ESTADO_LBL[estadoDe(e.id, m.id)])));
    const csv = [cab].concat(filas).map((f) => f.map((c) => {
      const s = c == null ? '' : String(c);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\n');
    try {
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'lidaria-compatibilidad.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Matriz exportada' });
    } catch (e) {
      if (shell && shell.notify) shell.notify({ level: 'error', text: 'No se pudo exportar' });
    }
  }

  /* ------------------------------ piezas de UI ------------------------------ */

  const card = (titulo, cuerpo, opciones) => {
    const o = opciones || {};
    return h('section', { className: 'ld-card' + (o.clase ? ' ' + o.clase : ''), key: o.key },
      titulo ? h('h2', null, titulo) : null,
      o.hint ? h('p', { className: 'ld-hint' }, o.hint) : null,
      cuerpo);
  };

  const kpi = (k, v, n) => h('div', { className: 'ld-kpi', key: k },
    h('div', { className: 'ld-kpi-k' }, k),
    h('div', { className: 'ld-kpi-v' }, v),
    n ? h('div', { className: 'ld-kpi-n' }, n) : null);

  const chip = (texto, clase, titulo) => h('span', { className: 'ld-chip' + (clase ? ' ' + clase : ''), title: titulo || null, key: texto }, texto);

  const pastilla = (estado) => h('span', { className: 'ld-est ld-e-' + estado, title: ESTADO_LBL[estado] },
    ESTADO_ICO[estado], ' ', ESTADO_LBL[estado]);

  function tabla(cols, filas, opts) {
    const o = opts || {};
    return h('div', { className: 'ld-tbl-wrap' },
      h('table', { className: 'ld-tbl' },
        h('thead', null, h('tr', null, cols.map((c) => h('th', { key: c.k, className: c.num ? 'ld-num' : null }, c.l)))),
        h('tbody', null, filas.map((f, i) => h('tr', { key: o.key ? o.key(f, i) : i, className: o.clase ? o.clase(f) : null },
          cols.map((c) => h('td', { key: c.k, className: c.num ? 'ld-num' : null }, c.cell(f, i))))))));
  }

  const campo = (label, valor, onChange, opts) => {
    const o = opts || {};
    return h('label', { className: 'ld-campo', key: label },
      h('span', null, label),
      h('input', {
        type: o.type || 'number', value: valor, step: o.step || 'any', min: o.min, max: o.max,
        onChange: (e) => onChange(e.target.value),
      }),
      o.hint ? h('small', null, o.hint) : null);
  };

  /* --------------------------------- vistas --------------------------------- */

  function vistaPanel(cob, eco) {
    const d = estado.diag;
    const f1 = eco.porFase.filter((p) => p.fase === 1)[0];

    const aquí = !d ? h('p', { className: 'ld-hint' }, 'Analizando este equipo…')
      : d.error ? h('p', { className: 'ld-hint' }, 'No se pudo diagnosticar: ' + d.error)
      : h('div', null,
          h('div', { className: 'ld-kvs' },
            h('div', { className: 'ld-kv' }, h('span', null, 'Equipo'), h('b', null, d.equipo ? d.equipo.nombre : '—')),
            h('div', { className: 'ld-kv' }, h('span', null, 'Nivel'), h('b', null, d.nivel.label)),
            h('div', { className: 'ld-kv' }, h('span', null, 'Módulos completos aquí'), h('b', null, d.resumen.completos + ' de ' + d.resumen.total))),
          h('p', { className: 'ld-hint' }, d.nivel.desc),
          h('p', null, 'Para capturar hace falta un equipo con sensor. Abre la app en el teléfono correcto:'),
          h('div', { className: 'ld-fila' },
            h('input', { className: 'ld-input', value: estado.urlApp, onChange: (e) => commit({ urlApp: e.target.value.slice(0, 200) }) }),
            h('button', { className: 'ld-btn ld-pri', onClick: copiarEnlace }, estado.copiado ? '✓ Copiado' : 'Copiar enlace')));

    return h('div', null,
      card('🛰️ LiDARia, en una frase',
        h('div', null,
          h('p', null, 'Una sola app con ', h('b', null, DATOS.modules.modulos.length + ' módulos'),
            ' que se encienden según lo que cada equipo puede hacer de verdad. Nada de prometer un escaneo que el teléfono del usuario no puede dar.'),
          h('div', { className: 'ld-kpis' },
            kpi('Equipos en catálogo', DATOS.devices.equipos.length, 'de teléfono a tótem'),
            kpi('Módulos', DATOS.modules.modulos.length, 'en tres fases'),
            kpi('Fase 1', f1 ? f1.esfuerzoSemanas + ' sem' : '—', f1 ? 'se paga en ' + meses(f1.paybackMeses) : ''),
            kpi('Cobertura del inventario', cob.resumen.completos + '/' + cob.resumen.total, cob.resumen.unidades + ' equipo(s) registrados')))),
      card('🖥️ Este equipo (donde corre KIMOS)', aquí, { hint: 'El escritorio no captura: decide, revisa y exporta. Eso también es un rol del producto.' }),
      card('▶️ Próximo paso',
        h('ol', { className: 'ld-lista' },
          h('li', null, 'Registra en ', h('b', null, 'Inventario'), ' los equipos que ya tiene el equipo de trabajo.'),
          h('li', null, 'Mira en ', h('b', null, 'Módulos'), ' qué queda cubierto y qué no, y qué falta para cubrirlo.'),
          h('li', null, 'En ', h('b', null, 'Negocio'), ' mueve los supuestos con tus números: el orden de construcción sale de ahí.'),
          h('li', null, 'Antes de sumar una biblioteca, revísala en ', h('b', null, 'Licencias'), '.'))));
  }

  function vistaModulos(cob) {
    const sel = estado.moduloSel ? moduloPorId(estado.moduloSel) : null;
    const fichas = DATOS.modules.modulos.map((m) => {
      const c = cob.porModulo[m.id];
      const abierto = estado.moduloSel === m.id;
      return h('article', {
        key: m.id,
        className: 'ld-mod ld-b-' + c.estado + (abierto ? ' on' : ''),
        onClick: () => commit({ moduloSel: abierto ? null : m.id }),
      },
        h('header', null,
          h('span', { className: 'ld-mod-ico' }, m.icon),
          h('div', null, h('h3', null, m.nombre), h('p', { className: 'ld-mini' }, 'Fase ' + m.fase + (m.estrategico ? ' · estratégico' : ''))),
          pastilla(c.estado)),
        h('p', null, m.resumen),
        c.equipos.length
          ? h('p', { className: 'ld-mini' }, 'Cubierto por: ' + c.equipos.map((e) => e.etiqueta).join(', '))
          : h('p', { className: 'ld-mini' }, 'Sin equipo en el inventario que lo cubra.'));
    });

    const detalle = !sel ? null : (function () {
      const c = cob.porModulo[sel.id];
      const eco = economiaModulo(sel, estado.sup);
      const rec = c.estado === 'completo' ? [] : recomendarPara(sel.id, estado.inventario);
      return card(sel.icon + ' ' + sel.nombre,
        h('div', null,
          h('div', { className: 'ld-cols' },
            h('div', null,
              h('h4', null, 'El problema'), h('p', null, sel.problema),
              h('h4', null, 'Qué hace'), h('p', null, sel.solucion),
              h('h4', null, 'Si el equipo no da la talla'), h('p', null, sel.degradado),
              h('h4', null, 'Donde no puede correr'), h('p', null, sel.sinSoporte)),
            h('div', null,
              h('h4', null, 'Necesita'),
              h('div', { className: 'ld-chips' },
                (sel.requiere || []).map((x) => chip(etiquetaCap(x), 'req')),
                (sel.requiereAlguna || []).map((g, i) => chip(g.map(etiquetaCap).join(' o '), 'req', 'Basta una de estas'))),
              h('h4', null, 'Mejora con'),
              h('div', { className: 'ld-chips' }, (sel.prefiere || []).map((x) => chip(etiquetaCap(x), 'pref'))),
              h('h4', null, 'Se conecta con'),
              h('div', { className: 'ld-chips' }, (sel.kimos || []).map((k) => chip(k, 'kimos'))),
              h('h4', null, 'Entrega'),
              h('p', { className: 'ld-mini' }, (sel.salidas || []).join(' · ')))),
          h('div', { className: 'ld-kpis' },
            kpi('Precio sugerido', usd(eco.precioCuenta) + '/mes', eco.modelo),
            kpi('Inversión', usd(eco.inversion), eco.esfuerzoSemanas + ' semanas-persona'),
            kpi('Payback', meses(eco.paybackMeses), 'con ' + eco.cuentas + ' cuentas'),
            kpi('Valor para el cliente', eco.multiploValor.toFixed(1) + '×', 'por cada dólar que paga')),
          h('h4', null, 'Riesgos declarados'),
          h('ul', { className: 'ld-lista' }, (sel.riesgos || []).map((r, i) => h('li', { key: i }, r))),
          rec.length
            ? h('div', null,
                h('h4', null, 'Para cubrirlo, el equipo que más rinde'),
                h('ul', { className: 'ld-lista' }, rec.map((r) => h('li', { key: r.equipo.id },
                  h('b', null, r.equipo.nombre), ' — deja completos ' + r.cubre + ' módulos. ',
                  h('button', { className: 'ld-btn ld-mini-btn', onClick: () => agregarEquipo(r.equipo.id, r.equipo.nombre, 1) }, 'Añadir al inventario')))))
            : null),
        { clase: 'ld-detalle' });
    })();

    return h('div', null,
      card('Un producto, varios módulos',
        h('p', null, 'El estado de cada módulo es el mejor que alcanza algún equipo de tu inventario. Haz clic en un módulo para ver qué necesita, qué entrega, cuánto cuesta y en qué se apoya de KIMOS.'),
        { hint: 'Estados: ' + ORDEN_ESTADO.map((e) => ESTADO_ICO[e] + ' ' + ESTADO_LBL[e]).join(' · ') }),
      detalle,
      h('div', { className: 'ld-grid' }, fichas));
  }

  function etiquetaCap(id) {
    const c = CAP_POR_ID.get(id);
    return c ? (c.corto || c.label) : id;
  }

  function vistaInventario(cob) {
    const equipos = DATOS.devices.equipos;
    const filas = estado.inventario.map((i) => {
      const e = equipoPorId(i.equipo);
      const cubre = DATOS.modules.modulos.filter((m) => estadoDe(i.equipo, m.id) === 'completo').length;
      const f = filaMatriz(i.equipo);
      const mejor = (f && f.nativo) || (f && f.web);
      return { i, e, cubre, mejor };
    });

    const sinCubrir = DATOS.modules.modulos.filter((m) => ['visor', 'no-disponible', 'potencial'].includes(cob.porModulo[m.id].estado));

    return h('div', null,
      card('🎒 El parque real de la organización',
        h('div', null,
          h('p', null, 'Registra los equipos que ya existen. La cobertura de abajo se calcula con ellos, no con un catálogo ideal.'),
          h('div', { className: 'ld-fila' },
            h('select', {
              className: 'ld-input', value: '',
              onChange: (e) => { if (e.target.value) agregarEquipo(e.target.value, null, 1); },
            },
              h('option', { value: '' }, '+ Añadir equipo…'),
              equipos.map((e) => h('option', { key: e.id, value: e.id }, e.nombre))),
            h('button', { className: 'ld-btn', onClick: exportarCSV }, 'Exportar matriz CSV')),
          h('div', { className: 'ld-kpis' },
            kpi('Unidades', cob.resumen.unidades),
            kpi('Módulos completos', cob.resumen.completos + '/' + cob.resumen.total),
            kpi('Degradados', cob.resumen.degradados),
            kpi('Sin cubrir', cob.resumen.sinCubrir)))),

      filas.length ? card('Equipos registrados', tabla([
        { k: 'eq', l: 'Equipo', cell: (f) => h('div', null, h('b', null, f.e.nombre), h('div', { className: 'ld-mini' }, f.e.marca + ' · ' + f.e.plataforma)) },
        { k: 'n', l: 'Unidades', num: true, cell: (f) => h('input', {
            className: 'ld-input ld-num-input', type: 'number', min: 1, value: f.i.cantidad || 1,
            onChange: (e) => {
              const n = Math.max(1, Math.round(Number(e.target.value) || 1));
              const inv = estado.inventario.map((x) => (x.equipo === f.i.equipo ? Object.assign({}, x, { cantidad: n }) : x));
              commit({ inventario: inv });
            },
          }) },
        { k: 'sensor', l: 'Sensor', cell: (f) => (f.mejor && f.mejor.sensorLabel) || '—' },
        { k: 'err', l: 'Error a 3 m', num: true, cell: (f) => cm(f.mejor && f.mejor.errorA3m) },
        { k: 'cubre', l: 'Módulos completos', num: true, cell: (f) => f.cubre + ' / ' + DATOS.modules.modulos.length },
        { k: 'x', l: '', cell: (f) => h('button', { className: 'ld-btn ld-mini-btn', onClick: () => quitarEquipo(f.i.equipo) }, 'Quitar') },
      ], filas, { key: (f) => f.i.equipo })) : card(null, h('p', { className: 'ld-hint' }, 'Todavía no hay equipos registrados: añade uno arriba.')),

      sinCubrir.length ? card('Lo que hoy no se cubre — y con qué se cubriría',
        h('div', null, sinCubrir.map((m) => {
          const rec = recomendarPara(m.id, estado.inventario);
          return h('div', { className: 'ld-gap', key: m.id },
            h('b', null, m.icon + ' ' + m.nombre),
            h('span', { className: 'ld-mini' }, ' — ' + (cob.porModulo[m.id].estado === 'potencial' ? 'al alcance con la app nativa' : 'sin equipo capaz')),
            rec.length
              ? h('div', { className: 'ld-mini' }, 'Sumando ', h('b', null, rec[0].equipo.nombre), ' quedaría completo (y ' + rec[0].cubre + ' módulos en total).')
              : h('div', { className: 'ld-mini' }, 'Ningún equipo del catálogo lo deja completo: es trabajo de plataforma, no de compra.'));
        }))) : null);
  }

  function vistaEquipos() {
    const q = estado.filtro.toLowerCase();
    const equipos = DATOS.devices.equipos.filter((e) =>
      !q || (e.nombre + ' ' + e.marca + ' ' + e.nota + ' ' + e.plataforma).toLowerCase().indexOf(q) >= 0);
    const enInv = new Set(estado.inventario.map((i) => i.equipo));

    const cols = [
      { k: 'eq', l: 'Equipo', cell: (e) => h('div', null,
          h('b', null, e.nombre),
          h('div', { className: 'ld-mini' }, e.marca + ' · ' + e.plataforma + (e.confianza === 'verificado' ? '' : ' · ⚠ por confirmar')),
          h('div', { className: 'ld-mini' }, e.nota)) },
      { k: 'sensor', l: 'Sensor', cell: (e) => {
          const f = filaMatriz(e.id);
          const m = (f && f.nativo) || (f && f.web);
          return m && m.sensorLabel ? h('div', null, m.sensorLabel, h('div', { className: 'ld-mini' }, '±' + cm(m.errorA3m) + ' a 3 m')) : '—';
        } },
    ].concat(DATOS.modules.modulos.map((m) => ({
      k: m.id, l: m.icon, num: true,
      cell: (e) => h('span', { title: m.nombre + ': ' + ESTADO_LBL[estadoDe(e.id, m.id)] }, ESTADO_ICO[estadoDe(e.id, m.id)]),
    }))).concat([
      { k: 'add', l: '', cell: (e) => h('button', {
          className: 'ld-btn ld-mini-btn',
          onClick: () => (enInv.has(e.id) ? quitarEquipo(e.id) : agregarEquipo(e.id, e.nombre, 1)),
        }, enInv.has(e.id) ? 'Quitar' : 'Añadir') },
    ]);

    return h('div', null,
      card('📱 Qué puede cada equipo',
        h('div', null,
          h('p', null, 'Matriz calculada con el mismo motor que corre en el teléfono, suponiendo la app nativa instalada donde existe. Las columnas son los módulos.'),
          h('div', { className: 'ld-chips' }, DATOS.modules.modulos.map((m) => chip(m.icon + ' ' + m.nombre))),
          h('input', {
            className: 'ld-input', type: 'search', placeholder: 'Buscar equipo, marca, plataforma…',
            value: estado.filtro, onChange: (e) => commit({ filtro: e.target.value }),
          }))),
      card(null, tabla(cols, equipos, { key: (e) => e.id })));
  }

  function vistaNegocio(eco) {
    const S = [
      ['clientesKimos', 'Cuentas KIMOS', 'Cuántas cuentas activas se asumen en el horizonte del plan.'],
      ['usuariosPorCuenta', 'Usuarios de campo por cuenta', 'Multiplica los módulos con precio por usuario.'],
      ['costoSemanaUSD', 'Costo de una semana-persona (USD)', 'Costo cargado del equipo que construye.'],
      ['costoOperacionPct', 'Costo de operar (% del ingreso)', 'Soporte, infraestructura y cobranza. Sin esto el margen sale irreal.'],
      ['churnMensual', 'Baja mensual', 'Define la vida del cliente y con ella el LTV.'],
    ];

    const cols = [
      { k: 'mod', l: 'Módulo', cell: (f) => h('div', null, h('b', null, f.nombre), h('div', { className: 'ld-mini' }, 'Fase ' + f.fase + ' · ' + f.modelo)) },
      { k: 'ctas', l: 'Cuentas', num: true, cell: (f) => f.cuentas },
      { k: 'precio', l: 'Precio/cuenta', num: true, cell: (f) => usd(f.precioCuenta) },
      { k: 'ing', l: 'Ingreso/mes', num: true, cell: (f) => usd(f.ingresoMes) },
      { k: 'margen', l: 'Margen', num: true, cell: (f) => pct(f.margen) },
      { k: 'inv', l: 'Inversión', num: true, cell: (f) => usd(f.inversion) },
      { k: 'pb', l: 'Payback', num: true, cell: (f) => meses(f.paybackMeses) },
      { k: 'ret', l: 'Retorno año 1', num: true, cell: (f) => f.retornoAno1.toFixed(2) + '×' },
      { k: 'val', l: 'Valor cliente', num: true, cell: (f) => f.multiploValor.toFixed(1) + '×' },
      { k: 'ver', l: 'Veredicto', cell: (f) => h('span', { className: 'ld-ver-' + f.veredicto.nivel, title: f.veredicto.texto }, f.veredicto.texto) },
    ];

    return h('div', null,
      card('📈 La calculadora, no el informe',
        h('div', null,
          h('p', null, 'Todos los supuestos son editables y todo se recalcula al instante. Los valores de partida son ',
            h('b', null, 'estimaciones declaradas'), ', no ventas medidas: sirven para ordenar en qué orden construir, no para prometer una cifra.'),
          h('div', { className: 'ld-campos' }, S.map(([k, l, hint]) => campo(l, estado.sup[k], (v) => setSup(k, v), { hint: hint }))),
          h('div', { className: 'ld-kpis' },
            kpi('Ingreso mensual', usd(eco.total.ingresoMes), 'con toda la cartera construida'),
            kpi('Margen', pct(eco.total.margen), 'después de operar'),
            kpi('Inversión total', usd(eco.total.inversion), eco.total.esfuerzoSemanas + ' semanas-persona'),
            kpi('Payback', meses(eco.total.paybackMeses), 'de la cartera completa')))),

      card('Por fase — de aquí sale el orden de construcción',
        h('div', null,
          tabla([
            { k: 'f', l: 'Fase', cell: (p) => 'Fase ' + p.fase },
            { k: 'm', l: 'Módulos', num: true, cell: (p) => p.modulos },
            { k: 'e', l: 'Esfuerzo', num: true, cell: (p) => p.esfuerzoSemanas + ' sem' },
            { k: 'i', l: 'Inversión', num: true, cell: (p) => usd(p.inversion) },
            { k: 'a', l: 'ARR', num: true, cell: (p) => usd(p.arr) },
            { k: 'pb', l: 'Payback', num: true, cell: (p) => meses(p.paybackMeses) },
          ], eco.porFase, { key: (p) => p.fase }),
          h('p', { className: 'ld-hint' }, 'Si la fase 3 no se paga con estos supuestos, la conclusión no es "hagámosla igual": es que esos módulos solo se construyen cuando un cliente concreto los pague o cuando la cartera sea mayor.'))),

      card('Módulo por módulo', tabla(cols, eco.filas, { key: (f) => f.id })));
  }

  function vistaPlan(eco) {
    const fases = [
      { n: 0, titulo: 'Fase 0 · Que la app diga la verdad', meta: 'El diagnóstico es el producto mínimo: sin él, todo lo demás promete de más.' },
      { n: 1, titulo: 'Fase 1 · Lo que se paga solo', meta: 'Medir, escanear espacios y llevar productos al catálogo 3D. Es lo que se vende sin explicar.' },
      { n: 2, titulo: 'Fase 2 · Lo que multiplica lo anterior', meta: 'AR en la tienda, cubicaje y avance de obra: se apoyan en lo construido en la fase 1.' },
      { n: 3, titulo: 'Fase 3 · Solo con cliente que lo pague', meta: 'Gemelo digital, terreno, cuerpo y accesibilidad: valiosos, pero con payback largo en esta cartera.' },
    ];
    return h('div', null,
      card('🗺️ Plan por fases', h('p', null, 'Cada fase se cierra con algo que se puede vender y medir. El orden no es de gusto: sale de la calculadora de la pestaña Negocio.')),
      fases.map((f) => {
        const mods = DATOS.modules.modulos.filter((m) => m.fase === f.n);
        const p = eco.porFase.filter((x) => x.fase === f.n)[0];
        return card(f.titulo,
          h('div', null,
            h('p', null, f.meta),
            h('div', { className: 'ld-kpis' },
              kpi('Módulos', mods.length),
              kpi('Esfuerzo', (p ? p.esfuerzoSemanas : 0) + ' sem'),
              kpi('Inversión', usd(p ? p.inversion : 0)),
              kpi('Payback', meses(p ? p.paybackMeses : Infinity))),
            h('ul', { className: 'ld-lista' }, mods.map((m) => h('li', { key: m.id },
              h('b', null, m.icon + ' ' + m.nombre), ' — ', m.resumen,
              h('div', { className: 'ld-mini' }, 'Riesgo principal: ' + (m.riesgos || [])[0]))))),
          { key: 'f' + f.n });
      }));
  }

  function vistaLicencias() {
    const L = DATOS.licencias;
    const dep = L.bibliotecas.map((b) => ({ nombre: b.nombre, licencia: b.licencia, uso: b.uso }));
    const informe = auditar(dep, L);
    const clase = (v) => (v === 'usar' ? 'ld-ok' : v === 'prohibida' ? 'ld-no' : 'ld-cond');

    return h('div', null,
      card('⚖️ Qué puede entrar al producto',
        h('div', null,
          h('p', null, L.principio),
          h('div', { className: 'ld-kpis' },
            kpi('Dependencias de ejecución', '0', 'el núcleo no instala nada'),
            kpi('Bibliotecas evaluadas', L.bibliotecas.length),
            kpi('Descartadas', L.bibliotecas.filter((b) => b.veredicto === 'prohibida').length, 'por licencia incompatible'),
            kpi('Con condiciones', L.bibliotecas.filter((b) => b.veredicto === 'condicional').length, 'requieren revisión')))),

      card('Reglas de cadena de suministro',
        h('ul', { className: 'ld-lista' }, L.reglasCadenaSuministro.map((r, i) => h('li', { key: i }, r)))),

      card('Política de licencias',
        h('div', { className: 'ld-cols3' },
          h('div', null, h('h4', null, '✅ Permitidas'),
            h('ul', { className: 'ld-lista ld-mini' }, L.politica.permitidas.map((x) => h('li', { key: x.id }, h('b', null, x.id), ' — ' + x.nota)))),
          h('div', null, h('h4', null, '⚠️ Con condiciones'),
            h('ul', { className: 'ld-lista ld-mini' }, L.politica.condicionales.map((x) => h('li', { key: x.id }, h('b', null, x.id), ' — ' + x.condicion)))),
          h('div', null, h('h4', null, '⛔ Prohibidas'),
            h('ul', { className: 'ld-lista ld-mini' }, L.politica.prohibidas.map((x) => h('li', { key: x.id }, h('b', null, x.id), ' — ' + x.razon)))))),

      card('Bibliotecas evaluadas', tabla([
        { k: 'n', l: 'Biblioteca', cell: (b) => h('div', null, h('b', null, b.nombre), h('div', { className: 'ld-mini' }, b.uso)) },
        { k: 'l', l: 'Licencia', cell: (b) => b.licencia },
        { k: 'v', l: 'Veredicto', cell: (b) => h('span', { className: clase(b.veredicto) }, b.veredicto) },
        { k: 'nota', l: 'Nota', cell: (b) => h('span', { className: 'ld-mini' }, b.nota || '') },
      ], L.bibliotecas, { key: (b) => b.nombre }), { hint: informe.ok ? 'La auditoría automática no encontró bloqueos.' : 'Hay entradas que bloquean el despliegue: revísalas antes de publicar.' }),

      card('Fuentes de datos', tabla([
        { k: 'f', l: 'Fuente', cell: (d) => h('b', null, d.fuente) },
        { k: 'l', l: 'Licencia', cell: (d) => d.licencia },
        { k: 'v', l: 'Veredicto', cell: (d) => h('span', { className: clase(d.veredicto === 'usar' ? 'usar' : d.veredicto) }, d.veredicto) },
        { k: 'n', l: 'Nota', cell: (d) => h('span', { className: 'ld-mini' }, d.nota || '') },
      ], L.datos, { key: (d) => d.fuente })),

      card('Otros riesgos legales del dominio',
        h('ul', { className: 'ld-lista' }, L.otrosRiesgos.map((r, i) => h('li', { key: i },
          h('b', null, r.tema + ': '), r.riesgo, ' ', h('i', null, r.medida))))));
  }

  /* ------------------------------- componente ------------------------------- */

  function Component() {
    const [st, setSt] = React.useState(estado);
    React.useEffect(() => {
      oyentes.add(setSt);
      return () => { oyentes.delete(setSt); };
    }, []);

    const cob = React.useMemo(() => cobertura(st.inventario), [st.inventario]);
    const eco = React.useMemo(() => economiaCartera(DATOS.modules, st.sup), [st.sup]);

    const cuerpo = st.tab === 'modulos' ? vistaModulos(cob)
      : st.tab === 'inventario' ? vistaInventario(cob)
      : st.tab === 'equipos' ? vistaEquipos()
      : st.tab === 'negocio' ? vistaNegocio(eco)
      : st.tab === 'plan' ? vistaPlan(eco)
      : st.tab === 'licencias' ? vistaLicencias()
      : vistaPanel(cob, eco);

    return h('div', { className: 'kimos-lidaria' },
      h('header', { className: 'ld-head' },
        h('div', { className: 'ld-brand' },
          h('span', { className: 'ld-logo' }, '🛰️'),
          h('h1', null, 'LiDARia'),
          h('span', { className: 'ld-ver', title: 'LiDARia v' + APP_VERSION + ' · núcleo ' + DATOS.nucleo }, 'v' + APP_VERSION)),
        h('nav', { className: 'ld-tabs' }, TABS.map(([id, label, ico]) => h('button', {
          key: id, className: 'ld-tab' + (st.tab === id ? ' on' : ''),
          onClick: () => commit({ tab: id }),
        }, ico + ' ' + label))),
        h('div', { className: 'ld-tools' },
          h('span', { className: 'ld-mini' }, cob.resumen.completos + '/' + cob.resumen.total + ' módulos cubiertos'))),
      h('main', { className: 'ld-main' }, cuerpo));
  }

  /* --------------------------------- agente --------------------------------- */

  let desregistrar = null;
  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    desregistrar = shell.agent.register({
      label: 'LiDARia',
      description: 'Consola de captura 3D: qué puede escanear cada equipo, qué módulos quedan cubiertos con el parque de la organización, cuánto cuesta construir cada módulo y qué bibliotecas pueden entrar al producto.',
      tools: [
        {
          name: 'VER_PESTANA',
          description: 'Cambia de pestaña: ' + TABS.map((t) => t[0]).join(', ') + '.',
          inputSchema: { type: 'object', properties: { pestana: { type: 'string', enum: TABS.map((t) => t[0]) } }, required: ['pestana'] },
        },
        {
          name: 'AGREGAR_EQUIPO',
          description: 'Añade un equipo al inventario de la organización. Usa los ids del catálogo (getSnapshot los lista).',
          inputSchema: {
            type: 'object',
            properties: {
              equipo: { type: 'string' },
              etiqueta: { type: 'string', description: 'Nombre interno, p.ej. "iPad de terreno".' },
              cantidad: { type: 'number' },
            },
            required: ['equipo'],
          },
        },
        {
          name: 'QUITAR_EQUIPO',
          description: 'Quita un equipo del inventario.',
          inputSchema: { type: 'object', properties: { equipo: { type: 'string' } }, required: ['equipo'] },
        },
        {
          name: 'SET_SUPUESTO',
          description: 'Cambia un supuesto económico y recalcula: ' + Object.keys(SUPUESTOS_BASE).join(', ') + '. Los porcentajes van en fracción (0,18 = 18%).',
          inputSchema: {
            type: 'object',
            properties: { clave: { type: 'string', enum: Object.keys(SUPUESTOS_BASE) }, valor: { type: 'number' } },
            required: ['clave', 'valor'],
          },
        },
        {
          name: 'RECOMENDAR_EQUIPO',
          description: 'Dice qué equipo conviene sumar para cubrir un módulo que hoy no se cubre.',
          inputSchema: {
            type: 'object',
            properties: { modulo: { type: 'string', enum: DATOS.modules.modulos.map((m) => m.id) } },
            required: ['modulo'],
          },
        },
        {
          name: 'EVALUAR_LICENCIA',
          description: 'Evalúa si una licencia puede entrar al producto (acepta expresiones tipo "MIT OR Apache-2.0").',
          inputSchema: { type: 'object', properties: { licencia: { type: 'string' } }, required: ['licencia'] },
        },
      ],
      getSnapshot: () => {
        const cob = cobertura(estado.inventario);
        const eco = economiaCartera(DATOS.modules, estado.sup);
        return {
          version: APP_VERSION,
          nucleo: DATOS.nucleo,
          pestana: estado.tab,
          equipoActual: estado.diag && estado.diag.equipo ? estado.diag.equipo.nombre : null,
          nivelEquipoActual: estado.diag && estado.diag.nivel ? estado.diag.nivel.label : null,
          inventario: estado.inventario.map((i) => ({ equipo: i.equipo, etiqueta: i.etiqueta, cantidad: i.cantidad || 1 })),
          cobertura: cob.resumen,
          modulos: DATOS.modules.modulos.map((m) => ({
            id: m.id, nombre: m.nombre, fase: m.fase,
            estadoConInventario: cob.porModulo[m.id].estado,
            resumen: m.resumen,
          })),
          catalogoEquipos: DATOS.devices.equipos.map((e) => ({ id: e.id, nombre: e.nombre, clase: e.clase, confianza: e.confianza })),
          economia: {
            supuestos: estado.sup,
            ingresoMes: Math.round(eco.total.ingresoMes),
            margen: eco.total.margen,
            inversion: Math.round(eco.total.inversion),
            paybackMeses: eco.total.paybackMeses,
            porFase: eco.porFase.map((p) => ({ fase: p.fase, esfuerzoSemanas: p.esfuerzoSemanas, paybackMeses: p.paybackMeses })),
          },
          licencias: {
            prohibidas: DATOS.licencias.bibliotecas.filter((b) => b.veredicto === 'prohibida').map((b) => b.nombre),
            condicionales: DATOS.licencias.bibliotecas.filter((b) => b.veredicto === 'condicional').map((b) => b.nombre),
          },
        };
      },
      dispatchAction: async (accion) => {
        try {
          const t = accion && accion.type;
          const p = (accion && accion.payload) || {};
          if (t === 'VER_PESTANA') {
            if (!TABS.some((x) => x[0] === p.pestana)) return { success: false, error: 'Pestaña desconocida' };
            commit({ tab: p.pestana });
            return { success: true, message: 'Pestaña ' + p.pestana };
          }
          if (t === 'AGREGAR_EQUIPO') {
            const r = agregarEquipo(p.equipo, p.etiqueta, p.cantidad);
            return r.ok ? { success: true, message: r.mensaje } : { success: false, error: r.error };
          }
          if (t === 'QUITAR_EQUIPO') {
            const r = quitarEquipo(p.equipo);
            return r.ok ? { success: true, message: r.mensaje } : { success: false, error: r.error };
          }
          if (t === 'SET_SUPUESTO') {
            const r = setSup(p.clave, p.valor);
            return r.ok ? { success: true, message: r.mensaje } : { success: false, error: r.error };
          }
          if (t === 'RECOMENDAR_EQUIPO') {
            const m = moduloPorId(p.modulo);
            if (!m) return { success: false, error: 'Módulo desconocido: ' + p.modulo };
            const cob = cobertura(estado.inventario);
            if (cob.porModulo[m.id].estado === 'completo') {
              return { success: true, message: m.nombre + ' ya está cubierto por el inventario actual.' };
            }
            const rec = recomendarPara(m.id, estado.inventario);
            if (!rec.length) return { success: true, message: 'Ningún equipo del catálogo deja ' + m.nombre + ' completo: es trabajo de plataforma, no de compra.' };
            commit({ tab: 'modulos', moduloSel: m.id });
            return { success: true, message: 'Para ' + m.nombre + ': ' + rec.map((r) => r.equipo.nombre + ' (cubre ' + r.cubre + ' módulos)').join('; ') };
          }
          if (t === 'EVALUAR_LICENCIA') {
            const ev = evaluar(String(p.licencia || ''), DATOS.licencias);
            return { success: true, message: ev.expresion + ' → ' + ev.veredicto + (ev.nota ? '. ' + ev.nota : '') };
          }
          return { success: false, error: 'Acción no soportada: ' + t };
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  if (shell && shell.window && typeof shell.window.setTitle === 'function') {
    try { shell.window.setTitle('LiDARia'); } catch (e) { /* opcional */ }
  }

  restaurar();
  diagnosticarAqui();

  return {
    Component: Component,
    unmount() {
      if (timer) { clearTimeout(timer); timer = null; }
      oyentes.clear();
      if (typeof desregistrar === 'function') { try { desregistrar(); } catch (e) { /* ya desregistrado */ } }
    },
  };
}
