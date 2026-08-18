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

const APP_VERSION = '2.5.0';

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

/* Foto de Bernardo Donoso embebida (no tiene URL pública de la organización). */
const FOTO_BERNARDO = 'data:image/jpeg;base64,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';

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
    rol: 'Especialista en TI y Protección de Datos',
    org: 'lineage',
    qr: 'bernardo-donoso',
    url: 'https://www.linkedin.com/in/bernardo-donoso-bri%C3%B3n-73108b239/',
    bio: 'Ex Director de TIC para Latinoamérica y Asesor TI para Asia en una multinacional de '
      + 'manufactura, y Customer Success Manager en consultoría de software Microsoft. Diplomado en '
      + 'Administración de Empresas (Universidad Católica), con foco en dirección de equipos y '
      + 'proyectos TI.',
    fuente: 'Perfil profesional público',
    foto: FOTO_BERNARDO,
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

/* ── Diagnóstico Rápido de Cumplimiento ───────────────────────────────────
 * Formulario de 10 preguntas · 10 puntos cada una · 100 puntos totales.
 * El enunciado y el orden de las alternativas se conservan tal cual llegan
 * del formulario oficial. El puntaje por alternativa es el de la pauta:
 * control implementado = 10, implementado a medias = 5, ausente o
 * "No aplica" = 0. Cada pregunta apunta a la ley que la exige, para poder
 * enlazar las brechas con la sección de Marco Legal.
 */

const DIAGNOSTICO = {
  titulo: 'Diagnóstico Rápido de Cumplimiento en Ciberseguridad y Protección de Datos',
  aviso: 'Cuando envíe este formulario, no recopilará automáticamente sus detalles, '
    + 'como el nombre y la dirección de correo electrónico, a menos que lo proporcione usted mismo.',
  puntosPregunta: 10,
  preguntas: [
    {
      id: 'politica-seguridad',
      texto: '¿Tu empresa cuenta con una política de seguridad de la información formalmente documentada?',
      leyes: ['21663'],
      opciones: [
        { id: 'actualizada', label: 'Sí, existe y está actualizada', puntos: 10 },
        { id: 'desactualizada', label: 'Sí, pero no está actualizada', puntos: 5 },
        { id: 'no-existe', label: 'No existe', puntos: 0 },
      ],
    },
    {
      id: 'politica-privacidad',
      texto: '¿Está publicada la política de privacidad en tu sitio web o plataforma digital?',
      leyes: ['21719'],
      opciones: [
        { id: 'no-publicada', label: 'No está publicada', puntos: 0 },
        { id: 'publicada', label: 'Sí, está publicada y accesible', puntos: 10 },
        { id: 'no-aplica', label: 'No aplica', puntos: 0 },
      ],
    },
    {
      id: 'consentimiento',
      texto: '¿Se registra evidencia del consentimiento de los titulares para el tratamiento de sus datos personales?',
      leyes: ['21719'],
      opciones: [
        { id: 'registra', label: 'Sí, se registra y almacena evidencia', puntos: 10 },
        { id: 'no-registra', label: 'No se registra evidencia', puntos: 0 },
        { id: 'no-aplica', label: 'No aplica', puntos: 0 },
      ],
    },
    {
      id: 'derechos-titulares',
      texto: '¿Tu empresa tiene un proceso formal para atender solicitudes de acceso, rectificación o eliminación de datos personales?',
      leyes: ['21719'],
      opciones: [
        { id: 'no-aplica', label: 'No aplica', puntos: 0 },
        { id: 'sin-proceso', label: 'No existe proceso formal', puntos: 0 },
        { id: 'con-proceso', label: 'Sí, existe y es conocido por los responsables', puntos: 10 },
      ],
    },
    {
      id: 'control-acceso',
      texto: '¿Se controla el acceso a información sensible mediante roles y permisos definidos?',
      leyes: ['21663', '21719'],
      opciones: [
        { id: 'no-aplica', label: 'No aplica', puntos: 0 },
        { id: 'sin-control', label: 'No se controla el acceso', puntos: 0 },
        { id: 'por-roles', label: 'Sí, el acceso está controlado por roles', puntos: 10 },
      ],
    },
    {
      id: 'mfa',
      texto: '¿Está implementado el doble factor de autenticación (MFA) en los sistemas críticos?',
      leyes: ['21663'],
      opciones: [
        { id: 'no-implementado', label: 'No está implementado', puntos: 0 },
        { id: 'parcial', label: 'Solo en algunos sistemas', puntos: 5 },
        { id: 'completo', label: 'Sí, en todos los sistemas críticos', puntos: 10 },
      ],
    },
    {
      id: 'backups',
      texto: '¿Tu empresa realiza backups formales y tiene un plan de recuperación ante desastres?',
      leyes: ['21663'],
      opciones: [
        { id: 'nada', label: 'No existen backups ni plan', puntos: 0 },
        { id: 'solo-backups', label: 'Solo existen backups, sin plan de recuperación', puntos: 5 },
        { id: 'completo', label: 'Sí, existen backups y plan de recuperación', puntos: 10 },
      ],
    },
    {
      id: 'proveedores',
      texto: '¿Los proveedores críticos cuentan con contratos o NDA que incluyan cláusulas de protección de datos y ciberseguridad?',
      leyes: ['21663', '21719'],
      opciones: [
        { id: 'algunos', label: 'Solo algunos proveedores tienen contratos/NDA', puntos: 5 },
        { id: 'todos', label: 'Sí, todos los proveedores críticos tienen contratos/NDA', puntos: 10 },
        { id: 'ninguno', label: 'No existen contratos/NDA', puntos: 0 },
      ],
    },
    {
      id: 'incidentes',
      texto: '¿Existe un procedimiento formal para la gestión de incidentes de ciberseguridad?',
      leyes: ['21663'],
      opciones: [
        { id: 'no-aplica', label: 'No aplica', puntos: 0 },
        { id: 'sin-procedimiento', label: 'No existe procedimiento formal', puntos: 0 },
        { id: 'documentado', label: 'Sí, existe y está documentado', puntos: 10 },
      ],
    },
    {
      id: 'clasificacion',
      texto: '¿La información sensible está clasificada y existe registro de actividades de tratamiento?',
      leyes: ['21719'],
      opciones: [
        { id: 'completo', label: 'Sí, la información está clasificada y existe registro', puntos: 10 },
        { id: 'nada', label: 'No existe clasificación ni registro', puntos: 0 },
        { id: 'solo-clasificacion', label: 'Solo existe clasificación, sin registro', puntos: 5 },
      ],
    },
  ],
};

const PUNTAJE_MAXIMO = DIAGNOSTICO.preguntas.length * DIAGNOSTICO.puntosPregunta;

/* Formulario del diagnóstico para continuarlo en el móvil (Microsoft Forms). */
const DIAG_FORM_URL = 'https://forms.cloud.microsoft/pages/responsepage.aspx?id=R1mP2j4yJ0CVmtXGTqrHAhB7Pg_7zc1JoeYpK8cupBpUNE1KTzFTSUw0WFlPOEFITkw4VE1DRjhDVi4u&route=shorturl';

/* Tramos del resultado, de menor a mayor puntaje. */
const NIVELES = [
  {
    id: 'critico',
    desde: 0,
    hasta: 40,
    titulo: 'Riesgo crítico',
    color: '#FF5B7A',
    resumen: 'Faltan controles básicos que las Leyes 21.663 y 21.719 ya exigen. '
      + 'La prioridad es levantar el estado actual y partir por las políticas y el control de accesos.',
  },
  {
    id: 'inicial',
    desde: 41,
    hasta: 70,
    titulo: 'Cumplimiento en desarrollo',
    color: '#FFB84D',
    resumen: 'Hay una base parcial, pero con brechas que dejan expuesta a la organización '
      + 'ante una fiscalización o un incidente. Conviene cerrar los controles a medio implementar.',
  },
  {
    id: 'avanzado',
    desde: 71,
    hasta: 90,
    titulo: 'Cumplimiento avanzado',
    color: '#00E4D0',
    resumen: 'La mayoría de los controles está operando. Quedan brechas puntuales '
      + 'que conviene formalizar y documentar antes de los plazos de adecuación.',
  },
  {
    id: 'consolidado',
    desde: 91,
    hasta: 100,
    titulo: 'Cumplimiento consolidado',
    color: '#2FD98A',
    resumen: 'El marco de control está maduro. El foco pasa a mantener la evidencia al día '
      + 'y a extender las exigencias a la cadena de proveedores.',
  },
];

/* 4 Secciones principales */
const SECCIONES = [
  { id: 'ahora', ico: 'ahora', label: 'Ahora' },
  { id: 'agenda', ico: 'agenda', label: 'Agenda y Expositores' },
  { id: 'leyes', ico: 'leyes', label: 'Marco Legal' },
  { id: 'consulta', ico: 'consulta', label: 'Diagnóstico de Cumplimiento' },
];

/* ── QR Precalculados Embebidos ───────────────────────────────────────── */

