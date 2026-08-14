/**
 * Kimos Configurador — ficha de producto completa para Jumpseller.
 *
 * Reemplaza la ficha del theme por la experiencia de KIMOS cuando el producto
 * tiene un configurador publicado: barra con pestañas, secciones del builder
 * (heros e imágenes), visor 3D, pasos de configuración (con dependencias,
 * colapso y estilo por producto — contrato v2 de ProductLab; el JSON v1
 * sigue funcionando igual), especificaciones y fotos.
 *
 * PRINCIPIO QUE NO SE ROMPE — el precio y el carro son SIEMPRE del theme.
 * Este script nunca calcula un precio cobrable ni arma su propio carro: pinta
 * la interfaz y, al elegir un valor, escribe en los controles nativos del
 * producto (`.prod-options`) y dispara su evento `change`. A partir de ahí el
 * theme hace lo suyo: casar la variante, actualizar el precio y añadir al
 * carro. Así el precio mostrado es el de la variante en Jumpseller y no hay
 * dos fuentes de verdad.
 *
 * Configuración, en assets/custom.js:
 *   window.KIMOS_3D_URL   = 'https://TU-KIMOS/api/public/app/{instancia}/definition';
 *   window.KIMOS_FULL     = true;    // activa esta ficha completa
 *   window.KIMOS_3D_LABEL = 'Ver en 3D';
 */
