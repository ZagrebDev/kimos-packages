/**
 * Anfitrión del Desayuno Ejecutivo de Ciberseguridad 2026 — NextTime Software.
 * App para TOTEM TOUCH y pantalla interactiva.
 *
 * Estilo gráfico alineado con el Landing oficial del evento (NextTime Software):
 *  - Degradados índigo/violeta (#4600F8 a #7600CF) y acento cian (#00E4D0).
 *  - Navegación superior con botones táctiles XL e iconos vectoriales 100% blancos.
 *  - Agenda y Expositores fusionados con fotos, biografías y QR individuales.
 *  - Pantalla inicial directa sin interferencia con el widget de chat inferior.
 */

const APP_VERSION = '2.2.0';

/* ── Marca y evento ───────────────────────────────────────────────────── */

const MARCA = {
  nombre: 'NextTime Software',
  sitio: 'https://nexttimesoftware.com/',
  direccion: 'Av. Apoquindo 6410 Of. 214, Las Condes, Santiago de Chile',
  descripcion: 'Compañía chilena de tecnología con más de 17 años de trayectoria, '
    + 'enfocada en la aceleración digital y la automatización de procesos de negocio '
    + 'mediante soluciones cloud y ciberseguridad.',
};

const EVENTO = {
  ciclo: 'Ciclo de Eventos',
  titulo: 'Desayuno Ejecutivo de Ciberseguridad 2026',
  tituloLargo: 'Adopta Ciberseguridad: prepárate para Protección de Datos y Delitos Informáticos',
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
    nota: 'Soluciones de ciberseguridad de Microsoft como eje de cumplimiento de la Ley Marco 21.663.',
  },
  {
    id: 'nexsys',
    nombre: 'Nexsys',
    nota: 'Mayorista de valor agregado en Latinoamérica con amplia presencia en soluciones de seguridad.',
  },
];

const ORGS = {
  nexttime: { nombre: 'NextTime Software', qr: 'nexttime', url: MARCA.sitio },
  nexoabogados: { nombre: 'Nexo Abogados', qr: 'nexoabogados', url: 'https://www.nexoabogados.cl/abogados/delitos-informaticos' },
  customertrigger: { nombre: 'CustomerTrigger', qr: 'customertrigger', url: 'https://customertrigger.com/' },
  lineage: { nombre: 'Lineage', qr: 'lineage', url: 'https://lineageplatform.com/' },
};

/* ── Expositores ────────────────────────────────────────────────────── */

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
      + 'Ciberseguridad por la Universidad de Chile (2024), con formación en aspectos '
      + 'técnicos, legales y éticos de la protección de datos, delitos informáticos, '
      + 'gestión de riesgos y normativa nacional e internacional.',
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
      + 'Partners. Su foco es la estrategia comercial y de ciberseguridad en transformación digital.',
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
      + 'Digital», profesor y conferencista, académico de la Universidad de Chile.',
    fuente: 'Perfil profesional público',
    foto: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/d1afd5ee-7e88-1d91-7ab0-be169db9daf1.jpg?dpr=2&rect=280%2C0%2C719%2C720&w=160&h=160',
  },
  {
    id: 'bernardo-donoso',
    nombre: 'Bernardo Donoso',
    nombreLargo: 'Bernardo Donoso Brión',
    rol: 'Expositor · Especialista Lineage',
    org: 'lineage',
    qr: 'bernardo-donoso',
    url: 'https://www.linkedin.com/in/bernardo-donoso-bri%C3%B3n-73108b239/',
    bio: 'Especialista en protección de datos y cumplimiento de la Ley 21.719 en la plataforma Lineage.',
    fuente: 'Perfil profesional público',
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
    bio: 'Director Comercial. Experto en soluciones de protección de datos personales y adecuación normativa corporativa.',
    fuente: 'Convocatoria del evento y perfil profesional público',
    foto: 'https://mcusercontent.com/39df1d5ab0cecee961f84c7a5/images/b3e96510-ee49-3da4-3743-58361d346cf2.png',
  },
];

/* ── Cronograma / Agenda ─────────────────────────────────────────────── */

const AGENDA = [
  {
    id: 'bienvenida', ini: '08:30', fin: '09:00',
    tema: 'Bienvenida y Networking Inicial',
    resumen: 'Recepción de asistentes, café de bienvenida y apertura de la jornada en el Hotel DoubleTree by Hilton.',
    porTexto: 'NextTime Software', speakers: [], orgs: ['nexttime'], leyes: [],
  },
  {
    id: 'contexto-legal', ini: '09:00', fin: '09:30',
    tema: 'Contexto actual de las leyes de Ciberseguridad, Delitos Informáticos y Protección de Datos',
    resumen: 'Análisis detallado de la Ley Marco 21.663, Ley 21.719 y Ley 21.459: exigencias, plazos, sanciones y responsabilidades de los directores.',
    porTexto: '', speakers: ['lilian-jimenez'], orgs: ['nexoabogados'], leyes: ['21663', '21719'],
  },
  {
    id: 'microsoft-21663', ini: '09:30', fin: '10:00',
    tema: 'Microsoft para la Ciberseguridad y Ley 21.663',
    resumen: 'Implementación práctica de controles, gestión de riesgos, monitoreo continuo y reporte de incidentes exigidos por la ANCI mediante el ecosistema Microsoft.',
    porTexto: '', speakers: ['jose-gaete'], orgs: ['nexttime'], leyes: ['21663'],
  },
  {
    id: 'gobernanza', ini: '10:00', fin: '10:30',
    tema: 'Gobernanza de Datos',
    resumen: 'Estrategias para descubrir, clasificar, gobernar y proteger los activos de información corporativos para habilitar IA y analítica segura.',
    porTexto: '', speakers: ['cristian-maulen'], orgs: ['customertrigger'], leyes: [],
  },
  {
    id: 'lineage', ini: '10:30', fin: '11:00',
    tema: 'Lineage para Protección de Datos y cumplimiento de la Ley 21.719',
    resumen: 'Trazabilidad, inventario de datos personales, gestión de consentimiento y preparación para los derechos ARCO y fiscalización de la APDP.',
    porTexto: '', speakers: ['bernardo-donoso', 'leonardo-jadue'], orgs: ['lineage'], leyes: ['21719'],
  },
  {
    id: 'cierre', ini: '11:00', fin: '11:30',
    tema: 'Panel de Preguntas, Networking y Cierre',
    resumen: 'Ronda de preguntas abiertas a los expositores, conclusiones estratégicas y espacio de networking con los líderes participantes.',
    porTexto: 'Todos los asistentes', speakers: [], orgs: ['nexttime'], leyes: [],
  },
];

