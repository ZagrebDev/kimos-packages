/**
 * Marcas v1.0.0 — app oficial de KIMOS.
 *
 * ARCHIVO GENERADO por tools/build.mjs a partir de src/. No editar a mano:
 * los cambios van en src/*.js y se recompila con `node tools/build.mjs`.
 *
 * Contrato AppShell v1 (kimos-packages/APP-SPEC.md):
 *   - ESM único que exporta `default mount(shell) -> { Component, unmount }`.
 *   - Usa `globalThis.React` (nunca empaqueta su propia copia).
 *   - Sin JSX: todo con `React.createElement`.
 *   - Estado dentro del closure de mount(): una instancia = un cotizador.
 *   - Nunca `innerHTML`/`dangerouslySetInnerHTML`: el texto que escribe el
 *     usuario (o que llega del catálogo de otra app) se pinta siempre como
 *     elementos React, también en la ventana de impresión.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef, useCallback, Fragment } = React;

  // Versión visible en pantalla: al probar, confirma qué build tomó el host.
  // La inyecta tools/build.mjs desde manifest.json (APP-SPEC §7.a).
  const APP_VERSION = '1.0.0';

// ══════════════════════════════════════════════════════════════════════
// src/00-core.js
// ══════════════════════════════════════════════════════════════════════
/* ══ NÚCLEO ═══════════════════════════════════════════════════════════════
 *
 * El modelo de una marca y las funciones puras que operan sobre él: color a
 * token, contraste, búsqueda por rol. Sin React y sin red, para que se pueda
 * probar entero.
 *
 * ── Por qué esta app no guarda nada ──────────────────────────────────────
 *
 * Las marcas NO viven aquí: viven en el registro de la plataforma
 * (`shell.brands`, APP-SPEC §7.f). Esta app es un editor y un visor, no la
 * dueña de los datos. Eso es deliberado y es lo que resuelve la tensión de
 * fondo: no todo tenant quiere administrar marcas, pero cualquier app tiene
 * que poder USARLAS. Si las marcas vivieran en los items de esta app,
 * Cotizaciones no podría emitir con la marca correcta sin que alguien
 * instalara este editor.
 *
 * Por eso el manifest declara `multiInstance: false` y la app no usa
 * `saveData` ni `shell.items`: no tiene estado propio que guardar.
 *
 * ── Por qué el modelo es el que es ───────────────────────────────────────
 *
 * Una marca no son dos colores y un logo. Para que otra app pueda PRODUCIR
 * algo con ella sin adivinar hace falta:
 *
 *   · que cada color diga qué ROL cumple (cuál es el fondo, cuál el acento);
 *   · que cada logo diga sobre qué FONDO va;
 *   · que cada tipografía diga para qué se USA.
 *
 * El mismo modelo que valida el backend (`brands_core.py`). Aquí se repite
 * porque la app tiene que poder validar antes de mandar y explicar el error
 * donde está el campo, no en un toast.
 */

// ── Vocabulario compartido con la plataforma ────────────────────────────
// Si esto se desalinea con `brands_core.py`, el backend rechaza lo que la
// app deja escribir y el error aparece lejos de su causa.

const COLOR_ROLES = [
  ['base', 'Principal', 'El color que identifica a la marca'],
  ['baseAlt', 'Principal alt.', 'Otra línea o ecosistema de la misma marca'],
  ['accent', 'Acento', 'Llamadas a la acción y destacados'],
  ['text', 'Texto', 'Texto principal'],
  ['textMuted', 'Texto sec.', 'Texto secundario'],
  ['border', 'Borde', 'Bordes y separadores'],
  ['surface', 'Superficie', 'Fondo de tarjetas'],
  ['background', 'Fondo', 'Fondo de página'],
  ['none', 'Sin rol', 'Decorativo: ninguna app sabrá dónde usarlo'],
];

const LOGO_BACKGROUNDS = [
  ['dark', 'Fondo oscuro'],
  ['light', 'Fondo claro'],
  ['color', 'Fondo de color'],
  ['transparent', 'Cualquiera'],
];

const TYPE_USAGES = [
  ['headings', 'Titulares'],
  ['body', 'Texto'],
  ['data', 'Datos y códigos'],
  ['accent', 'Destacados'],
];

/** Las secciones de la hoja, en el orden en que se leen. */
const SECCIONES = [
  ['logos', 'Logotipo'],
  ['palette', 'Paleta'],
  ['typography', 'Tipografía'],
  ['ecosystems', 'Elementos visuales'],
  ['principles', 'Principios y reglas'],
];

const labelDe = (tabla, clave, sino) => {
  const f = tabla.find((x) => x[0] === clave);
  return f ? f[1] : (sino === undefined ? clave : sino);
};

// ── Utilidades ──────────────────────────────────────────────────────────

const s = (v) => (v == null ? '' : String(v));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const slug = (v, sino) => {
  const raw = s(v).trim().toLowerCase().normalize('NFD')
    // Escapes y no el carácter literal: copiar un rango de diacríticos entre
    // archivos lo destroza sin que se note hasta que un nombre con tilde
    // genera una clave distinta.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (raw || s(sino)).slice(0, 40);
};

const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Color ───────────────────────────────────────────────────────────────

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** `#0E5` → `#00ee55`. Cadena vacía si no es un hex válido: aquí NO se lanza,
 *  porque el campo se valida mientras se escribe y a media palabra casi nunca
 *  lo es. Quien decide si eso es un error es el formulario. */
function normalizeHex(v) {
  const raw = s(v).trim();
  const m = HEX_RE.exec(raw);
  if (!m) return '';
  const d = m[1].toLowerCase();
  return '#' + (d.length === 3 ? d.split('').map((c) => c + c).join('') : d);
}

const esHexValido = (v) => !!normalizeHex(v);

/** `#1d1d1b` → `29·29·27`, como se imprime en la hoja. */
function hexToRgb(v) {
  const h = normalizeHex(v);
  if (!h) return '';
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join('·');
}

/**
 * `#00e5d0` → `"174 100% 45%"`. Tripleta sin `hsl()`, que es como guarda los
 * tokens el tema de KIMOS: así una app puede escribir `hsl(var(--x) / .5)` y
 * modular la opacidad.
 */