const QR = {
  'landing': { n: 37, b: '/lHAC/wTJV2QbrfBTrt1eofl26in2q7BTCINB/qqqq/gFY3HAL5NhOPm4tt0aY2z9DcuKDJ8YJP7PS5vqGRchIO4DorvbT9jMrCv5z7HtWh8Ckmm1JL9xjlhDE4X7oYnbjDKfoYg3DcwX2qUzNPz4vmE3r2tu1FKIuZlvi9p2j00GKMdD/8AblyUa/lGiarwXHElG7qvPt+l1nwFt66+gokDBP1OHR/pBCZPgA==' },
  'nexttime': { n: 29, b: '/ncb/BO/UG6jSLt1xoXbqJuuwUwFB/qqr+ASUwC+SOvlIrvcTsPwIeoqW6gqtJYwGN/GeaGbkYlTAoYAwWUqe/1pwfLpAQozKKe1+4BE9H/5gGuQU1MSupivrdWbwy65cf0ERvCv6dESAA==' },
  'agenda': { n: 53, b: '/tEb8rIj/Bbcza/DkG6gtDbvxLt08fz9n9XbrY9vvOIuwR9xxo0xB/qqqqqqr+AJytF42wCf99L8jIy9hQruE9/blrGDUUt0+OmtTY+i/pK9J7Gq2i0aECtFLXbVHoPge/5Fsp5WvoqNTCLAyK38YY2PaSYS5bSuraZPPzF6y1J3Yo3NYbfvmmervmpHTbe5//qPze+ij0ACtsmIW8NL/91D/oKf0MROnFofRWq46Opd8rPxcq8bxNHT/u2PqIP8Sl7CGbyTcqlYTGYmKSmgAhqofOcCHisoebUgaPXJp7vOGM3VW/8hcDC8u/1O87wqW/uLy3Nq6sGDSxD2vBcaRtoId5mI/+yOH1t2lPuoKUAqgnWbMVc3gVh9N5LCwnNJ6LVVQTOlL+aN+oBFycf/nHv66e6j9WqQXmYxhpsYuuMh+kzvhdZFzdr7ga6f/rg1kbUEq0y2ZF5f7knLOJGgAA==' },
  'lilian-jimenez': { n: 33, b: '/ni5P8Es9lButtHLt1EtdduvulLsFaA1B/qqqv4BUU8AvlZDvh66fZtb++O62qKT4e9+Kr3CqesJPoonMYwZ4hj8C0tT2OK4Dvt6gsuOxKm36/VyYy3VSD2NJh+pi1VQHS7Xuyxz+ABgfMV/inDq0F8OsfutuK/d1Rvqbur3N9EESlwc/qFD0QA=' },
  'jose-gaete': { n: 33, b: '/hS9P8EDsFBuvw+Lt15fZdus05LsFj9hB/qqqv4BZjwAvl9SviQZeJtsvHC6whZT7edyAz3LKR/ZPlzpK5SrCQj8vg5S2IL1PvtBs1OWxovcr+/v6aXXY7vJJjqmISVwAgztpp9i+QBAXMV/k+jq0Frh8fuu4i/F1U7qXupxP9kELRwc/uJT0QA=' },
  'cristian-maulen': { n: 33, b: '/hq9P8Eg0lBusIeLt1AmtdurOKLsFWOtB/qqqv4BwT4Avk5TvnSSeJtbw/Cy2J2fKcGqqfzWDYsFDmlnKZxAGgrslu9D2LgbHvvk68se0JbQ4/B5g03ETq5dFr4wQx17TT7fvyJz+IBgfMX/nHDq0FutMeuuCO/N1qsqZus3P8EETgyc/vtD0QA=' },
  'bernardo-donoso': { n: 37, b: '/jqq4/wSb5LQbqLPrLt1WLXl26iTmK7BZJUJB/qqqq/gGAABAL5EL8vgLGwBGp6Sg2/eSk1OShv4bD97umN+poGeJxBve6Kf4jP3CJXqs+arVCKuuPSP/8hOOhgde/cfbkBPXIYh6dSJTzwM0jOyV8guz7bG7g8DKPWCh+cr7Q14uaykvv6AYn6MY/l3MyrwUN3hGrqWhV+t1Sl/1G6l5BoHBB57OR/vNS0NgA==' },
  'leonardo-jadue': { n: 33, b: '/nS9P8ELglBuqWeLt1FfddutETLsFV8hB/qqqv4BJj8Avn9CvgD8WpvAxngi2YZT6eb3Bb3E6n+ZHl9pKeTRtSj8IvRD2IaNHvti3doWywMU49t0ha3fTGuPNk9+IQ1CGRzdk/By+IBkXMV/mGlq0Fbh8fupBi/d1JK6busVP9EETyyU/otD0QA=' },
  'customertrigger': { n: 29, b: '/kcb/BH/UG6pSrt1psXbr5+uwVAlB/qqr+AcVwC+WMPgiLn8d6n6oRI6N6nhtBYI4P/FjCEtkZRQEvpo0Wble/1iv+BpW1ojKWc2+4Bw/H/5AWuQXlMSuuCvrdRbCy6j9P0Ebvqv6JFqAA==' },
  'lineage': { n: 29, b: '/jzz/BRfkG6Zprt0/jXbqycuwRYdB/qqr+AA2QCqW1iUJNpyb88a7iKS0CmnDOWYtscn3k85ZwTfWncDRlqkWHNuvwHmyALjq6qO+ABuzF/4z2twRN0aupsvldEYjS6qFXMETjov6imxgA==' },
  'nexoabogados': { n: 33, b: '/mC5P8Ewx1BuvsnLt1Qpdduru9rsFyBxB/qqqv4BAU8AvgZCvkC2fZtk5esy3SmT6eS/rDXFbsvJPjj3MczSyhrMAqFT2IoqDPt2nNqexq+zo/z9xS3WK+3JJhzhizUpMSzerxBi/IBKfsV/nXDq0FGCsfuu1K/d1ErqXut/N9EEIH5U/p9T0QA=' },
  'diagnostico-form': { n: 49, b: '/tjB1gS/wUvlidvQbpGLJLVrt1ScNuul26DAvxxC7BEMsdCRB/qqqqqq/gHKLETfALc9R/xBJZRhuGOEt6WxMvIudhoZUswx9PIoKJoxqU0rtf3OerR+znLDHI2TqkAf+NFnQLZwop2mwdtMMOd8+abgPzF9Ltu8r2q38TCR5WFXTByE/KPmP1Qv66Pg0UjEYTcd6p1eohqu7HFvEitES/+6/8H/wQoD31gQPap9P3hOoayZGq9uF/y6XFdb17LENjBuOkM/z9o2aphvWsdOYEbfj97k0A8l0Ck9ZvTkx3oR278LZNKG8vUafzZuK3Th3GWWITPiNuPnhvsAWEkSHMR/rl+ua6twXklHh3G7pj7/lB+l1A2rcq/e6wIh58z/BIKLAPGs/rMxYUxlgA==' },
};

/* ── Logotipo de Kimos (vectorizado desde kimos-enterprice: frontend/public/logos/KIMOS.png) ── */

