/* kimos-LiDARia · núcleo 1.4.0 — GENERADO, no editar.
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
/**
 * Adivina qué lente es cada cámara por su etiqueta. Es heurística declarada:
 * los fabricantes no normalizan estos nombres, así que el resultado se marca
 * como inferido y la app deja corregirlo a mano.
 */
function claseDeLente(etiqueta) {
  const t = String(etiqueta || '').toLowerCase();
  if (/ultra|wide angle|0\.5|gran angular/.test(t) && !/telephoto/.test(t)) return 'ultra-ancha';
  if (/tele|zoom|2x|3x|5x/.test(t)) return 'tele';
  if (/depth|tof|lidar|profundidad/.test(t)) return 'profundidad';
  if (/front|user|frontal|selfie/.test(t)) return 'frontal';
  if (/back|rear|environment|trasera/.test(t)) return 'trasera';
  return null;
}

/**
 * Cámaras del equipo, una por una.
 *
 * Antes de conceder el permiso el navegador entrega la lista **sin etiquetas y
 * sin deviceId estable**: se sabe cuántas hay y nada más. Eso no es un fallo,
 * es la protección contra huella digital, y por eso `etiquetas` viaja en el
 * resultado: la app tiene que poder decir "concede el permiso y vuelvo a mirar"
 * en vez de afirmar que el equipo tiene una sola cámara.
 */
async function detectarCamaras(nav) {
  const md = nav && nav.mediaDevices;
  if (!md || typeof md.enumerateDevices !== 'function') {
    return { disponible: false, n: 0, etiquetas: false, lista: [], soportado: false };
  }
  try {
    const ds = await conTiempo(md.enumerateDevices(), 2500, []);
    const vid = ds.filter((d) => d.kind === 'videoinput');
    const etiquetas = vid.some((d) => !!d.label);
    return {
      soportado: true,
      disponible: vid.length > 0,
      n: vid.length,
      etiquetas,
      lista: vid.map((d, i) => ({
        deviceId: d.deviceId || '',
        groupId: d.groupId || '',
        etiqueta: d.label || ('Cámara ' + (i + 1)),
        lente: claseDeLente(d.label),
        conEtiqueta: !!d.label,
      })),
    };
  } catch (e) {
    return { disponible: false, n: 0, etiquetas: false, lista: [], soportado: true };
  }
}

/** Micrófonos y salidas de audio. Misma regla de etiquetas que las cámaras. */
async function detectarAudio(nav) {
  const md = nav && nav.mediaDevices;
  const vacio = { disponible: false, n: 0 };
  if (!md || typeof md.enumerateDevices !== 'function') {
    return { microfonos: vacio, altavoces: vacio };
  }
  try {
    const ds = await conTiempo(md.enumerateDevices(), 2500, []);
    const mic = ds.filter((d) => d.kind === 'audioinput');
    const out = ds.filter((d) => d.kind === 'audiooutput');
    return {
      microfonos: { disponible: mic.length > 0, n: mic.length, etiquetas: mic.some((d) => !!d.label) },
      // Safari no lista salidas de audio; que no aparezcan no significa que el
      // equipo no tenga altavoz, así que se declara el altavoz por otra vía.
      altavoces: { disponible: out.length > 0 || tieneAudioContext(nav), n: out.length, listadas: out.length > 0 },
    };
  } catch (e) {
    return { microfonos: vacio, altavoces: vacio };
  }
}

function tieneAudioContext(nav) {
  const G = typeof globalThis !== 'undefined' ? globalThis : {};
  return typeof G.AudioContext === 'function' || typeof G.webkitAudioContext === 'function';
}

/** Radios que el navegador expone. Ninguna de ellas existe en Safari de iOS. */
function detectarRadios(G, nav) {
  return {
    bluetooth: !!(nav && nav.bluetooth && typeof nav.bluetooth.requestDevice === 'function'),
    nfc: typeof G.NDEFReader === 'function',
    serie: !!(nav && nav.serial),
    usb: !!(nav && nav.usb),
    hid: !!(nav && nav.hid),
    // `connection` da un tipo de red estimado. NO es la señal de la antena.
    red: nav && nav.connection ? {
      tipo: nav.connection.effectiveType || null,
      bajadaMbps: nav.connection.downlink || null,
      ahorroDatos: !!nav.connection.saveData,
    } : null,
  };
}

/**
 * Motor del navegador. Importa porque casi todas las APIs de hardware que
 * faltan —Bluetooth, NFC, serie, USB, linterna— faltan exactamente en WebKit.
 */
function detectarMotor(ua, G) {
  const t = String(ua || '');
  if (/Firefox\/|FxiOS/.test(t)) return 'gecko';
  // En iOS todo navegador es WebKit por dentro, se llame Chrome o no.
  if (/iPhone|iPad|iPod/.test(t)) return 'webkit';
  if (/Chrome\/|Chromium\/|Edg\//.test(t)) return 'chromium';
  if (/Safari\//.test(t)) return 'webkit';
  return (G && G.chrome) ? 'chromium' : null;
}

/**
 * Abre una cámara y mide lo que de verdad entrega: resolución, cuadros por
 * segundo y las capacidades que el navegador quiera declarar (linterna, zoom,
 * enfoque). Es la única forma de saberlo: la ficha del fabricante no sirve y el
 * catálogo tampoco.
 *
 * Devuelve siempre; nunca lanza. Si no se pudo abrir, `ok:false` y el motivo en
 * castellano.
 */
async function probarCamara(nav, opciones) {
  const o = opciones || {};
  const md = nav && nav.mediaDevices;
  if (!md || typeof md.getUserMedia !== 'function') {
    return { ok: false, motivo: 'Este navegador no expone cámaras (getUserMedia no disponible).' };
  }
  const tam = { width: { ideal: o.ancho || 1280 }, height: { ideal: o.alto || 720 }, frameRate: { ideal: 30 } };
  const intentos = [];
  if (o.deviceId) {
    intentos.push(Object.assign({ deviceId: { exact: o.deviceId } }, tam));
    intentos.push({ deviceId: { exact: o.deviceId } });
  }
  if (o.facing) intentos.push(Object.assign({ facingMode: { ideal: o.facing } }, tam));
  intentos.push(Object.assign({}, tam));
  intentos.push(true);

  let stream = null, ultimo = null, intento = -1;
  for (let i = 0; i < intentos.length; i++) {
    try {
      stream = await conTiempo(md.getUserMedia({ video: intentos[i], audio: false }), 8000, null);
      if (stream) { intento = i; break; }
    } catch (e) {
      ultimo = e;
      const n = String((e && e.name) || '');
      // Ni el permiso ni la ausencia de cámara mejoran aflojando la petición:
      // cortar aquí evita encadenar diálogos de permiso.
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') break;
    }
  }
  if (!stream) return { ok: false, motivo: motivoDeCamara(ultimo), error: ultimo ? String(ultimo.name || '') : 'timeout' };

  const track = stream.getVideoTracks()[0] || null;
  const ajustes = track && track.getSettings ? track.getSettings() : {};
  let capacidades = null;
  try { capacidades = track && track.getCapabilities ? track.getCapabilities() : null; } catch (e) { capacidades = null; }
  try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ }

  const cap = capacidades || {};
  return {
    ok: true,
    // Si hubo que soltar la cámara pedida, el operador tiene que saberlo: está
    // mirando por una cámara distinta de la que eligió.
    cambioDeCamara: !!(o.deviceId && intento > 1),
    deviceId: ajustes.deviceId || null,
    etiqueta: (track && track.label) || null,
    ancho: ajustes.width || null,
    alto: ajustes.height || null,
    fps: ajustes.frameRate || null,
    facing: ajustes.facingMode || null,
    // El navegador NO expone el campo de visión. Se calibra o se declara.
    fovH: null,
    puede: {
      linterna: Array.isArray(cap.torch) ? cap.torch.includes(true) : !!cap.torch,
      zoom: !!cap.zoom,
      enfoque: Array.isArray(cap.focusMode) ? cap.focusMode.length > 0 : !!cap.focusMode,
      resolucionMax: cap.width && cap.height ? { ancho: cap.width.max, alto: cap.height.max } : null,
      fpsMax: cap.frameRate ? cap.frameRate.max : null,
    },
    capacidades: cap,
  };
}

function motivoDeCamara(e) {
  const n = String((e && e.name) || '');
  switch (n) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Permiso de cámara denegado. Acéptalo en el candado de la barra de direcciones y reintenta.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No hay ninguna cámara conectada a este equipo.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'La cámara está ocupada por otro programa. Ciérralo y reintenta.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'Esa cámara no acepta la configuración pedida; puede que ya no esté conectada.';
    case 'SecurityError':
      return 'La cámara requiere HTTPS o localhost (contexto seguro).';
    case '':
      return 'La cámara no respondió a tiempo.';
    default:
      return (e && e.message) || 'No se pudo abrir la cámara.';
  }
}

