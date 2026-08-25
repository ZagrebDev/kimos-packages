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
