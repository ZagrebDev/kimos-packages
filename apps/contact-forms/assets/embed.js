/* Formularios de Contacto — widget incrustable (asset de la app, sin backend a medida).
 *
 * Vive en el paquete de la app y se sirve público como asset de la plataforma
 * (`/api/apps/contact-forms/asset/embed.js`, igual que miorg.encuestas) o, como
 * alternativa, desde el CDN del repo kimos-packages. Solo usa endpoints
 * genéricos ya existentes del enterprise:
 *
 *   GET  {api}/api/public/app/{id}/definition            → gateway genérico:
 *        `definition.public.data` con textos, campos Y estilo (en vivo).
 *        Requiere permission `public.read` + `public.enabled` en la definición.
 *   GET  {api}/api/public/contact-forms/{id}/definition  → fallback (endpoint
 *        histórico): textos y campos, sin estilo.
 *   POST {api}/api/public/contact-forms/{id}/submissions → envío, con
 *        validación por definición, honeypot, rate-limit y aviso por email.
 *
 * Configuración (el snippet la genera la pestaña Incrustar de la app):
 *   window.KimosContactForms = window.KimosContactForms || [];
 *   window.KimosContactForms.push({
 *     formId: '...', api: 'https://...',
 *     container: '#kcf-...',   // opcional; si falta usa [data-kimos-contact-form=formId]
 *     style: {...},            // snapshot del editor de Apariencia (fallback)
 *     form: {...},             // snapshot de textos+campos (fallback si no hay red)
 *     postHeight: true,        // solo embed.html (modo iframe)
 *   });
 *
 * El resultado del envío se muestra en un modal superpuesto: el alto del
 * formulario no cambia, así el iframe mantiene altura fija sin scrollbars.
 */
