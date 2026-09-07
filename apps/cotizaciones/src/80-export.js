/* ══ EXPORTACIÓN: PDF Y ENLACE PÚBLICO ════════════════════════════════════
 *
 * Dos salidas del mismo documento:
 *
 *   PDF      Se abre una ventana, se renderiza en ella la MISMA hoja con los
 *            MISMOS componentes del lienzo y se llama a imprimir. El
 *            navegador ofrece "Guardar como PDF". No hay un segundo
 *            maquetador que pintar y mantener: lo que se ve en Diseño es
 *            exactamente lo que sale impreso.
 *   Enlace   La propuesta como página HTML autocontenida, subida a Archivos
 *            del tenant y servida por su URL pública. Sirve para mandar la
 *            cotización sin adjuntar nada, y es lo que enlaza el correo.
 *
 * La hoja impresa NO hereda el tema del escritorio: la ventana de impresión
 * no tiene los tokens del host, así que las variables CSS caen a sus
 * *fallbacks* —el tema claro— y el papel sale blanco con texto negro, que es
 * lo correcto en papel aunque KIMOS esté en modo noche.
 *
 * Nunca se construye HTML a mano con texto del usuario: la hoja la pinta
 * React (que escapa lo que pinta) y lo que se sube a Archivos es el
 * resultado ya renderizado.
 */

const BUNDLE_CSS_URL = API + '/api/apps/cotizaciones/bundle.css';

/**
 * Ajustes de papel. Van al `@page`, que es lo único que el navegador respeta
 * para el tamaño y los márgenes al imprimir.
 */
const PAPER_SIZES = [
  ['a4', 'A4 (210 × 297 mm)', 'A4'],
  ['letter', 'Carta (216 × 279 mm)', 'letter'],
  ['legal', 'Oficio (216 × 356 mm)', 'legal'],
];

function printCss(opts) {
  const o = isObj(opts) ? opts : {};
  const size = (PAPER_SIZES.find(([k]) => k === o.paper) || PAPER_SIZES[0])[2];
  const margin = clamp(Math.round(num(o.margin, 16)), 5, 40);
  return [
    '@page { size: ' + size + '; margin: ' + margin + 'mm; }',
    // El papel es blanco aunque KIMOS esté en modo noche: la ventana de
    // impresión no hereda los tokens del host y las variables caen a sus
    // fallbacks del tema claro.
    'html, body { background: #fff; margin: 0; padding: 0; }',
    'body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0d1117; }',
    '.cz-print { padding: 0; }',
    '.cz-print .cz-sheet { max-width: none; width: 100%; gap: 16px 18px; }',
    // Un bloque no se parte por la mitad entre dos páginas si cabe entero.
    '.cz-print .cz-cell { break-inside: avoid; }',
    '.cz-print .cz-b-table { break-inside: auto; }',
    '.cz-print .cz-b-table tr { break-inside: avoid; }',
    '.cz-print .cz-b-table thead { display: table-header-group; }',
    '.cz-print .cz-b-pagebreak { break-after: page; border: 0; height: 0; }',
    // La cabecera del documento se repite arriba de cada página impresa solo
    // si el usuario lo pide: por defecto encabeza una vez, como el original.
    o.repeatHeader ? '.cz-print .cz-b-header { position: running(header); }' : '',
    '@media screen { body { padding: 24px; background: #eceff3; }',
    '  .cz-print { max-width: 820px; margin: 0 auto; background: #fff; padding: 42px;',
    '    box-shadow: 0 4px 24px rgba(0,0,0,.12); border-radius: 4px; } }',
    '@media print { .cz-noprint { display: none !important; } }',
  ].filter(Boolean).join('\n');
}

/** Nombre de archivo de la propuesta: número, cliente y fecha. */
function nombreArchivo(doc) {
  const partes = [s(doc.number) || 'cotizacion', s(doc.client.name), s(doc.date)];
  return canon(partes.filter(Boolean).join(' ')).replace(/\s+/g, '-').slice(0, 80) || 'cotizacion';
}

/**
 * Renderiza la hoja dentro de un contenedor de OTRO documento. Sirve tanto
 * para la ventana de impresión como para el iframe oculto del que sale el
 * HTML publicable.
 */
