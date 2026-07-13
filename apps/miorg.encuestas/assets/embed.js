/**
 * Encuesta Rápida — widget incrustable (EJEMPLO de app de terceros).
 *
 * Patrón "cero backend a medida": este script se sirve como ASSET de la app
 * (/api/apps/miorg.encuestas/asset/embed.js — público) y habla únicamente
 * con el gateway genérico de la plataforma:
 *   GET  /api/public/app/{instanceId}/definition   → qué preguntar (public.data)
 *   POST /api/public/app/{instanceId}/submit/respuesta → guardar el voto
 *
 * Uso en cualquier web:
 *   <div data-kimos-encuesta="INSTANCE_ID"></div>
 *   <script src="https://TU-HOST/api/apps/miorg.encuestas/asset/embed.js"
 *           data-instance="INSTANCE_ID" async></script>
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !script.src) return;
  var INSTANCE = script.getAttribute('data-instance') || '';
  if (!INSTANCE) { console.error('[encuesta] falta data-instance'); return; }
  // Base del API: la propia URL del asset (…/api/apps/… → origen del backend).
  var API_BASE = script.src.split('/api/apps/')[0];
  var GW = API_BASE + '/api/public/app/' + INSTANCE;

  var containers = Array.prototype.slice.call(
    document.querySelectorAll('[data-kimos-encuesta="' + INSTANCE + '"]'));
  if (!containers.length) {
    var d = document.createElement('div');
    script.parentNode.insertBefore(d, script);
    containers = [d];
  }

  fetch(GW + '/definition')
    .then(function (r) { if (!r.ok) throw new Error('definition ' + r.status); return r.json(); })
    .then(function (res) { containers.forEach(function (c) { render(c, res.data || {}); }); })
    .catch(function (e) { console.error('[encuesta]', e); });

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute('style', style);
    if (text != null) n.textContent = text;
    return n;
  }

  function render(container, data) {
    var accent = data.accent || '#19ACB1';
    var box = el('div', 'max-width:420px;font-family:system-ui,sans-serif;border:1px solid #d1d5db;' +
      'border-radius:14px;padding:18px;background:#fff;color:#111827;');
    if (data.title) box.appendChild(el('div', 'font-size:16px;font-weight:700;margin-bottom:4px;', data.title));
    box.appendChild(el('div', 'font-size:14px;margin-bottom:12px;', data.question || '¿Qué opinas?'));

    var chosen = null;
    var buttons = [];
    (data.options || []).forEach(function (opt) {
      var b = el('button', 'display:block;width:100%;text-align:left;margin:6px 0;padding:9px 12px;' +
        'border:1px solid #d1d5db;border-radius:9px;background:#f9fafb;font:inherit;font-size:14px;cursor:pointer;', String(opt));
      b.addEventListener('click', function () {
        chosen = String(opt);
        buttons.forEach(function (x) {
          x.style.borderColor = '#d1d5db'; x.style.background = '#f9fafb';
        });
        b.style.borderColor = accent; b.style.background = '#f0fbfb';
        send.disabled = false; send.style.opacity = '1';
      });
      buttons.push(b);
      box.appendChild(b);
    });

    var comment = null;
    if (data.askComment) {
      comment = el('textarea', 'width:100%;box-sizing:border-box;margin-top:8px;padding:8px 10px;' +
        'border:1px solid #d1d5db;border-radius:9px;font:inherit;font-size:13px;resize:vertical;');
      comment.rows = 2;
      comment.placeholder = data.commentLabel || 'Comentario (opcional)';
      box.appendChild(comment);
    }

    // Honeypot anti-bots (el gateway lo exige vacío)
    var hp = el('input', 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;');
    hp.tabIndex = -1; hp.autocomplete = 'off';
    box.appendChild(hp);

    var send = el('button', 'margin-top:12px;padding:9px 20px;border:none;border-radius:9px;background:' +
      accent + ';color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;opacity:.5;', data.button || 'Enviar');
    send.disabled = true;
    var msg = el('div', 'font-size:13px;margin-top:10px;display:none;');
    box.appendChild(send); box.appendChild(msg);

    send.addEventListener('click', function () {
      if (!chosen) return;
      send.disabled = true; send.style.opacity = '.5';
      fetch(GW + '/submit/respuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opcion: chosen, comentario: comment ? comment.value : '', _hp: hp.value }),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          msg.style.display = 'block';
          if (res.ok) {
            msg.style.color = '#059669';
            msg.textContent = data.thanks || '¡Gracias por tu respuesta!';
            buttons.forEach(function (b) { b.disabled = true; b.style.cursor = 'default'; });
            if (comment) comment.disabled = true;
            send.style.display = 'none';
          } else {
            msg.style.color = '#dc2626';
            msg.textContent = (res.j && res.j.detail) || 'No se pudo enviar.';
            send.disabled = false; send.style.opacity = '1';
          }
        })
        .catch(function () {
          msg.style.display = 'block'; msg.style.color = '#dc2626';
          msg.textContent = 'Error de red. Intenta nuevamente.';
          send.disabled = false; send.style.opacity = '1';
        });
    });

    container.innerHTML = '';
    container.appendChild(box);
  }
})();
