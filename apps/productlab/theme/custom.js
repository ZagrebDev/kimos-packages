/**
 * custom.js del theme + arranque de ProductLab (Kimos 3D).
 *
 * Este archivo ya lo carga el theme en todas las páginas
 * (templates/layout.liquid), así que se usa como punto de entrada: desde aquí
 * se cargan el CSS y el script del visor 3D. Gracias a eso NO hay que editar
 * ninguna plantilla Liquid.
 *
 * Lo único que debes cambiar es KIMOS_3D_URL, con la URL pública que te da la
 * app en la pestaña Publicación.
 */

/* ─────────────── Kimos 3D — configuración ─────────────── */

// URL pública del configurador (app ProductLab → pestaña Publicación).
// ¿VARIAS instancias de ProductLab en la misma tienda? Pon sus URLs
// separadas por coma: los catálogos se fusionan y cada producto se busca
// en todos (si un SKU se repite, manda el primero de la lista).
//   'https://…/app/instancia-A/definition, https://…/app/instancia-B/definition'
window.KIMOS_3D_URL = 'https://TU-KIMOS.kimos.dev/api/public/app/TU-INSTANCIA/definition';

// Texto del botón que abre el visor.
window.KIMOS_3D_LABEL = 'Ver en 3D';

// true = abre el 3D al entrar, sin esperar el clic. Déjalo en false: así el
// motor (~155 KB) solo se descarga si el cliente lo pide.
window.KIMOS_3D_AUTOLOAD = false;

// Fuerza a recargar los assets de KIMOS AHORA (salta el caché del navegador y
// del CDN). Cámbialo por cualquier valor nuevo cada vez que subas archivos
// nuevos a Assets y quieras verlos sin esperar. Sin esto, los cambios entran
// solos en la siguiente hora. El custom.js que descarga ProductLab
// (Publicación → "custom.js (configurado)") ya trae aquí una marca nueva en
// cada descarga: subirlo junto a los otros archivos los refresca al instante.
window.KIMOS_ASSET_V = '66';

// ── SERVICE WORKER ZOMBI: fuera ─────────────────────────────────────────────
// Si la tienda tuvo una PWA (o Jumpseller registró un service worker en algún
// momento), ese SW queda VIVO en el navegador de quien la visitó y puede
// servir páginas y archivos VIEJOS para siempre, ignorando recargas, Ctrl+F5
// y hasta parámetros nuevos en la URL (los SW suelen ignorar el query string).
// Es la única capa de caché que ninguna cabecera nuestra puede atravesar.
// Esta tienda no usa PWA: cualquier SW registrado es un zombi — se da de baja
// y se limpia su caché, UNA vez, y ese navegador queda sano para siempre.
(function () {
  try {
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      if (!regs.length) return;
      regs.forEach(function (r) { r.unregister(); });
      if (window.caches && caches.keys) {
        caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
      }
      console.warn('[kimos] service worker antiguo dado de baja (' + regs.length + '): recarga la página para ver la versión vigente.');
    });
  } catch (e) { /* mejor una tienda sin purga que una purga que rompa */ }
})();

// ── PWA DE LA PLATAFORMA: neutralizada ──────────────────────────────────────
// Jumpseller inyecta <link rel="manifest" href="/manifest.json"> en todas las
// páginas aunque la tienda no use PWA: el manifest no existe (un 404 en cada
// carga) y es el vector por el que se registró el service worker zombi. No se
// puede quitar desde el theme (lo inyecta la plataforma), así que se retira
// aquí antes de que el navegador lo pida.
(function () {
  try {
    var quitar = function () {
      Array.prototype.forEach.call(document.querySelectorAll('link[rel="manifest"]'), function (l) {
        if (l.parentNode) l.parentNode.removeChild(l);
      });
    };
    quitar();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', quitar);
  } catch (e) { /* sin drama: era solo limpieza */ }
})();

