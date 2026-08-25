/* LiDARia 1.0.0 — bundle generado por apps/lidaria/build.mjs.
   No editar a mano: se regenera desde src/app.js + src/nucleo.js + src/payload.json. */

/* kimos-LiDARia · núcleo 1.0.0 — GENERADO, no editar.
   Fuente: repositorio kimos-LiDARia, src/core/. Regenerar con:
     node tools/build-kimos-payload.mjs
*/

/* ===== src/core/capabilities.js ===== */
/**
 * capabilities.js — el vocabulario de capacidades de kimos-LiDARia.
 *
 * Todo el sistema (detección, base de equipos, módulos y diagnóstico) habla
 * este vocabulario y solo este. Un módulo nunca pregunta "¿es un iPhone Pro?":
 * pregunta "¿hay `depth.dtof` y `api.arkit.mesh`?". Así, cuando salga un equipo
 * nuevo, basta añadirlo a la base de equipos y todos los módulos lo entienden.
 *
 * Cada capacidad declara CÓMO se sabe que existe (`evidencia`), porque no todas
 * se pueden medir igual: unas se prueban en caliente (WebXR responde sí/no),
 * otras solo se pueden inferir del modelo del equipo (iOS no expone el modelo al
 * navegador) y otras las declara el contenedor nativo. Esa diferencia viaja con
 * el resultado del diagnóstico: nunca decimos "tiene LiDAR" con la misma
 * seguridad cuando lo midió el sistema que cuando lo dedujimos del catálogo.
 */

/** Cómo se obtuvo el valor de una capacidad, de más a menos fiable. */
const FUENTES = {
  medida: { id: 'medida', peso: 3, label: 'Medida', desc: 'El sistema la probó en este equipo (el API respondió).' },
  declarada: { id: 'declarada', peso: 2, label: 'Declarada', desc: 'La declaró el contenedor nativo (app iOS/Android) leyendo el hardware.' },
  inferida: { id: 'inferida', peso: 1, label: 'Inferida', desc: 'Se dedujo del modelo de equipo reconocido en el catálogo.' },
  supuesta: { id: 'supuesta', peso: 0, label: 'Supuesta', desc: 'Ni medida ni reconocida: se asume por familia de equipo. Confirmar con el usuario.' },
};

/** Grupos en los que se ordenan las capacidades para mostrarlas. */
const GRUPOS = [
  { id: 'sensor', label: 'Sensores de profundidad', icon: '📡' },
  { id: 'api', label: 'APIs de realidad aumentada', icon: '🧩' },
  { id: 'media', label: 'Captura y sensores base', icon: '🎥' },
  { id: 'compute', label: 'Cómputo en el dispositivo', icon: '⚙️' },
  { id: 'runtime', label: 'Entorno de ejecución', icon: '📦' },
  { id: 'io', label: 'Entrada / salida', icon: '🔁' },
];

/**
 * Catálogo de capacidades.
 *  - `id`        clave estable que usan módulos y equipos.
 *  - `evidencia` cómo se determina: 'prueba' (se ejecuta), 'catalogo' (modelo),
 *               'nativo' (lo informa el contenedor), 'mixta'.
 */
const CAPABILITIES = [
  /* ---------------------------- sensores ---------------------------- */
  {
    id: 'depth.dtof', grupo: 'sensor', label: 'Profundidad directa (LiDAR / dToF)', corto: 'LiDAR',
    evidencia: 'catalogo',
    desc: 'Emisor láser que mide el tiempo de vuelo de una malla de puntos. Da profundidad métrica real, funciona en oscuridad total y no necesita textura en la escena.',
  },
  {
    id: 'depth.itof', grupo: 'sensor', label: 'Profundidad indirecta (ToF continuo)', corto: 'ToF',
    evidencia: 'catalogo',
    desc: 'Onda continua modulada; mide el desfase. Buena a corta distancia, se degrada al sol y a más de 3-4 m.',
  },
  {
    id: 'depth.structured', grupo: 'sensor', label: 'Luz estructurada frontal (TrueDepth)', corto: 'TrueDepth',
    evidencia: 'catalogo',
    desc: 'Proyector de puntos frontal. Precisión sub-milimétrica a menos de 60 cm: rostro, piezas pequeñas, antropometría de cabeza.',
  },
  {
    id: 'depth.stereo', grupo: 'sensor', label: 'Profundidad por estéreo multicámara', corto: 'Estéreo',
    evidencia: 'catalogo',
    desc: 'Dos o más cámaras traseras con separación conocida. Profundidad con escala, pero necesita luz y textura.',
  },
  {
    id: 'depth.motion', grupo: 'sensor', label: 'Profundidad por movimiento (depth-from-motion)', corto: 'Movimiento',
    evidencia: 'prueba',
    desc: 'Se reconstruye moviendo el equipo (ARCore Depth sin sensor dedicado). Cubre la mayoría del parque Android, con error mayor y dependencia de textura.',
  },

  /* ------------------------------ APIs ------------------------------ */
  {
    id: 'api.arkit.scenedepth', grupo: 'api', label: 'ARKit · sceneDepth', corto: 'sceneDepth',
    evidencia: 'nativo', desc: 'Mapa de profundidad por fotograma con confianza por píxel. Base de medición y oclusión en iOS.',
  },
  {
    id: 'api.arkit.mesh', grupo: 'api', label: 'ARKit · Scene Reconstruction (malla)', corto: 'Malla ARKit',
    evidencia: 'nativo', desc: 'Malla del entorno con clasificación semántica (suelo, pared, mesa, puerta, ventana, asiento).',
  },
  {
    id: 'api.arkit.roomplan', grupo: 'api', label: 'RoomPlan (plano paramétrico)', corto: 'RoomPlan',
    evidencia: 'nativo', desc: 'Escaneo de habitación a modelo paramétrico limpio: muros, aberturas y mobiliario como objetos, no como triángulos.',
  },
  {
    id: 'api.arkit.objectcapture', grupo: 'api', label: 'Object Capture (fotogrametría en el equipo)', corto: 'Object Capture',
    evidencia: 'nativo', desc: 'Reconstrucción de objetos con textura de alta calidad usando fotos + profundidad, procesada en el propio dispositivo.',
  },
  {
    id: 'api.arkit.body', grupo: 'api', label: 'ARKit · Body Tracking', corto: 'Cuerpo',
    evidencia: 'nativo', desc: 'Esqueleto 3D de una persona en tiempo real. Base de postura y rango de movimiento.',
  },
  {
    id: 'api.arcore.depth', grupo: 'api', label: 'ARCore · Depth API', corto: 'Depth API',
    evidencia: 'nativo', desc: 'Profundidad suavizada por fotograma en Android; usa ToF si existe y movimiento si no.',
  },
  {
    id: 'api.arcore.rawdepth', grupo: 'api', label: 'ARCore · Raw Depth', corto: 'Raw Depth',
    evidencia: 'nativo', desc: 'Profundidad sin rellenar, con máscara de confianza: lo que hay que usar para medir, no para pintar.',
  },
  {
    id: 'api.arcore.semantics', grupo: 'api', label: 'ARCore · Scene Semantics', corto: 'Semántica',
    evidencia: 'nativo', desc: 'Etiqueta cada píxel (cielo, edificio, vegetación, persona, suelo...). Permite medir o pintar solo lo que interesa.',
  },
  {
    id: 'api.arcore.geospatial', grupo: 'api', label: 'ARCore · Geospatial', corto: 'Geoespacial',
    evidencia: 'nativo', desc: 'Ancla contenido en coordenadas del mundo (VPS + GNSS). Base de gemelo digital al aire libre.',
  },
  {
    id: 'api.webxr.ar', grupo: 'api', label: 'WebXR · sesión immersive-ar', corto: 'WebXR AR',
    evidencia: 'prueba', desc: 'Realidad aumentada dentro del navegador, sin instalar nada. Se prueba en caliente porque varía por navegador y versión.',
  },
  {
    id: 'api.webxr.depth', grupo: 'api', label: 'WebXR · Depth Sensing', corto: 'WebXR Depth',
    evidencia: 'prueba', desc: 'Mapa de profundidad dentro del navegador. Hoy es el único camino a medición web sin app nativa.',
  },
  {
    id: 'api.webxr.hittest', grupo: 'api', label: 'WebXR · Hit Test', corto: 'Hit Test',
    evidencia: 'prueba', desc: 'Rayo contra la geometría real detectada: permite marcar puntos y medir entre ellos aunque no haya mapa de profundidad.',
  },
  {
    id: 'api.webxr.anchors', grupo: 'api', label: 'WebXR · Anchors', corto: 'Anclas',
    evidencia: 'prueba', desc: 'Puntos que se mantienen fijos en el mundo mientras dura la sesión.',
  },
  {
    id: 'api.webxr.mesh', grupo: 'api', label: 'WebXR · Mesh / Plane detection', corto: 'Mallas web',
    evidencia: 'prueba', desc: 'Planos y mallas del entorno expuestos al navegador (visores XR, principalmente).',
  },
  {
    id: 'api.viewer.usdz', grupo: 'api', label: 'Visor AR nativo USDZ (Quick Look)', corto: 'Quick Look',
    evidencia: 'catalogo', desc: 'Ver un modelo en el espacio real sin escanear nada. Es el mínimo común de iOS y no necesita LiDAR.',
  },
  {
    id: 'api.viewer.glb', grupo: 'api', label: 'Visor AR nativo glTF/GLB (Scene Viewer)', corto: 'Scene Viewer',
    evidencia: 'catalogo', desc: 'Equivalente en Android vía Servicios de Google para RA.',
  },

  /* --------------------------- captura base --------------------------- */
  { id: 'media.camera', grupo: 'media', label: 'Cámara', corto: 'Cámara', evidencia: 'prueba', desc: 'Acceso a cámara (getUserMedia o nativo). Sin esto no hay captura de ningún tipo.' },
  { id: 'media.multicam', grupo: 'media', label: 'Varias cámaras traseras', corto: 'Multicámara', evidencia: 'mixta', desc: 'Permite estéreo y cambio de focal durante el escaneo.' },
  { id: 'sensor.imu', grupo: 'media', label: 'Acelerómetro y giróscopo', corto: 'IMU', evidencia: 'prueba', desc: 'Seguimiento de la pose del equipo entre fotogramas. Es lo que da escala real a la fotogrametría.' },
  { id: 'sensor.gnss', grupo: 'media', label: 'GNSS / GPS', corto: 'GNSS', evidencia: 'prueba', desc: 'Georreferenciar la captura para cruzarla con nubes de puntos públicas.' },

  /* ------------------------------ cómputo ------------------------------ */
  { id: 'compute.webgpu', grupo: 'compute', label: 'WebGPU', corto: 'WebGPU', evidencia: 'prueba', desc: 'Cómputo en GPU desde el navegador: mallado, splatting y visores de millones de puntos.' },
  { id: 'compute.wasm.simd', grupo: 'compute', label: 'WebAssembly SIMD', corto: 'WASM SIMD', evidencia: 'prueba', desc: 'Procesamiento de nubes de puntos en el cliente a velocidad razonable.' },
  { id: 'compute.npu', grupo: 'compute', label: 'Acelerador neuronal (ANE / NNAPI)', corto: 'NPU', evidencia: 'nativo', desc: 'Segmentación y detección en tiempo real sin fundir la batería.' },

  /* ------------------------------ entorno ------------------------------ */
  { id: 'runtime.web', grupo: 'runtime', label: 'Navegador (PWA)', corto: 'Web', evidencia: 'prueba', desc: 'La app corre como página instalable, sin tienda de aplicaciones.' },
  { id: 'runtime.native.ios', grupo: 'runtime', label: 'App nativa iOS/iPadOS', corto: 'iOS nativo', evidencia: 'nativo', desc: 'Contenedor nativo: única vía a ARKit, RoomPlan y Object Capture.' },
  { id: 'runtime.native.android', grupo: 'runtime', label: 'App nativa Android', corto: 'Android nativo', evidencia: 'nativo', desc: 'Contenedor nativo: única vía a Raw Depth, semántica y geoespacial.' },
  { id: 'runtime.headset', grupo: 'runtime', label: 'Visor de realidad mixta', corto: 'Visor XR', evidencia: 'prueba', desc: 'Vision Pro, Quest y similares: sesión inmersiva con las manos libres.' },
  { id: 'runtime.kimos.shell', grupo: 'runtime', label: 'Escritorio KIMOS', corto: 'KIMOS', evidencia: 'prueba', desc: 'La app corre dentro del shell de KIMOS: consola de gestión, no de captura.' },

  /* -------------------------------- I/O -------------------------------- */
  { id: 'io.filesystem', grupo: 'io', label: 'Guardar archivos grandes', corto: 'Archivos', evidencia: 'prueba', desc: 'Exportar nubes y mallas sin pasar por el servidor.' },
  { id: 'io.share', grupo: 'io', label: 'Compartir al sistema', corto: 'Compartir', evidencia: 'prueba', desc: 'Enviar el resultado a otra app del equipo.' },
];

const CAP_POR_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

/** Capacidades que, si están, hacen que el equipo sea "de captura métrica". */
const CAPS_METRICAS = ['depth.dtof', 'depth.itof', 'depth.structured', 'depth.motion', 'depth.stereo'];

/**
 * Precisión esperable por tecnología de profundidad. Son bandas de ingeniería
 * para fijar expectativas y elegir el modo de captura, NO una calibración: la
 * app siempre muestra el error medido en la propia sesión cuando puede.
 */
const PERFIL_SENSOR = {
  'depth.dtof': {
    label: 'LiDAR (dToF)', rango: [0.2, 5.0], errorRel: 0.01, errorMin: 0.005,
    oscuridad: true, sol: 'medio', textura: false,
    nota: 'Centímetro a distancia de habitación. Es el único que rinde igual a oscuras.',
  },
  'depth.itof': {
    label: 'ToF continuo (iToF)', rango: [0.2, 4.0], errorRel: 0.025, errorMin: 0.01,
    oscuridad: true, sol: 'malo', textura: false,
    nota: 'Muy bueno de cerca; a pleno sol y más allá de 3-4 m se degrada rápido.',
  },
  'depth.structured': {
    label: 'Luz estructurada frontal', rango: [0.15, 0.7], errorRel: 0.005, errorMin: 0.001,
    oscuridad: true, sol: 'malo', textura: false,
    nota: 'Sub-milimétrico, pero solo a menos de 70 cm y con la cámara frontal.',
  },
  'depth.stereo': {
    label: 'Estéreo multicámara', rango: [0.3, 6.0], errorRel: 0.04, errorMin: 0.02,
    oscuridad: false, sol: 'bueno', textura: true,
    nota: 'Necesita luz y superficies con textura; falla en paredes lisas.',
  },
  'depth.motion': {
    label: 'Profundidad por movimiento', rango: [0.5, 8.0], errorRel: 0.07, errorMin: 0.03,
    oscuridad: false, sol: 'bueno', textura: true,
    nota: 'Exige mover el equipo con paralaje. Sirve para volumen y oclusión, no para acotar un plano de obra.',
  },
};

/** Devuelve el mejor perfil de sensor disponible en un conjunto de capacidades. */
function mejorSensor(caps) {
  const orden = ['depth.dtof', 'depth.itof', 'depth.structured', 'depth.stereo', 'depth.motion'];
  for (const id of orden) if (caps.has ? caps.has(id) : caps[id]) return { id, ...PERFIL_SENSOR[id] };
  return null;
}

/** Error esperado (en metros) de una medida a `distancia` metros con `sensorId`. */
function errorEsperado(sensorId, distancia) {
  const p = PERFIL_SENSOR[sensorId];
  if (!p) return null;
  const d = Math.max(0, Number(distancia) || 0);
  return Math.max(p.errorMin, d * p.errorRel);
}

/* ===== src/core/detect.js ===== */
/**
 * detect.js — reunir evidencia sobre el equipo, sin adivinar.
 *
 * La regla del módulo: aquí NO se decide nada. Solo se recoge lo que el entorno
 * está dispuesto a decir (y lo que se puede probar en caliente), se anota cómo
 * se supo y se entrega crudo. Interpretar es tarea de resolve.js.
 *
 * Funciona en tres entornos y en los tres devuelve la misma forma:
 *   · navegador / PWA        → prueba WebXR, WebGPU, cámara, sensores
 *   · contenedor nativo      → además lee el informe que deja la app iOS/Android
 *   · node (tests, servidor) → devuelve evidencia vacía y honesta
 */

/** Contrato del informe que deja el contenedor nativo en `window.KimosLiDARia`. */
const CONTRATO_NATIVO = {
  version: 1,
  campos: {
    plataforma: "'ios' | 'android' | 'visionos' | 'android-xr'",
    modelo: "identificador de hardware exacto (p.ej. 'iPhone17,1' o 'SM-S928B')",
    sistema: "versión del sistema operativo",
    caps: 'array de ids de capacidad que el contenedor confirmó contra el hardware',
    arkit: '{ sceneDepth, mesh, roomPlan, objectCapture, bodyTracking }',
    arcore: '{ depth, rawDepth, semantics, geospatial }',
    appVersion: 'versión del contenedor',
  },
};

const noop = () => undefined;

/** Prueba si una sesión WebXR de un tipo está soportada, sin lanzar. */
async function soportaSesion(xr, tipo) {
  if (!xr || typeof xr.isSessionSupported !== 'function') return false;
  try { return !!(await xr.isSessionSupported(tipo)); } catch (e) { return false; }
}

/**
 * Módulos de WebXR: no hay forma estándar de preguntar "¿soportas depth?" sin
 * pedir la sesión, y pedirla exige gesto del usuario. Así que aquí se anota lo
 * que se puede saber sin sesión y se deja el resto para `probarSesionXR()`,
 * que la app llama detrás de un botón.
 */
async function detectarXR(nav) {
  const xr = nav && nav.xr;
  const r = { disponible: !!xr, ar: false, vr: false, modulos: null, probado: false };
  if (!xr) return r;
  r.ar = await soportaSesion(xr, 'immersive-ar');
  r.vr = await soportaSesion(xr, 'immersive-vr');
  return r;
}

/**
 * Prueba real de módulos XR: pide una sesión con las funciones opcionales y
 * mira cuáles quedaron activas. Requiere gesto del usuario; devuelve null si
 * no se pudo. Es la única fuente 'medida' de depth/hit-test/anclas en la web.
 */
