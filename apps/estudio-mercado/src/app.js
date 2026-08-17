/**
 * Estudio de Mercado — app instalable de KIMOS.
 *
 * Bundle ESM autocontenido: usa globalThis.React (nunca su propia copia) y
 * React.createElement (el host no compila JSX). Los datos del estudio viven en
 * src/data.json y el sistema visual en src/visual.json; `build.mjs` los inyecta
 * donde dicen DATOS_INLINE y VISUAL_INLINE.
 *
 * Todo número visible se recalcula desde los supuestos editables: no hay
 * resultados congelados. Esa es la diferencia con la planilla original.
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.1.0';

const DATA = /* DATOS_INLINE */ null;
const VIS = /* VISUAL_INLINE */ null;

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

// Paleta de series: los colores son datos, no decoración, así que están fijos.
const PAL = ['#8b5cf6', '#22d3ee', '#e879f9', '#2dd4bf', '#fb923c', '#60a5fa',
  '#f472b6', '#34d399', '#a855f7', '#06b6d4', '#fbbf24', '#f87171'];
const C = {
  violet: '#8b5cf6', cyan: '#22d3ee', fuchsia: '#e879f9', teal: '#2dd4bf',
  orange: '#fb923c', blue: '#60a5fa', green: '#34d399', red: '#fb7185',
  amber: '#fbbf24', calipso: '#06b6d4', purple: '#a855f7', pink: '#f472b6',
};

