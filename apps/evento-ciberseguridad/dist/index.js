/**
 * Desayuno Ejecutivo de Ciberseguridad 2026 — app informativa de KIMOS.
 *
 * FUENTE DEL CONTENIDO: el correo de convocatoria de NextTime Software
 * (campaña Mailchimp `b93cf0460e`, "Conoce a los expertos que participarán en
 * nuestro desayuno de ciberseguridad"). Todo lo que se muestra sale de ahí,
 * literal. Lo que el correo NO dice —la agenda hora por hora, la hora de
 * término, el precio— NO se muestra ni se infiere: para el detalle está el
 * archivo .ics oficial, enlazado desde la app.
 *
 * Lo que el usuario aporta (asistencia, temas de interés, speakers
 * prioritarios, preguntas y notas) se guarda por instancia con
 * saveData/loadData y es lo que el agente IA puede operar.
 */

// Mantener en sincronía con manifest.json y con el catálogo raíz /manifest.json.
const APP_VERSION = '1.0.0';

/* ── Datos del evento (transcritos del correo) ───────────────────────── */

const EVENTO = {
  ciclo: 'Ciclo de Eventos',
  titulo: 'Desayuno Ejecutivo de Ciberseguridad 2026',
  // Nombre largo tal como aparece en el archivo de agenda (.ics) oficial.
  tituloLargo: 'Desayuno Ejecutivo: Adopta Ciberseguridad, prepárate para '
    + 'Protección de Datos y Delitos Informáticos',
  organizador: 'NextTime Software',
  // Martes 18 de agosto de 2026, 08:30 en Santiago de Chile (UTC-4 en agosto,
  // antes del cambio de hora de septiembre). El offset va explícito para que
  // la cuenta regresiva sea correcta desde cualquier huso horario.
  inicioISO: '2026-08-18T08:30:00-04:00',
  fechaTexto: 'Martes 18 de agosto',
  horaTexto: '08:30 hrs',
  sede: 'Hotel DoubleTree by Hilton',
  direccion: 'Av. Vitacura 2727, Las Condes',
  agendaIcs: 'https://nexttimesoftware.com/wp-content/uploads/2026/07/Desayuno-Ejecutivo_-Adopta-Ciberseguridad-preparate-para-Proteccion-de-Datos-y-Delitos-Informaticos.ics',
  archivoCampana: 'https://us9.campaign-archive.com/?u=39df1d5ab0cecee961f84c7a5&id=b93cf0460e',
  // Textos del correo, sin retocar.
  agradecimiento: 'Queremos agradecer nuevamente tu inscripción a nuestro '
    + 'Desayuno Ejecutivo de Ciberseguridad 2026.',
  bajada: 'Durante la jornada contaremos con la participación de especialistas '
    + 'que compartirán experiencias, recomendaciones y una visión práctica '
    + 'sobre cómo las organizaciones pueden enfrentar el nuevo escenario '
    + 'regulatorio y de seguridad digital.',
  audiencia: 'Hemos preparado una agenda especialmente orientada a ejecutivos, '
    + 'líderes de negocio, tecnología, seguridad y cumplimiento.',
  // Logos del encabezado del correo. Si la red los bloquea, cae al texto.
  logoOrganizador: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/3d581684-24f4-ad36-7092-c926e9b1a5b9.png?dpr=2&rect=0%2C417%2C1250%2C414&w=122&h=40',
  logoSecundario: 'https://brand-assets.mailchimp.com/01KYJQ5NQTHGJDG59J15YRMM0R.png',
};

const TEMAS = [
  { id: 'ley-marco', texto: 'Implicancias de la Ley Marco de Ciberseguridad.' },
  { id: 'datos-personales', texto: 'Protección de datos personales y responsabilidades organizacionales.' },
  { id: 'incumplimiento', texto: 'Riesgos asociados al incumplimiento normativo.' },
  { id: 'resiliencia', texto: 'Estrategias para fortalecer la resiliencia digital.' },
  { id: 'casos-practicos', texto: 'Casos prácticos y experiencias reales.' },
];

const SPEAKERS = [
  {
    id: 'cristian-maulen',
    nombre: 'Cristian Maulen',
    rol: 'Artesano de Datos',
    cargo: 'Socio Principal',
    empresa: 'CustomerTrigger',
    foto: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/d1afd5ee-7e88-1d91-7ab0-be169db9daf1.jpg?dpr=2&rect=280%2C0%2C719%2C720&w=132&h=132',
  },
  {
    id: 'jose-gaete',
    nombre: 'José Gaete',
    rol: 'CRO',
    cargo: '',
    empresa: 'NextTime Software',
    foto: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/c8aac23a-b6e8-841b-be88-0494e38a6f81.jpeg?dpr=2&rect=0%2C351%2C576%2C576&w=132&h=132',
  },
  {
    id: 'leonardo-jadue',
    nombre: 'Leonardo Jadue',
    rol: 'Director Comercial',
    cargo: '',
    empresa: 'XGoldIT',
    foto: 'https://mcusercontent.com/39df1d5ab0cecee961f84c7a5/images/b3e96510-ee49-3da4-3743-58361d346cf2.png',
  },
  {
    id: 'lilian-jimenez',
    nombre: 'Lilian Jiménez',
    rol: 'Abogada experta en Ciberseguridad',
    cargo: '',
    empresa: 'Chiqan Abogados',
    foto: 'https://dim.mcusercontent.com/cs/39df1d5ab0cecee961f84c7a5/images/c8809572-aa4b-e9c0-2a06-69d1ef3cfb9a.png?dpr=2&rect=0%2C0%2C800%2C800&w=132&h=132',
  },
];