async function probarSesionXR(nav) {
  const xr = nav && nav.xr;
  if (!xr || typeof xr.requestSession !== 'function') return null;
  const opcionales = ['hit-test', 'anchors', 'depth-sensing', 'plane-detection', 'mesh-detection', 'light-estimation'];
  let sesion = null;
  try {
    sesion = await xr.requestSession('immersive-ar', {
      optionalFeatures: opcionales,
      depthSensing: { usagePreference: ['cpu-optimized', 'gpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] },
    });
  } catch (e) {
    return { error: String((e && e.message) || e), modulos: null };
  }
  const activos = sesion.enabledFeatures || [];
  const tiene = (f) => (Array.isArray(activos) ? activos.indexOf(f) >= 0 : false);
  const res = {
    error: null,
    modulos: {
      hitTest: tiene('hit-test'),
      anchors: tiene('anchors'),
      depth: tiene('depth-sensing') || !!sesion.depthUsage,
      planes: tiene('plane-detection'),
      mallas: tiene('mesh-detection'),
      luz: tiene('light-estimation'),
    },
    depthUsage: sesion.depthUsage || null,
    depthFormat: sesion.depthDataFormat || null,
    features: Array.isArray(activos) ? activos.slice() : [],
  };
  try { await sesion.end(); } catch (e) { noop(); }
  return res;
}

/** Cámaras traseras visibles sin pedir permiso (las etiquetas llegan vacías si no hay permiso). */
async function detectarCamaras(nav) {
  const md = nav && nav.mediaDevices;
  if (!md || typeof md.enumerateDevices !== 'function') return { disponible: false, n: 0, etiquetas: false };
  try {
    const ds = await md.enumerateDevices();
    const vid = ds.filter((d) => d.kind === 'videoinput');
    return { disponible: vid.length > 0, n: vid.length, etiquetas: vid.some((d) => !!d.label) };
  } catch (e) {
    return { disponible: false, n: 0, etiquetas: false };
  }
}

/** WebGPU sin pedir adaptador dos veces; falla en silencio donde no existe. */
async function detectarWebGPU(nav) {
  if (!nav || !nav.gpu || typeof nav.gpu.requestAdapter !== 'function') return { disponible: false, adaptador: null };
  try {
    const a = await nav.gpu.requestAdapter();
    if (!a) return { disponible: false, adaptador: null };
    const info = (typeof a.requestAdapterInfo === 'function' ? await a.requestAdapterInfo() : a.info) || {};
    return { disponible: true, adaptador: info.description || info.vendor || info.architecture || 'sin detalle' };
  } catch (e) {
    return { disponible: false, adaptador: null };
  }
}

/** Cadena del renderizador WebGL: la única pista de GPU que da Safari. */
function detectarGPU(doc) {
  if (!doc || typeof doc.createElement !== 'function') return null;
  try {
    const c = doc.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return s ? String(s) : null;
  } catch (e) {
    return null;
  }
}

/** WASM con SIMD: se comprueba compilando un módulo mínimo que usa v128. */
function detectarWasmSimd(g) {
  try {
    if (!g.WebAssembly || typeof g.WebAssembly.validate !== 'function') return false;
    // (module (func (result v128) (v128.const i32x4 0 0 0 0)))
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
      10, 22, 1, 20, 0, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11]);
    return g.WebAssembly.validate(bytes);
  } catch (e) {
    return false;
  }
}

/** Lee el informe del contenedor nativo si lo hay, validando la forma. */
function leerInformeNativo(g) {
  const n = g && (g.KimosLiDARia || (g.webkit && g.webkit.messageHandlers && g.__kimosLiDARiaNativo));
  if (!n || typeof n !== 'object') return null;
  const caps = Array.isArray(n.caps) ? n.caps.filter((c) => typeof c === 'string') : [];
  return {
    plataforma: typeof n.plataforma === 'string' ? n.plataforma : null,
    modelo: typeof n.modelo === 'string' ? n.modelo : null,
    sistema: typeof n.sistema === 'string' ? n.sistema : null,
    appVersion: typeof n.appVersion === 'string' ? n.appVersion : null,
    caps,
    arkit: n.arkit && typeof n.arkit === 'object' ? n.arkit : null,
    arcore: n.arcore && typeof n.arcore === 'object' ? n.arcore : null,
  };
}

/** Modelo exacto en Android (y plataforma real), si el navegador lo entrega. */
async function detectarClientHints(nav) {
  const uad = nav && nav.userAgentData;
  if (!uad) return null;
  const base = { plataforma: uad.platform || null, movil: !!uad.mobile, modelo: null, sistemaVersion: null };
  if (typeof uad.getHighEntropyValues !== 'function') return base;
  try {
    const alta = await uad.getHighEntropyValues(['model', 'platformVersion', 'architecture']);
    base.modelo = alta.model || null;
    base.sistemaVersion = alta.platformVersion || null;
  } catch (e) { noop(); }
  return base;
}

/**
 * Recoge toda la evidencia disponible. `g` es el objeto global (se inyecta para
 * poder testear sin navegador). Nunca lanza: donde no hay dato, hay `null`.
 */
async function detectar(g) {
  const G = g || (typeof globalThis !== 'undefined' ? globalThis : {});
  const nav = G.navigator || null;
  const doc = G.document || null;
  const scr = G.screen || null;

  const ua = (nav && nav.userAgent) || '';
  const nativo = leerInformeNativo(G);
  const hints = await detectarClientHints(nav);
  const xr = await detectarXR(nav);
  const camaras = await detectarCamaras(nav);
  const webgpu = await detectarWebGPU(nav);

  const enShellKimos = !!(G.__KIMOS_SHELL__ || (G.parent && G.parent !== G && /kimos/i.test(String(G.location && G.location.hostname || ''))));

  const evid = {
    generado: new Date().toISOString(),
    // `document` es lo que separa un navegador de un node con `navigator` (node 18+ lo trae).
    runtime: nativo ? 'nativo' : (doc ? 'web' : 'node'),
    enShellKimos,
    ua,
    hints,
    nativo,
    plataforma: adivinarPlataforma(ua, hints, nativo),
    pantalla: scr ? {
      w: Math.min(scr.width || 0, scr.height || 0),
      h: Math.max(scr.width || 0, scr.height || 0),
      dpr: G.devicePixelRatio || 1,
    } : null,
    xr,
    camaras,
    webgpu,
    gpu: detectarGPU(doc),
    wasmSimd: detectarWasmSimd(G),
    memoriaGB: (nav && nav.deviceMemory) || null,
    nucleos: (nav && nav.hardwareConcurrency) || null,
    sensores: {
      imu: !!(G.DeviceMotionEvent || G.DeviceOrientationEvent),
      // iOS 13+ exige permiso explícito: presencia no es acceso.
      imuRequierePermiso: !!(G.DeviceMotionEvent && typeof G.DeviceMotionEvent.requestPermission === 'function'),
      gnss: !!(nav && nav.geolocation),
    },
    io: {
      archivos: typeof G.showSaveFilePicker === 'function',
      compartir: !!(nav && typeof nav.share === 'function'),
      almacenamiento: !!(nav && nav.storage && typeof nav.storage.estimate === 'function'),
    },
    instalada: !!(G.matchMedia && G.matchMedia('(display-mode: standalone)').matches),
    touch: (nav && nav.maxTouchPoints) || 0,
  };
  return evid;
}

/** Plataforma a partir de lo más fiable que haya llegado. */
function adivinarPlataforma(ua, hints, nativo) {
  if (nativo && nativo.plataforma) return nativo.plataforma;
  const p = (hints && hints.plataforma) || '';
  if (/android/i.test(p)) return 'android';
  if (/^ios$/i.test(p)) return 'ios';
  if (/xr/i.test(ua) || /OculusBrowser|Quest/i.test(ua)) return 'android-xr';
  if (/visionOS/i.test(ua)) return 'visionos';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS se presenta como Mac: se distingue por el táctil.
  if (/Macintosh/i.test(ua) && /Mobile|Touch/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Mac OS X|Windows|Linux|CrOS/i.test(ua)) return 'desktop';
  if (/SmartTV|Tizen|Web0S|AppleTV/i.test(ua)) return 'tv';
  if (/Watch/i.test(ua)) return 'wearable';
  return 'desconocida';
}

/* ===== src/core/resolve.js ===== */
/**
 * resolve.js — de la evidencia cruda al mapa de capacidades utilizables.
 *
 * Aquí vive la distinción que sostiene todo el proyecto:
 *
 *   capacidad del EQUIPO   ≠   capacidad USABLE AHORA
 *
 * Un iPhone 17 Pro tiene LiDAR siempre; en el navegador de ese mismo teléfono,
 * hoy, no hay forma de leerlo. Decir "tienes LiDAR" y luego no poder medir es
 * exactamente la mentira que este módulo evita: el LiDAR queda en `potenciales`
 * con la razón ("hace falta la app nativa") en vez de en `caps`.
 */


/** Qué entorno hace falta para que un API sea alcanzable. */
const RUNTIME_DE_API = [
  { prefijo: 'api.arkit.', runtime: 'runtime.native.ios', razon: 'ARKit solo existe dentro de una app nativa de iOS/iPadOS.' },
  { prefijo: 'api.arcore.', runtime: 'runtime.native.android', razon: 'ARCore solo existe dentro de una app nativa de Android.' },
];

/** APIs capaces de entregar profundidad al código de la app. */
const APIS_DE_PROFUNDIDAD = [
  'api.arkit.scenedepth', 'api.arkit.mesh', 'api.arkit.roomplan', 'api.arkit.objectcapture',
  'api.arcore.depth', 'api.arcore.rawdepth', 'api.webxr.depth',
];

const SENSORES_PROFUNDIDAD = ['depth.dtof', 'depth.itof', 'depth.structured', 'depth.stereo', 'depth.motion'];

/** Coincidencia por prefijo: 'SM-S928B' cae en el perfil que declara 'SM-S928'. */
function coincideModelo(modelo, lista) {
  if (!modelo || !Array.isArray(lista)) return false;
  const m = String(modelo).trim().toLowerCase();
  return lista.some((x) => {
    const p = String(x).trim().toLowerCase();
    return m === p || m.indexOf(p) === 0;
  });
}

/** Candidatos de iOS por tamaño de ventana: Safari no dice el modelo. */
function candidatosPorPantalla(evid, db) {
  const pistas = ((db.identificacion || {}).ios || {}).pistas || [];
  const p = evid.pantalla;
  if (!p) return [];
  const out = [];
  for (const pista of pistas) {
    const calza = (pista.css || []).some(([w, h]) => Math.abs(w - p.w) <= 2 && Math.abs(h - p.h) <= 2);
    if (calza) out.push(pista.equipo);
  }
  return out;
}

/**
 * Identifica el equipo. Devuelve siempre algo usable, y siempre dice con qué
 * confianza: 'declarada' (el sistema lo dijo), 'inferida' (calzó el catálogo),
 * 'supuesta' (perfil genérico por familia).
 */
function identificar(evid, db, opciones) {
  const op = opciones || {};
  const equipos = db.equipos;
  const porId = (id) => equipos.filter((e) => e.id === id)[0] || null;
  const razones = [];

  // 1. Lo que confirmó el usuario manda sobre cualquier heurística.
  if (op.equipoConfirmado) {
    const e = porId(op.equipoConfirmado);
    if (e) return { equipo: e, fuente: FUENTES.declarada.id, candidatos: [], razones: ['Modelo confirmado por el usuario.'] };
  }

  // 2. Modelo exacto informado por el contenedor nativo.
  const modeloNativo = evid.nativo && evid.nativo.modelo;
  if (modeloNativo) {
    const e = equipos.filter((x) => coincideModelo(modeloNativo, x.modelos)).sort((a, b) => (b.modelos || []).length - (a.modelos || []).length)[0];
    if (e) return { equipo: e, fuente: FUENTES.declarada.id, candidatos: [], razones: ['Modelo ' + modeloNativo + ' informado por la app nativa.'] };
    razones.push('La app nativa informó "' + modeloNativo + '", que no está en el catálogo todavía.');
  }

  // 3. Modelo por Client Hints (Android).
  const modeloHint = evid.hints && evid.hints.modelo;
  if (modeloHint) {
    const e = equipos.filter((x) => coincideModelo(modeloHint, x.modelos))[0];
    if (e) return { equipo: e, fuente: FUENTES.inferida.id, candidatos: [], razones: ['Modelo ' + modeloHint + ' reconocido en el catálogo.'] };
    razones.push('El navegador informó "' + modeloHint + '", que no está en el catálogo: se usa el perfil general de la plataforma.');
  }

  // 4. iOS: no hay modelo. Se ofrecen candidatos y se pide confirmación.
  if (evid.plataforma === 'ios') {
    const cands = candidatosPorPantalla(evid, db);
    const generico = porId('apple.iphone.estandar');
    razones.push('Safari no expone el modelo del equipo: no se puede afirmar si tiene LiDAR sin preguntar.');
    if (cands.length) {
      razones.push('Por tamaño de pantalla podría ser: ' + cands.join(', ') + '.');
      return { equipo: generico, fuente: FUENTES.supuesta.id, candidatos: cands, razones, requiereConfirmacion: true };
    }
    return { equipo: generico, fuente: FUENTES.supuesta.id, candidatos: equipos.filter((e) => e.plataforma === 'ios').map((e) => e.id), razones, requiereConfirmacion: true };
  }

  // 5. Perfiles genéricos por plataforma y señales de entorno.
  const esVisor = evid.plataforma === 'android-xr' || evid.plataforma === 'visionos' || (evid.xr && evid.xr.ar && /Quest|OculusBrowser|XR/i.test(evid.ua || ''));
  const mapa = {
    'visionos': 'apple.visionpro',
    'android-xr': /Quest|Oculus/i.test(evid.ua || '') ? 'meta.quest3' : 'android.xr.visores',
    'android': (evid.xr && evid.xr.ar) ? 'android.arcore.generico' : 'android.sinarcore',
    'desktop': 'pc.escritorio',
    'tv': 'tv.totem',
    'wearable': 'reloj.wearable',
  };
  const id = esVisor ? (mapa[evid.plataforma] || 'android.xr.visores') : (mapa[evid.plataforma] || 'pc.escritorio');
  const e = porId(id) || porId('pc.escritorio');
  razones.push('Perfil general para "' + evid.plataforma + '"' + (evid.xr && evid.xr.ar ? ' con sesión AR disponible' : '') + '.');
  return { equipo: e, fuente: FUENTES.supuesta.id, candidatos: [], razones };
}

/** Añade una capacidad si mejora la fuente ya registrada. */
function poner(mapa, id, fuente, nota) {
  const previo = mapa.get(id);
  if (previo && FUENTES[previo.fuente].peso >= FUENTES[fuente].peso) return;
  mapa.set(id, { id, fuente, nota: nota || (previo && previo.nota) || null });
}

/**
 * Resuelve capacidades activas y potenciales.
 *
 * @param evid  evidencia de detect.js
 * @param equipo entrada del catálogo (puede ser null)
 * @param xrProbe resultado de probarSesionXR(), si la app llegó a pedirlo
 * @returns { caps, potenciales, runtimes, notas }
 */
function resolver(evid, equipo, xrProbe) {
  const caps = new Map();
  const potenciales = new Map();
  const notas = [];

  /* --- entorno de ejecución: es lo que abre o cierra todo lo demás --- */
  const runtimes = new Set();
  if (evid.runtime === 'nativo' && evid.nativo) {
    if (/ios|visionos/i.test(evid.nativo.plataforma || '')) runtimes.add('runtime.native.ios');
    if (/android/i.test(evid.nativo.plataforma || '')) runtimes.add('runtime.native.android');
  }
  if (evid.runtime === 'web') runtimes.add('runtime.web');
  if (evid.enShellKimos) runtimes.add('runtime.kimos.shell');
  if (equipo && equipo.caps.indexOf('runtime.headset') >= 0) runtimes.add('runtime.headset');
  runtimes.forEach((r) => poner(caps, r, FUENTES.medida.id));

  /* --- lo medido en caliente: la fuente más fiable que existe --- */
  if (evid.camaras && evid.camaras.disponible) poner(caps, 'media.camera', FUENTES.medida.id, evid.camaras.n + ' cámara(s) visibles');
  if (evid.camaras && evid.camaras.n >= 2) poner(caps, 'media.multicam', FUENTES.medida.id);
  if (evid.sensores && evid.sensores.imu) {
    poner(caps, 'sensor.imu', FUENTES.medida.id,
      evid.sensores.imuRequierePermiso ? 'Requiere permiso explícito de movimiento (iOS).' : null);
  }
  if (evid.sensores && evid.sensores.gnss) poner(caps, 'sensor.gnss', FUENTES.medida.id);
  if (evid.webgpu && evid.webgpu.disponible) poner(caps, 'compute.webgpu', FUENTES.medida.id, evid.webgpu.adaptador);
  if (evid.wasmSimd) poner(caps, 'compute.wasm.simd', FUENTES.medida.id);
  if (evid.io && evid.io.archivos) poner(caps, 'io.filesystem', FUENTES.medida.id);
  if (evid.io && evid.io.compartir) poner(caps, 'io.share', FUENTES.medida.id);
  if (evid.xr && evid.xr.ar) poner(caps, 'api.webxr.ar', FUENTES.medida.id);

  if (xrProbe && xrProbe.modulos) {
    const m = xrProbe.modulos;
    if (m.depth) poner(caps, 'api.webxr.depth', FUENTES.medida.id, 'Sesión XR con depth-sensing activo.');
    if (m.hitTest) poner(caps, 'api.webxr.hittest', FUENTES.medida.id);
    if (m.anchors) poner(caps, 'api.webxr.anchors', FUENTES.medida.id);
    if (m.mallas || m.planes) poner(caps, 'api.webxr.mesh', FUENTES.medida.id);
    notas.push('Los módulos de WebXR se probaron abriendo una sesión real.');
  } else if (evid.xr && evid.xr.ar) {
    notas.push('Hay sesión AR disponible, pero no se han probado sus módulos: pulsa "Probar sesión AR" para medir profundidad y hit-test.');
  }

  /* --- lo declarado por el contenedor nativo --- */
  if (evid.nativo && evid.nativo.caps) {
    evid.nativo.caps.forEach((c) => poner(caps, c, FUENTES.declarada.id, 'Confirmado por la app nativa.'));
  }

  /* --- lo que aporta el catálogo del equipo (inferido) --- */
  const delCatalogo = (equipo && equipo.caps) || [];
  const confianzaCatalogo = equipo && equipo.confianza === 'verificado' ? FUENTES.inferida.id : FUENTES.supuesta.id;
  for (const c of delCatalogo) {
    const bloqueo = RUNTIME_DE_API.filter((r) => c.indexOf(r.prefijo) === 0)[0];
    if (bloqueo && !runtimes.has(bloqueo.runtime)) {
      if (!caps.has(c)) potenciales.set(c, { id: c, requiere: bloqueo.runtime, razon: bloqueo.razon });
      continue;
    }
    if (c.indexOf('api.webxr.') === 0 && !(evid.xr && evid.xr.ar)) {
      if (!caps.has(c)) potenciales.set(c, { id: c, requiere: 'api.webxr.ar', razon: 'Este navegador no ofrece sesión AR; el mismo equipo sí puede en otro navegador o en la app nativa.' });
      continue;
    }
    if (c.indexOf('runtime.') === 0 && !runtimes.has(c)) {
      potenciales.set(c, { id: c, requiere: c, razon: 'Entorno no activo ahora mismo.' });
      continue;
    }
    poner(caps, c, confianzaCatalogo, equipo ? ('Del catálogo: ' + equipo.nombre) : null);
  }

  /* --- el filtro clave: un sensor sin API que lo lea no sirve de nada --- */
  const hayApiProfundidad = APIS_DE_PROFUNDIDAD.some((a) => caps.has(a));
  if (!hayApiProfundidad) {
    for (const s of SENSORES_PROFUNDIDAD) {
      if (caps.has(s)) {
        const info = caps.get(s);
        caps.delete(s);
        potenciales.set(s, {
          id: s,
          requiere: runtimes.has('runtime.web') ? 'runtime.native.ios/android o WebXR con depth-sensing' : 'un API de profundidad',
          razon: 'El equipo lo tiene, pero en este entorno ningún API lo expone: no se puede medir con él ahora.',
          fuentePrevia: info.fuente,
        });
      }
    }
    if (potenciales.size) notas.push('Hay sensores de profundidad en el equipo que este entorno no deja usar. La app nativa los abre.');
  }

  return { caps, potenciales, runtimes, notas };
}