function hexToHslToken(v) {
  const hex = normalizeHex(v);
  if (!hex) return '';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let sat = 0;
  if (mx !== mn) {
    const d = mx - mn;
    sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return Math.round(h) + ' ' + Math.round(sat * 100) + '% ' + Math.round(l * 100) + '%';
}

/** Luminancia relativa (WCAG). */
function luminancia(v) {
  const hex = normalizeHex(v);
  if (!hex) return 0;
  const c = [1, 3, 5].map((i) => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Razón de contraste entre dos colores (1 a 21). */
function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * El color de texto que se lee ENCIMA de ese fondo: `#fff` o casi negro.
 *
 * Se decide por luminancia y no a ojo porque el error típico es justo el que
 * el ojo no ve venir: un amarillo de marca es clarísimo aunque el hex parezca
 * saturado, y el texto blanco encima queda ilegible.
 */
function textoLegible(v) {
  return contraste(v, '#ffffff') >= contraste(v, '#111111') ? '#ffffff' : '#111111';
}

// ── Normalizadores ──────────────────────────────────────────────────────

function normalizeColor(raw, i) {
  const r = isObj(raw) ? raw : {};
  const hex = normalizeHex(r.hex) || '#cccccc';
  const role = COLOR_ROLES.some((x) => x[0] === r.role) ? s(r.role) : 'none';
  const name = s(r.name).trim() || ('Color ' + ((i || 0) + 1));
  return {
    key: slug(r.key || name, 'color-' + ((i || 0) + 1)),
    name,
    hex,
    rgb: hexToRgb(hex),
    role,
    roleLabel: labelDe(COLOR_ROLES, role),
    token: hexToHslToken(hex),
    foreground: textoLegible(hex),
  };
}

function normalizeLogo(raw, i) {
  const r = isObj(raw) ? raw : {};
  const bg = LOGO_BACKGROUNDS.some((x) => x[0] === r.background) ? s(r.background) : 'transparent';
  const name = s(r.name).trim() || ('Logo ' + ((i || 0) + 1));
  return {
    key: slug(r.key || name, 'logo-' + ((i || 0) + 1)),
    name,
    url: s(r.url).trim(),
    background: bg,
    backgroundLabel: labelDe(LOGO_BACKGROUNDS, bg),
    minWidth: s(r.minWidth).trim(),
    clearSpace: s(r.clearSpace).trim(),
  };
}

function normalizeFont(raw, i) {
  const r = isObj(raw) ? raw : {};
  const usage = TYPE_USAGES.some((x) => x[0] === r.usage) ? s(r.usage) : 'body';
  const family = s(r.family).trim() || 'Inter';
  return {
    key: slug(r.key || family + '-' + usage, 'tipo-' + ((i || 0) + 1)),
    family,
    usage,
    usageLabel: labelDe(TYPE_USAGES, usage),
    weights: arr(r.weights).map((w) => s(w).trim()).filter(Boolean).slice(0, 8),
    sample: s(r.sample).trim(),
    source: s(r.source).trim(),
  };
}

function normalizeEcosystem(raw, i) {
  const r = isObj(raw) ? raw : {};
  const name = s(r.name).trim() || ('Ecosistema ' + ((i || 0) + 1));
  return {
    key: slug(r.key || name, 'eco-' + ((i || 0) + 1)),
    name,
    note: s(r.note).trim(),
    baseColorKey: s(r.baseColorKey).trim(),
    accentColorKey: s(r.accentColorKey).trim(),
  };
}

function normalizePrincipio(raw, i) {
  const r = isObj(raw) ? raw : {};
  return {
    title: s(r.title).trim() || ('Principio ' + ((i || 0) + 1)),
    text: s(r.text).trim(),
  };
}

/** Claves únicas: son las que usan los ecosistemas para apuntar a un color. */
function clavesUnicas(lista) {
  const vistas = new Set();
  return lista.map((it) => {
    let clave = it.key;
    let n = 2;
    while (vistas.has(clave)) clave = it.key + '-' + (n++);
    vistas.add(clave);
    return Object.assign({}, it, { key: clave });
  });
}

function normalizeBrand(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    id: s(r.id),
    isDefault: !!r.isDefault,
    name: s(r.name).trim(),
    tagline: s(r.tagline).trim(),
    description: s(r.description).trim(),
    legalName: s(r.legalName).trim(),
    taxId: s(r.taxId).trim(),
    address: s(r.address).trim(),
    email: s(r.email).trim(),
    phone: s(r.phone).trim(),
    website: s(r.website).trim(),
    footer: s(r.footer).trim(),
    bankDetails: s(r.bankDetails).trim(),
    palette: clavesUnicas(arr(r.palette).map(normalizeColor)),
    logos: clavesUnicas(arr(r.logos).map(normalizeLogo)),
    typography: clavesUnicas(arr(r.typography).map(normalizeFont)),
    ecosystems: clavesUnicas(arr(r.ecosystems).map(normalizeEcosystem)),
    principles: arr(r.principles).map(normalizePrincipio),
    updatedAt: s(r.updatedAt),
  };
}

/** Lo que se manda al registro: solo lo que el backend acepta escribir. */
function paraGuardar(brand) {
  const b = normalizeBrand(brand);
  return {
    name: b.name, tagline: b.tagline, description: b.description,
    legalName: b.legalName, taxId: b.taxId, address: b.address,
    email: b.email, phone: b.phone, website: b.website,
    footer: b.footer, bankDetails: b.bankDetails,
    palette: b.palette.map((c) => ({ key: c.key, name: c.name, hex: c.hex, role: c.role })),
    logos: b.logos.map((l) => ({
      key: l.key, name: l.name, url: l.url, background: l.background,
      minWidth: l.minWidth, clearSpace: l.clearSpace,
    })),
    typography: b.typography.map((t) => ({
      key: t.key, family: t.family, usage: t.usage,
      weights: t.weights, sample: t.sample, source: t.source,
    })),
    ecosystems: b.ecosystems.map((e) => ({
      key: e.key, name: e.name, note: e.note,
      baseColorKey: e.baseColorKey, accentColorKey: e.accentColorKey,
    })),
    principles: b.principles.map((p) => ({ title: p.title, text: p.text })),
  };
}

// ── Consultas ───────────────────────────────────────────────────────────

/** El primer color con ese rol, o `null`. Es como una app pide «el acento»
 *  sin saber en qué posición de la paleta quedó. */
function colorPorRol(brand, role) {
  return arr((brand || {}).palette).find((c) => c.role === role) || null;
}

const colorPorClave = (brand, key) => arr((brand || {}).palette).find((c) => c.key === s(key)) || null;

/** El logo para ese fondo; si no hay, el adaptable; si tampoco, el primero.
 *  Antes eso que devolver nada y dejar un hueco en la propuesta de alguien. */
function logoParaFondo(brand, background) {
  const logos = arr((brand || {}).logos).filter((l) => l.url);
  return logos.find((l) => l.background === background)
    || logos.find((l) => l.background === 'transparent')
    || logos[0] || null;
}

/**
 * Lo que le falta a la marca para poder aplicarse, y lo que está mal.
 *
 * Son avisos, no errores: una marca a medio construir es un estado legítimo
 * mientras se trabaja en ella. Pero conviene VERLO, porque una marca sin
 * color base no re-marca nada y nadie sabrá por qué.
 */
function avisosDe(brand) {
  const b = normalizeBrand(brand);
  const out = [];
  if (!b.name) out.push('La marca no tiene nombre.');
  if (!b.palette.length) out.push('No tiene paleta: ninguna app podrá pintar con ella.');
  else if (!colorPorRol(b, 'base')) {
    out.push('Ningún color tiene el rol «Principal», así que las apps no sabrán cuál usar como base.');
  }
  if (!b.logos.filter((l) => l.url).length) out.push('No tiene ningún logotipo.');

  const claves = new Set(b.palette.map((c) => c.key));
  for (const e of b.ecosystems) {
    for (const campo of ['baseColorKey', 'accentColorKey']) {
      const ref = e[campo];
      if (ref && !claves.has(ref)) {
        out.push('El ecosistema «' + e.name + '» apunta a un color «' + ref + '» que ya no está en la paleta.');
      }
    }
  }

  // Contraste: el aviso que evita el error que el ojo no ve venir.
  const base = colorPorRol(b, 'base');
  const acento = colorPorRol(b, 'accent');
  if (base && acento) {
    const c = contraste(base.hex, acento.hex);
    if (c < 3) {
      out.push('El acento y el principal apenas se distinguen (contraste ' + c + ':1). '
        + 'Un botón de acento sobre el fondo base va a desaparecer.');
    }
  }
  return out;
}

/** Resumen de una marca para la cartera y para el agente. */
function resumenDe(brand) {
  const b = normalizeBrand(brand);
  return {
    id: b.id,
    nombre: b.name,
    activa: b.isDefault,
    colores: b.palette.length,
    logos: b.logos.filter((l) => l.url).length,
    tipografias: b.typography.length,
    ecosistemas: b.ecosystems.length,
    principios: b.principles.length,
    avisos: avisosDe(b).length,
  };
}

// ══════════════════════════════════════════════════════════════════════
// src/10-store.js
// ══════════════════════════════════════════════════════════════════════
/* ══ ESTADO Y RED ═════════════════════════════════════════════════════════
 *
 * El estado de la app es un espejo del registro de la plataforma más lo que
 * se está editando. No hay persistencia propia: `shell.brands` es la fuente.
 *
 * Por qué hay un borrador (`draft`) en vez de escribir en cada tecla: editar
 * una marca cambia cómo se ven las propuestas de TODAS las apps. Guardar a
 * cada pulsación convertiría un tanteo de color en un cambio en producción.
 * Se guarda cuando la persona lo pide, y mientras tanto se ve el resultado.
 */

const model = {
  loading: true,
  error: '',
  /** Solo lectura: sin `brand.write` la app se ve pero no se edita. */
  readonly: false,
  brands: [],
  currentId: '',
  selectedId: '',
  /** La marca en edición. `null` = no hay nada abierto. */
  draft: null,
  dirty: false,
  saving: false,
  tab: 'sistema',        // 'sistema' (la hoja) | 'editor'
  seccion: 'logos',      // sección abierta del editor
  hojaSecciones: SECCIONES.map((x) => x[0]),
};

let estado = model;
const listeners = new Set();
const emit = () => listeners.forEach((l) => { try { l(Object.assign({}, estado)); } catch (e) { /* un oyente roto no rompe al resto */ } });

const getModel = () => estado;
const setModel = (patch) => { estado = Object.assign({}, estado, patch); emit(); };
const suscribir = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const marcaPorId = (id) => arr(estado.brands).find((b) => b.id === s(id)) || null;
const seleccionada = () => estado.draft || marcaPorId(estado.selectedId);

/** '' si se puede usar el registro; si no, el motivo, para poder explicarlo. */
function registroNoDisponible() {
  if (!shell.brands || typeof shell.brands.list !== 'function') {
    return 'Este host todavía no expone el registro de marcas. Actualiza KIMOS para usar esta app.';
  }
  return '';
}

const puedeEditar = () => !!(shell.brands && typeof shell.brands.update === 'function') && !estado.readonly;

/**
 * Lee el registro. `mantener` conserva la selección tras guardar, para que la
 * pantalla no salte al principio cada vez que se pulsa Guardar.
 */
async function cargar(mantener) {
  const motivo = registroNoDisponible();
  if (motivo) { setModel({ loading: false, error: motivo }); return []; }

  setModel({ loading: true, error: '' });
  try {
    const data = await shell.brands.list();
    const brands = arr(data.brands).map(normalizeBrand);
    const antes = mantener ? s(estado.selectedId) : '';
    const sigue = brands.find((b) => b.id === antes);
    const elegida = sigue || brands.find((b) => b.id === s(data.currentId)) || brands[0] || null;
    setModel({
      loading: false,
      error: '',
      readonly: !(shell.brands && typeof shell.brands.update === 'function'),
      brands,
      currentId: s(data.currentId),
      selectedId: elegida ? elegida.id : '',
      draft: null,
      dirty: false,
    });
    return brands;
  } catch (e) {
    setModel({
      loading: false,
      error: (e && e.message) || 'No se pudo leer el registro de marcas.',
    });
    return [];
  }
}

/** Abre una marca para editarla: el borrador es una copia, no la del listado. */
function abrirBorrador(id) {
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return null;
  const copia = normalizeBrand(JSON.parse(JSON.stringify(b)));
  setModel({ selectedId: b.id, draft: copia, dirty: false });
  return copia;
}

/** Cambia el borrador. Si no había, lo abre: editar es un gesto, no dos. */
function editarBorrador(mutar) {
  const base = estado.draft || (() => {
    const b = marcaPorId(estado.selectedId);
    return b ? normalizeBrand(JSON.parse(JSON.stringify(b))) : null;
  })();
  if (!base) return null;
  const next = normalizeBrand(mutar(base) || base);
  setModel({ draft: next, dirty: true });
  return next;
}

function teardown() {
  listeners.clear();
  if (typeof desregistrarAgente === 'function') desregistrarAgente();
}

// ══════════════════════════════════════════════════════════════════════
// src/20-ui.js
// ══════════════════════════════════════════════════════════════════════
/* ══ COMPONENTES BASE ═════════════════════════════════════════════════════
 *
 * Todo con `React.createElement` (sin JSX, APP-SPEC §3) y todo el color desde
 * los tokens del tema del host (§9): esta app no puede cablear un solo color,
 * porque es justo la que enseña a no hacerlo.
 */

const cx = (...xs) => xs.filter(Boolean).join(' ');

function Btn(props) {
  const p = props || {};
  const { variant, size, active, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button',
    className: cx('mk-btn', variant && 'mk-btn-' + variant, size === 'sm' && 'mk-btn-sm',
      active && 'on', className),
  }, rest), children);
}

