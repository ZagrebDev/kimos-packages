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
  product: { id: 23008278, sku: 'PC-1', name: 'PC Gamer', options: OPTS },
  variant: { id: 1, price: 100000 },
};
const pagina = () => `<!doctype html><html lang="es"><body>
<section class="product-page">
  <div class="product-page__wrapper">
    <script type="application/json" class="product-form-json">${JSON.stringify({ options: {}, info: prodInfo })}</script>
    <div class="product-options">${selectsHtml}</div>
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
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: def }) });
  if (prep) prep(w);   // estado previo de la página (selecciones del theme)
  w.eval(SRC);
  await new Promise((r) => setTimeout(r, 80));   // loadDefinition es async
  return w;
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
  w.close();
}

// ═══ Escenario 2: JSON v1 (alias `equipos`, sin deps ni style) ═════════════
console.log('\n— v1: degradación elegante (equipos, deltas por defecto) —');
{
  const def = {
    version: 1, updatedAt: '2026-07-27T00:00:00Z', currency: 'CLP', store: 'i1',
    equipos: [producto({
      groups: grupos(false), imageUrl: '', images: [],
      storefront: { specs: [], photosNote: '', pageSections: [{ id: 'n1', kind: 'note', show: true }], tabs: {} },
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
      storefront: { specs: [], photosNote: '', pageSections: [{ id: 'n1', kind: 'note', show: true }], tabs: {},
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
