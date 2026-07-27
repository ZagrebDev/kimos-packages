/**
 * Motor 3D de Gestión Avanzada de Productos.
 *
 * Portado del personalizador 3D (React Three Fiber) a three.js VANILLA para
 * que el mismo núcleo sirva en dos anfitriones muy distintos:
 *   1) la app de KIMOS, que corre sobre el React 18 del host y no puede
 *      traer su propia copia de React (por eso nada de R3F aquí);
 *   2) el theme de la tienda, que no tiene framework en absoluto.
 *
 * Es 100% data-driven: no conoce catálogo alguno. Recibe la definición del
 * modelo y el estado de la configuración desde fuera, así los pasos del
 * configurador de la app pueden manejarlo directamente.
 *
 * Uso:
 *   const viewer = createViewer(canvas, { background: null });
 *   await viewer.setModel({ url, rotation, parts: [...] });
 *   viewer.setFinishes([...]);
 *   viewer.setState({ colors: {partId: '#rrggbb'}, finishes: {partId: finishId}, hidden: {partId: true} });
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  Box3,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import * as THREE_NS from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { applyTriplanar } from './wood.js';
// Se reexporta desde aquí porque el motor es el único archivo del theme que
// pasa por un empaquetador: la ficha no puede importar módulos por su cuenta.
export { qrMatrix } from './qr.js';

const textureLoader = new TextureLoader();
const textureCache = new Map();

function loadTexture(url) {
  if (textureCache.has(url)) return textureCache.get(url);
  const p = new Promise((resolve, reject) => {
    textureLoader.load(url, (tex) => {
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.colorSpace = SRGBColorSpace;
      tex.needsUpdate = true;
      resolve(tex);
    }, undefined, reject);
  });
  textureCache.set(url, p);
  return p;
}

/** Sombra de contacto barata: un degradado radial en un plano bajo el producto. */
function makeContactShadow(w, d) {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.38)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const mesh = new Mesh(
    new PlaneGeometry(w || 4.5, d || 4.5),
    new MeshBasicMaterial({ map: new CanvasTexture(cv), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  return mesh;
}

// ── 8th Wall Engine (AR en vivo, sin marcador) ─────────────────────────────
// Carga el binario UNA vez por página. Es autoalojable y no llama a ningún
// servidor: se verificó arrancándolo con todos los hosts externos bloqueados.
let xr8Promise = null;
function cargarXR8(url, extrasUrl) {
  if (window.XR8 && window.XR8.XrController && window.XRExtras) return Promise.resolve(window.XR8);
  if (xr8Promise) return xr8Promise;
  xr8Promise = new Promise((resolve, reject) => {
    // XRExtras trae FullWindowCanvas, el módulo OFICIAL que mantiene el
    // canvas a pantalla completa. Gestionarlo a mano se intentó dos veces y
    // en GPU real acababa en pantalla negra: maneja seis eventos del pipeline
    // (orientación, tamaño del vídeo, del canvas, estado de la cámara…), no
    // un width/height.
    if (extrasUrl) {
      const x = document.createElement('script');
      x.src = extrasUrl;
      x.crossOrigin = 'anonymous';
      x.onerror = () => { xr8Promise = null; reject(new Error('No se pudo descargar XRExtras.')); };
      document.head.appendChild(x);
    }
    // El módulo Threejs de XR8 exige window.THREE: se le presta NUESTRA copia
    // (la misma versión con la que está montada la escena del producto).
    if (!window.THREE) window.THREE = THREE_NS;
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.crossOrigin = 'anonymous';
    // El SLAM viaja en un chunk aparte (xr-slam.js) junto al xr.js.
    s.setAttribute('data-preload-chunks', 'slam');
    s.setAttribute('data-chunk-base-url', url.replace(/[^/]*$/, ''));
    s.onerror = () => { xr8Promise = null; reject(new Error('No se pudo descargar el motor de AR.')); };
    document.head.appendChild(s);
    const espera = Date.now();
    const listo = () => {
      const extrasOk = !extrasUrl || window.XRExtras;
      if (window.XR8 && window.XR8.XrController && window.XR8.Threejs && extrasOk) return resolve(window.XR8);
      if (Date.now() - espera > 45000) { xr8Promise = null; return reject(new Error('El motor de AR no terminó de cargar.')); }
      setTimeout(listo, 200);
    };
    window.addEventListener('xrloaded', listo);
    listo();
  });
  return xr8Promise;
}

export function createViewer(canvas, options) {
  const opts = options || {};

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: opts.background == null,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new Scene();
  if (opts.background != null) scene.background = new Color(opts.background);

  const camera = new PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(0.6, 1.5, 3.2);

  // ── Estudio: luz ambiente + direccional + IBL procedural ──
  // RoomEnvironment es el equivalente vanilla del Environment/Lightformer de
  // drei: genera el entorno por código, sin descargar ningún HDRI.
  scene.add(new AmbientLight(0xffffff, 0.5));
  const dir = new DirectionalLight(0xffffff, 1.2);
  dir.position.set(3, 6, 4);
  scene.add(dir);
  let envRT = null;
  try {
    const pmrem = new PMREMGenerator(renderer);
    envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();
  } catch (e) { /* sin IBL: quedan la ambiente y la direccional */ }

  // Tarima circular + sombra de contacto.
  const podium = new Mesh(
    new CircleGeometry(2.4, 64),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
  );
  podium.rotation.x = -Math.PI / 2;
  podium.position.y = -0.005;
  if (opts.podium !== false) {
    scene.add(podium);
    scene.add(makeContactShadow());
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.target.set(0, 0.9, 0);

  const root = new Group();
  scene.add(root);

  // Estado externo (lo maneja la app / el theme).
  let modelDef = null;          // { url, rotation, mirror, parts: [...] }
  let finishDefs = [];          // catálogo de acabados disponibles
  let state = { colors: {}, finishes: {}, hidden: {} };
  let partByMaterial = new Map();
  let disposed = false;
  let needsRender = true;
  let enAR = false;   // sesión de realidad aumentada en curso

  const invalidate = () => { needsRender = true; };
  controls.addEventListener('change', invalidate);

  // ── Bucle de render bajo demanda ──
  // Solo dibuja cuando algo cambió o mientras el damping sigue moviendo la
  // cámara: en un panel de administración eso es prácticamente 0% de CPU en
  // reposo (el personalizador usa frameloop="demand" por lo mismo).
  function tick() {
    // Durante la sesión de AR manda el bucle del compositor
    // (`setAnimationLoop`). Este bucle NO puede seguir vivo: dibujar sobre el
    // framebuffer de XR fuera de su frame hace que el navegador corte la
    // sesión — el síntoma era que la cámara se abría y se cerraba sola. Se
    // deja morir aquí y se vuelve a arrancar al salir.
    if (disposed || enAR) return;
    requestAnimationFrame(tick);
    const moved = controls.update();
    if (!needsRender && !moved) return;
    needsRender = false;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  resize();

  /** Normaliza el conjunto (centrado, apoyado en y=0, ~2 unidades) y encuadra. */
  function frame() {
    root.scale.setScalar(1);
    root.position.set(0, 0, 0);
    const box = new Box3().setFromObject(root);
    if (!isFinite(box.min.x)) return;
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const k = 2 / Math.max(size.x, size.y, size.z, 1e-6);
    root.scale.setScalar(k);
    root.position.set(-center.x * k, -box.min.y * k, -center.z * k);

    // Distancia según la esfera envolvente y el FOV más restrictivo (vertical
    // u horizontal): el producto entra completo en cualquier aspecto, incluso
    // en viewports muy angostos.
    const radius = size.length() * k * 0.5;
    const centerY = (size.y * k) / 2;
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const distance = (radius * 1.15) / Math.sin(Math.min(vfov, hfov) / 2);
    const target = new Vector3(0, centerY, 0);
    const d = camera.position.clone().sub(controls.target);
    if (d.lengthSq() < 1e-6) d.set(0.5, 0.35, 1);
    camera.position.copy(target.clone().add(d.normalize().multiplyScalar(distance)));
    controls.target.copy(target);
    controls.update();
    invalidate();
  }

  /** Aplica color / acabado / visibilidad a cada malla según su parte. */
  async function applyState() {
    if (!root.children.length || !modelDef) return;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    // Precargar las texturas de los acabados en uso.
    const needed = new Set();
    (modelDef.parts || []).forEach((part) => {
      const fid = state.finishes[part.id] != null ? state.finishes[part.id] : part.defaultFinish;
      const f = finishDefs.find((x) => x.id === fid);
      if (f && f.texture) needed.add(f.texture);
    });
    const texByUrl = new Map();
    await Promise.all(Array.from(needed).map((u) =>
      loadTexture(u).then((t) => texByUrl.set(u, t)).catch(() => {})));
    if (disposed) return;

    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const material = obj.material;
      if (!material || !material.name) return;
      const part = partByMaterial.get(material.name);
      if (!part) return;

      // Visibilidad por parte (pasos que agregan o quitan piezas).
      obj.visible = !state.hidden[part.id];

      const fid = state.finishes[part.id] != null ? state.finishes[part.id] : part.defaultFinish;
      const finish = finishDefs.find((x) => x.id === fid);
      if (finish) {
        const tex = finish.texture ? texByUrl.get(finish.texture) : null;
        if (tex) {
          if (finish.triplanar !== false) {
            // Una parte puede tener piezas cuya veta corre A LO LARGO en vez
            // de vertical (ej. el travesaño de una mesa frente a sus patas):
            // esos materiales anulan grainVertical y el ángulo.
            const along = (part.grainAlongMaterials || []).indexOf(material.name) !== -1;
            applyTriplanar(material, tex, {
              scale: finish.textureScale != null ? finish.textureScale : 1,
              grain: finish.grain != null ? finish.grain : 0,
              vertical: !along && part.grainVertical === true,
              angle: along ? 0 : (part.grainAngle || 0),
              opacity: finish.opacity != null ? finish.opacity : 1,
              plyAxis: obj.userData.plyAxis || null,
              plySpacing: finish.plySpacing,
              // Relieve del grano: APAGADO salvo que el acabado lo pida
              // (finish.bump). Se probó derivarlo de `grain` y en GPU real
              // la madera salía en mosaico de ruido — el harness con
              // SwiftShader lo mostraba "aceptable" y mintió. Si un producto
              // lo quiere, que lo declare y se valide en un teléfono.
              bump: finish.bump != null ? finish.bump : 0,
            });
          } else {
            material.map = tex;
            material.needsUpdate = true;
          }
        }
        if (finish.color) material.color.set(finish.color);
        material.roughness = finish.roughness != null ? finish.roughness : 0.8;
        // Cuánto refleja del entorno: los acabados satinados (carbonizado,
        // lacas) ganan con algo más; los crudos, con menos.
        material.envMapIntensity = finish.envIntensity != null ? finish.envIntensity : 1;
      } else {
        // Color libre. Las texturas base vienen casi blancas, así que
        // multiplicar el color conserva el detalle del tejido/material.
        const c = state.colors[part.id] || part.defaultColor;
        if (c) material.color.set(c);
        material.roughness = part.roughness != null ? part.roughness : 0.85;
      }
      [material.map, material.normalMap].forEach((t) => {
        if (t && t.anisotropy < maxAniso) { t.anisotropy = maxAniso; t.needsUpdate = true; }
      });
      material.metalness = 0;
      material.side = DoubleSide;
    });
    invalidate();
  }

  function clearRoot() {
    while (root.children.length) {
      const c = root.children.pop();
      c.traverse((o) => {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m && m.dispose && m.dispose());
        }
      });
    }
  }

  /** Carga el GLB y lo deja listo. `def.parts` mapea material→parte. */
  async function setModel(def) {
    modelDef = def || null;
    clearRoot();
    if (!def || !def.url) { invalidate(); return; }
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(def.url);
    if (disposed) return;
    const obj = gltf.scene;
    if (def.rotation) obj.rotation.set(def.rotation[0] || 0, def.rotation[1] || 0, def.rotation[2] || 0);
    if (def.mirror) obj.scale.set(-1, 1, 1);
    root.add(obj);

    mapearPartes(def.parts);
    frame();
    await applyState();
  }

  function mapearPartes(parts) {
    partByMaterial = new Map();
    (parts || []).forEach((part) => {
      (part.materials || []).forEach((m) => partByMaterial.set(m, part));
    });
  }

  /**
   * Cambia las PARTES (colores por defecto, rugosidad, veta, qué materiales
   * agrupa cada una) sin volver a descargar el .glb. Editar un color no toca
   * la geometría, y recargar el modelo por eso hacía desaparecer la pieza y
   * mostrar "Cargando…" en cada tecla del selector de color.
   */
  function setParts(parts) {
    if (!modelDef) return Promise.resolve();
    modelDef = Object.assign({}, modelDef, { parts: parts || [] });
    mapearPartes(parts);
    return applyState();
  }

  /** Nombres de material presentes en el GLB — para mapear partes en el editor. */
  function materialNames() {
    const out = new Set();
    root.traverse((o) => { if (o.isMesh && o.material && o.material.name) out.add(o.material.name); });
    return Array.from(out).sort();
  }

  // ── Realidad aumentada (WebXR) ────────────────────────────────────────────
  // Ver el producto configurado apoyado en el suelo real, a tamaño real, con
  // la cámara del teléfono. Se reutiliza EL MISMO `root` que ya tiene los
  // materiales y acabados elegidos: lo que el cliente ve en AR es exactamente
  // la configuración que va a comprar.
  //
  // Solo Android/Chrome y navegadores con WebXR `immersive-ar`. iOS no lo
  // soporta (Safari usa AR Quick Look con archivos .usdz, que es otro
  // formato); por eso `arSupported()` responde false ahí y el botón no se
  // muestra en vez de fallar al pulsarlo.
  let arSession = null;
  let arReticle = null;
  let arHitSource = null;
  let arPlaced = false;
  let arPrev = null;
  let arFallo = null;   // motivo por el que la sesión se cortó, si lo hubo
  // Traza de lo que ocurrió al abrir AR. En un móvil no hay consola donde
  // mirar, así que el dato tiene que poder enseñarse en la propia ficha: sin
  // esto, "se cerró sola" es indistinguible de media docena de causas.
  let arTraza = null;

  async function arSupported() {
    try {
      if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
      return await navigator.xr.isSessionSupported('immersive-ar');
    } catch (e) { return false; }
  }

  /**
   * Abre la sesión de AR.
   * @param {{realSizeCm?: number, overlay?: Element, onPlace?: Function, onEnd?: Function}} o
   *   realSizeCm — medida real del lado más largo del producto. `frame()` deja
   *   el modelo normalizado a 2 unidades, así que de aquí sale la escala para
   *   que en el suelo mida lo que mide de verdad. Sin este dato el objeto
   *   aparecería del tamaño arbitrario del archivo.
   */
  async function startAR(o) {
    const cfg = o || {};
    if (arSession) return arSession;
    if (!root.children.length) throw new Error('No hay modelo cargado.');
    // NO se vuelve a preguntar por el soporte aquí: `isSessionSupported` es
    // asíncrono y esperarlo puede consumir la activación transitoria del clic,
    // y sin gesto del usuario `requestSession` se rechaza. Quien llama ya lo
    // comprobó para decidir si pintaba el botón.

    // `hit-test` va en OPCIONALES, no en requeridas: pedirlo como requisito
    // hace fallar la sesión entera en los dispositivos que no lo traen, y sin
    // él la experiencia sigue siendo útil (el producto aparece delante, solo
    // que no se ancla al suelo detectado).
    const init = { optionalFeatures: ['hit-test', 'dom-overlay', 'light-estimation'] };
    if (cfg.overlay) init.domOverlay = { root: cfg.overlay };
    const session = await navigator.xr.requestSession('immersive-ar', init);

    // Estado que hay que devolver tal cual al salir: el visor de escritorio
    // sigue vivo detrás y no puede quedar con la tarima quitada ni la escala
    // real puesta.
    arPrev = {
      scale: root.scale.clone(),
      position: root.position.clone(),
      visible: root.visible,
      podium: podium.visible,
      background: scene.background,
      env: scene.environment,
      xrEnabled: renderer.xr.enabled,
    };

    const realM = Math.max(0, Number(cfg.realSizeCm) || 0) / 100;
    const arScale = realM > 0 ? realM / 2 : 1; // frame() normaliza a 2 unidades

    scene.background = null;
    podium.visible = false;
    // El producto se ve DESDE EL PRIMER INSTANTE, delante de la cámara. Antes
    // se mantenía oculto hasta tocar una superficie detectada, y como detectar
    // el suelo tarda unos segundos —y en algunos dispositivos no llega nunca—
    // la experiencia se abría en negro sobre la cámara: parecía rota. Al tocar
    // se recoloca en el suelo real, que es la mejora, no el requisito.
    root.visible = true;
    root.scale.setScalar(arPrev.scale.x * arScale);
    root.position.set(0, -0.4, -1.2);   // a un paso y medio, a la altura del suelo
    arPlaced = false;

    if (!arReticle) {
      // Anillo plano que marca dónde se apoyaría el producto.
      arReticle = new Mesh(
        new RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
        new MeshBasicMaterial({ color: 0xffffff }),
      );
      arReticle.matrixAutoUpdate = false;
      arReticle.visible = false;
      scene.add(arReticle);
    }

    // Espacio de referencia. La norma dice que 'local' está siempre en una
    // sesión inmersiva, pero hay dispositivos que lo rechazan de plano
    // ("This device does not support the requested reference space type") y
    // eso tumbaba la sesión entera. Se prueban por orden de preferencia:
    // 'local-floor' da la altura real del suelo, 'local' vale igual, y
    // 'viewer' es el último recurso (todo queda pegado a la cámara).
    arTraza = { espacio: '', hitTest: false, sesion: false, frames: 0 };
    let localSpace = null;
    for (const tipo of ['local-floor', 'local', 'unbounded', 'viewer']) {
      try { localSpace = await session.requestReferenceSpace(tipo); arTraza.espacio = tipo; break; }
      catch (e) { /* ese no; se prueba el siguiente */ }
    }
    if (!localSpace) {
      try { session.end(); } catch (e) { /* ya cerrada */ }
      throw new Error('Este dispositivo no ofrece ningún espacio de referencia utilizable para AR.');
    }

    // El hit-test es opcional: si el dispositivo no lo trae, no se aborta la
    // sesión — simplemente no habrá retículo ni anclaje al suelo.
    let hitOk = false;
    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      arHitSource = await session.requestHitTestSource({ space: viewerSpace });
      hitOk = !!arHitSource;
      arTraza.hitTest = hitOk;
    } catch (e) { arHitSource = null; }

    // Tocar la pantalla = colocar (o recolocar) el producto donde apunta el
    // retículo, orientado como esté el retículo sobre esa superficie.
    const onSelect = () => {
      if (!arReticle || !arReticle.visible) return;   // sin suelo detectado, se queda donde está
      arPlaced = true;
      root.position.setFromMatrixPosition(arReticle.matrix);
      if (typeof cfg.onPlace === 'function') cfg.onPlace();
    };
    session.addEventListener('select', onSelect);

    const onEnd = () => {
      session.removeEventListener('select', onSelect);
      if (arHitSource && arHitSource.cancel) { try { arHitSource.cancel(); } catch (e) {} }
      arHitSource = null;
      arSession = null;
      if (arReticle) arReticle.visible = false;
      if (arPrev) {
        root.scale.copy(arPrev.scale);
        root.position.copy(arPrev.position);
        root.visible = arPrev.visible;
        podium.visible = arPrev.podium;
        scene.background = arPrev.background;
        scene.environment = arPrev.env;
        renderer.xr.enabled = arPrev.xrEnabled;
        arPrev = null;
      }
      renderer.setAnimationLoop(null);
      enAR = false;
      resize();
      invalidate();
      requestAnimationFrame(tick); // vuelve el bucle bajo demanda de escritorio
      const motivo = arFallo; arFallo = null;
      const traza = arTraza; arTraza = null;
      if (typeof cfg.onEnd === 'function') cfg.onEnd(motivo, traza);
    };
    session.addEventListener('end', onEnd);

    renderer.xr.enabled = true;
    // Se marca ANTES de entregar la sesión: en cuanto three toma el control
    // el bucle de escritorio tiene que estar ya fuera de juego.
    enAR = true;

    // El bucle se instala ANTES de entregar la sesión. Si se instala después,
    // entre una cosa y otra hay frames en los que nadie dibuja, y el navegador
    // cierra las sesiones que no entregan imagen.
    renderer.setAnimationLoop((t, frameXR) => {
      try {
        if (frameXR && arHitSource && hitOk) {
          const hits = frameXR.getHitTestResults(arHitSource);
          if (hits.length) {
            const pose = hits[0].getPose(localSpace);
            if (pose) {
              arReticle.visible = true;
              arReticle.matrix.fromArray(pose.transform.matrix);
            }
          } else arReticle.visible = false;
        } else if (arReticle) arReticle.visible = false;
        renderer.render(scene, camera);
        arTraza.frames++;
      } catch (e) {
        // Una excepción por frame deja la sesión en negro o hace que el
        // navegador la corte, y sin esto el motivo no aparece por ningún
        // lado. Se guarda para contarlo al salir y se para el bucle.
        arFallo = (e && e.message) || String(e);
        renderer.setAnimationLoop(null);
        try { session.end(); } catch (e2) { /* ya cerrada */ }
      }
    });

    await renderer.xr.setSession(session);
    arSession = session;
    arTraza.sesion = true;

    return { end: () => session.end() };
  }

  // ── AR en iPhone: exportar la configuración actual a USDZ ────────────────
  // Safari no tiene WebXR: usa AR Quick Look, que consume archivos .usdz. Se
  // genera EN EL NAVEGADOR desde la escena tal como está configurada, así que
  // el cliente ve en su suelo exactamente los acabados que acaba de elegir y
  // no hace falta ningún convertidor en el servidor.
  //
  // Tres cosas de USDZ obligan a construir una copia en vez de exportar `root`
  // tal cual:
  //   · No admite escalas negativas, y `mirror` se aplica como scale(-1,1,1).
  //     Se hornea la matriz del mundo en los vértices y se invierte el orden
  //     de los triángulos, que es lo que el espejo deja del revés.
  //   · No admite materiales a dos caras (aquí todo es DoubleSide).
  //   · Solo entiende propiedades estándar: el sombreado triplanar de la veta
  //     es GLSL inyectado, y NO sobrevive. Por eso `textures` viene apagado
  //     por defecto — con la textura puesta sobre las UVs del CAD la madera
  //     sale peor que con el tinte plano del acabado.
  function visibleEnCadena(obj) {
    for (let n = obj; n && n !== scene; n = n.parent) if (!n.visible) return false;
    return true;
  }
  // ¿El orden de los triángulos concuerda con las normales del archivo?
  // No se puede deducir del determinante de la matriz: además del espejo, hay
  // GLB (este entre ellos) que ya vienen con el winding invertido respecto a
  // sus normales. En el visor no se nota porque todo se dibuja a dos caras,
  // pero Quick Look dibuja a UNA y el modelo saldría hueco. Así que en vez de

  /**
   * Copia exportable de la escena, a escala real y apoyada en el suelo.
   * La comparten USDZ (iPhone) y GLB (Android): las dos vías consumen un
   * ARCHIVO, no la escena viva, y las dos necesitan lo mismo —espejo horneado,
   * una sola cara, materiales estándar y la medida real en metros.
   * Devuelve { grupo, temporales } y quien la use debe liberar `temporales`.
   */
  /**
   * Hornea la proyección triplanar como coordenadas UV.
   *
   * El sombreado de la veta es GLSL propio y NO sobrevive a un archivo: por eso
   * el .usdz de iPhone salía sin textura y la madera parecía plástico. Aquí se
   * reproduce la MISMA proyección del shader, pero escribiéndola en el atributo
   * `uv` de la geometría: cada triángulo se proyecta sobre el plano de su eje
   * dominante, exactamente como hace `woodTriplanar()`.
   *
   * Hace falta desindexar: dos triángulos que compartan un vértice pueden caer
   * en ejes distintos y necesitan UV distintas para el mismo punto.
   */
  function hornearUVTriplanar(geo, wood) {
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    if (!pos || !nor) return geo;
    const escala = wood.scale ? wood.scale.value : 1;
    const vertical = wood.vertical && wood.vertical.value ? 1 : 0;
    const angulo = wood.angle ? wood.angle.value : 0;
    const uv = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
      // El eje se elige con la normal DEL VÉRTICE, no la de la cara. Da el
      // mismo reparto —en una malla con aristas vivas los vértices ya están
      // duplicados por cara— y evita desindexar, que triplicaba los datos y
      // dejaba el .usdz en 8 MB.
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
      const eje = nx >= ny && nx >= nz ? 0 : (ny >= nz ? 1 : 2);
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      let s, tt;
      if (eje === 0) { s = vertical ? z : y; tt = vertical ? y : z; }          // uvX
      else if (eje === 1) { s = z; tt = x; }                                    // uvY
      else {                                                                   // uvZ, con el giro de los cantos
        s = vertical ? x : y; tt = vertical ? y : x;
        const a = angulo * Math.sign(x || 1);
        const ca = Math.cos(a), sa = Math.sin(a);
        const s2 = ca * s - sa * tt;
        tt = sa * s + ca * tt;
        s = s2;
      }
      uv[i * 2] = s * escala;
      uv[i * 2 + 1] = tt * escala;
    }
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
    return geo;
  }

  /**
   * Duplica cada triángulo con el orden invertido, para que la pieza se vea
   * desde las dos caras.
   *
   * Hace falta porque el exportador de USDZ IGNORA `DoubleSide` —solo emite un
   * aviso— y el visor del móvil dibuja a una cara: con las normales del .glb
   * mirando hacia adentro, descarta justo lo que se ve de frente y el producto
   * aparece en trozos. Deducir la orientación no sirve: se intentó comparando
   * cada cara con el centro de su malla y volteó piezas que estaban bien, con
   * lo que el taburete salió del revés. Duplicar no adivina nada.
   *
   * Cuesta el doble de triángulos. En glTF no se usa: ahí `doubleSided` sí
   * existe y el exportador lo escribe.
   */
  function duplicarCarasInvertidas(geo) {
    const idx = geo.getIndex();
    if (idx) {
      // Con índice basta con AÑADIR los mismos triángulos al revés: los
      // vértices se comparten y el archivo casi no crece. Desindexar para
      // duplicar costaba 14 MB en el .usdz del taburete; así se queda en 5.
      const a = idx.array;
      const n = a.length;
      const nuevoIdx = new (a.constructor)(n * 2);
      nuevoIdx.set(a, 0);
      for (let i = 0; i + 2 < n; i += 3) {
        nuevoIdx[n + i] = a[i + 2];
        nuevoIdx[n + i + 1] = a[i + 1];
        nuevoIdx[n + i + 2] = a[i];
      }
      geo.setIndex(new BufferAttribute(nuevoIdx, 1));
      return geo;
    }
    // Sin índice hay que copiar los atributos, permutando cada triángulo.
    const salida = geo.clone();
    for (const nombre of Object.keys(geo.attributes)) {
      const at = geo.getAttribute(nombre);
      const s = at.itemSize;
      const src = at.array;
      const dst = new src.constructor(src.length * 2);
      dst.set(src, 0);
      const base = src.length / s;
      for (let i = 0; i < at.count; i += 3) {
        for (let k = 0; k < s; k++) {
          dst[(base + i) * s + k] = src[(i + 2) * s + k];
          dst[(base + i + 1) * s + k] = src[(i + 1) * s + k];
          dst[(base + i + 2) * s + k] = src[i * s + k];
        }
      }
      salida.setAttribute(nombre, new BufferAttribute(dst, s));
    }
    return salida;
  }

  /**
   * Pasa los atributos a Float32 sin normalizar.
   *
   * Los .glb con KHR_mesh_quantization traen las posiciones como Int16
   * normalizado: valores enteros que representan el rango [-1, 1], y la escala
   * real vive en la matriz del nodo. Si se le aplica esa matriz al atributo
   * TAL CUAL, three vuelve a guardar el resultado como Int16 normalizado y todo
   * lo que caiga fuera de [-1, 1] se RECORTA. El modelo no se rompe del todo:
   * se achata contra las paredes de ese cubo y aparece como una suma de planos
   * — que es exactamente cómo se veía el taburete en el móvil.
   */
  function aFloat32(geo) {
    for (const nombre of Object.keys(geo.attributes)) {
      const at = geo.getAttribute(nombre);
      if (at.array instanceof Float32Array && !at.normalized) continue;
      const s = at.itemSize;
      const out = new Float32Array(at.count * s);
      for (let i = 0; i < at.count; i++) {
        // getX/getY/… deshacen la normalización, así que sale el valor real.
        out[i * s] = at.getX(i);
        if (s > 1) out[i * s + 1] = at.getY(i);
        if (s > 2) out[i * s + 2] = at.getZ(i);
        if (s > 3) out[i * s + 3] = at.getW(i);
      }
      geo.setAttribute(nombre, new BufferAttribute(out, s));
    }
    return geo;
  }

  function escenaExportable(cfg) {
    if (!root.children.length) throw new Error('No hay modelo cargado.');
    root.updateMatrixWorld(true);

    const salida = new Group();
    const temporales = [];
    root.traverse((obj) => {
      if (!obj.isMesh || !visibleEnCadena(obj)) return;
      const geo = aFloat32(obj.geometry.clone());
      geo.applyMatrix4(obj.matrixWorld);           // hornea posición, giro y espejo
      // El espejo invierte el orden de los triángulos, pero el archivo puede
      // traerlo ya invertido de fábrica: se mide el resultado en vez de
      // deducirlo, y se corrige solo si hace falta.
      // Ni se corrige el orden ni se adivina la orientación: se dibujan las
      // dos caras, igual que hace el visor de la web —que es el que se ve
      // bien—. Ver `duplicarCarasInvertidas`.
      const src = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      const color = src && src.color ? src.color.clone() : new Color(0xffffff);
      // Veta: si esta pieza lleva triplanar, se hornea a UV y la textura viaja
      // en el archivo. Es lo que faltaba para que en iPhone se viera madera.
      const wood = src && src.userData && src.userData.wood;
      const mapa = wood && wood.map && wood.map.value ? wood.map.value : (src && src.map) || null;
      // Un acabado con textura suele llevar color BLANCO, porque el tono lo
      // pone la imagen y el color solo la tiñe. Sin textura eso sale blanco
      // roto — la madera "Natural" aparecía como plástico claro. Si la parte
      // declara un color propio, se usa ese: es su tono real.
      if (mapa && wood && cfg.textures !== false) hornearUVTriplanar(geo, wood);
      if (!mapa && src && src.map) {
        const parte = partByMaterial.get(src.name);
        const propio = parte && (parte.defaultColor || '');
        const casiBlanco = color.r > 0.9 && color.g > 0.9 && color.b > 0.9;
        if (propio && casiBlanco) color.set(propio);
      }
      const mat = new MeshStandardMaterial({
        color: color,
        roughness: src && src.roughness != null ? src.roughness : 0.85,
        metalness: 0,
        side: DoubleSide,
      });
      if (mapa && cfg.textures !== false) mat.map = mapa;
      // glTF sabe decir "a dos caras"; USDZ no, y hay que duplicarlas.
      const geoFinal = cfg.duplicarCaras ? duplicarCarasInvertidas(geo) : geo;
      const m = new Mesh(geoFinal, mat);
      salida.add(m);
      temporales.push(geoFinal, mat);
      if (geoFinal !== geo) geo.dispose();
    });
    if (!salida.children.length) throw new Error('No hay nada visible que exportar.');

    // Tamaño real: tanto USDZ como glTF se interpretan en METROS, y el visor
    // del sistema apoya el objeto tal cual. Sin la medida real saldría del
    // tamaño arbitrario del encuadre — en el caso del Hanoi, 50 metros.
    const box = new Box3().setFromObject(salida);
    const size = box.getSize(new Vector3());
    const mayor = Math.max(size.x, size.y, size.z, 1e-6);
    const realM = Math.max(0, Number(cfg.realSizeCm) || 0) / 100;
    if (realM > 0) salida.scale.setScalar(realM / mayor);
    salida.updateMatrixWorld(true);
    // Apoyado en el suelo y centrado: así aparece donde el usuario apunta.
    const box2 = new Box3().setFromObject(salida);
    const c2 = box2.getCenter(new Vector3());
    salida.position.set(-c2.x, -box2.min.y, -c2.z);
    return { grupo: salida, temporales };
  }

  /** .usdz para AR Quick Look (iPhone/iPad, cualquier navegador). */
  async function exportUSDZ(o) {
    const { grupo, temporales } = escenaExportable(Object.assign({ duplicarCaras: true }, o || {}));
    try {
      // 1024 px basta para una veta y evita que el archivo se dispare: sin
      // tope, la textura sola pesaba 1,8 MB y el .usdz pasaba de 8 MB, que en
      // datos móviles es una descarga que nadie espera.
      const buf = await new USDZExporter().parseAsync(grupo, { maxTextureSize: 1024 });
      return new Blob([buf], { type: 'model/vnd.usdz+zip' });
    } finally {
      temporales.forEach((t) => t && t.dispose && t.dispose());
    }
  }

  /**
   * .glb a escala real para Google Scene Viewer (Android, cualquier
   * navegador). Scene Viewer lo abre el sistema mediante un intent, así que
   * necesita una URL pública: este archivo se sube desde la app y se publica.
   */
  async function exportGLB(o) {
    const { grupo, temporales } = escenaExportable(o || {});
    try {
      const buf = await new GLTFExporter().parseAsync(grupo, { binary: true });
      return new Blob([buf], { type: 'model/gltf-binary' });
    } finally {
      temporales.forEach((t) => t && t.dispose && t.dispose());
    }
  }

  /**
   * AR EN VIVO con el motor de 8th Wall: la cámara del teléfono en un canvas
   * propio y ENCIMA el producto tal como está configurado — es el mismo
   * `root` del visor, movido a la escena del AR y devuelto al salir, así que
   * cambia de color con el configurador sin regenerar nada.
   *
   * Markerless: el SLAM del binario ancla el mundo; el producto se apoya en
   * el suelo (y=0) a su tamaño real, delante del punto de partida. Un toque
   * lo recoloca delante de donde se esté mirando (recenter).
   */
  async function startLiveAR(cfg) {
    const o = cfg || {};
    if (!o.canvas) throw new Error('startLiveAR necesita un canvas propio.');
    if (!root.children.length) throw new Error('No hay modelo cargado.');
    const XR8 = await cargarXR8(o.xrUrl, o.xrExtrasUrl);
    if (enAR) throw new Error('Ya hay una sesión de AR abierta.');

    // En iOS los sensores de movimiento piden permiso explícito, y solo se
    // puede pedir dentro de un gesto del usuario — por eso aquí, no en run().
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        await DeviceMotionEvent.requestPermission();
      }
    } catch (e) { /* denegado: XR8 lo reportará por su lado */ }

    const realM = Math.max(0, Number(o.realSizeCm) || 0) / 100;
    const escala = realM > 0 ? realM / 2 : 1;   // frame() normaliza a 2 unidades
    const padre = root.parent;
    const prevPos = root.position.clone();
    const prevScale = root.scale.clone();
    let contenedor = null;
    let vivo = true;
    enAR = true;

    const terminar = () => {
      if (!vivo) return;
      vivo = false;
      try { clearTimeout(vigilante); } catch (e) { /* aún sin armar */ }
      o.canvas.removeEventListener('touchstart', alTocar);
      o.canvas.removeEventListener('touchmove', alMover);
      o.canvas.removeEventListener('touchend', alSoltar);
      o.canvas.removeEventListener('touchcancel', alSoltar);
      try { XR8.stop(); } catch (e) { /* ya parada */ }
      try { XR8.clearCameraPipelineModules(); } catch (e) { /* sin limpiar */ }
      // El producto vuelve a la escena del visor tal como estaba.
      if (contenedor) contenedor.remove(root);
      if (padre) padre.add(root);
      root.position.copy(prevPos);
      root.scale.copy(prevScale);
      enAR = false;
      invalidate();
      requestAnimationFrame(tick);
      if (typeof o.onEnd === 'function') o.onEnd();
    };

    const modulos = [
      XR8.GlTextureRenderer.pipelineModule(),   // pinta la cámara
      XR8.Threejs.pipelineModule(),             // escena three.js sobre ella
      XR8.XrController.pipelineModule(),        // SLAM
    ];
    // Canvas a pantalla completa: SIEMPRE el módulo oficial si está.
    if (window.XRExtras && window.XRExtras.FullWindowCanvas) {
      modulos.push(window.XRExtras.FullWindowCanvas.pipelineModule());
    }
    // Captura de foto (cámara + producto compuestos por el motor).
    if (XR8.CanvasScreenshot) {
      modulos.push(XR8.CanvasScreenshot.pipelineModule());
    }
    modulos.push(
      {
        name: 'kimos-producto',
        onAttach: () => {
          // FullWindowCanvas saca el canvas de su capa y lo cuelga del
          // <body> como bloque EN FLUJO: en una ficha llena de contenido
          // quedaría al final de la página, invisible y tapado por la capa
          // de la UI. Fijado al viewport y justo bajo esa capa queda a
          // pantalla completa; estas propiedades sobreviven porque el
          // módulo solo reasigna las suyas (width/height/margin/…).
          const cs = o.canvas.style;
          cs.position = 'fixed';
          cs.top = '0px';
          cs.left = '0px';
          cs.zIndex = '2147482998';
        },
        // El estado de la cámara se reporta hacia fuera: 'failed' antes
        // dejaba la pantalla EN NEGRO sin mensaje ni salida — el peor fallo
        // posible en un móvil, donde no hay consola que mirar.
        onCameraStatusChange: ({ status, reason }) => {
          if (typeof o.onStatus === 'function') o.onStatus('camara:' + status);
          if (status === 'failed') {
            if (typeof o.onError === 'function') {
              o.onError('La cámara no se pudo abrir' + (reason ? ' (' + reason + ')' : '')
                + '. Revisa el permiso de cámara del navegador.');
            }
            terminar();
          }
        },
        onStart: () => {
          const xr = XR8.Threejs.xrScene();
          if (!xr) return;
          // Iluminación simple y probada (ambiente + direccional). Se probó
          // IBL + ACES aquí y en el teléfono real se veía PEOR — más ruido y
          // colores lavados sobre la cámara; el cliente lo confirmó con
          // fotos. Si se vuelve a intentar, validar en dispositivo, no en el
          // harness: SwiftShader no reproduce cómo se ve.
          xr.scene.add(new THREE_NS.AmbientLight(0xffffff, 0.7));
          const dl = new THREE_NS.DirectionalLight(0xffffff, 1.1);
          dl.position.set(2, 5, 3);
          xr.scene.add(dl);
          contenedor = new THREE_NS.Group();
          // El grupo lleva la escala real; root conserva la suya del encuadre.
          contenedor.scale.setScalar(escala);
          root.position.set(0, 0, 0);
          root.scale.setScalar(1);
          // El GLB original mide lo que mida: se renormaliza aquí igual que
          // hace frame(), para que 2 unidades = su lado mayor.
          const caja = new THREE_NS.Box3().setFromObject(root);
          if (isFinite(caja.min.x)) {
            const tam = caja.getSize(new THREE_NS.Vector3());
            const k = 2 / Math.max(tam.x, tam.y, tam.z, 1e-6);
            const centro = caja.getCenter(new THREE_NS.Vector3());
            root.scale.setScalar(k);
            root.position.set(-centro.x * k, -caja.min.y * k, -centro.z * k);
            // Sombra de contacto a la medida de la huella: es lo que "pega"
            // el producto al suelo — sin ella parece flotar aunque esté bien
            // colocado (se veía en las capturas del cliente).
            const sombra = makeContactShadow(
              Math.max(0.2, tam.x * k * 1.5),
              Math.max(0.2, tam.z * k * 1.5),
            );
            sombra.position.y = 0.004;
            contenedor.add(sombra);
          }
          contenedor.position.set(0, 0, -1.5);   // paso y medio por delante
          contenedor.add(root);
          xr.scene.add(contenedor);
          // Punto de partida de la cámara: altura de ojos, mirando al frente.
          xr.camera.position.set(0, 1.5, 0.6);
          XR8.XrController.updateCameraProjectionMatrix({
            origin: xr.camera.position,
            facing: xr.camera.quaternion,
          });
          arranco = true;
          clearTimeout(vigilante);
          if (typeof o.onPlace === 'function') o.onPlace();
        },
        onUpdate: () => { if (typeof o.onFrame === 'function') o.onFrame(); },
        onException: (e) => {
          if (typeof o.onError === 'function') o.onError((e && e.message) || String(e));
          terminar();
        },
      });
    XR8.addCameraPipelineModules(modulos);

    // ── Gestos, como en los visores nativos ──
    //   · un dedo: arrastra el producto por el suelo; un toque corto lo
    //     COLOCA en el punto tocado (raycast al plano del suelo)
    //   · dos dedos: girar y ajustar tamaño, con imán al 100% (tamaño real)
    const rayo = new THREE_NS.Raycaster();
    const suelo = new THREE_NS.Plane(new THREE_NS.Vector3(0, 1, 0), 0);
    const puntoSuelo = (cx, cy) => {
      const xr = XR8.Threejs.xrScene();
      if (!xr || !contenedor) return null;
      const r = o.canvas.getBoundingClientRect();
      rayo.setFromCamera({
        x: ((cx - r.left) / Math.max(1, r.width)) * 2 - 1,
        y: -((cy - r.top) / Math.max(1, r.height)) * 2 + 1,
      }, xr.camera);
      const out = new THREE_NS.Vector3();
      return rayo.ray.intersectPlane(suelo, out) ? out : null;
    };
    // Punto de ANCLAJE bajo el dedo. Primero contra la geometría REAL que el
    // SLAM detectó (hitTest sobre sus puntos): así el producto se apoya en la
    // mesa o la repisa que estás tocando, no solo en el suelo — anclado al
    // plano y=0 un mueble "sobre la mesa" quedaba en realidad lejos y abajo,
    // y el paralaje lo hacía deslizarse al mover la cámara. Si el motor no ve
    // nada ahí, se cae al plano del suelo.
    const puntoAncla = (cx, cy) => {
      const xr = XR8.Threejs.xrScene();
      const r = o.canvas.getBoundingClientRect();
      try {
        const hits = XR8.XrController.hitTest(
          (cx - r.left) / Math.max(1, r.width),
          (cy - r.top) / Math.max(1, r.height),
        ) || [];
        const cam = xr ? xr.camera.position : null;
        for (let i = 0; i < hits.length; i++) {
          const h = hits[i] && hits[i].position;
          if (!h) continue;
          const p = new THREE_NS.Vector3(h.x, h.y, h.z);
          // Con pocos puntos el SLAM devuelve hits degenerados (pegados a la
          // cámara o a la altura del ojo). Un apoyo creíble está a más de un
          // paso corto y por debajo de la vista; si no, mejor el suelo.
          if (cam && (p.distanceTo(cam) < 0.35
            || p.y > cam.y - 0.3 || p.y < cam.y - 4)) continue;
          return p;
        }
      } catch (e) { /* motor sin hitTest */ }
      return puntoSuelo(cx, cy);
    };
    let factor = 1;   // escala elegida por el cliente (1 = tamaño real)
    const setFactor = (f) => {
      factor = Math.min(4, Math.max(0.25, Number(f) || 1));
      // Imán al 100%: el ajuste con los dedos no debe dejar, sin querer, una
      // escala mentirosa a un pelo del tamaño real.
      if (Math.abs(factor - 1) < 0.07) factor = 1;
      if (contenedor) contenedor.scale.setScalar(escala * factor);
      if (typeof o.onScale === 'function') o.onScale(factor);
    };
    let gesto = null;
    const alTocar = (ev) => {
      const ts = ev.touches;
      if (ts.length >= 2 && contenedor) {
        const dx = ts[1].clientX - ts[0].clientX;
        const dy = ts[1].clientY - ts[0].clientY;
        gesto = { modo: 'dos', dist: Math.hypot(dx, dy) || 1, ang: Math.atan2(dy, dx),
                  factor0: factor, giro0: contenedor.rotation.y };
      } else if (ts.length === 1) {
        gesto = { modo: 'uno', x0: ts[0].clientX, y0: ts[0].clientY,
                  t0: Date.now(), movido: false };
      }
    };
    const alMover = (ev) => {
      if (!gesto || !contenedor) return;
      ev.preventDefault();   // que la página de detrás no haga scroll
      const ts = ev.touches;
      if (gesto.modo === 'uno' && ts.length === 1) {
        if (!gesto.movido
            && Math.hypot(ts[0].clientX - gesto.x0, ts[0].clientY - gesto.y0) < 9) return;
        gesto.movido = true;
        const p = puntoAncla(ts[0].clientX, ts[0].clientY);
        if (p) contenedor.position.copy(p);
      } else if (gesto.modo === 'dos' && ts.length >= 2) {
        const dx = ts[1].clientX - ts[0].clientX;
        const dy = ts[1].clientY - ts[0].clientY;
        setFactor(gesto.factor0 * (Math.hypot(dx, dy) / gesto.dist));
        contenedor.rotation.y = gesto.giro0 - (Math.atan2(dy, dx) - gesto.ang);
      }
    };
    const alSoltar = (ev) => {
      if (gesto && gesto.modo === 'uno' && !gesto.movido && contenedor
          && Date.now() - gesto.t0 < 350) {
        const p = puntoAncla(gesto.x0, gesto.y0);
        if (p) contenedor.position.copy(p);
      }
      gesto = null;
      // Al levantar un dedo de dos, el que queda retoma el arrastre (sin
      // tratarlo como toque nuevo: no debe recolocar por accidente).
      if (ev.touches && ev.touches.length) {
        alTocar(ev);
        if (gesto) gesto.movido = true;
      }
    };
    o.canvas.addEventListener('touchstart', alTocar, { passive: true });
    o.canvas.addEventListener('touchmove', alMover, { passive: false });
    o.canvas.addEventListener('touchend', alSoltar);
    o.canvas.addEventListener('touchcancel', alSoltar);

    let arranco = false;
    const vigilante = setTimeout(() => {
      if (arranco || !vivo) return;
      if (typeof o.onError === 'function') {
        o.onError('El motor de AR no arrancó (¿otra app usando la cámara? ¿WebGL bloqueado?).');
      }
      terminar();
    }, 25000);

    // Escala del SLAM: se queda en 'responsive' (la de fábrica). Se probó
    // 'absolute' (metros reales por sensores) y en el teléfono fue PEOR:
    // producto sobredimensionado y tracking inestable — es un modo que tarda
    // en calibrar y lo dice hasta su documentación. Con 'responsive' el
    // arranque es estable y el tamaño fino lo pone el cliente con el
    // pellizco, viendo los cm en la píldora.

    // Foto del AR: el módulo del motor compone cámara + producto en un JPEG.
    const foto = () => new Promise((resolve, reject) => {
      if (!XR8.CanvasScreenshot) return reject(new Error('Este motor no trae captura.'));
      XR8.CanvasScreenshot.takeScreenshot().then((b64) => {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        resolve(new Blob([buf], { type: 'image/jpeg' }));
      }, reject);
    });

    XR8.run({ canvas: o.canvas });
    return { end: terminar, foto, setScale: setFactor };
  }

  return {
    setModel,
    setParts,
    startLiveAR,
    arSupported,
    startAR,
    exportUSDZ,
    exportGLB,
    setFinishes(list) { finishDefs = Array.isArray(list) ? list : []; return applyState(); },
    setState(next) { state = Object.assign({ colors: {}, finishes: {}, hidden: {} }, next || {}); return applyState(); },
    materialNames,
    frame,
    resize,
    invalidate,
    /** PNG del encuadre actual (para adjuntar el resultado configurado). */
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      disposed = true;
      if (arSession) { try { arSession.end(); } catch (e) {} }
      renderer.setAnimationLoop(null);
      controls.removeEventListener('change', invalidate);
      controls.dispose();
      if (ro) ro.disconnect();
      clearRoot();
      if (envRT) envRT.dispose();
      renderer.dispose();
    },
  };
}
