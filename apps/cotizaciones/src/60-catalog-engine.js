/* ══ MOTOR DEL CATÁLOGO ═══════════════════════════════════════════════════
 *
 * Traduce los catálogos de OTRAS apps a una forma común que se pueda cotizar:
 *
 *   products    Catálogo de tienda: precio, SKU, imágenes, opciones y
 *               variantes. El recargo de cada opción sale de las variantes
 *               (precio ancla + delta por valor).
 *   productlab  Productos configurables: pasos con valores, dependencias
 *               entre pasos y precio calculado desde los componentes
 *               (costo → margen → impuesto → redondeo).
 *
 * Con ProductLab hay dos caminos, y se prefiere el primero:
 *   1. La instancia PUBLICA su catálogo resuelto en `definition.public.data`
 *      (contrato v2: precio base + delta por valor). Es lo que ProductLab
 *      considera verdad y no obliga a recalcular nada.
 *   2. Si no publica, se replica su motor de precios sobre los componentes
 *      crudos. Es la misma cadena que usa `apps/totem-productos`, de donde
 *      viene esta implementación; mantenerlas alineadas es la razón de que
 *      los nombres coincidan.
 *
 * Todo aquí es puro: ni red ni estado. Lo que necesita la cotización es el
 * precio resultante de UNA combinación concreta de pasos y valores, y eso lo
 * da `precioSeleccion()`.
 */

const norm = canon;

/** Texto de la tienda (HTML) → texto plano acotado: la propuesta no pinta HTML. */
function textoPlano(html, max) {
  const t = s(html)
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    // El hueco que deja una etiqueta cerrada justo antes de un signo de
    // puntuación ("32\" ."): en una propuesta al cliente se nota.
    .replace(/ +([,.;:!?%)\]])/g, '$1')
    .replace(/\n{3,}/g, '\n\n').trim();
  if (max && t.length > max) return t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

// ── Reglas de precio de ProductLab ──────────────────────────────────────
function plRules(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    currency: s(r.currency || 'CLP'),
    currencySymbol: s(r.currencySymbol || '$'),
    currencyDecimals: clamp(Math.round(num(r.currencyDecimals)), 0, 4),
    locale: s(r.locale || 'es-CL'),
    fx: isObj(r.fx) ? r.fx : {},
    // Se usa `num(valor, defecto)` y no `|| defecto`: un margen del 0 % o un
    // impuesto del 0 % son valores legítimos, y ProductLab los respeta.
    salesTaxPct: num(r.salesTaxPct, num(r.ivaPct, 19)),
    marginBasis: r.marginBasis === 'sale' ? 'sale' : 'cost',
    marginDefaultPct: num(r.marginDefaultPct, 25),
    marginByType: isObj(r.marginByType) ? r.marginByType : {},
    // Redondeo del delta: cero no tiene sentido (se dividiría por él).
    deltaRoundTo: num(r.deltaRoundTo, 1) || 1,
    leadTimeDays: num(r.leadTimeDays),
  };
}

/**
 * Motor de precios de ProductLab: de componente a precio de venta bruto.
 * Cadena: costo (en su moneda) → tipo de cambio → quitar impuesto si el costo
 * lo trae → impuesto propio del componente → margen (sobre costo o sobre
 * venta) → impuesto de venta.
 */
