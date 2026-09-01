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
const APP_VERSION = '2.0.0';

const DATA = /* DATOS_INLINE */ null;
const VIS = /* VISUAL_INLINE */ null;

// Los iconos son parte de la app, no del estudio: no cambian al analizar otra empresa.
const PATHS = VIS.paths;

/* ------------------------------------------------------------------ *
 * El estudio como documento
 *
 * Hasta la 1.2.0 el estudio de KIMOS ERA la app: los datos estaban clavados
 * en el bundle. Desde la 2.0.0 el estudio es un documento que vive en la
 * instancia: se puede editar, exportar, importar y empezar de cero con una
 * plantilla de otro rubro. El estudio de KIMOS es solo la semilla con la que
 * abre una ventana nueva, y el motor de cálculo es el mismo para cualquiera.
 * ------------------------------------------------------------------ */

const clon = (o) => JSON.parse(JSON.stringify(o));

function docSemilla() {
  const d = clon(DATA);
  d.meta = Object.assign({
    empresa: 'KIMOS',
    rubro: 'Suite de gestión empresarial para PyME (SaaS B2B)',
    autor: 'Estudio interno de KIMOS',
    plantilla: 'kimos',
    titulo: 'Estudio de Mercado y Modelo de Precios',
    unidadNegocio: 'aplicaciones',
  }, d.meta);
  d.visual = {
    scores: clon(VIS.scores), tldr: clon(VIS.tldr), sugerencias: clon(VIS.sugerencias),
    conclusiones: clon(VIS.conclusiones), notas: clon(VIS.notas),
  };
  return d;
}

/* ------------------------------------------------------------------ *
 * Plantillas por rubro
 *
 * Una plantilla NO trae precios: trae la estructura del rubro (qué líneas de
 * producto se comparan, contra qué categoría de competidor) y de dónde salen
 * los datos en ese sector. Los números los pone la investigación, porque un
 * estudio con cifras inventadas es peor que no tener estudio.
 * ------------------------------------------------------------------ */

const PLANTILLAS = [
  {
    id: 'saas', nombre: 'Software B2B / SaaS', icono: '⌘',
    rubro: 'Software de gestión por suscripción (B2B)',
    unidadNegocio: 'módulos', unidadPrecio: 'Por usuario',
    sup: { usuarios: 10, canales: 5, factor: 0.55, descAnual: 0.2 },
    lineas: [
      ['Gestión de clientes (CRM)', 'CRM y automatización comercial', 'HubSpot, Pipedrive, Zoho CRM', 'Registro de oportunidades, embudo y seguimiento comercial'],
      ['Proyectos y tareas', 'Gestión de trabajo', 'Asana, Monday, ClickUp, Trello', 'Tableros, plazos y carga de trabajo del equipo'],
      ['Facturación y cobranza', 'Facturación electrónica y cuentas por cobrar', 'Facturación local, QuickBooks, Xero', 'Emisión de documentos, cobranza y conciliación'],
      ['Soporte y mesa de ayuda', 'Atención al cliente', 'Zendesk, Freshdesk, Intercom', 'Tickets, base de conocimiento y acuerdos de servicio'],
      ['Automatización e IA', 'Agentes e integraciones', 'Zapier, Make, ChatGPT Business', 'Flujos entre sistemas y asistentes sobre datos propios'],
      ['Informes y tablero', 'Business intelligence', 'Power BI, Looker Studio, Metabase', 'Indicadores del negocio en un solo lugar'],
    ],
    fuentes: [
      'Página de precios del propio proveedor: es la única fuente que se marca "Verificado".',
      'Cuando el proveedor cotiza a puerta cerrada (todo lo "Enterprise"), usar contratos reportados por G2, Vendr, Capterra o TrustRadius y dividir el anual en doce; la fila queda "Estimado".',
      'Tamaño de mercado: informes de Gartner, IDC o consultoras de mercado; contrastar siempre dos fuentes, porque la horquilla entre definiciones es enorme.',
      'Benchmarks de churn, CAC y margen: informes anuales de SaaS Capital, ChartMogul, OpenView o Paddle.',
    ],
  },
  {
    id: 'retail', nombre: 'Comercio y e-commerce', icono: '🛒',
    rubro: 'Comercio minorista y venta en línea',
    unidadNegocio: 'líneas de producto', unidadPrecio: 'Plano',
    sup: { usuarios: 8, canales: 4, factor: 0.6, descAnual: 0.15 },
    lineas: [
      ['Línea de producto A', 'Categoría de mayor rotación', 'Competidores directos de la categoría', 'Producto o familia que más factura'],
      ['Línea de producto B', 'Categoría secundaria', 'Competidores directos de la categoría', 'Segunda familia en facturación'],
      ['Marca propia', 'Marca blanca frente a marcas líderes', 'Marcas nacionales e importadas', 'Producto propio con margen mayor'],
      ['Servicios asociados', 'Instalación, garantía extendida, despacho', 'Retailers grandes y especialistas', 'Lo que se cobra además del producto'],
      ['Canal en línea', 'E-commerce propio y marketplaces', 'Marketplaces y tiendas de la competencia', 'Precio de lista publicado en el canal digital'],
    ],
    fuentes: [
      'Precio publicado en la ficha del competidor (tienda física o en línea), con fecha y captura: en retail el precio cambia semana a semana.',
      'Marketplaces del país para el precio de referencia de la categoría y la dispersión entre vendedores.',
      'Organismos de estadística nacionales para el tamaño del mercado y el gasto por hogar de la categoría.',
      'Asociaciones gremiales del comercio para participación por canal y estacionalidad.',
    ],
  },
  {
    id: 'servicios', nombre: 'Servicios profesionales', icono: '⚖',
    rubro: 'Consultoría, estudios y agencias',
    unidadNegocio: 'servicios', unidadPrecio: 'Plano',
    sup: { usuarios: 6, canales: 3, factor: 0.7, descAnual: 0.1 },
    lineas: [
      ['Asesoría mensual (retainer)', 'Contrato recurrente', 'Estudios y consultoras del mismo tamaño', 'Servicio continuo facturado mes a mes'],
      ['Proyecto llave en mano', 'Proyecto cerrado', 'Consultoras medianas y grandes', 'Alcance definido, precio cerrado'],
      ['Hora profesional', 'Tarifa por hora', 'Tarifario del gremio y competidores', 'Valor hora por seniority'],
      ['Auditoría o diagnóstico', 'Servicio de entrada', 'Competidores y consultoras grandes', 'El servicio con el que entra un cliente nuevo'],
      ['Capacitación', 'Formación a empresas', 'Escuelas de negocio y capacitadores', 'Programas cerrados o abiertos'],
    ],
    fuentes: [
      'Tarifarios publicados por colegios profesionales y asociaciones gremiales: en servicios suelen ser la única referencia pública.',
      'Licitaciones y compras públicas del país: las adjudicaciones muestran precios reales de la competencia, con nombre y monto.',
      'Propuestas comerciales recibidas por clientes (con su permiso y anonimizadas), marcadas siempre como "Estimado".',
      'Encuestas salariales del sector para reconstruir el costo por hora y verificar que la tarifa deja margen.',
    ],
  },
  {
    id: 'salud', nombre: 'Salud y centros médicos', icono: '⚕',
    rubro: 'Prestadores de salud ambulatoria',
    unidadNegocio: 'prestaciones', unidadPrecio: 'Plano',
    sup: { usuarios: 12, canales: 3, factor: 0.75, descAnual: 0.1 },
    lineas: [
      ['Consulta general', 'Atención ambulatoria', 'Centros médicos de la zona', 'Consulta de medicina general'],
      ['Consulta de especialidad', 'Especialidades', 'Clínicas y centros especializados', 'Consulta con especialista'],
      ['Exámenes de laboratorio', 'Laboratorio clínico', 'Laboratorios de la zona', 'Panel de exámenes más pedido'],
      ['Imagenología', 'Diagnóstico por imagen', 'Centros de imágenes', 'Ecografía, radiografía y similares'],
      ['Procedimientos', 'Procedimientos ambulatorios', 'Clínicas ambulatorias', 'Procedimientos que no requieren pabellón'],
      ['Planes preventivos', 'Programas de salud', 'Aseguradoras y centros con planes', 'Paquetes de chequeo anual'],
    ],
    fuentes: [
      'Aranceles publicados por el prestador y por el asegurador o sistema público: en salud casi siempre son públicos y auditables.',
      'Comparadores oficiales de precios de prestaciones donde existan, con la fecha del arancel.',
      'Estadísticas del ministerio o autoridad sanitaria para volumen de prestaciones y cobertura del mercado.',
      'Nunca usar precios de convenio sin declararlo: el precio de lista y el precio con convenio son dos filas distintas.',
    ],
  },
  {
    id: 'educacion', nombre: 'Educación y formación', icono: '🎓',
    rubro: 'Formación técnica, profesional y continua',
    unidadNegocio: 'programas', unidadPrecio: 'Plano',
    sup: { usuarios: 20, canales: 2, factor: 0.65, descAnual: 0.15 },
    lineas: [
      ['Curso corto', 'Formación continua', 'Institutos y plataformas en línea', 'Programa de pocas semanas'],
      ['Diplomado', 'Posgrado corto', 'Universidades y centros de formación', 'Programa de varios meses'],
      ['Programa para empresas', 'Capacitación corporativa', 'Consultoras y escuelas de negocio', 'Formación cerrada a medida'],
      ['Suscripción a la plataforma', 'Aprendizaje en línea', 'Coursera, Udemy Business, plataformas locales', 'Acceso al catálogo por persona'],
      ['Certificación', 'Certificación oficial', 'Certificadoras del sector', 'Examen y credencial'],
    ],
    fuentes: [
      'Arancel publicado por cada institución para el año en curso: en educación el precio de lista es público por obligación en muchos países.',
      'Registros oficiales de matrícula y aranceles del ministerio de educación para tamaño de mercado y precio medio.',
      'Franquicias tributarias de capacitación donde existan: fijan un techo de precio que el mercado respeta.',
      'Precio por hora de formación como métrica normalizadora: los programas duran distinto y no se comparan de otro modo.',
    ],
  },
  {
    id: 'manufactura', nombre: 'Manufactura e industria', icono: '⚙',
    rubro: 'Fabricación y venta industrial',
    unidadNegocio: 'familias de producto', unidadPrecio: 'Plano',
    sup: { usuarios: 15, canales: 4, factor: 0.72, descAnual: 0.12 },
    lineas: [
      ['Familia de producto principal', 'Producto estándar de catálogo', 'Fabricantes nacionales e importadores', 'El producto que sostiene la planta'],
      ['Producto a pedido', 'Fabricación a medida', 'Talleres y fabricantes especializados', 'Producción contra orden'],
      ['Repuestos y consumibles', 'Posventa', 'Fabricantes y distribuidores', 'Ingreso recurrente de la base instalada'],
      ['Servicio técnico', 'Mantenimiento', 'Servicios técnicos autorizados', 'Contratos de mantención'],
      ['Distribución', 'Venta a distribuidores', 'Otros fabricantes en el canal', 'Precio de lista al canal, no al cliente final'],
    ],
    fuentes: [
      'Listas de precios del canal y catálogos de distribuidores: en industrial el precio de lista existe pero vive en PDF.',
      'Estadísticas de comercio exterior del país (importaciones por partida arancelaria) para precio de referencia y volumen.',
      'Ferias y licitaciones industriales para precios adjudicados con nombre del proveedor.',
      'Separar siempre precio de lista, precio al canal y precio con volumen: son tres filas, no una.',
    ],
  },
  {
    id: 'horeca', nombre: 'Restaurantes, hotelería y turismo', icono: '🍽',
    rubro: 'Alimentación, alojamiento y turismo',
    unidadNegocio: 'servicios', unidadPrecio: 'Plano',
    sup: { usuarios: 10, canales: 4, factor: 0.8, descAnual: 0.1 },
    lineas: [
      ['Ticket promedio', 'Consumo por visita', 'Locales del mismo segmento y zona', 'Lo que gasta un cliente por visita'],
      ['Menú ejecutivo', 'Almuerzo de semana', 'Locales de la zona', 'Producto de mayor rotación'],
      ['Habitación estándar', 'Alojamiento', 'Hoteles del mismo rango y zona', 'Tarifa por noche publicada'],
      ['Eventos y banquetes', 'Servicio para grupos', 'Centros de eventos y hoteles', 'Precio por persona en evento cerrado'],
      ['Delivery y canales', 'Venta por plataforma', 'Locales en las mismas plataformas', 'Precio en la plataforma, con su comisión'],
    ],
    fuentes: [
      'Cartas y tarifas publicadas del competidor, con fecha: en este rubro el precio es público por definición.',
      'Plataformas de reserva y de delivery para tarifa vigente y ocupación aparente, distinguiendo el precio con comisión del precio en local.',
      'Estadísticas oficiales de turismo para ocupación, tarifa media y estacionalidad.',
      'Registrar la temporada de cada precio: la misma habitación cambia de precio tres veces al año.',
    ],
  },
  {
    id: 'logistica', nombre: 'Logística y transporte', icono: '🚚',
    rubro: 'Transporte, almacenaje y última milla',
    unidadNegocio: 'servicios', unidadPrecio: 'Plano',
    sup: { usuarios: 12, canales: 5, factor: 0.7, descAnual: 0.12 },
    lineas: [
      ['Última milla', 'Reparto urbano', 'Couriers nacionales y locales', 'Entrega por paquete en ciudad'],
      ['Carga nacional', 'Transporte terrestre', 'Empresas de carga', 'Flete por tonelada o por pallet'],
      ['Almacenaje', 'Bodegaje', 'Operadores logísticos', 'Metro cuadrado o posición pallet al mes'],
      ['Fulfillment', 'Preparación de pedidos', 'Operadores de e-commerce', 'Costo por pedido preparado'],
      ['Logística inversa', 'Devoluciones', 'Couriers y operadores', 'Costo por devolución gestionada'],
    ],
    fuentes: [
      'Tarifarios publicados por couriers y operadores, y sus cotizadores en línea: dan precio por tramo, peso y volumen.',
      'Licitaciones logísticas y compras públicas para precios adjudicados reales.',
      'Índices oficiales de costo de transporte para actualizar precios viejos a moneda de hoy.',
      'Normalizar siempre a la misma unidad (paquete, pallet, tonelada-kilómetro) antes de comparar.',
    ],
  },
  {
    id: 'blanco', nombre: 'Estudio en blanco', icono: '□',
    rubro: '',
    unidadNegocio: 'líneas de producto', unidadPrecio: 'Plano',
    sup: { usuarios: 10, canales: 5, factor: 0.6, descAnual: 0.15 },
    lineas: [
      ['Línea 1', '', '', ''],
      ['Línea 2', '', '', ''],
      ['Línea 3', '', '', ''],
    ],
    fuentes: [
      'Precio de lista publicado por el propio competidor: la única fuente que se marca "Verificado".',
      'Terceros que reportan contratos (comparadores, reseñas, licitaciones) para lo que no se publica: siempre "Estimado".',
      'Dos fuentes independientes para cualquier cifra de tamaño de mercado.',
      'Fecha en todo: un precio sin fecha no es un dato.',
    ],
  },
];

