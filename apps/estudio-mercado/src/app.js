/**
 * Estudio de Mercado — app instalable de KIMOS.
 *
 * Bundle ESM autocontenido: usa globalThis.React (nunca su propia copia) y
 * React.createElement (el host no compila JSX). Los datos del estudio viven en
 * src/data.json y `build.mjs` los inyecta donde dice DATOS_INLINE.
 *
 * Todo número visible se recalcula desde los supuestos editables: no hay
 * resultados congelados. Esa es la diferencia con la planilla original.
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.0.0';

const DATA = /* DATOS_INLINE */ null;

/* ------------------------------------------------------------------ *
 * Supuestos por defecto (los mismos con los que se levantó el estudio)
 * ------------------------------------------------------------------ */

const SUP_BASE = {
  usuarios: DATA.supuestos.usuarios,
  canales: DATA.supuestos.canales,
  factor: DATA.supuestos.factor,
  descAnual: DATA.supuestos.descAnual,
  gastoSuites: DATA.demanda.params.gastoSuites.valor,
  pymeShare: DATA.demanda.params.pymeShare.valor,
  segmento: DATA.demanda.params.segmento.valor,
  churn: DATA.demanda.params.churn.valor,
  margen: DATA.demanda.params.margen.valor,
  cac: DATA.demanda.params.cac.valor,
  clientes3: DATA.demanda.params.clientes3.valor,
};

const DESC_BASE = {};
DATA.planes.concat(DATA.kits).forEach((p) => { DESC_BASE[p.id] = p.desc; });

const MIX_BASE = {};
DATA.demanda.mixPlan.forEach((m) => { MIX_BASE[m.plan.toLowerCase()] = m.peso; });

// Reparto de la captación entre los tres años (misma forma que la planilla).
const COHORTES = [0.109090909090909, 0.290909090909091, 0.6];

function estadoInicial() {
  return {
    v: 1,
    tab: 'resumen',
    sup: Object.assign({}, SUP_BASE),
    desc: Object.assign({}, DESC_BASE),
    mix: Object.assign({}, MIX_BASE),
    alcance: { region: '', idioma: '', prioridad: '', pais: '' },
    filtro: { q: '', app: '', seg: '', conf: '' },
    orden: { mod: { key: 'sugerido', dir: -1 }, comp: { key: 'costo', dir: -1 } },
    sel: null,
    supAbierto: false,
  };
}

/* ------------------------------------------------------------------ *
 * Motor de cálculo — las fórmulas de la planilla, en JavaScript
 * ------------------------------------------------------------------ */

