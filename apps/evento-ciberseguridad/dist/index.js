/**
 * Anfitrión del Desayuno Ejecutivo de Ciberseguridad 2026 — app de KIMOS.
 *
 * Pensada para un TOTEM (pantalla vertical táctil) en el hall del evento: una
 * persona se acerca, mira qué está pasando ahora, consulta agenda, expositores
 * y marco legal, se lleva lo que necesita escaneando un QR, y deja su pregunta
 * para el panel. Al minuto y medio sin tocar vuelve sola al inicio.
 *
 * FUENTES DEL CONTENIDO (nada inventado):
 *  - Cronograma, expositores, patrocinadores y landing: correo de José Gaete
 *    Sotomayor (CRO de NextTime Software) del 16-ago-2026, reenviado por José
 *    Ignacio Canales.
 *  - Sede, fecha y textos de convocatoria: campaña Mailchimp b93cf0460e.
 *  - Fichas de expositores y de las leyes 21.663 / 21.719: búsqueda web; cada
 *    ficha declara su origen en `fuente`. Donde no hubo dato verificable NO se
 *    inventó cargo ni biografía.
 *
 * El totem es un dispositivo COMPARTIDO, así que aquí no hay estado personal:
 * lo que se guarda es colectivo (preguntas al panel y encuesta de interés) y lo
 * transitorio (la consulta guiada a medio responder) se borra al volver al
 * inicio por inactividad.
 */

// Mantener en sincronía con manifest.json y con el catálogo raíz /manifest.json.
const APP_VERSION = '2.0.0';

/* ── Marca y evento ───────────────────────────────────────────────────── */

const MARCA = {
  nombre: 'NextTime Software',
  sitio: 'https://nexttimesoftware.com/',
  direccion: 'Av. Apoquindo 6410 Of. 214, Las Condes, Santiago de Chile',
  // Perfil público de la compañía (RocketReach / ZoomInfo, ago-2026).
  descripcion: 'Compañía chilena de tecnología con más de 17 años de trayectoria, '
    + 'enfocada en la aceleración digital y la automatización de procesos de negocio '
    + 'mediante soluciones cloud.',
};

const EVENTO = {
  ciclo: 'Ciclo de Eventos',
  titulo: 'Desayuno Ejecutivo de Ciberseguridad 2026',
  tituloLargo: 'Adopta Ciberseguridad: prepárate para Protección de Datos y Delitos Informáticos',
  // Martes 18 de agosto de 2026, 08:30–11:30 en Santiago de Chile. Agosto va
  // antes del cambio de hora de septiembre, así que el offset es UTC-4.
  inicioISO: '2026-08-18T08:30:00-04:00',
  finISO: '2026-08-18T11:30:00-04:00',
  fechaTexto: 'Martes 18 de agosto de 2026',
  horarioTexto: '08:30 a 11:30 hrs',
  sede: 'Hotel DoubleTree by Hilton',
  direccion: 'Av. Vitacura 2727, Las Condes',
  audiencia: 'Ejecutivos y líderes de negocio, tecnología, seguridad y cumplimiento.',
  landing: 'https://nexttimesoftware.com/landing-desayuno-ciberseguridad-2026/',
  agendaIcs: 'https://nexttimesoftware.com/wp-content/uploads/2026/07/Desayuno-Ejecutivo_-Adopta-Ciberseguridad-preparate-para-Proteccion-de-Datos-y-Delitos-Informaticos.ics',
};

const PATROCINADORES = [
  {
    id: 'microsoft',
    nombre: 'Microsoft',
    nota: 'Las soluciones de ciberseguridad de Microsoft son el eje de la sesión de las 09:30, '
      + 'sobre cómo apoyan el cumplimiento de la Ley Marco 21.663.',
  },
  {
    id: 'nexsys',
    nombre: 'Nexsys',
    // Perfil público (nexsysla.com, ago-2026).
    nota: 'Mayorista de valor agregado de tecnología, software y hardware en Latinoamérica. '
      + 'Fundado en 1988, opera en doce países de la región y en Chile tiene sede en Las Condes.',
  },
];

const ORGS = {
  nexttime: { nombre: 'NextTime Software', qr: 'nexttime', url: MARCA.sitio },
  nexoabogados: { nombre: 'Nexo Abogados', qr: 'nexoabogados', url: 'https://www.nexoabogados.cl/abogados/delitos-informaticos' },
  customertrigger: { nombre: 'CustomerTrigger', qr: 'customertrigger', url: 'https://customertrigger.com/' },
  lineage: { nombre: 'Lineage', qr: 'lineage', url: 'https://lineageplatform.com/' },
};

/* ── Expositores ──────────────────────────────────────────────────────
 * `bio` solo contiene lo que se pudo verificar. Cuando no hubo fuente, el
 * campo queda vacío y la ficha lo dice, en vez de rellenarlo a ojo.
 */
const SPEAKERS = [
  {
    id: 'lilian-jimenez',
    nombre: 'Lilian Jiménez',
    nombreLargo: 'Lilian Mercedes Jiménez Orellana',
    rol: 'Abogada experta en Ciberseguridad',
    org: 'nexoabogados',
    qr: 'lilian-jimenez',
    url: 'https://www.nexoabogados.cl/abogado/lilian-jimenez-9410',
    bio: 'Abogada especializada en ciberseguridad y delitos informáticos. Diplomada en '
      + 'Ciberseguridad por la Universidad de Chile (2024), con formación en los aspectos '
      + 'técnicos, legales y éticos de la protección de datos, los delitos informáticos, la '
      + 'gestión de riesgos y la normativa nacional e internacional. Ha cursado además '
      + 'formación en Derecho e Inteligencia Artificial.',
    fuente: 'Perfil público en NexoAbogados',
    foto: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/c8809572-aa4b-e9c0-2a06-69d1ef3cfb9a.png?dpr=2&rect=0%2C0%2C800%2C800&w=160&h=160',
  },
  {
    id: 'jose-gaete',
    nombre: 'José Gaete',
    nombreLargo: 'José Ignacio Gaete Sotomayor',
    rol: 'CRO — Chief Revenue Officer',
    org: 'nexttime',
    qr: 'jose-gaete',
    url: 'https://www.linkedin.com/in/joseignaciogaetesotomayor/',
    bio: 'Chief Revenue Officer de NextTime Software, donde lidera el área de Alianzas y '
      + 'Partners. Su foco es la estrategia comercial y de alianzas en el ámbito de la '
      + 'transformación digital.',
    fuente: 'Perfil profesional público y firma corporativa',
    foto: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/c8aac23a-b6e8-841b-be88-0494e38a6f81.jpeg?dpr=2&rect=0%2C351%2C576%2C576&w=160&h=160',
  },
  {
    id: 'cristian-maulen',
    nombre: 'Cristián Maulén',
    nombreLargo: 'Cristián Maulén',
    rol: 'Socio Principal · «Artesano de Datos»',
    org: 'customertrigger',
    qr: 'cristian-maulen',
    url: 'https://www.linkedin.com/in/cristianmaulen/',
    bio: 'Socio Principal de CustomerTrigger, compañía que apoya decisiones basadas en datos '
      + 'con tecnologías de interacción e inteligencia artificial. Autor del libro «Huella '
      + 'Digital», profesor y conferencista, académico de la Universidad de Chile y director '
      + 'de InsightLab. Fue presidente de la AMDD.',
    fuente: 'Perfil profesional público',
    foto: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/d1afd5ee-7e88-1d91-7ab0-be169db9daf1.jpg?dpr=2&rect=280%2C0%2C719%2C720&w=160&h=160',
  },
  {
    id: 'bernardo-donoso',
    nombre: 'Bernardo Donoso',
    nombreLargo: 'Bernardo Donoso Brión',
    rol: 'Expositor',
    org: 'lineage',
    qr: 'bernardo-donoso',
    url: 'https://www.linkedin.com/in/bernardo-donoso-bri%C3%B3n-73108b239/',
    bio: '',
    fuente: '',
    foto: '',
  },
  {
    id: 'leonardo-jadue',
    nombre: 'Leonardo Jadue',
    nombreLargo: 'Leonardo Jadue Cassis',
    rol: 'Director Comercial',
    org: 'lineage',
    qr: 'leonardo-jadue',
    url: 'https://www.linkedin.com/in/leonardo-jadue-cassis-3653ba4/',
    bio: 'Director Comercial. En la convocatoria del evento figura vinculado a XGoldIT, y en '
      + 'el cronograma expone la sesión de Lineage sobre la Ley 21.719.',
    fuente: 'Convocatoria del evento y perfil profesional público',
    foto: 'https://mcusercontent.com/39df1d5ab0cecee961f84c7a5/images/b3e96510-ee49-3da4-3743-58361d346cf2.png',
  },
];

