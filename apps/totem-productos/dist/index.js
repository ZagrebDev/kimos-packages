/**
 * Totem de Productos — vitrina táctil vertical (9:16) del catálogo.
 *
 * Muestra los productos de las apps `products` (catálogo de tienda) y
 * `productlab` (productos personalizables con paso a paso) en una
 * visualización touch pensada para un tótem de atención al cliente,
 * lista para usarse con la app Vitrinas (agente de voz incrustado).
 *
 * Dos modos de ejecución:
 *  - Escritorio (sesión KIMOS): lee los catálogos vía shell.data
 *    (data.read:products / data.read:productlab), permite curar qué se
 *    muestra (pestaña Catálogo), editar la visualización (pestaña Estilos)
 *    y PUBLICAR un snapshot del catálogo en el item `definition`
 *    (public.enabled + public.data, permiso public.read).
 *  - Vitrina pública (sin sesión): shell.data/authFetch no existen; la app
 *    consume el snapshot publicado vía GET /api/public/app/{iid}/definition
 *    (el instanceId llega por ?catalogo=… en la URL o queda cacheado en
 *    localStorage) y lo refresca con un faro de versión.
 *
 * Compatibilidad ProductLab: usa preferentemente el JSON público resuelto
 * (definition.public.data, contrato v2: basePrice + delta por valor + estilo
 * resuelto) y, si la instancia no publica, replica el motor de precios
 * (costo→margen→IVA→redondeo) para calcular los recargos por opción.
 *
 * Convivencia con el dock de voz de la vitrina: en modo tótem se reserva la
 * franja inferior (--tp-dock: 350px) para que nada quede tapado por el
 * micrófono, igual que la app evento-ciberseguridad.
 *
 * Bundle ESM puro sobre el contrato AppShell: globalThis.React, sin JSX,
 * CSS con scope .kimos-totem-productos.
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.0.0';

const LS_ID = 'kimos.totem-productos.catalogo';
const LS_CACHE = 'kimos.totem-productos.cache.v1';

const DEFAULT_CONFIG = { modo: 'auto', segundosInactividad: 90 };

// ── Utilidades puras ─────────────────────────────────────────────────────────
const s = (v) => (v == null ? '' : String(v));
const nowIso = () => new Date().toISOString();
const norm = (v) => s(v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const newId = (p) => p + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const clampN = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

function isDarkHex(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s(hex).trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

// HTML de la tienda → texto plano acotado (el tótem no pinta HTML arbitrario).
function textoPlano(html, max) {
  const t = s(html)
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (max && t.length > max) return t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

// ── Estilo de la vitrina (pestaña Estilos) ───────────────────────────────────
function defaultStyle() {
  return {
    accentColor: '#19ACB1',
    fondo: 'auto',            // auto | oscuro | claro | color
    bgColor: '#101A2E',
    radius: 18,               // 0 = bordes rectos … 28 = muy redondeados
    cardStyle: 'cards',       // cards | lista
    cols: 2,                  // columnas de la grilla (1..3)
    fit: 'cover',             // cover | contain (fotos de las tarjetas)
    fontScale: 'm',           // s | m | l
    mostrarPrecios: true,
    mostrarDeltas: 'delta',   // delta | total | none
    mostrarSku: false,
    mostrarStock: false,
    ctaLabel: 'Personalizar',
    respetarEstiloProducto: true,
  };
}

function normalizeStyle(raw) {
  const d = defaultStyle();
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    accentColor: s(r.accentColor || d.accentColor),
    fondo: ['auto', 'oscuro', 'claro', 'color'].indexOf(r.fondo) !== -1 ? r.fondo : d.fondo,
    bgColor: s(r.bgColor || d.bgColor),
    radius: clampN(r.radius, 0, 28, d.radius),
    cardStyle: r.cardStyle === 'lista' ? 'lista' : 'cards',
    cols: clampN(r.cols, 1, 3, d.cols),
    fit: r.fit === 'contain' ? 'contain' : 'cover',
    fontScale: ['s', 'm', 'l'].indexOf(r.fontScale) !== -1 ? r.fontScale : 'm',
    mostrarPrecios: r.mostrarPrecios !== false,
    mostrarDeltas: ['delta', 'total', 'none'].indexOf(r.mostrarDeltas) !== -1 ? r.mostrarDeltas : 'delta',
    mostrarSku: r.mostrarSku === true,
    mostrarStock: r.mostrarStock === true,
    ctaLabel: s(r.ctaLabel || d.ctaLabel),
    respetarEstiloProducto: r.respetarEstiloProducto !== false,
  };
}

// ── Motor de precios de ProductLab (respaldo si la instancia no publica) ─────
function plRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    currency: s(r.currency || 'CLP'),
    currencySymbol: s(r.currencySymbol || '$'),
    currencyDecimals: clampN(r.currencyDecimals, 0, 4, 0),
    locale: s(r.locale || 'es-CL'),
    fx: r.fx && typeof r.fx === 'object' ? r.fx : {},
    salesTaxPct: Number.isFinite(Number(r.salesTaxPct)) ? Number(r.salesTaxPct) : (Number(r.ivaPct) || 19),
    marginBasis: r.marginBasis === 'sale' ? 'sale' : 'cost',
    marginDefaultPct: Number(r.marginDefaultPct) || 25,
    marginByType: r.marginByType && typeof r.marginByType === 'object' ? r.marginByType : {},
    roundMode: ['none', 'nearest', 'up', 'ending'].indexOf(r.roundMode) !== -1 ? r.roundMode : 'none',
    roundTo: Number(r.roundTo) || 1000,
    roundEnding: Number(r.roundEnding) || 990,
    deltaRoundTo: Number(r.deltaRoundTo) || 1,
    leadTimeDays: Number(r.leadTimeDays) || 0,
  };
}

function plEngine(defItem, comps) {
  const rules = plRules(defItem && defItem.rules);
  const byId = new Map((comps || []).map((c) => [c.id, c]));
  const iva = rules.salesTaxPct / 100;

  const grossComp = (c) => {
    if (!c) return null;
    const fx = c.currency && c.currency !== rules.currency ? (Number(rules.fx[c.currency]) || 1) : 1;
    const costBase = (Number(c.cost) || 0) * fx;
    const net = (c.costConIva ? costBase / (1 + iva) : costBase) * (1 + (Number(c.taxPct) || 0) / 100);
    const m = (Number.isFinite(Number(rules.marginByType[c.type])) ? Number(rules.marginByType[c.type]) : rules.marginDefaultPct) / 100;
    const priced = rules.marginBasis === 'sale' ? (m < 1 ? net / (1 - m) : net) : net * (1 + m);
    return priced * (1 + iva);
  };
  const disponible = (c, qty) => !!c && c.active !== false && (c.stock == null || Number(c.stock) >= (qty || 1));

  // Pool efectivo del valor: componentIds + altIds (salvo soloExacto), agrupado por tipo.
  const poolPorTipo = (v) => {
    const solo = new Set(Array.isArray(v.soloExacto) ? v.soloExacto : []);
    const tipos = new Map();
    (v.componentIds || []).forEach((cid) => {
      const base = byId.get(cid);
      if (!base) return;
      const alts = [base];
      if (!solo.has(cid)) (base.altIds || []).forEach((aid) => { const a = byId.get(aid); if (a) alts.push(a); });
      const lista = tipos.get(base.type) || [];
      alts.forEach((c) => { if (lista.indexOf(c) === -1) lista.push(c); });
      tipos.set(base.type, lista);
    });
    return tipos;
  };

  // Precio bruto del valor (o null si algún tipo quedó sin alternativa disponible).
  const valueGross = (v) => {
    const qty = Number(v.qty) || 1;
    if (!(v.componentIds || []).length) return Number(v.priceDelta) || 0; // opción sin costo
    let suma = 0;
    let elegido = null;
    for (const lista of poolPorTipo(v).values()) {
      let mejor = null;
      for (const c of lista) {
        if (!disponible(c, qty)) continue;
        const g = grossComp(c);
        if (g != null && (mejor == null || g < mejor.g)) mejor = { c: c, g: g };
      }
      if (!mejor) return null;
      suma += mejor.g * qty;
      if (!elegido) elegido = mejor.c;
    }
    return { gross: suma + (Number(v.priceDelta) || 0), comp: elegido };
  };

  const roundDelta = (n) => Math.round(n / rules.deltaRoundTo) * rules.deltaRoundTo;

  return { rules: rules, byId: byId, grossComp: grossComp, disponible: disponible, valueGross: valueGross, roundDelta: roundDelta };
}

// ── Normalizadores → forma común del tótem ───────────────────────────────────
// Producto normalizado: { key, source, id, instanceId, name, sku, brand,
//   price, compareAtPrice, imageUrl, images[], description, specs[],
//   stock, deliveryDays, configurable, groups[], presets[], style }
// Grupo: { id, label, nota, affectsPhoto, dependsOn:{groupId,valueIds}|null,
//   values: [{ id, name, desc, imageUrl, swatchColor, delta, isDefault, deliveryDays }] }

function normValor(v) {
  return {
    id: s(v.id),
    name: s(v.name || v.label),
    desc: s(v.desc || v.detalle),
    imageUrl: s(v.imageUrl),
    swatchColor: s(v.swatchColor),
    delta: Number(v.delta) || 0,
    isDefault: v.isDefault === true,
    deliveryDays: Number(v.deliveryDays) || 0,
  };
}

// Desde el JSON público v2 de ProductLab (definition.public.data.productos[i]).
function fromPublicPL(pp, instId) {
  if (!pp || !pp.name) return null;
  const groups = (Array.isArray(pp.groups) ? pp.groups : []).map((g) => {
    const values = (g.values || []).filter((v) => v && v.fallback !== true).map(normValor).filter((v) => v.id && v.name);
    if (!values.length) return null;
    if (!values.some((v) => v.isDefault)) values[0].isDefault = true;
    const d = g.dependsOn;
    return {
      id: s(g.id), label: s(g.label || g.type), nota: s(g.nota),
      affectsPhoto: g.affectsPhoto === true,
      dependsOn: d && d.groupId && Array.isArray(d.valueIds) && d.valueIds.length ? { groupId: s(d.groupId), valueIds: d.valueIds.map(s) } : null,
      values: values,
    };
  }).filter(Boolean);
  const specs = pp.storefront && Array.isArray(pp.storefront.specs)
    ? pp.storefront.specs.map((x) => ({ group: s(x.group), label: s(x.label), value: s(x.value) })).filter((x) => x.label)
    : [];
  const style = pp.storefront && pp.storefront.style ? {
    accentColor: s(pp.storefront.style.accentColor),
    radius: Number.isFinite(Number(pp.storefront.style.radius)) ? Number(pp.storefront.style.radius) : null,
  } : null;
  // Presets: en el JSON público la selección viene por NOMBRES [{group,value}].
  const presets = (Array.isArray(pp.presets) ? pp.presets : []).map((pr) => {
    const sel = {};
    const pares = Array.isArray(pr.selection) ? pr.selection : [];
    pares.forEach((par) => {
      const g = groups.find((x) => norm(x.label) === norm(par.group));
      if (!g) return;
      const v = g.values.find((x) => norm(x.name) === norm(par.value));
      if (v) sel[g.id] = v.id;
    });
    return { id: s(pr.id) || newId('pre'), name: s(pr.name), imageUrl: s(pr.imageUrl), sel: sel };
  }).filter((pr) => pr.name);
  return {
    key: 'pl:' + instId + ':' + s(pp.sku || pp.productId || pp.name),
    source: 'productlab', id: s(pp.sku || pp.productId || pp.name), instanceId: instId,
    name: s(pp.name), sku: s(pp.sku), brand: '',
    price: Number(pp.basePrice) || 0, compareAtPrice: null,
    imageUrl: s(pp.imageUrl), images: Array.isArray(pp.images) ? pp.images.map(s).filter(Boolean) : [],
    description: textoPlano(pp.description, 900),
    specs: specs, stock: null,
    deliveryDays: Number(pp.deliveryDays) || 0,
    deliveryMode: pp.deliveryMode === 'sum' ? 'sum' : 'max',
    leadDays: Number(pp.leadTimeDays) || 0,
    configurable: groups.length > 0,
    groups: groups, presets: presets, style: style,
  };
}

// Desde items crudos de ProductLab (kind producto/equipo) + motor de precios.
function fromRawPL(eq, engine, instId, storeItems) {
  if (!eq || !eq.name || eq.status === 'inactive') return null;
  const rules = engine.rules;

  const groups = [];
  (Array.isArray(eq.groups) ? eq.groups : []).forEach((g) => {
    if (!g || g.baseStep === true) return;
    const brutos = [];
    (g.values || []).forEach((v) => {
      if (!v || v.fallback === true) return;
      const vg = (v.componentIds || []).length ? engine.valueGross(v) : { gross: Number(v.priceDelta) || 0, comp: null };
      if (vg == null) return; // agotado: no se ofrece
      const comp = vg.comp;
      const qty = Number(v.qty) || 1;
      const detalleAuto = comp ? (qty > 1 ? qty + '× ' : '') + s(comp.specs || comp.name) : '';
      // Foto del valor: manual, o la del componente del tipo del paso.
      let img = s(v.imageUrl);
      if (!img) {
        for (const cid of v.componentIds || []) {
          const c = engine.byId.get(cid);
          if (c && c.type === g.typeId && c.imageUrl) { img = s(c.imageUrl); break; }
        }
      }
      const dd = comp ? Number(comp.deliveryDays) || 0 : 0;
      brutos.push({
        id: s(v.id), name: s(v.label), desc: s(v.detalle) || detalleAuto,
        imageUrl: img, swatchColor: s(v.swatchColor),
        gross: typeof vg === 'object' ? vg.gross : vg,
        deliveryDays: dd,
      });
    });
    if (!brutos.length) return;
    const defId = s(g.defaultValueId);
    const def = brutos.find((v) => v.id === defId) || brutos[0];
    const values = brutos.map((v) => ({
      id: v.id, name: v.name, desc: v.desc, imageUrl: v.imageUrl, swatchColor: v.swatchColor,
      delta: engine.roundDelta(v.gross - def.gross),
      isDefault: v === def, deliveryDays: v.deliveryDays,
    }));
    const d = g.dependsOn;
    groups.push({
      id: s(g.id), label: s(g.label) || s(g.typeId), nota: s(g.nota),
      affectsPhoto: g.photoStep === true,
      dependsOn: d && d.stepId && Array.isArray(d.valueIds) && d.valueIds.length ? { groupId: s(d.stepId), valueIds: d.valueIds.map(s) } : null,
      values: values,
    });
  });

  // Precio base según el modo (el `price` persistido ya es la config por defecto).
  let price = 0;
  const ref = eq.storeRef || null;
  if (eq.priceMode === 'fixed') price = Number(eq.fixedPrice) || Number(eq.price) || 0;
  else if (eq.priceMode === 'store') {
    const it = ref && storeItems ? storeItems.get(ref.itemId) : null;
    price = (it && Number(it.price)) || Number(eq.fixedPrice) || Number(eq.price) || 0;
  } else price = Number(eq.price) || 0;

  const sf = eq.storefront || {};
  const specs = Array.isArray(sf.specs) ? sf.specs.map((x) => ({ group: s(x.group), label: s(x.label), value: s(x.value) })).filter((x) => x.label) : [];
  const storeItem = ref && storeItems ? storeItems.get(ref.itemId) : null;
  const imgs = [];
  if (eq.imageUrl) imgs.push(s(eq.imageUrl));
  (Array.isArray(eq.galleryImages) ? eq.galleryImages : []).forEach((u) => { const x = s(u); if (x && imgs.indexOf(x) === -1) imgs.push(x); });
  if (storeItem) {
    (Array.isArray(storeItem.images) ? storeItem.images : (storeItem.imageUrl ? [storeItem.imageUrl] : [])).forEach((u) => {
      const x = s(u); if (x && imgs.indexOf(x) === -1) imgs.push(x);
    });
  }
  const presets = (Array.isArray(eq.presets) ? eq.presets : []).map((pr) => ({
    id: s(pr.id) || newId('pre'), name: s(pr.name), imageUrl: s(pr.imageUrl),
    sel: pr.selection && typeof pr.selection === 'object' ? pr.selection : {},
  })).filter((pr) => pr.name);

  return {
    key: 'pl:' + instId + ':' + s(eq.id),
    source: 'productlab', id: s(eq.id), instanceId: instId,
    name: s(eq.name), sku: s(eq.sku), brand: '',
    price: Math.round(price), compareAtPrice: null,
    imageUrl: imgs[0] || '', images: imgs,
    description: textoPlano(storeItem && (storeItem.description || storeItem.body), 900),
    specs: specs, stock: null,
    deliveryDays: 0,
    deliveryMode: eq.deliveryMode === 'sum' ? 'sum' : 'max',
    leadDays: (eq.deliveryExtraDays != null ? Number(eq.deliveryExtraDays) : rules.leadTimeDays) || 0,
    configurable: groups.length > 0,
    groups: groups, presets: presets,
    style: sf.style ? { accentColor: s(sf.style.accentColor), radius: Number.isFinite(Number(sf.style.radius)) ? Number(sf.style.radius) : null } : null,
  };
}

// Grupos de personalización desde las opciones/variantes de un item de `products`.
function groupsFromProducts(p) {
  const groups = [];
  const base = Number(p.price) || 0;
  (Array.isArray(p.options) ? p.options : []).forEach((o, oi) => {
    if (!o || !s(o.name) || !Array.isArray(o.values) || !o.values.length) return;
    const gid = 'opt-' + oi;
    if (o.optionType === 'addon') {
      const recargo = Math.max(0, Number(o.addonPrice) || 0);
      groups.push({
        id: gid, label: s(o.name), nota: '', affectsPhoto: false, dependsOn: null,
        values: [{ id: gid + '-no', name: 'Sin ' + s(o.name).toLowerCase(), desc: '', imageUrl: '', swatchColor: '', delta: 0, isDefault: true, deliveryDays: 0 }]
          .concat(o.values.map((v, vi) => ({
            id: gid + '-' + vi, name: s(v.name), desc: '', imageUrl: '', swatchColor: '',
            delta: recargo, isDefault: false, deliveryDays: 0,
          }))),
      });
      return;
    }
    // Opción normal: el recargo sale de las variantes (ancla + delta).
    const vals = o.values.map((v, vi) => {
      let delta = 0;
      const conValor = (Array.isArray(p.variants) ? p.variants : []).filter((vr) => vr && vr.options && norm(vr.options[o.name]) === norm(v.name));
      const precios = conValor.map((vr) => Number(vr.price)).filter(Number.isFinite);
      if (precios.length) delta = Math.min.apply(null, precios) - base;
      return { id: gid + '-' + vi, name: s(v.name), desc: '', imageUrl: '', swatchColor: '', delta: Math.round(delta), isDefault: false, deliveryDays: 0 };
    }).filter((v) => v.name);
    if (!vals.length) return;
    let mi = 0;
    vals.forEach((v, ix) => { if (v.delta < vals[mi].delta) mi = ix; });
    const dmin = vals[mi].delta;
    vals.forEach((v) => { v.delta = v.delta - dmin; });
    vals[mi].isDefault = true;
    groups.push({ id: gid, label: s(o.name), nota: '', affectsPhoto: false, dependsOn: null, values: vals });
  });
  return groups;
}

function fromProductsItem(p, instId) {
  if (!p || p.kind === 'definition' || !s(p.name)) return null;
  if (p.status && p.status !== 'active') return null;
  const groups = groupsFromProducts(p);
  const imgs = [];
  (Array.isArray(p.images) ? p.images : []).forEach((u) => { const x = s(u); if (x && imgs.indexOf(x) === -1) imgs.push(x); });
  if (p.imageUrl && imgs.indexOf(s(p.imageUrl)) === -1) imgs.unshift(s(p.imageUrl));
  return {
    key: 'pr:' + instId + ':' + s(p.id),
    source: 'products', id: s(p.id), instanceId: instId,
    name: s(p.name), sku: s(p.sku), brand: s(p.brand),
    price: Number(p.price) || 0,
    compareAtPrice: Number.isFinite(Number(p.compareAtPrice)) && Number(p.compareAtPrice) > 0 ? Number(p.compareAtPrice) : null,
    imageUrl: imgs[0] || '', images: imgs,
    description: textoPlano(p.description, 900),
    specs: [], stock: typeof p.stock === 'number' ? p.stock : null,
    deliveryDays: 0, deliveryMode: 'max', leadDays: 0,
    configurable: groups.length > 0,
    groups: groups, presets: [], style: null,
  };
}

// ── Selección / precio / foto (compartido UI + agente + preview) ─────────────
function defaultVal(g) { return g.values.find((v) => v.isDefault) || g.values[0] || null; }

function seleccionResuelta(prod, sel) {
  const out = {};
  (prod.groups || []).forEach((g) => {
    const ok = g.values.some((v) => v.id === sel[g.id]);
    const d = defaultVal(g);
    out[g.id] = ok ? sel[g.id] : (d ? d.id : null);
  });
  return out;
}

function grupoVisible(prod, g, selMap) {
  const d = g.dependsOn;
  if (!d || !d.groupId || !d.valueIds.length) return true;
  const target = prod.groups.find((x) => x.id === d.groupId);
  if (!target) return true;
  return d.valueIds.indexOf(selMap[target.id]) !== -1;
}

function precioSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  let total = Number(prod.price) || 0;
  (prod.groups || []).forEach((g) => {
    if (!grupoVisible(prod, g, m)) return;
    const v = g.values.find((x) => x.id === m[g.id]);
    if (v) total += Number(v.delta) || 0;
  });
  return total;
}

function fotoSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  for (const g of prod.groups || []) {
    if (!g.affectsPhoto || !grupoVisible(prod, g, m)) continue;
    const v = g.values.find((x) => x.id === m[g.id]);
    if (v && v.imageUrl) return v.imageUrl;
  }
  return prod.imageUrl || (prod.images && prod.images[0]) || '';
}

function entregaSeleccion(prod, sel) {
  if (!prod.configurable) return prod.deliveryDays || 0;
  const m = seleccionResuelta(prod, sel);
  let dias = 0;
  (prod.groups || []).forEach((g) => {
    if (!grupoVisible(prod, g, m)) return;
    const v = g.values.find((x) => x.id === m[g.id]);
    const dd = v ? Number(v.deliveryDays) || 0 : 0;
    dias = prod.deliveryMode === 'sum' ? dias + dd : Math.max(dias, dd);
  });
  const total = dias + (prod.leadDays || 0);
  return total || prod.deliveryDays || 0;
}

// ── mount ────────────────────────────────────────────────────────────────────
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef } = React;

  const instanceId = shell.app && shell.app.instanceId;
  // La vitrina pública no expone authFetch: es la firma del host público.
  const esPublico = typeof shell.authFetch !== 'function';

  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) { return window.location.origin; }
  }
  const API = apiBase();

  // ── Estado (closure; los componentes se suscriben) ──
  let doc = {
    titulo: 'Nuestros productos',
    subtitulo: 'Toca un producto para conocerlo',
    ocultos: {},        // key → true
    categorias: {},     // key → 'Categoría'
    orden: [],          // keys en orden preferente
    fuentesOff: {},     // instanceId → true (fuente completa excluida)
    style: defaultStyle(),
    publicado: null,    // { at, count }
  };
  let catalog = { productos: [], moneda: { symbol: '$', locale: 'es-CL', decimals: 0 }, fuentes: { products: [], productlab: [] }, loading: true, error: null };
  let vista = { tab: esPublico ? 'vitrina' : 'vitrina', detalle: null, config: null, categoria: null, resumen: false };
  //   config = { key, sel: {groupId: valueId} }
  let config = Object.assign({}, DEFAULT_CONFIG);
  let pub = { estado: esPublico ? 'resolviendo' : null, iid: '', version: '', mensaje: '' };

  const listeners = new Set();
  const emitir = () => listeners.forEach((l) => { try { l({ doc: doc, catalog: catalog, vista: vista, config: config, pub: pub }); } catch (e) { /* listener roto */ } });
  const setVista = (patch) => { vista = Object.assign({}, vista, patch); emitir(); };
  const setCatalog = (patch) => { catalog = Object.assign({}, catalog, patch); emitir(); };

  const fmtMoney = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    const m = catalog.moneda;
    try { return m.symbol + v.toLocaleString(m.locale, { minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals }); }
    catch (e) { return m.symbol + String(Math.round(v)); }
  };
  const fmtDelta = (n) => (n > 0 ? '+' : '−') + fmtMoney(Math.abs(n));

  // ── Persistencia del documento (item `definition` de esta instancia) ──
  let defExiste = false;
  let saveT = null;
  function docSettings() {
    return {
      titulo: doc.titulo, subtitulo: doc.subtitulo, ocultos: doc.ocultos,
      categorias: doc.categorias, orden: doc.orden, fuentesOff: doc.fuentesOff,
      style: doc.style, publicado: doc.publicado,
    };
  }
  async function persistDoc(extra) {
    if (esPublico || !instanceId || !shell.items) return;
    const payload = Object.assign({ kind: 'definition', settings: docSettings() }, extra || {});
    try {
      if (defExiste) await shell.items.update('definition', payload);
      else { await shell.items.create(Object.assign({ id: 'definition' }, payload)); defExiste = true; }
    } catch (e) {
      shell.notify && shell.notify({ level: 'error', text: 'No se pudo guardar la configuración del tótem.' });
    }
  }
  function setDoc(patch) {
    doc = Object.assign({}, doc, patch);
    emitir();
    clearTimeout(saveT);
    saveT = setTimeout(() => { void persistDoc(); }, 700);
  }

  // ── Carga en escritorio: doc propio + catálogos vía shell.data ──
  async function loadDoc() {
    if (!shell.items) return;
    try {
      const items = await shell.items.list();
      const def = (items || []).find((i) => i && (i.id === 'definition' || i.kind === 'definition'));
      if (def) {
        defExiste = true;
        const st = def.settings || {};
        doc = Object.assign({}, doc, {
          titulo: s(st.titulo) || doc.titulo,
          subtitulo: st.subtitulo != null ? s(st.subtitulo) : doc.subtitulo,
          ocultos: st.ocultos && typeof st.ocultos === 'object' ? st.ocultos : {},
          categorias: st.categorias && typeof st.categorias === 'object' ? st.categorias : {},
          orden: Array.isArray(st.orden) ? st.orden.map(s) : [],
          fuentesOff: st.fuentesOff && typeof st.fuentesOff === 'object' ? st.fuentesOff : {},
          style: normalizeStyle(st.style),
          publicado: st.publicado || null,
        });
        emitir();
      }
    } catch (e) { /* primera vez: sin definition */ }
  }

  async function loadCatalog() {
    if (!shell.data || typeof shell.data.listInstances !== 'function') {
      setCatalog({ loading: false, error: 'Este host no expone shell.data: no es posible leer los catálogos.' });
      return;
    }
    setCatalog({ loading: true, error: null });
    const productos = [];
    const fuentes = { products: [], productlab: [] };
    let moneda = null;
    const linkedStoreItemIds = new Set();
    try {
      const pInsts = (await shell.data.listInstances('products').catch(() => [])) || [];
      const plInsts = (await shell.data.listInstances('productlab').catch(() => [])) || [];

      // Items de products por instancia (también alimentan el modo precio 'store' de PL).
      const storeItemsGlobal = new Map();
      const productsPorInst = [];
      for (const inst of pInsts) {
        try {
          const items = (await shell.data.listItems(inst.id)) || [];
          const reales = items.filter((p) => p && p.kind !== 'definition' && s(p.name));
          reales.forEach((p) => storeItemsGlobal.set(s(p.id), p));
          productsPorInst.push({ inst: inst, items: reales });
          fuentes.products.push({ id: inst.id, name: s(inst.name) || inst.id, count: reales.length });
        } catch (e) { /* instancia sin acceso: no tumbar el resto */ }
      }

      for (const inst of plInsts) {
        try {
          const items = (await shell.data.listItems(inst.id)) || [];
          const def = items.find((i) => i && (i.id === 'definition' || i.kind === 'definition'));
          const comps = items.filter((i) => i && i.kind === 'component');
          const prods = items.filter((i) => i && (i.kind === 'producto' || i.kind === 'equipo'));
          prods.forEach((eq) => { if (eq.storeRef && eq.storeRef.itemId) linkedStoreItemIds.add(s(eq.storeRef.itemId)); });
          const pubData = def && def.public && def.public.enabled && def.public.data && Array.isArray(def.public.data.productos) ? def.public.data : null;
          if (def && def.rules && !moneda) {
            const r = plRules(def.rules);
            moneda = { symbol: r.currencySymbol, locale: r.locale, decimals: r.currencyDecimals };
          }
          let n = 0;
          if (pubData) {
            pubData.productos.forEach((pp) => { const x = fromPublicPL(pp, inst.id); if (x) { productos.push(x); n++; } });
          } else {
            const engine = plEngine(def, comps);
            prods.forEach((eq) => { const x = fromRawPL(eq, engine, inst.id, storeItemsGlobal); if (x) { productos.push(x); n++; } });
          }
          fuentes.productlab.push({ id: inst.id, name: s(inst.name) || inst.id, count: n, publicado: !!pubData });
        } catch (e) { /* instancia sin acceso */ }
      }

      // Products: omitir los que ya entran como personalizables vía ProductLab.
      for (const par of productsPorInst) {
        par.items.forEach((p) => {
          if (linkedStoreItemIds.has(s(p.id))) return;
          const x = fromProductsItem(p, par.inst.id);
          if (x) productos.push(x);
        });
      }

      setCatalog({
        productos: productos,
        fuentes: fuentes,
        moneda: moneda || catalog.moneda,
        loading: false,
        error: null,
      });
    } catch (e) {
      setCatalog({ loading: false, error: (e && e.message) || 'No se pudieron leer los catálogos.' });
    }
  }

  // ── Lista visible (curación aplicada) ──
  function productosVisibles() {
    const orden = doc.orden || [];
    const idx = new Map(orden.map((k, i) => [k, i]));
    return catalog.productos
      .filter((p) => !doc.ocultos[p.key] && !doc.fuentesOff[p.instanceId])
      .map((p) => (doc.categorias[p.key] ? Object.assign({}, p, { categoria: s(doc.categorias[p.key]) }) : Object.assign({}, p, { categoria: s(p.categoria || '') })))
      .sort((a, b) => {
        const ia = idx.has(a.key) ? idx.get(a.key) : 1e9;
        const ib = idx.has(b.key) ? idx.get(b.key) : 1e9;
        return ia !== ib ? ia - ib : a.name.localeCompare(b.name);
      });
  }
  function categoriasVisibles(lista) {
    const seen = [];
    (lista || productosVisibles()).forEach((p) => {
      const c = s(p.categoria).trim();
      if (c && seen.indexOf(c) === -1) seen.push(c);
    });
    return seen;
  }

  // ── Publicación (snapshot público para la vitrina) ──
  function buildSnapshot() {
    const lista = productosVisibles().map((p) => ({
      key: p.key, source: p.source, id: p.id, instanceId: p.instanceId,
      name: p.name, sku: p.sku, brand: p.brand, categoria: p.categoria || '',
      price: p.price, compareAtPrice: p.compareAtPrice,
      imageUrl: p.imageUrl, images: p.images.slice(0, 12),
      description: p.description, specs: p.specs,
      stock: p.stock, deliveryDays: p.deliveryDays, deliveryMode: p.deliveryMode, leadDays: p.leadDays,
      configurable: p.configurable, groups: p.groups, presets: p.presets, style: p.style,
    }));
    return {
      version: 1, app: 'totem-productos', appVersion: APP_VERSION, updatedAt: nowIso(),
      titulo: doc.titulo, subtitulo: doc.subtitulo, moneda: catalog.moneda,
      style: doc.style, productos: lista,
    };
  }
  async function publicar() {
    if (esPublico) return { success: false, error: 'Publicar solo está disponible en el escritorio.' };
    const data = buildSnapshot();
    const publicado = { at: data.updatedAt, count: data.productos.length };
    doc = Object.assign({}, doc, { publicado: publicado });
    try {
      await persistDoc({ public: { enabled: true, channels: [], data: data } });
      emitir();
      shell.notify && shell.notify({ level: 'success', text: 'Vitrina publicada: ' + data.productos.length + ' producto(s).' });
      return { success: true, message: 'Vitrina publicada con ' + data.productos.length + ' producto(s).' };
    } catch (e) {
      return { success: false, error: 'No se pudo publicar.' };
    }
  }
  async function despublicar() {
    doc = Object.assign({}, doc, { publicado: null });
    await persistDoc({ public: { enabled: false, channels: [], data: null } });
    emitir();
  }

  // ── Modo vitrina pública: consumir el snapshot publicado ──
  function aplicarSnapshot(data, iid) {
    const productos = (Array.isArray(data.productos) ? data.productos : []).map((p) => Object.assign({}, p, {
      images: Array.isArray(p.images) ? p.images : [],
      groups: Array.isArray(p.groups) ? p.groups : [],
      presets: Array.isArray(p.presets) ? p.presets : [],
      specs: Array.isArray(p.specs) ? p.specs : [],
    }));
    doc = Object.assign({}, doc, {
      titulo: s(data.titulo) || doc.titulo,
      subtitulo: s(data.subtitulo),
      style: normalizeStyle(data.style),
      ocultos: {}, categorias: {}, orden: [], fuentesOff: {},
    });
    catalog = Object.assign({}, catalog, {
      productos: productos,
      moneda: data.moneda && data.moneda.symbol ? data.moneda : catalog.moneda,
      loading: false, error: null,
    });
    pub = Object.assign({}, pub, { estado: 'ok', iid: iid, version: s(data.updatedAt) });
    emitir();
  }

  function catalogoIdInicial() {
    try {
      const qs = new URLSearchParams(window.location.search);
      const q = s(qs.get('catalogo') || qs.get('instancia')).trim();
      if (q) return q;
    } catch (e) { /* sin URL */ }
    try { return s(window.localStorage.getItem(LS_ID)); } catch (e) { return ''; }
  }

  async function conectarCatalogo(iid) {
    const id = s(iid).trim();
    if (!id) { pub = Object.assign({}, pub, { estado: 'setup', mensaje: '' }); emitir(); return false; }
    pub = Object.assign({}, pub, { estado: 'cargando', iid: id, mensaje: '' }); emitir();
    try {
      const res = await fetch(API + '/api/public/app/' + encodeURIComponent(id) + '/definition', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      const data = body && body.data;
      if (!data || !Array.isArray(data.productos)) throw new Error('La instancia no publica un catálogo de Totem de Productos.');
      try {
        window.localStorage.setItem(LS_ID, id);
        window.localStorage.setItem(LS_CACHE, JSON.stringify({ iid: id, data: data }));
      } catch (e) { /* almacenamiento no disponible */ }
      aplicarSnapshot(data, id);
      return true;
    } catch (e) {
      // Respaldo sin red: el último snapshot cacheado en este equipo.
      try {
        const raw = window.localStorage.getItem(LS_CACHE);
        const cache = raw ? JSON.parse(raw) : null;
        if (cache && cache.data && (!id || cache.iid === id)) {
          aplicarSnapshot(cache.data, cache.iid);
          pub = Object.assign({}, pub, { mensaje: 'Sin conexión: mostrando la última copia guardada.' });
          emitir();
          return true;
        }
      } catch (e2) { /* sin caché */ }
      pub = Object.assign({}, pub, { estado: 'setup', mensaje: (e && e.message) || 'No se pudo cargar el catálogo.' });
      emitir();
      return false;
    }
  }

  async function refrescarPublico() {
    if (pub.estado !== 'ok' || !pub.iid) return;
    try {
      const res = await fetch(API + '/api/public/app/' + encodeURIComponent(pub.iid) + '/definition/version', { cache: 'no-store' });
      if (!res.ok) return;
      const v = JSON.stringify(await res.json());
      if (pub.faro && pub.faro === v) return;
      pub = Object.assign({}, pub, { faro: v });
      await conectarCatalogo(pub.iid);
    } catch (e) { /* sin red: seguimos con lo que hay */ }
  }

  // ── Navegación (compartida por UI y agente: las acciones mueven la pantalla) ──
  function buscarProducto(ref) {
    const key = s(ref).trim();
    if (!key) return null;
    const lista = productosVisibles();
    const needle = norm(key);
    return lista.find((p) => p.key === key || p.id === key)
      || lista.find((p) => norm(p.name) === needle)
      || lista.find((p) => norm(p.sku) === needle && needle)
      || lista.find((p) => norm(p.name).indexOf(needle) !== -1)
      || null;
  }
  function volverAlInicio() {
    if (vista.tab === 'vitrina' && !vista.detalle && !vista.config && !vista.categoria && !vista.resumen) return;
    setVista({ tab: 'vitrina', detalle: null, config: null, categoria: null, resumen: false });
  }
  function irATab(tab) { marcarActividad(); setVista({ tab: tab, detalle: null, config: null, resumen: false }); }
  function abrirProducto(p) { marcarActividad(); setVista({ tab: 'vitrina', detalle: p.key, config: null, resumen: false }); }
  function cerrarCapas() { marcarActividad(); setVista({ detalle: null, config: null, resumen: false }); }
  function filtrarCategoria(cat) { marcarActividad(); setVista({ categoria: cat || null, detalle: null, config: null, resumen: false }); }
  function abrirPersonalizacion(p) {
    marcarActividad();
    if (!p.configurable) { setVista({ tab: 'vitrina', detalle: p.key, config: null }); return; }
    setVista({ tab: 'vitrina', detalle: null, resumen: false, config: { key: p.key, sel: {} } });
  }
  function elegirValor(groupId, valueId) {
    if (!vista.config) return;
    marcarActividad();
    const sel = Object.assign({}, vista.config.sel);
    sel[groupId] = valueId;
    setVista({ config: Object.assign({}, vista.config, { sel: sel }) });
  }
  function aplicarPreset(p, preset) {
    marcarActividad();
    setVista({ tab: 'vitrina', detalle: null, resumen: false, config: { key: p.key, sel: Object.assign({}, preset.sel) } });
  }
  function verResumen() { if (vista.config) { marcarActividad(); setVista({ resumen: true }); } }

  // ── Inactividad: volver al inicio (solo tótem / vitrina pública) ──
  let inactT = null;
  let modoActual = 'escritorio';
  function marcarActividad() {
    clearTimeout(inactT);
    if (!esPublico && modoActual !== 'totem') return;
    const seg = clampN(config.segundosInactividad, 15, 600, DEFAULT_CONFIG.segundosInactividad);
    inactT = setTimeout(volverAlInicio, seg * 1000);
  }

  // ── Config del host (⚙) ──
  const aplicarConfig = (v) => { config = Object.assign({}, DEFAULT_CONFIG, v || {}); emitir(); marcarActividad(); };
  let offConfig = null;
  if (shell.config && shell.config.get) {
    Promise.resolve(shell.config.get()).then(aplicarConfig).catch(() => {});
    if (shell.config.onChange) offConfig = shell.config.onChange(aplicarConfig);
  }
  if (shell.window && shell.window.setTitle) { try { shell.window.setTitle('Totem de Productos'); } catch (e) { /* sin título */ } }

  // ── Agente IA: las respuestas ejecutan acciones en pantalla ──
  function snapshotAgente() {
    const lista = productosVisibles();
    const cats = categoriasVisibles(lista);
    let personalizacion = null;
    if (vista.config) {
      const p = lista.find((x) => x.key === vista.config.key);
      if (p) {
        const m = seleccionResuelta(p, vista.config.sel);
        personalizacion = {
          producto: p.name,
          precio: fmtMoney(precioSeleccion(p, vista.config.sel)),
          seleccion: p.groups.filter((g) => grupoVisible(p, g, m)).map((g) => {
            const v = g.values.find((x) => x.id === m[g.id]);
            return { paso: g.label, valor: v ? v.name : null };
          }),
        };
      }
    }
    return {
      version: APP_VERSION,
      modo: esPublico ? 'vitrina-publica' : 'escritorio',
      pantalla: {
        pestana: vista.tab,
        categoriaFiltrada: vista.categoria,
        productoAbierto: vista.detalle ? (lista.find((x) => x.key === vista.detalle) || {}).name || null : null,
        personalizacionEnCurso: personalizacion,
        resumenAbierto: vista.resumen,
      },
      categorias: cats,
      productos: lista.slice(0, 80).map((p) => ({
        id: p.key, nombre: p.name, sku: p.sku, categoria: p.categoria || null,
        precio: fmtMoney(p.price), personalizable: p.configurable,
        pasos: p.configurable ? p.groups.map((g) => ({ paso: g.label, valores: g.values.slice(0, 24).map((v) => v.name) })) : undefined,
      })),
      instrucciones: 'Eres el anfitrión de un tótem táctil de productos para atención al cliente. '
        + 'Cuando la persona pida VER un producto, EJECUTA MOSTRAR_PRODUCTO (la ficha se abre en pantalla) y resume sus datos. '
        + 'Para personalizar, EJECUTA ABRIR_PERSONALIZACION y luego ELEGIR_OPCION por cada paso que la persona decida; el precio en pantalla se actualiza solo. '
        + 'Usa FILTRAR_CATEGORIA para acotar la grilla y VOLVER_AL_INICIO al terminar. Responde breve y en el idioma de la persona.',
    };
  }

  async function dispatchAction(action) {
    try {
      const tipo = action && action.type;
      const p = (action && action.payload) || {};
      switch (tipo) {
        case 'LISTAR_PRODUCTOS': {
          let lista = productosVisibles();
          if (p.categoria) lista = lista.filter((x) => norm(x.categoria) === norm(p.categoria));
          return { success: true, message: lista.length + ' producto(s).', data: lista.slice(0, 60).map((x) => ({ id: x.key, nombre: x.name, precio: fmtMoney(x.price), personalizable: x.configurable })) };
        }
        case 'MOSTRAR_PRODUCTO': {
          const prod = buscarProducto(p.producto || p.id || p.nombre);
          if (!prod) return { success: false, error: 'No encontré ese producto. Pídeme la lista con LISTAR_PRODUCTOS.' };
          abrirProducto(prod);
          return { success: true, message: 'Mostrando "' + prod.name + '" (' + fmtMoney(prod.price) + ').' };
        }
        case 'FILTRAR_CATEGORIA': {
          const cat = s(p.categoria).trim();
          if (!cat || norm(cat) === 'todos' || norm(cat) === 'todas') { filtrarCategoria(null); return { success: true, message: 'Mostrando todos los productos.' }; }
          const cats = categoriasVisibles();
          const found = cats.find((c) => norm(c) === norm(cat)) || cats.find((c) => norm(c).indexOf(norm(cat)) !== -1);
          if (!found) return { success: false, error: 'Categoría desconocida. Válidas: ' + (cats.join(', ') || '(ninguna)') + '.' };
          filtrarCategoria(found);
          return { success: true, message: 'Filtrando por "' + found + '".' };
        }
        case 'ABRIR_PERSONALIZACION': {
          const prod = buscarProducto(p.producto || p.id || p.nombre) || (vista.detalle ? buscarProducto(vista.detalle) : null);
          if (!prod) return { success: false, error: 'Indica qué producto personalizar (id o nombre).' };
          if (!prod.configurable) return { success: false, error: '"' + prod.name + '" no tiene personalización; abrí su ficha.' };
          abrirPersonalizacion(prod);
          return { success: true, message: 'Personalizando "' + prod.name + '": ' + prod.groups.map((g) => g.label).join(' → ') + '.' };
        }
        case 'ELEGIR_OPCION': {
          let cfg = vista.config;
          let prod = cfg ? buscarProducto(cfg.key) : null;
          if (p.producto && (!prod || norm(prod.name) !== norm(p.producto))) {
            const otro = buscarProducto(p.producto);
            if (otro && otro.configurable) { abrirPersonalizacion(otro); prod = otro; cfg = vista.config; }
          }
          if (!prod || !cfg) return { success: false, error: 'No hay personalización en curso: usa ABRIR_PERSONALIZACION primero.' };
          const g = prod.groups.find((x) => norm(x.label) === norm(p.paso)) || prod.groups.find((x) => x.id === s(p.paso)) || prod.groups.find((x) => norm(x.label).indexOf(norm(p.paso)) !== -1);
          if (!g) return { success: false, error: 'Paso desconocido. Pasos: ' + prod.groups.map((x) => x.label).join(', ') + '.' };
          const v = g.values.find((x) => norm(x.name) === norm(p.valor)) || g.values.find((x) => x.id === s(p.valor)) || g.values.find((x) => norm(x.name).indexOf(norm(p.valor)) !== -1);
          if (!v) return { success: false, error: 'Valor desconocido en "' + g.label + '". Opciones: ' + g.values.map((x) => x.name).join(', ') + '.' };
          elegirValor(g.id, v.id);
          const precio = precioSeleccion(prod, Object.assign({}, cfg.sel, (function () { const o = {}; o[g.id] = v.id; return o; })()));
          return { success: true, message: g.label + ': ' + v.name + (v.delta ? ' (' + fmtDelta(v.delta) + ')' : '') + '. Precio actual: ' + fmtMoney(precio) + '.' };
        }
        case 'APLICAR_PRESET': {
          const prod = buscarProducto(p.producto || (vista.config && vista.config.key) || vista.detalle);
          if (!prod) return { success: false, error: 'Indica el producto del preset.' };
          const pre = (prod.presets || []).find((x) => norm(x.name) === norm(p.preset)) || (prod.presets || []).find((x) => x.id === s(p.preset));
          if (!pre) return { success: false, error: 'Preset desconocido. Disponibles: ' + (prod.presets || []).map((x) => x.name).join(', ') + '.' };
          aplicarPreset(prod, pre);
          return { success: true, message: 'Aplicada la configuración "' + pre.name + '" (' + fmtMoney(precioSeleccion(prod, pre.sel)) + ').' };
        }
        case 'VER_RESUMEN': {
          if (!vista.config) return { success: false, error: 'No hay personalización en curso.' };
          verResumen();
          return { success: true, message: 'Mostrando el resumen de la configuración.' };
        }
        case 'CERRAR': cerrarCapas(); return { success: true, message: 'Cerrado.' };
        case 'VOLVER_AL_INICIO': volverAlInicio(); marcarActividad(); return { success: true, message: 'De vuelta al inicio.' };
        case 'IR_A_PESTANA': {
          if (esPublico) return { success: false, error: 'En la vitrina pública solo existe la vista de productos.' };
          const tab = ['vitrina', 'catalogo', 'estilos', 'publicacion'].indexOf(p.pestana) !== -1 ? p.pestana : null;
          if (!tab) return { success: false, error: 'Pestañas: vitrina, catalogo, estilos, publicacion.' };
          irATab(tab);
          return { success: true, message: 'Pestaña "' + tab + '" abierta.' };
        }
        case 'PUBLICAR_VITRINA': return publicar();
        default: return { success: false, error: 'Acción desconocida en Totem de Productos: ' + s(tipo) };
      }
    } catch (e) {
      return { success: false, error: (e && e.message) || 'Error inesperado.' };
    }
  }

  const AGENT_TOOLS = [
    { name: 'LISTAR_PRODUCTOS', description: 'Lista los productos visibles (opcionalmente por categoría). Solo lectura.', inputSchema: { type: 'object', properties: { categoria: { type: 'string' } } } },
    { name: 'MOSTRAR_PRODUCTO', description: 'Abre EN PANTALLA la ficha de un producto (por id, sku o nombre).', inputSchema: { type: 'object', properties: { producto: { type: 'string' } }, required: ['producto'] } },
    { name: 'FILTRAR_CATEGORIA', description: 'Filtra la grilla por categoría ("todos" para quitar el filtro).', inputSchema: { type: 'object', properties: { categoria: { type: 'string' } }, required: ['categoria'] } },
    { name: 'ABRIR_PERSONALIZACION', description: 'Abre el paso a paso de personalización de un producto configurable.', inputSchema: { type: 'object', properties: { producto: { type: 'string' } } } },
    { name: 'ELEGIR_OPCION', description: 'Selecciona un valor en un paso de la personalización en curso; el precio en pantalla se actualiza.', inputSchema: { type: 'object', properties: { producto: { type: 'string' }, paso: { type: 'string' }, valor: { type: 'string' } }, required: ['paso', 'valor'] } },
    { name: 'APLICAR_PRESET', description: 'Aplica una configuración sugerida (preset) de un producto.', inputSchema: { type: 'object', properties: { producto: { type: 'string' }, preset: { type: 'string' } }, required: ['preset'] } },
    { name: 'VER_RESUMEN', description: 'Muestra el resumen (selección y precio) de la personalización en curso.', inputSchema: { type: 'object', properties: {} } },
    { name: 'CERRAR', description: 'Cierra la ficha o el configurador abierto.', inputSchema: { type: 'object', properties: {} } },
    { name: 'VOLVER_AL_INICIO', description: 'Vuelve a la grilla inicial de productos.', inputSchema: { type: 'object', properties: {} } },
    { name: 'IR_A_PESTANA', description: 'Solo escritorio: navega entre las pestañas de gestión.', inputSchema: { type: 'object', properties: { pestana: { type: 'string', enum: ['vitrina', 'catalogo', 'estilos', 'publicacion'] } }, required: ['pestana'] } },
    { name: 'PUBLICAR_VITRINA', description: 'Solo escritorio: publica el catálogo curado para la vitrina/tótem.', inputSchema: { type: 'object', properties: {} } },
  ];

  let offAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    try {
      offAgent = shell.agent.register({
        label: 'Totem de Productos',
        description: 'Vitrina táctil del catálogo: mostrar productos, filtrar, personalizar paso a paso y publicar.',
        tools: AGENT_TOOLS,
        getSnapshot: snapshotAgente,
        dispatchAction: dispatchAction,
      });
    } catch (e) { /* agente no disponible */ }
  }

  // ── Arranque ──
  let refreshT = null;
  if (esPublico) {
    void conectarCatalogo(catalogoIdInicial());
    refreshT = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refrescarPublico();
    }, 45000);
  } else {
    void loadDoc().then(loadCatalog);
    refreshT = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void loadCatalog();
    }, 60000);
  }
  marcarActividad();

  // ── Documentos (🗂 Guardar versión / restaurar) ──
  if (shell.documents && shell.documents.onSerialize) {
    try {
      shell.documents.onSerialize(() => ({ settings: docSettings() }));
      shell.documents.onLoad((cfg) => {
        if (cfg && cfg.settings) {
          doc = Object.assign({}, doc, cfg.settings, { style: normalizeStyle(cfg.settings.style) });
          emitir();
        }
      });
    } catch (e) { /* opcional */ }
  }

  // ══ UI ══════════════════════════════════════════════════════════════════════

  function useEstado() {
    const [, force] = useState(0);
    useEffect(() => {
      const fn = () => force((n) => n + 1);
      listeners.add(fn);
      return () => listeners.delete(fn);
    }, []);
  }

  function Imagen(props) {
    // props: {src, alt, className, fit}
    if (!props.src) return h('div', { className: 'tp-img tp-img-vacia ' + (props.className || '') }, '🛍️');
    return h('div', { className: 'tp-img ' + (props.className || '') },
      h('img', { src: props.src, alt: props.alt || '', loading: 'lazy', style: { objectFit: props.fit || 'cover' } }));
  }

  function PrecioTag(props) {
    // props: {prod, style}
    const st = props.style;
    if (!st.mostrarPrecios) return null;
    return h('div', { className: 'tp-precio' },
      props.prod.compareAtPrice ? h('s', { className: 'tp-precio-antes' }, fmtMoney(props.prod.compareAtPrice)) : null,
      h('span', null, fmtMoney(props.prod.price)),
      props.prod.configurable ? h('span', { className: 'tp-precio-desde' }, 'desde') : null);
  }

  // ── Tarjeta / fila de producto ──
  function CardProducto(props) {
    const p = props.prod, st = props.style;
    const esLista = st.cardStyle === 'lista';
    return h('button', {
      className: 'tp-card' + (esLista ? ' tp-card-lista' : ''),
      onClick: () => abrirProducto(p),
    },
      h(Imagen, { src: p.imageUrl, alt: p.name, className: esLista ? 'tp-card-thumb' : 'tp-card-img', fit: st.fit }),
      h('div', { className: 'tp-card-body' },
        h('div', { className: 'tp-card-nombre' }, p.name),
        st.mostrarSku && p.sku ? h('div', { className: 'tp-card-sku' }, p.sku) : null,
        p.categoria ? h('div', { className: 'tp-card-cat' }, p.categoria) : null,
        h(PrecioTag, { prod: p, style: st }),
        st.mostrarStock && p.stock != null ? h('div', { className: 'tp-card-stock' }, p.stock > 0 ? 'Disponible' : 'Agotado') : null,
        p.configurable ? h('div', { className: 'tp-card-badge' }, '✨ Personalizable') : null));
  }

  // ── Ficha del producto (overlay) ──
  function Detalle(props) {
    const p = props.prod, st = props.style;
    const [foto, setFoto] = useState(0);
    const imgs = p.images && p.images.length ? p.images : (p.imageUrl ? [p.imageUrl] : []);
    const grupos = {};
    p.specs.forEach((x) => { const g = x.group || ''; (grupos[g] = grupos[g] || []).push(x); });
    return h('div', { className: 'tp-overlay', onClick: cerrarCapas },
      h('div', { className: 'tp-panel', onClick: (e) => e.stopPropagation() },
        h('button', { className: 'tp-cerrar', onClick: cerrarCapas, 'aria-label': 'Cerrar' }, '✕'),
        h('div', { className: 'tp-panel-scroll' },
          h('div', { className: 'tp-visor' },
            h(Imagen, { src: imgs[foto] || '', alt: p.name, className: 'tp-visor-img', fit: 'contain' }),
            imgs.length > 1 ? h('div', { className: 'tp-visor-thumbs' }, imgs.slice(0, 8).map((u, i) =>
              h('button', { key: i, className: 'tp-thumb' + (i === foto ? ' activa' : ''), onClick: () => { marcarActividad(); setFoto(i); } },
                h('img', { src: u, alt: '', loading: 'lazy' })))) : null),
          h('div', { className: 'tp-det-nombre' }, p.name),
          st.mostrarSku && p.sku ? h('div', { className: 'tp-det-sku' }, 'SKU ' + p.sku) : null,
          h('div', { className: 'tp-det-precio' },
            p.compareAtPrice ? h('s', { className: 'tp-precio-antes' }, fmtMoney(p.compareAtPrice)) : null,
            st.mostrarPrecios ? h('span', null, fmtMoney(p.price) + (p.configurable ? ' · base' : '')) : null),
          p.deliveryDays ? h('div', { className: 'tp-det-meta' }, '🚚 Entrega estimada: ' + p.deliveryDays + ' días') : null,
          st.mostrarStock && p.stock != null ? h('div', { className: 'tp-det-meta' }, p.stock > 0 ? '✔ Disponible' : '✖ Agotado por ahora') : null,
          p.description ? h('p', { className: 'tp-det-desc' }, p.description) : null,
          p.presets.length ? h('div', { className: 'tp-det-seccion' },
            h('div', { className: 'tp-det-h' }, 'Configuraciones sugeridas'),
            h('div', { className: 'tp-presets' }, p.presets.map((pre) =>
              h('button', { key: pre.id, className: 'tp-preset', onClick: () => aplicarPreset(p, pre) },
                pre.imageUrl ? h('img', { src: pre.imageUrl, alt: '' }) : null,
                h('span', null, pre.name),
                st.mostrarPrecios ? h('em', null, fmtMoney(precioSeleccion(p, pre.sel))) : null)))) : null,
          p.specs.length ? h('div', { className: 'tp-det-seccion' },
            h('div', { className: 'tp-det-h' }, 'Especificaciones'),
            Object.keys(grupos).map((g) => h('div', { key: g || '_' },
              g ? h('div', { className: 'tp-spec-grupo' }, g) : null,
              h('table', { className: 'tp-specs' }, h('tbody', null, grupos[g].map((x, i) =>
                h('tr', { key: i }, h('td', null, x.label), h('td', null, x.value)))))))) : null,
          !p.configurable ? h('div', { className: 'tp-det-nota' }, 'Consulta con nuestro equipo para más detalles de este producto.') : null),
        p.configurable ? h('div', { className: 'tp-panel-pie' },
          h('button', { className: 'tp-btn tp-btn-acc tp-btn-xl', onClick: () => abrirPersonalizacion(p) },
            '✨ ' + (st.ctaLabel || 'Personalizar'))) : null));
  }

  // ── Configurador paso a paso (overlay) ──
  function Configurador(props) {
    const p = props.prod, st = props.style, cfg = props.cfg;
    const m = seleccionResuelta(p, cfg.sel);
    const visibles = p.groups.filter((g) => grupoVisible(p, g, m));
    const precio = precioSeleccion(p, cfg.sel);
    const entrega = entregaSeleccion(p, cfg.sel);
    const foto = fotoSeleccion(p, cfg.sel);
    // El estilo propio del producto (ProductLab) puede matizar acento y radio.
    const propio = st.respetarEstiloProducto && p.style ? p.style : null;
    const vars = {};
    if (propio && propio.accentColor) {
      vars['--tp-acc'] = propio.accentColor;
      vars['--tp-acc-fg'] = isDarkHex(propio.accentColor) ? '#fff' : '#101318';
    }
    if (propio && propio.radius != null) vars['--tp-radius'] = propio.radius + 'px';

    const resumenFilas = visibles.map((g) => {
      const v = g.values.find((x) => x.id === m[g.id]);
      return { paso: g.label, valor: v ? v.name : '—', delta: v ? v.delta : 0 };
    });

    return h('div', { className: 'tp-overlay' },
      h('div', { className: 'tp-panel tp-panel-cfg', style: vars, onClick: (e) => e.stopPropagation() },
        h('button', { className: 'tp-cerrar', onClick: cerrarCapas, 'aria-label': 'Cerrar' }, '✕'),
        h('div', { className: 'tp-panel-scroll' },
          h('div', { className: 'tp-cfg-head' },
            h(Imagen, { src: foto, alt: p.name, className: 'tp-cfg-foto', fit: 'contain' }),
            h('div', { className: 'tp-cfg-titulo' },
              h('div', { className: 'tp-det-nombre' }, p.name),
              h('div', { className: 'tp-cfg-sub' }, 'Elige cada paso: el precio se actualiza al instante.'))),
          visibles.map((g, gi) => h('div', { key: g.id, className: 'tp-paso' },
            h('div', { className: 'tp-paso-h' },
              h('span', { className: 'tp-paso-num' }, String(gi + 1)),
              h('span', { className: 'tp-paso-label' }, g.label)),
            g.nota ? h('div', { className: 'tp-paso-nota' }, g.nota) : null,
            h('div', { className: 'tp-ops' }, g.values.map((v) => {
              const activa = m[g.id] === v.id;
              const chip = st.mostrarDeltas === 'none' || !st.mostrarPrecios ? null
                : st.mostrarDeltas === 'total' ? fmtMoney(precioSeleccion(p, Object.assign({}, cfg.sel, (function () { const o = {}; o[g.id] = v.id; return o; })())))
                : (v.delta ? fmtDelta(v.delta) : 'incluido');
              return h('button', {
                key: v.id,
                className: 'tp-op' + (activa ? ' activa' : ''),
                onClick: () => elegirValor(g.id, v.id),
              },
                v.imageUrl ? h('span', { className: 'tp-op-img' }, h('img', { src: v.imageUrl, alt: '', loading: 'lazy' }))
                  : v.swatchColor ? h('span', { className: 'tp-op-swatch', style: { background: v.swatchColor } })
                  : null,
                h('span', { className: 'tp-op-txt' },
                  h('span', { className: 'tp-op-nombre' }, v.name),
                  v.desc ? h('span', { className: 'tp-op-desc' }, v.desc) : null),
                chip != null ? h('span', { className: 'tp-op-delta' + (activa ? ' activa' : '') }, chip) : null);
            })))),
          h('div', { className: 'tp-cfg-final' }, 'Cuando termines, muestra el resumen a nuestro equipo para continuar.')),
        h('div', { className: 'tp-panel-pie tp-cfg-pie' },
          h('div', { className: 'tp-cfg-total' },
            st.mostrarPrecios ? h('strong', null, fmtMoney(precio)) : h('strong', null, p.name),
            entrega ? h('span', null, '🚚 ~' + entrega + ' días') : null),
          h('button', { className: 'tp-btn tp-btn-acc tp-btn-xl', onClick: verResumen }, 'Ver resumen')),
        cfg && vista.resumen ? h('div', { className: 'tp-overlay tp-overlay-int', onClick: () => setVista({ resumen: false }) },
          h('div', { className: 'tp-panel tp-panel-resumen', onClick: (e) => e.stopPropagation() },
            h('button', { className: 'tp-cerrar', onClick: () => { marcarActividad(); setVista({ resumen: false }); } }, '✕'),
            h('div', { className: 'tp-panel-scroll' },
              h('div', { className: 'tp-det-h' }, 'Tu configuración'),
              h('div', { className: 'tp-det-nombre tp-resumen-nombre' }, p.name),
              h('table', { className: 'tp-specs tp-resumen-tabla' }, h('tbody', null,
                resumenFilas.map((r, i) => h('tr', { key: i },
                  h('td', null, r.paso),
                  h('td', null, r.valor),
                  st.mostrarPrecios && st.mostrarDeltas !== 'none' ? h('td', { className: 'tp-resumen-delta' }, r.delta ? fmtDelta(r.delta) : '—') : null)))),
              st.mostrarPrecios ? h('div', { className: 'tp-resumen-total' }, 'Total: ' + fmtMoney(precio)) : null,
              entrega ? h('div', { className: 'tp-det-meta' }, '🚚 Entrega estimada: ~' + entrega + ' días') : null,
              h('div', { className: 'tp-det-nota' }, 'Muéstrale esta pantalla a una persona de nuestro equipo para continuar con tu pedido.')),
            h('div', { className: 'tp-panel-pie' },
              h('button', { className: 'tp-btn', onClick: () => { marcarActividad(); setVista({ resumen: false }); } }, 'Seguir editando'),
              h('button', { className: 'tp-btn tp-btn-acc', onClick: volverAlInicio }, 'Terminar')))) : null));
  }

  // ── Vista principal del tótem ──
  function TotemView(props) {
    const st = props.style;
    const lista = props.productos.filter((p) => !props.categoria || norm(p.categoria) === norm(props.categoria));
    const cats = categoriasVisibles(props.productos);
    const detalle = vista.detalle ? props.productos.find((p) => p.key === vista.detalle) : null;
    const cfgProd = vista.config ? props.productos.find((p) => p.key === vista.config.key) : null;
    return h('div', { className: 'tp-totem' },
      h('header', { className: 'tp-hero' },
        h('div', { className: 'tp-hero-titulo' }, props.titulo),
        props.subtitulo ? h('div', { className: 'tp-hero-sub' }, props.subtitulo) : null),
      cats.length ? h('nav', { className: 'tp-cats' },
        h('button', { className: 'tp-cat' + (!props.categoria ? ' activa' : ''), onClick: () => filtrarCategoria(null) }, 'Todos'),
        cats.map((c) => h('button', {
          key: c, className: 'tp-cat' + (norm(props.categoria) === norm(c) ? ' activa' : ''),
          onClick: () => filtrarCategoria(norm(props.categoria) === norm(c) ? null : c),
        }, c))) : null,
      h('main', { className: 'tp-cuerpo' },
        lista.length
          ? h('div', { className: 'tp-grid' + (st.cardStyle === 'lista' ? ' tp-grid-lista' : ''), style: { '--tp-cols': st.cols } },
              lista.map((p) => h(CardProducto, { key: p.key, prod: p, style: st })))
          : h('div', { className: 'tp-vacio' },
              h('div', { className: 'tp-vacio-ico' }, '🛍️'),
              h('div', null, props.categoria ? 'No hay productos en esta categoría.' : 'Aún no hay productos para mostrar.'))),
      detalle ? h(Detalle, { prod: detalle, style: st }) : null,
      cfgProd ? h(Configurador, { prod: cfgProd, style: st, cfg: vista.config }) : null);
  }

  // ── Pantalla de conexión (vitrina pública sin catálogo configurado) ──
  function Setup() {
    const [id, setId] = useState(pub.iid || '');
    return h('div', { className: 'tp-setup' },
      h('div', { className: 'tp-setup-card' },
        h('div', { className: 'tp-setup-ico' }, '🛍️'),
        h('div', { className: 'tp-setup-t' }, 'Totem de Productos'),
        h('p', null, 'Conecta este tótem a un catálogo publicado: pega el ID de la instancia (pestaña Publicación de la app en el escritorio) o agrega ', h('code', null, '?catalogo=ID'), ' a la URL de la vitrina.'),
        pub.mensaje ? h('div', { className: 'tp-setup-err' }, pub.mensaje) : null,
        h('input', {
          className: 'tp-input', value: id, placeholder: 'ID de la instancia del catálogo',
          onChange: (e) => setId(e.target.value),
        }),
        h('button', { className: 'tp-btn tp-btn-acc tp-btn-xl', disabled: !id.trim(), onClick: () => conectarCatalogo(id) }, 'Conectar'),
        h('div', { className: 'tp-setup-ver' }, 'v' + APP_VERSION)));
  }

  // ── Pestaña Catálogo (escritorio) ──
  function CatalogoTab() {
    const visibles = new Set(productosVisibles().map((p) => p.key));
    const todos = catalog.productos.slice().sort((a, b) => a.name.localeCompare(b.name));
    const orden = doc.orden || [];
    const mover = (p, dir) => {
      const keys = productosVisibles().map((x) => x.key);
      const i = keys.indexOf(p.key);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= keys.length) return;
      const next = keys.slice();
      next[i] = keys[j]; next[j] = keys[i];
      setDoc({ orden: next });
    };
    const fuente = (f, tipo) => h('label', { key: f.id, className: 'tp-fuente' },
      h('input', {
        type: 'checkbox', checked: !doc.fuentesOff[f.id],
        onChange: () => {
          const next = Object.assign({}, doc.fuentesOff);
          if (next[f.id]) delete next[f.id]; else next[f.id] = true;
          setDoc({ fuentesOff: next });
        },
      }),
      h('span', null, (tipo === 'pl' ? '🧪 ' : '📦 ') + f.name),
      h('em', null, f.count + ' producto(s)' + (tipo === 'pl' ? (f.publicado ? ' · publica JSON' : ' · sin publicar (precios calculados aquí)') : '')));
    return h('div', { className: 'tp-tab' },
      h('div', { className: 'tp-bloque' },
        h('div', { className: 'tp-bloque-h' }, 'Encabezado del tótem'),
        h('div', { className: 'tp-form-fila' },
          h('label', { className: 'tp-campo' }, 'Título',
            h('input', { className: 'tp-input', value: doc.titulo, onChange: (e) => setDoc({ titulo: e.target.value }) })),
          h('label', { className: 'tp-campo' }, 'Subtítulo',
            h('input', { className: 'tp-input', value: doc.subtitulo, onChange: (e) => setDoc({ subtitulo: e.target.value }) })))),
      h('div', { className: 'tp-bloque' },
        h('div', { className: 'tp-bloque-h' }, 'Fuentes de productos'),
        catalog.loading ? h('div', { className: 'tp-mut' }, 'Leyendo catálogos…') : null,
        catalog.error ? h('div', { className: 'tp-err' }, catalog.error) : null,
        catalog.fuentes.products.map((f) => fuente(f, 'pr')),
        catalog.fuentes.productlab.map((f) => fuente(f, 'pl')),
        !catalog.loading && !catalog.fuentes.products.length && !catalog.fuentes.productlab.length
          ? h('div', { className: 'tp-mut' }, 'No se encontraron instancias de Productos ni de ProductLab visibles para tu usuario.') : null),
      h('div', { className: 'tp-bloque' },
        h('div', { className: 'tp-bloque-h' }, 'Productos (' + todos.length + ')'),
        h('div', { className: 'tp-mut' }, 'Marca qué se muestra, asigna una categoría para los filtros del tótem y ordena los destacados.'),
        h('div', { className: 'tp-lista-cur' }, todos.map((p) => {
          const visible = visibles.has(p.key);
          const off = !!doc.fuentesOff[p.instanceId];
          return h('div', { key: p.key, className: 'tp-cur' + (visible ? '' : ' apagado') },
            h('input', {
              type: 'checkbox', checked: !doc.ocultos[p.key], disabled: off,
              title: off ? 'Toda la fuente está desactivada' : 'Mostrar en el tótem',
              onChange: () => {
                const next = Object.assign({}, doc.ocultos);
                if (next[p.key]) delete next[p.key]; else next[p.key] = true;
                setDoc({ ocultos: next });
              },
            }),
            p.imageUrl ? h('img', { className: 'tp-cur-thumb', src: p.imageUrl, alt: '' }) : h('span', { className: 'tp-cur-thumb tp-cur-vacio' }, '🛍️'),
            h('div', { className: 'tp-cur-info' },
              h('div', { className: 'tp-cur-nombre' }, (p.source === 'productlab' ? '🧪 ' : '📦 ') + p.name + (p.configurable ? ' ✨' : '')),
              h('div', { className: 'tp-mut' }, fmtMoney(p.price) + (p.sku ? ' · ' + p.sku : ''))),
            h('input', {
              className: 'tp-input tp-input-cat', placeholder: 'Categoría',
              value: s(doc.categorias[p.key]),
              onChange: (e) => {
                const next = Object.assign({}, doc.categorias);
                if (e.target.value.trim()) next[p.key] = e.target.value; else delete next[p.key];
                setDoc({ categorias: next });
              },
            }),
            h('span', { className: 'tp-cur-orden' },
              h('button', { className: 'tp-mini', title: 'Subir', disabled: !visible, onClick: () => mover(p, -1) }, '↑'),
              h('button', { className: 'tp-mini', title: 'Bajar', disabled: !visible, onClick: () => mover(p, 1) }, '↓')));
        }))));
  }

  // ── Pestaña Estilos (escritorio) ──
  function Campo(props) { return h('label', { className: 'tp-campo' }, props.label, props.children); }
  function EstilosTab() {
    const st = doc.style;
    const set = (patch) => setDoc({ style: normalizeStyle(Object.assign({}, st, patch)) });
    const demo = productosVisibles().slice(0, 4);
    return h('div', { className: 'tp-tab tp-estilos' },
      h('div', { className: 'tp-estilos-form' },
        h('div', { className: 'tp-bloque' },
          h('div', { className: 'tp-bloque-h' }, 'Colores y forma'),
          h('div', { className: 'tp-form-fila' },
            h(Campo, { label: 'Color de acento' }, h('input', { type: 'color', className: 'tp-color', value: /^#[0-9a-fA-F]{6}$/.test(st.accentColor) ? st.accentColor : '#19ACB1', onChange: (e) => set({ accentColor: e.target.value }) })),
            h(Campo, { label: 'Fondo' }, h('select', { className: 'tp-input', value: st.fondo, onChange: (e) => set({ fondo: e.target.value }) },
              h('option', { value: 'auto' }, 'Automático (oscuro en tótem, vidrio en escritorio)'),
              h('option', { value: 'oscuro' }, 'Oscuro'),
              h('option', { value: 'claro' }, 'Claro'),
              h('option', { value: 'color' }, 'Color personalizado'))),
            st.fondo === 'color' ? h(Campo, { label: 'Color de fondo' }, h('input', { type: 'color', className: 'tp-color', value: /^#[0-9a-fA-F]{6}$/.test(st.bgColor) ? st.bgColor : '#101A2E', onChange: (e) => set({ bgColor: e.target.value }) })) : null),
          h('div', { className: 'tp-form-fila' },
            h(Campo, { label: 'Bordes: rectos ↔ redondeados (' + st.radius + 'px)' },
              h('input', { type: 'range', min: 0, max: 28, step: 2, value: st.radius, onChange: (e) => set({ radius: Number(e.target.value) }) })),
            h(Campo, { label: 'Tipografía' }, h('select', { className: 'tp-input', value: st.fontScale, onChange: (e) => set({ fontScale: e.target.value }) },
              h('option', { value: 's' }, 'Compacta'), h('option', { value: 'm' }, 'Normal'), h('option', { value: 'l' }, 'Grande'))))),
        h('div', { className: 'tp-bloque' },
          h('div', { className: 'tp-bloque-h' }, 'Grilla de productos'),
          h('div', { className: 'tp-form-fila' },
            h(Campo, { label: 'Estilo de tarjeta' }, h('select', { className: 'tp-input', value: st.cardStyle, onChange: (e) => set({ cardStyle: e.target.value }) },
              h('option', { value: 'cards' }, 'Tarjetas con foto'), h('option', { value: 'lista' }, 'Lista'))),
            h(Campo, { label: 'Columnas' }, h('select', { className: 'tp-input', value: String(st.cols), onChange: (e) => set({ cols: Number(e.target.value) }) },
              ['1', '2', '3'].map((n) => h('option', { key: n, value: n }, n)))),
            h(Campo, { label: 'Fotos' }, h('select', { className: 'tp-input', value: st.fit, onChange: (e) => set({ fit: e.target.value }) },
              h('option', { value: 'cover' }, 'Recortadas (cover)'), h('option', { value: 'contain' }, 'Completas (contain)'))))),
        h('div', { className: 'tp-bloque' },
          h('div', { className: 'tp-bloque-h' }, 'Precios y textos'),
          h('div', { className: 'tp-form-fila' },
            h('label', { className: 'tp-switch' }, h('input', { type: 'checkbox', checked: st.mostrarPrecios, onChange: (e) => set({ mostrarPrecios: e.target.checked }) }), ' Mostrar precios'),
            h('label', { className: 'tp-switch' }, h('input', { type: 'checkbox', checked: st.mostrarSku, onChange: (e) => set({ mostrarSku: e.target.checked }) }), ' Mostrar SKU'),
            h('label', { className: 'tp-switch' }, h('input', { type: 'checkbox', checked: st.mostrarStock, onChange: (e) => set({ mostrarStock: e.target.checked }) }), ' Mostrar disponibilidad')),
          h('div', { className: 'tp-form-fila' },
            h(Campo, { label: 'Recargos en la personalización' }, h('select', { className: 'tp-input', value: st.mostrarDeltas, onChange: (e) => set({ mostrarDeltas: e.target.value }) },
              h('option', { value: 'delta' }, 'Diferencia (+$)'), h('option', { value: 'total' }, 'Precio resultante'), h('option', { value: 'none' }, 'Ocultar'))),
            h(Campo, { label: 'Texto del botón de personalizar' }, h('input', { className: 'tp-input', value: st.ctaLabel, onChange: (e) => set({ ctaLabel: e.target.value }) }))),
          h('label', { className: 'tp-switch' },
            h('input', { type: 'checkbox', checked: st.respetarEstiloProducto, onChange: (e) => set({ respetarEstiloProducto: e.target.checked }) }),
            ' Respetar el estilo por producto de ProductLab (acento y bordes del configurador)')),
        h('div', { className: 'tp-bloque' },
          h('button', { className: 'tp-btn', onClick: () => setDoc({ style: defaultStyle() }) }, 'Restaurar estilo por defecto'))),
      h('div', { className: 'tp-estilos-prev' },
        h('div', { className: 'tp-bloque-h' }, 'Previsualización'),
        h('div', { className: 'tp-prev-marco' },
          h('div', { className: 'tp-prev-lienzo ' + claseFondo(st, 'totem'), style: varsEstilo(st) },
            h(TotemView, { productos: demo, titulo: doc.titulo, subtitulo: doc.subtitulo, categoria: null, style: st })))));
  }

  // ── Pestaña Publicación (escritorio) ──
  function PublicacionTab() {
    const visibles = productosVisibles();
    const urlBase = API + '/?vitrina=TOKEN-DE-TU-VITRINA&catalogo=' + s(instanceId);
    const copiar = (texto) => {
      try { navigator.clipboard.writeText(texto); shell.notify && shell.notify({ level: 'success', text: 'Copiado.' }); }
      catch (e) { shell.notify && shell.notify({ level: 'warn', text: texto }); }
    };
    return h('div', { className: 'tp-tab' },
      h('div', { className: 'tp-bloque' },
        h('div', { className: 'tp-bloque-h' }, 'Publicar para la vitrina / tótem'),
        h('p', { className: 'tp-mut' },
          'La vitrina pública no tiene sesión: este botón guarda una copia del catálogo curado (productos + estilos) y la deja disponible en el endpoint público de esta instancia. Vuelve a publicar cada vez que cambies productos o estilos.'),
        h('div', { className: 'tp-pub-fila' },
          h('button', { className: 'tp-btn tp-btn-acc', disabled: !visibles.length, onClick: publicar },
            doc.publicado ? '⟳ Actualizar publicación' : '▲ Publicar vitrina'),
          doc.publicado ? h('button', { className: 'tp-btn tp-danger', onClick: despublicar }, 'Despublicar') : null),
        doc.publicado
          ? h('div', { className: 'tp-ok' }, '✔ Publicado el ' + new Date(doc.publicado.at).toLocaleString() + ' · ' + doc.publicado.count + ' producto(s).')
          : h('div', { className: 'tp-warn' }, '⚠ Aún sin publicar: la vitrina no verá este catálogo.'),
        visibles.length !== catalog.productos.length ? h('div', { className: 'tp-mut' },
          visibles.length + ' de ' + catalog.productos.length + ' producto(s) se incluirán (según la pestaña Catálogo).') : null),
      h('div', { className: 'tp-bloque' },
        h('div', { className: 'tp-bloque-h' }, 'Conectar el tótem'),
        h('p', { className: 'tp-mut' }, 'ID de esta instancia (el tótem lo necesita para encontrar el catálogo):'),
        h('div', { className: 'tp-pub-fila' },
          h('code', { className: 'tp-code' }, s(instanceId) || '—'),
          h('button', { className: 'tp-mini', title: 'Copiar ID', onClick: () => copiar(s(instanceId)) }, '⧉')),
        h('p', { className: 'tp-mut' }, 'En la app Vitrinas elige esta app y agrega el parámetro a la URL del tótem:'),
        h('div', { className: 'tp-pub-fila' },
          h('code', { className: 'tp-code' }, urlBase),
          h('button', { className: 'tp-mini', title: 'Copiar URL', onClick: () => copiar(urlBase) }, '⧉')),
        h('p', { className: 'tp-mut' }, 'También puedes abrir la app en el tótem sin parámetro y pegar el ID en su pantalla de conexión (queda recordado en ese equipo).')));
  }

  // ── Fondo y variables del estilo ──
  function claseFondo(st, modo) {
    const f = st.fondo === 'auto' ? (modo === 'totem' ? 'oscuro' : 'vidrio') : st.fondo;
    return 'tp-fondo-' + f;
  }
  function varsEstilo(st) {
    const acc = /^#[0-9a-fA-F]{6}$/.test(st.accentColor) ? st.accentColor : '#19ACB1';
    const vars = {
      '--tp-acc': acc,
      '--tp-acc-fg': isDarkHex(acc) ? '#ffffff' : '#101318',
      '--tp-radius': st.radius + 'px',
      '--tp-fscale': st.fontScale === 's' ? '0.9' : st.fontScale === 'l' ? '1.14' : '1',
    };
    if (st.fondo === 'color') {
      vars['--tp-bg'] = st.bgColor;
      vars['--tp-ink'] = isDarkHex(st.bgColor) ? '#ffffff' : '#141821';
    }
    return vars;
  }

  // ── Componente raíz ──
  function Component() {
    useEstado();
    const raizRef = useRef(null);
    const [modo, setModo] = useState('escritorio');

    // Tótem = ventana alta y vertical (medimos el contenedor, no el viewport).
    useEffect(() => {
      const el = raizRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return undefined;
      const medir = () => {
        const forzado = config.modo;
        if (forzado === 'totem' || forzado === 'escritorio') { setModo(forzado); modoActual = forzado; marcarActividad(); return; }
        const w = el.clientWidth, hgt = el.clientHeight;
        const m = (hgt >= 950 && hgt > w * 1.15) || esPublico ? 'totem' : 'escritorio';
        setModo(m); modoActual = m; marcarActividad();
      };
      medir();
      const ro = new ResizeObserver(medir);
      ro.observe(el);
      return () => ro.disconnect();
    }, [config.modo]);

    const st = doc.style;
    const visibles = productosVisibles();

    let cuerpo;
    if (esPublico) {
      cuerpo = pub.estado === 'ok'
        ? h(TotemView, { productos: visibles, titulo: doc.titulo, subtitulo: doc.subtitulo, categoria: vista.categoria, style: st })
        : pub.estado === 'cargando' || pub.estado === 'resolviendo'
          ? h('div', { className: 'tp-vacio' }, h('div', { className: 'tp-vacio-ico' }, '🛍️'), h('div', null, 'Cargando catálogo…'))
          : h(Setup, null);
    } else {
      const tabs = [['vitrina', 'Vitrina'], ['catalogo', 'Catálogo'], ['estilos', 'Estilos'], ['publicacion', 'Publicación']];
      cuerpo = h(React.Fragment, null,
        h('header', { className: 'tp-hd' },
          h('div', { className: 'tp-hd-titulo' }, '🛍️ Totem de Productos',
            h('span', { className: 'tp-ver', title: 'Totem de Productos v' + APP_VERSION }, 'v' + APP_VERSION)),
          h('nav', { className: 'tp-tabs', role: 'tablist' }, tabs.map((t) =>
            h('button', {
              key: t[0], role: 'tab', 'aria-selected': vista.tab === t[0],
              className: 'tp-tab-b' + (vista.tab === t[0] ? ' activa' : ''),
              onClick: () => irATab(t[0]),
            }, t[1]))),
          h('div', { className: 'tp-hd-acc' },
            h('button', { className: 'tp-mini', title: 'Recargar catálogos', onClick: () => loadCatalog() }, '⟳'))),
        vista.tab === 'catalogo' ? h(CatalogoTab, null)
          : vista.tab === 'estilos' ? h(EstilosTab, null)
          : vista.tab === 'publicacion' ? h(PublicacionTab, null)
          : h('div', { className: 'tp-lienzo ' + claseFondo(st, modo), style: varsEstilo(st) },
              catalog.loading ? h('div', { className: 'tp-vacio' }, h('div', null, 'Leyendo catálogos…')) : null,
              catalog.error ? h('div', { className: 'tp-vacio' }, h('div', null, catalog.error)) : null,
              !catalog.loading && !catalog.error ? h(TotemView, { productos: visibles, titulo: doc.titulo, subtitulo: doc.subtitulo, categoria: vista.categoria, style: st }) : null));
    }

    const style = esPublico ? Object.assign({}, varsEstilo(st)) : null;
    return h('div', {
      ref: raizRef,
      className: 'kimos-totem-productos modo-' + modo + (esPublico ? ' publica ' + claseFondo(st, 'totem') : ''),
      style: style,
      onPointerDown: marcarActividad,
      onKeyDown: marcarActividad,
    }, cuerpo);
  }

  return {
    Component: Component,
    unmount: () => {
      clearTimeout(saveT);
      clearTimeout(inactT);
      clearInterval(refreshT);
      if (offConfig) { try { offConfig(); } catch (e) { /* ya liberado */ } }
      if (offAgent) { try { offAgent(); } catch (e) { /* ya liberado */ } }
      listeners.clear();
    },
  };
}