function mediana(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Normaliza el precio de un competidor al cliente tipo: por usuario se
 * multiplica por la dotación, por canal por los canales conectados y la tarifa
 * plana se toma tal cual. Es la única forma de comparar manzanas con manzanas.
 */
function costoTipo(c, sup) {
  const mult = c.unidad === 'Por usuario' ? sup.usuarios : c.unidad === 'Por canal' ? sup.canales : 1;
  return c.precio * mult;
}

function calcularOferta(sup, desc) {
  const porApp = new Map();
  DATA.competidores.forEach((c) => {
    if (!porApp.has(c.app)) porApp.set(c.app, []);
    porApp.get(c.app).push(c);
  });

  const modulos = DATA.modulos.map((m) => {
    const rows = porApp.get(m.app) || [];
    // Los planes Enterprise se excluyen de la mediana (son otro segmento) pero
    // sí marcan el techo del mercado.
    const pyme = rows.filter((c) => c.seg !== 'Enterprise').map((c) => costoTipo(c, sup));
    const todos = rows.map((c) => costoTipo(c, sup));
    const med = mediana(pyme);
    const sugerido = Math.round(med * sup.factor);
    return Object.assign({}, m, {
      min: pyme.length ? Math.min.apply(null, pyme) : 0,
      med: med,
      max: todos.length ? Math.max.apply(null, todos) : 0,
      sugerido: sugerido,
      porUsuario: Math.round((sugerido / sup.usuarios) * 10) / 10,
      ahorro: med ? 1 - sugerido / med : 0,
      planes: rows.length,
    });
  });

  const byN = new Map(modulos.map((m) => [m.n, m]));
  const armar = (p) => {
    const suma = p.mods.reduce((a, n) => a + byN.get(n).sugerido, 0);
    const d = desc[p.id] != null ? desc[p.id] : p.desc;
    const mensual = Math.round(suma * (1 - d));
    const anual = Math.round(mensual * 12 * (1 - sup.descAnual));
    return Object.assign({}, p, {
      suma: suma,
      descuento: d,
      mensual: mensual,
      porUsuario: Math.round((mensual / sup.usuarios) * 10) / 10,
      anual: anual,
      ahorroAnual: suma * 12 - anual,
      nombres: p.mods.map((n) => byN.get(n).app),
    });
  };

  const planes = DATA.planes.map(armar);
  const kits = DATA.kits.map(armar);

  const stack = DATA.stack.map((s) => {
    const c = DATA.competidores[s.comp];
    return {
      necesidad: s.necesidad, herramienta: s.herramienta, plan: s.plan,
      unidad: c.unidad, costo: costoTipo(c, sup),
    };
  });
  const stackTotal = stack.reduce((a, s) => a + s.costo, 0);
  const ent = planes[planes.length - 1];

  const medianaCartera = mediana(modulos.map((m) => m.med));
  modulos.forEach((m) => {
    const paga = m.med >= medianaCartera;
    const ventaja = m.ventaja >= 5.5;
    m.cuadrante = paga && ventaja ? 'APOSTAR'
      : paga && !ventaja ? 'MONETIZAR CON CUIDADO'
      : ventaja ? 'DIFERENCIAR, NO FACTURAR' : 'REPLANTEAR';
  });

  return {
    modulos: modulos,
    byN: byN,
    planes: planes,
    kits: kits,
    aLaCarta: modulos.reduce((a, m) => a + m.sugerido, 0),
    medianaTotal: modulos.reduce((a, m) => a + m.med, 0),
    medianaCartera: medianaCartera,
    stack: stack,
    stackTotal: stackTotal,
    stackPorUsuario: stackTotal / sup.usuarios,
    ratioStack: stackTotal ? ent.mensual / stackTotal : 0,
    ahorroAnualStack: (stackTotal - ent.mensual) * 12,
  };
}

function paisesEnAlcance(alcance) {
  return DATA.demanda.paises.filter((p) => {
    if (alcance.pais && p.pais !== alcance.pais) return false;
    if (alcance.region && p.region !== alcance.region) return false;
    if (alcance.idioma && p.idioma !== alcance.idioma) return false;
    if (alcance.prioridad && p.prioridad !== alcance.prioridad) return false;
    return true;
  });
}

function calcularDemanda(sup, alcance, oferta, mix) {
  const saasReg = new Map(DATA.demanda.regiones.map((r) => [r.region, r.saas]));
  const filas = paisesEnAlcance(alcance).map((p) => {
    const saas = p.peso * (saasReg.get(p.region) || 0);
    const tam = saas * sup.gastoSuites * sup.pymeShare;
    const sam = tam * sup.segmento * p.cobertura;
    return Object.assign({}, p, { saas: saas, tam: tam, sam: sam });
  });

  const mercado = filas.reduce((a, f) => a + f.saas, 0);
  const tam = filas.reduce((a, f) => a + f.tam, 0);
  const sam = filas.reduce((a, f) => a + f.sam, 0);
  // El índice del alcance se pondera por SAM: un país chico no mueve la aguja.
  const indice = sam ? filas.reduce((a, f) => a + f.sam * f.indice, 0) / sam : 0;

  const precio = (id) => {
    const p = oferta.planes.filter((x) => x.id === id)[0];
    return p ? p.mensual : 0;
  };
  const arpuMensual = (mix.starter || 0) * precio('starter')
    + (mix.business || 0) * precio('business')
    + (mix.enterprise || 0) * precio('enterprise');
  const arpuAnualBase = arpuMensual * 12;
  const arpuAnual = arpuAnualBase * indice;

  // Supervivencia por cohorte: cada año se capta repartido en 12 meses y se le
  // aplica (1-churn)^meses. Sin esto el churn no tocaría el ARR.
  const ch = sup.churn;
  const factorAnual = ch === 0 ? 12 : (1 - Math.pow(1 - ch, 12)) / ch;
  const cohortes = COHORTES.map((w, i) => {
    const nuevos = sup.clientes3 * w;
    const vivos = [0, 1, 2].map((anio) => (anio < i ? 0
      : (nuevos / 12) * Math.pow(1 - ch, 12 * (anio - i)) * factorAnual));
    return { anio: i + 1, nuevos: nuevos, vivos: vivos };
  });
  const vivos = [0, 1, 2].map((i) => cohortes.reduce((a, c) => a + c.vivos[i], 0));
  const arr = vivos.map((v) => Math.round(v * arpuAnual));

  const ltv = (arpuAnual / 12) * sup.margen * (ch ? 1 / ch : 0);
  const payback = arpuAnual ? sup.cac / ((arpuAnual / 12) * sup.margen) : 0;
  const penetracion = sam ? arr[2] / (sam * 1e6) : 0;

  return {
    filas: filas, mercado: mercado, tam: tam, sam: sam, indice: indice,
    arpuMensual: arpuMensual, arpuAnualBase: arpuAnualBase, arpuAnual: arpuAnual,
    cohortes: cohortes, vivos: vivos.map((v) => Math.round(v)), arr: arr,
    vidaMedia: ch ? 1 / ch : 0, ltv: ltv, ratio: sup.cac ? ltv / sup.cac : 0,
    payback: payback, penetracion: penetracion,
    retencion: sup.clientes3 ? vivos[2] / sup.clientes3 : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Formato
 * ------------------------------------------------------------------ */

const nf = {};
const fmt = (d) => (nf[d] || (nf[d] = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: d, maximumFractionDigits: d,
})));

const usd = (n) => '$' + fmt(0).format(Math.round(n || 0));
const usd1 = (n) => '$' + fmt(1).format(n || 0);
const mm = (n) => '$' + fmt(0).format(Math.round(n || 0)) + ' MM';
const pct = (n, d) => fmt(d == null ? 1 : d).format((n || 0) * 100) + '%';
const x1 = (n) => fmt(1).format(n || 0);
const x2 = (n) => fmt(2).format(n || 0);          // índice de precio y factor: 0,91 no es 0,9
const num = (n) => fmt(0).format(Math.round(n || 0));

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  let estado = estadoInicial();
  const oyentes = new Set();
  let guardar = null;

  function commit(patch) {
    estado = Object.assign({}, estado, patch);
    oyentes.forEach((f) => f(estado));
    programarGuardado();
  }
  function setSup(k, v) {
    const n = Number(v);
    if (!isFinite(n)) return;
    commit({ sup: Object.assign({}, estado.sup, { [k]: n }) });
  }
  function setDesc(id, v) {
    const n = Number(v);
    if (!isFinite(n)) return;
    commit({ desc: Object.assign({}, estado.desc, { [id]: Math.min(0.95, Math.max(0, n)) }) });
  }
  function setMix(k, v) {
    const n = Number(v);
    if (!isFinite(n)) return;
    commit({ mix: Object.assign({}, estado.mix, { [k]: Math.min(1, Math.max(0, n)) }) });
  }
  function setAlcance(k, v) {
    const a = Object.assign({}, estado.alcance, { [k]: v });
    // Elegir un país manda sobre los filtros de grupo: si no, se contradicen.
    if (k === 'pais' && v) { a.region = ''; a.idioma = ''; a.prioridad = ''; }
    if (k !== 'pais') a.pais = '';
    commit({ alcance: a });
  }
  function setFiltro(k, v) { commit({ filtro: Object.assign({}, estado.filtro, { [k]: v }) }); }
  function setOrden(tabla, key) {
    const o = estado.orden[tabla];
    const dir = o.key === key ? -o.dir : -1;
    commit({ orden: Object.assign({}, estado.orden, { [tabla]: { key: key, dir: dir } }) });
  }

  let timer = null;
  function programarGuardado() {
    if (!shell || typeof shell.saveData !== 'function') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { v, tab, sup, desc, mix, alcance } = estado;
      Promise.resolve(shell.saveData({ v, tab, sup, desc, mix, alcance })).catch(() => {});
    }, 800);
  }

  async function restaurar() {
    if (!shell || typeof shell.loadData !== 'function') return;
    try {
      const d = await shell.loadData();
      if (!d || typeof d !== 'object') return;
      const patch = {};
      if (d.tab) patch.tab = d.tab;
      if (d.sup) patch.sup = Object.assign({}, SUP_BASE, d.sup);
      if (d.desc) patch.desc = Object.assign({}, DESC_BASE, d.desc);
      if (d.mix) patch.mix = Object.assign({}, MIX_BASE, d.mix);
      if (d.alcance) patch.alcance = Object.assign({ region: '', idioma: '', prioridad: '', pais: '' }, d.alcance);
      estado = Object.assign({}, estado, patch);
      oyentes.forEach((f) => f(estado));
    } catch (e) { /* primera apertura: sin datos guardados */ }
  }

  function descargar(nombre, texto) {
    try {
      const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Exportado ' + nombre });
    } catch (e) {
      if (shell && shell.notify) shell.notify({ level: 'error', text: 'No se pudo exportar' });
    }
  }

  const csv = (filas) => filas
    .map((f) => f.map((c) => {
      const s = c == null ? '' : String(c);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';'))
    .join('\n');

  function exportar(oferta, demanda) {
    if (estado.tab === 'competencia') {
      return descargar('kimos-competencia.csv', csv([
        ['App KIMOS', 'Competidor', 'Plan', 'Precio USD/mes', 'Unidad', 'Costo cliente tipo', 'Segmento', 'Notas', 'Fuente', 'Confianza'],
      ].concat(DATA.competidores.map((c) => [
        c.app, c.comp, c.plan, c.precio, c.unidad, Math.round(costoTipo(c, estado.sup)), c.seg, c.nota, c.fuente, c.conf,
      ]))));
    }
    if (estado.tab === 'mercados') {
      return descargar('kimos-mercados.csv', csv([
        ['País', 'Región', 'Idioma', 'Prioridad', 'Cobertura', 'Mercado SaaS USD MM', 'TAM USD MM', 'SAM USD MM', 'Índice precio', 'Starter', 'Business', 'Enterprise'],
      ].concat(demanda.filas.map((f) => {
        const p = (id) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || {}).mensual * f.indice);
        return [f.pais, f.region, f.idioma, f.prioridad, f.cobertura, Math.round(f.saas),
          Math.round(f.tam), Math.round(f.sam), f.indice, p('starter'), p('business'), p('enterprise')];
      }))));
    }
    return descargar('kimos-modulos.csv', csv([
      ['#', 'App KIMOS', 'Categoría', 'Alternativas', 'Mín', 'Mediana', 'Máx', 'Precio sugerido', 'Por usuario', 'Ahorro vs mediana', 'Cuadrante', 'Estrategia'],
    ].concat(oferta.modulos.map((m) => [
      m.n, m.app, m.cat, m.alt, Math.round(m.min), Math.round(m.med), Math.round(m.max),
      m.sugerido, m.porUsuario, pct(m.ahorro, 0), m.cuadrante, m.estrategia,
    ]))));
  }

  /* ---------------------------- piezas de UI ---------------------------- */

  const kpi = (label, valor, nota, tono) => h('div', { className: 'km-kpi' + (tono ? ' km-' + tono : ''), key: label },
    h('div', { className: 'km-kpi-l' }, label),
    h('div', { className: 'km-kpi-v' }, valor),
    nota ? h('div', { className: 'km-kpi-n' }, nota) : null);

  const seccion = (titulo, bajada, hijos, key) => h('section', { className: 'km-sec', key: key },
    h('h3', null, titulo),
    bajada ? h('p', { className: 'km-baja' }, bajada) : null,
    hijos);

  const th = (tabla, key, texto, className) => h('th', {
    className: (className || '') + ' km-th-sort' + (estado.orden[tabla].key === key ? ' on' : ''),
    onClick: () => setOrden(tabla, key),
    title: 'Ordenar por ' + texto,
  }, texto, estado.orden[tabla].key === key ? h('span', { className: 'km-caret' }, estado.orden[tabla].dir < 0 ? ' ▼' : ' ▲') : null);

  const barra = (valor, max, titulo) => h('div', { className: 'km-bar', title: titulo },
    h('span', { style: { width: Math.max(2, Math.min(100, max ? (valor / max) * 100 : 0)) + '%' } }));

  const select = (valor, opciones, onChange, vacio) => h('select', {
    className: 'km-in', value: valor, onChange: (e) => onChange(e.target.value),
  }, [h('option', { value: '', key: '' }, vacio)].concat(
    opciones.map((o) => h('option', { value: o, key: o }, o))));

  const numIn = (valor, onChange, step, min, max) => h('input', {
    className: 'km-in km-num', type: 'number', value: valor, step: step || 1,
    min: min == null ? 0 : min, max: max,
    onChange: (e) => onChange(e.target.value),
  });

  const chipConf = (c) => h('span', {
    className: 'km-chip ' + (c === 'Verificado' ? 'km-ok' : c === 'Estimado' ? 'km-warn' : 'km-neutro'),
  }, c);

  /* ------------------------------- pestañas ------------------------------ */

  function vistaResumen(oferta, demanda) {
    const ent = oferta.planes[oferta.planes.length - 1];
    const banda = oferta.ratioStack > 0.60 ? 'riesgo' : oferta.ratioStack < 0.25 ? 'aviso' : 'ok';
    const bandaTxt = banda === 'ok' ? 'Dentro de la banda sana (25%-60%)'
      : banda === 'riesgo' ? 'Sobre 60%: se cae el argumento de ahorro'
      : 'Bajo 25%: se deja margen sobre la mesa';
    const top = oferta.modulos.slice().sort((a, b) => b.sugerido - a.sugerido).slice(0, 6);
    const maxTop = top[0] ? top[0].med : 1;
    const altas = DATA.decisiones.filter((d) => d.impacto === 'alto').slice(0, 4);

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-kpis' },
        kpi('Suite completa a la carta', usd(oferta.aLaCarta) + '/mes', oferta.modulos.length + ' módulos'),
        kpi('KIMOS Enterprise', usd(ent.mensual) + '/mes', usd1(ent.porUsuario) + ' por usuario · ' + usd(ent.anual) + '/año'),
        kpi('Stack que paga hoy el cliente', usd(oferta.stackTotal) + '/mes', DATA.stack.length + ' herramientas sueltas'),
        kpi('KIMOS sobre ese gasto', pct(oferta.ratioStack, 0), bandaTxt, banda === 'ok' ? 'ok' : banda === 'riesgo' ? 'riesgo' : 'aviso'),
        kpi('Ahorro anual para el cliente', usd(oferta.ahorroAnualStack), 'Enterprise contra el stack best-of-breed'),
        kpi('SAM del alcance', mm(demanda.sam), demanda.filas.length + ' mercados · índice ' + x2(demanda.indice)),
        kpi('ARR al año 3', usd(demanda.arr[2]), num(demanda.vivos[2]) + ' clientes vivos'),
        kpi('Penetración necesaria', pct(demanda.penetracion, 2), demanda.penetracion > 0.02 ? 'Sobre 2%: el plan deja de ser realista' : 'Bajo el umbral de alerta (2%)',
          demanda.penetracion > 0.02 ? 'riesgo' : 'ok')),

      seccion('Dónde está el precio del mercado', 'Los seis módulos que más paga el mercado, con el precio sugerido de KIMOS encima. La barra es la mediana de la competencia para el cliente tipo.',
        h('div', { className: 'km-top' }, top.map((m) => h('div', { className: 'km-top-row', key: m.n },
          h('button', { className: 'km-link', onClick: () => commit({ tab: 'modulos', sel: m.n }) }, m.app),
          barra(m.med, maxTop, 'Mediana del mercado'),
          h('span', { className: 'km-top-num' }, usd(m.med)),
          h('span', { className: 'km-top-kimos' }, 'KIMOS ' + usd(m.sugerido)))))),

      seccion('Las decisiones de mayor impacto', 'Cruce del estudio de oferta con el de demanda. Si el dato cambia, la decisión se revisa.',
        h('div', { className: 'km-cards' }, altas.map((d) => h('article', { className: 'km-card', key: d.n },
          h('h4', null, d.decision),
          h('p', null, h('b', null, 'Qué hacer: '), d.hacer))))),

      h('p', { className: 'km-pie' },
        'Precios de lista públicos al ' + DATA.meta.fecha + ', en ' + DATA.meta.moneda + ', sin impuestos. ',
        DATA.competidores.length + ' planes de ' + oferta.modulos.length + ' categorías. ',
        'Cliente tipo: ' + estado.sup.usuarios + ' usuarios y ' + estado.sup.canales + ' canales sociales.'));
  }

  function vistaModulos(oferta) {
    const o = estado.orden.mod;
    const val = (m) => ({
      n: m.n, app: m.app, cat: m.cat, min: m.min, med: m.med, max: m.max,
      sugerido: m.sugerido, ahorro: m.ahorro, ventaja: m.ventaja,
    })[o.key];
    const filas = oferta.modulos.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return c * o.dir;
    });
    const maxMed = Math.max.apply(null, oferta.modulos.map((m) => m.med));
    const sel = estado.sel != null ? oferta.byN.get(estado.sel) : null;

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-kpis km-kpis-4' },
        kpi('Mediana del mercado, suite entera', usd(oferta.medianaTotal) + '/mes'),
        kpi('Precio sugerido a la carta', usd(oferta.aLaCarta) + '/mes', 'Factor ' + x2(estado.sup.factor) + ' sobre la mediana'),
        kpi('Módulos que APOSTAR', String(oferta.modulos.filter((m) => m.cuadrante === 'APOSTAR').length), 'Pagan bien y KIMOS tiene ventaja'),
        kpi('Módulos a REPLANTEAR', String(oferta.modulos.filter((m) => m.cuadrante === 'REPLANTEAR').length), 'Ni precio ni ventaja')),

      h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
        h('thead', null, h('tr', null,
          th('mod', 'app', 'App KIMOS'),
          th('mod', 'cat', 'Categoría de mercado'),
          h('th', null, 'Alternativas'),
          th('mod', 'min', 'Mín', 'km-r'),
          th('mod', 'med', 'Mediana', 'km-r'),
          th('mod', 'max', 'Máx', 'km-r'),
          h('th', { className: 'km-w' }, 'Mercado'),
          th('mod', 'sugerido', 'KIMOS', 'km-r'),
          h('th', { className: 'km-r' }, 'Por usuario'),
          th('mod', 'ahorro', 'Ahorro', 'km-r'),
          h('th', null, 'Cuadrante'))),
        h('tbody', null, filas.map((m) => h('tr', {
          key: m.n,
          className: estado.sel === m.n ? 'on' : '',
          onClick: () => commit({ sel: estado.sel === m.n ? null : m.n }),
        },
          h('td', null, h('b', null, m.app)),
          h('td', { className: 'km-mut' }, m.cat),
          h('td', { className: 'km-mut km-alt' }, m.alt),
          h('td', { className: 'km-r' }, usd(m.min)),
          h('td', { className: 'km-r' }, usd(m.med)),
          h('td', { className: 'km-r km-mut' }, usd(m.max)),
          h('td', { className: 'km-w' }, barra(m.med, maxMed, 'Mediana ' + usd(m.med))),
          h('td', { className: 'km-r km-fuerte' }, usd(m.sugerido)),
          h('td', { className: 'km-r km-mut' }, usd1(m.porUsuario)),
          h('td', { className: 'km-r' }, pct(m.ahorro, 0)),
          h('td', null, h('span', { className: 'km-cuad km-q' + m.cuadrante.charAt(0) }, m.cuadrante))))))),

      sel ? h('aside', { className: 'km-detalle' },
        h('div', { className: 'km-detalle-h' },
          h('h3', null, sel.app),
          h('button', { className: 'km-x', onClick: () => commit({ sel: null }), title: 'Cerrar' }, '✕')),
        h('p', { className: 'km-baja' }, sel.que, ' · ', sel.cat, ' · Objetivo: ', sel.target),
        h('div', { className: 'km-kpis km-kpis-4' },
          kpi('Mediana del mercado', usd(sel.med) + '/mes'),
          kpi('Precio sugerido', usd(sel.sugerido) + '/mes', usd1(sel.porUsuario) + ' por usuario'),
          kpi('Rango del mercado', usd(sel.min) + ' – ' + usd(sel.max)),
          kpi('Precios verificados', sel.conf, sel.planes + ' planes levantados')),
        h('div', { className: 'km-dos' },
          h('div', { className: 'km-caja km-caja-ok' }, h('h4', null, 'A favor de KIMOS'), h('p', null, sel.pro)),
          h('div', { className: 'km-caja km-caja-riesgo' }, h('h4', null, 'En contra'), h('p', null, sel.contra))),
        h('p', { className: 'km-estrategia' }, h('b', null, 'Estrategia: '), sel.estrategia),
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla km-mini' },
          h('thead', null, h('tr', null, h('th', null, 'Competidor'), h('th', null, 'Plan'),
            h('th', { className: 'km-r' }, 'Precio'), h('th', null, 'Unidad'),
            h('th', { className: 'km-r' }, 'Cliente tipo'), h('th', null, 'Notas'), h('th', null, 'Fuente'))),
          h('tbody', null, DATA.competidores.filter((c) => c.app === sel.app).map((c, i) => h('tr', { key: i },
            h('td', null, c.comp), h('td', { className: 'km-mut' }, c.plan),
            h('td', { className: 'km-r' }, usd1(c.precio)),
            h('td', { className: 'km-mut' }, c.unidad + (c.seg === 'Enterprise' ? ' · Enterprise' : '')),
            h('td', { className: 'km-r km-fuerte' }, usd(costoTipo(c, estado.sup))),
            h('td', { className: 'km-mut' }, c.nota),
            h('td', { className: 'km-fuente' }, c.fuente)))))))
        : h('p', { className: 'km-pie' }, 'Haz clic en una fila para ver los planes de la competencia, los argumentos a favor y en contra, y la estrategia sugerida.'));
  }

  function vistaCompetencia() {
    const f = estado.filtro;
    const q = f.q.trim().toLowerCase();
    let filas = DATA.competidores.map((c, i) => Object.assign({ i: i, costo: costoTipo(c, estado.sup) }, c));
    if (f.app) filas = filas.filter((c) => c.app === f.app);
    if (f.seg) filas = filas.filter((c) => c.seg === f.seg);
    if (f.conf) filas = filas.filter((c) => c.conf === f.conf);
    if (q) filas = filas.filter((c) => (c.comp + ' ' + c.plan + ' ' + c.app + ' ' + c.nota).toLowerCase().indexOf(q) >= 0);
    const o = estado.orden.comp;
    filas.sort((a, b) => {
      const x = a[o.key], y = b[o.key];
      const c = typeof x === 'string' ? x.localeCompare(y) : (x || 0) - (y || 0);
      return c * o.dir;
    });
    const verificados = filas.filter((c) => c.conf === 'Verificado').length;

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-filtros' },
        h('input', { className: 'km-in km-q', placeholder: 'Buscar competidor, plan o nota…', value: f.q, onChange: (e) => setFiltro('q', e.target.value) }),
        select(f.app, DATA.modulos.map((m) => m.app), (v) => setFiltro('app', v), 'Todas las apps'),
        select(f.seg, ['PyME / Empresa', 'Enterprise'], (v) => setFiltro('seg', v), 'Todos los segmentos'),
        select(f.conf, ['Verificado', 'Estimado'], (v) => setFiltro('conf', v), 'Toda confianza'),
        h('span', { className: 'km-cuenta' }, filas.length + ' planes · ' + verificados + ' verificados'),
        (f.q || f.app || f.seg || f.conf) ? h('button', { className: 'km-btn', onClick: () => commit({ filtro: { q: '', app: '', seg: '', conf: '' } }) }, 'Limpiar') : null),

      h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
        h('thead', null, h('tr', null,
          th('comp', 'app', 'App KIMOS'),
          th('comp', 'comp', 'Competidor'),
          th('comp', 'plan', 'Plan'),
          th('comp', 'precio', 'Precio lista', 'km-r'),
          h('th', null, 'Unidad'),
          th('comp', 'costo', 'Cliente tipo', 'km-r'),
          h('th', null, 'Notas'),
          h('th', null, 'Fuente'),
          th('comp', 'conf', 'Confianza'))),
        h('tbody', null, filas.map((c) => h('tr', { key: c.i },
          h('td', { className: 'km-mut' }, c.app),
          h('td', null, h('b', null, c.comp)),
          h('td', { className: 'km-mut' }, c.plan),
          h('td', { className: 'km-r' }, usd1(c.precio)),
          h('td', { className: 'km-mut' }, c.unidad + (c.seg === 'Enterprise' ? ' · Enterprise' : '')),
          h('td', { className: 'km-r km-fuerte' }, usd(c.costo)),
          h('td', { className: 'km-mut' }, c.nota),
          h('td', { className: 'km-fuente' }, c.fuente),
          h('td', null, chipConf(c.conf))))))),

      h('p', { className: 'km-pie' }, 'El costo del cliente tipo normaliza cada plan a ' + estado.sup.usuarios
        + ' usuarios y ' + estado.sup.canales + ' canales. Los planes Enterprise se excluyen de la mediana: son otro segmento y distorsionan la referencia.'));
  }

  function vistaPrecios(oferta) {
    const filaPlan = (p) => h('tr', { key: p.id },
      h('td', null, h('b', null, p.nombre), h('div', { className: 'km-mut' }, p.para)),
      h('td', { className: 'km-mut km-alt' }, p.incluye, h('div', { className: 'km-mods' }, p.nombres.join(' · '))),
      h('td', { className: 'km-r km-mut' }, usd(p.suma)),
      h('td', { className: 'km-r' }, h('div', { className: 'km-desc' },
        numIn(Math.round(p.descuento * 100), (v) => setDesc(p.id, Number(v) / 100), 1, 0, 95), h('span', null, '%'))),
      h('td', { className: 'km-r km-fuerte km-grande' }, usd(p.mensual)),
      h('td', { className: 'km-r km-mut' }, usd1(p.porUsuario)),
      h('td', { className: 'km-r' }, usd(p.anual)),
      h('td', { className: 'km-r km-mut' }, usd(p.ahorroAnual)));

    const cab = h('thead', null, h('tr', null,
      h('th', null, 'Plan'), h('th', null, 'Qué incluye'),
      h('th', { className: 'km-r' }, 'Suma a la carta'), h('th', { className: 'km-r' }, 'Descuento'),
      h('th', { className: 'km-r' }, 'Mensual'), h('th', { className: 'km-r' }, 'Por usuario'),
      h('th', { className: 'km-r' }, 'Anual'), h('th', { className: 'km-r' }, 'Ahorro del cliente')));

    const banda = oferta.ratioStack > 0.60 ? 'riesgo' : oferta.ratioStack < 0.25 ? 'aviso' : 'ok';

    return h('div', { className: 'km-grid' },
      seccion('Planes por tamaño de empresa', 'El descuento es editable: al cambiarlo se recalculan el precio mensual, el anual y el ahorro del cliente.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' }, cab, h('tbody', null, oferta.planes.map(filaPlan))))),

      seccion('Kits por necesidad', 'La oferta de entrada por defecto: menos firmas en el comité, ciclo de venta más corto.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' }, cab, h('tbody', null, oferta.kits.map(filaPlan))))),

      seccion('Chequeo de realidad: qué gasta hoy el cliente sin KIMOS',
        'Stack best-of-breed equivalente, normalizado al mismo cliente tipo. La banda sana deja a KIMOS entre 25% y 60% de ese gasto.',
        h('div', null,
          h('div', { className: 'km-kpis km-kpis-4' },
            kpi('Stack actual', usd(oferta.stackTotal) + '/mes', usd1(oferta.stackPorUsuario) + ' por usuario'),
            kpi('KIMOS Enterprise', usd(oferta.planes[3].mensual) + '/mes', usd1(oferta.planes[3].porUsuario) + ' por usuario'),
            kpi('KIMOS sobre el gasto actual', pct(oferta.ratioStack, 0), banda === 'ok' ? 'Banda sana' : banda === 'riesgo' ? 'Sobre 60%' : 'Bajo 25%', banda),
            kpi('Ahorro anual', usd(oferta.ahorroAnualStack))),
          h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
            h('thead', null, h('tr', null, h('th', null, 'Necesidad'), h('th', null, 'Herramienta que se usa hoy'),
              h('th', null, 'Plan'), h('th', null, 'Unidad'), h('th', { className: 'km-r' }, 'Costo mensual'))),
            h('tbody', null, oferta.stack.map((s, i) => h('tr', { key: i },
              h('td', null, s.necesidad), h('td', null, h('b', null, s.herramienta)),
              h('td', { className: 'km-mut' }, s.plan), h('td', { className: 'km-mut' }, s.unidad),
              h('td', { className: 'km-r' }, usd(s.costo)))).concat([
                h('tr', { key: 'tot', className: 'km-total' },
                  h('td', { colSpan: 4 }, 'TOTAL stack best-of-breed'),
                  h('td', { className: 'km-r' }, usd(oferta.stackTotal))),
              ])))))),

      seccion('Precio a la carta por módulo', 'Módulo suelto, para cotizaciones fuera de plan.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, h('th', null, 'Módulo'), h('th', { className: 'km-r' }, 'Mediana del mercado'),
            h('th', { className: 'km-r' }, 'Precio sugerido'), h('th', { className: 'km-r' }, 'Posición vs mercado'),
            h('th', null, 'Estrategia'))),
          h('tbody', null, oferta.modulos.map((m) => h('tr', { key: m.n },
            h('td', null, m.app), h('td', { className: 'km-r km-mut' }, usd(m.med)),
            h('td', { className: 'km-r km-fuerte' }, usd(m.sugerido)),
            h('td', { className: 'km-r' }, m.med ? pct(m.sugerido / m.med - 1, 0) : '—'),
            h('td', { className: 'km-mut km-alt' }, m.estrategia))).concat([
              h('tr', { key: 'tot', className: 'km-total' },
                h('td', null, 'TOTAL suite completa'),
                h('td', { className: 'km-r' }, usd(oferta.medianaTotal)),
                h('td', { className: 'km-r' }, usd(oferta.aLaCarta)),
                h('td', { className: 'km-r' }, pct(oferta.aLaCarta / oferta.medianaTotal - 1, 0)),
                h('td', null, '')),
            ]))))));
  }

  function vistaMercados(oferta, demanda) {
    const a = estado.alcance;
    const uniq = (k) => Array.from(new Set(DATA.demanda.paises.map((p) => p[k]))).sort();
    const maxSam = Math.max.apply(null, demanda.filas.map((f) => f.sam).concat([1]));
    const precio = (id, ix) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || { mensual: 0 }).mensual * ix);
    const recomendacion = (ix) => ix >= 0.95 ? 'Subir el factor a 0,85–0,90'
      : ix >= 0.75 ? 'Lista regional, factor 0,7'
      : ix >= 0.55 ? 'Mantener factor 0,55' : 'Solo autoservicio';
    const filas = demanda.filas.slice().sort((x, y) => y.sam - x.sam);

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-filtros' },
        select(a.region, uniq('region'), (v) => setAlcance('region', v), 'Todas las regiones'),
        select(a.pais, DATA.demanda.paises.map((p) => p.pais), (v) => setAlcance('pais', v), 'Todos los países'),
        select(a.idioma, uniq('idioma'), (v) => setAlcance('idioma', v), 'Todos los idiomas'),
        select(a.prioridad, uniq('prioridad'), (v) => setAlcance('prioridad', v), 'Toda prioridad comercial'),
        h('span', { className: 'km-cuenta' }, demanda.filas.length + ' de ' + DATA.demanda.paises.length + ' mercados'),
        (a.region || a.pais || a.idioma || a.prioridad)
          ? h('button', { className: 'km-btn', onClick: () => commit({ alcance: { region: '', idioma: '', prioridad: '', pais: '' } }) }, 'Alcance global') : null),

      h('div', { className: 'km-kpis' },
        kpi('Mercado SaaS del alcance', mm(demanda.mercado)),
        kpi('TAM', mm(demanda.tam), 'Suites de gestión en PyME y mid-market'),
        kpi('SAM', mm(demanda.sam), 'Con la cobertura comercial de cada país'),
        kpi('Índice de precio', x2(demanda.indice), 'Ponderado por SAM · 1,00 = lista EE.UU.'),
        kpi('ARPU anual del alcance', usd(demanda.arpuAnual), 'Base ' + usd(demanda.arpuAnualBase) + ' × índice'),
        kpi('Penetración al año 3', pct(demanda.penetracion, 2),
          demanda.penetracion > 0.02 ? 'Sobre 2%: alcance demasiado chico para el plan' : 'Bajo el umbral de alerta',
          demanda.penetracion > 0.02 ? 'riesgo' : 'ok')),

      h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
        h('thead', null, h('tr', null,
          h('th', null, 'Mercado'), h('th', null, 'Región'), h('th', null, 'Idioma'),
          h('th', null, 'Prioridad'), h('th', { className: 'km-r' }, 'Cobertura'),
          h('th', { className: 'km-r' }, 'SaaS'), h('th', { className: 'km-r' }, 'TAM'),
          h('th', { className: 'km-r' }, 'SAM'), h('th', { className: 'km-w' }, ''),
          h('th', { className: 'km-r' }, 'Índice'), h('th', { className: 'km-r' }, 'Starter'),
          h('th', { className: 'km-r' }, 'Business'), h('th', { className: 'km-r' }, 'Enterprise'),
          h('th', null, 'Recomendación'))),
        h('tbody', null, filas.map((f) => h('tr', { key: f.pais, title: f.contexto },
          h('td', null, h('b', null, f.pais)),
          h('td', { className: 'km-mut' }, f.region),
          h('td', { className: 'km-mut' }, f.idioma),
          h('td', null, h('span', { className: 'km-prio km-p' + f.prioridad.charAt(0) }, f.prioridad)),
          h('td', { className: 'km-r km-mut' }, pct(f.cobertura, 0)),
          h('td', { className: 'km-r km-mut' }, mm(f.saas)),
          h('td', { className: 'km-r km-mut' }, mm(f.tam)),
          h('td', { className: 'km-r km-fuerte' }, mm(f.sam)),
          h('td', { className: 'km-w' }, barra(f.sam, maxSam, 'SAM ' + mm(f.sam))),
          h('td', { className: 'km-r' }, x2(f.indice)),
          h('td', { className: 'km-r' }, usd(precio('starter', f.indice))),
          h('td', { className: 'km-r' }, usd(precio('business', f.indice))),
          h('td', { className: 'km-r' }, usd(precio('enterprise', f.indice))),
          h('td', { className: 'km-mut' }, recomendacion(f.indice))))))),

      seccion('Regiones', 'Los totales por región difieren de la suma por país: la hoja por país usa la cobertura comercial de cada mercado, más fina que la cobertura regional.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, h('th', null, 'Región'), h('th', { className: 'km-r' }, 'Mercado SaaS'),
            h('th', { className: 'km-r' }, '% global'), h('th', { className: 'km-r' }, 'CAGR'),
            h('th', { className: 'km-r' }, 'Cobertura'), h('th', { className: 'km-r' }, 'Índice'),
            h('th', null, 'Lectura'), h('th', null, 'Confianza'))),
          h('tbody', null, DATA.demanda.regiones.map((r) => h('tr', { key: r.region },
            h('td', null, h('b', null, r.region)),
            h('td', { className: 'km-r' }, mm(r.saas)),
            h('td', { className: 'km-r km-mut' }, pct(r.share, 1)),
            h('td', { className: 'km-r km-mut' }, pct(r.cagr, 1)),
            h('td', { className: 'km-r km-mut' }, pct(r.cobertura, 0)),
            h('td', { className: 'km-r' }, x2(r.indice)),
            h('td', { className: 'km-mut km-alt' }, r.lectura),
            h('td', null, chipConf(r.conf)))))))));
  }

  function vistaEconomia(oferta, demanda) {
    const s = estado.sup;
    const maxArr = Math.max.apply(null, demanda.arr.concat([1]));
    const alerta = demanda.ratio < 2.5;

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-kpis' },
        kpi('ARPU mensual base', usd(demanda.arpuMensual), 'Mix ' + pct(estado.mix.starter, 0) + ' Starter · '
          + pct(estado.mix.business, 0) + ' Business · ' + pct(estado.mix.enterprise, 0) + ' Enterprise'),
        kpi('ARPU anual del alcance', usd(demanda.arpuAnual), 'Índice ' + x2(demanda.indice)),
        kpi('Vida media del cliente', x1(demanda.vidaMedia) + ' meses', 'Inversa del churn ' + pct(s.churn, 1)),
        kpi('LTV', usd(demanda.ltv), 'ARPU × margen × vida media'),
        kpi('LTV : CAC', x1(demanda.ratio) + ' : 1', alerta ? 'Bajo el benchmark PyME (2,5:1)' : 'Sobre el benchmark PyME (2,5:1)', alerta ? 'riesgo' : 'ok'),
        kpi('CAC payback', x1(demanda.payback) + ' meses', demanda.payback > 12 ? 'Sobre los 12 meses objetivo' : 'Benchmark PyME: 6,2 meses',
          demanda.payback > 12 ? 'riesgo' : 'ok')),

      seccion('Proyección a 3 años', 'Cada cohorte se capta repartida en 12 meses y se le aplica supervivencia mes a mes. Sin ese descuento el churn no afectaría el ARR y la proyección sería falsa.',
        h('div', null,
          h('div', { className: 'km-anios' }, [0, 1, 2].map((i) => h('div', { className: 'km-anio', key: i },
            h('div', { className: 'km-anio-l' }, 'Año ' + (i + 1)),
            h('div', { className: 'km-anio-v' }, usd(demanda.arr[i])),
            h('div', { className: 'km-anio-b' }, h('span', { style: { width: (demanda.arr[i] / maxArr) * 100 + '%' } })),
            h('div', { className: 'km-anio-n' }, num(demanda.vivos[i]) + ' clientes vivos')))),
          h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
            h('thead', null, h('tr', null, h('th', null, 'Cohorte'), h('th', { className: 'km-r' }, 'Clientes nuevos'),
              h('th', { className: 'km-r' }, 'Vivos al cierre año 1'), h('th', { className: 'km-r' }, 'Año 2'), h('th', { className: 'km-r' }, 'Año 3'))),
            h('tbody', null, demanda.cohortes.map((c) => h('tr', { key: c.anio },
              h('td', null, 'Captados en el año ' + c.anio),
              h('td', { className: 'km-r' }, num(c.nuevos)),
              h('td', { className: 'km-r km-mut' }, c.vivos[0] ? num(c.vivos[0]) : '—'),
              h('td', { className: 'km-r km-mut' }, c.vivos[1] ? num(c.vivos[1]) : '—'),
              h('td', { className: 'km-r km-mut' }, c.vivos[2] ? num(c.vivos[2]) : '—'))).concat([
                h('tr', { key: 'tot', className: 'km-total' },
                  h('td', null, 'Clientes vivos'),
                  h('td', { className: 'km-r' }, num(s.clientes3)),
                  h('td', { className: 'km-r' }, num(demanda.vivos[0])),
                  h('td', { className: 'km-r' }, num(demanda.vivos[1])),
                  h('td', { className: 'km-r' }, num(demanda.vivos[2]))),
                h('tr', { key: 'arr', className: 'km-total' },
                  h('td', null, 'ARR'), h('td', { className: 'km-r' }, ''),
                  h('td', { className: 'km-r' }, usd(demanda.arr[0])),
                  h('td', { className: 'km-r' }, usd(demanda.arr[1])),
                  h('td', { className: 'km-r' }, usd(demanda.arr[2]))),
              ])))))),

      seccion('Mix de planes', 'Cuánto pesa cada plan en la base de clientes. Mueve el mix y el ARPU, el LTV y el ARR se recalculan.',
        h('div', { className: 'km-mixes' }, ['starter', 'business', 'enterprise'].map((k) => {
          const p = oferta.planes.filter((x) => x.id === k)[0];
          return h('label', { className: 'km-mix', key: k },
            h('span', null, p.nombre, h('em', null, usd(p.mensual) + '/mes')),
            numIn(Math.round((estado.mix[k] || 0) * 100), (v) => setMix(k, Number(v) / 100), 5, 0, 100),
            h('span', { className: 'km-mut' }, '%'));
        }).concat([
          h('span', {
            key: 'suma',
            className: 'km-cuenta' + (Math.abs(['starter', 'business', 'enterprise']
              .reduce((a, k) => a + (estado.mix[k] || 0), 0) - 1) > 0.001 ? ' km-riesgo-txt' : ''),
          }, 'Suma del mix: ' + pct(['starter', 'business', 'enterprise'].reduce((a, k) => a + (estado.mix[k] || 0), 0), 0)),
        ]))),

      seccion('Retención', null, h('p', { className: 'km-baja' },
        'De los ' + num(s.clientes3) + ' clientes captados en tres años quedan vivos ' + num(demanda.vivos[2])
        + ' al cierre del año 3: una retención del ' + pct(demanda.retencion, 0)
        + '. Entre el 40% y el 60% del churn ocurre antes del tercer mes, así que esta cifra se gana en el onboarding, no en la venta.')));
  }

  function vistaClientes() {
    return h('div', { className: 'km-grid' },
      seccion('Perfiles de cliente ideal', 'Seis perfiles con el dolor que los mueve, el gatillo de compra y la objeción que hay que responder.',
        h('div', { className: 'km-cards km-cards-3' }, DATA.icp.map((p, i) => h('article', { className: 'km-card', key: i },
          h('h4', null, p.perfil),
          h('div', { className: 'km-tags' },
            h('span', { className: 'km-tag' }, p.rol),
            h('span', { className: 'km-tag' }, p.tamano),
            h('span', { className: 'km-tag km-tag-on' }, p.producto)),
          h('p', null, h('b', null, 'Dolor. '), p.dolor),
          h('p', null, h('b', null, 'Gatillo. '), p.gatillo),
          h('p', { className: 'km-obj' }, h('b', null, 'Objeción. '), p.objecion),
          h('p', null, h('b', null, 'Cómo se le vende. '), p.venta))))),

      seccion('Segmentación por tamaño', null,
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, h('th', null, 'Segmento'), h('th', null, 'Empleados'),
            h('th', null, 'Veredicto'), h('th', null, 'Plan sugerido'), h('th', null, 'Por qué'), h('th', null, 'Riesgo'))),
          h('tbody', null, DATA.segmentos.map((s, i) => h('tr', { key: i },
            h('td', null, h('b', null, s.segmento)), h('td', { className: 'km-mut' }, s.empleados),
            h('td', null, h('span', { className: 'km-vered km-v' + s.veredicto.charAt(0) }, s.veredicto)),
            h('td', { className: 'km-mut' }, s.plan),
            h('td', { className: 'km-mut km-alt' }, s.porque),
            h('td', { className: 'km-mut km-alt' }, s.riesgo))))))),

      DATA.evidencia.map((g, i) => seccion(g.titulo, null,
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, g.cols.map((c, j) => h('th', { key: j, className: j === 2 && g.cols.length > 6 ? 'km-r' : '' }, c)))),
          h('tbody', null, g.filas.map((f, j) => h('tr', { key: j },
            f.map((c, k) => h('td', {
              key: k,
              className: (k === g.cols.length - 1 ? '' : 'km-mut') + (k >= 3 ? ' km-alt' : ''),
            }, k === g.cols.length - 1 ? chipConf(c) : c))))))), 'ev' + i)));
  }

  function vistaDecisiones(oferta) {
    // Matriz de cartera: lo que paga el mercado contra la ventaja de KIMOS.
    const W = 720, H = 420, P = 46;
    const maxMed = Math.max.apply(null, oferta.modulos.map((m) => m.med));
    const xs = (v) => P + (v / 10) * (W - P * 2);
    const ys = (v) => H - P - (Math.sqrt(v / maxMed)) * (H - P * 2);

    return h('div', { className: 'km-grid' },
      seccion('Ocho decisiones que solo aparecen al cruzar oferta y demanda', 'Cada una con el dato que la sostiene por ambos lados.',
        h('div', { className: 'km-cards km-cards-2' }, DATA.decisiones.map((d) => h('article', {
          className: 'km-card km-card-' + d.impacto, key: d.n,
        },
          h('div', { className: 'km-card-h' }, h('span', { className: 'km-n' }, d.n),
            h('span', { className: 'km-imp km-i' + d.impacto }, 'impacto ' + d.impacto)),
          h('h4', null, d.decision),
          h('p', null, h('b', null, 'Oferta. '), d.oferta),
          h('p', null, h('b', null, 'Demanda. '), d.demanda),
          h('p', { className: 'km-hacer' }, h('b', null, 'Qué hacer. '), d.hacer))))),

      seccion('Matriz de cartera', 'Eje horizontal: la ventaja de KIMOS (0 a 10). Eje vertical: lo que paga el mercado por la categoría, en escala de raíz. El corte vertical está en la ventaja 5,5 y el horizontal en la mediana de la cartera (' + usd(oferta.medianaCartera) + ').',
        h('div', null,
          h('div', { className: 'km-svg-wrap' }, h('svg', { viewBox: '0 0 ' + W + ' ' + H, className: 'km-svg', role: 'img' },
            h('rect', { x: xs(5.5), y: P - 14, width: W - P - xs(5.5), height: ys(oferta.medianaCartera) - P + 14, className: 'km-q-apostar' }),
            h('rect', { x: P, y: P - 14, width: xs(5.5) - P, height: ys(oferta.medianaCartera) - P + 14, className: 'km-q-cuidado' }),
            h('rect', { x: xs(5.5), y: ys(oferta.medianaCartera), width: W - P - xs(5.5), height: H - P - ys(oferta.medianaCartera), className: 'km-q-difer' }),
            h('text', { x: W - P - 8, y: P + 4, className: 'km-q-lab', textAnchor: 'end' }, 'APOSTAR'),
            h('text', { x: P + 8, y: P + 4, className: 'km-q-lab' }, 'MONETIZAR CON CUIDADO'),
            h('text', { x: W - P - 8, y: H - P - 8, className: 'km-q-lab', textAnchor: 'end' }, 'DIFERENCIAR, NO FACTURAR'),
            h('text', { x: P + 8, y: H - P - 8, className: 'km-q-lab' }, 'REPLANTEAR'),
            h('line', { x1: P, y1: H - P, x2: W - P, y2: H - P, className: 'km-eje' }),
            h('line', { x1: P, y1: P - 14, x2: P, y2: H - P, className: 'km-eje' }),
            oferta.modulos.map((m) => h('g', { key: m.n, className: 'km-pt' },
              h('circle', { cx: xs(m.ventaja), cy: ys(m.med), r: Math.max(5, Math.sqrt(m.sugerido) * 0.9) }),
              h('title', null, m.app + ' — mercado ' + usd(m.med) + '/mes · KIMOS ' + usd(m.sugerido) + '/mes · ventaja ' + m.ventaja + '/10 · ' + m.cuadrante),
              h('text', { x: xs(m.ventaja), y: ys(m.med) - Math.max(9, Math.sqrt(m.sugerido) * 0.9 + 4), textAnchor: 'middle' }, m.app))),
            h('text', { x: W / 2, y: H - 10, textAnchor: 'middle', className: 'km-eje-lab' }, 'Ventaja de KIMOS →'),
            h('text', { x: 14, y: H / 2, textAnchor: 'middle', className: 'km-eje-lab', transform: 'rotate(-90 14 ' + H / 2 + ')' }, 'Lo que paga el mercado →'))),
          h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla km-mini' },
            h('thead', null, h('tr', null, h('th', null, 'Cuadrante'), h('th', null, 'Módulos'), h('th', { className: 'km-r' }, 'Precio sugerido'))),
            h('tbody', null, ['APOSTAR', 'MONETIZAR CON CUIDADO', 'DIFERENCIAR, NO FACTURAR', 'REPLANTEAR'].map((q) => {
              const ms = oferta.modulos.filter((m) => m.cuadrante === q);
              return h('tr', { key: q },
                h('td', null, h('span', { className: 'km-cuad km-q' + q.charAt(0) }, q)),
                h('td', { className: 'km-mut' }, ms.map((m) => m.app).join(' · ') || '—'),
                h('td', { className: 'km-r km-fuerte' }, usd(ms.reduce((a, m) => a + m.sugerido, 0)) + '/mes'));
            })))))),

      seccion('Advertencias metodológicas', 'Lo que este estudio no prueba. Leerlo antes de anclar un precio.',
        h('ol', { className: 'km-notas' }, DATA.notas.map((n, i) => h('li', { key: i }, n.replace(/^\d+\.\s*/, ''))))));
  }

  /* ------------------------------ supuestos ------------------------------ */

  function panelSupuestos() {
    const s = estado.sup;
    const campo = (k, label, nota, step, max) => h('label', { className: 'km-campo', key: k },
      h('span', null, label, nota ? h('em', null, nota) : null),
      numIn(s[k], (v) => setSup(k, v), step, 0, max));
    const pctCampo = (k, label, nota, step) => h('label', { className: 'km-campo', key: k },
      h('span', null, label, nota ? h('em', null, nota) : null),
      h('span', { className: 'km-desc' },
        numIn(Math.round(s[k] * 1000) / 10, (v) => setSup(k, Number(v) / 100), step || 1, 0, 100), h('span', null, '%')));

    return h('div', { className: 'km-sup' },
      h('div', { className: 'km-sup-col' },
        h('h4', null, 'Cliente tipo y posicionamiento'),
        campo('usuarios', 'Usuarios', 'normaliza precios por asiento', 1),
        campo('canales', 'Canales sociales', 'normaliza precios por canal', 1),
        h('label', { className: 'km-campo' },
          h('span', null, 'Factor de posicionamiento', h('em', null, '0,55 = challenger')),
          numIn(s.factor, (v) => setSup('factor', v), 0.05, 0, 2)),
        pctCampo('descAnual', 'Descuento por pago anual')),
      h('div', { className: 'km-sup-col' },
        h('h4', null, 'Embudo de mercado'),
        pctCampo('gastoSuites', 'Gasto en suites de gestión', '% del SaaS'),
        pctCampo('pymeShare', 'Participación PyME y mid-market'),
        pctCampo('segmento', 'Segmento 10-250 empleados')),
      h('div', { className: 'km-sup-col' },
        h('h4', null, 'Economía por cliente'),
        pctCampo('churn', 'Churn mensual', 'benchmark PyME: 3% a 7%', 0.1),
        pctCampo('margen', 'Margen bruto', 'castigado por el costo de IA'),
        campo('cac', 'CAC promedio', 'USD', 50),
        campo('clientes3', 'Clientes captados al año 3', 'capacidad comercial', 10)),
      h('div', { className: 'km-sup-pie' },
        h('button', { className: 'km-btn', onClick: () => commit({ sup: Object.assign({}, SUP_BASE), desc: Object.assign({}, DESC_BASE), mix: Object.assign({}, MIX_BASE) }) },
          'Restaurar los supuestos del estudio'),
        h('span', { className: 'km-mut' }, 'Levantamiento: ' + DATA.meta.fecha + ' · ' + DATA.meta.moneda + ' · ' + DATA.competidores.length + ' precios de lista')));
  }

  /* ------------------------------- render ------------------------------- */

  const TABS = [
    ['resumen', 'Resumen'],
    ['modulos', 'Módulos'],
    ['competencia', 'Competencia'],
    ['precios', 'Precios y planes'],
    ['mercados', 'Mercados'],
    ['economia', 'Economía'],
    ['clientes', 'Clientes'],
    ['decisiones', 'Decisiones'],
  ];

  function Component() {
    const [st, setSt] = React.useState(estado);
    React.useEffect(() => {
      oyentes.add(setSt);
      return () => { oyentes.delete(setSt); };
    }, []);

    const oferta = React.useMemo(() => calcularOferta(st.sup, st.desc), [st.sup, st.desc]);
    const demanda = React.useMemo(() => calcularDemanda(st.sup, st.alcance, oferta, st.mix), [st.sup, st.alcance, st.mix, oferta]);

    const alcanceTxt = st.alcance.pais || st.alcance.region || st.alcance.idioma || st.alcance.prioridad || 'Global';

    const cuerpo = st.tab === 'modulos' ? vistaModulos(oferta)
      : st.tab === 'competencia' ? vistaCompetencia()
      : st.tab === 'precios' ? vistaPrecios(oferta)
      : st.tab === 'mercados' ? vistaMercados(oferta, demanda)
      : st.tab === 'economia' ? vistaEconomia(oferta, demanda)
      : st.tab === 'clientes' ? vistaClientes()
      : st.tab === 'decisiones' ? vistaDecisiones(oferta)
      : vistaResumen(oferta, demanda);

    return h('div', { className: 'kimos-mercado' },
      h('header', { className: 'km-head' },
        h('div', { className: 'km-titulo' },
          h('span', { className: 'km-icono' }, '🎯'),
          h('b', null, 'Estudio de Mercado'),
          h('span', { className: 'km-ver', title: 'Estudio de Mercado v' + APP_VERSION }, 'v' + APP_VERSION)),
        h('nav', { className: 'km-tabs' }, TABS.map(([id, label]) => h('button', {
          key: id, className: 'km-tab' + (st.tab === id ? ' on' : ''),
          onClick: () => commit({ tab: id }),
        }, label))),
        h('div', { className: 'km-acciones' },
          h('span', { className: 'km-alcance', title: 'Alcance del análisis de demanda' }, alcanceTxt),
          h('button', { className: 'km-btn' + (st.supAbierto ? ' on' : ''), onClick: () => commit({ supAbierto: !st.supAbierto }) }, '⚙️ Supuestos'),
          h('button', { className: 'km-btn', onClick: () => exportar(oferta, demanda), title: 'Exportar la pestaña actual a CSV' }, '⬇️ CSV'))),
      st.supAbierto ? panelSupuestos() : null,
      h('main', { className: 'km-body' }, cuerpo));
  }

  /* -------------------------------- agente -------------------------------- */

  let desregistrar = null;

  const CLAVES_SUP = Object.keys(SUP_BASE);

  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    desregistrar = shell.agent.register({
      label: 'Estudio de Mercado',
      description: 'Estudio competitivo y de precios de KIMOS: precio sugerido por módulo contra la competencia, planes y kits, mercado por país y economía por cliente. El agente puede mover los supuestos y el alcance, y leer todo lo que se recalcula.',
      tools: [
        {
          name: 'SET_SUPUESTO',
          description: 'Cambia un supuesto del modelo y recalcula todo. Claves: ' + CLAVES_SUP.join(', ') + '. Los porcentajes van en fracción (0,55 = 55%).',
          inputSchema: {
            type: 'object',
            properties: { clave: { type: 'string', enum: CLAVES_SUP }, valor: { type: 'number' } },
            required: ['clave', 'valor'],
          },
        },
        {
          name: 'SET_DESCUENTO_PLAN',
          description: 'Cambia el descuento de un plan o kit sobre la suma a la carta (0,6 = 60%).',
          inputSchema: {
            type: 'object',
            properties: {
              plan: { type: 'string', enum: Object.keys(DESC_BASE) },
              descuento: { type: 'number' },
            },
            required: ['plan', 'descuento'],
          },
        },
        {
          name: 'SET_ALCANCE',
          description: 'Filtra el análisis de demanda por región, país, idioma o prioridad comercial. Enviar cadena vacía en un campo lo limpia.',
          inputSchema: {
            type: 'object',
            properties: {
              region: { type: 'string' }, pais: { type: 'string' },
              idioma: { type: 'string' }, prioridad: { type: 'string' },
            },
          },
        },
        {
          name: 'VER_PESTANA',
          description: 'Abre una pestaña de la app.',
          inputSchema: {
            type: 'object',
            properties: { pestana: { type: 'string', enum: TABS.map((t) => t[0]) } },
            required: ['pestana'],
          },
        },
        {
          name: 'VER_MODULO',
          description: 'Abre el detalle de un módulo (competidores, argumentos y estrategia) por nombre exacto.',
          inputSchema: {
            type: 'object',
            properties: { app: { type: 'string', enum: DATA.modulos.map((m) => m.app) } },
            required: ['app'],
          },
        },
        {
          name: 'RESTAURAR_SUPUESTOS',
          description: 'Vuelve a los supuestos, descuentos y mix con los que se levantó el estudio.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      getSnapshot: () => {
        // Se recalcula al vuelo desde el estado actual: si dependiera del
        // último render, el agente leería cifras viejas tras cambiar supuestos.
        const of = calcularOferta(estado.sup, estado.desc);
        const dem = calcularDemanda(estado.sup, estado.alcance, of, estado.mix);
        return {
          version: APP_VERSION,
          levantamiento: DATA.meta.fecha,
          pestana: estado.tab,
          supuestos: estado.sup,
          alcance: estado.alcance,
          mixPlanes: estado.mix,
          oferta: {
            suiteALaCarta: of.aLaCarta,
            medianaMercado: Math.round(of.medianaTotal),
            stackActualCliente: Math.round(of.stackTotal),
            kimosSobreStack: Math.round(of.ratioStack * 100) / 100,
            ahorroAnualCliente: Math.round(of.ahorroAnualStack),
            planes: of.planes.map((p) => ({ id: p.id, nombre: p.nombre, mensual: p.mensual, anual: p.anual, descuento: p.descuento })),
            kits: of.kits.map((p) => ({ id: p.id, nombre: p.nombre, mensual: p.mensual, anual: p.anual })),
            modulos: of.modulos.map((m) => ({
              app: m.app, categoria: m.cat, mediana: Math.round(m.med), sugerido: m.sugerido,
              porUsuario: m.porUsuario, cuadrante: m.cuadrante, estrategia: m.estrategia,
              alternativas: m.alt, planesLevantados: m.planes,
            })),
          },
          demanda: {
            mercados: dem.filas.length,
            mercadoSaaSMM: Math.round(dem.mercado),
            tamMM: Math.round(dem.tam),
            samMM: Math.round(dem.sam),
            indicePrecio: Math.round(dem.indice * 100) / 100,
            arpuAnual: Math.round(dem.arpuAnual),
            clientesVivosAnio3: dem.vivos[2],
            arrAnio3: dem.arr[2],
            penetracionSAM: Math.round(dem.penetracion * 10000) / 10000,
            ltv: Math.round(dem.ltv), ltvCac: Math.round(dem.ratio * 100) / 100,
            paybackMeses: Math.round(dem.payback * 10) / 10,
            topMercados: dem.filas.slice().sort((a, b) => b.sam - a.sam).slice(0, 5)
              .map((f) => ({ pais: f.pais, samMM: Math.round(f.sam), indice: f.indice, prioridad: f.prioridad })),
          },
          decisiones: DATA.decisiones.map((d) => ({ n: d.n, decision: d.decision, hacer: d.hacer, impacto: d.impacto })),
        };
      },
      dispatchAction: async (action) => {
        const t = action && action.type;
        const p = (action && action.payload) || {};
        try {
          if (t === 'SET_SUPUESTO') {
            if (CLAVES_SUP.indexOf(p.clave) < 0) return { success: false, error: 'Supuesto desconocido: ' + p.clave };
            const v = Number(p.valor);
            if (!isFinite(v) || v < 0) return { success: false, error: 'Valor inválido' };
            setSup(p.clave, v);
            return { success: true, message: p.clave + ' = ' + v };
          }
          if (t === 'SET_DESCUENTO_PLAN') {
            if (!(p.plan in DESC_BASE)) return { success: false, error: 'Plan desconocido: ' + p.plan };
            const v = Number(p.descuento);
            if (!isFinite(v) || v < 0 || v > 0.95) return { success: false, error: 'El descuento debe ir entre 0 y 0,95' };
            setDesc(p.plan, v);
            return { success: true, message: p.plan + ' con ' + Math.round(v * 100) + '% de descuento' };
          }
          if (t === 'SET_ALCANCE') {
            const a = { region: '', idioma: '', prioridad: '', pais: '' };
            ['region', 'idioma', 'prioridad', 'pais'].forEach((k) => {
              if (typeof p[k] === 'string') a[k] = p[k];
            });
            if (a.pais && !DATA.demanda.paises.some((x) => x.pais === a.pais)) {
              return { success: false, error: 'País desconocido: ' + a.pais };
            }
            if (a.pais) { a.region = ''; a.idioma = ''; a.prioridad = ''; }
            commit({ alcance: a });
            const n = paisesEnAlcance(a).length;
            if (!n) return { success: false, error: 'Ese alcance no deja ningún mercado dentro' };
            return { success: true, message: n + ' mercados en el alcance' };
          }
          if (t === 'VER_PESTANA') {
            if (!TABS.some((x) => x[0] === p.pestana)) return { success: false, error: 'Pestaña desconocida' };
            commit({ tab: p.pestana });
            return { success: true, message: 'Pestaña ' + p.pestana };
          }
          if (t === 'VER_MODULO') {
            const m = DATA.modulos.filter((x) => x.app === p.app)[0];
            if (!m) return { success: false, error: 'Módulo desconocido: ' + p.app };
            commit({ tab: 'modulos', sel: m.n });
            return { success: true, message: 'Detalle de ' + m.app };
          }
          if (t === 'RESTAURAR_SUPUESTOS') {
            commit({ sup: Object.assign({}, SUP_BASE), desc: Object.assign({}, DESC_BASE), mix: Object.assign({}, MIX_BASE) });
            return { success: true, message: 'Supuestos del estudio restaurados' };
          }
          return { success: false, error: 'Acción no soportada: ' + t };
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  if (shell && shell.window && typeof shell.window.setTitle === 'function') {
    try { shell.window.setTitle('Estudio de Mercado'); } catch (e) { /* opcional */ }
  }
  restaurar();

  return {
    Component: Component,
    unmount() {
      if (timer) { clearTimeout(timer); timer = null; }
      oyentes.clear();
      if (typeof desregistrar === 'function') { try { desregistrar(); } catch (e) { /* ya desregistrado */ } }
    },
  };
}