function IconBtn(props) {
  const p = props || {};
  const { icon, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button', className: cx('mk-ico', className),
  }, rest), icon || children);
}

function Input(props) {
  const p = props || {};
  const { className, mono, invalid, ...rest } = p;
  return h('input', Object.assign({
    className: cx('mk-in', mono && 'mk-mono', invalid && 'mk-in-bad', className),
  }, rest));
}

function Area(props) {
  const p = props || {};
  const { className, rows, ...rest } = p;
  return h('textarea', Object.assign({
    className: cx('mk-in mk-area', className), rows: rows || 3,
  }, rest));
}

function Select(props) {
  const p = props || {};
  const { options, className, ...rest } = p;
  return h('select', Object.assign({ className: cx('mk-in mk-sel', className) }, rest),
    arr(options).map((o) => h('option', { key: o[0], value: o[0] }, o[1])));
}

function Field(props) {
  const p = props || {};
  return h('label', { className: cx('mk-field', p.wide && 'mk-field-wide', p.className) }, [
    p.label ? h('span', { key: 'l', className: 'mk-field-lbl' }, p.label) : null,
    h('span', { key: 'c', className: 'mk-field-ctl' }, p.children),
    p.help ? h('span', { key: 'h', className: 'mk-field-help' }, p.help) : null,
  ]);
}

