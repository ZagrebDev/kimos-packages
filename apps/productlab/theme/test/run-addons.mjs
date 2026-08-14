/**
 * Contrato ANCLA + ADDONS — prueba OFFLINE de la ficha cuando el producto se
 * publica con el modelo nuevo: el COLOR como única opción de variantes y cada
 * valor de los demás pasos como una opción `addon` "Paso: Valor" (checkbox
 * nativo con data-addon-price, como la pinta el theme de Jumpseller).
 *
 * Valida:
 *   (a) los checkboxes se agrupan por paso en grupos VIRTUALES y el paso a
 *       paso los pinta igual que siempre;
 *   (b) al montar, cada paso visible queda con su default MARCADO en el
 *       checkbox nativo (es lo que la tienda cobrará en el submit);
 *   (c) elegir un valor marca su checkbox y desmarca los hermanos (un paso =
 *       una elección) disparando `change` (el theme recalcula su precio);
 *   (d) el precio mostrado = variante de color + Σ addons marcados;
 *   (e) un paso oculto por dependencia no deja NINGÚN checkbox marcado, y al
 *       reaparecer recupera su default;
 *   (f) cambiar el color cambia la BASE (variante) sin tocar los addons;
 *   (g) sin combinación imposible: nunca se muestra "No disponible" por los
 *       addons (la variante se casa solo con el color).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.error('Falta jsdom (solo para pruebas): npm i jsdom, o exporta NODE_PATH a un node_modules que lo tenga.');
  process.exit(1);
}

const SRC = fs.readFileSync(new URL('../kimos-configurador.js', import.meta.url), 'utf8');

let fallos = 0;
const t = (nombre, cond) => { console.log((cond ? '✔ ' : '✘ ') + nombre); if (!cond) fallos++; };

// ── Réplica mínima del theme con el modelo ancla+addons ────────────────────
// Color = opción `option` (radios). Los demás valores = un checkbox por
// opción addon, con el MISMO markup que partials/product_options.liquid.
const OPTS = [
  { id: 800, name: 'Color', values: [{ id: 8001, name: 'Negro' }, { id: 8002, name: 'Blanco' }] },
  { id: 910, name: 'Tarjeta de video: Sin tarjeta', values: [] },
  { id: 911, name: 'Tarjeta de video: RTX 4060', values: [] },
  { id: 920, name: 'Refrigeración: Estándar', values: [] },
  { id: 921, name: 'Refrigeración: Líquida', values: [] },
];
const ADDON_PRICES = { 910: 0, 911: 350000, 920: 0, 921: 90000 };
const colorHtml = `
  <fieldset class="product-options__fieldset" data-optionid="800">
    <div class="product-options__title">Color</div>
    <div class="product-options__group prod-options" data-field-type="radio" data-optionid="800">
      <label><input type="radio" name="800" value="8001" checked><span>Negro</span></label>
      <label><input type="radio" name="800" value="8002"><span>Blanco</span></label>
    </div>
  </fieldset>`;
const addonHtml = [910, 911, 920, 921].map((id) => `
  <fieldset class="product-options__addon" data-optionid="${id}">
    <label class="product-options__checkbox">
      <input class="prod-options" type="checkbox" name="${id}" value="Yes" data-optionid="${id}" data-addon-price="${ADDON_PRICES[id]}">
      <span>${OPTS.filter((o) => o.id === id)[0].name}</span>
    </label>
  </fieldset>`).join('');
const prodInfo = {
  product: { id: 23008278, sku: 'PC-1', name: 'PC Gamer', options: OPTS, images: ['https://cdn.local/p1.jpg'] },
  variant: { id: 1, price: 100000 },
};
// Variantes REALES: solo el color (una por color, precio = ancla + delta).
const VARIANTES = [
  { variant: { id: 1, price: 100000 }, values: [{ value: { id: 8001 } }] },
  { variant: { id: 2, price: 120000 }, values: [{ value: { id: 8002 } }] },
];
const pagina = () => `<!doctype html><html lang="es"><body>
<div id="kc-boot"><i></i></div>
<section class="product-page" style="padding-top:40px;margin-top:24px">
  <div class="product-page__wrapper">
    <script type="application/json" class="product-form-json">${JSON.stringify({ options: {}, info: prodInfo })}</script>
    <script type="application/json" class="product-json">${JSON.stringify(VARIANTES)}</script>
    <div class="product-options">${colorHtml}${addonHtml}</div>
    <form action="/cart/add" name="buy">
      <input type="number" id="input-qty" name="qty" value="1">
      <button type="button" class="button product-form__button" id="add-to-cart"><span>Añadir al carro</span></button>
    </form>
  </div>
</section>
<footer class="footer">Pie del theme</footer></body></html>`;

const grupos = () => ([
  { id: 'g-color', label: 'Color', type: 'other', affectsPhoto: false, dependsOn: null, values: [
    { id: 'v-negro', name: 'Negro', qty: 1, delta: 0, isDefault: true },
    { id: 'v-blanco', name: 'Blanco', qty: 1, delta: 20000, isDefault: false },
  ] },
  { id: 'g-gpu', label: 'Tarjeta de video', type: 'other', affectsPhoto: false, dependsOn: null, values: [
    { id: 'v-nogpu', name: 'Sin tarjeta', qty: 1, delta: 0, isDefault: true },
    { id: 'v-rtx', name: 'RTX 4060', qty: 1, delta: 350000, isDefault: false },
  ] },
  // Refrigeración SOLO aparece con la RTX elegida: al ocultarse, ninguno de
  // sus checkboxes puede quedar marcado.
  { id: 'g-ref', label: 'Refrigeración', type: 'other', affectsPhoto: false,
    dependsOn: { groupId: 'g-gpu', valueIds: ['v-rtx'] }, values: [
    { id: 'v-std', name: 'Estándar', qty: 1, delta: 0, isDefault: true },
    { id: 'v-liq', name: 'Líquida', qty: 1, delta: 90000, isDefault: false },
  ] },
]);

const def = {
  version: 2, currency: 'CLP', store: 'i1',
  productos: [{
    sku: 'PC-1', productId: 23008278, name: 'PC Gamer', basePrice: 100000,
    imageUrl: 'https://cdn.local/p1.jpg', images: ['https://cdn.local/p1.jpg'],
    description: 'Un PC configurable.', model3d: null, groups: grupos(),
    storefront: { specs: [], photosNote: '', pageSections: [{ id: 'n1', kind: 'note', show: true }], tabs: {},
      style: { cardStyle: 'cards', stepsCollapsed: false } },
  }],
};

const { VirtualConsole } = require('jsdom');
const vc = new VirtualConsole();
vc.on('error', (...a) => console.error('[dom]', ...a));
vc.on('warn', (...a) => console.warn('[dom]', ...a));
vc.on('info', (...a) => console.info('[dom]', ...a));
vc.on('log', (...a) => console.log('[dom]', ...a));
vc.on('jsdomError', (e) => console.error('[dom-err]', e && e.message));
const dom = new JSDOM(pagina(), {
  url: 'https://tienda.local/pc-gamer',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const w = dom.window;
w.HTMLElement.prototype.scrollIntoView = function () {};
w.scrollTo = function () {};
w.KIMOS_3D_URL = 'https://kimos.local/api/public/app/i1/definition';
w.KIMOS_FULL = true;
w.KIMOS_BOOT_MAX = 10;
w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: def }) });
w.eval(SRC);
await new Promise((r) => setTimeout(r, 250));
const d = w.document;
// Entrar al personalizador (los pasos viven en su propia vista, tras el CTA
// "Configurar" de la barra).
{
  const cta = d.querySelector('.kc-bar-cta');
  if (cta) cta.dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
}

const cb = (id) => d.querySelector('input[data-optionid="' + id + '"]');
const pasos = () => Array.prototype.map.call(d.querySelectorAll('.kc-step'), (s) => s);
const pasoPorTitulo = (titulo) => pasos().filter((s) => {
  const h = s.querySelector('.kc-step-t');
  return h && h.textContent.trim() === titulo;
})[0] || null;
const cardDe = (paso, nombre) => Array.prototype.filter.call(paso.querySelectorAll('.kc-card'), (c) =>
  (c.querySelector('.kc-card-n') || c).textContent.indexOf(nombre) !== -1)[0] || null;
const precioPanel = () => {
  const p = d.querySelector('.kc-price');
  return p ? p.textContent.trim() : '';
};
// El theme recalcula su precio escuchando `change` en los checkboxes: aquí se
// cuenta cada disparo para verificar que el kit avisa como un click humano.
let cambios = 0;
[910, 911, 920, 921].forEach((id) => cb(id).addEventListener('change', () => { cambios++; }));

console.log('— ancla+addons: montaje —');
t('la ficha KIMOS montó', !!d.querySelector('.kimos-cfg'));
t('el paso Color se pinta (grupo real)', !!pasoPorTitulo('Color'));
t('el paso de addons se pinta (grupo virtual)', !!pasoPorTitulo('Tarjeta de video'));
t('el paso dependiente arranca oculto', !pasoPorTitulo('Refrigeración'));
t('el default del paso addon quedó MARCADO en el checkbox nativo', cb(910).checked === true);
t('el valor no elegido está desmarcado', cb(911).checked === false);
t('el paso oculto no deja checkboxes marcados', cb(920).checked === false && cb(921).checked === false);
t('precio = variante Negro + addons marcados ($100.000)', /100\.000/.test(precioPanel()));
t('no marca "No disponible" (la variante casa solo con el color)', precioPanel().indexOf('No disponible') === -1);

console.log('— ancla+addons: elegir un addon con recargo —');
{
  const paso = pasoPorTitulo('Tarjeta de video');
  const antes = cambios;
  cardDe(paso, 'RTX 4060').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  t('el checkbox del valor elegido quedó marcado', cb(911).checked === true);
  t('el hermano se desmarcó (un paso = una elección)', cb(910).checked === false);
  t('cada toggle disparó change para el theme', cambios >= antes + 2);
  t('precio = variante + RTX ($450.000)', /450\.000/.test(precioPanel()));
  t('el paso dependiente REAPARECE', !!pasoPorTitulo('Refrigeración'));
  t('…y recupera su default marcado', cb(920).checked === true && cb(921).checked === false);
}

console.log('— ancla+addons: paso dependiente con recargo —');
{
  const paso = pasoPorTitulo('Refrigeración');
  cardDe(paso, 'Líquida').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  t('precio suma la refrigeración ($540.000)', /540\.000/.test(precioPanel()));
}

console.log('— ancla+addons: cambiar el color cambia la BASE —');
{
  const paso = pasoPorTitulo('Color');
  cardDe(paso, 'Blanco').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  t('precio = variante Blanco + addons ($560.000)', /560\.000/.test(precioPanel()));
  t('los addons no se tocaron al cambiar el color', cb(911).checked === true && cb(921).checked === true);
}

console.log('— ancla+addons: ocultar el paso dependiente desmarca sus checkboxes —');
{
  const paso = pasoPorTitulo('Tarjeta de video');
  cardDe(paso, 'Sin tarjeta').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  t('el paso dependiente vuelve a ocultarse', !pasoPorTitulo('Refrigeración'));
  t('sus checkboxes quedaron TODOS desmarcados', cb(920).checked === false && cb(921).checked === false);
  t('precio de vuelta a la base del color ($120.000)', /120\.000/.test(precioPanel()));
}

if (fallos) {
  console.error('\n✘ ' + fallos + ' fallo(s) en el contrato ancla+addons');
  process.exit(1);
}
console.log('\nContrato ancla+addons OK ✔ — grupos virtuales, defaults marcados, change al theme, precio variante+addons y dependencias verificados offline');
