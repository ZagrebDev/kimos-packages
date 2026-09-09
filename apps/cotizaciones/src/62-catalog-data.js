/* ══ LECTURA DE LOS CATÁLOGOS DE OTRAS APPS ═══════════════════════════════
 *
 * `shell.data` (APP-SPEC §7.c) permite leer los datos de otras apps
 * declarando el permiso en el manifest. La app pide tres:
 *
 *   data.read:products     el catálogo de la tienda
 *   data.read:productlab   los productos configurables
 *   data.read:customers    el directorio de clientes
 *
 * El RBAC del usuario es siempre el techo: solo se ven instancias de equipos
 * a los que ya tiene acceso, y el permiso de la app nunca lo supera.
 *
 * Nada de esto se persiste en la cotización: es un espejo de lectura. Lo que
 * SÍ se guarda en la línea es el precio, la descripción y la combinación
 * elegida en el momento de cotizar, porque una cotización es una oferta con
 * fecha: si mañana sube el precio del catálogo, la cotización enviada tiene
 * que seguir diciendo lo que decía.
 */

/** Por qué no se puede leer el catálogo, o '' si sí se puede. */
function catalogoNoDisponible() {
  if (!shell.data || typeof shell.data.listInstances !== 'function') {
    return 'Este host no expone shell.data, así que no es posible leer los catálogos de otras apps.';
  }
  return '';
}

const setExt = (patch) => setModel({ ext: Object.assign({}, model.ext, patch) });

/**
 * Carga los catálogos de Productos y ProductLab y los normaliza a la forma
 * común. Una instancia sin acceso no tumba al resto: se salta y se sigue.
 */
async function loadExternalCatalog(force) {
  const motivo = catalogoNoDisponible();
  if (motivo) { setExt({ loading: false, loaded: true, error: motivo }); return []; }
  if (model.ext.loading) return model.ext.products;
  if (model.ext.loaded && !force) return model.ext.products;

  setExt({ loading: true, error: null });
  const productos = [];
  const sources = [];
  try {
    const pInsts = arr(await shell.data.listInstances('products').catch(() => []));
    const plInsts = arr(await shell.data.listInstances('productlab').catch(() => []));

    // Los items de `products` se cargan primero porque ProductLab los usa
    // para su modo de precio "store" y para heredar fotos y descripción.
    const storeItems = new Map();
    const porInstancia = [];
    for (const inst of pInsts) {
      try {
        const items = arr(await shell.data.listItems(inst.id));
        const reales = items.filter((p) => p && p.kind !== 'definition' && s(p.name));
        reales.forEach((p) => storeItems.set(s(p.id), p));
        porInstancia.push({ inst, items: reales });
      } catch (e) { /* instancia sin acceso: no tumbar el resto */ }
    }

    // ProductLab: primero el catálogo publicado; si no publica, se replica su
    // motor de precios sobre los componentes crudos.
    const vinculados = new Set();
    for (const inst of plInsts) {
      try {
        const items = arr(await shell.data.listItems(inst.id));
        const def = items.find((i) => i && (i.id === 'definition' || i.kind === 'definition'));
        const comps = items.filter((i) => i && i.kind === 'component');
        const prods = items.filter((i) => i && (i.kind === 'producto' || i.kind === 'equipo'));
        prods.forEach((eq) => { if (eq.storeRef && eq.storeRef.itemId) vinculados.add(s(eq.storeRef.itemId)); });

        const pub = def && def.public && def.public.enabled && def.public.data
          && Array.isArray(def.public.data.productos) ? def.public.data : null;
        let n = 0;
        if (pub) {
          pub.productos.forEach((pp) => { const x = fromPublicPL(pp, inst); if (x) { productos.push(x); n++; } });
        } else {
          const engine = plEngine(def, comps);
          prods.forEach((eq) => { const x = fromRawPL(eq, engine, inst, storeItems); if (x) { productos.push(x); n++; } });
        }
        sources.push({ app: 'productlab', id: inst.id, name: s(inst.name) || inst.id, count: n, published: !!pub });
      } catch (e) { /* instancia sin acceso */ }
    }

    // Productos: se omiten los que ya entran como configurables desde
    // ProductLab, para no ofrecer dos veces lo mismo.
    for (const par of porInstancia) {
      let n = 0;
      par.items.forEach((p) => {
        if (vinculados.has(s(p.id))) return;
        const x = fromProductsItem(p, par.inst);
        if (x) { productos.push(x); n++; }
      });
      sources.push({ app: 'products', id: par.inst.id, name: s(par.inst.name) || par.inst.id, count: n });
    }

    setExt({
      loading: false, loaded: true, error: null, at: stamp(),
      products: productos, sources,
    });
  } catch (e) {
    setExt({ loading: false, loaded: true, error: (e && e.message) || 'No se pudo leer el catálogo.' });
  }
  return model.ext.products;
}