// Huella visible en consola: la primera línea kimos dice qué custom.js corre.
console.info('[kimos] custom.js activo · KIMOS_ASSET_V=' + window.KIMOS_ASSET_V);

// AR EN VIVO (8th Wall Engine, gratuito y autoalojable). La cámara en la
// propia página y el producto ENCIMA, con los colores elegidos al instante,
// en iPhone y Android por igual. El motor pesa ~2 MB y solo se descarga si el
// cliente pulsa "Ver en tu espacio". Déjalo vacío ('') para desactivarlo y
// usar solo los visores del sistema (Scene Viewer / Quick Look).
window.KIMOS_XR8_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';

// XRExtras (MIT): trae FullWindowCanvas, el módulo oficial que mantiene la
// cámara a pantalla completa en cualquier teléfono y orientación.
window.KIMOS_XREXTRAS_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1/dist/xrextras.js';

// ANCHO DEL CONTENIDO. 'auto' mide el contenedor del theme (el que centra el
// resto de la web, ~1200px) y alinea el configurador a él; 'container' fuerza
// el centrado aunque no se detecte; 'full' lo deja a todo el ancho. Cada
// producto puede pisarlo desde ProductLab (Ficha → Estilo → Ancho en la tienda).
window.KIMOS_WIDTH = 'auto';

// TOPE DE LA BARRA. La barra de pestañas es pegajosa y se coloca justo debajo
// del header del theme: su alto se MIDE solo (y se recalcula al hacer scroll,
// porque muchos headers encogen). Solo si tu header no se detecta bien:
//   window.KIMOS_TOP_OFFSET = 66;               // px fijos
//   window.KIMOS_HEADER_SELECTOR = '.mi-header'; // o dile cuál es
//   window.KIMOS_CONTAINER_SELECTOR = '.mi-container';

// COLOR DEL SPINNER DE ARRANQUE. Se ve antes de que llegue nada de KIMOS, así
// que si lo quieres con la marca desde el primer fotograma, ponlo aquí. Cada
// producto puede pisarlo (ProductLab → Estilos → color del spinner) y el fondo
// del velo se toma del fondo real de la página si no lo fijas.
window.KIMOS_SPINNER_COLOR = '';
window.KIMOS_BOOT_BG = '';

// FICHA COMPLETA: true reemplaza la ficha del theme por la de KIMOS (barra con
// pestañas, heros del builder, configurador con 3D, specs y fotos). En false
// se usa solo el visor 3D sobre la galería, dejando tu ficha intacta.
window.KIMOS_FULL = true;