function plEngine(defItem, comps) {
  const rules = plRules(defItem && defItem.rules);
  const byId = new Map(arr(comps).map((c) => [c.id, c]));
  const iva = rules.salesTaxPct / 100;

  const grossComp = (c) => {
    if (!c) return null;
    const fx = c.currency && c.currency !== rules.currency ? (num(rules.fx[c.currency]) || 1) : 1;
    const costBase = num(c.cost) * fx;
    const net = (c.costConIva ? costBase / (1 + iva) : costBase) * (1 + num(c.taxPct) / 100);
    const mt = rules.marginByType[c.type];
    const m = (mt == null || mt === '' ? rules.marginDefaultPct : num(mt, rules.marginDefaultPct)) / 100;
    const priced = rules.marginBasis === 'sale' ? (m < 1 ? net / (1 - m) : net) : net * (1 + m);
    return priced * (1 + iva);
  };
  const disponible = (c, qty) => !!c && c.active !== false && (c.stock == null || num(c.stock) >= (qty || 1));

  /** Pool efectivo del valor: sus componentes más las alternativas, por tipo. */
  const poolPorTipo = (v) => {
    const solo = new Set(arr(v.soloExacto));
    const tipos = new Map();
    arr(v.componentIds).forEach((cid) => {
      const base = byId.get(cid);
      if (!base) return;
      const alts = [base];
      if (!solo.has(cid)) arr(base.altIds).forEach((aid) => { const a = byId.get(aid); if (a) alts.push(a); });
      const lista = tipos.get(base.type) || [];
      alts.forEach((c) => { if (lista.indexOf(c) === -1) lista.push(c); });
      tipos.set(base.type, lista);
    });
    return tipos;
  };

  /** Precio bruto del valor, o null si algún tipo se quedó sin alternativa. */
  const valueGross = (v) => {
    const qty = num(v.qty) || 1;
    if (!arr(v.componentIds).length) return { gross: num(v.priceDelta), comp: null };
    let suma = 0;
    let elegido = null;
    for (const lista of poolPorTipo(v).values()) {
      let mejor = null;
      for (const c of lista) {
        if (!disponible(c, qty)) continue;
        const g = grossComp(c);
        if (g != null && (mejor == null || g < mejor.g)) mejor = { c, g };
      }
      if (!mejor) return null;             // agotado: el valor no se ofrece
      suma += mejor.g * qty;
      if (!elegido) elegido = mejor.c;
    }
    return { gross: suma + num(v.priceDelta), comp: elegido };
  };

  const roundDelta = (n) => Math.round(n / rules.deltaRoundTo) * rules.deltaRoundTo;
  return { rules, byId, grossComp, disponible, valueGross, roundDelta };
}

// ── Forma común ─────────────────────────────────────────────────────────
// Producto normalizado:
//   { key, source, id, instanceId, instanceName, name, sku, brand, price,
//     imageUrl, images[], description, specs[], stock, configurable,
//     groups[], presets[] }
// Grupo (paso): { id, label, nota, dependsOn:{groupId,valueIds}|null, values[] }
// Valor: { id, name, desc, imageUrl, delta, isDefault }

function normValor(v) {
  return {
    id: s(v.id),
    name: s(v.name || v.label),
    desc: s(v.desc || v.detalle),
    imageUrl: s(v.imageUrl),
    delta: num(v.delta),
    isDefault: v.isDefault === true,
  };
}

/** Desde el JSON público v2 de ProductLab (`definition.public.data.productos`). */
function fromPublicPL(pp, inst) {
  if (!pp || !s(pp.name)) return null;
  const groups = arr(pp.groups).map((g) => {
    const values = arr(g.values).filter((v) => v && v.fallback !== true).map(normValor).filter((v) => v.id && v.name);
    if (!values.length) return null;
    if (!values.some((v) => v.isDefault)) values[0].isDefault = true;
    const d = g.dependsOn;
    return {
      id: s(g.id), label: s(g.label || g.type), nota: s(g.nota),
      dependsOn: d && d.groupId && arr(d.valueIds).length ? { groupId: s(d.groupId), valueIds: arr(d.valueIds).map(s) } : null,
      values,
    };
  }).filter(Boolean);
  const specs = arr(pp.storefront && pp.storefront.specs)
    .map((x) => ({ group: s(x.group), label: s(x.label), value: s(x.value) })).filter((x) => x.label);
  return {
    key: 'pl:' + inst.id + ':' + s(pp.sku || pp.productId || pp.name),
    source: 'productlab', id: s(pp.sku || pp.productId || pp.name),
    instanceId: inst.id, instanceName: s(inst.name),
    name: s(pp.name), sku: s(pp.sku), brand: '',
    price: num(pp.basePrice),
    imageUrl: s(pp.imageUrl), images: arr(pp.images).map(s).filter(Boolean),
    description: textoPlano(pp.description, 900),
    specs, stock: null,
    configurable: groups.length > 0, groups,
    presets: arr(pp.presets).map((pr) => {
      // En el JSON público la selección viene por NOMBRES, no por ids.
      const sel = {};
      arr(pr.selection).forEach((par) => {
        const g = groups.find((x) => norm(x.label) === norm(par.group));
        if (!g) return;
        const v = g.values.find((x) => norm(x.name) === norm(par.value));
        if (v) sel[g.id] = v.id;
      });
      return { id: s(pr.id) || uid('pre'), name: s(pr.name), sel };
    }).filter((pr) => pr.name),
  };
}

