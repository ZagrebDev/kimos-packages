/**
 * kimos-embed.js — arranque del kit ProductLab inyectado por JsApp.
 *
 * Jumpseller lo carga en todas las páginas (JsApp creado por ProductLab →
 * Publicación → "Instalar kit en la tienda"). Hace lo mismo que custom.js
 * pero SIN tocar el theme: lee su configuración de la query de su propia
 * URL y carga el kit (JS + CSS) desde los assets públicos de la app KIMOS.
 *
 *   /api/apps/productlab/asset/kimos-embed.js?def=<url(es) del catálogo>&v=<versión>
 *
 * - `def`: URL pública del configurador; varias separadas por coma para
 *   varias instancias (mismo contrato que KIMOS_3D_URL).
 * - `v`: versión para bustear cachés; la pone ProductLab al instalar.
 * - Si el theme YA tiene custom.js configurado (KIMOS_3D_URL definido), este
 *   embed NO pisa esa configuración y NO carga el kit dos veces: el manual
 *   manda, para poder migrar con calma.
 */
(function () {
  var me = document.currentScript;
  if (!me || !me.src) return;
  var q = {};
  String(me.src.split('?')[1] || '').split('&').forEach(function (kv) {
    var i = kv.indexOf('=');
    if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
  });
  if (!q.def) { console.error('[kimos-embed] falta ?def= con la URL del catálogo'); return; }

  // custom.js manda: si ya definió la URL, el embed solo se retira.
  if (window.KIMOS_3D_URL !== undefined && String(window.KIMOS_3D_URL).indexOf('TU-KIMOS') === -1) {
    console.info('[kimos-embed] custom.js ya configura el kit; el embed no interviene.');
    return;
  }
  if (window.__kimosKit) return;   // doble JsApp / doble carga
  window.__kimosKit = true;

  window.KIMOS_3D_URL = q.def;
  if (window.KIMOS_FULL === undefined) window.KIMOS_FULL = true;

  var base = me.src.replace(/[^/]*(\?.*)?$/, '');
  var v = encodeURIComponent(q.v || '1');
  if (window.KIMOS_3D_ENGINE_URL === undefined) window.KIMOS_3D_ENGINE_URL = base + 'engine3d.js?v=' + v;

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = base + 'kimos-configurador.css?v=' + v;
  document.head.appendChild(css);

  var js = document.createElement('script');
  js.src = base + 'kimos-configurador.js?v=' + v;
  js.defer = true;
  js.setAttribute('data-kimos-kit', '1');
  document.head.appendChild(js);
})();
