/**
 * ProductLab — laboratorio de productos personalizables para la tienda.
 * Gestión de componentes (costos de proveedor, stock, compatibilidades),
 * reglas de margen, productos con pasos de configuración (con dependencias,
 * cantidades y valores genéricos), ficha de tienda (builder de descripción),
 * previsualizador del configurador, visualizador 3D y publicación hacia el
 * ecommerce.
 *
 * Herencia: evolución generalizada de "Computadores HubPro" (repo computadores,
 * v3.6.1) + el visualizador 3D del repo personalizador. Sin dominio fijo:
 * sirve para cualquier producto personalizable (integrado hoy con Jumpseller;
 * Shopify/WooCommerce en el roadmap — ver docs/PLATAFORMAS.md).
 *
 * Arquitectura (escribe A TRAVÉS de la app oficial `products`, no la duplica):
 *  - Los COMPONENTES, PRODUCTOS y reglas viven como items de esta instancia.
 *  - Cada PRODUCTO referencia (productRef) un item de producto de una instancia
 *    de la app `products`. Al "aplicar a la tienda", esta app genera desde los
 *    pasos: `price` + `options[]` (una opción por paso, esquema v2.1 de
 *    products: {name, optionType, sourceOptionId, values}) + `variants[]`
 *    (producto cartesiano con PRECIO POR COMBINACIÓN y sourceVariantId
 *    preservado), los escribe en el item del producto
 *    (PUT /api/app-instances/{pInst}/items/{itemId}) y dispara su sync-push —
 *    el backend de KIMOS empuja producto, opciones y variantes a Jumpseller
 *    con los endpoints dedicados y persiste los ids.
 *  - El catálogo se lee vía shell.data (data.read:products); la escritura usa
 *    shell.authFetch con el RBAC del usuario (mismos endpoints que usa la UI
 *    de products). El push al ecommerce SOLO existe para instancias del
 *    template products, por eso se escribe allí y no aquí.
 *  - El configurador del theme se alimenta del JSON publicado en
 *    GET /api/public/app/{instanceId}/definition (permiso public.read):
 *    imágenes, specs, dependencias, compatibilidades y entrega, que el
 *    ecommerce no modela.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;

  const instanceId = shell.app && shell.app.instanceId;

  function apiBase() {
    try {
      const raw = shell.assetUrl('x').split('/api/apps/')[0];
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) { return window.location.origin; }
  }
  const API = apiBase();
  const publicUrl = API + '/api/public/app/' + instanceId + '/definition';

  // ── Utilidades ────────────────────────────────────────────────────────────
  const s = (v) => (v == null ? '' : String(v));
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
  // Como num(), pero null/'' toman el default (Number(null) es 0, no NaN):
  // para campos opcionales donde "vacío" significa "usar la regla global".
  const numOr = (v, d) => (v == null || v === '' ? d : num(v, d));
  const nowIso = () => new Date().toISOString();
  const newId = (p) => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const norm = (v) => s(v).trim().toLowerCase();
  const fmtCLP = (v) => '$' + Math.round(num(v)).toLocaleString('es-CL');
  const fmtDelta = (v) => (v < 0 ? '− ' : '+ ') + fmtCLP(Math.abs(v));
  const parseList = (v) => s(v).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  // Acepta array (guardado) o string (mientras el usuario escribe en el input).
  const joinList = (a) => (Array.isArray(a) ? a.join(', ') : s(a));
  function isDarkHex(hex) {
    let m = s(hex).replace('#', '');
    if (m.length === 3) m = m.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(m)) return false;
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('es-CL'); } catch (e) { return s(iso); }
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return s(iso); }
  }
  function daysSince(iso) {
    if (!iso) return Infinity;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : Infinity;
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => shell.notify({ level: 'success', text: 'Copiado al portapapeles.' }));
    }
  }

  // Tipos genéricos de partida: se renombran, agregan o eliminan libremente
  // en la pestaña Precios (cada catálogo define su propio dominio).
  const DEFAULT_TYPES = [
    { id: 'base', label: 'Base' },
    { id: 'material', label: 'Material' },
    { id: 'textura', label: 'Textura / Acabado' },
    { id: 'color', label: 'Color' },
    { id: 'tamano', label: 'Tamaño' },
    { id: 'capacidad', label: 'Capacidad' },
    { id: 'accesorio', label: 'Accesorio' },
    { id: 'servicio', label: 'Servicio' },
    { id: 'other', label: 'Otro' },
  ];

  function defaultDefinition() {
    return {
      id: 'definition',
      kind: 'definition',
      types: DEFAULT_TYPES,
      rules: {
        ivaPct: 19,
        usdRate: 950,
        marginBasis: 'cost',      // 'cost': venta = costo×(1+m) | 'sale': venta = costo÷(1−m)
        marginDefaultPct: 25,     // fallback para tipos sin margen propio
        marginBasePct: 25,        // SOLO para costos adicionales manuales del producto
        marginByType: {},
        roundMode: 'end990',      // end990 | up1000 | none
        deltaRoundTo: 100,        // redondeo de recargos por valor
        assemblyDays: 3,          // días de preparación/producción, se suman a la entrega
        staleDays: 30,            // días sin verificar proveedor => alerta
      },
      // URL base de la tienda (para armar el link del producto: base+permalink)
      storeBaseUrl: '',
      // Bloque leído por el gateway público (theme de la tienda):
      public: { enabled: false, channels: [], data: null },
    };
  }

  // ── Estado del closure ────────────────────────────────────────────────────
  let model = {
    loaded: false,
    error: null,
    components: [],
    productos: [],
    def: null,
    defExists: false,
    storeCatalog: [],          // catálogo leído de la app products (picker), con __instanceId
    storeCatalogLoaded: false,
    storeCatalogError: null,
  };
  const listeners = new Set();
  function setModel(patch) { model = Object.assign({}, model, patch); listeners.forEach((l) => l(model)); }

  async function load() {
    if (!instanceId) { setModel({ loaded: true }); return; }
    try {
      const items = await shell.items.list();
      const def = (items || []).find((i) => i.id === 'definition' || i.kind === 'definition');
      const comps = (items || []).filter((i) => i.kind === 'component');
      setModel({
        components: comps,
        productos: (items || []).filter((i) => i.kind === 'producto').map((e) => normalizeProductoShape(e, comps)),
        def: def || model.def || defaultDefinition(),
        defExists: !!def,
        loaded: true,
        error: null,
      });
    } catch (e) {
      setModel({ loaded: true, error: (e && e.message) || 'No se pudo cargar la app.', def: model.def || defaultDefinition() });
    }
  }

  async function saveDefinition(next) {
    const def = Object.assign({}, next, { id: 'definition', kind: 'definition' });
    const existed = model.defExists;
    setModel({ def, defExists: true });
    try {
      if (existed) await shell.items.update('definition', def);
      else await shell.items.create(def);
      return { success: true };
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar la configuración.' });
      return { success: false, error: (e && e.message) || 'Error al guardar.' };
    }
  }

  // ── Reglas de precio ──────────────────────────────────────────────────────
  function rules() {
    const r = (model.def && model.def.rules) || {};
    return {
      ivaPct: num(r.ivaPct, 19),
      usdRate: num(r.usdRate, 950),
      marginBasis: r.marginBasis === 'sale' ? 'sale' : 'cost',
      marginDefaultPct: num(r.marginDefaultPct, 25),
      marginBasePct: num(r.marginBasePct, num(r.marginDefaultPct, 25)),
      marginByType: r.marginByType || {},
      roundMode: r.roundMode || 'end990',
      deltaRoundTo: Math.max(1, num(r.deltaRoundTo, 100)),
      assemblyDays: num(r.assemblyDays, 3),
      staleDays: Math.max(1, num(r.staleDays, 30)),
    };
  }
  function types() {
    const t = model.def && model.def.types;
    return Array.isArray(t) && t.length ? t : DEFAULT_TYPES;
  }
  const typeLabel = (id) => { const t = types().find((x) => x.id === id); return t ? t.label : s(id); };

  const costCLP = (cost, currency) => (currency === 'USD' ? num(cost) * rules().usdRate : num(cost));
  function marginFor(typeId) {
    const r = rules();
    const m = r.marginByType[typeId];
    return m == null || m === '' ? r.marginDefaultPct : num(m, r.marginDefaultPct);
  }
  // Aplica el margen según la base configurada en las reglas:
  //  - 'cost' (sobre costo / markup):  venta = costo × (1 + m%)
  //  - 'sale' (sobre venta):           venta = costo ÷ (1 − m%)  [m% tope 95]
  function marginApplied(costClp, pct) {
    const p = num(pct) / 100;
    if (rules().marginBasis === 'sale') return costClp / (1 - Math.min(Math.max(p, 0), 0.95));
    return costClp * (1 + p);
  }
  // Costo neto en CLP de un componente: costo de proveedor (convertido si es
  // USD) + impuesto adicional % (aduana/importación en dropshipping).
  function componentNetCost(c) {
    return costCLP(c.cost, c.currency) * (1 + Math.max(0, num(c.taxPct)) / 100);
  }
  // Precio bruto de venta de un componente (sin redondear): margen del tipo + IVA.
  function componentGross(c) {
    return marginApplied(componentNetCost(c), marginFor(c.type)) * (1 + rules().ivaPct / 100);
  }
  const roundStep = (x, step) => Math.round(x / step) * step;
  function componentSale(c) { return roundStep(componentGross(c), rules().deltaRoundTo); }
  function roundFinal(x) {
    const mode = rules().roundMode;
    if (mode === 'up1000') return Math.ceil(x / 1000) * 1000;
    if (mode === 'none') return Math.round(x);
    // end990: menor precio terminado en 990 que sea >= x
    return Math.max(990, Math.ceil((x - 990) / 1000) * 1000 + 990);
  }

  const compById = (id) => model.components.find((c) => c.id === id) || null;
  // Disponible = activo y con stock (stock vacío/null = sin control de stock).
  function compAvailable(c) { return !!c && c.active !== false && (c.stock == null || num(c.stock) > 0); }

  // ── Valores genéricos con pool de alternativas ────────────────────────────
  // Cada paso tiene VALORES genéricos que ve el cliente ("Cubierta roble", sin
  // marca) y cada valor un pool de componentes ALTERNATIVOS de distintos
  // proveedores/marcas que se COMPLEMENTAN: al calcular, siempre se usa la
  // alternativa más económica DISPONIBLE (activa y con stock) — mejor precio
  // y disponibilidad continua. Sus specs/imagen alimentan el detalle público.
  function groupValues(g) { return Array.isArray(g.values) ? g.values : []; }
  // Cantidad del valor: cuántas unidades del componente elegido incluye
  // (ej: "16GB (2×8)" con qty 2 usa dos módulos de 8GB → precio y stock ×2).
  function valueQty(v) { return Math.max(1, Math.round(num(v && v.qty, 1)) || 1); }
  // Valor NEUTRO (explícito): opción válida de $0 sin componentes ("Sin
  // accesorio", "No, gracias"). Clave para pasos dependientes: cuando el paso
  // está oculto, la tienda usa su default — que idealmente es un neutro.
  // Debe marcarse EXPLÍCITAMENTE (neutral: true): un valor que quedó sin
  // componentes por accidente (ej. componente eliminado) sigue tratándose
  // como no disponible, nunca como gratis.
  function valueIsNeutral(v) { return !!v && v.neutral === true && !((v.componentIds || []).length); }
  function valueAlts(v) { return (v.componentIds || []).map(compById).filter(Boolean); }
  // Disponible para una cantidad: activo y con stock suficiente (null = sin control).
  function compAvailableQty(c, qty) { return !!c && c.active !== false && (c.stock == null || num(c.stock) >= Math.max(1, qty)); }
  function valueChosen(v) {
    if (valueIsNeutral(v)) return null;
    const q = valueQty(v);
    const avail = valueAlts(v).filter((c) => compAvailableQty(c, q));
    if (!avail.length) return null;
    return avail.reduce((best, c) => (componentGross(c) < componentGross(best) ? c : best), avail[0]);
  }
  function valueGross(v) {
    if (valueIsNeutral(v)) return 0;
    const c = valueChosen(v);
    return c ? componentGross(c) * valueQty(v) : null;
  }
  function valueSale(v) { const g = valueGross(v); return g == null ? null : roundStep(g, rules().deltaRoundTo); }
  function valueAvailable(v) { return valueIsNeutral(v) || valueChosen(v) != null; }
  function groupDefaultValue(g) {
    const vals = groupValues(g).filter(valueAvailable);
    return vals.find((v) => v.id === g.defaultValueId) || vals[0] || null;
  }

  // ── Dependencias entre pasos ──────────────────────────────────────────────
  // Un paso puede depender de un paso ANTERIOR: solo se muestra en la tienda
  // si la selección de ese paso está en dependsOn.valueIds (ej: "Tarjeta de
  // video" solo si la placa elegida la admite). Oculto = se fuerza su valor
  // por defecto, por eso conviene que el default de un paso dependiente sea
  // NEUTRO ($0, sin componentes). Las variantes siguen siendo el producto
  // cartesiano completo: las combinaciones "imposibles" existen en la tienda
  // pero el cliente nunca puede seleccionarlas.
  function groupDependsOn(g) {
    const d = g && g.dependsOn;
    return d && d.stepId && Array.isArray(d.valueIds) && d.valueIds.length ? d : null;
  }
  // Sanea dependencias: solo pueden apuntar a un paso ANTERIOR (sin ciclos) y
  // a valores que existan; lo inválido se descarta en silencio al guardar.
  function normalizeDependsOn(groups) {
    return groups.map((g, i) => {
      const d = groupDependsOn(g);
      const o = Object.assign({}, g);
      delete o.dependsOn;
      if (!d) return o;
      const target = groups.slice(0, i).find((x) => x.id === d.stepId);
      if (!target) return o;
      const valid = groupValues(target).map((v) => v.id);
      const valueIds = d.valueIds.filter((id) => valid.indexOf(id) !== -1);
      if (valueIds.length) o.dependsOn = { stepId: d.stepId, valueIds };
      return o;
    });
  }
  // Visibilidad de un paso dada una selección {groupId: valueId} — la misma
  // regla que replica el configurador del theme en la tienda.
  function groupVisibleFor(eq, g, selection) {
    const d = groupDependsOn(g);
    if (!d) return true;
    const target = (eq.groups || []).find((x) => x.id === d.stepId);
    if (!target) return true;
    const selId = (selection && selection[target.id]) || (groupDefaultValue(target) || {}).id;
    return d.valueIds.indexOf(selId) !== -1;
  }

  // ── Base del producto: componentes base reales + costos adicionales ────────
  // Los componentes base usan el margen de SU tipo; los costos adicionales
  // manuales (producción, embalaje, otros) usan rules.marginBasePct.
  function baseBreakdown(eq) {
    const r = rules();
    const comps = (eq.baseComponentIds || []).map(compById).filter(Boolean);
    const extras = (Array.isArray(eq.extraCosts) ? eq.extraCosts : []).filter((x) => x && num(x.cost) > 0);
    let gross = 0;
    comps.forEach((c) => { gross += componentGross(c); });
    extras.forEach((x) => { gross += marginApplied(costCLP(x.cost, x.currency), r.marginBasePct) * (1 + r.ivaPct / 100); });
    return { comps, extras, gross };
  }
  function productoComputedPrice(eq) {
    let gross = baseBreakdown(eq).gross;
    (eq.groups || []).forEach((g) => {
      const dv = groupDefaultValue(g);
      const vg = dv ? valueGross(dv) : null;
      if (vg != null) gross += vg;
    });
    return roundFinal(gross);
  }
  function deltaFor(g, v) {
    const dv = groupDefaultValue(g);
    if (!dv || dv.id === v.id) return 0;
    const a = valueSale(v);
    const b = valueSale(dv);
    return a == null || b == null ? 0 : a - b;
  }
  // Entrega del producto según su modo:
  //  · 'max' (default): los componentes llegan EN PARALELO → manda el más lento.
  //  · 'sum': encadenados EN SERIE (dropshipping: producto internacional →
  //    logística local) → los días se SUMAN.
  const deliveryModeOf = (eq) => (eq && eq.deliveryMode === 'sum' ? 'sum' : 'max');
  function productoBaseDelivery(eq) {
    const sum = deliveryModeOf(eq) === 'sum';
    let acc = 0;
    baseBreakdown(eq).comps.forEach((c) => { acc = sum ? acc + num(c.deliveryDays, 0) : Math.max(acc, num(c.deliveryDays, 0)); });
    return acc;
  }
  function productoDelivery(eq) {
    const r = rules();
    const sum = deliveryModeOf(eq) === 'sum';
    let acc = productoBaseDelivery(eq);
    (eq.groups || []).forEach((g) => {
      const dv = groupDefaultValue(g);
      const c = dv && valueChosen(dv);
      if (c) acc = sum ? acc + num(c.deliveryDays, 0) : Math.max(acc, num(c.deliveryDays, 0));
    });
    return acc + numOr(eq.deliveryExtraDays, r.assemblyDays);
  }

  // ── Compatibilidades ──────────────────────────────────────────────────────
  // Cada componente declara: tags (lo que aporta, ej. "textura:roble, 220v"),
  // requires (lo que necesita de OTROS componentes) y excludes (tags con los
  // que no puede convivir). Un set es válido si todo require se satisface y
  // ningún exclude aparece en los demás.
  function checkSet(comps) {
    const warns = [];
    comps.forEach((c) => {
      const others = comps.filter((x) => x.id !== c.id);
      const uni = new Set();
      others.forEach((o) => (o.tags || []).forEach((t) => uni.add(t)));
      (c.requires || []).forEach((t) => {
        if (!uni.has(t)) warns.push('"' + c.name + '" requiere "' + t + '" y ningún otro componente del set lo aporta.');
      });
      (c.excludes || []).forEach((t) => {
        if (uni.has(t)) warns.push('"' + c.name + '" es incompatible con "' + t + '" presente en el set.');
      });
    });
    return warns;
  }
  function productoWarnings(eq) {
    const warns = [];
    const bb = baseBreakdown(eq);
    bb.comps.forEach((c) => {
      if (!compAvailable(c)) warns.push('Componente base "' + c.name + '" inactivo o sin stock: el producto no se puede armar.');
    });
    const chosenSet = bb.comps.slice(); // compat: base + alternativa elegida de cada paso
    (eq.groups || []).forEach((g) => {
      const label = g.label || typeLabel(g.typeId);
      const vals = groupValues(g);
      if (!vals.length) { warns.push('El paso "' + label + '" no tiene valores definidos.'); return; }
      vals.forEach((v) => {
        // Los valores NEUTROS explícitos ($0, sin componentes) son válidos.
        if (valueIsNeutral(v)) return;
        if (!valueAlts(v).length) warns.push('El valor "' + (v.label || '(sin nombre)') + '" de "' + label + '" no tiene componentes: asígnale alternativas o márcalo como valor neutro ($0). Mientras tanto se excluirá de la tienda.');
        else if (!valueAvailable(v)) warns.push('El valor "' + v.label + '" de "' + label + '" quedó sin alternativas disponibles (inactivas o con stock menor a su cantidad ×' + valueQty(v) + '): se excluirá de la tienda.');
      });
      const dv = groupDefaultValue(g);
      if (dv) { const c = valueChosen(dv); if (c) chosenSet.push(c); }
      else warns.push('El paso "' + label + '" no tiene ningún valor disponible.');
      // Avisos de dependencias: cuando el paso está oculto la tienda cobra su
      // valor por defecto igual — si ese default tiene precio, se recarga sin
      // que el cliente lo vea. Recomendar un default neutro.
      const dep = groupDependsOn(g);
      if (dep) {
        const target = (eq.groups || []).find((x) => x.id === dep.stepId);
        if (!target) warns.push('El paso dependiente "' + label + '" apunta a un paso que ya no existe (se ignorará la dependencia al guardar).');
        else {
          const dvg = dv ? valueGross(dv) : null;
          if (dvg != null && dvg > 0) warns.push('El paso dependiente "' + label + '" tiene un default con precio: cuando quede oculto en la tienda igual se cobrará. Usa como default un valor neutro ($0, sin componentes), ej. "Sin ' + label.toLowerCase() + '".');
        }
      }
    });
    return warns.concat(checkSet(chosenSet));
  }

  // ── CRUD de componentes ───────────────────────────────────────────────────
  function normalizeComponent(draft) {
    return Object.assign({}, draft, {
      id: draft.id || newId('cmp'),
      kind: 'component',
      name: s(draft.name).trim(),
      type: s(draft.type) || 'other',
      brand: s(draft.brand).trim(),
      specs: s(draft.specs).trim(),
      imageUrl: s(draft.imageUrl).trim(),
      currency: draft.currency === 'USD' ? 'USD' : 'CLP',
      cost: num(draft.cost, 0),
      // Impuesto adicional % que se SUMA al costo (aduana/importación); 0 = sin impuesto.
      taxPct: Math.max(0, num(draft.taxPct, 0)),
      supplierName: s(draft.supplierName).trim(),
      supplierUrl: s(draft.supplierUrl).trim(),
      verifiedAt: draft.verifiedAt || null,
      deliveryDays: num(draft.deliveryDays, 0),
      // stock: número = unidades disponibles (0 = no elegible); null = sin control
      stock: draft.stock === '' || draft.stock == null ? null : Math.max(0, num(draft.stock, 0)),
      // productRef: presente si el componente ES un producto de la tienda
      productRef: draft.productRef && draft.productRef.itemId ? draft.productRef : null,
      tags: Array.isArray(draft.tags) ? draft.tags : parseList(draft.tags),
      requires: Array.isArray(draft.requires) ? draft.requires : parseList(draft.requires),
      excludes: Array.isArray(draft.excludes) ? draft.excludes : parseList(draft.excludes),
      active: draft.active !== false,
      notes: s(draft.notes),
      createdAt: draft.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
  }
  async function saveComponent(draft) {
    const item = normalizeComponent(draft);
    if (!item.name) return { success: false, error: 'El componente requiere nombre.' };
    const isNew = !model.components.some((c) => c.id === item.id);
    setModel({ components: isNew ? model.components.concat([item]) : model.components.map((c) => (c.id === item.id ? item : c)) });
    try {
      if (isNew) await shell.items.create(item); else await shell.items.update(item.id, item);
      scheduleRepublish();
      return { success: true, message: 'Componente "' + item.name + '" guardado.', item };
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar el componente: ' + ((e && e.message) || 'error desconocido') });
      await load();
      return { success: false, error: (e && e.message) || 'Error al guardar.' };
    }
  }
  async function removeComponent(id) {
    // En uso = componente base del producto, alternativa de algún valor (v2.1)
    // o componentIds directos de un grupo aún sin migrar (v2.0).
    const used = model.productos.filter((eq) =>
      (eq.baseComponentIds || []).indexOf(id) !== -1 ||
      (eq.groups || []).some((g) =>
        (g.componentIds || []).indexOf(id) !== -1 ||
        groupValues(g).some((v) => (v.componentIds || []).indexOf(id) !== -1)));
    if (used.length) return { success: false, error: 'Está asignado a: ' + used.map((e) => e.name).join(', ') + '. Quítalo de esos productos primero.' };
    setModel({ components: model.components.filter((c) => c.id !== id) });
    try { await shell.items.remove(id); scheduleRepublish(); return { success: true }; }
    catch (e) { await load(); return { success: false, error: 'No se pudo eliminar.' }; }
  }

  // ── CRUD de productos ───────────────────────────────────────────────────────
  // productRef enlaza al item de producto de la app `products`:
  //   { instanceId, itemId, sourceId (id Jumpseller o null), sku, name, imageUrl }
  function productRefOf(eq) {
    const r = eq && eq.productRef;
    return r && r.instanceId && r.itemId ? r : null;
  }
  // Item de producto VIVO desde el catálogo de la app products (si está cargado).
  function productItemFor(eq) {
    const ref = productRefOf(eq);
    return ref ? model.storeCatalog.find((p) => p && p.id === ref.itemId) || null : null;
  }
  // Imagen del producto: SIEMPRE la actual del producto en la tienda (la copia
  // local puede quedar obsoleta si cambian la foto en Jumpseller/products).
  // URL pública del producto: manual (storeUrl) manda; si está vacía y el
  // producto sincronizado trae permalink, se arma con la URL base de la
  // tienda (Publicación) + permalink.
  function productoStoreUrl(eq) {
    if (s(eq.storeUrl).trim()) return s(eq.storeUrl).trim();
    const base = s(model.def && model.def.storeBaseUrl).trim().replace(/\/+$/, '');
    const p = productItemFor(eq);
    if (base && p && p.permalink) return base + '/' + s(p.permalink).replace(/^\/+/, '');
    return '';
  }
  // URL de embebido del visualizador 3D: el visor (repo personalizador →
  // "ProductLab Visualizador") recibe el JSON público (?def=) y el producto
  // (?producto= sku o id) y arma la escena con model3d.{modelUrl,config}.
  function viewerEmbedUrl(eq) {
    const m = (eq && eq.model3d) || {};
    const base = s(m.viewerUrl).trim();
    if (!base) return '';
    const sep = base.indexOf('?') !== -1 ? '&' : '?';
    const ref = s(eq.sku).trim() || eq.id || '';
    return base + sep + 'def=' + encodeURIComponent(publicUrl) + '&producto=' + encodeURIComponent(ref);
  }
  // Todas las fotos de la galería del producto enlazado (pull de products);
  // fallback a la principal si el backend aún no expone images[].
  function productImagesFor(eq) {
    const p = productItemFor(eq);
    if (!p) return [];
    if (Array.isArray(p.images) && p.images.length) return p.images.filter(Boolean).map((u) => String(u));
    return p.imageUrl ? [String(p.imageUrl)] : [];
  }
  // Biblioteca de imágenes del PRODUCTO: las subidas a su galería + toda
  // imagen usada en él (fondos de hero del builder, fotos de valores,
  // hero/secciones legacy). Se persiste en producto.galleryImages al guardar.
  function collectProductoImages(eq) {
    const out = [];
    const push = (u) => { u = s(u).trim(); if (u && out.indexOf(u) === -1) out.push(u); };
    (Array.isArray(eq.galleryImages) ? eq.galleryImages : []).forEach(push);
    const sf = eq.storefront || {};
    (Array.isArray(sf.pageSections) ? sf.pageSections : []).forEach((sec) => { if (sec) push(sec.bgImageUrl); });
    if (sf.hero) push(sf.hero.bgImageUrl);
    (Array.isArray(sf.sections) ? sf.sections : []).forEach((x) => { if (x) push(x.bgImageUrl); });
    (eq.groups || []).forEach((g) => groupValues(g).forEach((v) => push(v.imageUrl)));
    return out;
  }
  function productoImage(eq) {
    const p = productItemFor(eq);
    return (p && p.imageUrl) || eq.imageUrl || '';
  }
  function legacyLink(eq) {
    // Productos creados con la v1 (sourceLinks directos): pedir re-enlace.
    return (eq.sourceLinks || []).find((x) => x && x.integration === 'jumpseller') || null;
  }
  // Migración de formas antiguas de producto (v2.0):
  //  - groups con componentIds directos → valores genéricos (1 alternativa c/u)
  //  - base{cost} manual → un costo adicional "Costo base (migrado)"
  function normalizeProductoShape(raw, comps) {
    const lookup = (id) => (comps || model.components).find((c) => c.id === id) || null;
    const eq = Object.assign({}, raw);
    eq.groups = (eq.groups || []).map((g) => {
      if (Array.isArray(g.values)) return g;
      const values = (g.componentIds || []).map((cid) => {
        const c = lookup(cid);
        return { id: 'val-' + cid, label: c ? c.name : String(cid), componentIds: [cid] };
      });
      return {
        id: g.id, typeId: g.typeId, label: g.label, values,
        defaultValueId: g.defaultId ? 'val-' + g.defaultId : (values[0] && values[0].id) || null,
      };
    });
    // Migración: las specs sembradas antiguamente con los grupos
    // "Base"/"Configuración" pasan a tabla plana (los grupos manuales del
    // usuario con otros nombres se respetan).
    if (eq.storefront && Array.isArray(eq.storefront.specs)) {
      const seeded = (g) => ['base', 'configuración', 'configuracion'].indexOf(norm(g)) !== -1;
      eq.storefront = Object.assign({}, eq.storefront, {
        specs: eq.storefront.specs.map((sp) => (sp && seeded(sp.group) ? Object.assign({}, sp, { group: '' }) : sp)),
      });
    }
    // Migración builder v2.9 → v3: heroes[] pasa a pageSections[] (secciones
    // ordenadas) y se garantizan las secciones specs y nota.
    if (eq.storefront) {
      const sf1 = eq.storefront;
      let page = Array.isArray(sf1.pageSections) ? sf1.pageSections.slice() : [];
      if (!page.length && Array.isArray(sf1.heroes) && sf1.heroes.length) {
        page = sf1.heroes.map((hx) => Object.assign({ kind: 'hero' }, hx));
      }
      if (!page.some((x) => x && x.kind === 'specs')) page.push({ id: newId('ps'), kind: 'specs', show: true });
      if (!page.some((x) => x && x.kind === 'fotos')) page.push({ id: newId('ps'), kind: 'fotos', show: true });
      if (!page.some((x) => x && x.kind === 'note')) page.push({ id: newId('ps'), kind: 'note', show: true });
      eq.storefront = Object.assign({}, sf1, { pageSections: page });
    }
    if (!Array.isArray(eq.baseComponentIds)) eq.baseComponentIds = [];
    if (!Array.isArray(eq.extraCosts)) {
      eq.extraCosts = [];
      if (eq.base && num(eq.base.cost) > 0) {
        eq.extraCosts.push({ id: newId('ec'), label: 'Costo base (migrado)', cost: num(eq.base.cost), currency: eq.base.currency === 'USD' ? 'USD' : 'CLP' });
      }
    }
    delete eq.base;
    return eq;
  }
  // ── Builder de heros (secciones encadenadas de la pestaña Explorar) ──────
  // Cada hero tiene un PATRÓN flexbox (filas de contenedores); cada contenedor
  // recibe una lista ordenada de BLOQUES de contenido. El theme los pinta uno
  // bajo otro; si el producto no define heros, usa el hero clásico de siempre.
  // Celda: string (flex 1) u objeto {id, flex} para columnas con peso distinto.
  const HERO_PATTERNS = [
    { id: 'clasico', label: 'Clásico — 3 columnas (izq / centro / der)', rows: [['top'], ['left', 'center', 'right'], ['bottom']] },
    { id: 'columnas', label: 'Dos columnas (izq / der)', rows: [['top'], ['left', 'right'], ['bottom']] },
    { id: 'apilado', label: 'Apilado (una columna)', rows: [['top'], ['middle'], ['bottom']] },
    { id: 'mosaico', label: 'Mosaico 2×2', rows: [['top'], ['tl', 'tr'], ['bl', 'br'], ['bottom']] },
    { id: 'banda', label: 'Banda simple (izq / der)', rows: [['left', 'right']] },
    { id: 'tercios', label: 'Tres tercios (una fila)', rows: [['a', 'b', 'c']] },
    { id: 'sidebar-izq', label: 'Lateral izquierdo + principal (1/3 – 2/3)', rows: [[{ id: 'side', flex: 1 }, { id: 'main', flex: 2.2 }]] },
    { id: 'sidebar-der', label: 'Principal + lateral derecho (2/3 – 1/3)', rows: [[{ id: 'main', flex: 2.2 }, { id: 'side', flex: 1 }]] },
    { id: 'filas', label: 'Dos filas apiladas', rows: [['r1'], ['r2']] },
    { id: 'destacado', label: 'Destacado + 3 columnas al pie', rows: [['top'], ['main'], ['f1', 'f2', 'f3']] },
    { id: 'mosaico23', label: 'Mosaico 2×3 (seis celdas)', rows: [['a', 'b', 'c'], ['d', 'e', 'f']] },
    { id: 'galeria', label: 'Grande + lateral (2/3 – 1/3)', rows: [['top'], [{ id: 'big', flex: 2.2 }, { id: 'side', flex: 1 }], ['bottom']] },
  ];
  const cellId = (c) => (typeof c === 'string' ? c : c.id);
  const cellFlex = (c) => (typeof c === 'string' ? 1 : (c.flex || 1));
  const heroPattern = (id) => HERO_PATTERNS.find((p) => p.id === id) || HERO_PATTERNS[0];
  const patternCells = (pat) => pat.rows.reduce((a, r) => a.concat(r.map(cellId)), []);
  const CONTAINER_LABELS = {
    top: 'Arriba', bottom: 'Abajo', middle: 'Centro', left: 'Izquierda', center: 'Centro', right: 'Derecha',
    tl: 'Sup. izquierda', tr: 'Sup. derecha', bl: 'Inf. izquierda', br: 'Inf. derecha',
    main: 'Principal', side: 'Lateral', big: 'Grande', r1: 'Fila 1', r2: 'Fila 2',
    f1: 'Pie izq.', f2: 'Pie centro', f3: 'Pie der.',
    a: 'Celda A', b: 'Celda B', c: 'Celda C', d: 'Celda D', e: 'Celda E', f: 'Celda F',
  };
  const HERO_BLOCK_TYPES = [
    { id: 'photo', label: 'Foto del producto', chip: 'FOTO' },
    { id: 'title', label: 'Nombre del producto', chip: 'NOMBRE' },
    { id: 'text', label: 'Texto', chip: 'TEXTO' },
    { id: 'items', label: 'Items (+)', chip: '+' },
    { id: 'cta', label: 'Botón', chip: 'BOTÓN' },
    { id: 'icons', label: 'Iconos destacados', chip: 'ICONOS' },
    { id: 'specs', label: 'Especificaciones (resumen)', chip: 'SPECS' },
    { id: 'gallery', label: 'Foto de la galería', chip: 'GAL' },
    { id: 'html', label: 'HTML libre', chip: 'HTML' },
  ];
  function normalizeHeroBlock(b) {
    if (!b || typeof b !== 'object') return null;
    const base = {
      id: b.id || newId('blk'),
      type: b.type,
      // Alineación horizontal del bloque dentro de su contenedor.
      align: ['left', 'right'].indexOf(b.align) !== -1 ? b.align : 'center',
    };
    if (b.type === 'photo') return Object.assign(base, {
      // 'auto' = alto natural de la foto (sin recorte ni tope de altura)
      size: ['s', 'l', 'xl', 'auto'].indexOf(b.size) !== -1 ? b.size : 'm',
      anim: ['float', 'zoom', 'sway'].indexOf(b.anim) !== -1 ? b.anim : 'none',
    });
    if (b.type === 'title') return base;
    if (b.type === 'text') return Object.assign(base, {
      text: s(b.text).trim(),
      size: ['xl', 'm', 's'].indexOf(b.size) !== -1 ? b.size : 'l',
      color: s(b.color).trim(),
    });
    if (b.type === 'items') return Object.assign(base, {
      float: b.float !== false,
      items: (Array.isArray(b.items) ? b.items : []).map((it) => ({
        id: it.id || newId('hi'), title: s(it.title).trim(), text: s(it.text).trim(),
      })).filter((it) => it.title),
    });
    if (b.type === 'cta') return Object.assign(base, {
      label: s(b.label).trim() || 'Configurar',
      style: ['dark', 'ghost'].indexOf(b.style) !== -1 ? b.style : 'primary',
      action: b.action === 'url' ? 'url' : 'configurar',
      url: s(b.url).trim(),
    });
    if (b.type === 'icons') return Object.assign(base, {
      items: (Array.isArray(b.items) ? b.items : []).map((it) => ({
        id: it.id || newId('ic'), icon: s(it.icon).trim(), title: s(it.title).trim(), text: s(it.text).trim(),
      })).filter((it) => it.title || it.icon),
    });
    if (b.type === 'specs') return Object.assign(base, { count: Math.max(1, Math.min(12, num(b.count, 4))) });
    if (b.type === 'gallery') return Object.assign(base, {
      index: Math.max(1, num(b.index, 1)),
      // 'auto' = alto natural de la foto de la galería
      size: ['s', 'l', 'xl', 'auto'].indexOf(b.size) !== -1 ? b.size : 'm',
    });
    if (b.type === 'html') return Object.assign(base, { html: s(b.html) });
    return null;
  }
  function normalizeHero(hx) {
    if (!hx || typeof hx !== 'object') return null;
    const pat = heroPattern(hx.pattern);
    const slots = {};
    patternCells(pat).forEach((cid) => {
      slots[cid] = (((hx.slots || {})[cid]) || []).map(normalizeHeroBlock).filter(Boolean);
    });
    return {
      id: hx.id || newId('hb'),
      pattern: pat.id,
      // 'auto' = el hero crece según su contenido (sin altura mínima grande)
      height: ['s', 'l', 'xl', 'auto'].indexOf(hx.height) !== -1 ? hx.height : 'm',
      bgColor: s(hx.bgColor).trim(),
      bgImageUrl: s(hx.bgImageUrl).trim(),
      textColor: s(hx.textColor).trim(),
      overlay: hx.overlay !== false,
      slots,
    };
  }

  // Sección del builder de descripción: hero (patrón + bloques), la tabla de
  // especificaciones o la nota — reordenables; specs/nota se ocultan con show.
  function normalizePageSection(x) {
    if (!x || typeof x !== 'object') return null;
    if (x.kind === 'specs' || x.kind === 'note' || x.kind === 'fotos') {
      return { id: x.id || newId('ps'), kind: x.kind, show: x.show !== false };
    }
    // Sección IMAGEN: solo una foto, a lo ancho, cuyo ALTO se adapta a la
    // imagen (sin recortes) — ideal para descripciones hechas de muchas fotos
    // apiladas con alturas distintas. Repetible, como los heros.
    if (x.kind === 'imagen') {
      return {
        id: x.id || newId('ps'),
        kind: 'imagen',
        imageUrl: s(x.imageUrl).trim(),
        alt: s(x.alt).trim(),
        width: x.width === 'full' ? 'full' : 'content',   // full = borde a borde
        link: s(x.link).trim(),
      };
    }
    // Sección VISOR 3D: embebe el visualizador 3D del producto (model3d) en la
    // página, en la posición elegida. Única por ficha.
    if (x.kind === 'visor3d') {
      return { id: x.id || newId('ps'), kind: 'visor3d', height: Math.max(240, Math.min(900, num(x.height, 480))) };
    }
    const hx = normalizeHero(x);
    return hx ? Object.assign({ kind: 'hero' }, hx) : null;
  }

  async function saveProducto(draft) {
    const item = Object.assign({}, normalizeProductoShape(draft), {
      id: draft.id || newId('eq'),
      kind: 'producto',
      name: s(draft.name).trim(),
      sku: s(draft.sku).trim(),
      storeUrl: s(draft.storeUrl).trim(),
      deliveryMode: draft.deliveryMode === 'sum' ? 'sum' : 'max',
      status: draft.status || 'active',
      createdAt: draft.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    item.baseComponentIds = (item.baseComponentIds || []).filter((id) => compById(id));
    item.extraCosts = (item.extraCosts || [])
      .map((x) => ({ id: x.id || newId('ec'), label: s(x.label).trim() || 'Costo adicional', cost: num(x.cost, 0), currency: x.currency === 'USD' ? 'USD' : 'CLP' }))
      .filter((x) => x.cost > 0);
    item.groups = (item.groups || []).map((g) => {
      const values = groupValues(g)
        .map((v) => {
          const componentIds = (v.componentIds || []).filter((id) => compById(id));
          return {
            id: v.id || newId('val'),
            label: s(v.label).trim(),
            imageUrl: s(v.imageUrl).trim(),
            // Color del "puntito" (swatch) en la tienda para pasos de color.
            swatchColor: s(v.swatchColor).trim(),
            // Cantidad de unidades del componente elegido (ej. 2 para "2×8GB").
            qty: Math.max(1, Math.round(num(v.qty, 1)) || 1),
            // Neutro explícito: solo válido si el valor NO tiene componentes.
            neutral: v.neutral === true && !componentIds.length,
            componentIds,
          };
        })
        .filter((v) => v.label);
      return {
        id: g.id || newId('grp'),
        typeId: s(g.typeId) || 'other',
        label: s(g.label).trim(),
        // photoStep: la selección de este paso cambia la foto del producto en
        // la tienda (ej. color) usando la imagen del valor elegido.
        photoStep: g.photoStep === true,
        // dependsOn: visibilidad condicionada a un paso anterior (se sanea abajo).
        dependsOn: g.dependsOn || null,
        values,
        defaultValueId: values.some((v) => v.id === g.defaultValueId) ? g.defaultValueId : (values[0] && values[0].id) || null,
      };
    });
    item.groups = normalizeDependsOn(item.groups);
    // Ficha de tienda (pestañas Explorar/Especificaciones del theme):
    const sf = draft.storefront || {};
    const hero = sf.hero || {};
    item.storefront = {
      hero: {
        bgImageUrl: s(hero.bgImageUrl).trim(),
        titleColor: s(hero.titleColor).trim(),
        headline: s(hero.headline).trim(),
        ctaText: s(hero.ctaText).trim(),
        layout: ['left', 'right', 'stack'].indexOf(hero.layout) !== -1 ? hero.layout : 'center',
        height: ['s', 'l', 'xl'].indexOf(hero.height) !== -1 ? hero.height : 'm',
        photoPos: ['left', 'right'].indexOf(hero.photoPos) !== -1 ? hero.photoPos : 'center',
        photoVAlign: ['top', 'bottom'].indexOf(hero.photoVAlign) !== -1 ? hero.photoVAlign : 'center',
        photoSize: ['s', 'l', 'xl'].indexOf(hero.photoSize) !== -1 ? hero.photoSize : 'm',
        photoAnim: ['float', 'zoom', 'sway'].indexOf(hero.photoAnim) !== -1 ? hero.photoAnim : 'none',
        titleH: ['center', 'right'].indexOf(hero.titleH) !== -1 ? hero.titleH : 'left',
        titleV: hero.titleV === 'bottom' ? 'bottom' : 'top',
        float: hero.float !== false,
        items: (Array.isArray(hero.items) ? hero.items : []).map((it) => ({
          id: it.id || newId('hi'),
          title: s(it.title).trim(),
          text: s(it.text).trim(),
          side: ['left', 'right'].indexOf(it.side) !== -1 ? it.side : 'auto',
        })).filter((it) => it.title),
      },
      specs: (Array.isArray(sf.specs) ? sf.specs : []).map((sp) => ({
        id: sp.id || newId('sp'),
        group: s(sp.group).trim(),
        label: s(sp.label).trim(),
        value: s(sp.value).trim(),
      })).filter((sp) => sp.label || sp.value),
      // Nota discreta bajo la grilla de fotos del theme (condiciones,
      // aclaraciones de lo que muestran las fotos). Vacía = no se muestra.
      photosNote: s(sf.photosNote).trim(),
      // Builder de descripción del producto: secciones ordenadas (heros +
      // especificaciones + nota). Specs y nota existen exactamente una vez.
      pageSections: (function () {
        const seen = {};
        // hero e imagen son repetibles; specs/fotos/note/visor3d existen una vez.
        const out = (Array.isArray(sf.pageSections) ? sf.pageSections : [])
          .map(normalizePageSection).filter(Boolean)
          .filter((x) => ((x.kind === 'hero' || x.kind === 'imagen') ? true : (seen[x.kind] ? false : (seen[x.kind] = true))));
        if (!seen.specs) out.push({ id: newId('ps'), kind: 'specs', show: true });
        if (!seen.fotos) out.push({ id: newId('ps'), kind: 'fotos', show: true });
        if (!seen.note) out.push({ id: newId('ps'), kind: 'note', show: true });
        return out;
      })(),
      // Estilo del configurador y de la página en la tienda (vacío = colores y
      // tipografías del theme del sitio). El previsualizador de Pasos lo refleja.
      style: (function () {
        const st = sf.style || {};
        return {
          accentColor: s(st.accentColor).trim(),
          bgColor: s(st.bgColor).trim(),
          radius: Math.max(0, Math.min(24, num(st.radius, 0))),
          cardStyle: ['list', 'compact'].indexOf(st.cardStyle) !== -1 ? st.cardStyle : 'cards',
          showDeltas: ['total', 'none'].indexOf(st.showDeltas) !== -1 ? st.showDeltas : 'delta',
          stepsCollapsed: st.stepsCollapsed === true,
        };
      })(),
      // Pestañas de la barra: títulos (vacío = default), visibilidad y orden.
      tabs: (function () {
        const t = sf.tabs || {};
        const order = (Array.isArray(t.order) ? t.order : []).filter((x) => ['explorar', 'specs', 'fotos'].indexOf(x) !== -1);
        ['explorar', 'specs', 'fotos'].forEach((x) => { if (order.indexOf(x) === -1) order.push(x); });
        return {
          explorar: s(t.explorar).trim(),
          fotos: s(t.fotos).trim(),
          specs: s(t.specs).trim(),
          comprar: s(t.comprar).trim(),
          showSpecs: t.showSpecs !== false,
          showFotos: t.showFotos !== false,
          order,
        };
      })(),
      // Secciones/slides de la pestaña Explorar (debajo del hero).
      sections: (Array.isArray(sf.sections) ? sf.sections : []).map((sec) => ({
        id: sec.id || newId('sec'),
        title: s(sec.title).trim(),
        text: s(sec.text).trim(),
        bgColor: s(sec.bgColor).trim(),
        bgImageUrl: s(sec.bgImageUrl).trim(),
        textColor: s(sec.textColor).trim(),
        layout: ['iconos', 'lista'].indexOf(sec.layout) !== -1 ? sec.layout : 'texto',
        items: (Array.isArray(sec.items) ? sec.items : []).map((it) => ({
          id: it.id || newId('si'),
          title: s(it.title).trim(),
          text: s(it.text).trim(),
        })).filter((it) => it.title || it.text),
      })).filter((sec) => sec.title || sec.text || sec.items.length),
    };
    // Visualizador 3D del producto (herencia del personalizador): visor web
    // embebible + modelo GLB + configuración de partes/texturas + AR opcional.
    const v3 = draft.model3d || {};
    item.model3d = {
      enabled: v3.enabled === true,
      viewerUrl: s(v3.viewerUrl).trim(),      // URL del visualizador desplegado
      modelUrl: s(v3.modelUrl).trim(),        // GLB del producto
      arUrl: s(v3.arUrl).trim(),              // GLB para AR vía /api/public/app/{id}/ar/… (ruta /api/public/files/…)
      bindStepId: s(v3.bindStepId).trim(),    // paso cuya selección elige textura/acabado en el visor
      config: v3.config && typeof v3.config === 'object' && !Array.isArray(v3.config) ? v3.config : null,
    };
    // Galería del producto: unión de la biblioteca manual + imágenes en uso.
    item.galleryImages = collectProductoImages(item);
    item.price = productoComputedPrice(item);
    if (!item.name) return { success: false, error: 'El producto requiere nombre.' };
    const isNew = !model.productos.some((e) => e.id === item.id);
    setModel({ productos: isNew ? model.productos.concat([item]) : model.productos.map((e) => (e.id === item.id ? item : e)) });
    try {
      if (isNew) await shell.items.create(item); else await shell.items.update(item.id, item);
      scheduleRepublish();
      return { success: true, message: 'Producto "' + item.name + '" guardado en ' + fmtCLP(item.price) + '.', item };
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo guardar el producto: ' + ((e && e.message) || 'error desconocido') });
      await load();
      return { success: false, error: (e && e.message) || 'Error al guardar.' };
    }
  }
  async function removeProducto(id) {
    setModel({ productos: model.productos.filter((e) => e.id !== id) });
    try { await shell.items.remove(id); scheduleRepublish(); return { success: true }; }
    catch (e) { await load(); return { success: false, error: 'No se pudo eliminar.' }; }
  }

  // ── Aplicar a la tienda: options + variants escritos en la app products ───
  const WARN_COMBOS = 150;   // sobre esto, avisar (mantenimiento pesado en JS)
  const MAX_COMBOS = 400;    // sobre esto, no aplicar (riesgo de límites/timeout)
  function comboCount(eq) {
    const groups = (eq.groups || []).map((g) => groupValues(g).filter(valueAvailable).length).filter((n) => n > 0);
    return groups.length ? groups.reduce((a, b) => a * b, 1) : 0;
  }
  async function fetchProductItem(ref) {
    // Estado actual del item de producto: preserva sourceOptionId/sourceValueId/
    // sourceVariantId para actualizar en vez de recrear en Jumpseller.
    if (!shell.data || !shell.data.listItems) return null;
    try {
      const items = await shell.data.listItems(ref.instanceId);
      return (items || []).find((p) => p && p.id === ref.itemId) || null;
    } catch (e) { return null; }
  }
  function buildStoreOptions(eq, existing) {
    const exByName = new Map();
    (((existing || {}).options) || []).forEach((o) => { if (o && o.name) exByName.set(norm(o.name), o); });
    return (eq.groups || []).map((g) => {
      const label = g.label || typeLabel(g.typeId);
      const ex = exByName.get(norm(label)) || {};
      const exVals = new Map();
      ((ex.values) || []).forEach((v) => { if (v && v.name) exVals.set(norm(v.name), v); });
      // Los valores de la tienda son las ETIQUETAS genéricas (sin marca).
      const odef = { name: label, optionType: 'option', values: groupValues(g).filter(valueAvailable).map((v) => {
        const exv = exVals.get(norm(v.label));
        const out = { name: v.label };
        if (exv && exv.sourceValueId) out.sourceValueId = exv.sourceValueId;
        return out;
      }) };
      if (ex.sourceOptionId) odef.sourceOptionId = ex.sourceOptionId;
      return odef;
    })
    // Un paso sin ningún valor disponible se EXCLUYE (igual que en las
    // variantes): una opción sin valores en Jumpseller rompería el matching.
    .filter((o) => o.values.length > 0);
  }
  function buildStoreVariants(eq, existing) {
    const baseGross = baseBreakdown(eq).gross;
    const groups = (eq.groups || [])
      .map((g) => ({ label: g.label || typeLabel(g.typeId), vals: groupValues(g).filter(valueAvailable) }))
      .filter((g) => g.vals.length > 0);
    if (!groups.length) return [];
    const sig = (opts) => JSON.stringify(Object.keys(opts || {}).sort().map((k) => [norm(k), norm(opts[k])]));
    const exBySig = new Map();
    (((existing || {}).variants) || []).forEach((v) => { if (v && v.options) exBySig.set(sig(v.options), v); });
    // Producto cartesiano de valores; el costo de cada valor es SIEMPRE el de
    // su alternativa más económica disponible en este momento.
    let combos = [{ opts: {}, gross: baseGross }];
    groups.forEach((g) => {
      const next = [];
      combos.forEach((c) => g.vals.forEach((v) => {
        const opts = Object.assign({}, c.opts);
        opts[g.label] = v.label;
        next.push({ opts, gross: c.gross + valueGross(v) });
      }));
      combos = next;
    });
    return combos.map((c) => {
      const ex = exBySig.get(sig(c.opts));
      const v = { options: c.opts, price: roundFinal(c.gross) };
      if (ex && ex.sourceVariantId) v.sourceVariantId = ex.sourceVariantId;
      return v;
    });
  }
  async function applyToStore(eq) {
    const ref = productRefOf(eq);
    if (!ref) return { success: false, error: 'El producto no está enlazado a un producto de la tienda (usa "Enlazar producto…").' };
    if (!shell.authFetch) return { success: false, error: 'authFetch no disponible en este host.' };
    // Sin pasos = producto SIMPLE (dropshipping): precio directo, sin opciones
    // ni variantes — el theme muestra "Añadir al carro" en vez de "Configurar".
    const hasSteps = (eq.groups || []).length > 0;
    const n = comboCount(eq);
    if (hasSteps && n === 0) return { success: false, error: 'Hay pasos sin componentes activos.' };
    if (n > MAX_COMBOS) return { success: false, error: 'Demasiadas combinaciones (' + n + ' variantes; máximo ' + MAX_COMBOS + '). Reduce alternativas por paso o divide el producto.' };
    const existing = await fetchProductItem(ref);
    // Sin el estado actual del item NO se aplica: se regenerarían opciones y
    // variantes sin sourceIds y el push las recrearía en Jumpseller (ids
    // nuevos, carros/URLs con variant_id rotos).
    if (!existing && shell.data && shell.data.listItems) {
      return { success: false, error: 'No se pudo leer el producto enlazado desde la app Productos (¿instancia visible? ¿item eliminado?). Revisa el enlace del producto y reintenta.' };
    }
    const options = buildStoreOptions(eq, existing);
    const variants = buildStoreVariants(eq, existing);
    const price = productoComputedPrice(eq);
    try {
      // 1) Persistir en el item del producto (merge; auto-push de campos base).
      const putRes = await shell.authFetch(API + '/api/app-instances/' + ref.instanceId + '/items/' + ref.itemId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        // customFields: el backend (parcheado) asegura el custom field en
        // Jumpseller tras el push — activa la vista personalizada del theme
        // sin pasos manuales.
        body: JSON.stringify({ price, options, variants, customFields: { diseno: 'personalizado' }, syncStatus: 'pending' }),
      });
      if (!putRes.ok) {
        const d = await putRes.json().catch(() => ({}));
        return { success: false, error: s(d.detail) || 'HTTP ' + putRes.status + ' al escribir el producto.' };
      }
      // 2) sync-push: empuja opciones y variantes a Jumpseller y persiste ids.
      const pushRes = await shell.authFetch(API + '/api/app-instances/' + ref.instanceId + '/items/sync-push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [ref.itemId] }),
      });
      const data = await pushRes.json().catch(() => ({}));
      if (!pushRes.ok) return { success: false, error: s(data.detail) || 'HTTP ' + pushRes.status + ' en sync-push.' };
      const itemRes = (data.results || {})[ref.itemId] || {};
      const js = ((itemRes.results || {}).jumpseller) || {};
      // Los avisos de custom field NO bloquean (se puede poner a mano):
      // solo los errores de producto/opciones/variantes marcan sync_error.
      const cfWarns = js.customFieldErrors || [];
      const errs = [].concat(js.optionErrors || [], js.variantErrors || [], js.ok === false && js.error ? [js.error] : []);
      const status = errs.length ? ((data.syncStatusByItem || {})[ref.itemId] || 'sync_error') : 'synced';
      const updated = Object.assign({}, eq, {
        price,
        lastPush: { at: nowIso(), status, errors: errs.slice(0, 5), warnings: cfWarns.slice(0, 3), variantCount: variants.length },
        // Refrescar la copia local de nombre/sku/imagen desde la tienda (la
        // foto del producto puede haber cambiado desde el enlace inicial).
        imageUrl: (existing && existing.imageUrl) || eq.imageUrl,
        productRef: existing ? Object.assign({}, ref, {
          name: existing.name || ref.name,
          sku: existing.sku || ref.sku,
          imageUrl: existing.imageUrl || ref.imageUrl,
        }) : ref,
        updatedAt: nowIso(),
      });
      setModel({ productos: model.productos.map((e) => (e.id === eq.id ? updated : e)) });
      try { await shell.items.update(eq.id, updated); } catch (e) { /* estado local ya refleja */ }
      scheduleRepublish();
      if (errs.length) return { success: false, status, error: 'Sincronizado con errores: ' + errs.join(' · ') };
      const cfNote = cfWarns.length ? ' (aviso: ' + cfWarns.join(' · ') + ' — puedes ponerlo a mano en el admin)' : '';
      return { success: true, status, message: '"' + eq.name + '" aplicado: ' + fmtCLP(price) + (variants.length ? ', ' + options.length + ' opciones, ' + variants.length + ' variantes.' : ' — producto simple sin variantes (compra directa).') + cfNote };
    } catch (e) { return { success: false, error: (e && e.message) || 'Error de red.' }; }
  }

  // ── Recalcular precios (tras cambiar costos o reglas) ─────────────────────
  function recalcPreview() {
    return model.productos
      .map((eq) => ({ eq, oldPrice: num(eq.price), nextPrice: productoComputedPrice(eq) }))
      .filter((x) => x.oldPrice !== x.nextPrice);
  }
  async function recalcApply() {
    const changes = recalcPreview();
    const results = [];
    for (const ch of changes) {
      // Enlazado: applyToStore persiste el precio local Y empuja opciones/
      // variantes recalculadas a la tienda. Sin enlace: solo guardar local.
      const r = productRefOf(ch.eq) ? await applyToStore(ch.eq) : await saveProducto(ch.eq);
      results.push({ name: ch.eq.name, from: ch.oldPrice, to: ch.nextPrice, success: r.success, error: r.error });
    }
    if (model.def && model.def.public && model.def.public.enabled) await publish(true); // re-publicar configurador
    return results;
  }

  // ── Catálogo de la app products (picker de enlace) ────────────────────────
  async function loadStoreCatalog() {
    if (!shell.data || !shell.data.listInstances) { setModel({ storeCatalog: [], storeCatalogLoaded: true }); return; }
    try {
      const instances = await shell.data.listInstances('products');
      const all = [];
      for (const inst of instances || []) {
        try {
          const items = await shell.data.listItems(inst.id);
          (items || []).forEach((p) => {
            if (p && p.name && p.kind !== 'definition') all.push(Object.assign({}, p, { __instanceId: inst.id }));
          });
        } catch (e) { /* instancia sin acceso */ }
      }
      setModel({ storeCatalog: all, storeCatalogLoaded: true, storeCatalogError: null });
    } catch (e) { setModel({ storeCatalog: [], storeCatalogLoaded: true, storeCatalogError: (e && e.message) || 'Sin acceso a la app Productos.' }); }
  }

  // ── Publicación (JSON del configurador para el theme) ─────────────────────
  function buildPublicData() {
    const r = rules();
    // version 2 = contrato ProductLab: clave `productos` (el theme kit acepta
    // también `equipos` por compatibilidad con la app de computadores),
    // dependsOn/qty en los pasos, storefront.style y model3d por producto.
    return {
      version: 2,
      updatedAt: nowIso(),
      currency: 'CLP',
      store: 'productlab',
      productos: model.productos.filter((eq) => eq.status !== 'inactive').map((eq) => {
        const ref = productRefOf(eq);
        const legacy = legacyLink(eq);
        return {
          sku: eq.sku || '',
          productId: (ref && ref.sourceId) || (legacy && legacy.sourceId) || null,
          name: eq.name,
          basePrice: productoComputedPrice(eq),
          deliveryDays: productoDelivery(eq),
          assemblyDays: numOr(eq.deliveryExtraDays, r.assemblyDays),
          deliveryMode: deliveryModeOf(eq),
          baseDeliveryDays: productoBaseDelivery(eq),
          imageUrl: productoImage(eq),
          // Ficha de tienda: builder de secciones + specs + estilo (style)
          storefront: eq.storefront || null,
          // Visualizador 3D (solo si está habilitado): el theme puede embeber
          // embedUrl en la sección visor3d y ofrecer AR con arUrl vía
          // GET /api/public/app/{instanceId}/ar/{sku}.glb?m=Material:hex,…
          model3d: (function () {
            const m = eq.model3d || {};
            if (m.enabled !== true) return null;
            return {
              enabled: true,
              viewerUrl: m.viewerUrl || '',
              modelUrl: m.modelUrl || '',
              arUrl: m.arUrl || '',
              bindStepId: m.bindStepId || '',
              config: m.config || null,
              embedUrl: viewerEmbedUrl(eq),
            };
          })(),
          groups: (eq.groups || []).map((g) => {
            const dv = groupDefaultValue(g);
            return {
              id: g.id,
              label: g.label || typeLabel(g.typeId),
              type: g.typeId,
              affectsPhoto: g.photoStep === true,
              // Dependencia: el theme oculta este paso salvo que el paso
              // dependsOn.groupId tenga seleccionado uno de dependsOn.valueIds
              // (oculto = usa su valor por defecto).
              dependsOn: (function () {
                const d = groupDependsOn(g);
                return d ? { groupId: d.stepId, valueIds: d.valueIds.slice() } : null;
              })(),
              // Valores genéricos: nombre SIN marca; el detalle (specs, imagen,
              // entrega, compatibilidades) sale de la alternativa elegida
              // (la más económica disponible) al momento de publicar.
              values: groupValues(g).filter(valueAvailable).map((v) => {
                const alt = valueChosen(v);
                return {
                  id: v.id,
                  name: v.label,
                  // qty informativa (el nombre ya debería decirlo: "2×8GB");
                  // neutral = valor de $0 sin componentes ("Sin accesorio").
                  qty: valueQty(v),
                  neutral: valueIsNeutral(v),
                  desc: alt ? alt.specs || '' : '',
                  swatchColor: v.swatchColor || '',
                  imageUrl: v.imageUrl || (alt ? alt.imageUrl || '' : ''),
                  delta: deltaFor(g, v),
                  deliveryDays: alt ? num(alt.deliveryDays, 0) : 0,
                  tags: alt ? alt.tags || [] : [],
                  requires: alt ? alt.requires || [] : [],
                  excludes: alt ? alt.excludes || [] : [],
                  isDefault: !!(dv && dv.id === v.id),
                };
              }),
            };
          })
          // Igual que en la tienda: un paso sin valores disponibles no se
          // publica (el configurador no tendría nada que pintar para él).
          .filter((g) => g.values.length > 0),
        };
      }),
    };
  }
  // Republicación automática: cualquier cambio que afecte lo publicado
  // (componentes, productos, reglas) regenera el JSON público solo, con un
  // pequeño debounce para agrupar ediciones seguidas. Cero botón "Republicar".
  let republishTimer = null;
  function scheduleRepublish() {
    const pub = model.def && model.def.public;
    if (!pub || pub.enabled !== true) return;
    if (republishTimer) clearTimeout(republishTimer);
    republishTimer = setTimeout(() => {
      republishTimer = null;
      void publish(true);
    }, 1200);
  }
  async function publish(enabled) {
    const def = Object.assign({}, model.def || defaultDefinition());
    def.public = { enabled: !!enabled, channels: [], data: enabled ? buildPublicData() : (def.public && def.public.data) || null };
    return saveDefinition(def);
  }
  // Payload exacto que se escribe en el item de la app products al aplicar
  // (inspección/depuración desde la pestaña Publicación).
  function storePlan(eq) {
    const ref = productRefOf(eq);
    return {
      productRef: ref || null,
      price: productoComputedPrice(eq),
      options: buildStoreOptions(eq, null),
      variants: buildStoreVariants(eq, null),
    };
  }

  // ── Agente IA ─────────────────────────────────────────────────────────────
  let offAgent = null;
  function findComponent(ref) {
    const key = s(ref).trim();
    if (!key) return null;
    return model.components.find((c) => c.id === key)
      || model.components.find((c) => norm(c.name) === norm(key))
      || model.components.find((c) => norm(c.name).indexOf(norm(key)) !== -1)
      || null;
  }
  function findProducto(ref) {
    const key = s(ref).trim();
    if (!key) return null;
    return model.productos.find((e) => e.id === key)
      || model.productos.find((e) => norm(e.name) === norm(key))
      || model.productos.find((e) => s(e.sku).trim() !== '' && norm(e.sku) === norm(key))
      || model.productos.find((e) => norm(e.name).indexOf(norm(key)) !== -1)
      || null;
  }
  if (shell.agent && typeof shell.agent.register === 'function') {
    offAgent = shell.agent.register({
      label: 'ProductLab',
      description: 'Laboratorio de productos personalizables de la tienda: componentes (costos de proveedor, stock, compatibilidades), reglas de margen, productos con sus pasos de configuración, la ficha de tienda (builder de descripción, especificaciones, nota, pestañas), el enlace con productos Jumpseller y la publicación del configurador.',
      tools: [
        { name: 'UPSERT_COMPONENT', description: 'Crea o actualiza un componente por nombre.',
          inputSchema: { type: 'object', properties: {
            name: { type: 'string' }, type: { type: 'string', description: 'id de un tipo de componente definido en Precios (ver snapshot.types); default other' },
            cost: { type: 'number' }, currency: { type: 'string', description: 'CLP|USD' },
            taxPct: { type: 'number', description: 'impuesto adicional % que se SUMA al costo (aduana/importación); 0 = sin' },
            supplierName: { type: 'string' }, supplierUrl: { type: 'string' },
            specs: { type: 'string' }, imageUrl: { type: 'string' }, deliveryDays: { type: 'number' },
            stock: { type: 'number', description: 'unidades; 0 = no elegible; omitir = sin control' },
            tags: { type: 'string', description: 'coma-separado, ej: textura:roble, montaje:pared' },
            requires: { type: 'string' }, excludes: { type: 'string' },
          }, required: ['name'] } },
        { name: 'SET_COMPONENT_COST', description: 'Actualiza el costo de proveedor de un componente y lo marca verificado hoy.',
          inputSchema: { type: 'object', properties: {
            component: { type: 'string', description: 'id o nombre' }, cost: { type: 'number' }, currency: { type: 'string' },
          }, required: ['component', 'cost'] } },
        { name: 'SET_MARGIN', description: 'Fija el margen % por tipo de componente (o "default" / "base").',
          inputSchema: { type: 'object', properties: {
            type: { type: 'string' }, marginPct: { type: 'number' },
          }, required: ['type', 'marginPct'] } },
        { name: 'RECALC_PRICES', description: 'Recalcula precios de todos los productos según costos y reglas. apply=true persiste y aplica a la tienda (producto + opciones + variantes por combinación).',
          inputSchema: { type: 'object', properties: { apply: { type: 'boolean' } } } },
        { name: 'APPLY_PRODUCTO', description: 'Aplica un producto a la tienda: escribe precio, opciones y variantes (precio por combinación) en su producto Jumpseller vía la app products.',
          inputSchema: { type: 'object', properties: { producto: { type: 'string', description: 'id o nombre' } }, required: ['producto'] } },
        { name: 'UPSERT_PRODUCTO', description: 'Crea o actualiza los datos básicos de un producto por nombre (los pasos se gestionan con SET_PRODUCTO_STEPS y la ficha con SET_STOREFRONT).',
          inputSchema: { type: 'object', properties: {
            name: { type: 'string' }, sku: { type: 'string' },
            status: { type: 'string', description: 'active|inactive' },
            deliveryExtraDays: { type: 'number', description: 'días de preparación/producción; null = regla global' },
            deliveryMode: { type: 'string', description: 'max = en paralelo (manda el más lento) | sum = en serie, los días de entrega se SUMAN (dropshipping)' },
            storeUrl: { type: 'string', description: 'URL manual del producto (vacío = automática: URL base + permalink)' },
          }, required: ['name'] } },
        { name: 'SET_PRODUCTO_STEPS', description: 'Reemplaza los pasos de configuración de un producto. Cada paso: {label, type?, photoStep?, default?, dependsOn?, values: [{label, qty?, imageUrl?, swatchColor?, components: [nombre o id, …]}]}. qty = cantidad del componente en ese valor (ej. 2 para "2×8GB"); un valor con components:[] y neutral:true es NEUTRO ($0, ej. "Sin accesorio" — el flag es obligatorio, sin él un valor sin componentes queda no disponible). dependsOn = {step: <label de un paso ANTERIOR>, values: [<labels que lo hacen visible>]} — paso condicional que la tienda oculta si no se cumple (oculto usa su default; hazlo neutro). Los componentes se referencian por nombre; se reusan los ids de pasos/valores existentes con el mismo label (preserva el matching con la tienda). Lee el snapshot (productos[].steps) para la estructura actual.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string', description: 'id o nombre' },
            steps: { type: 'array', items: { type: 'object' }, description: 'lista COMPLETA de pasos (reemplaza los actuales)' },
          }, required: ['producto', 'steps'] } },
        { name: 'SET_MODEL3D', description: 'Configura el visualizador 3D del producto (herencia del personalizador): visor web embebible + modelo GLB + configuración de partes/texturas + AR. Solo se reemplazan los campos enviados. Para mostrarlo en la página, agrega una sección {"kind":"visor3d"} con SET_STOREFRONT.pageSections.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string', description: 'id o nombre' },
            enabled: { type: 'boolean' },
            viewerUrl: { type: 'string', description: 'URL del visualizador desplegado (recibe ?def=…&producto=…)' },
            modelUrl: { type: 'string', description: 'URL del modelo GLB' },
            arUrl: { type: 'string', description: 'GLB para AR: ruta /api/public/files/… de KIMOS (opcional)' },
            bindStep: { type: 'string', description: 'label del paso cuya selección elige la textura/acabado en el visor (opcional)' },
            config: { type: 'object', description: 'configuración del visor: {parts:[{id,label,materials[]}], finishes:[{id,label,color,texture,roughness,textureScale,grain}]} (o string JSON)' },
          }, required: ['producto'] } },
        { name: 'COMPOSE_HERO', description: 'ARMA o reemplaza un hero del producto SIN construir estructura anidada: entregas los contenidos como campos simples y la app compone los bloques y contenedores correctamente. PREFIERE esta tool sobre SET_STOREFRONT.pageSections para crear o editar heros.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string', description: 'id o nombre' },
            headline: { type: 'string', description: 'frase grande destacada (ej: "Crea sin límites")' },
            text: { type: 'string', description: 'párrafo breve adicional (opcional)' },
            features: { type: 'array', items: { type: 'object' }, description: 'características: [{title, text?}, …] (title corto, text detalle). Para REDISTRIBUIR un hero existente, reenvía sus contenidos (están en productos[].storefront) con el reparto deseado.' },
            featuresRightCount: { type: 'number', description: 'cuántas de las características van al LADO DERECHO de la foto (el resto queda a la izquierda); 0/omitido = todas a la izquierda' },
            ctaLabel: { type: 'string', description: 'texto del botón (vacío = automático)' },
            showTitle: { type: 'boolean', description: 'mostrar el nombre del producto (default true)' },
            showPhoto: { type: 'boolean', description: 'mostrar la foto del producto (default true)' },
            photoSize: { type: 'string', description: 's|m|l|xl (default l)' },
            pattern: { type: 'string', description: 'patrón del hero (ver builderRef.patterns; default clasico)' },
            height: { type: 'string', description: 's|m|l|xl (default l)' },
            bgColor: { type: 'string', description: '#hex de fondo (opcional)' },
            bgImageUrl: { type: 'string', description: 'imagen de fondo (opcional, tapa el color)' },
            textColor: { type: 'string', description: '#hex del texto (vacío = automático)' },
            heroIndex: { type: 'number', description: 'cuál hero reemplazar (1 = primero, default); si no hay heros se agrega al inicio' },
          }, required: ['producto'] } },
        { name: 'SET_STOREFRONT', description: 'Edita la ficha de tienda de un producto: pageSections (builder de descripción: secciones hero/imagen/visor3d/specs/fotos/note), specs (tabla), photosNote (nota), tabs (pestañas) y style (estilo del configurador). El contrato EXACTO de pageSections está en snapshot.builderRef: sectionShape (forma de cada tipo de sección), blockSchema (campos de cada tipo de bloque), example (sección de ejemplo) y patterns[].containers (celdas válidas por patrón); el estado actual está en productos[].storefront.pageSections — para editar, parte de ese estado y modifícalo. pageSections REEMPLAZA la lista completa; secciones o bloques mal formados se rechazan con detalle (nada se pierde en silencio). Solo se reemplaza lo que envíes; todo pasa por la normalización de la app y se republica solo.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string' },
            pageSections: { type: 'array', items: { type: 'object' }, description: 'lista COMPLETA de secciones según builderRef.sectionShape; bloques en slots:{contenedor:[…]} según builderRef.blockSchema' },
            allowEmpty: { type: 'boolean', description: 'obligatorio en true para guardar pageSections que dejen la ficha sin bloques (protección anti-borrado)' },
            specs: { type: 'array', items: { type: 'object' }, description: 'filas {group?, label, value}' },
            photosNote: { type: 'string' },
            tabs: { type: 'object', description: '{explorar?, specs?, fotos?, comprar?, showSpecs?, showFotos?, order?}' },
            style: { type: 'object', description: 'estilo del configurador en la tienda: {accentColor? "#hex", bgColor? "#hex", radius? 0-24, cardStyle? "cards|list|compact", showDeltas? "delta|total|none", stepsCollapsed? bool} — vacío = theme del sitio' },
          }, required: ['producto'] } },
        { name: 'LINK_PRODUCT', description: 'Enlaza un producto a un producto del catálogo de la app Productos (por nombre, SKU o id Jumpseller). Luego usa APPLY_PRODUCTO para escribir en la tienda.',
          inputSchema: { type: 'object', properties: { producto: { type: 'string' }, product: { type: 'string' } }, required: ['producto', 'product'] } },
        { name: 'SET_STOCK', description: 'Actualiza el stock de uno o varios componentes (null/vacío = sin control; 0 = no elegible).',
          inputSchema: { type: 'object', properties: {
            component: { type: 'string' }, stock: { type: 'number' },
            items: { type: 'array', items: { type: 'object' }, description: '[{component, stock}, …] para actualización masiva' },
          } } },
        { name: 'PUBLISH_CONFIG', description: 'Publica (enabled=true) o despublica (enabled=false) el JSON del configurador que consume el theme.',
          inputSchema: { type: 'object', properties: { enabled: { type: 'boolean' } } } },
        { name: 'IMPORT_IMAGE', description: 'Importa una imagen al área pública de la app y devuelve su URL, para usarla luego en SET_STOREFRONT (fondo de hero) o como foto de un valor. Acepta: el path de un adjunto del chat en el File Storage del equipo de trabajo (aparece como "[Adjunto … — path: …]" en el mensaje), una ruta /api/… de KIMOS, o una URL http(s) accesible. Solo imágenes, máx 8 MB.',
          inputSchema: { type: 'object', properties: {
            url: { type: 'string', description: 'path del storage del equipo de trabajo (ej: chat/foto.png), ruta /api/… o URL http(s)' },
            name: { type: 'string', description: 'nombre de archivo destino (opcional)' },
            producto: { type: 'string', description: 'opcional: id o nombre de un producto — la imagen queda además en su galería (productos[].galleryImages) para reutilizarla' },
          }, required: ['url'] } },
      ],
      getSnapshot: () => ({
        rules: rules(),
        types: types(),
        components: model.components.map((c) => ({
          id: c.id, name: c.name, type: c.type, cost: c.cost, currency: c.currency, taxPct: num(c.taxPct, 0),
          salePrice: componentSale(c), supplierUrl: c.supplierUrl, supplierName: c.supplierName,
          verifiedAt: c.verifiedAt, staleDays: daysSince(c.verifiedAt) === Infinity ? null : daysSince(c.verifiedAt),
          active: c.active !== false, stock: c.stock == null ? null : num(c.stock),
          available: compAvailable(c), tags: c.tags, requires: c.requires, excludes: c.excludes,
        })),
        productos: model.productos.map((eq) => ({
          id: eq.id, name: eq.name, sku: eq.sku, price: eq.price, computedPrice: productoComputedPrice(eq),
          linked: !!productRefOf(eq), variantCombos: comboCount(eq), deliveryDays: productoDelivery(eq),
          deliveryMode: deliveryModeOf(eq),
          storeUrl: productoStoreUrl(eq) || null,
          productImages: productImagesFor(eq),
          galleryImages: collectProductoImages(eq),
          lastPush: eq.lastPush || null, warnings: productoWarnings(eq),
          // Pasos de configuración (editable con SET_PRODUCTO_STEPS)
          steps: (eq.groups || []).map((g) => ({
            label: g.label || typeLabel(g.typeId), type: g.typeId, photoStep: g.photoStep === true,
            // dependsOn en formato de SET_PRODUCTO_STEPS (labels, no ids)
            dependsOn: (function () {
              const dep = groupDependsOn(g);
              if (!dep) return null;
              const target = (eq.groups || []).find((x) => x.id === dep.stepId);
              if (!target) return null;
              return {
                step: target.label || typeLabel(target.typeId),
                values: groupValues(target).filter((v) => dep.valueIds.indexOf(v.id) !== -1).map((v) => v.label),
              };
            })(),
            values: groupValues(g).map((v) => ({
              label: v.label, isDefault: g.defaultValueId === v.id, available: valueAvailable(v),
              qty: valueQty(v), neutral: valueIsNeutral(v),
              delta: deltaFor(g, v), alternatives: valueAlts(v).map((c) => c.name),
            })),
          })),
          // Visualizador 3D (editable con SET_MODEL3D)
          model3d: (function () {
            const m = eq.model3d || {};
            const bindG = (eq.groups || []).find((x) => x.id === m.bindStepId);
            return {
              enabled: m.enabled === true, viewerUrl: m.viewerUrl || '', modelUrl: m.modelUrl || '',
              arUrl: m.arUrl || '', bindStep: bindG ? (bindG.label || typeLabel(bindG.typeId)) : '',
              hasConfig: !!m.config, embedUrl: viewerEmbedUrl(eq) || '',
            };
          })(),
          // Ficha de tienda (editable con SET_STOREFRONT)
          storefront: {
            pageSections: (eq.storefront && eq.storefront.pageSections) || [],
            specs: (eq.storefront && eq.storefront.specs) || [],
            photosNote: (eq.storefront && eq.storefront.photosNote) || '',
            tabs: (eq.storefront && eq.storefront.tabs) || {},
            style: (eq.storefront && eq.storefront.style) || {},
          },
        })),
        staleComponents: model.components.filter((c) => daysSince(c.verifiedAt) > rules().staleDays).map((c) => c.name),
        publicEnabled: !!(model.def && model.def.public && model.def.public.enabled),
        publicUrl,
        storeBaseUrl: s(model.def && model.def.storeBaseUrl),
        // Referencia para componer pageSections válidas con SET_STOREFRONT
        builderRef: {
          patterns: HERO_PATTERNS.map((p) => ({ id: p.id, containers: patternCells(p) })),
          blockTypes: HERO_BLOCK_TYPES.map((t) => t.id),
          heights: ['s', 'm', 'l', 'xl', 'auto'],
          fixedSections: ['specs', 'fotos', 'note'],
          extraSections: ['imagen', 'visor3d'],
          // Contrato EXACTO de SET_STOREFRONT.pageSections. Los bloques que no
          // calcen con este esquema se RECHAZAN completos (nunca se pierden en
          // silencio), así el agente puede corregir y reintentar.
          sectionShape: 'Sección hero: {"kind":"hero","pattern":<patterns[].id>,"height":"s|m|l|xl|auto","bgColor":"#hex opcional","bgImageUrl":"https opcional (tapa el color)","textColor":"#hex opcional (vacío = automático según fondo)","overlay":true,"slots":{<containerId>:[bloque,…]}}. Los containerId válidos son EXACTAMENTE los containers del pattern elegido (ver patterns[]). Sección imagen (repetible; solo una foto, el ALTO se adapta a la imagen): {"kind":"imagen","imageUrl":"https…","width":"content|full","alt":"opcional","link":"opcional"}. Sección visor3d (única; embebe el visualizador 3D si model3d está habilitado): {"kind":"visor3d","height":480}. Secciones fijas (existen siempre, solo se reordenan u ocultan): {"kind":"specs"|"fotos"|"note","show":true|false}.',
          blockSchema: {
            photo: '{"type":"photo","size":"s|m|l|xl|auto","anim":"none|float|zoom|sway","align":"left|center|right"} — foto del producto enlazado (auto = alto natural de la foto)',
            title: '{"type":"title","align":"left|center|right"} — nombre del producto',
            text: '{"type":"text","text":"…","size":"xl|l|m|s","color":"#hex opcional","align":"left|center|right"}',
            items: '{"type":"items","items":[{"title":"…","text":"…"},…],"float":true,"align":"left|center|right"} — features/beneficios; title obligatorio en cada item',
            cta: '{"type":"cta","label":"…","style":"primary|dark|ghost","action":"configurar|url","url":"solo si action=url","align":"left|center|right"} — botón',
            icons: '{"type":"icons","items":[{"icon":"⚡ (emoji o carácter)","title":"…","text":"…"},…],"align":"left|center|right"}',
            specs: '{"type":"specs","count":4,"align":"left|center|right"} — resumen de las primeras N filas de la tabla de especificaciones (1-12)',
            gallery: '{"type":"gallery","index":1,"size":"s|m|l|xl|auto","align":"left|center|right"} — foto Nº index de la galería del producto (auto = alto natural)',
            html: '{"type":"html","html":"<div>…</div>","align":"left|center|right"} — HTML libre',
          },
          example: {
            kind: 'hero', pattern: 'clasico', height: 'l', bgColor: '#1D1D1B',
            slots: {
              top: [{ type: 'title' }, { type: 'text', text: 'Potencia creadora, silencio total', size: 'xl' }],
              left: [{ type: 'items', items: [{ title: 'Textura a elección', text: 'Roble, nogal o carbonizado' }, { title: 'Hecho a medida', text: 'Producción local certificada' }] }],
              center: [{ type: 'photo', size: 'l', anim: 'float' }],
              right: [{ type: 'cta', label: 'Configurar el tuyo' }],
              bottom: [{ type: 'specs', count: 4 }],
            },
          },
        },
      }),
      dispatchAction: async (action) => {
        const type = action && action.type;
        // Los agentes a veces envían objetos anidados como string JSON.
        const parseJson = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return undefined; } };
        const rawPayload = (action && action.payload) || {};
        const p = (typeof rawPayload === 'string' ? parseJson(rawPayload) : rawPayload) || {};
        // Los LLM no siempre usan el nombre exacto del campo de referencia
        // (mandan productoId/id/name en vez de "producto"): aceptamos alias
        // comunes y, si igual no se resuelve, el error lista los productos
        // existentes para que el agente se autocorrija en el siguiente turno.
        const refIn = (obj, keys) => {
          for (const k of keys) { const v = obj && obj[k]; if (v != null && s(v).trim() !== '') return v; }
          return '';
        };
        const payloadProductoRef = (extra) => refIn(p, ['producto', 'productoId', 'productoName', 'producto_id', 'producto_name'].concat(extra || []));
        const compRefOf = (obj) => refIn(obj, ['component', 'componentId', 'componentName', 'component_id', 'id', 'name', 'nombre']);
        const eqNotFound = (ref) => ({
          success: false,
          error: (s(ref).trim() !== '' ? 'Producto no encontrado: "' + s(ref).trim() + '".' : 'Falta el campo "producto" en el payload.')
            + ' Productos existentes: ' + (model.productos.map((e) => '"' + e.name + '"').join(', ') || '(ninguno)')
            + '. Reintenta con payload {"producto": "<nombre, sku o id>", …}.',
        });
        try {
          if (type === 'UPSERT_COMPONENT') {
            const existing = findComponent(p.name);
            const draft = Object.assign({}, existing || {}, p, { name: s(p.name).trim() });
            if (p.cost != null && !existing) draft.verifiedAt = nowIso();
            const r = await saveComponent(draft);
            return r.success ? { success: true, message: r.message } : { success: false, error: r.error };
          }
          if (type === 'SET_COMPONENT_COST') {
            const cRef = compRefOf(p);
            const c = findComponent(cRef);
            if (!c) return { success: false, error: 'Componente no encontrado: "' + s(cRef) + '". Usa el campo "component" con el id o nombre exacto (ver components[] del snapshot).' };
            const cost = num(p.cost, NaN);
            if (!Number.isFinite(cost) || cost < 0) return { success: false, error: 'Costo inválido.' };
            const r = await saveComponent(Object.assign({}, c, { cost, currency: p.currency === 'USD' ? 'USD' : c.currency, verifiedAt: nowIso() }));
            if (!r.success) return { success: false, error: r.error };
            const pend = recalcPreview().length;
            return { success: true, message: 'Costo de "' + c.name + '" actualizado. ' + (pend ? pend + ' producto(s) requieren recálculo (usa RECALC_PRICES).' : 'Ningún producto cambia de precio.') };
          }
          if (type === 'SET_MARGIN') {
            const t = norm(p.type);
            const pct = num(p.marginPct, NaN);
            if (!Number.isFinite(pct) || pct < 0 || pct > 500) return { success: false, error: 'marginPct inválido.' };
            const def = Object.assign({}, model.def || defaultDefinition());
            def.rules = Object.assign({}, def.rules);
            if (t === 'default') def.rules.marginDefaultPct = pct;
            else if (t === 'base') def.rules.marginBasePct = pct;
            else {
              if (!types().some((x) => x.id === t)) return { success: false, error: 'Tipo desconocido: ' + t };
              def.rules.marginByType = Object.assign({}, def.rules.marginByType, {});
              def.rules.marginByType[t] = pct;
            }
            const r = await saveDefinition(def);
            return r.success ? { success: true, message: 'Margen de "' + t + '" fijado en ' + pct + '%. Usa RECALC_PRICES para aplicar a los productos.' } : { success: false, error: r.error };
          }
          if (type === 'RECALC_PRICES') {
            if (p.apply === true) {
              const res = await recalcApply();
              const fails = res.filter((x) => !x.success);
              return {
                success: fails.length === 0,
                message: res.length ? res.map((x) => x.name + ': ' + fmtCLP(x.from) + ' → ' + fmtCLP(x.to) + (x.success ? '' : ' (ERROR: ' + s(x.error) + ')')).join(' · ') : 'Sin cambios de precio.',
              };
            }
            const prev = recalcPreview();
            return { success: true, message: prev.length ? 'Cambios pendientes: ' + prev.map((x) => x.eq.name + ' ' + fmtCLP(x.oldPrice) + ' → ' + fmtCLP(x.nextPrice)).join(' · ') : 'Sin cambios de precio.' };
          }
          if (type === 'APPLY_PRODUCTO') {
            const eqRef = payloadProductoRef(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const r = await applyToStore(eq);
            return r.success ? { success: true, message: r.message } : { success: false, error: r.error };
          }
          if (type === 'UPSERT_PRODUCTO') {
            const nameRef = refIn(p, ['name', 'producto', 'nombre', 'productoName']);
            const existing = findProducto(nameRef);
            const draft = Object.assign({}, existing || {}, { name: existing ? existing.name : s(nameRef).trim() });
            if (p.name != null && s(p.name).trim() !== '') draft.name = s(p.name).trim();
            if (!draft.name) return { success: false, error: 'El producto requiere nombre.' };
            if (p.sku != null) draft.sku = s(p.sku);
            if (p.status === 'active' || p.status === 'inactive') draft.status = p.status;
            if (p.deliveryExtraDays !== undefined) draft.deliveryExtraDays = p.deliveryExtraDays === null || p.deliveryExtraDays === '' ? null : num(p.deliveryExtraDays);
            if (p.deliveryMode === 'sum' || p.deliveryMode === 'max') draft.deliveryMode = p.deliveryMode;
            if (p.storeUrl != null) draft.storeUrl = s(p.storeUrl);
            const r = await saveProducto(draft);
            return r.success
              ? { success: true, message: (existing ? 'Producto actualizado: ' : 'Producto creado: ') + r.item.name + '. Define pasos con SET_PRODUCTO_STEPS y la ficha con SET_STOREFRONT.' }
              : { success: false, error: r.error };
          }
          if (type === 'SET_PRODUCTO_STEPS') {
            const eqRef = payloadProductoRef(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const steps = parseJson(p.steps);
            if (!Array.isArray(steps)) return { success: false, error: 'steps debe ser un array JSON de pasos.' };
            const stepWarns = [];
            const exByLabel = new Map();
            (eq.groups || []).forEach((g) => exByLabel.set(norm(g.label || typeLabel(g.typeId)), g));
            const groups = steps.map((st) => {
              const label = s(st && st.label).trim();
              const ex = exByLabel.get(norm(label));
              const exVals = new Map();
              if (ex) groupValues(ex).forEach((v) => exVals.set(norm(v.label), v));
              const values = (Array.isArray(st.values) ? st.values : []).map((v) => {
                const comps = (Array.isArray(v.components) ? v.components : []).map((refC) => {
                  const c = findComponent(refC);
                  if (!c) stepWarns.push('componente no encontrado: "' + s(refC) + '"');
                  return c;
                }).filter(Boolean);
                const exv = exVals.get(norm(s(v.label)));
                return {
                  id: (exv && exv.id) || newId('val'),
                  label: s(v.label).trim(),
                  imageUrl: s(v.imageUrl).trim(),
                  swatchColor: s(v.swatchColor).trim(),
                  qty: Math.max(1, Math.round(num(v.qty, 1)) || 1),
                  neutral: v.neutral === true,
                  componentIds: comps.map((c) => c.id),
                };
              }).filter((v) => v.label);
              const typeId = types().some((t) => t.id === st.type) ? st.type : (ex ? ex.typeId : 'other');
              const defVal = values.find((v) => norm(v.label) === norm(s(st.default))) || values[0] || null;
              return {
                id: (ex && ex.id) || newId('grp'),
                typeId,
                label,
                photoStep: st.photoStep === true,
                values,
                defaultValueId: defVal ? defVal.id : null,
              };
            });
            // Resolver dependsOn por label: {step: <label anterior>, values: [labels]}
            // → {stepId, valueIds}. Solo puede apuntar a un paso ANTERIOR.
            steps.forEach((st, i) => {
              const dep = parseJson(st && st.dependsOn);
              if (!dep || !s(dep.step).trim()) return;
              const target = groups.slice(0, i).find((g) => norm(g.label) === norm(dep.step))
                || groups.slice(0, i).find((g) => norm(g.label).indexOf(norm(dep.step)) !== -1);
              if (!target) { stepWarns.push('dependsOn de "' + groups[i].label + '": paso ANTERIOR no encontrado: "' + s(dep.step) + '" (dependencia ignorada)'); return; }
              const wanted = Array.isArray(dep.values) ? dep.values.map((x) => norm(s(x))) : [];
              const valueIds = groupValues(target)
                .filter((v) => !wanted.length || wanted.indexOf(norm(v.label)) !== -1)
                .map((v) => v.id);
              if (!valueIds.length) { stepWarns.push('dependsOn de "' + groups[i].label + '": ningún valor de "' + target.label + '" coincide con ' + JSON.stringify(dep.values) + ' (dependencia ignorada)'); return; }
              groups[i].dependsOn = { stepId: target.id, valueIds };
            });
            const r = await saveProducto(Object.assign({}, eq, { groups }));
            if (!r.success) return { success: false, error: r.error };
            const depCount = (r.item.groups || []).filter((g) => groupDependsOn(g)).length;
            const warnTxt = stepWarns.length ? ' Avisos: ' + stepWarns.slice(0, 5).join(' · ') : '';
            return { success: true, message: 'Pasos de "' + r.item.name + '" actualizados: ' + groups.length + ' paso(s)' + (depCount ? ' (' + depCount + ' dependiente(s))' : '') + ', ' + comboCount(r.item) + ' combinación(es), precio base ' + fmtCLP(r.item.price) + '.' + warnTxt };
          }
          if (type === 'COMPOSE_HERO') {
            const eqRef = payloadProductoRef(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const pat = heroPattern(p.pattern);
            const cells = patternCells(pat);
            const slots = {};
            cells.forEach((c) => { slots[c] = []; });
            // Distribución determinista: encabezado en la primera celda, foto
            // en la celda central, features en la primera celda lateral libre,
            // botón en la última.
            const first = cells[0];
            const last = cells[cells.length - 1];
            const mid = cells[Math.floor((cells.length - 1) / 2)];
            const side = cells.find((c) => c !== first && c !== mid && c !== last) || first;
            const side2 = cells.find((c) => c !== first && c !== mid && c !== last && c !== side) || side;
            if (p.showTitle !== false) slots[first].push({ type: 'title' });
            if (s(p.headline).trim()) slots[first].push({ type: 'text', text: s(p.headline).trim(), size: 'xl' });
            if (s(p.text).trim()) slots[first].push({ type: 'text', text: s(p.text).trim(), size: 'm' });
            const feats = (parseJson(p.features) || [])
              .filter((f) => f && (s(f.title).trim() || s(f.text).trim()))
              .map((f) => ({
                title: (s(f.title).trim() || s(f.text).trim()).slice(0, 80),
                text: s(f.title).trim() ? s(f.text).trim() : '',
              }));
            const nRight = Math.max(0, Math.min(feats.length, num(p.featuresRightCount, 0)));
            const featsLeft = nRight > 0 ? feats.slice(0, feats.length - nRight) : feats;
            const featsRight = nRight > 0 ? feats.slice(feats.length - nRight) : [];
            if (featsLeft.length) slots[side].push({ type: 'items', items: featsLeft, float: true });
            if (featsRight.length && side2 !== side) slots[side2].push({ type: 'items', items: featsRight, float: true });
            else if (featsRight.length) slots[side].push({ type: 'items', items: featsRight, float: true });
            if (p.showPhoto !== false) {
              slots[mid].push({ type: 'photo', size: ['s', 'm', 'xl'].indexOf(p.photoSize) !== -1 ? p.photoSize : 'l', anim: 'none' });
            }
            slots[last].push({ type: 'cta', label: s(p.ctaLabel).trim(), style: 'primary', action: 'configurar' });
            const heroSec = {
              kind: 'hero',
              pattern: pat.id,
              height: ['s', 'm', 'xl', 'auto'].indexOf(p.height) !== -1 ? p.height : 'l',
              bgColor: s(p.bgColor).trim(),
              bgImageUrl: s(p.bgImageUrl).trim(),
              textColor: s(p.textColor).trim(),
              overlay: true,
              slots,
            };
            const secs = (((eq.storefront || {}).pageSections) || []).slice();
            const heroPositions = [];
            secs.forEach((x, i) => { if (x && x.kind === 'hero') heroPositions.push(i); });
            if (!heroPositions.length) {
              secs.unshift(heroSec);
            } else {
              const want = Math.max(1, num(p.heroIndex, 1)) - 1;
              const pos = heroPositions[Math.min(want, heroPositions.length - 1)];
              heroSec.id = secs[pos].id;
              // Conservar el fondo actual si no se envió uno nuevo.
              if (!heroSec.bgColor && !heroSec.bgImageUrl) {
                heroSec.bgColor = s(secs[pos].bgColor);
                heroSec.bgImageUrl = s(secs[pos].bgImageUrl);
              }
              secs[pos] = heroSec;
            }
            const r = await saveProducto(Object.assign({}, eq, { storefront: Object.assign({}, eq.storefront, { pageSections: secs }) }));
            if (!r.success) return { success: false, error: r.error };
            const savedHeros = ((r.item.storefront || {}).pageSections || []).filter((x) => x.kind === 'hero');
            const det = savedHeros.map((hx, i) => {
              const parts = Object.keys(hx.slots || {}).filter((k) => (hx.slots[k] || []).length)
                .map((k) => k + ': ' + hx.slots[k].map((b) => b.type).join('+'));
              return 'hero ' + (i + 1) + ' [' + hx.pattern + '] ' + (parts.join(' · ') || 'SIN BLOQUES');
            }).join(' — ');
            return { success: true, message: 'Hero de "' + r.item.name + '" compuesto y guardado (' + feats.length + ' características). ' + det + '. Republicado automáticamente.' };
          }
          if (type === 'SET_MODEL3D') {
            const eqRef = payloadProductoRef(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const m = Object.assign({}, eq.model3d || {});
            if (p.enabled !== undefined) m.enabled = p.enabled === true;
            if (p.viewerUrl !== undefined) m.viewerUrl = s(p.viewerUrl).trim();
            if (p.modelUrl !== undefined) m.modelUrl = s(p.modelUrl).trim();
            if (p.arUrl !== undefined) m.arUrl = s(p.arUrl).trim();
            if (p.bindStep !== undefined) {
              const key = norm(s(p.bindStep));
              const g = key
                ? (eq.groups || []).find((x) => norm(x.label || typeLabel(x.typeId)) === key)
                  || (eq.groups || []).find((x) => norm(x.label || typeLabel(x.typeId)).indexOf(key) !== -1)
                : null;
              if (key && !g) return { success: false, error: 'bindStep: paso no encontrado: "' + s(p.bindStep) + '". Pasos del producto: ' + ((eq.groups || []).map((x) => '"' + (x.label || typeLabel(x.typeId)) + '"').join(', ') || '(ninguno)') + '.' };
              m.bindStepId = g ? g.id : '';
            }
            if (p.config !== undefined) {
              const cfg = parseJson(p.config);
              if (cfg !== null && (typeof cfg !== 'object' || Array.isArray(cfg))) {
                return { success: false, error: 'config debe ser un objeto JSON {parts:[{id,label,materials[]}], finishes:[{id,label,color,texture,roughness,textureScale,grain}]} o null para borrarla.' };
              }
              m.config = cfg;
            }
            const r = await saveProducto(Object.assign({}, eq, { model3d: m }));
            if (!r.success) return { success: false, error: r.error };
            const mm = r.item.model3d || {};
            const emb = viewerEmbedUrl(r.item);
            return { success: true, message: 'Visualizador 3D de "' + r.item.name + '": ' + (mm.enabled ? 'habilitado' : 'deshabilitado') + (mm.viewerUrl ? ' · visor: ' + mm.viewerUrl : '') + (mm.modelUrl ? ' · modelo: ' + mm.modelUrl : '') + (mm.config ? ' · con configuración de partes/texturas' : '') + '.' + (mm.enabled ? (emb ? ' Embed: ' + emb + '.' : '') + ' Para mostrarlo en la página agrega la sección {"kind":"visor3d"} con SET_STOREFRONT.pageSections.' : '') };
          }
          if (type === 'SET_STOREFRONT') {
            const eqRef = payloadProductoRef(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const sf = Object.assign({}, eq.storefront || {});
            if (p.pageSections !== undefined) {
              const v = parseJson(p.pageSections);
              if (!Array.isArray(v)) return { success: false, error: 'pageSections debe ser un array JSON de secciones.' };
              // Validación ESTRICTA antes de guardar: la normalización de la UI
              // descarta en silencio bloques mal formados; a un agente eso le
              // vaciaba la ficha "con éxito". Aquí lo malformado se rechaza
              // completo, con el detalle para corregir y reintentar.
              const issues = [];
              let sentBlocks = 0;
              v.forEach((sec, i) => {
                if (!sec || typeof sec !== 'object') { issues.push('sección ' + (i + 1) + ': no es un objeto'); return; }
                if (sec.kind === 'specs' || sec.kind === 'note' || sec.kind === 'fotos' || sec.kind === 'visor3d') return;
                if (sec.kind === 'imagen') {
                  if (!s(sec.imageUrl).trim()) issues.push('sección ' + (i + 1) + ' (imagen): falta imageUrl (usa IMPORT_IMAGE para subir una imagen y obtener su URL)');
                  return;
                }
                const tag = 'sección ' + (i + 1);
                if (sec.kind !== undefined && sec.kind !== 'hero') issues.push(tag + ': kind inválido "' + s(sec.kind) + '" (válidos: hero, imagen, visor3d, specs, fotos, note)');
                ['blocks', 'content', 'children', 'elements', 'bloques', 'body', 'sections'].forEach((wk) => {
                  if (sec[wk] !== undefined) issues.push(tag + ': la clave "' + wk + '" no existe — los bloques van en "slots": {contenedor: [bloques]}');
                });
                if (Array.isArray(sec.slots)) issues.push(tag + ': "slots" debe ser un OBJETO {contenedor: [bloques]}, no una lista');
                if (sec.pattern !== undefined && !HERO_PATTERNS.some((pt) => pt.id === sec.pattern)) issues.push(tag + ': patrón desconocido "' + s(sec.pattern) + '" (válidos: ' + HERO_PATTERNS.map((pt) => pt.id).join(', ') + ')');
                const cells = patternCells(heroPattern(sec.pattern));
                const slots = (sec.slots && typeof sec.slots === 'object' && !Array.isArray(sec.slots)) ? sec.slots : {};
                Object.keys(slots).forEach((cid) => {
                  const arr = Array.isArray(slots[cid]) ? slots[cid] : [];
                  if (cells.indexOf(cid) === -1) {
                    if (arr.length) issues.push(tag + ': el contenedor "' + cid + '" no existe en el patrón "' + heroPattern(sec.pattern).id + '" (válidos: ' + cells.join(', ') + ')');
                    return;
                  }
                  arr.forEach((b) => {
                    sentBlocks++;
                    if (!b || typeof b !== 'object' || !HERO_BLOCK_TYPES.some((t) => t.id === b.type)) {
                      issues.push(tag + ', contenedor "' + cid + '": bloque con type inválido "' + s(b && b.type) + '" (válidos: ' + HERO_BLOCK_TYPES.map((t) => t.id).join(', ') + ')');
                    }
                  });
                });
              });
              if (issues.length) {
                return { success: false, error: 'pageSections NO guardado — corrige y reintenta: ' + issues.slice(0, 8).join(' · ') + '. El contrato exacto está en snapshot.builderRef (sectionShape, blockSchema y example) y el estado actual en productos[].storefront.pageSections. TIP: para crear o rearmar un hero es MUCHO más simple COMPOSE_HERO (campos planos, sin estructura anidada).' };
              }
              // Guardia anti-borrado: si la ficha actual tiene bloques y lo
              // enviado la deja en cero, exigir intención explícita.
              const countHeroBlocks = (secs) => (secs || []).reduce((a, x) => {
                if (!x || x.kind !== 'hero' || !x.slots || typeof x.slots !== 'object') return a;
                return a + Object.keys(x.slots).reduce((b, k) => b + (Array.isArray(x.slots[k]) ? x.slots[k].length : 0), 0);
              }, 0);
              const existingBlocks = countHeroBlocks((eq.storefront || {}).pageSections);
              const heroCount = v.filter((x) => x && typeof x === 'object' && (x.kind === 'hero' || (x.kind === undefined && (x.slots !== undefined || x.pattern !== undefined)))).length;
              if (heroCount > 0 && sentBlocks === 0 && p.allowEmpty !== true) {
                return { success: false, error: 'pageSections NO guardado: los heros llegaron SIN ningún bloque válido' + (existingBlocks > 0 ? ' (y la ficha actual tiene ' + existingBlocks + ' bloques que se perderían)' : '') + '. Los bloques van DENTRO de "slots", por contenedor del patrón. Ejemplo mínimo: {"kind":"hero","pattern":"clasico","slots":{"top":[{"type":"title"}],"left":[{"type":"items","items":[{"title":"Textura roble","text":"Terminación natural"}]}],"center":[{"type":"photo","size":"l"}]}}. El contrato completo está en snapshot.builderRef (sectionShape/blockSchema/example) y el estado actual en productos[].storefront.pageSections. Si de verdad quieres heros vacíos, envía allowEmpty:true.' };
              }
              sf.pageSections = v;
            }
            if (p.specs !== undefined) {
              const v = parseJson(p.specs);
              if (!Array.isArray(v)) return { success: false, error: 'specs debe ser un array JSON de filas {group?, label, value}.' };
              sf.specs = v;
            }
            if (p.photosNote !== undefined) sf.photosNote = s(p.photosNote);
            if (p.tabs !== undefined) {
              const v = parseJson(p.tabs);
              if (!v || typeof v !== 'object' || Array.isArray(v)) return { success: false, error: 'tabs debe ser un objeto JSON.' };
              sf.tabs = Object.assign({}, sf.tabs, v);
            }
            if (p.style !== undefined) {
              const v = parseJson(p.style);
              if (!v || typeof v !== 'object' || Array.isArray(v)) return { success: false, error: 'style debe ser un objeto JSON: {accentColor?, bgColor?, radius?, cardStyle?, showDeltas?, stepsCollapsed?}.' };
              sf.style = Object.assign({}, sf.style, v);
            }
            const r = await saveProducto(Object.assign({}, eq, { storefront: sf }));
            if (!r.success) return { success: false, error: r.error };
            const out = r.item.storefront || {};
            const heros = (out.pageSections || []).filter((x) => x.kind === 'hero');
            const heroDetail = heros.map((hx, i) => {
              const parts = Object.keys(hx.slots || {})
                .filter((k) => (hx.slots[k] || []).length)
                .map((k) => k + ': ' + hx.slots[k].map((b) => b.type).join('+'));
              return 'hero ' + (i + 1) + ' [' + hx.pattern + '] ' + (parts.join(' · ') || 'SIN BLOQUES');
            }).join(' — ');
            return { success: true, message: 'Ficha de "' + r.item.name + '" guardada: ' + (out.pageSections || []).length + ' secciones (' + heros.length + ' hero(s)), ' + (out.specs || []).length + ' filas de specs' + (out.photosNote ? ', con nota' : '') + '. Normalizada y republicada automáticamente.' + (heroDetail ? ' Detalle: ' + heroDetail + '.' : '') };
          }
          if (type === 'LINK_PRODUCT') {
            const eqRef = payloadProductoRef(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const key = s(p.product).trim();
            const prod = model.storeCatalog.find((x) => x.id === key)
              || model.storeCatalog.find((x) => (x.sourceLinks || []).some((l) => l && l.integration === 'jumpseller' && String(l.sourceId) === key))
              || model.storeCatalog.find((x) => norm(x.sku) === norm(key))
              || model.storeCatalog.find((x) => norm(x.name) === norm(key))
              || model.storeCatalog.find((x) => norm(x.name).indexOf(norm(key)) !== -1);
            if (!prod) return { success: false, error: 'Producto no encontrado en el catálogo de la app Productos: ' + key };
            const js = (prod.sourceLinks || []).find((l) => l && l.integration === 'jumpseller');
            const r = await saveProducto(Object.assign({}, eq, {
              productRef: { instanceId: prod.__instanceId, itemId: prod.id, sourceId: js ? js.sourceId : null, sku: prod.sku || '', name: prod.name || '', imageUrl: prod.imageUrl || '' },
              sku: eq.sku || prod.sku || '',
              sourceLinks: [],
            }));
            return r.success
              ? { success: true, message: '"' + r.item.name + '" enlazado a "' + prod.name + '"' + (js ? ' (JS #' + js.sourceId + ')' : ' (producto local)') + '. Usa APPLY_PRODUCTO para aplicar a la tienda.' }
              : { success: false, error: r.error };
          }
          if (type === 'SET_STOCK') {
            const itemsParsed = parseJson(p.items);
            const list = Array.isArray(itemsParsed) ? itemsParsed : (s(compRefOf(p)).trim() !== '' ? [{ component: compRefOf(p), stock: p.stock }] : null);
            if (!list || !list.length) return { success: false, error: 'Indica component+stock o items:[{component, stock}].' };
            let ok = 0;
            const errs = [];
            for (const it of list) {
              const c = findComponent(compRefOf(it));
              if (!c) { errs.push('no encontrado: ' + s(compRefOf(it))); continue; }
              const stock = it.stock === null || it.stock === '' || it.stock === undefined ? null : Math.max(0, num(it.stock, 0));
              const r = await saveComponent(Object.assign({}, c, { stock }));
              if (r.success) ok++; else errs.push(c.name + ': ' + r.error);
            }
            const pend = recalcPreview().length;
            return {
              success: errs.length === 0,
              message: 'Stock actualizado en ' + ok + '/' + list.length + ' componente(s).' + (errs.length ? ' Errores: ' + errs.join(' · ') : '') + (pend ? ' ' + pend + ' producto(s) por recalcular (RECALC_PRICES).' : ''),
            };
          }
          if (type === 'IMPORT_IMAGE') {
            if (!shell.authFetch) return { success: false, error: 'authFetch no disponible en este host.' };
            let srcUrl = s(p.url).trim();
            if (!srcUrl) return { success: false, error: 'Indica url: path del storage del equipo de trabajo, ruta /api/… o URL http(s).' };
            // path relativo del File Storage del equipo de trabajo → endpoint de descarga
            if (srcUrl.indexOf('/') === 0) srcUrl = API + srcUrl;
            else if (!/^https?:\/\//i.test(srcUrl)) {
              const teamId = shell.app && shell.app.teamId;
              if (!teamId) return { success: false, error: 'No hay teamId disponible para resolver el path del storage.' };
              srcUrl = API + '/api/storage/teams/' + teamId + '/files/download?path=' + encodeURIComponent(srcUrl.replace(/^\/+/, ''));
            }
            try {
              // URLs de KIMOS van con auth; externas con fetch normal (CORS mediante).
              const sameOrigin = srcUrl.indexOf(API) === 0;
              const res = sameOrigin ? await shell.authFetch(srcUrl) : await fetch(srcUrl, { mode: 'cors' });
              if (!res.ok) return { success: false, error: 'No se pudo descargar la imagen (HTTP ' + res.status + ').' };
              const blob = await res.blob();
              if (blob.type && blob.type.indexOf('image/') !== 0) {
                return { success: false, error: 'El archivo no es una imagen (' + blob.type + ').' };
              }
              if (blob.size > 8 * 1024 * 1024) return { success: false, error: 'La imagen supera los 8 MB.' };
              const rawName = s(p.name).trim() || s(srcUrl.split('?')[0].split('/').pop()) || 'imagen.png';
              const file = new File([blob], rawName, { type: blob.type || 'image/png' });
              const url = await uploadImage(file);
              let galNote = '';
              const galRef = payloadProductoRef();
              if (s(galRef).trim() !== '') {
                const eqG = findProducto(galRef);
                if (eqG) {
                  const gal = (Array.isArray(eqG.galleryImages) ? eqG.galleryImages : []).slice();
                  if (gal.indexOf(url) === -1) gal.push(url);
                  const rG = await saveProducto(Object.assign({}, eqG, { galleryImages: gal }));
                  galNote = rG.success ? ' Agregada a la galería de "' + rG.item.name + '".' : ' (no se pudo agregar a la galería: ' + rG.error + ')';
                } else galNote = ' (producto "' + s(galRef) + '" no encontrado: no se agregó a ninguna galería)';
              }
              return { success: true, message: 'Imagen importada y publicada en: ' + url + ' — úsala en SET_STOREFRONT (bgImageUrl de un hero, bloques) o como imageUrl de un valor.' + galNote };
            } catch (e) {
              return { success: false, error: 'No se pudo importar: ' + ((e && e.message) || 'error') + '. Si es una URL externa puede bloquearla CORS; usa un adjunto del chat o una URL de KIMOS.' };
            }
          }
          if (type === 'PUBLISH_CONFIG') {
            const on = p.enabled !== false;
            const r = await publish(on);
            return r.success
              ? { success: true, message: on ? 'Configurador publicado (' + buildPublicData().productos.length + ' productos).' : 'Configurador despublicado (el gateway responderá 403).' }
              : { success: false, error: r.error };
          }
          return { success: false, error: 'Acción desconocida: ' + s(type) + '. Acciones válidas: UPSERT_COMPONENT, SET_COMPONENT_COST, SET_MARGIN, RECALC_PRICES, APPLY_PRODUCTO, UPSERT_PRODUCTO, SET_PRODUCTO_STEPS, SET_STOREFRONT, SET_MODEL3D, COMPOSE_HERO, LINK_PRODUCT, SET_STOCK, PUBLISH_CONFIG, IMPORT_IMAGE.' };
        } catch (e) {
          return { success: false, error: (e && e.message) || 'Error interno.' };
        }
      },
    });
  }

  // ═════════════════════════════ UI ═════════════════════════════

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const Row = ({ label, children }) => h('div', { className: 'pl-row' }, [
    h('label', { key: 'l', className: 'pl-label' }, label),
    h(React.Fragment, { key: 'c' }, children),
  ]);
  const TextInput = (props) => {
    const p = Object.assign({}, props);
    const mono = p.mono;
    delete p.mono;
    p.className = 'pl-input' + (mono ? ' pl-mono' : '');
    return h('input', p);
  };
  function Thumb({ url }) {
    return url
      ? h('img', { className: 'pl-thumb', src: url, alt: '' })
      : h('div', { className: 'pl-thumb-ph' }, '📦');
  }
  // Subida de imágenes al área compartida de KIMOS (imagenes/ es escribible por
  // cualquier usuario autenticado y se sirve públicamente vía /api/public/files).
  async function uploadImage(file) {
    if (!shell.authFetch) throw new Error('authFetch no disponible en este host');
    if (file.size > 8 * 1024 * 1024) throw new Error('máximo 8 MB');
    const safe = (file.name || 'imagen').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagen';
    const path = 'imagenes/productlab/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-' + safe;
    const fd = new FormData();
    fd.append('path', path);
    fd.append('file', file);
    const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(s(d.detail) || 'HTTP ' + res.status);
    }
    return API + '/api/public/files/' + path;
  }
  // Campo de color: selector nativo + hex editable; vacío = automático/default.
  function ColorField({ label, value, onChange, placeholder }) {
    const valid = /^#[0-9a-fA-F]{6}$/.test(s(value).trim());
    const control = h('div', { className: 'pl-verify-cost' }, [
      h('input', { key: 'c', type: 'color', value: valid ? value.trim() : '#ffffff', onChange: (e) => onChange(e.target.value), style: { width: 36, height: 32, padding: 0, border: '1px solid var(--pl-gris-claro)', background: '#fff', cursor: 'pointer' } }),
      h(TextInput, { key: 't', mono: true, value: value || '', onChange: (e) => onChange(e.target.value), placeholder: placeholder || '#FFFFFF (vacío = automático)', style: { width: 200 } }),
      value ? h('button', { key: 'x', className: 'pl-btn pl-btn-sm', title: 'Volver al automático', onClick: () => onChange('') }, '✕') : null,
    ]);
    return label != null ? h(Row, { label }, control) : control;
  }
  // Campo de imagen: URL editable + botón "Subir…" (input file) + miniatura.
  // Con `gallery` (urls de la galería del producto) agrega el picker "Galería…".
  function ImgField({ label, value, onChange, placeholder, gallery }) {
    const [busy, setBusy] = useState(false);
    const [showGal, setShowGal] = useState(false);
    const galBtn = Array.isArray(gallery) && gallery.length
      ? h('button', { key: 'gal', className: 'pl-btn pl-btn-sm' + (showGal ? ' pl-btn-dark' : ''), title: 'Elegir de la galería del producto (' + gallery.length + ' fotos)', onClick: () => setShowGal(!showGal) }, 'Galería…')
      : null;
    const galStrip = showGal && Array.isArray(gallery) && gallery.length
      ? h('div', { key: 'strip', style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, padding: 6, border: '1px dashed var(--pl-gris-claro)', background: 'var(--pl-plata)' } },
          gallery.map((u, i) => h('img', {
            key: i, src: u, alt: 'Foto ' + (i + 1),
            title: 'Foto ' + (i + 1) + ' de la galería — clic para usar',
            onClick: () => { onChange(u); setShowGal(false); },
            style: { width: 64, height: 64, objectFit: 'cover', cursor: 'pointer', background: '#fff', border: value === u ? '2px solid var(--pl-accent)' : '1px solid var(--pl-gris-claro)' },
          })))
      : null;
    const control = h('div', { className: 'pl-verify-cost', style: { width: '100%' } }, [
      h(Thumb, { key: 't', url: value }),
      h(TextInput, { key: 'i', mono: true, value: value || '', onChange: (e) => onChange(e.target.value), placeholder: placeholder || 'https://… o usa Subir', style: { flex: 1, minWidth: 120 } }),
      h('label', { key: 'up', className: 'pl-btn pl-btn-sm', style: { cursor: 'pointer' } }, [
        h('span', { key: 's' }, busy ? 'Subiendo…' : 'Subir…'),
        h('input', { key: 'f', type: 'file', accept: 'image/*', style: { display: 'none' }, disabled: busy, onChange: async (e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            const url = await uploadImage(f);
            onChange(url);
            shell.notify({ level: 'success', text: 'Imagen subida.' });
          } catch (err) {
            shell.notify({ level: 'error', text: 'No se pudo subir la imagen: ' + ((err && err.message) || 'error') });
          }
          setBusy(false);
        } }),
      ]),
      galBtn,
      value ? h('button', { key: 'x', className: 'pl-btn pl-btn-sm', title: 'Quitar imagen', onClick: () => onChange('') }, '✕') : null,
    ]);
    const wrapped = galStrip ? h('div', { style: { width: '100%' } }, [h(React.Fragment, { key: 'c' }, control), galStrip]) : control;
    return label != null ? h(Row, { label }, wrapped) : wrapped;
  }
  function Modal({ title, onClose, children }) {
    return h('div', { className: 'pl-overlay', onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
      h('div', { className: 'pl-modal' }, [
        h('div', { key: 'h', className: 'pl-modal-head' }, [
          h('span', { key: 't', className: 't' }, title),
          h('button', { key: 'x', onClick: onClose, title: 'Cerrar' }, '✕'),
        ]),
        h('div', { key: 'b', className: 'pl-modal-body' }, children),
      ]));
  }
  function SyncBadge({ eq }) {
    if (!productRefOf(eq)) {
      return legacyLink(eq)
        ? h('span', { className: 'pl-chip warn' }, 're-enlazar')
        : h('span', { className: 'pl-chip gris' }, 'sin enlace');
    }
    const lp = eq.lastPush;
    if (!lp) return h('span', { className: 'pl-chip warn' }, 'sin aplicar');
    if (lp.status === 'synced') return h('span', { className: 'pl-chip ok', title: 'Aplicado ' + fmtDateTime(lp.at) + ' · ' + num(lp.variantCount) + ' variantes' }, 'en tienda');
    return h('span', { className: 'pl-chip err', title: (lp.errors || []).join(' · ') }, 'error de sync');
  }

  // ── Formulario de componente ──────────────────────────────────────────────
  function ComponentForm({ initial, onDone }) {
    const [d, setD] = useState(() => Object.assign({
      name: '', type: types()[0].id, brand: '', specs: '', imageUrl: '', currency: 'CLP', cost: 0, taxPct: 0,
      supplierName: '', supplierUrl: '', deliveryDays: 0, stock: null, productRef: null,
      tags: [], requires: [], excludes: [], active: true, notes: '',
    }, initial || {}));
    const [busy, setBusy] = useState(false);
    const up = (patch) => setD(Object.assign({}, d, patch));
    const preview = componentSale(normalizeComponent(Object.assign({}, d, { id: d.id || 'x' })));
    return h('div', null, [
      h('div', { key: 'g1', className: 'pl-grid2' }, [
        h(Row, { key: 'n', label: 'Nombre *' }, h(TextInput, { value: d.name, onChange: (e) => up({ name: e.target.value }), placeholder: 'Ej: Cubierta roble macizo 120cm' })),
        h(Row, { key: 't', label: 'Tipo' }, h('select', { className: 'pl-select', value: d.type, onChange: (e) => up({ type: e.target.value }) },
          types().map((t) => h('option', { key: t.id, value: t.id }, t.label)))),
        h(Row, { key: 'b', label: 'Marca' }, h(TextInput, { value: d.brand, onChange: (e) => up({ brand: e.target.value }) })),
        h(ImgField, { key: 'i', label: 'Imagen (se muestra en el configurador de la tienda)', value: d.imageUrl, onChange: (v) => up({ imageUrl: v }) }),
      ]),
      h(Row, { key: 'sp', label: 'Specs / descripción corta (se muestra bajo el nombre en la tienda)' },
        h(TextInput, { value: d.specs, onChange: (e) => up({ specs: e.target.value }), placeholder: 'Ej: Roble macizo · 120×60 cm · 18 mm' })),
      d.productRef && d.productRef.itemId && h('div', { key: 'pref', className: 'pl-compline' }, [
        h('span', { key: 'c', className: 'pl-chip acc' }, 'PRODUCTO DE LA TIENDA'),
        h('span', { key: 'm', className: 'pl-muted' }, (d.productRef.sourceId ? 'JS #' + d.productRef.sourceId + ' · ' : '') + 'importado del catálogo; revisa que el costo sea el de PROVEEDOR (no el precio de venta).'),
      ]),
      h('div', { key: 'g2', className: 'pl-grid2' }, [
        h(Row, { key: 'c', label: 'Costo proveedor *' }, h(TextInput, { mono: true, type: 'number', min: 0, value: d.cost, onChange: (e) => up({ cost: e.target.value }) })),
        h(Row, { key: 'm', label: 'Moneda' }, h('select', { className: 'pl-select', value: d.currency, onChange: (e) => up({ currency: e.target.value }) },
          [h('option', { key: 'clp', value: 'CLP' }, 'CLP'), h('option', { key: 'usd', value: 'USD' }, 'USD')])),
        h(Row, { key: 'tx', label: 'Impuesto adicional % sobre el costo (aduana/importación; 0 = sin)' },
          h(TextInput, { mono: true, type: 'number', min: 0, value: d.taxPct == null ? 0 : d.taxPct, onChange: (e) => up({ taxPct: e.target.value }) })),
        h(Row, { key: 'st', label: 'Stock (vacío = sin control; 0 = no elegible)' }, h(TextInput, { mono: true, type: 'number', min: 0, value: d.stock == null ? '' : d.stock, onChange: (e) => up({ stock: e.target.value === '' ? null : e.target.value }) })),
        h(Row, { key: 'd', label: 'Días de entrega del proveedor' }, h(TextInput, { mono: true, type: 'number', min: 0, value: d.deliveryDays, onChange: (e) => up({ deliveryDays: e.target.value }) })),
      ]),
      h('div', { key: 'g3', className: 'pl-grid2' }, [
        h(Row, { key: 'sn', label: 'Proveedor' }, h(TextInput, { value: d.supplierName, onChange: (e) => up({ supplierName: e.target.value }), placeholder: 'Ej: PC Factory / AliExpress / Newegg' })),
        h(Row, { key: 'su', label: 'Link del proveedor (para verificar precio)' }, h(TextInput, { mono: true, value: d.supplierUrl, onChange: (e) => up({ supplierUrl: e.target.value }), placeholder: 'https://…' })),
      ]),
      h('div', { key: 'g4', className: 'pl-grid3' }, [
        h(Row, { key: 'tg', label: 'Aporta (tags, coma-sep.)' }, h(TextInput, { mono: true, value: joinList(d.tags), onChange: (e) => up({ tags: e.target.value }), placeholder: 'textura:roble, montaje:pared' })),
        h(Row, { key: 'rq', label: 'Requiere (de otros comp.)' }, h(TextInput, { mono: true, value: joinList(d.requires), onChange: (e) => up({ requires: e.target.value }), placeholder: 'estructura:metal' })),
        h(Row, { key: 'ex', label: 'Incompatible con' }, h(TextInput, { mono: true, value: joinList(d.excludes), onChange: (e) => up({ excludes: e.target.value }), placeholder: 'textura:pino' })),
      ]),
      h('label', { key: 'ac', className: 'pl-switch' }, [
        h('input', { key: 'c', type: 'checkbox', checked: d.active !== false, onChange: (e) => up({ active: e.target.checked }) }),
        h('span', { key: 's' }, 'Activo (disponible en el configurador)'),
      ]),
      h('div', { key: 'pv', className: 'pl-muted' }, [
        'Precio de venta calculado: ',
        h('b', { key: 'p', className: 'pl-price' }, fmtCLP(preview)),
        ' — margen ' + marginFor(d.type) + '% + IVA ' + rules().ivaPct + '%',
      ]),
      h('div', { key: 'a', className: 'pl-actions' }, [
        h('button', { key: 'save', className: 'pl-btn pl-btn-primary', disabled: busy || !s(d.name).trim(), onClick: async () => {
          setBusy(true);
          const wasCostChange = initial && num(initial.cost) !== num(d.cost);
          const r = await saveComponent(Object.assign({}, d, (!initial || wasCostChange) ? { verifiedAt: nowIso() } : {}));
          setBusy(false);
          if (r.success) { shell.notify({ level: 'success', text: r.message }); onDone(); }
        } }, d.id ? 'Guardar cambios' : 'Crear componente'),
      ]),
    ]);
  }

  // ── Pestaña: Componentes ──────────────────────────────────────────────────
  function ComponentesTab({ state }) {
    const [filterType, setFilterType] = useState('');
    const [search, setSearch] = useState('');
    const [onlyStale, setOnlyStale] = useState(false);
    const [editing, setEditing] = useState(null); // null | {} | draft | component
    const [pickingStore, setPickingStore] = useState(false);
    const [costDrafts, setCostDrafts] = useState({}); // verificación rápida por fila
    const [stockDrafts, setStockDrafts] = useState({}); // stock inline por fila
    const [selIds, setSelIds] = useState({});           // selección para acciones masivas
    const [bulkStock, setBulkStock] = useState('');
    const r = rules();
    const list = state.components
      .filter((c) => !filterType || c.type === filterType)
      .filter((c) => !search || norm(c.name + ' ' + c.brand + ' ' + c.specs).indexOf(norm(search)) !== -1)
      .filter((c) => !onlyStale || daysSince(c.verifiedAt) > r.staleDays)
      .sort((a, b) => (onlyStale
        ? daysSince(b.verifiedAt) - daysSince(a.verifiedAt)
        : (a.type === b.type ? s(a.name).localeCompare(s(b.name)) : s(a.type).localeCompare(s(b.type)))));
    const setCostDraft = (id, v) => { const o = Object.assign({}, costDrafts); o[id] = v; setCostDrafts(o); };
    if (editing != null) {
      const isEdit = !!(editing.id || editing.name);
      return h('div', { className: 'pl-editor' }, [
        h('div', { key: 'top', className: 'pl-editor-top' }, [
          h('span', { key: 'sp', style: { flex: 1 } }),
          h('span', { key: 't', className: 'pl-editor-title' }, editing.id ? 'Editar: ' + (editing.name || '') : 'Nuevo componente'),
          h('button', { key: 'back', className: 'pl-btn pl-btn-sm', onClick: () => setEditing(null) }, '← Volver'),
        ]),
        h('div', { key: 'body', className: 'pl-editor-body' },
          h('div', { className: 'pl-card', style: { maxWidth: 900 } },
            h(ComponentForm, { initial: isEdit ? editing : null, onDone: () => setEditing(null) }))),
      ]);
    }
    const saveStock = async (c) => {
      const draft = stockDrafts[c.id];
      if (draft == null) return;
      const next = draft === '' ? null : Math.max(0, num(draft, 0));
      if (next === (c.stock == null ? null : num(c.stock))) return;
      const r = await saveComponent(Object.assign({}, c, { stock: next }));
      if (r.success) {
        const o = Object.assign({}, stockDrafts); delete o[c.id]; setStockDrafts(o);
        shell.notify({ level: 'success', text: 'Stock de "' + c.name + '": ' + (next == null ? 'sin control' : next) + '.' });
      }
    };
    const bulkApply = async (patchFor, label) => {
      const ids = Object.keys(selIds).filter((k) => selIds[k]);
      let ok = 0;
      for (const id of ids) {
        const c = compById(id);
        if (!c) continue;
        const r = await saveComponent(Object.assign({}, c, patchFor(c)));
        if (r.success) ok++;
      }
      shell.notify({ level: 'success', text: label + ': ' + ok + '/' + ids.length + ' componentes.' });
      setSelIds({});
    };
    const verify = async (c) => {
      const draft = costDrafts[c.id];
      const nextCost = draft === '' || draft == null ? num(c.cost) : num(draft, NaN);
      if (!Number.isFinite(nextCost) || nextCost < 0) { shell.notify({ level: 'warn', text: 'Costo inválido.' }); return; }
      const res = await saveComponent(Object.assign({}, c, { cost: nextCost, verifiedAt: nowIso() }));
      if (res.success) {
        setCostDraft(c.id, null);
        const pend = recalcPreview().length;
        shell.notify({ level: 'success', text: '"' + c.name + '" verificado' + (nextCost !== num(c.cost) ? ' con costo ' + nextCost.toLocaleString('es-CL') : '') + '.' + (pend ? ' ' + pend + ' producto(s) por recalcular (pestaña Precios).' : '') });
      }
    };
    return h('div', null, [
      h('div', { key: 'f', className: 'pl-filters' }, [
        h('button', { key: 'new', className: 'pl-btn pl-btn-primary', onClick: () => setEditing({}) }, '+ Componente'),
        h('button', { key: 'store', className: 'pl-btn', title: 'Importar un producto del catálogo de la tienda como componente', onClick: () => setPickingStore(true) }, '+ Desde la tienda'),
        h('select', { key: 't', className: 'pl-select', value: filterType, onChange: (e) => setFilterType(e.target.value) },
          [h('option', { key: '', value: '' }, 'Todos los tipos')].concat(types().map((t) => h('option', { key: t.id, value: t.id }, t.label)))),
        h(TextInput, { key: 's', value: search, onChange: (e) => setSearch(e.target.value), placeholder: 'Buscar…' }),
        h('label', { key: 'st', className: 'pl-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: onlyStale, onChange: (e) => setOnlyStale(e.target.checked) }),
          h('span', { key: 's' }, 'Por verificar (+' + r.staleDays + ' días, más antiguos primero)'),
        ]),
        h('span', { key: 'n', className: 'pl-muted', style: { marginLeft: 'auto' } }, list.length + ' de ' + state.components.length),
      ]),
      (function () {
        const count = Object.keys(selIds).filter((k) => selIds[k]).length;
        if (!count) return null;
        return h('div', { key: 'bulk', className: 'pl-card', style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--pl-accent)' } }, [
          h('b', { key: 'n', style: { fontSize: 12 } }, count + ' seleccionado(s):'),
          h('button', { key: 'v', className: 'pl-btn pl-btn-sm pl-btn-dark', onClick: () => bulkApply(() => ({ verifiedAt: nowIso() }), 'Verificados hoy') }, 'Verificar hoy ✓'),
          h('button', { key: 'on', className: 'pl-btn pl-btn-sm', onClick: () => bulkApply(() => ({ active: true }), 'Activados') }, 'Activar'),
          h('button', { key: 'off', className: 'pl-btn pl-btn-sm', onClick: () => bulkApply(() => ({ active: false }), 'Desactivados') }, 'Desactivar'),
          h('span', { key: 'sep', style: { width: 10 } }),
          h(TextInput, { key: 'st', mono: true, type: 'number', min: 0, value: bulkStock, onChange: (e) => setBulkStock(e.target.value), placeholder: 'stock (vacío = ∞)', style: { width: 130 } }),
          h('button', { key: 'sb', className: 'pl-btn pl-btn-sm', onClick: () => bulkApply(() => ({ stock: bulkStock === '' ? null : Math.max(0, num(bulkStock, 0)) }), 'Stock actualizado') }, 'Fijar stock'),
          h('span', { key: 'sp', className: 'grow', style: { flex: 1 } }),
          h('button', { key: 'x', className: 'pl-btn pl-btn-sm', onClick: () => setSelIds({}) }, 'Deseleccionar'),
        ]);
      })(),
      state.components.length === 0
        ? h('div', { key: 'e', className: 'pl-card pl-muted' }, 'Aún no hay componentes. Crea el catálogo de insumos del producto (materiales, texturas, módulos, tamaños, servicios) con su costo y link de proveedor (o impórtalos desde la tienda); luego arma los productos en la pestaña Productos.')
        : h('div', { key: 'tbl', className: 'pl-card', style: { padding: 0 } },
            h('table', { className: 'pl-table' }, [
              h('thead', { key: 'h' }, h('tr', null, [
                h('th', { key: 'sel' }, h('input', { type: 'checkbox',
                  checked: list.length > 0 && list.every((c) => selIds[c.id]),
                  onChange: (e) => { const o = {}; if (e.target.checked) list.forEach((c) => { o[c.id] = true; }); setSelIds(o); } })),
              ].concat(['', 'Componente', 'Tipo', 'Costo', 'Venta', 'Stock', 'Proveedor', 'Verificado', 'Verificar ahora', ''].map((c, i) => h('th', { key: i }, c))))),
              h('tbody', { key: 'b' }, list.map((c) => {
                const stale = daysSince(c.verifiedAt) > r.staleDays;
                const draft = costDrafts[c.id];
                return h('tr', { key: c.id, style: c.active === false ? { opacity: .45 } : null }, [
                  h('td', { key: 'sel' }, h('input', { type: 'checkbox', checked: !!selIds[c.id],
                    onChange: (e) => { const o = Object.assign({}, selIds); o[c.id] = e.target.checked; setSelIds(o); } })),
                  h('td', { key: 'img' }, h(Thumb, { url: c.imageUrl })),
                  h('td', { key: 'n' }, [
                    h('div', { key: '1', style: { fontWeight: 600, cursor: 'pointer' }, title: 'Editar componente', onClick: () => setEditing(c) }, [
                      c.name,
                      c.productRef && c.productRef.itemId ? h('span', { key: 'pr', className: 'pl-chip acc', style: { marginLeft: 6 } }, 'tienda') : null,
                    ]),
                    h('div', { key: '2', className: 'pl-muted' }, [c.brand, c.specs].filter(Boolean).join(' · ')),
                  ]),
                  h('td', { key: 't' }, h('span', { className: 'pl-chip neg' }, typeLabel(c.type))),
                  h('td', { key: 'c', className: 'pl-price' }, fmtCLP(costCLP(c.cost, c.currency)) + (c.currency === 'USD' ? ' (US$' + num(c.cost) + ')' : '')),
                  h('td', { key: 'v', className: 'pl-price', title: 'margen ' + marginFor(c.type) + '% (' + (r.marginBasis === 'sale' ? 'sobre venta' : 'sobre costo') + ') + IVA' }, fmtCLP(componentSale(c))),
                  h('td', { key: 'stk' }, h(TextInput, { mono: true, type: 'number', min: 0,
                    value: stockDrafts[c.id] != null ? stockDrafts[c.id] : (c.stock == null ? '' : c.stock),
                    placeholder: '∞',
                    title: 'Stock (vacío = sin control; 0 = no elegible). Se guarda al salir del campo.',
                    style: { width: 64, borderColor: c.stock != null && num(c.stock) === 0 ? 'var(--pl-err)' : undefined },
                    onChange: (e) => { const o = Object.assign({}, stockDrafts); o[c.id] = e.target.value; setStockDrafts(o); },
                    onBlur: () => void saveStock(c) })),
                  h('td', { key: 'p' }, c.supplierUrl
                    ? h('a', { className: 'pl-link', href: c.supplierUrl, target: '_blank', rel: 'noopener noreferrer' }, (c.supplierName || 'ver') + ' ↗')
                    : h('span', { className: 'pl-muted' }, c.supplierName || '—')),
                  h('td', { key: 'vf', className: stale ? 'pl-stale' : '' }, fmtDate(c.verifiedAt) + (stale && c.verifiedAt ? ' (' + daysSince(c.verifiedAt) + 'd)' : '')),
                  h('td', { key: 'now' }, h('div', { className: 'pl-verify-cost' }, [
                    h(TextInput, { key: 'i', mono: true, type: 'number', min: 0, placeholder: s(c.cost),
                      title: 'Nuevo costo (' + (c.currency || 'CLP') + ') — vacío = confirmar el actual',
                      value: draft == null ? '' : draft, onChange: (e) => setCostDraft(c.id, e.target.value) }),
                    h('button', { key: 'b', className: 'pl-btn pl-btn-sm pl-btn-dark', title: 'Marcar verificado hoy', onClick: () => void verify(c) }, '✓'),
                  ])),
                  h('td', { key: 'a', style: { whiteSpace: 'nowrap' } }, [
                    h('button', { key: 'e', className: 'pl-btn pl-btn-sm', onClick: () => setEditing(c) }, 'Editar'),
                    ' ',
                    h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: async () => {
                      if (!window.confirm('¿Eliminar "' + c.name + '"?')) return;
                      const res = await removeComponent(c.id);
                      if (!res.success) shell.notify({ level: 'error', text: res.error });
                    } }, '✕'),
                  ]),
                ]);
              })),
            ])),

      pickingStore && h(ProductPicker, { key: 'storepicker', onClose: () => setPickingStore(false), onPick: (p) => {
        setPickingStore(false);
        const js = (p.sourceLinks || []).find((x) => x && x.integration === 'jumpseller');
        setEditing({
          name: p.name || '',
          imageUrl: p.imageUrl || '',
          // costPerItem si la tienda lo tiene; si no, cae al precio de venta (revisar).
          cost: p.costPerItem != null ? num(p.costPerItem) : num(p.price),
          currency: 'CLP',
          stock: typeof p.stock === 'number' ? p.stock : null,
          supplierName: 'Catálogo de la tienda',
          productRef: { instanceId: p.__instanceId, itemId: p.id, sourceId: js ? js.sourceId : null },
        });
      } }),
    ]);
  }

  // ── Picker de producto Jumpseller (catálogo de la app products) ───────────
  function ProductPicker({ onPick, onClose }) {
    const [q, setQ] = useState('');
    const list = model.storeCatalog
      .filter((p) => !q || norm(p.name + ' ' + p.sku).indexOf(norm(q)) !== -1)
      .slice(0, 60);
    return h(Modal, { title: 'Enlazar con producto de la tienda', onClose }, [
      !model.storeCatalogLoaded
        ? h('div', { key: 'l', className: 'pl-muted' }, 'Cargando catálogo desde la app Productos…')
        : model.storeCatalog.length === 0
          ? h('div', { key: 'e', className: 'pl-warnbox' },
              'No se pudo leer el catálogo de la app Productos (¿permiso data.read:products aprobado? ¿instancia de Productos visible para tu equipo de trabajo?). Puedes ingresar el ID de producto Jumpseller manualmente en el formulario.')
          : null,
      h(TextInput, { key: 'q', value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Buscar por nombre o SKU…', autoFocus: true }),
      h('div', { key: 'list', style: { marginTop: 10 } }, list.map((p) => {
        const link = (p.sourceLinks || []).find((x) => x && x.integration === 'jumpseller');
        return h('div', { key: p.id, className: 'pl-compline' }, [
          h(Thumb, { key: 'i', url: p.imageUrl }),
          h('div', { key: 'n', className: 'grow' }, [
            h('div', { key: '1', style: { fontWeight: 600 } }, p.name),
            h('div', { key: '2', className: 'pl-muted pl-mono', style: { fontSize: 10 } },
              (p.sku ? 'SKU ' + p.sku + ' · ' : '') + (link ? 'JS #' + link.sourceId : 'sin enlace Jumpseller')),
          ]),
          h('span', { key: 'p', className: 'pl-price' }, fmtCLP(p.price)),
          h('button', { key: 'b', className: 'pl-btn pl-btn-sm pl-btn-primary', onClick: () => onPick(p) }, 'Enlazar'),
        ]);
      })),
    ]);
  }

  // ── Previsualizador en vivo del configurador ──────────────────────────────
  // Simula el paso a paso COMO LO VERÁ EL CLIENTE en la tienda: cards por
  // valor, dependencias (pasos que aparecen/desaparecen según lo elegido),
  // cantidades, foto dinámica, precio y entrega en vivo. Refleja
  // storefront.style (acento, radio, tipo de card, recargos). El cobro real
  // en la tienda siempre es el de la variante Jumpseller; esta simulación usa
  // las mismas reglas de cálculo de la app.
  function ConfigPreview({ draft }) {
    const [sel, setSel] = useState({});      // groupId → valueId elegido
    const [mob, setMob] = useState(false);
    const st = (draft.storefront && draft.storefront.style) || {};
    const accent = /^#[0-9a-fA-F]{6}$/.test(s(st.accentColor).trim()) ? s(st.accentColor).trim() : '#19ACB1';
    const radius = Math.max(0, num(st.radius, 0));
    const compact = st.cardStyle === 'compact';
    const asList = st.cardStyle === 'list';
    const groups = (draft.groups || []).map((g) => ({ g, vals: groupValues(g).filter(valueAvailable) })).filter((x) => x.vals.length);
    const selMap = {};
    groups.forEach(({ g }) => {
      const vals = groupValues(g).filter(valueAvailable);
      selMap[g.id] = vals.some((v) => v.id === sel[g.id]) ? sel[g.id] : (groupDefaultValue(g) || {}).id;
    });
    const visibleOf = (g) => groupVisibleFor(draft, g, selMap);
    // Precio y entrega: base + valor efectivo de cada paso (oculto = default).
    let gross = baseBreakdown(draft).gross;
    const sumMode = deliveryModeOf(draft) === 'sum';
    let dd = productoBaseDelivery(draft);
    groups.forEach(({ g }) => {
      const vid = visibleOf(g) ? selMap[g.id] : (groupDefaultValue(g) || {}).id;
      const v = groupValues(g).find((x) => x.id === vid);
      const vg = v ? valueGross(v) : null;
      if (vg != null) gross += vg;
      const c = v && valueChosen(v);
      const n = c ? num(c.deliveryDays, 0) : 0;
      dd = sumMode ? dd + n : Math.max(dd, n);
    });
    dd += numOr(draft.deliveryExtraDays, rules().assemblyDays);
    const price = roundFinal(gross);
    // Foto dinámica: primer paso "cambia foto" visible, con la foto del valor.
    const photoG = groups.map((x) => x.g).find((g) => g.photoStep === true && visibleOf(g));
    const photoV = photoG && groupValues(photoG).find((x) => x.id === selMap[photoG.id]);
    const photo = (photoV && photoV.imageUrl) || productoImage(draft);
    const deltaVs = (g, v) => {
      const cur = groupValues(g).find((x) => x.id === selMap[g.id]);
      const a = valueSale(v); const b = cur ? valueSale(cur) : null;
      return a == null || b == null ? 0 : a - b;
    };
    const cardW = compact ? 96 : 128;
    return h('div', { className: 'pl-card' }, [
      h('div', { key: 't', className: 'pl-card-title' }, [
        h('span', { key: 'n', className: 'pl-num' }, 'PREVISUALIZADOR'),
        'Así verá el cliente el paso a paso',
        h('span', { key: 'sp', style: { flex: 1 } }),
        h('div', { key: 'vm', className: 'pl-editor-tabs' }, [
          h('button', { key: 'd', className: 'pl-etab' + (!mob ? ' on' : ''), onClick: () => setMob(false) }, 'Escritorio'),
          h('button', { key: 'm', className: 'pl-etab' + (mob ? ' on' : ''), onClick: () => setMob(true) }, 'Móvil'),
        ]),
        h('button', { key: 'rst', className: 'pl-btn pl-btn-sm', style: { marginLeft: 8 }, onClick: () => setSel({}) }, 'Restablecer'),
      ]),
      h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 8 } },
        'Interactivo y en vivo: prueba selecciones, dependencias (los pasos aparecen según lo elegido), cantidades y el estilo definido en Ficha → Estilo. El precio simulado usa las mismas reglas de cálculo de la app; el cobro real en la tienda es siempre el de la variante Jumpseller.'),
      h('div', { key: 'pv', className: 'pl-storepv', style: { overflowX: 'auto', '--pv-radius': radius + 'px' } },
        h('div', { style: { width: mob ? 375 : '100%', maxWidth: mob ? 375 : 980, margin: '0 auto', border: '1px solid var(--pl-gris-claro)', background: s(st.bgColor).trim() || '#fff', padding: mob ? 10 : 16, display: 'flex', flexDirection: mob ? 'column' : 'row', gap: 16 } }, [
          h('div', { key: 'steps', style: { flex: 2, minWidth: 0 } },
            groups.length === 0
              ? h('div', { className: 'pl-muted' }, 'Sin pasos aún: agrega pasos arriba para previsualizar el configurador.')
              : groups.map(({ g, vals }, gi) => {
                  if (!visibleOf(g)) return h('div', { key: g.id, className: 'pl-muted', style: { padding: '6px 0', fontSize: 11, opacity: .65 } },
                    'PASO ' + String(gi + 1).padStart(2, '0') + ' · ' + (g.label || typeLabel(g.typeId)) + ' — oculto por dependencia (la tienda usa su valor por defecto)');
                  return h('div', { key: g.id, style: { marginBottom: 14 } }, [
                    h('div', { key: 'h', style: { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', marginBottom: 6 } }, [
                      h('span', { key: 'n', style: { color: accent } }, 'PASO ' + String(gi + 1).padStart(2, '0')),
                      h('span', { key: 'l' }, ' · ' + (g.label || typeLabel(g.typeId))),
                    ]),
                    h('div', { key: 'vals', style: asList ? { display: 'flex', flexDirection: 'column', gap: 6 } : { display: 'flex', flexWrap: 'wrap', gap: 8 } }, vals.map((v) => {
                      const on = selMap[g.id] === v.id;
                      const dlt = deltaVs(g, v);
                      const alt = valueChosen(v);
                      const img = v.imageUrl || (alt && alt.imageUrl) || '';
                      const deltaTxt = st.showDeltas === 'none' || on ? '' : st.showDeltas === 'total' ? fmtCLP(roundFinal(gross + dlt)) : (dlt === 0 ? '' : fmtDelta(dlt));
                      return h('div', {
                        key: v.id,
                        onClick: () => { const o = Object.assign({}, sel); o[g.id] = v.id; setSel(o); },
                        title: v.label,
                        style: Object.assign({
                          cursor: 'pointer',
                          border: on ? '2px solid ' + accent : '1px solid var(--pl-gris-claro)',
                          background: '#fff', padding: compact ? 6 : 8,
                        }, asList ? { display: 'flex', alignItems: 'center', gap: 10 } : { width: cardW }),
                      }, [
                        g.photoStep && v.swatchColor
                          ? h('span', { key: 'sw', style: { display: 'inline-block', width: 22, height: 22, background: v.swatchColor, border: '1px solid rgba(0,0,0,.15)' } })
                          : img
                            ? h('img', { key: 'i', src: img, alt: '', style: asList ? { width: 40, height: 40, objectFit: 'cover' } : { width: '100%', height: compact ? 44 : 64, objectFit: 'cover' } })
                            : (asList || compact ? null : h('div', { key: 'i', style: { width: '100%', height: 44, background: 'var(--pl-plata)' } })),
                        h('div', { key: 'n', style: { fontSize: compact ? 10.5 : 11.5, fontWeight: 600, marginTop: asList ? 0 : 4, minWidth: 0 } }, v.label + (valueQty(v) > 1 ? ' (×' + valueQty(v) + ')' : '')),
                        deltaTxt ? h('div', { key: 'd', style: { fontSize: 10, opacity: .8, marginLeft: asList ? 'auto' : 0, whiteSpace: 'nowrap' } }, deltaTxt) : null,
                      ]);
                    })),
                  ]);
                })),
          h('div', { key: 'panel', style: { flex: 1, minWidth: mob ? 0 : 240, border: '1px solid var(--pl-gris-claro)', background: '#fff', padding: 12, alignSelf: 'flex-start' } }, [
            photo ? h('img', { key: 'ph', src: photo, alt: '', style: { width: '100%', maxHeight: 160, objectFit: 'contain', marginBottom: 8 } }) : null,
            h('div', { key: 'nm', style: { fontWeight: 700, fontSize: 13, marginBottom: 4 } }, draft.name || 'Producto'),
            h('div', { key: 'pr', className: 'pl-price', style: { fontSize: 20 } }, fmtCLP(price)),
            h('div', { key: 'dd', className: 'pl-muted', style: { margin: '4px 0 8px' } }, 'Entrega estimada: ' + dd + ' día(s) hábiles'),
            h('div', { key: 'sum', style: { fontSize: 11, borderTop: '1px dashed var(--pl-linea)', paddingTop: 6 } },
              groups.filter(({ g }) => visibleOf(g)).map(({ g }) => {
                const v = groupValues(g).find((x) => x.id === selMap[g.id]);
                return h('div', { key: g.id, style: { padding: '2px 0' } }, [
                  h('span', { key: 'l', className: 'pl-muted' }, (g.label || typeLabel(g.typeId)) + ': '),
                  h('b', { key: 'v' }, v ? v.label : '—'),
                ]);
              })),
            h('div', { key: 'cta', style: { marginTop: 10 } },
              h('span', { style: { display: 'inline-block', width: '100%', textAlign: 'center', padding: '9px 12px', fontWeight: 600, fontSize: 12, color: '#fff', background: accent, cursor: 'default', boxSizing: 'border-box' } },
                ((draft.storefront || {}).tabs || {}).comprar || 'Agregar al carro')),
          ]),
        ])),
    ]);
  }

  // ── Formulario de producto ──────────────────────────────────────────────────
  function ProductoForm({ initial, onDone }) {
    const [d, setD] = useState(() => Object.assign({
      name: '', sku: '', status: 'active', imageUrl: '',
      baseComponentIds: [], extraCosts: [], groups: [], productRef: null, deliveryExtraDays: null,
    }, initial ? normalizeProductoShape(initial) : {}));
    const [busy, setBusy] = useState(false);
    const [picking, setPicking] = useState(false);
    const [baseSel, setBaseSel] = useState('');
    const [quickSel, setQuickSel] = useState({});
    const [sec, setSec] = useState('general');
    const [heroSel, setHeroSel] = useState({});   // builder: sección id → contenedor seleccionado
    const [blockSel, setBlockSel] = useState({}); // builder: sección id → tipo de bloque a agregar
    const [viewMode, setViewMode] = useState('desk'); // preview: escritorio | móvil
    const dragRef = useState({ current: null })[0];   // bloque en arrastre (drag & drop)
    const [galBusy, setGalBusy] = useState(false);    // subida múltiple a la galería
    // Visualizador 3D: texto del JSON de configuración (se parsea al salir del campo)
    const [v3Text, setV3Text] = useState(() => (initial && initial.model3d && initial.model3d.config ? JSON.stringify(initial.model3d.config, null, 2) : ''));
    const [v3Err, setV3Err] = useState('');
    const up = (patch) => setD(Object.assign({}, d, patch));
    const upV3 = (patch) => up({ model3d: Object.assign({}, d.model3d || {}, patch) });
    const upGroup = (gid, patch) => up({ groups: d.groups.map((g) => (g.id === gid ? Object.assign({}, g, patch) : g)) });
    const upExtra = (xid, patch) => up({ extraCosts: (d.extraCosts || []).map((x) => (x.id === xid ? Object.assign({}, x, patch) : x)) });
    const sf = d.storefront || {};
    const specRows = Array.isArray(sf.specs) ? sf.specs : [];
    const upSpecs = (specs) => up({ storefront: Object.assign({}, sf, { specs }) });
    const upSpecRow = (sid, patch) => upSpecs(specRows.map((x) => (x.id === sid ? Object.assign({}, x, patch) : x)));
    const sfTabs = sf.tabs || {};
    const upTabs = (patch) => up({ storefront: Object.assign({}, sf, { tabs: Object.assign({}, sfTabs, patch) }) });
    const sfPage = Array.isArray(sf.pageSections) ? sf.pageSections : [];
    const upPage = (pageSections) => up({ storefront: Object.assign({}, sf, { pageSections }) });
    const upPageX = (psid, patch) => upPage(sfPage.map((x) => (x.id === psid ? Object.assign({}, x, patch) : x)));
    const genSpecs = () => {
      // Siembra filas SIN grupo: la tabla es 100% manual (el campo "Grupo"
      // queda disponible por si el usuario quiere secciones propias).
      const rows = [];
      baseBreakdown(d).comps.forEach((c) => rows.push({ id: newId('sp'), group: '', label: typeLabel(c.type), value: c.name + (c.specs ? ' · ' + c.specs : '') }));
      (d.groups || []).forEach((g) => {
        const dv = groupDefaultValue(g);
        const alt = dv && valueChosen(dv);
        rows.push({ id: newId('sp'), group: '', label: g.label || typeLabel(g.typeId), value: dv ? dv.label + (alt && alt.specs ? ' · ' + alt.specs : '') : '' });
      });
      upSpecs(specRows.concat(rows));
    };
    const ref = productRefOf(d);
    const prodImgs = productImagesFor(d); // galería del producto (Jumpseller)
    // Pickers "Galería…": fotos del producto + biblioteca del producto EN VIVO
    // (lo que subas en cualquier campo aparece al tiro, sin guardar).
    const productoGallery = (function () {
      const out = prodImgs.slice();
      collectProductoImages(d).forEach((u) => { if (out.indexOf(u) === -1) out.push(u); });
      return out;
    })();
    const legacy = !ref && legacyLink(d);
    const price = productoComputedPrice(d);
    const combos = comboCount(d);
    const warns = productoWarnings(d);
    const SECTIONS = [['general', 'General'], ['pasos', 'Pasos y componentes'], ['ficha', 'Ficha de tienda']];
    return h('div', { className: 'pl-editor' }, [
      // ── Barra superior: volver + título + secciones ──
      h('div', { key: 'top', className: 'pl-editor-top' }, [
        h('div', { key: 'tabs', className: 'pl-editor-tabs' }, SECTIONS.map(([id, label]) =>
          h('button', { key: id, className: 'pl-etab' + (sec === id ? ' on' : ''), onClick: () => setSec(id) }, label))),
        h('span', { key: 'sp', style: { flex: 1 } }),
        ref ? h('span', { key: 'js', className: 'pl-chip acc' }, ref.sourceId ? 'JS #' + ref.sourceId : 'enlazado') : h('span', { key: 'js', className: 'pl-chip gris' }, 'sin enlace'),
        h('span', { key: 't', className: 'pl-editor-title' }, d.name || 'Nuevo producto'),
        h('button', { key: 'back', className: 'pl-btn pl-btn-sm', onClick: onDone }, '← Volver'),
      ]),
      // ── Cuerpo: una sección a la vez, a todo el ancho ──
      h('div', { key: 'body', className: 'pl-editor-body' }, [
        h('div', { key: 'g', style: sec === 'general' ? null : { display: 'none' } }, [
      // Enlace con el producto de la app products (que sincroniza con Jumpseller)
      h('div', { key: 'link', className: 'pl-card', style: { background: 'var(--pl-plata)' } }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'TIENDA'), 'Producto de la tienda']),
        legacy && h('div', { key: 'legacy', className: 'pl-warnbox' },
          'Enlace de la versión anterior detectado (JS #' + legacy.sourceId + '). Re-enlaza con "Enlazar producto…" para poder aplicar opciones y variantes.'),
        ref
          ? h('div', { key: 'st', className: 'pl-compline' }, [
              h(Thumb, { key: 'img', url: productoImage(d) }),
              h('span', { key: 'c', className: 'pl-chip acc' }, ref.sourceId ? 'JS #' + ref.sourceId : 'producto local'),
              h('span', { key: 'nm', style: { fontWeight: 600 } }, (productItemFor(d) || {}).name || ref.name || ref.itemId),
              h('span', { key: 'm', className: 'pl-muted grow' }, '"Aplicar a la tienda" escribe precio, opciones y variantes en este producto (vía app Productos → Jumpseller).'),
              h('button', { key: 'x', className: 'pl-btn pl-btn-sm', onClick: () => up({ productRef: null }) }, 'Desenlazar'),
            ])
          : h('div', { key: 'no', className: 'pl-compline' }, [
              h('span', { key: 'm', className: 'pl-muted grow' }, 'Sin enlace: el producto no se aplica a la tienda todavía.'),
              h('button', { key: 'b', className: 'pl-btn pl-btn-sm pl-btn-dark', onClick: () => setPicking(true) }, 'Enlazar producto…'),
            ]),
      ]),
      h('div', { key: 'g1', className: 'pl-grid2' }, [
        h(Row, { key: 'n', label: 'Nombre *' }, h(TextInput, { value: d.name, onChange: (e) => up({ name: e.target.value }), placeholder: 'Ej: Mesa Nórdica 120' })),
        h(Row, { key: 's', label: 'SKU (debe calzar con la tienda)' }, h(TextInput, { mono: true, value: d.sku, onChange: (e) => up({ sku: e.target.value }), placeholder: 'PL-0001' })),
        h(Row, { key: 'su', label: 'URL del producto (vacío = automática: URL base de la tienda + permalink del producto sincronizado)' },
          h(TextInput, { mono: true, value: d.storeUrl || '', onChange: (e) => up({ storeUrl: e.target.value }),
            placeholder: (function () { const auto = productoStoreUrl(Object.assign({}, d, { storeUrl: '' })); return auto || 'automática al sincronizar (o pégala aquí)'; })() })),
      ]),
      // ── Base: componentes reales incluidos + costos adicionales manuales ──
      h('div', { key: 'basecard', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'BASE'), 'Componentes base y costos adicionales']),
        h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 8 } },
          'Los componentes base van siempre incluidos y definen el costo base (cada uno con el margen de su tipo). Los costos adicionales son manuales (producción, embalaje, otros) y usan el "margen de costos adicionales" de la pestaña Precios.'),
        h(React.Fragment, { key: 'bc' }, (d.baseComponentIds || []).map(compById).filter(Boolean).map((c) => h('div', { key: c.id, className: 'pl-compline' }, [
          h('span', { key: 'n', className: 'grow', style: { fontWeight: 600 } }, c.name),
          h('span', { key: 'ty', className: 'pl-chip neg' }, typeLabel(c.type)),
          !compAvailable(c) && h('span', { key: 'w', className: 'pl-chip err' }, 'no disponible'),
          h('span', { key: 'p', className: 'pl-price' }, fmtCLP(componentSale(c))),
          h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => up({ baseComponentIds: d.baseComponentIds.filter((id) => id !== c.id) }) }, '✕'),
        ]))),
        h('div', { key: 'addbc', className: 'pl-compline', style: { borderBottom: 0, marginTop: 6 } }, [
          h('select', { key: 'sel', className: 'pl-select', style: { maxWidth: 360 }, value: baseSel, onChange: (e) => setBaseSel(e.target.value) },
            [h('option', { key: '', value: '' }, 'Elegir componente del catálogo…')].concat(
              types().map((t) => {
                const opts = model.components.filter((c) => c.type === t.id && (d.baseComponentIds || []).indexOf(c.id) === -1);
                return opts.length
                  ? h('optgroup', { key: t.id, label: t.label }, opts.map((c) => h('option', { key: c.id, value: c.id }, c.name + ' — ' + fmtCLP(componentSale(c)))))
                  : null;
              }).filter(Boolean))),
          h('button', { key: 'add', className: 'pl-btn pl-btn-sm pl-btn-dark', disabled: !baseSel, onClick: () => {
            if (!baseSel) return;
            up({ baseComponentIds: (d.baseComponentIds || []).concat([baseSel]) });
            setBaseSel('');
          } }, '+ Componente base'),
        ]),
        h(React.Fragment, { key: 'ec' }, (d.extraCosts || []).map((x) => h('div', { key: x.id, className: 'pl-compline' }, [
          h(TextInput, { key: 'l', value: x.label, placeholder: 'Concepto (ej: Producción y embalaje)', style: { width: 220 }, onChange: (e) => upExtra(x.id, { label: e.target.value }) }),
          h(TextInput, { key: 'c', mono: true, type: 'number', min: 0, value: x.cost, style: { width: 120 }, onChange: (e) => upExtra(x.id, { cost: e.target.value }) }),
          h('select', { key: 'm', className: 'pl-select', style: { width: 80 }, value: x.currency || 'CLP', onChange: (e) => upExtra(x.id, { currency: e.target.value }) },
            [h('option', { key: '1', value: 'CLP' }, 'CLP'), h('option', { key: '2', value: 'USD' }, 'USD')]),
          h('span', { key: 'sp', className: 'grow' }),
          h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => up({ extraCosts: d.extraCosts.filter((y) => y.id !== x.id) }) }, '✕'),
        ]))),
        h('div', { key: 'bact', className: 'pl-compline', style: { borderBottom: 0, marginTop: 4 } }, [
          h('button', { key: 'addec', className: 'pl-btn pl-btn-sm', onClick: () => up({ extraCosts: (d.extraCosts || []).concat([{ id: newId('ec'), label: '', cost: 0, currency: 'CLP' }]) }) }, '+ Costo adicional'),
          h('span', { key: 'sp', className: 'grow' }),
          h('span', { key: 'tot', className: 'pl-muted' }, 'Base bruta (margen + IVA, sin redondeo): ' + fmtCLP(baseBreakdown(d).gross)),
        ]),
        h(Row, { key: 'dd', label: 'Días de preparación (vacío = regla global: ' + rules().assemblyDays + ')' },
          h(TextInput, { mono: true, type: 'number', min: 0, value: d.deliveryExtraDays == null ? '' : d.deliveryExtraDays, onChange: (e) => up({ deliveryExtraDays: e.target.value === '' ? null : e.target.value }) })),
        h(Row, { key: 'dm', label: 'Cálculo de entrega' },
          h('select', { className: 'pl-select', value: d.deliveryMode === 'sum' ? 'sum' : 'max', onChange: (e) => up({ deliveryMode: e.target.value }) }, [
            h('option', { key: 'max', value: 'max' }, 'En paralelo — manda el componente más lento (producción local)'),
            h('option', { key: 'sum', value: 'sum' }, 'En serie — los días se SUMAN (dropshipping / logística encadenada)'),
          ])),
      ]),
      ]),
        h('div', { key: 'p', style: sec === 'pasos' ? null : { display: 'none' } }, [
      // Pasos: valores genéricos (lo que ve el cliente) con pool de alternativas
      h('div', { key: 'gh', className: 'pl-card-title', style: { marginTop: 6 } }, [h('span', { key: 'n', className: 'pl-num' }, 'CONFIGURADOR'), 'Pasos, valores y alternativas']),
      h('div', { key: 'ghelp', className: 'pl-muted', style: { marginBottom: 8 } },
        'Cada paso tiene VALORES genéricos (la etiqueta que ve el cliente, sin marca: "Cubierta roble") y cada valor un pool de componentes ALTERNATIVOS de distintos proveedores. El precio usa siempre la alternativa más económica disponible (activa y con stock), multiplicada por la cantidad del valor; sus specs e imagen alimentan el detalle en la tienda.'),
      h(React.Fragment, { key: 'groups' }, d.groups.map((g, gi) => {
        const candidates = model.components.filter((c) => c.type === g.typeId);
        const vals = groupValues(g);
        const dv = groupDefaultValue(g);
        const upValue = (vid, patch) => upGroup(g.id, { values: vals.map((v) => (v.id === vid ? Object.assign({}, v, patch) : v)) });
        return h('div', { key: g.id, className: 'pl-group' }, [
          h('div', { key: 'h', className: 'pl-group-head' }, [
            h('span', { key: 's', className: 'pl-step' }, 'PASO ' + String(gi + 1).padStart(2, '0')),
            h('select', { key: 't', className: 'pl-select', style: { width: 'auto' }, value: g.typeId, onChange: (e) => upGroup(g.id, { typeId: e.target.value, values: [], defaultValueId: null }) },
              types().map((t) => h('option', { key: t.id, value: t.id }, t.label))),
            h(TextInput, { key: 'l', value: g.label, onChange: (e) => upGroup(g.id, { label: e.target.value }), placeholder: 'Título del paso (opcional): ' + typeLabel(g.typeId), style: { width: 220 } }),
            h('label', { key: 'ph', className: 'pl-switch', style: { margin: 0 }, title: 'La selección de este paso cambia la foto del producto en la tienda (usa la foto de cada valor — ideal para colores)' }, [
              h('input', { key: 'c', type: 'checkbox', checked: g.photoStep === true, onChange: (e) => upGroup(g.id, { photoStep: e.target.checked }) }),
              h('span', { key: 's' }, 'cambia foto'),
            ]),
            // Paso dependiente: visible solo si un paso ANTERIOR tiene elegido
            // alguno de los valores marcados (elemento condicional del paso a paso).
            gi > 0 ? h('select', {
              key: 'dep', className: 'pl-select', style: { width: 'auto' },
              title: 'Paso dependiente: en la tienda solo se muestra si el paso elegido tiene seleccionado uno de los valores marcados abajo',
              value: (groupDependsOn(g) || {}).stepId || '',
              onChange: (e) => {
                const sid = e.target.value;
                if (!sid) { upGroup(g.id, { dependsOn: null }); return; }
                const tgt = d.groups.find((x) => x.id === sid);
                upGroup(g.id, { dependsOn: { stepId: sid, valueIds: groupValues(tgt || {}).map((v) => v.id) } });
              },
            }, [h('option', { key: '', value: '' }, 'siempre visible')].concat(
              d.groups.slice(0, gi).map((x, xi) => h('option', { key: x.id, value: x.id }, 'depende del PASO ' + String(xi + 1).padStart(2, '0') + ' · ' + (x.label || typeLabel(x.typeId)))))) : null,
            h('span', { key: 'sp', style: { flex: 1 } }),
            gi > 0 && h('button', { key: 'up', className: 'pl-btn pl-btn-sm', title: 'Subir', onClick: () => {
              const gs = d.groups.slice(); const t = gs[gi - 1]; gs[gi - 1] = gs[gi]; gs[gi] = t; up({ groups: gs });
            } }, '↑'),
            h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => up({ groups: d.groups.filter((x) => x.id !== g.id) }) }, 'Quitar paso'),
          ]),
          h('div', { key: 'b', className: 'pl-group-body' }, [
            // Editor de la condición del paso dependiente
            (function () {
              const dep = groupDependsOn(g);
              if (!dep) return null;
              const target = d.groups.find((x) => x.id === dep.stepId);
              if (!target) return null;
              return h('div', { key: 'dep', className: 'pl-warnbox', style: { background: 'var(--pl-plata)', border: '1px solid var(--pl-gris-claro)', color: 'var(--pl-negro)' } }, [
                h('div', { key: 't', className: 'pl-label', style: { marginBottom: 4 } },
                  'Visible en la tienda solo si "' + (target.label || typeLabel(target.typeId)) + '" es:'),
                h('div', { key: 'l', style: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px' } }, groupValues(target).map((tv) => h('label', { key: tv.id, className: 'pl-switch', style: { margin: 0 } }, [
                  h('input', { key: 'c', type: 'checkbox', checked: dep.valueIds.indexOf(tv.id) !== -1, onChange: (e) => {
                    const ids = e.target.checked ? dep.valueIds.concat([tv.id]) : dep.valueIds.filter((x) => x !== tv.id);
                    upGroup(g.id, { dependsOn: ids.length ? { stepId: dep.stepId, valueIds: ids } : null });
                  } }),
                  h('span', { key: 's' }, tv.label || '(sin nombre)'),
                ]))),
                h('div', { key: 'h', className: 'pl-muted', style: { marginTop: 4 } },
                  'Cuando el paso quede oculto, la tienda usa su valor por defecto. Hazlo NEUTRO (un valor sin componentes = $0, ej. "Sin ' + (g.label || typeLabel(g.typeId)).toLowerCase() + '") para no recargar precio a quien no lo ve.'),
              ]);
            })(),
            vals.length === 0 && h('div', { key: 'e', className: 'pl-muted' },
              'Sin valores aún. Agrega los que verá el cliente (ej: "Roble natural", "Nogal oscuro") y márcale a cada uno sus alternativas. Un valor SIN componentes es un valor neutro de $0 (ej: "Sin accesorio").'),
            h(React.Fragment, { key: 'vals' }, vals.map((v) => {
              const alts = valueAlts(v);
              const chosen = valueChosen(v);
              const delta = deltaFor(g, v);
              const isDef = !!(dv && dv.id === v.id);
              return h('div', { key: v.id, style: { borderTop: '1px dashed var(--pl-linea)', padding: '8px 0' } }, [
                h('div', { key: 'l1', className: 'pl-compline', style: { borderBottom: 0 } }, [
                  h('label', { key: 'def', className: 'pl-switch', style: { margin: 0 }, title: 'Valor incluido por defecto en el producto' },
                    h('input', { type: 'radio', name: 'pl-def-' + g.id, checked: isDef, onChange: () => upGroup(g.id, { defaultValueId: v.id }) })),
                  h(TextInput, { key: 'lbl', value: v.label, placeholder: 'Etiqueta genérica (ej: Roble natural)', style: { width: 220 }, onChange: (e) => upValue(v.id, { label: e.target.value }) }),
                  h('span', { key: 'qx', className: 'pl-label', title: 'Cantidad' }, '×'),
                  h(TextInput, { key: 'qty', mono: true, type: 'number', min: 1, style: { width: 52 },
                    title: 'Cantidad: cuántas unidades del componente elegido incluye este valor (ej. 2 para ofrecer "2×8GB" en un solo paso). Multiplica precio y exige stock suficiente.',
                    value: v.qty == null ? 1 : v.qty, onChange: (e) => upValue(v.id, { qty: e.target.value }) }),
                  (v.componentIds || []).length === 0 ? h('label', { key: 'neu', className: 'pl-switch', style: { margin: 0 }, title: 'Valor neutro: opción válida de $0 sin componentes (ej. "Sin accesorio"); ideal como default de pasos dependientes' }, [
                    h('input', { key: 'c', type: 'checkbox', checked: v.neutral === true, onChange: (e) => upValue(v.id, { neutral: e.target.checked }) }),
                    h('span', { key: 's' }, 'neutro $0'),
                  ]) : null,
                  valueIsNeutral(v)
                    ? h('span', { key: 'ch', className: 'pl-chip gris' }, 'neutro · $0')
                    : chosen
                    ? h('span', { key: 'ch', className: 'pl-muted' }, 'usa: ' + chosen.name + (valueQty(v) > 1 ? ' ×' + valueQty(v) : '') + ' → ' + fmtCLP(valueSale(v)))
                    : h('span', { key: 'ch', className: 'pl-chip err' }, alts.length ? 'sin alternativas disponibles' : 'sin componentes'),
                  h('span', { key: 'sp', className: 'grow' }),
                  isDef
                    ? h('span', { key: 'd', className: 'pl-chip acc' }, 'incluido')
                    : h('span', { key: 'd', className: 'pl-delta' + (delta < 0 ? ' neg' : '') }, fmtDelta(delta)),
                  h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', title: 'Quitar valor', onClick: () => upGroup(g.id, { values: vals.filter((y) => y.id !== v.id), defaultValueId: g.defaultValueId === v.id ? null : g.defaultValueId }) }, '✕'),
                ]),
                h('div', { key: 'limg', style: { paddingLeft: 26, maxWidth: 560 } },
                  h(ImgField, { value: v.imageUrl || '', gallery: productoGallery, onChange: (u) => upValue(v.id, { imageUrl: u }), placeholder: g.photoStep ? 'Foto del producto en este color' : 'Foto propia del valor (si no, usa la de la alternativa elegida)' })),
                g.photoStep === true && h('div', { key: 'lsw', style: { paddingLeft: 26, maxWidth: 560 } },
                  h(ColorField, { label: null, value: v.swatchColor || '', onChange: (c) => upValue(v.id, { swatchColor: c }), placeholder: '#1D1D1B — color del puntito selector en la tienda' })),
                h('div', { key: 'l2', style: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px', paddingLeft: 26, marginTop: 4 } },
                  candidates.length === 0
                    ? [h('span', { key: 'none', className: 'pl-muted' }, 'No hay componentes de tipo "' + typeLabel(g.typeId) + '". Créalos en Componentes.')]
                    : candidates.map((c) => {
                        const inSet = (v.componentIds || []).indexOf(c.id) !== -1;
                        const isChosen = !!(chosen && chosen.id === c.id);
                        return h('label', { key: c.id, className: 'pl-switch', style: { margin: 0, opacity: compAvailable(c) ? 1 : .5 } }, [
                          h('input', { key: 'c', type: 'checkbox', checked: inSet, onChange: (e) => upValue(v.id, { componentIds: e.target.checked ? (v.componentIds || []).concat([c.id]) : (v.componentIds || []).filter((x) => x !== c.id) }) }),
                          h('span', { key: 's' }, [
                            c.name + ' (' + fmtCLP(componentSale(c)) + ')',
                            h('span', { key: 'st', className: 'pl-chip ' + (compAvailable(c) ? (c.stock == null ? 'gris' : 'ok') : 'err'), style: { marginLeft: 5 } },
                              c.active === false ? 'inactivo' : c.stock == null ? 'stock ∞' : num(c.stock) > 0 ? 'stock ' + num(c.stock) : 'sin stock'),
                            isChosen ? h('span', { key: 'b', className: 'pl-chip acc', style: { marginLeft: 4 } }, 'elegida') : null,
                          ]),
                        ]);
                      })),
              ]);
            })),
            // Creación rápida: varios valores de una (1 componente = 1 valor editable)
            candidates.length > 0 && (function () {
              const sel = quickSel[g.id] || {};
              const marked = Object.keys(sel).filter((k) => sel[k]);
              return h('div', { key: 'quick', style: { borderTop: '1px dashed var(--pl-linea)', marginTop: 10, paddingTop: 8 } }, [
                h('div', { key: 't', className: 'pl-label', style: { marginBottom: 5 } }, 'Creación rápida: marca componentes y crea un valor por cada uno (nombre editable después)'),
                h('div', { key: 'list', style: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px' } }, candidates.map((c) => h('label', { key: c.id, className: 'pl-switch', style: { margin: 0 } }, [
                  h('input', { key: 'i', type: 'checkbox', checked: !!sel[c.id], onChange: (e) => {
                    const next = Object.assign({}, sel); next[c.id] = e.target.checked;
                    const q = Object.assign({}, quickSel); q[g.id] = next; setQuickSel(q);
                  } }),
                  h('span', { key: 's' }, c.name),
                ]))),
                h('button', { key: 'b', className: 'pl-btn pl-btn-sm pl-btn-dark', style: { marginTop: 6 }, disabled: !marked.length, onClick: () => {
                  const nuevos = marked.map((cid) => { const c = compById(cid); return { id: newId('val'), label: c ? c.name : cid, componentIds: [cid] }; });
                  upGroup(g.id, { values: vals.concat(nuevos) });
                  const q = Object.assign({}, quickSel); q[g.id] = {}; setQuickSel(q);
                } }, '+ Crear ' + marked.length + ' valor(es)'),
              ]);
            })(),
            h('button', { key: 'addv', className: 'pl-btn pl-btn-sm', style: { marginTop: 8 }, onClick: () => upGroup(g.id, { values: vals.concat([{ id: newId('val'), label: '', componentIds: [] }]) }) }, '+ Valor'),
          ]),
        ]);
      })),
      h('button', { key: 'addg', className: 'pl-btn', onClick: () => up({ groups: d.groups.concat([{ id: newId('grp'), typeId: types()[0].id, label: '', values: [], defaultValueId: null }]) }) }, '+ Agregar paso'),
      // Previsualizador en vivo: el paso a paso tal como lo verá el cliente.
      h('div', { key: 'cfgpv', style: { marginTop: 14 } }, h(ConfigPreview, { draft: d })),
      ]),
        h('div', { key: 'f', style: sec === 'ficha' ? null : { display: 'none' } }, [
      // ── Ficha: galería del producto ──
      h('div', { key: 'galeria', className: 'pl-card', style: { marginTop: 12 } }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'FICHA'), 'Galería del producto']),
        h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 8 } },
          'Biblioteca de imágenes de ESTE producto: lo que subas aquí o en cualquier campo de imagen (fondos de hero, fotos de valores) queda disponible en los pickers "Galería…" para reutilizarlo en otras secciones, junto a las fotos del producto en Jumpseller (marcadas JS).'),
        h('div', { key: 'grid', style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          productoGallery.length
            ? productoGallery.map((u, i) => {
                const own = (d.galleryImages || []).indexOf(u) !== -1;
                const isProd = prodImgs.indexOf(u) !== -1;
                return h('div', { key: i, style: { position: 'relative' } }, [
                  h('img', { key: 'i', src: u, alt: '', title: u, style: { width: 84, height: 84, objectFit: 'cover', border: '1px solid var(--pl-gris-claro)', background: '#fff', display: 'block' } }),
                  isProd ? h('span', { key: 'p', className: 'pl-chip acc', style: { position: 'absolute', left: 2, bottom: 2 } }, 'JS') : null,
                  own ? h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', title: 'Quitar de la galería (si está en uso en el producto, reaparece al guardar)', style: { position: 'absolute', top: 2, right: 2, padding: '2px 5px' }, onClick: () => up({ galleryImages: (d.galleryImages || []).filter((x) => x !== u) }) }, '✕') : null,
                ]);
              })
            : h('span', { key: 'e', className: 'pl-muted' }, 'Aún no hay imágenes: sube algunas o enlaza el producto para ver su galería.')),
        h('div', { key: 'act', className: 'pl-compline', style: { borderBottom: 0, marginTop: 8 } }, [
          h('label', { key: 'up', className: 'pl-btn pl-btn-sm pl-btn-dark', style: { cursor: 'pointer' } }, [
            h('span', { key: 's' }, galBusy ? 'Subiendo…' : '+ Subir imágenes…'),
            h('input', { key: 'f', type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, disabled: galBusy, onChange: async (e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (!files.length) return;
              setGalBusy(true);
              const urls = [];
              for (const f of files) {
                try { urls.push(await uploadImage(f)); }
                catch (err) { shell.notify({ level: 'error', text: 'No se pudo subir "' + f.name + '": ' + ((err && err.message) || 'error') }); }
              }
              if (urls.length) {
                up({ galleryImages: (d.galleryImages || []).concat(urls.filter((u) => (d.galleryImages || []).indexOf(u) === -1)) });
                shell.notify({ level: 'success', text: urls.length + ' imagen(es) en la galería del producto.' });
              }
              setGalBusy(false);
            } }),
          ]),
        ]),
      ]),
      // ── Ficha: BUILDER de descripción del producto ──
      h('div', { key: 'builder', className: 'pl-card', style: { marginTop: 12 } }, [
        h('div', { key: 't', className: 'pl-card-title' }, [
          h('span', { key: 'n', className: 'pl-num' }, 'FICHA'),
          'Builder de descripción del producto',
          h('span', { key: 'sp', style: { flex: 1 } }),
          h('div', { key: 'vm', className: 'pl-editor-tabs' }, [
            h('button', { key: 'd2', className: 'pl-etab' + (viewMode === 'desk' ? ' on' : ''), onClick: () => setViewMode('desk') }, 'Escritorio'),
            h('button', { key: 'm2', className: 'pl-etab' + (viewMode === 'mob' ? ' on' : ''), onClick: () => setViewMode('mob') }, 'Móvil'),
          ]),
        ]),
        h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 8 } },
          'La página del modelo se compone de SECCIONES una bajo otra: heros con patrón flexbox, la tabla de especificaciones y la nota (reordenables con ↑↓; specs y nota se pueden ocultar). Pincha un contenedor o un bloque en la previsualización para editarlo abajo, y ARRASTRA bloques entre contenedores (incluso de otra sección). La previsualización es aproximada; el theme pone la tipografía final.'),
        h(React.Fragment, { key: 'list' }, sfPage.map((sec2, si2) => {
          const moveBtns = [
            si2 > 0 && h('button', { key: 'up', className: 'pl-btn pl-btn-sm', title: 'Subir', onClick: () => {
              const xs = sfPage.slice(); const t = xs[si2 - 1]; xs[si2 - 1] = xs[si2]; xs[si2] = t; upPage(xs);
            } }, '↑'),
            si2 < sfPage.length - 1 && h('button', { key: 'dn', className: 'pl-btn pl-btn-sm', title: 'Bajar', onClick: () => {
              const xs = sfPage.slice(); const t = xs[si2 + 1]; xs[si2 + 1] = xs[si2]; xs[si2] = t; upPage(xs);
            } }, '↓'),
          ];
          // ── Secciones fijas: especificaciones y nota (orden + mostrar) ──
          if (sec2.kind === 'specs' || sec2.kind === 'note' || sec2.kind === 'fotos') {
            return h('div', { key: sec2.id, className: 'pl-group' }, [
              h('div', { key: 'h', className: 'pl-group-head' }, [
                h('span', { key: 's', className: 'pl-step' }, 'SECCIÓN ' + String(si2 + 1).padStart(2, '0')),
                h('span', { key: 'k', className: 'pl-chip neg' }, sec2.kind === 'specs' ? 'ESPECIFICACIONES' : sec2.kind === 'fotos' ? 'FOTOS' : 'NOTA'),
                h('label', { key: 'sw', className: 'pl-switch', style: { margin: 0 } }, [
                  h('input', { key: 'c', type: 'checkbox', checked: sec2.show !== false, onChange: (e) => upPageX(sec2.id, { show: e.target.checked }) }),
                  h('span', { key: 's2' }, 'mostrar'),
                ]),
                h('span', { key: 'sp', style: { flex: 1 } }),
              ].concat(moveBtns)),
              sec2.show !== false && h('div', { key: 'b', className: 'pl-group-body' },
                sec2.kind === 'fotos'
                  ? h('span', { key: 'ft', className: 'pl-muted' },
                      'Grilla de fotos del producto (galería de Jumpseller) con visor grande y título centrado (renombrable en Pestañas). Las fotos se gestionan en el producto, en la tienda.')
                  : sec2.kind === 'specs'
                  ? (specRows.length
                      ? h('div', { key: 'pv', style: { maxWidth: viewMode === 'mob' ? 375 : 560 } },
                          specRows.slice(0, 6).map((sp) => h('div', { key: sp.id, className: 'pl-compline' }, [
                            h('span', { key: 'l', className: 'pl-muted', style: { width: '40%' } }, sp.label),
                            h('span', { key: 'v' }, sp.value),
                          ])).concat(specRows.length > 6 ? [h('div', { key: 'more', className: 'pl-muted' }, '… +' + (specRows.length - 6) + ' filas')] : []))
                      : h('span', { key: 'e', className: 'pl-muted' }, 'Sin filas aún: se editan en la card "Tabla de especificaciones" más abajo.'))
                  : h('div', { key: 'note' }, [
                      h('div', { key: 'h2', className: 'pl-muted', style: { marginBottom: 6 } },
                        'Nota discreta (letra chica) con separador fino: condiciones o aclaraciones. Vacía = no se muestra.'),
                      h('textarea', { key: 'tx', className: 'pl-textarea', rows: 3, value: sf.photosNote || '',
                        placeholder: 'Ej: Las fotos son referenciales; la configuración interna corresponde a lo seleccionado en el personalizador.',
                        onChange: (e) => up({ storefront: Object.assign({}, sf, { photosNote: e.target.value }) }) }),
                    ])),
            ]);
          }
          // ── Sección IMAGEN: una foto a lo ancho, alto según la imagen ──
          if (sec2.kind === 'imagen') {
            return h('div', { key: sec2.id, className: 'pl-group' }, [
              h('div', { key: 'h', className: 'pl-group-head' }, [
                h('span', { key: 's', className: 'pl-step' }, 'SECCIÓN ' + String(si2 + 1).padStart(2, '0')),
                h('span', { key: 'k', className: 'pl-chip acc' }, 'IMAGEN'),
                h('select', { key: 'w', className: 'pl-select', style: { width: 'auto' }, value: sec2.width || 'content', onChange: (e) => upPageX(sec2.id, { width: e.target.value }) }, [
                  h('option', { key: 'c', value: 'content' }, 'Ancho del contenido'),
                  h('option', { key: 'f', value: 'full' }, 'Borde a borde'),
                ]),
                h('span', { key: 'sp', style: { flex: 1 } }),
              ].concat(moveBtns).concat([
                h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => upPage(sfPage.filter((y) => y.id !== sec2.id)) }, 'Quitar'),
              ])),
              h('div', { key: 'b', className: 'pl-group-body' }, [
                h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 6 } },
                  'Sección de solo foto: en la tienda ocupa el ancho elegido y su ALTO se adapta a la imagen (sin recortes). Encadena varias para descripciones hechas de fotos apiladas, cada una con su altura natural.'),
                h(ImgField, { key: 'img', label: null, value: sec2.imageUrl || '', gallery: productoGallery, onChange: (u) => upPageX(sec2.id, { imageUrl: u }) }),
                h('div', { key: 'meta', className: 'pl-grid2' }, [
                  h(Row, { key: 'alt', label: 'Texto alternativo (accesibilidad, opcional)' },
                    h(TextInput, { value: sec2.alt || '', onChange: (e) => upPageX(sec2.id, { alt: e.target.value }) })),
                  h(Row, { key: 'lnk', label: 'Link al hacer clic (opcional)' },
                    h(TextInput, { mono: true, value: sec2.link || '', placeholder: 'https://…', onChange: (e) => upPageX(sec2.id, { link: e.target.value }) })),
                ]),
                sec2.imageUrl
                  ? h('div', { key: 'pv', style: { overflowX: 'auto', marginTop: 8 } },
                      h('img', { src: sec2.imageUrl, alt: sec2.alt || '', style: { display: 'block', width: viewMode === 'mob' ? 375 : '100%', maxWidth: viewMode === 'mob' ? 375 : 900, height: 'auto', margin: '0 auto', border: '1px solid var(--pl-gris-claro)' } }))
                  : h('div', { key: 'pv', className: 'pl-muted' }, 'Sube o elige una imagen para previsualizarla con su alto real.'),
              ]),
            ]);
          }
          // ── Sección VISOR 3D: visualizador embebido en la página ──
          if (sec2.kind === 'visor3d') {
            const emb = viewerEmbedUrl(d);
            return h('div', { key: sec2.id, className: 'pl-group' }, [
              h('div', { key: 'h', className: 'pl-group-head' }, [
                h('span', { key: 's', className: 'pl-step' }, 'SECCIÓN ' + String(si2 + 1).padStart(2, '0')),
                h('span', { key: 'k', className: 'pl-chip acc' }, 'VISOR 3D'),
                h('span', { key: 'hl', className: 'pl-label' }, 'alto (px)'),
                h(TextInput, { key: 'hh', mono: true, type: 'number', min: 240, max: 900, value: sec2.height || 480, style: { width: 80 }, onChange: (e) => upPageX(sec2.id, { height: e.target.value }) }),
                h('span', { key: 'sp', style: { flex: 1 } }),
              ].concat(moveBtns).concat([
                h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => upPage(sfPage.filter((y) => y.id !== sec2.id)) }, 'Quitar'),
              ])),
              h('div', { key: 'b', className: 'pl-group-body' },
                d.model3d && d.model3d.enabled && emb
                  ? h('iframe', { key: 'if', src: emb, title: 'Visualizador 3D', style: { width: '100%', height: Math.max(240, Math.min(900, num(sec2.height, 480))), border: '1px solid var(--pl-gris-claro)', background: '#fff' } })
                  : h('div', { key: 'e', className: 'pl-muted' },
                      'Configura y habilita el Visualizador 3D en la card "Visualizador 3D" (más abajo) para previsualizarlo aquí. En la tienda, esta sección embebe el visor en la posición elegida.')),
            ]);
          }
          // ── Sección hero ──
          const hx = sec2;
          const pat = heroPattern(hx.pattern);
          const containers = patternCells(pat);
          const selC = containers.indexOf(heroSel[hx.id]) !== -1 ? heroSel[hx.id] : containers[0];
          const slotsOf = (cid) => ((hx.slots || {})[cid]) || [];
          const setSlots = (patchSlots) => upPageX(hx.id, { slots: Object.assign({}, hx.slots || {}, patchSlots) });
          const upSlot = (cid, blocks2) => { const o = {}; o[cid] = blocks2; setSlots(o); };
          const upBlock = (bid, patch) => upSlot(selC, slotsOf(selC).map((b) => (b.id === bid ? Object.assign({}, b, patch) : b)));
          const dropBlock = (toCid) => {
            const src2 = dragRef.current;
            dragRef.current = null;
            if (!src2) return;
            if (src2.secId === hx.id) {
              if (src2.cid === toCid) return;
              const blk = slotsOf(src2.cid).find((b) => b.id === src2.bid);
              if (!blk) return;
              const o = {};
              o[src2.cid] = slotsOf(src2.cid).filter((b) => b.id !== src2.bid);
              o[toCid] = slotsOf(toCid).concat([blk]);
              setSlots(o);
              return;
            }
            // Arrastre entre secciones hero distintas
            const srcSec = sfPage.find((x) => x.id === src2.secId);
            if (!srcSec || srcSec.kind !== 'hero') return;
            const blk2 = ((srcSec.slots || {})[src2.cid] || []).find((b) => b.id === src2.bid);
            if (!blk2) return;
            upPage(sfPage.map((x) => {
              if (x.id === src2.secId) {
                const sl = Object.assign({}, x.slots); sl[src2.cid] = (sl[src2.cid] || []).filter((b) => b.id !== src2.bid);
                return Object.assign({}, x, { slots: sl });
              }
              if (x.id === hx.id) {
                const sl = Object.assign({}, x.slots); sl[toCid] = (sl[toCid] || []).concat([blk2]);
                return Object.assign({}, x, { slots: sl });
              }
              return x;
            }));
          };
          const chipOf = (t) => (HERO_BLOCK_TYPES.find((x) => x.id === t) || { chip: t }).chip;
          const blocks = slotsOf(selC);
          const addType = blockSel[hx.id] || 'photo';
          const isMob = viewMode === 'mob';
          const pvDark = hx.bgImageUrl ? true : hx.bgColor ? isDarkHex(hx.bgColor) : true;
          const pvText = hx.textColor || (pvDark ? '#FFFFFF' : '#1D1D1B');
          const pvBg = { background: hx.bgColor || '#1D1D1B' };
          if (hx.bgImageUrl) { pvBg.backgroundImage = 'url("' + hx.bgImageUrl + '")'; pvBg.backgroundSize = 'cover'; pvBg.backgroundPosition = 'center'; }
          const PH = { s: 70, m: 150, l: 240, xl: 340 }; // foto a ~la mitad del tamaño real
          const minH = hx.height === 'auto' ? 60 : { s: 130, m: 190, l: 260, xl: 330 }[hx.height || 'm'];
          // Bloque en la previsualización: clic = seleccionar, arrastrar = mover
          const pvBlock = (cid, b) => {
            const alignSelf = b.align === 'left' ? 'flex-start' : b.align === 'right' ? 'flex-end' : 'center';
            const common = {
              key: b.id,
              draggable: true,
              onDragStart: (e) => { dragRef.current = { secId: hx.id, cid, bid: b.id }; try { e.dataTransfer.setData('text/plain', b.id); } catch (err) { /* IE */ } },
              onClick: (e) => { e.stopPropagation(); const o = Object.assign({}, heroSel); o[hx.id] = cid; setHeroSel(o); },
              title: ((HERO_BLOCK_TYPES.find((x) => x.id === b.type) || {}).label || b.type) + ' — clic: editar · arrastrar: mover',
              style: { alignSelf, textAlign: b.align || 'center', maxWidth: '100%', minWidth: 0, cursor: 'grab' },
            };
            if (b.type === 'photo') {
              const src3 = productoImage(d);
              // size 'auto' = alto natural de la foto (solo limita el ancho)
              const phStyle = b.size === 'auto'
                ? { maxWidth: '100%', height: 'auto', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.4))' }
                : { maxHeight: Math.round((PH[b.size] || PH.m) * (isMob ? 0.8 : 1)), maxWidth: '100%', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.4))' };
              return h('div', common, src3
                ? h('img', { src: src3, alt: '', style: phStyle })
                : h('div', { style: { width: 90, height: 70, background: 'var(--pl-accent)', opacity: .85 } }));
            }
            if (b.type === 'title') return h('div', common, [
              h('div', { key: 't3', style: { fontWeight: 700, fontSize: isMob ? 15 : 19, letterSpacing: '-.02em' } }, d.name || 'Nombre del producto'),
              d.sku ? h('div', { key: 's3', style: { fontSize: 8, letterSpacing: '.16em', opacity: .7 } }, 'SKU · ' + d.sku) : null,
            ]);
            if (b.type === 'text') {
              // Fidelidad con el theme: tamaños reales escalados al ancho del
              // preview; xl/l (titulares) sin tope de ancho, m/s (párrafos) a
              // 440px — igual que en la tienda.
              const fs = (isMob ? { xl: 30, l: 22, m: 14, s: 12 } : { xl: 40, l: 28, m: 13, s: 10.5 })[b.size || 'l'];
              const isBody = b.size === 'm' || b.size === 's';
              return h('div', Object.assign({}, common, { style: Object.assign({}, common.style, {
                fontSize: fs, fontWeight: isBody ? 400 : 700, color: b.color || undefined,
                lineHeight: isBody ? 1.5 : 1.15, letterSpacing: isBody ? 0 : '-.02em',
                maxWidth: isBody && !isMob ? 440 : '100%',
              }) }), b.text || '(texto vacío)');
            }
            if (b.type === 'items') return h('div', Object.assign({}, common, { style: Object.assign({}, common.style, { display: 'flex', flexDirection: 'column', gap: 5, alignItems: alignSelf }) }),
              (b.items || []).length ? b.items.map((it) => h('div', { key: it.id, style: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(29,29,27,.78)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', padding: '4px 8px 4px 4px', fontSize: 10, width: 'fit-content' } }, [
                h('span', { key: 'p', style: { width: 14, height: 14, background: 'var(--pl-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 } }, '+'),
                h('span', { key: 't4' }, it.title || '(item)'),
              ])) : [h('span', { key: 'e', style: { fontSize: 10, opacity: .6 } }, '(items vacíos)')]);
            if (b.type === 'cta') return h('div', common, h('span', { style: {
              display: 'inline-block', padding: '7px 14px', fontSize: 11, fontWeight: 600,
              background: b.style === 'dark' ? '#1D1D1B' : b.style === 'ghost' ? 'rgba(255,255,255,.12)' : 'var(--pl-accent)',
              color: '#fff', border: b.style === 'ghost' ? '1px solid rgba(255,255,255,.5)' : '0',
            } }, b.label || 'Configurar'));
            if (b.type === 'icons') return h('div', Object.assign({}, common, { style: Object.assign({}, common.style, { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }) }),
              (b.items || []).map((it) => h('div', { key: it.id, style: { borderLeft: '2px solid var(--pl-accent)', paddingLeft: 6, fontSize: 10, textAlign: 'left' } }, [
                it.icon ? h('div', { key: 'i4', style: { fontSize: 14 } }, it.icon) : null,
                h('b', { key: 't5', style: { display: 'block', fontSize: 11 } }, it.title || '—'),
                it.text ? h('span', { key: 'x5', style: { opacity: .75 } }, it.text) : null,
              ])));
            if (b.type === 'specs') return h('div', Object.assign({}, common, { style: Object.assign({}, common.style, { fontSize: 10, width: '100%', maxWidth: 260 }) }),
              specRows.slice(0, b.count || 4).map((sp) => h('div', { key: sp.id, style: { display: 'flex', gap: 6, borderBottom: '1px dashed rgba(157,157,156,.5)', padding: '2px 0', textAlign: 'left' } }, [
                h('span', { key: 'l5', style: { opacity: .65, width: '42%' } }, sp.label),
                h('span', { key: 'v5' }, sp.value),
              ])));
            if (b.type === 'gallery') {
              const gu = prodImgs[Math.max(0, (num(b.index, 1) || 1) - 1)];
              const gStyle = b.size === 'auto'
                ? { maxWidth: '100%', height: 'auto' }
                : { maxHeight: Math.round(((PH[b.size] || PH.m) * 0.8)), maxWidth: '100%', objectFit: 'contain' };
              return h('div', common, gu
                ? h('img', { src: gu, alt: '', style: gStyle })
                : h('div', { style: { width: 120, height: 74, background: 'rgba(255,255,255,.12)', border: '1px dashed rgba(255,255,255,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, letterSpacing: '.1em' } }, 'GALERÍA Nº' + (b.index || 1)));
            }
            if (b.type === 'html') return h('div', Object.assign({}, common, {
              style: Object.assign({}, common.style, { fontSize: 11, maxWidth: 320 }),
              dangerouslySetInnerHTML: { __html: b.html || '<span style="opacity:.6">(HTML vacío)</span>' },
            }));
            return null;
          };
          return h('div', { key: hx.id, className: 'pl-group' }, [
            h('div', { key: 'h', className: 'pl-group-head' }, [
              h('span', { key: 's', className: 'pl-step' }, 'SECCIÓN ' + String(si2 + 1).padStart(2, '0')),
              h('span', { key: 'k', className: 'pl-chip acc' }, 'HERO'),
              h('select', { key: 'pat', className: 'pl-select', style: { width: 'auto' }, value: pat.id, onChange: (e) => upPageX(hx.id, { pattern: e.target.value }) },
                HERO_PATTERNS.map((p) => h('option', { key: p.id, value: p.id }, p.label))),
              h('select', { key: 'hh', className: 'pl-select', style: { width: 'auto' }, value: hx.height || 'm', onChange: (e) => upPageX(hx.id, { height: e.target.value }) }, [
                h('option', { key: 's4', value: 's' }, 'Compacto'),
                h('option', { key: 'm4', value: 'm' }, 'Normal'),
                h('option', { key: 'l4', value: 'l' }, 'Alto'),
                h('option', { key: 'xl4', value: 'xl' }, 'Pantalla completa'),
                h('option', { key: 'a4', value: 'auto' }, 'Auto (según contenido)'),
              ]),
              h('span', { key: 'sp', style: { flex: 1 } }),
            ].concat(moveBtns).concat([
              h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => upPage(sfPage.filter((y) => y.id !== hx.id)) }, 'Quitar'),
            ])),
            h('div', { key: 'b', className: 'pl-group-body' }, [
              h('div', { key: 'bg', className: 'pl-grid2' }, [
                h(Row, { key: 'bc', label: 'Color de fondo (vacío = negro del sistema)' },
                  h(ColorField, { label: null, value: hx.bgColor || '', onChange: (v) => upPageX(hx.id, { bgColor: v }), placeholder: '#1D1D1B (vacío = negro)' })),
                h(ImgField, { key: 'bi', label: 'Imagen de fondo (tapa el color)', value: hx.bgImageUrl || '', gallery: productoGallery, onChange: (v) => upPageX(hx.id, { bgImageUrl: v }) }),
                h(Row, { key: 'tc', label: 'Color del texto (vacío = automático según fondo)' },
                  h(ColorField, { label: null, value: hx.textColor || '', onChange: (v) => upPageX(hx.id, { textColor: v }) })),
                h('label', { key: 'ov', className: 'pl-switch', style: { alignSelf: 'end' } }, [
                  h('input', { key: 'c', type: 'checkbox', checked: hx.overlay !== false, onChange: (e) => upPageX(hx.id, { overlay: e.target.checked }) }),
                  h('span', { key: 's5' }, 'Oscurecer imagen de fondo (legibilidad)'),
                ]),
              ]),
              // ── Previsualización en vivo (clic = seleccionar, drop = mover) ──
              h('div', { key: 'prev', style: { overflowX: 'auto', marginBottom: 8 } },
                h('div', { style: Object.assign({ width: isMob ? 375 : '100%', maxWidth: isMob ? 375 : 900, margin: '0 auto', border: '1px solid var(--pl-gris-claro)', color: pvText, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'space-between', minHeight: minH }, pvBg) },
                  pat.rows.map((row, ri) => h('div', { key: ri, style: { display: 'flex', flexDirection: isMob ? 'column' : 'row', gap: 8, flex: row.length > 1 ? 1 : 'none' } },
                    row.map((cell) => {
                      const cid = cellId(cell);
                      const on2 = selC === cid;
                      const bl = slotsOf(cid);
                      return h('div', {
                        key: cid,
                        onClick: () => { const o = Object.assign({}, heroSel); o[hx.id] = cid; setHeroSel(o); },
                        onDragOver: (e) => { e.preventDefault(); },
                        onDrop: (e) => { e.preventDefault(); dropBlock(cid); },
                        title: (CONTAINER_LABELS[cid] || cid) + ' — clic: editar · suelta aquí un bloque para moverlo',
                        style: {
                          flex: isMob ? 'none' : cellFlex(cell), minHeight: 44, minWidth: 0,
                          display: 'flex', flexDirection: 'column', gap: 8,
                          alignItems: 'center', justifyContent: 'center', padding: 6, cursor: 'pointer',
                          outline: on2 ? '2px dashed var(--pl-accent)' : '1px dashed ' + (pvDark ? 'rgba(255,255,255,.28)' : 'rgba(29,29,27,.25)'),
                          outlineOffset: -2,
                          background: on2 ? 'rgba(25,172,177,.12)' : 'transparent',
                        },
                      }, bl.length
                        ? bl.map((b) => pvBlock(cid, b))
                        : h('span', { style: { fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .5 } }, CONTAINER_LABELS[cid] || cid));
                    })))))
              ,
              // ── Editor del contenedor seleccionado ──
              h('div', { key: 'ed', style: { borderTop: '1px dashed var(--pl-linea)', paddingTop: 8 } }, [
                h('div', { key: 't6', className: 'pl-label', style: { marginBottom: 6 } }, 'Contenido de: ' + (CONTAINER_LABELS[selC] || selC)),
                blocks.length === 0 && h('div', { key: 'e6', className: 'pl-muted', style: { marginBottom: 6 } }, 'Contenedor vacío. Agrega bloques abajo.'),
                h(React.Fragment, { key: 'blocks' }, blocks.map((b, bi) => h('div', { key: b.id, style: { border: '1px solid var(--pl-linea)', padding: '6px 8px', marginBottom: 6 } }, [
                  h('div', { key: 'bh', className: 'pl-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'c6', className: 'pl-chip neg' }, chipOf(b.type)),
                    h('span', { key: 'l6', className: 'pl-muted' }, (HERO_BLOCK_TYPES.find((x) => x.id === b.type) || {}).label || b.type),
                    h('select', { key: 'al', className: 'pl-select', style: { width: 110 }, title: 'Alineación horizontal en el contenedor', value: b.align || 'center', onChange: (e) => upBlock(b.id, { align: e.target.value }) }, [
                      h('option', { key: 'l7', value: 'left' }, 'Izquierda'),
                      h('option', { key: 'c7', value: 'center' }, 'Centro'),
                      h('option', { key: 'r7', value: 'right' }, 'Derecha'),
                    ]),
                    h('span', { key: 'sp6', className: 'grow' }),
                    bi > 0 && h('button', { key: 'up6', className: 'pl-btn pl-btn-sm', title: 'Subir', onClick: () => {
                      const xs = blocks.slice(); const t = xs[bi - 1]; xs[bi - 1] = xs[bi]; xs[bi] = t; upSlot(selC, xs);
                    } }, '↑'),
                    h('button', { key: 'x6', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => upSlot(selC, blocks.filter((y) => y.id !== b.id)) }, '✕'),
                  ]),
                  b.type === 'photo' && h('div', { key: 'f', className: 'pl-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'l1', className: 'pl-label' }, 'tamaño'),
                    h('select', { key: 's7', className: 'pl-select', style: { width: 130 }, value: b.size || 'm', onChange: (e) => upBlock(b.id, { size: e.target.value }) },
                      [['s', 'Pequeña'], ['m', 'Mediana'], ['l', 'Grande'], ['xl', 'Extra grande'], ['auto', 'Natural (alto según la foto)']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    h('span', { key: 'l2', className: 'pl-label' }, 'animación'),
                    h('select', { key: 'a7', className: 'pl-select', style: { width: 130 }, value: b.anim || 'none', onChange: (e) => upBlock(b.id, { anim: e.target.value }) },
                      [['none', 'Sin animación'], ['float', 'Flotar'], ['zoom', 'Respirar'], ['sway', 'Balanceo']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                  ]),
                  b.type === 'title' && h('div', { key: 'f', className: 'pl-muted' }, 'Nombre del producto + SKU (automático desde la tienda).'),
                  b.type === 'text' && h('div', { key: 'f' }, [
                    h('div', { key: 'r1', className: 'pl-compline', style: { borderBottom: 0 } }, [
                      h(TextInput, { key: 'tx7', value: b.text || '', placeholder: 'Texto a mostrar', style: { flex: 1, minWidth: 200 }, onChange: (e) => upBlock(b.id, { text: e.target.value }) }),
                      h('select', { key: 's8', className: 'pl-select', style: { width: 120 }, value: b.size || 'l', onChange: (e) => upBlock(b.id, { size: e.target.value }) },
                        [['xl', 'Muy grande'], ['l', 'Grande'], ['m', 'Normal'], ['s', 'Pequeño']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    ]),
                    h(ColorField, { key: 'c8', label: null, value: b.color || '', onChange: (v) => upBlock(b.id, { color: v }), placeholder: 'color (vacío = del hero)' }),
                  ]),
                  b.type === 'items' && h('div', { key: 'f' }, [
                    h(React.Fragment, { key: 'its' }, (b.items || []).map((it) => h('div', { key: it.id, className: 'pl-compline' }, [
                      h('span', { key: 'c9', className: 'pl-chip acc' }, '+'),
                      h(TextInput, { key: 't9', value: it.title, placeholder: 'Título', style: { width: 180 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { title: e.target.value }) : x)) }) }),
                      h(TextInput, { key: 'x9', value: it.text, placeholder: 'Texto al abrir', style: { flex: 1, minWidth: 140 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { text: e.target.value }) : x)) }) }),
                      h('button', { key: 'd9', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => upBlock(b.id, { items: b.items.filter((x) => x.id !== it.id) }) }, '✕'),
                    ]))),
                    h('div', { key: 'act', className: 'pl-compline', style: { borderBottom: 0 } }, [
                      h('button', { key: 'add', className: 'pl-btn pl-btn-sm', onClick: () => upBlock(b.id, { items: (b.items || []).concat([{ id: newId('hi'), title: '', text: '' }]) }) }, '+ Item'),
                      h('label', { key: 'fl', className: 'pl-switch', style: { margin: 0 } }, [
                        h('input', { key: 'c10', type: 'checkbox', checked: b.float !== false, onChange: (e) => upBlock(b.id, { float: e.target.checked }) }),
                        h('span', { key: 's10' }, 'flotar'),
                      ]),
                    ]),
                  ]),
                  b.type === 'cta' && h('div', { key: 'f', className: 'pl-compline', style: { borderBottom: 0 } }, [
                    h(TextInput, { key: 'l11', value: b.label || '', placeholder: 'Texto del botón', style: { width: 180 }, onChange: (e) => upBlock(b.id, { label: e.target.value }) }),
                    h('select', { key: 's11', className: 'pl-select', style: { width: 110 }, value: b.style || 'primary', onChange: (e) => upBlock(b.id, { style: e.target.value }) },
                      [['primary', 'Acento'], ['dark', 'Oscuro'], ['ghost', 'Fantasma']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    h('select', { key: 'a11', className: 'pl-select', style: { width: 150 }, value: b.action || 'configurar', onChange: (e) => upBlock(b.id, { action: e.target.value }) },
                      [['configurar', 'Ir a Configurar'], ['url', 'Abrir URL']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    b.action === 'url' && h(TextInput, { key: 'u11', mono: true, value: b.url || '', placeholder: 'https://…', style: { flex: 1, minWidth: 160 }, onChange: (e) => upBlock(b.id, { url: e.target.value }) }),
                  ]),
                  b.type === 'icons' && h('div', { key: 'f' }, [
                    h(React.Fragment, { key: 'its' }, (b.items || []).map((it) => h('div', { key: it.id, className: 'pl-compline' }, [
                      h(TextInput, { key: 'i12', value: it.icon, placeholder: '❄️', title: 'Icono (emoji o carácter)', style: { width: 60, textAlign: 'center' }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { icon: e.target.value }) : x)) }) }),
                      h(TextInput, { key: 't12', value: it.title, placeholder: 'Destaque (ej: 8 núcleos)', style: { width: 180 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { title: e.target.value }) : x)) }) }),
                      h(TextInput, { key: 'x12', value: it.text, placeholder: 'Detalle (opcional)', style: { flex: 1, minWidth: 120 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { text: e.target.value }) : x)) }) }),
                      h('button', { key: 'd12', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => upBlock(b.id, { items: b.items.filter((x) => x.id !== it.id) }) }, '✕'),
                    ]))),
                    h('button', { key: 'add', className: 'pl-btn pl-btn-sm', onClick: () => upBlock(b.id, { items: (b.items || []).concat([{ id: newId('ic'), icon: '', title: '', text: '' }]) }) }, '+ Icono'),
                  ]),
                  b.type === 'specs' && h('div', { key: 'f', className: 'pl-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'l13', className: 'pl-label' }, 'filas a mostrar'),
                    h(TextInput, { key: 'n13', mono: true, type: 'number', min: 1, max: 12, value: b.count || 4, style: { width: 70 }, onChange: (e) => upBlock(b.id, { count: e.target.value }) }),
                    h('span', { key: 'm13', className: 'pl-muted' }, 'primeras filas de la tabla de Especificaciones.'),
                  ]),
                  b.type === 'gallery' && h('div', { key: 'f', className: 'pl-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'l14', className: 'pl-label' }, 'foto Nº'),
                    h(TextInput, { key: 'n14', mono: true, type: 'number', min: 1, value: b.index || 1, style: { width: 70 }, onChange: (e) => upBlock(b.id, { index: e.target.value }) }),
                    h('span', { key: 's14', className: 'pl-label' }, 'tamaño'),
                    h('select', { key: 'sz14', className: 'pl-select', style: { width: 170 }, value: b.size || 'm', onChange: (e) => upBlock(b.id, { size: e.target.value }) },
                      [['s', 'Pequeña'], ['m', 'Mediana'], ['l', 'Grande'], ['xl', 'Extra grande'], ['auto', 'Natural (alto según la foto)']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    h('span', { key: 'm14', className: 'pl-muted' }, 'número de la foto en la galería del producto (1 = primera).'),
                  ]),
                  b.type === 'html' && h('textarea', { key: 'f', className: 'pl-textarea pl-mono', rows: 3, value: b.html || '', placeholder: '<div>HTML libre…</div>', onChange: (e) => upBlock(b.id, { html: e.target.value }) }),
                ]))),
                h('div', { key: 'add', className: 'pl-compline', style: { borderBottom: 0 } }, [
                  h('select', { key: 's15', className: 'pl-select', style: { width: 240 }, value: addType, onChange: (e) => { const o = Object.assign({}, blockSel); o[hx.id] = e.target.value; setBlockSel(o); } },
                    HERO_BLOCK_TYPES.map((t) => h('option', { key: t.id, value: t.id }, t.label))),
                  h('button', { key: 'b15', className: 'pl-btn pl-btn-sm pl-btn-dark', onClick: () => upSlot(selC, blocks.concat([normalizeHeroBlock({ type: addType })])) }, '+ Agregar bloque'),
                ]),
              ]),
            ]),
          ]);
        })),
        h('div', { key: 'addrow', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, [
          h('button', { key: 'addh', className: 'pl-btn', onClick: () => upPage(sfPage.concat([{ id: newId('hb'), kind: 'hero', pattern: 'clasico', height: 'm', bgColor: '', bgImageUrl: '', textColor: '', overlay: true, slots: {} }])) }, '+ Sección hero'),
          h('button', { key: 'addi', className: 'pl-btn', title: 'Sección de solo foto: el alto se adapta a la imagen (sin recortes)', onClick: () => upPage(sfPage.concat([{ id: newId('ps'), kind: 'imagen', imageUrl: '', alt: '', width: 'content', link: '' }])) }, '+ Sección imagen'),
          sfPage.some((x) => x && x.kind === 'visor3d') ? null : h('button', { key: 'add3d', className: 'pl-btn', title: 'Embebe el visualizador 3D del producto en la página (configúralo en la card Visualizador 3D)', onClick: () => upPage(sfPage.concat([{ id: newId('ps'), kind: 'visor3d', height: 480 }])) }, '+ Sección visualizador 3D'),
        ]),
      ]),
      // ── Ficha de tienda: tabla de especificaciones ──
      h('div', { key: 'specs', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'FICHA'), 'Tabla de especificaciones']),
        h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 8 } },
          'Pestaña Especificaciones de la tienda (pantalla completa). Defínela a tu gusto; "Generar desde componentes" siembra filas con la base y la configuración por defecto (sin marcas), y luego editas lo que quieras.'),
        h(React.Fragment, { key: 'rows' }, specRows.map((sp) => h('div', { key: sp.id, className: 'pl-compline' }, [
          h(TextInput, { key: 'g', value: sp.group, placeholder: 'Grupo', style: { width: 130 }, onChange: (e) => upSpecRow(sp.id, { group: e.target.value }) }),
          h(TextInput, { key: 'l', value: sp.label, placeholder: 'Etiqueta (ej: Material)', style: { width: 180 }, onChange: (e) => upSpecRow(sp.id, { label: e.target.value }) }),
          h(TextInput, { key: 'v', value: sp.value, placeholder: 'Valor (ej: Roble macizo 18 mm)', style: { flex: 1, minWidth: 160 }, onChange: (e) => upSpecRow(sp.id, { value: e.target.value }) }),
          h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: () => upSpecs(specRows.filter((x) => x.id !== sp.id)) }, '✕'),
        ]))),
        h('div', { key: 'act', className: 'pl-compline', style: { borderBottom: 0, marginTop: 4 } }, [
          h('button', { key: 'add', className: 'pl-btn pl-btn-sm', onClick: () => upSpecs(specRows.concat([{ id: newId('sp'), group: '', label: '', value: '' }])) }, '+ Fila'),
          h('button', { key: 'gen', className: 'pl-btn pl-btn-sm pl-btn-dark', onClick: genSpecs }, 'Generar desde componentes'),
        ]),
      ]),
      // ── Ficha: pestañas de la barra (títulos, mostrar y orden) ──
      h('div', { key: 'tabs', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'FICHA'), 'Pestañas de la barra (título, mostrar y orden)']),
        (function () {
          const order = (Array.isArray(sfTabs.order) ? sfTabs.order : []).filter((x) => ['explorar', 'specs', 'fotos'].indexOf(x) !== -1);
          ['explorar', 'specs', 'fotos'].forEach((x) => { if (order.indexOf(x) === -1) order.push(x); });
          const meta = {
            explorar: { label: 'Principal', ph: (d.name || 'Explorar') + ' (título)', showKey: null },
            specs: { label: 'Especificaciones', ph: 'Especificaciones (título)', showKey: 'showSpecs' },
            fotos: { label: 'Fotos', ph: 'Fotos (título)', showKey: 'showFotos' },
          };
          return h(React.Fragment, { key: 'ord' }, order.map((tid, ti) => h('div', { key: tid, className: 'pl-compline' }, [
            h('button', { key: 'up', className: 'pl-btn pl-btn-sm', disabled: ti === 0, title: 'Subir en el orden', onClick: () => {
              const xs = order.slice(); const t2 = xs[ti - 1]; xs[ti - 1] = xs[ti]; xs[ti] = t2; upTabs({ order: xs });
            } }, '↑'),
            h('span', { key: 'k', className: 'pl-chip neg' }, meta[tid].label),
            h(TextInput, { key: 'l', value: sfTabs[tid] || '', placeholder: meta[tid].ph, style: { width: 230 }, onChange: (e) => { const o = {}; o[tid] = e.target.value; upTabs(o); } }),
            meta[tid].showKey && h('label', { key: 'sw', className: 'pl-switch', style: { margin: 0 } }, [
              h('input', { key: 'c', type: 'checkbox', checked: sfTabs[meta[tid].showKey] !== false, onChange: (e) => { const o = {}; o[meta[tid].showKey] = e.target.checked; upTabs(o); } }),
              h('span', { key: 's' }, 'mostrar pestaña'),
            ]),
          ])));
        })(),
        h(Row, { key: 'buy', label: 'Botón Comprar (a la derecha; solo visible en la pestaña principal)' },
          h(TextInput, { value: sfTabs.comprar || '', onChange: (e) => upTabs({ comprar: e.target.value }), placeholder: 'Comprar' })),
        h('div', { key: 'help', className: 'pl-muted', style: { marginTop: 6 } },
          'Ocultar una pestaña esconde su botón en la barra (la sección puede seguir en la página vía el builder). En móvil la barra solo muestra la pestaña principal.'),
      ]),
      // ── Ficha: estilo del configurador y la página ──
      h('div', { key: 'style', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'FICHA'), 'Estilo del configurador y la página']),
        h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 8 } },
          'Personaliza cómo se ve el configurador de este producto en la tienda (vacío = colores y tipografías del theme del sitio). El previsualizador de la pestaña Pasos refleja estos ajustes en vivo.'),
        (function () {
          const st = sf.style || {};
          const upStyle = (patch) => up({ storefront: Object.assign({}, sf, { style: Object.assign({}, st, patch) }) });
          return h('div', { key: 'g', className: 'pl-grid3' }, [
            h(Row, { key: 'ac', label: 'Color de acento (selección, precios, botón)' },
              h(ColorField, { label: null, value: st.accentColor || '', onChange: (v) => upStyle({ accentColor: v }), placeholder: 'vacío = acento del theme' })),
            h(Row, { key: 'bg', label: 'Fondo del configurador' },
              h(ColorField, { label: null, value: st.bgColor || '', onChange: (v) => upStyle({ bgColor: v }), placeholder: 'vacío = fondo del theme' })),
            h(Row, { key: 'rd', label: 'Radio de esquinas (px; 0 = recto)' },
              h(TextInput, { mono: true, type: 'number', min: 0, max: 24, value: st.radius == null ? 0 : st.radius, onChange: (e) => upStyle({ radius: e.target.value }) })),
            h(Row, { key: 'cs', label: 'Presentación de los valores' },
              h('select', { className: 'pl-select', value: st.cardStyle || 'cards', onChange: (e) => upStyle({ cardStyle: e.target.value }) }, [
                h('option', { key: 'c', value: 'cards' }, 'Cards con foto (grilla)'),
                h('option', { key: 'l', value: 'list' }, 'Lista vertical'),
                h('option', { key: 'k', value: 'compact' }, 'Cards compactas'),
              ])),
            h(Row, { key: 'sd', label: 'Precio en las cards' },
              h('select', { className: 'pl-select', value: st.showDeltas || 'delta', onChange: (e) => upStyle({ showDeltas: e.target.value }) }, [
                h('option', { key: 'd', value: 'delta' }, 'Diferencia (+/− $) vs selección'),
                h('option', { key: 't', value: 'total' }, 'Precio total resultante'),
                h('option', { key: 'n', value: 'none' }, 'Sin precio en las cards'),
              ])),
            h('label', { key: 'sc', className: 'pl-switch', style: { alignSelf: 'end' } }, [
              h('input', { key: 'c', type: 'checkbox', checked: st.stepsCollapsed === true, onChange: (e) => upStyle({ stepsCollapsed: e.target.checked }) }),
              h('span', { key: 's' }, 'Pasos colapsados al entrar (solo el primero abierto)'),
            ]),
          ]);
        })(),
      ]),
      // ── Ficha: visualizador 3D (herencia del personalizador) ──
      h('div', { key: 'v3d', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'FICHA'), 'Visualizador 3D']),
        h('div', { key: 'help', className: 'pl-muted', style: { marginBottom: 8 } },
          'Visor 3D web del producto (partes y texturas personalizables en tiempo real). La configuración se publica en el JSON público: el visor la lee vía ?def=…&producto=…, el theme la embebe con la sección "Visualizador 3D" del builder, y el backend puede servir el modelo AR con colores aplicados (GET /api/public/app/{instancia}/ar/{sku}.glb?m=Material:hex). Ver docs/VISUALIZADOR.md de la app.'),
        h('label', { key: 'en', className: 'pl-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: !!(d.model3d && d.model3d.enabled), onChange: (e) => upV3({ enabled: e.target.checked }) }),
          h('span', { key: 's' }, 'Habilitar visualizador 3D para este producto'),
        ]),
        h('div', { key: 'g', className: 'pl-grid2' }, [
          h(Row, { key: 'vu', label: 'URL del visualizador (visor desplegado)' },
            h(TextInput, { mono: true, value: (d.model3d || {}).viewerUrl || '', placeholder: 'https://visualizador.mitienda.cl/', onChange: (e) => upV3({ viewerUrl: e.target.value }) })),
          h(Row, { key: 'mu', label: 'Modelo 3D (GLB; meshopt + texturas WebP recomendado)' },
            h(TextInput, { mono: true, value: (d.model3d || {}).modelUrl || '', placeholder: 'https://…/producto.glb', onChange: (e) => upV3({ modelUrl: e.target.value }) })),
          h(Row, { key: 'au', label: 'GLB para AR (ruta /api/public/files/… de KIMOS; opcional)' },
            h(TextInput, { mono: true, value: (d.model3d || {}).arUrl || '', placeholder: '/api/public/files/imagenes/productlab/producto-ar.glb', onChange: (e) => upV3({ arUrl: e.target.value }) })),
          h(Row, { key: 'bs', label: 'Paso que elige la textura/acabado en el visor (opcional)' },
            h('select', { className: 'pl-select', value: (d.model3d || {}).bindStepId || '', onChange: (e) => upV3({ bindStepId: e.target.value }) },
              [h('option', { key: '', value: '' }, '— ninguno —')].concat(d.groups.map((g, gi) => h('option', { key: g.id, value: g.id }, 'PASO ' + String(gi + 1).padStart(2, '0') + ' · ' + (g.label || typeLabel(g.typeId))))))),
        ]),
        h(Row, { key: 'cfg', label: 'Configuración del visor (JSON: parts[] y finishes[] — partes del modelo, texturas y tintes)' },
          h('div', { style: { width: '100%' } }, [
            h('textarea', { key: 'ta', className: 'pl-textarea pl-mono', rows: 6, value: v3Text,
              placeholder: '{\n  "parts": [{ "id": "superficie", "label": "Superficie", "materials": ["Material1"] }],\n  "finishes": [{ "id": "roble", "label": "Roble", "color": "#ffffff", "texture": "https://…/roble.webp", "roughness": 0.7, "textureScale": 0.09, "grain": 0.3 }]\n}',
              onChange: (e) => setV3Text(e.target.value),
              onBlur: () => {
                const t = v3Text.trim();
                if (!t) { setV3Err(''); upV3({ config: null }); return; }
                try {
                  const o = JSON.parse(t);
                  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('debe ser un objeto');
                  setV3Err('');
                  upV3({ config: o });
                } catch (err) { setV3Err('JSON inválido: ' + ((err && err.message) || '') + ' — no se guardará hasta corregirlo.'); }
              } }),
            v3Err ? h('div', { key: 'err', className: 'pl-errbox', style: { marginTop: 4 } }, v3Err) : null,
          ])),
        (function () {
          if (!(d.model3d && d.model3d.enabled)) return null;
          const emb = viewerEmbedUrl(d);
          return emb
            ? h('div', { key: 'pv' }, [
                h('div', { key: 'l', className: 'pl-compline', style: { borderBottom: 0 } }, [
                  h('span', { key: 't', className: 'pl-label' }, 'Previsualización en vivo del visor'),
                  h('span', { key: 'sp', className: 'grow' }),
                  h('a', { key: 'a', className: 'pl-btn pl-btn-sm', style: { textDecoration: 'none' }, href: emb, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir ↗'),
                ]),
                h('iframe', { key: 'if', src: emb, title: 'Visualizador 3D', style: { width: '100%', height: 380, border: '1px solid var(--pl-gris-claro)', background: '#fff' } }),
              ])
            : h('div', { key: 'pv', className: 'pl-muted' }, 'Ingresa la URL del visualizador para previsualizarlo aquí (el visor recibe ?def=<JSON público>&producto=<sku>).');
        })(),
      ]),
      ]),
      warns.length > 0 && h('div', { key: 'w', className: 'pl-warnbox' }, warns.map((w, i) => h('div', { key: i }, '• ' + w))),
      ]),
      // ── Barra inferior fija: precio vivo + acciones ──
      h('div', { key: 'bottom', className: 'pl-editor-bottom' }, [
        h('div', { key: 'info' }, [
          h('span', { key: 'l', className: 'pl-label' }, 'Precio configuración base'),
          h('div', { key: 'p', className: 'pl-price pl-price-big' }, fmtCLP(price)),
          h('div', { key: 'm', className: 'pl-muted', style: { fontSize: 11 } },
            combos + ' variante(s) · entrega ' + productoDelivery(d) + 'd · margen ' + (rules().marginBasis === 'sale' ? 'sobre venta' : 'sobre costo') +
            (initial && num(initial.price) !== price ? ' · guardado: ' + fmtCLP(initial.price) + ' →' : '') +
            (warns.length ? ' · ⚠ ' + warns.length + ' aviso(s) arriba' : '')),
        ]),
        h('div', { key: 'a', className: 'pl-actions', style: { margin: 0 } }, [
        h('button', { key: 'save', className: 'pl-btn', disabled: busy || !s(d.name).trim(), onClick: async () => {
          setBusy(true);
          const r = await saveProducto(d);
          setBusy(false);
          if (r.success) { shell.notify({ level: 'success', text: r.message }); onDone(); }
        } }, initial ? 'Guardar' : 'Crear producto'),
        ref && h('button', { key: 'apply', className: 'pl-btn pl-btn-primary', disabled: busy || !s(d.name).trim() || combos === 0 || combos > MAX_COMBOS, onClick: async () => {
          setBusy(true);
          const saved = await saveProducto(d);
          if (!saved.success) { setBusy(false); return; }
          const r = await applyToStore(saved.item);
          setBusy(false);
          shell.notify(r.success ? { level: 'success', text: r.message } : { level: 'error', text: r.error });
          if (r.success) onDone();
        } }, busy ? 'Aplicando…' : 'Guardar y aplicar a la tienda'),
        ]),
      ]),
      picking && h(ProductPicker, { key: 'picker', onClose: () => setPicking(false), onPick: (p) => {
        setPicking(false);
        const js = (p.sourceLinks || []).find((x) => x && x.integration === 'jumpseller');
        up({
          productRef: {
            instanceId: p.__instanceId, itemId: p.id,
            sourceId: js ? js.sourceId : null,
            sku: p.sku || '', name: p.name || '', imageUrl: p.imageUrl || '',
          },
          name: d.name || p.name || '',
          sku: d.sku || p.sku || '',
          imageUrl: d.imageUrl || p.imageUrl || '',
          sourceLinks: [], // limpiar enlaces legacy v1
        });
      } }),
    ]);
  }

  // ── Pestaña: Productos ──────────────────────────────────────────────────────
  function ProductosTab({ state }) {
    const [editing, setEditing] = useState(null);
    // Editor a pantalla completa: usa todo el espacio de la app, sin modal.
    if (editing != null) {
      return h(ProductoForm, {
        key: editing.id || 'new',
        initial: editing.id ? editing : null,
        onDone: () => setEditing(null),
      });
    }
    return h('div', null, [
      h('div', { key: 'f', className: 'pl-filters' }, [
        h('button', { key: 'new', className: 'pl-btn pl-btn-primary', onClick: () => setEditing({}) }, '+ Producto'),
        h('span', { key: 'n', className: 'pl-muted', style: { marginLeft: 'auto' } }, state.productos.length + ' producto(s)'),
      ]),
      state.productos.length === 0
        ? h('div', { key: 'e', className: 'pl-card pl-muted' }, 'Aún no hay productos. Un producto enlaza un producto de la tienda con sus pasos de personalización (componentes elegibles y default por paso) y calcula su precio desde los costos.')
        : h('div', { key: 'tbl', className: 'pl-card', style: { padding: 0 } },
            h('table', { className: 'pl-table' }, [
              h('thead', { key: 'h' }, h('tr', null, ['', 'Producto', 'SKU', 'Pasos', 'Precio', 'Recalculado', 'Entrega', 'Tienda', ''].map((c, i) => h('th', { key: i }, c)))),
              h('tbody', { key: 'b' }, state.productos.map((eq) => {
                const computed = productoComputedPrice(eq);
                const warns = productoWarnings(eq);
                return h('tr', { key: eq.id }, [
                  h('td', { key: 'i' }, h(Thumb, { url: productoImage(eq) })),
                  h('td', { key: 'n' }, [
                    h('div', { key: '1', style: { fontWeight: 600, cursor: 'pointer' }, title: 'Editar producto', onClick: () => setEditing(eq) }, eq.name),
                    warns.length > 0 && h('div', { key: '2', className: 'pl-muted', style: { color: 'var(--pl-warn)' } }, '⚠ ' + warns.length + ' aviso(s)'),
                  ]),
                  h('td', { key: 's', className: 'pl-mono', style: { fontSize: 11 } }, eq.sku || '—'),
                  h('td', { key: 'g', className: 'pl-mono', style: { fontSize: 11 } }, (eq.groups || []).length),
                  h('td', { key: 'p', className: 'pl-price' }, fmtCLP(eq.price)),
                  h('td', { key: 'c', className: 'pl-price', style: computed !== num(eq.price) ? { color: 'var(--pl-err)', fontWeight: 600 } : null },
                    computed !== num(eq.price) ? fmtCLP(computed) + ' *' : '='),
                  h('td', { key: 'd', className: 'pl-mono', style: { fontSize: 11 } }, productoDelivery(eq) + 'd'),
                  h('td', { key: 'sync' }, h(SyncBadge, { eq })),
                  h('td', { key: 'a', style: { whiteSpace: 'nowrap' } }, [
                    productoStoreUrl(eq) && h('a', { key: 'st', className: 'pl-btn pl-btn-sm', style: { textDecoration: 'none', display: 'inline-block' }, href: productoStoreUrl(eq), target: '_blank', rel: 'noopener noreferrer', title: 'Ver el producto en la tienda' }, 'Tienda ↗'),
                    productoStoreUrl(eq) && ' ',
                    productRefOf(eq) && h('button', { key: 'ap', className: 'pl-btn pl-btn-sm pl-btn-dark', title: 'Escribir precio, opciones y variantes en el producto de la tienda', onClick: async () => {
                      const r = await applyToStore(eq);
                      shell.notify(r.success ? { level: 'success', text: r.message } : { level: 'error', text: r.error });
                    } }, 'Aplicar'),
                    ' ',
                    h('button', { key: 'e', className: 'pl-btn pl-btn-sm', onClick: () => setEditing(eq) }, 'Editar'),
                    ' ',
                    h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', onClick: async () => {
                      if (!window.confirm('¿Eliminar "' + eq.name + '"? (no borra el producto en la tienda)')) return;
                      const r = await removeProducto(eq.id);
                      if (!r.success) shell.notify({ level: 'error', text: r.error });
                    } }, '✕'),
                  ]),
                ]);
              })),
            ])),
    ]);
  }

  // ── Pestaña: Precios (reglas + tipos + recálculo) ─────────────────────────
  function PreciosTab({ state }) {
    const def = state.def || defaultDefinition();
    const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify({ rules: def.rules || {}, types: def.types || DEFAULT_TYPES })));
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [applying, setApplying] = useState(false);
    useEffect(() => { if (!dirty) setDraft(JSON.parse(JSON.stringify({ rules: (state.def && state.def.rules) || {}, types: (state.def && state.def.types) || DEFAULT_TYPES }))); }, [state.def]);
    const upR = (patch) => { setDraft(Object.assign({}, draft, { rules: Object.assign({}, draft.rules, patch) })); setDirty(true); };
    const r = draft.rules;
    const numInput = (key, label, opts) => h(Row, { label },
      h(TextInput, Object.assign({ mono: true, type: 'number', value: r[key] == null ? '' : r[key], onChange: (e) => { const o = {}; o[key] = e.target.value === '' ? null : num(e.target.value); upR(o); } }, opts || {})));
    const pend = recalcPreview();
    return h('div', null, [
      h('div', { key: 'rules', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'REGLAS'), 'Parámetros de precio']),
        (function () {
          const m = num(r.marginDefaultPct, 25);
          const iva = num(r.ivaPct, 19);
          const basis = r.marginBasis === 'sale' ? 'sale' : 'cost';
          const net = basis === 'sale' ? 100000 / (1 - Math.min(m, 95) / 100) : 100000 * (1 + m / 100);
          return h('div', { key: 'basis', className: 'pl-warnbox', style: { background: 'var(--pl-plata)', border: '1px solid var(--pl-gris-claro)', color: 'var(--pl-negro)' } }, [
            h('div', { key: 'r', className: 'pl-compline', style: { borderBottom: 0 } }, [
              h('span', { key: 'l', className: 'pl-label' }, 'Base del margen'),
              h('select', { key: 's', className: 'pl-select', style: { width: 'auto' }, value: basis, onChange: (e) => upR({ marginBasis: e.target.value }) }, [
                h('option', { key: 'c', value: 'cost' }, 'Sobre el costo (markup): venta = costo × (1 + m%)'),
                h('option', { key: 'v', value: 'sale' }, 'Sobre la venta: venta = costo ÷ (1 − m%)'),
              ]),
            ]),
            h('div', { key: 'ex', className: 'pl-muted', style: { marginTop: 4 } },
              'Ejemplo con el margen por defecto (' + m + '%): costo $100.000 → neto ' + fmtCLP(net) + ' → con IVA ' + iva + '% = ' + fmtCLP(net * (1 + iva / 100)) + '. ' +
              (basis === 'sale'
                ? 'Con base "sobre la venta", el ' + m + '% del precio neto de venta es tu ganancia.'
                : 'Con base "sobre el costo", ganas el ' + m + '% de lo que te costó.')),
          ]);
        })(),
        h('div', { key: 'g', className: 'pl-grid3' }, [
          h(React.Fragment, { key: 'iva' }, numInput('ivaPct', 'IVA %')),
          h(React.Fragment, { key: 'usd' }, numInput('usdRate', 'Tipo de cambio USD → CLP')),
          h(React.Fragment, { key: 'md' }, numInput('marginDefaultPct', 'Margen por defecto % (tipos sin margen propio)')),
          h(React.Fragment, { key: 'mb' }, numInput('marginBasePct', 'Margen de costos adicionales % (solo extras manuales del producto)')),
          h(Row, { key: 'rm', label: 'Redondeo del precio final' },
            h('select', { className: 'pl-select', value: r.roundMode || 'end990', onChange: (e) => upR({ roundMode: e.target.value }) }, [
              h('option', { key: '1', value: 'end990' }, 'Terminación en 990'),
              h('option', { key: '2', value: 'up1000' }, 'Subir al millar'),
              h('option', { key: '3', value: 'none' }, 'Sin redondeo'),
            ])),
          h(React.Fragment, { key: 'dr' }, numInput('deltaRoundTo', 'Redondeo de recargos (paso $)')),
          h(React.Fragment, { key: 'ad' }, numInput('assemblyDays', 'Días de preparación por defecto')),
          h(React.Fragment, { key: 'sd' }, numInput('staleDays', 'Alerta: días sin verificar proveedor')),
        ]),
      ]),
      h('div', { key: 'types', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'TIPOS'), 'Tipos de componente y margen % por tipo']),
        h('div', { key: 'th', className: 'pl-muted', style: { marginBottom: 8 } },
          'Todo componente usa el margen de su tipo (vacío = margen por defecto). Esto aplica igual a los componentes base de los productos; el "margen de costos adicionales" de arriba es solo para los extras manuales (producción, embalaje, etc.).'),
        h('div', { key: 'list' }, (draft.types || []).map((t) => {
          const used = state.components.some((c) => c.type === t.id);
          return h('div', { key: t.id, className: 'pl-compline' }, [
            h('span', { key: 'id', className: 'pl-chip neg' }, t.id),
            h(TextInput, { key: 'l', value: t.label, style: { width: 200 }, onChange: (e) => { setDraft(Object.assign({}, draft, { types: draft.types.map((x) => (x.id === t.id ? Object.assign({}, x, { label: e.target.value }) : x)) })); setDirty(true); } }),
            h('span', { key: 'sp', className: 'grow' }),
            h('span', { key: 'ml', className: 'pl-label' }, 'margen %'),
            h(TextInput, { key: 'm', mono: true, type: 'number', style: { width: 90 },
              placeholder: s(num(r.marginDefaultPct, 25)),
              value: (r.marginByType || {})[t.id] == null ? '' : r.marginByType[t.id],
              onChange: (e) => {
                const mbt = Object.assign({}, r.marginByType || {});
                if (e.target.value === '') delete mbt[t.id]; else mbt[t.id] = num(e.target.value);
                upR({ marginByType: mbt });
              } }),
            h('button', { key: 'x', className: 'pl-btn pl-btn-sm pl-btn-danger', disabled: used, title: used ? 'Hay componentes de este tipo' : 'Quitar tipo', onClick: () => { setDraft(Object.assign({}, draft, { types: draft.types.filter((x) => x.id !== t.id) })); setDirty(true); } }, '✕'),
          ]);
        })),
        h('button', { key: 'add', className: 'pl-btn pl-btn-sm', style: { marginTop: 8 }, onClick: () => {
          const label = window.prompt('Nombre del nuevo tipo (ej: Monitor):');
          if (!label || !label.trim()) return;
          const id = norm(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || newId('t');
          if ((draft.types || []).some((x) => x.id === id)) { shell.notify({ level: 'warn', text: 'Ya existe un tipo con ese id.' }); return; }
          setDraft(Object.assign({}, draft, { types: (draft.types || []).concat([{ id, label: label.trim() }]) }));
          setDirty(true);
        } }, '+ Tipo'),
      ]),
      h('div', { key: 'save', className: 'pl-actions' }, [
        dirty && h('span', { key: 'd', className: 'pl-muted', style: { alignSelf: 'center' } }, 'Cambios sin guardar'),
        h('button', { key: 'b', className: 'pl-btn pl-btn-primary', disabled: !dirty || busy, onClick: async () => {
          setBusy(true);
          const next = Object.assign({}, state.def || defaultDefinition(), { rules: draft.rules, types: draft.types });
          const res = await saveDefinition(next);
          setBusy(false);
          if (res.success) { setDirty(false); shell.notify({ level: 'success', text: 'Reglas guardadas. Revisa el recálculo de productos más abajo.' }); }
        } }, 'Guardar reglas'),
      ]),
      // Recalculo
      h('div', { key: 'recalc', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'RECÁLCULO'), 'Impacto en productos']),
        pend.length === 0
          ? h('div', { key: 'ok', className: 'pl-muted' }, 'Todos los productos están al día con los costos y reglas actuales.')
          : h(React.Fragment, { key: 'p' }, [
              h('table', { key: 'tbl', className: 'pl-table' }, [
                h('thead', { key: 'h' }, h('tr', null, ['Producto', 'Precio actual', 'Precio nuevo', 'Δ'].map((c, i) => h('th', { key: i }, c)))),
                h('tbody', { key: 'b' }, pend.map((x) => h('tr', { key: x.eq.id }, [
                  h('td', { key: 'n', style: { fontWeight: 600 } }, x.eq.name),
                  h('td', { key: 'o', className: 'pl-price' }, fmtCLP(x.oldPrice)),
                  h('td', { key: 'p', className: 'pl-price' }, fmtCLP(x.nextPrice)),
                  h('td', { key: 'd', className: 'pl-delta' + (x.nextPrice < x.oldPrice ? ' neg' : '') }, fmtDelta(x.nextPrice - x.oldPrice)),
                ]))),
              ]),
              h('div', { key: 'a', className: 'pl-actions' },
                h('button', { className: 'pl-btn pl-btn-primary', disabled: applying || dirty, title: dirty ? 'Guarda las reglas primero' : '', onClick: async () => {
                  setApplying(true);
                  const res = await recalcApply();
                  setApplying(false);
                  const ok = res.filter((x) => x.success).length;
                  shell.notify({ level: ok === res.length ? 'success' : 'warn', text: ok + '/' + res.length + ' productos actualizados' + (ok ? ' y sincronizados con la tienda.' : '.') });
                } }, applying ? 'Aplicando…' : 'Recalcular productos y sincronizar')),
            ]),
      ]),
    ]);
  }

  // ── Pestaña: Publicación (JSON del configurador + plan de opciones) ───────
  function PublicacionTab({ state }) {
    const [busy, setBusy] = useState(false);
    const [showJson, setShowJson] = useState(false);
    const pub = (state.def && state.def.public) || {};
    const enabled = pub.enabled === true;
    const stamp = pub.data && pub.data.updatedAt;
    return h('div', null, [
      h('div', { key: 'st', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'CONFIGURADOR'), 'Publicación para el theme de la tienda']),
        h('div', { key: 'd', className: 'pl-muted', style: { marginBottom: 10 } },
          'El theme (configurador.js) lee este JSON público para pintar los pasos, imágenes, recargos, compatibilidades y fechas de entrega de cada producto. Una vez publicado, se REPUBLICA SOLO cada vez que guardas componentes, productos o aplicas recálculos (la tienda lo ve en ~5 min por el caché del CDN).'),
        h('div', { key: 'line', className: 'pl-compline' }, [
          enabled ? h('span', { key: 'c', className: 'pl-chip ok' }, 'publicado') : h('span', { key: 'c', className: 'pl-chip gris' }, 'despublicado'),
          stamp && h('span', { key: 's', className: 'pl-muted' }, 'última publicación: ' + fmtDateTime(stamp)),
          h('span', { key: 'sp', className: 'grow' }),
          h('button', { key: 'pub', className: 'pl-btn pl-btn-primary', disabled: busy, onClick: async () => {
            setBusy(true);
            const r = await publish(true);
            setBusy(false);
            if (r.success) shell.notify({ level: 'success', text: 'Configurador publicado (' + buildPublicData().productos.length + ' productos).' });
          } }, enabled ? 'Republicar ahora' : 'Publicar'),
          enabled && h('button', { key: 'unpub', className: 'pl-btn', disabled: busy, onClick: async () => {
            setBusy(true); await publish(false); setBusy(false);
            shell.notify({ level: 'info', text: 'Configurador despublicado: el gateway responderá 403.' });
          } }, 'Despublicar'),
        ]),
        h(Row, { key: 'sbu', label: 'URL base de la tienda (arma el botón "Tienda ↗": base + permalink del producto)' },
          h(TextInput, { key: 'sbu-' + s((state.def || {}).storeBaseUrl), mono: true,
            defaultValue: s((state.def || {}).storeBaseUrl), placeholder: 'https://mitienda.cl',
            onBlur: async (e) => {
              const v = e.target.value.trim();
              if (v === s((state.def || {}).storeBaseUrl)) return;
              const r = await saveDefinition(Object.assign({}, state.def || defaultDefinition(), { storeBaseUrl: v }));
              if (r.success) shell.notify({ level: 'success', text: 'URL base de la tienda guardada.' });
            } })),
        h(Row, { key: 'url', label: 'URL pública (para configurador.js del theme)' },
          h('div', { className: 'pl-verify-cost' }, [
            h(TextInput, { key: 'i', mono: true, readOnly: true, value: publicUrl, onFocus: (e) => e.target.select() }),
            h('button', { key: 'c', className: 'pl-btn pl-btn-sm', onClick: () => copy(publicUrl) }, 'Copiar'),
          ])),
        h('label', { key: 'tgl', className: 'pl-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: showJson, onChange: (e) => setShowJson(e.target.checked) }),
          h('span', { key: 's' }, 'Ver JSON que se publicaría ahora'),
        ]),
        showJson && h('pre', { key: 'json', className: 'pl-code' }, JSON.stringify(buildPublicData(), null, 2)),
      ]),
      h('div', { key: 'plan', className: 'pl-card' }, [
        h('div', { key: 't', className: 'pl-card-title' }, [h('span', { key: 'n', className: 'pl-num' }, 'JUMPSELLER'), 'Opciones y variantes por producto']),
        h('div', { key: 'd', className: 'pl-muted', style: { marginBottom: 10 } },
          'Las opciones (un paso = una opción) y las variantes con precio por combinación se escriben automáticamente al usar "Aplicar a la tienda" (van al item de la app Productos y su sync-push las empuja a Jumpseller). Aquí puedes inspeccionar el payload exacto que se generaría ahora.'),
        state.productos.length === 0
          ? h('div', { key: 'e', className: 'pl-muted' }, 'Sin productos.')
          : state.productos.map((eq) => h('div', { key: eq.id, className: 'pl-compline' }, [
              h('span', { key: 'n', style: { fontWeight: 600 } }, eq.name),
              h('span', { key: 'sku', className: 'pl-mono pl-muted', style: { fontSize: 10 } }, eq.sku || ''),
              h('span', { key: 'cnt', className: 'pl-chip gris' }, comboCount(eq) + ' variantes'),
              h('span', { key: 'st' }, h(SyncBadge, { eq })),
              h('span', { key: 'sp', className: 'grow' }),
              h('button', { key: 'c', className: 'pl-btn pl-btn-sm', onClick: () => copy(JSON.stringify(storePlan(eq), null, 2)) }, 'Copiar payload JSON'),
            ])),
      ]),
    ]);
  }

  // ── Raíz ──────────────────────────────────────────────────────────────────
  function Component() {
    const [state, setState] = useState(model);
    const [tab, setTab] = useState('productos');
    useEffect(() => {
      listeners.add(setState);
      void load();
      void loadStoreCatalog();
      const t = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void load();
      }, 45000);
      return () => { listeners.delete(setState); clearInterval(t); };
    }, []);
    if (!instanceId) {
      return h('div', { className: 'kimos-productlab' },
        h('div', { className: 'pl-empty' }, 'Crea un documento desde la pantalla de bienvenida: cada instancia es un catálogo de productos personalizables (normalmente basta una por tienda).'));
    }
    const r = rules();
    const staleCount = state.components.filter((c) => daysSince(c.verifiedAt) > r.staleDays).length;
    const tabs = [
      ['productos', 'Productos' + (state.productos.length ? ' (' + state.productos.length + ')' : '')],
      ['componentes', 'Componentes' + (state.components.length ? ' (' + state.components.length + ')' : '') + (staleCount ? ' · ⚠' + staleCount + ' por verificar' : '')],
      ['precios', 'Precios'],
      ['publicacion', 'Publicación'],
    ];
    return h('div', { className: 'kimos-productlab' }, [
      h('div', { key: 'top', className: 'pl-top' }, [
        h('span', { key: 'b', className: 'pl-brand' }, ['PRODUCTLAB', h('i', { key: 'i' }, '.')]),
        h('span', { key: 's', className: 'pl-sep' }),
        h('span', { key: 't', className: 'pl-sub' }, 'Laboratorio de productos personalizables'),
        h('div', { key: 'r', className: 'pl-right' },
          h('span', { key: 'env', className: 'pl-sub' }, !state.storeCatalogLoaded
            ? 'PRODUCTOS · CARGANDO'
            : state.storeCatalog.length
              ? 'PRODUCTOS · ' + state.storeCatalog.length + ' EN CATÁLOGO'
              : 'PRODUCTOS · SIN ACCESO')),
      ]),
      h('div', { key: 'tabs', className: 'pl-tabs' },
        tabs.map(([id, label]) => h('button', { key: id, className: 'pl-tab' + (tab === id ? ' on' : ''), onClick: () => setTab(id) }, label))
          .concat([h('button', { key: 'r', className: 'pl-tab pl-tab-right', title: 'Actualizar', onClick: () => { void load(); void loadStoreCatalog(); } }, '⟳')])),
      h('div', { key: 'body', className: 'pl-body' }, [
        state.error && h('div', { key: 'err', className: 'pl-errbox' }, state.error),
        !state.loaded
          ? h('div', { key: 'l', className: 'pl-empty' }, 'Cargando…')
          : tab === 'componentes' ? h(ComponentesTab, { key: 'c', state })
          : tab === 'productos' ? h(ProductosTab, { key: 'e', state })
          : tab === 'precios' ? h(PreciosTab, { key: 'pr', state })
          : h(PublicacionTab, { key: 'pub', state }),
      ]),
    ]);
  }

  return {
    Component,
    unmount() {
      listeners.clear();
      if (republishTimer) clearTimeout(republishTimer);
      if (typeof offAgent === 'function') offAgent();
    },
  };
}