/** Desde items crudos de ProductLab (kind `producto`/`equipo`) + motor. */
function fromRawPL(eq, engine, inst, storeItems) {
  if (!eq || !s(eq.name) || eq.status === 'inactive') return null;
  const groups = [];
  arr(eq.groups).forEach((g) => {
    if (!g || g.baseStep === true) return;
    const brutos = [];
    arr(g.values).forEach((v) => {
      if (!v || v.fallback === true) return;
      const vg = engine.valueGross(v);
      if (vg == null) return;                       // agotado: no se ofrece
      const comp = vg.comp;
      const qty = num(v.qty) || 1;
      const detalleAuto = comp ? (qty > 1 ? qty + '× ' : '') + s(comp.specs || comp.name) : '';
      let img = s(v.imageUrl);
      if (!img) {
        for (const cid of arr(v.componentIds)) {
          const c = engine.byId.get(cid);
          if (c && c.type === g.typeId && c.imageUrl) { img = s(c.imageUrl); break; }
        }
      }
      brutos.push({ id: s(v.id), name: s(v.label), desc: s(v.detalle) || detalleAuto, imageUrl: img, gross: vg.gross });
    });
    if (!brutos.length) return;
    // El delta de cada valor es su diferencia con el valor por defecto: así el
    // precio base del producto ya incluye la configuración por defecto.
    const def = brutos.find((v) => v.id === s(g.defaultValueId)) || brutos[0];
    const d = g.dependsOn;
    groups.push({
      id: s(g.id), label: s(g.label) || s(g.typeId), nota: s(g.nota),
      dependsOn: d && d.stepId && arr(d.valueIds).length ? { groupId: s(d.stepId), valueIds: arr(d.valueIds).map(s) } : null,
      values: brutos.map((v) => ({
        id: v.id, name: v.name, desc: v.desc, imageUrl: v.imageUrl,
        delta: engine.roundDelta(v.gross - def.gross), isDefault: v === def,
      })),
    });
  });

  // Precio base según el modo de precio del producto.
  const ref = eq.storeRef || null;
  const storeItem = ref && storeItems ? storeItems.get(s(ref.itemId)) : null;
  let price;
  if (eq.priceMode === 'fixed') price = num(eq.fixedPrice) || num(eq.price);
  else if (eq.priceMode === 'store') price = (storeItem && num(storeItem.price)) || num(eq.fixedPrice) || num(eq.price);
  else price = num(eq.price);

  const sf = isObj(eq.storefront) ? eq.storefront : {};
  const imgs = [];
  const push = (u) => { const x = s(u); if (x && imgs.indexOf(x) === -1) imgs.push(x); };
  push(eq.imageUrl);
  arr(eq.galleryImages).forEach(push);
  if (storeItem) (arr(storeItem.images).length ? arr(storeItem.images) : [storeItem.imageUrl]).forEach(push);

  return {
    key: 'pl:' + inst.id + ':' + s(eq.id),
    source: 'productlab', id: s(eq.id),
    instanceId: inst.id, instanceName: s(inst.name),
    name: s(eq.name), sku: s(eq.sku), brand: '',
    price: Math.round(price),
    imageUrl: imgs[0] || '', images: imgs,
    description: textoPlano(storeItem && (storeItem.description || storeItem.body), 900),
    specs: arr(sf.specs).map((x) => ({ group: s(x.group), label: s(x.label), value: s(x.value) })).filter((x) => x.label),
    stock: null,
    configurable: groups.length > 0, groups,
    presets: arr(eq.presets).map((pr) => ({
      id: s(pr.id) || uid('pre'), name: s(pr.name), sel: isObj(pr.selection) ? pr.selection : {},
    })).filter((pr) => pr.name),
  };
}

/** Pasos derivados de las opciones y variantes de un item de `products`. */
function groupsFromProducts(p) {
  const groups = [];
  const base = num(p.price);
  arr(p.options).forEach((o, oi) => {
    if (!o || !s(o.name) || !arr(o.values).length) return;
    const gid = 'opt-' + oi;
    if (o.optionType === 'addon') {
      // Un addon es sí/no con recargo fijo.
      const recargo = Math.max(0, num(o.addonPrice));
      groups.push({
        id: gid, label: s(o.name), nota: '', dependsOn: null,
        values: [{ id: gid + '-no', name: 'Sin ' + s(o.name).toLowerCase(), desc: '', imageUrl: '', delta: 0, isDefault: true }]
          .concat(arr(o.values).map((v, vi) => ({
            id: gid + '-' + vi, name: s(v.name), desc: '', imageUrl: '', delta: recargo, isDefault: false,
          }))),
      });
      return;
    }
    // Opción normal: el recargo sale de las variantes que llevan ese valor.
    const vals = arr(o.values).map((v, vi) => {
      const conValor = arr(p.variants).filter((vr) => vr && vr.options && norm(vr.options[o.name]) === norm(v.name));
      const precios = conValor.map((vr) => Number(vr.price)).filter(Number.isFinite);
      return {
        id: gid + '-' + vi, name: s(v.name), desc: '', imageUrl: '',
        delta: precios.length ? Math.round(Math.min.apply(null, precios) - base) : 0,
        isDefault: false,
      };
    }).filter((v) => v.name);
    if (!vals.length) return;
    // El valor más barato es el que fija el precio base: el resto son recargos.
    let mi = 0;
    vals.forEach((v, ix) => { if (v.delta < vals[mi].delta) mi = ix; });
    const dmin = vals[mi].delta;
    vals.forEach((v) => { v.delta -= dmin; });
    vals[mi].isDefault = true;
    groups.push({ id: gid, label: s(o.name), nota: '', dependsOn: null, values: vals });
  });
  return groups;
}

