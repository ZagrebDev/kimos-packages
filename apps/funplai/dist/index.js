/**
 * Kimos FunPlai — juegos interactivos para tótem (bundle AppShell v1).
 *
 * App instalable de KIMOS (contrato `export default mount(shell)`), pensada
 * para una pantalla táctil vertical de tótem, con juegos que combinan:
 *   · Pantalla táctil pura        → "Coloca la cola al burro", "Lanza y acierta".
 *   · Cámara + detección de pose  → "Prueba de baile" (y lanzamiento por gesto).
 *   · Puntero absoluto / lightgun → "LaserGun" (tiro al blanco con puntero absoluto).
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

  // ── Color: la base del sombreado por facetas ──────────────────────────
  // El look de las consolas 3D de fines de los noventa no viene de degradados suaves sino
  // de caras planas con saltos duros de luz. Para eso hace falta poder subir
  // y bajar el brillo de un color manteniendo su tono, así que se pasa por HSL.

  function hexRgb(hex) {
    let x = s(hex).trim().replace('#', '');
    if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
    if (!/^[0-9a-fA-F]{6}$/.test(x)) return { r: 128, g: 128, b: 128 };
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16) };
  }

  function rgbHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    if (!d) return { h: 0, s: 0, l };
    const sa = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let hh;
    if (mx === r) hh = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    return { h: hh * 60, s: sa, l };
  }

  function hslHex(hh, sa, l) {
    hh = ((hh % 360) + 360) % 360; sa = clamp(sa, 0, 1); l = clamp(l, 0, 1);
    const c = (1 - Math.abs(2 * l - 1)) * sa;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (hh < 60) { r = c; g = x; } else if (hh < 120) { r = x; g = c; }
    else if (hh < 180) { g = c; b = x; } else if (hh < 240) { g = x; b = c; }
    else if (hh < 300) { r = x; b = c; } else { r = c; b = x; }
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
  }

  /** Aclara/oscurece manteniendo el tono. `d` en puntos de luminosidad. */
  function tono(hex, d, satD) {
    const c = hexRgb(hex), q = rgbHsl(c.r, c.g, c.b);
    return hslHex(q.h, q.s + num(satD, 0), q.l + d);
  }

  /**
   * Paleta de facetas de un color base: las cuatro caras que usa el motor.
   * `luz` = cara iluminada, `base` = frontal, `sombra` = lateral en sombra,
   * `linea` = contorno duro, `brillo` = reflejo especular quemado.
   * Se satura al aclarar y se desatura al oscurecer, que es lo que hace que
   * un objeto plano parezca un volumen y no una mancha.
   */
  function facetas(hex) {
    return {
      brillo: tono(hex, 0.30, 0.06),
      luz: tono(hex, 0.16, 0.08),
      base: hex,
      sombra: tono(hex, -0.14, -0.04),
      fondo: tono(hex, -0.26, -0.10),
      linea: tono(hex, -0.42, -0.06),
    };
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

  // Cada tema trae, además de sus colores de marca, la paleta de ESCENA que
  // usa el motor de arte: cielo, suelo y cerros. Es lo que hace que cada juego
  // se vea como un nivel del mismo juego y no como nueve pantallas distintas.
  // ══════════════════════════════════════════════════════════════════════
  // 2.b Packs temáticos
  // ══════════════════════════════════════════════════════════════════════
  //
  // La app decía que la temática era un parámetro, pero mientras hubo un solo
  // pack eso era teoría — y Fiestas Patrias es una semana al año.
  //
  // Un pack cambia CÓMO SE VE y CÓMO SE LLAMAN las cosas. No cambia el montaje
  // (cámara, espacio, hardware), ni los datos (ranking, contactos, métricas),
  // ni las reglas de un juego. Esa frontera es la que hace que aplicar un pack
  // en pleno evento sea seguro: se puede cambiar la decoración a mitad de la
  // jornada sin tocar una sola partida guardada.
  //
  // Lo que un pack NO puede hacer, dicho para que nadie lo descubra el día del
  // evento: no redibuja el arte. Los blancos del LaserGun, los adornos y los
  // avatares son SVG escritos en el bundle; el pack los renombra y los
  // recolorea, no los reemplaza. Ver docs/PERSONALIZACION.md.

  const PACK_FORMATO = 'kimos-funplai-pack';
  const PACK_VERSION = 1;

  const PACKS = {
    'fiestas-patrias': {
      formato: PACK_FORMATO, version: PACK_VERSION,
      id: 'fiestas-patrias',
      nombre: 'Fiestas Patrias de Chile',
      descripcion: 'El pack dieciochero: banderines, ramada y comida de fonda.',
      tema: {
        accent: '#E4322B', accent2: '#0B4FD8', bg: '#152A52', bg2: '#0A1730',
        surface: '#FFF6E2', ink: '#161E30', decor: 'banderines', emoji: '🇨🇱',
        decorColores: ['#D52B1E', '#0039A6'], decorEstrella: true,
        cielo: '#2C9BE0', cieloBajo: '#CFF0FF', suelo: '#4FA83F', cerros: '#4C6FA8', sol: '#FFE9A8',
      },
      branding: {
        appName: 'Kimos FunPlai', tagline: 'Juegos para el tótem', logo: '🎉',
        heroTitle: '¡Bienvenido a la fonda!', heroSubtitle: 'Elige un juego y a jugar',
      },
      juegos: {},
      blancos: { volantin: 'Volantín', empanada: 'Empanada', choripan: 'Choripán', aji: 'Ají rojo', schop: 'Schop' },
    },
    'verano': {
      formato: PACK_FORMATO, version: PACK_VERSION,
      id: 'verano',
      nombre: 'Verano / playa',
      descripcion: 'Atardecer en la costa: arena caliente y cielo naranja.',
      tema: {
        accent: '#FF7A1A', accent2: '#00B4D8', bg: '#123A4C', bg2: '#07202C',
        surface: '#FFF6E8', ink: '#123', decor: 'banderines', emoji: '🏖️',
        decorColores: ['#FF7A1A', '#00B4D8', '#FFD166'], decorEstrella: false,
        cielo: '#FF9E45', cieloBajo: '#FFE7C2', suelo: '#E8C77A', cerros: '#C4643C', sol: '#FFF3C4',
      },
      branding: {
        appName: 'Kimos FunPlai', tagline: 'Juegos de verano', logo: '🏖️',
        heroTitle: '¡A la playa!', heroSubtitle: 'Elige un juego y a jugar',
      },
      juegos: {
        laser: { name: 'Tiro al blanco playero', blurb: 'Dispara a sandías, helados y quitasoles. Esquiva los erizos y las medusas.' },
        rayuela: { name: 'Rayuela en la arena' },
      },
      blancos: { volantin: 'Quitasol', empanada: 'Sandía', choripan: 'Helado', aji: 'Erizo', schop: 'Medusa' },
    },
    'navidad': {
      formato: PACK_FORMATO, version: PACK_VERSION,
      id: 'navidad',
      nombre: 'Navidad',
      descripcion: 'Guirnalda roja y verde, noche fría y luces.',
      tema: {
        accent: '#C62828', accent2: '#1B7F4B', bg: '#0E2338', bg2: '#061523',
        surface: '#FFF8EE', ink: '#14202C', decor: 'banderines', emoji: '🎄',
        decorColores: ['#C62828', '#1B7F4B', '#E8C86A'], decorEstrella: true,
        cielo: '#123A63', cieloBajo: '#9FC5E8', suelo: '#E8EEF5', cerros: '#2E4A6B', sol: '#FFF1C9',
      },
      branding: {
        appName: 'Kimos FunPlai', tagline: 'Juegos de Navidad', logo: '🎄',
        heroTitle: '¡Feliz Navidad!', heroSubtitle: 'Elige un juego y a jugar',
      },
      juegos: {
        laser: { name: 'Tiro al blanco navideño', blurb: 'Dispara a estrellas, panes de pascua y bastones de caramelo. Esquiva el carbón.' },
        burro: { name: 'Ponle la nariz al reno', blurb: 'Arrastra la nariz con el dedo y suéltala en el centro de la mira.' },
      },
      blancos: { volantin: 'Estrella', empanada: 'Pan de pascua', choripan: 'Bastón de caramelo', aji: 'Carbón', schop: 'Calcetín roto' },
    },
    'corporativo': {
      formato: PACK_FORMATO, version: PACK_VERSION,
      id: 'corporativo',
      nombre: 'Neutro corporativo',
      descripcion: 'Base sobria para que una marca ponga sus colores, su logo y sus textos. Es el pack que se copia y se edita, no el que se usa tal cual.',
      tema: {
        accent: '#12C3C9', accent2: '#6C63FF', bg: '#111B2E', bg2: '#080E1A',
        surface: '#F4F7FA', ink: '#16202E', decor: 'ninguno', emoji: '🏢',
        decorColores: ['#12C3C9', '#6C63FF'], decorEstrella: false,
        cielo: '#1E88C7', cieloBajo: '#B9E6F5', suelo: '#2F8E8A', cerros: '#3C5C88', sol: '#EAFBFF',
      },
      branding: {
        appName: 'Kimos FunPlai', tagline: 'Actívate con nosotros', logo: '🏢',
        heroTitle: 'Juega y participa', heroSubtitle: 'Elige un juego y a jugar',
      },
      juegos: {},
      blancos: { volantin: 'Diana', empanada: 'Objetivo', choripan: 'Bonus', aji: 'Penalización', schop: 'Falta' },
    },
  };

  // Campos que un pack puede traer, y de qué tipo. Todo lo que no esté acá se
  // IGNORA en vez de copiarse a ciegas: un pack es un archivo que llega de
  // fuera, y copiar claves desconocidas dentro del modelo es cómo se cuela una
  // configuración de hardware en lo que debería ser una decoración.
  const PACK_COLORES = ['accent', 'accent2', 'bg', 'bg2', 'surface', 'ink', 'cielo', 'cieloBajo', 'suelo', 'cerros', 'sol'];
  const PACK_TEMA_OTROS = ['decor', 'emoji', 'decorColores', 'decorEstrella'];
  const PACK_BRANDING = ['appName', 'tagline', 'logo', 'heroTitle', 'heroSubtitle', 'pieDePagina'];
  const PACK_JUEGO = ['name', 'icon', 'blurb'];
  const PACK_BLANCOS = ['volantin', 'empanada', 'choripan', 'aji', 'schop'];
  const esHex = (v) => typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());

  /**
   * Comprueba un pack antes de aplicarlo. Devuelve `{ ok, errores, avisos, pack }`.
   *
   * Un pack mal formado tiene que fallar ACÁ, con un mensaje que diga qué campo
   * y por qué, y no a mitad del evento con la portada en blanco. Por eso no se
   * confía en nada: ni en el formato, ni en los tipos, ni en que los colores
   * sean colores.
   *
   * La diferencia entre `errores` y `avisos` importa: un error impide aplicar
   * el pack; un aviso dice que algo se ignoró y sigue. Un pack hecho para una
   * versión con un juego que ya no existe debe poder usarse igual.
   */
  function validarPack(obj) {
    const errores = [], avisos = [];
    if (!isObj(obj)) return { ok: false, errores: ['El archivo no es un objeto JSON.'], avisos, pack: null };
    if (s(obj.formato) !== PACK_FORMATO) {
      errores.push('No parece un pack de FunPlai: falta «formato»: "' + PACK_FORMATO + '" (llegó «' + s(obj.formato) + '»).');
    }
    const v = num(obj.version, 0);
    if (!v) errores.push('Falta «version» (debe ser un número).');
    else if (v > PACK_VERSION) {
      errores.push('El pack es de la versión ' + v + ' y esta app entiende hasta la ' + PACK_VERSION +
        '. Actualiza la app en vez de editar el archivo.');
    }
    if (!s(obj.id)) errores.push('Falta «id» (un nombre corto sin espacios, como "navidad").');
    else if (!/^[a-z0-9-]{2,40}$/.test(s(obj.id))) errores.push('El «id» solo admite minúsculas, números y guiones: «' + s(obj.id) + '».');
    if (!s(obj.nombre)) errores.push('Falta «nombre» (el que se ve en el selector).');

    const limpio = {
      formato: PACK_FORMATO, version: PACK_VERSION,
      id: s(obj.id), nombre: s(obj.nombre), descripcion: s(obj.descripcion),
      tema: {}, branding: {}, juegos: {}, blancos: {},
    };

    if (obj.tema != null && !isObj(obj.tema)) errores.push('«tema» tiene que ser un objeto.');
    else if (isObj(obj.tema)) {
      for (const k of PACK_COLORES) {
        if (obj.tema[k] == null) continue;
        if (!esHex(obj.tema[k])) errores.push('«tema.' + k + '» tiene que ser un color hexadecimal como "#1A2B3C" (llegó «' + s(obj.tema[k]) + '»).');
        else limpio.tema[k] = s(obj.tema[k]).trim();
      }
      if (obj.tema.decor != null) {
        if (['banderines', 'ninguno'].indexOf(s(obj.tema.decor)) < 0) {
          errores.push('«tema.decor» solo admite "banderines" o "ninguno" (llegó «' + s(obj.tema.decor) + '»). El arte de los adornos está en el bundle: un pack los recolorea, no los redibuja.');
        } else limpio.tema.decor = s(obj.tema.decor);
      }
      if (obj.tema.emoji != null) limpio.tema.emoji = s(obj.tema.emoji).slice(0, 8);
      if (obj.tema.decorEstrella != null) limpio.tema.decorEstrella = obj.tema.decorEstrella !== false;
      if (obj.tema.decorColores != null) {
        if (!Array.isArray(obj.tema.decorColores)) errores.push('«tema.decorColores» tiene que ser una lista de colores.');
        else {
          const malos = obj.tema.decorColores.filter((c) => !esHex(c));
          if (malos.length) errores.push('«tema.decorColores» tiene ' + malos.length + ' valor(es) que no son colores hexadecimales.');
          else limpio.tema.decorColores = obj.tema.decorColores.slice(0, 8).map((c) => s(c).trim());
        }
      }
      for (const k of Object.keys(obj.tema)) {
        if (PACK_COLORES.indexOf(k) < 0 && PACK_TEMA_OTROS.indexOf(k) < 0) avisos.push('Se ignoró «tema.' + k + '»: no es un campo del formato.');
      }
    }

    if (isObj(obj.branding)) {
      for (const k of PACK_BRANDING) if (obj.branding[k] != null) limpio.branding[k] = s(obj.branding[k]).slice(0, 200);
      for (const k of Object.keys(obj.branding)) {
        if (PACK_BRANDING.indexOf(k) < 0) avisos.push('Se ignoró «branding.' + k + '»: un pack cambia textos y colores, no la configuración del equipo.');
      }
    } else if (obj.branding != null) errores.push('«branding» tiene que ser un objeto.');

    if (isObj(obj.juegos)) {
      for (const id of Object.keys(obj.juegos)) {
        const j = obj.juegos[id];
        if (!isObj(j)) { avisos.push('Se ignoró «juegos.' + id + '»: no es un objeto.'); continue; }
        const dest = {};
        for (const k of PACK_JUEGO) if (j[k] != null) dest[k] = s(j[k]).slice(0, 120);
        for (const k of Object.keys(j)) {
          if (PACK_JUEGO.indexOf(k) < 0) avisos.push('Se ignoró «juegos.' + id + '.' + k + '»: un pack renombra juegos, no cambia sus reglas.');
        }
        if (Object.keys(dest).length) limpio.juegos[id] = dest;
      }
    } else if (obj.juegos != null) errores.push('«juegos» tiene que ser un objeto.');

    if (isObj(obj.blancos)) {
      for (const k of PACK_BLANCOS) if (obj.blancos[k] != null) limpio.blancos[k] = s(obj.blancos[k]).slice(0, 40);
      for (const k of Object.keys(obj.blancos)) {
        if (PACK_BLANCOS.indexOf(k) < 0) avisos.push('Se ignoró «blancos.' + k + '»: los blancos del LaserGun son ' + PACK_BLANCOS.join(', ') + '.');
      }
    } else if (obj.blancos != null) errores.push('«blancos» tiene que ser un objeto.');

    // Secciones de primer nivel que no son del formato. Se descartan igual,
    // pero en silencio no: un pack que trae un bloque «hardware» o «scores» o
    // viene mal hecho o viene con intención, y en los dos casos el operador
    // tiene derecho a enterarse de que se ignoró.
    const RAIZ_OK = ['formato', 'version', 'id', 'nombre', 'descripcion', 'tema', 'branding', 'juegos', 'blancos'];
    for (const k of Object.keys(obj)) {
      if (RAIZ_OK.indexOf(k) < 0) {
        avisos.push('Se ignoró la sección «' + k + '»: un pack solo trae ' + RAIZ_OK.slice(5).join(', ') + '. ' +
          'El montaje y los datos del tótem no se cambian con un archivo de temática.');
      }
    }

    return { ok: !errores.length, errores, avisos, pack: errores.length ? null : limpio };
  }

  /**
   * Aplica un pack al modelo. Solo toca apariencia y textos: NO toca el
   * montaje (cámara, espacio, hardware) ni los datos (ranking, contactos,
   * métricas, concurso). Por eso se puede cambiar la decoración a mitad de una
   * jornada sin arriesgar una sola partida guardada.
   */
  function aplicarPack(entrada) {
    const crudo = typeof entrada === 'string' ? PACKS[entrada] : entrada;
    const r = validarPack(crudo);
    if (!r.ok) return r;
    const p = r.pack;
    const parche = { branding: Object.assign({}, p.branding) };
    // El tema se guarda entero en el modelo para que un pack importado —que no
    // está en PACKS— también pinte. `themeOf` lo lee de acá.
    if (Object.keys(p.tema).length) {
      parche.branding.theme = p.id;
      parche.branding.temaPack = Object.assign({ name: p.nombre }, p.tema);
    }
    if (Object.keys(p.blancos).length) parche.blancos = p.blancos;
    let games = model.games;
    if (Object.keys(p.juegos).length) {
      games = (model.games || []).map((g) => (p.juegos[g.id] ? merge(g, p.juegos[g.id]) : g));
    }
    commit(merge(model, Object.assign(parche, games === model.games ? {} : { games })));
    return r;
  }

  /** El aspecto actual, empaquetado: así una marca guarda el suyo y lo reusa. */
  function packDelModelo(m, id, nombre) {
    const t = themeOf(m);
    const tema = {};
    for (const k of PACK_COLORES) if (t[k]) tema[k] = t[k];
    for (const k of PACK_TEMA_OTROS) if (t[k] != null) tema[k] = t[k];
    const branding = {};
    for (const k of PACK_BRANDING) if (s(m.branding[k])) branding[k] = m.branding[k];
    const juegos = {};
    for (const g of m.games || []) juegos[g.id] = { name: g.name, icon: g.icon, blurb: g.blurb };
    return {
      formato: PACK_FORMATO, version: PACK_VERSION,
      id: s(id) || 'mi-pack', nombre: s(nombre) || s(m.branding.appName) || 'Mi pack',
      descripcion: 'Exportado desde el tótem el ' + new Date().toLocaleDateString() + '.',
      tema, branding, juegos,
      blancos: Object.assign({}, m.blancos || {}),
    };
  }

  /** Los temas visuales salen de los packs: una sola fuente, sin copias. */
  const THEMES = Object.keys(PACKS).reduce((acc, k) => {
    acc[k] = Object.assign({ name: PACKS[k].nombre }, PACKS[k].tema);
    return acc;
  }, {
    // Se conserva el id histórico 'neutro' para no romper instancias ya
    // guardadas que lo tengan elegido: apunta al pack corporativo.
    'neutro': Object.assign({ name: 'Neutro Kimos' }, PACKS.corporativo.tema),
  });


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
        // Entrada alternativa (Fase 8): la misma coreografía por toque o
        // teclado. Viene encendida porque apagarla deja el juego sin más
        // entrada que la cámara, y eso es justo lo que no puede pasar.
        modoRitmico: true,
        ritmoLatenciaMs: 0,      // retardo del panel táctil, medido en el montaje
        ritmoUnCarril: false,    // un solo botón: acceso por pulsador único
        ritmoSonido: true,       // clic de compás sintetizado, sin archivos
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
        distanciaMetros: 2.2,    // zona única: la misma marca para todos los juegos
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
        distanciaMetros: 2.2,
      },
    },
    {
      id: 'gol', type: 'gol', enabled: true, order: 7,
      name: 'Mete gol', icon: '⚽',
      blurb: 'Patea al arco: la cámara mide tu pierna y el arquero se mueve para atajar.',
      config: {
        tiros: 5,
        dificultad: 'media',       // facil | media | dificil (reflejos del arquero)
        fuerzaReferencia: 3.0,     // patada que llega con potencia media
        sensibilidadLateral: 0.55,
        dispersion: 0.08,
        distanciaMetros: 2.2,      // zona única (aquí sí hacen falta los pies)
      },
    },
    {
      id: 'esquiva2d', type: 'esquiva2d', enabled: true, order: 8,
      name: 'Esquiva y gana', icon: '🏃',
      blurb: 'Carrera lateral de obstáculos: salta y agáchate para no chocar.',
      config: {
        velocidad: 0.42,
        aceleracion: 0.02,
        cadaSegundos: 1.6,
        vidas: 3,
        metaPuntos: 900,
      },
    },
    {
      id: 'esquiva3d', type: 'esquiva3d', enabled: true, order: 9,
      name: 'Esquiva y gana 3D', icon: '🕹️',
      blurb: 'Los obstáculos vienen de frente y tu cuerpo es el contorno verde en pantalla.',
      config: {
        velocidad: 0.40,
        aceleracion: 0.02,
        cadaSegundos: 1.8,
        vidas: 3,
        metaPuntos: 900,
      },
    },
    {
      id: 'vuelo', type: 'vuelo', enabled: true, order: 10,
      name: 'Alas de cóndor', icon: '🦅',
      blurb: 'Mueve los brazos como alas para volar, planea y come frutas en el aire.',
      config: {
        largoCircuito: 60,       // segundos de circuito
        velocidad: 0.42,         // qué tan rápido se acercan las frutas
        gravedad: 0.42,          // cuánto tira hacia abajo (≈1 aleteo/s para sostenerse)
        empujeAleteo: 0.45,      // cuánto sube cada aleteo
        frenoPlaneo: 0.72,       // cuánto frena la caída el planeo
        frutasCada: 1.5,
        energia: 3,
        metaPuntos: 400,
        semilla: 20250918,       // mismo circuito para todos; cámbialo por evento
      },
    },
    {
      id: 'vuelo3d', type: 'vuelo3d', enabled: true, order: 11,
      name: 'Alas de cóndor 3D', icon: '🏔️',
      blurb: 'Vuela hacia el horizonte por la cordillera: inclina el torso para virar, esquiva y come frutas.',
      config: {
        largoCircuito: 60,
        velocidad: 0.40,
        gravedad: 0.42,
        empujeAleteo: 0.45,
        frenoPlaneo: 0.72,
        frutasCada: 1.6,
        obstaculosCada: 2.6,     // cada cuánto aparece un peñón o una araucaria
        puntosEsquivar: 5,
        giroVelocidad: 1.5,      // qué tan rápido responde el viraje
        giroFreno: 3.2,          // cuánto se endereza solo
        energia: 3,
        metaPuntos: 500,
        semilla: 20250918,
      },
    },
    {
      id: 'gato', type: 'gato', enabled: true, order: 6,
      name: 'Gato', icon: '⭕',
      blurb: 'Tres en línea: elige rival (tótem o dos jugadores) y si juegas con cruces o círculos.',
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
      motorPose: 'auto',       // auto | kinect | mediapipe | demo | ninguno
      kinectUrl: 'ws://127.0.0.1:8787',  // puente local del Kinect v2
      // Propiedades del sensor. Todas se aplican de verdad: no son adornos.
      kinectCuerpo: 'cercano', // cercano | primero — con público detrás, importa
      kinectMinCm: 80,         // por debajo, el v2 no sigue el cuerpo
      kinectMaxCm: 400,        // por encima, el esqueleto se vuelve ruido
      kinectSuavizado: 0.35,   // OBSOLETO: ahora suaviza la tubería (filtro/One Euro)
      kinectUsarPiso: true,    // medir alturas contra el plano del piso
      kinectUsarLean: true,    // usar la inclinación que mide el sensor
      kinectUsarManos: true,   // exigir puño / mano abierta en los juegos
      poseModuleUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
      poseWasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      poseModelUrl: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      avisoCamara: true,
      trackerExterno: false,   // escucha window.postMessage({type:'funplai:impact'})
      segmentacion: false,     // separa persona/fondo (cuesta CPU)
      // ── Robustez del pipeline de pose ────────────────────────────────
      // La diferencia entre "webcam barata" y "sensor caro" casi nunca está
      // en el modelo: está acá.
      poseHz: 25,              // a cuántos cuadros por segundo se estima la pose
      poseNumPoses: 1,         // 2–3 solo en equipos capaces y para duelos
      recorteZona: true,       // recortar el cuadro a la zona antes del modelo
      recorteMargen: 0.18,     // aire alrededor de la persona, en fracción
      saltoMaximo: 0.28,       // cuánto puede saltar el centroide entre cuadros
      escalaMaxima: 0.45,      // cuánto puede cambiar la escala entre cuadros
      cuadrosPerdidos: 12,     // tras cuántos rechazos seguidos se pide reencuadre
      filtro: 'oneeuro',       // oneeuro | ema | ninguno
      // Medido, no copiado: el `beta` de los ejemplos del filtro está pensado
      // para coordenadas en píxeles. Aquí los puntos van en 0..1, así que las
      // velocidades son mil veces menores y un beta de 0,012 no abre nada. Con
      // 7 el temblor en reposo apenas sube (±0,0011 frente a ±0,0008) y el
      // retraso en un golpe cae de 0,19 a 0,024 de pantalla.
      oneEuroMinCutoff: 1.0,   // Hz: más bajo = más suave en reposo
      oneEuroBeta: 7,          // cuánto se abre el filtro al moverse rápido
      emaAlfa: 0.35,           // solo si filtro = 'ema'
      huesosRigidos: true,     // descartar cuadros que estiran un segmento
      huesoTolerancia: 0.35,   // cuánto puede variar un largo antes de dudar
      // ── Umbrales de luz ──────────────────────────────────────────────
      // La poca luz es la ÚNICA limitación que no se arregla por software, así
      // que hay que medirla. Estos tres números son la línea que separa "sirve"
      // de "no sirve", y quedan configurables porque un local se conoce mejor
      // en terreno que desde acá: lo que la app garantiza es la MEDICIÓN.
      luzMinima: 80,           // luma media del sujeto (0–255) para dar la luz por buena
      luzRuidoMax: 4.5,        // ruido temporal tolerable; más = la cámara está subiendo ganancia
      contraluzMax: 60,        // cuánto puede ser el fondo más claro que el sujeto
      // ── Sensor remoto: el teléfono hace de cámara ────────────────────
      // No reemplaza a la webcam local, se suma. El caso simple —una cámara
      // enchufada al equipo, incluidos los drivers de teléfono tipo Iriun—
      // sigue siendo el camino por defecto y no cambia en nada.
      sensorSala: '',          // código de emparejamiento; se genera solo la primera vez
      sensorPuenteUrl: '',     // vacío = mismo host que la página, en sensorPuerto
      sensorPuerto: 8788,
      sensorUrlApp: '',        // vacío = esta misma página; se muestra en el QR
      sensorHz: 24,            // a cuántos cuadros por segundo transmite el teléfono
      sensorLatenciaMax: 180,  // ms de edad de muestra que todavía se juega
      sensorRttMax: 100,       // ms de ida y vuelta razonables en una LAN
    },
    // Volumen de juego declarado, en centímetros. Es lo que permite pasar de
    // píxeles a medidas reales (distancia, altura, envergadura).
    espacio: {
      alto: 240,               // alto útil de captura (incluye brazos arriba y saltos)
      ancho: 220,
      profundidad: 250,
      distanciaZona: 220,      // única marca en el piso, para TODOS los juegos
      camaraAltura: 145,       // altura de la cámara sobre el piso (sobre la pantalla)
      camaraInclinacion: 5,    // grados hacia abajo: con la cámara arriba hay que inclinarla
      fovHorizontal: 90,       // campo de visión horizontal del lente
      mostrarGuia: true,       // dibuja la zona en las pantallas de ubicación
      // Estatura de quien se para a calibrar. Sin una referencia real no hay
      // forma de pasar de píxeles a centímetros con una cámara sola.
      estaturaReferencia: 170,
      camaraModelo: 'gran-angular',  // perfil del catálogo (ver CAMARAS)
      seguimiento: 'digital',  // ninguno | digital | mecanico (PTZ con gimbal)
    },
    games: DEFAULT_GAMES,
    choreos: CHOREOS,
    scores: [],                // resultados guardados (ranking del tótem)
    // Un puntaje perdido en una feria con premio no es un problema de
    // almacenamiento, es un problema de confianza. Por eso el tope de filas es
    // una RED DE SEGURIDAD y no un límite de trabajo: la medición sobre la
    // persistencia real da ~28.000 filas antes de que reviente la cuota, y una
    // jornada intensa a 60 partidas por hora durante diez horas son 600.
    ranking: {
      tope: 5000,              // 0 = sin límite; guarda TODO hasta acá
      mostrar: 60,             // cuántas se listan en pantalla (solo vista)
      aviso: null,             // { at, motivo, filas } si algo se truncó o no se pudo guardar
    },
    // Cuánto ocupa el tótem cada persona. Con fila de 40 esperando, esto es lo
    // que decide si se atienden 60 o 25 por hora: es una medida comercial, y
    // por eso se guarda entre sesiones en vez de calcularse de memoria.
    ciclos: {
      juegos: {},              // { [idJuego]: { muestras: [{ ms, partidas, at }] } }
      relevos: [],             // ms entre que uno se va y el siguiente empieza
    },
    // Nombres de los blancos del LaserGun que puso el pack activo. Los puntos
    // y el arte no se tocan: un pack renombra, no cambia las reglas.
    blancos: {},
    // ── Métricas de activación (VERDE del semáforo) ──────────────────
    // Todo lo de acá es AGREGADO y no distingue a nadie: son contadores de la
    // jornada, no un registro de personas. Es lo que el auspiciador compra, y
    // se puede juntar sin pedirle nada a nadie.
    //
    // Lo que NO está acá, y no va a estar: edad o género por la cámara,
    // emociones, y reconocer a la misma persona entre partidas. Ver el semáforo
    // completo en docs/PRIVACIDAD.md.
    metricas: {
      desde: '',               // cuándo se empezó a contar esta activación
      juegos: {},              // { [id]: { aperturas, partidas, abandonos, repeticiones, suma, n, max } }
      horas: {},               // { '14': 37 } — afluencia por hora del día
      contactos: { ofrecidos: 0, aceptados: 0 },
    },
    // Datos de contacto: AMARILLO. Nada de esto existe sin que la persona lo
    // pida casilla por casilla, después de jugar.
    contacto: {
      activo: false,
      responsable: '',         // quién responde por estos datos (la marca, no KIMOS)
      conservacion: '',        // cuánto tiempo se guardan, en texto claro
      pedirCorreo: true,
      pedirTelefono: false,
      pedirEdad: false,
      pedirFoto: false,        // consentimiento SEPARADO, por si se comparte imagen
      urlPuntaje: '',          // plantilla del QR compartible; {puntaje} {juego}
      registros: [],           // { id, at, nombre, correo, telefono, edad, acepto: {}, textos: {} }
    },
    // Cuando el juego reparte un premio deja de ser un juego. Apagado por
    // defecto: una feria sin premio no necesita nada de esto, y encenderlo
    // cambia lo que el jugador puede hacer, así que es decisión del operador.
    concurso: {
      activo: false,
      nombre: '',              // aparece en las bases y en la exportación
      premio: '',
      intentosPorPersona: 0,   // 0 = sin tope
      desde: '',               // ISO; vacío = sin ventana de inicio
      hasta: '',
      cerrado: false,          // una vez cerrado, el ranking no admite más filas
      cerradoAt: '',
      // Umbrales del vigilante. Se pueden aflojar para un montaje con poco
      // espacio, pero quedan escritos y salen en las bases.
      toleranciaDistancia: 45, // cm que puede moverse de donde se colocó
      giroTolerancia: 0.8,     // fracción del ancho de hombros de referencia
      marcarDesde: 0.1,        // >10% de cuadros fuera → partida marcada
      invalidarDesde: 0.35,    // >35% → no compite por el premio
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // 3. Estado del closure (una copia por ventana) + persistencia
  // ══════════════════════════════════════════════════════════════════════

  let model = clone(DEFAULT_MODEL);
  let ready = false;
  const listeners = new Set();
  const emit = () => { for (const l of listeners) l(model); };

  let saveTimer = null;
  /**
   * Un guardado que falla y nadie se entera es la peor forma de perder datos:
   * el operador sigue trabajando y los puntajes desaparecen al recargar. Si el
   * host rechaza el guardado —cuota llena, error de plataforma— se avisa y se
   * deja constancia en el ranking para que se pueda exportar a mano.
   */
  function fallaAlGuardar(e) {
    const motivo = s(e && e.message ? e.message : e) || 'el host rechazó el guardado';
    notify('error', 'No se pudo guardar: ' + motivo + '. Exporta el ranking antes de cerrar.');
    model = merge(model, { ranking: { aviso: { at: new Date().toISOString(), motivo: 'guardado', detalle: motivo } } });
    emit();
  }

  function scheduleSave() {
    if (!shell.app || !shell.app.instanceId) return;   // singleton: sin persistencia
    if (saveTimer) clrT(saveTimer);
    saveTimer = setT(() => {
      saveTimer = null;
      try {
        Promise.resolve(shell.saveData({ funplai: model })).catch(fallaAlGuardar);
      } catch (e) { fallaAlGuardar(e); }
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

  /** El ranking como CSV, que es lo que abre cualquiera sin explicaciones. */
  /**
   * El ranking a CSV, con la ficha de auditoría de cada partida.
   *
   * Las columnas nuevas van AL FINAL a propósito: una planilla que alguien ya
   * tenía armada sobre las seis primeras sigue funcionando igual. Y van todas,
   * no solo en modo concurso: el día que alguien reclame, el archivo exportado
   * ya tiene que traer con qué responderle.
   */
  function rankingCSV(filas) {
    const esc = (v) => '"' + s(v).replace(/"/g, '""') + '"';
    const cab = 'fecha,jugador,juego,puntaje,detalle,id,estado,fuera_pct,motivo,sesion,version,motor';
    return [cab].concat((filas || []).map((r) => {
      const a = r.auditoria || {};
      return [r.at, r.jugador, r.juego, r.puntaje, r.detalle, r.id,
        a.estado || '', a.fueraPct == null ? '' : a.fueraPct, a.motivo || '',
        a.sesion || '', a.version || '', a.motor || ''].map(esc).join(',');
    })).join('\n');
  }

  /**
   * Intenta bajar un archivo. En un `.kapp` el visor puede correr en un marco
   * que bloquea las descargas, así que esto NO se da por hecho: devuelve si
   * funcionó, y quien llama tiene que dejar el contenido también a la vista.
   */
  function descargar(nombre, texto, tipo) {
    try {
      const blob = new Blob([texto], { type: (tipo || 'text/csv') + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setT(() => { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } }, 4000);
      return true;
    } catch (e) { return false; }
  }

  /**
   * Filas apartadas por el tope, ACUMULADAS. Si cada desborde pisara al
   * anterior, una jornada larga dejaría al operador con doscientos archivos de
   * una fila cada uno y un aviso que solo recuerda el último: aquí se juntan
   * todas y el CSV en pantalla crece.
   */
  let apartadas = [];
  let respaldoRanking = null;
  const tomarRespaldo = () => respaldoRanking;
  const soltarRespaldo = () => { respaldoRanking = null; apartadas = []; };

  function addScore(entry) {
    // Sello de auditoría. Va en TODAS las partidas, haya concurso o no: el día
    // que alguien reclame, el ranking ya tiene que traer con qué responderle,
    // y no se puede sellar hacia atrás.
    const sello = {
      sesion: SESION_ID,
      version: APP_VERSION,
      motor: motorActivo ? motorActivo.tipo : 'ninguno',
      concurso: !!(model.concurso && model.concurso.activo),
    };
    const v = vigilanteActivo ? vigilanteActivo.veredicto() : null;
    if (v) {
      sello.estado = v.estado;
      sello.fueraPct = v.fueraPct;
      sello.muestras = v.muestras;
      sello.marcas = v.marcas;
      if (v.motivo) sello.motivo = v.motivo;
      // Se guarda DÓNDE se colocó, que es una posición en la sala, y NO su
      // ancho de hombros, que es una medida de su cuerpo. La versión anterior
      // guardaba las dos y era antropometría persistida junto a un nombre: el
      // semáforo de la Fase 6 la admite calculada en memoria y descartada, no
      // guardada. Para justificar el veredicto alcanza con la posición y el
      // porcentaje de cuadros fuera, que ya están.
      if (v.referencia) sello.referencia = { distancia: Math.round(v.referencia.distancia) };
    }
    const row = merge({
      id: uid('sc'), at: new Date().toISOString(), jugador: '', juego: '', puntaje: 0, detalle: '',
      auditoria: sello,
    }, entry || {});
    let scores = [row].concat(model.scores || []);
    const tope = Math.max(0, Math.round(num(model.ranking && model.ranking.tope, 5000)));
    let aviso = (model.ranking && model.ranking.aviso) || null;
    if (tope > 0 && scores.length > tope) {
      // Antes de soltar UNA sola fila se deja el respaldo: se intenta bajar el
      // archivo y, funcione o no, el CSV queda a la vista en el ranking.
      const primera = !apartadas.length;
      apartadas = apartadas.concat(scores.slice(tope));
      respaldoRanking = rankingCSV(apartadas);
      // El archivo se baja UNA vez, al primer desborde: a partir de ahí el CSV
      // acumulado queda en pantalla y se re-exporta cuando el operador quiera.
      const bajo = primera
        ? descargar('funplai-ranking-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv', respaldoRanking)
        : (aviso && aviso.descargado) || false;
      aviso = { at: new Date().toISOString(), motivo: 'tope', filas: apartadas.length, descargado: bajo };
      if (primera) {
        notify('warn', 'El ranking llegó al tope de ' + tope + ' partidas. Las que sobran se van apartando' +
          (bajo ? ' (se descargó un archivo)' : '') + ': expórtalas desde 🏆 Ranking.');
      }
      scores = scores.slice(0, tope);
    }
    commit(merge(model, { scores, ranking: { aviso } }));
    try { contarMetrica(row.juego, 'puntaje', row.puntaje); } catch (e) { /* noop */ }
    return row;
  }

  /** Vacía el ranking, dejando SIEMPRE una copia antes. */
  function vaciarRanking(motivo) {
    const filas = model.scores || [];
    if (filas.length) {
      respaldoRanking = rankingCSV(filas);
      descargar('funplai-ranking-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv', respaldoRanking);
    }
    commit(merge(model, {
      scores: [],
      ranking: { aviso: filas.length ? { at: new Date().toISOString(), motivo: motivo || 'vaciado', filas: filas.length } : null },
    }));
    return filas.length;
  }

  // ── Tiempo de ciclo: cuánto ocupa el tótem cada persona ──────────────
  //
  // Lo que se mide es la OCUPACIÓN: desde que alguien entra al juego —donde
  // empieza el posicionamiento— hasta que suelta la pantalla. Incluye
  // colocarse, jugar, ver el puntaje y escribir el nombre, porque todo eso es
  // tiempo en que el siguiente de la fila está esperando.
  //
  // Se descarta lo que no es una partida: un ciclo cerrado por el temporizador
  // de inactividad es alguien que se fue a mitad, y uno de media hora es una
  // pantalla que quedó abierta. Contarlos hundiría la mediana y el operador
  // dimensionaría mal la jornada.
  const CICLO_MAX_MS = 15 * 60 * 1000;
  const CICLO_MIN_MS = 3000;
  const CICLO_MUESTRAS = 40;      // por juego; alcanza de sobra para una mediana
  const RELEVO_MAX_MS = 5 * 60 * 1000;

  let cicloActual = null;         // { juego, t0, partidas }
  let cicloFin = 0;               // cuándo terminó el anterior, para el relevo
  let cicloMotivo = '';           // lo escribe el kiosco antes de irse por inactividad

  /** El resultado apareció en pantalla: eso es una partida jugada. */
  function contarPartida() {
    if (!cicloActual) return;
    cicloActual.partidas++;
    try { contarMetrica(cicloActual.juego, 'partidas'); } catch (e) { /* noop */ }
  }

  /** Marca que la próxima salida NO la decidió la persona. */
  function salidaPorInactividad() { cicloMotivo = 'inactividad'; }

  function abrirCiclo(gameId) {
    const t = nowMs();
    let relevos = (model.ciclos && model.ciclos.relevos) || [];
    if (cicloFin) {
      const hueco = t - cicloFin;
      // Un relevo de horas es la feria cerrada, no un cambio de jugador.
      if (hueco > 0 && hueco <= RELEVO_MAX_MS) relevos = relevos.concat([Math.round(hueco)]).slice(-CICLO_MUESTRAS);
    }
    cicloActual = { juego: s(gameId), t0: t, partidas: 0 };
    try { contarMetrica(gameId, 'aperturas'); } catch (e) { /* una métrica no puede tumbar un juego */ }
    // Un vigilante por partida. Solo si hay premio de por medio: en una feria
    // sin concurso, medir a la gente para nada sería trabajo y datos de más.
    vigilanteActivo = model.concurso && model.concurso.activo
      ? vigilanteDePartida(model.espacio, model.concurso)
      : null;
    if (relevos !== (model.ciclos && model.ciclos.relevos)) commit(merge(model, { ciclos: { relevos } }));
  }

  function cerrarCiclo() {
    const c = cicloActual;
    const motivo = cicloMotivo || 'salida';
    cicloMotivo = '';
    cicloActual = null;
    if (!c) return null;
    const t = nowMs();
    cicloFin = t;
    const ms = Math.round(t - c.t0);
    try {
      // Abandono: se paró delante, abrió el juego y se fue sin terminar una
      // partida. Es la métrica que dice si un juego es demasiado largo o
      // demasiado difícil para una feria, y no necesita saber quién era.
      if (!c.partidas) contarMetrica(c.juego, 'abandonos');
      else if (c.partidas > 1) contarMetrica(c.juego, 'repeticiones', c.partidas - 1);
    } catch (e) { /* noop */ }
    if (motivo === 'inactividad' || ms < CICLO_MIN_MS || ms > CICLO_MAX_MS) return null;
    const juegos = Object.assign({}, (model.ciclos && model.ciclos.juegos) || {});
    const prev = (juegos[c.juego] && juegos[c.juego].muestras) || [];
    juegos[c.juego] = { muestras: prev.concat([{ ms, partidas: c.partidas, at: new Date().toISOString() }]).slice(-CICLO_MUESTRAS) };
    commit(merge(model, { ciclos: { juegos } }));
    return { juego: c.juego, ms, partidas: c.partidas };
  }

  const mediana = (arr) => {
    const v = (arr || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
  };

  /**
   * Lo que el operador necesita saber: cuánta gente atiende por hora.
   *
   * Se suma el relevo porque el tótem no está libre en el instante en que uno
   * se va: alguien tiene que acercarse y colocarse. Sin ese sumando el número
   * sale optimista justo el día que hay fila.
   */
  function resumenDeCiclos(m) {
    const c = (m && m.ciclos) || { juegos: {}, relevos: [] };
    const relevo = mediana(c.relevos) || 0;
    const juegos = Object.keys(c.juegos || {}).map((id) => {
      const ms = ((c.juegos[id] || {}).muestras || []);
      const med = mediana(ms.map((x) => x.ms));
      const partidas = ms.reduce((a, x) => a + num(x.partidas, 0), 0);
      return {
        id, n: ms.length, mediana: med,
        partidasPorPersona: ms.length ? round1(partidas / ms.length) : 0,
        personasPorHora: med ? Math.floor(3600000 / (med + relevo)) : null,
      };
    }).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const todas = Object.keys(c.juegos || {}).reduce((a, id) => a.concat(((c.juegos[id] || {}).muestras || []).map((x) => x.ms)), []);
    const global = mediana(todas);
    return {
      relevo, juegos, muestras: todas.length, mediana: global,
      personasPorHora: global ? Math.floor(3600000 / (global + relevo)) : null,
    };
  }

  // ── Métricas de activación: contadores agregados, sin nadie dentro ────
  //
  // La distinción que sostiene todo esto: se cuenta CUÁNTAS veces pasó algo, no
  // A QUIÉN le pasó. Un contador de "37 partidas de boxeo a las 14 h" no
  // distingue personas ni se puede revertir para sacarlas. Por eso no necesita
  // consentimiento de nadie y por eso el auspiciador lo puede recibir entero.
  //
  // Y es, además, lo que de verdad vale: qué juego eligió la gente, cuál
  // abandonó y cuál repitió es PREFERENCIA REVELADA. Vale más que cualquier
  // inferencia sobre "intereses" sacada de una cara.
  function contarMetrica(juegoId, campo, valor) {
    const m = model.metricas || {};
    const juegos = Object.assign({}, m.juegos || {});
    const id = s(juegoId) || '(sin juego)';
    const j = Object.assign({ aperturas: 0, partidas: 0, abandonos: 0, repeticiones: 0, suma: 0, n: 0, max: 0 }, juegos[id]);
    if (campo === 'puntaje') {
      j.suma = round1(j.suma + num(valor, 0));
      j.n += 1;
      j.max = Math.max(j.max, num(valor, 0));
    } else {
      j[campo] = num(j[campo], 0) + (valor == null ? 1 : num(valor, 1));
    }
    juegos[id] = j;
    const parche = { juegos };
    if (!s(m.desde)) parche.desde = new Date().toISOString();
    // Afluencia por hora del día: sirve para decirle al cliente a qué hora
    // conviene tener a alguien en el stand. No lleva fecha ni persona.
    if (campo === 'aperturas') {
      const horas = Object.assign({}, m.horas || {});
      const hh = String(new Date().getHours());
      horas[hh] = num(horas[hh], 0) + 1;
      parche.horas = horas;
    }
    commit(merge(model, { metricas: parche }));
  }

  /**
   * Lo que se le entrega al auspiciador. Todo sale de los contadores y del
   * tiempo de ciclo de la Fase 3; no hay una sola fila por persona detrás.
   */
  function resumenMetricas(m) {
    const met = (m && m.metricas) || {};
    const juegos = met.juegos || {};
    const ciclos = resumenDeCiclos(m);
    const filas = Object.keys(juegos).map((id) => {
      const j = juegos[id];
      const nombre = ((m.games || []).find((g) => g.id === id) || {}).name || id;
      return {
        id, nombre,
        aperturas: num(j.aperturas, 0),
        partidas: num(j.partidas, 0),
        abandonos: num(j.abandonos, 0),
        repeticiones: num(j.repeticiones, 0),
        promedio: j.n ? round1(j.suma / j.n) : null,
        max: j.n ? round1(j.max) : null,
        // Tasa de abandono: de cada diez que se pararon delante, cuántos se
        // fueron sin terminar. Es la métrica que dice si un juego es demasiado
        // difícil o demasiado largo para una feria.
        abandono: j.aperturas ? Math.round((num(j.abandonos, 0) / j.aperturas) * 100) : null,
      };
    }).sort((a, b) => b.aperturas - a.aperturas);
    const suma = (k) => filas.reduce((a, f) => a + f[k], 0);
    const ofrecidos = num(met.contactos && met.contactos.ofrecidos, 0);
    const aceptados = num(met.contactos && met.contactos.aceptados, 0);
    return {
      desde: met.desde || '',
      filas,
      aperturas: suma('aperturas'),
      partidas: suma('partidas'),
      abandonos: suma('abandonos'),
      // "Personas atendidas" es el número de ocupaciones del tótem, NO de
      // personas identificadas: la app no reconoce a nadie entre partidas y no
      // va a hacerlo. Si alguien juega dos veces cuenta dos veces, y decirlo
      // así es más honesto que llamarle "jugadores únicos".
      atendidas: ciclos.muestras,
      exposicionMs: Object.keys(juegos).length ? ciclos.muestras * num(ciclos.mediana, 0) : 0,
      personasPorHora: ciclos.personasPorHora,
      horas: met.horas || {},
      contactos: { ofrecidos, aceptados, tasa: ofrecidos ? Math.round((aceptados / ofrecidos) * 100) : null },
    };
  }

  /** El resumen a CSV, para adjuntarlo al informe del evento. */
  function metricasCSV(m) {
    const r = resumenMetricas(m);
    const esc = (v) => '"' + s(v).replace(/"/g, '""') + '"';
    const lineas = ['juego,aperturas,partidas,abandonos,repeticiones,tasa_abandono_pct,puntaje_promedio,puntaje_max'];
    for (const f of r.filas) {
      lineas.push([f.nombre, f.aperturas, f.partidas, f.abandonos, f.repeticiones,
        f.abandono == null ? '' : f.abandono, f.promedio == null ? '' : f.promedio,
        f.max == null ? '' : f.max].map(esc).join(','));
    }
    lineas.push('');
    lineas.push('hora,partidas');
    for (const hh of Object.keys(r.horas).sort((a, b) => Number(a) - Number(b))) {
      lineas.push([hh + ':00', r.horas[hh]].map(esc).join(','));
    }
    lineas.push('');
    lineas.push('indicador,valor');
    for (const [k, v] of [
      ['personas atendidas (ocupaciones del totem, NO personas identificadas)', r.atendidas],
      ['partidas jugadas', r.partidas],
      ['personas por hora', r.personasPorHora == null ? '' : r.personasPorHora],
      ['contactos ofrecidos', r.contactos.ofrecidos],
      ['contactos aceptados', r.contactos.aceptados],
      ['tasa de conversion a contacto (%)', r.contactos.tasa == null ? '' : r.contactos.tasa],
    ]) lineas.push([k, v].map(esc).join(','));
    return lineas.join('\n');
  }

  // ── Contacto: AMARILLO del semáforo ──────────────────────────────────
  //
  // Un dato de contacto no se "recoge": la persona lo entrega, sabiendo para
  // qué. De ahí salen tres reglas que no se negocian:
  //
  //   · Se pide DESPUÉS de jugar. Antes sería un peaje, y quien viene a jugar
  //     no está en condiciones de negociar nada con una fila detrás.
  //   · Cada casilla dice SU finalidad, y ninguna viene marcada. Una casilla
  //     premarcada no es consentimiento, es un descuido aprovechado.
  //   · Se guarda el TEXTO que la persona aceptó, no un `true`. Si mañana
  //     cambian las finalidades, hay que poder demostrar a qué dijo que sí.
  //
  // La foto va aparte del resto a propósito: compartir una imagen es otra cosa
  // que dar un correo, y meterlas en la misma casilla sería colar una en la
  // otra.
  const FINALIDADES = {
    contacto: 'Que la marca me contacte con novedades y promociones.',
    premio: 'Avisarme si gano un premio de este concurso.',
    foto: 'Usar mi foto o vídeo del evento en las redes de la marca.',
  };

  /**
   * Guarda un registro de contacto. Devuelve la fila, o null si no hay nada
   * que guardar: sin una sola casilla marcada NO se guarda ni el nombre.
   */
  function guardarContacto(datos) {
    const d = datos || {};
    const acepto = d.acepto || {};
    const claves = Object.keys(acepto).filter((k) => acepto[k]);
    if (!claves.length) return null;
    const fila = {
      id: uid('ct'),
      at: new Date().toISOString(),
      sesion: SESION_ID,
      nombre: s(d.nombre).slice(0, 80),
      correo: s(d.correo).slice(0, 120),
      telefono: s(d.telefono).slice(0, 40),
      edad: s(d.edad).slice(0, 10),
      acepto: claves.reduce((a, k) => { a[k] = true; return a; }, {}),
      // El texto exacto de lo que aceptó, congelado en el momento.
      textos: claves.reduce((a, k) => { a[k] = FINALIDADES[k] || k; return a; }, {}),
      responsable: s(model.contacto && model.contacto.responsable),
      conservacion: s(model.contacto && model.contacto.conservacion),
    };
    const registros = ((model.contacto && model.contacto.registros) || []).concat([fila]);
    commit(merge(model, { contacto: { registros } }));
    contarContacto('aceptados');
    return fila;
  }

  function contarContacto(campo) {
    const c = Object.assign({ ofrecidos: 0, aceptados: 0 }, (model.metricas || {}).contactos || {});
    c[campo] = num(c[campo], 0) + 1;
    commit(merge(model, { metricas: { contactos: c } }));
  }

  /** Los contactos a CSV: es lo que se le entrega a la marca al terminar. */
  function contactosCSV(filas) {
    const esc = (v) => '"' + s(v).replace(/"/g, '""') + '"';
    const cab = 'fecha,nombre,correo,telefono,edad_declarada,acepto_contacto,acepto_premio,acepto_foto,texto_aceptado,responsable,conservacion,sesion';
    return [cab].concat((filas || []).map((r) => [
      r.at, r.nombre, r.correo, r.telefono, r.edad,
      r.acepto && r.acepto.contacto ? 'si' : 'no',
      r.acepto && r.acepto.premio ? 'si' : 'no',
      r.acepto && r.acepto.foto ? 'si' : 'no',
      Object.keys(r.textos || {}).map((k) => r.textos[k]).join(' | '),
      r.responsable || '', r.conservacion || '', r.sesion || '',
    ].map(esc).join(','))).join('\n');
  }

  /**
   * Qué dice el QR que se lleva el jugador.
   *
   * Si la marca dio una dirección, se usa su plantilla. Si no, el QR lleva un
   * texto legible con el puntaje: sigue sirviendo para una foto, y es mejor que
   * un QR que no abre nada. Lo que NO se hace es inventar un servidor.
   */
  function textoQrPuntaje(m, juego, puntaje) {
    const plantilla = s(m.contacto && m.contacto.urlPuntaje);
    if (plantilla) {
      return plantilla
        .replace(/\{puntaje\}/g, String(puntaje))
        .replace(/\{juego\}/g, encodeURIComponent(s(juego)))
        .replace(/\{app\}/g, encodeURIComponent(s(m.branding && m.branding.appName)));
    }
    return s(m.branding && m.branding.appName || 'Kimos FunPlai') + ' — ' + s(juego) +
      ': ' + puntaje + '/10 · ' + new Date().toLocaleDateString();
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
    // Único punto por donde pasa toda la navegación, así que es el único sitio
    // donde el reloj de ocupación se puede llevar sin sembrar contadores en los
    // once juegos y sin que ninguno se olvide de pararlo.
    const antes = route;
    const cambiaDeJuego = screen !== 'juego' || (gameId || '') !== antes.gameId;
    if (antes.screen === 'juego' && cambiaDeJuego) { try { cerrarCiclo(); } catch (e) { /* noop */ } }
    route = { screen, gameId: gameId || '' };
    if (screen === 'juego' && cambiaDeJuego) { try { abrirCiclo(route.gameId); } catch (e) { /* noop */ } }
    for (const l of routeListeners) l(route);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. Tema visual y átomos de UI
  // ══════════════════════════════════════════════════════════════════════

  function themeOf(m) {
    // Un pack IMPORTADO no está en THEMES —llegó de un archivo—, así que su
    // tema viaja dentro del modelo. Si está, manda: si no, se busca por id.
    const base = (m.branding && isObj(m.branding.temaPack) && m.branding.temaPack)
      || THEMES[m.branding.theme] || THEMES['fiestas-patrias'];
    return Object.assign({}, base, {
      accent: m.branding.accent || base.accent,
      accent2: m.branding.accent2 || base.accent2,
    });
  }

  function cssVars(t) {
    const fa = facetas(t.accent), fb = facetas(t.accent2);
    return {
      '--fp-accent': t.accent,
      '--fp-accent2': t.accent2,
      '--fp-bg': t.bg,
      '--fp-bg2': t.bg2,
      '--fp-surface': t.surface,
      '--fp-ink': t.ink,
      // Facetas de marca: el bisel de botones y tarjetas se construye con
      // estos tres tonos, igual que las caras de un volumen en la escena.
      '--fp-accent-luz': fa.luz,
      '--fp-accent-sombra': fa.sombra,
      '--fp-accent-linea': fa.linea,
      '--fp-accent2-luz': fb.luz,
      '--fp-accent2-sombra': fb.sombra,
      '--fp-cielo': t.cielo || '#2C9BE0',
      '--fp-cielo-bajo': t.cieloBajo || '#CFF0FF',
      '--fp-suelo': t.suelo || '#4FA83F',
    };
  }

  /** Paleta de escena del tema activo, para el motor de arte. */
  function escenaDe(t) {
    return {
      cielo: t.cielo || '#2C9BE0',
      cieloBajo: t.cieloBajo || '#CFF0FF',
      suelo: t.suelo || '#4FA83F',
      cerros: t.cerros || '#4C6FA8',
      sol: t.sol || '#FFE9A8',
    };
  }

  const Boton = (p) => h('button', {
    type: 'button',
    className: 'fp-btn' + (p.variant ? ' fp-btn--' + p.variant : '') + (p.className ? ' ' + p.className : ''),
    onClick: p.onClick,
    // Hay botones que se MANTIENEN apretados (planear en "Alas de cóndor"),
    // así que los eventos de puntero también se pasan.
    onPointerDown: p.onPointerDown,
    onPointerUp: p.onPointerUp,
    onPointerLeave: p.onPointerLeave,
    onPointerCancel: p.onPointerCancel,
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
  // 4.b Motor de arte "arcade 3D" (estética de consola 3D de los noventa)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Todos los juegos comparten el mismo lenguaje visual, inspirado en los
  // consolas 3D de fines de los noventa. Cuatro reglas:
  //
  //   1. CIELO Y HORIZONTE. El fondo nunca es un color plano: es un degradado
  //      de cielo con un sol bajo y un suelo en perspectiva que huye hacia un
  //      punto de fuga. Eso solo ya da sensación de profundidad.
  //   2. FACETAS, NO DEGRADADOS. Los volúmenes se construyen con caras planas
  //      de color duro (`facetas()`), como una malla de pocos polígonos con
  //      sombreado plano. Nada de degradados suaves dentro de un objeto.
  //   3. CONTORNO Y CONTACTO. Línea oscura gruesa alrededor de cada pieza y
  //      una elipse de sombra en el suelo: sin eso los objetos flotan.
  //   4. TIPOGRAFÍA DE MÁQUINA. Números y avisos en cursiva, con contorno
  //      grueso y sombra dura desplazada, como los marcadores de arcade.
  //
  // Todo es SVG embebido: la app sigue sin descargar una sola imagen.

  /** Punto de fuga y horizonte estándar para un viewBox de alto `alto`. */
  const HORIZONTE = (alto) => alto * 0.42;

  /**
   * Suelo en perspectiva: franjas que se estrechan hacia el horizonte y
   * líneas de fuga. Es la firma visual de la época.
   */
  function SueloDC(props) {
    const w = num(props.w, 1000), hh = num(props.h, 600);
    const hz = num(props.horizonte, HORIZONTE(hh));
    const f = facetas(props.color || '#3FA34D');
    const fx = num(props.fugaX, w / 2);
    const filas = [];
    const n = num(props.filas, 9);
    // Las franjas se calculan con progresión geométrica: cerca son altas y
    // lejos se comprimen contra el horizonte, que es como se ve un plano.
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const y0 = hz + (hh - hz) * (t0 * t0), y1 = hz + (hh - hz) * (t1 * t1);
      filas.push(h('rect', {
        key: 'f' + i, x: 0, y: y0, width: w, height: Math.max(0.5, y1 - y0),
        fill: i % 2 ? f.base : f.luz,
      }));
    }
    const lineas = [];
    const m = num(props.lineas, 11);
    for (let i = 0; i <= m; i++) {
      const x = (i / m) * w * 3 - w;         // se extiende fuera del cuadro
      lineas.push(h('path', {
        key: 'l' + i, d: 'M' + fx + ' ' + hz + ' L' + x + ' ' + hh,
        stroke: 'rgba(255,255,255,.16)', strokeWidth: 2, fill: 'none',
      }));
    }
    return h('g', null,
      h('rect', { x: 0, y: hz, width: w, height: hh - hz, fill: f.fondo }),
      filas, lineas,
      // Bruma en el horizonte: separa suelo y cielo sin una línea dura.
      h('rect', { x: 0, y: hz, width: w, height: Math.max(8, hh * 0.06), fill: props.bruma || 'rgba(255,255,255,.25)', opacity: 0.5 }));
  }

  /** Cielo con sol bajo y nubes chatas de la época. */
  function CieloDC(props) {
    const w = num(props.w, 1000), hh = num(props.h, 600);
    const hz = num(props.horizonte, HORIZONTE(hh));
    const id = props.gid || 'dc';
    const alto = props.alto || '#2FA9E8';
    const bajo = props.bajo || '#BFEBFF';
    return h('g', null,
      h('defs', null,
        h('linearGradient', { id: id + '-cielo', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: '0%', stopColor: alto }),
          h('stop', { offset: '100%', stopColor: bajo }))),
      h('rect', { x: 0, y: 0, width: w, height: hz + 2, fill: 'url(#' + id + '-cielo)' }),
      // El sol se dimensiona con la franja de CIELO, no con el alto total: en
      // un viewBox alto y horizonte bajo, escalarlo al alto lo vuelve un muro.
      (function () {
        if (props.sol === false) return null;
        const r = Math.min(hh, hz * 1.6) * 0.11;
        const cx = num(props.solX, w * 0.74), cy = hz - r * 1.5;
        return h('g', null,
          h('circle', { cx: cx, cy: cy, r: r, fill: props.solColor || '#FFE9A8', opacity: 0.9 }),
          h('circle', { cx: cx, cy: cy, r: r * 0.64, fill: '#FFFDF0' }));
      })(),
      (props.nubes || []).map((n, i) => h('g', { key: 'n' + i, opacity: 0.92 },
        h('ellipse', { cx: n.x, cy: n.y, rx: n.r * 1.7, ry: n.r * 0.62, fill: '#fff' }),
        h('ellipse', { cx: n.x - n.r, cy: n.y + n.r * 0.2, rx: n.r, ry: n.r * 0.5, fill: '#fff' }),
        h('ellipse', { cx: n.x + n.r * 1.1, cy: n.y + n.r * 0.18, rx: n.r * 0.9, ry: n.r * 0.46, fill: '#fff' }))));
  }

  /** Cerros facetados al fondo: dan escala y tapan el corte del horizonte. */
  function CerrosDC(props) {
    const w = num(props.w, 1000);
    const hz = num(props.horizonte, 250);
    const f = facetas(props.color || '#4A6FA5');
    const picos = props.picos || [[0.10, 0.55], [0.30, 0.9], [0.52, 0.62], [0.72, 1.0], [0.92, 0.7]];
    const altoMax = num(props.alto, 110);
    return h('g', { opacity: num(props.opacidad, 1) },
      picos.map((p, i) => {
        const cx = p[0] * w, ah = p[1] * altoMax, an = ah * 1.9;
        return h('g', { key: 'c' + i },
          // Cara en sombra y cara iluminada: dos triángulos, sin degradado.
          h('path', { d: 'M' + (cx - an) + ' ' + hz + ' L' + cx + ' ' + (hz - ah) + ' L' + cx + ' ' + hz + ' Z', fill: f.sombra }),
          h('path', { d: 'M' + cx + ' ' + (hz - ah) + ' L' + (cx + an) + ' ' + hz + ' L' + cx + ' ' + hz + ' Z', fill: f.luz }),
          // Nieve en la cumbre, como los cerros de fondo de la época.
          ah > altoMax * 0.75 ? h('path', {
            d: 'M' + (cx - an * 0.22) + ' ' + (hz - ah * 0.76) + ' L' + cx + ' ' + (hz - ah) +
               ' L' + (cx + an * 0.22) + ' ' + (hz - ah * 0.76) + ' L' + (cx + an * 0.07) + ' ' + (hz - ah * 0.82) +
               ' L' + (cx - an * 0.08) + ' ' + (hz - ah * 0.7) + ' Z',
            fill: '#F2F7FF',
          }) : null);
      }));
  }

  /**
   * Lienzo recortado al viewBox. Un `<svg>` recorta a la caja del elemento,
   * no al viewBox: si la caja es más ancha que el arte, todo lo que se dibuje
   * fuera del viewBox —un blanco que entra volando, las líneas de fuga— se ve
   * flotando en las bandas laterales. Esto lo evita.
   */
  function LienzoDC(props) {
    const gid = props.gid || 'lienzo';
    return h('g', { clipPath: 'url(#' + gid + '-vb)' },
      h('defs', null, h('clipPath', { id: gid + '-vb' },
        h('rect', { x: 0, y: 0, width: num(props.w, 1000), height: num(props.h, 1000) }))),
      props.children);
  }

  /**
   * Escena completa: cielo + cerros + suelo, recortada al viewBox.
   *
   * El recorte no es un detalle: un `<svg>` con viewBox recorta a la caja del
   * elemento, no al viewBox, así que las líneas de fuga y los cerros —que se
   * dibujan a propósito más anchos que el cuadro— se verían desbordando por
   * los costados cuando la caja es más ancha que el arte.
   */
  function EscenaDC(props) {
    const W = num(props.w, 1000), H = num(props.h, 600);
    const hz = num(props.horizonte, HORIZONTE(H));
    const e = props.escena || {};
    const gid = props.gid || 'esc';
    return h('g', { clipPath: 'url(#' + gid + '-clip)' },
      h('defs', null, h('clipPath', { id: gid + '-clip' }, h('rect', { x: 0, y: 0, width: W, height: H }))),
      h(CieloDC, {
        w: W, h: H, horizonte: hz, gid: gid, alto: e.cielo, bajo: e.cieloBajo,
        solX: props.solX, solColor: e.sol, sol: props.sol, nubes: props.nubes,
      }),
      props.cerros === false ? null : h(CerrosDC, {
        w: W, horizonte: hz, color: e.cerros, alto: num(props.altoCerros, H * 0.2),
        opacidad: num(props.opacidadCerros, 1), picos: props.picos,
      }),
      h(SueloDC, {
        w: W, h: H, horizonte: hz, color: props.suelo || e.suelo,
        fugaX: num(props.fugaX, W / 2), filas: props.filas, lineas: props.lineas, bruma: props.bruma,
      }),
      props.children);
  }

  /** Sombra de contacto en el suelo. Sin esto, todo flota. */
  const SombraDC = (p) => h('ellipse', {
    cx: p.cx, cy: p.cy, rx: p.rx, ry: num(p.ry, p.rx * 0.3),
    fill: 'rgba(0,0,0,.32)', opacity: num(p.opacidad, 1),
  });

  /**
   * Caja en proyección oblicua: cara frontal, tapa y lateral, cada una plana.
   * `p` es la profundidad aparente en px (el desplazamiento del volumen).
   */
  function CajaDC(props) {
    const x = num(props.x, 0), y = num(props.y, 0);
    const w = num(props.w, 100), hh = num(props.h, 60), p = num(props.p, 18);
    const f = facetas(props.color || '#D52B1E');
    const lw = num(props.linea, 3);
    return h('g', null,
      h('path', { d: 'M' + x + ' ' + y + ' L' + (x + p) + ' ' + (y - p) + ' L' + (x + w + p) + ' ' + (y - p) + ' L' + (x + w) + ' ' + y + ' Z', fill: f.luz, stroke: f.linea, strokeWidth: lw, strokeLinejoin: 'round' }),
      h('path', { d: 'M' + (x + w) + ' ' + y + ' L' + (x + w + p) + ' ' + (y - p) + ' L' + (x + w + p) + ' ' + (y + hh - p) + ' L' + (x + w) + ' ' + (y + hh) + ' Z', fill: f.sombra, stroke: f.linea, strokeWidth: lw, strokeLinejoin: 'round' }),
      h('rect', { x: x, y: y, width: w, height: hh, fill: f.base, stroke: f.linea, strokeWidth: lw }),
      props.brillo === false ? null : h('path', {
        d: 'M' + (x + w * 0.08) + ' ' + (y + hh * 0.12) + ' L' + (x + w * 0.34) + ' ' + (y + hh * 0.12) + ' L' + (x + w * 0.2) + ' ' + (y + hh * 0.42) + ' L' + (x + w * 0.06) + ' ' + (y + hh * 0.42) + ' Z',
        fill: '#fff', opacity: 0.18,
      }));
  }

  /** Cilindro facetado (postes, tarros, tejos vistos de canto). */
  function CilindroDC(props) {
    const cx = num(props.cx, 0), cy = num(props.cy, 0);
    const r = num(props.r, 30), hh = num(props.h, 60), ry = num(props.ry, r * 0.34);
    const f = facetas(props.color || '#19ACB1');
    const lw = num(props.linea, 3);
    return h('g', null,
      h('path', {
        d: 'M' + (cx - r) + ' ' + cy + ' L' + (cx - r) + ' ' + (cy - hh) +
           ' A' + r + ' ' + ry + ' 0 0 1 ' + (cx + r) + ' ' + (cy - hh) +
           ' L' + (cx + r) + ' ' + cy + ' A' + r + ' ' + ry + ' 0 0 1 ' + (cx - r) + ' ' + cy + ' Z',
        fill: f.base, stroke: f.linea, strokeWidth: lw,
      }),
      // Faceta lateral en sombra: un rectángulo del lado derecho, plano.
      h('path', {
        d: 'M' + (cx + r * 0.35) + ' ' + (cy - hh + ry * 0.6) + ' L' + (cx + r) + ' ' + (cy - hh) +
           ' L' + (cx + r) + ' ' + cy + ' L' + (cx + r * 0.35) + ' ' + (cy + ry * 0.5) + ' Z',
        fill: f.sombra, opacity: 0.85,
      }),
      h('ellipse', { cx: cx, cy: cy - hh, rx: r, ry: ry, fill: f.luz, stroke: f.linea, strokeWidth: lw }),
      h('path', { d: 'M' + (cx - r * 0.72) + ' ' + (cy - hh * 0.86) + ' L' + (cx - r * 0.4) + ' ' + (cy - hh * 0.9) + ' L' + (cx - r * 0.46) + ' ' + (cy - hh * 0.2) + ' L' + (cx - r * 0.78) + ' ' + (cy - hh * 0.16) + ' Z', fill: '#fff', opacity: 0.2 }));
  }

  /** Panel de HUD inclinado, con bisel y contorno, como los marcadores arcade. */
  function PanelDC(props) {
    const x = num(props.x, 0), y = num(props.y, 0);
    const w = num(props.w, 260), hh = num(props.h, 64);
    const sk = num(props.sesgo, 12);                 // inclinación del paralelogramo
    const f = facetas(props.color || '#141B2E');
    const d = 'M' + (x + sk) + ' ' + y + ' L' + (x + w + sk) + ' ' + y + ' L' + (x + w) + ' ' + (y + hh) + ' L' + x + ' ' + (y + hh) + ' Z';
    return h('g', null,
      h('path', { d: d, transform: 'translate(5,6)', fill: 'rgba(0,0,0,.35)' }),
      h('path', { d: d, fill: f.base, stroke: props.borde || '#fff', strokeWidth: num(props.linea, 3) }),
      h('path', {
        d: 'M' + (x + sk) + ' ' + y + ' L' + (x + w + sk) + ' ' + y + ' L' + (x + w + sk - 3) + ' ' + (y + 7) + ' L' + (x + sk - 3) + ' ' + (y + 7) + ' Z',
        fill: '#fff', opacity: 0.28,
      }),
      props.children);
  }

  /** Rayos de velocidad / estallido: el "¡pum!" de la época. */
  function EstallidoDC(props) {
    const cx = num(props.cx, 0), cy = num(props.cy, 0);
    const r = num(props.r, 90), n = num(props.puntas, 12);
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 ? r * num(props.interior, 0.52) : r;
      pts.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1));
    }
    return h('polygon', {
      points: pts.join(' '), fill: props.color || '#FFD54F',
      stroke: props.borde || '#B8410E', strokeWidth: num(props.linea, 4),
      opacity: num(props.opacidad, 1), transform: props.transform,
    });
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
  /**
   * Guirnalda de banderines. Los colores y la estrella vienen del pack: tenía
   * la bandera chilena escrita a mano dentro, así que "la temática es un
   * parámetro" era mentira justo en el adorno más visible de la portada.
   */
  function Banderines(props) {
    const n = num(props.n, 14), w = num(props.w, 1000), sag = num(props.sag, 46);
    const cols = Array.isArray(props.colores) && props.colores.length ? props.colores : ['#D52B1E', '#0039A6'];
    const estrella = props.estrella !== false;
    const y = (x) => Math.sin((x / w) * Math.PI) * sag;
    const flags = [];
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w;
      const yy = y(x) + 6;
      const bw = w / n * 0.62, bh = bw * 1.15;
      flags.push(h('g', { key: i, transform: 'translate(' + x.toFixed(1) + ',' + yy.toFixed(1) + ')' },
        h('path', { d: 'M' + (-bw / 2) + ' 0 L' + (bw / 2) + ' 0 L0 ' + bh + ' Z', fill: '#fff' }),
        h('path', { d: 'M' + (-bw / 2) + ' 0 L' + (bw / 2) + ' 0 L0 ' + bh + ' Z', fill: 'none', stroke: 'rgba(0,0,0,.15)', strokeWidth: 1 }),
        h('path', { d: 'M' + (-bw / 2) + ' 0 L' + (bw / 2) + ' 0 L' + (bw * 0.30) + ' ' + (bh * 0.42) + ' L' + (-bw * 0.30) + ' ' + (bh * 0.42) + ' Z', fill: cols[i % cols.length] }),
        estrella ? h('path', { d: estrellaAbs(0, bh * 0.20, bw * 0.16, bw * 0.065), fill: '#fff' }) : null,
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
  /**
   * Escarapela de la portada y del resultado. Los colores salen del pack: era
   * la otra pieza con la bandera chilena escrita a mano, y es la más grande de
   * la portada — un pack de Navidad con una escarapela tricolor en el centro
   * delataba que la temática seguía sin ser un parámetro del todo.
   *
   * El dibujo sí es fijo: un pack recolorea, no redibuja. Ver PERSONALIZACION.md.
   */
  function Escarapela(props) {
    const w = num(props.w, 120);
    const t = themeOf(model);
    const cols = Array.isArray(t.decorColores) && t.decorColores.length >= 2
      ? t.decorColores
      : [t.accent || '#D52B1E', t.accent2 || '#0039A6'];
    const aro = cols[1], radio = cols[0];
    const rayos = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      rayos.push(h('path', {
        key: i,
        d: 'M50 50 L' + (50 + Math.cos(a) * 48).toFixed(2) + ' ' + (50 + Math.sin(a) * 48).toFixed(2) +
           ' L' + (50 + Math.cos(a + 0.13) * 48).toFixed(2) + ' ' + (50 + Math.sin(a + 0.13) * 48).toFixed(2) + ' Z',
        fill: i % 2 ? radio : '#f2f2f2',
      }));
    }
    return h('svg', { viewBox: '0 0 100 100', width: w, height: w, style: props.style, className: props.className },
      h('circle', { cx: 50, cy: 50, r: 48, fill: aro }), rayos,
      h('circle', { cx: 50, cy: 50, r: 26, fill: '#fff' }),
      h('circle', { cx: 50, cy: 50, r: 20, fill: aro }),
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

  /**
   * Fondo de escenario: el mundo donde ocurre todo. Cielo con sol, cordillera
   * facetada y cancha en perspectiva que huye al horizonte. Es la misma
   * escena que usan los juegos, para que la portada no se sienta un menú de
   * web sino la pantalla de selección de un juego.
   */
  function Escenario(props) {
    const t = props.theme;
    const e = escenaDe(t);
    const W = 1000, H = 600, hz = 268;
    return h('div', { className: 'fp-stage-bg' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid slice', className: 'fp-stage-svg' },
        h(EscenaDC, {
          w: W, h: H, horizonte: hz, gid: 'fp-home', escena: e,
          solX: W * 0.76, altoCerros: 128, filas: 10, lineas: 13,
          nubes: [{ x: 170, y: 96, r: 26 }, { x: 430, y: 62, r: 19 }, { x: 800, y: 118, r: 23 }],
        }),
        // Velo en degradado: el cielo se deja ver casi limpio y el suelo se
        // apaga, porque es sobre el suelo donde van las fichas de los juegos.
        h('defs', null,
          h('linearGradient', { id: 'fp-home-velo', x1: 0, y1: 0, x2: 0, y2: 1 },
            h('stop', { offset: '0%', stopColor: t.bg2, stopOpacity: 0.32 }),
            h('stop', { offset: '42%', stopColor: t.bg2, stopOpacity: 0.42 }),
            h('stop', { offset: '52%', stopColor: t.bg2, stopOpacity: 0.74 }),
            h('stop', { offset: '100%', stopColor: t.bg2, stopOpacity: 0.9 }))),
        h('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#fp-home-velo)' })),
      props.decor === false ? null : h('div', { className: 'fp-garland-wrap' },
        h(Banderines, {
          n: 16, w: 1000, sag: 40,
          colores: t && t.decorColores, estrella: t && t.decorEstrella !== false,
        })));
  }

  // ── Burro (arte del juego 1) ──────────────────────────────────────────
  /**
   * Burro dieciochero en SVG (viewBox 0 0 1000 1150). Vista de tres cuartos:
   * el anca queda a la derecha; ahí va el blanco y orbita la mira.
   */
  const ANCA = { x: 648, y: 640 };   // centro del blanco (coordenadas SVG)

  function Burro(props) {
    // Facetas del pelaje: base, contorno duro y cara iluminada. El contorno
    // grueso y oscuro es lo que separa al personaje del fondo en esta estética.
    const f = facetas('#A2A9B4');
    const g = f.base, gD = f.linea, gL = f.luz;
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
      // Faceta en sombra: la panza y el costado que no reciben el sol.
      h('path', {
        d: 'M262 700 q10 118 108 132 q160 20 280 -6 q86 -18 108 -96 q-40 96 -196 104 q-180 10 -300 -134 Z',
        fill: f.sombra, opacity: 0.9,
      }),
      // Brillo especular duro en el lomo, sin degradado.
      h('path', {
        d: 'M330 500 q120 -44 250 -20 q-130 4 -234 44 Z',
        fill: '#fff', opacity: 0.34,
      }),
      // anca (grupa): queda descubierta, es la zona de juego
      h('ellipse', { cx: 646, cy: 648, rx: 140, ry: 186, fill: gL, opacity: 0.95 }),
      h('path', { d: 'M700 520 q86 58 86 132 q0 96 -76 148', stroke: f.sombra, strokeWidth: 34, fill: 'none', opacity: 0.5, strokeLinecap: 'round' }),
      h('path', { d: 'M614 476 q118 54 118 172 q0 116 -96 172', stroke: gD, strokeWidth: 4, fill: 'none', opacity: 0.45 }),
      // manta / poncho con franja tricolor (cubre el lomo, no el anca)
      h('path', {
        d: 'M312 468 q130 -42 262 -10 q46 10 48 62 l10 200 q4 52 -48 60 q-140 22 -266 -2 q-46 -8 -42 -60 l16 -196 q4 -46 20 -54 Z',
        fill: '#4B5563', stroke: '#232B36', strokeWidth: 5,
      }),
      h('path', { d: 'M330 476 q120 -32 236 -6 l-6 34 q-118 -26 -236 4 Z', fill: '#fff', opacity: 0.16 }),
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

  /**
   * Qué motor de pose está corriendo AHORA. Lo escribe `arrancarPose` y lo lee
   * el marco de los juegos para mostrarlo.
   *
   * Es una variable del módulo y no estado de React a propósito: no hay un
   * componente común que la posea —cada juego arranca el suyo— y los juegos se
   * redibujan varias veces por segundo mientras se juega, que es justo cuando
   * el dato importa. Fuera de una partida no hay motor y no se muestra nada.
   */
  /**
   * El cartel de cámara activa, en un solo sitio.
   *
   * Estaba escrito a mano en cuatro pantallas, con dos textos distintos: uno
   * decía "no se graba ni se envía video" y otro solo "Cámara activa". Un
   * cartel de privacidad que dice cosas distintas según el juego no es un
   * cartel, es un descuido. Ahora es un componente, y el texto cambia solo
   * cuando la cámara está en el teléfono, porque ahí la afirmación es más
   * fuerte y conviene decirlo.
   */
  function AvisoCamara() {
    if (model.hardware.avisoCamara === false) return null;
    const remoto = motorActivo && motorActivo.tipo === 'sensor';
    return h('div', { className: 'fp-cam-notice' + (remoto ? ' is-remoto' : '') },
      h('b', null, '● Cámara activa'),
      h('span', null, remoto
        ? 'La imagen no sale del teléfono: se calculan ahí los puntos del cuerpo y solo viajan esos números.'
        : 'No se graba, no se guarda y no se transmite vídeo.'));
  }

  let motorActivo = null;
  /**
   * El enlace del sensor remoto que está en uso, si lo hay.
   *
   * Con el teléfono de cámara, la partida depende de un equipo que no está en
   * la mano del operador: se puede bloquear la pantalla, quedarse sin batería o
   * salirse del wifi. Cuando eso pasa el juego se queda quieto, y sin un aviso
   * en la pantalla grande nadie entiende por qué. Por eso el marco de TODOS los
   * juegos lo mira: es una variable de módulo por la misma razón que
   * `motorActivo` —no hay un componente común que la posea— y se lee en cada
   * render, que es cuando importa.
   */
  let enlaceActivo = null;
  /**
   * El vigilante de la partida en curso, si el modo concurso está encendido.
   *
   * Vive acá, junto a `motorActivo`, y lo alimentan los PROVEEDORES de pose en
   * su propio bucle. Es la única forma de vigilar los once juegos sin tocar los
   * once: cada juego tiene su bucle y su estado, pero todos leen del mismo
   * proveedor. Sembrar la comprobación en cada juego sería garantizar que
   * alguno se quede sin ella el día que se agregue el doce.
   */
  let vigilanteActivo = null;
  // Lo último que el vigilante tuvo que reprochar, para poder decírselo al
  // jugador MIENTRAS pasa. Descubrir al final que la partida no valía sería una
  // trampa del sistema, no del jugador.
  let avisoVigilante = null;
  const vigilarCuadro = (L, aspecto) => {
    if (!vigilanteActivo || !L) return;
    if (!vigilanteActivo.calibrado()) { vigilanteActivo.calibrar(L, aspecto); return; }
    const r = vigilanteActivo.revisar(L, aspecto);
    avisoVigilante = r.ok ? null : { texto: r.motivo, at: nowMs() };
  };

  function Marco(props) {
    const mot = motorActivo;
    // Se avisa solo cuando de verdad no está llegando nada: un parpadeo de
    // wifi que el enlace recupera solo no tiene por qué asustar a nadie.
    const sal = enlaceActivo ? enlaceActivo.salud() : null;
    const caido = sal && (!sal.pareja || sal.estado === 'caido' || (sal.silencio != null && sal.silencio > 1500));
    // El aviso del concurso se apaga solo: si el jugador corrige, desaparece.
    const reproche = avisoVigilante && nowMs() - avisoVigilante.at < 900 ? avisoVigilante.texto : null;
    return h('div', { className: 'fp-game' },
      reproche ? h('div', { className: 'fp-vigilante' },
        h('b', null, '⚖️ ' + reproche),
        h('span', null, 'Estás jugando un concurso: si te sales de la marca, la partida queda señalada.')) : null,
      caido ? h('div', { className: 'fp-sensor-caido' },
        h('b', null, '📱 Se perdió el teléfono'),
        h('span', null, !sal.pareja
          ? 'Se desconectó de la sala ' + salaLegible(sal.sala) + '. Revisa que la pantalla del teléfono siga encendida y con la app abierta.'
          : sal.estado === 'caido' ? 'Se cortó la conexión con el puente. Reintentando solo…'
            : 'Lleva ' + Math.round(sal.silencio / 1000) + ' s sin mandar nada. Suele ser la pantalla del teléfono apagándose.')) : null,
      h('header', { className: 'fp-game-head' },
        h(Boton, { variant: 'ghost', onClick: props.onExit }, '← Salir'),
        h('div', { className: 'fp-game-title' },
          h('span', { className: 'fp-game-icon' }, props.icon),
          h('span', null, props.title)),
        h('div', { className: 'fp-game-meta' },
          // Sin esto no hay forma de saber, jugando, si el tótem está usando
          // el Kinect o cayó a la webcam: los dos se ven igual en pantalla.
          mot ? h('span', {
            className: 'fp-motor' + (mot.tipo === 'kinect' ? ' is-kinect' : ''),
            title: mot.detalle,
          }, mot.etiqueta) : null,
          props.meta)),
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
    // La pantalla de resultado es el único sitio por el que pasan TODAS las
    // partidas de TODOS los juegos, incluidas las de "jugar otra vez", que no
    // cambian de pantalla y por eso no las vería el contador de ocupación.
    useEffect(() => { contarPartida(); }, []);
    // El veredicto se calcula una vez, al llegar acá: la partida ya terminó y
    // seguir midiendo mientras alguien escribe su nombre no diría nada.
    const [veredicto] = useState(() => (vigilanteActivo ? vigilanteActivo.veredicto() : null));
    const esCon = !!(model.concurso && model.concurso.activo);
    const est = estadoConcurso(model);
    const intentos = clamp(Math.round(num(model.concurso.intentosPorPersona, 0)), 0, 99);
    const usados = esCon && intentos ? intentosDe(model, nombre, props.juego) : 0;
    const sinIntentos = esCon && intentos > 0 && usados >= intentos && claveJugador(nombre);
    const puedeGuardar = !guardado && est.abierto && !sinIntentos;
    return h('div', { className: 'fp-result' },
      h(Escarapela, { w: 96 }),
      h('h2', null, props.titulo || '¡Fin del juego!'),
      h('div', { className: 'fp-result-score' }, round1(p10), h('small', null, '/10')),
      h('div', { className: 'fp-result-stars' }, estrellas(p10)),
      h('p', { className: 'fp-result-msg' }, props.mensaje || frasePuntaje(p10)),
      props.detalle ? h('div', { className: 'fp-result-detail' }, props.detalle) : null,
      // Si la partida quedó señalada, se dice ACÁ y no en letra chica del
      // ranking: quien acaba de jugar tiene derecho a enterarse en el momento
      // y a pedir repetirla.
      veredicto && veredicto.estado !== 'limpia' && veredicto.estado !== 'sin-datos'
        ? h('div', { className: 'fp-veredicto is-' + veredicto.estado },
            h('b', null, veredicto.estado === 'invalida' ? '⚖️ Partida fuera de las reglas' : '⚖️ Partida señalada'),
            h('span', null, veredicto.motivo),
            h('span', null, veredicto.estado === 'invalida'
              ? 'Se guarda en el ranking, pero no compite por el premio. Puedes repetirla respetando la marca del piso.'
              : 'Compite igual: queda anotado para poder responder si alguien reclama.'))
        : null,
      model.branding.mostrarRanking ? h('div', { className: 'fp-result-save' },
        h('input', {
          className: 'fp-input', placeholder: 'Tu nombre (opcional)', value: nombre,
          maxLength: 24, onChange: (e) => setNombre(e.target.value), disabled: guardado,
        }),
        h(Boton, {
          variant: 'soft', disabled: !puedeGuardar,
          onClick: () => {
            addScore({ jugador: nombre.trim() || 'Anónimo', juego: props.juego || '', puntaje: round1(p10), detalle: s(props.detalleTexto) });
            setGuardado(true);
            notify('success', 'Puntaje guardado en el ranking.');
          },
        }, guardado ? '✓ Guardado' : 'Guardar en el ranking'),
        !est.abierto ? h('p', { className: 'fp-error' }, '⚖️ ' + est.motivo + ' El puntaje no se puede guardar.') : null,
        sinIntentos ? h('p', { className: 'fp-error' },
          '⚖️ ' + nombre.trim() + ' ya usó sus ' + intentos + ' intento(s) en este concurso.') : null) : null,
      // ── Contacto: se ofrece DESPUÉS de jugar, y nunca antes ───────────
      h(FormularioContacto, { juego: props.juego, puntaje: round1(p10) }),
      h('div', { className: 'fp-result-actions' },
        h(Boton, { variant: 'primary', onClick: props.onReplay }, 'Jugar otra vez'),
        h(Boton, { onClick: props.onExit }, 'Volver al menú')));
  }

  /**
   * El opt-in, con su QR de puntaje al lado.
   *
   * Se dibuja plegado: quien solo vino a jugar ve un botón y se va. Desplegarlo
   * es un acto de la persona, y ese acto es el primer consentimiento —el de
   * escuchar la oferta— antes de cualquier casilla.
   */
  function FormularioContacto(props) {
    const c = model.contacto || {};
    const [abierto, setAbierto] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [d, setD] = useState({ nombre: '', correo: '', telefono: '', edad: '' });
    const [acepto, setAcepto] = useState({});   // vacío: NADA viene marcado
    const marcar = (k) => setAcepto((x) => Object.assign({}, x, { [k]: !x[k] }));
    const algo = Object.keys(acepto).some((k) => acepto[k]);
    if (!c.activo) return null;
    if (enviado) {
      return h('div', { className: 'fp-contacto is-listo' },
        h('b', null, '✔ Gracias, quedó registrado'),
        h('span', null, 'Puedes pedir que se borre en cualquier momento a ' + (s(c.responsable) || 'el organizador') + '.'));
    }
    if (!abierto) {
      return h('div', { className: 'fp-contacto' },
        h(Boton, {
          variant: 'ghost',
          onClick: () => { setAbierto(true); try { contarContacto('ofrecidos'); } catch (e) { /* noop */ } },
        }, '✉️ Quiero que me contacten'),
        h('span', null, 'Opcional. Se puede jugar y ganar sin dejar ningún dato.'));
    }
    const casilla = (k, etiqueta) => h('label', { className: 'fp-check' },
      h('input', { type: 'checkbox', checked: !!acepto[k], onChange: () => marcar(k) }),
      h('span', null, h('b', null, etiqueta), h('small', null, FINALIDADES[k])));
    return h('div', { className: 'fp-contacto is-abierto' },
      h('b', null, '✉️ Tus datos, solo si tú quieres'),
      h('p', { className: 'fp-note' },
        'Responsable de estos datos: ' + (s(c.responsable) || '(el organizador del evento)') + '. ' +
        (s(c.conservacion) ? 'Se conservan ' + s(c.conservacion) + '. ' : '') +
        'Puedes pedir que se borren cuando quieras. Nada de esto es necesario para jugar ni para ganar.'),
      h('div', { className: 'fp-form' },
        h(Campo, { label: 'Nombre', value: d.nombre, onChange: (v) => setD(Object.assign({}, d, { nombre: v })) }),
        c.pedirCorreo !== false ? h(Campo, { label: 'Correo', value: d.correo, onChange: (v) => setD(Object.assign({}, d, { correo: v })) }) : null,
        c.pedirTelefono ? h(Campo, { label: 'Teléfono', value: d.telefono, onChange: (v) => setD(Object.assign({}, d, { telefono: v })) }) : null,
        c.pedirEdad ? h(Campo, {
          label: 'Edad', type: 'number', min: 0, max: 120, value: d.edad,
          help: 'La escribes tú. La app NO estima la edad de nadie por la cámara, ni lo va a hacer.',
          onChange: (v) => setD(Object.assign({}, d, { edad: v })),
        }) : null),
      h('div', { className: 'fp-checks' },
        casilla('contacto', 'Quiero que me contacten'),
        model.concurso && model.concurso.activo ? casilla('premio', 'Avísenme si gano') : null,
        c.pedirFoto ? casilla('foto', 'Pueden usar mi foto o vídeo') : null),
      h('p', { className: 'fp-note' },
        'Ninguna casilla viene marcada, y cada una vale por separado: puedes aceptar una y rechazar el resto.'),
      h('div', { className: 'fp-actions' },
        h(Boton, {
          variant: 'soft', disabled: !algo,
          onClick: () => {
            const fila = guardarContacto({ nombre: d.nombre, correo: d.correo, telefono: d.telefono, edad: d.edad, acepto });
            if (fila) { setEnviado(true); notify('success', 'Datos guardados. Gracias.'); }
          },
        }, algo ? 'Guardar' : 'Marca al menos una casilla'),
        h(Boton, { variant: 'ghost', onClick: () => setAbierto(false) }, 'Mejor no')),
      // El QR del puntaje va acá y no depende de dejar ningún dato: es para
      // llevarse el resultado, no para pagar con un correo.
      h('div', { className: 'fp-qr-puntaje' },
        h(QR, { texto: textoQrPuntaje(model, props.juego, props.puntaje), tam: 130, alt: 'QR con tu puntaje' }),
        h('span', null, 'Llévate tu puntaje. No hace falta dejar ningún dato para escanearlo.')));
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

    const tema = themeOf(model);
    const esc = escenaDe(tema);
    const fAz = facetas(tema.accent2), fRo = facetas(tema.accent);
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
          // Escenario: patio de fonda al aire libre, con cerros al fondo y la
          // tierra huyendo hacia el horizonte.
          h(EscenaDC, {
            w: 1000, h: 1150, horizonte: 560, gid: 'fp-burro', escena: esc,
            solX: 205, altoCerros: 190, opacidadCerros: 0.9,
            suelo: '#C8A264', filas: 8, lineas: 11, bruma: 'rgba(255,240,210,.5)',
            nubes: [{ x: 700, y: 190, r: 34 }, { x: 380, y: 120, r: 24 }],
          }),
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
          // Sombra de contacto: sin esto el burro flota sobre la tierra.
          h(SombraDC, { cx: 500, cy: 1000, rx: 330, ry: 54 }),
          // burro
          h(Burro, null,
            // Blanco fijo en el anca (círculo blanco + anillos, como el afiche)
            h('g', null,
              h('circle', { cx: ANCA.x + 6, cy: ANCA.y + 8, r: 104, fill: 'rgba(0,0,0,.28)' }),
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 104, fill: '#fff', stroke: '#2B3442', strokeWidth: 6 }),
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 104, fill: 'none', stroke: 'rgba(255,255,255,.85)', strokeWidth: 2, transform: 'translate(-3,-4)' }),
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 66, fill: 'none', stroke: fAz.base, strokeWidth: 12 }),
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 66, fill: 'none', stroke: fAz.luz, strokeWidth: 4 }),
              h('circle', { cx: ANCA.x, cy: ANCA.y, r: 26, fill: fRo.base, stroke: fRo.linea, strokeWidth: 4 }),
              h('circle', { cx: ANCA.x - 8, cy: ANCA.y - 9, r: 8, fill: '#fff', opacity: 0.55 }))),
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
  /**
   * Contorno de la persona a partir de la máscara de segmentación.
   * Recorre unas pocas columnas y guarda el píxel más alto y el más bajo de
   * cada una: con eso arma un perímetro cerrado (borde superior de izquierda a
   * derecha y borde inferior de vuelta). Barato incluso en un Celeron, porque
   * no recorre la máscara entera.
   */
  let ultimoContorno = null;
  function contornoDeMascara(mask) {
    const w = mask.width, h = mask.height;
    if (!w || !h) return;
    let datos = null, umbral = 128;
    try { datos = mask.getAsUint8Array(); } catch (e) { datos = null; }
    if (!datos) {
      try { datos = mask.getAsFloat32Array(); umbral = 0.5; } catch (e) { return; }
    }
    const cols = 56, pasoY = Math.max(1, Math.round(h / 90));
    const arriba = [], abajo = [];
    for (let c = 0; c < cols; c++) {
      const x = Math.min(w - 1, Math.round((c + 0.5) * w / cols));
      let y0 = -1, y1 = -1;
      for (let y = 0; y < h; y += pasoY) {
        if (datos[y * w + x] > umbral) { if (y0 < 0) y0 = y; y1 = y; }
      }
      if (y0 >= 0) { arriba.push({ x: x / w, y: y0 / h }); abajo.push({ x: x / w, y: y1 / h }); }
    }
    ultimoContorno = arriba.length >= 4 ? arriba.concat(abajo.reverse()) : null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8.c Kinect for Xbox One (v2) a través de un puente local
  // ══════════════════════════════════════════════════════════════════════
  //
  // El navegador NO puede hablar con el sensor: el Kinect v2 va por USB 3.0 y
  // su seguimiento de cuerpo vive en el SDK de Windows. Por eso corre un
  // PUENTE en el mismo equipo del tótem, que lee el sensor y publica los
  // cuerpos por WebSocket; la app se conecta a `ws://127.0.0.1:8787`.
  //
  // Lo que el Kinect v2 SÍ entrega, y que una webcam no puede dar:
  //   · 25 articulaciones POR CUERPO, hasta 6 cuerpos, en METROS reales.
  //   · Estado de cada mano: abierta, cerrada o "lasso" (dos dedos).
  //   · Orientación de cada hueso (cuaternión), no solo su posición.
  //   · Inclinación del torso (lean X/Y) medida por el propio sensor.
  //   · Plano del piso, así que la altura sale sin calibrar nada.
  //   · Profundidad real: la distancia no se estima, se mide.
  //
  // Lo que NO entrega, y conviene no prometer: no hay esqueleto de dedos. La
  // mano son tres puntos (muñeca, punta y pulgar) más el estado. Con eso se
  // detecta puño, mano abierta y señalar, que es lo que usan los juegos.

  /** Orden de articulaciones del SDK de Kinect v2 (índices 0..24). */
  const KINECT_JOINTS = [
    'baseColumna', 'medioColumna', 'cuello', 'cabeza',
    'hombroI', 'codoI', 'munecaI', 'manoI',
    'hombroD', 'codoD', 'munecaD', 'manoD',
    'caderaI', 'rodillaI', 'tobilloI', 'pieI',
    'caderaD', 'rodillaD', 'tobilloD', 'pieD',
    'hombroCentro', 'puntaManoI', 'pulgarI', 'puntaManoD', 'pulgarD',
  ];
  const KJ = KINECT_JOINTS.reduce((o, n, i) => { o[n] = i; return o; }, {});

  /**
   * Traduce un cuerpo de Kinect al arreglo de 33 landmarks que usan todos los
   * juegos. Así el sensor entra por la misma puerta que la webcam y NINGÚN
   * juego necesita saber de dónde vienen los datos: los que ya funcionaban
   * siguen funcionando, y los que aprovechan lo extra lo piden aparte.
   */
  function kinectALandmarks(cuerpo) {
    if (!cuerpo || !cuerpo.joints) return null;
    const J = cuerpo.joints;
    const L = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0 }));
    const poner = (idx, kj) => {
      const j = J[kj];
      if (!j) return;
      L[idx] = {
        x: clamp(num(j.x, 0.5), -0.5, 1.5),
        y: clamp(num(j.y, 0.5), -0.5, 1.5),
        // El SDK marca cada articulación como seguida, inferida o no seguida.
        visibility: j.estado === 2 ? 0.95 : j.estado === 1 ? 0.55 : 0.05,
      };
    };
    poner(0, KJ.cabeza);
    poner(11, KJ.hombroI); poner(12, KJ.hombroD);
    poner(13, KJ.codoI); poner(14, KJ.codoD);
    poner(15, KJ.munecaI); poner(16, KJ.munecaD);
    poner(17, KJ.pulgarI); poner(18, KJ.pulgarD);
    poner(19, KJ.puntaManoI); poner(20, KJ.puntaManoD);
    poner(21, KJ.manoI); poner(22, KJ.manoD);
    poner(23, KJ.caderaI); poner(24, KJ.caderaD);
    poner(25, KJ.rodillaI); poner(26, KJ.rodillaD);
    poner(27, KJ.tobilloI); poner(28, KJ.tobilloD);
    poner(31, KJ.pieI); poner(32, KJ.pieD);
    return L;
  }

  /** Coordenadas métricas (metros, relativas a la cadera) como las de MediaPipe. */
  function kinectAMundo(cuerpo) {
    if (!cuerpo || !cuerpo.joints) return null;
    const J = cuerpo.joints;
    const base = J[KJ.baseColumna];
    if (!base || base.cx == null) return null;
    const M = new Array(33).fill(null);
    const poner = (idx, kj) => {
      const j = J[kj];
      if (!j || j.cx == null) return;
      M[idx] = { x: j.cx - base.cx, y: -(j.cy - base.cy), z: j.cz - base.cz };
    };
    poner(0, KJ.cabeza);
    poner(11, KJ.hombroI); poner(12, KJ.hombroD);
    poner(13, KJ.codoI); poner(14, KJ.codoD);
    poner(15, KJ.munecaI); poner(16, KJ.munecaD);
    poner(23, KJ.caderaI); poner(24, KJ.caderaD);
    poner(25, KJ.rodillaI); poner(26, KJ.rodillaD);
    poner(27, KJ.tobilloI); poner(28, KJ.tobilloD);
    poner(31, KJ.pieI); poner(32, KJ.pieD);
    return M;
  }

  /**
   * Datos que solo el Kinect entrega, listos para que los usen los juegos.
   * Se calculan una vez por cuadro y se pasan tal cual.
   */
  function kinectExtras(cuerpo, opts) {
    if (!cuerpo) return null;
    const o = opts || {};
    const J = cuerpo.joints || {};
    const mano = (v) => (v === 3 ? 'cerrada' : v === 2 ? 'abierta' : v === 4 ? 'senalando' : 'desconocida');
    const cabeza = J[KJ.cabeza], base = J[KJ.baseColumna];
    // El operador puede desactivar manos o lean: en montajes muy altos o muy
    // lejanos el sensor los reporta mal, y es mejor que los juegos usen la
    // alternativa por posición que exigir un puño que nunca se detecta.
    const conManos = o.manos !== false;
    const conLean = o.lean !== false;
    return {
      id: s(cuerpo.id),
      manoI: conManos ? mano(cuerpo.manoI) : 'desconocida',
      manoD: conManos ? mano(cuerpo.manoD) : 'desconocida',
      confianzaManoI: conManos ? num(cuerpo.confianzaManoI, 0) : 0,
      confianzaManoD: conManos ? num(cuerpo.confianzaManoD, 0) : 0,
      // Inclinación medida por el sensor: −1..1 ≈ 45° a cada lado.
      lean: conLean ? { x: num(cuerpo.leanX, 0), y: num(cuerpo.leanY, 0) } : null,
      // Distancia real al sensor, en metros, sin estimar nada.
      distancia: base && base.cz != null ? num(base.cz, null) : null,
      // Estatura sobre el plano del piso, si el sensor lo encontró.
      estatura: cuerpo.piso && cabeza && cabeza.cy != null
        ? alturaSobrePiso(cabeza, cuerpo.piso) : null,
      piso: cuerpo.piso || null,
      orientaciones: cuerpo.orientaciones || null,
      cuerposEnEscena: num(cuerpo.cuerposEnEscena, 1),
    };
  }

  /**
   * Altura de un punto sobre el plano del piso que reporta el Kinect.
   * El plano viene en forma hessiana: (x,y,z) es la normal unitaria y `w` la
   * distancia del plano al origen, así que la altura es el producto punto.
   */
  function alturaSobrePiso(punto, piso) {
    if (!punto || !piso) return null;
    const d = punto.cx * num(piso.x, 0) + punto.cy * num(piso.y, 1) + punto.cz * num(piso.z, 0) + num(piso.w, 0);
    // SIN valor absoluto a propósito: si un puente manda `w` con el signo al
    // revés, la altura sale negativa y quien la usa la descarta. Con abs, una
    // persona de 1,60 m se leería como 0,40 m y nadie se daría cuenta.
    return Number.isFinite(d) ? d * 100 : null;               // en centímetros
  }

  /**
   * Proveedor de pose por Kinect v2. Se conecta al puente local por WebSocket
   * y reconecta solo: en una feria, el puente puede reiniciarse y el juego no
   * tiene por qué morirse con él.
   */
  function proveedorKinect(hw, espacio) {
    const url = s(hw && hw.kinectUrl) || 'ws://127.0.0.1:8787';
    // Propiedades del sensor, tal como las dejó el operador.
    const cuerpoModo = s(hw && hw.kinectCuerpo) || 'cercano';
    const minCm = clamp(num(hw && hw.kinectMinCm, 80), 40, 450);
    const maxCm = Math.max(minCm + 20, clamp(num(hw && hw.kinectMaxCm, 400), 60, 500));
    // Se conserva por compatibilidad con montajes ya configurados, pero la
    // tubería es la que filtra ahora: encadenar dos suavizados agrega retraso.
    const suave = 0;
    const usarPiso = (hw && hw.kinectUsarPiso) !== false;
    const usarLean = (hw && hw.kinectUsarLean) !== false;
    const usarManos = (hw && hw.kinectUsarManos) !== false;

    // Misma tubería que la webcam, sin recorte: el rango en metros del sensor
    // aísla al sujeto mejor que cualquier recorte de imagen. Y el suavizado
    // propio del Kinect se apaga si la tubería ya filtra, para no encadenar
    // dos filtros y comerse la respuesta.
    const tuberia = tuberiaPose(Object.assign({}, hw, { recorteZona: false }), espacio);
    let ws = null, ultima = null, vivo = false, reintento = null, cerrado = false;
    let ultimoCuadro = 0, cuadros = 0, estado = 'conectando', fueraDeRango = 0;
    // Imagen de color del sensor. Es lo que permite que el Kinect REEMPLACE a
    // la webcam en vez de convivir con ella: sin esto habría que encender una
    // cámara solo para que el jugador se vea, con el sensor al lado sin usar.
    let imagen = null, imagenes = 0, ultimaImagen = 0;

    /**
     * Desempaqueta un cuadro: 'KF', versión, formato, ancho, alto y píxeles
     * RGB. Se guarda como ImageData para que pintarlo sea una sola llamada.
     */
    const recibirImagen = (buf) => {
      const b = new Uint8Array(buf);
      if (b.length < 8 || b[0] !== 0x4B || b[1] !== 0x46 || b[2] !== 1 || b[3] !== 1) return;
      const ancho = (b[4] << 8) | b[5];
      const alto = (b[6] << 8) | b[7];
      if (ancho < 8 || alto < 8 || b.length < 8 + ancho * alto * 3) return;
      if (typeof ImageData === 'undefined') return;
      const rgba = new Uint8ClampedArray(ancho * alto * 4);
      for (let i = 0, o = 8; i < ancho * alto; i++, o += 3) {
        rgba[i * 4] = b[o]; rgba[i * 4 + 1] = b[o + 1];
        rgba[i * 4 + 2] = b[o + 2]; rgba[i * 4 + 3] = 255;
      }
      try { imagen = new ImageData(rgba, ancho, alto); } catch (e) { return; }
      imagenes++; ultimaImagen = nowMs();
    };

    /**
     * El esqueleto del Kinect tiembla unos milímetros aunque la persona esté
     * quieta, y ese temblor se ve en el avatar y en los detectores de gesto.
     * Un filtro exponencial sobre el cuadro anterior lo calma sin agregar
     * retraso perceptible. Si el punto salta mucho —la persona se movió de
     * verdad— se toma el nuevo tal cual, para no arrastrar la mano detrás.
     */
    let previo = null;
    const suavizar = (L) => {
      if (!L) { previo = null; return L; }
      if (!suave || !previo) { previo = L; return L; }
      const out = L.map((p, i) => {
        const q = previo[i];
        if (!p || !q) return p;
        if (Math.hypot(p.x - q.x, p.y - q.y) > 0.06) return p;
        return {
          x: q.x + (p.x - q.x) * (1 - suave),
          y: q.y + (p.y - q.y) * (1 - suave),
          visibility: p.visibility,
        };
      });
      previo = out;
      return out;
    };

    const conectar = () => new Promise((resolve, reject) => {
      if (typeof WebSocket === 'undefined') {
        reject(new Error('Este navegador no tiene WebSocket, que es como se habla con el puente Kinect.'));
        return;
      }
      let resuelto = false;
      try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => { vivo = true; estado = 'conectado'; resuelto = true; resolve(true); };
      ws.onmessage = (ev) => {
        // Los cuadros de imagen vienen en binario, aparte del JSON del cuerpo.
        if (ev.data instanceof ArrayBuffer) { recibirImagen(ev.data); return; }
        let m = null;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!m || m.tipo !== 'cuerpos') return;
        cuadros++;
        ultimoCuadro = nowMs();
        const todos = Array.isArray(m.cuerpos) ? m.cuerpos.filter((c) => c && c.joints) : [];
        // Fuera del rango de juego no se considera a nadie: en una feria el
        // público de atrás entra en cuadro y, sin esto, el juego se lo lleva.
        const dist = (c) => num((c.joints[KJ.baseColumna] || {}).cz, 99) * 100;
        const lista = todos.filter((c) => {
          const d = dist(c);
          return d >= minCm && d <= maxCm;
        });
        fueraDeRango = todos.length - lista.length;
        // Con quién se juega: el más cercano al sensor (lo normal en un tótem)
        // o el primero que el sensor empezó a seguir (útil si hay un operador
        // delante que no debe robarle el turno a nadie).
        const elegido = cuerpoModo === 'primero'
          ? lista[0]
          : lista.slice().sort((a, b) => dist(a) - dist(b))[0];
        if (!elegido) { ultima = null; return; }
        elegido.piso = usarPiso ? (m.piso || null) : null;
        elegido.cuerposEnEscena = lista.length;
        // El sensor ya filtró por rango y eligió cuerpo, pero la garantía de
        // "sujeto bloqueado durante la ronda" tiene que ser la MISMA se juegue
        // con webcam o con Kinect: pasa por la misma tubería. Aquí no se
        // recorta el cuadro —el rango en metros hace ese trabajo mejor— pero
        // sí se rechazan los saltos y se suaviza igual.
        const L = kinectALandmarks(elegido);
        const paso = tuberia.procesar(L, nowMs() / 1000);
        if (!paso.landmarks) { ultima = null; return; }
        vigilarCuadro(paso.landmarks, 16 / 9);
        ultima = {
          landmarks: paso.landmarks,
          mundo: kinectAMundo(elegido),
          angulos: null, sintetico: false, contorno: null,
          kinect: kinectExtras(elegido, { manos: usarManos, lean: usarLean }),
          aceptado: paso.aceptado, motivo: paso.motivo, perdido: paso.perdido,
          confianza: paso.confianza,
        };
      };
      ws.onerror = () => {
        if (!resuelto) { resuelto = true; reject(new Error('No se pudo conectar con el puente Kinect en ' + url + '.')); }
      };
      ws.onclose = () => {
        vivo = false; estado = 'desconectado'; ultima = null;
        if (cerrado) return;
        // Reintento con espera, para no martillar al puente caído.
        reintento = setT(() => { conectar().catch(() => {}); }, 1500);
      };
    });

    return {
      tipo: 'kinect',
      nombre: 'Kinect for Xbox One (puente local)',
      setVideo() { /* el Kinect no necesita el <video> de la página */ },
      async iniciar() {
        cerrado = false;
        await conectar();
        return true;
      },
      detener() {
        cerrado = true;
        if (reintento) { clrT(reintento); reintento = null; }
        try { ws && ws.close(); } catch (e) { /* noop */ }
        ws = null; ultima = null; vivo = false; estado = 'detenido';
        imagen = null; ultimaImagen = 0;
      },
      /** Estado del puente, para el Diagnóstico. */
      salud() {
        return {
          url, estado, vivo, cuadros,
          desdeUltimoCuadro: ultimoCuadro ? nowMs() - ultimoCuadro : null,
          cuerpos: ultima && ultima.kinect ? ultima.kinect.cuerposEnEscena : 0,
          // Cuánta gente vio el sensor pero quedó fuera del rango de juego:
          // es la explicación de "estoy delante y no me toma".
          fueraDeRango,
          tuberia: tuberia.salud(),
          imagenes,
          imagenViva: !!(ultimaImagen && nowMs() - ultimaImagen < 1500),
          propiedades: { cuerpoModo, minCm, maxCm, suave, usarPiso, usarLean, usarManos },
        };
      },
      /**
       * Último cuadro de color del sensor, o null. Se entrega como ImageData
       * para que quien lo pinte no tenga que volver a recorrer los píxeles.
       */
      imagen() {
        if (!ultimaImagen || nowMs() - ultimaImagen > 1500) return null;
        return imagen;
      },
      leer() {
        // Si el puente calla más de medio segundo, es que no hay nadie o se
        // cortó: mejor devolver nada que congelar al jugador en una pose.
        if (ultimoCuadro && nowMs() - ultimoCuadro > 600) return null;
        return ultima;
      },
    };
  }

  /**
   * Elige el motor de pose según la configuración del tótem.
   * `auto` prueba primero el Kinect —si hay puente, es el mejor dato— y si no
   * responde cae a la webcam con MediaPipe, sin que el operador tenga que
   * tocar nada cuando se cambia el hardware.
   */
  /**
   * URL del puente que ya se probó y no respondió, para no reintentarla en
   * cada juego. Se limpia si el puente aparece o si cambian la URL.
   */
  let puenteAusente = null;

  function crearProveedor(hw) {
    const motor = s(hw && hw.motorPose) || 'auto';
    if (motor === 'kinect') return proveedorKinect(hw, model.espacio);
    if (motor === 'sensor') return proveedorSensorRemoto(hw, model.espacio, salaDelTotem());
    if (motor === 'demo') return proveedorDemo();
    return proveedorMediaPipe(hw, model.espacio);
  }

  /**
   * Código de sala de este tótem. Se genera una vez y se guarda: si cambiara en
   * cada arranque, el teléfono tendría que volver a escanear el QR cada vez que
   * alguien reinicia la pantalla, que es justo el día del evento.
   */
  function salaDelTotem() {
    const puesta = salaNormal(model.hardware.sensorSala);
    if (puesta.length >= 4) return puesta;
    const nueva = codigoDeSala(6);
    commit(merge(model, { hardware: { sensorSala: nueva } }));
    return nueva;
  }

  /**
   * Arranca el motor de pose y, SOLO si ese motor lo necesita, la cámara web.
   * El Kinect va por USB al puente local: pedirle permiso de cámara al
   * navegador ahí sería un diálogo inútil y una webcam encendida de gusto.
   *
   * Devuelve el proveedor ya iniciado. Si el Kinect estaba elegido como
   * automático y no hay puente, cae a la webcam sin molestar al jugador.
   */
  async function arrancarPose(hw, videoRef, streamRef) {
    const motor = s(hw && hw.motorPose) || 'auto';

    if (motor === 'kinect' || (motor === 'auto' && puenteAusente !== s(hw && hw.kinectUrl))) {
      const k = proveedorKinect(hw, model.espacio);
      try {
        await k.iniciar();
        puenteAusente = null;
        motorActivo = { tipo: 'kinect', etiqueta: '🦴 Kinect', detalle: 'Esqueleto del Kinect v2 por el puente local' };
        return k;
      } catch (e) {
        try { k.detener(); } catch (e2) { /* noop */ }
        // Se anota que en este tótem no hay puente: sin esto, cada juego que
        // abre vuelve a golpear un WebSocket que no existe y llena la consola
        // de errores.
        puenteAusente = s(hw && hw.kinectUrl);
        // Elegido a mano, el operador TIENE que enterarse. Pero dejar el juego
        // muerto en una feria es peor que jugarlo con la webcam: se avisa
        // fuerte y se sigue. Quien quiera bloquearlo pone "Webcam" o
        // "Desactivado" en el editor, que para eso están.
        if (motor === 'kinect') {
          notify('warn', 'El puente Kinect no responde en ' + puenteAusente +
            '. Se juega con la webcam. Revisa 🎥 Diagnóstico → 5.');
        }
      }
    }
    // El sensor remoto no abre ninguna cámara acá: la cámara está en el
    // teléfono. Va antes de pedir permiso para no dejar una webcam encendida
    // de gusto en el equipo de la pantalla.
    if (motor === 'sensor') {
      const sala = salaDelTotem();
      const p = proveedorSensorRemoto(hw, model.espacio, sala);
      await p.iniciar();
      enlaceActivo = p.enlace;
      motorActivo = {
        tipo: 'sensor', etiqueta: '📱 Teléfono',
        detalle: 'Pose calculada en el teléfono, sala ' + salaLegible(sala) + '. La imagen no sale de ahí.',
      };
      return p;
    }

    if (motor === 'ninguno') throw new Error('El motor de pose está desactivado en ⚙️ Editor → Hardware.');

    const prov = motor === 'demo' ? proveedorDemo() : proveedorMediaPipe(hw, model.espacio);
    if (prov.tipo === 'demo') {
      await prov.iniciar();
      motorActivo = { tipo: 'demo', etiqueta: '🎭 Simulador', detalle: 'Cuerpo sintético: no hay nadie siendo leído' };
      return prov;
    }

    const stream = await abrirCamara(hw);
    if (streamRef) streamRef.current = stream;
    const v = videoRef && videoRef.current;
    if (!v) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ }
      throw new Error('No se pudo montar el elemento de video.');
    }
    v.srcObject = stream;
    await v.play().catch(() => {});
    await prov.iniciar(v);
    motorActivo = motor === 'kinect'
      ? { tipo: 'webcam', etiqueta: '📷 Webcam (sin Kinect)', detalle: 'Se pidió Kinect pero el puente no responde: se está jugando con la cámara' }
      : { tipo: 'webcam', etiqueta: '📷 Webcam', detalle: 'Pose por cámara con MediaPipe' };
    return prov;
  }

  /** Se llama al soltar el motor: fuera de una partida no hay nada que mostrar. */
  function olvidarMotor() { motorActivo = null; enlaceActivo = null; }

  /**
   * Último cuadro de imagen del proveedor, si lo entrega. Solo el Kinect lo
   * hace: la webcam ya pinta sola en su <video>. Se lee en cada render, que es
   * cuando se va a pintar; guardarlo en estado sería copiar píxeles de más.
   */
  function imagenDe(ref) {
    const p = ref && ref.current;
    return p && typeof p.imagen === 'function' ? p.imagen() : null;
  }

  function proveedorMediaPipe(hw, espacio) {
    let landmarker = null, video = null, ultima = null;
    let timer = null, corriendo = false, tsPrev = -1;
    let cuadros = 0, t0 = 0, hzReal = 0, msUltimo = 0;
    const tuberia = tuberiaPose(hw, espacio);
    // Lienzo de recorte: se crea una vez y se reusa. Recortar antes del modelo
    // es lo que deja fuera a quien pasa por detrás, y de paso ALIVIA la CPU
    // —hay menos píxeles que mirar—, así que ayuda al Celeron en vez de
    // castigarlo.
    let lienzo = null, ctx = null, ultimoRecorte = null;

    const objetivoMs = () => 1000 / clamp(num(hw && hw.poseHz, 25), 5, 60);

    /** Prepara el recorte y devuelve la fuente que se le pasa al modelo. */
    const fuente = () => {
      const r = tuberia.recorte();
      ultimoRecorte = null;
      if (!r || typeof document === 'undefined') return video;
      const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
      if (vw < 32 || vh < 32) return video;
      const sx = Math.round(r.x0 * vw), sy = Math.round(r.y0 * vh);
      const sw = Math.max(32, Math.round((r.x1 - r.x0) * vw));
      const sh = Math.max(32, Math.round((r.y1 - r.y0) * vh));
      try {
        if (!lienzo) { lienzo = document.createElement('canvas'); ctx = lienzo.getContext('2d', { willReadFrequently: false }); }
        if (!ctx) return video;
        if (lienzo.width !== sw || lienzo.height !== sh) { lienzo.width = sw; lienzo.height = sh; }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        ultimoRecorte = { sx, sy, sw, sh, vw, vh };
        return lienzo;
      } catch (e) { return video; }
    };

    /**
     * Los puntos vuelven en coordenadas del RECORTE. Hay que devolverlos al
     * cuadro completo o toda la geometría en centímetros —que se calculó para
     * el cuadro entero— quedaría mintiendo.
     */
    const aCuadroCompleto = (L) => {
      const r = ultimoRecorte;
      if (!L || !r) return L;
      return L.map((p) => (p ? {
        x: (r.sx + p.x * r.sw) / r.vw,
        y: (r.sy + p.y * r.sh) / r.vh,
        z: p.z, visibility: p.visibility,
      } : p));
    };

    const unPaso = () => {
      if (!landmarker || !video || video.readyState < 2) return;
      // El aspecto real solo se conoce con vídeo en marcha: hasta acá el
      // recorte trabajaba con el 16:9 supuesto, y en una cámara 4:3 eso deja la
      // franja de juego mal calculada.
      if (video.videoWidth && video.videoHeight) tuberia.setAspecto(video.videoWidth / video.videoHeight);
      const inicio = nowMs();
      let res = null;
      try { res = landmarker.detectForVideo(fuente(), inicio); } catch (e) { return; }
      msUltimo = nowMs() - inicio;
      cuadros++;
      if (!t0) t0 = inicio;
      if (inicio - t0 >= 1000) { hzReal = Math.round((cuadros * 1000) / (inicio - t0)); cuadros = 0; t0 = inicio; }
      const crudo = aCuadroCompleto(res && res.landmarks && res.landmarks[0]);
      const mask = res && res.segmentationMasks && res.segmentationMasks[0];
      if (mask) {
        try { contornoDeMascara(mask); } finally {
          try { mask.close && mask.close(); } catch (e) { /* noop */ }
        }
      }
      const paso = tuberia.procesar(crudo, inicio / 1000);
      if (!paso.landmarks) { ultima = null; return; }
      // Vigilancia del concurso: se hace acá, en el proveedor, para que valga
      // en los once juegos sin tocar ninguno.
      vigilarCuadro(paso.landmarks, video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9);
      ultima = {
        landmarks: paso.landmarks, angulos: null, sintetico: false,
        // Coordenadas del mundo en metros relativas a la cadera (MediaPipe).
        mundo: (res && res.worldLandmarks && res.worldLandmarks[0]) || null,
        contorno: mask ? ultimoContorno : null,
        aceptado: paso.aceptado, motivo: paso.motivo, perdido: paso.perdido,
        confianza: paso.confianza,
      };
    };

    return {
      tipo: 'mediapipe',
      nombre: 'MediaPipe Pose Landmarker',
      tuberia,
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
          // Sigue en 1 por defecto: subirlo cuesta CPU y con el recorte no hace
          // falta para aislar al sujeto. Se sube a mano en equipos capaces.
          numPoses: clamp(Math.round(num(hw.poseNumPoses, 1)), 1, 4),
          // Separa a la persona del fondo. Cuesta CPU: se activa a voluntad.
          outputSegmentationMasks: hw.segmentacion === true,
        });
        // ── Bucle PROPIO, fuera del requestAnimationFrame del juego ──────
        // Antes `detectForVideo` corría dentro del rAF: un cuadro lento de
        // pose trababa el render. Ahora la pose va a su ritmo (20–30 Hz) y el
        // juego dibuja a 60 leyendo la última lectura.
        corriendo = true;
        const tick = () => {
          if (!corriendo) return;
          unPaso();
          timer = setT(tick, Math.max(4, objetivoMs() - msUltimo));
        };
        tick();
        return true;
      },
      detener() {
        corriendo = false;
        if (timer) { clrT(timer); timer = null; }
        try { landmarker && landmarker.close && landmarker.close(); } catch (e) { /* noop */ }
        landmarker = null;
      },
      /** Rendimiento real de la pose en ESTE equipo, para el Diagnóstico. */
      salud: () => Object.assign({ hz: hzReal, ms: Math.round(msUltimo), recorte: !!ultimoRecorte }, tuberia.salud()),
      /** Barato a propósito: solo devuelve la caché, sin trabajo por cuadro. */
      leer() { return ultima; },
    };
  }


  /**
   * Traduce el fallo de `getUserMedia` a algo accionable.
   *
   * Los DOMException de cámara suelen venir con `message` vacío, así que sin
   * esto en pantalla aparece "OverconstrainedError" y nadie sabe qué hacer.
   */
  function mensajeCamara(e) {
    const nombre = s(e && (e.name || e.constructor && e.constructor.name));
    const detalle = s(e && e.message);
    const restriccion = s(e && e.constraint);
    switch (nombre) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Permiso de cámara denegado. Acéptalo en el candado de la barra de direcciones y vuelve a intentarlo.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No hay ninguna cámara conectada a este equipo.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'La cámara está ocupada por otro programa (Zoom, Meet, otra pestaña). Ciérralo y reintenta.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'Esta cámara no acepta la configuración pedida' +
          (restriccion ? ' (' + restriccion + ')' : '') +
          '. Si elegiste una cámara concreta en 🎥 Diagnóstico, puede que ya no esté conectada: deja el campo vacío para usar la predeterminada.';
      case 'SecurityError':
        return 'La cámara requiere HTTPS o localhost (contexto seguro).';
      case 'AbortError':
        return 'El sistema interrumpió la apertura de la cámara. Reintenta.';
      default:
        return detalle || nombre || 'No se pudo abrir la cámara.';
    }
  }

  /**
   * Abre la cámara respetando la configuración del tótem.
   *
   * Se prueban varios juegos de restricciones, de más específico a más
   * permisivo. La razón: `deviceId: {exact}` y `facingMode` son restricciones
   * DURAS, y fallan con OverconstrainedError si la cámara elegida se
   * desconectó, si el navegador rotó los identificadores o si es una webcam
   * de escritorio que no declara hacia dónde mira. Vale más abrir con la
   * cámara predeterminada que dejar el juego sin imagen.
   */
  async function abrirCamara(hw) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Este navegador no expone cámaras (getUserMedia no disponible).');
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      throw new Error('La cámara requiere HTTPS o localhost (contexto seguro).');
    }
    const tam = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    const intentos = [];
    if (hw && hw.camaraDeviceId) {
      // 1. La cámara elegida, con resolución preferida.
      intentos.push(Object.assign({ deviceId: { exact: hw.camaraDeviceId } }, tam));
      // 2. La misma cámara, sin pedirle resolución.
      intentos.push({ deviceId: { exact: hw.camaraDeviceId } });
    }
    // 3. Cualquier cámara con la resolución preferida.
    intentos.push(Object.assign({}, tam));
    // 4. Lo que haya. Este intento solo falla si de verdad no hay cámara o
    //    no hay permiso.
    intentos.push(true);

    let ultimo = null;
    for (let i = 0; i < intentos.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: intentos[i], audio: false });
        // Si hubo que soltar la cámara elegida, conviene decirlo: el operador
        // creyó haber fijado una y está jugando con otra.
        if (i > 1 && hw && hw.camaraDeviceId) {
          notify('info', 'La cámara elegida en el Diagnóstico no está disponible; se abrió la predeterminada.');
        }
        return stream;
      } catch (e) {
        ultimo = e;
        const nombre = s(e && e.name);
        // Ni el permiso ni la ausencia de cámara mejoran aflojando: cortar acá
        // evita tres diálogos de permiso seguidos.
        if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError' || nombre === 'SecurityError') break;
      }
    }
    const err = new Error(mensajeCamara(ultimo));
    err.causa = ultimo;
    throw err;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8.d Robustez del pipeline de pose
  // ══════════════════════════════════════════════════════════════════════
  //
  // La diferencia entre "webcam barata" y "sensor caro" casi nunca está en el
  // modelo de pose: está en lo que se hace con lo que el modelo devuelve. Esta
  // sección es esa capa, compartida por TODOS los proveedores y por todos los
  // juegos, para que nadie tenga que resolverlo por su cuenta.
  //
  // El orden importa y es este:
  //   1. Recortar el cuadro a la zona de juego  → el de atrás no entra
  //   2. Rechazar saltos imposibles             → no se cambia de persona
  //   3. Descartar huesos que se estiran        → no hay landmarks disparados
  //   4. Suavizar con One Euro                  → sin temblor ni retraso
  //   5. Declarar la confianza por grupo        → el juego sabe qué no ve

  /**
   * Filtro One Euro para un valor escalar.
   *
   * Un suavizado exponencial obliga a elegir: o tiembla en reposo o llega
   * tarde en movimiento rápido, porque su constante es fija. One Euro hace la
   * constante función de la VELOCIDAD: quieto filtra fuerte, y en cuanto el
   * valor se mueve se abre y deja pasar el movimiento sin retraso.
   *
   * `minCutoff` en Hz manda en el reposo (más bajo = más suave) y `beta` dice
   * cuánto se abre con la velocidad.
   */
  function unEuro(minCutoff, beta, dCutoff) {
    const mc = Math.max(0.01, num(minCutoff, 1.0));
    const b = Math.max(0, num(beta, 7));
    const dc = Math.max(0.01, num(dCutoff, 1));
    let x = null, dx = 0, tPrev = 0;
    const alfa = (corte, dt) => {
      const tau = 1 / (2 * Math.PI * corte);
      return 1 / (1 + tau / Math.max(1e-4, dt));
    };
    return {
      reset() { x = null; dx = 0; tPrev = 0; },
      /** `t` en segundos. Devuelve el valor filtrado. */
      filtrar(v, t) {
        if (!Number.isFinite(v)) return x == null ? v : x;
        if (x == null) { x = v; tPrev = t; return v; }
        const dt = Math.max(1e-4, t - tPrev);
        tPrev = t;
        const dxCrudo = (v - x) / dt;
        dx = dx + alfa(dc, dt) * (dxCrudo - dx);
        const corte = mc + b * Math.abs(dx);
        x = x + alfa(corte, dt) * (v - x);
        return x;
      },
    };
  }

  /**
   * Suavizado de los 33 puntos. `filtro` elige la estrategia: One Euro por
   * defecto, exponencial como alternativa por si el resultado no convence en
   * algún montaje, y ninguno para ver el dato crudo al depurar.
   */
  function suavizadorPose(hw) {
    const modo = s(hw && hw.filtro) || 'oneeuro';
    const mc = num(hw && hw.oneEuroMinCutoff, 1.0);
    const beta = num(hw && hw.oneEuroBeta, 7);
    const alfa = clamp(num(hw && hw.emaAlfa, 0.35), 0, 0.95);
    let fx = [], fy = [], prev = null;
    return {
      modo,
      reset() { fx = []; fy = []; prev = null; },
      aplicar(L, t) {
        if (!L || modo === 'ninguno') { prev = L; return L; }
        if (modo === 'ema') {
          if (!prev) { prev = L; return L; }
          const out = L.map((p, i) => {
            const q = prev[i];
            if (!p || !q) return p;
            return { x: q.x + (p.x - q.x) * (1 - alfa), y: q.y + (p.y - q.y) * (1 - alfa), z: p.z, visibility: p.visibility };
          });
          prev = out;
          return out;
        }
        const out = L.map((p, i) => {
          if (!p) return p;
          if (!fx[i]) { fx[i] = unEuro(mc, beta); fy[i] = unEuro(mc, beta); }
          return { x: fx[i].filtrar(p.x, t), y: fy[i].filtrar(p.y, t), z: p.z, visibility: p.visibility };
        });
        prev = out;
        return out;
      },
    };
  }

  // Grupos de landmarks, para poder decir QUÉ no se está viendo en vez de un
  // "no te veo" genérico que no ayuda a nadie a colocarse mejor.
  const GRUPOS_POSE = {
    cara: [0, 2, 5, 7, 8],
    brazos: [11, 12, 13, 14, 15, 16],
    torso: [11, 12, 23, 24],
    piernas: [25, 26, 27, 28],
    pies: [29, 30, 31, 32],
  };

  /**
   * Confianza media por grupo, y si cada uno pasa el umbral. Generaliza a todo
   * el cuerpo lo que `seguidorCuerpo` ya hacía solo con el tren inferior: si un
   * grupo no se ve, se DECLARA y el juego usa su señal alternativa, en vez de
   * trabajar con números inventados.
   */
  function confianzaPorGrupo(L, umbral) {
    const u = num(umbral, 0.4);
    const out = { umbral: u, grupos: {}, faltan: [] };
    if (!L) {
      for (const g of Object.keys(GRUPOS_POSE)) out.grupos[g] = { media: 0, ok: false };
      out.faltan = Object.keys(GRUPOS_POSE);
      return out;
    }
    for (const g of Object.keys(GRUPOS_POSE)) {
      const idx = GRUPOS_POSE[g];
      let suma = 0, n = 0;
      for (const i of idx) {
        const p = L[i];
        if (!p) continue;
        suma += p.visibility == null ? 1 : p.visibility;
        n++;
      }
      const media = n ? suma / n : 0;
      const ok = n > 0 && media >= u;
      out.grupos[g] = { media: round1(media * 100) / 100, ok };
      if (!ok) out.faltan.push(g);
    }
    return out;
  }

  // Segmentos cuyo largo NO cambia de un cuadro a otro en una misma persona.
  const HUESOS_RIGIDOS = [
    [11, 13], [13, 15], [12, 14], [14, 16],   // brazos
    [11, 12], [23, 24], [11, 23], [12, 24],   // torso
    [23, 25], [25, 27], [24, 26], [26, 28],   // piernas
  ];

  /**
   * Los largos de segmento de una persona son constantes. Se miden mientras
   * está quieta y desde ahí sirven de control: un cuadro donde un antebrazo
   * mide el doble no es un brazo que creció, es el modelo confundiéndose, y
   * casi todos los saltos de landmark se ven así.
   *
   * Se compara normalizado por la escala corporal, para que acercarse o
   * alejarse de la cámara no dispare falsos positivos.
   */
  function controlDeHuesos(opts) {
    const o = opts || {};
    const tol = clamp(num(o.tolerancia, 0.35), 0.05, 2);
    const muestrasMin = Math.max(4, num(o.muestras, 10));
    let largos = null, acum = [], n = 0;
    const largo = (L, a, b, esc) => {
      const p = L[a], q = L[b];
      if (!p || !q || !esc) return null;
      const vis = (x) => x.visibility == null || x.visibility > 0.4;
      if (!vis(p) || !vis(q)) return null;
      return Math.hypot(p.x - q.x, p.y - q.y) / esc;
    };
    return {
      reset() { largos = null; acum = []; n = 0; },
      calibrado() { return !!largos; },
      /** Aprende los largos con la persona en la pose de calibración. */
      aprender(L) {
        const esc = escalaCorporal(L, 'superior');
        if (!L || !esc) return false;
        const fila = HUESOS_RIGIDOS.map(([a, b]) => largo(L, a, b, esc));
        acum.push(fila);
        n++;
        if (n < muestrasMin) return false;
        // Mediana por hueso: aguanta un cuadro malo dentro de la calibración.
        largos = HUESOS_RIGIDOS.map((_, k) => {
          const vals = acum.map((f) => f[k]).filter((v) => v != null).sort((x, y) => x - y);
          return vals.length ? vals[Math.floor(vals.length / 2)] : null;
        });
        return true;
      },
      /**
       * `{ ok, peor, hueso }`. `ok:false` significa "este cuadro no es de fiar".
       * Sin calibración previa nunca rechaza: no se inventa un veredicto.
       */
      revisar(L) {
        if (!largos || !L) return { ok: true, peor: 0, hueso: null };
        const esc = escalaCorporal(L, 'superior');
        if (!esc) return { ok: true, peor: 0, hueso: null };
        let peor = 0, cual = null;
        for (let k = 0; k < HUESOS_RIGIDOS.length; k++) {
          const esperado = largos[k];
          if (esperado == null || esperado < 0.05) continue;
          const actual = largo(L, HUESOS_RIGIDOS[k][0], HUESOS_RIGIDOS[k][1], esc);
          if (actual == null) continue;
          const desvio = Math.abs(actual - esperado) / esperado;
          if (desvio > peor) { peor = desvio; cual = HUESOS_RIGIDOS[k]; }
        }
        return { ok: peor <= tol, peor: round1(peor * 100) / 100, hueso: cual };
      },
    };
  }

  /**
   * Ventana temporal de una señal, para reconocer gestos por su FORMA.
   *
   * Un umbral sobre un solo cuadro confunde un golpe con un pico de ruido: el
   * modelo tiembla, la señal salta y el juego registra un golpe que nadie dio.
   * Un gesto de verdad tiene forma en el tiempo —sube durante 100–200 ms y
   * después baja—, y eso el ruido no lo imita.
   *
   * Guarda unos 300 ms de historia y sabe responder tres cosas: cuánto valió
   * el pico, en cuánto tiempo subió, y si la subida fue sostenida o un pico
   * suelto.
   */
  function ventanaGesto(ms) {
    const largo = Math.max(80, num(ms, 300));
    let h = [];
    return {
      reset() { h = []; },
      largoMs: largo,
      muestras: () => h.length,
      empujar(v, t) {
        if (!Number.isFinite(v)) return;
        h.push({ v, t });
        const corte = t - largo;
        while (h.length && h[0].t < corte) h.shift();
      },
      /**
       * `{ pico, tPico, inicio, subida, sostenido, duracionMs }` de la
       * excursión que termina en el pico de la ventana. `subida` es la
       * velocidad media de subida, no la de un cuadro.
       */
      forma() {
        if (h.length < 3) return null;
        let iPico = 0;
        for (let i = 1; i < h.length; i++) if (h[i].v > h[iPico].v) iPico = i;
        const pico = h[iPico];
        // Desde dónde arrancó la subida: el mínimo ANTES del pico.
        let iMin = 0;
        for (let i = 0; i <= iPico; i++) if (h[i].v < h[iMin].v) iMin = i;
        const base = h[iMin];
        const dt = Math.max(1, pico.t - base.t) / 1000;
        const amplitud = pico.v - base.v;
        // Cómo se repartió la subida. Contar cuadros "no decrecientes" no
        // sirve: una línea plana seguida de un pico los cumple todos y es
        // justo el ruido que hay que descartar. Lo que distingue un gesto es
        // que ningún cuadro suelto se lleva casi toda la amplitud.
        let mayorPaso = 0;
        for (let i = iMin + 1; i <= iPico; i++) mayorPaso = Math.max(mayorPaso, h[i].v - h[i - 1].v);
        const pasos = Math.max(1, iPico - iMin);
        return {
          pico: pico.v, tPico: pico.t, base: base.v, amplitud,
          subida: amplitud / dt,
          duracionMs: pico.t - base.t,
          sostenido: pasos >= 2 && amplitud > 0 && mayorPaso <= amplitud * 0.7,
          mayorPaso,
          cayendo: iPico < h.length - 2 && h[h.length - 1].v < pico.v * 0.75,
        };
      },
      /** Cuánto tiempo seguido la señal estuvo por encima (o debajo) del umbral. */
      msSobre(umbral, signo) {
        if (!h.length) return 0;
        const sg = signo === -1 ? -1 : 1;
        let desde = null;
        for (let i = h.length - 1; i >= 0; i--) {
          if (sg * h[i].v >= sg * umbral) desde = h[i].t; else break;
        }
        return desde == null ? 0 : h[h.length - 1].t - desde;
      },
    };
  }

  /**
   * Traduce la confianza por grupo a algo que una persona pueda obedecer.
   * "No te veo" no le dice a nadie qué hacer; "no veo tus piernas" sí.
   */
  function avisoDeEncuadre(conf, lo) {
    if (!conf) return 'No te veo: ponte frente al tótem';
    const faltan = conf.faltan || [];
    if (!faltan.length) return '';
    // Se avisa del grupo que el juego NECESITA, si se declaró cuál.
    const pide = lo && faltan.indexOf(lo) >= 0 ? lo : faltan[0];
    const frases = {
      cara: 'No veo tu cara: mira al tótem',
      brazos: 'No veo tus brazos: sepáralos del cuerpo',
      torso: 'No te veo entero: ponte frente al tótem',
      piernas: 'No veo tus piernas: aléjate un paso',
      pies: 'No veo tus pies: aléjate del tótem',
    };
    return frases[pide] || 'No te veo: ponte frente al tótem';
  }

  /** Caja que encierra los puntos visibles, en coordenadas de imagen 0..1. */
  function cajaDePose(L, minVis) {
    if (!L) return null;
    const u = num(minVis, 0.4);
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0, n = 0;
    for (const p of L) {
      if (!p || (p.visibility != null && p.visibility < u)) continue;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      n++;
    }
    if (n < 4 || x1 <= x0 || y1 <= y0) return null;
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * Región de la imagen que ocupa el VOLUMEN DE JUEGO declarado, según la
   * geometría de la cámara. Es el recorte de partida: quien esté fuera de la
   * zona ni siquiera entra al cuadro que ve el modelo.
   */
  function regionDeZona(espacio, aspecto) {
    const al = alcanceVertical(espacio, aspecto);
    const g = al.g;
    const zona = clamp(num(espacio && espacio.distanciaZona, 220), 40, 600);
    const alto = clamp(num(espacio && espacio.alto, 240), 80, 300);
    const ancho = clamp(num(espacio && espacio.ancho, 220), 60, 500);
    // Alto y ancho que abarca la cámara a esa distancia, en cm.
    const abarcaAlto = 2 * zona * g.tanV;
    const abarcaAncho = 2 * zona * g.tanH;
    if (abarcaAlto <= 1 || abarcaAncho <= 1) return null;
    // El centro óptico apunta a esta altura sobre el piso, a esa distancia.
    const centroCm = al.hc - zona * Math.tan(rad(al.incl));
    // Alturas 0 y `alto` llevadas a la imagen (y crece hacia abajo).
    const yDe = (cm) => 0.5 - (cm - centroCm) / abarcaAlto;
    // Sin recortar a 0..1: es lo que permite decir si la zona SE SALE del
    // cuadro. Recortando primero, una franja que se pierde por arriba y una que
    // entra justa se ven idénticas, y son dos montajes muy distintos.
    const cy0 = yDe(alto), cy1 = yDe(0);
    const y0 = clamp(cy0, 0, 1);
    const y1 = clamp(cy1, 0, 1);
    const mitadCruda = ancho / abarcaAncho / 2;
    const mitad = clamp(mitadCruda, 0.05, 0.5);
    const largo = Math.max(1e-6, cy1 - cy0);
    return {
      x0: 0.5 - mitad, x1: 0.5 + mitad, y0, y1, valida: y1 - y0 > 0.12,
      crudo: { y0: cy0, y1: cy1, mitad: mitadCruda },
      // Fracción de la zona declarada que de verdad entra en el cuadro.
      cubre: {
        alto: clamp((Math.min(cy1, 1) - Math.max(cy0, 0)) / largo, 0, 1),
        ancho: clamp(Math.min(mitadCruda, 0.5) / Math.max(1e-6, mitadCruda), 0, 1),
        pierdeArriba: Math.max(0, -cy0) / largo,
        pierdeAbajo: Math.max(0, cy1 - 1) / largo,
      },
    };
  }

  /**
   * Sigue a UN sujeto durante la ronda y no lo suelta.
   *
   * No elige entre varios esqueletos —con `numPoses: 1` el modelo entrega uno
   * solo y lo elige él—: lo que hace es NEGARSE a aceptar un cuadro donde el
   * cuerpo saltó de sitio o cambió de tamaño de golpe, que es exactamente lo
   * que ocurre cuando el modelo se pasa a la persona que cruza por detrás.
   *
   * Si la discontinuidad persiste, se declara `perdido` y el juego pide
   * reencuadre en vez de seguir jugando con otra persona.
   */
  function seguidorSujeto(hw, espacio) {
    const saltoMax = clamp(num(hw && hw.saltoMaximo, 0.28), 0.05, 1);
    const escalaMax = clamp(num(hw && hw.escalaMaxima, 0.45), 0.05, 3);
    const limitePerdidos = Math.max(3, num(hw && hw.cuadrosPerdidos, 12));
    const margen = clamp(num(hw && hw.recorteMargen, 0.18), 0, 0.6);
    const usarRecorte = (hw && hw.recorteZona) !== false;
    // El aspecto NO es un detalle: el campo vertical sale del horizontal
    // dividido por él, así que con una cámara 4:3 la zona ocupa una franja
    // distinta de la que ocupa en 16:9. Se parte de 16:9 porque es lo habitual
    // y porque al construir el seguidor todavía no hay vídeo, pero el proveedor
    // avisa del aspecto real en cuanto lo sabe.
    let aspecto = 16 / 9;
    let zona = usarRecorte ? regionDeZona(espacio, aspecto) : null;
    let ancla = null, perdidos = 0, bloqueado = false;
    return {
      reset() { ancla = null; perdidos = 0; bloqueado = false; },
      bloqueado: () => bloqueado,
      aspecto: () => aspecto,
      zona: () => zona,
      /** Aspecto real del vídeo; recalcula la zona si cambió de verdad. */
      setAspecto(a) {
        const v = num(a, 0);
        if (!(v > 0.2 && v < 6) || Math.abs(v - aspecto) < 0.01) return false;
        aspecto = v;
        zona = usarRecorte ? regionDeZona(espacio, aspecto) : null;
        return true;
      },
      /**
       * Recorte a aplicar sobre el cuadro ANTES del modelo, en 0..1.
       * Al empezar es la zona de juego declarada; una vez enganchado el
       * sujeto, se ciñe a él con margen. Devuelve null = cuadro entero.
       */
      recorte() {
        if (!usarRecorte) return null;
        const base = zona && zona.valida ? zona : null;
        if (!ancla) return base;
        const m = margen;
        const c = {
          x0: ancla.x0 - ancla.w * m, x1: ancla.x1 + ancla.w * m,
          y0: ancla.y0 - ancla.h * m, y1: ancla.y1 + ancla.h * m,
        };
        // Intersección con la zona: el de atrás queda fuera por las dos vías.
        if (base) {
          c.x0 = Math.max(c.x0, base.x0); c.x1 = Math.min(c.x1, base.x1);
          c.y0 = Math.max(c.y0, base.y0); c.y1 = Math.min(c.y1, base.y1);
        }
        c.x0 = clamp(c.x0, 0, 1); c.y0 = clamp(c.y0, 0, 1);
        c.x1 = clamp(c.x1, 0, 1); c.y1 = clamp(c.y1, 0, 1);
        if (c.x1 - c.x0 < 0.12 || c.y1 - c.y0 < 0.12) return base;
        return c;
      },
      /**
       * `{ aceptado, motivo, perdido, salto, cambioEscala }`.
       * Rechazar un cuadro no es perderlo: el juego sigue con el último bueno.
       */
      revisar(L) {
        const caja = cajaDePose(L);
        if (!caja) {
          perdidos++;
          return { aceptado: false, motivo: 'sin cuerpo', perdido: perdidos >= limitePerdidos, salto: 0, cambioEscala: 0 };
        }
        if (!ancla) {
          ancla = caja; perdidos = 0; bloqueado = true;
          return { aceptado: true, motivo: 'enganchado', perdido: false, salto: 0, cambioEscala: 0 };
        }
        const salto = Math.hypot(caja.cx - ancla.cx, caja.cy - ancla.cy);
        const escalaAntes = Math.max(0.01, ancla.h);
        const cambio = Math.abs(caja.h - escalaAntes) / escalaAntes;
        if (salto > saltoMax || cambio > escalaMax) {
          perdidos++;
          // Si el rechazo se sostiene, es que la persona de verdad se movió o
          // se fue: se declara perdido y que el juego pida reencuadre.
          if (perdidos >= limitePerdidos) { ancla = caja; perdidos = 0; return { aceptado: true, motivo: 'reenganchado', perdido: true, salto, cambioEscala: cambio }; }
          return { aceptado: false, motivo: salto > saltoMax ? 'salto' : 'cambio de tamaño', perdido: false, salto, cambioEscala: cambio };
        }
        // Seguimiento suave: el ancla acompaña, no se teletransporta.
        const k = 0.35;
        ancla = {
          x0: ancla.x0 + (caja.x0 - ancla.x0) * k, x1: ancla.x1 + (caja.x1 - ancla.x1) * k,
          y0: ancla.y0 + (caja.y0 - ancla.y0) * k, y1: ancla.y1 + (caja.y1 - ancla.y1) * k,
          cx: ancla.cx + (caja.cx - ancla.cx) * k, cy: ancla.cy + (caja.cy - ancla.cy) * k,
          w: ancla.w + (caja.w - ancla.w) * k, h: ancla.h + (caja.h - ancla.h) * k,
        };
        perdidos = 0;
        return { aceptado: true, motivo: 'seguido', perdido: false, salto, cambioEscala: cambio };
      },
    };
  }

  /**
   * La tubería completa, en el orden de arriba. La usan los DOS proveedores,
   * para que la garantía de "sujeto bloqueado durante la ronda" sea la misma
   * se juegue con webcam o con Kinect.
   */
  function tuberiaPose(hw, espacio) {
    const sujeto = seguidorSujeto(hw, espacio);
    const suave = suavizadorPose(hw);
    const huesos = controlDeHuesos({ tolerancia: num(hw && hw.huesoTolerancia, 0.35) });
    const conHuesos = (hw && hw.huesosRigidos) !== false;
    let ultimoBueno = null, rechazados = 0, aceptados = 0;
    return {
      sujeto, huesos,
      reset() { sujeto.reset(); suave.reset(); huesos.reset(); ultimoBueno = null; rechazados = 0; aceptados = 0; },
      recorte: () => sujeto.recorte(),
      setAspecto: (a) => sujeto.setAspecto(a),
      zona: () => sujeto.zona(),
      /** Se llama durante la pantalla de posicionamiento. */
      calibrar(L) { return conHuesos ? huesos.aprender(L) : true; },
      salud: () => ({
        aceptados, rechazados, bloqueado: sujeto.bloqueado(), huesosCalibrados: huesos.calibrado(),
        aspecto: sujeto.aspecto(), zona: sujeto.zona(),
      }),
      /**
       * `{ landmarks, aceptado, motivo, perdido, confianza }`.
       * Si el cuadro se rechaza se devuelve el último bueno: un juego no se
       * congela por un cuadro malo, pero tampoco obedece a uno inventado.
       */
      procesar(L, t) {
        const veredicto = sujeto.revisar(L);
        let motivo = veredicto.motivo;
        let aceptado = veredicto.aceptado;
        if (aceptado && conHuesos) {
          const h2 = huesos.revisar(L);
          if (!h2.ok) { aceptado = false; motivo = 'hueso estirado'; }
        }
        if (!aceptado) {
          rechazados++;
          return { landmarks: ultimoBueno, aceptado: false, motivo, perdido: veredicto.perdido, confianza: confianzaPorGrupo(ultimoBueno) };
        }
        aceptados++;
        const filtrado = suave.aplicar(L, t);
        ultimoBueno = filtrado;
        return { landmarks: filtrado, aceptado: true, motivo, perdido: veredicto.perdido, confianza: confianzaPorGrupo(filtrado) };
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8.e Luz de la escena (lo único que no se arregla por software)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Todo lo demás de la Fase 2 —filtrar, recortar, descartar cuadros malos— es
  // software peleando con una señal ruidosa. La poca luz no es eso: si el
  // sensor no recibe fotones, no hay nada que filtrar. Por eso la luz no se
  // supone ni se recomienda de palabra: se MIDE en el equipo real.
  //
  // Y no basta con el brillo medio. Toda webcam moderna tiene exposición y
  // ganancia automáticas: en penumbra sube la ganancia hasta que la imagen sale
  // con brillo "normal", solo que llena de ruido. Un medidor que solo mirara el
  // nivel daría luz verde a una sala mal iluminada. Por eso se miden dos cosas
  // y se cruzan:
  //
  //   nivel  → luma media del SUJETO, no del cuadro (el ventanal no juega)
  //   ruido  → cuánto cambia cada píxel entre cuadros con la escena quieta;
  //            es la firma de la ganancia alta, o sea de la falta de luz
  //
  // Y una tercera, que es la que arruina ferias: el CONTRALUZ. Con un ventanal
  // detrás, la cámara expone para el fondo y la persona queda en silueta. No se
  // arregla con más luz ni con mejor modelo: hay que girar el montaje.

  /** Luma Rec.709 sobre sRGB (0–255): se corresponde con el brillo percibido. */
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  /**
   * Lee píxeles del vídeo a baja resolución y devuelve nivel, recorte de
   * histograma, ruido temporal y la comparación sujeto/fondo.
   *
   * Trabaja sobre una rejilla chica (160×90 = 14.400 píxeles): es suficiente
   * para promedios y ruido, y cuesta una fracción de milisegundo, así que se
   * puede medir junto a la pose sin robarle cuadros.
   */
  function medidorDeLuz(opts) {
    const o = opts || {};
    const ancho = Math.max(16, Math.round(num(o.ancho, 160)));
    let lienzo = null, ctx = null, alto = 0, previa = null;
    const ruidos = [];

    const preparar = (fuente) => {
      const fw = fuente.videoWidth || fuente.width || 0;
      const fh = fuente.videoHeight || fuente.height || 0;
      if (fw < 8 || fh < 8) return false;
      const nuevoAlto = Math.max(9, Math.round((ancho * fh) / fw));
      if (!lienzo) {
        lienzo = document.createElement('canvas');
        // Se lee cada cuadro: sin esta bandera el navegador mantiene la textura
        // en la GPU y cada getImageData obliga a un viaje de vuelta carísimo.
        ctx = lienzo.getContext('2d', { willReadFrequently: true });
      }
      if (!ctx) return false;
      if (lienzo.width !== ancho || lienzo.height !== nuevoAlto) {
        lienzo.width = ancho; lienzo.height = nuevoAlto;
        previa = null;                      // cambió la rejilla: el ruido no compara
      }
      alto = nuevoAlto;
      return true;
    };

    return {
      reset() { previa = null; ruidos.length = 0; },
      /**
       * Una lectura. `caja` es la caja del sujeto en 0..1 (de `cajaDePose`) o
       * la zona de juego cuando todavía no hay nadie; sin ella no se puede
       * separar sujeto de fondo y esos campos vuelven en null.
       */
      medir(fuente, caja) {
        if (!fuente || typeof document === 'undefined') return null;
        let px = null;
        try {
          if (!preparar(fuente)) return null;
          ctx.drawImage(fuente, 0, 0, ancho, alto);
          px = ctx.getImageData(0, 0, ancho, alto).data;
        } catch (e) { return null; }        // lienzo contaminado o vídeo sin cuadro
        const n = ancho * alto;
        const gris = new Float32Array(n);
        let suma = 0, oscuros = 0, quemados = 0;
        let sumaS = 0, nS = 0, sumaF = 0, nF = 0;
        const dentro = caja
          ? (x, y) => x >= caja.x0 && x <= caja.x1 && y >= caja.y0 && y <= caja.y1
          : null;
        for (let i = 0; i < n; i++) {
          const j = i * 4;
          const L = luma(px[j], px[j + 1], px[j + 2]);
          gris[i] = L;
          suma += L;
          if (L < 16) oscuros++;
          else if (L > 245) quemados++;
          if (dentro) {
            const u = (i % ancho) / ancho, v = Math.floor(i / ancho) / alto;
            if (dentro(u, v)) { sumaS += L; nS++; } else { sumaF += L; nF++; }
          }
        }
        // Ruido temporal: cuánto se mueve cada píxel de un cuadro al siguiente.
        // Con la escena quieta es ganancia del sensor; si la persona se mueve
        // también sube, por eso el resumen se queda con los cuadros tranquilos.
        let ruido = null;
        if (previa && previa.length === n) {
          let d = 0;
          for (let i = 0; i < n; i++) d += Math.abs(gris[i] - previa[i]);
          ruido = d / n;
          ruidos.push(ruido);
        }
        previa = gris;
        return {
          media: round1(suma / n),
          oscuros: round1((oscuros / n) * 100),
          quemados: round1((quemados / n) * 100),
          ruido: ruido == null ? null : round1(ruido * 100) / 100,
          sujeto: nS ? round1(sumaS / nS) : null,
          fondo: nF ? round1(sumaF / nF) : null,
          contraluz: nS && nF ? round1(sumaF / nF - sumaS / nS) : null,
          conCaja: !!dentro,
        };
      },
      /**
       * Ruido representativo de la sesión: el percentil 25 de las lecturas.
       *
       * No la media: si alguien saluda a la cámara, esos cuadros disparan el
       * ruido por movimiento y no por falta de luz. Los cuadros tranquilos son
       * los que hablan del sensor, y son los de abajo del reparto.
       */
      ruidoBase() {
        if (!ruidos.length) return null;
        const v = ruidos.slice().sort((a, b) => a - b);
        return round1(v[Math.floor(v.length * 0.25)] * 100) / 100;
      },
      muestras: () => ruidos.length,
    };
  }

  /**
   * De números a decisión. Devuelve `{ nivel, titulo, acciones[] }` donde
   * `nivel` es 'ok' | 'aviso' | 'mal', para que el operador no tenga que
   * interpretar un luma de 63 el día del evento.
   */
  function veredictoDeLuz(luz, hw) {
    const minima = num(hw && hw.luzMinima, 80);
    const ruidoMax = num(hw && hw.luzRuidoMax, 4.5);
    const contraMax = num(hw && hw.contraluzMax, 60);
    if (!luz) return { nivel: 'mal', titulo: 'No se pudo leer la imagen', acciones: ['Revisa que la cámara esté entregando vídeo.'] };
    const acciones = [];
    let nivel = 'ok';
    const peor = (n) => { if (n === 'mal' || (n === 'aviso' && nivel === 'ok')) nivel = n; };
    // El nivel se juzga sobre el sujeto; sin nadie delante, sobre lo que haya, y
    // se DICE, porque medir la zona vacía no es medir a quien va a jugar.
    const deCuerpo = luz.deCuerpo !== false && luz.sujeto != null;
    const nivelLuz = luz.sujeto != null ? luz.sujeto : luz.media;
    const donde = deCuerpo ? 'sobre el sujeto' : 'sobre la zona de juego, sin nadie delante';
    if (nivelLuz < minima * 0.7) {
      peor('mal');
      acciones.push('Muy oscuro (' + Math.round(nivelLuz) + ' de ' + Math.round(minima) + ' mínimo): agrega un panel LED difuso junto a la cámara, a la altura de la cara.');
    } else if (nivelLuz < minima) {
      peor('aviso');
      acciones.push('Luz justa (' + Math.round(nivelLuz) + ' de ' + Math.round(minima) + '): funciona, pero la detección será menos estable. Un LED de relleno lo resuelve.');
    }
    if (luz.ruido != null && luz.ruido > ruidoMax * 1.6) {
      peor('mal');
      acciones.push('Mucho ruido de imagen (' + luz.ruido.toFixed(1) + '): la cámara está compensando la falta de luz con ganancia. Más luz, no otra cámara.');
    } else if (luz.ruido != null && luz.ruido > ruidoMax) {
      peor('aviso');
      acciones.push('Ruido de imagen alto (' + luz.ruido.toFixed(1) + '): la cámara está subiendo ganancia. Con más luz baja solo.');
    }
    if (luz.contraluz != null && luz.contraluz > contraMax) {
      peor('mal');
      acciones.push('Contraluz fuerte: el fondo está ' + Math.round(luz.contraluz) + ' puntos más claro que la persona. ' +
        'GIRA EL MONTAJE para dejar el ventanal a la espalda de la cámara, o cierra la cortina. Con más luz frontal no alcanza.');
    } else if (luz.contraluz != null && luz.contraluz > contraMax * 0.45) {
      peor('aviso');
      acciones.push('Contraluz leve: el fondo está ' + Math.round(luz.contraluz) + ' puntos más claro. Si la detección falla, gira el montaje.');
    }
    if (luz.quemados > 12) {
      peor(luz.contraluz != null && luz.contraluz > contraMax * 0.45 ? 'mal' : 'aviso');
      acciones.push(round1(luz.quemados) + '% del cuadro está quemado (blanco puro): casi siempre es una ventana o una lámpara dentro del encuadre.');
    }
    if (luz.oscuros > 45) {
      peor('aviso');
      acciones.push(round1(luz.oscuros) + '% del cuadro es negro puro: hay zonas donde el modelo no puede ver nada.');
    }
    const titulo = nivel === 'ok' ? 'La luz sirve' : nivel === 'aviso' ? 'La luz da, con reparos' : 'La luz NO da';
    return { nivel, titulo, acciones, nivelLuz: round1(nivelLuz), donde, deCuerpo, sinSujeto: luz.sujeto == null };
  }

  /**
   * Junta las lecturas de luz de toda la prueba en una sola.
   *
   * Se prefieren los cuadros en los que HABÍA alguien: son los únicos donde
   * "sujeto" y "fondo" significan algo, y son los que describen la condición
   * real de juego. Mediana y no media, porque un cuadro con alguien cruzando
   * por delante de la ventana no puede decidir el veredicto.
   */
  function resumirLuz(muestras, ruidoBase) {
    const todas = (muestras || []).filter(Boolean);
    if (!todas.length) return null;
    // Una lectura vale como "del sujeto" solo si había un CUERPO detectado. Sin
    // nadie delante la caja es la zona de juego vacía, y llamar a eso "luz
    // sobre la persona" sería exactamente la clase de dato cómodo que este
    // diagnóstico existe para no dar.
    const con = todas.filter((x) => x.cuerpo && x.sujeto != null);
    const base = con.length >= 3 ? con : todas;
    const med = (k) => mediana(base.map((x) => x[k]).filter((v) => v != null));
    return {
      media: med('media'), oscuros: med('oscuros') || 0, quemados: med('quemados') || 0,
      sujeto: med('sujeto'), fondo: med('fondo'), contraluz: med('contraluz'),
      ruido: ruidoBase == null ? null : ruidoBase,
      muestras: base.length, conSujeto: con.length, deCuerpo: con.length >= 3,
    };
  }

  // Cuánto dura la prueba de campo. Veinte segundos son suficientes para que el
  // ritmo de pose se estabilice y para juntar un centenar de lecturas de luz, y
  // son pocos como para que un operador con fila esperando la corra igual.
  const CAMPO_MS = 20000;

  const PEOR = { ok: 0, aviso: 1, mal: 2 };
  const sumarNivel = (a, b) => (PEOR[b] > PEOR[a] ? b : a);

  /**
   * El veredicto completo del montaje, a partir de lo medido en 20 segundos.
   *
   * Junta las cuatro cosas que de verdad deciden si el tótem sirve hoy: a qué
   * ritmo corre la pose EN ESTE equipo, si hay luz, si el modelo ve las partes
   * del cuerpo que cada juego necesita, y si la zona de juego declarada cabe en
   * el cuadro. Devuelve un semáforo y, sobre todo, qué hacer con él.
   */
  function veredictoDeCampo(res, hw) {
    const puntos = [];
    let nivel = 'ok';
    const punto = (n, texto) => { puntos.push({ nivel: n, texto }); nivel = sumarNivel(nivel, n); };
    const objetivo = clamp(num(hw && hw.poseHz, 25), 5, 60);

    // ── Ritmo real de la pose ──────────────────────────────────────────
    // No el del fabricante ni el configurado: el que da este equipo. Por
    // debajo de ~12 Hz un salto entero cabe entre dos cuadros y el juego no lo
    // ve; la ventana de gesto necesita tres o cuatro muestras para reconocer
    // una subida sostenida y distinguirla de un tirón del modelo.
    if (!res.cuadros) punto('mal', 'La pose no llegó a correr: no hay medición de ritmo.');
    else if (res.hz < 12) punto('mal', 'Pose a ' + res.hz + ' fps: por debajo de 12 se pierden saltos y golpes enteros. Baja la resolución de la cámara o usa un equipo con más CPU.');
    else if (res.hz < 18) punto('aviso', 'Pose a ' + res.hz + ' fps (' + res.ms + ' ms por cuadro): jugable, pero los gestos rápidos van a costar. Objetivo configurado: ' + objetivo + '.');
    else punto('ok', 'Pose a ' + res.hz + ' fps reales, ' + res.ms + ' ms por cuadro. Objetivo configurado: ' + objetivo + '.');

    // ── Estabilidad del seguimiento ────────────────────────────────────
    const total = num(res.aceptados, 0) + num(res.rechazados, 0);
    const tasa = total ? res.rechazados / total : 0;
    if (total >= 20 && tasa > 0.5) punto('mal', Math.round(tasa * 100) + '% de los cuadros se descartaron por salto o hueso estirado: el modelo está saltando de persona o el encuadre no da.');
    else if (total >= 20 && tasa > 0.25) punto('aviso', Math.round(tasa * 100) + '% de cuadros descartados: revisa que no pase gente por detrás de quien juega.');

    // ── Qué partes del cuerpo se ven ───────────────────────────────────
    const g = res.grupos || {};
    const vale = (k) => g[k] != null && g[k] >= 0.4;
    const pct = (k) => (g[k] == null ? '—' : Math.round(g[k] * 100) + '%');
    if (!res.conPersona) punto('mal', 'No se detectó a nadie en los 20 segundos: la prueba mide la sala, no el montaje. Repítela con alguien parado en la marca.');
    else if (!vale('torso')) punto('mal', 'No se ve el torso con confianza (' + pct('torso') + '): sin él no funciona ningún juego de cámara.');
    else {
      const medio = vale('torso') && vale('brazos');
      const completo = medio && vale('piernas') && vale('pies');
      if (completo) punto('ok', 'Se ve el cuerpo entero (torso ' + pct('torso') + ', brazos ' + pct('brazos') + ', piernas ' + pct('piernas') + ', pies ' + pct('pies') + '): sirven los once juegos.');
      else if (medio) punto('aviso', 'Se ve medio cuerpo (torso ' + pct('torso') + ', brazos ' + pct('brazos') + ') pero no ' +
        (!vale('piernas') ? 'las piernas (' + pct('piernas') + ')' : 'los pies (' + pct('pies') + ')') +
        ': Prueba de baile y el modo cámara de Mete gol quedan fuera. Aleja la cámara o baja la marca del piso. Los demás juegos, y todas las entradas alternativas, siguen sirviendo.');
      else punto('aviso', 'No se ven los brazos con confianza (' + pct('brazos') + '): pídele a quien juega que los separe del cuerpo.');
    }

    // ── ¿La zona declarada cabe en el cuadro? ──────────────────────────
    const z = res.zona;
    if (z && z.cubre) {
      const falta = 1 - z.cubre.alto;
      const detalle = (z.cubre.pierdeArriba > z.cubre.pierdeAbajo)
        ? 'se pierde por ARRIBA (' + Math.round(z.cubre.pierdeArriba * 100) + '%): inclina menos la cámara o súbela'
        : 'se pierde por ABAJO (' + Math.round(z.cubre.pierdeAbajo * 100) + '%): inclina más la cámara o bájala';
      if (falta > 0.25) punto('mal', 'La franja de juego declarada NO cabe en el cuadro: solo entra el ' + Math.round(z.cubre.alto * 100) + '% de su alto y ' + detalle + '.');
      else if (falta > 0.08) punto('aviso', 'La franja de juego entra al ' + Math.round(z.cubre.alto * 100) + '%: ' + detalle + '.');
      else punto('ok', 'La zona de juego declarada cabe entera en el cuadro (' + Math.round(z.cubre.alto * 100) + '% del alto).');
      if (z.cubre.ancho < 0.95) punto('aviso', 'El ancho declarado tampoco cabe: entra el ' + Math.round(z.cubre.ancho * 100) + '%. Aleja la cámara o reduce el ancho en 📐 Espacio.');
    }
    if (res.recorte === false && (hw && hw.recorteZona) !== false) {
      punto('aviso', 'El recorte a la zona no llegó a activarse: se está mirando el cuadro entero, así que quien pase por detrás puede robar la detección.');
    }

    // ── Luz ────────────────────────────────────────────────────────────
    const vl = veredictoDeLuz(res.luz, hw);
    nivel = sumarNivel(nivel, vl.nivel);
    for (const a of vl.acciones) puntos.push({ nivel: vl.nivel, texto: a });
    if (vl.nivel === 'ok') {
      puntos.push({
        nivel: vl.deCuerpo ? 'ok' : 'aviso',
        texto: 'Luz suficiente (' + Math.round(vl.nivelLuz) + ' ' + vl.donde +
          (res.luz && res.luz.ruido != null ? ', ruido ' + res.luz.ruido.toFixed(1) : '') + ').' +
          (vl.deCuerpo ? '' : ' Repite la prueba con alguien en la marca: la ropa oscura de una persona mide muy distinto que el piso.'),
      });
      if (!vl.deCuerpo) nivel = sumarNivel(nivel, 'aviso');
    }

    const titulo = nivel === 'ok' ? 'El tótem está listo'
      : nivel === 'aviso' ? 'Se puede jugar, con ajustes'
        : 'Hay que arreglar el montaje antes de abrir';
    return { nivel, titulo, puntos, luz: vl };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8.f Código QR (sin dependencias)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Para emparejar el teléfono hay que mostrarle una URL en pantalla, y nadie
  // escribe a mano `https://192.168.4.1:8443/#s=K7M2` en la feria. Hace falta un
  // QR, y la regla del repositorio es que no se agregan dependencias: la app
  // corre servidores y puentes sin ninguna, y eso es un activo que no se gasta
  // por un código de barras.
  //
  // Así que está escrito acá: modo byte, nivel de corrección M, versiones 1 a
  // 20 (hasta 666 bytes, de sobra para cualquier URL). Es norma ISO/IEC 18004,
  // no invención: Reed-Solomon sobre GF(256), patrones de alineación, cadenas
  // de formato y versión con BCH, y elección de máscara por penalización.
  //
  // Verificado comparando la matriz, módulo por módulo, contra la
  // implementación independiente `qrcode` de Python. Un QR que "se ve bien" y
  // no decodifica es peor que no tener QR: el operador se queda tocando la
  // pantalla del teléfono mientras la fila espera.

  // Codewords totales (datos + corrección) por versión.
  const QR_TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466,
    532, 581, 655, 733, 815, 901, 991, 1085];
  // Nivel M: [ecPorBloque, bloquesG1, datosG1, bloquesG2, datosG2].
  const QR_BLOQUES_M = [
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37], [26, 4, 43, 1, 44], [30, 1, 50, 4, 51], [22, 6, 36, 2, 37],
    [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42], [28, 7, 45, 3, 46],
    [28, 10, 46, 1, 47], [26, 9, 43, 4, 44], [26, 3, 44, 11, 45], [26, 3, 41, 13, 42],
  ];
  // Centros de los patrones de alineación, por versión (la 1 no tiene).
  const QR_ALINEACION = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
    [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66],
    [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82],
    [6, 30, 58, 86], [6, 34, 62, 90],
  ];

  /** Tablas de logaritmos de GF(256) con el polinomio 0x11D de la norma. */
  const GF = (function () {
    const exp = new Uint8Array(512), log = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      exp[i] = x;
      log[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
    return { exp, log };
  }());
  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF.exp[GF.log[a] + GF.log[b]]);

  /** Polinomio generador de grado `n`: producto de (x − α^i). */
  function qrGenerador(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const sig = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        sig[j] ^= g[j];
        sig[j + 1] ^= gfMul(g[j], GF.exp[i]);
      }
      g = sig;
    }
    return g;
  }

  /** Codewords de corrección de un bloque de datos. */
  function qrCorreccion(datos, n) {
    const gen = qrGenerador(n);
    const resto = new Array(n).fill(0);
    for (const d of datos) {
      const factor = d ^ resto[0];
      resto.shift();
      resto.push(0);
      if (factor !== 0) for (let i = 0; i < n; i++) resto[i] ^= gfMul(gen[i + 1], factor);
    }
    return resto;
  }

  /**
   * Resto de la división BCH: 10 bits para la cadena de formato (generador
   * 0x537) y 12 para la de versión (0x1F25).
   *
   * Se reduce MIENTRAS quede algún bit por encima del grado del generador,
   * incluido el bit del propio grado. Cortar un paso antes deja un resto que
   * parece correcto, produce un símbolo que se ve perfecto y que ningún lector
   * abre.
   */
  function qrBCH(datos, gen, bits) {
    let d = datos << bits;
    const grado = 31 - Math.clz32(gen);
    for (let alto = 31 - Math.clz32(d); alto >= grado; alto = 31 - Math.clz32(d)) {
      d ^= gen << (alto - grado);
    }
    return d;
  }

  /**
   * Matriz de un QR, como array de arrays de 0/1. `texto` va en modo byte
   * (UTF-8) con nivel de corrección M, que aguanta un 15% de daño: suficiente
   * para una pantalla con reflejos y un teléfono a medio metro.
   */
  function qrMatriz(texto) {
    // ── 1. El texto a bytes ─────────────────────────────────────────────
    const datos = typeof TextEncoder !== 'undefined'
      ? Array.from(new TextEncoder().encode(s(texto)))
      : Array.from(unescape(encodeURIComponent(s(texto))), (c) => c.charCodeAt(0));

    // ── 2. La versión más chica donde quepa ─────────────────────────────
    let version = 0;
    for (let v = 1; v <= 20; v++) {
      const [ec, b1, d1, b2, d2] = QR_BLOQUES_M[v - 1];
      const capacidad = b1 * d1 + b2 * d2;
      // 4 bits de modo + 8 o 16 de longitud, según la versión.
      const bitsCabecera = 4 + (v < 10 ? 8 : 16);
      if (datos.length + Math.ceil(bitsCabecera / 8) <= capacidad) { version = v; break; }
      if (v === 20 && ec) version = 0;
    }
    if (!version) throw new Error('El texto no cabe en un QR de versión 20 (' + datos.length + ' bytes).');

    const [ecN, b1, d1, b2, d2] = QR_BLOQUES_M[version - 1];
    const capacidad = b1 * d1 + b2 * d2;

    // ── 3. El flujo de bits ─────────────────────────────────────────────
    const bits = [];
    const empujar = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1); };
    empujar(4, 4);                                   // modo byte
    empujar(datos.length, version < 10 ? 8 : 16);
    for (const b of datos) empujar(b, 8);
    // Terminador de hasta 4 ceros, y relleno hasta cerrar el byte.
    for (let i = 0; i < 4 && bits.length < capacidad * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
      cw.push(b);
    }
    // Relleno alternado que manda la norma, hasta llenar la capacidad.
    const RELLENO = [0xEC, 0x11];
    for (let i = 0; cw.length < capacidad; i++) cw.push(RELLENO[i % 2]);

    // ── 4. Bloques, corrección e intercalado ────────────────────────────
    const bloques = [];
    let o = 0;
    for (let i = 0; i < b1; i++) { bloques.push(cw.slice(o, o + d1)); o += d1; }
    for (let i = 0; i < b2; i++) { bloques.push(cw.slice(o, o + d2)); o += d2; }
    const ecs = bloques.map((b) => qrCorreccion(b, ecN));
    const finales = [];
    const maxDatos = Math.max(d1, d2);
    // Intercalado: primero un codeword de cada bloque, luego el siguiente. Es
    // lo que hace que una mancha en el papel dañe un poco de cada bloque en vez
    // de destruir uno entero.
    for (let i = 0; i < maxDatos; i++) for (const b of bloques) if (i < b.length) finales.push(b[i]);
    for (let i = 0; i < ecN; i++) for (const e of ecs) finales.push(e[i]);

    // ── 5. La matriz: patrones fijos primero ────────────────────────────
    const n = version * 4 + 17;
    const m = [];
    const reservado = [];
    for (let i = 0; i < n; i++) { m.push(new Array(n).fill(0)); reservado.push(new Array(n).fill(false)); }
    const poner = (f, c, v) => { if (f >= 0 && f < n && c >= 0 && c < n) { m[f][c] = v; reservado[f][c] = true; } };

    const buscador = (f0, c0) => {
      for (let f = -1; f <= 7; f++) {
        for (let c = -1; c <= 7; c++) {
          const dentro = f >= 0 && f <= 6 && c >= 0 && c <= 6;
          const anillo = dentro && (f === 0 || f === 6 || c === 0 || c === 6);
          const centro = dentro && f >= 2 && f <= 4 && c >= 2 && c <= 4;
          poner(f0 + f, c0 + c, anillo || centro ? 1 : 0);
        }
      }
    };
    buscador(0, 0); buscador(0, n - 7); buscador(n - 7, 0);

    for (const cf of QR_ALINEACION[version - 1]) {
      for (const cc of QR_ALINEACION[version - 1]) {
        // No van encima de los tres buscadores de las esquinas.
        if ((cf <= 8 && cc <= 8) || (cf <= 8 && cc >= n - 9) || (cf >= n - 9 && cc <= 8)) continue;
        for (let f = -2; f <= 2; f++) {
          for (let c = -2; c <= 2; c++) {
            const borde = Math.max(Math.abs(f), Math.abs(c));
            poner(cf + f, cc + c, borde === 1 ? 0 : 1);
          }
        }
      }
    }
    // Temporizadores: la fila y la columna 6, alternando.
    for (let i = 8; i < n - 8; i++) { poner(6, i, i % 2 ? 0 : 1); poner(i, 6, i % 2 ? 0 : 1); }
    poner(n - 8, 8, 1);                              // módulo oscuro, siempre

    // Zonas reservadas para la información de formato y de versión.
    for (let i = 0; i < 9; i++) { if (!reservado[8][i]) poner(8, i, 0); if (!reservado[i][8]) poner(i, 8, 0); }
    for (let i = 0; i < 8; i++) { poner(8, n - 1 - i, 0); poner(n - 1 - i, 8, 0); }
    if (version >= 7) {
      for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) { poner(i, n - 11 + k, 0); poner(n - 11 + k, i, 0); }
    }

    // ── 6. Los datos, en zigzag desde abajo a la derecha ────────────────
    let bit = 0, arriba = true;
    const flujo = [];
    for (const b of finales) for (let i = 7; i >= 0; i--) flujo.push((b >> i) & 1);
    for (let c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;                              // la columna 6 es temporizador
      for (let paso = 0; paso < n; paso++) {
        const f = arriba ? n - 1 - paso : paso;
        for (const dc of [0, 1]) {
          const col = c - dc;
          if (reservado[f][col]) continue;
          m[f][col] = bit < flujo.length ? flujo[bit] : 0;
          bit++;
        }
      }
      arriba = !arriba;
    }

    // ── 7. Máscara: se prueban las ocho y gana la menos fea ─────────────
    const MASCARAS = [
      (f, c) => (f + c) % 2 === 0,
      (f) => f % 2 === 0,
      (f, c) => c % 3 === 0,
      (f, c) => (f + c) % 3 === 0,
      (f, c) => (Math.floor(f / 2) + Math.floor(c / 3)) % 2 === 0,
      (f, c) => ((f * c) % 2) + ((f * c) % 3) === 0,
      (f, c) => (((f * c) % 2) + ((f * c) % 3)) % 2 === 0,
      (f, c) => (((f + c) % 2) + ((f * c) % 3)) % 2 === 0,
    ];
    let mejor = null, mejorPena = Infinity;
    for (let k = 0; k < 8; k++) {
      const prueba = m.map((fila) => fila.slice());
      for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) if (!reservado[f][c] && MASCARAS[k](f, c)) prueba[f][c] ^= 1;
      }
      qrPonerFormato(prueba, n, k);
      if (version >= 7) qrPonerVersion(prueba, n, version);
      const pena = qrPenalizacion(prueba, n);
      if (pena < mejorPena) { mejorPena = pena; mejor = prueba; }
    }
    return mejor;
  }

  /** Cadena de formato: nivel M (00) + máscara, con BCH y máscara 0x5412. */
  function qrPonerFormato(m, n, mascara) {
    const datos = (0 << 3) | mascara;                // 00 = nivel M
    const valor = ((datos << 10) | qrBCH(datos, 0x537, 10)) ^ 0x5412;
    // El bit 14 va primero. Colocarlos al revés produce un símbolo que se ve
    // perfecto y que ningún lector abre: la cadena de formato es lo primero que
    // se lee, y es la que dice qué máscara hay que quitar.
    const bitDe = (i) => (valor >> (14 - i)) & 1;
    // Primera copia, alrededor del buscador de arriba a la izquierda.
    for (let i = 0; i <= 5; i++) m[8][i] = bitDe(i);
    m[8][7] = bitDe(6); m[8][8] = bitDe(7); m[7][8] = bitDe(8);
    for (let i = 9; i <= 14; i++) m[14 - i][8] = bitDe(i);
    // Segunda copia: 7 módulos bajando por la columna 8 (bits 0–6) y 8 cruzando
    // por la fila 8 (bits 7–14). El reparto NO es 8+7: el módulo (n−8, 8) es el
    // oscuro obligatorio y no pertenece al formato. Escribir ahí el bit 7 lo
    // pierde, y con él la copia de respaldo que un lector usa cuando la primera
    // está tapada por un reflejo.
    for (let i = 0; i <= 6; i++) m[n - 1 - i][8] = bitDe(i);
    for (let i = 7; i <= 14; i++) m[8][n - 15 + i] = bitDe(i);
    m[n - 8][8] = 1;                                 // oscuro, siempre
  }

  /** Cadena de versión (solo 7 en adelante), en las dos esquinas. */
  function qrPonerVersion(m, n, version) {
    const valor = (version << 12) | qrBCH(version, 0x1F25, 12);
    for (let i = 0; i < 18; i++) {
      const b = (valor >> i) & 1;
      m[Math.floor(i / 3)][n - 11 + (i % 3)] = b;
      m[n - 11 + (i % 3)][Math.floor(i / 3)] = b;
    }
  }

  /** Las cuatro penalizaciones de la norma: gana la máscara con menos. */
  function qrPenalizacion(m, n) {
    let p = 0;
    // N1: rachas de cinco o más del mismo color.
    for (let f = 0; f < n; f++) {
      for (const eje of [0, 1]) {
        let racha = 1;
        for (let i = 1; i < n; i++) {
          const a = eje ? m[i - 1][f] : m[f][i - 1];
          const b = eje ? m[i][f] : m[f][i];
          if (a === b) racha++;
          else { if (racha >= 5) p += 3 + (racha - 5); racha = 1; }
        }
        if (racha >= 5) p += 3 + (racha - 5);
      }
    }
    // N2: bloques de 2×2 del mismo color.
    for (let f = 0; f < n - 1; f++) {
      for (let c = 0; c < n - 1; c++) {
        const v = m[f][c];
        if (v === m[f][c + 1] && v === m[f + 1][c] && v === m[f + 1][c + 1]) p += 3;
      }
    }
    // N3: el patrón 1:1:3:1:1 que imita a un buscador.
    const PAT = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const PAT2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let f = 0; f < n; f++) {
      for (let c = 0; c + 11 <= n; c++) {
        let okA = true, okB = true, okC = true, okD = true;
        for (let i = 0; i < 11; i++) {
          if (m[f][c + i] !== PAT[i]) okA = false;
          if (m[f][c + i] !== PAT2[i]) okB = false;
          if (m[c + i][f] !== PAT[i]) okC = false;
          if (m[c + i][f] !== PAT2[i]) okD = false;
        }
        if (okA) p += 40; if (okB) p += 40; if (okC) p += 40; if (okD) p += 40;
      }
    }
    // N4: cuánto se aleja del 50% de módulos oscuros.
    let oscuros = 0;
    for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) oscuros += m[f][c];
    const porcentaje = (oscuros * 100) / (n * n);
    p += Math.floor(Math.abs(porcentaje - 50) / 5) * 10;
    return p;
  }

  /**
   * El QR como un solo `<path>` de SVG: un rectángulo por módulo oscuro.
   * Se dibuja con React, no con innerHTML, y sin imágenes externas, así que
   * funciona en un tótem sin internet y dentro del sandbox del AppShell.
   */
  function QR(props) {
    const texto = s(props.texto);
    let m = null;
    try { m = texto ? qrMatriz(texto) : null; } catch (e) { m = null; }
    if (!m) return null;
    const n = m.length;
    const borde = 4;                                 // zona tranquila que pide la norma
    const total = n + borde * 2;
    let d = '';
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) if (m[f][c]) d += 'M' + (c + borde) + ' ' + (f + borde) + 'h1v1h-1z';
    }
    return h('svg', {
      className: 'fp-qr', viewBox: '0 0 ' + total + ' ' + total,
      width: props.tam || 220, height: props.tam || 220,
      role: 'img', 'aria-label': props.alt || 'Código QR para emparejar el teléfono',
      shapeRendering: 'crispEdges',
    },
      h('rect', { x: 0, y: 0, width: total, height: total, fill: '#fff' }),
      h('path', { d, fill: '#000' }));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8.g Modo sensor remoto: el teléfono es la cámara
  // ══════════════════════════════════════════════════════════════════════
  //
  // El caso real: notebook con proyector y el teléfono de alguien haciendo de
  // cámara. Hoy eso se resuelve con drivers de escritorio tipo Iriun, que
  // obligan a instalar software en un equipo que muchas veces no es del
  // cliente, el día del evento. La alternativa es separar los dos papeles:
  //
  //   PANTALLA  muestra los juegos y un QR con el código de sala
  //   SENSOR    el teléfono, que abre la app en su navegador, calcula la pose
  //             LOCALMENTE y transmite solo los 33 puntos
  //
  // La imagen nunca sale del teléfono. No es una promesa de buena conducta: es
  // que por el enlace no cabe una imagen, porque lo único que se serializa son
  // landmarks. A 30 Hz son unos 30 kB/s, tres órdenes de magnitud menos que
  // vídeo, y por eso anda en el wifi de una feria.

  // Alfabeto sin caracteres que se confunden leyendo desde lejos: nada de 0/O
  // ni de 1/I/L. Alguien va a tener que dictarlo por teléfono alguna vez.
  const ALFABETO_SALA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function codigoDeSala(largo) {
    const n = Math.max(4, Math.round(num(largo, 6)));
    let out = '';
    // crypto si está; si no, Math.random. Esto no protege un secreto: evita
    // que dos tótems en la misma feria elijan el mismo código.
    const al = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(al);
    else for (let i = 0; i < n; i++) al[i] = Math.floor(Math.random() * 256);
    for (let i = 0; i < n; i++) out += ALFABETO_SALA[al[i] % ALFABETO_SALA.length];
    return out;
  }

  /** `ABC123` → `ABC-123`, que es como se lee y se dicta sin equivocarse. */
  const salaLegible = (c) => {
    const t = s(c).toUpperCase();
    return t.length > 4 ? t.slice(0, Math.ceil(t.length / 2)) + '-' + t.slice(Math.ceil(t.length / 2)) : t;
  };
  const salaNormal = (c) => s(c).toUpperCase().replace(/[^A-Z0-9]/g, '');

  /**
   * Landmarks a un array plano de enteros, y de vuelta.
   *
   * En JSON, 33 puntos con sus cuatro campos en doble precisión son unos 3 kB
   * por cuadro; a 30 Hz eso es 90 kB/s de texto que hay que serializar y
   * parsear treinta veces por segundo en un teléfono. Cuantizado a enteros son
   * ~700 bytes. La resolución que se pierde es real pero irrelevante: 1/10.000
   * del ancho del cuadro es la quinta parte de un píxel en 1080p, mucho menos
   * que el temblor que el filtro de la Fase 2 ya está quitando.
   */
  function comprimirLandmarks(L) {
    if (!L) return null;
    const out = new Array(L.length * 4);
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      const o = i * 4;
      if (!p) { out[o] = -32768; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0; continue; }
      out[o] = Math.round(clamp(num(p.x, 0), -3, 3) * 10000);
      out[o + 1] = Math.round(clamp(num(p.y, 0), -3, 3) * 10000);
      out[o + 2] = Math.round(clamp(num(p.z, 0), -3, 3) * 1000);
      out[o + 3] = Math.round(clamp(p.visibility == null ? 1 : num(p.visibility, 0), 0, 1) * 1000);
    }
    return out;
  }

  function descomprimirLandmarks(a) {
    if (!Array.isArray(a) || a.length < 4) return null;
    const n = Math.floor(a.length / 4);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (a[o] === -32768) { out[i] = null; continue; }
      out[i] = {
        x: num(a[o], 0) / 10000, y: num(a[o + 1], 0) / 10000,
        z: num(a[o + 2], 0) / 1000, visibility: num(a[o + 3], 0) / 1000,
      };
    }
    return out;
  }

  /**
   * Deriva de reloj entre los dos equipos, al estilo NTP.
   *
   * El teléfono y la pantalla tienen relojes distintos y que además avanzan a
   * ritmos ligeramente distintos. Si se comparan las marcas de tiempo tal cual,
   * la "antigüedad" de una muestra puede salir negativa o de varios segundos, y
   * con eso no se puede decidir nada.
   *
   * Con cuatro tiempos —t0 salida, t1 llegada al otro, t2 salida del otro, t3
   * vuelta— salen el viaje de ida y vuelta y el desfase entre relojes. Se
   * queda con la muestra de MENOR rtt y no con el promedio: un intercambio que
   * tardó de más lo hizo por una cola en el camino, y esa cola es asimétrica,
   * así que ensucia el desfase. El intercambio más rápido es el más limpio.
   */
  function relojEnlace(maxMuestras) {
    const tope = Math.max(3, Math.round(num(maxMuestras, 12)));
    let muestras = [];
    return {
      reset() { muestras = []; },
      anotar(t0, t1, t2, t3) {
        const rtt = (t3 - t0) - (t2 - t1);
        if (!(rtt >= 0) || !Number.isFinite(rtt)) return null;
        const desfase = ((t1 - t0) + (t2 - t3)) / 2;
        muestras.push({ rtt, desfase });
        if (muestras.length > tope) muestras.shift();
        return { rtt, desfase };
      },
      listo: () => muestras.length > 0,
      n: () => muestras.length,
      /** Desfase del intercambio más limpio: reloj remoto − reloj local. */
      desfase() {
        if (!muestras.length) return 0;
        return muestras.reduce((a, b) => (b.rtt < a.rtt ? b : a)).desfase;
      },
      /** Latencia del enlace: la mediana aguanta un pico suelto de wifi. */
      rtt() { return muestras.length ? mediana(muestras.map((m) => m.rtt)) : null; },
      rttMinimo() { return muestras.length ? Math.min.apply(null, muestras.map((m) => m.rtt)) : null; },
      /** Una marca de tiempo del remoto, traída al reloj de acá. */
      aLocal(ts) { return num(ts, 0) - this.desfase(); },
    };
  }

  /**
   * El protocolo, sin transporte.
   *
   * Separado a propósito de WebRTC y de WebSocket: así la lógica que de verdad
   * puede fallar —sincronía de reloj, latencia, muestras viejas, caídas— se
   * prueba en el banco con un transporte de mentira, en vez de depender de dos
   * dispositivos y una red para saber si está bien.
   */
  function protocoloSensor(opts) {
    const o = opts || {};
    const rol = o.rol === 'sensor' ? 'sensor' : 'pantalla';
    const enviar = typeof o.enviar === 'function' ? o.enviar : () => {};
    const ahora = typeof o.ahora === 'function' ? o.ahora : nowMs;
    const reloj = relojEnlace(o.muestrasReloj);
    let ultima = null;              // { L, mundo, tsLocal, w, h }
    let recibidos = 0, descartados = 0, enviados = 0;
    let idPing = 0, pingAbierto = null;
    let estadoRemoto = null, ultimoContacto = 0;

    return {
      rol, reloj,
      /** Un mensaje que llegó por el transporte. Devuelve qué era. */
      recibir(msg) {
        if (!isObj(msg)) return null;
        const t = ahora();
        ultimoContacto = t;
        if (msg.t === 'ping') {
          // Se responde con el reloj de acá en los dos instantes: al recibir y
          // al contestar. Los dos, porque entre uno y otro puede pasar tiempo.
          enviar({ t: 'pong', id: msg.id, t0: msg.t0, t1: t, t2: ahora() });
          return 'ping';
        }
        if (msg.t === 'pong') {
          if (pingAbierto && msg.id === pingAbierto.id) {
            reloj.anotar(pingAbierto.t0, num(msg.t1, 0), num(msg.t2, 0), t);
            pingAbierto = null;
          }
          return 'pong';
        }
        if (msg.t === 'pose') {
          recibidos++;
          const L = descomprimirLandmarks(msg.L);
          if (!L) { descartados++; return 'pose'; }
          ultima = {
            L, mundo: msg.M ? descomprimirLandmarks(msg.M) : null,
            tsLocal: reloj.listo() ? reloj.aLocal(msg.ts) : t,
            w: num(msg.w, 0), h: num(msg.h, 0),
          };
          return 'pose';
        }
        if (msg.t === 'estado') { estadoRemoto = msg.datos || null; return 'estado'; }
        if (msg.t === 'hola') { return 'hola'; }
        return null;
      },
      /** Lanza un intercambio de reloj. Se llama cada pocos segundos. */
      sincronizar() {
        if (pingAbierto && ahora() - pingAbierto.t0 < 2000) return false;
        idPing++;
        pingAbierto = { id: idPing, t0: ahora() };
        enviar({ t: 'ping', id: idPing, t0: pingAbierto.t0 });
        return true;
      },
      /** Lado sensor: manda un cuadro de pose con su marca de tiempo. */
      mandarPose(L, mundo, w, h) {
        const c = comprimirLandmarks(L);
        if (!c) return false;
        enviados++;
        enviar({ t: 'pose', ts: ahora(), L: c, M: mundo ? comprimirLandmarks(mundo) : null, w, h });
        return true;
      },
      mandarEstado(datos) { enviar({ t: 'estado', datos: datos || {} }); },
      saludar(sala) { enviar({ t: 'hola', rol, sala: salaNormal(sala), version: 1 }); },
      /**
       * Última pose, o null si está vieja. Devolver una pose de hace un segundo
       * es peor que no devolver nada: el juego seguiría reaccionando a un gesto
       * que ya pasó, y el jugador no entendería por qué.
       */
      leer(maxEdad) {
        if (!ultima) return null;
        const edad = ahora() - ultima.tsLocal;
        if (edad > Math.max(120, num(maxEdad, 600))) return null;
        return ultima;
      },
      /** Antigüedad del cuadro más nuevo: la latencia que se siente jugando. */
      edad() { return ultima ? Math.max(0, Math.round(ahora() - ultima.tsLocal)) : null; },
      silencio() { return ultimoContacto ? Math.round(ahora() - ultimoContacto) : null; },
      salud() {
        return {
          rol, recibidos, descartados, enviados,
          rtt: reloj.rtt(), rttMinimo: reloj.rttMinimo(),
          desfase: reloj.listo() ? Math.round(reloj.desfase()) : null,
          muestrasReloj: reloj.n(), edad: this.edad(), silencio: this.silencio(),
          remoto: estadoRemoto,
        };
      },
    };
  }

  /**
   * Veredicto de la latencia del enlace, para el Diagnóstico.
   *
   * Lo que decide si se puede jugar no es el ping del wifi: es la EDAD del
   * cuadro que la pantalla tiene en la mano, que incluye la cámara del
   * teléfono, el modelo de pose corriendo ahí, la serialización y la red. Por
   * eso se juzga esa, y el rtt se muestra al lado para saber a quién culpar:
   * edad alta con rtt bajo es un teléfono lento, no una red mala.
   */
  function veredictoDeEnlace(salud, hw) {
    const maxEdad = num(hw && hw.sensorLatenciaMax, 180);
    const maxRtt = num(hw && hw.sensorRttMax, 100);
    if (!salud || salud.edad == null) {
      return { nivel: 'mal', titulo: 'Sin datos del sensor', acciones: ['No está llegando ninguna pose del teléfono.'] };
    }
    const acciones = [];
    let nivel = 'ok';
    const peor = (n) => { if (n === 'mal' || (n === 'aviso' && nivel === 'ok')) nivel = n; };
    if (salud.edad > maxEdad) {
      peor('mal');
      acciones.push('Los gestos llegan ' + salud.edad + ' ms tarde (máximo jugable: ' + maxEdad + '). ' +
        (salud.rtt != null && salud.rtt < maxRtt / 2
          ? 'La red va bien (' + salud.rtt + ' ms de ida y vuelta): el que no da es el teléfono. Baja los Hz de pose o usa un teléfono más nuevo.'
          : 'Acerca el teléfono al router, o pon el router del kit más cerca.'));
    } else if (salud.edad > maxEdad * 0.55) {
      peor('aviso');
      acciones.push('Los gestos llegan ' + salud.edad + ' ms tarde: jugable, pero un golpe rápido se va a sentir con retraso.');
    }
    if (salud.rtt != null && salud.rtt > maxRtt) {
      peor(nivel === 'mal' ? 'mal' : 'aviso');
      acciones.push('El enlace tarda ' + salud.rtt + ' ms de ida y vuelta (máximo: ' + maxRtt + '). ' +
        'Si estás en el wifi del recinto, cámbiate al router del kit: es la causa número uno.');
    }
    if (salud.muestrasReloj < 2) {
      peor('aviso');
      acciones.push('Todavía no hay suficientes intercambios para medir el desfase de reloj: espera unos segundos.');
    }
    const titulo = nivel === 'ok' ? 'El enlace con el teléfono va bien'
      : nivel === 'aviso' ? 'El enlace anda, con retraso notable' : 'El enlace no da para jugar';
    return { nivel, titulo, acciones, edad: salud.edad, rtt: salud.rtt };
  }

  /** URL del puente de salas: la configurada, o el mismo host de esta página. */
  function urlDelPuente(hw) {
    const puesta = s(hw && hw.sensorPuenteUrl);
    if (puesta) return puesta;
    if (typeof location === 'undefined' || !location.hostname) return 'ws://127.0.0.1:8788';
    // wss si la página va por https: un navegador bloquea el ws:// en claro
    // desde una página segura, y esa mezcla es la causa más común de que el
    // teléfono "no conecte" sin ningún mensaje de error.
    const seguro = location.protocol === 'https:';
    return (seguro ? 'wss://' : 'ws://') + location.hostname + ':' + Math.round(num(hw && hw.sensorPuerto, 8788));
  }

  /** URL que se pinta en el QR para que el teléfono abra la app como sensor. */
  function urlDelSensor(hw, sala) {
    const base = s(hw && hw.sensorUrlApp)
      || (typeof location !== 'undefined' ? location.origin + location.pathname : '');
    if (!base) return '';
    return base + '#funplai-sensor=' + salaNormal(sala);
  }

  /** Lee el código de sala de la URL: así el teléfono arranca ya emparejado. */
  function salaDeLaUrl() {
    if (typeof location === 'undefined') return '';
    const m = /[#&?]funplai-sensor=([A-Za-z0-9-]+)/.exec(s(location.hash) + '&' + s(location.search));
    return m ? salaNormal(m[1]) : '';
  }

  /**
   * El transporte, con sus dos caminos.
   *
   * Primero se abre un WebSocket contra el puente local, que empareja las dos
   * puntas por código de sala. Ese WebSocket sirve para dos cosas: llevar la
   * señalización de WebRTC y, si WebRTC no llega a establecerse, transportar
   * las poses él mismo. Que el respaldo sea el mismo canal que ya está abierto
   * es lo que hace que "no funcionó WebRTC" no sea un fallo visible para nadie.
   *
   * Nada de esto sale a internet: no se configura ningún STUN ni TURN, porque
   * los dos equipos están en la misma red y les alcanzan los candidatos de
   * host. Un servidor en internet sería, además, exactamente lo que el kit de
   * una feria no puede permitirse.
   */
  function enlaceSensor(opts) {
    const o = opts || {};
    const rol = o.rol === 'sensor' ? 'sensor' : 'pantalla';
    const hw = o.hw || {};
    const sala = salaNormal(o.sala);
    const url = s(o.urlPuente) || urlDelPuente(hw);
    let ws = null, pc = null, canal = null;
    let cerrado = false, reintento = null, esperaMs = 800;
    let estado = 'inactivo';          // inactivo|conectando|esperando|ws|rtc|caido
    let pareja = false, aviso = '';
    let latidos = null, sincroniza = null;

    const proto = protocoloSensor({
      rol,
      enviar: (m) => {
        // Por el canal rápido si está abierto; si no, por el puente.
        const texto = JSON.stringify(m);
        if (canal && canal.readyState === 'open') { try { canal.send(texto); return; } catch (e) { /* cae al ws */ } }
        if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ t: 'relay', datos: m })); } catch (e) { /* noop */ } }
      },
    });

    const cambiar = (e, motivo) => { estado = e; if (motivo != null) aviso = motivo; if (o.alCambiar) { try { o.alCambiar(e, aviso); } catch (err) { /* noop */ } } };

    // ── WebRTC ──────────────────────────────────────────────────────────
    const señal = (m) => { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); } catch (e) { /* noop */ } } };

    const montarCanal = (c) => {
      canal = c;
      canal.onopen = () => cambiar('rtc', '');
      canal.onclose = () => { canal = null; if (estado === 'rtc') cambiar(ws && ws.readyState === 1 ? 'ws' : 'caido', ''); };
      canal.onmessage = (ev) => { try { proto.recibir(JSON.parse(ev.data)); } catch (e) { /* noop */ } };
    };

    const abrirRTC = async (comoOferente) => {
      if (typeof RTCPeerConnection === 'undefined') return;
      try {
        pc = new RTCPeerConnection({ iceServers: [] });
        pc.onicecandidate = (ev) => { if (ev.candidate) señal({ t: 'ice', candidato: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate }); };
        pc.ondatachannel = (ev) => montarCanal(ev.channel);
        if (comoOferente) {
          // `ordered:false` y sin reenvíos: en un flujo de poses, un cuadro que
          // llega tarde no sirve para nada y esperar por él retrasa a los que
          // vienen detrás. Es el mismo criterio que usa el puente Kinect al
          // saltarse un cuadro de imagen cuando el socket está saturado.
          montarCanal(pc.createDataChannel('pose', { ordered: false, maxRetransmits: 0 }));
          const oferta = await pc.createOffer();
          await pc.setLocalDescription(oferta);
          señal({ t: 'sdp', sdp: pc.localDescription.sdp, tipo: pc.localDescription.type });
        }
      } catch (e) { pc = null; }
    };

    const recibirSeñal = async (m) => {
      try {
        if (m.t === 'sdp') {
          if (!pc) await abrirRTC(false);
          if (!pc) return;
          await pc.setRemoteDescription({ type: m.tipo, sdp: m.sdp });
          if (m.tipo === 'offer') {
            const r = await pc.createAnswer();
            await pc.setLocalDescription(r);
            señal({ t: 'sdp', sdp: pc.localDescription.sdp, tipo: pc.localDescription.type });
          }
        } else if (m.t === 'ice' && pc) {
          await pc.addIceCandidate(m.candidato).catch(() => {});
        }
      } catch (e) { /* una señalización rota deja el enlace en el respaldo */ }
    };

    const soltarRTC = () => {
      try { canal && canal.close(); } catch (e) { /* noop */ }
      try { pc && pc.close(); } catch (e) { /* noop */ }
      canal = null; pc = null;
    };

    // ── Puente ──────────────────────────────────────────────────────────
    const conectar = () => {
      if (cerrado || typeof WebSocket === 'undefined') return;
      cambiar('conectando', '');
      try { ws = new WebSocket(url + '?sala=' + encodeURIComponent(sala) + '&rol=' + rol); } catch (e) { programarReintento(); return; }
      ws.onopen = () => {
        esperaMs = 800;
        cambiar(pareja ? 'ws' : 'esperando', '');
        proto.saludar(sala);
        proto.sincronizar();
      };
      ws.onmessage = (ev) => {
        let m = null;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!isObj(m)) return;
        if (m.t === 'pareja') {
          pareja = !!m.presente;
          if (!pareja) { soltarRTC(); cambiar('esperando', 'El teléfono se desconectó de la sala.'); return; }
          cambiar(canal && canal.readyState === 'open' ? 'rtc' : 'ws', '');
          proto.reloj.reset();
          // Solo una punta ofrece, o las dos se pisan. Ofrece la pantalla.
          if (rol === 'pantalla') { soltarRTC(); abrirRTC(true); }
          return;
        }
        if (m.t === 'sdp' || m.t === 'ice') { recibirSeñal(m); return; }
        if (m.t === 'relay' && m.datos) { proto.recibir(m.datos); return; }
        if (m.t === 'error') { cambiar('caido', s(m.mensaje) || 'El puente rechazó la conexión.'); return; }
      };
      ws.onerror = () => { /* el close que viene detrás es el que decide */ };
      ws.onclose = () => {
        ws = null;
        soltarRTC();
        pareja = false;
        if (cerrado) { cambiar('inactivo', ''); return; }
        cambiar('caido', 'Se cortó la conexión con el puente. Reintentando…');
        programarReintento();
      };
    };

    /**
     * Reintento con espera creciente hasta 8 s. Sin el tope creciente, un
     * puente caído recibe cien conexiones por segundo; sin el tope máximo, una
     * caída de un minuto dejaría al operador esperando diez.
     */
    const programarReintento = () => {
      if (cerrado || reintento) return;
      reintento = setT(() => { reintento = null; conectar(); }, esperaMs);
      esperaMs = Math.min(8000, Math.round(esperaMs * 1.8));
    };

    return {
      rol, sala, url, proto,
      iniciar() {
        cerrado = false;
        conectar();
        // Sincronía de reloj cada 3 s: barata (dos mensajes) y suficiente para
        // seguir una deriva de cristal, que es de partes por millón.
        sincroniza = setInterval(() => { if (estado === 'ws' || estado === 'rtc') proto.sincronizar(); }, 3000);
        timers.add(sincroniza);
        return true;
      },
      detener() {
        cerrado = true;
        if (reintento) { clrT(reintento); reintento = null; }
        if (sincroniza) { clearInterval(sincroniza); timers.delete(sincroniza); sincroniza = null; }
        if (latidos) { clearInterval(latidos); timers.delete(latidos); latidos = null; }
        soltarRTC();
        try { ws && ws.close(); } catch (e) { /* noop */ }
        ws = null;
        cambiar('inactivo', '');
      },
      estado: () => estado,
      aviso: () => aviso,
      pareja: () => pareja,
      /** 'rtc' cuando va directo entre pares, 'ws' cuando va por el puente. */
      via: () => (canal && canal.readyState === 'open' ? 'rtc' : (ws && ws.readyState === 1 ? 'ws' : null)),
      salud() {
        return Object.assign({ estado, via: this.via(), pareja, url, sala, aviso }, proto.salud());
      },
      leer: (maxEdad) => proto.leer(maxEdad),
      mandarPose: (L, mundo, w, h) => proto.mandarPose(L, mundo, w, h),
      mandarEstado: (d) => proto.mandarEstado(d),
    };
  }

  /**
   * Proveedor de pose que lee del enlace en vez de una cámara local.
   *
   * A diferencia del Kinect, acá NO se vuelve a pasar por la tubería de la
   * Fase 2: el teléfono ya la corrió entera —recorte, filtro One Euro, control
   * de huesos— sobre los píxeles, que es el único sitio donde el recorte tiene
   * sentido. Encadenar un segundo filtro sumaría retraso justo en el modo que
   * ya paga el de la red. Lo que sí se calcula acá es la confianza por grupo,
   * que no tiene estado y sirve para los avisos de encuadre.
   */
  function proveedorSensorRemoto(hw, espacio, sala) {
    const enlace = enlaceSensor({ rol: 'pantalla', hw, sala });
    const maxEdad = Math.max(200, num(hw && hw.sensorLatenciaMax, 180) * 3);
    return {
      tipo: 'sensor',
      nombre: 'Teléfono como sensor (modo remoto)',
      enlace,
      setVideo() { /* la cámara está en el teléfono */ },
      async iniciar() { enlace.iniciar(); return true; },
      detener() { enlace.detener(); },
      salud() {
        const sal = enlace.salud();
        return Object.assign({}, sal, {
          hz: sal.remoto && sal.remoto.hz ? sal.remoto.hz : 0,
          ms: sal.remoto && sal.remoto.ms ? sal.remoto.ms : 0,
          recorte: !!(sal.remoto && sal.remoto.recorte),
          veredicto: veredictoDeEnlace(sal, hw),
        });
      },
      leer() {
        const lec = enlace.leer(maxEdad);
        if (!lec || !lec.L) return null;
        vigilarCuadro(lec.L, lec.w && lec.h ? lec.w / lec.h : 16 / 9);
        return {
          landmarks: lec.L, mundo: lec.mundo || null, angulos: null,
          sintetico: false, contorno: null,
          aceptado: true, motivo: 'remoto', perdido: false,
          confianza: confianzaPorGrupo(lec.L),
          remoto: true,
        };
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8.h Modo concurso: cuando el juego reparte un premio
  // ══════════════════════════════════════════════════════════════════════
  //
  // El uso principal de esta app es reemplazar la ruleta de sorteos en ferias,
  // eventos corporativos y matrimonios. En cuanto hay un premio de por medio,
  // el juego deja de ser un juego: es un CONCURSO, y alguien va a reclamar.
  //
  // Lo que sigue existe para poder responderle a esa persona con datos y no con
  // una opinión: qué se midió, cuándo, con qué versión, y si la partida se jugó
  // dentro de las reglas.
  //
  // ── Lo que se puede inflar, medido antes de defenderlo ────────────────
  //
  // El plan suponía que acercarse a la cámara infla el puntaje porque agranda
  // el ancho de hombros de referencia. Medido con un cuerpo proyectado por la
  // geometría real, resulta que NO: un gesto lateral y el ancho de hombros
  // crecen los dos como 1/distancia, así que el cociente que miden los
  // detectores sale invariante (1,400 a 220 cm, a 150 y a 110).
  //
  // Lo que sí infla, y mucho, es GIRARSE. El ancho de hombros proyectado cae
  // con el coseno del giro, y todo lo que se normaliza contra él y no es
  // lateral —un salto, un aleteo, agacharse— se infla en la misma proporción:
  //
  //     giro    referencia    inflación de lo vertical
  //      25°       ×0,91              ×1,10
  //      40°       ×0,77              ×1,30
  //      55°       ×0,58              ×1,73
  //      70°       ×0,34              ×2,90
  //
  // Comprobado de punta a punta: el MISMO salto de 12 cm da desvío 0,411 de
  // frente y 0,712 girado 55°. Y girarse no obliga a moverse del sitio, así que
  // es la trampa más fácil de hacer y la más difícil de ver desde fuera.
  //
  // Las dos dejan huellas distintas y las dos son medibles con lo que ya hay:
  // acercarse cambia la DISTANCIA (233 → 116 cm), girarse cambia el ANCHO DE
  // HOMBROS en cm (42 → 24) dejando la distancia igual. Por eso el vigilante
  // mira las dos cosas por separado y sabe decir cuál pasó.

  /**
   * Versión de la app: se sella en cada partida, se muestra en pantalla y va
   * en el snapshot del agente.
   *
   * Va acá y no leída del manifest porque el bundle no lo carga. Una prueba
   * comprueba que las dos coincidan: si alguien sube una y no la otra, el
   * banco lo caza antes de que un ranking quede sellado con una versión que
   * no es la que se jugó.
   *
   * El NOMBRE de la constante importa: `tools/check-versions.mjs` del repo de
   * la plataforma busca literalmente `APP_VERSION` para comparar el bundle
   * contra el manifest de la app, el catálogo raíz y el README. Con un nombre
   * propio el chequeo pasaba, pero pasaba sin mirar nada.
   */
  const APP_VERSION = '1.18.0';

  /**
   * Identificador de esta sesión de la app: desde que se abrió hasta que se
   * cierra. Sirve para agrupar las partidas de una misma jornada y para
   * distinguir dos tótems que exportan al mismo sitio.
   */
  const SESION_ID = uid('ses');

  /**
   * Vigila que la partida se juegue dentro de las reglas, DURANTE la partida.
   *
   * Hasta ahora la geometría solo se miraba al calibrar, y calibrar bien y
   * jugar mal es exactamente lo que haría alguien que quiere ganar. Se toma
   * una referencia del jugador cuando se coloca, y desde ahí se compara cada
   * cuadro contra esa referencia suya —no contra una persona promedio—, que es
   * lo que permite distinguir "se giró" de "es de hombros angostos".
   */
  function vigilanteDePartida(espacio, reglas) {
    const r = reglas || {};
    const tolDistancia = Math.max(10, num(r.toleranciaDistancia, 45));
    const minHombros = clamp(num(r.giroTolerancia, 0.8), 0.3, 1);
    const avisoPct = clamp(num(r.marcarDesde, 0.1), 0, 1);
    const invalidaPct = clamp(num(r.invalidarDesde, 0.35), 0, 1);
    let ref = null, muestras = 0, fuera = 0, calibrando = [];
    const marcas = {};

    const anota = (motivo) => { marcas[motivo] = (marcas[motivo] || 0) + 1; };

    return {
      /** Durante el posicionamiento: se aprende cómo se ve ESTA persona. */
      calibrar(L, aspecto) {
        const m = medirCuerpo(L, espacio, aspecto, null);
        if (!m || !m.ok || !m.segmentos || !m.segmentos.anchoHombros) return false;
        calibrando.push({ distancia: m.distancia, hombros: m.segmentos.anchoHombros });
        if (calibrando.length < 5) return false;
        // Mediana de las muestras: un cuadro malo durante la calibración no
        // puede fijar una referencia que después invalide la partida entera.
        const med = (k) => mediana(calibrando.map((x) => x[k]));
        ref = { distancia: med('distancia'), hombros: med('hombros') };
        return true;
      },
      calibrado: () => !!ref,
      referencia: () => (ref ? Object.assign({}, ref) : null),
      reset() { ref = null; muestras = 0; fuera = 0; calibrando = []; for (const k of Object.keys(marcas)) delete marcas[k]; },
      /**
       * Un cuadro de juego. Devuelve `{ ok, motivo }` para poder avisarle al
       * jugador MIENTRAS pasa: descubrirlo al final sería una trampa del
       * sistema, no del jugador.
       */
      revisar(L, aspecto) {
        if (!ref) return { ok: true, motivo: null };
        muestras++;
        const m = medirCuerpo(L, espacio, aspecto, null);
        if (!m || !m.ok) { fuera++; anota('sin-cuerpo'); return { ok: false, motivo: 'No te veo: ponte frente al tótem' }; }
        // 1. ¿Se movió de la marca? Se compara contra donde se colocó ÉL.
        const dif = m.distancia - ref.distancia;
        if (Math.abs(dif) > tolDistancia) {
          fuera++;
          anota(dif < 0 ? 'se-acerco' : 'se-alejo');
          return { ok: false, motivo: dif < 0 ? 'Te acercaste: vuelve a la marca del piso' : 'Te alejaste: vuelve a la marca del piso' };
        }
        // 2. ¿Se giró? Unos hombros que encogen sin que cambie la distancia no
        //    son unos hombros más angostos: es alguien de perfil.
        const rel = m.segmentos.anchoHombros / Math.max(1, ref.hombros);
        if (rel < minHombros) {
          fuera++;
          anota('de-perfil');
          return { ok: false, motivo: 'Ponte de frente a la cámara, no de perfil' };
        }
        return { ok: true, motivo: null };
      },
      /**
       * El veredicto de la partida. `limpia` se juega y se premia; `marcada`
       * cuenta pero queda señalada; `invalida` no compite por el premio.
       *
       * Que haya un nivel intermedio importa: alguien que se salió tres
       * segundos porque le hablaron no hizo trampa, y anular su partida sería
       * tan injusto como premiar al que jugó de perfil todo el rato.
       */
      veredicto() {
        if (!ref || muestras < 15) {
          return { estado: 'sin-datos', fueraPct: 0, muestras, marcas: {}, motivo: 'No se pudo vigilar la partida (sin referencia o demasiado corta).' };
        }
        const pct = fuera / muestras;
        const estado = pct > invalidaPct ? 'invalida' : pct > avisoPct ? 'marcada' : 'limpia';
        const principal = Object.keys(marcas).sort((a, b) => marcas[b] - marcas[a])[0] || null;
        const FRASES = {
          'se-acerco': 'se acercó a la cámara',
          'se-alejo': 'se alejó de la marca',
          'de-perfil': 'jugó de perfil',
          'sin-cuerpo': 'salió del cuadro',
        };
        return {
          estado,
          fueraPct: round1(pct * 100) / 100,
          muestras,
          marcas: Object.assign({}, marcas),
          referencia: Object.assign({}, ref),
          motivo: estado === 'limpia' ? null
            : Math.round(pct * 100) + '% de la partida fuera de las reglas' +
              (principal ? ': ' + (FRASES[principal] || principal) : ''),
        };
      },
    };
  }

  /**
   * Orden del ranking, determinista y documentado.
   *
   * Un empate resuelto por el orden de llegada de un array es un empate
   * resuelto por casualidad: depende de en qué orden se guardaron las filas y
   * cambia si alguien reordena. Acá los criterios son explícitos, van en orden
   * y el último desempata SIEMPRE, así que la lista ordenada dos veces da lo
   * mismo y se le puede enseñar a quien reclame.
   *
   *   1. Puntaje más alto.
   *   2. Partida más limpia (menos porcentaje de cuadros fuera de las reglas).
   *      Entre dos que sacaron lo mismo, gana quien lo hizo respetando la marca.
   *   3. Quien lo consiguió ANTES. Premia a quien lo logró primero, que es lo
   *      que la gente espera de un concurso.
   *   4. El identificador de la partida, alfabéticamente. No significa nada,
   *      y por eso mismo sirve: es estable y no depende de cómo se guardó.
   */
  function compararParaRanking(a, b) {
    const pa = num(a && a.puntaje, 0), pb = num(b && b.puntaje, 0);
    if (pa !== pb) return pb - pa;
    const fa = num(a && a.auditoria && a.auditoria.fueraPct, 0);
    const fb = num(b && b.auditoria && b.auditoria.fueraPct, 0);
    if (fa !== fb) return fa - fb;
    const ta = s(a && a.at), tb = s(b && b.at);
    if (ta !== tb) return ta < tb ? -1 : 1;
    return s(a && a.id) < s(b && b.id) ? -1 : 1;
  }

  /** Las cuatro reglas, en texto, para mostrárselas a quien reclama. */
  const REGLAS_DESEMPATE = [
    'Puntaje más alto.',
    'Si empatan, la partida más limpia (menos tiempo fuera de la marca o de perfil).',
    'Si siguen empatadas, quien lo consiguió antes.',
    'Si aun así empatan, el identificador de la partida en orden alfabético: no significa nada, pero es estable y no depende de cómo se guardaron las filas.',
  ];

  /** Ordena una copia; nunca el array del modelo. */
  const ordenarRanking = (filas) => (filas || []).slice().sort(compararParaRanking);

  /** ¿Sigue abierto el concurso? Devuelve `{ abierto, motivo }`. */
  function estadoConcurso(m, ahora) {
    const c = (m && m.concurso) || {};
    if (!c.activo) return { abierto: true, motivo: null, modo: 'libre' };
    if (c.cerrado) return { abierto: false, motivo: 'El concurso está cerrado.', modo: 'concurso' };
    const t = ahora || new Date();
    const desde = c.desde ? new Date(c.desde) : null;
    const hasta = c.hasta ? new Date(c.hasta) : null;
    if (desde && !Number.isNaN(desde.getTime()) && t < desde) {
      return { abierto: false, motivo: 'El concurso todavía no empieza (abre el ' + desde.toLocaleString() + ').', modo: 'concurso' };
    }
    if (hasta && !Number.isNaN(hasta.getTime()) && t > hasta) {
      return { abierto: false, motivo: 'El concurso terminó el ' + hasta.toLocaleString() + '.', modo: 'concurso' };
    }
    return { abierto: true, motivo: null, modo: 'concurso' };
  }

  /**
   * Cuántos intentos lleva una persona en este concurso.
   *
   * Se cuenta por nombre normalizado, y eso tiene un límite que hay que decir
   * en voz alta: dos personas que escriben el mismo nombre cuentan como una, y
   * quien quiera más intentos solo tiene que escribir otro. No se puede
   * resolver sin identificar a las personas, y esta app no identifica a nadie
   * (ver PRIVACIDAD.md). Es un tope de buena fe, y así está documentado en las
   * bases: el control real es el operador mirando la fila.
   */
  const claveJugador = (nombre) => s(nombre).trim().toLowerCase().replace(/\s+/g, ' ');

  function intentosDe(m, nombre, juegoId) {
    const clave = claveJugador(nombre);
    if (!clave || clave === 'anónimo' || clave === 'anonimo') return 0;
    return (m.scores || []).filter((x) => claveJugador(x.jugador) === clave
      && (!juegoId || x.juego === juegoId)
      && (!m.concurso || !m.concurso.desde || s(x.at) >= s(m.concurso.desde))).length;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8.b Espacio de juego y parametrización corporal en centímetros
  // ══════════════════════════════════════════════════════════════════════
  //
  // Todos los juegos con cámara comparten un VOLUMEN DE JUEGO declarado: alto,
  // ancho y profundidad en centímetros, más la altura, la inclinación y el
  // campo de visión de la cámara. Ese volumen no es decorativo: es lo que
  // permite pasar de píxeles a centímetros reales.
  //
  // Modelo: cámara estenopeica a `camaraAltura` cm del suelo, inclinada
  // `camaraInclinacion` grados hacia abajo, sobre un piso plano. Para un punto
  // de la imagen se conoce el ángulo de su rayo; el rayo de los tobillos corta
  // el piso y da la DISTANCIA real, y con esa distancia el rayo de la cabeza da
  // la ALTURA real. De ahí salen también envergadura y largos de segmento.

  const ESPACIO_SUGERIDO = { alto: 240, ancho: 220, profundidad: 250 };

  /** Geometría de la cámara: campos de visión en radianes y sus tangentes. */
  function camaraGeometria(espacio, aspecto) {
    const fovH = clamp(num(espacio && espacio.fovHorizontal, 90), 30, 170);
    // Un aspecto ausente tiene que caer en 16:9, no en cero. `Number(null)` es
    // 0 y es finito, así que `num` lo daría por bueno y el campo vertical
    // saldría disparado (con el tope de 0,4 daba 121° en vez de 43°).
    const crudo = num(aspecto, 0);
    const asp = crudo > 0.2 ? crudo : 16 / 9;
    const tanH = Math.tan(rad(fovH / 2));
    const tanV = tanH / Math.max(0.4, asp);
    return { fovH, fovV: (Math.atan(tanV) * 2 * 180) / Math.PI, tanH, tanV, aspecto: asp };
  }

  /**
   * ¿La cámara cubre el volumen declarado? Devuelve las distancias mínimas a
   * las que entra el alto y el ancho pedidos, y qué hacer si no entra.
   */
  function coberturaLente(espacio, aspecto) {
    const g = camaraGeometria(espacio, aspecto);
    const alto = num(espacio && espacio.alto, ESPACIO_SUGERIDO.alto);
    const ancho = num(espacio && espacio.ancho, ESPACIO_SUGERIDO.ancho);
    const prof = num(espacio && espacio.profundidad, ESPACIO_SUGERIDO.profundidad);
    const zona = clamp(num(espacio && espacio.distanciaZona, prof * 0.72), 40, prof);
    // A la distancia de la zona, cuánto abarca la cámara.
    const altoCubierto = 2 * zona * g.tanV;
    const anchoCubierto = 2 * zona * g.tanH;
    const distMinAlto = alto / (2 * g.tanV);
    const distMinAncho = ancho / (2 * g.tanH);
    const necesaria = Math.max(distMinAlto, distMinAncho);
    const alcanza = necesaria <= prof + 0.5;
    // FOV horizontal que haría falta para cubrir todo dentro de la profundidad.
    const tanHNec = Math.max(ancho / (2 * prof), (alto / (2 * prof)) * g.aspecto);
    const fovNecesario = (Math.atan(tanHNec) * 2 * 180) / Math.PI;
    return {
      geometria: g, zona, alto, ancho, profundidad: prof,
      altoCubierto, anchoCubierto,
      distanciaMinima: necesaria, distMinAlto, distMinAncho,
      alcanza,
      cubreEnLaZona: altoCubierto >= alto - 0.5 && anchoCubierto >= ancho - 0.5,
      fovNecesario,
      recomendacion: alcanza
        ? 'La cámara cubre el volumen declarado dentro de la profundidad disponible.'
        : 'Con ' + Math.round(g.fovH) + '° harían falta ' + Math.round(necesaria) + ' cm de profundidad. '
          + 'Con ' + Math.round(prof) + ' cm disponibles se necesita un lente de al menos '
          + Math.round(fovNecesario) + '° horizontales.',
    };
  }

  /**
   * Parametrización del cuerpo en centímetros a partir de los 33 puntos.
   * Requiere ver los tobillos (contacto con el piso) para estimar la distancia.
   * Si el proveedor entrega `mundo` (coordenadas métricas de MediaPipe), se usa
   * como control cruzado de la envergadura.
   */
  function medirCuerpo(L, espacio, aspecto, mundo) {
    if (!L || L.length < 33) return { ok: false, motivo: 'Sin persona detectada' };
    const g = camaraGeometria(espacio, aspecto);
    const hc = clamp(num(espacio && espacio.camaraAltura, 160), 30, 400);
    const incl = clamp(num(espacio && espacio.camaraInclinacion, 10), -45, 45);
    const vis = (i) => L[i] && (L[i].visibility == null || L[i].visibility > 0.35);
    /** Ángulo de elevación del rayo que pasa por un punto de la imagen (grados). */
    const elevacion = (y) => {
      const theta = (Math.atan((0.5 - y) * 2 * g.tanV) * 180) / Math.PI;
      return theta - incl;                    // la cámara mira hacia abajo
    };
    const pies = [];
    if (vis(IDX.tobilloI)) pies.push(L[IDX.tobilloI]);
    if (vis(IDX.tobilloD)) pies.push(L[IDX.tobilloD]);
    if (!pies.length) return { ok: false, motivo: 'No veo tus pies: la distancia se mide desde el piso' };
    const yPies = pies.reduce((a, p) => a + p.y, 0) / pies.length;
    const aPies = elevacion(yPies);
    if (aPies >= -0.5) return { ok: false, motivo: 'Los pies quedan sobre el horizonte: revisa la inclinación de la cámara' };
    const distancia = hc / Math.tan(rad(-aPies));
    if (!Number.isFinite(distancia) || distancia <= 0 || distancia > 2000) {
      return { ok: false, motivo: 'Distancia fuera de rango: revisa altura e inclinación de la cámara' };
    }
    // Centímetros por unidad normalizada de imagen a esa distancia.
    const cmPorY = 2 * distancia * g.tanV;
    const cmPorX = 2 * distancia * g.tanH;
    const cabeza = vis(IDX.nariz) ? L[IDX.nariz] : null;
    let altura = null;
    if (cabeza) {
      const aCabeza = elevacion(cabeza.y);
      // La nariz queda unos 10 cm bajo la coronilla en un adulto.
      altura = hc + distancia * Math.tan(rad(aCabeza)) + 10;
    }
    const dist2 = (a, b) => (a && b ? Math.hypot((a.x - b.x) * cmPorX, (a.y - b.y) * cmPorY) : null);
    const segmentos = {
      anchoHombros: dist2(L[IDX.hombroI], L[IDX.hombroD]),
      brazoI: dist2(L[IDX.hombroI], L[IDX.codoI]),
      brazoD: dist2(L[IDX.hombroD], L[IDX.codoD]),
      antebrazoI: dist2(L[IDX.codoI], L[IDX.munecaI]),
      antebrazoD: dist2(L[IDX.codoD], L[IDX.munecaD]),
      torso: dist2(L[IDX.hombroI], L[IDX.caderaI]),
      musloI: dist2(L[IDX.caderaI], L[IDX.rodillaI]),
      musloD: dist2(L[IDX.caderaD], L[IDX.rodillaD]),
      piernaI: dist2(L[IDX.rodillaI], L[IDX.tobilloI]),
      piernaD: dist2(L[IDX.rodillaD], L[IDX.tobilloD]),
    };
    const envergadura = dist2(L[IDX.munecaI], L[IDX.munecaD]);
    // Control cruzado con las coordenadas métricas del modelo, si vienen.
    let envergaduraMundo = null;
    if (mundo && mundo[IDX.munecaI] && mundo[IDX.munecaD]) {
      const a = mundo[IDX.munecaI], b = mundo[IDX.munecaD];
      envergaduraMundo = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 100;
    }
    const cob = coberturaLente(espacio, aspecto);
    const dentro = distancia >= cob.zona * 0.55 && distancia <= (espacio && num(espacio.profundidad, 250)) + 30;
    return {
      ok: true, distancia, altura, envergadura, envergaduraMundo, segmentos,
      cmPorX, cmPorY, dentroDelEspacio: dentro,
      motivo: dentro ? 'Dentro del espacio de juego' : 'Fuera del espacio declarado',
      angulos: angulosDePose(L, false),
    };
  }

  /**
   * ¿Desde dónde ve la cámara el piso y hasta qué altura llega?
   * Con la cámara arriba del tótem y mirando al frente, el piso entra en cuadro
   * muy lejos: por eso esto se calcula y se avisa, en vez de suponerlo.
   */
  function alcanceVertical(espacio, aspecto) {
    const g = camaraGeometria(espacio, aspecto);
    const hc = clamp(num(espacio && espacio.camaraAltura, 160), 20, 400);
    const incl = clamp(num(espacio && espacio.camaraInclinacion, 10), -45, 45);
    const medio = g.fovV / 2;
    // Distancia a la que el borde inferior del cuadro toca el piso.
    const tanAbajo = Math.tan(rad(incl + medio));
    const distanciaPies = tanAbajo > 0.01 ? hc / tanAbajo : Infinity;
    /** Altura máxima visible a una distancia dada. */
    const techoEn = (d) => hc + d * Math.tan(rad(medio - incl));
    /** Altura mínima visible (0 = ya se ve el piso). */
    const pisoEn = (d) => Math.max(0, hc - d * tanAbajo);
    return { g, hc, incl, distanciaPies, techoEn, pisoEn };
  }

  /**
   * Sugerencia de montaje para un rango de estaturas dado. Busca la altura de
   * cámara e inclinación que dejan el cuerpo entero en cuadro dentro de la
   * profundidad disponible, centrando la franja que hay que capturar.
   */
  function sugerirMontaje(espacio, aspecto) {
    const g = camaraGeometria(espacio, aspecto);
    const alto = num(espacio && espacio.alto, ESPACIO_SUGERIDO.alto);
    const prof = num(espacio && espacio.profundidad, ESPACIO_SUGERIDO.profundidad);
    const hcActual = num(espacio && espacio.camaraAltura, 160);
    // Lo que hay que abarcar no se reparte a partes iguales en centímetros sino
    // en ÁNGULOS: desde la cámara, los 175 cm que hay hasta el piso ocupan
    // muchos más grados que los 65 que quedan sobre ella. Apuntar al punto
    // medio en centímetros (120 cm) inclina de más y deja la cabeza fuera.
    const grados = (r) => (r * 180) / Math.PI;
    const aPiso = (d) => grados(Math.atan(hcActual / d));           // hacia abajo
    const aTecho = (d) => grados(Math.atan((alto - hcActual) / d)); // hacia arriba (puede ser negativo)
    const abarca = (d) => aPiso(d) + aTecho(d);                     // franja vertical total
    // Distancia mínima donde la franja cabe con ~3° de margen, en cm enteros.
    const margen = 3;
    let distancia = Math.max(80, prof - 15);
    for (let d = 80; d <= prof - 15; d += 1) {
      if (abarca(d) <= g.fovV - margen) { distancia = d; break; }
    }
    // La inclinación correcta es la bisectriz de esos dos ángulos.
    const inclinacion = (aPiso(distancia) - aTecho(distancia)) / 2;
    // Y si se pudiera mover la cámara, a qué altura quedaría sin inclinarla:
    // ahí sí, la bisectriz coincide con el punto medio de la franja.
    const alturaSinInclinar = alto / 2;
    const al = alcanceVertical(espacio, aspecto);
    const veCuerpoEntero = al.distanciaPies <= prof && al.techoEn(al.distanciaPies) >= alto - 1;
    // El mejor caso posible del lente: la cámara a media franja, al fondo del
    // espacio. Si ni así cabe, no hay altura ni inclinación que lo arregle.
    const mejorCaso = 2 * grados(Math.atan(alto / (2 * prof)));
    const hayMontaje = mejorCaso <= g.fovV;
    const fovMinimo = grados(Math.atan(Math.tan(rad(mejorCaso / 2)) * g.aspecto)) * 2;
    return {
      distancia: Math.round(distancia),
      inclinacion: Math.round(inclinacion),
      alturaSinInclinar: Math.round(alturaSinInclinar),
      distanciaPies: al.distanciaPies,
      techoEnZona: al.techoEn(num(espacio && espacio.distanciaZona, distancia)),
      pisoEnZona: al.pisoEn(num(espacio && espacio.distanciaZona, distancia)),
      veCuerpoEntero, hayMontaje,
      mensaje: veCuerpoEntero
        ? 'El montaje actual ve el cuerpo entero dentro del espacio disponible.'
        : !hayMontaje
          ? 'Con ' + Math.round(g.fovH) + '° horizontales no hay altura ni inclinación que sirva para cuerpo entero: ' +
            'los ' + Math.round(alto) + ' cm de franja ocupan ' + Math.round(mejorCaso) + '° verticales incluso desde ' +
            Math.round(prof) + ' cm, y el lente da ' + Math.round(g.fovV) + '°. Hace falta un lente de al menos ' +
            Math.round(fovMinimo) + '° horizontales; para los juegos de medio cuerpo este sirve igual.'
          : 'Con la cámara a ' + Math.round(hcActual) + ' cm e inclinación ' + Math.round(num(espacio && espacio.camaraInclinacion, 10)) +
            '°, el piso recién entra en cuadro a ' + (al.distanciaPies === Infinity ? '∞' : Math.round(al.distanciaPies)) +
            ' cm. Para ver de pies a cabeza dentro de ' + Math.round(prof) + ' cm: inclínala ' + Math.round(inclinacion) +
            '° hacia abajo y marca la zona a ' + Math.round(distancia) + ' cm, o bájala a ' +
            Math.round(alturaSinInclinar) + ' cm y déjala horizontal.',
    };
  }

  // ── Autocalibración del montaje ────────────────────────────────────────
  //
  // El tótem mide 180 cm, pero la app tiene que servir igual con la cámara de
  // una tablet a 120, con un teléfono en un trípode a 60 para que jueguen niños
  // o con el Kinect sobre un mueble a 200. Pedirle al operador que mida con
  // huincha la altura y el ángulo es pedirle demasiado, y cualquier error ahí
  // envenena todas las medidas en centímetros.
  //
  // Así que se deduce mirando a una persona. La geometría es la de siempre: un
  // punto a distancia `d` y altura `y` sobre el piso, con la cámara a altura
  // `h` inclinada `t` hacia abajo, cae en la imagen donde
  //
  //     tan( atan((h − y) / d) − t ) = (2·yImagen − 1) · tanV
  //
  // Con la CABEZA y los PIES de la misma persona hay dos ecuaciones. Las
  // incógnitas son `h`, `t` y la distancia `d` de esa observación: una sola
  // pose deja una curva de soluciones, no una. Por eso se piden DOS distancias
  // —"párate en la marca" y "da dos pasos atrás"—: ahí el sistema se cierra.
  //
  // Con Kinect no hace falta nada de esto: el sensor entrega el plano del piso,
  // y de ahí salen la altura y la inclinación exactas.

  /**
   * Distancia y altura que implica una observación, dados un montaje candidato.
   * Devuelve las dos estimaciones de `d` —la que sale de los pies y la que sale
   * de la cabeza— para poder medir cuánto se contradicen.
   */
  function distanciasDeObservacion(obs, h, t, tanV, estatura) {
    const angulo = (yImg) => Math.atan((2 * yImg - 1) * tanV) + t;
    const aPies = angulo(obs.yPies);
    const aCabeza = angulo(obs.yCabeza);
    // Los pies están en el suelo: el rayo tiene que bajar desde la cámara.
    if (aPies <= 0.001) return null;
    const dPies = h / Math.tan(aPies);
    // La cabeza está a `estatura` del suelo; si la cámara está por debajo de
    // ella, el rayo sube y la tangente cambia de signo sola.
    const tCab = Math.tan(aCabeza);
    if (Math.abs(tCab) < 1e-6) return null;
    const dCabeza = (h - estatura) / tCab;
    if (!Number.isFinite(dPies) || !Number.isFinite(dCabeza) || dPies <= 0 || dCabeza <= 0) return null;
    return { dPies, dCabeza, d: (dPies + dCabeza) / 2 };
  }

  /**
   * Busca la altura e inclinación que mejor explican lo observado.
   * Búsqueda numérica en dos pasadas: no hay solución cerrada y el espacio es
   * chico (altura de 40 a 260 cm, inclinación de 0 a 45°), así que buscar es
   * más honesto que despejar a mano una ecuación que no se despeja.
   */
  function resolverMontaje(observaciones, tanV, estatura) {
    const obs = (observaciones || []).filter((o) => o && Number.isFinite(o.yPies) && Number.isFinite(o.yCabeza));
    if (obs.length < 2) return null;
    const error = (h, t) => {
      let suma = 0;
      for (const o of obs) {
        const r = distanciasDeObservacion(o, h, t, tanV, estatura);
        if (!r) return Infinity;
        // Cuánto se contradicen las dos lecturas de la misma persona.
        suma += Math.pow((r.dPies - r.dCabeza) / Math.max(30, r.d), 2);
      }
      return suma / obs.length;
    };
    let mejor = null;
    const barrer = (h0, h1, dh, t0, t1, dt) => {
      for (let h = h0; h <= h1; h += dh) {
        for (let t = t0; t <= t1; t += dt) {
          const e = error(h, rad(t));
          if (Number.isFinite(e) && (!mejor || e < mejor.e)) mejor = { h, t, e };
        }
      }
    };
    // La inclinación puede ser NEGATIVA: una cámara baja —un teléfono en un
    // trípode a 60 cm— hay que apuntarla hacia arriba para que quepa la cabeza.
    barrer(40, 260, 5, -20, 45, 1);
    if (!mejor) return null;
    barrer(Math.max(40, mejor.h - 6), Math.min(260, mejor.h + 6), 0.5,
      Math.max(-20, mejor.t - 1.5), Math.min(45, mejor.t + 1.5), 0.1);
    const dists = obs.map((o) => distanciasDeObservacion(o, mejor.h, rad(mejor.t), tanV, estatura)).filter(Boolean);
    if (!dists.length) return null;
    return {
      camaraAltura: Math.round(mejor.h),
      camaraInclinacion: Math.round(mejor.t * 10) / 10,
      distancias: dists.map((x) => Math.round(x.d)),
      residuo: Math.sqrt(mejor.e),
      fuente: 'observacion',
    };
  }

  /**
   * Acumula observaciones de una persona y deduce el montaje.
   *
   * Con Kinect es directo y exacto: el plano del piso da la altura de la cámara
   * y su inclinación sin que nadie se mueva. Con una cámara RGB hace falta que
   * la persona se pare en dos sitios a distinta distancia, y una estatura de
   * referencia; el resultado se declara como estimado, porque lo es.
   */
  function calibradorMontaje(opts) {
    const o = opts || {};
    const estatura = clamp(num(o.estatura, 170), 90, 220);
    const tanV = Math.tan(rad(clamp(num(o.fovV, 50), 20, 140) / 2));
    const minMuestras = Math.max(6, num(o.minMuestras, 12));
    let puntos = [];          // observaciones RGB por posición
    let actual = null;        // acumulador de la posición que se está tomando
    let porPiso = null;       // lo que dijo el Kinect, si estaba
    return {
      reset() { puntos = []; actual = null; porPiso = null; },
      posiciones() { return puntos.length; },
      /** Cuántas muestras lleva la posición en curso, de las que hacen falta. */
      progreso() { return actual ? clamp(actual.n / minMuestras, 0, 1) : 0; },
      /** Con Kinect basta una toma; con RGB hacen falta dos posiciones. */
      listo() { return !!porPiso || puntos.length >= 2; },

      /** Una lectura de pose. Devuelve el motivo si no sirve para calibrar. */
      muestra(L, k) {
        // ── Camino exacto: el sensor ya midió el piso ──────────────────
        if (k && k.piso && Number.isFinite(k.piso.y)) {
          const p = k.piso;
          const largo = Math.hypot(num(p.x, 0), num(p.y, 1), num(p.z, 0)) || 1;
          // `w` es la altura de la cámara sobre el suelo, en metros.
          const altura = Math.abs(num(p.w, 0)) * 100;
          // La normal del piso apunta hacia arriba; cuánto se inclinó la
          // cámara es cuánto se desvió esa normal de la vertical de la imagen.
          const inclinacion = Math.atan2(num(p.z, 0) / largo, num(p.y, 1) / largo) * 180 / Math.PI;
          if (altura > 30 && altura < 300) {
            porPiso = {
              camaraAltura: Math.round(altura),
              camaraInclinacion: Math.round(Math.abs(inclinacion) * 10) / 10,
              distancias: k.distancia != null ? [Math.round(k.distancia * 100)] : [],
              residuo: 0, fuente: 'piso-kinect',
            };
            return null;
          }
        }
        // ── Camino estimado: cabeza y pies en la imagen ────────────────
        if (!L) return 'No te veo';
        const ver = (p) => p && (p.visibility == null || p.visibility > 0.4);
        const cabeza = ver(L[IDX.nariz]) ? L[IDX.nariz] : null;
        const pies = [L[31], L[32], L[IDX.tobilloI], L[IDX.tobilloD]].filter(ver);
        if (!cabeza) return 'No veo tu cabeza';
        if (!pies.length) return 'No veo tus pies: la cámara tiene que alcanzar el suelo';
        const yPies = Math.max.apply(null, pies.map((p) => p.y));
        // La nariz no es la coronilla: hay ~10 cm de cabeza por encima, que a
        // esta escala son una fracción del alto aparente de la persona.
        const alto = yPies - cabeza.y;
        if (alto < 0.1) return 'Acércate: te ves muy pequeño';
        const yCabeza = cabeza.y - alto * 0.09;
        if (!actual) actual = { n: 0, sPies: 0, sCabeza: 0 };
        actual.n++; actual.sPies += yPies; actual.sCabeza += yCabeza;
        return null;
      },

      /** Cierra la posición en curso. Se llama al terminar cada toma. */
      fijarPosicion() {
        if (!actual || actual.n < minMuestras) return false;
        puntos.push({ yPies: actual.sPies / actual.n, yCabeza: actual.sCabeza / actual.n });
        actual = null;
        return true;
      },

      /** El montaje deducido, o null si todavía no alcanza. */
      resultado() {
        if (porPiso) return porPiso;
        const r = resolverMontaje(puntos, tanV, estatura);
        if (!r) return null;
        // Dos posiciones casi a la misma distancia no cierran el sistema: la
        // solución sale, pero apoyada en nada. Vale más decirlo que publicarla.
        const ds = r.distancias.slice().sort((a, b) => a - b);
        const separacion = ds.length > 1 ? ds[ds.length - 1] - ds[0] : 0;
        return Object.assign({}, r, {
          separacion,
          confiable: separacion >= 40 && r.residuo < 0.12,
        });
      },
    };
  }

  // ── Catálogo de cámaras ────────────────────────────────────────────────
  //
  // El tótem trae la cámara arriba, fija y mirando al frente. Esa posición es
  // la que obliga a inclinar o a bajar el lente. Como no siempre se puede tocar
  // el herraje, la app permite declarar QUÉ cámara se usa y calcula con sus
  // datos si ese montaje sirve. `fovH` es el campo horizontal del fabricante;
  // `seguimiento` dice si la cámara mueve el lente sola (gimbal / PTZ).
  //
  // Sobre el seguimiento: una cámara con gimbal reencuadra sola, pero al girar
  // cambian su ángulo y su punto de vista, y la app deja de saber a qué ángulo
  // corresponde cada píxel — que es justo lo que permite medir en centímetros.
  // Por eso el seguimiento recomendado es DIGITAL: lente fijo y ancho, y el
  // recorte que sigue a la persona se hace en software, donde sí se conoce.

  const CAMARAS = [
    {
      id: 'integrada', nombre: 'Cámara integrada del tótem', fovH: 70, res: '1080p', fps: 30,
      seguimiento: 'ninguno', profundidad: false, montaje: 'fija en el marco de la pantalla',
      nota: 'Es la que ya viene. Sirve para juegos de medio cuerpo si la zona queda cerca; para cuerpo entero se queda corta de campo.',
    },
    {
      id: 'gran-angular', nombre: 'Webcam USB gran angular (90°)', fovH: 90, res: '1080p', fps: 30,
      seguimiento: 'ninguno', profundidad: false, montaje: 'soporte propio, altura libre',
      nota: 'La opción recomendada: barata, se monta a la altura que uno quiera y con 90° cubre el volumen completo a poco más de 2 m.',
    },
    {
      id: 'ultra-ancha', nombre: 'Módulo USB ultra ancho (120°)', fovH: 120, res: '1080p', fps: 30,
      seguimiento: 'ninguno', profundidad: false, montaje: 'fija arriba, sin inclinar',
      nota: 'Permite dejar la cámara arriba y horizontal, pero el lente distorsiona en los bordes: la medición en centímetros pierde precisión si no se corrige la distorsión.',
    },
    {
      // Un teléfono con Iriun o DroidCam aparece como una cámara más del
      // sistema, así que la app no necesita saber nada especial. Su gracia no
      // es el lente: es que se puede poner a la altura que uno quiera, que es
      // justo lo que un tótem con la cámara empotrada a 175 cm no permite.
      id: 'telefono', nombre: 'Teléfono en trípode (Iriun / DroidCam)', fovH: 70, res: '1080p', fps: 30,
      seguimiento: 'ninguno', profundidad: false, montaje: 'trípode, altura libre de 60 a 200 cm',
      nota: 'La forma más barata de bajar la cámara. A 60–90 cm juegan los niños de cuerpo entero sin alejarse; a 120–140 cm sirve para todo el mundo. Se conecta con Iriun o DroidCam y sale en la lista de cámaras como una webcam más. Usa la autocalibración para que la app sepa a qué altura quedó.',
    },
    {
      id: 'telefono-ancho', nombre: 'Teléfono, lente ultra ancho (Iriun / DroidCam)', fovH: 106, res: '1080p', fps: 30,
      seguimiento: 'ninguno', profundidad: false, montaje: 'trípode, altura libre',
      nota: 'El ultra ancho del teléfono cubre el cuerpo entero desde mucho más cerca: es la opción para espacios chicos. Distorsiona en los bordes, así que conviene dejar a la persona centrada.',
    },
    {
      id: 'ptz-ia', nombre: 'PTZ de escritorio con seguimiento por gimbal', fovH: 86, res: '4K', fps: 30,
      seguimiento: 'mecanico', profundidad: false, montaje: 'gimbal de 2 ejes sobre la pantalla',
      nota: 'Sigue a la persona moviendo el lente. Encuadra muy bien para mostrar en pantalla, pero al girar cambia la geometría y la app no puede medir estatura ni distancia mientras se mueve.',
    },
    {
      // El campo que importa es el del sensor de PROFUNDIDAD (70° × 60°), que
      // es de donde sale el esqueleto; la cámara de color abre más (84,1° ×
      // 53,8°) pero no es la que sigue el cuerpo. Y su relación de aspecto es
      // 512×424, no 16:9: sin declararla, el cálculo vertical subestima casi
      // 17° y diría que no ve la cabeza cuando sí la ve.
      id: 'kinect-v2', nombre: 'Kinect for Xbox One (v2) + puente', fovH: 70, fovV: 60,
      aspecto: 512 / 424, res: '1080p color + 512×424 profundidad', fps: 30,
      seguimiento: 'ninguno', profundidad: true, esqueleto: true,
      rango: { min: 50, max: 450 }, montaje: 'soporte propio, altura libre',
      nota: 'El único del catálogo que entrega ESQUELETO en metros: 25 articulaciones, estado de las manos, inclinación del torso y plano del piso. No aparece en la lista de cámaras del sistema porque no es una webcam: llega por el puente local. Ve de 0,5 a 4,5 m.',
    },
    {
      // La única del catálogo, además del Kinect, que trae esqueleto propio:
      // replica los modos de profundidad del Azure Kinect y corre su Body
      // Tracking SDK por el wrapper K4A de Orbbec. Es su reemplazo vigente.
      id: 'femto-bolt', nombre: 'Orbbec Femto Bolt (profundidad + esqueleto)', fovH: 75, fovV: 65,
      aspecto: 1024 / 1024, res: '1080p color + 1024×1024 profundidad', fps: 30,
      seguimiento: 'ninguno', profundidad: true, esqueleto: true,
      rango: { min: 25, max: 550 }, montaje: 'soporte propio, altura libre',
      nota: 'Profundidad Y articulaciones, sin depender de la luz de la sala. No está integrada todavía: haría falta un puente propio, como el del Kinect. Es la pieza vigente si se necesita esqueleto por hardware.',
    },
    {
      // OJO: mide profundidad, NO entrega articulaciones. El esqueleto sigue
      // saliendo de MediaPipe sobre su imagen. Ver docs/CAMARA-EXTERNA.md §4.
      id: 'profundidad', nombre: 'Cámara de profundidad OAK-D Lite (sin esqueleto)', fovH: 69, res: '1080p + estéreo', fps: 30,
      seguimiento: 'ninguno', profundidad: true, montaje: 'soporte propio, altura libre',
      nota: 'Mide distancia de verdad, sin depender del piso ni de ver los tobillos, pero NO entrega articulaciones: el cuerpo se sigue sacando con MediaPipe sobre su imagen. Su campo es angosto: hay que darle distancia o bajarla.',
    },
    {
      id: 'profundidad-ancha', nombre: 'Orbbec Gemini 335 (profundidad, sin esqueleto)', fovH: 90, res: '1080p + estéreo', fps: 30,
      seguimiento: 'ninguno', profundidad: true, montaje: 'soporte propio, altura libre',
      nota: 'El mejor mapa de profundidad por el precio, y campo ancho. Pero NO trae seguimiento de cuerpo: las articulaciones se siguen sacando con MediaPipe sobre su imagen RGB. Si lo que se busca es esqueleto por hardware, la pieza es la Femto Bolt.',
    },
    {
      id: 'personalizada', nombre: 'Otra cámara (campo definido a mano)', fovH: 90, res: '—', fps: 30,
      seguimiento: 'ninguno', profundidad: false, montaje: 'a definir',
      nota: 'Usa el campo de visión que se declare abajo.',
    },
  ];

  const camaraPorId = (id) => CAMARAS.find((c) => c.id === id) || CAMARAS[CAMARAS.length - 1];

  /**
   * ¿Sirve esta cámara con el montaje declarado? Recalcula la cobertura del
   * lente y el alcance
   * vertical con el campo de visión del modelo elegido, sin tocar el resto.
   */
  function evaluarCamara(cam, espacio, aspecto) {
    const c = typeof cam === 'string' ? camaraPorId(cam) : cam;
    const e = Object.assign({}, espacio, { fovHorizontal: c.id === 'personalizada' ? num(espacio && espacio.fovHorizontal, c.fovH) : c.fovH });
    // Hay sensores que no son 16:9 —el de profundidad del Kinect es 512×424—,
    // y el campo vertical sale del horizontal DIVIDIDO por el aspecto: usar el
    // del monitor daría un vertical mucho menor que el real.
    const asp = num(c.aspecto, num(aspecto, 16 / 9));
    const cob = coberturaLente(e, asp);
    const mont = sugerirMontaje(e, asp);
    const al = alcanceVertical(e, asp);
    const zona = cob.zona;
    const pisoZona = al.pisoEn(zona);
    const techoZona = al.techoEn(zona);
    // Medio cuerpo y cuerpo entero se evalúan en la MISMA zona marcada: hay una
    // sola marca en el piso para todos los juegos. La columna de medio cuerpo
    // no es otra distancia, es la respuesta a "si no da para cuerpo entero,
    // ¿qué juegos puedo correr igual?".
    const zonaMedio = zona;
    const pisoMedio = pisoZona;
    const techoMedio = techoZona;
    // Medio cuerpo: los hombros de un niño de 100 cm quedan a ~82 cm del piso.
    const medioCuerpo = pisoMedio <= 82 && techoMedio >= 200;
    const cuerpoEntero = pisoZona <= 1 && techoZona >= num(e.alto, 240) - 1;
    const razones = [];
    if (!cuerpoEntero) {
      razones.push('En la zona ve de ' + Math.round(pisoZona) + ' a ' + Math.round(techoZona) + ' cm: no llega al piso.');
    }
    if (!medioCuerpo) {
      razones.push('A ' + Math.round(zonaMedio) + ' cm ve desde ' + Math.round(pisoMedio) +
        ' cm: corta a los niños en los juegos de medio cuerpo (los hombros de uno de 100 cm están a 82 cm).');
    }
    if (!cob.alcanza) razones.push('Necesita ' + Math.round(cob.distanciaMinima) + ' cm de profundidad y hay ' + Math.round(cob.profundidad) + '.');
    if (c.seguimiento === 'mecanico') razones.push('Al mover el lente se pierde la referencia para medir en centímetros.');
    if (c.fovH >= 110) razones.push('El lente ultra ancho distorsiona los bordes: conviene calibrarlo antes de confiar en la estatura.');
    return {
      camara: c, fovH: cob.geometria.fovH, fovV: cob.geometria.fovV,
      coberturaLente: cob, montaje: mont, pisoZona, techoZona,
      zonaMedio, pisoMedio, techoMedio,
      sirveMedioCuerpo: medioCuerpo, sirveCuerpoEntero: cuerpoEntero,
      inclinacionNecesaria: mont.inclinacion,
      apta: cuerpoEntero && cob.alcanza && c.seguimiento !== 'mecanico',
      razones,
      resumen: cuerpoEntero
        ? 'Ve de pies a cabeza en la zona marcada.'
        // Si el lente no cubre el volumen, mover la cámara no arregla nada:
        // el problema es el campo de visión, y hay que decirlo así.
        : !cob.alcanza
          ? 'Para cuerpo entero este lente necesita ' + Math.round(cob.distanciaMinima) + ' cm de distancia y hay ' +
            Math.round(cob.profundidad) + ': no se arregla inclinándola, hace falta un lente de al menos ' +
            Math.round(cob.fovNecesario) + '°. Sirve igual para los juegos de medio cuerpo.'
          : (medioCuerpo ? 'Sirve para los juegos de medio cuerpo; para cuerpo entero hay que inclinarla ' + Math.round(mont.inclinacion) + '° o bajarla a ' + Math.round(mont.alturaSinInclinar) + ' cm.'
            : 'Con este montaje no alcanza ni para medio cuerpo: inclínala ' + Math.round(mont.inclinacion) + '° o bájala a ' + Math.round(mont.alturaSinInclinar) + ' cm.'),
    };
  }

  /**
   * Evalúa todo el catálogo con el montaje actual y lo ordena por conveniencia:
   * primero las aptas y sin advertencias, después las aptas con reparos, y al
   * final las que no cubren el volumen. "Otra cámara" siempre va al final:
   * no es un modelo, es un hueco para escribir los datos a mano.
   */
  function compararCamaras(espacio, aspecto) {
    const orden = (f) => (f.camara.id === 'personalizada' ? -10 : 0) +
      (f.apta ? 4 : 0) + (f.razones.length ? 0 : 2) + (f.sirveMedioCuerpo ? 1 : 0);
    return CAMARAS.map((c) => evaluarCamara(c, espacio, aspecto))
      .sort((a, b) => (orden(b) - orden(a)) || (b.fovH - a.fovH));
  }

  /**
   * Seguimiento digital ("gimbal electrónico"): en vez de mover el lente, se
   * recorta la parte del cuadro donde está la persona y se amplía en pantalla.
   * La pose se sigue calculando sobre el cuadro completo, así que la medición
   * en centímetros no se ve afectada: esto es solo encuadre.
   * Devuelve un estado suavizado {zoom, cx, cy} y su transform CSS.
   */
  function seguimientoDigital(L, previo, opts) {
    const o = opts || {};
    const suave = clamp(num(o.suavizado, 0.12), 0.01, 1);
    const zoomMax = clamp(num(o.zoomMax, 1.8), 1, 3);
    const base = previo || { zoom: 1, cx: 0.5, cy: 0.5 };
    if (!L || !L.length) {
      // Sin persona vuelve despacio al cuadro completo.
      return {
        zoom: base.zoom + (1 - base.zoom) * suave,
        cx: base.cx + (0.5 - base.cx) * suave,
        cy: base.cy + (0.5 - base.cy) * suave,
        siguiendo: false,
      };
    }
    const pts = L.filter((p) => p && (p.visibility == null || p.visibility > 0.4));
    if (pts.length < 4) return Object.assign({}, base, { siguiendo: false });
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (const p of pts) {
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
    const margen = num(o.margen, 0.12);
    const ancho = clamp((x1 - x0) + margen * 2, 0.08, 1);
    const alto = clamp((y1 - y0) + margen * 2, 0.08, 1);
    const objetivoZoom = clamp(Math.min(1 / ancho, 1 / alto), 1, zoomMax);
    // El centro no puede acercarse al borde más de lo que el zoom permite.
    const lim = (z) => 0.5 - 0.5 / z;
    const objCx = clamp((x0 + x1) / 2, 0.5 - lim(objetivoZoom), 0.5 + lim(objetivoZoom));
    const objCy = clamp((y0 + y1) / 2, 0.5 - lim(objetivoZoom), 0.5 + lim(objetivoZoom));
    const zoom = base.zoom + (objetivoZoom - base.zoom) * suave;
    const l = lim(zoom);
    return {
      zoom,
      cx: clamp(base.cx + (objCx - base.cx) * suave, 0.5 - l, 0.5 + l),
      cy: clamp(base.cy + (objCy - base.cy) * suave, 0.5 - l, 0.5 + l),
      siguiendo: true,
    };
  }

  /**
   * Transform CSS del seguimiento digital. Se aplica al contenedor que lleva el
   * video Y sus capas encima (esqueleto, silueta), para que todo siga alineado.
   * `contenidoEspejado` avisa que abajo la imagen ya está en espejo.
   */
  function transformSeguimiento(t, contenidoEspejado) {
    if (!t) return 'none';
    const cx = contenidoEspejado ? 1 - t.cx : t.cx;
    const dx = ((0.5 - cx) * 100) / t.zoom;
    const dy = ((0.5 - t.cy) * 100) / t.zoom;
    return 'scale(' + t.zoom.toFixed(3) + ') translate(' + dx.toFixed(2) + '%,' + dy.toFixed(2) + '%)';
  }

  /** Nombres legibles de las articulaciones que la app usa. */
  const ARTICULACIONES = [
    { i: IDX.nariz, n: 'Cabeza' },
    { i: IDX.hombroI, n: 'Hombro izq.' }, { i: IDX.hombroD, n: 'Hombro der.' },
    { i: IDX.codoI, n: 'Codo izq.' }, { i: IDX.codoD, n: 'Codo der.' },
    { i: IDX.munecaI, n: 'Muñeca izq.' }, { i: IDX.munecaD, n: 'Muñeca der.' },
    { i: IDX.caderaI, n: 'Cadera izq.' }, { i: IDX.caderaD, n: 'Cadera der.' },
    { i: IDX.rodillaI, n: 'Rodilla izq.' }, { i: IDX.rodillaD, n: 'Rodilla der.' },
    { i: IDX.tobilloI, n: 'Tobillo izq.' }, { i: IDX.tobilloD, n: 'Tobillo der.' },
  ];

  /** Diagrama a escala del volumen de juego, con el veredicto del lente. */
  function DiagramaEspacio(props) {
    const e = props.espacio || {};
    const c = coberturaLente(e, props.aspecto);
    const alto = c.alto, prof = c.profundidad, zona = c.zona;
    const esc = 460 / Math.max(alto, prof);            // px por cm
    const px = (cm) => cm * esc;
    const suelo = 520, camX = 90;
    const camY = suelo - px(num(e.camaraAltura, 160));
    const finX = camX + px(prof);
    const zonaX = camX + px(zona);
    const personaAlto = px(num(props.altura, 175));
    return h('svg', { viewBox: '0 0 640 580', className: 'fp-espacio-svg' },
      h('rect', { width: 640, height: 580, fill: 'rgba(255,255,255,.03)', rx: 12 }),
      // piso y volumen
      h('line', { x1: 40, y1: suelo, x2: 620, y2: suelo, stroke: 'rgba(255,255,255,.6)', strokeWidth: 4 }),
      h('rect', {
        x: camX, y: suelo - px(alto), width: px(prof), height: px(alto),
        fill: 'rgba(124,255,178,.06)', stroke: 'rgba(124,255,178,.5)', strokeWidth: 3, strokeDasharray: '10 8',
      }),
      // cono de la cámara
      h('path', {
        d: 'M' + camX + ' ' + camY +
           ' L' + finX + ' ' + (camY - px(prof) * Math.tan(rad(camaraGeometria(e, props.aspecto).fovV / 2 - num(e.camaraInclinacion, 10)))) +
           ' L' + finX + ' ' + (camY + px(prof) * Math.tan(rad(camaraGeometria(e, props.aspecto).fovV / 2 + num(e.camaraInclinacion, 10)))) + ' Z',
        fill: 'rgba(25,172,177,.18)', stroke: 'rgba(25,172,177,.6)', strokeWidth: 2,
      }),
      // tótem + cámara
      h('rect', { x: camX - 46, y: suelo - px(180), width: 46, height: px(180), rx: 6, fill: '#1f2937', stroke: 'rgba(255,255,255,.35)', strokeWidth: 3 }),
      h('circle', { cx: camX - 4, cy: camY, r: 9, fill: '#111827', stroke: '#fff', strokeWidth: 2 }),
      h('text', { x: camX - 24, y: suelo + 22, textAnchor: 'middle', className: 'fp-esp-cota' }, 'tótem'),
      // persona en la zona
      h('g', { transform: 'translate(' + zonaX + ',' + suelo + ')', stroke: c.alcanza ? '#4ADE80' : '#F4B400', strokeWidth: 4, fill: 'none' },
        h('circle', { cx: 0, cy: -personaAlto + 14, r: 14 }),
        h('path', { d: 'M0 ' + (-personaAlto + 28) + ' L0 ' + (-personaAlto * 0.45) }),
        h('path', { d: 'M0 ' + (-personaAlto * 0.45) + ' L-16 0 M0 ' + (-personaAlto * 0.45) + ' L16 0' }),
        h('path', { d: 'M0 ' + (-personaAlto * 0.8) + ' L-22 ' + (-personaAlto * 0.5) + ' M0 ' + (-personaAlto * 0.8) + ' L22 ' + (-personaAlto * 0.5) })),
      h('line', { x1: zonaX, y1: suelo, x2: zonaX, y2: suelo + 16, stroke: '#fff', strokeWidth: 3 }),
      // cotas
      h('g', null,
        h('path', { d: 'M' + camX + ' ' + (suelo + 38) + ' L' + zonaX + ' ' + (suelo + 38), stroke: '#fff', strokeWidth: 2 }),
        h('text', { x: (camX + zonaX) / 2, y: suelo + 32, textAnchor: 'middle', className: 'fp-esp-cota' }, Math.round(zona) + ' cm'),
        h('path', { d: 'M' + camX + ' ' + (suelo + 58) + ' L' + finX + ' ' + (suelo + 58), stroke: 'rgba(255,255,255,.6)', strokeWidth: 2 }),
        h('text', { x: (camX + finX) / 2, y: suelo + 74, textAnchor: 'middle', className: 'fp-esp-cota' }, 'profundidad ' + Math.round(prof) + ' cm'),
        h('path', { d: 'M' + (finX + 22) + ' ' + suelo + ' L' + (finX + 22) + ' ' + (suelo - px(alto)), stroke: 'rgba(255,255,255,.6)', strokeWidth: 2 }),
        h('text', { x: finX + 30, y: suelo - px(alto) / 2, className: 'fp-esp-cota' }, 'alto ' + Math.round(alto) + ' cm')),
      // veredicto
      h('text', { x: 320, y: 30, textAnchor: 'middle', className: 'fp-esp-titulo' },
        'FOV ' + Math.round(c.geometria.fovH) + '°H / ' + Math.round(c.geometria.fovV) + '°V · a ' + Math.round(zona) + ' cm abarca ' +
        Math.round(c.anchoCubierto) + '×' + Math.round(c.altoCubierto) + ' cm'),
      );
  }

  /** El diagrama más su veredicto en texto (que necesita fluir en varias líneas). */
  function BloqueEspacio(props) {
    const c = coberturaLente(props.espacio, props.aspecto);
    const mont = sugerirMontaje(props.espacio, props.aspecto);
    return h('div', { className: 'fp-espacio-bloque' },
      h(DiagramaEspacio, props),
      h('p', { className: 'fp-esp-veredicto' + (c.alcanza ? ' is-ok' : ' is-mal') },
        (c.alcanza ? '✔ ' : '⚠ ') + c.recomendacion),
      h('p', { className: 'fp-esp-veredicto' + (mont.veCuerpoEntero ? ' is-ok' : ' is-mal') },
        (mont.veCuerpoEntero ? '✔ ' : '⚠ ') + mont.mensaje),
      h('p', { className: 'fp-esp-veredicto' },
        'En la zona (' + Math.round(num(props.espacio.distanciaZona, 180)) + ' cm) la cámara ve de ' +
        Math.round(mont.pisoEnZona) + ' cm a ' + Math.round(mont.techoEnZona) + ' cm de altura' +
        (mont.pisoEnZona > 5
          ? ' — los juegos de cuerpo entero necesitan llegar a 0 cm; los de medio cuerpo, cubrir los hombros de una persona de 100 cm (≈ 82 cm).'
          : ' — alcanza para ver de pies a cabeza.')));
  }

  /**
   * Video de la cámara con seguimiento digital opcional. Los hijos (esqueleto,
   * silueta, contorno) van dentro del mismo contenedor transformado, así que el
   * recorte no los desalinea. La pose se sigue leyendo del cuadro completo.
   */
  function CamaraVista(props) {
    const segRef = useRef({ zoom: 1, cx: 0.5, cy: 0.5, siguiendo: false });
    const activo = !!(props.espacio && props.espacio.seguimiento === 'digital');
    let estilo = null;
    if (activo) {
      segRef.current = seguimientoDigital(props.landmarks, segRef.current, { margen: num(props.margen, 0.14), zoomMax: num(props.zoomMax, 1.7) });
      estilo = { transform: transformSeguimiento(segRef.current, !!props.espejo) };
    }
    // El Kinect no llena un <video>: manda sus cuadros por el puente. Se
    // pintan en un <canvas> que ocupa el mismo lugar, así el jugador se ve
    // igual y no hace falta encender una webcam al lado del sensor.
    const lienzoRef = useRef(null);
    const img = props.imagenKinect || null;
    useEffect(() => {
      const c = lienzoRef.current;
      if (!c || !img) return;
      if (c.width !== img.width || c.height !== img.height) { c.width = img.width; c.height = img.height; }
      const ctx = c.getContext('2d');
      if (ctx) ctx.putImageData(img, 0, 0);
    });
    return h('div', { className: 'fp-cam-track' + (activo ? ' is-activo' : ''), style: estilo },
      h('video', {
        ref: props.attach,
        className: 'fp-video' + (props.espejo ? ' is-mirror' : '') + (props.mini ? ' fp-video--mini' : '') + (img ? ' is-oculto' : ''),
        autoPlay: true, playsInline: true, muted: true,
      }),
      img ? h('canvas', {
        ref: lienzoRef,
        className: 'fp-video' + (props.espejo ? ' is-mirror' : '') + (props.mini ? ' fp-video--mini' : ''),
      }) : null,
      props.children);
  }

  /** Comparativa del catálogo de cámaras con el montaje declarado. */
  function TablaCamaras(props) {
    const filas = compararCamaras(props.espacio, props.aspecto);
    const sel = s(props.espacio && props.espacio.camaraModelo);
    return h('div', { className: 'fp-camtabla' },
      h('h4', null, 'Qué pasa con cada cámara en este montaje'),
      h('p', { className: 'fp-hint' },
        'Cámara a ' + num(props.espacio.camaraAltura, 145) + ' cm, inclinada ' +
        Math.round(num(props.espacio.camaraInclinacion, 5)) + '°, zona única a ' +
        Math.round(num(props.espacio.distanciaZona, 220)) + ' cm.'),
      h('div', { className: 'fp-tabla-scroll' },
        h('table', { className: 'fp-table fp-tabla' },
          h('thead', null, h('tr', null,
            h('th', null, 'Cámara'), h('th', null, 'FOV'), h('th', null, 'En la zona ve'),
            h('th', null, 'Medio cuerpo'), h('th', null, 'Cuerpo entero'), h('th', null, 'Observación'))),
          h('tbody', null, filas.map((f) => h('tr', {
            key: f.camara.id, className: f.camara.id === sel ? 'is-sel' : '',
          },
            h('td', null, (f.camara.id === sel ? '▸ ' : '') + f.camara.nombre + (f.camara.profundidad ? ' · profundidad' : '')),
            h('td', null, Math.round(f.fovH) + '°H / ' + Math.round(f.fovV) + '°V'),
            h('td', null, Math.round(f.pisoZona) + '–' + Math.round(f.techoZona) + ' cm'),
            h('td', null, f.sirveMedioCuerpo ? '✔' : '—'),
            h('td', null, f.sirveCuerpoEntero ? '✔' : '—'),
            h('td', null, f.razones.length ? f.razones[0] : f.resumen))))))
      ,
      h('p', { className: 'fp-hint' },
        'La columna "en la zona ve" es la franja de alturas que entra en cuadro en la marca del piso. ' +
        'Para cuerpo entero tiene que empezar en 0 cm; la columna de medio cuerpo dice si, aun sin ver los pies, ' +
        'se pueden jugar rayuela, boxeo y esquiva: basta con cubrir los hombros de alguien de 100 cm (≈ 82 cm), ' +
        'que es lo que decide si los niños quedan fuera de cuadro.'));
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

  // ── 9.b Modo rítmico táctil ──────────────────────────────────────────
  //
  // Prueba de baile era el único juego con cámara sin entrada alternativa de
  // verdad: el botón «probar sin cámara» arranca un maniquí que baila solo, y
  // el puntaje no es de nadie. Acá se juega la MISMA coreografía sin cámara,
  // por toque o teclado, y el puntaje sí es del jugador.
  //
  // No se inventa una coreografía nueva: los pulsos salen de `steps[].beats`
  // y del `bpm` que ya existen, y el CARRIL de cada nota sale de la pose del
  // paso —el lado que levanta el avatar—, así que cualquier coreografía que
  // el operador escriba en el editor se vuelve jugable por toque sin escribir
  // un solo dato más.
  //
  // Lo que NO es: no es la misma prueba que con cámara. Acá se mide llegar a
  // tiempo, no la postura. El ranking lo dice en el detalle de la fila.

  /** Ventanas de juicio, en ms alrededor del pulso, a 96 bpm. */
  const RITMO_JUICIOS = [
    { id: 'perfecto', ms: 80, calidad: 1, texto: '¡Perfecto!' },
    { id: 'bien', ms: 150, calidad: 0.75, texto: '¡Bien!' },
    { id: 'casi', ms: 240, calidad: 0.4, texto: 'Casi' },
  ];
  const RITMO_VENTANA = 240;

  /**
   * Las ventanas se encogen si la coreografía va rápida: con pulsos de 375 ms
   * (160 bpm) una ventana de ±240 ms alcanzaría a la nota siguiente y un solo
   * toque podría contar dos veces. El tope es 42% del pulso.
   */
  function ventanasDeRitmo(beatMs) {
    const max = Math.min(RITMO_VENTANA, Math.max(60, num(beatMs, 625) * 0.42));
    const k = max / RITMO_VENTANA;
    return RITMO_JUICIOS.map((j) => ({ id: j.id, ms: j.ms * k, calidad: j.calidad, texto: j.texto }));
  }

  /**
   * Carril de un paso: el lado que el avatar levanta. Si los dos hombros van
   * casi igual (vuelta, palmas arriba) la nota es ancha y vale cualquiera de
   * los dos botones.
   */
  function carrilDePaso(pose) {
    const i = num(pose && pose.hombroI, 0), d = num(pose && pose.hombroD, 0);
    if (Math.abs(i - d) < 25) return 'ambos';
    return i > d ? 'izq' : 'der';
  }

  /** Cuánto se espera antes del primer pulso: la cuenta regresiva son las notas cayendo. */
  const entradaDeRitmo = (beatMs) => Math.max(2600, num(beatMs, 625) * 4);

  /**
   * Convierte la coreografía en una lista de notas con su instante absoluto.
   * Una nota por pulso; el paso manda el carril y el nombre.
   */
  function notasDeCoreografia(choreo, vueltas, opts) {
    const steps = (choreo && choreo.steps) || [];
    const beatMs = 60000 / Math.max(40, num(choreo && choreo.bpm, 96));
    const entrada = entradaDeRitmo(beatMs);
    if (!steps.length) return { notas: [], beatMs, entrada, finMs: entrada, ventanas: ventanasDeRitmo(beatMs) };
    const unCarril = !!(opts && opts.unCarril);
    const vlt = clamp(Math.round(num(vueltas, 2)), 1, 12);
    const notas = [];
    let t = entrada;
    for (let v = 0; v < vlt; v++) {
      for (let i = 0; i < steps.length; i++) {
        const beats = clamp(Math.round(num(steps[i].beats, 2)), 1, 16);
        const carril = unCarril ? 'ambos' : carrilDePaso(steps[i].pose);
        for (let b = 0; b < beats; b++) {
          notas.push({
            id: 'n' + notas.length, t: t + b * beatMs, carril: carril,
            paso: i, vuelta: v, nombre: s(steps[i].name), fuerte: b === 0,
          });
        }
        t += beats * beatMs;
      }
    }
    return { notas, beatMs, entrada, finMs: t, ventanas: ventanasDeRitmo(beatMs) };
  }

  /**
   * El juez. Recibe golpes con su instante y va cerrando las notas que pasan.
   *
   * `latenciaMs` descuenta el retardo del panel táctil del tótem: es un ajuste
   * del montaje, no del jugador, y por eso vive en la configuración del juego
   * y no se adivina solo. El resumen devuelve el sesgo medido para que el
   * operador sepa qué número poner.
   */
  function juezRitmico(pista, opts) {
    const o = opts || {};
    const latencia = clamp(num(o.latenciaMs, 0), -300, 300);
    const ventanas = pista.ventanas || ventanasDeRitmo(pista.beatMs);
    const vmax = ventanas[ventanas.length - 1].ms;
    const notas = (pista.notas || []).map((n) => Object.assign({}, n, { estado: 'espera', desfase: null, calidad: 0, juicio: '' }));
    let cursor = 0, alAire = 0;

    const juicioDe = (d) => {
      for (const v of ventanas) if (d <= v.ms) return v;
      return null;
    };

    return {
      notas: () => notas,
      finMs: pista.finMs,
      vmax: vmax,
      /** Cierra como perdidas las notas cuya ventana ya venció. */
      avanzar(tMs) {
        const cerradas = [];
        while (cursor < notas.length) {
          const n = notas[cursor];
          if (n.estado !== 'espera') { cursor++; continue; }
          if (tMs - n.t > vmax) { n.estado = 'perdida'; cerradas.push(n); cursor++; continue; }
          break;
        }
        return cerradas;
      },
      /**
       * Un toque. `carril` es 'izq' o 'der'. Devuelve el juicio para el HUD.
       * Tocar el lado equivocado NO acierta: la nota sigue viva hasta que
       * vence, igual que si no se hubiera tocado. Se distingue solo para poder
       * decírselo al jugador.
       */
      golpear(carril, tMs) {
        const t = num(tMs, 0) - latencia;
        let mejor = null, mejorD = Infinity, otroLado = false;
        for (let i = cursor; i < notas.length; i++) {
          const n = notas[i];
          if (n.t - t > vmax) break;
          if (n.estado !== 'espera') continue;
          const d = Math.abs(n.t - t);
          if (d > vmax) continue;
          if (!(n.carril === 'ambos' || n.carril === carril)) { otroLado = true; continue; }
          if (d < mejorD) { mejor = n; mejorD = d; }
        }
        if (!mejor) {
          alAire++;
          return otroLado
            ? { juicio: 'ladomalo', texto: '¡El otro lado!', nota: null }
            : { juicio: 'aire', texto: 'Fuera de tiempo', nota: null };
        }
        const v = juicioDe(mejorD);
        mejor.estado = 'acertada';
        mejor.juicio = v.id;
        mejor.calidad = v.calidad;
        mejor.desfase = Math.round(t - mejor.t);   // + = tarde, − = temprano
        return { juicio: v.id, texto: v.texto, nota: mejor, desfase: mejor.desfase };
      },
      /**
       * Puntaje con la MISMA forma que el de cámara: dos componentes y el
       * mismo peso configurable. «pasos» ocupa el lugar de la postura (¿hizo
       * el movimiento que tocaba?) y «ritmo» el suyo (¿llegó a tiempo?).
       */
      resumen() {
        const total = notas.length;
        const buenas = notas.filter((n) => n.estado === 'acertada');
        const porJuicio = { perfecto: 0, bien: 0, casi: 0 };
        for (const n of buenas) if (porJuicio[n.juicio] != null) porJuicio[n.juicio]++;
        return {
          total,
          aciertos: buenas.length,
          perdidas: total - buenas.length,
          alAire,
          porJuicio,
          pasos: total ? buenas.length / total : 0,
          ritmo: buenas.length ? buenas.reduce((a, n) => a + n.calidad, 0) / buenas.length : 0,
          // Sesgo del jugador contra el pulso. Si sale grande y del mismo
          // signo en varias partidas, el que llega tarde es el panel táctil.
          sesgo: buenas.length >= 6 ? mediana(buenas.map((n) => n.desfase)) : null,
          latencia,
        };
      },
    };
  }

  /**
   * Clic de compás. Sin archivos ni dependencias: un oscilador corto por nota.
   * Si el navegador no da audio, el juego se ve igual y se juega igual.
   */
  function compasSonoro() {
    let ctx = null;
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch (e) { ctx = null; }
    return {
      activo: () => !!ctx,
      clic(fuerte) {
        if (!ctx) return;
        try {
          if (ctx.state === 'suspended') ctx.resume();
          const t = ctx.currentTime;
          const osc = ctx.createOscillator(), gan = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = fuerte ? 1320 : 880;
          gan.gain.setValueAtTime(fuerte ? 0.13 : 0.07, t);
          gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
          osc.connect(gan); gan.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.07);
        } catch (e) { /* un clic no puede tumbar una partida */ }
      },
      cerrar() { try { ctx && ctx.close(); } catch (e) { /* noop */ } ctx = null; },
    };
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
        '≈ ' + props.metros + ' m' + (model.espacio && model.espacio.mostrarGuia !== false
          ? '  ·  zona de ' + num(model.espacio.ancho, 220) + '×' + num(model.espacio.profundidad, 250) + ' cm' : '')),
      props.nota ? h('text', { x: 270, y: 300, textAnchor: 'middle', fill: 'rgba(255,255,255,.7)', fontSize: 12 }, props.nota) : null);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 10. Juego 2 — "Prueba de baile" (cámara + pose)
  // ══════════════════════════════════════════════════════════════════════

  // Escala de la pista: 0.16 px por milisegundo. En una pista de 400 px con la
  // línea a 58 px del borde inferior son ~2,1 s de anticipación, que es lo que
  // alcanza a leer alguien que llega al tótem y juega de una. La entrada
  // (`entradaDeRitmo`) es mayor que eso para que la primera nota se vea nacer.
  const RITMO_PX_MS = 0.16;

  /**
   * La pista rítmica: el modo sin cámara de Prueba de baile.
   *
   * Vive aparte del componente de cámara a propósito. Son dos máquinas de
   * estados distintas, y meterlas en la misma pondría en riesgo la entrada que
   * ya funciona cada vez que se toque la otra.
   *
   * Las notas NO se re-renderizan cada cuadro: se colocan una sola vez en una
   * tira, y lo que se mueve por cuadro es un `translateY` sobre esa tira. React
   * solo vuelve a pintar cuando una nota cambia de estado, y el juicio se hace
   * con la hora del evento de toque, no con la del render: la precisión no
   * depende de a cuántos cuadros vaya la pantalla.
   */
  function BaileRitmico(props) {
    const cfg = props.cfg || {};
    const choreo = props.choreo;
    const unCarril = cfg.ritmoUnCarril === true;

    const pista = useMemo(
      () => notasDeCoreografia(choreo, cfg.vueltas, { unCarril }),
      [choreo, cfg.vueltas, unCarril]);

    const juezRef = useRef(null);
    const tiraRef = useRef(null);
    const t0Ref = useRef(0);
    const sonRef = useRef(null);
    const comboRef = useRef({ actual: 0, mejor: 0 });
    const proxClicRef = useRef(0);

    const [fase, setFase] = useState('jugando');
    // Solo se necesita el disparador: las notas se leen del juez, no del estado.
    const [, repintar] = useState(0);
    const [hud, setHud] = useState({ paso: '', tip: '', progreso: 0, cuenta: 0, aciertos: 0, combo: 0, pose: null });
    const [juicio, setJuicio] = useState({ texto: '', tipo: '', at: 0 });
    const [final, setFinal] = useState(null);

    const arrancar = useCallback(() => {
      juezRef.current = juezRitmico(pista, { latenciaMs: cfg.ritmoLatenciaMs });
      comboRef.current = { actual: 0, mejor: 0 };
      proxClicRef.current = 0;
      t0Ref.current = nowMs();
      setFinal(null);
      setJuicio({ texto: '', tipo: '', at: 0 });
      repintar((v) => v + 1);
      setFase('jugando');
    }, [pista, cfg.ritmoLatenciaMs]);

    useEffect(() => { arrancar(); }, [arrancar]);

    // El audio se abre una vez, ya con el gesto del jugador hecho (llegar acá
    // fue apretar un botón), y se cierra al salir del juego.
    useEffect(() => {
      if (cfg.ritmoSonido === false) return undefined;
      sonRef.current = compasSonoro();
      return () => { const c = sonRef.current; sonRef.current = null; if (c) c.cerrar(); };
    }, [cfg.ritmoSonido]);

    /** Un toque. La hora es la del evento: es lo único que se juzga. */
    const golpear = useCallback((carril) => {
      const j = juezRef.current;
      if (!j || fase !== 'jugando') return;
      const t = nowMs() - t0Ref.current;
      const r = j.golpear(unCarril ? 'izq' : carril, t);
      const C = comboRef.current;
      if (r.nota) {
        C.actual++;
        if (C.actual > C.mejor) C.mejor = C.actual;
        if (r.juicio === 'perfecto' && navigator.vibrate) { try { navigator.vibrate(18); } catch (e) { /* noop */ } }
      } else {
        C.actual = 0;
      }
      setJuicio({ texto: r.texto, tipo: r.juicio, at: nowMs() });
      repintar((v) => v + 1);
    }, [fase, unCarril]);

    useEffect(() => {
      if (fase !== 'jugando') return undefined;
      const onTecla = (e) => {
        if (e.repeat) return;
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'f' || k === 'F') { e.preventDefault(); golpear('izq'); }
        else if (k === 'ArrowRight' || k === 'l' || k === 'L' || k === 'j' || k === 'J') { e.preventDefault(); golpear('der'); }
        else if (unCarril && (k === ' ' || k === 'Enter')) { e.preventDefault(); golpear('izq'); }
      };
      window.addEventListener('keydown', onTecla);
      return () => window.removeEventListener('keydown', onTecla);
    }, [fase, golpear, unCarril]);

    // Bucle: mueve la tira, suena el compás, cierra las notas que pasan.
    useEffect(() => {
      if (fase !== 'jugando') return undefined;
      let ultimoHud = 0;
      return loop(() => {
        const j = juezRef.current;
        if (!j) return;
        const t = nowMs() - t0Ref.current;

        // La nota está a `(n.t − t) · px` POR ENCIMA de la línea: se coloca en
        // −n.t·px y la tira baja con el reloj. Así caen hacia la línea, que es
        // como se lee una pista de ritmo en cualquier parte.
        if (tiraRef.current) tiraRef.current.style.transform = 'translateY(' + (t * RITMO_PX_MS).toFixed(1) + 'px)';

        const cerradas = j.avanzar(t);
        if (cerradas.length) { comboRef.current.actual = 0; repintar((v) => v + 1); }

        // Clic de compás: adelantado al pulso lo justo para que suene EN el
        // pulso y no después de él.
        const son = sonRef.current;
        if (son) {
          const notas = j.notas();
          while (proxClicRef.current < notas.length && notas[proxClicRef.current].t - 12 <= t) {
            son.clic(notas[proxClicRef.current].fuerte);
            proxClicRef.current++;
          }
        }

        if (nowMs() - ultimoHud > 90) {
          ultimoHud = nowMs();
          const obj = poseObjetivo(choreo, Math.max(0, t - pista.entrada));
          const r = j.resumen();
          setHud({
            paso: obj ? obj.paso.name : choreo.name,
            tip: obj ? obj.paso.tip : (choreo.musicHint || ''),
            progreso: clamp(t / Math.max(1, pista.finMs), 0, 1),
            cuenta: t < pista.entrada ? Math.ceil((pista.entrada - t) / 1000) : 0,
            aciertos: r.aciertos, combo: comboRef.current.actual,
            pose: obj ? obj.pose : null,
          });
        }

        if (t >= pista.finMs + j.vmax + 200) {
          const r = j.resumen();
          const pR = clamp(num(cfg.pesoRitmo, 0.3), 0, 0.8);
          setFinal(Object.assign({}, r, {
            p10: clamp((r.pasos * (1 - pR) + r.ritmo * pR) * 10, 0, 10),
            combo: comboRef.current.mejor,
          }));
          setFase('fin');
        }
      });
    }, [fase, pista, choreo, cfg.pesoRitmo]);

    // ── Resultado ─────────────────────────────────────────────────────
    if (fase === 'fin' && final) {
      const pct = (v) => Math.round(v * 100) + '%';
      const tips = [];
      if (final.pasos > 0.9) tips.push('¡No se te escapó casi ninguna!');
      else if (final.pasos < 0.5) tips.push('Toca el lado que levanta el avatar: la nota ancha vale con cualquiera.');
      if (final.ritmo > 0.85) tips.push('Y llegaste clavado al compás.');
      else if (final.aciertos) tips.push('Apunta al momento en que la nota cruza la línea.');
      if (final.combo >= 8) tips.push('Mejor racha: ' + final.combo + ' seguidas.');
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h(Resultado, {
          puntaje10: final.p10,
          juego: props.game.name,
          titulo: '¡Se bailó con las manos!',
          mensaje: tips.join(' '),
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, null, 'Notas ' + final.aciertos + '/' + final.total),
            h(Chip, null, 'Pasos ' + pct(final.pasos)),
            h(Chip, { tone: 'accent' }, 'Ritmo ' + pct(final.ritmo)),
            h(Chip, null, 'Racha ' + final.combo)),
          // Lo que queda escrito en el ranking dice CUÁL prueba fue. No es la
          // misma que con cámara y el CSV no puede insinuar que sí.
          detalleTexto: 'Modo rítmico táctil · ' + choreo.name + ' · ' + final.aciertos + '/' + final.total +
            ' notas · ritmo ' + pct(final.ritmo),
          onExit: props.onExit,
          onReplay: arrancar,
        }),
        // El sesgo se muestra al operador, no al jugador: si todo el mundo
        // llega tarde lo mismo, el que llega tarde es el panel.
        final.sesgo != null && Math.abs(final.sesgo) >= 45
          ? h('p', { className: 'fp-hint' },
              'Ajuste del montaje: los toques llegaron ' + Math.abs(final.sesgo) + ' ms ' +
              (final.sesgo > 0 ? 'tarde' : 'temprano') + ' de media. Si se repite con varios jugadores, ' +
              'es el retardo del panel: ponlo en «Ajuste de latencia» en el editor.')
          : null);
    }

    // ── Pista ─────────────────────────────────────────────────────────
    const escB = escenaDe(themeOf(model));
    const objetivo = hud.pose || (choreo.steps[0] && choreo.steps[0].pose);
    const notas = juezRef.current ? juezRef.current.notas() : [];
    const carriles = unCarril ? ['izq'] : ['izq', 'der'];
    const etiqueta = { izq: unCarril ? '👏 TOCA' : '👈 IZQUIERDA', der: 'DERECHA 👉' };

    const notaEl = (n) => h('i', {
      key: n.id,
      className: 'fp-nota is-' + n.carril + (n.estado === 'espera' ? '' : ' is-' + n.estado) + (n.fuerte ? ' is-fuerte' : ''),
      style: { top: (-n.t * RITMO_PX_MS).toFixed(1) + 'px' },
    });

    return h(Marco, {
      icon: props.game.icon, title: props.game.name, onExit: props.onExit,
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, null, '👆 Sin cámara'),
        hud.combo > 2 ? h(Chip, { tone: 'accent' }, 'Racha ' + hud.combo) : null),
    },
      h('div', { className: 'fp-dance is-ritmo' },
        h('div', { className: 'fp-dance-avatar' },
          h('svg', { viewBox: '0 0 340 420', className: 'fp-avatar-svg' },
            h(LienzoDC, { gid: 'fp-ritmo-vb', w: 340, h: 420 },
              h(CieloDC, { w: 340, h: 420, horizonte: 250, gid: 'fp-ritmo', alto: escB.cielo, bajo: escB.cieloBajo, sol: false }),
              h('path', { d: 'M170 0 L300 250 L40 250 Z', fill: '#FFF3C4', opacity: 0.14 }),
              h(SueloDC, { w: 340, h: 420, horizonte: 250, color: '#8A5C2A', fugaX: 170, filas: 6, lineas: 9, bruma: 'rgba(255,230,190,.35)' }),
              h(SombraDC, { cx: 170, cy: 322, rx: 92, ry: 20 }),
              h(Avatar, { transform: 'translate(170,178) scale(0.86)', pose: objetivo }))),
          h('div', { className: 'fp-dance-step' },
            h('b', null, hud.paso || choreo.name),
            h('span', null, hud.tip || choreo.musicHint || '')),
          h('div', { className: 'fp-progress' }, h('i', { style: { width: (hud.progreso * 100).toFixed(1) + '%' } }))),

        h('div', { className: 'fp-ritmo' },
          h('div', { className: 'fp-pista' + (unCarril ? ' is-uno' : '') },
            carriles.map((c) => h('div', {
              key: c, className: 'fp-pista-carril is-' + c,
              onPointerDown: (e) => { e.preventDefault(); golpear(c); },
            })),
            h('div', { className: 'fp-pista-linea' }),
            // Sin `key` a propósito: este nodo tiene que sobrevivir a todos los
            // repintados, porque su `transform` lo escribe el bucle a mano y
            // remontarlo lo dejaría un cuadro en el sitio equivocado.
            h('div', { className: 'fp-pista-tira', ref: tiraRef }, notas.map(notaEl)),
            hud.cuenta > 0 ? h('div', { className: 'fp-count' }, hud.cuenta) : null,
            juicio.texto && nowMs() - juicio.at < 700
              ? h('div', { className: 'fp-ritmo-juicio is-' + juicio.tipo }, juicio.texto) : null),
          h('div', { className: 'fp-ritmo-botones' + (unCarril ? ' is-uno' : '') },
            carriles.map((c) => h('button', {
              key: c, type: 'button', className: 'fp-ritmo-btn is-' + c,
              onPointerDown: (e) => { e.preventDefault(); golpear(c); },
            }, etiqueta[c]))),
          h('p', { className: 'fp-hint' },
            unCarril
              ? 'Toca el botón —o la barra espaciadora— cuando la nota cruce la línea.'
              : 'Toca el lado que levanta el avatar cuando la nota cruce la línea. ' +
                'Las notas anchas valen con cualquiera de los dos. También sirven las flechas ← → del teclado.'))));
  }

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
    // El modo rítmico es otra pantalla entera, con su propio bucle: acá solo
    // se elige, para no mezclar dos máquinas de estados en una.
    const [ritmico, setRitmico] = useState(false);
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
      olvidarMotor();
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
        const prov = await arrancarPose(hw, videoRef, streamRef);
        provRef.current = prov;
        setMotor(prov.nombre);
        irA(cfg.exigirCalibracion === false ? 'cuenta' : 'calibrando');
        t0Ref.current = nowMs();
      } catch (e) {
        soltarTodo();
        setError(mensajeCamara(e));
        irA('intro');
        notify('warn', 'No se pudo iniciar la cámara: ' + mensajeCamara(e));
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
      h(CamaraVista, { attach: attachVideo, espejo: espejo, landmarks: vista.landmarks, espacio: model.espacio, margen: 0.18, imagenKinect: imagenDe(provRef) },
        cfg.mostrarEsqueleto !== false && vista.landmarks
          ? h(Esqueleto, { landmarks: vista.landmarks, espejo: espejo }) : null),
      fase === 'calibrando' ? h(Silueta, { ok: hud.ok }) : null,
      hw.avisoCamara !== false && streamRef.current
        ? h(AvisoCamara, null) : null);

    // Modo rítmico: pantalla aparte, sin cámara y sin nada que soltar.
    if (ritmico) {
      return h(BaileRitmico, {
        game: props.game, cfg: cfg, choreo: choreo,
        onExit: () => { setRitmico(false); props.onExit(); },
      });
    }

    if (fase === 'intro') {
      const conRitmo = cfg.modoRitmico !== false;
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
            conRitmo ? h(Boton, { onClick: () => { setError(''); setRitmico(true); } }, '👏 Jugar por toque (modo rítmico)') : null,
            h(Boton, { variant: 'ghost', onClick: () => iniciar('demo') }, '🕹️ Ver el maniquí')),
          // El botón del maniquí no es una forma de jugar y la app no lo puede
          // insinuar: el que quiera jugar sin cámara tiene el modo rítmico.
          conRitmo ? h('p', { className: 'fp-hint' },
            '👏 El modo rítmico se juega sin cámara: la misma coreografía, marcando el compás con el dedo ' +
            'o con las flechas del teclado. El maniquí, en cambio, baila solo: sirve para mirar los pasos, no para competir.') : null,
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
    const escB = escenaDe(themeOf(model));
    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        motor ? h(Chip, null, motor) : null,
        fase === 'bailando' ? h(Chip, { tone: 'accent' }, 'Parecido ' + hud.score + '%') : null),
    },
      h('div', { className: 'fp-dance' },
        h('div', { className: 'fp-dance-avatar' },
          // El avatar a imitar baila en un escenario, no sobre un rectángulo
          // gris: tablas iluminadas y foco, como una fonda de verdad.
          h('svg', { viewBox: '0 0 340 420', className: 'fp-avatar-svg' },
            h(LienzoDC, { gid: 'fp-baile-vb', w: 340, h: 420 },
              h(CieloDC, { w: 340, h: 420, horizonte: 250, gid: 'fp-baile', alto: escB.cielo, bajo: escB.cieloBajo, sol: false }),
              h('path', { d: 'M170 0 L300 250 L40 250 Z', fill: '#FFF3C4', opacity: 0.14 }),
              h(SueloDC, { w: 340, h: 420, horizonte: 250, color: '#8A5C2A', fugaX: 170, filas: 6, lineas: 9, bruma: 'rgba(255,230,190,.35)' }),
              h(SombraDC, { cx: 170, cy: 322, rx: 92, ry: 20 }),
              h(Avatar, { transform: 'translate(170,178) scale(0.86)', pose: objetivo }))),
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
  // 12. Juego 4 — "LaserGun" (tiro al blanco con puntero absoluto)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Entrada: cualquier dispositivo que se comporte como puntero absoluto
  // (lightgun IR tipo Gun4IR / Blamcon / AimTrak / Sinden, o el dedo). Cada
  // `pointerdown` es un disparo. Disparar fuera de pantalla (barra inferior)
  // recarga, igual que en los arcades.

  const LASER_VB = { w: 1000, h: 1400 };
  // Suman: empanadas, choripanes y volantines. Restan: ajíes rojos y schops.
  // Puntos y tamaño son REGLA del juego y no los toca ningún pack; el nombre
  // sí, porque en Navidad un volantín es una estrella y el juego es el mismo.
  const BLANCOS = {
    volantin: { puntos: 10, r: 46, nombre: 'Volantín' },
    empanada: { puntos: 20, r: 40, nombre: 'Empanada' },
    choripan: { puntos: 15, r: 42, nombre: 'Choripán' },
    aji: { puntos: -1, r: 34, nombre: 'Ají rojo' },      // -1 = usa la penalización configurada
    schop: { puntos: -1, r: 38, nombre: 'Schop' },
  };
  /** Cómo se llama un blanco con el pack puesto. */
  const nombreBlanco = (clave) => s((model.blancos || {})[clave]) || (BLANCOS[clave] || {}).nombre || clave;
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

  /**
   * Puntería con la mano: convierte el brazo en la pistola.
   *
   * La mira es la PUNTA de la mano (landmark 19/20), no la muñeca: es el punto
   * que la persona siente que apunta, y el Kinect lo entrega como articulación
   * propia. El brazo no alcanza toda la pantalla, así que se mapea una "caja
   * de puntería" centrada en los hombros y medida en anchos de hombro: el
   * mismo gesto apunta igual siendo niño o adulto, cerca o lejos.
   *
   * El disparo tiene dos formas, y cuál se usa depende de lo que el sensor
   * pueda decir de verdad:
   *   · Con Kinect hay ESTADO DE MANO, así que se dispara cerrando el puño,
   *     que es el gesto natural del gatillo.
   *   · Con webcam no existe ese dato: se dispara sosteniendo la mira quieta
   *     sobre el blanco (dwell), que además es lo accesible.
   */
  function detectorPunteria(opts) {
    const o = opts || {};
    // Medidas de la caja, en anchos de hombro. Salen de lo que el brazo
    // alcanza de verdad: la envergadura ronda la estatura, así que una mano
    // estirada al costado queda a unos 2,2 anchos de hombro del centro, y
    // verticalmente se llega desde sobre la cabeza hasta la cadera. Con una
    // caja más chica la mira se clava en el borde antes de estirar el brazo.
    const ampX = num(o.amplitudX, 2.2);      // medio ancho de la caja
    const ampY = num(o.amplitudY, 1.4);      // media altura
    const alza = num(o.alza, -0.2);          // el centro cae un poco BAJO los hombros
    const dwellMs = num(o.dwellMs, 620);     // cuánto hay que sostener sin sensor de mano
    const quietud = num(o.quietud, 0.035);   // cuánto puede temblar y seguir contando
    const cadencia = num(o.cadenciaMs, 230); // tiempo mínimo entre dos tiros
    // `tUltimo` en null es "todavía no se disparó": con 0 el reloj recién
    // arrancado del navegador ya parecería estar en la espera entre tiros.
    let mano = null, cerradaAntes = false, tUltimo = null;
    let sx = null, sy = null, ancla = null, tQuieto = 0, rearmar = false;
    const listo = (t) => tUltimo == null || t - tUltimo > cadencia;
    return {
      reset() {
        mano = null; cerradaAntes = false; tUltimo = null;
        sx = sy = null; ancla = null; tQuieto = 0; rearmar = false;
      },
      /** `{ visible, x, y, disparo, mano, gesto, carga }` con x,y en 0..1. */
      actualizar(L, espejo, k, dt) {
        const vacio = { visible: false, x: 0.5, y: 0.5, disparo: false, mano: null, gesto: 'sin lectura', carga: 0 };
        if (!L) return vacio;
        const esc = escalaCorporal(L, 'superior');
        const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
        if (!esc || !hI || !hD) return vacio;
        const ver = (p) => p && (p.visibility == null || p.visibility > 0.4);

        // ── Qué mano apunta ───────────────────────────────────────────
        // La más alta, con histéresis: sin ella la mira salta de una mano a
        // la otra cada vez que quedan parejas, y apuntar se vuelve imposible.
        const cand = [];
        const punta = (tip, muneca) => (ver(L[tip]) ? L[tip] : ver(L[muneca]) ? L[muneca] : null);
        const pI = punta(19, IDX.munecaI), pD = punta(20, IDX.munecaD);
        if (pI) cand.push({ lado: 'I', p: pI });
        if (pD) cand.push({ lado: 'D', p: pD });
        if (!cand.length) return vacio;
        const actual = cand.find((c) => c.lado === mano);
        let elegida = cand.reduce((a, b) => (b.p.y < a.p.y ? b : a));
        if (actual && elegida.lado !== mano && actual.p.y - elegida.p.y < 0.06) elegida = actual;
        mano = elegida.lado;

        // ── De la caja de puntería a la pantalla ──────────────────────
        const cxH = (hI.x + hD.x) / 2, cyH = (hI.y + hD.y) / 2;
        const nx = ((elegida.p.x - cxH) / (esc * ampX)) * (espejo ? -1 : 1);
        const ny = (elegida.p.y - (cyH - esc * alza)) / (esc * ampY);
        const bx = clamp((nx + 1) / 2, 0, 1), by = clamp((ny + 1) / 2, 0, 1);
        const a = clamp(num(dt, 1 / 60) * 14, 0, 1);
        sx = sx == null ? bx : sx + (bx - sx) * a;
        sy = sy == null ? by : sy + (by - sy) * a;

        // ── Gatillo ───────────────────────────────────────────────────
        const t = nowMs();
        const est = k && (mano === 'I' ? k.manoI : k.manoD);
        const conf = k ? (mano === 'I' ? k.confianzaManoI : k.confianzaManoD) : 0;
        const hayEstado = !!est && est !== 'desconocida' && est !== 'noSeguida' && conf >= 0.5;
        let disparo = false, carga = 0, gesto = '';
        if (hayEstado) {
          const cerrada = est === 'cerrada';
          if (cerrada && !cerradaAntes && listo(t)) { disparo = true; tUltimo = t; }
          cerradaAntes = cerrada;
          gesto = cerrada ? 'disparando' : 'apunta y cierra el puño';
          ancla = null; tQuieto = 0;
        } else {
          // Sin estado de mano: sostener la mira quieta sobre el blanco.
          cerradaAntes = false;
          if (!ancla || Math.hypot(sx - ancla.x, sy - ancla.y) > quietud) {
            ancla = { x: sx, y: sy }; tQuieto = 0;
            if (rearmar) rearmar = false;
          } else if (!rearmar) {
            tQuieto += num(dt, 1 / 60) * 1000;
          }
          carga = rearmar ? 0 : clamp(tQuieto / dwellMs, 0, 1);
          if (carga >= 1 && listo(t)) {
            disparo = true; tUltimo = t; tQuieto = 0; carga = 0; rearmar = true;
          }
          gesto = rearmar ? 'mueve la mano para volver a cargar' : 'sostén la mira sobre el blanco';
        }
        return { visible: true, x: sx, y: sy, disparo, mano, gesto, carga };
      },
    };
  }

  function JuegoLaser(props) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
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
    // Puntería con la mano: el brazo hace de pistola (ver `detectorPunteria`).
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const punRef = useRef(detectorPunteria());
    const [conMano, setConMano] = useState(false);
    const [manoHud, setManoHud] = useState(null);
    const [avisoMano, setAvisoMano] = useState('');

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

    /** Un disparo en coordenadas del viewBox, venga del dedo o de la mano. */
    const tirarEn = (p) => {
      if (fase !== 'jugando') return;
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
        notify('warn', nombreBlanco(mejor.kind) + ': −' + Math.abs(num(cfg.penalizacion, 5)) + ' puntos');
      } else {
        const c = combo + 1;
        setCombo(c);
        setPuntos((v) => v + base + Math.min(20, (c - 1) * 2));
      }
      if (navigator.vibrate) { try { navigator.vibrate(20); } catch (err) { /* noop */ } }
    };

    const disparar = (e) => {
      if (fase !== 'jugando' || !svgRef.current) return;
      tirarEn(svgPoint(svgRef.current, e, LASER_VB));
    };

    // ── Puntería con la mano ────────────────────────────────────────────
    const montarVideo = useCallback((el) => {
      videoRef.current = el;
      if (el && streamRef.current && el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
      }
      if (provRef.current && provRef.current.setVideo) provRef.current.setVideo(el);
    }, []);
    const soltarMano = useCallback(() => {
      try { provRef.current && provRef.current.detener(); } catch (e) { /* noop */ }
      provRef.current = null;
      olvidarMotor();
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
      setManoHud(null);
    }, []);
    useEffect(() => soltarMano, [soltarMano]);

    const alternarMano = useCallback(async () => {
      if (conMano) { setConMano(false); setAvisoMano(''); soltarMano(); return; }
      setAvisoMano('Abriendo el sensor…');
      try {
        punRef.current.reset();
        provRef.current = await arrancarPose(hw, videoRef, streamRef);
        setConMano(true); setAvisoMano('');
      } catch (e) {
        soltarMano();
        setAvisoMano(mensajeCamara(e));
      }
    }, [conMano, soltarMano]);

    // El brazo estirado del todo llega justo al borde, y ahí la mira quedaría
    // cortada por el marco. Se mapea a un rectángulo con un margen del ancho
    // de la mira, y ese mismo punto es el que dispara: si se dibujara en un
    // lado y se disparara en otro, el jugador no entendería por qué falla.
    const MARGEN = 56;
    const aPantalla = (r) => ({
      x: MARGEN + r.x * (LASER_VB.w - MARGEN * 2),
      y: MARGEN + r.y * (LASER_VB.h - MARGEN * 2),
    });

    // El componente se redibuja en cada cuadro, así que el disparo va por
    // referencia: si entrara en las dependencias, el bucle se reiniciaría
    // sesenta veces por segundo y el detector perdería su estado.
    const tirarRef = useRef(tirarEn);
    tirarRef.current = tirarEn;

    useEffect(() => {
      if (!conMano || fase !== 'jugando') return undefined;
      const espejo = hw.espejo !== false;
      let ultimoHud = 0;
      return loop((dt) => {
        const prov = provRef.current;
        const lec = prov ? prov.leer() : null;
        const r = punRef.current.actualizar(lec && lec.landmarks, espejo, lec && lec.kinect, dt);
        if (r.disparo) tirarRef.current(aPantalla(r));
        const t = nowMs();
        if (t - ultimoHud > 45) {
          ultimoHud = t;
          setManoHud(r.visible ? r : null);
          setAvisoMano(r.visible ? r.gesto : (avisoDeEncuadre(lec && lec.confianza, 'brazos') || 'No te veo: ponte frente al tótem'));
        }
      });
    }, [conMano, fase, hw.espejo]);

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
    const temaL = themeOf(model);
    const escL = escenaDe(temaL), fLa = facetas(temaL.accent);
    return h(Marco, {
      icon: props.game.icon, title: props.game.name, onExit: props.onExit,
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, { tone: 'accent' }, puntos + ' pts'),
        h(Chip, null, '⏱ ' + tiempo + 's'),
        h(Chip, null, cfg.recargaAuto ? '∞ munición' : '🔴'.repeat(Math.max(0, municion)) || 'Recarga abajo'),
        combo > 1 ? h(Chip, { tone: 'ok' }, 'combo x' + combo) : null,
        h(Boton, {
          className: 'fp-btn--mini', variant: conMano ? 'primary' : 'ghost', onClick: alternarMano,
          title: 'Apuntar moviendo el brazo, leído por el sensor',
        }, conMano ? '🖐 Mano activa' : '🖐 Apuntar con la mano')),
    },
      h('div', { className: 'fp-laser-wrap' },
        // El <video> vive siempre montado, aunque no se vea: MediaPipe no
        // puede engancharse a un elemento que aún no existe. Y se queda
        // oculto SIEMPRE: acá la mira ya dice dónde está la mano, y con
        // Kinect el elemento ni siquiera recibe imagen (sería un rectángulo
        // negro tapando el juego).
        h('video', {
          ref: montarVideo, className: 'fp-ray-cam is-hidden',
          autoPlay: true, muted: true, playsInline: true,
        }),
        h('svg', {
          ref: svgRef, className: 'fp-laser-svg', viewBox: '0 0 1000 1400',
          onPointerDown: disparar,
          onPointerMove: (e) => {
            if (e.pointerType === 'mouse' && svgRef.current) setMira(svgPoint(svgRef.current, e, LASER_VB));
          },
          onPointerLeave: () => setMira(null),
        },
          h(LienzoDC, { gid: 'fp-laser-vb', w: 1000, h: 1400 },
          // Cerro y cancha al atardecer: los blancos vuelan contra el cielo.
          h(EscenaDC, {
            w: 1000, h: 1400, horizonte: 900, gid: 'fp-laser', escena: escL,
            solX: 830, altoCerros: 220, filas: 8, lineas: 13,
            nubes: [{ x: 240, y: 210, r: 36 }, { x: 760, y: 330, r: 27 }],
          }),
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
          // Barra de recarga: panel de máquina, con bisel y luz superior.
          h('g', null,
            h('rect', { x: 0, y: LASER_VB.h - 150, width: 1000, height: 150, fill: '#0C1424' }),
            h('rect', { x: 0, y: LASER_VB.h - 150, width: 1000, height: 7, fill: fLa.luz }),
            h('rect', { x: 0, y: LASER_VB.h - 143, width: 1000, height: 4, fill: 'rgba(255,255,255,.3)' }),
            h('text', { x: 500, y: LASER_VB.h - 84, textAnchor: 'middle', className: 'fp-svg-label' },
              cfg.recargaAuto ? 'MUNICIÓN INFINITA' : 'DISPARA AQUÍ PARA RECARGAR'),
            h('text', { x: 500, y: LASER_VB.h - 40, textAnchor: 'middle', className: 'fp-svg-sub' },
              'Empanada +20 · Choripán +15 · Volantín +10 · Ají y schop −' + Math.abs(num(cfg.penalizacion, 5)))),
          // mira de la pistola
          mira && !conMano ? h('g', { transform: 'translate(' + mira.x + ',' + mira.y + ')', opacity: 0.9 },
            h('circle', { r: 34, fill: 'none', stroke: '#fff', strokeWidth: 3 }),
            h('path', { d: 'M-52 0 L-22 0 M22 0 L52 0 M0 -52 L0 -22 M0 22 L0 52', stroke: '#fff', strokeWidth: 3 }),
            h('circle', { r: 4, fill: '#D52B1E' })) : null,
          // Mira de la mano. El anillo se cierra mientras se sostiene el
          // apunte: sin sensor de puño, es la única señal de que el disparo
          // viene, y sin ella el dwell se siente roto.
          conMano && manoHud
            ? h('g', { transform: 'translate(' + aPantalla(manoHud).x.toFixed(1) + ',' + aPantalla(manoHud).y.toFixed(1) + ')' },
                h('circle', { r: 44, fill: 'none', stroke: 'rgba(0,0,0,.45)', strokeWidth: 9 }),
                h('circle', { r: 44, fill: 'none', stroke: fLa.luz, strokeWidth: 5 }),
                manoHud.carga > 0
                  ? h('circle', {
                      r: 44, fill: 'none', stroke: '#FFE066', strokeWidth: 9,
                      strokeLinecap: 'round', transform: 'rotate(-90)',
                      strokeDasharray: (2 * Math.PI * 44).toFixed(1),
                      strokeDashoffset: (2 * Math.PI * 44 * (1 - manoHud.carga)).toFixed(1),
                    })
                  : null,
                h('path', { d: 'M-70 0 L-30 0 M30 0 L70 0 M0 -70 L0 -30 M0 30 L0 70', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }),
                h('circle', { r: 6, fill: '#D52B1E' }),
                h('text', { y: 82, textAnchor: 'middle', className: 'fp-svg-sub' }, manoHud.mano === 'I' ? 'IZQ' : 'DER'))
            : null,
          // fogonazo
          flashVivo ? h('g', { transform: 'translate(' + flashVivo.x + ',' + flashVivo.y + ')' },
            flashVivo.vacio
              ? h('circle', { r: 26, fill: 'rgba(255,255,255,.25)' })
              : h(EstallidoDC, { cx: 0, cy: 0, r: flashVivo.recarga ? 56 : 40, puntas: 10, color: '#FFE066', borde: '#C2410C', linea: 5 }),
            flashVivo.vacio ? h('text', { y: -40, textAnchor: 'middle', className: 'fp-svg-warn' }, 'SIN BALAS') : null) : null)),
        h('p', { className: 'fp-hint' },
          conMano
            ? (avisoMano || 'Apunta con la mano y cierra el puño para disparar.')
            : 'Dispara a las empanadas, los choripanes y los volantines. Los ajíes y los schops te restan puntos.')));
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
    // `cuerpo` es la lectura de cuerpo completo: con ella el paso adelante
    // suma fuerza al tiro, que es como se lanza un tejo de verdad.
    return {
      reset() { armado = false; enSwing = false; pico = null; hist = []; },
      estado() { return enSwing ? 'lanzando' : armado ? 'listo' : 'baja la mano'; },
      /**
       * Devuelve null, o {fuerza, lateral, brazo} cuando detecta el lanzamiento.
       *
       * `k` son los datos del Kinect. Con sensor, el tejo sale cuando la mano
       * SE ABRE, que es lo que hace un jugador de verdad al soltarlo; con
       * webcam hay que adivinar el momento por el punto más rápido del swing.
       */
      actualizar(L, espejo, k, cuerpo) {
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
        // Con Kinect: la mano que lanza se abre y ahí sale el tejo.
        const manoDelSwing = k ? (pico.brazo === 'izquierdo' ? k.manoI : k.manoD) : null;
        const confianza = k ? (pico.brazo === 'izquierdo' ? k.confianzaManoI : k.confianzaManoD) : 0;
        const soltoLaMano = !!manoDelSwing && confianza >= 0.5 && manoDelSwing === 'abierta';
        // Sin sensor, se suelta en el punto más rápido del swing (ventana corta).
        if (soltoLaMano || t - tSwing > 220 || mejor.rapidez < pico.rapidez * 0.6) {
          // Un tejo se lanza con el cuerpo, no con el brazo: el paso adelante
          // acompaña el swing y suma hasta un 25 % de fuerza. Si la cámara no
          // ve las piernas, `paso` llega en 0 y el tiro vale lo de siempre.
          const paso = clamp(num(cuerpo && cuerpo.visibilidadCuerpo === 'completo' ? cuerpo.pasoAdelante : 0, 0), 0, 1);
          const r = {
            fuerza: pico.rapidez * (1 + paso * 0.25),
            lateral: pico.vx, brazo: pico.brazo,
            paso, conCuerpo: paso > 0.12,
          };
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
    // Un golpe se reconoce por su FORMA en 250 ms, no por la velocidad entre
    // dos cuadros: esa velocidad es ruido del modelo la mitad de las veces.
    const vent = { izquierdo: ventanaGesto(250), derecho: ventanaGesto(250) };
    let prev = null, reloj = 0;
    return {
      reset() {
        est.izquierdo = { fuera: false, pico: 0 }; est.derecho = { fuera: false, pico: 0 };
        vent.izquierdo.reset(); vent.derecho.reset();
        prev = null; reloj = 0;
      },
      /**
       * Devuelve { golpe, guardia, inclinacion, listo }.
       * `golpe` es null o { brazo, altura: 'alta'|'media', fuerza }.
       *
       * `k` son los datos que solo entrega el Kinect. Cuando están:
       *   · un golpe cuenta solo con el PUÑO CERRADO, que es lo que distingue
       *     pegar de estirar el brazo para señalar algo;
       *   · la guardia se lee de las manos cerradas junto a la cara, no de la
       *     posición sola;
       *   · la esquiva usa el `lean` que mide el sensor, en vez de deducirla
       *     de cuánto se corrió el torso en la imagen.
       */
      actualizar(L, espejo, dt, k, mundo) {
        const vacio = { golpe: null, guardia: false, inclinacion: 0, listo: false };
        if (!L) return vacio;
        // Reloj propio, por la misma razón que en el detector de salto.
        reloj += Math.max(0, num(dt, 1 / 60)) * 1000;
        const tAhora = reloj;
        const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
        const escala = escalaCorporal(L, 'superior');
        if (!hI || !hD || !escala) return vacio;
        const hombroY = (hI.y + hD.y) / 2;
        const centroX = (hI.x + hD.x) / 2;
        const nariz = L[IDX.nariz];

        const brazos = [
          { brazo: 'izquierdo', hombro: hI, muneca: L[IDX.munecaI], codo: L[IDX.codoI], wm: mundo && mundo[IDX.munecaI], wh: mundo && mundo[IDX.hombroI] },
          { brazo: 'derecho', hombro: hD, muneca: L[IDX.munecaD], codo: L[IDX.codoD], wm: mundo && mundo[IDX.munecaD], wh: mundo && mundo[IDX.hombroD] },
        ];
        let golpe = null, manosArriba = 0, manosVistas = 0;
        for (const b of brazos) {
          if (!b.muneca) continue;
          manosVistas++;
          // Extensión del brazo, en anchos de hombro.
          let ext = Math.hypot(b.muneca.x - b.hombro.x, b.muneca.y - b.hombro.y) / escala;
          // Un directo va HACIA la cámara: en la imagen la muñeca casi no se
          // mueve, y medir solo el desplazamiento del extremo lo perdería. Con
          // coordenadas de mundo la extensión se mide en 3D, que es lo que un
          // directo de verdad hace crecer.
          if (b.wm && b.wh) {
            const ext3d = Math.hypot(b.wm.x - b.wh.x, b.wm.y - b.wh.y, b.wm.z - b.wh.z);
            const anchoM = mundo[IDX.hombroI] && mundo[IDX.hombroD]
              ? Math.hypot(mundo[IDX.hombroI].x - mundo[IDX.hombroD].x,
                  mundo[IDX.hombroI].y - mundo[IDX.hombroD].y,
                  mundo[IDX.hombroI].z - mundo[IDX.hombroD].z)
              : 0;
            if (anchoM > 0.05) ext = ext3d / anchoM;
          }
          const e = est[b.brazo];
          // La velocidad sale de la VENTANA, no del cuadro anterior.
          vent[b.brazo].empujar(ext, tAhora);
          const f = vent[b.brazo].forma();
          const vel = f ? f.subida : 0;
          if (nariz && Math.abs(b.muneca.y - nariz.y) < escala * 0.85
              && Math.abs(b.muneca.x - centroX) < escala * 0.9) manosArriba++;
          // Con Kinect, el puño tiene que estar CERRADO: estirar el brazo con
          // la mano abierta es señalar, no pegar.
          const mano = k ? (b.brazo === 'izquierdo' ? k.manoI : k.manoD) : null;
          const confianza = k ? (b.brazo === 'izquierdo' ? k.confianzaManoI : k.confianzaManoD) : 0;
          const puno = !mano || mano === 'desconocida' || confianza < 0.5 ? true : mano === 'cerrada';
          // Y el gesto tiene que tener forma: haber subido de manera sostenida
          // durante al menos ~90 ms. Un pico de un cuadro ya no cuenta.
          const conForma = !!f && f.sostenido && f.duracionMs >= 90 && f.amplitud > 0.25;
          if (!e.fuera && ext > 1.15 && vel > 1.6 && conForma && puno) {
            // Golpe: el brazo se extendió rápido (y con el puño cerrado).
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
        // Inclinación del torso. El Kinect la mide; con webcam se deduce de
        // cuánto se corrió el torso respecto del centro de la imagen.
        let incl;
        if (k && k.lean && Number.isFinite(k.lean.x)) {
          incl = k.lean.x * 2;                       // lean −1..1 ≈ 45°
          if (espejo) incl = -incl;
        } else {
          incl = (centroX - 0.5) / Math.max(0.08, escala);
          if (espejo) incl = -incl;
        }
        // Guardia: manos arriba y, si el sensor lo sabe, además cerradas.
        const punos = k ? (k.manoI === 'cerrada' ? 1 : 0) + (k.manoD === 'cerrada' ? 1 : 0) : 2;
        const guardia = manosArriba >= 2 && (!k || punos >= 2);
        return {
          golpe,
          guardia,
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
    const cuerpoRef = useRef(seguidorCuerpo());
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
      olvidarMotor();
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
        const prov = await arrancarPose(hw, videoRef, streamRef);
        provRef.current = prov;
        irA('posicion');
      } catch (e) {
        soltarTodo();
        setError(mensajeCamara(e));
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
          // La pantalla de posicionamiento es el momento de medir los largos
          // de hueso: la persona está quieta y de frente, que es justo cuando
          // esa medida vale. Después sirven para descartar cuadros absurdos.
          if (prov && prov.tuberia) prov.tuberia.calibrar(L);
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
            cuerpoRef.current.reset();
            irA('cancha');
          }
          return;
        }
        if (volandoRef.current) return;
        const cuerpo = cuerpoRef.current.actualizar(L, dt, hw.espejo !== false, lec && lec.mundo);
        const r = detRef.current.actualizar(L, hw.espejo !== false, lec && lec.kinect, cuerpo);
        if (t - ultimoHud > 150) {
          ultimoHud = t;
          setGuia((g) => Object.assign({}, g, { landmarks: L }));
          setGesto(L ? detRef.current.estado() : 'no te veo');
        }
        if (r) lanzarTejo(r.fuerza, r.lateral);
      });
    }, [fase, modoTactil, hw.espejo, lanzarTejo, irA]);

    // ── Lanzamiento táctil: arrastre y barra de precisión ──────────────────────────
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
      h(CamaraVista, { attach: attachVideo, espejo: espejo, landmarks: guia.landmarks, espacio: model.espacio, imagenKinect: imagenDe(provRef) },
        guia.landmarks ? h(Esqueleto, { landmarks: guia.landmarks, espejo: espejo }) : null),
      fase === 'posicion' ? h(Silueta, { ok: guia.ok, modo: 'superior' }) : null,
      hw.avisoCamara !== false && streamRef.current
        ? h(AvisoCamara, null) : null);

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
          h(ZonaMedioCuerpo, { ok: guia.ok, metros: num(cfg.distanciaMetros, 2.2), nota: 'representa los 14 m oficiales' }),
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
    const escR = escenaDe(themeOf(model));
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
          // Cancha de rayuela al aire libre: cielo, cerros y tierra en fuga.
          h(EscenaDC, {
            w: 1000, h: 1400, horizonte: 300, gid: 'fp-ray', escena: escR,
            solX: 300, altoCerros: 120, filas: 9, lineas: 13,
            suelo: '#7A5A34', bruma: 'rgba(255,236,200,.4)',
            nubes: [{ x: 220, y: 96, r: 28 }, { x: 640, y: 150, r: 21 }],
          }),
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
          cfg.vistaSuperior === false ? null : h('g', { transform: 'translate(828,320)' },
            h('rect', { x: -106, y: -104, width: 220, height: 220, rx: 8, fill: 'rgba(0,0,0,.3)' }),
            h('rect', { x: -110, y: -110, width: 220, height: 220, rx: 8, fill: 'rgba(8,14,26,.82)', stroke: '#fff', strokeWidth: 4 }),
            h('rect', { x: -110, y: -110, width: 220, height: 8, fill: 'rgba(255,255,255,.35)' }),
            h('line', { x1: -110, y1: 0, x2: 110, y2: 0, stroke: '#fff', strokeWidth: 4 }),
            // El rótulo va sobre su propia placa: encima del cielo claro,
            // el texto blanco solo no se lee.
            h('rect', { x: -96, y: -152, width: 192, height: 38, rx: 5, fill: '#0B1424', stroke: '#fff', strokeWidth: 3 }),
            h('text', { y: -124, textAnchor: 'middle', className: 'fp-svg-sub' }, 'VISTA SUPERIOR'),
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
          hw.avisoCamara !== false ? h(AvisoCamara, null) : null) : null,
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
      olvidarMotor();
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
        const prov = await arrancarPose(hw, videoRef, streamRef);
        provRef.current = prov;
        irA('posicion');
      } catch (e) {
        soltarTodo();
        setError(mensajeCamara(e));
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
          // La pantalla de posicionamiento es el momento de medir los largos
          // de hueso: la persona está quieta y de frente, que es justo cuando
          // esa medida vale. Después sirven para descartar cuadros absurdos.
          if (prov && prov.tuberia) prov.tuberia.calibrar(L);
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
          const lect = detRef.current.actualizar(L, hw.espejo !== false, dt, lec && lec.kinect, lec && lec.mundo);
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
      h(CamaraVista, { attach: attachVideo, espejo: espejo, landmarks: guia.landmarks, espacio: model.espacio, imagenKinect: imagenDe(provRef) },
        guia.landmarks ? h(Esqueleto, { landmarks: guia.landmarks, espejo: espejo }) : null),
      fase === 'posicion' ? h(Silueta, { ok: guia.ok, modo: 'superior' }) : null,
      hw.avisoCamara !== false && streamRef.current
        ? h(AvisoCamara, null) : null);

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
          h(ZonaMedioCuerpo, { ok: guia.ok, metros: num(cfg.distanciaMetros, 2.2), nota: 'con el torso y los brazos basta' }),
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

    const fBo = facetas(themeOf(model).accent);
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
          h(LienzoDC, { gid: 'fp-box-vb', w: 1000, h: 1400 },
          h('defs', null,
            h('radialGradient', { id: 'fp-ring', cx: '50%', cy: '18%', r: '82%' },
              h('stop', { offset: '0%', stopColor: '#3A4A6E' }),
              h('stop', { offset: '100%', stopColor: '#0C1220' }))),
          h('rect', { width: 1000, height: 1400, fill: 'url(#fp-ring)' }),
          // Foco cenital: el cono de luz que cae sobre la lona.
          h('path', { d: 'M500 0 L860 980 L140 980 Z', fill: '#FFF3C4', opacity: 0.1 }),
          // Público en la sombra: cabezas sin detalle, solo siluetas.
          h('g', { opacity: 0.5 }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => h('circle', {
            key: 'p' + i, cx: 26 + i * 74, cy: 150 + ((i * 7) % 3) * 30, r: 22 + (i % 3) * 4, fill: '#070C16',
          }))),
          // Lona en fuga: el ring es un plano que se aleja, no un fondo plano.
          h(SueloDC, { w: 1000, h: 1400, horizonte: 900, color: '#8C9AAE', fugaX: 500, filas: 7, lineas: 11, bruma: 'rgba(255,255,255,.12)' }),
          // Cuerdas del ring, con brillo arriba y sombra abajo.
          [0, 1, 2].map((i) => h('g', { key: 'c' + i },
            h('line', { x1: 0, y1: 254 + i * 90, x2: 1000, y2: 254 + i * 90, stroke: fBo.linea, strokeWidth: 12 }),
            h('line', { x1: 0, y1: 250 + i * 90, x2: 1000, y2: 250 + i * 90, stroke: fBo.base, strokeWidth: 10 }),
            h('line', { x1: 0, y1: 247 + i * 90, x2: 1000, y2: 247 + i * 90, stroke: fBo.luz, strokeWidth: 3 }))),
          h(SombraDC, { cx: 500, cy: 1010, rx: 240, ry: 44 }),
          // contrincante
          h('g', { transform: 'translate(500,520) scale(1.05)' },
            h(RivalBoxeo, { tipo: rival, estado: hud.estadoRival, brazo: hud.brazoRival, t: hud.reloj })),
          // efectos
          efectos.map((e) => h('text', {
            key: e.id, x: e.x, y: e.y, textAnchor: 'middle',
            className: 'fp-box-fx' + (e.tipo === 'recibe' ? ' is-mal' : e.tipo === 'ko' ? ' is-ko' : ''),
          }, e.texto))),
          // guantes del jugador
          h(GuanteJugador, { x: manoI.x, y: manoI.y, color: '#D52B1E' }),
          h(GuanteJugador, { x: manoD.x, y: manoD.y, color: '#D52B1E' }),
          hud.guardia ? h('text', { x: 500, y: 1330, textAnchor: 'middle', className: 'fp-svg-label' }, '🛡 GUARDIA ARRIBA') : null),
        !modoTactil ? h('div', { className: 'fp-ray-cam' },
          h('video', {
            ref: attachVideo, className: 'fp-video' + (espejo ? ' is-mirror' : ''),
            autoPlay: true, playsInline: true, muted: true,
          }),
          hw.avisoCamara !== false ? h(AvisoCamara, null) : null) : null,
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
    const rondas = clamp(Math.round(num(cfg.rondas, 3)), 1, 9);

    // ── Configuración de la partida, elegida en pantalla ──────────────
    // El Editor solo define los valores por DEFECTO: quién juega y con qué
    // ficha se elige siempre en el tótem, antes de cada serie.
    const [fase, setFase] = useState('setup');            // setup | juego
    const [rival, setRival] = useState(cfg.modo === 'dos-jugadores' ? 'humano' : 'maquina');
    const [nivel, setNivel] = useState(s(cfg.dificultad) || 'media');
    const [fichaJ1, setFichaJ1] = useState('x');          // ficha del jugador 1
    const fichaJ2 = fichaJ1 === 'x' ? 'o' : 'x';          // el otro se queda con la contraria
    const contraMaquina = rival === 'maquina';

    const [tablero, setTablero] = useState(['', '', '', '', '', '', '', '', '']);
    const [turno, setTurno] = useState('x');              // las cruces siempre parten
    const [serie, setSerie] = useState({ x: 0, o: 0, empates: 0, jugadas: 0 });
    const [pensando, setPensando] = useState(false);

    const res = ganadorGato(tablero);
    const terminada = serie.jugadas >= rondas;
    const nombreDe = (f) => (f === fichaJ1
      ? (contraMaquina ? 'Tú' : 'Jugador 1')
      : (contraMaquina ? 'Tótem' : 'Jugador 2'));

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

    // Turno del tótem. Si el jugador eligió círculos, el tótem lleva las cruces
    // y por lo tanto abre la partida.
    useEffect(() => {
      if (fase !== 'juego' || !contraMaquina || res || turno !== fichaJ2) return undefined;
      setPensando(true);
      const t = setT(() => {
        setPensando(false);
        const i = jugadaMaquina(tablero, fichaJ2, nivel);
        if (i >= 0) jugar(i, fichaJ2);
      }, 520);
      return () => clrT(t);
    }, [fase, turno, tablero, res, contraMaquina, fichaJ2, nivel, jugar]);

    const nuevaMano = () => {
      setTablero(['', '', '', '', '', '', '', '', '']);
      setTurno('x');
    };
    const volverASetup = () => {
      setSerie({ x: 0, o: 0, empates: 0, jugadas: 0 });
      nuevaMano();
      setFase('setup');
    };

    // ── Pantalla de selección: rival y ficha ──────────────────────────
    if (fase === 'setup') {
      const opcionFicha = (f, quien) => h('button', {
        key: f, type: 'button',
        className: 'fp-ficha-op' + (fichaJ1 === f ? ' is-on' : ''),
        onClick: () => setFichaJ1(f),
      },
        h('svg', { viewBox: '-100 -100 200 200', className: 'fp-ficha-svg' }, h(FichaGato, { valor: f })),
        h('b', null, f === 'x' ? 'Cruces' : 'Círculos'),
        h('small', null, quien));

      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-setup' },
          h('h2', null, '¿Contra quién juegas?'),
          h('div', { className: 'fp-setup-ops' },
            h('button', {
              type: 'button', className: 'fp-setup-op' + (rival === 'maquina' ? ' is-on' : ''),
              onClick: () => setRival('maquina'),
            },
              h('span', { className: 'fp-setup-emoji' }, '🤖'),
              h('b', null, 'Contra el tótem'),
              h('small', null, 'Juega la máquina')),
            h('button', {
              type: 'button', className: 'fp-setup-op' + (rival === 'humano' ? ' is-on' : ''),
              onClick: () => setRival('humano'),
            },
              h('span', { className: 'fp-setup-emoji' }, '👥'),
              h('b', null, 'Dos jugadores'),
              h('small', null, 'Por turnos en esta pantalla'))),

          contraMaquina ? h('div', { className: 'fp-setup-nivel' },
            h('span', null, 'Nivel del tótem:'),
            [['facil', 'Fácil'], ['media', 'Media'], ['dificil', 'Difícil']].map(([k, l]) =>
              h('button', {
                key: k, type: 'button', className: 'fp-chip' + (nivel === k ? ' is-on' : ''),
                onClick: () => setNivel(k),
              }, l))) : null,

          h('h2', null, contraMaquina ? 'Elige tu ficha' : 'Jugador 1 elige su ficha'),
          h('div', { className: 'fp-fichas' },
            opcionFicha('x', contraMaquina
              ? (fichaJ1 === 'x' ? 'tú' : 'el tótem')
              : (fichaJ1 === 'x' ? 'Jugador 1' : 'Jugador 2')),
            opcionFicha('o', contraMaquina
              ? (fichaJ1 === 'o' ? 'tú' : 'el tótem')
              : (fichaJ1 === 'o' ? 'Jugador 1' : 'Jugador 2'))),

          h('p', { className: 'fp-setup-nota' },
            'Las cruces siempre abren la partida' +
            (fichaJ1 === 'o'
              ? (contraMaquina ? ', así que el tótem parte jugando.' : ', así que parte el Jugador 2.')
              : ', así que partes tú.')),

          h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => { nuevaMano(); setFase('juego'); } },
              'Comenzar · ' + rondas + (rondas === 1 ? ' mano' : ' manos')))));
    }

    // ── Fin de la serie ───────────────────────────────────────────────
    if (terminada) {
      const mias = serie[fichaJ1], suyas = serie[fichaJ2];
      const p10 = clamp((mias * 10 + serie.empates * 5) / Math.max(1, serie.jugadas), 0, 10);
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h(Resultado, {
          puntaje10: p10,
          juego: props.game.name,
          titulo: mias > suyas
            ? (contraMaquina ? '¡Le ganaste al tótem!' : '¡Gana el Jugador 1!')
            : mias === suyas ? 'Serie empatada'
            : (contraMaquina ? 'Ganó el tótem' : '¡Gana el Jugador 2!'),
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, nombreDe(fichaJ1) + ' (' + (fichaJ1 === 'x' ? 'cruces' : 'círculos') + '): ' + mias),
            h(Chip, null, nombreDe(fichaJ2) + ' (' + (fichaJ2 === 'x' ? 'cruces' : 'círculos') + '): ' + suyas),
            h(Chip, null, 'Empates: ' + serie.empates)),
          detalleTexto: nombreDe(fichaJ1) + ' ' + mias + ' · ' + nombreDe(fichaJ2) + ' ' + suyas + ' · empates ' + serie.empates,
          onExit: props.onExit,
          onReplay: volverASetup,
        }));
    }

    // ── Tablero ───────────────────────────────────────────────────────
    const fGa = facetas(themeOf(model).accent);
    const puedeTocar = !res && !pensando && !(contraMaquina && turno === fichaJ2);
    const celda = (i) => {
      const cx = 170 + (i % 3) * 250, cy = 170 + Math.floor(i / 3) * 250;
      const ganadora = res && res.linea && res.linea.indexOf(i) >= 0;
      return h('g', {
        key: i, transform: 'translate(' + cx + ',' + cy + ')',
        onPointerDown: () => { if (puedeTocar && !tablero[i]) jugar(i, turno); },
        style: { cursor: puedeTocar && !tablero[i] ? 'pointer' : 'default' },
      },
        // Cada casilla es una tecla de máquina: cara superior clara, canto
        // en sombra y hueco oscuro debajo.
        h('rect', { x: -106, y: -102, width: 220, height: 220, rx: 12, fill: 'rgba(0,0,0,.3)' }),
        h('rect', {
          x: -110, y: -110, width: 220, height: 220, rx: 12,
          fill: ganadora ? '#FFF0BE' : '#F7F5EF',
          stroke: ganadora ? '#C2610A' : '#8E8878', strokeWidth: ganadora ? 8 : 5,
        }),
        h('rect', { x: -110, y: -110, width: 220, height: 12, rx: 4, fill: '#fff', opacity: 0.9 }),
        h('rect', { x: -110, y: 92, width: 220, height: 18, fill: '#000', opacity: 0.12 }),
        h(FichaGato, { valor: tablero[i] }));
    };

    return h(Marco, {
      icon: props.game.icon, title: props.game.name, onExit: props.onExit,
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, null, 'Mano ' + Math.min(serie.jugadas + 1, rondas) + '/' + rondas),
        h(Chip, { tone: 'accent' }, nombreDe(fichaJ1) + ' ' + serie[fichaJ1] + ' · ' + nombreDe(fichaJ2) + ' ' + serie[fichaJ2]),
        contraMaquina ? h(Chip, null, 'tótem ' + nivel) : h(Chip, null, '2 jugadores')),
    },
      h('div', { className: 'fp-gato-wrap' },
        h('svg', { className: 'fp-gato-svg', viewBox: '0 0 840 840' },
          // El tablero es un mueble: base oscura, superficie y bisel.
          h('rect', { x: 6, y: 10, width: 834, height: 830, rx: 20, fill: 'rgba(0,0,0,.35)' }),
          h('rect', { width: 840, height: 840, rx: 20, fill: '#3A3326' }),
          h('rect', { x: 10, y: 10, width: 820, height: 820, rx: 16, fill: '#EDE7D9' }),
          h('rect', { x: 10, y: 10, width: 820, height: 14, rx: 6, fill: '#fff', opacity: 0.7 }),
          [0, 1, 2, 3, 4, 5, 6, 7, 8].map(celda),
          res && res.linea ? h('g', null,
            h('line', {
              x1: 170 + (res.linea[0] % 3) * 250, y1: 174 + Math.floor(res.linea[0] / 3) * 250,
              x2: 170 + (res.linea[2] % 3) * 250, y2: 174 + Math.floor(res.linea[2] / 3) * 250,
              stroke: fGa.linea, strokeWidth: 22, strokeLinecap: 'round',
            }),
            h('line', {
              x1: 170 + (res.linea[0] % 3) * 250, y1: 170 + Math.floor(res.linea[0] / 3) * 250,
              x2: 170 + (res.linea[2] % 3) * 250, y2: 170 + Math.floor(res.linea[2] / 3) * 250,
              stroke: fGa.base, strokeWidth: 16, strokeLinecap: 'round',
            })) : null),
        h('div', { className: 'fp-gato-pie' },
          res
            ? h('div', { className: 'fp-gato-fin' },
                h('b', null, res.jugador === 'empate' ? '¡Empate!' : '¡Gana ' + nombreDe(res.jugador) + '!'),
                h(Boton, { variant: 'primary', onClick: nuevaMano }, 'Siguiente mano'),
                h(Boton, { onClick: volverASetup }, 'Cambiar rival o ficha'))
            : h('div', { className: 'fp-gato-turno' },
                h('span', null, 'Juega ' + nombreDe(turno)),
                h('svg', { viewBox: '-90 -90 180 180', className: 'fp-gato-turno-svg' }, h(FichaGato, { valor: turno })),
                pensando ? h('span', null, 'pensando…') : null))));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.e Seguimiento de cuerpo completo, compartido por los juegos
  // ══════════════════════════════════════════════════════════════════════
  //
  // Los juegos nacieron leyendo el tren superior, porque es lo único que una
  // cámara puesta encima de una pantalla ve seguro. Pero el cuerpo entero está
  // ahí —los 33 puntos incluyen caderas, rodillas, tobillos y pies— y jugar
  // con las piernas es la mitad de la gracia de jugar con el cuerpo.
  //
  // Esta capa lo mide UNA vez por cuadro y se lo pasa a todos: dónde están los
  // pies, cuánto se corrió la persona de donde empezó, si dio un paso
  // adelante, si flexionó las rodillas, si juntó las piernas.
  //
  // Lo importante es que DEGRADA. Si la cámara no ve los pies —que es el caso
  // del tótem a 175 cm— no se rompe nada: declara `visibilidadCuerpo: 'superior'`, deja
  // en null lo que no puede medir, y cada juego decide si usa esa señal o
  // sigue con la de siempre. Prometer piernas donde no se ven sería peor que
  // no tenerlas.

  /**
   * Seguidor de cuerpo completo. Se calibra solo con el primer segundo de
   * persona quieta, y desde ahí mide todo RESPECTO DE ESA POSTURA: así un paso
   * lateral es un paso lateral aunque la persona haya empezado descentrada.
   */
  function seguidorCuerpo(opts) {
    const o = opts || {};
    const tCalib = num(o.calibracion, 1.0);
    let base = null, calib = 0, suave = null;
    const vacio = {
      visible: false, visibilidadCuerpo: 'nada', escala: null, calibrando: true,
      pasoLateral: 0, pasoAdelante: 0, flexionRodillas: 0, piernasJuntas: 0,
      apoyo: 'ninguno', pies: null, fuenteProfundidad: null,
    };
    return {
      reset() { base = null; calib = 0; suave = null; },
      listo() { return base != null; },
      /**
       * `mundo` son las coordenadas métricas (Kinect o MediaPipe world). Solo
       * con ellas se puede saber si un pie avanzó HACIA la pantalla; sin ellas
       * se deduce de la separación vertical, que es más pobre y se declara.
       */
      actualizar(L, dt, espejo, mundo) {
        if (!L) { return Object.assign({}, vacio, { calibrando: base == null }); }
        const escala = escalaCorporal(L, 'superior');
        const cI = L[IDX.caderaI], cD = L[IDX.caderaD];
        if (!escala || !cI || !cD) return Object.assign({}, vacio, { calibrando: base == null });
        const ver = (p) => p && (p.visibility == null || p.visibility > 0.4);

        // Los pies primero, el tobillo si el pie no se ve.
        const pie = (idxPie, idxTobillo) => {
          if (ver(L[idxPie])) return { x: L[idxPie].x, y: L[idxPie].y, propio: true };
          if (ver(L[idxTobillo])) return { x: L[idxTobillo].x, y: L[idxTobillo].y, propio: false };
          return null;
        };
        const pI = pie(31, IDX.tobilloI), pD = pie(32, IDX.tobilloD);
        const visibilidadCuerpo = pI && pD ? 'completo' : (pI || pD) ? 'parcial' : 'superior';

        const caderaX = (cI.x + cD.x) / 2;
        const caderaY = (cI.y + cD.y) / 2;
        const sep = pI && pD ? Math.abs(pI.x - pD.x) / escala : null;
        const marco = { caderaX, caderaY, sep };
        const k = clamp(dt * 10, 0, 1);
        suave = suave == null ? marco : {
          caderaX: suave.caderaX + (caderaX - suave.caderaX) * k,
          caderaY: suave.caderaY + (caderaY - suave.caderaY) * k,
          sep: sep == null ? suave.sep : (suave.sep == null ? sep : suave.sep + (sep - suave.sep) * k),
        };

        if (base == null) {
          calib += dt;
          if (calib >= tCalib) base = { caderaX: suave.caderaX, caderaY: suave.caderaY, sep: suave.sep };
          return Object.assign({}, vacio, { visible: true, visibilidadCuerpo, escala, calibrando: base == null });
        }

        // ── Paso lateral ───────────────────────────────────────────────
        // Cuánto se movió la cadera respecto de donde empezó, en anchos de
        // hombro. Es lo que convierte "esquivar" en un movimiento de verdad.
        let lateral = ((suave.caderaX - base.caderaX) / escala) * (espejo ? -1 : 1);
        // Deriva lenta: si alguien se reacomoda y se queda ahí, esa pasa a ser
        // su nueva postura de reposo en vez de un paso permanente.
        base.caderaX += (suave.caderaX - base.caderaX) * clamp(dt * 0.08, 0, 1);

        // ── Flexión de rodillas ────────────────────────────────────────
        // La cadera baja al flectar. En imagen `y` crece hacia abajo.
        const flexion = clamp(((suave.caderaY - base.caderaY) / escala) / 0.55, -1, 1);
        base.caderaY += (suave.caderaY - base.caderaY) * clamp(dt * 0.05, 0, 1);

        // ── Piernas juntas o abiertas ──────────────────────────────────
        let juntas = 0;
        if (suave.sep != null && base.sep != null && base.sep > 0.05) {
          // 1 = mucho más juntas que en reposo, −1 = mucho más abiertas.
          juntas = clamp((base.sep - suave.sep) / (base.sep * 0.8), -1, 1);
        }

        // ── Paso adelante ──────────────────────────────────────────────
        let adelante = 0, fuenteProf = null;
        if (mundo) {
          const wC = [mundo[IDX.caderaI], mundo[IDX.caderaD]].filter(Boolean);
          const wP = [mundo[31], mundo[32], mundo[IDX.tobilloI], mundo[IDX.tobilloD]].filter(Boolean);
          if (wC.length === 2 && wP.length) {
            const zCadera = (wC[0].z + wC[1].z) / 2;
            // El pie más adelantado es el de menor z: z crece alejándose.
            const zPie = Math.min.apply(null, wP.map((p) => p.z));
            const anchoM = Math.hypot(wC[0].x - wC[1].x, wC[0].y - wC[1].y, wC[0].z - wC[1].z);
            if (anchoM > 0.05) {
              adelante = clamp((zCadera - zPie) / (anchoM * 2.2), -1, 1);
              fuenteProf = 'metrico';
            }
          }
        }
        if (fuenteProf == null && pI && pD) {
          // Sin métrica: el pie adelantado se ve MÁS ABAJO en la imagen, por
          // perspectiva. Es una señal pobre pero real, y se declara como tal.
          adelante = clamp((Math.abs(pI.y - pD.y) / escala) / 0.5, 0, 1);
          fuenteProf = 'imagen';
        }

        const apoyo = pI && pD ? 'ambos' : pI ? 'izquierdo' : pD ? 'derecho' : 'ninguno';
        return {
          visible: true, visibilidadCuerpo, escala, calibrando: false,
          pasoLateral: clamp(lateral / 0.9, -1, 1),
          pasoAdelante: adelante,
          flexionRodillas: flexion,
          piernasJuntas: juntas,
          apoyo, pies: { I: pI, D: pD },
          fuenteProfundidad: fuenteProf,
        };
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.e.2 Detectores compartidos: patada y salto/agachada
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Detector de patada (juego "Mete gol"). Este SÍ necesita ver las piernas:
   * se arma con los tobillos abajo y quietos, y dispara en el pico de
   * velocidad del pie que se lanza hacia adelante y arriba. Todo se normaliza
   * por la escala corporal para que un niño y un adulto peguen parejo.
   */
  function detectorPatada() {
    let armado = false, enSwing = false, tSwing = 0, pico = null, hist = [];
    let usaPie = false, usaProfundidad = false;
    return {
      reset() { armado = false; enSwing = false; pico = null; hist = []; usaPie = false; usaProfundidad = false; },
      estado() { return enSwing ? 'pateando' : armado ? 'listo' : 'pies al suelo'; },
      /** Qué está leyendo: sirve para decirlo en pantalla sin adivinar. */
      fuente() {
        return (usaPie ? 'pie' : 'tobillo') + (usaProfundidad ? ' + profundidad' : '');
      },
      /**
       * null, o `{ fuerza, lateral, altura, pierna, profundidad }`.
       *
       * `mundo` son las coordenadas métricas del sensor. Con ellas se puede ver
       * algo que una cámara sola NO ve: cuánto avanza el pie HACIA la pantalla.
       * Sin eso, una patada al frente y una patada al aire de costado se leen
       * casi igual, y el juego premia por igual dos gestos muy distintos.
       */
      actualizar(L, espejo, mundo) {
        if (!L) return null;
        const escala = escalaCorporal(L, 'completo');
        if (!escala) return null;
        const cI = L[IDX.caderaI], cD = L[IDX.caderaD];
        if (!cI || !cD) return null;
        const caderaY = (cI.y + cD.y) / 2;
        const ver = (p) => p && (p.visibility == null || p.visibility > 0.4);
        // El Kinect entrega el PIE como articulación propia, más adelantada que
        // el tobillo: es el punto que de verdad golpea el balón. Si no está
        // (webcam, o pie fuera de cuadro) se sigue con el tobillo de siempre.
        const punta = (pie, tobillo) => {
          const t2 = ver(L[tobillo]) ? L[tobillo] : null;
          // El pie va SIEMPRE por debajo del tobillo. Si no lo está, no es un
          // pie: es un punto de relleno de algún proveedor, y seguirlo pondría
          // el remate a la altura del pecho.
          if (ver(L[pie]) && (!t2 || L[pie].y > t2.y)) return { p: L[pie], propio: true };
          return t2 ? { p: t2, propio: false } : null;
        };
        const lados = [
          { pierna: 'derecha', sel: punta(32, IDX.tobilloD), wi: 32, wt: IDX.tobilloD },
          { pierna: 'izquierda', sel: punta(31, IDX.tobilloI), wi: 31, wt: IDX.tobilloI },
        ].filter((x) => x.sel);
        if (!lados.length) return null;
        usaPie = lados.every((x) => x.sel.propio);
        const t = nowMs();
        hist.push({
          t,
          pies: lados.map((x) => {
            const w = mundo && (mundo[x.wi] || mundo[x.wt]);
            return { pierna: x.pierna, x: x.sel.p.x, y: x.sel.p.y, z: w ? w.z : null };
          }),
        });
        if (hist.length > 14) hist.shift();
        if (hist.length < 4) return null;

        const a = hist[0], b = hist[hist.length - 1];
        const dt = Math.max(0.04, (b.t - a.t) / 1000);
        let mejor = null;
        for (const f of b.pies) {
          const prev = a.pies.find((z) => z.pierna === f.pierna);
          if (!prev) continue;
          const vx = ((f.x - prev.x) / dt) / escala * (espejo ? -1 : 1);
          const vy = ((f.y - prev.y) / dt) / escala;
          const subida = -vy;
          // `z` crece alejándose del sensor, así que acercarse es negativo.
          const avance = f.z != null && prev.z != null ? -(f.z - prev.z) / dt : null;
          const rapidez = Math.hypot(vx, subida);
          if (!mejor || rapidez > mejor.rapidez) mejor = { pierna: f.pierna, vx, subida, rapidez, avance, y: f.y };
        }
        if (!mejor) return null;
        usaProfundidad = mejor.avance != null;

        if (!armado) {
          // Pie abajo (bien por debajo de la cadera) y quieto.
          if (mejor.y > caderaY + escala * 0.8 && mejor.rapidez < 1.5) armado = true;
          return null;
        }
        if (!enSwing) {
          if (mejor.rapidez > 2.4) { enSwing = true; tSwing = t; pico = mejor; }
          return null;
        }
        if (mejor.rapidez > pico.rapidez) pico = mejor;
        if (t - tSwing > 200 || mejor.rapidez < pico.rapidez * 0.6) {
          // Un remate frontal decidido llega cerca de 2 m/s de avance; ahí la
          // patada vale su fuerza entera. Una que solo va de lado, no.
          const profundidad = pico.avance == null ? null : clamp(pico.avance / 2, -1, 1);
          const r = {
            fuerza: profundidad == null ? pico.rapidez : pico.rapidez * (0.72 + 0.38 * clamp(profundidad, 0, 1)),
            lateral: pico.vx,
            // Cuánto levantó el pie decide si el balón va alto o raso.
            altura: clamp(pico.subida / Math.max(0.5, pico.rapidez), 0, 1),
            pierna: pico.pierna,
            profundidad,
          };
          armado = false; enSwing = false; pico = null; hist = [];
          return r;
        }
        return null;
      },
    };
  }

  /**
   * Detector de SALTO y AGACHADA por medio cuerpo (juegos "Esquiva y gana").
   * Se calibra con la altura de reposo de la línea de hombros y compara contra
   * ella, en anchos de hombro: así funciona igual de cerca o de lejos.
   */
  function detectorSaltoAgacharse() {
    let base = null, suave = null, calib = 0, modo = 'hombros';
    // Un salto dura. Exigir que el desvío se sostenga ~110 ms descarta el
    // cuadro suelto en que el modelo dio un tirón.
    //
    // El reloj es PROPIO, acumulado desde `dt`, no el de pared: un detector
    // que recibe el paso de tiempo tiene que comportarse igual lo alimente el
    // navegador a 30 Hz o un banco de pruebas de golpe.
    // Dos ventanas: una para el salto y otra para la agachada, porque cada
    // una busca su propia excursión y `forma()` mira máximos.
    const ventArriba = ventanaGesto(300), ventAbajo = ventanaGesto(300);
    let reloj = 0, activo = null;
    const reiniciar = (m) => { modo = m; base = null; suave = null; calib = 0; };
    return {
      reset() { base = null; suave = null; calib = 0; modo = 'hombros'; ventArriba.reset(); ventAbajo.reset(); reloj = 0; activo = null; },
      listo() { return base != null; },
      /** Qué referencia se está usando, para poder mostrarlo. */
      fuente() { return modo; },
      /**
       * `{ accion: 'saltar'|'agachar'|null, desvio, calibrando, fuente }`.
       *
       * `cuerpo` es la lectura de cuerpo completo. Cuando las piernas están a
       * la vista se mide con la CADERA en vez de los hombros: los hombros
       * suben y bajan al mover los brazos, y en un juego donde la gente
       * manotea eso son saltos fantasma. La cadera solo sube si el cuerpo sube.
       */
      actualizar(L, dt, k, cuerpo) {
        // Con el Kinect hay PLANO DEL PISO: la estatura sale en centímetros
        // reales y el salto se mide contra el suelo, no contra una referencia
        // que la persona fija estando quieta. Es más honesto y no se desvía
        // si el jugador se acerca o se aleja durante la partida.
        reloj += Math.max(0, num(dt, 1 / 30)) * 1000;
        const cm = k && Number.isFinite(k.estatura) && k.estatura > 60 ? k.estatura : null;
        const conPiernas = !!(cuerpo && cuerpo.visible && cuerpo.visibilidadCuerpo === 'completo' && cuerpo.escala);
        const quiere = cm != null ? 'piso' : conPiernas ? 'cadera' : 'hombros';
        // Cambiar de referencia invalida la anterior: se vuelve a calibrar.
        if (quiere !== modo) reiniciar(quiere);
        const vacio = () => ({ accion: null, desvio: 0, calibrando: base == null, fuente: modo });
        let y, escala;
        if (modo === 'piso') {
          y = -cm;                                   // − para que + siga siendo "subió"
          // El ancho de hombros ronda el 23 % de la estatura: así el umbral
          // vale lo mismo midiendo en la imagen o midiendo en centímetros.
          escala = Math.max(20, cm * 0.23);
        } else if (modo === 'cadera') {
          const cI = L && L[IDX.caderaI], cD = L && L[IDX.caderaD];
          if (!cI || !cD) return vacio();
          y = (cI.y + cD.y) / 2;
          escala = cuerpo.escala;
        } else {
          if (!L) return vacio();
          const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
          escala = escalaCorporal(L, 'superior');
          if (!hI || !hD || !escala) return vacio();
          y = (hI.y + hD.y) / 2;
        }
        suave = suave == null ? y : suave + (y - suave) * clamp(dt * 12, 0, 1);
        if (base == null) {
          // Primer segundo de pie quieto: eso fija la referencia.
          calib += dt;
          base = calib > 1 ? suave : null;
          return vacio();
        }
        // Deriva lenta para que la referencia siga a la persona si se reacomoda.
        base += (suave - base) * clamp(dt * 0.12, 0, 1);
        const desvio = (base - suave) / escala;      // + = subió (saltó)
        ventArriba.empujar(desvio, reloj);
        ventAbajo.empujar(-desvio, reloj);
        let accion = null;
        // El umbral manda, pero además la excursión tiene que tener FORMA: un
        // ascenso sostenido durante varios cuadros. Se pide forma y no
        // permanencia sobre el umbral a propósito: exigir que el desvío se
        // quede arriba 110 ms descartaría igual el ruido, pero le sumaría esos
        // 110 ms de retraso al salto, y en Esquiva eso se paga en obstáculos
        // que no se alcanzan a esquivar.
        const conForma = (v) => !!v && v.sostenido && v.duracionMs >= 55 && v.amplitud > 0.15;
        // `accion` es un ESTADO que el juego consulta en cada cuadro, no un
        // evento: mientras la persona está en el aire tiene que seguir diciendo
        // "saltar", o el obstáculo la golpea a media parábola. Por eso la forma
        // solo decide el ARRANQUE, y después se sostiene con histéresis hasta
        // que el cuerpo vuelve cerca de su reposo.
        if (!activo) {
          if (desvio > 0.33 && conForma(ventArriba.forma())) activo = 'saltar';
          else if (desvio < -0.30 && conForma(ventAbajo.forma())) activo = 'agachar';
        } else if (activo === 'saltar' && desvio < 0.18) activo = null;
        else if (activo === 'agachar' && desvio > -0.16) activo = null;
        accion = activo;
        return { accion, desvio, calibrando: false, fuente: modo };
      },
    };
  }

  /**
   * Detector de ALETEO y PLANEO (juego "Alas de cóndor").
   *
   * Lee la altura de las muñecas respecto de los hombros, en anchos de hombro,
   * así que funciona igual con una persona de 100 cm que con una de 200 y a
   * cualquier distancia. Solo necesita el medio cuerpo superior.
   *
   * Un aleteo es un ciclo completo: los brazos suben por encima de los hombros
   * y BAJAN. La fuerza se cuenta en la bajada, que es la que empuja al pájaro
   * de verdad, y sale de la amplitud del recorrido y de lo rápido que fue.
   *
   * El planeo es lo contrario: brazos abiertos, quietos y a la altura de los
   * hombros. Es la postura que sostiene la altura sin gastar aleteos.
   */
  function detectorAleteo(opts) {
    const o = opts || {};
    const arriba = num(o.umbralArriba, 0.28);   // anchos de hombro sobre el hombro
    const abajo = num(o.umbralAbajo, -0.12);    // y bajo el hombro
    const ampMin = num(o.amplitudMinima, 0.45); // recorrido mínimo para contar
    const ampRef = num(o.amplitudPlena, 1.15);  // recorrido que da fuerza 1
    let suave = null, fase = 'abajo', pico = null, valle = null;
    let quieto = 0, tUlt = 0, historial = [];
    return {
      reset() { suave = null; fase = 'abajo'; pico = valle = null; quieto = 0; tUlt = 0; historial = []; },
      /**
       * `{ aleteo, fuerza, planeo, altura, cadencia, visible }`.
       * `altura` va en anchos de hombro: + = muñecas sobre los hombros.
       *
       * `mundo` son las coordenadas MÉTRICAS (Kinect, o MediaPipe world). Con
       * ellas el aleteo se mide en el espacio real y no en la imagen, así que
       * no cambia si la persona se acerca, se aleja o se corre de lado.
       */
      actualizar(L, dt, mundo) {
        const vacio = { aleteo: false, fuerza: 0, planeo: false, altura: 0, cadencia: 0, visible: false };
        if (!L) return vacio;
        const escala = escalaCorporal(L, 'superior');
        const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
        const mI = L[IDX.munecaI], mD = L[IDX.munecaD];
        if (!escala || !hI || !hD) return vacio;
        const ver = (p) => p && (p.visibility == null || p.visibility > 0.4);
        const munecas = [];
        if (ver(mI)) munecas.push(mI);
        if (ver(mD)) munecas.push(mD);
        if (!munecas.length) return vacio;
        const yHombro = (hI.y + hD.y) / 2;
        const yMuneca = munecas.reduce((a, p) => a + p.y, 0) / munecas.length;
        // En imagen, `y` crece hacia abajo: se invierte para que + sea arriba.
        let altura = (yHombro - yMuneca) / escala;
        // Con datos métricos se prefiere el mundo real: mismo gesto, misma
        // lectura, esté la persona donde esté.
        if (mundo) {
          const w = (i) => mundo[i];
          const wH = [w(IDX.hombroI), w(IDX.hombroD)].filter(Boolean);
          const wM = [w(IDX.munecaI), w(IDX.munecaD)].filter(Boolean);
          if (wH.length === 2 && wM.length) {
            const anchoM = Math.hypot(wH[0].x - wH[1].x, wH[0].y - wH[1].y, wH[0].z - wH[1].z);
            if (anchoM > 0.05) {
              const yh = (wH[0].y + wH[1].y) / 2;
              const ym = wM.reduce((a, p) => a + p.y, 0) / wM.length;
              // Los dos mundos (Kinect y MediaPipe) usan +y hacia ABAJO, igual
              // que la imagen: `kinectAMundo` ya invierte el eje del sensor.
              altura = (yh - ym) / anchoM;
            }
          }
        }
        const k = clamp(dt * 16, 0, 1);
        suave = suave == null ? altura : suave + (altura - suave) * k;

        // ── Ciclo del aleteo ──────────────────────────────────────────
        let aleteo = false, fuerza = 0;
        if (fase === 'abajo') {
          if (valle == null || suave < valle) valle = suave;
          if (suave > arriba) { fase = 'arriba'; pico = suave; }
        } else {
          if (pico == null || suave > pico) pico = suave;
          if (suave < abajo) {
            const amplitud = pico - suave;
            if (amplitud >= ampMin) {
              aleteo = true;
              fuerza = clamp(amplitud / ampRef, 0.25, 1.4);
              historial.push(tUlt);
              if (historial.length > 6) historial.shift();
            }
            fase = 'abajo'; valle = suave;
          }
        }
        tUlt += dt;

        // ── Planeo: brazos abiertos, a la altura del hombro y quietos ──
        const extendido = munecas.every((p) => {
          const hombro = p === mI ? hI : hD;
          return Math.abs(p.x - hombro.x) / escala > 0.42;
        });
        const nivelado = Math.abs(suave) < 0.34;
        const cambio = Math.abs(altura - suave);
        quieto = nivelado && extendido && cambio < 0.09 ? quieto + dt : 0;
        const planeo = quieto > 0.22;

        // Cadencia: aleteos por segundo en la ventana reciente.
        let cadencia = 0;
        if (historial.length >= 2) {
          const lapso = historial[historial.length - 1] - historial[0];
          if (lapso > 0.05) cadencia = (historial.length - 1) / lapso;
        }
        return { aleteo, fuerza, planeo, altura: suave, cadencia, visible: true };
      },
    };
  }

  /**
   * Detector de INCLINACIÓN del torso, para virar en el vuelo 3D.
   *
   * Combina dos señales que dicen lo mismo y se refuerzan:
   *   · el desplazamiento lateral de los hombros respecto de las caderas
   *     (inclinarse de verdad), y
   *   · el ángulo de la línea de hombros (bajar un hombro para virar).
   * Las dos van en anchos de hombro, así que no dependen de la estatura ni de
   * la distancia. Si no se ven las caderas —encuadre de medio cuerpo— se usa
   * solo el ángulo de hombros, que es lo que siempre está a la vista.
   *
   * Hay una zona muerta al centro: sin ella, estar de pie ya haría virar.
   */
  function detectorInclinacion(opts) {
    const o = opts || {};
    const muerta = clamp(num(o.zonaMuerta, 0.12), 0, 0.5);
    const plena = clamp(num(o.inclinacionPlena, 0.55), 0.15, 2);
    let suave = null;
    return {
      reset() { suave = null; },
      /**
       * `{ giro, crudo, visible }`; giro va de −1 (izquierda) a 1 (derecha).
       *
       * `k` son los datos del Kinect: el sensor MIDE la inclinación del torso
       * y la entrega en `lean`, así que cuando está no hace falta deducirla de
       * la posición de hombros y caderas en la imagen.
       */
      actualizar(L, dt, espejo, k) {
        if (k && k.lean && Number.isFinite(k.lean.x)) {
          const bruto = k.lean.x / Math.max(0.05, num(o.leanPleno, 0.45));
          const mag = Math.max(0, Math.abs(bruto) - 0.18) / 0.82;
          let g = clamp(mag, 0, 1) * (bruto < 0 ? -1 : 1);
          if (espejo) g = -g;
          return { giro: g, crudo: k.lean.x, visible: true, fuente: 'kinect' };
        }
        if (!L) return { giro: 0, crudo: 0, visible: false };
        const escala = escalaCorporal(L, 'superior');
        const hI = L[IDX.hombroI], hD = L[IDX.hombroD];
        if (!escala || !hI || !hD) return { giro: 0, crudo: 0, visible: false };
        const ver = (p) => p && (p.visibility == null || p.visibility > 0.4);
        const cI = L[IDX.caderaI], cD = L[IDX.caderaD];
        const xHombros = (hI.x + hD.x) / 2;
        // Señal 1: hombros corridos respecto de las caderas.
        let desplazamiento = 0;
        if (ver(cI) && ver(cD)) desplazamiento = (xHombros - (cI.x + cD.x) / 2) / escala;
        // Señal 2: hombro que baja. En imagen `y` crece hacia abajo.
        const angulo = (hD.y - hI.y) / escala;
        const crudo = desplazamiento * 1.6 + angulo * 0.9;
        const alfa = clamp(dt * 9, 0, 1);
        suave = suave == null ? crudo : suave + (crudo - suave) * alfa;
        const magnitud = Math.max(0, Math.abs(suave) - muerta) / Math.max(0.01, plena - muerta);
        let giro = clamp(magnitud, 0, 1) * (suave < 0 ? -1 : 1);
        // Con la imagen en espejo, inclinarse a la derecha se ve a la izquierda.
        if (espejo) giro = -giro;
        return { giro, crudo: suave, visible: true };
      },
    };
  }

  /**
   * Motor de vuelo del circuito.
   *
   * El cóndor cae siempre; cada aleteo le da un empujón hacia arriba y el
   * planeo frena la caída sin darle altura. El circuito avanza solo: el
   * jugador únicamente decide a qué ALTURA pasa, y de eso depende qué frutas
   * alcanza. Tocar el suelo o pasarse de altura cuesta energía.
   *
   * Las frutas se generan con un generador pseudoaleatorio propio y semilla
   * fija: el mismo circuito se puede reproducir en una prueba.
   */
  function motorVuelo(cfg) {
    const c = cfg || {};
    const largo = clamp(num(c.largoCircuito, 60), 10, 600);   // segundos de vuelo
    // La cadencia que hace falta para sostenerse es gravedad / empuje. Con
    // 0.42 / 0.45 sale un aleteo por segundo, que una persona aguanta el
    // minuto que dura el circuito; con la relación anterior hacían falta 1,5
    // por segundo y el juego se volvía un ejercicio, no un juego.
    const gravedad = clamp(num(c.gravedad, 0.42), 0.05, 3);   // alturas/s²
    const empuje = clamp(num(c.empujeAleteo, 0.45), 0.05, 2); // salto de velocidad por aleteo
    const frenoPlaneo = clamp(num(c.frenoPlaneo, 0.72), 0, 1); // cuánto frena la caída
    const cada = clamp(num(c.frutasCada, 1.5), 0.3, 10);      // segundos entre frutas
    const energiaMax = Math.max(1, Math.round(num(c.energia, 3)));
    let semilla = Math.round(num(c.semilla, 20250918)) >>> 0;
    const azar = () => {
      // LCG de Numerical Recipes: barato, suficiente y reproducible.
      semilla = (semilla * 1664525 + 1013904223) >>> 0;
      return semilla / 4294967296;
    };
    // Con `lateral` el vuelo tiene además eje izquierda-derecha: es lo que
    // usa la versión 3D, donde se esquiva inclinando el torso. La versión
    // lateral 2D deja `x` en 0 y todo lo demás funciona igual.
    const lateral = !!c.lateral;
    const giroVel = clamp(num(c.giroVelocidad, 1.5), 0.1, 6);
    const giroFreno = clamp(num(c.giroFreno, 3.2), 0.2, 12);
    const conObstaculos = !!c.obstaculos;
    const OBSTACULOS = c.tiposObstaculo && c.tiposObstaculo.length ? c.tiposObstaculo : [
      { id: 'roca', nombre: 'Peñón' },
      { id: 'arbol', nombre: 'Araucaria' },
    ];
    const FRUTAS = c.frutas && c.frutas.length ? c.frutas : [
      { id: 'uva', nombre: 'Uva', puntos: 10 },
      { id: 'manzana', nombre: 'Manzana', puntos: 15 },
      { id: 'sandia', nombre: 'Sandía', puntos: 25 },
    ];
    return {
      // `y` = altura normalizada, 0 = suelo, 1 = techo. Se parte a media altura.
      y: 0.55, vy: 0, t: 0, recorrido: 0, frutas: [], comidas: 0, puntos: 0,
      energia: energiaMax, energiaMax, aleteos: 0, planeando: false,
      picando: false, frenando: false,
      proxima: 0.8, fin: false, motivo: '',
      // Eje lateral: −1 = borde izquierdo de la ruta, 1 = borde derecho.
      x: 0, vx: 0, obstaculos: [], esquivados: 0, choquesObst: 0, proximoObst: 1.6,
      largo, FRUTAS, lateral, conObstaculos,
      /** Progreso del circuito, 0..1. */
      progreso() { return clamp(this.t / largo, 0, 1); },
      /**
       * Avanza el vuelo. `entrada` = { aleteo, fuerza, planeo, giro, piernas }.
       * Devuelve los sucesos del paso.
       */
      paso(dt, entrada) {
        const ev = { comida: null, choque: null, fin: false };
        if (this.fin) { ev.fin = true; return ev; }
        const e = entrada || {};
        this.t += dt;
        this.recorrido += dt;
        this.planeando = !!e.planeo;

        // Giro: la inclinación del torso manda una aceleración lateral, y sin
        // inclinación el cóndor se endereza solo. Sin esa vuelta al centro el
        // vuelo se siente resbaloso y es imposible apuntar a una fruta.
        if (lateral) {
          const giro = clamp(num(e.giro, 0), -1, 1);
          this.vx += giro * giroVel * dt;
          this.vx -= this.vx * clamp(giroFreno * dt, 0, 1);
          this.vx = clamp(this.vx, -1.6, 1.6);
          this.x = clamp(this.x + this.vx * dt, -1, 1);
          if (this.x <= -1 || this.x >= 1) this.vx = 0;
        }

        // Piernas: un cóndor pica juntando las patas al cuerpo y frena
        // abriéndolas. `piernas` va de 1 (juntas) a −1 (abiertas); si la
        // cámara no ve las piernas llega en 0 y el vuelo es el de siempre.
        const piernas = clamp(num(e.piernas, 0), -1, 1);
        this.picando = piernas > 0.45;
        this.frenando = piernas < -0.45;

        // Física: gravedad, empuje del aleteo y freno del planeo.
        if (e.aleteo) {
          this.vy += empuje * clamp(num(e.fuerza, 1), 0.25, 1.4);
          this.aleteos++;
        }
        let g = gravedad;
        if (this.planeando && this.vy < 0) g *= 1 - frenoPlaneo;
        // Picada: juntar las piernas hace caer más rápido, que es como se baja
        // a por una fruta sin gastar un aleteo en volver a subir.
        if (this.picando) g *= 1 + clamp(piernas, 0, 1) * 0.9;
        // Freno: abrirlas frena la caída, aunque no sube.
        if (this.frenando && this.vy < 0) g *= 1 - clamp(-piernas, 0, 1) * 0.55;
        this.vy -= g * dt;
        this.vy = clamp(this.vy, -1.2, 1.2);
        this.y += this.vy * dt;

        // Techo y suelo: los dos cuestan, pero el suelo cuesta más.
        if (this.y >= 1) { this.y = 1; if (this.vy > 0) this.vy = 0; }
        if (this.y <= 0) {
          this.y = 0;
          if (this.vy < 0) {
            this.vy = 0;
            this.energia--;
            ev.choque = 'suelo';
            this.y = 0.18;               // rebote de cortesía para poder seguir
            this.vy = 0.25;
          }
        }

        // Frutas del circuito: aparecen a la derecha y se acercan.
        this.proxima -= dt;
        if (this.proxima <= 0 && this.t < largo - 1.5) {
          this.proxima = cada * (0.75 + azar() * 0.6);
          const tipo = FRUTAS[Math.floor(azar() * FRUTAS.length)] || FRUTAS[0];
          this.frutas.push({
            id: 'f' + Math.round(this.t * 1000) + '-' + Math.round(azar() * 1e6),
            d: 1, alto: 0.12 + azar() * 0.76, tipo,
            lado: lateral ? (azar() * 2 - 1) * 0.8 : 0,
          });
        }
        // Obstáculos de la ruta (solo en la versión con profundidad).
        if (conObstaculos) {
          this.proximoObst -= dt;
          if (this.proximoObst <= 0 && this.t < largo - 2) {
            this.proximoObst = clamp(num(c.obstaculosCada, 2.6), 0.5, 20) * (0.7 + azar() * 0.7);
            const tipo = OBSTACULOS[Math.floor(azar() * OBSTACULOS.length)] || OBSTACULOS[0];
            this.obstaculos.push({
              id: 'o' + Math.round(this.t * 1000) + '-' + Math.round(azar() * 1e6),
              d: 1, alto: 0.1 + azar() * 0.7, lado: (azar() * 2 - 1) * 0.75, tipo,
            });
          }
        }
        const vel = clamp(num(c.velocidad, 0.42), 0.05, 2);
        for (const f of this.frutas) f.d -= vel * dt;
        for (const o of this.obstaculos) o.d -= vel * dt;
        // Se come lo que pasa por la posición del pájaro (d ≈ 0.18). Con eje
        // lateral hay que coincidir además en el costado.
        const cerca = (obj, tolAlto, tolLado) =>
          Math.abs(obj.alto - this.y) < tolAlto && (!lateral || Math.abs(obj.lado - this.x) < tolLado);
        for (const f of this.frutas) {
          if (f.comida || f.perdida) continue;
          if (f.d <= 0.2 && f.d > 0.06 && cerca(f, 0.11, 0.22)) {
            f.comida = true;
            this.comidas++;
            this.puntos += f.tipo.puntos;
            ev.comida = f;
          } else if (f.d <= 0.06) {
            f.perdida = true;
          }
        }
        this.frutas = this.frutas.filter((f) => f.d > -0.15 && !f.comida);
        // Obstáculos: chocan si coinciden en alto y costado al pasar.
        for (const o of this.obstaculos) {
          if (o.resuelto) continue;
          if (o.d <= 0.18 && o.d > 0.04) {
            if (cerca(o, 0.13, 0.2)) {
              o.resuelto = 'choque';
              this.choquesObst++;
              this.energia--;
              ev.choque = 'obstaculo';
              ev.obstaculo = o;
            }
          } else if (o.d <= 0.04) {
            o.resuelto = 'esquivado';
            this.esquivados++;
            this.puntos += Math.round(num(c.puntosEsquivar, 5));
          }
        }
        this.obstaculos = this.obstaculos.filter((o) => o.d > -0.15 && o.resuelto !== 'choque');

        if (this.energia <= 0) { this.fin = true; this.motivo = 'Te quedaste sin energía'; ev.fin = true; }
        else if (this.t >= largo) { this.fin = true; this.motivo = '¡Circuito completado!'; ev.fin = true; }
        return ev;
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.f Juego 7 — "Mete gol" (patada leída por cámara, arquero con vida propia)
  // ══════════════════════════════════════════════════════════════════════
  //
  // La pantalla es el arco visto desde el punto penal. El arquero se mueve de
  // lado a lado de forma continua —nunca "teletransportado"— y se lanza cuando
  // ve venir el balón. La patada del participante se lee con la cámara: la
  // velocidad del pie define la potencia, su componente lateral la dirección y
  // cuánto lo levanta, la altura del disparo.

  const GOL_VB = { w: 1000, h: 1400 };
  const ARCO = { x: 500, y: 470, w: 760, h: 300 };   // marco del arco en pantalla

  /** Coordenadas de disparo (x −1..1, altura 0..1) → punto en el arco. */
  function puntoEnArco(x, altura) {
    return {
      x: ARCO.x + clamp(x, -1.6, 1.6) * (ARCO.w / 2),
      y: ARCO.y + ARCO.h / 2 - clamp(altura, -0.2, 1.4) * ARCO.h,
    };
  }

  /** Resuelve el remate contra la posición del arquero. */
  function resolverRemate(tiro, arqueroX, alcance) {
    const dentro = Math.abs(tiro.x) <= 1 && tiro.altura >= 0 && tiro.altura <= 1;
    if (!dentro) {
      return { gol: false, atajada: false, fuera: true, motivo: Math.abs(tiro.x) > 1 ? 'Se fue desviado' : 'Se fue por arriba' };
    }
    // Al arquero le cuesta más llegar a los balones altos y a los ángulos.
    const efectivo = alcance * (tiro.altura > 0.62 ? 0.62 : 1);
    const atajada = Math.abs(tiro.x - arqueroX) < efectivo;
    return {
      gol: !atajada, atajada, fuera: false,
      motivo: atajada ? '¡Atajó el arquero!' : '¡GOL!',
    };
  }

  /** Arquero dibujado en SVG; `pose` describe qué está haciendo. */
  function Arquero(props) {
    const p = props.pose || {};
    const dive = clamp(num(p.dive, 0), 0, 1);            // 0 = de pie, 1 = estirado
    const lado = num(p.lado, 0) >= 0 ? 1 : -1;
    const paso = Math.sin(num(p.t, 0) * 4) * 6;          // vaivén al desplazarse
    const inclina = dive * 62 * lado;
    const alto = 1 - dive * 0.42;
    return h('g', { transform: 'rotate(' + inclina.toFixed(1) + ') scale(1,' + alto.toFixed(2) + ')' },
      // piernas
      h('line', { x1: -16, y1: 60, x2: -26 - dive * 40 * lado, y2: 150 - dive * 40, stroke: '#1F2937', strokeWidth: 20, strokeLinecap: 'round' }),
      h('line', { x1: 16, y1: 60, x2: 26 + dive * 66 * lado, y2: 150 - dive * 70, stroke: '#1F2937', strokeWidth: 20, strokeLinecap: 'round' }),
      // torso
      h('path', { d: 'M-40 -46 q40 -14 80 0 l-6 108 q-34 12 -68 0 Z', fill: '#F4B400', stroke: '#B58200', strokeWidth: 4 }),
      h('path', { d: 'M-34 6 q34 -10 68 0 l-2 18 q-32 10 -64 0 Z', fill: '#1F2937', opacity: 0.35 }),
      // brazos + guantes (se estiran al lanzarse)
      h('line', {
        x1: -34, y1: -34, x2: -70 - dive * 120 * (lado > 0 ? 0.2 : 1), y2: -50 - dive * 60,
        stroke: '#F4B400', strokeWidth: 18, strokeLinecap: 'round',
      }),
      h('line', {
        x1: 34, y1: -34, x2: 70 + dive * 120 * (lado > 0 ? 1 : 0.2), y2: -50 - dive * 60,
        stroke: '#F4B400', strokeWidth: 18, strokeLinecap: 'round',
      }),
      h('circle', { cx: -70 - dive * 120 * (lado > 0 ? 0.2 : 1), cy: -50 - dive * 60, r: 20, fill: '#2E7D32', stroke: '#1B5E20', strokeWidth: 3 }),
      h('circle', { cx: 70 + dive * 120 * (lado > 0 ? 1 : 0.2), cy: -50 - dive * 60, r: 20, fill: '#2E7D32', stroke: '#1B5E20', strokeWidth: 3 }),
      // cabeza
      h('circle', { cx: 0 + paso * 0.2, cy: -78, r: 26, fill: '#E8B98F', stroke: '#C9925F', strokeWidth: 3 }),
      h('path', { d: 'M-26 -86 q26 -22 52 0 q-4 -22 -26 -22 q-22 0 -26 22 Z', fill: '#3B2416' }));
  }

  function JuegoGol(props) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
    const tiros = clamp(Math.round(num(cfg.tiros, 5)), 1, 15);
    const dificultad = s(cfg.dificultad) || 'media';
    const NIVEL = {
      facil: { alcance: 0.30, reaccion: 0.34, error: 0.55 },
      media: { alcance: 0.38, reaccion: 0.26, error: 0.34 },
      dificil: { alcance: 0.46, reaccion: 0.18, error: 0.18 },
    };

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const detRef = useRef(detectorPatada());
    const faseRef = useRef('intro');
    const calibRef = useRef(0);
    const arqRef = useRef({ x: 0, destino: 0, dive: 0, lado: 1, t: 0, decidido: false });
    const volandoRef = useRef(false);

    const [fase, setFase] = useState('intro');
    const [error, setError] = useState('');
    const [modoTactil, setModoTactil] = useState(false);
    const [guia, setGuia] = useState({ motivo: '', ok: false, progreso: 0, landmarks: null });
    const [arq, setArq] = useState({ x: 0, dive: 0, lado: 1, t: 0 });
    const [balon, setBalon] = useState(null);
    const [remates, setRemates] = useState([]);
    const [ultimo, setUltimo] = useState(null);
    const [gesto, setGesto] = useState('');

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
      olvidarMotor();
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    }, []);
    useEffect(() => soltarTodo, [soltarTodo]);

    /** Ejecuta el remate: vuelo del balón y resolución contra el arquero. */
    const patear = useCallback((fuerza, lateral, alturaGesto) => {
      if (volandoRef.current || faseRef.current !== 'juego') return;
      volandoRef.current = true;
      detRef.current.reset();
      const N = NIVEL[dificultad] || NIVEL.media;
      const fRef = Math.max(0.5, num(cfg.fuerzaReferencia, 3.0));
      const potencia = clamp(fuerza / fRef, 0.25, 1.6);
      const disp = clamp(num(cfg.dispersion, 0.08), 0, 0.5);
      const tiro = {
        x: clamp(lateral * num(cfg.sensibilidadLateral, 0.55) + (Math.random() * 2 - 1) * disp, -1.5, 1.5),
        altura: clamp(0.18 + alturaGesto * 0.9 + (Math.random() * 2 - 1) * disp * 0.5, -0.1, 1.3),
        potencia: potencia,
      };
      const destino = puntoEnArco(tiro.x, tiro.altura);
      const origen = { x: GOL_VB.w / 2, y: GOL_VB.h - 190 };
      // Más potencia = llega antes: el arquero tiene menos tiempo de reacción.
      const dur = clamp(1250 / potencia, 420, 1700);
      const t0 = nowMs();
      arqRef.current.decidido = false;
      const stop = loop(() => {
        const k = clamp((nowMs() - t0) / dur, 0, 1);
        const A = arqRef.current;
        // El arquero reacciona cuando el balón lleva un tramo recorrido.
        if (!A.decidido && k > N.reaccion) {
          A.decidido = true;
          A.destino = clamp(tiro.x + (Math.random() * 2 - 1) * N.error, -1, 1);
          A.lado = A.destino >= A.x ? 1 : -1;
        }
        setBalon({
          x: origen.x + (destino.x - origen.x) * k,
          y: origen.y + (destino.y - origen.y) * k - Math.sin(k * Math.PI) * 120 * (1 - tiro.altura * 0.5),
          escala: 1 - 0.55 * k,
          k,
        });
        if (k < 1) return;
        stop();
        setBalon(null);
        volandoRef.current = false;
        const A2 = arqRef.current;
        const res = resolverRemate(tiro, A2.x, N.alcance + A2.dive * 0.22);
        setRemates((prev) => {
          const next = prev.concat([Object.assign({ id: uid('r') }, res, { tiro })]);
          setUltimo(next[next.length - 1]);
          if (next.length >= tiros) setT(() => irA('fin'), 1500);
          return next;
        });
        if (res.gol) notify('success', '¡GOL!');
        if (navigator.vibrate) { try { navigator.vibrate(res.gol ? [40, 40, 80] : 25); } catch (e) { /* noop */ } }
        setT(() => { arqRef.current.decidido = false; arqRef.current.destino = 0; }, 700);
      });
    }, [cfg, dificultad, tiros, irA]);

    const iniciar = useCallback(async (modo) => {
      setError('');
      setRemates([]); setUltimo(null);
      detRef.current.reset();
      calibRef.current = 0;
      arqRef.current = { x: 0, destino: 0, dive: 0, lado: 1, t: 0, decidido: false };
      if (modo === 'tactil') { setModoTactil(true); irA('juego'); return; }
      setModoTactil(false);
      irA('abriendo');
      try {
        const prov = await arrancarPose(hw, videoRef, streamRef);
        provRef.current = prov;
        irA('posicion');
      } catch (e) {
        soltarTodo();
        setError(mensajeCamara(e));
        irA('intro');
      }
    }, [hw, irA, soltarTodo]);

    // Bucle: calibración (cuerpo entero, hay que ver los pies), arquero y patada.
    useEffect(() => {
      if (fase !== 'posicion' && fase !== 'juego') return undefined;
      let ultimoHud = 0;
      return loop((dt) => {
        const t = nowMs();
        const prov = provRef.current;
        const lec = prov ? prov.leer() : null;
        const L = lec && lec.landmarks;

        if (faseRef.current === 'posicion') {
          if (prov && prov.tuberia) prov.tuberia.calibrar(L);
          const enc = encuadreDePose(L, 'completo');
          calibRef.current = enc.ok ? calibRef.current + dt : Math.max(0, calibRef.current - dt * 0.6);
          if (t - ultimoHud > 100) {
            ultimoHud = t;
            setGuia({ motivo: enc.motivo, ok: !!enc.ok, progreso: clamp(calibRef.current / 1.8, 0, 1), landmarks: L });
          }
          if (calibRef.current >= 1.8) { detRef.current.reset(); irA('juego'); }
          return;
        }

        // ── Arquero: movimiento continuo, nunca a saltos ───────────────
        const A = arqRef.current;
        A.t += dt;
        if (!volandoRef.current) {
          // De pie: patrulla el arco con un vaivén suave y algo de azar.
          A.destino = Math.sin(A.t * 0.9) * 0.55 + Math.sin(A.t * 0.37) * 0.2;
          A.dive = Math.max(0, A.dive - dt * 2.4);
        } else if (A.decidido) {
          A.dive = Math.min(1, A.dive + dt * 3.2);
        }
        const vel = volandoRef.current ? 4.2 : 1.6;         // se lanza más rápido de lo que patrulla
        A.x += (A.destino - A.x) * clamp(dt * vel, 0, 1);
        A.x = clamp(A.x, -1.05, 1.05);

        if (!modoTactil) {
          const r = detRef.current.actualizar(L, hw.espejo !== false, lec && lec.mundo);
          if (r) patear(r.fuerza, r.lateral, r.altura);
        }

        if (t - ultimoHud > 60) {
          ultimoHud = t;
          setArq({ x: A.x, dive: A.dive, lado: A.lado, t: A.t });
          if (!modoTactil) {
            setGuia((g) => Object.assign({}, g, { landmarks: L }));
            setGesto(L ? detRef.current.estado() : 'no te veo');
          }
        }
      });
    }, [fase, modoTactil, hw.espejo, patear, irA]);

    // Remate táctil: deslizar desde el balón hacia donde se quiere colocar.
    const svgRef = useRef(null);
    const swipeRef = useRef(null);
    const onDown = (e) => {
      if (fase !== 'juego' || !modoTactil || volandoRef.current || !svgRef.current) return;
      swipeRef.current = { p: svgPoint(svgRef.current, e, GOL_VB), t: nowMs() };
    };
    const onUp = (e) => {
      if (!swipeRef.current || !svgRef.current) return;
      const ini = swipeRef.current; swipeRef.current = null;
      const fin = svgPoint(svgRef.current, e, GOL_VB);
      const dy = ini.p.y - fin.y, dx = fin.x - ini.p.x;
      if (dy < 70) return;
      const dt = Math.max(80, nowMs() - ini.t);
      const fRef = Math.max(0.5, num(cfg.fuerzaReferencia, 3.0));
      const fuerza = fRef * clamp((dy / dt) / 1.4, 0.4, 1.8);
      patear(fuerza, clamp(dx / 320, -1.4, 1.4), clamp(dy / 900, 0, 1));
    };

    const goles = remates.filter((r) => r.gol).length;
    const espejo = hw.espejo !== false;
    const videoBox = h('div', { className: 'fp-cam' + (fase === 'intro' || fase === 'fin' ? ' is-hidden' : '') },
      h(CamaraVista, { attach: attachVideo, espejo: espejo, landmarks: guia.landmarks, espacio: model.espacio, imagenKinect: imagenDe(provRef) },
        guia.landmarks ? h(Esqueleto, { landmarks: guia.landmarks, espejo: espejo }) : null),
      fase === 'posicion' ? h(Silueta, { ok: guia.ok }) : null,
      hw.avisoCamara !== false && streamRef.current
        ? h(AvisoCamara, null) : null);

    if (fase === 'intro' || fase === 'abriendo') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-intro' },
          h('svg', { viewBox: '0 0 320 200', className: 'fp-intro-svg fp-intro-svg--ancho' },
            h('rect', { x: 40, y: 30, width: 240, height: 120, rx: 4, fill: 'rgba(255,255,255,.08)', stroke: '#fff', strokeWidth: 6 }),
            h('path', { d: 'M46 36 L274 36 M46 66 L274 66 M46 96 L274 96 M46 126 L274 126 M70 36 L70 144 M110 36 L110 144 M150 36 L150 144 M190 36 L190 144 M230 36 L230 144', stroke: 'rgba(255,255,255,.35)', strokeWidth: 2 }),
            h('g', { transform: 'translate(160,110) scale(0.28)' }, h(Arquero, { pose: { dive: 0, t: 0 } })),
            h('circle', { cx: 160, cy: 178, r: 12, fill: '#fff', stroke: '#111', strokeWidth: 2 })),
          h('h2', null, props.game.blurb || 'Patea y mete gol'),
          h('ul', { className: 'fp-steps' },
            h('li', null, 'La cámara mide tu patada: velocidad = potencia, dirección del pie = colocación.'),
            h('li', null, 'Cuánto levantas el pie decide si el balón va raso o alto.'),
            h('li', null, 'El arquero se mueve todo el tiempo y se lanza cuando ve venir el balón.')),
          error ? h('div', { className: 'fp-error' }, '⚠ ' + error) : null,
          fase === 'abriendo' ? h('p', null, 'Abriendo la cámara…') : h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => iniciar('camara') }, '📷 Patear de verdad'),
            h(Boton, { onClick: () => iniciar('tactil') }, '👆 Deslizar para patear')),
          h('p', { className: 'fp-privacy' },
            '📷 Este juego necesita verte de cuerpo entero, porque mide la pierna. ' +
            'El análisis ocurre en este equipo: no se graba ni se envía video.')),
        videoBox);
    }

    if (fase === 'posicion') {
      return h(Marco, {
        icon: props.game.icon, title: props.game.name,
        onExit: () => { soltarTodo(); props.onExit(); },
        meta: h(Chip, null, 'Paso 1 de 2 · ubicación'),
      },
        h('div', { className: 'fp-pos' },
          h('h2', { className: 'fp-pos-title' }, 'Ubícate para patear'),
          h(ZonaMedioCuerpo, { ok: guia.ok, metros: num(cfg.distanciaMetros, 2.2), nota: 'aquí sí hacen falta las piernas' }),
          h('div', { className: 'fp-pos-cam' },
            videoBox,
            h('div', { className: 'fp-calib' },
              h('b', null, guia.ok ? '¡Listo! No te muevas…' : 'Ubícate frente a la cámara'),
              h('span', null, guia.motivo || 'Buscando a la persona…'),
              h('div', { className: 'fp-progress' }, h('i', { style: { width: (guia.progreso * 100).toFixed(0) + '%' } })))),
          h('p', { className: 'fp-hint' },
            'Deben verse tus pies: la patada se mide con la pierna. Deja espacio para el swing.')));
    }

    if (fase === 'fin') {
      const p10 = clamp((goles / Math.max(1, remates.length)) * 10, 0, 10);
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: () => { soltarTodo(); props.onExit(); }, meta: null },
        h(Resultado, {
          puntaje10: p10, juego: props.game.name,
          titulo: goles === remates.length ? '¡Tanda perfecta!' : goles ? '¡' + goles + ' gol(es)!' : 'Se lució el arquero',
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, goles + '/' + remates.length + ' goles'),
            h(Chip, null, remates.filter((r) => r.atajada).length + ' atajadas'),
            h(Chip, null, remates.filter((r) => r.fuera).length + ' afuera')),
          detalleTexto: goles + ' de ' + remates.length + ' penales',
          onExit: () => { soltarTodo(); props.onExit(); },
          onReplay: () => {
            setRemates([]); setUltimo(null); detRef.current.reset();
            irA(modoTactil || !provRef.current ? 'juego' : 'posicion');
            calibRef.current = 0;
          },
        }));
    }

    const arqueroPos = puntoEnArco(arq.x, 0);
    const temaG = themeOf(model);
    const escG = escenaDe(temaG), fGo = facetas(temaG.accent), fGo2 = facetas(temaG.accent2);
    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, null, 'Tiro ' + Math.min(remates.length + 1, tiros) + '/' + tiros),
        h(Chip, { tone: 'accent' }, goles + ' gol(es)'),
        !modoTactil ? h(Chip, null, '🦵 ' + (gesto || '…')) : null),
    },
      h('div', { className: 'fp-gol-wrap' },
        h('svg', {
          ref: svgRef, className: 'fp-gol-svg', viewBox: '0 0 1000 1400',
          onPointerDown: onDown, onPointerUp: onUp, onPointerCancel: onUp,
        },
          h(LienzoDC, { gid: 'fp-gol-vb', w: 1000, h: 1400 },
          // Estadio: cielo, galería con público y cancha rayada en fuga.
          h(CieloDC, {
            w: 1000, h: 1400, horizonte: 360, gid: 'fp-gol',
            alto: escG.cielo, bajo: escG.cieloBajo, solX: 810, solColor: escG.sol,
            nubes: [{ x: 700, y: 120, r: 30 }],
          }),
          // Galería: bloque con bisel arriba y su marea de camisetas.
          h('rect', { y: 176, width: 1000, height: 190, fill: '#1B2438' }),
          h('rect', { y: 176, width: 1000, height: 10, fill: 'rgba(255,255,255,.28)' }),
          h('rect', { y: 356, width: 1000, height: 10, fill: 'rgba(0,0,0,.45)' }),
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => h('g', { key: 'p' + i },
            h('circle', { cx: 40 + i * 84, cy: 250 + (i % 3) * 34, r: 16, fill: i % 2 ? fGo.base : fGo2.base, opacity: 0.85 }),
            h('circle', { cx: 34 + i * 84, cy: 244 + (i % 3) * 34, r: 5, fill: '#fff', opacity: 0.3 }))),
          // La cancha huye hacia el arco: es lo que da la sensación de patear
          // hacia adentro de la pantalla y no hacia un telón.
          h(SueloDC, { w: 1000, h: 1400, horizonte: 366, color: '#4E9B3E', fugaX: 500, filas: 9, lineas: 13, bruma: 'rgba(255,255,255,.2)' }),
          // área
          h('path', { d: 'M120 700 L880 700 L960 1000 L40 1000 Z', fill: 'none', stroke: 'rgba(255,255,255,.6)', strokeWidth: 6 }),
          // arco
          h('g', null,
            h('rect', {
              x: ARCO.x - ARCO.w / 2 - 10, y: ARCO.y - ARCO.h / 2 - 10,
              width: ARCO.w + 20, height: ARCO.h + 20, fill: 'rgba(255,255,255,.06)',
            }),
            h('g', { stroke: 'rgba(255,255,255,.45)', strokeWidth: 2 },
              [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => h('line', {
                key: 'v' + i, x1: ARCO.x - ARCO.w / 2 + i * (ARCO.w / 12), y1: ARCO.y - ARCO.h / 2,
                x2: ARCO.x - ARCO.w / 2 + i * (ARCO.w / 12), y2: ARCO.y + ARCO.h / 2,
              })),
              [0, 1, 2, 3, 4, 5, 6].map((i) => h('line', {
                key: 'h' + i, x1: ARCO.x - ARCO.w / 2, y1: ARCO.y - ARCO.h / 2 + i * (ARCO.h / 6),
                x2: ARCO.x + ARCO.w / 2, y2: ARCO.y - ARCO.h / 2 + i * (ARCO.h / 6),
              }))),
            h('path', {
              d: 'M' + (ARCO.x - ARCO.w / 2) + ' ' + (ARCO.y + ARCO.h / 2) +
                 ' L' + (ARCO.x - ARCO.w / 2) + ' ' + (ARCO.y - ARCO.h / 2) +
                 ' L' + (ARCO.x + ARCO.w / 2) + ' ' + (ARCO.y - ARCO.h / 2) +
                 ' L' + (ARCO.x + ARCO.w / 2) + ' ' + (ARCO.y + ARCO.h / 2),
              fill: 'none', stroke: '#fff', strokeWidth: 14, strokeLinecap: 'round',
            })),
          // arquero
          h('g', { transform: 'translate(' + arqueroPos.x.toFixed(1) + ',' + (ARCO.y + ARCO.h / 2 - 60) + ')' },
            h(Arquero, { pose: arq })),
          // balón
          balon
            ? h('g', { transform: 'translate(' + balon.x.toFixed(1) + ',' + balon.y.toFixed(1) + ') scale(' + balon.escala.toFixed(2) + ')' },
                h('circle', { r: 38, fill: '#fff', stroke: '#111827', strokeWidth: 4 }),
                h('path', { d: 'M0 -20 L18 -6 L11 16 L-11 16 L-18 -6 Z', fill: '#111827' }))
            : h('g', { transform: 'translate(500,' + (GOL_VB.h - 190) + ')' },
                h('ellipse', { cx: 0, cy: 44, rx: 46, ry: 14, fill: 'rgba(0,0,0,.3)' }),
                h('circle', { r: 40, fill: '#fff', stroke: '#111827', strokeWidth: 5 }),
                h('path', { d: 'M0 -21 L19 -7 L12 17 L-12 17 L-19 -7 Z', fill: '#111827' })),
          ultimo && !balon ? h('g', { transform: 'translate(500,1075)' },
            h('rect', { x: -296, y: -42, width: 600, height: 92, rx: 8, fill: 'rgba(0,0,0,.4)' }),
            h('rect', { x: -300, y: -46, width: 600, height: 92, rx: 8, fill: '#0C1424', stroke: '#fff', strokeWidth: 4 }),
            h('rect', { x: -300, y: -46, width: 600, height: 8, fill: 'rgba(255,255,255,.34)' }),
            h('text', { textAnchor: 'middle', y: 12, className: 'fp-ray-aviso' }, ultimo.motivo)) : null)),
        !modoTactil ? h('div', { className: 'fp-ray-cam' },
          h('video', { ref: attachVideo, className: 'fp-video' + (espejo ? ' is-mirror' : ''), autoPlay: true, playsInline: true, muted: true }),
          hw.avisoCamara !== false ? h(AvisoCamara, null) : null) : null,
        h('p', { className: 'fp-hint' },
          modoTactil
            ? 'Desliza desde el balón hacia donde quieras colocarlo: más rápido, más potencia.'
            : 'Patea con la pierna: la velocidad manda la potencia y el pie decide la dirección.')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.g Juegos 8 y 9 — "Esquiva y gana" (2D lateral y 3D en profundidad)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Los dos comparten motor: una pista de obstáculos que se acercan y un
  // avatar que solo puede SALTAR o AGACHARSE. Cambia el punto de vista:
  //   · 2D  — carrera lateral con salto y agachada: el avatar avanza a
  //           la derecha y los obstáculos entran por el costado.
  //   · 3D  — vista en profundidad: los obstáculos vienen de frente y el
  //           avatar es el CONTORNO VERDE del cuerpo del participante, con el
  //           interior transparente para no tapar lo que se acerca.
  // Control por cámara con medio cuerpo (salto = hombros arriba, agacharse =
  // hombros abajo) y respaldo táctil o de teclado.

  const OBST = {
    bajo: { accion: 'saltar', nombre: 'Salta' },
    alto: { accion: 'agachar', nombre: 'Agáchate' },
    // Los laterales solo aparecen en la versión 3D, donde se corre HACIA la
    // pantalla y correrse a un lado es un movimiento que significa algo. En la
    // vista lateral 2D no hay a dónde esquivar: el cuerpo ya está de perfil.
    izquierda: { accion: 'izquierda', nombre: 'Muévete a la izquierda' },
    derecha: { accion: 'derecha', nombre: 'Muévete a la derecha' },
  };

  /**
   * Motor de la pista. `d` es la distancia que le falta a cada obstáculo para
   * llegar al avatar (1 = recién aparecido, 0 = encima).
   */
  function motorEsquiva(cfg) {
    const base = clamp(num(cfg.velocidad, 0.42), 0.1, 2);
    const acel = clamp(num(cfg.aceleracion, 0.02), 0, 0.3);
    const cada = clamp(num(cfg.cadaSegundos, 1.6), 0.6, 5);
    // Con laterales activados hay que correrse de verdad, no solo saltar y
    // agacharse: es lo que convierte el juego en algo de cuerpo entero.
    const tipos = cfg.lateral
      ? ['bajo', 'bajo', 'alto', 'alto', 'izquierda', 'derecha']
      : ['bajo', 'alto'];
    return {
      obstaculos: [], distancia: 0, vidas: Math.max(1, Math.round(num(cfg.vidas, 3))),
      esquivados: 0, choques: 0, t: 0, proximo: 1.2, invulnerable: 0,
      velocidad() { return base + this.t * acel * 0.05; },
      /**
       * Avanza la pista. `estado` es 'saltar' | 'agachar' | null.
       * Devuelve los eventos ocurridos en este paso.
       */
      paso(dt, estado) {
        const ev = { choque: null, esquivado: null, fin: false };
        this.t += dt;
        const v = this.velocidad();
        this.distancia += v * dt * 100;
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.proximo -= dt;
        if (this.proximo <= 0) {
          const tipo = tipos[Math.floor(Math.random() * tipos.length)];
          this.obstaculos.push({ id: uid('ob'), tipo, d: 1, resuelto: false });
          this.proximo = cada * (0.7 + Math.random() * 0.6) / Math.max(0.3, v / 0.42);
        }
        for (const o of this.obstaculos) {
          o.d -= v * dt;
          if (o.resuelto || o.d > 0.06) continue;
          // Ventana de contacto: se evalúa una sola vez por obstáculo.
          o.resuelto = true;
          const correcto = OBST[o.tipo].accion;
          if (estado === correcto) { this.esquivados++; ev.esquivado = o; }
          else if (this.invulnerable > 0) { ev.esquivado = o; }
          else {
            this.choques++; this.vidas--; this.invulnerable = 1.2;
            ev.choque = o;
            if (this.vidas <= 0) ev.fin = true;
          }
        }
        this.obstaculos = this.obstaculos.filter((o) => o.d > -0.25);
        return ev;
      },
      puntaje() { return Math.round(this.distancia) + this.esquivados * 25; },
    };
  }

  /** Contorno del cuerpo del participante (versión 3D): perímetro verde. */
  function ContornoCuerpo(props) {
    const L = props.landmarks;
    const W = props.w, H = props.h;
    const espejo = props.espejo;
    const px = (i, dx, dy) => {
      const p = L && L[i];
      if (!p) return null;
      return { x: ((espejo ? 1 - p.x : p.x) + (dx || 0)) * W, y: (p.y + (dy || 0)) * H };
    };
    // Perímetro: hombro I → muñeca I → cadera I → tobillo I → tobillo D → …
    const orden = [
      [IDX.hombroI, -0.03, -0.02], [IDX.codoI, -0.03, 0], [IDX.munecaI, -0.03, 0.01],
      [IDX.codoI, -0.01, 0.03], [IDX.caderaI, -0.03, 0], [IDX.rodillaI, -0.03, 0],
      [IDX.tobilloI, -0.02, 0.02], [IDX.tobilloD, 0.02, 0.02], [IDX.rodillaD, 0.03, 0],
      [IDX.caderaD, 0.03, 0], [IDX.codoD, 0.01, 0.03], [IDX.munecaD, 0.03, 0.01],
      [IDX.codoD, 0.03, 0], [IDX.hombroD, 0.03, -0.02],
    ];
    const pts = orden.map(([i, dx, dy]) => px(i, dx, dy)).filter(Boolean);
    if (pts.length < 6) return null;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') + ' Z';
    const cabeza = px(IDX.nariz, 0, -0.02);
    return h('g', { className: 'fp-contorno' },
      h('path', {
        d: d, fill: 'rgba(74,222,128,.10)', stroke: '#4ADE80', strokeWidth: 6,
        strokeLinejoin: 'round', strokeLinecap: 'round',
      }),
      cabeza ? h('circle', { cx: cabeza.x, cy: cabeza.y, r: H * 0.055, fill: 'rgba(74,222,128,.10)', stroke: '#4ADE80', strokeWidth: 6 }) : null);
  }

  /** Avatar 2D estilo plataformas. `accion`: correr | saltar | agachar. */
  function AvatarRunner(props) {
    const a = props.accion, t = num(props.t, 0);
    const paso = Math.sin(t * 14) * 22;
    const agachado = a === 'agachar';
    const salto = a === 'saltar';
    const alto = agachado ? 0.6 : 1;
    return h('g', { transform: 'scale(1,' + alto + ')', opacity: props.parpadeo ? 0.45 : 1 },
      // piernas
      salto
        ? h('g', { stroke: '#1F2937', strokeWidth: 20, strokeLinecap: 'round' },
            h('line', { x1: -14, y1: 60, x2: -44, y2: 96 }),
            h('line', { x1: 14, y1: 60, x2: 42, y2: 84 }))
        : h('g', { stroke: '#1F2937', strokeWidth: 20, strokeLinecap: 'round' },
            h('line', { x1: -10, y1: 60, x2: -10 + paso, y2: 120 }),
            h('line', { x1: 10, y1: 60, x2: 10 - paso, y2: 120 })),
      // torso con camiseta tricolor
      h('path', { d: 'M-40 -40 q40 -14 80 0 l-6 104 q-34 12 -68 0 Z', fill: '#D52B1E', stroke: '#8E1B1B', strokeWidth: 4 }),
      h('path', { d: 'M-36 6 q36 -10 72 0 l-2 16 q-34 10 -68 0 Z', fill: '#fff' }),
      h('path', { d: 'M-35 22 q36 -10 70 0 l-2 16 q-33 10 -66 0 Z', fill: '#0039A6' }),
      // brazos
      h('line', {
        x1: -34, y1: -26, x2: salto ? -84 : -54 - paso * 0.6, y2: salto ? -66 : 24,
        stroke: '#E8B98F', strokeWidth: 17, strokeLinecap: 'round',
      }),
      h('line', {
        x1: 34, y1: -26, x2: salto ? 84 : 54 + paso * 0.6, y2: salto ? -66 : 24,
        stroke: '#E8B98F', strokeWidth: 17, strokeLinecap: 'round',
      }),
      // cabeza
      h('circle', { cx: 0, cy: -72, r: 30, fill: '#E8B98F', stroke: '#C9925F', strokeWidth: 4 }),
      h('circle', { cx: 12, cy: -78, r: 5, fill: '#1F2937' }),
      h('path', { d: 'M-30 -92 q30 -26 60 -4 q-6 -26 -30 -26 q-26 0 -30 30 Z', fill: '#3B2416' }));
  }

  /** Base común de los dos "Esquiva y gana": cámara, control y bucle. */
  function usarEsquiva(props, opciones) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const detRef = useRef(detectorSaltoAgacharse());
    const cuerpoRef = useRef(seguidorCuerpo());
    const faseRef = useRef('intro');
    const pistaRef = useRef(null);
    const accionRef = useRef({ accion: null, hasta: 0 });
    // En la vista 3D se corre HACIA la pantalla, así que correrse a un lado
    // es un movimiento con sentido y aparecen obstáculos laterales.
    const conLateral = !!(opciones && opciones.lateral);

    const [fase, setFase] = useState('intro');
    const [error, setError] = useState('');
    const [modoTactil, setModoTactil] = useState(false);
    const [hud, setHud] = useState({ vidas: 3, puntos: 0, accion: null, aviso: '', calibrando: true, t: 0 });
    const [obstaculos, setObstaculos] = useState([]);
    const [landmarks, setLandmarks] = useState(null);
    const [contorno, setContorno] = useState(null);   // silueta real (segmentación)
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
      olvidarMotor();
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    }, []);
    useEffect(() => soltarTodo, [soltarTodo]);

    const iniciar = useCallback(async (modo) => {
      setError(''); setFin(null);
      detRef.current.reset();
      cuerpoRef.current.reset();
      pistaRef.current = motorEsquiva(Object.assign({}, cfg, { lateral: conLateral }));
      if (modo === 'tactil') { setModoTactil(true); irA('juego'); return; }
      setModoTactil(false);
      irA('abriendo');
      try {
        const prov = await arrancarPose(hw, videoRef, streamRef);
        provRef.current = prov;
        irA('juego');
      } catch (e) {
        soltarTodo();
        setError(mensajeCamara(e));
        irA('intro');
      }
    }, [cfg, hw, irA, soltarTodo]);

    /** Acción por toque o tecla: dura un instante, como un salto real. */
    const accionar = useCallback((accion) => {
      accionRef.current = { accion, hasta: nowMs() + (accion === 'saltar' ? 620 : 700) };
    }, []);

    useEffect(() => {
      if (fase !== 'juego') return undefined;
      const onTecla = (e) => {
        if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') accionar('saltar');
        if (e.key === 'ArrowDown' || e.key === 's') accionar('agachar');
      };
      window.addEventListener('keydown', onTecla);
      return () => window.removeEventListener('keydown', onTecla);
    }, [fase, accionar]);

    useEffect(() => {
      if (fase !== 'juego') return undefined;
      let ultimoHud = 0;
      return loop((dt) => {
        const P = pistaRef.current;
        if (!P) return;
        const t = nowMs();
        let accion = null, calibrando = false, lateral = 0, fuente = '', visibilidadCuerpo = '';
        if (modoTactil) {
          if (accionRef.current.hasta > t) accion = accionRef.current.accion;
        } else {
          const prov = provRef.current;
          const lec = prov ? prov.leer() : null;
          const L = lec && lec.landmarks;
          const cuerpo = cuerpoRef.current.actualizar(L, dt, hw.espejo !== false, lec && lec.mundo);
          const r = detRef.current.actualizar(L, dt, lec && lec.kinect, cuerpo);
          accion = r.accion;
          calibrando = r.calibrando || cuerpo.calibrando;
          fuente = r.fuente;
          visibilidadCuerpo = cuerpo.visibilidadCuerpo;
          // Saltar y agacharse mandan sobre el paso: si alguien salta mientras
          // se corre, lo que quiso hacer fue saltar.
          if (!accion && conLateral && cuerpo.visible && !cuerpo.calibrando) {
            if (cuerpo.pasoLateral > 0.42) accion = 'derecha';
            else if (cuerpo.pasoLateral < -0.42) accion = 'izquierda';
          }
          lateral = cuerpo.pasoLateral;
          if (accionRef.current.hasta > t) accion = accionRef.current.accion;   // respaldo táctil siempre activo
          if (t - ultimoHud > 60) {
            setLandmarks(L);
            if (lec && lec.contorno) setContorno(lec.contorno);
          }
        }
        const ev = calibrando ? { choque: null, esquivado: null, fin: false } : P.paso(dt, accion);
        if (ev.choque && navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* noop */ } }
        if (ev.fin) {
          setFin({ puntos: P.puntaje(), esquivados: P.esquivados, choques: P.choques, distancia: Math.round(P.distancia) });
          irA('fin');
          return;
        }
        if (t - ultimoHud > 55) {
          ultimoHud = t;
          setObstaculos(P.obstaculos.slice());
          setHud({
            vidas: P.vidas, puntos: P.puntaje(), accion: accion,
            lateral: lateral, fuente: fuente, visibilidadCuerpo: visibilidadCuerpo,
            aviso: calibrando ? 'Quédate quieto un segundo para calibrar…' : '',
            calibrando: calibrando, t: P.t,
            invulnerable: P.invulnerable > 0,
          });
        }
      });
    }, [fase, modoTactil, irA]);

    return {
      cfg, hw, fase, error, modoTactil, hud, obstaculos, landmarks, contorno, fin,
      iniciar, accionar, soltarTodo, irA, attachVideo, streamRef, provRef, detRef, pistaRef,
      reiniciar: () => {
        pistaRef.current = motorEsquiva(Object.assign({}, cfg, { lateral: conLateral }));
        detRef.current.reset();
        setFin(null); setObstaculos([]);
        irA('juego');
      },
    };
  }

  /** Pantallas comunes (intro y resultado) de los dos "Esquiva y gana". */
  function marcoEsquiva(props, E, extra) {
    const espejo = E.hw.espejo !== false;
    const videoBox = h('div', { className: 'fp-cam' + (E.fase === 'intro' || E.fase === 'fin' ? ' is-hidden' : '') },
      h(CamaraVista, { attach: E.attachVideo, espejo: espejo, landmarks: E.landmarks, espacio: model.espacio, imagenKinect: imagenDe(E.provRef) }),
      E.hw.avisoCamara !== false && E.streamRef.current
        ? h(AvisoCamara, null) : null);

    if (E.fase === 'intro' || E.fase === 'abriendo') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-intro' },
          extra.arte,
          h('h2', null, props.game.blurb || 'Salta y agáchate para esquivar'),
          h('ul', { className: 'fp-steps' },
            h('li', null, h('b', null, 'Salta'), ' para pasar los obstáculos bajos.'),
            h('li', null, h('b', null, 'Agáchate'), ' para pasar por debajo de los altos.'),
            h('li', null, 'Con cámara basta el medio cuerpo: se mide la altura de tus hombros.')),
          E.error ? h('div', { className: 'fp-error' }, '⚠ ' + E.error) : null,
          E.fase === 'abriendo' ? h('p', null, 'Abriendo la cámara…') : h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => E.iniciar('camara') }, '📷 Jugar con el cuerpo'),
            h(Boton, { onClick: () => E.iniciar('tactil') }, '👆 Jugar con botones')),
          h('p', { className: 'fp-privacy' },
            '📷 Solo se necesita ver tu torso y tu cabeza. El análisis ocurre en este equipo: no se graba ni se envía video.')),
        videoBox);
    }

    if (E.fase === 'fin' && E.fin) {
      const meta = Math.max(200, num(E.cfg.metaPuntos, 900));
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: () => { E.soltarTodo(); props.onExit(); }, meta: null },
        h(Resultado, {
          puntaje10: clamp((E.fin.puntos / meta) * 10, 0, 10),
          juego: props.game.name,
          titulo: E.fin.esquivados > 12 ? '¡Qué reflejos!' : '¡Buena carrera!',
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, E.fin.puntos + ' puntos'),
            h(Chip, null, E.fin.esquivados + ' esquivados'),
            h(Chip, null, E.fin.choques + ' choques')),
          detalleTexto: E.fin.puntos + ' pts · ' + E.fin.esquivados + ' obstáculos esquivados',
          onExit: () => { E.soltarTodo(); props.onExit(); },
          onReplay: E.reiniciar,
        }));
    }
    return null;
  }

  /** Botones de control comunes (respaldo táctil, siempre disponibles). */
  function botonesEsquiva(E) {
    return h('div', { className: 'fp-esq-botones' },
      h(Boton, { variant: 'primary', onClick: () => E.accionar('saltar') }, '⬆️ Saltar'),
      h(Boton, { variant: 'primary', onClick: () => E.accionar('agachar') }, '⬇️ Agacharse'));
  }

  const ESQ_VB = { w: 1000, h: 1000 };

  // ── Juego 8: versión 2D lateral ──────────────────────────────────────
  function JuegoEsquiva2D(props) {
    const E = usarEsquiva(props, {});
    const comun = marcoEsquiva(props, E, {
      arte: h('svg', { viewBox: '0 0 320 180', className: 'fp-intro-svg fp-intro-svg--ancho' },
        h('rect', { width: 320, height: 180, fill: '#7EC0EE' }),
        h('path', { d: 'M0 130 L320 130 L320 180 L0 180 Z', fill: '#5EA347' }),
        h('g', { transform: 'translate(90,130) scale(0.32)' }, h(AvatarRunner, { accion: 'saltar', t: 0 })),
        h('rect', { x: 200, y: 96, width: 30, height: 34, fill: '#8B5E34', stroke: '#5E3B18', strokeWidth: 3 }),
        h('rect', { x: 262, y: 40, width: 40, height: 22, fill: '#8B5E34', stroke: '#5E3B18', strokeWidth: 3 })),
    });
    if (comun) return comun;

    const suelo = 760;
    const temaE = themeOf(model);
    const escE = escenaDe(temaE);
    const fCe = facetas(escE.cerros), fPa = facetas(escE.suelo);
    const accion = E.hud.accion;
    // El avatar se dibuja con los pies 120 unidades bajo su origen (60 si va
    // agachado, porque se comprime): así queda siempre parado en el suelo.
    const pies = accion === 'agachar' ? 72 : 120;
    const yAvatar = suelo - pies - (accion === 'saltar' ? 190 : 0);
    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { E.soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, { tone: 'accent' }, E.hud.puntos + ' pts'),
        h(Chip, null, '❤️'.repeat(Math.max(0, E.hud.vidas)) || 'sin vidas'),
        accion ? h(Chip, { tone: 'ok' },
          accion === 'saltar' ? '⬆️ salto'
            : accion === 'agachar' ? '⬇️ agachado'
              : accion === 'izquierda' ? '⬅️ a la izquierda' : '➡️ a la derecha') : null,
        E.hud.visibilidadCuerpo === 'completo' ? h(Chip, null, '🦵 cuerpo entero') : null),
    },
      h('div', { className: 'fp-esq-wrap' },
        h('svg', { className: 'fp-esq-svg', viewBox: '0 0 1000 1000', preserveAspectRatio: 'xMidYMid slice' },
          h(CieloDC, {
            w: 1000, h: 1000, horizonte: 700, gid: 'fp-esq2d',
            alto: escE.cielo, bajo: escE.cieloBajo, sol: false,
          }),
          // Parallax de dos capas: los cerros lejanos se mueven despacio y los
          // cercanos más rápido. Es lo que da profundidad en una vista lateral.
          h('g', { transform: 'translate(' + (-(E.hud.t * 26) % 1000) + ',0)', opacity: 0.75 },
            [0, 1].map((k) => h('g', { key: k, transform: 'translate(' + k * 1000 + ',0)' },
              h(CerrosDC, { w: 1000, horizonte: 700, color: fCe.sombra, alto: 250, picos: [[0.2, 0.9], [0.6, 1], [0.9, 0.75]] })))),
          h('g', { transform: 'translate(' + (-(E.hud.t * 55) % 1000) + ',0)' },
            [0, 1].map((k) => h('g', { key: k, transform: 'translate(' + k * 1000 + ',0)' },
              h(CerrosDC, { w: 1000, horizonte: 700, color: escE.cerros, alto: 165, picos: [[0.1, 0.8], [0.45, 1], [0.8, 0.85]] }),
              h('ellipse', { cx: 180, cy: 190, rx: 90, ry: 40, fill: 'rgba(255,255,255,.85)' }),
              h('ellipse', { cx: 640, cy: 130, rx: 110, ry: 44, fill: 'rgba(255,255,255,.8)' })))),
          // Pasto: cara superior clara y frente en sombra, como un bloque.
          h('rect', { y: 700, width: 1000, height: 300, fill: fPa.sombra }),
          h('rect', { y: 700, width: 1000, height: 40, fill: fPa.luz }),
          h('rect', { y: 740, width: 1000, height: 10, fill: fPa.linea }),
          // Textura del suelo en movimiento: marca la velocidad de la carrera.
          h('g', { transform: 'translate(' + (-(E.hud.t * 320) % 200) + ',0)' },
            [0, 1, 2, 3, 4, 5, 6].map((i) => h('rect', {
              key: i, x: i * 200, y: 762, width: 120, height: 12, rx: 6, fill: 'rgba(0,0,0,.18)',
            }))),
          // obstáculos: los bajos en el suelo, los altos colgando
          E.obstaculos.map((o) => {
            const x = 260 + o.d * 900;
            return o.tipo === 'bajo'
              ? h('g', { key: o.id, transform: 'translate(' + x.toFixed(0) + ',' + suelo + ')' },
                  h(SombraDC, { cx: 0, cy: 6, rx: 54, ry: 12 }),
                  h(CajaDC, { x: -46, y: -108, w: 92, h: 108, p: 22, color: '#9A6A3C', linea: 6 }),
                  h('path', { d: 'M-46 -70 L46 -70 M-46 -36 L46 -36', stroke: '#4E2E12', strokeWidth: 4 }))
              // El obstáculo alto cuelga desde arriba: se pasa agachándose.
              : h('g', { key: o.id, transform: 'translate(' + x.toFixed(0) + ',' + (suelo - 250) + ')' },
                  h(CajaDC, { x: -56, y: -(suelo - 250), w: 112, h: suelo - 250 + 12, p: 24, color: '#8A5528', linea: 6 }),
                  h('path', { d: 'M-56 -60 L56 -60 M-56 -160 L56 -160', stroke: '#4E2E12', strokeWidth: 5 }));
          }),
          // avatar
          h('g', {
            transform: 'translate(260,' + yAvatar + ')',
            style: { transition: 'none' },
          }, h(AvatarRunner, { accion: accion || 'correr', t: E.hud.t, parpadeo: E.hud.invulnerable })),
          E.hud.aviso
            ? h('text', { x: 500, y: 340, textAnchor: 'middle', className: 'fp-svg-label' }, E.hud.aviso)
            : null),
        !E.modoTactil ? h('div', { className: 'fp-ray-cam' },
          h('video', { ref: E.attachVideo, className: 'fp-video is-mirror', autoPlay: true, playsInline: true, muted: true }),
          h(AvisoCamara, null)) : null,
        botonesEsquiva(E),
        h('p', { className: 'fp-hint' },
          E.modoTactil
            ? 'Usa los botones (o las flechas ↑ y ↓ del teclado) para saltar y agacharte.'
            : 'Salta y agáchate de verdad: se mide la altura de tus hombros. Los botones siguen disponibles.')));
  }

  // ── Juego 9: versión 3D en profundidad ───────────────────────────────
  function JuegoEsquiva3D(props) {
    const E = usarEsquiva(props, { lateral: true });
    const comun = marcoEsquiva(props, E, {
      arte: h('svg', { viewBox: '0 0 320 180', className: 'fp-intro-svg fp-intro-svg--ancho' },
        h('rect', { width: 320, height: 180, fill: '#0E1729' }),
        h('path', { d: 'M160 60 L40 180 M160 60 L280 180 M0 180 L320 180', stroke: '#2C3E63', strokeWidth: 3 }),
        h('rect', { x: 120, y: 70, width: 80, height: 18, fill: 'rgba(213,43,30,.5)', stroke: '#D52B1E', strokeWidth: 2 }),
        h('rect', { x: 96, y: 128, width: 128, height: 22, fill: 'rgba(213,43,30,.35)', stroke: '#D52B1E', strokeWidth: 2 }),
        h('path', { d: 'M160 96 a16 16 0 1 1 0 1 M136 176 q2 -50 24 -54 q22 4 24 54', fill: 'none', stroke: '#4ADE80', strokeWidth: 4 })),
    });
    if (comun) return comun;

    const accion = E.hud.accion;
    const desplazo = accion === 'saltar' ? -140 : accion === 'agachar' ? 120 : 0;
    // El cuerpo se corre en pantalla lo mismo que se corrió la persona: sin
    // esto, esquivar de lado se siente como apretar un botón invisible.
    const desplazoX = clamp(num(E.hud.lateral, 0), -1, 1) * 170;
    // Proyección: un obstáculo lejano es chico y está arriba; cerca es grande.
    const proyectar = (d) => {
      const z = clamp(d, 0, 1);
      const escala = 0.18 + (1 - z) * 1.5;
      return { escala, y: 300 + (1 - z) * (1 - z) * 620 };
    };
    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { E.soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, { tone: 'accent' }, E.hud.puntos + ' pts'),
        h(Chip, null, '❤️'.repeat(Math.max(0, E.hud.vidas)) || 'sin vidas'),
        accion ? h(Chip, { tone: 'ok' },
          accion === 'saltar' ? '⬆️ salto'
            : accion === 'agachar' ? '⬇️ agachado'
              : accion === 'izquierda' ? '⬅️ a la izquierda' : '➡️ a la derecha') : null,
        E.hud.visibilidadCuerpo === 'completo' ? h(Chip, null, '🦵 cuerpo entero') : null),
    },
      h('div', { className: 'fp-esq-wrap' },
        h('svg', { className: 'fp-esq3d-svg', viewBox: '0 0 1000 1000', preserveAspectRatio: 'xMidYMid slice' },
          h(LienzoDC, { gid: 'fp-esq3d-vb', w: 1000, h: 1000 },
          h('defs', null,
            h('linearGradient', { id: 'fp-tunel', x1: 0, y1: 0, x2: 0, y2: 1 },
              h('stop', { offset: '0%', stopColor: '#07101F' }),
              h('stop', { offset: '62%', stopColor: '#16294D' }),
              h('stop', { offset: '100%', stopColor: '#28477A' }))),
          h('rect', { width: 1000, height: 1000, fill: 'url(#fp-tunel)' }),
          // Resplandor en el punto de fuga: el túnel tiene un fondo hacia el
          // que se corre, no un vacío.
          h('circle', { cx: 500, cy: 300, r: 210, fill: '#7CFFB2', opacity: 0.1 }),
          h('circle', { cx: 500, cy: 300, r: 95, fill: '#7CFFB2', opacity: 0.14 }),
          // Pista con dos caras: el piso claro y las paredes laterales.
          h('path', { d: 'M500 300 L-120 1000 L1120 1000 Z', fill: '#16223C' }),
          h('path', { d: 'M500 300 L-120 1000 L-420 1000 Z', fill: '#0D1730' }),
          h('path', { d: 'M500 300 L1120 1000 L1420 1000 Z', fill: '#0D1730' }),
          // Travesaños que huyen: son los que dan la velocidad de avance.
          h('g', { stroke: 'rgba(124,255,178,.3)', strokeWidth: 3 },
            [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const k = ((E.hud.t * 0.55 + i / 8) % 1);
              const p = proyectar(1 - k);
              const ancho = 40 + k * 1100;
              return h('line', { key: 'l' + i, x1: 500 - ancho / 2, y1: p.y, x2: 500 + ancho / 2, y2: p.y, strokeWidth: 2 + k * 5 });
            })),
          h('path', { d: 'M500 300 L-120 1000 M500 300 L1120 1000', stroke: '#7CFFB2', strokeWidth: 5, opacity: 0.55 }),
          // obstáculos que se acercan
          E.obstaculos.slice().sort((a, b) => b.d - a.d).map((o) => {
            const p = proyectar(o.d);
            const esLateral = o.tipo === 'izquierda' || o.tipo === 'derecha';
            // Un muro lateral tapa el lado que hay que ABANDONAR y es alto:
            // no se salta ni se agacha, hay que correrse.
            const w = (esLateral ? 340 : 620) * p.escala;
            const hh = (esLateral ? 460 : 150) * p.escala;
            const y = esLateral ? p.y - 190 * p.escala
              : o.tipo === 'bajo' ? p.y : p.y - 300 * p.escala;
            const cx = esLateral ? (o.tipo === 'izquierda' ? 1 : -1) * 190 * p.escala : 0;
            const col = esLateral ? '#7C3AED' : o.tipo === 'bajo' ? '#D52B1E' : '#F4B400';
            const fO = facetas(col);
            const pr = Math.max(4, 26 * p.escala);
            return h('g', {
              key: o.id,
              transform: 'translate(' + (500 + cx).toFixed(0) + ',' + y.toFixed(0) + ')',
              opacity: clamp(1.15 - o.d, 0.25, 1),
            },
              // Cara superior y frontal: la barra es un bloque que se acerca,
              // y el frente queda translúcido para no tapar la silueta.
              h('path', {
                d: 'M' + (-w / 2) + ' ' + (-hh / 2) + ' L' + (-w / 2 + pr) + ' ' + (-hh / 2 - pr) +
                   ' L' + (w / 2 + pr) + ' ' + (-hh / 2 - pr) + ' L' + (w / 2) + ' ' + (-hh / 2) + ' Z',
                fill: fO.luz,
              }),
              h('rect', {
                x: -w / 2, y: -hh / 2, width: w, height: hh, rx: 6,
                fill: col, opacity: 0.34, stroke: col, strokeWidth: Math.max(3, 8 * p.escala),
              }),
              h('rect', { x: -w / 2, y: -hh / 2, width: w, height: Math.max(3, 7 * p.escala), fill: fO.brillo }),
              p.escala > 0.6 ? h('text', {
                y: -hh / 2 - 16, textAnchor: 'middle', className: 'fp-esq-aviso',
                fontSize: Math.round(46 * p.escala),
              }, OBST[o.tipo].nombre) : null);
          }),
          // el jugador: contorno verde de su cuerpo, interior transparente
          h('g', { transform: 'translate(' + desplazoX.toFixed(0) + ',' + desplazo + ')' },
            E.contorno && E.contorno.length > 6
              // Silueta real: contorno de la máscara de segmentación.
              ? h('path', {
                  className: 'fp-contorno',
                  d: E.contorno.map((p, i) => (i ? 'L' : 'M')
                    + (250 + (E.hw.espejo !== false ? 1 - p.x : p.x) * 500).toFixed(1) + ' '
                    + (380 + p.y * 600).toFixed(1)).join(' ') + ' Z',
                  fill: 'rgba(74,222,128,.10)', stroke: '#4ADE80', strokeWidth: 6, strokeLinejoin: 'round',
                })
              : E.landmarks
              ? h('svg', { x: 250, y: 380, width: 500, height: 600, viewBox: '0 0 500 600', className: 'fp-contorno-svg' },
                  h(ContornoCuerpo, { landmarks: E.landmarks, w: 500, h: 600, espejo: E.hw.espejo !== false }))
              : h('g', { transform: 'translate(500,760) scale(0.62)' },
                  h('circle', { cx: 0, cy: -190, r: 62, fill: 'rgba(74,222,128,.10)', stroke: '#4ADE80', strokeWidth: 9 }),
                  h('path', {
                    d: 'M-120 240 q10 -230 120 -240 q110 10 120 240 M-108 -60 q-52 44 -58 150 M108 -60 q52 44 58 150',
                    fill: 'rgba(74,222,128,.10)', stroke: '#4ADE80', strokeWidth: 9, strokeLinejoin: 'round',
                  }))),
          E.hud.aviso
            ? h('text', { x: 500, y: 210, textAnchor: 'middle', className: 'fp-svg-label' }, E.hud.aviso)
            : null)),
        !E.modoTactil ? h('div', { className: 'fp-ray-cam' },
          h('video', { ref: E.attachVideo, className: 'fp-video is-mirror', autoPlay: true, playsInline: true, muted: true }),
          h(AvisoCamara, null)) : null,
        botonesEsquiva(E),
        h('p', { className: 'fp-hint' },
          // La instrucción NO puede apoyarse en el color aunque el juego no lo
          // haga: quien no distingue rojo de amarillo lee esta línea igual.
          // Lo que separa a los obstáculos es dónde están, y cada uno trae su
          // rótulo («Salta», «Agáchate») cuando se acerca.
          'Tu cuerpo es el contorno verde y los obstáculos vienen de frente: ' +
          'los que están a ras de suelo se saltan, los que cuelgan de arriba se pasan agachándose ' +
          'y los de los costados se esquivan con un paso al lado. Cada uno se rotula al acercarse.')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.h Juego 10 — "Alas de cóndor" (aletear con los brazos para volar)
  // ══════════════════════════════════════════════════════════════════════
  //
  // Se vuela moviendo los brazos como alas: cada aleteo completo empuja hacia
  // arriba, y abrir los brazos quietos a la altura de los hombros hace planear,
  // que frena la caída sin gastar. El circuito avanza solo; lo único que el
  // jugador decide es la ALTURA a la que pasa, y de eso depende qué frutas
  // alcanza. Solo hace falta el medio cuerpo superior.

  // Proporción del cuadro de vuelo. NO se usa `slice`: con recorte, en una
  // pantalla ancha y baja la banda visible se reduce tanto que el cóndor y el
  // marcador quedan fuera. Con `meet` entra siempre todo, y las bandas que
  // sobran se ven como cielo porque el CSS pinta el fondo del mismo color.
  const VUELO_VB = { w: 1000, h: 700, suelo: 610, techo: 165 };

  /** Fruta del circuito, dibujada con facetas como el resto del arte. */
  function FrutaVuelo(props) {
    const t = props.tipo || {};
    const r = num(props.r, 34);
    if (t.id === 'uva') {
      const f = facetas('#8E44AD');
      return h('g', { transform: props.transform },
        [[0, -0.5], [-0.5, 0.15], [0.5, 0.15], [0, 0.8]].map((p, i) => h('circle', {
          key: i, cx: p[0] * r, cy: p[1] * r, r: r * 0.42,
          fill: i % 2 ? f.base : f.luz, stroke: f.linea, strokeWidth: 3,
        })),
        h('path', { d: 'M0 ' + (-r * 0.85) + ' q' + r * 0.4 + ' ' + (-r * 0.3) + ' ' + r * 0.7 + ' ' + (-r * 0.1), stroke: '#4E7A2A', strokeWidth: 5, fill: 'none' }));
    }
    if (t.id === 'sandia') {
      const f = facetas('#E74C3C');
      return h('g', { transform: props.transform },
        h('path', { d: 'M' + (-r) + ' 0 A' + r + ' ' + r + ' 0 0 0 ' + r + ' 0 Z', fill: '#3D8B37', stroke: '#245A20', strokeWidth: 4 }),
        h('path', { d: 'M' + (-r * 0.82) + ' 0 A' + r * 0.82 + ' ' + r * 0.82 + ' 0 0 0 ' + r * 0.82 + ' 0 Z', fill: f.base }),
        h('path', { d: 'M' + (-r * 0.82) + ' 0 A' + r * 0.82 + ' ' + r * 0.82 + ' 0 0 0 0 ' + r * 0.82 + ' Z', fill: f.luz, opacity: 0.55 }),
        [[-0.35, 0.3], [0, 0.45], [0.35, 0.3]].map((p, i) => h('ellipse', {
          key: i, cx: p[0] * r, cy: p[1] * r, rx: r * 0.07, ry: r * 0.11, fill: '#2B1B12',
        })));
    }
    const f = facetas('#E5342A');
    return h('g', { transform: props.transform },
      h('circle', { cx: 0, cy: 0, r: r, fill: f.base, stroke: f.linea, strokeWidth: 4 }),
      h('path', { d: 'M' + (-r) + ' 0 A' + r + ' ' + r + ' 0 0 1 0 ' + (-r) + ' L0 0 Z', fill: f.luz }),
      h('circle', { cx: -r * 0.32, cy: -r * 0.34, r: r * 0.16, fill: '#fff', opacity: 0.6 }),
      h('path', { d: 'M0 ' + (-r * 0.95) + ' q' + r * 0.1 + ' ' + (-r * 0.45) + ' ' + r * 0.55 + ' ' + (-r * 0.35), stroke: '#4E7A2A', strokeWidth: 6, fill: 'none', strokeLinecap: 'round' }));
  }

  /**
   * El cóndor. `alas` va de −1 (alas abajo) a 1 (alas arriba) y sigue a los
   * brazos del jugador: ver el propio gesto reflejado en el pájaro es lo que
   * hace que el control se entienda sin leer instrucciones.
   */
  function Condor(props) {
    const alas = clamp(num(props.alas, 0), -1, 1);
    const planeo = !!props.planeo;
    const cuerpo = facetas('#3A4050');
    const ang = planeo ? -3 : -clamp(alas, -1, 1) * 34;
    const ala = (lado) => h('g', { transform: 'rotate(' + (lado * ang) + ')' },
      h('path', {
        d: 'M0 -6 Q' + lado * 90 + ' ' + (-30 - (planeo ? 0 : alas * 16)) + ' ' + lado * 186 + ' ' + (planeo ? -6 : -alas * 26) +
           ' Q' + lado * 120 + ' ' + 34 + ' 0 24 Z',
        fill: cuerpo.base, stroke: cuerpo.linea, strokeWidth: 4, strokeLinejoin: 'round',
      }),
      // Plumas primarias: tres cuñas más claras en el borde del ala.
      [0.62, 0.78, 0.92].map((k, i) => h('path', {
        key: i,
        d: 'M' + lado * 186 * k + ' ' + (-4 + i * 8) + ' L' + lado * 186 * (k + 0.09) + ' ' + (10 + i * 9) + ' L' + lado * 186 * (k - 0.02) + ' ' + (14 + i * 8) + ' Z',
        fill: cuerpo.sombra,
      })),
      h('path', { d: 'M0 -4 Q' + lado * 80 + ' -22 ' + lado * 150 + ' -6', stroke: '#fff', strokeWidth: 4, fill: 'none', opacity: 0.22 }));
    return h('g', { transform: props.transform },
      ala(-1), ala(1),
      h('ellipse', { cx: 0, cy: 6, rx: 44, ry: 30, fill: cuerpo.base, stroke: cuerpo.linea, strokeWidth: 4 }),
      h('path', { d: 'M-40 -2 q40 -22 80 0 q-40 -8 -80 0 Z', fill: '#fff', opacity: 0.25 }),
      // Golilla blanca del cóndor: es lo que lo hace reconocible.
      h('ellipse', { cx: 34, cy: -6, rx: 22, ry: 15, fill: '#F2F3F5', stroke: cuerpo.linea, strokeWidth: 3 }),
      h('circle', { cx: 52, cy: -18, r: 20, fill: cuerpo.sombra, stroke: cuerpo.linea, strokeWidth: 4 }),
      h('circle', { cx: 58, cy: -22, r: 5, fill: '#fff' }),
      h('circle', { cx: 59, cy: -22, r: 2.6, fill: '#111' }),
      h('path', { d: 'M68 -16 l22 6 l-22 8 Z', fill: '#E9A13B', stroke: '#8A5A17', strokeWidth: 3, strokeLinejoin: 'round' }),
      h('path', { d: 'M-44 12 l-34 10 l30 6 Z', fill: cuerpo.sombra, stroke: cuerpo.linea, strokeWidth: 3, strokeLinejoin: 'round' }));
  }

  function JuegoVuelo(props) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const detRef = useRef(detectorAleteo());
    const cuerpoRef = useRef(seguidorCuerpo());
    const vueloRef = useRef(null);
    const faseRef = useRef('intro');
    const tactilRef = useRef({ aleteo: false, planeoHasta: 0 });
    const alasRef = useRef(0);

    const [fase, setFase] = useState('intro');
    const [error, setError] = useState('');
    const [modoTactil, setModoTactil] = useState(false);
    const [hud, setHud] = useState({
      y: 0.55, alas: 0, planeo: false, puntos: 0, comidas: 0,
      energia: 3, progreso: 0, cadencia: 0, aviso: '',
    });
    const [frutas, setFrutas] = useState([]);
    const [landmarks, setLandmarks] = useState(null);
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
      olvidarMotor();
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    }, []);
    useEffect(() => soltarTodo, [soltarTodo]);

    const iniciar = useCallback(async (modo) => {
      setError(''); setFin(null);
      detRef.current.reset(); cuerpoRef.current.reset();
      vueloRef.current = motorVuelo(cfg);
      setFrutas([]);
      if (modo === 'tactil') { setModoTactil(true); irA('volando'); return; }
      setModoTactil(false);
      irA('abriendo');
      try {
        const prov = await arrancarPose(hw, videoRef, streamRef);
        provRef.current = prov;
        irA('volando');
      } catch (e) {
        soltarTodo();
        setError(mensajeCamara(e));
        irA('intro');
      }
    }, [cfg, hw, irA, soltarTodo]);

    /** Respaldo sin cámara: un toque es un aleteo, mantener es planear. */
    const aletearTactil = useCallback(() => { tactilRef.current.aleteo = true; }, []);
    const planearTactil = useCallback((on) => {
      tactilRef.current.planeoHasta = on ? nowMs() + 4000 : 0;
    }, []);

    useEffect(() => {
      if (fase !== 'volando') return undefined;
      const abajo = (e) => {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { aletearTactil(); e.preventDefault(); }
        if (e.key === 'Shift' || e.key === 'ArrowDown') planearTactil(true);
      };
      const arriba = (e) => { if (e.key === 'Shift' || e.key === 'ArrowDown') planearTactil(false); };
      window.addEventListener('keydown', abajo);
      window.addEventListener('keyup', arriba);
      return () => { window.removeEventListener('keydown', abajo); window.removeEventListener('keyup', arriba); };
    }, [fase, aletearTactil, planearTactil]);

    useEffect(() => {
      if (fase !== 'volando') return undefined;
      let ultimoHud = 0;
      return loop((dt) => {
        const V = vueloRef.current;
        if (!V) return;
        const t = nowMs();
        let entrada = { aleteo: false, fuerza: 1, planeo: false };
        let cadencia = 0, aviso = '', alas = alasRef.current, piernasHud = 0;
        if (modoTactil) {
          entrada.aleteo = tactilRef.current.aleteo;
          entrada.planeo = tactilRef.current.planeoHasta > t;
          tactilRef.current.aleteo = false;
          // Las alas del cóndor imitan el gesto aunque se juegue con botones.
          alas = entrada.planeo ? 0 : Math.sin(V.t * 9) * 0.85;
        } else {
          const prov = provRef.current;
          const lec = prov ? prov.leer() : null;
          const L = lec && lec.landmarks;
          const cuerpo = cuerpoRef.current.actualizar(L, dt, hw.espejo !== false, lec && lec.mundo);
          const r = detRef.current.actualizar(L, dt, lec && lec.mundo);
          entrada = {
            aleteo: r.aleteo, fuerza: r.fuerza, planeo: r.planeo,
            // Juntar las piernas pica, abrirlas frena. Si la cámara no ve las
            // piernas esto llega en 0 y el vuelo es exactamente el de antes.
            piernas: cuerpo.visibilidadCuerpo === 'completo' ? cuerpo.piernasJuntas : 0,
          };
          piernasHud = entrada.piernas;
          cadencia = r.cadencia;
          alas = clamp(r.altura, -1, 1);
          if (!r.visible) aviso = avisoDeEncuadre(lec && lec.confianza, 'brazos') || 'No te veo: ponte frente al tótem';
          // El respaldo táctil sigue activo aunque haya cámara.
          if (tactilRef.current.aleteo) { entrada.aleteo = true; entrada.fuerza = 1; tactilRef.current.aleteo = false; }
          if (tactilRef.current.planeoHasta > t) entrada.planeo = true;
          if (t - ultimoHud > 60) setLandmarks(L);
        }
        alasRef.current = alas;
        const ev = V.paso(dt, entrada);
        if (ev.choque && navigator.vibrate) { try { navigator.vibrate(70); } catch (e) { /* noop */ } }
        if (ev.fin) {
          setFin({
            puntos: V.puntos, comidas: V.comidas, aleteos: V.aleteos,
            energia: V.energia, motivo: V.motivo, completado: /completado/.test(V.motivo),
          });
          irA('fin');
          return;
        }
        if (t - ultimoHud > 55) {
          ultimoHud = t;
          setFrutas(V.frutas.slice());
          setHud({
            y: V.y, alas: alas, planeo: V.planeando, puntos: V.puntos, comidas: V.comidas,
            energia: V.energia, progreso: V.progreso(), cadencia: cadencia, aviso: aviso,
            piernas: piernasHud, picando: V.picando, frenando: V.frenando,
          });
        }
      });
    }, [fase, modoTactil, irA]);

    const tema = themeOf(model);
    const escV = escenaDe(tema);
    const espejo = hw.espejo !== false;

    // El <video> tiene que existir ANTES de pedir la cámara: `abrirCamara`
    // resuelve y acto seguido necesita un elemento donde montar el stream. Por
    // eso se arma aquí y se rinde también en la intro, oculto.
    const videoBox = !modoTactil ? h('div', { className: 'fp-ray-cam' + (fase === 'volando' ? '' : ' is-hidden') },
      h(CamaraVista, { attach: attachVideo, espejo: espejo, landmarks: landmarks, espacio: model.espacio, imagenKinect: imagenDe(provRef) },
        landmarks ? h(Esqueleto, { landmarks: landmarks, espejo: espejo }) : null),
      hw.avisoCamara !== false && streamRef.current
        ? h(AvisoCamara, null) : null) : null;

    // ── Intro ─────────────────────────────────────────────────────────
    if (fase === 'intro' || fase === 'abriendo') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-intro' },
          h('svg', { viewBox: '0 0 320 200', className: 'fp-intro-svg fp-intro-svg--ancho' },
            h(LienzoDC, { gid: 'fp-vuelo-intro', w: 320, h: 200 },
              h(CieloDC, { w: 320, h: 200, horizonte: 150, gid: 'fp-vuelo-i', alto: escV.cielo, bajo: escV.cieloBajo, sol: false }),
              h(CerrosDC, { w: 320, horizonte: 150, color: escV.cerros, alto: 60 }),
              h('g', { transform: 'translate(120,86) scale(0.42)' }, h(Condor, { alas: 0.7 })),
              h('g', { transform: 'translate(250,60) scale(0.7)' }, h(FrutaVuelo, { tipo: { id: 'manzana' }, r: 20 })),
              h('g', { transform: 'translate(285,110) scale(0.7)' }, h(FrutaVuelo, { tipo: { id: 'uva' }, r: 18 })))),
          h('h2', null, props.game.blurb || 'Mueve los brazos como alas y surca el cielo'),
          h('ul', { className: 'fp-steps' },
            h('li', null, h('b', null, 'Aletea'), ': sube y baja los dos brazos. Cada aleteo completo te empuja hacia arriba; mientras más amplio, más alto.'),
            h('li', null, h('b', null, 'Planea'), ': abre los brazos en cruz y déjalos quietos. No subes, pero casi no bajas.'),
            h('li', null, 'Pasa a la altura de las frutas para comerlas y termina el circuito sin quedarte sin energía.')),
          error ? h('div', { className: 'fp-error' }, '⚠ ' + error) : null,
          h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => iniciar('camara'), disabled: fase === 'abriendo' },
              fase === 'abriendo' ? 'Abriendo la cámara…' : '🦅 Volar con los brazos'),
            h(Boton, { onClick: () => iniciar('tactil') }, '👆 Probar con botones')),
          h('p', { className: 'fp-fineprint' },
            '📷 Basta con ver tu torso, brazos y cabeza. El análisis ocurre en este equipo: no se graba ni se envía video.')),
        videoBox);
    }

    // ── Resultado ─────────────────────────────────────────────────────
    if (fase === 'fin' && fin) {
      const meta = Math.max(1, num(cfg.metaPuntos, 400));
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: () => { soltarTodo(); props.onExit(); }, meta: null },
        h(Resultado, {
          puntaje10: clamp((fin.puntos / meta) * 10, 0, 10),
          juego: props.game.name,
          titulo: fin.completado ? '¡Circuito completado!' : fin.motivo,
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, fin.puntos + ' puntos'),
            h(Chip, null, '🍎 ' + fin.comidas + ' frutas'),
            h(Chip, null, '🦅 ' + fin.aleteos + ' aleteos')),
          detalleTexto: fin.puntos + ' pts · ' + fin.comidas + ' frutas · ' + fin.aleteos + ' aleteos',
          onExit: () => { soltarTodo(); props.onExit(); },
          onReplay: () => {
            vueloRef.current = motorVuelo(cfg);
            detRef.current.reset();
            setFin(null); setFrutas([]);
            irA('volando');
          },
        }));
    }

    // ── Vuelo ─────────────────────────────────────────────────────────
    const W = VUELO_VB.w, H = VUELO_VB.h, suelo = VUELO_VB.suelo;
    // La altura del motor (0 = suelo, 1 = techo) se lleva a coordenadas SVG.
    const yDe = (a) => suelo - a * (suelo - VUELO_VB.techo);
    const xPajaro = 250;
    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, { tone: 'accent' }, hud.puntos + ' pts'),
        h(Chip, null, '🍎 ' + hud.comidas),
        h(Chip, null, '⚡'.repeat(Math.max(0, hud.energia)) || 'sin energía'),
        hud.planeo ? h(Chip, { tone: 'ok' }, '🪁 planeando') : null,
        hud.picando ? h(Chip, { tone: 'accent' }, '🪶 picada') : hud.frenando ? h(Chip, null, '🦵 frenando') : null),
    },
      h('div', { className: 'fp-vuelo-wrap' },
        h('svg', { className: 'fp-vuelo-svg', viewBox: '0 0 ' + W + ' ' + H },
          h(LienzoDC, { gid: 'fp-vuelo-vb', w: W, h: H },
            h(CieloDC, {
              w: W, h: H, horizonte: suelo, gid: 'fp-vuelo',
              alto: escV.cielo, bajo: escV.cieloBajo, solX: 800, solColor: escV.sol,
              nubes: [{ x: 170, y: 130, r: 30 }, { x: 600, y: 78, r: 22 }, { x: 880, y: 200, r: 26 }],
            }),
            // Cordillera muy lenta al fondo y otra más rápida delante: el
            // paralaje es lo que hace sentir que se avanza de verdad.
            h('g', { transform: 'translate(' + (-(hud.progreso * 900) % 1000) + ',0)', opacity: 0.55 },
              [0, 1].map((k) => h('g', { key: k, transform: 'translate(' + k * 1000 + ',0)' },
                h(CerrosDC, { w: 1000, horizonte: suelo, color: facetas(escV.cerros).sombra, alto: 210, picos: [[0.15, 0.9], [0.55, 1], [0.88, 0.8]] })))),
            h('g', { transform: 'translate(' + (-(hud.progreso * 2400) % 1000) + ',0)' },
              [0, 1].map((k) => h('g', { key: k, transform: 'translate(' + k * 1000 + ',0)' },
                h(CerrosDC, { w: 1000, horizonte: suelo, color: escV.cerros, alto: 130, picos: [[0.25, 0.85], [0.7, 1]] })))),
            h(SueloDC, { w: W, h: H, horizonte: suelo, color: escV.suelo, fugaX: 500, filas: 4, lineas: 9 }),
            // Frutas del circuito.
            frutas.map((f) => h('g', {
              key: f.id,
              transform: 'translate(' + (xPajaro + f.d * (W - xPajaro + 90)).toFixed(0) + ',' + yDe(f.alto).toFixed(0) + ')',
            },
              h(SombraDC, { cx: 0, cy: suelo - yDe(f.alto), rx: 26, ry: 7, opacidad: 0.35 }),
              h(FrutaVuelo, { tipo: f.tipo, r: 34 }))),
            // El cóndor, con las alas siguiendo a los brazos del jugador.
            h('g', { transform: 'translate(' + xPajaro + ',' + yDe(hud.y).toFixed(0) + ') scale(0.5)' },
              h(Condor, { alas: hud.alas, planeo: hud.planeo })),
            h(SombraDC, { cx: xPajaro, cy: suelo + 8, rx: 90 * (0.4 + (1 - hud.y) * 0.6), ry: 16, opacidad: 0.3 }),
            // Barra de progreso del circuito, arriba, como un marcador.
            h('g', null,
              h('rect', { x: 160, y: 22, width: 680, height: 24, rx: 5, fill: 'rgba(6,12,26,.72)', stroke: '#fff', strokeWidth: 3 }),
              h('rect', { x: 164, y: 26, width: Math.max(0, 672 * hud.progreso), height: 16, rx: 3, fill: facetas(tema.accent).luz }),
              h('text', { x: 500, y: 68, textAnchor: 'middle', className: 'fp-svg-sub' },
                'CIRCUITO ' + Math.round(hud.progreso * 100) + '%')),
            hud.aviso
              ? h('text', { x: 500, y: 150, textAnchor: 'middle', className: 'fp-svg-label' }, hud.aviso)
              : null)),
        videoBox,
        h('div', { className: 'fp-esq-botones' },
          h(Boton, { variant: 'primary', onClick: aletearTactil }, '🦅 Aletear'),
          h(Boton, {
            onPointerDown: () => planearTactil(true), onPointerUp: () => planearTactil(false),
            onPointerLeave: () => planearTactil(false), onPointerCancel: () => planearTactil(false),
          }, '🪁 Planear')),
        h('p', { className: 'fp-hint' },
          modoTactil
            ? 'Toca "Aletear" (o la barra espaciadora) para subir y mantén "Planear" para caer despacio.'
            : 'Sube y baja los brazos para volar; ábrelos en cruz y quédate quieto para planear.')));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12.i Juego 11 — "Alas de cóndor 3D" (vuelo en profundidad por los Andes)
  // ══════════════════════════════════════════════════════════════════════
  //
  // La misma física de vuelo, pero la cámara va DETRÁS del cóndor y el valle
  // se aleja hacia el punto de fuga. Se suma un eje: inclinando el torso se
  // vira a izquierda y derecha, que es lo que permite seguir la ruta, esquivar
  // los peñones y alinearse con las frutas.
  //
  // La cordillera se dibuja por capas de cresta: verde en la falda y nieve en
  // los picos, con las caras iluminada y en sombra del motor de arte.

  const VUELO3D_VB = { w: 1000, h: 700, fugaY: 250, suelo: 660 };

  /** Perspectiva del valle: lejos = chico y cerca del punto de fuga. */
  function proyectarVuelo(d) {
    const z = clamp(d, 0, 1);
    const k = (1 - z) * (1 - z);              // cuadrática: la fuga comprime
    return { escala: 0.16 + (1 - z) * 1.35, k };
  }

  /**
   * Cordón montañoso en profundidad. Cada cresta es un perfil de picos con
   * falda de vegetación y nieve arriba; las lejanas van más pálidas y más
   * altas en pantalla, que es lo que da la sensación de valle.
   */
  function CordonAndes(props) {
    const w = num(props.w, 1000);
    const base = num(props.base, 500);
    const alto = num(props.alto, 200);
    const desfase = num(props.desfase, 0);
    const roca = facetas(props.color || '#5B6B86');
    const verde = facetas(props.vegetacion || '#3E7A46');
    const picos = props.picos || [0.08, 0.3, 0.55, 0.78, 0.96];
    return h('g', { opacity: num(props.opacidad, 1) },
      picos.map((px, i) => {
        const cx = ((px + desfase) % 1.2 - 0.1) * w;
        const ah = alto * (0.65 + ((i * 37) % 10) / 22);
        const an = ah * 1.35;
        const nieve = ah * 0.34;
        return h('g', { key: 'p' + i },
          // Cara en sombra y cara al sol: dos triángulos planos.
          h('path', { d: 'M' + (cx - an) + ' ' + base + ' L' + cx + ' ' + (base - ah) + ' L' + cx + ' ' + base + ' Z', fill: roca.sombra }),
          h('path', { d: 'M' + cx + ' ' + (base - ah) + ' L' + (cx + an) + ' ' + base + ' L' + cx + ' ' + base + ' Z', fill: roca.luz }),
          // Vegetación en la falda: el tercio de abajo se pone verde.
          h('path', {
            d: 'M' + (cx - an) + ' ' + base + ' L' + (cx - an * 0.42) + ' ' + (base - ah * 0.42) +
               ' L' + cx + ' ' + (base - ah * 0.3) + ' L' + (cx + an * 0.42) + ' ' + (base - ah * 0.42) +
               ' L' + (cx + an) + ' ' + base + ' Z',
            fill: verde.base,
          }),
          h('path', {
            d: 'M' + cx + ' ' + (base - ah * 0.3) + ' L' + (cx + an * 0.42) + ' ' + (base - ah * 0.42) +
               ' L' + (cx + an) + ' ' + base + ' L' + cx + ' ' + base + ' Z',
            fill: verde.luz,
          }),
          // Nieve del pico, con el borde quebrado.
          h('path', {
            d: 'M' + (cx - nieve * 0.9) + ' ' + (base - ah + nieve) + ' L' + cx + ' ' + (base - ah) +
               ' L' + (cx + nieve * 0.9) + ' ' + (base - ah + nieve) +
               ' L' + (cx + nieve * 0.3) + ' ' + (base - ah + nieve * 0.6) +
               ' L' + (cx - nieve * 0.2) + ' ' + (base - ah + nieve * 1.1) + ' Z',
            fill: '#F4F8FF',
          }));
      }));
  }

  /**
   * El cóndor visto DE ESPALDAS, que es como se ve desde la cámara de
   * persecución del vuelo en profundidad: las alas se abren a los costados,
   * la cola queda abajo y la cabeza asoma arriba al centro.
   *
   * `alas` (−1..1) sube y baja las puntas siguiendo los brazos del jugador,
   * y con `planeo` quedan tendidas y quietas.
   */
  function CondorAtras(props) {
    const alas = clamp(num(props.alas, 0), -1, 1);
    const planeo = !!props.planeo;
    const c = facetas('#3A4050');
    // Las puntas suben o bajan; planeando quedan casi horizontales.
    const punta = planeo ? -6 : -alas * 62;
    const codo = planeo ? -2 : -alas * 26;
    // El ala se dibuja con CUERDA: borde de ataque, punta y borde de fuga muy
    // separados. Con los dos bordes juntos el cóndor parece un palo.
    const ala = (lado) => h('g', null,
      h('path', {
        d: 'M' + lado * 24 + ' -14' +
           ' Q' + lado * 112 + ' ' + (codo - 30) + ' ' + lado * 202 + ' ' + punta +
           ' L' + lado * 194 + ' ' + (punta + 30) +
           ' Q' + lado * 116 + ' ' + (codo + 54) + ' ' + lado * 28 + ' 36 Z',
        fill: lado < 0 ? c.base : c.luz, stroke: c.linea, strokeWidth: 4, strokeLinejoin: 'round',
      }),
      // Plumas primarias: cuñas abiertas en la punta, como las del cóndor.
      [0, 1, 2, 3].map((i) => h('path', {
        key: i,
        d: 'M' + lado * (188 - i * 6) + ' ' + (punta + 4 + i * 7) +
           ' L' + lado * (236 - i * 10) + ' ' + (punta + 16 + i * 12) +
           ' L' + lado * (184 - i * 6) + ' ' + (punta + 14 + i * 7) + ' Z',
        fill: c.sombra, stroke: c.linea, strokeWidth: 2, strokeLinejoin: 'round',
      })),
      // Banda blanca del borde del ala: la marca del cóndor adulto.
      h('path', {
        d: 'M' + lado * 44 + ' -6 Q' + lado * 118 + ' ' + (codo - 20) + ' ' + lado * 180 + ' ' + (punta + 6),
        stroke: '#EEF1F5', strokeWidth: 11, fill: 'none', opacity: 0.9, strokeLinecap: 'round',
      }));
    return h('g', { transform: props.transform },
      ala(-1), ala(1),
      // Cuerpo y cola, vistos desde atrás.
      h('path', { d: 'M-38 -16 Q0 -34 38 -16 L28 56 Q0 72 -28 56 Z', fill: c.base, stroke: c.linea, strokeWidth: 4, strokeLinejoin: 'round' }),
      h('path', { d: 'M2 -26 L34 -14 L24 58 L2 66 Z', fill: c.sombra, opacity: 0.55 }),
      h('path', { d: 'M-26 -12 Q-14 -22 -4 -18 L-10 40 L-24 34 Z', fill: '#fff', opacity: 0.14 }),
      h('path', { d: 'M-20 50 L20 50 L14 96 L-14 96 Z', fill: c.sombra, stroke: c.linea, strokeWidth: 4, strokeLinejoin: 'round' }),
      // Golilla y cabeza asomando.
      h('ellipse', { cx: 0, cy: -18, rx: 26, ry: 12, fill: '#F2F3F5', stroke: c.linea, strokeWidth: 3 }),
      h('circle', { cx: 0, cy: -34, r: 17, fill: c.sombra, stroke: c.linea, strokeWidth: 4 }),
      h('circle', { cx: -6, cy: -38, r: 3.4, fill: '#fff' }),
      h('circle', { cx: 6, cy: -38, r: 3.4, fill: '#fff' }));
  }

  /** Peñón o araucaria que viene de frente por la ruta. */
  function ObstaculoVuelo(props) {
    const e = num(props.escala, 1);
    if (props.tipo === 'arbol') {
      const t = facetas('#2F6B3A');
      return h('g', { transform: props.transform },
        h('rect', { x: -8 * e, y: -10 * e, width: 16 * e, height: 74 * e, fill: '#6B4A28', stroke: '#3B2814', strokeWidth: 3 * e }),
        [0, 1, 2].map((i) => h('path', {
          key: i,
          d: 'M0 ' + (-64 + i * 30) * e + ' L' + (46 - i * 8) * e + ' ' + (-16 + i * 30) * e + ' L' + (-(46 - i * 8)) * e + ' ' + (-16 + i * 30) * e + ' Z',
          fill: i % 2 ? t.base : t.luz, stroke: t.linea, strokeWidth: 3 * e, strokeLinejoin: 'round',
        })));
    }
    const r = facetas('#6E7789');
    return h('g', { transform: props.transform },
      h('path', { d: 'M' + (-52 * e) + ' ' + (40 * e) + ' L' + (-18 * e) + ' ' + (-56 * e) + ' L' + (26 * e) + ' ' + (-34 * e) + ' L' + (54 * e) + ' ' + (40 * e) + ' Z', fill: r.base, stroke: r.linea, strokeWidth: 3 * e, strokeLinejoin: 'round' }),
      h('path', { d: 'M' + (-18 * e) + ' ' + (-56 * e) + ' L' + (26 * e) + ' ' + (-34 * e) + ' L' + (10 * e) + ' ' + (40 * e) + ' L' + (-6 * e) + ' ' + (40 * e) + ' Z', fill: r.luz }),
      h('path', { d: 'M' + (-30 * e) + ' ' + (-24 * e) + ' L' + (-14 * e) + ' ' + (-44 * e) + ' L' + (-6 * e) + ' ' + (-26 * e) + ' Z', fill: '#F4F8FF', opacity: 0.85 }));
  }

  function JuegoVuelo3D(props) {
    const cfg = props.game.config || {};
    const hw = model.hardware;
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const provRef = useRef(null);
    const alaRef = useRef(detectorAleteo());
    const cuerpoRef = useRef(seguidorCuerpo());
    const incRef = useRef(detectorInclinacion());
    const vueloRef = useRef(null);
    const faseRef = useRef('intro');
    const tactilRef = useRef({ aleteo: false, planeoHasta: 0, giro: 0 });
    const alasRef = useRef(0);

    const [fase, setFase] = useState('intro');
    const [error, setError] = useState('');
    const [modoTactil, setModoTactil] = useState(false);
    const [hud, setHud] = useState({
      y: 0.55, x: 0, alas: 0, planeo: false, giro: 0, puntos: 0, comidas: 0,
      esquivados: 0, energia: 3, progreso: 0, aviso: '',
    });
    const [items, setItems] = useState({ frutas: [], obstaculos: [] });
    const [landmarks, setLandmarks] = useState(null);
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
      olvidarMotor();
      const st = streamRef.current;
      if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    }, []);
    useEffect(() => soltarTodo, [soltarTodo]);

    const nuevoVuelo = useCallback(() => motorVuelo(Object.assign({}, cfg, { lateral: true, obstaculos: true })), [cfg]);

    const iniciar = useCallback(async (modo) => {
      setError(''); setFin(null);
      alaRef.current.reset(); incRef.current.reset(); cuerpoRef.current.reset();
      vueloRef.current = nuevoVuelo();
      setItems({ frutas: [], obstaculos: [] });
      if (modo === 'tactil') { setModoTactil(true); irA('volando'); return; }
      setModoTactil(false);
      irA('abriendo');
      try {
        const prov = await arrancarPose(hw, videoRef, streamRef);
        provRef.current = prov;
        irA('volando');
      } catch (e) {
        soltarTodo();
        setError(mensajeCamara(e));
        irA('intro');
      }
    }, [hw, irA, soltarTodo, nuevoVuelo]);

    const aletearTactil = useCallback(() => { tactilRef.current.aleteo = true; }, []);
    const planearTactil = useCallback((on) => { tactilRef.current.planeoHasta = on ? nowMs() + 4000 : 0; }, []);
    const girarTactil = useCallback((g) => { tactilRef.current.giro = g; }, []);

    useEffect(() => {
      if (fase !== 'volando') return undefined;
      const abajo = (e) => {
        if (e.key === ' ' || e.key === 'w') { aletearTactil(); e.preventDefault(); }
        if (e.key === 'ArrowLeft' || e.key === 'a') girarTactil(-1);
        if (e.key === 'ArrowRight' || e.key === 'd') girarTactil(1);
        if (e.key === 'Shift' || e.key === 'ArrowDown') planearTactil(true);
      };
      const arriba = (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') girarTactil(0);
        if (e.key === 'Shift' || e.key === 'ArrowDown') planearTactil(false);
      };
      window.addEventListener('keydown', abajo);
      window.addEventListener('keyup', arriba);
      return () => { window.removeEventListener('keydown', abajo); window.removeEventListener('keyup', arriba); };
    }, [fase, aletearTactil, planearTactil, girarTactil]);

    useEffect(() => {
      if (fase !== 'volando') return undefined;
      let ultimoHud = 0;
      const espejo = hw.espejo !== false;
      return loop((dt) => {
        const V = vueloRef.current;
        if (!V) return;
        const t = nowMs();
        let entrada = { aleteo: false, fuerza: 1, planeo: false, giro: 0 };
        let aviso = '', alas = alasRef.current, piernasHud = 0;
        if (modoTactil) {
          entrada.aleteo = tactilRef.current.aleteo;
          entrada.planeo = tactilRef.current.planeoHasta > t;
          entrada.giro = tactilRef.current.giro;
          tactilRef.current.aleteo = false;
          alas = entrada.planeo ? 0 : Math.sin(V.t * 9) * 0.85;
        } else {
          const prov = provRef.current;
          const lec = prov ? prov.leer() : null;
          const L = lec && lec.landmarks;
          const cuerpo = cuerpoRef.current.actualizar(L, dt, espejo, lec && lec.mundo);
          const a = alaRef.current.actualizar(L, dt, lec && lec.mundo);
          const i = incRef.current.actualizar(L, dt, espejo, lec && lec.kinect);
          entrada = {
            aleteo: a.aleteo, fuerza: a.fuerza, planeo: a.planeo, giro: i.giro,
            piernas: cuerpo.visibilidadCuerpo === 'completo' ? cuerpo.piernasJuntas : 0,
          };
          piernasHud = entrada.piernas;
          alas = clamp(a.altura, -1, 1);
          if (!a.visible) aviso = avisoDeEncuadre(lec && lec.confianza, 'brazos') || 'No te veo: ponte frente al tótem';
          if (tactilRef.current.aleteo) { entrada.aleteo = true; entrada.fuerza = 1; tactilRef.current.aleteo = false; }
          if (tactilRef.current.planeoHasta > t) entrada.planeo = true;
          if (tactilRef.current.giro) entrada.giro = tactilRef.current.giro;
          if (t - ultimoHud > 60) setLandmarks(L);
        }
        alasRef.current = alas;
        const ev = V.paso(dt, entrada);
        if (ev.choque && navigator.vibrate) { try { navigator.vibrate(80); } catch (e) { /* noop */ } }
        if (ev.fin) {
          setFin({
            puntos: V.puntos, comidas: V.comidas, esquivados: V.esquivados,
            aleteos: V.aleteos, motivo: V.motivo, completado: /completado/.test(V.motivo),
          });
          irA('fin');
          return;
        }
        if (t - ultimoHud > 55) {
          ultimoHud = t;
          setItems({ frutas: V.frutas.slice(), obstaculos: V.obstaculos.slice() });
          setHud({
            y: V.y, x: V.x, alas: alas, planeo: V.planeando, giro: entrada.giro,
            puntos: V.puntos, comidas: V.comidas, esquivados: V.esquivados,
            energia: V.energia, progreso: V.progreso(), aviso: aviso,
            piernas: piernasHud, picando: V.picando, frenando: V.frenando,
          });
        }
      });
    }, [fase, modoTactil, irA, hw.espejo]);

    const tema = themeOf(model);
    const escV = escenaDe(tema);
    const espejo = hw.espejo !== false;

    const videoBox = !modoTactil ? h('div', { className: 'fp-ray-cam' + (fase === 'volando' ? '' : ' is-hidden') },
      h(CamaraVista, { attach: attachVideo, espejo: espejo, landmarks: landmarks, espacio: model.espacio, imagenKinect: imagenDe(provRef) },
        landmarks ? h(Esqueleto, { landmarks: landmarks, espejo: espejo }) : null),
      hw.avisoCamara !== false && streamRef.current
        ? h(AvisoCamara, null) : null) : null;

    if (fase === 'intro' || fase === 'abriendo') {
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: props.onExit, meta: null },
        h('div', { className: 'fp-intro' },
          h('svg', { viewBox: '0 0 320 200', className: 'fp-intro-svg fp-intro-svg--ancho' },
            h(LienzoDC, { gid: 'fp-v3d-intro', w: 320, h: 200 },
              h(CieloDC, { w: 320, h: 200, horizonte: 190, gid: 'fp-v3d-i', alto: escV.cielo, bajo: escV.cieloBajo, sol: false }),
              h(CordonAndes, { w: 320, base: 190, alto: 96, color: '#657792', vegetacion: '#3E7A46', picos: [0.1, 0.34, 0.62, 0.88] }),
              h('g', { transform: 'translate(160,116) scale(0.3)' }, h(CondorAtras, { alas: 0.45 })),
              h('g', { transform: 'translate(250,70) scale(0.5)' }, h(FrutaVuelo, { tipo: { id: 'sandia' }, r: 22 })))),
          h('h2', null, props.game.blurb || 'Vuela por la cordillera, inclínate para virar y come frutas'),
          h('ul', { className: 'fp-steps' },
            h('li', null, h('b', null, 'Aletea'), ' para subir y ', h('b', null, 'abre los brazos'), ' para planear, igual que en la versión lateral.'),
            h('li', null, h('b', null, 'Inclina el torso'), ' a un lado o al otro para virar: así sigues la ruta del valle.'),
            h('li', null, 'Esquiva los peñones y las araucarias, y pasa por encima de las frutas.')),
          error ? h('div', { className: 'fp-error' }, '⚠ ' + error) : null,
          h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'primary', onClick: () => iniciar('camara'), disabled: fase === 'abriendo' },
              fase === 'abriendo' ? 'Abriendo la cámara…' : '🦅 Volar con el cuerpo'),
            h(Boton, { onClick: () => iniciar('tactil') }, '👆 Probar con botones')),
          h('p', { className: 'fp-fineprint' },
            '📷 Basta con ver tu torso, brazos y cabeza. El análisis ocurre en este equipo: no se graba ni se envía video.')),
        videoBox);
    }

    if (fase === 'fin' && fin) {
      const meta = Math.max(1, num(cfg.metaPuntos, 500));
      return h(Marco, { icon: props.game.icon, title: props.game.name, onExit: () => { soltarTodo(); props.onExit(); }, meta: null },
        h(Resultado, {
          puntaje10: clamp((fin.puntos / meta) * 10, 0, 10),
          juego: props.game.name,
          titulo: fin.completado ? '¡Cruzaste la cordillera!' : fin.motivo,
          detalle: h('div', { className: 'fp-chips' },
            h(Chip, { tone: 'accent' }, fin.puntos + ' puntos'),
            h(Chip, null, '🍎 ' + fin.comidas + ' frutas'),
            h(Chip, null, '⛰ ' + fin.esquivados + ' esquivados')),
          detalleTexto: fin.puntos + ' pts · ' + fin.comidas + ' frutas · ' + fin.esquivados + ' obstáculos esquivados',
          onExit: () => { soltarTodo(); props.onExit(); },
          onReplay: () => {
            vueloRef.current = nuevoVuelo();
            alaRef.current.reset(); incRef.current.reset();
            setFin(null); setItems({ frutas: [], obstaculos: [] });
            irA('volando');
          },
        }));
    }

    // ── Vuelo en profundidad ──────────────────────────────────────────
    const W = VUELO3D_VB.w, H = VUELO3D_VB.h, fugaY = VUELO3D_VB.fugaY, suelo = VUELO3D_VB.suelo;
    /** Lleva (lado, alto, profundidad) del motor a coordenadas de pantalla. */
    const punto = (lado, alto, d) => {
      const p = proyectarVuelo(d);
      const cx = 500 + lado * 430 * (0.12 + p.k * 0.88);
      const base = fugaY + p.k * (suelo - fugaY);
      return { x: cx, y: base - alto * (60 + p.k * 330), escala: p.escala, k: p.k };
    };
    const pj = punto(hud.x, hud.y, 0.16);
    // El cóndor se ladea al virar: es la lectura visual del control.
    const ladeo = clamp(hud.giro, -1, 1) * 22;
    const enOrden = [].concat(
      items.obstaculos.map((o) => ({ o, tipo: 'obst' })),
      items.frutas.map((f) => ({ o: f, tipo: 'fruta' })),
    ).sort((a, b) => b.o.d - a.o.d);   // lo lejano se dibuja primero

    return h(Marco, {
      icon: props.game.icon, title: props.game.name,
      onExit: () => { soltarTodo(); props.onExit(); },
      meta: h('div', { className: 'fp-meta-row' },
        h(Chip, { tone: 'accent' }, hud.puntos + ' pts'),
        h(Chip, null, '🍎 ' + hud.comidas),
        h(Chip, null, '⚡'.repeat(Math.max(0, hud.energia)) || 'sin energía'),
        hud.planeo ? h(Chip, { tone: 'ok' }, '🪁 planeando') : null,
        hud.picando ? h(Chip, { tone: 'accent' }, '🪶 picada') : hud.frenando ? h(Chip, null, '🦵 frenando') : null),
    },
      h('div', { className: 'fp-vuelo-wrap' },
        h('svg', { className: 'fp-vuelo3d-svg', viewBox: '0 0 ' + W + ' ' + H },
          h(LienzoDC, { gid: 'fp-v3d-vb', w: W, h: H },
            h(CieloDC, {
              w: W, h: H, horizonte: fugaY + 40, gid: 'fp-v3d',
              alto: escV.cielo, bajo: escV.cieloBajo, solX: 500, solColor: escV.sol,
              nubes: [{ x: 190, y: 96, r: 26 }, { x: 810, y: 128, r: 22 }],
            }),
            // Tres cordones: el lejano casi pálido, el cercano a los costados.
            h(CordonAndes, { w: W, base: fugaY + 60, alto: 130, color: '#7C8CA8', vegetacion: '#4C7F52', opacidad: 0.55, desfase: (hud.progreso * 0.4) % 1 }),
            h(CordonAndes, { w: W, base: fugaY + 150, alto: 210, color: '#65769A', vegetacion: '#3E7A46', opacidad: 0.85, desfase: (hud.progreso * 0.9) % 1, picos: [0.02, 0.24, 0.5, 0.74, 0.99] }),
            // Suelo del valle en fuga.
            h(SueloDC, { w: W, h: H, horizonte: fugaY + 150, color: '#4C7F52', fugaX: 500, filas: 6, lineas: 13, bruma: 'rgba(210,235,255,.45)' }),
            // Paredes del valle: la ruta por la que hay que colarse.
            h('path', { d: 'M0 ' + H + ' L' + (500 - 60) + ' ' + (fugaY + 130) + ' L0 ' + (fugaY + 190) + ' Z', fill: facetas('#5B6B86').sombra, opacity: 0.9 }),
            h('path', { d: 'M' + W + ' ' + H + ' L' + (500 + 60) + ' ' + (fugaY + 130) + ' L' + W + ' ' + (fugaY + 190) + ' Z', fill: facetas('#5B6B86').base, opacity: 0.9 }),
            // Balizas de la ruta: marcan por dónde va el valle.
            [0.2, 0.45, 0.7, 0.95].map((d, i) => {
              const izq = punto(-1, 0, d), der = punto(1, 0, d);
              return h('g', { key: 'b' + i, opacity: 0.35 },
                h('line', { x1: izq.x, y1: izq.y, x2: der.x, y2: der.y, stroke: '#fff', strokeWidth: 1 + izq.k * 4, strokeDasharray: '10 16' }));
            }),
            // Frutas y obstáculos, de lejos a cerca.
            enOrden.map((it) => {
              const p = punto(it.o.lado, it.o.alto, it.o.d);
              const tr = 'translate(' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ')';
              if (it.tipo === 'fruta') {
                return h('g', { key: it.o.id, transform: tr + ' scale(' + p.escala.toFixed(2) + ')' },
                  h(FrutaVuelo, { tipo: it.o.tipo, r: 30 }));
              }
              return h(ObstaculoVuelo, { key: it.o.id, tipo: it.o.tipo.id, escala: p.escala, transform: tr });
            }),
            // El cóndor, de espaldas: se ladea hacia donde vira.
            h('g', { transform: 'translate(' + pj.x.toFixed(0) + ',' + pj.y.toFixed(0) + ') rotate(' + ladeo.toFixed(1) + ') scale(0.42)' },
              h(CondorAtras, { alas: hud.alas, planeo: hud.planeo })),
            h('g', null,
              h('rect', { x: 160, y: 22, width: 680, height: 24, rx: 5, fill: 'rgba(6,12,26,.72)', stroke: '#fff', strokeWidth: 3 }),
              h('rect', { x: 164, y: 26, width: Math.max(0, 672 * hud.progreso), height: 16, rx: 3, fill: facetas(tema.accent).luz }),
              h('text', { x: 500, y: 68, textAnchor: 'middle', className: 'fp-svg-sub' },
                'CORDILLERA ' + Math.round(hud.progreso * 100) + '%')),
            hud.aviso
              ? h('text', { x: 500, y: 150, textAnchor: 'middle', className: 'fp-svg-label' }, hud.aviso)
              : null)),
        videoBox,
        h('div', { className: 'fp-esq-botones' },
          h(Boton, {
            onPointerDown: () => girarTactil(-1), onPointerUp: () => girarTactil(0),
            onPointerLeave: () => girarTactil(0), onPointerCancel: () => girarTactil(0),
          }, '⬅️ Izquierda'),
          h(Boton, { variant: 'primary', onClick: aletearTactil }, '🦅 Aletear'),
          h(Boton, {
            onPointerDown: () => planearTactil(true), onPointerUp: () => planearTactil(false),
            onPointerLeave: () => planearTactil(false), onPointerCancel: () => planearTactil(false),
          }, '🪁 Planear'),
          h(Boton, {
            onPointerDown: () => girarTactil(1), onPointerUp: () => girarTactil(0),
            onPointerLeave: () => girarTactil(0), onPointerCancel: () => girarTactil(0),
          }, 'Derecha ➡️')),
        h('p', { className: 'fp-hint' },
          modoTactil
            ? 'Mantén las flechas para virar, toca "Aletear" para subir y "Planear" para caer despacio.'
            : 'Aletea para subir, abre los brazos para planear e inclina el torso para virar por el valle.')));
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
          // Qué build está corriendo, a la vista. Sin esto no hay forma de
          // saber, probando en el tótem, si el host tomó la actualización o
          // se quedó con la copia cacheada. Es convención de la plataforma
          // (APP-SPEC §7.a), no un adorno.
          h('span', { className: 'fp-ver', title: 'Kimos FunPlai v' + APP_VERSION }, 'v' + APP_VERSION),
          m.branding.mostrarRanking ? h(Boton, { variant: 'ghost', onClick: () => go('ranking') }, '🏆 Ranking') : null,
          h(Boton, { variant: 'ghost', onClick: () => go('metricas') }, '📊 Métricas'),
          h(Boton, { variant: 'ghost', onClick: () => go('diagnostico') }, '🎥 Diagnóstico'),
          h(Boton, { variant: 'ghost', onClick: () => go('editor') }, '⚙️ Editor'))),
      h('div', { className: 'fp-hero' },
        h(Escarapela, { w: 110, className: 'fp-hero-rosette' }),
        h('h2', null, m.branding.heroTitle || ''),
        h('p', null, m.branding.heroSubtitle || '')),
      // Si hay premio de por medio, quien se acerca al tótem tiene derecho a
      // saberlo ANTES de jugar, y a saber que gana quien lo hace mejor y no
      // quien tiene suerte. Es lo que distingue esto de una ruleta.
      m.concurso && m.concurso.activo ? (function () {
        const est = estadoConcurso(m);
        const c = m.concurso;
        return h('div', { className: 'fp-concurso-banda' + (est.abierto ? '' : ' is-cerrado') },
          h('b', null, '⚖️ ' + (c.nombre ? c.nombre : 'Concurso de destreza') +
            (c.premio ? ' — ' + c.premio : '')),
          h('span', null, est.abierto
            ? 'Gana quien lo hace mejor, no quien tiene suerte. Juega desde la marca del piso y de frente a la cámara: la partida se vigila.'
            : est.motivo + ' Se puede jugar, pero los puntajes ya no entran al ranking.'));
      }()) : null,
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
    if (tipo === 'gato') return '👆 Táctil · 1 o 2 jugadores';
    if (tipo === 'gol') return '📷 Cuerpo entero (patada)';
    if (tipo === 'esquiva2d') return '📷 Medio cuerpo · o botones';
    if (tipo === 'esquiva3d') return '📷 Medio cuerpo · vista 3D';
    return '🎮 Juego';
  }

  // ══════════════════════════════════════════════════════════════════════
  // 14. Ranking
  // ══════════════════════════════════════════════════════════════════════

  function Ranking(props) {
    const [filtro, setFiltro] = useState('');
    const [verTodo, setVerTodo] = useState(false);
    const [respaldo, setRespaldo] = useState(null);
    const guardadas = props.model.scores || [];
    const [ficha, setFicha] = useState(null);
    // Orden determinista y documentado: ver REGLAS_DESEMPATE. Un empate
    // resuelto por el orden de llegada de un array es un empate resuelto por
    // casualidad, y en un concurso con premio eso no se puede defender.
    const rows = ordenarRanking(guardadas.filter((r) => !filtro || r.juego === filtro));
    const juegos = Array.from(new Set(guardadas.map((r) => r.juego).filter(Boolean)));
    // El tope de la lista es de VISTA: los datos están todos, se muestran los
    // mejores para que la pantalla del tótem no tarde en dibujar mil filas.
    const tope = Math.max(10, Math.round(num(props.model.ranking && props.model.ranking.mostrar, 60)));
    const visibles = verTodo ? rows : rows.slice(0, tope);
    const aviso = props.model.ranking && props.model.ranking.aviso;
    const pendiente = respaldo || tomarRespaldo();

    const exportar = () => {
      const csv = rankingCSV(rows);
      const bajo = descargar('funplai-ranking-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv', csv);
      setRespaldo(csv);
      notify(bajo ? 'success' : 'info', bajo
        ? 'Ranking exportado (' + rows.length + ' partidas).'
        : 'Este visor no deja descargar archivos: copia el CSV de abajo.');
    };

    return h('div', { className: 'fp-panel' },
      h('header', { className: 'fp-panel-head' },
        h(Boton, { variant: 'ghost', onClick: () => go('home') }, '← Volver'),
        h('h2', null, '🏆 Ranking del tótem'),
        h('div', { className: 'fp-chips' },
          h(Boton, { className: 'fp-btn--mini', variant: 'soft', onClick: exportar, disabled: !rows.length }, '⬇️ Exportar CSV'),
          h(Boton, {
            className: 'fp-btn--mini', variant: 'ghost', disabled: !guardadas.length,
            onClick: () => {
              if (!confirm('¿Borrar los ' + guardadas.length + ' puntajes guardados?\n\nSe descarga una copia antes.')) return;
              const n = vaciarRanking('vaciado');
              setRespaldo(tomarRespaldo());
              notify('info', 'Ranking vaciado. Se guardó una copia de ' + n + ' partidas.');
            },
          }, 'Vaciar'))),
      h('div', { className: 'fp-panel-body' },
        // Nada se pierde en silencio: si se truncó o si el host rechazó un
        // guardado, queda dicho acá hasta que alguien lo acuse recibo.
        aviso ? h('div', { className: 'fp-error' },
          aviso.motivo === 'guardado'
            ? '⚠ El equipo no pudo guardar (' + s(aviso.detalle) + '). Exporta el CSV antes de cerrar la app.'
            : aviso.motivo === 'tope'
              ? '⚠ Se llegó al tope del ranking y se apartaron ' + aviso.filas + ' partidas' +
                (aviso.descargado ? ' (el archivo se descargó)' : ' (cópialas del cuadro de abajo)') + '.'
              : '⚠ Se vaciaron ' + aviso.filas + ' partidas el ' + new Date(aviso.at).toLocaleString() + '. Se descargó una copia.',
          h('button', {
            className: 'fp-linkbtn',
            onClick: () => { patch({ ranking: { aviso: null } }); soltarRespaldo(); setRespaldo(null); },
          }, 'entendido')) : null,
        h('div', { className: 'fp-chips' },
          h('button', { className: 'fp-chip' + (filtro ? '' : ' is-on'), onClick: () => setFiltro('') }, 'Todos'),
          juegos.map((j) => h('button', { key: j, className: 'fp-chip' + (filtro === j ? ' is-on' : ''), onClick: () => setFiltro(j) }, j))),
        rows.length ? h('div', null,
          h('p', { className: 'fp-note' },
            'Guardadas ' + guardadas.length + ' partidas' +
            (rows.length !== guardadas.length ? ' · ' + rows.length + ' en este filtro' : '') +
            ' · mostrando ' + visibles.length +
            (rows.length > visibles.length ? ' de ' + rows.length : '')),
          h('table', { className: 'fp-table' },
            h('thead', null, h('tr', null,
              h('th', null, '#'), h('th', null, 'Jugador'), h('th', null, 'Juego'), h('th', null, 'Puntaje'),
              h('th', null, 'Fecha'), h('th', null, 'Partida'))),
            h('tbody', null, visibles.map((r, i) => {
              const a = r.auditoria || {};
              const marca = a.estado === 'invalida' ? '⛔' : a.estado === 'marcada' ? '⚠️' : a.estado === 'limpia' ? '✔' : '';
              return h('tr', { key: r.id, className: a.estado === 'invalida' ? 'is-invalida' : '' },
                h('td', null, i + 1), h('td', null, r.jugador || 'Anónimo'), h('td', null, r.juego),
                h('td', null, h('b', null, r.puntaje)),
                h('td', null, new Date(r.at).toLocaleString()),
                h('td', null, h('button', {
                  className: 'fp-linkbtn', onClick: () => setFicha(r),
                }, marca + ' ver ficha')));
            }))),
          rows.length > tope ? h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'ghost', onClick: () => setVerTodo(!verTodo) },
              verTodo ? 'Mostrar solo las ' + tope + ' mejores' : 'Ver las ' + rows.length + ' partidas')) : null)
          : h('p', { className: 'fp-empty' }, 'Todavía no hay puntajes guardados.'),
        // El respaldo se muestra copiable: en un visor que bloquea descargas,
        // esta es la única forma de que el operador se lleve los datos.
        // La ficha de una partida: lo que se le pone delante a quien reclama.
        // No es un adorno de transparencia, es la respuesta a "¿por qué él y no yo?".
        ficha ? (function () {
          const a = ficha.auditoria || {};
          const dato = (k, v) => h('li', null, h('b', null, k + ': '), v);
          return h('div', { className: 'fp-ficha' },
            h('div', { className: 'fp-ficha-head' },
              h('h4', null, '⚖️ Ficha de la partida'),
              h(Boton, { className: 'fp-btn--mini', variant: 'ghost', onClick: () => setFicha(null) }, 'Cerrar')),
            h('ul', null,
              dato('Jugador', ficha.jugador || 'Anónimo'),
              dato('Juego', ficha.juego),
              dato('Puntaje', String(ficha.puntaje)),
              dato('Fecha y hora', new Date(ficha.at).toLocaleString()),
              dato('Identificador', ficha.id),
              dato('Sesión del tótem', a.sesion || '—'),
              dato('Versión de la app', a.version || '—'),
              dato('Motor de pose', a.motor || '—'),
              dato('Modo concurso', a.concurso ? 'sí' : 'no'),
              a.estado ? dato('Estado de la partida',
                a.estado === 'limpia' ? '✔ limpia'
                  : a.estado === 'marcada' ? '⚠️ señalada — ' + s(a.motivo)
                    : a.estado === 'invalida' ? '⛔ fuera de las reglas — ' + s(a.motivo)
                      : 'sin datos de vigilancia') : null,
              a.fueraPct != null ? dato('Tiempo fuera de las reglas', Math.round(a.fueraPct * 100) + '% de ' + (a.muestras || 0) + ' cuadros') : null,
              a.referencia ? dato('Se colocó a', a.referencia.distancia + ' cm, hombros ' + a.referencia.hombros + ' cm') : null),
            h('h4', { className: 'fp-h4' }, 'Cómo se resuelven los empates'),
            h('ol', { className: 'fp-pasos' }, REGLAS_DESEMPATE.map((t, i) => h('li', { key: i }, t))));
        }()) : null,
        pendiente ? h('div', null,
          h('h4', { className: 'fp-h4' }, 'Respaldo para copiar'),
          h(Campo, { label: 'CSV del ranking', type: 'textarea', rows: 10, value: pendiente, onChange: () => {} })) : null));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 14.b Métricas de activación: lo que compra el auspiciador
  // ══════════════════════════════════════════════════════════════════════
  //
  // El auspiciador no compra diversión: compra contactos y métricas. Y lo que
  // hace vendible esta pantalla es justamente lo que NO tiene dentro — ningún
  // dato de nadie. Todo son contadores agregados, así que se le puede entregar
  // entero al cliente sin pedirle permiso a un solo participante.

  function Metricas(props) {
    const m = props.model;
    const r = resumenMetricas(m);
    const contactos = (m.contacto && m.contacto.registros) || [];
    const [verContactos, setVerContactos] = useState(false);
    const seg = (ms) => (ms < 90000 ? Math.round(ms / 1000) + ' s' : Math.round(ms / 60000) + ' min');
    const horas = Object.keys(r.horas).sort((a, b) => Number(a) - Number(b));
    const picoHora = horas.reduce((a, hh) => (r.horas[hh] > (r.horas[a] || 0) ? hh : a), horas[0]);

    return h('div', { className: 'fp-panel' },
      h('header', { className: 'fp-panel-head' },
        h(Boton, { variant: 'ghost', onClick: () => go('home') }, '← Volver'),
        h('h2', null, '📊 Métricas de la activación'),
        h('div', { className: 'fp-chips' },
          h(Boton, {
            className: 'fp-btn--mini', variant: 'soft', disabled: !r.aperturas,
            onClick: () => {
              descargar('funplai-metricas-' + new Date().toISOString().slice(0, 10) + '.csv', metricasCSV(m));
              notify('success', 'Métricas exportadas.');
            },
          }, '⬇️ Exportar métricas'))),
      h('div', { className: 'fp-panel-body' },
        h('p', { className: 'fp-lead' },
          'Todo lo de esta pantalla es agregado: cuenta cuántas veces pasó algo, no a quién le pasó. ' +
          'Se puede entregar entero al auspiciador sin pedirle permiso a nadie, porque no hay nadie dentro.'),
        !r.aperturas
          ? h('p', { className: 'fp-empty' }, 'Todavía no hay actividad. Los contadores se llenan solos jugando.')
          : h('div', null,
              h('div', { className: 'fp-medidas' },
                h('div', { className: 'fp-medida is-ok' }, h('b', null, r.atendidas), h('span', null, 'personas atendidas')),
                h('div', { className: 'fp-medida' }, h('b', null, r.partidas), h('span', null, 'partidas jugadas')),
                h('div', { className: 'fp-medida' }, h('b', null, seg(r.exposicionMs)), h('span', null, 'tiempo de exposición')),
                h('div', { className: 'fp-medida' }, h('b', null, r.personasPorHora == null ? '—' : r.personasPorHora), h('span', null, 'personas por hora')),
                h('div', { className: 'fp-medida' + (r.contactos.tasa != null ? ' is-ok' : '') },
                  h('b', null, r.contactos.tasa == null ? '—' : r.contactos.tasa + '%'),
                  h('span', null, 'conversión a contacto')),
                h('div', { className: 'fp-medida' }, h('b', null, picoHora ? picoHora + ':00' : '—'), h('span', null, 'hora de más afluencia'))),
              // Este matiz no es una nota al pie: es la diferencia entre una
              // métrica honesta y una que promete lo que no puede cumplir.
              h('p', { className: 'fp-note' },
                '«Personas atendidas» cuenta las veces que alguien ocupó el tótem, NO personas distintas. ' +
                'La app no reconoce a nadie entre partidas y no va a hacerlo: si la misma persona juega dos ' +
                'veces, cuenta dos. Llamarle «jugadores únicos» sería vender una medición que no existe.'),
              h('h3', { className: 'fp-h3' }, 'Preferencia revelada, juego por juego'),
              h('p', { className: 'fp-note' },
                'Qué eligió la gente, qué abandonó y qué repitió. Es lo que de verdad dice sus intereses, ' +
                'y no hace falta inferir nada de ninguna cara para saberlo.'),
              h('table', { className: 'fp-table' },
                h('thead', null, h('tr', null,
                  h('th', null, 'Juego'), h('th', null, 'Se acercaron'), h('th', null, 'Partidas'),
                  h('th', null, 'Repitieron'), h('th', null, 'Abandono'), h('th', null, 'Puntaje medio'))),
                h('tbody', null, r.filas.map((f) => h('tr', { key: f.id },
                  h('td', null, f.nombre),
                  h('td', null, f.aperturas),
                  h('td', null, f.partidas),
                  h('td', null, f.repeticiones),
                  h('td', null, f.abandono == null ? '—' : f.abandono + '%'),
                  h('td', null, f.promedio == null ? '—' : f.promedio))))),
              horas.length ? h('div', null,
                h('h3', { className: 'fp-h3' }, 'Afluencia por hora'),
                h('table', { className: 'fp-table' },
                  h('thead', null, h('tr', null, h('th', null, 'Hora'), h('th', null, 'Se acercaron'))),
                  h('tbody', null, horas.map((hh) => h('tr', { key: hh },
                    h('td', null, hh + ':00'), h('td', null, r.horas[hh])))))) : null),

        h('h3', { className: 'fp-h3' }, 'Contactos entregados voluntariamente'),
        h('p', { className: 'fp-note' },
          contactos.length
            ? contactos.length + ' persona(s) pidieron que las contactaran, sobre ' + r.contactos.ofrecidos +
              ' a quienes se les ofreció. Cada registro guarda el TEXTO exacto que aceptó, no un «sí» suelto.'
            : 'Nadie ha dejado datos todavía. El formulario se ofrece después de jugar y no viene con ninguna casilla marcada.'),
        contactos.length ? h('div', null,
          h('div', { className: 'fp-actions' },
            h(Boton, { variant: 'ghost', onClick: () => setVerContactos(!verContactos) },
              verContactos ? 'Ocultar' : 'Ver los ' + contactos.length + ' contactos'),
            h(Boton, {
              variant: 'soft',
              onClick: () => {
                descargar('funplai-contactos-' + new Date().toISOString().slice(0, 10) + '.csv', contactosCSV(contactos));
                notify('success', 'Contactos exportados. Entrégaselos al responsable y bórralos del tótem.');
              },
            }, '⬇️ Exportar contactos'),
            h(Boton, {
              variant: 'danger',
              onClick: () => {
                if (!confirm('¿Borrar los ' + contactos.length + ' contactos del tótem?\n\nExpórtalos antes si todavía no se los entregaste al responsable.')) return;
                patch({ contacto: { registros: [] } });
                notify('info', 'Contactos borrados del equipo.');
              },
            }, 'Borrar del tótem')),
          verContactos ? h('table', { className: 'fp-table' },
            h('thead', null, h('tr', null,
              h('th', null, 'Fecha'), h('th', null, 'Nombre'), h('th', null, 'Correo'), h('th', null, 'Aceptó'))),
            h('tbody', null, contactos.slice().reverse().map((x) => h('tr', { key: x.id },
              h('td', null, new Date(x.at).toLocaleString()),
              h('td', null, x.nombre || '—'),
              h('td', null, x.correo || '—'),
              h('td', null, Object.keys(x.acepto || {}).join(', ')))))) : null) : null,

        h('h3', { className: 'fp-h3' }, 'Qué se mide y qué no'),
        h('div', { className: 'fp-semaforo' },
          h('div', { className: 'is-verde' },
            h('b', null, '🟢 Se mide siempre, sin pedirle nada a nadie'),
            'Cuánta gente se acercó, qué juego eligió, cuál abandonó, cuál repitió, cuánto duró cada ' +
            'partida, a qué hora, y los puntajes. Todo agregado: son contadores, no un registro de personas.'),
          h('div', { className: 'is-amarillo' },
            h('b', null, '🟡 Solo si la persona lo pide, casilla por casilla'),
            'Nombre, correo, teléfono, edad declarada por ella misma, y el permiso para usar su foto —que ' +
            'va aparte, porque una imagen no es un correo—. Se ofrece DESPUÉS de jugar, nada viene marcado, ' +
            'y se puede jugar y ganar sin dejar nada.'),
          h('div', { className: 'is-rojo' },
            h('b', null, '🔴 No se hace, y no es una limitación técnica'),
            'Estimar edad o género por la cara, inferir emociones o conductas por la cámara, y reconocer a ' +
            'la misma persona entre partidas. No está implementado, no está a medias, y no se va a agregar. ' +
            'Con el modo sensor, además, la imagen ni siquiera sale del teléfono.')),
        h('p', { className: 'fp-note' },
          'Finalidades, plazos de conservación y quién responde por cada dato: ',
          h('code', null, 'docs/PRIVACIDAD.md'), '.')));
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
    const [cuerpo, setCuerpo] = useState(null);      // parametrización en cm
    const [midiendo, setMidiendo] = useState(false);
    const [kin, setKin] = useState(null);            // estado del puente Kinect
    const [oyendoKinect, setOyendoKinect] = useState(false);
    const kinRef = useRef({ parar: null, prov: null });
    const medirRef = useRef({ parar: null, prov: null, stream: null });
    const videoRef = useRef(null);
    const stopRef = useRef(null);
    // Autocalibración del montaje.
    const [cal, setCal] = useState(null);   // {paso, aviso, progreso, posiciones, resultado}
    const calRef = useRef({ parar: null, prov: null, stream: null, cal: null });
    // Prueba de campo: el veredicto de 20 segundos.
    const [campo, setCampo] = useState(null);
    const campoRef = useRef({ parar: null, prov: null, stream: null, luz: null });
    // Emparejamiento del teléfono como sensor.
    const [sensor, setSensor] = useState(null);
    const [oyendoSensor, setOyendoSensor] = useState(false);
    const sensorRef = useRef({ enlace: null, parar: null });

    useEffect(() => () => {
      if (stopRef.current) stopRef.current();
      const M = medirRef.current;
      if (M.parar) M.parar();
      try { M.prov && M.prov.detener(); } catch (e) { /* noop */ }
      if (M.stream) { try { M.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      const K = kinRef.current;
      if (K.parar) K.parar();
      try { K.prov && K.prov.detener(); } catch (e) { /* noop */ }
      const C = calRef.current;
      if (C.parar) C.parar();
      try { C.prov && C.prov.detener(); } catch (e) { /* noop */ }
      if (C.stream) { try { C.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      const F = campoRef.current;
      if (F.parar) F.parar();
      try { F.prov && F.prov.detener(); } catch (e) { /* noop */ }
      if (F.stream) { try { F.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      const S = sensorRef.current;
      if (S.parar) S.parar();
      try { S.enlace && S.enlace.detener(); } catch (e) { /* noop */ }
    }, []);

    /**
     * Escucha el enlace con el teléfono y muestra TODO lo que llega. Es el
     * equivalente de la tarjeta del puente Kinect: sirve para saber, en el
     * equipo del cliente, si el problema es el teléfono, la red o la app.
     */
    const escucharSensor = () => {
      const S = sensorRef.current;
      if (oyendoSensor) {
        if (S.parar) S.parar();
        try { S.enlace && S.enlace.detener(); } catch (e) { /* noop */ }
        S.parar = null; S.enlace = null;
        setOyendoSensor(false);
        return;
      }
      const sala = salaDelTotem();
      S.enlace = enlaceSensor({ rol: 'pantalla', hw: model.hardware, sala });
      S.enlace.iniciar();
      setOyendoSensor(true);
      let ultimo = 0;
      S.parar = loop(() => {
        const t = nowMs();
        if (t - ultimo < 400) return;
        ultimo = t;
        const sal = S.enlace.salud();
        setSensor({ salud: sal, veredicto: veredictoDeEnlace(sal, model.hardware) });
      });
    };

    /** Otro código: sirve si dos tótems de la misma feria chocan. */
    const nuevaSala = () => {
      if (oyendoSensor) escucharSensor();
      patch({ hardware: { sensorSala: codigoDeSala(6) } });
      setSensor(null);
      notify('info', 'Código de sala nuevo. Hay que volver a escanear el QR desde el teléfono.');
    };

    // ── Prueba de campo ────────────────────────────────────────────────
    //
    // Un solo botón que responde la pregunta del día del evento: ¿sirve este
    // montaje, ahora, en esta sala? Corre el MISMO proveedor de pose que los
    // juegos —con su recorte y su tubería— para que lo medido sea lo que va a
    // pasar jugando, y no un banco de pruebas amable.
    const soltarCampo = () => {
      const F = campoRef.current;
      if (F.parar) F.parar();
      try { F.prov && F.prov.detener(); } catch (e) { /* noop */ }
      if (F.stream) { try { F.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      F.parar = null; F.prov = null; F.stream = null; F.luz = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    };

    const correrCampo = async () => {
      const F = campoRef.current;
      if (F.prov) { soltarCampo(); setCampo(null); return; }
      setCargando('campo'); setCampo(null);
      let v = null;
      try {
        F.stream = await abrirCamara(model.hardware);
        v = videoRef.current;
        v.srcObject = F.stream;
        await v.play().catch(() => {});
        const prov = proveedorMediaPipe(model.hardware, model.espacio);
        await prov.iniciar(v);
        F.prov = prov;
        F.luz = medidorDeLuz();
      } catch (e) {
        soltarCampo();
        setCargando('');
        setCampo({ fase: 'error', aviso: mensajeCamara(e) });
        return;
      }
      setCargando('');
      const t0 = nowMs();
      const acum = { hz: [], ms: [], luz: [], grupos: {}, cuadros: 0, conPersona: 0, recorte: false };
      setCampo({ fase: 'midiendo', progreso: 0, conPersona: false });
      let ultimo = 0;
      F.parar = loop(() => {
        const t = nowMs();
        const progreso = clamp((t - t0) / CAMPO_MS, 0, 1);
        if (t - ultimo >= 180) {
          ultimo = t;
          const lec = F.prov.leer();
          const sal = F.prov.salud();
          const L = lec && lec.landmarks;
          // Con alguien delante se mide sobre su caja; mientras no llega nadie,
          // sobre la zona de juego, que es donde va a estar.
          const caja = cajaDePose(L) || (sal.zona && sal.zona.valida ? sal.zona : null);
          const lz = F.luz.medir(v, caja);
          // Se anota si la caja venía de un CUERPO o de la zona vacía: no es lo
          // mismo medir la luz sobre una persona que sobre el piso donde estará.
          if (lz) { lz.cuerpo = !!L; acum.luz.push(lz); }
          if (sal.hz) acum.hz.push(sal.hz);
          if (sal.ms) acum.ms.push(sal.ms);
          if (sal.recorte) acum.recorte = true;
          acum.cuadros++;
          if (L) {
            acum.conPersona++;
            const gr = (lec.confianza && lec.confianza.grupos) || {};
            for (const k of Object.keys(gr)) (acum.grupos[k] = acum.grupos[k] || []).push(gr[k].media);
          }
          setCampo({ fase: 'midiendo', progreso, conPersona: acum.conPersona > 2, luz: lz });
        }
        if (progreso < 1) return;
        // ── Cierre: de las muestras al veredicto ────────────────────────
        F.parar(); F.parar = null;
        const sal = F.prov.salud();
        const grupos = {};
        for (const k of Object.keys(acum.grupos)) {
          const arr = acum.grupos[k];
          grupos[k] = round1((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
        }
        const res = {
          hz: mediana(acum.hz) || 0, ms: mediana(acum.ms) || 0,
          aceptados: num(sal.aceptados, 0), rechazados: num(sal.rechazados, 0),
          recorte: acum.recorte, cuadros: acum.cuadros, grupos,
          conPersona: acum.conPersona > 2, aspecto: sal.aspecto,
          zona: sal.zona, luz: resumirLuz(acum.luz, F.luz.ruidoBase()),
        };
        soltarCampo();
        setCampo({ fase: 'listo', res, veredicto: veredictoDeCampo(res, model.hardware), at: new Date() });
      });
    };

    /**
     * Deduce a qué altura y con qué inclinación está la cámara mirando a una
     * persona. Con Kinect sale del plano del piso en una toma; con una cámara
     * corriente hay que pararse en dos sitios a distinta distancia, porque una
     * sola pose deja una curva de montajes posibles en vez de uno.
     */
    const soltarCalibracion = () => {
      const C = calRef.current;
      if (C.parar) C.parar();
      try { C.prov && C.prov.detener(); } catch (e) { /* noop */ }
      if (C.stream) { try { C.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      C.parar = null; C.prov = null; C.stream = null; C.cal = null;
      if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) { /* noop */ } }
    };

    const calibrar = async () => {
      const C = calRef.current;
      if (C.cal) { soltarCalibracion(); setCal(null); return; }
      setCargando('calibrar');
      try {
        const g = camaraGeometria(model.espacio, 16 / 9);
        C.cal = calibradorMontaje({ estatura: num(model.espacio.estaturaReferencia, 170), fovV: g.fovV });
        C.prov = await arrancarPose(model.hardware, videoRef, C);
      } catch (e) {
        soltarCalibracion();
        setCargando('');
        setCal({ paso: 'error', aviso: mensajeCamara(e) });
        return;
      }
      setCargando('');
      setCal({ paso: 'tomando', aviso: '', progreso: 0, posiciones: 0, hayLectura: false });
      let ultimo = 0, hayLectura = false;
      C.parar = loop(() => {
        const t = nowMs();
        if (t - ultimo < 120) return;
        ultimo = t;
        const lec = C.prov.leer();
        const motivo = C.cal.muestra(lec && lec.landmarks, lec && lec.kinect);
        // Hasta que el motor de pose entrega su primera lectura no se sabe
        // nada: decir "te veo bien" ahí seria mentir, y el operador se queda
        // esperando una barra que no se mueve sin entender por que.
        if (!hayLectura && lec) hayLectura = true;
        // Con Kinect el plano del piso cierra la calibración de una: no tiene
        // sentido pedirle a nadie que camine.
        if (C.cal.listo() && C.cal.posiciones() === 0) {
          const r = C.cal.resultado();
          if (r) { setCal({ paso: 'listo', resultado: r }); C.parar(); C.parar = null; return; }
        }
        setCal({
          paso: 'tomando', aviso: motivo || '', hayLectura,
          progreso: C.cal.progreso(), posiciones: C.cal.posiciones(),
        });
      });
    };

    /** Cierra la toma actual: "ya estoy en esta posición". */
    const fijarPosicion = () => {
      const C = calRef.current;
      if (!C.cal || !C.cal.fijarPosicion()) return;
      const r = C.cal.resultado();
      if (r) {
        if (C.parar) { C.parar(); C.parar = null; }
        setCal({ paso: 'listo', resultado: r });
      } else {
        setCal({ paso: 'tomando', aviso: '', hayLectura: true, progreso: 0, posiciones: C.cal.posiciones() });
      }
    };

    /** Escribe el montaje deducido en el espacio de juego. */
    const aplicarCalibracion = () => {
      const r = cal && cal.resultado;
      if (!r) return;
      const cambio = { camaraAltura: r.camaraAltura, camaraInclinacion: Math.round(r.camaraInclinacion) };
      // La distancia medida es la mejor marca de piso posible: es donde la
      // persona se paró de verdad y donde la cámara la vio entera.
      if (r.distancias && r.distancias.length) {
        cambio.distanciaZona = Math.round(r.distancias.reduce((a, b) => a + b, 0) / r.distancias.length);
        // La profundidad de la sala tiene que dar para esa marca y algo más.
        cambio.profundidad = Math.max(num(model.espacio.profundidad, 250), cambio.distanciaZona + 40);
      }
      // Autorregular el TAMAÑO: el volumen de juego se ajusta a quien juega.
      // Exigir 240 cm de franja para un curso de niños obliga a alejar la
      // cámara sin necesidad y deja fuera montajes que servían perfectamente.
      const est = num(model.espacio.estaturaReferencia, 170);
      cambio.alto = Math.round(clamp(est * 1.35, 150, 260));
      patch({ espacio: cambio });
      notify('success', 'Montaje aplicado: cámara a ' + r.camaraAltura + ' cm, inclinada ' +
        Math.round(r.camaraInclinacion) + '°, franja de ' + cambio.alto + ' cm.');
      soltarCalibracion();
      setCal(null);
    };

    /**
     * Escucha el puente Kinect y muestra TODO lo que llega: sirve para saber,
     * en el tótem del cliente, si el problema es el puente, el sensor o la app.
     */
    const escucharKinect = async () => {
      const K = kinRef.current;
      if (oyendoKinect) {                               // segundo toque: detener
        if (K.parar) K.parar();
        try { K.prov && K.prov.detener(); } catch (e) { /* noop */ }
        K.parar = null; K.prov = null;
        setOyendoKinect(false);
        return;
      }
      setCargando('kinect'); setKin(null);
      const prov = proveedorKinect(model.hardware, model.espacio);
      try {
        await prov.iniciar();
      } catch (e) {
        setCargando('');
        try { prov.detener(); } catch (err) { /* noop */ }
        setKin({ error: e && e.message ? e.message : String(e) });
        return;
      }
      K.prov = prov;
      setOyendoKinect(true);
      setCargando('');
      let ultimo = 0;
      K.parar = loop(() => {
        const t = nowMs();
        if (t - ultimo < 220) return;
        ultimo = t;
        const lec = prov.leer();
        const k = lec && lec.kinect;
        const L = lec && lec.landmarks;
        setKin({
          salud: prov.salud(),
          hay: !!k,
          manoI: k ? k.manoI : null, manoD: k ? k.manoD : null,
          confI: k ? k.confianzaManoI : 0, confD: k ? k.confianzaManoD : 0,
          lean: k ? k.lean : null,
          distancia: k ? k.distancia : null,
          estatura: k ? k.estatura : null,
          piso: k ? k.piso : null,
          orientaciones: k && k.orientaciones ? k.orientaciones.filter(Boolean).length : 0,
          cuerpos: k ? k.cuerposEnEscena : 0,
          seguidas: L ? L.filter((p) => p && p.visibility > 0.6).length : 0,
        });
      });
    };

    /**
     * Mide al participante en centímetros: distancia, altura, envergadura y
     * todos los puntos de articulación, usando la geometría declarada del
     * espacio de juego.
     */
    const medirParticipante = async () => {
      const M = medirRef.current;
      if (midiendo) {                                   // segundo toque: detener
        if (M.parar) M.parar();
        try { M.prov && M.prov.detener(); } catch (e) { /* noop */ }
        if (M.stream) { try { M.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
        M.parar = null; M.prov = null; M.stream = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setMidiendo(false);
        return;
      }
      setCargando('cuerpo');
      try {
        const stream = await abrirCamara(model.hardware);
        M.stream = stream;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const prov = proveedorMediaPipe(model.hardware, model.espacio);
        await prov.iniciar(v);
        M.prov = prov;
        setMidiendo(true);
        setCargando('');
        let ultimo = 0;
        M.parar = loop(() => {
          const lec = prov.leer();
          const L = lec && lec.landmarks;
          const t = nowMs();
          if (t - ultimo < 200) return;
          ultimo = t;
          const aspecto = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
          setCuerpo(Object.assign(
            { landmarks: L, aspecto: aspecto },
            L ? medirCuerpo(L, model.espacio, aspecto, lec && lec.mundo) : { ok: false, motivo: 'Sin persona detectada' },
          ));
        });
      } catch (e) {
        setCargando('');
        setCuerpo({ ok: false, motivo: mensajeCamara(e) });
      }
    };

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
        notify('warn', 'No se pudieron listar cámaras: ' + mensajeCamara(e));
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
        setPrueba({ error: mensajeCamara(e) });
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
        const prov = proveedorMediaPipe(model.hardware, model.espacio);
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
        setPose({ ok: false, error: mensajeCamara(e), ms: Math.round(nowMs() - t0) });
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
        // ── Prueba de campo ───────────────────────────────────────────
        // Va arriba de todo y a propósito: el día del evento nadie va a leer
        // ocho tarjetas. Un botón, veinte segundos, un semáforo y qué hacer.
        h('div', { className: 'fp-campo' + (campo && campo.fase === 'listo' ? ' is-' + campo.veredicto.nivel : '') },
          h('h3', null, '▶ Prueba de campo — veredicto en 20 segundos'),
          h('p', { className: 'fp-note' },
            'Párate en la marca del piso, de frente y con el cuerpo entero en el cuadro, y no te muevas ' +
            'demasiado. Se mide con el mismo motor y el mismo recorte que usan los juegos: lo que salga ' +
            'acá es lo que va a pasar jugando.'),
          h(Boton, {
            variant: campo && campo.fase === 'midiendo' ? 'danger' : 'primary',
            onClick: correrCampo, disabled: cargando === 'campo',
          }, cargando === 'campo' ? 'Abriendo cámara y motor…'
            : campo && campo.fase === 'midiendo' ? 'Cancelar' : '▶ Correr la prueba de campo'),
          campo && campo.fase === 'error' ? h('p', { className: 'fp-error' }, '⚠ ' + campo.aviso) : null,
          campo && campo.fase === 'midiendo'
            ? h('div', { className: 'fp-autocal' },
                h('div', { className: 'fp-progress' }, h('i', { style: { width: Math.round(campo.progreso * 100) + '%' } })),
                h('p', { className: 'fp-note' }, campo.conPersona
                  ? 'Te veo. Quédate ahí ' + Math.max(1, Math.ceil((1 - campo.progreso) * (CAMPO_MS / 1000))) + ' s más…'
                  : 'Todavía no veo a nadie: ponte en la marca del piso, de frente al tótem.'))
            : null,
          campo && campo.fase === 'listo'
            ? h('div', { className: 'fp-campo-res' },
                h('div', { className: 'fp-campo-semaforo is-' + campo.veredicto.nivel },
                  h('b', null, campo.veredicto.nivel === 'ok' ? '✅' : campo.veredicto.nivel === 'aviso' ? '⚠️' : '❌'),
                  h('span', null, campo.veredicto.titulo)),
                h('div', { className: 'fp-medidas' },
                  h('div', { className: 'fp-medida' + (campo.res.hz >= 18 ? ' is-ok' : ' is-mal') },
                    h('b', null, campo.res.hz + ' fps'), h('span', null, 'pose real (' + campo.res.ms + ' ms)')),
                  h('div', { className: 'fp-medida' + (campo.veredicto.luz.nivel === 'ok' && campo.veredicto.luz.deCuerpo ? ' is-ok' : ' is-mal') },
                    h('b', null, campo.res.luz ? Math.round(campo.veredicto.luz.nivelLuz) : '—'),
                    h('span', null, campo.veredicto.luz.deCuerpo
                      ? 'luz sobre el sujeto (0–255)'
                      : 'luz sobre la zona VACÍA (0–255)')),
                  h('div', { className: 'fp-medida' + (campo.res.luz && campo.res.luz.contraluz != null && campo.res.luz.contraluz > num(model.hardware.contraluzMax, 60) ? ' is-mal' : ' is-ok') },
                    h('b', null, campo.res.luz && campo.res.luz.contraluz != null ? (campo.res.luz.contraluz > 0 ? '+' : '') + Math.round(campo.res.luz.contraluz) : '—'),
                    h('span', null, 'fondo menos sujeto (contraluz)')),
                  h('div', { className: 'fp-medida' + (campo.res.luz && campo.res.luz.ruido != null && campo.res.luz.ruido <= num(model.hardware.luzRuidoMax, 4.5) ? ' is-ok' : ' is-mal') },
                    h('b', null, campo.res.luz && campo.res.luz.ruido != null ? campo.res.luz.ruido.toFixed(1) : '—'),
                    h('span', null, 'ruido de imagen (ganancia)')),
                  h('div', { className: 'fp-medida' + (campo.res.zona && campo.res.zona.cubre && campo.res.zona.cubre.alto > 0.92 ? ' is-ok' : ' is-mal') },
                    h('b', null, campo.res.zona && campo.res.zona.cubre ? Math.round(campo.res.zona.cubre.alto * 100) + '%' : '—'),
                    h('span', null, 'de la zona cabe en el cuadro')),
                  h('div', { className: 'fp-medida' + (campo.res.aceptados + campo.res.rechazados > 0 && campo.res.rechazados / (campo.res.aceptados + campo.res.rechazados) <= 0.25 ? ' is-ok' : ' is-mal') },
                    h('b', null, campo.res.aceptados + campo.res.rechazados
                      ? Math.round((campo.res.rechazados / (campo.res.aceptados + campo.res.rechazados)) * 100) + '%'
                      : '—'),
                    h('span', null, 'cuadros descartados'))),
                h('ul', { className: 'fp-campo-lista' }, campo.veredicto.puntos.map((p, i) => h('li', {
                  key: i, className: 'is-' + p.nivel,
                }, (p.nivel === 'ok' ? '✅ ' : p.nivel === 'aviso' ? '⚠️ ' : '❌ ') + p.texto))),
                h('div', { className: 'fp-chips' },
                  Object.keys(campo.res.grupos).map((k) => h(Chip, { key: k },
                    k + ': ' + Math.round(campo.res.grupos[k] * 100) + '%'))),
                h('p', { className: 'fp-note' },
                  'Medido a las ' + campo.at.toLocaleTimeString() + ' sobre ' + campo.res.cuadros + ' lecturas' +
                  (campo.res.aspecto ? ', cámara ' + round1(campo.res.aspecto) + ':1' : '') + '. ' +
                  'Los umbrales de luz (' + num(model.hardware.luzMinima, 80) + ' de nivel, ' +
                  num(model.hardware.luzRuidoMax, 4.5) + ' de ruido, ' + num(model.hardware.contraluzMax, 60) +
                  ' de contraluz) se ajustan en ⚙️ Editor → 🔌 Hardware: la medición es del equipo, el listón lo pones tú.'))
            : null),
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
              }, 'usar esta')))) : h('p', null, 'No se detectaron cámaras.')) : null,
            h('p', { className: 'fp-note' },
              'Acá solo salen las webcam. El Kinect no aparece nunca, aunque esté conectado y funcionando: ' +
              'no expone video al sistema. Se comprueba en la tarjeta 5.')),
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
            h('h3', null, '5. Kinect for Xbox One (puente)'),
            h('p', { className: 'fp-note' },
              'Escucha el puente en ' + (s(model.hardware.kinectUrl) || 'ws://127.0.0.1:8787') +
              '. Sin sensor a mano: node puente-kinect/simulador.mjs'),
            h(Boton, { variant: oyendoKinect ? 'danger' : 'soft', onClick: escucharKinect, disabled: cargando === 'kinect' },
              cargando === 'kinect' ? 'Conectando…' : oyendoKinect ? 'Dejar de escuchar' : 'Probar el puente'),
            kin ? (kin.error
              ? h('div', null,
                  h('p', { className: 'fp-error' }, '⚠ ' + kin.error),
                  // Un "no se pudo conectar" a secas deja al operador sin
                  // saber si le falta un cable, un driver o un programa. Estos
                  // son los pasos, en el orden en que fallan de verdad.
                  h('ol', { className: 'fp-pasos' },
                    h('li', null, 'El Kinect ', h('b', null, 'no es una webcam'), ': no sale en "2. Cámaras conectadas" ni aunque esté enchufado y funcionando. Llega solo por el puente.'),
                    h('li', null, 'Enchúfalo con su adaptador a un puerto ', h('b', null, 'USB 3.0'), ' que no comparta con nada más. La luz del sensor tiene que quedar encendida.'),
                    h('li', null, 'Instala el ', h('b', null, 'Kinect for Windows Runtime 2.0'), ' (gratis, de Microsoft).'),
                    h('li', null, 'Arranca el puente en este mismo equipo: doble clic en ', h('code', null, 'puente-kinect\\puente.cmd'), '.'),
                    h('li', null, 'Sin sensor a mano, para ver la app moverse: ', h('code', null, 'puente-kinect\\simulador.cmd'), '.'),
                    h('li', null, 'Comprueba que la URL de arriba coincida con el puerto del puente, en ⚙️ Editor → 🔌 Hardware.')))
              : h('ul', null,
                  h('li', null, (kin.salud.vivo ? '✅' : '⏳') + ' Puente: ' + kin.salud.estado + ' · ' + kin.salud.cuadros + ' cuadros'),
                  h('li', null, (kin.hay ? '✅' : '❌') + ' Cuerpos en escena: ' + kin.cuerpos +
                    (kin.hay ? ' · ' + kin.seguidas + ' de 33 puntos seguidos' : ' — ponte frente al sensor')),
                  kin.hay ? h('li', null, '🖐 Manos: izquierda ' + kin.manoI + ' (confianza ' + kin.confI + ') · derecha ' + kin.manoD + ' (confianza ' + kin.confD + ')') : null,
                  kin.hay && kin.lean ? h('li', null, '↔️ Inclinación del torso: x ' + kin.lean.x.toFixed(2) + ' · y ' + kin.lean.y.toFixed(2)) : null,
                  kin.hay ? h('li', null, '📏 Distancia: ' + (kin.distancia != null ? kin.distancia.toFixed(2) + ' m' : '—') +
                    ' · altura de la cabeza sobre el piso: ' + (kin.estatura != null ? Math.round(kin.estatura) + ' cm' : '—')) : null,
                  h('li', null, (kin.piso ? '✅' : '❌') + ' Plano del piso' +
                    (kin.piso ? '' : ' — sin él, el salto se calibra con los hombros')),
                  h('li', null, (kin.orientaciones ? '✅ ' + kin.orientaciones : '❌ 0') + ' orientaciones de hueso'),
                  // Si alguien está delante y el juego no lo toma, casi
                  // siempre es esto: quedó fuera del rango configurado.
                  kin.salud.fueraDeRango
                    ? h('li', null, '⚠️ ' + kin.salud.fueraDeRango + ' persona(s) vistas pero FUERA del rango de juego (' +
                        kin.salud.propiedades.minCm + '–' + kin.salud.propiedades.maxCm + ' cm). Se ajusta en ⚙️ Editor → 🔌 Hardware.')
                    : null,
                  h('li', { className: 'fp-note' }, 'Propiedades aplicadas: juega ' +
                    (kin.salud.propiedades.cuerpoModo === 'primero' ? 'el primero seguido' : 'el más cercano') +
                    ' · rango ' + kin.salud.propiedades.minCm + '–' + kin.salud.propiedades.maxCm + ' cm' +
                    ' · suavizado ' + kin.salud.propiedades.suave +
                    ' · piso ' + (kin.salud.propiedades.usarPiso ? 'sí' : 'no') +
                    ' · inclinación ' + (kin.salud.propiedades.usarLean ? 'sí' : 'no') +
                    ' · manos ' + (kin.salud.propiedades.usarManos ? 'sí' : 'no') + '.'),
                  h('li', { className: 'fp-note' }, 'El Kinect v2 no entrega esqueleto de dedos: la mano son muñeca, punta y pulgar más el estado abierta/cerrada/señalando.')))
              : null),
          h('div', { className: 'fp-diag-card' },
            h('h3', null, '6. Puntero / pistola laser'),
            h('div', {
              className: 'fp-target-test',
              onPointerDown: (e) => setPuntero({ tipo: e.pointerType, x: Math.round(e.clientX), y: Math.round(e.clientY), presion: e.pressure }),
            }, 'Dispara o toca aquí'),
            puntero ? h('ul', null,
              h('li', null, 'Tipo de puntero: ' + puntero.tipo + (puntero.tipo === 'mouse' ? ' (compatible con lightgun IR en modo mouse absoluto)' : '')),
              h('li', null, 'Coordenadas: ' + puntero.x + ', ' + puntero.y)) : null),
          h('div', { className: 'fp-diag-card fp-diag-card--ancha' },
            h('h3', null, '7. Autocalibrar el montaje (cámara a cualquier altura)'),
            h('p', { className: 'fp-note' },
              'La app no necesita que midas con huincha. Se para alguien delante y ella deduce a qué ' +
              'altura y con qué inclinación está la cámara, sea un teléfono en un trípode a 60 cm, una ' +
              'tablet a 120 o el tótem a 175. Con Kinect sale de una, del plano del piso; con una cámara ' +
              'corriente hay que pararse en dos sitios a distinta distancia.'),
            h('div', { className: 'fp-form' },
              h(Campo, {
                label: 'Estatura de quien calibra (cm)', type: 'number', min: 90, max: 220,
                value: model.espacio.estaturaReferencia,
                help: 'Es la referencia que convierte píxeles en centímetros. Cuanto más exacta, mejor la medida.',
                onChange: (v) => patch({ espacio: { estaturaReferencia: v } }),
              })),
            h(Boton, {
              variant: cal && cal.paso === 'tomando' ? 'danger' : 'soft',
              onClick: calibrar, disabled: cargando === 'calibrar',
            }, cargando === 'calibrar' ? 'Abriendo…'
              : cal && cal.paso === 'tomando' ? 'Cancelar calibración' : '📐 Calibrar el montaje'),
            cal && cal.paso === 'error' ? h('p', { className: 'fp-error' }, '⚠ ' + cal.aviso) : null,
            cal && cal.paso === 'tomando'
              ? h('div', { className: 'fp-autocal' },
                  h('p', { className: 'fp-lead' }, cal.posiciones === 0
                    ? '1 de 2 · Párate en la marca del piso, de frente y completo en el cuadro.'
                    : '2 de 2 · Ahora da dos o tres pasos ATRÁS y quédate quieto.'),
                  h('div', { className: 'fp-progress' },
                    h('i', { style: { width: Math.round(clamp(cal.progreso, 0, 1) * 100) + '%' } })),
                  cal.aviso ? h('p', { className: 'fp-error' }, '⚠ ' + cal.aviso)
                    : !cal.hayLectura
                      ? h('p', { className: 'fp-note' }, 'Esperando la primera lectura del motor de pose…')
                      : h('p', { className: 'fp-note' }, 'Te veo bien. Cuando la barra se llene, confirma la posición.'),
                  h(Boton, {
                    variant: 'primary', disabled: cal.progreso < 1, onClick: fijarPosicion,
                  }, cal.posiciones === 0 ? 'Listo, estoy en la marca' : 'Listo, ya retrocedí'))
              : null,
            cal && cal.paso === 'listo' && cal.resultado
              ? h('div', { className: 'fp-autocal' },
                  h('div', { className: 'fp-medidas' },
                    h('div', { className: 'fp-medida' },
                      h('b', null, cal.resultado.camaraAltura + ' cm'), h('span', null, 'altura de la cámara')),
                    h('div', { className: 'fp-medida' },
                      h('b', null, Math.round(cal.resultado.camaraInclinacion) + '°'), h('span', null, 'inclinación hacia abajo')),
                    h('div', { className: 'fp-medida' },
                      h('b', null, (cal.resultado.distancias || []).map((d) => d + ' cm').join(' · ') || '—'),
                      h('span', null, 'dónde te paraste')),
                    h('div', { className: 'fp-medida' + (cal.resultado.fuente === 'piso-kinect' || cal.resultado.confiable ? ' is-ok' : ' is-mal') },
                      h('b', null, cal.resultado.fuente === 'piso-kinect' ? 'EXACTA' : cal.resultado.confiable ? 'BUENA' : 'DUDOSA'),
                      h('span', null, cal.resultado.fuente === 'piso-kinect' ? 'medida por el Kinect' : 'estimada con la cámara'))),
                  h('p', { className: 'fp-note' },
                    'Al aplicar se ajustan también la marca del piso y el alto de la franja ' +
                    '(' + Math.round(clamp(num(model.espacio.estaturaReferencia, 170) * 1.35, 150, 260)) + ' cm ' +
                    'para alguien de ' + num(model.espacio.estaturaReferencia, 170) + ' cm, con los brazos en alto y un salto). ' +
                    'Es lo que permite que la misma app sirva para un curso de niños y para adultos.'),
                  cal.resultado.fuente !== 'piso-kinect' && !cal.resultado.confiable
                    ? h('p', { className: 'fp-error' },
                        '⚠ Las dos posiciones quedaron a ' + cal.resultado.separacion +
                        ' cm de distancia entre sí: muy poco para separar la altura del ángulo. ' +
                        'Repite alejándote más en la segunda.')
                    : null,
                  h(Boton, { variant: 'primary', onClick: aplicarCalibracion }, 'Aplicar a la zona de juego'))
              : null),
          h('div', { className: 'fp-diag-card fp-diag-card--ancha' },
            h('h3', null, '8. Cuerpo y espacio de juego'),
            h('p', { className: 'fp-note' },
              'Mide en centímetros con la geometría declarada en ⚙️ Editor → 📐 Espacio: ' +
              'la cámara está a ' + num(model.espacio.camaraAltura, 160) + ' cm, inclinada ' +
              num(model.espacio.camaraInclinacion, 10) + '° y con ' + num(model.espacio.fovHorizontal, 90) + '° de campo horizontal.'),
            h(Boton, { variant: midiendo ? 'danger' : 'soft', onClick: medirParticipante, disabled: cargando === 'cuerpo' },
              cargando === 'cuerpo' ? 'Abriendo…' : midiendo ? 'Detener medición' : 'Medir al participante'),
            cuerpo ? (cuerpo.ok
              ? h('div', { className: 'fp-medidas' },
                  h('div', { className: 'fp-medida' }, h('b', null, Math.round(cuerpo.distancia) + ' cm'), h('span', null, 'distancia al tótem')),
                  h('div', { className: 'fp-medida' }, h('b', null, cuerpo.altura ? Math.round(cuerpo.altura) + ' cm' : '—'), h('span', null, 'altura estimada')),
                  h('div', { className: 'fp-medida' }, h('b', null, cuerpo.envergadura ? Math.round(cuerpo.envergadura) + ' cm' : '—'), h('span', null, 'envergadura')),
                  h('div', { className: 'fp-medida' }, h('b', null, cuerpo.segmentos.anchoHombros ? Math.round(cuerpo.segmentos.anchoHombros) + ' cm' : '—'), h('span', null, 'ancho de hombros')),
                  h('div', { className: 'fp-medida' + (cuerpo.dentroDelEspacio ? ' is-ok' : ' is-mal') },
                    h('b', null, cuerpo.dentroDelEspacio ? 'DENTRO' : 'FUERA'), h('span', null, 'del espacio declarado')))
              : h('p', { className: 'fp-error' }, '⚠ ' + cuerpo.motivo)) : null,
            cuerpo && cuerpo.ok ? h('details', { className: 'fp-detalles' },
              h('summary', null, 'Puntos de articulación y segmentos'),
              h('table', { className: 'fp-table' },
                h('thead', null, h('tr', null, h('th', null, 'Articulación'), h('th', null, 'x'), h('th', null, 'y'), h('th', null, 'visible'))),
                h('tbody', null, ARTICULACIONES.map((a) => {
                  const p = cuerpo.landmarks && cuerpo.landmarks[a.i];
                  return h('tr', { key: a.i },
                    h('td', null, a.n),
                    h('td', null, p ? p.x.toFixed(3) : '—'),
                    h('td', null, p ? p.y.toFixed(3) : '—'),
                    h('td', null, p && (p.visibility == null || p.visibility > 0.35) ? '✔' : '—'));
                }))),
              h('div', { className: 'fp-chips' }, Object.keys(cuerpo.segmentos).map((k) => h(Chip, { key: k },
                k + ': ' + (cuerpo.segmentos[k] ? Math.round(cuerpo.segmentos[k]) + ' cm' : '—'))))) : null,
            h(BloqueEspacio, { espacio: model.espacio, aspecto: (cuerpo && cuerpo.aspecto) || 16 / 9, altura: (cuerpo && cuerpo.altura) || 175 }),
            cuerpo && cuerpo.landmarks
              ? h('div', { className: 'fp-cam fp-cam--diag' },
                  h(CamaraVista, { attach: videoRef, espejo: true, landmarks: cuerpo.landmarks, espacio: model.espacio },
                    h(Esqueleto, { landmarks: cuerpo.landmarks, espejo: true })))
              : null,
            h(TablaCamaras, { espacio: model.espacio, aspecto: (cuerpo && cuerpo.aspecto) || 16 / 9 })),
          h('div', { className: 'fp-diag-card fp-diag-card--ancha' },
            h('h3', null, '9. Teléfono como sensor (modo remoto)'),
            h('p', { className: 'fp-note' },
              'Para el montaje sin cámara: notebook con proyector, o un tótem cuya cámara no sirve. ' +
              'El teléfono abre la app por wifi, calcula la pose ahí mismo y transmite solo los 33 ' +
              'puntos del cuerpo. La imagen no sale del teléfono. No hay que instalar nada en este equipo.'),
            (function () {
              const sala = salaNormal(model.hardware.sensorSala) || '(sin generar)';
              const url = urlDelSensor(model.hardware, sala);
              const activo = s(model.hardware.motorPose) === 'sensor';
              return h('div', null,
                h('div', { className: 'fp-sensor-par' },
                  h('div', { className: 'fp-sensor-qr' },
                    url && sala.length >= 4 ? h(QR, { texto: url, tam: 200, alt: 'QR para abrir el modo sensor en el teléfono' }) : null),
                  h('div', { className: 'fp-sensor-datos-par' },
                    h('div', { className: 'fp-medida' },
                      h('b', null, salaLegible(sala)), h('span', null, 'código de sala')),
                    h('p', { className: 'fp-note' },
                      'Escanea el QR con la cámara del teléfono, o escribe la dirección a mano:'),
                    h('code', null, url || '(no se pudo deducir la dirección de esta página)'),
                    h('div', { className: 'fp-actions' },
                      h(Boton, { variant: oyendoSensor ? 'danger' : 'soft', onClick: escucharSensor },
                        oyendoSensor ? 'Dejar de escuchar' : '📱 Esperar al teléfono'),
                      h(Boton, { variant: 'ghost', onClick: nuevaSala }, 'Otro código')),
                    !activo
                      ? h('p', { className: 'fp-note' },
                          '⚠️ El motor de pose no está puesto en «Teléfono como sensor», así que los juegos ' +
                          'van a seguir usando la cámara de este equipo. Se cambia en ⚙️ Editor → 🔌 Hardware.')
                      : null)),
                sensor ? h('div', null,
                  h('div', { className: 'fp-campo-semaforo is-' + sensor.veredicto.nivel },
                    h('b', null, sensor.veredicto.nivel === 'ok' ? '✅' : sensor.veredicto.nivel === 'aviso' ? '⚠️' : '❌'),
                    h('span', null, sensor.salud.pareja ? sensor.veredicto.titulo
                      : sensor.salud.estado === 'esperando' ? 'Esperando al teléfono…'
                        : sensor.salud.estado === 'caido' ? 'Sin puente de salas' : 'Conectando…')),
                  h('div', { className: 'fp-medidas' },
                    h('div', { className: 'fp-medida' + (sensor.salud.edad != null && sensor.salud.edad <= num(model.hardware.sensorLatenciaMax, 180) ? ' is-ok' : ' is-mal') },
                      h('b', null, sensor.salud.edad == null ? '—' : sensor.salud.edad + ' ms'),
                      h('span', null, 'retraso del gesto (lo que se siente)')),
                    h('div', { className: 'fp-medida' + (sensor.salud.rtt != null && sensor.salud.rtt <= num(model.hardware.sensorRttMax, 100) ? ' is-ok' : ' is-mal') },
                      h('b', null, sensor.salud.rtt == null ? '—' : sensor.salud.rtt + ' ms'),
                      h('span', null, 'ida y vuelta del enlace')),
                    h('div', { className: 'fp-medida' + (sensor.salud.via === 'rtc' ? ' is-ok' : '') },
                      h('b', null, sensor.salud.via === 'rtc' ? 'DIRECTO' : sensor.salud.via === 'ws' ? 'POR PUENTE' : '—'),
                      h('span', null, 'camino del enlace')),
                    h('div', { className: 'fp-medida' },
                      h('b', null, sensor.salud.remoto && sensor.salud.remoto.hz ? sensor.salud.remoto.hz + ' fps' : '—'),
                      h('span', null, 'pose en el teléfono')),
                    h('div', { className: 'fp-medida' },
                      h('b', null, sensor.salud.recibidos), h('span', null, 'cuadros recibidos')),
                    h('div', { className: 'fp-medida' },
                      h('b', null, sensor.salud.desfase == null ? '—' : Math.round(sensor.salud.desfase / 100) / 10 + ' s'),
                      h('span', null, 'desfase de reloj corregido'))),
                  sensor.veredicto.acciones.length
                    ? h('ul', { className: 'fp-campo-lista' }, sensor.veredicto.acciones.map((a, i) =>
                        h('li', { key: i, className: 'is-' + sensor.veredicto.nivel }, (sensor.veredicto.nivel === 'mal' ? '❌ ' : '⚠️ ') + a)))
                    : null,
                  h('p', { className: 'fp-note' },
                    'Puente de salas: ', h('code', null, sensor.salud.url), '. ' +
                    'Se arranca con ', h('code', null, 'node puente-sensor/puente.mjs'), '. ' +
                    'Si el teléfono abre la app pero no enciende la cámara, falta el certificado: ' +
                    'está explicado en ', h('code', null, 'puente-sensor/README.md'), '.'))
                  : h('p', { className: 'fp-note' },
                      'Toca «Esperar al teléfono» y después escanea el QR. El puente de salas tiene que ' +
                      'estar corriendo en este equipo.'));
            }())),
          h('div', { className: 'fp-diag-card fp-diag-card--ancha' },
            h('h3', null, '10. Tiempo de ciclo y cuánta gente se atiende por hora'),
            h('p', { className: 'fp-note' },
              'Se mide sola, jugando: desde que alguien entra a un juego —donde empieza el posicionamiento— ' +
              'hasta que suelta la pantalla. Incluye colocarse, jugar, ver el puntaje y escribir el nombre, ' +
              'porque todo eso es tiempo en que el siguiente de la fila está esperando. No se cuentan las ' +
              'salidas por inactividad ni las pantallas que quedaron abiertas.'),
            (function () {
              const rc = resumenDeCiclos(model);
              if (!rc.muestras) {
                return h('p', { className: 'fp-empty' },
                  'Todavía no hay partidas medidas. Juega unas cuantas y este número aparece solo.');
              }
              const seg = (ms) => (ms == null ? '—' : (ms / 1000 < 90 ? Math.round(ms / 1000) + ' s' : (ms / 60000).toFixed(1) + ' min'));
              return h('div', null,
                h('div', { className: 'fp-medidas' },
                  h('div', { className: 'fp-medida' }, h('b', null, seg(rc.mediana)), h('span', null, 'ocupación mediana')),
                  h('div', { className: 'fp-medida' }, h('b', null, seg(rc.relevo)), h('span', null, 'relevo entre personas')),
                  h('div', { className: 'fp-medida is-ok' }, h('b', null, rc.personasPorHora == null ? '—' : rc.personasPorHora),
                    h('span', null, 'personas por hora')),
                  h('div', { className: 'fp-medida' }, h('b', null, rc.muestras), h('span', null, 'partidas medidas'))),
                rc.muestras < 5
                  ? h('p', { className: 'fp-note' }, '⚠️ Con ' + rc.muestras + ' medición(es) el número es orientativo. Desde cinco empieza a valer para dimensionar una jornada.')
                  : null,
                h('table', { className: 'fp-table' },
                  h('thead', null, h('tr', null,
                    h('th', null, 'Juego'), h('th', null, 'Medidas'), h('th', null, 'Ocupación mediana'),
                    h('th', null, 'Partidas por persona'), h('th', null, 'Personas/hora'))),
                  h('tbody', null, rc.juegos.map((j) => {
                    const g = model.games.find((x) => x.id === j.id);
                    return h('tr', { key: j.id },
                      h('td', null, (g && g.name) || j.id),
                      h('td', null, j.n),
                      h('td', null, seg(j.mediana)),
                      h('td', null, j.partidasPorPersona),
                      h('td', null, j.personasPorHora == null ? '—' : j.personasPorHora));
                  }))),
                h('p', { className: 'fp-note' },
                  'Las «personas por hora» ya descuentan el relevo: el tótem no queda libre en el instante ' +
                  'en que uno se va. Con fila larga conviene abrir con los juegos de la parte de arriba de ' +
                  'esta tabla, que son los que más gente atienden.'));
            }()))),
        h('h3', { className: 'fp-h3' }, 'Veredicto por juego'),
        h('table', { className: 'fp-table' },
          h('thead', null, h('tr', null, h('th', null, 'Función'), h('th', null, '¿Sirve la cámara común del tótem?'), h('th', null, 'Recomendación'))),
          h('tbody', null,
            fila('Coloca la cola al burro', 'No hace falta cámara', 'Pantalla táctil'),
            fila('Detectar postura y movimientos de baile', 'Sí, normalmente', 'Cámara RGB 1080p + reconocimiento de pose'),
            fila('Puntos de articulación del cuerpo', 'Sí: 33 puntos', 'Cámara RGB; se listan en la tarjeta 6'),
            fila('Medir altura y distancia en centímetros', 'Sí, con el espacio declarado y los pies a la vista', 'Mejora con cámara RGB-D (medición directa)'),
            fila('Separar a la persona del fondo', 'Sí, con segmentación activada', 'Cuesta CPU: verifícalo en este equipo'),
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
      { key: 'modoRitmico', label: 'Ofrecer el modo rítmico (sin cámara)', type: 'boolean',
        help: 'Es la entrada alternativa del juego: apagarlo lo deja jugable solo con cámara.' },
      { key: 'ritmoLatenciaMs', label: 'Ajuste de latencia del panel (ms)', type: 'range', min: -200, max: 250, step: 5,
        help: 'Solo para el modo rítmico. Si al terminar dice que los toques llegan tarde, pon acá esos milisegundos.' },
      { key: 'ritmoUnCarril', label: 'Modo rítmico con un solo botón', type: 'boolean',
        help: 'Para jugar con un pulsador único o una sola mano: todas las notas valen con el mismo botón.' },
      { key: 'ritmoSonido', label: 'Clic de compás en el modo rítmico', type: 'boolean' },
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
      { key: 'distanciaMetros', label: 'Distancia real a la zona (m)', type: 'range', min: 0.8, max: 4, step: 0.1, help: 'Por defecto la zona única del tótem (2,2 m), que representa los 14 m oficiales.' },
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
      { key: 'distanciaMetros', label: 'Distancia a la zona (m)', type: 'range', min: 0.8, max: 4, step: 0.1, help: 'Por defecto la zona única del tótem (2,2 m).' },
    ],
    gato: [
      { key: 'modo', label: 'Modalidad inicial', type: 'select', help: 'Solo el valor por defecto: el jugador elige rival y ficha en pantalla.', options: [
        { value: 'maquina', label: 'Contra el tótem' },
        { value: 'dos-jugadores', label: 'Dos jugadores por turnos' },
      ] },
      { key: 'dificultad', label: 'Nivel inicial del tótem', type: 'select', help: 'También se puede cambiar en la pantalla de selección.', options: [
        { value: 'facil', label: 'Fácil' },
        { value: 'media', label: 'Media' },
        { value: 'dificil', label: 'Difícil (imbatible)' },
      ] },
      { key: 'rondas', label: 'Manos por serie', type: 'number', min: 1, max: 9 },
    ],
    gol: [
      { key: 'tiros', label: 'Penales por partida', type: 'number', min: 1, max: 15 },
      { key: 'dificultad', label: 'Reflejos del arquero', type: 'select', options: [
        { value: 'facil', label: 'Fácil' },
        { value: 'media', label: 'Media' },
        { value: 'dificil', label: 'Difícil' },
      ] },
      { key: 'fuerzaReferencia', label: 'Patada de potencia media', type: 'range', min: 1, max: 6, step: 0.1, help: 'Calibración: súbela si todos los tiros salen demasiado fuertes.' },
      { key: 'sensibilidadLateral', label: 'Sensibilidad de colocación', type: 'range', min: 0.1, max: 1.5, step: 0.05 },
      { key: 'dispersion', label: 'Dispersión del remate', type: 'range', min: 0, max: 0.4, step: 0.01 },
      { key: 'distanciaMetros', label: 'Distancia a la zona (m)', type: 'range', min: 0.8, max: 5, step: 0.1, help: 'Por defecto la zona única del tótem (2,2 m).' },
    ],
    esquiva2d: [
      { key: 'velocidad', label: 'Velocidad inicial', type: 'range', min: 0.15, max: 1.2, step: 0.02 },
      { key: 'aceleracion', label: 'Cuánto acelera', type: 'range', min: 0, max: 0.2, step: 0.005 },
      { key: 'cadaSegundos', label: 'Cada cuántos segundos aparece un obstáculo', type: 'range', min: 0.6, max: 4, step: 0.1 },
      { key: 'vidas', label: 'Vidas', type: 'number', min: 1, max: 9 },
      { key: 'metaPuntos', label: 'Puntos equivalentes a un 10', type: 'number', min: 200, max: 5000 },
    ],
  };
  CAMPOS_JUEGO.esquiva3d = CAMPOS_JUEGO.esquiva2d;

  /**
   * Packs temáticos: aplicar, exportar e importar.
   *
   * La importación valida ANTES de tocar nada y muestra qué campo está mal.
   * Un pack roto tiene que fallar acá, con un mensaje, y no a mitad del evento
   * con la portada en blanco.
   */
  function BloquePacks(props) {
    const m = props.model;
    const [texto, setTexto] = useState('');
    const [informe, setInforme] = useState(null);
    const aplicar = (id) => {
      const r = aplicarPack(id);
      if (r.ok) notify('success', 'Pack «' + PACKS[id].nombre + '» aplicado. No se tocó el montaje ni el ranking.');
      setInforme(r);
    };
    return h('div', { className: 'fp-form-ancho' },
      h('h4', { className: 'fp-h4' }, '🎨 Packs temáticos'),
      h('p', { className: 'fp-note' },
        'Un pack cambia cómo se ve y cómo se llaman las cosas. NO toca el montaje (cámara, espacio, ' +
        'hardware) ni los datos (ranking, contactos, métricas), así que se puede cambiar la decoración ' +
        'a mitad de la jornada sin arriesgar una partida guardada.'),
      h('div', { className: 'fp-chips' }, Object.keys(PACKS).map((k) => h('button', {
        key: k, className: 'fp-chip' + (m.branding.theme === k ? ' is-on' : ''), onClick: () => aplicar(k),
      }, (PACKS[k].tema.emoji || '🎨') + ' ' + PACKS[k].nombre))),
      h('p', { className: 'fp-note' }, PACKS[m.branding.theme] ? PACKS[m.branding.theme].descripcion : ''),
      h('div', { className: 'fp-actions' },
        h(Boton, {
          variant: 'soft',
          onClick: () => {
            const json = JSON.stringify(packDelModelo(m, 'mi-pack', m.branding.appName), null, 2);
            setTexto(json);
            descargar('funplai-pack-' + new Date().toISOString().slice(0, 10) + '.json', json, 'application/json');
            notify('info', 'Pack exportado. Está también en el cuadro de abajo para copiarlo.');
          },
        }, '⬇️ Exportar el aspecto actual'),
        h(Boton, {
          variant: 'ghost', disabled: !texto.trim(),
          onClick: () => {
            let obj = null;
            try { obj = JSON.parse(texto); } catch (e) {
              setInforme({ ok: false, errores: ['El texto no es JSON válido: ' + e.message], avisos: [] });
              return;
            }
            const r = aplicarPack(obj);
            setInforme(r);
            if (r.ok) notify('success', 'Pack «' + r.pack.nombre + '» importado y aplicado.');
            else notify('error', 'El pack no se aplicó: tiene ' + r.errores.length + ' problema(s).');
          },
        }, '⬆️ Importar el pack de abajo')),
      h(Campo, {
        label: 'Pack en JSON (pega uno acá para importarlo)', type: 'textarea', rows: 8,
        value: texto, onChange: setTexto,
        help: 'Formato documentado en docs/PERSONALIZACION.md. Los packs que vienen con la app están en assets/packs/.',
      }),
      informe && !informe.ok ? h('div', { className: 'fp-error' },
        h('b', null, 'El pack no se aplicó:'),
        h('ul', null, informe.errores.map((e, i) => h('li', { key: i }, e)))) : null,
      informe && informe.avisos && informe.avisos.length ? h('div', { className: 'fp-note' },
        h('b', null, 'Se ignoraron algunos campos (el pack se aplicó igual):'),
        h('ul', null, informe.avisos.map((a, i) => h('li', { key: i }, a)))) : null);
  }

  function Editor(props) {
    const m = props.model;
    const [tab, setTab] = useState('marca');
    const [sel, setSel] = useState((m.games[0] || {}).id || '');
    const [json, setJson] = useState('');
    const [kinPrueba, setKinPrueba] = useState(null);   // {ok, detalle} del puente
    const juego = m.games.find((g) => g.id === sel) || m.games[0];

    /**
     * Prueba el puente desde el propio editor. El operador está justo acá
     * cuando elige "Kinect", y mandarlo al Diagnóstico para saber si su
     * elección sirve es hacerle dar una vuelta al pasillo.
     */
    const probarPuente = async () => {
      setKinPrueba({ probando: true });
      const prov = proveedorKinect(m.hardware, m.espacio);
      try {
        await prov.iniciar();
      } catch (e) {
        try { prov.detener(); } catch (err) { /* noop */ }
        setKinPrueba({ ok: false, detalle: e && e.message ? e.message : String(e) });
        return;
      }
      // Un segundo de escucha: conectar no es lo mismo que recibir cuerpos.
      await new Promise((r) => setT(r, 1000));
      const lec = prov.leer();
      const sal = prov.salud();
      const k = lec && lec.kinect;
      try { prov.detener(); } catch (e) { /* noop */ }
      setKinPrueba({
        ok: true,
        detalle: sal.cuadros + ' cuadros recibidos · ' +
          (k ? k.cuerposEnEscena + ' cuerpo(s) en la zona' : 'nadie en la zona de juego') +
          (sal.fueraDeRango ? ' · ' + sal.fueraDeRango + ' fuera del rango' : '') +
          (k && k.distancia != null ? ' · a ' + k.distancia.toFixed(2) + ' m' : '') +
          (k && k.piso ? ' · con plano del piso' : ' · sin plano del piso'),
      });
    };

    const tabs = [['marca', '🎨 Marca'], ['juegos', '🎮 Juegos'], ['espacio', '📐 Espacio'], ['hardware', '🔌 Hardware'], ['concurso', '⚖️ Concurso'], ['datos', '💾 Datos']];

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
            help: 'Cambia solo los colores. Para cambiar además los textos y los nombres de los juegos, aplica un pack completo más abajo.',
            onChange: (v) => patch({ branding: { theme: v, temaPack: null } }),
          }),
          // `themeOf` y no `THEMES[id]`: con un pack importado el id NO está en
          // THEMES —llegó de un archivo— y buscarlo ahí dejaba el Editor en
          // blanco justo después de aplicar el pack de una marca.
          h(Campo, { label: 'Color de acento', type: 'color', value: m.branding.accent || themeOf(m).accent, onChange: (v) => patch({ branding: { accent: v } }) }),
          h(Campo, { label: 'Color secundario', type: 'color', value: m.branding.accent2 || themeOf(m).accent2, onChange: (v) => patch({ branding: { accent2: v } }) }),
          h(Campo, { label: 'Título de portada', value: m.branding.heroTitle, onChange: (v) => patch({ branding: { heroTitle: v } }) }),
          h(Campo, { label: 'Subtítulo de portada', value: m.branding.heroSubtitle, onChange: (v) => patch({ branding: { heroSubtitle: v } }) }),
          h(Campo, { label: 'Pie de página', value: m.branding.pieDePagina, onChange: (v) => patch({ branding: { pieDePagina: v } }) }),
          h(Campo, { label: 'Volver al inicio tras inactividad (s, 0 = nunca)', type: 'number', min: 0, max: 900, value: m.branding.idleSeconds, onChange: (v) => patch({ branding: { idleSeconds: v } }) }),
          h(Campo, { label: 'Mostrar ranking', type: 'boolean', value: m.branding.mostrarRanking, onChange: (v) => patch({ branding: { mostrarRanking: v } }) }),
          h(Campo, {
            label: 'Tope de partidas guardadas', type: 'number', min: 0, max: 20000,
            value: m.ranking.tope,
            help: 'Red de seguridad, no límite de trabajo: 0 = sin tope. Medido sobre la persistencia real, revienta cerca de las 28.000 filas; una jornada de diez horas a 60 partidas/hora son 600. Si se llega al tope se exporta y se avisa, nunca se borra en silencio.',
            onChange: (v) => patch({ ranking: { tope: v } }),
          }),
          h(Campo, {
            label: 'Partidas visibles en la tabla', type: 'number', min: 10, max: 500,
            value: m.ranking.mostrar,
            help: 'Solo afecta a lo que se dibuja: los datos están todos y hay un botón para verlos.',
            onChange: (v) => patch({ ranking: { mostrar: v } }),
          }),
          h(BloquePacks, { model: m })) : null,

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
            options: [
              { value: 'auto', label: 'Automático (Kinect si hay puente, si no la webcam)' },
              { value: 'kinect', label: 'Kinect for Xbox One (puente local)' },
              { value: 'mediapipe', label: 'Webcam + MediaPipe' },
              { value: 'sensor', label: 'Teléfono como sensor (modo remoto)' },
              { value: 'demo', label: 'Simulador (sin cámara)' },
              { value: 'ninguno', label: 'Desactivado' },
            ],
            help: '«Webcam» incluye un teléfono conectado con Iriun o DroidCam, que el sistema ve como una cámara más. «Teléfono como sensor» es otra cosa: el teléfono abre la app por wifi y calcula la pose él mismo, sin instalar nada en este equipo. Se empareja en 🎥 Diagnóstico.',
            onChange: (v) => patch({ hardware: { motorPose: v } }),
          }),
          h(Campo, {
            label: 'URL del puente Kinect', value: m.hardware.kinectUrl,
            help: 'WebSocket del programa que lee el Kinect v2 en este mismo equipo. Ver docs/KINECT.md.',
            onChange: (v) => patch({ hardware: { kinectUrl: v } }),
          }),

          // ── Propiedades del sensor ──────────────────────────────────
          // Van juntas y a la vista porque son lo que hace que el Kinect
          // funcione bien o mal en un montaje concreto.
          h('h4', { className: 'fp-h4 fp-form-ancho' }, '🦴 Propiedades del Kinect'),
          h('div', { className: 'fp-form-ancho fp-nota-kinect' },
            h('p', { className: 'fp-note' },
              'El Kinect NO aparece en la lista de "Cámaras conectadas": no es una webcam, ' +
              'no expone video al sistema. Todo lo suyo llega por el puente, y esto de acá ' +
              'es lo que se puede ajustar de él.'),
            h(Boton, {
              className: 'fp-btn--mini', variant: 'soft', onClick: probarPuente,
              disabled: !!(kinPrueba && kinPrueba.probando),
            }, kinPrueba && kinPrueba.probando ? 'Escuchando 1 s…' : '🔌 Probar el puente ahora'),
            kinPrueba && !kinPrueba.probando
              ? h('p', { className: kinPrueba.ok ? 'fp-ok' : 'fp-error' },
                  (kinPrueba.ok ? '✅ ' : '⚠ ') + kinPrueba.detalle)
              : null),
          h(Campo, {
            label: 'Con quién se juega', type: 'select', value: m.hardware.kinectCuerpo,
            options: [
              { value: 'cercano', label: 'El más cercano al sensor (recomendado)' },
              { value: 'primero', label: 'El primero que el sensor empezó a seguir' },
            ],
            help: 'El sensor ve hasta seis personas. En una feria hay público detrás; con "el más cercano" el juego no salta de persona en persona.',
            onChange: (v) => patch({ hardware: { kinectCuerpo: v } }),
          }),
          h(Campo, {
            label: 'Distancia mínima de juego (cm)', type: 'number', min: 40, max: 450,
            value: m.hardware.kinectMinCm,
            help: 'Más cerca de ~80 cm el Kinect v2 no sigue el cuerpo.',
            onChange: (v) => patch({ hardware: { kinectMinCm: v } }),
          }),
          h(Campo, {
            label: 'Distancia máxima de juego (cm)', type: 'number', min: 60, max: 500,
            value: m.hardware.kinectMaxCm,
            help: 'El sensor llega a 450 cm, pero pasados ~400 el esqueleto es ruido. Quien esté más lejos se ignora.',
            onChange: (v) => patch({ hardware: { kinectMaxCm: v } }),
          }),
          h(Campo, {
            label: 'Medir alturas con el plano del piso', type: 'boolean', value: m.hardware.kinectUsarPiso,
            help: 'Da estatura y salto en centímetros reales, sin calibrar. Desactívalo solo si el sensor no ve suelo y reporta un plano malo.',
            onChange: (v) => patch({ hardware: { kinectUsarPiso: v } }),
          }),
          h(Campo, {
            label: 'Usar la inclinación del torso del sensor', type: 'boolean', value: m.hardware.kinectUsarLean,
            help: 'Virar en el vuelo 3D y esquivar en el boxeo. Si se desactiva, se deduce de la posición de hombros y caderas.',
            onChange: (v) => patch({ hardware: { kinectUsarLean: v } }),
          }),
          h(Campo, {
            label: 'Usar el estado de las manos', type: 'boolean', value: m.hardware.kinectUsarManos,
            help: 'Puño en el boxeo, soltar el tejo en la rayuela, disparar en el LaserGun. Desactívalo si el montaje está lejos y el sensor no distingue puño de mano abierta.',
            onChange: (v) => patch({ hardware: { kinectUsarManos: v } }),
          }),
          // ── Robustez del pipeline ───────────────────────────────────
          h('h4', { className: 'fp-h4 fp-form-ancho' }, '🎯 Robustez de la pose'),
          h('p', { className: 'fp-note fp-form-ancho' },
            'Estos ajustes valen para los DOS motores. La diferencia entre una webcam barata y un sensor caro ' +
            'casi nunca está en el modelo de pose: está acá.'),
          h(Campo, {
            label: 'Cuadros de pose por segundo', type: 'number', min: 5, max: 60,
            value: m.hardware.poseHz,
            help: 'La pose corre en su propio bucle y el juego dibuja a 60 leyendo la última lectura. 20–30 se ve mejor que forzar 60 y que se trabe.',
            onChange: (v) => patch({ hardware: { poseHz: v } }),
          }),
          h(Campo, {
            label: 'Recortar el cuadro a la zona de juego', type: 'boolean', value: m.hardware.recorteZona,
            help: 'Quien pase por detrás queda fuera del cuadro que ve el modelo. Además hay menos píxeles que mirar, así que corre más rápido.',
            onChange: (v) => patch({ hardware: { recorteZona: v } }),
          }),
          h(Campo, {
            label: 'Salto máximo entre cuadros', type: 'number', min: 0.05, max: 1, step: 0.01,
            value: m.hardware.saltoMaximo,
            help: 'En fracción de pantalla. Si el cuerpo salta más que esto de un cuadro a otro, no es que se movió: es que el modelo se pasó a otra persona. Ese cuadro se descarta.',
            onChange: (v) => patch({ hardware: { saltoMaximo: v } }),
          }),
          h(Campo, {
            label: 'Filtro de suavizado', type: 'select', value: m.hardware.filtro,
            options: [
              { value: 'oneeuro', label: 'One Euro (recomendado)' },
              { value: 'ema', label: 'Exponencial simple' },
              { value: 'ninguno', label: 'Ninguno (dato crudo)' },
            ],
            help: 'El exponencial obliga a elegir entre temblor en reposo y retraso en movimiento rápido. One Euro resuelve las dos.',
            onChange: (v) => patch({ hardware: { filtro: v } }),
          }),
          h(Campo, {
            label: 'One Euro · mincutoff (Hz)', type: 'number', min: 0.1, max: 10, step: 0.1,
            value: m.hardware.oneEuroMinCutoff,
            help: 'Manda en el reposo: más bajo, más quieto se ve el esqueleto.',
            onChange: (v) => patch({ hardware: { oneEuroMinCutoff: v } }),
          }),
          h(Campo, {
            label: 'One Euro · beta', type: 'number', min: 0, max: 25, step: 0.5,
            value: m.hardware.oneEuroBeta,
            help: 'Cuánto se abre el filtro al moverse rápido: más alto, menos retraso en un golpe o un salto. Ojo con los valores de los ejemplos del filtro: están pensados para píxeles, y aquí los puntos van en 0..1.',
            onChange: (v) => patch({ hardware: { oneEuroBeta: v } }),
          }),
          h(Campo, {
            label: 'Descartar cuadros con huesos estirados', type: 'boolean', value: m.hardware.huesosRigidos,
            help: 'Los largos de segmento de una persona no cambian. Se miden al calibrar y el cuadro que los viole se descarta: ahí se va la mayoría de los saltos de landmark.',
            onChange: (v) => patch({ hardware: { huesosRigidos: v } }),
          }),
          h(Campo, {
            label: 'Personas a seguir a la vez', type: 'number', min: 1, max: 4,
            value: m.hardware.poseNumPoses,
            help: 'Déjalo en 1. Subirlo cuesta CPU y con el recorte no hace falta para aislar al jugador; 2 sirve para un duelo presencial en un equipo capaz.',
            onChange: (v) => patch({ hardware: { poseNumPoses: v } }),
          }),
          h('h4', { className: 'fp-h4 fp-form-ancho' }, '💡 Umbrales de luz'),
          h('p', { className: 'fp-note fp-form-ancho' },
            'La app MIDE la luz de la sala en 🎥 Diagnóstico → Prueba de campo. Estos tres números son ' +
            'el listón contra el que se compara lo medido. Vienen puestos para una sala de feria normal; ' +
            'quien conoce el local puede moverlos, y quedan escritos para que el veredicto no dependa de ' +
            'una opinión.'),
          h(Campo, {
            label: 'Luz mínima sobre el sujeto (0–255)', type: 'number', min: 20, max: 200,
            value: m.hardware.luzMinima,
            help: 'Luma media de la persona, no del cuadro: el ventanal del fondo no juega. Por debajo de 0,7 de este valor la prueba de campo da rojo.',
            onChange: (v) => patch({ hardware: { luzMinima: v } }),
          }),
          h(Campo, {
            label: 'Ruido de imagen máximo', type: 'number', min: 0.5, max: 30, step: 0.5,
            value: m.hardware.luzRuidoMax,
            help: 'Cuánto cambia cada píxel entre cuadros con la escena quieta. Es la firma de la ganancia alta: la cámara compensando la falta de luz. Sube con menos luz, no con peor cámara.',
            onChange: (v) => patch({ hardware: { luzRuidoMax: v } }),
          }),
          h(Campo, {
            label: 'Contraluz máximo (fondo − sujeto)', type: 'number', min: 10, max: 200,
            value: m.hardware.contraluzMax,
            help: 'Si el fondo es más claro que la persona por más de esto, hay un ventanal detrás y la cámara expone para él. No se arregla con más luz: hay que girar el montaje.',
            onChange: (v) => patch({ hardware: { contraluzMax: v } }),
          }),
          h('h4', { className: 'fp-h4 fp-form-ancho' }, '📷 Webcam (MediaPipe)'),
          h(Campo, { label: 'URL del módulo de pose', value: m.hardware.poseModuleUrl, help: 'Puede apuntar a un asset local del tótem para funcionar sin internet.', onChange: (v) => patch({ hardware: { poseModuleUrl: v } }) }),
          h(Campo, { label: 'URL del runtime WASM', value: m.hardware.poseWasmUrl, onChange: (v) => patch({ hardware: { poseWasmUrl: v } }) }),
          h(Campo, { label: 'URL del modelo (.task)', value: m.hardware.poseModelUrl, onChange: (v) => patch({ hardware: { poseModelUrl: v } }) }),
          h(Campo, { label: 'Mostrar aviso de cámara activa', type: 'boolean', value: m.hardware.avisoCamara, onChange: (v) => patch({ hardware: { avisoCamara: v } }) }),
          h(Campo, { label: 'Aceptar impactos de tracker externo', type: 'boolean', value: m.hardware.trackerExterno, help: 'window.postMessage({type:"funplai:impact", x, y}) con x,y entre 0 y 1.', onChange: (v) => patch({ hardware: { trackerExterno: v } }) }),
          h(Campo, { label: 'Separar persona del fondo (segmentación)', type: 'boolean', value: m.hardware.segmentacion, help: 'Da el contorno real del cuerpo (lo usa Esquiva 3D). Cuesta CPU: en un Celeron, actívalo solo si el diagnóstico lo aguanta.', onChange: (v) => patch({ hardware: { segmentacion: v } }) })) : null,

        tab === 'concurso' ? h('div', null,
          h('p', { className: 'fp-lead' },
            'En cuanto un juego reparte un premio deja de ser un juego: es un concurso, y tarde o ' +
            'temprano alguien reclama. Esto no cambia cómo se juega — cambia qué se puede demostrar ' +
            'después. Los juegos siguen siendo de DESTREZA y no de azar: gana quien lo hace mejor, ' +
            'no quien tiene suerte. Ver ', h('code', null, 'docs/BASES-CONCURSO.md'), '.'),
          (function () {
            const c = m.concurso || {};
            const est = estadoConcurso(m);
            return h('div', null,
              h('div', { className: 'fp-form' },
                h(Campo, {
                  label: 'Activar modo concurso', type: 'boolean', value: c.activo,
                  help: 'Enciende la vigilancia de la partida, el tope de intentos y la ventana de vigencia. Apagado, la app se comporta como siempre.',
                  onChange: (v) => patch({ concurso: { activo: v } }),
                }),
                h(Campo, { label: 'Nombre del concurso', value: c.nombre, help: 'Aparece en las bases y en la exportación.', onChange: (v) => patch({ concurso: { nombre: v } }) }),
                h(Campo, { label: 'Premio', value: c.premio, help: 'Qué se lleva quien gana. Va en las bases.', onChange: (v) => patch({ concurso: { premio: v } }) }),
                h(Campo, {
                  label: 'Intentos por persona', type: 'number', min: 0, max: 99, value: c.intentosPorPersona,
                  help: '0 = sin tope. Se cuenta por el nombre escrito, así que es un tope de buena fe: quien quiera más solo tiene que escribir otro nombre. El control real es el operador mirando la fila, y así está dicho en las bases.',
                  onChange: (v) => patch({ concurso: { intentosPorPersona: v } }),
                }),
                h(Campo, { label: 'Abre (fecha y hora)', type: 'datetime-local', value: c.desde, help: 'Vacío = sin hora de apertura.', onChange: (v) => patch({ concurso: { desde: v } }) }),
                h(Campo, { label: 'Cierra (fecha y hora)', type: 'datetime-local', value: c.hasta, help: 'Fuera de la ventana no se pueden guardar puntajes.', onChange: (v) => patch({ concurso: { hasta: v } }) })),
              h('h4', { className: 'fp-h4' }, 'Qué se considera jugar dentro de las reglas'),
              h('p', { className: 'fp-note' },
                'Medido con la geometría real de la cámara: acercarse NO infla un gesto lateral, porque el ' +
                'gesto y el ancho de hombros crecen igual con la distancia. Lo que sí infla es GIRARSE: la ' +
                'referencia cae con el coseno del giro, así que de perfil a 55° un salto se lee un 73% más ' +
                'grande. Por eso se vigilan las dos cosas por separado.'),
              h('div', { className: 'fp-form' },
                h(Campo, {
                  label: 'Puede moverse (cm)', type: 'number', min: 10, max: 150, value: c.toleranciaDistancia,
                  help: 'Cuánto se puede alejar o acercar de donde se colocó al empezar, antes de que el cuadro cuente como fuera.',
                  onChange: (v) => patch({ concurso: { toleranciaDistancia: v } }),
                }),
                h(Campo, {
                  label: 'Hombros mínimos (fracción)', type: 'number', min: 0.3, max: 1, step: 0.05, value: c.giroTolerancia,
                  help: 'Fracción del ancho de hombros con el que se colocó. Por debajo, está de perfil. 0,8 permite girarse unos 35°.',
                  onChange: (v) => patch({ concurso: { giroTolerancia: v } }),
                }),
                h(Campo, {
                  label: 'Señalar desde (fracción de la partida)', type: 'number', min: 0, max: 1, step: 0.05, value: c.marcarDesde,
                  help: 'Con más de esto fuera de las reglas, la partida queda señalada pero compite.',
                  onChange: (v) => patch({ concurso: { marcarDesde: v } }),
                }),
                h(Campo, {
                  label: 'Invalidar desde (fracción de la partida)', type: 'number', min: 0, max: 1, step: 0.05, value: c.invalidarDesde,
                  help: 'Con más de esto, la partida se guarda pero no compite por el premio. Que haya un nivel intermedio importa: quien se salió tres segundos porque le hablaron no hizo trampa.',
                  onChange: (v) => patch({ concurso: { invalidarDesde: v } }),
                })),
              h('h4', { className: 'fp-h4' }, 'Datos de contacto (amarillo del semáforo)'),
              h('p', { className: 'fp-note' },
                'El formulario se ofrece DESPUÉS de jugar, plegado, y con ninguna casilla marcada. Se puede ' +
                'jugar y ganar sin dejar nada. Lo que se guarda incluye el texto exacto que la persona ' +
                'aceptó, no un «sí» suelto: si mañana cambian las finalidades, hay que poder demostrar a ' +
                'qué dijo que sí.'),
              h('div', { className: 'fp-form' },
                h(Campo, {
                  label: 'Ofrecer dejar datos de contacto', type: 'boolean', value: (m.contacto || {}).activo,
                  onChange: (v) => patch({ contacto: { activo: v } }),
                }),
                h(Campo, {
                  label: 'Responsable de los datos', value: (m.contacto || {}).responsable,
                  help: 'La marca u organizador, NO Kimos. Sale en pantalla y en la exportación. En un evento, Kimos suele ser encargado del tratamiento y la marca responsable: eso va en contrato (ver PRIVACIDAD.md).',
                  onChange: (v) => patch({ contacto: { responsable: v } }),
                }),
                h(Campo, {
                  label: 'Cuánto se conservan', value: (m.contacto || {}).conservacion,
                  help: 'En texto claro, como se lo va a leer la persona: «30 días», «hasta el sorteo del 15 de octubre».',
                  onChange: (v) => patch({ contacto: { conservacion: v } }),
                }),
                h(Campo, { label: 'Pedir correo', type: 'boolean', value: (m.contacto || {}).pedirCorreo, onChange: (v) => patch({ contacto: { pedirCorreo: v } }) }),
                h(Campo, { label: 'Pedir teléfono', type: 'boolean', value: (m.contacto || {}).pedirTelefono, onChange: (v) => patch({ contacto: { pedirTelefono: v } }) }),
                h(Campo, {
                  label: 'Pedir edad', type: 'boolean', value: (m.contacto || {}).pedirEdad,
                  help: 'La escribe la persona. La app NO estima la edad por la cámara: eso es rojo del semáforo y no se va a implementar.',
                  onChange: (v) => patch({ contacto: { pedirEdad: v } }),
                }),
                h(Campo, {
                  label: 'Pedir permiso para foto o vídeo', type: 'boolean', value: (m.contacto || {}).pedirFoto,
                  help: 'Casilla SEPARADA del resto: compartir una imagen es otra cosa que dar un correo, y juntarlas sería colar una en la otra.',
                  onChange: (v) => patch({ contacto: { pedirFoto: v } }),
                }),
                h(Campo, {
                  label: 'Dirección del QR de puntaje', value: (m.contacto || {}).urlPuntaje,
                  help: 'Plantilla de la marca, con {puntaje} y {juego}. Si se deja vacía, el QR lleva un texto legible con el puntaje: sigue sirviendo para una foto y no se inventa un servidor que no existe.',
                  onChange: (v) => patch({ contacto: { urlPuntaje: v } }),
                })),
              h('h4', { className: 'fp-h4' }, 'Cierre del concurso'),
              h('p', { className: 'fp-note' },
                est.abierto
                  ? 'El concurso está ABIERTO. Al cerrarlo, el ranking deja de admitir partidas nuevas y queda la constancia de cuándo se cerró. Es lo que se firma con el cliente al entregar los resultados.'
                  : '⚖️ Cerrado' + (c.cerradoAt ? ' el ' + new Date(c.cerradoAt).toLocaleString() : '') +
                    '. El ranking ya no admite partidas nuevas.'),
              h('div', { className: 'fp-actions' },
                c.cerrado
                  ? h(Boton, {
                      variant: 'ghost',
                      onClick: () => {
                        if (!confirm('¿Reabrir el concurso?\n\nQueda constancia de que se cerró el ' +
                          (c.cerradoAt ? new Date(c.cerradoAt).toLocaleString() : '(sin fecha)') +
                          ' y de que se reabrió ahora. Si ya entregaste resultados al cliente, reabrir cambia el ranking que firmó.')) return;
                        patch({ concurso: { cerrado: false, reabiertoAt: new Date().toISOString() } });
                        notify('warn', 'Concurso reabierto. Queda constancia en la configuración.');
                      },
                    }, 'Reabrir el concurso')
                  : h(Boton, {
                      variant: 'danger', disabled: !c.activo,
                      onClick: () => {
                        if (!confirm('¿Cerrar el concurso?\n\nNo se van a poder guardar más partidas. Se puede reabrir, y también queda constancia de eso.')) return;
                        patch({ concurso: { cerrado: true, cerradoAt: new Date().toISOString() } });
                        notify('success', 'Concurso cerrado. El ranking queda como está.');
                      },
                    }, '🔒 Cerrar el concurso'),
                h(Boton, {
                  variant: 'soft', disabled: !(m.scores || []).length,
                  onClick: () => {
                    const csv = rankingCSV(ordenarRanking(m.scores || []));
                    descargar('funplai-concurso-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv', csv);
                    notify('info', 'Acta exportada: ' + (m.scores || []).length + ' partidas, con su ficha de auditoría.');
                  },
                }, '⬇️ Exportar acta')));
          }())) : null,

        tab === 'espacio' ? h('div', null,
          h('p', { className: 'fp-lead' },
            'El volumen de juego no es decorativo: declarar cuánto mide el espacio y dónde está la cámara ' +
            'es lo que permite convertir píxeles en centímetros —distancia, altura y envergadura reales— ' +
            'y avisar si el lente no alcanza a cubrirlo.'),
          h(BloqueEspacio, { espacio: m.espacio, aspecto: 16 / 9 }),
          h('div', { className: 'fp-form' },
            h(Campo, {
              label: 'Cámara instalada', type: 'select', value: m.espacio.camaraModelo,
              options: CAMARAS.map((c) => ({ value: c.id, label: c.nombre })),
              help: camaraPorId(m.espacio.camaraModelo).nota,
              onChange: (v) => {
                const c = camaraPorId(v);
                const p = { camaraModelo: v };
                if (v !== 'personalizada') p.fovHorizontal = c.fovH;
                if (c.seguimiento === 'mecanico') p.seguimiento = 'mecanico';
                patch({ espacio: p });
                const ev = evaluarCamara(c, Object.assign({}, m.espacio, p), 16 / 9);
                notify(ev.apta ? 'success' : 'info', c.nombre + ' · ' + ev.resumen +
                  (c.seguimiento === 'mecanico' ? ' Ojo: mientras el gimbal gira no se puede medir en centímetros.' : ''));
              },
            }),
            h(Campo, {
              label: 'Seguimiento del participante', type: 'select', value: m.espacio.seguimiento,
              options: [
                { value: 'digital', label: 'Digital (recorte por software, recomendado)' },
                { value: 'ninguno', label: 'Sin seguimiento (cuadro fijo)' },
                { value: 'mecanico', label: 'Mecánico (gimbal / PTZ de la cámara)' },
              ],
              help: 'El digital sigue a la persona sin mover el lente, así la app conserva la referencia para medir en centímetros. El mecánico encuadra mejor pero desactiva la medición mientras el lente gira.',
              onChange: (v) => patch({ espacio: { seguimiento: v } }),
            }),
            h(Campo, { label: 'Alto útil de captura (cm)', type: 'range', min: 180, max: 320, step: 5, value: m.espacio.alto, help: 'Incluye brazos arriba y saltos, no solo la estatura.', onChange: (v) => patch({ espacio: { alto: v } }) }),
            h(Campo, { label: 'Ancho de la zona (cm)', type: 'range', min: 120, max: 400, step: 5, value: m.espacio.ancho, onChange: (v) => patch({ espacio: { ancho: v } }) }),
            h(Campo, { label: 'Profundidad disponible (cm)', type: 'range', min: 100, max: 500, step: 5, value: m.espacio.profundidad, onChange: (v) => patch({ espacio: { profundidad: v } }) }),
            h(Campo, { label: 'Distancia de la zona al tótem (cm)', type: 'range', min: 60, max: 400, step: 5, value: m.espacio.distanciaZona, help: 'Una sola marca en el piso para todos los juegos con cámara: así se calibra una vez y nadie tiene que moverse entre juego y juego.', onChange: (v) => patch({ espacio: { distanciaZona: v } }) }),
            h(Campo, { label: 'Altura de la cámara (cm)', type: 'range', min: 40, max: 320, step: 0.5, value: m.espacio.camaraAltura, help: 'Del piso al centro del lente, no al borde de la carcasa. En el tótem de 180 cm son 175,5 cm.', onChange: (v) => patch({ espacio: { camaraAltura: v } }) }),
            h(Campo, { label: 'Inclinación de la cámara (grados hacia abajo)', type: 'range', min: -20, max: 40, step: 1, value: m.espacio.camaraInclinacion, onChange: (v) => patch({ espacio: { camaraInclinacion: v } }) }),
            h(Campo, { label: 'Campo de visión horizontal del lente (grados)', type: 'range', min: 40, max: 150, step: 1, value: m.espacio.fovHorizontal, help: 'Dato del fabricante. El diagnóstico lo verifica midiendo a una persona real.', onChange: (v) => patch({ espacio: { fovHorizontal: v } }) }),
            h(Campo, { label: 'Dibujar la zona en las pantallas de ubicación', type: 'boolean', value: m.espacio.mostrarGuia, onChange: (v) => patch({ espacio: { mostrarGuia: v } }) })),
          h('div', { className: 'fp-actions' },
            h(Boton, {
              variant: 'soft',
              onClick: () => { patch({ espacio: { alto: 240, ancho: 220, profundidad: 250, distanciaZona: 220, camaraAltura: 145, camaraInclinacion: 5, fovHorizontal: 90 } }); notify('info', 'Espacio recomendado aplicado.'); },
            }, 'Espacio recomendado (240 × 220 × 250 cm)'),
            h(Boton, {
              onClick: () => {
                const mo = sugerirMontaje(m.espacio, 16 / 9);
                patch({ espacio: { camaraInclinacion: clamp(mo.inclinacion, -20, 40), distanciaZona: clamp(mo.distancia, 60, num(m.espacio.profundidad, 250)) } });
                notify('success', 'Inclinación ' + mo.inclinacion + '° y zona a ' + mo.distancia + ' cm.');
              },
            }, 'Calcular inclinación y zona para esta cámara'),
            h(Boton, {
              onClick: () => { patch({ espacio: { camaraAltura: 175.5, camaraInclinacion: 11, distanciaZona: 220 } }); notify('info', 'Cámara del tótem a 175,5 cm con cuña de 11°: ve de 0 a 249 cm en la zona.'); },
            }, 'Cámara del tótem a 175,5 cm, con cuña de 11°'),
            // El estado "tal como viene de fábrica", para ver el veredicto sin
            // tocar nada: es el punto de partida de cualquier instalación.
            h(Boton, {
              variant: 'soft',
              onClick: () => {
                patch({ espacio: { camaraAltura: 175.5, camaraInclinacion: 0, camaraModelo: 'integrada', fovHorizontal: 70, distanciaZona: 220 } });
                notify('info', 'Cámara del tótem sin inclinar: el piso recién entra en cuadro a 446 cm.');
              },
            }, 'Cámara del tótem tal como viene (175,5 cm, 0°)')),
          h(TablaCamaras, { espacio: m.espacio, aspecto: 16 / 9 })) : null,

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
              // Se conserva el ranking Y su configuración: restaurar la marca
              // no puede llevarse por delante un aviso de puntajes pendientes.
              onClick: () => { if (confirm('¿Restaurar la configuración de fábrica? Se conserva el ranking.')) { commit(merge(clone(DEFAULT_MODEL), { scores: m.scores, ranking: m.ranking })); notify('info', 'Configuración restaurada.'); } },
            }, 'Restaurar de fábrica')),
          h(Campo, { label: 'Configuración JSON', type: 'textarea', rows: 16, value: json, onChange: setJson })) : null));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 16.b Modo sensor: lo que ve el teléfono
  // ══════════════════════════════════════════════════════════════════════
  //
  // Esta pantalla NO es la app. Es lo único que se dibuja cuando alguien abre
  // la dirección del QR: una vista de cámara, el estado del enlace y nada más.
  // Ni juegos, ni ranking, ni editor. El teléfono es un sensor, y un sensor que
  // además ofrece jugar sería un teléfono que alguien se lleva a la mano en
  // medio de la partida.
  //
  // La frase "la imagen no sale del teléfono" se sostiene acá: el <video> se
  // conecta al modelo de pose y a nada más, y por el enlace solo se serializan
  // landmarks. No hay ninguna ruta de código que mande píxeles.

  function PantallaSensor(props) {
    const sala = props.sala;
    const [estado, setEstado] = useState({ fase: 'arrancando', aviso: '' });
    const [salud, setSalud] = useState(null);
    const videoRef = useRef(null);
    const ref = useRef({ enlace: null, prov: null, stream: null, parar: null, wake: null });

    useEffect(() => {
      const R = ref.current;
      let vivo = true;

      // El simulador también vale como sensor: sirve para comprobar el enlace
      // y la latencia ANTES de que llegue nadie, que es cuando el operador
      // todavía puede mover el router. Se declara en la pantalla para que
      // nadie confunda un maniquí con una persona.
      const conDemo = s(model.hardware.motorPose) === 'demo';

      const arrancar = async () => {
        if (conDemo) {
          R.prov = proveedorDemo();
          await R.prov.iniciar();
          conectarEnlace();
          return;
        }
        // 1. La cámara. Si el navegador no la da, casi siempre es el contexto
        //    inseguro, y hay que decirlo con esas palabras.
        try {
          R.stream = await abrirCamara(Object.assign({}, model.hardware, { camaraDeviceId: '' }));
          const v = videoRef.current;
          if (!v) throw new Error('No se pudo montar el video.');
          v.srcObject = R.stream;
          await v.play().catch(() => {});
        } catch (e) {
          if (!vivo) return;
          const seguro = typeof window === 'undefined' || window.isSecureContext !== false;
          setEstado({
            fase: 'sin-camara',
            aviso: seguro ? mensajeCamara(e)
              : 'Esta página no está en un contexto seguro (https o localhost), así que el navegador ' +
                'no va a dar permiso de cámara por más que se lo pidas. Hay que abrirla por https: ' +
                'está explicado en puente-sensor/README.md.',
          });
          return;
        }
        // 2. La pantalla del teléfono no se puede apagar: si se bloquea, se
        //    corta el sensor en medio de una partida.
        try {
          if (navigator.wakeLock && navigator.wakeLock.request) R.wake = await navigator.wakeLock.request('screen');
        } catch (e) { /* no todos los navegadores la tienen; no es fatal */ }

        // 3. El motor de pose, con la tubería completa de la Fase 2. Se corre
        //    ACÁ y no en la pantalla: es lo que convierte 30 MB/s de vídeo en
        //    30 kB/s de puntos.
        try {
          R.prov = proveedorMediaPipe(model.hardware, model.espacio);
          await R.prov.iniciar(videoRef.current);
        } catch (e) {
          if (!vivo) return;
          setEstado({ fase: 'sin-motor', aviso: mensajeCamara(e) });
          return;
        }
        if (!vivo) return;
        conectarEnlace();
      };

      /** El enlace con la pantalla y el bucle de transmisión. */
      function conectarEnlace() {
        R.enlace = enlaceSensor({
          rol: 'sensor', hw: model.hardware, sala,
          alCambiar: (e, aviso) => { if (vivo) setEstado({ fase: e, aviso: aviso || '' }); },
        });
        R.enlace.iniciar();

        // Bucle propio, al ritmo configurado. No se manda a 60 Hz "por si
        // acaso": cada cuadro de más es batería del teléfono y ancho de banda
        // en un wifi que ya es el eslabón débil.
        const cadaMs = 1000 / clamp(num(model.hardware.sensorHz, 24), 5, 40);
        let ultimo = 0, ultimoEstado = 0;
        R.parar = loop(() => {
          const t = nowMs();
          if (t - ultimo < cadaMs) return;
          ultimo = t;
          const lec = R.prov.leer();
          const v = videoRef.current;
          if (lec && lec.landmarks) {
            R.enlace.mandarPose(lec.landmarks, lec.mundo, v ? v.videoWidth : 0, v ? v.videoHeight : 0);
          }
          if (t - ultimoEstado > 1000) {
            ultimoEstado = t;
            const sp = R.prov.salud ? R.prov.salud() : { hz: 0, ms: 0 };
            R.enlace.mandarEstado({ hz: sp.hz, ms: sp.ms, recorte: sp.recorte, aceptados: sp.aceptados, rechazados: sp.rechazados, demo: conDemo });
            setSalud(Object.assign({ pose: sp }, R.enlace.salud()));
          }
        });
      }

      arrancar();
      return () => {
        vivo = false;
        if (R.parar) R.parar();
        try { R.enlace && R.enlace.detener(); } catch (e) { /* noop */ }
        try { R.prov && R.prov.detener(); } catch (e) { /* noop */ }
        try { R.wake && R.wake.release && R.wake.release(); } catch (e) { /* noop */ }
        if (R.stream) { try { R.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } }
      };
    }, [sala]);

    const FRASES = {
      arrancando: ['Encendiendo la cámara…', ''],
      conectando: ['Buscando la pantalla…', ''],
      esperando: ['Esperando a la pantalla', 'Abre el mismo código de sala en el tótem o el notebook.'],
      ws: ['✅ Conectado con la pantalla', 'Por el puente local.'],
      rtc: ['✅ Conectado con la pantalla', 'Enlace directo entre los dos equipos.'],
      caido: ['⚠️ Se cortó el enlace', 'Reintentando solo. No cierres esta pantalla.'],
      inactivo: ['Detenido', ''],
      'sin-camara': ['❌ Sin cámara', ''],
      'sin-motor': ['❌ No se pudo cargar el motor de pose', ''],
    };
    const [titulo, sub] = FRASES[estado.fase] || ['…', ''];
    const conectado = estado.fase === 'ws' || estado.fase === 'rtc';

    return h('div', { className: 'fp-sensor' },
      h('header', { className: 'fp-sensor-head' },
        h('span', { className: 'fp-sensor-logo' }, '📱'),
        h('div', null,
          h('b', null, 'Modo sensor'),
          h('span', null, 'Sala ' + salaLegible(sala)))),
      h('div', { className: 'fp-sensor-cam' + (s(model.hardware.motorPose) === 'demo' ? ' is-demo' : '') },
        s(model.hardware.motorPose) === 'demo'
          ? h('div', { className: 'fp-sensor-demo' }, '🎭', h('span', null, 'Simulador: no hay nadie siendo leído'))
          : h('video', { ref: videoRef, autoPlay: true, playsInline: true, muted: true })),
      h('div', { className: 'fp-sensor-estado' + (conectado ? ' is-ok' : estado.fase === 'caido' || estado.fase.startsWith('sin-') ? ' is-mal' : '') },
        h('b', null, titulo),
        sub ? h('span', null, sub) : null,
        estado.aviso ? h('p', { className: 'fp-error' }, estado.aviso) : null),
      salud ? h('ul', { className: 'fp-sensor-datos' },
        h('li', null, 'Pose: ' + (salud.pose.hz || 0) + ' fps · ' + (salud.pose.ms || 0) + ' ms'),
        h('li', null, 'Enviados: ' + salud.enviados + ' cuadros'),
        h('li', null, 'Enlace: ' + (salud.via === 'rtc' ? 'directo' : salud.via === 'ws' ? 'por el puente' : '—') +
          (salud.rtt != null ? ' · ' + salud.rtt + ' ms ida y vuelta' : ''))) : null,
      h('p', { className: 'fp-sensor-privacidad' },
        '🔒 La imagen no sale de este teléfono. Se calculan acá los 33 puntos del cuerpo y se ' +
        'transmiten solo esos números. No se graba, no se guarda y no se envía vídeo.'),
      h('p', { className: 'fp-note' },
        'Deja esta pantalla abierta y el teléfono apoyado y quieto. Si se bloquea la pantalla, ' +
        'el sensor se corta.'));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 17. Componente raíz
  // ══════════════════════════════════════════════════════════════════════

  const RENDERERS = {
    burro: JuegoBurro, baile: JuegoBaile, laser: JuegoLaser,
    rayuela: JuegoRayuela, boxeo: JuegoBoxeo, gato: JuegoGato,
    gol: JuegoGol, esquiva2d: JuegoEsquiva2D, esquiva3d: JuegoEsquiva3D,
    vuelo: JuegoVuelo, vuelo3d: JuegoVuelo3D,
  };

  // Se lee UNA vez al montar: si cambiara a mitad de sesión, un teléfono
  // pasaría de sensor a pantalla con una partida en curso.
  const salaSensor = salaDeLaUrl();

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
        if (route.screen !== 'home' && nowMs() - idleRef.current > secs * 1000) {
          // Quien se fue a mitad no midió una partida: que no ensucie la mediana.
          salidaPorInactividad();
          go('home');
        }
      }, 2000);
      timers.add(iv);
      return () => {
        clearInterval(iv); timers.delete(iv);
        if (el) { el.removeEventListener('pointerdown', tocar); el.removeEventListener('keydown', tocar); }
      };
    }, [m.branding.idleSeconds, r.screen]);

    const t = themeOf(m);
    let vista;
    // Si la dirección trae un código de sala, este dispositivo es un SENSOR y
    // no una pantalla. Se decide antes que cualquier otra ruta: un teléfono
    // que además muestra el menú de juegos es un teléfono que alguien se lleva
    // a la mano en mitad de la partida.
    if (salaSensor) vista = h(PantallaSensor, { sala: salaSensor });
    else if (r.screen === 'editor') vista = h(Editor, { model: m });
    else if (r.screen === 'ranking') vista = h(Ranking, { model: m });
    else if (r.screen === 'diagnostico') vista = h(Diagnostico, { model: m });
    else if (r.screen === 'metricas') vista = h(Metricas, { model: m });
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
        version: APP_VERSION,
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
            // Sacar un juego de la portada en pleno evento deja a la fila sin
            // ese juego: es reversible, pero no en silencio ni a distancia.
            if (typeof p.enabled === 'boolean' && p.enabled !== (g.enabled !== false)) {
              if (!p.enabled) {
                go('editor');
                if (!confirm('El asistente pide OCULTAR "' + g.name + '" de la portada.\n\n¿Autorizas?')) {
                  return { success: false, error: 'Nadie confirmó en el tótem: "' + g.name + '" sigue visible.' };
                }
              }
              cambio.enabled = p.enabled;
            }
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
            // El agente PIDE, la persona confirma. Un tótem es un equipo
            // compartido y esta acción llega por lenguaje natural: nadie debe
            // poder vaciar el ranking de un evento hablándole a la app desde
            // otra sala. Se abre el mismo diálogo que usa el botón "Vaciar" y
            // hace falta un toque humano en la pantalla.
            const n = (model.scores || []).length;
            if (!n) return { success: true, message: 'El ranking ya está vacío.' };
            go('ranking');
            if (!confirm('El asistente pide vaciar el ranking (' + n + ' partidas).\n\n' +
                '¿Autorizas? Se descarga una copia antes de borrar.')) {
              return { success: false, error: 'Nadie confirmó en la pantalla del tótem: el ranking NO se borró.' };
            }
            vaciarRanking('agente');
            return { success: true, message: 'Ranking vaciado tras confirmarse en el tótem. Se guardó una copia de ' + n + ' partidas.' };
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