/* ===== src/core/diagnose.js ===== */
/**
 * diagnose.js — el veredicto: qué puede hacer ESTE equipo, módulo por módulo.
 *
 * Cuatro estados y ninguno ambiguo:
 *
 *   completo      el módulo hace todo lo que promete, con la precisión buena.
 *   degradado     funciona, pero con menos precisión o más pasos manuales.
 *                 La app tiene que decir en qué se nota, no esconderlo.
 *   potencial     el equipo podría, pero este entorno no: falta la app nativa,
 *                 otro navegador o un permiso. Siempre con la acción concreta.
 *   visor         no captura; sirve para abrir, revisar y exportar lo de otros.
 *   no-disponible ni eso.
 *
 * El grado (0-100) ordena la lista y alimenta el resumen; los estados mandan.
 */


const ESTADOS = {
  completo: { id: 'completo', label: 'Completo', orden: 0, icon: '✅' },
  degradado: { id: 'degradado', label: 'Degradado', orden: 1, icon: '🟡' },
  potencial: { id: 'potencial', label: 'Al alcance', orden: 2, icon: '🔓' },
  visor: { id: 'visor', label: 'Solo lectura', orden: 3, icon: '👁️' },
  'no-disponible': { id: 'no-disponible', label: 'No disponible', orden: 4, icon: '⛔' },
};


const nombreCap = (id) => (CAP_POR_ID.get(id) || {}).corto || (CAP_POR_ID.get(id) || {}).label || id;

/** ¿Se cumplen los requisitos duros con este conjunto? */
function cumple(mod, tiene) {
  const faltan = (mod.requiere || []).filter((c) => !tiene(c));
  const gruposSinCubrir = (mod.requiereAlguna || [])
    .filter((grupo) => !grupo.some((c) => tiene(c)))
    .map((grupo) => grupo);
  return { ok: !faltan.length && !gruposSinCubrir.length, faltan, gruposSinCubrir };
}

/** Acción concreta para desbloquear lo que falta. Sin acción no hay diagnóstico útil. */
function accionPara(capId, potenciales, evid) {
  const p = potenciales.get(capId);
  if (p && p.requiere === 'runtime.native.ios') return 'Instala la app kimos-LiDARia para iOS: abre ARKit y el LiDAR de este mismo equipo.';
  if (p && p.requiere === 'runtime.native.android') return 'Instala la app kimos-LiDARia para Android: abre ARCore (profundidad, semántica y geoespacial).';
  if (p && p.requiere === 'api.webxr.ar') return 'Abre la app en un navegador con AR (Chrome en Android) o instala la app nativa.';
  if (p) return p.razon;
  if (capId === 'sensor.imu' && evid && evid.sensores && evid.sensores.imuRequierePermiso) return 'Concede el permiso de movimiento y orientación cuando la app lo pida.';
  if (capId === 'media.camera') return 'Concede el permiso de cámara.';
  if (capId.indexOf('depth.') === 0) return 'Este equipo no tiene ese sensor: usa un equipo de la lista de compatibles para capturar, y este para revisar.';
  return 'Requiere ' + nombreCap(capId) + ', que este equipo no ofrece.';
}

/** Precisión esperable del módulo con lo que hay activo. */
function precisionDe(caps) {
  const s = mejorSensor(caps);
  if (!s) return { sensor: null, label: 'sin medición métrica', a1m: null, a3m: null, nota: 'Sin sensor de profundidad activo no hay medida con escala fiable.' };
  return {
    sensor: s.id,
    label: PERFIL_SENSOR[s.id].label,
    a1m: errorEsperado(s.id, 1),
    a3m: errorEsperado(s.id, 3),
    rango: PERFIL_SENSOR[s.id].rango,
    oscuridad: PERFIL_SENSOR[s.id].oscuridad,
    nota: PERFIL_SENSOR[s.id].nota,
  };
}

/**
 * Diagnostica un módulo.
 * @param mod  entrada de modules.json
 * @param ctx  { caps:Map, potenciales:Map, evid }
 */
function diagnosticarModulo(mod, ctx) {
  const { caps, potenciales, evid } = ctx;
  const tiene = (c) => caps.has(c);
  const tieneOPodria = (c) => caps.has(c) || potenciales.has(c);

  const ahora = cumple(mod, tiene);
  const conPotencial = cumple(mod, tieneOPodria);

  const prefiere = mod.prefiere || [];
  const preferidasOk = prefiere.filter((c) => tiene(c));
  const ratioPref = prefiere.length ? preferidasOk.length / prefiere.length : 1;

  const precision = precisionDe(caps);

  let estado;
  if (ahora.ok) estado = ratioPref >= 0.5 ? 'completo' : 'degradado';
  else if (conPotencial.ok) estado = 'potencial';
  else if (mod.sinSoporte) estado = 'visor';
  else estado = 'no-disponible';

  // El grado combina lo duro (60), lo preferido (25) y la calidad del sensor (15).
  const duro = ahora.ok ? 1 : (conPotencial.ok ? 0.45 : 0);
  const calidadSensor = precision.sensor
    ? ({ 'depth.dtof': 1, 'depth.structured': 0.9, 'depth.itof': 0.7, 'depth.stereo': 0.5, 'depth.motion': 0.35 }[precision.sensor] || 0.3)
    : 0;
  const grado = Math.round(60 * duro + 25 * ratioPref + 15 * calidadSensor);

  const faltan = ahora.faltan.concat(ahora.gruposSinCubrir.map((g) => g[0]));
  const acciones = [];
  const vistos = new Set();
  for (const c of faltan) {
    const a = accionPara(c, potenciales, evid);
    if (!vistos.has(a)) { vistos.add(a); acciones.push(a); }
  }
  if (estado === 'degradado') {
    const faltanPref = prefiere.filter((c) => !tiene(c));
    for (const c of faltanPref.slice(0, 2)) {
      const a = accionPara(c, potenciales, evid);
      if (!vistos.has(a)) { vistos.add(a); acciones.push(a); }
    }
  }

  return {
    id: mod.id,
    nombre: mod.nombre,
    icon: mod.icon,
    fase: mod.fase,
    resumen: mod.resumen,
    estado,
    estadoLabel: ESTADOS[estado].label,
    estadoIcon: ESTADOS[estado].icon,
    grado,
    modo: estado === 'completo' ? mod.resumen
      : estado === 'degradado' ? mod.degradado
      : estado === 'potencial' ? mod.degradado
      : estado === 'visor' ? mod.sinSoporte
      : 'No hay forma de ejecutar este módulo en este equipo.',
    faltan: faltan.map((c) => ({ id: c, label: nombreCap(c), potencial: potenciales.has(c) })),
    usa: (mod.requiere || []).concat([].concat(...(mod.requiereAlguna || []))).filter((c) => caps.has(c)).map((c) => ({ id: c, label: nombreCap(c), fuente: caps.get(c).fuente })),
    acciones,
    precision,
    salidas: mod.salidas || [],
    kimos: mod.kimos || [],
  };
}

/** Nivel del equipo en una palabra, para el encabezado del informe. */
function nivelDeEquipo(caps, potenciales) {
  const s = mejorSensor(caps);
  if (s && (s.id === 'depth.dtof' || s.id === 'depth.itof')) return { id: 'captura-metrica', label: 'Captura métrica', desc: 'Mide con escala real: es un equipo de levantamiento.' };
  if (s) return { id: 'captura-basica', label: 'Captura asistida', desc: 'Captura y mide con más error: sirve para presupuestar y para AR.' };
  const podria = ['depth.dtof', 'depth.itof', 'depth.structured'].some((c) => potenciales.has(c));
  if (podria) return { id: 'bloqueado', label: 'Capaz, pero bloqueado', desc: 'El equipo tiene el sensor; este entorno no lo deja usar. Con la app nativa sube a captura métrica.' };
  if (caps.has('media.camera')) return { id: 'visor-camara', label: 'Cámara sin profundidad', desc: 'Sirve para AR de visualización y fotogrametría por fotos.' };
  return { id: 'consola', label: 'Consola', desc: 'Sin captura: es el puesto para revisar, medir sobre el modelo, exportar y gestionar.' };
}

/**
 * Informe completo. Es lo que consume la PWA, la app de KIMOS y el agente IA.
 */
function diagnosticar(ctx, catalogo) {
  const { caps, potenciales, evid, equipo, identificacion } = ctx;
  const modulos = (catalogo.modulos || []).map((m) => diagnosticarModulo(m, ctx));
  modulos.sort((a, b) => (ESTADOS[a.estado].orden - ESTADOS[b.estado].orden) || (b.grado - a.grado) || (a.fase - b.fase));

  const cuenta = (e) => modulos.filter((m) => m.estado === e).length;
  const nivel = nivelDeEquipo(caps, potenciales);

  const avisos = [];
  if (identificacion && identificacion.requiereConfirmacion) {
    avisos.push('No se puede saber el modelo exacto desde el navegador: confirma tu equipo para afinar el diagnóstico.');
  }
  if (potenciales.size && nivel.id === 'bloqueado') {
    avisos.push('Hay ' + potenciales.size + ' capacidad(es) del equipo que este entorno no expone.');
  }
  if (evid && evid.runtime === 'web' && evid.plataforma === 'ios') {
    avisos.push('En iOS el navegador no da acceso a LiDAR ni a ARKit: la captura métrica exige la app nativa.');
  }

  return {
    generado: new Date().toISOString(),
    equipo: equipo ? { id: equipo.id, nombre: equipo.nombre, marca: equipo.marca, clase: equipo.clase, confianza: equipo.confianza } : null,
    identificacion: identificacion ? { fuente: identificacion.fuente, razones: identificacion.razones, candidatos: identificacion.candidatos, requiereConfirmacion: !!identificacion.requiereConfirmacion } : null,
    nivel,
    precision: precisionDe(caps),
    resumen: {
      completos: cuenta('completo'),
      degradados: cuenta('degradado'),
      potenciales: cuenta('potencial'),
      visor: cuenta('visor'),
      noDisponibles: cuenta('no-disponible'),
      total: modulos.length,
    },
    avisos,
    capacidades: [...caps.values()],
    bloqueadas: [...potenciales.values()],
    modulos,
  };
}

/* ===== src/core/negocio.js ===== */
/**
 * negocio.js — el modelo económico de los módulos, recalculable en vivo.
 *
 * No es un informe: es la calculadora. Todos los supuestos entran por parámetro
 * y se pueden mover; lo que sale (ingreso, margen, payback, prioridad) se
 * recalcula entero. Así una discusión sobre si conviene construir un módulo se
 * resuelve moviendo el supuesto que se discute, en vez de rehacer la planilla.
 *
 * Advertencia que la app repite en pantalla: los valores por defecto son
 * ESTIMACIONES de partida, no ventas medidas. Sirven para ordenar prioridades.
 */

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

const SUPUESTOS_BASE = {
  clientesKimos: 120,       // cuentas activas de KIMOS en el horizonte del plan
  usuariosPorCuenta: 6,     // usuarios de campo por cuenta (para precios por usuario)
  costoSemanaUSD: 2200,     // costo cargado de una semana-persona
  churnMensual: 0.02,
  margenObjetivo: 0.75,
  // Soporte, infraestructura compartida y cobranza. Sin esto el margen sale
  // por encima del 90%, que es lo que pasa cuando solo se cuenta el cómputo.
  costoOperacionPct: 0.18,
  horizonteMeses: 36,
};

/**
 * Economía de un módulo con un juego de supuestos.
 * Devuelve importes mensuales y anuales por cuenta y para toda la cartera.
 */
function economiaModulo(mod, supuestos) {
  const s = Object.assign({}, SUPUESTOS_BASE, supuestos || {});
  const n = mod.negocio || {};
  const porUsuario = n.modelo === 'por-usuario';
  const usuarios = porUsuario ? Math.max(1, num(s.usuariosPorCuenta, 6)) : 1;

  const cuentas = Math.round(num(s.clientesKimos, 0) * num(n.adopcion, 0));
  const precioCuenta = num(n.precioMensualUSD, 0) * usuarios;
  const costoCuenta = num(n.costoVariableUSD, 0) * usuarios;

  const ingresoMes = cuentas * precioCuenta;
  const costoMes = cuentas * costoCuenta + ingresoMes * num(s.costoOperacionPct, 0);
  const contribucionMes = ingresoMes - costoMes;
  const margen = ingresoMes > 0 ? contribucionMes / ingresoMes : 0;

  const inversion = num(n.esfuerzoSemanas, 0) * num(s.costoSemanaUSD, 0);
  const paybackMeses = contribucionMes > 0 ? inversion / contribucionMes : Infinity;

  // Retorno del primer año por dólar invertido: la vara para ordenar el plan.
  const retornoAno1 = inversion > 0 ? (contribucionMes * 12) / inversion : 0;

  // Múltiplo de valor: cuánto se lleva el cliente por cada dólar que paga.
  // `valorClienteUSD` es beneficio mensual POR CUENTA (no por usuario).
  // Por debajo de 3 cuesta vender; por encima de 10, o el precio es bajo o la
  // estimación de valor es optimista. Ambos casos hay que mirarlos.
  const multiploValor = precioCuenta > 0 ? num(n.valorClienteUSD, 0) / precioCuenta : 0;

  const vidaMeses = num(s.churnMensual, 0) > 0 ? 1 / s.churnMensual : num(s.horizonteMeses, 36);
  const ltvCuenta = (precioCuenta - costoCuenta) * vidaMeses;

  return {
    id: mod.id,
    nombre: mod.nombre,
    fase: mod.fase,
    modelo: n.modelo || 'incluido',
    cuentas,
    precioCuenta,
    ingresoMes,
    costoMes,
    contribucionMes,
    arr: contribucionMes * 12,
    margen,
    inversion,
    paybackMeses,
    retornoAno1,
    multiploValor,
    ltvCuenta,
    esfuerzoSemanas: num(n.esfuerzoSemanas, 0),
    veredicto: veredictoModulo({ margen, paybackMeses, retornoAno1, multiploValor, modelo: n.modelo }),
  };
}

/** Traduce los números a una recomendación en una línea. */
function veredictoModulo(m) {
  if (m.modelo === 'incluido') return { nivel: 'base', texto: 'No factura por sí solo: es lo que hace vendibles a los demás.' };
  if (!isFinite(m.paybackMeses)) return { nivel: 'malo', texto: 'No cubre su costo variable: hay que subir precio o bajar costo de proceso.' };
  if (m.paybackMeses <= 12 && m.margen >= 0.7) return { nivel: 'bueno', texto: 'Se paga en menos de un año con buen margen: construir temprano.' };
  if (m.paybackMeses <= 24) return { nivel: 'medio', texto: 'Retorno razonable: construir cuando el módulo del que depende ya esté vendiendo.' };
  return { nivel: 'malo', texto: 'Payback largo para el tamaño de cartera supuesto: solo con un cliente ancla que lo pague.' };
}

/** Cartera completa, ordenada por retorno del primer año. */
function economiaCartera(catalogo, supuestos) {
  const s = Object.assign({}, SUPUESTOS_BASE, supuestos || {});
  const filas = (catalogo.modulos || []).map((m) => economiaModulo(m, s));
  const total = filas.reduce((a, f) => ({
    ingresoMes: a.ingresoMes + f.ingresoMes,
    costoMes: a.costoMes + f.costoMes,
    contribucionMes: a.contribucionMes + f.contribucionMes,
    inversion: a.inversion + f.inversion,
    esfuerzoSemanas: a.esfuerzoSemanas + f.esfuerzoSemanas,
  }), { ingresoMes: 0, costoMes: 0, contribucionMes: 0, inversion: 0, esfuerzoSemanas: 0 });

  total.arr = total.contribucionMes * 12;
  total.margen = total.ingresoMes > 0 ? total.contribucionMes / total.ingresoMes : 0;
  total.paybackMeses = total.contribucionMes > 0 ? total.inversion / total.contribucionMes : Infinity;

  const porFase = {};
  for (const f of filas) {
    const k = 'fase' + f.fase;
    porFase[k] = porFase[k] || { fase: f.fase, modulos: 0, inversion: 0, contribucionMes: 0, esfuerzoSemanas: 0 };
    porFase[k].modulos += 1;
    porFase[k].inversion += f.inversion;
    porFase[k].contribucionMes += f.contribucionMes;
    porFase[k].esfuerzoSemanas += f.esfuerzoSemanas;
  }
  for (const k of Object.keys(porFase)) {
    const p = porFase[k];
    p.paybackMeses = p.contribucionMes > 0 ? p.inversion / p.contribucionMes : Infinity;
    p.arr = p.contribucionMes * 12;
  }

  return {
    supuestos: s,
    filas: filas.slice().sort((a, b) => b.retornoAno1 - a.retornoAno1),
    total,
    porFase: Object.values(porFase).sort((a, b) => a.fase - b.fase),
  };
}

/**
 * Punto de equilibrio: cuántas cuentas hacen falta para pagar la inversión de
 * un módulo en `meses`. Responde la pregunta que siempre aparece: "¿y cuántos
 * clientes necesito para que esto no sea una pérdida?".
 */
function cuentasParaEquilibrio(mod, supuestos, meses) {
  const s = Object.assign({}, SUPUESTOS_BASE, supuestos || {});
  const n = mod.negocio || {};
  const usuarios = n.modelo === 'por-usuario' ? Math.max(1, num(s.usuariosPorCuenta, 6)) : 1;
  const precio = num(n.precioMensualUSD, 0) * usuarios;
  const contribucionPorCuenta = precio - num(n.costoVariableUSD, 0) * usuarios - precio * num(s.costoOperacionPct, 0);
  if (contribucionPorCuenta <= 0) return Infinity;
  const inversion = num(n.esfuerzoSemanas, 0) * num(s.costoSemanaUSD, 0);
  return Math.ceil(inversion / (contribucionPorCuenta * Math.max(1, num(meses, 12))));
}

/* ===== src/core/licencias.js ===== */
/**
 * licencias.js — la política de licencias, ejecutable.
 *
 * Escribir la política en un documento no evita que entre una AGPL por una
 * dependencia transitiva a las dos de la mañana. Esto la convierte en una
 * función que se puede llamar desde CI y desde la propia app.
 *
 * Criterio de fondo: kimos-LiDARia se distribuye como producto propietario
 * (app en tiendas + bundle dentro de KIMOS). Todo lo que obligue a publicar el
 * código que la enlaza, o a liberar el servicio en red, queda fuera. Todo lo
 * que restrinja el uso comercial, también.
 */

/** Normaliza identificadores: 'Apache 2.0', 'apache-2.0', 'Apache-2.0-only' → 'APACHE-2.0'. */
function normalizar(id) {
  if (!id) return '';
  let s = String(id).trim().toUpperCase().replace(/\s+/g, '-');
  s = s.replace(/-ONLY$/, '').replace(/-OR-LATER$/, '').replace(/\+$/, '');
  const alias = {
    'APACHE-2': 'APACHE-2.0', 'APACHE2': 'APACHE-2.0', 'APACHE-LICENSE-2.0': 'APACHE-2.0',
    'BSD': 'BSD-3-CLAUSE', 'BSD-3': 'BSD-3-CLAUSE', 'BSD-2': 'BSD-2-CLAUSE',
    'NEW-BSD': 'BSD-3-CLAUSE', 'SIMPLIFIED-BSD': 'BSD-2-CLAUSE',
    'GPLV2': 'GPL-2.0', 'GPLV3': 'GPL-3.0', 'AGPLV3': 'AGPL-3.0', 'LGPLV3': 'LGPL-3.0', 'LGPLV2.1': 'LGPL-2.1',
    'CC-BY': 'CC-BY-4.0', 'CC-BY-NC-4.0': 'CC-BY-NC', 'CC-BY-NC-SA-4.0': 'CC-BY-NC',
    'BOOST-1.0': 'BSL-1.0', 'BSL': 'BUSL-1.1',
    'UNLICENSED': 'SIN-LICENCIA', 'NONE': 'SIN-LICENCIA', 'UNKNOWN': 'SIN-LICENCIA', '': 'SIN-LICENCIA',
  };
  return alias[s] || s;
}

