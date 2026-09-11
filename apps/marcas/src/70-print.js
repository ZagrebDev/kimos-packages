/* ══ IMPRIMIR LA HOJA ═════════════════════════════════════════════════════
 *
 * La ventana de impresión renderiza EL MISMO componente `Hoja` que la
 * pantalla, con la hoja de estilos publicada de la app. No hay un maquetador
 * para ver y otro para imprimir: si divergieran, el PDF dejaría de parecerse
 * a lo que se aprobó en pantalla, y eso se descubre siempre tarde.
 */

const API = (() => {
  try {
    return s(shell.assetUrl('x')).split('/api/apps/')[0] || s(window.location.origin);
  } catch (e) {
    return '';
  }
})();

const BUNDLE_CSS_URL = API + '/api/apps/marcas/bundle.css';

/** A4 apaisado: la hoja es ancha porque enseña la marca en horizontal. */
function printCss(opts) {
  const o = isObj(opts) ? opts : {};
  const margen = clamp(Math.round(Number(o.margin) || 8), 0, 25);
  return [
    '@page { size: A4 landscape; margin: ' + margen + 'mm; }',
    'html, body { margin: 0; padding: 0; background: #fff; }',
    // El papel es blanco aunque KIMOS esté en modo noche: se imprime sobre
    // papel, no sobre la pantalla de nadie.
    '.kimos-marcas { background: #fff; color: #111; height: auto; }',
    '.mk-print .mk-hoja { height: auto; min-height: 0; }',
    '.mk-print .mk-hs { break-inside: avoid; }',
    // Cada lámina en su hoja: la 1 se cuelga en la pared, la 2 se
    // consulta al construir. Juntas en una plana no caben.
    '.mk-print .mk-hoja-pagina { break-after: page; }',
    '.mk-print .mk-hoja-pagina:last-child { break-after: auto; }',
    '@media print { .mk-noprint { display: none !important; } }',
  ].join('\n');
}

function renderHojaInto(container, brand, opts) {
  const RD = globalThis.ReactDOM;
  if (!RD) throw new Error('El host no expone ReactDOM: no es posible generar la hoja.');
  const o = isObj(opts) ? opts : {};
  // Se imprimen TODAS las láminas con contenido, una por página. En pantalla
  // se ve una cada vez; en papel se quieren las dos juntas, que es el
  // documento que se entrega.
  const ctx = hojaContexto(brand, o);
  const laminas = arr(ctx.laminasConContenido);
  const el = laminas.length > 1
    ? h('div', { className: 'mk-hojas' },
      laminas.map((k) => h('div', { key: k, className: 'mk-hoja-pagina' },
        h(Hoja, Object.assign({}, o, { brand, lamina: k })))))
    : h(Hoja, Object.assign({ brand }, o));
  if (RD.createRoot) {
    const root = RD.createRoot(container);
    root.render(el);
    return () => { try { root.unmount(); } catch (e) { /* no-op */ } };
  }
  RD.render(el, container);
  return () => { try { RD.unmountComponentAtNode(container); } catch (e) { /* no-op */ } };
}

/** Espera a que haya nodos, la hoja de estilos cargue y los logos estén. */
async function esperarHoja(win, container, timeoutMs) {
  const limite = Date.now() + (timeoutMs || 6000);
  while (!container.childNodes.length && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 30));
  }
  while (Date.now() < limite) {
    const links = Array.from(win.document.querySelectorAll('link[rel="stylesheet"]'));
    if (links.every((l) => l.sheet || l.dataset.failed === '1')) break;
    await new Promise((r) => setTimeout(r, 40));
  }
  // Sin esperar a los logos se imprimen huecos en blanco, que en una hoja de
  // marca es justo lo que no puede pasar.
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
    const fin = () => res();
    img.addEventListener('load', fin, { once: true });
    img.addEventListener('error', fin, { once: true });
    setTimeout(fin, 4000);
  }))));
}

const nombreArchivo = (brand) => 'sistema-visual-' + (slug((brand || {}).name, 'marca')) + '-'
  + new Date().toISOString().slice(0, 10);

async function actImprimirHoja(id, opts) {
  const b = id ? marcaPorId(id) : seleccionada();
  if (!b) return false;

  let win = null;
  try { win = window.open('', '_blank', 'width=1200,height=900'); } catch (e) { win = null; }
  if (!win) {
    avisar('warn', 'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.');
    return false;
  }

  const d = win.document;
  d.title = nombreArchivo(b);
  const meta = d.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  d.head.appendChild(meta);

  // Se ENLAZA la hoja publicada de la app en vez de copiar los estilos: así
  // no pueden divergir de los de pantalla.
  const link = d.createElement('link');
  link.rel = 'stylesheet';
  link.href = BUNDLE_CSS_URL;
  link.addEventListener('error', () => { link.dataset.failed = '1'; });
  d.head.appendChild(link);

  const style = d.createElement('style');
  style.textContent = printCss(opts);
  d.head.appendChild(style);

  const root = d.createElement('div');
  root.className = 'kimos-marcas mk-print';
  d.body.appendChild(root);

  try {
    renderHojaInto(root, b, Object.assign({ secciones: estado.hojaSecciones }, opts || {}));
    await esperarHoja(win, root);
    win.focus();
    setTimeout(() => { try { win.print(); } catch (e) { /* se puede imprimir a mano */ } }, 120);
    return true;
  } catch (e) {
    // La ventana queda abierta con el error a la vista: cerrarla dejaría a la
    // persona sin saber qué pasó.
    root.textContent = 'No se pudo preparar la hoja: ' + ((e && e.message) || 'error desconocido');
    avisar('error', (e && e.message) || 'No se pudo preparar la hoja.');
    return false;
  }
}
