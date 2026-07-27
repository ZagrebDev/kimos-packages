/**
 * AR EN VIVO de punta a punta, con el motor de 8th Wall REAL:
 *
 *   ficha → pestaña Configurar → elegir "Carbonizado" → "Ver en tu espacio"
 *   → el motor arranca con una cámara sintética → y en la escena del AR está
 *   NUESTRO producto con el color elegido.
 *
 * Es la prueba que ninguna vía anterior permitió: el binario es autoalojable
 * y corre sin servidores, así que se puede ejecutar aquí entero. La cámara es
 * la sintética de Chromium (el SLAM no rastrea nada con ella, pero el
 * pipeline entero arranca y renderiza).
 *
 *   node theme/test/run-ar-vivo.mjs
 * Necesita: npm i @8thwall/engine-binary (se busca en scratchpad o local).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const THEME = path.join(AQUI, '..');
const CANDIDATOS_8W = [
  path.join(AQUI, 'node_modules/@8thwall/engine-binary/dist'),
  path.join(THEME, '../node_modules/@8thwall/engine-binary/dist'),
  '/tmp/claude-0/-home-user/e23f2beb-5730-52c9-baed-c4f4ff47f2b8/scratchpad/8w/node_modules/@8thwall/engine-binary/dist',
];
const DIST_8W = CANDIDATOS_8W.find((d) => fs.existsSync(path.join(d, 'xr.js')));
if (!DIST_8W) {
  console.log('SALTADA: falta @8thwall/engine-binary (npm i @8thwall/engine-binary)');
  process.exit(0);
}

const DEFINITION = {
  data: {
    productos: [{
      productId: 23008278,
      name: 'Piso Hanoi',
      imageUrl: '', images: [], description: '',
      model3d: {
        url: '/mesa_hanoi.glb',
        rotation: [-1.5707963267948966, 0, 3.141592653589793],
        mirror: true,
        realSizeCm: 45,
        arUrl: '/ar-hanoi.glb',
        parts: [
          { id: 'superficie', label: 'Superficie', materials: ['Pino'], defaultColor: '#c8a165', defaultFinish: 'natural' },
          { id: 'estructura', label: 'Estructura', materials: ['Pino_-_Brillante', 'Travesano'], defaultColor: '#8a6642', defaultFinish: 'natural' },
        ],
        finishes: [
          { id: 'natural', label: 'Natural', color: '#ffffff', roughness: 0.7 },
          { id: 'carbonizado', label: 'Carbonizado', color: '#3f4147', roughness: 0.4 },
        ],
      },
      groups: [{ id: 'g1', label: 'Superficie Hanoi 1', type: 'other', values: [
        { id: 'v1', name: 'Natural', model3d: [{ partId: 'superficie', type: 'finish', finishId: 'natural' }] },
        { id: 'v2', name: 'Carbonizado', model3d: [{ partId: 'superficie', type: 'finish', finishId: 'carbonizado' }] },
      ] }],
      storefront: { specs: [], photosNote: '', tabs: {}, pageSections: [] },
    }],
  },
};

const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="/kimos-configurador.css"></head><body>
<section class="product-page" id="product-template-23008278">
  <div class="product-page__wrapper"><div class="product-page__info">
    <script type="application/json" class="product-form-json">{"info":{"product":{"id":23008278,"name":"Piso Hanoi","options":[{"id":900,"name":"Superficie Hanoi 1","values":[{"id":9000,"name":"Natural"},{"id":9001,"name":"Carbonizado"}]}],"price":60000},"variant":{"id":1,"price":60000}}}<\/script>
    <fieldset data-optionid="900"><div class="product-options__title">Superficie Hanoi 1</div>
      <select class="prod-options" data-optionid="900"><option value="9000">Natural</option><option value="9001">Carbonizado</option></select>
    </fieldset>
    <form class="product-form"><button type="submit">Añadir al carro</button></form>
  </div></div>
</section>
<script>window.KIMOS_3D_URL='/definition';window.KIMOS_FULL=true;window.KIMOS_XR8_URL='/8w/xr.js';window.KIMOS_XREXTRAS_URL='/8w/xrextras.js';<\/script>
<script src="/kimos-configurador.js"><\/script>
</body></html>`;

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/' || u === '/p.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(HTML); }
  if (u === '/definition') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(DEFINITION)); }
  if (u === '/mesa_hanoi.glb') { res.writeHead(200, { 'Content-Type': 'model/gltf-binary' }); return fs.createReadStream(path.join(THEME, '../packs/mesa-hanoi/mesa_hanoi.glb')).pipe(res); }
  let f = null;
  if (u === '/8w/xrextras.js') f = path.join(DIST_8W, '../../xrextras/dist/xrextras.js');
  else if (u.startsWith('/8w/')) f = path.join(DIST_8W, u.slice(4));
  else f = path.join(THEME, u.replace(/^\//, ''));
  if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('x'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(8817, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
         '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
});
await page.context().grantPermissions(['camera'], { origin: 'http://localhost:8817' });
// Espía: ¿el motor se configura con escala ABSOLUTA (metros reales, no la
// escala relativa 'responsive' por defecto)? XrController aparece cuando el
// chunk del SLAM termina de cargar, por eso se vigila con un intervalo.
await page.addInitScript(() => {
  window.__cfgEscala = null;
  window.__espia = 'esperando';
  // La envoltura tiene que estar puesta EN EL INSTANTE en que el módulo
  // aparece: el motor llama a configure en el mismo tick en que termina de
  // cargar el chunk del SLAM (un intervalo vigilante llega tarde). Accessors
  // sobre window.XR8 y sobre su propiedad XrController lo garantizan.
  const wrap = (m) => new Proxy(m, {
    get(t, k) {
      if (k === 'configure') {
        return (c) => {
          if (c && c.scale) window.__cfgEscala = c.scale;
          return t.configure(c);
        };
      }
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  let xr8;
  Object.defineProperty(window, 'XR8', {
    configurable: true,
    get: () => xr8,
    set: (v) => {
      xr8 = v;
      if (!v || typeof v !== 'object') return;
      try {
        let xc = v.XrController ? wrap(v.XrController) : undefined;
        Object.defineProperty(v, 'XrController', {
          configurable: true,
          get: () => xc,
          set: (m) => { xc = m ? wrap(m) : m; window.__espia = 'envuelto'; },
        });
        if (xc) window.__espia = 'envuelto';
        else window.__espia = 'esperando XrController';
      } catch (e) { window.__espia = 'fallo: ' + e.message; }
    },
  });
});
// La cámara sintética es frontal; un teléfono real tiene trasera: se ablanda
// el `exact` para que el harness se comporte como el teléfono.
await page.addInitScript(() => {
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    try {
      if (c && c.video && c.video.facingMode && c.video.facingMode.exact) {
        c = JSON.parse(JSON.stringify(c));
        c.video.facingMode = c.video.facingMode.exact;
      }
    } catch (e) {}
    return orig(c);
  };
});
const externas = [];
await page.route('**/*', (route) => {
  const u = route.request().url();
  if (u.startsWith('http://localhost:8817')) return route.continue();
  externas.push(u); return route.abort();   // NADA sale de aquí
});

