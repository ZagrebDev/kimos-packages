/**
 * Prueba del motor de píxeles de banners-translator, en un navegador real.
 *
 * Monta la app con un `shell` falso —sin red y sin IA— sobre un banner de
 * verdad, y comprueba lo que decide si el resultado sirve: que los paneles se
 * corten en franjas limpias, que la medición encuentre la caja del texto y su
 * color, y que el borrado deje el fondo como estaba **sin tocar un solo píxel
 * fuera de la caja**, que es la promesa entera de la app.
 *
 * Sin esto, «importa sin errores» es todo lo que se sabe de un motor recién
 * portado de numpy a canvas.
 *
 * Hace falta un navegador porque lo que se prueba es `getImageData`: no hay
 * forma honesta de verificar un motor de canvas sin un canvas.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   BANNERS_IMG=/ruta/a/banners node apps/banners-translator/test/motor.mjs
 *
 * `BANNERS_IMG` debe apuntar a una carpeta con banners de producto reales; el
 * archivo que se usa se puede cambiar con `BANNERS_FILE`. Las pruebas de
 * medición y borrado corren sobre lienzos sintéticos —donde la respuesta
 * correcta se conoce— y no dependen de esa carpeta.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const IMG = process.env.BANNERS_IMG || path.join(RAIZ, 'test/banners');
const ARCHIVO = process.env.BANNERS_FILE || '07_85wh_battery.jpg';

const tipos = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png' };

// Servidor local: un canvas con una imagen de file:// queda "tainted" y
// getImageData lanza. Con http:// mismo origen, no.
const servidor = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let archivo;
  if (url.startsWith('/img/')) archivo = path.join(IMG, url.slice(5));
  else if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><html><body></body></html>'); }
  else archivo = path.join(RAIZ, url);
  try {
    const datos = readFileSync(archivo);
    res.writeHead(200, { 'content-type': tipos[path.extname(archivo)] || 'application/octet-stream' });
    res.end(datos);
  } catch { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => servidor.listen(0, r));
const puerto = servidor.address().port;

const navegador = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const pagina = await navegador.newPage();
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
await pagina.goto(`http://127.0.0.1:${puerto}/`);

const resultado = await pagina.evaluate(async ({ puerto, archivo }) => {
  const salida = [];
  const ok = (nombre, cond, extra) => salida.push({ nombre, ok: !!cond, extra });

  // React mínimo: la app sólo necesita createElement/useState/useEffect para
  // montarse, y esta prueba no ejercita la interfaz sino el motor.
  const noop = () => {};
  globalThis.React = {
    createElement: (t, p, ...c) => ({ t, p, c }),
    useState: (v) => [typeof v === 'function' ? v() : v, noop],
    useEffect: noop,
    useRef: () => ({ current: null }),
    useReducer: (f, i) => [i, noop],
    Fragment: 'fragment',
  };

  const guardado = [];
  const shell = {
    app: { appId: 'banners-translator', instanceId: 'i1', teamId: 't1' },
    window: { setTitle: noop, requestClose: noop, requestMinimize: noop },
    notify: noop,
    agent: { register: () => noop },
    items: {},
    assetUrl: (p) => p,
    saveData: async (p) => { guardado.push(p); },
    loadData: async () => null,
    files: { upload: async () => 'x', list: async () => [], remove: noop },
    // Sin `ai`: se comprueba que la app aguante sin imagen generativa.
  };

  const mod = await import(`http://127.0.0.1:${puerto}/dist/index.js`);
  const montada = mod.default(shell);
  ok('mount() devuelve un componente', typeof montada.Component === 'function');
  ok('y una función de limpieza', typeof montada.unmount === 'function');

  // Las internas se prueban a través de la instancia montada, que es como
  // corren de verdad. Se reimplementa aquí sólo lo necesario para cargar la
  // imagen y llamarlas: el módulo no exporta sus funciones (ni debe).
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `http://127.0.0.1:${puerto}/img/${archivo}`; });
  ok('el banner de prueba carga', img.width > 0 && img.height > 1000, `${img.width}x${img.height}`);

  globalThis.__img = img;
  globalThis.__salida = salida;
  return { salida, alto: img.height, ancho: img.width };
}, { puerto, archivo: ARCHIVO });

// El motor no se exporta (y así debe ser), así que se evalúa el mismo código
// fuente en el contexto de la página para poder llamarlo directamente. Es el
// MISMO archivo que se publica: no hay una copia que se pueda desincronizar.
const fuente = readFileSync(path.join(RAIZ, 'dist/index.js'), 'utf8');
const cuerpo = fuente
  .slice(fuente.indexOf('export default function mount(shell) {') + 'export default function mount(shell) {'.length)
  .replace(/\n  return \{\n    Component: App,[\s\S]*$/, '\n');

const motor = await pagina.evaluate(async ({ cuerpo, puerto }) => {
  const salida = [];
  const ok = (nombre, cond, extra) => salida.push({ nombre, ok: !!cond, extra });
  const eq = (a, b, nombre) => ok(nombre, a === b, a === b ? '' : `esperado ${b}, obtenido ${a}`);

  const shell = {
    app: { appId: 'bt', instanceId: 'i1', teamId: 't1' },
    window: { setTitle: () => {} }, notify: () => {},
    agent: { register: () => () => {} },
    saveData: async () => {}, loadData: async () => null,
  };
  // eslint-disable-next-line no-new-func
  const fabrica = new Function('shell', cuerpo + '\n; return { cortarPaneles, medirBloque, borrarZona, pintarBloque, componerPanel, recortar, lienzo, cargarBitmap, aHex, deHex, mediana, acotarCaja, ajustarTamano, partirEnLineas };');
  const M = fabrica(shell);

  const img = globalThis.__img;

  // ── Cortar en paneles ──────────────────────────────────────────────
  const paneles = M.cortarPaneles(img, 1600);
  ok('la imagen se corta en varios paneles', paneles.length > 1, `${paneles.length} paneles`);
  ok('los paneles cubren la imagen entera, sin huecos ni solapes',
    paneles[0].y0 === 0 &&
    paneles[paneles.length - 1].y1 === img.height &&
    paneles.every((p, i) => i === 0 || p.y0 === paneles[i - 1].y1),
    JSON.stringify(paneles.slice(0, 3)));
  ok('ningún panel sale desmesurado respecto del objetivo',
    paneles.every((p) => p.y1 - p.y0 <= 2400 + 1), Math.max(...paneles.map((p) => p.y1 - p.y0)));

  // Un corte en franja limpia: la fila del corte debe tener poca variación.
  const c = M.lienzo(Math.min(160, img.width), img.height);
  c.getContext('2d').drawImage(img, 0, 0, img.width, img.height, 0, 0, c.width, img.height);
  const d = c.getContext('2d').getImageData(0, 0, c.width, img.height).data;
  const varFila = (y) => {
    let s = 0, s2 = 0;
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      s += l; s2 += l * l;
    }
    const m = s / c.width;
    return Math.sqrt(Math.max(0, s2 / c.width - m * m));
  };
  const enCortes = paneles.slice(1).map((p) => varFila(p.y0));
  let sumaTodas = 0;
  for (let y = 0; y < img.height; y += 7) sumaTodas += varFila(y);
  const mediaGlobal = sumaTodas / Math.ceil(img.height / 7);
  ok('los cortes caen en franjas más limpias que la media de la imagen',
    M.mediana(enCortes) < mediaGlobal,
    `corte=${M.mediana(enCortes).toFixed(1)} media=${mediaGlobal.toFixed(1)}`);

  // ── Medir un bloque sintético, donde la verdad se conoce ───────────
  // Sobre el banner real no hay forma de saber cuál era «la caja correcta».
  // Con un texto pintado por la prueba, sí.
  const lienzoP = M.lienzo(900, 300);
  const ctx = lienzoP.getContext('2d');
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, 900, 300);
  ctx.fillStyle = '#FF3366';
  ctx.font = '700 64px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('AUTONOMIA', 120, 180);
  const anchoReal = ctx.measureText('AUTONOMIA').width;

  // Se le da una caja DELIBERADAMENTE corta, como las que devuelve el modelo.
  const medida = M.medirBloque(lienzoP, [150, 140, 320, 190]);
  ok('la medición crece la caja corta del modelo hasta el texto real',
    medida.ajustada[0] <= 126 && medida.ajustada[2] >= 120 + anchoReal - 8,
    `medida=[${medida.ajustada}] real≈[120,~131,${Math.round(120 + anchoReal)},180]`);
  ok('y no se desborda tragándose el lienzo entero',
    medida.ajustada[0] > 90 && medida.ajustada[2] < 900,
    `[${medida.ajustada}]`);

  const cm = M.deHex(medida.color);
  ok('saca el color del texto de los píxeles, no del modelo',
    Math.hypot(cm[0] - 255, cm[1] - 51, cm[2] - 102) < 70, medida.color);
  eq(medida.modoFondo, 'flat', 'reconoce un fondo plano como plano');
  eq(medida.lineas.length, 1, 'cuenta una línea cuando hay una línea');

  // Dos líneas
  const l2 = M.lienzo(900, 400);
  const c2 = l2.getContext('2d');
  c2.fillStyle = '#FFFFFF'; c2.fillRect(0, 0, 900, 400);
  c2.fillStyle = '#222222'; c2.font = '400 40px sans-serif';
  c2.fillText('Primera linea de texto', 100, 120);
  c2.fillText('Segunda linea de texto', 100, 190);
  const m2 = M.medirBloque(l2, [100, 85, 520, 200]);
  eq(m2.lineas.length, 2, 'y dos cuando hay dos');
  ok('con un interlineado creíble', m2.interlineado > 1 && m2.interlineado < 3, m2.interlineado.toFixed(2));
  eq(m2.alinear, 'left', 'y detecta que están alineadas a la izquierda');

  // Centrado
  const l3 = M.lienzo(900, 400);
  const c3 = l3.getContext('2d');
  c3.fillStyle = '#FFFFFF'; c3.fillRect(0, 0, 900, 400);
  c3.fillStyle = '#222222'; c3.font = '400 40px sans-serif'; c3.textAlign = 'center';
  c3.fillText('Una linea corta', 450, 120);
  c3.fillText('Otra linea mucho mas larga que la primera', 450, 190);
  const m3 = M.medirBloque(l3, [200, 85, 700, 200]);
  eq(m3.alinear, 'center', 'y que estas otras están centradas');

  // ── Borrar: el fondo vuelve, y sólo dentro de la caja ──────────────
  const antes = ctx.getImageData(0, 0, 900, 300);
  M.borrarZona(ctx, medida.ajustada, 'flat');
  const despues = ctx.getImageData(0, 0, 900, 300);

  // Dentro de la caja no debe quedar rastro del rojo del texto.
  let rojoDentro = 0;
  for (let y = medida.ajustada[1]; y < medida.ajustada[3]; y++) {
    for (let x = medida.ajustada[0]; x < medida.ajustada[2]; x++) {
      const i = (y * 900 + x) * 4;
      if (despues.data[i] > 140 && despues.data[i + 1] < 120) rojoDentro++;
    }
  }
  eq(rojoDentro, 0, 'el borrado no deja ni un píxel del texto original');

  // Y fuera de la caja (con su margen) NADA puede haber cambiado: es la
  // promesa entera de la app.
  const margen = Math.max(5, Math.round((medida.ajustada[3] - medida.ajustada[1]) * 0.22)) + 4;
  let cambiadosFuera = 0;
  for (let y = 0; y < 300; y++) {
    for (let x = 0; x < 900; x++) {
      const dentro = x >= medida.ajustada[0] - margen && x < medida.ajustada[2] + margen
        && y >= medida.ajustada[1] - margen && y < medida.ajustada[3] + margen;
      if (dentro) continue;
      const i = (y * 900 + x) * 4;
      if (antes.data[i] !== despues.data[i] || antes.data[i + 1] !== despues.data[i + 1]) cambiadosFuera++;
    }
  }
  eq(cambiadosFuera, 0, 'y no toca ni un píxel fuera de la caja: esa es la promesa de la app');

  // El fondo reconstruido debe ser el fondo, no un gris cualquiera.
  const centro = ((medida.ajustada[1] + medida.ajustada[3]) >> 1) * 900
    + ((medida.ajustada[0] + medida.ajustada[2]) >> 1);
  const f = [despues.data[centro * 4], despues.data[centro * 4 + 1], despues.data[centro * 4 + 2]];
  ok('y reconstruye el fondo original, no un relleno inventado',
    Math.hypot(f[0] - 0x10, f[1] - 0x18, f[2] - 0x20) < 24, M.aHex(f));

  // ── Ajustar el tamaño al espacio disponible ────────────────────────
  const ctxM = M.lienzo(10, 10).getContext('2d');
  const corto = M.ajustarTamano(ctxM, 'Hola', 'regular', 400, 80, 40, 1.3, 1, 1);
  const largo = M.ajustarTamano(ctxM,
    'Una frase considerablemente mas larga que la anterior y que no cabe igual',
    'regular', 400, 80, 40, 1.3, 1, 1);
  ok('un texto largo se encoge o se parte para caber donde cabía el corto',
    largo.tam < corto.tam || largo.lineas.length > corto.lineas.length,
    `corto=${corto.tam}px/${corto.lineas.length}L largo=${largo.tam}px/${largo.lineas.length}L`);
  ok('el texto cortito conserva el alto de glifo que se le pidió',
    Math.abs(corto.tam - 40 / 0.72) < 40, `${corto.tam}px para altoRef=40`);
  ok('partir en líneas no pierde ni inventa palabras',
    M.partirEnLineas(ctxM, 'uno dos tres cuatro cinco', 60, 'regular', 100)
      .join(' ').split(/\s+/).join(' ') === 'uno dos tres cuatro cinco');

  // ── Componer un panel: los bloques inactivos no se tocan ───────────
  const panel = {
    y0: 0, y1: 300,
    bloques: [
      { id: 'a', caja: [150, 140, 320, 190], en: 'AUTONOMIA', es: 'BATERIA', traducir: true, peso: 'bold', alinear: 'left' },
      { id: 'b', caja: [150, 140, 320, 190], en: 'X', es: 'Y', traducir: false, peso: 'bold', alinear: 'left' },
    ],
  };
  const lienzoC = M.lienzo(900, 300);
  const cc = lienzoC.getContext('2d');
  cc.fillStyle = '#101820'; cc.fillRect(0, 0, 900, 300);
  cc.fillStyle = '#FF3366'; cc.font = '700 64px sans-serif'; cc.fillFo = 0;
  cc.fillText('AUTONOMIA', 120, 180);
  const med = { a: M.medirBloque(lienzoC, panel.bloques[0].caja) };
  const compuesto = M.componerPanel(lienzoC, panel, med);
  ok('componer devuelve un panel del tamaño correcto',
    compuesto.width === 900 && compuesto.height === 300, `${compuesto.width}x${compuesto.height}`);
  const dc = compuesto.getContext('2d').getImageData(0, 0, 900, 300).data;
  let tintaNueva = 0;
  for (let i = 0; i < dc.length; i += 4) {
    if (dc[i] > 140 && dc[i + 1] < 120) tintaNueva++;
  }
  ok('y el texto traducido queda pintado con el color medido del original',
    tintaNueva > 200, `${tintaNueva} px de tinta`);

  return salida;
}, { cuerpo, puerto });

await navegador.close();
servidor.close();

let fallos = 0;
console.log('\nMontaje');
for (const r of resultado.salida) {
  console.log(`  ${r.ok ? '✔' : '✘'} ${r.nombre}${r.extra ? '  · ' + r.extra : ''}`);
  if (!r.ok) fallos++;
}
console.log('\nMotor de píxeles');
for (const r of motor) {
  console.log(`  ${r.ok ? '✔' : '✘'} ${r.nombre}${r.extra ? '  · ' + r.extra : ''}`);
  if (!r.ok) fallos++;
}
if (errores.length) { console.log('\nErrores de página:'); errores.forEach((e) => console.log('  ' + e)); fallos += errores.length; }

console.log();
if (fallos) { console.log(`✘ ${fallos} fallo(s)`); process.exit(1); }
console.log('✔ todo en verde');