/** Cabecera de una sección del editor o de la hoja. */
function SecHead(props) {
  const p = props || {};
  return h('div', { className: 'mk-sechead' }, [
    p.num ? h('span', { key: 'n', className: 'mk-sechead-num' }, p.num) : null,
    h('span', { key: 't', className: 'mk-sechead-t' }, p.title),
    h('span', { key: 'sp', className: 'mk-sp' }),
    p.right || null,
  ]);
}

function Empty(props) {
  const p = props || {};
  return h('div', { className: 'mk-empty' }, [
    h('div', { key: 'i', className: 'mk-empty-icon' }, p.icon || '🎨'),
    h('div', { key: 't', className: 'mk-empty-title' }, p.title),
    p.text ? h('p', { key: 'x', className: 'mk-empty-text' }, p.text) : null,
    p.action ? h('div', { key: 'a', className: 'mk-empty-action' }, p.action) : null,
  ]);
}

/**
 * Avisos de la marca. No son errores: una marca a medio construir es un
 * estado legítimo. Pero se ven, porque una marca sin color base no re-marca
 * nada y nadie sabría por qué.
 */
function Avisos(props) {
  const lista = arr((props || {}).avisos);
  if (!lista.length) return null;
  return h('ul', { className: 'mk-avisos' }, lista.map((a, i) =>
    h('li', { key: i }, a)));
}

function Modal(props) {
  const p = props || {};
  if (!p.open) return null;
  return h('div', { className: 'mk-modal-bg', onClick: (e) => { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
    h('div', { className: cx('mk-modal', p.wide && 'mk-modal-wide'), role: 'dialog', 'aria-label': p.title }, [
      h('div', { key: 'h', className: 'mk-modal-hd' }, [
        h('h3', { key: 't' }, p.title),
        h(IconBtn, { key: 'x', icon: '✕', title: 'Cerrar', onClick: p.onClose }),
      ]),
      h('div', { key: 'b', className: 'mk-modal-body' }, p.children),
      p.footer ? h('div', { key: 'f', className: 'mk-modal-ft' }, p.footer) : null,
    ]));
}

/** Muestra de color con su rol, nombre, hex y rgb — el bloque de la hoja. */
function Swatch(props) {
  const p = props || {};
  const c = p.color || {};
  return h('div', {
    className: 'mk-sw',
    style: { background: c.hex, color: c.foreground },
    title: c.name + ' · ' + c.hex,
  }, [
    h('span', { key: 'r', className: 'mk-sw-role' }, c.roleLabel || ''),
    h('span', { key: 'n', className: 'mk-sw-nm' }, c.name || ''),
    h('span', { key: 'h', className: 'mk-sw-hex' }, (c.hex || '').toUpperCase()),
    h('span', { key: 'g', className: 'mk-sw-rgb' }, c.rgb || ''),
  ]);
}

/** El logo sobre el fondo que le corresponde: así se ve si de verdad funciona. */
function LogoBox(props) {
  const p = props || {};
  const l = p.logo || {};
  const marca = p.brand || {};
  const base = colorPorRol(marca, 'base');
  const fondo = l.background === 'dark' ? (base ? base.hex : '#1d1d1b')
    : l.background === 'light' ? '#f5f5f5'
      : l.background === 'color' ? ((colorPorRol(marca, 'accent') || {}).hex || '#f5f5f5')
        : 'transparent';
  return h('div', { className: 'mk-logobox' }, [
    h('div', {
      key: 'i',
      className: cx('mk-logobox-img', l.background === 'transparent' && 'mk-tramado'),
      style: { background: fondo },
    }, l.url
      ? h('img', { src: l.url, alt: l.name || 'Logotipo' })
      : h('span', { className: 'mk-logobox-falta' }, 'Sin archivo')),
    h('div', { key: 'l', className: 'mk-logobox-lbl' }, [
      h('b', { key: 'n' }, l.name || ''),
      h('span', { key: 'b' }, l.backgroundLabel || ''),
    ]),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/30-actions.js
// ══════════════════════════════════════════════════════════════════════
/* ══ ACCIONES ═════════════════════════════════════════════════════════════
 *
 * Todo lo que la app puede hacer, en un solo sitio. La interfaz y el agente
 * llaman a estas funciones y a ninguna otra: es la única forma de garantizar
 * que el agente puede hacer exactamente lo mismo que una persona (APP-SPEC §6).
 */

const avisar = (level, text) => { if (shell.notify) shell.notify({ level, text }); };

// ── Navegación ──────────────────────────────────────────────────────────

function actSetTab(tab) {
  setModel({ tab: tab === 'editor' ? 'editor' : 'sistema' });
  return estado.tab;
}

function actSetSeccion(seccion) {
  const valida = SECCIONES.some((x) => x[0] === seccion) || seccion === 'identidad';
  setModel({ seccion: valida ? seccion : 'logos' });
  return estado.seccion;
}

function actSeleccionar(id) {
  const b = marcaPorId(id);
  if (!b) return null;
  // Cambiar de marca con cambios sin guardar los perdería en silencio.
  if (estado.dirty && estado.selectedId !== b.id) {
    avisar('warn', 'Tienes cambios sin guardar en «' + s((estado.draft || {}).name) + '». Guárdalos o descártalos antes de cambiar de marca.');
    return null;
  }
  setModel({ selectedId: b.id, draft: null, dirty: false });
  return b;
}

/** Qué secciones se imprimen en la hoja. Es lo «parametrizable» de la hoja. */
function actToggleSeccionHoja(clave) {
  const actual = arr(estado.hojaSecciones);
  const next = actual.indexOf(clave) >= 0
    ? actual.filter((x) => x !== clave)
    : SECCIONES.map((x) => x[0]).filter((x) => actual.indexOf(x) >= 0 || x === clave);
  setModel({ hojaSecciones: next });
  return next;
}

// ── Ciclo de vida de una marca ──────────────────────────────────────────

/** Marca nueva con lo mínimo para que sirva: un principal y un acento.
 *
 * No se crea vacía a propósito: una marca sin ningún color con rol no
 * re-marca nada, y el primer encuentro con la app sería una pantalla en
 * blanco que no explica qué falta. */
function marcaEnBlanco(nombre) {
  return normalizeBrand({
    name: s(nombre).trim() || 'Marca nueva',
    palette: [
      { name: 'Principal', hex: '#1d1d1b', role: 'base' },
      { name: 'Acento', hex: '#00e5d0', role: 'accent' },
    ],
    typography: [{ family: 'Inter', usage: 'headings', weights: ['600', '700'] }],
  });
}

async function actNuevaMarca(nombre) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para crear marcas.'); return null; }
  const cuerpo = paraGuardar(marcaEnBlanco(nombre));
  setModel({ saving: true });
  try {
    const creada = normalizeBrand(await shell.brands.create(cuerpo));
    await cargar();
    setModel({ selectedId: creada.id, tab: 'editor', seccion: 'identidad', saving: false });
    abrirBorrador(creada.id);
    avisar('success', 'Marca «' + creada.name + '» creada.');
    return creada;
  } catch (e) {
    setModel({ saving: false });
    avisar('error', 'No se pudo crear la marca: ' + ((e && e.message) || 'error'));
    return null;
  }
}

async function actGuardar() {
  if (!estado.draft) return null;
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para editar marcas.'); return null; }
  const draft = estado.draft;
  if (!s(draft.name).trim()) { avisar('warn', 'La marca necesita un nombre.'); return null; }

  setModel({ saving: true });
  try {
    const guardada = normalizeBrand(await shell.brands.update(draft.id, paraGuardar(draft)));
    await cargar(true);
    setModel({ selectedId: guardada.id, saving: false });
    const avisos = avisosDe(guardada);
    avisar(avisos.length ? 'warn' : 'success',
      avisos.length
        ? 'Marca guardada, con ' + avisos.length + ' aviso(s) por revisar.'
        : 'Marca guardada. Las apps que la usen la verán actualizada.');
    return guardada;
  } catch (e) {
    setModel({ saving: false });
    avisar('error', 'No se pudo guardar: ' + ((e && e.message) || 'error'));
    return null;
  }
}

function actDescartar() {
  if (!estado.draft) return;
  setModel({ draft: null, dirty: false });
  avisar('info', 'Cambios descartados.');
}

async function actActivar(id) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para cambiar la marca activa.'); return false; }
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return false;
  try {
    await shell.brands.setDefault(b.id);
    await cargar(true);
    avisar('success', '«' + b.name + '» es ahora la marca activa del sistema.');
    return true;
  } catch (e) {
    avisar('error', 'No se pudo activar: ' + ((e && e.message) || 'error'));
    return false;
  }
}

async function actBorrar(id) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para borrar marcas.'); return false; }
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return false;
  try {
    await shell.brands.remove(b.id);
    await cargar();
    avisar('success', 'Marca «' + b.name + '» eliminada.');
    return true;
  } catch (e) {
    avisar('error', 'No se pudo eliminar: ' + ((e && e.message) || 'error'));
    return false;
  }
}

/** Replica una marca. Es como nace una variante: misma base, otro nombre. */
async function actDuplicar(id, nombre) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para crear marcas.'); return null; }
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return null;
  const copia = paraGuardar(Object.assign({}, b, {
    name: s(nombre).trim() || (b.name + ' (copia)'),
  }));
  try {
    const creada = normalizeBrand(await shell.brands.create(copia));
    await cargar();
    setModel({ selectedId: creada.id });
    avisar('success', 'Marca duplicada como «' + creada.name + '».');
    return creada;
  } catch (e) {
    avisar('error', 'No se pudo duplicar: ' + ((e && e.message) || 'error'));
    return null;
  }
}

// ── Identidad ───────────────────────────────────────────────────────────

function actSetCampo(campo, valor) {
  return editarBorrador((d) => Object.assign({}, d, { [campo]: valor }));
}

// ── Paleta ──────────────────────────────────────────────────────────────

function actAddColor(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    palette: d.palette.concat([normalizeColor(Object.assign({
      name: 'Color ' + (d.palette.length + 1), hex: '#cccccc', role: 'none',
    }, patch || {}), d.palette.length)]),
  }));
}