const fallos = [];
const ok = (n, c, d) => { console.log((c ? '✔ ' : '✘ ') + n + (d ? ' · ' + d : '')); if (!c) fallos.push(n); };

await page.goto('http://localhost:8817/p.html');
await page.waitForSelector('.kimos-cfg .kc-bar', { timeout: 15000 });
await page.click('.kc-bar-cta');
await page.waitForFunction(() => {
  const m = document.querySelector('.kc-canvas-msg');
  return m && m.style.display === 'none';
}, { timeout: 30000 });

// El personalizador: elegir Carbonizado ANTES de abrir el AR.
await page.selectOption('select[data-optionid="900"]', { label: 'Carbonizado' });
await page.waitForTimeout(400);

await page.waitForSelector('button.kc-ar-btn', { timeout: 5000 });
ok('el botón de AR en vivo aparece en el móvil', true);
await page.click('button.kc-ar-btn');
// OJO: el canvas se busca por su CLASE y no como hijo de la capa, porque
// FullWindowCanvas lo muda al <body> en cuanto el pipeline arranca.
await page.waitForSelector('canvas.kc-arv-canvas', { timeout: 10000 });
ok('se abre la capa de cámara con su canvas', true);

// El motor tarda en arrancar con swiftshader: se espera a que coloque el
// producto (el tip cambia en onPlace).
await page.waitForFunction(() => {
  const t = document.querySelector('.kc-arv-tip');
  return t && /arrastra/i.test(t.textContent);
}, { timeout: 60000 });
ok('el motor arranca y coloca el producto (onPlace)', true);
// La escala del SLAM se queda en 'responsive' (fábrica): 'absolute' se probó
// y en dispositivo real fue peor — sobredimensionado e inestable. El espía
// vigila que NADIE la cambie sin pasar por un teléfono de verdad.
ok('el SLAM queda en escala "responsive" (la estable de fábrica)',
  (await page.evaluate(() => window.__cfgEscala)) === null,
  (await page.evaluate(() => window.__cfgEscala + ' (espía: ' + window.__espia + ')')));

