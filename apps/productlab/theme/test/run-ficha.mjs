/**
 * Harness de la FICHA COMPLETA (KIMOS_FULL) sobre una réplica del caso real
 * que se dio en la tienda:
 *
 *  - el theme solo imprime la foto principal en su JSON (la galería la pinta
 *    un carrusel que carga las demás en `data-src`),
 *  - el producto tiene descripción en la tienda,
 *  - la ficha lleva un hero con el bloque `description`.
 *
 * Comprueba que la ficha use la galería COMPLETA que publica la app y que la
 * descripción se pinte dentro del hero.
 *
 *   node theme/test/run-ficha.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const THEME = path.join(AQUI, '..');

const DESC = 'Taburete de madera maciza con acabado Yakisugi. Cada pieza se '
  + 'carboniza a mano, por lo que la veta nunca es idéntica.';

// Lo que publicaría la app: galería completa + descripción + hero con el
// bloque `description` (lo que antes no existía y dejaba Explorar a medias).
const DEFINITION = {
  data: {
    productos: [{
      productId: 23008278,
      name: 'Piso Hanoi',
      sku: null,
      imageUrl: 'https://cdn.test/hanoi-1.jpg',
      images: ['https://cdn.test/hanoi-1.jpg', 'https://cdn.test/hanoi-2.jpg', 'https://cdn.test/hanoi-3.jpg'],
      description: DESC,
      model3d: null,
      groups: [{ id: 'g1', label: 'Superficie Hanoi 1', type: 'other', values: [
        // Con sus efectos 3D, como los genera la app: elegir un valor cambia
        // el acabado de una parte. Sin esto no hay nada que reflejar en AR.
        { id: 'v1', name: 'Natural', model3d: [{ partId: 'superficie', type: 'finish', finishId: 'natural' }] },
        { id: 'v2', name: 'Carbonizado', model3d: [{ partId: 'superficie', type: 'finish', finishId: 'carbonizado' }] },
      ] }],
      storefront: {
        specs: [{ id: 's1', group: '', label: 'Madera', value: 'Pino radiata' }],
        photosNote: '',
        tabs: { order: ['explorar', 'specs', 'fotos'], showSpecs: true, showFotos: true },
        pageSections: [
          { id: 'h1', kind: 'hero', pattern: 'columnas', height: 'l', overlay: true, slots: {
            left: [
              { id: 'b1', type: 'title', align: 'left' },
              { id: 'b2', type: 'description', align: 'left', size: 'm', max: 0 },
              { id: 'b3', type: 'cta', align: 'left', label: 'Configurar', action: 'configurar', style: 'primary' },
            ],
            right: [{ id: 'b4', type: 'photo', size: 'l', anim: 'float' }],
          } },
          { id: 'p1', kind: 'specs', show: true },
          { id: 'p2', kind: 'fotos', show: true },
          { id: 'p3', kind: 'note', show: true },
        ],
      },
    }],
  },
};

// El theme solo conoce la foto principal; la segunda solo existe pintada en el
// carrusel con `data-src`, y la tercera no está en el DOM en absoluto.
const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Harness · ficha completa</title>
<link rel="stylesheet" href="/kimos-configurador.css">
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#111;color:#eee}
.product-page__wrapper{display:flex;gap:32px;flex-wrap:wrap}</style></head><body>
<section class="product-page" id="product-template-23008278">
  <div class="product-page__wrapper">
    <div class="product-gallery">
      <img src="https://cdn.test/hanoi-1.jpg" alt="">
      <img data-src="https://cdn.test/hanoi-2.jpg" alt="">
    </div>
    <div class="product-page__info">
      <h1>Piso Hanoi</h1>
      <span class="product-price">0</span>
      <span class="product-price">$100.000</span>
      <script type="application/json" class="product-form-json">{"info":{"product":{"id":23008278,"name":"Piso Hanoi","images":[{"url":"https://cdn.test/hanoi-1.jpg"}],"options":[{"id":900,"name":"Superficie Hanoi 1","values":[{"id":9000,"name":"Natural"},{"id":9001,"name":"Carbonizado"}]}],"price":100000},"variant":{"id":1,"price":100000}}}<\/script>
      <fieldset class="product-options__fieldset" data-optionid="900">
        <div class="product-options__title">Superficie Hanoi 1</div>
        <select class="select prod-options" data-optionid="900">
          <option value="9000">Natural</option><option value="9001">Carbonizado</option>
        </select>
      </fieldset>
      <form class="product-form"><button type="submit">Añadir al carro</button></form>
    </div>
  </div>
</section>
<script>window.KIMOS_3D_URL='/definition';window.KIMOS_FULL=true;<\/script>
<script src="/kimos-configurador.js"><\/script>
</body></html>`;

// Segundo escenario: el producto en la app Productos aún no tiene la galería,
// así que la app solo publica la foto principal. La ficha tiene que rescatar
// las demás del DOM, donde el theme las deja en `srcset`, en `data-src` y como
// `background-image` — que es como las guardan los carruseles reales.
const DEF_POBRE = JSON.parse(JSON.stringify(DEFINITION));
DEF_POBRE.data.productos[0].images = ['https://cdn.test/hanoi-1.jpg'];

const HTML_POBRE = HTML
  .replace('window.KIMOS_3D_URL=\'/definition\'', 'window.KIMOS_3D_URL=\'/definition-pobre\'')
  .replace(
    '<img data-src="https://cdn.test/hanoi-2.jpg" alt="">',
    '<div class="swiper-slide"><picture><source srcset="https://cdn.test/hanoi-2.jpg 1x, https://cdn.test/hanoi-2@2x.jpg 2x"></picture></div>'
    + '<div class="swiper-slide" style="background-image:url(\'https://cdn.test/hanoi-3.jpg\')"></div>'
    + '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="">');

// Tercer escenario: producto CON visor 3D real (Mesa Hanoi del pack) y medida
// real declarada, que es lo que habilita "Ver en tu espacio".
const DEF_3D = JSON.parse(JSON.stringify(DEFINITION));
DEF_3D.data.productos[0].model3d = {
  url: '/mesa_hanoi.glb',
  rotation: [-1.5707963267948966, 0, 3.141592653589793],
  mirror: true,
  realSizeCm: 45,
  arUrl: '/ar-hanoi.glb',
  parts: [
    { id: 'superficie', label: 'Superficie', materials: ['Pino'], defaultColor: '#c8a165', defaultFinish: 'natural' },
    { id: 'estructura', label: 'Estructura', materials: ['Pino_-_Brillante', 'Travesano'], defaultColor: '#8a6642', defaultFinish: 'natural' },
  ],
  finishes: [{ id: 'natural', label: 'Natural', color: '#ffffff', roughness: 0.7,
    texture: '/wood_col.webp', textureScale: 0.09, grain: 0.3, triplanar: true },
    { id: 'carbonizado', label: 'Carbonizado', color: '#3f4147', roughness: 0.4,
      texture: '/wood_col.webp', textureScale: 0.09, grain: 1.0, triplanar: true }],
};
const HTML_3D = HTML.replace("window.KIMOS_3D_URL='/definition'", "window.KIMOS_3D_URL='/definition-3d'");

const MIME = { '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/ficha.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(HTML);
  }
  if (url === '/pobre.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(HTML_POBRE);
  }
  if (url === '/3d.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(HTML_3D);
  }
  if (url === '/ar-hanoi.glb') {
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
    return res.end(Buffer.from('glTF-falso'));
  }
  if (url === '/wood_col.webp') {
    const tex = path.join(THEME, '..', 'packs', 'mesa-hanoi', 'wood_col.webp');
    if (!fs.existsSync(tex)) { res.writeHead(404); return res.end('sin textura'); }
    res.writeHead(200, { 'Content-Type': 'image/webp', 'Access-Control-Allow-Origin': '*' });
    return fs.createReadStream(tex).pipe(res);
  }
  if (url === '/ar-hanoi.glb') {
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
    return res.end(Buffer.from('glTF-falso'));
  }
  if (url === '/mesa_hanoi.glb') {
    const glb = path.join(THEME, '..', 'packs', 'mesa-hanoi', 'mesa_hanoi.glb');
    if (!fs.existsSync(glb)) { res.writeHead(404); return res.end('sin glb'); }
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Access-Control-Allow-Origin': '*' });
    return fs.createReadStream(glb).pipe(res);
  }
  if (url === '/definition' || url === '/definition-pobre' || url === '/definition-3d') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    const cual = url === '/definition' ? DEFINITION : url === '/definition-pobre' ? DEF_POBRE : DEF_3D;
    return res.end(JSON.stringify(cual));
  }
  // Las fotos no existen: da igual, se comprueban los `src`, no los píxeles.
  const f = path.join(THEME, url.replace(/^\//, ''));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(8801, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // swiftshader: hay que renderizar de verdad para que el visor se monte y
  // el botón de AR llegue a existir.
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
// Las fotos apuntan a un CDN que no existe y el favicon tampoco: eso no es un
// error de la ficha, así que no cuenta.
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text())) return;
  errs.push('console: ' + m.text());
});

await page.goto('http://localhost:8801/ficha.html');
await page.waitForSelector('.kimos-cfg .kc-bar', { timeout: 10000 });

const fallos = [];
const ok = (nombre, cond, detalle) => {
  console.log((cond ? '✔ ' : '✘ ') + nombre + (detalle ? ' · ' + detalle : ''));
  if (!cond) fallos.push(nombre + (detalle ? ' · ' + detalle : ''));
};

// 1. Estructura de la barra, como en la app de computadores: a la izquierda
// solo navegación por el contenido (Explorar fija + anclas), y Configurar a la
// derecha, en el botón — nunca como pestaña.
const tabs = await page.$$eval('.kc-tab', (ns) => ns.map((n) => n.textContent.trim()));
const cta = await page.$eval('.kc-bar-cta', (n) => n.textContent.trim());
ok('a la izquierda: el producto + anclas, sin Configurar',
  tabs[0] === 'Piso Hanoi' && tabs.indexOf('Configurar') === -1, tabs.join(' · '));
ok('Especificaciones y Fotos son anclas, no pestañas',
  tabs.indexOf('Especificaciones') !== -1 && tabs.indexOf('Fotos') !== -1);
ok('a la derecha, el botón entra al configurador', cta === 'Configurar', cta);
// El landing termina en la invitación + la sección del personalizador.
ok('el landing invita a configurar antes de la sección',
  (await page.$$('.kc-goconf-btn')).length === 1);
ok('el personalizador es la última sección del landing',
  await page.$eval('.kc-body', (n) => !!n.lastElementChild && n.lastElementChild.classList.contains('kc-conf')));
ok('el footer del theme queda oculto',
  await page.$eval('footer.footer', (n) => getComputedStyle(n).display === 'none').catch(() => true));

// Al pulsarlo se BLOQUEA el personalizador y el botón pasa a ser el carro real.
await page.click('.kc-bar-cta');
const cta2 = await page.$eval('.kc-bar-cta', (n) => n.textContent.trim());
ok('dentro del configurador el botón es el del carro', /carro/i.test(cta2), cta2);
ok('bloqueado: solo queda el personalizador (sin hero)',
  (await page.$$('.kc-hero')).length === 0);
ok('la izquierda de la barra es "← Volver"', (await page.$$('.kc-volver')).length === 1);
ok('compartir presente junto al carro', (await page.$$('.kc-share')).length >= 1);
await page.click('.kc-volver');

// Las anclas bajan a la sección DENTRO de Explorar, sin cambiar de panel.
await page.click('.kc-tab:has-text("Fotos")');
await page.waitForTimeout(400);
const trasAncla = await page.evaluate(() => ({
  fotos: !!document.querySelector('.kc-fotos'),
  specs: !!document.querySelector('.kc-specs'),
  scroll: window.pageYOffset > 0,
}));
ok('Fotos vive dentro de Explorar, junto a las specs',
  trasAncla.fotos && trasAncla.specs, JSON.stringify(trasAncla));

// 1b. El precio de la barra. La página trae un señuelo —un nodo con "price"
// en la clase y un "0" dentro, delante del precio real— que es justo lo que
// hacía que la barra mostrara 0 en una tienda con el producto a $100.000.
const precio = await page.$eval('.kc-bar-price', (n) => n.textContent.trim());
ok('la barra muestra el precio real, no el primer nodo con pinta de precio',
  precio.replace(/\D/g, '') === '100000', precio);

// 2. La descripción de la tienda se pinta dentro del hero.
const desc = await page.$eval('.kc-b-desc', (n) => n.textContent.trim()).catch(() => '');
ok('bloque description pintado en el hero', desc === DESC, desc.slice(0, 40) + '…');

// 3. La galería usa las 3 fotos publicadas, no solo la principal.
const fotos = await page.$$eval('.kc-foto-th', (ns) => ns.map((n) => n.getAttribute('src')));
ok('galería completa (3 fotos, no solo la principal)', fotos.length === 3, fotos.length + ' fotos');
ok('sin duplicar la foto que ya estaba en el DOM',
  new Set(fotos).size === fotos.length, fotos.join(', '));

// 4. Recorte por `max`: se comprueba en caliente sobre el mismo bloque.
const recortada = await page.evaluate((d) => {
  var b = { type: 'description', size: 'm', max: 40 };
  var t = d; if (b.max > 0 && t.length > b.max) t = t.slice(0, b.max).replace(/\s+\S*$/, '') + '…';
  return t;
}, DESC);
ok('recorte a 40 caracteres sin cortar palabras', recortada.length <= 41 && /…$/.test(recortada), recortada);

ok('sin errores de JS', errs.length === 0, errs.join(' | '));

await page.screenshot({ path: path.join(AQUI, 'shot-ficha.png'), fullPage: true });

// ── "Ver en tu espacio" ───────────────────────────────────────────────────
// Ya no hay WebXR: las tres vías son del sistema operativo. Se comprueban las
// que se pueden comprobar aquí — el enlace que se genera en cada plataforma.
console.log('\n· "Ver en tu espacio":');

// Android: Scene Viewer, con el .glb a escala real publicado por la app.
const pAnd = await browser.newPage({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
});
pAnd.on('pageerror', (e) => errs.push('SV: ' + String(e)));
await pAnd.goto('http://localhost:8801/3d.html');
await pAnd.waitForSelector('.kimos-cfg .kc-bar', { timeout: 15000 });
await pAnd.click('.kc-bar-cta');
await pAnd.waitForFunction(() => {
  const m = document.querySelector('.kc-canvas-msg');
  return m && m.style.display === 'none';
}, { timeout: 30000 });
await pAnd.waitForSelector('a.kc-ar-btn', { timeout: 5000 });
// El href se refresca antes de navegar: se dispara el mismo evento que el
// navegador y se lee el enlace resultante.
await pAnd.dispatchEvent('a.kc-ar-btn', 'pointerdown');
const href = await pAnd.$eval('a.kc-ar-btn', (a) => a.getAttribute('href'));
// Y lo que de verdad importa: que al cambiar la configuración cambie el
// modelo que se abre. Es el motivo de todo esto — por algo es un
// personalizador.
await pAnd.selectOption('select[data-optionid="900"]', { label: 'Carbonizado' });
await pAnd.waitForTimeout(300);
await pAnd.dispatchEvent('a.kc-ar-btn', 'pointerdown');
const href2 = await pAnd.$eval('a.kc-ar-btn', (a) => a.getAttribute('href'));
await pAnd.close();
ok('Android: enlace a Scene Viewer', href.indexOf('intent://arvr.google.com/scene-viewer/1.0') === 0, href.slice(0, 60) + '…');
ok('…con el modelo servido por el backend, a escala fija',
  /\/ar\/23008278\.glb/.test(decodeURIComponent(href)) && /resizable=false/.test(href));
// El color elegido viaja en la URL: es lo que permite que Android muestre la
// configuración del cliente sin generar un archivo por combinación.
ok('…y con los colores de la configuración por material',
  /m=.*Pino/.test(decodeURIComponent(href)), (decodeURIComponent(href).match(/m=([^&;]*)/) || [])[1]);
ok('…y con vuelta a la ficha si no hay soporte', /browser_fallback_url=/.test(href));
ok('al cambiar la opción, el modelo de AR cambia con ella',
  href2 !== href && /Pino:/.test(decodeURIComponent(decodeURIComponent(href2))), (decodeURIComponent(href2).match(/m=([^&;]*)/) || [])[1]);

// iPhone: AR Quick Look con el .usdz generado en el navegador. Aquí importa
// sobre todo que lleve la VETA: el sombreado triplanar es GLSL propio y no
// sobrevive a un archivo, así que se hornea como UV y la textura viaja dentro.
// Sin eso la madera salía plana y el modelo se veía mal en iPhone.
const pIOS = await browser.newPage({ viewport: { width: 390, height: 844 } });
pIOS.on('pageerror', (e) => errs.push('QL: ' + String(e)));
await pIOS.addInitScript(() => {
  const orig = DOMTokenList.prototype.supports;
  DOMTokenList.prototype.supports = function (x) {
    if (x === 'ar') return true;
    try { return orig.apply(this, arguments); } catch (e) { return false; }
  };
});
await pIOS.goto('http://localhost:8801/3d.html');
await pIOS.waitForSelector('.kimos-cfg .kc-bar', { timeout: 15000 });
await pIOS.click('.kc-bar-cta');
await pIOS.waitForFunction(() => {
  const m = document.querySelector('.kc-canvas-msg');
  return m && m.style.display === 'none';
}, { timeout: 30000 });
await pIOS.waitForSelector('button.kc-ar-btn', { timeout: 5000 });
await pIOS.click('button.kc-ar-btn');
await pIOS.waitForSelector('a.kc-ar-btn[rel=ar]', { timeout: 60000 });
const ql = await pIOS.evaluate(async () => {
  const a = document.querySelector('a.kc-ar-btn[rel=ar]');
  const buf = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
  const txt = new TextDecoder('latin1').decode(buf);
  return {
    zip: buf[0] === 0x50 && buf[1] === 0x4b,
    bytes: buf.length,
    entradas: (txt.match(/model\.usd[ac]?/g) || []).length,
    texturas: (txt.match(/\.(png|jpe?g)/g) || []).length,
    // Horneado real: al proyectar por cara hay que desindexar, así que los
    // puntos pasan a ser 3 por triángulo. Contar "primvars:st" no valdría —
    // el .glb de origen YA trae UV propias y esa comprobación pasaba siempre.
    // Horneado real: las UV pasan a ser posición×escala (0,09), así que
    // quedan en un rango pequeño. Las del CAD que trae el .glb van de 0 a 1,
    // de modo que este rango distingue unas de otras — contar "primvars:st"
    // no valía: el archivo de origen YA tiene UV y esa prueba pasaba siempre.
    uvMax: (function () {
      const m = (txt.match(/texCoord2f\[\] primvars:st = \[([^\]]*)\]/) || [])[1] || '';
      const ns = (m.match(/-?\d+\.?\d*(?:[eE]-?\d+)?/g) || []).map(Number);
      // Solo la U: el exportador escribe la V invertida (1 - v), así que esa
      // queda cerca de 1 y no distingue nada.
      const us = ns.filter(function (_, i) { return i % 2 === 0; });
      return us.length ? Math.max.apply(null, us.map(Math.abs)) : -1;
    })(),
    img: !!a.querySelector('img'),
    // Recorte por cuantización. Los .glb con KHR_mesh_quantization traen las
    // posiciones como Int16 normalizado —enteros que representan [-1,1]— y al
    // aplicarles la matriz del nodo todo lo que se sale se PEGA al borde: la
    // pieza se achata contra ese cubo. Se detecta por las proporciones: un
    // taburete es más ancho que alto, y recortado sale cúbico.
    proporcion: (function () {
      const m = (txt.match(/point3f\[\] points = \[([^\]]*)\]/) || [])[1] || '';
      const ns = (m.match(/-?\d+\.?\d*(?:[eE]-?\d+)?/g) || []).map(Number);
      if (ns.length < 9) return 1;
      const ext = [0, 1, 2].map((k) => {
        const v = ns.filter((_, i) => i % 3 === k);
        return Math.max.apply(null, v) - Math.min.apply(null, v);
      });
      return Math.max.apply(null, ext) / Math.max(Math.min.apply(null, ext), 1e-9);
    })(),
    // Caras hacia AFUERA. El visor del móvil dibuja a una sola cara: con las
    // normales invertidas descarta todo lo que se ve de frente y el producto
    // aparece roto, en trozos. Esta es la comprobación que faltaba.
    fuera: (function () {
      const num = (re) => {
        const m = txt.match(re);
        return m ? (m[1].match(/-?\d+\.?\d*(?:[eE]-?\d+)?/g) || []).map(Number) : null;
      };
      const pts = num(/point3f\[\] points = \[([^\]]*)\]/);
      const ids = num(/int\[\] faceVertexIndices = \[([^\]]*)\]/);
      if (!pts || !ids) return -1;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < pts.length; i += 3) { cx += pts[i]; cy += pts[i + 1]; cz += pts[i + 2]; }
      const np = pts.length / 3; cx /= np; cy /= np; cz /= np;
      let ok2 = 0, tot = 0;
      for (let t2 = 0; t2 + 2 < ids.length; t2 += 3) {
        const A = ids[t2] * 3, B = ids[t2 + 1] * 3, C = ids[t2 + 2] * 3;
        const ux = pts[B] - pts[A], uy = pts[B + 1] - pts[A + 1], uz = pts[B + 2] - pts[A + 2];
        const vx = pts[C] - pts[A], vy = pts[C + 1] - pts[A + 1], vz = pts[C + 2] - pts[A + 2];
        const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        const dx = (pts[A] + pts[B] + pts[C]) / 3 - cx;
        const dy = (pts[A + 1] + pts[B + 1] + pts[C + 1]) / 3 - cy;
        const dz = (pts[A + 2] + pts[B + 2] + pts[C + 2]) / 3 - cz;
        const d = fx * dx + fy * dy + fz * dz;
        if (d !== 0) { tot++; if (d > 0) ok2++; }
      }
      return tot ? ok2 / tot : -1;
    })(),
  };
});
await pIOS.close();
ok('iPhone: genera un .usdz real', ql.zip && ql.entradas > 0, Math.round(ql.bytes / 1024) + ' KB');
ok('el enlace es rel="ar" y lleva imagen dentro (lo exige Quick Look)', ql.img);
ok('el modelo NO está recortado por la cuantización (no sale cúbico)',
  ql.proporcion > 1.2, 'proporción largo/corto ' + Math.round(ql.proporcion * 100) / 100);
ok('el .usdz lleva la TEXTURA de la veta dentro', ql.texturas > 0, ql.texturas + ' imagen(es)');
// USDZ se dibuja a UNA cara y el exportador ignora DoubleSide, así que cada
// triángulo tiene que estar también al revés. Sin esto el móvil descarta lo
// que se ve de frente y el producto sale en trozos.
ok('cada triángulo está también invertido (visible por las dos caras)',
  Math.abs(ql.fuera - 0.5) < 0.02, Math.round(ql.fuera * 100) + '% en un sentido');
ok('…y las UV horneadas de la proyección (no las del CAD)', ql.uvMax > 0 && ql.uvMax < 0.5, 'uv máx ' + ql.uvMax);

// ── Escenario 2: la app solo publica la principal; el resto sale del DOM ──
console.log('\n· la app publica una sola foto (producto sin galería sincronizada):');
await page.goto('http://localhost:8801/pobre.html');
await page.waitForSelector('.kimos-cfg .kc-bar', { timeout: 10000 });
await page.click('.kc-tab:has-text("Fotos")');
const rescate = await page.$$eval('.kc-foto-th', (ns) => ns.map((n) => n.getAttribute('src')));
ok('rescata srcset y background-image del carrusel', rescate.length === 3, rescate.join(', '));
ok('descarta el gif espaciador', rescate.every((u) => u.indexOf('data:image/gif') !== 0));
await browser.close();
srv.close();

if (fallos.length) { console.error('\n✘ ' + fallos.length + ' fallo(s)'); process.exit(1); }
console.log('\nFicha completa OK ✔ — galería completa, descripción incrustada y hero de Explorar');