/* ── Marco legal ────────────────────────────────────────────────────── */

const LEYES = [
  {
    id: '21663',
    numero: 'Ley 21.663',
    nombre: 'Ley Marco de Ciberseguridad',
    resumen: 'Establece obligaciones de gobernanza, gestión de riesgos y reporte de incidentes '
      + 'para organismos del Estado y operadores privados de servicios esenciales y de importancia vital.',
    datos: [
      { k: 'Promulgada', v: 'Abril de 2024' },
      { k: 'Vigencia', v: 'Artículos clave desde marzo de 2025' },
      { k: 'Fiscaliza', v: 'ANCI — Agencia Nacional de Ciberseguridad' },
    ],
    puntos: [
      'Crea la Agencia Nacional de Ciberseguridad (ANCI), que califica a Operadores de Importancia Vital y aplica sanciones.',
      'Reporte de incidentes al CSIRT Nacional: alerta temprana en 3 horas, reporte completo en 72 horas y reporte final tras contención.',
      'Exige controles de seguridad, gestión de riesgos, monitoreo continuo y planes de respuesta a incidentes.',
      'Obliga a designar un Delegado de Ciberseguridad, responsable ante la ANCI.',
      'Afecta con especial fuerza a energía, agua, salud, finanzas, telecomunicaciones y transporte.',
    ],
    sesion: 'microsoft-21663',
  },
  {
    id: '21719',
    numero: 'Ley 21.719',
    nombre: 'Protección de Datos Personales',
    resumen: 'Reemplaza la normativa histórica y acerca a Chile al estándar europeo RGPD, '
      + 'creando una agencia autónoma y un estricto régimen sancionatorio.',
    datos: [
      { k: 'Publicada', v: '13 de diciembre de 2024' },
      { k: 'Entra en vigencia', v: '1 de diciembre de 2026' },
      { k: 'Fiscaliza', v: 'APDP — Agencia de Protección de Datos Personales' },
    ],
    puntos: [
      'Crea la Agencia de Protección de Datos Personales (APDP), que puede fiscalizar, multar y ordenar suspensión de tratamientos.',
      'Consagra Derechos ARCO completos: acceso, rectificación, cancelación y oposición.',
      'Notificación obligatoria de brechas de seguridad en un plazo máximo de 72 horas.',
      'Multas de hasta 20.000 UTM, pudiendo llegar al 4% de los ingresos anuales en caso de reincidencia.',
      'Período de adecuación técnica, legal y contractual antes de su plena exigibilidad en diciembre de 2026.',
    ],
    sesion: 'lineage',
  },
];

/* ── Consulta interactiva ─────────────────────────────────────────────── */

const CONSULTA = [
  {
    id: 'rol',
    pregunta: '¿Desde qué área o rol participas hoy?',
    opciones: [
      { id: 'direccion', label: 'Dirección General o Negocio' },
      { id: 'ti', label: 'TI, Ciberseguridad o Infraestructura' },
      { id: 'legal', label: 'Legal, Cumplimiento o Auditoría' },
      { id: 'datos', label: 'Datos, Analítica o Transformación' },
    ],
  },
  {
    id: 'foco',
    pregunta: '¿Cuál es tu principal desafío actual?',
    opciones: [
      { id: 'ley21663', label: 'Cumplir la Ley Marco de Ciberseguridad (21.663)' },
      { id: 'ley21719', label: 'Preparar la Ley de Protección de Datos (21.719)' },
      { id: 'gobernanza', label: 'Ordenar y gobernar los activos de datos' },
      { id: 'partir', label: 'Diagnosticar brechas y saber por dónde empezar' },
    ],
  },
];

const RECOMENDACIONES = {
  ley21663: { sesiones: ['contexto-legal', 'microsoft-21663'], leyes: ['21663'], speakers: ['lilian-jimenez', 'jose-gaete'] },
  ley21719: { sesiones: ['contexto-legal', 'lineage'], leyes: ['21719'], speakers: ['lilian-jimenez', 'leonardo-jadue', 'bernardo-donoso'] },
  gobernanza: { sesiones: ['gobernanza', 'lineage'], leyes: ['21719'], speakers: ['cristian-maulen', 'bernardo-donoso'] },
  partir: { sesiones: ['contexto-legal', 'microsoft-21663', 'gobernanza'], leyes: ['21663', '21719'], speakers: ['lilian-jimenez', 'jose-gaete'] },
};