/** Directorio de clientes de la app Clientes, para no retipear la ficha. */
async function loadCustomers(force) {
  if (catalogoNoDisponible()) return [];
  if (model.ext.customers.length && !force) return model.ext.customers;
  const out = [];
  const sources = [];
  try {
    const insts = arr(await shell.data.listInstances('customers').catch(() => []));
    for (const inst of insts) {
      try {
        const items = arr(await shell.data.listItems(inst.id));
        let n = 0;
        for (const c of items) {
          if (!c || c.kind === 'definition') continue;
          const name = s(c.name || c.fullName || c.company || c.email);
          if (!name) continue;
          out.push({
            id: s(c.id), instanceId: inst.id, instanceName: s(inst.name),
            name,
            taxId: s(c.taxId || c.rut || c.documentNumber),
            email: s(c.email),
            phone: s(c.phone),
            // La app Clientes guarda ciudad y país por separado; para la
            // cotización se juntan en una sola dirección legible.
            address: [s(c.address || c.street), s(c.city), s(c.country)].filter(Boolean).join(', '),
            contact: s(c.contact || c.contactName),
          });
          n++;
        }
        sources.push({ app: 'customers', id: inst.id, name: s(inst.name) || inst.id, count: n });
      } catch (e) { /* instancia sin acceso */ }
    }
  } catch (e) { /* sin app de clientes instalada: la ficha se escribe a mano */ }
  setExt({ customers: out, customerSources: sources });
  return out;
}

const productByKey = (key) => model.ext.products.find((p) => p.key === s(key)) || null;

// ── Acciones sobre el catálogo externo ──────────────────────────────────
/**
 * Inserta un producto del catálogo como línea de la cotización.
 *
 * `selection` es la combinación de pasos elegida (`{ stepId: valueId }`); si
 * viene vacía o incompleta se completa con los valores por defecto. El precio
 * se resuelve AHORA y se congela en la línea, junto con la combinación, para
 * que la cotización siga diciendo lo mismo aunque el catálogo cambie.
 */
function actAddProductToQuote(quoteId, productKey, opts) {
  const o = isObj(opts) ? opts : {};
  const doc = docById(s(quoteId));
  const prod = productByKey(productKey);
  if (!doc || !prod) return null;

  const sel = seleccionResuelta(prod, o.selection);
  const bruto = precioSeleccion(prod, sel);
  const rules = rulesOf();
  const unitPrice = o.unitPrice != null && o.unitPrice !== ''
    ? num(o.unitPrice)
    : roundTo(precioParaCotizar(bruto, rules, doc.taxPct), currencyOf(doc, rules).decimals);

  const line = normalizeLine({
    title: prod.name,
    description: o.description != null ? s(o.description) : descripcionSeleccion(prod, sel, o.includeDescription),
    qty: o.qty == null ? 1 : Math.max(0, num(o.qty)),
    unitPrice,
    sku: prod.sku,
    imageUrl: fotoSeleccion(prod, sel),
    source: {
      kind: prod.source === 'productlab' ? 'productlab' : 'product',
      instanceId: prod.instanceId,
      productId: prod.id,
      selection: detalleSeleccion(prod, sel),
      capturedAt: stamp(),
      capturedPrice: bruto,
    },
  });
  return actAddLine(quoteId, line);
}

/**
 * Vuelve a preguntarle al catálogo por el precio de una línea que salió de
 * él. No se hace solo: una cotización es una oferta con fecha, y el precio
 * solo se actualiza si la persona lo pide.
 */
function actRefreshLinePrice(quoteId, lineId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const line = arr(doc.lines).find((l) => l.id === s(lineId));
  if (!line || line.source.kind === 'manual') return null;

  if (line.source.kind === 'catalog') {
    const c = catalogById(line.source.itemId);
    if (!c) { shell.notify({ level: 'warn', text: 'El ítem ya no está en el catálogo propio.' }); return null; }
    return actUpdateLine(quoteId, lineId, {
      unitPrice: c.unitPrice,
      source: Object.assign({}, line.source, { capturedAt: stamp(), capturedPrice: c.unitPrice }),
    });
  }

  const prod = model.ext.products.find((p) => p.instanceId === line.source.instanceId && p.id === line.source.productId);
  if (!prod) { shell.notify({ level: 'warn', text: 'El producto ya no está en el catálogo; el precio se deja como estaba.' }); return null; }
  // La combinación guardada viaja por ids de paso y valor: se rehidrata.
  const sel = {};
  arr(line.source.selection).forEach((d) => { if (d.stepId) sel[d.stepId] = d.valueId; });
  const bruto = precioSeleccion(prod, sel);
  const rules = rulesOf();
  const unitPrice = roundTo(precioParaCotizar(bruto, rules, doc.taxPct), currencyOf(doc, rules).decimals);
  const antes = line.unitPrice;
  const out = actUpdateLine(quoteId, lineId, {
    unitPrice,
    source: Object.assign({}, line.source, { capturedAt: stamp(), capturedPrice: bruto }),
  });
  shell.notify({
    level: unitPrice === antes ? 'info' : 'success',
    text: unitPrice === antes ? 'El precio del catálogo no ha cambiado.' : 'Precio actualizado desde el catálogo.',
  });
  return out;
}

/** Copia la ficha de un cliente de la app Clientes a la cotización. */
function actImportClient(quoteId, customerId) {
  const c = model.ext.customers.find((x) => x.id === s(customerId));
  if (!c) return null;
  const out = commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient({
      name: c.name, taxId: c.taxId, contact: c.contact, email: c.email,
      phone: c.phone, address: c.address,
      sourceApp: 'customers', sourceInstanceId: c.instanceId, sourceItemId: c.id,
    });
    return d;
  });
  // Traerlo del directorio ya dice quién es, así que se le da su identidad
  // del sistema sin preguntar. En silencio: el usuario pidió importar un
  // cliente, no gestionar identidades. Si no se puede (host antiguo, sin
  // permiso), la cotización queda igual de utilizable.
  try { actLinkClientRecord(s(quoteId), { silent: true }); } catch (e) { /* opcional */ }
  return out;
}
