/**
 * Buzón de Sugerencias — widget incrustable (EJEMPLO de app de terceros).
 *
 * Superficie MÍNIMA del gateway: solo POST /submit/{canal} (public.submit).
 * No usa public.read: los textos se configuran por atributos data-* del
 * propio script, así ni la definición se expone públicamente.
 *
 * Uso:
 *   <div data-kimos-buzon="INSTANCE_ID"></div>
 *   <script src="https://TU-HOST/api/apps/miorg.buzon/asset/embed.js"
 *           data-instance="INSTANCE_ID"
 *           data-title="Buzón de sugerencias"
 *           data-placeholder="Escribe tu sugerencia…" async></script>
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !script.src) return;
  var INSTANCE = script.getAttribute('data-instance') || '';
  if (!INSTANCE) { console.error('[buzon] falta data-instance'); return; }
  var API_BASE = script.src.split('/api/apps/')[0];
  var SUBMIT = API_BASE + '/api/public/app/' + INSTANCE + '/submit/sugerencia';
  var TITLE = script.getAttribute('data-title') || 'Buzón de sugerencias';
  var PLACEHOLDER = script.getAttribute('data-placeholder') || 'Escribe tu sugerencia…';

  var containers = Array.prototype.slice.call(
    document.querySelectorAll('[data-kimos-buzon="' + INSTANCE + '"]'));
  if (!containers.length) {
    var d = document.createElement('div');
    script.parentNode.insertBefore(d, script);
    containers = [d];
  }

  containers.forEach(function (container) {
    var box = document.createElement('div');
    box.setAttribute('style', 'max-width:420px;font-family:system-ui,sans-serif;border:1px solid #d1d5db;' +
      'border-radius:14px;padding:16px;background:#fff;color:#111827;');
    box.innerHTML = '';

    var title = document.createElement('div');
    title.setAttribute('style', 'font-size:15px;font-weight:700;margin-bottom:8px;');
    title.textContent = TITLE;

    var ta = document.createElement('textarea');
    ta.rows = 3;
    ta.placeholder = PLACEHOLDER;
    ta.setAttribute('style', 'width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d1d5db;' +
      'border-radius:9px;font:inherit;font-size:13px;resize:vertical;');

    var hp = document.createElement('input');
    hp.type = 'text'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.setAttribute('style', 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;');

    var btn = document.createElement('button');
    btn.textContent = 'Enviar';
    btn.setAttribute('style', 'margin-top:10px;padding:8px 18px;border:none;border-radius:9px;' +
      'background:#19ACB1;color:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer;');

    var msg = document.createElement('div');
    msg.setAttribute('style', 'font-size:12px;margin-top:8px;display:none;');

    btn.addEventListener('click', function () {
      var text = (ta.value || '').trim();
      if (!text) return;
      btn.disabled = true;
      fetch(SUBMIT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sugerencia: text, _hp: hp.value }),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          msg.style.display = 'block';
          if (res.ok) {
            msg.style.color = '#059669';
            msg.textContent = '¡Gracias! Tu sugerencia fue enviada.';
            ta.value = ''; ta.disabled = true; btn.style.display = 'none';
          } else {
            msg.style.color = '#dc2626';
            msg.textContent = (res.j && res.j.detail) || 'No se pudo enviar.';
            btn.disabled = false;
          }
        })
        .catch(function () {
          msg.style.display = 'block'; msg.style.color = '#dc2626';
          msg.textContent = 'Error de red. Intenta nuevamente.';
          btn.disabled = false;
        });
    });

    box.appendChild(title); box.appendChild(ta); box.appendChild(hp);
    box.appendChild(btn); box.appendChild(msg);
    container.innerHTML = '';
    container.appendChild(box);
  });
})();