/**
 * Evalúa una licencia (acepta expresiones tipo 'MIT OR Apache-2.0' y
 'MIT AND GPL-3.0'). En un OR gana la mejor opción, porque se puede elegir;
 * en un AND manda la peor, porque hay que cumplirlas todas.
 */
function evaluar(expresion, politica) {
  const P = politica;
  const permitidas = new Set(P.politica.permitidas.map((x) => normalizar(x.id)));
  const condicionales = new Map(P.politica.condicionales.map((x) => [normalizar(x.id), x]));
  const prohibidas = new Map(P.politica.prohibidas.map((x) => [normalizar(x.id), x]));

  const uno = (id) => {
    // Sin identificador no hay permiso: por defecto son todos los derechos
    // reservados, así que se trata igual que un LICENSE ausente.
    const n = normalizar(id) || 'SIN-LICENCIA';
    if (permitidas.has(n)) return { id: n, veredicto: 'permitida', rango: 0, nota: (P.politica.permitidas.filter((x) => normalizar(x.id) === n)[0] || {}).nota || null };
    if (condicionales.has(n)) return { id: n, veredicto: 'condicional', rango: 1, nota: condicionales.get(n).condicion };
    if (prohibidas.has(n)) return { id: n, veredicto: 'prohibida', rango: 2, nota: prohibidas.get(n).razon };
    // Heurística para lo que no está en la tabla: si huele a copyleft fuerte o
    // a "no comercial", se trata como prohibida hasta que alguien la revise.
    if (/AGPL|SSPL|BUSL|COMMONS-CLAUSE|NON-?COMMERCIAL|NC\b|RESEARCH/.test(n)) {
      return { id: n, veredicto: 'prohibida', rango: 2, nota: 'No está en la tabla, pero el identificador indica copyleft de red o uso no comercial.' };
    }
    if (/^GPL/.test(n)) return { id: n, veredicto: 'prohibida', rango: 2, nota: 'Copyleft fuerte.' };
    return { id: n, veredicto: 'desconocida', rango: 1.5, nota: 'Sin evaluar: requiere revisión antes de entrar al producto.' };
  };

  const texto = String(expresion || '').trim();
  if (/\bOR\b/i.test(texto)) {
    const partes = texto.split(/\s+OR\s+/i).map(uno);
    const mejor = partes.slice().sort((a, b) => a.rango - b.rango)[0];
    return Object.assign({}, mejor, { expresion: texto, alternativas: partes.map((p) => p.id) });
  }
  if (/\bAND\b/i.test(texto)) {
    const partes = texto.split(/\s+AND\s+/i).map(uno);
    const peor = partes.slice().sort((a, b) => b.rango - a.rango)[0];
    return Object.assign({}, peor, { expresion: texto, componentes: partes.map((p) => p.id) });
  }
  return Object.assign({}, uno(texto), { expresion: texto });
}

/**
 * Audita una lista de dependencias `[{ nombre, licencia, uso }]`.
 * Devuelve `{ ok, resumen, hallazgos }`; `ok` es falso si hay prohibidas o
 * desconocidas: lo que no se pudo clasificar no se despliega.
 */
function auditar(dependencias, politica) {
  const hallazgos = (dependencias || []).map((d) => {
    const ev = evaluar(d.licencia, politica);
    return {
      nombre: d.nombre, uso: d.uso || null, licencia: d.licencia,
      veredicto: ev.veredicto, nota: ev.nota,
      bloquea: ev.veredicto === 'prohibida' || ev.veredicto === 'desconocida',
    };
  });
  const cuenta = (v) => hallazgos.filter((h) => h.veredicto === v).length;
  return {
    ok: !hallazgos.some((h) => h.bloquea),
    resumen: {
      total: hallazgos.length,
      permitidas: cuenta('permitida'),
      condicionales: cuenta('condicional'),
      prohibidas: cuenta('prohibida'),
      desconocidas: cuenta('desconocida'),
    },
    hallazgos,
  };
}

/** Alternativa permisiva sugerida para una biblioteca vetada. */
function alternativaPara(nombre, politica) {
  const b = (politica.bibliotecas || []).filter((x) => x.nombre.toLowerCase().indexOf(String(nombre).toLowerCase()) >= 0)[0];
  if (!b) return null;
  const m = /Alternativa[^:]*:\s*([^.]+)\./.exec(b.nota || '');
  return m ? m[1].trim() : null;
}


