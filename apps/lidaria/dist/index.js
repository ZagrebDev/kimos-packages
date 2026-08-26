/* LiDARia 1.3.0 — bundle generado por apps/lidaria/build.mjs.
   No editar a mano: se regenera desde src/app.js + src/nucleo.js + src/payload.json. */

/* kimos-LiDARia · núcleo 1.3.0 — GENERADO, no editar.
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

  /* ---------------------------- visión ---------------------------- */
  {
    id: 'api.vision.ondevice', grupo: 'api', label: 'Inferencia de visión en el dispositivo', corto: 'Visión local',
    evidencia: 'nativo',
    desc: 'Detección de personas, objetos y equipo de protección corriendo en el propio equipo (Core ML en iOS, LiteRT/NNAPI en Android). Sin subir vídeo a ningún servidor.',
  },
  {
    id: 'api.vision.servidor', grupo: 'api', label: 'Inferencia de visión en servidor', corto: 'Visión servidor',
    evidencia: 'prueba',
    desc: 'El vídeo se analiza fuera del equipo. Es la vía para cámaras que no ejecutan código propio (drones, cámaras IP, tótems antiguos) y para modelos que no caben en un teléfono.',
  },
  {
    id: 'api.dji.msdk', grupo: 'api', label: 'DJI Mobile SDK (control y vídeo de dron)', corto: 'DJI MSDK',
    evidencia: 'nativo',
    desc: 'Control de vuelo, telemetría y vídeo desde una app propia. Solo Android y solo con aeronaves de la línea empresarial: los drones de consumo quedan fuera.',
  },

  /* --------------------------- captura base --------------------------- */
  { id: 'media.camera', grupo: 'media', label: 'Cámara', corto: 'Cámara', evidencia: 'prueba', desc: 'Acceso a cámara (getUserMedia o nativo). Sin esto no hay captura de ningún tipo.' },
  { id: 'media.multicam', grupo: 'media', label: 'Varias cámaras traseras', corto: 'Multicámara', evidencia: 'mixta', desc: 'Permite estéreo y cambio de focal durante el escaneo.' },
  { id: 'sensor.imu', grupo: 'media', label: 'Acelerómetro y giróscopo', corto: 'IMU', evidencia: 'prueba', desc: 'Seguimiento de la pose del equipo entre fotogramas. Es lo que da escala real a la fotogrametría.' },
  { id: 'sensor.gnss', grupo: 'media', label: 'GNSS / GPS', corto: 'GNSS', evidencia: 'prueba', desc: 'Georreferenciar la captura para cruzarla con nubes de puntos públicas.' },
  {
    id: 'sensor.thermal', grupo: 'media', label: 'Cámara térmica', corto: 'Térmica',
    evidencia: 'catalogo',
    desc: 'Mide temperatura radiométrica por píxel. NINGÚN teléfono la trae de fábrica: exige accesorio (FLIR One, Seek) o un equipo con sensor térmico (dron o cámara fija).',
  },
  {
    id: 'media.camera.remote', grupo: 'media', label: 'Cámara remota (dron, IP, tótem)', corto: 'Cámara remota',
    evidencia: 'catalogo',
    desc: 'La cámara no está en el equipo que corre la app: llega por vídeo. Cambia todo el diseño — hay latencia, no hay control de enfoque y la resolución la fija el emisor.',
  },
  {
    id: 'media.stream.rtmp', grupo: 'media', label: 'Recepción de vídeo en vivo (RTMP/RTSP/WebRTC)', corto: 'Vídeo en vivo',
    evidencia: 'prueba',
    desc: 'Ingesta de un flujo en vivo para analizarlo. Es la vía real con drones de consumo: emiten a un servidor y el análisis ocurre ahí.',
  },

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
  { id: 'runtime.servidor', grupo: 'runtime', label: 'Servidor de análisis', corto: 'Servidor', evidencia: 'nativo', desc: 'Proceso continuo que recibe vídeo y ejecuta los modelos. Es lo que sostiene drones, cámaras fijas y varias cámaras a la vez.' },

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

/**
 * Ninguna sonda puede colgar la app. Algunas APIs (adaptador de GPU, listado de
 * dispositivos) se quedan pendientes para siempre en ciertos navegadores y
 * modos sin GPU: si no responden a tiempo, se da por ausente la capacidad y se
 * sigue. Un diagnóstico incompleto es recuperable; una pantalla congelada, no.
 */
function conTiempo(promesa, ms, porDefecto) {
  return new Promise((resolver) => {
    let listo = false;
    const t = setTimeout(() => { if (!listo) { listo = true; resolver(porDefecto); } }, ms);
    Promise.resolve(promesa).then(
      (v) => { if (!listo) { listo = true; clearTimeout(t); resolver(v); } },
      () => { if (!listo) { listo = true; clearTimeout(t); resolver(porDefecto); } },
    );
  });
}

/** Prueba si una sesión WebXR de un tipo está soportada, sin lanzar. */
async function soportaSesion(xr, tipo) {
  if (!xr || typeof xr.isSessionSupported !== 'function') return false;
  try { return !!(await conTiempo(xr.isSessionSupported(tipo), 2500, false)); } catch (e) { return false; }
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
    const ds = await conTiempo(md.enumerateDevices(), 2500, []);
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
    const a = await conTiempo(nav.gpu.requestAdapter(), 2500, null);
    if (!a) return { disponible: false, adaptador: null };
    const info = (typeof a.requestAdapterInfo === 'function' ? await conTiempo(a.requestAdapterInfo(), 1500, {}) : a.info) || {};
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
    const alta = await conTiempo(uad.getHighEntropyValues(['model', 'platformVersion', 'architecture']), 2000, {});
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

/* ===== src/core/rubros.js ===== */
/**
 * rubros.js — la base de conocimiento por industria, y cómo se amplía.
 *
 * El motor de capacidades responde "qué puede este equipo". Este módulo responde
 * la pregunta siguiente, que es la que hace la venta: **"y para lo que YO hago,
 * ¿qué significa eso?"**. Un contratista y un museo tienen el mismo iPhone y
 * necesitan cosas distintas: distinta tolerancia, distinto flujo, distinto
 * entregable y distinto KPI.
 *
 * Lo importante no es el contenido que trae de fábrica: es que **crece sin tocar
 * código**. Un rubro nuevo —o la variante propia de un cliente— entra como un
 * *pack* JSON validado. Ese es el requisito de "ampliar su base de conocimiento
 * e implementaciones según el rubro y sus necesidades".
 */


/**
 * Contrato del pack de rubro, alineado con el Creator Pack de kimos-packages.
 * Se declara como `rubroPackApi: "1.x"` igual que las apps declaran
 * `appShellApi`: el cargador rechaza un desajuste MAYOR y tolera el menor.
 */
const RUBRO_PACK_API = '1.x';

/** Campos que todo rubro nuevo debe traer. Un rubro que `extiende` otro no. */
const CAMPOS_OBLIGATORIOS = ['id', 'nombre', 'cliente', 'dolor', 'tolerancia', 'modulos'];

/** Mismo criterio que el loader de apps del shell: solo importa el mayor. */
function apiCompatible(declarada) {
  const d = String(declarada == null ? RUBRO_PACK_API : declarada);
  const mayor = (v) => String(v).split('.')[0];
  return mayor(d) === mayor(RUBRO_PACK_API);
}

/**
 * Valida un pack antes de dejarlo entrar. Un pack malo no rompe la app: la
 * degrada en silencio, que es peor. Por eso esto es estricto y explícito.
 *
 * @param pack       { version, esquema, rubros: [...] }
 * @param catalogos  { modulos: Set|Array, equipos: Set|Array } ids válidos
 */
function validarPack(pack, catalogos) {
  const errores = [];
  const avisos = [];
  const cat = catalogos || {};
  const setDe = (x) => (x instanceof Set ? x : new Set(x || []));
  const modulos = setDe(cat.modulos);
  const equipos = setDe(cat.equipos);

  if (!pack || typeof pack !== 'object') return { ok: false, errores: ['El pack no es un objeto JSON.'], avisos, rubros: 0 };

  // Cabecera con las mismas convenciones que un .kapp: id con namespace,
  // versión semver, autor y contrato declarado.
  const declarada = pack.rubroPackApi != null ? pack.rubroPackApi : pack.esquema;
  if (!apiCompatible(declarada)) {
    errores.push('rubroPackApi "' + declarada + '" incompatible: esta versión lee ' + RUBRO_PACK_API + '.');
  }
  if (!pack.id) errores.push('El pack no declara id.');
  else if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(pack.id)) errores.push('El id del pack solo admite minúsculas, números, punto, guion y guion bajo.');
  else if (pack.id.indexOf('.') < 0) avisos.push('El id del pack no usa namespace (recomendado: tuorg.mi-pack) y podría chocar con otro.');
  if (!pack.version) errores.push('El pack no declara version.');
  else if (!/^\d+(\.\d+){0,2}([-.][0-9A-Za-z-]+)*$/.test(String(pack.version))) errores.push('La version del pack no es semver.');
  if (!pack.autor) avisos.push('El pack no declara autor: quien lo instale no sabrá de quién es.');
  if (!Array.isArray(pack.rubros) || !pack.rubros.length) {
    errores.push('El pack no trae rubros.');
    return { ok: false, errores, avisos, rubros: 0 };
  }

  const vistos = new Set();
  for (const r of pack.rubros) {
    const donde = 'rubro "' + ((r && r.id) || '¿sin id?') + '"';
    // Una extensión solo añade piezas a un rubro que ya existe: exigirle la
    // ficha completa obligaría a copiar el rubro entero para añadir un flujo.
    const esExtension = !!(r && r.extiende);
    if (!esExtension) {
      for (const campo of CAMPOS_OBLIGATORIOS) {
        if (r[campo] == null || (Array.isArray(r[campo]) && !r[campo].length)) errores.push(donde + ': falta ' + campo + '.');
      }
    } else if (!r.id) {
      errores.push(donde + ': una extensión necesita el id del rubro que extiende.');
    }
    if (r.id) {
      if (!/^[a-z0-9][a-z0-9.\-]*$/.test(r.id)) errores.push(donde + ': el id solo admite minúsculas, números, punto y guion.');
      if (vistos.has(r.id)) errores.push(donde + ': id repetido dentro del pack.');
      vistos.add(r.id);
    }
    const t = r.tolerancia;
    if (t && (!(t.m > 0) || !(t.aDistancia > 0))) errores.push(donde + ': la tolerancia necesita m y aDistancia mayores que cero.');
    for (const m of r.modulos || []) {
      if (!m || !m.id) { errores.push(donde + ': un módulo sin id.'); continue; }
      if (modulos.size && !modulos.has(m.id)) errores.push(donde + ': el módulo "' + m.id + '" no existe en el catálogo.');
      if (!m.para) avisos.push(donde + ': el módulo "' + m.id + '" no dice para qué sirve en este rubro.');
    }
    for (const e of r.equiposRecomendados || []) {
      if (equipos.size && !equipos.has(e)) errores.push(donde + ': el equipo recomendado "' + e + '" no existe en el catálogo.');
    }
    if (!esExtension) {
      if (!r.flujos || !r.flujos.length) avisos.push(donde + ': sin flujos, el rubro no dice cómo se trabaja.');
      if (!r.kpis || !r.kpis.length) avisos.push(donde + ': sin KPI, no hay forma de saber si sirvió.');
      if (!r.prospeccion) avisos.push(donde + ': sin material de prospección, no ayuda a vender.');
    }
  }

  return { ok: !errores.length, errores, avisos, rubros: pack.rubros.length };
}

/**
 * Carga el catálogo base y le suma packs externos.
 *
 * Reglas de convivencia, pensadas para que un pack de un cliente no pueda
 * romper lo que trae el producto:
 *  - Un pack solo puede AÑADIR rubros o EXTENDER uno existente (`extiende`).
 *  - No puede borrar nada.
 *  - Cada rubro queda marcado con su `origen`, y eso se ve en pantalla.
 */
function cargarPacks(base, packs, catalogos) {
  const rubros = [];
  const errores = [];
  const avisos = [];
  const origenes = [{ id: 'base', nombre: 'Catálogo del producto', rubros: (base.rubros || []).length, version: base.version }];

  for (const r of base.rubros || []) rubros.push(Object.assign({}, r, { origen: 'base' }));

  for (const pack of packs || []) {
    const idPack = pack.id || pack.nombre || 'pack-sin-id';
    const v = validarPack(pack, catalogos);
    v.errores.forEach((e) => errores.push(idPack + ': ' + e));
    v.avisos.forEach((a) => avisos.push(idPack + ': ' + a));
    if (!v.ok) continue;

    let añadidos = 0;
    for (const r of pack.rubros) {
      const i = rubros.findIndex((x) => x.id === r.id);
      if (i >= 0) {
        if (r.extiende) {
          // Extender fusiona listas y pisa textos: sirve para que un cliente
          // añada su flujo o su guion sin perder lo que trae el producto.
          const previo = rubros[i];
          rubros[i] = Object.assign({}, previo, r, {
            origen: previo.origen + ' + ' + idPack,
            modulos: fusionarPorId(previo.modulos, r.modulos),
            flujos: fusionarPorId(previo.flujos, r.flujos),
            kpis: fusionarPorId(previo.kpis, r.kpis),
            normativa: (previo.normativa || []).concat(r.normativa || []),
            equiposRecomendados: unicos((previo.equiposRecomendados || []).concat(r.equiposRecomendados || [])),
            kimos: unicos((previo.kimos || []).concat(r.kimos || [])),
          });
          añadidos++;
        } else {
          errores.push(idPack + ': el rubro "' + r.id + '" ya existe. Usa otro id (con tu prefijo) o declara extiende: true.');
        }
      } else {
        rubros.push(Object.assign({}, r, { origen: idPack }));
        añadidos++;
      }
    }
    origenes.push({ id: idPack, nombre: pack.nombre || idPack, rubros: añadidos, version: pack.version || null });
  }

  return { rubros, origenes, errores, avisos };
}

const unicos = (a) => [...new Set(a)];

function fusionarPorId(previos, nuevos) {
  const out = (previos || []).slice();
  for (const n of nuevos || []) {
    const i = out.findIndex((x) => x.id === n.id);
    if (i >= 0) out[i] = Object.assign({}, out[i], n);
    else out.push(n);
  }
  return out;
}

/**
 * ¿El sensor activo alcanza la tolerancia que exige el rubro?
 * Es el cruce que convierte una ficha de industria en una decisión de compra.
 */
function cumpleTolerancia(sensorId, tolerancia) {
  if (!tolerancia || !(tolerancia.m > 0)) return { cumple: null, motivo: 'El rubro no declara tolerancia.' };
  if (!sensorId) return { cumple: false, error: null, motivo: 'Sin sensor de profundidad activo no hay medida con escala fiable.' };
  const err = errorEsperado(sensorId, tolerancia.aDistancia);
  const rango = (PERFIL_SENSOR[sensorId] || {}).rango;
  const fueraDeRango = !!(rango && tolerancia.aDistancia > rango[1]);
  const cumple = !fueraDeRango && err <= tolerancia.m;

  // Un "sí" pelado engaña cuando el error esperado es exactamente la tolerancia:
  // en terreno, con el pulso del operador y una superficie mala, ese caso falla.
  // Por eso hay tres grados y no dos: holgado, justo e insuficiente.
  const margen = !cumple ? 'insuficiente' : (err <= tolerancia.m * 0.6 ? 'holgado' : 'justo');
  const cm = (m) => (m * 100).toFixed(1) + ' cm';

  const motivo = fueraDeRango
    ? 'La distancia de trabajo del rubro (' + tolerancia.aDistancia + ' m) supera el rango útil del sensor.'
    : margen === 'holgado'
      ? 'El error esperado (±' + cm(err) + ') cabe con margen en la tolerancia del rubro (±' + cm(tolerancia.m) + ').'
      : margen === 'justo'
        ? 'El error esperado (±' + cm(err) + ') cabe JUSTO en la tolerancia del rubro (±' + cm(tolerancia.m) + '): en terreno, sin margen para una superficie mala o un pulso poco firme.'
        : 'El error esperado (±' + cm(err) + ') supera la tolerancia del rubro (±' + cm(tolerancia.m) + ').';

  return {
    cumple,
    margen,
    error: err,
    exigido: tolerancia.m,
    aDistancia: tolerancia.aDistancia,
    holgura: tolerancia.m - err,
    fueraDeRango,
    motivo,
  };
}

/**
 * Plan de implementación para un rubro con los medios que hay.
 *
 * @param rubro    entrada del catálogo
 * @param ctx      { estadoModulo(id) -> estado, sensorId, modulos (catálogo), equipos (catálogo), inventario? }
 */
function planDeRubro(rubro, ctx) {
  const c = ctx || {};
  const estadoDe = typeof c.estadoModulo === 'function' ? c.estadoModulo : () => 'no-disponible';
  const catModulos = new Map(((c.modulos && c.modulos.modulos) || []).map((m) => [m.id, m]));
  const catEquipos = new Map(((c.equipos && c.equipos.equipos) || []).map((e) => [e.id, e]));

  const tolerancia = cumpleTolerancia(c.sensorId, rubro.tolerancia);

  const modulos = (rubro.modulos || [])
    .slice()
    .sort((a, b) => (a.prioridad || 9) - (b.prioridad || 9))
    .map((m) => {
      const meta = catModulos.get(m.id) || {};
      const estado = estadoDe(m.id);
      return {
        id: m.id,
        nombre: meta.nombre || m.id,
        icon: meta.icon || '•',
        prioridad: m.prioridad || 9,
        para: m.para || meta.resumen || '',
        estado,
        listo: estado === 'completo',
      };
    });

  const brechas = modulos.filter((m) => !m.listo);
  const listoParaEmpezar = modulos.length > 0 && modulos[0].listo && tolerancia.cumple !== false;

  const acciones = [];
  if (tolerancia.cumple === false) {
    const rec = (rubro.equiposRecomendados || []).map((id) => (catEquipos.get(id) || {}).nombre).filter(Boolean);
    acciones.push('La tolerancia de este rubro no se alcanza con el sensor actual. ' + tolerancia.motivo
      + (rec.length ? ' Equipos que sí la alcanzan: ' + rec.join(', ') + '.' : ''));
  } else if (tolerancia.margen === 'justo') {
    acciones.push('Se cumple justo: ' + tolerancia.motivo
      + (rubro.toleranciaNota ? ' ' + rubro.toleranciaNota : ''));
  }
  for (const m of brechas.slice(0, 3)) {
    acciones.push('Módulo "' + m.nombre + '" (prioridad ' + m.prioridad + ') está en estado "' + m.estado + '": ' + m.para);
  }
  if (listoParaEmpezar) {
    const f = (rubro.flujos || [])[0];
    acciones.push('Se puede empezar hoy por el flujo "' + (f ? f.nombre : modulos[0].nombre) + '".');
  }

  return {
    rubro: { id: rubro.id, nombre: rubro.nombre, icon: rubro.icon, origen: rubro.origen || 'base' },
    cliente: rubro.cliente,
    dolor: rubro.dolor,
    tolerancia,
    toleranciaNota: rubro.toleranciaNota || null,
    modulos,
    brechas: brechas.map((m) => m.id),
    listoParaEmpezar,
    flujos: rubro.flujos || [],
    kpis: rubro.kpis || [],
    normativa: rubro.normativa || [],
    equiposRecomendados: (rubro.equiposRecomendados || []).map((id) => {
      const e = catEquipos.get(id);
      return e ? { id: e.id, nombre: e.nombre, clase: e.clase } : { id, nombre: id };
    }),
    kimos: rubro.kimos || [],
    acciones,
  };
}

/** Rubros ordenados por lo cerca que están de poder ejecutarse con estos medios. */
function rubrosViables(rubros, ctx) {
  return (rubros || [])
    .map((r) => {
      const p = planDeRubro(r, ctx);
      const listos = p.modulos.filter((m) => m.listo).length;
      const puntaje = (p.tolerancia.cumple === true ? 50 : p.tolerancia.cumple === null ? 25 : 0)
        + (p.modulos.length ? (listos / p.modulos.length) * 50 : 0);
      return { plan: p, listos, total: p.modulos.length, puntaje: Math.round(puntaje) };
    })
    .sort((a, b) => b.puntaje - a.puntaje);
}

/** Qué rubros usan un módulo dado (para justificar su construcción). */
function rubrosPorModulo(rubros, moduloId) {
  return (rubros || [])
    .filter((r) => (r.modulos || []).some((m) => m.id === moduloId))
    .map((r) => ({ id: r.id, nombre: r.nombre, icon: r.icon, prioridad: (r.modulos.find((m) => m.id === moduloId) || {}).prioridad || 9 }))
    .sort((a, b) => a.prioridad - b.prioridad);
}

/**
 * Lee un `.krub` (el pack empaquetado) y devuelve su `pack.json`.
 *
 * El empaquetador escribe con método "store" —igual que `tools/pack.mjs` de
 * kimos-packages con los `.kapp`—, así que leerlo no necesita ninguna
 * biblioteca de descompresión. Si alguien recomprime el archivo por su cuenta,
 * se dice en vez de fallar con un error incomprensible.
 *
 * @param buffer ArrayBuffer del archivo
 */
function leerKrub(buffer) {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const texto = new TextDecoder();

  // Fin del directorio central: se busca desde el final (puede haber comentario).
  let fin = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('No parece un archivo .krub válido.');

  const n = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Directorio del .krub ilegible.');
    const metodo = dv.getUint16(p + 10, true);
    const tam = dv.getUint32(p + 20, true);
    const largoNombre = dv.getUint16(p + 28, true);
    const largoExtra = dv.getUint16(p + 30, true);
    const largoComentario = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const nombre = texto.decode(bytes.subarray(p + 46, p + 46 + largoNombre));
    if (nombre === 'pack.json') {
      if (metodo !== 0) throw new Error('El .krub viene comprimido; este lector solo abre los que genera tools/pack-rubro.mjs.');
      const ln = dv.getUint16(offset + 26, true);
      const le = dv.getUint16(offset + 28, true);
      const inicio = offset + 30 + ln + le;
      return JSON.parse(texto.decode(bytes.subarray(inicio, inicio + tam)));
    }
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  throw new Error('El .krub no contiene pack.json.');
}

/* ===== src/core/prospeccion.js ===== */
/**
 * prospeccion.js — LiDARia como herramienta comercial, no solo como producto.
 *
 * La idea que vale la pena defender: **el diagnóstico es un dato de calificación
 * que ningún CRM tiene hoy**. Saber que los ocho vendedores de un prospecto usan
 * Android de gama media cambia lo que se le puede ofrecer, cuánto va a pagar y
 * qué demostración conviene hacerle. Eso hoy se descubre en la tercera reunión,
 * cuando ya se prometió algo que no se puede cumplir.
 *
 * Y la segunda: **el escaneo es la demostración**. En una primera visita se
 * escanea el propio local del prospecto y se le muestra su espacio medido antes
 * de que se enfríe el café. No hay lámina que compita con eso.
 *
 * Este módulo produce lo que se adjunta a la oportunidad en Prospección
 * Comercial: qué venderle, con qué argumento, qué demostrar y qué preguntar.
 */


const cifra = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

/**
 * Califica un prospecto cruzando su rubro, su parque de equipos y las apps de
 * KIMOS que ya usa. Devuelve puntaje con motivos: un puntaje sin motivos no
 * sirve para conversar con nadie.
 */
function calificar(prospecto, ctx) {
  const p = prospecto || {};
  const c = ctx || {};
  const motivos = [];
  let puntaje = 0;

  // 1. Encaje de rubro (30): sin rubro conocido, se vende a ciegas.
  const rubro = c.rubro || null;
  if (rubro) { puntaje += 30; motivos.push({ signo: '+', peso: 30, texto: 'Rubro reconocido: ' + rubro.nombre + '. Hay flujo, tolerancia y KPI definidos.' }); }
  else motivos.push({ signo: '−', peso: 30, texto: 'Rubro sin pack de conocimiento: la propuesta sale genérica. Considera crear un pack para este rubro.' });

  // 2. Parque de equipos (35): es el dato que nadie más tiene.
  const capaces = (p.equipos || []).filter((e) => c.equipoSirve ? c.equipoSirve(e) : false);
  if (capaces.length) {
    puntaje += 35;
    motivos.push({ signo: '+', peso: 35, texto: 'Ya tiene equipos capaces de capturar (' + capaces.join(', ') + '): se puede empezar sin comprar nada.' });
  } else if ((p.equipos || []).length) {
    puntaje += 12;
    motivos.push({ signo: '~', peso: 12, texto: 'Tiene equipos, pero ninguno alcanza lo que su rubro exige: la venta incluye una compra o un equipo compartido.' });
  } else {
    motivos.push({ signo: '−', peso: 35, texto: 'No sabemos qué equipos tiene. Es la primera pregunta de la reunión, y define todo lo demás.' });
  }

  // 3. Apps de KIMOS que ya usa (25): el CAC ya está pagado.
  const integrables = (p.appsKimos || []).filter((a) => (c.appsAncla || []).indexOf(a) >= 0);
  if (integrables.length) {
    puntaje += 25;
    motivos.push({ signo: '+', peso: 25, texto: 'Ya usa ' + integrables.join(', ') + ': la captura entra donde ya trabaja, no como herramienta suelta.' });
  } else if ((p.appsKimos || []).length) {
    puntaje += 10;
    motivos.push({ signo: '~', peso: 10, texto: 'Es cliente de KIMOS, pero no de los módulos con los que LiDARia se integra mejor.' });
  } else {
    motivos.push({ signo: '−', peso: 25, texto: 'No es cliente de KIMOS todavía: la venta es de la suite, no de un módulo.' });
  }

  // 4. Tamaño (10): sin volumen, ningún módulo se paga.
  const usuarios = cifra(p.usuariosCampo, 0);
  if (usuarios >= 3) { puntaje += 10; motivos.push({ signo: '+', peso: 10, texto: usuarios + ' personas en terreno: hay volumen para que el módulo se pague.' }); }
  else motivos.push({ signo: '−', peso: 10, texto: 'Menos de tres personas en terreno: el retorno depende de que el ahorro por visita sea alto.' });

  const nivel = puntaje >= 70 ? 'caliente' : puntaje >= 45 ? 'tibio' : 'frío';
  return { puntaje, nivel, motivos };
}

/**
 * Qué se le puede vender HOY a este prospecto y qué exige comprar equipo.
 * Se apoya en la prioridad que el rubro le da a cada módulo.
 */
function queVenderle(rubro, ctx) {
  const c = ctx || {};
  const plan = planDeRubro(rubro, c);
  const catModulos = new Map(((c.modulos && c.modulos.modulos) || []).map((m) => [m.id, m]));

  const clasificar = (m) => {
    if (m.estado === 'completo') return 'hoy';
    if (m.estado === 'degradado') return 'hoy-con-limites';
    if (m.estado === 'potencial') return 'hoy-con-app';
    return 'requiere-equipo';
  };

  const items = plan.modulos.map((m) => {
    const meta = catModulos.get(m.id) || {};
    const n = meta.negocio || {};
    return {
      id: m.id, nombre: m.nombre, icon: m.icon, prioridad: m.prioridad, para: m.para,
      cuando: clasificar(m),
      precioMensual: cifra(n.precioMensualUSD, 0),
      modelo: n.modelo || null,
      valorMensualCliente: cifra(n.valorClienteUSD, 0),
    };
  });

  return { plan, items };
}

/**
 * Argumento cuantificado. No inventa: suma el beneficio mensual declarado de los
 * módulos que el rubro pone primero y lo contrasta con lo que costaría. La
 * fórmula específica del rubro se entrega como texto para completarla con los
 * números del propio prospecto en la reunión.
 */
function argumentoEconomico(rubro, venta, prospecto) {
  const p = prospecto || {};
  const usuarios = Math.max(1, cifra(p.usuariosCampo, 1));
  const vendibles = venta.items.filter((i) => i.cuando !== 'requiere-equipo');

  const costoMensual = vendibles.reduce((a, i) => a + i.precioMensual * (i.modelo === 'por-usuario' ? usuarios : 1), 0);
  const beneficioMensual = vendibles.reduce((a, i) => a + i.valorMensualCliente, 0);
  const multiplo = costoMensual > 0 ? beneficioMensual / costoMensual : 0;

  return {
    costoMensual,
    beneficioMensual,
    beneficioAnual: beneficioMensual * 12,
    multiplo,
    supuesto: (rubro.prospeccion && rubro.prospeccion.ahorro && rubro.prospeccion.ahorro.supuesto) || null,
    formula: (rubro.prospeccion && rubro.prospeccion.ahorro && rubro.prospeccion.ahorro.formula) || null,
    advertencia: 'El beneficio es la estimación declarada del catálogo para una cuenta tipo del rubro, no una medición de este prospecto. En la reunión se reemplaza por sus números con la fórmula de arriba.',
  };
}

/**
 * Ficha completa de prospecto: lo que se lleva a la reunión y lo que queda
 * adjunto en la oportunidad del CRM.
 */
function fichaProspecto(prospecto, ctx) {
  const c = ctx || {};
  const rubro = c.rubro;
  if (!rubro) {
    return {
      error: 'Sin rubro no hay ficha útil. Elige el rubro del prospecto o carga un pack para su industria.',
      calificacion: calificar(prospecto, c),
    };
  }

  const venta = queVenderle(rubro, c);
  const economia = argumentoEconomico(rubro, venta, prospecto);
  const calificacion = calificar(prospecto, c);
  const pros = rubro.prospeccion || {};

  const tolerancia = venta.plan.tolerancia;
  const advertencias = [];
  if (tolerancia.cumple === false) {
    advertencias.push('No prometer precisión de este rubro con el parque actual del prospecto: ' + tolerancia.motivo);
  }
  (rubro.normativa || []).forEach((n) => advertencias.push(n));

  return {
    generado: new Date().toISOString(),
    prospecto: {
      nombre: prospecto.nombre || null,
      rubro: rubro.id,
      usuariosCampo: cifra(prospecto.usuariosCampo, null),
      equipos: prospecto.equipos || [],
      appsKimos: prospecto.appsKimos || [],
    },
    calificacion,
    demo: pros.demo || null,
    preguntas: pros.preguntas || [],
    senales: pros.senales || [],
    objeciones: pros.objeciones || [],
    venderHoy: venta.items.filter((i) => i.cuando === 'hoy' || i.cuando === 'hoy-con-app'),
    venderConLimites: venta.items.filter((i) => i.cuando === 'hoy-con-limites'),
    requiereEquipo: venta.items.filter((i) => i.cuando === 'requiere-equipo'),
    equiposSugeridos: venta.plan.equiposRecomendados,
    economia,
    kpis: rubro.kpis || [],
    flujoInicial: (rubro.flujos || [])[0] || null,
    advertencias,
    siguientePaso: siguientePaso(calificacion, venta),
  };
}

function siguientePaso(calificacion, venta) {
  const hoy = venta.items.filter((i) => i.cuando === 'hoy' || i.cuando === 'hoy-con-app');
  if (calificacion.nivel === 'frío') return 'Antes de proponer nada: averiguar qué equipos usan en terreno y qué módulos de KIMOS ya tienen. Sin eso, cualquier propuesta es adivinanza.';
  if (!hoy.length) return 'Proponer una prueba con un equipo prestado o comprado para el piloto: hoy su parque no sostiene el módulo principal del rubro.';
  return 'Agendar la visita con el equipo capaz, escanear su propio espacio en la reunión y dejar el resultado adjunto a la oportunidad.';
}

/**
 * El registro que se adjunta a la oportunidad en Prospección Comercial.
 *
 * Es deliberadamente plano y corto: viaja por el agente o como adjunto, y tiene
 * que poder leerse en la ficha del prospecto sin abrir LiDARia.
 */
function registroParaCRM(ficha) {
  if (!ficha || ficha.error) return null;
  return {
    fuente: 'kimos-LiDARia',
    fecha: ficha.generado,
    rubro: ficha.prospecto.rubro,
    calificacion: ficha.calificacion.puntaje,
    nivel: ficha.calificacion.nivel,
    parqueCapaz: ficha.venderHoy.length > 0,
    moduloPrincipal: (ficha.venderHoy[0] || ficha.venderConLimites[0] || ficha.requiereEquipo[0] || {}).nombre || null,
    propuestaMensualUSD: Math.round(ficha.economia.costoMensual),
    beneficioEstimadoMensualUSD: Math.round(ficha.economia.beneficioMensual),
    multiploValor: Number(ficha.economia.multiplo.toFixed(1)),
    siguientePaso: ficha.siguientePaso,
    advertencias: ficha.advertencias,
  };
}

/** Guion de la visita: el orden en que conviene hacer las cosas en la reunión. */
function guionVisita(rubro, ficha) {
  const pros = rubro.prospeccion || {};
  return [
    { momento: 'Antes de entrar', hacer: 'Confirmar qué equipos tienen en terreno. Es lo que decide qué se puede prometer.' },
    { momento: 'Primeros 5 minutos', hacer: 'Preguntar, no presentar: ' + (pros.preguntas || []).slice(0, 2).join(' / ') },
    { momento: 'La demostración', hacer: pros.demo || 'Escanear el propio espacio del prospecto y mostrar el resultado en su teléfono.' },
    { momento: 'El número', hacer: ficha && ficha.economia && ficha.economia.supuesto ? 'Calcular con sus datos: ' + ficha.economia.supuesto : 'Calcular el ahorro con sus propios números, delante de ellos.' },
    { momento: 'Las objeciones', hacer: (pros.objeciones || []).map((o) => o.objecion).join(' · ') || 'Escuchar la objeción real antes de responder.' },
    { momento: 'Al salir', hacer: 'Dejar el escaneo de la reunión adjunto a la oportunidad, con la propuesta y el siguiente paso.' },
  ];
}

/* ===== src/core/integraciones.js ===== */
/**
 * integraciones.js — qué se puede conectar de verdad con el resto de KIMOS.
 *
 * El criterio de este módulo es incómodo a propósito: separa lo que se puede
 * construir HOY con el contrato AppShell v1 de lo que necesita que la
 * plataforma crezca, y marca como "marginal" o "no" lo que quedaría bien en una
 * lámina y no resuelve nada que alguien pague. Una lista de integraciones donde
 * todo es verde no informa: solo tranquiliza.
 */

const ORDEN_VEREDICTO = { ancla: 0, util: 1, marginal: 2, no: 3 };
const ORDEN_DISPONIBILIDAD = { hoy: 0, agente: 1, 'requiere-plataforma': 2, 'no-aplica': 3 };

/** Resuelve un id de app admitiendo alias ('escritorio' → 'agentes'). */
function integracionDe(catalogo, appId) {
  const lista = (catalogo && catalogo.integraciones) || [];
  return lista.filter((i) => i.app === appId || (i.alias || []).indexOf(appId) >= 0)[0] || null;
}

/** Todas las integraciones ordenadas por veredicto y luego por valor. */
function ordenadas(catalogo) {
  return ((catalogo && catalogo.integraciones) || []).slice().sort((a, b) =>
    (ORDEN_VEREDICTO[a.veredicto] - ORDEN_VEREDICTO[b.veredicto])
    || (ORDEN_DISPONIBILIDAD[a.disponibilidad] - ORDEN_DISPONIBILIDAD[b.disponibilidad])
    || (b.valor - a.valor));
}

/** Resumen para decidir: cuánto cuesta lo que de verdad hay que construir. */
function resumen(catalogo) {
  const lista = (catalogo && catalogo.integraciones) || [];
  const por = (campo) => lista.reduce((a, i) => { a[i[campo]] = (a[i[campo]] || 0) + 1; return a; }, {});
  const construibles = lista.filter((i) => i.veredicto === 'ancla' || i.veredicto === 'util');
  const anclas = lista.filter((i) => i.veredicto === 'ancla');
  return {
    total: lista.length,
    porVeredicto: por('veredicto'),
    porDisponibilidad: por('disponibilidad'),
    esfuerzoAnclas: anclas.reduce((a, i) => a + (i.esfuerzoSemanas || 0), 0),
    esfuerzoConstruibles: construibles.reduce((a, i) => a + (i.esfuerzoSemanas || 0), 0),
    esfuerzoDescartado: lista.filter((i) => i.veredicto === 'marginal' || i.veredicto === 'no')
      .reduce((a, i) => a + (i.esfuerzoSemanas || 0), 0),
    disponiblesHoy: lista.filter((i) => i.disponibilidad === 'hoy' || i.disponibilidad === 'agente').length,
  };
}

/**
 * Las integraciones que exige un módulo o un rubro concretos: sirve para saber
 * qué hay que conectar ANTES de que ese módulo tenga sentido.
 */
function integracionesDe(catalogo, ids) {
  return (ids || [])
    .map((id) => integracionDe(catalogo, id))
    .filter(Boolean)
    .sort((a, b) => ORDEN_VEREDICTO[a.veredicto] - ORDEN_VEREDICTO[b.veredicto]);
}

/**
 * Ruta de conexión recomendada: primero lo que se puede hoy y vale mucho.
 * Devuelve tres tramos, no una lista plana, porque el orden es la decisión.
 */
function rutaDeConexion(catalogo) {
  const lista = ordenadas(catalogo).filter((i) => i.veredicto === 'ancla' || i.veredicto === 'util');
  const tramo = (filtro) => lista.filter(filtro).map((i) => ({
    app: i.app, nombre: i.nombre, icon: i.icon, valor: i.valor,
    esfuerzoSemanas: i.esfuerzoSemanas, disponibilidad: i.disponibilidad, porque: i.porque,
  }));
  return [
    {
      tramo: 1,
      titulo: 'Se conecta hoy y cambia el producto',
      criterio: 'Anclas que funcionan con el contrato actual, incluido el puente por agente.',
      items: tramo((i) => i.veredicto === 'ancla' && i.disponibilidad !== 'requiere-plataforma'),
    },
    {
      tramo: 2,
      titulo: 'Se conecta hoy y suma',
      criterio: 'Útiles sin cambios de plataforma: se hacen cuando el tramo 1 está vendiendo.',
      items: tramo((i) => i.veredicto === 'util' && i.disponibilidad !== 'requiere-plataforma'),
    },
    {
      tramo: 3,
      titulo: 'Espera a que la plataforma crezca',
      criterio: 'Necesitan escritura entre apps, suscripción a cambios o módulo backend propio.',
      items: tramo((i) => i.disponibilidad === 'requiere-plataforma'),
    },
  ];
}

/**
 * Coherencia: toda app referida desde los catálogos de módulos y rubros tiene
 * que existir aquí. Si no, hay una integración prometida que nadie evaluó.
 */
function verificarCoherencia(catalogo, modules, rubros) {
  const usados = new Set();
  ((modules && modules.modulos) || []).forEach((m) => (m.kimos || []).forEach((k) => usados.add(k)));
  ((rubros && rubros.rubros) || rubros || []).forEach((r) => (r.kimos || []).forEach((k) => usados.add(k)));
  const faltantes = [...usados].filter((id) => !integracionDe(catalogo, id));
  return { ok: !faltantes.length, faltantes, usados: [...usados] };
}