(function () {
  'use strict';

  var BASES = {
    light: { bgColor: '#ffffff', textColor: '#111827', inputBgColor: '#ffffff', borderColor: '#d1d5db', successColor: '#059669', errorColor: '#dc2626' },
    dark: { bgColor: '#111827', textColor: '#f9fafb', inputBgColor: '#1f2937', borderColor: '#374151', successColor: '#34d399', errorColor: '#f87171' }
  };

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style') e.setAttribute('style', attrs[k]);
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  // Blindaje contra el CSS del sitio anfitrión: los temas (p. ej. Jumpseller)
  // suelen estilar inputs/textarea/button con !important, pisando estilos
  // inline normales. Declarar cada propiedad inline con !important gana
  // siempre (inline+important > stylesheet+important).
  function imp(css) {
    return css.replace(/\s*;\s*/g, ' !important;');
  }

  function rgba(hex, alpha) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n) || h.length < 6) return hex;
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function styleOf(cfg, def) {
    // El estilo del servidor (gateway público, en vivo) manda; si no llega,
    // se usa el snapshot que viaja en el snippet.
    var s = (def && def.style) || (cfg && cfg.style) || {};
    var base = (s.base || (def && def.theme) || 'light') === 'dark' ? 'dark' : 'light';
    var d = BASES[base];
    var align = s.align === 'left' || s.align === 'right' ? s.align : 'center';
    var bgSolid = s.bgColor || d.bgColor;
    // Opacidad del fondo del formulario (0-100). El modal mantiene el fondo
    // sólido para que el mensaje siempre sea legible.
    var alpha = typeof s.bgOpacity === 'number' ? Math.min(Math.max(s.bgOpacity, 0), 100) / 100 : 1;
    return {
      dark: base === 'dark',
      align: align,
      bgSolid: bgSolid,
      bg: alpha < 1 ? rgba(bgSolid, alpha) : bgSolid,
      fg: s.textColor || d.textColor,
      inputBg: s.inputBgColor || d.inputBgColor,
      border: s.borderColor || d.borderColor,
      accent: s.accentColor || (def && def.accentColor) || '#19ACB1',
      ok: s.successColor || d.successColor,
      err: s.errorColor || d.errorColor,
      bw: s.border === false ? 0 : (typeof s.borderWidth === 'number' ? s.borderWidth : 1),
      rounded: s.rounded !== false,
      fs: typeof s.fontSize === 'number' ? s.fontSize : 14
    };
  }

  function snapshot(def) {
    return JSON.stringify({
      t: def.title, d: def.description, b: def.buttonLabel, s: def.successMessage,
      f: def.fields, st: def.style || null
    });
  }

  function render(container, cfg, def, state) {
    var st = styleOf(cfg, def);
    var rad = st.rounded ? 14 : 0;
    var inRad = st.rounded ? 8 : 0;
    var fs = st.fs;
    var margin = st.align === 'center' ? '0 auto' : st.align === 'right' ? '0 0 0 auto' : '0 auto 0 0';

    var inputStyle = imp('width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid ' + st.border +
      ';border-radius:' + inRad + 'px;font-family:inherit;font-size:' + fs + 'px;line-height:1.4;margin:0;' +
      'box-shadow:none;text-transform:none;background:' + st.inputBg + ';color:' + st.fg + ';');
    var labelStyle = imp('display:block;font-size:' + (fs - 2) + 'px;font-weight:600;margin:12px 0 4px;' +
      'line-height:1.3;text-transform:none;letter-spacing:normal;color:' + st.fg + ';');

    var wrap = el('div', { style: imp('position:relative;max-width:560px;margin:' + margin + ';font-family:system-ui,sans-serif;') });
    var formEl = el('form', { style: imp('background:' + st.bg + ';color:' + st.fg + ';padding:20px;box-sizing:border-box;' +
      'margin:0;line-height:1.5;text-align:left;' +
      'border:' + (st.bw > 0 ? st.bw + 'px solid ' + st.border : 'none') + ';border-radius:' + rad + 'px;font-size:' + fs + 'px;') });
    if (def.title) formEl.appendChild(el('div', { style: imp('font-size:' + (fs + 4) + 'px;font-weight:700;line-height:1.3;margin:0;color:' + st.fg + ';') }, [def.title]));
    if (def.description) formEl.appendChild(el('div', { style: imp('font-size:' + (fs - 1) + 'px;opacity:.75;margin:4px 0 0;line-height:1.5;color:' + st.fg + ';') }, [def.description]));

    var inputs = {};
    (def.fields || []).forEach(function (f) {
      if (!f || !f.key) return;
      formEl.appendChild(el('label', { style: labelStyle, for: 'kcf-' + cfg.formId + '-' + f.key }, [String(f.label || f.key) + (f.required ? ' *' : '')]));
      var node;
      if (f.type === 'textarea') {
        node = el('textarea', { rows: '4', style: inputStyle + imp('resize:vertical;height:auto;') });
      } else if (f.type === 'select') {
        node = el('select', { style: inputStyle },
          [el('option', { value: '' }, [f.placeholder || '—'])].concat((f.options || []).map(function (o) {
            return el('option', { value: o }, [String(o)]);
          })));
      } else {
        node = el('input', { type: f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text', style: inputStyle });
      }
      node.id = 'kcf-' + cfg.formId + '-' + f.key;
      if (f.placeholder && f.type !== 'select') node.setAttribute('placeholder', f.placeholder);
      if (f.required) node.required = true;
      if (f.maxLength) node.setAttribute('maxlength', String(f.maxLength));
      inputs[f.key] = node;
      formEl.appendChild(node);
    });

    // Honeypot oculto
    var hp = el('input', { type: 'text', name: '_hp', tabindex: '-1', autocomplete: 'off',
      style: imp('position:absolute;left:-9999px;height:1px;width:1px;opacity:0;') });
    formEl.appendChild(hp);

    var btnStyle = 'margin:16px 0 0;padding:10px 22px;border:none;border-radius:' + inRad + 'px;' +
      'line-height:1.2;box-shadow:none;text-transform:none;letter-spacing:normal;width:auto;font-family:inherit;' +
      'background:' + st.accent + ';color:#ffffff;font-weight:600;font-size:' + fs + 'px;cursor:pointer;';
    var btn = el('button', { type: 'submit', style: imp(btnStyle) }, [def.buttonLabel || 'Enviar']);
    formEl.appendChild(btn);

    // Modal superpuesto para éxito/error: el alto del formulario no cambia.
    var modalText = el('div', { style: imp('font-size:' + (fs + 1) + 'px;font-weight:600;line-height:1.45;margin:0;') });
    var modalClose = el('button', { type: 'button', style: imp('margin:14px 0 0;padding:8px 20px;border:none;border-radius:' + inRad + 'px;' +
      'line-height:1.2;box-shadow:none;text-transform:none;letter-spacing:normal;width:auto;font-family:inherit;' +
      'background:' + st.accent + ';color:#ffffff;font-weight:600;font-size:' + (fs - 1) + 'px;cursor:pointer;') }, ['Cerrar']);
    var modalCard = el('div', { style: imp('background:' + st.bgSolid + ';color:' + st.fg + ';border:1px solid ' + st.border +
      ';border-radius:' + (st.rounded ? 12 : 0) + 'px;padding:20px 22px;max-width:88%;box-sizing:border-box;text-align:center;' +
      'box-shadow:0 12px 32px rgba(0,0,0,.28);') }, [modalText, modalClose]);
    var overlay = el('div', { style: imp('position:absolute;top:0;left:0;right:0;bottom:0;display:none;align-items:center;' +
      'justify-content:center;padding:16px;box-sizing:border-box;z-index:5;border-radius:' + rad + 'px;margin:0;' +
      'background:' + (st.dark ? 'rgba(0,0,0,.55)' : 'rgba(17,24,39,.35)') + ';') }, [modalCard]);
    function showModal(kind, text) {
      modalText.style.setProperty('color', kind === 'ok' ? st.ok : st.err, 'important');
      modalText.textContent = text;
      overlay.style.setProperty('display', 'flex', 'important');
      modalClose.focus();
    }
    modalClose.addEventListener('click', function () { overlay.style.setProperty('display', 'none', 'important'); });

    formEl.addEventListener('input', function () { state.touched = true; });
    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var payload = { _hp: hp.value };
      Object.keys(inputs).forEach(function (k) { payload[k] = inputs[k].value; });
      btn.disabled = true; btn.style.opacity = '.6';
      fetch(cfg.api + '/api/public/contact-forms/' + cfg.formId + '/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            showModal('ok', (res.j && res.j.message) || def.successMessage || 'Enviado.');
            formEl.reset();
          } else {
            showModal('err', (res.j && res.j.detail) || 'No se pudo enviar. Intenta nuevamente.');
          }
        })
        .catch(function () {
          showModal('err', 'Error de red. Intenta nuevamente.');
        })
        .then(function () { btn.disabled = false; btn.style.opacity = '1'; });
    });

    wrap.appendChild(formEl);
    wrap.appendChild(overlay);
    container.innerHTML = '';
    container.appendChild(wrap);
  }

  // Modo iframe: avisa la altura real al sitio padre (el snippet de la app
  // incluye el listener). Evita scrollbars internos del iframe.
  function setupHeightPost(formId) {
    if (window.parent === window) return;
    var last = 0;
    function send() {
      var h = Math.ceil(document.body.scrollHeight);
      if (h > 0 && h !== last) {
        last = h;
        try { window.parent.postMessage({ type: 'kimos-contact-form:height', formId: formId, height: h }, '*'); } catch (e) { /* noop */ }
      }
    }
    if (window.ResizeObserver) new ResizeObserver(send).observe(document.body);
    window.addEventListener('load', send);
    setInterval(send, 1200);
    send();
  }

  // Lee la definición publicada: gateway genérico primero (trae estilo, en
  // vivo); si la instalación no lo tiene habilitado, endpoint histórico.
  function fetchDefinition(cfg) {
    return fetch(cfg.api + '/api/public/app/' + cfg.formId + '/definition', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('gateway ' + r.status); return r.json(); })
      .then(function (j) {
        var d = j && j.data;
        if (!d || typeof d !== 'object' || !d.fields) throw new Error('gateway sin data');
        return d;
      })
      .catch(function () {
        return fetch(cfg.api + '/api/public/contact-forms/' + cfg.formId + '/definition', { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error('definition ' + r.status); return r.json(); });
      });
  }

  function boot(cfg) {
    if (!cfg || !cfg.formId || !cfg.api) return;
    var container = null;
    if (cfg.container) container = document.querySelector(cfg.container);
    if (!container) container = document.querySelector('[data-kimos-contact-form="' + cfg.formId + '"]');
    if (!container) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { boot(cfg); });
      } else {
        console.error('[kimos-contact-form] contenedor no encontrado para', cfg.formId);
      }
      return;
    }
    cfg.api = String(cfg.api).replace(/\/$/, '');
    var state = { touched: false };
    if (cfg.form) render(container, cfg, cfg.form, state);
    if (cfg.postHeight) setupHeightPost(cfg.formId);

    // Refresca desde el backend: cambios de textos/campos (y de estilo si el
    // gateway está habilitado) llegan sin re-pegar el snippet. Solo
    // re-renderiza si algo cambió y el visitante aún no escribió nada.
    fetchDefinition(cfg)
      .then(function (def) {
        if (state.touched) return;
        if (cfg.form && snapshot(def) === snapshot(cfg.form)) return;
        render(container, cfg, def, state);
      })
      .catch(function (e) { if (!cfg.form) console.error('[kimos-contact-form]', e); });
  }

  var queued = window.KimosContactForms;
  var list = queued && typeof queued.slice === 'function' ? queued.slice() : [];
  // A partir de aquí, cualquier push posterior renderiza de inmediato.
  window.KimosContactForms = { push: boot };
  list.forEach(boot);
})();