function estadoInicial() {
  return {
    v: 2,
    tab: 'resumen',
    tema: 'estudio',
    sup: Object.assign({}, SUP_BASE),
    desc: Object.assign({}, DESC_BASE),
    mix: Object.assign({}, MIX_BASE),
    precios: {},                       // precios de competencia editados a mano
    cfg: { mods: [], desc: 0.5 },      // configurador de suscripción
    alcance: { region: '', idioma: '', prioridad: '', pais: '' },
    filtro: { q: '', app: '', seg: '', conf: '' },
    orden: { mod: { key: 'sugerido', dir: -1 }, comp: { key: 'costo', dir: -1 } },
    modSel: null,
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

function precioLista(c, i, precios) {
  const v = precios && precios[i];
  return typeof v === 'number' && isFinite(v) && v >= 0 ? v : c.precio;
}

/**
 * Normaliza el precio de un competidor al cliente tipo: por usuario se
 * multiplica por la dotación, por canal por los canales conectados y la tarifa
 * plana se toma tal cual. Es la única forma de comparar manzanas con manzanas.
 */
function costoTipo(c, sup, i, precios) {
  const mult = c.unidad === 'Por usuario' ? sup.usuarios : c.unidad === 'Por canal' ? sup.canales : 1;
  return precioLista(c, i, precios) * mult;
}

function calcularOferta(sup, desc, precios) {
  const porApp = new Map();
  DATA.competidores.forEach((c, i) => {
    if (!porApp.has(c.app)) porApp.set(c.app, []);
    porApp.get(c.app).push({ c: c, i: i, costo: costoTipo(c, sup, i, precios) });
  });

  const modulos = DATA.modulos.map((m) => {
    const rows = porApp.get(m.app) || [];
    // Los planes Enterprise se excluyen de la mediana (son otro segmento) pero
    // sí marcan el techo del mercado.
    const pyme = rows.filter((r) => r.c.seg !== 'Enterprise').map((r) => r.costo);
    const todos = rows.map((r) => r.costo);
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
      verificados: rows.filter((r) => r.c.conf === 'Verificado').length,
    });
  });

  const byN = new Map(modulos.map((m) => [m.n, m]));
  const byApp = new Map(modulos.map((m) => [m.app, m]));
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
      necesidad: s.necesidad, herramienta: s.herramienta, plan: s.plan, app: c.app,
      unidad: c.unidad, costo: costoTipo(c, sup, s.comp, precios),
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
    modulos: modulos, byN: byN, byApp: byApp, planes: planes, kits: kits,
    aLaCarta: modulos.reduce((a, m) => a + m.sugerido, 0),
    medianaTotal: modulos.reduce((a, m) => a + m.med, 0),
    medianaCartera: medianaCartera,
    stack: stack,
    stackTotal: stackTotal,
    stackPorUsuario: stackTotal / sup.usuarios,
    ratioStack: stackTotal ? ent.mensual / stackTotal : 0,
    ahorroAnualStack: (stackTotal - ent.mensual) * 12,
    verificados: DATA.competidores.filter((c) => c.conf === 'Verificado').length,
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
const corto = (s) => String(s).split(' (')[0];

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */

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
  function setPrecio(i, v) {
    const n = Number(v);
    const p = Object.assign({}, estado.precios);
    if (!isFinite(n) || n < 0 || v === '') delete p[i]; else p[i] = n;
    commit({ precios: p });
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
  function toggleMod(app) {
    const s = estado.cfg.mods.slice();
    const i = s.indexOf(app);
    if (i >= 0) s.splice(i, 1); else s.push(app);
    commit({ cfg: Object.assign({}, estado.cfg, { mods: s }) });
  }
  function setPreset(id) {
    if (id === '__todos') return commit({ cfg: { mods: DATA.modulos.map((m) => m.app), desc: 0.62 } });
    if (id === '__ninguno') return commit({ cfg: { mods: [], desc: estado.cfg.desc } });
    const p = DATA.planes.concat(DATA.kits).filter((x) => x.id === id)[0];
    if (!p) return;
    const byN = new Map(DATA.modulos.map((m) => [m.n, m.app]));
    commit({ cfg: { mods: p.mods.map((n) => byN.get(n)), desc: estado.desc[p.id] != null ? estado.desc[p.id] : p.desc } });
  }

  let timer = null;
  function programarGuardado() {
    if (!shell || typeof shell.saveData !== 'function') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { v, tab, tema, sup, desc, mix, precios, cfg, alcance } = estado;
      Promise.resolve(shell.saveData({ v, tab, tema, sup, desc, mix, precios, cfg, alcance })).catch(() => {});
    }, 800);
  }

  async function restaurar() {
    if (!shell || typeof shell.loadData !== 'function') return;
    try {
      const d = await shell.loadData();
      if (!d || typeof d !== 'object') return;
      const patch = {};
      if (d.tab) patch.tab = d.tab;
      if (d.tema) patch.tema = d.tema;
      if (d.sup) patch.sup = Object.assign({}, SUP_BASE, d.sup);
      if (d.desc) patch.desc = Object.assign({}, DESC_BASE, d.desc);
      if (d.mix) patch.mix = Object.assign({}, MIX_BASE, d.mix);
      if (d.precios) patch.precios = d.precios;
      if (d.cfg && Array.isArray(d.cfg.mods)) patch.cfg = d.cfg;
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
      const cab = ['App KIMOS', 'Competidor', 'Plan', 'Precio USD/mes', 'Unidad', 'Costo cliente tipo', 'Segmento', 'Notas', 'Fuente', 'Confianza'];
      const filas = DATA.competidores.map((c, i) => [c.app, c.comp, c.plan, precioLista(c, i, estado.precios),
        c.unidad, Math.round(costoTipo(c, estado.sup, i, estado.precios)), c.seg, c.nota, c.fuente, c.conf]);
      return descargar('kimos-competencia.csv', csv([cab].concat(filas)));
    }
    if (estado.tab === 'mercados') {
      const cab = ['País', 'Región', 'Idioma', 'Prioridad', 'Cobertura', 'Mercado SaaS USD MM', 'TAM USD MM', 'SAM USD MM', 'Índice precio', 'Starter', 'Business', 'Enterprise'];
      const pl = (id, ix) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || { mensual: 0 }).mensual * ix);
      const filas = demanda.filas.map((f) => [f.pais, f.region, f.idioma, f.prioridad, f.cobertura,
        Math.round(f.saas), Math.round(f.tam), Math.round(f.sam), f.indice,
        pl('starter', f.indice), pl('business', f.indice), pl('enterprise', f.indice)]);
      return descargar('kimos-mercados.csv', csv([cab].concat(filas)));
    }
    const cab = ['#', 'App KIMOS', 'Categoría', 'Alternativas', 'Mín', 'Mediana', 'Máx', 'Precio sugerido', 'Por usuario', 'Ahorro vs mediana', 'Cuadrante', 'Estrategia'];
    const filas = oferta.modulos.map((m) => [m.n, m.app, m.cat, m.alt, Math.round(m.min), Math.round(m.med),
      Math.round(m.max), m.sugerido, m.porUsuario, pct(m.ahorro, 0), m.cuadrante, m.estrategia]);
    return descargar('kimos-modulos.csv', csv([cab].concat(filas)));
  }

  /* ---------------------------- piezas de UI ---------------------------- */

  // Texto del estudio con <b> y marcadores {clave} que se rellenan en vivo.
  function rt(texto, vals) {
    const t = String(texto).replace(/\{(\w+)\}/g, (m, k) => (vals && vals[k] != null ? vals[k] : m));
    return t.split(/(<b>[\s\S]*?<\/b>)/g).map((p, i) => (p.indexOf('<b>') === 0
      ? h('b', { key: i }, p.slice(3, -4))
      : p));
  }

  const card = (titulo, color, hint, cuerpo, extra) => h('section',
    Object.assign({ className: 'km-card' }, extra || {}),
    h('h2', null, h('span', { className: 'km-dot', style: { '--k-g': color } }), titulo),
    hint ? h('p', { className: 'km-hint' }, hint) : null,
    h('div', { className: 'km-card-body' }, cuerpo));

  const kpi = (k, v, n, color) => h('div', { className: 'km-kpi', key: k, style: { '--k-g': color } },
    h('div', { className: 'km-kpi-k' }, k),
    h('div', { className: 'km-kpi-v' }, v),
    n ? h('div', { className: 'km-kpi-n' }, n) : null);

  const nota = (n) => h('div', { className: 'km-note' }, h('b', null, n.titulo + ' '), n.texto);

  const pill = (texto, clase) => h('span', { className: 'km-pill ' + clase }, texto);
  const pillConf = (c) => pill(c, c === 'Verificado' ? 'km-p-ok' : 'km-p-est');
  const CLASE_CUAD = {
    'APOSTAR': 'km-p-g', 'MONETIZAR CON CUIDADO': 'km-p-o',
    'DIFERENCIAR, NO FACTURAR': 'km-p-c', 'REPLANTEAR': 'km-p-r',
  };
  const CLASE_PRIO = {
    'Prioritario': 'km-p-g', 'Expansión': 'km-p-c', 'Oportunista': 'km-p-o', 'No perseguir': 'km-p-v',
  };

  const icono = (m, i) => h('div', {
    className: 'km-ico',
    style: { '--k-c1': PAL[i % PAL.length], '--k-c2': PAL[(i + 4) % PAL.length] },
  }, h('svg', {
    viewBox: '0 0 24 24',
    dangerouslySetInnerHTML: { __html: VIS.paths[m.icono] || VIS.paths.box },
  }));

  /** Tabla genérica: cols = [{ k, l, num, sort, cell }]. Evita anidar 8 niveles. */
  function tabla(cols, filas, opts) {
    const o = opts || {};
    const th = cols.map((c) => h('th', {
      key: c.k,
      className: (c.num ? 'km-num ' : '') + (c.sort ? 'km-sort' : '') + (o.orden && o.orden.key === c.k ? ' on' : ''),
      onClick: c.sort && o.onSort ? () => o.onSort(c.k) : undefined,
    }, c.l, o.orden && o.orden.key === c.k ? (o.orden.dir < 0 ? ' ▼' : ' ▲') : ''));

    const tr = filas.map((f, i) => h('tr', {
      key: o.key ? o.key(f, i) : i,
      className: o.clase ? o.clase(f) : undefined,
      onClick: o.onClick ? () => o.onClick(f) : undefined,
      title: o.title ? o.title(f) : undefined,
    }, cols.map((c) => h('td', { key: c.k, className: c.num ? 'km-num' : undefined }, c.cell(f, i)))));

    return h('div', { className: 'km-tbl-wrap' },
      h('table', { className: 'km-tbl' },
        h('thead', null, h('tr', null, th)),
        h('tbody', null, tr.concat(o.pie || []))));
  }

  const filaTotal = (celdas) => h('tr', { className: 'km-tot', key: 'tot' },
    celdas.map((c, i) => h('td', { key: i, className: c.num ? 'km-num' : undefined, colSpan: c.span }, c.v)));

  /* -------------------------------- gráficos ------------------------------ */

  /** Barras horizontales agrupadas: filas = [{ label, a, b }]. */
  function barrasDobles(filas, colorA, colorB, etiquetaA, etiquetaB) {
    const W = 720, LB = 168, PAD = 56, alto = 20;
    const H = filas.length * alto + 16;
    const max = Math.max.apply(null, filas.map((f) => Math.max(f.a, f.b)).concat([1]));
    const esc = (v) => (v / max) * (W - LB - PAD);
    const cuerpo = filas.map((f, i) => h('g', { key: f.label, transform: 'translate(0,' + (i * alto + 10) + ')' },
      h('text', { x: LB - 8, y: 4, textAnchor: 'end', className: 'km-lbl' }, corto(f.label)),
      h('rect', { x: LB, y: -5, width: Math.max(1, esc(f.a)), height: 6, rx: 3, fill: colorA, opacity: .85 }),
      h('rect', { x: LB, y: 2, width: Math.max(1, esc(f.b)), height: 6, rx: 3, fill: colorB }),
      h('title', null, corto(f.label) + ' — ' + etiquetaA + ' ' + usd(f.a) + ' · ' + etiquetaB + ' ' + usd(f.b)),
      h('text', { x: LB + Math.max(esc(f.a), esc(f.b)) + 6, y: 4, className: 'km-val' }, usd(f.b))));

    return h('div', null,
      h('div', { className: 'km-leyenda' },
        h('span', null, h('i', { style: { background: colorA } }), etiquetaA),
        h('span', null, h('i', { style: { background: colorB } }), etiquetaB)),
      h('div', { className: 'km-chart-wrap' },
        h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '600px' } },
          h('line', { x1: LB, y1: 2, x2: LB, y2: H - 6, className: 'km-ax' }),
          cuerpo)));
  }

  /** Dona con leyenda: partes = [{ label, valor }]. */
  function dona(partes, total) {
    const R = 54, GR = 26, CIRC = 2 * Math.PI * R;
    let acum = 0;
    const arcos = partes.map((p, i) => {
      const frac = total ? p.valor / total : 0;
      const el = h('circle', {
        key: p.label, cx: 70, cy: 70, r: R, fill: 'none',
        stroke: PAL[i % PAL.length], strokeWidth: GR,
        strokeDasharray: (frac * CIRC) + ' ' + CIRC,
        strokeDashoffset: -acum * CIRC,
        transform: 'rotate(-90 70 70)',
      }, h('title', null, p.label + ' — ' + usd(p.valor) + ' (' + pct(frac, 0) + ')'));
      acum += frac;
      return el;
    });
    const leyenda = partes.map((p, i) => h('span', { key: p.label },
      h('i', { style: { background: PAL[i % PAL.length] } }),
      p.label, h('b', null, usd(p.valor))));

    return h('div', { className: 'km-dona-row' },
      h('svg', { viewBox: '0 0 140 140', className: 'km-chart', style: { width: '150px', flex: 'none' } },
        h('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: 'rgba(255,255,255,.06)', strokeWidth: GR }),
        arcos,
        h('text', { x: 70, y: 68, textAnchor: 'middle', className: 'km-lbl', style: { fontSize: '15px', fontWeight: 700 } }, usd(total)),
        h('text', { x: 70, y: 82, textAnchor: 'middle', style: { fontSize: '9px' } }, 'al mes')),
      h('div', { className: 'km-dona-leg', style: { flex: 1, minWidth: '180px' } }, leyenda));
  }

  /** Barras verticales: filas = [{ label, valor, color }]. */
  function barrasVert(filas, formato) {
    const W = 520, H = 200, BASE = H - 26, TOP = 16;
    const max = Math.max.apply(null, filas.map((f) => f.valor).concat([1]));
    const ancho = W / filas.length;
    const cuerpo = filas.map((f, i) => {
      const alto = Math.max(2, ((f.valor / max) * (BASE - TOP)));
      const x = i * ancho + ancho * 0.22;
      const w = ancho * 0.56;
      return h('g', { key: f.label },
        h('rect', { x: x, y: BASE - alto, width: w, height: alto, rx: 5, fill: f.color, opacity: .9 },
          h('title', null, f.label + ' — ' + formato(f.valor))),
        h('text', { x: x + w / 2, y: BASE - alto - 5, textAnchor: 'middle', className: 'km-val' }, formato(f.valor)),
        h('text', { x: x + w / 2, y: BASE + 15, textAnchor: 'middle', className: 'km-lbl' }, f.label));
    });
    return h('div', { className: 'km-chart-wrap' },
      h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '420px' } },
        h('line', { x1: 0, y1: BASE, x2: W, y2: BASE, className: 'km-ax' }),
        cuerpo));
  }

  /** Barras horizontales simples: filas = [{ label, valor, nota }]. */
  function barrasSimples(filas, color, formato) {
    const W = 700, LB = 150, PAD = 74, alto = 19;
    const H = filas.length * alto + 10;
    const max = Math.max.apply(null, filas.map((f) => f.valor).concat([1]));
    const cuerpo = filas.map((f, i) => h('g', { key: f.label, transform: 'translate(0,' + (i * alto + 8) + ')' },
      h('text', { x: LB - 8, y: 4, textAnchor: 'end', className: 'km-lbl' }, corto(f.label)),
      h('rect', {
        x: LB, y: -5, height: 10, rx: 5, fill: color, opacity: .85,
        width: Math.max(1, (f.valor / max) * (W - LB - PAD)),
      }, h('title', null, f.label + ' — ' + formato(f.valor) + (f.nota ? ' · ' + f.nota : ''))),
      h('text', { x: LB + (f.valor / max) * (W - LB - PAD) + 6, y: 4, className: 'km-val' }, formato(f.valor))));
    return h('div', { className: 'km-chart-wrap' },
      h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '560px' } },
        h('line', { x1: LB, y1: 0, x2: LB, y2: H - 4, className: 'km-ax' }),
        cuerpo));
  }

  /* ------------------------------- pestañas ------------------------------ */

  const TABS = [
    ['resumen', 'Resumen', '◎'],
    ['mapa', 'Mapa competitivo', '▤'],
    ['competencia', 'Precios por app', '⑈'],
    ['planes', 'Planes y kits', '▥'],
    ['configurador', 'Configurador', '⚙'],
    ['mercados', 'Mercados', '🌎'],
    ['economia', 'Economía', '📈'],
    ['clientes', 'Clientes', '👥'],
    ['proscontras', 'Pros y contras', '⇆'],
    ['diagnostico', 'Diagnóstico', '⚑'],
  ];

  function valsTexto(oferta) {
    const ent = oferta.planes[oferta.planes.length - 1];
    const kits = oferta.kits.map((k) => k.mensual);
    const top3 = oferta.modulos.slice().sort((a, b) => b.sugerido - a.sugerido).slice(0, 3)
      .map((m) => corto(m.app)).join(', ');
    return {
      stack: usd(oferta.stackTotal), aLaCarta: usd(oferta.aLaCarta), enterprise: usd(ent.mensual),
      ahorroAnual: usd(oferta.ahorroAnualStack), top3: top3,
      kitMin: usd(Math.min.apply(null, kits)), kitMax: usd(Math.max.apply(null, kits)),
      estimados: String(DATA.competidores.length - oferta.verificados),
      totalPlanes: String(DATA.competidores.length),
    };
  }

  const tarjetaDiag = (t, vals) => h('div', { className: 'km-diag', key: t.titulo, style: { '--k-g': C[t.color] || C.violet } },
    h('h4', null, t.titulo),
    h('p', null, rt(t.texto, vals)));

  function vistaResumen(oferta, demanda) {
    const vals = valsTexto(oferta);
    const ent = oferta.planes[oferta.planes.length - 1];

    const filasMain = oferta.modulos.slice()
      .sort((a, b) => b.med - a.med)
      .map((m) => ({ label: m.app, a: m.med, b: m.sugerido }));

    const porHerramienta = oferta.stack.slice().sort((a, b) => b.costo - a.costo);
    const top = porHerramienta.slice(0, 9).map((s) => ({ label: s.herramienta, valor: s.costo }));
    const resto = porHerramienta.slice(9).reduce((a, s) => a + s.costo, 0);
    if (resto > 0) top.push({ label: 'Otras ' + (porHerramienta.length - 9) + ' herramientas', valor: resto });

    const escalera = oferta.planes.map((p, i) => ({
      label: p.nombre, valor: p.porUsuario, color: [C.violet, C.calipso, C.fuchsia, C.teal][i % 4],
    })).concat([{ label: 'Stack actual', valor: oferta.stackPorUsuario, color: C.orange }]);

    return h('div', { className: 'km-wrap km-fade' },
      nota(VIS.notas.resumen),
      h('div', { className: 'km-g2' },
        card('Precio sugerido KIMOS vs. mediana del mercado', C.cyan,
          'Por módulo, normalizado al cliente tipo. La barra violeta es el mercado; la cian, KIMOS.',
          barrasDobles(filasMain, C.violet, C.cyan, 'Mediana del mercado', 'Precio sugerido KIMOS')),
        h('div', { className: 'km-col' },
          card('El gasto que KIMOS reemplaza', C.fuchsia,
            'Stack best-of-breed que arma hoy una empresa del tamaño tipo, por herramienta.',
            dona(top, oferta.stackTotal)),
          card('Escalera de planes', C.orange,
            'Precio mensual por usuario de cada plan frente al costo del stack actual.',
            barrasVert(escalera, usd1)))),
      card('Lo que dice el estudio, en cinco frases', C.green, null,
        h('div', { className: 'km-g3' }, VIS.tldr.map((t) => tarjetaDiag(t, vals)))),
      card('Y lo que dice el estudio de demanda', C.blue,
        'El alcance comercial elegido manda sobre estos cuatro números.',
        h('div', { className: 'km-kpis' },
          kpi('SAM del alcance', mm(demanda.sam), demanda.filas.length + ' mercados · índice ' + x2(demanda.indice), C.blue),
          kpi('ARPU anual', usd(demanda.arpuAnual), 'Con el mix de planes actual', C.teal),
          kpi('ARR al año 3', usd(demanda.arr[2]), num(demanda.vivos[2]) + ' clientes vivos', C.green),
          kpi('Penetración necesaria', pct(demanda.penetracion, 2),
            demanda.penetracion > 0.02 ? 'Sobre 2%: el plan deja de ser realista' : 'Bajo el umbral de alerta',
            demanda.penetracion > 0.02 ? C.red : C.cyan))),
      h('p', { className: 'km-pie' }, 'Estudio del ' + DATA.meta.fecha + ' · precios de lista públicos en '
        + DATA.meta.moneda + ', sin impuestos ni descuentos por volumen · cliente tipo de '
        + estado.sup.usuarios + ' usuarios y ' + estado.sup.canales + ' canales · KIMOS Enterprise ' + usd(ent.mensual) + '/mes'));
  }

  function vistaMapa(oferta) {
    const o = estado.orden.mod;
    const val = (m) => ({
      app: m.app, cat: m.cat, min: m.min, med: m.med, max: m.max,
      sugerido: m.sugerido, ahorro: m.ahorro, ventaja: m.ventaja,
    })[o.key];
    const filas = oferta.modulos.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * o.dir;
    });

    const cols = [
      { k: 'app', l: 'App KIMOS', sort: true, cell: (m) => [h('b', { key: 'b' }, m.app), h('div', { key: 'd', className: 'km-sub2' }, m.que)] },
      { k: 'cat', l: 'Categoría de mercado', sort: true, cell: (m) => m.cat },
      { k: 'alt', l: 'Alternativas', cell: (m) => h('span', { className: 'km-sub2' }, m.alt) },
      { k: 'tgt', l: 'Target', cell: (m) => pill(m.target, 'km-p-v') },
      { k: 'min', l: 'Mín', num: true, sort: true, cell: (m) => usd(m.min) },
      { k: 'med', l: 'Mediana', num: true, sort: true, cell: (m) => h('span', { className: 'km-cel-med' }, usd(m.med)) },
      { k: 'max', l: 'Máx', num: true, sort: true, cell: (m) => h('span', { className: 'km-mut' }, usd(m.max)) },
      { k: 'sugerido', l: 'Sugerido', num: true, sort: true, cell: (m) => h('span', { className: 'km-cel-sug' }, usd(m.sugerido)) },
      { k: 'pu', l: 'Por usuario', num: true, cell: (m) => usd1(m.porUsuario) },
      { k: 'ahorro', l: 'Ahorro', num: true, sort: true, cell: (m) => h('span', { className: 'km-cel-ok' }, pct(m.ahorro, 0)) },
      { k: 'cuad', l: 'Cuadrante', cell: (m) => pill(m.cuadrante, CLASE_CUAD[m.cuadrante]) },
      { k: 'datos', l: 'Datos', cell: (m) => pill(m.verificados + '/' + m.planes, m.verificados >= m.planes * 0.7 ? 'km-p-ok' : 'km-p-est') },
    ];

    const t = tabla(cols, filas, {
      orden: o, onSort: (k) => setOrden('mod', k), key: (m) => m.n,
      clase: (m) => (estado.modSel === m.n ? 'on' : ''),
      onClick: (m) => commit({ modSel: estado.modSel === m.n ? null : m.n }),
    });

    const sel = estado.modSel != null ? oferta.byN.get(estado.modSel) : null;
    return h('div', { className: 'km-wrap km-fade' },
      card('Mapa competitivo por aplicación', C.violet,
        'Cada app de KIMOS, contra quién compite, en qué rango se mueve el mercado y a qué precio conviene entrar. La mediana excluye planes Enterprise (Akeneo, Salsify, Cvent, Bizzabo, Kissflow, Nintex) porque son de otro segmento y distorsionan la referencia. Haz clic en una fila para ver el detalle.',
        t),
      sel ? detalleModulo(sel, oferta) : null);
  }

  function detalleModulo(sel, oferta) {
    const i = DATA.modulos.map((m) => m.n).indexOf(sel.n);
    const cols = [
      { k: 'comp', l: 'Competidor', cell: (r) => h('b', null, r.c.comp) },
      { k: 'plan', l: 'Plan', cell: (r) => h('span', { className: 'km-mut' }, r.c.plan) },
      { k: 'precio', l: 'Precio', num: true, cell: (r) => usd1(precioLista(r.c, r.i, estado.precios)) },
      { k: 'unidad', l: 'Unidad', cell: (r) => h('span', { className: 'km-mut' }, r.c.unidad) },
      { k: 'tipo', l: 'Cliente tipo', num: true, cell: (r) => h('span', { className: 'km-cel-sug' }, usd(r.costo)) },
      { k: 'seg', l: 'Segmento', cell: (r) => (r.c.seg === 'Enterprise' ? pill('Enterprise', 'km-p-ent') : h('span', { className: 'km-mut' }, r.c.seg)) },
      { k: 'nota', l: 'Notas', cell: (r) => h('span', { className: 'km-mut' }, r.c.nota) },
      { k: 'fuente', l: 'Fuente', cell: (r) => h('span', { className: 'km-src' }, r.c.fuente) },
    ];
    const filas = DATA.competidores
      .map((c, idx) => ({ c: c, i: idx, costo: costoTipo(c, estado.sup, idx, estado.precios) }))
      .filter((r) => r.c.app === sel.app);

    return h('aside', { className: 'km-detalle' },
      h('div', { className: 'km-detalle-h' },
        h('div', { style: { display: 'flex', gap: '11px', alignItems: 'center' } },
          icono(sel, i),
          h('div', null,
            h('h2', { style: { fontSize: '16px' } }, sel.app),
            h('div', { className: 'km-app-cat' }, sel.cat + ' · ' + sel.que))),
        h('button', { className: 'km-x', onClick: () => commit({ modSel: null }), title: 'Cerrar' }, '✕')),
      h('div', { className: 'km-kpis' },
        kpi('Mediana del mercado', usd(sel.med) + '/mes', 'Rango ' + usd(sel.min) + ' – ' + usd(sel.max), C.fuchsia),
        kpi('Precio sugerido', usd(sel.sugerido) + '/mes', usd1(sel.porUsuario) + ' por usuario', C.cyan),
        kpi('Ahorro vs mercado', pct(sel.ahorro, 0), 'Factor ' + x2(estado.sup.factor), C.green),
        kpi('Datos', sel.verificados + '/' + sel.planes, 'precios verificados en fuente', C.violet)),
      h('div', { className: 'km-g2' },
        h('div', { className: 'km-pc km-pro' }, h('b', null, 'A favor'), sel.pro),
        h('div', { className: 'km-pc km-con' }, h('b', null, 'En contra'), sel.contra)),
      h('div', { className: 'km-strat' }, h('b', null, 'Estrategia: '), sel.estrategia),
      tabla(cols, filas, { key: (r) => r.i }));
  }

  function vistaCompetencia(oferta) {
    const f = estado.filtro;
    const q = f.q.trim().toLowerCase();
    let filas = DATA.competidores.map((c, i) => ({
      c: c, i: i, app: c.app, comp: c.comp, plan: c.plan, conf: c.conf,
      precio: precioLista(c, i, estado.precios),
      costo: costoTipo(c, estado.sup, i, estado.precios),
    }));
    if (f.app) filas = filas.filter((r) => r.app === f.app);
    if (f.seg) filas = filas.filter((r) => r.c.seg === f.seg);
    if (f.conf) filas = filas.filter((r) => r.conf === f.conf);
    if (q) filas = filas.filter((r) => (r.comp + ' ' + r.plan + ' ' + r.app + ' ' + r.c.nota).toLowerCase().indexOf(q) >= 0);

    const o = estado.orden.comp;
    filas.sort((a, b) => {
      const x = a[o.key], y = b[o.key];
      return (typeof x === 'string' ? x.localeCompare(y) : (x || 0) - (y || 0)) * o.dir;
    });

    const cols = [
      { k: 'app', l: 'App KIMOS', sort: true, cell: (r) => h('span', { className: 'km-mut' }, r.app) },
      { k: 'comp', l: 'Competidor', sort: true, cell: (r) => h('b', null, r.comp) },
      { k: 'plan', l: 'Plan', sort: true, cell: (r) => h('span', { className: 'km-mut' }, r.plan) },
      {
        k: 'precio', l: 'Precio USD/mes', num: true, sort: true,
        cell: (r) => h('input', {
          className: 'km-edit' + (estado.precios[r.i] != null ? ' km-tocado' : ''),
          type: 'number', step: '0.01', min: '0', value: r.precio,
          title: 'Edita el precio y el modelo completo se recalcula',
          onChange: (e) => setPrecio(r.i, e.target.value),
        }),
      },
      { k: 'unidad', l: 'Unidad', cell: (r) => h('span', { className: 'km-mut' }, r.c.unidad) },
      { k: 'costo', l: 'Cliente tipo', num: true, sort: true, cell: (r) => h('span', { className: 'km-cel-sug' }, usd(r.costo)) },
      { k: 'seg', l: 'Segmento', cell: (r) => (r.c.seg === 'Enterprise' ? pill('Enterprise', 'km-p-ent') : h('span', { className: 'km-mut' }, r.c.seg)) },
      { k: 'nota', l: 'Notas', cell: (r) => h('span', { className: 'km-mut' }, r.c.nota) },
      { k: 'fuente', l: 'Fuente', cell: (r) => h('span', { className: 'km-src' }, r.c.fuente) },
      { k: 'conf', l: 'Confianza', sort: true, cell: (r) => pillConf(r.conf) },
    ];

    const editados = Object.keys(estado.precios).length;
    const ctrl = (label, k, min, max, step, formato) => h('div', { className: 'km-ctrl', key: k },
      h('label', null, label),
      h('div', { className: 'km-ctrl-row' },
        h('input', {
          className: 'km-range', type: 'range', min: min, max: max, step: step,
          value: estado.sup[k], onChange: (e) => setSup(k, e.target.value),
        }),
        h('span', { className: 'km-val' }, formato(estado.sup[k]))));

    return h('div', { className: 'km-wrap km-fade' },
      h('div', { className: 'km-ctrls' },
        ctrl('Usuarios del cliente tipo', 'usuarios', 1, 200, 1, num),
        ctrl('Canales sociales', 'canales', 1, 30, 1, num),
        ctrl('Factor de posicionamiento', 'factor', 0.2, 1.2, 0.05, x2),
        ctrl('Descuento pago anual', 'descAnual', 0, 0.4, 0.01, (v) => pct(v, 0))),
      nota(VIS.notas.factor),
      card('Detalle de precios de la competencia', C.calipso,
        'Los precios en cian son editables: escribe otro número y la mediana, el precio sugerido, los planes y el configurador se recalculan.',
        h('div', null,
          h('div', { className: 'km-filtros', style: { marginBottom: '12px' } },
            h('input', {
              className: 'km-in km-q', placeholder: 'Filtrar por app, competidor o nota…',
              value: f.q, onChange: (e) => setFiltro('q', e.target.value),
            }),
            selector(f.app, DATA.modulos.map((m) => m.app), (v) => setFiltro('app', v), 'Todas las apps'),
            selector(f.seg, ['PyME / Empresa', 'Enterprise'], (v) => setFiltro('seg', v), 'Todos los segmentos'),
            selector(f.conf, ['Verificado', 'Estimado'], (v) => setFiltro('conf', v), 'Toda confianza'),
            h('span', { className: 'km-cuenta' }, filas.length + ' de ' + DATA.competidores.length + ' planes · '
              + oferta.verificados + ' verificados' + (editados ? ' · ' + editados + ' editados a mano' : '')),
            editados ? h('button', { className: 'km-btn', onClick: () => commit({ precios: {} }) }, '↺ Precios originales') : null),
          tabla(cols, filas, { orden: o, onSort: (k) => setOrden('comp', k), key: (r) => r.i }))));
  }

  const selector = (valor, opciones, onChange, vacio) => h('select', {
    className: 'km-in', value: valor, onChange: (e) => onChange(e.target.value),
  }, [h('option', { value: '', key: '' }, vacio)].concat(
    opciones.map((o) => h('option', { value: o, key: o }, o))));

  function tarjetaPlan(p, destacado) {
    return h('article', { className: 'km-plan' + (destacado ? ' hot' : ''), key: p.id },
      destacado ? h('span', { className: 'km-plan-tag' }, 'MÁS VENDIBLE') : null,
      h('h3', null, p.nombre),
      h('div', { className: 'km-plan-who' }, p.para),
      h('div', { className: 'km-plan-precio' }, usd(p.mensual)),
      h('div', { className: 'km-plan-pu' }, 'al mes · ' + usd1(p.porUsuario) + ' por usuario · ' + usd(p.anual) + '/año'),
      h('div', { className: 'km-plan-desc' },
        h('span', null, 'Suma a la carta ' + usd(p.suma) + ' · descuento'),
        h('input', {
          className: 'km-edit', type: 'number', min: '0', max: '95', step: '1',
          value: Math.round(p.descuento * 100), style: { width: '62px' },
          onChange: (e) => setDesc(p.id, Number(e.target.value) / 100),
        }),
        h('span', null, '%')),
      h('ul', { className: 'km-plan-mods' }, p.nombres.map((n) => h('li', { key: n }, corto(n)))));
  }

  function vistaPlanes(oferta) {
    const banda = oferta.ratioStack > 0.60 ? 'riesgo' : oferta.ratioStack < 0.25 ? 'aviso' : 'ok';
    const colorBanda = banda === 'ok' ? C.green : banda === 'riesgo' ? C.red : C.amber;
    const cols = [
      { k: 'nec', l: 'Necesidad', cell: (s) => s.necesidad },
      { k: 'her', l: 'Herramienta de hoy', cell: (s) => h('b', null, s.herramienta) },
      { k: 'plan', l: 'Plan', cell: (s) => h('span', { className: 'km-mut' }, s.plan) },
      { k: 'uni', l: 'Unidad', cell: (s) => h('span', { className: 'km-mut' }, s.unidad) },
      { k: 'costo', l: 'Costo mensual', num: true, cell: (s) => usd(s.costo) },
    ];
    const pie = [filaTotal([
      { v: 'TOTAL stack best-of-breed', span: 4 },
      { v: usd(oferta.stackTotal), num: true },
    ])];

    return h('div', { className: 'km-wrap km-fade' },
      card('Planes por tamaño de empresa', C.fuchsia,
        'El descuento de bundle es editable en cada plan. Sin descuento, la suma de módulos da un precio que ningún cliente paga.',
        h('div', { className: 'km-g3' }, oferta.planes.map((p) => tarjetaPlan(p, p.id === 'business')))),
      card('Kits por necesidad del cliente', C.teal,
        'Para clientes que no necesitan la suite completa sino resolver un frente concreto. Es la oferta de entrada por defecto: menos firmas en el comité, ciclo más corto.',
        h('div', { className: 'km-g3' }, oferta.kits.map((p) => tarjetaPlan(p, false)))),
      card('Chequeo de realidad', C.orange,
        'Lo que gasta hoy el cliente tipo armando el stack por su cuenta. Es el número contra el que se negocia.',
        h('div', { className: 'km-g2' },
          tabla(cols, oferta.stack, { key: (s, i) => i, pie: pie }),
          h('div', { className: 'km-col' },
            h('div', { className: 'km-kpis', style: { gridTemplateColumns: '1fr 1fr' } },
              kpi('Stack actual', usd(oferta.stackTotal), usd1(oferta.stackPorUsuario) + ' por usuario', C.orange),
              kpi('KIMOS Enterprise', usd(oferta.planes[3].mensual), usd1(oferta.planes[3].porUsuario) + ' por usuario', C.cyan),
              kpi('KIMOS sobre ese gasto', pct(oferta.ratioStack, 0),
                banda === 'ok' ? 'Dentro de la banda sana' : banda === 'riesgo' ? 'Sobre 60%' : 'Bajo 25%', colorBanda),
              kpi('Ahorro anual del cliente', usd(oferta.ahorroAnualStack), 'Enterprise vs stack', C.green)),
            nota(VIS.notas.banda)))));
  }

  function vistaConfigurador(oferta) {
    const sel = estado.cfg.mods.filter((a) => oferta.byApp.has(a));
    const suma = sel.reduce((a, app) => a + oferta.byApp.get(app).sugerido, 0);
    const precio = Math.round(suma * (1 - estado.cfg.desc));
    const equivalente = oferta.stack.filter((s) => sel.indexOf(s.app) >= 0).reduce((a, s) => a + s.costo, 0);
    const ratio = equivalente ? precio / equivalente : 0;
    const veredicto = !sel.length ? 'Selecciona módulos para cotizar.'
      : !equivalente ? 'Ninguno de los módulos elegidos tiene equivalente en el stack de referencia: la comparación de ahorro no aplica.'
      : ratio > 0.6 ? '⚠ Estás sobre el 60% del gasto actual: el argumento de ahorro se debilita.'
      : ratio < 0.25 ? '⚠ Bajo el 25% del gasto actual: estás dejando margen sobre la mesa.'
      : '✓ La cotización cae dentro de la banda sana de 25%–60% del gasto actual del cliente.';

    const presets = [{ id: '__todos', nombre: 'Suite completa' }]
      .concat(DATA.planes.map((p) => ({ id: p.id, nombre: p.nombre })))
      .concat(DATA.kits.map((p) => ({ id: p.id, nombre: p.nombre })))
      .concat([{ id: '__ninguno', nombre: 'Limpiar' }]);

    const mods = oferta.modulos.map((m) => h('label', {
      key: m.n, className: 'km-mod' + (sel.indexOf(m.app) >= 0 ? ' on' : ''),
    },
      h('input', { type: 'checkbox', checked: sel.indexOf(m.app) >= 0, onChange: () => toggleMod(m.app) }),
      h('span', null, corto(m.app)),
      h('span', { className: 'km-mod-pz' }, usd(m.sugerido))));

    const linea = (l, v, color) => h('div', { className: 'km-qline', key: l },
      h('span', null, l), h('b', { style: color ? { color: color } : null }, v));

    const cotizacion = h('div', { className: 'km-quote' },
      h('div', { className: 'km-quote-k' }, 'Cotización'),
      h('div', { className: 'km-quote-big' }, usd(precio)),
      h('div', { style: { color: 'var(--k-mut)', fontSize: '12px', marginBottom: '12px' } },
        'al mes · ' + usd1(precio / estado.sup.usuarios) + ' por usuario · ' + sel.length + ' módulos'),
      linea('Suma a la carta', usd(suma)),
      h('div', { className: 'km-qline' },
        h('span', null, 'Descuento bundle'),
        h('span', null,
          h('input', {
            className: 'km-edit', type: 'number', min: '0', max: '95', step: '1',
            value: Math.round(estado.cfg.desc * 100), style: { width: '62px' },
            onChange: (e) => commit({ cfg: Object.assign({}, estado.cfg, { desc: Math.min(0.95, Math.max(0, Number(e.target.value) / 100)) }) }),
          }), ' %')),
      linea('Precio anual', usd(precio * 12 * (1 - estado.sup.descAnual))),
      linea('Equivalente en el mercado', usd(equivalente), C.orange),
      linea('Ahorro anual del cliente', usd(Math.max(0, (equivalente - precio) * 12)), C.green),
      h('div', { className: 'km-veredicto' }, veredicto));

    return h('div', { className: 'km-wrap km-fade' },
      card('Configurador de suscripción', C.cyan,
        'Marca los módulos que necesita el cliente y obtén la cotización al instante, comparada contra lo que gastaría comprando cada herramienta por separado.',
        h('div', { className: 'km-cfg' },
          h('div', null,
            h('div', { className: 'km-filtros', style: { marginBottom: '13px' } },
              presets.map((p) => h('button', {
                key: p.id, className: 'km-btn', onClick: () => setPreset(p.id),
              }, p.nombre))),
            h('div', { className: 'km-modgrid' }, mods)),
          cotizacion)));
  }

  function vistaMercados(oferta, demanda) {
    const a = estado.alcance;
    const uniq = (k) => Array.from(new Set(DATA.demanda.paises.map((p) => p[k]))).sort();
    const precio = (id, ix) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || { mensual: 0 }).mensual * ix);
    const reco = (ix) => (ix >= 0.95 ? 'Subir el factor a 0,85–0,90'
      : ix >= 0.75 ? 'Lista regional, factor 0,7'
      : ix >= 0.55 ? 'Mantener factor 0,55' : 'Solo autoservicio');
    const filas = demanda.filas.slice().sort((x, y) => y.sam - x.sam);

    const cols = [
      { k: 'pais', l: 'Mercado', cell: (f) => h('b', null, f.pais) },
      { k: 'region', l: 'Región', cell: (f) => h('span', { className: 'km-mut' }, f.region) },
      { k: 'idioma', l: 'Idioma', cell: (f) => h('span', { className: 'km-mut' }, f.idioma) },
      { k: 'prio', l: 'Prioridad', cell: (f) => pill(f.prioridad, CLASE_PRIO[f.prioridad] || 'km-p-v') },
      { k: 'cob', l: 'Cobertura', num: true, cell: (f) => pct(f.cobertura, 0) },
      { k: 'saas', l: 'SaaS', num: true, cell: (f) => h('span', { className: 'km-mut' }, mm(f.saas)) },
      { k: 'tam', l: 'TAM', num: true, cell: (f) => h('span', { className: 'km-mut' }, mm(f.tam)) },
      { k: 'sam', l: 'SAM', num: true, cell: (f) => h('span', { className: 'km-cel-sug' }, mm(f.sam)) },
      { k: 'ix', l: 'Índice', num: true, cell: (f) => x2(f.indice) },
      { k: 'st', l: 'Starter', num: true, cell: (f) => usd(precio('starter', f.indice)) },
      { k: 'bs', l: 'Business', num: true, cell: (f) => usd(precio('business', f.indice)) },
      { k: 'ent', l: 'Enterprise', num: true, cell: (f) => usd(precio('enterprise', f.indice)) },
      { k: 'reco', l: 'Recomendación', cell: (f) => h('span', { className: 'km-mut' }, reco(f.indice)) },
    ];

    return h('div', { className: 'km-wrap km-fade' },
      h('div', { className: 'km-ctrls', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' } },
        h('div', { className: 'km-ctrl' }, h('label', null, 'Región'), selector(a.region, uniq('region'), (v) => setAlcance('region', v), 'Todas')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'País'), selector(a.pais, DATA.demanda.paises.map((p) => p.pais), (v) => setAlcance('pais', v), 'Todos')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'Idioma'), selector(a.idioma, uniq('idioma'), (v) => setAlcance('idioma', v), 'Todos')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'Prioridad comercial'), selector(a.prioridad, uniq('prioridad'), (v) => setAlcance('prioridad', v), 'Todas')),
        h('div', { className: 'km-ctrl' },
          h('label', null, 'Alcance'),
          h('div', { className: 'km-ctrl-row' },
            h('span', { className: 'km-cuenta' }, demanda.filas.length + ' de ' + DATA.demanda.paises.length + ' mercados'),
            h('button', { className: 'km-btn', onClick: () => commit({ alcance: { region: '', idioma: '', prioridad: '', pais: '' } }) }, 'Global')))),
      h('div', { className: 'km-kpis' },
        kpi('Mercado SaaS del alcance', mm(demanda.mercado), 'Base del embudo', C.violet),
        kpi('TAM', mm(demanda.tam), 'Suites de gestión en PyME y mid-market', C.blue),
        kpi('SAM', mm(demanda.sam), 'Con la cobertura comercial de cada país', C.cyan),
        kpi('Índice de precio', x2(demanda.indice), 'Ponderado por SAM · 1,00 = lista EE.UU.', C.fuchsia),
        kpi('ARPU anual', usd(demanda.arpuAnual), 'Base ' + usd(demanda.arpuAnualBase) + ' × índice', C.teal),
        kpi('Penetración al año 3', pct(demanda.penetracion, 2),
          demanda.penetracion > 0.02 ? 'Sobre 2%: alcance demasiado chico' : 'Bajo el umbral de alerta',
          demanda.penetracion > 0.02 ? C.red : C.green)),
      h('div', { className: 'km-g2' },
        card('Dónde está el mercado alcanzable', C.cyan,
          'SAM por mercado, ya descontada la cobertura comercial realista de cada país.',
          barrasSimples(filas.slice(0, 15).map((f) => ({ label: f.pais, valor: f.sam, nota: f.prioridad })), C.cyan, mm)),
        card('Precio por país', C.fuchsia,
          'El mismo plan Business ajustado por el índice de precio de cada mercado. Es la misma lista con varios precios, no varios productos.',
          barrasSimples(filas.slice(0, 15).map((f) => ({ label: f.pais, valor: precio('business', f.indice) })), C.fuchsia, usd))),
      card('Los mercados, uno por uno', C.violet,
        'El SAM de esta tabla usa la cobertura por prioridad comercial de cada país, más fina que la cobertura por región.',
        tabla(cols, filas, { key: (f) => f.pais, title: (f) => f.contexto })));
  }

  function vistaEconomia(oferta, demanda) {
    const s = estado.sup;
    const alerta = demanda.ratio < 2.5;
    const cols = [
      { k: 'coh', l: 'Cohorte', cell: (c) => 'Captados en el año ' + c.anio },
      { k: 'nuevos', l: 'Clientes nuevos', num: true, cell: (c) => num(c.nuevos) },
      { k: 'a1', l: 'Vivos al cierre año 1', num: true, cell: (c) => (c.vivos[0] ? num(c.vivos[0]) : '—') },
      { k: 'a2', l: 'Año 2', num: true, cell: (c) => (c.vivos[1] ? num(c.vivos[1]) : '—') },
      { k: 'a3', l: 'Año 3', num: true, cell: (c) => (c.vivos[2] ? num(c.vivos[2]) : '—') },
    ];
    const pie = [
      filaTotal([{ v: 'Clientes vivos' }, { v: num(s.clientes3), num: true },
        { v: num(demanda.vivos[0]), num: true }, { v: num(demanda.vivos[1]), num: true }, { v: num(demanda.vivos[2]), num: true }]),
    ];
    const ctrl = (label, k, min, max, step, formato) => h('div', { className: 'km-ctrl', key: k },
      h('label', null, label),
      h('div', { className: 'km-ctrl-row' },
        h('input', {
          className: 'km-range', type: 'range', min: min, max: max, step: step,
          value: s[k], onChange: (e) => setSup(k, e.target.value),
        }),
        h('span', { className: 'km-val' }, formato(s[k]))));

    const mixSuma = ['starter', 'business', 'enterprise'].reduce((a, k) => a + (estado.mix[k] || 0), 0);

    return h('div', { className: 'km-wrap km-fade' },
      h('div', { className: 'km-ctrls' },
        ctrl('Churn mensual', 'churn', 0.01, 0.12, 0.005, (v) => pct(v, 1)),
        ctrl('Margen bruto', 'margen', 0.4, 0.95, 0.01, (v) => pct(v, 0)),
        ctrl('CAC promedio', 'cac', 100, 4000, 50, usd),
        ctrl('Clientes captados al año 3', 'clientes3', 50, 3000, 10, num)),
      h('div', { className: 'km-kpis' },
        kpi('ARPU mensual base', usd(demanda.arpuMensual), 'Mix ' + pct(estado.mix.starter, 0) + ' / '
          + pct(estado.mix.business, 0) + ' / ' + pct(estado.mix.enterprise, 0), C.violet),
        kpi('ARPU anual del alcance', usd(demanda.arpuAnual), 'Índice ' + x2(demanda.indice), C.teal),
        kpi('Vida media', x1(demanda.vidaMedia) + ' meses', 'Inversa del churn ' + pct(s.churn, 1), C.blue),
        kpi('LTV', usd(demanda.ltv), 'ARPU × margen × vida media', C.cyan),
        kpi('LTV : CAC', x1(demanda.ratio) + ' : 1', alerta ? 'Bajo el benchmark PyME (2,5:1)' : 'Sobre el benchmark PyME', alerta ? C.red : C.green),
        kpi('CAC payback', x1(demanda.payback) + ' meses', demanda.payback > 12 ? 'Sobre los 12 meses objetivo' : 'Benchmark PyME: 6,2 meses',
          demanda.payback > 12 ? C.red : C.green)),
      h('div', { className: 'km-g2' },
        card('ARR a tres años', C.green,
          'Cada cohorte se capta repartida en 12 meses y se le aplica supervivencia mes a mes. Sin ese descuento el churn no afectaría el ARR y la proyección sería falsa.',
          barrasVert([0, 1, 2].map((i) => ({
            label: 'Año ' + (i + 1), valor: demanda.arr[i], color: [C.violet, C.calipso, C.cyan][i],
          })), usd)),
        card('Mix de planes', C.fuchsia,
          'Cuánto pesa cada plan en la base de clientes. Mueve el mix y el ARPU, el LTV y el ARR se recalculan.',
          h('div', null,
            ['starter', 'business', 'enterprise'].map((k) => {
              const p = oferta.planes.filter((x) => x.id === k)[0];
              return h('div', { className: 'km-ctrl', key: k, style: { marginBottom: '10px' } },
                h('label', null, p.nombre + ' · ' + usd(p.mensual) + '/mes'),
                h('div', { className: 'km-ctrl-row' },
                  h('input', {
                    className: 'km-range', type: 'range', min: 0, max: 1, step: 0.05,
                    value: estado.mix[k] || 0, onChange: (e) => setMix(k, e.target.value),
                  }),
                  h('span', { className: 'km-val' }, pct(estado.mix[k], 0))));
            }),
            h('div', { className: 'km-cuenta', style: Math.abs(mixSuma - 1) > 0.001 ? { color: C.red } : null },
              'Suma del mix: ' + pct(mixSuma, 0) + (Math.abs(mixSuma - 1) > 0.001 ? ' — debería sumar 100%' : ''))))),
      card('Proyección por cohorte', C.cyan,
        'De los ' + num(s.clientes3) + ' clientes captados en tres años quedan vivos ' + num(demanda.vivos[2])
        + ' al cierre del año 3: una retención del ' + pct(demanda.retencion, 0)
        + '. Entre el 40% y el 60% del churn ocurre antes del tercer mes, así que esa cifra se gana en el onboarding, no en la venta.',
        tabla(cols, demanda.cohortes, { key: (c) => c.anio, pie: pie })));
  }

  function vistaClientes() {
    const perfiles = DATA.icp.map((p, i) => h('article', { className: 'km-appcard', key: i },
      h('div', { className: 'km-app-top' },
        h('div', null,
          h('div', { className: 'km-app-nm' }, p.perfil),
          h('div', { className: 'km-app-cat' }, p.rol + ' · ' + p.tamano))),
      h('div', { className: 'km-prow' }, h('div', null, 'Producto ', h('b', null, p.producto))),
      h('div', { className: 'km-pc km-con' }, h('b', null, 'Dolor'), p.dolor),
      h('div', { className: 'km-pc km-pro' }, h('b', null, 'Gatillo de compra'), p.gatillo),
      h('div', { className: 'km-strat', style: { fontStyle: 'italic' } }, '“' + p.objecion + '”'),
      h('div', { className: 'km-strat' }, h('b', null, 'Cómo se le vende: '), p.venta)));

    const colsSeg = [
      { k: 'seg', l: 'Segmento', cell: (s) => h('b', null, s.segmento) },
      { k: 'emp', l: 'Empleados', cell: (s) => h('span', { className: 'km-mut' }, s.empleados) },
      { k: 'ver', l: 'Veredicto', cell: (s) => pill(s.veredicto, s.veredicto.indexOf('Objetivo') === 0 ? 'km-p-g' : s.veredicto === 'No perseguir' ? 'km-p-r' : 'km-p-o') },
      { k: 'plan', l: 'Plan sugerido', cell: (s) => h('span', { className: 'km-mut' }, s.plan) },
      { k: 'por', l: 'Por qué', cell: (s) => h('span', { className: 'km-mut' }, s.porque) },
      { k: 'rie', l: 'Riesgo', cell: (s) => h('span', { className: 'km-mut' }, s.riesgo) },
    ];

    const evidencia = DATA.evidencia.map((g) => {
      const cols = g.cols.map((c, j) => ({
        k: 'c' + j, l: c, num: j > 0 && j < g.cols.length - 1 && g.cols.length > 4,
        cell: (f) => (j === g.cols.length - 1 ? pillConf(f[j]) : h('span', { className: j === 0 ? null : 'km-mut' }, f[j])),
      }));
      return card(g.titulo, C.blue, null, tabla(cols, g.filas, { key: (f, i) => i }), { key: g.titulo });
    });

    return h('div', { className: 'km-wrap km-fade' },
      card('Perfiles de cliente ideal', C.violet,
        'Seis perfiles con el dolor que los mueve, el gatillo que dispara la compra y la objeción que hay que responder.',
        h('div', { className: 'km-g3' }, perfiles)),
      card('Segmentación por tamaño', C.orange, null, tabla(colsSeg, DATA.segmentos, { key: (s, i) => i })),
      evidencia);
  }

  function vistaProsContras(oferta) {
    const tarjetas = oferta.modulos.map((m, i) => h('article', { className: 'km-appcard', key: m.n },
      h('div', { className: 'km-app-top' },
        icono(m, i),
        h('div', null,
          h('div', { className: 'km-app-nm' }, m.app),
          h('div', { className: 'km-app-cat' }, m.cat))),
      h('div', { className: 'km-app-cat', style: { marginBottom: '4px' } }, 'Compite con: ' + m.alt),
      h('div', { className: 'km-pc km-pro' }, h('b', null, 'A favor'), m.pro),
      h('div', { className: 'km-pc km-con' }, h('b', null, 'En contra'), m.contra),
      h('div', { className: 'km-prow' },
        h('div', null, 'Mercado ', h('b', null, usd(m.min) + '–' + usd(m.max))),
        h('div', null, 'Sugerido ', h('b', null, usd(m.sugerido))),
        h('div', null, 'Cuadrante ', h('b', null, m.cuadrante))),
      h('div', { className: 'km-strat' }, h('b', null, 'Estrategia: '), m.estrategia)));

    return h('div', { className: 'km-wrap km-fade' },
      nota(VIS.notas.proscontras),
      h('div', { className: 'km-g3' }, tarjetas));
  }

  function vistaDiagnostico(oferta) {
    const vals = valsTexto(oferta);
    const scores = VIS.scores.map((s) => h('div', { key: s.dim },
      h('div', { className: 'km-score' },
        h('span', { className: 'km-score-lb' }, s.dim),
        h('span', { className: 'km-bar' }, h('i', { style: { width: (s.nota * 10) + '%' } })),
        h('span', { className: 'km-score-sc' }, s.nota + '/10')),
      h('div', { className: 'km-score-tx' }, s.texto)));

    // Matriz de cartera: lo que paga el mercado contra la ventaja de KIMOS.
    const W = 720, H = 400, P = 46;
    const maxMed = Math.max.apply(null, oferta.modulos.map((m) => m.med).concat([1]));
    const xs = (v) => P + (v / 10) * (W - P * 2);
    const ys = (v) => H - P - Math.sqrt(v / maxMed) * (H - P * 2);
    const puntos = oferta.modulos.map((m) => {
      const r = Math.max(5, Math.sqrt(m.sugerido) * 0.85);
      return h('g', { key: m.n, className: 'km-pt' },
        h('circle', {
          cx: xs(m.ventaja), cy: ys(m.med), r: r,
          fill: m.cuadrante === 'APOSTAR' ? C.green : m.cuadrante === 'REPLANTEAR' ? C.red
            : m.cuadrante === 'MONETIZAR CON CUIDADO' ? C.orange : C.cyan,
        }, h('title', null, m.app + ' — mercado ' + usd(m.med) + '/mes · KIMOS ' + usd(m.sugerido)
          + '/mes · ventaja ' + m.ventaja + '/10 · ' + m.cuadrante)),
        h('text', { x: xs(m.ventaja), y: ys(m.med) - r - 4, textAnchor: 'middle' }, corto(m.app)));
    });
    const matriz = h('div', { className: 'km-chart-wrap' },
      h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '620px' } },
        h('rect', { x: xs(5.5), y: 12, width: W - P - xs(5.5), height: ys(oferta.medianaCartera) - 12, fill: C.green, opacity: .07 }),
        h('rect', { x: P, y: 12, width: xs(5.5) - P, height: ys(oferta.medianaCartera) - 12, fill: C.orange, opacity: .07 }),
        h('rect', { x: xs(5.5), y: ys(oferta.medianaCartera), width: W - P - xs(5.5), height: H - P - ys(oferta.medianaCartera), fill: C.cyan, opacity: .07 }),
        h('text', { x: W - P - 6, y: 26, textAnchor: 'end' }, 'APOSTAR'),
        h('text', { x: P + 6, y: 26 }, 'MONETIZAR CON CUIDADO'),
        h('text', { x: W - P - 6, y: H - P - 8, textAnchor: 'end' }, 'DIFERENCIAR, NO FACTURAR'),
        h('text', { x: P + 6, y: H - P - 8 }, 'REPLANTEAR'),
        h('line', { x1: P, y1: H - P, x2: W - P, y2: H - P, className: 'km-ax' }),
        h('line', { x1: P, y1: 12, x2: P, y2: H - P, className: 'km-ax' }),
        puntos,
        h('text', { x: W / 2, y: H - 12, textAnchor: 'middle' }, 'Ventaja de KIMOS →'),
        h('text', { x: 14, y: H / 2, textAnchor: 'middle', transform: 'rotate(-90 14 ' + H / 2 + ')' }, 'Lo que paga el mercado →')));

    const decisiones = DATA.decisiones.map((d) => h('div', {
      className: 'km-diag', key: d.n, style: { '--k-g': d.impacto === 'alto' ? C.fuchsia : C.blue },
    },
      h('h4', null, d.n + '. ' + d.decision),
      h('p', null, h('b', null, 'Oferta. '), d.oferta),
      h('p', null, h('b', null, 'Demanda. '), d.demanda),
      h('p', { style: { color: 'var(--k-tx)' } }, h('b', null, 'Qué hacer. '), d.hacer)));

    return h('div', { className: 'km-wrap km-fade' },
      h('div', { className: 'km-g2' },
        card('Dónde está parado KIMOS', C.green,
          'Evaluación por dimensión, de 0 a 10, según la posición competitiva que muestra este estudio.',
          h('div', null, scores)),
        card('Qué hacer con esto', C.fuchsia,
          'Ocho movimientos concretos que salen de cruzar los precios de la competencia con la demanda.',
          h('div', { className: 'km-col' }, VIS.sugerencias.map((s) => tarjetaDiag(s, vals))))),
      card('Las ocho decisiones del estudio', C.violet,
        'Cada una con el dato de oferta y el de demanda que la sostienen. Si un dato cambia, la decisión se revisa.',
        h('div', { className: 'km-g2' }, decisiones)),
      card('Matriz de cartera', C.cyan,
        'Horizontal: la ventaja de KIMOS (0 a 10). Vertical: lo que paga el mercado, en escala de raíz. El corte vertical está en 5,5 y el horizontal en la mediana de la cartera (' + usd(oferta.medianaCartera) + ').',
        matriz),
      card('Conclusión', C.orange, null,
        h('div', { className: 'km-col' }, VIS.conclusiones.map((c) => tarjetaDiag(c, vals)))),
      card('Advertencias metodológicas', C.amber,
        'Lo que este estudio no prueba. Leerlo antes de anclar un precio.',
        h('ol', { className: 'km-hint', style: { paddingLeft: '18px', lineHeight: 1.9 } },
          DATA.notas.map((n, i) => h('li', { key: i }, n.replace(/^\d+\.\s*/, ''))))));
  }

  /* -------------------------------- render ------------------------------- */

  function Component() {
    const [st, setSt] = React.useState(estado);
    React.useEffect(() => {
      oyentes.add(setSt);
      return () => { oyentes.delete(setSt); };
    }, []);

    const oferta = React.useMemo(() => calcularOferta(st.sup, st.desc, st.precios), [st.sup, st.desc, st.precios]);
    const demanda = React.useMemo(() => calcularDemanda(st.sup, st.alcance, oferta, st.mix), [st.sup, st.alcance, st.mix, oferta]);

    const ent = oferta.planes[oferta.planes.length - 1];
    const banda = oferta.ratioStack > 0.60 ? C.red : oferta.ratioStack < 0.25 ? C.amber : C.green;
    const alcanceTxt = st.alcance.pais || st.alcance.region || st.alcance.idioma || st.alcance.prioridad || 'Alcance global';

    const cuerpo = st.tab === 'mapa' ? vistaMapa(oferta)
      : st.tab === 'competencia' ? vistaCompetencia(oferta)
      : st.tab === 'planes' ? vistaPlanes(oferta)
      : st.tab === 'configurador' ? vistaConfigurador(oferta)
      : st.tab === 'mercados' ? vistaMercados(oferta, demanda)
      : st.tab === 'economia' ? vistaEconomia(oferta, demanda)
      : st.tab === 'clientes' ? vistaClientes()
      : st.tab === 'proscontras' ? vistaProsContras(oferta)
      : st.tab === 'diagnostico' ? vistaDiagnostico(oferta)
      : vistaResumen(oferta, demanda);

    return h('div', { className: 'kimos-mercado' + (st.tema === 'host' ? ' km-host' : '') },
      h('header', { className: 'km-head' },
        h('div', { className: 'km-brand' },
          h('div', { className: 'km-logo' }, h('span', null, 'K')),
          h('div', null,
            h('div', { className: 'km-tit' }, 'Estudio de Mercado y Modelo de Precios',
              h('span', { className: 'km-ver', title: 'Estudio de Mercado v' + APP_VERSION }, 'v' + APP_VERSION)),
            h('div', { className: 'km-sub' }, DATA.modulos.length + ' aplicaciones · ' + DATA.competidores.length
              + ' planes de competencia analizados · precios de lista ' + DATA.meta.moneda + ' · agosto 2026'))),
        h('span', { className: 'km-chip-alc' }, alcanceTxt),
        h('div', { className: 'km-tools' },
          h('button', {
            className: 'km-btn', title: 'Vuelve a los supuestos, precios y descuentos del estudio',
            onClick: () => commit({
              sup: Object.assign({}, SUP_BASE), desc: Object.assign({}, DESC_BASE),
              mix: Object.assign({}, MIX_BASE), precios: {}, cfg: { mods: [], desc: 0.5 },
            }),
          }, '↺ Restablecer'),
          h('button', { className: 'km-btn', onClick: () => exportar(oferta, demanda), title: 'Exporta a CSV la pestaña actual' }, '⭳ Exportar datos'),
          h('button', {
            className: 'km-btn' + (st.tema === 'host' ? ' on' : ''),
            title: 'Alterna entre el tema del estudio y el tema del escritorio de KIMOS',
            onClick: () => commit({ tema: st.tema === 'host' ? 'estudio' : 'host' }),
          }, st.tema === 'host' ? '◐ Tema KIMOS' : '◑ Tema estudio'))),
      h('nav', { className: 'km-tabs' }, TABS.map(([id, label, ico]) => h('button', {
        key: id, className: 'km-tab' + (st.tab === id ? ' on' : ''),
        onClick: () => commit({ tab: id }),
      }, h('span', { className: 'km-tab-i' }, ico), label))),
      h('div', { className: 'km-body' },
        h('div', { className: 'km-wrap', style: { marginBottom: '16px' } },
          h('div', { className: 'km-kpis' },
            kpi('Gasto actual del cliente', usd(oferta.stackTotal), usd1(oferta.stackPorUsuario) + ' por usuario/mes', C.orange),
            kpi('KIMOS Enterprise', usd(ent.mensual), usd1(ent.porUsuario) + ' por usuario/mes', C.cyan),
            kpi('KIMOS vs. gasto actual', pct(oferta.ratioStack, 0),
              oferta.ratioStack > 0.6 ? 'Sobre la banda sana' : oferta.ratioStack < 0.25 ? 'Bajo la banda sana' : 'Dentro de la banda sana', banda),
            kpi('Ahorro anual del cliente', usd(oferta.ahorroAnualStack), 'Argumento central de venta', C.green),
            kpi('Precios verificados', oferta.verificados + '/' + DATA.competidores.length, 'El resto requiere validación', C.violet))),
        cuerpo));
  }

  /* -------------------------------- agente -------------------------------- */

  let desregistrar = null;
  const CLAVES_SUP = Object.keys(SUP_BASE);

  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    desregistrar = shell.agent.register({
      label: 'Estudio de Mercado',
      description: 'Estudio competitivo y de precios de KIMOS: precio sugerido por módulo contra la competencia, planes y kits, configurador de suscripción, mercado por país y economía por cliente. El agente puede mover los supuestos, editar precios de la competencia, armar una cotización y leer todo lo que se recalcula.',
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
            properties: { plan: { type: 'string', enum: Object.keys(DESC_BASE) }, descuento: { type: 'number' } },
            required: ['plan', 'descuento'],
          },
        },
        {
          name: 'SET_PRECIO_COMPETIDOR',
          description: 'Corrige el precio de lista de un plan de la competencia (USD/mes) y recalcula mediana, precio sugerido, planes y cotización.',
          inputSchema: {
            type: 'object',
            properties: {
              competidor: { type: 'string' }, plan: { type: 'string' }, precio: { type: 'number' },
            },
            required: ['competidor', 'plan', 'precio'],
          },
        },
        {
          name: 'COTIZAR',
          description: 'Arma una cotización en el configurador con los módulos indicados (nombres exactos de las apps de KIMOS) y un descuento opcional.',
          inputSchema: {
            type: 'object',
            properties: {
              modulos: { type: 'array', items: { type: 'string' } },
              descuento: { type: 'number' },
            },
            required: ['modulos'],
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
          description: 'Vuelve a los supuestos, descuentos, precios y cotización con los que se levantó el estudio.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      getSnapshot: () => {
        // Se recalcula al vuelo desde el estado actual: si dependiera del
        // último render, el agente leería cifras viejas tras cambiar supuestos.
        const of = calcularOferta(estado.sup, estado.desc, estado.precios);
        const dem = calcularDemanda(estado.sup, estado.alcance, of, estado.mix);
        const selCfg = estado.cfg.mods.filter((a) => of.byApp.has(a));
        const sumaCfg = selCfg.reduce((a, app) => a + of.byApp.get(app).sugerido, 0);
        return {
          version: APP_VERSION,
          levantamiento: DATA.meta.fecha,
          pestana: estado.tab,
          supuestos: estado.sup,
          alcance: estado.alcance,
          mixPlanes: estado.mix,
          preciosEditados: Object.keys(estado.precios).length,
          cotizacion: {
            modulos: selCfg, descuento: estado.cfg.desc,
            sumaALaCarta: sumaCfg, mensual: Math.round(sumaCfg * (1 - estado.cfg.desc)),
          },
          oferta: {
            suiteALaCarta: of.aLaCarta,
            medianaMercado: Math.round(of.medianaTotal),
            stackActualCliente: Math.round(of.stackTotal),
            kimosSobreStack: Math.round(of.ratioStack * 100) / 100,
            ahorroAnualCliente: Math.round(of.ahorroAnualStack),
            preciosVerificados: of.verificados + '/' + DATA.competidores.length,
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
          diagnostico: VIS.scores.map((s) => ({ dimension: s.dim, nota: s.nota })),
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
          if (t === 'SET_PRECIO_COMPETIDOR') {
            const v = Number(p.precio);
            if (!isFinite(v) || v < 0) return { success: false, error: 'Precio inválido' };
            const i = DATA.competidores.findIndex((c) => c.comp === p.competidor && c.plan === p.plan);
            if (i < 0) return { success: false, error: 'No existe el plan ' + p.plan + ' de ' + p.competidor };
            setPrecio(i, v);
            return { success: true, message: p.competidor + ' ' + p.plan + ' = ' + usd1(v) + '/mes' };
          }
          if (t === 'COTIZAR') {
            const validos = (Array.isArray(p.modulos) ? p.modulos : []).filter((a) => DATA.modulos.some((m) => m.app === a));
            if (!validos.length) return { success: false, error: 'Ningún módulo válido. Usa los nombres exactos de las apps.' };
            const d = Number(p.descuento);
            const cfg = { mods: validos, desc: isFinite(d) && d >= 0 && d <= 0.95 ? d : estado.cfg.desc };
            commit({ tab: 'configurador', cfg: cfg });
            const of = calcularOferta(estado.sup, estado.desc, estado.precios);
            const suma = validos.reduce((a, app) => a + of.byApp.get(app).sugerido, 0);
            return { success: true, message: validos.length + ' módulos · ' + usd(Math.round(suma * (1 - cfg.desc))) + '/mes' };
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
            const n = paisesEnAlcance(a).length;
            if (!n) return { success: false, error: 'Ese alcance no deja ningún mercado dentro' };
            commit({ alcance: a });
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
            commit({ tab: 'mapa', modSel: m.n });
            return { success: true, message: 'Detalle de ' + m.app };
          }
          if (t === 'RESTAURAR_SUPUESTOS') {
            commit({
              sup: Object.assign({}, SUP_BASE), desc: Object.assign({}, DESC_BASE),
              mix: Object.assign({}, MIX_BASE), precios: {}, cfg: { mods: [], desc: 0.5 },
            });
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