/* ── Cronograma ───────────────────────────────────────────────────────── */

const AGENDA = [
  {
    id: 'bienvenida', ini: '08:30', fin: '09:00',
    tema: 'Bienvenida y Networking',
    porTexto: 'NextTime Software', speakers: [], orgs: ['nexttime'], leyes: [],
  },
  {
    id: 'contexto-legal', ini: '09:00', fin: '09:30',
    tema: 'Contexto actual de las leyes de Ciberseguridad, Delitos Informáticos y Protección de Datos',
    porTexto: '', speakers: ['lilian-jimenez'], orgs: ['nexoabogados'], leyes: ['21663', '21719'],
  },
  {
    id: 'microsoft-21663', ini: '09:30', fin: '10:00',
    tema: 'Microsoft para la Ciberseguridad y Ley 21.663',
    porTexto: '', speakers: ['jose-gaete'], orgs: ['nexttime'], leyes: ['21663'],
  },
  {
    id: 'gobernanza', ini: '10:00', fin: '10:30',
    tema: 'Gobernanza de Datos',
    porTexto: '', speakers: ['cristian-maulen'], orgs: ['customertrigger'], leyes: [],
  },
  {
    id: 'lineage', ini: '10:30', fin: '11:00',
    tema: 'Lineage para Protección de Datos y cumplimiento de la Ley 21.719',
    porTexto: '', speakers: ['bernardo-donoso', 'leonardo-jadue'], orgs: ['lineage'], leyes: ['21719'],
  },
  {
    id: 'cierre', ini: '11:00', fin: '11:30',
    tema: 'Networking y cierre',
    porTexto: 'Todos los asistentes', speakers: [], orgs: [], leyes: [],
  },
];

/* ── Marco legal ──────────────────────────────────────────────────────
 * Resumen informativo con fuentes públicas; la app lo declara como tal y no
 * como asesoría legal.
 */
const LEYES = [
  {
    id: '21663',
    numero: 'Ley 21.663',
    nombre: 'Ley Marco de Ciberseguridad',
    resumen: 'Establece obligaciones de gobernanza, gestión de riesgos y reporte de incidentes '
      + 'para los organismos del Estado y para los operadores privados de servicios esenciales.',
    datos: [
      { k: 'Promulgada', v: 'Abril de 2024' },
      { k: 'Vigencia', v: 'Artículos clave desde el 1 de marzo de 2025' },
      { k: 'Fiscaliza', v: 'ANCI — Agencia Nacional de Ciberseguridad' },
    ],
    puntos: [
      'Crea la Agencia Nacional de Ciberseguridad (ANCI), que califica a los Operadores de '
        + 'Importancia Vital, recibe los reportes de incidentes y aplica el régimen sancionatorio.',
      'Reporte de incidentes al CSIRT Nacional: alerta temprana en 3 horas, reporte completo en '
        + '72 horas y reporte final tras la contención.',
      'Exige controles de seguridad, gestión de riesgos y planes de respuesta ante incidentes.',
      'Obliga a designar un Delegado de Ciberseguridad, responsable ante la ANCI de coordinar '
        + 'la respuesta y los reportes.',
      'Monitoreo continuo y registro de eventos, para detectar anomalías y conservar evidencia.',
      'Alcanza con especial fuerza a energía, agua, salud, finanzas, telecomunicaciones y transporte.',
    ],
    sesion: 'microsoft-21663',
  },
  {
    id: '21719',
    numero: 'Ley 21.719',
    nombre: 'Protección de Datos Personales',
    resumen: 'Reemplaza la normativa de 1999 y acerca a Chile a estándares internacionales como '
      + 'el RGPD europeo, con una agencia propia y un régimen de sanciones.',
    datos: [
      { k: 'Publicada', v: '13 de diciembre de 2024' },
      { k: 'Entra en vigencia', v: '1 de diciembre de 2026' },
      { k: 'Fiscaliza', v: 'APDP — Agencia de Protección de Datos Personales' },
    ],
    puntos: [
      'Crea la Agencia de Protección de Datos Personales (APDP), corporación autónoma de derecho '
        + 'público que puede investigar de oficio, multar, ordenar la suspensión de tratamientos y '
        + 'publicar un Registro Nacional de Sanciones.',
      'Derechos ARCO completos para las personas: acceso, rectificación, cancelación y oposición.',
      'Notificación de brechas de seguridad en 72 horas.',
      'Multas de hasta 20.000 UTM, que pueden llegar al 4% de los ingresos en caso de reincidencia.',
      'El plazo hasta diciembre de 2026 existe para adecuar procesos, políticas, contratos y '
        + 'sistemas antes de que la norma sea plenamente exigible.',
    ],
    sesion: 'lineage',
  },
];

/* ── Consulta guiada (el «anfitrión consultivo») ──────────────────────── */

const CONSULTA = [
  {
    id: 'rol',
    pregunta: '¿Desde dónde llegas al desayuno?',
    opciones: [
      { id: 'direccion', ico: '🎯', label: 'Dirección o negocio' },
      { id: 'ti', ico: '🛡️', label: 'TI o Seguridad' },
      { id: 'legal', ico: '⚖️', label: 'Legal o Cumplimiento' },
      { id: 'datos', ico: '📊', label: 'Datos o Analítica' },
    ],
  },
  {
    id: 'foco',
    pregunta: '¿Qué te gustaría resolver hoy?',
    opciones: [
      { id: 'ley21663', ico: '🏛️', label: 'Cumplir la Ley Marco 21.663' },
      { id: 'ley21719', ico: '🔐', label: 'Prepararme para la Ley 21.719' },
      { id: 'gobernanza', ico: '🧭', label: 'Ordenar y gobernar mis datos' },
      { id: 'partir', ico: '🚦', label: 'Saber por dónde partir' },
    ],
  },
];

/* Recomendaciones: qué sesiones y con quién conversar según la respuesta. */
const RECOMENDACIONES = {
  ley21663: { sesiones: ['contexto-legal', 'microsoft-21663'], leyes: ['21663'], speakers: ['lilian-jimenez', 'jose-gaete'] },
  ley21719: { sesiones: ['contexto-legal', 'lineage'], leyes: ['21719'], speakers: ['lilian-jimenez', 'leonardo-jadue', 'bernardo-donoso'] },
  gobernanza: { sesiones: ['gobernanza', 'lineage'], leyes: ['21719'], speakers: ['cristian-maulen', 'bernardo-donoso'] },
  partir: { sesiones: ['contexto-legal', 'microsoft-21663', 'gobernanza'], leyes: ['21663', '21719'], speakers: ['lilian-jimenez', 'jose-gaete'] },
};