/* ===== src/core/vision.js ===== */
/**
 * vision.js — qué se puede reconocer, desde qué cámara y a qué distancia.
 *
 * Este módulo existe para evitar la promesa más fácil y más dañina de todo el
 * proyecto: *"la app detecta si el trabajador lleva guantes"*. Depende. Depende
 * de la resolución de la cámara, del ángulo, de la distancia y del tamaño real
 * del objeto, y esa dependencia es GEOMETRÍA, no opinión:
 *
 *     píxeles aparentes = altura_real · resolución_vertical
 *                         ────────────────────────────────
 *                            2 · distancia · tan(fov/2)
 *
 * Si esos píxeles no llegan al mínimo que necesita un detector, no hay modelo
 * que lo arregle. De ahí sale la regla que hace confiable al módulo de EPP:
 * **lo que está fuera de alcance se informa como "no evaluable", nunca como
 * incumplimiento**. Un sistema que acusa a alguien de no llevar guantes cuando
 * no podía verle las manos se apaga a la semana.
 */

const rad = (grados) => (grados * Math.PI) / 180;

/** Píxeles que ocupa un metro a `distancia` metros en esta cámara. */
function pxPorMetro(resolucionV, fovVDeg, distanciaM) {
  const d = Number(distanciaM);
  if (!(d > 0) || !(resolucionV > 0) || !(fovVDeg > 0) || fovVDeg >= 180) return 0;
  return resolucionV / (2 * d * Math.tan(rad(fovVDeg) / 2));
}

/** Altura aparente, en píxeles, de un objeto de `alturaM` a `distanciaM`. */
function pxAparentes(alturaM, fuente, distanciaM) {
  return alturaM * pxPorMetro(fuente.resolucionV, fuente.fovVDeg, distanciaM);
}

/** Distancia máxima a la que un implemento sigue siendo reconocible. */
function distanciaMaxima(epp, fuente) {
  if (!epp || !fuente) return 0;
  const t = Math.tan(rad(fuente.fovVDeg) / 2);
  if (!(t > 0) || !(epp.pxMinimos > 0)) return 0;
  return (epp.alturaM * fuente.resolucionV) / (2 * epp.pxMinimos * t);
}

const buscar = (lista, id) => (lista || []).filter((x) => x.id === id)[0] || null;

const eppPorId = (catalogo, id) => buscar(catalogo.epp, id);
const fuentePorId = (catalogo, id) => buscar(catalogo.fuentes, id);
const modeloPorId = (catalogo, id) => buscar(catalogo.modelos, id);

/**
 * Alcance de una fuente de cámara: hasta dónde sirve para cada implemento.
 * Es la tabla que hay que enseñar antes de vender el módulo, no después.
 */
function alcanceDeFuente(catalogo, fuenteId) {
  const fuente = fuentePorId(catalogo, fuenteId);
  if (!fuente) return null;
  const items = (catalogo.epp || []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    icon: e.icon,
    dificultad: e.dificultad,
    distanciaMaxM: distanciaMaxima(e, fuente),
  })).sort((a, b) => b.distanciaMaxM - a.distanciaMaxM);
  return { fuente, items };
}

/** Reglas de EPP de un rubro, resueltas contra el catálogo. */
function reglasDeRubro(catalogo, rubroId) {
  const r = (catalogo.reglasPorRubro || []).filter((x) => x.rubro === rubroId)[0];
  if (!r) return null;
  const resolver = (ids) => (ids || []).map((id) => eppPorId(catalogo, id)).filter(Boolean);
  return {
    rubro: rubroId,
    obligatorio: resolver(r.obligatorio),
    segunTarea: resolver(r.segunTarea),
    nota: r.nota || null,
  };
}

/**
 * Plan de supervisión: con esta cámara, a esta distancia y para este rubro,
 * qué implementos se pueden vigilar de verdad y cuáles no.
 */
function planSupervision(catalogo, opciones) {
  const op = opciones || {};
  const fuente = fuentePorId(catalogo, op.fuente);
  const reglas = reglasDeRubro(catalogo, op.rubro);
  if (!fuente) return { error: 'Fuente de cámara desconocida: ' + op.fuente };
  if (!reglas) return { error: 'El rubro "' + op.rubro + '" no tiene reglas de EPP declaradas.' };

  const distancia = Number(op.distanciaM) > 0 ? Number(op.distanciaM) : 3;
  const evaluar = (e, exigido) => {
    const maxM = distanciaMaxima(e, fuente);
    return {
      id: e.id, nombre: e.nombre, icon: e.icon, exigido,
      dificultad: e.dificultad,
      distanciaMaxM: maxM,
      pxAqui: pxAparentes(e.alturaM, fuente, distancia),
      pxMinimos: e.pxMinimos,
      vigilable: maxM >= distancia,
      nota: e.nota,
    };
  };

  const items = reglas.obligatorio.map((e) => evaluar(e, 'obligatorio'))
    .concat(reglas.segunTarea.map((e) => evaluar(e, 'según tarea')));

  const vigilables = items.filter((i) => i.vigilable);
  const fuera = items.filter((i) => !i.vigilable);
  const obligatoriosFuera = fuera.filter((i) => i.exigido === 'obligatorio');

  const acciones = [];
  if (obligatoriosFuera.length) {
    const masCerca = Math.min(...obligatoriosFuera.map((i) => i.distanciaMaxM));
    acciones.push('A ' + distancia.toFixed(1) + ' m esta cámara no alcanza para '
      + obligatoriosFuera.map((i) => i.nombre.toLowerCase()).join(', ')
      + '. Hay que acercar el punto de control a ' + masCerca.toFixed(1) + ' m o menos, o subir la resolución.');
  }
  if (fuente.latenciaMs != null && fuente.latenciaMs > 1000) {
    acciones.push('La latencia de esta fuente ronda ' + (fuente.latenciaMs / 1000).toFixed(1)
      + ' s: sirve para supervisar un área, no para detener a alguien en un acceso.');
  }
  if (!obligatoriosFuera.length && vigilables.length) {
    acciones.push('Con esta cámara a esta distancia se puede vigilar todo lo obligatorio del rubro.');
  }

  return {
    fuente: { id: fuente.id, nombre: fuente.nombre, resolucionV: fuente.resolucionV, fovVDeg: fuente.fovVDeg, latenciaMs: fuente.latenciaMs, veredicto: fuente.veredicto },
    rubro: op.rubro,
    distanciaM: distancia,
    items,
    vigilables: vigilables.map((i) => i.id),
    fueraDeAlcance: fuera.map((i) => i.id),
    cubreObligatorios: obligatoriosFuera.length === 0,
    notaRegla: reglas.nota,
    acciones,
  };
}

/**
 * Evaluación de una persona detectada.
 *
 * `detectados` son los ids de EPP que el modelo vio; `plan` es el resultado de
 * planSupervision. Lo que no se podía ver NO cuenta como incumplimiento: sale
 * como "no evaluable", que es la diferencia entre un sistema que se usa y uno
 * que el jefe de turno apaga el segundo día.
 */
function evaluarPersona(plan, detectados) {
  const vistos = new Set(detectados || []);
  const obligatorios = (plan.items || []).filter((i) => i.exigido === 'obligatorio');

  const cumple = [];
  const faltan = [];
  const noEvaluables = [];
  for (const i of obligatorios) {
    if (!i.vigilable) noEvaluables.push(i.id);
    else if (vistos.has(i.id)) cumple.push(i.id);
    else faltan.push(i.id);
  }

  const estado = faltan.length ? 'incumple' : (noEvaluables.length ? 'parcial' : 'cumple');
  return {
    estado,
    cumple,
    faltan,
    noEvaluables,
    // Lo que el sistema puede afirmar, dicho en una línea para el reporte.
    resumen: faltan.length
      ? 'Falta: ' + faltan.map((id) => nombreEpp(plan, id)).join(', ')
      : (noEvaluables.length
        ? 'Cumple lo verificable; no se pudo evaluar ' + noEvaluables.map((id) => nombreEpp(plan, id)).join(', ')
        : 'Cumple todo lo exigido'),
  };
}

function nombreEpp(plan, id) {
  const i = (plan.items || []).filter((x) => x.id === id)[0];
  return i ? i.nombre.toLowerCase() : id;
}

/** Fotogramas por segundo estimados de un modelo en una clase de cómputo. */
function fpsEstimados(modelo, donde) {
  const ms = modelo && modelo.latenciaMs ? modelo.latenciaMs[donde] : null;
  return ms ? Math.round(1000 / ms) : null;
}

/**
 * Modelos que pueden entrar al producto: primero por licencia, después por
 * dónde pueden correr. El orden importa — un modelo con licencia incompatible
 * no se evalúa técnicamente, se descarta.
 */
function modelosViables(catalogo, opciones) {
  const op = opciones || {};
  const donde = op.donde || null;
  return (catalogo.modelos || [])
    .filter((m) => m.veredicto !== 'prohibida')
    .filter((m) => !donde || (m.dondeCorre || []).indexOf(donde) >= 0)
    .map((m) => ({
      id: m.id, nombre: m.nombre, tarea: m.tarea, licencia: m.licencia,
      dondeCorre: m.dondeCorre,
      fpsMovil: fpsEstimados(m, 'movilNpu'),
      fpsServidor: fpsEstimados(m, 'servidorGpu'),
      nota: m.nota,
    }));
}

/** Los modelos descartados y por qué: se muestran, no se esconden. */
function modelosDescartados(catalogo) {
  return (catalogo.modelos || [])
    .filter((m) => m.veredicto === 'prohibida')
    .map((m) => ({ id: m.id, nombre: m.nombre, licencia: m.licencia, nota: m.nota }));
}

/** Qué fuentes de cámara puede usar un equipo, según sus capacidades activas. */
function fuentesDisponibles(catalogo, caps) {
  const tiene = (c) => (caps && typeof caps.has === 'function' ? caps.has(c) : false);
  return (catalogo.fuentes || []).map((f) => {
    const remota = f.id !== 'movil' && f.id !== 'totem';
    const posible = remota
      ? tiene('media.stream.rtmp') || tiene('api.vision.servidor') || tiene('api.dji.msdk')
      : tiene('media.camera');
    return {
      id: f.id, nombre: f.nombre, veredicto: f.veredicto, remota,
      disponible: posible,
      motivo: posible ? null : (remota
        ? 'Requiere ingesta de vídeo en vivo o un servidor de análisis.'
        : 'Requiere acceso a la cámara del equipo.'),
    };
  });
}

/* ===== src/core/legal.js ===== */
/**
 * legal.js — la puerta de cumplimiento, ejecutable.
 *
 * Este producto pone cámaras a mirar personas. En Chile, desde el 1 de
 * diciembre de 2026, eso cae bajo la Ley 21.719, y la parte biométrica es
 * categoría especial. La decisión de diseño es no dejarlo en un párrafo de
 * documentación: **el expediente de cumplimiento es un objeto que la app
 * evalúa, y las funciones sensibles no se encienden sin él**.
 *
 * Esto no es asesoría legal. Es la lista de lo que hay que tener hecho,
 * traducida a preguntas que alguien puede responder sin ser abogado, y
 * convertida en una condición que el software comprueba.
 */

const NIVEL = { 'sin-datos': 0, 'datos-personales': 1, 'alto-riesgo': 2, sensibles: 3 };

/**
 * Clasifica un tratamiento. Se le pasa lo que la función hace, no lo que se
 * quisiera que hiciera.
 *
 * @param rasgos { personas, sensibles, observacionSistematica, masivo, decisionAutomatizada }
 */
function clasificar(rasgos) {
  const r = rasgos || {};
  if (r.sensibles) return 'sensibles';
  if (r.observacionSistematica || r.masivo || r.decisionAutomatizada) return 'alto-riesgo';
  if (r.personas) return 'datos-personales';
  return 'sin-datos';
}

/** ¿Este nivel de tratamiento activa esta obligación del checklist? */
function aplica(item, nivel) {
  const n = NIVEL[nivel] == null ? 0 : NIVEL[nivel];
  if (item.aplicaSi === 'datos-personales') return n >= 1;
  if (item.aplicaSi === 'alto-riesgo') return n >= 2;
  if (item.aplicaSi === 'sensibles') return n >= 3;
  return true;
}

/** Obligaciones que corresponden a un nivel de tratamiento. */
function checklistPara(catalogo, nivel) {
  return (catalogo.checklist || []).filter((i) => aplica(i, nivel));
}

/**
 * Evalúa el expediente: qué está respondido y qué falta.
 *
 * `respuestas` es un objeto `{ idDelItem: true | false | { hecho, por, fecha } }`.
 * Se admite el objeto porque para las obligaciones bloqueantes interesa saber
 * QUIÉN respondió y CUÁNDO: sin eso no hay responsabilidad proactiva, que es
 * justo lo que exige la ley.
 */
function evaluarExpediente(catalogo, nivel, respuestas) {
  const items = checklistPara(catalogo, nivel);
  const dadas = respuestas || {};

  const estado = items.map((i) => {
    const r = dadas[i.id];
    const hecho = r === true || (r && typeof r === 'object' && r.hecho === true);
    return {
      id: i.id,
      pregunta: i.pregunta,
      bloqueante: !!i.bloqueante,
      hecho,
      por: (r && typeof r === 'object' && r.por) || null,
      fecha: (r && typeof r === 'object' && r.fecha) || null,
      comoSeCumple: i.comoSeCumple,
    };
  });

  const faltan = estado.filter((e) => !e.hecho);
  const bloqueantes = faltan.filter((e) => e.bloqueante);

  return {
    nivel,
    total: estado.length,
    hechos: estado.length - faltan.length,
    porcentaje: estado.length ? Math.round(((estado.length - faltan.length) / estado.length) * 100) : 100,
    completo: faltan.length === 0,
    // Lo que decide si la función se puede encender: los bloqueantes.
    puedeActivarse: bloqueantes.length === 0,
    faltan: faltan.map((e) => e.id),
    bloqueantes: bloqueantes.map((e) => e.id),
    items: estado,
  };
}

/**
 * Registro de activación: lo que queda guardado cuando alguien enciende una
 * función sensible. Sin esto no hay forma de responder "¿quién autorizó esto?",
 * que es la primera pregunta de cualquier fiscalización.
 */
function registroDeActivacion(capacidad, expediente, responsable) {
  if (!expediente.puedeActivarse) return null;
  return {
    capacidad: capacidad.id,
    nombre: capacidad.nombre,
    nivel: expediente.nivel,
    activadaEn: new Date().toISOString(),
    responsable: responsable || null,
    expediente: {
      porcentaje: expediente.porcentaje,
      completo: expediente.completo,
      pendientesNoBloqueantes: expediente.faltan,
    },
    marco: 'cl-21719',
  };
}

/** Plazo de conservación sugerido para lo que produce un módulo. */
function retencionDe(catalogo, moduloId) {
  return (catalogo.retencionSugerida || []).filter((r) => r.modulo === moduloId)[0] || null;
}

/** Días que faltan para que el marco entre en vigencia (negativo si ya rige). */
function diasParaVigencia(catalogo, hoy) {
  const ahora = hoy ? new Date(hoy) : new Date();
  const vigencia = new Date(catalogo.marco.vigencia + 'T00:00:00Z');
  return Math.ceil((vigencia - ahora) / 86400000);
}

/* ===== src/core/extensiones.js ===== */
/**
 * extensiones.js — cómo la app suma capacidades nuevas sin rehacerse.
 *
 * El catálogo de capacidades futuras (`src/data/capacidades-futuras.json`)
 * declara qué falta para cada una en tres planos distintos, y este módulo los
 * cruza:
 *
 *   1. el EQUIPO       — ¿tiene las capacidades técnicas necesarias?
 *   2. el ACCESORIO    — ¿hace falta un sensor externo, y está conectado?
 *   3. el EXPEDIENTE   — ¿está hecho el trámite legal que exige esa función?
 *
 * El tercero es el que suele faltar y el único que el software puede hacer
 * cumplir de verdad: una capacidad marcada `activacionControlada` no se enciende
 * mientras queden obligaciones bloqueantes sin responder.
 */


const ORDEN_ESTADO_EXTENSION = ['lista', 'requiere-expediente', 'requiere-construccion', 'requiere-accesorio', 'requiere-equipo', 'no-ofrecida'];

const ESTADOS_EXTENSION = {
  lista: { label: 'Lista para encender', icon: '✅' },
  'requiere-expediente': { label: 'Falta el expediente legal', icon: '⚖️' },
  'requiere-construccion': { label: 'Falta construirla', icon: '🔨' },
  'requiere-accesorio': { label: 'Falta el accesorio', icon: '🔌' },
  'requiere-equipo': { label: 'El equipo no da', icon: '📵' },
  'no-ofrecida': { label: 'No se ofrece', icon: '⛔' },
};

const porId = (lista, id) => (lista || []).filter((x) => x.id === id)[0] || null;
const capacidadPorId = (catalogo, id) => porId(catalogo.capacidades, id);
const accesorioPorId = (catalogo, id) => porId(catalogo.accesorios, id);

/** Rasgos de tratamiento que implica una capacidad, para clasificarla. */
function rasgosDe(cap) {
  const biometricaOconducta = cap.categoria === 'biometria' || cap.categoria === 'conducta';
  return {
    personas: cap.categoria !== 'ambiental',
    sensibles: !!cap.datoSensible,
    observacionSistematica: biometricaOconducta || cap.categoria === 'verificacion',
    masivo: false,
    decisionAutomatizada: biometricaOconducta,
  };
}

/**
 * Estado de una capacidad con los medios de esta organización.
 *
 * @param ctx { caps:Set, accesorios:Set, expediente:{}, accesoriosCatalogo, legalCatalogo }
 */
function estadoDeCapacidad(cap, ctx) {
  const c = ctx || {};
  const tiene = (x) => (c.caps && typeof c.caps.has === 'function' ? c.caps.has(x) : false);
  const conectado = (x) => (c.accesorios && typeof c.accesorios.has === 'function' ? c.accesorios.has(x) : false);

  const capsFaltantes = (cap.requiereCaps || []).filter((x) => !tiene(x));
  const opciones = cap.requiereAccesorio || [];
  const accesorioPuesto = !opciones.length || opciones.some(conectado);
  const accesoriosFaltantes = accesorioPuesto ? [] : opciones;

  // Puerta legal: se evalúa siempre, aunque falte lo técnico, porque el trámite
  // se puede ir haciendo en paralelo y suele ser lo más lento.
  const nivel = clasificar(rasgosDe(cap));
  const expediente = c.legalCatalogo
    ? evaluarExpediente(c.legalCatalogo, nivel, c.expediente)
    : { puedeActivarse: true, completo: true, faltan: [], bloqueantes: [], porcentaje: 100, nivel, items: [] };

  // Un accesorio marcado "prohibida" cierra la capacidad, aunque esté conectado.
  const accesorioVetado = opciones
    .map((id) => accesorioPorId(c.accesoriosCatalogo || {}, id))
    .filter((a) => a && a.veredicto === 'prohibida');

  let estado;
  if (accesorioVetado.length || cap.puertaLegal === 'equipo-certificado') estado = 'no-ofrecida';
  else if (capsFaltantes.length) estado = 'requiere-equipo';
  else if (accesoriosFaltantes.length) estado = 'requiere-accesorio';
  else if (cap.madurez !== 'disponible') estado = 'requiere-construccion';
  else if (!expediente.puedeActivarse) estado = 'requiere-expediente';
  else estado = 'lista';

  const acciones = [];
  if (estado === 'no-ofrecida') {
    acciones.push(cap.honestidad || 'Esta capacidad queda fuera del alcance del producto.');
  }
  if (capsFaltantes.length) {
    acciones.push('Este equipo no tiene: ' + capsFaltantes.join(', ') + '. Usa un equipo del catálogo que sí las tenga.');
  }
  if (accesoriosFaltantes.length) {
    const nombres = accesoriosFaltantes
      .map((id) => (accesorioPorId(c.accesoriosCatalogo || {}, id) || {}).nombre || id);
    acciones.push('Conecta uno de estos accesorios: ' + nombres.join(' o ') + '.');
  }
  if (cap.madurez === 'en-desarrollo') {
    acciones.push('Está resuelta técnicamente y sin construir: ' + (cap.esfuerzoSemanas || '?') + ' semanas de trabajo.');
  }
  if (cap.madurez === 'investigacion' && !accesoriosFaltantes.length) {
    acciones.push('Por visión no está resuelta de forma fiable. ' + (cap.honestidad || ''));
  }
  if (!expediente.puedeActivarse) {
    acciones.push('Antes de encenderla faltan obligaciones bloqueantes: ' + expediente.bloqueantes.join(', ') + '.');
  }
  if (cap.alternativaMenosInvasiva) {
    acciones.push('Alternativa menos invasiva: ' + cap.alternativaMenosInvasiva);
  }

  return {
    id: cap.id,
    nombre: cap.nombre,
    icon: cap.icon,
    categoria: cap.categoria,
    madurez: cap.madurez,
    puertaLegal: cap.puertaLegal,
    datoSensible: !!cap.datoSensible,
    activacionControlada: !!cap.activacionControlada,
    moduloBase: cap.moduloBase,
    esfuerzoSemanas: cap.esfuerzoSemanas || null,
    estado,
    estadoLabel: ESTADOS_EXTENSION[estado].label,
    estadoIcon: ESTADOS_EXTENSION[estado].icon,
    faltan: { caps: capsFaltantes, accesorios: accesoriosFaltantes, legal: expediente.bloqueantes },
    expediente: { nivel: expediente.nivel, porcentaje: expediente.porcentaje, puedeActivarse: expediente.puedeActivarse },
    acciones,
    honestidad: cap.honestidad || null,
    recomendada: !!cap.recomendada,
  };
}

/**
 * Intento de activación. Devuelve el registro cuando procede, y el motivo
 * cuando no: la app nunca enciende una capacidad controlada sin dejar rastro.
 */
function activar(cap, ctx, responsable) {
  const e = estadoDeCapacidad(cap, ctx);
  if (e.estado !== 'lista') {
    return { activada: false, motivo: e.estadoLabel, detalle: e.acciones };
  }
  if (cap.activacionControlada && !responsable) {
    return {
      activada: false,
      motivo: 'Falta el responsable',
      detalle: ['Una capacidad de activación controlada exige el nombre de quien la autoriza: queda en el registro.'],
    };
  }
  const nivel = clasificar(rasgosDe(cap));
  const expediente = evaluarExpediente(ctx.legalCatalogo, nivel, ctx.expediente);
  return { activada: true, registro: registroDeActivacion(cap, expediente, responsable) };
}

/** Todas las capacidades ordenadas por lo cerca que están de poder encenderse. */
function extensionesDisponibles(catalogo, ctx) {
  return (catalogo.capacidades || [])
    .map((c) => estadoDeCapacidad(c, ctx))
    .sort((a, b) => (ORDEN_ESTADO_EXTENSION.indexOf(a.estado) - ORDEN_ESTADO_EXTENSION.indexOf(b.estado))
      || (a.categoria < b.categoria ? -1 : 1));
}

/** Qué accesorios habilitan una capacidad, con su forma de conexión. */
function accesoriosQueHabilitan(catalogoAccesorios, capId) {
  return (catalogoAccesorios.accesorios || [])
    .filter((a) => (a.habilita || []).indexOf(capId) >= 0)
    .map((a) => ({ id: a.id, nombre: a.nombre, icon: a.icon, conexion: a.conexion, costoAprox: a.costoAprox, veredicto: a.veredicto }));
}

/**
 * Dónde funciona una conexión. Es la pregunta que más se repite en terreno, y
 * la respuesta vuelve a ser la misma que con el LiDAR: en Android el navegador
 * alcanza, en iOS hace falta el contenedor nativo.
 */
function soportePlataforma(catalogoAccesorios, accesorioId, plataforma) {
  const a = accesorioPorId(catalogoAccesorios, accesorioId);
  if (!a) return null;
  const conexion = (catalogoAccesorios.conexiones || {})[a.conexion];
  if (!conexion) return null;
  const texto = conexion[plataforma] || conexion.escritorio || 'Sin información.';
  const via = /^No\.?$/i.test(texto.trim()) ? 'no'
    : /nativo|CoreBluetooth|Core NFC/i.test(texto) ? 'nativo'
      : /servidor de ingesta/i.test(texto) ? 'servidor'
        : 'web';
  return { accesorio: a.nombre, conexion: conexion.nombre, plataforma, via, texto, nota: conexion.nota };
}

/** Resumen para la consola: cuántas capacidades hay en cada estado. */
function resumenExtensiones(catalogo, ctx) {
  const lista = extensionesDisponibles(catalogo, ctx);
  const por = (campo) => lista.reduce((a, x) => { a[x[campo]] = (a[x[campo]] || 0) + 1; return a; }, {});
  return {
    total: lista.length,
    porEstado: por('estado'),
    porCategoria: por('categoria'),
    sensibles: lista.filter((x) => x.datoSensible).length,
    controladas: lista.filter((x) => x.activacionControlada).length,
    esfuerzoPendienteSemanas: lista
      .filter((x) => x.estado === 'requiere-construccion')
      .reduce((a, x) => a + (x.esfuerzoSemanas || 0), 0),
  };
}

/* Exportaciones para uso como módulo (las herramientas lo importan;
   el bundle de la app de KIMOS quita este bloque al incrustarlo). */


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
const APP_VERSION = '1.3.0';