const KIMOS_LOGO = {
  viewBox: '0 0 706 144',
  d: 'M0 0 L46 39 L46 67 L48 67 L51 63 L53 63 L57 58 L59 58 L63 53 L65 53 L69 48 L71 48 L75 43 L77 43 L81 38 L83 38 L87 33 L89 33 L93 28 L95 28 L99 23 L101 23 L105 18 L107 18 L111 13 L113 13 L113 12 L70 12 L70 29 L66 31 L62 36 L59 37 L59 0 L141 0 L133 9 L131 9 L122 19 L120 19 L101 38 L99 38 L94 44 L92 44 L86 51 L84 51 L79 57 L77 57 L71 64 L69 64 L63 71 L61 71 L56 77 L54 77 L48 84 L46 84 L37 93 L36 93 L36 44 L34 44 L29 38 L27 38 L22 32 L20 32 L16 27 L14 27 L11 24 L11 121 L13 121 L20 114 L22 114 L26 109 L28 109 L32 104 L34 104 L38 99 L40 99 L50 89 L52 89 L55 85 L57 85 L61 80 L66 79 L72 86 L74 86 L80 93 L82 93 L88 100 L90 100 L97 108 L99 108 L105 115 L107 115 L113 122 L115 122 L122 130 L124 130 L138 144 L59 144 L59 110 L61 110 L66 116 L70 118 L70 133 L71 134 L111 134 L105 127 L103 127 L99 122 L97 122 L92 116 L90 116 L86 111 L84 111 L79 105 L77 105 L66 94 L62 94 L59 98 L57 98 L54 102 L52 102 L49 106 L47 106 L44 110 L42 110 L39 114 L37 114 L34 118 L32 118 L29 122 L27 122 L24 126 L22 126 L19 130 L17 130 L14 134 L12 134 L9 138 L7 138 L4 142 L0 144ZM167 0 L185 0 L185 144 L167 144ZM209 0 L233 0 L235 4 L240 8 L240 10 L245 14 L245 16 L250 20 L250 22 L255 26 L255 28 L260 32 L260 34 L265 38 L265 40 L270 44 L270 46 L275 50 L275 52 L280 56 L280 58 L286 63 L286 65 L290 69 L292 69 L292 67 L299 61 L299 59 L306 53 L306 51 L312 46 L312 44 L319 38 L319 36 L326 30 L326 28 L333 22 L333 20 L340 14 L340 12 L347 6 L347 4 L351 0 L375 0 L375 144 L357 144 L357 22 L354 23 L354 25 L347 31 L347 33 L341 38 L341 40 L334 46 L334 48 L328 53 L328 55 L321 61 L321 63 L315 68 L315 70 L308 76 L308 78 L302 83 L302 85 L295 91 L295 93 L291 97 L282 88 L282 86 L276 81 L276 79 L271 75 L271 73 L265 68 L265 66 L259 61 L259 59 L254 55 L254 53 L248 48 L248 46 L242 41 L242 39 L237 35 L237 33 L231 28 L231 26 L226 22 L226 144 L209 144ZM409 0 L526 0 L526 1 L530 1 L534 3 L538 7 L540 14 L541 14 L541 131 L540 131 L539 136 L534 141 L530 143 L526 143 L526 144 L409 144 L409 143 L404 142 L397 135 L396 129 L395 129 L395 15 L396 15 L396 12 L399 6 L402 3 L409 1ZM581 0 L692 0 L692 1 L699 2 L700 4 L703 5 L705 12 L706 12 L706 30 L689 30 L687 21 L680 17 L583 17 L578 21 L578 25 L577 25 L577 60 L582 65 L586 65 L586 66 L693 66 L693 67 L696 67 L704 76 L705 83 L706 83 L706 130 L705 130 L705 134 L703 138 L699 142 L695 144 L576 144 L576 143 L571 142 L565 137 L562 131 L562 116 L577 116 L580 126 L585 129 L681 129 L681 128 L685 128 L689 121 L689 85 L684 81 L681 81 L681 80 L580 80 L580 79 L575 79 L569 76 L564 71 L563 66 L562 66 L562 16 L563 16 L565 9 L570 4 L576 1 L581 1ZM426 18 L418 21 L413 31 L413 116 L414 116 L415 122 L419 126 L426 128 L426 129 L508 129 L508 128 L514 128 L514 127 L519 126 L522 123 L523 118 L524 118 L524 29 L523 29 L522 24 L518 20 L511 19 L511 18Z',
};