const NOTA_ROL = {
  direccion: 'Como responsable de negocio, el ángulo más útil es el de riesgo y sanciones: qué '
    + 'expone a la organización y qué decisiones hay que tomar este año.',
  ti: 'Desde TI y Seguridad, el foco práctico está en los plazos de reporte de incidentes y en '
    + 'los controles y el monitoreo que exige la Ley Marco.',
  legal: 'Desde Legal y Cumplimiento, el eje son las obligaciones concretas de ambas leyes, los '
    + 'plazos y el régimen sancionatorio de la ANCI y de la APDP.',
  datos: 'Desde Datos y Analítica, lo aprovechable es la gobernanza: saber qué datos hay, de '
    + 'dónde vienen y quién los toca, que es la base del cumplimiento.',
};

/* ── Encuesta colectiva de interés ────────────────────────────────────── */

const TEMAS_VOTO = [
  { id: 'ley-marco', texto: 'Implicancias de la Ley Marco de Ciberseguridad' },
  { id: 'datos-personales', texto: 'Protección de datos personales y responsabilidades' },
  { id: 'incumplimiento', texto: 'Riesgos del incumplimiento normativo' },
  { id: 'resiliencia', texto: 'Estrategias de resiliencia digital' },
  { id: 'casos-practicos', texto: 'Casos prácticos y experiencias reales' },
];

const SECCIONES = [
  { id: 'ahora', ico: '📍', label: 'Ahora' },
  { id: 'agenda', ico: '🗓️', label: 'Agenda' },
  { id: 'expositores', ico: '🎙️', label: 'Expositores' },
  { id: 'leyes', ico: '⚖️', label: 'Marco legal' },
  { id: 'consulta', ico: '💬', label: 'Consulta' },
  { id: 'nexttime', ico: '🏢', label: 'NextTime' },
];

/* QR precalculados en build (tools de scratchpad, paquete `qrcode`, nivel M) y
   verificados decodificándolos con jsQR. Se embeben para que el totem no
   dependa de la red ni cargue un generador. `n` = módulos por lado, `b` = la
   matriz en bits, fila por fila, en base64. */
const QR = {
  'landing': { n: 37, b: '/lHAC/wTJV2QbrfBTrt1eofl26in2q7BTCINB/qqqq/gFY3HAL5NhOPm4tt0aY2z9DcuKDJ8YJP7PS5vqGRchIO4DorvbT9jMrCv5z7HtWh8Ckmm1JL9xjlhDE4X7oYnbjDKfoYg3DcwX2qUzNPz4vmE3r2tu1FKIuZlvi9p2j00GKMdD/8AblyUa/lGiarwXHElG7qvPt+l1nwFt66+gokDBP1OHR/pBCZPgA==' },
  'nexttime': { n: 29, b: '/sdD/BFKUG6pHrt0k8Xbox4uwWNVB/qqr+AJhwCjZbEow4b4w6Om+wHHEozh4SCogw2O6aT2NreHkGrVmgplBtnx76QySzd6D/5g/QBHJHf6ZSowQocSulW/xdBG566rJycEW3mP626kgA==' },
  'agenda': { n: 53, b: '/tEb8rIj/Bbcza/DkG6gtDbvxLt08fz9n9XbrY9vvOIuwR9xxo0xB/qqqqqqr+AJytF42wCf99L8jIy9hQruE9/blrGDUUt0+OmtTY+i/pK9J7Gq2i0aECtFLXbVHoPge/5Fsp5WvoqNTCLAyK38YY2PaSYS5bSuraZPPzF6y1J3Yo3NYbfvmmervmpHTbe5//qPze+ij0ACtsmIW8NL/91D/oKf0MROnFofRWq46Opd8rPxcq8bxNHT/u2PqIP8Sl7CGbyTcqlYTGYmKSmgAhqofOcCHisoebUgaPXJp7vOGM3VW/8hcDC8u/1O87wqW/uLy3Nq6sGDSxD2vBcaRtoId5mI/+yOH1t2lPuoKUAqgnWbMVc3gVh9N5LCwnNJ6LVVQTOlL+aN+oBFycf/nHv66e6j9WqQXmYxhpsYuuMh+kzvhdZFzdr7ga6f/rg1kbUEq0y2ZF5f7knLOJGgAA==' },
  'lilian-jimenez': { n: 33, b: '/ni5P8Es9lButtHLt1EtdduvulLsFaA1B/qqqv4BUU8AvlZDvh66fZtb++O62qKT4e9+Kr3CqesJPoonMYwZ4hj8C0tT2OK4Dvt6gsuOxKm36/VyYy3VSD2NJh+pi1VQHS7Xuyxz+ABgfMV/inDq0F8OsfutuK/d1Rvqbur3N9EESlwc/qFD0QA=' },
  'jose-gaete': { n: 33, b: '/hS9P8EDsFBuvw+Lt15fZdus05LsFj9hB/qqqv4BZjwAvl9SviQZeJtsvHC6whZT7edyAz3LKR/ZPlzpK5SrCQj8vg5S2IL1PvtBs1OWxovcr+/v6aXXY7vJJjqmISVwAgztpp9i+QBAXMV/k+jq0Frh8fuu4i/F1U7qXupxP9kELRwc/uJT0QA=' },
  'cristian-maulen': { n: 33, b: '/hq9P8Eg0lBusIeLt1AmtdurOKLsFWOtB/qqqv4BwT4Avk5TvnSSeJtbw/Cy2J2fKcGqqfzWDYsFDmlnKZxAGgrslu9D2LgbHvvk68se0JbQ4/B5g03ETq5dFr4wQx17TT7fvyJz+IBgfMX/nHDq0FutMeuuCO/N1qsqZus3P8EETgyc/vtD0QA=' },
  'bernardo-donoso': { n: 37, b: '/jqq4/wSb5LQbqLPrLt1WLXl26iTmK7BZJUJB/qqqq/gGAABAL5EL8vgLGwBGp6Sg2/eSk1OShv4bD97umN+poGeJxBve6Kf4jP3CJXqs+arVCKuuPSP/8hOOhgde/cfbkBPXIYh6dSJTzwM0jOyV8guz7bG7g8DKPWCh+cr7Q14uaykvv6AYn6MY/l3MyrwUN3hGrqWhV+t1Sl/1G6l5BoHBB57OR/vNS0NgA==' },
  'leonardo-jadue': { n: 33, b: '/nS9P8ELglBuqWeLt1FfddutETLsFV8hB/qqqv4BJj8Avn9CvgD8WpvAxngi2YZT6eb3Bb3E6n+ZHl9pKeTRtSj8IvRD2IaNHvti3doWywMU49t0ha3fTGuPNk9+IQ1CGRzdk/By+IBkXMV/mGlq0Fbh8fupBi/d1JK6busVP9EETyyU/otD0QA=' },
  'customertrigger': { n: 29, b: '/kcb/BH/UG6pSrt1psXbr5+uwVAlB/qqr+AcVwC+WMPgiLn8d6n6oRI6N6nhtBYI4P/FjCEtkZRQEvpo0Wble/1iv+BpW1ojKWc2+4Bw/H/5AWuQXlMSuuCvrdRbCy6j9P0Ebvqv6JFqAA==' },
  'lineage': { n: 29, b: '/jzz/BRfkG6Zprt0/jXbqycuwRYdB/qqr+AA2QCqW1iUJNpyb88a7iKS0CmnDOWYtscn3k85ZwTfWncDRlqkWHNuvwHmyALjq6qO+ABuzF/4z2twRN0aupsvldEYjS6qFXMETjov6imxgA==' },
  'nexoabogados': { n: 33, b: '/mC5P8Ewx1BuvsnLt1Qpdduru9rsFyBxB/qqqv4BAU8AvgZCvkC2fZtk5esy3SmT6eS/rDXFbsvJPjj3MczSyhrMAqFT2IoqDPt2nNqexq+zo/z9xS3WK+3JJhzhizUpMSzerxBi/IBKfsV/nXDq0FGCsfuu1K/d1ErqXut/N9EEIH5U/p9T0QA=' },
};

