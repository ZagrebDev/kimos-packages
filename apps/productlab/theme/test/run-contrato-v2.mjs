/**
 * Contrato v2 (ProductLab) — prueba OFFLINE de la ficha completa, sin
 * navegador: jsdom monta una réplica mínima de la ficha de producto de un
 * theme Jumpseller y se ejecuta kimos-configurador.js tal cual, con el fetch
 * del JSON público simulado.
 *
 * Valida:
 *   (a) dependsOn: pasos dependientes, cadenas, forzado del default en los
 *       SELECTS NATIVOS al ocultarse un paso, y el aviso del ajuste;
 *   (b) secciones `imagen` (width full/content, link);
 *   (c) storefront.style: accentColor, radius, cardStyle, showDeltas,
 *       stepsCollapsed;
 *   (d) hero `height:'auto'` y bloque photo `size:'auto'`;
 *   (e) degradación elegante con JSON version 1 (y alias `equipos`).
 *
 * jsdom es solo de pruebas y NO es dependencia del kit: instala jsdom en
 * cualquier carpeta y apunta NODE_PATH a su node_modules, o `npm i jsdom`.
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
// jsdom no resuelve var() en el cascade, así que el estilo que no se puede
// comprobar computado se comprueba sobre la hoja tal cual se publica.
const CSS_SRC = fs.readFileSync(new URL('../kimos-configurador.css', import.meta.url), 'utf8');

let fallos = 0;
const t = (nombre, cond) => { console.log((cond ? '✔ ' : '✘ ') + nombre); if (!cond) fallos++; };

// ── Réplica mínima del theme: product-form-json + selects .prod-options ────
const OPTS = [
  { id: 900, name: 'Modelo', values: [{ id: 9001, name: 'Base' }, { id: 9002, name: 'Pro' }] },
  // OJO: 'RTX 4060' va PRIMERA a propósito — el select nativo arranca en ella
  // y el default de KIMOS es 'Sin tarjeta': el forzado inicial debe corregirlo.
  { id: 910, name: 'Tarjeta de video', values: [{ id: 9101, name: 'RTX 4060' }, { id: 9102, name: 'Sin tarjeta' }] },
  { id: 920, name: 'Refrigeración', values: [{ id: 9201, name: 'Estándar' }, { id: 9202, name: 'Líquida' }] },
];
const selectsHtml = OPTS.map((o) =>
  `<fieldset class="product-options__fieldset" data-optionid="${o.id}">
     <div class="product-options__title">${o.name}</div>
     <select class="prod-options" data-optionid="${o.id}">${o.values.map((v) => `<option value="${v.id}">${v.name}</option>`).join('')}</select>
   </fieldset>`).join('');
const prodInfo = {
  // El theme imprime también las fotos de las VARIANTES: no son del producto y
  // no deben acabar en la sección Fotos.
  product: { id: 23008278, sku: 'PC-1', name: 'PC Gamer', options: OPTS,
    images: ['https://cdn.local/p1.jpg', 'https://cdn.local/variante-negro.jpg', 'https://cdn.local/variante-blanco.jpg'] },
  variant: { id: 1, price: 100000 },
};
// Variantes REALES del theme (script.product-json): la lista completa con el
// precio de cada combinación, que es de donde debe salir el precio mostrado.
const VARIANTES = [
  { variant: { id: 1, price: 100000 }, values: [{ value: { id: 9001 } }, { value: { id: 9102 } }, { value: { id: 9201 } }] },
  { variant: { id: 2, price: 300000 }, values: [{ value: { id: 9002 } }, { value: { id: 9102 } }, { value: { id: 9201 } }] },
];
const pagina = () => `<!doctype html><html lang="es"><body>
<div id="kc-boot"><i></i></div>
<section class="product-page" style="padding-top:40px;margin-top:24px">
  <div class="product-page__wrapper">
    <script type="application/json" class="product-form-json">${JSON.stringify({ options: {}, info: prodInfo })}</script>
    <script type="application/json" class="product-json">${JSON.stringify(VARIANTES)}</script>
    <div class="product-options">${selectsHtml}</div>
    <form action="/cart/add" name="buy">
      <div class="product-form__quantity">
        <button type="button" class="button product-form__handler quantity-down" disabled>−</button>
        <input type="number" id="input-qty" name="qty" value="1">
        <button type="button" class="button product-form__handler quantity-up">+</button>
      </div>
      <button type="button" class="button product-form__button" id="add-to-cart" disabled><span>Añadir al carro</span></button>
    </form>
  </div>
</section></body></html>`;

// ── Grupos KIMOS (con o sin dependencias) ──────────────────────────────────
const grupos = (conDeps) => ([
  { id: 'g-modelo', label: 'Modelo', type: 'other', affectsPhoto: false, dependsOn: null, values: [
    { id: 'v-base', name: 'Base', qty: 1, delta: 0, isDefault: true },
    { id: 'v-pro', name: 'Pro', qty: 2, delta: 200000, isDefault: false },
  ] },
  { id: 'g-gpu', label: 'Tarjeta de video', type: 'other', affectsPhoto: false,
    dependsOn: conDeps ? { groupId: 'g-modelo', valueIds: ['v-pro'] } : null, values: [
    { id: 'v-nogpu', name: 'Sin tarjeta', qty: 1, delta: 0, isDefault: true },
    { id: 'v-rtx', name: 'RTX 4060', qty: 1, delta: 350000, isDefault: false },
  ] },
  { id: 'g-ref', label: 'Refrigeración', type: 'other', affectsPhoto: false,
    dependsOn: conDeps ? { groupId: 'g-gpu', valueIds: ['v-rtx'] } : null, values: [
    { id: 'v-std', name: 'Estándar', qty: 1, delta: 0, isDefault: true },
    { id: 'v-liq', name: 'Líquida', qty: 1, delta: 90000, isDefault: false },
  ] },
]);

const producto = (extra) => Object.assign({
  sku: 'PC-1', productId: 23008278, name: 'PC Gamer', basePrice: 100000,
  imageUrl: 'https://cdn.local/p1.jpg', images: ['https://cdn.local/p1.jpg'],
  description: 'Un PC configurable.', model3d: null, groups: grupos(true),
  storefront: { specs: [], photosNote: '', pageSections: [], tabs: {} },
}, extra);

async function montar(def, prep) {
  const dom = new JSDOM(pagina(), {
    url: 'https://tienda.local/pc-gamer',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = function () {};
  w.KIMOS_3D_URL = 'https://kimos.local/api/public/app/i1/definition';
  w.KIMOS_FULL = true;
  w.KIMOS_BOOT_MAX = 10;   // el tope real son 4 s; aquí no hay imágenes que cargar
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: def }) });
  if (prep) prep(w);   // estado previo de la página (selecciones del theme)
  w.eval(SRC);
  await new Promise((r) => setTimeout(r, 250));  // loadDefinition + espera de imágenes + fundido
  return w;
}

// ═══ Escenario 0: barra configurable, fotos y contraste garantizado ════════
console.log('— v2: barra (style.bar), fotos (style.photos) y contraste —');
{
  const def = {
    version: 2, currency: 'CLP', store: 'i1',
    productos: [producto({
      images: ['https://cdn.local/p1.jpg', 'https://cdn.local/p2.jpg', 'https://cdn.local/p3.jpg'],
      storefront: {
        specs: [], photosNote: '',
        pageSections: [
          { id: 'h1', kind: 'hero', pattern: 'apilado', slots: { top: [
            { type: 'cta', label: 'Comprar', style: 'primary' },
            { type: 'icons', align: 'left', color: '#223344', items: [
              { id: 'ic1', icon: '❄️', title: 'Refrigeración líquida', text: 'Silencioso bajo carga' },
              { id: 'ic2', icon: '⚡', title: 'Fuente 80+', text: '' },
            ] },
          ] } },
          { id: 'f1', kind: 'fotos', show: true },
        ],
        tabs: { showSpecs: true, showFotos: true, order: ['explorar', 'specs', 'fotos'] },
        style: {
          bar: { bgColor: '#101418', textColor: '', width: 'full', sticky: false, offset: 12, showThumb: false },
          photos: { size: 'l', cols: 3, layout: 'lado', mainSize: 'xl', thumbSize: 's', fit: 'cover', frame: false },
          buyLabel: 'Personalizar',
          spinnerColor: '#FF00AA',
        },
      },
    })],
  };
  const w = await montar(def);
  const d = w.document;
  const root = d.querySelector('.kimos-cfg');
  const bar = d.querySelector('.kc-bar');
  t('barra con fondo propio', bar.style.background !== '');
  t('barra: texto por contraste sobre fondo oscuro', bar.style.color === 'rgb(255, 255, 255)' || bar.style.color === '#fff');
  t('barra a ancho completo', bar.classList.contains('kc-bar-full'));
  t('barra no pegajosa (sticky:false)', bar.classList.contains('kc-bar-static'));
  t('separación extra bajo el menú', root.style.getPropertyValue('--kc-bar-offset') === '12px');
  t('miniatura oculta (showThumb:false)', !d.querySelector('.kc-bar-thumb'));
  t('pestañas secundarias marcadas para móvil', d.querySelectorAll('.kc-tab.kc-tab-sec').length >= 1);
  t('sin la clase de pestañas en móvil (default)', !root.classList.contains('kc-bar-mtabs'));
  const boot = d.getElementById('kc-boot');
  const fotos = d.querySelector('.kc-fotos');
  // Solo la galería publicada del producto: nada de fotos de variantes.
  t('la galería es la del producto, sin fotos de variantes',
    fotos.querySelectorAll('.kc-foto-th').length === 3
    && !fotos.innerHTML.indexOf('variante-') !== -1);
  t('fotos con tamaño configurado', fotos && fotos.getAttribute('data-size') === 'l');
  t('fotos por fila configuradas', fotos && fotos.style.getPropertyValue('--kc-foto-cols') === '3');
  // Disposición, altos, miniaturas, encaje y marco: cinco ejes independientes.
  t('galería: disposición, altos, miniaturas, encaje y marco',
    fotos.getAttribute('data-layout') === 'lado' && fotos.getAttribute('data-main') === 'xl'
    && fotos.getAttribute('data-thumb') === 's' && fotos.getAttribute('data-fit') === 'cover'
    && fotos.getAttribute('data-frame') === 'no');
  t('el spinner de arranque toma su color del estilo',
    !boot || boot.style.getPropertyValue('--kc-boot-accent') === '#FF00AA');
  // El acento SIEMPRE resuelve a un color sólido: sin esto el botón quedaba
  // blanco sobre blanco dentro de un hero con texto claro.
  const acento = w.getComputedStyle(root).getPropertyValue('--kc-accent').trim();
  t('acento nunca es currentColor', acento !== 'currentColor');
  // El texto del botón que lleva al configurador viaja en el ESTILO, para
  // cambiarlo de una vez en todos los productos de una plantilla.
  t('botón de la barra con el texto del estilo', d.querySelector('.kc-bar-cta').textContent === 'Personalizar');
  // Velo de arranque: tapa hasta que la ficha está pintada y con sus fotos, y
  // se retira fundiéndose (nunca de golpe, que es lo que se veía como cambiazo).
  t('el velo de arranque se retira al estar lista la ficha', !boot || boot.classList.contains('kc-boot-out'));
  // La ficha arranca pegada a la barra: el aire que el theme deja encima de la
  // sección de producto se veía como un hueco entre la barra fija y el hero.
  const seccion = d.querySelector('.product-page');
  t('sin hueco entre la barra y el hero', seccion.style.paddingTop === '0px' && seccion.style.marginTop === '0px');
  // Iconos destacados: se veían como texto suelto y centrado en la tienda
  // mientras el previsualizador de la app los dibujaba con filete de acento.
  const iconos = d.querySelector('.kc-b-icons');
  t('bloque de iconos renderizado', !!iconos && iconos.querySelectorAll('.kc-icon').length === 2);
  t('iconos: alineación en atributo (el flex no lee text-align)', iconos.getAttribute('data-align') === 'left');
  t('iconos: color del bloque aplicado', iconos.style.color !== '');
  t('iconos: icono, título y detalle', !!iconos.querySelector('.kc-icon-i')
    && iconos.querySelectorAll('.kc-icon-t').length === 2
    && iconos.querySelectorAll('.kc-icon-x').length === 1);
  t('iconos: el CSS les da el filete de acento', /\.kc-icon\s*\{[^}]*border-left:[^;]*var\(--kc-accent\)/.test(CSS_SRC));
  // Paridad visual con la ficha de computadores: galería con visor y flechas,
  // filas del hero marcadas para repartir el alto, y paleta derivada del fondo.
  t('galería: flechas y contador', !!d.querySelector('.kc-foto-prev') && !!d.querySelector('.kc-foto-next')
    && (d.querySelector('.kc-foto-count') || {}).textContent === '1 / 3');
  d.querySelector('.kc-foto-next').click();
  t('galería: la flecha cambia la foto y el contador',
    (d.querySelector('.kc-foto-count') || {}).textContent === '2 / 3'
    && d.querySelectorAll('.kc-foto-th')[1].classList.contains('on'));
  t('filas del hero con nº de celdas', !!d.querySelector('.kc-row[data-cols]'));
  t('paleta derivada: borde, plata y gris', root.style.getPropertyValue('--kc-borde') !== ''
    && root.style.getPropertyValue('--kc-plata') !== '' && root.style.getPropertyValue('--kc-gris') !== '');
  t('el SKU acompaña al título', !!d.querySelector('.kc-b-title .kc-b-sku') || !d.querySelector('.kc-b-title'));
  // La barra va FIJA (sticky moría dentro de themes con overflow) y su hueco
  // lo guarda el envoltorio, así el contenido no se le mete debajo.
  t('la barra vive en su hueco', bar.parentNode.classList.contains('kc-bar-wrap'));
  t('sticky:false → el hueco no reserva alto', bar.parentNode.classList.contains('kc-bar-wrap-static'));
  t('el CSS la fija, no la pega', /\.kc-bar\s*\{[^}]*position:\s*fixed/.test(CSS_SRC));

  // Al bajar a Fotos/Especificaciones se descuenta DÓNDE TERMINA la barra (va
  // fija bajo el menú del sitio), no su alto: con el alto a secas el título de
  // la sección quedaba detrás. jsdom no hace layout: se simulan las medidas
  // POR CLASE, porque al cambiar de pestaña se repinta y los nodos son otros.
  const RECT = { left: 0, right: 1000, width: 1000, x: 0, y: 0, toJSON() { return this; } };
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.classList && this.classList.contains('kc-bar')) return Object.assign({ top: 100, bottom: 164, height: 64 }, RECT);
    if (this.classList && this.classList.contains('kc-fotos')) return Object.assign({ top: 500, bottom: 900, height: 400 }, RECT);
    return Object.assign({ top: 0, bottom: 0, height: 0 }, RECT);
  };
  let bajarA = null;
  w.scrollTo = (o) => { bajarA = o && o.top; };
  Array.prototype.slice.call(d.querySelectorAll('.kc-tab'))
    .filter((b2) => /Fotos/.test(b2.textContent))[0].click();
  await new Promise((r) => setTimeout(r, 60));
  t('la sección queda bajo la barra, no detrás', bajarA === 500 - 164 - 12);
  w.close();
}

// ═══ Escenario 1: JSON v2 completo (deps + style + imagen + hero auto) ═════
console.log('— v2: dependencias, style, secciones imagen, hero/photo auto —');
{
  const def = {
    version: 2, updatedAt: '2026-07-27T00:00:00Z', currency: 'CLP', store: 'i1',
    productos: [producto({
      storefront: {
        specs: [], photosNote: '',
        pageSections: [
          { id: 'h1', kind: 'hero', pattern: 'apilado', height: 'auto', bgColor: '', bgImageUrl: '', textColor: '', overlay: false,
            slots: { top: [{ type: 'title' }], middle: [{ type: 'photo', size: 'auto' }], bottom: [] } },
          { id: 'i1', kind: 'imagen', imageUrl: 'https://cdn.local/banner-full.jpg', alt: '', width: 'full', link: '' },
          { id: 'i2', kind: 'imagen', imageUrl: 'https://cdn.local/banner-content.jpg', alt: 'detalle', width: 'content', link: 'https://tienda.local/landing' },
        ],
        tabs: { explorar: '', fotos: '', specs: '', comprar: '', showSpecs: true, showFotos: true, order: ['explorar', 'specs', 'fotos'] },
        style: { accentColor: '#ff5500', bgColor: '#101418', radius: 10, cardStyle: 'compact', showDeltas: 'none', stepsCollapsed: true },
      },
    })],
  };
  const w = await montar(def);
  const d = w.document;
  const root = d.querySelector('.kimos-cfg');
  t('monta la ficha completa', !!root);
  // Sin color propio, la barra ES la ficha: hereda su fondo y su texto.
  const bar1 = d.querySelector('.kc-bar');
  t('barra sin color propio hereda el de la ficha', bar1.style.background === '' && bar1.style.color === '');
  t('barra fija: su hueco reserva alto', bar1.parentNode.classList.contains('kc-bar-wrap')
    && !bar1.parentNode.classList.contains('kc-bar-wrap-static'));

  // (d) hero height auto + photo size auto
  t('hero con height auto (.kc-h-auto)', !!d.querySelector('.kc-hero.kc-h-auto'));
  t('bloque photo con size auto (.kc-photo-auto)', !!d.querySelector('.kc-hero img.kc-photo-auto'));

  // (b) dos secciones imagen: full y content con link
  t('dos secciones imagen renderizadas', d.querySelectorAll('.kc-imagen').length === 2);
  // El sangrado lo aplica ahora la clase de ANCHO POR SECCIÓN (kc-sec-full),
  // común a heros, imágenes, specs y fotos.
  t('imagen width full (sangrado)', !!d.querySelector('.kc-imagen.kc-sec-full img[src="https://cdn.local/banner-full.jpg"]'));
  const conLink = d.querySelector('.kc-imagen:not(.kc-imagen-full) a');
  t('imagen width content envuelta en su link', !!conLink
    && conLink.getAttribute('href') === 'https://tienda.local/landing'
    && !!conLink.querySelector('img[src="https://cdn.local/banner-content.jpg"]'));

  // (c) style
  t('accentColor → --kc-accent', root.style.getPropertyValue('--kc-accent') === '#ff5500');
  t('radius → --kc-radius: 10px', root.style.getPropertyValue('--kc-radius') === '10px');
  t('cardStyle compact → clase kc-style-compact', root.classList.contains('kc-style-compact'));
  t('bgColor oscuro → modo kc-dark recalculado', root.classList.contains('kc-dark'));

  // (a) forzado inicial: el paso oculto queda en su default en el select nativo
  const selGpu = d.querySelector('select[data-optionid="910"]');
  const selRef = d.querySelector('select[data-optionid="920"]');
  t('paso oculto forzado a su default en el SELECT NATIVO (Sin tarjeta)', selGpu.value === '9102');
  t('el ajuste inicial es silencioso (sin .kc-notice)', !d.querySelector('.kc-notice'));

  // al configurador
  d.querySelector('.kc-bar-cta').click();
  let pasos = d.querySelectorAll('.kc-step');
  t('solo 1 paso visible (dependencias ocultan 2)', pasos.length === 1);
  t('renumeración: el visible es el 01', !!pasos[0] && pasos[0].querySelector('.kc-step-num').textContent === '01');
  t('showDeltas none → sin precios en las cards', d.querySelectorAll('.kc-card-price').length === 0);
  const qty = d.querySelector('.kc-card-qty');
  t('qty > 1 → multiplicador ×2 junto al nombre', !!qty && qty.textContent.trim() === '×2');
  t('stepsCollapsed: el primer paso visible arranca abierto', !pasos[0].classList.contains('kc-closed'));

  const card = (nombre) => Array.prototype.find.call(
    d.querySelectorAll('.kc-card'),
    (c) => { const n = c.querySelector('.kc-card-n'); return n && n.textContent.replace(/\s*×\d+$/, '') === nombre; });

  card('Pro').click();
  pasos = d.querySelectorAll('.kc-step');
  t('elegir Pro revela el paso dependiente (2 pasos)', pasos.length === 2);
  t('el paso que reaparece llega plegado (stepsCollapsed)', pasos[1].classList.contains('kc-closed'));

  card('RTX 4060').click();
  t('RTX elegida escrita en el select nativo', selGpu.value === '9101');
  pasos = d.querySelectorAll('.kc-step');
  t('cadena: elegir RTX revela Refrigeración (3 pasos)', pasos.length === 3);
  card('Líquida').click();
  t('Líquida elegida en su select nativo', selRef.value === '9202');

  card('Base').click();
  t('volver a Base oculta toda la cadena (1 paso)', d.querySelectorAll('.kc-step').length === 1);
  t('select nativo de Tarjeta re-forzado a Sin tarjeta', selGpu.value === '9102');
  t('select nativo de Refrigeración re-forzado a Estándar (cadena)', selRef.value === '9201');
  const nota = d.querySelector('.kc-notice');
  t('aviso del ajuste automático visible', !!nota && /Tarjeta/.test(nota.textContent));

  // ── Configurar: pasos a la izquierda, panel de compra a la derecha ──
  d.querySelector('.kc-bar-cta').click();
  const panel = d.querySelector('.kc-conf .kc-panel');
  t('el configurador abre con su panel a la derecha', !!panel
    && d.querySelector('.kc-conf').children[0].classList.contains('kc-conf-steps'));
  t('el panel trae foto, precio y carro', !!panel.querySelector('.kc-panel-foto')
    && !!panel.querySelector('.kc-price') && !!panel.querySelector('.kc-btn'));
  t('el panel resume lo elegido', (panel.querySelector('.kc-summary').textContent || '').indexOf('Modelo') !== -1);
  // El precio sale de la VARIANTE elegida, no del JSON de arranque (que solo
  // trae la primera): al cambiar de paso tiene que cambiar.
  t('precio de la variante inicial', /100\.000/.test(panel.querySelector('.kc-price').textContent));
  d.querySelectorAll('.kc-card')[1].click();   // Modelo → Pro
  await new Promise((r) => setTimeout(r, 20));
  t('el precio sigue a la selección', /300\.000/.test(d.querySelector('.kc-price').textContent));
  d.querySelectorAll('.kc-card')[0].click();   // volver a Base
  // El botón del theme resuelve la variante a su ritmo: el panel tiene que
  // seguirlo, o el aviso de "no disponible" se queda puesto para siempre.
  // El primer <button> del formulario es el "−" de cantidad: cogerlo dejaba el
  // aviso puesto para siempre y mandaba el clic de "Añadir al carro" al menos.
  let pulsado = 0;
  d.querySelector('#add-to-cart').addEventListener('click', () => { pulsado++; });
  t('avisa mientras el theme no puede vender la combinación',
    /no está disponible/.test(panel.querySelector('.kc-stockmsg').textContent));
  d.querySelector('#add-to-cart').disabled = false;
  await new Promise((r) => setTimeout(r, 30));
  t('el aviso se va cuando el theme habilita el carro',
    panel.querySelector('.kc-stockmsg').textContent === '' && !panel.querySelector('.kc-btn').disabled);
  panel.querySelector('.kc-btn').click();
  d.querySelector('.kc-bar-cta').click();
  t('el carro del panel y el de la barra pulsan el botón real (no el "−")', pulsado === 2);
  // En Configurar la barra no repite el título ni la foto/precio del panel.
  // "desde" en la barra = la variante MÁS BARATA de verdad, no la primera.
  d.querySelector('.kc-tab').click();
  await new Promise((r) => setTimeout(r, 20));
  t('"desde" usa la variante más barata',
    !!d.querySelector('.kc-bar-desde') && /100\.000/.test(d.querySelector('.kc-bar-price').textContent));
  d.querySelector('.kc-bar-cta').click();   // volver a Configurar
  t('sin botón "volver" que duplique el título', !d.querySelector('.kc-bar-back'));
  t('la barra no repite foto ni precio en Configurar',
    !d.querySelector('.kc-bar-thumb') && d.querySelector('.kc-bar-price').textContent === '');
  w.close();
}

// ═══ Escenario 2: JSON v1 (alias `equipos`, sin deps ni style) ═════════════
console.log('\n— v1: degradación elegante (equipos, deltas por defecto) —');
{
  const def = {
    version: 1, updatedAt: '2026-07-27T00:00:00Z', currency: 'CLP', store: 'i1',
    equipos: [producto({
      groups: grupos(false), imageUrl: '', images: [],
      storefront: { specs: [], photosNote: '', pageSections: [{ id: 'n1', kind: 'note', show: true }], tabs: { showFotos: false } },
    })],
  };
  const w = await montar(def);
  const d = w.document;
  const pasos = d.querySelectorAll('.kc-step');
  t('v1 con alias `equipos` monta igual', !!d.querySelector('.kimos-cfg'));
  t('v1: los 3 pasos visibles (sin dependsOn)', pasos.length === 3);
  t('v1: todos los pasos abiertos (sin stepsCollapsed)', !d.querySelector('.kc-step.kc-closed'));
  t('v1: sin variables de estilo (--kc-accent vacío)', d.querySelector('.kimos-cfg').style.getPropertyValue('--kc-accent') === '');
  const precios = Array.prototype.map.call(d.querySelectorAll('.kc-card-price'), (p) => p.textContent);
  t('v1: delta por defecto en la card no elegida (+ $200.000)', precios.some((p) => /\+\s*\$\s*200\.000/.test(p)));
  w.close();
}

// ═══ Escenario 3: v2 con showDeltas 'total' (precio server-side + delta) ═══
console.log('\n— v2: showDeltas total (precio absoluto de la variante candidata) —');
{
  const def = {
    version: 2, updatedAt: '2026-07-27T00:00:00Z', currency: 'CLP', store: 'i1',
    productos: [producto({
      groups: grupos(false), imageUrl: '', images: [],
      storefront: { specs: [], photosNote: '', pageSections: [{ id: 'n1', kind: 'note', show: true }], tabs: { showFotos: false },
        style: { accentColor: '', bgColor: '', radius: 0, cardStyle: 'cards', showDeltas: 'total', stepsCollapsed: false } },
    })],
  };
  // La página llega con 'Sin tarjeta' elegida (como la dejaría el theme):
  // la variante actual server-side ($100.000) corresponde a esa selección.
  const w = await montar(def, (win) => {
    win.document.querySelector('select[data-optionid="910"]').value = '9102';
  });
  const d = w.document;
  const precios = Array.prototype.map.call(d.querySelectorAll('.kc-card-price'), (p) => p.textContent);
  // Variante actual (server-side) = $100.000; Pro = +200.000 → $300.000;
  // RTX = +350.000 → $450.000. Absolutos, no diferencias.
  t('total: card Pro muestra $300.000 (100.000 del theme + 200.000)', precios.some((p) => /\$\s*300\.000/.test(p)));
  t('total: card RTX muestra $450.000', precios.some((p) => /\$\s*450\.000/.test(p)));
  t('total: las cards elegidas no llevan precio', d.querySelectorAll('.kc-card.on .kc-card-price').length === 0);
  w.close();
}

if (fallos) { console.error('\n✘ ' + fallos + ' fallo(s)'); process.exit(1); }
console.log('\nContrato v2 OK ✔ — dependencias, style, imagen, auto y qty verificados offline');
process.exit(0);