function actSetColor(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    palette: d.palette.map((c, i) => (c.key === s(key) ? normalizeColor(Object.assign({}, c, patch, {
      // La clave NO cambia al renombrar: los ecosistemas apuntan a ella y
      // renombrar un color no debería romper una referencia en silencio.
      key: c.key,
    }), i) : c)),
  }));
}

function actRemoveColor(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    palette: d.palette.filter((c) => c.key !== s(key)),
  }));
}

function actMoveColor(key, delta) {
  return editarBorrador((d) => {
    const i = d.palette.findIndex((c) => c.key === s(key));
    if (i < 0) return d;
    const j = clamp(i + (delta < 0 ? -1 : 1), 0, d.palette.length - 1);
    if (i === j) return d;
    const lista = d.palette.slice();
    const [x] = lista.splice(i, 1);
    lista.splice(j, 0, x);
    return Object.assign({}, d, { palette: lista });
  });
}

// ── Logotipos ───────────────────────────────────────────────────────────

function actAddLogo(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    logos: d.logos.concat([normalizeLogo(Object.assign({
      name: 'Logo ' + (d.logos.length + 1), background: 'transparent',
    }, patch || {}), d.logos.length)]),
  }));
}

function actSetLogo(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    logos: d.logos.map((l, i) => (l.key === s(key) ? normalizeLogo(Object.assign({}, l, patch, { key: l.key }), i) : l)),
  }));
}

function actRemoveLogo(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    logos: d.logos.filter((l) => l.key !== s(key)),
  }));
}

/** Sube el archivo por `shell.files` y lo deja en el logo. */
async function actSubirLogo(key, file) {
  if (!shell.files || typeof shell.files.upload !== 'function') {
    avisar('warn', 'Este host no permite subir archivos; pega la URL del logo.');
    return null;
  }
  if (!file) return null;
  try {
    const url = await shell.files.upload(file, { folder: 'logos', maxMB: 5 });
    actSetLogo(key, { url });
    return url;
  } catch (e) {
    avisar('error', 'No se pudo subir el logo: ' + ((e && e.message) || 'error'));
    return null;
  }
}

// ── Tipografías ─────────────────────────────────────────────────────────

function actAddFont(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    typography: d.typography.concat([normalizeFont(Object.assign({
      family: 'Inter', usage: 'body',
    }, patch || {}), d.typography.length)]),
  }));
}

function actSetFont(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    typography: d.typography.map((t, i) => (t.key === s(key) ? normalizeFont(Object.assign({}, t, patch, { key: t.key }), i) : t)),
  }));
}

function actRemoveFont(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    typography: d.typography.filter((t) => t.key !== s(key)),
  }));
}

// ── Ecosistemas ─────────────────────────────────────────────────────────

function actAddEco(patch) {
  return editarBorrador((d) => {
    const base = colorPorRol(d, 'base');
    const acento = colorPorRol(d, 'accent');
    return Object.assign({}, d, {
      ecosystems: d.ecosystems.concat([normalizeEcosystem(Object.assign({
        name: 'Ecosistema ' + (d.ecosystems.length + 1),
        baseColorKey: base ? base.key : '',
        accentColorKey: acento ? acento.key : '',
      }, patch || {}), d.ecosystems.length)]),
    });
  });
}

function actSetEco(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    ecosystems: d.ecosystems.map((e, i) => (e.key === s(key) ? normalizeEcosystem(Object.assign({}, e, patch, { key: e.key }), i) : e)),
  }));
}

function actRemoveEco(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    ecosystems: d.ecosystems.filter((e) => e.key !== s(key)),
  }));
}

// ── Principios ──────────────────────────────────────────────────────────

function actAddPrincipio(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    principles: d.principles.concat([normalizePrincipio(Object.assign({
      title: 'Principio ' + (d.principles.length + 1),
    }, patch || {}), d.principles.length)]),
  }));
}

function actSetPrincipio(i, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    principles: d.principles.map((p, j) => (j === Number(i) ? normalizePrincipio(Object.assign({}, p, patch), j) : p)),
  }));
}

function actRemovePrincipio(i) {
  return editarBorrador((d) => Object.assign({}, d, {
    principles: d.principles.filter((p, j) => j !== Number(i)),
  }));
}