/**
 * Campo de visión horizontal a partir de una calibración con un objeto de
 * tamaño conocido.
 *
 * Es el hueco que deja la web: `getCapabilities()` no entrega el FOV, y sin FOV
 * no hay medición en centímetros. Se resuelve poniendo algo de ancho conocido
 * —una hoja tamaño carta, una regla, una puerta— a una distancia medida, y
 * anotando qué fracción del ancho del cuadro ocupa.
 *
 *     tan(fov/2) = ancho_real / (2 · distancia · fracción_del_cuadro)
 */
function calibrarFov(anchoRealCm, distanciaCm, fraccionDelCuadro) {
  const a = Number(anchoRealCm), d = Number(distanciaCm), f = Number(fraccionDelCuadro);
  if (!(a > 0) || !(d > 0) || !(f > 0) || f > 1) return null;
  const tan = a / (2 * d * f);
  const fovH = (Math.atan(tan) * 2 * 180) / Math.PI;
  return Number.isFinite(fovH) && fovH > 5 && fovH < 175 ? fovH : null;
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
  const audio = await detectarAudio(nav);
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
    microfonos: audio.microfonos,
    altavoces: audio.altavoces,
    radios: detectarRadios(G, nav),
    motor: detectarMotor(ua, G),
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
  // 'verificado' es una capacidad comprobada en el equipo; 'ficha' es la
  // especificación del fabricante para un modelo identificado exacto. Las dos
  // son inferencias sobre un catálogo, no medidas — pero son mejores que la
  // suposición de un perfil genérico, que es lo que queda con 'por-confirmar'.
  const CATALOGO_FIABLE = ['verificado', 'ficha'];
  const confianzaCatalogo = equipo && CATALOGO_FIABLE.includes(equipo.confianza)
    ? FUENTES.inferida.id : FUENTES.supuesta.id;
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

/* ===== src/core/cuerpo.js ===== */
/**
 * cuerpo.js — captura de movimiento y parametrización del cuerpo con cámara.
 *
 * El motor geométrico de este módulo viene de **Kimos FunPlai**, donde lleva
 * meses funcionando en un tótem real: convierte los 33 puntos de una pose en
 * centímetros usando la altura de la cámara, su inclinación y su campo de
 * visión. No es una estimación por proporciones corporales: es el rayo que pasa
 * por los tobillos cortando el piso.
 *
 *     elevación(y) = atan((0,5 − y) · 2 · tan(fov_v/2)) − inclinación
 *     distancia    = altura_cámara / tan(−elevación_tobillos)
 *     cm_por_unidad_de_imagen = 2 · distancia · tan(fov/2)
 *
 * LiDARia aporta dos cosas que FunPlai no necesitaba y una obra sí:
 *
 *  1. **Medir sin ver los pies.** La fórmula de arriba exige los tobillos en
 *     cuadro. Un equipo con LiDAR o ToF entrega la distancia directamente, así
 *     que `medirConProfundidad()` mide segmentos y alturas con la persona
 *     cortada a media pierna — el caso normal de una cámara de acceso.
 *  2. **Parametrizar para trabajo, no para juego.** `parametrizar()` traduce
 *     las medidas a lo que un prevencionista usa: alturas de trabajo reales,
 *     alcances, talla de arnés y de ropa.
 *
 * La regla de siempre: **lo que no se puede medir se informa como no derivable,
 * nunca se estima en silencio.** La circunferencia de cabeza no sale de una
 * pose, así que la talla de casco no se inventa.
 */


const aRad = (grados) => (grados * Math.PI) / 180;
const aGrados = (radianes) => (radianes * 180) / Math.PI;
const cifraCuerpo = (v, porDefecto) => (Number.isFinite(Number(v)) ? Number(v) : porDefecto);
const acotar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Los 33 puntos de la convención MediaPipe Pose, en el orden del modelo. */
const PUNTOS_CUERPO = [
  'nariz', 'ojoI.interno', 'ojoI', 'ojoI.externo', 'ojoD.interno', 'ojoD', 'ojoD.externo',
  'orejaI', 'orejaD', 'bocaI', 'bocaD',
  'hombroI', 'hombroD', 'codoI', 'codoD', 'munecaI', 'munecaD',
  'meniqueI', 'meniqueD', 'indiceI', 'indiceD', 'pulgarI', 'pulgarD',
  'caderaI', 'caderaD', 'rodillaI', 'rodillaD', 'tobilloI', 'tobilloD',
  'talonI', 'talonD', 'puntaPieI', 'puntaPieD',
];

/** Índices con nombre. `I`/`D` son izquierda y derecha **de la persona**. */
const IDX = {
  nariz: 0, orejaI: 7, orejaD: 8,
  hombroI: 11, hombroD: 12, codoI: 13, codoD: 14, munecaI: 15, munecaD: 16,
  indiceI: 19, indiceD: 20,
  caderaI: 23, caderaD: 24, rodillaI: 25, rodillaD: 26, tobilloI: 27, tobilloD: 28,
  talonI: 29, talonD: 30, puntaPieI: 31, puntaPieD: 32,
};

/** Las ocho articulaciones que se puntúan: vértice y sus dos brazos. */
const ARTICULACIONES = [
  { id: 'hombroI', label: 'Hombro izquierdo', vertice: IDX.hombroI, a: IDX.codoI, b: IDX.caderaI },
  { id: 'hombroD', label: 'Hombro derecho', vertice: IDX.hombroD, a: IDX.codoD, b: IDX.caderaD },
  { id: 'codoI', label: 'Codo izquierdo', vertice: IDX.codoI, a: IDX.hombroI, b: IDX.munecaI },
  { id: 'codoD', label: 'Codo derecho', vertice: IDX.codoD, a: IDX.hombroD, b: IDX.munecaD },
  { id: 'caderaI', label: 'Cadera izquierda', vertice: IDX.caderaI, a: IDX.hombroI, b: IDX.rodillaI },
  { id: 'caderaD', label: 'Cadera derecha', vertice: IDX.caderaD, a: IDX.hombroD, b: IDX.rodillaD },
  { id: 'rodillaI', label: 'Rodilla izquierda', vertice: IDX.rodillaI, a: IDX.caderaI, b: IDX.tobilloI },
  { id: 'rodillaD', label: 'Rodilla derecha', vertice: IDX.rodillaD, a: IDX.caderaD, b: IDX.tobilloD },
];

/**
 * Montajes de referencia. `alturaCamara` e `inclinacion` son del **centro del
 * lente**, en cm y grados hacia abajo; `fovH` es el campo horizontal.
 */
const MONTAJES = [
  {
    id: 'totem.integrada', nombre: 'Tótem con cámara integrada arriba',
    alturaCamara: 175.5, inclinacion: 0, fovH: 70, aspecto: 16 / 9,
    alto: 240, ancho: 220, profundidad: 250, distanciaZona: 220,
    nota: 'El caso medido en el tótem de 180 cm. Con 70° y sin inclinar, el piso recién entra en cuadro a 4,46 m: no sirve para cuerpo entero.',
  },
  {
    id: 'totem.granangular', nombre: 'Tótem con gran angular sobre la pantalla',
    alturaCamara: 145, inclinacion: 5, fovH: 90, aspecto: 16 / 9,
    alto: 240, ancho: 220, profundidad: 250, distanciaZona: 220,
    nota: 'El montaje recomendado: centra la franja de 0 a 240 cm y deja margen vertical.',
  },
  {
    id: 'movil.mano', nombre: 'Móvil o tablet sostenido a la altura del pecho',
    alturaCamara: 140, inclinacion: 0, fovH: 70, aspecto: 16 / 9,
    alto: 200, ancho: 160, profundidad: 400, distanciaZona: 300,
    nota: 'La altura y la inclinación cambian a cada momento: sirve para captura puntual, no para medir en serie. Con IMU se puede leer la inclinación real.',
  },
  {
    id: 'acceso.fija', nombre: 'Cámara fija de control de acceso',
    alturaCamara: 250, inclinacion: 20, fovH: 90, aspecto: 16 / 9,
    alto: 200, ancho: 200, profundidad: 400, distanciaZona: 300,
    nota: 'Alta y muy inclinada: casi nunca ve los pies. Es el caso donde la profundidad real cambia las cosas.',
  },
];

const MONTAJE_POR_DEFECTO = MONTAJES[1];

/** Rellena un montaje parcial con los valores del montaje recomendado. */
function montajeNormalizado(montaje) {
  const m = montaje || {};
  const base = MONTAJE_POR_DEFECTO;
  return {
    alturaCamara: acotar(cifraCuerpo(m.alturaCamara, base.alturaCamara), 20, 500),
    inclinacion: acotar(cifraCuerpo(m.inclinacion, base.inclinacion), -45, 60),
    fovH: acotar(cifraCuerpo(m.fovH, base.fovH), 30, 170),
    aspecto: acotar(cifraCuerpo(m.aspecto, base.aspecto), 0.4, 4),
    alto: acotar(cifraCuerpo(m.alto, base.alto), 80, 400),
    ancho: acotar(cifraCuerpo(m.ancho, base.ancho), 60, 600),
    profundidad: acotar(cifraCuerpo(m.profundidad, base.profundidad), 60, 2000),
    distanciaZona: acotar(cifraCuerpo(m.distanciaZona, cifraCuerpo(m.profundidad, base.profundidad) * 0.88), 40, 2000),
  };
}

/** Campo de visión vertical a partir del horizontal y la relación de aspecto. */
function geometriaCamara(montaje) {
  const m = montajeNormalizado(montaje);
  const tanH = Math.tan(aRad(m.fovH / 2));
  const tanV = tanH / m.aspecto;
  return { fovH: m.fovH, fovV: aGrados(Math.atan(tanV)) * 2, tanH, tanV, aspecto: m.aspecto };
}

/**
 * Franja de altura que la cámara ve a cada distancia. `pisoEn(d) === 0` quiere
 * decir que a esa distancia el suelo ya entra en cuadro.
 */
function franjaVisible(montaje) {
  const m = montajeNormalizado(montaje);
  const g = geometriaCamara(m);
  const medio = g.fovV / 2;
  const tanAbajo = Math.tan(aRad(m.inclinacion + medio));
  return {
    geometria: g,
    alturaCamara: m.alturaCamara,
    inclinacion: m.inclinacion,
    // Distancia a la que el borde inferior del cuadro toca el suelo.
    distanciaPies: tanAbajo > 0.01 ? m.alturaCamara / tanAbajo : Infinity,
    techoEn: (d) => m.alturaCamara + d * Math.tan(aRad(medio - m.inclinacion)),
    pisoEn: (d) => Math.max(0, m.alturaCamara - d * tanAbajo),
  };
}

/** ¿El lente cubre el volumen declarado dentro de la profundidad disponible? */
function coberturaDeMontaje(montaje) {
  const m = montajeNormalizado(montaje);
  const g = geometriaCamara(m);
  const altoCubierto = 2 * m.distanciaZona * g.tanV;
  const anchoCubierto = 2 * m.distanciaZona * g.tanH;
  const distMinAlto = m.alto / (2 * g.tanV);
  const distMinAncho = m.ancho / (2 * g.tanH);
  const necesaria = Math.max(distMinAlto, distMinAncho);
  const alcanza = necesaria <= m.profundidad + 0.5;
  const tanHNecesario = Math.max(m.ancho / (2 * m.profundidad), (m.alto / (2 * m.profundidad)) * g.aspecto);
  const fovNecesario = aGrados(Math.atan(tanHNecesario)) * 2;
  return {
    geometria: g, ...m,
    altoCubierto, anchoCubierto,
    distanciaMinima: necesaria, distMinAlto, distMinAncho,
    alcanza,
    cubreEnLaZona: altoCubierto >= m.alto - 0.5 && anchoCubierto >= m.ancho - 0.5,
    fovNecesario,
    recomendacion: alcanza
      ? 'La cámara cubre el volumen declarado dentro de la profundidad disponible.'
      : 'Con ' + Math.round(g.fovH) + '° harían falta ' + Math.round(necesaria) + ' cm de profundidad. Con '
        + Math.round(m.profundidad) + ' cm disponibles hace falta un lente de al menos ' + Math.round(fovNecesario) + '° horizontales.',
  };
}

/**
 * Dónde marcar la zona y cuánto inclinar la cámara.
 *
 * El punto fino: la inclinación correcta es la **bisectriz de los dos ángulos**
 * —el que baja al piso y el que sube al techo de la franja—, no la que apunta
 * al punto medio en centímetros. Vista desde una cámara alta, la mitad de abajo
 * ocupa muchos más grados que la de arriba, y apuntar al centro métrico deja la
 * cabeza fuera de cuadro.
 */
function montajeSugerido(montaje) {
  const m = montajeNormalizado(montaje);
  const g = geometriaCamara(m);
  const hc = m.alturaCamara;
  const aPiso = (d) => aGrados(Math.atan(hc / d));
  const aTecho = (d) => aGrados(Math.atan((m.alto - hc) / d));
  const abarca = (d) => aPiso(d) + aTecho(d);
  const margen = 3;
  let distancia = Math.max(80, m.profundidad - 15);
  for (let d = 80; d <= m.profundidad - 15; d += 1) {
    if (abarca(d) <= g.fovV - margen) { distancia = d; break; }
  }
  const inclinacion = (aPiso(distancia) - aTecho(distancia)) / 2;
  const franja = franjaVisible(m);
  const veCuerpoEntero = franja.distanciaPies <= m.profundidad && franja.techoEn(franja.distanciaPies) >= m.alto - 1;
  // El mejor caso del lente: cámara a media franja, al fondo del espacio.
  const mejorCaso = 2 * aGrados(Math.atan(m.alto / (2 * m.profundidad)));
  const hayMontaje = mejorCaso <= g.fovV;
  const fovMinimo = 2 * aGrados(Math.atan(Math.tan(aRad(mejorCaso / 2)) * g.aspecto));
  return {
    distancia: Math.round(distancia),
    inclinacion: Math.round(inclinacion),
    alturaSinInclinar: Math.round(m.alto / 2),
    distanciaPies: franja.distanciaPies,
    techoEnZona: franja.techoEn(m.distanciaZona),
    pisoEnZona: franja.pisoEn(m.distanciaZona),
    veCuerpoEntero, hayMontaje, fovMinimo,
    mensaje: veCuerpoEntero
      ? 'El montaje actual ve el cuerpo entero dentro del espacio disponible.'
      : !hayMontaje
        ? 'Con ' + Math.round(g.fovH) + '° horizontales no hay altura ni inclinación que sirva para cuerpo entero: los '
          + Math.round(m.alto) + ' cm de franja ocupan ' + Math.round(mejorCaso) + '° verticales incluso desde '
          + Math.round(m.profundidad) + ' cm, y el lente da ' + Math.round(g.fovV) + '°. Hace falta un lente de al menos '
          + Math.round(fovMinimo) + '° horizontales. Para medio cuerpo este sirve igual, y con profundidad real tampoco hace falta.'
        : 'Con la cámara a ' + Math.round(hc) + ' cm e inclinación ' + Math.round(m.inclinacion) + '°, el piso recién entra en cuadro a '
          + (franja.distanciaPies === Infinity ? '∞' : Math.round(franja.distanciaPies)) + ' cm. Para ver de pies a cabeza dentro de '
          + Math.round(m.profundidad) + ' cm: inclínala ' + Math.round(inclinacion) + '° y marca la zona a ' + Math.round(distancia)
          + ' cm, o bájala a ' + Math.round(m.alto / 2) + ' cm y déjala horizontal.',
  };
}

/* ------------------------------ la pose ------------------------------ */

const visible = (L, i, umbral) => {
  const p = L && L[i];
  return !!p && (p.visibility == null || p.visibility > (umbral == null ? 0.35 : umbral));
};

/**
 * Altura sobre el suelo, en cm, del punto que la pose ofrece como apoyo.
 *
 * MediaPipe marca el **tobillo** en la articulación, no en la planta: usarlo
 * como si pisara el suelo alarga la distancia unos 8 cm a 2 m, y ese error se
 * arrastra a todos los segmentos. El talón y la punta del pie sí están en el
 * suelo, así que se prefieren cuando el modelo los da con confianza.
 */
const ALTURA_APOYO_CM = { talon: 0, puntaPie: 0, tobillo: 7 };

function puntoDeApoyo(L) {
  const promedio = (indices, tipo) => {
    const ps = indices.filter((i) => visible(L, i)).map((i) => L[i]);
    if (!ps.length) return null;
    return { y: ps.reduce((a, p) => a + p.y, 0) / ps.length, tipo, alturaCm: ALTURA_APOYO_CM[tipo] };
  };
  return promedio([IDX.talonI, IDX.talonD, IDX.puntaPieI, IDX.puntaPieD], 'talon')
    || promedio([IDX.tobilloI, IDX.tobilloD], 'tobillo');
}

/** Ángulo en grados en el vértice `b` del triángulo a-b-c. */
function anguloEn(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-6 || n2 < 1e-6) return null;
  return aGrados(Math.acos(acotar((v1x * v2x + v1y * v2y) / (n1 * n2), -1, 1)));
}