const DEFAULT_CONFIG = { acento: '#05E0CE', modo: 'auto', segundosInactividad: 90, mostrarFotos: true };
const IDS_SECCION = SECCIONES.map((s) => s.id);

/* ── Utilidades puras ─────────────────────────────────────────────────── */

const pad2 = (n) => String(n).padStart(2, '0');
const buscarSpeaker = (id) => SPEAKERS.find((s) => s.id === id) || null;
const buscarBloque = (id) => AGENDA.find((b) => b.id === id) || null;
const buscarLey = (id) => LEYES.find((l) => l.id === id) || null;

const iniciales = (nombre) => String(nombre || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** Convierte "09:30" del cronograma en un instante absoluto del día del evento. */
function instante(hhmm) {
  return new Date('2026-08-18T' + hhmm + ':00-04:00').getTime();
}

function descomponer(ms) {
  let r = Math.max(0, ms);
  const dias = Math.floor(r / 86400000); r -= dias * 86400000;
  const horas = Math.floor(r / 3600000); r -= horas * 3600000;
  const minutos = Math.floor(r / 60000); r -= minutos * 60000;
  return { dias, horas, minutos, segundos: Math.floor(r / 1000) };
}

/**
 * Dónde está el evento respecto de «ahora»: antes, en curso (con qué bloque
 * suena y cuál viene) o terminado.
 */
function estadoEvento(ahora) {
  const ini = new Date(EVENTO.inicioISO).getTime();
  const fin = new Date(EVENTO.finISO).getTime();
  if (ahora < ini) return { fase: 'antes', falta: descomponer(ini - ahora), actual: null, siguiente: AGENDA[0] };
  if (ahora >= fin) return { fase: 'despues', falta: null, actual: null, siguiente: null };
  let actual = null;
  let siguiente = null;
  for (let i = 0; i < AGENDA.length; i++) {
    const b = AGENDA[i];
    if (ahora >= instante(b.ini) && ahora < instante(b.fin)) {
      actual = b;
      siguiente = AGENDA[i + 1] || null;
      break;
    }
  }
  return { fase: 'durante', falta: null, actual, siguiente };
}

/** Estado de un bloque concreto: pasado / ahora / futuro. */
function estadoBloque(bloque, ahora) {
  if (ahora >= instante(bloque.fin)) return 'pasado';
  if (ahora >= instante(bloque.ini)) return 'ahora';
  return 'futuro';
}

/** Quién expone un bloque, en texto. */
function expositoresDe(bloque) {
  if (bloque.porTexto) return bloque.porTexto;
  const nombres = bloque.speakers.map((id) => (buscarSpeaker(id) || {}).nombre).filter(Boolean);
  const orgs = bloque.orgs.map((id) => (ORGS[id] || {}).nombre).filter(Boolean);
  const quien = nombres.join(' y ');
  return orgs.length ? (quien ? quien + ' · ' + orgs.join(', ') : orgs.join(', ')) : quien;
}

/** Base64 → bits de la matriz QR, como función de consulta (x, y). */
function matrizQR(clave) {
  const q = QR[clave];
  if (!q) return null;
  const bin = typeof atob === 'function' ? atob(q.b) : Buffer.from(q.b, 'base64').toString('binary');
  const oscuro = (x, y) => {
    const i = y * q.n + x;
    return (bin.charCodeAt(i >> 3) & (128 >> (i & 7))) !== 0;
  };
  return { n: q.n, oscuro };
}

/** Un único <path> con los módulos oscuros, agrupando cada racha horizontal. */
function pathQR(m) {
  const partes = [];
  for (let y = 0; y < m.n; y++) {
    let x = 0;
    while (x < m.n) {
      if (!m.oscuro(x, y)) { x++; continue; }
      let ancho = 1;
      while (x + ancho < m.n && m.oscuro(x + ancho, y)) ancho++;
      partes.push('M' + x + ' ' + y + 'h' + ancho + 'v1h-' + ancho + 'z');
      x += ancho;
    }
  }
  return partes.join('');
}

/** Normaliza el documento compartido (disco o agente) a algo seguro de pintar. */
function normalizar(bruto) {
  const d = bruto && typeof bruto === 'object' ? bruto : {};
  const votos = {};
  TEMAS_VOTO.forEach((t) => {
    const n = Number(d.votos && d.votos[t.id]);
    votos[t.id] = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 99999) : 0;
  });
  const preguntas = Array.isArray(d.preguntas) ? d.preguntas.slice(-300).map((p, i) => ({
    id: String((p && p.id) || 'q' + i + '-' + Math.random().toString(36).slice(2, 8)),
    texto: String((p && p.texto) || '').slice(0, 400),
    para: buscarSpeaker(p && p.para) ? p.para : null,
    ts: Number.isFinite(Number(p && p.ts)) ? Number(p.ts) : 0,
  })).filter((p) => p.texto) : [];
  return { votos, preguntas };
}

