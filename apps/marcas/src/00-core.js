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