/** Los ocho ángulos articulares, en grados. `null` donde el punto no se ve. */
function angulosArticulares(L) {
  const salida = {};
  for (const art of ARTICULACIONES) {
    salida[art.id] = (visible(L, art.vertice) && visible(L, art.a) && visible(L, art.b))
      ? anguloEn(L[art.a], L[art.vertice], L[art.b])
      : null;
  }
  return salida;
}

/**
 * Márgenes de encuadre para el montaje declarado.
 *
 * Un umbral fijo —"los hombros tienen que ocupar el 12% del cuadro"— solo vale
 * para el lente con el que se calibró. Con un gran angular de 90° a 2,2 m unos
 * hombros normales ocupan el 8%, y ese umbral fijo mandaría a la persona a
 * acercarse cuando está exactamente donde debe. Así que el margen sale de la
 * geometría: hombros de 32 cm al fondo del espacio y de 52 cm en el borde
 * cercano de la zona.
 */
function margenesDeHombros(montaje) {
  if (!montaje) return { min: 0.12, max: 0.55 };
  const m = montajeNormalizado(montaje);
  const g = geometriaCamara(m);
  const fraccion = (anchoCm, distancia) => anchoCm / (2 * distancia * g.tanH);
  return {
    min: fraccion(32, m.profundidad) * 0.8,
    max: fraccion(52, Math.max(50, m.distanciaZona * 0.5)),
  };
}