function renderSheetInto(container, doc) {
  const RD = globalThis.ReactDOM;
  if (!RD) throw new Error('El host no expone ReactDOM: no es posible generar la hoja.');
  const el = h(Sheet, { doc, def: model.def, mode: 'print' });
  if (RD.createRoot) {
    const root = RD.createRoot(container);
    root.render(el);
    return () => { try { root.unmount(); } catch (e) { /* no-op */ } };
  }
  // React 17 y anteriores.
  RD.render(el, container);
  return () => { try { RD.unmountComponentAtNode(container); } catch (e) { /* no-op */ } };
}

/** Espera a que el árbol esté pintado, la hoja de estilos cargada y las fotos listas. */
async function esperarHoja(win, container, timeoutMs) {
  const limite = Date.now() + (timeoutMs || 6000);
  // 1. React pinta de forma asíncrona: se espera a que haya nodos.
  while (!container.childNodes.length && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 30));
  }
  // 2. Las hojas de estilo enlazadas, o el diseño sale sin maquetar.
  while (Date.now() < limite) {
    const links = Array.from(win.document.querySelectorAll('link[rel="stylesheet"]'));
    if (links.every((l) => l.sheet || l.dataset.failed === '1')) break;
    await new Promise((r) => setTimeout(r, 40));
  }
  // 3. Las imágenes: sin esto se imprimen huecos en blanco.
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
    const fin = () => res();
    img.addEventListener('load', fin, { once: true });
    img.addEventListener('error', fin, { once: true });
    setTimeout(fin, 4000);
  }))));
}

/**
 * Abre la ventana de impresión con la propuesta lista para "Guardar como PDF".
 *
 * Se abre SIN `noopener` a propósito: con esa opción `window.open` devuelve
 * null y no habría forma de escribir en la ventana ni de lanzar la impresión.
 */
async function exportarPdf(doc, opts) {
  const o = isObj(opts) ? opts : {};
  let win = null;
  try { win = window.open('', '_blank', 'width=900,height=1200'); } catch (e) { win = null; }
  if (!win) {
    shell.notify({ level: 'warn', text: 'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.' });
    return false;
  }

  const d = win.document;
  d.title = nombreArchivo(doc);
  const meta = d.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  d.head.appendChild(meta);

  // Los estilos de los bloques son LOS MISMOS del lienzo: se enlaza la hoja
  // publicada de la app en vez de copiarlos, para que no puedan divergir.
  const link = d.createElement('link');
  link.rel = 'stylesheet';
  link.href = BUNDLE_CSS_URL;
  link.addEventListener('error', () => { link.dataset.failed = '1'; });
  d.head.appendChild(link);

  const style = d.createElement('style');
  style.textContent = printCss(o);
  d.head.appendChild(style);

  const root = d.createElement('div');
  root.className = 'kimos-cotizaciones cz-print';
  d.body.appendChild(root);

  try {
    renderSheetInto(root, doc);
    await esperarHoja(win, root);
    win.focus();
    setTimeout(() => { try { win.print(); } catch (e) { /* el usuario puede imprimir a mano */ } }, 120);
    return true;
  } catch (e) {
    // La ventana queda abierta con el error a la vista: cerrarla dejaría a la
    // persona sin saber qué pasó.
    root.textContent = 'No se pudo preparar la propuesta: ' + ((e && e.message) || 'error desconocido');
    shell.notify({ level: 'error', text: (e && e.message) || 'No se pudo preparar el PDF.' });
    return false;
  }
}

/**
 * Publica la propuesta como página HTML en Archivos del tenant y devuelve su
 * URL pública.
 *
 * La hoja se pinta en un iframe oculto con los mismos componentes y se
 * serializa el resultado. El CSS se descarga y se EMBEBE, de modo que la
 * página siga viéndose igual dentro de un año aunque la app haya cambiado de
 * versión: lo que se le mandó al cliente no se altera solo.
 */