/* ── mount ────────────────────────────────────────────────────────────── */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  // Estado DENTRO de mount: una copia por ventana (regla de oro nº 2).
  let doc = normalizar(null);              // compartido: se guarda
  let vista = { seccion: 'ahora', abierta: null, consulta: {}, paso: 0 }; // transitorio
  let config = Object.assign({}, DEFAULT_CONFIG);
  const listeners = new Set();
  const emitir = () => listeners.forEach((l) => l({ doc, vista, config }));

  let guardarT = null;
  const programarGuardado = () => {
    clearTimeout(guardarT);
    guardarT = setTimeout(() => { Promise.resolve(shell.saveData(doc)).catch(() => {}); }, 600);
  };

  const commitDoc = (parcial) => {
    doc = normalizar(Object.assign({}, doc, parcial));
    emitir();
    programarGuardado();
  };
  const setVista = (parcial) => { vista = Object.assign({}, vista, parcial); emitir(); };

  /* Inactividad: en un totem, la pantalla que dejó la última persona no puede
     quedarse ahí. Se vuelve al inicio y se borra lo transitorio. */
  let inactividadT = null;
  const volverAlInicio = () => {
    vista = { seccion: 'ahora', abierta: null, consulta: {}, paso: 0 };
    emitir();
  };
  const marcarActividad = () => {
    clearTimeout(inactividadT);
    const seg = Number(config.segundosInactividad);
    const espera = Number.isFinite(seg) && seg >= 15 ? seg : DEFAULT_CONFIG.segundosInactividad;
    inactividadT = setTimeout(() => {
      if (vista.seccion !== 'ahora' || vista.abierta || vista.paso) volverAlInicio();
    }, espera * 1000);
  };

  /* Mutaciones — las mismas que usan la UI y el agente. */

  const irA = (seccion) => {
    if (!IDS_SECCION.includes(seccion)) return false;
    setVista({ seccion, abierta: null });
    marcarActividad();
    return true;
  };

  const votar = (temaId) => {
    if (!TEMAS_VOTO.some((t) => t.id === temaId)) return false;
    const votos = Object.assign({}, doc.votos);
    votos[temaId] = (votos[temaId] || 0) + 1;
    commitDoc({ votos });
    marcarActividad();
    return true;
  };

  const addPregunta = (texto, para) => {
    const limpio = String(texto || '').trim().slice(0, 400);
    if (!limpio) return null;
    const pregunta = {
      id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      texto: limpio,
      para: buscarSpeaker(para) ? para : null,
      ts: Date.now(),
    };
    commitDoc({ preguntas: doc.preguntas.concat([pregunta]) });
    marcarActividad();
    return pregunta;
  };

  const removePregunta = (id) => {
    const antes = doc.preguntas.length;
    commitDoc({ preguntas: doc.preguntas.filter((p) => p.id !== id) });
    return doc.preguntas.length < antes;
  };

  /* Carga, preferencias y ciclo de vida. */

  Promise.resolve(shell.loadData ? shell.loadData() : null)
    .then((data) => { if (data) { doc = normalizar(data); emitir(); } })
    .catch(() => {});

  const aplicarConfig = (v) => { config = Object.assign({}, DEFAULT_CONFIG, v || {}); emitir(); marcarActividad(); };
  let offConfig = null;
  if (shell.config && shell.config.get) {
    Promise.resolve(shell.config.get()).then(aplicarConfig).catch(() => {});
    if (shell.config.onChange) offConfig = shell.config.onChange(aplicarConfig);
  }

  if (shell.window && shell.window.setTitle) shell.window.setTitle(EVENTO.titulo);
  if (shell.documents) {
    if (shell.documents.onSerialize) shell.documents.onSerialize(() => ({ doc }));
    if (shell.documents.onLoad) shell.documents.onLoad((d) => { doc = normalizar(d && d.doc); emitir(); });
  }
  marcarActividad();

  /* ── Agente IA ─────────────────────────────────────────────────────── */

  let offAgent = null;
  if (shell.agent && shell.agent.register) {
    offAgent = shell.agent.register({
      label: 'Anfitrión · ' + EVENTO.titulo,
      description: 'Anfitrión del Desayuno Ejecutivo de Ciberseguridad 2026 de NextTime Software '
        + 'para el totem del evento. Responde sobre el cronograma, los expositores, las leyes '
        + '21.663 y 21.719, los patrocinadores y NextTime Software, y gestiona el tablón de '
        + 'preguntas al panel y la encuesta de interés del público.',
      tools: [
        {
          name: 'IR_A_SECCION',
          description: 'Muestra una sección del totem.',
          inputSchema: { type: 'object', properties: { seccion: { type: 'string', enum: IDS_SECCION } }, required: ['seccion'] },
        },
        {
          name: 'ADD_PREGUNTA',
          description: 'Publica una pregunta en el tablón del panel, opcionalmente dirigida a un expositor.',
          inputSchema: {
            type: 'object',
            properties: { texto: { type: 'string' }, speakerId: { type: 'string', enum: SPEAKERS.map((s) => s.id) } },
            required: ['texto'],
          },
        },
        {
          name: 'REMOVE_PREGUNTA',
          description: 'Retira una pregunta del tablón por su id (los ids vienen en el snapshot).',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        },
        {
          name: 'VOTAR_TEMA',
          description: 'Suma un voto a un tema en la encuesta de interés del público.',
          inputSchema: { type: 'object', properties: { temaId: { type: 'string', enum: TEMAS_VOTO.map((t) => t.id) } }, required: ['temaId'] },
        },
        {
          name: 'RECOMENDAR',
          description: 'Devuelve qué sesiones, expositores y leyes le convienen a un asistente '
            + 'según su rol y lo que quiere resolver. No modifica nada.',
          inputSchema: {
            type: 'object',
            properties: {
              rol: { type: 'string', enum: CONSULTA[0].opciones.map((o) => o.id) },
              foco: { type: 'string', enum: CONSULTA[1].opciones.map((o) => o.id) },
            },
            required: ['foco'],
          },
        },
        {
          name: 'VOLVER_AL_INICIO',
          description: 'Devuelve el totem a la pantalla de inicio y borra la consulta a medio responder.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      getSnapshot: () => {
        const est = estadoEvento(Date.now());
        return {
          version: APP_VERSION,
          evento: {
            titulo: EVENTO.titulo,
            tituloLargo: EVENTO.tituloLargo,
            organiza: MARCA.nombre,
            patrocinan: PATROCINADORES.map((p) => p.nombre),
            cuando: EVENTO.fechaTexto + ', ' + EVENTO.horarioTexto + ' (hora de Chile)',
            donde: EVENTO.sede + ' — ' + EVENTO.direccion,
            audiencia: EVENTO.audiencia,
            landing: EVENTO.landing,
          },
          estado: est.fase,
          faltan: est.falta,
          sesionActual: est.actual ? { id: est.actual.id, hora: est.actual.ini + '–' + est.actual.fin, tema: est.actual.tema } : null,
          sesionSiguiente: est.siguiente ? { id: est.siguiente.id, hora: est.siguiente.ini + '–' + est.siguiente.fin, tema: est.siguiente.tema } : null,
          agenda: AGENDA.map((b) => ({
            id: b.id, hora: b.ini + '–' + b.fin, tema: b.tema, expone: expositoresDe(b), leyes: b.leyes,
          })),
          expositores: SPEAKERS.map((s) => ({
            id: s.id, nombre: s.nombreLargo, rol: s.rol,
            organizacion: (ORGS[s.org] || {}).nombre, perfil: s.url,
            bio: s.bio || '(sin biografía verificada)',
          })),
          leyes: LEYES.map((l) => ({
            id: l.id, numero: l.numero, nombre: l.nombre, resumen: l.resumen,
            datos: l.datos, puntos: l.puntos,
          })),
          nextTime: MARCA,
          publico: {
            seccionVisible: vista.seccion,
            preguntas: doc.preguntas,
            encuesta: TEMAS_VOTO.map((t) => ({ id: t.id, texto: t.texto, votos: doc.votos[t.id] || 0 })),
          },
          aviso: 'El resumen de las leyes es informativo y no constituye asesoría legal.',
        };
      },
      dispatchAction: async (action) => {
        const tipo = action && action.type;
        const p = (action && action.payload) || {};
        try {
          if (tipo === 'IR_A_SECCION') {
            if (!irA(p.seccion)) return { success: false, error: 'Sección desconocida: ' + p.seccion };
            return { success: true, message: 'Mostrando "' + p.seccion + '".' };
          }
          if (tipo === 'ADD_PREGUNTA') {
            const q = addPregunta(p.texto, p.speakerId);
            if (!q) return { success: false, error: 'La pregunta viene vacía.' };
            return { success: true, message: 'Pregunta publicada (id ' + q.id + ').' };
          }
          if (tipo === 'REMOVE_PREGUNTA') {
            if (!removePregunta(String(p.id || ''))) return { success: false, error: 'No hay pregunta con id ' + p.id + '.' };
            return { success: true, message: 'Pregunta retirada.' };
          }
          if (tipo === 'VOTAR_TEMA') {
            if (!votar(p.temaId)) return { success: false, error: 'Tema desconocido: ' + p.temaId };
            return { success: true, message: 'Voto registrado en "' + p.temaId + '".' };
          }
          if (tipo === 'RECOMENDAR') {
            const rec = RECOMENDACIONES[p.foco];
            if (!rec) return { success: false, error: 'Foco desconocido: ' + p.foco };
            return {
              success: true,
              message: 'Recomendación lista.',
              data: {
                nota: NOTA_ROL[p.rol] || '',
                sesiones: rec.sesiones.map((id) => {
                  const b = buscarBloque(id);
                  return { hora: b.ini + '–' + b.fin, tema: b.tema, expone: expositoresDe(b) };
                }),
                conversarCon: rec.speakers.map((id) => {
                  const s = buscarSpeaker(id);
                  return s.nombreLargo + ' (' + (ORGS[s.org] || {}).nombre + ')';
                }),
                leyes: rec.leyes.map((id) => buscarLey(id).numero + ' — ' + buscarLey(id).nombre),
              },
            };
          }
          if (tipo === 'VOLVER_AL_INICIO') { volverAlInicio(); return { success: true, message: 'Totem en el inicio.' }; }
          return { success: false, error: 'Acción desconocida: ' + tipo };
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  /* ── Piezas de UI ──────────────────────────────────────────────────── */

  /** Isotipo de NextTime reconstruido en SVG: cuadrado cian con la «t». */
  function Isotipo(props) {
    const lado = props.lado || 40;
    return h('svg', {
      className: 'ec-logo-iso', width: lado, height: lado, viewBox: '0 0 100 100',
      role: 'img', 'aria-label': MARCA.nombre,
    },
    h('rect', { width: 100, height: 100, fill: 'var(--nt-cyan)' }),
    h('path', {
      d: 'M38.2 20.4 V56 A16.6 16.6 0 0 0 71.4 56',
      fill: 'none', stroke: '#fff', strokeWidth: 10.8,
    }),
    h('rect', { x: 26.4, y: 33.4, width: 28.8, height: 9, fill: '#fff' }),
    h('rect', { x: 60.4, y: 33.4, width: 11.2, height: 9, fill: '#fff' }));
  }

  function Logo(props) {
    const lado = props.lado || 40;
    return h('div', { className: 'ec-logo' },
      h(Isotipo, { lado: lado }),
      props.soloIso ? null : h('div', {
        className: 'ec-logo-word',
        style: { fontSize: Math.round(lado * 0.52) + 'px' },
      },
      'Nex', h('i', null, 't'), 'Time',
      h('span', { className: 'ec-logo-sub' }, 'Software')));
  }

  function Qr(props) {
    const m = matrizQR(props.clave);
    if (!m) return null;
    return h('div', { className: 'ec-qr' },
      h('svg', {
        viewBox: '-2 -2 ' + (m.n + 4) + ' ' + (m.n + 4),
        role: 'img', 'aria-label': 'Código QR: ' + (props.alt || props.titulo || ''),
      },
      h('path', { d: pathQR(m), fill: '#070B33' })),
      props.titulo ? h('p', { className: 'ec-qr-t' }, props.titulo) : null);
  }

  function Avatar(props) {
    const [roto, setRoto] = React.useState(false);
    const s = props.speaker;
    if (roto || !props.mostrarFotos || !s.foto) {
      return h('div', { className: 'ec-sp-ini', 'aria-hidden': 'true' }, iniciales(s.nombre));
    }
    return h('img', {
      className: 'ec-sp-foto', src: s.foto, alt: 'Fotografía de ' + s.nombre,
      loading: 'lazy', onError: () => setRoto(true),
    });
  }

  function BloqueAgenda(props) {
    const b = props.bloque;
    const est = estadoBloque(b, props.ahora);
    return h('button', {
      type: 'button',
      className: 'ec-bloque' + (est === 'ahora' ? ' ahora' : '') + (est === 'pasado' ? ' pasado' : ''),
      onClick: () => { if (b.speakers.length) { setVista({ seccion: 'expositores', abierta: b.speakers[0] }); marcarActividad(); } },
    },
    h('span', { className: 'ec-bloque-h' }, b.ini, h('br', null), b.fin),
    h('span', null,
      h('span', { className: 'ec-bloque-t' }, b.tema),
      h('span', { className: 'ec-bloque-e' }, expositoresDe(b))),
    (est === 'ahora' || b.leyes.length)
      ? h('span', { className: 'ec-bloque-tags' },
        est === 'ahora' ? h('span', { className: 'ec-tag ley' }, '● En curso') : null,
        b.leyes.map((id) => h('span', { className: 'ec-tag ley', key: id }, buscarLey(id).numero)))
      : null);
  }

  /* ── Secciones ─────────────────────────────────────────────────────── */

  function Ahora(props) {
    const est = props.est;
    const ahora = props.ahora;
    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card acento' },
        h('p', { className: 'ec-h3' }, EVENTO.ciclo, ' · ', MARCA.nombre),
        h('h1', { className: 'ec-h1' }, EVENTO.titulo),
        h('p', { className: 'ec-p' }, EVENTO.tituloLargo),

        est.fase === 'antes' ? h('div', null,
          h('hr', { className: 'ec-hr' }),
          h('p', { className: 'ec-h3' }, 'Comienza en'),
          h(Cuenta, { falta: est.falta, segundos: config.segundosInactividad !== 0 })) : null,

        est.fase === 'despues' ? h('div', null,
          h('hr', { className: 'ec-hr' }),
          h('p', { className: 'ec-h2' }, 'Gracias por acompañarnos'),
          h('p', { className: 'ec-p tenue' }, 'El desayuno finalizó. Puedes seguir revisando el '
            + 'marco legal y los expositores, o escanear el QR para visitar la landing.')) : null),

      est.actual ? h('div', { className: 'ec-card ec-viva' },
        h('div', { className: 'ec-viva-h' },
          h('span', { className: 'ec-h3', style: { margin: 0 } }, 'Ahora mismo'),
          h('span', { className: 'ec-hora' }, est.actual.ini, ' – ', est.actual.fin)),
        h('p', { className: 'ec-h2' }, est.actual.tema),
        h('p', { className: 'ec-p tenue' }, expositoresDe(est.actual)),
        h('div', { className: 'ec-barra' },
          h('div', {
            className: 'ec-barra-f',
            style: {
              width: Math.round(((ahora - instante(est.actual.ini))
                / (instante(est.actual.fin) - instante(est.actual.ini))) * 100) + '%',
            },
          }))) : null,

      est.siguiente ? h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, est.fase === 'antes' ? 'Abrimos con' : 'A continuación'),
        h('p', { className: 'ec-h2' }, est.siguiente.tema),
        h('p', { className: 'ec-p tenue' }, est.siguiente.ini, ' – ', est.siguiente.fin, ' · ', expositoresDe(est.siguiente))) : null,

      h('div', { className: 'ec-card' },
        h('div', { className: 'ec-datos' },
          h('div', { className: 'ec-dato' },
            h('p', { className: 'ec-dato-k' }, 'Cuándo'),
            h('p', { className: 'ec-dato-v' }, EVENTO.fechaTexto),
            h('p', { className: 'ec-p tenue', style: { margin: '.3em 0 0' } }, EVENTO.horarioTexto)),
          h('div', { className: 'ec-dato' },
            h('p', { className: 'ec-dato-k' }, 'Dónde'),
            h('p', { className: 'ec-dato-v' }, EVENTO.sede),
            h('p', { className: 'ec-p tenue', style: { margin: '.3em 0 0' } }, EVENTO.direccion))),
        h('div', { className: 'ec-qr-fila' },
          h(Qr, { clave: 'landing', titulo: 'Landing del evento', alt: EVENTO.landing }),
          h(Qr, { clave: 'agenda', titulo: 'Agenda (.ics)', alt: 'Archivo de calendario del evento' }))));
  }

  function Cuenta(props) {
    const f = props.falta;
    const us = [
      { n: f.dias, s: f.dias === 1 ? 'día' : 'días' },
      { n: pad2(f.horas), s: 'horas' },
      { n: pad2(f.minutos), s: 'min' },
      { n: pad2(f.segundos), s: 'seg' },
    ];
    const hijos = [];
    us.forEach((u, i) => {
      if (i) hijos.push(h('span', { className: 'ec-count-sep', key: 's' + i }, ':'));
      hijos.push(h('span', { className: 'ec-count-u', key: 'u' + i },
        h('span', { className: 'ec-count-n' }, String(u.n)),
        h('span', { className: 'ec-count-s' }, u.s)));
    });
    return h('div', { className: 'ec-count', role: 'timer' }, hijos);
  }

  function Agenda(props) {
    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Cronograma'),
        h('h2', { className: 'ec-h2' }, EVENTO.fechaTexto),
        h('p', { className: 'ec-p tenue' }, EVENTO.sede, ' · ', EVENTO.direccion, ' · ', EVENTO.horarioTexto)),
      AGENDA.map((b) => h(BloqueAgenda, { key: b.id, bloque: b, ahora: props.ahora })),
      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-p tenue' }, 'Toca un bloque para ver a quién expone. '
          + 'Escanea para llevarte la agenda a tu calendario.'),
        h('div', { className: 'ec-qr-fila' },
          h(Qr, { clave: 'agenda', titulo: 'Agenda (.ics)', alt: 'Archivo de calendario del evento' }))));
  }

  function Expositores(props) {
    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Expositores'),
        h('h2', { className: 'ec-h2' }, 'Quiénes exponen'),
        h('p', { className: 'ec-p tenue' }, 'Toca una ficha para ver su perfil y el QR con su enlace.')),
      h('div', { className: 'ec-grid' }, SPEAKERS.map((s) => {
        const abierta = props.abierta === s.id;
        const org = ORGS[s.org] || {};
        const sesion = AGENDA.find((b) => b.speakers.includes(s.id));
        return h('button', {
          key: s.id,
          type: 'button',
          className: 'ec-sp' + (abierta ? ' abierta' : ''),
          'aria-expanded': abierta ? 'true' : 'false',
          onClick: () => { setVista({ abierta: abierta ? null : s.id }); marcarActividad(); },
        },
        h('span', { className: 'ec-sp-top' },
          h(Avatar, { speaker: s, mostrarFotos: props.mostrarFotos }),
          h('span', { className: 'ec-sp-txt' },
            h('span', { className: 'ec-sp-nom' }, s.nombre),
            h('span', { className: 'ec-sp-rol' }, s.rol),
            h('span', { className: 'ec-sp-org' }, org.nombre))),
        sesion ? h('span', { className: 'ec-bloque-tags', style: { gridColumn: 'auto', marginTop: 0 } },
          h('span', { className: 'ec-tag largo' }, sesion.ini + ' · ' + sesion.tema)) : null,
        abierta ? h('span', { className: 'ec-sp-mas' },
          h('span', { className: 'ec-sp-bio' },
            h('span', { style: { display: 'block', fontWeight: 700, marginBottom: '.3em' } }, s.nombreLargo),
            s.bio || 'No publicamos una biografía de este expositor porque no contamos con una '
              + 'fuente verificada. Escanea el QR para ver su perfil profesional.',
            s.fuente ? h('span', { className: 'ec-qr-t', style: { display: 'block', textAlign: 'left', letterSpacing: '.06em' } }, 'Fuente: ' + s.fuente) : null),
          h(Qr, { clave: s.qr, titulo: 'Perfil', alt: s.url })) : null);
      })));
  }

  function Leyes() {
    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Marco legal'),
        h('h2', { className: 'ec-h2' }, 'Las dos leyes que cambian las reglas'),
        h('p', { className: 'ec-p tenue' }, 'El desayuno gira en torno a estas dos normas chilenas. '
          + 'Aquí va lo esencial de cada una.')),
      LEYES.map((l) => {
        const sesion = buscarBloque(l.sesion);
        return h('div', { className: 'ec-card', key: l.id },
          h('p', { className: 'ec-ley-n' }, l.numero),
          h('h3', { className: 'ec-h2' }, l.nombre),
          h('p', { className: 'ec-p' }, l.resumen),
          h('div', { className: 'ec-datos' }, l.datos.map((d) => h('div', { className: 'ec-dato', key: d.k },
            h('p', { className: 'ec-dato-k' }, d.k),
            h('p', { className: 'ec-dato-v' }, d.v)))),
          h('ul', { className: 'ec-lista' }, l.puntos.map((p, i) => h('li', { key: i }, p))),
          sesion ? h('p', { className: 'ec-p', style: { marginTop: '1em' } },
            h('span', { className: 'ec-tag ley' }, sesion.ini + ' – ' + sesion.fin),
            ' ', sesion.tema) : null);
      }),
      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-aviso' }, 'Este resumen es informativo y se apoya en fuentes '
          + 'públicas; no constituye asesoría legal. Para el texto oficial y su aplicación a tu '
          + 'organización, consulta a un abogado. Lilian Jiménez abre el desayuno a las 09:00 '
          + 'precisamente con este contexto.')));
  }

  function Consulta(props) {
    const [texto, setTexto] = React.useState('');
    const [para, setPara] = React.useState('');
    const v = props.vista;
    const paso = v.paso || 0;
    const rec = v.consulta.foco ? RECOMENDACIONES[v.consulta.foco] : null;
    const totalVotos = TEMAS_VOTO.reduce((a, t) => a + (props.doc.votos[t.id] || 0), 0);

    const responder = (preguntaId, opcionId) => {
      const consulta = Object.assign({}, v.consulta);
      consulta[preguntaId] = opcionId;
      setVista({ consulta: consulta, paso: paso + 1 });
      marcarActividad();
    };

    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card acento' },
        h('p', { className: 'ec-h3' }, 'Anfitrión'),
        h('h2', { className: 'ec-h2' }, rec ? 'Esto es lo que te recomendamos' : '¿En qué te orientamos?'),
        h('div', { className: 'ec-pasos' }, CONSULTA.map((_, i) => h('span', {
          key: i, className: 'ec-paso' + (i < paso ? ' on' : ''),
        }))),

        !rec && CONSULTA[paso] ? h('div', null,
          h('p', { className: 'ec-h2', style: { fontSize: 'var(--f-lg)' } }, CONSULTA[paso].pregunta),
          h('div', { className: 'ec-ops' }, CONSULTA[paso].opciones.map((o) => h('button', {
            key: o.id, type: 'button', className: 'ec-op',
            onClick: () => responder(CONSULTA[paso].id, o.id),
          }, h('span', { className: 'ec-op-ico' }, o.ico), o.label)))) : null,

        rec ? h('div', null,
          NOTA_ROL[v.consulta.rol] ? h('p', { className: 'ec-p' }, NOTA_ROL[v.consulta.rol]) : null,
          h('hr', { className: 'ec-hr' }),
          h('p', { className: 'ec-h3' }, 'No te pierdas'),
          rec.sesiones.map((id) => {
            const b = buscarBloque(id);
            return h('p', { className: 'ec-p', key: id },
              h('span', { className: 'ec-tag ley' }, b.ini + ' – ' + b.fin), ' ',
              h('strong', null, b.tema), h('br', null),
              h('span', { className: 'ec-p tenue' }, expositoresDe(b)));
          }),
          h('p', { className: 'ec-h3', style: { marginTop: '1.2em' } }, 'Conversa con'),
          h('p', { className: 'ec-p' }, rec.speakers.map((id) => {
            const s = buscarSpeaker(id);
            return s.nombre + ' (' + (ORGS[s.org] || {}).nombre + ')';
          }).join(' · ')),
          h('p', { className: 'ec-h3', style: { marginTop: '1.2em' } }, 'Revisa'),
          h('p', { className: 'ec-p' }, rec.leyes.map((id) => buscarLey(id).numero + ' — ' + buscarLey(id).nombre).join(' · ')),
          h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '1.2em' } },
            h('button', {
              type: 'button', className: 'ec-btn ghost',
              onClick: () => { setVista({ consulta: {}, paso: 0 }); marcarActividad(); },
            }, 'Empezar de nuevo'),
            h('button', { type: 'button', className: 'ec-btn', onClick: () => irA('agenda') }, 'Ver la agenda'))) : null),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Deja tu pregunta al panel'),
        h('div', { className: 'ec-form' },
          h('input', {
            className: 'ec-input', type: 'text', value: texto, maxLength: 400,
            placeholder: '¿Qué te gustaría preguntar?',
            onChange: (e) => { setTexto(e.target.value); marcarActividad(); },
            onKeyDown: (e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (addPregunta(texto, para)) setTexto(''); }
            },
          }),
          h('select', {
            className: 'ec-select', value: para,
            onChange: (e) => { setPara(e.target.value); marcarActividad(); },
          },
          h('option', { value: '' }, 'Para el panel'),
          SPEAKERS.map((s) => h('option', { key: s.id, value: s.id }, s.nombre))),
          h('button', {
            type: 'button', className: 'ec-btn', disabled: !texto.trim(),
            onClick: () => { if (addPregunta(texto, para)) setTexto(''); },
          }, 'Publicar')),
        props.doc.preguntas.length
          ? props.doc.preguntas.slice().reverse().slice(0, 12).map((p) => {
            const s = buscarSpeaker(p.para);
            return h('div', { className: 'ec-preg', key: p.id },
              h('span', { className: 'ec-op-ico' }, '💬'),
              h('span', { style: { flex: 1 } },
                h('p', { className: 'ec-preg-t' }, p.texto),
                h('p', { className: 'ec-preg-p' }, s ? 'Para ' + s.nombre : 'Para el panel')));
          })
          : h('div', { className: 'ec-vacio' }, 'Aún no hay preguntas. Sé la primera persona en dejar una.')),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Qué le interesa a la sala'),
        h('p', { className: 'ec-p tenue' }, totalVotos
          ? totalVotos + ' voto' + (totalVotos === 1 ? '' : 's') + ' hasta ahora. Toca el tema que más te interesa.'
          : 'Toca el tema que más te interesa y verás cómo vota el resto.'),
        TEMAS_VOTO.map((t) => {
          const n = props.doc.votos[t.id] || 0;
          const pct = totalVotos ? Math.round((n / totalVotos) * 100) : 0;
          return h('div', { className: 'ec-voto', key: t.id },
            h('button', {
              type: 'button', className: 'ec-op', style: { marginBottom: '.5em' },
              onClick: () => votar(t.id),
            },
            h('span', { style: { flex: 1 } }, t.texto),
            h('span', { className: 'ec-voto-n' }, n + (totalVotos ? ' · ' + pct + '%' : ''))),
            h('div', { className: 'ec-voto-b' }, h('div', { className: 'ec-voto-f', style: { width: pct + '%' } })));
        })));
  }

  function NextTime() {
    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card acento' },
        h(Logo, { lado: 72 }),
        h('hr', { className: 'ec-hr' }),
        h('p', { className: 'ec-p' }, MARCA.descripcion),
        h('p', { className: 'ec-p tenue' }, MARCA.direccion),
        h('div', { className: 'ec-qr-fila', style: { marginTop: '1.2em' } },
          h(Qr, { clave: 'nexttime', titulo: 'nexttimesoftware.com', alt: MARCA.sitio }),
          h(Qr, { clave: 'landing', titulo: 'Landing del evento', alt: EVENTO.landing }))),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Patrocinan'),
        h('div', { className: 'ec-patro' }, PATROCINADORES.map((p) => h('div', { className: 'ec-patro-c', key: p.id },
          h('p', { className: 'ec-patro-n' }, p.nombre),
          h('p', { className: 'ec-p tenue' }, p.nota))))),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Participan'),
        h('div', { className: 'ec-grid' }, Object.keys(ORGS).filter((k) => k !== 'nexttime').map((k) => {
          const o = ORGS[k];
          const quienes = SPEAKERS.filter((s) => s.org === k).map((s) => s.nombre).join(' · ');
          return h('div', { className: 'ec-patro-c', key: k },
            h('p', { className: 'ec-patro-n' }, o.nombre),
            quienes ? h('p', { className: 'ec-p tenue' }, quienes) : null,
            h('div', { style: { marginTop: '.8em' } }, h(Qr, { clave: o.qr, titulo: 'Sitio', alt: o.url })));
        }))),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-pie' },
          EVENTO.ciclo, ' · ', MARCA.nombre, h('br', null),
          'Anfitrión del evento v', APP_VERSION, ' · app de KIMOS')));
  }

  /* ── Componente raíz ───────────────────────────────────────────────── */

  function Component() {
    const [estado, setEstado] = React.useState({ doc, vista, config });
    const [ahora, setAhora] = React.useState(() => Date.now());
    const [modo, setModo] = React.useState('escritorio');
    const raizRef = React.useRef(null);

    React.useEffect(() => {
      listeners.add(setEstado);
      return () => { listeners.delete(setEstado); };
    }, []);

    // El reloj late cada segundo, en pausa si la pestaña no se ve.
    React.useEffect(() => {
      const t = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        setAhora(Date.now());
      }, 1000);
      return () => clearInterval(t);
    }, []);

    /* Totem o ventana: se decide midiendo la RAÍZ, no el viewport, porque
       dentro del shell la app vive en una ventana que no llena la pantalla. */
    React.useEffect(() => {
      const el = raizRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return undefined;
      const medir = () => {
        const forzado = estado.config.modo;
        if (forzado === 'totem' || forzado === 'escritorio') { setModo(forzado); return; }
        const { clientWidth: w, clientHeight: hgt } = el;
        setModo(hgt >= 1000 && hgt > w * 1.2 ? 'totem' : 'escritorio');
      };
      medir();
      const ro = new ResizeObserver(medir);
      ro.observe(el);
      return () => ro.disconnect();
    }, [estado.config.modo]);

    const d = estado.doc;
    const v = estado.vista;
    const cfg = estado.config;
    const est = estadoEvento(ahora);

    const vistas = {
      ahora: () => h(Ahora, { est: est, ahora: ahora }),
      agenda: () => h(Agenda, { ahora: ahora }),
      expositores: () => h(Expositores, { abierta: v.abierta, mostrarFotos: cfg.mostrarFotos !== false }),
      leyes: () => h(Leyes, null),
      consulta: () => h(Consulta, { vista: v, doc: d }),
      nexttime: () => h(NextTime, null),
    };

    const hora = new Date(ahora);
    return h('div', {
      ref: raizRef,
      className: 'kimos-evento-ciberseguridad modo-' + modo,
      style: cfg.acento ? { '--nt-cyan': cfg.acento } : null,
      onPointerDown: marcarActividad,
      onKeyDown: marcarActividad,
    },
    h('header', { className: 'ec-hd' },
      h(Logo, { lado: modo === 'totem' ? 56 : 34 }),
      h('div', { className: 'ec-hd-est' },
        est.fase === 'durante'
          ? h('span', { className: 'ec-pill vivo' }, h('span', { className: 'ec-punto' }), 'En vivo')
          : h('span', { className: 'ec-pill evento' }, 'Desayuno 2026'),
        h('span', { className: 'ec-reloj' }, pad2(hora.getHours()) + ':' + pad2(hora.getMinutes())),
        h('span', { className: 'ec-ver', title: EVENTO.titulo + ' v' + APP_VERSION }, 'v' + APP_VERSION))),

    h('main', { className: 'ec-body' }, (vistas[v.seccion] || vistas.ahora)()),

    h('nav', { className: 'ec-nav' }, SECCIONES.map((s) => h('button', {
      key: s.id,
      type: 'button',
      'aria-current': v.seccion === s.id ? 'page' : undefined,
      className: 'ec-nav-b' + (v.seccion === s.id ? ' on' : ''),
      onClick: () => irA(s.id),
    }, h('span', { className: 'ec-nav-ico' }, s.ico), s.label))));
  }

  return {
    Component,
    unmount() {
      clearTimeout(guardarT);
      clearTimeout(inactividadT);
      listeners.clear();
      if (offAgent) { try { offAgent(); } catch (e) { /* ya desregistrado */ } }
      if (offConfig) { try { offConfig(); } catch (e) { /* ya desuscrito */ } }
    },
  };
}