// ══════════════════════════════════════════════════════════════════════
// src/50-editor.js
// ══════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════
// src/60-sheet.js
// ══════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════
// src/70-print.js
// ══════════════════════════════════════════════════════════════════════
/* ══ IMPRIMIR LA HOJA ═════════════════════════════════════════════════════
 *
 * La ventana de impresión renderiza EL MISMO componente `Hoja` que la
 * pantalla, con la hoja de estilos publicada de la app. No hay un maquetador
 * para ver y otro para imprimir: si divergieran, el PDF dejaría de parecerse
 * a lo que se aprobó en pantalla, y eso se descubre siempre tarde.
 */

const API = (() => {
  try {
    return s(shell.assetUrl('x')).split('/api/apps/')[0] || s(window.location.origin);
  } catch (e) {
    return '';
  }
})();

const BUNDLE_CSS_URL = API + '/api/apps/marcas/bundle.css';

/** A4 apaisado: la hoja es ancha porque enseña la marca en horizontal. */
function printCss(opts) {
  const o = isObj(opts) ? opts : {};
  const margen = clamp(Math.round(Number(o.margin) || 8), 0, 25);
  return [
    '@page { size: A4 landscape; margin: ' + margen + 'mm; }',
    'html, body { margin: 0; padding: 0; background: #fff; }',
    // El papel es blanco aunque KIMOS esté en modo noche: se imprime sobre
    // papel, no sobre la pantalla de nadie.
    '.kimos-marcas { background: #fff; color: #111; height: auto; }',
    '.mk-print .mk-hoja { height: auto; min-height: 0; }',
    '.mk-print .mk-hs { break-inside: avoid; }',
    '@media print { .mk-noprint { display: none !important; } }',
  ].join('\n');
}

function renderHojaInto(container, brand, opts) {
  const RD = globalThis.ReactDOM;
  if (!RD) throw new Error('El host no expone ReactDOM: no es posible generar la hoja.');
  const el = h(Hoja, Object.assign({ brand }, opts || {}));
  if (RD.createRoot) {
    const root = RD.createRoot(container);
    root.render(el);
    return () => { try { root.unmount(); } catch (e) { /* no-op */ } };
  }
  RD.render(el, container);
  return () => { try { RD.unmountComponentAtNode(container); } catch (e) { /* no-op */ } };
}

/** Espera a que haya nodos, la hoja de estilos cargue y los logos estén. */
async function esperarHoja(win, container, timeoutMs) {
  const limite = Date.now() + (timeoutMs || 6000);
  while (!container.childNodes.length && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 30));
  }
  while (Date.now() < limite) {
    const links = Array.from(win.document.querySelectorAll('link[rel="stylesheet"]'));
    if (links.every((l) => l.sheet || l.dataset.failed === '1')) break;
    await new Promise((r) => setTimeout(r, 40));
  }
  // Sin esperar a los logos se imprimen huecos en blanco, que en una hoja de
  // marca es justo lo que no puede pasar.
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
    const fin = () => res();
    img.addEventListener('load', fin, { once: true });
    img.addEventListener('error', fin, { once: true });
    setTimeout(fin, 4000);
  }))));
}

const nombreArchivo = (brand) => 'sistema-visual-' + (slug((brand || {}).name, 'marca')) + '-'
  + new Date().toISOString().slice(0, 10);

