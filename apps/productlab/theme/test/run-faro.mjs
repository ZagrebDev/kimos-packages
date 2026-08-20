/**
 * FARO DE VERSIÓN — prueba OFFLINE del contrato "publicar SE VE".
 *
 * El kit pide primero /definition/version (incacheable, ~40 bytes) y luego el
 * catálogo con esa versión EN LA URL: cada publicación produce una URL nueva
 * y ninguna caché del camino puede servir contenido viejo.
 *
 * Valida:
 *   (a) el faro se consulta antes que el catálogo, con cache: no-store;
 *   (b) el catálogo viaja con ?v=<versión del faro>;
 *   (c) misma versión que la copia en localStorage → CERO peticiones de
 *       catálogo (el faro basta);
 *   (d) copia guardada vieja → se pide el catálogo nuevo con la v nueva;
 *   (e) si el faro no responde, el kit sigue por el camino clásico (la ficha
 *       jamás se queda sin catálogo por culpa del faro).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.error('Falta jsdom (solo para pruebas): npm i jsdom.');
  process.exit(1);
}

const SRC = fs.readFileSync(new URL('../kimos-configurador.js', import.meta.url), 'utf8');
let fallos = 0;
const t = (nombre, cond) => { console.log((cond ? '✔ ' : '✘ ') + nombre); if (!cond) fallos++; };

const KURL = 'https://kimos.local/api/public/app/i1/definition';
const prodInfo = {
  product: { id: 23008278, sku: 'PC-1', name: 'PC Gamer', options: [
    { id: 800, name: 'Color', values: [{ id: 8001, name: 'Negro' }] },
  ], images: [] },
  variant: { id: 1, price: 100000 },
};
const pagina = () => `<!doctype html><html lang="es"><body>
<div id="kc-boot"><i></i></div>
<section class="product-page"><div class="product-page__wrapper">
  <script type="application/json" class="product-form-json">${JSON.stringify({ options: {}, info: prodInfo })}</script>
  <script type="application/json" class="product-json">${JSON.stringify([{ variant: { id: 1, price: 100000 }, values: [{ value: { id: 8001 } }] }])}</script>
  <div class="product-options">
    <div class="product-options__group prod-options" data-optionid="800">
      <label><input type="radio" name="800" value="8001" checked><span>Negro</span></label>
    </div>
  </div>
  <form action="/cart/add" name="buy"><button type="button" class="product-form__button" id="add-to-cart"><span>Añadir</span></button></form>
</div></section></body></html>`;

let KIT_ESPERADO = null;   // lo fija cada escenario que lo necesite
const defDe = (updatedAt) => ({
  version: 2, updatedAt, currency: 'CLP', store: 'i1',
  ...(KIT_ESPERADO ? { kitExpected: KIT_ESPERADO } : {}),
  productos: [{ sku: 'PC-1', productId: 23008278, name: 'PC Gamer', basePrice: 100000,
    imageUrl: '', images: [], description: '', model3d: null,
    groups: [{ id: 'g-c', label: 'Color', type: 'other', values: [{ id: 'v-n', name: 'Negro', isDefault: true }] }],
    storefront: { specs: [], photosNote: '', pageSections: [{ id: 'n1', kind: 'note', show: true }], tabs: {}, style: {} } }],
});

async function montar(opts) {
  KIT_ESPERADO = opts.kitExpected || null;
  const dom = new JSDOM(pagina(), { url: 'https://tienda.local/pc-gamer', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = function () {};
  w.KIMOS_3D_URL = KURL;
  w.KIMOS_FULL = true;
  w.KIMOS_BOOT_MAX = 10;
  const llamadas = [];
  w.fetch = (url, init) => {
    llamadas.push({ url: String(url), init: init || {} });
    if (String(url).indexOf('/definition/version') !== -1) {
      if (opts.faroFalla) return Promise.reject(new Error('red'));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ v: opts.versionFaro }) });
    }
    if (String(url).indexOf('kimos-productlab') !== -1) {
      const esPropia = /-p23008278(\?|$)/.test(String(url));
      // Página POR PRODUCTO (permalink -p<id>): la unidad del enfoque por
      // producto. Solo responde si el escenario la declara.
      if (esPropia && opts.paginaProducto) {
        const defP = { ...defDe(opts.paginaProducto), productos: defDe(opts.paginaProducto).productos.map((p) => ({ ...p, pubAt: opts.paginaProducto })) };
        const html = '<html><body><textarea id="kimos-productlab-datos" style="display:none">'
          + JSON.stringify(defP) + '</textarea></body></html>';
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(html) });
      }
      if (!esPropia && opts.paginaTienda) {
        // La copia publicada en la tienda: página con el envase <textarea>.
        // Con pubAtEnAgregada, sus productos llevan el sello por-producto.
        let defA = defDe(opts.paginaTienda);
        if (opts.pubAtEnAgregada) defA = { ...defA, productos: defA.productos.map((p) => ({ ...p, pubAt: opts.pubAtEnAgregada })) };
        const html = '<html><body><textarea id="kimos-productlab-datos" style="display:none">'
          + JSON.stringify(defA) + '</textarea></body></html>';
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(html) });
      }
      return Promise.resolve({ ok: false, status: 404 });   // sin copia local en la tienda
    }
    if (opts.kimosCaido) return Promise.reject(new Error('red'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: defDe(opts.versionCatalogo || opts.versionFaro) }) });
  };
  if (opts.cachea) {
    // Copia previa en localStorage bajo la clave POR URL del kit (la que el
    // faro compara por versión).
    w.localStorage.setItem('kc-defu::' + KURL + '::23008278',
      JSON.stringify({ v: opts.cachea, def: defDe(opts.cachea) }));
  }
  w.eval(SRC);
  await new Promise((r) => setTimeout(r, 250));
  return { w, llamadas };
}

console.log('— faro: primera visita (sin copia guardada) —');
{
  const { w, llamadas } = await montar({ versionFaro: 'V2' });
  const faro = llamadas.find((x) => x.url.indexOf('/definition/version') !== -1);
  const cat = llamadas.find((x) => x.url.indexOf('/definition?') !== -1);
  t('consulta el faro', !!faro);
  t('el faro va sin caché (no-store)', !!faro && faro.init.cache === 'no-store');
  t('el catálogo viaja con la versión del faro en la URL', !!cat && /[?&]v=V2\b/.test(cat.url));
  t('la ficha montó con ese catálogo', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— faro: misma versión guardada → cero peticiones de catálogo —');
{
  const { w, llamadas } = await montar({ versionFaro: 'V2', cachea: 'V2' });
  const cats = llamadas.filter((x) => x.url.indexOf('/definition?') !== -1 || /definition$/.test(x.url.split('?')[0]) && x.url.indexOf('/version') === -1);
  t('no se pidió el catálogo (bastó el faro + copia local)', cats.length === 0);
  t('la ficha montó desde la copia', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— faro: copia guardada VIEJA → se baja la versión nueva —');
{
  const { w, llamadas } = await montar({ versionFaro: 'V3', cachea: 'V2' });
  const cat = llamadas.find((x) => x.url.indexOf('/definition?') !== -1);
  t('pidió el catálogo con la v nueva', !!cat && /[?&]v=V3\b/.test(cat.url));
  t('la ficha montó', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— faro caído → camino clásico, la ficha vive —');
{
  const { w, llamadas } = await montar({ faroFalla: true, versionCatalogo: 'V9' });
  const cat = llamadas.find((x) => x.url.indexOf('product=') !== -1);
  t('pidió el catálogo igual (sin v)', !!cat && !/[?&]v=/.test(cat.url));
  t('la ficha montó', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— KIMOS COMPLETAMENTE CAÍDO → la ficha vive de la PÁGINA DE LA TIENDA —');
{
  const { w, llamadas } = await montar({ faroFalla: true, kimosCaido: true, paginaTienda: 'V4' });
  const pagina = llamadas.find((x) => x.url.indexOf('kimos-productlab') !== -1);
  t('pidió la página publicada en la tienda (mismo origen)', !!pagina);
  t('la ficha montó SIN una sola respuesta de KIMOS', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— TODO caído (faro, página y catálogo) → NADA de copias sin confirmar: ficha nativa —');
{
  // REGLA DE ORO del usuario: sin fuente confirmada no se vende con datos
  // viejos. Aunque haya copia guardada, si nadie confirma su versión manda
  // la ficha nativa del theme (precios reales de Jumpseller).
  const { w } = await montar({ faroFalla: true, kimosCaido: true, cachea: 'V2' });
  t('el kit NO montó desde la copia sin confirmar (ficha nativa al mando)',
    !w.document.querySelector('.kimos-cfg'));
}

console.log('— TODO caído y SIN copia guardada → la ficha nativa del theme queda (no hay velo eterno) —');
{
  const { w } = await montar({ faroFalla: true, kimosCaido: true });
  t('el kit no montó (no hay de dónde) y no dejó la página rota',
    !w.document.querySelector('.kimos-cfg'));
}

console.log('— PÁGINA POR PRODUCTO: se pide -p<id> ANTES que la página de la instancia —');
{
  const { w, llamadas } = await montar({ versionFaro: 'V7', paginaProducto: 'V7', paginaTienda: 'V7' });
  const propia = llamadas.findIndex((x) => /-p23008278/.test(x.url));
  const agregada = llamadas.findIndex((x) => x.url.indexOf('kimos-productlab') !== -1 && !/-p23008278/.test(x.url));
  t('pidió la página del producto', propia !== -1);
  t('no necesitó la página agregada (la propia bastó)', agregada === -1);
  t('el faro viajó con ?product= (versión por producto)',
    llamadas.some((x) => x.url.indexOf('/definition/version') !== -1 && x.url.indexOf('product=23008278') !== -1));
  t('la ficha montó desde la página del producto', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— producto sin página propia → cae a la página agregada de la instancia —');
{
  const { w, llamadas } = await montar({ versionFaro: 'V7', paginaTienda: 'V7' });
  const propia = llamadas.some((x) => /-p23008278/.test(x.url));
  t('intentó primero la página del producto', propia);
  t('la ficha montó desde la agregada', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— página agregada VIEJA pero el producto de esta ficha conserva su pubAt → sirve igual —');
{
  // Publicar OTRO producto mueve la versión global; la página agregada sigue
  // valiendo para ESTA ficha porque el pubAt de SU producto coincide.
  const { w } = await montar({ versionFaro: 'PUB-A', paginaTienda: 'X', pubAtEnAgregada: 'PUB-A' });
  t('la ficha montó (pubAt del producto coincide con el faro)', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— la publicación declara el kit que espera → un theme viejo GRITA en consola —');
{
  const { w } = await montar({ versionFaro: 'V9', kitExpected: '9.99.0' });
  t('la ficha montó igual (el aviso no rompe la venta)', !!w.document.querySelector('.kimos-cfg'));
  t('quedó la marca de kit desactualizado', w.KIMOS_KIT_DESACTUALIZADO === '9.99.0');
}
{
  const { w } = await montar({ versionFaro: 'V9', kitExpected: '1.0.0' });
  t('un kit al día no marca nada', !w.KIMOS_KIT_DESACTUALIZADO);
}

if (fallos) { console.error('\n✘ ' + fallos + ' fallo(s) en el contrato del faro'); process.exit(1); }
console.log('\nContrato del faro OK ✔ — publicar se ve, la DISPONIBILIDAD no depende de KIMOS (página de la tienda como fuente primaria) y JAMÁS se venden datos sin confirmar: sin fuente confiable manda la ficha nativa. El kit viejo grita en consola. Todo verificado offline');