const NOTA_ROL = {
  direccion: 'Como líder de negocio, el ángulo clave es la mitigación de riesgos legales, financieros y reputacionales.',
  ti: 'Desde TI y Seguridad, el foco práctico está en los controles técnicos, monitoreo y reporte de incidentes en 3 horas.',
  legal: 'Desde Legal y Cumplimiento, la prioridad son las nuevas obligaciones, plazos de adecuación y fiscalización de ANCI y APDP.',
  datos: 'Desde Datos y Analítica, la base es la gobernanza, inventario y trazabilidad para cumplir con privacidad y habilitar IA.',
};

const TEMAS_VOTO = [
  { id: 'ley-marco', texto: 'Implicancias de la Ley Marco de Ciberseguridad' },
  { id: 'datos-personales', texto: 'Protección de datos personales y responsabilidades' },
  { id: 'incumplimiento', texto: 'Riesgos del incumplimiento normativo' },
  { id: 'resiliencia', texto: 'Estrategias de resiliencia digital' },
  { id: 'casos-practicos', texto: 'Casos prácticos y experiencias reales' },
];

/* 4 Secciones principales */
const SECCIONES = [
  { id: 'ahora', ico: 'ahora', label: 'Ahora' },
  { id: 'agenda', ico: 'agenda', label: 'Agenda y Expositores' },
  { id: 'leyes', ico: 'leyes', label: 'Marco Legal' },
  { id: 'consulta', ico: 'consulta', label: 'Consulta e Interacción' },
];

/* ── QR Precalculados Embebidos ───────────────────────────────────────── */

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

/* ── Logotipo de Kimos (vectorizado desde kimos-enterprice: frontend/public/logos/KIMOS.png) ── */

const KIMOS_LOGO = {
  viewBox: '0 0 706 144',
  d: 'M0 0 L46 39 L46 67 L48 67 L51 63 L53 63 L57 58 L59 58 L63 53 L65 53 L69 48 L71 48 L75 43 L77 43 L81 38 L83 38 L87 33 L89 33 L93 28 L95 28 L99 23 L101 23 L105 18 L107 18 L111 13 L113 13 L113 12 L70 12 L70 29 L66 31 L62 36 L59 37 L59 0 L141 0 L133 9 L131 9 L122 19 L120 19 L101 38 L99 38 L94 44 L92 44 L86 51 L84 51 L79 57 L77 57 L71 64 L69 64 L63 71 L61 71 L56 77 L54 77 L48 84 L46 84 L37 93 L36 93 L36 44 L34 44 L29 38 L27 38 L22 32 L20 32 L16 27 L14 27 L11 24 L11 121 L13 121 L20 114 L22 114 L26 109 L28 109 L32 104 L34 104 L38 99 L40 99 L50 89 L52 89 L55 85 L57 85 L61 80 L66 79 L72 86 L74 86 L80 93 L82 93 L88 100 L90 100 L97 108 L99 108 L105 115 L107 115 L113 122 L115 122 L122 130 L124 130 L138 144 L59 144 L59 110 L61 110 L66 116 L70 118 L70 133 L71 134 L111 134 L105 127 L103 127 L99 122 L97 122 L92 116 L90 116 L86 111 L84 111 L79 105 L77 105 L66 94 L62 94 L59 98 L57 98 L54 102 L52 102 L49 106 L47 106 L44 110 L42 110 L39 114 L37 114 L34 118 L32 118 L29 122 L27 122 L24 126 L22 126 L19 130 L17 130 L14 134 L12 134 L9 138 L7 138 L4 142 L0 144ZM167 0 L185 0 L185 144 L167 144ZM209 0 L233 0 L235 4 L240 8 L240 10 L245 14 L245 16 L250 20 L250 22 L255 26 L255 28 L260 32 L260 34 L265 38 L265 40 L270 44 L270 46 L275 50 L275 52 L280 56 L280 58 L286 63 L286 65 L290 69 L292 69 L292 67 L299 61 L299 59 L306 53 L306 51 L312 46 L312 44 L319 38 L319 36 L326 30 L326 28 L333 22 L333 20 L340 14 L340 12 L347 6 L347 4 L351 0 L375 0 L375 144 L357 144 L357 22 L354 23 L354 25 L347 31 L347 33 L341 38 L341 40 L334 46 L334 48 L328 53 L328 55 L321 61 L321 63 L315 68 L315 70 L308 76 L308 78 L302 83 L302 85 L295 91 L295 93 L291 97 L282 88 L282 86 L276 81 L276 79 L271 75 L271 73 L265 68 L265 66 L259 61 L259 59 L254 55 L254 53 L248 48 L248 46 L242 41 L242 39 L237 35 L237 33 L231 28 L231 26 L226 22 L226 144 L209 144ZM409 0 L526 0 L526 1 L530 1 L534 3 L538 7 L540 14 L541 14 L541 131 L540 131 L539 136 L534 141 L530 143 L526 143 L526 144 L409 144 L409 143 L404 142 L397 135 L396 129 L395 129 L395 15 L396 15 L396 12 L399 6 L402 3 L409 1ZM581 0 L692 0 L692 1 L699 2 L700 4 L703 5 L705 12 L706 12 L706 30 L689 30 L687 21 L680 17 L583 17 L578 21 L578 25 L577 25 L577 60 L582 65 L586 65 L586 66 L693 66 L693 67 L696 67 L704 76 L705 83 L706 83 L706 130 L705 130 L705 134 L703 138 L699 142 L695 144 L576 144 L576 143 L571 142 L565 137 L562 131 L562 116 L577 116 L580 126 L585 129 L681 129 L681 128 L685 128 L689 121 L689 85 L684 81 L681 81 L681 80 L580 80 L580 79 L575 79 L569 76 L564 71 L563 66 L562 66 L562 16 L563 16 L565 9 L570 4 L576 1 L581 1ZM426 18 L418 21 L413 31 L413 116 L414 116 L415 122 L419 126 L426 128 L426 129 L508 129 L508 128 L514 128 L514 127 L519 126 L522 123 L523 118 L524 118 L524 29 L523 29 L522 24 L518 20 L511 19 L511 18Z',
};