/**
 * LiDARia — consola de captura 3D de KIMOS.
 *
 * Esta app corre en el escritorio de KIMOS, que es justo donde NO hay LiDAR.
 * Por eso no intenta escanear: hace lo que el escritorio hace bien —decidir—.
 * Responde cuatro preguntas que hoy nadie en la organización puede responder:
 *
 *   1. ¿Qué puede capturar cada equipo que ya tenemos?
 *   2. ¿Qué módulos quedan cubiertos con ese parque, y cuáles no?
 *   3. ¿Cuánto cuesta construir cada módulo y en cuánto se paga?
 *   4. ¿Qué bibliotecas pueden entrar al producto sin problema legal?
 *
 * El motor es el mismo núcleo que corre en el teléfono (repo kimos-LiDARia):
 * `build.mjs` lo incrusta encima de este archivo, así que aquí se usan sus
 * funciones directamente (identificar, resolver, diagnosticar, economiaCartera,
 * auditar) sin importar nada en tiempo de ejecución.
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.0.0';

const DATOS = {"generado":"2026-08-25T17:09:14.740Z","nucleo":"1.0.0","origen":"kimos-LiDARia","devices":{"version":"1.0.0","actualizado":"2026-08-25","nota":"Catálogo de equipos. `caps` son capacidades de HARDWARE del equipo: cuáles quedan activas depende también del entorno (navegador vs app nativa), y eso lo resuelve resolve.js. `confianza` marca lo verificado frente a lo que hay que confirmar antes de prometerlo a un cliente.","clases":[{"id":"movil","label":"Teléfono","icon":"📱"},{"id":"tablet","label":"Tablet","icon":"🧾"},{"id":"visor","label":"Visor de realidad mixta","icon":"🥽"},{"id":"pc","label":"Computador","icon":"🖥️"},{"id":"tv","label":"Smart TV / tótem","icon":"📺"},{"id":"reloj","label":"Reloj / wearable","icon":"⌚"},{"id":"campo","label":"Equipo de campo (dron, escáner, robot)","icon":"🛰️"}],"equipos":[{"id":"apple.iphone.pro.12-17","marca":"Apple","nombre":"iPhone 12 Pro → 17 Pro (y Pro Max)","clase":"movil","plataforma":"ios","anios":[2020,2025],"confianza":"verificado","modelos":["iPhone13,3","iPhone13,4","iPhone14,2","iPhone14,3","iPhone15,2","iPhone15,3","iPhone16,1","iPhone16,2","iPhone17,1","iPhone17,2","iPhone18,1","iPhone18,2"],"caps":["depth.dtof","depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.mesh","api.arkit.roomplan","api.arkit.objectcapture","api.arkit.body","api.viewer.usdz","media.camera","media.multicam","sensor.imu","sensor.gnss","compute.npu"],"nota":"El equipo de referencia del proyecto: LiDAR trasero, TrueDepth frontal y toda la pila ARKit. Toda gama Pro desde 2020; ningún iPhone estándar, Plus, Air, mini o SE lo lleva."},{"id":"apple.ipadpro.2020+","marca":"Apple","nombre":"iPad Pro 11\" (2ª gen) y 12.9\" (4ª gen) en adelante, incl. M4/M5","clase":"tablet","plataforma":"ios","anios":[2020,2025],"confianza":"verificado","modelos":["iPad8,9","iPad8,10","iPad8,11","iPad8,12","iPad13,4","iPad13,5","iPad13,6","iPad13,7","iPad13,8","iPad13,9","iPad13,10","iPad13,11","iPad14,3","iPad14,4","iPad14,5","iPad14,6","iPad16,3","iPad16,4","iPad16,5","iPad16,6"],"caps":["depth.dtof","depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.mesh","api.arkit.roomplan","api.arkit.objectcapture","api.arkit.body","api.viewer.usdz","media.camera","media.multicam","sensor.imu","compute.npu"],"nota":"Mismo stack que el iPhone Pro con más pantalla: es el equipo cómodo para escanear una vivienda completa y revisar el plano en el sitio. Ni iPad, ni iPad Air, ni iPad mini llevan LiDAR."},{"id":"apple.iphone.estandar","marca":"Apple","nombre":"iPhone X → 17 (estándar, Plus, Air, mini, SE 2ª/3ª gen)","clase":"movil","plataforma":"ios","anios":[2017,2025],"confianza":"verificado","modelos":[],"caps":["depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.body","api.viewer.usdz","media.camera","media.multicam","sensor.imu","sensor.gnss","compute.npu"],"nota":"Sin LiDAR: mide por movimiento y estéreo, y tiene TrueDepth frontal. Vale para AR, previsualización, fotogrametría y volumen aproximado; no para acotar un plano.","excepciones":{"depth.structured":"Solo modelos con Face ID (no el SE con Touch ID)."}},{"id":"apple.visionpro","marca":"Apple","nombre":"Apple Vision Pro","clase":"visor","plataforma":"visionos","anios":[2024,2026],"confianza":"verificado","caps":["depth.dtof","depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.mesh","api.viewer.usdz","api.webxr.ar","api.webxr.mesh","media.camera","sensor.imu","compute.npu","runtime.headset"],"nota":"LiDAR + estéreo + seguimiento de manos y mirada, y WebXR habilitado en Safari de visionOS 2: el único equipo donde la app corre inmersiva sin instalar nada."},{"id":"meta.quest3","marca":"Meta","nombre":"Meta Quest 3 / 3S","clase":"visor","plataforma":"android-xr","anios":[2023,2025],"confianza":"verificado","caps":["depth.dtof","depth.stereo","api.webxr.ar","api.webxr.depth","api.webxr.hittest","api.webxr.anchors","api.webxr.mesh","media.camera","sensor.imu","compute.webgpu","runtime.headset"],"nota":"Sensor de profundidad + passthrough a color y navegador con WebXR completo: es la plataforma donde la vía web llega más lejos sin app nativa."},{"id":"android.xr.visores","marca":"Android XR","nombre":"Visores Android XR (Galaxy XR y compatibles)","clase":"visor","plataforma":"android-xr","anios":[2025,2026],"confianza":"por-confirmar","caps":["depth.stereo","api.webxr.ar","api.webxr.depth","api.webxr.hittest","api.webxr.anchors","api.webxr.mesh","media.camera","sensor.imu","compute.webgpu","runtime.headset"],"nota":"Chrome de Android XR expone profundidad estereoscópica (dos mapas en vivo, uno por ojo). Confirmar módulo a módulo en el equipo concreto antes de comprometer funciones."},{"id":"samsung.tof.2019-2020","marca":"Samsung","nombre":"Galaxy S10 5G · Note10+ · S20+ · S20 Ultra","clase":"movil","plataforma":"android","anios":[2019,2020],"confianza":"verificado","modelos":["SM-G977","SM-N975","SM-N976","SM-G986","SM-G988"],"caps":["depth.itof","depth.stereo","depth.motion","api.arcore.depth","api.arcore.rawdepth","api.arcore.semantics","api.arcore.geospatial","api.viewer.glb","media.camera","media.multicam","sensor.imu","sensor.gnss"],"nota":"La generación Android con ToF trasero real. Samsung lo retiró desde la serie S21: los buques insignia posteriores traen autofoco láser, que no es un sensor de profundidad utilizable."},{"id":"samsung.flagship.reciente","marca":"Samsung","nombre":"Galaxy S21 → S25 (incl. Ultra) y Z Fold/Flip","clase":"movil","plataforma":"android","anios":[2021,2025],"confianza":"verificado","modelos":["SM-S91","SM-S92","SM-S93","SM-S94","SM-F94","SM-F95","SM-S921","SM-S926","SM-S928","SM-S931","SM-S936","SM-S938"],"caps":["depth.stereo","depth.motion","api.arcore.depth","api.arcore.rawdepth","api.arcore.semantics","api.arcore.geospatial","api.viewer.glb","media.camera","media.multicam","sensor.imu","sensor.gnss","compute.npu"],"nota":"Sin ToF dedicado: profundidad por movimiento vía ARCore, buena para AR, oclusión y volumen aproximado. Hay indicios de un módulo ToF en el S25 Ultra que NO damos por bueno hasta medirlo en un equipo real."},{"id":"huawei.tof","marca":"Huawei","nombre":"P30 Pro · Mate 30 Pro · P40 Pro · Mate 40 Pro","clase":"movil","plataforma":"android","anios":[2019,2020],"confianza":"verificado","caps":["depth.itof","depth.stereo","media.camera","media.multicam","sensor.imu","sensor.gnss"],"nota":"ToF trasero real, pero sin Servicios de Google en los modelos posteriores a 2019: ARCore no está disponible y hay que ir por HMS/AR Engine. Fuera del alcance de la fase 1."},{"id":"sony.xperia1.tof","marca":"Sony","nombre":"Xperia 1 II → 1 V","clase":"movil","plataforma":"android","anios":[2020,2023],"confianza":"por-confirmar","caps":["depth.itof","depth.stereo","depth.motion","api.arcore.depth","api.arcore.rawdepth","api.viewer.glb","media.camera","media.multicam","sensor.imu","sensor.gnss"],"nota":"Sensor 3D iToF trasero en la línea Xperia 1. Confirmar por modelo: Sony lo fue moviendo entre generaciones."},{"id":"honor.lg.tof","marca":"Honor / LG","nombre":"Honor View 20 · LG G8 ThinQ · LG V60","clase":"movil","plataforma":"android","anios":[2019,2020],"confianza":"por-confirmar","caps":["depth.itof","depth.motion","api.arcore.depth","api.viewer.glb","media.camera","sensor.imu"],"nota":"ToF de la primera oleada Android (en LG, frontal). Equipos fuera de soporte: solo interesan si el cliente ya los tiene en el bolsillo."},{"id":"android.arcore.generico","marca":"Android","nombre":"Android con ARCore (parque general)","clase":"movil","plataforma":"android","anios":[2018,2026],"confianza":"verificado","caps":["depth.motion","api.arcore.depth","api.arcore.rawdepth","api.arcore.semantics","api.arcore.geospatial","api.viewer.glb","api.webxr.ar","api.webxr.depth","api.webxr.hittest","media.camera","sensor.imu","sensor.gnss"],"nota":"El caso más numeroso: sin sensor de profundidad, pero con Depth API por movimiento. Google reporta más del 88% de los equipos activos con Depth API en mayo de 2026. Es el suelo sobre el que hay que diseñar la degradación."},{"id":"android.sinarcore","marca":"Android","nombre":"Android sin ARCore (gama de entrada)","clase":"movil","plataforma":"android","anios":[2016,2026],"confianza":"verificado","caps":["media.camera","sensor.imu","sensor.gnss"],"nota":"Cámara y poco más. Sirve para fotogrametría por fotos subidas a la nube y para consumir resultados, no para capturar en vivo."},{"id":"pc.escritorio","marca":"PC / Mac","nombre":"Computador de escritorio o portátil","clase":"pc","plataforma":"desktop","anios":[2015,2026],"confianza":"verificado","caps":["media.camera","compute.webgpu","compute.wasm.simd","io.filesystem","runtime.web"],"nota":"Cero captura de profundidad, pero es donde se revisa, mide sobre el modelo, se corrige el plano y se exporta. La consola de KIMOS vive aquí."},{"id":"pc.sensor3d","marca":"PC + sensor 3D","nombre":"Computador con cámara de profundidad (RealSense, Femto, Kinect Azure)","clase":"pc","plataforma":"desktop","anios":[2015,2026],"confianza":"por-confirmar","caps":["depth.itof","depth.stereo","media.camera","compute.webgpu","compute.wasm.simd","io.filesystem"],"nota":"Puesto fijo de escaneo (mostrador, línea de empaque). Requiere agente local: el navegador no habla con estos sensores. Fase 3."},{"id":"tv.totem","marca":"Smart TV / tótem","nombre":"Televisor, pantalla de sala o tótem","clase":"tv","plataforma":"tv","anios":[2018,2026],"confianza":"verificado","caps":["runtime.web"],"nota":"Rol honesto: mostrar. Vitrina 3D en sala de ventas, plano en obra, avance de proyecto. No captura ni mide."},{"id":"reloj.wearable","marca":"Apple Watch / Wear OS","nombre":"Reloj inteligente","clase":"reloj","plataforma":"wearable","anios":[2018,2026],"confianza":"verificado","caps":["sensor.imu"],"nota":"Sin cámara ni profundidad. Rol real: mando a distancia de la captura (disparar, marcar punto, avisar de que el escaneo terminó) sin soltar la herramienta. Fase 3."},{"id":"campo.dron.escaner","marca":"Equipos de campo","nombre":"Dron con LiDAR, escáner terrestre, robot con LDS","clase":"campo","plataforma":"externo","anios":[2018,2026],"confianza":"verificado","caps":["io.filesystem"],"nota":"No corren la app: entregan archivos (LAS/LAZ, E57, PLY). El punto de contacto es la importación y el cruce con la captura de mano."}],"identificacion":{"ios":{"problema":"Safari no expone el modelo del iPhone. El navegador solo sabe que es 'iPhone', así que NO se puede afirmar si hay LiDAR desde la web.","estrategia":"Se ofrecen candidatos por tamaño de ventana y GPU, y se pide confirmar el modelo una sola vez (queda guardado). La app nativa lo resuelve exacto por identificador de hardware.","pistas":[{"equipo":"apple.iphone.pro.12-17","css":[[390,844],[393,852],[402,874],[428,926],[430,932],[440,956]],"dpr":[3]},{"equipo":"apple.ipadpro.2020+","css":[[834,1194],[1024,1366],[1032,1376],[834,1210]],"dpr":[2]}]},"android":{"problema":"El modelo llega por User-Agent Client Hints de alta entropía y requiere HTTPS y permiso implícito del navegador.","estrategia":"navigator.userAgentData.getHighEntropyValues(['model','platformVersion']) y prefijo contra `modelos`. Si no hay coincidencia, se usa el perfil genérico y se mide en caliente."}}},"modules":{"version":"1.0.0","actualizado":"2026-08-25","nota":"Catálogo de módulos de kimos-LiDARia. `requiere` es duro; `requiereAlguna` son grupos donde basta una capacidad; `prefiere` sube el grado sin ser obligatorio. Los números de negocio son SUPUESTOS declarados y editables, no resultados medidos: están para ordenar prioridades, no para presentarlos como hechos. `estrategico: true` marca los módulos cuyo valor no se ve entero en su propio P&L porque habilitan la venta de otros (catálogo 3D → Tienda y Vitrina).","supuestos":{"clientesKimos":{"valor":120,"label":"Cuentas KIMOS activas en el horizonte del plan","min":10,"max":5000},"costoSemanaUSD":{"valor":2200,"label":"Costo de una semana-persona de desarrollo (USD)","min":500,"max":8000},"churnMensual":{"valor":0.02,"label":"Baja mensual de cuentas","min":0,"max":0.15},"margenObjetivo":{"valor":0.75,"label":"Margen bruto objetivo","min":0.3,"max":0.95}},"modulos":[{"id":"diagnostico","nombre":"Diagnóstico del equipo","icon":"🩺","fase":0,"resumen":"Antes de prometer nada, la app dice qué puede hacer ESTE equipo y qué no.","problema":"El usuario baja una app de escaneo, la abre en un teléfono sin sensor y la app falla en silencio o entrega medidas malas. Se pierde la confianza en el primer minuto.","solucion":"Un diagnóstico que mide en caliente lo que se puede medir, infiere lo demás del catálogo de equipos y entrega un veredicto por módulo con el margen de error esperable y qué hacer para mejorarlo.","requiere":[],"requiereAlguna":[],"prefiere":[],"degradado":"Sin permisos de cámara solo puede informar del entorno; igual entrega el veredicto por módulo con lo inferido y lo marca como tal.","sinSoporte":"No aplica: es el único módulo que corre en cualquier parte, incluida la consola de escritorio.","salidas":["informe JSON","ficha compartible","QR para abrir en el equipo correcto"],"kimos":["escritorio","archivos"],"negocio":{"modelo":"incluido","precioMensualUSD":0,"costoVariableUSD":0,"valorClienteUSD":0,"adopcion":1,"esfuerzoSemanas":3},"riesgos":["Prometer de más por inferencia: por eso todo veredicto viaja con su fuente y su confianza."],"estrategico":true},{"id":"medir","nombre":"Medición en terreno","icon":"📏","fase":1,"resumen":"Distancias, superficies, alturas y ángulos con el teléfono, con el error real de cada medida a la vista.","problema":"Una visita a terreno para tomar medidas cuesta horas de traslado y se rehace cuando falta una cota. El flexómetro no deja registro y lo anotado a mano no es auditable.","solucion":"Medición apoyada en la profundidad del equipo, con foto anotada, autor, fecha y coordenadas. Cada medida guarda su banda de error, así el que la usa sabe si puede cortar material con ella.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["depth.dtof","depth.itof","depth.motion","api.arkit.scenedepth","api.arcore.depth","api.webxr.hittest"]],"prefiere":["depth.dtof","api.arkit.scenedepth","api.arcore.rawdepth"],"degradado":"Con profundidad por movimiento mide igual, pero el error sube al 5-10%: sirve para presupuestar, no para fabricar.","sinSoporte":"Queda como visor: abrir medidas de otros, comentarlas y exportarlas.","salidas":["foto acotada (PNG/PDF)","CSV de medidas","ficha a Pedidos"],"kimos":["pedidos","prospeccion","archivos","productlab"],"negocio":{"modelo":"por-usuario","precioMensualUSD":9,"costoVariableUSD":0.4,"valorClienteUSD":180,"adopcion":0.55,"esfuerzoSemanas":6},"riesgos":["Medida mal usada en fabricación: el error esperado tiene que ser imposible de ignorar en pantalla."]},{"id":"espacios","nombre":"Escaneo de espacios","icon":"🏠","fase":1,"resumen":"Una habitación en un minuto: plano 2D acotado, modelo 3D y superficies calculadas.","problema":"Levantar el plano de un local para una reforma, un arriendo o un seguro toma horas y termina en un dibujo que nadie puede verificar.","solucion":"Escaneo guiado que produce un plano paramétrico (muros, puertas, ventanas, mobiliario) exportable a DXF, IFC y USDZ/GLB, más superficie por recinto y volumen total.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["depth.dtof","depth.itof"],["api.arkit.roomplan","api.arkit.mesh","api.webxr.mesh","api.arcore.rawdepth"]],"prefiere":["api.arkit.roomplan","depth.dtof","compute.npu"],"degradado":"Sin RoomPlan se arma la malla y el plano se ajusta a mano sobre el escaneo: más lento, misma exportación.","sinSoporte":"Sin sensor de profundidad no se ofrece escaneo: se ofrece medir a mano el recinto y dibujar el plano asistido, y se avisa qué equipo del inventario sí puede.","salidas":["DXF","IFC","USDZ/GLB","PDF acotado","superficies por recinto"],"kimos":["archivos","gantt","pedidos","productlab"],"negocio":{"modelo":"por-usuario","precioMensualUSD":29,"costoVariableUSD":2.1,"valorClienteUSD":900,"adopcion":0.3,"esfuerzoSemanas":14},"riesgos":["Depende de una API de Apple que ha tenido regresiones por versión de iOS: hay que fijar versiones probadas y tener camino de malla propia."]},{"id":"objetos","nombre":"Escaneo de producto","icon":"📦","fase":1,"resumen":"Un producto real convertido en modelo 3D con textura, listo para el catálogo y para la vista AR de la tienda.","problema":"Publicar productos en 3D cuesta caro: modelar a mano una pieza son cientos de dólares y semanas, y sin 3D no hay vista AR ni configurador.","solucion":"Captura guiada del objeto con profundidad + fotos, malla limpia y publicación directa al catálogo de KIMOS con medidas reales, peso volumétrico y modelo AR.","requiere":["media.camera"],"requiereAlguna":[["depth.dtof","depth.itof","depth.structured","depth.motion","api.arkit.objectcapture","api.arcore.depth"]],"prefiere":["api.arkit.objectcapture","depth.dtof","compute.npu"],"degradado":"Sin profundidad se captura por fotos y se reconstruye en servidor: más lento y con escala a confirmar, pero funciona en casi cualquier teléfono.","sinSoporte":"Sin cámara no hay captura; queda revisar y publicar modelos existentes.","salidas":["GLB","USDZ","ficha de producto con medidas","peso volumétrico"],"kimos":["productos","tienda","vitrina","productlab"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":69,"costoVariableUSD":8,"valorClienteUSD":520,"adopcion":0.45,"esfuerzoSemanas":12},"riesgos":["El costo de reconstrucción en nube es real: sin cuota por plan, el margen se lo come el procesamiento."],"estrategico":true},{"id":"vitrina-ar","nombre":"Pruébalo en tu espacio","icon":"🛋️","fase":2,"resumen":"El comprador coloca el producto a escala 1:1 en su propia casa, con oclusión real, desde la tienda de KIMOS.","problema":"La devolución por 'no me cabe' o 'no combina' se paga entera: logística inversa, producto tocado y el cliente perdido.","solucion":"Vista AR embebida en la ficha de producto, servida desde el mismo modelo que produjo el módulo de escaneo. En equipos con profundidad, el mueble virtual queda tapado por lo que está delante.","requiere":[],"requiereAlguna":[["api.webxr.ar","api.viewer.usdz","api.viewer.glb"]],"prefiere":["depth.dtof","api.webxr.depth","api.arcore.depth"],"degradado":"Sin profundidad se coloca sobre el plano detectado sin oclusión: convence menos, pero funciona en casi todo el parque.","sinSoporte":"Se muestra el modelo en 3D girable, sin cámara. Sigue siendo mejor que una foto.","salidas":["enlace AR","código QR por producto","métrica de interacción"],"kimos":["tienda","vitrina","productos","productlab"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":149,"costoVariableUSD":4,"valorClienteUSD":1400,"adopcion":0.25,"esfuerzoSemanas":8},"riesgos":["El beneficio depende de tener catálogo 3D: sin el módulo de producto, esto no se vende solo."],"estrategico":true},{"id":"volumen","nombre":"Volumen y carga","icon":"🚚","fase":2,"resumen":"Bultos, pallets y espacio de carga medidos apuntando el teléfono, con peso volumétrico calculado.","problema":"El cubicaje manual es lento y se factura mal: el transportista cobra por volumen y la diferencia sale del margen del que despacha.","solucion":"Medición de la caja o el pallet con profundidad, cálculo de peso volumétrico por tarifa de transportista y armado de carga sobre el espacio real del camión.","requiere":["media.camera"],"requiereAlguna":[["depth.dtof","depth.itof","api.arcore.rawdepth","depth.motion"]],"prefiere":["depth.dtof","api.arcore.rawdepth"],"degradado":"Con profundidad por movimiento el error de volumen ronda el 10%: sirve para planificar, no para facturar.","sinSoporte":"Entrada manual de medidas con la misma calculadora de peso volumétrico.","salidas":["ficha de bulto","peso volumétrico por tarifa","plan de carga"],"kimos":["pedidos","productos","integraciones"],"negocio":{"modelo":"por-usuario","precioMensualUSD":14,"costoVariableUSD":0.6,"valorClienteUSD":380,"adopcion":0.2,"esfuerzoSemanas":7},"riesgos":["Facturar por estas medidas exige certificación legal para comercio (NTEP y equivalentes). Sin ella, el uso es interno y así hay que decirlo en la app."]},{"id":"obra","nombre":"Avance de obra e inspección","icon":"🏗️","fase":2,"resumen":"El mismo espacio escaneado en el tiempo: qué cambió entre visitas, con evidencia fechada.","problema":"El avance de obra se discute con fotos y palabras. Cuando aparece la diferencia, no hay registro que la resuelva.","solucion":"Escaneos sucesivos alineados sobre el mismo origen, comparación volumétrica entre fechas, marcado de observaciones ancladas al punto físico y reporte firmado.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["depth.dtof","depth.itof"],["api.arkit.mesh","api.arcore.rawdepth","api.webxr.mesh"]],"prefiere":["depth.dtof","sensor.gnss","api.arcore.geospatial"],"degradado":"Sin alineación automática, la comparación se ancla a un marcador impreso puesto en obra.","sinSoporte":"Solo lectura de reportes y observaciones.","salidas":["comparativa por fecha","reporte PDF firmado","observaciones ancladas"],"kimos":["gantt","kanban","archivos","equipos"],"negocio":{"modelo":"por-proyecto","precioMensualUSD":249,"costoVariableUSD":12,"valorClienteUSD":2100,"adopcion":0.12,"esfuerzoSemanas":16},"riesgos":["Alinear dos escaneos del mismo espacio con precisión es el problema técnico más difícil del plan; sin marcador de referencia el error se acumula."]},{"id":"gemelo","nombre":"Gemelo digital de activos","icon":"🧭","fase":3,"resumen":"Equipos y puntos de mantenimiento anclados a su lugar físico: apuntas el teléfono y aparece su ficha.","problema":"La ficha del activo vive en una planilla y el activo vive en un pasillo. Quien va a mantenerlo no encuentra ni el equipo ni su historial.","solucion":"Anclas persistentes en el espacio escaneado, ligadas al activo en KIMOS. El técnico apunta, ve el historial, deja la observación en el punto exacto.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["api.webxr.anchors","api.arcore.geospatial","api.arkit.mesh"]],"prefiere":["depth.dtof","api.arcore.geospatial","sensor.gnss"],"degradado":"Anclas por código QR pegado en el activo: menos elegante, funciona en todas partes y no se pierde.","sinSoporte":"Ficha del activo por búsqueda, sin ubicación.","salidas":["mapa de activos","historial por punto","ruta de mantenimiento"],"kimos":["archivos","kanban","integraciones","equipos"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":199,"costoVariableUSD":9,"valorClienteUSD":1800,"adopcion":0.08,"esfuerzoSemanas":18},"riesgos":["La persistencia de anclas entre sesiones y equipos distintos es frágil: el QR de respaldo no es opcional."]},{"id":"terreno","nombre":"Terreno y nubes públicas","icon":"🛰️","fase":3,"resumen":"Importar LiDAR aéreo público (USGS, IGN, OpenTopography) y cruzarlo con lo capturado a mano.","problema":"Los datos de elevación existen y son gratis, pero llegan en formatos que nadie abre en una reunión y no se cruzan con lo medido en terreno.","solucion":"Visor de nubes de puntos y modelos de elevación en el navegador, recorte por zona, perfiles de terreno, y superposición del escaneo de mano sobre el modelo público georreferenciado.","requiere":["runtime.web"],"requiereAlguna":[["compute.webgpu","compute.wasm.simd"]],"prefiere":["compute.webgpu","io.filesystem","sensor.gnss"],"degradado":"Sin WebGPU se recorta la nube en servidor y se muestra un mosaico ligero.","sinSoporte":"Descarga directa del recorte para abrirlo en un escritorio SIG.","salidas":["LAS/LAZ recortado","perfil de terreno","curvas de nivel","vista 3D compartible"],"kimos":["archivos","panel-html","gantt"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":99,"costoVariableUSD":12,"valorClienteUSD":700,"adopcion":0.06,"esfuerzoSemanas":10},"riesgos":["El costo de servir nubes grandes es el que manda: sin recorte y teselado, la factura de nube se dispara."]},{"id":"cuerpo","nombre":"Medidas corporales y postura","icon":"🧍","fase":3,"resumen":"Tallas, ergonomía y seguimiento de postura a partir del cuerpo capturado en 3D.","problema":"La talla equivocada es la primera causa de devolución en ropa, y evaluar postura en un puesto de trabajo requiere equipo caro o el ojo de alguien.","solucion":"Captura del cuerpo con profundidad, medidas antropométricas repetibles y comparación entre sesiones, con consentimiento explícito y borrado a demanda.","requiere":["media.camera"],"requiereAlguna":[["depth.structured","api.arkit.body","depth.dtof"]],"prefiere":["depth.structured","api.arkit.body","compute.npu"],"degradado":"Sin profundidad, estimación por pose 2D: sirve para tendencia, no para talla.","sinSoporte":"Ficha manual de medidas.","salidas":["medidas antropométricas","evolución por sesión","recomendación de talla"],"kimos":["productos","tienda","clientes"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":129,"costoVariableUSD":6,"valorClienteUSD":900,"adopcion":0.05,"esfuerzoSemanas":14},"riesgos":["Dato biométrico: consentimiento, minimización, borrado y ninguna promesa clínica. Si el cliente lo quiere para diagnóstico, cambia el marco regulatorio completo y esto ya no aplica."]},{"id":"accesibilidad","nombre":"Asistente de entorno","icon":"🦯","fase":3,"resumen":"Detección de obstáculos, puertas y desniveles con aviso por voz y vibración.","problema":"Los espacios que una empresa opera no son igual de transitables para todo el mundo, y la normativa de accesibilidad se audita a mano.","solucion":"Dos usos sobre el mismo motor: asistencia en vivo para la persona que recorre, y auditoría de accesibilidad del local escaneado (anchos de paso, altura de mesones, desniveles).","requiere":["media.camera"],"requiereAlguna":[["depth.dtof","depth.itof","api.arcore.semantics","api.arcore.depth"]],"prefiere":["depth.dtof","api.arcore.semantics","compute.npu"],"degradado":"Sin semántica, avisa por distancia y desnivel, sin nombrar el obstáculo.","sinSoporte":"Auditoría a partir de un escaneo hecho en otro equipo.","salidas":["informe de accesibilidad","avisos en vivo","puntos críticos"],"kimos":["archivos","kanban"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":59,"costoVariableUSD":3,"valorClienteUSD":400,"adopcion":0.04,"esfuerzoSemanas":12},"riesgos":["Asistencia en vivo a una persona con discapacidad visual: un falso negativo es un daño físico. O se hace con estándar de seguridad y batería, o se deja en auditoría."]}]},"licencias":{"version":"1.0.0","actualizado":"2026-08-25","principio":"Ninguna biblioteca entra al producto sin licencia compatible con software propietario distribuido, sin dependencia con ejecución en instalación y sin dueño desconocido. Ante la duda, no entra: casi siempre hay una alternativa permisiva.","politica":{"permitidas":[{"id":"MIT","nota":"Permisiva. Sin concesión explícita de patentes."},{"id":"Apache-2.0","nota":"Permisiva CON concesión de patentes: la preferida cuando existe la opción."},{"id":"BSD-2-Clause","nota":"Permisiva."},{"id":"BSD-3-Clause","nota":"Permisiva; prohíbe usar el nombre del autor para promocionar."},{"id":"ISC","nota":"Equivalente a MIT."},{"id":"Zlib","nota":"Permisiva."},{"id":"Unlicense","nota":"Dominio público."},{"id":"CC0-1.0","nota":"Dominio público; válida para datos y assets, no ideal para código."},{"id":"BSL-1.0","nota":"Boost: permisiva, sin obligación de aviso en binarios."}],"condicionales":[{"id":"MPL-2.0","condicion":"Copyleft por archivo. Se puede usar SIN modificar y manteniendo los archivos separados; si se modifica el archivo, ese archivo se publica. Requiere revisión antes de entrar."},{"id":"LGPL-2.1","condicion":"Exige enlace dinámico y permitir reemplazo de la biblioteca. En un bundle de JavaScript eso casi nunca se cumple: en web, tratar como prohibida."},{"id":"LGPL-3.0","condicion":"Igual que LGPL-2.1 más cláusula antitivoización. En apps móviles firmadas es un problema real."},{"id":"EPL-2.0","condicion":"Copyleft débil por archivo; revisión legal antes de usar."},{"id":"CC-BY-4.0","condicion":"Válida para datos y assets con atribución visible. No para código."}],"prohibidas":[{"id":"GPL-2.0","razon":"Obliga a publicar el código del producto que la enlaza."},{"id":"GPL-3.0","razon":"Igual, más cláusulas de patentes y antitivoización."},{"id":"AGPL-3.0","razon":"Extiende la obligación al servicio en red: contamina el backend de KIMOS."},{"id":"SSPL-1.0","razon":"No es open source aprobada y su alcance sobre servicios es inaceptable para un SaaS."},{"id":"BUSL-1.1","razon":"Fuente disponible con restricción de uso comercial por N años."},{"id":"Commons-Clause","razon":"Prohíbe vender el software: incompatible con un producto de pago."},{"id":"CC-BY-NC","razon":"No comercial. KIMOS es comercial."},{"id":"Elastic-2.0","razon":"Restringe ofrecer el software como servicio gestionado."},{"id":"Investigacion-No-Comercial","razon":"Licencias académicas tipo 'solo investigación' (Inria, NVIDIA Source): explícitamente fuera de uso comercial."},{"id":"Sin-licencia","razon":"Sin licencia no hay permiso: el código con LICENSE ausente es, por defecto, todos los derechos reservados."}]},"reglasCadenaSuministro":["Cero dependencias en el núcleo y en los bundles que se distribuyen: lo que no se instala, no se puede comprometer.","Versión fijada (sin ^ ni ~) y archivo de bloqueo commiteado para cualquier dependencia de desarrollo.","Instalación con scripts deshabilitados (`npm ci --ignore-scripts`): la ejecución de código en instalación es el vector más usado.","Nada de CDN en tiempo de ejecución: todo recurso se sirve desde el propio origen. Además de seguridad, evita fugas de datos del usuario a terceros.","SBOM (CycloneDX) generado en cada publicación y guardado junto al artefacto.","Una dependencia nueva se aprueba mirando cuatro cosas: licencia, número de mantenedores, actividad del último año y árbol de dependencias transitivas.","Los pesos de modelos de IA se auditan aparte del código: es habitual que el código sea Apache-2.0 y los pesos no comerciales."],"bibliotecas":[{"nombre":"three.js","uso":"Visor 3D en la web","licencia":"MIT","veredicto":"usar","nota":"Estándar de facto, sin dependencias pesadas."},{"nombre":"@google/model-viewer","uso":"Ficha de producto en 3D/AR (Quick Look y Scene Viewer)","licencia":"Apache-2.0","veredicto":"usar","nota":"Resuelve el AR de catálogo en una etiqueta HTML. Servirlo desde el propio origen, no desde CDN."},{"nombre":"Draco","uso":"Compresión de mallas","licencia":"Apache-2.0","veredicto":"usar"},{"nombre":"meshoptimizer","uso":"Simplificación y optimización de mallas","licencia":"MIT","veredicto":"usar"},{"nombre":"glTF-Transform","uso":"Pipeline de glTF/GLB","licencia":"MIT","veredicto":"usar"},{"nombre":"KTX2 / Basis Universal","uso":"Texturas comprimidas","licencia":"Apache-2.0","veredicto":"usar"},{"nombre":"Potree","uso":"Visor de nubes de puntos masivas","licencia":"BSD-2-Clause","veredicto":"usar"},{"nombre":"CesiumJS","uso":"Terreno y 3D Tiles","licencia":"Apache-2.0","veredicto":"usar"},{"nombre":"loaders.gl / deck.gl","uso":"Lectura de LAS/LAZ y capas de datos","licencia":"MIT","veredicto":"usar"},{"nombre":"PDAL","uso":"Proceso de nubes de puntos en servidor","licencia":"BSD-3-Clause","veredicto":"usar"},{"nombre":"Open3D","uso":"Registro y mallado en servidor","licencia":"MIT","veredicto":"usar"},{"nombre":"PCL","uso":"Algoritmos clásicos de nubes de puntos","licencia":"BSD-3-Clause","veredicto":"usar"},{"nombre":"OpenCV","uso":"Visión por computador","licencia":"Apache-2.0","veredicto":"usar","nota":"Apache-2.0 desde la 4.5; versiones anteriores eran BSD-3. Fijar versión."},{"nombre":"ONNX Runtime","uso":"Inferencia en el dispositivo","licencia":"MIT","veredicto":"usar"},{"nombre":"MediaPipe / TensorFlow Lite","uso":"Pose y segmentación en el dispositivo","licencia":"Apache-2.0","veredicto":"usar","nota":"El código sí; cada modelo preentrenado trae su propia licencia y se revisa por separado."},{"nombre":"laz-perf","uso":"Lectura de LAZ en el navegador","licencia":"Apache-2.0","veredicto":"condicional","nota":"Confirmar el LICENSE de la versión fijada: el ecosistema LASzip mezcla LGPL en algunas piezas."},{"nombre":"Entwine","uso":"Teselado de nubes de puntos","licencia":"LGPL-2.1","veredicto":"condicional","nota":"Solo como herramienta de servidor ejecutada como proceso aparte, nunca enlazada al producto."},{"nombre":"FFmpeg","uso":"Vídeo de la captura","licencia":"LGPL-2.1 (o GPL según compilación)","veredicto":"condicional","nota":"Compilar sin componentes GPL y ejecutarlo como binario separado. Revisar además patentes de códecs."},{"nombre":"COLMAP","uso":"Fotogrametría (structure from motion)","licencia":"BSD-3-Clause","veredicto":"condicional","nota":"Revisar componentes opcionales de terceros antes de empaquetar."},{"nombre":"OpenMVG","uso":"Fotogrametría","licencia":"MPL-2.0","veredicto":"condicional","nota":"Copyleft por archivo: usar sin modificar."},{"nombre":"AliceVision / Meshroom","uso":"Fotogrametría completa","licencia":"MPL-2.0 + terceros","veredicto":"condicional","nota":"El árbol incluye piezas con otras licencias; auditar antes de distribuir."},{"nombre":"Unity","uso":"Motor para AR avanzada","licencia":"Comercial (EULA)","veredicto":"condicional","nota":"Decisión de costo y de dependencia de proveedor, no de licencia libre. Evitable con ARKit/ARCore nativos y three.js en web."},{"nombre":"Unreal Engine","uso":"Motor para AR avanzada","licencia":"EULA con regalías","veredicto":"condicional","nota":"Regalías sobre ingresos del producto que lo incorpore."},{"nombre":"OpenMVS","uso":"Reconstrucción densa","licencia":"AGPL-3.0","veredicto":"prohibida","nota":"Contamina el servicio en red. Alternativa: Open3D + PDAL."},{"nombre":"CGAL","uso":"Geometría computacional","licencia":"GPL-3.0 / comercial","veredicto":"prohibida","nota":"Solo con licencia comercial pagada. Alternativa: Open3D, libigl (MPL-2.0)."},{"nombre":"3D Gaussian Splatting (implementación original Inria/MPII)","uso":"Renderizado neuronal","licencia":"Investigación no comercial","veredicto":"prohibida","nota":"Alternativa comercialmente utilizable: gsplat (Apache-2.0), verificando también los pesos."},{"nombre":"instant-ngp (NVIDIA)","uso":"NeRF rápido","licencia":"NVIDIA Source Code License (no comercial)","veredicto":"prohibida"},{"nombre":"SDK de Polycam / Matterport","uso":"Escaneo de terceros","licencia":"Comercial","veredicto":"condicional","nota":"Depender del SDK de un competidor directo es riesgo de negocio antes que legal."}],"datos":[{"fuente":"USGS 3DEP / Earth Explorer","licencia":"Dominio público (obra del gobierno de EE. UU.)","veredicto":"usar","nota":"Citar la fuente por buena práctica."},{"fuente":"NOAA Digital Coast","licencia":"Dominio público","veredicto":"usar"},{"fuente":"OpenTopography","licencia":"Varía por conjunto de datos","veredicto":"condicional","nota":"Cada dataset trae su cita y su licencia: se guarda junto al archivo importado."},{"fuente":"IGN España — Centro de Descargas","licencia":"CC-BY 4.0","veredicto":"usar","nota":"Atribución obligatoria y visible en el visor y en los PDF exportados."},{"fuente":"Copernicus / EU-DEM","licencia":"Licencia Copernicus","veredicto":"usar","nota":"Atribución obligatoria."},{"fuente":"OpenStreetMap","licencia":"ODbL","veredicto":"condicional","nota":"TRAMPA CLÁSICA: es share-alike sobre bases de datos derivadas. Se puede usar como mapa base, pero mezclarlo con los datos del cliente puede obligar a publicar el resultado. Preferir un mapa base con licencia permisiva para datos de clientes."}],"otrosRiesgos":[{"tema":"Imágenes de personas en las capturas","riesgo":"Una captura de un local incluye caras y matrículas: es dato personal.","medida":"Difuminado automático antes de subir, retención configurable y borrado a demanda."},{"tema":"Datos biométricos (módulo de cuerpo)","riesgo":"Categoría especial en RGPD y equivalentes; consentimiento explícito y finalidad acotada.","medida":"Consentimiento por sesión, proceso en el dispositivo cuando se pueda, y ninguna afirmación clínica."},{"tema":"Medidas usadas para facturar","riesgo":"Cobrar por volumen medido exige certificación metrológica legal (NTEP y equivalentes nacionales).","medida":"La app marca las medidas como referenciales y no las ofrece para facturación mientras no exista certificación."},{"tema":"Términos de las plataformas","riesgo":"ARKit, ARCore, App Store y Play imponen reglas sobre uso de cámara y datos de profundidad.","medida":"Declarar finalidad en la ficha de la tienda y en los permisos; nada de recolección secundaria."},{"tema":"Marcas de terceros","riesgo":"Nombrar equipos y competidores en la app.","medida":"Uso nominativo y descriptivo (lista de compatibilidad), sin logotipos ni sugerencia de respaldo."}]},"matriz":[{"equipo":"apple.iphone.pro.12-17","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":8,"visor":0,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","espacios":"potencial","objetos":"potencial","obra":"potencial","gemelo":"potencial","cuerpo":"potencial","accesibilidad":"potencial","medir":"potencial","volumen":"potencial"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":9,"degradados":1,"potenciales":0,"visor":1,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","espacios":"completo","objetos":"completo","cuerpo":"completo","medir":"completo","obra":"completo","gemelo":"completo","accesibilidad":"completo","volumen":"completo","vitrina-ar":"degradado","terreno":"visor"}}},{"equipo":"apple.ipadpro.2020+","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":8,"visor":0,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","espacios":"potencial","objetos":"potencial","cuerpo":"potencial","accesibilidad":"potencial","medir":"potencial","volumen":"potencial","obra":"potencial","gemelo":"potencial"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":7,"degradados":3,"potenciales":0,"visor":1,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","espacios":"completo","objetos":"completo","cuerpo":"completo","medir":"completo","accesibilidad":"completo","volumen":"completo","vitrina-ar":"degradado","obra":"degradado","gemelo":"degradado","terreno":"visor"}}},{"equipo":"apple.iphone.estandar","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":3,"visor":5,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","objetos":"potencial","cuerpo":"potencial","medir":"potencial","espacios":"visor","obra":"visor","gemelo":"visor","accesibilidad":"visor","volumen":"visor"}},"nativo":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.structured","sensorLabel":"Luz estructurada frontal","errorA3m":0.015,"resumen":{"completos":2,"degradados":3,"potenciales":0,"visor":6,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","cuerpo":"completo","medir":"degradado","objetos":"degradado","vitrina-ar":"degradado","espacios":"visor","obra":"visor","gemelo":"visor","terreno":"visor","accesibilidad":"visor","volumen":"visor"}}},{"equipo":"apple.visionpro","web":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":7,"degradados":4,"potenciales":0,"visor":0,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","espacios":"completo","objetos":"completo","vitrina-ar":"completo","cuerpo":"completo","accesibilidad":"completo","volumen":"completo","medir":"degradado","obra":"degradado","gemelo":"degradado","terreno":"degradado"}},"nativo":null},{"equipo":"meta.quest3","web":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":3,"degradados":8,"potenciales":0,"visor":0,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","vitrina-ar":"completo","volumen":"completo","medir":"degradado","espacios":"degradado","objetos":"degradado","obra":"degradado","gemelo":"degradado","terreno":"degradado","accesibilidad":"degradado","cuerpo":"degradado"}},"nativo":null},{"equipo":"android.xr.visores","web":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.stereo","sensorLabel":"Estéreo multicámara","errorA3m":0.12,"resumen":{"completos":1,"degradados":4,"potenciales":0,"visor":6,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","medir":"degradado","gemelo":"degradado","espacios":"visor","objetos":"visor","volumen":"visor","obra":"visor","cuerpo":"visor","accesibilidad":"visor"}},"nativo":null},{"equipo":"samsung.tof.2019-2020","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":7,"visor":1,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","obra":"potencial","gemelo":"potencial","medir":"potencial","espacios":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","cuerpo":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.itof","sensorLabel":"ToF continuo (iToF)","errorA3m":0.07500000000000001,"resumen":{"completos":4,"degradados":5,"potenciales":0,"visor":2,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","obra":"completo","gemelo":"completo","volumen":"completo","medir":"degradado","vitrina-ar":"degradado","accesibilidad":"degradado","espacios":"degradado","objetos":"degradado","terreno":"visor","cuerpo":"visor"}}},{"equipo":"samsung.flagship.reciente","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":5,"visor":3,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","objetos":"potencial","gemelo":"potencial","accesibilidad":"potencial","medir":"potencial","volumen":"potencial","espacios":"visor","obra":"visor","cuerpo":"visor"}},"nativo":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.stereo","sensorLabel":"Estéreo multicámara","errorA3m":0.12,"resumen":{"completos":4,"degradados":3,"potenciales":0,"visor":4,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","gemelo":"completo","accesibilidad":"completo","volumen":"completo","medir":"degradado","objetos":"degradado","vitrina-ar":"degradado","obra":"visor","espacios":"visor","terreno":"visor","cuerpo":"visor"}}},{"equipo":"huawei.tof","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":4,"visor":4,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","medir":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","obra":"visor","gemelo":"visor","espacios":"visor","cuerpo":"visor"}},"nativo":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":0,"potenciales":4,"visor":6,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","medir":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","obra":"visor","gemelo":"visor","terreno":"visor","espacios":"visor","vitrina-ar":"visor","cuerpo":"visor"}}},{"equipo":"sony.xperia1.tof","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":6,"visor":2,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","obra":"potencial","medir":"potencial","espacios":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","gemelo":"visor","cuerpo":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.itof","sensorLabel":"ToF continuo (iToF)","errorA3m":0.07500000000000001,"resumen":{"completos":2,"degradados":6,"potenciales":0,"visor":3,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","volumen":"completo","medir":"degradado","vitrina-ar":"degradado","obra":"degradado","espacios":"degradado","objetos":"degradado","accesibilidad":"degradado","gemelo":"visor","terreno":"visor","cuerpo":"visor"}}},{"equipo":"honor.lg.tof","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":4,"visor":4,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","medir":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","espacios":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.itof","sensorLabel":"ToF continuo (iToF)","errorA3m":0.07500000000000001,"resumen":{"completos":1,"degradados":5,"potenciales":0,"visor":5,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","medir":"degradado","objetos":"degradado","volumen":"degradado","accesibilidad":"degradado","espacios":"visor","obra":"visor","gemelo":"visor","terreno":"visor","cuerpo":"visor"}}},{"equipo":"android.arcore.generico","web":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.motion","sensorLabel":"Profundidad por movimiento","errorA3m":0.21000000000000002,"resumen":{"completos":1,"degradados":5,"potenciales":2,"visor":3,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","medir":"degradado","objetos":"degradado","volumen":"degradado","gemelo":"potencial","accesibilidad":"potencial","obra":"visor","espacios":"visor","cuerpo":"visor"}},"nativo":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.motion","sensorLabel":"Profundidad por movimiento","errorA3m":0.21000000000000002,"resumen":{"completos":3,"degradados":4,"potenciales":0,"visor":4,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","gemelo":"completo","volumen":"completo","medir":"degradado","vitrina-ar":"degradado","accesibilidad":"degradado","objetos":"degradado","obra":"visor","terreno":"visor","espacios":"visor","cuerpo":"visor"}}},{"equipo":"android.sinarcore","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":0,"visor":8,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","obra":"visor","gemelo":"visor","medir":"visor","espacios":"visor","objetos":"visor","volumen":"visor","cuerpo":"visor","accesibilidad":"visor"}},"nativo":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":0,"potenciales":0,"visor":10,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","obra":"visor","gemelo":"visor","terreno":"visor","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","cuerpo":"visor","accesibilidad":"visor"}}},{"equipo":"pc.escritorio","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":2,"degradados":0,"potenciales":0,"visor":9,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"completo","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor"}},"nativo":null},{"equipo":"pc.sensor3d","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":2,"degradados":0,"potenciales":3,"visor":6,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"completo","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","medir":"visor","espacios":"visor","vitrina-ar":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor"}},"nativo":null},{"equipo":"tv.totem","web":{"nivel":"consola","nivelLabel":"Consola","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":9,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor"}},"nativo":null},{"equipo":"reloj.wearable","web":{"nivel":"consola","nivelLabel":"Consola","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":9,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor"}},"nativo":null},{"equipo":"campo.dron.escaner","web":{"nivel":"consola","nivelLabel":"Consola","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":9,"noDisponibles":0,"total":11},"modulos":{"diagnostico":"completo","terreno":"degradado","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor"}},"nativo":null}]};

/* ------------------------------- utilidades ------------------------------- */