/**
 * ¿Está la persona bien encuadrada? `modo` es `'completo'` (hace falta ver los
 * pies) o `'superior'` (basta torso, brazos y cabeza). Con `montaje` los
 * márgenes se calculan para ese lente; sin él se usan los del tótem.
 */
function encuadreDePose(L, modo, montaje) {
  if (!L || L.length < 29) return { ok: false, motivo: 'Sin persona detectada' };
  if (modo === 'superior') {
    if (!visible(L, IDX.nariz, 0.4)) return { ok: false, motivo: 'No veo la cara: ponte de frente a la cámara' };
    if (!visible(L, IDX.hombroI, 0.4) || !visible(L, IDX.hombroD, 0.4)) return { ok: false, motivo: 'No veo los hombros: céntrate en la cámara' };
    const ancho = Math.abs(L[IDX.hombroI].x - L[IDX.hombroD].x);
    const cx = (L[IDX.hombroI].x + L[IDX.hombroD].x) / 2;
    const margen = margenesDeHombros(montaje);
    if (ancho < margen.min) return { ok: false, motivo: 'Acércate: la persona se ve muy pequeña' };
    if (ancho > margen.max) return { ok: false, motivo: 'Retrocede un paso' };
    if (cx < 0.32) return { ok: false, motivo: 'Muévete a tu derecha →' };
    if (cx > 0.68) return { ok: false, motivo: '← Muévete a tu izquierda' };
    return { ok: true, motivo: 'Encuadre correcto', ancho, cx, modo: 'superior' };
  }
  if (!visible(L, IDX.nariz, 0.4)) return { ok: false, motivo: 'No veo la cabeza: retrocede un poco' };
  if (!visible(L, IDX.tobilloI, 0.4) && !visible(L, IDX.tobilloD, 0.4)) {
    return { ok: false, motivo: 'No veo los pies: aléjate, baja la cámara o inclínala' };
  }
  let minY = 1, maxY = 0, minX = 1, maxX = 0;
  for (const p of L) {
    if (!p) continue;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
  }
  const alto = maxY - minY, cx = (minX + maxX) / 2;
  if (alto < 0.55) return { ok: false, motivo: 'Acércate: la persona se ve muy pequeña' };
  if (alto > 0.99) return { ok: false, motivo: 'Aléjate: la persona no cabe en cuadro' };
  if (cx < 0.3) return { ok: false, motivo: 'Muévete a tu derecha →' };
  if (cx > 0.7) return { ok: false, motivo: '← Muévete a tu izquierda' };
  return { ok: true, motivo: 'Encuadre correcto', alto, ancho: maxX - minX, cx, modo: 'completo' };
}