(function () {
  'use strict';

  var CFG = {
    url: window.KIMOS_3D_URL || '',
    full: window.KIMOS_FULL !== false,
    engine: window.KIMOS_3D_ENGINE_URL || '',
    // Motor de AR en vivo (8th Wall Engine, autoalojable). Vacío = sin AR en
    // vivo; quedan los visores del sistema (Scene Viewer / Quick Look).
    xr8: window.KIMOS_XR8_URL || '',
    xrextras: window.KIMOS_XREXTRAS_URL || '',
    // Tope de espera del velo de arranque: pasado ese tiempo se destapa
    // aunque alguna foto siga sin llegar (nunca dejar la tienda tapada).
    bootMax: (typeof window.KIMOS_BOOT_MAX === 'number') ? window.KIMOS_BOOT_MAX : 4000,
  };
  var LOG = '[kimos-cfg]';
  var VERSION = '5.31.1';
  // KIMOS_3D_URL acepta UNA url, VARIAS separadas por coma, o un array:
  // cada una es una instancia de ProductLab y sus catálogos se FUSIONAN
  // (el producto se busca en todos; ante un SKU repetido manda el primero
  // de la lista). Así varias instancias conviven en la misma tienda.
  var CFG_URLS = (function () {
    var u = CFG.url;
    var lista = Array.isArray(u) ? u : String(u || '').split(',');
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var x = String(lista[i] || '').trim();
      if (x && out.indexOf(x) === -1) out.push(x);
    }
    return out;
  })();
  var SELF = document.currentScript;
  var norm = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };

  if (!CFG_URLS.length || !CFG.full) return;

  // Las fotos llegan en formas distintas según de dónde salgan: strings en el
  // JSON público de KIMOS y objetos ({url}, {src}…) en el JSON del theme. Se
  // normaliza a URL y se descartan miniaturas repetidas de la misma imagen.
  function imgUrl(x) {
    if (!x) return '';
    if (typeof x === 'string') return x.trim();
    return String(x.url || x.full_url || x.src || x.original || x.image || x.thumb_url || '').trim();
  }
  function addImages(list, src) {
    if (!Array.isArray(src)) return list;
    src.forEach(function (x) {
      var u = imgUrl(x);
      if (!u) return;
      // Jumpseller sirve la misma foto en varios tamaños; se compara por el
      // nombre del archivo para no repetir la misma imagen tres veces.
      var key = u.split('?')[0].replace(/.*\//, '');
      for (var i = 0; i < list.length; i++) {
        if (list[i].split('?')[0].replace(/.*\//, '') === key) return;
      }
      list.push(u);
    });
    return list;
  }

  // Fotos que ya están pintadas en la página. Es el último recurso —lo bueno
  // es `entry.images`, que publica la app— pero tiene que ser ancho: los
  // carruseles guardan las fotos en `data-src`/`srcset` hasta que se deslizan,
  // algunos themes usan <picture>/<source> y otros ponen la foto como
  // background-image de un <div>. Mirar solo `src` devolvía una sola foto.
  function scrapeGallery() {
    var out = [];
    var SEL = '.product-gallery, .product-images, .product-page__gallery, [class*="gallery"], [class*="carousel"], [class*="swiper"], [class*="thumb"]';
    var zonas = document.querySelectorAll(SEL);
    var primera = function (srcset) {
      // "a.jpg 1x, b.jpg 2x" → la primera URL, que es la de menor densidad.
      return String(srcset || '').split(',')[0].trim().split(/\s+/)[0] || '';
    };
    Array.prototype.forEach.call(zonas, function (z) {
      Array.prototype.forEach.call(z.querySelectorAll('img, source, [style*="background-image"]'), function (n) {
        if (n.tagName === 'SOURCE') { out.push(primera(n.getAttribute('srcset'))); return; }
        if (n.tagName === 'IMG') {
          out.push(n.getAttribute('data-src') || n.getAttribute('data-lazy')
            || n.getAttribute('data-image') || n.getAttribute('data-original')
            || primera(n.getAttribute('data-srcset')) || n.getAttribute('src')
            || primera(n.getAttribute('srcset')) || '');
          return;
        }
        var m = String(n.getAttribute('style') || '').match(/url\((['"]?)(.*?)\1\)/);
        if (m) out.push(m[2]);
      });
    });
    // Placeholders y espaciadores: no son fotos del producto.
    return out.filter(function (u) {
      return u && u.indexOf('data:image/gif') !== 0 && !/\bblank\b|\bplaceholder\b|1x1\./i.test(u);
    });
  }

  // ── Datos del producto, desde lo que el theme ya imprime ─────────────────
  function currentProduct() {
    var out = { id: null, sku: null, name: null, options: [], images: [] };
    var take = function (p) {
      if (!p) return;
      if (out.id == null && p.id != null) out.id = p.id;
      if (out.sku == null && p.sku != null) out.sku = p.sku;
      if (out.name == null && p.name != null) out.name = p.name;
      if (!out.options.length && Array.isArray(p.options)) out.options = p.options;
      // Las fotos SÍ se acumulan de todas las fuentes: un theme puede imprimir
      // solo la principal en un JSON y la galería completa en otro.
      addImages(out.images, p.images);
      addImages(out.images, p.gallery);
    };
    var f = document.querySelector('script.product-form-json');
    if (f) { try { var j = JSON.parse(f.textContent); take(j && j.info && j.info.product); } catch (e) {} }
    Array.prototype.forEach.call(document.querySelectorAll('script.product-json'), function (s) {
      try { var d = JSON.parse(s.textContent); take(d && d.product ? d.product : d); } catch (e) {}
      if (out.id == null && s.getAttribute('data-productid')) out.id = s.getAttribute('data-productid');
    });
    if (out.id == null) {
      var sec = document.querySelector('[id^="product-template-"]');
      var m = sec && sec.id.match(/product-template-(\d+)/);
      if (m) out.id = m[1];
    }
    addImages(out.images, scrapeGallery());
    return out.id == null ? null : out;
  }

  // El JSON público se pide SIEMPRE fresco a la red: publicar en ProductLab
  // se ve en la tienda en la visita siguiente, sin TTL ni CDN de por medio
  // (el velo de arranque ya tapa esa espera, y la copia local es una página
  // del mismo origen: rapidísima). La copia en localStorage queda SOLO de
  // respaldo: si ni la página ni KIMOS responden, la tienda usa la última
  // buena y no se queda sin ficha.
  // La clave lleva el producto: desde que el gateway puede devolver el
  // catálogo recortado a uno solo, una copia guardada bajo una clave común
  // dejaría a las demás fichas leyendo un catálogo donde su producto no está.
  function defCacheKey(ref) { return 'kc-def::' + CFG_URLS.join('|') + (ref ? '::' + ref : ''); }
  function defCacheRead(ref) {
    try {
      var raw = localStorage.getItem(defCacheKey(ref));
      if (!raw) return null;
      var c = JSON.parse(raw);
      return (c && c.def) ? c : null;
    } catch (e) { return null; }
  }
  function defCacheWrite(ref, def) {
    try { localStorage.setItem(defCacheKey(ref), JSON.stringify({ t: Date.now(), def: def })); } catch (e) {}
  }
  // Copia LOCAL del catálogo: ProductLab puede publicar el JSON en una
  // página de la propia tienda (permalink derivado de la instancia). Se
  // intenta primero — mismo origen, sin CORS, y la tienda configura aunque
  // KIMOS esté caído — y se cae al gateway de KIMOS si no existe.
  function permalinkLocal(u) {
    var m = String(u).match(/\/app\/([^/?#]+)\/definition/);
    if (!m) return null;
    return ('kimos-productlab-' + m[1]).toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  }
  function loadDefinition(prod) {
    // La ficha necesita UN producto, no el catálogo entero. Al gateway se le
    // pide recortado (`?product=`): con cincuenta productos, quien mira una
    // silla ya no descarga también las otras cuarenta y nueve con sus fotos,
    // pasos y presets. La copia local de la tienda sigue siendo el catálogo
    // completo —es un solo archivo servido por el CDN de Jumpseller— y se
    // intenta primero, así que esto solo aligera el camino de respaldo.
    var refProd = prod ? String(prod.id || prod.sku || prod.name || '').trim() : '';
    var hit = defCacheRead(refProd);
    // CACHÉ DEL CATÁLOGO. Aquí había una marca única por carga (`_t=Date.now()`)
    // que garantizaba ver siempre lo último — al precio de que NADA pudiera
    // guardarse: ni el navegador, ni el CDN de la tienda, ni el de KIMOS. Cada
    // visita a cada ficha era una descarga completa desde el origen.
    //
    // Eso no escala: en un día de tráfico alto, cada visitante golpea el
    // backend en vez de que el CDN absorba la carga. Ahora el catálogo se pide
    // de forma normal y quien decide cuánto dura la copia es la cabecera que
    // manda el servidor (unos segundos, con revalidación en segundo plano):
    // publicar sigue llegando a todos enseguida, pero mil visitantes en el
    // mismo minuto son UNA petición al origen, no mil.
    //
    // Para forzar una recarga inmediata en pruebas, define en custom.js
    // `window.KIMOS_CATALOG_V = 'loQueSea'` y cámbialo.
    var ver = String(window.KIMOS_CATALOG_V || '').trim();
    // FARO DE VERSIÓN: publicar TIENE que verse, sin que nadie limpie cachés.
    // Antes de pedir el catálogo se pregunta al backend cuál es la versión
    // vigente (una respuesta de ~40 bytes con caché de 5 s) y esa versión
    // viaja EN LA URL del catálogo: cada publicación produce una URL nueva,
    // así que ninguna caché del camino —navegador, proxy, VPN, service
    // worker, CDN— puede servir un catálogo viejo. Y como la URL identifica
    // el contenido, el catálogo pesado se cachea largo sin riesgo.
    // Si el faro no responde (backend caído, red), se sigue por el camino de
    // siempre: la ficha jamás se queda sin catálogo por culpa del faro.
    var pedirVersion = function (u) {
      var base = u.replace(/\/definition(\?.*)?$/, '/definition/version');
      if (base === u) return Promise.resolve('');
      return fetch(base, { credentials: 'omit', cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { return String((j && j.v) || '').trim(); })
        .catch(function () { return ''; });
    };
    var conVer = function (u, marca) {
      var v = String(marca || ver || '').trim();
      if (!v) return u;
      return u + (u.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(v);
    };
    var pedirLocal = function (u, marca) {
      var p = permalinkLocal(u);
      if (!p) return Promise.reject(new Error('sin permalink'));
      return fetch(conVer('/' + p, marca), { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (html) {
          var m = html.match(/<script[^>]*id="kimos-productlab"[^>]*>([\s\S]*?)<\/script>/);
          if (!m) throw new Error('sin datos embebidos');
          var def = JSON.parse(m[1]);
          if (!def || !(def.productos || def.equipos)) throw new Error('datos vacíos');
          // La copia de la tienda declara su versión (updatedAt). Si el faro
          // dice que hay una más nueva, esta copia está desactualizada (caché
          // de página de la tienda, o falta re-publicar): manda lo fresco.
          if (marca && def.updatedAt && String(def.updatedAt) !== String(marca)) {
            throw new Error('copia local desactualizada');
          }
          return def;
        });
    };
    var pedirRemoto = function (u, marca) {
      if (refProd) u += (u.indexOf('?') === -1 ? '?' : '&') + 'product=' + encodeURIComponent(refProd);
      return fetch(conVer(u, marca), { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { return j && j.data ? j.data : j; });
    };
    // Un catálogo que NO EXISTE es el peor caso de todos: una tienda puede
    // quedar con el kit apuntando a una instancia borrada o despublicada, y
    // entonces cada visitante pide un catálogo ausente. Visto en producción:
    // una tienda viva golpeando un backend dormido, con compradores esperando
    // hasta 30 segundos el arranque en frío para recibir un 404.
    //
    // Cuando el catálogo responde que no está, se anota y no se vuelve a
    // preguntar por un rato. La tienda cae a su ficha normal al instante, sin
    // velo y sin espera. El plazo es corto para que publicar se note enseguida.
    var AUSENTE_MS = 10 * 60 * 1000;
    var claveAusente = function (u) { return 'kc-sin-catalogo:' + u; };
    var estaAusente = function (u) {
      try {
        var t = parseInt(localStorage.getItem(claveAusente(u)) || '0', 10);
        return t && (Date.now() - t) < AUSENTE_MS;
      } catch (e) { return false; }
    };
    var marcarAusente = function (u) {
      try { localStorage.setItem(claveAusente(u), String(Date.now())); } catch (e) {}
    };
    var pedir = function (u) {
      if (estaAusente(u)) {
        console.warn(LOG, 'catálogo marcado como ausente hace poco; no se vuelve a pedir:', u);
        return Promise.resolve(null);
      }
      return pedirVersion(u)
        .then(function (marca) {
          // Misma versión que la copia guardada = mismo contenido: cero red.
          // (Solo con una instancia: con varias, la copia guardada es la
          // FUSIÓN y no puede compararse contra la versión de una sola.)
          if (marca && CFG_URLS.length === 1 && hit && hit.def
              && String(hit.def.updatedAt || '') === String(marca)) {
            return hit.def;
          }
          return pedirLocal(u, marca)
            .catch(function () { return pedirRemoto(u, marca); });
        })
        .catch(function (err) {
          if (/HTTP (403|404)/.test(err && err.message)) marcarAusente(u);
          throw err;
        })
        .then(function (def) {
          // Cada producto recuerda su instancia de origen: el AR y cualquier
          // llamada por-producto van al backend correcto aunque haya varios.
          var base = u.replace(/\/definition(\?.*)?$/, '');
          ((def && (def.productos || def.equipos)) || []).forEach(function (p) { p.__kcBase = base; });
          return def;
        })
        .catch(function (err) { console.warn(LOG, 'catálogo no disponible:', u, err.message); return null; });
    };
    return Promise.all(CFG_URLS.map(pedir)).then(function (defs) {
      defs = defs.filter(function (x) { return !!x; });
      if (!defs.length) {
        if (hit) { console.warn(LOG, 'ningún catálogo responde; usando copia local'); return hit.def; }
        throw new Error('ningún catálogo respondió');
      }
      var def = defs[0];
      if (defs.length > 1) {
        var prods = [];
        for (var i = 0; i < defs.length; i++) prods = prods.concat((defs[i].productos || defs[i].equipos) || []);
        def = { version: def.version, updatedAt: def.updatedAt, currency: def.currency, store: def.store, productos: prods };
      }
      defCacheWrite(refProd, def);
      return def;
    });
  }

  function findEntry(def, prod) {
    var list = (def && (def.productos || def.equipos)) || [];
    return list.filter(function (e) { return e.productId != null && String(e.productId) === String(prod.id); })[0]
      || (prod.sku ? list.filter(function (e) { return e.sku && norm(e.sku) === norm(prod.sku); })[0] : null)
      || list.filter(function (e) { return e.name && norm(e.name) === norm(prod.name); })[0]
      || null;
  }

  // ── Controles nativos del theme: la única vía para elegir variante ────────
  // Cada grupo de KIMOS se empareja con su control por NOMBRE de opción.
  //
  // CONTRATO ANCLA + ADDONS: además de los grupos de variantes (select/radio),
  // la ficha trae un checkbox por cada opción `addon` "Paso: Valor" (con su
  // `data-addon-price`). Aquí esos checkboxes se agrupan por paso en grupos
  // VIRTUALES con la misma interfaz que un grupo nativo: el paso a paso los
  // pinta igual, y elegir un valor marca su checkbox (y desmarca los hermanos)
  // — el theme suma los addon_price al precio y el submit nativo los envía.
  function nativeGroups(prod) {
    var reales = [], virtuales = [], porPaso = {};
    Array.prototype.forEach.call(document.querySelectorAll('.prod-options'), function (g) {
      var optId = g.getAttribute('data-optionid');
      var opt = (prod.options || []).filter(function (o) { return String(o.id) === String(optId); })[0];
      if (g.tagName === 'INPUT' && (g.getAttribute('type') || '').toLowerCase() === 'checkbox') {
        var nom = opt ? String(opt.name || '') : '';
        if (!nom) {
          var lb = g.closest && g.closest('label');
          nom = lb ? (lb.textContent || '').trim() : '';
        }
        var corte = nom.indexOf(': ');
        if (corte === -1) return;   // checkbox ajeno al contrato: es del theme
        var paso = nom.slice(0, corte).trim();
        var valor = nom.slice(corte + 2).trim();
        var clave = norm(paso);
        var vg = porPaso[clave];
        if (!vg) {
          vg = porPaso[clave] = { el: null, id: 'kc-addon:' + clave, name: paso, values: [], inputs: {}, virtual: true };
          virtuales.push(vg);
        }
        vg.values.push({ id: String(optId), name: valor });
        vg.inputs[String(optId)] = g;
        return;
      }
      var name = opt ? opt.name : '';
      if (!name) {
        var fs = (g.closest && (g.closest('.product-options__fieldset') || g.closest('fieldset'))) || g.parentElement;
        var t = fs && fs.querySelector && fs.querySelector('.product-options__title, legend');
        if (t) name = t.textContent.trim();
      }
      var values = [];
      if (g.tagName === 'SELECT') {
        values = Array.prototype.map.call(g.options, function (o) {
          return { id: o.value, name: (o.textContent || '').trim() };
        });
      } else {
        values = Array.prototype.map.call(g.querySelectorAll('input[type=radio]'), function (i) {
          var lab = i.closest('label');
          return { id: i.value, name: lab ? lab.textContent.trim() : i.value };
        });
      }
      reales.push({ el: g, id: optId, name: name, values: values });
    });
    return reales.concat(virtuales);
  }
  // Solo los grupos que la TIENDA usa para casar variante (los addons no
  // generan variantes: viajan aparte en el mismo POST del carro).
  function gruposDeVariante(groups) {
    return (groups || []).filter(function (g) { return !g.virtual; });
  }
  // Recargo del addon elegido en un grupo virtual (lo declara el theme en
  // data-addon-price). Para grupos reales no aplica: su precio va en la variante.
  function addonPriceDe(g, valueId) {
    var cb = g && g.virtual && g.inputs[String(valueId)];
    return cb ? (Number(cb.getAttribute('data-addon-price')) || 0) : 0;
  }

  function readSelection(groups) {
    var out = {};
    groups.forEach(function (g) {
      if (g.virtual) {
        for (var k in g.inputs) {
          if (g.inputs[k].checked) { out[g.id] = k; break; }
        }
      } else if (g.el.tagName === 'SELECT') out[g.id] = g.el.value;
      else {
        var c = g.el.querySelector('input[type=radio]:checked');
        if (c) out[g.id] = c.value;
      }
    });
    return out;
  }

  // Escribe en el control nativo y avisa al theme. Es el theme quien decide
  // precio, variante y disponibilidad: aquí solo se refleja la elección.
  function applyNative(g, valueId) {
    if (g.virtual) {
      // Grupo de addons: marcar el checkbox elegido y desmarcar los hermanos
      // (un paso = una elección). `valueId` null/desconocido desmarca todo —
      // es lo que corresponde cuando el paso queda oculto por dependencia.
      // PRIMERO todas las mutaciones y DESPUÉS los avisos: el primer `change`
      // repinta y re-evalúa dependencias, y con el grupo a medias (el viejo
      // desmarcado, el nuevo aún sin marcar) el ajuste re-marcaba el default.
      var tocados = [];
      Object.keys(g.inputs).forEach(function (k) {
        var cb = g.inputs[k];
        var debe = String(k) === String(valueId);
        if (cb.checked !== debe) {
          cb.checked = debe;
          tocados.push(cb);
        }
      });
      tocados.forEach(function (cb) {
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.jQuery) { try { window.jQuery(cb).trigger('change'); } catch (e) {} }
      });
      return;
    }
    if (g.el.tagName === 'SELECT') {
      g.el.value = String(valueId);
    } else {
      var r = g.el.querySelector('input[type=radio][value="' + String(valueId).replace(/"/g, '\\"') + '"]');
      if (r) { r.checked = true; r.dispatchEvent(new Event('click', { bubbles: true })); }
    }
    g.el.dispatchEvent(new Event('change', { bubbles: true }));
    // El theme escucha con jQuery; el evento nativo llega igual a sus handlers.
    if (window.jQuery) { try { window.jQuery(g.el).trigger('change'); } catch (e) {} }
  }

  // ── Contrato v2 (ProductLab): pasos dependientes ─────────────────────────
  // Un paso puede declarar `dependsOn: { groupId, valueIds }`: solo se muestra
  // si la selección ACTUAL del paso `groupId` está en `valueIds`. Un paso
  // oculto se FUERZA a su valor por defecto también en el control nativo,
  // porque el theme casa la variante con TODOS los controles (Jumpseller
  // exige un valor por opción) y un oculto desincronizado cobraría lo que no
  // se ve. Con JSON v1 (sin dependsOn) todo esto es transparente.
  function kimosDefault(kg) {
    var vs = (kg && kg.values) || [];
    return vs.filter(function (v) { return v.isDefault; })[0] || vs[0] || null;
  }
  // Valor de RELLENO (contrato v2): existe solo para las variantes en las que
  // su paso está oculto. Cuando el paso se ve, la ficha ni lo pinta ni lo elige.
  function esRelleno(v) { return !!(v && v.fallback === true); }
  function valorPorId(kg, id) {
    return ((kg && kg.values) || []).filter(function (v) { return String(v.id) === String(id); })[0] || null;
  }
  // Primer valor de verdad del paso: el default si no es relleno, y si no, el
  // primero que no lo sea.
  function primerElegible(kg) {
    var vs = ((kg && kg.values) || []).filter(function (v) { return !esRelleno(v); });
    return vs.filter(function (v) { return v.isDefault; })[0] || vs[0] || null;
  }
  function nativeOf(groups, kg) {
    return groups.filter(function (x) { return norm(x.name) === norm(kg.label); })[0] || null;
  }
  function kimosOf(entry, g) {
    return (entry.groups || []).filter(function (x) { return norm(x.label) === norm(g.name); })[0] || null;
  }
  function dependsOf(kg) {
    var d = kg && kg.dependsOn;
    if (!d) return null;
    var gid = d.groupId || d.stepId;   // la app publica groupId (stepId: nombre interno)
    var ids = Array.isArray(d.valueIds) ? d.valueIds : [];
    return gid && ids.length ? { groupId: gid, valueIds: ids } : null;
  }
  // Selección actual traducida a ids de KIMOS: { kimosGroupId → kimosValueId }.
  function kimosSelection(entry, groups) {
    var sel = readSelection(groups);
    var out = {};
    (entry.groups || []).forEach(function (kg) {
      var g = nativeOf(groups, kg);
      var chosen = null;
      if (g) {
        var nat = g.values.filter(function (v) { return String(v.id) === String(sel[g.id]); })[0];
        if (nat) chosen = (kg.values || []).filter(function (v) { return norm(v.name) === norm(nat.name); })[0];
      }
      if (!chosen) chosen = kimosDefault(kg);
      if (chosen) out[kg.id] = chosen.id;
    });
    return out;
  }
  function isGroupVisible(entry, kg, selMap) {
    var d = dependsOf(kg);
    if (!d) return true;
    var target = (entry.groups || []).filter(function (x) { return x.id === d.groupId; })[0];
    if (!target) return true;
    var vid = selMap && selMap[target.id] != null ? selMap[target.id] : (kimosDefault(target) || {}).id;
    return d.valueIds.some(function (x) { return String(x) === String(vid); });
  }
  // Fuerza los pasos ocultos a su default, TAMBIÉN en el control nativo
  // (applyNative → change: el theme recasa la variante). Las CADENAS (A
  // oculta a B y B oculta a C) se re-evalúan hasta estabilizar, con tope de
  // pasadas: las dependencias solo apuntan hacia atrás, así que converge.
  function enforceDependencies(entry, groups, onChanged) {
    var kgs = entry.groups || [];
    var selMap = kimosSelection(entry, groups);
    var cambios = [];
    for (var pass = 0; pass <= kgs.length; pass++) {
      var changed = false;
      kgs.forEach(function (kg) {
        var visible = isGroupVisible(entry, kg, selMap);
        var g = nativeOf(groups, kg);
        // Grupos de ADDONS (contrato ancla+addons). Un paso oculto no deja
        // NINGÚN checkbox marcado: su relleno no existe como addon, y marcar
        // el default cobraría (y listaría en el carro) lo que el cliente no
        // ve. Uno visible sin nada marcado —al montar la ficha, o al
        // reaparecer tras estar oculto— recupera su primer valor elegible.
        var sinMarca = !!(g && g.virtual) && readSelection([g])[g.id] == null;
        if (g && g.virtual && !visible) {
          if (!sinMarca) { applyNative(g, null); changed = true; }
          selMap[kg.id] = (kimosDefault(kg) || {}).id;   // para las cadenas
          return;
        }
        // OCULTO → su valor por defecto (que debería ser el de relleno).
        // VISIBLE → nunca el relleno: ese valor solo existe para sostener las
        // variantes en las que el paso no se muestra. Sin esto, el "No aplica"
        // que hace falta para las combinaciones ocultas se podía comprar.
        var dv = visible ? primerElegible(kg) : kimosDefault(kg);
        if (visible && !sinMarca && !esRelleno(valorPorId(kg, selMap[kg.id]))) return;
        if (!dv || (!sinMarca && String(selMap[kg.id]) === String(dv.id))) return;
        selMap[kg.id] = dv.id;
        changed = true;
        if (g) {
          var nat = g.values.filter(function (v) { return norm(v.name) === norm(dv.name); })[0];
          if (nat && String(readSelection(groups)[g.id]) !== String(nat.id)) {
            applyNative(g, nat.id);
            // NO se anuncia nada: forzar el relleno de un paso oculto (o salir
            // de él al abrirse) es cocina interna de la variante. Anunciarlo
            // ("Ajustado automáticamente: Procesador → No aplica") confundía
            // al cliente con un mensaje sobre algo que ni siquiera ve.
          }
        }
      });
      if (!changed) break;
    }
    if (cambios.length && onChanged) onChanged(cambios);
    return selMap;
  }

  // Formato de dinero para las cards (deltas/totales). El precio COBRABLE
  // sigue siendo siempre el del theme; esto solo orienta la elección.
  function fmtMonto(n) {
    try { return '$' + new Intl.NumberFormat(document.documentElement.lang || 'es-CL').format(Math.round(n)); }
    catch (e) { return '$' + Math.round(n); }
  }
  function fmtDelta(dlt) { return (dlt < 0 ? '− ' : '+ ') + fmtMonto(Math.abs(dlt)); }

  // Texto del precio tal como lo pinta el theme. Hay que filtrar con cuidado:
  // los themes publican datos en <script class="product-price-json">, y un
  // selector por comodín se los traga y acaba mostrando JSON crudo en pantalla.
  // Precio REAL de la variante seleccionada, leído del JSON que el theme
  // imprime. Es la fuente autoritativa; rascar el DOM es adivinar.
  // Los grupos nativos de la ficha montada, para que el precio se pueda pedir
  // desde cualquier sitio sin arrastrarlos por parámetro.
  var VARIANT_GROUPS = null;

  /**
   * VARIANTES REALES del theme (`script.product-json`): la lista completa que
   * imprime Liquid, con el precio de cada combinación. Es la misma fuente que
   * usa el theme para repintar su precio.
   */
  var VARIANTES = (function () {
    var n = document.querySelector('script.product-json');
    if (!n) return [];
    try {
      var p = JSON.parse(n.textContent);
      if (Array.isArray(p)) return p;
      if (p && Array.isArray(p.variants)) return p.variants;
      return [];
    } catch (e) { return []; }
  })();
  // La variante que casa con lo elegido en los controles nativos. Solo cuentan
  // los grupos REALES (con ancla+addons la variante es únicamente el color;
  // los addons no forman parte de ninguna variante).
  function varianteActual(groups) {
    var reales = gruposDeVariante(groups);
    if (!VARIANTES.length || !reales || !reales.length) return null;
    var sel = readSelection(reales);
    var ids = reales.map(function (g) { return String(sel[g.id] || ''); }).filter(Boolean);
    if (ids.length !== reales.length) return null;
    for (var i = 0; i < VARIANTES.length; i++) {
      var e = VARIANTES[i] || {};
      // Formas vistas en producción: {values:[{value:{id}}]}, {values:[{id}]},
      // {options:[{value_id}]} y {options:[{id}]}. Se aceptan todas.
      var crudos = e.values || e.options || [];
      var vals = [];
      for (var k = 0; k < crudos.length; k++) {
        var x = crudos[k] || {};
        var vid = (x.value && x.value.id != null) ? x.value.id
          : (x.value_id != null ? x.value_id : x.id);
        if (vid != null) vals.push(String(vid));
      }
      if (vals.length !== ids.length) continue;
      var todos = true;
      for (var j = 0; j < vals.length; j++) { if (ids.indexOf(vals[j]) === -1) { todos = false; break; } }
      if (todos) return e.variant || e;
    }
    return null;
  }
  // Precio "desde": la variante MÁS BARATA de verdad. El theme pinta el de la
  // primera variante, que es la configuración por defecto y no tiene por qué
  // ser la más barata; anunciarla como "desde" sería mentir por arriba.
  function precioDesde() {
    var min = Infinity;
    for (var i = 0; i < VARIANTES.length; i++) {
      var p = precioDeVariante((VARIANTES[i] || {}).variant || VARIANTES[i]);
      if (p != null && isFinite(p) && p > 0 && p < min) min = p;
    }
    return min === Infinity ? null : min;
  }
  function precioDeVariante(v) {
    if (!v) return null;
    if (v.price_with_discount != null) return Number(v.price_with_discount);
    var n = (Number(v.price) || 0) - (Number(v.discount) || 0);
    return isFinite(n) ? n : null;
  }
  /**
   * Precio de LO QUE HAY ELEGIDO ahora mismo.
   *
   * Antes salía de `product-form-json`, que solo trae la PRIMERA variante: el
   * precio se quedaba clavado en el de arranque por mucho que se cambiara de
   * paso. Ahora se busca la variante que casa con la selección; si no hay
   * lista de variantes (theme raro o producto sin ellas), se cae al JSON de
   * arranque, que al menos es correcto para un producto simple.
   */
  // Suma de los addons MARCADOS ahora mismo (contrato ancla+addons): la misma
  // cuenta que hace el theme para repintar su precio (data-addon-price de los
  // checkboxes marcados). En una ficha sin addons vale 0 y no cambia nada.
  function addonsMarcados() {
    var t = 0;
    var cbs = document.querySelectorAll('input.prod-options[type=checkbox]:checked');
    for (var i = 0; i < cbs.length; i++) t += Number(cbs[i].getAttribute('data-addon-price')) || 0;
    return t;
  }
  // Precio de arranque del producto según el theme (JSON de la ficha), sin
  // variante ni addons: el respaldo cuando no hay lista de variantes.
  function precioBaseProducto() {
    var f = document.querySelector('script.product-form-json');
    if (!f) return null;
    try {
      var info = (JSON.parse(f.textContent) || {}).info || {};
      var vp = info.variant && info.variant.price;
      var p = info.product && info.product.price;
      var n = vp != null ? Number(vp) : (p != null ? Number(p) : null);
      return n != null && isFinite(n) ? n : null;
    } catch (e) { return null; }
  }
  function themePriceValue(groups) {
    var v = varianteActual(groups || VARIANT_GROUPS);
    var real = precioDeVariante(v);
    // La variante (el color) es la BASE; los addons marcados suman encima —
    // exactamente lo que cobrará el servidor de la tienda al añadir al carro.
    if (real != null && isFinite(real)) return real + addonsMarcados();
    var n = precioBaseProducto();
    return n != null ? n + addonsMarcados() : null;
  }
  var digitos = function (t) { return String(t).replace(/\D/g, ''); };

  /**
   * Texto del precio para la barra. Antes se cogía el PRIMER nodo del DOM con
   * pinta de precio, y `[class*="price"]` acepta casi cualquier cosa: bastaba
   * un contador o una insignia para acabar mostrando un número que no era el
   * precio. Ahora se sabe cuánto vale de verdad (JSON del theme) y ese número
   * se usa para RECONOCER el nodo correcto entre todos los candidatos.
   */
  function themePriceText() {
    var valor = themePriceValue();
    var buscado = valor != null && valor > 0 ? digitos(String(Math.round(valor))) : null;
    var sels = ['.product-page__info .price', '.product-price', '.price', '[class*="price"]'];
    var simbolo = '';
    var vivo = '';   // primer precio legible que el THEME está mostrando ahora
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll('.kc-hidden-native ' + sels[i] + ', ' + sels[i]);
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (n.closest && n.closest('.kimos-cfg')) continue;      // no leerse a sí mismo
        if (/^(SCRIPT|TEMPLATE|STYLE|NOSCRIPT)$/.test(n.tagName)) continue;
        var t = (n.textContent || '').trim();
        if (!t || t.length > 40 || !/\d/.test(t) || t.indexOf('{') !== -1) continue;
        if (!simbolo) simbolo = (t.match(/^[^\d]*/) || [''])[0].trim();
        if (!vivo) vivo = t;
        // Con precio conocido solo vale el nodo que lo muestra EXACTO. Antes
        // bastaba con "contener" los dígitos, y al sumar addons el theme
        // repinta su precio con decimales fantasma ("$1,482,811.000"): esa
        // cadena contiene el número buscado y se copiaba tal cual a la barra.
        if (buscado) { if (digitos(t) === buscado) return t; }
        else if (valor == null) return t;   // sin JSON no queda otra que confiar
      }
    }
    // Con ancla + addons el total es NUESTRA suma (precio de variante + los
    // data-addon-price marcados, ambos impresos por el servidor): si ningún
    // nodo del theme lo muestra bien formateado, se formatea aquí en el
    // locale de la tienda — nunca se copia un texto que diga otro número.
    if (valor == null) return vivo || '';
    // El producto está a CERO en la tienda. Se dice en claro en vez de pintar
    // un "0" suelto al lado de "Añadir al carro", que parece un fallo de la
    // ficha cuando en realidad es el precio del producto en Jumpseller.
    if (valor === 0) {
      console.warn(LOG, 'el producto tiene PRECIO 0 en la tienda — no es la ficha: '
        + 'revisa el precio en Jumpseller / en la app Productos.');
      return (simbolo || '$') + '0';
    }
    // Hay precio pero ningún nodo del theme lo muestra: se formatea aquí.
    try {
      return (simbolo || '$') + new Intl.NumberFormat(document.documentElement.lang || 'es-CL', { maximumFractionDigits: 0 }).format(valor);
    } catch (e) { return (simbolo || '$') + valor; }
  }

  // ── Render del builder (secciones hero) ──────────────────────────────────
  var PAT_ROWS = {
    clasico: [['top'], ['left', 'center', 'right'], ['bottom']],
    columnas: [['top'], ['left', 'right'], ['bottom']],
    apilado: [['top'], ['middle'], ['bottom']],
    mosaico: [['top'], ['tl', 'tr'], ['bl', 'br'], ['bottom']],
    banda: [['left', 'right']],
    tercios: [['a', 'b', 'c']],
    'sidebar-izq': [['side', 'main']],
    'sidebar-der': [['main', 'side']],
    filas: [['r1'], ['r2']],
    destacado: [['top'], ['main'], ['f1', 'f2', 'f3']],
    mosaico23: [['a', 'b', 'c'], ['d', 'e', 'f']],
    galeria: [['top'], ['big', 'side'], ['bottom']],
  };
  var FLEX = { side: 1, main: 2.2, big: 2.2 };

  function renderBlock(b, ctx) {
    var n;
    if (b.type === 'photo') {
      n = el('div', 'kc-b kc-b-photo');
      var img = el('img');
      img.src = ctx.image || '';
      img.alt = (ctx.altDe && ctx.altDe(ctx.image)) || ctx.name || '';
      img.className = 'kc-photo kc-photo-' + (b.size || 'm') + (b.anim && b.anim !== 'none' ? ' kc-anim-' + b.anim : '');
      n.appendChild(img);
    } else if (b.type === 'title') {
      n = el('h2', 'kc-b kc-b-title', ctx.name || '');
      // El SKU acompaña al nombre, como en la ficha de computadores.
      if (ctx.sku) n.appendChild(el('span', 'kc-b-sku', 'SKU · ' + ctx.sku));
    } else if (b.type === 'text') {
      n = el('div', 'kc-b kc-b-text kc-size-' + (b.size || 'l'), b.text || '');
      if (b.color) n.style.color = b.color;
    } else if (b.type === 'items') {
      // Item (+): botón que despliega su texto EN FLUJO, como en la app de
      // computadores. Se abren varios a la vez y se empujan entre sí (nada de
      // popovers absolutos que se solapen). El "+" gira 45° al abrir y, con
      // `float`, los items flotan suavemente.
      n = el('div', 'kc-b kc-b-items');
      if (b.float !== false) n.setAttribute('data-float', '1');
      (b.items || []).forEach(function (it) {
        var w = el('div', 'kc-item');
        var btn = el('button', 'kc-item-btn');
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        var mas = el('span', 'kc-item-plus', '+');
        mas.setAttribute('aria-hidden', 'true');
        btn.appendChild(mas);
        btn.appendChild(el('span', '', it.title || ''));
        var txt = it.text ? el('div', 'kc-item-x', it.text) : null;
        if (txt) {
          btn.addEventListener('click', function () {
            var abierto = w.classList.toggle('open');
            btn.setAttribute('aria-expanded', abierto ? 'true' : 'false');
          });
        } else {
          btn.disabled = true;              // sin texto no hay nada que abrir
          btn.classList.add('kc-item-solo');
        }
        w.appendChild(btn);
        if (txt) w.appendChild(txt);
        n.appendChild(w);
      });
    } else if (b.type === 'cta') {
      n = el('div', 'kc-b kc-b-cta');
      // Producto sin pasos: "configurar" no existe — el botón ES el carro
      // (misma regla que la barra). Con etiqueta propia se respeta; con la
      // genérica 'Configurar' se cambia por la del carro del theme.
      var alCarroCta = b.action !== 'url' && ctx.conPasos === false;
      var etiquetaCta = b.label || 'Configurar';
      if (alCarroCta && (!b.label || /^configurar$/i.test(String(b.label).trim()))) {
        etiquetaCta = (ctx.etiquetaCarro && ctx.etiquetaCarro()) || 'Añadir al carro';
      }
      var btn = el('button', 'kc-btn kc-btn-' + (b.style || 'primary'), etiquetaCta);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (b.action === 'url' && b.url) window.location.href = b.url;
        else if (alCarroCta && ctx.alCarro) ctx.alCarro();
        else ctx.goTab('configurar');
      });
      n.appendChild(btn);
    } else if (b.type === 'icons') {
      // Destaques: cada uno con su filete de acento a la izquierda, igual que
      // en el previsualizador de la app (no es un bloque de texto suelto).
      n = el('div', 'kc-b kc-b-icons');
      if (b.color) n.style.color = b.color;
      (b.items || []).forEach(function (it) {
        var w = el('div', 'kc-icon');
        if (it.icon) w.appendChild(el('div', 'kc-icon-i', it.icon));
        w.appendChild(el('div', 'kc-icon-t', it.title || ''));
        if (it.text) w.appendChild(el('div', 'kc-icon-x', it.text));
        n.appendChild(w);
      });
    } else if (b.type === 'specs') {
      n = el('div', 'kc-b kc-b-specs');
      (ctx.specs || []).slice(0, b.count || 4).forEach(function (sp) {
        var r = el('div', 'kc-spec-min');
        r.appendChild(el('span', 'kc-spec-l', sp.label || ''));
        r.appendChild(el('span', 'kc-spec-v', sp.value || ''));
        n.appendChild(r);
      });
    } else if (b.type === 'gallery') {
      n = el('div', 'kc-b kc-b-photo');
      // `size:'auto'` (contrato v2) = alto natural de la foto, sin recortes.
      // Las mismas animaciones que la foto del producto (flotar/respirar/…).
      var gi = el('img', 'kc-photo kc-photo-' + (b.size || 'm')
        + (b.anim && b.anim !== 'none' ? ' kc-anim-' + b.anim : ''));
      // Nº recortado a la galería real: si el bloque pide la foto 9 y hay 4,
      // se muestra la última (no un hueco ni la principal por sorpresa).
      var gimgs = ctx.images || [];
      var gn = Math.max(1, b.index || 1);
      var gIdx = Math.min(gn, gimgs.length) - 1;
      gi.src = gimgs[gIdx] || ctx.image || '';
      gi.alt = (ctx.altDe && ctx.altDe(gi.src, gIdx >= 0 ? gIdx : null)) || '';
      n.appendChild(gi);
    } else if (b.type === 'description') {
      // La descripción del producto en la tienda ES HTML (el mismo que
      // Jumpseller pinta en su ficha nativa): se renderiza como tal, con los
      // <script>/manejadores inline retirados por si acaso. Con recorte
      // (max > 0) se degrada a texto plano: truncar HTML rompería el marcado.
      var d = ctx.desc || '';
      var max = b.max || 0;
      n = el('div', 'kc-b kc-b-desc kc-size-' + (b.size || 'm'));
      var esHtml = /<[a-z][\s\S]*>/i.test(d);
      // Una descripción HTML se muestra SIEMPRE con su diseño (bordes,
      // viñetas, altos de línea): el recorte `max` solo aplica al texto
      // plano — truncar HTML rompería el marcado y antes degradaba toda la
      // descripción a texto corrido "compactado".
      if (!esHtml) {
        var plano = d;
        if (max > 0 && plano.length > max) plano = plano.slice(0, max).replace(/\s+\S*$/, '') + '…';
        n.textContent = plano;
      } else {
        n.innerHTML = d
          .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
          .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        // El HTML de la tienda trae colores de TEXTO pensados para su ficha
        // de fondo claro (grises #555). Dentro de un hero manda el color del
        // hero: los tonos NEUTROS (grises/negros, sin saturación) se sueltan
        // para HEREDARLO — texto blanco sobre fondo oscuro, legible — y los
        // colores VIVOS (acentos de marca, ✓ de las viñetas) se respetan.
        var rgbDe = function (c) {
          c = String(c || '').trim().toLowerCase();
          var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
          if (m) {
            var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
            return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
          }
          m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
          return m ? [+m[1], +m[2], +m[3]] : null;
        };
        Array.prototype.forEach.call(n.querySelectorAll('[style]'), function (elx) {
          var rgb = rgbDe(elx.style && elx.style.color);
          if (rgb && Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) <= 32) {
            elx.style.color = '';
          }
        });
      }
    } else if (b.type === 'html') {
      n = el('div', 'kc-b kc-b-html');
      n.innerHTML = b.html || '';
    } else {
      return null;
    }
    if (b.align === 'left') n.style.textAlign = 'left';
    else if (b.align === 'right') n.style.textAlign = 'right';
    // Los bloques que son flex por dentro (items, iconos) no se alinean con
    // text-align: el CSS los reparte leyendo este atributo.
    if (b.align) n.setAttribute('data-align', b.align);
    return n;
  }

  function renderHero(sec, ctx) {
    var box = el('div', 'kc-hero kc-h-' + (sec.height || 'm'));
    if (sec.bgColor) box.style.background = sec.bgColor;
    if (sec.bgImageUrl) {
      box.style.backgroundImage = 'url("' + sec.bgImageUrl + '")';
      box.classList.add('kc-hero-bg');
      if (sec.overlay !== false) box.classList.add('kc-hero-ov');
    }
    if (sec.textColor) box.style.color = sec.textColor;
    var rows = PAT_ROWS[sec.pattern] || PAT_ROWS.clasico;
    rows.forEach(function (cells) {
      var row = el('div', 'kc-row');
      // Las filas de varias celdas se reparten el alto sobrante del hero; las
      // de una sola (título arriba, botón abajo) ocupan solo lo suyo.
      row.setAttribute('data-cols', String(cells.length));
      cells.forEach(function (cid) {
        var cell = el('div', 'kc-cell');
        cell.style.flex = String(FLEX[cid] || 1);
        (((sec.slots || {})[cid]) || []).forEach(function (b) {
          var n = renderBlock(b, ctx);
          if (n) cell.appendChild(n);
        });
        row.appendChild(cell);
      });
      box.appendChild(row);
    });
    return box;
  }

  function renderSpecsTable(specs) {
    var wrap = el('div', 'kc-specs');
    var groups = {};
    (specs || []).forEach(function (sp) {
      var g = sp.group || '';
      (groups[g] = groups[g] || []).push(sp);
    });
    Object.keys(groups).forEach(function (g) {
      if (g) wrap.appendChild(el('div', 'kc-specs-g', g));
      var tbl = el('table', 'kc-specs-t');
      groups[g].forEach(function (sp) {
        var tr = el('tr');
        tr.appendChild(el('th', null, sp.label || ''));
        tr.appendChild(el('td', null, sp.value || ''));
        tbl.appendChild(tr);
      });
      wrap.appendChild(tbl);
    });
    return wrap;
  }

  // `cfg` = storefront.style.photos: tamaño de la galería dentro de Explorar
  // (s|m|l|xl) y fotos por fila (0 = automático). Sin cfg, todo como antes.
  // La galería es SOLO la galería. La nota es su propia sección y se ve
  // únicamente si está en la lista de la experiencia: pintarla también aquí
  // dejaba texto bajo las fotos que no había forma de quitar.
  function renderPhotos(images, cfg, altDe) {
    altDe = altDe || function () { return ''; };
    var wrap = el('div', 'kc-fotos');
    var pc = cfg || {};
    wrap.setAttribute('data-size', ['s', 'l', 'xl'].indexOf(pc.size) !== -1 ? pc.size : 'm');
    // Disposición: 'visor' (foto grande + miniaturas debajo), 'lado'
    // (miniaturas en columna a la izquierda) o 'mosaico' (solo la grilla, sin
    // visor: para catálogos con muchas fotos del mismo tamaño).
    wrap.setAttribute('data-layout', ['lado', 'mosaico'].indexOf(pc.layout) !== -1 ? pc.layout : 'visor');
    // Alto de la foto grande y tamaño de las miniaturas, por separado.
    wrap.setAttribute('data-main', ['s', 'l', 'xl', 'auto'].indexOf(pc.mainSize) !== -1 ? pc.mainSize : 'm');
    wrap.setAttribute('data-thumb', ['s', 'l'].indexOf(pc.thumbSize) !== -1 ? pc.thumbSize : 'm');
    // Encaje: 'contain' respeta la foto entera; 'cover' recorta para que todas
    // se vean iguales (catálogos con fotos de proporciones distintas).
    wrap.setAttribute('data-fit', pc.fit === 'cover' ? 'cover' : 'contain');
    if (pc.frame === false) wrap.setAttribute('data-frame', 'no');
    if (pc.cols > 0) {
      wrap.setAttribute('data-cols', String(pc.cols));
      wrap.style.setProperty('--kc-foto-cols', String(pc.cols));
    }
    // Visor EN LÍNEA (nunca un modal): la foto elegida se ve grande sobre la
    // grilla, con flechas y contador. Es la galería de la ficha de
    // computadores, que es la que el cliente ya conoce.
    var main = el('div', 'kc-foto-main');
    var big = el('img');
    big.src = images[0] || '';
    big.alt = altDe(images[0], 0);
    main.appendChild(big);
    var thumbs = images.length > 1 ? el('div', 'kc-foto-thumbs') : null;
    var actual = 0;
    var count = null;
    function mostrar(i) {
      actual = (i + images.length) % images.length;
      big.src = images[actual];
      big.alt = altDe(images[actual], actual);
      if (count) count.textContent = (actual + 1) + ' / ' + images.length;
      if (!thumbs) return;
      Array.prototype.forEach.call(thumbs.children, function (c, k) {
        c.classList[k === actual ? 'add' : 'remove']('on');
      });
    }
    if (images.length > 1) {
      var prev = el('button', 'kc-foto-nav kc-foto-prev', '←');
      var next = el('button', 'kc-foto-nav kc-foto-next', '→');
      prev.type = 'button'; next.type = 'button';
      prev.setAttribute('aria-label', 'Foto anterior');
      next.setAttribute('aria-label', 'Foto siguiente');
      prev.addEventListener('click', function () { mostrar(actual - 1); });
      next.addEventListener('click', function () { mostrar(actual + 1); });
      count = el('div', 'kc-foto-count', '1 / ' + images.length);
      main.appendChild(prev); main.appendChild(next); main.appendChild(count);
    }
    if (pc.layout !== 'mosaico') wrap.appendChild(main);
    if (thumbs) {
      images.forEach(function (u, i) {
        var t = el('img', 'kc-foto-th' + (i === 0 ? ' on' : ''));
        t.src = u;
        t.alt = altDe(u, i);
        t.addEventListener('click', function () { mostrar(i); });
        thumbs.appendChild(t);
      });
      wrap.appendChild(thumbs);
    }
    return wrap;
  }

  // Sección `imagen` (contrato v2): UNA foto a lo ancho con su ALTO NATURAL
  // (height auto, sin recortes). `width:'full'` sangra hasta el borde del
  // viewport; con `link` la imagen entera es un enlace. Repetible.
  function renderImagen(sec) {
    if (!sec || !sec.imageUrl) return null;
    // El ancho (auto/container/full) lo aplica anchoSeccion() al insertarla.
    var wrap = el('div', 'kc-imagen');
    var img = el('img', 'kc-imagen-img');
    img.src = sec.imageUrl;
    img.alt = sec.alt || '';
    img.loading = 'lazy';
    if (sec.link) {
      var a = el('a');
      a.href = sec.link;
      a.appendChild(img);
      wrap.appendChild(a);
    } else {
      wrap.appendChild(img);
    }
    return wrap;
  }

  // Precio de una card según style.showDeltas (contrato v2):
  //   'delta' (default y v1) → diferencia contra lo YA elegido en el paso;
  //   'total' → precio ABSOLUTO de la variante candidata: el precio real que
  //             el theme publica para la variante actual (server-side, en
  //             product-form-json) más la diferencia de deltas del JSON;
  //   'none'  → sin precio en las cards.
  // El recargo mostrado en la card sale DE LA TIENDA cuando se puede saber
  // (dltTienda): data-addon-price de los addons, o diferencia de precio entre
  // variantes para el paso de color. Es EXACTAMENTE lo que el servidor va a
  // cobrar — los deltas del catálogo (kv.delta, con su propio redondeo)
  // quedan solo de respaldo para fichas del modelo antiguo, donde el número
  // mostrado y el cobrado podían diferir en el redondeo.
  function cardPrecio(mode, on, kv, kvSel, precioAhora, dltTienda) {
    if (mode === 'none' || on) return '';
    var dlt = dltTienda != null ? dltTienda
      : (kv && kv.delta != null
        ? (Number(kv.delta) || 0) - (kvSel && kvSel.delta != null ? Number(kvSel.delta) || 0 : 0)
        : null);
    if (dlt == null) return '';
    if (mode === 'total' && precioAhora != null) return fmtMonto(precioAhora + dlt);
    return dlt === 0 ? '' : fmtDelta(dlt);
  }
  // Precio de la variante que resultaría de SUSTITUIR, en la selección actual
  // de los grupos reales, el valor del grupo `g` por `valueId`. null cuando la
  // combinación no existe en la lista del theme (se cae al delta del catálogo).
  function precioVarianteSustituyendo(g, valueId) {
    var reales = gruposDeVariante(VARIANT_GROUPS || []);
    if (!reales.length || !VARIANTES.length || valueId == null) return null;
    var sel = readSelection(reales);
    sel[g.id] = String(valueId);
    var ids = reales.map(function (x) { return String(sel[x.id] || ''); }).filter(Boolean);
    if (ids.length !== reales.length) return null;
    for (var i = 0; i < VARIANTES.length; i++) {
      var e = VARIANTES[i] || {};
      var crudos = e.values || e.options || [];
      var vals = [];
      for (var k = 0; k < crudos.length; k++) {
        var x = crudos[k] || {};
        var vid = (x.value && x.value.id != null) ? x.value.id
          : (x.value_id != null ? x.value_id : x.id);
        if (vid != null) vals.push(String(vid));
      }
      if (vals.length !== ids.length) continue;
      var todos = true;
      for (var j = 0; j < vals.length; j++) { if (ids.indexOf(vals[j]) === -1) { todos = false; break; } }
      if (todos) return precioDeVariante(e.variant || e);
    }
    return null;
  }

  // ── Pasos de configuración ───────────────────────────────────────────────
  // v2: respeta dependsOn (los ocultos no se pintan y los visibles se
  // renumeran), colapso por paso (style.stepsCollapsed arranca todo plegado
  // salvo el primero visible), cantidad ×N y precio por card (showDeltas).
  function renderSteps(entry, groups, ctx) {
    var st = ctx.style || {};
    var wrap = el('div', 'kc-steps');
    var selMap = kimosSelection(entry, groups);
    var sel = readSelection(groups);
    // Un control nativo sin paso KIMOS emparejado se muestra siempre (no hay
    // metadatos para ocultarlo y esconderlo dejaría la variante coja).
    var visibles = groups.filter(function (g) {
      var kg = kimosOf(entry, g);
      return !kg || isGroupVisible(entry, kg, selMap);
    });
    // Estado de colapso persistente entre repintados.
    if (!ctx.stepsOpen) {
      ctx.stepsOpen = {};
      visibles.forEach(function (g, i) {
        ctx.stepsOpen[g.id] = st.stepsCollapsed === true ? i === 0 : true;
      });
    }
    var precioAhora = themePriceValue();
    visibles.forEach(function (g, idx) {
      var kg = kimosOf(entry, g);
      // Un paso que reaparece por dependencia hereda el modo por defecto.
      if (!(g.id in ctx.stepsOpen)) ctx.stepsOpen[g.id] = st.stepsCollapsed !== true;
      var abierto = ctx.stepsOpen[g.id] !== false;
      var sec = el('div', 'kc-step' + (abierto ? '' : ' kc-closed'));
      var selId = sel[g.id];
      var natSel = g.values.filter(function (v) { return String(v.id) === String(selId); })[0];
      var kvSel = kg && natSel ? (kg.values || []).filter(function (x) { return norm(x.name) === norm(natSel.name); })[0] : null;

      var head = el('button', 'kc-step-h');
      head.type = 'button';
      head.appendChild(el('span', 'kc-step-num', (idx + 1 < 10 ? '0' : '') + (idx + 1)));
      head.appendChild(el('span', 'kc-step-t', kg ? kg.label : g.name));
      if (!abierto && natSel) head.appendChild(el('span', 'kc-step-sel', natSel.name));
      head.appendChild(el('span', 'kc-step-car', abierto ? '▾' : '▸'));
      head.addEventListener('click', function () {
        ctx.stepsOpen[g.id] = !abierto;
        ctx.refresh();
      });
      sec.appendChild(head);

      var cards = el('div', 'kc-cards');
      // Paso de COLOR: si sus valores traen swatch y ninguno foto, las cards
      // se pintan como muestras grandes de color (el nombre debajo) en vez de
      // cajas con hueco de imagen — es lo que se espera al elegir un tono.
      var valsK = (kg && kg.values) || [];
      var esPasoColor = valsK.length > 0
        && valsK.every(function (x) { return x.swatchColor && !x.imageUrl; });
      if (esPasoColor) cards.setAttribute('data-modo', 'color');
      g.values.forEach(function (v) {
        var kv = kg ? (kg.values || []).filter(function (x) { return norm(x.name) === norm(v.name); })[0] : null;
        if (esRelleno(kv)) return;   // relleno: no se ofrece cuando el paso se ve
        var on = String(selId) === String(v.id);
        var c = el('button', 'kc-card' + (on ? ' on' : ''));
        c.type = 'button';
        if (kv && kv.imageUrl) {
          var im = el('img', 'kc-card-img');
          im.src = kv.imageUrl; im.alt = '';
          c.appendChild(im);
        } else if (kv && kv.swatchColor) {
          var sw = el('span', 'kc-card-sw');
          sw.style.background = kv.swatchColor;
          c.appendChild(sw);
        }
        // Cantidad: "2× Kingston 8GB". Si el nombre YA dice la cantidad
        // ("16GB (2×8)"), no se repite nada — "16GB (2×8) ×2" era leerlo dos
        // veces y entender cuatro módulos.
        var q = kv ? Math.round(Number(kv.qty) || 1) : 1;
        var dice = q > 1 && new RegExp('(^|[^0-9])' + q + '\\s*[x×]|[x×]\\s*' + q + '([^0-9]|$)', 'i').test(v.name || '');
        var nombre = el('span', 'kc-card-n');
        if (q > 1 && !dice) nombre.appendChild(el('span', 'kc-card-qty', q + '× '));
        nombre.appendChild(document.createTextNode(v.name));
        c.appendChild(nombre);
        if (kv && kv.desc) c.appendChild(el('span', 'kc-card-d', kv.desc));
        // Recargo REAL de esta card según la tienda: addons por su
        // data-addon-price; color por la diferencia de precio entre variantes.
        var dltTienda = null;
        if (g.virtual) {
          dltTienda = addonPriceDe(g, v.id) - (selId != null ? addonPriceDe(g, selId) : 0);
        } else if (VARIANTES.length) {
          var pCand = precioVarianteSustituyendo(g, v.id);
          var pAct = selId != null ? precioVarianteSustituyendo(g, selId) : null;
          if (pCand != null && pAct != null) dltTienda = pCand - pAct;
        }
        var precio = cardPrecio(st.showDeltas || 'delta', on, kv, kvSel, precioAhora, dltTienda);
        if (precio) c.appendChild(el('span', 'kc-card-price', precio));
        c.addEventListener('click', function () {
          applyNative(g, v.id);
          ctx.refresh();
        });
        cards.appendChild(c);
      });
      sec.appendChild(cards);
      wrap.appendChild(sec);
    });
    return wrap;
  }

  // ── Motor 3D (carga diferida) ────────────────────────────────────────────
  function engineUrls() {
    if (CFG.engine) return [CFG.engine];
    var src = (SELF && SELF.src) || '';
    if (!src) return ['kimos-engine3d.js'];
    var base = src.replace(/[^/]*$/, '');
    var q = (src.match(/\?.*$/) || [''])[0];
    var min = /\.min\.js(\?|$)/.test(src);
    // Jumpseller quita los guiones del nombre al subirlo
    // (kimos-engine3d.js → kimosengine3d.js) y además minifica: se prueban
    // las cuatro variantes hasta que una carga.
    var out = [];
    ['kimos-engine3d', 'kimosengine3d'].forEach(function (n) {
      var a = base + n + '.min.js' + q;
      var b = base + n + '.js' + q;
      if (min) { out.push(a, b); } else { out.push(b, a); }
    });
    return out;
  }
  // ── De dónde sale el .glb ────────────────────────────────────────────────
  // Igual que el catálogo: la tienda primero, KIMOS como respaldo. Si el
  // modelo se subió a los Assets del theme (a mano, como el kit), la ficha lo
  // carga desde ahí y deja de necesitar a KIMOS para mostrarse. Jumpseller le
  // quita los guiones al nombre al subirlo, así que se prueban las variantes.
  function modeloUrls(m3) {
    var out = [];
    var nombre = String((m3 && m3.asset) || '').trim().replace(/^.*[/\\]/, '');
    if (nombre) {
      var src = (SELF && SELF.src) || '';
      var base = src ? src.replace(/[^/]*$/, '') : '';
      if (base) {
        var q = (src.match(/\?.*$/) || [''])[0];
        var plano = nombre.replace(/-/g, '');
        out.push(base + nombre + q);
        if (plano !== nombre) out.push(base + plano + q);
      }
    }
    var propia = String((m3 && m3.url) || '').trim();
    if (propia) out.push(propia);
    return out;
  }
  function ponerModelo(viewer, m3) {
    var urls = modeloUrls(m3);
    var i = 0;
    var intentar = function () {
      if (i >= urls.length) return Promise.reject(new Error('modelo 3D no disponible'));
      var u = urls[i++];
      return viewer.setModel({ url: u, rotation: m3.rotation, mirror: m3.mirror, parts: m3.parts })
        .catch(function (err) {
          if (i < urls.length) { console.warn(LOG, 'modelo no está en', u, '— probando el siguiente'); return intentar(); }
          throw err;
        });
    };
    return intentar();
  }
  function loadEngine() {
    if (window.KimosEngine3D) return Promise.resolve(window.KimosEngine3D);
    var urls = engineUrls();
    return new Promise(function (res, rej) {
      var i = 0;
      var go = function () {
        if (i >= urls.length) return rej(new Error('motor 3D no disponible'));
        var s = document.createElement('script');
        s.src = urls[i++];
        s.onload = function () { window.KimosEngine3D ? res(window.KimosEngine3D) : rej(new Error('sin KimosEngine3D')); };
        s.onerror = go;
        document.head.appendChild(s);
      };
      go();
    });
  }

  function build3dState(entry, groups) {
    var st = { colors: {}, finishes: {}, hidden: {} };
    var sel = readSelection(groups);
    (entry.groups || []).forEach(function (kg) {
      var g = groups.filter(function (x) { return norm(x.name) === norm(kg.label); })[0];
      var chosen = null;
      if (g) {
        var vid = sel[g.id];
        var nat = g.values.filter(function (v) { return String(v.id) === String(vid); })[0];
        if (nat) chosen = (kg.values || []).filter(function (v) { return norm(v.name) === norm(nat.name); })[0];
      }
      if (!chosen) chosen = (kg.values || []).filter(function (v) { return v.isDefault; })[0] || (kg.values || [])[0];
      if (!chosen) return;
      (chosen.model3d || []).forEach(function (e) {
        if (e.type === 'color') st.colors[e.partId] = e.color;
        else if (e.type === 'finish') st.finishes[e.partId] = e.finishId;
        else if (e.type === 'hide') st.hidden[e.partId] = true;
      });
    });
    return st;
  }

  // ── "Ver en tu espacio" (realidad aumentada) ─────────────────────────────
  // Coloca el producto CON LA CONFIGURACIÓN ELEGIDA sobre el suelo real, a
  // tamaño real, usando la cámara. Es progresivo por partida doble: el botón
  // solo aparece si el navegador soporta WebXR `immersive-ar` (Android/Chrome;
  // iOS no lo tiene) y si el producto declara su medida real — sin ella habría
  // que inventar la escala, y un mueble a tamaño equivocado engaña al cliente.
  // ── Google Scene Viewer: el AR de Android, sin WebXR ─────────────────────
  // Lo abre el SISTEMA con un intent, así que funciona en cualquier navegador
  // Android —Chrome, Firefox, Vivaldi, Samsung— y no depende de que el
  // navegador implemente WebXR, que es lo que nos tuvo bloqueados. Necesita el
  // .glb a escala real publicado por la app (model3d.arUrl): Scene Viewer lo
  // descarga por su cuenta, y un blob del navegador no le sirve.
  function esAndroid() { return /android/i.test(navigator.userAgent); }

  /**
   * Color final de cada MATERIAL del modelo según lo que el cliente eligió.
   *
   * Es lo que se le manda al backend para que parchee el .glb: por nombre de
   * material, no por pasos ni valores. La ficha ya resuelve la configuración
   * para pintar el 3D, así que traducirla aquí evita que el backend tenga que
   * conocer el modelo de datos de la app.
   */
  function coloresPorMaterial(entry, groups) {
    var m3 = entry.model3d || {};
    var st = build3dState(entry, groups);
    var acabados = {};
    (m3.finishes || []).forEach(function (f) { acabados[f.id] = f; });
    var out = [];
    (m3.parts || []).forEach(function (p) {
      var color = '';
      if (st.hidden[p.id]) color = 'hide';
      else if (st.colors[p.id]) color = st.colors[p.id];
      else {
        var fid = st.finishes[p.id] || p.defaultFinish;
        var f = acabados[fid];
        // Un acabado con textura suele ser blanco (el tono lo pone la imagen):
        // ahí manda el color propio de la parte, que es su tono real.
        var c = f && f.color ? f.color : '';
        if (!c || (f && f.texture && /^#?f{3,6}$/i.test(c))) c = p.defaultColor || c;
        color = c;
      }
      if (!color) return;
      var hex = color === 'hide' ? 'hide' : String(color).replace('#', '');
      (p.materials || []).forEach(function (nombre) { out.push(nombre + ':' + hex); });
    });
    return out.join(',');
  }

  /** URL del modelo para AR: el backend lo devuelve ya con los colores. */
  function urlModeloAR(entry, groups) {
    var ref = entry.productId != null ? entry.productId : (entry.sku || entry.name || '');
    var base = entry.__kcBase || String(CFG_URLS[0] || '').replace(/\/definition(\?.*)?$/, '');
    return base + '/ar/' + encodeURIComponent(String(ref)) + '.glb'
      + '?m=' + encodeURIComponent(coloresPorMaterial(entry, groups));
  }
  function urlSceneViewer(glb, titulo) {
    var abs = new URL(glb, location.href).href;
    var params = 'file=' + encodeURIComponent(abs)
      + '&mode=ar_preferred&resizable=false'
      + '&title=' + encodeURIComponent(titulo || '');
    return 'intent://arvr.google.com/scene-viewer/1.0?' + params
      + '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;'
      + 'S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end;';
  }

  // ¿Sabe este navegador abrir AR Quick Look? Es la vía de iPhone/iPad: el
  // sistema intercepta un <a rel="ar"> que apunte a un .usdz.
  function quickLookSoportado() {
    var a = document.createElement('a');
    return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
  }

  // Rama iPhone. Quick Look consume un ARCHIVO, no una sesión viva, así que:
  // se genera el .usdz de la configuración actual y se cambia el botón por el
  // enlace que lo abre. Si el cliente cambia una opción, ese archivo deja de
  // representar lo elegido, así que se vuelve al botón y se regenera.
  function montarQuickLook(host, viewer, entry, cm) {
    var btn = el('button', 'kc-btn kc-ar-btn', 'Ver en tu espacio');
    btn.type = 'button';
    host.appendChild(btn);

    var enlace = null, urlBlob = null;
    var limpiar = function () {
      if (urlBlob) { URL.revokeObjectURL(urlBlob); urlBlob = null; }
      if (enlace && enlace.parentNode) enlace.parentNode.removeChild(enlace);
      enlace = null;
      btn.style.display = '';
      btn.disabled = false;
      btn.textContent = 'Ver en tu espacio';
    };
    // La configuración cambió: el archivo generado ya no vale.
    document.addEventListener('change', function (ev) {
      if (enlace && ev.target && ev.target.closest && ev.target.closest('.prod-options')) limpiar();
    });

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Preparando…';
      viewer.exportUSDZ({ realSizeCm: cm }).then(function (blob) {
        urlBlob = URL.createObjectURL(blob);
        enlace = document.createElement('a');
        enlace.rel = 'ar';
        enlace.href = urlBlob;
        enlace.className = 'kc-btn kc-btn-primary kc-ar-btn';
        // Quick Look EXIGE que el enlace contenga una imagen; si no, lo trata
        // como una descarga normal y el usuario se queda con un archivo.
        var im = document.createElement('img');
        im.alt = '';
        im.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        im.style.cssText = 'width:1px;height:1px;position:absolute;opacity:0';
        enlace.appendChild(im);
        enlace.appendChild(document.createTextNode('Abrir en AR'));
        btn.style.display = 'none';
        host.appendChild(enlace);
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = 'Ver en tu espacio';
        console.warn(LOG, 'no se pudo generar el USDZ:', e);
      });
    });
  }

  // URL de ESTA ficha con la marca que la abre directamente en el
  // configurador, para que el que escanee no tenga que buscar nada.
  function urlAR() {
    var u = location.origin + location.pathname;
    var q = location.search.replace(/[?&]kimos_ar=1/g, '').replace(/^&/, '?');
    return u + (q && q !== '?' ? q + '&' : '?') + 'kimos_ar=1';
  }

  /** Pinta un QR (matriz del motor) en un canvas, con su zona de silencio. */
  function pintarQR(matriz, lado) {
    var QUIETO = 4;
    var n = matriz.length + QUIETO * 2;
    var escala = Math.max(2, Math.floor(lado / n));
    var cv = document.createElement('canvas');
    cv.width = cv.height = n * escala;
    cv.className = 'kc-qr';
    var g = cv.getContext('2d');
    // Fondo blanco SIEMPRE, aunque el theme sea oscuro: un QR sobre fondo
    // negro no lo lee ningún teléfono. El margen forma parte del código.
    g.fillStyle = '#fff';
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#000';
    for (var y = 0; y < matriz.length; y++) {
      for (var x = 0; x < matriz.length; x++) {
        if (matriz[y][x]) g.fillRect((x + QUIETO) * escala, (y + QUIETO) * escala, escala, escala);
      }
    }
    return cv;
  }

  // Puente al móvil: el botón existe igual, y al pulsarlo aparece el QR.
  function montarPuente(host, viewer, entry, cm) {
    var btn = el('button', 'kc-btn kc-ar-btn', 'Ver en tu espacio');
    btn.type = 'button';
    host.appendChild(btn);

    var panel = null;
    btn.addEventListener('click', function () {
      if (panel) { panel.remove(); panel = null; return; }
      panel = el('div', 'kc-ar-panel');
      var cerrar = el('button', 'kc-ar-cerrar', '✕');
      cerrar.type = 'button';
      cerrar.addEventListener('click', function () { panel.remove(); panel = null; });
      panel.appendChild(cerrar);

      // El QR se muestra SIEMPRE. Antes se decidía con una heurística de
      // "móvil o escritorio" (puntero grueso / puntos táctiles) y cualquier
      // portátil con pantalla táctil pasaba por móvil: al usuario le salía el
      // mensaje y nunca el código. Adivinar el dispositivo sobraba — el QR no
      // estorba a nadie y el motivo se explica igual, debajo.
      panel.appendChild(el('div', 'kc-ar-tit', 'Escanéalo con tu móvil'));
      var m = window.KimosEngine3D && window.KimosEngine3D.qrMatrix
        ? window.KimosEngine3D.qrMatrix(urlAR()) : null;
      if (m) panel.appendChild(pintarQR(m, 200));
      else panel.appendChild(el('div', 'kc-ar-txt', 'Abre esta misma dirección en tu móvil: ' + urlAR()));
      panel.appendChild(el('div', 'kc-ar-txt',
        'Se abrirá esta ficha en el configurador, lista para colocar el producto en tu espacio con la cámara.'));
      panel.appendChild(el('div', 'kc-ar-txt',
        'Este navegador no puede hacerlo: en Android hace falta Chrome, Edge o Samsung Internet '
        + 'con los Servicios de Google para RA instalados; en iPhone, Safari.'));
      host.appendChild(panel);
    });
  }

  // ── AR EN VIVO (8th Wall Engine) ─────────────────────────────────────────
  // La cámara en la propia página y encima el producto EXACTO del
  // configurador — mismo objeto, mismos materiales: cambiar un color cambia
  // el AR sin regenerar nada. Markerless (SLAM propio del binario) y sin
  // servidores: el motor se autoaloja. Si algo falla (permiso de cámara,
  // descarga, dispositivo), se cae a los visores del sistema.
  // Fila de chips por cada opción del producto con efecto 3D: cambiar el
  // acabado SIN salir de la cámara — ver el producto en TU pieza con cada
  // color es el momento de compra. Escriben en el control nativo
  // (applyNative), así el precio, la variante del carro y el 3D — que es el
  // mismo objeto del visor — se actualizan al instante, sin regenerar nada.
  function montarChipsAR(capa, entry, groups) {
    var m3 = entry.model3d || {};
    var acabados = {};
    (m3.finishes || []).forEach(function (f) { acabados[f.id] = f; });
    var partes = {};
    (m3.parts || []).forEach(function (p) { partes[p.id] = p; });
    // Color representativo de un valor, para el puntito del chip: el color
    // directo del efecto, el del acabado, o —si el acabado es blanco con
    // textura (el tono lo pone la imagen)— el tono real de la parte.
    var colorDe = function (v) {
      var efectos = v.model3d || [];
      for (var i = 0; i < efectos.length; i++) {
        var e = efectos[i];
        if (e.type === 'color' && e.color) return e.color;
        if (e.type === 'finish') {
          var f = acabados[e.finishId];
          if (f && f.color && !(f.texture && /^#?f{3,6}$/i.test(f.color))) return f.color;
          var p = partes[e.partId];
          if (p && p.defaultColor) return p.defaultColor;
          if (f && f.color) return f.color;
        }
      }
      return '';
    };

    // PLEGADO por defecto: la cámara es la protagonista y las filas abiertas
    // tapaban los textos de la pantalla. "Personalizar" lo abre y lo cierra.
    var cont = el('div', 'kc-arv-chips');
    var panel = el('div', 'kc-arv-chips-panel');
    var abrir = el('button', 'kc-arv-chips-btn', 'Personalizar');
    abrir.type = 'button';
    abrir.addEventListener('click', function () {
      cont.classList.toggle('kc-arv-chips-abierto');
    });
    cont.appendChild(panel);
    cont.appendChild(abrir);

    var todos = [];
    (entry.groups || []).forEach(function (kg) {
      var con3d = (kg.values || []).some(function (v) { return (v.model3d || []).length; });
      if (!con3d) return;
      var g = groups.filter(function (x) { return norm(x.name) === norm(kg.label); })[0];
      if (!g) return;
      var fila = el('div', 'kc-arv-chips-fila');
      (kg.values || []).forEach(function (v) {
        var nat = g.values.filter(function (x) { return norm(x.name) === norm(v.name); })[0];
        if (!nat) return;
        var chip = el('button', 'kc-arv-chip', '');
        chip.type = 'button';
        var c = colorDe(v);
        if (c) {
          var dot = el('span', 'kc-arv-chip-dot');
          dot.style.background = c;
          chip.appendChild(dot);
        }
        chip.appendChild(document.createTextNode(v.name));
        chip.addEventListener('click', function () { applyNative(g, nat.id); });
        todos.push({ el: chip, g: g, vid: nat.id });
        fila.appendChild(chip);
      });
      if (fila.children.length > 1) panel.appendChild(fila);
    });
    if (!panel.children.length) return null;
    var marcar = function () {
      var sel = readSelection(groups);
      todos.forEach(function (c) {
        c.el.classList.toggle('kc-arv-chip-on', String(sel[c.g.id]) === String(c.vid));
      });
    };
    marcar();
    document.addEventListener('change', marcar);
    capa.appendChild(cont);
    return { off: function () { document.removeEventListener('change', marcar); } };
  }

  function descargarBlob(blob, nombre) {
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  function montarARVivo(host, viewer, entry, groups, cm, alFallar) {
    var btn = el('button', 'kc-btn kc-ar-btn', 'Ver en tu espacio');
    btn.type = 'button';
    host.appendChild(btn);

    var capa = null, sesion = null, cv = null, chips = null;
    var cerrar = function () {
      if (sesion) { try { sesion.end(); } catch (e) {} sesion = null; }
      if (chips) { chips.off(); chips = null; }
      if (capa && capa.parentNode) capa.parentNode.removeChild(capa);
      // FullWindowCanvas muda el canvas del interior de la capa al <body>:
      // hay que retirarlo de donde esté o quedaría huérfano tapando la ficha.
      if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
      capa = null; cv = null;
      btn.disabled = false;
    };

    btn.addEventListener('click', function () {
      btn.disabled = true;
      capa = el('div', 'kc-arv');
      cv = document.createElement('canvas');
      cv.className = 'kc-arv-canvas';
      capa.appendChild(cv);
      var tip = el('div', 'kc-arv-tip', 'Cargando el motor de AR…');
      capa.appendChild(tip);
      var sal = el('button', 'kc-arv-salir', 'Salir');
      sal.type = 'button';
      sal.addEventListener('click', cerrar);
      capa.appendChild(sal);
      // Atribución que exige la licencia del binario.
      capa.appendChild(el('div', 'kc-arv-cred', 'AR: 8th Wall Engine © Niantic Spatial'));

      // Acabados a un toque, sin salir de la cámara.
      chips = montarChipsAR(capa, entry, groups);

      // Píldora que confirma la medida al pellizcar: "45 cm · 100%".
      var pill = el('div', 'kc-arv-escala', '');
      capa.appendChild(pill);
      var pillTimer = null;

      // Foto de la cámara con el producto: para mandarla y decidir en casa.
      var fotoBtn = el('button', 'kc-arv-foto', '');
      fotoBtn.type = 'button';
      fotoBtn.setAttribute('aria-label', 'Guardar foto');
      fotoBtn.addEventListener('click', function () {
        if (!sesion || !sesion.foto || fotoBtn.disabled) return;
        fotoBtn.disabled = true;
        sesion.foto().then(function (blob) {
          var file = null;
          try { file = new File([blob], 'mi-espacio.jpg', { type: 'image/jpeg' }); } catch (e) {}
          if (file && navigator.canShare && navigator.share
              && navigator.canShare({ files: [file] })) {
            return navigator.share({ files: [file] }).catch(function () { descargarBlob(blob, 'mi-espacio.jpg'); });
          }
          descargarBlob(blob, 'mi-espacio.jpg');
        }).catch(function () {}).then(function () { fotoBtn.disabled = false; });
      });
      capa.appendChild(fotoBtn);

      document.body.appendChild(capa);

      // El error se enseña EN PANTALLA antes de caer al respaldo: en un móvil
      // no hay consola, y "pantalla negra que falla" sin mensaje es
      // indepurable — pasó, y costó una ronda entera.
      var fallar = function (msg) {
        console.warn(LOG, 'AR en vivo:', msg);
        cerrar();
        var aviso = el('div', 'kc-ar-aviso',
          (msg || 'El AR en vivo no está disponible en este dispositivo.')
          + ' Se usará el visor de tu sistema.');
        host.appendChild(aviso);
        setTimeout(function () { if (aviso.parentNode) aviso.parentNode.removeChild(aviso); }, 9000);
        alFallar();
      };
      viewer.startLiveAR({
        xrUrl: CFG.xr8,
        xrExtrasUrl: CFG.xrextras,
        canvas: cv,
        realSizeCm: cm,
        // Estado visible mientras arranca: qué se está esperando, no un negro.
        onStatus: function (st) {
          if (st === 'camara:requesting') tip.textContent = 'Pidiendo permiso de cámara…';
          else if (st === 'camara:hasStream') tip.textContent = 'Abriendo la cámara…';
          else if (st === 'camara:hasVideo') {
            tip.textContent = 'Arrancando el AR…';
            // Con vídeo ya en marcha, fuera el velo negro: el canvas de la
            // cámara vive BAJO esta capa y el fondo lo taparía.
            if (capa) capa.classList.add('kc-arv-viva');
          }
        },
        onPlace: function () {
          if (capa) capa.classList.add('kc-arv-viva');
          tip.textContent = 'Muévete despacio · arrastra para moverlo · dos dedos: girar y tamaño';
        },
        onScale: function (f) {
          // Solo el PORCENTAJE. Antes mostraba los cm resultantes, pero la
          // escala del AR web es aproximada (SLAM 'responsive'): junto a una
          // huincha de medir el número mentía, y un dato falso confunde más
          // de lo que ayuda.
          pill.textContent = Math.round(f * 100) + '%';
          pill.classList.add('kc-arv-escala-on');
          clearTimeout(pillTimer);
          pillTimer = setTimeout(function () { pill.classList.remove('kc-arv-escala-on'); }, 1400);
        },
        onError: fallar,
        onEnd: function () { cerrar(); },
      }).then(function (s) { sesion = s; }).catch(function (e) {
        fallar((e && e.message) || String(e));
      });
    });
    return btn;
  }

  /**
   * "Ver en tu espacio". La vía preferente en el móvil es el AR EN VIVO
   * (personalizable al instante); si no está configurado o falla, los
   * visores del SISTEMA:
   *   · Android  → Google Scene Viewer (cualquier navegador)
   *   · iPhone   → AR Quick Look (cualquier navegador)
   *   · lo demás → QR para pasar al móvil
   * Todas sin marcador, sobre el suelo real y a tamaño real.
   */
  function montarAR(host, viewer, entry, groups) {
    var m3 = entry.model3d || {};
    var cm = Number(m3.realSizeCm) || 0;
    if (!cm) return;   // sin medida real no se puede colocar a escala

    // El AR en vivo necesita cámara trasera: solo se ofrece en dispositivos
    // de mano. En escritorio, directo al QR.
    var mano = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || (navigator.maxTouchPoints || 0) > 1;
    if (CFG.xr8 && mano && viewer.startLiveAR) {
      montarARVivo(host, viewer, entry, groups, cm, function () {
        // Respaldo: se retira el botón vivo y se montan los del sistema.
        var b = host.querySelector('.kc-ar-btn');
        if (b && b.parentNode) b.parentNode.removeChild(b);
        montarARSistema(host, viewer, entry, groups, cm);
      });
      return;
    }
    montarARSistema(host, viewer, entry, groups, cm);
  }

  function montarARSistema(host, viewer, entry, groups, cm) {
    var m3 = entry.model3d || {};

    if (esAndroid() && m3.arUrl) {
      var a = document.createElement('a');
      a.className = 'kc-btn kc-ar-btn';
      a.rel = 'ar';
      a.textContent = 'Ver en tu espacio';
      // El href se recalcula ANTES de que el clic navegue, para que lleve la
      // configuración puesta en ese momento y no la que hubiera al pintar el
      // botón. Se hace sobre el enlace de verdad —en vez de interceptar el
      // clic— para que el navegador lo trate como tal: pulsación larga,
      // "abrir en", y la vuelta atrás siguen funcionando.
      var refrescar = function () {
        a.href = urlSceneViewer(urlModeloAR(entry, groups), entry.name || '');
      };
      ['pointerdown', 'focus', 'mouseenter'].forEach(function (ev) {
        a.addEventListener(ev, refrescar);
      });
      refrescar();
      host.appendChild(a);
      return;
    }
    if (quickLookSoportado() && viewer.exportUSDZ) { montarQuickLook(host, viewer, entry, cm); return; }
    montarPuente(host, viewer, entry, cm);
  }

  // ── Montaje de la ficha ──────────────────────────────────────────────────
  // ── Encaje con el theme: tope de la barra y ancho del contenido ──────────
  // Dos cosas que ningún theme expone y hay que MEDIR del DOM real:
  //
  //  1) TOPE. Nuestra barra es `sticky; top: var(--kc-top)`. Si el theme tiene
  //     su propio header fijo o pegajoso, con top:0 la barra queda DEBAJO y no
  //     se ve al bajar. Se mide el alto real del header y se descuenta. Se
  //     recalcula en scroll/resize porque muchos headers encogen al bajar.
  //
  //  2) ANCHO. Casi todos los themes centran su contenido en un contenedor
  //     (~1200px). Ocupar el 100% se ve enorme y desalineado respecto al resto
  //     del sitio. Se mide el contenedor del theme y el configurador se alinea
  //     a él. Todo es configurable: `storefront.style.width` del producto manda
  //     sobre `window.KIMOS_WIDTH`, y 'full' vuelve al borde a borde.
  var LAYOUT = {
    // Selector propio del header, si la detección automática no acierta.
    headerSel: window.KIMOS_HEADER_SELECTOR || '',
    // Número de px fijo para el tope (salta la medición del header).
    topFijo: (typeof window.KIMOS_TOP_OFFSET === 'number') ? window.KIMOS_TOP_OFFSET : null,
    // Selector propio del contenedor del theme.
    contSel: window.KIMOS_CONTAINER_SELECTOR || '',
    // 'auto' | 'container' | 'full' (lo global del theme; el producto puede pisarlo).
    width: String(window.KIMOS_WIDTH || 'auto').toLowerCase(),
  };
  var SEL_HEADER = 'header, .theme-header, #header, .site-header, .main-header';
  // z-index declarado por el menú del sitio (null = no declara ninguno).
  function zHeader() {
    var h = null;
    try { h = document.querySelector(LAYOUT.headerSel || SEL_HEADER); } catch (e) { h = null; }
    if (!h) return null;
    var z = parseInt(getComputedStyle(h).zIndex, 10);
    return isFinite(z) ? z : null;
  }
  var HEADER_CANDIDATOS = 'header, .header, #header, .theme-header, .site-header, .main-header, .navbar, .nav-bar, .topbar, .top-bar, [class*="header"][class*="fixed"], [class*="header"][class*="sticky"]';
  var CONT_CANDIDATOS = '.container, .page-width, .site-width, .wrapper, .site-container, .page-container, .content-wrapper, main > .container, .shopify-section > .container';

  // Alto ocupado por lo que está FIJO en la parte superior de la ventana.
  function medirTop() {
    if (LAYOUT.topFijo != null) return Math.max(0, LAYOUT.topFijo);
    // Se mide EL header del sitio, no "todo lo que esté fijo arriba". Mirar
    // muchos candidatos y quedarse con el más bajo sonaba más seguro y era lo
    // contrario: cualquier envoltorio pegajoso (una barra de anuncios, un
    // contenedor con position:sticky) empujaba la barra centímetros hacia
    // abajo. Este es el criterio de la ficha de computadores, que llevaba
    // meses funcionando en tienda.
    var n = null;
    try { n = document.querySelector(LAYOUT.headerSel || 'header, .theme-header, #header, .site-header, .main-header'); }
    catch (e) { n = document.querySelector('header, .theme-header, #header'); }
    if (!n || (n.closest && n.closest('.kimos-cfg'))) return 0;
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    // Solo descuenta lo que TAPA: si el header se va con el scroll, no estorba.
    if (cs.position !== 'fixed' && cs.position !== 'sticky') return 0;
    var r = n.getBoundingClientRect();
    // Lo que cuenta es DÓNDE TERMINA, no dónde empieza. Exigir que empezara
    // pegado al borde (top <= 4) dejaba el tope en 0 en cuanto el theme tenía
    // una franja de avisos fija encima del menú: la barra se iba a y=0, justo
    // detrás del menú, y no se veía. `bottom` ya incluye esa franja.
    if (r.height <= 0 || r.bottom <= 0) return 0;
    // Un header desmedido casi siempre es una medición equivocada (un
    // contenedor entero marcado como sticky): mejor 0 que romper la página.
    return r.bottom > window.innerHeight * 0.4 ? 0 : Math.round(r.bottom);
  }

  // Ancho útil del contenedor del theme (sin sus paddings) y su posición.
  function medirContenedor(cerca) {
    var sels = LAYOUT.contSel || CONT_CANDIDATOS;
    var nodos = [];
    // Primero se buscan contenedores que envuelvan a la ficha: son los que
    // marcan el ancho de ESTA página, no el de un bloque cualquiera.
    for (var p = cerca && cerca.parentElement; p && p !== document.body; p = p.parentElement) {
      try { if (p.matches && p.matches(sels)) nodos.push(p); } catch (e) { /* selector raro */ }
    }
    if (!nodos.length) {
      try { nodos = Array.prototype.slice.call(document.querySelectorAll(sels)); } catch (e) { nodos = []; }
    }
    var mejor = 0;
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i];
      if (n.closest && n.closest('.kimos-cfg')) continue;
      var cs = getComputedStyle(n);
      if (cs.display === 'none') continue;
      var ancho = n.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      // Un contenedor de verdad es más angosto que la ventana, pero no una
      // columna suelta: se descartan los extremos.
      if (ancho <= 0 || ancho >= window.innerWidth - 8 || ancho < 480) continue;
      if (ancho > mejor) mejor = ancho;
    }
    return Math.round(mejor);
  }

  // Ancho propio de UNA sección, independiente del de la ficha:
  //   'full'      → sangra hasta los bordes de la ventana
  //   'container' → se centra al ancho del contenedor del theme
  //   ausente/'auto' → hereda lo que tenga el configurador
  function anchoSeccion(nodo, ancho) {
    if (!nodo) return nodo;
    if (ancho === 'full') nodo.classList.add('kc-sec-full');
    else if (ancho === 'container') nodo.classList.add('kc-sec-container');
    return nodo;
  }

  // Aplica ambas medidas a la raíz del configurador y las mantiene al día.
  function encajarConTheme(root, page, modo) {
    var quiere = String(modo || LAYOUT.width || 'auto').toLowerCase();
    var aplicar = function () {
      root.style.setProperty('--kc-top', medirTop() + 'px');
      if (quiere === 'full') { root.classList.remove('kc-w-container'); return; }
      var ancho = medirContenedor(page);
      if (!ancho && quiere === 'container') ancho = Math.min(1200, window.innerWidth - 32);
      if (ancho) {
        root.style.setProperty('--kc-maxw', ancho + 'px');
        // También en <html>: la BARRA vive en su propio host fuera de esta
        // raíz y su contenido se centra al mismo ancho (kc-bar-in).
        document.documentElement.style.setProperty('--kc-maxw', ancho + 'px');
        root.classList.add('kc-w-container');
      } else {
        root.classList.remove('kc-w-container');   // 'auto' sin contenedor = full
        document.documentElement.style.removeProperty('--kc-maxw');
      }
    };
    aplicar();
    var pedido = 0;
    var alVuelo = function () {
      if (pedido) return;
      pedido = requestAnimationFrame(function () { pedido = 0; aplicar(); });
    };
    window.addEventListener('scroll', alVuelo, { passive: true });
    window.addEventListener('resize', alVuelo);
    // Los headers de muchos themes cambian de alto después de cargar (fuentes,
    // banners, JS propio): unas pocas pasadas tempranas evitan el desfase.
    [120, 400, 1200].forEach(function (ms) { setTimeout(aplicar, ms); });
    return aplicar;
  }

  function mount(entry, prod, contractVer) {
    var page = document.querySelector('[id^="product-template-"]') || document.querySelector('.product-page');
    if (!page) { console.warn(LOG, 'no encontré la sección del producto'); return; }

    var sf = entry.storefront || {};
    var tabsCfg = sf.tabs || {};
    // storefront.style (contrato v2): estilo del configurador por producto.
    // Con JSON v1 no existe y todo queda con el aspecto del theme (default).
    var style = (sf.style && typeof sf.style === 'object') ? sf.style : {};
    var groups = nativeGroups(prod);
    VARIANT_GROUPS = groups;   // el precio de la variante se calcula con ellos
    // Galería: manda la que publica KIMOS (`entry.images`), que trae la galería
    // COMPLETA leída de la tienda por el backend. Lo que se raspa del DOM se
    // añade detrás, por si el theme muestra alguna foto que el sync no tenga.
    // Galería del producto: la que publica KIMOS (`entry.images`), que el
    // backend lee de la ficha real de la tienda. NO se mezcla con lo que haya
    // en el DOM: ahí el theme imprime también las fotos de las variantes (los
    // colores del gabinete, por ejemplo) y acababan colándose en la sección
    // Fotos como si fueran del producto. El raspado del DOM queda solo como
    // respaldo para cuando no hay galería publicada.
    var images = addImages([], entry.images);
    if (!images.length) images = addImages([], prod.images);
    if (!images.length && entry.imageUrl) images.push(entry.imageUrl);
    // La SECCIÓN Fotos muestra solo la galería de la TIENDA (entry.imagesStore:
    // ★ + fotos del producto en Jumpseller). Las demás de entry.images son
    // material interno de la app (fondos, fotos de valores) — siguen
    // disponibles para los bloques del hero, pero no son "las fotos del
    // producto". Catálogos viejos sin imagesStore: se muestra todo, como antes.
    var imagesTienda = addImages([], entry.imagesStore);
    if (!imagesTienda.length) imagesTienda = images;
    // Etiquetas (alt) publicadas por ProductLab en paralelo a entry.images.
    // Se indexan por URL (la lista final puede venir del raspado o reordenar)
    // y sin etiqueta se cae al nombre del producto: ningún <img> queda mudo
    // para buscadores ni lectores de pantalla.
    var altPorUrl = {};
    (entry.images || []).forEach(function (u, i) {
      var a = (entry.imagesAlt || [])[i];
      if (u && a) altPorUrl[u] = String(a);
    });
    function altDe(u, i) {
      return altPorUrl[u] || ((prod.name || entry.name || '') + (i != null && i >= 0 ? ' — foto ' + (i + 1) : ''));
    }
    // Descripción del producto en la tienda, para el bloque `description`.
    var desc = String(entry.description || '');
    var viewer = null;
    var confPanel = null, confView = null, confSteps = null;
    // Panel derecho del configurador (foto + precio + entrega + resumen + carro)
    var panelBox = null, panelImg = null, panelPrecio = null, panelEntrega = null;
    var panelResumen = null, panelStock = null, panelCta = null;

    // El bloque original del theme queda oculto pero VIVO en el DOM: sus
    // controles nativos y su botón de carro siguen siendo los que operan.
    var original = page.querySelector('.product-page__wrapper') || page.firstElementChild;
    if (original) original.classList.add('kc-hidden-native');

    // El theme puede ser claro u oscuro: en vez de asumir, se leen el fondo y
    // el color de texto efectivos y se exponen como variables CSS. Así las
    // tarjetas y la barra contrastan igual en cualquier tienda.
    function fondoEfectivo(node) {
      for (var n = node; n && n !== document.documentElement; n = n.parentElement) {
        var c = getComputedStyle(n).backgroundColor;
        if (c && c !== 'transparent' && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(c)) return c;
      }
      return getComputedStyle(document.body).backgroundColor || '#fff';
    }
    function esOscuro(c) {
      c = String(c).trim();
      var m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      var r, g, b;
      if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
      else {
        // style.bgColor/accentColor llegan en hex, no en rgb() como el DOM.
        var h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (!h) return false;
        var x = h[1].length === 3 ? h[1].replace(/(.)/g, '$1$1') : h[1];
        r = parseInt(x.slice(0, 2), 16); g = parseInt(x.slice(2, 4), 16); b = parseInt(x.slice(4, 6), 16);
      }
      return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }

    var root = el('div', 'kimos-cfg');
    // style.bgColor manda sobre el fondo detectado del theme (y el modo
    // claro/oscuro se recalcula sobre él, para que el contraste acompañe).
    var bg = String(style.bgColor || '').trim() || fondoEfectivo(page);
    var oscuro = esOscuro(bg);
    root.style.setProperty('--kc-bg', bg);
    root.style.setProperty('--kc-fg', getComputedStyle(page).color || 'inherit');
    // Paleta derivada del fondo real: las cards, los filetes y las cajas de
    // imagen tienen que contrastar igual en una tienda clara y en una oscura.
    root.style.setProperty('--kc-card', oscuro ? 'rgba(255,255,255,.07)' : bg);
    root.style.setProperty('--kc-line', oscuro ? 'rgba(255,255,255,.18)' : '#EAEAEA');
    root.style.setProperty('--kc-borde', oscuro ? 'rgba(255,255,255,.30)' : '#DDDDDD');
    root.style.setProperty('--kc-plata', oscuro ? 'rgba(255,255,255,.06)' : '#F5F5F5');
    root.style.setProperty('--kc-gris', oscuro ? 'rgba(255,255,255,.62)' : '#7C7C7B');
    root.style.setProperty('--kc-stage', oscuro ? 'rgba(255,255,255,.05)' : '#f5f5f5');
    if (oscuro) root.classList.add('kc-dark');
    // Resto de storefront.style: acento, radio y forma de las cards. Todo va
    // por variables/clases CSS con fallback al aspecto actual (JSON v1).
    var accent = String(style.accentColor || '').trim();
    if (accent) {
      root.style.setProperty('--kc-accent', accent);
      root.style.setProperty('--kc-accent-fg', esOscuro(accent) ? '#fff' : '#111');
    }
    if (String(style.bgColor || '').trim()) root.style.background = bg;
    if (style.radius != null && isFinite(Number(style.radius))) {
      root.style.setProperty('--kc-radius', Math.max(0, Number(style.radius)) + 'px');
    }
    if (style.cardStyle === 'list' || style.cardStyle === 'compact') {
      root.classList.add('kc-style-' + style.cardStyle);
    }
    // ── Barra: todo lo que el producto haya configurado (style.bar) ──
    var barCfg = (style.bar && typeof style.bar === 'object') ? style.bar : {};
    var bar = el('div', 'kc-bar');
    if (barCfg.sticky === false) bar.classList.add('kc-bar-static');
    if (barCfg.width === 'full') bar.classList.add('kc-bar-full');
    else if (barCfg.width === 'container') bar.classList.add('kc-bar-container');
    if (String(barCfg.bgColor || '').trim()) {
      bar.style.background = String(barCfg.bgColor).trim();
      // El texto acompaña al fondo elegido salvo que se pida uno explícito.
      bar.style.color = String(barCfg.textColor || '').trim()
        || (esOscuro(barCfg.bgColor) ? '#fff' : '#111');
    } else if (String(barCfg.textColor || '').trim()) {
      bar.style.color = String(barCfg.textColor).trim();
    }
    if (barCfg.offset != null && isFinite(Number(barCfg.offset))) {
      root.style.setProperty('--kc-bar-offset', Number(barCfg.offset) + 'px');
    }
    if (barCfg.mobileTabs === true) root.classList.add('kc-bar-mtabs');
    var body = el('div', 'kc-body');
    // La barra va fija (ver el CSS): este envoltorio le guarda el hueco en el
    // flujo para que el contenido no se meta debajo.
    var barWrap = el('div', 'kc-bar-wrap');
    if (barCfg.sticky === false) barWrap.classList.add('kc-bar-wrap-static');
    barWrap.appendChild(bar);
    root.appendChild(barWrap);
    root.appendChild(body);
    page.insertBefore(root, page.firstChild);
    // Encaje con el theme: tope de la barra (header fijo del sitio) y ancho
    // del contenido. El producto manda (storefront.style.width) sobre el
    // ajuste global de custom.js (window.KIMOS_WIDTH).
    // `position: fixed` se mide contra el VIEWPORT… salvo que algún ancestro
    // cree un bloque contenedor (transform, filter, perspective, will-change o
    // contain). Ahí la barra se queda pegada a esa caja y vuelve a irse con el
    // scroll. Cuando pasa, la barra se muda a <body> dentro de un anfitrión que
    // copia el estilo de la ficha: fija de verdad, pase lo que pase.
    function rompeFixed(n) {
      for (var p = n.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        var cs = getComputedStyle(p);
        if ((cs.transform && cs.transform !== 'none')
          || (cs.filter && cs.filter !== 'none')
          || (cs.perspective && cs.perspective !== 'none')
          || /transform|filter|perspective/.test(cs.willChange || '')
          || /paint|layout/.test(cs.contain || '')) return p;
      }
      return null;
    }
    var barHost = null;
    function sincronizarHost() {
      if (!barHost) return;
      barHost.setAttribute('style', root.getAttribute('style') || '');
      barHost.className = 'kimos-cfg kc-bar-host'
        + (root.classList.contains('kc-w-container') ? ' kc-w-container' : '')
        + (root.classList.contains('kc-dark') ? ' kc-dark' : '')
        + (root.classList.contains('kc-bar-mtabs') ? ' kc-bar-mtabs' : '');
    }
    var fixedRoto = !!rompeFixed(root);
    if (barCfg.sticky !== false && fixedRoto) {
      barHost = el('div', 'kimos-cfg kc-bar-host');
      barHost.appendChild(bar);
      document.body.appendChild(barHost);
      console.info(LOG, 'la barra se montó en <body>: un ancestro del theme rompía position:fixed.');
    }
    /**
     * El panel de compra necesita lo mismo: con un ancestro que rompe `fixed`,
     * se quedaba pegado al borde inferior de la SECCIÓN del configurador (y en
     * móvil, tapando los últimos pasos) en vez de al borde de la pantalla.
     * Se muda al mismo anfitrión de <body>, donde `fixed` sí es el viewport.
     */
    function hostearPanel() {
      if (!panelBox || !fixedRoto) return;
      if (!barHost) {
        barHost = el('div', 'kimos-cfg kc-bar-host');
        document.body.appendChild(barHost);
      }
      if (panelBox.parentNode !== barHost) barHost.appendChild(panelBox);
    }

    // La ficha arranca PEGADA a la barra. El theme suele dejar aire encima de
    // la sección de producto (padding/margen para separarla del menú), y como
    // nuestra barra va fija ese aire se veía como un hueco entre la barra y el
    // hero. Se quita SOLO donde la ficha es lo primero que hay: si encima
    // queda algo del theme (migas, avisos), su espacio no se toca.
    (function pegarArriba() {
      if (parseFloat(getComputedStyle(root).marginTop) > 0) root.style.marginTop = '0px';
      var n = root;
      for (var p2 = n.parentElement; p2 && p2 !== document.body; n = p2, p2 = p2.parentElement) {
        if (p2.firstElementChild !== n) break;
        var cs2 = getComputedStyle(p2);
        if (parseFloat(cs2.paddingTop) > 0) p2.style.paddingTop = '0px';
        if (parseFloat(cs2.marginTop) > 0) p2.style.marginTop = '0px';
      }
    })();

    // El velo de arranque adopta el estilo del producto y deja ver el menú del
    // sitio: se espera con la marca de la tienda, no con una pantalla en blanco.
    var boot = document.getElementById('kc-boot');
    var giroEstilo = String(style.spinnerColor || '').trim() || String(style.accentColor || '').trim();
    if (boot) {
      boot.style.setProperty('--kc-boot-top', medirTop() + 'px');
      if (giroEstilo) boot.style.setProperty('--kc-boot-accent', giroEstilo);
      if (String(style.bgColor || '').trim()) boot.style.setProperty('--kc-boot-bg', String(style.bgColor).trim());
    }
    // El spinner se ve sobre todo ANTES de que llegue el estilo (custom.js lo
    // pinta mientras se pide el JSON): para ese momento el color de esta
    // visita se deja RECORDADO y custom.js lo lee en la siguiente. La primera
    // visita de la vida usa el acento del theme; de ahí en adelante, el del
    // producto.
    try {
      localStorage.setItem('kc-boot-style', JSON.stringify({
        a: giroEstilo, b: String(style.bgColor || '').trim(),
      }));
    } catch (e) { /* sin localStorage el spinner se queda con el del theme */ }

    var reencajar = encajarConTheme(root, page, style.width);
    // ── Botón "subir": aparece al scrollear la experiencia hacia abajo y
    // vuelve al inicio con scroll suave. Vive en <body> (fixed, junto al
    // borde) y usa el acento del estilo.
    (function () {
      if (document.querySelector('.kimos-cfg-top')) return;
      var subir = el('button', 'kimos-cfg-top', '↑');
      subir.type = 'button';
      subir.setAttribute('aria-label', 'Volver arriba');
      subir.title = 'Volver arriba';
      subir.addEventListener('click', function () {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      });
      document.body.appendChild(subir);
      var visible = false;
      var alScroll = function () {
        var quiere = (window.scrollY || document.documentElement.scrollTop || 0) > 480;
        if (quiere !== visible) { visible = quiere; subir.classList.toggle('kc-top-on', quiere); }
      };
      window.addEventListener('scroll', alScroll, { passive: true });
      alScroll();
      // La esquina inferior derecha es territorio de los widgets de chat
      // (WhatsApp, Tidio, Crisp…): si algo fijo ya vive ahí, el botón se
      // COLOCA ENCIMA de ese widget en vez de quedar tapado por él. Se
      // revisa tarde y de nuevo aún más tarde: los chats cargan a su ritmo.
      function esquivarWidgets() {
        var vh = window.innerHeight, vw = window.innerWidth, sube = 0;
        var nodos = document.querySelectorAll('body > *, iframe');
        for (var i = 0; i < nodos.length; i++) {
          var n = nodos[i];
          if (!n || n === subir || n.id === 'kc-boot') continue;
          if (n.classList && (n.classList.contains('kimos-cfg') || n.classList.contains('kimos-cfg-top') || n.classList.contains('kc-bar-host'))) continue;
          var cs; try { cs = getComputedStyle(n); } catch (e) { continue; }
          if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
          var rw = n.getBoundingClientRect();
          if (!rw.width || !rw.height) continue;
          // Una capa a pantalla (casi) completa es un overlay, no un widget.
          if (rw.width > vw * 0.85 && rw.height > vh * 0.6) continue;
          // ¿Pisa la zona del botón (esquina inferior derecha)?
          if (rw.right > vw - 90 && rw.bottom > vh - 90 && rw.top < vh - 6) {
            sube = Math.max(sube, Math.min(vh - rw.top + 10, vh * 0.5));
          }
        }
        subir.style.bottom = sube ? 'calc(' + Math.round(sube) + 'px + var(--kc-mbar-h, 0px))' : '';
      }
      [800, 3000, 7000].forEach(function (ms) { setTimeout(esquivarWidgets, ms); });
      window.addEventListener('resize', esquivarWidgets);
    })();
    // Alto REAL de la barra fija → hueco que le guarda su envoltorio. Se
    // recalcula porque cambia con el contenido (precio largo, dos líneas en
    // móvil) y con el ancho de la ventana.
    // La barra se alinea con LO QUE SE VE: mide el CONTENIDO de la primera
    // sección real — la fila interior del hero (.kc-row), no la caja de la
    // sección. La sección puede ir a sangre completa o al contenedor del
    // theme, pero el contenido que el ojo alinea se centra a su propio ancho
    // (--kc-hero-maxw): medir la caja dejaba la barra 30–60 px más ancha que
    // el hero y que el configurador. Además de casar el ancho se casa el
    // CENTRO (por si el contenido no queda centrado en el viewport).
    function alinearBarra() {
      var inw = bar.querySelector('.kc-bar-in');
      if (!inw) return;
      if (bar.classList.contains('kc-bar-full')) {
        inw.style.maxWidth = 'none'; inw.style.transform = '';
        return;
      }
      // Primer candidato VISIBLE (una pestaña oculta mide 0 y no sirve).
      var cands = root.querySelectorAll('.kc-hero .kc-row, .kc-conf, .kc-imagen, .kc-fotos, .kc-specs');
      var r = null;
      for (var ci = 0; ci < cands.length && !r; ci++) {
        var rc = cands[ci].getBoundingClientRect();
        if (rc.width > 40) r = rc;
      }
      if (r && r.width > 40) {
        inw.style.maxWidth = Math.round(r.width) + 'px';
        var br = bar.getBoundingClientRect();
        var delta = Math.round((r.left + r.width / 2) - (br.left + br.width / 2));
        inw.style.transform = Math.abs(delta) > 1 ? 'translateX(' + delta + 'px)' : '';
      } else {
        inw.style.maxWidth = '';
        inw.style.transform = '';
      }
    }
    function medirBarra() {
      sincronizarHost();
      colocarBarra();
      alinearBarra();
      var alto = bar.getBoundingClientRect().height || bar.offsetHeight;
      if (alto) root.style.setProperty('--kc-bar-h', Math.round(alto) + 'px');
      // En móvil el panel flota abajo: los pasos necesitan ESE hueco al pie o
      // el último valor queda debajo del panel y no se puede ni ver ni elegir.
      if (panelBox) {
        var ap = panelBox.getBoundingClientRect().height || panelBox.offsetHeight;
        if (ap) root.style.setProperty('--kc-panel-h', Math.round(ap) + 'px');
      }
      ajustarPanel();
    }
    /**
     * Colocación de la barra ESCRITA EN NÚMEROS, no en variables CSS.
     * Cuando la barra se muda a <body> deja de heredar el ámbito de la ficha y
     * cualquier variable que no llegue la deja sin sitio (o fuera de pantalla).
     * Calcularlo aquí quita del medio toda esa cadena: top, izquierda y ancho
     * salen de medidas reales del DOM.
     */
    function colocarBarra() {
      if (barCfg.sticky === false) return;      // barra en el flujo: no se toca
      var top = medirTop() + (isFinite(Number(barCfg.offset)) ? Number(barCfg.offset) : 0);
      bar.style.position = 'fixed';
      bar.style.top = Math.max(0, Math.round(top)) + 'px';
      var ancho = 0;
      if (barCfg.width === 'container' || (barCfg.width !== 'full' && root.classList.contains('kc-w-container'))) {
        ancho = parseFloat(root.style.getPropertyValue('--kc-maxw')) || 0;
      }
      if (ancho > 0 && ancho < window.innerWidth) {
        bar.style.left = Math.round((window.innerWidth - ancho) / 2) + 'px';
        bar.style.right = 'auto';
        bar.style.width = Math.round(ancho) + 'px';
        bar.style.transform = 'none';
      } else {
        bar.style.left = '0px'; bar.style.right = '0px';
        bar.style.width = 'auto'; bar.style.transform = 'none';
      }
      // La barra va SOBRE el contenido pero SIEMPRE BAJO el menú del sitio: sus
      // desplegables caen justo encima de ella y no pueden quedar tapados.
      var zh = zHeader();
      var z = 11;
      if (zh != null && zh <= z) z = Math.max(1, zh - 1);
      bar.style.zIndex = String(z);
    }
    /**
     * Comprobación en voz alta: si la barra no se ve, decir POR QUÉ.
     * Se mira lo que hay en su sitio con elementFromPoint; si algo la tapa y
     * ese algo declara un z-index, la barra se pone justo por encima (una vez).
     * Sin esto el síntoma era mudo: "no aparece" y a adivinar.
     */
    function revisarBarra() {
      var r = bar.getBoundingClientRect();
      var cs = getComputedStyle(bar);
      var estado = 'pos=' + cs.position + ' top=' + cs.top + ' z=' + cs.zIndex
        + ' rect=' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + '×' + Math.round(r.height)
        + ' display=' + cs.display + ' vis=' + cs.visibility + ' opacidad=' + cs.opacity
        + (barHost ? ' (en <body>)' : '');
      if (r.width < 2 || r.height < 2) {
        console.warn(LOG, 'la barra no ocupa sitio — ' + estado);
        return;
      }
      var x = Math.round(r.left + r.width / 2);
      var y = Math.round(r.top + r.height / 2);
      var enPunto = document.elementFromPoint(x, y);
      if (!enPunto || bar === enPunto || bar.contains(enPunto)) return;   // se ve
      var z = parseInt(getComputedStyle(enPunto).zIndex, 10);
      var quien = (enPunto.tagName || '?').toLowerCase() + '.' + (enPunto.className || '').toString().slice(0, 60);
      var zh2 = zHeader();
      var esMenu = !!(enPunto.closest && enPunto.closest(SEL_HEADER));
      // Subir por encima del menú del sitio NO es arreglarlo: sus desplegables
      // quedarían debajo de nuestra barra. Ahí solo se avisa.
      var techo = zh2 == null ? Infinity : zh2 - 1;
      if (!esMenu && isFinite(z) && z >= Number(bar.style.zIndex || 11) && z + 1 <= techo) {
        bar.style.zIndex = String(z + 1);
        console.warn(LOG, 'algo tapaba la barra (' + quien + ', z=' + z + '): se sube por encima. ' + estado);
      } else {
        console.warn(LOG, 'algo tapaba la barra: ' + quien + (esMenu ? ' (el menú del sitio: la barra se queda debajo a propósito)' : '') + ' — ' + estado);
      }
    }
    // Al hacer scroll cambian el tope de la barra (headers que encogen) y el
    // sitio del panel; se recalculan en el mismo fotograma que pinta el navegador.
    var pedidoBarra = 0;
    function alVueloBarra() {
      if (pedidoBarra) return;
      pedidoBarra = requestAnimationFrame(function () { pedidoBarra = 0; medirBarra(); });
    }
    window.addEventListener('scroll', alVueloBarra, { passive: true });
    window.addEventListener('resize', alVueloBarra);
    [0, 120, 400, 1200].forEach(function (ms) { setTimeout(medirBarra, ms); });
    // Una sola revisión, con la página ya asentada.
    setTimeout(revisarBarra, 1500);

    var has3d = !!(entry.model3d && entry.model3d.url);
    var secs = (sf.pageSections || []).filter(function (s) { return s.kind !== 'hero' ? s.show !== false : true; });
    var hasHero = secs.some(function (s) { return s.kind === 'hero'; });
    var hasSpecs = (sf.specs || []).length > 0 && tabsCfg.showSpecs !== false;
    var hasFotos = imagesTienda.length > 0 && tabsCfg.showFotos !== false;

    // ── Pestañas, con la misma estructura que la app de computadores ──────
    // A la IZQUIERDA solo navegación por el contenido: "Explorar" es fija y
    // las demás son ANCLAS que bajan a su sección dentro de Explorar — no
    // pestañas con panel propio, que partían la ficha en trozos inconexos.
    // Configurar NO va aquí: vive en el botón de la derecha.
    var conPasos = groups.length > 0;
    var ORDEN = (function () {
      var o = (Array.isArray(tabsCfg.order) ? tabsCfg.order : []).filter(function (k) {
        return k === 'specs' || k === 'fotos';
      });
      ['specs', 'fotos'].forEach(function (k) { if (o.indexOf(k) === -1) o.push(k); });
      return o;
    })();
    // La primera pestaña es el PRODUCTO (como en computadores): si no le pones
    // título propio, lleva su nombre — no un genérico "Explorar".
    var TABS = [['explorar', tabsCfg.explorar || entry.name || prod.name || 'Explorar', null]];
    ORDEN.forEach(function (k) {
      if (k === 'specs' && hasSpecs) TABS.push(['explorar', tabsCfg.specs || 'Especificaciones', 'specs']);
      if (k === 'fotos' && hasFotos) TABS.push(['explorar', tabsCfg.fotos || 'Fotos', 'fotos']);
    });

    // ?kimos_ar=1 — es lo que codifica el QR del escritorio: quien lo escanea
    // aterriza directamente en el configurador, sin buscar la pestaña.
    // ?kimos_conf=1 — el enlace del botón Compartir: aterriza con el
    // personalizador ya bloqueado en pantalla.
    var pedidoAR = /[?&]kimos_ar=1/.test(location.search);
    var pedidoConf = /[?&]kimos_conf=1/.test(location.search);
    var current = pedidoAR || pedidoConf || !(hasHero || hasSpecs || hasFotos) ? 'configurar' : 'explorar';
    // Texto del botón que lleva al personalizador (barra superior).
    var etiquetaConfigurar = function () {
      return tabsCfg.comprar || String(style.buyLabel || '').trim() || 'Configurar';
    };
    var anclas = {};   // sección → nodo, para bajar hasta ella
    var ctx = {
      name: prod.name, sku: entry.sku || prod.sku || '',
      // La foto del hero es la PRINCIPAL publicada (entry.imageUrl — la ★ de
      // ProductLab); la galería queda para las demás vistas.
      image: entry.imageUrl || images[0] || '', images: images, altDe: altDe, specs: sf.specs || [],
      desc: desc,
      style: style,
      stepsOpen: null,   // colapso por paso: lo siembra renderSteps
      goTab: function (t) { setTab(t); },
      refresh: function () { paint(); },
      // Producto SIN pasos: los CTA "configurar" del hero van directo al
      // carro (no hay nada que configurar) — mismo criterio que la barra.
      conPasos: conPasos,
      alCarro: function () { alCarro(); },
      etiquetaCarro: function () {
        return (botonCarro() && (botonCarro().textContent || '').trim()) || 'Añadir al carro';
      },
    };

    // El footer del theme: visible en la ficha principal, oculto SOLO en el
    // personalizador. Se localiza una vez y se conmuta al cambiar de vista.
    var footerNodo = (function () {
      var sels = ['footer.footer', '#footer', '.site-footer', 'footer[role="contentinfo"]', 'footer'];
      for (var i = 0; i < sels.length; i++) {
        var f = document.querySelector(sels[i]);
        if (f && !f.contains(root) && !root.contains(f)) return f;
      }
      return null;
    })();
    function mostrarFooter(si) {
      if (footerNodo) footerNodo.style.display = si ? '' : 'none';
    }

    // Aviso no bloqueante (mismo patrón que el aviso de AR): se pinta unos
    // segundos y se retira solo. Lo usa el ajuste automático de dependencias.
    function showNotice(txt) {
      var prev = root.querySelector('.kc-notice');
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
      var n = el('div', 'kc-notice', txt);
      root.appendChild(n);
      setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 7000);
    }

    // Re-evalúa las dependencias y fuerza los pasos ocultos a su default en
    // los controles nativos. `enforcing` corta la recursión: applyNative
    // dispara `change`, y ese `change` volvería a entrar aquí.
    var enforcing = false;
    function ajustar(avisa) {
      if (enforcing) return;
      enforcing = true;
      try {
        enforceDependencies(entry, groups, avisa ? function (cambios) {
          showNotice('Ajustado automáticamente: ' + cambios.join(' · '));
        } : null);
      } finally { enforcing = false; }
    }

    /**
     * El botón de carro REAL del theme.
     *
     * Antes se cogía «el primer <button> del formulario», y en los themes de
     * Jumpseller ese primer botón es el «−» del selector de cantidad: aparece
     * deshabilitado con cantidad 1, así que el panel enseñaba "esta
     * combinación no está disponible" siempre, y pulsar "Añadir al carro"
     * pulsaba el menos. De ahí que no llegara nada al carro.
     *
     * Se busca por orden de certeza, y se descarta cualquier control de
     * cantidad. `type="submit"` no vale como pista: según la configuración del
     * theme, el mismo botón se imprime como submit o como button.
     */
    var SEL_CARRO = ['#add-to-cart', '[data-add-to-cart]', 'button[name="add"]',
      '.add-to-cart', '.product-form__button', '.product-form__submit',
      'form[action*="cart"] button[type=submit]', 'form[name="buy"] button[type=submit]',
      'button[type=submit]'];
    function esDeCantidad(n) {
      if (!n) return true;
      if (n.closest && n.closest('.product-form__quantity, .quantity, [class*="qty"]')) return true;
      if (/quantity-(up|down)|product-form__handler/.test(n.className || '')) return true;
      var t = (n.textContent || '').trim();
      return t === '' ? false : /^[+\-−–]$/.test(t);
    }
    function botonCarro() {
      var caja = document.querySelector('.kc-hidden-native') || document;
      for (var i = 0; i < SEL_CARRO.length; i++) {
        var nodos;
        try { nodos = caja.querySelectorAll(SEL_CARRO[i]); } catch (e) { continue; }
        for (var j = 0; j < nodos.length; j++) {
          if (!esDeCantidad(nodos[j])) return nodos[j];
        }
      }
      return null;
    }
    function alCarro() {
      // Se pulsa el botón REAL del theme: su AJAX, su validación, su carro.
      var real = botonCarro();
      if (real) real.click();
      else console.warn(LOG, 'no encontré el botón de carro del theme');
    }

    /** Cambia de vista y, si se pidió, baja hasta una sección de Explorar. */
    function setTab(t, ancla) {
      current = t;
      paint();
      if (!ancla) {
        // Subir al principio de la ficha DESCONTANDO la barra fija (y con ella
        // el menú del sitio): con scrollIntoView a secas, el título del paso 01
        // quedaba detrás de la barra al entrar en Configurar.
        setTimeout(function () {
          var tapa = bar.getBoundingClientRect().bottom + 12;
          var y = root.getBoundingClientRect().top + (window.pageYOffset || 0) - tapa;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }, 30);
        return;
      }
      var destino = anclas[ancla];
      if (!destino) return;
      // Lo que tapa no es el ALTO de la barra, sino dónde TERMINA: va fija
      // bajo el menú del sitio, así que hay que descontar también ese menú (y
      // la separación extra del producto). Con el alto a secas, el título de
      // la sección quedaba escondido detrás de la barra.
      setTimeout(function () {
        var tapa = bar.getBoundingClientRect().bottom + 12;
        var y = destino.getBoundingClientRect().top + (window.pageYOffset || 0) - tapa;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 30);
    }

    // ── Panel derecho del configurador ───────────────────────────────────────
    // Todo lo que lleva sale del JSON publicado y de la selección actual; el
    // PRECIO se copia del theme, nunca se calcula aquí (fuente única de verdad).
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    function sumarHabiles(desde, n) {
      var d = new Date(desde.getTime());
      var quedan = Math.max(0, n);
      while (quedan > 0) {
        d.setDate(d.getDate() + 1);
        var dia = d.getDay();
        if (dia !== 0 && dia !== 6) quedan--;
      }
      return d;
    }
    // Valor KIMOS elegido en un paso (o null si el theme manda otro).
    function valorElegido(g, sel) {
      var kg = kimosOf(entry, g);
      var nat = g.values.filter(function (v) { return String(v.id) === String(sel[g.id]); })[0];
      if (!kg || !nat) return null;
      return (kg.values || []).filter(function (x) { return norm(x.name) === norm(nat.name); })[0] || null;
    }
    // Foto del producto según los pasos que la cambian (affectsPhoto).
    function fotoSeleccion() {
      var sel = readSelection(groups);
      var url = '';
      groups.forEach(function (g) {
        var kg = kimosOf(entry, g);
        if (!kg || kg.affectsPhoto !== true) return;
        var kv = valorElegido(g, sel);
        if (kv && kv.imageUrl) url = kv.imageUrl;
      });
      return url || images[0] || entry.imageUrl || '';
    }
    // Entrega: días de los componentes elegidos (en paralelo o en serie, según
    // deliveryMode) + los días propios de preparación.
    function textoEntrega() {
      var sel = readSelection(groups);
      var serie = entry.deliveryMode === 'sum';
      var dias = Number(entry.baseDeliveryDays) || 0;
      groups.forEach(function (g) {
        var kv = valorElegido(g, sel);
        var d = kv ? Number(kv.deliveryDays) || 0 : 0;
        dias = serie ? dias + d : Math.max(dias, d);
      });
      dias += Number(entry.leadTimeDays != null ? entry.leadTimeDays : entry.assemblyDays) || 0;
      if (!dias) return '';
      var eta = sumarHabiles(new Date(), dias);
      return 'Entrega estimada: ' + dias + ' días hábiles (aprox. ' + eta.getDate() + ' de ' + MESES[eta.getMonth()] + ')';
    }
    function pintarPanel() {
      if (!panelBox) return;
      if (panelImg) panelImg.src = fotoSeleccion();
      var mini = bar.querySelector('[data-kc-photo]');
      if (mini) mini.src = fotoSeleccion();
      // Combinación que la tienda no conoce: ocurre cuando la publicación de
      // variantes quedó a medias y el cliente arma un set que nunca llegó a
      // Jumpseller. El síntoma que se veía era el peor posible — precio "$0" y
      // el botón de comprar habilitado, que al pulsarlo respondía "Variante
      // del producto no fue encontrada". Aquí se dice antes de intentarlo.
      var sinVariante = VARIANTES.length > 0 && gruposDeVariante(groups).length > 0 && !varianteActual(groups);
      if (panelPrecio) {
        panelPrecio.textContent = sinVariante ? 'No disponible' : (themePriceText() || '—');
      }
      if (panelBox) panelBox.setAttribute('data-kc-sin-variante', sinVariante ? '1' : '0');
      if (sinVariante) {
        console.warn(LOG, 'esta combinación no existe como variante en la tienda: '
          + 'vuelve a aplicar el producto desde ProductLab para publicar las variantes que faltan.');
      }
      if (panelEntrega) panelEntrega.textContent = textoEntrega();
      if (panelResumen) {
        var sel = readSelection(groups);
        var selMap = kimosSelection(entry, groups);
        panelResumen.innerHTML = '';
        groups.forEach(function (g) {
          var kg = kimosOf(entry, g);
          if (kg && !isGroupVisible(entry, kg, selMap)) return;   // paso oculto por dependencia
          var nat = g.values.filter(function (v) { return String(v.id) === String(sel[g.id]); })[0];
          panelResumen.appendChild(el('div', null, '· ' + (kg ? kg.label : g.name) + ': ' + (nat ? nat.name : '—')));
        });
      }
      // Disponibilidad: la dice el botón REAL del theme, que es quien sabe de
      // stock y de variantes. Aquí solo se refleja.
      var real = botonCarro();
      // `disabled` es la única señal fiable de que la combinación no se puede
      // comprar; si el theme no expone su botón, no se inventa un aviso.
      // Una combinación sin variante en la tienda tampoco se puede comprar,
      // aunque el theme deje su botón habilitado: él no sabe que le falta.
      var noHay = !!(real && real.disabled) || sinVariante;
      if (panelCta) {
        panelCta.textContent = (real && (real.textContent || '').trim()) || 'Añadir al carro';
        panelCta.disabled = noHay;
      }
      if (panelStock) panelStock.textContent = noHay ? 'Esta combinación no está disponible por ahora.' : '';
    }
    /**
     * El panel acompaña al scroll dentro del configurador. Es la misma
     * mecánica de la ficha de computadores: se fija con position:fixed
     * calculando su sitio, en vez de confiar en position:sticky (que muere si
     * cualquier ancestro del theme tiene overflow) y frenando en el borde
     * inferior de la sección para no invadir el pie de página.
     */
    function ajustarPanel() {
      if (!panelBox || !confPanel) return;
      var quita = function () {
        panelBox.style.position = ''; panelBox.style.top = ''; panelBox.style.left = '';
        panelBox.style.width = ''; panelBox.style.maxHeight = ''; panelBox.style.overflowY = '';
        confPanel.style.minHeight = '';
      };
      if (window.innerWidth < 992 || current !== 'configurar') { quita(); return; }
      var barBottom = bar.getBoundingClientRect().bottom;
      if (barBottom < 0) barBottom = 0;
      var maxH = window.innerHeight - barBottom - 24;
      if (maxH < 200) { quita(); return; }
      panelBox.style.maxHeight = maxH + 'px';
      panelBox.style.overflowY = 'auto';
      var altoPanel = Math.min(panelBox.offsetHeight, maxH);
      // La sección nunca es más corta que el panel (p. ej. con todos los pasos
      // plegados): así el panel jamás se sale por abajo.
      confPanel.style.minHeight = (altoPanel + 60) + 'px';
      var caja = confPanel.getBoundingClientRect();
      var top = barBottom + 12;
      var techo = caja.bottom - altoPanel - 12;
      if (top > techo) top = techo;
      panelBox.style.position = 'fixed';
      panelBox.style.top = Math.round(top) + 'px';
      panelBox.style.left = Math.round(caja.right - 20 - 320) + 'px';
      panelBox.style.width = '320px';
    }

    function paintBar() {
      bar.innerHTML = '';
      var nav = el('div', 'kc-tabs');
      if (current === 'configurar') {
        // Personalizador bloqueado: la izquierda de la barra es solo el
        // camino de vuelta al inicio del landing.
        var back = el('button', 'kc-tab kc-volver', '← Volver');
        back.type = 'button';
        back.addEventListener('click', function () { setTab('explorar'); });
        nav.appendChild(back);
      } else TABS.forEach(function (t) {
        // Solo se marca activa la pestaña de la vista, no las anclas.
        var activa = current === t[0] && !t[2];
        // Las secundarias (Especificaciones, Fotos) llevan marca propia: en
        // móvil se ocultan salvo que el producto pida lo contrario.
        // t[2] = ancla dentro de Explorar (specs/fotos). Las que la llevan son
        // las SECUNDARIAS: en móvil se ocultan salvo que el producto las pida.
        var b = el('button', 'kc-tab' + (activa ? ' on' : '') + (t[2] ? ' kc-tab-sec' : ''), t[1]);
        b.type = 'button';
        b.addEventListener('click', function () { setTab(t[0], t[2]); });
        nav.appendChild(b);
      });
      bar.appendChild(nav);
      // Mini-foto + precio a la derecha, como en la ficha de computadores:
      // fuera del configurador el precio es un "desde" (la combinación más
      // barata la elige el cliente); dentro, el precio de lo que lleva puesto.
      var info = el('div', 'kc-bar-info');
      // Dentro del configurador el panel derecho ya muestra foto y precio:
      // repetirlos arriba solo engorda la barra (igual que en computadores).
      var enConf = current === 'configurar';
      var mini = (barCfg.showThumb === false || enConf) ? '' : (images[0] || entry.imageUrl || '');
      if (mini) {
        var im = el('img', 'kc-bar-thumb');
        im.src = mini; im.alt = '';
        im.setAttribute('data-kc-photo', '1');   // los swatches la actualizan
        info.appendChild(im);
      }
      var precioBox = el('div', 'kc-bar-precio');
      // Precio: se COPIA del theme, no se calcula. Fuente única de verdad.
      var esDesde = current !== 'configurar' && conPasos;
      var minimo = esDesde ? precioDesde() : null;
      var texto = (barCfg.showPrice === false || enConf) ? ''
        : (minimo != null ? fmtMonto(minimo) : themePriceText());
      if (esDesde && texto) {
        precioBox.appendChild(el('span', 'kc-bar-desde', tabsCfg.desde || 'desde'));
      }
      precioBox.appendChild(el('div', 'kc-bar-price', texto));
      info.appendChild(precioBox);
      bar.appendChild(info);

      // Botón de la derecha. Fuera del configurador invita a entrar en él (con
      // el texto que ponga el usuario); dentro, es el carro de verdad. Un
      // producto sin pasos no tiene nada que configurar: va directo al carro.
      var enConfig = current === 'configurar';
      // Fuera del configurador el botón invita a entrar en él. El texto sale
      // del ESTILO (así se cambia de una vez en todos los productos que
      // comparten plantilla) y el producto puede pisarlo con tabs.comprar.
      var etiqueta = enConfig || !conPasos
        ? ((botonCarro() && (botonCarro().textContent || '').trim()) || 'Añadir al carro')
        : etiquetaConfigurar();
      var cta = el('button', 'kc-btn kc-btn-primary kc-bar-cta', etiqueta);
      cta.type = 'button';
      cta.addEventListener('click', function () {
        if (enConfig || !conPasos) alCarro();
        else setTab('configurar');
      });
      bar.appendChild(cta);
      // Para volver a Explorar está su propia pestaña, que sigue ahí. Antes se
      // añadía además un "← <nombre del producto>" y el título salía DOS veces
      // en la barra, uno al lado del otro.
      // ── Alineación con el contenido: la barra es fixed a todo el ancho,
      // pero SU CONTENIDO se centra al mismo ancho medido del contenedor
      // (--kc-maxw) — así pestañas y botón quedan en línea con el hero.
      var inWrap = el('div', 'kc-bar-in');
      while (bar.firstChild) inWrap.appendChild(bar.firstChild);
      bar.appendChild(inWrap);
    }

    // El panel de configuración se construye UNA vez y se reutiliza. Antes
    // se rehacía en cada repintado, y como elegir un valor repinta, cada
    // clic creaba un visor nuevo: volvía a descargar el .glb, parpadeaba y
    // dejaba el anterior colgando. Ahora solo se vuelven a pintar los
    // pasos; el visor (y con él la sesión de AR) sobrevive.
    function construirConf() {
      if (!confPanel) {
          // Disposición de la ficha de computadores: los PASOS a la izquierda
          // y a la derecha una caja con la foto del producto, el precio, la
          // entrega, el resumen de lo elegido y el botón de carro.
          confPanel = el('div', 'kc-conf');
          confSteps = el('div', 'kc-conf-steps');
          panelBox = el('div', 'kc-panel');
          confView = el('div', 'kc-panel-foto');
          if (has3d) {
            confPanel.setAttribute('data-viewer', '3d');
            var cv = el('canvas', 'kc-canvas');
            confView.appendChild(cv);
            var msg = el('div', 'kc-canvas-msg', 'Cargando 3D…');
            confView.appendChild(msg);
            loadEngine().then(function (eng) {
              viewer = eng.createViewer(cv, { podium: false });
              // Ver en grande: el visor a pantalla completa (y de vuelta con
              // Esc). El motor necesita que se le avise del nuevo tamaño.
              var exp = el('button', 'kc-canvas-exp', '⤢');
              exp.type = 'button';
              exp.title = 'Ver en grande';
              exp.setAttribute('aria-label', 'Ver el modelo en grande');
              var grande = false;
              var alternar = function () {
                grande = !grande;
                confView.classList.toggle('kc-3d-full', grande);
                exp.textContent = grande ? '✕' : '⤢';
                exp.title = grande ? 'Salir de pantalla completa' : 'Ver en grande';
                setTimeout(function () { if (viewer && viewer.resize) viewer.resize(); }, 60);
              };
              exp.addEventListener('click', alternar);
              document.addEventListener('keydown', function (ev) {
                if (ev.key === 'Escape' && grande) alternar();
              });
              confView.appendChild(exp);
              return ponerModelo(viewer, entry.model3d).then(function () {
                viewer.setFinishes(entry.model3d.finishes || []);
                viewer.setState(build3dState(entry, groups));
                msg.style.display = 'none';
                montarAR(confView, viewer, entry, groups);
              });
            }).catch(function (e) { msg.textContent = 'No se pudo mostrar el 3D.'; console.warn(LOG, e); });
          } else {
            panelImg = el('img', 'kc-panel-img');
            panelImg.alt = prod.name || '';
            confView.appendChild(panelImg);
          }
          var cab = el('div', 'kc-panel-head');
          cab.appendChild(el('div', 'kc-panel-name', entry.name || prod.name || ''));
          if (ctx.sku) cab.appendChild(el('div', 'kc-panel-sku', 'SKU · ' + ctx.sku));
          var cuerpo = el('div', 'kc-panel-body');
          cuerpo.appendChild(el('div', 'kc-price-label', 'Precio'));
          panelPrecio = el('div', 'kc-price');
          panelEntrega = el('div', 'kc-delivery');
          panelResumen = el('div', 'kc-summary');
          panelStock = el('div', 'kc-stockmsg');
          panelCta = el('button', 'kc-btn kc-btn-primary');
          panelCta.type = 'button';
          panelCta.addEventListener('click', alCarro);
          cuerpo.appendChild(panelPrecio);
          cuerpo.appendChild(panelEntrega);
          cuerpo.appendChild(panelResumen);
          cuerpo.appendChild(panelStock);
          cuerpo.appendChild(panelCta);
          panelBox.appendChild(confView);
          panelBox.appendChild(cab);
          panelBox.appendChild(cuerpo);
          // Móvil: el panel se convierte en una barra flotante abajo y este
          // botón despliega el detalle hacia arriba.
          var expandir = el('button', 'kc-panel-exp', '▲');
          expandir.type = 'button';
          expandir.setAttribute('aria-label', 'Ver el detalle de la configuración');
          expandir.addEventListener('click', function () {
            var abierto = panelBox.classList.toggle('kc-open');
            expandir.textContent = abierto ? '▼' : '▲';
          });
          panelBox.appendChild(expandir);
          confPanel.appendChild(confSteps);
          confPanel.appendChild(panelBox);
      }
      pintarPasos();
    }

    /**
     * PRESETS — capa previa OPCIONAL dentro del personalizador: la app puede
     * publicar configuraciones sugeridas (entry.presets, resueltas por
     * nombres). Si existen, al entrar se ofrecen como cards con su precio de
     * variante y un "Personalizar desde cero"; elegir una escribe la
     * selección en los selects nativos y deja el paso a paso listo para
     * editar. Sin presets, el paso a paso aparece directo, como siempre.
     */
    var hayPresets = Array.isArray(entry.presets) && entry.presets.length > 0;
    var presetVisto = !hayPresets;
    function idsDePreset(pz) {
      var ids = {};
      (pz.selection || []).forEach(function (sv) {
        var g = groups.filter(function (x) { return norm(x.name) === norm(sv.group); })[0];
        if (!g) return;
        var val = g.values.filter(function (v) { return norm(v.name) === norm(sv.value); })[0];
        if (val) ids[g.id] = String(val.id);
      });
      return ids;
    }
    function precioPreset(pz) {
      // Selección actual + el preset encima: los pasos que el preset no toca
      // conservan su valor (los ocultos, su comodín). La BASE la pone la
      // variante (solo grupos reales — con ancla+addons, el color); encima
      // suman los addon_price de los pasos virtuales elegidos.
      var sel = readSelection(groups);
      var pre = idsDePreset(pz);
      var eleccion = function (g) { return String(pre[g.id] != null ? pre[g.id] : (sel[g.id] || '')); };
      var reales = gruposDeVariante(groups);
      var base = null;
      if (reales.length && VARIANTES.length) {
        var ids = reales.map(eleccion).filter(Boolean);
        if (ids.length !== reales.length) return null;
        for (var i = 0; i < VARIANTES.length; i++) {
          var e = VARIANTES[i] || {};
          var crudos = e.values || e.options || [];
          var vals = [];
          for (var k = 0; k < crudos.length; k++) {
            var x = crudos[k] || {};
            var vid = (x.value && x.value.id != null) ? x.value.id
              : (x.value_id != null ? x.value_id : x.id);
            if (vid != null) vals.push(String(vid));
          }
          if (vals.length !== ids.length) continue;
          var todos = true;
          for (var j = 0; j < vals.length; j++) { if (ids.indexOf(vals[j]) === -1) { todos = false; break; } }
          if (todos) { base = precioDeVariante(e.variant || e); break; }
        }
        if (base == null) return null;
      } else {
        base = precioBaseProducto();
        if (base == null) return null;
      }
      var total = base;
      groups.forEach(function (g) {
        if (!g.virtual) return;
        var id = eleccion(g);
        if (id) total += addonPriceDe(g, id);
      });
      return total;
    }
    function aplicarPreset(pz) {
      var pre = idsDePreset(pz);
      groups.forEach(function (g) { if (pre[g.id] != null) applyNative(g, pre[g.id]); });
      presetVisto = true;
      ajustar(false);
      pintarPasos();
      pintarPanel();
      paintBar();
      if (viewer) viewer.setState(build3dState(entry, groups));
    }
    function renderPresets() {
      var wrap = el('div', 'kc-presets');
      wrap.appendChild(el('div', 'kc-presets-t', tabsCfg.presetsTitulo || 'Elige un punto de partida'));
      wrap.appendChild(el('div', 'kc-presets-s', 'Configuraciones listas para comprar — elige una y ajústala a tu gusto, o parte desde cero.'));
      var grid = el('div', 'kc-presets-grid');
      (entry.presets || []).forEach(function (pz) {
        var card = el('button', 'kc-preset');
        card.type = 'button';
        var foto = pz.imageUrl || entry.imageUrl || (images && images[0]) || '';
        if (foto) { var im = el('img', 'kc-preset-img'); im.src = foto; im.alt = ''; card.appendChild(im); }
        card.appendChild(el('div', 'kc-preset-n', pz.name || 'Configuración'));
        var precio = precioPreset(pz);
        if (precio != null) card.appendChild(el('div', 'kc-preset-p', fmtMonto(precio)));
        card.appendChild(el('span', 'kc-btn kc-btn-primary kc-preset-cta', 'Elegir y editar'));
        card.addEventListener('click', function () { aplicarPreset(pz); });
        grid.appendChild(card);
      });
      var cero = el('button', 'kc-preset kc-preset-cero');
      cero.type = 'button';
      cero.appendChild(el('div', 'kc-preset-n', 'Personalizar desde cero'));
      cero.appendChild(el('div', 'kc-preset-d', 'Elige componente por componente, paso a paso.'));
      cero.addEventListener('click', function () { presetVisto = true; pintarPasos(); });
      grid.appendChild(cero);
      wrap.appendChild(grid);
      return wrap;
    }
    function pintarPasos() {
      if (!confSteps) return;
      confSteps.innerHTML = '';
      if (!presetVisto) { confSteps.appendChild(renderPresets()); medirBarra(); return; }
      if (hayPresets) {
        var volverP = el('button', 'kc-btn kc-presets-volver', '‹ Configuraciones sugeridas');
        volverP.type = 'button';
        volverP.addEventListener('click', function () { presetVisto = false; pintarPasos(); medirBarra(); });
        confSteps.appendChild(volverP);
      }
      confSteps.appendChild(renderSteps(entry, groups, ctx));
    }

    function paint() {
      paintBar();
      body.innerHTML = '';
      var enConf = current === 'configurar';
      if (!enConf) {
        // Ficha principal: specs y fotos van AQUÍ DENTRO, en el orden del
        // builder, y las pestañas de arriba solo bajan hasta ellas. Tenerlas
        // como pestañas aparte rompía la lectura en trozos inconexos.
        anclas = {};
        // La nota es SU PROPIA sección y solo se ve ahí. La galería la pintaba
        // además dentro de sí misma, así que salía duplicada y no había forma
        // de quitarla de ahí: quien no la quería bajo las fotos no tenía
        // interruptor. Ahora la lista de secciones manda y punto.
        secs.forEach(function (s) {
          var n = null;
          if (s.kind === 'hero') n = renderHero(s, ctx);
          else if (s.kind === 'imagen') n = renderImagen(s);
          else if (s.kind === 'specs' && hasSpecs) { n = renderSpecsTable(sf.specs); anclas.specs = n; }
          else if (s.kind === 'fotos' && hasFotos) { n = renderPhotos(imagesTienda, style.photos, altDe); anclas.fotos = n; }
          else if (s.kind === 'note' && sf.photosNote) n = el('div', 'kc-note', sf.photosNote);
          if (n) { anchoSeccion(n, s.width); body.appendChild(n); }
        });
      } else if (conPasos) {
        // Personalizador: sección propia (botón Configurar de la barra), con
        // "← Volver" en la barra como camino de regreso.
        construirConf();
        body.appendChild(confPanel);
        hostearPanel();
        pintarPanel();
      }
      if (viewer && enConf) {
        viewer.setState(build3dState(entry, groups));
        viewer.resize();
      }
      // Vive en <body> cuando el theme rompe `fixed`: al salir del
      // personalizador hay que esconderlo a mano.
      if (panelBox) panelBox.style.display = enConf ? '' : 'none';
      // El footer del theme se ve en la ficha principal y se OCULTA solo en
      // el personalizador (ahí abajo no aporta y quitaba sitio a los pasos).
      mostrarFooter(!enConf);
      // El alto de la barra y el anclaje del panel dependen de lo que se acaba
      // de pintar: se recalculan al final, nunca antes.
      medirBarra();
    }

    // Si el theme cambia la selección por su cuenta (o el usuario usa los
    // controles originales), la ficha se repinta para no desincronizarse.
    // Antes de repintar se re-evalúan las dependencias: un cambio puede
    // ocultar pasos (que se fuerzan a su default) o hacerlos reaparecer.
    document.addEventListener('change', function (ev) {
      if (!(ev.target && ev.target.closest && ev.target.closest('.prod-options'))) return;
      if (enforcing) return;   // cambio provocado por el propio ajuste
      ajustar(true);
      if (viewer) viewer.setState(build3dState(entry, groups));
      // Se repinta respetando la capa de presets (si sigue a la vista).
      if (confSteps) {
        if (presetVisto) pintarPasos();
        pintarPanel();
      }
      paintBar();
    });

    // El botón de carro del theme se habilita/deshabilita por su cuenta y a su
    // ritmo (resuelve la variante después de que nosotros hayamos pintado). Si
    // solo se mira al pintar, el panel se queda con la foto de un instante y
    // enseña "no disponible" para siempre. Se vigila su atributo.
    // El PRECIO del theme se repinta por su cuenta al cambiar la variante (su
    // JS reconstruye el componente de precio). Si nuestro cálculo por variante
    // no casara con este theme, el panel se quedaría con el precio de
    // arranque: se observa el nodo real y se copia cada vez que cambie.
    (function vigilarPrecio() {
      if (typeof MutationObserver !== 'function') return;
      var nodo = document.querySelector('.kc-hidden-native product-price, .kc-hidden-native .product-price, .kc-hidden-native [class*="price"]');
      if (!nodo) return;
      new MutationObserver(function () { pintarPanel(); paintBar(); })
        .observe(nodo, { childList: true, subtree: true, characterData: true });
    })();

    (function vigilarCarro() {
      var real = botonCarro();
      if (!real || typeof MutationObserver !== 'function') return;
      new MutationObserver(function () { pintarPanel(); }).observe(real, {
        attributes: true, attributeFilter: ['disabled', 'class'],
      });
    })();

    // Qué botón de carro se está usando: si se elige el equivocado, todo lo
    // que cuelga de él (disponibilidad y "Añadir al carro") queda mal.
    (function revisarCarro() {
      var real = botonCarro();
      if (!real) {
        console.warn(LOG, 'no encuentro el botón de carro del theme: el panel no podrá añadir al carro. '
          + 'Si tu theme usa otro marcado, dímelo y lo añado a la lista.');
        return;
      }
      console.info(LOG, 'botón de carro del theme: '
        + real.tagName.toLowerCase() + (real.id ? '#' + real.id : '') + (real.className ? '.' + String(real.className).split(/\s+/)[0] : '')
        + (real.disabled ? ' (deshabilitado ahora mismo)' : ''));
    })();

    // Radiografía de los pasos: qué tiene la TIENDA (que es lo que se puede
    // comprar) frente a lo que publica KIMOS. Cuando no cuadran, la ficha se
    // ve "a medias" —falta un valor, o la combinación no existe— y hasta ahora
    // había que adivinarlo.
    (function revisarPasos() {
      var faltan = [];
      (entry.groups || []).forEach(function (kg) {
        var g = nativeOf(groups, kg);
        if (!g) { faltan.push('el paso "' + kg.label + '" no existe como opción en la tienda'); return; }
        var sinTienda = (kg.values || []).filter(function (v) {
          // El relleno ("No aplica") de un paso dependiente no se publica como
          // addon a propósito: no es un valor comprable y no debe acusarse.
          if (g.virtual && esRelleno(v)) return false;
          return !g.values.some(function (n) { return norm(n.name) === norm(v.name); });
        }).map(function (v) { return v.name; });
        if (sinTienda.length) faltan.push('"' + kg.label + '" sin ' + sinTienda.join(', ') + ' en la tienda');
      });
      if (!faltan.length) return;
      console.warn(LOG, 'la tienda y ProductLab no coinciden — ' + faltan.join(' · ')
        + '. La ficha solo puede ofrecer lo que la tienda tiene (es lo que se cobra): '
        + 'abre el producto en ProductLab y pulsa "Guardar y aplicar a la tienda" para crear las opciones y variantes que faltan.');
    })();

    // Al cargar, los pasos ocultos por dependencia quedan ya en su default
    // (sin aviso: nadie eligió nada todavía; solo se sincroniza la variante).
    ajustar(false);
    paint();
    medirBarra();
    reencajar();
    console.info(LOG, 'v' + VERSION + ' · ficha KIMOS activa para "' + (entry.name || prod.name) + '"'
      + (has3d ? ' (con 3D)' : '') + ' · contrato v' + (contractVer || 1));
  }

  // Velo anti-parpadeo puesto por custom.js: se retira en cuanto se sabe si
  // esta ficha se reemplaza o no. Sin esto la página original se ve un instante
  // y da sensación de parche.
  function destapar(inmediato) {
    var v = document.getElementById('kc-veil');
    if (v && v.parentNode) v.parentNode.removeChild(v);
    var b = document.getElementById('kc-boot');
    if (!b) return;
    if (inmediato) { if (b.parentNode) b.parentNode.removeChild(b); return; }
    b.classList.add('kc-boot-out');   // se funde, no desaparece de golpe
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 350);
  }

  /**
   * Espera a que la ficha esté MIRABLE: sus imágenes ya cargadas (incluidos
   * los fondos de los heros, que no son <img> y nadie espera). Con un tope,
   * porque una foto que no llega no puede dejar la tienda tapada para siempre.
   */
  function esperarImagenes(raiz, tope) {
    var pendientes = [];
    var espera = function (n) {
      return new Promise(function (listo) {
        n.addEventListener('load', listo, { once: true });
        n.addEventListener('error', listo, { once: true });
      });
    };
    var imgs = raiz.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].src && !imgs[i].complete) pendientes.push(espera(imgs[i]));
    }
    // Fondos de hero: se precargan en un <img> suelto, que es lo que permite
    // saber cuándo están listos. Es la foto grande que aparecía a destiempo.
    var fondos = raiz.querySelectorAll('.kc-hero-bg');
    for (var j = 0; j < fondos.length; j++) {
      var url = (getComputedStyle(fondos[j]).backgroundImage || '').match(/url\(["']?(.*?)["']?\)/);
      if (!url || !url[1] || url[1] === 'none') continue;
      var pre = new Image();
      pendientes.push(espera(pre));
      pre.src = url[1];
    }
    if (!pendientes.length) return Promise.resolve();
    return Promise.race([
      Promise.all(pendientes),
      new Promise(function (listo) { setTimeout(listo, tope || 4000); }),
    ]);
  }

  function start() {
    var prod = currentProduct();
    // Cuando NO se va a reemplazar nada, el velo sobra: fuera de inmediato,
    // sin fundido, que la ficha del theme ya está lista debajo.
    if (!prod) { destapar(true); return; }
    loadDefinition(prod).then(function (def) {
      var entry = findEntry(def, prod);
      if (!entry) { destapar(true); return; }
      // Sin ficha ni 3D no hay nada que reemplazar: se deja el theme como está.
      var sf = entry.storefront || {};
      if (!(sf.pageSections || []).length && !(entry.model3d && entry.model3d.url)) { destapar(true); return; }
      // `version` 1 o 2: el contrato v2 (ProductLab) añade campos que aquí se
      // tratan como opcionales, así que ambos se montan por la misma vía.
      // Si el montaje falla, la ficha del theme TIENE que volver a verse: sin
      // este resguardo un error dejaba el velo puesto y la página en blanco.
      try { mount(entry, prod, (def && def.version) || 1); }
      catch (e) {
        console.error(LOG, 'la ficha KIMOS falló al montarse; se deja la del theme:', e);
        var roto = document.querySelector('.kimos-cfg');
        if (roto && roto.parentNode) roto.parentNode.removeChild(roto);
        var oculto = document.querySelector('.kc-hidden-native');
        if (oculto) oculto.classList.remove('kc-hidden-native');
        destapar(true);
        return;
      }
      // Se destapa cuando la ficha está pintada Y sus fotos han cargado: así
      // no se ve ni la ficha vieja ni el hero sin su imagen.
      var raiz = document.querySelector('.kimos-cfg') || document;
      esperarImagenes(raiz, CFG.bootMax).then(function () { destapar(); });
    }).catch(function (e) { destapar(); console.warn(LOG, 'no se pudo leer la definición:', e.message); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