/**
 * El protocolo no es decorativo: es lo que hace que el estudio de otra empresa
 * valga lo mismo que el de KIMOS. Lo lee la persona en pantalla y lo lee el
 * agente por la herramienta PROTOCOLO.
 */
const PROTOCOLO = [
  {
    n: 1, titulo: 'Definir el cliente tipo antes que nada',
    texto: 'Todo precio se compara normalizado a un mismo cliente: cuántos usuarios, cuántos canales, qué tamaño. Sin cliente tipo, comparar un precio por usuario con una tarifa plana es comparar cualquier cosa. Es el primer control de la pestaña Precios y el que manda sobre el resto del modelo.',
  },
  {
    n: 2, titulo: 'Una línea de producto, una categoría de mercado',
    texto: 'Cada línea del negocio se enfrenta a la categoría en que realmente compite, no a la que le gustaría. Si una línea no tiene competidor claro, eso también es un hallazgo: significa que no hay mercado hecho o que el cliente lo resuelve de otra forma.',
  },
  {
    n: 3, titulo: 'Precio de lista público primero',
    texto: 'Se busca el precio publicado por el propio proveedor, con su plan y su unidad de cobro. Esa fila y solo esa se marca "Verificado". Se registra la fuente completa, porque en seis meses nadie recuerda de dónde salió el número.',
  },
  {
    n: 4, titulo: 'Lo que no se publica se estima, y se dice',
    texto: 'Cuando el proveedor cotiza a puerta cerrada, se usan contratos reportados por terceros y se divide el anual en doce. La fila queda "Estimado" y la nota dice el rango completo, no solo el punto medio. Un estudio honesto muestra su propia incertidumbre.',
  },
  {
    n: 5, titulo: 'Excluir el segmento que no es el tuyo de la mediana',
    texto: 'Los planes corporativos marcan el techo del mercado pero no el precio de referencia. Entran al máximo y quedan fuera de la mediana. Si no se hace, la mediana se dispara y el precio sugerido queda alto sin razón.',
  },
  {
    n: 6, titulo: 'El precio sugerido sale de la mediana, no del costo',
    texto: 'Precio sugerido = mediana de la categoría × factor de posicionamiento. El factor es la decisión comercial: bajo 0,6 se entra por precio, sobre 0,8 se entra por valor. Es un supuesto editable, no una verdad.',
  },
  {
    n: 7, titulo: 'Demanda con dos fuentes o no se usa',
    texto: 'El tamaño de mercado se toma de fuentes públicas y se contrasta con una segunda. Si las dos difieren mucho, se cargan las dos y se muestra la horquilla: eso mide cuánto cambia el número según qué se cuente.',
  },
  {
    n: 8, titulo: 'Cerrar con economía por cliente',
    texto: 'Un precio sin LTV, CAC y payback es una opinión. Con churn, margen y costo de adquisición el estudio dice si el precio sostiene el negocio o solo la venta.',
  },
  {
    n: 9, titulo: 'Fechar y volver a levantar',
    texto: 'Un estudio de precios envejece: a los seis meses hay que revisarlo y a los doce ya no sirve para decidir. La app avisa sola cuando el levantamiento pasa esa edad.',
  },
];

function hoyISO() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Crea un estudio vacío con la estructura del rubro elegido. Sin cifras. */
function docPlantilla(id, empresa) {
  const t = PLANTILLAS.filter((x) => x.id === id)[0] || PLANTILLAS[PLANTILLAS.length - 1];
  const modulos = t.lineas.map((l, i) => ({
    n: i + 1, app: l[0], que: l[3] || '', cat: l[1] || '', alt: l[2] || '',
    target: '', pro: '', contra: '', estrategia: '', conf: '0/0', ventaja: 5, icono: 'target',
  }));
  const ns = modulos.map((m) => m.n);
  const tramo = (k) => ns.slice(0, Math.max(1, Math.ceil(ns.length * k)));
  const planes = [
    { id: 'starter', nombre: 'Básico', para: 'Entrada al servicio', incluye: '', mods: tramo(0.4), desc: 0.2 },
    { id: 'business', nombre: 'Profesional', para: 'El plan del grueso de los clientes', incluye: '', mods: tramo(0.75), desc: 0.35 },
    { id: 'enterprise', nombre: 'Corporativo', para: 'Todo el catálogo', incluye: '', mods: ns.slice(), desc: 0.5 },
  ];
  const params = clon(DATA.demanda.params);
  Object.keys(params).forEach((k) => { params[k].nota = 'Heredado del estudio semilla: reemplazar con dato propio.'; });
  return {
    meta: {
      empresa: empresa || '', rubro: t.rubro, moneda: 'USD', fecha: hoyISO(),
      fuente: '', autor: '', plantilla: t.id, unidadNegocio: t.unidadNegocio,
      titulo: 'Estudio de Mercado y Modelo de Precios',
    },
    supuestos: Object.assign({}, t.sup),
    modulos: modulos,
    competidores: [],
    planes: planes,
    kits: [],
    stack: [],
    demanda: {
      params: params,
      regiones: [], paises: [],
      mixPlan: [{ plan: 'Starter', peso: 0.5 }, { plan: 'Business', peso: 0.35 }, { plan: 'Enterprise', peso: 0.15 }],
      mixRegion: [],
    },
    evidencia: [], icp: [], segmentos: [], decisiones: [],
    notas: ['Estudio en blanco creado con la plantilla "' + t.nombre + '" el ' + hoyISO()
      + '. Todavía no tiene ni un precio: el protocolo de la pestaña "Este estudio" dice en qué orden llenarlo y qué fuentes sirven en este rubro.'],
    visual: { scores: [], tldr: [], sugerencias: [], conclusiones: [], notas: clon(VIS.notas) },
  };
}

/** Comprueba que un JSON importado sea un estudio y no cualquier otra cosa. */
function validarDoc(o) {
  if (!o || typeof o !== 'object') return 'El archivo no contiene un objeto JSON.';
  const listas = ['modulos', 'competidores', 'planes', 'kits', 'stack', 'evidencia', 'icp', 'segmentos', 'decisiones', 'notas'];
  for (const k of listas) if (!Array.isArray(o[k])) return 'Falta la lista "' + k + '".';
  if (!o.meta || typeof o.meta !== 'object') return 'Falta el bloque "meta" con la identidad del estudio.';
  if (!o.supuestos || typeof o.supuestos !== 'object') return 'Falta el bloque "supuestos".';
  if (!o.demanda || !o.demanda.params || !Array.isArray(o.demanda.paises)) return 'Falta el bloque "demanda" con params y paises.';
  if (!Array.isArray(o.demanda.mixPlan)) return 'Falta demanda.mixPlan.';
  if (!Array.isArray(o.demanda.regiones)) return 'Falta demanda.regiones.';
  for (const c of ['gastoSuites', 'pymeShare', 'segmento', 'churn', 'margen', 'cac', 'clientes3']) {
    if (!o.demanda.params[c] || typeof o.demanda.params[c].valor !== 'number') return 'Falta el parámetro "' + c + '" en demanda.params.';
  }
  for (const m of o.modulos) if (typeof m.n !== 'number' || !m.app) return 'Hay un módulo sin número o sin nombre.';
  for (const p of o.planes.concat(o.kits)) if (!p.id || !Array.isArray(p.mods)) return 'Hay un plan sin id o sin lista de módulos.';
  if (!o.visual || typeof o.visual !== 'object') o.visual = { scores: [], tldr: [], sugerencias: [], conclusiones: [], notas: clon(VIS.notas) };
  for (const k of ['scores', 'tldr', 'sugerencias', 'conclusiones']) if (!Array.isArray(o.visual[k])) o.visual[k] = [];
  if (!o.visual.notas) o.visual.notas = clon(VIS.notas);
  return null;
}

/* ------------------------------------------------------------------ *
 * Supuestos por defecto (los que trae el documento del estudio)
 * ------------------------------------------------------------------ */

