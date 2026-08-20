/**
 * CONTRATO DE LECTURA v6 — prueba OFFLINE de "la tienda se sirve sola".
 *
 * Decisión del usuario: sin faro, sin versiones, sin copias en el navegador.
 * La ficha lee la PÁGINA publicada en la propia tienda (primero la del
 * producto -p<id>, después la agregada de la instancia) y KIMOS aparece solo
 * como respaldo de ARRANQUE (tienda que aún no publica su página). Los
 * precios ni pasan por aquí: los cobra la tienda con sus opciones nativas.
 *
 * Valida:
 *   (a) con página del producto: monta SIN UNA SOLA llamada a KIMOS;
 *   (b) sin página propia → cae a la página agregada;
 *   (c) sin páginas → KIMOS como respaldo de arranque (catálogo recortado);
 *   (d) sin nada → ficha nativa del theme (no hay velo eterno);
 *   (e) VENCIMIENTO LOCAL (licencia): publicación más vieja que kitTtlDias →
 *       ficha nativa; kitTtlDias 0 → no vence; fresca → monta;
 *   (f) kitExpected mayor que el kit del theme → grita en consola (y monta).
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

const defDe = (updatedAt, extra) => ({
  version: 2, updatedAt, currency: 'CLP', store: 'i1',
  ...(extra || {}),
  productos: [{ sku: 'PC-1', productId: 23008278, name: 'PC Gamer', basePrice: 100000,
    imageUrl: '', images: [], description: '', model3d: null,
    groups: [{ id: 'g-c', label: 'Color', type: 'other', values: [{ id: 'v-n', name: 'Negro', isDefault: true }] }],
    storefront: { specs: [], photosNote: '', pageSections: [{ id: 'n1', kind: 'note', show: true }], tabs: {}, style: {} } }],
});
const envase = (def) => '<html><body><textarea id="kimos-productlab-datos" style="display:none">'
  + JSON.stringify(def) + '</textarea></body></html>';

async function montar(opts) {
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
    if (String(url).indexOf('kimos.local') !== -1) {
      // TODO lo de KIMOS pasa por aquí: catálogo de respaldo (o rechazo).
      if (opts.kimosCaido || !opts.kimosDef) return Promise.reject(new Error('red'));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: opts.kimosDef }) });
    }
    if (String(url).indexOf('kimos-productlab') !== -1) {
      const esPropia = /-p23008278(\?|$)/.test(String(url));
      if (esPropia && opts.paginaProducto) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(envase(opts.paginaProducto)) });
      }
      if (!esPropia && opts.paginaTienda) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(envase(opts.paginaTienda)) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }
    return Promise.resolve({ ok: false, status: 404 });
  };
  w.eval(SRC);
  await new Promise((r) => setTimeout(r, 250));
  return { w, llamadas };
}

const HOY = new Date().toISOString();
const HACE = (dias) => new Date(Date.now() - dias * 86400000).toISOString();

console.log('— página del producto → monta SIN UNA SOLA llamada a KIMOS —');
{
  const { w, llamadas } = await montar({ paginaProducto: defDe(HOY), paginaTienda: defDe(HOY) });
  const aKimos = llamadas.filter((x) => x.url.indexOf('kimos.local') !== -1);
  const propia = llamadas.findIndex((x) => /-p23008278/.test(x.url));
  const agregada = llamadas.findIndex((x) => x.url.indexOf('kimos-productlab') !== -1 && !/-p23008278/.test(x.url));
  t('pidió la página del producto (-p<id>)', propia !== -1);
  t('CERO llamadas a KIMOS (ni faro, ni versiones, ni catálogo)', aKimos.length === 0);
  t('no necesitó la página agregada', agregada === -1);
  t('la página se pide sin caché (publicar se ve al tiro)',
    llamadas[propia] && llamadas[propia].init.cache === 'no-store');
  t('la ficha montó', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— sin página propia → cae a la página agregada de la instancia —');
{
  const { w, llamadas } = await montar({ paginaTienda: defDe(HOY) });
  t('intentó primero la del producto', llamadas.some((x) => /-p23008278/.test(x.url)));
  t('la ficha montó desde la agregada, sin KIMOS',
    !!w.document.querySelector('.kimos-cfg') && !llamadas.some((x) => x.url.indexOf('kimos.local') !== -1));
}

console.log('— sin páginas publicadas → KIMOS como respaldo de ARRANQUE —');
{
  const { w, llamadas } = await montar({ kimosDef: defDe(HOY) });
  const cat = llamadas.find((x) => x.url.indexOf('kimos.local') !== -1);
  t('pidió el catálogo a KIMOS recortado al producto', !!cat && cat.url.indexOf('product=') !== -1);
  t('la ficha montó', !!w.document.querySelector('.kimos-cfg'));
}

console.log('— sin páginas y KIMOS caído → ficha nativa del theme (no hay velo eterno) —');
{
  const { w } = await montar({ kimosCaido: true });
  t('el kit no montó y no dejó la página rota', !w.document.querySelector('.kimos-cfg'));
}

console.log('— VENCIMIENTO LOCAL (licencia): publicación vieja → ficha nativa —');
{
  const { w } = await montar({ paginaProducto: defDe(HACE(120), { kitTtlDias: 90 }) });
  t('publicada hace 120 días con plazo 90 → el kit NO monta', !w.document.querySelector('.kimos-cfg'));
}
{
  const { w } = await montar({ paginaProducto: defDe(HACE(120), { kitTtlDias: 0 }) });
  t('plazo 0 = no vence → monta igual', !!w.document.querySelector('.kimos-cfg'));
}
{
  const { w } = await montar({ paginaProducto: defDe(HACE(5), { kitTtlDias: 90 }) });
  t('publicación fresca → monta', !!w.document.querySelector('.kimos-cfg'));
}
{
  // Sin kitTtlDias declarado rige el default (90): vieja no monta.
  const { w } = await montar({ paginaProducto: defDe(HACE(120)) });
  t('sin plazo declarado rige el default de 90 días', !w.document.querySelector('.kimos-cfg'));
}

console.log('— la publicación declara el kit que espera → un theme viejo GRITA en consola —');
{
  const { w } = await montar({ paginaProducto: defDe(HOY, { kitExpected: '99.0.0' }) });
  t('la ficha montó igual (el aviso no rompe la venta)', !!w.document.querySelector('.kimos-cfg'));
  t('quedó la marca de kit desactualizado', w.KIMOS_KIT_DESACTUALIZADO === '99.0.0');
}
{
  const { w } = await montar({ paginaProducto: defDe(HOY, { kitExpected: '1.0.0' }) });
  t('un kit al día no marca nada', !w.KIMOS_KIT_DESACTUALIZADO);
}

if (fallos) { console.error('\n✘ ' + fallos + ' fallo(s) en el contrato de lectura v6'); process.exit(1); }
console.log('\nContrato de lectura v6 OK ✔ — la ficha vive de la página de la tienda (cero KIMOS en la visita), KIMOS solo arranca tiendas sin página, el vencimiento local protege la licencia sin depender de nadie, y el kit viejo grita. Todo verificado offline');