function fromProductsItem(p, inst) {
  if (!p || p.kind === 'definition' || !s(p.name)) return null;
  if (p.status && p.status !== 'active') return null;
  const imgs = [];
  arr(p.images).forEach((u) => { const x = s(u); if (x && imgs.indexOf(x) === -1) imgs.push(x); });
  if (s(p.imageUrl) && imgs.indexOf(s(p.imageUrl)) === -1) imgs.unshift(s(p.imageUrl));
  const groups = groupsFromProducts(p);
  return {
    key: 'pr:' + inst.id + ':' + s(p.id),
    source: 'products', id: s(p.id),
    instanceId: inst.id, instanceName: s(inst.name),
    name: s(p.name), sku: s(p.sku), brand: s(p.brand),
    price: num(p.price),
    imageUrl: imgs[0] || '', images: imgs,
    description: textoPlano(p.description, 900),
    specs: [], stock: typeof p.stock === 'number' ? p.stock : null,
    configurable: groups.length > 0, groups, presets: [],
  };
}

// ── Selección y precio de una combinación ───────────────────────────────
const defaultVal = (g) => arr(g.values).find((v) => v.isDefault) || arr(g.values)[0] || null;

/** Completa la selección con los valores por defecto y descarta lo inválido. */
function seleccionResuelta(prod, sel) {
  const out = {};
  const m = isObj(sel) ? sel : {};
  arr(prod && prod.groups).forEach((g) => {
    const ok = arr(g.values).some((v) => v.id === m[g.id]);
    const d = defaultVal(g);
    out[g.id] = ok ? m[g.id] : (d ? d.id : null);
  });
  return out;
}

/** Un paso dependiente solo cuenta si el paso del que depende está en su valor. */
function grupoVisible(prod, g, selMap) {
  const d = g.dependsOn;
  if (!d || !d.groupId || !arr(d.valueIds).length) return true;
  const target = arr(prod.groups).find((x) => x.id === d.groupId);
  if (!target) return true;
  return d.valueIds.indexOf(selMap[target.id]) !== -1;
}

/** Precio resultante de la combinación: base más el delta de cada paso visible. */
function precioSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  let total = num(prod && prod.price);
  arr(prod && prod.groups).forEach((g) => {
    if (!grupoVisible(prod, g, m)) return;
    const v = arr(g.values).find((x) => x.id === m[g.id]);
    if (v) total += num(v.delta);
  });
  return total;
}

/** La imagen que corresponde a la combinación (la del primer paso que la fija). */
function fotoSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  for (const g of arr(prod && prod.groups)) {
    if (!grupoVisible(prod, g, m)) continue;
    const v = arr(g.values).find((x) => x.id === m[g.id]);
    if (v && v.imageUrl) return v.imageUrl;
  }
  return s(prod && prod.imageUrl) || arr(prod && prod.images)[0] || '';
}

/** La combinación elegida, legible: [{ stepId, stepName, valueId, valueName }]. */
function detalleSeleccion(prod, sel) {
  const m = seleccionResuelta(prod, sel);
  const out = [];
  arr(prod && prod.groups).forEach((g) => {
    if (!grupoVisible(prod, g, m)) return;
    const v = arr(g.values).find((x) => x.id === m[g.id]);
    if (!v) return;
    out.push({ stepId: g.id, stepName: g.label, valueId: v.id, valueName: v.name, delta: num(v.delta) });
  });
  return out;
}

/**
 * Descripción de la línea cotizada: la del producto más la combinación
 * elegida, para que el cliente lea en la propuesta exactamente qué se le
 * está ofreciendo y no solo el nombre del producto.
 */
function descripcionSeleccion(prod, sel, incluirDescripcion) {
  const partes = [];
  if (incluirDescripcion !== false && s(prod.description)) partes.push(s(prod.description));
  const det = detalleSeleccion(prod, sel);
  if (det.length) partes.push(det.map((d) => d.stepName + ': ' + d.valueName).join(' · '));
  return partes.join('\n');
}