/* Isotipo (icosaedro) de Kimos, vectorizado desde el logo oficial en fondo azul. */
const KIMOS_ICONO = {
  viewBox: '0 0 298 341',
  d: 'M145 0 L151 0 L151 1 L155 2 L156 5 L158 5 L159 7 L165 9 L166 11 L172 13 L173 15 L179 17 L180 19 L186 21 L187 23 L193 25 L194 27 L200 29 L201 31 L207 33 L208 35 L214 37 L215 39 L221 41 L222 43 L228 45 L229 47 L235 49 L236 51 L238 51 L238 52 L242 53 L243 55 L249 57 L250 59 L256 61 L257 63 L259 63 L262 66 L268 68 L269 70 L275 72 L276 74 L282 76 L283 78 L291 81 L296 86 L296 88 L298 90 L298 250 L297 250 L296 255 L288 263 L286 263 L285 265 L279 267 L278 269 L274 270 L273 272 L271 272 L271 273 L267 274 L266 276 L260 278 L259 280 L255 281 L254 283 L248 285 L247 287 L245 287 L242 290 L236 292 L235 294 L231 295 L230 297 L224 299 L223 301 L219 302 L218 304 L212 306 L211 308 L207 309 L206 311 L200 313 L199 315 L195 316 L194 318 L188 320 L187 322 L183 323 L182 325 L180 325 L180 326 L176 327 L175 329 L169 331 L168 333 L164 334 L163 336 L161 336 L161 337 L159 337 L155 340 L151 340 L151 341 L141 340 L141 339 L137 338 L136 336 L130 334 L129 332 L127 332 L127 331 L123 330 L122 328 L116 326 L115 324 L111 323 L110 321 L104 319 L103 317 L101 317 L101 316 L97 315 L96 313 L90 311 L89 309 L83 307 L82 305 L78 304 L77 302 L75 302 L75 301 L71 300 L70 298 L64 296 L63 294 L57 292 L56 290 L52 289 L51 287 L45 285 L44 283 L42 283 L42 282 L38 281 L37 279 L31 277 L30 275 L24 273 L23 271 L19 270 L18 268 L12 266 L11 264 L9 264 L5 261 L5 259 L3 258 L3 256 L1 254 L1 251 L0 251 L0 91 L1 91 L1 87 L9 79 L15 77 L16 75 L22 73 L23 71 L29 69 L30 67 L36 65 L37 63 L43 61 L44 59 L50 57 L51 55 L57 53 L58 51 L64 49 L65 47 L71 45 L72 43 L78 41 L79 39 L85 37 L86 35 L92 33 L93 31 L99 29 L100 27 L106 25 L107 23 L113 21 L114 19 L116 19 L116 18 L120 17 L121 15 L127 13 L128 11 L134 9 L135 7 L139 6ZM152 11 L148 14 L147 21 L146 21 L146 24 L145 24 L145 27 L144 27 L144 30 L143 30 L143 33 L142 33 L142 37 L141 37 L141 40 L140 40 L140 43 L139 43 L139 46 L138 46 L138 49 L137 49 L137 53 L136 53 L136 56 L141 60 L142 63 L157 65 L157 66 L163 66 L163 67 L176 68 L176 69 L182 69 L182 70 L188 70 L188 71 L207 73 L207 74 L213 74 L213 75 L220 75 L220 76 L226 76 L226 77 L232 77 L232 78 L238 78 L238 79 L245 79 L245 80 L251 80 L251 81 L257 81 L257 82 L263 82 L263 83 L269 83 L269 84 L283 85 L279 81 L271 78 L270 76 L264 74 L263 72 L257 70 L256 68 L250 66 L249 64 L241 61 L240 59 L234 57 L233 55 L227 53 L226 51 L220 49 L219 47 L211 44 L210 42 L204 40 L203 38 L197 36 L196 34 L190 32 L189 30 L181 27 L180 25 L174 23 L173 21 L167 19 L166 17 L160 15 L159 13 L157 13 L155 11ZM140 12 L138 14 L132 16 L131 18 L125 20 L124 22 L120 23 L119 25 L113 27 L112 29 L106 31 L105 33 L99 35 L98 37 L92 39 L91 41 L85 43 L84 45 L78 47 L77 49 L73 50 L72 52 L66 54 L65 56 L59 58 L58 60 L52 62 L51 64 L45 66 L44 68 L38 70 L37 72 L31 74 L30 76 L24 78 L23 80 L18 82 L18 85 L27 84 L27 83 L31 83 L31 82 L36 82 L36 81 L40 81 L40 80 L45 80 L45 79 L49 79 L49 78 L54 78 L54 77 L58 77 L58 76 L63 76 L63 75 L67 75 L67 74 L72 74 L72 73 L76 73 L76 72 L80 72 L80 71 L85 71 L85 70 L89 70 L89 69 L94 69 L94 68 L98 68 L98 67 L103 67 L103 66 L119 63 L124 57 L126 57 L127 55 L129 55 L131 53 L131 50 L132 50 L132 47 L133 47 L133 44 L134 44 L134 41 L135 41 L135 38 L136 38 L136 35 L137 35 L137 32 L138 32 L138 29 L139 29 L139 26 L140 26 L140 23 L141 23 L141 19 L142 19 L142 16 L143 16 L143 12ZM118 69 L108 71 L108 72 L98 73 L98 74 L94 74 L94 75 L89 75 L89 76 L85 76 L85 77 L75 78 L75 79 L71 79 L71 80 L61 81 L61 82 L57 82 L57 83 L52 83 L52 84 L48 84 L48 85 L43 85 L43 86 L38 86 L38 87 L34 87 L34 88 L20 90 L20 91 L18 91 L16 96 L14 98 L12 98 L14 106 L16 108 L16 111 L18 113 L18 116 L20 118 L20 121 L22 123 L22 126 L23 126 L24 131 L26 133 L27 139 L29 141 L29 144 L31 146 L31 149 L33 151 L33 154 L35 156 L35 159 L37 161 L37 164 L38 164 L39 169 L40 169 L41 172 L45 172 L48 169 L48 167 L51 165 L51 163 L54 161 L54 159 L57 157 L59 152 L62 150 L62 148 L65 146 L65 144 L68 142 L68 140 L71 138 L71 136 L74 134 L74 132 L77 130 L77 128 L80 126 L80 124 L83 122 L83 120 L86 118 L86 116 L89 114 L89 112 L95 106 L97 101 L100 99 L100 97 L103 95 L103 93 L106 91 L106 89 L109 87 L109 85 L112 83 L112 81 L115 79 L115 77 L121 71 L121 69ZM145 70 L144 70 L144 72 L154 81 L154 83 L166 94 L166 96 L178 107 L178 109 L191 121 L191 123 L203 134 L203 136 L216 148 L216 150 L228 162 L231 161 L231 160 L236 161 L238 159 L238 157 L241 155 L243 150 L246 148 L246 146 L249 144 L249 142 L252 140 L254 135 L257 133 L257 131 L260 129 L260 127 L263 125 L265 120 L268 118 L268 116 L271 114 L271 112 L274 110 L276 105 L279 103 L279 101 L283 97 L283 94 L282 94 L281 90 L274 90 L274 89 L268 89 L268 88 L261 88 L261 87 L255 87 L255 86 L248 86 L248 85 L242 85 L242 84 L228 83 L228 82 L222 82 L222 81 L215 81 L215 80 L209 80 L209 79 L202 79 L202 78 L196 78 L196 77 L189 77 L189 76 L182 76 L182 75 L176 75 L176 74 L169 74 L169 73ZM126 74 L122 77 L122 79 L119 81 L119 83 L116 85 L116 87 L113 89 L113 91 L110 93 L110 95 L107 97 L107 99 L104 101 L104 103 L101 105 L101 107 L98 109 L98 111 L95 113 L95 115 L92 117 L92 119 L89 121 L89 123 L86 125 L86 127 L83 129 L83 131 L80 133 L80 135 L77 137 L77 139 L74 141 L74 143 L71 145 L71 147 L68 149 L68 151 L65 153 L65 155 L62 157 L62 159 L59 161 L59 163 L56 165 L56 167 L50 173 L50 175 L51 175 L51 186 L50 187 L57 194 L59 194 L65 201 L67 201 L73 208 L75 208 L81 215 L83 215 L88 221 L90 221 L96 228 L98 228 L104 235 L106 235 L112 242 L114 242 L120 249 L122 249 L128 256 L130 256 L136 263 L138 263 L141 267 L152 267 L156 263 L156 261 L160 258 L160 256 L164 253 L164 251 L168 248 L168 246 L177 237 L177 235 L181 232 L181 230 L185 227 L185 225 L189 222 L189 220 L193 217 L193 215 L197 212 L197 210 L202 206 L202 204 L210 196 L210 194 L214 191 L214 189 L218 186 L218 184 L222 181 L222 179 L224 178 L223 177 L223 168 L224 168 L224 166 L213 156 L213 154 L202 144 L202 142 L191 132 L191 130 L180 120 L180 118 L169 108 L169 106 L158 96 L158 94 L147 84 L147 82 L139 74ZM291 97 L286 100 L286 102 L283 104 L281 109 L275 115 L273 120 L270 122 L270 124 L267 126 L265 131 L262 133 L260 138 L257 140 L257 142 L254 144 L252 149 L249 151 L249 153 L246 155 L246 157 L244 158 L244 160 L240 164 L240 167 L241 167 L240 179 L243 181 L243 183 L246 185 L246 187 L249 189 L249 191 L252 193 L252 195 L255 197 L255 199 L258 201 L258 203 L261 205 L261 207 L264 209 L264 211 L267 213 L267 215 L270 217 L270 219 L273 221 L273 223 L276 225 L276 227 L279 229 L279 231 L282 233 L282 235 L286 238 L286 240 L288 242 L291 242ZM8 102 L7 102 L7 243 L10 242 L10 240 L11 240 L11 238 L12 238 L12 236 L13 236 L13 234 L14 234 L14 232 L15 232 L15 230 L16 230 L16 228 L17 228 L17 226 L18 226 L18 224 L19 224 L19 222 L20 222 L20 220 L21 220 L21 218 L22 218 L22 216 L23 216 L23 214 L24 214 L24 212 L25 212 L25 210 L26 210 L26 208 L27 208 L27 206 L28 206 L28 204 L29 204 L29 202 L30 202 L30 200 L31 200 L31 198 L32 198 L32 196 L35 192 L34 179 L35 179 L35 175 L36 175 L35 171 L33 169 L32 163 L30 161 L30 158 L28 156 L28 153 L26 151 L26 148 L24 146 L21 135 L19 133 L19 130 L17 128 L17 125 L15 123 L15 120 L13 118 L12 112 L11 112 L10 107 L8 105ZM228 182 L223 187 L223 189 L219 192 L219 194 L215 197 L215 199 L211 202 L211 204 L206 208 L206 210 L202 213 L202 215 L198 218 L198 220 L194 223 L194 225 L190 228 L190 230 L186 233 L186 235 L182 238 L182 240 L173 249 L173 251 L169 254 L169 256 L165 259 L165 261 L161 264 L161 266 L157 269 L157 273 L170 271 L170 270 L176 270 L176 269 L182 269 L182 268 L188 268 L188 267 L194 267 L194 266 L200 266 L200 265 L206 265 L206 264 L212 264 L212 263 L218 263 L218 262 L224 262 L224 261 L230 261 L230 260 L236 260 L236 259 L242 259 L242 258 L248 258 L248 257 L254 257 L254 256 L259 256 L259 255 L282 252 L283 245 L280 243 L278 238 L275 236 L273 231 L270 229 L268 224 L265 222 L265 220 L263 219 L261 214 L258 212 L258 210 L253 205 L253 203 L248 198 L248 196 L243 191 L243 189 L238 184 L238 182ZM47 191 L44 192 L44 193 L39 193 L39 195 L38 195 L38 197 L37 197 L37 199 L36 199 L36 201 L35 201 L35 203 L34 203 L34 205 L33 205 L33 207 L32 207 L32 209 L31 209 L31 211 L30 211 L30 213 L29 213 L29 215 L28 215 L28 217 L27 217 L27 219 L26 219 L26 221 L25 221 L25 223 L24 223 L24 225 L23 225 L23 227 L22 227 L22 229 L21 229 L21 231 L20 231 L20 233 L19 233 L19 235 L18 235 L18 237 L17 237 L17 239 L16 239 L16 241 L15 241 L15 243 L12 247 L14 252 L26 253 L26 254 L32 254 L32 255 L39 255 L39 256 L45 256 L45 257 L52 257 L52 258 L58 258 L58 259 L65 259 L65 260 L71 260 L71 261 L78 261 L78 262 L85 262 L85 263 L91 263 L91 264 L98 264 L98 265 L104 265 L104 266 L111 266 L111 267 L117 267 L117 268 L124 268 L124 269 L130 269 L130 270 L136 270 L136 268 L131 263 L129 263 L124 257 L122 257 L117 251 L115 251 L110 245 L108 245 L103 239 L101 239 L96 233 L94 233 L89 227 L87 227 L82 221 L80 221 L75 215 L73 215 L68 209 L66 209 L61 203 L59 203ZM280 257 L279 258 L273 258 L273 259 L267 259 L267 260 L260 260 L260 261 L254 261 L254 262 L248 262 L248 263 L242 263 L242 264 L235 264 L235 265 L229 265 L229 266 L216 267 L216 268 L210 268 L210 269 L197 270 L197 271 L191 271 L191 272 L178 273 L178 274 L172 274 L172 275 L157 277 L155 279 L155 281 L150 285 L150 328 L158 331 L159 329 L165 327 L166 325 L172 323 L173 321 L175 321 L175 320 L179 319 L180 317 L186 315 L187 313 L193 311 L194 309 L198 308 L199 306 L205 304 L206 302 L212 300 L213 298 L219 296 L220 294 L226 292 L227 290 L233 288 L234 286 L236 286 L236 285 L240 284 L241 282 L247 280 L248 278 L254 276 L255 274 L259 273 L260 271 L262 271 L262 270 L266 269 L267 267 L273 265 L274 263 L280 261 L281 259 L283 259 L282 257ZM14 259 L13 260 L15 260 L16 262 L22 264 L23 266 L29 268 L30 270 L36 272 L37 274 L43 276 L44 278 L52 281 L53 283 L59 285 L60 287 L66 289 L67 291 L75 294 L76 296 L82 298 L83 300 L91 303 L92 305 L98 307 L99 309 L107 312 L108 314 L116 317 L117 319 L127 323 L128 325 L130 325 L130 326 L132 326 L132 327 L134 327 L134 328 L136 328 L140 331 L145 329 L145 285 L142 282 L140 282 L140 280 L137 277 L128 276 L128 275 L121 275 L121 274 L115 274 L115 273 L108 273 L108 272 L101 272 L101 271 L95 271 L95 270 L81 269 L81 268 L75 268 L75 267 L68 267 L68 266 L62 266 L62 265 L48 264 L48 263 L42 263 L42 262 L28 261 L28 260 L22 260 L22 259Z',
};