async function actImprimirHoja(id, opts) {
  const b = id ? marcaPorId(id) : seleccionada();
  if (!b) return false;

  let win = null;
  try { win = window.open('', '_blank', 'width=1200,height=900'); } catch (e) { win = null; }
  if (!win) {
    avisar('warn', 'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.');
    return false;
  }

  const d = win.document;
  d.title = nombreArchivo(b);
  const meta = d.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  d.head.appendChild(meta);

  // Se ENLAZA la hoja publicada de la app en vez de copiar los estilos: así
  // no pueden divergir de los de pantalla.
  const link = d.createElement('link');
  link.rel = 'stylesheet';
  link.href = BUNDLE_CSS_URL;
  link.addEventListener('error', () => { link.dataset.failed = '1'; });
  d.head.appendChild(link);

  const style = d.createElement('style');
  style.textContent = printCss(opts);
  d.head.appendChild(style);

  const root = d.createElement('div');
  root.className = 'kimos-marcas mk-print';
  d.body.appendChild(root);

  try {
    renderHojaInto(root, b, Object.assign({ secciones: estado.hojaSecciones }, opts || {}));
    await esperarHoja(win, root);
    win.focus();
    setTimeout(() => { try { win.print(); } catch (e) { /* se puede imprimir a mano */ } }, 120);
    return true;
  } catch (e) {
    // La ventana queda abierta con el error a la vista: cerrarla dejaría a la
    // persona sin saber qué pasó.
    root.textContent = 'No se pudo preparar la hoja: ' + ((e && e.message) || 'error desconocido');
    avisar('error', (e && e.message) || 'No se pudo preparar la hoja.');
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════
// src/90-app.js
// ══════════════════════════════════════════════════════════════════════
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
  return h('div', { className: 'mk-hoja-opts mk-noprint' }, [
    h('span', { key: 'l', className: 'mk-hoja-opts-l' }, 'En la hoja:'),
    SECCIONES.map(([k, label]) => {
      const tiene = k === 'logos' ? ctx.logos.length : arr(b[k]).length;
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
          h(Hoja, { key: 'h', brand: b, secciones: m.hojaSecciones }),
        ]),
    ] : h(Empty, { icon: '👈', title: 'Elige una marca' })),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// src/95-agent.js
// ══════════════════════════════════════════════════════════════════════
/* ══ AGENTE IA ════════════════════════════════════════════════════════════
 *
 * El agente hace lo mismo que una persona porque llama a las mismas acciones
 * (APP-SPEC §6). No hay un camino paralelo: si una capacidad no está en
 * `30-actions.js`, el agente tampoco la tiene.
 *
 * Cuidado deliberado: cambiar una marca cambia cómo se ven las salidas de
 * TODAS las apps, así que las herramientas que escriben lo dicen en su
 * descripción y ninguna guarda sin que se le pida.
 */

const T_STR = { type: 'string' };
const T_NUM = { type: 'number' };

const tool = (name, description, properties, required) => ({
  name, description,
  inputSchema: { type: 'object', properties: properties || {}, required: required || [] },
});

const AGENT_TOOLS = [
  tool('LISTAR_MARCAS', 'Lista las marcas del tenant con su resumen: cuántos colores, logotipos y avisos tiene cada una, y cuál es la activa.',
    {}),
  tool('VER_MARCA', 'Devuelve una marca completa: identidad, paleta con roles, logotipos con su fondo, tipografías, ecosistemas y principios.',
    { marca: T_STR }, ['marca']),
  tool('ABRIR_MARCA', 'Abre una marca a la vista de la persona, en la hoja o en el editor.',
    { marca: T_STR, vista: { type: 'string', enum: ['sistema', 'editor'] } }, ['marca']),
  tool('CREAR_MARCA', 'Crea una marca nueva con un principal y un acento por defecto, lista para editar.',
    { nombre: T_STR }),
  tool('DUPLICAR_MARCA', 'Replica una marca existente con otro nombre. Es como nace una variante.',
    { marca: T_STR, nombre: T_STR }, ['marca']),
  tool('ACTUALIZAR_IDENTIDAD', 'Cambia los datos de identidad de la marca abierta: nombre, bajada, razón social, RUT, contacto, pie o datos de pago. NO guarda: usa GUARDAR_MARCA.',
    {
      nombre: T_STR, bajada: T_STR, descripcion: T_STR, razonSocial: T_STR, rut: T_STR,
      correo: T_STR, telefono: T_STR, web: T_STR, direccion: T_STR, pie: T_STR, datosDePago: T_STR,
    }),
  tool('AGREGAR_COLOR', 'Añade un color a la paleta de la marca abierta. El `rol` es lo que permite que otras apps sepan dónde usarlo.',
    {
      nombre: T_STR, hex: T_STR,
      rol: { type: 'string', enum: COLOR_ROLES.map((x) => x[0]) },
    }, ['hex']),
  tool('ACTUALIZAR_COLOR', 'Cambia un color de la paleta por su nombre o su clave.',
    { color: T_STR, nombre: T_STR, hex: T_STR, rol: { type: 'string', enum: COLOR_ROLES.map((x) => x[0]) } }, ['color']),
  tool('QUITAR_COLOR', 'Quita un color de la paleta.', { color: T_STR }, ['color']),
  tool('AGREGAR_LOGO', 'Añade un logotipo. `fondo` dice sobre qué va: sin eso, una app puede ponerlo blanco sobre blanco.',
    {
      nombre: T_STR, url: T_STR,
      fondo: { type: 'string', enum: LOGO_BACKGROUNDS.map((x) => x[0]) },
    }, ['url']),
  tool('AGREGAR_TIPOGRAFIA', 'Añade una familia tipográfica con su uso.',
    {
      familia: T_STR, uso: { type: 'string', enum: TYPE_USAGES.map((x) => x[0]) },
      pesos: { type: 'array', items: T_STR }, muestra: T_STR,
    }, ['familia']),
  tool('AGREGAR_PRINCIPIO', 'Añade una regla de la marca: lo que alguien de fuera necesita para no romperla.',
    { titulo: T_STR, texto: T_STR }, ['titulo']),
  tool('GUARDAR_MARCA', 'Guarda los cambios de la marca abierta en el registro. A partir de aquí las demás apps la ven así.',
    {}),
  tool('ACTIVAR_MARCA', 'Deja una marca como la activa del sistema: es la que usan por defecto las apps que no eligen una.',
    { marca: T_STR }, ['marca']),
  tool('REVISAR_MARCA', 'Dice qué le falta a una marca para poder aplicarse y qué tiene mal (colores sin rol, referencias rotas, acento sin contraste).',
    { marca: T_STR }),
  tool('IMPRIMIR_HOJA', 'Abre la hoja del sistema visual de la marca en una ventana lista para imprimir o guardar como PDF.',
    { marca: T_STR }),
];

const okMsg = (message, extra) => Object.assign({ success: true, message }, isObj(extra) ? extra : {});
const errMsg = (error) => ({ success: false, error });

/** Resuelve una marca por id o por nombre. Con varias coincidencias no elige:
 *  aplicar la marca equivocada sale caro y en silencio. */
function resolverMarca(ref) {
  const raw = s(ref).trim();
  if (!raw) {
    const sel = seleccionada();
    return sel ? { marca: sel } : { error: 'No hay ninguna marca abierta y no me dijiste cuál.' };
  }
  const porId = marcaPorId(raw);
  if (porId) return { marca: porId };
  const n = slug(raw);
  const coinciden = estado.brands.filter((b) => slug(b.name) === n);
  if (coinciden.length === 1) return { marca: coinciden[0] };
  if (coinciden.length > 1) return { error: 'Hay varias marcas llamadas «' + raw + '». Precisa cuál por su id.' };
  const parciales = estado.brands.filter((b) => slug(b.name).indexOf(n) >= 0);
  if (parciales.length === 1) return { marca: parciales[0] };
  if (parciales.length > 1) {
    return { error: 'Varias marcas coinciden con «' + raw + '»: ' + parciales.map((b) => b.name).join(', ') + '. Precisa cuál.' };
  }
  return { error: 'No encontré ninguna marca que se llame «' + raw + '».' };
}

/** Un color por su clave o su nombre, dentro del borrador abierto. */
function resolverColor(b, ref) {
  const n = slug(ref);
  return arr(b.palette).find((c) => c.key === s(ref)) || arr(b.palette).find((c) => slug(c.name) === n) || null;
}

function agentSnapshot() {
  const b = seleccionada();
  return {
    version: APP_VERSION,
    marcas: estado.brands.map(resumenDe),
    activa: s(estado.currentId),
    abierta: b ? Object.assign(resumenDe(b), { sinGuardar: !!estado.dirty }) : null,
    puedeEditar: puedeEditar(),
    rolesDeColor: COLOR_ROLES.map((x) => ({ id: x[0], nombre: x[1], para: x[2] })),
    fondosDeLogo: LOGO_BACKGROUNDS.map((x) => ({ id: x[0], nombre: x[1] })),
  };
}

/** Exige que haya una marca abierta para las acciones que editan. */
function exigeBorrador() {
  const b = seleccionada();
  if (!b) return { error: 'No hay ninguna marca abierta. Usa ABRIR_MARCA primero.' };
  if (!puedeEditar()) return { error: 'No tienes permiso para editar marcas.' };
  return { b };
}

async function agentDispatch(action) {
  const a = isObj(action) ? action : {};
  const tipo = s(a.type);
  const pl = isObj(a.payload) ? a.payload : {};

  switch (tipo) {
    case 'LISTAR_MARCAS':
      return okMsg(estado.brands.length + ' marca(s) en el sistema.', { marcas: estado.brands.map(resumenDe) });

    case 'VER_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      return okMsg('Marca «' + r.marca.name + '».', { marca: r.marca, avisos: avisosDe(r.marca) });
    }

    case 'ABRIR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const abierta = actSeleccionar(r.marca.id);
      if (!abierta) return errMsg('Hay cambios sin guardar en la marca abierta.');
      actSetTab(s(pl.vista) === 'editor' ? 'editor' : 'sistema');
      if (s(pl.vista) === 'editor') abrirBorrador(r.marca.id);
      return okMsg('Marca «' + r.marca.name + '» abierta.');
    }

    case 'CREAR_MARCA': {
      const creada = await actNuevaMarca(pl.nombre);
      return creada ? okMsg('Marca «' + creada.name + '» creada y abierta para editar.', { id: creada.id })
        : errMsg('No se pudo crear la marca.');
    }

    case 'DUPLICAR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const copia = await actDuplicar(r.marca.id, pl.nombre);
      return copia ? okMsg('Duplicada como «' + copia.name + '».', { id: copia.id })
        : errMsg('No se pudo duplicar.');
    }

    case 'ACTUALIZAR_IDENTIDAD': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const campos = {
        nombre: 'name', bajada: 'tagline', descripcion: 'description', razonSocial: 'legalName',
        rut: 'taxId', correo: 'email', telefono: 'phone', web: 'website', direccion: 'address',
        pie: 'footer', datosDePago: 'bankDetails',
      };
      const puestos = [];
      for (const [entrada, campo] of Object.entries(campos)) {
        if (pl[entrada] !== undefined) { actSetCampo(campo, s(pl[entrada])); puestos.push(campo); }
      }
      if (!puestos.length) return errMsg('No mandaste ningún dato de identidad.');
      return okMsg('Identidad actualizada (' + puestos.join(', ') + '). Sin guardar todavía: usa GUARDAR_MARCA.');
    }

    case 'AGREGAR_COLOR': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      if (!esHexValido(pl.hex)) return errMsg('«' + s(pl.hex) + '» no es un color hexadecimal (#RGB o #RRGGBB).');
      actAddColor({ name: s(pl.nombre), hex: s(pl.hex), role: s(pl.rol) || 'none' });
      const aviso = !s(pl.rol) || pl.rol === 'none'
        ? ' Ojo: sin rol, ninguna app sabrá dónde usarlo.' : '';
      return okMsg('Color añadido.' + aviso + ' Sin guardar todavía.');
    }

    case 'ACTUALIZAR_COLOR': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const c = resolverColor(g.b, pl.color);
      if (!c) return errMsg('No encontré el color «' + s(pl.color) + '» en la paleta.');
      if (pl.hex !== undefined && !esHexValido(pl.hex)) return errMsg('«' + s(pl.hex) + '» no es un color hexadecimal.');
      const patch = {};
      if (pl.nombre !== undefined) patch.name = s(pl.nombre);
      if (pl.hex !== undefined) patch.hex = s(pl.hex);
      if (pl.rol !== undefined) patch.role = s(pl.rol);
      if (!Object.keys(patch).length) return errMsg('No mandaste nada que cambiar del color.');
      actSetColor(c.key, patch);
      return okMsg('Color «' + c.name + '» actualizado. Sin guardar todavía.');
    }

    case 'QUITAR_COLOR': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const c = resolverColor(g.b, pl.color);
      if (!c) return errMsg('No encontré el color «' + s(pl.color) + '».');
      actRemoveColor(c.key);
      return okMsg('Color «' + c.name + '» quitado. Sin guardar todavía.');
    }

    case 'AGREGAR_LOGO': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const url = s(pl.url).trim();
      if (!/^(https?:\/\/|\/)/.test(url)) return errMsg('La URL del logo debe empezar por http(s):// o por /.');
      actAddLogo({ name: s(pl.nombre), url, background: s(pl.fondo) || 'transparent' });
      return okMsg('Logotipo añadido. Sin guardar todavía.');
    }

    case 'AGREGAR_TIPOGRAFIA': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      actAddFont({
        family: s(pl.familia), usage: s(pl.uso) || 'body',
        weights: arr(pl.pesos), sample: s(pl.muestra),
      });
      return okMsg('Tipografía añadida. Sin guardar todavía.');
    }

    case 'AGREGAR_PRINCIPIO': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      actAddPrincipio({ title: s(pl.titulo), text: s(pl.texto) });
      return okMsg('Principio añadido. Sin guardar todavía.');
    }

    case 'GUARDAR_MARCA': {
      if (!estado.dirty) return errMsg('No hay cambios que guardar.');
      const guardada = await actGuardar();
      if (!guardada) return errMsg('No se pudo guardar la marca.');
      const avisos = avisosDe(guardada);
      return okMsg('Marca «' + guardada.name + '» guardada. Las demás apps ya la ven así.', { avisos });
    }

    case 'ACTIVAR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const ok = await actActivar(r.marca.id);
      return ok ? okMsg('«' + r.marca.name + '» es ahora la marca activa del sistema.')
        : errMsg('No se pudo activar la marca.');
    }

    case 'REVISAR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const avisos = avisosDe(r.marca);
      return okMsg(avisos.length
        ? 'La marca «' + r.marca.name + '» tiene ' + avisos.length + ' cosa(s) que revisar.'
        : 'La marca «' + r.marca.name + '» está completa y se puede aplicar.', { avisos });
    }

    case 'IMPRIMIR_HOJA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const ok = await actImprimirHoja(r.marca.id);
      return ok ? okMsg('Hoja de «' + r.marca.name + '» abierta para imprimir.')
        : errMsg('No se pudo abrir la hoja.');
    }

    default:
      return errMsg('No conozco la acción «' + tipo + '». Disponibles: ' + AGENT_TOOLS.map((t) => t.name).join(', ') + '.');
  }
}