const ASISTENCIAS = [
  { id: 'confirmada', label: 'Confirmo mi asistencia', sub: 'Cuenta conmigo el 18 de agosto' },
  { id: 'tentativa', label: 'Aún no lo sé', sub: 'Me interesa, pero está por confirmar' },
  { id: 'declinada', label: 'No podré asistir', sub: 'Esta vez no llego' },
];

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'temario', label: 'Temario' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'lugar', label: 'Lugar' },
  { id: 'plan', label: 'Mi plan' },
];

const DEFAULT_CONFIG = { acento: '#00E9D8', mostrarSegundos: true, mostrarFotos: true };

/* ── Utilidades puras ─────────────────────────────────────────────────── */

const pad2 = (n) => String(n).padStart(2, '0');

const iniciales = (nombre) => String(nombre || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const buscarSpeaker = (id) => SPEAKERS.find((s) => s.id === id) || null;

/** Descompone los milisegundos que faltan en días/horas/minutos/segundos. */
function descomponer(ms) {
  let resto = Math.max(0, ms);
  const dias = Math.floor(resto / 86400000); resto -= dias * 86400000;
  const horas = Math.floor(resto / 3600000); resto -= horas * 3600000;
  const minutos = Math.floor(resto / 60000); resto -= minutos * 60000;
  return { dias, horas, minutos, segundos: Math.floor(resto / 1000) };
}

/**
 * Estado del evento respecto de "ahora".
 * El correo no publica hora de término, así que no la inventamos: el evento se
 * considera "en curso" desde su inicio hasta el final de ese mismo día en la
 * zona del evento, y "finalizado" después.
 */
function estadoEvento(ahoraMs) {
  const inicio = new Date(EVENTO.inicioISO).getTime();
  const finDelDia = new Date('2026-08-19T00:00:00-04:00').getTime();
  if (ahoraMs < inicio) return { fase: 'proximo', falta: descomponer(inicio - ahoraMs) };
  if (ahoraMs < finDelDia) return { fase: 'en-curso', falta: null };
  return { fase: 'finalizado', falta: null };
}

function mapaUrlSede() {
  const q = EVENTO.sede + ', ' + EVENTO.direccion + ', Santiago, Chile';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

/** Normaliza lo que venga de loadData o del agente a un modelo completo. */
function normalizar(bruto) {
  const d = bruto && typeof bruto === 'object' ? bruto : {};
  const asistencia = ASISTENCIAS.some((a) => a.id === d.asistencia) ? d.asistencia : null;
  const temas = {};
  TEMAS.forEach((t) => { if (d.temas && d.temas[t.id]) temas[t.id] = true; });
  const prioritarios = {};
  SPEAKERS.forEach((s) => { if (d.prioritarios && d.prioritarios[s.id]) prioritarios[s.id] = true; });
  const preguntas = Array.isArray(d.preguntas) ? d.preguntas.slice(0, 200).map((p, i) => ({
    id: String((p && p.id) || 'q' + i + '-' + Math.random().toString(36).slice(2, 8)),
    texto: String((p && p.texto) || '').slice(0, 500),
    para: buscarSpeaker(p && p.para) ? p.para : null,
    hecha: !!(p && p.hecha),
  })).filter((p) => p.texto) : [];
  return {
    tab: TABS.some((t) => t.id === d.tab) ? d.tab : 'resumen',
    asistencia,
    temas,
    prioritarios,
    preguntas,
    notas: String(d.notas || '').slice(0, 20000),
  };
}

/* ── mount ────────────────────────────────────────────────────────────── */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  // Estado DENTRO de mount: una copia por ventana (regla de oro nº 2).
  let model = normalizar(null);
  let config = Object.assign({}, DEFAULT_CONFIG);
  const listeners = new Set();
  const emitir = () => listeners.forEach((l) => l({ model, config }));

  let guardarT = null;
  const programarGuardado = () => {
    clearTimeout(guardarT);
    guardarT = setTimeout(() => {
      Promise.resolve(shell.saveData(model)).catch(() => {});
    }, 600);
  };

  function commit(parcial) {
    model = normalizar(Object.assign({}, model, parcial));
    emitir();
    programarGuardado();
  }

  // El cambio de pestaña no merece escribir en disco: es estado de vista.
  function irA(tab) {
    if (!TABS.some((t) => t.id === tab)) return false;
    model = Object.assign({}, model, { tab });
    emitir();
    return true;
  }

  /* Mutaciones — las usan por igual la UI y el agente. */

  const setAsistencia = (id) => {
    const val = ASISTENCIAS.some((a) => a.id === id) ? id : null;
    commit({ asistencia: model.asistencia === val ? null : val });
    return val;
  };

  const toggleTema = (temaId) => {
    if (!TEMAS.some((t) => t.id === temaId)) return false;
    const temas = Object.assign({}, model.temas);
    if (temas[temaId]) delete temas[temaId]; else temas[temaId] = true;
    commit({ temas });
    return true;
  };

  const togglePrioritario = (speakerId) => {
    if (!buscarSpeaker(speakerId)) return false;
    const prioritarios = Object.assign({}, model.prioritarios);
    if (prioritarios[speakerId]) delete prioritarios[speakerId]; else prioritarios[speakerId] = true;
    commit({ prioritarios });
    return true;
  };

  const addPregunta = (texto, para) => {
    const limpio = String(texto || '').trim().slice(0, 500);
    if (!limpio) return null;
    const pregunta = {
      id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      texto: limpio,
      para: buscarSpeaker(para) ? para : null,
      hecha: false,
    };
    commit({ preguntas: model.preguntas.concat([pregunta]) });
    return pregunta;
  };

  const togglePregunta = (id) => commit({
    preguntas: model.preguntas.map((p) => (p.id === id ? Object.assign({}, p, { hecha: !p.hecha }) : p)),
  });

  const removePregunta = (id) => {
    const antes = model.preguntas.length;
    commit({ preguntas: model.preguntas.filter((p) => p.id !== id) });
    return model.preguntas.length < antes;
  };

  const setNotas = (texto) => commit({ notas: String(texto == null ? '' : texto) });

  /* Carga inicial y preferencias (⚙️ Configurar). */

  Promise.resolve(shell.loadData ? shell.loadData() : null)
    .then((data) => { if (data) { model = normalizar(Object.assign({}, model, data)); emitir(); } })
    .catch(() => {});

  const aplicarConfig = (valores) => {
    config = Object.assign({}, DEFAULT_CONFIG, valores || {});
    emitir();
  };
  let offConfig = null;
  if (shell.config && shell.config.get) {
    Promise.resolve(shell.config.get()).then(aplicarConfig).catch(() => {});
    if (shell.config.onChange) offConfig = shell.config.onChange(aplicarConfig);
  }

  if (shell.window && shell.window.setTitle) shell.window.setTitle(EVENTO.titulo);

  if (shell.documents) {
    if (shell.documents.onSerialize) shell.documents.onSerialize(() => ({ model }));
    if (shell.documents.onLoad) {
      shell.documents.onLoad((doc) => { model = normalizar(doc && doc.model); emitir(); });
    }
  }

  /* ── Agente IA ─────────────────────────────────────────────────────── */

  let offAgent = null;
  if (shell.agent && shell.agent.register) {
    offAgent = shell.agent.register({
      label: EVENTO.titulo,
      description: 'Consulta la información del Desayuno Ejecutivo de Ciberseguridad 2026 '
        + '(fecha, lugar, temario y speakers) y gestiona el plan del usuario: asistencia, '
        + 'temas de interés, speakers prioritarios, preguntas para llevar y notas.',
      tools: [
        {
          name: 'SET_ASISTENCIA',
          description: 'Fija la asistencia del usuario. Repetir el mismo valor la desmarca.',
          inputSchema: {
            type: 'object',
            properties: { estado: { type: 'string', enum: ASISTENCIAS.map((a) => a.id) } },
            required: ['estado'],
          },
        },
        {
          name: 'TOGGLE_TEMA',
          description: 'Marca o desmarca un tema del temario como de interés.',
          inputSchema: {
            type: 'object',
            properties: { temaId: { type: 'string', enum: TEMAS.map((t) => t.id) } },
            required: ['temaId'],
          },
        },
        {
          name: 'TOGGLE_SPEAKER_PRIORITARIO',
          description: 'Marca o desmarca un speaker como prioritario para conversar.',
          inputSchema: {
            type: 'object',
            properties: { speakerId: { type: 'string', enum: SPEAKERS.map((s) => s.id) } },
            required: ['speakerId'],
          },
        },
        {
          name: 'ADD_PREGUNTA',
          description: 'Añade una pregunta para llevar al evento, opcionalmente dirigida a un speaker.',
          inputSchema: {
            type: 'object',
            properties: {
              texto: { type: 'string' },
              speakerId: { type: 'string', enum: SPEAKERS.map((s) => s.id) },
            },
            required: ['texto'],
          },
        },
        {
          name: 'REMOVE_PREGUNTA',
          description: 'Elimina una pregunta por su id (los ids vienen en el snapshot).',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        },
        {
          name: 'SET_NOTAS',
          description: 'Reemplaza el texto completo de las notas personales del evento.',
          inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
        },
        {
          name: 'IR_A_SECCION',
          description: 'Cambia la pestaña visible del dashboard.',
          inputSchema: {
            type: 'object',
            properties: { tab: { type: 'string', enum: TABS.map((t) => t.id) } },
            required: ['tab'],
          },
        },
      ],
      getSnapshot: () => {
        const est = estadoEvento(Date.now());
        return {
          version: APP_VERSION,
          evento: {
            titulo: EVENTO.titulo,
            tituloLargo: EVENTO.tituloLargo,
            organizador: EVENTO.organizador,
            cuando: EVENTO.fechaTexto + ' de 2026, ' + EVENTO.horaTexto + ' (hora de Chile)',
            inicioISO: EVENTO.inicioISO,
            sede: EVENTO.sede,
            direccion: EVENTO.direccion,
            audiencia: EVENTO.audiencia,
            agendaIcs: EVENTO.agendaIcs,
            nota: 'El correo de convocatoria no publica agenda hora por hora ni hora de término; '
              + 'ese detalle está en el archivo .ics oficial.',
          },
          estado: est.fase,
          faltan: est.falta,
          temario: TEMAS.map((t) => ({ id: t.id, texto: t.texto, interesa: !!model.temas[t.id] })),
          speakers: SPEAKERS.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            rol: s.rol,
            cargo: s.cargo,
            empresa: s.empresa,
            prioritario: !!model.prioritarios[s.id],
          })),
          plan: {
            tabVisible: model.tab,
            asistencia: model.asistencia,
            preguntas: model.preguntas,
            notas: model.notas,
          },
        };
      },
      dispatchAction: async (action) => {
        const tipo = action && action.type;
        const p = (action && action.payload) || {};
        try {
          if (tipo === 'SET_ASISTENCIA') {
            if (!ASISTENCIAS.some((a) => a.id === p.estado)) {
              return { success: false, error: 'Estado inválido. Usa: ' + ASISTENCIAS.map((a) => a.id).join(', ') };
            }
            const val = setAsistencia(p.estado);
            return { success: true, message: val ? 'Asistencia marcada como "' + val + '".' : 'Asistencia desmarcada.' };
          }
          if (tipo === 'TOGGLE_TEMA') {
            if (!toggleTema(p.temaId)) return { success: false, error: 'Tema desconocido: ' + p.temaId };
            return { success: true, message: model.temas[p.temaId] ? 'Tema marcado como de interés.' : 'Tema desmarcado.' };
          }
          if (tipo === 'TOGGLE_SPEAKER_PRIORITARIO') {
            if (!togglePrioritario(p.speakerId)) return { success: false, error: 'Speaker desconocido: ' + p.speakerId };
            return { success: true, message: model.prioritarios[p.speakerId] ? 'Speaker marcado como prioritario.' : 'Speaker desmarcado.' };
          }
          if (tipo === 'ADD_PREGUNTA') {
            const q = addPregunta(p.texto, p.speakerId);
            if (!q) return { success: false, error: 'La pregunta viene vacía.' };
            return { success: true, message: 'Pregunta añadida (id ' + q.id + ').' };
          }
          if (tipo === 'REMOVE_PREGUNTA') {
            if (!removePregunta(String(p.id || ''))) return { success: false, error: 'No hay pregunta con id ' + p.id + '.' };
            return { success: true, message: 'Pregunta eliminada.' };
          }
          if (tipo === 'SET_NOTAS') {
            setNotas(p.texto);
            return { success: true, message: 'Notas actualizadas.' };
          }
          if (tipo === 'IR_A_SECCION') {
            if (!irA(p.tab)) return { success: false, error: 'Sección desconocida: ' + p.tab };
            return { success: true, message: 'Mostrando la sección "' + p.tab + '".' };
          }
          return { success: false, error: 'Acción desconocida: ' + tipo };
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  /* ── UI ────────────────────────────────────────────────────────────── */

  /** Avatar del speaker: la foto del correo, con caída a iniciales. */
  function Avatar(props) {
    const [roto, setRoto] = React.useState(false);
    if (roto || !props.mostrarFotos || !props.speaker.foto) {
      return h('div', { className: 'ev-sp-ini', 'aria-hidden': 'true' }, iniciales(props.speaker.nombre));
    }
    return h('img', {
      className: 'ev-sp-foto',
      src: props.speaker.foto,
      alt: 'Fotografía de ' + props.speaker.nombre,
      loading: 'lazy',
      onError: () => setRoto(true),
    });
  }

  function Logo(props) {
    const [roto, setRoto] = React.useState(false);
    if (roto) return h('span', { className: 'ev-eyebrow' }, props.alt);
    return h('img', {
      className: props.className, src: props.src, alt: props.alt, loading: 'lazy',
      onError: () => setRoto(true),
    });
  }

  function BotonAgenda(props) {
    return h('a', {
      className: 'ev-btn' + (props.sm ? ' sm' : ''),
      href: EVENTO.agendaIcs,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: 'Descarga el archivo .ics con la agenda oficial del evento',
    }, '📅', h('span', { className: 'ev-btn-txt' }, 'Descarga agenda'));
  }

  function Contador(props) {
    const est = props.estado;
    if (est.fase === 'en-curso') {
      return h('div', { className: 'ev-count vivo' },
        h('div', { className: 'ev-count-estado' }, '● En curso'),
        h('div', { className: 'ev-count-meta' },
          h('span', null, h('b', null, EVENTO.fechaTexto), ' · ', EVENTO.horaTexto),
          h('span', null, EVENTO.sede, ' — ', EVENTO.direccion)));
    }
    if (est.fase === 'finalizado') {
      return h('div', { className: 'ev-count' },
        h('div', { className: 'ev-count-estado' }, 'Evento finalizado'),
        h('div', { className: 'ev-count-meta' },
          h('span', null, 'Se realizó el ', h('b', null, EVENTO.fechaTexto + ' de 2026')),
          h('span', null, EVENTO.sede, ' — ', EVENTO.direccion)));
    }
    const f = est.falta;
    const unidades = [
      { n: f.dias, s: f.dias === 1 ? 'día' : 'días' },
      { n: pad2(f.horas), s: 'horas' },
      { n: pad2(f.minutos), s: 'min' },
    ];
    if (props.mostrarSegundos) unidades.push({ n: pad2(f.segundos), s: 'seg' });
    const reloj = [];
    unidades.forEach((u, i) => {
      if (i) reloj.push(h('span', { className: 'ev-count-sep', key: 'sep' + i }, ':'));
      reloj.push(h('div', { className: 'ev-count-u', key: 'u' + i },
        h('span', { className: 'ev-count-n' }, String(u.n)),
        h('span', { className: 'ev-count-s' }, u.s)));
    });
    return h('div', { className: 'ev-count' },
      h('div', null,
        h('p', { className: 'ev-count-lbl' }, 'Faltan'),
        h('div', { className: 'ev-count-reloj', role: 'timer', 'aria-live': 'off' }, reloj)),
      h('div', { className: 'ev-count-meta' },
        h('span', null, h('b', null, EVENTO.fechaTexto), ' · ', EVENTO.horaTexto),
        h('span', null, EVENTO.sede, ' — ', EVENTO.direccion)));
  }

  function Resumen(props) {
    const m = props.m;
    const marcados = Object.keys(m.temas).length;
    return h('div', { className: 'ev-wrap' },
      h('div', { className: 'ev-card' },
        h('p', { className: 'ev-eyebrow' }, EVENTO.ciclo),
        h('h2', { className: 'ev-h2' }, EVENTO.agradecimiento),
        h('p', { className: 'ev-lead' }, EVENTO.bajada)),

      h('div', { className: 'ev-stats' },
        h('div', { className: 'ev-stat' },
          h('p', { className: 'ev-stat-k' }, 'Fecha'),
          h('p', { className: 'ev-stat-v' }, EVENTO.fechaTexto),
          h('p', { className: 'ev-stat-sub' }, '2026')),
        h('div', { className: 'ev-stat' },
          h('p', { className: 'ev-stat-k' }, 'Hora de inicio'),
          h('p', { className: 'ev-stat-v' }, EVENTO.horaTexto),
          h('p', { className: 'ev-stat-sub' }, 'Hora de Chile')),
        h('div', { className: 'ev-stat' },
          h('p', { className: 'ev-stat-k' }, 'Lugar'),
          h('p', { className: 'ev-stat-v' }, EVENTO.sede),
          h('p', { className: 'ev-stat-sub' }, EVENTO.direccion)),
        h('div', { className: 'ev-stat' },
          h('p', { className: 'ev-stat-k' }, 'Speakers'),
          h('p', { className: 'ev-stat-v' }, String(SPEAKERS.length)),
          h('p', { className: 'ev-stat-sub' }, 'Especialistas invitados')),
        h('div', { className: 'ev-stat' },
          h('p', { className: 'ev-stat-k' }, 'Temas'),
          h('p', { className: 'ev-stat-v' }, String(TEMAS.length)),
          h('p', { className: 'ev-stat-sub' }, marcados + ' marcado' + (marcados === 1 ? '' : 's') + ' por ti')),
        h('div', { className: 'ev-stat' },
          h('p', { className: 'ev-stat-k' }, 'Organiza'),
          h('p', { className: 'ev-stat-v' }, EVENTO.organizador),
          h('p', { className: 'ev-stat-sub' }, EVENTO.ciclo))),

      h('div', { className: 'ev-card' },
        h('h3', { className: 'ev-sec-t' }, '¿Vas a ir?'),
        h('div', { className: 'ev-seg' }, ASISTENCIAS.map((a) => h('button', {
          key: a.id,
          type: 'button',
          className: 'ev-seg-b' + (m.asistencia === a.id ? ' on' : ''),
          'aria-pressed': m.asistencia === a.id ? 'true' : 'false',
          onClick: () => setAsistencia(a.id),
        }, a.label, h('small', null, a.sub)))),
        h('hr', { className: 'ev-hr' }),
        h('p', { className: 'ev-lead' }, EVENTO.audiencia),
        h('div', { className: 'ev-acciones' },
          h(BotonAgenda, null),
          h('button', {
            type: 'button', className: 'ev-btn ghost sm',
            onClick: () => irA('temario'),
          }, 'Ver el temario'))),

      h(PieMarcas, null));
  }

  function Temario(props) {
    const m = props.m;
    const marcados = Object.keys(m.temas).length;
    const pct = Math.round((marcados / TEMAS.length) * 100);
    return h('div', { className: 'ev-wrap' },
      h('div', { className: 'ev-card' },
        h('h3', { className: 'ev-sec-t' }, 'Temario'),
        h('p', { className: 'ev-lead' }, 'Algunos de los temas que revisaremos incluyen:'),
        h('div', { className: 'ev-prog' },
          h('div', { className: 'ev-prog-t' },
            h('span', null, 'Tus temas de interés'),
            h('span', null, marcados + ' / ' + TEMAS.length)),
          h('div', { className: 'ev-prog-b' }, h('div', { className: 'ev-prog-f', style: { width: pct + '%' } }))),
        TEMAS.map((t, i) => h('button', {
          key: t.id,
          type: 'button',
          className: 'ev-tema' + (m.temas[t.id] ? ' on' : ''),
          onClick: () => toggleTema(t.id),
          title: m.temas[t.id] ? 'Quitar de tus temas de interés' : 'Marcar como tema de interés',
        },
        h('span', { className: 'ev-check' }, m.temas[t.id] ? '✓' : ''),
        h('span', { className: 'ev-tema-n' }, pad2(i + 1)),
        h('span', null, t.texto))),
        h('hr', { className: 'ev-hr' }),
        h('p', { className: 'ev-lead' },
          'El correo de convocatoria no publica la agenda hora por hora. El detalle '
          + 'está en el archivo de agenda oficial:'),
        h('div', { className: 'ev-acciones' }, h(BotonAgenda, null))),
      h(PieMarcas, null));
  }

  function Speakers(props) {
    const m = props.m;
    const prioritarios = Object.keys(m.prioritarios).length;
    return h('div', { className: 'ev-wrap ancho' },
      h('div', { className: 'ev-card' },
        h('h3', { className: 'ev-sec-t' }, 'Speakers'),
        h('p', { className: 'ev-lead' },
          'Toca una tarjeta para marcar con quién quieres conversar. '
          + (prioritarios ? 'Llevas ' + prioritarios + ' prioritario' + (prioritarios === 1 ? '' : 's') + '.' : '')),
        h('div', { className: 'ev-speakers' }, SPEAKERS.map((s) => h('div', {
          key: s.id,
          className: 'ev-sp' + (m.prioritarios[s.id] ? ' on' : ''),
          role: 'button',
          tabIndex: 0,
          onClick: () => togglePrioritario(s.id),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePrioritario(s.id); }
          },
          title: m.prioritarios[s.id] ? 'Quitar de prioritarios' : 'Marcar como prioritario',
        },
        h('span', {
          className: 'ev-sp-fav' + (m.prioritarios[s.id] ? ' on' : ''),
          'aria-hidden': 'true',
        }, '★'),
        h(Avatar, { speaker: s, mostrarFotos: props.mostrarFotos }),
        h('div', null,
          h('p', { className: 'ev-sp-nom' }, s.nombre),
          h('p', { className: 'ev-sp-rol' }, s.rol),
          h('p', { className: 'ev-sp-emp' }, (s.cargo ? s.cargo + ' · ' : '') + s.empresa))))),
        h('hr', { className: 'ev-hr' }),
        h('p', { className: 'ev-lead' }, EVENTO.bajada)),
      h(PieMarcas, null));
  }

  function Lugar() {
    const [copiado, setCopiado] = React.useState(false);
    const copiar = () => {
      const texto = EVENTO.sede + ', ' + EVENTO.direccion;
      const ok = () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
        if (shell.notify) shell.notify({ level: 'success', text: 'Dirección copiada.' });
      };
      if (globalThis.navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(ok).catch(() => {
          if (shell.notify) shell.notify({ level: 'warn', text: 'No se pudo copiar la dirección.' });
        });
      } else if (shell.notify) {
        shell.notify({ level: 'info', text: texto });
      }
    };
    return h('div', { className: 'ev-wrap' },
      h('div', { className: 'ev-card' },
        h('h3', { className: 'ev-sec-t' }, 'Lugar'),
        h('p', { className: 'ev-stat-k' }, '📍 Dónde'),
        h('p', { className: 'ev-lugar-dir' }, EVENTO.sede),
        h('p', { className: 'ev-lead' }, EVENTO.direccion),
        h('hr', { className: 'ev-hr' }),
        h('p', { className: 'ev-stat-k' }, '📅 Cuándo'),
        h('p', { className: 'ev-lugar-dir' }, EVENTO.fechaTexto + ' de 2026'),
        h('p', { className: 'ev-lead' }, EVENTO.horaTexto + ' (hora de Chile)'),
        h('div', { className: 'ev-acciones' },
          h('a', {
            className: 'ev-btn sm', href: mapaUrlSede(), target: '_blank', rel: 'noopener noreferrer',
          }, 'Abrir en Google Maps'),
          h('button', { type: 'button', className: 'ev-btn ghost sm', onClick: copiar },
            copiado ? 'Copiada ✓' : 'Copiar dirección'),
          h(BotonAgenda, { sm: true }))),
      h(PieMarcas, null));
  }

  function Plan(props) {
    const m = props.m;
    const [texto, setTexto] = React.useState('');
    const [para, setPara] = React.useState('');
    const enviar = () => {
      if (!texto.trim()) return;
      addPregunta(texto, para || null);
      setTexto('');
    };
    const asistencia = ASISTENCIAS.find((a) => a.id === m.asistencia);
    const temasMarcados = TEMAS.filter((t) => m.temas[t.id]);
    const speakersMarcados = SPEAKERS.filter((s) => m.prioritarios[s.id]);
    const pendientes = m.preguntas.filter((p) => !p.hecha).length;

    return h('div', { className: 'ev-wrap' },
      h('div', { className: 'ev-card' },
        h('h3', { className: 'ev-sec-t' }, 'Mi plan'),
        h('div', { className: 'ev-stats' },
          h('div', { className: 'ev-stat' },
            h('p', { className: 'ev-stat-k' }, 'Asistencia'),
            h('p', { className: 'ev-stat-v' }, asistencia ? asistencia.label : 'Sin responder'),
            h('p', { className: 'ev-stat-sub' }, asistencia ? asistencia.sub : 'Respóndelo en Resumen')),
          h('div', { className: 'ev-stat' },
            h('p', { className: 'ev-stat-k' }, 'Temas de interés'),
            h('p', { className: 'ev-stat-v' }, temasMarcados.length + ' / ' + TEMAS.length),
            h('p', { className: 'ev-stat-sub' }, temasMarcados.length ? temasMarcados.map((t) => t.texto.replace(/\.$/, '')).join(' · ') : 'Ninguno marcado aún')),
          h('div', { className: 'ev-stat' },
            h('p', { className: 'ev-stat-k' }, 'Speakers prioritarios'),
            h('p', { className: 'ev-stat-v' }, speakersMarcados.length + ' / ' + SPEAKERS.length),
            h('p', { className: 'ev-stat-sub' }, speakersMarcados.length ? speakersMarcados.map((s) => s.nombre).join(' · ') : 'Ninguno marcado aún')),
          h('div', { className: 'ev-stat' },
            h('p', { className: 'ev-stat-k' }, 'Preguntas'),
            h('p', { className: 'ev-stat-v' }, String(m.preguntas.length)),
            h('p', { className: 'ev-stat-sub' }, pendientes + ' por hacer')))),

      h('div', { className: 'ev-card' },
        h('h3', { className: 'ev-sec-t' }, 'Preguntas'),
        h('div', { className: 'ev-form' },
          h('input', {
            className: 'ev-input',
            type: 'text',
            value: texto,
            maxLength: 500,
            placeholder: 'Ej: ¿Qué plazos fija la Ley Marco para notificar incidentes?',
            onChange: (e) => setTexto(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } },
          }),
          h('select', {
            className: 'ev-select', value: para, onChange: (e) => setPara(e.target.value),
          },
          h('option', { value: '' }, 'Para cualquiera'),
          SPEAKERS.map((s) => h('option', { key: s.id, value: s.id }, s.nombre))),
          h('button', { type: 'button', className: 'ev-btn sm', onClick: enviar }, 'Añadir')),
        m.preguntas.length
          ? m.preguntas.map((p) => {
            const sp = buscarSpeaker(p.para);
            return h('div', { key: p.id, className: 'ev-preg' + (p.hecha ? ' hecha' : '') },
              h('button', {
                type: 'button', className: 'ev-icon-b',
                title: p.hecha ? 'Marcar como pendiente' : 'Marcar como hecha',
                onClick: () => togglePregunta(p.id),
              }, p.hecha ? '✓' : '○'),
              h('div', { className: 'ev-preg-body' },
                h('p', { className: 'ev-preg-t' }, p.texto),
                sp ? h('p', { className: 'ev-preg-para' }, 'Para ' + sp.nombre + ' · ' + sp.empresa) : null),
              h('button', {
                type: 'button', className: 'ev-icon-b', title: 'Eliminar pregunta',
                onClick: () => removePregunta(p.id),
              }, '✕'));
          })
          : h('div', { className: 'ev-vacio' }, 'Aún no anotas preguntas. Escribe la primera arriba.')),

      h('div', { className: 'ev-card' },
        h('h3', { className: 'ev-sec-t' }, 'Notas'),
        h('textarea', {
          className: 'ev-area',
          value: m.notas,
          maxLength: 20000,
          placeholder: 'Contactos que quieres hacer, temas a profundizar, acuerdos…',
          onChange: (e) => setNotas(e.target.value),
        })),

      h(PieMarcas, null));
  }

  function PieMarcas() {
    return h('div', { className: 'ev-card' },
      h('div', { className: 'ev-marcas' },
        h(Logo, { className: 'ev-marca', src: EVENTO.logoOrganizador, alt: EVENTO.organizador }),
        h(Logo, { className: 'ev-marca', src: EVENTO.logoSecundario, alt: EVENTO.ciclo })),
      h('hr', { className: 'ev-hr' }),
      h('p', { className: 'ev-pie' },
        'Información tomada del correo de convocatoria de ', EVENTO.organizador, '.',
        h('br', null),
        h('a', { href: EVENTO.archivoCampana, target: '_blank', rel: 'noopener noreferrer' },
          'Ver el correo original'),
        ' · ',
        h('a', { href: EVENTO.agendaIcs, target: '_blank', rel: 'noopener noreferrer' },
          'Descargar agenda (.ics)')));
  }

  function Component() {
    const [estado, setEstado] = React.useState({ model, config });
    const [ahora, setAhora] = React.useState(() => Date.now());

    React.useEffect(() => {
      listeners.add(setEstado);
      return () => { listeners.delete(setEstado); };
    }, []);

    // La cuenta regresiva late una vez por segundo mientras la ventana se ve.
    React.useEffect(() => {
      const t = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        setAhora(Date.now());
      }, 1000);
      return () => clearInterval(t);
    }, []);

    const m = estado.model;
    const cfg = estado.config;
    const est = estadoEvento(ahora);
    const pendientes = m.preguntas.filter((p) => !p.hecha).length;
    const contadores = {
      temario: Object.keys(m.temas).length,
      speakers: Object.keys(m.prioritarios).length,
      plan: pendientes,
    };

    const vistas = {
      resumen: () => h(Resumen, { m: m }),
      temario: () => h(Temario, { m: m }),
      speakers: () => h(Speakers, { m: m, mostrarFotos: cfg.mostrarFotos !== false }),
      lugar: () => h(Lugar, null),
      plan: () => h(Plan, { m: m }),
    };

    return h('div', {
      className: 'kimos-evento-ciberseguridad',
      // El acento del formulario ⚙️ Configurar pisa el cyan del evento.
      style: cfg.acento ? { '--ev-cyan': cfg.acento } : null,
    },
    h('header', { className: 'ev-hd' },
      h('div', { className: 'ev-hd-brand' },
        h(Logo, { className: 'ev-hd-logo', src: EVENTO.logoOrganizador, alt: EVENTO.organizador }),
        h('div', { className: 'ev-hd-txt' },
          h('p', { className: 'ev-eyebrow' }, EVENTO.ciclo),
          h('p', { className: 'ev-hd-tit', title: EVENTO.tituloLargo },
            EVENTO.titulo,
            h('span', { className: 'ev-ver', title: EVENTO.titulo + ' v' + APP_VERSION }, 'v' + APP_VERSION)))),
      h('nav', { className: 'ev-tabs', role: 'tablist' }, TABS.map((t) => h('button', {
        key: t.id,
        type: 'button',
        role: 'tab',
        'aria-selected': m.tab === t.id ? 'true' : 'false',
        className: 'ev-tab' + (m.tab === t.id ? ' on' : ''),
        onClick: () => irA(t.id),
      }, t.label, contadores[t.id] ? h('span', { className: 'ev-tab-n' }, String(contadores[t.id])) : null))),
      h('div', { className: 'ev-hd-acciones' }, h(BotonAgenda, { sm: true }))),

    h(Contador, { estado: est, mostrarSegundos: cfg.mostrarSegundos !== false }),

    h('main', { className: 'ev-body' }, (vistas[m.tab] || vistas.resumen)()));
  }

  return {
    Component,
    unmount() {
      clearTimeout(guardarT);
      listeners.clear();
      if (offAgent) { try { offAgent(); } catch (e) { /* ya desregistrado */ } }
      if (offConfig) { try { offConfig(); } catch (e) { /* ya desuscrito */ } }
    },
  };
}
