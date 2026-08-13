/**
 * Kimos 3D para Jumpseller — visor 3D del producto en la tienda.
 *
 * Muestra en la ficha de producto el modelo 3D configurado en la app
 * ProductLab, y lo repinta EN VIVO cuando el cliente
 * cambia las opciones (acabado, color, etc.).
 *
 * Diseñado para no tocar las plantillas del theme:
 *  - Se engancha a `.prod-options` (la convención de Jumpseller para selects,
 *    botones y swatches de opciones), así funciona con cualquier theme que la
 *    respete, sea cual sea su maquetación.
 *  - Lee el producto desde el `<script class="product-json">` que el theme ya
 *    imprime, y el modelo desde el JSON público de KIMOS.
 *  - Si el producto no tiene 3D publicado, NO hace absolutamente nada: ni
 *    inserta UI ni descarga el motor.
 *
 * Configuración (en assets/custom.js, antes de este script):
 *   window.KIMOS_3D_URL = 'https://TU-KIMOS/api/public/app/{instancia}/definition';
 *   window.KIMOS_3D_AUTOLOAD = false;   // true = abre el 3D sin pedir clic
 *   window.KIMOS_3D_LABEL = 'Ver en 3D';
 */
(function () {
  'use strict';

  var CFG = {
    url: window.KIMOS_3D_URL || '',
    autoload: window.KIMOS_3D_AUTOLOAD === true,
    label: window.KIMOS_3D_LABEL || 'Ver en 3D',
    engine: window.KIMOS_3D_ENGINE_URL || '',
    cacheMin: 3,
  };
  var LOG = '[kimos3d]';
  // Marcador de versión: permite comprobar de un vistazo (kimos3d.version) que
  // la tienda está sirviendo el archivo actual y no una copia cacheada.
  var VERSION = '1.3.0';
  // Se captura aquí, en la evaluación del script: dentro de callbacks
  // document.currentScript ya es null.
  var SELF = document.currentScript;
  var norm = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };

  if (!CFG.url) return; // sin configurar: silencio absoluto

  // ── Carga del JSON público (con caché corta en sessionStorage) ───────────
  function loadDefinition() {
    var key = 'kimos3d:' + CFG.url;
    try {
      var hit = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (hit && Date.now() - hit.t < CFG.cacheMin * 60000) return Promise.resolve(hit.d);
    } catch (e) { /* sessionStorage puede estar bloqueado */ }
    // `_t` rotatorio: evita el caché de CDN sin romperlo del todo.
    var bust = Math.floor(Date.now() / (5 * 60000));
    return fetch(CFG.url + (CFG.url.indexOf('?') === -1 ? '?' : '&') + '_t=' + bust, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        // El gateway público envuelve la definición en {data:{…}}
        var d = j && j.data ? j.data : j;
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
        return d;
      });
  }

  // ── Producto actual, desde lo que el theme ya imprime ────────────────────
  // Se consultan VARIAS fuentes porque no todas están siempre pobladas: hay
  // themes cuyo `product-json` se renderiza vacío (la plantilla lo imprime con
  // una variable que no está en ese contexto) mientras el `product-form-json`
  // sí trae el producto completo. Se toma lo primero que tenga id.
  function currentProduct() {
    var out = { id: null, sku: null, name: null, options: [] };
    var take = function (p) {
      if (!p) return;
      if (out.id == null && p.id != null) out.id = p.id;
      if (out.sku == null && p.sku != null) out.sku = p.sku;
      if (out.name == null && p.name != null) out.name = p.name;
      if (!out.options.length && Array.isArray(p.options)) out.options = p.options;
    };

    // 1) product-form-json: en los themes por componentes es el más completo.
    var f = document.querySelector('script.product-form-json');
    if (f) {
      try { var j = JSON.parse(f.textContent); take(j && j.info && j.info.product); } catch (e) {}
    }

    // 2) product-json (puede haber más de uno; algunos vienen vacíos).
    var els = document.querySelectorAll('script.product-json');
    Array.prototype.forEach.call(els, function (el) {
      try { var d = JSON.parse(el.textContent); take(d && d.product ? d.product : d); } catch (e) {}
      if (out.id == null) {
        var attr = el.getAttribute('data-productid');
        if (attr) out.id = attr;
      }
    });

    // 3) Último recurso: el id del contenedor de la ficha.
    if (out.id == null) {
      var sec = document.querySelector('[id^="product-template-"]');
      var m = sec && sec.id.match(/product-template-(\d+)/);
      if (m) out.id = m[1];
    }
    return out.id == null ? null : out;
  }

  function findEntry(def, prod) {
    var list = (def && (def.productos || def.equipos)) || [];
    var byId = list.filter(function (e) { return e.productId != null && String(e.productId) === String(prod.id); })[0];
    if (byId) return byId;
    if (prod.sku) {
      var bySku = list.filter(function (e) { return e.sku && norm(e.sku) === norm(prod.sku); })[0];
      if (bySku) return bySku;
    }
    // Último recurso: por nombre. Si el producto se enlazó antes de que
    // Jumpseller asignara su id, `productId` viaja en null y el SKU puede
    // no coincidir; el nombre suele ser el mismo.
    var byName = list.filter(function (e) { return e.name && norm(e.name) === norm(prod.name); })[0];
    return byName || null;
  }

  // Explica en consola por qué no se montó el visor. Sin esto, "no se ve" no
  // distingue entre "no hay 3D", "no calza el producto" y "falla la red".
  function explain(def, prod, entry) {
    var list = (def && (def.productos || def.equipos)) || [];
    if (!entry) {
      console.warn(LOG, 'este producto no está en la definición publicada.',
        '\n  producto de la tienda → id:', prod.id, '· sku:', prod.sku, '· nombre:', prod.name,
        '\n  publicados en KIMOS  →', list.map(function (e) {
          return '{id:' + e.productId + ', sku:' + JSON.stringify(e.sku) + ', nombre:' + JSON.stringify(e.name) + '}';
        }).join(' ') || '(ninguno)',
        '\n  → Revisa que el producto esté APLICADO a la tienda desde la app (eso graba el id de Jumpseller).');
      return;
    }
    if (!entry.model3d) {
      console.warn(LOG, 'el producto "' + entry.name + '" existe en la definición pero SIN modelo 3D.',
        '\n  → En la app, pestaña Visor 3D, marca "Publicar el 3D en la tienda" y vuelve a publicar.');
      return;
    }
    if (!entry.model3d.url) {
      console.warn(LOG, 'el producto "' + entry.name + '" tiene 3D publicado pero sin archivo .glb.');
    }
  }

  // ── Selección actual del cliente → estado del visor ──────────────────────
  // Se traduce cada opción de Jumpseller al paso equivalente de KIMOS por
  // NOMBRE (la app genera las opciones desde las etiquetas de los pasos).
  function readSelection(prod) {
    var out = {};
    var groups = document.querySelectorAll('.prod-options');
    Array.prototype.forEach.call(groups, function (g) {
      var optId = g.getAttribute('data-optionid');
      var opt = (prod.options || []).filter(function (o) { return String(o.id) === String(optId); })[0];
      var name = opt ? opt.name : (g.getAttribute('data-option-name') || '');
      // Si el theme no expuso el array de opciones, el nombre se lee del
      // título visible del grupo: es lo que ve el cliente y coincide con la
      // etiqueta del paso en KIMOS.
      if (!name) {
        var fs = (g.closest && (g.closest('.product-options__fieldset') || g.closest('fieldset'))) || g.parentElement;
        var title = fs && fs.querySelector && fs.querySelector('.product-options__title, legend, label');
        if (title) name = title.textContent.trim();
      }
      var value = '';
      if (g.tagName === 'SELECT') {
        var o = g.options[g.selectedIndex];
        value = o ? (o.textContent || o.value) : '';
      } else {
        var checked = g.querySelector('input:checked');
        if (checked) {
          value = checked.getAttribute('data-value') || checked.value || '';
          var lab = checked.closest('label');
          if (lab && lab.textContent.trim()) value = lab.textContent.trim();
        }
      }
      if (name) out[norm(name)] = norm(value);
    });
    return out;
  }

  function buildState(entry, selection) {
    var st = { colors: {}, finishes: {}, hidden: {} };
    (entry.groups || []).forEach(function (g) {
      var vals = g.values || [];
      var chosen = null;
      var sel = selection[norm(g.label)];
      if (sel) chosen = vals.filter(function (v) { return norm(v.name) === sel; })[0];
      if (!chosen) chosen = vals.filter(function (v) { return v.isDefault; })[0] || vals[0];
      if (!chosen) return;
      (chosen.model3d || []).forEach(function (e) {
        if (e.type === 'color') st.colors[e.partId] = e.color;
        else if (e.type === 'finish') st.finishes[e.partId] = e.finishId;
        else if (e.type === 'hide') st.hidden[e.partId] = true;
      });
    });
    return st;
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  function mountUI(entry, prod) {
    // El visor se inserta al principio de la columna de la galería. Nunca
    // DENTRO de un carrusel: si el theme marca como galería al propio slider
    // (Swiper), un nodo ajeno entre sus slides queda recortado por su overflow
    // y el visor "no se ve" aunque el script haya corrido bien. Por eso, si el
    // punto elegido cae dentro de un .swiper, se sube hasta salir de él.
    var host = document.querySelector('.product-gallery')
      || document.querySelector('.product-page__content')
      || document.querySelector('.product-page__wrapper')
      || document.querySelector('.product-page');
    if (!host) { console.warn(LOG, 'no encontré dónde insertar el visor (¿es una ficha de producto?)'); return; }
    var slider = host.classList.contains('swiper') ? host : (host.closest ? host.closest('.swiper') : null);
    if (slider && slider.parentElement) host = slider.parentElement;

    var box = document.createElement('div');
    box.className = 'kimos3d';
    box.innerHTML =
      '<div class="kimos3d__stage" hidden>' +
        '<canvas class="kimos3d__canvas"></canvas>' +
        '<div class="kimos3d__msg">Cargando 3D…</div>' +
        '<button type="button" class="kimos3d__close" aria-label="Cerrar 3D">✕</button>' +
      '</div>' +
      '<button type="button" class="kimos3d__open">' +
        '<span class="kimos3d__icon" aria-hidden="true">◆</span> ' + CFG.label +
      '</button>';
    host.insertBefore(box, host.firstChild);

    var stage = box.querySelector('.kimos3d__stage');
    var canvas = box.querySelector('.kimos3d__canvas');
    var msg = box.querySelector('.kimos3d__msg');
    var openBtn = box.querySelector('.kimos3d__open');
    var closeBtn = box.querySelector('.kimos3d__close');
    var viewer = null;
    var loading = false;

    function apply() {
      if (!viewer) return;
      viewer.setState(buildState(entry, readSelection(prod)));
    }

    // Candidatos para el motor, en el mismo directorio que este script.
    // Jumpseller minifica y renombra los assets (`kimos3d.min.js?123`), así que
    // no se puede asumir el nombre: se prueban ambos.
    function engineUrls() {
      if (CFG.engine) return [CFG.engine];
      var src = (SELF && SELF.src) || '';
      if (!src) {
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
          if ((all[i].src || '').indexOf('kimos3d') !== -1) { src = all[i].src; break; }
        }
      }
      if (!src) return ['kimos-engine3d.js'];
      var base = src.replace(/[^/]*$/, '');
      var query = (src.match(/\?.*$/) || [''])[0];
      var min = /\.min\.js(\?|$)/.test(src);
      // Jumpseller quita los guiones al subir (kimos-engine3d.js →
      // kimosengine3d.js) y además minifica: se prueban las cuatro variantes.
      var out = [];
      ['kimos-engine3d', 'kimosengine3d'].forEach(function (n) {
        var a = base + n + '.min.js' + query;
        var b = base + n + '.js' + query;
        if (min) { out.push(a, b); } else { out.push(b, a); }
      });
      return out;
    }

    function loadEngine() {
      if (window.KimosEngine3D) return Promise.resolve(window.KimosEngine3D);
      var urls = engineUrls();
      return new Promise(function (resolve, reject) {
        var i = 0;
        var intentar = function () {
          if (i >= urls.length) return reject(new Error('no se pudo descargar el motor 3D (probé: ' + urls.join(' , ') + ')'));
          var sc = document.createElement('script');
          sc.src = urls[i++];
          sc.onload = function () {
            window.KimosEngine3D ? resolve(window.KimosEngine3D) : reject(new Error('el motor no expuso KimosEngine3D'));
          };
          sc.onerror = intentar;
          document.head.appendChild(sc);
        };
        intentar();
      });
    }

    function open() {
      stage.hidden = false;
      box.classList.add('is-open');
      if (viewer || loading) { apply(); return; }
      loading = true;
      msg.hidden = false;
      msg.textContent = 'Cargando 3D…';
      // El motor (~155 KB gzip) solo se descarga cuando alguien abre el visor.
      loadEngine().then(function (eng) {
        viewer = eng.createViewer(canvas, { podium: false });
        return viewer.setModel({
          url: entry.model3d.url,
          rotation: entry.model3d.rotation,
          mirror: entry.model3d.mirror,
          parts: entry.model3d.parts,
        }).then(function () {
          viewer.setFinishes(entry.model3d.finishes || []);
          apply();
          msg.hidden = true;
        });
      }).catch(function (e) {
        msg.hidden = false;
        msg.textContent = 'No se pudo mostrar el 3D.';
        console.warn(LOG, e);
      }).then(function () { loading = false; });
    }

    function close() { stage.hidden = true; box.classList.remove('is-open'); }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);

    // Repintar al cambiar cualquier opción del producto. Se escucha en el
    // documento para que sirva igual si el theme redibuja los controles.
    document.addEventListener('change', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.prod-options')) apply();
    });
    document.addEventListener('click', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.prod-options')) setTimeout(apply, 0);
    });

    if (CFG.autoload) open();
    console.info(LOG, 'v' + VERSION + ' · visor 3D listo para "' + (entry.name || prod.name) + '"');
  }

  // ── Arranque ─────────────────────────────────────────────────────────────
  function start() {
    var prod = currentProduct();
    if (!prod || !prod.id) {
      // Si la página trae datos de producto pero no se pudo sacar el id, es una
      // anomalía y hay que decirlo: callarse aquí fue justo lo que dejó el
      // fallo invisible en una tienda real.
      var hay = document.querySelector('script.product-json, script.product-form-json, [id^="product-template-"]');
      if (hay) {
        console.warn(LOG, 'v' + VERSION + ': la página parece una ficha de producto pero no pude determinar su id.',
          '\n  → Ejecuta kimos3d.diag() para ver las fuentes disponibles.');
      } else if (window.KIMOS_3D_DEBUG) {
        console.info(LOG, 'v' + VERSION + ': no es una ficha de producto');
      }
      return;
    }
    loadDefinition().then(function (def) {
      var entry = findEntry(def, prod);
      if (!entry || !entry.model3d || !entry.model3d.url) { explain(def, prod, entry); return; }
      mountUI(entry, prod);
    }).catch(function (e) {
      console.warn(LOG, 'no se pudo leer la definición desde', CFG.url, '→', e.message,
        '\n  → Revisa KIMOS_3D_URL en custom.js, que el configurador esté publicado y el CORS del backend.');
    });
  }

  // Diagnóstico a mano: en la consola de la ficha de producto, `kimos3d.diag()`
  // resume en qué punto se queda todo.
  window.kimos3d = {
    version: VERSION,
    diag: function () {
      var prod = currentProduct();
      console.info(LOG, 'versión del script:', VERSION);
      console.info(LOG, 'URL configurada:', CFG.url || '(vacía)');
      console.info(LOG, 'producto de la página:', prod ? { id: prod.id, sku: prod.sku, name: prod.name } : '(no encontrado)');
      console.info(LOG, 'motor cargado:', !!window.KimosEngine3D, '· visor montado:', !!document.querySelector('.kimos3d'));
      if (!CFG.url) return console.warn(LOG, 'falta window.KIMOS_3D_URL en custom.js');
      return loadDefinition().then(function (def) {
        var list = (def && (def.productos || def.equipos)) || [];
        console.info(LOG, 'definición OK ·', list.length, 'producto(s) publicados');
        console.table(list.map(function (e) {
          return { id: e.productId, sku: e.sku, nombre: e.name, con3D: !!(e.model3d && e.model3d.url) };
        }));
        if (prod) explain(def, prod, findEntry(def, prod));
      }).catch(function (e) { console.warn(LOG, 'falló la descarga de la definición:', e.message); });
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