let desregistrarAgente = null;

function registrarAgente() {
  if (!shell.agent || typeof shell.agent.register !== 'function') return null;
  desregistrarAgente = shell.agent.register({
    appId: 'marcas',
    name: 'Marcas',
    description: 'El sistema visual de la empresa: logotipos, paleta con roles, tipografías, '
      + 'ecosistemas y principios de cada marca. Cambiar una marca cambia cómo se ven las '
      + 'propuestas, fichas y correos de TODAS las apps, así que nada se guarda hasta '
      + 'GUARDAR_MARCA. Un color sin rol no lo usará ninguna app: pregunta el rol si no te lo dan.',
    tools: AGENT_TOOLS,
    getSnapshot: agentSnapshot,
    dispatchAction: agentDispatch,
  });
  return desregistrarAgente;
}

  return {
    Component: App,
    unmount() { teardown(); },
    // Ventana al interior del closure para el banco de pruebas
    // (test/test-app.mjs). El host solo usa Component y unmount.
    __test: {
      cargar, getModel, setModel, teardown, suscribir,
      normalizeBrand, normalizeColor, normalizeLogo, normalizeFont,
      normalizeEcosystem, normalizePrincipio, paraGuardar,
      colorPorRol, colorPorClave, logoParaFondo, marcaPorId, seleccionada,
      normalizeHex, esHexValido, hexToRgb, hexToHslToken, textoLegible, contraste, slug,
      puedeEditar, registroNoDisponible, abrirBorrador, editarBorrador,
      COLOR_ROLES, LOGO_BACKGROUNDS, TYPE_USAGES, SECCIONES,
      actSeleccionar, actNuevaMarca, actGuardar, actDescartar, actBorrar,
      actActivar, actDuplicar, actSetCampo,
      actSetColor, actAddColor, actRemoveColor, actMoveColor,
      actSetLogo, actAddLogo, actRemoveLogo, actSubirLogo,
      actSetFont, actAddFont, actRemoveFont,
      actSetEco, actAddEco, actRemoveEco,
      actSetPrincipio, actAddPrincipio, actRemovePrincipio,
      actSetTab, actSetSeccion, actToggleSeccionHoja, actImprimirHoja,
      avisosDe, resumenDe, hojaContexto, marcaEnBlanco, printCss, nombreArchivo,
      registrarAgente, agentSnapshot, agentDispatch, AGENT_TOOLS, resolverMarca,
      // Los componentes, para que el banco de pruebas los renderice: viven
      // detrás de estado de interacción y si no se pintarían por primera vez
      // en producción.
      dialogos: {
        Hoja, Editor, Cartera, Barra, HojaOpciones, Modal,
        EdIdentidad, EdPaleta, EdLogos, EdTipografias, EdEcosistemas, EdPrincipios,
      },
    },
  };
}