const r = await page.evaluate(() => {
  const xr = window.XR8 && window.XR8.Threejs && window.XR8.Threejs.xrScene();
  if (!xr) return null;
  const mats = [];
  xr.scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.name) {
      mats.push(o.material.name + '#' + o.material.color.getHexString());
    }
  });
  return { mats: mats, credito: !!document.querySelector('.kc-arv-cred') };
});
ok('NUESTRO producto está dentro de la escena del AR', !!r && r.mats.length >= 3, r && r.mats.length + ' mallas');
ok('…con el color ELEGIDO (Carbonizado en la superficie)',
  !!r && r.mats.some((m) => /^Pino#3f4147/.test(m)), r && r.mats.filter((m) => m.startsWith('Pino#')).join(', '));
ok('la atribución de licencia está visible', !!r && r.credito);

// ── Anclaje visual en la escena XR ── (el render vuelve al de siempre:
// luces simples SIN IBL/ACES — en el teléfono real se veía peor con ellos)
const realismo = await page.evaluate(() => {
  const xr = window.XR8.Threejs.xrScene();
  const grupo = xr.scene.children.find((c) => c.type === 'Group');
  let sombra = false;
  if (grupo) {
    grupo.traverse((m) => {
      if (m.isMesh && m.geometry && m.geometry.type === 'PlaneGeometry'
          && m.material && m.material.transparent) sombra = true;
    });
  }
  return {
    env: !!xr.scene.environment,
    sombra,
    escala: grupo ? grupo.scale.x : 0,
  };
});
ok('la escena AR usa el render probado (sin IBL experimental)', !realismo.env);
ok('hay sombra de contacto bajo el producto', realismo.sombra);
ok('el producto está a TAMAÑO REAL (45 cm → escala 0.225)',
  Math.abs(realismo.escala - 0.225) < 0.001, 'escala ' + realismo.escala.toFixed(4));

// ¿Sigue VIVO el render? La cámara sintética emite un patrón en movimiento:
// capturas separadas deben diferir. Con SwiftShader el framerate puede caer
// por debajo de 1 fps, así que se reintenta antes de dar el render por
// muerto. Va ANTES de los gestos: después el producto puede quedar tapando
// la zona comparada.
const sigueVivo = async (clip) => {
  const base = await page.screenshot({ clip });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(800);
    if (!base.equals(await page.screenshot({ clip }))) return true;
  }
  return false;
};
ok('el render sigue vivo (la imagen cambia entre capturas)',
  await sigueVivo({ x: 40, y: 300, width: 200, height: 200 }));

// ── Gestos ── (touch sintético directo sobre el canvas)
const gesto = (type, pts) => page.evaluate(([t, ps]) => {
  const c = document.querySelector('canvas.kc-arv-canvas');
  const touches = ps.map((p, i) => new Touch({ identifier: i, target: c, clientX: p[0], clientY: p[1] }));
  c.dispatchEvent(new TouchEvent(t, { touches, changedTouches: touches, bubbles: true, cancelable: true }));
}, [type, pts]);
const estadoGrupo = () => page.evaluate(() => {
  const g = window.XR8.Threejs.xrScene().scene.children.find((c) => c.type === 'Group');
  return { x: g.position.x, y: g.position.y, z: g.position.z, s: g.scale.x, ry: g.rotation.y };
});

// Un dedo ARRASTRA el producto por el suelo. La dirección exacta depende de
// la pose que el SLAM haya estimado con la cámara sintética (deriva sola),
// así que lo exigible es que SALGA de su sitio inicial (0,0,-1.5) siguiendo
// el rayo del dedo y SIEMPRE a ras de suelo (y=0).
await gesto('touchstart', [[200, 600]]);
await gesto('touchmove', [[300, 640]]);
await gesto('touchend', []);
let g1 = await estadoGrupo();
const seMovio = Math.hypot(g1.x - 0, g1.z + 1.5) > 0.05;
ok('arrastrar con un dedo lo mueve por el suelo (y sigue a ras, y=0)',
  seMovio && g1.y === 0, 'pos ' + g1.x.toFixed(2) + ',' + g1.y + ',' + g1.z.toFixed(2));

// Un TOQUE corto lo coloca en el punto tocado (otro punto → otra posición).
const antes = g1;
await gesto('touchstart', [[80, 640]]);
await gesto('touchend', []);
g1 = await estadoGrupo();
ok('un toque corto lo COLOCA donde tocas',
  g1.y === 0 && Math.hypot(g1.x - antes.x, g1.z - antes.z) > 0.03,
  'pos ' + g1.x.toFixed(2) + ',' + g1.z.toFixed(2));

// Dos dedos: pellizcar al doble → 200% del tamaño real.
await gesto('touchstart', [[145, 500], [245, 500]]);
await gesto('touchmove', [[95, 500], [295, 500]]);
await gesto('touchend', []);
g1 = await estadoGrupo();
ok('pellizcar escala el producto (100% → 200%)',
  Math.abs(g1.s - 0.45) < 0.01, 'escala ' + g1.s.toFixed(3));
ok('…y la píldora muestra SOLO el porcentaje (sin cm engañosos)',
  await page.evaluate(() => {
    const p = document.querySelector('.kc-arv-escala');
    return !!p && p.classList.contains('kc-arv-escala-on')
      && /^\d+%$/.test(p.textContent.trim()) && !/cm/i.test(p.textContent);
  }), await page.$eval('.kc-arv-escala', (n) => n.textContent));

// Dos dedos girando (misma distancia) → rota sobre su eje.
await gesto('touchstart', [[145, 500], [245, 500]]);
await gesto('touchmove', [[195, 450], [195, 550]]);
await gesto('touchend', []);
g1 = await estadoGrupo();
ok('dos dedos giran el producto', Math.abs(g1.ry) > 0.5, 'rot ' + g1.ry.toFixed(2));

// Volver cerca del 100%: el imán deja la escala EXACTA (tamaño real).
await gesto('touchstart', [[95, 500], [295, 500]]);
await gesto('touchmove', [[146, 500], [250, 500]]);   // ~×0.52 sobre 200% ≈ 104%
await gesto('touchend', []);
g1 = await estadoGrupo();
ok('el imán al 100% devuelve el tamaño real exacto',
  Math.abs(g1.s - 0.225) < 0.0001, 'escala ' + g1.s.toFixed(4));

// ── Chips de acabado dentro del AR (PLEGADOS tras "Personalizar") ──
ok('los acabados vienen PLEGADOS para no tapar la pantalla',
  await page.evaluate(() => {
    const p = document.querySelector('.kc-arv-chips-panel');
    return !!p && getComputedStyle(p).display === 'none'
      && !!document.querySelector('.kc-arv-chips-btn');
  }));
ok('…y "Personalizar" vive en el LADO DERECHO, lejos de los textos',
  await page.evaluate(() => {
    const r = document.querySelector('.kc-arv-chips').getBoundingClientRect();
    return r.left > window.innerWidth / 2 && r.right >= window.innerWidth - 40
      && r.bottom < window.innerHeight - 40;
  }), await page.evaluate(() => {
    const r = document.querySelector('.kc-arv-chips').getBoundingClientRect();
    return Math.round(r.left) + '→' + Math.round(r.right) + ' de ' + window.innerWidth;
  }));
await page.click('.kc-arv-chips-btn');
const nChips = await page.$$eval('.kc-arv-chip', (cs) => cs.map((c) => c.textContent));
ok('"Personalizar" despliega los acabados', nChips.length === 2, nChips.join(' · '));
ok('…cada chip lleva su COLOR a la vista', await page.evaluate(() => {
  const dots = document.querySelectorAll('.kc-arv-chip .kc-arv-chip-dot');
  return dots.length === 2 && Array.prototype.every.call(dots,
    (d) => /rgb/.test(getComputedStyle(d).backgroundColor));
}), await page.evaluate(() =>
  Array.prototype.map.call(document.querySelectorAll('.kc-arv-chip-dot'),
    (d) => getComputedStyle(d).backgroundColor).join(' · ')));
ok('…con el elegido marcado', await page.evaluate(() => {
  const on = document.querySelector('.kc-arv-chip-on');
  return !!on && /Carbonizado/.test(on.textContent);
}));
await page.click('.kc-arv-chip');   // el primero: "Natural"
await page.waitForTimeout(600);
const trasChip = await page.evaluate(() => {
  const xr = window.XR8.Threejs.xrScene();
  const mats = [];
  xr.scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.name) mats.push(o.material.name + '#' + o.material.color.getHexString());
  });
  return { mats, select: document.querySelector('select[data-optionid="900"]').value };
});
ok('tocar un chip cambia el acabado EN VIVO en la escena AR',
  trasChip.mats.some((m) => /^Pino#ffffff/.test(m)),
  trasChip.mats.filter((m) => m.startsWith('Pino#')).join(', '));
ok('…y sincroniza el control real del carro', trasChip.select === '9000', 'select=' + trasChip.select);

// ── Foto: el motor compone cámara + producto y se descarga/comparte ──
const descarga = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
await page.click('.kc-arv-foto');
const dl = await descarga;
let fotoBytes = 0;
if (dl) {
  const ruta = await dl.path().catch(() => null);
  if (ruta) fotoBytes = fs.statSync(ruta).size;
}
ok('el botón de foto entrega un JPEG con la escena', !!dl && fotoBytes > 5000,
  dl ? dl.suggestedFilename() + ' · ' + fotoBytes + ' bytes' : 'sin descarga');

// Los gestos pudieron dejar el producto pegado a la cámara tapando las
// capturas que siguen. Limpieza del test (no es un gesto): se aleja directo,
// porque un toque real dependería de la pose que haya derivado el SLAM.
await page.evaluate(() => {
  const g = window.XR8.Threejs.xrScene().scene.children.find((c) => c.type === 'Group');
  g.position.set(0, 0, -4);
});
await page.waitForTimeout(300);

// Los dos fallos que se vieron en el teléfono, por orden: cámara en una
// esquina (el búfer sin dimensionar) y después PANTALLA NEGRA (la capa de UI
// tapando el canvas, que FullWindowCanvas muda al <body>). Lo que se exige:
// que lo VISIBLE cubra el viewport, que el búfer no sea el de serie (300×150)
// y siga la proporción de la pantalla, y que la capa ya no pinte negro.
const lienzo = await page.evaluate(() => {
  const c = document.querySelector('canvas.kc-arv-canvas');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { w: c.width, h: c.height, vw: window.innerWidth, vh: window.innerHeight,
    rw: r.width, rh: r.height, top: r.top, left: r.left,
    enBody: c.parentElement === document.body,
    fondo: getComputedStyle(document.querySelector('.kc-arv')).backgroundColor };
});
ok('el canvas sigue localizable tras arrancar', !!lienzo,
  lienzo && (lienzo.enBody ? 'FullWindowCanvas lo movió al <body>' : 'sigue en la capa'));
ok('lo visible cubre la pantalla completa',
  !!lienzo && lienzo.rw >= lienzo.vw - 1 && lienzo.rh >= lienzo.vh - 1
  && lienzo.top <= 1 && lienzo.left <= 1,
  lienzo && (Math.round(lienzo.rw) + '×' + Math.round(lienzo.rh) + ' @' + Math.round(lienzo.left) + ',' + Math.round(lienzo.top) + ' (pantalla ' + lienzo.vw + '×' + lienzo.vh + ')'));
ok('el búfer no es el de serie y sigue la proporción de la pantalla',
  !!lienzo && (lienzo.w > 300 || lienzo.h > 150)
  && Math.abs(lienzo.w / lienzo.h - lienzo.vw / lienzo.vh) < 0.06,
  lienzo && (lienzo.w + '×' + lienzo.h + ' → ' + (lienzo.w / lienzo.h).toFixed(3) + ' vs ' + (lienzo.vw / lienzo.vh).toFixed(3)));
ok('la capa deja de pintar NEGRO con la cámara en marcha',
  !!lienzo && /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(lienzo.fondo), lienzo && lienzo.fondo);
// Y el botón Salir con su estilo propio: la capa vive fuera de .kimos-cfg.
const salir = await page.$eval('.kc-arv-salir', (b) => getComputedStyle(b).borderRadius);
ok('el botón Salir lleva su estilo (no el del theme)', salir === '24px', salir);
ok('cero peticiones a servidores externos', externas.length === 0, externas.slice(0, 3).join(', '));

// Redimensionar EN PLENA SESIÓN (giro del teléfono, barra de URL que se
// esconde): el búfer debe seguir a la pantalla y el render no debe morir.
await page.setViewportSize({ width: 500, height: 640 });
await page.waitForTimeout(900);
// En móvil FullWindowCanvas reacciona al giro (evento de orientación), no a
// cada resize (la barra de URL sube y baja sin parar): lo exigible aquí es
// que LO VISIBLE siga cubriendo el viewport nuevo y el render siga vivo.
const trasGiro = await page.evaluate(() => {
  const c = document.querySelector('canvas.kc-arv-canvas');
  const r = c.getBoundingClientRect();
  return { rw: r.width, rh: r.height, vw: window.innerWidth, vh: window.innerHeight };
});
ok('tras el giro, lo visible sigue cubriendo la pantalla',
  trasGiro.rw >= trasGiro.vw - 1 && trasGiro.rh >= trasGiro.vh - 1,
  Math.round(trasGiro.rw) + '×' + Math.round(trasGiro.rh) + ' (pantalla ' + trasGiro.vw + '×' + trasGiro.vh + ')');
ok('…y el render sigue vivo después del giro',
  await sigueVivo({ x: 40, y: 200, width: 200, height: 200 }));

// Salir restaura el visor de la ficha.
await page.click('.kc-arv-salir');
await page.waitForTimeout(800);
ok('al salir, la capa desaparece y la ficha sigue viva',
  await page.evaluate(() => !document.querySelector('.kc-arv') && !!document.querySelector('.kc-canvas')));
// El canvas mudado al <body> no puede quedar HUÉRFANO tapando la ficha.
ok('…y el canvas de la cámara no queda huérfano en el <body>',
  await page.evaluate(() => !document.querySelector('canvas.kc-arv-canvas')));

// ── Cámara que FALLA: lo que en el teléfono fue "pantalla negra y falla" ──
// Antes este camino se quedaba en negro para siempre, sin mensaje. Ahora debe
// avisar EN PANTALLA y caer solo a los visores del sistema.
console.log('\n· cámara denegada:');
const pFail = await browser.newPage({
  viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
});
await pFail.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
});
await pFail.route('**/*', (route) => {
  const u = route.request().url();
  return u.startsWith('http://localhost:8817') ? route.continue() : route.abort();
});
await pFail.goto('http://localhost:8817/p.html');
await pFail.waitForSelector('.kimos-cfg .kc-bar', { timeout: 15000 });
await pFail.click('.kc-bar-cta');
await pFail.waitForFunction(() => {
  const m = document.querySelector('.kc-canvas-msg');
  return m && m.style.display === 'none';
}, { timeout: 30000 });
await pFail.click('button.kc-ar-btn');
await pFail.waitForSelector('.kc-ar-aviso', { timeout: 40000 });
const aviso = await pFail.$eval('.kc-ar-aviso', (n) => n.textContent);
ok('la cámara fallida se AVISA en pantalla (no negro mudo)', /cámara/i.test(aviso), aviso.slice(0, 70) + '…');
ok('…la capa negra se cierra sola', await pFail.evaluate(() => !document.querySelector('.kc-arv')));
await pFail.waitForSelector('a.kc-ar-btn', { timeout: 5000 });
ok('…y queda el visor del sistema como respaldo', true);
await pFail.close();

await browser.close(); srv.close();
if (fallos.length) { console.error('\n✘ ' + fallos.length + ' fallo(s)'); process.exit(1); }
console.log('\nAR EN VIVO OK ✔ — motor autoalojado, sin servidores, con el producto configurado dentro');
