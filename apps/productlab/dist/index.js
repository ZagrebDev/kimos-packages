/**
 * ProductLab — laboratorio de productos personalizables: costos reales,
 * componentes/insumos, configuración paso a paso, márgenes, ficha visual,
 * visor 3D con AR y publicación hacia el e-commerce.
 *
 * HERENCIA (continuidad del proyecto): base = "Gestión Avanzada de Productos"
 * v1.13.2 (repo personalizador, rama claude/generic-product-management-3d-…),
 * que a su vez generalizó a "Computadores HubPro" v3.6.1 (repo computadores)
 * conservando toda su potencia. ProductLab suma: pasos DEPENDIENTES
 * (dependsOn), CANTIDAD por valor (qty), secciones de IMAGEN de alto
 * adaptable y tamaños "auto", ESTILO del configurador por producto y un
 * PREVISUALIZADOR en vivo del paso a paso. Docs: apps/productlab/docs/.
 *
 * GENÉRICA POR RUBRO: un "componente" es cualquier cosa que entra al costo —
 * una tela, una materia prima, un herraje, una pieza, o un PROVEEDOR EXTERNO
 * que externaliza manufactura o un proceso (corte, estampado, ensamblaje).
 * Los tipos de componente se eligen por rubro (presets) o se definen a mano,
 * y moneda, impuesto, redondeo y locale son parámetros — no hay nada cableado
 * a un país ni a una industria.
 *
 * Arquitectura (escribe A TRAVÉS de la app oficial `products`, no la duplica):
 *  - Los COMPONENTES, PRODUCTOS y reglas viven como items de esta instancia.
 *  - Cada PRODUCTO referencia (storeRef) un item de producto de una instancia
 *    de la app `products`. Al "aplicar a la tienda", esta app genera desde los
 *    grupos de componentes: `price` + `options[]` (una opción por paso, según
 *    el esquema v2.1 de products: {name, optionType, sourceOptionId, values})
 *    + `variants[]` (producto cartesiano con PRECIO POR COMBINACIÓN y
 *    sourceVariantId preservado), los escribe en el item del producto
 *    (PUT /api/app-instances/{pInst}/items/{itemId}) y dispara su
 *    sync-push — el backend de KIMOS empuja producto, opciones y variantes a
 *    Jumpseller con los endpoints dedicados y persiste los ids.
 *  - El catálogo se lee vía shell.data (data.read:products); la escritura usa
 *    shell.authFetch con el RBAC del usuario (mismos endpoints que usa la UI
 *    de products). El push a Jumpseller SOLO existe para instancias del
 *    template products, por eso se escribe allí y no aquí.
 *  - El configurador del theme se alimenta del JSON publicado en
 *    GET /api/public/app/{instanceId}/definition (permiso public.read):
 *    imágenes, specs, dependencias, compatibilidades y entrega, que
 *    Jumpseller no modela.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;
  // useRef puede faltar en hosts/mocks muy reducidos: sin él el visor 3D no se
  // monta, pero el resto de la app funciona igual.
  const useRef = React.useRef || ((v) => ({ current: v }));

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
  // Dinero: símbolo, locale y decimales salen de las reglas (rules() está
  // declarada más abajo — function declaration, se hoistea).
  function fmtMoney(v) {
    const r = rules();
    const d = Math.max(0, Math.min(4, num(r.currencyDecimals, 0)));
    const n = num(v);
    let body;
    try {
      body = (d ? n : Math.round(n)).toLocaleString(r.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
    } catch (e) { body = String(d ? n.toFixed(d) : Math.round(n)); }
    return r.currencySymbol + body;
  }
  const fmtDelta = (v) => (v < 0 ? '− ' : '+ ') + fmtMoney(Math.abs(v));
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
    try { return new Date(iso).toLocaleDateString(rules().locale); } catch (e) { return s(iso); }
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso), lo = rules().locale;
      return d.toLocaleDateString(lo) + ' ' + d.toLocaleTimeString(lo, { hour: '2-digit', minute: '2-digit' });
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

  // Tipos de componente por RUBRO. Son solo puntos de partida: la pestaña
  // Precios permite editarlos, borrarlos y crear los propios (cada tipo puede
  // llevar su margen %). Un "componente" puede ser un material, una pieza, un
  // insumo, mano de obra o un proceso externalizado a un proveedor.
  const TYPE_PRESETS = [
    {
      id: 'generico', label: 'Genérico (cualquier rubro)',
      types: [
        { id: 'material', label: 'Material / Materia prima' },
        { id: 'pieza', label: 'Pieza / Insumo' },
        { id: 'manoobra', label: 'Mano de obra' },
        { id: 'externo', label: 'Proceso externalizado' },
        { id: 'empaque', label: 'Empaque' },
        { id: 'logistica', label: 'Logística' },
        { id: 'other', label: 'Otro' },
      ],
    },
    {
      id: 'confeccion', label: 'Confección / Textil',
      types: [
        { id: 'tela', label: 'Tela' },
        { id: 'avios', label: 'Avíos (botones, cierres, elásticos)' },
        { id: 'hilo', label: 'Hilo' },
        { id: 'estampado', label: 'Estampado / Bordado' },
        { id: 'corte', label: 'Corte' },
        { id: 'confeccion', label: 'Confección (taller externo)' },
        { id: 'etiquetas', label: 'Etiquetas' },
        { id: 'empaque', label: 'Empaque' },
        { id: 'logistica', label: 'Logística' },
        { id: 'other', label: 'Otro' },
      ],
    },
    {
      id: 'mobiliario', label: 'Mueblería / Carpintería',
      types: [
        { id: 'tablero', label: 'Tablero / Madera' },
        { id: 'herrajes', label: 'Herrajes' },
        { id: 'tapiz', label: 'Tapiz / Tela' },
        { id: 'espuma', label: 'Espuma / Relleno' },
        { id: 'acabado', label: 'Acabado / Pintura' },
        { id: 'cnc', label: 'Corte CNC (externo)' },
        { id: 'ensamblaje', label: 'Ensamblaje' },
        { id: 'empaque', label: 'Empaque' },
        { id: 'logistica', label: 'Logística' },
        { id: 'other', label: 'Otro' },
      ],
    },
    {
      id: 'computacion', label: 'Computación / Electrónica',
      types: [
        { id: 'cpu', label: 'Procesador' },
        { id: 'mobo', label: 'Placa madre' },
        { id: 'ram', label: 'Memoria RAM' },
        { id: 'gpu', label: 'Tarjeta gráfica' },
        { id: 'storage', label: 'Almacenamiento' },
        { id: 'psu', label: 'Fuente de poder' },
        { id: 'case', label: 'Gabinete' },
        { id: 'cooler', label: 'Refrigeración' },
        { id: 'os', label: 'Sistema operativo' },
        { id: 'other', label: 'Otro' },
      ],
    },
  ];
  const presetById = (id) => TYPE_PRESETS.find((p) => p.id === id) || TYPE_PRESETS[0];
  const DEFAULT_TYPES = TYPE_PRESETS[0].types;

  function defaultDefinition() {
    return {
      id: 'definition',
      kind: 'definition',
      types: DEFAULT_TYPES,
      rules: {
        // ── Moneda y formato (sin nada cableado a un país) ──
        currency: 'CLP',          // moneda base en que se vende y se publica
        currencySymbol: '$',
        currencyDecimals: 0,      // 0 para CLP/JPY; 2 para USD/EUR/MXN…
        locale: 'es-CL',          // formato de números y fechas
        // Tipos de cambio de monedas de COSTO → moneda base. El costo de un
        // componente puede venir en cualquiera de estas (proveedor extranjero).
        fx: { USD: 950 },
        // ── Impuesto de venta (IVA / VAT / IGV / Sales tax) ──
        salesTaxLabel: 'IVA',
        salesTaxPct: 19,
        // ── Márgenes ──
        marginBasis: 'cost',      // 'cost': venta = costo×(1+m) | 'sale': venta = costo÷(1−m)
        marginDefaultPct: 25,     // fallback para tipos sin margen propio
        marginBasePct: 25,        // SOLO para costos adicionales manuales del producto
        marginByType: {},
        // ── Redondeo del precio final ──
        // none | nearest (al múltiplo) | up (hacia arriba) | ending (termina en)
        roundMode: 'none',
        roundTo: 1000,            // tamaño del bloque para nearest/up/ending
        roundEnding: 990,         // terminación para roundMode 'ending'
        deltaRoundTo: 100,        // redondeo de los recargos por valor
        // ── Plazos ──
        leadTimeDays: 3,          // días propios de preparación/producción
        staleDays: 30,            // días sin verificar proveedor => alerta
      },
      // Identidad visible (cada empresa pone la suya).
      brandName: '',
      // Nombre corto de la tienda que viaja en el JSON público.
      storeName: '',
      // URL base de la tienda (para armar el link del producto: base+permalink)
      storeBaseUrl: '',
      // Custom field de Jumpseller que le dice al theme que este producto usa
      // la vista de configurador. Parametrizable por si el theme usa otro.
      storeCustomField: { name: 'diseno', value: 'personalizado' },
      // Plantillas de estilo del catálogo: un look completo (colores, barra,
      // fotos, anchos) reutilizable en muchos productos, y cuál rige por
      // defecto. Vacío = cada producto con su estilo propio.
      styleTemplates: [],
      styleDefaultId: '',
      // Bloque leído por el gateway público (theme de la tienda):
      public: { enabled: false, channels: [], data: null },
    };
  }
  // Marca mostrada en la barra superior (configurable por empresa).
  function brandName() {
    return s((model.def || {}).brandName).trim().toUpperCase() || 'PRODUCTLAB';
  }

  // ── Estado del closure ────────────────────────────────────────────────────
  let model = {
    loaded: false,
    error: null,
    components: [],
    productos: [],
    def: null,
    defExists: false,
    catalog: [],          // catálogo leído de la app products (picker), con __instanceId
    catalogLoaded: false,
    catalogError: null,
  };
  const listeners = new Set();

  // ── Navegación global (header único: breadcrumb + tabs grandes) ──────────
  // sec: sección raíz ('productos' | 'componentes' | 'config').
  // det: detalle abierto (null | { tipo: 'producto'|'componente', draft, nombre }).
  // tab: subpestaña del contexto (detalle o config); null = raíz de la sección.
  let nav = { sec: 'productos', det: null, tab: null };
  const navListeners = new Set();
  function setNav(patch) {
    nav = Object.assign({}, nav, patch);
    navListeners.forEach((f) => f(nav));
  }
  // Acciones del detalle abierto (precio vivo + guardar/aplicar): las publica
  // el editor y las pinta el HEADER — sin barras inferiores en la pantalla.
  let hdrExtra = null;
  const hdrExtraListeners = new Set();
  function setHdrExtra(x) { hdrExtra = x; hdrExtraListeners.forEach((f) => f(x)); }
  function useHdrExtra() {
    const [x, setX] = useState(hdrExtra);
    useEffect(() => { hdrExtraListeners.add(setX); return () => hdrExtraListeners.delete(setX); }, []);
    return x;
  }

  function useNav() {
    const [n, setN] = useState(nav);
    useEffect(() => { navListeners.add(setN); return () => navListeners.delete(setN); }, []);
    return n;
  }
  function setModel(patch) { model = Object.assign({}, model, patch); listeners.forEach((l) => l(model)); }

  // Última acción del agente: qué sección del editor tocó. El agente escribe
  // en el modelo, no en el formulario abierto, así que el editor necesita
  // saber que algo cambió por debajo — y adónde llevar al usuario.
  const agentEdit = { section: null, at: 0 };

  /**
   * ¿Qué hacer con un editor abierto cuando el producto cambió por debajo?
   *   'nada'      — no cambió, o el cambio ya está reflejado.
   *   'recargar'  — cambió y aquí no hay edición sin guardar: se recarga solo.
   *   'preguntar' — cambió Y hay edición sin guardar: lo decide el usuario,
   *                 porque las dos salidas pierden algo.
   * Está fuera del componente para poder probarla: el render de la app no
   * ejecuta los componentes anidados en el harness de test.
   */
  function decidirRecarga(local, vivo, baseJson) {
    if (!vivo || !vivo.updatedAt || !local || !local.updatedAt) return 'nada';
    if (vivo.updatedAt <= local.updatedAt) return 'nada';
    return JSON.stringify(local) === baseJson ? 'recargar' : 'preguntar';
  }

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

  /**
   * Llamada al backend con REINTENTOS. La cadena hasta la tienda pasa por la
   * caché de Jumpseller (Varnish), que ante una subida larga —muchas variantes—
   * corta con 503 "Timed out while waiting". No es un fallo de datos: casi
   * siempre basta con volver a intentarlo, así que se hace solo.
   */
  const REINTENTABLE = [408, 429, 500, 502, 503, 504];
  async function fetchReintento(url, opts, intentos) {
    const veces = Math.max(1, intentos || 3);
    let ultimo = null;
    for (let i = 0; i < veces; i++) {
      try {
        const res = await shell.authFetch(url, opts);
        if (res.ok || REINTENTABLE.indexOf(res.status) === -1) return res;
        ultimo = res;
      } catch (e) {
        ultimo = null;                       // caída de red: también se reintenta
        if (i === veces - 1) throw e;
      }
      if (i < veces - 1) await new Promise((r) => setTimeout(r, 1200 * Math.pow(2, i)));
    }
    return ultimo;
  }
  /**
   * Mensaje legible de un error de la tienda. Jumpseller responde con la página
   * HTML de su caché, y volcarla entera en pantalla no le dice nada a nadie.
   */
  function errorTienda(texto, status) {
    const t = s(texto);
    if (/varnish|timed out while waiting|<html/i.test(t)) {
      return 'La tienda no respondió a tiempo (' + (status || 503) + ' de la caché de Jumpseller). '
        + 'No es un problema de tus datos: se reintentó y siguió sin responder. '
        + 'Vuelve a aplicar en un minuto; si el producto tiene muchas variantes, considera reducir alternativas por paso — cuantas más combinaciones, más tarda la subida y más fácil es que Jumpseller corte.';
    }
    return t || ('HTTP ' + (status || '?') + ' al hablar con la tienda.');
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
  const ROUND_MODES = ['none', 'nearest', 'up', 'ending'];
  function rules() { return normalizeRules((model.def && model.def.rules) || {}); }
  // Normalización pura de un bloque de reglas: resuelve los alias históricos
  // (ivaPct, usdRate, assemblyDays, end990/up1000) y rellena defaults. Se usa
  // tanto para leer las propias como para traducir las de un catálogo que se
  // importa o migra desde otra app de la familia.
  function normalizeRules(raw) {
    const r = raw || {};
    // fx: mapa MONEDA→tipo de cambio hacia la moneda base. Se acepta el
    // usdRate antiguo como atajo para no perder configuraciones simples.
    const fx = Object.assign({}, r.fx && typeof r.fx === 'object' ? r.fx : null);
    if (r.usdRate != null && fx.USD == null) fx.USD = num(r.usdRate, 0);
    return {
      currency: s(r.currency).trim().toUpperCase() || 'CLP',
      currencySymbol: r.currencySymbol != null && r.currencySymbol !== '' ? s(r.currencySymbol) : '$',
      currencyDecimals: Math.max(0, Math.min(4, num(r.currencyDecimals, 0))),
      locale: s(r.locale).trim() || 'es-CL',
      fx,
      salesTaxLabel: s(r.salesTaxLabel).trim() || 'IVA',
      // salesTaxPct sustituye al ivaPct histórico.
      salesTaxPct: numOr(r.salesTaxPct, numOr(r.ivaPct, 19)),
      marginBasis: r.marginBasis === 'sale' ? 'sale' : 'cost',
      marginDefaultPct: num(r.marginDefaultPct, 25),
      marginBasePct: num(r.marginBasePct, num(r.marginDefaultPct, 25)),
      marginByType: r.marginByType || {},
      roundMode: ROUND_MODES.indexOf(r.roundMode) !== -1 ? r.roundMode
        : (r.roundMode === 'end990' ? 'ending' : r.roundMode === 'up1000' ? 'up' : 'none'),
      roundTo: Math.max(1, num(r.roundTo, 1000)),
      roundEnding: Math.max(0, num(r.roundEnding, 990)),
      deltaRoundTo: Math.max(1, num(r.deltaRoundTo, 100)),
      leadTimeDays: numOr(r.leadTimeDays, numOr(r.assemblyDays, 3)),
      staleDays: Math.max(1, num(r.staleDays, 30)),
    };
  }
  // Custom field que marca el producto como "configurable" para el theme.
  // Parametrizable: otro theme puede usar otro nombre/valor. Vacío = no se envía.
  function storeCustomFields() {
    const cf = (model.def && model.def.storeCustomField) || { name: 'diseno', value: 'personalizado' };
    const name = s(cf.name).trim();
    if (!name) return {};
    const out = {};
    out[name] = s(cf.value).trim();
    return out;
  }
  // Monedas seleccionables para el COSTO de un componente: la base + las que
  // tengan tipo de cambio definido.
  function costCurrencies() {
    const r = rules();
    return [r.currency].concat(Object.keys(r.fx).filter((k) => k && k !== r.currency && num(r.fx[k]) > 0));
  }
  function types() {
    const t = model.def && model.def.types;
    return Array.isArray(t) && t.length ? t : DEFAULT_TYPES;
  }
  const typeLabel = (id) => { const t = types().find((x) => x.id === id); return t ? t.label : s(id); };

  // Normaliza una moneda de costo: la base o cualquiera con tipo de cambio
  // declarado; lo desconocido cae a la base (nunca se inventa un cambio).
  function normCurrency(v) {
    const c = s(v).trim().toUpperCase();
    return c && costCurrencies().indexOf(c) !== -1 ? c : rules().currency;
  }
  // Costo llevado a la moneda base. Si la moneda del componente no es la base
  // y tiene tipo de cambio, se convierte; si no, se toma tal cual.
  function costBase(cost, currency) {
    const r = rules();
    const c = s(currency).trim().toUpperCase();
    if (!c || c === r.currency) return num(cost);
    const rate = num(r.fx[c], 0);
    return rate > 0 ? num(cost) * rate : num(cost);
  }
  function marginFor(typeId) {
    const r = rules();
    const m = r.marginByType[typeId];
    return m == null || m === '' ? r.marginDefaultPct : num(m, r.marginDefaultPct);
  }
  // Aplica el margen según la base configurada en las reglas:
  //  - 'cost' (sobre costo / markup):  venta = costo × (1 + m%)
  //  - 'sale' (sobre venta):           venta = costo ÷ (1 − m%)  [m% tope 95]
  function marginApplied(baseCost, pct) {
    const p = num(pct) / 100;
    if (rules().marginBasis === 'sale') return baseCost / (1 - Math.min(Math.max(p, 0), 0.95));
    return baseCost * (1 + p);
  }
  // Costo neto en moneda base: costo de proveedor (convertido si viene en otra
  // moneda) + impuesto adicional % (aduana/importación, servicio externo…).
  function componentNetCost(c) {
    return costBase(c.cost, c.currency) * (1 + Math.max(0, num(c.taxPct)) / 100);
  }
  // Precio bruto de venta de un componente (sin redondear): margen del tipo +
  // impuesto de venta.
  function componentGross(c) {
    return marginApplied(componentNetCost(c), marginFor(c.type)) * (1 + rules().salesTaxPct / 100);
  }
  const roundStep = (x, step) => Math.round(x / step) * step;
  function componentSale(c) { return roundStep(componentGross(c), rules().deltaRoundTo); }
  // Redondeo del precio final, parametrizable:
  //  none    → sin redondeo (solo entero)
  //  nearest → al múltiplo más cercano de roundTo
  //  up      → hacia arriba al múltiplo de roundTo
  //  ending  → el menor precio terminado en roundEnding que sea >= x
  //            (ej. roundTo 1000 + roundEnding 990 = precios .990)
  function roundFinal(x) {
    const r = rules();
    const to = Math.max(1, r.roundTo);
    if (r.roundMode === 'nearest') return Math.round(x / to) * to;
    if (r.roundMode === 'up') return Math.ceil(x / to) * to;
    if (r.roundMode === 'ending') {
      const e = Math.min(Math.max(0, r.roundEnding), to - 1);
      return Math.max(e, Math.ceil((x - e) / to) * to + e);
    }
    return Math.round(x);
  }

  const compById = (id) => model.components.find((c) => c.id === id) || null;
  // Disponible = activo y con stock (stock vacío/null = sin control de stock).
  function compAvailable(c) { return !!c && c.active !== false && (c.stock == null || num(c.stock) > 0); }

  // ── Valores genéricos con pool de alternativas ────────────────────────────
  // Cada paso tiene VALORES genéricos que ve el cliente ("Roble natural", sin
  // marca) y cada valor un pool de componentes ALTERNATIVOS de distintos
  // proveedores/marcas que se COMPLEMENTAN: al calcular, siempre se usa la
  // alternativa más económica DISPONIBLE (activa y con stock) — mejor precio
  // y disponibilidad continua. Sus specs/imagen alimentan el detalle público.
  function groupValues(g) { return Array.isArray(g.values) ? g.values : []; }
  /**
   * Un paso puede ser COMPONENTE BASE (g.baseStep): forma parte del armado
   * pero el cliente no elige — no crea opción ni variantes en Jumpseller y
   * su valor por defecto suma SIEMPRE al precio (como los componentes base
   * clásicos). Los personalizables son los que publican opciones.
   */
  function gruposPersonalizables(eq) { return (eq.groups || []).filter((g) => g && g.baseStep !== true); }
  /**
   * Pool efectivo de componentes de un valor: los declarados MÁS los
   * ALTERNATIVOS enlazados de cada uno (Componentes → Alternativos), salvo
   * que el componente esté en `v.soloExacto` (no acepta sustitutos). Los
   * alternativos son del mismo tipo, así que caen solos en la regla de
   * siempre: mismo tipo = alternativas (gana el más barato disponible),
   * tipos distintos se suman. Precio, stock, entrega y publicación lo
   * heredan sin tocar nada más.
   */
  function valueAlts(v) {
    const out = [];
    const vistos = new Set();
    const solo = (v && Array.isArray(v.soloExacto)) ? v.soloExacto : [];
    (v.componentIds || []).forEach((id) => {
      const c = compById(id);
      if (!c || vistos.has(c.id)) return;
      vistos.add(c.id); out.push(c);
      if (solo.indexOf(id) !== -1) return;
      (c.altIds || []).forEach((aid) => {
        const a = compById(aid);
        if (a && !vistos.has(a.id)) { vistos.add(a.id); out.push(a); }
      });
    });
    return out;
  }
  // CANTIDAD del valor (ProductLab): cuántas unidades del componente elegido
  // incluye (ej. "16GB (2×8)" con qty 2 usa dos módulos → precio ×2 y stock
  // exigido ×2). Permite ofrecer 2×8 y 2×16 en un mismo paso reutilizando el
  // mismo pool de alternativas. Default 1.
  function valueQty(v) { return Math.max(1, Math.round(num(v && v.qty, 1)) || 1); }
  // Disponible para una cantidad: activo y con stock suficiente (null = sin control).
  function compAvailableQty(c, qty) { return !!c && c.active !== false && (c.stock == null || num(c.stock) >= Math.max(1, qty)); }
  // Un valor SIN componentes asignados es una opción que NO agrega costo:
  // elegir un acabado, un color o una terminación que vale lo mismo. Siempre
  // está disponible y suma 0 (más su recargo si lo declara). Es un caso
  // distinto —y legítimo— del valor que SÍ declara alternativas pero las
  // tiene todas inactivas o sin stock, que sigue quedando fuera de la tienda.
  function valueIsFree(v) { return !((v.componentIds || []).length); }
  /**
   * CONJUNTO: qué incluye de verdad un valor bundle.
   *
   * Regla: los componentes de TIPOS DISTINTOS se suman, y dentro de un mismo
   * tipo son ALTERNATIVAS entre sí (se usa la más económica disponible). Así
   * "Pack extra → teclado + mouse" lleva varios teclados y varios mouse como
   * alternativas, y el precio es min(teclados) + min(mouse). Si algún tipo se
   * queda sin alternativas disponibles, el valor entero no está disponible.
   */
  function bundleComps(v) {
    const q = valueQty(v);
    const porTipo = new Map();
    valueAlts(v).forEach((c) => {
      const k = c.type || 'other';
      if (!porTipo.has(k)) porTipo.set(k, []);
      porTipo.get(k).push(c);
    });
    const out = [];
    for (const [, lista] of porTipo) {
      const avail = lista.filter((c) => compAvailableQty(c, q));
      if (!avail.length) return null;   // un tipo sin stock tumba el conjunto
      out.push(avail.reduce((best, c) => (componentGross(c) < componentGross(best) ? c : best), avail[0]));
    }
    return out;
  }
  function valueChosen(v) {
    if (v && v.bundle === true) { const bc = bundleComps(v); return bc ? bc[0] : null; }
    const q = valueQty(v);
    const avail = valueAlts(v).filter((c) => compAvailableQty(c, q));
    if (!avail.length) return null;
    return avail.reduce((best, c) => (componentGross(c) < componentGross(best) ? c : best), avail[0]);
  }
  /**
   * Componentes que este valor INCLUYE de verdad: en conjunto, uno por tipo
   * (el más económico); en alternativas, solo el elegido.
   */
  function valueComps(v) {
    if (v && v.bundle === true) return bundleComps(v) || [];
    const c = valueChosen(v);
    return c ? [c] : [];
  }
  // Días de entrega del valor: en conjunto manda el componente más lento.
  function valueDeliveryDays(v) {
    const comps = valueComps(v);
    return comps.reduce((m, c) => Math.max(m, num(c.deliveryDays, 0)), 0);
  }
  // Recargo manual del valor: precio de venta que se suma directamente, sin
  // necesidad de modelar un componente. Es la vía simple para "precios por
  // paso" cuando el costo no se lleva en detalle.
  function valueGross(v) {
    const manual = num(v && v.priceDelta, 0);
    if (valueIsFree(v)) return manual;
    if (v.bundle === true) {
      // Conjunto: un componente POR TIPO (el más económico disponible de cada
      // uno), sumados. Dentro del mismo tipo son alternativas.
      const bc = bundleComps(v);
      if (!bc) return null;   // algún tipo sin alternativas disponibles
      return bc.reduce((a, c) => a + componentGross(c) * valueQty(v), 0) + manual;
    }
    const c = valueChosen(v);
    return c ? componentGross(c) * valueQty(v) + manual : null;
  }
  function valueSale(v) { const g = valueGross(v); return g == null ? null : roundStep(g, rules().deltaRoundTo); }
  function valueAvailable(v) { return valueIsFree(v) || valueChosen(v) != null; }
  /**
   * COMODÍN de un paso dependiente. Cuando el paso está oculto, Jumpseller
   * igual exige un valor de esa opción en la variante: este es ese valor, no
   * cuesta nada y NO existe para el usuario — se sintetiza al aplicar y al
   * publicar, y la ficha jamás lo ofrece. (Antes había que crearlo a mano
   * como "No aplica" + "solo relleno": nadie entendía qué era ni por qué.)
   * Si el paso ya trae un valor marcado fallback (datos antiguos), se usa ese.
   */
  function comodinDe(g) {
    const propio = groupValues(g).find((v) => v.fallback === true);
    if (propio) return propio;
    return { id: 'na::' + g.id, label: 'No aplica', componentIds: [], qty: 1, priceDelta: 0, fallback: true, sintetico: true };
  }
  function groupDefaultValue(g) {
    const vals = groupValues(g).filter(valueAvailable);
    return vals.find((v) => v.id === g.defaultValueId) || vals[0] || null;
  }

  // ── Dependencias entre pasos (ProductLab) ─────────────────────────────────
  // Un paso puede depender de un paso ANTERIOR: solo se muestra en la tienda
  // si la selección de ese paso está en dependsOn.valueIds (ej: "Tarjeta de
  // video" solo con la placa que la admite). Oculto = el configurador fuerza
  // su valor por defecto — conviene que ese default sea un valor SIN costo
  // (componentIds: [] y sin recargo), para no cobrar lo que no se ve. Las
  // variantes siguen siendo el producto cartesiano completo (Jumpseller exige
  // un valor por opción en cada variante): las combinaciones imposibles
  // existen pero el cliente nunca puede seleccionarlas.
  function groupDependsOn(g) {
    const d = g && g.dependsOn;
    return d && d.stepId && Array.isArray(d.valueIds) && d.valueIds.length ? d : null;
  }
  // Sanea dependencias al guardar: solo un paso ANTERIOR (sin ciclos) y solo
  // valores existentes; lo inválido se descarta en silencio.
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
  // manuales (confección, montaje, embalaje) usan rules.marginBasePct.
  function baseBreakdown(eq) {
    const r = rules();
    const comps = (eq.baseComponentIds || []).map(compById).filter(Boolean);
    const extras = (Array.isArray(eq.extraCosts) ? eq.extraCosts : []).filter((x) => x && num(x.cost) > 0);
    let gross = 0;
    comps.forEach((c) => { gross += componentGross(c); });
    extras.forEach((x) => { gross += marginApplied(costBase(x.cost, x.currency), r.marginBasePct) * (1 + r.salesTaxPct / 100); });
    return { comps, extras, gross };
  }
  // ── Modo de precio ────────────────────────────────────────────────────────
  // Calcular desde costos es UNA forma de fijar el precio, no la única. Hay
  // productos (packs, precio de lista, promociones) donde el precio se decide
  // y el detalle de costos es opcional o vive en otro lado:
  //   auto  → desde los costos y las reglas de margen (comportamiento clásico)
  //   fixed → precio escrito a mano, exacto (no se redondea)
  //   store → el precio que ya tiene el producto en la app Productos/Jumpseller
  // En fixed y store el precio corresponde a la configuración POR DEFECTO; si
  // algún valor tiene recargo, se suma la DIFERENCIA contra el valor por
  // defecto de su paso (sin recargos, todas las combinaciones valen igual).
  const PRICE_MODES = ['auto', 'fixed', 'store'];
  const priceModeOf = (eq) => (PRICE_MODES.indexOf(eq && eq.priceMode) !== -1 ? eq.priceMode : 'auto');
  const isFixedPrice = (eq) => priceModeOf(eq) !== 'auto';
  // Precio del producto enlazado en la app Productos (lo que ya cobra la
  // tienda). Si el catálogo aún no cargó, usa la última copia conocida.
  function storeCatalogPrice(eq) {
    const it = productItemFor(eq);
    const live = it && it.price != null ? num(it.price) : null;
    if (live != null && live > 0) return live;
    // Sin precio vivo (el catálogo aún no cargó, o el enlace no resuelve) NO
    // se cae a 0: eso convertía un dato que todavía no llegó en un precio
    // real, que luego se persistía al guardar. Manda el último precio
    // conocido del producto, y solo si tampoco hay, el fijo.
    const fijo = num(eq && eq.fixedPrice, 0);
    if (fijo > 0) return fijo;
    return num(eq && eq.price, 0);
  }
  function basePriceOf(eq) {
    return priceModeOf(eq) === 'store' ? Math.round(storeCatalogPrice(eq)) : Math.round(num(eq && eq.fixedPrice, 0));
  }
  // Recargo de un valor respecto al valor por defecto de su paso.
  function valueExtra(eq, g, v) {
    const vg = valueGross(v) || 0;
    if (!isFixedPrice(eq)) return vg;
    const dv = groupDefaultValue(g);
    return vg - (dv ? (valueGross(dv) || 0) : 0);
  }
  function productoComputedPrice(eq) {
    if (isFixedPrice(eq)) return basePriceOf(eq); // el default vale exactamente lo fijado
    let gross = baseBreakdown(eq).gross;
    // Selección por defecto, para saber qué pasos dependientes están OCULTOS
    // en la configuración base: esos no suman nada (su comodín vale 0).
    const selDef = {};
    (eq.groups || []).forEach((g) => { const dv = groupDefaultValue(g); if (dv) selDef[g.id] = dv.id; });
    (eq.groups || []).forEach((g) => {
      if (!groupVisibleFor(eq, g, selDef)) return;
      const dv = groupDefaultValue(g);
      const vg = dv ? valueGross(dv) : null;
      if (vg != null) gross += vg;
    });
    return roundFinal(gross);
  }
  function deltaFor(g, v, eq) {
    // Con precio fijo no hay recargos que mostrar en la tienda.
    if (isFixedPrice(eq)) return 0;
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
    return acc + numOr(eq.deliveryExtraDays, r.leadTimeDays);
  }

  // ── Compatibilidades ──────────────────────────────────────────────────────
  // Cada componente declara: tags (lo que aporta, ej. "material:roble"),
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
        // Sin componentes = opción que no agrega costo (perfectamente válida).
        // Solo se avisa cuando SÍ hay alternativas pero ninguna utilizable.
        if (valueAlts(v).length && !valueAvailable(v)) warns.push('El valor "' + v.label + '" de "' + label + '" quedó sin alternativas disponibles (inactivas o con stock menor a su cantidad ×' + valueQty(v) + '): se excluirá de la tienda.');
      });
      const dv = groupDefaultValue(g);
      if (dv) valueComps(dv).forEach((c) => chosenSet.push(c));
      else warns.push('El paso "' + label + '" no tiene ningún valor disponible.');
      // Pasos dependientes: cuando el paso queda oculto, la tienda cobra su
      // default igual — si ese default tiene precio, se recarga sin verse.
      const dep = groupDependsOn(g);
      if (dep) {
        const target = (eq.groups || []).find((x) => x.id === dep.stepId);
        if (!target) warns.push('El paso dependiente "' + label + '" apunta a un paso que ya no existe (la dependencia se descartará al guardar).');
        else {
          const dvg = dv ? valueGross(dv) : null;
          const nOrden = (eq.groups || []).indexOf(g) + 1;
          const nombreDe = (x) => (x.label || typeLabel(x.typeId));
          void dv; void nOrden; void nombreDe;
        }
      }
    });
    // Aviso heredado de computadores (mantenimiento pesado sobre 150 variantes).
    const n = comboCount(eq);
    if (n > WARN_COMBOS && n <= MAX_COMBOS) {
      warns.push('El producto publica ' + n + ' variantes (aviso sobre ' + WARN_COMBOS + '): la sincronización con la tienda se vuelve pesada y la ficha carga más lento. '
        + 'Considera reducir alternativas por paso, dividir el producto o usar pasos dependientes — las combinaciones imposibles ya no se publican.');
    }
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
      currency: normCurrency(draft.currency),
      cost: num(draft.cost, 0),
      // Impuesto adicional % que se SUMA al costo (aduana/importación); 0 = sin impuesto.
      taxPct: Math.max(0, num(draft.taxPct, 0)),
      supplierName: s(draft.supplierName).trim(),
      supplierUrl: s(draft.supplierUrl).trim(),
      verifiedAt: draft.verifiedAt || null,
      deliveryDays: num(draft.deliveryDays, 0),
      // stock: número = unidades disponibles (0 = no elegible); null = sin control
      stock: draft.stock === '' || draft.stock == null ? null : Math.max(0, num(draft.stock, 0)),
      // storeRef: presente si el componente ES un producto de la tienda
      storeRef: draft.storeRef && draft.storeRef.itemId ? draft.storeRef : null,
      tags: Array.isArray(draft.tags) ? draft.tags : parseList(draft.tags),
      requires: Array.isArray(draft.requires) ? draft.requires : parseList(draft.requires),
      excludes: Array.isArray(draft.excludes) ? draft.excludes : parseList(draft.excludes),
      // Componentes ALTERNATIVOS entre sí (mismo rol, distinto proveedor).
      // El enlace es SIMÉTRICO: saveComponent lo replica en el otro extremo.
      altIds: Array.isArray(draft.altIds) ? draft.altIds.filter((x) => x && x !== draft.id) : [],
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
    // Alternativos SIMÉTRICOS: los agregados me suman en su lista y los
    // quitados me borran de la suya (el enlace vive en ambos extremos).
    const prevAlt = (model.components.find((c) => c.id === item.id) || {}).altIds || [];
    const nuevos = item.altIds.filter((x) => prevAlt.indexOf(x) === -1);
    const idos = prevAlt.filter((x) => item.altIds.indexOf(x) === -1);
    const espejo = model.components
      .filter((c) => nuevos.indexOf(c.id) !== -1 || idos.indexOf(c.id) !== -1)
      .map((c) => normalizeComponent(Object.assign({}, c, {
        altIds: nuevos.indexOf(c.id) !== -1
          ? ((c.altIds || []).indexOf(item.id) === -1 ? (c.altIds || []).concat([item.id]) : c.altIds)
          : (c.altIds || []).filter((x) => x !== item.id),
      })));
    setModel({ components: (isNew ? model.components.concat([item]) : model.components.map((c) => (c.id === item.id ? item : c)))
      .map((c) => espejo.find((e) => e.id === c.id) || c) });
    try {
      if (isNew) await shell.items.create(item); else await shell.items.update(item.id, item);
      for (const e of espejo) await shell.items.update(e.id, e);
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
  // storeRef enlaza al item de producto de la app `products`:
  //   { instanceId, itemId, sourceId (id Jumpseller o null), sku, name, imageUrl }
  function storeRefOf(eq) {
    const r = eq && eq.storeRef;
    return r && r.instanceId && r.itemId ? r : null;
  }
  // Item de producto VIVO desde el catálogo de la app products (si está cargado).
  function productItemFor(eq) {
    const ref = storeRefOf(eq);
    return ref ? model.catalog.find((p) => p && p.id === ref.itemId) || null : null;
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
  // Todas las fotos de la galería del producto enlazado (pull de products);
  // fallback a la principal si el backend aún no expone images[].
  function productImagesFor(eq) {
    const p = productItemFor(eq);
    if (!p) return [];
    if (Array.isArray(p.images) && p.images.length) return p.images.filter(Boolean).map((u) => String(u));
    return p.imageUrl ? [String(p.imageUrl)] : [];
  }
  // Descripción del producto EN LA TIENDA (pull de products). No se copia a la
  // app: se lee viva, así editarla en Jumpseller no obliga a tocar nada aquí.
  function productDescriptionFor(eq) {
    const p = productItemFor(eq);
    return s((p && (p.description || p.body)) || '');
  }
  // Las descripciones de la tienda vienen en HTML. Para previsualizar y para
  // recortar a N caracteres se pasa a texto plano: cortar el HTML a pelo
  // dejaría etiquetas abiertas.
  function descriptionText(html, max) {
    let t = s(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (max > 0 && t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
    return t;
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
  // ── Estilo de la ficha en la tienda ───────────────────────────────────────
  // Un solo normalizador para los dos sitios donde vive un estilo: el del
  // producto y el de una PLANTILLA del catálogo. Así lo que se guarda, lo que
  // se previsualiza y lo que se publica tienen exactamente la misma forma.
  function normalizeStyle(raw) {
    const st = (raw && typeof raw === 'object') ? raw : {};
    return {
      accentColor: s(st.accentColor).trim(),
      bgColor: s(st.bgColor).trim(),
      radius: Math.max(0, Math.min(24, num(st.radius, 0))),
      cardStyle: ['list', 'compact'].indexOf(st.cardStyle) !== -1 ? st.cardStyle : 'cards',
      // Ancho del configurador y de las secciones en la tienda:
      //  'auto'      → se mide el contenedor del theme y se alinea a él
      //  'container' → igual que 'auto' pero forzado (aunque no se detecte)
      //  'full'      → a todo el ancho de la página
      width: ['container', 'full'].indexOf(st.width) !== -1 ? st.width : 'auto',
      // Barra superior (pestañas + precio + botón): todo configurable, para
      // que encaje con el diseño de cada tienda sin tocar CSS.
      bar: (function () {
        const b = (st.bar && typeof st.bar === 'object') ? st.bar : {};
        return {
          bgColor: s(b.bgColor).trim(),      // vacío = fondo del configurador
          textColor: s(b.textColor).trim(),  // vacío = automático por contraste
          width: ['container', 'full'].indexOf(b.width) !== -1 ? b.width : 'auto',
          sticky: b.sticky !== false,        // se queda pegada al bajar
          // Separación extra bajo el header del theme (px). El alto del
          // header se mide solo; esto es un ajuste fino encima.
          offset: Math.max(-200, Math.min(400, num(b.offset, 0))),
          // Pestañas secundarias (Especificaciones, Fotos) en móvil: por
          // defecto NO, se amontonan con el precio y engordan la barra.
          mobileTabs: b.mobileTabs === true,
          showPrice: b.showPrice !== false,
          showThumb: b.showThumb !== false,
        };
      })(),
      // Fotos del producto dentro de Explorar (sección "fotos"). Cinco ejes
      // independientes: ancho del bloque, disposición, alto de la foto grande,
      // tamaño de las miniaturas y encaje.
      photos: (function () {
        const f = (st.photos && typeof st.photos === 'object') ? st.photos : {};
        return {
          size: ['s', 'm', 'l', 'xl'].indexOf(f.size) !== -1 ? f.size : 'm',
          cols: Math.max(0, Math.min(6, num(f.cols, 0))),   // 0 = automático
          // visor = foto grande + miniaturas debajo · lado = miniaturas en
          // columna a la izquierda · mosaico = solo la grilla, sin visor
          layout: ['lado', 'mosaico'].indexOf(f.layout) !== -1 ? f.layout : 'visor',
          mainSize: ['s', 'l', 'xl', 'auto'].indexOf(f.mainSize) !== -1 ? f.mainSize : 'm',
          thumbSize: ['s', 'l'].indexOf(f.thumbSize) !== -1 ? f.thumbSize : 'm',
          // contain = la foto entera · cover = recortada a un formato común
          fit: f.fit === 'cover' ? 'cover' : 'contain',
          frame: f.frame !== false,   // caja gris con filete alrededor
        };
      })(),
      showDeltas: ['total', 'none'].indexOf(st.showDeltas) !== -1 ? st.showDeltas : 'delta',
      stepsCollapsed: st.stepsCollapsed === true,
      // Texto del botón de la barra que lleva al configurador ("Comprar",
      // "Personalizar", "Armar el mío"…). Va en el ESTILO para poder cambiarlo
      // de una vez en todos los productos que comparten plantilla; cada
      // producto puede pisarlo con storefront.tabs.comprar.
      buyLabel: s(st.buyLabel).trim(),
      // Color del spinner de carga (vacío = el acento). Se ve antes que nada
      // en la tienda, así que merece poder fijarse aparte.
      spinnerColor: s(st.spinnerColor).trim(),
    };
  }

  // Plantillas de estilo del CATÁLOGO: un mismo look (colores, barra, fotos,
  // anchos) reutilizable en muchos productos. Sin esto había que repetir la
  // misma configuración producto a producto.
  function styleTemplates() {
    const raw = (model.def && Array.isArray(model.def.styleTemplates)) ? model.def.styleTemplates : [];
    return raw.map((t) => ({
      id: s(t && t.id).trim() || newId('sty'),
      name: s(t && t.name).trim() || 'Plantilla',
      style: normalizeStyle(t && t.style),
    })).filter((t) => t.name);
  }
  function styleTemplateById(id) {
    const k = s(id).trim();
    if (!k) return null;
    return styleTemplates().find((t) => t.id === k) || null;
  }
  // Plantilla que rige por defecto en TODO el catálogo (los productos que no
  // eligen ninguna). Vacío = cada producto con su estilo propio.
  function defaultStyleTemplate() {
    return styleTemplateById((model.def || {}).styleDefaultId);
  }
  /**
   * Estilo EFECTIVO de un producto: el de su plantilla si usa una (la suya o
   * la del catálogo), y si no el suyo propio. Una plantilla se aplica entera
   * — es un look completo, no una mezcla campo a campo — y el producto puede
   * desengancharse en cualquier momento copiándola a su estilo propio.
   */
  function resolveStyle(eq) {
    const sf = (eq && eq.storefront) || {};
    const elegido = s(sf.styleId).trim();
    if (elegido === 'own') return normalizeStyle(sf.style);       // propio, explícito
    const t = elegido ? styleTemplateById(elegido) : defaultStyleTemplate();
    return t ? t.style : normalizeStyle(sf.style);
  }
  // Nombre de lo que rige, para decirlo en la interfaz sin adivinar.
  function styleSourceLabel(eq) {
    const sf = (eq && eq.storefront) || {};
    const elegido = s(sf.styleId).trim();
    if (elegido === 'own') return 'estilo propio';
    if (elegido) {
      const t = styleTemplateById(elegido);
      return t ? 'plantilla «' + t.name + '»' : 'plantilla eliminada → estilo propio';
    }
    const d = defaultStyleTemplate();
    return d ? 'plantilla del catálogo «' + d.name + '»' : 'estilo propio';
  }

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
        eq.extraCosts.push({ id: newId('ec'), label: 'Costo base (migrado)', cost: num(eq.base.cost), currency: normCurrency(eq.base.currency) });
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
    { id: 'description', label: 'Descripción del producto', chip: 'DESC' },
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
      color: s(b.color).trim(),
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
    // Descripción: el texto que ya tiene el producto en la tienda. No se copia
    // aquí (seguiría al día sola), solo se decide dónde y cómo mostrarla.
    if (b.type === 'description') return Object.assign(base, {
      size: ['xl', 'l', 's'].indexOf(b.size) !== -1 ? b.size : 'm',
      max: Math.max(0, num(b.max, 0)),
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
      // Ancho propio de este hero (independiente del resto de la ficha).
      width: ['container', 'full'].indexOf(hx.width) !== -1 ? hx.width : 'auto',
      bgColor: s(hx.bgColor).trim(),
      bgImageUrl: s(hx.bgImageUrl).trim(),
      textColor: s(hx.textColor).trim(),
      overlay: hx.overlay !== false,
      slots,
    };
  }

  // Hero de arranque. Un producto recién creado no tiene ninguna sección hero,
  // así que la pestaña Explorar de la tienda sale vacía y la ficha se ve a
  // medias justo cuando el producto acaba de quedar listo. Se siembra uno
  // usable —nombre, descripción real de la tienda, foto y botón Configurar—
  // que el usuario edita o borra; con `heroSeeded` esto ocurre UNA sola vez,
  // de modo que borrarlos todos a propósito no lo hace reaparecer.
  function starterHero() {
    return normalizePageSection({
      kind: 'hero', pattern: 'columnas', height: 'l', overlay: true,
      slots: {
        left: [
          { type: 'title', align: 'left' },
          { type: 'description', align: 'left', size: 'm', max: 320 },
          { type: 'cta', align: 'left', label: 'Configurar', action: 'configurar' },
        ],
        right: [{ type: 'photo', size: 'l', anim: 'float' }],
      },
    });
  }

  // Sección del builder de descripción: hero (patrón + bloques), la tabla de
  // especificaciones o la nota — reordenables; specs/nota se ocultan con show.
  // Ancho de una sección en la tienda, independiente del resto:
  //  ''|'auto' → el del configurador (Ficha → Estilo → Ancho en la tienda)
  //  'container' → centrado como el contenido del theme
  //  'full'      → borde a borde de la ventana
  const sectionWidth = (w) => (['container', 'full'].indexOf(w) !== -1 ? w : 'auto');
  function normalizePageSection(x) {
    if (!x || typeof x !== 'object') return null;
    if (x.kind === 'specs' || x.kind === 'note' || x.kind === 'fotos') {
      return { id: x.id || newId('ps'), kind: x.kind, show: x.show !== false, width: sectionWidth(x.width) };
    }
    // Sección IMAGEN (ProductLab): solo una foto, a lo ancho, cuyo ALTO se
    // adapta a la imagen (sin recortes) — ideal para descripciones hechas de
    // muchas fotos apiladas con alturas distintas. Repetible, como los heros.
    if (x.kind === 'imagen') {
      return {
        id: x.id || newId('ps'),
        kind: 'imagen',
        imageUrl: s(x.imageUrl).trim(),
        alt: s(x.alt).trim(),
        // 'content' se mantiene como alias histórico de 'container'.
        width: x.width === 'full' ? 'full' : (x.width === 'container' || x.width === 'content' ? 'container' : 'auto'),
        link: s(x.link).trim(),
      };
    }
    const hx = normalizeHero(x);
    return hx ? Object.assign({ kind: 'hero' }, hx) : null;
  }

  // ── Visor 3D (OPCIONAL) ───────────────────────────────────────────────────
  // Un producto puede declarar un modelo 3D para previsualizar la
  // configuración en vivo. Es opcional de punta a punta: sin `model3d.url` la
  // app se comporta exactamente igual que sin 3D, no aparece ninguna UI extra
  // y el motor (three.js, ~155 KB gzip) NUNCA se descarga.
  //
  //   model3d = {
  //     enabled, url, rotation:[x,y,z], mirror, publish,
  //     parts:    [{ id, label, materials:[nombres del GLB], defaultColor,
  //                  defaultFinish, roughness, grainVertical, grainAngle }],
  //     finishes: [{ id, label, color, texture, roughness, textureScale,
  //                  grain, opacity, triplanar, plySpacing }],
  //   }
  //
  // y cada VALOR de un paso puede llevar efectos sobre el modelo:
  //   value.model3d = [{ partId, type: 'color'|'finish'|'hide', color, finishId }]
  const EFFECT_TYPES = ['color', 'finish', 'hide'];
  // Como parseList() pero SIN pasar a minúsculas: los nombres de material del
  // GLB distinguen mayúsculas y deben conservarse tal cual.
  const toList = (v) => (Array.isArray(v) ? v : s(v).split(',')).map((x) => s(x).trim()).filter(Boolean);

  function normalizeEffects(list) {
    if (!Array.isArray(list)) return [];
    return list.map((e) => {
      if (!e || typeof e !== 'object') return null;
      const partId = s(e.partId).trim();
      if (!partId) return null;
      const type = EFFECT_TYPES.indexOf(e.type) !== -1 ? e.type : 'color';
      const out = { partId, type };
      if (type === 'color') out.color = s(e.color).trim();
      if (type === 'finish') out.finishId = s(e.finishId).trim();
      return out;
    }).filter(Boolean);
  }

  function normalizeModel3d(m) {
    if (!m || typeof m !== 'object') return null;
    const url = s(m.url).trim();
    const parts = (Array.isArray(m.parts) ? m.parts : []).map((p) => ({
      id: s(p.id).trim() || newId('part'),
      label: s(p.label).trim(),
      materials: toList(p.materials),
      defaultColor: s(p.defaultColor).trim(),
      defaultFinish: s(p.defaultFinish).trim(),
      roughness: p.roughness == null || p.roughness === '' ? null : num(p.roughness, 0.85),
      grainVertical: p.grainVertical === true,
      grainAngle: num(p.grainAngle, 0),
      // Materiales de esta parte cuya veta corre A LO LARGO (anulan vertical
      // y ángulo): ej. el travesaño de una mesa frente a sus patas.
      grainAlongMaterials: toList(p.grainAlongMaterials),
    })).filter((p) => p.materials.length);
    const finishes = (Array.isArray(m.finishes) ? m.finishes : []).map((f) => ({
      id: s(f.id).trim() || newId('fin'),
      label: s(f.label).trim(),
      color: s(f.color).trim(),
      texture: s(f.texture).trim(),
      roughness: num(f.roughness, 0.8),
      textureScale: num(f.textureScale, 1),
      grain: num(f.grain, 0),
      opacity: f.opacity == null || f.opacity === '' ? 1 : num(f.opacity, 1),
      triplanar: f.triplanar !== false,
      plySpacing: f.plySpacing == null || f.plySpacing === '' ? null : num(f.plySpacing, 0),
    })).filter((f) => f.label || f.texture || f.color);
    // Sin modelo ni partes no hay nada que guardar: se deja limpio.
    if (!url && !parts.length) return null;
    return {
      enabled: m.enabled !== false,
      url,
      rotation: Array.isArray(m.rotation) && m.rotation.length === 3 ? m.rotation.map((x) => num(x, 0)) : [0, 0, 0],
      mirror: m.mirror === true,
      publish: m.publish === true,
      // Medida real del lado más largo, en cm. El visor normaliza el modelo a
      // un tamaño arbitrario para encuadrarlo, así que sin este dato la
      // realidad aumentada no sabría a qué escala apoyarlo en el suelo. 0 =
      // sin declarar → no se ofrece AR.
      realSizeCm: Math.max(0, num(m.realSizeCm, 0)),
      // .glb a escala real para Google Scene Viewer (Android). Lo genera y
      // sube la app desde el visor: Scene Viewer lo abre el SISTEMA con un
      // intent, así que necesita una URL pública — un blob del navegador no
      // le sirve.
      arUrl: s(m.arUrl).trim(),
      parts,
      finishes,
    };
  }

  // Modelo utilizable (existe, activo y con archivo) o null.
  function model3dOf(eq) {
    const m = eq && eq.model3d;
    return m && m.enabled !== false && s(m.url).trim() ? m : null;
  }
  const has3d = (eq) => model3dOf(eq) != null;

  // Estado del visor para una SELECCIÓN de valores ({grupoId: valorId}).
  // Sin selección, usa el valor por defecto de cada paso — o sea, el producto
  // tal como se ve "de fábrica".
  function build3dState(eq, selection) {
    const st = { colors: {}, finishes: {}, hidden: {} };
    if (!model3dOf(eq)) return st;
    (eq.groups || []).forEach((g) => {
      const sel = selection && selection[g.id];
      const v = groupValues(g).find((x) => x.id === sel) || groupDefaultValue(g);
      if (!v) return;
      (v.model3d || []).forEach((e) => {
        if (e.type === 'color') st.colors[e.partId] = e.color;
        else if (e.type === 'finish') st.finishes[e.partId] = e.finishId;
        else if (e.type === 'hide') st.hidden[e.partId] = true;
      });
    });
    return st;
  }

  async function saveProducto(draft) {
    // Un producto NUEVO no puede nacer en $0. El modo por defecto ("calculado
    // desde los costos") da 0 mientras no haya componentes cargados, y ese 0
    // se guardaba y se mostraba en la lista como si fuera un precio de verdad.
    // Si el producto ya está enlazado a uno de la tienda que sí tiene precio,
    // se arranca en modo "precio de la tienda": hereda el que ya cobra.
    const modoInicial = (function () {
      if (draft.priceMode) return priceModeOf(draft);
      if (model.productos.some((e) => e.id === draft.id)) return 'auto';
      const p = productItemFor(draft);
      return p && num(p.price) > 0 ? 'store' : 'auto';
    })();
    const item = Object.assign({}, normalizeProductoShape(draft), {
      id: draft.id || newId('eq'),
      kind: 'producto',
      name: s(draft.name).trim(),
      sku: s(draft.sku).trim(),
      storeUrl: s(draft.storeUrl).trim(),
      deliveryMode: draft.deliveryMode === 'sum' ? 'sum' : 'max',
      // Modo de precio: auto (desde costos) | fixed (a mano) | store (el que
      // ya tiene el producto en la app Productos/Jumpseller).
      priceMode: modoInicial,
      fixedPrice: Math.max(0, num(draft.fixedPrice, 0)),
      status: draft.status || 'active',
      createdAt: draft.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    item.baseComponentIds = (item.baseComponentIds || []).filter((id) => compById(id));
    item.extraCosts = (item.extraCosts || [])
      .map((x) => ({ id: x.id || newId('ec'), label: s(x.label).trim() || 'Costo adicional', cost: num(x.cost, 0), currency: normCurrency(x.currency) }))
      .filter((x) => x.cost > 0);
    item.groups = (item.groups || []).map((g) => {
      const values = groupValues(g)
        .map((v) => ({
          id: v.id || newId('val'),
          label: s(v.label).trim(),
          imageUrl: s(v.imageUrl).trim(),
          // Color del "puntito" (swatch) en la tienda para pasos de color.
          swatchColor: s(v.swatchColor).trim(),
          componentIds: (v.componentIds || []).filter((id) => compById(id)),
          // Cantidad de unidades del componente elegido (ej. 2 para "2×8GB");
          // multiplica el precio y exige stock suficiente.
          qty: Math.max(1, Math.round(num(v.qty, 1)) || 1),
          // Recargo manual de venta: permite "precios por paso" sin modelar
          // el costo en detalle. Se suma tal cual al precio.
          priceDelta: num(v.priceDelta, 0),
          // RELLENO: valor que solo existe para las combinaciones en las que
          // este paso está OCULTO (Jumpseller exige un valor de cada opción en
          // cada variante). Cuando el paso se ve, la tienda no lo ofrece: sin
          // esto, marcar "No aplica" como default dejaba comprar un PC sin
          // procesador a quien sí eligió plataforma.
          fallback: v.fallback === true,
          // CONJUNTO: los componentes de este valor se SUMAN en vez de ser
          // alternativas ("Procesador" = CPU + su placa madre, un solo paso).
          bundle: v.bundle === true,
          // Efectos sobre el visor 3D al elegir este valor (opcional: si el
          // producto no tiene modelo, queda vacío y no molesta).
          model3d: normalizeEffects(v.model3d),
        }))
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
    // Visor 3D: opcional. null = este producto simplemente no tiene 3D.
    item.model3d = normalizeModel3d(draft.model3d);
    // Efectos que apunten a partes ya inexistentes se podan solos.
    if (item.model3d) {
      const partIds = item.model3d.parts.map((p) => p.id);
      item.groups.forEach((g) => g.values.forEach((v) => {
        v.model3d = (v.model3d || []).filter((e) => partIds.indexOf(e.partId) !== -1);
      }));
    } else {
      item.groups.forEach((g) => g.values.forEach((v) => { v.model3d = []; }));
    }
    // Ficha de tienda (pestañas Explorar/Especificaciones del theme):
    const sf = draft.storefront || {};
    const hero = sf.hero || {};
    // Secciones de la ficha, con el hero de arranque si aún no hay ninguno.
    const sfSections = (function () {
      const seen = {};
      const out = (Array.isArray(sf.pageSections) ? sf.pageSections : [])
        .map(normalizePageSection).filter(Boolean)
        .filter((x) => ((x.kind === 'hero' || x.kind === 'imagen') ? true : (seen[x.kind] ? false : (seen[x.kind] = true))));
      // Solo la primera vez, y solo si tampoco hay hero clásico con contenido:
      // si el usuario ya escribió titular ahí, sembrar otro sería duplicar.
      const heroClasico = s(hero.headline).trim() || s(hero.bgImageUrl).trim();
      if (sf.heroSeeded !== true && !heroClasico && !out.some((x) => x.kind === 'hero')) {
        const st = starterHero();
        if (st) out.unshift(st);
      }
      if (!seen.specs) out.push({ id: newId('ps'), kind: 'specs', show: true });
      if (!seen.fotos) out.push({ id: newId('ps'), kind: 'fotos', show: true });
      if (!seen.note) out.push({ id: newId('ps'), kind: 'note', show: true });
      return out;
    })();
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
      pageSections: sfSections,
      // Marca de que el hero de arranque ya se sembró: no vuelve a aparecer
      // aunque después se borren todas las secciones hero.
      heroSeeded: sf.heroSeeded === true || sfSections.some((x) => x.kind === 'hero'),
      // Estilo del configurador y la página en la tienda por producto
      // (ProductLab; vacío = colores y tipografías del theme del sitio). El
      // previsualizador de la pestaña Pasos lo refleja en vivo.
      style: normalizeStyle(sf.style),
      // Qué estilo rige en la tienda:
      //   ''     → lo que diga el catálogo (su plantilla por defecto, si hay)
      //   'own'  → el estilo propio de arriba, aunque el catálogo tenga una
      //   <id>   → esa plantilla del catálogo
      styleId: s(sf.styleId).trim(),
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
    // Galería del producto: unión de la biblioteca manual + imágenes en uso.
    item.galleryImages = collectProductoImages(item);
    item.price = productoComputedPrice(item);
    if (!item.name) return { success: false, error: 'El producto requiere nombre.' };
    const isNew = !model.productos.some((e) => e.id === item.id);
    setModel({ productos: isNew ? model.productos.concat([item]) : model.productos.map((e) => (e.id === item.id ? item : e)) });
    try {
      if (isNew) await shell.items.create(item); else await shell.items.update(item.id, item);
      scheduleRepublish();
      return { success: true, message: 'Producto "' + item.name + '" guardado en ' + fmtMoney(item.price) + '.', item };
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
  /**
   * COMBINACIONES ALCANZABLES — el corazón del asunto.
   *
   * El producto cartesiano de todos los pasos genera montañas de variantes que
   * NADIE puede comprar: si "Procesador AMD" solo se ve cuando la plataforma es
   * AMD, todas las combinaciones «Intel × cada procesador AMD» no existen para
   * ningún cliente… pero Jumpseller las crea, las guarda y las recorre en cada
   * carga de la ficha. Con dos plataformas y dos familias de procesador eso es
   * 2×4×4 = 32 variantes de las que solo 6 son reales; con un catálogo de
   * verdad, miles — y ahí es donde la tienda se arrastra.
   *
   * Se recorren los pasos EN ORDEN llevando la selección parcial (las
   * dependencias solo apuntan hacia atrás, así que al llegar a un paso ya se
   * sabe si se ve):
   *   · paso VISIBLE → una rama por cada valor elegible (los de relleno no son
   *     elegibles: solo existen para el caso contrario);
   *   · paso OCULTO  → UNA sola rama, con su valor de relleno (o su default).
   *
   * `tope` corta la exploración: sirve para contar sin quedarse colgado en un
   * producto desmedido, y quien llama sabe que el número viene truncado.
   */
  function enumerarCombos(eq, tope) {
    const limite = Math.max(1, tope || (MAX_COMBOS * 4));
    const pasos = gruposPersonalizables(eq)
      .map((g) => ({ g, label: g.label || typeLabel(g.typeId), vals: groupValues(g).filter(valueAvailable) }))
      .filter((x) => x.vals.length > 0);
    if (!pasos.length) return { combos: [], truncado: false };
    const out = [];
    let truncado = false;
    const baja = (i, sel, opts, extra) => {
      if (truncado) return;
      if (i >= pasos.length) {
        if (out.length >= limite) { truncado = true; return; }
        out.push({ opts, extra, sel });
        return;
      }
      const paso = pasos[i];
      const visible = groupVisibleFor(eq, paso.g, sel);
      let ramas;
      if (visible) {
        // Los rellenos NO se ofrecen; si por lo que fuera todos lo son, se
        // usan igualmente antes que dejar el paso sin ninguna rama.
        ramas = paso.vals.filter((v) => v.fallback !== true);
        if (!ramas.length) ramas = paso.vals;
      } else {
        // Oculto → el comodín, que no suma nada. Se gestiona solo.
        ramas = [comodinDe(paso.g)];
      }
      ramas.forEach((v) => {
        if (truncado) return;
        const sel2 = Object.assign({}, sel); sel2[paso.g.id] = v.id;
        const opts2 = Object.assign({}, opts); opts2[paso.label] = v.label;
        baja(i + 1, sel2, opts2, extra + (v.sintetico ? 0 : valueExtra(eq, paso.g, v)));
      });
    };
    baja(0, {}, {}, 0);
    // Compatibilidad por tags: una combinación cuyo set de componentes viola
    // un `requiere` o un `incompatible con` no existe para nadie — tampoco se
    // publica. Es la misma regla de checkSet, aplicada combo a combo, y es lo
    // que permite modelar restricciones SIN pasos dependientes: etiqueta los
    // componentes y las combinaciones inválidas desaparecen solas.
    const base = baseBreakdown(eq).comps;
    const porId = new Map();
    (eq.groups || []).forEach((g) => groupValues(g).forEach((v) => porId.set(v.id, v)));
    // Tags que ALGÚN componente del producto aporta. Un `requiere` de un tag
    // que no aporta nadie es una configuración incompleta: se queda en aviso
    // (checkSet ya lo dice) y NO vacía el catálogo. Solo veta el que apunta a
    // un tag real del producto: ahí sí hay combinaciones buenas y malas.
    const aportables = new Set();
    base.forEach((c) => (c.tags || []).forEach((t) => aportables.add(t)));
    porId.forEach((v) => valueAlts(v).forEach((c) => (c.tags || []).forEach((t) => aportables.add(t))));
    const validas = out.filter((c) => {
      const comps = base.slice();
      Object.keys(c.sel).forEach((gid) => {
        const v = porId.get(c.sel[gid]);
        if (v) valueComps(v).forEach((x) => comps.push(x));
      });
      return setCompatible(comps, aportables);
    });
    return { combos: validas, truncado, incompatibles: out.length - validas.length };
  }
  /**
   * ¿El set de componentes es coherente? `incompatible con` veta siempre;
   * `requiere` solo cuando el tag lo aporta algún componente del producto
   * (ver arriba). Versión booleana de checkSet.
   */
  function setCompatible(comps, aportables) {
    for (const c of comps) {
      const otros = new Set();
      comps.forEach((o) => { if (o.id !== c.id) (o.tags || []).forEach((t) => otros.add(t)); });
      for (const t of (c.excludes || [])) if (otros.has(t)) return false;
      for (const t of (c.requires || [])) {
        if (!otros.has(t) && (!aportables || aportables.has(t))) return false;
      }
    }
    return true;
  }
  function comboCount(eq) {
    return enumerarCombos(eq).combos.length;
  }
  // Cuántas variantes ahorra no publicar lo imposible (para decirlo en la app).
  function comboCartesiano(eq) {
    const ns = (eq.groups || []).map((g) => groupValues(g).filter(valueAvailable).length).filter((n) => n > 0);
    return ns.length ? ns.reduce((a, b) => a * b, 1) : 0;
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
    return gruposPersonalizables(eq).map((g) => {
      const label = g.label || typeLabel(g.typeId);
      const ex = exByName.get(norm(label)) || {};
      const exVals = new Map();
      ((ex.values) || []).forEach((v) => { if (v && v.name) exVals.set(norm(v.name), v); });
      // Los valores de la tienda son las ETIQUETAS genéricas (sin marca).
      const lista = groupValues(g).filter(valueAvailable);
      // Paso dependiente: además de sus valores, la opción necesita el comodín
      // (las variantes de las ramas ocultas lo usan). Sintetizado aquí: el
      // usuario no lo crea ni lo ve en la app.
      if (groupDependsOn(g) && !lista.some((v) => v.fallback === true)) lista.push(comodinDe(g));
      const odef = { name: label, optionType: 'option', values: lista.map((v) => {
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
    const fixed = isFixedPrice(eq);
    // Con precio fijo/de tienda se parte del precio decidido; con auto, del
    // costo. En ambos casos cada paso suma lo que corresponda (nada, si los
    // valores no tienen recargo → todas las combinaciones al mismo precio).
    const baseGross = fixed ? basePriceOf(eq) : baseBreakdown(eq).gross;
    const groups = gruposPersonalizables(eq)
      .map((g) => ({ g, label: g.label || typeLabel(g.typeId), vals: groupValues(g).filter(valueAvailable) }))
      .filter((x) => x.vals.length > 0);
    if (!groups.length) return [];
    const sig = (opts) => JSON.stringify(Object.keys(opts || {}).sort().map((k) => [norm(k), norm(opts[k])]));
    const exBySig = new Map();
    (((existing || {}).variants) || []).forEach((v) => { if (v && v.options) exBySig.set(sig(v.options), v); });
    // Solo las combinaciones que un cliente puede llegar a elegir (ver
    // enumerarCombos): las imposibles no se publican. El costo de cada valor es
    // SIEMPRE el de su alternativa más económica disponible en este momento.
    const combos = enumerarCombos(eq).combos.map((c) => ({ opts: c.opts, gross: baseGross + c.extra }));
    return combos.map((c) => {
      const ex = exBySig.get(sig(c.opts));
      // El precio fijo no se redondea: vale exactamente lo que se definió.
      const v = { options: c.opts, price: fixed ? Math.round(c.gross) : roundFinal(c.gross) };
      if (ex && ex.sourceVariantId) v.sourceVariantId = ex.sourceVariantId;
      return v;
    });
  }
  async function applyToStore(eq) {
    const ref = storeRefOf(eq);
    if (!ref) return { success: false, error: 'El producto no está enlazado a un producto de la tienda (usa "Enlazar producto…").' };
    if (!shell.authFetch) return { success: false, error: 'authFetch no disponible en este host.' };
    // Sin pasos = producto SIMPLE (dropshipping): precio directo, sin opciones
    // ni variantes — el theme muestra "Añadir al carro" en vez de "Configurar".
    const hasSteps = (eq.groups || []).length > 0;
    const n = comboCount(eq);
    if (hasSteps && n === 0) return { success: false, error: 'Hay pasos sin componentes activos.' };
    if (n > MAX_COMBOS) {
      return { success: false, error: 'Demasiadas combinaciones ALCANZABLES (' + n + ' variantes; máximo ' + MAX_COMBOS + '). '
        + 'Reduce alternativas por paso, divide el producto o encadena pasos con dependencias: lo que no se puede elegir ya no se publica.' };
    }
    const existing = await fetchProductItem(ref);
    // Sin el estado actual del item NO se aplica: se regenerarían opciones y
    // variantes sin sourceIds y el push las recrearía en Jumpseller (ids
    // nuevos, carros/URLs con variant_id rotos).
    if (!existing && shell.data && shell.data.listItems) {
      return { success: false, error: 'No se pudo leer el producto enlazado desde la app Productos (¿instancia visible? ¿item eliminado?). Revisa el enlace del producto y reintenta.' };
    }
    // Modo "store": el precio de referencia es el del item recién leído, no la
    // copia en memoria del catálogo (que puede venir de una carga anterior).
    if (priceModeOf(eq) === 'store' && existing && num(existing.price) > 0) {
      eq = Object.assign({}, eq, { fixedPrice: num(existing.price) });
    }
    const options = buildStoreOptions(eq, existing);
    const variants = buildStoreVariants(eq, existing);
    const price = productoComputedPrice(eq);
    // GUARDIA DE PRECIO CERO. Un 0 aquí nunca significa "producto gratis":
    // significa que falta un dato. Y como esto escribe en la tienda VIVA,
    // publicarlo deja el producto a $0 a la venta. Se para antes del PUT y se
    // dice cuál de los tres modos no tiene de dónde sacar el precio.
    if (!(num(price) > 0)) {
      const modo = priceModeOf(eq);
      const porQue = modo === 'auto'
        ? 'Está en precio automático y no hay costos de los que calcularlo: ni componentes base, ni costos adicionales, ni componentes en los valores por defecto de los pasos. '
          + 'Los pasos generados desde el modelo 3D no llevan costo por sí solos. Añade costos, o cambia el modo a precio fijo o precio de la tienda.'
        : modo === 'store'
          ? 'Está en "precio de la tienda", pero el producto enlazado no tiene precio útil ('
            + (existing ? 'llegó con precio ' + num(existing.price) : 'no se pudo leer el item') + '). Ponle precio en la app Productos, o cambia a precio fijo.'
          : 'Está en precio fijo pero no hay precio escrito. Escríbelo en el producto.';
      return { success: false, error: 'No se aplicó nada: el precio calculado es ' + fmtMoney(price)
        + ' y publicarlo dejaría "' + eq.name + '" a $0 en la tienda. ' + porQue };
    }
    // Lo mismo por combinación: un recargo negativo puede hundir una variante
    // aunque el precio por defecto esté bien.
    const cero = variants.filter((v) => !(num(v.price) > 0));
    if (cero.length) {
      const ej = Object.keys(cero[0].options || {}).map((k) => k + ': ' + cero[0].options[k]).join(', ');
      return { success: false, error: 'No se aplicó nada: ' + cero.length + ' de ' + variants.length
        + ' variante(s) quedarían a ' + fmtMoney(0) + ' o menos (por ejemplo « ' + ej + ' »). '
        + 'Revisa los recargos de los valores: alguno resta más de lo que vale la configuración por defecto.' };
    }
    try {
      // 1) Persistir en el item del producto (merge; auto-push de campos base).
      const putRes = await fetchReintento(API + '/api/app-instances/' + ref.instanceId + '/items/' + ref.itemId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        // customFields: parametrizable — es la marca que le dice al theme que
        // este producto usa la vista de configurador (default diseno=personalizado).
        // El backend asegura el custom field en
        // Jumpseller tras el push — activa la vista personalizada del theme
        // sin pasos manuales.
        body: JSON.stringify({ price, options, variants, customFields: storeCustomFields(), syncStatus: 'pending' }),
      });
      if (!putRes.ok) {
        const d = await putRes.json().catch(() => ({}));
        return { success: false, error: errorTienda(d.detail, putRes.status) };
      }
      // 2) sync-push: empuja opciones y variantes a Jumpseller y persiste ids.
      const pushRes = await fetchReintento(API + '/api/app-instances/' + ref.instanceId + '/items/sync-push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [ref.itemId] }),
      });
      const data = await pushRes.json().catch(() => ({}));
      if (!pushRes.ok) return { success: false, error: errorTienda(data.detail, pushRes.status) };
      const itemRes = (data.results || {})[ref.itemId] || {};
      const js = ((itemRes.results || {}).jumpseller) || {};
      // Los avisos de custom field NO bloquean (se puede poner a mano):
      // solo los errores de producto/opciones/variantes marcan sync_error.
      const cfWarns = js.customFieldErrors || [];
      const errs = [].concat(js.optionErrors || [], js.variantErrors || [], js.ok === false && js.error ? [js.error] : [])
        .map((x) => errorTienda(x));
      const status = errs.length ? ((data.syncStatusByItem || {})[ref.itemId] || 'sync_error') : 'synced';
      const updated = Object.assign({}, eq, {
        price,
        lastPush: { at: nowIso(), status, errors: errs.slice(0, 5), warnings: cfWarns.slice(0, 3), variantCount: variants.length },
        // Refrescar la copia local de nombre/sku/imagen desde la tienda (la
        // foto del producto puede haber cambiado desde el enlace inicial).
        imageUrl: (existing && existing.imageUrl) || eq.imageUrl,
        storeRef: existing ? Object.assign({}, ref, {
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
      return { success: true, status, message: '"' + eq.name + '" aplicado: ' + fmtMoney(price) + (variants.length ? ', ' + options.length + ' opciones, ' + variants.length + ' variantes.' : ' — producto simple sin variantes (compra directa).') + cfNote };
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
      const r = storeRefOf(ch.eq) ? await applyToStore(ch.eq) : await saveProducto(ch.eq);
      results.push({ name: ch.eq.name, from: ch.oldPrice, to: ch.nextPrice, success: r.success, error: r.error });
    }
    if (model.def && model.def.public && model.def.public.enabled) await publish(true); // re-publicar configurador
    return results;
  }

  // ── Catálogo de la app products (picker de enlace) ────────────────────────
  async function loadCatalog() {
    if (!shell.data || !shell.data.listInstances) { setModel({ catalog: [], catalogLoaded: true }); return; }
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
      setModel({ catalog: all, catalogLoaded: true, catalogError: null });
    } catch (e) { setModel({ catalog: [], catalogLoaded: true, catalogError: (e && e.message) || 'Sin acceso a la app Productos.' }); }
  }

  // ── Publicación (JSON del configurador para el theme) ─────────────────────
  function buildPublicData() {
    const r = rules();
    return {
      // version 2 = contrato ProductLab: + dependsOn/qty en los pasos y
      // storefront.style; el theme acepta version 1 sin cambios (degradación).
      version: 2,
      updatedAt: nowIso(),
      currency: rules().currency,
      store: s((model.def || {}).storeName).trim() || s(instanceId),
      productos: model.productos.filter((eq) => eq.status !== 'inactive').map((eq) => {
        const ref = storeRefOf(eq);
        const legacy = legacyLink(eq);
        // El 3D viaja al theme SOLO si el producto lo tiene activo y marcado
        // para publicar: es opcional en la app y opcional en la tienda.
        const m3 = model3dOf(eq);
        const pubModel3d = m3 && m3.publish === true ? m3 : null;
        return {
          sku: eq.sku || '',
          productId: (ref && ref.sourceId) || (legacy && legacy.sourceId) || null,
          name: eq.name,
          basePrice: productoComputedPrice(eq),
          deliveryDays: productoDelivery(eq),
          // leadTimeDays es el nombre genérico; assemblyDays se mantiene como
          // alias para themes que ya consumían el contrato anterior.
          leadTimeDays: numOr(eq.deliveryExtraDays, r.leadTimeDays),
          assemblyDays: numOr(eq.deliveryExtraDays, r.leadTimeDays),
          deliveryMode: deliveryModeOf(eq),
          baseDeliveryDays: productoBaseDelivery(eq),
          imageUrl: productoImage(eq),
          // Galería completa y descripción del producto en la tienda: sin
          // esto el theme solo puede mostrar la foto principal y no hay texto
          // que incrustar en la ficha.
          images: productImagesFor(eq),
          description: productDescriptionFor(eq),
          // Ficha de tienda: hero (pestaña Explorar) + tabla de especificaciones.
          // El estilo viaja ya RESUELTO (plantilla del catálogo o propio): el
          // theme no sabe de plantillas, recibe un estilo y lo aplica.
          storefront: eq.storefront
            ? Object.assign({}, eq.storefront, { style: resolveStyle(eq) })
            : null,
          // Contrato 3D para el theme: el mismo que consume el motor
          // (assets/engine3d.js), así la tienda reutiliza el núcleo tal cual.
          model3d: pubModel3d ? {
            url: pubModel3d.url,
            rotation: pubModel3d.rotation,
            mirror: pubModel3d.mirror === true,
            // Sin medida real la tienda no ofrece "Ver en tu espacio": es
            // preferible no ofrecerlo a colocarlo a una escala inventada.
            realSizeCm: num(pubModel3d.realSizeCm, 0),
            arUrl: s(pubModel3d.arUrl).trim(),
            parts: pubModel3d.parts,
            finishes: pubModel3d.finishes,
          } : null,
          groups: (eq.groups || []).map((g) => {
            const dv = groupDefaultValue(g);
            const comodin = groupDependsOn(g) && !groupValues(g).some((v) => v.fallback === true)
              ? [{ id: 'na::' + g.id, name: 'No aplica', qty: 1, delta: 0, desc: '', swatchColor: '', imageUrl: '',
                  deliveryDays: 0, tags: [], requires: [], excludes: [], isDefault: false, fallback: true }]
              : [];
            return {
              id: g.id,
              label: g.label || typeLabel(g.typeId),
              type: g.typeId,
              affectsPhoto: g.photoStep === true,
              // Dependencia: el theme oculta este paso salvo que el paso
              // dependsOn.groupId tenga seleccionado uno de dependsOn.valueIds
              // (oculto = fuerza su valor por defecto en los selects nativos).
              dependsOn: (function () {
                const dep = groupDependsOn(g);
                return dep ? { groupId: dep.stepId, valueIds: dep.valueIds.slice() } : null;
              })(),
              // Valores genéricos: nombre SIN marca; el detalle (specs, imagen,
              // entrega, compatibilidades) sale de la alternativa elegida
              // (la más económica disponible) al momento de publicar.
              values: groupValues(g).filter(valueAvailable).map((v) => {
                const alt = valueChosen(v);
                return {
                  id: v.id,
                  name: v.label,
                  // Cantidad informativa (el nombre ya debería decirlo: "2×8GB").
                  qty: valueQty(v),
                  desc: alt ? alt.specs || '' : '',
                  swatchColor: v.swatchColor || '',
                  imageUrl: v.imageUrl || (alt ? alt.imageUrl || '' : ''),
                  delta: deltaFor(g, v, eq),
                  deliveryDays: valueDeliveryDays(v),
                  tags: alt ? alt.tags || [] : [],
                  requires: alt ? alt.requires || [] : [],
                  excludes: alt ? alt.excludes || [] : [],
                  isDefault: !!(dv && dv.id === v.id),
                  // Relleno: la ficha NO lo ofrece cuando el paso se ve; solo
                  // sostiene las variantes en las que el paso está oculto.
                  fallback: v.fallback === true,
                  // Efectos 3D del valor: solo viajan si el producto publica
                  // su modelo (si no, el theme no tendría qué hacer con ellos).
                  model3d: pubModel3d ? (v.model3d || []) : undefined,
                };
              }).concat(comodin),
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
    const ref = storeRefOf(eq);
    return {
      storeRef: ref || null,
      price: productoComputedPrice(eq),
      options: buildStoreOptions(eq, null),
      variants: buildStoreVariants(eq, null),
    };
  }

  // ── Exportar / Importar / Migrar datos ────────────────────────────────────
  // Tres vías, todas sobre el mismo formato:
  //  1. JSON completo (reglas + tipos + componentes + productos): respaldo y
  //     traslado entre instancias, proyectos o tenants.
  //  2. CSV de componentes: la parte más costosa de cargar a mano; se edita en
  //     una planilla y vuelve (ida y vuelta sin pérdida).
  //  3. Migración directa desde otra app de la familia (p. ej.
  //     `hubpro.computadores`): se lee su instancia con el RBAC del usuario
  //     (shell.authFetch) y se traduce su esquema al de ProductLab.
  // Los IDs se PRESERVAN (el backend respeta `id` al crear items), así los
  // pasos siguen apuntando a sus componentes sin re-enlazar nada.
  const DATA_FORMAT = 'kimos.productlab.data';
  const DATA_FORMAT_VERSION = 1;

  // Traducción de un componente de otra app de la familia. El esquema es casi
  // idéntico; lo único que cambió de nombre es productRef → storeRef.
  function foreignComponent(c) {
    const out = Object.assign({}, c, { kind: 'component' });
    if (c.productRef && !out.storeRef) out.storeRef = c.productRef;
    delete out.productRef;
    return out;
  }
  // Traducción de un "equipo" (computadores) a un producto de ProductLab.
  function foreignProducto(e) {
    const out = Object.assign({}, e, { kind: 'producto' });
    if (e.productRef && !out.storeRef) out.storeRef = e.productRef;
    delete out.productRef;
    // computadores calculaba SIEMPRE desde los costos.
    if (!out.priceMode) out.priceMode = 'auto';
    return out;
  }
  const isForeignItem = (it) => !!it && (it.kind === 'equipo' || it.kind === 'producto' || it.kind === 'component' || it.kind === 'definition');

  function exportData(opts) {
    const o = opts || {};
    const payload = {
      format: DATA_FORMAT,
      version: DATA_FORMAT_VERSION,
      exportedAt: nowIso(),
      source: { appId: (shell.app && shell.app.appId) || 'productlab', instanceId: instanceId || null },
    };
    if (o.rules !== false) {
      const def = model.def || defaultDefinition();
      payload.definition = {
        rules: rules(),                 // ya normalizado (alias legacy resueltos)
        types: types(),
        brandName: s(def.brandName),
        storeName: s(def.storeName),
        storeBaseUrl: s(def.storeBaseUrl),
        storeCustomField: def.storeCustomField || null,
      };
    }
    if (o.components !== false) {
      payload.components = model.components.map((c) => Object.assign({}, c));
    }
    if (o.productos) {
      payload.productos = model.productos.map((eq) => {
        const p = Object.assign({}, eq);
        // Los enlaces con la tienda son del PROYECTO de origen: fuera de él
        // apuntan a instancias que no existen.
        if (o.keepStoreLinks === false) { delete p.storeRef; delete p.lastPush; }
        return p;
      });
    }
    return payload;
  }

  // ── CSV de componentes (ida y vuelta) ─────────────────────────────────────
  const CSV_COLS = [
    ['id', (c) => s(c.id)],
    ['nombre', (c) => s(c.name)],
    ['tipo', (c) => typeLabel(c.type)],
    ['marca', (c) => s(c.brand)],
    ['specs', (c) => s(c.specs)],
    ['costo', (c) => s(num(c.cost, 0))],
    ['moneda', (c) => s(c.currency || rules().currency)],
    ['impuestoPct', (c) => s(num(c.taxPct, 0))],
    ['stock', (c) => (c.stock == null ? '' : s(num(c.stock)))],
    ['diasEntrega', (c) => s(num(c.deliveryDays, 0))],
    ['proveedor', (c) => s(c.supplierName)],
    ['urlProveedor', (c) => s(c.supplierUrl)],
    ['verificadoEn', (c) => s(c.verifiedAt || '')],
    ['aporta', (c) => joinList(c.tags)],
    ['requiere', (c) => joinList(c.requires)],
    ['incompatibleCon', (c) => joinList(c.excludes)],
    ['activo', (c) => (c.active === false ? 'no' : 'si')],
    ['imagenUrl', (c) => s(c.imageUrl)],
    ['notas', (c) => s(c.notes)],
  ];
  const csvCell = (v) => (/[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  function componentsCsv(list) {
    const rows = [CSV_COLS.map((c) => c[0]).join(',')];
    (list || model.components).forEach((c) => rows.push(CSV_COLS.map((col) => csvCell(col[1](c))).join(',')));
    return rows.join('\r\n');
  }
  // Parser RFC4180 tolerante: acepta coma o punto y coma como separador y
  // comillas dobles escapadas (lo que exporta cualquier planilla).
  function parseCsv(text) {
    const src = s(text).replace(/^﻿/, '');
    const sep = (src.split('\n')[0] || '').split(';').length > (src.split('\n')[0] || '').split(',').length ? ';' : ',';
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => s(x).trim() !== ''));
  }
  // Resuelve el tipo por id o por etiqueta; si no existe, lo CREA (migrar no
  // debe perder la clasificación del catálogo de origen).
  function resolveTypeId(raw, nuevos) {
    const key = norm(raw);
    if (!key) return 'other';
    const t = types().find((x) => norm(x.id) === key) || types().find((x) => norm(x.label) === key);
    if (t) return t.id;
    const pend = (nuevos || []).find((x) => norm(x.label) === key || norm(x.id) === key);
    if (pend) return pend.id;
    const id = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || newId('t');
    if (nuevos) nuevos.push({ id, label: s(raw).trim() || id });
    return id;
  }
  function componentsFromCsv(text, nuevosTipos) {
    const rows = parseCsv(text);
    if (!rows.length) return { error: 'El archivo no tiene filas.' };
    const head = rows[0].map((x) => norm(x));
    const idx = (...names) => { for (const n of names) { const i = head.indexOf(norm(n)); if (i !== -1) return i; } return -1; };
    const iName = idx('nombre', 'name', 'componente');
    if (iName === -1) return { error: 'Falta la columna "nombre" (encabezados encontrados: ' + rows[0].join(', ') + ').' };
    const cols = {
      id: idx('id'), type: idx('tipo', 'type'), brand: idx('marca', 'brand'), specs: idx('specs', 'descripcion', 'descripción'),
      cost: idx('costo', 'cost', 'precio'), currency: idx('moneda', 'currency'), taxPct: idx('impuestopct', 'impuesto', 'taxpct'),
      stock: idx('stock'), deliveryDays: idx('diasentrega', 'dias', 'deliverydays'),
      supplierName: idx('proveedor', 'suppliername'), supplierUrl: idx('urlproveedor', 'link', 'supplierurl'),
      verifiedAt: idx('verificadoen', 'verifiedat'), tags: idx('aporta', 'tags'), requires: idx('requiere', 'requires'),
      excludes: idx('incompatiblecon', 'excludes'), active: idx('activo', 'active'), imageUrl: idx('imagenurl', 'imagen', 'imageurl'),
      notes: idx('notas', 'notes'),
    };
    const get = (r, i) => (i === -1 ? '' : s(r[i]).trim());
    const out = [];
    rows.slice(1).forEach((r) => {
      const name = get(r, iName);
      if (!name) return;
      const c = { name, kind: 'component' };
      const id = get(r, cols.id);
      if (id) c.id = id;
      c.type = resolveTypeId(get(r, cols.type), nuevosTipos);
      c.brand = get(r, cols.brand); c.specs = get(r, cols.specs);
      c.cost = num(get(r, cols.cost).replace(/\./g, '').replace(',', '.'), 0);
      c.currency = get(r, cols.currency) || rules().currency;
      c.taxPct = num(get(r, cols.taxPct), 0);
      const stk = get(r, cols.stock);
      c.stock = stk === '' ? null : Math.max(0, num(stk, 0));
      c.deliveryDays = num(get(r, cols.deliveryDays), 0);
      c.supplierName = get(r, cols.supplierName); c.supplierUrl = get(r, cols.supplierUrl);
      const vf = get(r, cols.verifiedAt);
      if (vf) c.verifiedAt = vf;
      c.tags = parseList(get(r, cols.tags)); c.requires = parseList(get(r, cols.requires)); c.excludes = parseList(get(r, cols.excludes));
      const act = norm(get(r, cols.active));
      c.active = !(act === 'no' || act === 'false' || act === '0' || act === 'inactivo');
      c.imageUrl = get(r, cols.imageUrl); c.notes = get(r, cols.notes);
      out.push(c);
    });
    return { components: out };
  }

  // ── Importación ───────────────────────────────────────────────────────────
  // mode 'merge' (default): actualiza lo que ya existe (por id, si no por
  // nombre) y crea el resto. mode 'skip': no toca lo existente.
  async function importData(payload, opts) {
    const o = opts || {};
    const res = { components: { created: 0, updated: 0, skipped: 0 }, productos: { created: 0, updated: 0, skipped: 0 }, types: 0, errors: [], warnings: [] };
    if (!payload || typeof payload !== 'object') return Object.assign(res, { errors: ['El contenido no es un objeto JSON válido.'] });
    const skipExisting = o.mode === 'skip';
    const nuevosTipos = [];

    // 1) Reglas y tipos
    const inDef = payload.definition || (payload.rules || payload.types ? { rules: payload.rules, types: payload.types } : null);
    if (inDef && o.rules !== false) {
      const cur = model.def || defaultDefinition();
      const inTypes = Array.isArray(inDef.types) ? inDef.types.filter((t) => t && t.id) : [];
      const merged = (cur.types || []).slice();
      inTypes.forEach((t) => { if (!merged.some((x) => x.id === t.id)) { merged.push({ id: s(t.id), label: s(t.label) || s(t.id) }); res.types++; } });
      const next = Object.assign({}, cur, {
        // rules() del ORIGEN ya viene normalizado; si llega crudo (legacy),
        // los alias (ivaPct/usdRate/assemblyDays/end990) se resuelven al leer.
        // Las reglas del origen se NORMALIZAN antes de fusionar: así los
        // alias legacy (ivaPct, usdRate, assemblyDays, end990) llegan ya
        // traducidos y ganan sobre los valores actuales, que es lo que se
        // espera al marcar "traer reglas de precio".
        rules: inDef.rules ? Object.assign({}, cur.rules, normalizeRules(inDef.rules)) : cur.rules,
        types: merged.length ? merged : cur.types,
      });
      ['brandName', 'storeName', 'storeBaseUrl'].forEach((k) => { if (s(inDef[k]).trim() && !s(cur[k]).trim()) next[k] = s(inDef[k]).trim(); });
      // Plantillas de estilo: se añaden las que falten (por id), nunca se
      // pisan las de aquí — el catálogo de destino manda sobre su propio look.
      if (Array.isArray(inDef.styleTemplates) && inDef.styleTemplates.length) {
        const tpls = (cur.styleTemplates || []).slice();
        inDef.styleTemplates.forEach((t) => {
          if (t && t.id && !tpls.some((x) => x && x.id === t.id)) tpls.push(t);
        });
        next.styleTemplates = tpls;
        if (!s(cur.styleDefaultId).trim() && s(inDef.styleDefaultId).trim()) next.styleDefaultId = s(inDef.styleDefaultId).trim();
      }
      if (inDef.storeCustomField && !cur.storeCustomField) next.storeCustomField = inDef.storeCustomField;
      const r = await saveDefinition(next);
      if (!r.success) res.errors.push('Reglas: ' + r.error);
    }

    // 2) Componentes (lo más costoso de recrear: se prioriza)
    const inComps = Array.isArray(payload.components) ? payload.components : [];
    for (const raw of inComps) {
      try {
        const src = foreignComponent(raw);
        if (!s(src.name).trim()) { res.warnings.push('componente sin nombre omitido'); continue; }
        if (src.type) src.type = resolveTypeId(src.type, nuevosTipos);
        const prev = (src.id && model.components.find((c) => c.id === src.id))
          || model.components.find((c) => norm(c.name) === norm(src.name));
        if (prev && skipExisting) { res.components.skipped++; continue; }
        const item = normalizeComponent(prev ? Object.assign({}, prev, src, { id: prev.id }) : src);
        if (prev) { await shell.items.update(item.id, item); res.components.updated++; }
        else { await shell.items.create(item); res.components.created++; }
        // El modelo local se actualiza al vuelo para que los productos
        // importados a continuación resuelvan sus componentIds.
        model.components = prev
          ? model.components.map((c) => (c.id === item.id ? item : c))
          : model.components.concat([item]);
      } catch (e) { res.errors.push('Componente "' + s(raw && raw.name) + '": ' + ((e && e.message) || 'error')); }
    }
    // Tipos nuevos detectados al resolver componentes.
    if (nuevosTipos.length) {
      const cur = model.def || defaultDefinition();
      const merged = (cur.types || []).slice();
      nuevosTipos.forEach((t) => { if (!merged.some((x) => x.id === t.id)) { merged.push(t); res.types++; } });
      await saveDefinition(Object.assign({}, cur, { types: merged }));
    }
    setModel({ components: model.components.slice() });

    // 3) Productos
    const inProds = Array.isArray(payload.productos) ? payload.productos : (Array.isArray(payload.equipos) ? payload.equipos : []);
    if (inProds.length && o.productos !== false) {
      for (const raw of inProds) {
        try {
          const src = foreignProducto(raw);
          if (!s(src.name).trim()) { res.warnings.push('producto sin nombre omitido'); continue; }
          const prev = (src.id && model.productos.find((e) => e.id === src.id))
            || model.productos.find((e) => norm(e.name) === norm(src.name));
          if (prev && skipExisting) { res.productos.skipped++; continue; }
          if (o.keepStoreLinks === false) { delete src.storeRef; delete src.lastPush; }
          const draft = normalizeProductoShape(prev ? Object.assign({}, prev, src, { id: prev.id }) : src, model.components);
          // Componentes que el producto usa y no llegaron en el paquete.
          const faltan = [];
          (draft.baseComponentIds || []).forEach((id) => { if (!compById(id)) faltan.push(id); });
          (draft.groups || []).forEach((g) => groupValues(g).forEach((v) => (v.componentIds || []).forEach((id) => { if (!compById(id)) faltan.push(id); })));
          if (faltan.length) res.warnings.push('"' + src.name + '": ' + faltan.length + ' referencia(s) a componentes que no están en el paquete (se omiten).');
          const r = await saveProducto(draft);
          if (!r.success) { res.errors.push('Producto "' + src.name + '": ' + r.error); continue; }
          if (prev) res.productos.updated++; else res.productos.created++;
        } catch (e) { res.errors.push('Producto "' + s(raw && raw.name) + '": ' + ((e && e.message) || 'error')); }
      }
    }
    await load();
    scheduleRepublish();
    return res;
  }

  const importSummary = (res) =>
    'Componentes: ' + res.components.created + ' nuevos, ' + res.components.updated + ' actualizados'
    + (res.components.skipped ? ', ' + res.components.skipped + ' omitidos' : '')
    + ' · Productos: ' + res.productos.created + ' nuevos, ' + res.productos.updated + ' actualizados'
    + (res.productos.skipped ? ', ' + res.productos.skipped + ' omitidos' : '')
    + (res.types ? ' · ' + res.types + ' tipo(s) de componente creados' : '')
    + (res.warnings.length ? ' · Avisos: ' + res.warnings.slice(0, 4).join(' · ') : '')
    + (res.errors.length ? ' · ERRORES: ' + res.errors.slice(0, 4).join(' · ') : '');

  // ── Lectura de otra instancia (migración directa) ──────────────────────────
  // Usa el RBAC del usuario: solo ve instancias a las que ya tiene acceso.
  async function listOtherInstances() {
    if (!shell.authFetch) return { error: 'authFetch no disponible en este host.' };
    try {
      const res = await shell.authFetch(API + '/api/app-instances');
      if (!res.ok) return { error: 'HTTP ' + res.status + ' al listar instancias.' };
      const data = await res.json().catch(() => ({}));
      const list = (data.instances || []).filter((i) => i && i.id !== instanceId);
      return { instances: list };
    } catch (e) { return { error: (e && e.message) || 'Error de red.' }; }
  }
  async function readInstanceItems(iid) {
    if (!shell.authFetch) return { error: 'authFetch no disponible en este host.' };
    try {
      const res = await shell.authFetch(API + '/api/app-instances/' + encodeURIComponent(iid) + '/items');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return { error: s(d.detail) || 'HTTP ' + res.status + ' al leer los items (¿tienes acceso a esa instancia?).' };
      }
      const data = await res.json().catch(() => ({}));
      return { items: (data.items || []).filter(isForeignItem) };
    } catch (e) { return { error: (e && e.message) || 'Error de red.' }; }
  }
  // Convierte los items de otra instancia en un paquete importable.
  function packFromItems(items) {
    const def = (items || []).find((i) => i.kind === 'definition' || i.id === 'definition');
    const pack = {
      format: DATA_FORMAT,
      version: DATA_FORMAT_VERSION,
      components: (items || []).filter((i) => i.kind === 'component'),
      productos: (items || []).filter((i) => i.kind === 'equipo' || i.kind === 'producto'),
    };
    if (def) pack.definition = { rules: def.rules || {}, types: def.types || [], storeBaseUrl: def.storeBaseUrl, storeName: def.storeName, brandName: def.brandName, storeCustomField: def.storeCustomField,
      // Las plantillas de estilo viajan con el catálogo: al migrar o importar,
      // los productos que las usan siguen viéndose igual.
      styleTemplates: def.styleTemplates || [], styleDefaultId: def.styleDefaultId || '' };
    return pack;
  }
  async function migrateFromInstance(iid, opts) {
    const r = await readInstanceItems(iid);
    if (r.error) return { success: false, error: r.error };
    const pack = packFromItems(r.items);
    const conteo = { components: (pack.components || []).length, productos: (pack.productos || []).length, rules: !!pack.definition };
    if (opts && opts.dryRun) return { success: true, dryRun: true, pack, conteo };
    const res = await importData(pack, opts);
    return { success: res.errors.length === 0, res, conteo };
  }

  // Descarga de un archivo generado en el navegador (export).
  function downloadText(name, text, mime) {
    try {
      const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { shell.notify({ level: 'error', text: 'No se pudo descargar: ' + ((e && e.message) || 'error') }); return false; }
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
  // Construye los pasos desde el payload del agente. Tolera los alias que
  // suelen mandar los modelos (values/valores/opciones, label/nombre…) y —lo
  // importante— RECHAZA con detalle un paso que quede sin valores en vez de
  // guardarlo vacío en silencio, que es la falla que deja "pasos sin valores"
  // en la pantalla sin que nadie se entere.
  function buildGroupsFromSteps(eq, steps) {
    const warns = [];
    const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return undefined; };
    const pickArr = (o, keys) => { for (const k of keys) if (o && Array.isArray(o[k])) return o[k]; return undefined; };
    const exByLabel = new Map();
    (eq.groups || []).forEach((g) => exByLabel.set(norm(g.label || typeLabel(g.typeId)), g));
    const m3 = eq.model3d || null;

    const groups = steps.map((st) => {
      const label = s(pick(st, ['label', 'nombre', 'titulo', 'name', 'paso'])).trim();
      const ex = exByLabel.get(norm(label));
      const exVals = new Map();
      if (ex) groupValues(ex).forEach((v) => exVals.set(norm(v.label), v));
      const rawVals = pickArr(st, ['values', 'valores', 'options', 'opciones', 'items']) || [];
      const values = rawVals.map((v) => {
        if (v == null) return null;
        // Un valor puede venir como string suelto ("Natural").
        const vo = typeof v === 'object' ? v : { label: v };
        const vLabel = s(pick(vo, ['label', 'nombre', 'etiqueta', 'name', 'valor'])).trim();
        const comps = (pickArr(vo, ['components', 'componentes', 'componentIds', 'alternativas']) || []).map((refC) => {
          const c = findComponent(refC);
          if (!c) warns.push('componente no encontrado: "' + s(refC) + '"');
          return c;
        }).filter(Boolean);
        const exv = exVals.get(norm(vLabel));
        const fx = pickArr(vo, ['model3d', 'efectos3d', 'efectos', 'fx3d']);
        return {
          id: (exv && exv.id) || newId('val'),
          label: vLabel,
          imageUrl: s(pick(vo, ['imageUrl', 'imagen', 'foto'])).trim(),
          swatchColor: s(pick(vo, ['swatchColor', 'color'])).trim(),
          qty: Math.max(1, Math.round(num(pick(vo, ['qty', 'cantidad']), exv ? num(exv.qty, 1) : 1)) || 1),
          priceDelta: num(pick(vo, ['priceDelta', 'recargo', 'extra']), exv ? num(exv.priceDelta, 0) : 0),
          // Valor de RELLENO: sostiene las variantes en las que su paso queda
          // oculto, y la tienda no lo ofrece cuando el paso se ve.
          fallback: (function () {
            const f = pick(vo, ['fallback', 'relleno', 'soloRelleno']);
            return f === undefined ? (exv ? exv.fallback === true : false) : f === true;
          })(),
          // Conjunto: los componentes de este valor se SUMAN (CPU + placa).
          bundle: (function () {
            const b = pick(vo, ['bundle', 'conjunto', 'suma']);
            return b === undefined ? (exv ? exv.bundle === true : false) : b === true;
          })(),
          componentIds: comps.map((c) => c.id),
          // Efectos 3D: si no se envían, se conservan los que ya tenía el
          // valor (editar los pasos no debe borrar el vínculo con el 3D).
          model3d: fx != null ? fx : (exv ? exv.model3d : []),
        };
      }).filter((v) => v && v.label);
      const stType = s(pick(st, ['type', 'tipo']));
      const typeId = types().some((t) => t.id === stType) ? stType : (ex ? ex.typeId : 'other');
      const defRef = s(pick(st, ['default', 'porDefecto', 'defecto']));
      const defVal = values.find((v) => norm(v.label) === norm(defRef)) || values[0] || null;
      return {
        id: (ex && ex.id) || newId('grp'),
        typeId,
        label,
        photoStep: st.photoStep === true,
        values,
        defaultValueId: defVal ? defVal.id : null,
      };
    });

    // dependsOn por label ({step|paso, values|valores: [labels]}) → {stepId,
    // valueIds}. Solo puede apuntar a un paso ANTERIOR (sin ciclos).
    steps.forEach((st, i) => {
      const depRaw = st && (st.dependsOn || st.dependeDe || st.depende);
      const dep = typeof depRaw === 'string' ? (function () { try { return JSON.parse(depRaw); } catch (e) { return null; } })() : depRaw;
      if (!dep) return;
      const depStep = s(pick(dep, ['step', 'paso', 'de'])).trim();
      if (!depStep) return;
      const target = groups.slice(0, i).find((g) => norm(g.label) === norm(depStep))
        || groups.slice(0, i).find((g) => norm(g.label).indexOf(norm(depStep)) !== -1);
      if (!target) { warns.push('dependsOn de "' + groups[i].label + '": paso ANTERIOR no encontrado: "' + depStep + '" (dependencia ignorada)'); return; }
      const wanted = (pickArr(dep, ['values', 'valores']) || []).map((x) => norm(s(x)));
      const valueIds = groupValues(target)
        .filter((v) => !wanted.length || wanted.indexOf(norm(v.label)) !== -1)
        .map((v) => v.id);
      if (!valueIds.length) { warns.push('dependsOn de "' + groups[i].label + '": ningún valor de "' + target.label + '" coincide (dependencia ignorada)'); return; }
      groups[i].dependsOn = { stepId: target.id, valueIds };
    });

    const sinLabel = groups.filter((g) => !g.label).length;
    if (sinLabel) return { error: 'Hay ' + sinLabel + ' paso(s) sin nombre. Cada paso necesita "label". Ejemplo: {"label":"Acabado","values":[{"label":"Natural"}]}.' };
    const vacios = groups.filter((g) => !g.values.length).map((g) => g.label);
    if (vacios.length) {
      const ejemploFx = m3 && (m3.finishes || []).length && (m3.parts || []).length
        ? ', "model3d":[{"partId":"' + m3.parts[0].id + '","type":"finish","finishId":"' + m3.finishes[0].id + '"}]'
        : '';
      return { error: 'NADA se guardó: ' + vacios.length + ' paso(s) llegaron SIN valores (' + vacios.map((x) => '"' + x + '"').join(', ')
        + '). Un paso sin valores no sirve de nada, así que se rechaza entero en vez de dejarlo vacío. '
        + 'Los valores van en "values", como lista de objetos con "label". '
        + 'Ejemplo de un paso completo: {"label":"' + (vacios[0] || 'Acabado') + '","default":"Natural","values":['
        + '{"label":"Natural"' + ejemploFx + '},{"label":"Carbonizado"}]}. '
        + 'Los "components" son OPCIONALES: un valor sin componentes es una opción que no agrega costo. '
        + (m3 ? 'Este producto tiene visor 3D: para vincular cada valor usa "model3d" (partes: '
            + (m3.parts || []).map((x) => x.id).join(', ') + ' · acabados: ' + ((m3.finishes || []).map((x) => x.id).join(', ') || 'ninguno')
            + '), o deja que BUILD_3D_STEPS genere los pasos solo.' : '') };
    }
    return { groups, warns };
  }
  function stepsMessage(item, warns) {
    const detalle = (item.groups || []).map((g) => '"' + g.label + '" (' + groupValues(g).length + ')').join(', ');
    const modo = priceModeOf(item);
    return 'Pasos de "' + item.name + '" actualizados: ' + (item.groups || []).length + ' paso(s) → ' + detalle
      + ' · ' + comboCount(item) + ' combinación(es) · precio '
      + (modo === 'auto' ? 'calculado ' : modo === 'store' ? 'del catálogo ' : 'fijo ') + fmtMoney(item.price) + '.'
      + ((warns && warns.length) ? ' Avisos: ' + warns.slice(0, 5).join(' · ') : '');
  }

  if (shell.agent && typeof shell.agent.register === 'function') {
    offAgent = shell.agent.register({
      label: 'ProductLab',
      description: 'Gestiona los productos personalizables de la tienda, de cualquier rubro: componentes e insumos (materiales, piezas, mano de obra o procesos externalizados) con costos de proveedor, stock y compatibilidades; reglas de margen, moneda e impuesto; productos con sus pasos de configuración; la ficha de tienda (builder de descripción, especificaciones, nota, pestañas); el enlace con productos Jumpseller y la publicación del configurador.',
      tools: [
        { name: 'UPSERT_COMPONENT', description: 'Crea o actualiza un componente por nombre.',
          inputSchema: { type: 'object', properties: {
            name: { type: 'string' }, type: { type: 'string', description: 'id de un tipo definido en la app (ver snapshot.types); los tipos los define cada empresa según su rubro' },
            cost: { type: 'number' }, currency: { type: 'string', description: 'CLP|USD' },
            taxPct: { type: 'number', description: 'impuesto adicional % que se SUMA al costo (aduana/importación); 0 = sin' },
            supplierName: { type: 'string' }, supplierUrl: { type: 'string' },
            specs: { type: 'string' }, imageUrl: { type: 'string' }, deliveryDays: { type: 'number' },
            stock: { type: 'number', description: 'unidades; 0 = no elegible; omitir = sin control' },
            tags: { type: 'string', description: 'lo que APORTA este componente, coma-separado, ej: material:roble, uso:exterior' },
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
            deliveryExtraDays: { type: 'number', description: 'días propios de preparación/producción; null = regla global' },
            deliveryMode: { type: 'string', description: 'max = en paralelo (manda el más lento) | sum = en serie, los días de entrega se SUMAN (dropshipping)' },
            storeUrl: { type: 'string', description: 'URL manual del producto (vacío = automática: URL base + permalink)' },
            priceMode: { type: 'string', description: 'CÓMO se fija el precio: "auto" = calculado desde los costos y las reglas de margen (por defecto) | "fixed" = precio decidido a mano, exacto, sin depender de costos | "store" = el precio que ya tiene el producto en la app Productos/Jumpseller. Con fixed y store los pasos siguen funcionando (y el 3D también), pero todas las combinaciones valen igual salvo que algún valor declare un recargo.' },
            fixedPrice: { type: 'number', description: 'precio para priceMode "fixed" (en la moneda base)' },
          }, required: ['name'] } },
        { name: 'SET_PRODUCTO_STEPS', description: 'Reemplaza los pasos de configuración de un producto. Cada paso: {label, type?, photoStep?, default?, dependsOn?, values: [{label, qty?, imageUrl?, swatchColor?, priceDelta?, components?: [nombre o id, …], model3d?: [{partId, type:"color"|"finish"|"hide", color?, finishId?}]}]}. El campo model3d de un valor aplica efectos al visor 3D (solo si el producto tiene modelo; ver SET_MODEL3D); si se omite, se conservan los efectos actuales. qty = cantidad del componente elegido en ese valor (ej. 2 para "2×8GB": multiplica el precio y exige stock suficiente). dependsOn = {step: <label de un paso ANTERIOR>, values: [<labels que lo hacen visible>]}: paso condicional que la tienda oculta si no se cumple. OJO: un paso oculto SIGUE aportando su valor por defecto a la variante (Jumpseller exige un valor de cada opción en cada combinación), así que su default debe ser un valor sin costo Y marcado `fallback: true` — "relleno": existe solo para esas combinaciones y la ficha NO lo ofrece cuando el paso se ve, de modo que nadie pueda comprar "sin <lo que sea>" habiendo elegido la opción que abre el paso. `bundle: true` (alias `conjunto`) hace que los `components` del valor se SUMEN en lugar de ser alternativas — ej. un paso "Procesador" cuyo valor "Ryzen 5" incluye CPU + su placa madre, evitando pasos dependientes. Los componentes con tags `requires`/`excludes` filtran solos las combinaciones: las que violan compatibilidades NO se publican. Los `components` son OPCIONALES: un valor sin componentes es una opción que NO agrega costo (por ejemplo elegir un acabado que vale lo mismo); si quieres cobrar por un valor sin modelar su costo, usa `priceDelta`. Los componentes se referencian por nombre; se reusan los ids de pasos/valores existentes con el mismo label (preserva el matching con la tienda). CADA PASO DEBE LLEVAR SUS VALORES: si un paso llega sin `values` se rechaza TODA la llamada con el detalle (no se guardan pasos vacíos). Lee el snapshot (productos[].steps) para la estructura actual.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string', description: 'id o nombre' },
            steps: { type: 'array', items: { type: 'object' }, description: 'lista COMPLETA de pasos (reemplaza los actuales)' },
          }, required: ['producto', 'steps'] } },
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
        { name: 'SET_STOREFRONT', description: 'Edita la ficha de tienda de un producto: pageSections (builder de descripción: secciones hero/imagen/specs/fotos/note), specs (tabla), photosNote (nota), tabs (pestañas) y style (estilo del configurador por producto). El contrato EXACTO de pageSections está en snapshot.builderRef: sectionShape (forma de la sección), blockSchema (campos de cada tipo de bloque), example (sección de ejemplo) y patterns[].containers (celdas válidas por patrón); el estado actual está en productos[].storefront.pageSections — para editar, parte de ese estado y modifícalo. pageSections REEMPLAZA la lista completa; secciones o bloques mal formados se rechazan con detalle (nada se pierde en silencio). Solo se reemplaza lo que envíes; todo pasa por la normalización de la app y se republica solo.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string' },
            pageSections: { type: 'array', items: { type: 'object' }, description: 'lista COMPLETA de secciones según builderRef.sectionShape; bloques en slots:{contenedor:[…]} según builderRef.blockSchema' },
            allowEmpty: { type: 'boolean', description: 'obligatorio en true para guardar pageSections que dejen la ficha sin bloques (protección anti-borrado)' },
            specs: { type: 'array', items: { type: 'object' }, description: 'filas {group?, label, value}' },
            photosNote: { type: 'string' },
            tabs: { type: 'object', description: '{explorar?, specs?, fotos?, comprar?, showSpecs?, showFotos?, order?}' },
            style: { type: 'object', description: 'estilo del configurador en la tienda: {accentColor? "#hex", bgColor? "#hex", radius? 0-24, cardStyle? "cards|list|compact", showDeltas? "delta|total|none", stepsCollapsed? bool, buyLabel? "texto del botón de la barra que lleva al configurador (vacío = Comprar); va en el estilo para cambiarlo de una vez en todos los productos que comparten plantilla", width? "auto|container|full" (auto = se alinea al ancho del contenedor del theme; full = borde a borde), bar? {bgColor?, textColor?, width? "auto|container|full", sticky? bool, offset? px bajo el menú del sitio, mobileTabs? bool, showPrice? bool, showThumb? bool}, photos? {size? "s|m|l|xl" (ancho del bloque), layout? "visor|lado|mosaico", mainSize? "s|m|l|xl|auto" (alto de la foto grande), thumbSize? "s|m|l", cols? 0-6, fit? "contain|cover", frame? bool}, spinnerColor? "#hex del spinner de carga"} — vacío = theme del sitio' },
            styleId: { type: 'string', description: 'qué estilo rige en la tienda: "" = el del catálogo (su plantilla por defecto), "own" = el style propio de este producto, o el id/nombre de una plantilla (snapshot.styleTemplates)' },
          }, required: ['producto'] } },
        { name: 'SET_STYLE_TEMPLATE', description: 'Crea o edita una PLANTILLA de estilo del catálogo: un mismo look (colores, barra, fotos, anchos) reutilizable en muchos productos. Sin id crea una nueva; con id (o el nombre de una existente) la actualiza y el cambio alcanza de golpe a todos los productos que la usan. Con setDefault:true pasa a regir en todo el catálogo (los productos que no elijan otra cosa). El estado está en snapshot.styleTemplates.',
          inputSchema: { type: 'object', properties: {
            id: { type: 'string', description: 'id o nombre de una plantilla existente; vacío = crear' },
            name: { type: 'string', description: 'nombre visible de la plantilla' },
            style: { type: 'object', description: 'mismo objeto que SET_STOREFRONT.style; reemplaza el de la plantilla (se fusiona con el actual al editar)' },
            setDefault: { type: 'boolean', description: 'true = esta plantilla rige en todo el catálogo' },
            from: { type: 'string', description: 'opcional: id/nombre/SKU de un producto del que copiar su estilo efectivo' },
          } } },
        { name: 'DELETE_STYLE_TEMPLATE', description: 'Borra una plantilla de estilo del catálogo. Los productos que la usaban vuelven a su estilo propio (nada más cambia).',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id o nombre de la plantilla' } }, required: ['id'] } },
        { name: 'APPLY_STYLE_TEMPLATE', description: 'Engancha productos a una plantilla de estilo. Con all:true la aplica a TODO el catálogo (uno por uno); con producto, solo a ese. template acepta el id/nombre de una plantilla, "own" (estilo propio del producto) o "catalog" (lo que diga la plantilla por defecto del catálogo).',
          inputSchema: { type: 'object', properties: {
            template: { type: 'string', description: 'id/nombre de plantilla, "own" o "catalog"' },
            producto: { type: 'string', description: 'id, nombre o SKU de un producto' },
            all: { type: 'boolean', description: 'true = todos los productos del catálogo' },
          }, required: ['template'] } },
        { name: 'LINK_PRODUCT', description: 'Enlaza un producto a un producto del catálogo de la app Productos (por nombre, SKU o id Jumpseller). Luego usa APPLY_PRODUCTO para escribir en la tienda.',
          inputSchema: { type: 'object', properties: { producto: { type: 'string' }, product: { type: 'string' } }, required: ['producto', 'product'] } },
        { name: 'SET_STOCK', description: 'Actualiza el stock de uno o varios componentes (null/vacío = sin control; 0 = no elegible).',
          inputSchema: { type: 'object', properties: {
            component: { type: 'string' }, stock: { type: 'number' },
            items: { type: 'array', items: { type: 'object' }, description: '[{component, stock}, …] para actualización masiva' },
          } } },
        { name: 'PUBLISH_CONFIG', description: 'Publica (enabled=true) o despublica (enabled=false) el JSON del configurador que consume el theme.',
          inputSchema: { type: 'object', properties: { enabled: { type: 'boolean' } } } },
        { name: 'IMPORT_IMAGE', description: 'Importa una imagen al área pública de la app y devuelve su URL, para usarla luego en SET_STOREFRONT (fondo de hero) o como foto de un valor. Acepta: el path de un adjunto del chat en el File Storage del equipo (aparece como "[Adjunto … — path: …]" en el mensaje), una ruta /api/… de KIMOS, o una URL http(s) accesible. Solo imágenes, máx 8 MB.',
          inputSchema: { type: 'object', properties: {
            url: { type: 'string', description: 'path del storage del equipo (ej: chat/foto.png), ruta /api/… o URL http(s)' },
            name: { type: 'string', description: 'nombre de archivo destino (opcional)' },
            producto: { type: 'string', description: 'opcional: id o nombre de un producto — la imagen queda además en su galería (productos[].galleryImages) para reutilizarla' },
          }, required: ['url'] } },
        { name: 'SET_MODEL3D', description: 'Configura el visor 3D de un producto (OPCIONAL: un producto sin modelo funciona igual). Define el archivo .glb, las PARTES (cada una agrupa nombres de material del GLB) y, si hace falta, los ACABADOS con textura. Para vincular un paso al 3D usa SET_PRODUCTO_STEPS con el campo model3d de cada valor: [{partId, type:"color"|"finish"|"hide", color, finishId}]. Envía enabled:false para desactivarlo sin borrarlo, o remove:true para quitarlo del todo. El estado actual está en productos[].model3d.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string', description: 'id o nombre' },
            url: { type: 'string', description: 'URL del .glb (usa IMPORT_IMAGE o la subida de la app para obtenerla)' },
            enabled: { type: 'boolean', description: 'activar/desactivar el visor sin perder la configuración' },
            publish: { type: 'boolean', description: 'incluir el 3D en el JSON público que consume el theme de la tienda' },
            rotation: { type: 'array', items: { type: 'number' }, description: '[x,y,z] en radianes; corrige modelos CAD Z-up' },
            mirror: { type: 'boolean' },
            realSizeCm: { type: 'number', description: 'medida REAL del lado más largo del producto, en cm. Habilita "Ver en tu espacio" (realidad aumentada con la cámara) en la tienda: sin este dato el modelo se apoyaría en el suelo a una escala inventada, así que el botón no se ofrece. 0 = sin AR.' },
            parts: { type: 'array', items: { type: 'object' }, description: '[{id?, label, materials:[nombres exactos del GLB], defaultColor?, defaultFinish?, roughness?, grainVertical?, grainAngle?, grainAlongMaterials?:[materiales cuya veta corre a lo largo, anulan vertical]}]' },
            finishes: { type: 'array', items: { type: 'object' }, description: '[{id?, label, color, texture?, roughness?, textureScale?, grain?, triplanar?}]' },
            remove: { type: 'boolean', description: 'quita por completo el 3D del producto' },
          }, required: ['producto'] } },
        { name: 'BUILD_3D_STEPS', description: 'Genera SOLO los pasos del configurador a partir del modelo 3D: crea un paso por cada PARTE del modelo, con un valor por cada ACABADO, ya vinculados al 3D. Es la forma más rápida y segura de dejar un producto con visor listo para configurar, sin escribir los efectos a mano. Los valores quedan sin componentes (no agregan costo); si el producto usa priceMode "auto" y quieres cobrar por alguno, edítalo luego con SET_PRODUCTO_STEPS.',
          inputSchema: { type: 'object', properties: {
            producto: { type: 'string', description: 'id o nombre' },
            parts: { type: 'array', items: { type: 'string' }, description: 'ids de las partes a convertir en pasos (por defecto, todas). Ver productos[].model3d.parts' },
            mode: { type: 'string', description: '"finish" (por defecto) usa los acabados del modelo; "color" usa la lista `colors`' },
            colors: { type: 'array', items: { type: 'object' }, description: 'para mode "color": [{label, color}]' },
            prefix: { type: 'string', description: 'texto antes del nombre de cada paso' },
            suffix: { type: 'string', description: 'texto después del nombre de cada paso (ej: " Hanoi 1")' },
            append: { type: 'boolean', description: 'true = conserva los pasos actuales y agrega los nuevos (útil en packs de varias unidades); por defecto reemplaza' },
          }, required: ['producto'] } },
        { name: 'LIST_SOURCES', description: 'Lista las instancias de apps visibles para el usuario (otros catálogos desde los que se puede migrar, p. ej. una app de computadores). Devuelve id, nombre y template de cada una: úsalos como `origen` en MIGRATE_FROM.',
          inputSchema: { type: 'object', properties: {} } },
        { name: 'MIGRATE_FROM', description: 'Trae a ESTE catálogo los datos de otra instancia (componentes, productos con sus pasos y ficha, reglas y tipos), traduciendo el esquema si viene de otra app de la familia (kind "equipo" → producto, productRef → storeRef). Los IDs se conservan, así los pasos siguen apuntando a sus componentes. Es idempotente: lo que ya existe se actualiza en vez de duplicarse. Usa dryRun para ver primero cuánto hay. Descubre el `origen` con LIST_SOURCES.',
          inputSchema: { type: 'object', properties: {
            origen: { type: 'string', description: 'id de la instancia de origen (ver LIST_SOURCES)' },
            dryRun: { type: 'boolean', description: 'true = solo informa qué hay en el origen, sin escribir nada' },
            rules: { type: 'boolean', description: 'traer reglas de precio y tipos de componente (default true)' },
            productos: { type: 'boolean', description: 'traer productos además de componentes (default true)' },
            keepStoreLinks: { type: 'boolean', description: 'mantener el enlace de cada producto con la tienda (default true; ponlo en false si el origen es de OTRO proyecto)' },
            mode: { type: 'string', description: '"merge" (default) actualiza lo existente | "skip" solo crea lo que falta' },
          }, required: ['origen'] } },
        { name: 'EXPORT_DATA', description: 'Exporta el catálogo a un archivo y devuelve su URL pública (respaldo o traslado a otro proyecto). El CSV de componentes se puede editar en una planilla y volver con IMPORT_DATA.',
          inputSchema: { type: 'object', properties: {
            formato: { type: 'string', description: '"json" (default) | "csv" (solo componentes)' },
            productos: { type: 'boolean', description: 'incluir los productos en el JSON (default true)' },
            keepStoreLinks: { type: 'boolean', description: 'incluir los enlaces con la tienda (default true)' },
          } } },
        { name: 'IMPORT_DATA', description: 'Importa un catálogo desde una URL (JSON exportado o CSV de componentes) o desde un objeto JSON inline. Los tipos de componente que no existan se crean solos; lo existente se actualiza por id o por nombre.',
          inputSchema: { type: 'object', properties: {
            url: { type: 'string', description: 'URL del archivo (p. ej. la que devolvió EXPORT_DATA, o un adjunto ya subido)' },
            datos: { type: 'object', description: 'alternativa a url: el paquete JSON inline {components:[…], productos:[…], definition:{…}} (o string JSON)' },
            rules: { type: 'boolean', description: 'aplicar las reglas y tipos del paquete (default true)' },
            productos: { type: 'boolean', description: 'importar los productos del paquete (default true)' },
            keepStoreLinks: { type: 'boolean', description: 'conservar los enlaces con la tienda del paquete (default true)' },
            mode: { type: 'string', description: '"merge" (default) | "skip"' },
          } } },
      ],
      getSnapshot: () => ({
        rules: rules(),
        types: types(),
        components: model.components.map((c) => ({
          id: c.id, name: c.name, type: c.type, cost: c.cost, currency: c.currency, taxPct: num(c.taxPct, 0),
          salePrice: componentSale(c), deliveryDays: num(c.deliveryDays, 0),
          supplierUrl: c.supplierUrl, supplierName: c.supplierName,
          verifiedAt: c.verifiedAt, staleDays: daysSince(c.verifiedAt) === Infinity ? null : daysSince(c.verifiedAt),
          active: c.active !== false, stock: c.stock == null ? null : num(c.stock),
          available: compAvailable(c), tags: c.tags, requires: c.requires, excludes: c.excludes,
        })),
        productos: model.productos.map((eq) => ({
          id: eq.id, name: eq.name, sku: eq.sku, price: eq.price, computedPrice: productoComputedPrice(eq),
          // Cómo se fija el precio y con qué datos cuenta la tienda: `storePrice`
          // es lo que hoy cobra el producto enlazado y `storeCost` el costo por
          // unidad que trae Jumpseller — sirven para alinear sin modelar costos.
          priceMode: priceModeOf(eq), fixedPrice: num(eq.fixedPrice, 0),
          storePrice: (function () { const it = productItemFor(eq); return it && it.price != null ? num(it.price) : null; })(),
          storeCost: (function () { const it = productItemFor(eq); return it && it.costPerItem != null ? num(it.costPerItem) : null; })(),
          linked: !!storeRefOf(eq),
          // Variantes que de verdad se publican y las que se ahorran por no
          // generar lo imposible (ver enumerarCombos).
          variantCombos: comboCount(eq), variantCombosSinDependencias: comboCartesiano(eq),
          deliveryDays: productoDelivery(eq),
          deliveryMode: deliveryModeOf(eq),
          storeUrl: productoStoreUrl(eq) || null,
          productImages: productImagesFor(eq),
          galleryImages: collectProductoImages(eq),
          lastPush: eq.lastPush || null, warnings: productoWarnings(eq),
          // Pasos de configuración (editable con SET_PRODUCTO_STEPS)
          steps: (eq.groups || []).map((g) => ({
            label: g.label || typeLabel(g.typeId), type: g.typeId, photoStep: g.photoStep === true,
            // dependsOn en el formato de SET_PRODUCTO_STEPS (labels, no ids)
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
              label: v.label, isDefault: g.defaultValueId === v.id, available: valueAvailable(v), qty: valueQty(v),
              delta: deltaFor(g, v, eq), alternatives: valueAlts(v).map((c) => c.name), priceDelta: num(v.priceDelta, 0),
              // Conjunto/relleno y precio de venta del valor, para razonar sin recalcular.
              bundle: v.bundle === true, fallback: v.fallback === true, salePrice: valueSale(v),
              // Efectos sobre el visor 3D (vacío si el producto no tiene modelo)
              model3d: v.model3d || [],
            })),
          })),
          // Visor 3D: null si este producto no tiene modelo (es opcional).
          model3d: eq.model3d ? {
            enabled: eq.model3d.enabled !== false,
            url: eq.model3d.url,
            publish: eq.model3d.publish === true,
            realSizeCm: num(eq.model3d.realSizeCm, 0),
            arUrl: s(eq.model3d.arUrl || ''),
            parts: (eq.model3d.parts || []).map((p) => ({ id: p.id, label: p.label, materials: p.materials, defaultColor: p.defaultColor, defaultFinish: p.defaultFinish, grainVertical: p.grainVertical, grainAngle: p.grainAngle, grainAlongMaterials: p.grainAlongMaterials })),
            finishes: (eq.model3d.finishes || []).map((f) => ({ id: f.id, label: f.label, color: f.color, texture: f.texture })),
          } : null,
          // Ficha de tienda (editable con SET_STOREFRONT)
          storefront: {
            pageSections: (eq.storefront && eq.storefront.pageSections) || [],
            specs: (eq.storefront && eq.storefront.specs) || [],
            photosNote: (eq.storefront && eq.storefront.photosNote) || '',
            tabs: (eq.storefront && eq.storefront.tabs) || {},
            // Estilo propio guardado + el que de verdad rige (plantilla del
            // catálogo o el propio), para que el agente no tenga que deducirlo.
            style: (eq.storefront && eq.storefront.style) || {},
            styleId: (eq.storefront && eq.storefront.styleId) || '',
            styleEffective: resolveStyle(eq),
            styleSource: styleSourceLabel(eq),
          },
        })),
        staleComponents: model.components.filter((c) => daysSince(c.verifiedAt) > rules().staleDays).map((c) => c.name),
        // Plantillas de estilo del catálogo (un look en muchos productos) y
        // cuál rige por defecto. Se editan con SET_STYLE_TEMPLATE.
        styleTemplates: styleTemplates().map((t) => ({ id: t.id, name: t.name, style: t.style })),
        styleDefaultId: s((model.def || {}).styleDefaultId),
        publicEnabled: !!(model.def && model.def.public && model.def.public.enabled),
        publicUrl,
        storeBaseUrl: s(model.def && model.def.storeBaseUrl),
        // Referencia para componer pageSections válidas con SET_STOREFRONT
        builderRef: {
          patterns: HERO_PATTERNS.map((p) => ({ id: p.id, containers: patternCells(p) })),
          blockTypes: HERO_BLOCK_TYPES.map((t) => t.id),
          heights: ['s', 'm', 'l', 'xl', 'auto'],
          extraSections: ['imagen'],
          fixedSections: ['specs', 'fotos', 'note'],
          // Contrato EXACTO de SET_STOREFRONT.pageSections. Los bloques que no
          // calcen con este esquema se RECHAZAN completos (nunca se pierden en
          // silencio), así el agente puede corregir y reintentar.
          sectionShape: 'Sección hero: {"kind":"hero","pattern":<patterns[].id>,"height":"s|m|l|xl|auto","bgColor":"#hex opcional","bgImageUrl":"https opcional (tapa el color)","textColor":"#hex opcional (vacío = automático según fondo)","overlay":true,"slots":{<containerId>:[bloque,…]}}. Los containerId válidos son EXACTAMENTE los containers del pattern elegido (ver patterns[]). Sección imagen (repetible; solo una foto cuyo ALTO se adapta a la imagen, sin recortes): {"kind":"imagen","imageUrl":"https…","width":"content|full","alt":"opcional","link":"opcional"}. Secciones fijas (existen siempre, solo se reordenan u ocultan): {"kind":"specs"|"fotos"|"note","show":true|false}.',
          blockSchema: {
            photo: '{"type":"photo","size":"s|m|l|xl|auto","anim":"none|float|zoom|sway","align":"left|center|right"} — foto del producto enlazado (auto = alto natural de la foto)',
            title: '{"type":"title","align":"left|center|right"} — nombre del producto',
            text: '{"type":"text","text":"…","size":"xl|l|m|s","color":"#hex opcional","align":"left|center|right"}',
            items: '{"type":"items","items":[{"title":"…","text":"…"},…],"float":true,"align":"left|center|right"} — features/beneficios; title obligatorio en cada item',
            cta: '{"type":"cta","label":"…","style":"primary|dark|ghost","action":"configurar|url","url":"solo si action=url","align":"left|center|right"} — botón',
            icons: '{"type":"icons","items":[{"icon":"⚡ (emoji o carácter)","title":"…","text":"…"},…],"color":"#hex opcional","align":"left|center|right"} — destaques con filete de acento a la izquierda',
            specs: '{"type":"specs","count":4,"align":"left|center|right"} — resumen de las primeras N filas de la tabla de especificaciones (1-12)',
            gallery: '{"type":"gallery","index":1,"size":"s|m|l|xl|auto","align":"left|center|right"} — foto Nº index de la galería del producto (auto = alto natural)',
            description: '{"type":"description","size":"xl|l|m|s","max":0,"align":"left|center|right"} — la descripción que el producto ya tiene en la tienda, en vivo; max = recorte a N caracteres (0 = completa)',
            html: '{"type":"html","html":"<div>…</div>","align":"left|center|right"} — HTML libre',
          },
          example: {
            kind: 'hero', pattern: 'clasico', height: 'l', bgColor: '#1D1D1B',
            slots: {
              top: [{ type: 'title' }, { type: 'text', text: 'Potencia creadora, silencio total', size: 'xl' }],
              left: [{ type: 'items', items: [{ title: 'Materiales premium', text: 'Seleccionados uno a uno' }, { title: 'Hecho a medida', text: 'Configúralo a tu gusto' }] }],
              center: [{ type: 'photo', size: 'l', anim: 'float' }],
              right: [{ type: 'cta', label: 'Configurar el tuyo' }],
              bottom: [{ type: 'specs', count: 4 }],
            },
          },
        },
      }),
      dispatchAction: async (action) => {
        const type = action && action.type;
        // Qué sección del editor toca cada tool. Sirve para llevar al usuario
        // justo a lo que el agente acaba de cambiar en vez de dejarlo
        // buscándolo (y para saber que hay que recargar el formulario).
        const SECCION_DE = {
          SET_MODEL3D: 'modelo3d', BUILD_3D_STEPS: 'pasos', SET_PRODUCTO_STEPS: 'pasos',
          SET_STOREFRONT: 'ficha', COMPOSE_HERO: 'ficha',
          UPSERT_PRODUCTO: 'general', LINK_PRODUCT: 'general', APPLY_PRODUCTO: 'general',
        };
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
        const productoRefIn = (extra) => refIn(p, ['producto', 'productoId', 'productoName', 'producto_id', 'producto_name'].concat(extra || []));
        const compRefOf = (obj) => refIn(obj, ['component', 'componentId', 'componentName', 'component_id', 'id', 'name', 'nombre']);
        const eqNotFound = (ref) => ({
          success: false,
          error: (s(ref).trim() !== '' ? 'Producto no encontrado: "' + s(ref).trim() + '".' : 'Falta el campo "producto" en el payload.')
            + ' Productos existentes: ' + (model.productos.map((e) => '"' + e.name + '"').join(', ') || '(ninguno)')
            + '. Reintenta con payload {"producto": "<nombre, sku o id>", …}.',
        });
        // Pista para un editor que esté abierto: a qué sección lleva esta
        // acción. Si la acción falla no pasa nada, porque el editor solo
        // reacciona cuando el producto cambia de verdad (`updatedAt`).
        if (SECCION_DE[type]) { agentEdit.section = SECCION_DE[type]; agentEdit.at = Date.now(); }
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
            const r = await saveComponent(Object.assign({}, c, { cost, currency: p.currency ? normCurrency(p.currency) : c.currency, verifiedAt: nowIso() }));
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
                message: res.length ? res.map((x) => x.name + ': ' + fmtMoney(x.from) + ' → ' + fmtMoney(x.to) + (x.success ? '' : ' (ERROR: ' + s(x.error) + ')')).join(' · ') : 'Sin cambios de precio.',
              };
            }
            const prev = recalcPreview();
            return { success: true, message: prev.length ? 'Cambios pendientes: ' + prev.map((x) => x.eq.name + ' ' + fmtMoney(x.oldPrice) + ' → ' + fmtMoney(x.nextPrice)).join(' · ') : 'Sin cambios de precio.' };
          }
          if (type === 'APPLY_PRODUCTO') {
            const eqRef = productoRefIn(['id', 'name', 'nombre', 'sku']);
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
            if (p.priceMode != null) {
              const pm = s(p.priceMode).trim();
              if (PRICE_MODES.indexOf(pm) === -1) return { success: false, error: 'priceMode inválido: "' + pm + '". Válidos: auto (desde costos), fixed (a mano), store (el precio del catálogo).' };
              draft.priceMode = pm;
            }
            if (p.fixedPrice != null && p.fixedPrice !== '') {
              draft.fixedPrice = Math.max(0, num(p.fixedPrice, 0));
              // Escribir un precio a mano implica querer usarlo.
              if (p.priceMode == null && priceModeOf(draft) === 'auto') draft.priceMode = 'fixed';
            }
            const r = await saveProducto(draft);
            if (!r.success) return { success: false, error: r.error };
            const modo = priceModeOf(r.item);
            return { success: true, message: (existing ? 'Producto actualizado: ' : 'Producto creado: ') + r.item.name
              + ' · precio ' + (modo === 'auto' ? 'calculado desde costos' : modo === 'store' ? 'tomado del catálogo' : 'fijo') + ': ' + fmtMoney(r.item.price)
              + '. Define pasos con SET_PRODUCTO_STEPS (o BUILD_3D_STEPS si tiene visor 3D) y la ficha con SET_STOREFRONT.' };
          }
          if (type === 'SET_PRODUCTO_STEPS') {
            const eqRef = productoRefIn(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const steps = parseJson(p.steps);
            if (!Array.isArray(steps)) return { success: false, error: 'steps debe ser un array JSON de pasos. Forma: [{"label":"Acabado","values":[{"label":"Natural"}]}].' };
            const built = buildGroupsFromSteps(eq, steps);
            if (built.error) return { success: false, error: built.error };
            const r = await saveProducto(Object.assign({}, eq, { groups: built.groups }));
            if (!r.success) return { success: false, error: r.error };
            return { success: true, message: stepsMessage(r.item, built.warns) };
          }
          if (type === 'BUILD_3D_STEPS') {
            const eqRef = productoRefIn(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const m = eq.model3d;
            if (!m || !(m.parts || []).length) {
              return { success: false, error: 'El producto "' + eq.name + '" no tiene partes 3D. Usa SET_MODEL3D primero (url del .glb + parts[]).' };
            }
            const colors = (Array.isArray(p.colors) ? p.colors : []).filter((c) => c && s(c.label).trim());
            const useColors = p.mode === 'color' || (!((m.finishes || []).length) && colors.length > 0);
            if (!useColors && !(m.finishes || []).length) {
              return { success: false, error: 'El modelo de "' + eq.name + '" no tiene acabados definidos. Añádelos con SET_MODEL3D (finishes), o llama esta tool con mode:"color" y colors:[{"label":"Blanco","color":"#ffffff"}].' };
            }
            const partIds = (Array.isArray(p.parts) && p.parts.length ? p.parts : m.parts.map((x) => x.id)).map((x) => s(x).trim());
            const prefix = s(p.prefix), suffix = s(p.suffix);
            const missing = partIds.filter((pid) => !m.parts.some((x) => x.id === pid));
            if (missing.length) {
              return { success: false, error: 'Partes inexistentes: ' + missing.join(', ') + '. Partes del modelo: ' + m.parts.map((x) => x.id + ' ("' + (x.label || x.id) + '")').join(', ') + '.' };
            }
            const gen = partIds.map((pid) => {
              const part = m.parts.find((x) => x.id === pid);
              const values = useColors
                ? colors.map((c) => ({ label: s(c.label).trim(), swatchColor: s(c.color).trim(), components: [],
                    model3d: [{ partId: part.id, type: 'color', color: s(c.color).trim() }] }))
                : (m.finishes || []).map((f) => ({ label: f.label || f.id, swatchColor: f.color || '', components: [],
                    model3d: [{ partId: part.id, type: 'finish', finishId: f.id }] }));
              const defFin = !useColors && part.defaultFinish
                ? (m.finishes || []).find((f) => f.id === part.defaultFinish) : null;
              return {
                label: (prefix + (part.label || part.id) + suffix).trim(),
                default: defFin ? (defFin.label || defFin.id) : (values[0] && values[0].label),
                values,
              };
            });
            // append: conserva los pasos actuales y agrega los nuevos (para
            // packs de varias unidades, generando una tanda por unidad).
            const prev = p.append === true
              ? (eq.groups || []).map((g) => ({ label: g.label || typeLabel(g.typeId), type: g.typeId,
                  photoStep: g.photoStep === true,
                  default: (groupDefaultValue(g) || {}).label,
                  values: groupValues(g).map((v) => ({ label: v.label, imageUrl: v.imageUrl, swatchColor: v.swatchColor,
                    priceDelta: v.priceDelta, components: (v.componentIds || []), model3d: v.model3d })) }))
              : [];
            const built = buildGroupsFromSteps(eq, prev.concat(gen));
            if (built.error) return { success: false, error: built.error };
            const r = await saveProducto(Object.assign({}, eq, { groups: built.groups }));
            if (!r.success) return { success: false, error: r.error };
            return { success: true, message: 'Pasos generados desde el modelo 3D de "' + r.item.name + '": '
              + gen.map((x) => '"' + x.label + '" (' + x.values.length + ' opciones)').join(', ')
              + '. ' + stepsMessage(r.item, built.warns) };
          }
          if (type === 'COMPOSE_HERO') {
            const eqRef = productoRefIn(['id', 'name', 'nombre', 'sku']);
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
          if (type === 'SET_STOREFRONT') {
            const eqRef = productoRefIn(['id', 'name', 'nombre', 'sku']);
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
                if (sec.kind === 'specs' || sec.kind === 'note' || sec.kind === 'fotos') return;
                if (sec.kind === 'imagen') {
                  if (!s(sec.imageUrl).trim()) issues.push('sección ' + (i + 1) + ' (imagen): falta imageUrl (usa IMPORT_IMAGE para subir una imagen y obtener su URL)');
                  return;
                }
                const tag = 'sección ' + (i + 1);
                if (sec.kind !== undefined && sec.kind !== 'hero') issues.push(tag + ': kind inválido "' + s(sec.kind) + '" (válidos: hero, imagen, specs, fotos, note)');
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
                return { success: false, error: 'pageSections NO guardado: los heros llegaron SIN ningún bloque válido' + (existingBlocks > 0 ? ' (y la ficha actual tiene ' + existingBlocks + ' bloques que se perderían)' : '') + '. Los bloques van DENTRO de "slots", por contenedor del patrón. Ejemplo mínimo: {"kind":"hero","pattern":"clasico","slots":{"top":[{"type":"title"}],"left":[{"type":"items","items":[{"title":"Materiales premium","text":"A tu medida"}]}],"center":[{"type":"photo","size":"l"}]}}. El contrato completo está en snapshot.builderRef (sectionShape/blockSchema/example) y el estado actual en productos[].storefront.pageSections. Si de verdad quieres heros vacíos, envía allowEmpty:true.' };
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
            if (p.styleId !== undefined) {
              const v = s(p.styleId).trim();
              if (v && v !== 'own' && v !== 'catalog') {
                const t = styleTemplateById(v) || styleTemplates().find((x) => norm(x.name) === norm(v));
                if (!t) return { success: false, error: 'No hay ninguna plantilla de estilo "' + v + '". Las disponibles están en snapshot.styleTemplates; créala con SET_STYLE_TEMPLATE, o usa "own" (estilo propio) o "catalog" (la del catálogo).' };
                sf.styleId = t.id;
              } else sf.styleId = v === 'catalog' ? '' : v;
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
          // ── Plantillas de estilo del catálogo ──
          if (type === 'SET_STYLE_TEMPLATE') {
            const lista = styleTemplates();
            const clave = s(p.id).trim();
            const previa = clave
              ? (styleTemplateById(clave) || lista.find((x) => norm(x.name) === norm(clave)) || null)
              : null;
            if (clave && !previa) return { success: false, error: 'No hay ninguna plantilla "' + clave + '". Envía SET_STYLE_TEMPLATE sin id para crear una nueva; las existentes están en snapshot.styleTemplates.' };
            // El estilo puede llegar explícito o copiarse de un producto.
            let base = previa ? previa.style : normalizeStyle(null);
            if (p.from !== undefined) {
              const src = findProducto(s(p.from).trim());
              if (!src) return { success: false, error: 'No encontré el producto "' + p.from + '" del que copiar el estilo.' };
              base = resolveStyle(src);
            }
            if (p.style !== undefined) {
              const v = parseJson(p.style);
              if (!v || typeof v !== 'object' || Array.isArray(v)) return { success: false, error: 'style debe ser un objeto JSON (mismo formato que SET_STOREFRONT.style).' };
              base = normalizeStyle(Object.assign({}, base, v, {
                bar: Object.assign({}, base.bar, v.bar || {}),
                photos: Object.assign({}, base.photos, v.photos || {}),
              }));
            }
            const nombre = s(p.name).trim() || (previa && previa.name) || 'Estilo del catálogo';
            const item = { id: previa ? previa.id : newId('sty'), name: nombre, style: base };
            const next = previa ? lista.map((t) => (t.id === previa.id ? item : t)) : lista.concat([item]);
            const defId = p.setDefault === true ? item.id
              : (p.setDefault === false && s((model.def || {}).styleDefaultId) === item.id ? '' : s((model.def || {}).styleDefaultId));
            const r = await saveDefinition(Object.assign({}, model.def || defaultDefinition(), { styleTemplates: next, styleDefaultId: defId }));
            if (!r.success) return r;
            scheduleRepublish();
            const usan = model.productos.filter((eq) => s((eq.storefront || {}).styleId).trim() === item.id).length;
            return { success: true, message: 'Plantilla de estilo «' + item.name + '» ' + (previa ? 'actualizada' : 'creada') + ' (id ' + item.id + ')'
              + (defId === item.id ? ', y rige en todo el catálogo' : '')
              + '. La usan ' + usan + ' producto(s) de forma explícita. Engánchale más con APPLY_STYLE_TEMPLATE.' };
          }
          if (type === 'DELETE_STYLE_TEMPLATE') {
            const clave = s(p.id).trim();
            const lista = styleTemplates();
            const t = styleTemplateById(clave) || lista.find((x) => norm(x.name) === norm(clave));
            if (!t) return { success: false, error: 'No hay ninguna plantilla "' + clave + '". Las disponibles están en snapshot.styleTemplates.' };
            const defId = s((model.def || {}).styleDefaultId) === t.id ? '' : s((model.def || {}).styleDefaultId);
            const r = await saveDefinition(Object.assign({}, model.def || defaultDefinition(), {
              styleTemplates: lista.filter((x) => x.id !== t.id), styleDefaultId: defId,
            }));
            if (!r.success) return r;
            scheduleRepublish();
            return { success: true, message: 'Plantilla «' + t.name + '» borrada. Los productos que la usaban vuelven a su estilo propio.' };
          }
          if (type === 'APPLY_STYLE_TEMPLATE') {
            const clave = s(p.template).trim();
            let styleId = '';
            let etiqueta = 'la plantilla del catálogo';
            if (clave === 'own') { styleId = 'own'; etiqueta = 'su estilo propio'; }
            else if (clave && clave !== 'catalog') {
              const t = styleTemplateById(clave) || styleTemplates().find((x) => norm(x.name) === norm(clave));
              if (!t) return { success: false, error: 'No hay ninguna plantilla "' + clave + '". Créala con SET_STYLE_TEMPLATE; las existentes están en snapshot.styleTemplates.' };
              styleId = t.id; etiqueta = 'la plantilla «' + t.name + '»';
            }
            let destino;
            if (p.all === true) destino = model.productos.slice();
            else {
              const eq = findProducto(s(p.producto).trim());
              if (!eq) return { success: false, error: 'Indica un producto (producto: id/nombre/SKU) o all:true para todo el catálogo.' };
              destino = [eq];
            }
            let n = 0;
            for (const eq of destino) {
              const sf = Object.assign({}, eq.storefront || {}, { styleId });
              const r = await saveProducto(Object.assign({}, eq, { storefront: sf }));
              if (!r.success) return { success: false, error: 'Falló en "' + eq.name + '": ' + r.error };
              n++;
            }
            return { success: true, message: n + ' producto(s) usan ahora ' + etiqueta + '. Republicado automáticamente.' };
          }
          if (type === 'LINK_PRODUCT') {
            const eqRef = productoRefIn(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            const key = s(p.product).trim();
            const prod = model.catalog.find((x) => x.id === key)
              || model.catalog.find((x) => (x.sourceLinks || []).some((l) => l && l.integration === 'jumpseller' && String(l.sourceId) === key))
              || model.catalog.find((x) => norm(x.sku) === norm(key))
              || model.catalog.find((x) => norm(x.name) === norm(key))
              || model.catalog.find((x) => norm(x.name).indexOf(norm(key)) !== -1);
            if (!prod) return { success: false, error: 'Producto no encontrado en el catálogo de la app Productos: ' + key };
            const js = (prod.sourceLinks || []).find((l) => l && l.integration === 'jumpseller');
            const r = await saveProducto(Object.assign({}, eq, {
              storeRef: { instanceId: prod.__instanceId, itemId: prod.id, sourceId: js ? js.sourceId : null, sku: prod.sku || '', name: prod.name || '', imageUrl: prod.imageUrl || '' },
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
            if (!srcUrl) return { success: false, error: 'Indica url: path del storage del equipo, ruta /api/… o URL http(s).' };
            // path relativo del File Storage del equipo → endpoint de descarga
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
              const galRef = productoRefIn();
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
          if (type === 'SET_MODEL3D') {
            const eqRef = productoRefIn(['id', 'name', 'nombre', 'sku']);
            const eq = findProducto(eqRef);
            if (!eq) return eqNotFound(eqRef);
            if (p.remove === true) {
              const r = await saveProducto(Object.assign({}, eq, { model3d: null }));
              return r.success
                ? { success: true, message: 'Visor 3D quitado de "' + eq.name + '".' }
                : { success: false, error: r.error };
            }
            const cur = eq.model3d || { enabled: true, url: '', rotation: [0, 0, 0], parts: [], finishes: [] };
            const next = Object.assign({}, cur);
            if (p.url != null) next.url = s(p.url).trim();
            if (p.enabled != null) next.enabled = p.enabled !== false;
            if (p.publish != null) next.publish = p.publish === true;
            if (p.mirror != null) next.mirror = p.mirror === true;
            if (p.realSizeCm != null) next.realSizeCm = num(p.realSizeCm, 0);
            if (Array.isArray(p.rotation)) next.rotation = p.rotation;
            if (Array.isArray(p.parts)) next.parts = p.parts;
            if (Array.isArray(p.finishes)) next.finishes = p.finishes;
            const norm3d = normalizeModel3d(next);
            if (!norm3d) {
              return { success: false, error: 'Nada que guardar: indica al menos `url` (el .glb) o `parts`. Ejemplo: {"producto":"' + eq.name + '","url":"https://…/modelo.glb","parts":[{"label":"Tapiz","materials":["Tela_A"],"defaultColor":"#8a5a3b"}]}. Los nombres de material deben coincidir EXACTAMENTE con los del archivo 3D.' };
            }
            // Avisar de partes sin material válido en vez de fallar en silencio.
            const dropped = (Array.isArray(p.parts) ? p.parts : []).filter((x) => !toList(x && x.materials).length).length;
            const r = await saveProducto(Object.assign({}, eq, { model3d: norm3d }));
            if (!r.success) return { success: false, error: r.error };
            const m = r.item.model3d;
            return { success: true, message: 'Visor 3D de "' + eq.name + '" guardado: '
              + (m.enabled !== false && m.url ? 'activo' : 'inactivo') + ', ' + m.parts.length + ' parte(s), '
              + m.finishes.length + ' acabado(s)' + (m.publish ? ', publicado al theme' : '')
              + '.' + (dropped ? ' Aviso: ' + dropped + ' parte(s) ignorada(s) por no declarar materiales.' : '')
              + ' Vincula los pasos con SET_PRODUCTO_STEPS (campo model3d de cada valor).' };
          }
          if (type === 'LIST_SOURCES') {
            const r = await listOtherInstances();
            if (r.error) return { success: false, error: r.error };
            const list = (r.instances || []).map((i) => ({ id: i.id, name: i.name || i.id, template: i.templateId || '' }));
            if (!list.length) return { success: true, message: 'No hay otras instancias visibles para tu usuario (solo esta).' };
            return { success: true, message: 'Catálogos disponibles para migrar: '
              + list.map((i) => '"' + i.name + '" (id: ' + i.id + ', template: ' + i.template + ')').join(' · ')
              + '. Usa MIGRATE_FROM con {"origen": "<id>"}; con dryRun:true primero para ver cuánto trae.' };
          }
          if (type === 'MIGRATE_FROM') {
            const origen = s(refIn(p, ['origen', 'instancia', 'instanceId', 'from', 'source', 'id'])).trim();
            if (!origen) return { success: false, error: 'Falta "origen" (id de la instancia). Descúbrelo con LIST_SOURCES.' };
            const opts = {
              dryRun: p.dryRun === true,
              rules: p.rules !== false,
              productos: p.productos !== false,
              keepStoreLinks: p.keepStoreLinks !== false,
              mode: p.mode === 'skip' ? 'skip' : 'merge',
            };
            const r = await migrateFromInstance(origen, opts);
            if (!r.success && r.error) return { success: false, error: r.error + ' Usa LIST_SOURCES para ver los ids válidos.' };
            if (opts.dryRun) {
              return { success: true, message: 'Origen "' + origen + '": ' + r.conteo.components + ' componente(s), '
                + r.conteo.productos + ' producto(s)' + (r.conteo.rules ? ' y sus reglas de precio' : '')
                + '. Nada se escribió (dryRun). Repite sin dryRun para migrar.' };
            }
            return { success: r.success, message: 'Migración desde "' + origen + '" — ' + importSummary(r.res),
              error: r.success ? undefined : 'Migración con errores: ' + r.res.errors.slice(0, 4).join(' · ') };
          }
          if (type === 'EXPORT_DATA') {
            if (!shell.authFetch) return { success: false, error: 'authFetch no disponible en este host.' };
            const csv = norm(p.formato) === 'csv';
            const text = csv
              ? componentsCsv()
              : JSON.stringify(exportData({ productos: p.productos !== false, keepStoreLinks: p.keepStoreLinks !== false }), null, 2);
            const fecha = nowIso().slice(0, 10);
            const nombre = (csv ? 'componentes-' : 'productlab-') + fecha + (csv ? '.csv' : '.json');
            try {
              const file = new File([text], nombre, { type: csv ? 'text/csv' : 'application/json' });
              const url = await uploadFile(file, { folder: "exportaciones", maxMB: 20 });
              return { success: true, message: 'Exportado: ' + url + ' — ' + model.components.length + ' componente(s)'
                + (csv ? ' (CSV editable en planilla; vuelve con IMPORT_DATA {url})' : ' y ' + model.productos.length + ' producto(s)') + '.' };
            } catch (e) { return { success: false, error: 'No se pudo exportar: ' + ((e && e.message) || 'error') }; }
          }
          if (type === 'IMPORT_DATA') {
            let pack = parseJson(p.datos);
            if (!pack && s(p.url).trim()) {
              let url = s(p.url).trim();
              if (url.indexOf('/') === 0) url = API + url;
              try {
                const sameOrigin = url.indexOf(API) === 0;
                const res = sameOrigin ? await shell.authFetch(url) : await fetch(url, { mode: 'cors' });
                if (!res.ok) return { success: false, error: 'No se pudo descargar el archivo (HTTP ' + res.status + ').' };
                const text = await res.text();
                if (/^\s*[[{]/.test(text)) pack = JSON.parse(text);
                else {
                  const tiposCsv = [];
                  const r = componentsFromCsv(text, tiposCsv);
                  if (r.error) return { success: false, error: r.error };
                  pack = { format: DATA_FORMAT, components: r.components };
                  // Los tipos que aparecen en la planilla y aún no existen se
                  // crean con su etiqueta tal cual la escribió el usuario.
                  if (tiposCsv.length) pack.definition = { types: tiposCsv };
                }
              } catch (e) { return { success: false, error: 'No se pudo leer la URL: ' + ((e && e.message) || 'error') + '. Si es externa puede bloquearla CORS.' }; }
            }
            if (!pack || typeof pack !== 'object') {
              return { success: false, error: 'Indica "url" (JSON o CSV accesible) o "datos" con el paquete JSON {components:[…], productos:[…]}.' };
            }
            const res = await importData(pack, {
              rules: p.rules !== false, productos: p.productos !== false,
              keepStoreLinks: p.keepStoreLinks !== false, mode: p.mode === 'skip' ? 'skip' : 'merge',
            });
            return { success: res.errors.length === 0, message: 'Importación — ' + importSummary(res),
              error: res.errors.length ? 'Importado con errores: ' + res.errors.slice(0, 4).join(' · ') : undefined };
          }
          return { success: false, error: 'Acción desconocida: ' + s(type) + '. Acciones válidas: UPSERT_COMPONENT, SET_COMPONENT_COST, SET_MARGIN, RECALC_PRICES, APPLY_PRODUCTO, UPSERT_PRODUCTO, SET_PRODUCTO_STEPS, SET_STOREFRONT, COMPOSE_HERO, LINK_PRODUCT, SET_STOCK, PUBLISH_CONFIG, IMPORT_IMAGE, SET_MODEL3D, BUILD_3D_STEPS, LIST_SOURCES, MIGRATE_FROM, EXPORT_DATA, IMPORT_DATA.' };
        } catch (e) {
          console.error('[productlab] dispatchAction', type, e);
          return { success: false, error: (e && e.message) || 'Error interno.' };
        }
      },
    });
  }

  // ═════════════════════════════ UI ═════════════════════════════

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const Row = ({ label, children }) => h('div', { className: 'gp-row' }, [
    h('label', { key: 'l', className: 'gp-label' }, label),
    h(React.Fragment, { key: 'c' }, children),
  ]);
  const TextInput = (props) => {
    const p = Object.assign({}, props);
    const mono = p.mono;
    delete p.mono;
    p.className = 'gp-input' + (mono ? ' gp-mono' : '');
    return h('input', p);
  };
  // ── Visor 3D embebido ─────────────────────────────────────────────────────
  // El motor se carga con import() DIFERIDO desde los assets de la app: three.js
  // solo baja la primera vez que se abre un visor. Si ningún producto tiene
  // modelo 3D, no se descarga nunca.
  let enginePromise = null;
  function loadEngine() {
    if (!enginePromise) {
      const url = shell.assetUrl ? shell.assetUrl('engine3d.js') : './engine3d.js';
      enginePromise = import(url);
    }
    return enginePromise;
  }

  function Viewer3D({ model, state, height, onMaterials, onViewer }) {
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const [ready, setReady] = useState(0);
    const [err, setErr] = useState(null);

    useEffect(() => {
      let cancelled = false;
      loadEngine().then((mod) => {
        if (cancelled || !canvasRef.current) return;
        viewerRef.current = mod.createViewer(canvasRef.current);
        // Se expone hacia fuera: generar el .glb de AR necesita el visor vivo,
        // con el modelo ya cargado y los acabados aplicados.
        if (onViewer) onViewer(viewerRef.current);
        setReady((n) => n + 1);
      }).catch((e) => { if (!cancelled) setErr('No se pudo cargar el motor 3D: ' + ((e && e.message) || 'error')); });
      return () => {
        cancelled = true;
        if (viewerRef.current) { viewerRef.current.dispose(); viewerRef.current = null; if (onViewer) onViewer(null); }
      };
    }, []);

    // Serializar evita recargar por identidad de objeto (el editor recrea el
    // draft a cada tecla). Y va en TRES claves, no en una: descargar el .glb
    // es lo único caro, y solo hace falta cuando cambia el archivo o su
    // orientación. Con una sola clave, tocar un color de acabado recargaba el
    // modelo entero — la pieza desaparecía y salía "Cargando…" en cada tecla.
    const geomKey = JSON.stringify(model
      ? { url: model.url, rotation: model.rotation, mirror: model.mirror } : null);
    const partsKey = JSON.stringify((model && model.parts) || null);
    const finishKey = JSON.stringify((model && model.finishes) || null);
    const stateKey = JSON.stringify(state || null);

    useEffect(() => {
      const v = viewerRef.current;
      if (!v || !model || !model.url) return;
      let cancelled = false;
      v.setModel({ url: model.url, rotation: model.rotation, mirror: model.mirror, parts: model.parts })
        .then(() => {
          if (cancelled) return;
          v.setFinishes(model.finishes || []);
          v.setState(JSON.parse(stateKey));
          setErr(null);
          if (onMaterials) onMaterials(v.materialNames());
        })
        .catch((e) => { if (!cancelled) setErr('No se pudo cargar el modelo: ' + ((e && e.message) || 'error')); });
      return () => { cancelled = true; };
    }, [ready, geomKey]);

    // Partes y acabados: se reaplican sobre el modelo ya cargado.
    useEffect(() => {
      const v = viewerRef.current;
      if (v && v.setParts && model && model.url) v.setParts(JSON.parse(partsKey) || []);
    }, [ready, partsKey]);

    useEffect(() => {
      const v = viewerRef.current;
      if (v && model && model.url) { v.setFinishes(JSON.parse(finishKey) || []); }
    }, [ready, finishKey]);

    useEffect(() => {
      const v = viewerRef.current;
      if (v) v.setState(JSON.parse(stateKey));
    }, [ready, stateKey]);

    return h('div', { className: 'gp-viewer3d', style: { height: height || 340 } }, [
      h('canvas', { key: 'c', ref: canvasRef, className: 'gp-viewer3d-canvas' }),
      err ? h('div', { key: 'e', className: 'gp-viewer3d-msg' }, err)
        : !ready ? h('div', { key: 'l', className: 'gp-viewer3d-msg' }, 'Cargando visor 3D…') : null,
    ]);
  }

  function Thumb({ url }) {
    return url
      ? h('img', { className: 'gp-thumb', src: url, alt: '' })
      : h('div', { className: 'gp-thumb-ph' }, '📦');
  }
  // Subida de imágenes al área compartida de KIMOS (imagenes/ es escribible por
  // cualquier usuario autenticado y se sirve públicamente vía /api/public/files).
  // Subida genérica al área pública. Todo cuelga de `imagenes/` porque ese es
  // uno de los prefijos que el gateway público sirve sin autenticación; el
  // endpoint no restringe el tipo de archivo, así que los modelos 3D viajan
  // por el mismo camino que las fotos (sin tocar el backend).
  async function uploadFile(file, opts) {
    const o = opts || {};
    const maxMB = o.maxMB || 8;
    if (!shell.authFetch) throw new Error('authFetch no disponible en este host');
    if (file.size > maxMB * 1024 * 1024) throw new Error('máximo ' + maxMB + ' MB');
    const fallback = o.fallbackName || 'archivo';
    const safe = s(file.name || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
    const path = 'imagenes/productlab/' + (o.folder ? o.folder + '/' : '')
      + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-' + safe;
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
  const uploadImage = (file) => uploadFile(file, { maxMB: 8, fallbackName: 'imagen' });
  const uploadModel = (file) => uploadFile(file, { maxMB: 60, fallbackName: 'modelo.glb', folder: 'modelos' });
  // Campo de color: selector nativo + hex editable; vacío = automático/default.
  function ColorField({ label, value, onChange, placeholder }) {
    const valid = /^#[0-9a-fA-F]{6}$/.test(s(value).trim());
    const control = h('div', { className: 'gp-verify-cost' }, [
      h('input', { key: 'c', type: 'color', value: valid ? value.trim() : '#ffffff', onChange: (e) => onChange(e.target.value), style: { width: 36, height: 32, padding: 0, border: '1px solid var(--gp-gris-claro)', background: '#fff', cursor: 'pointer' } }),
      h(TextInput, { key: 't', mono: true, value: value || '', onChange: (e) => onChange(e.target.value), placeholder: placeholder || '#FFFFFF (vacío = automático)', style: { width: 200 } }),
      value ? h('button', { key: 'x', className: 'gp-btn gp-btn-sm', title: 'Volver al automático', onClick: () => onChange('') }, '✕') : null,
    ]);
    return label != null ? h(Row, { label }, control) : control;
  }
  // Campo de imagen: URL editable + botón "Subir…" (input file) + miniatura.
  // Con `gallery` (urls de la galería del producto) agrega el picker "Galería…".
  function ImgField({ label, value, onChange, placeholder, gallery }) {
    const [busy, setBusy] = useState(false);
    const [showGal, setShowGal] = useState(false);
    const galBtn = Array.isArray(gallery) && gallery.length
      ? h('button', { key: 'gal', className: 'gp-btn gp-btn-sm' + (showGal ? ' gp-btn-dark' : ''), title: 'Elegir de la galería del producto (' + gallery.length + ' fotos)', onClick: () => setShowGal(!showGal) }, 'Galería…')
      : null;
    const galStrip = showGal && Array.isArray(gallery) && gallery.length
      ? h('div', { key: 'strip', style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, padding: 6, border: '1px dashed var(--gp-gris-claro)', background: 'var(--gp-plata)' } },
          gallery.map((u, i) => h('img', {
            key: i, src: u, alt: 'Foto ' + (i + 1),
            title: 'Foto ' + (i + 1) + ' de la galería — clic para usar',
            onClick: () => { onChange(u); setShowGal(false); },
            style: { width: 64, height: 64, objectFit: 'cover', cursor: 'pointer', background: '#fff', border: value === u ? '2px solid var(--gp-fucsia)' : '1px solid var(--gp-gris-claro)' },
          })))
      : null;
    const control = h('div', { className: 'gp-verify-cost', style: { width: '100%' } }, [
      h(Thumb, { key: 't', url: value }),
      h(TextInput, { key: 'i', mono: true, value: value || '', onChange: (e) => onChange(e.target.value), placeholder: placeholder || 'https://… o usa Subir', style: { flex: 1, minWidth: 120 } }),
      h('label', { key: 'up', className: 'gp-btn gp-btn-sm', style: { cursor: 'pointer' } }, [
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
      value ? h('button', { key: 'x', className: 'gp-btn gp-btn-sm', title: 'Quitar imagen', onClick: () => onChange('') }, '✕') : null,
    ]);
    const wrapped = galStrip ? h('div', { style: { width: '100%' } }, [h(React.Fragment, { key: 'c' }, control), galStrip]) : control;
    return label != null ? h(Row, { label }, wrapped) : wrapped;
  }
  function Modal({ title, onClose, children }) {
    return h('div', { className: 'gp-overlay', onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
      h('div', { className: 'gp-modal' }, [
        h('div', { key: 'h', className: 'gp-modal-head' }, [
          h('span', { key: 't', className: 't' }, title),
          h('button', { key: 'x', onClick: onClose, title: 'Cerrar' }, '✕'),
        ]),
        h('div', { key: 'b', className: 'gp-modal-body' }, children),
      ]));
  }
  function SyncBadge({ eq }) {
    if (!storeRefOf(eq)) {
      return legacyLink(eq)
        ? h('span', { className: 'gp-chip warn' }, 're-enlazar')
        : h('span', { className: 'gp-chip gris' }, 'sin enlace');
    }
    const lp = eq.lastPush;
    if (!lp) return h('span', { className: 'gp-chip warn' }, 'sin aplicar');
    if (lp.status === 'synced') return h('span', { className: 'gp-chip ok', title: 'Aplicado ' + fmtDateTime(lp.at) + ' · ' + num(lp.variantCount) + ' variantes' }, 'en tienda');
    return h('span', { className: 'gp-chip err', title: (lp.errors || []).join(' · ') }, 'error de sync');
  }

  // ── Formulario de componente ──────────────────────────────────────────────
  function ComponentForm({ initial, onDone, sec }) {
    sec = sec || 'general';
    const [d, setD] = useState(() => Object.assign({
      name: '', type: types()[0].id, brand: '', specs: '', imageUrl: '', currency: rules().currency, cost: 0, taxPct: 0,
      supplierName: '', supplierUrl: '', deliveryDays: 0, stock: null, storeRef: null,
      tags: [], requires: [], excludes: [], altIds: [], active: true, notes: '',
    }, initial || {}));
    const [busy, setBusy] = useState(false);
    // Texto en curso y foco del buscador de tags (uno por campo).
    const [tagTx, setTagTx] = useState({});
    const [tagFoco, setTagFoco] = useState('');
    const [altQ, setAltQ] = useState('');   // buscador de alternativos
    const up = (patch) => setD(Object.assign({}, d, patch));
    const preview = componentSale(normalizeComponent(Object.assign({}, d, { id: d.id || 'x' })));
    // ── Pestaña ALTERNATIVOS: componentes intercambiables entre sí ──
    // El enlace es simétrico (al guardar, este componente queda también como
    // alternativo del otro). En los productos, un valor que acepte
    // alternativas usa SIEMPRE el más barato disponible del grupo.
    const panelAlternativos = (function () {
      const alts = (d.altIds || []).map(compById).filter(Boolean);
      const q = altQ.trim().toLowerCase();
      const res = q.length < 2 ? [] : model.components.filter((c) =>
        c.id !== d.id && (d.altIds || []).indexOf(c.id) === -1
        && (c.name || '').toLowerCase().indexOf(q) !== -1).slice(0, 8);
      return h('div', { key: 'salt', style: sec === 'alternativos' ? null : { display: 'none' } }, [
        h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 10 } },
          'Alternativos = componentes INTERCAMBIABLES con este (mismo rol, otro proveedor o marca). El enlace queda en ambos sentidos al guardar. Donde un producto acepte alternativas, se usa el más barato disponible del grupo — igual que la lógica de siempre.'),
        h('div', { key: 'chips', style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 } },
          alts.length ? alts.map((c) => h('span', { key: c.id, className: 'gp-chip ' + (compAvailable(c) ? 'gris' : 'err'),
            style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12 } }, [
            h('span', { key: 'n' }, c.name + ' · ' + fmtMoney(componentSale(c)) + (c.stock == null ? '' : ' · stock ' + num(c.stock))),
            h('button', { key: 'x', className: 'gp-btn gp-btn-sm', title: 'Desenlazar (se quita de ambos lados al guardar)',
              onClick: () => up({ altIds: (d.altIds || []).filter((x) => x !== c.id) }) }, '✕'),
          ])) : h('span', { key: 'e', className: 'gp-muted' }, 'Sin alternativos aún: busca abajo para enlazar.')),
        h('div', { key: 'buscar', style: { position: 'relative', maxWidth: 460 } }, [
          h(TextInput, { key: 'q', value: altQ, placeholder: '🔍 buscar componente para enlazar como alternativo…',
            onChange: (e) => setAltQ(e.target.value) }),
          res.length > 0 && h('div', { key: 'res', style: {
            position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%', maxHeight: 260, overflowY: 'auto',
            background: 'var(--gp-blanco)', border: '1px solid var(--gp-gris-claro)', boxShadow: '0 8px 20px rgba(0,0,0,.15)',
          } }, res.map((c) => h('div', { key: c.id,
            style: { padding: '8px 10px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline', borderBottom: '1px solid var(--gp-linea)' },
            onMouseDown: () => { up({ altIds: (d.altIds || []).concat([c.id]) }); setAltQ(''); },
          }, [
            h('span', { key: 'n', style: { fontWeight: 600 } }, c.name),
            h('span', { key: 't', className: 'gp-muted', style: { fontSize: 11 } }, typeLabel(c.type)),
            c.type !== d.type ? h('span', { key: 'w', className: 'gp-chip warn', style: { fontSize: 10 } }, 'otro tipo') : null,
            h('span', { key: 'p', style: { marginLeft: 'auto', fontSize: 12 } }, fmtMoney(componentSale(c))),
          ]))),
        ]),
      ]);
    })();
    // ── Pestaña COMPATIBLES: productos del catálogo frente a los tags ──
    const panelCompatibles = (function () {
      const filas = model.productos.map((p) => {
        const enUso = (p.baseComponentIds || []).indexOf(d.id) !== -1
          || (p.groups || []).some((g) => groupValues(g).some((v) => (v.componentIds || []).indexOf(d.id) !== -1));
        const aporta = new Set();
        (p.baseComponentIds || []).map(compById).filter(Boolean).forEach((c) => (c.tags || []).forEach((t) => aporta.add(t)));
        (p.groups || []).forEach((g) => groupValues(g).forEach((v) => (v.componentIds || []).map(compById).filter(Boolean)
          .forEach((c) => (c.tags || []).forEach((t) => aporta.add(t)))));
        const veta = (d.excludes || []).filter((t) => aporta.has(t));
        const falta = (d.requires || []).filter((t) => !aporta.has(t) && aporta.size > 0);
        return { p, enUso, veta, falta };
      });
      return h('div', { key: 'scomp', style: sec === 'compatibles' ? null : { display: 'none' } }, [
        h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 10 } },
          'Cómo se lleva este componente con cada producto del catálogo, según los tags (aporta/requiere/incompatible). Es informativo: las combinaciones vetadas jamás se publican en la tienda.'),
        filas.length === 0 ? h('div', { key: 'e', className: 'gp-muted' }, 'Aún no hay productos en el catálogo.') : null,
        h(React.Fragment, { key: 'l' }, filas.map(({ p, enUso, veta, falta }) => h('div', { key: p.id, className: 'gp-compline' }, [
          h('span', { key: 'n', className: 'grow', style: { fontWeight: 600 } }, p.name),
          enUso ? h('span', { key: 'u', className: 'gp-chip fuc' }, 'en uso') : null,
          veta.length ? h('span', { key: 'v', className: 'gp-chip err' }, '⚠ incompatible: ' + veta.join(', '))
            : falta.length ? h('span', { key: 'f', className: 'gp-chip warn' }, 'requiere: ' + falta.join(', '))
            : h('span', { key: 'ok', className: 'gp-chip ok' }, 'compatible'),
        ]))),
      ]);
    })();
    return h('div', null, [
      panelAlternativos,
      panelCompatibles,
      h('div', { key: 'sgen', style: sec === 'general' ? null : { display: 'none' } }, [
      h('div', { key: 'g1', className: 'gp-grid2' }, [
        h(Row, { key: 'n', label: 'Nombre *' }, h(TextInput, { value: d.name, onChange: (e) => up({ name: e.target.value }), placeholder: 'Ej: Tela algodón 20/1 · Tablero roble 18mm · Corte CNC' })),
        h(Row, { key: 't', label: 'Tipo' }, h('select', { className: 'gp-select', value: d.type, onChange: (e) => up({ type: e.target.value }) },
          types().map((t) => h('option', { key: t.id, value: t.id }, t.label)))),
        h(Row, { key: 'b', label: 'Marca' }, h(TextInput, { value: d.brand, onChange: (e) => up({ brand: e.target.value }) })),
        h(ImgField, { key: 'i', label: 'Imagen (se muestra en el configurador de la tienda)', value: d.imageUrl, onChange: (v) => up({ imageUrl: v }) }),
      ]),
      h(Row, { key: 'sp', label: 'Specs / descripción corta (se muestra bajo el nombre en la tienda)' },
        h(TextInput, { value: d.specs, onChange: (e) => up({ specs: e.target.value }), placeholder: 'Ej: Roble macizo · 120×60 cm · 18 mm' })),
      d.storeRef && d.storeRef.itemId && h('div', { key: 'pref', className: 'gp-compline' }, [
        h('span', { key: 'c', className: 'gp-chip fuc' }, 'PRODUCTO DE LA TIENDA'),
        h('span', { key: 'm', className: 'gp-muted' }, (d.storeRef.sourceId ? 'JS #' + d.storeRef.sourceId + ' · ' : '') + 'importado del catálogo; revisa que el costo sea el de PROVEEDOR (no el precio de venta).'),
      ]),
      h('div', { key: 'g2', className: 'gp-grid2' }, [
        h(Row, { key: 'c', label: 'Costo proveedor *' }, h(TextInput, { mono: true, type: 'number', min: 0, value: d.cost, onChange: (e) => up({ cost: e.target.value }) })),
        h(Row, { key: 'm', label: 'Moneda' }, h('select', { className: 'gp-select', value: d.currency, onChange: (e) => up({ currency: e.target.value }) },
          costCurrencies().map((c) => h('option', { key: c, value: c }, c)))),
        h(Row, { key: 'tx', label: 'Impuesto adicional % sobre el costo (aduana, importación, recargo del proveedor; 0 = sin)' },
          h(TextInput, { mono: true, type: 'number', min: 0, value: d.taxPct == null ? 0 : d.taxPct, onChange: (e) => up({ taxPct: e.target.value }) })),
        h(Row, { key: 'st', label: 'Stock (vacío = sin control; 0 = no elegible)' }, h(TextInput, { mono: true, type: 'number', min: 0, value: d.stock == null ? '' : d.stock, onChange: (e) => up({ stock: e.target.value === '' ? null : e.target.value }) })),
        h(Row, { key: 'd', label: 'Días de entrega del proveedor' }, h(TextInput, { mono: true, type: 'number', min: 0, value: d.deliveryDays, onChange: (e) => up({ deliveryDays: e.target.value }) })),
      ]),
      h('div', { key: 'g3', className: 'gp-grid2' }, [
        h(Row, { key: 'sn', label: 'Proveedor' }, h(TextInput, { value: d.supplierName, onChange: (e) => up({ supplierName: e.target.value }), placeholder: 'Ej: Textiles del Sur / Taller externo / Importador' })),
        h(Row, { key: 'su', label: 'Link del proveedor (para verificar precio)' }, h(TextInput, { mono: true, value: d.supplierUrl, onChange: (e) => up({ supplierUrl: e.target.value }), placeholder: 'https://…' })),
      ]),
      // ── Compatibilidades por tags ──
      // Chips (con ✕ para quitar) + buscador con sugerencias, igual que el
      // buscador de componentes: al enfocar se ven los tags ya usados en el
      // catálogo, al escribir se filtran, y Enter (o clic) agrega. Nada de
      // recordar la ortografía exacta ("plataforma:amd" vs "plataforma: AMD").
      (function () {
        const usados = Array.from(new Set(model.components.reduce((a, c) =>
          a.concat(c.tags || [], c.requires || [], c.excludes || []), []))).sort();
        const CampoTags = ({ campo, valor }) => {
          const lista = Array.isArray(valor) ? valor : parseList(valor);
          const tx = s(tagTx[campo]);
          const setTx = (t) => setTagTx(Object.assign({}, tagTx, { [campo]: t }));
          const agregar = (t) => {
            t = s(t).trim().toLowerCase();
            if (t && lista.indexOf(t) === -1) up({ [campo]: lista.concat([t]) });
            setTx('');
          };
          const q = tx.trim().toLowerCase();
          const sug = usados.filter((t) => lista.indexOf(t) === -1 && (!q || t.indexOf(q) !== -1)).slice(0, 12);
          return h('div', { style: { width: '100%' } }, [
            lista.length ? h('div', { key: 'chips', style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 } },
              lista.map((t) => h('span', { key: t, className: 'gp-chip gris', style: { display: 'inline-flex', alignItems: 'center', gap: 4 } }, [
                h('span', { key: 'n' }, t),
                h('button', { key: 'x', className: 'gp-btn gp-btn-sm', style: { padding: '0 5px', lineHeight: 1.2 }, title: 'Quitar',
                  onClick: () => up({ [campo]: lista.filter((x) => x !== t) }) }, '✕'),
              ]))) : null,
            h('div', { key: 'in', style: { position: 'relative' } }, [
              h(TextInput, { key: 'i', mono: true, value: tx,
                placeholder: campo === 'tags' ? 'ej: plataforma:amd — Enter agrega' : 'ej: plataforma:amd',
                onChange: (e) => setTx(e.target.value),
                onFocus: () => setTagFoco(campo),
                onBlur: (e) => { if (s(e.target.value).trim()) agregar(e.target.value); setTagFoco(''); },
                onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregar(tx); } } }),
              (tagFoco === campo && sug.length) ? h('div', { key: 'dd', style: {
                position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%',
                maxHeight: 200, overflowY: 'auto',
                background: '#fff', border: '1px solid var(--gp-gris-claro)', boxShadow: '0 8px 20px rgba(0,0,0,.15)',
              } }, sug.map((t) => h('div', { key: t,
                style: { padding: '5px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12, borderBottom: '1px solid var(--gp-plata)' },
                onMouseDown: (e) => { e.preventDefault(); agregar(t); } }, t))) : null,
            ]),
          ]);
        };
        // OJO: CampoTags se llama como función (no como componente montado):
        // se redefine en cada render y montarla haría que React desmonte y
        // remonte el input en cada tecla, perdiendo el foco al escribir.
        return h('div', { key: 'g4', className: 'gp-grid3' }, [
          h(Row, { key: 'tg', label: 'Aporta (tags: lo que este componente ES)' }, CampoTags({ campo: 'tags', valor: d.tags })),
          h(Row, { key: 'rq', label: 'Requiere (un tag de OTRO componente)' }, CampoTags({ campo: 'requires', valor: d.requires })),
          h(Row, { key: 'ex', label: 'Incompatible con (tag que lo veta)' }, CampoTags({ campo: 'excludes', valor: d.excludes })),
        ]);
      })(),
      h('div', { key: 'g4h', className: 'gp-muted', style: { marginTop: -4 } },
        'Las combinaciones que violan un "requiere" o un "incompatible con" NO se publican en la tienda: etiquetar bien evita crear pasos dependientes a mano.'),
      h('label', { key: 'ac', className: 'gp-switch' }, [
        h('input', { key: 'c', type: 'checkbox', checked: d.active !== false, onChange: (e) => up({ active: e.target.checked }) }),
        h('span', { key: 's' }, 'Activo (disponible en el configurador)'),
      ]),
      h('div', { key: 'pv', className: 'gp-muted' }, [
        'Precio de venta calculado: ',
        h('b', { key: 'p', className: 'gp-price' }, fmtMoney(preview)),
        ' — margen ' + marginFor(d.type) + '% + ' + rules().salesTaxLabel + ' ' + rules().salesTaxPct + '%',
      ]),
      ]),
      // Guardar es común a las tres pestañas (general/alternativos/compatibles).
      h('div', { key: 'a', className: 'gp-actions' }, [
        h('button', { key: 'save', className: 'gp-btn gp-btn-primary', disabled: busy || !s(d.name).trim(), onClick: async () => {
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
    // El detalle vive en el nav store (breadcrumb + pestañas en el header).
    const n = useNav();
    const editing = n.det && n.det.tipo === 'componente' && n.sec === 'componentes' ? n.det.draft : null;
    const setEditing = (c) => setNav(c == null
      ? { det: null, tab: null }
      : { det: { tipo: 'componente', draft: c, nombre: c.name || 'Nuevo componente' }, tab: 'general' });
    const [pickingStore, setPickingStore] = useState(false);
    const [costDrafts, setCostDrafts] = useState({}); // verificación rápida por fila
    const [stockDrafts, setStockDrafts] = useState({}); // stock inline por fila
    const [selIds, setSelIds] = useState({});           // selección para acciones masivas
    const [bulkStock, setBulkStock] = useState('');
    // Inventario tipo videojuego: CARDS por tipo (default) o la tabla densa.
    const [vista, setVista] = useState('cards');
    const [verTodo, setVerTodo] = useState({});         // tipo → mostrar todos
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
      // Título y volver los pone el header (breadcrumb); aquí solo el cuerpo,
      // grande y centrado, a todo el espacio disponible.
      return h('div', { className: 'gp-editor' },
        h('div', { key: 'body', className: 'gp-editor-body' },
          h('div', { className: 'gp-card gp-comp-ficha' },
            h(ComponentForm, { initial: isEdit ? editing : null, sec: n.tab || 'general', onDone: () => setEditing(null) }))));
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
      h('div', { key: 'f', className: 'gp-filters gp-filters-centro' }, [
        h('div', { key: 'sw', className: 'gp-vswitch' }, [
          h('button', { key: 'c', className: 'gp-btn gp-btn-sm' + (vista === 'cards' ? ' gp-btn-dark' : ''), onClick: () => setVista('cards') }, 'Cards'),
          h('button', { key: 't', className: 'gp-btn gp-btn-sm' + (vista === 'tabla' ? ' gp-btn-dark' : ''), onClick: () => setVista('tabla') }, 'Tabla'),
        ]),
        h('button', { key: 'new', className: 'gp-btn gp-btn-primary', onClick: () => setEditing({}) }, '+ Componente'),
        h('button', { key: 'store', className: 'gp-btn', title: 'Importar un producto del catálogo de la tienda como componente', onClick: () => setPickingStore(true) }, '+ Desde la tienda'),
        h('select', { key: 't', className: 'gp-select', style: { maxWidth: 180 }, value: filterType, onChange: (e) => setFilterType(e.target.value) },
          [h('option', { key: '', value: '' }, 'Todos los tipos')].concat(types().map((t) => h('option', { key: t.id, value: t.id }, t.label)))),
        h(TextInput, { key: 's', value: search, onChange: (e) => setSearch(e.target.value), placeholder: 'Buscar…', style: { maxWidth: 220 } }),
        h('label', { key: 'st', className: 'gp-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: onlyStale, onChange: (e) => setOnlyStale(e.target.checked) }),
          h('span', { key: 's' }, 'Por verificar (+' + r.staleDays + ' días, más antiguos primero)'),
        ]),
        h('span', { key: 'n', className: 'gp-muted' }, list.length + ' de ' + state.components.length),
      ]),
      (function () {
        const count = Object.keys(selIds).filter((k) => selIds[k]).length;
        if (!count) return null;
        return h('div', { key: 'bulk', className: 'gp-card', style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--gp-fucsia)' } }, [
          h('b', { key: 'n', style: { fontSize: 12 } }, count + ' seleccionado(s):'),
          h('button', { key: 'v', className: 'gp-btn gp-btn-sm gp-btn-dark', onClick: () => bulkApply(() => ({ verifiedAt: nowIso() }), 'Verificados hoy') }, 'Verificar hoy ✓'),
          h('button', { key: 'on', className: 'gp-btn gp-btn-sm', onClick: () => bulkApply(() => ({ active: true }), 'Activados') }, 'Activar'),
          h('button', { key: 'off', className: 'gp-btn gp-btn-sm', onClick: () => bulkApply(() => ({ active: false }), 'Desactivados') }, 'Desactivar'),
          h('span', { key: 'sep', style: { width: 10 } }),
          h(TextInput, { key: 'st', mono: true, type: 'number', min: 0, value: bulkStock, onChange: (e) => setBulkStock(e.target.value), placeholder: 'stock (vacío = ∞)', style: { width: 130 } }),
          h('button', { key: 'sb', className: 'gp-btn gp-btn-sm', onClick: () => bulkApply(() => ({ stock: bulkStock === '' ? null : Math.max(0, num(bulkStock, 0)) }), 'Stock actualizado') }, 'Fijar stock'),
          h('span', { key: 'sp', className: 'grow', style: { flex: 1 } }),
          h('button', { key: 'x', className: 'gp-btn gp-btn-sm', onClick: () => setSelIds({}) }, 'Deseleccionar'),
        ]);
      })(),
      state.components.length === 0
        ? h('div', { key: 'e', className: 'gp-card gp-muted' }, 'Aún no hay componentes. Crea tu catálogo de insumos —telas, materias primas, piezas, mano de obra o procesos externalizados— con su costo y link de proveedor (o impórtalos desde la tienda); luego arma los productos en la pestaña Productos.')
        : vista === 'cards'
        ? (function () {
            // Mosaico por TIPO: grupos reordenables (se guarda en definition.ui)
            // con cards chicas de inventario; cada grupo enseña un puñado y
            // "Ver todos" lo abre completo.
            const orden = (state.def && state.def.ui && Array.isArray(state.def.ui.compTypeOrder)) ? state.def.ui.compTypeOrder : [];
            const tipos = types().filter((t) => list.some((c) => c.type === t.id))
              .sort((a, b) => {
                const ia = orden.indexOf(a.id), ib = orden.indexOf(b.id);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
              });
            const mover = async (tid, dir) => {
              const ids = tipos.map((t) => t.id);
              const i = ids.indexOf(tid), j = i + dir;
              if (j < 0 || j >= ids.length) return;
              const xs = ids.slice(); const tmp = xs[i]; xs[i] = xs[j]; xs[j] = tmp;
              await saveDefinition(Object.assign({}, state.def || defaultDefinition(),
                { ui: Object.assign({}, (state.def || {}).ui, { compTypeOrder: xs }) }));
            };
            const LIM = 12;
            return h('div', { key: 'inv', className: 'gp-inv' }, tipos.map((t, ti) => {
              const del = list.filter((c) => c.type === t.id);
              const abierto = !!verTodo[t.id];
              const visibles = abierto ? del : del.slice(0, LIM);
              return h('div', { key: t.id, className: 'gp-inv-grupo' }, [
                h('div', { key: 'h', className: 'gp-inv-head' }, [
                  h('span', { key: 'l', className: 'gp-inv-titulo' }, t.label),
                  h('span', { key: 'n', className: 'gp-muted' }, String(del.length)),
                  h('span', { key: 'sp', style: { flex: 1 } }),
                  ti > 0 ? h('button', { key: 'u', className: 'gp-btn gp-btn-sm', title: 'Subir el grupo en el mosaico', onClick: () => mover(t.id, -1) }, '↑') : null,
                  ti < tipos.length - 1 ? h('button', { key: 'd', className: 'gp-btn gp-btn-sm', title: 'Bajar el grupo en el mosaico', onClick: () => mover(t.id, 1) }, '↓') : null,
                  del.length > LIM ? h('button', { key: 'todo', className: 'gp-btn gp-btn-sm' + (abierto ? ' gp-btn-dark' : ''),
                    onClick: () => setVerTodo(Object.assign({}, verTodo, { [t.id]: !abierto })) },
                    abierto ? 'Ver menos' : 'Ver todos (' + del.length + ')') : null,
                ]),
                h('div', { key: 'g', className: 'gp-inv-grid' }, visibles.map((c) => {
                  const stale = daysSince(c.verifiedAt) > r.staleDays;
                  const cDraft = costDrafts[c.id];
                  const sDraft = stockDrafts[c.id];
                  return h('div', { key: c.id, className: 'gp-icard' + (c.active === false ? ' off' : '') }, [
                    h('div', { key: 'f', className: 'gp-icard-foto', onClick: () => setEditing(c), title: 'Abrir "' + c.name + '"' },
                      c.imageUrl ? h('img', { src: c.imageUrl, alt: '' }) : h('span', { className: 'gp-muted' }, '📦')),
                    h('div', { key: 'n', className: 'gp-icard-nombre', onClick: () => setEditing(c), title: c.name }, c.name),
                    h('div', { key: 'p', className: 'gp-icard-precio' }, fmtMoney(componentSale(c))),
                    stale ? h('span', { key: 'w', className: 'gp-chip warn', style: { fontSize: 9, alignSelf: 'center' } }, 'por verificar') : null,
                    h('div', { key: 'e', className: 'gp-icard-edit' }, [
                      h(TextInput, { key: 'c', mono: true, type: 'number', min: 0, title: 'Costo proveedor',
                        value: cDraft == null ? num(c.cost) : cDraft, onChange: (ev) => setCostDraft(c.id, ev.target.value) }),
                      h(TextInput, { key: 's', mono: true, type: 'number', min: 0, title: 'Stock (vacío = sin control)', placeholder: '∞',
                        value: sDraft == null ? (c.stock == null ? '' : num(c.stock)) : sDraft,
                        onChange: (ev) => { const o = Object.assign({}, stockDrafts); o[c.id] = ev.target.value; setStockDrafts(o); } }),
                      h('button', { key: 'g', className: 'gp-btn gp-btn-sm gp-btn-primary', title: 'Guardar costo y stock', onClick: async () => {
                        const nc = cDraft == null || cDraft === '' ? num(c.cost) : num(cDraft, NaN);
                        if (!Number.isFinite(nc) || nc < 0) { shell.notify({ level: 'warn', text: 'Costo inválido.' }); return; }
                        const ns = sDraft == null ? (c.stock == null ? null : num(c.stock)) : (sDraft === '' ? null : Math.max(0, num(sDraft, 0)));
                        const res = await saveComponent(Object.assign({}, c, { cost: nc, stock: ns }, nc !== num(c.cost) ? { verifiedAt: nowIso() } : {}));
                        if (res.success) {
                          setCostDraft(c.id, null);
                          const o = Object.assign({}, stockDrafts); delete o[c.id]; setStockDrafts(o);
                          shell.notify({ level: 'success', text: '"' + c.name + '" actualizado.' });
                        }
                      } }, '✓'),
                    ]),
                  ]);
                })),
              ]);
            }));
          })()
        : h('div', { key: 'tbl', className: 'gp-card', style: { padding: 0 } },
            h('table', { className: 'gp-table' }, [
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
                      c.storeRef && c.storeRef.itemId ? h('span', { key: 'pr', className: 'gp-chip fuc', style: { marginLeft: 6 } }, 'tienda') : null,
                    ]),
                    h('div', { key: '2', className: 'gp-muted' }, [c.brand, c.specs].filter(Boolean).join(' · ')),
                  ]),
                  h('td', { key: 't' }, h('span', { className: 'gp-chip neg' }, typeLabel(c.type))),
                  h('td', { key: 'c', className: 'gp-price' }, fmtMoney(costBase(c.cost, c.currency)) + (c.currency && c.currency !== r.currency ? ' (' + c.currency + ' ' + num(c.cost) + ')' : '')),
                  h('td', { key: 'v', className: 'gp-price', title: 'margen ' + marginFor(c.type) + '% (' + (r.marginBasis === 'sale' ? 'sobre venta' : 'sobre costo') + ') + ' + r.salesTaxLabel }, fmtMoney(componentSale(c))),
                  h('td', { key: 'stk' }, h(TextInput, { mono: true, type: 'number', min: 0,
                    value: stockDrafts[c.id] != null ? stockDrafts[c.id] : (c.stock == null ? '' : c.stock),
                    placeholder: '∞',
                    title: 'Stock (vacío = sin control; 0 = no elegible). Se guarda al salir del campo.',
                    style: { width: 64, borderColor: c.stock != null && num(c.stock) === 0 ? 'var(--gp-err)' : undefined },
                    onChange: (e) => { const o = Object.assign({}, stockDrafts); o[c.id] = e.target.value; setStockDrafts(o); },
                    onBlur: () => void saveStock(c) })),
                  h('td', { key: 'p' }, c.supplierUrl
                    ? h('a', { className: 'gp-link', href: c.supplierUrl, target: '_blank', rel: 'noopener noreferrer' }, (c.supplierName || 'ver') + ' ↗')
                    : h('span', { className: 'gp-muted' }, c.supplierName || '—')),
                  h('td', { key: 'vf', className: stale ? 'gp-stale' : '' }, fmtDate(c.verifiedAt) + (stale && c.verifiedAt ? ' (' + daysSince(c.verifiedAt) + 'd)' : '')),
                  h('td', { key: 'now' }, h('div', { className: 'gp-verify-cost' }, [
                    h(TextInput, { key: 'i', mono: true, type: 'number', min: 0, placeholder: s(c.cost),
                      title: 'Nuevo costo (' + (c.currency || 'CLP') + ') — vacío = confirmar el actual',
                      value: draft == null ? '' : draft, onChange: (e) => setCostDraft(c.id, e.target.value) }),
                    h('button', { key: 'b', className: 'gp-btn gp-btn-sm gp-btn-dark', title: 'Marcar verificado hoy', onClick: () => void verify(c) }, '✓'),
                  ])),
                  h('td', { key: 'a', style: { whiteSpace: 'nowrap' } }, [
                    h('button', { key: 'e', className: 'gp-btn gp-btn-sm', onClick: () => setEditing(c) }, 'Editar'),
                    ' ',
                    h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: async () => {
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
          currency: rules().currency,
          stock: typeof p.stock === 'number' ? p.stock : null,
          supplierName: 'Catálogo de la tienda',
          storeRef: { instanceId: p.__instanceId, itemId: p.id, sourceId: js ? js.sourceId : null },
        });
      } }),
    ]);
  }

  // ── Picker de producto Jumpseller (catálogo de la app products) ───────────
  function ProductPicker({ onPick, onClose }) {
    const [q, setQ] = useState('');
    const list = model.catalog
      .filter((p) => !q || norm(p.name + ' ' + p.sku).indexOf(norm(q)) !== -1)
      .slice(0, 60);
    return h(Modal, { title: 'Enlazar con producto de la tienda', onClose }, [
      !model.catalogLoaded
        ? h('div', { key: 'l', className: 'gp-muted' }, 'Cargando catálogo desde la app Productos…')
        : model.catalog.length === 0
          ? h('div', { key: 'e', className: 'gp-warnbox' },
              'No se pudo leer el catálogo de la app Productos (¿permiso data.read:products aprobado? ¿instancia de Productos visible para tu equipo?). Puedes ingresar el ID de producto Jumpseller manualmente en el formulario.')
          : null,
      h(TextInput, { key: 'q', value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Buscar por nombre o SKU…', autoFocus: true }),
      h('div', { key: 'list', style: { marginTop: 10 } }, list.map((p) => {
        const link = (p.sourceLinks || []).find((x) => x && x.integration === 'jumpseller');
        return h('div', { key: p.id, className: 'gp-compline' }, [
          h(Thumb, { key: 'i', url: p.imageUrl }),
          h('div', { key: 'n', className: 'grow' }, [
            h('div', { key: '1', style: { fontWeight: 600 } }, p.name),
            h('div', { key: '2', className: 'gp-muted gp-mono', style: { fontSize: 10 } },
              (p.sku ? 'SKU ' + p.sku + ' · ' : '') + (link ? 'JS #' + link.sourceId : 'sin enlace Jumpseller')),
          ]),
          h('span', { key: 'p', className: 'gp-price' }, fmtMoney(p.price)),
          h('button', { key: 'b', className: 'gp-btn gp-btn-sm gp-btn-primary', onClick: () => onPick(p) }, 'Enlazar'),
        ]);
      })),
    ]);
  }

  // ── Previsualizador en vivo del configurador (ProductLab) ─────────────────
  // Simula el paso a paso COMO LO VERÁ EL CLIENTE en la tienda: cards por
  // valor, dependencias (pasos que aparecen/desaparecen según lo elegido),
  // cantidades, recargos, foto dinámica, precio y entrega en vivo. Respeta el
  // modo de precio (auto/fijo/tienda) y refleja storefront.style. El cobro
  // real en la tienda siempre es el de la variante Jumpseller; la simulación
  // usa exactamente las mismas reglas de cálculo que "Aplicar a la tienda".
  /**
   * Editor de un estilo de ficha. Se usa en DOS sitios con el mismo dibujo: la
   * pestaña Estilos (plantillas del catálogo) y el estilo propio de un
   * producto. `onChange` recibe el parche a nivel raíz del estilo.
   */
  function StyleEditor({ st, onChange }) {
    const e = st || {};
    const bar = e.bar || {};
    const ph = e.photos || {};
    const upBar = (patch) => onChange({ bar: Object.assign({}, bar, patch) });
    const upPh = (patch) => onChange({ photos: Object.assign({}, ph, patch) });
    return h('div', { className: 'gp-styleed' }, [
      h('div', { key: 'g', className: 'gp-grid3' }, [
        h(Row, { key: 'ac', label: 'Color de acento (selección, precios, botón)' },
          h(ColorField, { label: null, value: e.accentColor || '', onChange: (v) => onChange({ accentColor: v }), placeholder: 'vacío = acento del theme' })),
        h(Row, { key: 'bg', label: 'Fondo del configurador' },
          h(ColorField, { label: null, value: e.bgColor || '', onChange: (v) => onChange({ bgColor: v }), placeholder: 'vacío = fondo del theme' })),
        h(Row, { key: 'rd', label: 'Radio de esquinas (px; 0 = recto)' },
          h(TextInput, { mono: true, type: 'number', min: 0, max: 24, value: e.radius == null ? 0 : e.radius, onChange: (ev) => onChange({ radius: ev.target.value }) })),
        h(Row, { key: 'cs', label: 'Presentación de los valores' },
          h('select', { className: 'gp-select', value: e.cardStyle || 'cards', onChange: (ev) => onChange({ cardStyle: ev.target.value }) }, [
            h('option', { key: 'c', value: 'cards' }, 'Cards con foto (grilla)'),
            h('option', { key: 'l', value: 'list' }, 'Lista vertical'),
            h('option', { key: 'k', value: 'compact' }, 'Cards compactas'),
          ])),
        h(Row, { key: 'wd', label: 'Ancho en la tienda' },
          h('select', { className: 'gp-select', value: e.width || 'auto', onChange: (ev) => onChange({ width: ev.target.value }) }, [
            h('option', { key: 'a', value: 'auto' }, 'Automático (se alinea al contenedor del theme)'),
            h('option', { key: 'c', value: 'container' }, 'Contenedor (siempre centrado como el sitio)'),
            h('option', { key: 'f', value: 'full' }, 'Ancho completo (borde a borde)'),
          ])),
        h(Row, { key: 'sd', label: 'Precio en las cards' },
          h('select', { className: 'gp-select', value: e.showDeltas || 'delta', onChange: (ev) => onChange({ showDeltas: ev.target.value }) }, [
            h('option', { key: 'd', value: 'delta' }, 'Diferencia (+/− $) vs selección'),
            h('option', { key: 't', value: 'total' }, 'Precio total resultante'),
            h('option', { key: 'n', value: 'none' }, 'Sin precio en las cards'),
          ])),
        h(Row, { key: 'sp', label: 'Color del spinner de carga' },
          h(ColorField, { label: null, value: e.spinnerColor || '', onChange: (v) => onChange({ spinnerColor: v }), placeholder: 'vacío = color de acento' })),
        h(Row, { key: 'bl', label: 'Texto del botón de la barra (lleva al configurador)' },
          h(TextInput, { value: e.buyLabel || '', placeholder: 'Comprar',
            title: 'Se aplica a todos los productos que usen este estilo. Cada producto puede pisarlo en Ficha → Pestañas.',
            onChange: (ev) => onChange({ buyLabel: ev.target.value }) })),
        h('label', { key: 'sc', className: 'gp-switch', style: { alignSelf: 'end' } }, [
          h('input', { key: 'c', type: 'checkbox', checked: e.stepsCollapsed === true, onChange: (ev) => onChange({ stepsCollapsed: ev.target.checked }) }),
          h('span', { key: 's' }, 'Pasos colapsados al entrar (solo el primero abierto)'),
        ]),
      ]),
      // ── Barra superior ──
      h('div', { key: 'bar', style: { borderTop: '1px dashed var(--gp-linea)', marginTop: 10, paddingTop: 10 } }, [
        h('div', { key: 't', className: 'gp-label', style: { marginBottom: 6 } }, 'BARRA SUPERIOR (pestañas · precio · botón)'),
        h('div', { key: 'g', className: 'gp-grid3' }, [
          h(Row, { key: 'bg', label: 'Color de fondo de la barra' },
            h(ColorField, { label: null, value: bar.bgColor || '', onChange: (v) => upBar({ bgColor: v }), placeholder: 'vacío = fondo de la ficha' })),
          h(Row, { key: 'fg', label: 'Color del texto de la barra' },
            h(ColorField, { label: null, value: bar.textColor || '', onChange: (v) => upBar({ textColor: v }), placeholder: 'vacío = automático por contraste' })),
          h(Row, { key: 'w', label: 'Ancho de la barra' },
            h('select', { className: 'gp-select', value: bar.width || 'auto', onChange: (ev) => upBar({ width: ev.target.value }) }, [
              h('option', { key: 'a', value: 'auto' }, 'Según la ficha'),
              h('option', { key: 'c', value: 'container' }, 'Contenedor'),
              h('option', { key: 'f', value: 'full' }, 'Ancho completo'),
            ])),
          h(Row, { key: 'off', label: 'Separación extra bajo el menú del sitio (px)' },
            h(TextInput, { mono: true, type: 'number', value: bar.offset == null ? 0 : bar.offset,
              title: 'El alto del menú del theme se MIDE solo: deja 0 salvo que quieras separación extra (admite negativos).',
              onChange: (ev) => upBar({ offset: ev.target.value === '' ? 0 : num(ev.target.value) }) })),
          h('label', { key: 'sk', className: 'gp-switch', style: { alignSelf: 'end' } }, [
            h('input', { key: 'c', type: 'checkbox', checked: bar.sticky !== false, onChange: (ev) => upBar({ sticky: ev.target.checked }) }),
            h('span', { key: 's' }, 'Fijar la barra al hacer scroll'),
          ]),
          h('label', { key: 'mt', className: 'gp-switch', style: { alignSelf: 'end' }, title: 'En móvil las pestañas secundarias se amontonan con el precio y engordan la barra; por eso van ocultas salvo que las pidas.' }, [
            h('input', { key: 'c', type: 'checkbox', checked: bar.mobileTabs === true, onChange: (ev) => upBar({ mobileTabs: ev.target.checked }) }),
            h('span', { key: 's' }, 'Mostrar pestañas secundarias en móvil'),
          ]),
          h('label', { key: 'sp', className: 'gp-switch', style: { alignSelf: 'end' } }, [
            h('input', { key: 'c', type: 'checkbox', checked: bar.showPrice !== false, onChange: (ev) => upBar({ showPrice: ev.target.checked }) }),
            h('span', { key: 's' }, 'Mostrar el precio en la barra'),
          ]),
          h('label', { key: 'th', className: 'gp-switch', style: { alignSelf: 'end' } }, [
            h('input', { key: 'c', type: 'checkbox', checked: bar.showThumb !== false, onChange: (ev) => upBar({ showThumb: ev.target.checked }) }),
            h('span', { key: 's' }, 'Mostrar la miniatura del producto'),
          ]),
        ]),
      ]),
      // ── Galería de fotos dentro de Explorar ──
      h('div', { key: 'ph', style: { borderTop: '1px dashed var(--gp-linea)', marginTop: 10, paddingTop: 10 } }, [
        h('div', { key: 't', className: 'gp-label', style: { marginBottom: 6 } }, 'GALERÍA DE FOTOS (sección Explorar)'),
        h('div', { key: 'g', className: 'gp-grid3' }, [
          h(Row, { key: 'lay', label: 'Disposición' },
            h('select', { className: 'gp-select', value: ph.layout || 'visor', onChange: (ev) => upPh({ layout: ev.target.value }) }, [
              h('option', { key: 'v', value: 'visor' }, 'Foto grande + miniaturas debajo'),
              h('option', { key: 'l', value: 'lado' }, 'Miniaturas en columna a la izquierda'),
              h('option', { key: 'm', value: 'mosaico' }, 'Mosaico (solo la grilla, sin foto grande)'),
            ])),
          h(Row, { key: 'sz', label: 'Ancho del bloque' },
            h('select', { className: 'gp-select', value: ph.size || 'm', onChange: (ev) => upPh({ size: ev.target.value }) }, [
              h('option', { key: 's', value: 's' }, 'Estrecho (560 px)'),
              h('option', { key: 'm', value: 'm' }, 'Medio (900 px)'),
              h('option', { key: 'l', value: 'l' }, 'Ancho (1200 px)'),
              h('option', { key: 'xl', value: 'xl' }, 'Sin límite'),
            ])),
          h(Row, { key: 'ms', label: 'Alto de la foto grande' },
            h('select', { className: 'gp-select', value: ph.mainSize || 'm', onChange: (ev) => upPh({ mainSize: ev.target.value }) }, [
              h('option', { key: 's', value: 's' }, 'Baja (300 px)'),
              h('option', { key: 'm', value: 'm' }, 'Media (460 px)'),
              h('option', { key: 'l', value: 'l' }, 'Alta (620 px)'),
              h('option', { key: 'xl', value: 'xl' }, 'Muy alta (80% de la pantalla)'),
              h('option', { key: 'a', value: 'auto' }, 'Natural (según la foto)'),
            ])),
          h(Row, { key: 'ts', label: 'Tamaño de las miniaturas' },
            h('select', { className: 'gp-select', value: ph.thumbSize || 'm', onChange: (ev) => upPh({ thumbSize: ev.target.value }) }, [
              h('option', { key: 's', value: 's' }, 'Pequeñas'),
              h('option', { key: 'm', value: 'm' }, 'Medianas'),
              h('option', { key: 'l', value: 'l' }, 'Grandes'),
            ])),
          h(Row, { key: 'co', label: 'Fotos por fila (0 = automático)' },
            h(TextInput, { mono: true, type: 'number', min: 0, max: 6, value: ph.cols == null ? 0 : ph.cols,
              onChange: (ev) => upPh({ cols: ev.target.value === '' ? 0 : num(ev.target.value) }) })),
          h(Row, { key: 'fit', label: 'Encaje de las fotos' },
            h('select', { className: 'gp-select', value: ph.fit || 'contain', onChange: (ev) => upPh({ fit: ev.target.value }) }, [
              h('option', { key: 'c', value: 'contain' }, 'Completa (se ve entera)'),
              h('option', { key: 'v', value: 'cover' }, 'Recortada (todas del mismo formato)'),
            ])),
          h('label', { key: 'fr', className: 'gp-switch', style: { alignSelf: 'end' } }, [
            h('input', { key: 'c', type: 'checkbox', checked: ph.frame !== false, onChange: (ev) => upPh({ frame: ev.target.checked }) }),
            h('span', { key: 's' }, 'Marco alrededor de las fotos'),
          ]),
        ]),
      ]),
    ]);
  }

  function ConfigPreview({ draft, edit }) {
    const [sel, setSel] = useState({});      // groupId → valueId elegido
    const [mob, setMob] = useState(false);
    // El previsualizador muestra lo que verá la tienda: si el producto usa
    // una plantilla del catálogo, manda la plantilla, no su estilo guardado.
    const st = resolveStyle(draft);
    const accent = /^#[0-9a-fA-F]{6}$/.test(s(st.accentColor).trim()) ? s(st.accentColor).trim() : '#19ACB1';
    const radius = Math.max(0, num(st.radius, 0));
    const compact = st.cardStyle === 'compact';
    const asList = st.cardStyle === 'list';
    const fixed = isFixedPrice(draft);
    // Los valores de RELLENO no se ofrecen (solo sostienen las variantes en las
    // que el paso está oculto): el previsualizador enseña lo que verá el cliente.
    const groups = (draft.groups || []).filter((g) => edit || g.baseStep !== true).map((g) => ({
      g, vals: groupValues(g).filter((v) => valueAvailable(v) && v.fallback !== true),
    })).filter((x) => edit || x.vals.length);
    const selMap = {};
    groups.forEach(({ g }) => {
      const vals = groupValues(g).filter(valueAvailable);
      selMap[g.id] = vals.some((v) => v.id === sel[g.id]) ? sel[g.id] : (groupDefaultValue(g) || {}).id;
    });
    const visibleOf = (g) => groupVisibleFor(draft, g, selMap);
    // Un paso que se hace VISIBLE no puede quedarse con el valor de relleno
    // (el "No aplica" que solo sostiene las variantes ocultas): pasa al primero
    // real, que es lo que hace la tienda.
    groups.forEach(({ g, vals }) => {
      if (!visibleOf(g)) return;
      const actual = groupValues(g).find((v) => v.id === selMap[g.id]);
      if (actual && actual.fallback === true && vals[0]) selMap[g.id] = vals[0].id;
    });
    // Precio: mismas reglas que buildStoreVariants (oculto = default del paso).
    let gross = fixed ? basePriceOf(draft) : baseBreakdown(draft).gross;
    // Pasos COMPONENTE BASE: no se eligen, pero su default suma siempre
    // (misma regla que buildStoreVariants con el precio calculado).
    (draft.groups || []).filter((g) => g.baseStep === true).forEach((g) => {
      const dvb = groupDefaultValue(g);
      if (dvb) gross += fixed ? valueExtra(draft, g, dvb) : (valueGross(dvb) || 0);
    });
    const sumMode = deliveryModeOf(draft) === 'sum';
    let dd = productoBaseDelivery(draft);
    groups.forEach(({ g }) => {
      // Paso oculto: no suma nada (en la tienda su comodín vale 0).
      if (!visibleOf(g)) return;
      const v = groupValues(g).find((x) => x.id === selMap[g.id]);
      if (v) gross += fixed ? valueExtra(draft, g, v) : (valueGross(v) || 0);
      const n = v ? valueDeliveryDays(v) : 0;
      dd = sumMode ? dd + n : Math.max(dd, n);
    });
    dd += numOr(draft.deliveryExtraDays, rules().leadTimeDays);
    const price = fixed ? Math.round(gross) : roundFinal(gross);
    // Foto dinámica: primer paso "cambia foto" visible, con la foto del valor.
    const photoG = groups.map((x) => x.g).find((g) => g.photoStep === true && visibleOf(g));
    const photoV = photoG && groupValues(photoG).find((x) => x.id === selMap[photoG.id]);
    const photo = (photoV && photoV.imageUrl) || productoImage(draft);
    const deltaVs = (g, v) => {
      const cur = groupValues(g).find((x) => x.id === selMap[g.id]);
      if (!cur || cur.id === v.id) return 0;
      const a = fixed ? valueExtra(draft, g, v) : (valueSale(v) == null ? null : valueSale(v));
      const b = fixed ? valueExtra(draft, g, cur) : (valueSale(cur) == null ? null : valueSale(cur));
      return a == null || b == null ? 0 : a - b;
    };
    const cardW = compact ? 96 : 128;
    return h('div', { className: 'gp-card' }, [
      h('div', { key: 't', className: 'gp-card-title',
        title: 'Interactivo y en vivo: prueba selecciones, dependencias, cantidades, recargos y el estilo de Ficha → Estilo. El precio simulado usa las mismas reglas que "Aplicar a la tienda"; el cobro real es siempre el de la variante en el ecommerce.' }, [
        h('span', { key: 'n', className: 'gp-num' }, 'PREVISUALIZADOR'),
        'Así lo verá el cliente',
        h('span', { key: 'sp', style: { flex: 1 } }),
        h('div', { key: 'vm', className: 'gp-editor-tabs' }, [
          h('button', { key: 'd', className: 'gp-etab' + (!mob ? ' on' : ''), onClick: () => setMob(false) }, 'Escritorio'),
          h('button', { key: 'm', className: 'gp-etab' + (mob ? ' on' : ''), onClick: () => setMob(true) }, 'Móvil'),
        ]),
        h('button', { key: 'rst', className: 'gp-btn gp-btn-sm', style: { marginLeft: 8 }, onClick: () => setSel({}) }, 'Restablecer'),
      ]),
      // overflowX solo en la vista móvil (el marco de 375px puede no caber);
      // en escritorio debe ser visible: un ancestro con overflow:auto sería
      // el contenedor de scroll del panel sticky y lo dejaría sin efecto.
      h('div', { key: 'pv', className: 'gp-storepv', style: { overflowX: mob ? 'auto' : 'visible', '--pv-radius': radius + 'px' } },
        h('div', { style: { width: mob ? 375 : '100%', maxWidth: mob ? 375 : 980, margin: '0 auto', border: '1px solid var(--gp-gris-claro)', background: s(st.bgColor).trim() || '#fff', padding: mob ? 10 : 16, display: 'flex', flexDirection: mob ? 'column' : 'row', gap: 16 } }, [
          h('div', { key: 'steps', style: { flex: 2, minWidth: 0 } },
            groups.length === 0
              ? h('div', null, [
                  h('div', { key: 't', className: 'gp-muted' }, edit ? 'Sin pasos aún: crea el primero.' : 'Sin pasos aún: agrega pasos para previsualizar el configurador.'),
                  edit ? h('div', { key: 'a', className: 'gp-vivo-acciones' },
                    h('button', { className: 'gp-btn gp-btn-primary', onClick: edit.agregarPaso }, '+ Agregar paso')) : null,
                ])
              : groups.map(({ g, vals }, gi) => {
                  // Edición sobre la previsualización: ⚙ abre el editor
                  // completo del paso inline, debajo de sus cards.
                  const idx = (draft.groups || []).indexOf(g);
                  const btnCfg = edit ? h('button', { key: 'cfg',
                    className: 'gp-btn gp-btn-sm' + (edit.abierto === g.id ? ' gp-btn-dark' : ''),
                    style: { marginLeft: 10 }, title: 'Editar este paso',
                    onClick: () => edit.abrir(g.id) }, edit.abierto === g.id ? '✕ Cerrar' : '⚙ Editar') : null;
                  const editor = edit && edit.abierto === g.id
                    ? h('div', { key: 'ed', className: 'gp-vivo-editor' }, edit.renderEditorPaso(g, idx)) : null;
                  if (edit && g.baseStep === true) return h('div', { key: g.id, style: { marginBottom: 14 } }, [
                    h('div', { key: 'h', className: 'gp-muted', style: { padding: '6px 0', fontSize: 12, display: 'flex', alignItems: 'center' } }, [
                      h('span', { key: 't' }, (g.label || typeLabel(g.typeId)) + ' — componente base (incluido siempre; el cliente no lo ve)'),
                      btnCfg,
                    ]),
                    editor,
                  ]);
                  if (!visibleOf(g)) return h('div', { key: g.id, style: { marginBottom: 14 } }, [
                    h('div', { key: 'h', className: 'gp-muted', style: { padding: '6px 0', fontSize: 11, opacity: .8, display: 'flex', alignItems: 'center' } }, [
                      h('span', { key: 't' }, 'PASO ' + String(gi + 1).padStart(2, '0') + ' · ' + (g.label || typeLabel(g.typeId)) + ' — oculto por dependencia (la tienda usa su valor por defecto)'),
                      btnCfg,
                    ]),
                    editor,
                  ]);
                  return h('div', { key: g.id, style: { marginBottom: 14 } }, [
                    h('div', { key: 'h', style: { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', marginBottom: 6, display: 'flex', alignItems: 'center' } }, [
                      h('span', { key: 'n', style: { color: accent } }, 'PASO ' + String(gi + 1).padStart(2, '0')),
                      h('span', { key: 'l' }, ' · ' + (g.label || typeLabel(g.typeId))),
                      btnCfg,
                    ]),
                    h('div', { key: 'vals', style: asList ? { display: 'flex', flexDirection: 'column', gap: 6 } : { display: 'flex', flexWrap: 'wrap', gap: 8 } }, vals.map((v) => {
                      const on = selMap[g.id] === v.id;
                      const dlt = deltaVs(g, v);
                      const alt = valueChosen(v);
                      const img = v.imageUrl || (alt && alt.imageUrl) || '';
                      const deltaTxt = st.showDeltas === 'none' || on ? '' : st.showDeltas === 'total' ? fmtMoney(fixed ? Math.round(gross + dlt) : roundFinal(gross + dlt)) : (dlt === 0 ? '' : fmtDelta(dlt));
                      return h('div', {
                        key: v.id,
                        onClick: () => { const o = Object.assign({}, sel); o[g.id] = v.id; setSel(o); },
                        title: v.label,
                        style: Object.assign({
                          cursor: 'pointer',
                          border: on ? '2px solid ' + accent : '1px solid var(--gp-gris-claro)',
                          background: '#fff', padding: compact ? 6 : 8,
                        }, asList ? { display: 'flex', alignItems: 'center', gap: 10 } : { width: cardW }),
                      }, [
                        g.photoStep && v.swatchColor
                          ? h('span', { key: 'sw', style: { display: 'inline-block', width: 22, height: 22, background: v.swatchColor, border: '1px solid rgba(0,0,0,.15)' } })
                          : img
                            ? h('img', { key: 'i', src: img, alt: '', style: asList ? { width: 40, height: 40, objectFit: 'cover' } : { width: '100%', height: compact ? 44 : 64, objectFit: 'cover' } })
                            : (asList || compact ? null : h('div', { key: 'i', style: { width: '100%', height: 44, background: 'var(--gp-plata)' } })),
                        h('div', { key: 'n', style: { fontSize: compact ? 10.5 : 11.5, fontWeight: 600, marginTop: asList ? 0 : 4, minWidth: 0 } }, v.label + (valueQty(v) > 1 ? ' (×' + valueQty(v) + ')' : '')),
                        deltaTxt ? h('div', { key: 'd', style: { fontSize: 10, opacity: .8, marginLeft: asList ? 'auto' : 0, whiteSpace: 'nowrap' } }, deltaTxt) : null,
                      ]);
                    }).concat(edit ? [h('button', { key: '__addv', className: 'gp-vivo-addval',
                      title: 'Agregar un valor a este paso',
                      style: asList ? {} : { width: cardW, minHeight: compact ? 74 : 104 },
                      onClick: () => edit.agregarValor(g) }, '+ Valor')] : [])),
                    editor,
                  ]);
                }).concat(edit ? [h('div', { key: '__acciones', className: 'gp-vivo-acciones' }, [
                  h('button', { key: 'add', className: 'gp-btn gp-btn-primary', onClick: edit.agregarPaso }, '+ Agregar paso'),
                  edit.extra || null,
                ])] : [])),
          // El panel de resumen queda PEGAJOSO dentro del scroll del preview:
          // precio, selección y botón siempre a la vista mientras se recorren
          // los pasos (en móvil va en flujo normal, es una columna).
          h('div', { key: 'panel', style: { flex: 1, minWidth: mob ? 0 : 240, border: '1px solid var(--gp-gris-claro)', background: '#fff', padding: 12, alignSelf: 'flex-start', position: mob ? 'static' : 'sticky', top: 8 } }, [
            photo ? h('img', { key: 'ph', src: photo, alt: '', style: { width: '100%', maxHeight: 160, objectFit: 'contain', marginBottom: 8 } }) : null,
            h('div', { key: 'nm', style: { fontWeight: 700, fontSize: 13, marginBottom: 4 } }, draft.name || 'Producto'),
            h('div', { key: 'pr', className: 'gp-price', style: { fontSize: 20 } }, fmtMoney(price)),
            h('div', { key: 'dd', className: 'gp-muted', style: { margin: '4px 0 8px' } }, 'Entrega estimada: ' + dd + ' día(s) hábiles'),
            h('div', { key: 'sum', style: { fontSize: 11, borderTop: '1px dashed var(--gp-linea)', paddingTop: 6 } },
              groups.filter(({ g }) => visibleOf(g)).map(({ g }) => {
                const v = groupValues(g).find((x) => x.id === selMap[g.id]);
                return h('div', { key: g.id, style: { padding: '2px 0' } }, [
                  h('span', { key: 'l', className: 'gp-muted' }, (g.label || typeLabel(g.typeId)) + ': '),
                  h('b', { key: 'v' }, v ? v.label : '—'),
                ]);
              })),
            h('div', { key: 'cta', style: { marginTop: 10 } },
              h('span', { style: { display: 'inline-block', width: '100%', textAlign: 'center', padding: '9px 12px', fontWeight: 600, fontSize: 12, color: '#fff', background: accent, cursor: 'default', boxSizing: 'border-box' } },
                (((draft.storefront || {}).tabs || {}).comprar) || 'Agregar al carro')),
          ]),
        ])),
    ]);
  }

  // ── Formulario de producto ──────────────────────────────────────────────────
  function ProductoForm({ initial, onDone, sec }) {
    sec = sec || 'general';
    const [d, setD] = useState(() => Object.assign({
      name: '', sku: '', status: 'active', imageUrl: '',
      baseComponentIds: [], extraCosts: [], groups: [], storeRef: null, deliveryExtraDays: null,
    }, initial ? normalizeProductoShape(initial) : {}));
    const [busy, setBusy] = useState(false);
    const [picking, setPicking] = useState(false);
    const [baseSel, setBaseSel] = useState('');
    // La pestaña activa llega del header (nav store): setNav({ tab }) cambia.
    const [heroSel, setHeroSel] = useState({});   // builder: sección id → contenedor seleccionado
    const [blockSel, setBlockSel] = useState({}); // builder: sección id → tipo de bloque a agregar
    const [viewMode, setViewMode] = useState('desk'); // preview: escritorio | móvil
    const dragRef = useState({ current: null })[0];   // bloque en arrastre (drag & drop)
    const [galBusy, setGalBusy] = useState(false);    // subida múltiple a la galería
    const [mats, setMats] = useState([]);             // materiales detectados en el GLB
    const [try3d, setTry3d] = useState({});           // probar configuración: grupo → valor
    const [mdlBusy, setMdlBusy] = useState(false);    // subida del modelo 3D
    const [tplName, setTplName] = useState('');       // nombre de la plantilla de estilo a crear
    const [compSearch, setCompSearch] = useState({}); // buscador de componentes por valor
    // (El split de dos columnas del Estudio se retiró: ahora es una sola
    // columna con la previsualización editable.)
    const [pasoEdit, setPasoEdit] = useState(null);   // paso con su editor abierto en el Estudio
    const [tplDel, setTplDel] = useState('');         // borrado de plantilla: id a confirmar
    const [arBusy, setArBusy] = useState(false);      // generación del .glb de AR
    const viewerRef3d = useState({ current: null })[0]; // visor vivo, para exportar
    const [conflicto, setConflicto] = useState(null); // el agente cambió esto mientras yo editaba
    // ── Sincronía con el agente ──────────────────────────────────────────
    // El agente guarda en el modelo; este formulario trabaja sobre una copia
    // que se tomó al abrirlo. Sin esto el editor seguía mostrando lo viejo y,
    // peor, al pulsar Guardar escribía esa copia encima de lo que el agente
    // acababa de hacer. Ahora se detecta por `updatedAt` y:
    //   · sin cambios míos → se recarga solo y salta a la sección tocada;
    //   · con cambios míos sin guardar → no se toca nada y se pregunta, que
    //     descartar el trabajo del usuario sin avisar sería igual de malo.
    const baseRef = useState({ current: null })[0];
    if (baseRef.current === null) baseRef.current = JSON.stringify(d);
    const vivo = d.id ? model.productos.find((e) => e.id === d.id) : null;
    const cargarVivo = (v) => {
      const nd = normalizeProductoShape(v);
      baseRef.current = JSON.stringify(nd);
      setD(nd);
      setConflicto(null);
      if (agentEdit.section) setNav({ tab: agentEdit.section });
    };
    useEffect(() => {
      const q = decidirRecarga(d, vivo, baseRef.current);
      if (q === 'recargar') cargarVivo(vivo);
      else if (q === 'preguntar') setConflicto(vivo);
    });
    const up = (patch) => setD(Object.assign({}, d, patch));
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
    const ref = storeRefOf(d);
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
    // El precio vivo y Guardar/Aplicar se publican al HEADER (nada de barras
    // inferiores). Sin deps: cada render deja los closures frescos.
    useEffect(() => {
      setHdrExtra({
        precio: fmtMoney(price),
        sub: combos + ' variante(s) · entrega ' + productoDelivery(d) + 'd' + (warns.length ? ' · ⚠ ' + warns.length + ' aviso(s)' : ''),
        busy,
        puedeGuardar: !busy && !!s(d.name).trim(),
        puedeAplicar: !!ref && !busy && !!s(d.name).trim() && combos > 0 && combos <= MAX_COMBOS,
        conTienda: !!ref,
        etiquetaGuardar: initial ? 'Guardar' : 'Crear producto',
        guardar: async () => {
          setBusy(true);
          const r = await saveProducto(d);
          setBusy(false);
          if (r.success) { shell.notify({ level: 'success', text: r.message }); onDone(); }
        },
        aplicar: async () => {
          setBusy(true);
          const saved = await saveProducto(d);
          if (!saved.success) { setBusy(false); return; }
          const r = await applyToStore(saved.item);
          setBusy(false);
          shell.notify(r.success ? { level: 'success', text: r.message } : { level: 'error', text: r.error });
          if (r.success) onDone();
        },
      });
    });
    useEffect(() => () => setHdrExtra(null), []);
    // ── Editor COMPLETO de un paso (era el cuerpo del map de la columna
    // izquierda): ahora lo abre el ⚙ de cada paso DENTRO de la
    // previsualización — se edita sobre lo que ve el cliente. ──
    const renderEditorPaso = (g, gi) => {
        const candidates = model.components.filter((c) => c.type === g.typeId);
        const vals = groupValues(g);
        const dv = groupDefaultValue(g);
        const upValue = (vid, patch) => upGroup(g.id, { values: vals.map((v) => (v.id === vid ? Object.assign({}, v, patch) : v)) });
        return h('div', { key: g.id, className: 'gp-group' }, [
          h('div', { key: 'h', className: 'gp-group-head' }, [
            h('span', { key: 's', className: 'gp-step' }, 'PASO ' + String(gi + 1).padStart(2, '0')),
            h('select', { key: 't', className: 'gp-select', style: { width: 'auto' }, value: g.typeId, onChange: (e) => upGroup(g.id, { typeId: e.target.value, values: [], defaultValueId: null }) },
              types().map((t) => h('option', { key: t.id, value: t.id }, t.label))),
            h(TextInput, { key: 'l', value: g.label, onChange: (e) => upGroup(g.id, { label: e.target.value }), placeholder: 'Título del paso (opcional): ' + typeLabel(g.typeId), style: { width: 220 } }),
            h('label', { key: 'ph', className: 'gp-switch', style: { margin: 0 }, title: 'La selección de este paso cambia la foto del producto en la tienda (usa la foto de cada valor — ideal para colores)' }, [
              h('input', { key: 'c', type: 'checkbox', checked: g.photoStep === true, onChange: (e) => upGroup(g.id, { photoStep: e.target.checked }) }),
              h('span', { key: 's' }, 'cambia foto'),
            ]),
            h('label', { key: 'bs', className: 'gp-switch', style: { margin: 0 },
              title: 'Componente BASE: forma parte del armado pero el cliente no lo elige — no crea opción ni variantes en la tienda y su valor por defecto suma siempre al precio. Sin marcar = paso PERSONALIZABLE (el cliente elige y se publican variantes).' }, [
              h('input', { key: 'c', type: 'checkbox', checked: g.baseStep === true, onChange: (e) => upGroup(g.id, { baseStep: e.target.checked }) }),
              h('span', { key: 's' }, 'componente base'),
            ]),
            // Paso dependiente (ProductLab): visible solo si un paso ANTERIOR
            // tiene elegido alguno de los valores marcados abajo.
            gi > 0 ? h('select', {
              key: 'dep', className: 'gp-select', style: { width: 'auto' },
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
            // Orden de los pasos. Cambiarlo también cambia qué pasos pueden
            // depender de cuál: una dependencia solo puede apuntar hacia atrás.
            gi > 0 && h('button', { key: 'up', className: 'gp-btn gp-btn-sm', title: 'Subir este paso', onClick: () => {
              const gs = d.groups.slice(); const t = gs[gi - 1]; gs[gi - 1] = gs[gi]; gs[gi] = t; up({ groups: gs });
            } }, '↑'),
            gi < d.groups.length - 1 && h('button', { key: 'dn', className: 'gp-btn gp-btn-sm', title: 'Bajar este paso', onClick: () => {
              const gs = d.groups.slice(); const t = gs[gi + 1]; gs[gi + 1] = gs[gi]; gs[gi] = t; up({ groups: gs });
            } }, '↓'),
            h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => up({ groups: d.groups.filter((x) => x.id !== g.id) }) }, 'Quitar paso'),
          ]),
          h('div', { key: 'b', className: 'gp-group-body' }, [
            // Editor de la condición del paso dependiente
            (function () {
              const dep = groupDependsOn(g);
              if (!dep) return null;
              const target = d.groups.find((x) => x.id === dep.stepId);
              if (!target) return null;
              return h('div', { key: 'dep', className: 'gp-warnbox', style: { background: 'var(--gp-plata)', border: '1px solid var(--gp-gris-claro)', color: 'var(--gp-negro)' } }, [
                h('div', { key: 't', className: 'gp-label', style: { marginBottom: 4 } },
                  'Visible en la tienda solo si "' + (target.label || typeLabel(target.typeId)) + '" es:'),
                h('div', { key: 'l', style: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px' } }, groupValues(target).map((tv) => h('label', { key: tv.id, className: 'gp-switch', style: { margin: 0 } }, [
                  h('input', { key: 'c', type: 'checkbox', checked: dep.valueIds.indexOf(tv.id) !== -1, onChange: (e) => {
                    const ids = e.target.checked ? dep.valueIds.concat([tv.id]) : dep.valueIds.filter((x) => x !== tv.id);
                    upGroup(g.id, { dependsOn: ids.length ? { stepId: dep.stepId, valueIds: ids } : null });
                  } }),
                  h('span', { key: 's' }, tv.label || '(sin nombre)'),
                ]))),
                h('div', { key: 'h', className: 'gp-muted', style: { marginTop: 4 } },
                  'Cuando este paso no se muestra, no suma nada al precio: se gestiona solo. Define aquí únicamente los valores reales.'),
              ]);
            })(),
            vals.length === 0 && h('div', { key: 'e', className: 'gp-muted' },
              'Sin valores aún. Agrega los que verá el cliente (ej: "Roble natural", "Nogal oscuro") y márcale a cada uno sus alternativas. Un valor sin componentes es una opción sin costo (cobra con "recargo" si quieres).'),
            h(React.Fragment, { key: 'vals' }, vals.map((v, vi) => {
              const alts = valueAlts(v);
              const chosen = valueChosen(v);
              const delta = deltaFor(g, v, d);
              const isDef = !!(dv && dv.id === v.id);
              return h('div', { key: v.id, style: { borderTop: '1px dashed var(--gp-linea)', padding: '8px 0' } }, [
                h('div', { key: 'l1', className: 'gp-compline', style: { borderBottom: 0 } }, [
                  h('label', { key: 'def', className: 'gp-switch', style: { margin: 0 }, title: 'Valor incluido por defecto en el producto' },
                    h('input', { type: 'radio', name: 'gp-def-' + g.id, checked: isDef, onChange: () => upGroup(g.id, { defaultValueId: v.id }) })),
                  h(TextInput, { key: 'lbl', value: v.label, placeholder: 'Etiqueta genérica (ej: Roble natural)', style: { width: 220 }, onChange: (e) => upValue(v.id, { label: e.target.value }) }),
                  h('span', { key: 'qx', className: 'gp-label', title: 'Cantidad' }, '×'),
                  h(TextInput, { key: 'qty', mono: true, type: 'number', min: 1, style: { width: 52 },
                    title: 'Cantidad: cuántas unidades del componente elegido incluye este valor (ej. 2 para ofrecer "2×8GB" en un solo paso). Multiplica el precio y exige stock suficiente.',
                    value: v.qty == null ? 1 : v.qty, onChange: (e) => upValue(v.id, { qty: e.target.value }) }),
                  alts.length > 0 ? h('label', { key: 'bd', className: 'gp-switch', style: { margin: 0 },
                    title: 'Conjunto: los componentes de TIPOS DISTINTOS se SUMAN, y los del mismo tipo son alternativas entre sí (se usa el más económico). Ej: "Pack teclado + mouse" con 2 teclados y 2 mouse cuesta min(teclados) + min(mouse). Sin marcar, todos son alternativas y se usa el más económico.' }, [
                    h('input', { key: 'c', type: 'checkbox', checked: v.bundle === true, onChange: (e) => upValue(v.id, { bundle: e.target.checked }) }),
                    h('span', { key: 's' }, 'conjunto (suman)'),
                  ]) : null,
                  chosen
                    ? h('span', { key: 'ch', className: 'gp-muted' }, v.bundle === true
                        ? 'suma: ' + valueComps(v).map((c) => c.name).join(' + ') + ' → ' + fmtMoney(valueSale(v))
                        : 'usa: ' + chosen.name + (valueQty(v) > 1 ? ' ×' + valueQty(v) : '') + ' → ' + fmtMoney(valueSale(v)))
                    : alts.length
                      ? h('span', { key: 'ch', className: 'gp-chip err' }, 'sin alternativas disponibles')
                      // Sin componentes = opción válida que no agrega costo.
                      : h('span', { key: 'ch', className: 'gp-chip gris', title: 'No usa componentes: no agrega costo. Puedes cobrar por él con el recargo de al lado.' }, 'sin costo extra'),
                  h('span', { key: 'rl', className: 'gp-label' }, 'recargo'),
                  h(TextInput, { key: 'rd', mono: true, type: 'number', style: { width: 100 },
                    value: v.priceDelta == null ? '' : v.priceDelta, placeholder: '0',
                    title: 'Recargo de venta de este valor, sin necesidad de modelar su costo',
                    onChange: (e) => upValue(v.id, { priceDelta: e.target.value === '' ? 0 : num(e.target.value) }) }),
                  h('span', { key: 'sp', className: 'grow' }),
                  isDef
                    ? h('span', { key: 'd', className: 'gp-chip fuc' }, 'incluido')
                    : h('span', { key: 'd', className: 'gp-delta' + (delta < 0 ? ' neg' : '') }, fmtDelta(delta)),
                  // Orden de los valores DENTRO del paso: es el orden en que el
                  // cliente los ve en la tienda y en el previsualizador.
                  vi > 0 && h('button', { key: 'vu', className: 'gp-btn gp-btn-sm', title: 'Subir este valor', onClick: () => {
                    const xs = vals.slice(); const t = xs[vi - 1]; xs[vi - 1] = xs[vi]; xs[vi] = t; upGroup(g.id, { values: xs });
                  } }, '↑'),
                  vi < vals.length - 1 && h('button', { key: 'vd', className: 'gp-btn gp-btn-sm', title: 'Bajar este valor', onClick: () => {
                    const xs = vals.slice(); const t = xs[vi + 1]; xs[vi + 1] = xs[vi]; xs[vi] = t; upGroup(g.id, { values: xs });
                  } }, '↓'),
                  h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', title: 'Quitar valor', onClick: () => upGroup(g.id, { values: vals.filter((y) => y.id !== v.id), defaultValueId: g.defaultValueId === v.id ? null : g.defaultValueId }) }, '✕'),
                ]),
                h('div', { key: 'limg', style: { paddingLeft: 26, maxWidth: 560 } },
                  h(ImgField, { value: v.imageUrl || '', gallery: productoGallery, onChange: (u) => upValue(v.id, { imageUrl: u }), placeholder: g.photoStep ? 'Foto del producto en este color' : 'Foto propia del valor (si no, usa la de la alternativa elegida)' })),
                g.photoStep === true && h('div', { key: 'lsw', style: { paddingLeft: 26, maxWidth: 560 } },
                  h(ColorField, { label: null, value: v.swatchColor || '', onChange: (c) => upValue(v.id, { swatchColor: c }), placeholder: '#1D1D1B — color del puntito selector en la tienda' })),
                // ── Efectos sobre el visor 3D (solo si el producto tiene modelo) ──
                has3d(d) && h('div', { key: 'l3d', style: { paddingLeft: 26, marginTop: 4 } }, (function () {
                  const parts = (d.model3d.parts || []);
                  const fins = (d.model3d.finishes || []);
                  const fx = v.model3d || [];
                  const upFx = (next) => upValue(v.id, { model3d: next });
                  if (!parts.length) return h('span', { className: 'gp-muted' }, 'Define las partes del modelo en la pestaña Visor 3D para poder vincular este valor.');
                  return [
                    h('div', { key: 'l', className: 'gp-label' }, 'Efecto en el 3D al elegir este valor'),
                    h('div', { key: 'rows' }, fx.map((e, i) => h('div', { key: i, className: 'gp-fx-row' }, [
                      h('select', { key: 'p', className: 'gp-select', style: { width: 'auto' }, value: e.partId,
                        onChange: (ev) => upFx(fx.map((x, j) => (j === i ? Object.assign({}, x, { partId: ev.target.value }) : x))) },
                        parts.map((p) => h('option', { key: p.id, value: p.id }, p.label || p.id))),
                      h('select', { key: 't', className: 'gp-select', style: { width: 'auto' }, value: e.type,
                        onChange: (ev) => upFx(fx.map((x, j) => (j === i ? Object.assign({}, x, { type: ev.target.value }) : x))) }, [
                        h('option', { key: 'c', value: 'color' }, 'pintar de'),
                        h('option', { key: 'f', value: 'finish' }, 'acabado'),
                        h('option', { key: 'h', value: 'hide' }, 'ocultar pieza'),
                      ]),
                      e.type === 'color' ? h('input', { key: 'v', type: 'color', value: e.color || '#cccccc',
                        onChange: (ev) => upFx(fx.map((x, j) => (j === i ? Object.assign({}, x, { color: ev.target.value }) : x))) }) : null,
                      e.type === 'finish' ? h('select', { key: 'v', className: 'gp-select', style: { width: 'auto' }, value: e.finishId || '',
                        onChange: (ev) => upFx(fx.map((x, j) => (j === i ? Object.assign({}, x, { finishId: ev.target.value }) : x))) },
                        [h('option', { key: '', value: '' }, '— elegir —')].concat(fins.map((f) => h('option', { key: f.id, value: f.id }, f.label || f.id)))) : null,
                      h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upFx(fx.filter((x, j) => j !== i)) }, '✕'),
                    ]))),
                    h('button', { key: 'add', className: 'gp-btn gp-btn-sm', onClick: () => upFx(fx.concat([{ partId: parts[0].id, type: 'color', color: v.swatchColor || '#cccccc' }])) }, '+ Efecto 3D'),
                  ];
                })()),
                // ── Componentes del valor: SOLO lo elegido, y un buscador ──
                // Antes se listaba el catálogo entero en checkboxes (cientos
                // de casillas repetidas valor por valor): abrumador e
                // inmanejable. Ahora se ven los componentes DEL VALOR como
                // chips y se agregan buscando por nombre — sobre TODO el
                // catálogo, sin filtrar por tipo, para poder armar conjuntos
                // (CPU + placa madre) en un mismo valor.
                (function () {
                  const q = s(compSearch[v.id]).trim().toLowerCase();
                  const setQ = (t) => { const o = Object.assign({}, compSearch); o[v.id] = t; setCompSearch(o); };
                  const enSet = new Set(v.componentIds || []);
                  // Navegar por TIPO además de buscar por texto: escribir
                  // "tipo:<id>" lista el tipo completo (los chips de abajo lo
                  // escriben por ti). Sirve para comparar precios y stock.
                  const porTipo = q.indexOf('tipo:') === 0 ? q.slice(5).trim() : null;
                  const resultados = (porTipo
                    ? model.components.filter((c) => !enSet.has(c.id) && norm(typeLabel(c.type)).indexOf(porTipo) !== -1)
                    : q.length < 2 ? [] : model.components.filter((c) => !enSet.has(c.id) && (c.name || '').toLowerCase().indexOf(q) !== -1)
                  ).slice(0, porTipo ? 30 : 8);
                  // Compatibilidad con lo YA elegido en el valor: un candidato
                  // que choca por tags se marca antes de agregarlo.
                  const tagsSel = new Set();
                  (v.componentIds || []).forEach((cid) => { const c = compById(cid); if (c) (c.tags || []).forEach((t) => tagsSel.add(t)); });
                  const choque = (c) => {
                    for (const t of (c.excludes || [])) if (tagsSel.has(t)) return 'incompatible con ' + t;
                    for (const cid of (v.componentIds || [])) {
                      const otro = compById(cid);
                      if (otro) for (const t of (otro.excludes || [])) if ((c.tags || []).indexOf(t) !== -1) return 'incompatible con ' + otro.name;
                    }
                    return null;
                  };
                  return h('div', { key: 'l2', style: { paddingLeft: 26, marginTop: 4 } }, [
                    h('div', { key: 'chips', style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 } },
                      (v.componentIds || []).length === 0
                        ? [h('span', { key: 'none', className: 'gp-muted' }, 'Sin componentes: opción sin costo (usa el recargo si quieres cobrarla). Busca abajo para agregar.')]
                        : (v.componentIds || []).map((cid) => {
                            const c = compById(cid);
                            if (!c) return null;
                            const isChosen = !!(chosen && chosen.id === c.id);
                            return h('span', { key: cid, className: 'gp-chip ' + (compAvailable(c) ? (isChosen || v.bundle === true ? 'fuc' : 'gris') : 'err'),
                              title: (c.active === false ? 'Inactivo. ' : c.stock == null ? '' : 'Stock ' + num(c.stock) + '. ')
                                + (v.bundle === true ? 'En conjunto: se suma.' : isChosen ? 'Alternativa elegida (la más económica disponible).' : 'Alternativa de reserva.'),
                              style: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 7px' } }, [
                              h('span', { key: 'n' }, c.name + ' · ' + fmtMoney(componentSale(c))),
                              // Alternativos enlazados del componente: por defecto SE
                              // ACEPTAN (se usa el más barato disponible del grupo);
                              // este interruptor los apaga solo en este valor.
                              (c.altIds || []).length ? (function () {
                                const solo = Array.isArray(v.soloExacto) ? v.soloExacto : [];
                                const usa = solo.indexOf(cid) === -1;
                                return h('button', { key: 'alt', className: 'gp-btn gp-btn-sm' + (usa ? ' gp-btn-dark' : ''),
                                  style: { padding: '0 5px', lineHeight: 1.2 },
                                  title: usa
                                    ? 'Acepta sus ' + c.altIds.length + ' alternativo(s): se usa el más barato disponible. Clic para exigir EXACTAMENTE este componente.'
                                    : 'Solo este componente exacto (no acepta alternativos). Clic para volver a aceptarlos.',
                                  onClick: () => upValue(v.id, { soloExacto: usa ? solo.concat([cid]) : solo.filter((x) => x !== cid) }),
                                }, '⇄' + c.altIds.length);
                              })() : null,
                              h('button', { key: 'x', className: 'gp-btn gp-btn-sm', style: { padding: '0 5px', lineHeight: 1.2 },
                                title: 'Quitar del valor',
                                onClick: () => upValue(v.id, { componentIds: (v.componentIds || []).filter((x) => x !== cid) }) }, '✕'),
                            ]);
                          })),
                    h('div', { key: 'buscar', style: { position: 'relative', maxWidth: 420 } }, [
                      h(TextInput, { key: 'q', value: compSearch[v.id] || '', placeholder: '🔍 buscar componente para agregar (cualquier tipo)…',
                        onChange: (e) => setQ(e.target.value) }),
                      resultados.length > 0 && h('div', { key: 'res', style: {
                        position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%',
                        maxHeight: 280, overflowY: 'auto',
                        background: '#fff', border: '1px solid var(--gp-gris-claro)', boxShadow: '0 8px 20px rgba(0,0,0,.15)',
                      } }, resultados.map((c) => {
                        const conflicto = choque(c);
                        return h('div', { key: c.id,
                          style: { padding: '6px 10px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline', borderBottom: '1px solid var(--gp-plata)', opacity: compAvailable(c) ? 1 : .55 },
                          title: conflicto || '',
                          onMouseDown: () => { upValue(v.id, { componentIds: (v.componentIds || []).concat([c.id]) }); setQ(''); },
                        }, [
                          h('span', { key: 'n', style: { fontWeight: 600 } }, c.name),
                          h('span', { key: 't', className: 'gp-muted', style: { fontSize: 11 } }, typeLabel(c.type)),
                          conflicto ? h('span', { key: 'w', className: 'gp-chip err', style: { fontSize: 10 } }, '⚠ ' + conflicto) : null,
                          h('span', { key: 'st', className: 'gp-chip ' + (compAvailable(c) ? (c.stock == null ? 'gris' : 'ok') : 'err'), style: { fontSize: 10 } },
                            c.active === false ? 'inactivo' : c.stock == null ? '∞' : 'stock ' + num(c.stock)),
                          h('span', { key: 'p', style: { marginLeft: 'auto', fontSize: 12 } }, fmtMoney(componentSale(c))),
                        ]);
                      })),
                    ]),
                    // Chips de tipos: un clic lista el tipo completo para comparar.
                    h('div', { key: 'tipos', style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 } },
                      types().filter((t) => model.components.some((c) => c.type === t.id)).map((t) =>
                        h('button', { key: t.id, className: 'gp-btn gp-btn-sm', style: { fontSize: 10, padding: '2px 7px' },
                          title: 'Listar todos los componentes de ' + t.label,
                          onClick: () => setQ('tipo:' + t.label.toLowerCase()) }, t.label))),
                  ]);
                })(),
              ]);
            })),
            // Creación rápida: buscar un componente y crear su valor de un clic
            // (nombre editable después). Sin muros de checkboxes.
            (function () {
              const clave = 'quick::' + g.id;
              const q = s(compSearch[clave]).trim().toLowerCase();
              const setQ = (t) => { const o = Object.assign({}, compSearch); o[clave] = t; setCompSearch(o); };
              const yaUsados = new Set(vals.reduce((a, x) => a.concat(x.componentIds || []), []));
              const resultados = q.length < 2 ? [] : model.components
                .filter((c) => !yaUsados.has(c.id) && (c.name || '').toLowerCase().indexOf(q) !== -1)
                .slice(0, 8);
              return h('div', { key: 'quick', style: { borderTop: '1px dashed var(--gp-linea)', marginTop: 10, paddingTop: 8 } }, [
                h('div', { key: 't', className: 'gp-label', style: { marginBottom: 5 } }, 'Agregar valores desde un componente (un clic = un valor)'),
                h('div', { key: 'buscar', style: { position: 'relative', maxWidth: 420 } }, [
                  h(TextInput, { key: 'q', value: compSearch[clave] || '', placeholder: '🔍 buscar componente…', onChange: (e) => setQ(e.target.value) }),
                  resultados.length > 0 && h('div', { key: 'res', style: {
                    position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%',
                    background: '#fff', border: '1px solid var(--gp-gris-claro)', boxShadow: '0 8px 20px rgba(0,0,0,.15)',
                  } }, resultados.map((c) => h('div', { key: c.id,
                    style: { padding: '6px 10px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline', borderBottom: '1px solid var(--gp-plata)' },
                    onMouseDown: () => { upGroup(g.id, { values: vals.concat([{ id: newId('val'), label: c.name, componentIds: [c.id] }]) }); },
                  }, [
                    h('span', { key: 'n', style: { fontWeight: 600 } }, c.name),
                    h('span', { key: 't2', className: 'gp-muted', style: { fontSize: 11 } }, typeLabel(c.type)),
                    h('span', { key: 'p', style: { marginLeft: 'auto', fontSize: 12 } }, fmtMoney(componentSale(c))),
                  ]))),
                ]),
              ]);
            })(),
            h('button', { key: 'addv', className: 'gp-btn gp-btn-sm', style: { marginTop: 8 }, onClick: () => upGroup(g.id, { values: vals.concat([{ id: newId('val'), label: '', componentIds: [] }]) }) }, '+ Valor'),
          ]),
        ]);
    };
    return h('div', { className: 'gp-editor' }, [
      // Las pestañas, el título y el volver viven en el HEADER (breadcrumb +
      // tabs grandes). Aquí solo queda el estado del enlace con la tienda.
      h('div', { key: 'top', className: 'gp-editor-top' }, [
        h('span', { key: 'sp', style: { flex: 1 } }),
        ref ? h('span', { key: 'js', className: 'gp-chip fuc' }, ref.sourceId ? 'JS #' + ref.sourceId : 'enlazado') : h('span', { key: 'js', className: 'gp-chip gris' }, 'sin enlace'),
      ]),
      // El agente cambió este producto y aquí hay edición sin guardar: se
      // decide a mano, porque cualquiera de las dos opciones pierde algo.
      conflicto && h('div', { key: 'conf', className: 'gp-warnbox', style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } }, [
        h('span', { key: 't', style: { flex: 1, minWidth: 220 } },
          '⚠ El agente cambió este producto mientras lo editabas. Si guardas ahora, tus cambios pisarán los suyos.'),
        h('button', { key: 'r', className: 'gp-btn gp-btn-sm gp-btn-dark', onClick: () => cargarVivo(conflicto) }, 'Cargar lo del agente (pierdo lo mío)'),
        h('button', { key: 'k', className: 'gp-btn gp-btn-sm', onClick: () => { baseRef.current = JSON.stringify(d); setConflicto(null); } }, 'Mantener lo mío'),
      ]),
      // ── Cuerpo: una sección a la vez, a todo el ancho ──
      h('div', { key: 'body', className: 'gp-editor-body' }, [
        h('div', { key: 'g', style: sec === 'general' ? null : { display: 'none' } }, [
      // General: la foto del producto a la IZQUIERDA (un toque abre la
      // Galería) y a su lado la identidad del producto.
      h('div', { key: 'glay', className: 'gp-general-lay' }, [
      h('div', { key: 'foto', className: 'gp-general-foto', role: 'button', tabIndex: 0,
        title: 'Abrir la galería del producto', onClick: () => setNav({ tab: 'galeria' }) }, [
        productoImage(d)
          ? h('img', { key: 'i', src: productoImage(d), alt: d.name || '' })
          : h('span', { key: 'ph', className: 'gp-muted' }, 'Sin foto aún'),
        h('span', { key: 'cta', className: 'gp-general-foto-cta' }, 'Ver galería →'),
      ]),
      h('div', { key: 'campos', className: 'gp-general-campos' }, [
      // Enlace con el producto de la app products (que sincroniza con Jumpseller)
      h('div', { key: 'link', className: 'gp-card', style: { background: 'var(--gp-plata)' } }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'TIENDA'), 'Producto de la tienda']),
        legacy && h('div', { key: 'legacy', className: 'gp-warnbox' },
          'Enlace de la versión anterior detectado (JS #' + legacy.sourceId + '). Re-enlaza con "Enlazar producto…" para poder aplicar opciones y variantes.'),
        ref
          ? h('div', { key: 'st', className: 'gp-compline' }, [
              h(Thumb, { key: 'img', url: productoImage(d) }),
              h('span', { key: 'c', className: 'gp-chip fuc' }, ref.sourceId ? 'JS #' + ref.sourceId : 'producto local'),
              h('span', { key: 'nm', style: { fontWeight: 600 } }, (productItemFor(d) || {}).name || ref.name || ref.itemId),
              h('span', { key: 'm', className: 'gp-muted grow' }, '"Aplicar a la tienda" escribe precio, opciones y variantes en este producto (vía app Productos → Jumpseller).'),
              h('button', { key: 'x', className: 'gp-btn gp-btn-sm', onClick: () => up({ storeRef: null }) }, 'Desenlazar'),
            ])
          : h('div', { key: 'no', className: 'gp-compline' }, [
              h('span', { key: 'm', className: 'gp-muted grow' }, 'Sin enlace: el producto no se aplica a la tienda todavía.'),
              h('button', { key: 'b', className: 'gp-btn gp-btn-sm gp-btn-dark', onClick: () => setPicking(true) }, 'Enlazar producto…'),
            ]),
      ]),
      h('div', { key: 'g1', className: 'gp-grid2' }, [
        h(Row, { key: 'n', label: 'Nombre *' }, h(TextInput, { value: d.name, onChange: (e) => up({ name: e.target.value }), placeholder: 'Ej: Camisa Clásica · Escritorio Nórdico' })),
        h(Row, { key: 's', label: 'SKU (debe calzar con la tienda)' }, h(TextInput, { mono: true, value: d.sku, onChange: (e) => up({ sku: e.target.value }), placeholder: 'PPRO-N1-2026' })),
        h(Row, { key: 'su', label: 'URL del producto (vacío = automática: URL base de la tienda + permalink del producto sincronizado)' },
          h(TextInput, { mono: true, value: d.storeUrl || '', onChange: (e) => up({ storeUrl: e.target.value }),
            placeholder: (function () { const auto = productoStoreUrl(Object.assign({}, d, { storeUrl: '' })); return auto || 'automática al sincronizar (o pégala aquí)'; })() })),
      ]),
      ]),
      ]),
      ]),
      // ── Base y costos adicionales: viven en el ESTUDIO, junto a los pasos
      // (el General queda con identidad, precio y entrega solamente). ──
      h('div', { key: 'gbase', style: sec === 'pasos' ? null : { display: 'none' } }, [
      h('div', { key: 'basecard', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'BASE'), 'Componentes base y costos adicionales']),
        h('div', { key: 'help', className: 'gp-muted', style: { marginBottom: 8 } },
          'Los componentes base van siempre incluidos y definen el costo base (cada uno con el margen de su tipo). Los costos adicionales son manuales (confección, montaje, embalaje, etc.) y usan el "margen de costos adicionales" de la pestaña Precios.'),
        h(React.Fragment, { key: 'bc' }, (d.baseComponentIds || []).map(compById).filter(Boolean).map((c) => h('div', { key: c.id, className: 'gp-compline' }, [
          h('span', { key: 'n', className: 'grow', style: { fontWeight: 600 } }, c.name),
          h('span', { key: 'ty', className: 'gp-chip neg' }, typeLabel(c.type)),
          !compAvailable(c) && h('span', { key: 'w', className: 'gp-chip err' }, 'no disponible'),
          h('span', { key: 'p', className: 'gp-price' }, fmtMoney(componentSale(c))),
          h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => up({ baseComponentIds: d.baseComponentIds.filter((id) => id !== c.id) }) }, '✕'),
        ]))),
        h('div', { key: 'addbc', className: 'gp-compline', style: { borderBottom: 0, marginTop: 6 } }, [
          h('select', { key: 'sel', className: 'gp-select', style: { maxWidth: 360 }, value: baseSel, onChange: (e) => setBaseSel(e.target.value) },
            [h('option', { key: '', value: '' }, 'Elegir componente del catálogo…')].concat(
              types().map((t) => {
                const opts = model.components.filter((c) => c.type === t.id && (d.baseComponentIds || []).indexOf(c.id) === -1);
                return opts.length
                  ? h('optgroup', { key: t.id, label: t.label }, opts.map((c) => h('option', { key: c.id, value: c.id }, c.name + ' — ' + fmtMoney(componentSale(c)))))
                  : null;
              }).filter(Boolean))),
          h('button', { key: 'add', className: 'gp-btn gp-btn-sm gp-btn-dark', disabled: !baseSel, onClick: () => {
            if (!baseSel) return;
            up({ baseComponentIds: (d.baseComponentIds || []).concat([baseSel]) });
            setBaseSel('');
          } }, '+ Componente base'),
        ]),
        h(React.Fragment, { key: 'ec' }, (d.extraCosts || []).map((x) => h('div', { key: x.id, className: 'gp-compline' }, [
          h(TextInput, { key: 'l', value: x.label, placeholder: 'Concepto (ej: Confección, montaje, control de calidad)', style: { width: 220 }, onChange: (e) => upExtra(x.id, { label: e.target.value }) }),
          h(TextInput, { key: 'c', mono: true, type: 'number', min: 0, value: x.cost, style: { width: 120 }, onChange: (e) => upExtra(x.id, { cost: e.target.value }) }),
          h('select', { key: 'm', className: 'gp-select', style: { width: 90 }, value: x.currency || rules().currency, onChange: (e) => upExtra(x.id, { currency: e.target.value }) },
            costCurrencies().map((c) => h('option', { key: c, value: c }, c))),
          h('span', { key: 'sp', className: 'grow' }),
          h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => up({ extraCosts: d.extraCosts.filter((y) => y.id !== x.id) }) }, '✕'),
        ]))),
        h('div', { key: 'bact', className: 'gp-compline', style: { borderBottom: 0, marginTop: 4 } }, [
          h('button', { key: 'addec', className: 'gp-btn gp-btn-sm', onClick: () => up({ extraCosts: (d.extraCosts || []).concat([{ id: newId('ec'), label: '', cost: 0, currency: rules().currency }]) }) }, '+ Costo adicional'),
          h('span', { key: 'sp', className: 'grow' }),
          h('span', { key: 'tot', className: 'gp-muted' }, 'Base bruta (margen + ' + rules().salesTaxLabel + ', sin redondeo): ' + fmtMoney(baseBreakdown(d).gross)),
        ]),
      ]),
      ]),
      // ── General (continuación): precio y entrega ──
      h('div', { key: 'g2', style: sec === 'general' ? null : { display: 'none' } }, [
        // ── Cómo se fija el precio ──
        // Calcular desde costos es una opción, no una obligación: hay
        // productos (packs, precio de lista) donde el precio se decide.
        (function () {
          const modo = priceModeOf(d);
          const catItem = productItemFor(d);
          const catPrice = catItem && catItem.price != null ? num(catItem.price) : null;
          const catCost = catItem && catItem.costPerItem != null ? num(catItem.costPerItem) : null;
          return h('div', { key: 'pm', className: 'gp-card', style: { background: 'var(--gp-plata)' } }, [
            h(Row, { key: 'm', label: 'Cómo se fija el precio de este producto' },
              h('select', { className: 'gp-select', value: modo, onChange: (e) => up({ priceMode: e.target.value }) }, [
                h('option', { key: 'a', value: 'auto' }, 'Calculado desde los costos y las reglas de margen'),
                h('option', { key: 'f', value: 'fixed' }, 'Precio fijo — lo escribo yo (no depende de los costos)'),
                h('option', { key: 's', value: 'store' }, 'El precio que ya tiene el producto en la tienda'),
              ])),
            modo === 'fixed' && h(Row, { key: 'fp', label: 'Precio fijo (' + rules().currency + ')' },
              h('div', { className: 'gp-verify-cost' }, [
                h(TextInput, { key: 'i', mono: true, type: 'number', min: 0, value: d.fixedPrice == null ? '' : d.fixedPrice,
                  onChange: (e) => up({ fixedPrice: e.target.value }) }),
                catPrice != null ? h('button', { key: 'c', className: 'gp-btn gp-btn-sm', title: 'Copiar el precio actual del producto en la tienda',
                  onClick: () => up({ fixedPrice: catPrice }) }, 'Usar el de la tienda (' + fmtMoney(catPrice) + ')') : null,
              ])),
            modo === 'store' && h('div', { key: 'sp', className: 'gp-muted' },
              catPrice != null
                ? 'Precio actual del producto en la tienda: ' + fmtMoney(catPrice) + '. Se toma de la app Productos en cada cálculo.'
                : 'Aún no se puede leer el precio del catálogo (¿producto enlazado y catálogo cargado?). Mientras tanto se usa el precio fijo guardado.'),
            modo !== 'auto' && h('div', { key: 'h', className: 'gp-muted', style: { marginTop: 6 } },
              'Los pasos y el visor 3D siguen funcionando igual: sirven para personalizar. Todas las combinaciones valen lo mismo, salvo los valores a los que les pongas un recargo.'),
            catCost != null && h('div', { key: 'cc', className: 'gp-muted', style: { marginTop: 6 } },
              'Dato de la tienda: costo por unidad en Jumpseller ' + fmtMoney(catCost) + '. Puedes usarlo como referencia sin cargar el detalle de componentes.'),
            // Aviso temprano: si el precio calculado es 0, aplicar a la tienda
            // se va a negar. Mejor verlo aquí que al pulsar "Aplicar".
            !(num(productoComputedPrice(d)) > 0) && h('div', { key: 'w0', className: 'gp-warnbox', style: { marginTop: 8 } },
              '⚠ El precio calculado es ' + fmtMoney(productoComputedPrice(d)) + '. Así NO se puede aplicar a la tienda (dejaría el producto a $0 a la venta). '
              + (modo === 'auto'
                ? 'En precio automático hace falta al menos un costo: componentes base, costos adicionales, o componentes en los valores por defecto de los pasos. Los pasos generados desde el modelo 3D no llevan costo por sí solos.'
                : modo === 'store'
                  ? 'No hay precio legible en el producto de la tienda: ponle precio en la app Productos, o cambia a precio fijo.'
                  : 'Escribe el precio fijo aquí arriba.')),
          ]);
        })(),
        h(Row, { key: 'dd', label: 'Días propios de preparación/producción (vacío = regla global: ' + rules().leadTimeDays + ')' },
          h(TextInput, { mono: true, type: 'number', min: 0, value: d.deliveryExtraDays == null ? '' : d.deliveryExtraDays, onChange: (e) => up({ deliveryExtraDays: e.target.value === '' ? null : e.target.value }) })),
        h(Row, { key: 'dm', label: 'Cálculo de entrega' },
          h('select', { className: 'gp-select', value: d.deliveryMode === 'sum' ? 'sum' : 'max', onChange: (e) => up({ deliveryMode: e.target.value }) }, [
            h('option', { key: 'max', value: 'max' }, 'En paralelo — manda el componente más lento (producción propia)'),
            h('option', { key: 'sum', value: 'sum' }, 'En serie — los días se SUMAN (dropshipping / logística encadenada)'),
          ])),
      ]),
        // Pasos: editor a la IZQUIERDA y previsualizador vivo PEGAJOSO a la
        // derecha — se edita mirando el resultado, no yendo a buscarlo abajo.
        // El layout va INLINE (no en una clase): si el CSS de la app llega
        // cacheado de una versión vieja, un layout por clase se cae y las
        // columnas se apilan con el preview arriba. La clase gp-col-scroll
        // solo aporta la cosmética del scrollbar (pseudo-elementos,
        // imposibles inline) y es mejora progresiva.
        // ── ESTUDIO: UNA columna con la previsualización EN GRANDE, tal
        // cual la verá el cliente (con su switch Escritorio/Móvil), y la
        // edición SOBRE ella: ⚙ por paso abre el editor completo inline,
        // "+ Valor" agrega en el paso y "+ Agregar paso" al final. ──
        h('div', { key: 'p', style: sec === 'pasos' ? { maxWidth: 1240, margin: '0 auto' } : { display: 'none' } }, [
          h(ConfigPreview, { key: 'vivo', draft: d, edit: {
            abierto: pasoEdit,
            abrir: (gid) => setPasoEdit(pasoEdit === gid ? null : gid),
            renderEditorPaso,
            agregarValor: (g) => {
              upGroup(g.id, { values: groupValues(g).concat([{ id: newId('val'), label: 'Nuevo valor', componentIds: [] }]) });
              setPasoEdit(g.id);
            },
            agregarPaso: () => {
              const ng = { id: newId('grp'), typeId: types()[0].id, label: '', values: [], defaultValueId: null };
              up({ groups: d.groups.concat([ng]) });
              setPasoEdit(ng.id);
            },
            extra: has3d(d) && ((d.model3d.finishes || []).length > 0) && h('button', { key: 'gen3d', className: 'gp-btn gp-btn-dark',
          title: 'Crea un paso por cada parte del modelo, con un valor por cada acabado, ya vinculados al 3D',
          onClick: () => {
            const m = d.model3d;
            const gen = (m.parts || []).map((part) => {
              const values = (m.finishes || []).map((f) => ({
                id: newId('val'), label: f.label || f.id, swatchColor: f.color || '', imageUrl: '',
                componentIds: [], priceDelta: 0,
                model3d: [{ partId: part.id, type: 'finish', finishId: f.id }],
              }));
              const defFin = part.defaultFinish ? (m.finishes || []).find((f) => f.id === part.defaultFinish) : null;
              const def = defFin ? values.find((v) => v.label === (defFin.label || defFin.id)) : values[0];
              return { id: newId('grp'), typeId: types()[0].id, label: part.label || part.id, photoStep: false,
                values, defaultValueId: def ? def.id : (values[0] && values[0].id) || null };
            });
            if (!gen.length) { shell.notify({ level: 'warn', text: 'El modelo no tiene partes definidas.' }); return; }
            const replace = !d.groups.length || window.confirm('¿Reemplazar los pasos actuales por los generados desde el modelo 3D?\n\nAceptar = reemplazar · Cancelar = agregarlos al final');
            up({ groups: replace ? gen : d.groups.concat(gen) });
          } }, '⚡ Generar pasos desde el modelo 3D'),
          } }),
        ]),
        // ── Galería: pestaña propia (fotos de Jumpseller + subidas) ──
        h('div', { key: 'gal', style: sec === 'galeria' ? null : { display: 'none' } }, [
      h('div', { key: 'galeria', className: 'gp-card', style: { marginTop: 12 } }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'FICHA'), 'Galería del producto']),
        h('div', { key: 'help', className: 'gp-muted', style: { marginBottom: 8 } },
          'Biblioteca de imágenes de ESTE producto: lo que subas aquí o en cualquier campo de imagen (fondos de hero, fotos de valores) queda disponible en los pickers "Galería…" para reutilizarlo en otras secciones, junto a las fotos del producto en Jumpseller (marcadas JS).'),
        h('div', { key: 'grid', className: 'gp-gal-grid' },
          productoGallery.length
            ? productoGallery.map((u, i) => {
                const own = (d.galleryImages || []).indexOf(u) !== -1;
                const isProd = prodImgs.indexOf(u) !== -1;
                return h('div', { key: i, className: 'gp-gal-item' }, [
                  h('img', { key: 'i', src: u, alt: '', title: u }),
                  isProd ? h('span', { key: 'p', className: 'gp-chip fuc', style: { position: 'absolute', left: 2, bottom: 2 } }, 'JS') : null,
                  own ? h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', title: 'Quitar de la galería (si está en uso en el producto, reaparece al guardar)', style: { position: 'absolute', top: 2, right: 2, padding: '2px 5px' }, onClick: () => up({ galleryImages: (d.galleryImages || []).filter((x) => x !== u) }) }, '✕') : null,
                ]);
              })
            : h('span', { key: 'e', className: 'gp-muted' }, 'Aún no hay imágenes: sube algunas o enlaza el producto para ver su galería.')),
        // La galería llega del producto enlazado (app Productos). Si de allí
        // solo viene la foto principal, no hay nada que la app pueda inventar:
        // el síntoma es "solo se ve una foto" y la causa está una capa antes,
        // así que se dice en claro y con el paso exacto para arreglarlo.
        (function () {
          const p = productItemFor(d);
          if (!p) return null;
          const n = Array.isArray(p.images) ? p.images.filter(Boolean).length : 0;
          if (n > 1) return null;
          return h('div', { key: 'sync', className: 'gp-muted', style: { marginTop: 8, borderLeft: '2px solid var(--gp-fucsia)', paddingLeft: 8 } },
            n === 1 || !n
              ? 'De la tienda solo llega ' + (n ? 'la foto principal' : 'ninguna foto') + '. La galería completa la trae la app Productos al sincronizar: abre Productos → "' + (p.name || d.name) + '" → sincronizar (pull) desde Jumpseller, y vuelve aquí. Mientras tanto puedes subir fotos a mano con "+ Subir imágenes…".'
              : null);
        })(),
        h('div', { key: 'act', className: 'gp-compline', style: { borderBottom: 0, marginTop: 8 } }, [
          h('label', { key: 'up', className: 'gp-btn gp-btn-sm gp-btn-dark', style: { cursor: 'pointer' } }, [
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
      ]),
        h('div', { key: 'f', style: sec === 'ficha' ? null : { display: 'none' } }, [
      // ── Ficha: BUILDER de descripción del producto ──
      h('div', { key: 'builder', className: 'gp-card', style: { marginTop: 12 } }, [
        h('div', { key: 't', className: 'gp-card-title' }, [
          h('span', { key: 'n', className: 'gp-num' }, 'FICHA'),
          'Builder de descripción del producto',
          h('span', { key: 'sp', style: { flex: 1 } }),
          h('div', { key: 'vm', className: 'gp-editor-tabs' }, [
            h('button', { key: 'd2', className: 'gp-etab' + (viewMode === 'desk' ? ' on' : ''), onClick: () => setViewMode('desk') }, 'Escritorio'),
            h('button', { key: 'm2', className: 'gp-etab' + (viewMode === 'mob' ? ' on' : ''), onClick: () => setViewMode('mob') }, 'Móvil'),
          ]),
        ]),
        h('div', { key: 'help', className: 'gp-muted', style: { marginBottom: 8 } },
          'La página del modelo se compone de SECCIONES una bajo otra: heros con patrón flexbox, la tabla de especificaciones y la nota (reordenables con ↑↓; specs y nota se pueden ocultar). Pincha un contenedor o un bloque en la previsualización para editarlo abajo, y ARRASTRA bloques entre contenedores (incluso de otra sección). La previsualización es aproximada; el theme pone la tipografía final.'),
        h(React.Fragment, { key: 'list' }, sfPage.map((sec2, si2) => {
          const moveBtns = [
            si2 > 0 && h('button', { key: 'up', className: 'gp-btn gp-btn-sm', title: 'Subir', onClick: () => {
              const xs = sfPage.slice(); const t = xs[si2 - 1]; xs[si2 - 1] = xs[si2]; xs[si2] = t; upPage(xs);
            } }, '↑'),
            si2 < sfPage.length - 1 && h('button', { key: 'dn', className: 'gp-btn gp-btn-sm', title: 'Bajar', onClick: () => {
              const xs = sfPage.slice(); const t = xs[si2 + 1]; xs[si2 + 1] = xs[si2]; xs[si2] = t; upPage(xs);
            } }, '↓'),
          ];
          // ── Secciones fijas: especificaciones y nota (orden + mostrar) ──
          if (sec2.kind === 'specs' || sec2.kind === 'note' || sec2.kind === 'fotos') {
            return h('div', { key: sec2.id, className: 'gp-group' }, [
              h('div', { key: 'h', className: 'gp-group-head' }, [
                h('span', { key: 's', className: 'gp-step' }, 'SECCIÓN ' + String(si2 + 1).padStart(2, '0')),
                h('span', { key: 'k', className: 'gp-chip neg' }, sec2.kind === 'specs' ? 'ESPECIFICACIONES' : sec2.kind === 'fotos' ? 'FOTOS' : 'NOTA'),
                h('label', { key: 'sw', className: 'gp-switch', style: { margin: 0 } }, [
                  h('input', { key: 'c', type: 'checkbox', checked: sec2.show !== false, onChange: (e) => upPageX(sec2.id, { show: e.target.checked }) }),
                  h('span', { key: 's2' }, 'mostrar'),
                ]),
                (function (secId, val) {
                return h('select', { key: 'w', className: 'gp-select', style: { width: 'auto' },
                  title: 'Ancho de ESTA sección en la tienda (independiente del resto de la ficha)',
                  value: val || 'auto', onChange: (e) => upPageX(secId, { width: e.target.value }) }, [
                  h('option', { key: 'a', value: 'auto' }, 'Ancho: según la ficha'),
                  h('option', { key: 'c', value: 'container' }, 'Ancho: contenedor'),
                  h('option', { key: 'f', value: 'full' }, 'Ancho: completo'),
                ]);
              })(sec2.id, sec2.width),
                h('span', { key: 'sp', style: { flex: 1 } }),
              ].concat(moveBtns)),
              sec2.show !== false && h('div', { key: 'b', className: 'gp-group-body' },
                sec2.kind === 'fotos'
                  ? (function () {
                      const st = sf.style || {};
                      const ph = st.photos || {};
                      const upPh = (patch) => up({ storefront: Object.assign({}, sf, { style: Object.assign({}, st, { photos: Object.assign({}, ph, patch) }) }) });
                      return h('div', { key: 'ft' }, [
                        h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 8 } },
                          'Grilla de fotos del producto (galería de la tienda) con visor grande. Las fotos se gestionan en el producto; aquí decides cómo se ven dentro de la ficha.'),
                        h('div', { key: 'g', className: 'gp-grid2' }, [
                          h(Row, { key: 'sz', label: 'Tamaño de las fotos' },
                            h('select', { className: 'gp-select', value: ph.size || 'm', onChange: (e) => upPh({ size: e.target.value }) }, [
                              h('option', { key: 's', value: 's' }, 'Pequeñas (miniaturas)'),
                              h('option', { key: 'm', value: 'm' }, 'Medianas'),
                              h('option', { key: 'l', value: 'l' }, 'Grandes'),
                              h('option', { key: 'xl', value: 'xl' }, 'Extra grandes'),
                            ])),
                          h(Row, { key: 'co', label: 'Fotos por fila (0 = automático)' },
                            h(TextInput, { mono: true, type: 'number', min: 0, max: 6, value: ph.cols == null ? 0 : ph.cols,
                              onChange: (e) => upPh({ cols: e.target.value === '' ? 0 : num(e.target.value) }) })),
                        ]),
                      ]);
                    })()
                  : sec2.kind === 'specs'
                  ? (specRows.length
                      ? h('div', { key: 'pv', style: { maxWidth: viewMode === 'mob' ? 375 : 560 } },
                          specRows.slice(0, 6).map((sp) => h('div', { key: sp.id, className: 'gp-compline' }, [
                            h('span', { key: 'l', className: 'gp-muted', style: { width: '40%' } }, sp.label),
                            h('span', { key: 'v' }, sp.value),
                          ])).concat(specRows.length > 6 ? [h('div', { key: 'more', className: 'gp-muted' }, '… +' + (specRows.length - 6) + ' filas')] : []))
                      : h('span', { key: 'e', className: 'gp-muted' }, 'Sin filas aún: se editan en la card "Tabla de especificaciones" más abajo.'))
                  : h('div', { key: 'note' }, [
                      h('div', { key: 'h2', className: 'gp-muted', style: { marginBottom: 6 } },
                        'Nota discreta (letra chica) con separador fino: condiciones o aclaraciones. Vacía = no se muestra.'),
                      h('textarea', { key: 'tx', className: 'gp-textarea', rows: 3, value: sf.photosNote || '',
                        placeholder: 'Ej: Las fotos son referenciales; la configuración interna corresponde a lo seleccionado en el personalizador.',
                        onChange: (e) => up({ storefront: Object.assign({}, sf, { photosNote: e.target.value }) }) }),
                    ])),
            ]);
          }
          // ── Sección IMAGEN (ProductLab): una foto, alto según la imagen ──
          if (sec2.kind === 'imagen') {
            return h('div', { key: sec2.id, className: 'gp-group' }, [
              h('div', { key: 'h', className: 'gp-group-head' }, [
                h('span', { key: 's', className: 'gp-step' }, 'SECCIÓN ' + String(si2 + 1).padStart(2, '0')),
                h('span', { key: 'k', className: 'gp-chip fuc' }, 'IMAGEN'),
(function (secId, val) {
                return h('select', { key: 'w', className: 'gp-select', style: { width: 'auto' },
                  title: 'Ancho de ESTA sección en la tienda (independiente del resto de la ficha)',
                  value: val || 'auto', onChange: (e) => upPageX(secId, { width: e.target.value }) }, [
                  h('option', { key: 'a', value: 'auto' }, 'Ancho: según la ficha'),
                  h('option', { key: 'c', value: 'container' }, 'Ancho: contenedor'),
                  h('option', { key: 'f', value: 'full' }, 'Ancho: completo'),
                ]);
              })(sec2.id, sec2.width),
                h('span', { key: 'sp', style: { flex: 1 } }),
              ].concat(moveBtns).concat([
                h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upPage(sfPage.filter((y) => y.id !== sec2.id)) }, 'Quitar'),
              ])),
              h('div', { key: 'b', className: 'gp-group-body' }, [
                h('div', { key: 'help', className: 'gp-muted', style: { marginBottom: 6 } },
                  'Sección de solo foto: en la tienda ocupa el ancho elegido y su ALTO se adapta a la imagen (sin recortes). Encadena varias para descripciones hechas de fotos apiladas, cada una con su altura natural.'),
                h(ImgField, { key: 'img', label: null, value: sec2.imageUrl || '', gallery: productoGallery, onChange: (u) => upPageX(sec2.id, { imageUrl: u }) }),
                h('div', { key: 'meta', className: 'gp-grid2' }, [
                  h(Row, { key: 'alt', label: 'Texto alternativo (accesibilidad, opcional)' },
                    h(TextInput, { value: sec2.alt || '', onChange: (e) => upPageX(sec2.id, { alt: e.target.value }) })),
                  h(Row, { key: 'lnk', label: 'Link al hacer clic (opcional)' },
                    h(TextInput, { mono: true, value: sec2.link || '', placeholder: 'https://…', onChange: (e) => upPageX(sec2.id, { link: e.target.value }) })),
                ]),
                sec2.imageUrl
                  ? h('div', { key: 'pv', style: { overflowX: 'auto', marginTop: 8 } },
                      h('img', { src: sec2.imageUrl, alt: sec2.alt || '', style: { display: 'block', width: viewMode === 'mob' ? 375 : '100%', maxWidth: viewMode === 'mob' ? 375 : 900, height: 'auto', margin: '0 auto', border: '1px solid var(--gp-gris-claro)' } }))
                  : h('div', { key: 'pv', className: 'gp-muted' }, 'Sube o elige una imagen para previsualizarla con su alto real.'),
              ]),
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
          // Acento REAL de la tienda (plantilla del catálogo o estilo propio):
          // el previsualizador tiene que enseñar los colores que se van a ver,
          // no los de la app.
          const pvSt = resolveStyle(d);
          const pvAccent = s(pvSt.accentColor).trim() || 'var(--gp-fucsia)';
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
              return h('div', common, src3
                ? h('img', { src: src3, alt: '', style: { maxHeight: Math.round((PH[b.size] || PH.m) * (isMob ? 0.8 : 1)), maxWidth: '100%', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.4))' } })
                : h('div', { style: { width: 90, height: 70, background: pvAccent, opacity: .85 } }));
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
                h('span', { key: 'p', style: { width: 14, height: 14, background: pvAccent, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 } }, '+'),
                h('span', { key: 't4' }, it.title || '(item)'),
              ])) : [h('span', { key: 'e', style: { fontSize: 10, opacity: .6 } }, '(items vacíos)')]);
            if (b.type === 'cta') return h('div', common, h('span', { style: {
              display: 'inline-block', padding: '7px 14px', fontSize: 11, fontWeight: 600,
              background: b.style === 'dark' ? '#1D1D1B' : b.style === 'ghost' ? 'rgba(255,255,255,.12)' : pvAccent,
              color: '#fff', border: b.style === 'ghost' ? '1px solid rgba(255,255,255,.5)' : '0',
            } }, b.label || 'Configurar'));
            if (b.type === 'icons') return h('div', Object.assign({}, common, { style: Object.assign({}, common.style, {
              display: 'flex', flexWrap: 'wrap', gap: 10, color: b.color || undefined,
              justifyContent: b.align === 'left' ? 'flex-start' : b.align === 'right' ? 'flex-end' : 'center',
            }) }),
              (b.items || []).map((it) => h('div', { key: it.id, style: { borderLeft: '2px solid ' + pvAccent, paddingLeft: 6, fontSize: 10, textAlign: 'left' } }, [
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
              return h('div', common, gu
                ? h('img', { src: gu, alt: '', style: { maxHeight: 120, maxWidth: '100%', objectFit: 'contain' } })
                : h('div', { style: { width: 120, height: 74, background: 'rgba(255,255,255,.12)', border: '1px dashed rgba(255,255,255,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, letterSpacing: '.1em' } }, 'GALERÍA Nº' + (b.index || 1)));
            }
            if (b.type === 'description') {
              // Se previsualiza en texto plano: la descripción de la tienda
              // viene en HTML y aquí interesa ver el encaje, no el marcado.
              const fs2 = (isMob ? { xl: 30, l: 22, m: 14, s: 12 } : { xl: 40, l: 28, m: 13, s: 10.5 })[b.size || 'm'];
              const isBody2 = b.size === 'm' || b.size === 's';
              const txt = descriptionText(productDescriptionFor(d), num(b.max, 0));
              return h('div', Object.assign({}, common, { style: Object.assign({}, common.style, {
                fontSize: fs2, fontWeight: isBody2 ? 400 : 700,
                lineHeight: isBody2 ? 1.5 : 1.15, whiteSpace: 'pre-line',
                maxWidth: isBody2 && !isMob ? 440 : '100%',
                opacity: txt ? 1 : .6,
              }) }), txt || '(el producto de la tienda aún no tiene descripción)');
            }
            if (b.type === 'html') return h('div', Object.assign({}, common, {
              style: Object.assign({}, common.style, { fontSize: 11, maxWidth: 320 }),
              dangerouslySetInnerHTML: { __html: b.html || '<span style="opacity:.6">(HTML vacío)</span>' },
            }));
            return null;
          };
          return h('div', { key: hx.id, className: 'gp-group' }, [
            h('div', { key: 'h', className: 'gp-group-head' }, [
              h('span', { key: 's', className: 'gp-step' }, 'SECCIÓN ' + String(si2 + 1).padStart(2, '0')),
              h('span', { key: 'k', className: 'gp-chip fuc' }, 'HERO'),
              h('select', { key: 'pat', className: 'gp-select', style: { width: 'auto' }, value: pat.id, onChange: (e) => upPageX(hx.id, { pattern: e.target.value }) },
                HERO_PATTERNS.map((p) => h('option', { key: p.id, value: p.id }, p.label))),
(function (secId, val) {
                return h('select', { key: 'w', className: 'gp-select', style: { width: 'auto' },
                  title: 'Ancho de ESTA sección en la tienda (independiente del resto de la ficha)',
                  value: val || 'auto', onChange: (e) => upPageX(secId, { width: e.target.value }) }, [
                  h('option', { key: 'a', value: 'auto' }, 'Ancho: según la ficha'),
                  h('option', { key: 'c', value: 'container' }, 'Ancho: contenedor'),
                  h('option', { key: 'f', value: 'full' }, 'Ancho: completo'),
                ]);
              })(hx.id, hx.width),
              h('select', { key: 'hh', className: 'gp-select', style: { width: 'auto' }, value: hx.height || 'm', onChange: (e) => upPageX(hx.id, { height: e.target.value }) }, [
                h('option', { key: 's4', value: 's' }, 'Compacto'),
                h('option', { key: 'm4', value: 'm' }, 'Normal'),
                h('option', { key: 'l4', value: 'l' }, 'Alto'),
                h('option', { key: 'xl4', value: 'xl' }, 'Pantalla completa'),
                h('option', { key: 'a4', value: 'auto' }, 'Auto (según contenido)'),
              ]),
              h('span', { key: 'sp', style: { flex: 1 } }),
            ].concat(moveBtns).concat([
              h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upPage(sfPage.filter((y) => y.id !== hx.id)) }, 'Quitar'),
            ])),
            h('div', { key: 'b', className: 'gp-group-body' }, [
              h('div', { key: 'bg', className: 'gp-grid2' }, [
                h(Row, { key: 'bc', label: 'Color de fondo (vacío = negro del sistema)' },
                  h(ColorField, { label: null, value: hx.bgColor || '', onChange: (v) => upPageX(hx.id, { bgColor: v }), placeholder: '#1D1D1B (vacío = negro)' })),
                h(ImgField, { key: 'bi', label: 'Imagen de fondo (tapa el color)', value: hx.bgImageUrl || '', gallery: productoGallery, onChange: (v) => upPageX(hx.id, { bgImageUrl: v }) }),
                h(Row, { key: 'tc', label: 'Color del texto (vacío = automático según fondo)' },
                  h(ColorField, { label: null, value: hx.textColor || '', onChange: (v) => upPageX(hx.id, { textColor: v }) })),
                h('label', { key: 'ov', className: 'gp-switch', style: { alignSelf: 'end' } }, [
                  h('input', { key: 'c', type: 'checkbox', checked: hx.overlay !== false, onChange: (e) => upPageX(hx.id, { overlay: e.target.checked }) }),
                  h('span', { key: 's5' }, 'Oscurecer imagen de fondo (legibilidad)'),
                ]),
              ]),
              // ── Previsualización en vivo (clic = seleccionar, drop = mover) ──
              h('div', { key: 'prev', style: { overflowX: 'auto', marginBottom: 8 } },
                h('div', { style: Object.assign({ width: isMob ? 375 : '100%', maxWidth: isMob ? 375 : 900, margin: '0 auto', border: '1px solid var(--gp-gris-claro)', color: pvText, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'space-between', minHeight: minH }, pvBg) },
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
                          outline: on2 ? '2px dashed var(--gp-fucsia)' : '1px dashed ' + (pvDark ? 'rgba(255,255,255,.28)' : 'rgba(29,29,27,.25)'),
                          outlineOffset: -2,
                          background: on2 ? 'rgba(25,172,177,.12)' : 'transparent',
                        },
                      }, bl.length
                        ? bl.map((b) => pvBlock(cid, b))
                        : h('span', { style: { fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .5 } }, CONTAINER_LABELS[cid] || cid));
                    })))))
              ,
              // ── Editor del contenedor seleccionado ──
              h('div', { key: 'ed', style: { borderTop: '1px dashed var(--gp-linea)', paddingTop: 8 } }, [
                h('div', { key: 't6', className: 'gp-label', style: { marginBottom: 6 } }, 'Contenido de: ' + (CONTAINER_LABELS[selC] || selC)),
                blocks.length === 0 && h('div', { key: 'e6', className: 'gp-muted', style: { marginBottom: 6 } }, 'Contenedor vacío. Agrega bloques abajo.'),
                h(React.Fragment, { key: 'blocks' }, blocks.map((b, bi) => h('div', { key: b.id, style: { border: '1px solid var(--gp-linea)', padding: '6px 8px', marginBottom: 6 } }, [
                  h('div', { key: 'bh', className: 'gp-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'c6', className: 'gp-chip neg' }, chipOf(b.type)),
                    h('span', { key: 'l6', className: 'gp-muted' }, (HERO_BLOCK_TYPES.find((x) => x.id === b.type) || {}).label || b.type),
                    h('select', { key: 'al', className: 'gp-select', style: { width: 110 }, title: 'Alineación horizontal en el contenedor', value: b.align || 'center', onChange: (e) => upBlock(b.id, { align: e.target.value }) }, [
                      h('option', { key: 'l7', value: 'left' }, 'Izquierda'),
                      h('option', { key: 'c7', value: 'center' }, 'Centro'),
                      h('option', { key: 'r7', value: 'right' }, 'Derecha'),
                    ]),
                    h('span', { key: 'sp6', className: 'grow' }),
                    bi > 0 && h('button', { key: 'up6', className: 'gp-btn gp-btn-sm', title: 'Subir', onClick: () => {
                      const xs = blocks.slice(); const t = xs[bi - 1]; xs[bi - 1] = xs[bi]; xs[bi] = t; upSlot(selC, xs);
                    } }, '↑'),
                    h('button', { key: 'x6', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upSlot(selC, blocks.filter((y) => y.id !== b.id)) }, '✕'),
                  ]),
                  b.type === 'photo' && h('div', { key: 'f', className: 'gp-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'l1', className: 'gp-label' }, 'tamaño'),
                    h('select', { key: 's7', className: 'gp-select', style: { width: 130 }, value: b.size || 'm', onChange: (e) => upBlock(b.id, { size: e.target.value }) },
                      [['s', 'Pequeña'], ['m', 'Mediana'], ['l', 'Grande'], ['xl', 'Extra grande'], ['auto', 'Natural (alto según la foto)']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    h('span', { key: 'l2', className: 'gp-label' }, 'animación'),
                    h('select', { key: 'a7', className: 'gp-select', style: { width: 130 }, value: b.anim || 'none', onChange: (e) => upBlock(b.id, { anim: e.target.value }) },
                      [['none', 'Sin animación'], ['float', 'Flotar'], ['zoom', 'Respirar'], ['sway', 'Balanceo']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                  ]),
                  b.type === 'title' && h('div', { key: 'f', className: 'gp-muted' }, 'Nombre del producto + SKU (automático desde la tienda).'),
                  b.type === 'text' && h('div', { key: 'f' }, [
                    h('div', { key: 'r1', className: 'gp-compline', style: { borderBottom: 0 } }, [
                      h(TextInput, { key: 'tx7', value: b.text || '', placeholder: 'Texto a mostrar', style: { flex: 1, minWidth: 200 }, onChange: (e) => upBlock(b.id, { text: e.target.value }) }),
                      h('select', { key: 's8', className: 'gp-select', style: { width: 120 }, value: b.size || 'l', onChange: (e) => upBlock(b.id, { size: e.target.value }) },
                        [['xl', 'Muy grande'], ['l', 'Grande'], ['m', 'Normal'], ['s', 'Pequeño']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    ]),
                    h(ColorField, { key: 'c8', label: null, value: b.color || '', onChange: (v) => upBlock(b.id, { color: v }), placeholder: 'color (vacío = del hero)' }),
                  ]),
                  b.type === 'items' && h('div', { key: 'f' }, [
                    h(React.Fragment, { key: 'its' }, (b.items || []).map((it) => h('div', { key: it.id, className: 'gp-compline' }, [
                      h('span', { key: 'c9', className: 'gp-chip fuc' }, '+'),
                      h(TextInput, { key: 't9', value: it.title, placeholder: 'Título', style: { width: 180 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { title: e.target.value }) : x)) }) }),
                      h(TextInput, { key: 'x9', value: it.text, placeholder: 'Texto al abrir', style: { flex: 1, minWidth: 140 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { text: e.target.value }) : x)) }) }),
                      h('button', { key: 'd9', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upBlock(b.id, { items: b.items.filter((x) => x.id !== it.id) }) }, '✕'),
                    ]))),
                    h('div', { key: 'act', className: 'gp-compline', style: { borderBottom: 0 } }, [
                      h('button', { key: 'add', className: 'gp-btn gp-btn-sm', onClick: () => upBlock(b.id, { items: (b.items || []).concat([{ id: newId('hi'), title: '', text: '' }]) }) }, '+ Item'),
                      h('label', { key: 'fl', className: 'gp-switch', style: { margin: 0 } }, [
                        h('input', { key: 'c10', type: 'checkbox', checked: b.float !== false, onChange: (e) => upBlock(b.id, { float: e.target.checked }) }),
                        h('span', { key: 's10' }, 'flotar'),
                      ]),
                    ]),
                  ]),
                  b.type === 'cta' && h('div', { key: 'f', className: 'gp-compline', style: { borderBottom: 0 } }, [
                    h(TextInput, { key: 'l11', value: b.label || '', placeholder: 'Texto del botón', style: { width: 180 }, onChange: (e) => upBlock(b.id, { label: e.target.value }) }),
                    h('select', { key: 's11', className: 'gp-select', style: { width: 110 }, value: b.style || 'primary', onChange: (e) => upBlock(b.id, { style: e.target.value }) },
                      [['primary', 'Fucsia'], ['dark', 'Oscuro'], ['ghost', 'Fantasma']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    h('select', { key: 'a11', className: 'gp-select', style: { width: 150 }, value: b.action || 'configurar', onChange: (e) => upBlock(b.id, { action: e.target.value }) },
                      [['configurar', 'Ir a Configurar'], ['url', 'Abrir URL']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    b.action === 'url' && h(TextInput, { key: 'u11', mono: true, value: b.url || '', placeholder: 'https://…', style: { flex: 1, minWidth: 160 }, onChange: (e) => upBlock(b.id, { url: e.target.value }) }),
                  ]),
                  b.type === 'icons' && h('div', { key: 'f' }, [
                    h(ColorField, { key: 'c12', label: null, value: b.color || '', onChange: (v) => upBlock(b.id, { color: v }), placeholder: 'color del texto (vacío = del hero)' }),
                    h(React.Fragment, { key: 'its' }, (b.items || []).map((it) => h('div', { key: it.id, className: 'gp-compline' }, [
                      h(TextInput, { key: 'i12', value: it.icon, placeholder: '❄️', title: 'Icono (emoji o carácter)', style: { width: 60, textAlign: 'center' }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { icon: e.target.value }) : x)) }) }),
                      h(TextInput, { key: 't12', value: it.title, placeholder: 'Destaque (ej: Roble macizo)', style: { width: 180 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { title: e.target.value }) : x)) }) }),
                      h(TextInput, { key: 'x12', value: it.text, placeholder: 'Detalle (opcional)', style: { flex: 1, minWidth: 120 }, onChange: (e) => upBlock(b.id, { items: b.items.map((x) => (x.id === it.id ? Object.assign({}, x, { text: e.target.value }) : x)) }) }),
                      h('button', { key: 'd12', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upBlock(b.id, { items: b.items.filter((x) => x.id !== it.id) }) }, '✕'),
                    ]))),
                    h('button', { key: 'add', className: 'gp-btn gp-btn-sm', onClick: () => upBlock(b.id, { items: (b.items || []).concat([{ id: newId('ic'), icon: '', title: '', text: '' }]) }) }, '+ Icono'),
                  ]),
                  b.type === 'specs' && h('div', { key: 'f', className: 'gp-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'l13', className: 'gp-label' }, 'filas a mostrar'),
                    h(TextInput, { key: 'n13', mono: true, type: 'number', min: 1, max: 12, value: b.count || 4, style: { width: 70 }, onChange: (e) => upBlock(b.id, { count: e.target.value }) }),
                    h('span', { key: 'm13', className: 'gp-muted' }, 'primeras filas de la tabla de Especificaciones.'),
                  ]),
                  b.type === 'gallery' && h('div', { key: 'f', className: 'gp-compline', style: { borderBottom: 0 } }, [
                    h('span', { key: 'l14', className: 'gp-label' }, 'foto Nº'),
                    h(TextInput, { key: 'n14', mono: true, type: 'number', min: 1, value: b.index || 1, style: { width: 70 }, onChange: (e) => upBlock(b.id, { index: e.target.value }) }),
                    h('span', { key: 's14', className: 'gp-label' }, 'tamaño'),
                    h('select', { key: 'sz14', className: 'gp-select', style: { width: 170 }, value: b.size || 'm', onChange: (e) => upBlock(b.id, { size: e.target.value }) },
                      [['s', 'Pequeña'], ['m', 'Mediana'], ['l', 'Grande'], ['xl', 'Extra grande'], ['auto', 'Natural (alto según la foto)']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                    h('span', { key: 'm14', className: 'gp-muted' }, 'número de la foto en la galería del producto (1 = primera).'),
                  ]),
                  b.type === 'description' && h('div', { key: 'f' }, [
                    h('div', { key: 'r', className: 'gp-compline', style: { borderBottom: 0 } }, [
                      h('span', { key: 'l16', className: 'gp-label' }, 'tamaño'),
                      h('select', { key: 's16', className: 'gp-select', style: { width: 130 }, value: b.size || 'm', onChange: (e) => upBlock(b.id, { size: e.target.value }) },
                        [['xl', 'Muy grande'], ['l', 'Grande'], ['m', 'Normal'], ['s', 'Pequeño']].map(([v, l]) => h('option', { key: v, value: v }, l))),
                      h('span', { key: 'l17', className: 'gp-label' }, 'recortar a'),
                      h(TextInput, { key: 'n16', mono: true, type: 'number', min: 0, value: b.max || 0, style: { width: 90 }, onChange: (e) => upBlock(b.id, { max: e.target.value }) }),
                      h('span', { key: 'm16', className: 'gp-muted' }, 'caracteres (0 = completa).'),
                    ]),
                    h('div', { key: 'help', className: 'gp-muted' },
                      'Es la descripción que el producto ya tiene en la tienda: se lee viva, no se copia. Si la editas en la tienda, la ficha se actualiza sola.'),
                  ]),
                  b.type === 'html' && h('textarea', { key: 'f', className: 'gp-textarea gp-mono', rows: 3, value: b.html || '', placeholder: '<div>HTML libre…</div>', onChange: (e) => upBlock(b.id, { html: e.target.value }) }),
                ]))),
                h('div', { key: 'add', className: 'gp-compline', style: { borderBottom: 0 } }, [
                  h('select', { key: 's15', className: 'gp-select', style: { width: 240 }, value: addType, onChange: (e) => { const o = Object.assign({}, blockSel); o[hx.id] = e.target.value; setBlockSel(o); } },
                    HERO_BLOCK_TYPES.map((t) => h('option', { key: t.id, value: t.id }, t.label))),
                  h('button', { key: 'b15', className: 'gp-btn gp-btn-sm gp-btn-dark', onClick: () => upSlot(selC, blocks.concat([normalizeHeroBlock({ type: addType })])) }, '+ Agregar bloque'),
                ]),
              ]),
            ]),
          ]);
        })),
        h('div', { key: 'addrow', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, [
          h('button', { key: 'addh', className: 'gp-btn', onClick: () => upPage(sfPage.concat([{ id: newId('hb'), kind: 'hero', pattern: 'clasico', height: 'm', bgColor: '', bgImageUrl: '', textColor: '', overlay: true, slots: {} }])) }, '+ Sección hero'),
          h('button', { key: 'addi', className: 'gp-btn', title: 'Sección de solo foto: en la tienda el alto se adapta a la imagen (sin recortes). Encadena varias para descripciones hechas de fotos apiladas.', onClick: () => upPage(sfPage.concat([{ id: newId('ps'), kind: 'imagen', imageUrl: '', alt: '', width: 'content', link: '' }])) }, '+ Sección imagen'),
        ]),
      ]),
      // ── Ficha de tienda: tabla de especificaciones ──
      h('div', { key: 'specs', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'FICHA'), 'Tabla de especificaciones']),
        h('div', { key: 'help', className: 'gp-muted', style: { marginBottom: 8 } },
          'Pestaña Especificaciones de la tienda (pantalla completa). Defínela a tu gusto; "Generar desde componentes" siembra filas con la base y la configuración por defecto (sin marcas), y luego editas lo que quieras.'),
        h(React.Fragment, { key: 'rows' }, specRows.map((sp) => h('div', { key: sp.id, className: 'gp-compline' }, [
          h(TextInput, { key: 'g', value: sp.group, placeholder: 'Grupo', style: { width: 130 }, onChange: (e) => upSpecRow(sp.id, { group: e.target.value }) }),
          h(TextInput, { key: 'l', value: sp.label, placeholder: 'Etiqueta (ej: Material)', style: { width: 180 }, onChange: (e) => upSpecRow(sp.id, { label: e.target.value }) }),
          h(TextInput, { key: 'v', value: sp.value, placeholder: 'Valor (ej: 100% algodón · Roble macizo 18mm)', style: { flex: 1, minWidth: 160 }, onChange: (e) => upSpecRow(sp.id, { value: e.target.value }) }),
          h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upSpecs(specRows.filter((x) => x.id !== sp.id)) }, '✕'),
        ]))),
        h('div', { key: 'act', className: 'gp-compline', style: { borderBottom: 0, marginTop: 4 } }, [
          h('button', { key: 'add', className: 'gp-btn gp-btn-sm', onClick: () => upSpecs(specRows.concat([{ id: newId('sp'), group: '', label: '', value: '' }])) }, '+ Fila'),
          h('button', { key: 'gen', className: 'gp-btn gp-btn-sm gp-btn-dark', onClick: genSpecs }, 'Generar desde componentes'),
        ]),
      ]),
      // ── Ficha: pestañas de la barra (títulos, mostrar y orden) ──
      h('div', { key: 'tabs', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'FICHA'), 'Pestañas de la barra (título, mostrar y orden)']),
        (function () {
          const order = (Array.isArray(sfTabs.order) ? sfTabs.order : []).filter((x) => ['explorar', 'specs', 'fotos'].indexOf(x) !== -1);
          ['explorar', 'specs', 'fotos'].forEach((x) => { if (order.indexOf(x) === -1) order.push(x); });
          const meta = {
            explorar: { label: 'Principal', ph: (d.name || 'Explorar') + ' (título)', showKey: null },
            specs: { label: 'Especificaciones', ph: 'Especificaciones (título)', showKey: 'showSpecs' },
            fotos: { label: 'Fotos', ph: 'Fotos (título)', showKey: 'showFotos' },
          };
          return h(React.Fragment, { key: 'ord' }, order.map((tid, ti) => h('div', { key: tid, className: 'gp-compline' }, [
            h('button', { key: 'up', className: 'gp-btn gp-btn-sm', disabled: ti === 0, title: 'Subir en el orden', onClick: () => {
              const xs = order.slice(); const t2 = xs[ti - 1]; xs[ti - 1] = xs[ti]; xs[ti] = t2; upTabs({ order: xs });
            } }, '↑'),
            h('span', { key: 'k', className: 'gp-chip neg' }, meta[tid].label),
            h(TextInput, { key: 'l', value: sfTabs[tid] || '', placeholder: meta[tid].ph, style: { width: 230 }, onChange: (e) => { const o = {}; o[tid] = e.target.value; upTabs(o); } }),
            meta[tid].showKey && h('label', { key: 'sw', className: 'gp-switch', style: { margin: 0 } }, [
              h('input', { key: 'c', type: 'checkbox', checked: sfTabs[meta[tid].showKey] !== false, onChange: (e) => { const o = {}; o[meta[tid].showKey] = e.target.checked; upTabs(o); } }),
              h('span', { key: 's' }, 'mostrar pestaña'),
            ]),
          ])));
        })(),
        h(Row, { key: 'buy', label: 'Botón Comprar (a la derecha; solo visible en la pestaña principal)' },
          h(TextInput, { value: sfTabs.comprar || '', onChange: (e) => upTabs({ comprar: e.target.value }), placeholder: 'Comprar' })),
        h('div', { key: 'help', className: 'gp-muted', style: { marginTop: 6 } },
          'Ocultar una pestaña esconde su botón en la barra (la sección puede seguir en la página vía el builder). En móvil la barra solo muestra la pestaña principal.'),
      ]),
      // ── Ficha: estilo del configurador y la página (ProductLab) ──
      h('div', { key: 'style', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'FICHA'), 'Estilo del configurador y la página']),
        h('div', { key: 'help', className: 'gp-muted', style: { marginBottom: 8 } },
          'Personaliza cómo se ve el configurador de ESTE producto en la tienda (vacío = colores y tipografías del theme del sitio). El previsualizador de la pestaña Pasos refleja estos ajustes en vivo.'),
        // ── Qué estilo rige aquí. Los colores y la barra se definen UNA vez
        // en la pestaña Estilos; en el producto solo se elige cuál aplicar
        // (o se ajusta su estilo propio, si no usa plantilla).
        (function () {
          const tpls = styleTemplates();
          const porDefecto = defaultStyleTemplate();
          const elegido = s(sf.styleId).trim();
          const usando = elegido && elegido !== 'own' ? styleTemplateById(elegido) : (elegido === 'own' ? null : porDefecto);
          const upSf = (patch) => up({ storefront: Object.assign({}, sf, patch) });
          return h('div', { key: 'tpl' }, [
            h('div', { key: 'r', className: 'gp-compline', style: { borderBottom: 0 } }, [
              h('span', { key: 'l', className: 'gp-label' }, 'estilo aplicado'),
              h('select', { key: 'sel', className: 'gp-select', style: { minWidth: 280 }, value: elegido,
                onChange: (e) => upSf({ styleId: e.target.value }) }, [
                h('option', { key: '', value: '' }, porDefecto ? 'Del catálogo — «' + porDefecto.name + '»' : 'Del catálogo — (ninguna plantilla definida)'),
                h('option', { key: 'own', value: 'own' }, 'Estilo propio de este producto'),
                ...tpls.map((t) => h('option', { key: t.id, value: t.id }, 'Plantilla — ' + t.name)),
              ]),
              usando && h('button', { key: 'cp', className: 'gp-btn gp-btn-sm',
                title: 'Copia la plantilla al estilo propio de este producto para retocarlo aquí sin afectar a los demás.',
                onClick: () => upSf({ style: JSON.parse(JSON.stringify(usando.style)), styleId: 'own' }) }, 'Copiar a estilo propio'),
            ]),
            h('div', { key: 'm', className: 'gp-muted', style: { marginBottom: 8 } }, [
              'En la tienda rige: ', h('b', { key: 'b' }, styleSourceLabel(d)), '. ',
              usando ? 'Las plantillas se crean y se editan en la pestaña ESTILOS; al cambiarlas cambian todos los productos que las usan.'
                : 'Este producto lleva su propio estilo; para reutilizarlo en otros, guárdalo como plantilla en la pestaña ESTILOS.',
            ]),
            // Sin plantilla, el estilo propio se edita aquí mismo.
            !usando && h(StyleEditor, { key: 'ed', st: sf.style || {},
              onChange: (patch) => up({ storefront: Object.assign({}, sf, { style: Object.assign({}, sf.style || {}, patch) }) }) }),
          ]);
        })(),
      ]),
      ]),
        // ── Visor 3D (OPCIONAL) ──
        h('div', { key: 'm3', style: sec === 'modelo3d' ? null : { display: 'none' } }, (function () {
          const m = d.model3d || null;
          const upM = (patch) => up({ model3d: Object.assign({ enabled: true, url: '', rotation: [0, 0, 0], parts: [], finishes: [] }, m, patch) });
          const upPart = (pid, patch) => upM({ parts: (m.parts || []).map((p) => (p.id === pid ? Object.assign({}, p, patch) : p)) });
          const upFin = (fid, patch) => upM({ finishes: (m.finishes || []).map((f) => (f.id === fid ? Object.assign({}, f, patch) : f)) });
          const usedMats = (m && m.parts || []).reduce((a, p) => a.concat(p.materials || []), []);
          const active = m && m.enabled !== false && s(m.url).trim();
          return [
            h('div', { key: 'intro', className: 'gp-card' }, [
              h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, '3D'), 'Visor 3D del producto (opcional)']),
              h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 10 } },
                'Opcional: si este producto no tiene modelo 3D, deja la sección vacía y todo lo demás funciona igual. Al cargar un .glb, cada paso del configurador puede cambiar el color, el acabado o la visibilidad de una pieza, y verás el resultado en vivo.'),
              !m
                ? h('button', { key: 'add', className: 'gp-btn gp-btn-primary', onClick: () => upM({}) }, '+ Activar visor 3D para este producto')
                : h(React.Fragment, { key: 'cfg' }, [
                    h('label', { key: 'en', className: 'gp-switch' }, [
                      h('input', { key: 'c', type: 'checkbox', checked: m.enabled !== false, onChange: (e) => upM({ enabled: e.target.checked }) }),
                      h('span', { key: 's' }, 'Visor 3D activo en este producto'),
                    ]),
                    h(Row, { key: 'url', label: 'Archivo del modelo (.glb) — se sirve desde la plataforma' },
                      h('div', { className: 'gp-verify-cost' }, [
                        h(TextInput, { key: 'i', mono: true, value: m.url || '', placeholder: 'https://…/modelo.glb', onChange: (e) => upM({ url: e.target.value }) }),
                        h('label', { key: 'u', className: 'gp-btn gp-btn-sm', style: { cursor: 'pointer' } }, [
                          mdlBusy ? 'Subiendo…' : 'Subir .glb',
                          h('input', { key: 'f', type: 'file', accept: '.glb,.gltf,model/gltf-binary', style: { display: 'none' },
                            onChange: async (e) => {
                              const f = e.target.files && e.target.files[0];
                              e.target.value = '';
                              if (!f) return;
                              setMdlBusy(true);
                              try { upM({ url: await uploadModel(f) }); shell.notify({ level: 'success', text: 'Modelo subido.' }); }
                              catch (err) { shell.notify({ level: 'error', text: 'No se pudo subir: ' + ((err && err.message) || 'error') }); }
                              setMdlBusy(false);
                            } }),
                        ]),
                      ])),
                    h('div', { key: 'rot', className: 'gp-grid3' }, ['X', 'Y', 'Z'].map((ax, i) =>
                      h(Row, { key: ax, label: 'Rotación ' + ax + ' (rad) — corrige modelos CAD Z-up' },
                        h(TextInput, { mono: true, type: 'number', step: '0.01', value: (m.rotation || [0, 0, 0])[i] || 0,
                          onChange: (e) => { const r = (m.rotation || [0, 0, 0]).slice(); r[i] = num(e.target.value); upM({ rotation: r }); } })))),
                    h('label', { key: 'mir', className: 'gp-switch' }, [
                      h('input', { key: 'c', type: 'checkbox', checked: m.mirror === true, onChange: (e) => upM({ mirror: e.target.checked }) }),
                      h('span', { key: 's' }, 'Reflejar en el eje X'),
                    ]),
                    // Realidad aumentada: el visor encuadra el modelo a un
                    // tamaño arbitrario, así que apoyarlo en el suelo real
                    // exige saber cuánto mide de verdad. Sin este dato el
                    // botón "Ver en tu espacio" no se ofrece — mejor no
                    // ofrecerlo que colocarlo a una escala inventada.
                    h(Row, { key: 'real', label: 'Medida real del lado más largo, en cm (para "Ver en tu espacio" con la cámara)' },
                      h(TextInput, { mono: true, type: 'number', min: 0, step: '0.5',
                        value: m.realSizeCm == null || m.realSizeCm === 0 ? '' : m.realSizeCm,
                        placeholder: 'ej: 45 — vacío = sin realidad aumentada',
                        onChange: (e) => upM({ realSizeCm: e.target.value === '' ? 0 : num(e.target.value) }) })),
                    // Android abre el AR con Google Scene Viewer, que es del
                    // sistema y funciona en CUALQUIER navegador — no depende
                    // de WebXR. Pero consume un ARCHIVO por URL pública y lo
                    // interpreta en METROS: el .glb original mide lo que mida
                    // (el Hanoi, ~50 unidades → 50 metros). Por eso se genera
                    // aquí una copia a escala real y se sube.
                    h(Row, { key: 'arglb', label: 'Modelo para AR de Android (Scene Viewer)' },
                      h('div', { className: 'gp-verify-cost', style: { flexWrap: 'wrap' } }, [
                        h('button', { key: 'g', className: 'gp-btn gp-btn-sm gp-btn-dark', disabled: arBusy || !m.url || !num(m.realSizeCm, 0), onClick: async () => {
                          if (!viewerRef3d.current) { shell.notify({ level: 'error', text: 'Abre el visor primero: el archivo se genera desde el modelo cargado.' }); return; }
                          setArBusy(true);
                          try {
                            const blob = await viewerRef3d.current.exportGLB({ realSizeCm: num(m.realSizeCm, 0) });
                            const file = new File([blob], 'ar-' + (s(d.sku).trim() || 'modelo') + '.glb', { type: 'model/gltf-binary' });
                            upM({ arUrl: await uploadModel(file) });
                            shell.notify({ level: 'success', text: 'Modelo de AR generado (' + Math.round(blob.size / 1024) + ' KB). Guarda y publica para que llegue a la tienda.' });
                          } catch (err) {
                            shell.notify({ level: 'error', text: 'No se pudo generar: ' + ((err && err.message) || 'error') });
                          }
                          setArBusy(false);
                        } }, arBusy ? 'Generando…' : (m.arUrl ? 'Regenerar' : 'Generar y subir')),
                        m.arUrl ? h('span', { key: 'ok', className: 'gp-chip fuc' }, 'listo') : null,
                        h('span', { key: 'h', className: 'gp-muted' }, !num(m.realSizeCm, 0)
                          ? 'Pon primero la medida real: sin ella no se puede escalar.'
                          : 'Se genera con la configuración por defecto del producto. Regenéralo si cambias el modelo, las partes o los acabados.'),
                      ])),
                    h('label', { key: 'pub', className: 'gp-switch' }, [
                      h('input', { key: 'c', type: 'checkbox', checked: m.publish === true, onChange: (e) => upM({ publish: e.target.checked }) }),
                      h('span', { key: 's' }, 'Publicar el 3D en la tienda (viaja en el JSON público para el theme)'),
                    ]),
                  ]),
            ]),
            // ── Visor + probar una configuración ──
            active && h('div', { key: 'view', className: 'gp-card' }, [
              h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'VISTA'), 'Resultado de la configuración']),
              h(Viewer3D, { key: 'v', model: m, state: build3dState(d, try3d), height: 380, onViewer: (v) => { viewerRef3d.current = v; }, onMaterials: (list) => { if (JSON.stringify(list) !== JSON.stringify(mats)) setMats(list); } }),
              (d.groups || []).length
                ? h('div', { key: 'sel', className: 'gp-grid3', style: { marginTop: 10 } }, d.groups.map((g) =>
                    h(Row, { key: g.id, label: g.label || typeLabel(g.typeId) },
                      h('select', { className: 'gp-select', value: try3d[g.id] || (groupDefaultValue(g) || {}).id || '',
                        onChange: (e) => setTry3d(Object.assign({}, try3d, { [g.id]: e.target.value })) },
                        groupValues(g).map((v) => h('option', { key: v.id, value: v.id }, v.label))))))
                : h('div', { key: 'nos', className: 'gp-muted', style: { marginTop: 8 } }, 'Este producto no tiene pasos: el visor muestra la configuración base.'),
            ]),
            // ── Partes: material del GLB → pieza controlable ──
            m && h('div', { key: 'parts', className: 'gp-card' }, [
              h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'PARTES'), 'Piezas controlables del modelo']),
              h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 8 } },
                'Una parte agrupa uno o más materiales del archivo 3D y es lo que los pasos pueden pintar, acabar u ocultar.'),
              mats.length ? h('div', { key: 'mats' }, [
                h('div', { key: 'l', className: 'gp-label' }, 'Materiales detectados en el modelo (clic para crear su parte)'),
                h('div', { key: 'c' }, mats.map((name) => {
                  const used = usedMats.indexOf(name) !== -1;
                  return h('span', { key: name, className: 'gp-mat-chip' + (used ? ' used' : ''), title: used ? 'Ya asignado a una parte' : 'Crear una parte con este material',
                    onClick: () => { if (used) return; upM({ parts: (m.parts || []).concat([{ id: newId('part'), label: name, materials: [name], defaultColor: '#cccccc' }]) }); } }, name);
                })),
              ]) : h('div', { key: 'nm', className: 'gp-muted' }, active ? 'Carga el visor para detectar los materiales del archivo.' : 'Sube un .glb para detectar sus materiales.'),
              h('div', { key: 'list', style: { marginTop: 10 } }, (m.parts || []).map((p) => h('div', { key: p.id, className: 'gp-card', style: { background: 'var(--gp-plata)', marginBottom: 8 } }, [
                h('div', { key: 'r1', className: 'gp-grid3' }, [
                  h(Row, { key: 'l', label: 'Nombre de la parte' },
                    h(TextInput, { value: p.label, placeholder: 'Ej: Tapiz, Estructura', onChange: (e) => upPart(p.id, { label: e.target.value }) })),
                  h(Row, { key: 'm', label: 'Materiales del GLB (coma-sep., respeta mayúsculas)' },
                    h(TextInput, { mono: true, value: joinList(p.materials), onChange: (e) => upPart(p.id, { materials: e.target.value }) })),
                  h(ColorField, { key: 'c', label: 'Color por defecto', value: p.defaultColor, onChange: (v) => upPart(p.id, { defaultColor: v }) }),
                ]),
                h('div', { key: 'r2', className: 'gp-grid3' }, [
                  h(Row, { key: 'f', label: 'Acabado por defecto' },
                    h('select', { className: 'gp-select', value: p.defaultFinish || '', onChange: (e) => upPart(p.id, { defaultFinish: e.target.value }) },
                      [h('option', { key: '', value: '' }, '— color libre —')].concat((m.finishes || []).map((f) => h('option', { key: f.id, value: f.id }, f.label || f.id))))),
                  h(Row, { key: 'rg', label: 'Rugosidad (vacío = 0.85)' },
                    h(TextInput, { mono: true, type: 'number', step: '0.05', min: 0, max: 1, value: p.roughness == null ? '' : p.roughness,
                      onChange: (e) => upPart(p.id, { roughness: e.target.value === '' ? null : num(e.target.value) }) })),
                  h('div', { key: 'g' }, [
                    h('label', { key: 'v', className: 'gp-switch' }, [
                      h('input', { key: 'c', type: 'checkbox', checked: p.grainVertical === true, onChange: (e) => upPart(p.id, { grainVertical: e.target.checked }) }),
                      h('span', { key: 's' }, 'Veta vertical (piezas de pie)'),
                    ]),
                    h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upM({ parts: m.parts.filter((x) => x.id !== p.id) }) }, '✕ Quitar parte'),
                  ]),
                ]),
                // Ajuste fino de la veta: inclinación y excepciones por material.
                h('div', { key: 'r3', className: 'gp-grid2' }, [
                  h(Row, { key: 'ga', label: 'Inclinación de la veta (rad) — sigue el eje de piezas inclinadas' },
                    h(TextInput, { mono: true, type: 'number', step: '0.01', value: p.grainAngle || 0,
                      onChange: (e) => upPart(p.id, { grainAngle: num(e.target.value) }) })),
                  h(Row, { key: 'gal', label: 'Materiales con veta A LO LARGO (excepciones; anulan vertical e inclinación)' },
                    h(TextInput, { mono: true, value: joinList(p.grainAlongMaterials), placeholder: 'Ej: Travesano',
                      onChange: (e) => upPart(p.id, { grainAlongMaterials: e.target.value }) })),
                ]),
              ]))),
              h('button', { key: 'add', className: 'gp-btn gp-btn-sm', onClick: () => upM({ parts: (m.parts || []).concat([{ id: newId('part'), label: '', materials: [], defaultColor: '#cccccc' }]) }) }, '+ Parte'),
            ]),
            // ── Acabados (opcional): textura + tinte + rugosidad ──
            m && h('div', { key: 'fins', className: 'gp-card' }, [
              h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'ACABADOS'), 'Acabados con textura (opcional)']),
              h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 8 } },
                'Un acabado es una textura + tinte + rugosidad (madera, tela con trama, laminado). Si te basta con colores planos, no hace falta ninguno. La proyección triplanar ignora las UVs del CAD y proyecta la textura de forma continua.'),
              h('div', { key: 'list' }, (m.finishes || []).map((f) => h('div', { key: f.id, className: 'gp-card', style: { background: 'var(--gp-plata)', marginBottom: 8 } }, [
                h('div', { key: 'r1', className: 'gp-grid3' }, [
                  h(Row, { key: 'l', label: 'Nombre' }, h(TextInput, { value: f.label, placeholder: 'Ej: Roble natural', onChange: (e) => upFin(f.id, { label: e.target.value }) })),
                  h(ColorField, { key: 'c', label: 'Tinte', value: f.color, onChange: (v) => upFin(f.id, { color: v }) }),
                  h(ImgField, { key: 'tx', label: 'Textura', value: f.texture, gallery: productoGallery, onChange: (v) => upFin(f.id, { texture: v }) }),
                ]),
                h('div', { key: 'r2', className: 'gp-grid3' }, [
                  h(Row, { key: 'rg', label: 'Rugosidad' }, h(TextInput, { mono: true, type: 'number', step: '0.05', min: 0, max: 1, value: f.roughness, onChange: (e) => upFin(f.id, { roughness: num(e.target.value) }) })),
                  h(Row, { key: 'sc', label: 'Escala de textura' }, h(TextInput, { mono: true, type: 'number', step: '0.1', value: f.textureScale, onChange: (e) => upFin(f.id, { textureScale: num(e.target.value) }) })),
                  h(Row, { key: 'gr', label: 'Veta en el brillo (0–1)' }, h(TextInput, { mono: true, type: 'number', step: '0.05', min: 0, max: 1, value: f.grain, onChange: (e) => upFin(f.id, { grain: num(e.target.value) }) })),
                ]),
                h('div', { key: 'r3', className: 'gp-fx-row' }, [
                  h('label', { key: 'tp', className: 'gp-switch' }, [
                    h('input', { key: 'c', type: 'checkbox', checked: f.triplanar !== false, onChange: (e) => upFin(f.id, { triplanar: e.target.checked }) }),
                    h('span', { key: 's' }, 'Proyección triplanar'),
                  ]),
                  h('span', { key: 'sp', className: 'grow' }),
                  h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => upM({ finishes: m.finishes.filter((x) => x.id !== f.id) }) }, '✕'),
                ]),
              ]))),
              h('button', { key: 'add', className: 'gp-btn gp-btn-sm', onClick: () => upM({ finishes: (m.finishes || []).concat([{ id: newId('fin'), label: '', color: '#ffffff', texture: '', roughness: 0.8, textureScale: 1, grain: 0, triplanar: true }]) }) }, '+ Acabado'),
            ]),
            m && h('div', { key: 'del', className: 'gp-actions' },
              h('button', { className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: () => { if (window.confirm('¿Quitar el visor 3D de este producto? Se borran partes, acabados y los efectos de los pasos.')) up({ model3d: null }); } }, 'Quitar el 3D de este producto')),
          ];
        })()),
      warns.length > 0 && h('div', { key: 'w', className: 'gp-warnbox' }, warns.map((w, i) => h('div', { key: i }, '• ' + w))),
      ]),
      // Sin barra inferior: el precio vivo y Guardar/Aplicar los pinta el
      // HEADER (hdrExtra, publicado en el useEffect de acciones).
      picking && h(ProductPicker, { key: 'picker', onClose: () => setPicking(false), onPick: (p) => {
        setPicking(false);
        const js = (p.sourceLinks || []).find((x) => x && x.integration === 'jumpseller');
        up({
          storeRef: {
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
    // El detalle vive en el nav store: el header pinta el breadcrumb y las
    // pestañas del producto abierto (General/Galería/Estudio/Experiencia).
    const n = useNav();
    const editing = n.det && n.det.tipo === 'producto' && n.sec === 'productos' ? n.det.draft : null;
    const setEditing = (eq) => setNav(eq == null
      ? { det: null, tab: null }
      : { det: { tipo: 'producto', draft: eq, nombre: eq.name || 'Nuevo producto' }, tab: 'general' });
    // Vista por defecto: CARDS visuales (foto + datos), estilo menú de juego.
    // La tabla clásica queda a un toque para trabajo denso. (Antes del return
    // condicional del editor: las reglas de hooks piden orden estable.)
    const [vista, setVista] = useState('cards');
    // Editor a pantalla completa: usa todo el espacio de la app, sin modal.
    if (editing != null) {
      return h(ProductoForm, {
        key: editing.id || 'new',
        initial: editing.id ? editing : null,
        sec: n.tab || 'general',
        onDone: () => setEditing(null),
      });
    }
    return h('div', null, [
      h('div', { key: 'f', className: 'gp-filters gp-filters-centro' }, [
        h('div', { key: 'sw', className: 'gp-vswitch' }, [
          h('button', { key: 'c', className: 'gp-btn gp-btn-sm' + (vista === 'cards' ? ' gp-btn-dark' : ''), onClick: () => setVista('cards') }, 'Cards'),
          h('button', { key: 't', className: 'gp-btn gp-btn-sm' + (vista === 'tabla' ? ' gp-btn-dark' : ''), onClick: () => setVista('tabla') }, 'Tabla'),
        ]),
        h('span', { key: 'n', className: 'gp-muted' }, state.productos.length + ' producto(s)'),
      ]),
      vista === 'cards'
        ? h('div', { key: 'cards', className: 'gp-cards-grid' },
            [h('button', { key: '__add', className: 'gp-pcard gp-pcard-add', onClick: () => setEditing({}),
              title: 'Crear un producto nuevo (se enlaza a un producto de Jumpseller como siempre)' }, [
              h('span', { key: 'i', className: 'gp-pcard-add-ico' }, '+'),
              h('span', { key: 't', className: 'gp-pcard-add-txt' }, 'Añadir producto'),
            ])].concat(state.productos.map((eq) => {
              const foto = productoImage(eq);
              const ref2 = eq.storeRef && eq.storeRef.itemId ? eq.storeRef : null;
              return h('button', { key: eq.id, className: 'gp-pcard', onClick: () => setEditing(eq) }, [
                h('div', { key: 'f', className: 'gp-pcard-foto' },
                  foto ? h('img', { src: foto, alt: '' }) : h('span', { className: 'gp-muted' }, 'Sin foto')),
                h('div', { key: 'n', className: 'gp-pcard-nombre' }, eq.name || '—'),
                h('div', { key: 'p', className: 'gp-pcard-precio' }, fmtMoney(productoComputedPrice(eq))),
                h('div', { key: 'm', className: 'gp-pcard-meta' }, [
                  h('span', { key: 'g', className: 'gp-chip gris' }, (eq.groups || []).length + ' paso(s)'),
                  ref2 ? h('span', { key: 'js', className: 'gp-chip fuc' }, ref2.sourceId ? 'JS #' + ref2.sourceId : 'enlazado')
                       : h('span', { key: 'js', className: 'gp-chip gris' }, 'sin enlace'),
                ]),
              ]);
            })))
        : state.productos.length === 0
        ? h('div', { key: 'e', className: 'gp-card gp-muted' }, 'Aún no hay productos. Un producto enlaza un producto de la tienda con sus pasos de personalización (componentes elegibles y default por paso) y calcula su precio desde los costos.')
        : h('div', { key: 'tbl', className: 'gp-card', style: { padding: 0 } },
            h('table', { className: 'gp-table' }, [
              h('thead', { key: 'h' }, h('tr', null, ['', 'Producto', 'SKU', 'Pasos', 'Precio', 'Recalculado', 'Entrega', 'Tienda', ''].map((c, i) => h('th', { key: i }, c)))),
              h('tbody', { key: 'b' }, state.productos.map((eq) => {
                const computed = productoComputedPrice(eq);
                const warns = productoWarnings(eq);
                return h('tr', { key: eq.id }, [
                  h('td', { key: 'i' }, h(Thumb, { url: productoImage(eq) })),
                  h('td', { key: 'n' }, [
                    h('div', { key: '1', style: { fontWeight: 600, cursor: 'pointer' }, title: 'Editar producto', onClick: () => setEditing(eq) }, eq.name),
                    warns.length > 0 && h('div', { key: '2', className: 'gp-muted', style: { color: 'var(--gp-warn)' } }, '⚠ ' + warns.length + ' aviso(s)'),
                  ]),
                  h('td', { key: 's', className: 'gp-mono', style: { fontSize: 11 } }, eq.sku || '—'),
                  h('td', { key: 'g', className: 'gp-mono', style: { fontSize: 11 } }, (eq.groups || []).length),
                  h('td', { key: 'p', className: 'gp-price' }, fmtMoney(eq.price)),
                  h('td', { key: 'c', className: 'gp-price', style: computed !== num(eq.price) ? { color: 'var(--gp-err)', fontWeight: 600 } : null },
                    computed !== num(eq.price) ? fmtMoney(computed) + ' *' : '='),
                  h('td', { key: 'd', className: 'gp-mono', style: { fontSize: 11 } }, productoDelivery(eq) + 'd'),
                  h('td', { key: 'sync' }, h(SyncBadge, { eq })),
                  h('td', { key: 'a', style: { whiteSpace: 'nowrap' } }, [
                    productoStoreUrl(eq) && h('a', { key: 'st', className: 'gp-btn gp-btn-sm', style: { textDecoration: 'none', display: 'inline-block' }, href: productoStoreUrl(eq), target: '_blank', rel: 'noopener noreferrer', title: 'Ver el producto en la tienda' }, 'Tienda ↗'),
                    productoStoreUrl(eq) && ' ',
                    storeRefOf(eq) && h('button', { key: 'ap', className: 'gp-btn gp-btn-sm gp-btn-dark', title: 'Escribir precio, opciones y variantes en el producto de la tienda', onClick: async () => {
                      const r = await applyToStore(eq);
                      shell.notify(r.success ? { level: 'success', text: r.message } : { level: 'error', text: r.error });
                    } }, 'Aplicar'),
                    ' ',
                    h('button', { key: 'e', className: 'gp-btn gp-btn-sm', onClick: () => setEditing(eq) }, 'Editar'),
                    ' ',
                    h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', onClick: async () => {
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
    const txtInput = (key, label, opts) => h(Row, { label },
      h(TextInput, Object.assign({ value: r[key] == null ? '' : r[key], onChange: (e) => { const o = {}; o[key] = e.target.value; upR(o); } }, opts || {})));
    const pend = recalcPreview();
    return h('div', null, [
      h('div', { key: 'rules', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'REGLAS'), 'Parámetros de precio']),
        (function () {
          // Ejemplo vivo: usa los valores que se están editando (no los guardados).
          const m = num(r.marginDefaultPct, 25);
          const taxPct = numOr(r.salesTaxPct, 19);
          const taxLbl = s(r.salesTaxLabel).trim() || 'IVA';
          const basis = r.marginBasis === 'sale' ? 'sale' : 'cost';
          const dec = Math.max(0, Math.min(4, num(r.currencyDecimals, 0)));
          const sym = r.currencySymbol != null && r.currencySymbol !== '' ? s(r.currencySymbol) : '$';
          const loc = s(r.locale).trim() || 'es-CL';
          const dfmt = (v) => { try { return sym + (dec ? num(v) : Math.round(num(v))).toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }); } catch (e) { return sym + num(v).toFixed(dec); } };
          const ex = dec ? 100 : 100000;
          const net = basis === 'sale' ? ex / (1 - Math.min(m, 95) / 100) : ex * (1 + m / 100);
          return h('div', { key: 'basis', className: 'gp-warnbox', style: { background: 'var(--gp-plata)', border: '1px solid var(--gp-gris-claro)', color: 'var(--gp-negro)' } }, [
            h('div', { key: 'r', className: 'gp-compline', style: { borderBottom: 0 } }, [
              h('span', { key: 'l', className: 'gp-label' }, 'Base del margen'),
              h('select', { key: 's', className: 'gp-select', style: { width: 'auto' }, value: basis, onChange: (e) => upR({ marginBasis: e.target.value }) }, [
                h('option', { key: 'c', value: 'cost' }, 'Sobre el costo (markup): venta = costo × (1 + m%)'),
                h('option', { key: 'v', value: 'sale' }, 'Sobre la venta: venta = costo ÷ (1 − m%)'),
              ]),
            ]),
            h('div', { key: 'ex', className: 'gp-muted', style: { marginTop: 4 } },
              'Ejemplo con el margen por defecto (' + m + '%): costo ' + dfmt(ex) + ' → neto ' + dfmt(net) + ' → con ' + taxLbl + ' ' + taxPct + '% = ' + dfmt(net * (1 + taxPct / 100)) + '. ' +
              (basis === 'sale'
                ? 'Con base "sobre la venta", el ' + m + '% del precio neto de venta es tu ganancia.'
                : 'Con base "sobre el costo", ganas el ' + m + '% de lo que te costó.')),
          ]);
        })(),
        // ── Moneda y formato ──
        h('div', { key: 'cur-t', className: 'gp-label', style: { marginTop: 10 } }, 'MONEDA Y FORMATO'),
        h('div', { key: 'cur', className: 'gp-grid3' }, [
          h(React.Fragment, { key: 'cc' }, txtInput('currency', 'Moneda base (código)', { placeholder: 'CLP · USD · EUR · MXN…' })),
          h(React.Fragment, { key: 'cs' }, txtInput('currencySymbol', 'Símbolo', { placeholder: '$ · € · S/' })),
          h(React.Fragment, { key: 'cd' }, numInput('currencyDecimals', 'Decimales (0 para CLP/JPY, 2 para USD/EUR)')),
          h(React.Fragment, { key: 'lo' }, txtInput('locale', 'Locale de formato', { placeholder: 'es-CL · es-MX · en-US' })),
        ]),
        // ── Tipos de cambio de monedas de costo ──
        h('div', { key: 'fx-t', className: 'gp-label', style: { marginTop: 10 } }, 'MONEDAS DE COSTO (tipo de cambio → moneda base)'),
        h('div', { key: 'fx-h', className: 'gp-muted', style: { marginBottom: 6 } },
          'Para proveedores que cotizan en otra moneda. El costo del componente se convierte con este valor antes del margen.'),
        h('div', { key: 'fx' }, Object.keys(r.fx || {}).map((code) => h('div', { key: code, className: 'gp-compline' }, [
          h('span', { key: 'c', className: 'gp-chip neg' }, code),
          h('span', { key: 'l', className: 'gp-label' }, '1 ' + code + ' ='),
          h(TextInput, { key: 'v', mono: true, type: 'number', style: { width: 140 },
            value: (r.fx || {})[code] == null ? '' : r.fx[code],
            onChange: (e) => { const fx = Object.assign({}, r.fx || {}); fx[code] = num(e.target.value); upR({ fx }); } }),
          h('span', { key: 'b', className: 'gp-label' }, s(r.currency).toUpperCase() || 'CLP'),
          h('span', { key: 'sp', className: 'grow' }),
          h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', title: 'Quitar moneda',
            onClick: () => { const fx = Object.assign({}, r.fx || {}); delete fx[code]; upR({ fx }); } }, '✕'),
        ]))),
        h('button', { key: 'fx-add', className: 'gp-btn gp-btn-sm', style: { marginTop: 6 }, onClick: () => {
          const code = s(window.prompt('Código de la moneda de costo (ej: USD, EUR, CNY):')).trim().toUpperCase();
          if (!code) return;
          const fx = Object.assign({}, r.fx || {}); if (fx[code] == null) fx[code] = 1; upR({ fx });
        } }, '+ Moneda de costo'),
        // ── Impuesto, márgenes, redondeo y plazos ──
        h('div', { key: 'g-t', className: 'gp-label', style: { marginTop: 12 } }, 'IMPUESTO, MÁRGENES, REDONDEO Y PLAZOS'),
        h('div', { key: 'g', className: 'gp-grid3' }, [
          h(React.Fragment, { key: 'tl' }, txtInput('salesTaxLabel', 'Nombre del impuesto de venta', { placeholder: 'IVA · VAT · IGV' })),
          h(React.Fragment, { key: 'tp' }, numInput('salesTaxPct', 'Impuesto de venta %')),
          h(React.Fragment, { key: 'md' }, numInput('marginDefaultPct', 'Margen por defecto % (tipos sin margen propio)')),
          h(React.Fragment, { key: 'mb' }, numInput('marginBasePct', 'Margen de costos adicionales % (solo extras manuales del producto)')),
          h(Row, { key: 'rm', label: 'Redondeo del precio final' },
            h('select', { className: 'gp-select', value: r.roundMode || 'none', onChange: (e) => upR({ roundMode: e.target.value }) }, [
              h('option', { key: '0', value: 'none' }, 'Sin redondeo'),
              h('option', { key: '1', value: 'nearest' }, 'Al múltiplo más cercano'),
              h('option', { key: '2', value: 'up' }, 'Hacia arriba al múltiplo'),
              h('option', { key: '3', value: 'ending' }, 'Terminación fija (ej. 990)'),
            ])),
          (r.roundMode === 'nearest' || r.roundMode === 'up' || r.roundMode === 'ending')
            ? h(React.Fragment, { key: 'rt' }, numInput('roundTo', 'Múltiplo de redondeo'))
            : null,
          r.roundMode === 'ending'
            ? h(React.Fragment, { key: 're' }, numInput('roundEnding', 'Terminación (ej. 990)'))
            : null,
          h(React.Fragment, { key: 'dr' }, numInput('deltaRoundTo', 'Redondeo de recargos (paso)')),
          h(React.Fragment, { key: 'ad' }, numInput('leadTimeDays', 'Días propios de preparación/producción')),
          h(React.Fragment, { key: 'sd' }, numInput('staleDays', 'Alerta: días sin verificar proveedor')),
        ]),
      ]),
      h('div', { key: 'types', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'TIPOS'), 'Tipos de componente y margen % por tipo']),
        h('div', { key: 'th', className: 'gp-muted', style: { marginBottom: 8 } },
          'Un componente es cualquier cosa que entra al costo: un material, una pieza, un insumo, mano de obra o un proceso externalizado. Cada componente usa el margen de su tipo (vacío = margen por defecto). El "margen de costos adicionales" de arriba es solo para los extras manuales del producto.'),
        // Presets por rubro: punto de partida, siempre editable después.
        h('div', { key: 'preset', className: 'gp-compline' }, [
          h('span', { key: 'l', className: 'gp-label' }, 'Cargar preset de rubro'),
          h('select', { key: 's', className: 'gp-select', style: { width: 'auto' }, value: '',
            onChange: (e) => {
              const p = presetById(e.target.value);
              if (!e.target.value) return;
              const usedIds = state.components.map((c) => c.type);
              // Nunca se pierden tipos en uso: se conservan y se suman los del preset.
              const keep = (draft.types || []).filter((t) => usedIds.indexOf(t.id) !== -1);
              const merged = keep.concat(p.types.filter((t) => !keep.some((k) => k.id === t.id)));
              setDraft(Object.assign({}, draft, { types: merged })); setDirty(true);
            } },
            [h('option', { key: '', value: '' }, 'Elegir rubro…')].concat(
              TYPE_PRESETS.map((p) => h('option', { key: p.id, value: p.id }, p.label)))),
          h('span', { key: 'sp', className: 'grow' }),
          h('span', { key: 'n', className: 'gp-muted' }, 'Los tipos en uso se conservan.'),
        ]),
        h('div', { key: 'list' }, (draft.types || []).map((t) => {
          const used = state.components.some((c) => c.type === t.id);
          return h('div', { key: t.id, className: 'gp-compline' }, [
            h('span', { key: 'id', className: 'gp-chip neg' }, t.id),
            h(TextInput, { key: 'l', value: t.label, style: { width: 200 }, onChange: (e) => { setDraft(Object.assign({}, draft, { types: draft.types.map((x) => (x.id === t.id ? Object.assign({}, x, { label: e.target.value }) : x)) })); setDirty(true); } }),
            h('span', { key: 'sp', className: 'grow' }),
            h('span', { key: 'ml', className: 'gp-label' }, 'margen %'),
            h(TextInput, { key: 'm', mono: true, type: 'number', style: { width: 90 },
              placeholder: s(num(r.marginDefaultPct, 25)),
              value: (r.marginByType || {})[t.id] == null ? '' : r.marginByType[t.id],
              onChange: (e) => {
                const mbt = Object.assign({}, r.marginByType || {});
                if (e.target.value === '') delete mbt[t.id]; else mbt[t.id] = num(e.target.value);
                upR({ marginByType: mbt });
              } }),
            h('button', { key: 'x', className: 'gp-btn gp-btn-sm gp-btn-danger', disabled: used, title: used ? 'Hay componentes de este tipo' : 'Quitar tipo', onClick: () => { setDraft(Object.assign({}, draft, { types: draft.types.filter((x) => x.id !== t.id) })); setDirty(true); } }, '✕'),
          ]);
        })),
        h('button', { key: 'add', className: 'gp-btn gp-btn-sm', style: { marginTop: 8 }, onClick: () => {
          const label = window.prompt('Nombre del nuevo tipo (ej: Herrajes, Estampado, Empaque):');
          if (!label || !label.trim()) return;
          const id = norm(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || newId('t');
          if ((draft.types || []).some((x) => x.id === id)) { shell.notify({ level: 'warn', text: 'Ya existe un tipo con ese id.' }); return; }
          setDraft(Object.assign({}, draft, { types: (draft.types || []).concat([{ id, label: label.trim() }]) }));
          setDirty(true);
        } }, '+ Tipo'),
      ]),
      h('div', { key: 'save', className: 'gp-actions' }, [
        dirty && h('span', { key: 'd', className: 'gp-muted', style: { alignSelf: 'center' } }, 'Cambios sin guardar'),
        h('button', { key: 'b', className: 'gp-btn gp-btn-primary', disabled: !dirty || busy, onClick: async () => {
          setBusy(true);
          const next = Object.assign({}, state.def || defaultDefinition(), { rules: draft.rules, types: draft.types });
          const res = await saveDefinition(next);
          setBusy(false);
          if (res.success) { setDirty(false); shell.notify({ level: 'success', text: 'Reglas guardadas. Revisa el recálculo de productos más abajo.' }); }
        } }, 'Guardar reglas'),
      ]),
      // Recalculo
      h('div', { key: 'recalc', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'RECÁLCULO'), 'Impacto en productos']),
        pend.length === 0
          ? h('div', { key: 'ok', className: 'gp-muted' }, 'Todos los productos están al día con los costos y reglas actuales.')
          : h(React.Fragment, { key: 'p' }, [
              h('table', { key: 'tbl', className: 'gp-table' }, [
                h('thead', { key: 'h' }, h('tr', null, ['Producto', 'Precio actual', 'Precio nuevo', 'Δ'].map((c, i) => h('th', { key: i }, c)))),
                h('tbody', { key: 'b' }, pend.map((x) => h('tr', { key: x.eq.id }, [
                  h('td', { key: 'n', style: { fontWeight: 600 } }, x.eq.name),
                  h('td', { key: 'o', className: 'gp-price' }, fmtMoney(x.oldPrice)),
                  h('td', { key: 'p', className: 'gp-price' }, fmtMoney(x.nextPrice)),
                  h('td', { key: 'd', className: 'gp-delta' + (x.nextPrice < x.oldPrice ? ' neg' : '') }, fmtDelta(x.nextPrice - x.oldPrice)),
                ]))),
              ]),
              h('div', { key: 'a', className: 'gp-actions' },
                h('button', { className: 'gp-btn gp-btn-primary', disabled: applying || dirty, title: dirty ? 'Guarda las reglas primero' : '', onClick: async () => {
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
  /**
   * Pestaña ESTILOS — el aspecto de la tienda vive AQUÍ, a nivel de catálogo:
   * plantillas completas (colores, barra, galería, anchos) que luego los
   * productos solo aplican. Una de ellas puede regir en todo el catálogo.
   */
  function EstilosTab({ state }) {
    const tpls = styleTemplates();
    const defId = s((state.def || {}).styleDefaultId);
    const [selId, setSelId] = useState(tpls[0] ? tpls[0].id : '');
    const [draft, setDraft] = useState(null);   // {id, name, style} en edición
    const [nuevo, setNuevo] = useState('');
    const [del, setDel] = useState('');
    const [busy, setBusy] = useState(false);
    const sel = tpls.find((t) => t.id === selId) || tpls[0] || null;
    // El borrador solo vale para la plantilla que se está editando: al cambiar
    // de plantilla se vuelve a partir de lo guardado (sin efectos ni sorpresas).
    const cur = draft && sel && draft.id === sel.id ? draft : sel;
    const dirty = !!(draft && sel && draft.id === sel.id && JSON.stringify(draft) !== JSON.stringify(sel));
    const usos = (id) => state.productos.filter((eq) => s((eq.storefront || {}).styleId).trim() === id).length;
    const sinPlantilla = state.productos.filter((eq) => {
      const k = s((eq.storefront || {}).styleId).trim();
      return k === 'own' || (k && !styleTemplateById(k));
    }).length;

    const guardarDef = async (lista, nuevoDef) => {
      setBusy(true);
      const base = state.def || defaultDefinition();
      const next = Object.assign({}, base, { styleTemplates: lista });
      if (nuevoDef !== undefined) next.styleDefaultId = nuevoDef;
      const r = await saveDefinition(next);
      setBusy(false);
      if (!r.success) shell.notify({ level: 'error', text: r.error });
      else scheduleRepublish();
      return r.success;
    };

    // Previsualizador: se pinta un producto real con ESTE estilo puesto, para
    // ver el resultado sin ir a la tienda.
    const demo = state.productos.find((eq) => (eq.groups || []).length) || state.productos[0] || null;

    return h('div', null, [
      h('div', { key: 'intro', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'ESTILOS'), 'Cómo se ve la ficha en la tienda']),
        h('div', { key: 'h', className: 'gp-muted' },
          'Aquí se define el aspecto una sola vez —colores, barra superior, galería y anchos— y los productos solo eligen qué plantilla aplicar (pestaña Ficha de tienda de cada producto). Cambiar una plantilla cambia de golpe todos los productos que la usan. La marcada como "del catálogo" rige en los que no eligen nada.'),
        h('div', { key: 'r', className: 'gp-compline', style: { borderBottom: 0, marginTop: 8 } }, [
          h(TextInput, { key: 'n', value: nuevo, placeholder: 'nombre de la plantilla nueva', style: { width: 240 }, onChange: (ev) => setNuevo(ev.target.value) }),
          h('button', { key: 'add', className: 'gp-btn gp-btn-primary gp-btn-sm', disabled: busy || !s(nuevo).trim(),
            onClick: async () => {
              const t = { id: newId('sty'), name: s(nuevo).trim(), style: normalizeStyle(null) };
              if (await guardarDef(tpls.concat([t]), tpls.length ? undefined : t.id)) { setSelId(t.id); setDraft(null); setNuevo(''); }
            } }, '+ Nueva plantilla'),
          demo ? null : h('span', { key: 'w', className: 'gp-muted' }, 'Aún no hay productos: el previsualizador aparece cuando crees el primero.'),
        ]),
      ]),
      !tpls.length
        ? h('div', { key: 'empty', className: 'gp-empty' },
            'Todavía no hay plantillas. Crea una arriba: es la forma de tener el mismo diseño en todos los productos sin repetir la configuración uno por uno.')
        : h('div', { key: 'ed', className: 'gp-card' }, [
            h('div', { key: 'sel', className: 'gp-compline' }, [
              h('span', { key: 'l', className: 'gp-label' }, 'plantilla'),
              h('select', { key: 's', className: 'gp-select', style: { minWidth: 260 }, value: sel ? sel.id : '',
                onChange: (ev) => { setSelId(ev.target.value); setDraft(null); setDel(''); } },
                tpls.map((t) => h('option', { key: t.id, value: t.id },
                  t.name + (t.id === defId ? ' — del catálogo' : '') + ' · ' + usos(t.id) + ' producto(s)'))),
              h(TextInput, { key: 'nm', value: cur ? cur.name : '', style: { width: 200 }, placeholder: 'nombre',
                onChange: (ev) => setDraft(Object.assign({}, cur, { name: ev.target.value })) }),
              h('span', { key: 'sp', style: { flex: 1 } }),
              h('button', { key: 'def', className: 'gp-btn gp-btn-sm', disabled: busy || !sel || sel.id === defId,
                title: 'La usarán todos los productos que no elijan otra cosa.',
                onClick: () => guardarDef(tpls, sel.id) }, sel && sel.id === defId ? '✓ Rige en el catálogo' : 'Usar en todo el catálogo'),
              h('button', { key: 'apply', className: 'gp-btn gp-btn-sm', disabled: busy || !sel,
                title: 'Engancha TODOS los productos a esta plantilla, uno por uno.',
                onClick: async () => {
                  setBusy(true);
                  for (const eq of state.productos) {
                    await saveProducto(Object.assign({}, eq, { storefront: Object.assign({}, eq.storefront || {}, { styleId: sel.id }) }));
                  }
                  setBusy(false);
                  shell.notify({ level: 'success', text: state.productos.length + ' producto(s) usan ahora «' + sel.name + '».' });
                } }, 'Aplicar a todos los productos'),
              h('button', { key: 'del', className: 'gp-btn gp-btn-sm gp-btn-danger', disabled: busy || !sel,
                onClick: async () => {
                  if (del !== sel.id) { setDel(sel.id); return; }
                  await guardarDef(tpls.filter((t) => t.id !== sel.id), sel.id === defId ? '' : undefined);
                  setDel(''); setDraft(null); setSelId('');
                } }, del === (sel && sel.id) ? '✕ Confirmar borrado' : '✕ Borrar'),
            ]),
            h('div', { key: 'u', className: 'gp-muted', style: { marginBottom: 8 } },
              sel ? ('La usan ' + usos(sel.id) + ' producto(s) de forma explícita'
                + (sel.id === defId ? ', y rige por defecto en los ' + (state.productos.length - sinPlantilla - usos(sel.id)) + ' que no eligen nada' : '')
                + '. Borrarla devuelve esos productos a su estilo propio.') : ''),
            cur && h(StyleEditor, { key: 'form-' + cur.id, st: cur.style,
              onChange: (patch) => setDraft(Object.assign({}, cur, { style: Object.assign({}, cur.style, patch) })) }),
            h('div', { key: 'save', className: 'gp-compline', style: { borderBottom: 0, marginTop: 10 } }, [
              h('button', { key: 'g', className: 'gp-btn gp-btn-primary', disabled: busy || !dirty,
                onClick: async () => {
                  const item = { id: cur.id, name: s(cur.name).trim() || 'Plantilla', style: normalizeStyle(cur.style) };
                  if (await guardarDef(tpls.map((t) => (t.id === item.id ? item : t)))) setDraft(null);
                } }, dirty ? 'Guardar cambios' : 'Guardado'),
              dirty && h('button', { key: 'c', className: 'gp-btn gp-btn-sm', onClick: () => setDraft(null) }, 'Descartar'),
              h('span', { key: 'm', className: 'gp-muted' }, 'Al guardar se republica el JSON de la tienda solo.'),
            ]),
            demo && cur && h('div', { key: 'pv', style: { marginTop: 12 } }, [
              h('div', { key: 'l', className: 'gp-label', style: { marginBottom: 6 } }, 'PREVISUALIZACIÓN · ' + demo.name),
              h(ConfigPreview, { key: 'p-' + cur.id,
                draft: Object.assign({}, demo, { storefront: Object.assign({}, demo.storefront || {}, { style: cur.style, styleId: 'own' }) }) }),
            ]),
          ]),
    ]);
  }

  function PublicacionTab({ state }) {
    const [busy, setBusy] = useState(false);
    const [showJson, setShowJson] = useState(false);
    const pub = (state.def && state.def.public) || {};
    const enabled = pub.enabled === true;
    const stamp = pub.data && pub.data.updatedAt;
    return h('div', null, [
      h('div', { key: 'st', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'CONFIGURADOR'), 'Publicación para el theme de la tienda']),
        h('div', { key: 'd', className: 'gp-muted', style: { marginBottom: 10 } },
          'El theme (configurador.js) lee este JSON público para pintar los pasos, imágenes, recargos, compatibilidades y fechas de entrega de cada producto. Una vez publicado, se REPUBLICA SOLO cada vez que guardas componentes, productos o aplicas recálculos (la tienda lo ve en ~5 min por el caché del CDN).'),
        h('div', { key: 'line', className: 'gp-compline' }, [
          enabled ? h('span', { key: 'c', className: 'gp-chip ok' }, 'publicado') : h('span', { key: 'c', className: 'gp-chip gris' }, 'despublicado'),
          stamp && h('span', { key: 's', className: 'gp-muted' }, 'última publicación: ' + fmtDateTime(stamp)),
          h('span', { key: 'sp', className: 'grow' }),
          h('button', { key: 'pub', className: 'gp-btn gp-btn-primary', disabled: busy, onClick: async () => {
            setBusy(true);
            const r = await publish(true);
            setBusy(false);
            if (r.success) shell.notify({ level: 'success', text: 'Configurador publicado (' + buildPublicData().productos.length + ' productos).' });
          } }, enabled ? 'Republicar ahora' : 'Publicar'),
          enabled && h('button', { key: 'unpub', className: 'gp-btn', disabled: busy, onClick: async () => {
            setBusy(true); await publish(false); setBusy(false);
            shell.notify({ level: 'info', text: 'Configurador despublicado: el gateway responderá 403.' });
          } }, 'Despublicar'),
        ]),
        // Identidad de la empresa: marca visible en la app y nombre corto que
        // viaja en el JSON público (el theme puede usarlo para distinguir tiendas).
        h('div', { key: 'ident', className: 'gp-grid2' }, [
          h(Row, { key: 'bn', label: 'Marca (se muestra en la barra superior de la app)' },
            h(TextInput, { key: 'bn-' + s((state.def || {}).brandName),
              defaultValue: s((state.def || {}).brandName), placeholder: 'Ej: Textiles del Sur',
              onBlur: async (e) => {
                const v = e.target.value.trim();
                if (v === s((state.def || {}).brandName)) return;
                const r = await saveDefinition(Object.assign({}, state.def || defaultDefinition(), { brandName: v }));
                if (r.success) shell.notify({ level: 'success', text: 'Marca guardada.' });
              } })),
          h(Row, { key: 'sn', label: 'Nombre corto de la tienda (viaja en el JSON público)' },
            h(TextInput, { key: 'sn-' + s((state.def || {}).storeName), mono: true,
              defaultValue: s((state.def || {}).storeName), placeholder: 'Ej: textiles-sur',
              onBlur: async (e) => {
                const v = e.target.value.trim();
                if (v === s((state.def || {}).storeName)) return;
                const r = await saveDefinition(Object.assign({}, state.def || defaultDefinition(), { storeName: v }));
                if (r.success) shell.notify({ level: 'success', text: 'Nombre de la tienda guardado.' });
              } })),
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
          h('div', { className: 'gp-verify-cost' }, [
            h(TextInput, { key: 'i', mono: true, readOnly: true, value: publicUrl, onFocus: (e) => e.target.select() }),
            h('button', { key: 'c', className: 'gp-btn gp-btn-sm', onClick: () => copy(publicUrl) }, 'Copiar'),
          ])),
        h('label', { key: 'tgl', className: 'gp-switch' }, [
          h('input', { key: 'c', type: 'checkbox', checked: showJson, onChange: (e) => setShowJson(e.target.checked) }),
          h('span', { key: 's' }, 'Ver JSON que se publicaría ahora'),
        ]),
        showJson && h('pre', { key: 'json', className: 'gp-code' }, JSON.stringify(buildPublicData(), null, 2)),
      ]),
      h('div', { key: 'plan', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'JUMPSELLER'), 'Opciones y variantes por producto']),
        h('div', { key: 'd', className: 'gp-muted', style: { marginBottom: 10 } },
          'Las opciones (un paso = una opción) y las variantes con precio por combinación se escriben automáticamente al usar "Aplicar a la tienda" (van al item de la app Productos y su sync-push las empuja a Jumpseller). Aquí puedes inspeccionar el payload exacto que se generaría ahora.'),
        state.productos.length === 0
          ? h('div', { key: 'e', className: 'gp-muted' }, 'Sin productos.')
          : state.productos.map((eq) => h('div', { key: eq.id, className: 'gp-compline' }, [
              h('span', { key: 'n', style: { fontWeight: 600 } }, eq.name),
              h('span', { key: 'sku', className: 'gp-mono gp-muted', style: { fontSize: 10 } }, eq.sku || ''),
              h('span', { key: 'cnt', className: 'gp-chip gris' }, comboCount(eq) + ' variantes'),
              h('span', { key: 'st' }, h(SyncBadge, { eq })),
              h('span', { key: 'sp', className: 'grow' }),
              h('button', { key: 'c', className: 'gp-btn gp-btn-sm', onClick: () => copy(JSON.stringify(storePlan(eq), null, 2)) }, 'Copiar payload JSON'),
            ])),
      ]),
    ]);
  }


  // ── Pestaña: Datos (migrar, exportar, importar) ───────────────────────────
  function DatosTab({ state }) {
    const [insts, setInsts] = useState(null);      // null = sin cargar
    const [instErr, setInstErr] = useState('');
    const [sel, setSel] = useState('');
    const [busy, setBusy] = useState('');
    const [prev, setPrev] = useState(null);        // análisis previo (dry-run)
    const [opts, setOpts] = useState({ rules: true, productos: true, keepStoreLinks: true, mode: 'merge' });
    const [log, setLog] = useState('');
    const [fileInfo, setFileInfo] = useState(null); // {name, pack} listo para importar
    const upOpts = (patch) => setOpts(Object.assign({}, opts, patch));
    const stamp = () => new Date().toISOString().slice(0, 10);

    const cargarInstancias = async () => {
      setBusy('list'); setInstErr('');
      const r = await listOtherInstances();
      setBusy('');
      if (r.error) { setInstErr(r.error); setInsts([]); return; }
      setInsts(r.instances || []);
    };
    const analizar = async () => {
      if (!sel) return;
      setBusy('scan'); setPrev(null); setLog('');
      const r = await migrateFromInstance(sel, { dryRun: true });
      setBusy('');
      if (!r.success) { setLog('✕ ' + r.error); return; }
      setPrev(r.conteo);
    };
    const migrar = async () => {
      if (!sel) return;
      if (!window.confirm('Se traerán los datos de la instancia seleccionada a ESTE catálogo (los ids se conservan; lo que ya exista con el mismo id o nombre se actualiza). ¿Continuar?')) return;
      setBusy('mig'); setLog('');
      const r = await migrateFromInstance(sel, opts);
      setBusy('');
      if (r.error) { setLog('✕ ' + r.error); return; }
      setLog((r.success ? '✔ ' : '⚠ ') + importSummary(r.res));
      shell.notify({ level: r.success ? 'success' : 'warn', text: 'Migración: ' + importSummary(r.res) });
    };
    const leerArchivo = async (f) => {
      if (!f) return;
      setLog(''); setFileInfo(null);
      try {
        const text = await f.text();
        if (/\.csv$/i.test(f.name) || (!/^\s*[[{]/.test(text) && text.indexOf(',') !== -1)) {
          const tiposCsv = [];
          const r = componentsFromCsv(text, tiposCsv);
          if (r.error) { setLog('✕ ' + r.error); return; }
          const pk = { format: DATA_FORMAT, components: r.components };
          if (tiposCsv.length) pk.definition = { types: tiposCsv };
          setFileInfo({ name: f.name, pack: pk, tipo: 'CSV de componentes'
            + (tiposCsv.length ? ' (+' + tiposCsv.length + ' tipo(s) nuevo(s))' : ''), n: r.components.length });
          return;
        }
        const pack = JSON.parse(text);
        const nc = (pack.components || []).length;
        const np = (pack.productos || pack.equipos || []).length;
        setFileInfo({ name: f.name, pack, tipo: 'JSON' + (pack.format === DATA_FORMAT ? ' de ProductLab' : ' (formato externo: se traducirá)'), n: nc + np });
      } catch (e) { setLog('✕ No se pudo leer el archivo: ' + ((e && e.message) || 'error')); }
    };
    const importar = async () => {
      if (!fileInfo) return;
      setBusy('imp'); setLog('');
      const res = await importData(fileInfo.pack, opts);
      setBusy('');
      setLog((res.errors.length ? '⚠ ' : '✔ ') + importSummary(res));
      shell.notify({ level: res.errors.length ? 'warn' : 'success', text: 'Importación: ' + importSummary(res) });
      setFileInfo(null);
    };

    return h('div', null, [
      // ── Migrar desde otra app instalada ──
      h('div', { key: 'mig', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'MIGRAR'), 'Traer datos desde otra app (Computadores u otro catálogo)']),
        h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 8 } },
          'Lee la instancia elegida con TUS permisos y copia su catálogo aquí: componentes, productos (con sus pasos y ficha), reglas de precio y tipos. Los identificadores se conservan, así que los pasos siguen apuntando a sus componentes sin re-enlazar nada. Es seguro repetirlo: lo que ya existe se actualiza en vez de duplicarse.'),
        h('div', { key: 'l', className: 'gp-compline', style: { borderBottom: 0 } }, [
          insts == null
            ? h('button', { key: 'ld', className: 'gp-btn gp-btn-dark', disabled: busy === 'list', onClick: cargarInstancias }, busy === 'list' ? 'Buscando…' : 'Buscar catálogos disponibles')
            : h('select', { key: 'sel', className: 'gp-select', style: { maxWidth: 460 }, value: sel, onChange: (e) => { setSel(e.target.value); setPrev(null); setLog(''); } },
                [h('option', { key: '', value: '' }, insts.length ? 'Elige la instancia de origen…' : 'No hay otras instancias visibles')].concat(
                  insts.map((i) => h('option', { key: i.id, value: i.id }, (i.name || i.id) + ' — ' + (i.templateId || '?'))))),
          insts != null ? h('button', { key: 'rl', className: 'gp-btn gp-btn-sm', title: 'Volver a buscar', onClick: cargarInstancias }, '⟳') : null,
          sel ? h('button', { key: 'an', className: 'gp-btn gp-btn-sm', disabled: busy === 'scan', onClick: analizar }, busy === 'scan' ? 'Analizando…' : 'Analizar origen') : null,
        ]),
        instErr ? h('div', { key: 'e', className: 'gp-errbox' }, instErr) : null,
        prev ? h('div', { key: 'p', className: 'gp-warnbox', style: { background: 'var(--gp-plata)', border: '1px solid var(--gp-gris-claro)', color: 'var(--gp-negro)' } },
          'Ese catálogo tiene ' + prev.components + ' componente(s) y ' + prev.productos + ' producto(s)' + (prev.rules ? ', más sus reglas de precio y tipos' : '') + '.') : null,
        h('div', { key: 'o', style: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 } }, [
          h('label', { key: 'r', className: 'gp-switch', style: { margin: 0 } }, [
            h('input', { key: 'c', type: 'checkbox', checked: opts.rules !== false, onChange: (e) => upOpts({ rules: e.target.checked }) }),
            h('span', { key: 's' }, 'Traer reglas de precio y tipos de componente'),
          ]),
          h('label', { key: 'p', className: 'gp-switch', style: { margin: 0 } }, [
            h('input', { key: 'c', type: 'checkbox', checked: opts.productos !== false, onChange: (e) => upOpts({ productos: e.target.checked }) }),
            h('span', { key: 's' }, 'Traer productos (pasos y ficha)'),
          ]),
          h('label', { key: 'k', className: 'gp-switch', style: { margin: 0 }, title: 'Mantiene el enlace de cada producto con su producto de la tienda. Desactívalo si migras a OTRO proyecto (allí esos enlaces no existen).' }, [
            h('input', { key: 'c', type: 'checkbox', checked: opts.keepStoreLinks !== false, onChange: (e) => upOpts({ keepStoreLinks: e.target.checked }) }),
            h('span', { key: 's' }, 'Mantener enlaces con la tienda'),
          ]),
          h('label', { key: 'm', className: 'gp-switch', style: { margin: 0 }, title: 'Con "no tocar lo existente" solo se crean los que faltan.' }, [
            h('input', { key: 'c', type: 'checkbox', checked: opts.mode === 'skip', onChange: (e) => upOpts({ mode: e.target.checked ? 'skip' : 'merge' }) }),
            h('span', { key: 's' }, 'No tocar lo que ya existe aquí'),
          ]),
        ]),
        h('div', { key: 'a', className: 'gp-actions' }, [
          h('button', { key: 'go', className: 'gp-btn gp-btn-primary', disabled: !sel || busy === 'mig', onClick: migrar }, busy === 'mig' ? 'Migrando…' : 'Migrar a este catálogo'),
        ]),
      ]),
      // ── Exportar ──
      h('div', { key: 'exp', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'EXPORTAR'), 'Respaldo y traslado']),
        h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 8 } },
          'El CSV de componentes se edita en cualquier planilla (Excel, Sheets) y vuelve por "Importar" sin perder nada: es la vía rápida para cargar o corregir muchos costos de una vez. El JSON completo sirve de respaldo y para trasladar el catálogo a otro proyecto.'),
        h('div', { key: 'b', className: 'gp-compline', style: { borderBottom: 0, flexWrap: 'wrap' } }, [
          h('button', { key: 'csv', className: 'gp-btn gp-btn-dark', disabled: !state.components.length,
            onClick: () => downloadText('componentes-' + stamp() + '.csv', componentsCsv(), 'text/csv') },
            'Componentes (CSV) · ' + state.components.length),
          h('button', { key: 'jc', className: 'gp-btn', disabled: !state.components.length,
            onClick: () => downloadText('componentes-' + stamp() + '.json', JSON.stringify(exportData({ productos: false }), null, 2), 'application/json') },
            'Componentes + reglas (JSON)'),
          h('button', { key: 'all', className: 'gp-btn',
            onClick: () => downloadText('productlab-' + stamp() + '.json', JSON.stringify(exportData({ productos: true, keepStoreLinks: true }), null, 2), 'application/json') },
            'Todo el catálogo (JSON)'),
          h('button', { key: 'port', className: 'gp-btn', title: 'Sin enlaces a la tienda: para llevarlo a otro proyecto o tenant',
            onClick: () => downloadText('productlab-portable-' + stamp() + '.json', JSON.stringify(exportData({ productos: true, keepStoreLinks: false }), null, 2), 'application/json') },
            'Todo, portable (sin enlaces)'),
        ]),
      ]),
      // ── Importar ──
      h('div', { key: 'imp', className: 'gp-card' }, [
        h('div', { key: 't', className: 'gp-card-title' }, [h('span', { key: 'n', className: 'gp-num' }, 'IMPORTAR'), 'Desde archivo (CSV o JSON)']),
        h('div', { key: 'h', className: 'gp-muted', style: { marginBottom: 8 } },
          'Acepta el CSV de componentes (con la columna "nombre"; si trae "id" se actualizan los existentes) y el JSON exportado aquí o por otra app de la familia. Los tipos de componente que no existan se crean solos.'),
        h('div', { key: 'b', className: 'gp-compline', style: { borderBottom: 0 } }, [
          h('label', { key: 'f', className: 'gp-btn gp-btn-dark', style: { cursor: 'pointer' } }, [
            h('span', { key: 's' }, 'Elegir archivo…'),
            h('input', { key: 'i', type: 'file', accept: '.json,.csv,application/json,text/csv', style: { display: 'none' },
              onChange: (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; void leerArchivo(f); } }),
          ]),
          fileInfo ? h('span', { key: 'n', className: 'gp-muted' }, fileInfo.name + ' — ' + fileInfo.tipo + ' · ' + fileInfo.n + ' registro(s)') : null,
          fileInfo ? h('button', { key: 'go', className: 'gp-btn gp-btn-primary', disabled: busy === 'imp', onClick: importar }, busy === 'imp' ? 'Importando…' : 'Importar ahora') : null,
          fileInfo ? h('button', { key: 'x', className: 'gp-btn gp-btn-sm', onClick: () => setFileInfo(null) }, 'Cancelar') : null,
        ]),
      ]),
      log ? h('div', { key: 'log', className: log.indexOf('✕') === 0 ? 'gp-errbox' : 'gp-warnbox' }, log) : null,
    ]);
  }

  // ── Raíz ──────────────────────────────────────────────────────────────────
  function Component() {
    const [state, setState] = useState(model);
    // Preferencias del host (⚙️ Configurar): color de acento por empresa.
    const [cfg, setCfg] = useState({});
    useEffect(() => {
      listeners.add(setState);
      void load();
      void loadCatalog();
      let offCfg = null;
      if (shell.config && typeof shell.config.get === 'function') {
        Promise.resolve(shell.config.get()).then((c) => setCfg(c || {})).catch(() => {});
        if (typeof shell.config.onChange === 'function') {
          try { offCfg = shell.config.onChange((c) => setCfg(c || {})); } catch (e) { /* opcional */ }
        }
      }
      const t = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void load();
      }, 45000);
      return () => {
        listeners.delete(setState); clearInterval(t);
        if (typeof offCfg === 'function') offCfg();
      };
    }, []);
    // El acento configurado gana sobre el default del CSS.
    const rootStyle = cfg && cfg.accent ? { '--gp-acento': s(cfg.accent) } : undefined;
    if (!instanceId) {
      return h('div', { className: 'kimos-productlab', style: rootStyle },
        h('div', { className: 'gp-empty' }, 'Crea un documento desde la pantalla de bienvenida: cada instancia es un catálogo de productos independiente, con sus propias reglas de margen, moneda e impuesto (normalmente basta una por tienda o línea de negocio).'));
    }
    const n = useNav();
    const cfgTab = n.sec === 'config' ? n.tab : null;
    return h('div', { className: 'kimos-productlab' + (cfg && cfg.denseTables ? ' gp-dense' : ''), style: rootStyle }, [
      h(Header, { key: 'hd', state }),
      h('div', { key: 'body', className: 'gp-body' }, [
        state.error && h('div', { key: 'err', className: 'gp-errbox' }, state.error),
        !state.loaded
          ? h('div', { key: 'l', className: 'gp-empty' }, 'Cargando…')
          : n.sec === 'componentes' ? h(ComponentesTab, { key: 'c', state })
          : n.sec === 'productos' ? h(ProductosTab, { key: 'e', state })
          : !cfgTab ? h(ConfigMosaico, { key: 'cm' })
          : cfgTab === 'precios' ? h(PreciosTab, { key: 'pr', state })
          : cfgTab === 'estilos' ? h(EstilosTab, { key: 'sty', state })
          : cfgTab === 'datos' ? h(DatosTab, { key: 'dat', state })
          : h(PublicacionTab, { key: 'pub', state }),
      ]),
    ]);
  }

  // ── Header único: breadcrumb + tabs grandes + acciones rápidas ────────────
  // Estética de menú de videojuego: textos grandes, objetivos táctiles y los
  // tokens del tema de KIMOS (día/noche y acento van con el shell).
  const CFG_TABS = [['precios', 'Precios'], ['estilos', 'Estilos'], ['publicacion', 'Publicación'], ['datos', 'Datos']];
  const PROD_TABS = [['general', 'General'], ['galeria', 'Galería'], ['pasos', 'Estudio'], ['ficha', 'Experiencia']];
  const COMP_TABS = [['general', 'General'], ['alternativos', 'Alternativos'], ['compatibles', 'Compatibles']];
  const ICONO_CASA = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    [h('path', { key: 'p', d: 'M3 10.5 12 3l9 7.5' }), h('path', { key: 'q', d: 'M5 9.5V21h14V9.5' })]);
  const ICONO_ATRAS = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    [h('path', { key: 'p', d: 'M15 5l-7 7 7 7' })]);
  function Header({ state }) {
    const n = useNav();
    const extra = useHdrExtra();
    const [pubBusy, setPubBusy] = useState(false);
    const SECS = [
      ['productos', 'Productos' + (state.productos.length ? ' · ' + state.productos.length : '')],
      ['componentes', 'Componentes' + (state.components.length ? ' · ' + state.components.length : '')],
      ['config', 'Parámetros'],
    ];
    const secLabel = n.sec === 'config' ? 'Parámetros' : n.sec === 'componentes' ? 'Componentes' : 'Productos';
    // Tabs del contexto: raíz → secciones; detalle → sus pestañas; config → sus 4.
    let tabs, activo, onTab;
    if (n.det && n.det.tipo === 'producto') {
      tabs = PROD_TABS.concat((n.det.draft && n.det.draft.model3d) || n.tab === 'modelo3d' ? [['modelo3d', 'Visor 3D']] : []);
      activo = n.tab || 'general'; onTab = (id) => setNav({ tab: id });
    } else if (n.det && n.det.tipo === 'componente') {
      tabs = COMP_TABS; activo = n.tab || 'general'; onTab = (id) => setNav({ tab: id });
    } else if (n.sec === 'config' && n.tab) {
      tabs = CFG_TABS; activo = n.tab; onTab = (id) => setNav({ tab: id });
    } else {
      tabs = SECS; activo = n.sec; onTab = (id) => setNav({ sec: id, det: null, tab: null });
    }
    // Un nivel hacia arriba: detalle → lista; config sub → mosaico; raíz → inicio.
    const atras = n.det ? () => setNav({ det: null, tab: null })
      : (n.sec === 'config' && n.tab) ? () => setNav({ tab: null })
      : n.sec !== 'productos' ? () => setNav({ sec: 'productos', det: null, tab: null })
      : null;
    return h('div', { key: 'hd', className: 'gp-hd' }, [
      h('div', { key: 'nav', className: 'gp-hd-nav' }, [
        atras ? h('button', { key: 'atras', className: 'gp-hd-ico', title: 'Volver', onClick: atras }, h(ICONO_ATRAS)) : null,
        h('nav', { key: 'crumbs', className: 'gp-crumbs', 'aria-label': 'breadcrumb' }, [
          h('button', { key: 'casa', className: 'gp-crumb gp-hd-ico', title: 'Inicio',
            onClick: () => setNav({ sec: 'productos', det: null, tab: null }) }, h(ICONO_CASA)),
          h('span', { key: 's1', className: 'gp-crumb-sep' }, '›'),
          h('button', { key: 'sec', className: 'gp-crumb' + (n.det || (n.sec === 'config' && n.tab) ? '' : ' on'),
            onClick: () => setNav({ det: null, tab: null }) }, secLabel),
          n.det ? h('span', { key: 's2', className: 'gp-crumb-sep' }, '›') : null,
          n.det ? h('span', { key: 'det', className: 'gp-crumb on' }, n.det.nombre || (n.det.tipo === 'producto' ? 'Nuevo producto' : 'Nuevo componente')) : null,
        ]),
      ]),
      h('div', { key: 'tabs', className: 'gp-bigtabs', role: 'tablist' }, tabs.map(([id, label]) =>
        h('button', { key: id, role: 'tab', 'aria-selected': activo === id,
          className: 'gp-bigtab' + (activo === id ? ' on' : ''), onClick: () => onTab(id) }, label))),
      h('div', { key: 'acciones', className: 'gp-hd-acciones' }, [
        // Detalle abierto con acciones publicadas: precio vivo + Guardar/Aplicar.
        extra && n.det ? h('div', { key: 'extra', className: 'gp-hd-extra' }, [
          h('div', { key: 'precio', className: 'gp-hd-precio' }, [
            h('span', { key: 'p', className: 'gp-hd-precio-n' }, extra.precio),
            h('span', { key: 's', className: 'gp-hd-precio-s' }, extra.sub),
          ]),
          h('button', { key: 'g', className: 'gp-btn', disabled: !extra.puedeGuardar, onClick: extra.guardar }, extra.etiquetaGuardar),
          extra.conTienda ? h('button', { key: 'ap', className: 'gp-btn gp-btn-primary', disabled: !extra.puedeAplicar,
            onClick: extra.aplicar }, extra.busy ? 'Aplicando…' : 'Aplicar a la tienda') : null,
        ]) : null,
        !n.det ? h('button', { key: 'pub', className: 'gp-btn gp-btn-primary gp-hd-pub', disabled: pubBusy,
          title: 'Publicar el JSON del configurador para la tienda, sin pasar por Parámetros → Publicación',
          onClick: async () => {
            setPubBusy(true);
            const r = await publish(true);
            setPubBusy(false);
            if (r.success) shell.notify({ level: 'success', text: 'Publicado (' + buildPublicData().productos.length + ' productos).' });
          } }, pubBusy ? 'Publicando…' : 'Publicar') : null,
        h('button', { key: 'r', className: 'gp-hd-ico', title: 'Actualizar datos',
          onClick: () => { void load(); void loadCatalog(); } }, '⟳'),
      ]),
    ]);
  }

  // ── Parámetros: mosaico 2×2 que entra a cada sección ──────────────────────
  function ConfigMosaico() {
    const DESC = {
      precios: 'Margen, moneda, impuestos y reglas de redondeo del cálculo de precios.',
      estilos: 'Plantillas de estilo del configurador: colores, cards y barra de la tienda.',
      publicacion: 'El JSON público que lee el theme, la marca y el estado de publicación.',
      datos: 'Exportar e importar componentes y productos; migración entre instancias.',
    };
    return h('div', { className: 'gp-mosaico' }, CFG_TABS.map(([id, label]) =>
      h('button', { key: id, className: 'gp-tile', onClick: () => setNav({ tab: id }) }, [
        h('span', { key: 'l', className: 'gp-tile-title' }, label),
        h('span', { key: 'd', className: 'gp-tile-desc' }, DESC[id]),
      ])));
  }

  return {
    Component,
    // Solo para las pruebas: el harness no ejecuta los componentes anidados,
    // así que la decisión de recargar el editor se comprueba por aquí.
    __test: { decidirRecarga, agentEdit },
    unmount() {
      listeners.clear();
      if (republishTimer) clearTimeout(republishTimer);
      if (typeof offAgent === 'function') offAgent();
    },
  };
}