const DATOS = {"generado":"2026-08-26T11:12:27.247Z","nucleo":"1.3.0","origen":"kimos-LiDARia","devices":{"version":"1.0.0","actualizado":"2026-08-25","nota":"Catálogo de equipos. `caps` son capacidades de HARDWARE del equipo: cuáles quedan activas depende también del entorno (navegador vs app nativa), y eso lo resuelve resolve.js. `confianza` marca lo verificado frente a lo que hay que confirmar antes de prometerlo a un cliente.","clases":[{"id":"movil","label":"Teléfono","icon":"📱"},{"id":"tablet","label":"Tablet","icon":"🧾"},{"id":"visor","label":"Visor de realidad mixta","icon":"🥽"},{"id":"pc","label":"Computador","icon":"🖥️"},{"id":"tv","label":"Smart TV / tótem","icon":"📺"},{"id":"reloj","label":"Reloj / wearable","icon":"⌚"},{"id":"campo","label":"Equipo de campo (dron, escáner, robot)","icon":"🛰️"},{"id":"dron","label":"Dron","icon":"🚁"},{"id":"camara","label":"Cámara fija o accesorio","icon":"📷"}],"equipos":[{"id":"apple.iphone.pro.12-17","marca":"Apple","nombre":"iPhone 12 Pro → 17 Pro (y Pro Max)","clase":"movil","plataforma":"ios","anios":[2020,2025],"confianza":"verificado","modelos":["iPhone13,3","iPhone13,4","iPhone14,2","iPhone14,3","iPhone15,2","iPhone15,3","iPhone16,1","iPhone16,2","iPhone17,1","iPhone17,2","iPhone18,1","iPhone18,2"],"caps":["depth.dtof","depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.mesh","api.arkit.roomplan","api.arkit.objectcapture","api.arkit.body","api.viewer.usdz","media.camera","media.multicam","sensor.imu","sensor.gnss","compute.npu"],"nota":"El equipo de referencia del proyecto: LiDAR trasero, TrueDepth frontal y toda la pila ARKit. Toda gama Pro desde 2020; ningún iPhone estándar, Plus, Air, mini o SE lo lleva."},{"id":"apple.ipadpro.2020+","marca":"Apple","nombre":"iPad Pro 11\" (2ª gen) y 12.9\" (4ª gen) en adelante, incl. M4/M5","clase":"tablet","plataforma":"ios","anios":[2020,2025],"confianza":"verificado","modelos":["iPad8,9","iPad8,10","iPad8,11","iPad8,12","iPad13,4","iPad13,5","iPad13,6","iPad13,7","iPad13,8","iPad13,9","iPad13,10","iPad13,11","iPad14,3","iPad14,4","iPad14,5","iPad14,6","iPad16,3","iPad16,4","iPad16,5","iPad16,6"],"caps":["depth.dtof","depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.mesh","api.arkit.roomplan","api.arkit.objectcapture","api.arkit.body","api.viewer.usdz","media.camera","media.multicam","sensor.imu","compute.npu"],"nota":"Mismo stack que el iPhone Pro con más pantalla: es el equipo cómodo para escanear una vivienda completa y revisar el plano en el sitio. Ni iPad, ni iPad Air, ni iPad mini llevan LiDAR."},{"id":"apple.iphone.estandar","marca":"Apple","nombre":"iPhone X → 17 (estándar, Plus, Air, mini, SE 2ª/3ª gen)","clase":"movil","plataforma":"ios","anios":[2017,2025],"confianza":"verificado","modelos":[],"caps":["depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.body","api.viewer.usdz","media.camera","media.multicam","sensor.imu","sensor.gnss","compute.npu"],"nota":"Sin LiDAR: mide por movimiento y estéreo, y tiene TrueDepth frontal. Vale para AR, previsualización, fotogrametría y volumen aproximado; no para acotar un plano.","excepciones":{"depth.structured":"Solo modelos con Face ID (no el SE con Touch ID)."}},{"id":"apple.visionpro","marca":"Apple","nombre":"Apple Vision Pro","clase":"visor","plataforma":"visionos","anios":[2024,2026],"confianza":"verificado","caps":["depth.dtof","depth.structured","depth.stereo","api.arkit.scenedepth","api.arkit.mesh","api.viewer.usdz","api.webxr.ar","api.webxr.mesh","media.camera","sensor.imu","compute.npu","runtime.headset"],"nota":"LiDAR + estéreo + seguimiento de manos y mirada, y WebXR habilitado en Safari de visionOS 2: el único equipo donde la app corre inmersiva sin instalar nada."},{"id":"meta.quest3","marca":"Meta","nombre":"Meta Quest 3 / 3S","clase":"visor","plataforma":"android-xr","anios":[2023,2025],"confianza":"verificado","caps":["depth.dtof","depth.stereo","api.webxr.ar","api.webxr.depth","api.webxr.hittest","api.webxr.anchors","api.webxr.mesh","media.camera","sensor.imu","compute.webgpu","runtime.headset"],"nota":"Sensor de profundidad + passthrough a color y navegador con WebXR completo: es la plataforma donde la vía web llega más lejos sin app nativa."},{"id":"android.xr.visores","marca":"Android XR","nombre":"Visores Android XR (Galaxy XR y compatibles)","clase":"visor","plataforma":"android-xr","anios":[2025,2026],"confianza":"por-confirmar","caps":["depth.stereo","api.webxr.ar","api.webxr.depth","api.webxr.hittest","api.webxr.anchors","api.webxr.mesh","media.camera","sensor.imu","compute.webgpu","runtime.headset"],"nota":"Chrome de Android XR expone profundidad estereoscópica (dos mapas en vivo, uno por ojo). Confirmar módulo a módulo en el equipo concreto antes de comprometer funciones."},{"id":"samsung.tof.2019-2020","marca":"Samsung","nombre":"Galaxy S10 5G · Note10+ · S20+ · S20 Ultra","clase":"movil","plataforma":"android","anios":[2019,2020],"confianza":"verificado","modelos":["SM-G977","SM-N975","SM-N976","SM-G986","SM-G988"],"caps":["depth.itof","depth.stereo","depth.motion","api.arcore.depth","api.arcore.rawdepth","api.arcore.semantics","api.arcore.geospatial","api.viewer.glb","media.camera","media.multicam","sensor.imu","sensor.gnss"],"nota":"La generación Android con ToF trasero real. Samsung lo retiró desde la serie S21: los buques insignia posteriores traen autofoco láser, que no es un sensor de profundidad utilizable."},{"id":"samsung.flagship.reciente","marca":"Samsung","nombre":"Galaxy S21 → S25 (incl. Ultra) y Z Fold/Flip","clase":"movil","plataforma":"android","anios":[2021,2025],"confianza":"verificado","modelos":["SM-S91","SM-S92","SM-S93","SM-S94","SM-F94","SM-F95","SM-S921","SM-S926","SM-S928","SM-S931","SM-S936","SM-S938"],"caps":["depth.stereo","depth.motion","api.arcore.depth","api.arcore.rawdepth","api.arcore.semantics","api.arcore.geospatial","api.viewer.glb","media.camera","media.multicam","sensor.imu","sensor.gnss","compute.npu"],"nota":"Sin ToF dedicado: profundidad por movimiento vía ARCore, buena para AR, oclusión y volumen aproximado. Hay indicios de un módulo ToF en el S25 Ultra que NO damos por bueno hasta medirlo en un equipo real."},{"id":"huawei.tof","marca":"Huawei","nombre":"P30 Pro · Mate 30 Pro · P40 Pro · Mate 40 Pro","clase":"movil","plataforma":"android","anios":[2019,2020],"confianza":"verificado","caps":["depth.itof","depth.stereo","media.camera","media.multicam","sensor.imu","sensor.gnss"],"nota":"ToF trasero real, pero sin Servicios de Google en los modelos posteriores a 2019: ARCore no está disponible y hay que ir por HMS/AR Engine. Fuera del alcance de la fase 1."},{"id":"sony.xperia1.tof","marca":"Sony","nombre":"Xperia 1 II → 1 V","clase":"movil","plataforma":"android","anios":[2020,2023],"confianza":"por-confirmar","caps":["depth.itof","depth.stereo","depth.motion","api.arcore.depth","api.arcore.rawdepth","api.viewer.glb","media.camera","media.multicam","sensor.imu","sensor.gnss"],"nota":"Sensor 3D iToF trasero en la línea Xperia 1. Confirmar por modelo: Sony lo fue moviendo entre generaciones."},{"id":"honor.lg.tof","marca":"Honor / LG","nombre":"Honor View 20 · LG G8 ThinQ · LG V60","clase":"movil","plataforma":"android","anios":[2019,2020],"confianza":"por-confirmar","caps":["depth.itof","depth.motion","api.arcore.depth","api.viewer.glb","media.camera","sensor.imu"],"nota":"ToF de la primera oleada Android (en LG, frontal). Equipos fuera de soporte: solo interesan si el cliente ya los tiene en el bolsillo."},{"id":"android.arcore.generico","marca":"Android","nombre":"Android con ARCore (parque general)","clase":"movil","plataforma":"android","anios":[2018,2026],"confianza":"verificado","caps":["depth.motion","api.arcore.depth","api.arcore.rawdepth","api.arcore.semantics","api.arcore.geospatial","api.viewer.glb","api.webxr.ar","api.webxr.depth","api.webxr.hittest","media.camera","sensor.imu","sensor.gnss"],"nota":"El caso más numeroso: sin sensor de profundidad, pero con Depth API por movimiento. Google reporta más del 88% de los equipos activos con Depth API en mayo de 2026. Es el suelo sobre el que hay que diseñar la degradación."},{"id":"android.sinarcore","marca":"Android","nombre":"Android sin ARCore (gama de entrada)","clase":"movil","plataforma":"android","anios":[2016,2026],"confianza":"verificado","caps":["media.camera","sensor.imu","sensor.gnss"],"nota":"Cámara y poco más. Sirve para fotogrametría por fotos subidas a la nube y para consumir resultados, no para capturar en vivo."},{"id":"pc.escritorio","marca":"PC / Mac","nombre":"Computador de escritorio o portátil","clase":"pc","plataforma":"desktop","anios":[2015,2026],"confianza":"verificado","caps":["media.camera","compute.webgpu","compute.wasm.simd","io.filesystem","runtime.web"],"nota":"Cero captura de profundidad, pero es donde se revisa, mide sobre el modelo, se corrige el plano y se exporta. La consola de KIMOS vive aquí."},{"id":"pc.sensor3d","marca":"PC + sensor 3D","nombre":"Computador con cámara de profundidad (RealSense, Femto, Kinect Azure)","clase":"pc","plataforma":"desktop","anios":[2015,2026],"confianza":"por-confirmar","caps":["depth.itof","depth.stereo","media.camera","compute.webgpu","compute.wasm.simd","io.filesystem"],"nota":"Puesto fijo de escaneo (mostrador, línea de empaque). Requiere agente local: el navegador no habla con estos sensores. Fase 3."},{"id":"tv.totem","marca":"Smart TV / tótem","nombre":"Televisor, pantalla de sala o tótem","clase":"tv","plataforma":"tv","anios":[2018,2026],"confianza":"verificado","caps":["runtime.web"],"nota":"Rol honesto: mostrar. Vitrina 3D en sala de ventas, plano en obra, avance de proyecto. No captura ni mide."},{"id":"reloj.wearable","marca":"Apple Watch / Wear OS","nombre":"Reloj inteligente","clase":"reloj","plataforma":"wearable","anios":[2018,2026],"confianza":"verificado","caps":["sensor.imu"],"nota":"Sin cámara ni profundidad. Rol real: mando a distancia de la captura (disparar, marcar punto, avisar de que el escaneo terminó) sin soltar la herramienta. Fase 3."},{"id":"campo.dron.escaner","marca":"Equipos de campo","nombre":"Dron con LiDAR, escáner terrestre, robot con LDS","clase":"campo","plataforma":"externo","anios":[2018,2026],"confianza":"verificado","caps":["io.filesystem"],"nota":"No corren la app: entregan archivos (LAS/LAZ, E57, PLY). El punto de contacto es la importación y el cruce con la captura de mano."},{"id":"dji.neo2","marca":"DJI","nombre":"DJI Neo 2 (y drones de consumo con DJI Fly)","clase":"dron","plataforma":"externo","anios":[2025,2026],"confianza":"verificado","caps":["media.camera","media.camera.remote","media.stream.rtmp","sensor.gnss"],"nota":"Cámara 4K/100 fps con gimbal de 2 ejes, 151 g, LiDAR frontal y sensado omnidireccional para EVITAR OBSTÁCULOS. Ni ese LiDAR ni el control de vuelo están abiertos: no hay SDK para esta gama. Lo que sí se puede: emitir en vivo por RTMP personalizado desde DJI Fly (limitado a 720p por firmware) y grabar en 4K para analizar después."},{"id":"dji.enterprise","marca":"DJI","nombre":"DJI empresarial (Mavic 3 Enterprise/Térmico, Matrice)","clase":"dron","plataforma":"android","anios":[2022,2026],"confianza":"verificado","caps":["media.camera","media.camera.remote","media.stream.rtmp","api.dji.msdk","sensor.gnss","sensor.thermal"],"nota":"La única gama con Mobile SDK v5 (solo Android): control de vuelo, telemetría y vídeo desde una app propia. Los modelos térmicos (3T, 4T) sí miden temperatura radiométrica, que es lo que hace viable el módulo térmico."},{"id":"camara.ip","marca":"Cámara fija","nombre":"Cámara IP / CCTV con RTSP","clase":"camara","plataforma":"externo","anios":[2015,2026],"confianza":"verificado","caps":["media.camera","media.camera.remote","media.stream.rtmp"],"nota":"El caso más barato de supervisión continua: la cámara ya está instalada y solo hay que leer su flujo. No ejecuta nada; todo el análisis ocurre en el servidor."},{"id":"accesorio.termico","marca":"FLIR / Seek","nombre":"Accesorio térmico para móvil (FLIR One, Seek Compact)","clase":"camara","plataforma":"mixta","anios":[2018,2026],"confianza":"por-confirmar","caps":["sensor.thermal","media.camera"],"nota":"Convierte un teléfono en cámara térmica. Exige app nativa con el SDK del fabricante, y su precisión depende del ambiente: sirve para termografía de equipos y procesos, no para medir personas."},{"id":"totem.camara","marca":"Tótem / kiosco","nombre":"Tótem o kiosco con cámara","clase":"tv","plataforma":"desktop","anios":[2018,2026],"confianza":"verificado","caps":["media.camera","compute.webgpu","compute.wasm.simd","runtime.web","io.filesystem"],"nota":"Pantalla fija con cámara en un acceso, una faena o una sala. Es el punto natural del control de EPP en entrada: siempre enchufado, siempre en el mismo sitio y con la misma iluminación."}],"identificacion":{"ios":{"problema":"Safari no expone el modelo del iPhone. El navegador solo sabe que es 'iPhone', así que NO se puede afirmar si hay LiDAR desde la web.","estrategia":"Se ofrecen candidatos por tamaño de ventana y GPU, y se pide confirmar el modelo una sola vez (queda guardado). La app nativa lo resuelve exacto por identificador de hardware.","pistas":[{"equipo":"apple.iphone.pro.12-17","css":[[390,844],[393,852],[402,874],[428,926],[430,932],[440,956]],"dpr":[3]},{"equipo":"apple.ipadpro.2020+","css":[[834,1194],[1024,1366],[1032,1376],[834,1210]],"dpr":[2]}]},"android":{"problema":"El modelo llega por User-Agent Client Hints de alta entropía y requiere HTTPS y permiso implícito del navegador.","estrategia":"navigator.userAgentData.getHighEntropyValues(['model','platformVersion']) y prefijo contra `modelos`. Si no hay coincidencia, se usa el perfil genérico y se mide en caliente."}}},"modules":{"version":"1.0.0","actualizado":"2026-08-25","nota":"Catálogo de módulos de kimos-LiDARia. `requiere` es duro; `requiereAlguna` son grupos donde basta una capacidad; `prefiere` sube el grado sin ser obligatorio. Los números de negocio son SUPUESTOS declarados y editables, no resultados medidos: están para ordenar prioridades, no para presentarlos como hechos. `estrategico: true` marca los módulos cuyo valor no se ve entero en su propio P&L porque habilitan la venta de otros (catálogo 3D → Tienda y Vitrina).","supuestos":{"clientesKimos":{"valor":120,"label":"Cuentas KIMOS activas en el horizonte del plan","min":10,"max":5000},"costoSemanaUSD":{"valor":2200,"label":"Costo de una semana-persona de desarrollo (USD)","min":500,"max":8000},"churnMensual":{"valor":0.02,"label":"Baja mensual de cuentas","min":0,"max":0.15},"margenObjetivo":{"valor":0.75,"label":"Margen bruto objetivo","min":0.3,"max":0.95}},"modulos":[{"id":"diagnostico","nombre":"Diagnóstico del equipo","icon":"🩺","fase":0,"resumen":"Antes de prometer nada, la app dice qué puede hacer ESTE equipo y qué no.","problema":"El usuario baja una app de escaneo, la abre en un teléfono sin sensor y la app falla en silencio o entrega medidas malas. Se pierde la confianza en el primer minuto.","solucion":"Un diagnóstico que mide en caliente lo que se puede medir, infiere lo demás del catálogo de equipos y entrega un veredicto por módulo con el margen de error esperable y qué hacer para mejorarlo.","requiere":[],"requiereAlguna":[],"prefiere":[],"degradado":"Sin permisos de cámara solo puede informar del entorno; igual entrega el veredicto por módulo con lo inferido y lo marca como tal.","sinSoporte":"No aplica: es el único módulo que corre en cualquier parte, incluida la consola de escritorio.","salidas":["informe JSON","ficha compartible","QR para abrir en el equipo correcto"],"kimos":["escritorio","archivos"],"negocio":{"modelo":"incluido","precioMensualUSD":0,"costoVariableUSD":0,"valorClienteUSD":0,"adopcion":1,"esfuerzoSemanas":3},"riesgos":["Prometer de más por inferencia: por eso todo veredicto viaja con su fuente y su confianza."],"estrategico":true},{"id":"medir","nombre":"Medición en terreno","icon":"📏","fase":1,"resumen":"Distancias, superficies, alturas y ángulos con el teléfono, con el error real de cada medida a la vista.","problema":"Una visita a terreno para tomar medidas cuesta horas de traslado y se rehace cuando falta una cota. El flexómetro no deja registro y lo anotado a mano no es auditable.","solucion":"Medición apoyada en la profundidad del equipo, con foto anotada, autor, fecha y coordenadas. Cada medida guarda su banda de error, así el que la usa sabe si puede cortar material con ella.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["depth.dtof","depth.itof","depth.motion","api.arkit.scenedepth","api.arcore.depth","api.webxr.hittest"]],"prefiere":["depth.dtof","api.arkit.scenedepth","api.arcore.rawdepth"],"degradado":"Con profundidad por movimiento mide igual, pero el error sube al 5-10%: sirve para presupuestar, no para fabricar.","sinSoporte":"Queda como visor: abrir medidas de otros, comentarlas y exportarlas.","salidas":["foto acotada (PNG/PDF)","CSV de medidas","ficha a Pedidos"],"kimos":["pedidos","prospeccion","archivos","productlab"],"negocio":{"modelo":"por-usuario","precioMensualUSD":9,"costoVariableUSD":0.4,"valorClienteUSD":180,"adopcion":0.55,"esfuerzoSemanas":6},"riesgos":["Medida mal usada en fabricación: el error esperado tiene que ser imposible de ignorar en pantalla."]},{"id":"espacios","nombre":"Escaneo de espacios","icon":"🏠","fase":1,"resumen":"Una habitación en un minuto: plano 2D acotado, modelo 3D y superficies calculadas.","problema":"Levantar el plano de un local para una reforma, un arriendo o un seguro toma horas y termina en un dibujo que nadie puede verificar.","solucion":"Escaneo guiado que produce un plano paramétrico (muros, puertas, ventanas, mobiliario) exportable a DXF, IFC y USDZ/GLB, más superficie por recinto y volumen total.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["depth.dtof","depth.itof"],["api.arkit.roomplan","api.arkit.mesh","api.webxr.mesh","api.arcore.rawdepth"]],"prefiere":["api.arkit.roomplan","depth.dtof","compute.npu"],"degradado":"Sin RoomPlan se arma la malla y el plano se ajusta a mano sobre el escaneo: más lento, misma exportación.","sinSoporte":"Sin sensor de profundidad no se ofrece escaneo: se ofrece medir a mano el recinto y dibujar el plano asistido, y se avisa qué equipo del inventario sí puede.","salidas":["DXF","IFC","USDZ/GLB","PDF acotado","superficies por recinto"],"kimos":["archivos","gantt","pedidos","productlab"],"negocio":{"modelo":"por-usuario","precioMensualUSD":29,"costoVariableUSD":2.1,"valorClienteUSD":900,"adopcion":0.3,"esfuerzoSemanas":14},"riesgos":["Depende de una API de Apple que ha tenido regresiones por versión de iOS: hay que fijar versiones probadas y tener camino de malla propia."]},{"id":"objetos","nombre":"Escaneo de producto","icon":"📦","fase":1,"resumen":"Un producto real convertido en modelo 3D con textura, listo para el catálogo y para la vista AR de la tienda.","problema":"Publicar productos en 3D cuesta caro: modelar a mano una pieza son cientos de dólares y semanas, y sin 3D no hay vista AR ni configurador.","solucion":"Captura guiada del objeto con profundidad + fotos, malla limpia y publicación directa al catálogo de KIMOS con medidas reales, peso volumétrico y modelo AR.","requiere":["media.camera"],"requiereAlguna":[["depth.dtof","depth.itof","depth.structured","depth.motion","api.arkit.objectcapture","api.arcore.depth"]],"prefiere":["api.arkit.objectcapture","depth.dtof","compute.npu"],"degradado":"Sin profundidad se captura por fotos y se reconstruye en servidor: más lento y con escala a confirmar, pero funciona en casi cualquier teléfono.","sinSoporte":"Sin cámara no hay captura; queda revisar y publicar modelos existentes.","salidas":["GLB","USDZ","ficha de producto con medidas","peso volumétrico"],"kimos":["productos","tienda","vitrina","productlab"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":69,"costoVariableUSD":8,"valorClienteUSD":520,"adopcion":0.45,"esfuerzoSemanas":12},"riesgos":["El costo de reconstrucción en nube es real: sin cuota por plan, el margen se lo come el procesamiento."],"estrategico":true},{"id":"vitrina-ar","nombre":"Pruébalo en tu espacio","icon":"🛋️","fase":2,"resumen":"El comprador coloca el producto a escala 1:1 en su propia casa, con oclusión real, desde la tienda de KIMOS.","problema":"La devolución por 'no me cabe' o 'no combina' se paga entera: logística inversa, producto tocado y el cliente perdido.","solucion":"Vista AR embebida en la ficha de producto, servida desde el mismo modelo que produjo el módulo de escaneo. En equipos con profundidad, el mueble virtual queda tapado por lo que está delante.","requiere":[],"requiereAlguna":[["api.webxr.ar","api.viewer.usdz","api.viewer.glb"]],"prefiere":["depth.dtof","api.webxr.depth","api.arcore.depth"],"degradado":"Sin profundidad se coloca sobre el plano detectado sin oclusión: convence menos, pero funciona en casi todo el parque.","sinSoporte":"Se muestra el modelo en 3D girable, sin cámara. Sigue siendo mejor que una foto.","salidas":["enlace AR","código QR por producto","métrica de interacción"],"kimos":["tienda","vitrina","productos","productlab"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":149,"costoVariableUSD":4,"valorClienteUSD":1400,"adopcion":0.25,"esfuerzoSemanas":8},"riesgos":["El beneficio depende de tener catálogo 3D: sin el módulo de producto, esto no se vende solo."],"estrategico":true},{"id":"volumen","nombre":"Volumen y carga","icon":"🚚","fase":2,"resumen":"Bultos, pallets y espacio de carga medidos apuntando el teléfono, con peso volumétrico calculado.","problema":"El cubicaje manual es lento y se factura mal: el transportista cobra por volumen y la diferencia sale del margen del que despacha.","solucion":"Medición de la caja o el pallet con profundidad, cálculo de peso volumétrico por tarifa de transportista y armado de carga sobre el espacio real del camión.","requiere":["media.camera"],"requiereAlguna":[["depth.dtof","depth.itof","api.arcore.rawdepth","depth.motion"]],"prefiere":["depth.dtof","api.arcore.rawdepth"],"degradado":"Con profundidad por movimiento el error de volumen ronda el 10%: sirve para planificar, no para facturar.","sinSoporte":"Entrada manual de medidas con la misma calculadora de peso volumétrico.","salidas":["ficha de bulto","peso volumétrico por tarifa","plan de carga"],"kimos":["pedidos","productos","integraciones"],"negocio":{"modelo":"por-usuario","precioMensualUSD":14,"costoVariableUSD":0.6,"valorClienteUSD":380,"adopcion":0.2,"esfuerzoSemanas":7},"riesgos":["Facturar por estas medidas exige certificación legal para comercio (NTEP y equivalentes). Sin ella, el uso es interno y así hay que decirlo en la app."]},{"id":"obra","nombre":"Avance de obra e inspección","icon":"🏗️","fase":2,"resumen":"El mismo espacio escaneado en el tiempo: qué cambió entre visitas, con evidencia fechada.","problema":"El avance de obra se discute con fotos y palabras. Cuando aparece la diferencia, no hay registro que la resuelva.","solucion":"Escaneos sucesivos alineados sobre el mismo origen, comparación volumétrica entre fechas, marcado de observaciones ancladas al punto físico y reporte firmado.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["depth.dtof","depth.itof"],["api.arkit.mesh","api.arcore.rawdepth","api.webxr.mesh"]],"prefiere":["depth.dtof","sensor.gnss","api.arcore.geospatial"],"degradado":"Sin alineación automática, la comparación se ancla a un marcador impreso puesto en obra.","sinSoporte":"Solo lectura de reportes y observaciones.","salidas":["comparativa por fecha","reporte PDF firmado","observaciones ancladas"],"kimos":["gantt","kanban","archivos","equipos"],"negocio":{"modelo":"por-proyecto","precioMensualUSD":249,"costoVariableUSD":12,"valorClienteUSD":2100,"adopcion":0.12,"esfuerzoSemanas":16},"riesgos":["Alinear dos escaneos del mismo espacio con precisión es el problema técnico más difícil del plan; sin marcador de referencia el error se acumula."]},{"id":"gemelo","nombre":"Gemelo digital de activos","icon":"🧭","fase":3,"resumen":"Equipos y puntos de mantenimiento anclados a su lugar físico: apuntas el teléfono y aparece su ficha.","problema":"La ficha del activo vive en una planilla y el activo vive en un pasillo. Quien va a mantenerlo no encuentra ni el equipo ni su historial.","solucion":"Anclas persistentes en el espacio escaneado, ligadas al activo en KIMOS. El técnico apunta, ve el historial, deja la observación en el punto exacto.","requiere":["media.camera","sensor.imu"],"requiereAlguna":[["api.webxr.anchors","api.arcore.geospatial","api.arkit.mesh"]],"prefiere":["depth.dtof","api.arcore.geospatial","sensor.gnss"],"degradado":"Anclas por código QR pegado en el activo: menos elegante, funciona en todas partes y no se pierde.","sinSoporte":"Ficha del activo por búsqueda, sin ubicación.","salidas":["mapa de activos","historial por punto","ruta de mantenimiento"],"kimos":["archivos","kanban","integraciones","equipos"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":199,"costoVariableUSD":9,"valorClienteUSD":1800,"adopcion":0.08,"esfuerzoSemanas":18},"riesgos":["La persistencia de anclas entre sesiones y equipos distintos es frágil: el QR de respaldo no es opcional."]},{"id":"terreno","nombre":"Terreno y nubes públicas","icon":"🛰️","fase":3,"resumen":"Importar LiDAR aéreo público (USGS, IGN, OpenTopography) y cruzarlo con lo capturado a mano.","problema":"Los datos de elevación existen y son gratis, pero llegan en formatos que nadie abre en una reunión y no se cruzan con lo medido en terreno.","solucion":"Visor de nubes de puntos y modelos de elevación en el navegador, recorte por zona, perfiles de terreno, y superposición del escaneo de mano sobre el modelo público georreferenciado.","requiere":["runtime.web"],"requiereAlguna":[["compute.webgpu","compute.wasm.simd"]],"prefiere":["compute.webgpu","io.filesystem","sensor.gnss"],"degradado":"Sin WebGPU se recorta la nube en servidor y se muestra un mosaico ligero.","sinSoporte":"Descarga directa del recorte para abrirlo en un escritorio SIG.","salidas":["LAS/LAZ recortado","perfil de terreno","curvas de nivel","vista 3D compartible"],"kimos":["archivos","panel-html","gantt"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":99,"costoVariableUSD":12,"valorClienteUSD":700,"adopcion":0.06,"esfuerzoSemanas":10},"riesgos":["El costo de servir nubes grandes es el que manda: sin recorte y teselado, la factura de nube se dispara."]},{"id":"cuerpo","nombre":"Medidas corporales y postura","icon":"🧍","fase":3,"resumen":"Tallas, ergonomía y seguimiento de postura a partir del cuerpo capturado en 3D.","problema":"La talla equivocada es la primera causa de devolución en ropa, y evaluar postura en un puesto de trabajo requiere equipo caro o el ojo de alguien.","solucion":"Captura del cuerpo con profundidad, medidas antropométricas repetibles y comparación entre sesiones, con consentimiento explícito y borrado a demanda.","requiere":["media.camera"],"requiereAlguna":[["depth.structured","api.arkit.body","depth.dtof"]],"prefiere":["depth.structured","api.arkit.body","compute.npu"],"degradado":"Sin profundidad, estimación por pose 2D: sirve para tendencia, no para talla.","sinSoporte":"Ficha manual de medidas.","salidas":["medidas antropométricas","evolución por sesión","recomendación de talla"],"kimos":["productos","tienda","clientes"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":129,"costoVariableUSD":6,"valorClienteUSD":900,"adopcion":0.05,"esfuerzoSemanas":14},"riesgos":["Dato biométrico: consentimiento, minimización, borrado y ninguna promesa clínica. Si el cliente lo quiere para diagnóstico, cambia el marco regulatorio completo y esto ya no aplica."]},{"id":"accesibilidad","nombre":"Asistente de entorno","icon":"🦯","fase":3,"resumen":"Detección de obstáculos, puertas y desniveles con aviso por voz y vibración.","problema":"Los espacios que una empresa opera no son igual de transitables para todo el mundo, y la normativa de accesibilidad se audita a mano.","solucion":"Dos usos sobre el mismo motor: asistencia en vivo para la persona que recorre, y auditoría de accesibilidad del local escaneado (anchos de paso, altura de mesones, desniveles).","requiere":["media.camera"],"requiereAlguna":[["depth.dtof","depth.itof","api.arcore.semantics","api.arcore.depth"]],"prefiere":["depth.dtof","api.arcore.semantics","compute.npu"],"degradado":"Sin semántica, avisa por distancia y desnivel, sin nombrar el obstáculo.","sinSoporte":"Auditoría a partir de un escaneo hecho en otro equipo.","salidas":["informe de accesibilidad","avisos en vivo","puntos críticos"],"kimos":["archivos","kanban"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":59,"costoVariableUSD":3,"valorClienteUSD":400,"adopcion":0.04,"esfuerzoSemanas":12},"riesgos":["Asistencia en vivo a una persona con discapacidad visual: un falso negativo es un daño físico. O se hace con estándar de seguridad y batería, o se deja en auditoría."]},{"id":"presencia","nombre":"Personas, aforo y zonas","icon":"👥","fase":1,"resumen":"Detectar y contar personas y vehículos en vivo, y avisar cuando alguien entra en una zona donde no debe estar.","problema":"La cámara ya está instalada y nadie la mira. Cuando pasa algo, el vídeo sirve para revisar después, no para evitarlo.","solucion":"Detección y seguimiento en vivo sobre la cámara del equipo o sobre el flujo de una cámara remota, con zonas dibujadas por el usuario, conteo de aforo y aviso cuando se cruza una línea o se ocupa un área restringida.","requiere":["media.camera"],"requiereAlguna":[["api.vision.ondevice","api.vision.servidor"]],"prefiere":["api.vision.ondevice","compute.npu","media.stream.rtmp"],"degradado":"Sin inferencia en el equipo, el vídeo se analiza en servidor: funciona igual pero con latencia de segundos y costo por hora de cámara.","sinSoporte":"Consultar el histórico de aforo y los avisos que generaron otros equipos.","salidas":["conteo por franja horaria","avisos de zona","clip del evento","mapa de calor de ocupación"],"kimos":["panel-html","kanban","archivos","equipos"],"negocio":{"modelo":"por-punto","precioMensualUSD":49,"costoVariableUSD":8,"valorClienteUSD":420,"adopcion":0.25,"esfuerzoSemanas":10},"riesgos":["Contar personas es anónimo; identificarlas es dato biométrico y cambia el marco legal entero. El módulo cuenta y sigue dentro de la escena, no reconoce identidades.","Una zona mal dibujada genera avisos falsos todo el día y el equipo deja de mirarlos: la calibración inicial no es opcional."]},{"id":"epp","nombre":"Supervisión de implementos de seguridad","icon":"🦺","fase":1,"resumen":"Ver si cada persona lleva puesto el equipo de protección que su faena exige, y dejar registro de lo que faltó.","problema":"El control de EPP se hace con la vista de un supervisor que no puede estar en todos los accesos ni todo el turno. Cuando ocurre un accidente, no hay registro de si la persona entró protegida.","solucion":"Detección de persona y, sobre cada una, del equipo de protección exigido por el rubro (casco, chaleco, mascarilla, lentes, guantes, calzado, arnés, cofia, bata). Funciona en el acceso con un tótem, en ronda con un teléfono o sobre el vídeo de un dron o una cámara fija. Cada incumplimiento queda con foto, hora, punto y regla aplicada.","requiere":["media.camera"],"requiereAlguna":[["api.vision.ondevice","api.vision.servidor"]],"prefiere":["api.vision.ondevice","compute.npu","media.stream.rtmp"],"degradado":"Con vídeo remoto de baja resolución solo se sostienen las prendas grandes (casco, chaleco, bata). Guantes, lentes y tapones exigen cercanía: la app lo dice antes, no después.","sinSoporte":"Revisar los reportes y las evidencias capturadas por otros equipos.","salidas":["registro de cumplimiento por persona y turno","evidencia fotográfica con la regla aplicada","reporte por faena","alerta en el momento"],"kimos":["kanban","archivos","equipos","panel-html","clientes"],"negocio":{"modelo":"por-punto","precioMensualUSD":89,"costoVariableUSD":12,"valorClienteUSD":760,"adopcion":0.22,"esfuerzoSemanas":14},"riesgos":["Un falso negativo es un riesgo físico real: el sistema AVISA, no reemplaza al supervisor, y así tiene que decirlo en pantalla y en el contrato.","Supervisar a trabajadores con cámara está regulado (información previa, proporcionalidad, y en varios países consulta al comité paritario o al sindicato). Sin ese trámite hecho, el módulo no se enciende.","Detectar que alguien no lleva casco no es identificar quién es. Ligar el incumplimiento a una persona concreta es otro tratamiento de datos, con otro consentimiento."],"estrategico":true},{"id":"termico","nombre":"Termografía de equipos y procesos","icon":"🌡️","fase":3,"resumen":"Medir temperatura de tableros, motores, cámaras de frío y procesos con una cámara térmica, y avisar cuando algo se sale de rango.","problema":"Un rodamiento caliente o una cámara de frío fuera de rango se descubre cuando ya falló. La inspección termográfica se contrata dos veces al año y el resto del tiempo nadie mira.","solucion":"Lectura radiométrica por punto y por zona sobre la imagen térmica, con umbrales por tipo de activo, comparación entre inspecciones y aviso automático. Se apoya en el mismo mapa de activos del gemelo digital.","requiere":["sensor.thermal","media.camera"],"requiereAlguna":[["api.vision.ondevice","api.vision.servidor"]],"prefiere":["compute.npu","sensor.gnss"],"degradado":"Sin modelo de detección, la lectura es manual: el usuario marca el punto y la app registra la temperatura y el umbral.","sinSoporte":"Ningún teléfono mide temperatura: sin accesorio térmico o dron térmico, el módulo solo muestra inspecciones hechas con otro equipo.","salidas":["lectura por punto con umbral","comparativa entre inspecciones","reporte termográfico","alerta por desvío"],"kimos":["kanban","archivos","gantt","integraciones"],"negocio":{"modelo":"por-cuenta","precioMensualUSD":149,"costoVariableUSD":10,"valorClienteUSD":1100,"adopcion":0.05,"esfuerzoSemanas":10},"riesgos":["Medir temperatura corporal de personas es otro producto y otro marco regulatorio: en EE. UU. la FDA lo trata como dispositivo médico y ha sancionado a quien lo vendió sin autorización. Este módulo mide EQUIPOS y PROCESOS, y la app rechaza el uso sobre personas.","La precisión depende de emisividad, distancia y ambiente: sin protocolo de medición, dos inspecciones no son comparables."]},{"id":"biometria","nombre":"Identidad y biometría","icon":"🪪","fase":3,"resumen":"Identificar a las personas en los puntos de control: primero por credencial, y con verificación facial cuando el riesgo lo justifica y el expediente legal está hecho.","problema":"Un incumplimiento de EPP sin persona detrás no se puede gestionar, y una credencial prestada convierte el control de acceso en un trámite. Al mismo tiempo, poner reconocimiento facial \"porque se puede\" es la forma más rápida de exponer a la organización a una multa.","solucion":"Escalera de identidad con tres peldaños: credencial (NFC/QR/BLE), verificación 1:1 contra la plantilla del titular, e identificación 1:N solo donde el riesgo lo justifique. Plantillas irreversibles y cifradas —nunca fotografías—, prueba de vida apoyada en el sensor de profundidad, revocación real y registro de cada activación. La app no enciende ningún peldaño biométrico sin el expediente de cumplimiento completo.","requiere":["media.camera"],"requiereAlguna":[["api.vision.ondevice","api.vision.servidor"]],"prefiere":["api.vision.ondevice","compute.npu","depth.dtof","depth.structured"],"degradado":"Sin sensor de profundidad no hay prueba de vida sólida: en ese caso la verificación facial se ofrece solo con supervisión humana en el punto, o no se ofrece.","sinSoporte":"Identidad por credencial, sin biometría. Resuelve la mayoría de los casos y no trata datos sensibles.","salidas":["evento de acceso con identidad","constancia de consentimiento","registro de activación y de revocación","reporte de incumplimientos por persona"],"kimos":["clientes","equipos","kanban","archivos","integraciones"],"negocio":{"modelo":"por-punto","precioMensualUSD":119,"costoVariableUSD":14,"valorClienteUSD":860,"adopcion":0.06,"esfuerzoSemanas":16},"riesgos":["Dato biométrico = categoría especial en la Ley 21.719 (vigente el 1 de diciembre de 2026): consentimiento explícito, EIPD previa y justificación de por qué no basta una alternativa menos invasiva. Sin eso, la app no lo enciende.","Guardar fotografías en vez de plantillas irreversibles es el error que convierte una multa en un incidente público. El diseño solo admite plantillas.","La revocación tiene que borrar de verdad: plantilla, derivados y copias. Un sistema biométrico que no sabe olvidar no cumple el derecho de cancelación.","Sesgo: las tasas de error de la comparación facial no son iguales para todos los grupos. Cualquier consecuencia laboral exige revisión humana, siempre.","En una relación laboral el consentimiento rara vez es libre: si negarse tiene costo, no es consentimiento. Por eso la escalera empieza en la credencial."]}]},"licencias":{"version":"1.0.0","actualizado":"2026-08-25","principio":"Ninguna biblioteca entra al producto sin licencia compatible con software propietario distribuido, sin dependencia con ejecución en instalación y sin dueño desconocido. Ante la duda, no entra: casi siempre hay una alternativa permisiva.","politica":{"permitidas":[{"id":"MIT","nota":"Permisiva. Sin concesión explícita de patentes."},{"id":"Apache-2.0","nota":"Permisiva CON concesión de patentes: la preferida cuando existe la opción."},{"id":"BSD-2-Clause","nota":"Permisiva."},{"id":"BSD-3-Clause","nota":"Permisiva; prohíbe usar el nombre del autor para promocionar."},{"id":"ISC","nota":"Equivalente a MIT."},{"id":"Zlib","nota":"Permisiva."},{"id":"Unlicense","nota":"Dominio público."},{"id":"CC0-1.0","nota":"Dominio público; válida para datos y assets, no ideal para código."},{"id":"BSL-1.0","nota":"Boost: permisiva, sin obligación de aviso en binarios."}],"condicionales":[{"id":"MPL-2.0","condicion":"Copyleft por archivo. Se puede usar SIN modificar y manteniendo los archivos separados; si se modifica el archivo, ese archivo se publica. Requiere revisión antes de entrar."},{"id":"LGPL-2.1","condicion":"Exige enlace dinámico y permitir reemplazo de la biblioteca. En un bundle de JavaScript eso casi nunca se cumple: en web, tratar como prohibida."},{"id":"LGPL-3.0","condicion":"Igual que LGPL-2.1 más cláusula antitivoización. En apps móviles firmadas es un problema real."},{"id":"EPL-2.0","condicion":"Copyleft débil por archivo; revisión legal antes de usar."},{"id":"CC-BY-4.0","condicion":"Válida para datos y assets con atribución visible. No para código."}],"prohibidas":[{"id":"GPL-2.0","razon":"Obliga a publicar el código del producto que la enlaza."},{"id":"GPL-3.0","razon":"Igual, más cláusulas de patentes y antitivoización."},{"id":"AGPL-3.0","razon":"Extiende la obligación al servicio en red: contamina el backend de KIMOS."},{"id":"SSPL-1.0","razon":"No es open source aprobada y su alcance sobre servicios es inaceptable para un SaaS."},{"id":"BUSL-1.1","razon":"Fuente disponible con restricción de uso comercial por N años."},{"id":"Commons-Clause","razon":"Prohíbe vender el software: incompatible con un producto de pago."},{"id":"CC-BY-NC","razon":"No comercial. KIMOS es comercial."},{"id":"Elastic-2.0","razon":"Restringe ofrecer el software como servicio gestionado."},{"id":"Investigacion-No-Comercial","razon":"Licencias académicas tipo 'solo investigación' (Inria, NVIDIA Source): explícitamente fuera de uso comercial."},{"id":"Sin-licencia","razon":"Sin licencia no hay permiso: el código con LICENSE ausente es, por defecto, todos los derechos reservados."}]},"reglasCadenaSuministro":["Cero dependencias en el núcleo y en los bundles que se distribuyen: lo que no se instala, no se puede comprometer.","Versión fijada (sin ^ ni ~) y archivo de bloqueo commiteado para cualquier dependencia de desarrollo.","Instalación con scripts deshabilitados (`npm ci --ignore-scripts`): la ejecución de código en instalación es el vector más usado.","Nada de CDN en tiempo de ejecución: todo recurso se sirve desde el propio origen. Además de seguridad, evita fugas de datos del usuario a terceros.","SBOM (CycloneDX) generado en cada publicación y guardado junto al artefacto.","Una dependencia nueva se aprueba mirando cuatro cosas: licencia, número de mantenedores, actividad del último año y árbol de dependencias transitivas.","Los pesos de modelos de IA se auditan aparte del código: es habitual que el código sea Apache-2.0 y los pesos no comerciales."],"bibliotecas":[{"nombre":"three.js","uso":"Visor 3D en la web","licencia":"MIT","veredicto":"usar","nota":"Estándar de facto, sin dependencias pesadas."},{"nombre":"@google/model-viewer","uso":"Ficha de producto en 3D/AR (Quick Look y Scene Viewer)","licencia":"Apache-2.0","veredicto":"usar","nota":"Resuelve el AR de catálogo en una etiqueta HTML. Servirlo desde el propio origen, no desde CDN."},{"nombre":"Draco","uso":"Compresión de mallas","licencia":"Apache-2.0","veredicto":"usar"},{"nombre":"meshoptimizer","uso":"Simplificación y optimización de mallas","licencia":"MIT","veredicto":"usar"},{"nombre":"glTF-Transform","uso":"Pipeline de glTF/GLB","licencia":"MIT","veredicto":"usar"},{"nombre":"KTX2 / Basis Universal","uso":"Texturas comprimidas","licencia":"Apache-2.0","veredicto":"usar"},{"nombre":"Potree","uso":"Visor de nubes de puntos masivas","licencia":"BSD-2-Clause","veredicto":"usar"},{"nombre":"CesiumJS","uso":"Terreno y 3D Tiles","licencia":"Apache-2.0","veredicto":"usar"},{"nombre":"loaders.gl / deck.gl","uso":"Lectura de LAS/LAZ y capas de datos","licencia":"MIT","veredicto":"usar"},{"nombre":"PDAL","uso":"Proceso de nubes de puntos en servidor","licencia":"BSD-3-Clause","veredicto":"usar"},{"nombre":"Open3D","uso":"Registro y mallado en servidor","licencia":"MIT","veredicto":"usar"},{"nombre":"PCL","uso":"Algoritmos clásicos de nubes de puntos","licencia":"BSD-3-Clause","veredicto":"usar"},{"nombre":"OpenCV","uso":"Visión por computador","licencia":"Apache-2.0","veredicto":"usar","nota":"Apache-2.0 desde la 4.5; versiones anteriores eran BSD-3. Fijar versión."},{"nombre":"ONNX Runtime","uso":"Inferencia en el dispositivo","licencia":"MIT","veredicto":"usar"},{"nombre":"MediaPipe / TensorFlow Lite","uso":"Pose y segmentación en el dispositivo","licencia":"Apache-2.0","veredicto":"usar","nota":"El código sí; cada modelo preentrenado trae su propia licencia y se revisa por separado."},{"nombre":"laz-perf","uso":"Lectura de LAZ en el navegador","licencia":"Apache-2.0","veredicto":"condicional","nota":"Confirmar el LICENSE de la versión fijada: el ecosistema LASzip mezcla LGPL en algunas piezas."},{"nombre":"Entwine","uso":"Teselado de nubes de puntos","licencia":"LGPL-2.1","veredicto":"condicional","nota":"Solo como herramienta de servidor ejecutada como proceso aparte, nunca enlazada al producto."},{"nombre":"FFmpeg","uso":"Vídeo de la captura","licencia":"LGPL-2.1 (o GPL según compilación)","veredicto":"condicional","nota":"Compilar sin componentes GPL y ejecutarlo como binario separado. Revisar además patentes de códecs."},{"nombre":"COLMAP","uso":"Fotogrametría (structure from motion)","licencia":"BSD-3-Clause","veredicto":"condicional","nota":"Revisar componentes opcionales de terceros antes de empaquetar."},{"nombre":"OpenMVG","uso":"Fotogrametría","licencia":"MPL-2.0","veredicto":"condicional","nota":"Copyleft por archivo: usar sin modificar."},{"nombre":"AliceVision / Meshroom","uso":"Fotogrametría completa","licencia":"MPL-2.0 + terceros","veredicto":"condicional","nota":"El árbol incluye piezas con otras licencias; auditar antes de distribuir."},{"nombre":"Unity","uso":"Motor para AR avanzada","licencia":"Comercial (EULA)","veredicto":"condicional","nota":"Decisión de costo y de dependencia de proveedor, no de licencia libre. Evitable con ARKit/ARCore nativos y three.js en web."},{"nombre":"Unreal Engine","uso":"Motor para AR avanzada","licencia":"EULA con regalías","veredicto":"condicional","nota":"Regalías sobre ingresos del producto que lo incorpore."},{"nombre":"OpenMVS","uso":"Reconstrucción densa","licencia":"AGPL-3.0","veredicto":"prohibida","nota":"Contamina el servicio en red. Alternativa: Open3D + PDAL."},{"nombre":"CGAL","uso":"Geometría computacional","licencia":"GPL-3.0 / comercial","veredicto":"prohibida","nota":"Solo con licencia comercial pagada. Alternativa: Open3D, libigl (MPL-2.0)."},{"nombre":"3D Gaussian Splatting (implementación original Inria/MPII)","uso":"Renderizado neuronal","licencia":"Investigación no comercial","veredicto":"prohibida","nota":"Alternativa comercialmente utilizable: gsplat (Apache-2.0), verificando también los pesos."},{"nombre":"instant-ngp (NVIDIA)","uso":"NeRF rápido","licencia":"NVIDIA Source Code License (no comercial)","veredicto":"prohibida"},{"nombre":"SDK de Polycam / Matterport","uso":"Escaneo de terceros","licencia":"Comercial","veredicto":"condicional","nota":"Depender del SDK de un competidor directo es riesgo de negocio antes que legal."}],"datos":[{"fuente":"USGS 3DEP / Earth Explorer","licencia":"Dominio público (obra del gobierno de EE. UU.)","veredicto":"usar","nota":"Citar la fuente por buena práctica."},{"fuente":"NOAA Digital Coast","licencia":"Dominio público","veredicto":"usar"},{"fuente":"OpenTopography","licencia":"Varía por conjunto de datos","veredicto":"condicional","nota":"Cada dataset trae su cita y su licencia: se guarda junto al archivo importado."},{"fuente":"IGN España — Centro de Descargas","licencia":"CC-BY 4.0","veredicto":"usar","nota":"Atribución obligatoria y visible en el visor y en los PDF exportados."},{"fuente":"Copernicus / EU-DEM","licencia":"Licencia Copernicus","veredicto":"usar","nota":"Atribución obligatoria."},{"fuente":"OpenStreetMap","licencia":"ODbL","veredicto":"condicional","nota":"TRAMPA CLÁSICA: es share-alike sobre bases de datos derivadas. Se puede usar como mapa base, pero mezclarlo con los datos del cliente puede obligar a publicar el resultado. Preferir un mapa base con licencia permisiva para datos de clientes."}],"otrosRiesgos":[{"tema":"Imágenes de personas en las capturas","riesgo":"Una captura de un local incluye caras y matrículas: es dato personal.","medida":"Difuminado automático antes de subir, retención configurable y borrado a demanda."},{"tema":"Datos biométricos (módulo de cuerpo)","riesgo":"Categoría especial en RGPD y equivalentes; consentimiento explícito y finalidad acotada.","medida":"Consentimiento por sesión, proceso en el dispositivo cuando se pueda, y ninguna afirmación clínica."},{"tema":"Medidas usadas para facturar","riesgo":"Cobrar por volumen medido exige certificación metrológica legal (NTEP y equivalentes nacionales).","medida":"La app marca las medidas como referenciales y no las ofrece para facturación mientras no exista certificación."},{"tema":"Términos de las plataformas","riesgo":"ARKit, ARCore, App Store y Play imponen reglas sobre uso de cámara y datos de profundidad.","medida":"Declarar finalidad en la ficha de la tienda y en los permisos; nada de recolección secundaria."},{"tema":"Marcas de terceros","riesgo":"Nombrar equipos y competidores en la app.","medida":"Uso nominativo y descriptivo (lista de compatibilidad), sin logotipos ni sugerencia de respaldo."}]},"rubros":{"version":"1.0.0","actualizado":"2026-08-25","esquema":1,"nota":"Base de conocimiento por rubro. Cada entrada traduce una industria a decisiones concretas: qué módulos importan, con qué tolerancia se trabaja, qué flujo se ejecuta, qué KPI mejora y qué se le dice a un prospecto de ese rubro. Es DATO, no código: un rubro nuevo se añade aquí (o en un pack externo validado con tools/validar-pack.mjs) sin tocar el motor.","convenciones":{"tolerancia":"{ m: error máximo aceptable en metros, aDistancia: distancia de referencia en metros }. El motor la cruza con el sensor activo para decir si el equipo sirve para ese rubro.","prioridad":"1 = el módulo por el que entra el rubro; 2 y 3 = lo que se suma después.","origen":"Lo llena el cargador de packs: 'base' para este archivo, el id del pack para los añadidos."},"rubros":[{"id":"construccion","nombre":"Construcción y remodelación","icon":"🏗️","cliente":"Constructoras chicas y medianas, contratistas de remodelación, arquitectos con obra.","dolor":"Cada partida se presupuesta con medidas tomadas a mano en una visita, y cuando falta una cota hay que volver. Lo medido no queda registrado, así que la diferencia con el cliente se discute de memoria.","tolerancia":{"m":0.03,"aDistancia":3},"toleranciaNota":"Suficiente para presupuestar y para acotar un plano de partida. Para cortar material se remide a mano en el punto: ningún sensor de bolsillo reemplaza eso.","modulos":[{"id":"espacios","prioridad":1,"para":"Levantar el recinto y sacar el plano acotado con superficies por ambiente."},{"id":"obra","prioridad":2,"para":"Comparar el mismo espacio entre visitas y dejar evidencia fechada del avance."},{"id":"medir","prioridad":3,"para":"Cotas sueltas durante la visita, con su banda de error."},{"id":"epp","prioridad":2,"para":"Casco, chaleco y calzado en accesos y rondas, con evidencia por turno."},{"id":"presencia","prioridad":3,"para":"Aforo por frente de trabajo y aviso de zona restringida."}],"flujos":[{"id":"levantamiento-presupuesto","nombre":"De la visita al presupuesto sin volver","pasos":["Escanear cada recinto (30-60 s por ambiente)","Revisar el plano y corregir muros dudosos en el sitio","Exportar superficies por recinto a la planilla de partidas","Adjuntar plano y fotos acotadas a la cotización"],"entrega":["Plano DXF acotado","Superficies por recinto (CSV)","PDF con fotos acotadas"],"kimos":["pedidos","archivos","gantt"]},{"id":"avance-quincenal","nombre":"Estado de pago con evidencia","pasos":["Escanear las mismas zonas cada quincena","Comparar contra el escaneo anterior","Marcar observaciones ancladas al punto físico","Emitir reporte firmado"],"entrega":["Comparativa por fecha","Reporte PDF firmado","Observaciones ancladas"],"kimos":["gantt","kanban","archivos","equipos"]}],"kpis":[{"id":"visitas","label":"Visitas a terreno por partida","meta":"De 2-3 a 1"},{"id":"horas","label":"Horas de levantamiento por vivienda","meta":"De 3-4 h a 40 min"},{"id":"disputas","label":"Disputas de avance por proyecto","meta":"Bajar a la mitad con evidencia fechada"}],"equiposRecomendados":["apple.ipadpro.2020+","apple.iphone.pro.12-17"],"normativa":["El acta de avance con evidencia fechada tiene valor si la firman ambas partes: la app la genera, no la reemplaza."],"prospeccion":{"senales":["Más de dos visitas a terreno por semana","Presupuestos que se rehacen por medidas","Discusiones de avance con el mandante"],"preguntas":["¿Cuántas veces vuelven a medir lo mismo en un proyecto?","¿Cuánto tarda una persona en levantar una vivienda completa?","¿Cómo respaldan hoy el avance cuando el cliente lo discute?"],"demo":"Escanear la sala de reuniones del propio prospecto y mostrarle su plano acotado antes de que termine el café.","objeciones":[{"objecion":"Ya tenemos distanciómetro láser.","respuesta":"El láser da una cota; esto da el recinto completo, con plano exportable y registro de quién midió y cuándo. La discusión de avance no se gana con una cota suelta."},{"objecion":"Mis maestros no van a usar una app.","respuesta":"El que escanea es quien ya va a terreno a medir, y el escaneo tarda menos que sacar el flexómetro. Lo que cambia es que queda registrado."}],"ahorro":{"supuesto":"2 visitas evitadas por semana × 3 h × valor hora del profesional","formula":"visitasEvitadas * horasPorVisita * valorHora * 4.33"}},"kimos":["gantt","kanban","archivos","pedidos","equipos"]},{"id":"inmobiliaria","nombre":"Corretaje, arriendo y administración","icon":"🏡","cliente":"Corredoras de propiedades, administradoras de arriendo, portales inmobiliarios.","dolor":"Publicar una propiedad exige fotos, medidas y plano. El plano casi nunca existe, y las visitas presenciales se gastan en gente que se va apenas ve la distribución.","tolerancia":{"m":0.05,"aDistancia":3},"toleranciaNota":"Publicar superficie es una afirmación comercial: se publica la medida del escaneo como referencial y se distingue útil de construida.","modulos":[{"id":"espacios","prioridad":1,"para":"Plano y modelo 3D de la propiedad en una sola visita."},{"id":"vitrina-ar","prioridad":2,"para":"Que el interesado recorra la distribución antes de pedir visita."},{"id":"medir","prioridad":3,"para":"Cotas puntuales para la ficha."}],"flujos":[{"id":"ficha-propiedad","nombre":"Una visita, ficha completa","pasos":["Escanear la propiedad completa","Generar plano y superficies por recinto","Publicar el recorrido 3D en la ficha","Archivar el escaneo como estado de entrega"],"entrega":["Plano 2D","Recorrido 3D compartible","Superficie por recinto"],"kimos":["vitrina","archivos","prospeccion","clientes"]},{"id":"estado-entrega","nombre":"Entrega y devolución sin discusión","pasos":["Escanear al entregar","Escanear al devolver","Comparar y adjuntar al contrato"],"entrega":["Comparativa fechada","Reporte de estado"],"kimos":["archivos","clientes"]}],"kpis":[{"id":"dias","label":"Días en mercado","meta":"Bajar con ficha 3D"},{"id":"visitas","label":"Visitas presenciales por cierre","meta":"Menos visitas improductivas"},{"id":"disputas","label":"Disputas de estado en devolución","meta":"Evidencia en vez de fotos sueltas"}],"equiposRecomendados":["apple.iphone.pro.12-17","apple.ipadpro.2020+"],"normativa":["La superficie publicada compromete: marcarla como referencial y no mezclar útil con construida."],"prospeccion":{"senales":["Cartera sobre 20 propiedades","Fichas sin plano","Reclamos de estado en devolución de arriendo"],"preguntas":["¿Cuántas visitas presenciales hacen por cada cierre?","¿Sus fichas tienen plano?","¿Cómo prueban el estado de entrega de un arriendo?"],"demo":"Escanear la oficina del corredor y mostrarle el recorrido 3D en su propio teléfono, con el enlace listo para pegar en una ficha.","objeciones":[{"objecion":"Ya contratamos fotógrafo con tour 360°.","respuesta":"El tour muestra; esto además mide. La ficha queda con superficie por recinto y plano, que es lo que el interesado pregunta por teléfono."}],"ahorro":{"supuesto":"Visitas improductivas evitadas por mes × costo de traslado y hora del corredor","formula":"visitasEvitadas * costoVisita"}},"kimos":["vitrina","prospeccion","clientes","archivos","tienda"]},{"id":"retail-mobiliario","nombre":"Retail y mobiliario en línea","icon":"🛋️","cliente":"Tiendas de muebles, decoración, electrodomésticos y equipamiento que venden en línea.","dolor":"El catálogo no tiene 3D porque modelar cuesta caro, y sin 3D no hay vista AR. La devolución por 'no me cabe' o 'no combina' se paga entera.","tolerancia":{"m":0.05,"aDistancia":2},"toleranciaNota":"Para AR importa más la escala correcta que el milímetro: un modelo con el tamaño real bien puesto convence; uno a escala equivocada destruye la confianza.","modulos":[{"id":"objetos","prioridad":1,"para":"Convertir el producto real en modelo 3D con su medida real."},{"id":"vitrina-ar","prioridad":2,"para":"Que el comprador lo ponga en su casa a escala 1:1."},{"id":"volumen","prioridad":3,"para":"Peso volumétrico para el despacho."},{"id":"presencia","prioridad":3,"para":"Aforo y recorrido en sala de ventas."}],"flujos":[{"id":"producto-a-ficha","nombre":"Del producto físico a la ficha con AR","pasos":["Escanear el producto en bodega","Revisar malla y medida real","Publicar el GLB y el tamaño real al producto de KIMOS","Activar la vista AR en la ficha"],"entrega":["GLB optimizado","USDZ","Medida real (lado mayor en cm)","Peso volumétrico"],"kimos":["productlab","productos","tienda","vitrina"]}],"kpis":[{"id":"devoluciones","label":"Tasa de devolución","meta":"Referencia de mercado: hasta 40% menos con 3D en la ficha"},{"id":"conversion","label":"Conversión de la ficha","meta":"Referencia de mercado: hasta 94% más con 3D"},{"id":"costoModelo","label":"Costo por modelo 3D","meta":"De cientos de dólares a minutos de captura"}],"equiposRecomendados":["apple.iphone.pro.12-17","android.arcore.generico"],"normativa":["Las cifras de conversión y devolución son agregados de plataforma, no experimentos controlados: se usan como referencia, no como promesa al cliente."],"prospeccion":{"senales":["Catálogo sobre 50 productos sin 3D","Devoluciones por tamaño","Ya usa ProductLab o Tienda de KIMOS"],"preguntas":["¿Cuánto les cuesta hoy un modelo 3D de un producto?","¿Qué porcentaje de devoluciones es por tamaño o color?","¿Cuántos productos publicarían en 3D si costara minutos?"],"demo":"Escanear un producto que el prospecto tenga a mano y ponerlo en AR en su propia oficina, a escala real, en menos de cinco minutos.","objeciones":[{"objecion":"Nuestros productos ya tienen buenas fotos.","respuesta":"La foto no responde '¿me cabe?'. El modelo con medida real sí, y esa es la pregunta que genera la devolución."},{"objecion":"El escaneo no queda perfecto.","respuesta":"Para la ficha no hace falta perfección: hace falta escala correcta y silueta creíble. Para el producto estrella se retoca; para los otros 200, esto es la diferencia entre tener 3D y no tenerlo."}],"ahorro":{"supuesto":"Devoluciones evitadas al mes × costo logístico de una devolución","formula":"pedidosMes * tasaDevolucion * reduccion * costoDevolucion"}},"kimos":["productlab","productos","tienda","vitrina","pedidos"]},{"id":"logistica","nombre":"Logística, bodega y 3PL","icon":"🚚","cliente":"Operadores logísticos, bodegas de comercio electrónico, empresas que despachan volumen.","dolor":"El transportista cobra por volumen y el cubicaje se hace a ojo o con huincha. La diferencia sale del margen del que despacha, y nadie sabe cuánto se pierde.","tolerancia":{"m":0.02,"aDistancia":1},"toleranciaNota":"Para uso interno alcanza. Para facturar hace falta certificación metrológica legal (NTEP o equivalente): la app marca las medidas como referenciales mientras no exista.","modulos":[{"id":"volumen","prioridad":1,"para":"Volumen de bultos y pallets con peso volumétrico por tarifa."},{"id":"objetos","prioridad":2,"para":"Fichar el producto con su medida real para calcular el embalaje antes de comprarlo."},{"id":"espacios","prioridad":3,"para":"Planificar el uso de la bodega y el espacio de carga."},{"id":"epp","prioridad":3,"para":"Chaleco y calzado en patio de maniobras, donde conviven personas y grúas."},{"id":"presencia","prioridad":2,"para":"Zonas de tránsito peatonal contra rutas de grúa horquilla."}],"flujos":[{"id":"cubicaje","nombre":"Cubicaje en el mesón de despacho","pasos":["Apuntar al bulto y medir","Calcular peso volumétrico por tarifa del transportista","Adjuntar la ficha al pedido","Contrastar contra lo facturado por el transportista"],"entrega":["Ficha de bulto","Peso volumétrico","Diferencia contra lo facturado"],"kimos":["pedidos","productos","integraciones"]}],"kpis":[{"id":"diferencia","label":"Diferencia entre volumen facturado y real","meta":"Detectarla, que hoy no se ve"},{"id":"ocupacion","label":"Ocupación del camión","meta":"Subir con plan de carga"},{"id":"tiempo","label":"Tiempo de cubicaje por bulto","meta":"De minutos a segundos"}],"equiposRecomendados":["apple.iphone.pro.12-17","samsung.tof.2019-2020"],"normativa":["NTEP y equivalentes nacionales para medidas usadas en facturación.","Sin certificación, el uso es interno y la app lo dice en pantalla."],"prospeccion":{"senales":["Despachos sobre 200 bultos al mes","Reclamos de sobrecobro al transportista","Cubicaje manual en el mesón"],"preguntas":["¿Cómo miden hoy un bulto irregular?","¿Han comparado lo que factura el transportista con el volumen real?","¿Cuánto tiempo toma cubicar un pallet?"],"demo":"Medir una caja del prospecto y mostrar el peso volumétrico con su propia tarifa, comparado con lo que le cobraron la última vez.","objeciones":[{"objecion":"Esto no sirve para facturar.","respuesta":"Correcto, y lo decimos en pantalla. Sirve para saber cuánto se está perdiendo y para reclamar con un número propio, que hoy no existe."}],"ahorro":{"supuesto":"Bultos al mes × sobrecobro promedio detectado por bulto","formula":"bultosMes * sobrecobroPorBulto"}},"kimos":["pedidos","productos","integraciones","panel-html"]},{"id":"manufactura","nombre":"Fabricación a medida y carpintería","icon":"🪚","cliente":"Talleres de mueble a medida, metalmecánica liviana, fabricantes que venden configurable.","dolor":"Vender a medida exige mostrar cómo queda antes de fabricar. Modelar cada producto para el configurador es el cuello de botella: el taller tiene el mueble, no el modelo.","tolerancia":{"m":0.005,"aDistancia":0.5},"toleranciaNota":"El escaneo NO da tolerancia de corte. Sirve para el modelo de venta y para la medida del espacio del cliente; el despiece sale del plano de fabricación, no del escaneo.","modulos":[{"id":"objetos","prioridad":1,"para":"Modelo 3D del producto terminado para el configurador de ProductLab."},{"id":"medir","prioridad":2,"para":"Medir el hueco donde va a ir el mueble, en casa del cliente."},{"id":"vitrina-ar","prioridad":3,"para":"Mostrarle al cliente el mueble en su propio espacio antes de fabricar."},{"id":"epp","prioridad":2,"para":"Lentes y calzado por línea de producción; la regla cambia por área."}],"flujos":[{"id":"mueble-a-configurador","nombre":"Del mueble del taller al configurador de la tienda","pasos":["Escanear la pieza terminada","Limpiar malla y fijar el lado mayor real","Cargar el GLB en ProductLab y definir partes y acabados","Generar los pasos del configurador desde el modelo"],"entrega":["GLB con partes","Lado mayor real en cm (habilita AR)","Pasos del configurador"],"kimos":["productlab","productos","tienda"]},{"id":"medida-en-casa","nombre":"Medida en casa del cliente","pasos":["Medir el hueco con foto acotada","Adjuntar la medida al pedido","Confirmar con AR que el mueble entra"],"entrega":["Foto acotada","Medidas al pedido"],"kimos":["pedidos","clientes","productlab"]}],"kpis":[{"id":"modelado","label":"Tiempo de modelado por producto","meta":"De horas de CAD a minutos de captura"},{"id":"catalogo3d","label":"Productos del catálogo con 3D","meta":"De unos pocos a todos"},{"id":"errores","label":"Pedidos con medida equivocada","meta":"Bajar con medida registrada en la visita"}],"equiposRecomendados":["apple.iphone.pro.12-17","apple.ipadpro.2020+"],"normativa":[],"prospeccion":{"senales":["Ya usa ProductLab con productos sin visor 3D","Vende a medida y visita al cliente para medir","Catálogo con muchas variantes de acabado"],"preguntas":["¿Cuántos productos de su catálogo tienen modelo 3D?","¿Quién los modela y cuánto demora?","¿Cuántos pedidos se rehacen por una medida mal tomada?"],"demo":"Escanear una pieza del taller y dejarla configurable en ProductLab en la misma reunión, con AR funcionando desde el QR.","objeciones":[{"objecion":"El escaneo no tiene precisión de fabricación.","respuesta":"No la tiene y no la necesita: el despiece sale del plano. Esto resuelve el modelo de venta, que hoy no existe porque modelar cuesta caro."}],"ahorro":{"supuesto":"Productos a modelar × costo de modelado externo evitado","formula":"productos * costoModeladoExterno"}},"kimos":["productlab","productos","tienda","pedidos","clientes"]},{"id":"seguros","nombre":"Seguros, peritaje y siniestros","icon":"📋","cliente":"Liquidadores de siniestros, corredores de seguros, áreas de riesgo.","dolor":"El peritaje se documenta con fotos y una planilla. Cuando la cifra se discute, no hay forma de reconstruir el estado real del lugar en la fecha de la visita.","tolerancia":{"m":0.03,"aDistancia":3},"toleranciaNota":"Lo que importa aquí no es el milímetro: es la trazabilidad —quién capturó, cuándo, con qué equipo y con qué error declarado—.","modulos":[{"id":"espacios","prioridad":1,"para":"Reconstruir el lugar completo en una visita."},{"id":"obra","prioridad":2,"para":"Comparar antes y después, y anclar observaciones al punto exacto."},{"id":"medir","prioridad":3,"para":"Cotas del daño con banda de error."}],"flujos":[{"id":"peritaje","nombre":"Peritaje con evidencia reconstruible","pasos":["Escanear el lugar del siniestro","Marcar y medir los daños","Generar reporte con fecha, autor y error declarado","Archivar el escaneo íntegro"],"entrega":["Modelo 3D del lugar","Reporte con daños medidos","Registro de trazabilidad"],"kimos":["archivos","clientes","kanban"]}],"kpis":[{"id":"tiempo","label":"Días de liquidación","meta":"Menos vueltas al lugar"},{"id":"disputas","label":"Liquidaciones disputadas","meta":"Bajar con evidencia reconstruible"}],"equiposRecomendados":["apple.iphone.pro.12-17"],"normativa":["Las capturas incluyen bienes y personas: difuminado antes de subir y retención acotada.","El valor probatorio depende del procedimiento del liquidador; la app aporta trazabilidad, no la reemplaza."],"prospeccion":{"senales":["Peritos en terreno todos los días","Liquidaciones que se discuten","Documentación solo fotográfica"],"preguntas":["¿Cómo reconstruyen hoy el estado del lugar cuando la cifra se discute?","¿Cuántas veces vuelve el perito al mismo siniestro?"],"demo":"Escanear una sala, marcar un 'daño' y emitir el reporte con fecha, autor y error declarado en dos minutos.","objeciones":[{"objecion":"Las fotos nos han bastado siempre.","respuesta":"Hasta que la contraparte discute una medida. La foto no se mide después; el escaneo sí, y con su error declarado."}],"ahorro":{"supuesto":"Visitas repetidas evitadas × costo de visita del perito","formula":"visitasEvitadas * costoVisita"}},"kimos":["archivos","clientes","kanban","equipos"]},{"id":"facility","nombre":"Mantenimiento y facility management","icon":"🔧","cliente":"Empresas que operan edificios, plantas, sucursales o flotas de locales.","dolor":"La ficha del activo vive en una planilla y el activo vive en un pasillo. Quien va a mantenerlo no encuentra ni el equipo ni su historial.","tolerancia":{"m":0.05,"aDistancia":3},"toleranciaNota":"Aquí manda la ubicación, no la cota: el valor es encontrar el activo y su historial en el punto físico.","modulos":[{"id":"gemelo","prioridad":1,"para":"Anclar la ficha del activo a su lugar físico."},{"id":"espacios","prioridad":2,"para":"Levantar el recinto donde viven los activos."},{"id":"accesibilidad","prioridad":3,"para":"Auditar anchos de paso, alturas y desniveles del local."},{"id":"termico","prioridad":3,"para":"Termografía de tableros eléctricos y equipos de clima."},{"id":"presencia","prioridad":3,"para":"Aforo por sala y uso real de los espacios."}],"flujos":[{"id":"mapa-activos","nombre":"Mapa de activos con historial en el punto","pasos":["Escanear el recinto","Anclar cada activo (con QR de respaldo)","Enlazar la ficha y el historial de KIMOS","Generar la ruta de mantenimiento"],"entrega":["Mapa de activos","Historial por punto","Ruta de mantenimiento"],"kimos":["kanban","archivos","integraciones","equipos"]}],"kpis":[{"id":"busqueda","label":"Tiempo de localizar un activo","meta":"De preguntar a apuntar"},{"id":"ordenes","label":"Órdenes cerradas en primera visita","meta":"Subir con historial en el punto"}],"equiposRecomendados":["apple.iphone.pro.12-17","android.arcore.generico"],"normativa":[],"prospeccion":{"senales":["Más de 50 activos distribuidos","Técnicos que preguntan dónde está el equipo","Historial en planilla"],"preguntas":["¿Cómo sabe un técnico nuevo dónde está cada equipo?","¿Cuántas órdenes se cierran en la primera visita?"],"demo":"Anclar la impresora de la oficina del prospecto y mostrar cómo aparece su ficha al apuntar el teléfono.","objeciones":[{"objecion":"Ya usamos códigos QR.","respuesta":"Y se siguen usando: son el respaldo del ancla. Lo que se suma es ver el mapa completo y planificar la ruta sin recorrer el edificio."}],"ahorro":{"supuesto":"Minutos de búsqueda por orden × órdenes al mes × valor hora del técnico","formula":"ordenesMes * minutosBusqueda / 60 * valorHora"}},"kimos":["kanban","archivos","equipos","integraciones"]},{"id":"agro-topografia","nombre":"Agro, terreno y topografía","icon":"🌾","cliente":"Agrícolas, empresas de riego, movimiento de tierras, consultoras ambientales.","dolor":"Los datos de elevación existen y son gratis, pero llegan en formatos que nadie abre en una reunión y no se cruzan con lo medido en terreno.","tolerancia":{"m":0.5,"aDistancia":50},"toleranciaNota":"El dato aéreo público tiene su propia precisión, declarada por el proveedor. La captura de mano solo aporta detalle local: mezclarlas sin decir cuál es cuál es un error caro.","modulos":[{"id":"terreno","prioridad":1,"para":"Importar y recortar nubes públicas y sacar perfiles del terreno."},{"id":"medir","prioridad":2,"para":"Detalle local: acequias, desniveles puntuales, obras chicas."},{"id":"obra","prioridad":3,"para":"Avance de movimiento de tierras entre fechas."},{"id":"epp","prioridad":3,"para":"Guantes, botas y mascarilla en aplicación de fitosanitarios."}],"flujos":[{"id":"perfil-terreno","nombre":"Del dato público a la decisión de riego o movimiento","pasos":["Recortar la zona desde la fuente pública","Generar perfiles y curvas de nivel","Superponer la captura de campo georreferenciada","Compartir la vista con el cliente"],"entrega":["Recorte LAS/LAZ","Perfiles","Curvas de nivel","Vista 3D compartible"],"kimos":["archivos","panel-html","gantt"]}],"kpis":[{"id":"levantamiento","label":"Costo de un levantamiento previo","meta":"Partir del dato público antes de contratar topografía"},{"id":"decision","label":"Tiempo hasta la primera decisión de diseño","meta":"De semanas a días"}],"equiposRecomendados":["pc.escritorio","apple.iphone.pro.12-17"],"normativa":["Cada fuente pública trae su licencia y su cita obligatoria (IGN: CC-BY; USGS y NOAA: dominio público; OpenTopography: por conjunto).","La atribución viaja con el archivo y aparece en los PDF exportados."],"prospeccion":{"senales":["Proyectos que dependen de topografía","Decisiones de riego o nivelación","Ya compran levantamientos topográficos"],"preguntas":["¿Cuánto pagan por un levantamiento previo que solo sirve para decidir si vale la pena?","¿Usan hoy datos públicos de elevación?"],"demo":"Recortar la zona del predio del prospecto desde el dato público y mostrarle el perfil del terreno en pantalla.","objeciones":[{"objecion":"Necesitamos precisión topográfica.","respuesta":"Para el diseño final, sí, y esto no la reemplaza. Para decidir si el proyecto va, el dato público resuelve en horas lo que hoy espera semanas."}],"ahorro":{"supuesto":"Levantamientos exploratorios evitados × costo del levantamiento","formula":"levantamientos * costoLevantamiento"}},"kimos":["archivos","panel-html","gantt","integraciones"]},{"id":"salud-ergonomia","nombre":"Salud, rehabilitación y ergonomía","icon":"🧍","cliente":"Centros de kinesiología, mutuales, áreas de prevención de riesgos, gimnasios.","dolor":"Evaluar postura o rango de movimiento exige equipo caro o el ojo de alguien, y la evolución entre sesiones se documenta a mano.","tolerancia":{"m":0.01,"aDistancia":1},"toleranciaNota":"Repetibilidad importa más que exactitud: lo que se compara es la misma persona entre sesiones, con el mismo protocolo de captura.","modulos":[{"id":"cuerpo","prioridad":1,"para":"Medidas y postura repetibles entre sesiones."},{"id":"accesibilidad","prioridad":2,"para":"Auditar el puesto de trabajo o el recinto."},{"id":"espacios","prioridad":3,"para":"Levantar el recinto a evaluar."},{"id":"epp","prioridad":3,"para":"Mascarilla y bata en áreas clínicas definidas, con información previa al personal."}],"flujos":[{"id":"evaluacion-postural","nombre":"Evaluación con evolución comparable","pasos":["Consentimiento explícito de la persona","Captura con protocolo fijo","Comparación con la sesión anterior","Informe para la ficha"],"entrega":["Medidas por sesión","Comparativa de evolución","Informe"],"kimos":["clientes","archivos","kanban"]}],"kpis":[{"id":"tiempo","label":"Tiempo de evaluación","meta":"Bajar respecto de la medición manual"},{"id":"adherencia","label":"Adherencia del paciente","meta":"Ver la propia evolución ayuda"}],"equiposRecomendados":["apple.iphone.pro.12-17","apple.ipadpro.2020+"],"normativa":["Dato biométrico: categoría especial. Consentimiento explícito por sesión, proceso en el equipo cuando se pueda, borrado a demanda.","Ninguna afirmación clínica ni diagnóstica: si el cliente lo quiere para diagnóstico, cambia el marco regulatorio entero y esto ya no aplica."],"prospeccion":{"senales":["Evaluaciones posturales frecuentes","Programas de prevención de riesgos","Documentación manual de evolución"],"preguntas":["¿Cómo documentan hoy la evolución entre sesiones?","¿Con qué comparan la postura de la primera sesión?"],"demo":"Capturar la postura de un voluntario y mostrar las medidas repetidas dos veces seguidas, para que vean la repetibilidad.","objeciones":[{"objecion":"¿Esto sirve para diagnosticar?","respuesta":"No, y no lo vamos a decir nunca. Sirve para medir y comparar de forma repetible; el diagnóstico es del profesional."}],"ahorro":{"supuesto":"Sesiones al mes × minutos de medición manual ahorrados × valor hora","formula":"sesionesMes * minutos / 60 * valorHora"}},"kimos":["clientes","archivos","kanban"]},{"id":"hoteleria-eventos","nombre":"Hotelería, eventos y ferias","icon":"🎪","cliente":"Centros de eventos, hoteles con salones, productoras de ferias, montajistas.","dolor":"Cotizar un montaje exige saber cuánto entra en el salón. Se cotiza con planos viejos y se descubre en el montaje que no calza.","tolerancia":{"m":0.05,"aDistancia":4},"toleranciaNota":"Suficiente para distribuir stands y mobiliario; las cargas y las alturas de estructura las valida quien monta.","modulos":[{"id":"espacios","prioridad":1,"para":"Levantar el salón con sus obstáculos reales (columnas, accesos, alturas)."},{"id":"vitrina-ar","prioridad":2,"para":"Mostrar el montaje propuesto en el salón real."},{"id":"accesibilidad","prioridad":3,"para":"Verificar anchos de paso y evacuación."},{"id":"presencia","prioridad":3,"para":"Aforo del salón en tiempo real durante el evento."}],"flujos":[{"id":"cotizar-montaje","nombre":"Cotizar un montaje con el salón real","pasos":["Escanear el salón","Distribuir el montaje sobre el modelo","Mostrar la propuesta al cliente en AR","Adjuntar el plano al contrato"],"entrega":["Plano del salón","Propuesta de montaje","Vista AR"],"kimos":["eventos","pedidos","archivos","vitrina"]}],"kpis":[{"id":"montajes","label":"Montajes con ajustes de última hora","meta":"Bajar con plano real"},{"id":"cierre","label":"Cierre de cotizaciones de salón","meta":"Subir mostrando el montaje"}],"equiposRecomendados":["apple.ipadpro.2020+","apple.iphone.pro.12-17"],"normativa":["Los anchos de evacuación los valida la normativa local y quien firma: la auditoría es un apoyo, no un certificado."],"prospeccion":{"senales":["Salones que se cotizan por m²","Montajes con ajustes de última hora","Planos desactualizados"],"preguntas":["¿Con qué plano cotizan hoy el salón?","¿Cuántos montajes tuvieron que ajustarse en el sitio este año?"],"demo":"Escanear el salón del propio centro de eventos y mostrar cuántas mesas entran, en su plano, en la reunión.","objeciones":[{"objecion":"Tenemos los planos del arquitecto.","respuesta":"Del edificio como se diseñó, no como está hoy con tabiques, columnas forradas y accesos cambiados. El escaneo muestra lo que hay."}],"ahorro":{"supuesto":"Montajes corregidos evitados × costo de la corrección en sitio","formula":"montajes * costoCorreccion"}},"kimos":["eventos","pedidos","archivos","vitrina"]},{"id":"educacion-patrimonio","nombre":"Educación, museos y patrimonio","icon":"🏛️","cliente":"Museos, universidades, colegios técnicos, fundaciones de patrimonio.","dolor":"Las piezas y los espacios no se pueden tocar ni mover, pero se necesitan para enseñar, difundir y documentar el estado de conservación.","tolerancia":{"m":0.005,"aDistancia":0.5},"toleranciaNota":"Para difusión alcanza con la silueta y el color; para documentar conservación hace falta el detalle fino, que solo da la captura cercana.","modulos":[{"id":"objetos","prioridad":1,"para":"Digitalizar piezas para difusión y estudio."},{"id":"espacios","prioridad":2,"para":"Registrar salas y montajes de exposición."},{"id":"vitrina-ar","prioridad":3,"para":"Llevar la pieza al aula o a la casa del visitante."}],"flujos":[{"id":"digitalizar-coleccion","nombre":"Digitalizar una colección por lotes","pasos":["Definir protocolo de captura por tipo de pieza","Capturar por lote","Publicar en la vitrina digital con su ficha","Archivar el original de alta densidad"],"entrega":["GLB para difusión","Malla densa archivada","Ficha con medidas reales"],"kimos":["vitrina","conocimiento","archivos","productos"]}],"kpis":[{"id":"piezas","label":"Piezas digitalizadas por jornada","meta":"Escala el proyecto sin equipo de laboratorio"},{"id":"alcance","label":"Alcance de la colección en línea","meta":"Sube con 3D navegable"}],"equiposRecomendados":["apple.iphone.pro.12-17","apple.ipadpro.2020+"],"normativa":["Derechos sobre las piezas y sobre los modelos derivados: se acuerdan antes de publicar.","La atribución de la colección viaja con el modelo."],"prospeccion":{"senales":["Colección sin digitalizar","Proyectos de difusión o fondos concursables","Piezas que no pueden salir de vitrina"],"preguntas":["¿Qué parte de la colección está digitalizada?","¿Con qué presupuesto y con qué equipo lo hacen hoy?"],"demo":"Digitalizar una pieza pequeña del propio museo y mostrarla girando en el navegador, en la reunión.","objeciones":[{"objecion":"Nuestros estándares de digitalización son más exigentes.","respuesta":"Para conservación, seguramente. Esto resuelve el 80% de la colección que hoy no está digitalizada porque el método exigente no alcanza para todo."}],"ahorro":{"supuesto":"Piezas × costo de digitalización externa por pieza","formula":"piezas * costoExterno"}},"kimos":["vitrina","conocimiento","archivos","productos"]},{"id":"mineria-industria","nombre":"Minería e industria pesada","icon":"⛏️","cliente":"Faenas mineras, plantas industriales, contratistas de mantenimiento industrial.","dolor":"Documentar el estado de una instalación exige detener operación o mandar gente a lugares incómodos. Los planos as-built casi nunca coinciden con lo instalado.","tolerancia":{"m":0.1,"aDistancia":5},"toleranciaNota":"A esta escala el sensor de bolsillo documenta y ubica; el levantamiento de precisión sigue siendo de escáner terrestre. La combinación es lo que rinde: escáner para lo crítico, teléfono para todo lo demás.","modulos":[{"id":"gemelo","prioridad":1,"para":"Ubicar activos y su historial en la instalación."},{"id":"obra","prioridad":2,"para":"Registrar el estado antes y después de una intervención."},{"id":"terreno","prioridad":3,"para":"Cruzar con datos aéreos del sitio."},{"id":"epp","prioridad":1,"para":"La exigencia de EPP más alta del catálogo: control en accesos y en frente de trabajo."},{"id":"termico","prioridad":3,"para":"Termografía de tableros, motores y correas."},{"id":"biometria","prioridad":3,"para":"Identidad en el acceso a faena, para ligar el control de EPP a una persona con trazabilidad."}],"flujos":[{"id":"as-built-parcial","nombre":"As-built parcial de lo que sí cambió","pasos":["Escanear la zona intervenida","Comparar contra el registro anterior","Actualizar la ficha del activo","Adjuntar al cierre de la orden de trabajo"],"entrega":["Registro fechado","Comparativa","Ficha de activo actualizada"],"kimos":["kanban","archivos","gantt","integraciones"]}],"kpis":[{"id":"asbuilt","label":"Desfase entre plano y realidad","meta":"Actualizar por zona intervenida, no por proyecto completo"},{"id":"exposicion","label":"Tiempo de persona en zona de riesgo","meta":"Menos vueltas a verificar"}],"equiposRecomendados":["apple.iphone.pro.12-17","apple.ipadpro.2020+"],"normativa":["Equipos en faena: certificaciones de seguridad del dispositivo (intrínsecamente seguro donde aplique).","Las imágenes de instalaciones pueden ser información sensible: retención y acceso acotados."],"prospeccion":{"senales":["Planos as-built desactualizados","Mantenimientos con sorpresas en terreno","Contratistas que documentan con fotos"],"preguntas":["¿Qué tan al día están sus as-built?","¿Cuántas veces el equipo llega y se encuentra con algo distinto a lo planificado?"],"demo":"Escanear una sala de máquinas o un tablero y mostrar el registro fechado con las medidas del espacio de trabajo.","objeciones":[{"objecion":"Usamos escáner terrestre.","respuesta":"Para lo crítico, correcto. La pregunta es qué pasa con el 90% de la instalación que no justifica movilizar el escáner: eso hoy no se documenta."}],"ahorro":{"supuesto":"Intervenciones con retrabajo evitadas × costo de detención u hora de cuadrilla","formula":"intervenciones * costoRetrabajo"}},"kimos":["kanban","gantt","archivos","integraciones","equipos"]},{"id":"alimentario","nombre":"Producción de alimentos e inocuidad","icon":"🥫","cliente":"Plantas de proceso, cocinas centrales, panaderías industriales, packing de fruta.","dolor":"La inocuidad se audita con planillas y con la vista del jefe de turno. Cuando la auditoría externa pregunta por evidencia de que el personal entró con cofia y bata, hay una firma, no un registro.","tolerancia":{"m":0.05,"aDistancia":2},"toleranciaNota":"Aquí la métrica casi no importa: lo que importa es reconocer prendas a distancia corta en el acceso a la zona limpia.","modulos":[{"id":"epp","prioridad":1,"para":"Cofia, bata, mascarilla y guantes en el acceso a la zona de proceso, con evidencia para la auditoría."},{"id":"presencia","prioridad":2,"para":"Aforo por sala y aviso cuando alguien entra a una zona restringida."},{"id":"termico","prioridad":3,"para":"Cadena de frío: temperatura de cámaras y de producto en proceso."}],"flujos":[{"id":"acceso-zona-limpia","nombre":"Control en el acceso a zona limpia","pasos":["Instalar un tótem con cámara en el acceso","Definir las prendas exigidas por sala","Registrar cada entrada con su evidencia","Exportar el reporte para la auditoría"],"entrega":["Registro de cumplimiento por turno","Evidencia fotográfica","Reporte para auditoría externa"],"kimos":["archivos","panel-html","kanban"]}],"kpis":[{"id":"hallazgos","label":"Hallazgos de auditoría por inocuidad","meta":"Bajar con evidencia continua en vez de muestreo"},{"id":"tiempo","label":"Tiempo de preparar una auditoría","meta":"De días de recopilación a una exportación"}],"equiposRecomendados":["totem.camara","apple.iphone.pro.12-17"],"normativa":["Supervisar al personal con cámara exige información previa y proporcionalidad; en varios países además consulta al comité paritario o al sindicato.","Detectar que falta una cofia no es identificar a la persona: ligarlo a un nombre es otro tratamiento de datos."],"prospeccion":{"senales":["Auditorías de inocuidad recurrentes","Zona limpia con acceso controlado","Registros de cumplimiento en papel"],"preguntas":["¿Cómo prueban hoy que el personal entró con la vestimenta exigida?","¿Cuánto tiempo toma preparar la evidencia para una auditoría?"],"demo":"Poner un teléfono en el acceso a la sala y mostrar el registro de cumplimiento de las siguientes cinco personas que entren.","objeciones":[{"objecion":"El jefe de turno ya lo controla.","respuesta":"Y va a seguir haciéndolo: esto no lo reemplaza, le deja el registro. La diferencia se nota el día que la auditoría pide evidencia de hace tres meses."}],"ahorro":{"supuesto":"Horas de preparación de auditoría + costo de un hallazgo evitado","formula":"auditoriasAnio * horasPorAuditoria * valorHora + hallazgos * costoHallazgo"}},"kimos":["archivos","panel-html","kanban","productos","equipos"]},{"id":"seguridad-vigilancia","nombre":"Seguridad y vigilancia de instalaciones","icon":"🛡️","cliente":"Empresas de seguridad, centros comerciales, bodegas, condominios, recintos con control de acceso.","dolor":"Hay cámaras instaladas y nadie puede mirarlas todas. El vídeo sirve para reconstruir lo que pasó, no para evitarlo, y el guardia se entera cuando ya ocurrió.","tolerancia":{"m":0.1,"aDistancia":10},"toleranciaNota":"No se mide: se detecta. La tolerancia aquí solo describe la precisión con que se puede ubicar a alguien dentro de la escena.","modulos":[{"id":"presencia","prioridad":1,"para":"Detección de personas y vehículos, zonas restringidas y aviso en el momento."},{"id":"espacios","prioridad":2,"para":"Levantar el recinto para dibujar las zonas sobre un plano real y no sobre una foto."},{"id":"gemelo","prioridad":3,"para":"Ubicar cámaras, accesos y puntos críticos en el mapa del recinto."},{"id":"biometria","prioridad":3,"para":"Control de acceso con identidad: credencial primero, biometría solo si el riesgo lo justifica y el expediente está hecho."}],"flujos":[{"id":"zonas-y-avisos","nombre":"De cámara que nadie mira a aviso accionable","pasos":["Conectar las cámaras existentes por RTSP","Dibujar zonas y horarios sobre el plano","Ajustar sensibilidad con una semana de datos reales","Enrutar los avisos a la ronda de turno"],"entrega":["Avisos con clip y ubicación","Reporte de eventos por turno","Mapa de calor de tránsito"],"kimos":["kanban","archivos","panel-html","equipos"]}],"kpis":[{"id":"deteccion","label":"Eventos detectados en el momento","meta":"De revisión posterior a aviso en curso"},{"id":"falsos","label":"Avisos falsos por turno","meta":"Bajo 3: por encima, el guardia deja de mirarlos"}],"equiposRecomendados":["camara.ip","totem.camara","android.arcore.generico"],"normativa":["La videovigilancia tiene reglas propias: señalización visible, finalidad declarada, plazos de retención y acceso restringido.","Detectar personas es una cosa; reconocer identidades es otra, con marco legal propio. Este rubro usa detección anónima."],"prospeccion":{"senales":["Más de ocho cámaras instaladas","Un guardia mirando muchos monitores","Incidentes que se descubren al día siguiente"],"preguntas":["¿Cuántas cámaras tiene y cuántas mira alguien de verdad?","¿En cuántos incidentes se enteraron después?"],"demo":"Conectar una de sus cámaras, dibujar una zona en el pasillo y mostrar el aviso saltando cuando alguien la cruza.","objeciones":[{"objecion":"Ya tenemos detección de movimiento en el grabador.","respuesta":"Y salta con una rama, con un gato y con la lluvia. La diferencia es que esto distingue una persona de un vehículo y respeta una zona y un horario."}],"ahorro":{"supuesto":"Incidentes detectados a tiempo × costo promedio del incidente","formula":"incidentesMes * costoIncidente"}},"kimos":["kanban","archivos","panel-html","equipos","integraciones"]}]},"integraciones":{"version":"1.0.0","actualizado":"2026-08-25","nota":"Vinculación de LiDARia con el resto del ecosistema KIMOS. `disponibilidad` es lo que de verdad se puede hacer HOY con el contrato AppShell v1, no lo que sería bonito. `veredicto` incluye los 'marginal' y los 'no': una integración que no resuelve nada que alguien pague no se construye, aunque quede bien en una lámina. `alias` recoge los nombres con los que otros catálogos se refieren a la misma app (p. ej. 'escritorio' → 'agentes').","contratoPlataforma":{"lectura":"data.read:{templateId} — la app declara el permiso en su manifest y el superadmin lo aprueba al instalar. Da acceso de solo lectura a instancias e items de otra app, siempre bajo el RBAC del usuario. Precedente real: web-agents lee products y contact-forms; productlab lee products y productlab.","escritura":"NO existe app → app. Una app solo escribe en su propia instancia. Los tres caminos reales para que un artefacto de LiDARia llegue a otra app son: (1) el AGENTE, que aplica un payload en la app destino con sus propias tools (p. ej. SET_MODEL3D de ProductLab); (2) EXPORTAR/IMPORTAR archivo (ProductLab ya tiene EXPORT_DATA/IMPORT_DATA); (3) un módulo de backend propio, que solo tienen las apps oficiales.","publico":"public.read y public.submit exponen un gateway sin auth por instancia: sirve para recibir solicitudes desde un sitio externo y para publicar una definición.","assets":"Los archivos bajo assets/ se sirven en /api/apps/{id}/asset/{ruta}. Vía repo oficial el backend solo sirve dist/, así que los recursos van embebidos o por URL explícita."},"niveles":{"hoy":"Se puede construir con el contrato actual, sin cambios de plataforma.","agente":"Funciona hoy, pero el puente lo cruza el agente IA aplicando un payload en la app destino.","requiere-plataforma":"Necesita algo que la plataforma todavía no da (escritura entre apps, suscripción a cambios, o un módulo backend).","no-aplica":"No hay nada real que conectar."},"integraciones":[{"app":"productlab","nombre":"ProductLab","icon":"🧪","orden":1,"direccion":"lidaria→app","queViaja":"El GLB del producto escaneado, su lado mayor real en centímetros y las partes detectadas.","contrato":"ProductLab ya define `model3d` con `url`, `realSizeCm` (su propia documentación dice: 0 = SIN AR) y `arUrl`, y expone la tool SET_MODEL3D. LiDARia produce exactamente ese payload; el agente lo aplica. Lectura del catálogo con data.read:productlab.","disponibilidad":"agente","valor":5,"esfuerzoSemanas":2,"veredicto":"ancla","porque":"Es la integración que justifica el proyecto entero. ProductLab tiene visor 3D, configurador y cadena AR completa (Scene Viewer, Quick Look, QR de escritorio a móvil) y le falta exactamente una cosa: el modelo del producto real con su medida. Hoy eso se modela a mano o no existe.","riesgo":"El payload tiene que respetar el contrato de partes y materiales del GLB; si los nombres de material no calzan, el configurador no repinta."},{"app":"productos","nombre":"Productos (PIM)","icon":"📦","orden":2,"direccion":"bidireccional","queViaja":"Hacia Productos: medidas reales, peso volumétrico y modelo 3D. Hacia LiDARia: qué productos del catálogo aún no tienen 3D (la cola de trabajo del escaneo).","contrato":"Lectura directa con data.read:products (precedente: web-agents). La escritura pasa por ProductLab o por el agente.","disponibilidad":"hoy","valor":5,"esfuerzoSemanas":3,"veredicto":"ancla","porque":"Convierte el escaneo en una tarea con lista: 'te faltan 84 productos sin 3D, empieza por los 10 que más se devuelven'. Sin esa cola, escanear es un acto suelto.","riesgo":"El peso volumétrico calculado no sirve para facturar sin certificación metrológica."},{"app":"prospeccion","nombre":"Prospección Comercial","icon":"🎯","orden":3,"direccion":"bidireccional","queViaja":"Hacia Prospección: el diagnóstico del parque del prospecto, el escaneo hecho en la visita, la propuesta cuantificada y el guion del rubro. Hacia LiDARia: rubro, tamaño y etapa de la oportunidad.","contrato":"Lectura con data.read:prospeccion cuando el módulo exponga instancias e items. El escaneo de la visita se adjunta como evidencia por el agente o por Archivos; la propuesta se exporta en PDF.","disponibilidad":"agente","valor":5,"esfuerzoSemanas":4,"veredicto":"ancla","porque":"Es la integración de mayor retorno comercial y la menos obvia: el escaneo no es solo lo que se vende, es la demostración que cierra la reunión, y el diagnóstico del parque del prospecto es un dato de calificación que hoy no existe en ningún CRM.","riesgo":"Escanear el local de un prospecto es tratar datos de un tercero: consentimiento y borrado a demanda desde el primer contacto."},{"app":"tienda","nombre":"Tienda (e-commerce)","icon":"🛒","orden":4,"direccion":"lidaria→app","queViaja":"La vista AR en la ficha de producto y el modelo 3D del configurador.","contrato":"Indirecto y ya construido: ProductLab publica el JSON del configurador que consume el theme, con 3D y AR. LiDARia solo tiene que llenar el modelo.","disponibilidad":"hoy","valor":4,"esfuerzoSemanas":1,"veredicto":"ancla","porque":"Es donde el 3D se convierte en dinero: conversión y devoluciones. Y no hay que construir la cadena AR, ya existe.","riesgo":"Un modelo pesado en la ficha arruina la velocidad de carga: compresión y nivel de detalle obligatorios."},{"app":"vitrina","nombre":"Vitrina (catálogo digital)","icon":"🖼️","orden":5,"direccion":"lidaria→app","queViaja":"Modelos 3D navegables de productos, piezas de colección o propiedades.","contrato":"Publicación del modelo con su ficha; el visor 3D es el mismo motor que ya usa ProductLab.","disponibilidad":"hoy","valor":4,"esfuerzoSemanas":2,"veredicto":"util","porque":"Para museos, inmobiliarias y catálogos de marca, la vitrina con 3D es el entregable final del escaneo.","riesgo":"Derechos sobre los modelos derivados en el caso de patrimonio."},{"app":"archivos","nombre":"Archivos","icon":"📁","orden":6,"direccion":"bidireccional","queViaja":"Los artefactos pesados: nubes de puntos, mallas densas, planos DXF/IFC, reportes PDF y los originales de cada captura.","contrato":"Destino natural de la exportación; lectura para reabrir capturas anteriores.","disponibilidad":"hoy","valor":4,"esfuerzoSemanas":2,"veredicto":"ancla","porque":"Sin un lugar donde vivan los originales, cada escaneo es desechable. Y la comparación entre fechas (obra, seguros, arriendo) exige recuperar el anterior.","riesgo":"Volumen: una nube de puntos de una vivienda pesa. Política de retención y compresión desde el día uno."},{"app":"pedidos","nombre":"Pedidos","icon":"🧾","orden":7,"direccion":"bidireccional","queViaja":"Hacia Pedidos: medidas de la visita, volumen del bulto, foto acotada como respaldo. Hacia LiDARia: qué pedido está en curso para adjuntar la evidencia al correcto.","contrato":"Lectura con data.read:orders; el adjunto viaja por Archivos o por el agente.","disponibilidad":"hoy","valor":4,"esfuerzoSemanas":3,"veredicto":"util","porque":"Cierra el ciclo en fabricación a medida y en despacho: la medida deja de vivir en un cuaderno.","riesgo":"Ninguno relevante."},{"app":"clientes","nombre":"Clientes","icon":"👥","orden":8,"direccion":"bidireccional","queViaja":"El histórico de capturas asociado al cliente: su local, su propiedad, sus evaluaciones.","contrato":"Lectura con data.read:customers para elegir el cliente al capturar.","disponibilidad":"hoy","valor":3,"esfuerzoSemanas":2,"veredicto":"util","porque":"Es lo que permite responder '¿cómo estaba esto la última vez que fuimos?' sin buscar en carpetas.","riesgo":"Datos personales dentro de las capturas: difuminado y retención."},{"app":"agentes","nombre":"Agentes / Escritorio KIMOS","icon":"🤖","orden":9,"direccion":"bidireccional","queViaja":"Órdenes y consultas en lenguaje natural sobre inventario, cobertura, economía y licencias; y el puente para aplicar payloads en otras apps.","contrato":"shell.agent.register con tools y getSnapshot. **Ya implementado**: la consola registra seis herramientas.","disponibilidad":"hoy","valor":4,"esfuerzoSemanas":0,"veredicto":"ancla","porque":"Es el único mecanismo de escritura entre apps que existe hoy, y además convierte a LiDARia en algo consultable: '¿con lo que tenemos podemos levantar planos?'.","riesgo":"Todo input del agente se valida: puede mandar datos fuera de rango.","alias":["escritorio"]},{"app":"integraciones","nombre":"Integraciones (iPaaS)","icon":"🔌","orden":10,"direccion":"bidireccional","queViaja":"Salida hacia sistemas externos: ERP, transportistas, BIM, CAD, y entrada de catálogos externos.","contrato":"Módulo de plataforma; LiDARia entrega formatos estándar (GLB, DXF, IFC, LAS/LAZ, CSV) y consume webhooks.","disponibilidad":"requiere-plataforma","valor":4,"esfuerzoSemanas":4,"veredicto":"util","porque":"En construcción y logística, el cliente no cambia su ERP: o el dato sale en su formato, o no hay venta.","riesgo":"Cada integración externa tiene su propio mantenimiento; se priorizan dos o tres, no diez."},{"app":"gantt","nombre":"Planificación (Gantt)","icon":"📊","orden":11,"direccion":"bidireccional","queViaja":"Hacia Gantt: avance medido por zona y fecha. Hacia LiDARia: qué hitos hay que verificar en la próxima visita.","contrato":"Lectura con data.read:gantt; la actualización de avance la aplica el agente o la persona.","disponibilidad":"agente","valor":3,"esfuerzoSemanas":3,"veredicto":"util","porque":"Convierte 'creo que vamos al 60%' en 'estas zonas están terminadas y hay evidencia fechada'.","riesgo":"Traducir volumen escaneado a porcentaje de avance es una interpretación: se muestra la evidencia, no se decide sola."},{"app":"kanban","nombre":"Kanban","icon":"🗂️","orden":12,"direccion":"lidaria→app","queViaja":"Cada observación anclada en el espacio se convierte en una tarjeta con su foto, su punto y su responsable.","contrato":"Creación de tarjetas por el agente; lectura con data.read:kanban para ver el estado en el punto.","disponibilidad":"agente","valor":3,"esfuerzoSemanas":3,"veredicto":"util","porque":"Es el paso natural entre 'encontré esto' y 'alguien lo arregla', y hoy ese paso se pierde en un grupo de mensajería.","riesgo":"Ninguno relevante."},{"app":"conocimiento","nombre":"Conocimiento","icon":"📚","orden":13,"direccion":"bidireccional","queViaja":"Hacia Conocimiento: los packs de rubro (flujos, guiones, tolerancias) como base consultable. Hacia LiDARia: packs propios de la organización.","contrato":"Los packs son JSON validado; entran por el cargador de packs y salen como artículos.","disponibilidad":"hoy","valor":3,"esfuerzoSemanas":3,"veredicto":"util","porque":"Es el mecanismo por el que la base de conocimiento del producto crece con lo que aprende cada organización, en vez de quedarse en lo que trae de fábrica.","riesgo":"Un pack mal hecho degrada las recomendaciones: por eso el cargador valida y marca el origen de cada rubro."},{"app":"formularios","nombre":"Formularios de Contacto","icon":"📝","orden":14,"direccion":"app→lidaria","queViaja":"Solicitudes de levantamiento, cotización o visita entrando desde un sitio externo.","contrato":"Gateway público (public.submit) o lectura con data.read:contact-forms (precedente: web-agents).","disponibilidad":"hoy","valor":3,"esfuerzoSemanas":2,"veredicto":"util","porque":"Es la puerta de entrada barata: 'pide tu levantamiento' en la web del cliente cae directo en la cola de trabajo.","riesgo":"Los guardarraíles del gateway (rate limit, honeypot, payload acotado) ya los pone la plataforma."},{"app":"web-agents","nombre":"Agentes Web","icon":"💬","orden":15,"direccion":"lidaria→app","queViaja":"El modelo 3D y las medidas reales del producto, para que el chat responda '¿cuánto mide?' y '¿cómo se ve en mi living?'.","contrato":"web-agents ya lee products con data.read:products; el 3D llega por esa misma vía una vez publicado.","disponibilidad":"hoy","valor":3,"esfuerzoSemanas":1,"veredicto":"util","porque":"Casi gratis: el dato ya viaja por un camino existente, y responde la pregunta que más frena una compra.","riesgo":"Ninguno relevante."},{"app":"fossflow","nombre":"FossFLOW (BPM)","icon":"🔀","orden":16,"direccion":"bidireccional","queViaja":"El proceso captura → revisión → publicación como flujo supervisado por etapa.","contrato":"Modelado del proceso en FossFLOW; LiDARia reporta el estado de cada captura.","disponibilidad":"requiere-plataforma","valor":3,"esfuerzoSemanas":4,"veredicto":"util","porque":"En una organización con varias personas capturando, sin proceso el resultado es una carpeta con 400 escaneos sin revisar.","riesgo":"Solo vale cuando hay volumen: para un usuario suelto es burocracia."},{"app":"digitai","nombre":"Digitai (automatización IA)","icon":"⚙️","orden":17,"direccion":"bidireccional","queViaja":"Post-proceso automático: limpieza de malla, difuminado de caras, generación de miniaturas y fichas.","contrato":"Orquestación de tareas sobre los artefactos que LiDARia deja en Archivos.","disponibilidad":"requiere-plataforma","valor":3,"esfuerzoSemanas":5,"veredicto":"util","porque":"El difuminado de caras y matrículas no puede depender de que alguien se acuerde: es una tarea automática o no ocurre.","riesgo":"Costo de cómputo: es justo donde se va el margen si no se controla."},{"app":"panel-html","nombre":"HTML Panel / Dashboards","icon":"📈","orden":18,"direccion":"lidaria→app","queViaja":"Cobertura de módulos por equipo, capturas por semana, productos con 3D sobre el total, ahorro estimado.","contrato":"Publicación de un JSON que el panel consume.","disponibilidad":"hoy","valor":3,"esfuerzoSemanas":2,"veredicto":"util","porque":"Es lo que hace que la gerencia vea el retorno sin abrir la app de captura.","riesgo":"Medir uso no es medir valor: el panel tiene que mostrar el KPI del rubro, no la cantidad de escaneos."},{"app":"eventos","nombre":"Gestión de Eventos","icon":"🎫","orden":19,"direccion":"bidireccional","queViaja":"El plano del salón, la propuesta de montaje y la verificación de accesos.","contrato":"Adjuntos y lectura de la ficha del evento.","disponibilidad":"hoy","valor":3,"esfuerzoSemanas":2,"veredicto":"util","porque":"Para el rubro de eventos es el flujo completo: cotizar con el salón real y montar sin sorpresas.","riesgo":"Ninguno relevante."},{"app":"equipos","nombre":"Equipos","icon":"👨‍👩‍👧","orden":20,"direccion":"bidireccional","queViaja":"Compartir una captura con el equipo y comentarla.","contrato":"Canal de colaboración de la plataforma.","disponibilidad":"hoy","valor":2,"esfuerzoSemanas":1,"veredicto":"util","porque":"Barato y evita que las capturas se compartan por mensajería fuera de la organización.","riesgo":"Ninguno relevante."},{"app":"kreative","nombre":"Kreative Studio","icon":"🎨","orden":21,"direccion":"lidaria→app","queViaja":"Renders del modelo 3D en distintos ángulos, fondos y acabados, como insumo gráfico.","contrato":"Exportación de imágenes desde el visor.","disponibilidad":"requiere-plataforma","valor":3,"esfuerzoSemanas":3,"veredicto":"util","porque":"Un producto escaneado puede generar cien fotos de catálogo sin sesión fotográfica. Es un beneficio secundario del mismo trabajo.","riesgo":"Un render mediocre daña más que una foto simple: hay que fijar calidad mínima."},{"app":"notas","nombre":"Notas de Equipo","icon":"📓","orden":22,"direccion":"lidaria→app","queViaja":"Enlaces a capturas dentro de una nota.","contrato":"Enlace, nada más.","disponibilidad":"hoy","valor":1,"esfuerzoSemanas":0,"veredicto":"marginal","porque":"Funciona pegando un enlace. No hace falta construir nada y tampoco aporta gran cosa.","riesgo":"—"},{"app":"social-planner","nombre":"Social Planner","icon":"📱","orden":23,"direccion":"lidaria→app","queViaja":"Vídeos cortos del modelo girando, para publicar.","contrato":"Exportación de vídeo desde el visor.","disponibilidad":"requiere-plataforma","valor":2,"esfuerzoSemanas":3,"veredicto":"marginal","porque":"Es real —el contenido 3D funciona en redes— pero nadie compra LiDARia por esto. Se hace si sobra tiempo después de las anclas.","riesgo":"—"},{"app":"cashflow","nombre":"KIMOS Cashflow","icon":"💰","orden":24,"direccion":"lidaria→app","queViaja":"Cotizaciones generadas desde mediciones, como entrada de flujo proyectado.","contrato":"Vía Pedidos; no hay conexión directa que valga la pena.","disponibilidad":"requiere-plataforma","valor":2,"esfuerzoSemanas":3,"veredicto":"marginal","porque":"La relación es indirecta: lo que alimenta el flujo es el pedido, no la medición. Conectar LiDARia con Cashflow salta un paso que ya existe.","riesgo":"—"},{"app":"funplai","nombre":"Kimos FunPlai (gamificación)","icon":"🎮","orden":25,"direccion":"ninguna","queViaja":"Nada que alguien pague.","contrato":"—","disponibilidad":"no-aplica","valor":1,"esfuerzoSemanas":0,"veredicto":"no","porque":"Se puede imaginar una búsqueda del tesoro en AR sobre un espacio escaneado, y queda bien en una lámina. No resuelve ningún problema por el que una empresa pague, y consumiría el mismo equipo que necesitan las anclas.","riesgo":"El riesgo es construirlo."},{"app":"tarjetas","nombre":"Tarjetas","icon":"🪪","orden":26,"direccion":"ninguna","queViaja":"Nada.","contrato":"—","disponibilidad":"no-aplica","valor":1,"esfuerzoSemanas":0,"veredicto":"no","porque":"No hay punto de contacto real entre tarjetas de presentación y captura 3D. Forzarlo sería inventar una integración para llenar una casilla.","riesgo":"—"}]},"vision":{"version":"1.0.0","actualizado":"2026-08-26","nota":"Datos del módulo de visión: qué modelos pueden entrar al producto (con su licencia), qué implementos de protección se pueden reconocer y a qué distancia, qué exige cada rubro, y qué da cada fuente de cámara. Las distancias NO son opinión: salen de la geometría de la cámara, que está en src/core/vision.js.","geometria":{"explicacion":"Un objeto de altura H a distancia d ocupa, en una imagen de resolución vertical R y campo de visión vertical F, aproximadamente H·R / (2·d·tan(F/2)) píxeles. Si esos píxeles no llegan al mínimo que necesita el detector, no hay modelo que lo salve: hay que acercarse, subir resolución o cerrar el ángulo.","advertencia":"El cálculo da la condición NECESARIA, no la suficiente. Movimiento, contraluz, oclusión entre personas, lluvia o polvo degradan por encima de esto."},"modelos":[{"id":"rf-detr","nombre":"RF-DETR","tarea":"deteccion","arquitectura":"DETR en tiempo real","licencia":"Apache-2.0","veredicto":"usar","dondeCorre":["servidor","dispositivo"],"entradaPx":560,"latenciaMs":{"servidorGpu":7,"movilNpu":90,"cpu":600},"nota":"Permisiva y con buen traspaso a dominios propios, que es justo lo que exige el EPP: hay que reentrenar con fotos de la faena del cliente. Es la opción por defecto."},{"id":"rt-detr","nombre":"RT-DETR","tarea":"deteccion","arquitectura":"DETR en tiempo real","licencia":"Apache-2.0","veredicto":"usar","dondeCorre":["servidor"],"entradaPx":640,"latenciaMs":{"servidorGpu":10,"movilNpu":null,"cpu":800},"nota":"El punto de partida de la familia. Alternativa si RF-DETR no calza en la infraestructura del cliente."},{"id":"yolox","nombre":"YOLOX","tarea":"deteccion","arquitectura":"CNN de una etapa","licencia":"Apache-2.0","veredicto":"usar","dondeCorre":["dispositivo","servidor"],"entradaPx":416,"latenciaMs":{"servidorGpu":6,"movilNpu":45,"cpu":350},"nota":"Cuando hace falta una CNN chica y permisiva para correr en el propio teléfono. Menos preciso que RF-DETR, mucho más liviano."},{"id":"mediapipe","nombre":"MediaPipe (pose y objetos)","tarea":"pose","arquitectura":"modelos de Google para móvil","licencia":"Apache-2.0","veredicto":"usar","dondeCorre":["dispositivo"],"entradaPx":256,"latenciaMs":{"servidorGpu":3,"movilNpu":20,"cpu":120},"nota":"La pose sirve para saber DÓNDE mirar: la cabeza para el casco, las manos para los guantes, los pies para el calzado. Recortar por articulación sube mucho el acierto en prendas chicas. El código es Apache-2.0; cada modelo preentrenado trae su propia licencia."},{"id":"apple-vision","nombre":"Apple Vision (persona y pose corporal)","tarea":"deteccion","arquitectura":"framework de plataforma","licencia":"Licencia de plataforma","veredicto":"usar","dondeCorre":["dispositivo"],"entradaPx":0,"latenciaMs":{"servidorGpu":null,"movilNpu":15,"cpu":null},"nota":"Gratis, sin dependencias y acelerado por el Neural Engine, pero solo detecta personas y pose: el EPP se detecta con un modelo propio en Core ML encima."},{"id":"mlkit","nombre":"ML Kit (Google)","tarea":"deteccion","arquitectura":"framework de plataforma","licencia":"Licencia de plataforma","veredicto":"usar","dondeCorre":["dispositivo"],"entradaPx":0,"latenciaMs":{"servidorGpu":null,"movilNpu":25,"cpu":null},"nota":"Equivalente en Android para persona, pose y seguimiento. El modelo de EPP va aparte, en LiteRT."},{"id":"ultralytics-yolo","nombre":"YOLOv5 / v8 / v11 / v26 (Ultralytics)","tarea":"deteccion","arquitectura":"CNN de una etapa","licencia":"AGPL-3.0","veredicto":"prohibida","dondeCorre":["dispositivo","servidor"],"entradaPx":640,"latenciaMs":{"servidorGpu":5,"movilNpu":40,"cpu":300},"nota":"Es EL modelo con el que está hecha la mayoría de las demos de EPP que se ven por ahí, y por eso hay que decirlo fuerte: es AGPL-3.0. Usarlo obliga a publicar el código del servicio entero, o a comprar licencia comercial al proveedor. Alternativa directa: RF-DETR."},{"id":"yolo-nas","nombre":"YOLO-NAS","tarea":"deteccion","arquitectura":"CNN buscada por NAS","licencia":"Investigacion-No-Comercial","veredicto":"prohibida","dondeCorre":["servidor"],"entradaPx":640,"latenciaMs":{"servidorGpu":6,"movilNpu":null,"cpu":400},"nota":"Los pesos preentrenados son de uso no comercial. El código y los pesos se licencian por separado: hay que revisar los dos."}],"pesos":{"regla":"El código del modelo y sus PESOS son dos licencias distintas. Es habitual que el código sea Apache-2.0 y los pesos no comerciales, o que los pesos hereden la licencia del conjunto de datos con que se entrenaron (muchos conjuntos públicos de EPP son CC-BY: exigen atribución).","consecuencia":"Los pesos de EPP de KIMOS se entrenan con datos propios y con conjuntos de licencia verificada, y esa procedencia viaja con el modelo."},"epp":[{"id":"casco","nombre":"Casco","icon":"⛑️","alturaM":0.2,"pxMinimos":24,"dificultad":"media","nota":"El más fácil y el más pedido. Se confunde con gorros y con cascos colgando del brazo: hay que exigir que esté sobre la cabeza detectada por pose."},{"id":"chaleco","nombre":"Chaleco reflectante","icon":"🦺","alturaM":0.55,"pxMinimos":32,"dificultad":"baja","nota":"El más fácil de todos por tamaño y color. Falla con ropa naranja que no es chaleco."},{"id":"mascarilla","nombre":"Mascarilla","icon":"😷","alturaM":0.1,"pxMinimos":24,"dificultad":"media","nota":"Necesita ver la cara de frente. De perfil y con barba baja mucho."},{"id":"lentes","nombre":"Lentes de protección","icon":"🥽","alturaM":0.05,"pxMinimos":20,"dificultad":"alta","nota":"Prenda fina y transparente: exige cercanía. A más de 4 m con cámara de móvil no es fiable."},{"id":"guantes","nombre":"Guantes","icon":"🧤","alturaM":0.12,"pxMinimos":24,"dificultad":"alta","nota":"Las manos se ocluyen todo el tiempo. Se resuelve mucho mejor recortando por la muñeca detectada con pose."},{"id":"calzado","nombre":"Calzado de seguridad","icon":"🥾","alturaM":0.12,"pxMinimos":24,"dificultad":"alta","nota":"Casi siempre parcialmente tapado y en la parte baja del cuadro. Es el punto donde un control en el acceso rinde mucho más que una ronda."},{"id":"arnes","nombre":"Arnés de altura","icon":"🪢","alturaM":0.45,"pxMinimos":32,"dificultad":"media","nota":"Detectar que lo lleva puesto es viable; detectar que está ENGANCHADO a la línea de vida es otro problema, mucho más difícil, y no se promete."},{"id":"auditiva","nombre":"Protección auditiva","icon":"🎧","alturaM":0.09,"pxMinimos":20,"dificultad":"alta","nota":"Las orejeras se ven; los tapones no. La regla del rubro tiene que decir cuál exige."},{"id":"cofia","nombre":"Cofia / gorro sanitario","icon":"👩‍🍳","alturaM":0.18,"pxMinimos":24,"dificultad":"media","nota":"Alimentario y salud. Se confunde con gorros comunes si no se entrena con fotos del propio local."},{"id":"bata","nombre":"Bata o delantal","icon":"🥼","alturaM":0.7,"pxMinimos":32,"dificultad":"baja","nota":"Fácil por tamaño. Distinguir bata limpia de sucia NO es esto."},{"id":"botas","nombre":"Botas de agua","icon":"👢","alturaM":0.35,"pxMinimos":28,"dificultad":"media","nota":"Alimentario y agro."}],"reglasPorRubro":[{"rubro":"construccion","obligatorio":["casco","chaleco","calzado"],"segunTarea":["lentes","guantes","arnes","auditiva"],"nota":"El arnés solo aplica en trabajo en altura: la regla se activa por zona, no para toda la obra."},{"rubro":"manufactura","obligatorio":["lentes","calzado"],"segunTarea":["casco","guantes","auditiva","chaleco"],"nota":"Cambia mucho por línea de producción: la regla se define por área."},{"rubro":"mineria-industria","obligatorio":["casco","chaleco","calzado","lentes"],"segunTarea":["guantes","auditiva","arnes"],"nota":"El rubro con la exigencia más alta y el que más justifica el control en accesos."},{"rubro":"alimentario","obligatorio":["cofia","bata"],"segunTarea":["mascarilla","guantes","botas"],"nota":"Aquí el control es de inocuidad, no de accidentes: cambia el reporte y cambia quién lo audita."},{"rubro":"salud-ergonomia","obligatorio":["mascarilla"],"segunTarea":["bata","guantes","lentes"],"nota":"Uso acotado a áreas clínicas definidas y con información previa al personal."},{"rubro":"agro-topografia","obligatorio":["guantes","botas"],"segunTarea":["mascarilla","lentes","chaleco"],"nota":"Aplicación de fitosanitarios es el caso que más importa y el que exige mascarilla adecuada."},{"rubro":"logistica","obligatorio":["chaleco","calzado"],"segunTarea":["casco","guantes"],"nota":"Patio de maniobras: conviven personas y grúas horquilla, y el chaleco es lo que se ve desde la cabina."},{"rubro":"seguridad-vigilancia","obligatorio":[],"segunTarea":["chaleco"],"nota":"Este rubro usa el módulo de personas y zonas, no el de EPP."},{"rubro":"educacion-patrimonio","obligatorio":[],"segunTarea":["guantes"],"nota":"Solo en talleres y en manipulación de piezas. Vigilar EPP en un aula no tiene sentido y no se ofrece."}],"fuentes":[{"id":"movil","nombre":"Cámara de móvil o tablet","resolucionV":1080,"fovVDeg":50,"latenciaMs":60,"control":"total","veredicto":"usar","nota":"La mejor calidad por peso: cerca, con control de enfoque y sin latencia. Es la ronda de supervisión."},{"id":"totem","nombre":"Tótem o kiosco fijo","resolucionV":1080,"fovVDeg":55,"latenciaMs":80,"control":"total","veredicto":"usar","nota":"Distancia corta y constante, iluminación estable y siempre enchufado. Es donde el control de EPP rinde más: en el acceso."},{"id":"camara.ip","nombre":"Cámara IP existente (RTSP)","resolucionV":1080,"fovVDeg":45,"latenciaMs":400,"control":"ninguno","veredicto":"usar","nota":"Lo más barato de sumar: ya está instalada. El ángulo suele ser alto y lejano, así que sirve para chaleco y casco, no para guantes."},{"id":"dron.rtmp","nombre":"Dron de consumo por RTMP (DJI Neo 2 y similares)","resolucionV":720,"fovVDeg":60,"latenciaMs":5000,"control":"ninguno","veredicto":"condicional","nota":"Emite en vivo desde DJI Fly a un servidor propio, pero el firmware limita la emisión a 720p y la latencia ronda varios segundos. Sirve para supervisión de área, no para control de acceso ni para alertar al instante."},{"id":"dron.grabado","nombre":"Dron: vídeo grabado en 4K","resolucionV":2160,"fovVDeg":60,"latenciaMs":null,"control":"ninguno","veredicto":"usar","nota":"Sin latencia porque no es en vivo: se analiza al aterrizar. Triplica el alcance útil respecto del vivo a 720p."},{"id":"dron.msdk","nombre":"Dron empresarial con Mobile SDK","resolucionV":1080,"fovVDeg":55,"latenciaMs":300,"control":"total","veredicto":"condicional","nota":"Control de vuelo y vídeo desde una app propia, solo en Android y solo con la gama empresarial. Es el único camino a supervisión aérea de verdad automática."}]},"capacidadesFuturas":{"version":"1.0.0","actualizado":"2026-08-26","nota":"Catálogo de capacidades que la app puede incorporar. Existe para que sumar una sea DATO más un detector, nunca un rediseño: cada entrada declara qué necesita del equipo, qué accesorio la habilita, qué puerta legal hay que cruzar antes y cuán madura está de verdad. Dos ejes separados a propósito: la madurez técnica y la puerta legal son problemas distintos y se resuelven por caminos distintos. Las capacidades marcadas `activacionControlada` se distribuyen APAGADAS: la app no las deja encender hasta que el expediente de cumplimiento está completo, y registra quién las encendió.","madurez":{"disponible":"Se puede activar hoy con lo que ya está construido.","en-desarrollo":"Técnicamente resuelto y sin construir: es trabajo, no investigación.","investigacion":"No está resuelto de forma fiable. Prometerla sería mentir."},"puertas":{"ninguna":"No trata datos personales. Se enciende sin trámite.","informacion":"Trata datos personales no sensibles: información previa, finalidad declarada y retención acotada.","consentimiento":"Exige consentimiento libre, específico, informado e inequívoco, y revocable.","consentimiento-eipd":"Dato sensible o tratamiento de alto riesgo: consentimiento explícito MÁS evaluación de impacto (EIPD) previa.","equipo-certificado":"Requiere un equipo con certificación sanitaria o metrológica. Sin ella no se ofrece, aunque técnicamente funcione.","prohibida-por-defecto":"Apagada de fábrica y con activación controlada: la app no la enciende hasta que el expediente de cumplimiento está completo y firmado por un responsable, y deja registro de quién la encendió y cuándo."},"capacidades":[{"id":"casco-puesto","nombre":"Casco puesto (no colgando del brazo)","icon":"⛑️","categoria":"verificacion","que":"Distinguir que el casco está SOBRE la cabeza y no colgando del brazo o apoyado en una viga, que es el falso positivo más común del control de EPP.","como":"Geometría sobre la pose: el casco tiene que caer dentro del recorte de la cabeza detectada y por encima de la línea de los ojos. Es refinamiento del módulo de EPP, no un modelo nuevo.","madurez":"en-desarrollo","puertaLegal":"informacion","datoSensible":false,"requiereCaps":["api.vision.ondevice"],"requiereAccesorio":[],"esfuerzoSemanas":2,"moduloBase":"epp","honestidad":"El caso difícil es el gorro de lana bajo el casco y el casco visto desde arriba con un dron: ahí la geometría de la cabeza se pierde."},{"id":"arnes-enganchado","nombre":"Arnés enganchado a la línea de vida","icon":"🪢","categoria":"verificacion","que":"Saber no solo que la persona lleva arnés, sino que el mosquetón está EFECTIVAMENTE enganchado a un punto de anclaje.","como":"Por visión no se resuelve con fiabilidad: el mosquetón queda oculto por el cuerpo la mayor parte del tiempo y la línea de vida se confunde con cualquier cuerda. La vía que sí funciona es un sensor en el propio mosquetón (contacto o carga) que emite por BLE.","madurez":"investigacion","puertaLegal":"informacion","datoSensible":false,"requiereCaps":[],"requiereAccesorio":["esp32-ble","mosqueton-instrumentado"],"esfuerzoSemanas":8,"moduloBase":"epp","honestidad":"Es el mejor ejemplo del catálogo de una capacidad que se resuelve mejor con hardware que con cámara. Vender la versión por visión sería vender un falso negativo con consecuencia de muerte."},{"id":"fatiga-conductor","nombre":"Fatiga y somnolencia en conductores y operadores","icon":"😴","categoria":"conducta","que":"Detectar patrones asociados a la fatiga: ojos cerrados durante fracciones largas de tiempo (PERCLOS), frecuencia de parpadeo, bostezos y cabeceo.","como":"Malla facial en el propio equipo (MediaPipe Face Landmarker, Apache-2.0) más una ventana temporal. La cámara mira al conductor; el vídeo NO sale del equipo y lo que se guarda son eventos, no imágenes.","madurez":"en-desarrollo","puertaLegal":"consentimiento-eipd","datoSensible":true,"requiereCaps":["api.vision.ondevice","compute.npu"],"requiereAccesorio":[],"esfuerzoSemanas":10,"moduloBase":"presencia","honestidad":"Es un indicador de comportamiento, NO un diagnóstico médico ni una medida de aptitud laboral. Los indicadores se degradan con lentes de sol, de noche sin iluminación infrarroja, y con la cara parcialmente cubierta. Se usa para avisar y proponer una pausa, nunca para sancionar automáticamente.","alternativaMenosInvasiva":"Pulsera de actividad con variabilidad de frecuencia cardiaca, si el trabajador acepta llevarla: mide mejor la fatiga acumulada y no filma su cara.","activacionControlada":true},{"id":"reconocimiento-facial","nombre":"Identificación facial 1:N (buscar quién es en un grupo)","icon":"🪪","categoria":"biometria","que":"Saber QUIÉN es una persona comparando su rostro contra todo el padrón enrolado. Es la forma más invasiva de identificar y la que más obligaciones arrastra.","como":"Vector facial (no la foto) contra el índice de plantillas enroladas. Se construye igual que la 1:1, pero la búsqueda es contra N personas en vez de contra una identidad declarada.","madurez":"en-desarrollo","puertaLegal":"prohibida-por-defecto","datoSensible":true,"requiereCaps":["api.vision.ondevice"],"requiereAccesorio":[],"esfuerzoSemanas":8,"moduloBase":"biometria","honestidad":"Se integra, no se esconde: el producto la trae y la deja APAGADA. Para encenderla la app exige el expediente completo —consentimiento explícito por persona, EIPD previa, justificación escrita de por qué no basta una credencial, responsable identificado— y registra la activación. Bajo la Ley 21.719 (vigente el 1 de diciembre de 2026) el dato biométrico es categoría especial: sin ese expediente, encenderla es una infracción, no un atajo.","alternativaMenosInvasiva":"Verificación 1:1 con credencial, que resuelve el 90% de los casos con una fracción del riesgo.","activacionControlada":true},{"id":"identidad-credencial","nombre":"Identidad por credencial (NFC, QR o BLE)","icon":"🎫","categoria":"verificacion","que":"Ligar un evento —un ingreso, un incumplimiento de EPP, una inspección— a una persona concreta, sin biometría.","como":"Lectura de credencial NFC o QR en el punto de control, o etiqueta BLE en el casco. La persona se identifica por algo que LLEVA, no por algo que ES.","madurez":"en-desarrollo","puertaLegal":"informacion","datoSensible":false,"requiereCaps":["media.camera"],"requiereAccesorio":["lector-nfc","etiqueta-ble"],"esfuerzoSemanas":4,"moduloBase":"epp","honestidad":"Es la respuesta correcta al 90% de los casos donde alguien pide reconocimiento facial. Más barata, más rápida de implementar y sin dato sensible de por medio.","recomendada":true},{"id":"temperatura-ambiental","nombre":"Temperatura y condiciones ambientales","icon":"🌡️","categoria":"ambiental","que":"Temperatura, humedad, presión y calidad del aire de una sala, una cámara de frío o un frente de trabajo, con registro continuo.","como":"Sensor conectado (ESP32 con SHT31 o DS18B20) que emite por BLE o publica por MQTT. Ningún teléfono trae termómetro ambiental utilizable.","madurez":"en-desarrollo","puertaLegal":"ninguna","datoSensible":false,"requiereCaps":[],"requiereAccesorio":["esp32-ble","esp32-wifi","sensor-temp-ambiental"],"esfuerzoSemanas":4,"moduloBase":"termico","honestidad":"No trata datos personales, así que es de lo más barato de encender legalmente. El trabajo real está en la instalación y en la calibración, no en el software."},{"id":"temperatura-corporal","nombre":"Temperatura corporal de personas","icon":"🤒","categoria":"biometria","que":"Medir la temperatura de la piel de una persona para inferir fiebre.","como":"Exige cámara térmica radiométrica con cuerpo negro de referencia y ambiente controlado. Un accesorio térmico de móvil NO alcanza la exactitud necesaria.","madurez":"investigacion","puertaLegal":"equipo-certificado","datoSensible":true,"requiereCaps":["sensor.thermal"],"requiereAccesorio":["camara-termica-certificada"],"esfuerzoSemanas":12,"moduloBase":"termico","honestidad":"Los sistemas de imagen térmica destinados a medir temperatura corporal son dispositivos regulados; en EE. UU. la FDA sancionó a empresas que los vendieron sin autorización, y en Chile el dato de salud es sensible bajo la Ley 21.719. Esta capacidad NO se ofrece con el hardware que este producto soporta. Si un cliente la exige, se deriva a un equipo médico certificado."},{"id":"matricula-vehiculo","nombre":"Lectura de patente de vehículo","icon":"🚗","categoria":"verificacion","que":"Reconocer la patente de los vehículos que entran o salen de un recinto.","como":"Detección de placa más OCR sobre el recorte. Maduro con cámara fija, ángulo adecuado y buena iluminación.","madurez":"en-desarrollo","puertaLegal":"consentimiento","datoSensible":false,"requiereCaps":["api.vision.servidor"],"requiereAccesorio":["camara-ip"],"esfuerzoSemanas":6,"moduloBase":"presencia","honestidad":"Una patente identifica al titular del vehículo: es dato personal aunque no se vea a nadie. Exige finalidad declarada, retención acotada y registro del tratamiento."},{"id":"caida-persona","nombre":"Detección de caídas y de persona inmóvil","icon":"🆘","categoria":"conducta","que":"Avisar cuando alguien cae o queda inmóvil en el suelo más tiempo del razonable.","como":"Pose más ventana temporal: relación de aspecto del cuerpo, altura del centro de masa y ausencia de movimiento.","madurez":"en-desarrollo","puertaLegal":"informacion","datoSensible":false,"requiereCaps":["api.vision.ondevice","api.vision.servidor"],"requiereAccesorio":[],"esfuerzoSemanas":6,"moduloBase":"presencia","honestidad":"Alta tasa de falsos positivos con personas agachadas trabajando. Se calibra por zona y se enruta como aviso a revisar, no como emergencia automática."},{"id":"gases-ruido","nombre":"Gases, ruido y vibración","icon":"📟","categoria":"ambiental","que":"Medición continua de gases (CO, CO₂, metano), nivel sonoro y vibración en un puesto de trabajo.","como":"Módulo ESP32 con los sensores correspondientes, publicando por MQTT. La app los muestra junto al mapa del espacio escaneado y los cruza con las zonas.","madurez":"en-desarrollo","puertaLegal":"ninguna","datoSensible":false,"requiereCaps":[],"requiereAccesorio":["esp32-wifi","sensor-gas","sonometro"],"esfuerzoSemanas":5,"moduloBase":"gemelo","honestidad":"Los sensores de gas de bajo costo derivan y necesitan calibración periódica. Para vigilancia de seguridad de la vida se usa equipo certificado; esto es apoyo y tendencia, no reemplazo."},{"id":"peso-dimension","nombre":"Peso y dimensiones automáticas","icon":"⚖️","categoria":"ambiental","que":"Completar el volumen medido por cámara con el peso real del bulto, para el cálculo de despacho.","como":"Celda de carga con HX711 sobre ESP32, o báscula comercial con salida serie o BLE.","madurez":"en-desarrollo","puertaLegal":"ninguna","datoSensible":false,"requiereCaps":[],"requiereAccesorio":["esp32-ble","bascula-ble","celda-carga"],"esfuerzoSemanas":3,"moduloBase":"volumen","honestidad":"Igual que con el volumen: facturar con estas medidas exige certificación metrológica legal. Sin ella, es control interno."},{"id":"lectura-etiquetas","nombre":"Lectura de etiquetas y placas de equipo","icon":"🔤","categoria":"verificacion","que":"Leer la placa de características de un motor, el código de un activo o la etiqueta de un producto y llevarlo a su ficha.","como":"OCR del sistema (Vision en iOS, ML Kit en Android), sin modelo propio.","madurez":"disponible","puertaLegal":"ninguna","datoSensible":false,"requiereCaps":["api.vision.ondevice"],"requiereAccesorio":[],"esfuerzoSemanas":2,"moduloBase":"gemelo","honestidad":"Barato y sólido. La única trampa es que una etiqueta puede contener datos personales (un nombre, un RUT); si eso pasa, el tratamiento cambia de categoría."},{"id":"fatiga-wearable","nombre":"Fatiga por pulsera (variabilidad cardiaca)","icon":"⌚","categoria":"biometria","que":"Estimar fatiga acumulada a partir de la variabilidad de la frecuencia cardiaca y el sueño registrado por una pulsera.","como":"Lectura del wearable por BLE o por la API del fabricante.","madurez":"en-desarrollo","puertaLegal":"consentimiento-eipd","datoSensible":true,"requiereCaps":[],"requiereAccesorio":["pulsera-ble"],"esfuerzoSemanas":8,"moduloBase":"cuerpo","honestidad":"Dato de salud: categoría especial. Mide mejor la fatiga que una cámara y es menos invasivo en apariencia, pero sigue siendo dato sensible y voluntario. Si el trabajador no quiere llevarla, no hay programa.","activacionControlada":true},{"id":"verificacion-facial-11","nombre":"Verificación facial 1:1 (¿es quien dice ser?)","icon":"✅","categoria":"biometria","que":"Confirmar que la persona que presenta una credencial es la titular de esa credencial, comparando su rostro contra UNA plantilla: la suya.","como":"La credencial (NFC o QR) declara la identidad; la cámara verifica. La comparación corre en el dispositivo y contra una sola plantilla cifrada, no contra un padrón.","madurez":"en-desarrollo","puertaLegal":"consentimiento-eipd","datoSensible":true,"activacionControlada":true,"requiereCaps":["api.vision.ondevice"],"requiereAccesorio":["lector-nfc"],"esfuerzoSemanas":6,"moduloBase":"biometria","honestidad":"Es la forma defendible de usar biometría: la persona ya dijo quién es y el sistema solo confirma. No hay búsqueda en multitud, no hay padrón consultable y la plantilla vive donde vive su credencial. Sigue siendo dato sensible y sigue exigiendo consentimiento y EIPD.","recomendada":true},{"id":"enrolamiento-biometrico","nombre":"Enrolamiento y ciclo de vida de la plantilla","icon":"🗝️","categoria":"biometria","que":"Registrar a una persona en el sistema biométrico, y poder revocarla y borrarla de verdad.","como":"Se guarda un VECTOR irreversible (plantilla), nunca la fotografía; cifrado con clave por organización; con fecha de consentimiento, finalidad y caducidad. Revocar = borrar la plantilla y sus derivados, con constancia.","madurez":"en-desarrollo","puertaLegal":"consentimiento-eipd","datoSensible":true,"activacionControlada":true,"requiereCaps":["api.vision.ondevice"],"requiereAccesorio":[],"esfuerzoSemanas":5,"moduloBase":"biometria","honestidad":"Sin esto, lo demás no se puede ofrecer: un sistema biométrico que no sabe revocar no cumple el derecho de cancelación. Guardar la foto en vez de la plantilla es el error que convierte una multa en un titular de prensa."},{"id":"prueba-de-vida","nombre":"Prueba de vida (anti-suplantación)","icon":"🫥","categoria":"biometria","que":"Distinguir a una persona real de una foto, un vídeo o una máscara puestos delante de la cámara.","como":"Señales pasivas (textura, reflejos, micromovimiento) y, donde hay sensor, profundidad: el LiDAR y el TrueDepth hacen esto mucho mejor que una cámara sola.","madurez":"en-desarrollo","puertaLegal":"consentimiento-eipd","datoSensible":true,"activacionControlada":true,"requiereCaps":["api.vision.ondevice"],"requiereAccesorio":[],"esfuerzoSemanas":6,"moduloBase":"biometria","honestidad":"Un sistema biométrico sin prueba de vida se burla con una foto impresa. Aquí el LiDAR del equipo deja de ser un accesorio y pasa a ser la defensa: la profundidad delata una superficie plana al instante."}]},"accesorios":{"version":"1.0.0","actualizado":"2026-08-26","nota":"Accesorios, sensores y módulos con los que kimos-LiDARia amplía lo que el equipo puede capturar. Cada entrada dice CÓMO se conecta y, sobre todo, DÓNDE funciona esa conexión: la diferencia entre Android e iOS aquí es la misma que con el LiDAR, y por la misma razón.","conexiones":{"ble":{"nombre":"Bluetooth de baja energía (BLE)","android":"Directo desde el navegador con Web Bluetooth (Chrome y derivados).","ios":"El navegador NO expone Bluetooth: hace falta el contenedor nativo (CoreBluetooth).","escritorio":"Chrome y Edge en Windows, macOS y Linux.","nota":"Es la conexión más práctica para sensores en terreno: sin cables, sin red y con batería que dura semanas."},"wifi-mqtt":{"nombre":"Wi-Fi con MQTT","android":"Sí, desde cualquier navegador (MQTT sobre WebSocket).","ios":"Sí, desde cualquier navegador.","escritorio":"Sí.","nota":"La vía universal: el sensor publica y la app se suscribe. Exige red y un broker, pero funciona igual en las tres plataformas y escala a decenas de sensores."},"usb-serial":{"nombre":"USB o puerto serie","android":"Con adaptador OTG; en navegador solo en versiones recientes de Chrome.","ios":"No.","escritorio":"Chrome y Edge con Web Serial.","nota":"Útil en un puesto fijo (tótem, mesón de despacho), no en terreno."},"rtsp":{"nombre":"Vídeo RTSP","android":"Vía servidor de ingesta.","ios":"Vía servidor de ingesta.","escritorio":"Vía servidor de ingesta.","nota":"La cámara no habla con la app: habla con el servidor, y la app consume el resultado."},"rtmp":{"nombre":"Vídeo RTMP en vivo","android":"Vía servidor de ingesta.","ios":"Vía servidor de ingesta.","escritorio":"Vía servidor de ingesta.","nota":"Lo que emite un dron de consumo desde la app del fabricante."},"sdk":{"nombre":"SDK del fabricante","android":"Requiere contenedor nativo.","ios":"Requiere contenedor nativo (y a veces no existe).","escritorio":"No.","nota":"Cámaras térmicas y drones empresariales. Ata el proyecto al calendario del fabricante."},"nfc":{"nombre":"NFC","android":"Con contenedor nativo; el navegador solo lee etiquetas NDEF en Chrome.","ios":"Con contenedor nativo (Core NFC).","escritorio":"Con lector USB.","nota":"La vía correcta para identificar personas sin biometría."}},"accesorios":[{"id":"esp32-ble","nombre":"Módulo ESP32 por BLE","icon":"📟","tipo":"modulo","conexion":"ble","costoAprox":"USD 6-15","datos":["temperatura","humedad","contacto","carga","aceleración","lo que se le conecte"],"habilita":["temperatura-ambiental","peso-dimension","arnes-enganchado"],"comoConectar":["Programar el ESP32 como periférico BLE con un servicio y una característica de notificación (hay ejemplos públicos de sobra).","En Android: abrir LiDARia en Chrome → Accesorios → Buscar por Bluetooth → elegir el dispositivo.","En iOS: hace falta la app nativa de LiDARia; Safari no expone Bluetooth.","Asignar el sensor a un punto o a un activo del mapa para que sus lecturas tengan lugar."],"veredicto":"usar","nota":"El caballo de batalla de la ampliación: barato, programable y con toda la documentación del mundo. Un ESP32 más un sensor de 3 dólares cubre la mayoría de los casos ambientales."},{"id":"esp32-wifi","nombre":"Módulo ESP32 por Wi-Fi (MQTT)","icon":"📡","tipo":"modulo","conexion":"wifi-mqtt","costoAprox":"USD 6-15","datos":["telemetría continua de cualquier sensor conectado"],"habilita":["temperatura-ambiental","gases-ruido"],"comoConectar":["Configurar el ESP32 con la red del recinto y un broker MQTT (propio o del cliente).","Publicar en un tema por sensor, en JSON, con marca de tiempo.","En LiDARia: Accesorios → Añadir por MQTT → pegar broker, tema y credenciales.","Definir umbrales por sensor: la app avisa cuando se cruzan."],"veredicto":"usar","nota":"Cuando son más de tres sensores o hay que registrar en continuo, esta es la vía. Funciona igual en iOS y Android, que es su gran ventaja sobre BLE."},{"id":"sensor-temp-ambiental","nombre":"Sensor de temperatura y humedad (SHT31, DS18B20, DHT22)","icon":"🌡️","tipo":"sensor","conexion":"ble","costoAprox":"USD 3-20","datos":["temperatura ambiente","humedad relativa"],"habilita":["temperatura-ambiental"],"comoConectar":["Se conecta al ESP32 (I2C o 1-Wire) y viaja por su misma conexión."],"veredicto":"usar","nota":"Para cadena de frío conviene el DS18B20 en sonda estanca; el DHT22 es barato y lento."},{"id":"sensor-gas","nombre":"Sensores de gas (CO, CO₂, metano)","icon":"☁️","tipo":"sensor","conexion":"wifi-mqtt","costoAprox":"USD 10-80","datos":["concentración de gas"],"habilita":["gases-ruido"],"comoConectar":["Al ESP32 por analógico o I2C, publicando por MQTT.","Calibrar contra un patrón antes de fijar umbrales."],"veredicto":"condicional","nota":"Los de bajo costo derivan con el tiempo y con la humedad. Sirven para tendencia y para avisar; para vigilancia de seguridad de la vida se usa equipo certificado."},{"id":"sonometro","nombre":"Sonómetro / sensor de ruido","icon":"🔊","tipo":"sensor","conexion":"wifi-mqtt","costoAprox":"USD 15-200","datos":["nivel sonoro dB(A)"],"habilita":["gases-ruido"],"comoConectar":["Módulo de micrófono con ponderación A al ESP32, o sonómetro con salida serie."],"veredicto":"condicional","nota":"Para exposición laboral con valor legal se usa dosímetro certificado. Esto identifica dónde y cuándo mirar."},{"id":"celda-carga","nombre":"Celda de carga con HX711","icon":"⚖️","tipo":"sensor","conexion":"ble","costoAprox":"USD 10-40","datos":["peso"],"habilita":["peso-dimension"],"comoConectar":["Celda + HX711 + ESP32; calibrar con una masa patrón conocida.","En LiDARia queda asociada al punto de despacho, y el peso se suma a la ficha del bulto junto al volumen medido por cámara."],"veredicto":"usar","nota":"Completa el módulo de volumen: la cámara da el cubicaje y la celda el peso real."},{"id":"bascula-ble","nombre":"Báscula comercial con BLE o salida serie","icon":"🧮","tipo":"sensor","conexion":"ble","costoAprox":"USD 150-1.500","datos":["peso certificado"],"habilita":["peso-dimension"],"comoConectar":["Emparejar por BLE (Android o app nativa) o por serie en un tótem de despacho."],"veredicto":"usar","nota":"Si la báscula está certificada para comercio, su peso SÍ sirve para facturar. Es la pieza que el volumen por cámara todavía no puede aportar."},{"id":"camara-termica","nombre":"Cámara térmica para móvil (FLIR One, Seek Compact)","icon":"🔥","tipo":"camara","conexion":"sdk","costoAprox":"USD 200-600","datos":["temperatura radiométrica por píxel"],"habilita":["temperatura-ambiental"],"comoConectar":["Conectar el accesorio al puerto del teléfono.","Abrir la app NATIVA de LiDARia (el navegador no habla con estos accesorios).","Fijar emisividad y distancia antes de medir: sin eso, dos lecturas no son comparables."],"veredicto":"condicional","nota":"Habilita termografía de equipos y procesos. NO habilita medición de temperatura corporal: para eso hace falta equipo certificado, y ese uso no se ofrece."},{"id":"camara-termica-certificada","nombre":"Cámara térmica certificada con cuerpo negro","icon":"🏥","tipo":"camara","conexion":"sdk","costoAprox":"USD 3.000-15.000","datos":["temperatura con exactitud declarada y trazable"],"habilita":["temperatura-corporal"],"comoConectar":["Instalación fija con referencia de cuerpo negro y ambiente controlado, según el protocolo del fabricante."],"veredicto":"prohibida","nota":"Fuera del alcance del producto. Medir temperatura corporal de personas es un uso regulado y con dato de salud de por medio: si el cliente lo necesita, se deriva a un proveedor médico certificado."},{"id":"camara-ip","nombre":"Cámara IP / CCTV existente (RTSP)","icon":"📷","tipo":"camara","conexion":"rtsp","costoAprox":"ya instalada","datos":["vídeo continuo"],"habilita":["matricula-vehiculo","caida-persona"],"comoConectar":["Obtener la URL RTSP de la cámara (usuario, contraseña, canal).","Cargarla en el servidor de análisis de LiDARia; la app nunca se conecta directo a la cámara.","Dibujar las zonas sobre el plano del recinto y ajustar la sensibilidad con una semana de datos reales."],"veredicto":"usar","nota":"La ampliación más barata que existe: la cámara ya está y nadie la mira. Ojo con el ángulo: si está alta y lejana, sirve para chaleco y casco, no para guantes."},{"id":"lector-nfc","nombre":"Lector NFC (o el NFC del propio teléfono)","icon":"🎫","tipo":"lector","conexion":"nfc","costoAprox":"USD 0-60","datos":["identificador de credencial"],"habilita":["identidad-credencial"],"comoConectar":["En un tótem: lector USB en el mesón.","En terreno: el NFC del teléfono desde la app nativa.","Registrar la credencial contra la persona en KIMOS, no en el dispositivo."],"veredicto":"usar","nota":"Es la alternativa correcta al reconocimiento facial: identifica igual, no es dato biométrico y una credencial se revoca."},{"id":"etiqueta-ble","nombre":"Etiqueta BLE en casco o herramienta","icon":"🏷️","tipo":"lector","conexion":"ble","costoAprox":"USD 3-15","datos":["presencia y proximidad"],"habilita":["identidad-credencial"],"comoConectar":["Pegar la etiqueta al casco o al equipo y asociarla en la app.","La app registra proximidad, no ubicación exacta."],"veredicto":"usar","nota":"Sirve para saber que un casco entró a la faena. Que el casco entre no prueba que alguien lo lleve puesto: por eso se combina con la cámara, no la reemplaza."},{"id":"mosqueton-instrumentado","nombre":"Mosquetón o arnés instrumentado","icon":"🪝","tipo":"sensor","conexion":"ble","costoAprox":"USD 80-400","datos":["enganchado sí/no","carga"],"habilita":["arnes-enganchado"],"comoConectar":["Sensor de contacto o de carga en el mosquetón, emitiendo por BLE al equipo del supervisor o a una pasarela en la obra."],"veredicto":"condicional","nota":"Es la forma fiable de saber que el arnés está enganchado. Hay productos comerciales; también se puede prototipar con ESP32, pero un equipo de protección personal modificado deja de estar certificado, y eso hay que resolverlo con el fabricante."},{"id":"pulsera-ble","nombre":"Pulsera de actividad con BLE","icon":"⌚","tipo":"sensor","conexion":"ble","costoAprox":"USD 30-300","datos":["frecuencia cardiaca","variabilidad","sueño","pasos"],"habilita":["fatiga-wearable"],"comoConectar":["Emparejar por BLE con el equipo del trabajador (o leer por la API del fabricante).","Antes de emparejar: consentimiento firmado y finalidad declarada."],"veredicto":"condicional","nota":"Dato de salud, categoría especial. Voluntario de verdad: si el trabajador no quiere, no hay programa, y eso no puede tener consecuencias laborales."},{"id":"dron-consumo","nombre":"Dron de consumo (DJI Neo 2 y similares)","icon":"🚁","tipo":"camara","conexion":"rtmp","costoAprox":"USD 200-800","datos":["vídeo aéreo"],"habilita":["caida-persona"],"comoConectar":["En la app del fabricante: Ajustes → Transmisión en vivo → RTMP personalizado.","Pegar la URL del servidor de ingesta de LiDARia.","Volar: el análisis ocurre en el servidor, no en el dron.","Para mejor calidad: grabar en 4K y subir el archivo al aterrizar."],"veredicto":"condicional","nota":"En vivo la emisión va limitada a 720p y con varios segundos de retraso. No hay SDK para esta gama: LiDARia no pilota nada ni lee su LiDAR de obstáculos."},{"id":"dron-empresarial","nombre":"Dron empresarial con SDK (Mavic 3 Enterprise, Matrice)","icon":"🛩️","tipo":"camara","conexion":"sdk","costoAprox":"USD 3.000-15.000","datos":["vídeo","telemetría","térmica en modelos T"],"habilita":["temperatura-ambiental","matricula-vehiculo"],"comoConectar":["App nativa Android con el SDK del fabricante.","Misión programada; el vídeo y la telemetría llegan a LiDARia por el propio SDK."],"veredicto":"condicional","nota":"Único camino a supervisión aérea automática, y el que además habilita termografía aérea. Solo Android, y es una integración de semanas, no de tardes."},{"id":"gnss-rtk","nombre":"Receptor GNSS RTK","icon":"🛰️","tipo":"sensor","conexion":"ble","costoAprox":"USD 300-3.000","datos":["posición centimétrica"],"habilita":[],"comoConectar":["Emparejar por BLE y usarlo como fuente de posición para georreferenciar capturas y nubes."],"veredicto":"usar","nota":"Convierte un escaneo suelto en un levantamiento georreferenciado: es lo que faltaba para cruzar la captura de mano con el dato aéreo público."}]},"legal":{"version":"1.0.0","actualizado":"2026-08-26","nota":"Marco de cumplimiento que la app aplica ANTES de encender una función que trate datos personales. No es asesoría legal: es la lista de lo que hay que tener hecho, traducida a preguntas que alguien puede responder sin ser abogado. El texto de la ley manda sobre esto.","marco":{"id":"cl-21719","nombre":"Ley 21.719 — Protección de datos personales (Chile)","publicada":"2024-12-13","vigencia":"2026-12-01","autoridad":"Agencia de Protección de Datos Personales","resumen":"Reemplaza el régimen de la Ley 19.628 y lo acerca al estándar europeo: bases de licitud explícitas, datos sensibles con protección reforzada (los biométricos entre ellos), derechos de la persona, evaluación de impacto para tratamientos de alto riesgo y una autoridad con facultad de fiscalizar y sancionar.","sanciones":"Hasta 20.000 UTM por infracción gravísima, con multas de hasta el 4% de los ingresos anuales en Chile en caso de reincidencia; además, suspensión o prohibición del tratamiento y publicación de la sanción.","porQueImporta":"Casi todo lo que hace este producto con cámaras es tratamiento de datos personales, y una parte es de categoría especial. La fecha no es lejana: quien instale cámaras de supervisión en 2026 tiene que estar listo el 1 de diciembre.","fuentes":[{"titulo":"Guía 2026 de cumplimiento","url":"https://preyproject.com/es/blog/ley-de-proteccion-de-datos-en-chile"},{"titulo":"Cuándo es obligatoria la EIPD","url":"https://alayiatrust.com/blog/eipd-evaluacion-impacto-ley-21719"},{"titulo":"Análisis de la reforma","url":"https://www.thomsonreuters.cl/es-cl/soluciones-juridicas/biblioteca-contenido-legal/ley-21719-y-la-reconstruccion-del-derecho-chileno-de-proteccion-de-datos-personales"}]},"principios":[{"id":"licitud","nombre":"Licitud y lealtad","que":"Todo tratamiento necesita una base: consentimiento, contrato, obligación legal o interés legítimo. La base se elige ANTES, no se justifica después."},{"id":"finalidad","nombre":"Finalidad","que":"Se declara para qué se captura y no se usa para otra cosa. Un escaneo hecho para presupuestar no se puede reutilizar para evaluar al personal."},{"id":"proporcionalidad","nombre":"Proporcionalidad y minimización","que":"Se captura lo mínimo que sirve. Si una credencial resuelve lo mismo que un rostro, se usa la credencial."},{"id":"calidad","nombre":"Calidad","que":"Los datos tienen que ser exactos. Un incumplimiento de EPP mal detectado es un dato inexacto sobre una persona, y eso es un problema legal además de técnico."},{"id":"responsabilidad","nombre":"Responsabilidad proactiva","que":"Hay que poder DEMOSTRAR el cumplimiento: registro de actividades, evidencia del consentimiento, EIPD documentada."},{"id":"seguridad","nombre":"Seguridad","que":"Cifrado, control de acceso, y notificación de brechas a la Agencia y a las personas afectadas."},{"id":"transparencia","nombre":"Transparencia","que":"Las personas saben que hay cámaras, para qué, quién es el responsable y cómo ejercer sus derechos."}],"checklist":[{"id":"base","pregunta":"¿Está definida y escrita la base de licitud de esta función?","aplicaSi":"datos-personales","bloqueante":true,"comoSeCumple":"Documento breve: qué se trata, con qué base y por qué. Para supervisión laboral, la base suele ser el interés legítimo del empleador acotado a la seguridad, no el consentimiento del trabajador (que rara vez es libre en una relación de subordinación)."},{"id":"informacion","pregunta":"¿Se informó previamente a las personas afectadas?","aplicaSi":"datos-personales","bloqueante":true,"comoSeCumple":"Señalización visible en los accesos, comunicación escrita al personal y mención en el reglamento interno. Antes de encender, no después."},{"id":"consentimiento","pregunta":"¿Hay consentimiento explícito, específico y revocable?","aplicaSi":"sensibles","bloqueante":true,"comoSeCumple":"Registro por persona, con fecha, finalidad concreta y forma de revocarlo. Si revocar tiene consecuencia laboral, no era libre."},{"id":"eipd","pregunta":"¿Se hizo la evaluación de impacto (EIPD) antes de empezar?","aplicaSi":"alto-riesgo","bloqueante":true,"comoSeCumple":"La ley la exige para tratamientos de alto riesgo: observación sistemática de zonas de acceso público, tratamiento masivo, datos sensibles y evaluación sistemática de aspectos personales por medios automatizados. Vigilancia de EPP con cámara cae ahí."},{"id":"registro","pregunta":"¿Está en el registro de actividades de tratamiento?","aplicaSi":"datos-personales","bloqueante":false,"comoSeCumple":"Una fila por tratamiento: finalidad, categorías de datos y de personas, plazos, destinatarios y medidas de seguridad."},{"id":"retencion","pregunta":"¿Está fijado el plazo de conservación y el borrado automático?","aplicaSi":"datos-personales","bloqueante":true,"comoSeCumple":"En LiDARia se configura por módulo. Para evidencia de EPP, semanas; para un escaneo de obra, lo que dure el proyecto más el plazo de garantía."},{"id":"derechos","pregunta":"¿Hay un canal para ejercer los derechos de acceso, rectificación, cancelación, oposición y portabilidad?","aplicaSi":"datos-personales","bloqueante":false,"comoSeCumple":"Correo o formulario publicado, con responsable y plazo de respuesta."},{"id":"encargado","pregunta":"¿Está firmado el contrato con quien trata los datos por encargo?","aplicaSi":"datos-personales","bloqueante":false,"comoSeCumple":"Si el análisis corre en servidores de un tercero (incluido KIMOS), hace falta contrato de encargo con instrucciones, confidencialidad y devolución o borrado al terminar."},{"id":"minimizacion","pregunta":"¿Se descartó una alternativa menos invasiva?","aplicaSi":"sensibles","bloqueante":true,"comoSeCumple":"Escrito y con fundamento. Si una credencial NFC resuelve lo mismo que el reconocimiento facial, la facial no pasa el examen de proporcionalidad."},{"id":"decision","pregunta":"¿Ninguna decisión que afecte a una persona se toma solo con lo que dice el sistema?","aplicaSi":"datos-personales","bloqueante":true,"comoSeCumple":"Un aviso de EPP es un aviso: lo revisa una persona antes de cualquier consecuencia. La app no sanciona ni bloquea accesos por su cuenta."},{"id":"seguridad","pregunta":"¿Hay cifrado, control de acceso y plan ante brechas?","aplicaSi":"datos-personales","bloqueante":false,"comoSeCumple":"Acceso por rol, cifrado en tránsito y en reposo, y procedimiento de notificación con plazos."}],"clasificacion":{"sin-datos":{"label":"Sin datos personales","riesgo":0,"ejemplo":"Escanear una habitación vacía o medir una caja."},"datos-personales":{"label":"Datos personales","riesgo":1,"ejemplo":"Cualquier captura donde aparezcan personas o patentes."},"alto-riesgo":{"label":"Alto riesgo","riesgo":2,"ejemplo":"Observación sistemática de un acceso o de una zona de acceso público, o tratamiento masivo."},"sensibles":{"label":"Datos sensibles","riesgo":3,"ejemplo":"Biométricos (rostro), salud (fatiga, temperatura corporal)."}},"retencionSugerida":[{"modulo":"epp","dias":90,"nota":"Evidencia de cumplimiento: suficiente para una auditoría y para investigar un incidente reciente."},{"modulo":"presencia","dias":30,"nota":"Conteo y eventos de zona. El vídeo asociado, menos: solo el clip del evento."},{"modulo":"cuerpo","dias":0,"nota":"Solo mientras dure el programa y con consentimiento vigente; se borra al revocarlo."},{"modulo":"espacios","dias":1825,"nota":"Un plano no es dato personal, pero el escaneo original puede contener personas: se difumina antes de archivar."}]},"manual":{"version":"1.0.0","actualizado":"2026-08-26","nota":"El manual es DATO, no un documento aparte: la app lo muestra filtrado por lo que este equipo puede hacer, y `tools/gen-docs.mjs` genera con él docs/13-MANUAL.md. Así no existe la situación clásica de un manual que dice una cosa y una app que hace otra.","antesDeEmpezar":["Ninguna función que trate datos de personas se enciende antes de tener hecho el expediente de cumplimiento (sección «Antes de encender cámaras»).","La app avisa; no sanciona, no bloquea accesos y no decide nada sola sobre una persona.","Si el equipo no da para una función, la app lo dice al principio y propone el accesorio o el equipo que sí."],"secciones":[{"id":"empezar","titulo":"Diagnóstico: qué puede hacer este equipo","icon":"🩺","para":"ambos","cuando":"Lo primero, siempre. Antes de prometerle nada a nadie.","modulos":["diagnostico"],"requiereCaps":[],"pasos":[{"hacer":"Abre LiDARia en el equipo que vas a usar en terreno, no en el computador.","ojo":"El diagnóstico es del equipo donde corre la app: en el escritorio siempre dirá que no hay sensores, y es correcto."},{"hacer":"Concede los permisos de cámara y de movimiento cuando los pida.","ojo":"En iOS el permiso de movimiento se pide aparte y sin él no hay medición."},{"hacer":"Si es un iPhone, confirma el modelo en la lista.","ojo":"Safari no revela el modelo: sin confirmarlo, el diagnóstico trabaja con supuestos y lo dice."},{"hacer":"Pulsa «Probar sesión AR» donde aparezca.","ojo":"Es la única forma de saber de verdad qué módulos de realidad aumentada responden en ese navegador."},{"hacer":"Lee el nivel del equipo y la banda de error antes de medir nada."}],"siNoPuedes":{"porque":"El equipo no tiene sensor de profundidad utilizable.","conecta":[],"otraVia":"Usa el equipo como visor y captura con uno de los recomendados en la pestaña Equipos."},"legal":[],"errores":[{"sintoma":"Dice «capaz, pero bloqueado».","causa":"El equipo tiene el sensor y el navegador no lo expone.","solucion":"Instala la app nativa de LiDARia: es exactamente el caso que resuelve."},{"sintoma":"Todo aparece en gris en el computador.","causa":"El escritorio no captura.","solucion":"No es un fallo: usa el computador para revisar y exportar."}]},{"id":"medir","titulo":"Medir una distancia con el equipo","icon":"📏","para":"campo","cuando":"Una cota suelta en visita: un vano, una altura, un espacio libre.","modulos":["medir"],"requiereCaps":["media.camera","sensor.imu"],"pasos":[{"hacer":"Pulsa «Medir una distancia» y mueve el equipo despacio hasta que reconozca la superficie.","ojo":"Sin movimiento con paralaje no hay escala; con movimiento brusco, tampoco."},{"hacer":"Apunta al primer punto y toca la pantalla."},{"hacer":"Apunta al segundo punto: la distancia se actualiza en vivo. Toca para fijarla."},{"hacer":"Anota la banda de error que aparece junto a la medida.","ojo":"±1% con LiDAR y hasta ±7% por movimiento. Para cortar material, se remide a mano en el punto."}],"siNoPuedes":{"porque":"El navegador no ofrece sesión AR o el equipo no tiene profundidad.","conecta":[],"otraVia":"App nativa en iOS; en Android, Chrome actualizado. Si el equipo no tiene sensor, la medida sale por movimiento y con más error."},"legal":["Si en el encuadre aparecen personas, la foto acotada ya es dato personal: difumina antes de compartir."],"errores":[{"sintoma":"«No hay superficie detectada».","causa":"Pared lisa, poca luz o equipo quieto.","solucion":"Mueve lateralmente, busca textura o enciende luz. A oscuras solo el LiDAR responde."},{"sintoma":"La medida varía entre intentos.","causa":"Seguimiento limitado.","solucion":"Espera a que el indicador diga seguimiento bueno y repite."}]},{"id":"espacios","titulo":"Escanear una habitación o un local","icon":"🏠","para":"campo","cuando":"Levantamiento para presupuesto, ficha de propiedad, plano de salón o peritaje.","modulos":["espacios"],"requiereCaps":["media.camera","sensor.imu"],"pasos":[{"hacer":"Ponte en una esquina, con el recinto ordenado y la luz encendida."},{"hacer":"Recorre el perímetro despacio, apuntando a la unión entre muro y suelo.","ojo":"Ir rápido es la causa número uno de un plano torcido."},{"hacer":"Cierra el recorrido volviendo al punto de partida."},{"hacer":"Revisa el plano en el sitio y corrige los muros dudosos antes de irte.","ojo":"Corregir ahí toma un minuto; volver, una mañana."},{"hacer":"Exporta a DXF o IFC, o publica el recorrido 3D."}],"siNoPuedes":{"porque":"El equipo no tiene LiDAR ni ToF.","conecta":[],"otraVia":"Con un equipo del catálogo marcado como captura métrica. Con profundidad por movimiento se puede aproximar, pero no acotar un plano."},"legal":["Un escaneo de un local puede contener caras y matrículas: difuminado automático antes de subir."],"errores":[{"sintoma":"El plano no cierra.","causa":"Deriva del seguimiento en recorridos largos.","solucion":"Divide el recinto en tramos y vuelve a pasar por un punto conocido."}]},{"id":"objetos","titulo":"Escanear un producto para el catálogo","icon":"📦","para":"campo","cuando":"Llevar un producto real a la ficha de la tienda, con su modelo 3D y su medida.","modulos":["objetos"],"requiereCaps":["media.camera"],"pasos":[{"hacer":"Coloca el producto aislado, sobre superficie mate y con luz difusa.","ojo":"El brillo y el vidrio son los enemigos: lo que reluce, no reconstruye."},{"hacer":"Da dos vueltas completas: una a la altura del objeto y otra desde arriba."},{"hacer":"Revisa la malla y corrige el lado mayor real en centímetros.","ojo":"Ese número es el que habilita la vista AR en la tienda: si va en cero, no hay AR."},{"hacer":"Publica a Productos y activa la vista AR en la ficha."}],"siNoPuedes":{"porque":"El equipo no tiene profundidad.","conecta":[],"otraVia":"Captura por fotos y reconstrucción en servidor: más lento, con escala a confirmar, y funciona en casi cualquier teléfono."},"legal":[],"errores":[{"sintoma":"La malla sale con agujeros.","causa":"Superficie brillante o pasada muy rápida.","solucion":"Mate el brillo con luz difusa y repite la vuelta superior."}]},{"id":"epp","titulo":"Poner un control de implementos de seguridad","icon":"🦺","para":"ambos","cuando":"Control de EPP en un acceso, una ronda de supervisión o una faena.","modulos":["epp"],"requiereCaps":["media.camera"],"pasos":[{"hacer":"PRIMERO: completa el expediente de cumplimiento (ver «Antes de encender cámaras»).","ojo":"Sin las obligaciones bloqueantes respondidas, la app no enciende el módulo."},{"hacer":"Elige el rubro: eso define qué implementos son obligatorios y cuáles son según tarea."},{"hacer":"Elige la cámara y fija la distancia real al punto por donde pasan las personas."},{"hacer":"Mira la tabla: lo que quede «no evaluable» a esa distancia NO se va a vigilar.","ojo":"A 2,5 m de un tótem se ve todo; a 10 m solo el chaleco. Acerca el punto de control antes que subir la resolución."},{"hacer":"Haz una semana en modo observación, sin consecuencias, para calibrar."},{"hacer":"Enruta los avisos a quien pueda actuar: una alerta que nadie mira es ruido."}],"siNoPuedes":{"porque":"El equipo no ejecuta inferencia o la cámara está muy lejos.","conecta":["camara-ip","esp32-ble"],"otraVia":"Tótem en el acceso (la mejor relación esfuerzo/resultado) o análisis en servidor con una cámara existente."},"legal":["Información previa al personal, señalización visible y mención en el reglamento interno.","La supervisión con cámara de trabajadores exige proporcionalidad; en varios países, además, consulta al comité paritario o al sindicato.","Ninguna consecuencia laboral se toma solo con lo que dice el sistema: siempre revisa una persona."],"errores":[{"sintoma":"Marca falta de casco a gente que sí lo lleva.","causa":"Ángulo alto o gorro bajo el casco.","solucion":"Baja la cámara a la altura del paso y reentrena con fotos de la propia faena."},{"sintoma":"Demasiados avisos.","causa":"Zona mal dibujada o umbral bajo.","solucion":"Recalibra con datos reales; por encima de tres avisos falsos por turno, el equipo deja de mirarlos."}]},{"id":"presencia","titulo":"Vigilar una zona con una cámara que ya existe","icon":"👥","para":"consola","cuando":"Aforo, zonas restringidas, tránsito peatonal frente a maquinaria.","modulos":["presencia"],"requiereCaps":[],"pasos":[{"hacer":"Consigue la URL RTSP de la cámara (usuario, contraseña y canal)."},{"hacer":"Cárgala en el servidor de análisis: la app nunca se conecta directo a la cámara."},{"hacer":"Dibuja las zonas sobre el plano del recinto, no sobre una foto."},{"hacer":"Ajusta sensibilidad con una semana de datos reales antes de enrutar avisos."}],"siNoPuedes":{"porque":"No hay servidor de análisis contratado.","conecta":["camara-ip"],"otraVia":"Con la cámara del propio equipo, en sesiones puntuales de supervisión."},"legal":["Videovigilancia: señalización, finalidad declarada, retención acotada y acceso restringido.","El conteo es anónimo. Identificar personas es otra cosa y tiene su propia puerta."],"errores":[{"sintoma":"Se dispara con lluvia o con animales.","causa":"Detección de movimiento en vez de detección de persona.","solucion":"Confirma que la zona esté configurada por clase (persona/vehículo) y no por movimiento."}]},{"id":"dron","titulo":"Conectar un dron","icon":"🚁","para":"consola","cuando":"Supervisión de área, avance de obra, recorrido de instalaciones.","modulos":["presencia","obra"],"requiereCaps":[],"pasos":[{"hacer":"En la app del fabricante: Ajustes → Transmisión en vivo → RTMP personalizado."},{"hacer":"Pega la URL del servidor de ingesta que entrega LiDARia."},{"hacer":"Vuela: el análisis ocurre en el servidor, no en el dron.","ojo":"La emisión en vivo va limitada a 720p y con varios segundos de retraso."},{"hacer":"Para calidad: graba en 4K y sube el archivo al aterrizar. Triplica el alcance útil."}],"siNoPuedes":{"porque":"Los drones de consumo no tienen SDK: no se pueden pilotar ni leer desde la app.","conecta":["dron-consumo","dron-empresarial"],"otraVia":"Para supervisión automática hace falta un dron empresarial con SDK (solo Android)."},"legal":["Grabar personas desde el aire es tratamiento de datos igual que desde el suelo.","Además aplican las reglas aeronáuticas locales de vuelo, que son otro trámite."],"errores":[{"sintoma":"No se detecta el casco desde el aire.","causa":"A 720p el casco solo se reconoce hasta unos 5 m, y un dron no vuela a esa altura.","solucion":"Usa el dron para ubicar personas y zonas; el control de EPP se hace en el acceso."}]},{"id":"termica","titulo":"Conectar una cámara térmica","icon":"🌡️","para":"campo","cuando":"Termografía de tableros, motores, rodamientos y cadena de frío.","modulos":["termico"],"requiereCaps":[],"pasos":[{"hacer":"Conecta el accesorio térmico al puerto del equipo."},{"hacer":"Abre la app NATIVA de LiDARia: el navegador no habla con estos accesorios."},{"hacer":"Fija emisividad y distancia antes de medir.","ojo":"Sin eso, dos lecturas del mismo equipo no son comparables."},{"hacer":"Asocia cada lectura a su activo en el mapa y define el umbral de alarma."}],"siNoPuedes":{"porque":"Ningún teléfono trae cámara térmica.","conecta":["camara-termica","esp32-ble","sensor-temp-ambiental"],"otraVia":"Para temperatura de una sala o de una cámara de frío, un sensor ESP32 sale mucho más barato que una térmica."},"legal":["Este módulo mide EQUIPOS y PROCESOS. Medir temperatura corporal de personas es un uso regulado y no se ofrece con este hardware."],"errores":[{"sintoma":"Lecturas distintas cada vez.","causa":"Emisividad mal fijada o reflejos.","solucion":"Usa cinta mate de referencia sobre la superficie y mide siempre desde la misma distancia."}]},{"id":"esp32","titulo":"Conectar un sensor propio (ESP32 y similares)","icon":"📟","para":"ambos","cuando":"Temperatura ambiental, gases, ruido, peso, contacto: todo lo que la cámara no puede ver.","modulos":["termico","volumen","gemelo"],"requiereCaps":[],"pasos":[{"hacer":"Decide la vía: BLE si es un sensor suelto en terreno; Wi-Fi con MQTT si son varios o es registro continuo."},{"hacer":"BLE — Android: LiDARia → Accesorios → Buscar por Bluetooth. iOS: hace falta la app nativa, Safari no expone Bluetooth."},{"hacer":"MQTT — configura el ESP32 con la red y el broker; en LiDARia pega broker, tema y credenciales.","ojo":"MQTT funciona igual en iOS y Android: si hay que elegir una sola vía, es esta."},{"hacer":"Asigna el sensor a un punto o a un activo del mapa: una lectura sin lugar no sirve para nada."},{"hacer":"Define umbrales y a quién avisan."}],"siNoPuedes":{"porque":"En iOS el navegador no expone Bluetooth ni USB.","conecta":["esp32-wifi","esp32-ble"],"otraVia":"Usa la vía MQTT, que es de red y funciona en cualquier plataforma."},"legal":["Los datos ambientales no son datos personales: esta es de las pocas ampliaciones que se encienden sin trámite."],"errores":[{"sintoma":"El navegador no encuentra el dispositivo BLE.","causa":"Safari en iOS, o Chrome sin permiso de ubicación en Android.","solucion":"App nativa en iOS; en Android, concede ubicación (Bluetooth la exige para descubrir)."},{"sintoma":"Lecturas que derivan con el tiempo.","causa":"Sensores de bajo costo sin calibrar.","solucion":"Calibra contra un patrón y repite cada cierto tiempo; para valores con consecuencia legal, equipo certificado."}]},{"id":"peso","titulo":"Conectar una báscula o celda de carga","icon":"⚖️","para":"consola","cuando":"Completar el cubicaje por cámara con el peso real del bulto.","modulos":["volumen"],"requiereCaps":[],"pasos":[{"hacer":"Celda de carga con HX711 sobre ESP32, o báscula comercial con BLE o salida serie."},{"hacer":"Calibra con una masa patrón conocida."},{"hacer":"Asocia la báscula al punto de despacho: el peso se suma a la ficha del bulto junto al volumen."}],"siNoPuedes":{"porque":"No hay báscula conectable.","conecta":["bascula-ble","celda-carga"],"otraVia":"Entrada manual del peso en la ficha del bulto."},"legal":["Facturar por peso o por volumen medido exige certificación metrológica legal. Sin ella, es control interno."],"errores":[]},{"id":"biometria","titulo":"Encender identidad y biometría","icon":"🪪","para":"consola","cuando":"Cuando hace falta saber QUIÉN, y no solo QUÉ pasó.","modulos":["biometria"],"requiereCaps":[],"pasos":[{"hacer":"Empieza por el peldaño más bajo que resuelva el problema: credencial NFC, QR o etiqueta BLE.","ojo":"Resuelve el 90% de los casos, no es dato sensible y se revoca quitando la credencial."},{"hacer":"Si de verdad hace falta biometría, completa el expediente ENTERO antes de tocar nada.","ojo":"Consentimiento explícito por persona, EIPD previa y justificación escrita de por qué la credencial no basta."},{"hacer":"Prefiere verificación 1:1 (la persona declara quién es y el sistema confirma) sobre identificación 1:N."},{"hacer":"Enrola guardando PLANTILLAS irreversibles y cifradas, nunca fotografías."},{"hacer":"Activa prueba de vida: con LiDAR o TrueDepth, una foto impresa se descarta al instante."},{"hacer":"Registra quién autorizó la activación. La app lo exige y lo guarda.","ojo":"Es la primera pregunta de cualquier fiscalización."},{"hacer":"Prueba la revocación antes de operar: si no sabes borrar, no puedes enrolar."}],"siNoPuedes":{"porque":"El expediente está incompleto o el equipo no tiene sensor de profundidad para prueba de vida.","conecta":["lector-nfc","etiqueta-ble"],"otraVia":"Identidad por credencial: misma trazabilidad, sin dato sensible."},"legal":["Ley 21.719 (vigente el 1 de diciembre de 2026): el dato biométrico es categoría especial.","En una relación laboral el consentimiento rara vez es libre: si negarse tiene costo, no es consentimiento.","Las tasas de error de la comparación facial no son iguales para todos los grupos: cualquier consecuencia exige revisión humana.","Revocar tiene que borrar de verdad: plantilla, derivados y copias, con constancia."],"errores":[{"sintoma":"La app no deja encender la función.","causa":"Quedan obligaciones bloqueantes sin responder.","solucion":"No es un fallo: es la puerta. Completa el expediente en la pestaña de cumplimiento."}]},{"id":"packs","titulo":"Ampliar el conocimiento con un pack de rubro","icon":"📦","para":"consola","cuando":"Tu industria no está en el catálogo, o la tuya trabaja distinto.","modulos":[],"requiereCaps":[],"pasos":[{"hacer":"Copia el pack de ejemplo y cámbiale el id a tu namespace (tuorg.tu-rubro)."},{"hacer":"Describe tolerancia, módulos en orden, flujo, KPI y material de prospección."},{"hacer":"Empaqueta: node tools/pack-rubro.mjs tu-rubro.json"},{"hacer":"Cárgalo en LiDARia → Rubros → Ampliar la base de conocimiento."}],"siNoPuedes":{"porque":"El pack no pasa la validación.","conecta":[],"otraVia":"El validador dice exactamente qué falta: módulo inexistente, tolerancia sin distancia o id repetido."},"legal":[],"errores":[{"sintoma":"«El rubro ya existe».","causa":"Estás pisando uno del producto.","solucion":"Usa otro id, o declara extiende: true para sumarle tu flujo sin copiarlo."}]},{"id":"cumplimiento","titulo":"Antes de encender cámaras: el expediente","icon":"⚖️","para":"consola","cuando":"Antes de la primera cámara, no después del primer reclamo.","modulos":["epp","presencia","biometria","cuerpo"],"requiereCaps":[],"pasos":[{"hacer":"Clasifica el tratamiento: ¿aparecen personas? ¿es observación sistemática? ¿hay datos sensibles?"},{"hacer":"Responde el checklist de la app. Las obligaciones bloqueantes son las que impiden encender."},{"hacer":"Deja constancia de quién respondió y cuándo: eso es la responsabilidad proactiva que exige la ley."},{"hacer":"Fija el plazo de conservación por módulo y comprueba que el borrado automático funciona."},{"hacer":"Publica el canal para ejercer derechos y designa a quién responde."}],"siNoPuedes":{"porque":"El expediente está incompleto.","conecta":[],"otraVia":"Empieza por lo que no trata datos personales: medir, escanear espacios vacíos, termografía de equipos."},"legal":["Ley 21.719, vigente el 1 de diciembre de 2026, con Agencia que fiscaliza y sanciona.","Multas de hasta 20.000 UTM por infracción gravísima, y hasta 4% de los ingresos anuales en caso de reincidencia.","La EIPD es obligatoria para tratamientos de alto riesgo: observación sistemática, tratamiento masivo y datos sensibles.","Esto no es asesoría legal: es la lista de lo que hay que tener hecho. El texto de la ley manda."],"errores":[]},{"id":"problemas","titulo":"Cuando algo no funciona","icon":"🔧","para":"ambos","cuando":"Antes de escribir a soporte.","modulos":[],"requiereCaps":[],"pasos":[{"hacer":"Repite el diagnóstico: la mitad de los problemas son un permiso denegado."},{"hacer":"Exporta el informe de diagnóstico y adjúntalo a la consulta.","ojo":"Trae equipo, capacidades activas y bloqueadas: con eso se responde en un mensaje en vez de en cinco."},{"hacer":"Comprueba la versión que muestra la app en la cabecera."}],"siNoPuedes":{"porque":"El problema persiste.","conecta":[],"otraVia":"Escribe adjuntando el informe de diagnóstico y, si es de captura, una foto de la escena."},"legal":[],"errores":[{"sintoma":"La app pide permisos que ya di.","causa":"Permiso concedido en otro navegador o en modo privado.","solucion":"Abre siempre desde el mismo navegador y evita ventanas privadas."},{"sintoma":"El accesorio se desconecta solo.","causa":"Ahorro de energía del sistema.","solucion":"Excluye LiDARia del ahorro de batería y mantén la pantalla encendida durante la captura."}]}]},"matriz":[{"equipo":"apple.iphone.pro.12-17","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":8,"visor":4,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","espacios":"potencial","objetos":"potencial","obra":"potencial","gemelo":"potencial","cuerpo":"potencial","accesibilidad":"potencial","medir":"potencial","volumen":"potencial","termico":"visor","presencia":"visor","epp":"visor","biometria":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":9,"degradados":1,"potenciales":0,"visor":5,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","espacios":"completo","objetos":"completo","cuerpo":"completo","medir":"completo","obra":"completo","gemelo":"completo","accesibilidad":"completo","volumen":"completo","vitrina-ar":"degradado","termico":"visor","biometria":"visor","presencia":"visor","epp":"visor","terreno":"visor"}}},{"equipo":"apple.ipadpro.2020+","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":8,"visor":4,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","espacios":"potencial","objetos":"potencial","cuerpo":"potencial","accesibilidad":"potencial","medir":"potencial","volumen":"potencial","obra":"potencial","gemelo":"potencial","termico":"visor","presencia":"visor","epp":"visor","biometria":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":7,"degradados":3,"potenciales":0,"visor":5,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","espacios":"completo","objetos":"completo","cuerpo":"completo","medir":"completo","accesibilidad":"completo","volumen":"completo","vitrina-ar":"degradado","obra":"degradado","gemelo":"degradado","biometria":"visor","termico":"visor","presencia":"visor","epp":"visor","terreno":"visor"}}},{"equipo":"apple.iphone.estandar","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":3,"visor":9,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","objetos":"potencial","cuerpo":"potencial","medir":"potencial","termico":"visor","espacios":"visor","presencia":"visor","epp":"visor","obra":"visor","gemelo":"visor","accesibilidad":"visor","biometria":"visor","volumen":"visor"}},"nativo":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.structured","sensorLabel":"Luz estructurada frontal","errorA3m":0.015,"resumen":{"completos":2,"degradados":3,"potenciales":0,"visor":10,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","cuerpo":"completo","medir":"degradado","objetos":"degradado","vitrina-ar":"degradado","termico":"visor","biometria":"visor","espacios":"visor","presencia":"visor","epp":"visor","obra":"visor","gemelo":"visor","terreno":"visor","accesibilidad":"visor","volumen":"visor"}}},{"equipo":"apple.visionpro","web":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":7,"degradados":4,"potenciales":0,"visor":4,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","espacios":"completo","objetos":"completo","vitrina-ar":"completo","cuerpo":"completo","accesibilidad":"completo","volumen":"completo","medir":"degradado","obra":"degradado","gemelo":"degradado","terreno":"degradado","biometria":"visor","termico":"visor","presencia":"visor","epp":"visor"}},"nativo":null},{"equipo":"meta.quest3","web":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.dtof","sensorLabel":"LiDAR (dToF)","errorA3m":0.03,"resumen":{"completos":3,"degradados":8,"potenciales":0,"visor":4,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","vitrina-ar":"completo","volumen":"completo","medir":"degradado","espacios":"degradado","objetos":"degradado","obra":"degradado","gemelo":"degradado","terreno":"degradado","accesibilidad":"degradado","cuerpo":"degradado","biometria":"visor","presencia":"visor","epp":"visor","termico":"visor"}},"nativo":null},{"equipo":"android.xr.visores","web":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.stereo","sensorLabel":"Estéreo multicámara","errorA3m":0.12,"resumen":{"completos":1,"degradados":4,"potenciales":0,"visor":10,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","medir":"degradado","gemelo":"degradado","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","volumen":"visor","obra":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"samsung.tof.2019-2020","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":7,"visor":5,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","obra":"potencial","gemelo":"potencial","medir":"potencial","espacios":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","termico":"visor","presencia":"visor","epp":"visor","cuerpo":"visor","biometria":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.itof","sensorLabel":"ToF continuo (iToF)","errorA3m":0.07500000000000001,"resumen":{"completos":4,"degradados":5,"potenciales":0,"visor":6,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","obra":"completo","gemelo":"completo","volumen":"completo","medir":"degradado","vitrina-ar":"degradado","accesibilidad":"degradado","espacios":"degradado","objetos":"degradado","termico":"visor","terreno":"visor","presencia":"visor","epp":"visor","cuerpo":"visor","biometria":"visor"}}},{"equipo":"samsung.flagship.reciente","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":5,"visor":7,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","objetos":"potencial","gemelo":"potencial","accesibilidad":"potencial","medir":"potencial","volumen":"potencial","termico":"visor","espacios":"visor","presencia":"visor","epp":"visor","obra":"visor","cuerpo":"visor","biometria":"visor"}},"nativo":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.stereo","sensorLabel":"Estéreo multicámara","errorA3m":0.12,"resumen":{"completos":4,"degradados":3,"potenciales":0,"visor":8,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","gemelo":"completo","accesibilidad":"completo","volumen":"completo","medir":"degradado","objetos":"degradado","vitrina-ar":"degradado","termico":"visor","obra":"visor","espacios":"visor","presencia":"visor","epp":"visor","terreno":"visor","cuerpo":"visor","biometria":"visor"}}},{"equipo":"huawei.tof","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":4,"visor":8,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","medir":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","termico":"visor","obra":"visor","gemelo":"visor","espacios":"visor","presencia":"visor","epp":"visor","cuerpo":"visor","biometria":"visor"}},"nativo":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":0,"potenciales":4,"visor":10,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","medir":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","termico":"visor","obra":"visor","gemelo":"visor","terreno":"visor","espacios":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","cuerpo":"visor","biometria":"visor"}}},{"equipo":"sony.xperia1.tof","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":6,"visor":6,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","obra":"potencial","medir":"potencial","espacios":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","termico":"visor","gemelo":"visor","presencia":"visor","epp":"visor","cuerpo":"visor","biometria":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.itof","sensorLabel":"ToF continuo (iToF)","errorA3m":0.07500000000000001,"resumen":{"completos":2,"degradados":6,"potenciales":0,"visor":7,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","volumen":"completo","medir":"degradado","vitrina-ar":"degradado","obra":"degradado","espacios":"degradado","objetos":"degradado","accesibilidad":"degradado","termico":"visor","gemelo":"visor","terreno":"visor","presencia":"visor","epp":"visor","cuerpo":"visor","biometria":"visor"}}},{"equipo":"honor.lg.tof","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":4,"visor":8,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","medir":"potencial","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","espacios":"visor","presencia":"visor","epp":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","termico":"visor","biometria":"visor"}},"nativo":{"nivel":"captura-metrica","nivelLabel":"Captura métrica","sensor":"depth.itof","sensorLabel":"ToF continuo (iToF)","errorA3m":0.07500000000000001,"resumen":{"completos":1,"degradados":5,"potenciales":0,"visor":9,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","medir":"degradado","objetos":"degradado","volumen":"degradado","accesibilidad":"degradado","espacios":"visor","presencia":"visor","epp":"visor","obra":"visor","gemelo":"visor","terreno":"visor","cuerpo":"visor","termico":"visor","biometria":"visor"}}},{"equipo":"android.arcore.generico","web":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.motion","sensorLabel":"Profundidad por movimiento","errorA3m":0.21000000000000002,"resumen":{"completos":1,"degradados":5,"potenciales":2,"visor":7,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","vitrina-ar":"degradado","terreno":"degradado","medir":"degradado","objetos":"degradado","volumen":"degradado","gemelo":"potencial","accesibilidad":"potencial","termico":"visor","obra":"visor","espacios":"visor","presencia":"visor","epp":"visor","cuerpo":"visor","biometria":"visor"}},"nativo":{"nivel":"captura-basica","nivelLabel":"Captura asistida","sensor":"depth.motion","sensorLabel":"Profundidad por movimiento","errorA3m":0.21000000000000002,"resumen":{"completos":3,"degradados":4,"potenciales":0,"visor":8,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","gemelo":"completo","volumen":"completo","medir":"degradado","vitrina-ar":"degradado","accesibilidad":"degradado","objetos":"degradado","obra":"visor","termico":"visor","terreno":"visor","espacios":"visor","presencia":"visor","epp":"visor","cuerpo":"visor","biometria":"visor"}}},{"equipo":"android.sinarcore","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":0,"visor":12,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","termico":"visor","obra":"visor","gemelo":"visor","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","volumen":"visor","cuerpo":"visor","accesibilidad":"visor","biometria":"visor"}},"nativo":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":0,"potenciales":0,"visor":14,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","termico":"visor","obra":"visor","gemelo":"visor","terreno":"visor","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","volumen":"visor","cuerpo":"visor","accesibilidad":"visor","biometria":"visor"}}},{"equipo":"pc.escritorio","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":2,"degradados":0,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"completo","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"pc.sensor3d","web":{"nivel":"bloqueado","nivelLabel":"Capaz, pero bloqueado","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":2,"degradados":0,"potenciales":3,"visor":10,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"completo","objetos":"potencial","volumen":"potencial","accesibilidad":"potencial","medir":"visor","espacios":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"tv.totem","web":{"nivel":"consola","nivelLabel":"Consola","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"reloj.wearable","web":{"nivel":"consola","nivelLabel":"Consola","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"campo.dron.escaner","web":{"nivel":"consola","nivelLabel":"Consola","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"dji.neo2","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","termico":"visor","presencia":"visor","epp":"visor","obra":"visor","gemelo":"visor","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","cuerpo":"visor","accesibilidad":"visor","biometria":"visor"}},"nativo":null},{"equipo":"dji.enterprise","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":2,"potenciales":0,"visor":12,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","vitrina-ar":"degradado","termico":"visor","presencia":"visor","epp":"visor","obra":"visor","gemelo":"visor","medir":"visor","espacios":"visor","objetos":"visor","volumen":"visor","cuerpo":"visor","accesibilidad":"visor","biometria":"visor"}},"nativo":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":0,"potenciales":0,"visor":14,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","termico":"visor","presencia":"visor","epp":"visor","obra":"visor","gemelo":"visor","terreno":"visor","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","cuerpo":"visor","accesibilidad":"visor","biometria":"visor"}}},{"equipo":"camara.ip","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","presencia":"visor","epp":"visor","medir":"visor","espacios":"visor","objetos":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"accesorio.termico","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":1,"degradados":1,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"degradado","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null},{"equipo":"totem.camara","web":{"nivel":"visor-camara","nivelLabel":"Cámara sin profundidad","sensor":null,"sensorLabel":"sin medición métrica","errorA3m":null,"resumen":{"completos":2,"degradados":0,"potenciales":0,"visor":13,"noDisponibles":0,"total":15},"modulos":{"diagnostico":"completo","terreno":"completo","medir":"visor","espacios":"visor","objetos":"visor","presencia":"visor","epp":"visor","vitrina-ar":"visor","volumen":"visor","obra":"visor","gemelo":"visor","cuerpo":"visor","accesibilidad":"visor","termico":"visor","biometria":"visor"}},"nativo":null}]};

/* ------------------------------- utilidades ------------------------------- */

const usd = (n) => (n == null || !isFinite(n) ? '—' : '$' + Math.round(n).toLocaleString('es-CL'));
const pct = (n, d) => (n == null || !isFinite(n) ? '—' : (n * 100).toFixed(d == null ? 0 : d) + '%');
const meses = (n) => (!isFinite(n) ? 'nunca' : n.toFixed(1) + ' m');
const cm = (m) => (m == null ? '—' : (m < 0.01 ? (m * 1000).toFixed(0) + ' mm' : (m * 100).toFixed(1) + ' cm'));

const TABS = [
  ['panel', 'Panel', '🛰️'],
  ['rubros', 'Rubros', '🏭'],
  ['modulos', 'Módulos', '🧩'],
  ['inventario', 'Inventario', '🎒'],
  ['equipos', 'Equipos', '📱'],
  ['prospeccion', 'Prospección', '🎯'],
  ['vision', 'Visión', '👁️'],
  ['extensiones', 'Extensiones', '🧩'],
  ['manual', 'Manual', '📖'],
  ['ecosistema', 'Ecosistema', '🔗'],
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
    packs: [],
    rubroSel: null,
    vision: { rubro: 'construccion', fuente: 'totem', distanciaM: 3 },
    manualSel: null,
    expediente: {},
    accesorios: [],
    responsable: '',
    nivelLegal: 'sensibles',
    prospecto: { nombre: '', rubro: '', usuariosCampo: null, equipos: [], appsKimos: [] },
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
      const { v, tab, inventario, packs, prospecto, rubroSel, vision, sup, urlApp,
        expediente, accesorios, responsable, nivelLegal } = estado;
      Promise.resolve(shell.saveData({
        v, tab, inventario, packs, prospecto, rubroSel, vision, sup, urlApp,
        expediente, accesorios, responsable, nivelLegal,
      })).catch(() => {});
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
      // Los packs se revalidan al restaurar: un pack guardado con una versión
      // vieja del catálogo puede haber quedado apuntando a un módulo que ya no
      // existe, y entrar en silencio sería peor que descartarlo.
      if (Array.isArray(d.packs)) {
        const catalogos = {
          modulos: DATOS.modules.modulos.map((m) => m.id),
          equipos: DATOS.devices.equipos.map((e) => e.id),
        };
        patch.packs = d.packs.filter((p) => validarPack(p, catalogos).ok);
      }
      if (d.prospecto && typeof d.prospecto === 'object') {
        patch.prospecto = Object.assign({ nombre: '', rubro: '', usuariosCampo: null, equipos: [], appsKimos: [] }, d.prospecto);
      }
      if (typeof d.rubroSel === 'string') patch.rubroSel = d.rubroSel;
      if (d.expediente && typeof d.expediente === 'object') patch.expediente = d.expediente;
      if (Array.isArray(d.accesorios)) patch.accesorios = d.accesorios.filter((a) => !!accesorioPorId(DATOS.accesorios, a));
      if (typeof d.responsable === 'string') patch.responsable = d.responsable;
      if (typeof d.nivelLegal === 'string') patch.nivelLegal = d.nivelLegal;
      if (d.vision && typeof d.vision === 'object') {
        patch.vision = Object.assign({ rubro: 'construccion', fuente: 'totem', distanciaM: 3 }, d.vision);
      }
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


  /* ------------------------- rubros y packs de rubro ------------------------ */

  /** Catálogo de rubros del producto más los packs cargados por la organización. */
  function rubrosActivos() {
    const carga = cargarPacks(DATOS.rubros, estado.packs || [], {
      modulos: DATOS.modules.modulos.map((m) => m.id),
      equipos: DATOS.devices.equipos.map((e) => e.id),
    });
    return carga;
  }

  /** Contexto que necesita el motor de rubros: estado por módulo según el inventario. */
  function ctxRubro(cob) {
    const inv = estado.inventario;
    const mejorSensorInventario = () => {
      const orden = ['depth.dtof', 'depth.structured', 'depth.itof', 'depth.stereo', 'depth.motion'];
      let mejor = null;
      for (const i of inv) {
        const f = filaMatriz(i.equipo);
        const m = (f && f.nativo) || (f && f.web);
        if (!m || !m.sensor) continue;
        if (mejor == null || orden.indexOf(m.sensor) < orden.indexOf(mejor)) mejor = m.sensor;
      }
      return mejor;
    };
    return {
      sensorId: mejorSensorInventario(),
      modulos: DATOS.modules,
      equipos: DATOS.devices,
      estadoModulo: (id) => (cob.porModulo[id] || {}).estado || 'no-disponible',
      appsAncla: ['productlab', 'productos', 'tienda', 'vitrina', 'prospeccion'],
      equipoSirve: (equipoId) => {
        const f = filaMatriz(equipoId);
        const m = (f && f.nativo) || (f && f.web);
        return !!(m && m.sensor);
      },
    };
  }

  async function cargarPackArchivo(archivo) {
    try {
      const pack = /\.krub$/i.test(archivo.name)
        ? leerKrub(await archivo.arrayBuffer())
        : JSON.parse(await archivo.text());
      const catalogos = {
        modulos: DATOS.modules.modulos.map((m) => m.id),
        equipos: DATOS.devices.equipos.map((e) => e.id),
      };
      const v = validarPack(pack, catalogos);
      if (!v.ok) {
        if (shell && shell.notify) shell.notify({ level: 'error', text: 'Pack rechazado: ' + v.errores[0] });
        return;
      }
      const packs = (estado.packs || []).filter((p) => p.id !== pack.id).concat([pack]);
      const prueba = cargarPacks(DATOS.rubros, packs, catalogos);
      if (prueba.errores.length) {
        if (shell && shell.notify) shell.notify({ level: 'error', text: 'Pack rechazado: ' + prueba.errores[0] });
        return;
      }
      commit({ packs: packs });
      if (shell && shell.notify) {
        shell.notify({ level: 'success', text: 'Pack "' + (pack.nombre || pack.id) + '" cargado: ' + pack.rubros.length + ' entrada(s).' });
      }
    } catch (e) {
      if (shell && shell.notify) shell.notify({ level: 'error', text: 'No se pudo leer el pack: ' + ((e && e.message) || e) });
    }
  }

  function quitarPack(id) {
    commit({ packs: (estado.packs || []).filter((p) => p.id !== id) });
  }

  function vistaRubros(cob) {
    const carga = rubrosActivos();
    const ctx = ctxRubro(cob);
    const lista = rubrosViables(carga.rubros, ctx);
    const sel = estado.rubroSel ? carga.rubros.filter((r) => r.id === estado.rubroSel)[0] : null;

    const chipMargen = (t) => {
      if (t.cumple == null) return chip('sin tolerancia declarada');
      if (t.cumple === false) return chip('no alcanza', 'ld-t-no', t.motivo);
      return chip(t.margen === 'justo' ? 'cumple justo' : 'cumple con margen', t.margen === 'justo' ? 'ld-t-justo' : 'ld-t-ok', t.motivo);
    };

    const fichas = lista.map(({ plan, listos, total, puntaje }) => h('article', {
      key: plan.rubro.id,
      className: 'ld-mod' + (estado.rubroSel === plan.rubro.id ? ' on' : ''),
      onClick: () => commit({ rubroSel: estado.rubroSel === plan.rubro.id ? null : plan.rubro.id }),
    },
      h('header', null,
        h('span', { className: 'ld-mod-ico' }, plan.rubro.icon || '•'),
        h('div', null,
          h('h3', null, plan.rubro.nombre),
          h('p', { className: 'ld-mini' }, listos + '/' + total + ' módulos listos'
            + (plan.rubro.origen !== 'base' ? ' · pack ' + plan.rubro.origen : ''))),
        h('span', { className: 'ld-est' }, puntaje + '%')),
      h('p', null, plan.dolor),
      h('div', { className: 'ld-chips' }, chipMargen(plan.tolerancia))));

    const detalle = !sel ? null : (function () {
      const plan = planDeRubro(sel, ctx);
      return card((sel.icon || '') + ' ' + sel.nombre,
        h('div', null,
          h('div', { className: 'ld-cols' },
            h('div', null,
              h('h4', null, 'Quién es el cliente'), h('p', null, plan.cliente),
              h('h4', null, 'Qué le duele'), h('p', null, plan.dolor),
              h('h4', null, 'Tolerancia del rubro'),
              h('p', null, plan.tolerancia.motivo),
              plan.toleranciaNota ? h('p', { className: 'ld-mini' }, plan.toleranciaNota) : null,
              h('h4', null, 'Módulos, en orden'),
              h('ul', { className: 'ld-lista' }, plan.modulos.map((m) => h('li', { key: m.id },
                h('b', null, m.icon + ' ' + m.nombre), ' — ', m.para,
                ' ', pastilla(m.estado))))),
            h('div', null,
              h('h4', null, 'Cómo se trabaja'),
              (plan.flujos || []).map((f) => h('div', { className: 'ld-gap', key: f.id },
                h('b', null, f.nombre),
                h('ol', { className: 'ld-lista ld-mini' }, (f.pasos || []).map((p, i) => h('li', { key: i }, p))),
                h('div', { className: 'ld-mini' }, 'Entrega: ' + (f.entrega || []).join(' · ')))),
              h('h4', null, 'Qué mejora'),
              h('ul', { className: 'ld-lista ld-mini' }, (plan.kpis || []).map((k) => h('li', { key: k.id }, h('b', null, k.label), ' → ' + k.meta))),
              plan.normativa.length ? h('div', null,
                h('h4', null, 'Cuidado con'),
                h('ul', { className: 'ld-lista ld-mini' }, plan.normativa.map((n, i) => h('li', { key: i }, n)))) : null,
              h('h4', null, 'Se apoya en'),
              h('div', { className: 'ld-chips' }, (plan.kimos || []).map((k) => chip(k, 'kimos'))))),
          h('h4', null, 'Qué hacer ahora'),
          h('ul', { className: 'ld-lista' }, plan.acciones.map((a, i) => h('li', { key: i }, a))),
          h('div', { className: 'ld-fila' },
            h('button', {
              className: 'ld-btn ld-pri',
              onClick: () => commit({ tab: 'prospeccion', prospecto: Object.assign({}, estado.prospecto, { rubro: sel.id }) }),
            }, 'Preparar una visita de este rubro'))),
        { clase: 'ld-detalle' });
    })();

    const packs = (estado.packs || []);
    return h('div', null,
      card('🏭 La misma app, el lenguaje de cada industria',
        h('div', null,
          h('p', null, 'Un rubro traduce las capacidades a decisiones: con qué tolerancia se trabaja, qué módulos importan y en qué orden, cómo es el flujo, qué KPI mejora y qué normativa hay que respetar. El porcentaje es qué tan cerca está la organización de poder ejecutarlo con su inventario actual.'),
          h('div', { className: 'ld-kpis' },
            kpi('Rubros disponibles', carga.rubros.length, packs.length ? (carga.rubros.length - DATOS.rubros.rubros.length) + ' de packs' : 'del catálogo base'),
            kpi('Listos para empezar', lista.filter((x) => x.plan.listoParaEmpezar).length, 'con el inventario actual'),
            kpi('Packs cargados', packs.length, 'ampliaciones de la organización')))),

      card('📦 Ampliar la base de conocimiento',
        h('div', null,
          h('p', null, 'Un rubro nuevo —o la variante propia de un cliente— entra como un pack ',
            h('b', null, '.krub'), ' o ', h('b', null, '.json'),
            ', con las mismas convenciones que una app de KIMOS: id con namespace, versión semver, autor y contrato declarado. Un pack solo puede ',
            h('b', null, 'añadir o extender'), ': nunca borra lo que trae el producto, y cada rubro queda marcado con su origen.'),
          h('div', { className: 'ld-fila' },
            h('input', {
              type: 'file', accept: '.krub,.json', className: 'ld-input',
              onChange: (e) => { const f = e.target.files && e.target.files[0]; if (f) cargarPackArchivo(f); e.target.value = ''; },
            })),
          packs.length ? h('div', { className: 'ld-tbl-wrap' }, h('table', { className: 'ld-tbl' },
            h('thead', null, h('tr', null, ['Pack', 'Versión', 'Autor', 'Entradas', ''].map((t) => h('th', { key: t }, t)))),
            h('tbody', null, packs.map((p) => h('tr', { key: p.id },
              h('td', null, h('b', null, p.nombre || p.id), h('div', { className: 'ld-mini' }, p.id)),
              h('td', null, p.version || '—'),
              h('td', null, p.autor || '—'),
              h('td', null, (p.rubros || []).length),
              h('td', null, h('button', { className: 'ld-btn ld-mini-btn', onClick: () => quitarPack(p.id) }, 'Quitar'))))))) : null,
          carga.errores.length ? h('p', { className: 'ld-hint' }, 'Avisos de carga: ' + carga.errores.join(' · ')) : null),
        { hint: 'Se empaqueta con node tools/pack-rubro.mjs desde el repositorio kimos-LiDARia, o desde el Creator Pack de KIMOS.' }),

      detalle,
      h('div', { className: 'ld-grid' }, fichas));
  }

  /* ------------------------------- prospección ------------------------------ */

  function setProspecto(patch) {
    commit({ prospecto: Object.assign({}, estado.prospecto, patch) });
  }

  function fichaActual(cob) {
    const carga = rubrosActivos();
    const p = estado.prospecto || {};
    const rubro = carga.rubros.filter((r) => r.id === p.rubro)[0] || null;
    const ctx = Object.assign({}, ctxRubro(cob), { rubro: rubro });
    return { ficha: fichaProspecto(p, ctx), rubro: rubro, carga: carga };
  }

  function vistaProspeccion(cob) {
    const p = estado.prospecto || {};
    const { ficha, rubro, carga } = fichaActual(cob);

    const formulario = card('🎯 El prospecto',
      h('div', null,
        h('p', null, 'Tres datos deciden qué se le puede ofrecer: su rubro, cuánta gente tiene en terreno y ',
          h('b', null, 'qué equipos usan'), '. El tercero es el que ningún CRM tiene hoy, y el que define si la propuesta es real o una promesa.'),
        h('div', { className: 'ld-campos' },
          h('label', { className: 'ld-campo' }, h('span', null, 'Nombre'),
            h('input', { type: 'text', value: p.nombre || '', onChange: (e) => setProspecto({ nombre: e.target.value.slice(0, 80) }) })),
          h('label', { className: 'ld-campo' }, h('span', null, 'Rubro'),
            h('select', { value: p.rubro || '', onChange: (e) => setProspecto({ rubro: e.target.value }) },
              h('option', { value: '' }, '— elegir —'),
              carga.rubros.map((r) => h('option', { key: r.id, value: r.id }, (r.icon || '') + ' ' + r.nombre)))),
          h('label', { className: 'ld-campo' }, h('span', null, 'Personas en terreno'),
            h('input', { type: 'number', min: 0, value: p.usuariosCampo == null ? '' : p.usuariosCampo, onChange: (e) => setProspecto({ usuariosCampo: Number(e.target.value) || 0 }) }))),
        h('h4', null, 'Equipos que usan hoy'),
        h('div', { className: 'ld-chips' }, DATOS.devices.equipos.filter((e) => e.clase === 'movil' || e.clase === 'tablet').map((e) => {
          const on = (p.equipos || []).indexOf(e.id) >= 0;
          return h('button', {
            key: e.id, className: 'ld-chip' + (on ? ' req' : ''),
            onClick: () => setProspecto({ equipos: on ? (p.equipos || []).filter((x) => x !== e.id) : (p.equipos || []).concat([e.id]) }),
          }, (on ? '✓ ' : '') + e.nombre);
        })),
        h('h4', null, 'Módulos de KIMOS que ya usa'),
        h('div', { className: 'ld-chips' }, ['productlab', 'productos', 'tienda', 'vitrina', 'prospeccion', 'pedidos', 'gantt', 'kanban', 'archivos'].map((a) => {
          const on = (p.appsKimos || []).indexOf(a) >= 0;
          return h('button', {
            key: a, className: 'ld-chip' + (on ? ' req' : ''),
            onClick: () => setProspecto({ appsKimos: on ? (p.appsKimos || []).filter((x) => x !== a) : (p.appsKimos || []).concat([a]) }),
          }, (on ? '✓ ' : '') + a);
        }))));

    if (ficha.error) {
      return h('div', null, formulario,
        card('Sin rubro no hay ficha', h('div', null,
          h('p', null, ficha.error),
          h('h4', null, 'Lo que ya se puede decir'),
          h('ul', { className: 'ld-lista' }, ficha.calificacion.motivos.map((m, i) => h('li', { key: i }, m.signo + ' ' + m.texto))))));
    }

    const lista = (titulo, items, nota) => items.length ? h('div', { className: 'ld-gap' },
      h('h4', null, titulo),
      h('ul', { className: 'ld-lista' }, items.map((i) => h('li', { key: i.id },
        h('b', null, i.icon + ' ' + i.nombre), ' — ', i.para,
        i.precioMensual ? h('span', { className: 'ld-mini' }, ' · ' + usd(i.precioMensual) + '/mes ' + (i.modelo === 'por-usuario' ? 'por usuario' : 'por cuenta')) : null))),
      nota ? h('p', { className: 'ld-mini' }, nota) : null) : null;

    return h('div', null,
      formulario,
      card('Calificación: ' + ficha.calificacion.puntaje + '/100 · ' + ficha.calificacion.nivel,
        h('div', null,
          h('ul', { className: 'ld-lista' }, ficha.calificacion.motivos.map((m, i) =>
            h('li', { key: i }, h('b', null, m.signo + ' '), m.texto))),
          h('h4', null, 'Siguiente paso'),
          h('p', null, ficha.siguientePaso))),

      card('Qué ofrecerle',
        h('div', null,
          lista('Se puede vender hoy', ficha.venderHoy),
          lista('Con límites que hay que decir', ficha.venderConLimites, 'Estos funcionan con menos precisión: se ofrecen diciéndolo.'),
          lista('Requiere sumar equipo', ficha.requiereEquipo,
            ficha.equiposSugeridos.length ? 'Equipos que lo resuelven: ' + ficha.equiposSugeridos.map((e) => e.nombre).join(', ') : null),
          h('div', { className: 'ld-kpis' },
            kpi('Propuesta', usd(ficha.economia.costoMensual) + '/mes', 'solo lo vendible hoy'),
            kpi('Beneficio estimado', usd(ficha.economia.beneficioMensual) + '/mes', 'para el cliente'),
            kpi('Múltiplo de valor', ficha.economia.multiplo.toFixed(1) + '×', 'por cada dólar que paga'),
            kpi('Al año', usd(ficha.economia.beneficioAnual), 'beneficio estimado')),
          h('p', { className: 'ld-hint' }, ficha.economia.advertencia),
          ficha.economia.supuesto ? h('p', { className: 'ld-mini' }, 'Supuesto del rubro: ' + ficha.economia.supuesto + (ficha.economia.formula ? ' · fórmula: ' + ficha.economia.formula : '')) : null)),

      card('La visita, paso a paso',
        h('div', null,
          h('div', { className: 'ld-cols' },
            h('div', null,
              h('h4', null, 'Guion'),
              h('ul', { className: 'ld-lista' }, guionVisita(rubro, ficha).map((g, i) =>
                h('li', { key: i }, h('b', null, g.momento + ': '), g.hacer)))),
            h('div', null,
              h('h4', null, 'Preguntas de descubrimiento'),
              h('ul', { className: 'ld-lista ld-mini' }, ficha.preguntas.map((q, i) => h('li', { key: i }, q))),
              h('h4', null, 'Objeciones que van a aparecer'),
              h('ul', { className: 'ld-lista ld-mini' }, ficha.objeciones.map((o, i) =>
                h('li', { key: i }, h('b', null, o.objecion), ' → ', o.respuesta))))),
          ficha.advertencias.length ? h('div', null,
            h('h4', null, 'No prometer'),
            h('ul', { className: 'ld-lista ld-mini' }, ficha.advertencias.map((a, i) => h('li', { key: i }, a)))) : null)),

      card('Lo que queda en la oportunidad del CRM',
        h('div', null,
          h('p', { className: 'ld-mini' }, 'Registro plano para adjuntar a Prospección Comercial: se lee sin abrir LiDARia.'),
          h('pre', { className: 'ld-pre' }, JSON.stringify(registroParaCRM(ficha), null, 2)),
          h('button', {
            className: 'ld-btn',
            onClick: () => {
              const txt = JSON.stringify(registroParaCRM(ficha), null, 2);
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
                if (shell && shell.notify) shell.notify({ level: 'success', text: 'Registro copiado' });
              } catch (e) { /* sin portapapeles */ }
            },
          }, 'Copiar registro'))));
  }

  /* ------------------------------- ecosistema ------------------------------- */

  function vistaEcosistema() {
    const r = resumen(DATOS.integraciones);
    const ruta = rutaDeConexion(DATOS.integraciones);
    const cp = DATOS.integraciones.contratoPlataforma;

    const claseVer = (v) => (v === 'ancla' ? 'ld-ok' : v === 'util' ? '' : v === 'marginal' ? 'ld-cond' : 'ld-no');

    return h('div', null,
      card('🔗 Con qué se conecta, de verdad',
        h('div', null,
          h('p', null, 'La lista separa lo que se puede construir ', h('b', null, 'hoy'),
            ' con el contrato AppShell v1 de lo que necesita que la plataforma crezca. Y marca lo marginal y lo descartado: una lista donde todo es verde no informa, tranquiliza.'),
          h('div', { className: 'ld-kpis' },
            kpi('Apps evaluadas', r.total),
            kpi('Anclas', r.porVeredicto.ancla || 0, r.esfuerzoAnclas + ' semanas en total'),
            kpi('Conectables hoy', r.disponiblesHoy, 'sin cambios de plataforma'),
            kpi('Descartadas', (r.porVeredicto.marginal || 0) + (r.porVeredicto.no || 0), 'no se construyen')))),

      card('Cómo viaja el dato entre apps (lo que permite la plataforma)',
        h('div', null,
          h('h4', null, 'Lectura'), h('p', { className: 'ld-mini' }, cp.lectura),
          h('h4', null, 'Escritura'), h('p', { className: 'ld-mini' }, cp.escritura),
          h('h4', null, 'Público'), h('p', { className: 'ld-mini' }, cp.publico))),

      ruta.map((t) => card('Tramo ' + t.tramo + ' · ' + t.titulo,
        h('div', null,
          h('p', { className: 'ld-mini' }, t.criterio),
          h('ul', { className: 'ld-lista' }, t.items.map((i) => h('li', { key: i.app },
            h('b', null, i.icon + ' ' + i.nombre),
            h('span', { className: 'ld-mini' }, ' · valor ' + i.valor + '/5 · ' + i.esfuerzoSemanas + ' sem · ' + i.disponibilidad),
            h('div', { className: 'ld-mini' }, i.porque))))),
        { key: 't' + t.tramo })),

      card('Catálogo completo', tabla([
        { k: 'app', l: 'App', cell: (i) => h('div', null, h('b', null, i.icon + ' ' + i.nombre), h('div', { className: 'ld-mini' }, i.direccion)) },
        { k: 'que', l: 'Qué viaja', cell: (i) => h('span', { className: 'ld-mini' }, i.queViaja) },
        { k: 'contrato', l: 'Cómo', cell: (i) => h('span', { className: 'ld-mini' }, i.contrato) },
        { k: 'disp', l: 'Disponible', cell: (i) => i.disponibilidad },
        { k: 'val', l: 'Valor', num: true, cell: (i) => i.valor + '/5' },
        { k: 'esf', l: 'Esfuerzo', num: true, cell: (i) => (i.esfuerzoSemanas ? i.esfuerzoSemanas + ' sem' : '—') },
        { k: 'ver', l: 'Veredicto', cell: (i) => h('span', { className: claseVer(i.veredicto) }, i.veredicto) },
      ], ordenadas(DATOS.integraciones), { key: (i) => i.app })));
  }


  /* --------------------------------- visión --------------------------------- */

  function setVision(patch) {
    commit({ vision: Object.assign({}, estado.vision, patch) });
  }

  function vistaVision() {
    const V = DATOS.vision;
    const v = estado.vision || {};
    const rubro = v.rubro || 'construccion';
    const fuenteId = v.fuente || 'totem';
    const distancia = v.distanciaM || 3;

    const plan = planSupervision(V, { rubro: rubro, fuente: fuenteId, distanciaM: distancia });
    const conReglas = V.reglasPorRubro.map((r) => r.rubro);

    const filaAlcance = (e) => h('tr', { key: e.id },
      h('td', null, h('b', null, e.icon + ' ' + e.nombre), h('div', { className: 'ld-mini' }, 'necesita ' + e.pxMinimos + ' px de alto')),
      V.fuentes.map((f) => {
        const d = distanciaMaxima(e, f);
        return h('td', { key: f.id, className: 'ld-num' },
          h('span', { className: d >= 5 ? 'ld-ok' : (d >= 2.5 ? 'ld-cond' : 'ld-no') }, d.toFixed(1) + ' m'));
      }));

    const controles = h('div', { className: 'ld-campos' },
      h('label', { className: 'ld-campo' }, h('span', null, 'Rubro'),
        h('select', { value: rubro, onChange: (e) => setVision({ rubro: e.target.value }) },
          conReglas.map((id) => {
            const r = DATOS.rubros.rubros.filter((x) => x.id === id)[0];
            return h('option', { key: id, value: id }, r ? (r.icon || '') + ' ' + r.nombre : id);
          }))),
      h('label', { className: 'ld-campo' }, h('span', null, 'Cámara'),
        h('select', { value: fuenteId, onChange: (e) => setVision({ fuente: e.target.value }) },
          V.fuentes.map((f) => h('option', { key: f.id, value: f.id }, f.nombre)))),
      h('label', { className: 'ld-campo' }, h('span', null, 'Distancia a la persona (m)'),
        h('input', {
          type: 'number', min: 0.5, max: 40, step: 0.5, value: distancia,
          onChange: (e) => setVision({ distanciaM: Math.max(0.5, Number(e.target.value) || 1) }),
        }),
        h('small', null, 'Es el dato que decide todo: a 2,5 m se ve casi todo; a 12 m, casi nada.')));

    const veredicto = plan.error ? null : h('div', null,
      h('div', { className: 'ld-kpis' },
        kpi('Se puede vigilar', plan.vigilables.length + ' de ' + plan.items.length, 'implementos del rubro'),
        kpi('Fuera de alcance', plan.fueraDeAlcance.length, 'salen como "no evaluable"'),
        kpi('Obligatorios cubiertos', plan.cubreObligatorios ? 'sí' : 'no', plan.cubreObligatorios ? '' : 'hay que acercar la cámara'),
        kpi('Latencia', plan.fuente.latenciaMs == null ? 'no aplica' : (plan.fuente.latenciaMs / 1000).toFixed(1) + ' s', plan.fuente.latenciaMs > 1000 ? 'no sirve para detener a nadie' : 'sirve para avisar en el acto')),
      h('ul', { className: 'ld-lista' }, plan.acciones.map((a, i) => h('li', { key: i }, a))),
      tabla([
        { k: 'epp', l: 'Implemento', cell: (i) => h('div', null, h('b', null, i.icon + ' ' + i.nombre), h('div', { className: 'ld-mini' }, i.nota)) },
        { k: 'exig', l: 'Exigencia', cell: (i) => i.exigido },
        { k: 'max', l: 'Alcance', num: true, cell: (i) => i.distanciaMaxM.toFixed(1) + ' m' },
        { k: 'px', l: 'Px aquí', num: true, cell: (i) => Math.round(i.pxAqui) + ' / ' + i.pxMinimos },
        { k: 'ver', l: 'A esta distancia', cell: (i) => h('span', { className: i.vigilable ? 'ld-ok' : 'ld-no' }, i.vigilable ? 'se vigila' : 'no evaluable') },
      ], plan.items, { key: (i) => i.id }),
      plan.notaRegla ? h('p', { className: 'ld-hint' }, plan.notaRegla) : null);

    const usables = modelosViables(V, {});
    const fuera = modelosDescartados(V);

    return h('div', null,
      card('👁️ Qué se puede reconocer, y a qué distancia',
        h('div', null,
          h('p', null, 'La pregunta "¿detecta si lleva guantes?" no tiene respuesta sí o no: tiene geometría. Un objeto de altura ',
            h('b', null, 'H'), ' a distancia ', h('b', null, 'd'), ' ocupa ', h('b', null, 'H·R / (2·d·tan(F/2))'),
            ' píxeles. Si no llegan al mínimo del detector, no hay modelo que lo arregle.'),
          h('p', { className: 'ld-hint' }, 'Regla que hace confiable el módulo: lo que queda fuera de alcance se informa como "no evaluable", nunca como incumplimiento.'),
          controles)),
      card('Con esta cámara, a esta distancia', veredicto || h('p', null, plan.error)),
      card('Alcance por implemento y por cámara',
        h('div', { className: 'ld-tbl-wrap' },
          h('table', { className: 'ld-tbl' },
            h('thead', null, h('tr', null,
              h('th', null, 'Implemento'),
              V.fuentes.map((f) => h('th', { key: f.id, className: 'ld-num', title: f.nota }, f.nombre.split('(')[0])))),
            h('tbody', null, V.epp.map(filaAlcance)))),
        { hint: 'Distancia máxima a la que cada prenda sigue siendo reconocible. Verde: cómodo. Ámbar: solo de cerca. Rojo: hay que estar encima.' }),
      card('Modelos que pueden entrar al producto',
        h('div', null,
          tabla([
            { k: 'm', l: 'Modelo', cell: (m) => h('div', null, h('b', null, m.nombre), h('div', { className: 'ld-mini' }, m.nota)) },
            { k: 'l', l: 'Licencia', cell: (m) => h('span', { className: 'ld-ok' }, m.licencia) },
            { k: 'd', l: 'Dónde corre', cell: (m) => (m.dondeCorre || []).join(', ') },
            { k: 'f', l: 'fps móvil', num: true, cell: (m) => (m.fpsMovil ? m.fpsMovil : '—') },
            { k: 'fs', l: 'fps servidor', num: true, cell: (m) => (m.fpsServidor ? m.fpsServidor : '—') },
          ], usables, { key: (m) => m.id }),
          h('h4', null, 'Descartados por licencia'),
          h('ul', { className: 'ld-lista' }, fuera.map((m) => h('li', { key: m.id },
            h('b', null, m.nombre), ' — ', h('span', { className: 'ld-no' }, m.licencia), '. ', m.nota))))),
      card('Dos líneas que este producto no cruza',
        h('ul', { className: 'ld-lista' },
          h('li', null, h('b', null, 'Temperatura de personas: no. '),
            'Ninguna cámara RGB mide temperatura, y los sistemas térmicos para medir temperatura corporal son dispositivos regulados. El módulo térmico mide equipos y procesos.'),
          h('li', null, h('b', null, 'Identidad: no. '),
            'Se detecta y se sigue a una persona dentro de la escena, con un identificador que dura lo que dura el vídeo. Reconocimiento facial no, y ligar un incumplimiento a un trabajador concreto exige el trámite legal hecho.'))));
  }


  /* --------------------------- manual de uso --------------------------- */

  function seccionesManual() {
    const M = DATOS.manual;
    const d = estado.diag;
    const capsActivas = new Set((d && d.capacidades ? d.capacidades : []).map((c) => c.id));
    // El manual se ordena por lo que este equipo puede hacer: lo aplicable
    // primero, y lo que exige otro equipo o un accesorio, después.
    return M.secciones.map((s) => {
      const faltan = (s.requiereCaps || []).filter((c) => !capsActivas.has(c));
      return Object.assign({}, s, { aplicable: faltan.length === 0, faltan: faltan });
    }).sort((a, b) => (a.aplicable === b.aplicable ? 0 : (a.aplicable ? -1 : 1)));
  }

  function vistaManual() {
    const M = DATOS.manual;
    const abierta = estado.manualSel;
    const nombreAcc = (id) => {
      const a = accesorioPorId(DATOS.accesorios, id);
      return a ? a.icon + ' ' + a.nombre : id;
    };

    const ficha = (s) => h('article', {
      key: s.id,
      className: 'ld-mod' + (abierta === s.id ? ' on' : '') + (s.aplicable ? '' : ' ld-b-visor'),
      onClick: () => commit({ manualSel: abierta === s.id ? null : s.id }),
    },
      h('header', null,
        h('span', { className: 'ld-mod-ico' }, s.icon),
        h('div', null,
          h('h3', null, s.titulo),
          h('p', { className: 'ld-mini' }, s.para === 'campo' ? 'En el equipo de terreno'
            : s.para === 'consola' ? 'En la consola' : 'En cualquiera de los dos')),
        h('span', { className: 'ld-est' }, s.aplicable ? '' : '⚠')),
      h('p', { className: 'ld-mini' }, s.cuando),
      abierta === s.id ? h('div', null,
        h('h4', null, 'Paso a paso'),
        h('ol', { className: 'ld-lista' }, s.pasos.map((p, i) => h('li', { key: i },
          p.hacer,
          p.ojo ? h('div', { className: 'ld-mini' }, '👉 ' + p.ojo) : null))),
        s.siNoPuedes ? h('div', { className: 'ld-acc' },
          h('b', null, 'Si tu equipo no puede: '), s.siNoPuedes.porque, ' ',
          (s.siNoPuedes.conecta || []).length
            ? h('span', null, 'Conecta ', h('b', null, s.siNoPuedes.conecta.map(nombreAcc).join(' o ')), '. ')
            : null,
          s.siNoPuedes.otraVia) : null,
        (s.legal || []).length ? h('div', null,
          h('h4', null, '⚖️ Antes de encender'),
          h('ul', { className: 'ld-lista ld-mini' }, s.legal.map((l, i) => h('li', { key: i }, l)))) : null,
        (s.errores || []).length ? h('div', null,
          h('h4', null, 'Cuando algo falla'),
          tabla([
            { k: 's', l: 'Síntoma', cell: (e) => e.sintoma },
            { k: 'c', l: 'Causa probable', cell: (e) => h('span', { className: 'ld-mini' }, e.causa) },
            { k: 'q', l: 'Qué hacer', cell: (e) => e.solucion },
          ], s.errores, { key: (e, i) => i })) : null) : null);

    return h('div', null,
      card('📖 Manual de uso',
        h('div', null,
          h('p', null, 'Las mismas instrucciones que salen en la documentación, ordenadas por lo que ',
            h('b', null, 'este'), ' equipo puede hacer. Haz clic en una sección para abrirla.'),
          h('ul', { className: 'ld-lista' }, M.antesDeEmpezar.map((t, i) => h('li', { key: i }, t))))),
      h('div', { className: 'ld-grid' }, seccionesManual().map(ficha)),
      card('🔌 Accesorios compatibles',
        h('div', null,
          h('p', { className: 'ld-hint' }, 'Cuando el equipo no da, esto es lo que se conecta. La columna que importa es dónde funciona la conexión: en iOS el navegador no expone Bluetooth ni USB, igual que pasa con el LiDAR.'),
          tabla([
            { k: 'a', l: 'Accesorio', cell: (a) => h('div', null, h('b', null, a.icon + ' ' + a.nombre), h('div', { className: 'ld-mini' }, a.nota)) },
            { k: 'c', l: 'Conexión', cell: (a) => (DATOS.accesorios.conexiones[a.conexion] || {}).nombre },
            { k: 'and', l: 'Android', cell: (a) => vía(a.id, 'android') },
            { k: 'ios', l: 'iOS', cell: (a) => vía(a.id, 'ios') },
            { k: 'p', l: 'Costo', cell: (a) => h('span', { className: 'ld-mini' }, a.costoAprox) },
            { k: 'h', l: 'Habilita', cell: (a) => h('span', { className: 'ld-mini' }, (a.habilita || []).join(', ') || '—') },
          ], DATOS.accesorios.accesorios, { key: (a) => a.id }))));
  }

  function vía(accesorioId, plataforma) {
    const s = soportePlataforma(DATOS.accesorios, accesorioId, plataforma);
    if (!s) return '—';
    const clase = s.via === 'web' ? 'ld-ok' : s.via === 'no' ? 'ld-no' : 'ld-cond';
    const texto = s.via === 'web' ? 'navegador' : s.via === 'nativo' ? 'app nativa' : s.via === 'servidor' ? 'servidor' : 'no';
    return h('span', { className: clase, title: s.texto }, texto);
  }

  /* ------------------------ extensiones y expediente ------------------------ */

  function ctxExtensiones() {
    const d = estado.diag;
    const caps = new Set((d && d.capacidades ? d.capacidades : []).map((c) => c.id));
    // La consola corre en el escritorio: para juzgar una capacidad de terreno
    // valen las capacidades del parque, no las de este computador.
    for (const item of estado.inventario) {
      const f = filaMatriz(item.equipo);
      const m = (f && f.nativo) || (f && f.web);
      if (m && m.modulos) { caps.add('api.vision.ondevice'); caps.add('media.camera'); }
      const e = equipoPorId(item.equipo);
      (e ? e.caps : []).forEach((c) => caps.add(c));
    }
    return {
      caps: caps,
      accesorios: new Set(estado.accesorios || []),
      expediente: estado.expediente || {},
      accesoriosCatalogo: DATOS.accesorios,
      legalCatalogo: DATOS.legal,
    };
  }

  function marcarObligacion(id, hecho) {
    const exp = Object.assign({}, estado.expediente || {});
    if (hecho) exp[id] = { hecho: true, por: estado.responsable || null, fecha: new Date().toISOString().slice(0, 10) };
    else delete exp[id];
    commit({ expediente: exp });
  }

  function toggleAccesorio(id) {
    const lista = (estado.accesorios || []).slice();
    const i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1); else lista.push(id);
    commit({ accesorios: lista });
  }

  function vistaExtensiones() {
    const ctx = ctxExtensiones();
    const lista = extensionesDisponibles(DATOS.capacidadesFuturas, ctx);
    const res = resumenExtensiones(DATOS.capacidadesFuturas, ctx);
    const dias = diasParaVigencia(DATOS.legal, null);

    const nivelesConChecklist = ['datos-personales', 'alto-riesgo', 'sensibles'];
    const nivel = estado.nivelLegal || 'sensibles';
    const exp = evaluarExpediente(DATOS.legal, nivel, estado.expediente || {});

    const expedienteUI = card('⚖️ Expediente de cumplimiento · ' + DATOS.legal.marco.nombre,
      h('div', null,
        h('p', null, DATOS.legal.marco.resumen),
        h('div', { className: 'ld-kpis' },
          kpi('Vigencia', DATOS.legal.marco.vigencia, dias > 0 ? 'faltan ' + dias + ' días' : 'ya rige'),
          kpi('Expediente', exp.porcentaje + '%', exp.hechos + ' de ' + exp.total + ' respondidas'),
          kpi('Bloqueantes pendientes', exp.bloqueantes.length, exp.puedeActivarse ? 'se puede encender' : 'no se enciende nada sensible'),
          kpi('Sanción máxima', '20.000 UTM', 'y hasta 4% de ingresos por reincidencia')),
        h('div', { className: 'ld-fila' },
          h('label', { className: 'ld-campo' }, h('span', null, 'Responsable que firma'),
            h('input', { type: 'text', value: estado.responsable || '', placeholder: 'Nombre y cargo',
              onChange: (e) => commit({ responsable: e.target.value.slice(0, 80) }) })),
          h('label', { className: 'ld-campo' }, h('span', null, 'Nivel del tratamiento'),
            h('select', { value: nivel, onChange: (e) => commit({ nivelLegal: e.target.value }) },
              nivelesConChecklist.map((n) => h('option', { key: n, value: n },
                (DATOS.legal.clasificacion[n] || {}).label || n))))),
        tabla([
          { k: 'ok', l: '', cell: (i) => h('input', {
              type: 'checkbox', checked: i.hecho,
              onChange: (e) => marcarObligacion(i.id, e.target.checked),
            }) },
          { k: 'p', l: 'Obligación', cell: (i) => h('div', null,
              h('b', null, i.pregunta),
              h('div', { className: 'ld-mini' }, i.comoSeCumple)) },
          { k: 'b', l: 'Bloquea', cell: (i) => h('span', { className: i.bloqueante ? 'ld-no' : 'ld-mini' }, i.bloqueante ? 'sí' : 'no') },
          { k: 'q', l: 'Firmada por', cell: (i) => h('span', { className: 'ld-mini' }, i.hecho ? ((i.por || 'sin responsable') + ' · ' + (i.fecha || '')) : '—') },
        ], exp.items, { key: (i) => i.id }),
        h('p', { className: 'ld-hint' }, 'Esto no es asesoría legal: es la lista de lo que hay que tener hecho. El texto de la ley manda.')));

    const fichaCap = (c) => h('article', { key: c.id, className: 'ld-mod ld-b-' + (c.estado === 'lista' ? 'completo' : c.estado === 'no-ofrecida' ? 'no-disponible' : 'potencial') },
      h('header', null,
        h('span', { className: 'ld-mod-ico' }, c.icon),
        h('div', null,
          h('h3', null, c.nombre),
          h('p', { className: 'ld-mini' }, c.categoria + ' · ' + c.madurez
            + (c.datoSensible ? ' · dato sensible' : '') + (c.esfuerzoSemanas ? ' · ' + c.esfuerzoSemanas + ' sem' : ''))),
        h('span', { className: 'ld-est' }, c.estadoIcon + ' ' + c.estadoLabel)),
      c.recomendada ? h('div', { className: 'ld-chips' }, chip('recomendada', 'req')) : null,
      c.activacionControlada ? h('div', { className: 'ld-chips' }, chip('activación controlada', 'ld-t-justo')) : null,
      h('ul', { className: 'ld-lista ld-mini' }, c.acciones.map((a, i) => h('li', { key: i }, a))),
      c.honestidad ? h('p', { className: 'ld-mini' }, '⚠ ' + c.honestidad) : null);

    return h('div', null,
      card('🧩 Lo que la app puede llegar a hacer',
        h('div', null,
          h('p', null, 'Sumar una capacidad es datos más un detector, nunca un rediseño. Cada una declara qué le falta en tres planos: el equipo, el accesorio y el trámite legal. El tercero es el que suele faltar, y el único que el software puede hacer cumplir.'),
          h('div', { className: 'ld-kpis' },
            kpi('Capacidades', res.total, 'en el catálogo'),
            kpi('Listas para encender', res.porEstado.lista || 0),
            kpi('Con dato sensible', res.sensibles, res.controladas + ' con activación controlada'),
            kpi('Por construir', res.esfuerzoPendienteSemanas + ' sem', 'de las que ya son viables')))),
      expedienteUI,
      card('🔌 Accesorios conectados',
        h('div', null,
          h('p', { className: 'ld-hint' }, 'Marca lo que la organización ya tiene: las capacidades de arriba se recalculan al instante.'),
          h('div', { className: 'ld-chips' }, DATOS.accesorios.accesorios.map((a) => {
            const on = (estado.accesorios || []).indexOf(a.id) >= 0;
            return h('button', { key: a.id, className: 'ld-chip' + (on ? ' req' : ''), onClick: () => toggleAccesorio(a.id) },
              (on ? '✓ ' : '') + a.icon + ' ' + a.nombre);
          })))),
      h('div', { className: 'ld-grid' }, lista.map(fichaCap)));
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

    const cuerpo = st.tab === 'rubros' ? vistaRubros(cob)
      : st.tab === 'prospeccion' ? vistaProspeccion(cob)
      : st.tab === 'vision' ? vistaVision()
      : st.tab === 'extensiones' ? vistaExtensiones()
      : st.tab === 'manual' ? vistaManual()
      : st.tab === 'ecosistema' ? vistaEcosistema()
      : st.tab === 'modulos' ? vistaModulos(cob)
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
      description: 'Consola de captura 3D y supervisión por cámara: qué puede escanear y reconocer cada equipo, qué implementos de protección se pueden vigilar con cada cámara y a qué distancia (geometría, no estimación), qué módulos cubre el parque de la organización, qué significa para cada rubro, cómo se prepara la visita a un prospecto, con qué apps de KIMOS se conecta de verdad y qué modelos y bibliotecas pueden entrar al producto sin problema legal.',
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
          name: 'SET_RUBRO',
          description: 'Elige el rubro sobre el que trabajar y abre su plan: tolerancia exigida, módulos en orden, flujo, KPI y qué falta para poder ejecutarlo con el inventario actual.',
          inputSchema: { type: 'object', properties: { rubro: { type: 'string' } }, required: ['rubro'] },
        },
        {
          name: 'FICHA_PROSPECTO',
          description: 'Arma la ficha de un prospecto: califica con su rubro, su parque de equipos y las apps de KIMOS que ya usa, y devuelve qué se le puede vender hoy, con qué argumento y qué demostrar en la visita. Los equipos van con los ids del catálogo.',
          inputSchema: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              rubro: { type: 'string' },
              usuariosCampo: { type: 'number' },
              equipos: { type: 'array', items: { type: 'string' } },
              appsKimos: { type: 'array', items: { type: 'string' } },
            },
            required: ['rubro'],
          },
        },
        {
          name: 'PLAN_VISION',
          description: 'Dice qué implementos de protección se pueden vigilar con una cámara concreta a una distancia concreta, para un rubro. Fuentes: ' + DATOS.vision.fuentes.map((f) => f.id).join(', ') + '.',
          inputSchema: {
            type: 'object',
            properties: {
              rubro: { type: 'string' },
              fuente: { type: 'string', enum: DATOS.vision.fuentes.map((f) => f.id) },
              distanciaM: { type: 'number' },
            },
            required: ['rubro', 'fuente'],
          },
        },
        {
          name: 'VER_ALCANCE',
          description: 'Distancia máxima a la que cada implemento de protección sigue siendo reconocible con una cámara dada. Es geometría, no estimación.',
          inputSchema: {
            type: 'object',
            properties: { fuente: { type: 'string', enum: DATOS.vision.fuentes.map((f) => f.id) } },
            required: ['fuente'],
          },
        },
        {
          name: 'VER_CAPACIDAD',
          description: 'Estado de una capacidad futura (reconocimiento facial, fatiga, temperatura, arnés enganchado…): qué le falta del equipo, qué accesorio la habilita y qué trámite legal exige antes de encenderse.',
          inputSchema: {
            type: 'object',
            properties: { capacidad: { type: 'string', enum: DATOS.capacidadesFuturas.capacidades.map((c) => c.id) } },
            required: ['capacidad'],
          },
        },
        {
          name: 'MARCAR_OBLIGACION',
          description: 'Marca una obligación del expediente de cumplimiento como cumplida, dejando constancia de quién y cuándo. Es lo que habilita las capacidades con dato sensible.',
          inputSchema: {
            type: 'object',
            properties: {
              obligacion: { type: 'string', enum: DATOS.legal.checklist.map((i) => i.id) },
              responsable: { type: 'string' },
              hecho: { type: 'boolean' },
            },
            required: ['obligacion'],
          },
        },
        {
          name: 'VER_MANUAL',
          description: 'Devuelve el paso a paso de una sección del manual: cómo usar una función o cómo conectar un accesorio.',
          inputSchema: {
            type: 'object',
            properties: { seccion: { type: 'string', enum: DATOS.manual.secciones.map((s) => s.id) } },
            required: ['seccion'],
          },
        },
        {
          name: 'VER_INTEGRACION',
          description: 'Explica la vinculación con una app del ecosistema KIMOS: qué dato viaja, por qué contrato, si se puede hacer hoy y si vale la pena construirla.',
          inputSchema: { type: 'object', properties: { app: { type: 'string' } }, required: ['app'] },
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
          rubros: (function () {
            const carga = rubrosActivos();
            const ctx = ctxRubro(cob);
            return rubrosViables(carga.rubros, ctx).map((x) => ({
              id: x.plan.rubro.id,
              nombre: x.plan.rubro.nombre,
              origen: x.plan.rubro.origen,
              viabilidad: x.puntaje,
              toleranciaCumple: x.plan.tolerancia.cumple,
              toleranciaMargen: x.plan.tolerancia.margen || null,
              modulosListos: x.listos + '/' + x.total,
            }));
          })(),
          packsCargados: (estado.packs || []).map((p) => ({ id: p.id, nombre: p.nombre, version: p.version, rubros: (p.rubros || []).length })),
          prospecto: estado.prospecto && estado.prospecto.rubro ? registroParaCRM(fichaActual(cob).ficha) : null,
          vision: (function () {
            const v = estado.vision || {};
            const plan = planSupervision(DATOS.vision, { rubro: v.rubro, fuente: v.fuente, distanciaM: v.distanciaM });
            return {
              seleccion: { rubro: v.rubro, fuente: v.fuente, distanciaM: v.distanciaM },
              cubreObligatorios: plan.error ? null : plan.cubreObligatorios,
              vigilables: plan.error ? [] : plan.vigilables,
              noEvaluables: plan.error ? [] : plan.fueraDeAlcance,
              fuentes: DATOS.vision.fuentes.map((f) => ({ id: f.id, resolucionV: f.resolucionV, latenciaMs: f.latenciaMs, veredicto: f.veredicto })),
              modelosDescartados: modelosDescartados(DATOS.vision).map((m) => m.nombre + ' (' + m.licencia + ')'),
              alcanceCasco: DATOS.vision.fuentes.reduce((a, f) => {
                a[f.id] = Number(distanciaMaxima(eppPorId(DATOS.vision, 'casco'), f).toFixed(1));
                return a;
              }, {}),
            };
          })(),
          extensiones: (function () {
            const ctx = ctxExtensiones();
            const res = resumenExtensiones(DATOS.capacidadesFuturas, ctx);
            const exp = evaluarExpediente(DATOS.legal, estado.nivelLegal || 'sensibles', estado.expediente || {});
            return {
              resumen: res,
              expediente: {
                nivel: exp.nivel, porcentaje: exp.porcentaje,
                puedeActivarSensibles: exp.puedeActivarse, bloqueantes: exp.bloqueantes,
                responsable: estado.responsable || null,
                marco: DATOS.legal.marco.nombre, vigencia: DATOS.legal.marco.vigencia,
              },
              accesoriosConectados: estado.accesorios || [],
              capacidades: extensionesDisponibles(DATOS.capacidadesFuturas, ctx)
                .map((c) => ({ id: c.id, estado: c.estado, sensible: c.datoSensible, controlada: c.activacionControlada })),
            };
          })(),
          manual: DATOS.manual.secciones.map((s) => ({ id: s.id, titulo: s.titulo, cuando: s.cuando })),
          ecosistema: (function () {
            const r = resumen(DATOS.integraciones);
            return {
              anclas: ordenadas(DATOS.integraciones).filter((i) => i.veredicto === 'ancla').map((i) => i.app),
              descartadas: DATOS.integraciones.integraciones.filter((i) => i.veredicto === 'no' || i.veredicto === 'marginal').map((i) => i.app),
              conectablesHoy: r.disponiblesHoy,
              esfuerzoAnclasSemanas: r.esfuerzoAnclas,
            };
          })(),
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
          if (t === 'SET_RUBRO') {
            const carga = rubrosActivos();
            const r = carga.rubros.filter((x) => x.id === p.rubro)[0];
            if (!r) return { success: false, error: 'Rubro desconocido: ' + p.rubro + '. Disponibles: ' + carga.rubros.map((x) => x.id).join(', ') };
            const plan = planDeRubro(r, ctxRubro(cobertura(estado.inventario)));
            commit({ tab: 'rubros', rubroSel: r.id });
            return {
              success: true,
              message: r.nombre + ': ' + plan.tolerancia.motivo + ' Módulos en orden: '
                + plan.modulos.map((m) => m.nombre + ' (' + m.estado + ')').join(', ')
                + '. ' + plan.acciones.join(' '),
            };
          }
          if (t === 'FICHA_PROSPECTO') {
            const carga = rubrosActivos();
            const r = carga.rubros.filter((x) => x.id === p.rubro)[0];
            if (!r) return { success: false, error: 'Rubro desconocido: ' + p.rubro };
            const equipos = Array.isArray(p.equipos) ? p.equipos.filter((e) => !!equipoPorId(e)) : [];
            const desconocidos = (p.equipos || []).filter((e) => !equipoPorId(e));
            const prospecto = {
              nombre: typeof p.nombre === 'string' ? p.nombre.slice(0, 80) : '',
              rubro: r.id,
              usuariosCampo: Math.max(0, Math.round(Number(p.usuariosCampo) || 0)),
              equipos: equipos,
              appsKimos: Array.isArray(p.appsKimos) ? p.appsKimos.filter((a) => typeof a === 'string').slice(0, 20) : [],
            };
            commit({ tab: 'prospeccion', prospecto: prospecto });
            const f = fichaActual(cobertura(estado.inventario)).ficha;
            const nombres = (lista) => lista.map((i) => i.nombre).join(', ') || 'nada';
            return {
              success: true,
              message: 'Calificación ' + f.calificacion.puntaje + '/100 (' + f.calificacion.nivel + '). '
                + 'Vender hoy: ' + nombres(f.venderHoy) + '. Requiere equipo: ' + nombres(f.requiereEquipo) + '. '
                + 'Propuesta ' + usd(f.economia.costoMensual) + '/mes contra un beneficio estimado de '
                + usd(f.economia.beneficioMensual) + '/mes. Demostración: ' + f.demo
                + (desconocidos.length ? ' (equipos ignorados por no estar en el catálogo: ' + desconocidos.join(', ') + ')' : ''),
            };
          }
          if (t === 'PLAN_VISION') {
            const plan = planSupervision(DATOS.vision, {
              rubro: p.rubro, fuente: p.fuente,
              distanciaM: Number(p.distanciaM) > 0 ? Number(p.distanciaM) : 3,
            });
            if (plan.error) return { success: false, error: plan.error };
            commit({ tab: 'vision', vision: { rubro: p.rubro, fuente: p.fuente, distanciaM: plan.distanciaM } });
            const nombres = (ids) => ids.map((id) => (plan.items.filter((i) => i.id === id)[0] || {}).nombre).join(', ') || 'nada';
            return {
              success: true,
              message: plan.fuente.nombre + ' a ' + plan.distanciaM + ' m en ' + p.rubro + ': se vigila ' + nombres(plan.vigilables)
                + '. Fuera de alcance (no evaluable): ' + nombres(plan.fueraDeAlcance) + '. ' + plan.acciones.join(' '),
            };
          }
          if (t === 'VER_ALCANCE') {
            const a = alcanceDeFuente(DATOS.vision, p.fuente);
            if (!a) return { success: false, error: 'Fuente desconocida: ' + p.fuente };
            commit({ tab: 'vision', vision: Object.assign({}, estado.vision, { fuente: p.fuente }) });
            return {
              success: true,
              message: a.fuente.nombre + ' (' + a.fuente.resolucionV + 'p): '
                + a.items.map((i) => i.nombre.toLowerCase() + ' ' + i.distanciaMaxM.toFixed(1) + ' m').join(', ') + '.',
            };
          }
          if (t === 'VER_CAPACIDAD') {
            const cap = capacidadPorId(DATOS.capacidadesFuturas, p.capacidad);
            if (!cap) return { success: false, error: 'Capacidad desconocida: ' + p.capacidad };
            const e = estadoDeCapacidad(cap, ctxExtensiones());
            commit({ tab: 'extensiones' });
            return {
              success: true,
              message: cap.nombre + ' → ' + e.estadoLabel + '. ' + e.acciones.join(' ')
                + (cap.activacionControlada ? ' Activación controlada: no se enciende sin expediente y responsable.' : ''),
            };
          }
          if (t === 'MARCAR_OBLIGACION') {
            const item = DATOS.legal.checklist.filter((i) => i.id === p.obligacion)[0];
            if (!item) return { success: false, error: 'Obligación desconocida: ' + p.obligacion };
            if (p.hecho !== false && !p.responsable && !estado.responsable) {
              return { success: false, error: 'Marcar una obligación exige el nombre del responsable: queda en el registro.' };
            }
            if (p.responsable) commit({ responsable: String(p.responsable).slice(0, 80) });
            marcarObligacion(item.id, p.hecho !== false);
            const exp = evaluarExpediente(DATOS.legal, estado.nivelLegal || 'sensibles', estado.expediente);
            commit({ tab: 'extensiones' });
            return {
              success: true,
              message: item.pregunta + ' → ' + (p.hecho === false ? 'pendiente' : 'cumplida') + '. '
                + 'Expediente al ' + exp.porcentaje + '%'
                + (exp.puedeActivarse ? '; ya se pueden encender funciones sensibles.' : '; faltan bloqueantes: ' + exp.bloqueantes.join(', ') + '.'),
            };
          }
          if (t === 'VER_MANUAL') {
            const sec = DATOS.manual.secciones.filter((x) => x.id === p.seccion)[0];
            if (!sec) return { success: false, error: 'Sección desconocida: ' + p.seccion };
            commit({ tab: 'manual', manualSel: sec.id });
            const pasos = sec.pasos.map((x, i) => (i + 1) + '. ' + x.hacer).join(' ');
            return {
              success: true,
              message: sec.titulo + ' — ' + sec.cuando + ' ' + pasos
                + (sec.siNoPuedes ? ' Si el equipo no puede: ' + sec.siNoPuedes.otraVia : '')
                + ((sec.legal || []).length ? ' Antes de encender: ' + sec.legal[0] : ''),
            };
          }
          if (t === 'VER_INTEGRACION') {
            const i = integracionDe(DATOS.integraciones, String(p.app || '').toLowerCase());
            if (!i) return { success: false, error: 'App desconocida: ' + p.app };
            commit({ tab: 'ecosistema' });
            return {
              success: true,
              message: i.nombre + ' → ' + i.direccion + '. Viaja: ' + i.queViaja + ' Contrato: ' + i.contrato
                + ' Disponible: ' + i.disponibilidad + '. Veredicto: ' + i.veredicto + ' — ' + i.porque,
            };
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