const usd = (n) => (n == null || !isFinite(n) ? '—' : '$' + Math.round(n).toLocaleString('es-CL'));
const pct = (n, d) => (n == null || !isFinite(n) ? '—' : (n * 100).toFixed(d == null ? 0 : d) + '%');
const meses = (n) => (!isFinite(n) ? 'nunca' : n.toFixed(1) + ' m');
const cm = (m) => (m == null ? '—' : (m < 0.01 ? (m * 1000).toFixed(0) + ' mm' : (m * 100).toFixed(1) + ' cm'));

const TABS = [
  ['panel', 'Panel', '🛰️'],
  ['modulos', 'Módulos', '🧩'],
  ['inventario', 'Inventario', '🎒'],
  ['equipos', 'Equipos', '📱'],
  ['negocio', 'Negocio', '📈'],
  ['plan', 'Plan', '🗺️'],
  ['licencias', 'Licencias', '⚖️'],
];

const ESTADO_ICO = { completo: '✅', degradado: '🟡', potencial: '🔓', visor: '👁️', 'no-disponible': '⛔' };
const ESTADO_LBL = { completo: 'Completo', degradado: 'Degradado', potencial: 'Al alcance', visor: 'Solo lectura', 'no-disponible': 'No disponible' };
const ORDEN_ESTADO = ['completo', 'degradado', 'potencial', 'visor', 'no-disponible'];

const equipoPorId = (id) => DATOS.devices.equipos.filter((e) => e.id === id)[0] || null;
const moduloPorId = (id) => DATOS.modules.modulos.filter((m) => m.id === id)[0] || null;
const filaMatriz = (id) => DATOS.matriz.filter((f) => f.equipo === id)[0] || null;

/** Mejor estado que alcanza un equipo para un módulo (con app nativa si existe). */
function estadoDe(equipoId, moduloId) {
  const f = filaMatriz(equipoId);
  if (!f) return 'no-disponible';
  const nativo = f.nativo && f.nativo.modulos[moduloId];
  const web = f.web && f.web.modulos[moduloId];
  const cands = [nativo, web].filter(Boolean);
  if (!cands.length) return 'no-disponible';
  return cands.sort((a, b) => ORDEN_ESTADO.indexOf(a) - ORDEN_ESTADO.indexOf(b))[0];
}

/**
 * Cobertura de la organización: con el parque registrado, qué módulos quedan
 * realmente cubiertos. Es la pregunta que decide si hay que comprar un equipo.
 */
function cobertura(inventario) {
  const porModulo = {};
  for (const m of DATOS.modules.modulos) {
    let mejor = 'no-disponible';
    const equipos = [];
    for (const item of inventario) {
      const e = estadoDe(item.equipo, m.id);
      if (ORDEN_ESTADO.indexOf(e) < ORDEN_ESTADO.indexOf(mejor)) mejor = e;
      if (e === 'completo' || e === 'degradado') equipos.push(item);
    }
    porModulo[m.id] = { estado: mejor, equipos: equipos };
  }
  const cuenta = (e) => Object.values(porModulo).filter((x) => x.estado === e).length;
  return {
    porModulo,
    resumen: {
      completos: cuenta('completo'),
      degradados: cuenta('degradado'),
      sinCubrir: cuenta('visor') + cuenta('no-disponible') + cuenta('potencial'),
      total: DATOS.modules.modulos.length,
      unidades: inventario.reduce((a, i) => a + (i.cantidad || 1), 0),
    },
  };
}

/** Qué equipo conviene sumar para cubrir un módulo que hoy no se cubre. */
function recomendarPara(moduloId, inventario) {
  const yaTengo = new Set(inventario.map((i) => i.equipo));
  const candidatos = DATOS.devices.equipos
    .filter((e) => !yaTengo.has(e.id) && estadoDe(e.id, moduloId) === 'completo')
    .map((e) => {
      // Se prefiere el equipo que además cubra más módulos: comprar una vez.
      const extra = DATOS.modules.modulos.filter((m) => estadoDe(e.id, m.id) === 'completo').length;
      return { equipo: e, cubre: extra };
    })
    .sort((a, b) => b.cubre - a.cubre);
  return candidatos.slice(0, 3);
}

function estadoInicial() {
  return {
    v: 1,
    tab: 'panel',
    inventario: [],
    sup: Object.assign({}, SUPUESTOS_BASE),
    filtro: '',
    moduloSel: null,
    diag: null,          // diagnóstico del equipo donde corre el shell
    urlApp: 'https://lidaria.kimos.dev',
    copiado: false,
  };
}