async function publicarPropuesta(doc, opts) {
  const o = isObj(opts) ? opts : {};
  if (!shell.authFetch) throw new Error('Este host no permite subir archivos.');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;';
  document.body.appendChild(iframe);
  let limpiar = null;
  try {
    const idoc = iframe.contentDocument;
    const root = idoc.createElement('div');
    root.className = 'kimos-cotizaciones cz-print';
    idoc.body.appendChild(root);
    limpiar = renderSheetInto(root, doc);
    await esperarHoja(iframe.contentWindow, root, 4000);

    let css = '';
    try {
      const res = await fetch(BUNDLE_CSS_URL, { cache: 'no-store' });
      if (res.ok) css = await res.text();
    } catch (e) { /* sin la hoja publicada quedan los estilos de impresión */ }

    // El cuerpo es la salida de React, que escapa todo lo que pinta: aquí no
    // se concatena texto del usuario dentro del HTML.
    const html = [
      '<!doctype html>',
      '<html lang="es"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + escapeHtml(s(doc.number) + ' · ' + s(doc.name)) + '</title>',
      '<style>' + css + '</style>',
      '<style>' + printCss(o) + '</style>',
      '</head><body>',
      '<div class="kimos-cotizaciones cz-print">' + root.innerHTML + '</div>',
      '</body></html>',
    ].join('\n');

    const path = 'imagenes/cotizaciones/propuestas/' + nombreArchivo(doc) + '-'
      + Date.now().toString(36) + '.html';
    const fd = new FormData();
    fd.append('path', path);
    fd.append('file', new File([html], path.split('/').pop(), { type: 'text/html' }));
    const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
    if (!res.ok) {
      const detalle = await res.json().catch(() => ({}));
      throw new Error(s(detalle.detail) || 'No se pudo publicar (HTTP ' + res.status + ').');
    }
    return API + '/api/public/files/' + path;
  } finally {
    if (limpiar) limpiar();
    iframe.remove();
  }
}

/** Escapado mínimo para los pocos textos que sí van dentro del HTML (el título). */
function escapeHtml(v) {
  return s(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Acciones ────────────────────────────────────────────────────────────
/** Exporta la cotización a PDF y lo anota en su historial. */
async function actExportPdf(quoteId, opts) {
  const doc = docById(s(quoteId));
  if (!doc) return false;
  const ok = await exportarPdf(doc, Object.assign({}, exportOpts(), opts));
  if (ok) commitDoc(doc.id, (d) => logEvent(d, 'export', 'Exportada a PDF'), { meta: false });
  return ok;
}

/** Publica la propuesta y guarda su enlace en el documento. */
async function actPublishQuote(quoteId, opts) {
  const doc = docById(s(quoteId));
  if (!doc) return '';
  try {
    const url = await publicarPropuesta(doc, Object.assign({}, exportOpts(), opts));
    commitDoc(doc.id, (d) => {
      d.publicUrl = url;
      d.publishedAt = stamp();
      return logEvent(d, 'publish', 'Propuesta publicada como enlace');
    });
    shell.notify({ level: 'success', text: 'Propuesta publicada: el enlace queda en la cotización.' });
    return url;
  } catch (e) {
    shell.notify({ level: 'error', text: (e && e.message) || 'No se pudo publicar la propuesta.' });
    return '';
  }
}

/** Preferencias de papel del cotizador (viven con las demás reglas). */
function exportOpts() {
  const r = rulesOf();
  return { paper: r.paper, margin: r.pageMargin, repeatHeader: false };
}

// ── Vista previa ────────────────────────────────────────────────────────
/** La propuesta tal como se imprimirá, sin salir de la app. */
function PreviewModal(props) {
  const { m, doc, onClose } = props;
  const [ocupado, setOcupado] = useState('');
  return h(Modal, {
    open: true, wide: true, full: true, title: 'Vista previa · ' + (doc.number || doc.name), onClose,
    footer: [
      doc.publicUrl ? h('a', {
        key: 'l', className: 'cz-link', href: doc.publicUrl, target: '_blank', rel: 'noopener noreferrer',
      }, 'Ver el enlace publicado') : null,
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, {
        key: 'p', disabled: !!ocupado,
        title: 'Sube la propuesta a Archivos y devuelve un enlace público para mandársela al cliente',
        onClick: async () => { setOcupado('pub'); await actPublishQuote(doc.id); setOcupado(''); },
      }, ocupado === 'pub' ? 'Publicando…' : '🔗 Publicar enlace'),
      h(Btn, {
        key: 'x', variant: 'primary', disabled: !!ocupado,
        onClick: async () => { setOcupado('pdf'); await actExportPdf(doc.id); setOcupado(''); },
      }, '⬇ Exportar PDF'),
    ],
  }, h('div', { className: 'cz-preview' }, h(Sheet, { doc, def: m.def, mode: 'preview' })));
}