function supBase(d) {
  return {
    usuarios: d.supuestos.usuarios,
    canales: d.supuestos.canales,
    factor: d.supuestos.factor,
    descAnual: d.supuestos.descAnual,
    gastoSuites: d.demanda.params.gastoSuites.valor,
    pymeShare: d.demanda.params.pymeShare.valor,
    segmento: d.demanda.params.segmento.valor,
    churn: d.demanda.params.churn.valor,
    margen: d.demanda.params.margen.valor,
    cac: d.demanda.params.cac.valor,
    clientes3: d.demanda.params.clientes3.valor,
  };
}

function descBase(d) {
  const o = {};
  d.planes.concat(d.kits).forEach((p) => { o[p.id] = p.desc; });
  return o;
}

function mixBase(d) {
  const o = {};
  d.demanda.mixPlan.forEach((m) => { o[m.plan.toLowerCase()] = m.peso; });
  return o;
}

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

function estadoInicial(d) {
  return {
    v: 4,
    tab: 'resumen',
    tema: 'dash',
    menuTema: false,
    sup: supBase(d),
    desc: descBase(d),
    mix: mixBase(d),
    precios: {},                       // precios de competencia editados a mano
    cfg: { mods: [], desc: 0.5 },      // configurador de suscripción
    alcance: { region: '', idioma: '', prioridad: '', pais: '' },
    filtro: { q: '', app: '', seg: '', conf: '' },
    orden: { mod: { key: 'sugerido', dir: -1 }, comp: { key: 'costo', dir: -1 } },
    modSel: null,
    // rev sube en cada edición del documento: es lo que invalida los memos de
    // cálculo, porque el documento se muta en sitio y React no lo vería.
    rev: 0,
    propio: false,
    form: {
      plantilla: 'saas', empresa: '', linea: '',
      nl: { app: '', cat: '', alt: '' },
      nc: { comp: '', plan: '', precio: '', unidad: 'Plano', seg: 'PyME / Empresa', fuente: '', conf: 'Verificado', nota: '' },
    },
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

function calcularOferta(d, sup, desc, precios) {
  const porApp = new Map();
  d.competidores.forEach((c, i) => {
    if (!porApp.has(c.app)) porApp.set(c.app, []);
    porApp.get(c.app).push({ c: c, i: i, costo: costoTipo(c, sup, i, precios) });
  });

  const modulos = d.modulos.map((m) => {
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
    const dsc = desc[p.id] != null ? desc[p.id] : p.desc;
    const mensual = Math.round(suma * (1 - dsc));
    const anual = Math.round(mensual * 12 * (1 - sup.descAnual));
    return Object.assign({}, p, {
      suma: suma,
      descuento: dsc,
      mensual: mensual,
      porUsuario: Math.round((mensual / sup.usuarios) * 10) / 10,
      anual: anual,
      ahorroAnual: suma * 12 - anual,
      nombres: p.mods.map((n) => byN.get(n).app),
    });
  };

  const planes = d.planes.map(armar);
  const kits = d.kits.map(armar);

  const stack = d.stack.map((s) => {
    const c = d.competidores[s.comp];
    return {
      necesidad: s.necesidad, herramienta: s.herramienta, plan: s.plan, app: c.app,
      unidad: c.unidad, costo: costoTipo(c, sup, s.comp, precios),
    };
  });
  const stackTotal = stack.reduce((a, s) => a + s.costo, 0);
  // Un estudio recién creado todavía no tiene planes: el plan tope es un cero
  // con forma de plan para que nada más abajo tenga que preguntar.
  const PLAN_CERO = { id: '', nombre: '—', suma: 0, descuento: 0, mensual: 0, porUsuario: 0, anual: 0, ahorroAnual: 0, mods: [], nombres: [] };
  const ent = planes[planes.length - 1] || PLAN_CERO;

  const medianaCartera = mediana(modulos.map((m) => m.med));
  modulos.forEach((m) => {
    const paga = m.med >= medianaCartera;
    const ventaja = m.ventaja >= 5.5;
    m.cuadrante = paga && ventaja ? 'APOSTAR'
      : paga && !ventaja ? 'MONETIZAR CON CUIDADO'
      : ventaja ? 'DIFERENCIAR, NO FACTURAR' : 'REPLANTEAR';
  });

  return {
    modulos: modulos, byN: byN, byApp: byApp, planes: planes, kits: kits, planCero: PLAN_CERO,
    aLaCarta: modulos.reduce((a, m) => a + m.sugerido, 0),
    medianaTotal: modulos.reduce((a, m) => a + m.med, 0),
    medianaCartera: medianaCartera,
    stack: stack,
    stackTotal: stackTotal,
    stackPorUsuario: stackTotal / sup.usuarios,
    ratioStack: stackTotal ? ent.mensual / stackTotal : 0,
    ahorroAnualStack: (stackTotal - ent.mensual) * 12,
    verificados: d.competidores.filter((c) => c.conf === 'Verificado').length,
  };
}

function paisesEnAlcance(d, alcance) {
  return d.demanda.paises.filter((p) => {
    if (alcance.pais && p.pais !== alcance.pais) return false;
    if (alcance.region && p.region !== alcance.region) return false;
    if (alcance.idioma && p.idioma !== alcance.idioma) return false;
    if (alcance.prioridad && p.prioridad !== alcance.prioridad) return false;
    return true;
  });
}

function calcularDemanda(d, sup, alcance, oferta, mix) {
  const saasReg = new Map(d.demanda.regiones.map((r) => [r.region, r.saas]));
  const filas = paisesEnAlcance(d, alcance).map((p) => {
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

// El modo dashboard replica el formato del tablero original (1,234.5); los
// demás usan el formato local (1.234,5). Es lo único que cambia entre modos
// además de la escala visual.
let LOC = 'en-US';
const nf = {};
const fmt = (d) => (nf[LOC + '|' + d] || (nf[LOC + '|' + d] = new Intl.NumberFormat(LOC, {
  minimumFractionDigits: d, maximumFractionDigits: d,
})));
const setLocale = (tema) => { LOC = tema === 'dash' ? 'en-US' : 'es-CL'; };

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

  // El documento del estudio vive en la instancia, no en el módulo: dos
  // ventanas abiertas pueden estar analizando dos empresas distintas.
  let D = docSemilla();
  let estado = estadoInicial(D);
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
    if (id === '__todos') return commit({ cfg: { mods: D.modulos.map((m) => m.app), desc: 0.62 } });
    if (id === '__ninguno') return commit({ cfg: { mods: [], desc: estado.cfg.desc } });
    const p = D.planes.concat(D.kits).filter((x) => x.id === id)[0];
    if (!p) return;
    const byN = new Map(D.modulos.map((m) => [m.n, m.app]));
    commit({ cfg: { mods: p.mods.map((n) => byN.get(n)), desc: estado.desc[p.id] != null ? estado.desc[p.id] : p.desc } });
  }

  /* --------------------- el estudio como documento ---------------------- */

  // El documento se muta en sitio (es grande y se edita fila a fila); lo que
  // dispara el redibujo es la revisión, no una copia nueva del objeto.
  function tocarDoc(patch) {
    commit(Object.assign({ rev: (estado.rev || 0) + 1, propio: true }, patch || {}));
  }

  function setForm(k, v) { commit({ form: Object.assign({}, estado.form, { [k]: v }) }); }
  function setSubForm(grupo, k, v) {
    setForm(grupo, Object.assign({}, estado.form[grupo], { [k]: v }));
  }

  function cargarDoc(nuevo, aviso, propio) {
    D = nuevo;
    const base = estadoInicial(D);
    estado = Object.assign(base, {
      tema: estado.tema, tab: 'estudio', rev: (estado.rev || 0) + 1,
      propio: propio !== false, form: estado.form,
    });
    oyentes.forEach((f) => f(estado));
    programarGuardado();
    if (aviso && shell && shell.notify) shell.notify({ level: 'success', text: aviso });
  }

  function nuevoEstudio(plantilla, empresa) {
    const t = PLANTILLAS.filter((x) => x.id === plantilla)[0];
    cargarDoc(docPlantilla(plantilla, empresa),
      'Estudio nuevo con la plantilla ' + (t ? t.nombre : plantilla) + '. No trae ni un precio: eso lo pone la investigación.');
  }

  function volverASemilla() {
    cargarDoc(docSemilla(), 'Volviste al estudio de KIMOS', false);
  }

  function setMeta(k, v) {
    D.meta = Object.assign({}, D.meta, { [k]: v });
    tocarDoc();
  }

  function agregarLinea(o) {
    const app = String(o.app || '').trim();
    if (!app) return 'Ponle nombre a la línea.';
    if (D.modulos.some((m) => m.app.toLowerCase() === app.toLowerCase())) return 'Ya existe una línea llamada ' + app + '.';
    const n = D.modulos.reduce((a, m) => Math.max(a, m.n), 0) + 1;
    D.modulos = D.modulos.concat([{
      n: n, app: app, que: o.que || '', cat: o.cat || '', alt: o.alt || '',
      target: '', pro: '', contra: '', estrategia: '', conf: '0/0',
      ventaja: typeof o.ventaja === 'number' ? o.ventaja : 5, icono: o.icono || 'target',
    }]);
    tocarDoc();
    return null;
  }

  function editarLinea(app, k, v) {
    D.modulos = D.modulos.map((m) => (m.app === app ? Object.assign({}, m, { [k]: v }) : m));
    // Renombrar una línea tiene que arrastrar sus precios, o quedan huérfanos.
    if (k === 'app') D.competidores = D.competidores.map((c) => (c.app === app ? Object.assign({}, c, { app: v }) : c));
    tocarDoc();
  }

  function borrarLinea(app) {
    const m = D.modulos.filter((x) => x.app === app)[0];
    if (!m) return;
    D.modulos = D.modulos.filter((x) => x.app !== app);
    D.competidores = D.competidores.filter((c) => c.app !== app);
    D.planes = D.planes.map((p) => Object.assign({}, p, { mods: p.mods.filter((n) => n !== m.n) }));
    D.kits = D.kits.map((p) => Object.assign({}, p, { mods: p.mods.filter((n) => n !== m.n) }));
    D.stack = D.stack.filter((x) => (D.competidores[x.comp] || {}).app !== app);
    tocarDoc({ modSel: null, precios: {} });
  }

  const UNIDADES = ['Plano', 'Por usuario', 'Por canal'];
  const SEGMENTOS = ['PyME / Empresa', 'Enterprise'];

  function agregarCompetidor(o) {
    const app = String(o.app || '').trim();
    if (!D.modulos.some((m) => m.app === app)) return 'No existe la línea ' + app + '.';
    if (!String(o.comp || '').trim()) return 'Falta el nombre del competidor.';
    if (!String(o.plan || '').trim()) return 'Falta el nombre del plan.';
    const precio = Number(o.precio);
    if (!isFinite(precio) || precio < 0) return 'El precio tiene que ser un número mayor o igual que cero.';
    if (!String(o.fuente || '').trim()) return 'Sin fuente no entra: es la regla del estudio.';
    if (UNIDADES.indexOf(o.unidad) < 0) return 'Unidad desconocida. Usa: ' + UNIDADES.join(', ') + '.';
    if (SEGMENTOS.indexOf(o.seg) < 0) return 'Segmento desconocido. Usa: ' + SEGMENTOS.join(', ') + '.';
    D.competidores = D.competidores.concat([{
      row: D.competidores.length, app: app, comp: String(o.comp).trim(), plan: String(o.plan).trim(),
      precio: precio, unidad: o.unidad, seg: o.seg, nota: o.nota || '',
      fuente: String(o.fuente).trim(), conf: o.conf === 'Estimado' ? 'Estimado' : 'Verificado',
    }]);
    tocarDoc({ precios: {} });
    return null;
  }

  function borrarCompetidor(i) {
    if (!D.competidores[i]) return;
    D.competidores = D.competidores.filter((c, k) => k !== i);
    // stack guarda índices sobre competidores: se recolocan o el stack miente.
    D.stack = D.stack.filter((x) => x.comp !== i).map((x) => (x.comp > i ? Object.assign({}, x, { comp: x.comp - 1 }) : x));
    tocarDoc({ precios: {} });
  }

  /** Lo que le falta a este estudio para poder decidir con él. */
  function huecos() {
    const hs = [];
    const sinPrecio = D.modulos.filter((m) => !D.competidores.some((c) => c.app === m.app));
    if (!D.meta.empresa) hs.push('El estudio no dice de qué empresa es.');
    if (!D.meta.rubro) hs.push('Falta declarar el rubro.');
    if (!D.competidores.length) hs.push('No hay ni un precio de competencia levantado.');
    else if (sinPrecio.length) hs.push(sinPrecio.length + ' línea(s) sin competencia levantada: ' + sinPrecio.map((m) => m.app).join(', ') + '.');
    const sinFuente = D.competidores.filter((c) => !c.fuente).length;
    if (sinFuente) hs.push(sinFuente + ' precio(s) sin fuente.');
    if (!D.demanda.paises.length) hs.push('El estudio de demanda está vacío: sin mercados no hay TAM ni SAM.');
    if (!D.evidencia.length) hs.push('No hay evidencia de demanda cargada.');
    if (!D.icp.length) hs.push('No hay perfiles de cliente ideal.');
    const meses = edadMeses();
    if (meses != null && meses >= 12) hs.push('El levantamiento tiene ' + meses + ' meses: ya no sirve para decidir precio.');
    else if (meses != null && meses >= 6) hs.push('El levantamiento tiene ' + meses + ' meses: toca revisarlo.');
    if (!D.visual.scores.length) hs.push('Falta el diagnóstico por dimensión.');
    return hs;
  }

  function edadMeses() {
    const f = Date.parse(D.meta.fecha);
    if (!isFinite(f)) return null;
    return Math.max(0, Math.round((Date.now() - f) / (1000 * 60 * 60 * 24 * 30.4)));
  }

  let timer = null;
  function programarGuardado() {
    if (!shell || typeof shell.saveData !== 'function') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { v, tab, tema, sup, desc, mix, precios, cfg, alcance, propio } = estado;
      // El documento solo se guarda si es propio: mientras sea el estudio de
      // KIMOS tal cual, ya viene en el bundle y guardarlo sería duplicarlo.
      const payload = { v, tab, tema, sup, desc, mix, precios, cfg, alcance, propio };
      if (propio) payload.doc = D;
      Promise.resolve(shell.saveData(payload)).catch(() => {});
    }, 800);
  }

  async function restaurar() {
    if (!shell || typeof shell.loadData !== 'function') return;
    try {
      const d = await shell.loadData();
      if (!d || typeof d !== 'object') return;
      if (d.propio && d.doc && !validarDoc(d.doc)) {
        D = d.doc;
        estado = Object.assign(estadoInicial(D), { tema: estado.tema, propio: true });
      }
      const patch = {};
      if (d.tab) patch.tab = d.tab;
      if (d.tema) patch.tema = d.tema;
      if (d.sup) patch.sup = Object.assign(supBase(D), d.sup);
      if (d.desc) patch.desc = Object.assign(descBase(D), d.desc);
      if (d.mix) patch.mix = Object.assign(mixBase(D), d.mix);
      if (d.precios) patch.precios = d.precios;
      if (d.cfg && Array.isArray(d.cfg.mods)) patch.cfg = d.cfg;
      if (d.alcance) patch.alcance = Object.assign({ region: '', idioma: '', prioridad: '', pais: '' }, d.alcance);
      estado = Object.assign({}, estado, patch);
      oyentes.forEach((f) => f(estado));
    } catch (e) { /* primera apertura: sin datos guardados */ }
  }

  function descargar(nombre, texto, tipo) {
    try {
      // El BOM es para que Excel abra bien el CSV; en JSON rompería el parseo.
      const json = tipo === 'json';
      const blob = new Blob([(json ? '' : '﻿') + texto],
        { type: (json ? 'application/json' : 'text/csv') + ';charset=utf-8' });
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

  function exportarEstudio() {
    const nom = (D.meta.empresa || 'estudio').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'estudio';
    descargar(nom + '-estudio-mercado.json', JSON.stringify(D, null, 1), 'json');
  }

  function importarEstudio(texto) {
    let o;
    try { o = JSON.parse(texto); } catch (e) { return 'El archivo no es JSON válido.'; }
    const err = validarDoc(o);
    if (err) return err;
    cargarDoc(o, 'Estudio importado: ' + (o.meta.empresa || 'sin nombre'));
    return null;
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
      const filas = D.competidores.map((c, i) => [c.app, c.comp, c.plan, precioLista(c, i, estado.precios),
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

  const qline = (etiqueta, valor, color) => h('div', { className: 'km-qline', key: etiqueta },
    h('span', null, etiqueta), h('b', { style: color ? { color: color } : null }, valor));

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
    dangerouslySetInnerHTML: { __html: PATHS[m.icono] || PATHS.box },
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
    const col = (i) => (typeof color === 'function' ? color(i) : color);
    const W = 700, LB = 150, PAD = 74, alto = 19;
    const H = filas.length * alto + 10;
    const max = Math.max.apply(null, filas.map((f) => f.valor).concat([1]));
    const cuerpo = filas.map((f, i) => h('g', { key: f.label, transform: 'translate(0,' + (i * alto + 8) + ')' },
      h('text', { x: LB - 8, y: 4, textAnchor: 'end', className: 'km-lbl' }, corto(f.label)),
      h('rect', {
        x: LB, y: -5, height: 10, rx: 5, fill: col(i), opacity: .85,
        width: Math.max(1, (f.valor / max) * (W - LB - PAD)),
      }, h('title', null, f.label + ' — ' + formato(f.valor) + (f.nota ? ' · ' + f.nota : ''))),
      h('text', { x: LB + (f.valor / max) * (W - LB - PAD) + 6, y: 4, className: 'km-val' }, formato(f.valor))));
    return h('div', { className: 'km-chart-wrap' },
      h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '560px' } },
        h('line', { x1: LB, y1: 0, x2: LB, y2: H - 4, className: 'km-ax' }),
        cuerpo));
  }

  /* ------------------------------- pestañas ------------------------------ */

  // Tres modos visuales. El dashboard es el que replica el tablero del estudio.
  const TEMAS = [
    ['dash', 'Modo dashboard', '▦', 'La estética del tablero del estudio, tal cual'],
    ['estudio', 'Modo compacto', '▤', 'Lo mismo, con menos aire: ventanas chicas'],
    ['host', 'Modo KIMOS', '◐', 'Sigue el día/noche y el acento del escritorio'],
  ];

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
    ['estudio', 'Este estudio', '◈'],
  ];

  function valsTexto(oferta) {
    const ent = oferta.planes[oferta.planes.length - 1] || oferta.planCero;
    const kits = oferta.kits.map((k) => k.mensual);
    const top3 = oferta.modulos.slice().sort((a, b) => b.sugerido - a.sugerido).slice(0, 3)
      .map((m) => corto(m.app)).join(', ');
    return {
      stack: usd(oferta.stackTotal), aLaCarta: usd(oferta.aLaCarta), enterprise: usd(ent.mensual),
      ahorroAnual: usd(oferta.ahorroAnualStack), top3: top3,
      kitMin: usd(kits.length ? Math.min.apply(null, kits) : 0),
      kitMax: usd(kits.length ? Math.max.apply(null, kits) : 0),
      estimados: String(D.competidores.length - oferta.verificados),
      totalPlanes: String(D.competidores.length),
    };
  }

  const tarjetaDiag = (t, vals) => h('div', { className: 'km-diag', key: t.titulo, style: { '--k-g': C[t.color] || C.violet } },
    h('h4', null, t.titulo),
    h('p', null, rt(t.texto, vals)));

  /**
   * Pestaña "Este estudio": lo que convierte el tablero de KIMOS en una
   * herramienta que sirve para cualquier empresa. Aquí se declara de quién es
   * el estudio, se ve qué le falta, se arranca uno nuevo con la plantilla del
   * rubro, se importa y exporta, y se editan las líneas y los precios.
   */
  function vistaEstudio() {
    const meta = D.meta || {};
    const plant = PLANTILLAS.filter((x) => x.id === meta.plantilla)[0];
    const meses = edadMeses();
    const hs = huecos();
    const verif = D.competidores.filter((c) => c.conf === 'Verificado').length;
    const cobertura = D.competidores.length ? verif / D.competidores.length : 0;
    const conLinea = D.modulos.filter((m) => D.competidores.some((c) => c.app === m.app)).length;
    const f = estado.form;
    const avisar = (nivel, texto) => { if (shell && shell.notify) shell.notify({ level: nivel, text: texto }); };

    const campo = (etiqueta, valor, onChange, ph) => h('div', { className: 'km-ctrl', key: etiqueta },
      h('label', null, etiqueta),
      h('input', {
        className: 'km-in', type: 'text', value: valor || '', placeholder: ph || '',
        onChange: (e) => onChange(e.target.value),
      }));

    /* ------------------------------ identidad ----------------------------- */
    const identidad = card('Identidad del estudio', C.violet,
      'De qué empresa es, quién lo firma y cuándo se levantó. Todo lo demás se lee a la luz de esto.',
      h('div', null,
        h('div', { className: 'km-ctrls' },
          campo('Empresa analizada', meta.empresa, (v) => setMeta('empresa', v), 'Nombre de la empresa'),
          campo('Rubro', meta.rubro, (v) => setMeta('rubro', v), 'Sector o industria'),
          campo('Autor', meta.autor, (v) => setMeta('autor', v), 'Quién hizo el estudio'),
          campo('Moneda', meta.moneda, (v) => setMeta('moneda', v), 'USD'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Fecha del levantamiento'),
            h('input', {
              className: 'km-in', type: 'date', value: meta.fecha || '',
              onChange: (e) => setMeta('fecha', e.target.value),
            })),
          campo('Título', meta.titulo, (v) => setMeta('titulo', v), 'Estudio de Mercado y Modelo de Precios')),
        h('div', { className: 'km-filtros' },
          pill('Plantilla: ' + (plant ? plant.nombre : 'estudio original'), 'km-p-v'),
          pill(estado.propio ? 'Documento propio de esta ventana' : 'Estudio de KIMOS (semilla del bundle)',
            estado.propio ? 'km-p-g' : 'km-p-c'),
          pill(D.modulos.length + ' líneas · ' + D.competidores.length + ' precios levantados', 'km-p-c'))));

    /* -------------------------- salud de la evidencia --------------------- */
    const colorEdad = meses == null ? C.violet : meses >= 12 ? C.red : meses >= 6 ? C.amber : C.green;
    const salud = card('Qué tan sólido está', colorEdad,
      'Un estudio de precios envejece: a los seis meses hay que revisarlo y a los doce ya no sirve para decidir.',
      h('div', null,
        h('div', { className: 'km-kpis' },
          kpi('Precios levantados', num(D.competidores.length), verif + ' verificados en fuente', C.cyan),
          kpi('Cobertura de fuente', D.competidores.length ? pct(cobertura, 0) : '—',
            (D.competidores.length - verif) + ' estimados', cobertura >= 0.8 ? C.green : C.amber),
          kpi('Líneas con competencia', conLinea + '/' + D.modulos.length,
            conLinea === D.modulos.length ? 'Todas cubiertas' : 'Faltan por levantar', conLinea === D.modulos.length ? C.green : C.orange),
          kpi('Edad del levantamiento', meses == null ? '—' : meses + (meses === 1 ? ' mes' : ' meses'),
            meses == null ? 'Sin fecha' : meses >= 12 ? 'Vencido' : meses >= 6 ? 'Toca revisarlo' : 'Vigente', colorEdad)),
        hs.length
          ? h('div', { className: 'km-col' },
            h('h4', null, 'Lo que le falta a este estudio'),
            h('ul', { className: 'km-mut km-lista' }, hs.map((x, i) => h('li', { key: i }, x))))
          : nota({ titulo: 'Sin huecos.', texto: 'El estudio tiene identidad, precios con fuente, mercados y perfiles de cliente. Se puede decidir con él.' })));

    /* ------------------------------ plantillas ---------------------------- */
    const plantillas = card('Empezar el estudio de otra empresa', C.cyan,
      'La plantilla trae la estructura de comparación del rubro y las fuentes que sirven en ese sector. No trae cifras: los números los pone la investigación.',
      h('div', null,
        h('div', { className: 'km-modgrid' }, PLANTILLAS.map((x) => h('button', {
          key: x.id, className: 'km-mod' + (f.plantilla === x.id ? ' on' : ''),
          title: x.rubro || 'Sin estructura previa',
          onClick: () => setForm('plantilla', x.id),
        }, h('span', null, x.nombre), h('span', { className: 'km-mod-pz' }, x.icono)))),
        h('div', { className: 'km-ctrls' },
          campo('Empresa', f.empresa, (v) => setForm('empresa', v), 'Para quién es el estudio'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Y se crea'),
            h('button', { className: 'km-btn pri', onClick: () => nuevoEstudio(f.plantilla, f.empresa) },
              '＋ Crear estudio nuevo'))),
        nota({
          titulo: 'Reemplaza el estudio de esta ventana.',
          texto: 'El de KIMOS vuelve con un clic porque viene en el bundle; si el actual es tuyo, expórtalo antes. Y como la app es multiinstancia, otra ventana puede seguir con otro estudio en paralelo.',
        })));

    /* --------------------------- llevar y traer --------------------------- */
    const archivo = card('Llevar y traer el estudio', C.teal,
      'El estudio es un archivo JSON: se exporta, se versiona, se le entrega al cliente y se vuelve a cargar en cualquier ventana.',
      h('div', null,
        h('div', { className: 'km-filtros' },
          h('button', { className: 'km-btn', onClick: exportarEstudio }, '⭳ Exportar estudio (JSON)'),
          h('label', { className: 'km-btn', title: 'Carga un estudio exportado antes' }, '⭱ Importar estudio',
            h('input', {
              type: 'file', accept: '.json,application/json', style: { display: 'none' },
              onChange: (e) => {
                const file = e.target.files && e.target.files[0];
                e.target.value = '';
                if (!file) return;
                const fr = new FileReader();
                fr.onload = () => {
                  const err = importarEstudio(String(fr.result));
                  if (err) avisar('error', err);
                };
                fr.onerror = () => avisar('error', 'No se pudo leer el archivo');
                fr.readAsText(file);
              },
            })),
          h('button', { className: 'km-btn', onClick: volverASemilla }, '↺ Volver al estudio de KIMOS')),
        nota({
          titulo: 'Qué viaja en el archivo.',
          texto: 'Identidad, supuestos, líneas, precios con su fuente, planes, mercados, evidencia, perfiles y el diagnóstico. Al importarlo se comprueba la estructura y, si algo falta, dice exactamente qué.',
        })));

    /* ------------------------------- líneas ------------------------------- */
    const colsLin = [
      { k: 'app', l: 'Línea de producto', cell: (m) => h('input', { className: 'km-in', value: m.app, onChange: (e) => editarLinea(m.app, 'app', e.target.value) }) },
      { k: 'cat', l: 'Categoría de mercado', cell: (m) => h('input', { className: 'km-in', value: m.cat || '', placeholder: 'Contra qué categoría compite', onChange: (e) => editarLinea(m.app, 'cat', e.target.value) }) },
      { k: 'alt', l: 'Competidores de referencia', cell: (m) => h('input', { className: 'km-in', value: m.alt || '', placeholder: 'Nombres separados por coma', onChange: (e) => editarLinea(m.app, 'alt', e.target.value) }) },
      {
        k: 'ventaja', l: 'Ventaja 0-10', num: true,
        cell: (m) => h('input', {
          className: 'km-in km-num', type: 'number', min: 0, max: 10, step: 0.5, value: m.ventaja,
          onChange: (e) => editarLinea(m.app, 'ventaja', Math.min(10, Math.max(0, Number(e.target.value) || 0))),
        }),
      },
      { k: 'cuenta', l: 'Precios', num: true, cell: (m) => String(D.competidores.filter((c) => c.app === m.app).length) },
      { k: 'x', l: '', cell: (m) => h('button', { className: 'km-x', title: 'Quita la línea y sus precios', onClick: () => borrarLinea(m.app) }, '✕') },
    ];
    const lineas = card('Líneas de producto', C.orange,
      'Cada línea se compara contra una categoría de mercado. La ventaja de 0 a 10 es tu juicio sobre qué tan bien compites ahí, y es lo que ubica la línea en la matriz de cartera del diagnóstico.',
      h('div', null,
        tabla(colsLin, D.modulos, { key: (m) => m.n }),
        h('div', { className: 'km-ctrls' },
          campo('Nueva línea', f.nl.app, (v) => setSubForm('nl', 'app', v), 'Nombre'),
          campo('Categoría', f.nl.cat, (v) => setSubForm('nl', 'cat', v), 'Categoría de mercado'),
          campo('Competidores', f.nl.alt, (v) => setSubForm('nl', 'alt', v), 'Contra quién compite'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Añadir'),
            h('button', {
              className: 'km-btn',
              onClick: () => {
                const err = agregarLinea(f.nl);
                if (err) return avisar('error', err);
                setForm('nl', { app: '', cat: '', alt: '' });
              },
            }, '＋ Añadir línea')))));

    /* ------------------------------- precios ------------------------------ */
    const lineaSel = f.linea || (D.modulos[0] ? D.modulos[0].app : '');
    const idx = D.competidores.map((c, i) => ({ c: c, i: i })).filter((x) => x.c.app === lineaSel);
    const colsPre = [
      { k: 'comp', l: 'Competidor', cell: (x) => x.c.comp },
      { k: 'plan', l: 'Plan', cell: (x) => x.c.plan },
      { k: 'precio', l: 'Precio', num: true, cell: (x) => usd1(x.c.precio) },
      { k: 'unidad', l: 'Unidad', cell: (x) => x.c.unidad },
      { k: 'seg', l: 'Segmento', cell: (x) => x.c.seg },
      { k: 'fuente', l: 'Fuente', cell: (x) => h('span', { className: 'km-src', title: x.c.fuente }, x.c.fuente || '—') },
      { k: 'conf', l: 'Confianza', cell: (x) => pillConf(x.c.conf) },
      { k: 'x', l: '', cell: (x) => h('button', { className: 'km-x', title: 'Quita este precio', onClick: () => borrarCompetidor(x.i) }, '✕') },
    ];
    const nc = f.nc;
    const precios = card('Precios levantados', C.blue,
      'Un precio sin fuente no entra. Es la regla que separa un estudio de una opinión con tablas.',
      h('div', null,
        h('div', { className: 'km-filtros' },
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Línea'),
            selector(lineaSel, D.modulos.map((m) => m.app), (v) => setForm('linea', v), 'Elige una línea')),
          h('span', { className: 'km-cuenta' }, idx.length + ' precio(s) en esta línea')),
        idx.length ? tabla(colsPre, idx, { key: (x) => x.i })
          : h('p', { className: 'km-mut' }, 'Todavía no hay precios levantados para esta línea.'),
        h('div', { className: 'km-ctrls' },
          campo('Competidor', nc.comp, (v) => setSubForm('nc', 'comp', v), 'Nombre del competidor'),
          campo('Plan', nc.plan, (v) => setSubForm('nc', 'plan', v), 'Nombre del plan'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Precio de lista'),
            h('input', {
              className: 'km-in', type: 'number', min: 0, step: 0.01, value: nc.precio,
              placeholder: '0', onChange: (e) => setSubForm('nc', 'precio', e.target.value),
            })),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Unidad'),
            h('select', {
              className: 'km-in', value: nc.unidad, onChange: (e) => setSubForm('nc', 'unidad', e.target.value),
            }, UNIDADES.map((u) => h('option', { key: u, value: u }, u)))),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Segmento'),
            h('select', {
              className: 'km-in', value: nc.seg, onChange: (e) => setSubForm('nc', 'seg', e.target.value),
            }, SEGMENTOS.map((u) => h('option', { key: u, value: u }, u)))),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Confianza'),
            h('select', {
              className: 'km-in', value: nc.conf, onChange: (e) => setSubForm('nc', 'conf', e.target.value),
            }, ['Verificado', 'Estimado'].map((u) => h('option', { key: u, value: u }, u)))),
          campo('Fuente', nc.fuente, (v) => setSubForm('nc', 'fuente', v), 'URL o documento donde está el precio'),
          campo('Nota', nc.nota, (v) => setSubForm('nc', 'nota', v), 'Asientos incluidos, condiciones, rango'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Añadir'),
            h('button', {
              className: 'km-btn pri',
              onClick: () => {
                const err = agregarCompetidor(Object.assign({ app: lineaSel }, nc));
                if (err) return avisar('error', err);
                setForm('nc', { comp: '', plan: '', precio: '', unidad: nc.unidad, seg: nc.seg, fuente: '', conf: nc.conf, nota: '' });
              },
            }, '＋ Añadir precio')))));

    /* ------------------------------ protocolo ----------------------------- */
    const pasos = h('div', { className: 'km-col' }, PROTOCOLO.map((x) => h('div', {
      key: x.n, className: 'km-diag', style: { '--k-g': PAL[(x.n - 1) % PAL.length] },
    }, h('h4', null, x.n + '. ' + x.titulo), h('p', null, x.texto))));

    const fuentes = plant && plant.fuentes ? card('Dónde se buscan los datos en este rubro', C.green,
      'Las fuentes cambian con el sector: lo que en software es una página de precios, en salud es un arancel y en industria un catálogo del canal.',
      h('ul', { className: 'km-mut km-lista' }, plant.fuentes.map((x, i) => h('li', { key: i }, x)))) : null;

    const agente = card('Que lo haga el agente', C.fuchsia,
      'El agente de KIMOS tiene herramientas para hacer el estudio completo sin que nadie toque un formulario.',
      h('div', null,
        qline('PROTOCOLO', 'Le dice el método y qué le falta a este estudio'),
        qline('NUEVO_ESTUDIO', 'Arranca el estudio de otra empresa con la plantilla del rubro'),
        qline('SET_IDENTIDAD', 'Declara empresa, rubro, moneda y fecha'),
        qline('AGREGAR_LINEA', 'Añade una línea de producto y su categoría'),
        qline('AGREGAR_COMPETIDOR', 'Carga un precio con su fuente y su nivel de confianza'),
        qline('ELIMINAR_COMPETIDOR', 'Quita un precio que quedó mal levantado'),
        qline('IMPORTAR_ESTUDIO / EXPORTAR_ESTUDIO', 'Trae o entrega el estudio como JSON'),
        nota({
          titulo: 'Ejemplo.',
          texto: '"Hazme el estudio de mercado de una clínica dental en Santiago": el agente crea el estudio con la plantilla de salud, levanta los aranceles publicados de la competencia, los carga con su fuente y el modelo devuelve precio sugerido, mercado y economía por paciente.',
        })));

    return h('div', { className: 'km-vista' },
      identidad, salud, plantillas, archivo, lineas, precios,
      card('Protocolo de investigación', C.amber,
        'Es lo que hace que el estudio de otra empresa valga lo mismo que el de KIMOS. Se sigue en este orden.', pasos),
      fuentes, agente);
  }

  function vistaResumen(oferta, demanda) {
    const vals = valsTexto(oferta);
    const ent = oferta.planes[oferta.planes.length - 1] || oferta.planCero;

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

    return h('div', { className: 'km-vista km-fade' },
      nota(D.visual.notas.resumen),
      h('div', { className: 'km-g2' },
        card('Precio sugerido de ' + emp() + ' vs. mediana del mercado', C.cyan,
          'Por módulo, normalizado al cliente tipo. La barra violeta es el mercado; la cian, KIMOS.',
          barrasDobles(filasMain, C.violet, C.cyan, 'Mediana del mercado', 'Precio sugerido KIMOS')),
        h('div', { className: 'km-col' },
          card('El gasto que ' + emp() + ' reemplaza', C.fuchsia,
            'Stack best-of-breed que arma hoy una empresa del tamaño tipo, por herramienta.',
            dona(top, oferta.stackTotal)),
          card('Escalera de planes', C.orange,
            'Precio mensual por usuario de cada plan frente al costo del stack actual.',
            barrasVert(escalera, usd1)))),
      card('Lo que dice el estudio, en cinco frases', C.green, null,
        h('div', { className: 'km-g3' }, D.visual.tldr.map((t) => tarjetaDiag(t, vals)))),
      card('Y lo que dice el estudio de demanda', C.blue,
        'El alcance comercial elegido manda sobre estos cuatro números.',
        h('div', { className: 'km-kpis' },
          kpi('SAM del alcance', mm(demanda.sam), demanda.filas.length + ' mercados · índice ' + x2(demanda.indice), C.blue),
          kpi('ARPU anual', usd(demanda.arpuAnual), 'Con el mix de planes actual', C.teal),
          kpi('ARR al año 3', usd(demanda.arr[2]), num(demanda.vivos[2]) + ' clientes vivos', C.green),
          kpi('Penetración necesaria', pct(demanda.penetracion, 2),
            demanda.penetracion > 0.02 ? 'Sobre 2%: el plan deja de ser realista' : 'Bajo el umbral de alerta',
            demanda.penetracion > 0.02 ? C.red : C.cyan))),
      h('p', { className: 'km-pie' }, 'Estudio del ' + D.meta.fecha + ' · precios de lista públicos en '
        + D.meta.moneda + ', sin impuestos ni descuentos por volumen · cliente tipo de '
        + estado.sup.usuarios + ' usuarios y ' + estado.sup.canales + ' canales · ' + emp() + ' '
        + ent.nombre + ' ' + usd(ent.mensual) + '/mes'));
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
    return h('div', { className: 'km-vista km-fade' },
      card('Mapa competitivo por aplicación', C.violet,
        'Cada app de KIMOS, contra quién compite, en qué rango se mueve el mercado y a qué precio conviene entrar. La mediana excluye planes Enterprise (Akeneo, Salsify, Cvent, Bizzabo, Kissflow, Nintex) porque son de otro segmento y distorsionan la referencia. Haz clic en una fila para ver el detalle.',
        t),
      sel ? detalleModulo(sel, oferta) : null);
  }

  function detalleModulo(sel, oferta) {
    const i = D.modulos.map((m) => m.n).indexOf(sel.n);
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
    const filas = D.competidores
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
    let filas = D.competidores.map((c, i) => ({
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

    return h('div', { className: 'km-vista km-fade' },
      h('div', { className: 'km-ctrls' },
        ctrl('Usuarios del cliente tipo', 'usuarios', 1, 200, 1, num),
        ctrl('Canales sociales', 'canales', 1, 30, 1, num),
        ctrl('Factor de posicionamiento', 'factor', 0.2, 1.2, 0.05, x2),
        ctrl('Descuento pago anual', 'descAnual', 0, 0.4, 0.01, (v) => pct(v, 0))),
      nota(D.visual.notas.factor),
      card('Detalle de precios de la competencia', C.calipso,
        'Los precios en cian son editables: escribe otro número y la mediana, el precio sugerido, los planes y el configurador se recalculan.',
        h('div', null,
          h('div', { className: 'km-filtros', style: { marginBottom: '12px' } },
            h('input', {
              className: 'km-in km-q', placeholder: 'Filtrar por app, competidor o nota…',
              value: f.q, onChange: (e) => setFiltro('q', e.target.value),
            }),
            selector(f.app, D.modulos.map((m) => m.app), (v) => setFiltro('app', v), 'Todas las apps'),
            selector(f.seg, ['PyME / Empresa', 'Enterprise'], (v) => setFiltro('seg', v), 'Todos los segmentos'),
            selector(f.conf, ['Verificado', 'Estimado'], (v) => setFiltro('conf', v), 'Toda confianza'),
            h('span', { className: 'km-cuenta' }, filas.length + ' de ' + D.competidores.length + ' planes · '
              + oferta.verificados + ' verificados' + (editados ? ' · ' + editados + ' editados a mano' : '')),
            editados ? h('button', { className: 'km-btn', onClick: () => commit({ precios: {} }) }, '↺ Precios originales') : null),
          tabla(cols, filas, { orden: o, onSort: (k) => setOrden('comp', k), key: (r) => r.i }))));
  }

  // El tablero se etiqueta con la empresa del estudio en curso, no con KIMOS.
  const emp = () => D.meta.empresa || 'la empresa';
  const planTope = (oferta) => oferta.planes[oferta.planes.length - 1] || oferta.planCero;

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
      h('div', { className: 'km-plan-pu' }, 'al mes · ' + usd1(p.porUsuario) + ' por usuario'),
      h('div', { className: 'km-plan-desc' }, p.incluye),
      qline('Suma a la carta', usd(p.suma)),
      h('div', { className: 'km-qline' },
        h('span', null, 'Descuento bundle'),
        h('span', null,
          h('input', {
            className: 'km-edit', type: 'number', min: '0', max: '95', step: '1',
            value: Math.round(p.descuento * 100), style: { width: '62px' },
            title: 'Descuento del plan sobre la suma a la carta',
            onChange: (e) => setDesc(p.id, Number(e.target.value) / 100),
          }), ' %')),
      qline('Precio anual', usd(p.anual)),
      qline('Ahorro anual del cliente', usd(p.ahorroAnual), C.green),
      qline('Módulos incluidos', String(p.mods.length)));
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

    return h('div', { className: 'km-vista km-fade' },
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
              kpi(emp() + ' · ' + planTope(oferta).nombre, usd(planTope(oferta).mensual),
                usd1(planTope(oferta).porUsuario) + ' por usuario', C.cyan),
              kpi(emp() + ' sobre ese gasto', pct(oferta.ratioStack, 0),
                banda === 'ok' ? 'Dentro de la banda sana' : banda === 'riesgo' ? 'Sobre 60%' : 'Bajo 25%', colorBanda),
              kpi('Ahorro anual del cliente', usd(oferta.ahorroAnualStack), 'Enterprise vs stack', C.green)),
            nota(D.visual.notas.banda)))));
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
      .concat(D.planes.map((p) => ({ id: p.id, nombre: p.nombre })))
      .concat(D.kits.map((p) => ({ id: p.id, nombre: p.nombre })))
      .concat([{ id: '__ninguno', nombre: 'Limpiar' }]);

    const mods = oferta.modulos.map((m) => h('label', {
      key: m.n, className: 'km-mod' + (sel.indexOf(m.app) >= 0 ? ' on' : ''),
    },
      h('input', { type: 'checkbox', checked: sel.indexOf(m.app) >= 0, onChange: () => toggleMod(m.app) }),
      h('span', null, corto(m.app)),
      h('span', { className: 'km-mod-pz' }, usd(m.sugerido))));

    const cotizacion = h('div', { className: 'km-quote' },
      h('div', { className: 'km-quote-k' }, 'Cotización'),
      h('div', { className: 'km-quote-big' }, usd(precio)),
      h('div', { style: { color: 'var(--k-mut)', fontSize: '12px', marginBottom: '12px' } },
        'al mes · ' + usd1(precio / estado.sup.usuarios) + ' por usuario · ' + sel.length + ' módulos'),
      qline('Suma a la carta', usd(suma)),
      h('div', { className: 'km-qline' },
        h('span', null, 'Descuento bundle'),
        h('span', null,
          h('input', {
            className: 'km-edit', type: 'number', min: '0', max: '95', step: '1',
            value: Math.round(estado.cfg.desc * 100), style: { width: '62px' },
            onChange: (e) => commit({ cfg: Object.assign({}, estado.cfg, { desc: Math.min(0.95, Math.max(0, Number(e.target.value) / 100)) }) }),
          }), ' %')),
      qline('Precio anual', usd(precio * 12 * (1 - estado.sup.descAnual))),
      qline('Equivalente en el mercado', usd(equivalente), C.orange),
      qline('Ahorro anual del cliente', usd(Math.max(0, (equivalente - precio) * 12)), C.green),
      qline('Módulos incluidos', String(sel.length)),
      h('div', { className: 'km-veredicto' }, veredicto));

    return h('div', { className: 'km-vista km-fade' },
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
    const uniq = (k) => Array.from(new Set(D.demanda.paises.map((p) => p[k]))).sort();
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

    return h('div', { className: 'km-vista km-fade' },
      h('div', { className: 'km-ctrls', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' } },
        h('div', { className: 'km-ctrl' }, h('label', null, 'Región'), selector(a.region, uniq('region'), (v) => setAlcance('region', v), 'Todas')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'País'), selector(a.pais, D.demanda.paises.map((p) => p.pais), (v) => setAlcance('pais', v), 'Todos')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'Idioma'), selector(a.idioma, uniq('idioma'), (v) => setAlcance('idioma', v), 'Todos')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'Prioridad comercial'), selector(a.prioridad, uniq('prioridad'), (v) => setAlcance('prioridad', v), 'Todas')),
        h('div', { className: 'km-ctrl' },
          h('label', null, 'Alcance'),
          h('div', { className: 'km-ctrl-row' },
            h('span', { className: 'km-cuenta' }, demanda.filas.length + ' de ' + D.demanda.paises.length + ' mercados'),
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

    return h('div', { className: 'km-vista km-fade' },
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
    const perfiles = D.icp.map((p, i) => h('article', { className: 'km-appcard', key: i },
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

    const evidencia = D.evidencia.map((g) => {
      const cols = g.cols.map((c, j) => ({
        k: 'c' + j, l: c, num: j > 0 && j < g.cols.length - 1 && g.cols.length > 4,
        cell: (f) => (j === g.cols.length - 1 ? pillConf(f[j]) : h('span', { className: j === 0 ? null : 'km-mut' }, f[j])),
      }));
      return card(g.titulo, C.blue, null, tabla(cols, g.filas, { key: (f, i) => i }), { key: g.titulo });
    });

    return h('div', { className: 'km-vista km-fade' },
      card('Perfiles de cliente ideal', C.violet,
        'Seis perfiles con el dolor que los mueve, el gatillo que dispara la compra y la objeción que hay que responder.',
        h('div', { className: 'km-g3' }, perfiles)),
      card('Segmentación por tamaño', C.orange, null, tabla(colsSeg, D.segmentos, { key: (s, i) => i })),
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

    return h('div', { className: 'km-vista km-fade' },
      nota(D.visual.notas.proscontras),
      h('div', { className: 'km-g3' }, tarjetas));
  }

  function vistaDiagnostico(oferta) {
    const vals = valsTexto(oferta);
    const scores = D.visual.scores.map((s) => h('div', { key: s.dim },
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
        }, h('title', null, m.app + ' — mercado ' + usd(m.med) + '/mes · sugerido ' + usd(m.sugerido)
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
        h('text', { x: W / 2, y: H - 12, textAnchor: 'middle' }, 'Ventaja competitiva →'),
        h('text', { x: 14, y: H / 2, textAnchor: 'middle', transform: 'rotate(-90 14 ' + H / 2 + ')' }, 'Lo que paga el mercado →')));

    const decisiones = D.decisiones.map((d) => h('div', {
      className: 'km-diag', key: d.n, style: { '--k-g': d.impacto === 'alto' ? C.fuchsia : C.blue },
    },
      h('h4', null, d.n + '. ' + d.decision),
      h('p', null, h('b', null, 'Oferta. '), d.oferta),
      h('p', null, h('b', null, 'Demanda. '), d.demanda),
      h('p', { style: { color: 'var(--k-tx)' } }, h('b', null, 'Qué hacer. '), d.hacer)));

    const totalSuite = oferta.aLaCarta || 1;
    const concentracion = oferta.modulos.slice()
      .sort((a, b) => b.sugerido - a.sugerido).slice(0, 12)
      .map((m) => ({ label: m.app, valor: m.sugerido / totalSuite }));

    return h('div', { className: 'km-vista km-fade' },
      h('div', { className: 'km-g2' },
        card('Dónde está parado KIMOS', C.green,
          'Evaluación por dimensión, de 0 a 10, según la posición competitiva que muestra este estudio.',
          h('div', null, scores)),
        card('Concentración del valor', C.cyan,
          'Qué porcentaje del precio total de la suite aporta cada módulo. Muestra de qué depende realmente el ingreso.',
          barrasSimples(concentracion, (i) => PAL[i % PAL.length], (v) => pct(v, 1))),
        ),
      card('Sugerencias y mejoras', C.fuchsia,
        'Ocho movimientos concretos que salen de cruzar los precios de la competencia con la demanda.',
        h('div', { className: 'km-col' }, D.visual.sugerencias.map((s) => tarjetaDiag(s, vals)))),
      card('Las ocho decisiones del estudio', C.violet,
        'Cada una con el dato de oferta y el de demanda que la sostienen. Si un dato cambia, la decisión se revisa.',
        h('div', { className: 'km-g2' }, decisiones)),
      card('Matriz de cartera', C.cyan,
        'Horizontal: la ventaja competitiva de cada línea (0 a 10). Vertical: lo que paga el mercado, en escala de raíz. El corte vertical está en 5,5 y el horizontal en la mediana de la cartera (' + usd(oferta.medianaCartera) + ').',
        matriz),
      card('Conclusión', C.orange, null,
        h('div', { className: 'km-col' }, D.visual.conclusiones.map((c) => tarjetaDiag(c, vals)))),
      card('Advertencias metodológicas', C.amber,
        'Lo que este estudio no prueba. Leerlo antes de anclar un precio.',
        h('ol', { className: 'km-hint', style: { paddingLeft: '18px', lineHeight: 1.9 } },
          D.notas.map((n, i) => h('li', { key: i }, n.replace(/^\d+\.\s*/, ''))))));
  }

  /* -------------------------------- render ------------------------------- */

  function Component() {
    const [st, setSt] = React.useState(estado);
    React.useEffect(() => {
      oyentes.add(setSt);
      return () => { oyentes.delete(setSt); };
    }, []);

    setLocale(st.tema);
    const oferta = React.useMemo(() => calcularOferta(D, st.sup, st.desc, st.precios), [st.sup, st.desc, st.precios, st.rev]);
    const demanda = React.useMemo(() => calcularDemanda(D, st.sup, st.alcance, oferta, st.mix), [st.sup, st.alcance, st.mix, oferta, st.rev]);

    const ent = oferta.planes[oferta.planes.length - 1] || oferta.planCero;
    const banda = oferta.ratioStack > 0.60 ? C.red : oferta.ratioStack < 0.25 ? C.amber : C.green;
    // Un estudio recién creado no tiene con qué afirmar bandas ni ahorros.
    const vacio = !D.competidores.length;
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
      : st.tab === 'estudio' ? vistaEstudio()
      : vistaResumen(oferta, demanda);

    const temaActual = TEMAS.filter((t) => t[0] === st.tema)[0] || TEMAS[0];

    const menuTema = h('div', { className: 'km-menu-wrap' },
      h('button', {
        className: 'km-btn' + (st.menuTema ? ' pri' : ''),
        title: 'Elige cómo se ve el tablero',
        onClick: () => commit({ menuTema: !st.menuTema }),
      }, temaActual[2] + ' ' + temaActual[1]),
      st.menuTema ? h('div', { className: 'km-menu' }, TEMAS.map(([id, label, ico, desc]) => h('button', {
        key: id, className: st.tema === id ? 'on' : '',
        onClick: () => commit({ tema: id, menuTema: false }),
      }, h('span', null, ico), h('span', null, label, h('small', null, desc))))) : null);

    const cabecera = h('header', { className: 'km-head' },
      h('div', { className: 'km-brand' },
        h('div', { className: 'km-logo' }, h('span', null, 'K')),
        h('div', null,
          h('h1', { className: 'km-tit' },
            (D.meta.empresa ? D.meta.empresa + ' · ' : '') + (D.meta.titulo || 'Estudio de Mercado y Modelo de Precios'),
            h('span', { className: 'km-ver', title: 'Estudio de Mercado v' + APP_VERSION }, 'v' + APP_VERSION)),
          h('div', { className: 'km-sub' }, D.modulos.length + ' ' + (D.meta.unidadNegocio || 'líneas') + ' · '
            + D.competidores.length + ' planes de competencia analizados · precios de lista '
            + (D.meta.moneda || 'USD') + ' · levantado el ' + (D.meta.fecha || 'sin fecha') + ' · ',
            h('span', { className: 'km-chip-alc', title: 'Alcance del análisis de demanda' }, alcanceTxt)))),
      h('div', { className: 'km-tools' },
        h('button', {
          className: 'km-btn', title: 'Vuelve a los supuestos, precios y descuentos del estudio',
          onClick: () => commit({
            sup: supBase(D), desc: descBase(D),
            mix: mixBase(D), precios: {}, cfg: { mods: [], desc: 0.5 },
          }),
        }, '↺ Restablecer'),
        h('button', { className: 'km-btn', onClick: () => exportar(oferta, demanda), title: 'Exporta a CSV la pestaña actual' }, '⭳ Exportar datos'),
        menuTema,
        h('button', {
          className: 'km-btn pri', title: 'Imprime el tablero o lo guarda como PDF',
          onClick: () => { try { window.print(); } catch (e) { /* sin soporte de impresión */ } },
        }, '⎙ Imprimir / PDF')));

    const kpis = h('div', { className: 'km-kpis' },
      kpi('Gasto actual del cliente', usd(oferta.stackTotal), usd1(oferta.stackPorUsuario) + ' por usuario/mes', C.orange),
      kpi(emp() + ' · ' + ent.nombre, usd(ent.mensual), usd1(ent.porUsuario) + ' por usuario/mes', C.violet),
      kpi(emp() + ' vs. gasto actual', vacio ? '—' : pct(oferta.ratioStack, 0),
        vacio ? 'Sin precios levantados todavía'
          : oferta.ratioStack > 0.6 ? 'Sobre la banda sana'
            : oferta.ratioStack < 0.25 ? 'Bajo la banda sana' : 'Dentro de la banda sana', vacio ? C.violet : banda),
      kpi('Ahorro anual del cliente', vacio ? '—' : usd(oferta.ahorroAnualStack),
        vacio ? 'Sin precios levantados todavía' : 'Argumento central de venta', C.cyan),
      kpi('Precios verificados', oferta.verificados + '/' + D.competidores.length,
        vacio ? 'Empieza por la pestaña Este estudio' : 'El resto requiere validación', C.fuchsia));

    const navTabs = h('nav', { className: 'km-tabs-box' }, TABS.map(([id, label, ico]) => h('button', {
      key: id, className: 'km-tab' + (st.tab === id ? ' on' : ''),
      onClick: () => commit({ tab: id, menuTema: false }),
    }, h('span', { className: 'km-tab-i' }, ico), label)));

    return h('div', { className: 'kimos-mercado km-' + st.tema },
      h('div', { className: 'km-scroll' },
        h('div', { className: 'km-wrap' }, cabecera, kpis, navTabs, cuerpo)));
  }

  /* -------------------------------- agente -------------------------------- */

  let desregistrar = null;
  const CLAVES_SUP = Object.keys(supBase(D));

  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    desregistrar = shell.agent.register({
      label: 'Estudio de Mercado',
      description: 'Estudio de mercado competitivo y modelo de precios. Trae hecho el de KIMOS —precio sugerido por línea contra la competencia, planes, configurador, mercado por país y economía por cliente— y sirve para hacer el de cualquier otra empresa: NUEVO_ESTUDIO arranca con la estructura del rubro, PROTOCOLO dice el método y qué falta, y AGREGAR_LINEA y AGREGAR_COMPETIDOR cargan la investigación con su fuente. El agente también mueve supuestos, edita precios, cotiza y lee todo lo que se recalcula.',
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
            properties: { plan: { type: 'string', enum: Object.keys(descBase(D)) }, descuento: { type: 'number' } },
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
            properties: { app: { type: 'string', enum: D.modulos.map((m) => m.app) } },
            required: ['app'],
          },
        },
        {
          name: 'SET_TEMA',
          description: 'Cambia el modo visual del tablero: dash (estética del dashboard del estudio), estudio (compacto) o host (sigue el tema del escritorio de KIMOS).',
          inputSchema: {
            type: 'object',
            properties: { tema: { type: 'string', enum: ['dash', 'estudio', 'host'] } },
            required: ['tema'],
          },
        },
        {
          name: 'RESTAURAR_SUPUESTOS',
          description: 'Vuelve a los supuestos, descuentos, precios y cotización con los que se levantó el estudio.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'PROTOCOLO',
          description: 'Devuelve el método con el que se hace un estudio de mercado en esta app, las fuentes que sirven en el rubro del estudio en curso y la lista de lo que a este estudio todavía le falta. Léelo antes de investigar.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'NUEVO_ESTUDIO',
          description: 'Empieza el estudio de otra empresa con la estructura de su rubro. No carga ningún precio: deja el esqueleto listo para investigar. Reemplaza el estudio de esta ventana.',
          inputSchema: {
            type: 'object',
            properties: {
              plantilla: { type: 'string', enum: PLANTILLAS.map((x) => x.id) },
              empresa: { type: 'string' },
              rubro: { type: 'string' },
            },
            required: ['plantilla'],
          },
        },
        {
          name: 'SET_IDENTIDAD',
          description: 'Declara de quién es el estudio: empresa, rubro, moneda, fecha del levantamiento, autor y título.',
          inputSchema: {
            type: 'object',
            properties: {
              empresa: { type: 'string' }, rubro: { type: 'string' }, moneda: { type: 'string' },
              fecha: { type: 'string', description: 'AAAA-MM-DD' }, autor: { type: 'string' }, titulo: { type: 'string' },
            },
          },
        },
        {
          name: 'AGREGAR_LINEA',
          description: 'Añade una línea de producto o servicio al estudio, con la categoría de mercado contra la que compite.',
          inputSchema: {
            type: 'object',
            properties: {
              app: { type: 'string', description: 'Nombre de la línea' },
              cat: { type: 'string', description: 'Categoría de mercado' },
              alt: { type: 'string', description: 'Competidores de referencia, separados por coma' },
              que: { type: 'string' },
              ventaja: { type: 'number', description: 'Qué tan bien compite la empresa ahí, de 0 a 10' },
            },
            required: ['app'],
          },
        },
        {
          name: 'AGREGAR_COMPETIDOR',
          description: 'Carga un precio de la competencia en una línea del estudio. La fuente es obligatoria: sin fuente la fila no entra. Marca "Verificado" solo si el precio está publicado por el propio proveedor; si viene de un tercero que reporta contratos, marca "Estimado" y pon el rango completo en la nota.',
          inputSchema: {
            type: 'object',
            properties: {
              app: { type: 'string', description: 'Línea del estudio a la que pertenece' },
              comp: { type: 'string', description: 'Competidor' },
              plan: { type: 'string', description: 'Nombre del plan o producto' },
              precio: { type: 'number', description: 'Precio de lista mensual' },
              unidad: { type: 'string', enum: ['Plano', 'Por usuario', 'Por canal'] },
              seg: { type: 'string', enum: ['PyME / Empresa', 'Enterprise'] },
              fuente: { type: 'string', description: 'URL o documento donde está el precio' },
              conf: { type: 'string', enum: ['Verificado', 'Estimado'] },
              nota: { type: 'string' },
            },
            required: ['app', 'comp', 'plan', 'precio', 'unidad', 'seg', 'fuente', 'conf'],
          },
        },
        {
          name: 'ELIMINAR_COMPETIDOR',
          description: 'Quita un precio mal levantado, por competidor y plan.',
          inputSchema: {
            type: 'object',
            properties: { comp: { type: 'string' }, plan: { type: 'string' } },
            required: ['comp', 'plan'],
          },
        },
        {
          name: 'EXPORTAR_ESTUDIO',
          description: 'Descarga el estudio en curso como archivo JSON y devuelve su resumen. Con incluirDocumento devuelve además el estudio entero, que puede ser grande.',
          inputSchema: {
            type: 'object',
            properties: { incluirDocumento: { type: 'boolean' } },
          },
        },
        {
          name: 'IMPORTAR_ESTUDIO',
          description: 'Carga un estudio completo desde un JSON (objeto o texto). Reemplaza el estudio de esta ventana.',
          inputSchema: {
            type: 'object',
            properties: { documento: { description: 'El estudio, como objeto o como texto JSON' } },
            required: ['documento'],
          },
        },
      ],
      getSnapshot: () => {
        // Se recalcula al vuelo desde el estado actual: si dependiera del
        // último render, el agente leería cifras viejas tras cambiar supuestos.
        const of = calcularOferta(D, estado.sup, estado.desc, estado.precios);
        const dem = calcularDemanda(D, estado.sup, estado.alcance, of, estado.mix);
        const selCfg = estado.cfg.mods.filter((a) => of.byApp.has(a));
        const sumaCfg = selCfg.reduce((a, app) => a + of.byApp.get(app).sugerido, 0);
        return {
          version: APP_VERSION,
          levantamiento: D.meta.fecha,
          estudio: {
            empresa: D.meta.empresa || null,
            rubro: D.meta.rubro || null,
            moneda: D.meta.moneda,
            autor: D.meta.autor || null,
            plantilla: D.meta.plantilla || null,
            esSemillaKimos: !estado.propio,
            edadMeses: edadMeses(),
            lineas: D.modulos.map((m) => m.app),
            preciosPorLinea: D.modulos.map((m) => ({
              linea: m.app, categoria: m.cat,
              precios: D.competidores.filter((c) => c.app === m.app).length,
            })),
            faltan: huecos(),
          },
          pestana: estado.tab,
          tema: estado.tema,
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
            preciosVerificados: of.verificados + '/' + D.competidores.length,
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
          diagnostico: D.visual.scores.map((s) => ({ dimension: s.dim, nota: s.nota })),
          decisiones: D.decisiones.map((d) => ({ n: d.n, decision: d.decision, hacer: d.hacer, impacto: d.impacto })),
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
            if (!(p.plan in descBase(D))) return { success: false, error: 'Plan desconocido: ' + p.plan };
            const v = Number(p.descuento);
            if (!isFinite(v) || v < 0 || v > 0.95) return { success: false, error: 'El descuento debe ir entre 0 y 0,95' };
            setDesc(p.plan, v);
            return { success: true, message: p.plan + ' con ' + Math.round(v * 100) + '% de descuento' };
          }
          if (t === 'SET_PRECIO_COMPETIDOR') {
            const v = Number(p.precio);
            if (!isFinite(v) || v < 0) return { success: false, error: 'Precio inválido' };
            const i = D.competidores.findIndex((c) => c.comp === p.competidor && c.plan === p.plan);
            if (i < 0) return { success: false, error: 'No existe el plan ' + p.plan + ' de ' + p.competidor };
            setPrecio(i, v);
            return { success: true, message: p.competidor + ' ' + p.plan + ' = ' + usd1(v) + '/mes' };
          }
          if (t === 'COTIZAR') {
            const validos = (Array.isArray(p.modulos) ? p.modulos : []).filter((a) => D.modulos.some((m) => m.app === a));
            if (!validos.length) return { success: false, error: 'Ningún módulo válido. Usa los nombres exactos de las apps.' };
            const d = Number(p.descuento);
            const cfg = { mods: validos, desc: isFinite(d) && d >= 0 && d <= 0.95 ? d : estado.cfg.desc };
            commit({ tab: 'configurador', cfg: cfg });
            const of = calcularOferta(D, estado.sup, estado.desc, estado.precios);
            const suma = validos.reduce((a, app) => a + of.byApp.get(app).sugerido, 0);
            return { success: true, message: validos.length + ' módulos · ' + usd(Math.round(suma * (1 - cfg.desc))) + '/mes' };
          }
          if (t === 'SET_ALCANCE') {
            const a = { region: '', idioma: '', prioridad: '', pais: '' };
            ['region', 'idioma', 'prioridad', 'pais'].forEach((k) => {
              if (typeof p[k] === 'string') a[k] = p[k];
            });
            if (a.pais && !D.demanda.paises.some((x) => x.pais === a.pais)) {
              return { success: false, error: 'País desconocido: ' + a.pais };
            }
            if (a.pais) { a.region = ''; a.idioma = ''; a.prioridad = ''; }
            const n = paisesEnAlcance(D, a).length;
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
            const m = D.modulos.filter((x) => x.app === p.app)[0];
            if (!m) return { success: false, error: 'Módulo desconocido: ' + p.app };
            commit({ tab: 'mapa', modSel: m.n });
            return { success: true, message: 'Detalle de ' + m.app };
          }
          if (t === 'SET_TEMA') {
            if (!TEMAS.some((x) => x[0] === p.tema)) return { success: false, error: 'Modo desconocido: ' + p.tema };
            commit({ tema: p.tema, menuTema: false });
            return { success: true, message: 'Modo ' + p.tema };
          }
          if (t === 'RESTAURAR_SUPUESTOS') {
            commit({
              sup: supBase(D), desc: descBase(D),
              mix: mixBase(D), precios: {}, cfg: { mods: [], desc: 0.5 },
            });
            return { success: true, message: 'Supuestos del estudio restaurados' };
          }
          if (t === 'PROTOCOLO') {
            const plant = PLANTILLAS.filter((x) => x.id === D.meta.plantilla)[0];
            return {
              success: true,
              message: 'Protocolo del estudio en ' + PROTOCOLO.length + ' pasos',
              data: {
                pasos: PROTOCOLO.map((x) => ({ n: x.n, titulo: x.titulo, texto: x.texto })),
                fuentesDelRubro: plant ? plant.fuentes : [],
                rubro: D.meta.rubro || null,
                reglaDeOro: 'Un precio sin fuente no entra. Verificado es solo el precio publicado por el propio proveedor; todo lo demás es Estimado y lleva el rango en la nota.',
                faltan: huecos(),
              },
            };
          }
          if (t === 'NUEVO_ESTUDIO') {
            if (!PLANTILLAS.some((x) => x.id === p.plantilla)) {
              return { success: false, error: 'Plantilla desconocida. Usa: ' + PLANTILLAS.map((x) => x.id).join(', ') };
            }
            nuevoEstudio(p.plantilla, p.empresa || '');
            if (p.rubro) setMeta('rubro', p.rubro);
            return {
              success: true,
              message: 'Estudio nuevo de ' + (p.empresa || 'empresa sin nombre') + ' con la plantilla ' + p.plantilla
                + '. Tiene ' + D.modulos.length + ' líneas y ningún precio: toca investigarlos y cargarlos con AGREGAR_COMPETIDOR.',
              data: { lineas: D.modulos.map((m) => ({ linea: m.app, categoria: m.cat, referencias: m.alt })) },
            };
          }
          if (t === 'SET_IDENTIDAD') {
            const campos = ['empresa', 'rubro', 'moneda', 'fecha', 'autor', 'titulo'];
            const puestos = campos.filter((k) => typeof p[k] === 'string' && p[k] !== '');
            if (!puestos.length) return { success: false, error: 'No hay nada que cambiar. Campos: ' + campos.join(', ') };
            if (p.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) return { success: false, error: 'La fecha va como AAAA-MM-DD' };
            puestos.forEach((k) => setMeta(k, p[k]));
            return { success: true, message: 'Identidad actualizada: ' + puestos.join(', ') };
          }
          if (t === 'AGREGAR_LINEA') {
            const err = agregarLinea(p);
            if (err) return { success: false, error: err };
            return { success: true, message: 'Línea "' + p.app + '" añadida. Ahora cárgale precios con AGREGAR_COMPETIDOR.' };
          }
          if (t === 'AGREGAR_COMPETIDOR') {
            const err = agregarCompetidor(p);
            if (err) return { success: false, error: err };
            const of = calcularOferta(D, estado.sup, estado.desc, estado.precios);
            const m = of.byApp.get(p.app);
            return {
              success: true,
              message: p.comp + ' · ' + p.plan + ' cargado en ' + p.app + '.',
              data: m ? { linea: m.app, precios: m.planes, mediana: Math.round(m.med), sugerido: m.sugerido } : null,
            };
          }
          if (t === 'ELIMINAR_COMPETIDOR') {
            const i = D.competidores.findIndex((c) => c.comp === p.comp && c.plan === p.plan);
            if (i < 0) return { success: false, error: 'No existe el plan ' + p.plan + ' de ' + p.comp };
            borrarCompetidor(i);
            return { success: true, message: 'Quitado ' + p.comp + ' · ' + p.plan };
          }
          if (t === 'EXPORTAR_ESTUDIO') {
            exportarEstudio();
            const resumen = {
              empresa: D.meta.empresa || null, rubro: D.meta.rubro || null, fecha: D.meta.fecha,
              lineas: D.modulos.length, precios: D.competidores.length,
              verificados: D.competidores.filter((c) => c.conf === 'Verificado').length,
            };
            if (p.incluirDocumento) resumen.documento = clon(D);
            return { success: true, message: 'Estudio exportado como JSON', data: resumen };
          }
          if (t === 'IMPORTAR_ESTUDIO') {
            const doc = typeof p.documento === 'string' ? p.documento : JSON.stringify(p.documento);
            const err = importarEstudio(doc);
            if (err) return { success: false, error: err };
            return {
              success: true,
              message: 'Estudio importado: ' + (D.meta.empresa || 'sin nombre') + ' · ' + D.modulos.length
                + ' líneas · ' + D.competidores.length + ' precios',
            };
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