/* ---------------------------------- mount --------------------------------- */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  let estado = estadoInicial();
  const oyentes = new Set();

  function commit(patch) {
    estado = Object.assign({}, estado, patch);
    oyentes.forEach((f) => f(estado));
    programarGuardado();
  }

  let timer = null;
  function programarGuardado() {
    if (!shell || typeof shell.saveData !== 'function') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { v, tab, inventario, sup, urlApp } = estado;
      Promise.resolve(shell.saveData({ v, tab, inventario, sup, urlApp })).catch(() => {});
    }, 800);
  }

  async function restaurar() {
    if (!shell || typeof shell.loadData !== 'function') return;
    try {
      const d = await shell.loadData();
      if (!d || typeof d !== 'object') return;
      const patch = {};
      if (d.tab && TABS.some((t) => t[0] === d.tab)) patch.tab = d.tab;
      if (Array.isArray(d.inventario)) patch.inventario = d.inventario.filter((i) => i && equipoPorId(i.equipo));
      if (d.sup) patch.sup = Object.assign({}, SUPUESTOS_BASE, d.sup);
      if (typeof d.urlApp === 'string') patch.urlApp = d.urlApp;
      estado = Object.assign({}, estado, patch);
      oyentes.forEach((f) => f(estado));
    } catch (e) { /* primera apertura */ }
  }

  /** Diagnóstico del propio equipo donde corre el escritorio de KIMOS. */
  async function diagnosticarAqui() {
    try {
      const evid = await detectar(globalThis);
      evid.enShellKimos = true;
      const ident = identificar(evid, DATOS.devices, {});
      const r = resolver(evid, ident.equipo, null);
      const inf = diagnosticar(
        { caps: r.caps, potenciales: r.potenciales, evid, equipo: ident.equipo, identificacion: ident },
        DATOS.modules,
      );
      commit({ diag: inf });
    } catch (e) {
      commit({ diag: { error: String((e && e.message) || e) } });
    }
  }

  /* ------------------------------- acciones ------------------------------- */

  function agregarEquipo(equipoId, etiqueta, cantidad) {
    const e = equipoPorId(equipoId);
    if (!e) return { ok: false, error: 'Equipo desconocido: ' + equipoId };
    const n = Math.max(1, Math.min(9999, Math.round(Number(cantidad) || 1)));
    const inv = estado.inventario.slice();
    const i = inv.findIndex((x) => x.equipo === equipoId);
    if (i >= 0) inv[i] = Object.assign({}, inv[i], { cantidad: (inv[i].cantidad || 1) + n });
    else inv.push({ equipo: equipoId, etiqueta: String(etiqueta || e.nombre).slice(0, 60), cantidad: n });
    commit({ inventario: inv });
    return { ok: true, mensaje: e.nombre + ' × ' + n + ' en el inventario' };
  }

  function quitarEquipo(equipoId) {
    const inv = estado.inventario.filter((x) => x.equipo !== equipoId);
    if (inv.length === estado.inventario.length) return { ok: false, error: 'Ese equipo no está en el inventario' };
    commit({ inventario: inv });
    return { ok: true, mensaje: 'Equipo quitado' };
  }

  function setSup(clave, valor) {
    const n = Number(valor);
    if (!isFinite(n)) return { ok: false, error: 'Valor no numérico' };
    if (!(clave in SUPUESTOS_BASE)) return { ok: false, error: 'Supuesto desconocido: ' + clave };
    commit({ sup: Object.assign({}, estado.sup, { [clave]: n }) });
    return { ok: true, mensaje: clave + ' = ' + n };
  }

  function copiarEnlace() {
    const url = estado.urlApp;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          commit({ copiado: true });
          setTimeout(() => commit({ copiado: false }), 2000);
        });
      }
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Enlace copiado: ' + url });
    } catch (e) {
      if (shell && shell.notify) shell.notify({ level: 'warn', text: 'Copia manualmente: ' + url });
    }
  }

  function exportarCSV() {
    const cab = ['Equipo', 'Clase', 'Plataforma'].concat(DATOS.modules.modulos.map((m) => m.nombre));
    const filas = DATOS.devices.equipos.map((e) => [e.nombre, e.clase, e.plataforma]
      .concat(DATOS.modules.modulos.map((m) => ESTADO_LBL[estadoDe(e.id, m.id)])));
    const csv = [cab].concat(filas).map((f) => f.map((c) => {
      const s = c == null ? '' : String(c);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\n');
    try {
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'lidaria-compatibilidad.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Matriz exportada' });
    } catch (e) {
      if (shell && shell.notify) shell.notify({ level: 'error', text: 'No se pudo exportar' });
    }
  }

  /* ------------------------------ piezas de UI ------------------------------ */

  const card = (titulo, cuerpo, opciones) => {
    const o = opciones || {};
    return h('section', { className: 'ld-card' + (o.clase ? ' ' + o.clase : ''), key: o.key },
      titulo ? h('h2', null, titulo) : null,
      o.hint ? h('p', { className: 'ld-hint' }, o.hint) : null,
      cuerpo);
  };

  const kpi = (k, v, n) => h('div', { className: 'ld-kpi', key: k },
    h('div', { className: 'ld-kpi-k' }, k),
    h('div', { className: 'ld-kpi-v' }, v),
    n ? h('div', { className: 'ld-kpi-n' }, n) : null);

  const chip = (texto, clase, titulo) => h('span', { className: 'ld-chip' + (clase ? ' ' + clase : ''), title: titulo || null, key: texto }, texto);

  const pastilla = (estado) => h('span', { className: 'ld-est ld-e-' + estado, title: ESTADO_LBL[estado] },
    ESTADO_ICO[estado], ' ', ESTADO_LBL[estado]);

  function tabla(cols, filas, opts) {
    const o = opts || {};
    return h('div', { className: 'ld-tbl-wrap' },
      h('table', { className: 'ld-tbl' },
        h('thead', null, h('tr', null, cols.map((c) => h('th', { key: c.k, className: c.num ? 'ld-num' : null }, c.l)))),
        h('tbody', null, filas.map((f, i) => h('tr', { key: o.key ? o.key(f, i) : i, className: o.clase ? o.clase(f) : null },
          cols.map((c) => h('td', { key: c.k, className: c.num ? 'ld-num' : null }, c.cell(f, i))))))));
  }

  const campo = (label, valor, onChange, opts) => {
    const o = opts || {};
    return h('label', { className: 'ld-campo', key: label },
      h('span', null, label),
      h('input', {
        type: o.type || 'number', value: valor, step: o.step || 'any', min: o.min, max: o.max,
        onChange: (e) => onChange(e.target.value),
      }),
      o.hint ? h('small', null, o.hint) : null);
  };

  /* --------------------------------- vistas --------------------------------- */

  function vistaPanel(cob, eco) {
    const d = estado.diag;
    const f1 = eco.porFase.filter((p) => p.fase === 1)[0];

    const aquí = !d ? h('p', { className: 'ld-hint' }, 'Analizando este equipo…')
      : d.error ? h('p', { className: 'ld-hint' }, 'No se pudo diagnosticar: ' + d.error)
      : h('div', null,
          h('div', { className: 'ld-kvs' },
            h('div', { className: 'ld-kv' }, h('span', null, 'Equipo'), h('b', null, d.equipo ? d.equipo.nombre : '—')),
            h('div', { className: 'ld-kv' }, h('span', null, 'Nivel'), h('b', null, d.nivel.label)),
            h('div', { className: 'ld-kv' }, h('span', null, 'Módulos completos aquí'), h('b', null, d.resumen.completos + ' de ' + d.resumen.total))),
          h('p', { className: 'ld-hint' }, d.nivel.desc),
          h('p', null, 'Para capturar hace falta un equipo con sensor. Abre la app en el teléfono correcto:'),
          h('div', { className: 'ld-fila' },
            h('input', { className: 'ld-input', value: estado.urlApp, onChange: (e) => commit({ urlApp: e.target.value.slice(0, 200) }) }),
            h('button', { className: 'ld-btn ld-pri', onClick: copiarEnlace }, estado.copiado ? '✓ Copiado' : 'Copiar enlace')));

    return h('div', null,
      card('🛰️ LiDARia, en una frase',
        h('div', null,
          h('p', null, 'Una sola app con ', h('b', null, DATOS.modules.modulos.length + ' módulos'),
            ' que se encienden según lo que cada equipo puede hacer de verdad. Nada de prometer un escaneo que el teléfono del usuario no puede dar.'),
          h('div', { className: 'ld-kpis' },
            kpi('Equipos en catálogo', DATOS.devices.equipos.length, 'de teléfono a tótem'),
            kpi('Módulos', DATOS.modules.modulos.length, 'en tres fases'),
            kpi('Fase 1', f1 ? f1.esfuerzoSemanas + ' sem' : '—', f1 ? 'se paga en ' + meses(f1.paybackMeses) : ''),
            kpi('Cobertura del inventario', cob.resumen.completos + '/' + cob.resumen.total, cob.resumen.unidades + ' equipo(s) registrados')))),
      card('🖥️ Este equipo (donde corre KIMOS)', aquí, { hint: 'El escritorio no captura: decide, revisa y exporta. Eso también es un rol del producto.' }),
      card('▶️ Próximo paso',
        h('ol', { className: 'ld-lista' },
          h('li', null, 'Registra en ', h('b', null, 'Inventario'), ' los equipos que ya tiene el equipo de trabajo.'),
          h('li', null, 'Mira en ', h('b', null, 'Módulos'), ' qué queda cubierto y qué no, y qué falta para cubrirlo.'),
          h('li', null, 'En ', h('b', null, 'Negocio'), ' mueve los supuestos con tus números: el orden de construcción sale de ahí.'),
          h('li', null, 'Antes de sumar una biblioteca, revísala en ', h('b', null, 'Licencias'), '.'))));
  }

  function vistaModulos(cob) {
    const sel = estado.moduloSel ? moduloPorId(estado.moduloSel) : null;
    const fichas = DATOS.modules.modulos.map((m) => {
      const c = cob.porModulo[m.id];
      const abierto = estado.moduloSel === m.id;
      return h('article', {
        key: m.id,
        className: 'ld-mod ld-b-' + c.estado + (abierto ? ' on' : ''),
        onClick: () => commit({ moduloSel: abierto ? null : m.id }),
      },
        h('header', null,
          h('span', { className: 'ld-mod-ico' }, m.icon),
          h('div', null, h('h3', null, m.nombre), h('p', { className: 'ld-mini' }, 'Fase ' + m.fase + (m.estrategico ? ' · estratégico' : ''))),
          pastilla(c.estado)),
        h('p', null, m.resumen),
        c.equipos.length
          ? h('p', { className: 'ld-mini' }, 'Cubierto por: ' + c.equipos.map((e) => e.etiqueta).join(', '))
          : h('p', { className: 'ld-mini' }, 'Sin equipo en el inventario que lo cubra.'));
    });

    const detalle = !sel ? null : (function () {
      const c = cob.porModulo[sel.id];
      const eco = economiaModulo(sel, estado.sup);
      const rec = c.estado === 'completo' ? [] : recomendarPara(sel.id, estado.inventario);
      return card(sel.icon + ' ' + sel.nombre,
        h('div', null,
          h('div', { className: 'ld-cols' },
            h('div', null,
              h('h4', null, 'El problema'), h('p', null, sel.problema),
              h('h4', null, 'Qué hace'), h('p', null, sel.solucion),
              h('h4', null, 'Si el equipo no da la talla'), h('p', null, sel.degradado),
              h('h4', null, 'Donde no puede correr'), h('p', null, sel.sinSoporte)),
            h('div', null,
              h('h4', null, 'Necesita'),
              h('div', { className: 'ld-chips' },
                (sel.requiere || []).map((x) => chip(etiquetaCap(x), 'req')),
                (sel.requiereAlguna || []).map((g, i) => chip(g.map(etiquetaCap).join(' o '), 'req', 'Basta una de estas'))),
              h('h4', null, 'Mejora con'),
              h('div', { className: 'ld-chips' }, (sel.prefiere || []).map((x) => chip(etiquetaCap(x), 'pref'))),
              h('h4', null, 'Se conecta con'),
              h('div', { className: 'ld-chips' }, (sel.kimos || []).map((k) => chip(k, 'kimos'))),
              h('h4', null, 'Entrega'),
              h('p', { className: 'ld-mini' }, (sel.salidas || []).join(' · ')))),
          h('div', { className: 'ld-kpis' },
            kpi('Precio sugerido', usd(eco.precioCuenta) + '/mes', eco.modelo),
            kpi('Inversión', usd(eco.inversion), eco.esfuerzoSemanas + ' semanas-persona'),
            kpi('Payback', meses(eco.paybackMeses), 'con ' + eco.cuentas + ' cuentas'),
            kpi('Valor para el cliente', eco.multiploValor.toFixed(1) + '×', 'por cada dólar que paga')),
          h('h4', null, 'Riesgos declarados'),
          h('ul', { className: 'ld-lista' }, (sel.riesgos || []).map((r, i) => h('li', { key: i }, r))),
          rec.length
            ? h('div', null,
                h('h4', null, 'Para cubrirlo, el equipo que más rinde'),
                h('ul', { className: 'ld-lista' }, rec.map((r) => h('li', { key: r.equipo.id },
                  h('b', null, r.equipo.nombre), ' — deja completos ' + r.cubre + ' módulos. ',
                  h('button', { className: 'ld-btn ld-mini-btn', onClick: () => agregarEquipo(r.equipo.id, r.equipo.nombre, 1) }, 'Añadir al inventario')))))
            : null),
        { clase: 'ld-detalle' });
    })();

    return h('div', null,
      card('Un producto, varios módulos',
        h('p', null, 'El estado de cada módulo es el mejor que alcanza algún equipo de tu inventario. Haz clic en un módulo para ver qué necesita, qué entrega, cuánto cuesta y en qué se apoya de KIMOS.'),
        { hint: 'Estados: ' + ORDEN_ESTADO.map((e) => ESTADO_ICO[e] + ' ' + ESTADO_LBL[e]).join(' · ') }),
      detalle,
      h('div', { className: 'ld-grid' }, fichas));
  }

  function etiquetaCap(id) {
    const c = CAP_POR_ID.get(id);
    return c ? (c.corto || c.label) : id;
  }

  function vistaInventario(cob) {
    const equipos = DATOS.devices.equipos;
    const filas = estado.inventario.map((i) => {
      const e = equipoPorId(i.equipo);
      const cubre = DATOS.modules.modulos.filter((m) => estadoDe(i.equipo, m.id) === 'completo').length;
      const f = filaMatriz(i.equipo);
      const mejor = (f && f.nativo) || (f && f.web);
      return { i, e, cubre, mejor };
    });

    const sinCubrir = DATOS.modules.modulos.filter((m) => ['visor', 'no-disponible', 'potencial'].includes(cob.porModulo[m.id].estado));

    return h('div', null,
      card('🎒 El parque real de la organización',
        h('div', null,
          h('p', null, 'Registra los equipos que ya existen. La cobertura de abajo se calcula con ellos, no con un catálogo ideal.'),
          h('div', { className: 'ld-fila' },
            h('select', {
              className: 'ld-input', value: '',
              onChange: (e) => { if (e.target.value) agregarEquipo(e.target.value, null, 1); },
            },
              h('option', { value: '' }, '+ Añadir equipo…'),
              equipos.map((e) => h('option', { key: e.id, value: e.id }, e.nombre))),
            h('button', { className: 'ld-btn', onClick: exportarCSV }, 'Exportar matriz CSV')),
          h('div', { className: 'ld-kpis' },
            kpi('Unidades', cob.resumen.unidades),
            kpi('Módulos completos', cob.resumen.completos + '/' + cob.resumen.total),
            kpi('Degradados', cob.resumen.degradados),
            kpi('Sin cubrir', cob.resumen.sinCubrir)))),

      filas.length ? card('Equipos registrados', tabla([
        { k: 'eq', l: 'Equipo', cell: (f) => h('div', null, h('b', null, f.e.nombre), h('div', { className: 'ld-mini' }, f.e.marca + ' · ' + f.e.plataforma)) },
        { k: 'n', l: 'Unidades', num: true, cell: (f) => h('input', {
            className: 'ld-input ld-num-input', type: 'number', min: 1, value: f.i.cantidad || 1,
            onChange: (e) => {
              const n = Math.max(1, Math.round(Number(e.target.value) || 1));
              const inv = estado.inventario.map((x) => (x.equipo === f.i.equipo ? Object.assign({}, x, { cantidad: n }) : x));
              commit({ inventario: inv });
            },
          }) },
        { k: 'sensor', l: 'Sensor', cell: (f) => (f.mejor && f.mejor.sensorLabel) || '—' },
        { k: 'err', l: 'Error a 3 m', num: true, cell: (f) => cm(f.mejor && f.mejor.errorA3m) },
        { k: 'cubre', l: 'Módulos completos', num: true, cell: (f) => f.cubre + ' / ' + DATOS.modules.modulos.length },
        { k: 'x', l: '', cell: (f) => h('button', { className: 'ld-btn ld-mini-btn', onClick: () => quitarEquipo(f.i.equipo) }, 'Quitar') },
      ], filas, { key: (f) => f.i.equipo })) : card(null, h('p', { className: 'ld-hint' }, 'Todavía no hay equipos registrados: añade uno arriba.')),

      sinCubrir.length ? card('Lo que hoy no se cubre — y con qué se cubriría',
        h('div', null, sinCubrir.map((m) => {
          const rec = recomendarPara(m.id, estado.inventario);
          return h('div', { className: 'ld-gap', key: m.id },
            h('b', null, m.icon + ' ' + m.nombre),
            h('span', { className: 'ld-mini' }, ' — ' + (cob.porModulo[m.id].estado === 'potencial' ? 'al alcance con la app nativa' : 'sin equipo capaz')),
            rec.length
              ? h('div', { className: 'ld-mini' }, 'Sumando ', h('b', null, rec[0].equipo.nombre), ' quedaría completo (y ' + rec[0].cubre + ' módulos en total).')
              : h('div', { className: 'ld-mini' }, 'Ningún equipo del catálogo lo deja completo: es trabajo de plataforma, no de compra.'));
        }))) : null);
  }

  function vistaEquipos() {
    const q = estado.filtro.toLowerCase();
    const equipos = DATOS.devices.equipos.filter((e) =>
      !q || (e.nombre + ' ' + e.marca + ' ' + e.nota + ' ' + e.plataforma).toLowerCase().indexOf(q) >= 0);
    const enInv = new Set(estado.inventario.map((i) => i.equipo));

    const cols = [
      { k: 'eq', l: 'Equipo', cell: (e) => h('div', null,
          h('b', null, e.nombre),
          h('div', { className: 'ld-mini' }, e.marca + ' · ' + e.plataforma + (e.confianza === 'verificado' ? '' : ' · ⚠ por confirmar')),
          h('div', { className: 'ld-mini' }, e.nota)) },
      { k: 'sensor', l: 'Sensor', cell: (e) => {
          const f = filaMatriz(e.id);
          const m = (f && f.nativo) || (f && f.web);
          return m && m.sensorLabel ? h('div', null, m.sensorLabel, h('div', { className: 'ld-mini' }, '±' + cm(m.errorA3m) + ' a 3 m')) : '—';
        } },
    ].concat(DATOS.modules.modulos.map((m) => ({
      k: m.id, l: m.icon, num: true,
      cell: (e) => h('span', { title: m.nombre + ': ' + ESTADO_LBL[estadoDe(e.id, m.id)] }, ESTADO_ICO[estadoDe(e.id, m.id)]),
    }))).concat([
      { k: 'add', l: '', cell: (e) => h('button', {
          className: 'ld-btn ld-mini-btn',
          onClick: () => (enInv.has(e.id) ? quitarEquipo(e.id) : agregarEquipo(e.id, e.nombre, 1)),
        }, enInv.has(e.id) ? 'Quitar' : 'Añadir') },
    ]);

    return h('div', null,
      card('📱 Qué puede cada equipo',
        h('div', null,
          h('p', null, 'Matriz calculada con el mismo motor que corre en el teléfono, suponiendo la app nativa instalada donde existe. Las columnas son los módulos.'),
          h('div', { className: 'ld-chips' }, DATOS.modules.modulos.map((m) => chip(m.icon + ' ' + m.nombre))),
          h('input', {
            className: 'ld-input', type: 'search', placeholder: 'Buscar equipo, marca, plataforma…',
            value: estado.filtro, onChange: (e) => commit({ filtro: e.target.value }),
          }))),
      card(null, tabla(cols, equipos, { key: (e) => e.id })));
  }

  function vistaNegocio(eco) {
    const S = [
      ['clientesKimos', 'Cuentas KIMOS', 'Cuántas cuentas activas se asumen en el horizonte del plan.'],
      ['usuariosPorCuenta', 'Usuarios de campo por cuenta', 'Multiplica los módulos con precio por usuario.'],
      ['costoSemanaUSD', 'Costo de una semana-persona (USD)', 'Costo cargado del equipo que construye.'],
      ['costoOperacionPct', 'Costo de operar (% del ingreso)', 'Soporte, infraestructura y cobranza. Sin esto el margen sale irreal.'],
      ['churnMensual', 'Baja mensual', 'Define la vida del cliente y con ella el LTV.'],
    ];

    const cols = [
      { k: 'mod', l: 'Módulo', cell: (f) => h('div', null, h('b', null, f.nombre), h('div', { className: 'ld-mini' }, 'Fase ' + f.fase + ' · ' + f.modelo)) },
      { k: 'ctas', l: 'Cuentas', num: true, cell: (f) => f.cuentas },
      { k: 'precio', l: 'Precio/cuenta', num: true, cell: (f) => usd(f.precioCuenta) },
      { k: 'ing', l: 'Ingreso/mes', num: true, cell: (f) => usd(f.ingresoMes) },
      { k: 'margen', l: 'Margen', num: true, cell: (f) => pct(f.margen) },
      { k: 'inv', l: 'Inversión', num: true, cell: (f) => usd(f.inversion) },
      { k: 'pb', l: 'Payback', num: true, cell: (f) => meses(f.paybackMeses) },
      { k: 'ret', l: 'Retorno año 1', num: true, cell: (f) => f.retornoAno1.toFixed(2) + '×' },
      { k: 'val', l: 'Valor cliente', num: true, cell: (f) => f.multiploValor.toFixed(1) + '×' },
      { k: 'ver', l: 'Veredicto', cell: (f) => h('span', { className: 'ld-ver-' + f.veredicto.nivel, title: f.veredicto.texto }, f.veredicto.texto) },
    ];

    return h('div', null,
      card('📈 La calculadora, no el informe',
        h('div', null,
          h('p', null, 'Todos los supuestos son editables y todo se recalcula al instante. Los valores de partida son ',
            h('b', null, 'estimaciones declaradas'), ', no ventas medidas: sirven para ordenar en qué orden construir, no para prometer una cifra.'),
          h('div', { className: 'ld-campos' }, S.map(([k, l, hint]) => campo(l, estado.sup[k], (v) => setSup(k, v), { hint: hint }))),
          h('div', { className: 'ld-kpis' },
            kpi('Ingreso mensual', usd(eco.total.ingresoMes), 'con toda la cartera construida'),
            kpi('Margen', pct(eco.total.margen), 'después de operar'),
            kpi('Inversión total', usd(eco.total.inversion), eco.total.esfuerzoSemanas + ' semanas-persona'),
            kpi('Payback', meses(eco.total.paybackMeses), 'de la cartera completa')))),

      card('Por fase — de aquí sale el orden de construcción',
        h('div', null,
          tabla([
            { k: 'f', l: 'Fase', cell: (p) => 'Fase ' + p.fase },
            { k: 'm', l: 'Módulos', num: true, cell: (p) => p.modulos },
            { k: 'e', l: 'Esfuerzo', num: true, cell: (p) => p.esfuerzoSemanas + ' sem' },
            { k: 'i', l: 'Inversión', num: true, cell: (p) => usd(p.inversion) },
            { k: 'a', l: 'ARR', num: true, cell: (p) => usd(p.arr) },
            { k: 'pb', l: 'Payback', num: true, cell: (p) => meses(p.paybackMeses) },
          ], eco.porFase, { key: (p) => p.fase }),
          h('p', { className: 'ld-hint' }, 'Si la fase 3 no se paga con estos supuestos, la conclusión no es "hagámosla igual": es que esos módulos solo se construyen cuando un cliente concreto los pague o cuando la cartera sea mayor.'))),

      card('Módulo por módulo', tabla(cols, eco.filas, { key: (f) => f.id })));
  }

  function vistaPlan(eco) {
    const fases = [
      { n: 0, titulo: 'Fase 0 · Que la app diga la verdad', meta: 'El diagnóstico es el producto mínimo: sin él, todo lo demás promete de más.' },
      { n: 1, titulo: 'Fase 1 · Lo que se paga solo', meta: 'Medir, escanear espacios y llevar productos al catálogo 3D. Es lo que se vende sin explicar.' },
      { n: 2, titulo: 'Fase 2 · Lo que multiplica lo anterior', meta: 'AR en la tienda, cubicaje y avance de obra: se apoyan en lo construido en la fase 1.' },
      { n: 3, titulo: 'Fase 3 · Solo con cliente que lo pague', meta: 'Gemelo digital, terreno, cuerpo y accesibilidad: valiosos, pero con payback largo en esta cartera.' },
    ];
    return h('div', null,
      card('🗺️ Plan por fases', h('p', null, 'Cada fase se cierra con algo que se puede vender y medir. El orden no es de gusto: sale de la calculadora de la pestaña Negocio.')),
      fases.map((f) => {
        const mods = DATOS.modules.modulos.filter((m) => m.fase === f.n);
        const p = eco.porFase.filter((x) => x.fase === f.n)[0];
        return card(f.titulo,
          h('div', null,
            h('p', null, f.meta),
            h('div', { className: 'ld-kpis' },
              kpi('Módulos', mods.length),
              kpi('Esfuerzo', (p ? p.esfuerzoSemanas : 0) + ' sem'),
              kpi('Inversión', usd(p ? p.inversion : 0)),
              kpi('Payback', meses(p ? p.paybackMeses : Infinity))),
            h('ul', { className: 'ld-lista' }, mods.map((m) => h('li', { key: m.id },
              h('b', null, m.icon + ' ' + m.nombre), ' — ', m.resumen,
              h('div', { className: 'ld-mini' }, 'Riesgo principal: ' + (m.riesgos || [])[0]))))),
          { key: 'f' + f.n });
      }));
  }

  function vistaLicencias() {
    const L = DATOS.licencias;
    const dep = L.bibliotecas.map((b) => ({ nombre: b.nombre, licencia: b.licencia, uso: b.uso }));
    const informe = auditar(dep, L);
    const clase = (v) => (v === 'usar' ? 'ld-ok' : v === 'prohibida' ? 'ld-no' : 'ld-cond');

    return h('div', null,
      card('⚖️ Qué puede entrar al producto',
        h('div', null,
          h('p', null, L.principio),
          h('div', { className: 'ld-kpis' },
            kpi('Dependencias de ejecución', '0', 'el núcleo no instala nada'),
            kpi('Bibliotecas evaluadas', L.bibliotecas.length),
            kpi('Descartadas', L.bibliotecas.filter((b) => b.veredicto === 'prohibida').length, 'por licencia incompatible'),
            kpi('Con condiciones', L.bibliotecas.filter((b) => b.veredicto === 'condicional').length, 'requieren revisión')))),

      card('Reglas de cadena de suministro',
        h('ul', { className: 'ld-lista' }, L.reglasCadenaSuministro.map((r, i) => h('li', { key: i }, r)))),

      card('Política de licencias',
        h('div', { className: 'ld-cols3' },
          h('div', null, h('h4', null, '✅ Permitidas'),
            h('ul', { className: 'ld-lista ld-mini' }, L.politica.permitidas.map((x) => h('li', { key: x.id }, h('b', null, x.id), ' — ' + x.nota)))),
          h('div', null, h('h4', null, '⚠️ Con condiciones'),
            h('ul', { className: 'ld-lista ld-mini' }, L.politica.condicionales.map((x) => h('li', { key: x.id }, h('b', null, x.id), ' — ' + x.condicion)))),
          h('div', null, h('h4', null, '⛔ Prohibidas'),
            h('ul', { className: 'ld-lista ld-mini' }, L.politica.prohibidas.map((x) => h('li', { key: x.id }, h('b', null, x.id), ' — ' + x.razon)))))),

      card('Bibliotecas evaluadas', tabla([
        { k: 'n', l: 'Biblioteca', cell: (b) => h('div', null, h('b', null, b.nombre), h('div', { className: 'ld-mini' }, b.uso)) },
        { k: 'l', l: 'Licencia', cell: (b) => b.licencia },
        { k: 'v', l: 'Veredicto', cell: (b) => h('span', { className: clase(b.veredicto) }, b.veredicto) },
        { k: 'nota', l: 'Nota', cell: (b) => h('span', { className: 'ld-mini' }, b.nota || '') },
      ], L.bibliotecas, { key: (b) => b.nombre }), { hint: informe.ok ? 'La auditoría automática no encontró bloqueos.' : 'Hay entradas que bloquean el despliegue: revísalas antes de publicar.' }),

      card('Fuentes de datos', tabla([
        { k: 'f', l: 'Fuente', cell: (d) => h('b', null, d.fuente) },
        { k: 'l', l: 'Licencia', cell: (d) => d.licencia },
        { k: 'v', l: 'Veredicto', cell: (d) => h('span', { className: clase(d.veredicto === 'usar' ? 'usar' : d.veredicto) }, d.veredicto) },
        { k: 'n', l: 'Nota', cell: (d) => h('span', { className: 'ld-mini' }, d.nota || '') },
      ], L.datos, { key: (d) => d.fuente })),

      card('Otros riesgos legales del dominio',
        h('ul', { className: 'ld-lista' }, L.otrosRiesgos.map((r, i) => h('li', { key: i },
          h('b', null, r.tema + ': '), r.riesgo, ' ', h('i', null, r.medida))))));
  }

  /* ------------------------------- componente ------------------------------- */

  function Component() {
    const [st, setSt] = React.useState(estado);
    React.useEffect(() => {
      oyentes.add(setSt);
      return () => { oyentes.delete(setSt); };
    }, []);

    const cob = React.useMemo(() => cobertura(st.inventario), [st.inventario]);
    const eco = React.useMemo(() => economiaCartera(DATOS.modules, st.sup), [st.sup]);

    const cuerpo = st.tab === 'modulos' ? vistaModulos(cob)
      : st.tab === 'inventario' ? vistaInventario(cob)
      : st.tab === 'equipos' ? vistaEquipos()
      : st.tab === 'negocio' ? vistaNegocio(eco)
      : st.tab === 'plan' ? vistaPlan(eco)
      : st.tab === 'licencias' ? vistaLicencias()
      : vistaPanel(cob, eco);

    return h('div', { className: 'kimos-lidaria' },
      h('header', { className: 'ld-head' },
        h('div', { className: 'ld-brand' },
          h('span', { className: 'ld-logo' }, '🛰️'),
          h('h1', null, 'LiDARia'),
          h('span', { className: 'ld-ver', title: 'LiDARia v' + APP_VERSION + ' · núcleo ' + DATOS.nucleo }, 'v' + APP_VERSION)),
        h('nav', { className: 'ld-tabs' }, TABS.map(([id, label, ico]) => h('button', {
          key: id, className: 'ld-tab' + (st.tab === id ? ' on' : ''),
          onClick: () => commit({ tab: id }),
        }, ico + ' ' + label))),
        h('div', { className: 'ld-tools' },
          h('span', { className: 'ld-mini' }, cob.resumen.completos + '/' + cob.resumen.total + ' módulos cubiertos'))),
      h('main', { className: 'ld-main' }, cuerpo));
  }

  /* --------------------------------- agente --------------------------------- */

  let desregistrar = null;
  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    desregistrar = shell.agent.register({
      label: 'LiDARia',
      description: 'Consola de captura 3D: qué puede escanear cada equipo, qué módulos quedan cubiertos con el parque de la organización, cuánto cuesta construir cada módulo y qué bibliotecas pueden entrar al producto.',
      tools: [
        {
          name: 'VER_PESTANA',
          description: 'Cambia de pestaña: ' + TABS.map((t) => t[0]).join(', ') + '.',
          inputSchema: { type: 'object', properties: { pestana: { type: 'string', enum: TABS.map((t) => t[0]) } }, required: ['pestana'] },
        },
        {
          name: 'AGREGAR_EQUIPO',
          description: 'Añade un equipo al inventario de la organización. Usa los ids del catálogo (getSnapshot los lista).',
          inputSchema: {
            type: 'object',
            properties: {
              equipo: { type: 'string' },
              etiqueta: { type: 'string', description: 'Nombre interno, p.ej. "iPad de terreno".' },
              cantidad: { type: 'number' },
            },
            required: ['equipo'],
          },
        },
        {
          name: 'QUITAR_EQUIPO',
          description: 'Quita un equipo del inventario.',
          inputSchema: { type: 'object', properties: { equipo: { type: 'string' } }, required: ['equipo'] },
        },
        {
          name: 'SET_SUPUESTO',
          description: 'Cambia un supuesto económico y recalcula: ' + Object.keys(SUPUESTOS_BASE).join(', ') + '. Los porcentajes van en fracción (0,18 = 18%).',
          inputSchema: {
            type: 'object',
            properties: { clave: { type: 'string', enum: Object.keys(SUPUESTOS_BASE) }, valor: { type: 'number' } },
            required: ['clave', 'valor'],
          },
        },
        {
          name: 'RECOMENDAR_EQUIPO',
          description: 'Dice qué equipo conviene sumar para cubrir un módulo que hoy no se cubre.',
          inputSchema: {
            type: 'object',
            properties: { modulo: { type: 'string', enum: DATOS.modules.modulos.map((m) => m.id) } },
            required: ['modulo'],
          },
        },
        {
          name: 'EVALUAR_LICENCIA',
          description: 'Evalúa si una licencia puede entrar al producto (acepta expresiones tipo "MIT OR Apache-2.0").',
          inputSchema: { type: 'object', properties: { licencia: { type: 'string' } }, required: ['licencia'] },
        },
      ],
      getSnapshot: () => {
        const cob = cobertura(estado.inventario);
        const eco = economiaCartera(DATOS.modules, estado.sup);
        return {
          version: APP_VERSION,
          nucleo: DATOS.nucleo,
          pestana: estado.tab,
          equipoActual: estado.diag && estado.diag.equipo ? estado.diag.equipo.nombre : null,
          nivelEquipoActual: estado.diag && estado.diag.nivel ? estado.diag.nivel.label : null,
          inventario: estado.inventario.map((i) => ({ equipo: i.equipo, etiqueta: i.etiqueta, cantidad: i.cantidad || 1 })),
          cobertura: cob.resumen,
          modulos: DATOS.modules.modulos.map((m) => ({
            id: m.id, nombre: m.nombre, fase: m.fase,
            estadoConInventario: cob.porModulo[m.id].estado,
            resumen: m.resumen,
          })),
          catalogoEquipos: DATOS.devices.equipos.map((e) => ({ id: e.id, nombre: e.nombre, clase: e.clase, confianza: e.confianza })),
          economia: {
            supuestos: estado.sup,
            ingresoMes: Math.round(eco.total.ingresoMes),
            margen: eco.total.margen,
            inversion: Math.round(eco.total.inversion),
            paybackMeses: eco.total.paybackMeses,
            porFase: eco.porFase.map((p) => ({ fase: p.fase, esfuerzoSemanas: p.esfuerzoSemanas, paybackMeses: p.paybackMeses })),
          },
          licencias: {
            prohibidas: DATOS.licencias.bibliotecas.filter((b) => b.veredicto === 'prohibida').map((b) => b.nombre),
            condicionales: DATOS.licencias.bibliotecas.filter((b) => b.veredicto === 'condicional').map((b) => b.nombre),
          },
        };
      },
      dispatchAction: async (accion) => {
        try {
          const t = accion && accion.type;
          const p = (accion && accion.payload) || {};
          if (t === 'VER_PESTANA') {
            if (!TABS.some((x) => x[0] === p.pestana)) return { success: false, error: 'Pestaña desconocida' };
            commit({ tab: p.pestana });
            return { success: true, message: 'Pestaña ' + p.pestana };
          }
          if (t === 'AGREGAR_EQUIPO') {
            const r = agregarEquipo(p.equipo, p.etiqueta, p.cantidad);
            return r.ok ? { success: true, message: r.mensaje } : { success: false, error: r.error };
          }
          if (t === 'QUITAR_EQUIPO') {
            const r = quitarEquipo(p.equipo);
            return r.ok ? { success: true, message: r.mensaje } : { success: false, error: r.error };
          }
          if (t === 'SET_SUPUESTO') {
            const r = setSup(p.clave, p.valor);
            return r.ok ? { success: true, message: r.mensaje } : { success: false, error: r.error };
          }
          if (t === 'RECOMENDAR_EQUIPO') {
            const m = moduloPorId(p.modulo);
            if (!m) return { success: false, error: 'Módulo desconocido: ' + p.modulo };
            const cob = cobertura(estado.inventario);
            if (cob.porModulo[m.id].estado === 'completo') {
              return { success: true, message: m.nombre + ' ya está cubierto por el inventario actual.' };
            }
            const rec = recomendarPara(m.id, estado.inventario);
            if (!rec.length) return { success: true, message: 'Ningún equipo del catálogo deja ' + m.nombre + ' completo: es trabajo de plataforma, no de compra.' };
            commit({ tab: 'modulos', moduloSel: m.id });
            return { success: true, message: 'Para ' + m.nombre + ': ' + rec.map((r) => r.equipo.nombre + ' (cubre ' + r.cubre + ' módulos)').join('; ') };
          }
          if (t === 'EVALUAR_LICENCIA') {
            const ev = evaluar(String(p.licencia || ''), DATOS.licencias);
            return { success: true, message: ev.expresion + ' → ' + ev.veredicto + (ev.nota ? '. ' + ev.nota : '') };
          }
          return { success: false, error: 'Acción no soportada: ' + t };
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  if (shell && shell.window && typeof shell.window.setTitle === 'function') {
    try { shell.window.setTitle('LiDARia'); } catch (e) { /* opcional */ }
  }

  restaurar();
  diagnosticarAqui();

  return {
    Component: Component,
    unmount() {
      if (timer) { clearTimeout(timer); timer = null; }
      oyentes.clear();
      if (typeof desregistrar === 'function') { try { desregistrar(); } catch (e) { /* ya desregistrado */ } }
    },
  };
}
