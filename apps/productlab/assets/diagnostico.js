/**
 * Diagnóstico de Kimos 3D — pégalo en la consola del navegador ESTANDO EN LA
 * FICHA DEL PRODUCTO de tu tienda.
 *
 * No depende de que kimos3d.js haya cargado: revisa capa por capa y dice en
 * cuál se rompe la cadena.
 */
(async function () {
  var ok = function (m) { console.log('%c✔ ' + m, 'color:#0a0'); };
  var bad = function (m) { console.log('%c✘ ' + m, 'color:#c00;font-weight:bold'); };
  var info = function (m, x) { console.log('  ' + m, x === undefined ? '' : x); };
  var digitosDe = function (t) { return String(t).replace(/\D/g, ''); };

  console.log('%c── Diagnóstico Kimos 3D ──', 'font-weight:bold;font-size:14px');

  // 1) ¿Estamos en una ficha de producto? Se miran varias fuentes: hay themes
  //    que renderizan el product-json vacío pero sí publican product-form-json.
  var prod = { id: null, sku: null, name: null, options: [] };
  var fuente = '';
  var take = function (p, cual) {
    if (!p) return;
    if (prod.id == null && p.id != null) { prod.id = p.id; fuente = cual; }
    if (prod.sku == null && p.sku != null) prod.sku = p.sku;
    if (prod.name == null && p.name != null) prod.name = p.name;
    if (!prod.options.length && Array.isArray(p.options)) prod.options = p.options;
  };
  var pf = document.querySelector('script.product-form-json');
  if (pf) { try { var jf = JSON.parse(pf.textContent); take(jf && jf.info && jf.info.product, 'product-form-json'); } catch (e) {} }
  var pjs = document.querySelectorAll('script.product-json');
  Array.prototype.forEach.call(pjs, function (el) {
    try { var d = JSON.parse(el.textContent); take(d && d.product ? d.product : d, 'product-json'); } catch (e) {}
    if (prod.id == null && el.getAttribute('data-productid')) { prod.id = el.getAttribute('data-productid'); fuente = 'data-productid'; }
  });
  if (prod.id == null) {
    var sec = document.querySelector('[id^="product-template-"]');
    var mm = sec && sec.id.match(/product-template-(\d+)/);
    if (mm) { prod.id = mm[1]; fuente = 'id del contenedor'; }
  }
  info('fuentes disponibles → product-form-json:', !!pf); info('  script.product-json:', pjs.length);
  if (prod.id == null) return bad('No se pudo determinar el id del producto en esta página.');
  ok('Ficha de producto detectada (id leído de: ' + fuente + ')');
  info('id:', prod.id); info('sku:', JSON.stringify(prod.sku)); info('nombre:', prod.name);
  info('opciones en la tienda:', (prod.options || []).map(function (o) { return o.name; }).join(' · ') || '(ninguna)');

  // 2) ¿Se cargó custom.js y dejó la configuración?
  if (!window.KIMOS_3D_URL) {
    bad('window.KIMOS_3D_URL no está definida → tu custom.js no se cargó, o no tiene la línea de configuración.');
    info('Scripts cargados que parezcan custom:', Array.prototype.filter.call(document.scripts, function (s) {
      return /custom/.test(s.src || '');
    }).map(function (s) { return s.src; }).join(' · ') || '(ninguno)');
    return;
  }
  ok('custom.js cargado · KIMOS_3D_URL = ' + window.KIMOS_3D_URL);
  if (/TU-KIMOS|TU-INSTANCIA/.test(window.KIMOS_3D_URL)) {
    return bad('La URL sigue con el texto de ejemplo: reemplázala por la de tu app (pestaña Publicación).');
  }

  // 3) ¿Se cargaron los assets del visor?
  var base = '';
  Array.prototype.forEach.call(document.scripts, function (s) {
    if (/custom[^/]*\.js/.test(s.src || '')) base = s.src.replace(/[^/]*$/, '');
  });
  info('carpeta de assets deducida:', base || '(no se pudo deducir)');
  if (!window.KimosEngine3D && !document.querySelector('script[src*="kimos3d"]')) {
    bad('kimos3d.js NO está en la página → custom.js no logró inyectarlo o el archivo no existe en assets.');
    if (base) {
      for (const f of ['kimos3d.js', 'kimos3d.css', 'kimos-engine3d.js']) {
        try {
          const r = await fetch(base + f, { method: 'GET' });
          (r.ok ? ok : bad)(f + ' → HTTP ' + r.status + (r.ok ? '' : '  (¿lo subiste a Assets?)'));
        } catch (e) { bad(f + ' → no se pudo pedir: ' + e.message); }
      }
    }
    return;
  }
  ok('kimos3d.js presente en la página');

  // 3b) ¿QUÉ VERSIÓN se está sirviendo de cada archivo? Subir un archivo nuevo
  //     no garantiza que llegue: el navegador y el CDN cachean por URL, y si
  //     la URL no cambia se sigue sirviendo el anterior. Se descarga cada uno
  //     y se busca dentro una marca que solo existe en la versión actual.
  var MARCAS = [
    ['kimos-configurador.js', 'kc-ar-btn', 'botón de realidad aumentada + barra de precio arreglada'],
    ['kimos-engine3d.js', 'setParts', 'AR y cambio de color sin recargar el modelo'],
    ['kimos-configurador.css', 'kc-ar-btn', 'estilos del botón de AR'],
  ];
  var viejos = [];
  for (const [archivo, marca, que] of MARCAS) {
    var cargado = Array.prototype.filter.call(document.querySelectorAll('script[src], link[href]'), function (n) {
      return (n.src || n.href || '').indexOf(archivo.replace(/\.(js|css)$/, '')) !== -1;
    })[0];
    var url = cargado ? (cargado.src || cargado.href) : null;
    if (!url) { bad(archivo + ' → no está cargado en la página'); viejos.push(archivo); continue; }
    try {
      var txt = await (await fetch(url, { cache: 'reload' })).text();
      if (txt.indexOf(marca) !== -1) ok(archivo + ' → versión ACTUAL (' + que + ')');
      else { bad(archivo + ' → versión ANTIGUA. Falta: ' + que); viejos.push(archivo); }
    } catch (e) { bad(archivo + ' → no se pudo leer: ' + e.message); viejos.push(archivo); }
    info('   servido desde:', url);
  }
  if (viejos.length) {
    bad('LA TIENDA SIRVE ARCHIVOS ANTIGUOS (' + viejos.join(', ') + '). Subirlos otra vez no basta '
      + 'si la URL no cambia: el navegador y el CDN devuelven el de antes. En custom.js sube el número '
      + 'de window.KIMOS_ASSET_V y guarda; eso cambia la URL y los fuerza a bajar de nuevo.');
  }

  // 4) ¿Responde el JSON público? (aquí se ve CORS y publicación)
  var def;
  try {
    var r = await fetch(window.KIMOS_3D_URL, { credentials: 'omit' });
    if (!r.ok) {
      bad('El JSON público respondió HTTP ' + r.status + (r.status === 403
        ? ' → el configurador NO está publicado. En la app: Publicación → Publicar.' : ''));
      return;
    }
    var j = await r.json();
    def = j && j.data ? j.data : j;
    ok('JSON público accesible (sin problema de CORS)');
  } catch (e) {
    return bad('No se pudo descargar el JSON público: ' + e.message
      + '  → suele ser CORS: hay que permitir el origen ' + location.origin + ' en el backend.');
  }

  // 5) ¿Está ESTE producto ahí, y con 3D?
  var list = (def.productos || def.equipos || []);
  info('productos publicados:', list.length);
  console.table(list.map(function (e) {
    return { id: e.productId, sku: e.sku, nombre: e.name, con3D: !!(e.model3d && e.model3d.url) };
  }));
  var n = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
  var entry = list.filter(function (e) { return e.productId != null && String(e.productId) === String(prod.id); })[0]
    || (prod.sku ? list.filter(function (e) { return e.sku && n(e.sku) === n(prod.sku); })[0] : null)
    || list.filter(function (e) { return e.name && n(e.name) === n(prod.name); })[0];
  if (!entry) return bad('Este producto (id ' + prod.id + ') no aparece en la definición. Aplícalo a la tienda desde la app.');
  ok('Producto encontrado en la definición: "' + entry.name + '"');

  // 5a) PRECIO. Si la barra muestra 0 hay que saber si el producto está a 0 en
  //     la tienda o si es la ficha la que lee mal: son problemas distintos y
  //     el segundo no se arregla tocando Jumpseller.
  (function () {
    var f = document.querySelector('script.product-form-json');
    var real = null;
    if (f) {
      try {
        var inf = (JSON.parse(f.textContent) || {}).info || {};
        var vv = inf.variant && inf.variant.price;
        var pp = inf.product && inf.product.price;
        real = vv != null ? Number(vv) : (pp != null ? Number(pp) : null);
      } catch (e) { /* JSON ilegible */ }
    }
    var barra = document.querySelector('.kimos-cfg .kc-bar-price');
    info('precio de la variante según el theme (JSON):', real == null ? '(no lo publica)' : real);
    info('lo que muestra la barra de KIMOS:', barra ? barra.textContent.trim() : '(sin barra)');
    if (real === 0) {
      bad('El producto está a PRECIO 0 en la tienda. No es la ficha: arréglalo en Jumpseller '
        + '(o en la app Productos) y vuelve a sincronizar. La app ya no aplica productos a $0.');
    } else if (real > 0) {
      ok('La tienda cobra ' + real + ' por esta variante');
      if (barra && digitosDe(barra.textContent).indexOf(String(Math.round(real))) === -1) {
        bad('…pero la barra muestra otra cosa: la ficha está leyendo el nodo equivocado. Avisa de esto.');
      }
    }
  })();

  // 5b) Fotos y descripción: si la ficha muestra una sola foto, aquí se ve en
  //     qué capa se corta —lo que publica la app o lo que pinta el theme.
  var pub = (entry.images || []).filter(Boolean);
  var pintadas = [];
  Array.prototype.forEach.call(
    document.querySelectorAll('[class*="gallery"] img, [class*="swiper"] img, [class*="carousel"] img, .product-images img'),
    function (i) {
      var u = i.getAttribute('data-src') || i.getAttribute('data-lazy') || i.getAttribute('src') || '';
      if (u && pintadas.indexOf(u) === -1) pintadas.push(u);
    });
  info('fotos publicadas por la app (entry.images):', pub.length);
  info('fotos pintadas por el theme en el DOM:', pintadas.length);
  if (pub.length > 1) ok('La galería completa llega desde la app: la ficha debe mostrar ' + pub.length + ' fotos');
  else {
    bad('La app publica ' + (pub.length || 'ninguna') + ' foto → la ficha solo puede mostrar esa.'
      + '  → El producto en la app Productos no tiene la galería: sincronízalo (pull) desde Jumpseller y vuelve a publicar.');
  }
  if (entry.description) ok('Descripción publicada (' + entry.description.length + ' caracteres)');
  else info('Sin descripción publicada:', 'el producto no la tiene en la tienda, o falta re-publicar.');

  if (!entry.model3d || !entry.model3d.url) {
    return bad('El producto NO trae modelo 3D publicado → en la app marca "Publicar el 3D en la tienda" y vuelve a publicar.');
  }
  ok('Modelo 3D publicado · ' + (entry.model3d.parts || []).length + ' partes, ' + (entry.model3d.finishes || []).length + ' acabados');

  // 5c) "Ver en tu espacio": por qué aparece o no el botón. Son tres
  //     condiciones independientes y el botón calla si falla cualquiera.
  (function () {
    var cm = Number((entry.model3d || {}).realSizeCm) || 0;
    var xr = !!(navigator.xr && navigator.xr.isSessionSupported);
    var ql = (function () {
      var a = document.createElement('a');
      return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
    })();
    var motor = !!(window.KimosEngine3D && window.KimosEngine3D.createViewer);
    info('medida real publicada (model3d.realSizeCm):', cm || '(0 = sin publicar)');
    info('este navegador tiene WebXR:', xr);
    info('este navegador tiene AR Quick Look (iPhone/iPad):', ql);
    if (!cm) {
      bad('Sin medida real NO se ofrece AR: colocar el mueble a una escala inventada engaña. '
        + 'En la app: Visor 3D → "Medida real del lado más largo, en cm" → Guardar → Publicación → Publicar. '
        + 'Ojo: si la pusiste con una versión anterior a la 1.7.0, hay que volver a publicar para que viaje en el JSON.');
    } else if (!xr && !ql) {
      info('→ En ESTE dispositivo no puede haber AR (ni WebXR ni Quick Look).',
        'Es lo normal en un escritorio: pruébalo desde el móvil.');
    } else if (motor) {
      ok('Se dan las condiciones: el botón "Ver en tu espacio" debe aparecer en la pestaña Configurar');
    }
  })();

  // 6) ¿Se puede descargar el .glb desde la tienda? (CORS de los archivos)
  try {
    var g = await fetch(entry.model3d.url, { method: 'GET', credentials: 'omit' });
    (g.ok ? ok : bad)('archivo .glb → HTTP ' + g.status);
  } catch (e) {
    bad('No se pudo descargar el .glb: ' + e.message + '  → CORS de /api/public/files desde ' + location.origin);
  }

  // 7) ¿Coinciden los nombres de opción con los pasos?
  var pasos = (entry.groups || []).map(function (g2) { return g2.label; });
  var opts = (prod.options || []).map(function (o) { return o.name; });
  info('pasos en KIMOS:', pasos.join(' · ') || '(ninguno)');
  info('opciones en Jumpseller:', opts.join(' · ') || '(ninguna)');
  var sinPar = pasos.filter(function (p) { return !opts.some(function (o) { return n(o) === n(p); }); });
  if (opts.length && sinPar.length) {
    bad('Estos pasos no tienen opción equivalente en la tienda: ' + sinPar.join(', ')
      + '  → el visor se mostrará, pero no reaccionará a esos pasos. Vuelve a aplicar el producto desde la app.');
  } else if (opts.length) ok('Los pasos calzan con las opciones de la tienda');

  // 8) ¿Se montó el visor?
  var mounted = !!document.querySelector('.kimos3d');
  (mounted ? ok : bad)('visor montado en el DOM: ' + mounted
    + (mounted ? '' : '  → mira si hay errores rojos arriba en la consola'));
  console.log('%c── fin ──', 'font-weight:bold');
})();