/* --------------------------- la medición --------------------------- */

/** Segmentos y alturas comunes a las dos vías de medición. */
function cuerpoDesdeDistancia(L, m, g, distancia, mundo) {
  const cmPorY = 2 * distancia * g.tanV;
  const cmPorX = 2 * distancia * g.tanH;
  const elevacion = (y) => aGrados(Math.atan((0.5 - y) * 2 * g.tanV)) - m.inclinacion;
  /** Altura sobre el suelo de un punto de la imagen, en cm. */
  const alturaDe = (i) => (visible(L, i) ? m.alturaCamara + distancia * Math.tan(aRad(elevacion(L[i].y))) : null);
  const entre = (a, b) => (visible(L, a) && visible(L, b)
    ? Math.hypot((L[a].x - L[b].x) * cmPorX, (L[a].y - L[b].y) * cmPorY) : null);

  const segmentos = {
    anchoHombros: entre(IDX.hombroI, IDX.hombroD),
    anchoCaderas: entre(IDX.caderaI, IDX.caderaD),
    brazoI: entre(IDX.hombroI, IDX.codoI),
    brazoD: entre(IDX.hombroD, IDX.codoD),
    antebrazoI: entre(IDX.codoI, IDX.munecaI),
    antebrazoD: entre(IDX.codoD, IDX.munecaD),
    manoI: entre(IDX.munecaI, IDX.indiceI),
    manoD: entre(IDX.munecaD, IDX.indiceD),
    torso: entre(IDX.hombroI, IDX.caderaI),
    musloI: entre(IDX.caderaI, IDX.rodillaI),
    musloD: entre(IDX.caderaD, IDX.rodillaD),
    piernaI: entre(IDX.rodillaI, IDX.tobilloI),
    piernaD: entre(IDX.rodillaD, IDX.tobilloD),
    pieI: entre(IDX.talonI, IDX.puntaPieI),
    pieD: entre(IDX.talonD, IDX.puntaPieD),
  };
  const alturas = {
    hombro: alturaDe(IDX.hombroD) != null && alturaDe(IDX.hombroI) != null
      ? (alturaDe(IDX.hombroI) + alturaDe(IDX.hombroD)) / 2 : (alturaDe(IDX.hombroD) ?? alturaDe(IDX.hombroI)),
    codo: alturaDe(IDX.codoD) ?? alturaDe(IDX.codoI),
    muneca: alturaDe(IDX.munecaD) ?? alturaDe(IDX.munecaI),
    cadera: alturaDe(IDX.caderaD) ?? alturaDe(IDX.caderaI),
    rodilla: alturaDe(IDX.rodillaD) ?? alturaDe(IDX.rodillaI),
  };
  let envergaduraMundo = null;
  if (mundo && mundo[IDX.munecaI] && mundo[IDX.munecaD]) {
    const a = mundo[IDX.munecaI], b = mundo[IDX.munecaD];
    envergaduraMundo = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 100;
  }
  const angulos = angulosArticulares(L);
  // Wrist-to-wrist solo mide la envergadura con los brazos en cruz. El codo
  // estirado no basta: de pie con los brazos caídos también está estirado y da
  // la mitad de la envergadura real, que alimentaría un alcance falso. Hace
  // falta además que el brazo esté separado del tronco (ángulo de hombro).
  const brazosExtendidos = angulos.codoI != null && angulos.codoD != null
    && angulos.hombroI != null && angulos.hombroD != null
    && angulos.codoI > 150 && angulos.codoD > 150
    && angulos.hombroI > 70 && angulos.hombroD > 70;
  const distanciaMunecas = entre(IDX.munecaI, IDX.munecaD);
  return {
    segmentos, alturas, cmPorX, cmPorY, elevacion, alturaDe, angulos,
    distanciaMunecas,
    brazosExtendidos,
    envergadura: brazosExtendidos ? distanciaMunecas : null,
    envergaduraMotivo: brazosExtendidos ? null : 'Los brazos no están en cruz: la distancia entre muñecas no es la envergadura. Pide abrir los brazos.',
    envergaduraMundo,
  };
}

/**
 * Medición por geometría de piso: **exige ver los tobillos**. Es el motor de
 * FunPlai, y en el tótem recupera 180 cm de distancia, 175 de estatura y 176 de
 * envergadura sobre un cuerpo sintético con error de 0 cm.
 */
function medirCuerpo(L, montaje, opciones) {
  const o = opciones || {};
  if (!L || L.length < 33) return { ok: false, via: 'piso', motivo: 'Sin persona detectada' };
  const m = montajeNormalizado(montaje);
  const g = geometriaCamara(m);
  const elevacion = (y) => aGrados(Math.atan((0.5 - y) * 2 * g.tanV)) - m.inclinacion;

  const apoyo = puntoDeApoyo(L);
  if (!apoyo) {
    return {
      ok: false, via: 'piso',
      motivo: 'No veo los pies: por geometría de piso la distancia se mide desde el suelo',
      alternativa: 'Con un sensor de profundidad (LiDAR, ToF o estéreo) usa medirConProfundidad(): no necesita los tobillos.',
    };
  }
  const aPies = elevacion(apoyo.y);
  if (aPies >= -0.5) {
    return { ok: false, via: 'piso', motivo: 'Los pies quedan sobre el horizonte: revisa la inclinación de la cámara' };
  }
  // El punto detectado no siempre está en el suelo: el tobillo va unos 7 cm
  // más arriba, y usarlo como si pisara alarga la distancia varios centímetros.
  const distancia = (m.alturaCamara - apoyo.alturaCm) / Math.tan(aRad(-aPies));
  if (!Number.isFinite(distancia) || distancia <= 0 || distancia > 2000) {
    return { ok: false, via: 'piso', motivo: 'Distancia fuera de rango: revisa altura e inclinación de la cámara' };
  }
  const base = cuerpoDesdeDistancia(L, m, g, distancia, o.mundo);
  const cabeza = visible(L, IDX.nariz)
    // La nariz queda unos 10 cm bajo la coronilla en un adulto de pie.
    ? m.alturaCamara + distancia * Math.tan(aRad(elevacion(L[IDX.nariz].y))) + 10
    : null;
  const dentro = distancia >= m.distanciaZona * 0.55 && distancia <= m.profundidad + 30;
  return {
    ok: true, via: 'piso', distancia, altura: cabeza,
    apoyo: apoyo.tipo,
    ...base,
    dentroDelEspacio: dentro,
    // 1° de error de inclinación son ~3,5 cm a 2 m: ese es el error dominante.
    errorCm: Math.max(3, distancia * Math.tan(aRad(1)) * (o.errorInclinacionGrados || 1)),
    motivo: dentro ? 'Dentro del espacio declarado' : 'Fuera del espacio declarado',
  };
}

