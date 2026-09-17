/* GENERADO por apps/lidaria/build.mjs — no editar a mano.
   Fuente: src/unir.fuente.js + el motor de medición del núcleo 1.8.0.
   Se sirve como asset público: /api/apps/lidaria/asset/unir.js */
(function () {
"use strict";
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
  // `fps: null` es «todavía no se ha medido un segundo entero»; `fps: 0` es un
  // hecho, y uno malo. Confundirlos hacía que una captura de menos de un cuadro
  // por segundo se declarara utilizable.
  const fps = d.fps == null ? null : cifraCuerpo(d.fps, 0);
  const L = d.landmarks || null;
  const vistos = L ? L.filter((p) => p && (p.visibility == null || p.visibility > 0.5)).length : 0;
  const visibilidad = L && L.length ? vistos / L.length : 0;
  const problemas = [];
  if (fps === 0) problemas.push('Menos de un cuadro por segundo: el equipo no da para medir en vivo. Prueba el modelo ligero, baja la resolución o mide con una foto fija.');
  else if (fps != null && fps < 12) problemas.push('Menos de 12 cuadros por segundo: el movimiento se pierde entre cuadros.');
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


/**
 * unir.fuente.js — la página a la que lleva el QR. FUENTE (se compila).
 *
 * `build.mjs` la concatena con el motor de medición del núcleo y escribe
 * `assets/unir.js`. Así la geometría que usa el teléfono invitado es
 * EXACTAMENTE la misma que la del núcleo, sin una copia que se desincronice.
 *
 * Qué corrige esta versión, y conviene decirlo claro: hasta la 1.7.0 esta
 * página solo daba de alta el equipo —probaba la cámara un instante y enviaba
 * sus características—. El catálogo prometía «cámara de la sesión» y el
 * transporte que lo haría posible (`mqtt-ws`) **nunca se implementó**. No había
 * cliente MQTT, ni WebSocket, ni WebRTC en ninguna parte.
 *
 * Lo que sí se puede hacer sin montar infraestructura nueva, usando solo el
 * gateway que la plataforma ya expone: **el teléfono mide aquí mismo y envía el
 * RESULTADO**. La cámara no se transmite —eso necesitaría un broker que no
 * existe—, pero las medidas llegan a la sesión, que es para lo que se quería
 * el segundo teléfono.
 */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var API = (document.currentScript && document.currentScript.src || window.location.href).split('/api/apps/')[0];

  /* ------------------------------ utilidades ------------------------------ */

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function kv(clave, valor) {
    var d = el('div', 'kv');
    d.appendChild(el('span', null, clave));
    d.appendChild(el('b', null, valor));
    return d;
  }
  function limpiar() { while (app.firstChild) app.removeChild(app.firstChild); }
  function tarjeta() { var c = el('div', 'tarjeta'); app.appendChild(c); return c; }
  function error(titulo, detalle, pista) {
    limpiar();
    var c = tarjeta();
    c.appendChild(el('h1', null, titulo));
    c.appendChild(el('p', 'aviso', detalle));
    if (pista) c.appendChild(el('p', 'mini', pista));
    return c;
  }

  /* --------------------------- leer el código --------------------------- */

  function leerEnlacePagina(hash) {
    var m = String(hash || '').match(/[#?]l=([^&]+)/);
    if (!m) return null;
    var partes = m[1].split('.').map(function (x) {
      try { return decodeURIComponent(x); } catch (e) { return null; }
    });
    if (partes.length < 6 || partes.some(function (x) { return x === null; })) return null;
    if (partes[0] !== '1') return { versionRara: partes[0] };
    var extras = {};
    if (partes[6]) {
      partes[6].split('~').forEach(function (par) {
        var i = par.indexOf(':');
        if (i > 0) extras[par.slice(0, i)] = par.slice(i + 1);
      });
    }
    var min = Number(partes[5]);
    return {
      dispositivo: partes[1], codigo: partes[2], sesion: partes[3], transporte: partes[4],
      caduca: isFinite(min) && min > 0 ? new Date(min * 60000) : null,
      extras: extras,
      instancia: extras.i || partes[3] || '',
      // El montaje viaja en el código: lo declara quien lleva la sesión y así
      // todos los teléfonos que se unan miden con la misma referencia.
      montaje: {
        alturaCamara: Number(extras.h) || 140,
        inclinacion: Number(extras.t) || 0,
        fovH: Number(extras.f) || 70,
        aspecto: 16 / 9,
        alto: 240, ancho: 220, profundidad: 400, distanciaZona: 300,
      },
      montajeDeclarado: !!(extras.h || extras.f),
    };
  }

  /* ---------------------- qué puede hacer este equipo ---------------------- */

  function mirarEquipo() {
    var d = {
      plataforma: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios'
        : /Android/.test(navigator.userAgent) ? 'android' : 'escritorio',
      pantalla: (screen.width || 0) + 'x' + (screen.height || 0),
      nucleos: navigator.hardwareConcurrency || null,
      memoriaGB: navigator.deviceMemory || null,
      seguro: window.isSecureContext !== false,
      camaras: null, microfonos: null,
      imu: !!(window.DeviceMotionEvent || window.DeviceOrientationEvent),
      gnss: !!navigator.geolocation,
    };
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return Promise.resolve(d);
    return navigator.mediaDevices.enumerateDevices().then(function (lista) {
      d.camaras = lista.filter(function (x) { return x.kind === 'videoinput'; }).length;
      d.microfonos = lista.filter(function (x) { return x.kind === 'audioinput'; }).length;
      return d;
    }).catch(function () { return d; });
  }

  /* ---------------------------- inclinación real ---------------------------- */

  /**
   * Lee la inclinación del teléfono con su propio sensor.
   *
   * Es el error que más pesa en la medición: 1° a 2 m son 3,5 cm. En un
   * teléfono en la mano la inclinación cambia a cada momento, así que
   * declararla a mano no sirve — hay que leerla.
   */
  function vigilarInclinacion(alCambiar) {
    function manejar(ev) {
      // `beta` es el cabeceo: 0 = vertical, 90 = tumbado mirando al suelo.
      if (ev.beta == null) return;
      alCambiar(Math.round(90 - ev.beta));
    }
    function arrancar() {
      window.addEventListener('deviceorientation', manejar, true);
    }
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      // iOS exige pedirlo tras un gesto; si se niega, se sigue sin IMU.
      window.DeviceOrientationEvent.requestPermission().then(function (r) {
        if (r === 'granted') arrancar();
      }).catch(function () { /* sin IMU */ });
    } else if (window.DeviceOrientationEvent) {
      arrancar();
    }
    return function detener() { window.removeEventListener('deviceorientation', manejar, true); };
  }

  /* ------------------------------ la medición ------------------------------ */

  var FUENTES_MOTOR = {
    asset: {
      nombre: 'Servidor de KIMOS',
      modulo: API + '/api/apps/lidaria/asset/pose/vision_bundle.mjs',
      wasm: API + '/api/apps/lidaria/asset/pose/wasm',
      modelo: API + '/api/apps/lidaria/asset/pose/pose_landmarker_lite.task',
    },
    cdn: {
      nombre: 'Internet (jsDelivr)',
      modulo: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
      wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      modelo: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    },
  };

  /** Prueba las fuentes en orden y devuelve la primera que cargue. */
  function cargarMotor(orden) {
    var errores = [];
    function siguiente(i) {
      if (i >= orden.length) {
        return Promise.resolve({ ok: false, errores: errores });
      }
      var f = FUENTES_MOTOR[orden[i]];
      return import(f.modulo).then(function (mod) {
        if (!mod.FilesetResolver || !mod.PoseLandmarker) throw new Error('el módulo no expone PoseLandmarker');
        return mod.FilesetResolver.forVisionTasks(f.wasm).then(function (fileset) {
          return mod.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: f.modelo, delegate: 'GPU' },
            runningMode: 'VIDEO', numPoses: 1,
          });
        }).then(function (lm) { return { ok: true, lm: lm, fuente: f }; });
      }).catch(function (e) {
        errores.push(f.nombre + ': ' + e.message);
        return siguiente(i + 1);
      });
    }
    return siguiente(0);
  }

  function abrirCamara() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Este navegador no expone cámaras.'));
    }
    if (window.isSecureContext === false) {
      return Promise.reject(new Error('La cámara exige HTTPS. Esta página no está en contexto seguro.'));
    }
    var tam = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    return navigator.mediaDevices.getUserMedia({ video: Object.assign({ facingMode: { ideal: 'environment' } }, tam), audio: false })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: tam, audio: false }); })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: true, audio: false }); })
      .catch(function (e) {
        var n = String(e && e.name || '');
        var msg = {
          NotAllowedError: 'Permiso de cámara denegado. Acéptalo y vuelve a intentarlo.',
          NotFoundError: 'Este equipo no tiene cámara.',
          NotReadableError: 'La cámara está ocupada por otra aplicación. Ciérrala y reintenta.',
        };
        throw new Error(msg[n] || (e && e.message) || 'No se pudo abrir la cámara.');
      });
  }

  /* -------------------------------- pantallas -------------------------------- */

  function pintarInvitacion(enlace, def, equipo) {
    limpiar();
    var pub = (def && def.data) || {};
    var c = tarjeta();
    c.appendChild(el('h1', null, pub.titulo || 'Unirse a una sesión'));
    c.appendChild(el('p', 'mini', pub.descripcion || 'Este teléfono va a medir y enviar los resultados a la sesión.'));
    c.appendChild(el('h2', null, 'La sesión'));
    c.appendChild(kv('Código', enlace.codigo || '—'));
    if (pub.organizacion) c.appendChild(kv('Organización', pub.organizacion));
    if (enlace.caduca) c.appendChild(kv('El código caduca', enlace.caduca.toLocaleTimeString()));

    c.appendChild(el('h2', null, 'Este teléfono'));
    c.appendChild(kv('Tipo', equipo.plataforma));
    c.appendChild(kv('Cámaras', equipo.camaras == null ? 'se verá al abrirla' : String(equipo.camaras)));
    c.appendChild(kv('Sensor de inclinación', equipo.imu ? 'sí' : 'no'));
    c.appendChild(kv('HTTPS', equipo.seguro ? 'sí' : 'NO — la cámara no funcionará'));

    var c2 = tarjeta();
    c2.appendChild(el('h2', null, 'Qué va a pasar'));
    var ul = el('ul');
    [
      'Se abre la cámara de ESTE teléfono. El permiso es suyo: no se hereda del equipo que mostró el código.',
      'Se mide a la persona que esté delante, aquí mismo, dentro del navegador.',
      'Se envían los NÚMEROS a la sesión: distancia, estatura, alturas de trabajo. Nada más.',
      'La imagen NO se transmite ni se guarda. No sale de este teléfono.',
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    c2.appendChild(ul);

    if (!enlace.montajeDeclarado) {
      c2.appendChild(el('p', 'aviso', 'El código no trae el montaje de cámara declarado, así que los centímetros '
        + 'saldrán de valores supuestos y el error será mayor. Quien lleva la sesión puede declararlo en la pestaña Montaje y generar un código nuevo.'));
    }

    var boton = el('button', null, 'Abrir la cámara y medir');
    c2.appendChild(boton);
    var solo = el('button', 'sec', 'Solo darme de alta, sin medir');
    c2.appendChild(solo);

    boton.addEventListener('click', function () { pintarMidiendo(enlace, equipo); });
    solo.addEventListener('click', function () {
      solo.disabled = boton.disabled = true;
      enviar(enlace, equipo, null, null);
    });
  }

  function pintarMidiendo(enlace, equipo) {
    limpiar();
    var c = tarjeta();
    c.appendChild(el('h1', null, 'Midiendo'));
    var estado = el('p', 'mini', 'Abriendo la cámara…');
    c.appendChild(estado);

    var caja = el('div', 'camara');
    var video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.muted = true;
    var lienzo = document.createElement('canvas');
    caja.appendChild(video); caja.appendChild(lienzo);
    c.appendChild(caja);

    var lectura = el('div');
    c.appendChild(lectura);

    var cInc = tarjeta();
    cInc.appendChild(el('h2', null, 'Montaje de este teléfono'));
    cInc.appendChild(el('p', 'mini', 'La inclinación se lee del sensor; la altura del lente la pones tú. '
      + 'Es lo que más pesa en el resultado: 1° de error son 3,5 cm a 2 m.'));
    var filaAltura = el('label', null);
    filaAltura.appendChild(el('span', 'mini', 'Altura del lente sobre el suelo (cm)'));
    var inpAltura = document.createElement('input');
    inpAltura.type = 'number'; inpAltura.min = '30'; inpAltura.max = '250';
    inpAltura.value = String(enlace.montaje.alturaCamara);
    filaAltura.appendChild(inpAltura);
    cInc.appendChild(filaAltura);
    var infoInc = el('div');
    cInc.appendChild(infoInc);

    var montaje = Object.assign({}, enlace.montaje);
    var incLeida = null;
    inpAltura.addEventListener('input', function () {
      var v = Number(inpAltura.value);
      if (isFinite(v) && v > 20) montaje.alturaCamara = v;
    });
    var pararIMU = vigilarInclinacion(function (grados) {
      incLeida = grados;
      montaje.inclinacion = grados;
      infoInc.textContent = '';
      infoInc.appendChild(kv('Inclinación leída del sensor', grados + '°'));
    });
    if (!equipo.imu) {
      infoInc.appendChild(el('p', 'aviso', 'Este equipo no expone el sensor de inclinación: se usa '
        + enlace.montaje.inclinacion + '° del código. Sostén el teléfono lo más vertical que puedas.'));
    }

    var ultima = null;
    var boton = el('button', null, 'Enviar esta medida a la sesión');
    boton.disabled = true;
    c.appendChild(boton);
    var salir = el('button', 'sec', 'Cancelar');
    c.appendChild(salir);

    var vivo = true;
    var detenerTodo = function () {
      vivo = false;
      pararIMU();
      try { if (window.__lidStream) window.__lidStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* noop */ }
    };
    salir.addEventListener('click', function () { detenerTodo(); pintarInvitacion(enlace, null, equipo); });
    boton.addEventListener('click', function () {
      boton.disabled = true;
      detenerTodo();
      enviar(enlace, equipo, ultima, montaje);
    });

    abrirCamara().then(function (stream) {
      window.__lidStream = stream;
      video.srcObject = stream;
      return video.play().catch(function () {});
    }).then(function () {
      estado.textContent = 'Cargando el motor de medición…';
      // Primero el servidor de KIMOS: en una faena sin cobertura es la única
      // vía. Si no está ahí, se intenta internet.
      return cargarMotor(['asset', 'cdn']);
    }).then(function (motor) {
      if (!motor.ok) {
        estado.textContent = '';
        lectura.appendChild(el('p', 'aviso', 'No se pudo cargar el motor de medición. ' + motor.errores.join(' · ')));
        lectura.appendChild(el('p', 'mini', 'Se puede dar de alta el equipo igual: la cámara funciona, '
          + 'lo que falta es el modelo. Quien administra KIMOS puede dejarlo en el servidor con `node tools/descargar-pose.mjs`.'));
        boton.textContent = 'Darme de alta sin medir';
        boton.disabled = false;
        return;
      }
      estado.textContent = 'Ponte de frente, a unos 2 metros, y que se te vean los pies.';
      var ctx = lienzo.getContext('2d');
      var ultimoTs = -1, cuadros = 0, marca = performance.now(), fps = null;

      function bucle() {
        if (!vivo) return;
        var t = performance.now();
        if (video.readyState >= 2 && t - ultimoTs >= 33) {
          ultimoTs = t;
          var res = null;
          try { res = motor.lm.detectForVideo(video, t); } catch (e) { res = null; }
          var L = (res && res.landmarks && res.landmarks[0]) || null;
          cuadros++;
          if (t - marca >= 1000) { fps = Math.round(cuadros * 1000 / (t - marca)); cuadros = 0; marca = t; }

          var w = lienzo.width = video.videoWidth || 640;
          var h = lienzo.height = video.videoHeight || 480;
          ctx.clearRect(0, 0, w, h);
          var med = null;
          if (L) {
            med = medirCuerpo(L, montaje, {});
            ctx.fillStyle = med && med.ok ? '#16a34a' : '#f59e0b';
            for (var i = 0; i < L.length; i++) {
              var p = L[i];
              if (!p || (p.visibility != null && p.visibility <= 0.4)) continue;
              ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(3, w / 200), 0, 6.3); ctx.fill();
            }
          }
          var enc = encuadreDePose(L, 'completo', montaje);
          lectura.textContent = '';
          if (!L) {
            lectura.appendChild(el('p', 'mini', 'Sin persona en cuadro' + (fps == null ? '' : ' · ' + fps + ' fps')));
            boton.disabled = true;
          } else if (!enc.ok) {
            lectura.appendChild(el('p', 'aviso', enc.motivo));
            boton.disabled = true;
          } else if (!med || !med.ok) {
            lectura.appendChild(el('p', 'aviso', (med && med.motivo) || 'Sin medida'));
            boton.disabled = true;
          } else {
            ultima = med;
            lectura.appendChild(kv('Distancia', med.distancia.toFixed(0) + ' cm'));
            lectura.appendChild(kv('Estatura', med.altura == null ? 'no se ven los pies' : med.altura.toFixed(0) + ' cm'));
            lectura.appendChild(kv('Margen', '±' + med.errorCm.toFixed(0) + ' cm'));
            if (fps != null) lectura.appendChild(kv('Cuadros por segundo', String(fps)));
            boton.disabled = false;
            boton.textContent = 'Enviar esta medida a la sesión';
          }
        }
        requestAnimationFrame(bucle);
      }
      requestAnimationFrame(bucle);
    }).catch(function (e) {
      detenerTodo();
      var c3 = error('No se pudo medir', e.message,
        'Se puede dar de alta el equipo igual, para que la sesión sepa que existe.');
      var b = el('button', null, 'Darme de alta sin medir');
      c3.appendChild(b);
      b.addEventListener('click', function () { b.disabled = true; enviar(enlace, equipo, null, null); });
    });
  }

  function pintarUnido(enlace, equipo, med) {
    limpiar();
    var c = tarjeta();
    c.appendChild(el('h1', null, med ? '✅ Medida enviada' : '✅ Este equipo se unió'));
    c.appendChild(el('p', 'aviso ok', 'La sesión ' + (enlace.codigo || '') + ' ya lo tiene.'));
    if (med) {
      c.appendChild(el('h2', null, 'Lo que se envió'));
      c.appendChild(kv('Distancia', med.distancia.toFixed(0) + ' cm'));
      if (med.altura != null) c.appendChild(kv('Estatura', med.altura.toFixed(0) + ' cm'));
      c.appendChild(kv('Margen', '±' + med.errorCm.toFixed(0) + ' cm'));
      c.appendChild(el('p', 'mini', 'Solo los números. La imagen no salió de este teléfono.'));
    }
    var otra = el('button', null, med ? 'Medir a otra persona' : 'Medir ahora');
    c.appendChild(otra);
    otra.addEventListener('click', function () { pintarMidiendo(enlace, equipo); });
  }

  function enviar(enlace, equipo, med, montaje) {
    var carga = {
      codigo: String(enlace.codigo || ''),
      dispositivo: String(enlace.dispositivo || ''),
      plataforma: String(equipo.plataforma),
      pantalla: String(equipo.pantalla || ''),
      nucleos: String(equipo.nucleos || ''),
      camaras: String(equipo.camaras == null ? '' : equipo.camaras),
      imu: equipo.imu ? 'si' : 'no',
      seguro: equipo.seguro ? 'si' : 'no',
      agente: String(navigator.userAgent || '').slice(0, 150),
      _hp: '',
    };
    if (med && montaje) {
      carga.midio = 'si';
      carga.distanciaCm = String(Math.round(med.distancia));
      carga.estaturaCm = med.altura == null ? '' : String(Math.round(med.altura));
      carga.margenCm = String(Math.round(med.errorCm));
      carga.apoyo = String(med.apoyo || '');
      carga.hombrosCm = med.segmentos && med.segmentos.anchoHombros ? String(Math.round(med.segmentos.anchoHombros)) : '';
      carga.alturaHombroCm = med.alturas && med.alturas.hombro ? String(Math.round(med.alturas.hombro)) : '';
      carga.alturaCodoCm = med.alturas && med.alturas.codo ? String(Math.round(med.alturas.codo)) : '';
      carga.montajeAlturaCm = String(Math.round(montaje.alturaCamara));
      carga.montajeInclinacion = String(Math.round(montaje.inclinacion));
      carga.montajeFov = String(Math.round(montaje.fovH));
    } else {
      carga.midio = 'no';
    }
    fetch(API + '/api/public/app/' + encodeURIComponent(enlace.instancia) + '/submit/unir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(carga),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      pintarUnido(enlace, equipo, med);
    }).catch(function (e) {
      var c = error('No se pudo avisar a la sesión',
        'La medida se tomó bien; lo que falló fue el envío (' + e.message + ').',
        'Dicta el código ' + (enlace.codigo || '') + ' y los números a quien lleva la sesión.');
      if (med) {
        c.appendChild(kv('Distancia', med.distancia.toFixed(0) + ' cm'));
        if (med.altura != null) c.appendChild(kv('Estatura', med.altura.toFixed(0) + ' cm'));
      }
    });
  }

  /* -------------------------------- arranque -------------------------------- */

  var enlace = leerEnlacePagina(window.location.hash || window.location.search);
  if (!enlace) {
    error('Falta el código',
      'Esta página se abre escaneando el QR de una sesión de LiDARia; sola no hace nada.',
      'Vuelve a escanear, o pide el código corto de seis caracteres.');
    return;
  }
  if (enlace.versionRara) {
    error('Código de otra versión',
      'Lo generó una versión distinta de la app (formato ' + enlace.versionRara + ').',
      'Pide un código nuevo.');
    return;
  }
  if (enlace.caduca && enlace.caduca < new Date()) {
    error('El código caducó',
      'Los códigos valen quince minutos: van escritos en una pantalla a la vista, así que el plazo es lo que los protege.',
      'Pide uno nuevo. Se generan en un segundo.');
    return;
  }
  if (!enlace.instancia) {
    error('El código no dice a qué sesión unirse',
      'Le falta el identificador de la instancia.',
      'Pide un código nuevo: los generados con la app al día sí lo llevan.');
    return;
  }

  limpiar();
  app.appendChild(el('div', 'cargando', 'Buscando la sesión…'));

  Promise.all([
    fetch(API + '/api/public/app/' + encodeURIComponent(enlace.instancia) + '/definition')
      .then(function (r) {
        if (r.status === 403) throw new Error('cerrada');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
    mirarEquipo(),
  ]).then(function (res) {
    pintarInvitacion(enlace, res[0], res[1]);
  }).catch(function (e) {
    if (e.message === 'cerrada') {
      error('La sesión está cerrada',
        'Quien la lleva todavía no la ha abierto, o ya la cerró. El gateway responde 403 mientras no esté publicada.',
        'Pídele que pulse «Abrir sesión» en la pestaña Enlazar de LiDARia y vuelve a escanear.');
      return;
    }
    // Sin sesión se puede medir igual: lo que no se podrá es enviar el
    // resultado, y eso se dice cuando toque.
    mirarEquipo().then(function (equipo) {
      var c = error('No se pudo contactar con la sesión',
        'La página cargó, pero el servidor de KIMOS no respondió (' + e.message + ').',
        'Comprueba que este teléfono esté en la misma red que KIMOS.');
      c.appendChild(kv('Código para dictar', enlace.codigo || '—'));
      var b = el('button', null, 'Medir de todas formas');
      c.appendChild(b);
      b.addEventListener('click', function () { pintarMidiendo(enlace, equipo); });
    });
  });
})();

})();