/* ───────── Kimos 3D — carga de los assets (no tocar) ───────── */
(function () {
  // Los tres archivos viven en la misma carpeta de assets que este custom.js,
  // así que la URL se deduce de la de este propio script. document.currentScript
  // apunta al script que se está ejecutando ahora mismo, sin depender de cómo
  // se llame el archivo (Jumpseller puede versionarlo o renombrarlo).
  var me = document.currentScript;
  if (!me || !me.src) {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (/custom[^/]*\.js/.test(scripts[i].src || '')) { me = scripts[i]; break; }
    }
  }
  var src = (me && me.src) || '';
  if (!src) { console.warn('[kimos3d] no pude deducir la ruta de los assets'); return; }

  // Aviso claro cuando se sube este archivo TAL CUAL viene del kit: con la URL
  // de ejemplo no hay definición que leer y la ficha KIMOS no aparece por
  // ningún lado, sin ningún error visible. Pasa al actualizar los assets y
  // pisar el custom.js ya configurado.
  if (/TU-KIMOS|TU-INSTANCIA/.test(String(window.KIMOS_3D_URL || ''))) {
    console.error('[kimos3d] KIMOS_3D_URL sigue con la URL de ejemplo: pon la de tu app '
      + '(ProductLab → Publicación) en custom.js. Hasta entonces la ficha KIMOS no se monta.');
  }
  var base = src.replace(/[^/]*$/, '');

  // ── Arranque: velo + spinner hasta que la ficha esté LISTA ───────────────
  // Sin esto se veía la ficha del theme unos segundos (mientras se pide el
  // JSON), luego el cambiazo a la de KIMOS, y encima el hero sin su foto. El
  // velo tapa desde el primer instante y el configurador lo retira cuando ya
  // ha pintado Y sus imágenes han cargado. Todo va aquí, en línea: el CSS del
  // kit llega por su cuenta y puede tardar más que esto.
  if (window.KIMOS_FULL === true) {
    var veil = document.createElement('style');
    veil.id = 'kc-veil';
    veil.textContent = '.product-page__wrapper,.product-page__info{visibility:hidden}'
      + '#kc-boot{position:fixed;left:0;right:0;bottom:0;top:var(--kc-boot-top,0px);'
      + 'z-index:2147483000;background:var(--kc-boot-bg,#fff);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'transition:opacity .3s ease}'
      + '#kc-boot.kc-boot-out{opacity:0;pointer-events:none}'
      + '#kc-boot i{display:block;width:34px;height:34px;border-radius:50%;'
      + 'border:3px solid rgba(128,128,128,.28);border-top-color:var(--kc-boot-accent,#19ACB1);'
      + 'animation:kc-boot-rot .8s linear infinite}'
      + '@keyframes kc-boot-rot{to{transform:rotate(360deg)}}';
    document.head.appendChild(veil);

    // Solo en fichas de producto: en el resto del sitio no hay nada que tapar.
    var esFicha = function () {
      return !!document.querySelector('.product-form-json, .product-json, .prod-options, .product-page, [id^="product-template"]');
    };
    var ponerVelo = function () {
      if (document.getElementById('kc-boot') || !document.body || !esFicha()) return;
      var caja = document.createElement('div');
      caja.id = 'kc-boot';
      caja.appendChild(document.createElement('i'));
      // El fondo real de la página: un velo blanco en una tienda oscura es
      // otro parpadeo, solo que al revés.
      var fondoFijo = String(window.KIMOS_BOOT_BG || '').trim();
      if (fondoFijo) caja.style.setProperty('--kc-boot-bg', fondoFijo);
      else {
        try {
          var fondo = getComputedStyle(document.body).backgroundColor;
          if (fondo && !/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(fondo)) caja.style.setProperty('--kc-boot-bg', fondo);
        } catch (e) { /* da igual: queda el blanco */ }
      }
      // Color del spinner, por orden: el fijado aquí a mano; el RECORDADO de
      // la última visita (el configurador guarda el color del estilo del
      // producto en localStorage — el spinner se ve antes de que ese estilo
      // llegue, así que sin la memoria el color elegido en ProductLab no se
      // alcanzaba a ver nunca); y si no, el acento del theme (--color-links).
      var giro = String(window.KIMOS_SPINNER_COLOR || '').trim();
      if (!giro) {
        try {
          var mem = JSON.parse(localStorage.getItem('kc-boot-style') || 'null');
          if (mem && mem.a) giro = String(mem.a).trim();
          if (mem && mem.b && !fondoFijo) caja.style.setProperty('--kc-boot-bg', String(mem.b).trim());
        } catch (e) { /* sin memoria: se sigue con el theme */ }
      }
      if (!giro) {
        try { giro = (getComputedStyle(document.documentElement).getPropertyValue('--color-links') || '').trim(); } catch (e) { giro = ''; }
      }
      if (giro) caja.style.setProperty('--kc-boot-accent', giro);
      document.body.appendChild(caja);
    };
    if (document.body) ponerVelo();
    document.addEventListener('DOMContentLoaded', ponerVelo);

    // Red de seguridad: si el configurador no llega a destaparlo (no carga, la
    // tienda no responde…), el velo se va solo. Antes eran 4 s y se levantaba
    // ANTES de que la ficha estuviera lista — de ahí el cambiazo a la vista.
    setTimeout(function () {
      var v = document.getElementById('kc-veil');
      if (v && v.parentNode) v.parentNode.removeChild(v);
      var b = document.getElementById('kc-boot');
      if (b && b.parentNode) b.parentNode.removeChild(b);
    }, 9000);
  }

  // Jumpseller MINIFICA y RENOMBRA los assets: la plantilla pide `custom.js` y
  // el servidor entrega `custom.min.js?1784967522`. Por eso los nombres se
  // deducen de cómo llegó ESTE archivo (si vino minificado, los demás también
  // lo estarán) y, por si acaso, se prueba el otro nombre como respaldo: pedir
  // el que no existe da 404 y el script nunca llega a ejecutarse.
  var min = /\.min\.[a-z]+(\?|$)/.test(src);

  // CACHÉ. Aquí había un fallo que hacía perder mucho tiempo: se le pegaba a
  // los otros tres archivos el `?timestamp` con el que había llegado ESTE. Ese
  // timestamp es el de custom.js, no el suyo, así que mientras custom.js no
  // cambiara sus URLs eran idénticas byte a byte — y el navegador y el CDN
  // seguían sirviendo la versión anterior por mucho que la volvieras a subir.
  // El síntoma es desesperante: subes los archivos y no cambia nada.
  //
  // Ahora la marca la ponemos nosotros: por defecto cambia cada HORA (los
  // archivos recién subidos llegan solos en menos de una hora — con la marca
  // diaria de antes, subirlos por la tarde no se veía hasta el día
  // siguiente) y, si necesitas que sea YA, define KIMOS_ASSET_V con
  // cualquier valor distinto al anterior.
  var bust = '?kv=' + (window.KIMOS_ASSET_V || Math.floor(Date.now() / 36e5));
  // Jumpseller SANEA el nombre al subir el archivo y, entre otras cosas, le
  // QUITA LOS GUIONES: `kimos-configurador.js` termina servido como
  // `kimosconfigurador.js`. Además minifica (`custom.js` → `custom.min.js`).
  // Por eso se prueban todas las variantes: pedir la que no existe devuelve
  // 404 y ese archivo simplemente no llega a ejecutarse.
  var candidatos = function (nombre, ext) {
    var nombres = [nombre];
    var plano = nombre.replace(/-/g, '');
    if (plano !== nombre) nombres.push(plano);
    var out = [];
    for (var n = 0; n < nombres.length; n++) {
      var a = base + nombres[n] + '.min.' + ext + bust;
      var b = base + nombres[n] + '.' + ext + bust;
      if (min) { out.push(a, b); } else { out.push(b, a); }
    }
    return out;
  };

  // CSS: se intenta el primero y, si falla, el segundo.
  (function (urls) {
    var i = 0;
    var poner = function () {
      if (i >= urls.length) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = urls[i++];
      l.onerror = poner;
      document.head.appendChild(l);
    };
    poner();
  })(candidatos(window.KIMOS_FULL === true ? 'kimos-configurador' : 'kimos3d', 'css'));

  // JS: la ficha completa o el visor simple, nunca los dos (duplicarían UI).
  var modulo = window.KIMOS_FULL === true ? 'kimos-configurador' : 'kimos3d';
  (function (urls) {
    var i = 0;
    var poner = function () {
      if (i >= urls.length) {
        console.warn('[kimos3d] no se pudo cargar ' + modulo + '.js desde', base,
          '— ¿lo subiste a Assets del theme?');
        return;
      }
      var s = document.createElement('script');
      s.src = urls[i++];
      s.defer = true;
      s.onerror = poner;
      document.head.appendChild(s);
    };
    poner();
  })(candidatos(modulo, 'js'));
})();

/* ─────────────── Resto de tu custom.js ─────────────── */
jQuery(() => {
  console.info(`[${new Date(Date.now()).toLocaleTimeString("en-GB", { hour12: false })}] Loaded custom.js`);
});