/**
 * Medición con distancia entregada por un sensor de profundidad.
 *
 * Aquí está el aporte de LiDARia: el rayo al piso deja de hacer falta, así que
 * se mide con la persona cortada a media pierna —el caso normal de una cámara
 * de acceso montada alta. La estatura sigue necesitando los pies o el plano del
 * suelo, y cuando no están **se informa `altura: null`, no se estima**.
 *
 * @param muestra `{ distanciaCm, sensorId }` — `sensorId` es una clave de
 *        `PERFIL_SENSOR` y decide la banda de error que se reporta.
 */
function medirConProfundidad(L, montaje, muestra, opciones) {
  const o = opciones || {};
  if (!L || L.length < 33) return { ok: false, via: 'profundidad', motivo: 'Sin persona detectada' };
  const d = cifraCuerpo(muestra && muestra.distanciaCm, NaN);
  if (!(d > 0)) return { ok: false, via: 'profundidad', motivo: 'El sensor no entregó distancia' };
  const sensorId = (muestra && muestra.sensorId) || 'depth.dtof';
  if (!PERFIL_SENSOR[sensorId]) {
    return { ok: false, via: 'profundidad', motivo: 'Sensor desconocido: ' + sensorId };
  }
  const m = montajeNormalizado(montaje);
  const g = geometriaCamara(m);
  const base = cuerpoDesdeDistancia(L, m, g, d, o.mundo);
  const veLosPies = visible(L, IDX.tobilloI) || visible(L, IDX.tobilloD);
  const alturaCabeza = (veLosPies && visible(L, IDX.nariz))
    ? m.alturaCamara + d * Math.tan(aRad(base.elevacion(L[IDX.nariz].y))) + 10
    : null;
  return {
    ok: true, via: 'profundidad', sensorId, distancia: d,
    ...base,
    altura: alturaCabeza,
    alturaMotivo: alturaCabeza == null
      ? 'La estatura necesita ver los pies o el plano del suelo; los segmentos y las alturas relativas no.'
      : null,
    // La banda del sensor manda: es medida, no inferida.
    errorCm: errorEsperado(sensorId, d / 100) * 100,
    dentroDelEspacio: d <= m.profundidad + 30,
    motivo: 'Distancia medida por ' + PERFIL_SENSOR[sensorId].label,
  };
}

/**
 * Encuadre digital: recorta y centra sobre la persona sin mover el lente.
 *
 * Una PTZ con gimbal encuadra mejor, pero al girar cambia su inclinación sin
 * informarla, y con eso se pierde la referencia que permite medir en cm. Esto
 * consigue el mismo efecto en pantalla dejando la geometría intacta.
 */
function seguimientoDigital(L, previo, opciones) {
  const o = opciones || {};
  const suave = acotar(cifraCuerpo(o.suavizado, 0.12), 0.01, 1);
  const zoomMax = acotar(cifraCuerpo(o.zoomMax, 1.8), 1, 3);
  const base = previo || { zoom: 1, cx: 0.5, cy: 0.5 };
  const puntos = (L || []).filter((p) => p && (p.visibility == null || p.visibility > 0.4));
  if (puntos.length < 4) {
    return {
      zoom: base.zoom + (1 - base.zoom) * suave,
      cx: base.cx + (0.5 - base.cx) * suave,
      cy: base.cy + (0.5 - base.cy) * suave,
      siguiendo: false,
    };
  }
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  for (const p of puntos) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const margen = cifraCuerpo(o.margen, 0.12);
  const ancho = acotar((x1 - x0) + margen * 2, 0.08, 1);
  const alto = acotar((y1 - y0) + margen * 2, 0.08, 1);
  const objetivo = acotar(Math.min(1 / ancho, 1 / alto), 1, zoomMax);
  const limite = (z) => 0.5 - 0.5 / z;
  const zoom = base.zoom + (objetivo - base.zoom) * suave;
  const lim = limite(zoom);
  return {
    zoom,
    cx: acotar(base.cx + ((x0 + x1) / 2 - base.cx) * suave, 0.5 - lim, 0.5 + lim),
    cy: acotar(base.cy + ((y0 + y1) / 2 - base.cy) * suave, 0.5 - lim, 0.5 + lim),
    siguiendo: true,
  };
}

/* -------------------- de centímetros a decisiones -------------------- */

/** Lee `alturas.codo`, `segmentos.pieD`, `envergadura`… sobre una medición. */
function valorDe(medicion, ruta) {
  if (!medicion || !ruta) return null;
  let v = medicion;
  for (const parte of String(ruta).split('.')) {
    if (v == null) return null;
    v = v[parte];
  }
  return Number.isFinite(v) ? v : null;
}

const CONFIANZA_ORDEN = { medida: 1, derivada: 2, estimada: 3 };

/**
 * Traduce una medición a lo que se usa en terreno: alturas de trabajo,
 * alcances y tallas.
 *
 * Devuelve siempre las tres listas —`ergonomia`, `tallas` y `noDerivables`—
 * aunque falten medidas: una entrada sin dato aparece con `valor: null` y el
 * motivo por el que no se pudo calcular. Callar una fila es peor que mostrarla
 * vacía, porque el operador no sabe si la app no lo midió o no lo sabe hacer.
 */
