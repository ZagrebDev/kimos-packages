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
  };
  var LOG = '[kimos-cfg]';
  var VERSION = '5.2.0';
  var SELF = document.currentScript;
  var norm = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };

  if (!CFG.url || !CFG.full) return;

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

  function loadDefinition() {
    var bust = Math.floor(Date.now() / 300000);
    return fetch(CFG.url + (CFG.url.indexOf('?') === -1 ? '?' : '&') + '_t=' + bust, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { return j && j.data ? j.data : j; });
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
  function nativeGroups(prod) {
    return Array.prototype.map.call(document.querySelectorAll('.prod-options'), function (g) {
      var optId = g.getAttribute('data-optionid');
      var opt = (prod.options || []).filter(function (o) { return String(o.id) === String(optId); })[0];
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
      return { el: g, id: optId, name: name, values: values };
    });
  }

  function readSelection(groups) {
    var out = {};
    groups.forEach(function (g) {
      if (g.el.tagName === 'SELECT') out[g.id] = g.el.value;
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
        if (isGroupVisible(entry, kg, selMap)) return;
        var dv = kimosDefault(kg);
        if (!dv || String(selMap[kg.id]) === String(dv.id)) return;
        selMap[kg.id] = dv.id;
        changed = true;
        var g = nativeOf(groups, kg);
        if (g) {
          var nat = g.values.filter(function (v) { return norm(v.name) === norm(dv.name); })[0];
          if (nat && String(readSelection(groups)[g.id]) !== String(nat.id)) {
            applyNative(g, nat.id);
            cambios.push((kg.label || '') + ' → ' + (dv.name || ''));
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
  function themePriceValue() {
    var f = document.querySelector('script.product-form-json');
    if (!f) return null;
    try {
      var info = (JSON.parse(f.textContent) || {}).info || {};
      var v = info.variant && info.variant.price;
      var p = info.product && info.product.price;
      var n = v != null ? Number(v) : (p != null ? Number(p) : null);
      return n != null && isFinite(n) ? n : null;
    } catch (e) { return null; }
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
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll('.kc-hidden-native ' + sels[i] + ', ' + sels[i]);
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (n.closest && n.closest('.kimos-cfg')) continue;      // no leerse a sí mismo
        if (/^(SCRIPT|TEMPLATE|STYLE|NOSCRIPT)$/.test(n.tagName)) continue;
        var t = (n.textContent || '').trim();
        if (!t || t.length > 40 || !/\d/.test(t) || t.indexOf('{') !== -1) continue;
        if (!simbolo) simbolo = (t.match(/^[^\d]*/) || [''])[0].trim();
        // Con precio conocido solo vale el nodo que lo muestra.
        if (buscado) { if (digitos(t).indexOf(buscado) !== -1) return t; }
        else if (valor == null) return t;   // sin JSON no queda otra que confiar
      }
    }
    if (valor == null) return '';
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
      return (simbolo || '$') + new Intl.NumberFormat(document.documentElement.lang || 'es-CL').format(valor);
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
      img.alt = ctx.name || '';
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
      var btn = el('button', 'kc-btn kc-btn-' + (b.style || 'primary'), b.label || 'Configurar');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (b.action === 'url' && b.url) window.location.href = b.url;
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
      var gi = el('img', 'kc-photo kc-photo-' + (b.size || 'm'));
      gi.src = (ctx.images || [])[Math.max(0, (b.index || 1) - 1)] || ctx.image || '';
      gi.alt = '';
      n.appendChild(gi);
    } else if (b.type === 'description') {
      // La descripción que el producto ya tiene en la tienda. Llega como texto
      // (el backend le quita el HTML al sincronizar), así que se pinta con
      // textContent: nunca se inyecta marcado ajeno en la ficha.
      var d = ctx.desc || '';
      var max = b.max || 0;
      if (max > 0 && d.length > max) d = d.slice(0, max).replace(/\s+\S*$/, '') + '…';
      n = el('div', 'kc-b kc-b-desc kc-size-' + (b.size || 'm'), d);
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
  function renderPhotos(images, note, cfg) {
    var wrap = el('div', 'kc-fotos');
    var pc = cfg || {};
    wrap.setAttribute('data-size', ['s', 'l', 'xl'].indexOf(pc.size) !== -1 ? pc.size : 'm');
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
    big.alt = '';
    main.appendChild(big);
    var thumbs = images.length > 1 ? el('div', 'kc-foto-thumbs') : null;
    var actual = 0;
    var count = null;
    function mostrar(i) {
      actual = (i + images.length) % images.length;
      big.src = images[actual];
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
    wrap.appendChild(main);
    if (thumbs) {
      images.forEach(function (u, i) {
        var t = el('img', 'kc-foto-th' + (i === 0 ? ' on' : ''));
        t.src = u;
        t.alt = '';
        t.addEventListener('click', function () { mostrar(i); });
        thumbs.appendChild(t);
      });
      wrap.appendChild(thumbs);
    }
    if (note) wrap.appendChild(el('div', 'kc-foto-note', note));
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
  function cardPrecio(mode, on, kv, kvSel, precioAhora) {
    if (mode === 'none' || on || !kv || kv.delta == null) return '';
    var dlt = (Number(kv.delta) || 0) - (kvSel && kvSel.delta != null ? Number(kvSel.delta) || 0 : 0);
    if (mode === 'total' && precioAhora != null) return fmtMonto(precioAhora + dlt);
    return dlt === 0 ? '' : fmtDelta(dlt);
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
      g.values.forEach(function (v) {
        var kv = kg ? (kg.values || []).filter(function (x) { return norm(x.name) === norm(v.name); })[0] : null;
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
        var nombre = el('span', 'kc-card-n', v.name);
        // Cantidad informativa (v2): "Memoria ×2". El nombre suele decirlo ya;
        // el multiplicador es discreto y sale del `qty` del JSON.
        if (kv && Number(kv.qty) > 1) nombre.appendChild(el('span', 'kc-card-qty', ' ×' + Math.round(Number(kv.qty))));
        c.appendChild(nombre);
        if (kv && kv.desc) c.appendChild(el('span', 'kc-card-d', kv.desc));
        var precio = cardPrecio(st.showDeltas || 'delta', on, kv, kvSel, precioAhora);
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
    var base = CFG.url.replace(/\/definition(\?.*)?$/, '');
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
  var HEADER_CANDIDATOS = 'header, .header, #header, .theme-header, .site-header, .main-header, .navbar, .nav-bar, .topbar, .top-bar, [class*="header"][class*="fixed"], [class*="header"][class*="sticky"]';
  var CONT_CANDIDATOS = '.container, .page-width, .site-width, .wrapper, .site-container, .page-container, .content-wrapper, main > .container, .shopify-section > .container';

  // Alto ocupado por lo que está FIJO en la parte superior de la ventana.
  function medirTop() {
    if (LAYOUT.topFijo != null) return Math.max(0, LAYOUT.topFijo);
    var nodos;
    try { nodos = document.querySelectorAll(LAYOUT.headerSel || HEADER_CANDIDATOS); }
    catch (e) { nodos = document.querySelectorAll(HEADER_CANDIDATOS); }
    var top = 0;
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i];
      if (n.closest && n.closest('.kimos-cfg')) continue;     // no medirnos a nosotros
      var cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // Solo cuenta lo que TAPA: fijo o pegajoso y anclado arriba del todo.
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      var r = n.getBoundingClientRect();
      if (r.height <= 0 || r.top > 4 || r.bottom <= 0) continue;
      if (r.bottom > top) top = r.bottom;
    }
    // Un header desmedido casi siempre es una medición equivocada (un
    // contenedor entero marcado como sticky): mejor 0 que romper la página.
    return top > window.innerHeight * 0.4 ? 0 : Math.round(top);
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
        root.classList.add('kc-w-container');
      } else {
        root.classList.remove('kc-w-container');   // 'auto' sin contenedor = full
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
    // Galería: manda la que publica KIMOS (`entry.images`), que trae la galería
    // COMPLETA leída de la tienda por el backend. Lo que se raspa del DOM se
    // añade detrás, por si el theme muestra alguna foto que el sync no tenga.
    var images = addImages(addImages([], entry.images), prod.images);
    if (!images.length && entry.imageUrl) images.push(entry.imageUrl);
    // Descripción del producto en la tienda, para el bloque `description`.
    var desc = String(entry.description || '');
    var viewer = null;
    var confPanel = null, confView = null, confSteps = null;

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
    var reencajar = encajarConTheme(root, page, style.width);
    // Alto REAL de la barra fija → hueco que le guarda su envoltorio. Se
    // recalcula porque cambia con el contenido (precio largo, dos líneas en
    // móvil) y con el ancho de la ventana.
    function medirBarra() {
      var alto = bar.getBoundingClientRect().height;
      if (alto) root.style.setProperty('--kc-bar-h', Math.round(alto) + 'px');
    }
    window.addEventListener('resize', medirBarra);
    [0, 120, 400, 1200].forEach(function (ms) { setTimeout(medirBarra, ms); });

    var has3d = !!(entry.model3d && entry.model3d.url);
    var secs = (sf.pageSections || []).filter(function (s) { return s.kind !== 'hero' ? s.show !== false : true; });
    var hasHero = secs.some(function (s) { return s.kind === 'hero'; });
    var hasSpecs = (sf.specs || []).length > 0 && tabsCfg.showSpecs !== false;
    var hasFotos = images.length > 0 && tabsCfg.showFotos !== false;

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
    var TABS = [['explorar', tabsCfg.explorar || 'Explorar', null]];
    ORDEN.forEach(function (k) {
      if (k === 'specs' && hasSpecs) TABS.push(['explorar', tabsCfg.specs || 'Especificaciones', 'specs']);
      if (k === 'fotos' && hasFotos) TABS.push(['explorar', tabsCfg.fotos || 'Fotos', 'fotos']);
    });

    // ?kimos_ar=1 — es lo que codifica el QR del escritorio: quien lo escanea
    // aterriza directamente en el configurador, sin buscar la pestaña.
    var pedidoAR = /[?&]kimos_ar=1/.test(location.search);
    var current = pedidoAR || !(hasHero || hasSpecs || hasFotos) ? 'configurar' : 'explorar';
    var anclas = {};   // sección → nodo, para bajar hasta ella
    var ctx = {
      name: prod.name, sku: entry.sku || prod.sku || '',
      image: images[0] || '', images: images, specs: sf.specs || [],
      desc: desc,
      style: style,
      stepsOpen: null,   // colapso por paso: lo siembra renderSteps
      goTab: function (t) { setTab(t); },
      refresh: function () { paint(); },
    };

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

    function botonCarro() {
      return document.querySelector('.kc-hidden-native button[type=submit], .kc-hidden-native .product-form button, .kc-hidden-native form button');
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
      if (!ancla) { root.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var destino = anclas[ancla];
      if (!destino) return;
      // La barra es pegajosa: hay que descontar su alto o el título de la
      // sección queda escondido justo debajo.
      setTimeout(function () {
        var alto = bar.getBoundingClientRect().height + 12;
        var y = destino.getBoundingClientRect().top + (window.pageYOffset || 0) - alto;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 30);
    }

    function paintBar() {
      bar.innerHTML = '';
      var nav = el('div', 'kc-tabs');
      TABS.forEach(function (t) {
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
      var mini = barCfg.showThumb === false ? '' : (images[0] || entry.imageUrl || '');
      if (mini) {
        var im = el('img', 'kc-bar-thumb');
        im.src = mini; im.alt = '';
        im.setAttribute('data-kc-photo', '1');   // los swatches la actualizan
        info.appendChild(im);
      }
      var precioBox = el('div', 'kc-bar-precio');
      // Precio: se COPIA del theme, no se calcula. Fuente única de verdad.
      var texto = barCfg.showPrice === false ? '' : themePriceText();
      if (current !== 'configurar' && conPasos && texto) {
        precioBox.appendChild(el('span', 'kc-bar-desde', tabsCfg.desde || 'desde'));
      }
      precioBox.appendChild(el('div', 'kc-bar-price', texto));
      info.appendChild(precioBox);
      bar.appendChild(info);

      // Botón de la derecha. Fuera del configurador invita a entrar en él (con
      // el texto que ponga el usuario); dentro, es el carro de verdad. Un
      // producto sin pasos no tiene nada que configurar: va directo al carro.
      var enConfig = current === 'configurar';
      var etiqueta = enConfig || !conPasos
        ? ((botonCarro() && (botonCarro().textContent || '').trim()) || 'Añadir al carro')
        : (tabsCfg.comprar || 'Configurar');
      var cta = el('button', 'kc-btn kc-btn-primary kc-bar-cta', etiqueta);
      cta.type = 'button';
      cta.addEventListener('click', function () {
        if (enConfig || !conPasos) alCarro();
        else setTab('configurar');
      });
      bar.appendChild(cta);
      // Volver a Explorar desde el configurador, si hay algo a lo que volver.
      if (enConfig && (hasHero || hasSpecs || hasFotos)) {
        var atras = el('button', 'kc-btn kc-bar-back', '← ' + (tabsCfg.explorar || 'Explorar'));
        atras.type = 'button';
        atras.addEventListener('click', function () { setTab('explorar'); });
        nav.insertBefore(atras, nav.firstChild);
      }
    }

    function paint() {
      paintBar();
      if (typeof medirBarra === 'function') medirBarra();
      body.innerHTML = '';
      if (current === 'explorar') {
        // Specs y Fotos van AQUÍ DENTRO, en el orden del builder, y las
        // pestañas de arriba solo bajan hasta ellas. Tenerlas como pestañas
        // aparte rompía la lectura de la ficha en trozos sueltos.
        anclas = {};
        secs.forEach(function (s) {
          var n = null;
          if (s.kind === 'hero') n = renderHero(s, ctx);
          else if (s.kind === 'imagen') n = renderImagen(s);
          else if (s.kind === 'specs' && hasSpecs) { n = renderSpecsTable(sf.specs); anclas.specs = n; }
          else if (s.kind === 'fotos' && hasFotos) { n = renderPhotos(images, sf.photosNote, style.photos); anclas.fotos = n; }
          else if (s.kind === 'note' && sf.photosNote) n = el('div', 'kc-note', sf.photosNote);
          if (n) { anchoSeccion(n, s.width); body.appendChild(n); }
        });
      } else if (current === 'configurar') {
        // El panel de configuración se construye UNA vez y se reutiliza. Antes
        // se rehacía en cada repintado, y como elegir un valor repinta, cada
        // clic creaba un visor nuevo: volvía a descargar el .glb, parpadeaba y
        // dejaba el anterior colgando. Ahora solo se vuelven a pintar los
        // pasos; el visor (y con él la sesión de AR) sobrevive.
        if (!confPanel) {
          confPanel = el('div', 'kc-conf');
          confView = el('div', 'kc-conf-view');
          confSteps = el('div', 'kc-conf-steps');
          confPanel.appendChild(confView);
          confPanel.appendChild(confSteps);
          if (has3d) {
            var cv = el('canvas', 'kc-canvas');
            confView.appendChild(cv);
            var msg = el('div', 'kc-canvas-msg', 'Cargando 3D…');
            confView.appendChild(msg);
            loadEngine().then(function (eng) {
              viewer = eng.createViewer(cv, { podium: false });
              return viewer.setModel({
                url: entry.model3d.url, rotation: entry.model3d.rotation,
                mirror: entry.model3d.mirror, parts: entry.model3d.parts,
              }).then(function () {
                viewer.setFinishes(entry.model3d.finishes || []);
                viewer.setState(build3dState(entry, groups));
                msg.style.display = 'none';
                montarAR(confView, viewer, entry, groups);
              });
            }).catch(function (e) { msg.textContent = 'No se pudo mostrar el 3D.'; console.warn(LOG, e); });
          } else {
            var im = el('img', 'kc-conf-img');
            im.src = images[0] || ''; im.alt = prod.name || '';
            confView.appendChild(im);
          }
        }
        confSteps.innerHTML = '';
        confSteps.appendChild(renderSteps(entry, groups, ctx));
        body.appendChild(confPanel);
      }
      if (viewer && current === 'configurar') {
        viewer.setState(build3dState(entry, groups));
        viewer.resize();
      }
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
      if (current === 'configurar' && confSteps) {
        confSteps.innerHTML = '';
        confSteps.appendChild(renderSteps(entry, groups, ctx));
      }
      paintBar();
    });

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
  function destapar() {
    var v = document.getElementById('kc-veil');
    if (v && v.parentNode) v.parentNode.removeChild(v);
  }

  function start() {
    var prod = currentProduct();
    if (!prod) { destapar(); return; }
    loadDefinition().then(function (def) {
      var entry = findEntry(def, prod);
      if (!entry) { destapar(); return; }
      // Sin ficha ni 3D no hay nada que reemplazar: se deja el theme como está.
      var sf = entry.storefront || {};
      if (!(sf.pageSections || []).length && !(entry.model3d && entry.model3d.url)) { destapar(); return; }
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
      }
      destapar();
    }).catch(function (e) { destapar(); console.warn(LOG, 'no se pudo leer la definición:', e.message); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