/* Crédito de plataforma que se muestra en el pie, junto al del organizador. */
const PIE = {
  copyright: '© 2026 NextTime Software',
  plataforma: 'Powered by',
  dominio: '.dev',
};

const DEFAULT_CONFIG = { acento: '#00E4D0', modo: 'auto', segundosInactividad: 90, mostrarFotos: true };
const IDS_SECCION = ['ahora', 'agenda', 'leyes', 'consulta', 'expositores', 'nexttime'];

/* ── Utilidades puras ─────────────────────────────────────────────────── */

const pad2 = (n) => String(n).padStart(2, '0');
const buscarSpeaker = (id) => SPEAKERS.find((s) => s.id === id) || null;
const buscarBloque = (id) => AGENDA.find((b) => b.id === id) || null;
const buscarLey = (id) => LEYES.find((l) => l.id === id) || null;

const iniciales = (nombre) => String(nombre || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

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

function estadoBloque(bloque, ahora) {
  if (ahora >= instante(bloque.fin)) return 'pasado';
  if (ahora >= instante(bloque.ini)) return 'ahora';
  return 'futuro';
}

function expositoresDe(bloque) {
  if (bloque.porTexto) return bloque.porTexto;
  const nombres = bloque.speakers.map((id) => (buscarSpeaker(id) || {}).nombre).filter(Boolean);
  const orgs = bloque.orgs.map((id) => (ORGS[id] || {}).nombre).filter(Boolean);
  const quien = nombres.join(' y ');
  return orgs.length ? (quien ? quien + ' · ' + orgs.join(', ') : orgs.join(', ')) : quien;
}

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

  let doc = normalizar(null);
  let vista = { seccion: 'ahora', abierta: null, consulta: {}, paso: 0 };
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

  const irA = (seccion) => {
    let dest = seccion;
    if (dest === 'expositores') dest = 'agenda';
    if (dest === 'nexttime') dest = 'ahora';
    if (!['ahora', 'agenda', 'leyes', 'consulta'].includes(dest)) return false;
    setVista({ seccion: dest, abierta: null });
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
      description: 'Anfitrión interactivo del Desayuno Ejecutivo de Ciberseguridad 2026 de NextTime Software para el totem táctil.',
      tools: [
        {
          name: 'IR_A_SECCION',
          description: 'Muestra una sección del totem (ahora, agenda, leyes, consulta).',
          inputSchema: { type: 'object', properties: { seccion: { type: 'string', enum: IDS_SECCION } }, required: ['seccion'] },
        },
        {
          name: 'ADD_PREGUNTA',
          description: 'Publica una pregunta en el tablón del panel.',
          inputSchema: {
            type: 'object',
            properties: { texto: { type: 'string' }, speakerId: { type: 'string', enum: SPEAKERS.map((s) => s.id) } },
            required: ['texto'],
          },
        },
        {
          name: 'REMOVE_PREGUNTA',
          description: 'Retira una pregunta del tablón por su ID.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        },
        {
          name: 'VOTAR_TEMA',
          description: 'Suma un voto a un tema en la encuesta de la sala.',
          inputSchema: { type: 'object', properties: { temaId: { type: 'string', enum: TEMAS_VOTO.map((t) => t.id) } }, required: ['temaId'] },
        },
        {
          name: 'RECOMENDAR',
          description: 'Devuelve recomendación personalizada por rol y foco.',
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
          description: 'Regresa el totem a la pantalla inicial.',
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
            cuando: EVENTO.fechaTexto + ', ' + EVENTO.horarioTexto,
            donde: EVENTO.sede + ' — ' + EVENTO.direccion,
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
            bio: s.bio,
          })),
          leyes: LEYES.map((l) => ({
            id: l.id, numero: l.numero, nombre: l.nombre, resumen: l.resumen,
            datos: l.datos, puntos: l.puntos,
          })),
          publico: {
            seccionVisible: vista.seccion,
            preguntas: doc.preguntas,
            encuesta: TEMAS_VOTO.map((t) => ({ id: t.id, texto: t.texto, votos: doc.votos[t.id] || 0 })),
          },
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
              message: 'Recomendación generada.',
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

  /* ── Iconos Vectoriales Blancos (1 solo color) ───────────────────────── */

  function IconAhora() {
    return h('svg', {
      className: 'ec-nav-svg', width: 30, height: 30, viewBox: '0 0 24 24',
      fill: 'none', stroke: '#FFFFFF', strokeWidth: '2.2', strokeLinecap: 'round', strokeLinejoin: 'round',
    },
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polyline', { points: '12 6 12 12 16 14' }));
  }

  function IconAgenda() {
    return h('svg', {
      className: 'ec-nav-svg', width: 30, height: 30, viewBox: '0 0 24 24',
      fill: 'none', stroke: '#FFFFFF', strokeWidth: '2.2', strokeLinecap: 'round', strokeLinejoin: 'round',
    },
    h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }),
    h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
    h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
    h('line', { x1: '3', y1: '10', x2: '21', y2: '10' }),
    h('circle', { cx: '9', cy: '16', r: '2' }),
    h('path', { d: 'M14 18c0-1.5 1.5-2 3-2s3 .5 3 2' }));
  }

  function IconLeyes() {
    return h('svg', {
      className: 'ec-nav-svg', width: 30, height: 30, viewBox: '0 0 24 24',
      fill: 'none', stroke: '#FFFFFF', strokeWidth: '2.2', strokeLinecap: 'round', strokeLinejoin: 'round',
    },
    h('path', { d: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z' }),
    h('path', { d: 'M12 8v8' }),
    h('path', { d: 'M8 11h8' }));
  }

  function IconConsulta() {
    return h('svg', {
      className: 'ec-nav-svg', width: 30, height: 30, viewBox: '0 0 24 24',
      fill: 'none', stroke: '#FFFFFF', strokeWidth: '2.2', strokeLinecap: 'round', strokeLinejoin: 'round',
    },
    h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }),
    h('circle', { cx: '9', cy: '10', r: '1', fill: '#FFFFFF' }),
    h('circle', { cx: '12', cy: '10', r: '1', fill: '#FFFFFF' }),
    h('circle', { cx: '15', cy: '10', r: '1', fill: '#FFFFFF' }));
  }

  /* ── Piezas de UI ──────────────────────────────────────────────────── */

  function Logo(props) {
    const hgt = props.hgt || 54;
    return h('div', { className: 'ec-logo' },
      h('svg', {
        className: 'ec-logo-iso',
        width: Math.round(hgt * 0.92),
        height: Math.round(hgt * 0.92),
        viewBox: '0 0 100 100',
        role: 'img',
        'aria-label': MARCA.nombre,
      },
      h('rect', { width: 100, height: 100, rx: 16, fill: 'var(--nt-cyan)' }),
      h('path', {
        d: 'M38.2 20.4 V56 A16.6 16.6 0 0 0 71.4 56',
        fill: 'none', stroke: '#FFFFFF', strokeWidth: 11, strokeLinecap: 'round',
      }),
      h('rect', { x: 26, y: 33.4, width: 29, height: 9.2, rx: 2, fill: '#FFFFFF' }),
      h('rect', { x: 60, y: 33.4, width: 12, height: 9.2, rx: 2, fill: '#FFFFFF' })),
      h('div', { className: 'ec-logo-text-wrap' },
        h('div', {
          className: 'ec-logo-word',
          style: { fontSize: Math.round(hgt * 0.52) + 'px' },
        },
        'Nex', h('span', { className: 'ec-logo-t' }, 't'), 'Time'),
        h('span', {
          className: 'ec-logo-sub',
          style: { fontSize: Math.max(12, Math.round(hgt * 0.24)) + 'px' },
        }, 'Software')));
  }

  /* Pie: misma banda de cierre del landing (fondo cian) pero con tipografía
     blanca, más el crédito y el logotipo de Kimos. */
  function Pie() {
    return h('footer', { className: 'ec-ft' },
      h('p', { className: 'ec-ft-c' }, PIE.copyright),
      h('span', { className: 'ec-ft-sep', 'aria-hidden': 'true' }),
      h('div', { className: 'ec-ft-k' },
        h('span', { className: 'ec-ft-k-lbl' }, PIE.plataforma),
        h('svg', {
          className: 'ec-ft-k-logo',
          viewBox: KIMOS_LOGO.viewBox,
          role: 'img',
          'aria-label': 'Kimos',
        },
        h('path', { d: KIMOS_LOGO.d, fill: 'currentColor', fillRule: 'evenodd' })),
        h('span', { className: 'ec-ft-k-dev' }, PIE.dominio)));
  }

  function Qr(props) {
    const m = matrizQR(props.clave);
    if (!m) return null;
    return h('div', { className: 'ec-qr' },
      h('svg', {
        viewBox: '-2 -2 ' + (m.n + 4) + ' ' + (m.n + 4),
        role: 'img', 'aria-label': 'Código QR: ' + (props.alt || props.titulo || ''),
      },
      h('path', { d: pathQR(m), fill: '#0a0324' })),
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

  /* ── Secciones ─────────────────────────────────────────────────────── */

  /* 1. Ahora */
  function Ahora(props) {
    const est = props.est;
    const ahora = props.ahora;

    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card ec-hero-card' },
        h('div', { className: 'ec-badge-row' },
          h('span', { className: 'ec-pill evento' }, EVENTO.ciclo),
          h('span', { className: 'ec-badge-org' }, MARCA.nombre)),
        h('h1', { className: 'ec-h1' }, EVENTO.titulo),
        h('p', { className: 'ec-hero-sub' }, EVENTO.tituloLargo),

        est.fase === 'antes' ? h('div', { className: 'ec-countdown-box' },
          h('hr', { className: 'ec-hr' }),
          h('p', { className: 'ec-h3', style: { textAlign: 'center', marginBottom: '.5em' } }, 'Comienza en'),
          h(Cuenta, { falta: est.falta })) : null,

        est.fase === 'despues' ? h('div', { className: 'ec-closing-box' },
          h('hr', { className: 'ec-hr' }),
          h('p', { className: 'ec-h2' }, 'Gracias por acompañarnos'),
          h('p', { className: 'ec-p tenue' }, 'El desayuno ejecutivo ha concluido. Puedes seguir explorando la agenda, los expositores y el marco legal.')) : null),

      est.actual ? h('div', { className: 'ec-card ec-viva' },
        h('div', { className: 'ec-viva-h' },
          h('div', { className: 'ec-viva-tag' },
            h('span', { className: 'ec-punto-live' }),
            h('span', { className: 'ec-h3', style: { margin: 0 } }, 'Sesión en curso')),
          h('span', { className: 'ec-hora' }, est.actual.ini, ' – ', est.actual.fin, ' hrs')),
        h('h2', { className: 'ec-h2' }, est.actual.tema),
        h('p', { className: 'ec-p tenue' }, expositoresDe(est.actual)),
        h('div', { className: 'ec-barra' },
          h('div', {
            className: 'ec-barra-f',
            style: {
              width: Math.round(((ahora - instante(est.actual.ini))
                / (instante(est.actual.fin) - instante(est.actual.ini))) * 100) + '%',
            },
          }))) : null,

      est.siguiente ? h('div', { className: 'ec-card ec-next-card' },
        h('p', { className: 'ec-h3' }, est.fase === 'antes' ? 'Apertura de la jornada' : 'A continuación'),
        h('h3', { className: 'ec-h2' }, est.siguiente.tema),
        h('p', { className: 'ec-p tenue' }, est.siguiente.ini, ' – ', est.siguiente.fin, ' hrs · ', expositoresDe(est.siguiente))) : null,

      h('div', { className: 'ec-quick-actions' },
        h('button', {
          type: 'button', className: 'ec-btn ec-btn-cta',
          onClick: () => irA('agenda'),
        }, 'Ver Agenda y Expositores Completos →'),
        h('button', {
          type: 'button', className: 'ec-btn ghost',
          onClick: () => irA('leyes'),
        }, 'Revisar Marco Legal (Leyes 21.663 y 21.719)')));
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

  /* 2. Agenda y Expositores FUSIONADOS */
  function Agenda(props) {
    const ahora = props.ahora;
    const mostrarFotos = props.mostrarFotos !== false;

    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card ec-hero-card' },
        h('p', { className: 'ec-h3' }, 'Programa Oficial del Evento'),
        h('h1', { className: 'ec-h1' }, 'Agenda y Expositores'),
        h('p', { className: 'ec-p tenue' }, 'Cronograma completo de las conferencias y especialistas del Desayuno Ejecutivo.')),

      AGENDA.map((b) => {
        const est = estadoBloque(b, ahora);
        const sesionSpeakers = b.speakers.map(buscarSpeaker).filter(Boolean);

        return h('div', {
          key: b.id,
          className: 'ec-bloque-card' + (est === 'ahora' ? ' ahora' : '') + (est === 'pasado' ? ' pasado' : ''),
        },
        h('div', { className: 'ec-bloque-top' },
          h('div', { className: 'ec-bloque-hora-badge' },
            h('span', { className: 'ec-bloque-hora-txt' }, b.ini + ' – ' + b.fin + ' hrs'),
            est === 'ahora' ? h('span', { className: 'ec-pill vivo sm' }, 'En curso') : null),
          (b.leyes.length > 0) ? h('div', { className: 'ec-bloque-tags' },
            b.leyes.map((lid) => h('span', { className: 'ec-tag ley', key: lid }, buscarLey(lid).numero))) : null),

        h('h2', { className: 'ec-bloque-titulo' }, b.tema),
        b.resumen ? h('p', { className: 'ec-bloque-resumen' }, b.resumen) : null,

        /* Expositores integrados en el bloque */
        sesionSpeakers.length > 0 ? h('div', { className: 'ec-speakers-grid' },
          sesionSpeakers.map((s) => {
            const org = ORGS[s.org] || {};
            return h('div', { className: 'ec-speaker-box', key: s.id },
              h('div', { className: 'ec-speaker-header' },
                h(Avatar, { speaker: s, mostrarFotos: mostrarFotos }),
                h('div', { className: 'ec-speaker-info' },
                  h('h3', { className: 'ec-speaker-nombre' }, s.nombreLargo || s.nombre),
                  h('p', { className: 'ec-speaker-rol' }, s.rol),
                  h('span', { className: 'ec-speaker-org' }, org.nombre))),
              s.bio ? h('p', { className: 'ec-speaker-bio' }, s.bio) : null,
              h('div', { className: 'ec-speaker-footer' },
                s.fuente ? h('span', { className: 'ec-speaker-fuente' }, 'Fuente: ' + s.fuente) : h('span', null),
                h(Qr, { clave: s.qr, titulo: 'Perfil', alt: s.url })));
          }))
          : (b.id === 'bienvenida'
            ? h('div', { className: 'ec-speaker-box ec-box-org' },
              h('div', { className: 'ec-speaker-header' },
                h(Logo, { hgt: 44 }),
                h('div', { className: 'ec-speaker-info' },
                  h('h3', { className: 'ec-speaker-nombre' }, MARCA.nombre),
                  h('p', { className: 'ec-speaker-rol' }, 'Anfitrión y Organización'))),
              h('p', { className: 'ec-speaker-bio' }, MARCA.descripcion),
              h('div', { className: 'ec-speaker-footer' },
                h('span', { className: 'ec-speaker-fuente' }, MARCA.direccion),
                h(Qr, { clave: 'landing', titulo: 'Landing', alt: EVENTO.landing })))
            : h('div', { className: 'ec-speaker-box ec-box-cierre' },
              h('div', { className: 'ec-speaker-header' },
                h('div', { className: 'ec-sp-ini' }, '🤝'),
                h('div', { className: 'ec-speaker-info' },
                  h('h3', { className: 'ec-speaker-nombre' }, 'Networking y Preguntas Abiertas'),
                  h('p', { className: 'ec-speaker-rol' }, 'Todos los expositores y asistentes'))),
              h('p', { className: 'ec-speaker-bio' }, 'Momento para profundizar consultas, intercambiar experiencias de cumplimiento y coordinar sesiones de trabajo directas con los especialistas.'),
              h('div', { className: 'ec-speaker-footer' },
                h('span', { className: 'ec-speaker-fuente' }, 'Desayuno Ejecutivo 2026'),
                h(Qr, { clave: 'agenda', titulo: 'Agenda .ics', alt: 'Calendario' })))));
      }));
  }

  /* 3. Marco Legal */
  function Leyes() {
    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card ec-hero-card' },
        h('p', { className: 'ec-h3' }, 'Marco Normativo'),
        h('h1', { className: 'ec-h1' }, 'Leyes 21.663 y 21.719'),
        h('p', { className: 'ec-p tenue' }, 'Las dos transformaciones regulatorias más relevantes en ciberseguridad y protección de datos en Chile.')),

      LEYES.map((l) => {
        const sesion = buscarBloque(l.sesion);
        return h('div', { className: 'ec-card ec-ley-card', key: l.id },
          h('div', { className: 'ec-ley-header' },
            h('span', { className: 'ec-ley-n' }, l.numero),
            h('h2', { className: 'ec-h2' }, l.nombre)),
          h('p', { className: 'ec-p' }, l.resumen),
          h('div', { className: 'ec-datos' }, l.datos.map((d) => h('div', { className: 'ec-dato', key: d.k },
            h('p', { className: 'ec-dato-k' }, d.k),
            h('p', { className: 'ec-dato-v' }, d.v)))),
          h('h3', { className: 'ec-h3', style: { marginTop: '1.2em' } }, 'Aspectos Clave a Cumplir:'),
          h('ul', { className: 'ec-lista' }, l.puntos.map((p, i) => h('li', { key: i }, p))),
          sesion ? h('div', { className: 'ec-ley-sesion-ref' },
            h('span', { className: 'ec-tag ley' }, sesion.ini + ' – ' + sesion.fin + ' hrs'),
            h('span', { className: 'ec-ley-sesion-txt' }, 'Tratado en sesión: ', h('strong', null, sesion.tema))) : null);
      }),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-aviso' }, 'Este resumen es estrictamente informativo y no constituye asesoría legal directa. Para planes de adecuación específicos, contacta al equipo consultor o a los expositores durante la jornada.')));
  }

  /* 4. Consulta e Interacción */
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
      h('div', { className: 'ec-card ec-hero-card' },
        h('p', { className: 'ec-h3' }, 'Orientación Consultiva'),
        h('h1', { className: 'ec-h1' }, rec ? 'Recomendación Personalizada' : '¿En qué te orientamos hoy?'),
        h('p', { className: 'ec-p tenue' }, 'Responde 2 preguntas breves para saber qué sesiones, especialistas y normativas son prioritarias para ti.'),
        h('div', { className: 'ec-pasos' }, CONSULTA.map((_, i) => h('span', {
          key: i, className: 'ec-paso' + (i < paso ? ' on' : ''),
        }))),

        !rec && CONSULTA[paso] ? h('div', null,
          h('p', { className: 'ec-h2', style: { fontSize: 'var(--f-lg)', marginBottom: '.8em' } }, CONSULTA[paso].pregunta),
          h('div', { className: 'ec-ops' }, CONSULTA[paso].opciones.map((o) => h('button', {
            key: o.id, type: 'button', className: 'ec-op',
            onClick: () => responder(CONSULTA[paso].id, o.id),
          },
          h('span', { className: 'ec-op-bullet' }),
          h('span', null, o.label))))) : null,

        rec ? h('div', { className: 'ec-rec-box' },
          NOTA_ROL[v.consulta.rol] ? h('p', { className: 'ec-p ec-rec-nota' }, NOTA_ROL[v.consulta.rol]) : null,
          h('hr', { className: 'ec-hr' }),
          h('p', { className: 'ec-h3' }, 'Sesiones Recomendadas:'),
          rec.sesiones.map((id) => {
            const b = buscarBloque(id);
            return h('div', { className: 'ec-rec-item', key: id },
              h('span', { className: 'ec-tag ley' }, b.ini + ' – ' + b.fin + ' hrs'),
              h('div', null,
                h('strong', { style: { color: '#FFFFFF', display: 'block' } }, b.tema),
                h('span', { className: 'ec-p tenue' }, expositoresDe(b))));
          }),
          h('p', { className: 'ec-h3', style: { marginTop: '1.2em' } }, 'Especialistas con quién conversar:'),
          h('p', { className: 'ec-p' }, rec.speakers.map((id) => {
            const s = buscarSpeaker(id);
            return s.nombre + ' (' + (ORGS[s.org] || {}).nombre + ')';
          }).join(' · ')),
          h('p', { className: 'ec-h3', style: { marginTop: '1.2em' } }, 'Normativa a Priorizar:'),
          h('p', { className: 'ec-p' }, rec.leyes.map((id) => buscarLey(id).numero + ' — ' + buscarLey(id).nombre).join(' · ')),
          h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '1.5em' } },
            h('button', {
              type: 'button', className: 'ec-btn ghost',
              onClick: () => { setVista({ consulta: {}, paso: 0 }); marcarActividad(); },
            }, 'Nueva Consulta'),
            h('button', { type: 'button', className: 'ec-btn', onClick: () => irA('agenda') }, 'Ver en la Agenda'))) : null),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Tablón de Preguntas al Panel'),
        h('p', { className: 'ec-p tenue' }, 'Deja tu consulta para la ronda de preguntas y el panel de expositores.'),
        h('div', { className: 'ec-form' },
          h('input', {
            className: 'ec-input', type: 'text', value: texto, maxLength: 400,
            placeholder: 'Escribe tu pregunta para el panel...',
            onChange: (e) => { setTexto(e.target.value); marcarActividad(); },
            onKeyDown: (e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (addPregunta(texto, para)) setTexto(''); }
            },
          }),
          h('select', {
            className: 'ec-select', value: para,
            onChange: (e) => { setPara(e.target.value); marcarActividad(); },
          },
          h('option', { value: '' }, 'Dirigida a: Todo el Panel'),
          SPEAKERS.map((s) => h('option', { key: s.id, value: s.id }, 'Dirigida a: ' + s.nombre))),
          h('button', {
            type: 'button', className: 'ec-btn', disabled: !texto.trim(),
            onClick: () => { if (addPregunta(texto, para)) setTexto(''); },
          }, 'Publicar Pregunta')),
        props.doc.preguntas.length
          ? props.doc.preguntas.slice().reverse().slice(0, 10).map((p) => {
            const s = buscarSpeaker(p.para);
            return h('div', { className: 'ec-preg', key: p.id },
              h('div', { className: 'ec-preg-content' },
                h('p', { className: 'ec-preg-t' }, p.texto),
                h('p', { className: 'ec-preg-p' }, s ? 'Para ' + s.nombre : 'Para todo el panel')));
          })
          : h('div', { className: 'ec-vacio' }, 'Aún no hay preguntas en el tablón. Sé la primera persona en enviar una.')),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-h3' }, 'Encuesta de Interés de la Sala'),
        h('p', { className: 'ec-p tenue' }, totalVotos
          ? totalVotos + ' voto' + (totalVotos === 1 ? '' : 's') + ' registrados. Toca un tema para votar:'
          : 'Toca el tema que más te interesa resolver:'),
        TEMAS_VOTO.map((t) => {
          const n = props.doc.votos[t.id] || 0;
          const pct = totalVotos ? Math.round((n / totalVotos) * 100) : 0;
          return h('div', { className: 'ec-voto', key: t.id },
            h('button', {
              type: 'button', className: 'ec-op', style: { marginBottom: '.5em' },
              onClick: () => votar(t.id),
            },
            h('span', { style: { flex: 1 } }, t.texto),
            h('span', { className: 'ec-voto-n' }, n + (totalVotos ? ' (' + pct + '%)' : ''))),
            h('div', { className: 'ec-voto-b' }, h('div', { className: 'ec-voto-f', style: { width: pct + '%' } })));
        })));
  }

  /* ── Componente Raíz ───────────────────────────────────────────────── */

  function Component() {
    const [estado, setEstado] = React.useState({ doc, vista, config });
    const [ahora, setAhora] = React.useState(() => Date.now());
    const [modo, setModo] = React.useState('escritorio');
    const raizRef = React.useRef(null);

    React.useEffect(() => {
      listeners.add(setEstado);
      return () => { listeners.delete(setEstado); };
    }, []);

    React.useEffect(() => {
      const t = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        setAhora(Date.now());
      }, 1000);
      return () => clearInterval(t);
    }, []);

    React.useEffect(() => {
      const el = raizRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return undefined;
      const medir = () => {
        const forzado = estado.config.modo;
        if (forzado === 'totem' || forzado === 'escritorio') { setModo(forzado); return; }
        const { clientWidth: w, clientHeight: hgt } = el;
        setModo(hgt >= 950 && hgt > w * 1.15 ? 'totem' : 'escritorio');
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
      agenda: () => h(Agenda, { ahora: ahora, mostrarFotos: cfg.mostrarFotos !== false }),
      leyes: () => h(Leyes, null),
      consulta: () => h(Consulta, { vista: v, doc: d }),
    };

    const hora = new Date(ahora);

    return h('div', {
      ref: raizRef,
      className: 'kimos-evento-ciberseguridad modo-' + modo,
      style: cfg.acento ? { '--nt-cyan': cfg.acento } : null,
      onPointerDown: marcarActividad,
      onKeyDown: marcarActividad,
    },

    /* Header Superior Ampliado */
    h('header', { className: 'ec-hd' },
      h(Logo, { hgt: modo === 'totem' ? 68 : 46 }),
      h('div', { className: 'ec-hd-est' },
        est.fase === 'durante'
          ? h('span', { className: 'ec-pill vivo' }, h('span', { className: 'ec-punto-live' }), 'En vivo')
          : h('span', { className: 'ec-pill evento' }, 'Desayuno 2026'),
        h('span', { className: 'ec-reloj' }, pad2(hora.getHours()) + ':' + pad2(hora.getMinutes())),
        h('span', { className: 'ec-ver', title: EVENTO.titulo + ' v' + APP_VERSION }, 'v' + APP_VERSION))),

    /* Botones de Navegación Superiores (sobre el contenedor inicial) */
    h('nav', { className: 'ec-nav', 'aria-label': 'Navegación principal' },
      SECCIONES.map((s) => {
        let IconComp = IconAhora;
        if (s.id === 'agenda') IconComp = IconAgenda;
        else if (s.id === 'leyes') IconComp = IconLeyes;
        else if (s.id === 'consulta') IconComp = IconConsulta;

        return h('button', {
          key: s.id,
          type: 'button',
          'aria-current': v.seccion === s.id ? 'page' : undefined,
          className: 'ec-nav-b' + (v.seccion === s.id ? ' on' : ''),
          onClick: () => irA(s.id),
        },
        h('div', { className: 'ec-nav-ico' }, h(IconComp)),
        h('span', { className: 'ec-nav-lbl' }, s.label));
      })),

    /* Cuerpo Principal Desplazable */
    h('main', { className: 'ec-body' }, (vistas[v.seccion] || vistas.ahora)()),

    /* Pie corporativo */
    h(Pie, null));
  }

  return {
    Component,
    unmount() {
      clearTimeout(guardarT);
      clearTimeout(inactividadT);
      listeners.clear();
      if (offAgent) { try { offAgent(); } catch (e) { /* desregistrado */ } }
      if (offConfig) { try { offConfig(); } catch (e) { /* desuscrito */ } }
    },
  };
}