/* Crédito de plataforma que se muestra en el pie, junto al del organizador. */
const PIE = {
  copyright: '© 2026 NextTime Software',
  plataforma: 'Powered by',
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

const buscarPregunta = (id) => DIAGNOSTICO.preguntas.find((q) => q.id === id) || null;

/* Puntaje, nivel y brechas a partir de las respuestas { preguntaId: opcionId }. */
function evaluar(respuestas) {
  const r = respuestas || {};
  const detalle = DIAGNOSTICO.preguntas.map((q) => {
    const op = q.opciones.find((o) => o.id === r[q.id]) || null;
    return { pregunta: q, opcion: op, puntos: op ? op.puntos : 0 };
  });
  const respondidas = detalle.filter((d) => d.opcion).length;
  const puntaje = detalle.reduce((a, d) => a + d.puntos, 0);
  const nivel = NIVELES.find((n) => puntaje >= n.desde && puntaje <= n.hasta) || NIVELES[0];
  /* Brecha = todo control que no obtuvo el puntaje completo. */
  const brechas = detalle.filter((d) => d.puntos < DIAGNOSTICO.puntosPregunta);
  return { detalle, respondidas, puntaje, maximo: PUNTAJE_MAXIMO, nivel, brechas, completo: respondidas === DIAGNOSTICO.preguntas.length };
}

/* Leyes involucradas en las brechas, ordenadas por cuántas veces aparecen. */
function leyesDeBrechas(brechas) {
  const cuenta = {};
  brechas.forEach((b) => b.pregunta.leyes.forEach((id) => { cuenta[id] = (cuenta[id] || 0) + 1; }));
  return Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]);
}

/* Lo único que persiste es el agregado ANÓNIMO de la sala: cuántos
 * diagnósticos se completaron en el totem, la suma de puntajes (para el
 * promedio) y cuántas veces se eligió cada alternativa. Nunca se guardan
 * respuestas individuales ni datos de contacto. */
function normalizar(bruto) {
  const d = bruto && typeof bruto === 'object' ? bruto : {};
  const g = (d.agregado && typeof d.agregado === 'object') ? d.agregado : {};
  const entero = (v, tope) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), tope) : 0;
  };
  const opciones = {};
  DIAGNOSTICO.preguntas.forEach((q) => {
    q.opciones.forEach((o) => {
      const clave = q.id + ':' + o.id;
      const n = entero(g.opciones && g.opciones[clave], 99999);
      if (n) opciones[clave] = n;
    });
  });
  return {
    agregado: {
      total: entero(g.total, 99999),
      suma: entero(g.suma, 99999 * PUNTAJE_MAXIMO),
      opciones: opciones,
    },
  };
}

