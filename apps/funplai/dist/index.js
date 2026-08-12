/**
 * Kimos FunPlai — juegos interactivos para tótem (bundle AppShell v1).
 *
 * App instalable de KIMOS (contrato `export default mount(shell)`), pensada
 * para una pantalla táctil vertical de tótem, con juegos que combinan:
 *   · Pantalla táctil pura        → "Coloca la cola al burro", "Lanza y acierta".
 *   · Cámara + detección de pose  → "Prueba de baile" (y lanzamiento por gesto).
 *   · Puntero absoluto / lightgun → "LaserGun" (pistola tipo Duck Hunt).
 *
 * Todo es editable desde la propia app (Editor): nombres, textos, colores,
 * temática, dificultad, coreografías, objetivos y puntajes. La configuración se
 * exporta/importa como JSON para clonar el montaje a otros tótems.
 *
 * Temática incluida: Fiestas Patrias de Chile (banderines, escarapela, copihue,
 * volantines, trompo, empanadas, cueca). Todo el arte es SVG embebido: la app
 * no necesita red en runtime salvo que se active el motor de pose por CDN.
 *
 * Privacidad: el video NUNCA se graba ni se envía. La detección de pose corre
 * localmente en el navegador y solo se conservan ángulos articulares del turno
 * en curso. La app muestra un aviso visible mientras la cámara está activa.
 *
 * Reglas del host respetadas: React viene de `globalThis.React`, sin JSX, el
 * estado vive dentro de `mount()` y `unmount()` limpia timers/listeners/cámara.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ══════════════════════════════════════════════════════════════════════
  // 1. Utilidades
  // ══════════════════════════════════════════════════════════════════════

  const s = (v) => (v == null ? '' : String(v));
  const num = (v, def) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const round1 = (v) => Math.round(v * 10) / 10;
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /** Mezcla profunda no destructiva (los arrays se reemplazan completos). */
  function merge(base, patch) {
    if (!isObj(base)) return patch === undefined ? base : patch;
    if (!isObj(patch)) return patch === undefined ? base : patch;
    const out = Object.assign({}, base);
    for (const k of Object.keys(patch)) {
      out[k] = isObj(base[k]) && isObj(patch[k]) ? merge(base[k], patch[k]) : patch[k];
    }
    return out;
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));

  /** Ángulo (grados 0..180) del vértice B en el triángulo A-B-C. */
  function angleAt(a, b, c) {
    if (!a || !b || !c) return null;
    const v1x = a.x - b.x, v1y = a.y - b.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
    if (!n1 || !n2) return null;
    const cos = clamp((v1x * v2x + v1y * v2y) / (n1 * n2), -1, 1);
    return (Math.acos(cos) * 180) / Math.PI;
  }

  /** Ángulo del segmento B→A respecto de la vertical hacia abajo (0..180). */
  function angleFromDown(b, a) {
    if (!a || !b) return null;
    const dx = a.x - b.x, dy = a.y - b.y;
    const n = Math.hypot(dx, dy);
    if (!n) return null;
    return (Math.acos(clamp(dy / n, -1, 1)) * 180) / Math.PI;
  }

  const rad = (deg) => (deg * Math.PI) / 180;
  /** Punto a `len` px desde `p` en dirección `deg` (0 = abajo, horario). */
  function proj(p, deg, len) {
    return { x: p.x + Math.sin(rad(deg)) * len, y: p.y + Math.cos(rad(deg)) * len };
  }

  // Recursos vivos que `unmount()` debe cerrar.
  const timers = new Set();
  const rafs = new Set();
  const teardown = new Set();
  const setT = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clrT = (t) => { clearTimeout(t); timers.delete(t); };
  function loop(step) {
    let id = 0, alive = true, prev = nowMs();
    const tick = (t) => {
      if (!alive) return;
      const dt = Math.min(0.05, (t - prev) / 1000);
      prev = t;
      step(dt, t);
      id = requestAnimationFrame(tick);
      rafs.add(id);
    };
    id = requestAnimationFrame(tick);
    rafs.add(id);
    return () => { alive = false; cancelAnimationFrame(id); rafs.delete(id); };
  }

  const notify = (level, text) => {
    try { shell.notify && shell.notify({ level, text }); } catch (e) { /* host sin toasts */ }
  };

  // ══════════════════════════════════════════════════════════════════════
  // 2. Temas y configuración por defecto
  // ══════════════════════════════════════════════════════════════════════

  const THEMES = {
    'fiestas-patrias': {
      name: 'Fiestas Patrias de Chile',
      accent: '#D52B1E',      // rojo bandera
      accent2: '#0039A6',     // azul bandera
      bg: '#12213F',
      bg2: '#0B1730',
      surface: '#F6F1E4',     // papel / mantel huaso
      ink: '#1B2436',
      decor: 'banderines',
      emoji: '🇨🇱',
    },
    'neutro': {
      name: 'Neutro Kimos',
      accent: '#19ACB1',
      accent2: '#5C6BC0',
      bg: '#101826',
      bg2: '#0A101B',
      surface: '#F4F7FA',
      ink: '#16202E',
      decor: 'ninguno',
      emoji: '🎮',
    },
    'verano': {
      name: 'Verano / playa',
      accent: '#FF7A1A',
      accent2: '#00A3C4',
      bg: '#0E2A38',
      bg2: '#07202C',
      surface: '#FFF6E8',
      ink: '#123',
      decor: 'ninguno',
      emoji: '🏖️',
    },
  };

  const CHOREOS = {
    cueca: {
      id: 'cueca',
      name: 'Cueca — vuelta de pañuelo',
      bpm: 96,
      musicHint: 'Cueca tradicional (4/4, acordeón y guitarra)',
      // Cada paso: ángulos objetivo por articulación (grados) + pista al usuario.
      // Convención: hombro/cadera = ángulo del segmento respecto de la vertical
      // hacia abajo; codo/rodilla = ángulo interior de la articulación.
      steps: [
        { name: 'Pañuelo arriba', beats: 2, tip: 'Levanta el pañuelo sobre la cabeza',
          pose: { hombroI: 150, hombroD: 40, codoI: 165, codoD: 120, caderaI: 8, caderaD: 8, rodillaI: 172, rodillaD: 172 } },
        { name: 'Escobillado derecha', beats: 2, tip: 'Pie derecho adelante, brazo suelto',
          pose: { hombroI: 55, hombroD: 130, codoI: 150, codoD: 150, caderaI: 20, caderaD: 5, rodillaI: 150, rodillaD: 175 } },
        { name: 'Vuelta', beats: 2, tip: 'Gira con los brazos abiertos',
          pose: { hombroI: 105, hombroD: 105, codoI: 170, codoD: 170, caderaI: 12, caderaD: 12, rodillaI: 170, rodillaD: 170 } },
        { name: 'Escobillado izquierda', beats: 2, tip: 'Ahora el pie izquierdo',
          pose: { hombroI: 130, hombroD: 55, codoI: 150, codoD: 150, caderaI: 5, caderaD: 20, rodillaI: 175, rodillaD: 150 } },
        { name: 'Zapateo', beats: 2, tip: 'Marca el ritmo con los pies',
          pose: { hombroI: 35, hombroD: 35, codoI: 95, codoD: 95, caderaI: 25, caderaD: 6, rodillaI: 120, rodillaD: 176 } },
        { name: 'Pañuelo al cielo', beats: 2, tip: 'Cierra con los dos brazos arriba',
          pose: { hombroI: 165, hombroD: 165, codoI: 172, codoD: 172, caderaI: 6, caderaD: 6, rodillaI: 175, rodillaD: 175 } },
      ],
    },
    dieciocho: {
      id: 'dieciocho',
      name: 'Dieciochero — pasos fáciles',
      bpm: 108,
      musicHint: 'Cumbia chilena / tonada alegre',
      steps: [
        { name: 'Palmas arriba', beats: 2, tip: 'Aplaude sobre la cabeza',
          pose: { hombroI: 160, hombroD: 160, codoI: 120, codoD: 120, caderaI: 6, caderaD: 6, rodillaI: 175, rodillaD: 175 } },
        { name: 'Paso lateral', beats: 2, tip: 'Un paso a la derecha',
          pose: { hombroI: 95, hombroD: 95, codoI: 160, codoD: 160, caderaI: 25, caderaD: 8, rodillaI: 172, rodillaD: 172 } },
        { name: 'Molinete', beats: 2, tip: 'Gira los brazos como aspas',
          pose: { hombroI: 140, hombroD: 45, codoI: 175, codoD: 175, caderaI: 10, caderaD: 10, rodillaI: 170, rodillaD: 170 } },
        { name: 'Paso lateral izquierdo', beats: 2, tip: 'Un paso a la izquierda',
          pose: { hombroI: 95, hombroD: 95, codoI: 160, codoD: 160, caderaI: 8, caderaD: 25, rodillaI: 172, rodillaD: 172 } },
      ],
    },
  };

  const DEFAULT_GAMES = [
    {
      id: 'burro', type: 'burro', enabled: true, order: 1,
      name: 'Coloca la cola al burro', icon: '🫏',
      blurb: 'Arrastra la cola con el dedo y suéltala en el centro de la mira.',
      config: {
        intentos: 3,
        velocidadMira: 1.0,      // multiplicador de la órbita de la mira
        radioBlanco: 130,        // px SVG: fuera de este radio el puntaje es 0
        bonusZona: true,         // penaliza si la mira está lejos del anca
        mostrarPuntajeVivo: true,
        vibrar: true,
        textoFinal: '¡Bien hecho, huaso!',
      },
    },
    {
      id: 'baile', type: 'baile', enabled: true, order: 2,
      name: 'Prueba de baile', icon: '💃',
      blurb: 'Imita al avatar. La cámara mide tu postura y tu ritmo.',
      config: {
        coreografia: 'cueca',
        vueltas: 2,
        toleranciaGrados: 55,    // error articular que lleva el puntaje a 0
        pesoRitmo: 0.3,          // 30% ritmo, 70% postura
        cuentaRegresiva: 5,
        exigirCalibracion: true,
        mostrarEsqueleto: true,
      },
    },
    {
      id: 'laser', type: 'laser', enabled: true, order: 3,
      name: 'LaserGun dieciochero', icon: '🔫',
      blurb: 'Dispara a empanadas, choripanes y volantines. Esquiva los ajíes y los schops.',
      config: {
        duracion: 60,            // segundos
        municion: 6,
        recargaAuto: false,      // true = sin recarga manual
        spawnMs: 900,
        velocidad: 1.0,
        penalizacion: 5,
        radioAcierto: 46,
        metaPuntos: 300,         // puntos que equivalen a un 10 en el ranking
      },
    },
    {
      id: 'rayuela', type: 'rayuela', enabled: true, order: 4,
      name: 'Rayuela Chilena', icon: '🥏',
      blurb: 'El deporte nacional: quema la lienza. Desliza para lanzar o hazlo con el brazo.',
      config: {
        equipos: 1,              // 1 = individual · 2 = duelo por equipos
        tejosPorEquipo: 4,
        distanciaMetros: 1.5,    // medio cuerpo: se juega cerca del tótem
        viento: 0.35,            // 0..1 — hay que compensarlo, como en el golf
        velocidadBarra: 1.5,     // rapidez del marcador de precisión
        fuerzaLienza: 3.2,       // fuerza del gesto que cae justo en la lienza
        sensibilidadProfundidad: 0.42,
        sensibilidadLateral: 0.30,
        dispersion: 0.05,        // aleatoriedad del tiro (0 = determinista)
        toleranciaQuemada: 0.05, // metros: el tejo toca la lienza
        vistaSuperior: true,
        marcaCajon: 'KIMOS',     // placa de marca en el cajón, como en las canchas
      },
    },
    {
      id: 'boxeo', type: 'boxeo', enabled: true, order: 5,
      name: 'Boxeo', icon: '🥊',
      blurb: 'Pelea con el canguro boxeador o con el boxeador humano. Solo medio cuerpo.',
      config: {
        contrincante: 'canguro', // canguro | humano (el jugador puede cambiarlo)
        dificultad: 'media',     // facil | media | dificil
        duracion: 90,            // segundos del asalto
        distanciaMetros: 1.5,
      },
    },
    {
      id: 'gato', type: 'gato', enabled: true, order: 6,
      name: 'Gato', icon: '⭕',
      blurb: 'El clásico tres en línea: contra el tótem o entre dos personas.',
      config: {
        modo: 'maquina',         // maquina | dos-jugadores
        dificultad: 'media',     // facil | media | dificil (imbatible)
        rondas: 3,
      },
    },
  ];

  const DEFAULT_MODEL = {
    schema: 1,
    branding: {
      appName: 'Kimos FunPlai',
      tagline: 'Juegos interactivos para tótem',
      logo: '🎉',
      theme: 'fiestas-patrias',
      accent: '',              // vacío = usa el del tema
      accent2: '',
      heroTitle: '¡Celebremos el 18 jugando!',
      heroSubtitle: 'Elige un juego y toca la pantalla para comenzar',
      pieDePagina: 'Kimos FunPlai · toca para jugar',
      idleSeconds: 120,        // volver al inicio tras inactividad (0 = nunca)
      mostrarRanking: true,
    },
    hardware: {
      camaraHabilitada: true,
      camaraDeviceId: '',
      espejo: true,
      motorPose: 'auto',       // auto | mediapipe | demo | ninguno
      poseModuleUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
      poseWasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      poseModelUrl: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      avisoCamara: true,
      trackerExterno: false,   // escucha window.postMessage({type:'funplai:impact'})
    },
    games: DEFAULT_GAMES,
    choreos: CHOREOS,
    scores: [],                // últimos resultados (ranking del tótem)
  };

  // ══════════════════════════════════════════════════════════════════════
  // 3. Estado del closure (una copia por ventana) + persistencia
  // ══════════════════════════════════════════════════════════════════════

  let model = clone(DEFAULT_MODEL);
  let ready = false;
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l(model); };

  let saveTimer = null;
  function scheduleSave() {
    if (!shell.app || !shell.app.instanceId) return;   // singleton: sin persistencia
    if (saveTimer) clrT(saveTimer);
    saveTimer = setT(() => {
      saveTimer = null;
      try { Promise.resolve(shell.saveData({ funplai: model })).catch(() => {}); } catch (e) { /* noop */ }
    }, 700);
  }

  function commit(next, opts) {
    model = next;
    emit();
    if (!opts || opts.save !== false) scheduleSave();
  }
  const patch = (p, opts) => commit(merge(model, p), opts);

  function updateGame(id, cfgPatch) {
    const games = model.games.map((g) => (g.id === id ? merge(g, cfgPatch) : g));
    commit(merge(model, { games }));
  }

  function addScore(entry) {
    const row = merge({ id: uid('sc'), at: new Date().toISOString(), jugador: '', juego: '', puntaje: 0, detalle: '' }, entry || {});
    const scores = [row].concat(model.scores || []).slice(0, 60);
    commit(merge(model, { scores }));
    return row;
  }

  function hydrate(raw) {
    const data = raw && raw.funplai ? raw.funplai : raw;
    if (!isObj(data)) return;
    const next = merge(clone(DEFAULT_MODEL), data);
    // Los juegos se fusionan por id para no perder claves nuevas del bundle.
    if (Array.isArray(data.games)) {
      // Los tipos que ya no existen en el bundle se descartan (p. ej. el juego
      // "Lanza y acierta", que se fusionó con la Rayuela Chilena).
      next.games = data.games
        .filter((g) => DEFAULT_GAMES.some((d) => d.type === g.type))
        .map((g) => {
          const base = DEFAULT_GAMES.find((d) => d.type === g.type);
          return merge(clone(base), g);
        });
      // Migración: los juegos que trae una versión nueva del bundle se agregan a
      // las instancias ya guardadas, sin tocar lo que el cliente configuró.
      for (const def of DEFAULT_GAMES) {
        if (!next.games.some((g) => g.id === def.id)) next.games.push(clone(def));
      }
    }
    model = next;
    emit();
  }

  (function boot() {
    let done = false;
    const finish = () => { if (done) return; done = true; ready = true; emit(); };
    try {
      Promise.resolve(shell.loadData ? shell.loadData() : null)
        .then((d) => { hydrate(d); })
        .catch(() => {})
        .finally(finish);
    } catch (e) { finish(); }
    setT(finish, 4000);   // nunca dejar la pantalla en "cargando" por un host lento
  })();

  // Parámetros del host (⚙️ Configurar) — retrocompatible.
  if (shell.config && typeof shell.config.get === 'function') {
    const applyHostConfig = (cfg) => {
      if (!isObj(cfg)) return;
      const b = {};
      if (cfg.accent) b.accent = cfg.accent;
      if (cfg.theme) b.theme = cfg.theme;
      if (typeof cfg.idleSeconds === 'number') b.idleSeconds = cfg.idleSeconds;
      if (typeof cfg.camaraHabilitada === 'boolean') {
        commit(merge(model, { branding: b, hardware: { camaraHabilitada: cfg.camaraHabilitada } }), { save: false });
      } else if (Object.keys(b).length) {
        commit(merge(model, { branding: b }), { save: false });
      }
    };
    try {
      Promise.resolve(shell.config.get()).then(applyHostConfig).catch(() => {});
      if (typeof shell.config.onChange === 'function') {
        const off = shell.config.onChange(applyHostConfig);
        if (typeof off === 'function') teardown.add(off);
      }
    } catch (e) { /* host sin config */ }
  }

  // Documentos (🗂️): serializar / restaurar versiones sin código extra del host.
  if (shell.documents) {
    try {
      if (typeof shell.documents.onSerialize === 'function') shell.documents.onSerialize(() => ({ funplai: model }));
      if (typeof shell.documents.onLoad === 'function') shell.documents.onLoad((cfg) => hydrate(cfg));
    } catch (e) { /* noop */ }
  }

  try { shell.window && shell.window.setTitle && shell.window.setTitle(model.branding.appName); } catch (e) { /* noop */ }

  // Navegación (fuera de React para que el agente también pueda moverla).
  let route = { screen: 'home', gameId: '' };
  const routeListeners = new Set();
  function go(screen, gameId) {
    route = { screen, gameId: gameId || '' };
    for (const l of routeListeners) l(route);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. Tema visual y átomos de UI
  // ══════════════════════════════════════════════════════════════════════

  function themeOf(m) {
    const base = THEMES[m.branding.theme] || THEMES['fiestas-patrias'];
    return Object.assign({}, base, {
      accent: m.branding.accent || base.accent,
      accent2: m.branding.accent2 || base.accent2,
    });
  }

  function cssVars(t) {
    return {
      '--fp-accent': t.accent,
      '--fp-accent2': t.accent2,
      '--fp-bg': t.bg,
      '--fp-bg2': t.bg2,
      '--fp-surface': t.surface,
      '--fp-ink': t.ink,
    };
  }

  const Boton = (p) => h('button', {
    type: 'button',
    className: 'fp-btn' + (p.variant ? ' fp-btn--' + p.variant : '') + (p.className ? ' ' + p.className : ''),
    onClick: p.onClick,
    disabled: p.disabled,
    style: p.style,
    title: p.title,
  }, p.children);

  const Chip = (p) => h('span', { className: 'fp-chip' + (p.tone ? ' fp-chip--' + p.tone : '') }, p.children);

  function Campo(p) {
    const id = 'fp-f-' + (p.name || uid('x'));
    const common = { id, className: 'fp-input', value: p.value == null ? '' : p.value, onChange: (e) => p.onChange(e.target.value) };
    let control;
    if (p.type === 'textarea') control = h('textarea', Object.assign({}, common, { rows: p.rows || 3 }));
    else if (p.type === 'select') {
      control = h('select', common, (p.options || []).map((o) => h('option', { key: o.value, value: o.value }, o.label)));
    } else if (p.type === 'boolean') {
      control = h('label', { className: 'fp-switch' },
        h('input', { type: 'checkbox', checked: !!p.value, onChange: (e) => p.onChange(e.target.checked) }),
        h('span', null, p.value ? 'Sí' : 'No'));
    } else if (p.type === 'range') {
      control = h('div', { className: 'fp-range' },
        h('input', {
          type: 'range', min: p.min, max: p.max, step: p.step || 1, value: num(p.value, p.min),
          onChange: (e) => p.onChange(Number(e.target.value)),
        }),
        h('b', null, s(p.value)));
    } else {
      control = h('input', Object.assign({}, common, {
        type: p.type || 'text',
        min: p.min, max: p.max, step: p.step,
        onChange: (e) => p.onChange(p.type === 'number' ? Number(e.target.value) : e.target.value),
      }));
    }
    return h('div', { className: 'fp-field' },
      h('label', { htmlFor: id }, p.label),
      control,
      p.help ? h('small', null, p.help) : null);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. Arte SVG dieciochero (embebido: la app no descarga imágenes)
  // ══════════════════════════════════════════════════════════════════════

  /** Bandera de Chile (unidad de 3x2). */
  function BanderaChile(props) {
    const w = num(props.w, 90), hh = w * 2 / 3;
    return h('svg', { viewBox: '0 0 3 2', width: w, height: hh, className: props.className, style: props.style },
      h('rect', { width: 3, height: 1, fill: '#fff' }),
      h('rect', { y: 1, width: 3, height: 1, fill: '#D52B1E' }),
      h('rect', { width: 1, height: 1, fill: '#0039A6' }),
      h('path', { d: estrella(0.5, 0.5, 0.34, 0.14), fill: '#fff' }));
  }

  /** Path de estrella de 5 puntas. */
  function estrella(cx, cy, R, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(3) + ' ' + (cy + Math.sin(a) * rr).toFixed(3) + ' ';
    }
    return d + 'Z';
  }

  /** Guirnalda de banderines chilenos colgando en arco. */
  function Banderines(props) {
    const n = num(props.n, 14), w = num(props.w, 1000), sag = num(props.sag, 46);
    const y = (x) => Math.sin((x / w) * Math.PI) * sag;
    const flags = [];
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w;
      const yy = y(x) + 6;
      const bw = w / n * 0.62, bh = bw * 1.15;
      flags.push(h('g', { key: i, transform: 'translate(' + x.toFixed(1) + ',' + yy.toFixed(1) + ')' },
        h('path', { d: 'M' + (-bw / 2) + ' 0 L' + (bw / 2) + ' 0 L0 ' + bh + ' Z', fill: '#fff' }),
        h('path', { d: 'M' + (-bw / 2) + ' 0 L' + (bw / 2) + ' 0 L0 ' + bh + ' Z', fill: 'none', stroke: 'rgba(0,0,0,.15)', strokeWidth: 1 }),
        h('path', { d: 'M' + (-bw / 2) + ' 0 L' + (bw / 2) + ' 0 L' + (bw * 0.30) + ' ' + (bh * 0.42) + ' L' + (-bw * 0.30) + ' ' + (bh * 0.42) + ' Z', fill: i % 2 ? '#D52B1E' : '#0039A6' }),
        h('path', { d: estrellaAbs(0, bh * 0.20, bw * 0.16, bw * 0.065), fill: '#fff' }),
        h('path', { d: 'M' + (-bw * 0.30) + ' ' + (bh * 0.42) + ' L' + (bw * 0.30) + ' ' + (bh * 0.42) + ' L0 ' + bh + ' Z', fill: i % 2 ? '#0039A6' : '#D52B1E' })));
    }
    let cuerda = 'M0 6';
    for (let x = 0; x <= w; x += w / 40) cuerda += ' L' + x.toFixed(1) + ' ' + (y(x) + 6).toFixed(1);
    return h('svg', { viewBox: '0 0 ' + w + ' ' + (sag + 90), className: 'fp-garland', preserveAspectRatio: 'none', style: props.style },
      h('path', { d: cuerda, fill: 'none', stroke: 'rgba(255,255,255,.55)', strokeWidth: 3 }),
      flags);
  }

  function estrellaAbs(cx, cy, R, r) { return estrella(cx, cy, R, r); }

  /** Escarapela tricolor (la del afiche). */
  function Escarapela(props) {
    const w = num(props.w, 120);
    const rayos = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      rayos.push(h('path', {
        key: i,
        d: 'M50 50 L' + (50 + Math.cos(a) * 48).toFixed(2) + ' ' + (50 + Math.sin(a) * 48).toFixed(2) +
           ' L' + (50 + Math.cos(a + 0.13) * 48).toFixed(2) + ' ' + (50 + Math.sin(a + 0.13) * 48).toFixed(2) + ' Z',
        fill: i % 2 ? '#D52B1E' : '#f2f2f2',
      }));
    }
    return h('svg', { viewBox: '0 0 100 100', width: w, height: w, style: props.style, className: props.className },
      h('circle', { cx: 50, cy: 50, r: 48, fill: '#0039A6' }), rayos,
      h('circle', { cx: 50, cy: 50, r: 26, fill: '#fff' }),
      h('circle', { cx: 50, cy: 50, r: 20, fill: '#0039A6' }),
      h('path', { d: estrella(50, 50, 15, 6), fill: '#fff' }));
  }

  /** Copihue (flor nacional). */
  function Copihue(props) {
    const w = num(props.w, 70);
    return h('svg', { viewBox: '0 0 100 130', width: w, height: w * 1.3, style: props.style },
      h('path', { d: 'M50 4 C48 30 46 40 50 46', stroke: '#2E7D32', strokeWidth: 5, fill: 'none' }),
      h('path', { d: 'M50 20 C30 12 22 22 34 30 C42 35 48 30 50 24 Z', fill: '#43A047' }),
      h('path', { d: 'M50 44 C24 52 24 96 50 124 C76 96 76 52 50 44 Z', fill: '#D52B1E' }),
      h('path', { d: 'M50 48 C36 60 36 92 50 116 C64 92 64 60 50 48 Z', fill: '#B71C1C', opacity: 0.55 }),
      h('path', { d: 'M50 60 C42 74 42 96 50 112', stroke: '#FFCDD2', strokeWidth: 4, fill: 'none', opacity: 0.8 }),
      h('circle', { cx: 50, cy: 124, r: 5, fill: '#FFE082' }));
  }

  /** Volantín (para LaserGun). */
  function volantinPath() { return 'M0 -34 L26 0 L0 34 L-26 0 Z'; }
  function Volantin(props) {
    const c1 = props.c1 || '#D52B1E', c2 = props.c2 || '#0039A6';
    return h('g', { transform: props.transform, opacity: props.opacity },
      h('path', { d: 'M0 34 q10 16 -4 26 q14 6 4 24', stroke: '#FFD54F', strokeWidth: 3, fill: 'none' }),
      h('path', { d: volantinPath(), fill: '#fff', stroke: 'rgba(0,0,0,.25)', strokeWidth: 1.5 }),
      h('path', { d: 'M0 -34 L26 0 L0 0 Z', fill: c1 }),
      h('path', { d: 'M0 0 L-26 0 L0 34 Z', fill: c2 }),
      h('path', { d: 'M0 -34 L0 34 M-26 0 L26 0', stroke: 'rgba(0,0,0,.25)', strokeWidth: 1.2 }));
  }

  /** Empanada (bonus). */
  function Empanada(props) {
    return h('g', { transform: props.transform },
      h('path', { d: 'M-30 8 q0 -34 30 -34 q30 0 30 34 q-30 16 -60 0 Z', fill: '#E3A959', stroke: '#B07A2A', strokeWidth: 2 }),
      h('path', { d: 'M-30 6 q30 16 60 0', stroke: '#B07A2A', strokeWidth: 3, fill: 'none' }),
      h('path', { d: 'M-22 -2 l6 8 M-10 -6 l6 10 M2 -7 l6 10 M14 -4 l6 9', stroke: '#B07A2A', strokeWidth: 2 }));
  }

  /** Trompo con lienza. */
  function Trompo(props) {
    return h('g', { transform: props.transform },
      h('path', { d: 'M-26 -10 L26 -10 L0 34 Z', fill: '#C0392B' }),
      h('rect', { x: -26, y: -20, width: 52, height: 10, rx: 3, fill: '#E8C39E' }),
      h('rect', { x: -3, y: -34, width: 6, height: 16, rx: 2, fill: '#7B4B2A' }),
      h('path', { d: 'M-26 -4 L26 -4', stroke: '#F4D03F', strokeWidth: 4 }));
  }

  /** Fondo de escenario: cordillera + cielo + guirnaldas. */
  function Escenario(props) {
    const t = props.theme;
    return h('div', { className: 'fp-stage-bg' },
      h('svg', { viewBox: '0 0 1000 600', preserveAspectRatio: 'xMidYMid slice', className: 'fp-stage-svg' },
        h('defs', null,
          h('linearGradient', { id: 'fp-sky', x1: 0, y1: 0, x2: 0, y2: 1 },
            h('stop', { offset: '0%', stopColor: t.bg }),
            h('stop', { offset: '100%', stopColor: t.bg2 }))),
        h('rect', { width: 1000, height: 600, fill: 'url(#fp-sky)' }),
        h('path', { d: 'M0 430 L120 320 L200 380 L300 250 L420 400 L520 300 L640 420 L760 330 L880 420 L1000 360 L1000 600 L0 600 Z', fill: 'rgba(255,255,255,.07)' }),
        h('path', { d: 'M0 470 L140 400 L260 460 L380 380 L520 470 L660 400 L800 470 L1000 420 L1000 600 L0 600 Z', fill: 'rgba(255,255,255,.05)' })),
      props.decor === false ? null : h('div', { className: 'fp-garland-wrap' }, h(Banderines, { n: 16, w: 1000, sag: 40 })));
  }

  // ── Burro (arte del juego 1) ──────────────────────────────────────────
  /**
   * Burro dieciochero en SVG (viewBox 0 0 1000 1150). Vista de tres cuartos:
   * el anca queda a la derecha; ahí va el blanco y orbita la mira.
   */
  const ANCA = { x: 648, y: 640 };   // centro del blanco (coordenadas SVG)

  function Burro(props) {
    const g = '#9CA3AF', gD = '#6B7280', gL = '#C4C9D0';
    return h('g', null,
      // patas traseras y delanteras
      h('g', { fill: g, stroke: gD, strokeWidth: 3 },
        h('path', { d: 'M700 800 q26 0 30 26 l10 150 q2 22 -24 22 q-24 0 -26 -22 l-14 -150 q-2 -26 24 -26 Z' }),
        h('path', { d: 'M560 810 q26 0 28 26 l6 146 q2 22 -24 22 q-24 0 -26 -22 l-8 -146 q-2 -26 24 -26 Z' }),
        h('path', { d: 'M330 790 q26 0 28 26 l8 156 q2 22 -24 22 q-24 0 -26 -22 l-10 -156 q-2 -26 24 -26 Z' }),
        h('path', { d: 'M258 780 q24 0 26 26 l6 160 q2 22 -24 22 q-24 0 -26 -22 l-6 -160 q-2 -26 24 -26 Z' })),
      h('g', { fill: '#2F3439' },
        h('rect', { x: 686, y: 962, width: 60, height: 26, rx: 10 }),
        h('rect', { x: 548, y: 962, width: 56, height: 26, rx: 10 }),
        h('rect', { x: 318, y: 968, width: 58, height: 26, rx: 10 }),
        h('rect', { x: 248, y: 972, width: 56, height: 26, rx: 10 })),
      // cuerpo
      h('path', {
        d: 'M250 640 q0 -150 150 -170 q120 -16 220 0 q160 24 160 180 q0 150 -140 168 q-160 20 -280 4 q-110 -16 -110 -182 Z',
        fill: g, stroke: gD, strokeWidth: 4,
      }),
      // anca (grupa): queda descubierta, es la zona de juego
      h('ellipse', { cx: 646, cy: 648, rx: 140, ry: 186, fill: gL, opacity: 0.9 }),
      h('path', { d: 'M614 476 q118 54 118 172 q0 116 -96 172', stroke: gD, strokeWidth: 4, fill: 'none', opacity: 0.45 }),
      // manta / poncho con franja tricolor (cubre el lomo, no el anca)
      h('path', {
        d: 'M312 468 q130 -42 262 -10 q46 10 48 62 l10 200 q4 52 -48 60 q-140 22 -266 -2 q-46 -8 -42 -60 l16 -196 q4 -46 20 -54 Z',
        fill: '#4B5563', stroke: '#374151', strokeWidth: 4,
      }),
      h('path', { d: 'M280 690 q150 30 316 4 l5 32 q-170 30 -325 -4 Z', fill: '#0039A6' }),
      h('path', { d: 'M279 722 q152 32 320 4 l4 30 q-172 32 -328 -4 Z', fill: '#fff' }),
      h('path', { d: 'M278 752 q154 34 322 4 l4 30 q-174 34 -330 -4 Z', fill: '#D52B1E' }),
      // cuello y cabeza (mirando a la izquierda)
      h('path', { d: 'M300 520 q-70 -60 -96 -160 q-14 -54 26 -70 q42 -16 66 34 q34 72 62 120 Z', fill: g, stroke: gD, strokeWidth: 4 }),
      h('path', { d: 'M120 300 q-30 -80 24 -116 q56 -38 108 6 q40 34 26 92 q-10 44 -60 60 q-64 20 -98 -42 Z', fill: g, stroke: gD, strokeWidth: 4 }),
      h('path', { d: 'M108 318 q-46 8 -58 44 q-12 38 26 52 q40 14 70 -14 q22 -22 14 -52 Z', fill: gL, stroke: gD, strokeWidth: 4 }),
      h('ellipse', { cx: 84, cy: 372, rx: 10, ry: 7, fill: '#374151', transform: 'rotate(-18 84 372)' }),
      h('path', { d: 'M74 396 q34 22 76 6', stroke: '#374151', strokeWidth: 5, fill: 'none', strokeLinecap: 'round' }),
      h('circle', { cx: 176, cy: 286, r: 12, fill: '#fff', stroke: '#374151', strokeWidth: 3 }),
      h('circle', { cx: 179, cy: 288, r: 6, fill: '#111827' }),
      // orejas
      h('path', { d: 'M150 184 q-24 -104 12 -126 q34 -20 44 74 q6 46 -6 66 Z', fill: g, stroke: gD, strokeWidth: 4 }),
      h('path', { d: 'M158 176 q-14 -78 6 -96 q18 -14 26 58 Z', fill: '#E5B7B7' }),
      h('path', { d: 'M232 176 q28 -100 66 -108 q34 -6 -2 90 q-16 44 -36 54 Z', fill: g, stroke: gD, strokeWidth: 4 }),
      h('path', { d: 'M242 172 q22 -74 46 -84 q18 -6 -8 60 Z', fill: '#E5B7B7' }),
      // crin
      h('path', { d: 'M236 236 q60 60 96 150 q-40 -20 -60 -60 q-24 -46 -36 -90 Z', fill: gD, opacity: 0.6 }),
      // sombrero de huaso con cinta tricolor
      h('g', { transform: 'rotate(-8 210 190)' },
        h('ellipse', { cx: 214, cy: 196, rx: 148, ry: 40, fill: '#F0C674', stroke: '#B08733', strokeWidth: 4 }),
        h('path', { d: 'M132 190 q10 -78 84 -80 q76 -2 82 80 q-84 24 -166 0 Z', fill: '#F5D591', stroke: '#B08733', strokeWidth: 4 }),
        h('path', { d: 'M136 172 q80 22 162 0 l-2 14 q-80 22 -158 0 Z', fill: '#0039A6' }),
        h('path', { d: 'M137 186 q80 22 160 0 l-2 12 q-78 22 -156 0 Z', fill: '#fff' }),
        h('path', { d: 'M138 198 q78 22 158 0 l-2 12 q-78 22 -154 0 Z', fill: '#D52B1E' })),
      props.children);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. Chrome de juego y pantalla de resultado (compartidos)
  // ══════════════════════════════════════════════════════════════════════

  function Marco(props) {
    return h('div', { className: 'fp-game' },
      h('header', { className: 'fp-game-head' },
        h(Boton, { variant: 'ghost', onClick: props.onExit }, '← Salir'),
        h('div', { className: 'fp-game-title' },
          h('span', { className: 'fp-game-icon' }, props.icon),
          h('span', null, props.title)),
        h('div', { className: 'fp-game-meta' }, props.meta)),
      h('div', { className: 'fp-game-body' }, props.children));
  }

  function estrellas(p10) {
    const n = Math.round(clamp(p10, 0, 10) / 2);
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function frasePuntaje(p10) {
    if (p10 >= 9) return '¡Puntería de campeón! 🏆';
    if (p10 >= 7) return '¡Muy bien! Casi perfecto.';
    if (p10 >= 5) return 'Buen intento, se puede mejorar.';
    if (p10 >= 3) return 'Vas aprendiendo, ¡otra vuelta!';
    return 'Uy... la próxima sale.';
  }

  function Resultado(props) {
    const [nombre, setNombre] = useState('');
    const [guardado, setGuardado] = useState(false);
    const p10 = clamp(num(props.puntaje10, 0), 0, 10);
    return h('div', { className: 'fp-result' },
      h(Escarapela, { w: 96 }),
      h('h2', null, props.titulo || '¡Fin del juego!'),
      h('div', { className: 'fp-result-score' }, round1(p10), h('small', null, '/10')),
      h('div', { className: 'fp-result-stars' }, estrellas(p10)),
      h('p', { className: 'fp-result-msg' }, props.mensaje || frasePuntaje(p10)),
      props.detalle ? h('div', { className: 'fp-result-detail' }, props.detalle) : null,
      model.branding.mostrarRanking ? h('div', { className: 'fp-result-save' },
        h('input', {
          className: 'fp-input', placeholder: 'Tu nombre (opcional)', value: nombre,
          maxLength: 24, onChange: (e) => setNombre(e.target.value), disabled: guardado,
        }),
        h(Boton, {
          variant: 'soft', disabled: guardado,
          onClick: () => {
            addScore({ jugador: nombre.trim() || 'Anónimo', juego: props.juego || '', puntaje: round1(p10), detalle: s(props.detalleTexto) });
            setGuardado(true);
            notify('success', 'Puntaje guardado en el ranking.');
          },
        }, guardado ? '✓ Guardado' : 'Guardar en el ranking')) : null,
      h('div', { className: 'fp-result-actions' },
        h(Boton, { variant: 'primary', onClick: props.onReplay }, 'Jugar otra vez'),
        h(Boton, { onClick: props.onExit }, 'Volver al menú')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. Juego 1 — "Coloca la cola al burro" (100% táctil)
  // ══════════════════════════════════════════════════════════════════════

  const BURRO_VB = { w: 1000, h: 1150 };

  /** Convierte coordenadas de puntero a coordenadas del viewBox del SVG. */
  function svgPoint(svgEl, evt, vb) {
    try {
      if (svgEl.createSVGPoint && svgEl.getScreenCTM) {
        const m = svgEl.getScreenCTM();
        if (m) {
          const pt = svgEl.createSVGPoint();
          pt.x = evt.clientX; pt.y = evt.clientY;
          const p = pt.matrixTransform(m.inverse());
          return { x: p.x, y: p.y };
        }
      }
    } catch (e) { /* fallback abajo */ }
    const r = svgEl.getBoundingClientRect();
    return { x: ((evt.clientX - r.left) / r.width) * vb.w, y: ((evt.clientY - r.top) / r.height) * vb.h };
  }

  /** Puntaje 0..10 de un intento: distancia al centro de la mira (+ zona). */
  function puntajeBurro(punto, mira, cfg) {
    const R = Math.max(30, num(cfg.radioBlanco, 130));
    const d = dist(punto.x, punto.y, mira.x, mira.y);
    let p = clamp(10 * (1 - d / R), 0, 10);
    if (cfg.bonusZona !== false) {
      // La mira orbita: acertar cuando está descentrada del anca vale un poco menos.
      const dz = dist(mira.x, mira.y, ANCA.x, ANCA.y);
      p *= clamp(1 - (dz / 300) * 0.35, 0.62, 1);
    }
    return round1(p);
  }

  function JuegoBurro(props) {
    const cfg = props.game.config || {};
    const intentos = Math.max(1, num(cfg.intentos, 3));
    const svgRef = useRef(null);
    const dragRef = useRef(false);
    const miraRef = useRef({ x: ANCA.x, y: ANCA.y });

    const [mira, setMira] = useState({ x: ANCA.x, y: ANCA.y });
    const [cola, setCola] = useState(null);       // posición mientras se arrastra
    const [fase, setFase] = useState('jugando');  // jugando | resultado | fin
    const [ronda, setRonda] = useState(1);
    const [ultimo, setUltimo] = useState(null);
    const [puntos, setPuntos] = useState([]);

    // Órbita de la mira alrededor del anca (se congela al soltar la cola).
    useEffect(() => {
      const vel = clamp(num(cfg.velocidadMira, 1), 0.2, 3);
      let t = 0;
      return loop((dt) => {
        if (fase !== 'jugando') return;
        t += dt * vel;
        const p = {
          x: ANCA.x + 120 * Math.sin(t * 1.15),
          y: ANCA.y + 96 * Math.sin(t * 1.73 + 0.9),
        };
        miraRef.current = p;
        setMira(p);
      });
    }, [fase, cfg.velocidadMira]);

    const onDown = useCallback((e) => {
      if (fase !== 'jugando' || !svgRef.current) return;
      dragRef.current = true;
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      setCola(svgPoint(svgRef.current, e, BURRO_VB));
    }, [fase]);

    const onMove = useCallback((e) => {
      if (!dragRef.current || !svgRef.current) return;
      setCola(svgPoint(svgRef.current, e, BURRO_VB));
    }, []);

    const onUp = useCallback((e) => {
      if (!dragRef.current || !svgRef.current) return;
      dragRef.current = false;
      const p = svgPoint(svgRef.current, e, BURRO_VB);
      const m = miraRef.current;
      const score = puntajeBurro(p, m, cfg);
      setCola(p);
      setUltimo({ punto: p, mira: m, score });
      const next = puntos.concat([score]);
      setPuntos(next);
      setFase('resultado');
      if (cfg.vibrar !== false && navigator.vibrate) { try { navigator.vibrate(score >= 7 ? [40, 40, 80] : 30); } catch (err) { /* noop */ } }
      setT(() => {
        if (next.length >= intentos) setFase('fin');
        else { setRonda((r) => r + 1); setCola(null); setUltimo(null); setFase('jugando'); }
      }, 1700);
    }, [cfg, puntos, intentos]);

    const total = puntos.length ? round1(puntos.reduce((a, b) => a + b, 0) / puntos.length) : 0;
    const vivo = cfg.mostrarPuntajeVivo !== false && cola && fase === 'jugando'
      ? puntajeBurro(cola, mira, cfg) : null;

    if (fase === 'fin') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h(Resultado, {
          puntaje10: total,
          juego: props.game.name,
          titulo: s(cfg.textoFinal) || '¡Fin del juego!',
          detalle: h('div', { className: 'fp-chips' }, puntos.map((p, i) => h(Chip, { key: i }, 'Intento ' + (i + 1) + ': ' + p))),
          detalleTexto: 'Intentos: ' + puntos.join(' · '),
          onExit: props.onExit,
          onReplay: () => { setPuntos([]); setRonda(1); setCola(null); setUltimo(null); setFase('jugando'); },
        }));
    }

    return h(Marco, {
      icon: props.game.icon, title: props.game.name, onExit: props.onExit,
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, null, 'Intento ' + ronda + '/' + intentos),
        h(Chip, { tone: 'accent' }, 'Promedio ' + total)),
    },
      h('div', { className: 'fp-burro-wrap' },
        h('svg', {
          ref: svgRef, className: 'fp-burro-svg', viewBox: '0 0 1000 1150',
          onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
        },
          h('defs', null,
            h('radialGradient', { id: 'fp-wall', cx: '50%', cy: '35%', r: '75%' },
              h('stop', { offset: '0%', stopColor: '#D9BE8E' }),
              h('stop', { offset: '100%', stopColor: '#B08A56' }))),
          h('rect', { width: 1000, height: 1150, fill: 'url(#fp-wall)' }),
          // guirnalda de banderines (paths dentro del mismo SVG)
          h('g', { opacity: 0.95 },
            h('path', { d: 'M-10 60 Q250 150 520 70', stroke: '#fff', strokeWidth: 4, fill: 'none', opacity: 0.7 }),
            h('path', { d: 'M520 70 Q760 150 1010 60', stroke: '#fff', strokeWidth: 4, fill: 'none', opacity: 0.7 }),
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
              const x = 40 + i * 105;
              const y = 70 + Math.sin((x / 1000) * Math.PI * 2) * 34;
              return h('g', { key: i, transform: 'translate(' + x + ',' + y + ')' },
                h('path', { d: 'M-34 0 L34 0 L0 76 Z', fill: '#fff', stroke: 'rgba(0,0,0,.12)' }),
                h('path', { d: 'M-34 0 L34 0 L20 32 L-20 32 Z', fill: i % 2 ? '#D52B1E' : '#0039A6' }),
                h('path', { d: estrella(0, 15, 11, 4.5), fill: '#fff' }),
                h('path', { d: 'M-20 32 L20 32 L0 76 Z', fill: i % 2 ? '#0039A6' : '#D52B1E' }));
            })),
          // suelo
          h('path', { d: 'M0 1010 q500 -60 1000 0 L1000 1150 L0 1150 Z', fill: '#C8A264' }),
          h('path', { d: 'M120 1060 q20 -26 40 0 M300 1090 q20 -26 40 0 M700 1070 q20 -26 40 0 M880 1100 q20 -26 40 0', stroke: '#8E6B3A', strokeWidth: 5, fill: 'none' }),
          // burro
          h(Burro, null,
            // Blanco fijo en el anca (círculo blanco + anillos, como el afiche)
            h('g', null,
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 104, fill: '#fff', stroke: '#4B5563', strokeWidth: 5 }),
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 66, fill: 'none', stroke: '#0039A6', strokeWidth: 10 }),
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 26, fill: '#D52B1E' }))),
          // Mira móvil
          h('g', { transform: 'translate(' + mira.x.toFixed(1) + ',' + mira.y.toFixed(1) + ')', className: 'fp-mira' },
            h('circle', { r: 58, fill: 'rgba(255,255,255,.18)', stroke: '#111827', strokeWidth: 3, strokeDasharray: '10 8' }),
            h('circle', { r: 30, fill: 'none', stroke: '#0039A6', strokeWidth: 6 }),
            h('circle', { r: 9, fill: '#D52B1E' }),
            h('path', { d: 'M-72 0 L-40 0 M40 0 L72 0 M0 -72 L0 -40 M0 40 L0 72', stroke: '#111827', strokeWidth: 5, strokeLinecap: 'round' })),
          // Línea guía + puntaje en vivo
          cola && fase === 'jugando'
            ? h('g', null,
                h('line', { x1: cola.x, y1: cola.y, x2: mira.x, y2: mira.y, stroke: 'rgba(17,24,39,.35)', strokeWidth: 3, strokeDasharray: '8 8' }),
                vivo != null ? h('text', { x: cola.x + 20, y: cola.y - 26, className: 'fp-live-score' }, vivo + ' pts') : null)
            : null,
          // La cola (en reposo abajo a la izquierda, o bajo el dedo)
          h(Cola, { pos: cola || { x: 160, y: 890 }, activa: !!cola }),
          // Marca del último intento
          ultimo ? h('g', null,
            h('circle', { cx: ultimo.punto.x, cy: ultimo.punto.y, r: 16, fill: 'none', stroke: '#111827', strokeWidth: 4 }),
            h('text', { x: ultimo.punto.x, y: ultimo.punto.y - 40, className: 'fp-hit-score', textAnchor: 'middle' }, ultimo.score + ' / 10')) : null),
        h('p', { className: 'fp-hint' },
          fase === 'resultado'
            ? (ultimo ? frasePuntaje(ultimo.score) : '')
            : 'Arrastra la cola con el dedo y suéltala en el centro de la mira 🎯')));
  }

  /** La cola del burro: se toma con el dedo por su base. */
  function Cola(props) {
    const p = props.pos;
    return h('g', {
      transform: 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')',
      className: 'fp-cola' + (props.activa ? ' is-active' : ''),
      style: { cursor: 'grab' },
    },
      h('circle', { r: 46, fill: 'rgba(255,255,255,.001)' }),   // área táctil generosa
      h('path', { d: 'M0 0 q34 26 30 78 q-2 40 -22 66', stroke: '#6B7280', strokeWidth: 18, fill: 'none', strokeLinecap: 'round' }),
      h('path', { d: 'M0 0 q34 26 30 78 q-2 40 -22 66', stroke: '#9CA3AF', strokeWidth: 10, fill: 'none', strokeLinecap: 'round' }),
      h('path', { d: 'M8 144 q-26 34 -6 60 q22 28 44 2 q18 -22 -4 -58 Z', fill: '#4B5563' }),
      h('circle', { r: 13, fill: '#D52B1E', stroke: '#fff', strokeWidth: 4 }));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8. Motor de pose (cámara) — proveedor intercambiable
  // ══════════════════════════════════════════════════════════════════════
  //
  // El juego NO depende de una librería concreta: consume `landmarks` (33
  // puntos normalizados 0..1, convención MediaPipe Pose). Proveedores:
  //   · 'mediapipe' → carga @mediapipe/tasks-vision desde la URL configurada
  //                   (CDN por defecto; puede apuntar a un asset local del
  //                   tótem para operar sin internet).
  //   · 'demo'      → esqueleto sintético: permite probar puntaje, ritmo y
  //                   feedback sin cámara ni red (ferias, demos, QA).
  // Cambiar a una cámara RGB-D externa no cambia esta interfaz: basta con un
  // proveedor nuevo que entregue los mismos 33 puntos (+ profundidad opcional).

  const IDX = {
    nariz: 0, hombroI: 11, hombroD: 12, codoI: 13, codoD: 14, munecaI: 15, munecaD: 16,
    caderaI: 23, caderaD: 24, rodillaI: 25, rodillaD: 26, tobilloI: 27, tobilloD: 28,
  };
  const HUESOS = [
    [11, 12], [11, 23], [12, 24], [23, 24],
    [11, 13], [13, 15], [12, 14], [14, 16],
    [23, 25], [25, 27], [24, 26], [26, 28],
  ];

  /** Ángulos articulares a partir de los landmarks (grados). */
  function angulosDePose(L, espejo) {
    if (!L || L.length < 29) return null;
    const g = (i) => {
      const p = L[i];
      if (!p) return null;
      if (p.visibility != null && p.visibility < 0.3) return null;
      return { x: p.x, y: p.y };
    };
    const P = {};
    for (const k of Object.keys(IDX)) P[k] = g(IDX[k]);
    const out = {
      hombroI: angleFromDown(P.hombroI, P.codoI),
      hombroD: angleFromDown(P.hombroD, P.codoD),
      codoI: angleAt(P.hombroI, P.codoI, P.munecaI),
      codoD: angleAt(P.hombroD, P.codoD, P.munecaD),
      caderaI: angleFromDown(P.caderaI, P.rodillaI),
      caderaD: angleFromDown(P.caderaD, P.rodillaD),
      rodillaI: angleAt(P.caderaI, P.rodillaI, P.tobilloI),
      rodillaD: angleAt(P.caderaD, P.rodillaD, P.tobilloD),
    };
    if (!espejo) return out;
    // Con la imagen en espejo, el usuario imita "como frente a un espejo".
    return {
      hombroI: out.hombroD, hombroD: out.hombroI,
      codoI: out.codoD, codoD: out.codoI,
      caderaI: out.caderaD, caderaD: out.caderaI,
      rodillaI: out.rodillaD, rodillaD: out.rodillaI,
    };
  }

  /**
   * Escala corporal para normalizar velocidades y fuerzas.
   *   'completo'  → distancia hombros–caderas (necesita ver el tronco entero).
   *   'superior'  → ancho de hombros (sirve aunque las caderas queden fuera de
   *                 cuadro; es la referencia de los juegos de medio cuerpo).
   * Devuelve null si no hay datos suficientes.
   */
  function escalaCorporal(L, modo) {
    if (!L) return null;
    const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
    if (!hI || !hD) return null;
    const ancho = Math.hypot(hI.x - hD.x, hI.y - hD.y);
    if (modo === 'superior') return ancho > 0.03 ? ancho : null;
    const cI = L[IDX.caderaI], cD = L[IDX.caderaD];
    if (!cI || !cD) return ancho > 0.03 ? ancho : null;
    const alto = Math.abs((cI.y + cD.y) / 2 - (hI.y + hD.y) / 2);
    return alto > 0.03 ? alto : (ancho > 0.03 ? ancho : null);
  }

  /**
   * Encuadre de la persona. `modo`:
   *   'completo' → exige ver de la cabeza a los pies (juego de baile).
   *   'superior' → basta cabeza, hombros y brazos. Permite jugar mucho más
   *                cerca del tótem y en espacios reducidos.
   */
  function encuadreDePose(L, modo) {
    if (!L || L.length < 29) return { ok: false, motivo: 'Sin persona detectada' };
    const vis = (i) => L[i] && (L[i].visibility == null || L[i].visibility > 0.4);

    if (modo === 'superior') {
      if (!vis(IDX.nariz)) return { ok: false, motivo: 'No veo tu cara: ponte frente al tótem' };
      if (!vis(IDX.hombroI) || !vis(IDX.hombroD)) return { ok: false, motivo: 'No veo tus hombros: céntrate en la cámara' };
      const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
      const ancho = Math.abs(hI.x - hD.x);
      const cx = (hI.x + hD.x) / 2;
      const cabezaY = L[IDX.nariz].y;
      if (ancho < 0.12) return { ok: false, motivo: 'Acércate: te ves muy pequeño' };
      if (ancho > 0.55) return { ok: false, motivo: 'Retrocede un paso' };
      if (cabezaY < 0.04) return { ok: false, motivo: 'Agáchate un poco: la cabeza se sale' };
      if (cabezaY > 0.55) return { ok: false, motivo: 'Levanta la vista: sube al cuadro' };
      if (cx < 0.32) return { ok: false, motivo: 'Muévete a tu derecha →' };
      if (cx > 0.68) return { ok: false, motivo: '← Muévete a tu izquierda' };
      const brazos = vis(IDX.munecaI) || vis(IDX.munecaD);
      if (!brazos) return { ok: false, motivo: 'Levanta las manos para que te vea' };
      return { ok: true, motivo: 'Posición correcta', ancho, cx, alto: null, modo: 'superior' };
    }

    const cabeza = vis(IDX.nariz);
    const pies = vis(IDX.tobilloI) || vis(IDX.tobilloD);
    if (!cabeza) return { ok: false, motivo: 'No veo tu cabeza: retrocede un poco' };
    if (!pies) return { ok: false, motivo: 'No veo tus pies: aléjate del tótem' };
    let minY = 1, maxY = 0, minX = 1, maxX = 0;
    for (const p of L) {
      if (!p) continue;
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    }
    const alto = maxY - minY, ancho = maxX - minX;
    const cx = (minX + maxX) / 2;
    if (alto < 0.55) return { ok: false, motivo: 'Acércate: te ves muy pequeño' };
    if (alto > 0.99) return { ok: false, motivo: 'Aléjate: no cabes en la zona' };
    if (cx < 0.3) return { ok: false, motivo: 'Muévete a tu derecha →' };
    if (cx > 0.7) return { ok: false, motivo: '← Muévete a tu izquierda' };
    return { ok: true, motivo: 'Posición correcta', alto, ancho, cx, modo: 'completo' };
  }

  /** Proveedor 'demo': esqueleto sintético que sigue la coreografía. */
  function proveedorDemo() {
    let objetivo = null;
    return {
      tipo: 'demo',
      nombre: 'Simulador (sin cámara)',
      setObjetivo(p) { objetivo = p; },
      async iniciar() { return true; },
      detener() {},
      leer() {
        const base = objetivo || { hombroI: 60, hombroD: 60, codoI: 160, codoD: 160, caderaI: 8, caderaD: 8, rodillaI: 172, rodillaD: 172 };
        const jitter = (v) => v + (Math.random() - 0.5) * 26;
        const a = {
          hombroI: jitter(base.hombroI), hombroD: jitter(base.hombroD),
          codoI: jitter(base.codoI), codoD: jitter(base.codoD),
          caderaI: jitter(base.caderaI), caderaD: jitter(base.caderaD),
          rodillaI: jitter(base.rodillaI), rodillaD: jitter(base.rodillaD),
        };
        return { landmarks: landmarksDeAngulos(a), angulos: a, sintetico: true };
      },
    };
  }

  /** Construye landmarks (0..1) a partir de ángulos: usado por el demo y el overlay. */
  function landmarksDeAngulos(a) {
    const L = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 1 }));
    const cad = { x: 0.5, y: 0.62 }, dCad = 0.055, dHom = 0.075, torso = 0.20;
    const hombroC = { x: cad.x, y: cad.y - torso };
    const put = (i, p) => { L[i] = { x: p.x, y: p.y, visibility: 1 }; };
    const pI = (p, deg, len) => ({ x: p.x - Math.sin(rad(deg)) * len, y: p.y + Math.cos(rad(deg)) * len });
    const pD = (p, deg, len) => ({ x: p.x + Math.sin(rad(deg)) * len, y: p.y + Math.cos(rad(deg)) * len });
    const hI = { x: hombroC.x - dHom, y: hombroC.y }, hD = { x: hombroC.x + dHom, y: hombroC.y };
    const cI = { x: cad.x - dCad, y: cad.y }, cD = { x: cad.x + dCad, y: cad.y };
    put(0, { x: hombroC.x, y: hombroC.y - 0.09 });
    put(11, hI); put(12, hD); put(23, cI); put(24, cD);
    const coI = pI(hI, a.hombroI, 0.12), coD = pD(hD, a.hombroD, 0.12);
    put(13, coI); put(14, coD);
    put(15, pI(coI, a.hombroI - (180 - a.codoI), 0.11));
    put(16, pD(coD, a.hombroD - (180 - a.codoD), 0.11));
    const rI = pI(cI, a.caderaI, 0.16), rD = pD(cD, a.caderaD, 0.16);
    put(25, rI); put(26, rD);
    put(27, pI(rI, a.caderaI + (180 - a.rodillaI), 0.16));
    put(28, pD(rD, a.caderaD + (180 - a.rodillaD), 0.16));
    return L;
  }

  /** Proveedor MediaPipe Tasks Vision (carga dinámica desde URL configurable). */
  function proveedorMediaPipe(hw) {
    let landmarker = null, video = null, ultimoTs = -1, ultima = null;
    return {
      tipo: 'mediapipe',
      nombre: 'MediaPipe Pose Landmarker',
      /** El host puede mover el <video> entre pantallas: se reengancha aquí. */
      setVideo(videoEl) { if (videoEl) video = videoEl; },
      async iniciar(videoEl) {
        video = videoEl;
        const mod = await import(/* webpackIgnore: true */ /* @vite-ignore */ s(hw.poseModuleUrl));
        const FilesetResolver = mod.FilesetResolver, PoseLandmarker = mod.PoseLandmarker;
        if (!FilesetResolver || !PoseLandmarker) throw new Error('El módulo de pose no expone PoseLandmarker.');
        const fileset = await FilesetResolver.forVisionTasks(s(hw.poseWasmUrl));
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: s(hw.poseModelUrl), delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        return true;
      },
      detener() {
        try { landmarker && landmarker.close && landmarker.close(); } catch (e) { /* noop */ }
        landmarker = null;
      },
      leer() {
        if (!landmarker || !video || video.readyState < 2) return ultima;
        const ts = nowMs();
        if (ts - ultimoTs < 24) return ultima;   // ~40 Hz máx.
        ultimoTs = ts;
        let res = null;
        try { res = landmarker.detectForVideo(video, ts); } catch (e) { return ultima; }
        const L = res && res.landmarks && res.landmarks[0];
        if (!L) { ultima = null; return null; }
        ultima = { landmarks: L, angulos: null, sintetico: false };
        return ultima;
      },
    };
  }

  /** Abre la cámara respetando la configuración del tótem. */
  async function abrirCamara(hw) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Este navegador no expone cámaras (getUserMedia no disponible).');
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      throw new Error('La cámara requiere HTTPS o localhost (contexto seguro).');
    }
    const video = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    if (hw.camaraDeviceId) video.deviceId = { exact: hw.camaraDeviceId };
    else video.facingMode = 'user';
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 9. Coreografía, avatar y comparación
  // ══════════════════════════════════════════════════════════════════════

  const JOINTS = ['hombroI', 'hombroD', 'codoI', 'codoD', 'caderaI', 'caderaD', 'rodillaI', 'rodillaD'];
  const GRUPOS = {
    brazos: ['hombroI', 'hombroD', 'codoI', 'codoD'],
    piernas: ['caderaI', 'caderaD', 'rodillaI', 'rodillaD'],
  };

  /** Interpola la coreografía: devuelve pose objetivo + paso actual. */
  function poseObjetivo(choreo, tMs) {
    const beatMs = 60000 / Math.max(40, num(choreo.bpm, 96));
    const steps = choreo.steps || [];
    if (!steps.length) return null;
    const durs = steps.map((st) => Math.max(1, num(st.beats, 2)) * beatMs);
    const total = durs.reduce((a, b) => a + b, 0);
    const t = ((tMs % total) + total) % total;
    let acc = 0, i = 0;
    for (; i < steps.length; i++) { if (t < acc + durs[i]) break; acc += durs[i]; }
    if (i >= steps.length) i = steps.length - 1;
    const k = clamp((t - acc) / durs[i], 0, 1);
    // El avatar viaja desde la pose anterior a la del paso durante la primera
    // mitad del compás (easing suave) y la sostiene en la segunda mitad: así el
    // usuario alcanza a ver la pose antes de que se le mida.
    const actual = steps[i].pose;
    const previa = steps[(i - 1 + steps.length) % steps.length].pose;
    const e = clamp(k / 0.5, 0, 1);
    const suave = e * e * (3 - 2 * e);
    const pose = {};
    for (const j of JOINTS) {
      const desde = num(previa[j], 0), hasta = num(actual[j], 0);
      pose[j] = desde + (hasta - desde) * suave;
    }
    return { pose, paso: steps[i], indice: i, total, beatMs, k, ciclo: Math.floor(tMs / total) };
  }

  /** Compara pose objetivo vs pose real. Devuelve puntajes 0..1 por grupo. */
  function compararPose(obj, real, tolerancia) {
    if (!obj || !real) return null;
    const tol = clamp(num(tolerancia, 55), 15, 120);
    const porArticulacion = {};
    let n = 0, suma = 0;
    for (const j of JOINTS) {
      const o = obj[j], r = real[j];
      if (o == null || r == null) continue;
      const err = Math.abs(o - r);
      const sc = clamp(1 - err / tol, 0, 1);
      porArticulacion[j] = sc;
      suma += sc; n++;
    }
    if (!n) return null;
    const grupo = (g) => {
      const arr = GRUPOS[g].map((j) => porArticulacion[j]).filter((v) => v != null);
      return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    };
    return { total: suma / n, brazos: grupo('brazos'), piernas: grupo('piernas'), porArticulacion };
  }

  /** Avatar dieciochero que ejecuta la coreografía (SVG paramétrico). */
  function Avatar(props) {
    const a = props.pose || {};
    const cad = { x: 0, y: 40 }, hom = { x: 0, y: -70 };
    const hI = { x: -46, y: hom.y }, hD = { x: 46, y: hom.y };
    const cI = { x: -30, y: cad.y }, cD = { x: 30, y: cad.y };
    const pI = (p, deg, len) => ({ x: p.x - Math.sin(rad(deg)) * len, y: p.y + Math.cos(rad(deg)) * len });
    const pD = (p, deg, len) => ({ x: p.x + Math.sin(rad(deg)) * len, y: p.y + Math.cos(rad(deg)) * len });
    const coI = pI(hI, num(a.hombroI, 40), 72), coD = pD(hD, num(a.hombroD, 40), 72);
    const muI = pI(coI, num(a.hombroI, 40) - (180 - num(a.codoI, 170)), 66);
    const muD = pD(coD, num(a.hombroD, 40) - (180 - num(a.codoD, 170)), 66);
    const roI = pI(cI, num(a.caderaI, 8), 96), roD = pD(cD, num(a.caderaD, 8), 96);
    const toI = pI(roI, num(a.caderaI, 8) + (180 - num(a.rodillaI, 175)), 92);
    const toD = pD(roD, num(a.caderaD, 8) + (180 - num(a.rodillaD, 175)), 92);
    const linea = (p, q, w, c) => h('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: c, strokeWidth: w, strokeLinecap: 'round' });
    const piel = '#E8B98F', ropa = props.color || '#8B1E1E';
    return h('g', { transform: props.transform || '' },
      // piernas (pantalón oscuro de huaso)
      linea(cI, roI, 26, '#2B2F3A'), linea(roI, toI, 22, '#2B2F3A'),
      linea(cD, roD, 26, '#2B2F3A'), linea(roD, toD, 22, '#2B2F3A'),
      h('ellipse', { cx: toI.x, cy: toI.y + 8, rx: 20, ry: 10, fill: '#3B2416' }),
      h('ellipse', { cx: toD.x, cy: toD.y + 8, rx: 20, ry: 10, fill: '#3B2416' }),
      // torso + manta
      h('path', { d: 'M-52 ' + (hom.y - 6) + ' L52 ' + (hom.y - 6) + ' L44 ' + (cad.y + 6) + ' L-44 ' + (cad.y + 6) + ' Z', fill: ropa }),
      h('path', { d: 'M-50 -6 L50 -6 L48 6 L-48 6 Z', fill: '#0039A6' }),
      h('path', { d: 'M-49 6 L49 6 L47 18 L-47 18 Z', fill: '#F7F7F7' }),
      h('path', { d: 'M-48 18 L48 18 L46 30 L-46 30 Z', fill: '#D52B1E' }),
      // brazos
      linea(hI, coI, 22, ropa), linea(coI, muI, 19, piel),
      linea(hD, coD, 22, ropa), linea(coD, muD, 19, piel),
      h('circle', { cx: muI.x, cy: muI.y, r: 11, fill: piel }),
      h('circle', { cx: muD.x, cy: muD.y, r: 11, fill: piel }),
      // pañuelo en la mano derecha
      h('path', {
        d: 'M' + muD.x + ' ' + muD.y + ' q26 -18 44 4 q-20 22 -44 -4 Z',
        fill: '#FFFFFF', stroke: '#D8D8D8', strokeWidth: 2,
      }),
      // cabeza + sombrero
      h('circle', { cx: 0, cy: hom.y - 40, r: 34, fill: piel }),
      h('circle', { cx: -12, cy: hom.y - 44, r: 4, fill: '#2B2F3A' }),
      h('circle', { cx: 12, cy: hom.y - 44, r: 4, fill: '#2B2F3A' }),
      h('path', { d: 'M-13 ' + (hom.y - 30) + ' q13 12 26 0', stroke: '#2B2F3A', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' }),
      h('g', null,
        h('ellipse', { cx: 0, cy: hom.y - 68, rx: 62, ry: 14, fill: '#F0C674' }),
        h('path', { d: 'M-30 ' + (hom.y - 70) + ' q4 -30 30 -30 q26 0 30 30 Z', fill: '#F5D591' }),
        h('path', { d: 'M-31 ' + (hom.y - 76) + ' q30 10 62 0 l0 7 q-32 10 -62 0 Z', fill: '#D52B1E' })));
  }

  /** Overlay del esqueleto detectado sobre el video. */
  function Esqueleto(props) {
    const L = props.landmarks;
    if (!L) return null;
    const W = 100, H = 100;
    const px = (p) => ({ x: (props.espejo ? 1 - p.x : p.x) * W, y: p.y * H });
    return h('svg', { className: 'fp-skeleton', viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
      HUESOS.map(([a, b], i) => {
        const pa = L[a], pb = L[b];
        if (!pa || !pb) return null;
        const A = px(pa), B = px(pb);
        return h('line', { key: i, x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: props.color || '#7CFFB2', strokeWidth: 1.1, strokeLinecap: 'round' });
      }),
      [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map((i) => {
        const p = L[i];
        if (!p) return null;
        const P = px(p);
        return h('circle', { key: 'p' + i, cx: P.x, cy: P.y, r: 1.4, fill: '#fff' });
      }));
  }

  /**
   * Silueta de encuadre. `modo`:
   *   'completo' → figura entera (baile).
   *   'superior' → busto: cabeza, hombros y brazos. La persona puede quedar
   *                mucho más cerca del tótem, que es lo que buscan los juegos
   *                pensados para espacios reducidos.
   */
  function Silueta(props) {
    const color = props.ok ? '#4ADE80' : 'rgba(255,255,255,.75)';
    const comun = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeDasharray: props.ok ? '' : '3 3' };
    if (props.modo === 'superior') {
      return h('svg', { className: 'fp-silhouette', viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
        h('circle', Object.assign({ cx: 50, cy: 26, r: 15 }, comun)),
        h('path', Object.assign({ d: 'M22 100 q2 -38 28 -44 q26 6 28 44' }, comun)),
        h('path', Object.assign({ d: 'M25 62 q-13 12 -14 38 M75 62 q13 12 14 38' }, comun)));
    }
    return h('svg', { className: 'fp-silhouette', viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
      h('path', Object.assign({
        d: 'M50 6 a7 7 0 1 1 0 14 a7 7 0 1 1 0 -14 M50 20 q-12 2 -13 16 l-2 20 q0 4 4 4 l1 26 q0 6 6 6 q5 0 5 -6 l1 -14 l1 14 q0 6 5 6 q6 0 6 -6 l1 -26 q4 0 4 -4 l-2 -20 q-1 -14 -13 -16 Z',
      }, comun, { strokeWidth: 1.6 })));
  }

  /**
   * Diagrama de ubicación para los juegos de MEDIO CUERPO: la persona se para
   * cerca del tótem y solo hace falta que se le vea de la cintura hacia arriba.
   * Se comparte entre Rayuela (modo cámara) y Boxeo.
   */
  function ZonaMedioCuerpo(props) {
    const ok = !!props.ok;
    const color = ok ? '#4ADE80' : 'var(--fp-accent)';
    return h('svg', { viewBox: '0 0 600 300', className: 'fp-pos-svg' },
      h('defs', null,
        h('linearGradient', { id: 'fp-piso2', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: '0%', stopColor: 'rgba(255,255,255,.05)' }),
          h('stop', { offset: '100%', stopColor: 'rgba(255,255,255,.16)' }))),
      // tótem
      h('g', null,
        h('rect', { x: 60, y: 40, width: 110, height: 200, rx: 10, fill: '#1f2937', stroke: 'rgba(255,255,255,.35)', strokeWidth: 3 }),
        h('rect', { x: 72, y: 52, width: 86, height: 160, rx: 6, fill: 'var(--fp-accent2)', opacity: 0.7 }),
        h('text', { x: 115, y: 262, textAnchor: 'middle', fill: '#fff', fontSize: 14, fontWeight: 700 }, 'TÓTEM'),
        // cámara sobre el marco
        h('circle', { cx: 115, cy: 32, r: 9, fill: '#111827', stroke: '#fff', strokeWidth: 2 }),
        h('circle', { cx: 115, cy: 32, r: 3.5, fill: ok ? '#4ADE80' : '#9CA3AF' })),
      // cono de visión de la cámara
      h('path', { d: 'M115 34 L520 -20 L520 250 Z', fill: 'url(#fp-piso2)', opacity: 0.5 }),
      // zona marcada en el piso
      h('ellipse', {
        cx: 380, cy: 232, rx: 105, ry: 30,
        fill: ok ? 'rgba(74,222,128,.25)' : 'rgba(213,43,30,.2)', stroke: color, strokeWidth: 4,
      }),
      // persona de medio cuerpo
      h('g', { transform: 'translate(380,150)', stroke: color, strokeWidth: 5, fill: 'none' },
        h('circle', { cx: 0, cy: -46, r: 26, fill: 'rgba(255,255,255,.1)' }),
        h('path', { d: 'M-46 76 q4 -58 46 -60 q42 2 46 60' }),
        h('path', { d: 'M-40 8 q-26 22 -22 60 M40 8 q26 22 22 60' })),
      // línea de corte: de aquí hacia abajo no hace falta
      h('path', { d: 'M300 226 L470 226', stroke: 'rgba(255,255,255,.55)', strokeWidth: 2, strokeDasharray: '8 6' }),
      h('text', { x: 490, y: 222, fill: 'rgba(255,255,255,.7)', fontSize: 12 }, 'de aquí hacia abajo, no importa'),
      // cota de distancia
      h('path', { d: 'M175 285 L365 285 M175 279 L175 291 M365 279 L365 291', stroke: '#fff', strokeWidth: 2 }),
      h('text', { x: 270, y: 276, textAnchor: 'middle', fill: '#fff', fontSize: 16, fontWeight: 700 },
        '≈ ' + props.metros + ' m'),
      props.nota ? h('text', { x: 270, y: 300, textAnchor: 'middle', fill: 'rgba(255,255,255,.7)', fontSize: 12 }, props.nota) : null);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 10. Juego 2 — "Prueba de baile" (cámara + pose)
  // ══════════════════════════════════════════════════════════════════════

  function JuegoBaile(props) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
    const choreo = (model.choreos && model.choreos[cfg.coreografia]) || CHOREOS.cueca;
    const vueltas = Math.max(1, num(cfg.vueltas, 2));

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const faseRef = useRef('intro');
    const t0Ref = useRef(0);
    const calibRef = useRef(0);
    const acumRef = useRef({ n: 0, total: 0, brazos: 0, nb: 0, piernas: 0, np: 0 });
    const ritmoRef = useRef({ beats: 0, ok: 0, hist: [], prevAng: null, prevIdx: -1 });

    const [fase, setFase] = useState('intro');
    const [motor, setMotor] = useState(null);      // etiqueta del proveedor activo
    const [error, setError] = useState('');
    const [hud, setHud] = useState({ score: 0, paso: '', tip: '', encuadre: '', progreso: 0, cuenta: 0 });
    const [vista, setVista] = useState({ landmarks: null, objetivo: null });
    const [final, setFinal] = useState(null);

    const irA = useCallback((f) => { faseRef.current = f; setFase(f); }, []);

    /**
     * El <video> se mueve de la intro al layout de baile: al remontarse hay que
     * devolverle el stream y avisarle al motor de pose cuál es el elemento vivo.
     */
    const attachVideo = useCallback((el) => {
      videoRef.current = el;
      if (!el) return;
      if (streamRef.current && el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
      }
      if (provRef.current && provRef.current.setVideo) provRef.current.setVideo(el);
    }, []);

    const soltarTodo = useCallback(() => {
      try { provRef.current && provRef.current.detener(); } catch (e) { /* noop */ }
      provRef.current = null;
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    }, []);

    useEffect(() => soltarTodo, [soltarTodo]);

    const reiniciarMetricas = () => {
      acumRef.current = { n: 0, total: 0, brazos: 0, nb: 0, piernas: 0, np: 0 };
      ritmoRef.current = { beats: 0, ok: 0, hist: [], prevAng: null, prevIdx: -1 };
      calibRef.current = 0;
    };

    const iniciar = useCallback(async (modo) => {
      setError('');
      reiniciarMetricas();
      if (modo === 'demo') {
        provRef.current = proveedorDemo();
        await provRef.current.iniciar();
        setMotor('Simulador (sin cámara)');
        irA('cuenta');
        t0Ref.current = nowMs();
        return;
      }
      irA('abriendo');
      try {
        const stream = await abrirCamara(hw);
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) throw new Error('No se pudo montar el elemento de video.');
        v.srcObject = stream;
        await v.play().catch(() => {});
        const prov = proveedorMediaPipe(hw);
        await prov.iniciar(v);
        provRef.current = prov;
        setMotor(prov.nombre);
        irA(cfg.exigirCalibracion === false ? 'cuenta' : 'calibrando');
        t0Ref.current = nowMs();
      } catch (e) {
        soltarTodo();
        setError(s(e && e.message ? e.message : e));
        irA('intro');
        notify('warn', 'No se pudo iniciar la cámara: ' + s(e && e.message ? e.message : e));
      }
    }, [hw, cfg.exigirCalibracion, irA, soltarTodo]);

    // Bucle principal: lee el proveedor, califica y actualiza el HUD.
    useEffect(() => {
      if (fase === 'intro' || fase === 'fin' || fase === 'abriendo') return undefined;
      const totalCiclo = (choreo.steps || []).reduce((a, st) => a + Math.max(1, num(st.beats, 2)) * (60000 / num(choreo.bpm, 96)), 0);
      const totalMs = totalCiclo * vueltas;
      let ultimoHud = 0;
      return loop((dt) => {
        const prov = provRef.current;
        if (!prov) return;
        const lectura = prov.leer();
        const L = lectura && lectura.landmarks;
        const angulos = lectura && lectura.angulos ? lectura.angulos : angulosDePose(L, hw.espejo !== false && !(lectura && lectura.sintetico));
        const f = faseRef.current;
        const t = nowMs();

        if (f === 'calibrando') {
          const enc = encuadreDePose(L);
          calibRef.current = enc.ok ? calibRef.current + dt : Math.max(0, calibRef.current - dt * 0.5);
          if (t - ultimoHud > 100) {
            ultimoHud = t;
            setVista({ landmarks: L, objetivo: null });
            setHud((x) => Object.assign({}, x, { encuadre: enc.motivo, progreso: clamp(calibRef.current / 1.6, 0, 1), ok: !!enc.ok }));
          }
          if (calibRef.current >= 1.6) { t0Ref.current = t; irA('cuenta'); }
          return;
        }

        if (f === 'cuenta') {
          const seg = Math.max(0, num(cfg.cuentaRegresiva, 5) - (t - t0Ref.current) / 1000);
          if (t - ultimoHud > 100) {
            ultimoHud = t;
            setVista({ landmarks: L, objetivo: null });
            setHud((x) => Object.assign({}, x, { cuenta: Math.ceil(seg) }));
          }
          if (seg <= 0) { t0Ref.current = t; irA('bailando'); }
          return;
        }

        if (f !== 'bailando') return;

        const tMs = t - t0Ref.current;
        const obj = poseObjetivo(choreo, tMs);
        if (!obj) return;
        if (prov.setObjetivo) prov.setObjetivo(obj.pose);   // el simulador "baila"

        const cmp = compararPose(obj.pose, angulos, cfg.toleranciaGrados);
        if (cmp) {
          const A = acumRef.current;
          A.n += dt; A.total += cmp.total * dt;
          if (cmp.brazos != null) { A.brazos += cmp.brazos * dt; A.nb += dt; }
          if (cmp.piernas != null) { A.piernas += cmp.piernas * dt; A.np += dt; }
        }

        // Ritmo: energía de movimiento del usuario contra los cambios de paso.
        const R = ritmoRef.current;
        if (angulos) {
          if (R.prevAng) {
            let d = 0, n = 0;
            for (const j of JOINTS) {
              if (angulos[j] == null || R.prevAng[j] == null) continue;
              d += Math.abs(angulos[j] - R.prevAng[j]); n++;
            }
            if (n) R.hist.push({ t, e: d / n / Math.max(0.008, dt) });
            if (R.hist.length > 240) R.hist.shift();
          }
          R.prevAng = angulos;
        }
        if (obj.indice !== R.prevIdx) {
          if (R.prevIdx >= 0 && R.hist.length > 6) {
            const vent = R.hist.filter((x) => t - x.t < 450);
            const maxE = vent.length ? Math.max.apply(null, vent.map((x) => x.e)) : 0;
            const avgE = R.hist.reduce((a, b) => a + b.e, 0) / R.hist.length;
            R.beats++;
            if (maxE > Math.max(6, avgE * 1.15)) R.ok++;
          }
          R.prevIdx = obj.indice;
        }

        if (t - ultimoHud > 90) {
          ultimoHud = t;
          const A = acumRef.current;
          setVista({ landmarks: L, objetivo: obj.pose });
          setHud({
            score: A.n ? Math.round((A.total / A.n) * 100) : 0,
            paso: obj.paso.name, tip: obj.paso.tip,
            encuadre: L ? '' : 'No te veo: ponte frente al tótem',
            progreso: clamp(tMs / totalMs, 0, 1), cuenta: 0,
          });
        }

        if (tMs >= totalMs) {
          const A = acumRef.current, RR = ritmoRef.current;
          const postura = A.n ? A.total / A.n : 0;
          const ritmo = RR.beats ? RR.ok / RR.beats : 0.5;
          const pR = clamp(num(cfg.pesoRitmo, 0.3), 0, 0.8);
          const p10 = clamp((postura * (1 - pR) + ritmo * pR) * 10, 0, 10);
          setFinal({
            p10,
            postura, ritmo,
            brazos: A.nb ? A.brazos / A.nb : null,
            piernas: A.np ? A.piernas / A.np : null,
          });
          irA('fin');
        }
      });
    }, [fase, choreo, vueltas, cfg.toleranciaGrados, cfg.pesoRitmo, cfg.cuentaRegresiva, hw.espejo, irA]);

    // ── Render ────────────────────────────────────────────────────────
    const espejo = hw.espejo !== false;
    const videoBox = h('div', { className: 'fp-cam' + (fase === 'intro' ? ' is-hidden' : '') },
      h('video', {
        ref: attachVideo, className: 'fp-video' + (espejo ? ' is-mirror' : ''),
        autoPlay: true, playsInline: true, muted: true,
      }),
      cfg.mostrarEsqueleto !== false && vista.landmarks
        ? h(Esqueleto, { landmarks: vista.landmarks, espejo: espejo }) : null,
      fase === 'calibrando' ? h(Silueta, { ok: hud.ok }) : null,
      hw.avisoCamara !== false && streamRef.current
        ? h('div', { className: 'fp-cam-notice' }, '● Cámara activa · no se graba ni se envía video') : null);

    if (fase === 'intro') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-intro' },
          h('div', { className: 'fp-intro-art' },
            h('svg', { viewBox: '0 0 300 380', className: 'fp-intro-svg' },
              h(Avatar, { transform: 'translate(150,155) scale(0.88)' }))),
          h('h2', null, props.game.blurb || 'Imita al avatar'),
          h('ol', { className: 'fp-steps' },
            h('li', null, 'Párate frente al tótem, dentro de la silueta.'),
            h('li', null, 'Espera la calibración: deben verse cabeza y pies.'),
            h('li', null, 'Imita al avatar: se miden postura y ritmo.')),
          error ? h('div', { className: 'fp-error' }, '⚠ ' + error) : null,
          h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => iniciar('camara') }, '📷 Activar cámara y jugar'),
            h(Boton, { onClick: () => iniciar('demo') }, '🕹️ Probar sin cámara')),
          h('p', { className: 'fp-privacy' },
            '🔒 El análisis ocurre en este equipo. No se graba, no se guarda y no se envía video ni rostros: solo ángulos del cuerpo durante la partida.')),
        videoBox);
    }

    if (fase === 'fin' && final) {
      const pct = (v) => (v == null ? '—' : Math.round(v * 100) + '%');
      const tips = [];
      if (final.brazos != null && final.brazos > 0.75) tips.push('¡Muy bien los brazos!');
      else if (final.brazos != null && final.brazos < 0.5) tips.push('Estira más los brazos y sube el pañuelo.');
      if (final.piernas != null && final.piernas > 0.75) tips.push('Excelente juego de pies.');
      else if (final.piernas != null && final.piernas < 0.5) tips.push('Marca más el escobillado con las piernas.');
      tips.push(final.ritmo > 0.7 ? '¡Vas justo con la música!' : 'Intenta seguir mejor el ritmo.');
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h(Resultado, {
          puntaje10: final.p10,
          juego: props.game.name,
          titulo: '¡Se bailó!',
          mensaje: tips.join(' '),
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, null, 'Postura ' + pct(final.postura)),
            h(Chip, null, 'Brazos ' + pct(final.brazos)),
            h(Chip, null, 'Piernas ' + pct(final.piernas)),
            h(Chip, { tone: 'accent' }, 'Ritmo ' + pct(final.ritmo))),
          detalleTexto: choreo.name + ' · postura ' + pct(final.postura) + ' · ritmo ' + pct(final.ritmo),
          onExit: () => { soltarTodo(); props.onExit(); },
          onReplay: () => { setFinal(null); reiniciarMetricas(); t0Ref.current = nowMs(); irA(provRef.current && provRef.current.tipo === 'demo' ? 'cuenta' : 'calibrando'); },
        }));
    }

    const objetivo = vista.objetivo || (choreo.steps[0] && choreo.steps[0].pose);
    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        motor ? h(Chip, null, motor) : null,
        fase === 'bailando' ? h(Chip, { tone: 'accent' }, 'Parecido ' + hud.score + '%') : null),
    },
      h('div', { className: 'fp-dance' },
        h('div', { className: 'fp-dance-avatar' },
          h('svg', { viewBox: '0 0 340 420', className: 'fp-avatar-svg' },
            h('rect', { width: 340, height: 420, rx: 22, fill: 'rgba(255,255,255,.06)' }),
            h(Avatar, { transform: 'translate(170,178) scale(0.86)', pose: objetivo })),
          h('div', { className: 'fp-dance-step' },
            h('b', null, hud.paso || choreo.name),
            h('span', null, hud.tip || choreo.musicHint || '')),
          fase === 'bailando' ? h('div', { className: 'fp-progress' }, h('i', { style: { width: (hud.progreso * 100).toFixed(1) + '%' } })) : null),
        h('div', { className: 'fp-dance-cam' },
          videoBox,
          fase === 'calibrando' ? h('div', { className: 'fp-calib' },
            h('b', null, hud.ok ? '¡Perfecto, no te muevas!' : 'Ubícate en la zona'),
            h('span', null, hud.encuadre || ''),
            h('div', { className: 'fp-progress' }, h('i', { style: { width: (hud.progreso * 100).toFixed(0) + '%' } }))) : null,
          fase === 'abriendo' ? h('div', { className: 'fp-calib' }, h('b', null, 'Abriendo la cámara…')) : null,
          fase === 'cuenta' ? h('div', { className: 'fp-count' }, hud.cuenta > 0 ? hud.cuenta : '¡YA!') : null,
          fase === 'bailando' ? h('div', { className: 'fp-scorebar' },
            h('i', { style: { width: clamp(hud.score, 0, 100) + '%' } }),
            h('b', null, hud.score + '%')) : null)));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12. Juego 4 — "LaserGun" (pistola tipo Duck Hunt)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Entrada: cualquier dispositivo que se comporte como puntero absoluto
  // (lightgun IR tipo Gun4IR / Blamcon / AimTrak / Sinden, o el dedo). Cada
  // `pointerdown` es un disparo. Disparar fuera de pantalla (barra inferior)
  // recarga, igual que en los arcades.

  const LASER_VB = { w: 1000, h: 1400 };
  // Suman: empanadas, choripanes y volantines. Restan: ajíes rojos y schops.
  const BLANCOS = {
    volantin: { puntos: 10, r: 46, nombre: 'Volantín' },
    empanada: { puntos: 20, r: 40, nombre: 'Empanada' },
    choripan: { puntos: 15, r: 42, nombre: 'Choripán' },
    aji: { puntos: -1, r: 34, nombre: 'Ají rojo' },      // -1 = usa la penalización configurada
    schop: { puntos: -1, r: 38, nombre: 'Schop' },
  };
  const BLANCOS_BUENOS = ['empanada', 'choripan', 'volantin'];
  const BLANCOS_MALOS = ['aji', 'schop'];

  /** Choripán (suma). */
  function Choripan(props) {
    return h('g', { transform: props.transform },
      h('path', { d: 'M-46 10 q0 -20 20 -22 l52 0 q20 2 20 22 q-20 16 -46 16 q-26 0 -46 -16 Z', fill: '#E8C39E', stroke: '#B98B57', strokeWidth: 3 }),
      h('path', { d: 'M-38 -6 q10 -14 34 -12 q28 2 40 12 q-8 12 -38 12 q-28 0 -36 -12 Z', fill: '#8C4A2F', stroke: '#5E2F1C', strokeWidth: 3 }),
      h('path', { d: 'M-30 -8 q14 8 30 0 q16 -8 30 2', stroke: '#C8402C', strokeWidth: 5, fill: 'none', strokeLinecap: 'round' }),
      h('path', { d: 'M-24 2 q12 -6 22 0 q12 6 22 -2', stroke: '#5F9E3A', strokeWidth: 4, fill: 'none', strokeLinecap: 'round' }));
  }

  /** Ají rojo (resta). */
  function Aji(props) {
    return h('g', { transform: props.transform },
      h('path', { d: 'M2 -34 q-4 -12 10 -14', stroke: '#3F7D2E', strokeWidth: 6, fill: 'none', strokeLinecap: 'round' }),
      h('path', { d: 'M-6 -34 q16 -6 22 2 q-10 8 -22 -2 Z', fill: '#4CAF50' }),
      h('path', { d: 'M4 -30 q26 12 22 44 q-4 30 -26 30 q-22 0 -22 -26 q0 -32 26 -48 Z', fill: '#D32F2F', stroke: '#8E1B1B', strokeWidth: 3 }),
      h('path', { d: 'M0 -18 q14 14 12 34', stroke: '#FF8A80', strokeWidth: 5, fill: 'none', opacity: 0.7 }));
  }

  /** Schop de cerveza (resta). */
  function Schop(props) {
    return h('g', { transform: props.transform },
      h('rect', { x: -30, y: -36, width: 58, height: 74, rx: 8, fill: '#F0B429', stroke: '#9C6B12', strokeWidth: 4, opacity: 0.95 }),
      h('rect', { x: -30, y: -36, width: 58, height: 18, rx: 8, fill: '#FFF6E0' }),
      h('path', { d: 'M-30 -30 q-18 0 -18 18 q0 18 18 18', stroke: '#9C6B12', strokeWidth: 8, fill: 'none' }),
      h('path', { d: 'M-34 -40 q10 -12 24 -4 q14 -10 26 0 q14 -6 20 6 q-34 8 -70 -2 Z', fill: '#FFFDF6', stroke: '#E3D5B0', strokeWidth: 2 }),
      h('path', { d: 'M-16 -6 l0 30 M0 -8 l0 32 M14 -6 l0 28', stroke: 'rgba(255,255,255,.45)', strokeWidth: 4 }));
  }

  function JuegoLaser(props) {
    const cfg = props.game.config || {};
    const svgRef = useRef(null);
    const objsRef = useRef([]);
    const spawnRef = useRef(0);
    const [objs, setObjs] = useState([]);
    const [puntos, setPuntos] = useState(0);
    const [municion, setMunicion] = useState(Math.max(1, num(cfg.municion, 6)));
    const [tiempo, setTiempo] = useState(Math.max(10, num(cfg.duracion, 60)));
    const [fase, setFase] = useState('jugando');
    const [flash, setFlash] = useState(null);
    const [mira, setMira] = useState(null);
    const [combo, setCombo] = useState(0);

    const municionMax = Math.max(1, num(cfg.municion, 6));

    useEffect(() => {
      if (fase !== 'jugando') return undefined;
      let acc = 0, restante = Math.max(10, num(cfg.duracion, 60));
      const vel = clamp(num(cfg.velocidad, 1), 0.2, 3);
      return loop((dt) => {
        // reloj
        restante -= dt;
        if (restante <= 0) { setTiempo(0); setFase('fin'); return; }
        setTiempo(Math.ceil(restante));
        // aparición
        acc += dt * 1000;
        const cada = Math.max(250, num(cfg.spawnMs, 900));
        if (acc >= cada) {
          acc = 0;
          // Suman empanada, choripán y volantín; restan ají y schop.
          const kinds = ['volantin', 'volantin', 'empanada', 'empanada', 'choripan', 'choripan', 'aji', 'schop'];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          const desdeIzq = Math.random() > 0.5;
          objsRef.current.push({
            id: uid('o'), kind,
            x: desdeIzq ? -80 : LASER_VB.w + 80,
            y: 180 + Math.random() * 800,
            vx: (desdeIzq ? 1 : -1) * (110 + Math.random() * 130) * vel,
            vy: (Math.random() - 0.5) * 60,
            fase: Math.random() * 6,
            escala: 0.8 + Math.random() * 0.5,
          });
        }
        // movimiento
        const vivos = [];
        for (const o of objsRef.current) {
          o.x += o.vx * dt;
          o.y += o.vy * dt + Math.sin((o.fase += dt * 2)) * 26 * dt * 10;
          o.y = clamp(o.y, 120, LASER_VB.h - 320);
          if (o.x > -160 && o.x < LASER_VB.w + 160) vivos.push(o);
        }
        objsRef.current = vivos;
        setObjs(vivos.slice());
      });
    }, [fase, cfg.duracion, cfg.spawnMs, cfg.velocidad]);

    const disparar = (e) => {
      if (fase !== 'jugando' || !svgRef.current) return;
      const p = svgPoint(svgRef.current, e, LASER_VB);
      // Zona de recarga (barra inferior) = "disparar fuera de pantalla".
      if (p.y > LASER_VB.h - 150) {
        setMunicion(municionMax);
        setFlash({ x: p.x, y: p.y, t: nowMs(), recarga: true });
        return;
      }
      if (!cfg.recargaAuto && municion <= 0) {
        setFlash({ x: p.x, y: p.y, t: nowMs(), vacio: true });
        return;
      }
      if (!cfg.recargaAuto) setMunicion((m) => Math.max(0, m - 1));
      setFlash({ x: p.x, y: p.y, t: nowMs() });
      const R = num(cfg.radioAcierto, 46);
      let mejor = null, mejorD = Infinity;
      for (const o of objsRef.current) {
        const d = dist(p.x, p.y, o.x, o.y);
        const rr = (BLANCOS[o.kind].r + R) * o.escala;
        if (d < rr && d < mejorD) { mejor = o; mejorD = d; }
      }
      if (!mejor) { setCombo(0); return; }
      objsRef.current = objsRef.current.filter((o) => o.id !== mejor.id);
      setObjs(objsRef.current.slice());
      const base = BLANCOS[mejor.kind].puntos;
      if (base < 0) {
        setCombo(0);
        setPuntos((v) => v - Math.abs(num(cfg.penalizacion, 5)));
        notify('warn', BLANCOS[mejor.kind].nombre + ': −' + Math.abs(num(cfg.penalizacion, 5)) + ' puntos');
      } else {
        const c = combo + 1;
        setCombo(c);
        setPuntos((v) => v + base + Math.min(20, (c - 1) * 2));
      }
      if (navigator.vibrate) { try { navigator.vibrate(20); } catch (err) { /* noop */ } }
    };

    const meta = Math.max(50, num(cfg.metaPuntos, 300));
    if (fase === 'fin') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h(Resultado, {
          puntaje10: clamp((puntos / meta) * 10, 0, 10),
          juego: props.game.name, titulo: '¡Se acabó el tiempo!',
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, puntos + ' puntos'),
            h(Chip, null, 'Meta ' + meta)),
          detalleTexto: puntos + ' puntos en ' + num(cfg.duracion, 60) + 's',
          onExit: props.onExit,
          onReplay: () => {
            objsRef.current = []; setObjs([]); setPuntos(0); setCombo(0);
            setMunicion(municionMax); setTiempo(num(cfg.duracion, 60)); setFase('jugando');
          },
        }));
    }

    const flashVivo = flash && nowMs() - flash.t < 260 ? flash : null;
    return h(Marco, {
      icon: props.game.icon, title: props.game.name, onExit: props.onExit,
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, { tone: 'accent' }, puntos + ' pts'),
        h(Chip, null, '⏱ ' + tiempo + 's'),
        h(Chip, null, cfg.recargaAuto ? '∞ munición' : '🔴'.repeat(Math.max(0, municion)) || 'Recarga abajo'),
        combo > 1 ? h(Chip, { tone: 'ok' }, 'combo x' + combo) : null),
    },
      h('div', { className: 'fp-laser-wrap' },
        h('svg', {
          ref: svgRef, className: 'fp-laser-svg', viewBox: '0 0 1000 1400',
          onPointerDown: disparar,
          onPointerMove: (e) => {
            if (e.pointerType === 'mouse' && svgRef.current) setMira(svgPoint(svgRef.current, e, LASER_VB));
          },
          onPointerLeave: () => setMira(null),
        },
          h('defs', null,
            h('linearGradient', { id: 'fp-cielo3', x1: 0, y1: 0, x2: 0, y2: 1 },
              h('stop', { offset: '0%', stopColor: '#0B2E5B' }),
              h('stop', { offset: '60%', stopColor: '#3E86C4' }),
              h('stop', { offset: '100%', stopColor: '#9BC7E4' }))),
          h('rect', { width: 1000, height: 1400, fill: 'url(#fp-cielo3)' }),
          h('circle', { cx: 830, cy: 190, r: 70, fill: '#FFD54F', opacity: 0.9 }),
          h('path', { d: 'M0 980 L150 850 L300 950 L470 800 L650 960 L820 860 L1000 980 L1000 1400 L0 1400 Z', fill: '#3F6B34' }),
          h('path', { d: 'M0 1090 q250 -60 500 0 q250 60 500 0 L1000 1400 L0 1400 Z', fill: '#5E8C3A' }),
          // objetivos
          objs.map((o) => {
            const tr = 'translate(' + o.x.toFixed(1) + ',' + o.y.toFixed(1) + ') scale(' + o.escala.toFixed(2) + ')';
            if (o.kind === 'volantin') return h(Volantin, { key: o.id, transform: tr + ' rotate(' + (Math.sin(o.fase) * 14).toFixed(1) + ')' });
            if (o.kind === 'empanada') return h(Empanada, { key: o.id, transform: tr });
            if (o.kind === 'choripan') return h(Choripan, { key: o.id, transform: tr });
            // Los que restan van marcados con una cruz para que se distingan rápido.
            return h('g', { key: o.id, transform: tr },
              o.kind === 'aji' ? h(Aji, null) : h(Schop, null),
              h('circle', { cx: 34, cy: -34, r: 17, fill: 'rgba(213,43,30,.9)' }),
              h('path', { d: 'M26 -42 L42 -26 M42 -42 L26 -26', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }));
          }),
          // barra de recarga
          h('g', null,
            h('rect', { x: 0, y: LASER_VB.h - 150, width: 1000, height: 150, fill: 'rgba(10,16,27,.82)' }),
            h('text', { x: 500, y: LASER_VB.h - 84, textAnchor: 'middle', className: 'fp-svg-label' },
              cfg.recargaAuto ? 'Munición infinita' : 'DISPARA AQUÍ PARA RECARGAR'),
            h('text', { x: 500, y: LASER_VB.h - 40, textAnchor: 'middle', className: 'fp-svg-sub' },
              'Empanada +20 · Choripán +15 · Volantín +10 · Ají y schop −' + Math.abs(num(cfg.penalizacion, 5)))),
          // mira de la pistola
          mira ? h('g', { transform: 'translate(' + mira.x + ',' + mira.y + ')', opacity: 0.9 },
            h('circle', { r: 34, fill: 'none', stroke: '#fff', strokeWidth: 3 }),
            h('path', { d: 'M-52 0 L-22 0 M22 0 L52 0 M0 -52 L0 -22 M0 22 L0 52', stroke: '#fff', strokeWidth: 3 }),
            h('circle', { r: 4, fill: '#D52B1E' })) : null,
          // fogonazo
          flashVivo ? h('g', { transform: 'translate(' + flashVivo.x + ',' + flashVivo.y + ')' },
            h('circle', { r: flashVivo.recarga ? 40 : 26, fill: flashVivo.vacio ? 'rgba(255,255,255,.25)' : 'rgba(255,214,79,.75)' }),
            flashVivo.vacio ? h('text', { y: -40, textAnchor: 'middle', className: 'fp-svg-warn' }, 'SIN BALAS') : null) : null),
        h('p', { className: 'fp-hint' },
          'Dispara a las empanadas, los choripanes y los volantines. Los ajíes y los schops te restan puntos.')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.b Juego 5 — "Rayuela Chilena" (deporte nacional, cuerpo + cámara)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Reglas oficiales representadas (Federación Deportiva Nacional de Rayuela
  // Tejo Plano de Chile):
  //   · Cancha: cajón inclinado de 1×1 m relleno de arcilla. La PANTALLA del
  //     tótem ES la cancha, vista en perspectiva desde el lanzador.
  //   · Lienza: cuerda tensada que divide el cajón por la mitad.
  //   · Distancia oficial de tiro: 14 m (en el tótem se representa; la persona
  //     se ubica en la zona marcada frente a la pantalla).
  //   · Quemada (el tejo cae sobre la lienza) = 2 puntos.
  //   · Tejo más cercano a la lienza = 1 punto.
  //
  // Antes de la cancha, el tótem muestra el ÁREA DE POSICIONAMIENTO: la persona
  // se ubica en la zona, el sistema calibra su escala corporal y recién ahí
  // empieza a leer el gesto de lanzamiento para proyectar el tejo.

  const RAY_VB = { w: 1000, h: 1400 };
  // Esquinas del cajón en pantalla (trapecio en perspectiva).
  const CAJON = { TL: { x: 250, y: 430 }, TR: { x: 750, y: 430 }, BL: { x: 120, y: 980 }, BR: { x: 880, y: 980 } };
  const TEJO_R = 0.05;   // radio del tejo en metros (disco de ~10 cm)

  /** Coordenadas de cancha (metros, origen en la lienza) → pantalla. */
  function proyectarCancha(cx, cy) {
    const u = clamp(cx + 0.5, -0.6, 1.6);
    const v = clamp(cy + 0.5, -0.6, 1.6);
    const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    const arriba = lerp(CAJON.TL, CAJON.TR, u);
    const abajo = lerp(CAJON.BL, CAJON.BR, u);
    const p = lerp(arriba, abajo, v);
    p.escala = 0.55 + 0.45 * v;    // perspectiva: más cerca = más grande
    return p;
  }

  /** Clasifica un tiro por sus coordenadas de cancha. */
  function evaluarTejo(cx, cy, tolQuemada) {
    const dentro = Math.abs(cx) <= 0.5 && Math.abs(cy) <= 0.5;
    const dist = Math.abs(cy);
    const quemada = dentro && dist <= Math.max(0.02, num(tolQuemada, TEJO_R));
    let motivo = '';
    if (!dentro) {
      if (Math.abs(cx) > 0.5) motivo = cx > 0 ? 'Se fue por la derecha' : 'Se fue por la izquierda';
      else motivo = cy > 0 ? 'Quedó corto, antes del cajón' : 'Se pasó largo';
    }
    return { cx, cy, dentro, quemada, dist, motivo, cm: Math.round(dist * 100) };
  }

  /**
   * Puntaje oficial de la mano: cada quemada vale 2; además, el tejo válido más
   * cercano a la lienza (sin contar quemadas) suma 1 a su equipo.
   */
  function puntajeRayuelaOficial(tiros, equipos) {
    const puntos = {};
    for (let e = 0; e < equipos; e++) puntos[e] = 0;
    let mejor = null;
    for (const t of tiros) {
      if (t.quemada) { puntos[t.equipo] += 2; continue; }
      if (!t.dentro) continue;
      if (!mejor || t.dist < mejor.dist) mejor = t;
    }
    if (mejor) puntos[mejor.equipo] += 1;
    return { puntos, mejor };
  }

  /**
   * Detector de lanzamiento por cámara — SOLO MEDIO CUERPO SUPERIOR.
   *
   * La rayuela se lanza por abajo, con péndulo de brazo. El detector se "arma"
   * cuando la mano baja por debajo de la línea de los hombros y se aquieta, y
   * suelta el tejo en el pico de velocidad del swing hacia arriba.
   *
   * A diferencia de la versión anterior, NO necesita ver caderas ni piernas:
   * la referencia vertical es la línea de hombros y la escala es el ANCHO DE
   * HOMBROS. Así la persona puede pararse mucho más cerca del tótem y el juego
   * funciona en espacios reducidos, midiendo parejo a un niño y a un adulto.
   */
  function detectorLanzamiento() {
    let armado = false, enSwing = false, tSwing = 0;
    let pico = null, hist = [];
    return {
      reset() { armado = false; enSwing = false; pico = null; hist = []; },
      estado() { return enSwing ? 'lanzando' : armado ? 'listo' : 'baja la mano'; },
      /** Devuelve null, o {fuerza, lateral, brazo} cuando detecta el lanzamiento. */
      actualizar(L, espejo) {
        if (!L) return null;
        const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
        if (!hI || !hD) return null;
        const hombroY = (hI.y + hD.y) / 2;
        const escala = escalaCorporal(L, 'superior');
        if (!escala) return null;                       // persona demasiado lejos
        const mI = L[IDX.munecaI], mD = L[IDX.munecaD];
        const t = nowMs();
        const cand = [];
        if (mD) cand.push({ brazo: 'derecho', p: mD });
        if (mI) cand.push({ brazo: 'izquierdo', p: mI });
        if (!cand.length) return null;
        hist.push({ t, manos: cand.map((c) => ({ brazo: c.brazo, x: c.p.x, y: c.p.y })) });
        if (hist.length > 16) hist.shift();
        if (hist.length < 4) return null;

        // Velocidad de cada mano en "anchos de hombro por segundo".
        const a = hist[0], b = hist[hist.length - 1];
        const dt = Math.max(0.04, (b.t - a.t) / 1000);
        let mejor = null;
        for (const m of b.manos) {
          const prev = a.manos.find((x) => x.brazo === m.brazo);
          if (!prev) continue;
          const vx = ((m.x - prev.x) / dt) / escala * (espejo ? -1 : 1);
          const vy = ((m.y - prev.y) / dt) / escala;    // y crece hacia abajo
          const subida = -vy;
          const rapidez = Math.hypot(vx, subida);
          if (!mejor || rapidez > mejor.rapidez) mejor = { brazo: m.brazo, vx, subida, rapidez, y: m.y };
        }
        if (!mejor) return null;

        // Se arma con la mano por debajo de los hombros (no de la cadera) y quieta.
        if (!armado) {
          if (mejor.y > hombroY + escala * 0.35 && mejor.rapidez < 1.6) armado = true;
          return null;
        }
        if (!enSwing) {
          if (mejor.subida > 2.2) { enSwing = true; tSwing = t; pico = mejor; }
          return null;
        }
        if (mejor.rapidez > pico.rapidez) pico = mejor;
        // Se suelta el tejo en el punto más rápido del swing (ventana corta).
        if (t - tSwing > 220 || mejor.rapidez < pico.rapidez * 0.6) {
          const r = { fuerza: pico.rapidez, lateral: pico.vx, brazo: pico.brazo };
          armado = false; enSwing = false; pico = null; hist = [];
          return r;
        }
        return null;
      },
    };
  }

  /**
   * Detector de golpes de boxeo — SOLO MEDIO CUERPO SUPERIOR.
   *
   * Un golpe recto se ve en 2D como la muñeca alejándose rápido del hombro
   * mientras el codo se extiende. La distancia se mide en anchos de hombro, así
   * que la detección no depende de la estatura ni de la distancia a la cámara.
   * También reporta la guardia (ambas manos a la altura de la cara) y la
   * inclinación del torso, que el juego usa para esquivar.
   */
  function detectorBoxeo() {
    const est = { izquierdo: { fuera: false, pico: 0 }, derecho: { fuera: false, pico: 0 } };
    let prev = null;
    return {
      reset() { est.izquierdo = { fuera: false, pico: 0 }; est.derecho = { fuera: false, pico: 0 }; prev = null; },
      /**
       * Devuelve { golpe, guardia, inclinacion, listo }.
       * `golpe` es null o { brazo, altura: 'alta'|'media', fuerza }.
       */
      actualizar(L, espejo, dt) {
        const vacio = { golpe: null, guardia: false, inclinacion: 0, listo: false };
        if (!L) return vacio;
        const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
        const escala = escalaCorporal(L, 'superior');
        if (!hI || !hD || !escala) return vacio;
        const hombroY = (hI.y + hD.y) / 2;
        const centroX = (hI.x + hD.x) / 2;
        const nariz = L[IDX.nariz];

        const brazos = [
          { brazo: 'izquierdo', hombro: hI, muneca: L[IDX.munecaI], codo: L[IDX.codoI] },
          { brazo: 'derecho', hombro: hD, muneca: L[IDX.munecaD], codo: L[IDX.codoD] },
        ];
        let golpe = null, manosArriba = 0, manosVistas = 0;
        for (const b of brazos) {
          if (!b.muneca) continue;
          manosVistas++;
          // Extensión del brazo, en anchos de hombro.
          const ext = Math.hypot(b.muneca.x - b.hombro.x, b.muneca.y - b.hombro.y) / escala;
          const e = est[b.brazo];
          const vel = prev && prev[b.brazo] != null ? (ext - prev[b.brazo]) / Math.max(0.016, dt) : 0;
          if (nariz && Math.abs(b.muneca.y - nariz.y) < escala * 0.85
              && Math.abs(b.muneca.x - centroX) < escala * 0.9) manosArriba++;
          if (!e.fuera && ext > 1.15 && vel > 1.6) {
            // Golpe: el brazo se extendió rápido.
            e.fuera = true;
            e.pico = vel;
            const altura = nariz && b.muneca.y < nariz.y + escala * 0.35 ? 'alta' : 'media';
            const lado = espejo ? (b.brazo === 'izquierdo' ? 'derecho' : 'izquierdo') : b.brazo;
            golpe = { brazo: lado, altura, fuerza: clamp(vel / 6, 0.25, 1) };
          } else if (e.fuera && ext < 0.95) {
            e.fuera = false;                            // recogió el brazo: listo para el próximo
          }
          if (!prev) prev = {};
          prev[b.brazo] = ext;
        }
        if (prev == null) prev = {};
        // Inclinación del torso respecto del centro de la imagen (esquiva).
        let incl = (centroX - 0.5) / Math.max(0.08, escala);
        if (espejo) incl = -incl;
        return {
          golpe,
          guardia: manosArriba >= 2,
          inclinacion: clamp(incl, -2, 2),
          listo: manosVistas > 0 && !!nariz,
          hombroY,
        };
      },
    };
  }

  function JuegoRayuela(props) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
    const equipos = clamp(Math.round(num(cfg.equipos, 1)), 1, 2);
    const porEquipo = clamp(Math.round(num(cfg.tejosPorEquipo, 4)), 1, 8);
    const totalTiros = equipos * porEquipo;

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const detRef = useRef(detectorLanzamiento());
    const faseRef = useRef('intro');
    const calibRef = useRef(0);
    const bodyRef = useRef(null);
    const volandoRef = useRef(false);

    const [fase, setFase] = useState('intro');
    const [error, setError] = useState('');
    const [modoTactil, setModoTactil] = useState(false);
    const [guia, setGuia] = useState({ motivo: '', ok: false, progreso: 0, landmarks: null });
    const [tiros, setTiros] = useState([]);
    const [vuelo, setVuelo] = useState(null);
    const [ultimo, setUltimo] = useState(null);
    const [gesto, setGesto] = useState('');
    const [viento, setViento] = useState(0);
    const vientoRef = useRef(0);

    // Viento nuevo en cada tejo (como en el golf: hay que compensarlo).
    useEffect(() => {
      const v = (Math.random() * 2 - 1) * clamp(num(cfg.viento, 0.35), 0, 1);
      vientoRef.current = v;
      setViento(v);
    }, [tiros.length, cfg.viento]);

    const irA = useCallback((f) => { faseRef.current = f; setFase(f); }, []);

    /**
     * El <video> cambia de lugar entre pantallas (posicionamiento → cancha), así
     * que se reengancha el stream y se le avisa al motor de pose en cada montaje.
     */
    const attachVideo = useCallback((el) => {
      videoRef.current = el;
      if (!el) return;
      if (streamRef.current && el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
      }
      if (provRef.current && provRef.current.setVideo) provRef.current.setVideo(el);
    }, []);

    const soltarTodo = useCallback(() => {
      try { provRef.current && provRef.current.detener(); } catch (e) { /* noop */ }
      provRef.current = null;
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    }, []);
    useEffect(() => soltarTodo, [soltarTodo]);

    /** Proyecta el gesto a un punto de la cancha y anima el vuelo del tejo. */
    const lanzarTejo = useCallback((fuerza, lateral, opts) => {
      if (volandoRef.current || faseRef.current !== 'cancha') return;
      volandoRef.current = true;
      detRef.current.reset();
      const fRef = Math.max(0.5, num(cfg.fuerzaLienza, 3.2));
      const sensP = num(cfg.sensibilidadProfundidad, 0.42);
      const sensL = num(cfg.sensibilidadLateral, 0.30);
      // Un tiro perfecto en la barra de precisión anula la dispersión.
      const disp = (opts && opts.perfecto) ? 0 : clamp(num(cfg.dispersion, 0.05), 0, 0.4);
      const ruido = () => (Math.random() * 2 - 1) * disp;
      // Menos fuerza que la de referencia = corto (cy > 0); más = largo (cy < 0).
      const cy = clamp((fRef - fuerza) * sensP + ruido(), -1.1, 1.1);
      const cx = clamp(lateral * sensL + vientoRef.current * 0.22 + ruido(), -1.1, 1.1);
      const destino = proyectarCancha(cx, cy);
      const origen = { x: RAY_VB.w / 2, y: RAY_VB.h + 60 };
      const dur = 1100, t0 = nowMs();
      const stop = loop(() => {
        const k = clamp((nowMs() - t0) / dur, 0, 1);
        const x = origen.x + (destino.x - origen.x) * k;
        const y = origen.y + (destino.y - origen.y) * k - Math.sin(k * Math.PI) * 260;
        setVuelo({ x, y, escala: 1.5 + (destino.escala - 1.5) * k, k });
        if (k < 1) return;
        stop();
        setVuelo(null);
        volandoRef.current = false;
        const ev = evaluarTejo(cx, cy, cfg.toleranciaQuemada);
        setTiros((prev) => {
          const equipo = equipos === 1 ? 0 : prev.length % equipos;
          const next = prev.concat([Object.assign({ id: uid('t'), equipo, orden: prev.length + 1 }, ev)]);
          setUltimo(next[next.length - 1]);
          if (next.length >= totalTiros) setT(() => irA('fin'), 1500);
          return next;
        });
        if (navigator.vibrate) { try { navigator.vibrate(ev.quemada ? [40, 40, 90] : 30); } catch (e) { /* noop */ } }
        if (ev.quemada) notify('success', '¡Quemada! 2 puntos.');
      });
    }, [cfg, equipos, totalTiros, irA]);

    const iniciar = useCallback(async (modo) => {
      setError('');
      setTiros([]); setUltimo(null);
      detRef.current.reset();
      calibRef.current = 0;
      if (modo === 'tactil') {
        setModoTactil(true);
        irA('cancha');
        return;
      }
      setModoTactil(false);
      irA('abriendo');
      try {
        const stream = await abrirCamara(hw);
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) throw new Error('No se pudo montar el elemento de video.');
        v.srcObject = stream;
        await v.play().catch(() => {});
        const prov = proveedorMediaPipe(hw);
        await prov.iniciar(v);
        provRef.current = prov;
        irA('posicion');
      } catch (e) {
        soltarTodo();
        setError(s(e && e.message ? e.message : e));
        irA('intro');
      }
    }, [hw, irA, soltarTodo]);

    // Bucle de cámara: primero calibra la posición, luego lee el lanzamiento.
    useEffect(() => {
      if (modoTactil || (fase !== 'posicion' && fase !== 'cancha')) return undefined;
      let ultimoHud = 0;
      return loop((dt) => {
        const prov = provRef.current;
        if (!prov) return;
        const lec = prov.leer();
        const L = lec && lec.landmarks;
        const t = nowMs();
        if (faseRef.current === 'posicion') {
          // Encuadre de MEDIO CUERPO: basta cabeza, hombros y brazos.
          const enc = encuadreDePose(L, 'superior');
          calibRef.current = enc.ok ? calibRef.current + dt : Math.max(0, calibRef.current - dt * 0.6);
          if (t - ultimoHud > 100) {
            ultimoHud = t;
            setGuia({ motivo: enc.motivo, ok: !!enc.ok, progreso: clamp(calibRef.current / 1.5, 0, 1), landmarks: L });
          }
          if (calibRef.current >= 1.5) {
            // Escala corporal (ancho de hombros): normaliza la fuerza del tiro.
            bodyRef.current = { ancho: enc.ancho || null, escala: escalaCorporal(L, 'superior') };
            detRef.current.reset();
            irA('cancha');
          }
          return;
        }
        if (volandoRef.current) return;
        const r = detRef.current.actualizar(L, hw.espejo !== false);
        if (t - ultimoHud > 150) {
          ultimoHud = t;
          setGuia((g) => Object.assign({}, g, { landmarks: L }));
          setGesto(L ? detRef.current.estado() : 'no te veo');
        }
        if (r) lanzarTejo(r.fuerza, r.lateral);
      });
    }, [fase, modoTactil, hw.espejo, lanzarTejo, irA]);

    // ── Lanzamiento táctil estilo Golf Clash ──────────────────────────
    //
    // Dos tiempos, como en el juego de golf de EA:
    //   1. APUNTAR: se arrastra hacia atrás desde el tejo, como una honda. El
    //      largo del arrastre define la potencia y el ángulo, la dirección.
    //   2. PRECISIÓN: al soltar aparece una barra con un marcador que va y
    //      viene; hay que tocar para detenerlo lo más al centro posible. El
    //      error se traduce en desvío lateral del tejo.
    // El viento se muestra antes de tirar y empuja el tejo en el aire.
    const svgRef = useRef(null);
    const barraRef = useRef({ pos: 0, dir: 1, potencia: 0, angulo: 0 });
    const [apunte, setApunte] = useState(null);      // { dx, dy, potencia, angulo }
    const [barra, setBarra] = useState(null);        // { pos, potencia, angulo }
    const ORIGEN_TACTIL = { x: RAY_VB.w / 2, y: RAY_VB.h - 210 };

    /** Traduce el arrastre a potencia 0..1 y ángulo -1..1. */
    const medirArrastre = (p) => {
      const dx = ORIGEN_TACTIL.x - p.x;             // hacia atrás = tirar de la honda
      const dy = p.y - ORIGEN_TACTIL.y;
      const largo = Math.max(0, dy);
      return {
        dx: p.x - ORIGEN_TACTIL.x, dy: p.y - ORIGEN_TACTIL.y,
        potencia: clamp(largo / 320, 0, 1),
        angulo: clamp(dx / 260, -1, 1),
      };
    };

    const onDown = (e) => {
      if (fase !== 'cancha' || !modoTactil || volandoRef.current || !svgRef.current) return;
      if (barra) return;                              // ya está en la barra de precisión
      setApunte(medirArrastre(svgPoint(svgRef.current, e, RAY_VB)));
    };
    const onMove = (e) => {
      if (!apunte || !svgRef.current) return;
      setApunte(medirArrastre(svgPoint(svgRef.current, e, RAY_VB)));
    };
    const onUp = () => {
      if (!apunte) return;
      const a = apunte;
      setApunte(null);
      if (a.potencia < 0.08) return;                  // toque suelto: no cuenta
      barraRef.current = { pos: 0, dir: 1, potencia: a.potencia, angulo: a.angulo };
      setBarra({ pos: 0, potencia: a.potencia, angulo: a.angulo });
    };

    // Marcador oscilante de la barra de precisión.
    useEffect(() => {
      if (!barra) return undefined;
      const vel = clamp(num(cfg.velocidadBarra, 1.5), 0.4, 4);
      return loop((dt) => {
        const b = barraRef.current;
        b.pos += b.dir * vel * dt;
        if (b.pos > 1) { b.pos = 1; b.dir = -1; }
        if (b.pos < -1) { b.pos = -1; b.dir = 1; }
        setBarra({ pos: b.pos, potencia: b.potencia, angulo: b.angulo });
      });
    }, [!!barra, cfg.velocidadBarra]);

    /** Toque sobre la barra: fija la precisión y lanza. */
    const resolverBarra = () => {
      const b = barraRef.current;
      if (!b || !barra) return;
      setBarra(null);
      const error = b.pos;                            // 0 = perfecto
      const fRef = Math.max(0.5, num(cfg.fuerzaLienza, 3.2));
      // Potencia 0..1 → fuerza en la misma escala que el gesto con el cuerpo.
      const fuerza = fRef * (0.45 + b.potencia * 1.15);
      const lateral = b.angulo * 1.1 + error * 0.55;  // el error de barra desvía
      lanzarTejo(fuerza, lateral, { perfecto: Math.abs(error) < 0.06 });
    };

    const marcador = useMemo(() => puntajeRayuelaOficial(tiros, equipos), [tiros, equipos]);
    const espejo = hw.espejo !== false;

    const videoBox = h('div', { className: 'fp-cam' + (fase === 'intro' || fase === 'fin' ? ' is-hidden' : '') },
      h('video', {
        ref: attachVideo, className: 'fp-video' + (espejo ? ' is-mirror' : ''),
        autoPlay: true, playsInline: true, muted: true,
      }),
      guia.landmarks ? h(Esqueleto, { landmarks: guia.landmarks, espejo: espejo }) : null,
      fase === 'posicion' ? h(Silueta, { ok: guia.ok, modo: 'superior' }) : null,
      hw.avisoCamara !== false && streamRef.current
        ? h('div', { className: 'fp-cam-notice' }, '● Cámara activa · no se graba ni se envía video') : null);

    // ── Intro: reglas oficiales ───────────────────────────────────────
    if (fase === 'intro' || fase === 'abriendo') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-intro' },
          h('svg', { viewBox: '0 0 320 220', className: 'fp-intro-svg fp-intro-svg--ancho' },
            h('path', { d: 'M60 60 L260 60 L300 180 L20 180 Z', fill: '#7A4A22' }),
            h('path', { d: 'M72 70 L248 70 L282 170 L38 170 Z', fill: '#4A3323' }),
            h('line', { x1: 55, y1: 120, x2: 265, y2: 120, stroke: '#fff', strokeWidth: 4 }),
            h('circle', { cx: 150, cy: 118, r: 9, fill: '#C9CDD2', stroke: '#6b7280', strokeWidth: 2 }),
            h('circle', { cx: 205, cy: 145, r: 10, fill: '#C9CDD2', stroke: '#6b7280', strokeWidth: 2 }),
            h('text', { x: 160, y: 205, textAnchor: 'middle', fill: '#fff', fontSize: 15, fontWeight: 700 }, 'Deporte nacional de Chile')),
          h('h2', null, props.game.blurb || 'Lanza el tejo lo más cerca de la lienza'),
          h('ul', { className: 'fp-steps' },
            h('li', null, h('b', null, 'Quemada'), ': el tejo cae sobre la lienza → ', h('b', null, '2 puntos'), '.'),
            h('li', null, 'El tejo válido más cercano a la lienza → ', h('b', null, '1 punto'), '.'),
            h('li', null, 'Cajón de 1×1 m: si el tejo cae fuera, no puntúa.'),
            h('li', null, 'Distancia oficial de tiro: 14 m — en el tótem se representa desde la zona marcada.')),
          error ? h('div', { className: 'fp-error' }, '⚠ ' + error) : null,
          fase === 'abriendo' ? h('p', null, 'Abriendo la cámara…') : h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => iniciar('camara') }, '📷 Lanzar con el brazo'),
            h(Boton, { onClick: () => iniciar('tactil') }, '👆 Deslizar para lanzar')),
          h('p', { className: 'fp-privacy' },
            '📷 Con cámara basta con que se te vea el torso, los brazos y la cabeza: puedes jugar cerca del tótem. ' +
            'El análisis ocurre en este equipo, no se graba ni se envía video.')),
        videoBox);
    }

    // ── Área de posicionamiento ───────────────────────────────────────
    if (fase === 'posicion') {
      return h(Marco, {
        icon: props.game.icon, title: props.game.name,
        onExit: () => { soltarTodo(); props.onExit(); },
        meta: h(Chip, null, 'Paso 1 de 2 · ubicación'),
      },
        h('div', { className: 'fp-pos' },
          h('h2', { className: 'fp-pos-title' }, 'Ubícate frente al tótem'),
          h(ZonaMedioCuerpo, { ok: guia.ok, metros: num(cfg.distanciaMetros, 1.5), nota: 'representa los 14 m oficiales' }),
          h('div', { className: 'fp-pos-cam' },
            videoBox,
            h('div', { className: 'fp-calib' },
              h('b', null, guia.ok ? '¡Perfecto! Quédate ahí…' : 'Ubícate en la zona'),
              h('span', null, guia.motivo || 'Buscando a la persona…'),
              h('div', { className: 'fp-progress' }, h('i', { style: { width: (guia.progreso * 100).toFixed(0) + '%' } })))),
          h('p', { className: 'fp-hint' },
            'Solo necesito verte el torso, los brazos y la cabeza. Con el ancho de tus hombros calibro la fuerza de tu lanzamiento.')));
    }

    // ── Resultado final ───────────────────────────────────────────────
    if (fase === 'fin') {
      const quemadas = tiros.filter((t) => t.quemada).length;
      const dentro = tiros.filter((t) => t.dentro).length;
      const puntosJ = marcador.puntos[0] || 0;
      const maxPos = porEquipo * 2;
      const detalle = equipos === 2
        ? h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, 'Equipo 1: ' + (marcador.puntos[0] || 0) + ' pts'),
            h(Chip, null, 'Equipo 2: ' + (marcador.puntos[1] || 0) + ' pts'),
            h(Chip, null, quemadas + ' quemada(s)'))
        : h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, puntosJ + ' puntos'),
            h(Chip, null, quemadas + ' quemada(s)'),
            h(Chip, null, dentro + '/' + tiros.length + ' en el cajón'),
            marcador.mejor ? h(Chip, null, 'Mejor tejo: ' + marcador.mejor.cm + ' cm') : null);
      const titulo = equipos === 2
        ? ((marcador.puntos[0] || 0) === (marcador.puntos[1] || 0) ? 'Empate en la cancha'
          : '¡Gana el equipo ' + ((marcador.puntos[0] || 0) > (marcador.puntos[1] || 0) ? '1' : '2') + '!')
        : '¡Buena mano!';
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: () => { soltarTodo(); props.onExit(); }, meta: null },
        h(Resultado, {
          puntaje10: clamp((puntosJ / Math.max(1, maxPos)) * 10, 0, 10),
          juego: props.game.name,
          titulo: titulo,
          mensaje: quemadas ? '¡' + quemadas + ' quemada(s)! Eso es puntería de cancha.' : null,
          detalle: detalle,
          detalleTexto: puntosJ + ' pts · ' + quemadas + ' quemadas · ' + tiros.map((t) => (t.dentro ? t.cm + 'cm' : 'fuera')).join(' · '),
          onExit: () => { soltarTodo(); props.onExit(); },
          onReplay: () => {
            setTiros([]); setUltimo(null); detRef.current.reset();
            irA(modoTactil || !provRef.current ? 'cancha' : 'posicion');
            calibRef.current = 0;
          },
        }));
    }

    // ── La cancha (la pantalla ES el cajón de rayuela) ────────────────
    const tejoActual = Math.min(tiros.length + 1, totalTiros);
    const equipoActual = equipos === 1 ? 0 : tiros.length % equipos;
    const cajonPath = 'M' + CAJON.TL.x + ' ' + CAJON.TL.y + ' L' + CAJON.TR.x + ' ' + CAJON.TR.y +
      ' L' + CAJON.BR.x + ' ' + CAJON.BR.y + ' L' + CAJON.BL.x + ' ' + CAJON.BL.y + ' Z';
    const lienzaI = proyectarCancha(-0.5, 0), lienzaD = proyectarCancha(0.5, 0);
    const motas = [];
    for (let i = 0; i < 90; i++) {
      const u = (i * 37 % 100) / 100, v = (i * 61 % 100) / 100;
      const p = proyectarCancha(u - 0.5, v - 0.5);
      motas.push(h('circle', { key: i, cx: p.x, cy: p.y, r: 2 + (i % 3), fill: 'rgba(0,0,0,.22)' }));
    }

    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, null, 'Tejo ' + tejoActual + '/' + totalTiros),
        equipos === 2 ? h(Chip, { tone: 'accent' }, 'Turno equipo ' + (equipoActual + 1)) : null,
        h(Chip, { tone: 'accent' }, (marcador.puntos[0] || 0) + (equipos === 2 ? ' · ' + (marcador.puntos[1] || 0) : '') + ' pts'),
        !modoTactil ? h(Chip, null, '🖐 ' + (gesto || '…')) : null),
    },
      h('div', { className: 'fp-ray-wrap' },
        h('svg', {
          ref: svgRef, className: 'fp-ray-svg', viewBox: '0 0 1000 1400',
          onPointerDown: barra ? resolverBarra : onDown,
          onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
        },
          h('defs', null,
            h('linearGradient', { id: 'fp-muro', x1: 0, y1: 0, x2: 0, y2: 1 },
              h('stop', { offset: '0%', stopColor: '#3B4457' }),
              h('stop', { offset: '100%', stopColor: '#22293A' })),
            h('linearGradient', { id: 'fp-arcilla', x1: 0, y1: 0, x2: 0, y2: 1 },
              h('stop', { offset: '0%', stopColor: '#4A3323' }),
              h('stop', { offset: '100%', stopColor: '#6B4B2E' })),
            h('linearGradient', { id: 'fp-madera', x1: 0, y1: 0, x2: 0, y2: 1 },
              h('stop', { offset: '0%', stopColor: '#C08B4A' }),
              h('stop', { offset: '100%', stopColor: '#8A5C2A' }))),
          h('rect', { width: 1000, height: 1400, fill: 'url(#fp-muro)' }),
          h('path', { d: 'M0 980 L1000 980 L1000 1400 L0 1400 Z', fill: '#2C3242' }),
          // guirnalda dieciochera sobre el muro
          h('path', {
            d: 'M0 40 Q250 130 500 60 Q750 -10 1000 70', fill: 'none',
            stroke: 'rgba(255,255,255,.5)', strokeWidth: 4,
          }),
          [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const x = 60 + i * 128, y = 70 + Math.sin(i * 0.9) * 22;
            return h('g', { key: 'b' + i, transform: 'translate(' + x + ',' + y + ')', opacity: 0.9 },
              h('path', { d: 'M-26 0 L26 0 L0 58 Z', fill: '#fff' }),
              h('path', { d: 'M-26 0 L26 0 L15 24 L-15 24 Z', fill: i % 2 ? '#D52B1E' : '#0039A6' }),
              h('path', { d: 'M-15 24 L15 24 L0 58 Z', fill: i % 2 ? '#0039A6' : '#D52B1E' }));
          }),
          // marco de madera del cajón (caras exterior e interior)
          h('path', {
            d: 'M' + (CAJON.TL.x - 26) + ' ' + (CAJON.TL.y - 18) + ' L' + (CAJON.TR.x + 26) + ' ' + (CAJON.TR.y - 18) +
               ' L' + (CAJON.BR.x + 52) + ' ' + (CAJON.BR.y + 34) + ' L' + (CAJON.BL.x - 52) + ' ' + (CAJON.BL.y + 34) + ' Z',
            fill: 'url(#fp-madera)', stroke: '#5E3B18', strokeWidth: 5,
          }),
          h('path', {
            d: 'M' + (CAJON.BL.x - 52) + ' ' + (CAJON.BL.y + 34) + ' L' + (CAJON.BR.x + 52) + ' ' + (CAJON.BR.y + 34) +
               ' L' + (CAJON.BR.x + 52) + ' ' + (CAJON.BR.y + 126) + ' L' + (CAJON.BL.x - 52) + ' ' + (CAJON.BL.y + 126) + ' Z',
            fill: '#A9702F', stroke: '#5E3B18', strokeWidth: 5,
          }),
          // placa de marca (personalizable, como en las canchas reales)
          h('g', { transform: 'translate(500,1075)' },
            h('ellipse', { rx: 128, ry: 40, fill: 'none', stroke: '#8C2B1E', strokeWidth: 5 }),
            h('text', { textAnchor: 'middle', y: 12, className: 'fp-ray-marca' }, s(cfg.marcaCajon) || 'KIMOS')),
          // arcilla
          h('path', { d: cajonPath, fill: 'url(#fp-arcilla)' }),
          h('g', null, motas),
          // lienza
          h('line', { x1: lienzaI.x, y1: lienzaI.y, x2: lienzaD.x, y2: lienzaD.y, stroke: '#F5F5F5', strokeWidth: 7 }),
          h('text', { x: 500, y: lienzaI.y - 20, textAnchor: 'middle', className: 'fp-svg-label' }, 'LIENZA · quemada = 2 puntos'),
          // tejos ya lanzados
          tiros.filter((t) => t.dentro).map((t) => {
            const p = proyectarCancha(t.cx, t.cy);
            return h('g', { key: t.id, transform: 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') scale(' + p.escala.toFixed(2) + ')' },
              h('ellipse', { cx: 0, cy: 10, rx: 42, ry: 14, fill: 'rgba(0,0,0,.35)' }),
              h('ellipse', { rx: 38, ry: 15, fill: t.equipo ? '#B08D57' : '#C9CDD2', stroke: '#5A6068', strokeWidth: 4 }),
              h('ellipse', { rx: 16, ry: 6, fill: 'rgba(255,255,255,.55)' }),
              t.quemada ? h('text', { y: 58, textAnchor: 'middle', className: 'fp-ray-quemada' }, '¡QUEMADA!') : null);
          }),
          // tejo en vuelo
          vuelo ? h('g', { transform: 'translate(' + vuelo.x.toFixed(1) + ',' + vuelo.y.toFixed(1) + ') scale(' + vuelo.escala.toFixed(2) + ')' },
            h('ellipse', { rx: 40, ry: 16, fill: '#DDE1E6', stroke: '#5A6068', strokeWidth: 4 }),
            h('ellipse', { rx: 17, ry: 6, fill: 'rgba(255,255,255,.7)' })) : null,
          // vista superior de apoyo
          cfg.vistaSuperior === false ? null : h('g', { transform: 'translate(828,296)' },
            h('rect', { x: -110, y: -110, width: 220, height: 220, rx: 10, fill: 'rgba(0,0,0,.45)', stroke: 'rgba(255,255,255,.35)', strokeWidth: 3 }),
            h('line', { x1: -110, y1: 0, x2: 110, y2: 0, stroke: '#fff', strokeWidth: 4 }),
            h('text', { y: -122, textAnchor: 'middle', className: 'fp-svg-sub' }, 'vista superior'),
            tiros.filter((t) => t.dentro).map((t) => h('circle', {
              key: 'v' + t.id, cx: t.cx * 220, cy: t.cy * 220, r: 11,
              fill: t.equipo ? '#B08D57' : '#C9CDD2', stroke: t.quemada ? '#4ADE80' : '#5A6068', strokeWidth: 3,
            }))),
          // ── Modo táctil: veleta de viento, honda de apuntado y barra ──
          // viento (como en el golf: hay que compensarlo)
          modoTactil ? h('g', { transform: 'translate(150,300)' },
            h('circle', { r: 54, fill: 'rgba(0,0,0,.45)', stroke: 'rgba(255,255,255,.3)', strokeWidth: 3 }),
            h('path', {
              d: 'M0 26 L0 -26 M-14 -12 L0 -26 L14 -12',
              stroke: viento >= 0 ? '#7CFFB2' : '#FFD54F', strokeWidth: 6, fill: 'none',
              strokeLinecap: 'round',
              transform: 'rotate(' + (viento >= 0 ? 90 : -90) + ')',
            }),
            h('text', { y: 84, textAnchor: 'middle', className: 'fp-svg-sub' },
              'viento ' + Math.abs(Math.round(viento * 100)) + '%')) : null,
          modoTactil && !volandoRef.current && !barra ? h('g', null,
            // tejo listo para lanzar
            h('g', { transform: 'translate(' + ORIGEN_TACTIL.x + ',' + ORIGEN_TACTIL.y + ')' },
              h('ellipse', { cx: 0, cy: 16, rx: 46, ry: 15, fill: 'rgba(0,0,0,.35)' }),
              h('ellipse', { rx: 44, ry: 17, fill: '#DDE1E6', stroke: '#5A6068', strokeWidth: 5 }),
              h('ellipse', { rx: 19, ry: 7, fill: 'rgba(255,255,255,.7)' })),
            apunte ? h('g', null,
              // línea de la honda + previsualización de la dirección
              h('line', {
                x1: ORIGEN_TACTIL.x, y1: ORIGEN_TACTIL.y,
                x2: ORIGEN_TACTIL.x + apunte.dx, y2: ORIGEN_TACTIL.y + apunte.dy,
                stroke: 'rgba(255,255,255,.5)', strokeWidth: 6, strokeDasharray: '12 10',
              }),
              h('line', {
                x1: ORIGEN_TACTIL.x, y1: ORIGEN_TACTIL.y,
                x2: ORIGEN_TACTIL.x - apunte.dx * 1.6, y2: ORIGEN_TACTIL.y - apunte.dy * 1.6,
                stroke: 'var(--fp-accent)', strokeWidth: 8, strokeLinecap: 'round',
              }),
              // medidor de potencia
              h('g', { transform: 'translate(850,1180)' },
                h('rect', { x: -34, y: -220, width: 68, height: 240, rx: 34, fill: 'rgba(0,0,0,.5)', stroke: 'rgba(255,255,255,.3)', strokeWidth: 3 }),
                h('rect', {
                  x: -26, y: -212 + 224 * (1 - apunte.potencia), width: 52,
                  height: 224 * apunte.potencia, rx: 26, fill: 'var(--fp-accent)',
                }),
                h('text', { y: 52, textAnchor: 'middle', className: 'fp-svg-label' },
                  Math.round(apunte.potencia * 100) + '%'))) : null) : null,
          // barra de precisión (segundo tiempo del tiro)
          barra ? h('g', { transform: 'translate(500,1215)' },
            h('rect', { x: -400, y: -52, width: 800, height: 104, rx: 52, fill: 'rgba(0,0,0,.65)', stroke: 'rgba(255,255,255,.3)', strokeWidth: 3 }),
            h('rect', { x: -46, y: -40, width: 92, height: 80, rx: 14, fill: 'rgba(124,255,178,.28)', stroke: '#7CFFB2', strokeWidth: 3 }),
            h('line', { x1: 0, y1: -40, x2: 0, y2: 40, stroke: '#7CFFB2', strokeWidth: 4 }),
            h('rect', { x: barra.pos * 370 - 9, y: -46, width: 18, height: 92, rx: 9, fill: '#fff' }),
            h('text', { y: 92, textAnchor: 'middle', className: 'fp-svg-label' }, 'TOCA para fijar la precisión')) : null,
          // aviso del último tiro
          ultimo && !barra ? h('g', { transform: 'translate(500,1330)' },
            h('rect', { x: -320, y: -46, width: 640, height: 92, rx: 46, fill: 'rgba(0,0,0,.55)' }),
            h('text', { textAnchor: 'middle', y: 12, className: 'fp-ray-aviso' },
              ultimo.quemada ? '¡QUEMADA! +2 puntos'
                : ultimo.dentro ? 'A ' + ultimo.cm + ' cm de la lienza'
                : ultimo.motivo)) : null),
        !modoTactil ? h('div', { className: 'fp-ray-cam' },
          h('video', {
            ref: attachVideo, className: 'fp-video' + (espejo ? ' is-mirror' : ''),
            autoPlay: true, playsInline: true, muted: true,
          }),
          hw.avisoCamara !== false ? h('div', { className: 'fp-cam-notice' }, '● Cámara activa') : null) : null,
        h('p', { className: 'fp-hint' },
          modoTactil
            ? (barra ? 'Toca cuando el marcador pase por el centro: mientras más al centro, más preciso el tejo.'
              : apunte ? 'Suelta para pasar a la barra de precisión.'
              : 'Arrastra hacia atrás desde el tejo para cargar fuerza y apuntar, y suelta.')
            : 'Lanza por abajo, con el brazo suelto, como en la cancha. Baja la mano para armar el próximo tiro.')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.c Juego 5 — "Boxeo" (cámara, SOLO medio cuerpo superior)
  // ══════════════════════════════════════════════════════════════════════
  //
  // El participante se para cerca del tótem: basta con que se le vea el torso,
  // los brazos y la cabeza. La cámara lee tres cosas:
  //   · GOLPE   — la muñeca se aleja rápido del hombro (jab/cross), con altura
  //               alta o media según dónde quede la mano.
  //   · GUARDIA — ambas manos a la altura de la cara: absorbe el golpe rival.
  //   · ESQUIVA — el torso se inclina a un lado en el momento del impacto.
  // Enfrente hay un contrincante virtual: canguro boxeador o boxeador humano.

  const RIVALES = {
    canguro: { nombre: 'Canguro boxeador', emoji: '🦘', piel: '#B5793E', pielOsc: '#8A5628', guante: '#D52B1E' },
    humano: { nombre: 'Boxeador humano', emoji: '🥊', piel: '#E8B98F', pielOsc: '#C9925F', guante: '#0039A6' },
  };

  /** Contrincante virtual. `estado`: idle | telegrafia | golpea | recibe | ko. */
  function RivalBoxeo(props) {
    const tipo = RIVALES[props.tipo] ? props.tipo : 'canguro';
    const R = RIVALES[tipo];
    const t = num(props.t, 0);
    const estado = props.estado || 'idle';
    const vaivén = Math.sin(t * 3) * 10;
    const golpeD = estado === 'golpea' && props.brazo === 'derecho';
    const golpeI = estado === 'golpea' && props.brazo === 'izquierdo';
    const carga = estado === 'telegrafia';
    const ko = estado === 'ko';
    const recibe = estado === 'recibe';
    // Posición de cada guante según lo que esté haciendo.
    const gI = golpeI ? { x: -60, y: 250, r: 92 } : carga ? { x: -230, y: 130, r: 62 } : { x: -170, y: 190, r: 66 };
    const gD = golpeD ? { x: 60, y: 250, r: 92 } : carga ? { x: 230, y: 130, r: 62 } : { x: 170, y: 190, r: 66 };
    const inclina = ko ? 'rotate(16) translate(0,90)' : recibe ? 'translate(0,18) rotate(-4)' : '';
    return h('g', { transform: 'translate(0,' + vaivén.toFixed(1) + ') ' + inclina },
      // sombra
      h('ellipse', { cx: 0, cy: 470, rx: 190, ry: 40, fill: 'rgba(0,0,0,.35)' }),
      // cola (solo canguro)
      tipo === 'canguro'
        ? h('path', { d: 'M60 380 q170 40 220 150 q-30 30 -70 6 q-70 -50 -160 -70 Z', fill: R.pielOsc })
        : null,
      // piernas
      tipo === 'canguro'
        ? h('g', { fill: R.pielOsc },
            h('path', { d: 'M-70 330 q-30 70 -20 130 l120 0 q-14 -70 -34 -130 Z' }),
            h('path', { d: 'M70 330 q30 70 20 130 l-120 0 q14 -70 34 -130 Z' }),
            h('ellipse', { cx: -70, cy: 462, rx: 74, ry: 22 }),
            h('ellipse', { cx: 70, cy: 462, rx: 74, ry: 22 }))
        : h('g', { fill: '#2B2F3A' },
            h('rect', { x: -76, y: 320, width: 62, height: 140, rx: 24 }),
            h('rect', { x: 14, y: 320, width: 62, height: 140, rx: 24 }),
            h('ellipse', { cx: -46, cy: 466, rx: 46, ry: 18, fill: '#111827' }),
            h('ellipse', { cx: 46, cy: 466, rx: 46, ry: 18, fill: '#111827' })),
      // short tricolor
      h('path', { d: 'M-104 250 L104 250 L96 340 L-96 340 Z', fill: '#0039A6' }),
      h('path', { d: 'M-100 290 L100 290 L98 312 L-98 312 Z', fill: '#fff' }),
      h('path', { d: 'M-98 312 L98 312 L96 340 L-96 340 Z', fill: '#D52B1E' }),
      // torso
      h('path', { d: 'M-110 60 q110 -34 220 0 l-14 200 q-96 26 -192 0 Z', fill: R.piel, stroke: R.pielOsc, strokeWidth: 5 }),
      h('path', { d: 'M-70 130 q70 -18 140 0 l-8 90 q-62 16 -124 0 Z', fill: R.pielOsc, opacity: 0.35 }),
      // cabeza
      tipo === 'canguro'
        ? h('g', null,
            h('path', { d: 'M-52 -34 q-30 -130 6 -140 q34 -8 30 118 Z', fill: R.piel, stroke: R.pielOsc, strokeWidth: 5 }),
            h('path', { d: 'M52 -34 q30 -130 -6 -140 q-34 -8 -30 118 Z', fill: R.piel, stroke: R.pielOsc, strokeWidth: 5 }),
            h('ellipse', { cx: 0, cy: -10, rx: 86, ry: 78, fill: R.piel, stroke: R.pielOsc, strokeWidth: 5 }),
            h('ellipse', { cx: 0, cy: 34, rx: 44, ry: 34, fill: R.pielOsc, opacity: 0.5 }),
            h('ellipse', { cx: 0, cy: 40, rx: 16, ry: 11, fill: '#3B2416' }))
        : h('g', null,
            h('ellipse', { cx: 0, cy: -10, rx: 78, ry: 84, fill: R.piel, stroke: R.pielOsc, strokeWidth: 5 }),
            h('path', { d: 'M-78 -40 q78 -60 156 0 q-6 -70 -78 -70 q-72 0 -78 70 Z', fill: '#2B2F3A' })),
      // ojos y boca
      ko
        ? h('g', { stroke: '#2B2F3A', strokeWidth: 7, strokeLinecap: 'round' },
            h('path', { d: 'M-42 -30 l28 28 M-14 -30 l-28 28' }),
            h('path', { d: 'M14 -30 l28 28 M42 -30 l-28 28' }))
        : h('g', null,
            h('circle', { cx: -30, cy: -22, r: 10, fill: '#2B2F3A' }),
            h('circle', { cx: 30, cy: -22, r: 10, fill: '#2B2F3A' })),
      h('path', {
        d: ko ? 'M-24 26 q24 -18 48 0' : recibe ? 'M-26 30 q26 22 52 0' : 'M-24 26 q24 20 48 0',
        stroke: '#2B2F3A', strokeWidth: 6, fill: 'none', strokeLinecap: 'round',
      }),
      // brazos + guantes
      h('g', null,
        h('line', { x1: -96, y1: 120, x2: gI.x, y2: gI.y, stroke: R.piel, strokeWidth: 40, strokeLinecap: 'round' }),
        h('line', { x1: 96, y1: 120, x2: gD.x, y2: gD.y, stroke: R.piel, strokeWidth: 40, strokeLinecap: 'round' }),
        h('circle', { cx: gI.x, cy: gI.y, r: gI.r, fill: R.guante, stroke: 'rgba(0,0,0,.35)', strokeWidth: 5 }),
        h('circle', { cx: gD.x, cy: gD.y, r: gD.r, fill: R.guante, stroke: 'rgba(0,0,0,.35)', strokeWidth: 5 }),
        h('path', { d: 'M' + (gI.x - gI.r * 0.5) + ' ' + (gI.y + gI.r * 0.5) + ' q' + gI.r * 0.5 + ' ' + gI.r * 0.35 + ' ' + gI.r + ' 0', stroke: 'rgba(0,0,0,.25)', strokeWidth: 6, fill: 'none' }),
        h('path', { d: 'M' + (gD.x - gD.r * 0.5) + ' ' + (gD.y + gD.r * 0.5) + ' q' + gD.r * 0.5 + ' ' + gD.r * 0.35 + ' ' + gD.r + ' 0', stroke: 'rgba(0,0,0,.25)', strokeWidth: 6, fill: 'none' })),
      carga ? h('text', { y: -140, textAnchor: 'middle', className: 'fp-box-aviso' }, '¡ATENTO!') : null);
  }

  /** Guante del jugador en primera persona. */
  function GuanteJugador(props) {
    const c = props.color || '#D52B1E';
    return h('g', { transform: 'translate(' + props.x.toFixed(0) + ',' + props.y.toFixed(0) + ') scale(' + (props.escala || 1).toFixed(2) + ')' },
      h('ellipse', { cx: 0, cy: 40, rx: 96, ry: 26, fill: 'rgba(0,0,0,.3)' }),
      h('circle', { r: 92, fill: c, stroke: 'rgba(0,0,0,.35)', strokeWidth: 6 }),
      h('path', { d: 'M-70 40 q70 46 140 0', stroke: 'rgba(0,0,0,.25)', strokeWidth: 8, fill: 'none' }),
      h('rect', { x: -40, y: 78, width: 80, height: 40, rx: 16, fill: '#F6F1E4', stroke: 'rgba(0,0,0,.25)', strokeWidth: 4 }),
      h('circle', { cx: -28, cy: -26, r: 22, fill: 'rgba(255,255,255,.25)' }));
  }

  const BOX_VB = { w: 1000, h: 1400 };

  function JuegoBoxeo(props) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
    const duracion = clamp(num(cfg.duracion, 90), 20, 300);
    const dificultad = s(cfg.dificultad) || 'media';
    const VIDA = 100;

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const detRef = useRef(detectorBoxeo());
    const faseRef = useRef('intro');
    const calibRef = useRef(0);
    const ringRef = useRef(null);

    const [fase, setFase] = useState('intro');
    const [rival, setRival] = useState(RIVALES[s(cfg.contrincante)] ? s(cfg.contrincante) : 'canguro');
    const [error, setError] = useState('');
    const [modoTactil, setModoTactil] = useState(false);
    const [guia, setGuia] = useState({ motivo: '', ok: false, progreso: 0, landmarks: null });
    const [hud, setHud] = useState({ vidaJ: VIDA, vidaR: VIDA, tiempo: duracion, combo: 0, guardia: false, incl: 0, estadoRival: 'idle', brazoRival: 'derecho', reloj: 0 });
    const [manos, setManos] = useState(null);
    const [efectos, setEfectos] = useState([]);
    const [fin, setFin] = useState(null);

    const irA = useCallback((f) => { faseRef.current = f; setFase(f); }, []);

    const attachVideo = useCallback((el) => {
      videoRef.current = el;
      if (!el) return;
      if (streamRef.current && el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
      }
      if (provRef.current && provRef.current.setVideo) provRef.current.setVideo(el);
    }, []);

    const soltarTodo = useCallback(() => {
      try { provRef.current && provRef.current.detener(); } catch (e) { /* noop */ }
      provRef.current = null;
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    }, []);
    useEffect(() => soltarTodo, [soltarTodo]);

    const efecto = (tipo, texto, x, y) => {
      const e = { id: uid('fx'), tipo, texto, x: x == null ? 500 : x, y: y == null ? 620 : y, t: nowMs() };
      setEfectos((prev) => prev.concat([e]).slice(-6));
      setT(() => setEfectos((prev) => prev.filter((z) => z.id !== e.id)), 900);
    };

    const nuevoRing = () => ({
      vidaJ: VIDA, vidaR: VIDA, reloj: duracion, combo: 0,
      golpes: 0, aciertos: 0, bloqueos: 0, esquivas: 0, dano: 0,
      guardia: false, incl: 0,
      rival: { estado: 'idle', t: 0, prox: 2.2, brazo: 'derecho' },
    });

    const PARAMS = {
      facil: { intervalo: 3.0, aviso: 0.9, dano: 7, danoJugador: 13 },
      media: { intervalo: 2.2, aviso: 0.65, dano: 10, danoJugador: 11 },
      dificil: { intervalo: 1.5, aviso: 0.45, dano: 14, danoJugador: 9 },
    };

    /** Golpe del jugador (cámara o botón táctil). */
    const golpearJugador = useCallback((g) => {
      const R = ringRef.current;
      if (!R || faseRef.current !== 'pelea' || R.rival.estado === 'ko') return;
      const P = PARAMS[dificultad] || PARAMS.media;
      R.golpes++;
      // Pegarle mientras carga su golpe (contragolpe) vale más.
      const contra = R.rival.estado === 'telegrafia' ? 1.4 : 1;
      const dano = P.danoJugador * (0.6 + g.fuerza * 0.8) * contra;
      R.vidaR = Math.max(0, R.vidaR - dano);
      R.aciertos++; R.combo++; R.dano += dano;
      R.rival.estado = 'recibe'; R.rival.t = 0;
      efecto('golpe', (contra > 1 ? '¡CONTRA! ' : '') + '-' + Math.round(dano),
        g.brazo === 'izquierdo' ? 380 : 620, g.altura === 'alta' ? 380 : 560);
      if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) { /* noop */ } }
      if (R.vidaR <= 0) {
        R.rival.estado = 'ko';
        efecto('ko', '¡K.O.!');
        setT(() => { if (faseRef.current === 'pelea') terminar('ko'); }, 1400);
      }
    }, [dificultad]);

    const terminar = useCallback((motivo) => {
      const R = ringRef.current;
      if (!R) return;
      const p10 = clamp((R.dano / VIDA) * 8 + (motivo === 'ko' ? 2 : 0), 0, 10);
      setFin({
        motivo, p10,
        vidaR: R.vidaR, vidaJ: R.vidaJ,
        aciertos: R.aciertos, golpes: R.golpes, bloqueos: R.bloqueos, esquivas: R.esquivas,
      });
      irA('fin');
    }, [irA]);

    const iniciar = useCallback(async (modo) => {
      setError('');
      setFin(null);
      detRef.current.reset();
      calibRef.current = 0;
      ringRef.current = nuevoRing();
      if (modo === 'tactil') {
        setModoTactil(true);
        irA('pelea');
        return;
      }
      setModoTactil(false);
      irA('abriendo');
      try {
        const stream = await abrirCamara(hw);
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) throw new Error('No se pudo montar el elemento de video.');
        v.srcObject = stream;
        await v.play().catch(() => {});
        const prov = proveedorMediaPipe(hw);
        await prov.iniciar(v);
        provRef.current = prov;
        irA('posicion');
      } catch (e) {
        soltarTodo();
        setError(s(e && e.message ? e.message : e));
        irA('intro');
      }
    }, [hw, irA, soltarTodo]);

    // Bucle: calibración de medio cuerpo, luego combate.
    useEffect(() => {
      if (fase !== 'posicion' && fase !== 'pelea') return undefined;
      let ultimoHud = 0, reloj = 0;
      return loop((dt) => {
        const t = nowMs();
        const prov = provRef.current;
        const lec = prov ? prov.leer() : null;
        const L = lec && lec.landmarks;

        if (faseRef.current === 'posicion') {
          const enc = encuadreDePose(L, 'superior');
          calibRef.current = enc.ok ? calibRef.current + dt : Math.max(0, calibRef.current - dt * 0.6);
          if (t - ultimoHud > 100) {
            ultimoHud = t;
            setGuia({ motivo: enc.motivo, ok: !!enc.ok, progreso: clamp(calibRef.current / 1.5, 0, 1), landmarks: L });
          }
          if (calibRef.current >= 1.5) { detRef.current.reset(); ringRef.current = nuevoRing(); irA('pelea'); }
          return;
        }

        const R = ringRef.current;
        if (!R) return;
        const P = PARAMS[dificultad] || PARAMS.media;
        reloj += dt;
        R.reloj = Math.max(0, R.reloj - dt);

        // ── Lectura del jugador ──────────────────────────────────────
        if (!modoTactil) {
          const lect = detRef.current.actualizar(L, hw.espejo !== false, dt);
          R.guardia = lect.guardia;
          R.incl = lect.inclinacion;
          if (lect.golpe) golpearJugador(lect.golpe);
          if (L) {
            const mI = L[IDX.munecaI], mD = L[IDX.munecaD];
            const px = (p) => (hw.espejo !== false ? 1 - p.x : p.x);
            setManos({
              i: mI ? { x: px(mI) * BOX_VB.w, y: 700 + mI.y * 620 } : null,
              d: mD ? { x: px(mD) * BOX_VB.w, y: 700 + mD.y * 620 } : null,
            });
          }
        }

        // ── Contrincante ─────────────────────────────────────────────
        const rv = R.rival;
        rv.t += dt;
        if (rv.estado === 'recibe' && rv.t > 0.35) { rv.estado = 'idle'; rv.t = 0; }
        if (rv.estado === 'idle') {
          rv.prox -= dt;
          if (rv.prox <= 0) {
            rv.estado = 'telegrafia'; rv.t = 0;
            rv.brazo = Math.random() > 0.5 ? 'derecho' : 'izquierdo';
          }
        } else if (rv.estado === 'telegrafia' && rv.t >= P.aviso) {
          rv.estado = 'golpea'; rv.t = 0;
          // Resolución del ataque contra la defensa del jugador.
          if (Math.abs(R.incl) > 0.55) {
            R.esquivas++;
            efecto('esquiva', '¡ESQUIVA!');
          } else if (R.guardia) {
            R.bloqueos++;
            const d = P.dano * 0.2;
            R.vidaJ = Math.max(0, R.vidaJ - d);
            efecto('bloqueo', 'BLOQUEADO');
          } else {
            R.vidaJ = Math.max(0, R.vidaJ - P.dano);
            R.combo = 0;
            efecto('recibe', '-' + Math.round(P.dano));
          }
        } else if (rv.estado === 'golpea' && rv.t > 0.22) {
          rv.estado = 'idle'; rv.t = 0; rv.prox = P.intervalo * (0.75 + Math.random() * 0.5);
        }

        if (R.vidaJ <= 0) { terminar('derrota'); return; }
        if (R.reloj <= 0) { terminar('tiempo'); return; }

        if (t - ultimoHud > 90) {
          ultimoHud = t;
          setGuia((g) => Object.assign({}, g, { landmarks: L }));
          setHud({
            vidaJ: R.vidaJ, vidaR: R.vidaR, tiempo: Math.ceil(R.reloj), combo: R.combo,
            guardia: R.guardia, incl: R.incl, estadoRival: rv.estado, brazoRival: rv.brazo, reloj: reloj,
          });
        }
      });
    }, [fase, modoTactil, dificultad, hw.espejo, golpearJugador, terminar, irA]);

    const espejo = hw.espejo !== false;
    const videoBox = h('div', { className: 'fp-cam' + (fase === 'intro' || fase === 'fin' ? ' is-hidden' : '') },
      h('video', {
        ref: attachVideo, className: 'fp-video' + (espejo ? ' is-mirror' : ''),
        autoPlay: true, playsInline: true, muted: true,
      }),
      guia.landmarks ? h(Esqueleto, { landmarks: guia.landmarks, espejo: espejo }) : null,
      fase === 'posicion' ? h(Silueta, { ok: guia.ok, modo: 'superior' }) : null,
      hw.avisoCamara !== false && streamRef.current
        ? h('div', { className: 'fp-cam-notice' }, '● Cámara activa · no se graba ni se envía video') : null);

    // ── Intro: elegir contrincante ────────────────────────────────────
    if (fase === 'intro' || fase === 'abriendo') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-intro' },
          h('h2', null, props.game.blurb || 'Elige a tu contrincante'),
          h('div', { className: 'fp-rivales' },
            Object.keys(RIVALES).map((k) => h('button', {
              key: k, type: 'button',
              className: 'fp-rival-card' + (rival === k ? ' is-on' : ''),
              onClick: () => setRival(k),
            },
              h('svg', { viewBox: '-320 -220 640 760', className: 'fp-rival-svg' },
                h(RivalBoxeo, { tipo: k, estado: 'idle', t: 0 })),
              h('b', null, RIVALES[k].nombre)))),
          h('ul', { className: 'fp-steps' },
            h('li', null, 'Golpea con cada brazo: se mide la extensión y la velocidad.'),
            h('li', null, h('b', null, 'Guardia'), ': sube las dos manos a la cara para amortiguar.'),
            h('li', null, h('b', null, 'Esquiva'), ': inclina el torso a un lado cuando el rival avise.')),
          error ? h('div', { className: 'fp-error' }, '⚠ ' + error) : null,
          fase === 'abriendo' ? h('p', null, 'Abriendo la cámara…') : h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => iniciar('camara') }, '🥊 Pelear con el cuerpo'),
            h(Boton, { onClick: () => iniciar('tactil') }, '👆 Probar con botones')),
          h('p', { className: 'fp-privacy' },
            '📷 Solo se necesita ver tu torso, brazos y cabeza: puedes jugar cerca del tótem. ' +
            'El análisis ocurre en este equipo, no se graba ni se envía video.')),
        videoBox);
    }

    // ── Posicionamiento (medio cuerpo) ────────────────────────────────
    if (fase === 'posicion') {
      return h(Marco, {
        icon: props.game.icon, title: props.game.name,
        onExit: () => { soltarTodo(); props.onExit(); },
        meta: h(Chip, null, 'Paso 1 de 2 · ubicación'),
      },
        h('div', { className: 'fp-pos' },
          h('h2', { className: 'fp-pos-title' }, 'Ponte en guardia frente al tótem'),
          h(ZonaMedioCuerpo, { ok: guia.ok, metros: num(cfg.distanciaMetros, 1.5), nota: 'con el torso y los brazos basta' }),
          h('div', { className: 'fp-pos-cam' },
            videoBox,
            h('div', { className: 'fp-calib' },
              h('b', null, guia.ok ? '¡Listo! No te muevas…' : 'Ubícate frente a la cámara'),
              h('span', null, guia.motivo || 'Buscando a la persona…'),
              h('div', { className: 'fp-progress' }, h('i', { style: { width: (guia.progreso * 100).toFixed(0) + '%' } })))),
          h('p', { className: 'fp-hint' },
            'Deja espacio para estirar los brazos. No hace falta que se te vean las piernas.')));
    }

    // ── Resultado ─────────────────────────────────────────────────────
    if (fase === 'fin' && fin) {
      const titulo = fin.motivo === 'ko' ? '¡K.O.! Ganaste'
        : fin.motivo === 'derrota' ? 'Te noquearon'
        : fin.vidaR < fin.vidaJ ? '¡Ganaste por puntos!' : 'Ganó el rival por puntos';
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: () => { soltarTodo(); props.onExit(); }, meta: null },
        h(Resultado, {
          puntaje10: fin.p10,
          juego: props.game.name,
          titulo: titulo,
          mensaje: 'Contrincante: ' + RIVALES[rival].nombre + '.',
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, fin.aciertos + ' golpes acertados'),
            h(Chip, null, 'Vida del rival: ' + Math.round(fin.vidaR) + '%'),
            h(Chip, null, fin.bloqueos + ' bloqueos'),
            h(Chip, null, fin.esquivas + ' esquivas')),
          detalleTexto: RIVALES[rival].nombre + ' · ' + fin.aciertos + ' golpes · ' + fin.bloqueos + ' bloqueos',
          onExit: () => { soltarTodo(); props.onExit(); },
          onReplay: () => {
            ringRef.current = nuevoRing(); detRef.current.reset(); setFin(null);
            irA(modoTactil || !provRef.current ? 'pelea' : 'posicion');
            calibRef.current = 0;
          },
        }));
    }

    // ── El ring ───────────────────────────────────────────────────────
    const barra = (v, color, dcha) => h('div', { className: 'fp-vida' + (dcha ? ' is-dcha' : '') },
      h('i', { style: { width: clamp(v, 0, 100) + '%', background: color } }));
    const manoI = (manos && manos.i) || { x: 300, y: 1180 };
    const manoD = (manos && manos.d) || { x: 700, y: 1180 };

    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, null, '⏱ ' + hud.tiempo + 's'),
        hud.combo > 1 ? h(Chip, { tone: 'ok' }, 'combo x' + hud.combo) : null,
        hud.guardia ? h(Chip, { tone: 'ok' }, '🛡 guardia') : null),
    },
      h('div', { className: 'fp-box-wrap' },
        h('div', { className: 'fp-box-vidas' },
          h('div', null, h('small', null, 'TÚ'), barra(hud.vidaJ, '#4ADE80')),
          h('div', null, h('small', null, RIVALES[rival].nombre.toUpperCase()), barra(hud.vidaR, 'var(--fp-accent)', true))),
        h('svg', { className: 'fp-box-svg', viewBox: '0 0 1000 1400' },
          h('defs', null,
            h('radialGradient', { id: 'fp-ring', cx: '50%', cy: '40%', r: '75%' },
              h('stop', { offset: '0%', stopColor: '#2E3A55' }),
              h('stop', { offset: '100%', stopColor: '#141B2B' }))),
          h('rect', { width: 1000, height: 1400, fill: 'url(#fp-ring)' }),
          // cuerdas del ring
          [0, 1, 2].map((i) => h('g', { key: 'c' + i },
            h('line', { x1: 0, y1: 250 + i * 90, x2: 1000, y2: 250 + i * 90, stroke: '#D52B1E', strokeWidth: 10, opacity: 0.55 }))),
          h('rect', { x: 0, y: 980, width: 1000, height: 420, fill: '#8C9AAE', opacity: 0.35 }),
          // contrincante
          h('g', { transform: 'translate(500,520) scale(1.05)' },
            h(RivalBoxeo, { tipo: rival, estado: hud.estadoRival, brazo: hud.brazoRival, t: hud.reloj })),
          // efectos
          efectos.map((e) => h('text', {
            key: e.id, x: e.x, y: e.y, textAnchor: 'middle',
            className: 'fp-box-fx' + (e.tipo === 'recibe' ? ' is-mal' : e.tipo === 'ko' ? ' is-ko' : ''),
          }, e.texto)),
          // guantes del jugador
          h(GuanteJugador, { x: manoI.x, y: manoI.y, color: '#D52B1E' }),
          h(GuanteJugador, { x: manoD.x, y: manoD.y, color: '#D52B1E' }),
          hud.guardia ? h('text', { x: 500, y: 1330, textAnchor: 'middle', className: 'fp-svg-label' }, '🛡 GUARDIA ARRIBA') : null),
        !modoTactil ? h('div', { className: 'fp-ray-cam' },
          h('video', {
            ref: attachVideo, className: 'fp-video' + (espejo ? ' is-mirror' : ''),
            autoPlay: true, playsInline: true, muted: true,
          }),
          hw.avisoCamara !== false ? h('div', { className: 'fp-cam-notice' }, '● Cámara activa') : null) : null,
        modoTactil ? h('div', { className: 'fp-box-botones' },
          h(Boton, { variant: 'primary', onClick: () => golpearJugador({ brazo: 'izquierdo', altura: 'media', fuerza: 0.8 }) }, '🥊 Izquierda'),
          h(Boton, {
            onClick: () => {
              const R = ringRef.current;
              if (R) { R.guardia = !R.guardia; setHud((x) => Object.assign({}, x, { guardia: R.guardia })); }
            },
          }, '🛡 Guardia'),
          h(Boton, { variant: 'primary', onClick: () => golpearJugador({ brazo: 'derecho', altura: 'alta', fuerza: 0.8 }) }, 'Derecha 🥊')) : null,
        h('p', { className: 'fp-hint' },
          modoTactil
            ? 'Modo de prueba con botones. Con cámara se golpea, se bloquea y se esquiva con el cuerpo.'
            : 'Golpea estirando el brazo. Sube las dos manos para bloquear e inclínate para esquivar cuando avise.')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.d Juego 6 — "Gato" (tres en línea, 100% táctil)
  // ══════════════════════════════════════════════════════════════════════

  const LINEAS_GATO = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  /** Devuelve null, o { jugador: 'x'|'o'|'empate', linea }. */
  function ganadorGato(t) {
    for (const l of LINEAS_GATO) {
      const [a, b, c] = l;
      if (t[a] && t[a] === t[b] && t[b] === t[c]) return { jugador: t[a], linea: l };
    }
    return t.every((v) => v) ? { jugador: 'empate', linea: null } : null;
  }

  /** Minimax completo (el tablero de 3×3 es pequeño: se resuelve exacto). */
  function minimaxGato(t, turno, yo, prof) {
    const g = ganadorGato(t);
    if (g) {
      if (g.jugador === 'empate') return { puntaje: 0 };
      return { puntaje: g.jugador === yo ? 10 - prof : prof - 10 };
    }
    let mejor = null;
    for (let i = 0; i < 9; i++) {
      if (t[i]) continue;
      t[i] = turno;
      const r = minimaxGato(t, turno === 'x' ? 'o' : 'x', yo, prof + 1);
      t[i] = '';
      if (!mejor || (turno === yo ? r.puntaje > mejor.puntaje : r.puntaje < mejor.puntaje)) {
        mejor = { puntaje: r.puntaje, i };
      }
    }
    return mejor || { puntaje: 0 };
  }

  /** Jugada de la máquina según el nivel. */
  function jugadaMaquina(t, yo, nivel) {
    const libres = [];
    for (let i = 0; i < 9; i++) if (!t[i]) libres.push(i);
    if (!libres.length) return -1;
    const azar = nivel === 'facil' ? 0.7 : nivel === 'media' ? 0.3 : 0;
    if (Math.random() < azar) return libres[Math.floor(Math.random() * libres.length)];
    const r = minimaxGato(t.slice(), yo, yo, 0);
    return r && r.i != null ? r.i : libres[0];
  }

  /** Ficha del tablero, con el estilo del juego de madera de la referencia. */
  function FichaGato(props) {
    if (props.valor === 'x') {
      return h('g', { stroke: '#6D2E93', strokeWidth: 26, strokeLinecap: 'round' },
        h('line', { x1: -52, y1: -52, x2: 52, y2: 52 }),
        h('line', { x1: 52, y1: -52, x2: -52, y2: 52 }));
    }
    if (props.valor === 'o') {
      return h('g', null,
        h('circle', { r: 62, fill: '#F5871F' }),
        h('circle', { r: 38, fill: '#1B4FD8' }));
    }
    return null;
  }

  function JuegoGato(props) {
    const cfg = props.game.config || {};
    const contraMaquina = cfg.modo !== 'dos-jugadores';
    const nivel = s(cfg.dificultad) || 'media';
    const humano = 'x', maquina = 'o';

    const [tablero, setTablero] = useState(['', '', '', '', '', '', '', '', '']);
    const [turno, setTurno] = useState('x');
    const [serie, setSerie] = useState({ x: 0, o: 0, empates: 0, jugadas: 0 });
    const [pensando, setPensando] = useState(false);

    const res = ganadorGato(tablero);
    const rondas = clamp(Math.round(num(cfg.rondas, 3)), 1, 9);
    const terminada = serie.jugadas >= rondas;

    const jugar = useCallback((i, quien) => {
      setTablero((prev) => {
        if (prev[i] || ganadorGato(prev)) return prev;
        const next = prev.slice();
        next[i] = quien;
        const g = ganadorGato(next);
        if (g) {
          setSerie((sr) => ({
            x: sr.x + (g.jugador === 'x' ? 1 : 0),
            o: sr.o + (g.jugador === 'o' ? 1 : 0),
            empates: sr.empates + (g.jugador === 'empate' ? 1 : 0),
            jugadas: sr.jugadas + 1,
          }));
        } else {
          setTurno(quien === 'x' ? 'o' : 'x');
        }
        return next;
      });
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* noop */ } }
    }, []);

    // Turno de la máquina.
    useEffect(() => {
      if (!contraMaquina || res || turno !== maquina) return undefined;
      setPensando(true);
      const t = setT(() => {
        setPensando(false);
        const i = jugadaMaquina(tablero, maquina, nivel);
        if (i >= 0) jugar(i, maquina);
      }, 520);
      return () => clrT(t);
    }, [turno, tablero, res, contraMaquina, nivel, jugar]);

    const nuevaMano = () => {
      setTablero(['', '', '', '', '', '', '', '', '']);
      setTurno('x');
    };

    if (terminada) {
      const gano = serie.x, perdio = serie.o;
      const p10 = clamp((gano * 10 + serie.empates * 5) / Math.max(1, serie.jugadas), 0, 10);
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h(Resultado, {
          puntaje10: p10,
          juego: props.game.name,
          titulo: gano > perdio ? '¡Ganaste la serie!' : gano === perdio ? 'Serie empatada' : (contraMaquina ? 'Ganó el tótem' : 'Ganó el jugador O'),
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, 'X: ' + serie.x),
            h(Chip, null, 'O: ' + serie.o),
            h(Chip, null, 'Empates: ' + serie.empates)),
          detalleTexto: 'X ' + serie.x + ' · O ' + serie.o + ' · empates ' + serie.empates,
          onExit: props.onExit,
          onReplay: () => { setSerie({ x: 0, o: 0, empates: 0, jugadas: 0 }); nuevaMano(); },
        }));
    }

    const celda = (i) => {
      const cx = 170 + (i % 3) * 250, cy = 170 + Math.floor(i / 3) * 250;
      const ganadora = res && res.linea && res.linea.indexOf(i) >= 0;
      return h('g', {
        key: i, transform: 'translate(' + cx + ',' + cy + ')',
        onPointerDown: () => {
          if (res || tablero[i] || pensando) return;
          if (contraMaquina && turno !== humano) return;
          jugar(i, turno);
        },
        style: { cursor: tablero[i] || res ? 'default' : 'pointer' },
      },
        h('rect', {
          x: -110, y: -110, width: 220, height: 220, rx: 18,
          fill: ganadora ? '#FFF6D8' : '#F7F5EF',
          stroke: ganadora ? '#F5871F' : '#D8D2C4', strokeWidth: ganadora ? 8 : 5,
        }),
        h(FichaGato, { valor: tablero[i] }));
    };

    return h(Marco, {
      icon: props.game.icon, title: props.game.name, onExit: props.onExit,
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, null, 'Mano ' + Math.min(serie.jugadas + 1, rondas) + '/' + rondas),
        h(Chip, { tone: 'accent' }, 'X ' + serie.x + ' · O ' + serie.o),
        contraMaquina ? h(Chip, null, 'vs tótem (' + nivel + ')') : h(Chip, null, '2 jugadores')),
    },
      h('div', { className: 'fp-gato-wrap' },
        h('svg', { className: 'fp-gato-svg', viewBox: '0 0 840 840' },
          h('rect', { width: 840, height: 840, rx: 24, fill: '#EDE7D9' }),
          [0, 1, 2, 3, 4, 5, 6, 7, 8].map(celda),
          res && res.linea ? h('line', {
            x1: 170 + (res.linea[0] % 3) * 250, y1: 170 + Math.floor(res.linea[0] / 3) * 250,
            x2: 170 + (res.linea[2] % 3) * 250, y2: 170 + Math.floor(res.linea[2] / 3) * 250,
            stroke: '#D52B1E', strokeWidth: 16, strokeLinecap: 'round', opacity: 0.85,
          }) : null),
        h('div', { className: 'fp-gato-pie' },
          res
            ? h('div', { className: 'fp-gato-fin' },
                h('b', null, res.jugador === 'empate' ? '¡Empate!' : (res.jugador === 'x' ? '¡Ganan las X!' : (contraMaquina ? 'Gana el tótem' : '¡Ganan las O!'))),
                h(Boton, { variant: 'primary', onClick: nuevaMano }, 'Siguiente mano'))
            : h('div', { className: 'fp-gato-turno' },
                h('span', null, 'Turno de'),
                h('svg', { viewBox: '-90 -90 180 180', className: 'fp-gato-turno-svg' }, h(FichaGato, { valor: turno })),
                pensando ? h('span', null, 'pensando…') : null))));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 13. Portada (lanzador de juegos)
  // ══════════════════════════════════════════════════════════════════════

  function Portada(props) {
    const m = props.model, t = props.theme;
    const juegos = (m.games || []).filter((g) => g.enabled !== false)
      .slice().sort((a, b) => num(a.order, 99) - num(b.order, 99));
    return h('div', { className: 'fp-home' },
      h(Escenario, { theme: t, decor: t.decor !== 'ninguno' }),
      h('header', { className: 'fp-home-head' },
        h('div', { className: 'fp-brand' },
          h('span', { className: 'fp-brand-logo' }, m.branding.logo || '🎉'),
          h('div', null,
            h('h1', null, m.branding.appName || 'Kimos FunPlai'),
            h('p', null, m.branding.tagline || ''))),
        h('div', { className: 'fp-home-tools' },
          m.branding.mostrarRanking ? h(Boton, { variant: 'ghost', onClick: () => go('ranking') }, '🏆 Ranking') : null,
          h(Boton, { variant: 'ghost', onClick: () => go('diagnostico') }, '🎥 Diagnóstico'),
          h(Boton, { variant: 'ghost', onClick: () => go('editor') }, '⚙️ Editor'))),
      h('div', { className: 'fp-hero' },
        h(Escarapela, { w: 110, className: 'fp-hero-rosette' }),
        h('h2', null, m.branding.heroTitle || ''),
        h('p', null, m.branding.heroSubtitle || '')),
      h('div', { className: 'fp-cards' },
        juegos.map((g) => h('button', {
          key: g.id, type: 'button', className: 'fp-card', onClick: () => go('juego', g.id),
        },
          h('span', { className: 'fp-card-icon' }, g.icon || '🎮'),
          h('span', { className: 'fp-card-name' }, g.name),
          h('span', { className: 'fp-card-blurb' }, g.blurb || ''),
          h('span', { className: 'fp-card-tag' }, etiquetaEntrada(g.type, g.config)))),
        juegos.length ? null : h('p', { className: 'fp-empty' }, 'No hay juegos activos. Actívalos en el Editor ⚙️')),
      h('footer', { className: 'fp-home-foot' },
        h('div', { className: 'fp-foot-art' },
          h(Copihue, { w: 46 }),
          h(BanderaChile, { w: 64 }),
          h('svg', { viewBox: '-40 -40 80 80', width: 46, height: 46 }, h(Trompo, null))),
        h('span', null, m.branding.pieDePagina || '')));
  }

  function etiquetaEntrada(tipo, cfg) {
    if (tipo === 'burro') return '👆 Pantalla táctil';
    if (tipo === 'baile') return '📷 Cámara + cuerpo';
    if (tipo === 'laser') return '🔫 Pistola / puntero';
    if (tipo === 'rayuela') return '👆 Deslizar o 📷 medio cuerpo';
    if (tipo === 'boxeo') return '📷 Medio cuerpo';
    if (tipo === 'gato') return '👆 Pantalla táctil';
    return '🎮 Juego';
  }

  // ══════════════════════════════════════════════════════════════════════
  // 14. Ranking
  // ══════════════════════════════════════════════════════════════════════

  function Ranking(props) {
    const [filtro, setFiltro] = useState('');
    const rows = (props.model.scores || [])
      .filter((r) => !filtro || r.juego === filtro)
      .slice().sort((a, b) => num(b.puntaje, 0) - num(a.puntaje, 0));
    const juegos = Array.from(new Set((props.model.scores || []).map((r) => r.juego).filter(Boolean)));
    return h('div', { className: 'fp-panel' },
      h('header', { className: 'fp-panel-head' },
        h(Boton, { variant: 'ghost', onClick: () => go('home') }, '← Volver'),
        h('h2', null, '🏆 Ranking del tótem'),
        h(Boton, {
          variant: 'ghost',
          onClick: () => { if (confirm('¿Borrar todos los puntajes guardados?')) commit(merge(model, { scores: [] })); },
        }, 'Vaciar')),
      h('div', { className: 'fp-panel-body' },
        h('div', { className: 'fp-chips' },
          h('button', { className: 'fp-chip' + (filtro ? '' : ' is-on'), onClick: () => setFiltro('') }, 'Todos'),
          juegos.map((j) => h('button', { key: j, className: 'fp-chip' + (filtro === j ? ' is-on' : ''), onClick: () => setFiltro(j) }, j))),
        rows.length ? h('table', { className: 'fp-table' },
          h('thead', null, h('tr', null,
            h('th', null, '#'), h('th', null, 'Jugador'), h('th', null, 'Juego'), h('th', null, 'Puntaje'), h('th', null, 'Fecha'))),
          h('tbody', null, rows.slice(0, 40).map((r, i) => h('tr', { key: r.id },
            h('td', null, i + 1), h('td', null, r.jugador || 'Anónimo'), h('td', null, r.juego),
            h('td', null, h('b', null, r.puntaje)),
            h('td', null, new Date(r.at).toLocaleString()))))) : h('p', { className: 'fp-empty' }, 'Todavía no hay puntajes guardados.')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 15. Diagnóstico de hardware (¿sirve la cámara del tótem?)
  // ══════════════════════════════════════════════════════════════════════

  function Diagnostico(props) {
    const [cams, setCams] = useState(null);
    const [prueba, setPrueba] = useState(null);   // {ancho, alto, fps, error}
    const [pose, setPose] = useState(null);       // {ok, ms, error}
    const [puntero, setPuntero] = useState(null);
    const [cargando, setCargando] = useState('');
    const videoRef = useRef(null);
    const stopRef = useRef(null);

    useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);

    const listar = async () => {
      setCargando('camaras');
      try {
        // Sin permiso, las etiquetas vienen vacías: pedimos acceso una vez.
        let stream = null;
        try { stream = await abrirCamara(model.hardware); } catch (e) { /* seguimos: igual listamos */ }
        const devs = await navigator.mediaDevices.enumerateDevices();
        setCams(devs.filter((d) => d.kind === 'videoinput').map((d) => ({ id: d.deviceId, label: d.label || '(cámara sin etiqueta — falta permiso)' })));
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        setCams([]);
        notify('warn', 'No se pudieron listar cámaras: ' + s(e && e.message));
      }
      setCargando('');
    };

    const medir = async () => {
      setCargando('fps'); setPrueba(null);
      let stream = null;
      try {
        stream = await abrirCamara(model.hardware);
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const st = stream.getVideoTracks()[0].getSettings ? stream.getVideoTracks()[0].getSettings() : {};
        // Medición real de FPS durante 3 s.
        let frames = 0;
        const t0 = nowMs();
        await new Promise((res) => {
          if (v.requestVideoFrameCallback) {
            const cb = () => {
              frames++;
              if (nowMs() - t0 >= 3000) return res();
              v.requestVideoFrameCallback(cb);
            };
            v.requestVideoFrameCallback(cb);
          } else {
            let last = -1;
            const stop = loop(() => {
              if (v.currentTime !== last) { last = v.currentTime; frames++; }
              if (nowMs() - t0 >= 3000) { stop(); res(); }
            });
          }
        });
        setPrueba({
          ancho: st.width || v.videoWidth, alto: st.height || v.videoHeight,
          fps: Math.round((frames / ((nowMs() - t0) / 1000)) * 10) / 10,
          declarado: st.frameRate || null, etiqueta: stream.getVideoTracks()[0].label,
        });
      } catch (e) {
        setPrueba({ error: s(e && e.message ? e.message : e) });
      } finally {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setCargando('');
      }
    };

    const probarPose = async () => {
      setCargando('pose'); setPose(null);
      const t0 = nowMs();
      let stream = null;
      try {
        stream = await abrirCamara(model.hardware);
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const prov = proveedorMediaPipe(model.hardware);
        await prov.iniciar(v);
        // Espera a la primera detección con cuerpo.
        let intentos = 0, ok = false;
        while (intentos < 90 && !ok) {
          const l = prov.leer();
          if (l && l.landmarks) ok = true;
          await new Promise((r) => setT(r, 60));
          intentos++;
        }
        prov.detener();
        setPose({ ok, ms: Math.round(nowMs() - t0) });
      } catch (e) {
        setPose({ ok: false, error: s(e && e.message ? e.message : e), ms: Math.round(nowMs() - t0) });
      } finally {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setCargando('');
      }
    };

    const seguro = typeof window !== 'undefined' ? window.isSecureContext !== false : true;
    const tieneGUM = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const fila = (q, valor, rec) => h('tr', null, h('td', null, q), h('td', null, valor), h('td', null, rec));

    return h('div', { className: 'fp-panel' },
      h('header', { className: 'fp-panel-head' },
        h(Boton, { variant: 'ghost', onClick: () => go('home') }, '← Volver'),
        h('h2', null, '🎥 Diagnóstico del tótem'),
        h('span', null)),
      h('div', { className: 'fp-panel-body' },
        h('p', { className: 'fp-lead' },
          'Esta pantalla responde, con el hardware real de este tótem, qué juegos pueden funcionar hoy y qué conviene agregar.'),
        h('div', { className: 'fp-diag-grid' },
          h('div', { className: 'fp-diag-card' },
            h('h3', null, '1. Contexto de ejecución'),
            h('ul', null,
              h('li', null, (seguro ? '✅' : '❌') + ' Contexto seguro (HTTPS o localhost): ' + (seguro ? 'sí' : 'no — la cámara quedará bloqueada')),
              h('li', null, (tieneGUM ? '✅' : '❌') + ' API de cámara disponible (getUserMedia)'),
              h('li', null, '🖥️ Pantalla: ' + (typeof window !== 'undefined' ? window.innerWidth + '×' + window.innerHeight : '—')))),
          h('div', { className: 'fp-diag-card' },
            h('h3', null, '2. Cámaras conectadas'),
            h(Boton, { variant: 'soft', onClick: listar, disabled: cargando === 'camaras' }, cargando === 'camaras' ? 'Buscando…' : 'Detectar cámaras'),
            cams ? (cams.length ? h('ul', null, cams.map((c) => h('li', { key: c.id },
              h('code', null, c.label),
              h('button', {
                className: 'fp-linkbtn',
                onClick: () => { patch({ hardware: { camaraDeviceId: c.id } }); notify('success', 'Cámara seleccionada para los juegos.'); },
              }, 'usar esta')))) : h('p', null, 'No se detectaron cámaras.')) : null),
          h('div', { className: 'fp-diag-card' },
            h('h3', null, '3. Resolución y FPS reales'),
            h(Boton, { variant: 'soft', onClick: medir, disabled: cargando === 'fps' }, cargando === 'fps' ? 'Midiendo 3 s…' : 'Medir cámara'),
            prueba ? (prueba.error ? h('p', { className: 'fp-error' }, '⚠ ' + prueba.error) : h('ul', null,
              h('li', null, '📐 ' + prueba.ancho + '×' + prueba.alto),
              h('li', null, '🎞️ ' + prueba.fps + ' fps medidos' + (prueba.declarado ? ' (declara ' + prueba.declarado + ')' : '')),
              h('li', null, '🏷️ ' + (prueba.etiqueta || '—')),
              h('li', null, prueba.fps >= 24
                ? '✅ Suficiente para el juego de baile (postura y ritmo).'
                : '⚠️ Bajo para pose fluida: mejora la luz o usa una cámara externa.'),
              h('li', null, prueba.fps >= 90
                ? '✅ Apto para seguir objetos rápidos.'
                : '❌ Insuficiente para seguir una pelota o un dardo: se necesita cámara de alta velocidad (ver recomendación abajo).'))) : null),
          h('div', { className: 'fp-diag-card' },
            h('h3', null, '4. Motor de pose (33 puntos)'),
            h(Boton, { variant: 'soft', onClick: probarPose, disabled: cargando === 'pose' }, cargando === 'pose' ? 'Probando…' : 'Probar detección de cuerpo'),
            pose ? h('ul', null,
              h('li', null, (pose.ok ? '✅ Cuerpo detectado' : '❌ Sin detección') + ' · ' + pose.ms + ' ms'),
              pose.error ? h('li', null, '⚠ ' + pose.error) : null,
              h('li', null, 'Motor: ' + s(model.hardware.poseModuleUrl).slice(0, 60) + '…')) : null),
          h('div', { className: 'fp-diag-card' },
            h('h3', null, '5. Puntero / pistola laser'),
            h('div', {
              className: 'fp-target-test',
              onPointerDown: (e) => setPuntero({ tipo: e.pointerType, x: Math.round(e.clientX), y: Math.round(e.clientY), presion: e.pressure }),
            }, 'Dispara o toca aquí'),
            puntero ? h('ul', null,
              h('li', null, 'Tipo de puntero: ' + puntero.tipo + (puntero.tipo === 'mouse' ? ' (compatible con lightgun IR en modo mouse absoluto)' : '')),
              h('li', null, 'Coordenadas: ' + puntero.x + ', ' + puntero.y)) : null)),
        h('h3', { className: 'fp-h3' }, 'Veredicto por juego'),
        h('table', { className: 'fp-table' },
          h('thead', null, h('tr', null, h('th', null, 'Función'), h('th', null, '¿Sirve la cámara común del tótem?'), h('th', null, 'Recomendación'))),
          h('tbody', null,
            fila('Coloca la cola al burro', 'No hace falta cámara', 'Pantalla táctil'),
            fila('Detectar postura y movimientos de baile', 'Sí, normalmente', 'Cámara RGB 1080p + reconocimiento de pose'),
            fila('Calcular altura/distancia con precisión', 'Limitado', 'Cámara de profundidad RGB-D'),
            fila('Detectar temperatura', 'No', 'Cámara térmica específica (fuera de alcance en v1)'),
            fila('Seguir lanzamiento físico rápido', 'Limitado a 30 fps', 'Cámara global shutter 120+ fps e iluminación controlada'))),
        h('p', { className: 'fp-note' },
          'Detalle de modelos, precios y montaje: ver ', h('code', null, 'docs/HARDWARE.md'), ' en el repositorio kimos-funplai.'),
        h('video', { ref: videoRef, className: 'fp-video fp-video--mini', autoPlay: true, playsInline: true, muted: true })));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 16. Editor: todo personalizable sin tocar código
  // ══════════════════════════════════════════════════════════════════════

  const CAMPOS_JUEGO = {
    burro: [
      { key: 'intentos', label: 'Intentos por partida', type: 'number', min: 1, max: 10 },
      { key: 'velocidadMira', label: 'Velocidad de la mira', type: 'range', min: 0.2, max: 3, step: 0.1 },
      { key: 'radioBlanco', label: 'Radio del blanco (px)', type: 'range', min: 60, max: 260, step: 5, help: 'Más chico = más difícil.' },
      { key: 'bonusZona', label: 'Exigir que la mira esté centrada en el anca', type: 'boolean' },
      { key: 'mostrarPuntajeVivo', label: 'Mostrar puntaje mientras arrastra', type: 'boolean' },
      { key: 'vibrar', label: 'Vibración al soltar', type: 'boolean' },
      { key: 'textoFinal', label: 'Texto final', type: 'text' },
    ],
    baile: [
      { key: 'coreografia', label: 'Coreografía', type: 'select', options: 'choreos' },
      { key: 'vueltas', label: 'Vueltas de la coreografía', type: 'number', min: 1, max: 8 },
      { key: 'toleranciaGrados', label: 'Tolerancia de postura (grados)', type: 'range', min: 20, max: 110, step: 5, help: 'Mayor = más permisivo.' },
      { key: 'pesoRitmo', label: 'Peso del ritmo en el puntaje', type: 'range', min: 0, max: 0.8, step: 0.05 },
      { key: 'cuentaRegresiva', label: 'Cuenta regresiva (s)', type: 'number', min: 0, max: 10 },
      { key: 'exigirCalibracion', label: 'Exigir calibración de la zona', type: 'boolean' },
      { key: 'mostrarEsqueleto', label: 'Mostrar esqueleto sobre el video', type: 'boolean' },
    ],
    laser: [
      { key: 'duracion', label: 'Duración (s)', type: 'number', min: 15, max: 300 },
      { key: 'municion', label: 'Munición por cargador', type: 'number', min: 1, max: 30 },
      { key: 'recargaAuto', label: 'Munición infinita', type: 'boolean' },
      { key: 'spawnMs', label: 'Aparición de blancos (ms)', type: 'range', min: 250, max: 2500, step: 50 },
      { key: 'velocidad', label: 'Velocidad de los blancos', type: 'range', min: 0.2, max: 3, step: 0.1 },
      { key: 'radioAcierto', label: 'Tolerancia de acierto (px)', type: 'range', min: 10, max: 120, step: 2 },
      { key: 'penalizacion', label: 'Penalización por ají o schop', type: 'number', min: 0, max: 50 },
      { key: 'metaPuntos', label: 'Puntos equivalentes a un 10', type: 'number', min: 50, max: 2000 },
    ],
    rayuela: [
      { key: 'equipos', label: 'Modalidad', type: 'select', options: [
        { value: 1, label: 'Individual' },
        { value: 2, label: 'Duelo por equipos (turnos)' },
      ] },
      { key: 'tejosPorEquipo', label: 'Tejos por jugador o equipo', type: 'number', min: 1, max: 8 },
      { key: 'distanciaMetros', label: 'Distancia real a la zona (m)', type: 'range', min: 0.8, max: 4, step: 0.1, help: 'Con medio cuerpo basta ~1,5 m: representa los 14 m oficiales.' },
      { key: 'viento', label: 'Viento máximo', type: 'range', min: 0, max: 1, step: 0.05, help: 'Como en el golf: desvía el tejo y hay que compensarlo.' },
      { key: 'velocidadBarra', label: 'Velocidad de la barra de precisión', type: 'range', min: 0.4, max: 4, step: 0.1, help: 'Más rápida = más difícil acertar al centro.' },
      { key: 'fuerzaLienza', label: 'Fuerza del gesto que cae en la lienza', type: 'range', min: 1, max: 6, step: 0.1, help: 'Calibración del tótem: súbela si todos se pasan de largo.' },
      { key: 'sensibilidadProfundidad', label: 'Sensibilidad de profundidad', type: 'range', min: 0.1, max: 1, step: 0.02 },
      { key: 'sensibilidadLateral', label: 'Sensibilidad lateral', type: 'range', min: 0.05, max: 1, step: 0.05 },
      { key: 'dispersion', label: 'Dispersión del tiro', type: 'range', min: 0, max: 0.3, step: 0.01, help: '0 = el mismo gesto cae siempre igual.' },
      { key: 'toleranciaQuemada', label: 'Tolerancia de quemada (m)', type: 'range', min: 0.02, max: 0.15, step: 0.01 },
      { key: 'vistaSuperior', label: 'Mostrar vista superior del cajón', type: 'boolean' },
      { key: 'marcaCajon', label: 'Marca en el cajón', type: 'text', help: 'Texto de la placa del cajón, como en las canchas reales.' },
    ],
    boxeo: [
      { key: 'contrincante', label: 'Contrincante por defecto', type: 'select', options: [
        { value: 'canguro', label: 'Canguro boxeador' },
        { value: 'humano', label: 'Boxeador humano' },
      ] },
      { key: 'dificultad', label: 'Dificultad', type: 'select', options: [
        { value: 'facil', label: 'Fácil' },
        { value: 'media', label: 'Media' },
        { value: 'dificil', label: 'Difícil' },
      ] },
      { key: 'duracion', label: 'Duración del asalto (s)', type: 'number', min: 20, max: 300 },
      { key: 'distanciaMetros', label: 'Distancia a la zona (m)', type: 'range', min: 0.8, max: 3, step: 0.1 },
    ],
    gato: [
      { key: 'modo', label: 'Modalidad', type: 'select', options: [
        { value: 'maquina', label: 'Contra el tótem' },
        { value: 'dos-jugadores', label: 'Dos jugadores por turnos' },
      ] },
      { key: 'dificultad', label: 'Nivel del tótem', type: 'select', options: [
        { value: 'facil', label: 'Fácil' },
        { value: 'media', label: 'Media' },
        { value: 'dificil', label: 'Difícil (imbatible)' },
      ] },
      { key: 'rondas', label: 'Manos por serie', type: 'number', min: 1, max: 9 },
    ],
  };

  function Editor(props) {
    const m = props.model;
    const [tab, setTab] = useState('marca');
    const [sel, setSel] = useState((m.games[0] || {}).id || '');
    const [json, setJson] = useState('');
    const juego = m.games.find((g) => g.id === sel) || m.games[0];

    const tabs = [['marca', '🎨 Marca'], ['juegos', '🎮 Juegos'], ['hardware', '🔌 Hardware'], ['datos', '💾 Datos']];

    const campoJuego = (f) => {
      const opciones = f.options === 'choreos'
        ? Object.keys(m.choreos || {}).map((k) => ({ value: k, label: m.choreos[k].name || k }))
        : f.options;
      return h(Campo, {
        key: f.key, label: f.label, type: f.type, min: f.min, max: f.max, step: f.step,
        help: f.help, options: opciones, name: juego.id + '-' + f.key,
        value: juego.config ? juego.config[f.key] : '',
        onChange: (v) => updateGame(juego.id, { config: { [f.key]: v } }),
      });
    };

    return h('div', { className: 'fp-panel' },
      h('header', { className: 'fp-panel-head' },
        h(Boton, { variant: 'ghost', onClick: () => go('home') }, '← Volver'),
        h('h2', null, '⚙️ Editor de Kimos FunPlai'),
        h('span', { className: 'fp-saved' }, 'Los cambios se guardan solos')),
      h('nav', { className: 'fp-tabs' },
        tabs.map(([k, l]) => h('button', {
          key: k, className: 'fp-tab' + (tab === k ? ' is-on' : ''), onClick: () => setTab(k),
        }, l))),
      h('div', { className: 'fp-panel-body' },
        tab === 'marca' ? h('div', { className: 'fp-form' },
          h(Campo, { label: 'Nombre de la app', value: m.branding.appName, onChange: (v) => patch({ branding: { appName: v } }) }),
          h(Campo, { label: 'Bajada', value: m.branding.tagline, onChange: (v) => patch({ branding: { tagline: v } }) }),
          h(Campo, { label: 'Logo (emoji)', value: m.branding.logo, onChange: (v) => patch({ branding: { logo: v } }) }),
          h(Campo, {
            label: 'Temática', type: 'select', value: m.branding.theme,
            options: Object.keys(THEMES).map((k) => ({ value: k, label: THEMES[k].name })),
            onChange: (v) => patch({ branding: { theme: v } }),
          }),
          h(Campo, { label: 'Color de acento', type: 'color', value: m.branding.accent || THEMES[m.branding.theme].accent, onChange: (v) => patch({ branding: { accent: v } }) }),
          h(Campo, { label: 'Color secundario', type: 'color', value: m.branding.accent2 || THEMES[m.branding.theme].accent2, onChange: (v) => patch({ branding: { accent2: v } }) }),
          h(Campo, { label: 'Título de portada', value: m.branding.heroTitle, onChange: (v) => patch({ branding: { heroTitle: v } }) }),
          h(Campo, { label: 'Subtítulo de portada', value: m.branding.heroSubtitle, onChange: (v) => patch({ branding: { heroSubtitle: v } }) }),
          h(Campo, { label: 'Pie de página', value: m.branding.pieDePagina, onChange: (v) => patch({ branding: { pieDePagina: v } }) }),
          h(Campo, { label: 'Volver al inicio tras inactividad (s, 0 = nunca)', type: 'number', min: 0, max: 900, value: m.branding.idleSeconds, onChange: (v) => patch({ branding: { idleSeconds: v } }) }),
          h(Campo, { label: 'Mostrar ranking', type: 'boolean', value: m.branding.mostrarRanking, onChange: (v) => patch({ branding: { mostrarRanking: v } }) })) : null,

        tab === 'juegos' ? h('div', null,
          h('div', { className: 'fp-chips' }, m.games.map((g) => h('button', {
            key: g.id, className: 'fp-chip' + (g.id === sel ? ' is-on' : ''), onClick: () => setSel(g.id),
          }, (g.icon || '🎮') + ' ' + g.name))),
          juego ? h('div', { className: 'fp-form' },
            h(Campo, { label: 'Nombre visible', value: juego.name, onChange: (v) => updateGame(juego.id, { name: v }) }),
            h(Campo, { label: 'Ícono (emoji)', value: juego.icon, onChange: (v) => updateGame(juego.id, { icon: v }) }),
            h(Campo, { label: 'Descripción en la tarjeta', type: 'textarea', value: juego.blurb, onChange: (v) => updateGame(juego.id, { blurb: v }) }),
            h(Campo, { label: 'Activo en la portada', type: 'boolean', value: juego.enabled !== false, onChange: (v) => updateGame(juego.id, { enabled: v }) }),
            h(Campo, { label: 'Orden', type: 'number', min: 1, max: 20, value: juego.order, onChange: (v) => updateGame(juego.id, { order: v }) }),
            h('h4', { className: 'fp-h4' }, 'Parámetros del juego'),
            (CAMPOS_JUEGO[juego.type] || []).map(campoJuego)) : null) : null,

        tab === 'hardware' ? h('div', { className: 'fp-form' },
          h(Campo, { label: 'Cámara habilitada', type: 'boolean', value: m.hardware.camaraHabilitada, onChange: (v) => patch({ hardware: { camaraHabilitada: v } }) }),
          h(Campo, { label: 'ID de cámara (vacío = la predeterminada)', value: m.hardware.camaraDeviceId, help: 'Usa el Diagnóstico para elegirla de una lista.', onChange: (v) => patch({ hardware: { camaraDeviceId: v } }) }),
          h(Campo, { label: 'Imagen en espejo', type: 'boolean', value: m.hardware.espejo, onChange: (v) => patch({ hardware: { espejo: v } }) }),
          h(Campo, {
            label: 'Motor de pose', type: 'select', value: m.hardware.motorPose,
            options: [{ value: 'auto', label: 'Automático' }, { value: 'mediapipe', label: 'MediaPipe' }, { value: 'demo', label: 'Simulador (sin cámara)' }, { value: 'ninguno', label: 'Desactivado' }],
            onChange: (v) => patch({ hardware: { motorPose: v } }),
          }),
          h(Campo, { label: 'URL del módulo de pose', value: m.hardware.poseModuleUrl, help: 'Puede apuntar a un asset local del tótem para funcionar sin internet.', onChange: (v) => patch({ hardware: { poseModuleUrl: v } }) }),
          h(Campo, { label: 'URL del runtime WASM', value: m.hardware.poseWasmUrl, onChange: (v) => patch({ hardware: { poseWasmUrl: v } }) }),
          h(Campo, { label: 'URL del modelo (.task)', value: m.hardware.poseModelUrl, onChange: (v) => patch({ hardware: { poseModelUrl: v } }) }),
          h(Campo, { label: 'Mostrar aviso de cámara activa', type: 'boolean', value: m.hardware.avisoCamara, onChange: (v) => patch({ hardware: { avisoCamara: v } }) }),
          h(Campo, { label: 'Aceptar impactos de tracker externo', type: 'boolean', value: m.hardware.trackerExterno, help: 'window.postMessage({type:"funplai:impact", x, y}) con x,y entre 0 y 1.', onChange: (v) => patch({ hardware: { trackerExterno: v } }) })) : null,

        tab === 'datos' ? h('div', { className: 'fp-form' },
          h('p', { className: 'fp-lead' }, 'Exporta la configuración para clonar este montaje a otro tótem, o pega una configuración recibida.'),
          h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'soft', onClick: () => setJson(JSON.stringify({ branding: m.branding, hardware: m.hardware, games: m.games, choreos: m.choreos }, null, 2)) }, 'Exportar configuración'),
            h(Boton, {
              onClick: () => {
                try {
                  const data = JSON.parse(json);
                  hydrate(data);
                  scheduleSave();
                  notify('success', 'Configuración importada.');
                } catch (e) { notify('error', 'JSON inválido: ' + s(e && e.message)); }
              },
            }, 'Importar del cuadro'),
            h(Boton, {
              variant: 'danger',
              onClick: () => { if (confirm('¿Restaurar la configuración de fábrica? Se conserva el ranking.')) { commit(merge(clone(DEFAULT_MODEL), { scores: m.scores })); notify('info', 'Configuración restaurada.'); } },
            }, 'Restaurar de fábrica')),
          h(Campo, { label: 'Configuración JSON', type: 'textarea', rows: 16, value: json, onChange: setJson })) : null));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 17. Componente raíz
  // ══════════════════════════════════════════════════════════════════════

  const RENDERERS = {
    burro: JuegoBurro, baile: JuegoBaile, laser: JuegoLaser,
    rayuela: JuegoRayuela, boxeo: JuegoBoxeo, gato: JuegoGato,
  };

  function Component() {
    const [m, setM] = useState(model);
    const [r, setR] = useState(route);
    const rootRef = useRef(null);
    const idleRef = useRef(nowMs());

    useEffect(() => {
      listeners.add(setM);
      routeListeners.add(setR);
      return () => { listeners.delete(setM); routeListeners.delete(setR); };
    }, []);

    // Kiosco: volver a la portada tras inactividad.
    useEffect(() => {
      const secs = num(m.branding.idleSeconds, 0);
      if (!secs) return undefined;
      const tocar = () => { idleRef.current = nowMs(); };
      const el = rootRef.current;
      if (el) { el.addEventListener('pointerdown', tocar); el.addEventListener('keydown', tocar); }
      const iv = setInterval(() => {
        if (route.screen !== 'home' && nowMs() - idleRef.current > secs * 1000) go('home');
      }, 2000);
      timers.add(iv);
      return () => {
        clearInterval(iv); timers.delete(iv);
        if (el) { el.removeEventListener('pointerdown', tocar); el.removeEventListener('keydown', tocar); }
      };
    }, [m.branding.idleSeconds, r.screen]);

    const t = themeOf(m);
    let vista;
    if (r.screen === 'editor') vista = h(Editor, { model: m });
    else if (r.screen === 'ranking') vista = h(Ranking, { model: m });
    else if (r.screen === 'diagnostico') vista = h(Diagnostico, { model: m });
    else if (r.screen === 'juego') {
      const g = m.games.find((x) => x.id === r.gameId);
      const R = g ? RENDERERS[g.type] : null;
      vista = R ? h(R, { key: g.id, game: g, onExit: () => go('home') })
        : h('div', { className: 'fp-panel' },
            h('div', { className: 'fp-panel-body' },
              h('p', { className: 'fp-empty' }, 'Ese juego ya no existe.'),
              h(Boton, { onClick: () => go('home') }, 'Volver')));
    } else vista = h(Portada, { model: m, theme: t });

    return h('div', { className: 'kimos-funplai', ref: rootRef, style: cssVars(t) },
      ready ? vista : h('div', { className: 'fp-loading' }, h(Escarapela, { w: 90 }), h('p', null, 'Cargando FunPlai…')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 18. Control por agente
  // ══════════════════════════════════════════════════════════════════════

  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: model.branding.appName || 'Kimos FunPlai',
      description: 'App de juegos para tótem. Puede abrir juegos, cambiar temática y textos, ajustar parámetros de cada juego y consultar el ranking.',
      tools: [
        { name: 'LISTAR_JUEGOS', description: 'Lista los juegos configurados con su id, tipo y estado.', inputSchema: { type: 'object', properties: {} } },
        { name: 'ABRIR_JUEGO', description: 'Abre un juego en la pantalla del tótem.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id del juego' } }, required: ['id'] } },
        { name: 'IR_A', description: 'Navega a una pantalla: home, editor, ranking o diagnostico.', inputSchema: { type: 'object', properties: { pantalla: { type: 'string' } }, required: ['pantalla'] } },
        { name: 'CAMBIAR_TEMA', description: 'Cambia la temática visual (fiestas-patrias, neutro, verano).', inputSchema: { type: 'object', properties: { tema: { type: 'string' } }, required: ['tema'] } },
        { name: 'ACTUALIZAR_MARCA', description: 'Cambia nombre, bajada, títulos o colores de la portada.', inputSchema: { type: 'object', properties: { appName: { type: 'string' }, tagline: { type: 'string' }, heroTitle: { type: 'string' }, heroSubtitle: { type: 'string' }, accent: { type: 'string' }, accent2: { type: 'string' }, logo: { type: 'string' } } } },
        { name: 'CONFIGURAR_JUEGO', description: 'Cambia nombre, estado o parámetros de un juego.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, enabled: { type: 'boolean' }, config: { type: 'object', description: 'Parámetros propios del juego' } }, required: ['id'] } },
        { name: 'VER_RANKING', description: 'Devuelve los mejores puntajes guardados.', inputSchema: { type: 'object', properties: { juego: { type: 'string' }, limite: { type: 'number' } } } },
        { name: 'BORRAR_RANKING', description: 'Vacía el ranking del tótem.', inputSchema: { type: 'object', properties: {} } },
      ],
      getSnapshot: () => ({
        pantalla: route.screen + (route.gameId ? ':' + route.gameId : ''),
        marca: model.branding,
        tema: model.branding.theme,
        hardware: { camaraHabilitada: model.hardware.camaraHabilitada, motorPose: model.hardware.motorPose },
        juegos: model.games.map((g) => ({ id: g.id, tipo: g.type, nombre: g.name, activo: g.enabled !== false, orden: g.order, config: g.config })),
        ranking: (model.scores || []).slice(0, 10).map((r) => ({ jugador: r.jugador, juego: r.juego, puntaje: r.puntaje })),
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          if (type === 'LISTAR_JUEGOS') {
            return { success: true, message: model.games.map((g) => g.id + ' (' + g.type + ', ' + (g.enabled !== false ? 'activo' : 'oculto') + '): ' + g.name).join(' · ') };
          }
          if (type === 'ABRIR_JUEGO') {
            const g = model.games.find((x) => x.id === s(p.id));
            if (!g) return { success: false, error: 'No existe el juego "' + s(p.id) + '".' };
            if (g.enabled === false) return { success: false, error: 'El juego "' + g.name + '" está desactivado.' };
            go('juego', g.id);
            return { success: true, message: 'Abriendo "' + g.name + '" en el tótem.' };
          }
          if (type === 'IR_A') {
            const pantalla = s(p.pantalla).toLowerCase();
            if (['home', 'editor', 'ranking', 'diagnostico'].indexOf(pantalla) < 0) {
              return { success: false, error: 'Pantalla no válida: usa home, editor, ranking o diagnostico.' };
            }
            go(pantalla);
            return { success: true, message: 'Pantalla: ' + pantalla + '.' };
          }
          if (type === 'CAMBIAR_TEMA') {
            const tema = s(p.tema);
            if (!THEMES[tema]) return { success: false, error: 'Temas disponibles: ' + Object.keys(THEMES).join(', ') + '.' };
            patch({ branding: { theme: tema } });
            return { success: true, message: 'Temática cambiada a ' + THEMES[tema].name + '.' };
          }
          if (type === 'ACTUALIZAR_MARCA') {
            const b = {};
            for (const k of ['appName', 'tagline', 'heroTitle', 'heroSubtitle', 'accent', 'accent2', 'logo']) {
              if (p[k] != null && s(p[k]).trim()) b[k] = s(p[k]).slice(0, 120);
            }
            if (!Object.keys(b).length) return { success: false, error: 'Nada que cambiar.' };
            patch({ branding: b });
            if (b.appName) { try { shell.window && shell.window.setTitle && shell.window.setTitle(b.appName); } catch (e) { /* noop */ } }
            return { success: true, message: 'Marca actualizada: ' + Object.keys(b).join(', ') + '.' };
          }
          if (type === 'CONFIGURAR_JUEGO') {
            const g = model.games.find((x) => x.id === s(p.id));
            if (!g) return { success: false, error: 'No existe el juego "' + s(p.id) + '".' };
            const cambio = {};
            if (p.name != null && s(p.name).trim()) cambio.name = s(p.name).slice(0, 80);
            if (typeof p.enabled === 'boolean') cambio.enabled = p.enabled;
            if (isObj(p.config)) {
              // Solo se aceptan claves que el juego realmente conoce.
              const validas = (CAMPOS_JUEGO[g.type] || []).map((f) => f.key);
              const cfg = {};
              for (const k of Object.keys(p.config)) if (validas.indexOf(k) >= 0) cfg[k] = p.config[k];
              if (Object.keys(cfg).length) cambio.config = cfg;
            }
            if (!Object.keys(cambio).length) return { success: false, error: 'Sin cambios válidos. Parámetros de "' + g.type + '": ' + (CAMPOS_JUEGO[g.type] || []).map((f) => f.key).join(', ') + '.' };
            updateGame(g.id, cambio);
            return { success: true, message: 'Juego "' + g.name + '" actualizado.' };
          }
          if (type === 'VER_RANKING') {
            const lim = clamp(num(p.limite, 10), 1, 40);
            const rows = (model.scores || []).filter((r) => !p.juego || r.juego === s(p.juego))
              .slice().sort((a, b) => num(b.puntaje, 0) - num(a.puntaje, 0)).slice(0, lim);
            if (!rows.length) return { success: true, message: 'Todavía no hay puntajes guardados.' };
            return { success: true, message: rows.map((r, i) => (i + 1) + '. ' + (r.jugador || 'Anónimo') + ' — ' + r.puntaje + ' (' + r.juego + ')').join(' · ') };
          }
          if (type === 'BORRAR_RANKING') {
            commit(merge(model, { scores: [] }));
            return { success: true, message: 'Ranking vaciado.' };
          }
          return { success: false, error: 'Acción no soportada: ' + type };
        } catch (e) {
          return { success: false, error: s(e && e.message ? e.message : e) };
        }
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 19. Salida
  // ══════════════════════════════════════════════════════════════════════

  return {
    Component,
    unmount() {
      for (const t of timers) { clearTimeout(t); clearInterval(t); }
      timers.clear();
      for (const id of rafs) cancelAnimationFrame(id);
      rafs.clear();
      for (const off of teardown) { try { off(); } catch (e) { /* noop */ } }
      teardown.clear();
      listeners.clear();
      routeListeners.clear();
      try { unregisterAgent && unregisterAgent(); } catch (e) { /* noop */ }
    },
  };
}