function parametrizar(medicion, catalogo) {
  const cat = catalogo || {};
  const ok = !!(medicion && medicion.ok);

  const ergonomia = (cat.ergonomia || []).map((regla) => {
    const base = ok ? valorDe(medicion, regla.desde) : null;
    let valor = null, rango = null;
    if (base != null) {
      if (Array.isArray(regla.ajusteCm)) {
        rango = [Math.round(base + regla.ajusteCm[0]), Math.round(base + regla.ajusteCm[1])];
        valor = Math.round((rango[0] + rango[1]) / 2);
      } else {
        valor = Math.round(base * cifraCuerpo(regla.factor, 1));
        rango = [valor, valor];
      }
    }
    return {
      ...regla, valor, rango,
      motivo: base != null ? null : (ok ? 'Falta la medida base: ' + regla.desde : 'Sin medición válida'),
    };
  });

  const tallas = (cat.tallas || []).map((t) => {
    const base = ok ? valorDe(medicion, t.desde) : null;
    let talla = null;
    if (base != null) {
      if (Array.isArray(t.tabla)) {
        const fila = t.tabla.find((f) => base <= f.hasta);
        talla = fila ? fila.talla : null;
      } else if (t.id === 'calzado') {
        // Un pie humano calzado mide entre 15 y 40 cm. Fuera de ahí lo que
        // falló es la detección del pie, y una talla inventada es peor que
        // ninguna: el pedido llega y no le sirve a nadie.
        talla = base >= 15 && base <= 40 ? 'EU ' + Math.round(base * 1.5 + 2) : null;
      }
    }
    return {
      ...t, base, talla,
      motivo: talla != null ? null
        : base == null ? (ok ? 'Falta la medida base: ' + t.desde : 'Sin medición válida')
        : 'La medida base (' + base.toFixed(1) + ' cm) está fuera del rango humano: el punto se detectó mal.',
    };
  });

  const conDato = ergonomia.filter((e) => e.valor != null).length + tallas.filter((t) => t.talla != null).length;
  const total = ergonomia.length + tallas.length;
  const peor = [...ergonomia, ...tallas]
    .filter((e) => (e.valor != null || e.talla != null))
    .reduce((p, e) => Math.max(p, CONFIANZA_ORDEN[e.confianza] || 3), 0);

  return {
    ok: ok && conDato > 0,
    via: (medicion && medicion.via) || null,
    errorCm: (medicion && medicion.errorCm) || null,
    ergonomia, tallas,
    noDerivables: cat.noDerivables || [],
    cobertura: total ? conDato / total : 0,
    confianzaGlobal: peor === 1 ? 'medida' : peor === 2 ? 'derivada' : peor === 3 ? 'estimada' : null,
    aviso: 'Las medidas corporales de una persona identificada son datos personales. Para asignar EPP basta el número; para guardarlo junto al nombre hace falta base de licitud y plazo de conservación.',
  };
}

/**
 * Rasgos de la parametrización corporal para `clasificar()` de legal.js.
 *
 * Medir un cuerpo para asignarle un arnés **no es dato biométrico**: no busca
 * identificar a nadie. Pasa a serlo en el momento en que la medida se usa para
 * reconocer a la persona, y por eso `identificar` es un parámetro, no un
 * supuesto.
 */
function rasgosDeCuerpo(opciones) {
  const o = opciones || {};
  return {
    personas: true,
    sensibles: o.identificar === true,
    observacionSistematica: o.continuo === true,
    masivo: o.masivo === true,
    decisionAutomatizada: o.decideSolo === true,
  };
}

/**
 * ¿Sirve esta captura? Junta las tres cosas que la arruinan: pocos cuadros por
 * segundo, puntos poco visibles y una persona fuera del volumen declarado.
 */
function calidadDeCaptura(datos) {
  const d = datos || {};
  const fps = cifraCuerpo(d.fps, 0);
  const L = d.landmarks || null;
  const vistos = L ? L.filter((p) => p && (p.visibility == null || p.visibility > 0.5)).length : 0;
  const visibilidad = L && L.length ? vistos / L.length : 0;
  const problemas = [];
  if (fps > 0 && fps < 12) problemas.push('Menos de 12 cuadros por segundo: el movimiento se pierde entre cuadros.');
  if (L && visibilidad < 0.6) problemas.push('Más de un tercio de los puntos con baja visibilidad: revisa luz y contraluz.');
  if (d.medicion && d.medicion.ok && d.medicion.dentroDelEspacio === false) {
    problemas.push('La persona está fuera del volumen declarado: la medida en centímetros pierde garantía.');
  }
  if (d.medicion && !d.medicion.ok) problemas.push(d.medicion.motivo);
  const veredicto = !L ? 'sin-persona' : problemas.length === 0 ? 'buena' : problemas.length === 1 ? 'aceptable' : 'mala';
  return {
    veredicto, fps, visibilidad, puntosVisibles: vistos,
    problemas,
    // Sin persona no hay nada que reprochar: es el estado normal de una cámara vacía.
    mensaje: veredicto === 'sin-persona' ? 'Sin persona en cuadro'
      : veredicto === 'buena' ? 'Captura utilizable para medir'
      : veredicto === 'aceptable' ? 'Captura utilizable con reservas'
      : 'Captura no utilizable para medir',
  };
}

/* ===== src/core/componentes.js ===== */
/**
 * componentes.js — todo lo que el equipo trae, no solo el sensor de profundidad.
 *
 * LiDARia nació mirando la profundidad, y eso dejaba fuera la pregunta que hace
 * cualquiera con un teléfono en la mano: *«¿y con esto qué puedo sacar?»*. La
 * respuesta casi nunca es el LiDAR —la mayoría de los equipos no lo tiene— sino
 * la suma de la cámara, el micrófono, el altavoz, las radios y el IMU.
 *
 * Este módulo mantiene la misma regla que el resto del núcleo: **tener un
 * componente no es poder usarlo**. Un Xiaomi tiene emisor infrarrojo y antena
 * WiFi; desde el navegador no se llega a ninguno de los dos, y desde un
 * contenedor iOS tampoco. Eso se dice, no se rodea.
 */

const ORDEN_ACCESO = { web: 1, 'web-permiso': 2, 'web-chromium': 3, nativo: 4, no: 5 };

/** Estados posibles de un componente en un equipo concreto. */
const ESTADOS_COMPONENTE = [
  { id: 'disponible', label: 'Disponible ahora', orden: 1, icon: '✅' },
  { id: 'requiere-permiso', label: 'Disponible tras permiso', orden: 2, icon: '🔓' },
  { id: 'requiere-nativo', label: 'Necesita contenedor nativo', orden: 3, icon: '📦' },
  { id: 'no-en-plataforma', label: 'No accesible en esta plataforma', orden: 4, icon: '🚫' },
  { id: 'ausente', label: 'El equipo no lo trae', orden: 5, icon: '—' },
];

const ORDEN_ESTADO_COMPONENTE = Object.fromEntries(ESTADOS_COMPONENTE.map((e, i) => [e.id, i]));

const componentePorId = (catalogo, id) =>
  (catalogo && catalogo.componentes || []).find((c) => c.id === id) || null;

/** La vía de acceso que corresponde a la plataforma donde corre la app. */
function accesoEn(componente, plataforma, runtime) {
  if (!componente) return 'no';
  if (runtime === 'nativo') {
    const p = String(plataforma || '');
    if (p.startsWith('ios') || p === 'visionos') return componente.ios || 'no';
    return componente.android || 'no';
  }
  return componente.web || 'no';
}

/**
 * Estado de un componente en este equipo y en este entorno.
 *
 * `presente` viene del catálogo del equipo. Cuando no se sabe si el equipo lo
 * trae, se pasa `null` y el estado lo dice: preguntar es mejor que suponer que
 * sí, porque la lista de lo que "puede hacer" el equipo es exactamente lo que
 * el usuario va a creer.
 */