/* ── mount ────────────────────────────────────────────────────────────── */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  let doc = normalizar(null);
  /* `diag` es efímero: se borra al volver al inicio, así el siguiente
     asistente parte con el formulario limpio. */
  const DIAG_VACIO = { fase: 'intro', paso: 0, respuestas: {} };
  let vista = { seccion: 'ahora', abierta: null, diag: Object.assign({}, DIAG_VACIO) };
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
    vista = { seccion: 'ahora', abierta: null, diag: Object.assign({}, DIAG_VACIO) };
    emitir();
  };
  const marcarActividad = () => {
    clearTimeout(inactividadT);
    const seg = Number(config.segundosInactividad);
    const espera = Number.isFinite(seg) && seg >= 15 ? seg : DEFAULT_CONFIG.segundosInactividad;
    inactividadT = setTimeout(() => {
      if (vista.seccion !== 'ahora' || vista.abierta || vista.diag.fase !== 'intro') volverAlInicio();
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

  /* Modal de detalle: `abierta = { tipo:'sesion'|'ley', id }`. */
  const abrirModal = (tipo, id) => { setVista({ abierta: { tipo: tipo, id: id } }); marcarActividad(); };
  const cerrarModal = () => { setVista({ abierta: null }); marcarActividad(); };

  const setDiag = (parcial) => setVista({ diag: Object.assign({}, vista.diag, parcial) });

  /* Suma el diagnóstico terminado al agregado anónimo de la sala. */
  const registrarAgregado = (respuestas, puntaje) => {
    const g = doc.agregado;
    const opciones = Object.assign({}, g.opciones);
    Object.keys(respuestas).forEach((preguntaId) => {
      const clave = preguntaId + ':' + respuestas[preguntaId];
      opciones[clave] = (opciones[clave] || 0) + 1;
    });
    commitDoc({ agregado: { total: g.total + 1, suma: g.suma + puntaje, opciones: opciones } });
  };

  const iniciarDiagnostico = () => {
    setDiag({ fase: 'preguntas', paso: 0, respuestas: {} });
    marcarActividad();
  };

  const reiniciarDiagnostico = () => {
    setVista({ diag: Object.assign({}, DIAG_VACIO) });
    marcarActividad();
  };

  /* Registra una respuesta y avanza. En la última pregunta cierra el
     diagnóstico y guarda el resultado en el agregado. */
  const responderDiagnostico = (preguntaId, opcionId) => {
    const q = buscarPregunta(preguntaId);
    if (!q || !q.opciones.some((o) => o.id === opcionId)) return false;
    const respuestas = Object.assign({}, vista.diag.respuestas);
    respuestas[preguntaId] = opcionId;
    const idx = DIAGNOSTICO.preguntas.indexOf(q);
    const evaluacion = evaluar(respuestas);
    if (evaluacion.completo) {
      setDiag({ fase: 'resultado', paso: idx, respuestas: respuestas });
      registrarAgregado(respuestas, evaluacion.puntaje);
    } else {
      /* Salta a la primera pregunta que siga sin responder. */
      let siguiente = idx + 1;
      while (siguiente < DIAGNOSTICO.preguntas.length && respuestas[DIAGNOSTICO.preguntas[siguiente].id]) siguiente++;
      if (siguiente >= DIAGNOSTICO.preguntas.length) {
        siguiente = DIAGNOSTICO.preguntas.findIndex((x) => !respuestas[x.id]);
      }
      setDiag({ fase: 'preguntas', paso: siguiente, respuestas: respuestas });
    }
    marcarActividad();
    return true;
  };

  const irAPaso = (n) => {
    const paso = Math.max(0, Math.min(DIAGNOSTICO.preguntas.length - 1, Number(n) || 0));
    setDiag({ fase: 'preguntas', paso: paso });
    marcarActividad();
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
          name: 'INICIAR_DIAGNOSTICO',
          description: 'Abre el Diagnóstico Rápido de Cumplimiento en la primera pregunta.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'RESPONDER_DIAGNOSTICO',
          description: 'Responde una pregunta del diagnóstico por voz y avanza a la siguiente. '
            + 'Al responder la última se calcula el puntaje y se muestra el resultado.',
          inputSchema: {
            type: 'object',
            properties: {
              preguntaId: { type: 'string', enum: DIAGNOSTICO.preguntas.map((q) => q.id) },
              opcionId: { type: 'string' },
            },
            required: ['preguntaId', 'opcionId'],
          },
        },
        {
          name: 'IR_A_PREGUNTA',
          description: 'Muestra una pregunta concreta del diagnóstico (1 a ' + DIAGNOSTICO.preguntas.length + ').',
          inputSchema: {
            type: 'object',
            properties: { numero: { type: 'number', minimum: 1, maximum: DIAGNOSTICO.preguntas.length } },
            required: ['numero'],
          },
        },
        {
          name: 'REINICIAR_DIAGNOSTICO',
          description: 'Borra las respuestas y vuelve a la portada del diagnóstico.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'RESULTADO_DIAGNOSTICO',
          description: 'Devuelve el puntaje, el nivel y las brechas detectadas para leerlos en voz alta.',
          inputSchema: { type: 'object', properties: {} },
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
          diagnostico: {
            titulo: DIAGNOSTICO.titulo,
            puntajeMaximo: PUNTAJE_MAXIMO,
            preguntas: DIAGNOSTICO.preguntas.map((q, i) => ({
              numero: i + 1, id: q.id, texto: q.texto, leyes: q.leyes,
              opciones: q.opciones.map((o) => ({ id: o.id, label: o.label, puntos: o.puntos })),
            })),
            niveles: NIVELES.map((n) => ({ id: n.id, titulo: n.titulo, desde: n.desde, hasta: n.hasta })),
          },
          publico: {
            seccionVisible: vista.seccion,
            diagnosticoEnCurso: (() => {
              const e = evaluar(vista.diag.respuestas);
              return {
                fase: vista.diag.fase,
                preguntaActual: vista.diag.fase === 'preguntas'
                  ? DIAGNOSTICO.preguntas[vista.diag.paso].id : null,
                respondidas: e.respondidas,
                puntaje: e.completo ? e.puntaje : null,
                nivel: e.completo ? e.nivel.id : null,
              };
            })(),
            /* Agregado anónimo acumulado en este totem. */
            sala: {
              diagnosticosCompletados: doc.agregado.total,
              puntajePromedio: doc.agregado.total
                ? Math.round(doc.agregado.suma / doc.agregado.total) : null,
            },
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
          if (tipo === 'INICIAR_DIAGNOSTICO') {
            irA('consulta');
            iniciarDiagnostico();
            return { success: true, message: 'Diagnóstico iniciado en la pregunta 1.' };
          }
          if (tipo === 'RESPONDER_DIAGNOSTICO') {
            const q = buscarPregunta(p.preguntaId);
            if (!q) return { success: false, error: 'Pregunta desconocida: ' + p.preguntaId };
            if (!responderDiagnostico(p.preguntaId, p.opcionId)) {
              return {
                success: false,
                error: 'Alternativa desconocida: ' + p.opcionId
                  + '. Válidas: ' + q.opciones.map((o) => o.id).join(', ') + '.',
              };
            }
            const e = evaluar(vista.diag.respuestas);
            return {
              success: true,
              message: e.completo
                ? 'Diagnóstico completo: ' + e.puntaje + ' de ' + PUNTAJE_MAXIMO + ' puntos (' + e.nivel.titulo + ').'
                : 'Respuesta registrada (' + e.respondidas + ' de ' + DIAGNOSTICO.preguntas.length + ').',
            };
          }
          if (tipo === 'IR_A_PREGUNTA') {
            const n = Number(p.numero);
            if (!Number.isFinite(n) || n < 1 || n > DIAGNOSTICO.preguntas.length) {
              return { success: false, error: 'Número fuera de rango (1 a ' + DIAGNOSTICO.preguntas.length + ').' };
            }
            irA('consulta');
            irAPaso(n - 1);
            return { success: true, message: 'Mostrando la pregunta ' + n + '.' };
          }
          if (tipo === 'REINICIAR_DIAGNOSTICO') {
            reiniciarDiagnostico();
            return { success: true, message: 'Diagnóstico reiniciado.' };
          }
          if (tipo === 'RESULTADO_DIAGNOSTICO') {
            const e = evaluar(vista.diag.respuestas);
            if (!e.completo) {
              return {
                success: false,
                error: 'El diagnóstico va en ' + e.respondidas + ' de ' + DIAGNOSTICO.preguntas.length + ' respuestas.',
              };
            }
            return {
              success: true,
              message: e.puntaje + ' de ' + PUNTAJE_MAXIMO + ' puntos — ' + e.nivel.titulo + '.',
              data: {
                puntaje: e.puntaje,
                maximo: PUNTAJE_MAXIMO,
                nivel: e.nivel.titulo,
                resumen: e.nivel.resumen,
                brechas: e.brechas.map((b) => ({
                  pregunta: b.pregunta.texto,
                  respuesta: b.opcion ? b.opcion.label : null,
                  puntos: b.puntos,
                  de: DIAGNOSTICO.puntosPregunta,
                  leyes: b.pregunta.leyes.map((id) => buscarLey(id).numero),
                })),
                leyesPrioritarias: leyesDeBrechas(e.brechas).map((id) => {
                  const l = buscarLey(id);
                  return l.numero + ' — ' + l.nombre;
                }),
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
        /* Logo completo de Kimos: isotipo (icosaedro) + wordmark, blanco, como
           el logo oficial en fondo azul pero a escala de pie. */
        h('svg', {
          className: 'ec-ft-k-ico',
          viewBox: KIMOS_ICONO.viewBox,
          role: 'img', 'aria-label': 'Kimos',
        },
        h('path', { d: KIMOS_ICONO.d, fill: 'currentColor', fillRule: 'evenodd' })),
        h('svg', {
          className: 'ec-ft-k-logo',
          viewBox: KIMOS_LOGO.viewBox,
          'aria-hidden': 'true',
        },
        h('path', { d: KIMOS_LOGO.d, fill: 'currentColor', fillRule: 'evenodd' }))));
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

  /* Isotipo de NextTime (solo el símbolo), para las sesiones sin expositor. */
  function NtIso(props) {
    const z = props.size || 44;
    return h('svg', {
      className: 'ec-nt-iso', width: z, height: z, viewBox: '0 0 100 100',
      role: 'img', 'aria-label': 'NextTime Software',
    },
    h('rect', { width: 100, height: 100, rx: 16, fill: 'var(--nt-cyan)' }),
    h('path', {
      d: 'M38.2 20.4 V56 A16.6 16.6 0 0 0 71.4 56',
      fill: 'none', stroke: '#FFFFFF', strokeWidth: 11, strokeLinecap: 'round',
    }),
    h('rect', { x: 26, y: 33.4, width: 29, height: 9.2, rx: 2, fill: '#FFFFFF' }),
    h('rect', { x: 60, y: 33.4, width: 12, height: 9.2, rx: 2, fill: '#FFFFFF' }));
  }

  /* Imagen de "lo que viene": fotos de los expositores del bloque, o el
     isotipo de NextTime en las sesiones de la organización (bienvenida/cierre).
     `size` = 'lg' (pantalla Ahora) | 'mini' (filas de la agenda). */
  function SesionVisual(props) {
    const b = props.block;
    const size = props.size || 'mini';
    const speakers = b.speakers.map(buscarSpeaker).filter(Boolean);
    const cls = 'ec-viz ec-viz-' + size;
    if (speakers.length) {
      return h('div', { className: cls + (speakers.length > 1 ? ' multi' : '') },
        speakers.map((sp) => h('div', { className: 'ec-viz-av', key: sp.id },
          h(Avatar, { speaker: sp, mostrarFotos: props.mostrarFotos }))));
    }
    return h('div', { className: cls },
      h('div', { className: 'ec-viz-av ec-viz-org' }, h(NtIso, { size: size === 'lg' ? 62 : 40 })));
  }

  /* Tarjeta de sesión (actual o siguiente) en la pantalla Ahora. */
  function SesionCard(props) {
    const b = props.block;
    const estado = props.estado; /* 'ahora' | 'apertura' | 'siguiente' */
    const etiqueta = estado === 'ahora' ? 'Sesión en curso'
      : estado === 'apertura' ? 'Apertura de la jornada' : 'A continuación';
    let pct = 0;
    if (estado === 'ahora') {
      const a = instante(b.ini); const z = instante(b.fin);
      pct = Math.max(0, Math.min(100, Math.round(((props.ahora - a) / (z - a)) * 100)));
    }
    return h('div', { className: 'ec-card ec-sesion-card' + (estado === 'ahora' ? ' ec-viva' : '') },
      h('div', { className: 'ec-sesion-hd' },
        h('div', { className: 'ec-sesion-tag' },
          estado === 'ahora' ? h('span', { className: 'ec-punto-live' }) : null,
          h('span', { className: 'ec-h3', style: { margin: 0 } }, etiqueta)),
        h('span', { className: 'ec-hora' }, b.ini, ' – ', b.fin, ' hrs')),
      h('div', { className: 'ec-sesion-body' },
        h(SesionVisual, { block: b, mostrarFotos: props.mostrarFotos, size: 'lg' }),
        h('div', { className: 'ec-sesion-txt' },
          h('h2', { className: 'ec-h2' }, b.tema),
          h('p', { className: 'ec-p tenue' }, expositoresDe(b)))),
      estado === 'ahora' ? h('div', { className: 'ec-barra' },
        h('div', { className: 'ec-barra-f', style: { width: pct + '%' } })) : null);
  }

  /* 1. Ahora — cuenta sin conteo: qué sucede ahora y qué viene, en tiempo real. */
  function Ahora(props) {
    const est = props.est;
    const ahora = props.ahora;
    const mostrarFotos = props.mostrarFotos !== false;

    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card ec-hero-card' },
        h('div', { className: 'ec-badge-row' },
          h('span', { className: 'ec-pill evento' }, EVENTO.ciclo),
          h('span', { className: 'ec-badge-org' }, MARCA.nombre)),
        h('h1', { className: 'ec-h1' }, EVENTO.titulo),
        h('p', { className: 'ec-hero-sub' }, EVENTO.tituloLargo),
        h('div', { className: 'ec-hero-meta' },
          h('span', { className: 'ec-tag ley' }, EVENTO.fechaTexto),
          h('span', { className: 'ec-tag ley' }, EVENTO.horarioTexto),
          h('span', { className: 'ec-tag ley' }, EVENTO.sede)),
        est.fase === 'despues' ? h('div', { className: 'ec-closing-box' },
          h('hr', { className: 'ec-hr' }),
          h('p', { className: 'ec-h2' }, 'Gracias por acompañarnos'),
          h('p', { className: 'ec-p tenue' }, 'El desayuno ejecutivo ha concluido. Puedes seguir explorando la agenda, los expositores y el marco legal.')) : null),

      est.actual ? h(SesionCard, { block: est.actual, estado: 'ahora', ahora: ahora, mostrarFotos: mostrarFotos }) : null,
      est.siguiente ? h(SesionCard, {
        block: est.siguiente,
        estado: est.fase === 'antes' ? 'apertura' : 'siguiente',
        mostrarFotos: mostrarFotos,
      }) : null);
  }

  /* 2. Agenda y Expositores — cronograma compacto; cada fila abre su detalle. */
  function Agenda(props) {
    const ahora = props.ahora;
    const mostrarFotos = props.mostrarFotos !== false;

    return h('div', { className: 'ec-wrap ec-wrap-lista' },
      AGENDA.map((b) => {
        const est = estadoBloque(b, ahora);
        return h('button', {
          key: b.id,
          type: 'button',
          className: 'ec-row' + (est === 'ahora' ? ' ahora' : '') + (est === 'pasado' ? ' pasado' : ''),
          onClick: () => abrirModal('sesion', b.id),
        },
        h('div', { className: 'ec-row-viz' }, h(SesionVisual, { block: b, mostrarFotos: mostrarFotos, size: 'mini' })),
        h('div', { className: 'ec-row-main' },
          h('div', { className: 'ec-row-top' },
            h('span', { className: 'ec-row-hora' }, b.ini, ' – ', b.fin),
            est === 'ahora' ? h('span', { className: 'ec-pill vivo sm' }, 'En curso') : null,
            b.leyes.map((lid) => h('span', { className: 'ec-tag ley', key: lid }, buscarLey(lid).numero))),
          h('h3', { className: 'ec-row-titulo' }, b.tema),
          h('p', { className: 'ec-row-sub' }, expositoresDe(b))),
        h('span', { className: 'ec-row-chevron', 'aria-hidden': 'true' }, '›'));
      }));
  }

  /* 3. Marco Legal — leyes como tarjetas seleccionables que abren su detalle. */
  function Leyes() {
    return h('div', { className: 'ec-wrap ec-wrap-lista' },
      LEYES.map((l) => h('button', {
        key: l.id,
        type: 'button',
        className: 'ec-row ec-row-ley',
        onClick: () => abrirModal('ley', l.id),
      },
      h('div', { className: 'ec-row-ley-n' }, l.numero),
      h('div', { className: 'ec-row-main' },
        h('h3', { className: 'ec-row-titulo' }, l.nombre),
        h('p', { className: 'ec-row-sub' }, l.resumen)),
      h('span', { className: 'ec-row-chevron', 'aria-hidden': 'true' }, '›'))),

      h('p', { className: 'ec-aviso ec-aviso-suelto' }, 'Este resumen es estrictamente informativo y no constituye asesoría legal directa. Para planes de adecuación específicos, contacta al equipo consultor o a los expositores durante la jornada.'));
  }

  /* Ficha de un expositor dentro del modal: foto, datos, bio y los dos QR
     (perfil de contacto + sitio web de su empresa/institución). */
  /* Ficha de expositores de una sesión: todos en un solo contenedor.
     Cada persona lleva su QR de perfil y se comparte un único QR por empresa
     (así una sesión con dos ponentes de la misma organización usa 3 QR, no 4). */
  function FichaSesion(props) {
    const speakers = props.speakers;
    const orgsUnicas = [];
    speakers.forEach((sp) => { if (orgsUnicas.indexOf(sp.org) === -1) orgsUnicas.push(sp.org); });
    const orgs = orgsUnicas.map((id) => ORGS[id]).filter((o) => o && o.qr);
    const varios = speakers.length > 1;
    return h('div', { className: 'ec-ficha' },
      speakers.map((sp, i) => h('div', { className: 'ec-grupo-p' + (i ? ' sep' : ''), key: sp.id },
        h('div', { className: 'ec-ficha-hd' },
          h('div', { className: 'ec-ficha-av' }, h(Avatar, { speaker: sp, mostrarFotos: props.mostrarFotos })),
          h('div', { className: 'ec-ficha-info' },
            h('h3', { className: 'ec-ficha-nombre' }, sp.nombreLargo || sp.nombre),
            h('p', { className: 'ec-ficha-rol' }, sp.rol),
            (ORGS[sp.org] || {}).nombre ? h('span', { className: 'ec-ficha-org' }, ORGS[sp.org].nombre) : null)),
        sp.bio ? h('p', { className: 'ec-ficha-bio' }, sp.bio) : null)),
      h('div', { className: 'ec-ficha-qrs' },
        speakers.map((sp) => h(Qr, { key: 'p' + sp.id, clave: sp.qr, titulo: varios ? sp.nombre : 'Perfil / contacto', alt: sp.url })),
        orgs.map((o) => h(Qr, { key: 'o' + o.qr, clave: o.qr, titulo: o.nombre, alt: o.url }))));
  }

  /* Modal de detalle para una sesión de la agenda o para una ley. */
  function Modal(props) {
    const a = props.abierta;
    if (!a) return null;
    let cuerpo = null;

    if (a.tipo === 'sesion') {
      const b = buscarBloque(a.id);
      if (!b) return null;
      const speakers = b.speakers.map(buscarSpeaker).filter(Boolean);
      cuerpo = h('div', null,
        h('div', { className: 'ec-modal-tags' },
          h('span', { className: 'ec-tag ley' }, b.ini + ' – ' + b.fin + ' hrs'),
          b.leyes.map((lid) => h('span', { className: 'ec-tag ley', key: lid }, buscarLey(lid).numero))),
        h('h2', { className: 'ec-modal-titulo' }, b.tema),
        b.resumen ? h('p', { className: 'ec-p' }, b.resumen) : null,
        speakers.length
          ? h(FichaSesion, { speakers: speakers, mostrarFotos: props.mostrarFotos })
          : (b.id === 'bienvenida'
            ? h('div', { className: 'ec-ficha' },
              h('div', { className: 'ec-ficha-hd' },
                h('div', { className: 'ec-ficha-av' }, h(NtIso, { size: 66 })),
                h('div', { className: 'ec-ficha-info' },
                  h('h3', { className: 'ec-ficha-nombre' }, MARCA.nombre),
                  h('p', { className: 'ec-ficha-rol' }, 'Anfitrión y Organización'))),
              h('p', { className: 'ec-ficha-bio' }, MARCA.descripcion),
              h('div', { className: 'ec-ficha-qrs' },
                h(Qr, { clave: 'landing', titulo: 'Landing del evento', alt: EVENTO.landing }),
                h(Qr, { clave: 'nexttime', titulo: MARCA.nombre, alt: MARCA.sitio })))
            : h('div', { className: 'ec-ficha' },
              h('div', { className: 'ec-ficha-hd' },
                h('div', { className: 'ec-ficha-av ec-ficha-emoji' }, '🤝'),
                h('div', { className: 'ec-ficha-info' },
                  h('h3', { className: 'ec-ficha-nombre' }, 'Networking y Preguntas Abiertas'),
                  h('p', { className: 'ec-ficha-rol' }, 'Todos los expositores y asistentes'))),
              h('p', { className: 'ec-ficha-bio' }, 'Momento para profundizar consultas, intercambiar experiencias de cumplimiento y coordinar sesiones de trabajo directas con los especialistas.'),
              h('div', { className: 'ec-ficha-qrs' },
                h(Qr, { clave: 'diagnostico-form', titulo: 'Diagnóstico en tu móvil', alt: DIAG_FORM_URL })))));
    } else if (a.tipo === 'ley') {
      const l = buscarLey(a.id);
      if (!l) return null;
      const sesion = buscarBloque(l.sesion);
      cuerpo = h('div', null,
        h('div', { className: 'ec-modal-tags' }, h('span', { className: 'ec-ley-n' }, l.numero)),
        h('h2', { className: 'ec-modal-titulo' }, l.nombre),
        h('p', { className: 'ec-p' }, l.resumen),
        h('div', { className: 'ec-datos' }, l.datos.map((d) => h('div', { className: 'ec-dato', key: d.k },
          h('p', { className: 'ec-dato-k' }, d.k),
          h('p', { className: 'ec-dato-v' }, d.v)))),
        h('h3', { className: 'ec-h3', style: { marginTop: '1.2em' } }, 'Aspectos Clave a Cumplir:'),
        h('ul', { className: 'ec-lista' }, l.puntos.map((pt, i) => h('li', { key: i }, pt))),
        sesion ? h('div', { className: 'ec-ley-sesion-ref' },
          h('span', { className: 'ec-tag ley' }, sesion.ini + ' – ' + sesion.fin + ' hrs'),
          h('span', { className: 'ec-ley-sesion-txt' }, 'Tratado en sesión: ', h('strong', null, sesion.tema))) : null);
    } else if (a.tipo === 'brechas') {
      const ev = evaluar((props.diag && props.diag.respuestas) || {});
      const total = DIAGNOSTICO.preguntas.length;
      const leyes = leyesDeBrechas(ev.brechas);
      cuerpo = h('div', null,
        h('div', { className: 'ec-modal-tags' },
          h('span', { className: 'ec-tag ley' }, ev.puntaje + ' / ' + PUNTAJE_MAXIMO + ' puntos'),
          h('span', { className: 'ec-tag ley' }, ev.nivel.titulo)),
        h('h2', { className: 'ec-modal-titulo' }, ev.brechas.length
          ? 'Brechas detectadas (' + ev.brechas.length + ' de ' + total + ')'
          : 'Sin brechas'),
        ev.brechas.length
          ? h('div', null,
            h('p', { className: 'ec-p tenue' }, 'Controles que no obtuvieron el puntaje completo:'),
            ev.brechas.map((b) => h('div', { className: 'ec-diag-brecha', key: b.pregunta.id },
              h('div', { className: 'ec-diag-brecha-hd' },
                h('span', { className: 'ec-diag-pts' }, b.puntos + '/' + DIAGNOSTICO.puntosPregunta),
                b.pregunta.leyes.map((id) => h('span', { className: 'ec-tag ley', key: id }, buscarLey(id).numero))),
              h('p', { className: 'ec-diag-brecha-q' }, b.pregunta.texto),
              b.opcion ? h('p', { className: 'ec-p tenue' }, 'Tu respuesta: ' + b.opcion.label) : null)))
          : h('p', { className: 'ec-p' }, 'Los diez controles obtuvieron el puntaje completo. Mantén la evidencia al día y revisa la cadena de proveedores.'),
        leyes.length ? h('div', { className: 'ec-diag-normativa' },
          h('h3', { className: 'ec-h3' }, 'Normativa a priorizar'),
          leyes.map((id) => {
            const l = buscarLey(id);
            return h('p', { className: 'ec-p', key: id }, h('strong', null, l.numero + ' — ' + l.nombre));
          }),
          h('p', { className: 'ec-p tenue' }, 'Revisa el detalle en Marco Legal o conversa con los expositores durante la jornada.')) : null,
        h('p', { className: 'ec-aviso' }, 'Resultado orientativo y anónimo: no constituye asesoría legal ni una auditoría formal. ' + DIAGNOSTICO.aviso));
    }

    return h('div', {
      className: 'ec-modal-overlay',
      role: 'dialog', 'aria-modal': 'true',
      onClick: (e) => { if (e.target === e.currentTarget) cerrarModal(); },
    },
    h('div', { className: 'ec-modal' },
      h('button', { type: 'button', className: 'ec-modal-x', 'aria-label': 'Cerrar', onClick: cerrarModal }, '×'),
      h('div', { className: 'ec-modal-body' }, cuerpo)));
  }

  /* 4. Diagnóstico Rápido de Cumplimiento.
     Se recorre una pregunta por pantalla: en el totem vertical entran las tres
     alternativas completas sin desplazamiento y el toque avanza solo. */
  function Diagnostico(props) {
    const d = props.vista.diag;
    const ev = evaluar(d.respuestas);
    const total = DIAGNOSTICO.preguntas.length;
    const sala = props.doc.agregado;

    /* ── Portada ──────────────────────────────────────────────────────── */
    if (d.fase === 'intro') {
      return h('div', { className: 'ec-wrap' },
        h('div', { className: 'ec-card ec-hero-card' },
          h('p', { className: 'ec-h3' }, 'Autoevaluación'),
          h('h1', { className: 'ec-h1' }, DIAGNOSTICO.titulo),
          h('div', { className: 'ec-diag-meta' },
            h('span', { className: 'ec-tag ley' }, total + ' preguntas'),
            h('span', { className: 'ec-tag ley' }, PUNTAJE_MAXIMO + ' puntos'),
            h('span', { className: 'ec-tag ley' }, 'Leyes 21.663 y 21.719')),
          h('p', { className: 'ec-p tenue ec-diag-aviso' }, DIAGNOSTICO.aviso),
          h('div', { className: 'ec-diag-inicio' },
            h('button', {
              type: 'button', className: 'ec-btn ec-btn-cta ec-diag-empezar',
              onClick: iniciarDiagnostico,
            }, 'Comenzar aquí en el totem →'),
            h('div', { className: 'ec-diag-qr' },
              h(Qr, { clave: 'diagnostico-form', titulo: 'Continúalo en tu móvil', alt: DIAG_FORM_URL })))),

        sala.total ? h('div', { className: 'ec-card' },
          h('p', { className: 'ec-h3' }, 'Resultados de la sala'),
          h('p', { className: 'ec-p tenue' },
            sala.total + ' diagnóstico' + (sala.total === 1 ? '' : 's')
            + ' completado' + (sala.total === 1 ? '' : 's') + ' en este totem · promedio '
            + Math.round(sala.suma / sala.total) + ' de ' + PUNTAJE_MAXIMO + ' puntos.')) : null);
    }

    /* ── Resultado: solo el contenedor del resultado; el detalle de brechas
       vive en un modal para que la pantalla no genere scroll. ── */
    if (d.fase === 'resultado') {
      const pct = Math.round((ev.puntaje / PUNTAJE_MAXIMO) * 100);
      return h('div', { className: 'ec-wrap' },
        h('div', { className: 'ec-card ec-hero-card' },
          h('p', { className: 'ec-h3' }, 'Resultado del diagnóstico'),
          h('div', { className: 'ec-diag-score' },
            h('div', { className: 'ec-diag-num', style: { color: ev.nivel.color } },
              String(ev.puntaje),
              h('span', { className: 'ec-diag-den' }, '/ ' + PUNTAJE_MAXIMO)),
            h('div', { className: 'ec-diag-nivel' },
              h('span', { className: 'ec-diag-badge', style: { background: ev.nivel.color } }, ev.nivel.titulo),
              h('p', { className: 'ec-p' }, ev.nivel.resumen))),
          h('div', { className: 'ec-diag-barra' },
            h('div', { className: 'ec-diag-barra-f', style: { width: pct + '%', background: ev.nivel.color } })),
          h('div', { className: 'ec-diag-acciones' },
            h('button', { type: 'button', className: 'ec-btn ec-btn-cta', onClick: () => abrirModal('brechas', null) },
              ev.brechas.length ? 'Ver ' + ev.brechas.length + ' brecha' + (ev.brechas.length === 1 ? '' : 's') + ' en detalle →' : 'Ver detalle →'),
            h('button', { type: 'button', className: 'ec-btn ghost', onClick: reiniciarDiagnostico },
              'Hacer de nuevo'),
            h('button', { type: 'button', className: 'ec-btn ghost', onClick: () => irA('leyes') },
              'Marco Legal')),
          h('p', { className: 'ec-aviso' }, 'Resultado orientativo y anónimo: no constituye asesoría legal ni una auditoría formal.')));
    }

    /* ── Preguntas, una por pantalla ──────────────────────────────────── */
    const idx = Math.max(0, Math.min(total - 1, d.paso));
    const q = DIAGNOSTICO.preguntas[idx];
    const elegida = d.respuestas[q.id];

    return h('div', { className: 'ec-wrap' },
      h('div', { className: 'ec-card ec-hero-card' },
        h('div', { className: 'ec-diag-hd' },
          h('p', { className: 'ec-h3' }, 'Pregunta ' + (idx + 1) + ' de ' + total),
          h('span', { className: 'ec-diag-pts' }, DIAGNOSTICO.puntosPregunta + ' puntos')),

        h('div', { className: 'ec-diag-barra' },
          h('div', { className: 'ec-diag-barra-f', style: { width: Math.round((idx / total) * 100) + '%' } })),

        h('p', { className: 'ec-diag-q' }, q.texto),

        h('div', { className: 'ec-ops' }, q.opciones.map((o) => h('button', {
          key: o.id,
          type: 'button',
          className: 'ec-op' + (elegida === o.id ? ' on' : ''),
          'aria-pressed': elegida === o.id ? 'true' : 'false',
          onClick: () => responderDiagnostico(q.id, o.id),
        },
        h('span', { className: 'ec-op-bullet' }),
        h('span', null, o.label)))),

        h('div', { className: 'ec-diag-nav' },
          h('button', {
            type: 'button', className: 'ec-btn ghost',
            disabled: idx === 0,
            onClick: () => irAPaso(idx - 1),
          }, '← Anterior'),
          h('div', { className: 'ec-pasos' }, DIAGNOSTICO.preguntas.map((x, i) => h('span', {
            key: x.id,
            className: 'ec-paso' + (d.respuestas[x.id] ? ' on' : '') + (i === idx ? ' aqui' : ''),
          }))),
          h('button', {
            type: 'button', className: 'ec-btn ghost',
            disabled: !elegida || idx === total - 1,
            onClick: () => irAPaso(idx + 1),
          }, 'Siguiente →'))),

      h('div', { className: 'ec-card' },
        h('p', { className: 'ec-p tenue ec-diag-aviso' }, DIAGNOSTICO.aviso)));
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
      ahora: () => h(Ahora, { est: est, ahora: ahora, mostrarFotos: cfg.mostrarFotos !== false }),
      agenda: () => h(Agenda, { ahora: ahora, mostrarFotos: cfg.mostrarFotos !== false }),
      leyes: () => h(Leyes, null),
      consulta: () => h(Diagnostico, { vista: v, doc: d }),
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
    h(Pie, null),

    /* Modal de detalle (sesión o ley), por encima de todo */
    h(Modal, { abierta: v.abierta, mostrarFotos: cfg.mostrarFotos !== false, diag: v.diag }));
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
