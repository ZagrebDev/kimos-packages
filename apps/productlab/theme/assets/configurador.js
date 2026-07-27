/**
 * ProductLab — configurador para themes Jumpseller.
 *
 * Página de producto en 3 pestañas:
 *   EXPLORAR         hero/secciones gestionados desde la app ProductLab
 *                    (storefront.pageSections / storefront.hero)
 *   CONFIGURAR       pasos con cards; precio y entrega en vivo
 *   ESPECIFICACIONES tabla full-width (storefront.specs)
 *
 * Fuentes de datos:
 *   - script.product-json (Liquid): variantes reales de Jumpseller. El PRECIO
 *     mostrado y cobrado es SIEMPRE el de la variante seleccionada (el JSON de
 *     la app solo aporta presentación: imágenes, specs, compatibilidades,
 *     entrega y deltas informativos).
 *   - JSON público de ProductLab: GET {kimosUrl} → { productos: [...] } — se
 *     matchea el producto por productId o SKU. Por compatibilidad con JSON
 *     version 1 también se acepta la clave `equipos`.
 *
 * Integración con el theme anfitrión (p. ej. Streamly): mantenemos selects
 * nativos ocultos (.pp-variants-native select.prod-options) que este script
 * maneja; el theme ya escucha esos selects para el matching de variante, la
 * URL ?variant_id y el click AJAX de button#add-to-cart[type=button]. Cero
 * duplicación de carro.
 *
 * Compatibilidades (decisión de UX): los valores incompatibles se OCULTAN.
 * Si un cambio deja inválida una selección previa, se reajusta sola al primer
 * valor visible y se avisa en el panel.
 *
 * Pasos condicionales (dependsOn, JSON version 2): un paso con
 * dependsOn: {groupId, valueIds} solo se muestra si la selección actual del
 * paso `groupId` está entre `valueIds`. Oculto, su selección se FUERZA a su
 * valor por defecto (isDefault) y el select nativo queda sincronizado para
 * que el matching de variante siga funcionando.
 *
 * Moneda/locale: parametrizables con data-pp-locale (default 'es-CL') y
 * data-pp-currency-prefix (default '$') en el contenedor [data-pp-configurador].
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-pp-configurador]");
  if (!root) return;

  // ── Utilidades ────────────────────────────────────────────────────────────
  function $(sel, ctx) { return (ctx || root).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(sel)); }
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Moneda parametrizable: locale y prefijo se leen del contenedor.
  var moneyLocale = String(root.getAttribute("data-pp-locale") || "es-CL");
  var moneyPrefix = root.getAttribute("data-pp-currency-prefix");
  if (moneyPrefix == null) moneyPrefix = "$";
  function fmtMoney(n) {
    var v = Math.round(Number(n) || 0);
    var txt;
    try { txt = v.toLocaleString(moneyLocale); } catch (e) { txt = String(v); }
    return moneyPrefix + txt;
  }
  function fmtDelta(n) { return (n < 0 ? "− " : "+ ") + fmtMoney(Math.abs(n)); }
  // Días hábiles: asume semana laboral de LUNES a VIERNES (sábado y domingo
  // no cuentan). Si tu operación despacha otros días, ajusta aquí.
  function addBusinessDays(from, days) {
    var d = new Date(from.getTime());
    var added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      var wd = d.getDay();
      if (wd !== 0 && wd !== 6) added++;
    }
    return d;
  }
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // ── Datos base ────────────────────────────────────────────────────────────
  var productId = String(root.getAttribute("data-product-id") || "");
  var productSku = String(root.getAttribute("data-sku") || "");
  var productName = String(root.getAttribute("data-product-name") || "");
  var productImage = String(root.getAttribute("data-product-image") || "");
  // Sanear la URL del JSON: el editor puede guardar HTML enriquecido (<a href…>)
  // o una URL sin protocolo; nos quedamos con texto plano y forzamos https.
  function cleanUrl(raw) {
    var u = String(raw || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").trim();
    var m = u.match(/https?:\/\/[^\s"'<>]+/i);
    if (m) return m[0];
    u = u.split(/\s+/)[0] || "";
    if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
  }
  var kimosUrl = cleanUrl(root.getAttribute("data-kimos-url")) || cleanUrl(window.PP_KIMOS_URL || "");

  var productJsonEl = $("script.product-json");
  var variants = [];
  try {
    var parsed = productJsonEl ? JSON.parse(productJsonEl.textContent) : [];
    if (Array.isArray(parsed)) variants = parsed;
  } catch (e) { /* sin variantes: el fallback lo maneja */ }

  // Opciones nativas: desde los selects ocultos que emitió Liquid.
  // jsOptions = [{id, name, values: [{id, name}]}]
  var jsOptions = $all(".pp-variants-native select.prod-options").map(function (sel) {
    return {
      id: String(sel.getAttribute("data-optionid")),
      name: String(sel.getAttribute("data-optionname") || ""),
      el: sel,
      values: $all("option", sel).map(function (o) {
        return { id: String(o.value), name: String(o.getAttribute("data-name") || o.textContent || "") };
      }),
    };
  });

  // ── Estado ────────────────────────────────────────────────────────────────
  var producto = null;        // definición ProductLab del producto (o null → fallback)
  var groups = [];            // [{option (nativa), json (grupo ProductLab|null)}]
  var selection = {};         // optionId → valueId (nativo)
  var assemblyDays = 3;
  var deliveryMode = "max";   // 'max' = paralelo | 'sum' = en serie (dropshipping)
  var baseDeliveryDays = 0;   // días de los componentes base publicados por la app
  var noSteps = false;        // producto SIN pasos: compra directa (sin Configurar)
  var showDeltasMode = "delta";        // storefront.style.showDeltas: delta|total|none
  var stepsCollapsedDefault = false;   // storefront.style.stepsCollapsed

  // ── Pestañas ──────────────────────────────────────────────────────────────
  var activeTab = "landing";
  function activateTab(key, scrollTarget) {
    // Producto simple (sin pasos): no existe la pestaña Configurar — todo lo
    // que navegaría a ella agrega al carro directamente.
    if (key === "configurar" && noSteps) {
      var directCart = $("button#add-to-cart");
      if (directCart) directCart.click();
      return;
    }
    activeTab = key;
    // En Configurar la barra no muestra mini-foto/precio/Comprar (el panel
    // derecho ya trae foto y precio configurado).
    var barEl = $("[data-pp-bar]");
    if (barEl) barEl.classList.toggle("pp-in-config", key === "configurar");
    $all(".pp-tab").forEach(function (t) {
      t.classList.toggle("on", t.getAttribute("data-tab") === key && !t.getAttribute("data-scroll"));
    });
    $all(".pp-panel").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-panel") === key); });
    updateBar();
    if (scrollTarget) {
      // Scroll manual con offset: header + barra son fijos y scrollIntoView
      // dejaría el título del bloque tapado debajo de ellos.
      var target = $(scrollTarget);
      // Con el builder activo, la tabla de especificaciones vive dentro de la
      // lista de secciones: el ancla apunta a esa instancia.
      if (scrollTarget === "#pp-espec") {
        var inline = $("[data-pp-espec-inline]");
        if (inline) target = inline;
      }
      if (target) setTimeout(function () {
        var bar = $("[data-pp-bar]");
        var offset = (bar ? bar.getBoundingClientRect().bottom : 0) + 12;
        var y = target.getBoundingClientRect().top + (window.pageYOffset || 0) - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }, 30);
    } else {
      // Cambio de pestaña (incluye Configurar): siempre partir desde arriba.
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  // Títulos configurables (storefront.tabs): pestaña 1 = nombre del modelo.
  function applyTabLabels() {
    var tabs = (producto && producto.storefront && producto.storefront.tabs) || {};
    var labels = {
      explorar: tabs.explorar || productName,
      specs: tabs.specs || "Especificaciones",
      fotos: tabs.fotos || "Fotos",
      comprar: (tabs.comprar || (noSteps ? "Añadir al carro" : "Comprar")) + " →",
    };
    $all("[data-pp-tablabel]").forEach(function (t) {
      var key = t.getAttribute("data-pp-tablabel");
      if (labels[key]) t.textContent = labels[key];
    });
    // Visibilidad y orden de las pestañas (storefront.tabs.show*/order).
    var order = Array.isArray(tabs.order) ? tabs.order : ["explorar", "specs", "fotos"];
    var bar = $("[data-pp-bar]");
    if (bar) {
      $all(".pp-tab", bar).forEach(function (t) {
        var key = t.getAttribute("data-pp-tablabel");
        if (key === "comprar") { t.style.order = 99; return; }
        var idx = order.indexOf(key);
        t.style.order = String(idx === -1 ? 50 : idx + 1);
        if ((key === "specs" && tabs.showSpecs === false) || (key === "fotos" && tabs.showFotos === false)) {
          t.style.display = "none";
        }
      });
      var mini = $(".pp-bar-mini", bar);
      if (mini) mini.style.order = "98";
    }
  }
  // Barra: crece al hacer scroll dentro de Explorar/Especificaciones y revela
  // la mini-foto del producto + precio "desde" junto a Comprar.
  // Barra SIEMPRE fija (position:fixed, tamaño único, sin animaciones): el
  // placeholder reserva su espacio en el flujo y el top sigue al header real.
  var barPlaceholder = null;
  function updateBar() {
    var bar = $("[data-pp-bar]");
    if (!bar) return;
    // Punto de acoplamiento con el theme anfitrión: selector del header fijo.
    var hdr = document.querySelector("header, .theme-header, #header");
    var top = 0;
    if (hdr) {
      var pos = getComputedStyle(hdr).position;
      if (pos === "fixed" || pos === "sticky") {
        top = Math.max(0, Math.round(hdr.getBoundingClientRect().bottom));
      }
    }
    bar.style.setProperty("--pp-top", top + "px");
    if (!barPlaceholder) {
      barPlaceholder = document.createElement("div");
      barPlaceholder.setAttribute("data-pp-bar-ph", "");
      bar.parentNode.insertBefore(barPlaceholder, bar);
    }
    barPlaceholder.style.height = bar.offsetHeight + "px";
    updatePanelFix();
  }
  function updatePanelFix() {
    var panel = $(".pp-panel-box");
    var config = $(".pp-config");
    if (!panel || !config) return;
    if (window.innerWidth < 992 || activeTab !== "configurar") {
      panel.style.position = "";
      panel.style.top = "";
      panel.style.left = "";
      panel.style.width = "";
      panel.style.maxHeight = "";
      panel.style.overflowY = "";
      panel.style.zIndex = "";
      config.style.minHeight = "";
      return;
    }
    var bar = $("[data-pp-bar]");
    var barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
    var maxH = window.innerHeight - barBottom - 24;
    panel.style.maxHeight = maxH + "px";
    panel.style.overflowY = "auto";
    var panelH = Math.min(panel.offsetHeight, maxH);
    // La sección nunca es más corta que el panel (p. ej. con todos los pasos
    // colapsados): así el panel jamás invade el footer.
    config.style.minHeight = (panelH + 60) + "px";
    var rect = config.getBoundingClientRect();
    var top = barBottom + 12;
    // Tope inferior: al llegar al final de la sección, el panel se detiene en
    // su borde (comportamiento sticky) en vez de quedar bajo el footer.
    var maxTop = rect.bottom - panelH - 12;
    if (top > maxTop) top = maxTop;
    panel.style.position = "fixed";
    panel.style.top = top + "px";
    panel.style.left = (rect.right - 20 - 320) + "px"; // columna derecha del grid (320px + padding 20)
    panel.style.width = "320px";
    panel.style.zIndex = "10"; // sobre el footer, bajo la barra (z:11)
  }
  window.addEventListener("scroll", updateBar, { passive: true });
  window.addEventListener("resize", updateBar, { passive: true });
  updateBar();
  $all(".pp-tab").forEach(function (t) {
    t.addEventListener("click", function () { activateTab(t.getAttribute("data-tab"), t.getAttribute("data-scroll")); });
  });
  $all("[data-pp-goto]").forEach(function (b) {
    b.addEventListener("click", function () { activateTab(b.getAttribute("data-pp-goto")); });
  });

  // ── EXPLORAR: hero ────────────────────────────────────────────────────────
  // Item (+): botón que despliega su texto EN FLUJO (compartido por el hero
  // clásico y los heros del builder).
  function makeItem(it) {
    var item = el("div", "pp-hero-item");
    var btn = el("button", "pp-hero-item-btn");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="plus" aria-hidden="true">+</span><span>' + esc(it.title) + "</span>";
    btn.addEventListener("click", function () {
      // Cada item abre/cierra independiente: el texto va EN FLUJO dentro de
      // la columna de items, así los abiertos se empujan y no se solapan.
      var open = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    item.appendChild(btn);
    if (it.text) item.appendChild(el("div", "pp-hero-item-text", esc(it.text)));
    return item;
  }

  // ── Heros del BUILDER (storefront.pageSections): patrones flexbox ────────
  // Celda: string (flex 1) u objeto {id, flex} para columnas con peso.
  var HB_PATTERNS = {
    clasico: [["top"], ["left", "center", "right"], ["bottom"]],
    columnas: [["top"], ["left", "right"], ["bottom"]],
    apilado: [["top"], ["middle"], ["bottom"]],
    mosaico: [["top"], ["tl", "tr"], ["bl", "br"], ["bottom"]],
    banda: [["left", "right"]],
    tercios: [["a", "b", "c"]],
    "sidebar-izq": [[{ id: "side", flex: 1 }, { id: "main", flex: 2.2 }]],
    "sidebar-der": [[{ id: "main", flex: 2.2 }, { id: "side", flex: 1 }]],
    filas: [["r1"], ["r2"]],
    destacado: [["top"], ["main"], ["f1", "f2", "f3"]],
    mosaico23: [["a", "b", "c"], ["d", "e", "f"]],
    galeria: [["top"], [{ id: "big", flex: 2.2 }, { id: "side", flex: 1 }], ["bottom"]],
  };
  function hbCellId(c) { return typeof c === "string" ? c : c.id; }
  function hbCellFlex(c) { return typeof c === "string" ? 1 : (c.flex || 1); }
  function galleryUrls() {
    return $all(".pp-fotos .pp-foto img").map(function (im) { return im.getAttribute("src") || ""; });
  }
  function heroTextColor(hx) {
    if (hx.textColor) return hx.textColor;
    if (hx.bgImageUrl) return "#fff";
    if (hx.bgColor) return isDarkColor(hx.bgColor) ? "#fff" : "#1D1D1B";
    return "#fff"; // fondo oscuro del sistema por defecto
  }
  function renderHeroBlock(b) {
    if (!b || !b.type) return null;
    if (b.type === "photo") {
      var ph = el("div", "pp-hz-photo");
      // size acepta también 'auto': alto natural de la imagen (sin max-height).
      ph.setAttribute("data-size", b.size || "m");
      if (b.anim && b.anim !== "none") ph.setAttribute("data-anim", b.anim);
      var src = (producto && producto.imageUrl) || productImage;
      if (src) ph.innerHTML = '<img data-pp-photo src="' + esc(src) + '" alt="' + esc(productName) + '">';
      return ph;
    }
    if (b.type === "title") {
      return el("div", "pp-hz-title",
        "<h1>" + esc(productName) + "</h1>" +
        (productSku ? '<div class="pp-hero-sku">SKU · ' + esc(productSku) + "</div>" : ""));
    }
    if (b.type === "text") {
      if (!b.text) return null;
      var tx = el("div", "pp-hb-text", esc(b.text));
      tx.setAttribute("data-size", b.size || "l");
      if (b.color) tx.style.color = b.color;
      return tx;
    }
    if (b.type === "items") {
      var its = (b.items || []).filter(function (it) { return it && it.title; });
      if (!its.length) return null;
      var col = el("div", "pp-hz-items pp-hb-items");
      if (b.float === false) col.setAttribute("data-float", "0");
      its.forEach(function (it) { col.appendChild(makeItem(it)); });
      return col;
    }
    if (b.type === "cta") {
      var wrap = el("div", "pp-hz-cta");
      var btn = el("button", "pp-btn " + (b.style === "dark" ? "pp-btn-dark" : b.style === "ghost" ? "pp-btn-ghost" : "pp-btn-primary"), esc(b.label || (noSteps ? "Añadir al carro" : "Configurar")));
      btn.type = "button";
      btn.addEventListener("click", function () {
        if (b.action === "url" && b.url) window.location.href = b.url;
        else activateTab("configurar");
      });
      wrap.appendChild(btn);
      return wrap;
    }
    if (b.type === "icons") {
      var items2 = (b.items || []).filter(function (it) { return it && (it.title || it.icon); });
      if (!items2.length) return null;
      var grid = el("div", "pp-hb-icons");
      items2.forEach(function (it) {
        grid.appendChild(el("div", "item",
          (it.icon ? '<span class="icon">' + esc(it.icon) + "</span>" : "") +
          "<b>" + esc(it.title) + "</b>" + (it.text ? "<span>" + esc(it.text) + "</span>" : "")));
      });
      return grid;
    }
    if (b.type === "specs") {
      var specs = ((producto && producto.storefront && producto.storefront.specs) || []).slice(0, Number(b.count) || 4);
      if (!specs.length) return null;
      var table = el("table", "pp-hb-specs");
      specs.forEach(function (sp) {
        var tr = el("tr");
        tr.innerHTML = '<td class="label">' + esc(sp.label) + "</td><td>" + esc(sp.value) + "</td>";
        table.appendChild(tr);
      });
      return table;
    }
    if (b.type === "gallery") {
      var urls = galleryUrls();
      var src2 = urls[Math.max(0, (Number(b.index) || 1) - 1)] || productImage;
      if (!src2) return null;
      var g = el("div", "pp-hb-gallery");
      // size 'auto' = alto natural (sin max-height).
      if (b.size) g.setAttribute("data-size", b.size);
      g.innerHTML = '<img loading="lazy" src="' + esc(src2) + '" alt="' + esc(productName) + '">';
      return g;
    }
    if (b.type === "html") {
      if (!b.html) return null;
      var hbox = el("div", "pp-hb-html");
      hbox.innerHTML = b.html; // HTML del administrador (campo de la app)
      return hbox;
    }
    return null;
  }
  function buildHeroBox(hx, i) {
    var box = el("div", "pp-hero pp-hb");
    // Escalonado: los items desplegados de un hero desbordan SOBRE la sección
    // siguiente (z decreciente, siempre bajo la barra fija z:11).
    box.style.zIndex = String(Math.max(1, 9 - i));
    // height acepta también 'auto' (alto natural, min-height chica vía CSS).
    box.setAttribute("data-height", hx.height || "m");
    if (hx.bgColor) box.style.background = hx.bgColor;
    if (hx.bgImageUrl) {
      box.style.backgroundImage = "url('" + hx.bgImageUrl.replace(/'/g, "%27") + "')";
      if (hx.overlay !== false) box.setAttribute("data-overlay", "1");
    }
    var rowsDef = HB_PATTERNS[hx.pattern] || HB_PATTERNS.clasico;
    var flex = el("div", "pp-hz pp-hb-rows");
    flex.style.color = heroTextColor(hx);
    rowsDef.forEach(function (row) {
      var rowEl = el("div", "pp-hb-row");
      rowEl.setAttribute("data-cols", String(row.length));
      var any = false;
      row.forEach(function (cell) {
        var cellEl = el("div", "pp-hb-cell");
        cellEl.style.flex = String(hbCellFlex(cell));
        (((hx.slots || {})[hbCellId(cell)]) || []).forEach(function (b) {
          var node = renderHeroBlock(b);
          if (node) {
            // Alineación horizontal del bloque dentro del contenedor.
            if (b.align === "left" || b.align === "right") {
              node.style.alignSelf = b.align === "left" ? "flex-start" : "flex-end";
            }
            node.style.textAlign = b.align || "center";
            cellEl.appendChild(node);
            any = true;
          }
        });
        rowEl.appendChild(cellEl);
      });
      if (any) flex.appendChild(rowEl); // fila sin contenido no ocupa espacio
    });
    box.appendChild(flex);
    return box;
  }

  // ── URL del gateway AR: la URL del JSON (…/definition) con el sufijo
  //    reemplazado por /ar/{sku|productId}.glb (la app sirve el GLB ahí). ──
  function arGatewayUrl() {
    var m = producto && producto.model3d;
    if (!m || !m.arUrl || !kimosUrl) return "";
    var key = productSku || (producto && producto.sku) || productId;
    if (!key) return "";
    if (!/\/definition\/?(\?|$)/.test(kimosUrl)) return "";
    return kimosUrl.replace(/\/definition\/?(\?.*)?$/, "/ar/" + encodeURIComponent(key) + ".glb");
  }

  // Secciones del builder: heros + imágenes + visor 3D + tabla de
  // especificaciones + nota, en el orden definido en la app
  // (storefront.pageSections; los JSON antiguos con storefront.heroes se
  // convierten al vuelo).
  function builderSections() {
    var sf = (producto && producto.storefront) || {};
    if (Array.isArray(sf.pageSections) && sf.pageSections.length) return sf.pageSections;
    if (Array.isArray(sf.heroes) && sf.heroes.length) {
      return sf.heroes.map(function (x) { return Object.assign({ kind: "hero" }, x); })
        .concat([{ kind: "specs", show: true }, { kind: "note", show: true }]);
    }
    return [];
  }
  function sectionHasBlocks(hx) {
    return hx.slots && Object.keys(hx.slots).some(function (k) { return (hx.slots[k] || []).length; });
  }
  // ¿La sección aporta contenido propio que activa el builder?
  function sectionActivates(sec) {
    if (!sec) return false;
    if (sec.kind === "hero" && sectionHasBlocks(sec)) return true;
    if (sec.kind === "imagen" && sec.imageUrl) return true;
    if (sec.kind === "visor3d") {
      var m = producto && producto.model3d;
      return !!(m && m.enabled === true && m.embedUrl);
    }
    return false;
  }
  function renderBuilder(host, secs) {
    host.innerHTML = "";
    var i = 0;
    secs.forEach(function (sec) {
      if (!sec) return;
      if (sec.kind === "specs") {
        if (sec.show === false) return;
        var sbox = el("div", "pp-specs pp-specs-inline");
        sbox.setAttribute("data-pp-espec-inline", "");
        renderSpecsInto(sbox);
        host.appendChild(sbox);
        return;
      }
      if (sec.kind === "fotos") {
        // El bloque de fotos (Liquid) se MUEVE a su posición en la lista de
        // secciones; oculto si show=false. El ancla #pp-fotos sigue vigente.
        var fb = $("#pp-fotos");
        if (!fb) return;
        if (sec.show === false) { fb.style.display = "none"; return; }
        host.appendChild(fb);
        return;
      }
      if (sec.kind === "note") {
        if (sec.show === false) return;
        var note = (producto.storefront && producto.storefront.photosNote) || "";
        if (!note) return;
        var nbox = el("div", "pp-fotos-note pp-note-inline");
        nbox.textContent = note;
        host.appendChild(nbox);
        return;
      }
      if (sec.kind === "imagen") {
        // Una <img> a lo ancho con su ALTO NATURAL (height:auto, sin
        // recortes). width 'full' = borde a borde del viewport (CSS con
        // margin-inline calc); 'content' = ancho del contenido. Repetible:
        // varias seguidas, cada una con su altura.
        if (!sec.imageUrl) return;
        var ibox = el("div", "pp-imagen");
        ibox.setAttribute("data-width", sec.width === "full" ? "full" : "content");
        var imHtml = '<img loading="lazy" src="' + esc(sec.imageUrl) + '" alt="' + esc(sec.alt || productName) + '">';
        ibox.innerHTML = sec.link ? '<a href="' + esc(sec.link) + '">' + imHtml + "</a>" : imHtml;
        host.appendChild(ibox);
        return;
      }
      if (sec.kind === "visor3d") {
        // Visor 3D embebido (model3d.embedUrl). Sin model3d habilitado, la
        // sección se omite en silencio.
        var m3 = producto && producto.model3d;
        if (!m3 || m3.enabled !== true || !m3.embedUrl) return;
        var h = Math.max(240, Math.min(900, Number(sec.height) || 480));
        var vbox = el("div", "pp-visor3d");
        vbox.innerHTML = '<iframe src="' + esc(m3.embedUrl) + '" style="width:100%;height:' + h + 'px;border:0;display:block" loading="lazy" allowfullscreen title="' + esc("Visor 3D — " + productName) + '"></iframe>';
        var ar = arGatewayUrl();
        if (ar) {
          var arLink = el("a", "pp-ar-link", "Ver en tu espacio (AR)");
          arLink.setAttribute("href", ar);
          arLink.setAttribute("rel", "noopener");
          vbox.appendChild(arLink);
        }
        host.appendChild(vbox);
        return;
      }
      if (!sectionHasBlocks(sec)) return;
      host.appendChild(buildHeroBox(sec, i++));
    });
  }

  var builderOn = false; // true cuando el producto usa el builder de secciones
  function renderHero() {
    var host = $("[data-pp-hero]");
    if (!host) return;
    // Builder de descripción: si hay al menos una sección con contenido
    // propio (hero con bloques, imagen o visor 3D), se pinta la lista de
    // secciones en su orden y el hero clásico + specs/nota independientes se
    // ignoran.
    var secs = builderSections();
    builderOn = secs.some(sectionActivates);
    if (builderOn) { renderBuilder(host, secs); return; }
    var sf = (producto && producto.storefront) || {};
    var hero = sf.hero || {};
    var photo = (producto && producto.imageUrl) || productImage;

    var box = el("div", "pp-hero");
    box.setAttribute("data-pos", hero.photoPos || "center");
    box.setAttribute("data-valign", hero.photoVAlign || "center");
    // photoSize/height aceptan también 'auto' (alto natural, vía CSS).
    box.setAttribute("data-size", hero.photoSize || "m");
    box.setAttribute("data-height", hero.height || "m");
    box.setAttribute("data-photoanim", hero.photoAnim || "none");
    box.setAttribute("data-titleh", hero.titleH || "left");
    box.setAttribute("data-titlev", hero.titleV || "top");
    box.setAttribute("data-float", hero.float === false ? "0" : "1");
    if (hero.bgImageUrl) box.style.backgroundImage = "url('" + hero.bgImageUrl.replace(/'/g, "%27") + "')";

    // ── Estructura FLEXBOX: título / main / botón, cada uno en su contenedor
    //    (nada absoluto → sin solapes; en móvil se apila en orden predecible).
    var layout = ["left", "right", "stack"].indexOf(hero.layout) !== -1 ? hero.layout : "center";
    var flex = el("div", "pp-hz");

    var title = el("div", "pp-hz-title",
      "<h1>" + esc(productName) + "</h1>" +
      (productSku ? '<div class="pp-hero-sku">SKU · ' + esc(productSku) + "</div>" : ""));
    if (hero.titleColor) title.style.color = hero.titleColor;
    if (hero.headline) {
      title.appendChild(el("div", "pp-hero-headline", esc(hero.headline)));
    }

    var items = (Array.isArray(hero.items) ? hero.items : []).filter(function (it) { return it && it.title; });

    var photoBox = el("div", "pp-hz-photo");
    if (photo) photoBox.innerHTML = '<img data-pp-photo src="' + esc(photo) + '" alt="' + esc(productName) + '">';

    var main = el("div", "pp-hz-main");
    main.setAttribute("data-lay", layout);
    if (layout === "stack") {
      main.appendChild(photoBox);
      var rowItems = el("div", "pp-hz-items");
      items.forEach(function (it) { rowItems.appendChild(makeItem(it)); });
      if (items.length) main.appendChild(rowItems);
    } else if (layout === "left" || layout === "right") {
      var side = el("div", "pp-hz-side");
      items.forEach(function (it) { side.appendChild(makeItem(it)); });
      if (layout === "left") { main.appendChild(photoBox); if (items.length) main.appendChild(side); }
      else { if (items.length) main.appendChild(side); main.appendChild(photoBox); }
    } else {
      var leftCol = el("div", "pp-hz-items left");
      var rightCol = el("div", "pp-hz-items right");
      var autoFlip = false;
      items.forEach(function (it) {
        var side2 = it.side === "left" || it.side === "right" ? it.side : (autoFlip = !autoFlip, autoFlip ? "left" : "right");
        (side2 === "left" ? leftCol : rightCol).appendChild(makeItem(it));
      });
      if (leftCol.children.length) main.appendChild(leftCol);
      main.appendChild(photoBox);
      if (rightCol.children.length) main.appendChild(rightCol);
    }

    var ctaWrap = el("div", "pp-hz-cta");
    var b1 = el("button", "pp-btn pp-btn-primary", esc(hero.ctaText || (noSteps ? "Añadir al carro" : "Configurar")) + " →");
    b1.type = "button";
    b1.addEventListener("click", function () { activateTab("configurar"); });
    ctaWrap.appendChild(b1);

    // Orden vertical: título arriba (default) o después del main.
    if (hero.titleV === "bottom") { flex.appendChild(main); flex.appendChild(title); }
    else { flex.appendChild(title); flex.appendChild(main); }
    flex.appendChild(ctaWrap);
    box.appendChild(flex);

    host.innerHTML = "";
    host.appendChild(box);
  }

  // ── CONFIGURAR: motor de compatibilidades ─────────────────────────────────
  // Un valor es visible si sus `requires` se satisfacen con los `tags` de los
  // valores seleccionados en los OTROS pasos, y ningún `excludes` choca.
  function jsonValueFor(group, valueName) {
    if (!group.json) return null;
    for (var i = 0; i < group.json.values.length; i++) {
      if (norm(group.json.values[i].name) === norm(valueName)) return group.json.values[i];
    }
    return null;
  }
  function selectedJsonValues(exceptOptionId) {
    var out = [];
    groups.forEach(function (g) {
      if (String(g.option.id) === String(exceptOptionId)) return;
      var valId = selection[g.option.id];
      var nat = g.option.values.filter(function (v) { return v.id === valId; })[0];
      var jv = nat && jsonValueFor(g, nat.name);
      if (jv) out.push(jv);
    });
    return out;
  }
  function isValueVisible(group, nativeValue) {
    var jv = jsonValueFor(group, nativeValue.name);
    if (!jv) return true; // sin datos de la app → no se filtra
    var others = selectedJsonValues(group.option.id);
    var tags = {};
    others.forEach(function (v) { (v.tags || []).forEach(function (t) { tags[norm(t)] = 1; }); });
    var i;
    for (i = 0; i < (jv.requires || []).length; i++) {
      if (!tags[norm(jv.requires[i])]) return false;
    }
    for (i = 0; i < (jv.excludes || []).length; i++) {
      if (tags[norm(jv.excludes[i])]) return false;
    }
    return true;
  }

  // ── Pasos condicionales (dependsOn, JSON version 2) ──────────────────────
  // Un paso con json.dependsOn: {groupId, valueIds} solo se muestra si la
  // selección actual del paso `groupId` (id del grupo en el JSON) está entre
  // `valueIds` (ids de valores del JSON). Sin datos suficientes → visible
  // (degradación elegante con JSON version 1).
  function jsonSelectedValue(g) {
    var nat = g.option.values.filter(function (v) { return v.id === selection[g.option.id]; })[0];
    return (nat && jsonValueFor(g, nat.name)) || null;
  }
  function isGroupVisible(g) {
    var d = g.json && g.json.dependsOn;
    if (!d || !d.groupId || !((d.valueIds || []).length)) return true;
    var parent = null;
    groups.forEach(function (x) {
      if (!parent && x.json && String(x.json.id) === String(d.groupId)) parent = x;
    });
    if (!parent || parent === g) return true;
    var jv = jsonSelectedValue(parent);
    if (!jv) return true;
    return d.valueIds.map(String).indexOf(String(jv.id)) !== -1;
  }
  function defaultNativeValue(g) {
    if (g.json) {
      var defJson = g.json.values.filter(function (v) { return v.isDefault; })[0];
      if (defJson) {
        var nat = g.option.values.filter(function (v) { return norm(v.name) === norm(defJson.name); })[0];
        if (nat) return nat;
      }
    }
    return g.option.values[0] || null;
  }
  // Un paso oculto FUERZA su selección al valor por defecto: el select nativo
  // queda sincronizado con ese default y el matching de variante funciona.
  // Itera hasta estabilizar (cadenas de dependencias entre pasos).
  function enforceHiddenDefaults(adjusted) {
    for (var pass = 0; pass <= groups.length; pass++) {
      var changed = false;
      groups.forEach(function (g) {
        if (isGroupVisible(g)) return;
        var def = defaultNativeValue(g);
        if (def && selection[g.option.id] !== def.id) {
          selection[g.option.id] = def.id;
          changed = true;
          if (adjusted) adjusted.push((g.json ? g.json.label : g.option.name) + " → " + def.name);
        }
      });
      if (!changed) break;
    }
  }

  // ── Variante actual (precio y stock reales de Jumpseller) ────────────────
  function variantForSelection(selMap) {
    var ids = groups.map(function (g) { return String(selMap[g.option.id] || ""); });
    for (var i = 0; i < variants.length; i++) {
      var entry = variants[i];
      var vals = (entry.values || []).map(function (x) { return String(x.value && x.value.id); });
      if (vals.length !== ids.length) continue;
      var all = true;
      for (var j = 0; j < vals.length; j++) if (ids.indexOf(vals[j]) === -1) { all = false; break; }
      if (all) return entry.variant;
    }
    return null;
  }
  function currentVariant() { return variantForSelection(selection); }
  function variantPriceVal(v) {
    if (!v) return null;
    if (v.price_with_discount != null) return Number(v.price_with_discount);
    return (Number(v.price) || 0) - (Number(v.discount) || 0);
  }

  // ── Render de pasos ───────────────────────────────────────────────────────
  var collapsedSteps = {}; // optionId → true (paso colapsado por el usuario)
  var noticeTimer = null;
  function showNotice(text) {
    var n = $("[data-pp-notice]");
    if (!n) return;
    n.textContent = text;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { n.textContent = ""; }, 5000);
  }

  function setSelection(optionId, valueId, silent) {
    selection[optionId] = String(valueId);
    // Reajuste: si otra selección quedó invisible con el cambio, moverla al
    // primer valor visible de su paso y avisar.
    var adjusted = [];
    groups.forEach(function (g) {
      var current = g.option.values.filter(function (v) { return v.id === selection[g.option.id]; })[0];
      if (current && !isValueVisible(g, current)) {
        var firstVisible = g.option.values.filter(function (v) { return isValueVisible(g, v); })[0];
        if (firstVisible) {
          selection[g.option.id] = firstVisible.id;
          adjusted.push((g.json ? g.json.label : g.option.name) + " → " + firstVisible.name);
        }
      }
    });
    // Re-evaluar visibilidad de pasos (dependsOn): los pasos que quedaron
    // ocultos vuelven a su valor por defecto (con aviso, como las
    // compatibilidades).
    enforceHiddenDefaults(adjusted);
    if (!silent && adjusted.length) showNotice("Se ajustó la configuración: " + adjusted.join(" · "));
    syncNativeSelects();
    renderSteps();
    renderPanel();
  }

  function syncNativeSelects() {
    groups.forEach(function (g) {
      var sel = g.option.el;
      var val = selection[g.option.id];
      if (sel && val != null && sel.value !== val) {
        sel.value = val;
        // El theme (Jumpseller.productVariantListener) escucha 'change' vía
        // jQuery; el evento nativo burbujea igual hacia esos handlers.
        try {
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (e) { /* IE-like: sin soporte, el add-to-cart lee el value igual */ }
      }
    });
  }

  function renderSteps() {
    var host = $("[data-pp-steps]");
    if (!host) return;
    host.innerHTML = "";
    var stepNum = 0; // numeración solo de pasos visibles
    groups.forEach(function (g) {
      if (!isGroupVisible(g)) return; // paso condicional oculto (dependsOn)
      var visibles = g.option.values.filter(function (v) { return isValueVisible(g, v); });
      if (!visibles.length) return;
      stepNum++;
      var step = el("div", "pp-step");
      var collapsed = !!collapsedSteps[g.option.id];
      if (collapsed) step.classList.add("pp-step-collapsed");
      var label = g.json ? g.json.label : g.option.name;
      // Título clickeable: colapsa/expande el paso; colapsado muestra la
      // selección actual como referencia.
      var selNat = g.option.values.filter(function (v) { return v.id === selection[g.option.id]; })[0];
      var titleEl = el("h2", "pp-step-title",
        '<span class="num">PASO ' + String(stepNum).padStart(2, "0") + " /</span> " + esc(label) +
        (collapsed && selNat ? ' <span class="pp-step-sel">· ' + esc(selNat.name) + "</span>" : "") +
        ' <span class="pp-step-caret" aria-hidden="true">' + (collapsed ? "▸" : "▾") + "</span>");
      titleEl.addEventListener("click", function () {
        collapsedSteps[g.option.id] = !collapsedSteps[g.option.id];
        renderSteps();
      });
      step.appendChild(titleEl);
      var grid = el("div", "pp-cards");
      visibles.forEach(function (v) {
        var jv = jsonValueFor(g, v.name);
        var on = selection[g.option.id] === v.id;
        var card = el("div", "pp-card" + (on ? " on" : "") + (jv && jv.neutral === true ? " pp-card-neutral" : ""));
        card.setAttribute("role", "radio");
        card.setAttribute("aria-checked", on ? "true" : "false");
        card.tabIndex = 0;

        var img = el("div", "pp-card-img");
        if (jv && jv.imageUrl) img.innerHTML = '<img loading="lazy" src="' + esc(jv.imageUrl) + '" alt="' + esc(v.name) + '">';
        else img.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>';
        card.appendChild(img);

        var body = el("div", "pp-card-body");
        // qty informativa (el nombre ya debería decirlo, ej. "2×8GB"): se
        // muestra un multiplicador discreto junto al nombre cuando qty > 1.
        var qty = jv && Number(jv.qty) > 1 ? Number(jv.qty) : 0;
        body.appendChild(el("span", "pp-card-name",
          esc(v.name) + (qty ? ' <span class="pp-card-qty">×' + qty + "</span>" : "")));
        if (jv && jv.desc) body.appendChild(el("span", "pp-card-desc", esc(jv.desc)));
        card.appendChild(body);

        // Precio en la card según storefront.style.showDeltas:
        //   'delta' (default): variación RELATIVA a la selección actual (la
        //     card elegida no muestra nada; el borde ya la marca).
        //   'total': precio ABSOLUTO de la variante candidata al elegirla.
        //   'none': sin precio en las cards.
        if (showDeltasMode === "none") {
          // sin celda de precio
        } else if (showDeltasMode === "total") {
          var candSel = {};
          for (var ck0 in selection) candSel[ck0] = selection[ck0];
          candSel[g.option.id] = v.id;
          var totalP = variantPriceVal(variantForSelection(candSel));
          card.appendChild(el("div", "pp-card-price total", totalP != null ? fmtMoney(totalP) : ""));
        } else {
          var diff = null;
          if (on) diff = 0;
          else {
            if (variants.length) {
              var curP = variantPriceVal(currentVariant());
              var cand = {};
              for (var ck in selection) cand[ck] = selection[ck];
              cand[g.option.id] = v.id;
              var candP = variantPriceVal(variantForSelection(cand));
              if (curP != null && candP != null) diff = candP - curP;
            }
            if (diff == null && jv) {
              var selNat2 = g.option.values.filter(function (x) { return x.id === selection[g.option.id]; })[0];
              var selJv = selNat2 && jsonValueFor(g, selNat2.name);
              diff = Number(jv.delta || 0) - Number((selJv && selJv.delta) || 0);
            }
          }
          card.appendChild(el("div", "pp-card-price delta",
            !on && diff != null && diff !== 0 ? fmtDelta(diff) : ""));
        }

        function pick() { if (!on) setSelection(g.option.id, v.id); }
        card.addEventListener("click", pick);
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
        });
        grid.appendChild(card);
      });
      step.appendChild(grid);
      host.appendChild(step);
    });
  }

  // ── Panel: precio (variante), entrega, resumen, stock ─────────────────────
  function renderPanel() {
    var variant = variants.length ? currentVariant() : null;
    var priceEl = $("[data-pp-price]");
    if (priceEl && variants.length) {
      if (variant) {
        var p = (Number(variant.price) || 0) - (Number(variant.discount) || 0);
        if (variant.price_with_discount != null) p = Number(variant.price_with_discount);
        priceEl.textContent = fmtMoney(p);
      } else {
        priceEl.textContent = "—";
      }
    }

    // 'max': manda el componente más lento (llegan en paralelo).
    // 'sum': dropshipping — producto internacional + logística local en serie,
    // los días se SUMAN (incluye los componentes base vía baseDeliveryDays).
    // Los pasos ocultos (dependsOn) aportan su default: también se compran.
    var selDays = baseDeliveryDays;
    groups.forEach(function (g) {
      var nat = g.option.values.filter(function (v) { return v.id === selection[g.option.id]; })[0];
      var jv = nat && jsonValueFor(g, nat.name);
      var dDays = jv ? (Number(jv.deliveryDays) || 0) : 0;
      selDays = deliveryMode === "sum" ? selDays + dDays : Math.max(selDays, dDays);
    });
    var totalDays = selDays + assemblyDays;
    var delEl = $("[data-pp-delivery]");
    if (delEl) {
      if (producto) {
        var eta = addBusinessDays(new Date(), totalDays);
        delEl.innerHTML = '<span class="pp-del-pre">Entrega estimada: </span>' + totalDays + " días hábiles (aprox. " + eta.getDate() + " de " + MONTHS[eta.getMonth()] + ")";
      } else delEl.textContent = "";
    }

    var sumEl = $("[data-pp-summary]");
    if (sumEl) {
      // El resumen solo lista los pasos VISIBLES (los ocultos van en su
      // default y no son una decisión del comprador).
      sumEl.innerHTML = groups.filter(isGroupVisible).map(function (g) {
        var nat = g.option.values.filter(function (v) { return v.id === selection[g.option.id]; })[0];
        return "<div>· " + esc(g.json ? g.json.label : g.option.name) + ": <b>" + esc(nat ? nat.name : "—") + "</b></div>";
      }).join("");
    }

    // Sin variantes (producto aún no aplicado desde la app): no bloquear la
    // compra estándar; el precio Liquid inicial queda tal cual.
    if (!variants.length) return;
    updatePhotos();
    renderSwatches();
    var btn = $("button#add-to-cart");
    var stockEl = $("[data-pp-stockmsg]");
    var buyable = !!variant && (variant.stock_unlimited || variant.stock > 0) && variant.status !== "not-available";
    if (btn) btn.disabled = !buyable;
    // Espejo del estado en el botón de la barra (pestaña Configurar).
    var barCart = $(".pp-bar-cart");
    if (barCart) barCart.disabled = !buyable;
    if (stockEl) stockEl.textContent = variant && !buyable ? "Esta combinación no está disponible por ahora." : (!variant ? "Combinación no disponible." : "");
  }

  // ── Precio "Desde" de la barra: la variante MÁS BARATA real ──────────────
  // Liquid pinta la primera variante, que es la configuración por defecto y
  // no necesariamente la mínima; con el product-json ya parseado corregimos.
  function updateMiniPrice() {
    if (!variants.length) return;
    var min = Infinity;
    variants.forEach(function (entry) {
      var v = entry.variant || {};
      var p = v.price_with_discount != null
        ? Number(v.price_with_discount)
        : (Number(v.price) || 0) - (Number(v.discount) || 0);
      if (p > 0 && p < min) min = p;
    });
    if (!isFinite(min)) return;
    $all(".pp-bar-mini-price").forEach(function (box) {
      var small = box.querySelector("small");
      box.textContent = fmtMoney(min);
      if (small) box.insertBefore(small, box.firstChild);
    });
  }

  // ── Foto del producto según selección (pasos con affectsPhoto: color) ─────
  function currentPhoto() {
    var photo = "";
    groups.forEach(function (g) {
      if (!g.json || g.json.affectsPhoto !== true) return;
      var nat = g.option.values.filter(function (v) { return v.id === selection[g.option.id]; })[0];
      var jv = nat && jsonValueFor(g, nat.name);
      if (jv && jv.imageUrl) photo = jv.imageUrl;
    });
    return photo || (producto && producto.imageUrl) || productImage;
  }
  function updatePhotos() {
    var src = currentPhoto();
    if (!src) return;
    $all("[data-pp-photo]").forEach(function (img) {
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    });
  }

  // ── Swatches de color bajo la foto del hero (paso con affectsPhoto) ──────
  function renderSwatches() {
    var heroBox = $(".pp-hz-photo") || $(".pp-hero");
    if (!heroBox) return;
    var prev = $(".pp-hero-swatches");
    if (prev) prev.remove();
    var g = null;
    groups.forEach(function (x) { if (!g && x.json && x.json.affectsPhoto === true && isGroupVisible(x)) g = x; });
    if (!g) return;
    var wrap = el("div", "pp-hero-swatches");
    g.option.values.forEach(function (nat) {
      if (!isValueVisible(g, nat)) return;
      var jv = jsonValueFor(g, nat.name);
      var b = el("button", "pp-swatch" + (selection[g.option.id] === nat.id ? " on" : ""));
      b.type = "button";
      b.title = nat.name;
      b.setAttribute("aria-label", "Color " + nat.name);
      if (jv && jv.swatchColor) b.style.background = jv.swatchColor;
      else if (jv && jv.imageUrl) b.style.backgroundImage = "url('" + jv.imageUrl.replace(/'/g, "%27") + "')";
      else b.style.background = "#DDDDDD";
      b.addEventListener("click", function () { setSelection(g.option.id, nat.id); });
      wrap.appendChild(b);
    });
    if (wrap.children.length > 1) heroBox.appendChild(wrap);
  }

  // isDarkColor: contraste automático de texto sobre fondos de sección.
  function isDarkColor(hex) {
    var m = String(hex || "").replace("#", "");
    if (m.length === 3) m = m.replace(/./g, function (c) { return c + c; });
    if (!/^[0-9a-f]{6}$/i.test(m)) return false;
    var r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }

  // ── Estilo del configurador (storefront.style, JSON version 2) ───────────
  // accentColor → --pp-accent · bgColor → --pp-bg · radius → --pp-radius ·
  // cardStyle → clases pp-cards-list/pp-cards-compact · showDeltas y
  // stepsCollapsed → estado del render. Vacío = colores del theme del sitio.
  function applyStyle() {
    var st = (producto && producto.storefront && producto.storefront.style) || {};
    if (st.accentColor) root.style.setProperty("--pp-accent", st.accentColor);
    if (st.bgColor) root.style.setProperty("--pp-bg", st.bgColor);
    var radius = Math.max(0, Math.min(24, Number(st.radius) || 0));
    if (radius) root.style.setProperty("--pp-radius", radius + "px");
    root.classList.remove("pp-cards-list", "pp-cards-compact");
    if (st.cardStyle === "list") root.classList.add("pp-cards-list");
    if (st.cardStyle === "compact") root.classList.add("pp-cards-compact");
    showDeltasMode = st.showDeltas === "total" || st.showDeltas === "none" ? st.showDeltas : "delta";
    stepsCollapsedDefault = st.stepsCollapsed === true;
  }

  // ── ESPECIFICACIONES ──────────────────────────────────────────────────────
  function renderSpecs() {
    var host = $("[data-pp-specs]");
    if (!host) return;
    renderSpecsInto(host);
  }
  function renderSpecsInto(host) {
    var specs = (producto && producto.storefront && producto.storefront.specs) || [];
    var tabsCfg = (producto && producto.storefront && producto.storefront.tabs) || {};
    host.innerHTML = "";
    host.appendChild(el("div", "pp-specs-heading", esc(tabsCfg.specs || "Especificaciones")));
    if (!specs.length) {
      host.appendChild(el("div", "pp-specs-empty", "Especificaciones disponibles próximamente."));
      return;
    }
    var byGroup = {};
    var order = [];
    specs.forEach(function (sp) {
      var gname = sp.group || "";
      if (!byGroup[gname]) { byGroup[gname] = []; order.push(gname); }
      byGroup[gname].push(sp);
    });
    order.forEach(function (gname) {
      if (gname) host.appendChild(el("div", "pp-specs-group", esc(gname)));
      var table = el("table");
      byGroup[gname].forEach(function (sp) {
        var tr = el("tr");
        tr.innerHTML = '<td class="label">' + esc(sp.label) + "</td><td>" + esc(sp.value) + "</td>";
        table.appendChild(tr);
      });
      host.appendChild(table);
    });
  }

  // ── Fotos: visor EN LÍNEA (no modal) + nota al pie ───────────────────────
  // Clic en una miniatura → la foto se muestra más grande sobre la grilla
  // (zoom acotado por CSS, nunca a pantalla completa); clic en la misma
  // miniatura o en ✕ cierra. Flechas/Escape y swipe táctil navegan.
  function initFotos() {
    var grid = $("[data-pp-fotos-grid]") || $(".pp-fotos");
    if (!grid) return;
    var fotos = $all(".pp-foto", grid);
    if (!fotos.length) return;
    var urls = fotos.map(function (a) { return a.getAttribute("href"); });
    var view = null, idx = 0;
    function show(i) {
      idx = (i + urls.length) % urls.length;
      view.querySelector("img").src = urls[idx];
      var count = view.querySelector(".pp-fv-count");
      if (count) count.textContent = (idx + 1) + " / " + urls.length;
      fotos.forEach(function (a, j) { a.classList.toggle("on", j === idx); });
    }
    function onKey(e) {
      // Solo cuando el visor está visible (pestaña activa) y no se está
      // escribiendo en un campo.
      if (/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || "")) return;
      if (!view || !view.offsetParent) return;
      if (e.key === "ArrowRight") show(idx + 1);
      else if (e.key === "ArrowLeft") show(idx - 1);
    }
    function open(i, skipScroll) {
      if (!view) {
        view = el("div", "pp-fotos-view");
        view.innerHTML = '<img alt="">' +
          (urls.length > 1 ? '<button type="button" class="pp-fv-prev" aria-label="Anterior">←</button><button type="button" class="pp-fv-next" aria-label="Siguiente">→</button><div class="pp-fv-count"></div>' : "");
        var prev = view.querySelector(".pp-fv-prev");
        var next = view.querySelector(".pp-fv-next");
        if (prev) prev.addEventListener("click", function () { show(idx - 1); });
        if (next) next.addEventListener("click", function () { show(idx + 1); });
        // Swipe táctil: pasar de foto arrastrando en móvil.
        if (urls.length > 1) {
          var touchX = null;
          view.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
          view.addEventListener("touchend", function (e) {
            if (touchX == null) return;
            var dx = e.changedTouches[0].clientX - touchX;
            touchX = null;
            if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
          }, { passive: true });
        }
        grid.parentNode.insertBefore(view, grid);
        document.addEventListener("keydown", onKey);
      }
      show(i);
      if (!skipScroll) {
        try { view.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) { /* sin soporte */ }
      }
    }
    fotos.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        // El visor no se cierra: solo cambia entre las fotos disponibles.
        if (!(view && idx === i)) open(i);
      });
    });
    // Por defecto el visor parte abierto con la primera foto (sin mover el
    // scroll de la página al cargar).
    open(0, true);
  }

  // Nota discreta bajo la grilla de fotos (storefront.photosNote): condiciones
  // o aclaraciones de lo que se ve en las fotos. Vacía → no se muestra.
  function renderFotosNote() {
    var host = $("[data-pp-fotos-note]");
    if (!host) return;
    var note = (producto && producto.storefront && producto.storefront.photosNote) || "";
    host.textContent = note;
    host.hidden = !note;
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function matchProducto(data) {
    // JSON version 2: clave `productos`; version 1 usaba `equipos` — se
    // aceptan ambas (degradación elegante).
    var list = (data && (data.productos || data.equipos)) || [];
    for (var i = 0; i < list.length; i++) {
      var eq = list[i];
      if (String(eq.productId || "") === productId) return eq;
      if (eq.sku && productSku && norm(eq.sku) === norm(productSku)) return eq;
    }
    return null;
  }

  function buildGroups() {
    groups = jsOptions.map(function (opt) {
      var jgroup = null;
      if (producto) {
        (producto.groups || []).forEach(function (g) {
          if (norm(g.label) === norm(opt.name)) jgroup = g;
        });
      }
      return { option: opt, json: jgroup };
    });
    // Selección inicial: defaults del JSON (o primer valor visible).
    groups.forEach(function (g) {
      var def = null;
      if (g.json) {
        var defJson = g.json.values.filter(function (v) { return v.isDefault; })[0];
        if (defJson) def = g.option.values.filter(function (v) { return norm(v.name) === norm(defJson.name); })[0];
      }
      selection[g.option.id] = (def || g.option.values[0] || {}).id;
    });
    // Pasos colapsados por defecto (storefront.style.stepsCollapsed): todos
    // parten colapsados salvo el primero visible.
    if (stepsCollapsedDefault) {
      var first = true;
      groups.forEach(function (g) {
        if (!isGroupVisible(g)) return;
        if (first) { first = false; return; }
        collapsedSteps[g.option.id] = true;
      });
    }
    // Normalizar visibilidad inicial (por si el default choca).
    groups.forEach(function (g) { setSelection(g.option.id, selection[g.option.id], true); });
  }

  function fetchDefinition() {
    if (!kimosUrl) {
      console.warn("[configurador] URL del JSON de ProductLab vacía: pega la URL pública del JSON en el editor visual → componente Template → 'URL del configurador (JSON público)' (o define window.PP_KIMOS_URL en custom.js). Corriendo en modo degradado (sin hero/specs/compatibilidades).");
      return Promise.resolve(null);
    }
    var cacheKey = "pp-productlab-" + productId;
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        var obj = JSON.parse(cached);
        if (Date.now() - obj.t < 180000) return Promise.resolve(obj.d);
      }
    } catch (e) { /* sin sessionStorage */ }
    // Cache-busting automático contra el CDN (cachea ~10 min por URL): la URL
    // rota cada 5 minutos, así los cambios publicados aparecen solos sin
    // tocar ?v= a mano, y dentro del bloque el CDN sigue amortiguando.
    var busted = kimosUrl + (kimosUrl.indexOf("?") >= 0 ? "&" : "?") + "_t=" + Math.floor(Date.now() / 300000);
    return fetch(busted, { mode: "cors" })
      .then(function (r) {
        if (!r.ok) {
          console.warn("[configurador] El JSON de ProductLab respondió HTTP " + r.status + (r.status === 403 ? " (¿configurador despublicado? Publícalo en la app → Publicación)." : "."));
          return null;
        }
        return r.json();
      })
      .then(function (d) {
        // El gateway envuelve la respuesta: {instanceId, data:{…}}.
        if (d && d.data && typeof d.data === "object" && !Array.isArray(d.productos) && !Array.isArray(d.equipos)) d = d.data;
        if (d) { try { sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
        return d;
      })
      .catch(function (e) {
        console.warn("[configurador] No se pudo leer el JSON de ProductLab (" + (e && e.message) + "). Si es CORS, el gateway debe permitir el origen de la tienda.");
        return null;
      });
  }

  function init() {
    fetchDefinition().then(function (data) {
      producto = data ? matchProducto(data) : null;
      if (data && !producto) {
        var pubList = (data.productos || data.equipos) || [];
        console.warn("[configurador] JSON de ProductLab cargado pero SIN producto para productId=" + productId + " / sku=" + productSku +
          ". Productos publicados: " + (pubList.map(function (e) { return (e.productId || "sin-id") + "/" + (e.sku || "sin-sku"); }).join(", ") || "ninguno") +
          ". Revisa el enlace del producto en la app (productRef) y republica.");
      }
      if (producto) console.info("[configurador] Producto '" + producto.name + "' cargado desde ProductLab (" + (producto.groups || []).length + " pasos).");
      if (producto && producto.assemblyDays != null) assemblyDays = Number(producto.assemblyDays) || assemblyDays;
      if (producto && producto.deliveryMode === "sum") deliveryMode = "sum";
      if (producto) baseDeliveryDays = Number(producto.baseDeliveryDays) || 0;
      noSteps = !!producto && !((producto.groups || []).length);
      if (noSteps) root.classList.add("pp-nosteps");
      root.classList.add("pp-ready");
      var boot = $("[data-pp-boot]");
      if (boot) { boot.classList.add("out"); setTimeout(function () { boot.remove(); }, 350); }
      applyStyle();
      applyTabLabels();
      updateMiniPrice();
      renderHero();
      buildGroups();
      renderSteps();
      renderPanel();
      renderSpecs();
      renderFotosNote();
      initFotos();
      // Builder activo: la tabla de especificaciones y la nota viven como
      // secciones ordenadas — se ocultan sus instancias independientes.
      if (builderOn) {
        var standalone = $("#pp-espec");
        if (standalone) standalone.style.display = "none";
        var noteEl = $("[data-pp-fotos-note]");
        if (noteEl) noteEl.hidden = true;
      }
      // Panel móvil flotante: botón que despliega el detalle hacia arriba.
      var panelBox = $(".pp-panel-box");
      if (panelBox && !$("[data-pp-expand]")) {
        var exBtn = el("button", "pp-panel-expand");
        exBtn.type = "button";
        exBtn.setAttribute("data-pp-expand", "");
        exBtn.setAttribute("aria-label", "Ver detalle de la configuración");
        exBtn.setAttribute("aria-expanded", "false");
        exBtn.textContent = "▲";
        exBtn.addEventListener("click", function () {
          var open2 = panelBox.classList.toggle("pp-open");
          exBtn.textContent = open2 ? "▼" : "▲";
          exBtn.setAttribute("aria-expanded", open2 ? "true" : "false");
        });
        panelBox.appendChild(exBtn);
      }
      // Botón "Agregar al carro" en la barra (visible solo en Configurar,
      // donde la barra ya no muestra mini-foto/precio/Comprar): dispara el
      // add-to-cart real del panel.
      var inner = $(".pp-tabs-inner");
      var realCart = $("button#add-to-cart");
      if (inner && realCart && !$(".pp-bar-cart")) {
        var bcBtn = el("button", "pp-btn pp-btn-primary pp-bar-cart");
        bcBtn.type = "button";
        bcBtn.textContent = (realCart.textContent || "").trim() || "Agregar al carro →";
        bcBtn.addEventListener("click", function () { realCart.click(); });
        inner.appendChild(bcBtn);
      }
      updateBar();
      // Sin datos de la app igual funciona: cards sin foto/desc, sin filtros
      // de compatibilidad, precio por variante y carro operativos.
    });
  }

  // Failsafe: si algo impide el init, no dejar el overlay de carga pegado.
  setTimeout(function () {
    var boot = $("[data-pp-boot]");
    if (boot) { boot.classList.add("out"); setTimeout(function () { boot.remove(); }, 350); }
  }, 6000);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