function estadoDeComponente(componente, contexto) {
  const ctx = contexto || {};
  if (!componente) return { estado: 'ausente', porque: 'Componente desconocido' };
  if (ctx.presente === false) {
    return { estado: 'ausente', porque: 'El catálogo de este equipo no lo declara.' };
  }
  const acceso = accesoEn(componente, ctx.plataforma, ctx.runtime);
  const enChromium = ctx.motor === 'chromium';
  if (acceso === 'no') {
    return {
      estado: ctx.runtime === 'nativo' ? 'no-en-plataforma' : 'requiere-nativo',
      acceso,
      porque: componente.apiWeb || 'Sin API que lo exponga en este entorno.',
    };
  }
  if (acceso === 'nativo') {
    return {
      estado: ctx.runtime === 'nativo' ? 'disponible' : 'requiere-nativo',
      acceso,
      porque: ctx.runtime === 'nativo'
        ? 'El contenedor lo alcanza con la API del sistema.'
        : 'El navegador no lo expone; el contenedor nativo sí.',
    };
  }
  if (acceso === 'web-chromium') {
    return {
      estado: enChromium ? 'requiere-permiso' : 'requiere-nativo',
      acceso,
      porque: enChromium
        ? 'Chromium lo expone; pide permiso al usar.'
        : 'Solo Chromium lo expone. En Safari de iOS hace falta el contenedor nativo.',
    };
  }
  if (acceso === 'web-permiso') {
    return { estado: 'requiere-permiso', acceso, porque: 'Disponible en la web; el usuario debe conceder el permiso.' };
  }
  return { estado: 'disponible', acceso, porque: 'Disponible sin permiso.' };
}

/**
 * Inventario completo de componentes para un equipo, ordenado por lo que se
 * puede usar ya. `equipo.componentes` es la lista de ids que ese equipo trae;
 * si no está declarada, todo queda como "por confirmar".
 */
function inventarioDeComponentes(catalogo, contexto) {
  const ctx = contexto || {};
  const declarados = ctx.equipo && Array.isArray(ctx.equipo.componentes) ? ctx.equipo.componentes : null;
  const filas = (catalogo && catalogo.componentes || []).map((c) => {
    const presente = declarados ? declarados.includes(c.id) : null;
    const est = estadoDeComponente(c, { ...ctx, presente });
    return {
      ...c, presente,
      estado: est.estado, acceso: est.acceso, porque: est.porque,
      confirmado: presente != null,
    };
  });
  filas.sort((a, b) => (ORDEN_ESTADO_COMPONENTE[a.estado] - ORDEN_ESTADO_COMPONENTE[b.estado])
    || (ORDEN_ACCESO[a.acceso] || 9) - (ORDEN_ACCESO[b.acceso] || 9)
    || a.nombre.localeCompare(b.nombre));
  const cuenta = (id) => filas.filter((f) => f.estado === id).length;
  return {
    filas,
    resumenComponentes: {
      disponibles: cuenta('disponible'),
      conPermiso: cuenta('requiere-permiso'),
      conNativo: cuenta('requiere-nativo'),
      fuera: cuenta('no-en-plataforma') + cuenta('ausente'),
      total: filas.length,
      declarado: declarados != null,
    },
  };
}

/** Combinaciones cuyos componentes están todos utilizables en este equipo. */
function combinacionesViables(catalogo, inventario) {
  const usable = new Set((inventario.filas || [])
    .filter((f) => f.estado === 'disponible' || f.estado === 'requiere-permiso')
    .map((f) => f.id));
  return (catalogo && catalogo.combinaciones || []).map((c) => {
    const faltan = c.necesita.filter((id) => !usable.has(id));
    return {
      ...c,
      viable: faltan.length === 0,
      faltan,
      // Una combinación de laboratorio no se vuelve producto porque el equipo
      // la soporte: sigue siendo un experimento con el hardware perfecto.
      recomendable: faltan.length === 0 && c.veredicto !== 'laboratorio',
    };
  }).sort((a, b) => (b.viable - a.viable) || (b.recomendable - a.recomendable));
}

/**
 * Qué puede aportar este equipo a cada módulo, contando todos sus componentes.
 *
 * Responde a la pregunta práctica: «tengo este teléfono, ¿para qué me sirve?».
 * Un módulo aparece como alcanzable cuando **todos** sus componentes de entrada
 * están utilizables; si falta uno, se nombra cuál y por qué.
 */
function planDeAprovechamiento(catalogo, inventario, modulos) {
  const porId = new Map((inventario.filas || []).map((f) => [f.id, f]));
  const utilizable = (id) => {
    const f = porId.get(id);
    return !!f && (f.estado === 'disponible' || f.estado === 'requiere-permiso');
  };
  return (modulos || []).map((mod) => {
    const suyos = (inventario.filas || []).filter((f) => (f.modulos || []).includes(mod.id));
    const listos = suyos.filter((f) => utilizable(f.id));
    const bloqueados = suyos.filter((f) => !utilizable(f.id));
    return {
      modulo: mod.id,
      nombre: mod.nombre || mod.id,
      componentes: suyos.map((f) => f.id),
      listos: listos.map((f) => f.id),
      bloqueados: bloqueados.map((f) => ({ id: f.id, nombre: f.nombre, estado: f.estado, porque: f.porque })),
      // Sin ningún componente listo el módulo no arranca; con algunos, arranca degradado.
      estado: suyos.length === 0 ? 'sin-relacion'
        : listos.length === 0 ? 'bloqueado'
        : bloqueados.length === 0 ? 'completo' : 'parcial',
    };
  }).filter((p) => p.estado !== 'sin-relacion')
    .sort((a, b) => b.listos.length - a.listos.length);
}

/**
 * Evidencia de componentes que sí se puede recoger en caliente, a partir de lo
 * que `detectar()` ya trae. No sustituye al catálogo: lo confirma o lo
 * desmiente, que es lo que convierte una fuente 'declarada' en 'medida'.
 */
function componentesObservados(evid) {
  const e = evid || {};
  const vistos = [];
  const camaras = e.camaras || {};
  if (camaras.disponible) {
    vistos.push('cam.trasera');
    if ((camaras.n || 0) > 1) vistos.push('cam.frontal');
  }
  if (e.microfonos && e.microfonos.disponible) vistos.push('mic');
  if (e.altavoces && e.altavoces.disponible) vistos.push('parlante');
  if (e.sensores && e.sensores.imu) vistos.push('imu');
  if (e.sensores && e.sensores.gnss) vistos.push('gnss');
  if (e.radios && e.radios.bluetooth) vistos.push('ble');
  if (e.radios && e.radios.nfc) vistos.push('nfc');
  return vistos;
}

/* Exportaciones para uso como módulo (las herramientas lo importan;
   el bundle de la app de KIMOS quita este bloque al incrustarlo). */
export { validarPack, cargarPacks, leerKrub, planDeRubro, rubrosViables, cumpleTolerancia, apiCompatible, RUBRO_PACK_API, fichaProspecto, registroParaCRM, guionVisita, calificar, integracionDe, ordenadas, resumen, rutaDeConexion, verificarCoherencia, diagnosticar, identificar, resolver, detectar, planSupervision, evaluarPersona, alcanceDeFuente, reglasDeRubro, distanciaMaxima, modelosViables, modelosDescartados, fuentesDisponibles, fuentePorId, eppPorId, estadoDeCapacidad, extensionesDisponibles, accesoriosQueHabilitan, soportePlataforma, resumenExtensiones, capacidadPorId, accesorioPorId, activar, evaluarExpediente, checklistPara, clasificar, rasgosDe, retencionDe, diasParaVigencia, economiaCartera, economiaModulo, SUPUESTOS_BASE, evaluar, auditar, CAP_POR_ID };
