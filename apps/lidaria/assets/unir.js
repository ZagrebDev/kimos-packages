/**
 * unir.js — la página a la que lleva el QR de emparejamiento.
 *
 * Se sirve como ASSET de la app (/api/apps/lidaria/asset/unir.html, público) y
 * habla solo con el gateway genérico de KIMOS, el mismo patrón que usan las
 * apps de encuestas y buzón:
 *
 *   GET  /api/public/app/{instanceId}/definition   → ¿qué sesión es? ¿está abierta?
 *   POST /api/public/app/{instanceId}/submit/unir  → este equipo se suma
 *
 * Por qué existe: sin esto, el QR llevaba al escritorio de KIMOS, que pide
 * iniciar sesión y no sabe qué hacer con el código. Ahora lleva a una página
 * que la propia app publica, sin login, y que funciona en cualquier teléfono.
 *
 * Tres cosas que esta página NO hace, y que declara en pantalla:
 *  · No mide a nadie: para eso hace falta la app completa con su motor de pose.
 *    Aquí se informa de lo que este equipo PUEDE hacer, que es lo que el
 *    operador necesita saber para repartir el trabajo.
 *  · No manda imágenes. El gateway acepta 32 KB de texto plano y punto; los
 *    fotogramas no salen del teléfono ni aquí ni en la app.
 *  · No hereda el permiso de cámara del equipo que mostró el QR. Cada teléfono
 *    concede el suyo, y eso no se puede delegar.
 */
(function () {
  'use strict';

  var app = document.getElementById('app');
  // La base del API sale de la propia URL de este script: si la página se
  // sirve desde el KIMOS del cliente, el gateway está en el mismo sitio.
  var API = (document.currentScript && document.currentScript.src || window.location.href).split('/api/apps/')[0];

  /* ------------------------------ utilidades ------------------------------ */

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function kv(clave, valor) {
    var d = el('div', 'kv');
    d.appendChild(el('span', null, clave));
    d.appendChild(el('b', null, valor));
    return d;
  }
  function limpiar() { while (app.firstChild) app.removeChild(app.firstChild); }
  function tarjeta() { var c = el('div', 'tarjeta'); app.appendChild(c); return c; }

  function error(titulo, detalle, pista) {
    limpiar();
    var c = tarjeta();
    c.appendChild(el('h1', null, titulo));
    c.appendChild(el('p', 'aviso', detalle));
    if (pista) c.appendChild(el('p', 'mini', pista));
    return c;
  }

  /* --------------------------- leer el código --------------------------- */

  /** Mismo formato posicional que `enlace.js` del núcleo. */
  function leerEnlace(hash) {
    var m = String(hash || '').match(/[#?]l=([^&]+)/);
    if (!m) return null;
    var partes = m[1].split('.').map(function (x) {
      try { return decodeURIComponent(x); } catch (e) { return null; }
    });
    if (partes.length < 6 || partes.some(function (x) { return x === null; })) return null;
    if (partes[0] !== '1') return { versionRara: partes[0] };
    var extras = {};
    if (partes[6]) {
      partes[6].split('~').forEach(function (par) {
        var i = par.indexOf(':');
        if (i > 0) extras[par.slice(0, i)] = par.slice(i + 1);
      });
    }
    var min = Number(partes[5]);
    return {
      dispositivo: partes[1],
      codigo: partes[2],
      sesion: partes[3],
      transporte: partes[4],
      caduca: isFinite(min) && min > 0 ? new Date(min * 60000) : null,
      extras: extras,
      instancia: extras.i || partes[3] || '',
    };
  }

  /* ---------------------- qué puede hacer este equipo ---------------------- */

  /**
   * Diagnóstico honesto del teléfono que se está uniendo.
   *
   * No se piden permisos todavía: esto es lo que se puede saber sin molestar.
   * Las etiquetas de las cámaras llegan vacías hasta que se concede el permiso,
   * y eso no es un fallo — es la protección contra huella digital.
   */
  function mirarEquipo() {
    var d = {
      plataforma: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios'
        : /Android/.test(navigator.userAgent) ? 'android' : 'escritorio',
      pantalla: (screen.width || 0) + 'x' + (screen.height || 0),
      nucleos: navigator.hardwareConcurrency || null,
      memoriaGB: navigator.deviceMemory || null,
      seguro: window.isSecureContext !== false,
      camaras: null, microfonos: null, etiquetas: false,
      imu: !!(window.DeviceMotionEvent || window.DeviceOrientationEvent),
      gnss: !!navigator.geolocation,
      bluetooth: !!(navigator.bluetooth && navigator.bluetooth.requestDevice),
      nfc: typeof window.NDEFReader === 'function',
    };
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve(d);
    }
    return navigator.mediaDevices.enumerateDevices().then(function (lista) {
      d.camaras = lista.filter(function (x) { return x.kind === 'videoinput'; }).length;
      d.microfonos = lista.filter(function (x) { return x.kind === 'audioinput'; }).length;
      d.etiquetas = lista.some(function (x) { return !!x.label; });
      return d;
    }).catch(function () { return d; });
  }

  /** Abre la cámara solo para medir lo que entrega, y la cierra enseguida. */
  function probarCamara() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve({ ok: false, motivo: 'Este navegador no expone cámaras.' });
    }
    if (window.isSecureContext === false) {
      return Promise.resolve({ ok: false, motivo: 'La cámara exige HTTPS. Esta página no está en contexto seguro.' });
    }
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then(function (stream) {
      var t = stream.getVideoTracks()[0];
      var s = t && t.getSettings ? t.getSettings() : {};
      var cap = {};
      try { cap = t && t.getCapabilities ? t.getCapabilities() : {}; } catch (e) { cap = {}; }
      stream.getTracks().forEach(function (x) { x.stop(); });
      return {
        ok: true, ancho: s.width || null, alto: s.height || null, fps: s.frameRate || null,
        linterna: Array.isArray(cap.torch) ? cap.torch.indexOf(true) >= 0 : !!cap.torch,
        zoom: !!cap.zoom,
      };
    }).catch(function (e) {
      var n = String(e && e.name || '');
      var msg = {
        NotAllowedError: 'Permiso de cámara denegado. Acéptalo y vuelve a intentarlo.',
        NotFoundError: 'Este equipo no tiene cámara.',
        NotReadableError: 'La cámara está ocupada por otra aplicación.',
      };
      return { ok: false, motivo: msg[n] || (e && e.message) || 'No se pudo abrir la cámara.' };
    });
  }

  /* -------------------------------- pintado -------------------------------- */

  function pintarInvitacion(enlace, def, equipo) {
    limpiar();
    var pub = (def && def.data) || {};
    var c = tarjeta();
    c.appendChild(el('h1', null, pub.titulo || 'Unirse a una sesión'));
    c.appendChild(el('p', 'mini', pub.descripcion
      || 'Este equipo va a sumarse como cámara de una sesión de LiDARia.'));

    c.appendChild(el('h2', null, 'La sesión'));
    c.appendChild(kv('Código', enlace.codigo || '—'));
    if (pub.organizacion) c.appendChild(kv('Organización', pub.organizacion));
    c.appendChild(kv('Papel de este equipo', pub.papel || 'Cámara de la sesión'));
    if (enlace.caduca) c.appendChild(kv('El código caduca', enlace.caduca.toLocaleTimeString()));

    c.appendChild(el('h2', null, 'Este equipo'));
    c.appendChild(kv('Tipo', equipo.plataforma));
    c.appendChild(kv('Cámaras', equipo.camaras == null ? 'no se pudo consultar' : String(equipo.camaras)));
    c.appendChild(kv('Sensores de movimiento', equipo.imu ? 'sí' : 'no'));
    c.appendChild(kv('Contexto seguro (HTTPS)', equipo.seguro ? 'sí' : 'NO — la cámara no funcionará'));

    var c2 = tarjeta();
    c2.appendChild(el('h2', null, 'Qué se envía si te unes'));
    var ul = el('ul');
    [
      'El modelo aproximado de este equipo y qué puede hacer su cámara.',
      'El código de la sesión, para saber a cuál te uniste.',
      'Nada más. NO se envían imágenes ni vídeo: el gateway solo acepta texto.',
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    c2.appendChild(ul);
    c2.appendChild(el('p', 'mini', 'Para saber qué cámara tienes hay que abrirla un instante. '
      + 'Se cierra enseguida y no se graba nada. Ese permiso es de este teléfono y no se puede heredar del equipo que mostró el código.'));

    var boton = el('button', null, 'Unirme a la sesión');
    var secundario = el('button', 'sec', 'Unirme sin probar la cámara');
    c2.appendChild(boton);
    c2.appendChild(secundario);

    boton.addEventListener('click', function () {
      boton.disabled = secundario.disabled = true;
      boton.textContent = 'Abriendo la cámara…';
      probarCamara().then(function (cam) { enviar(enlace, equipo, cam); });
    });
    secundario.addEventListener('click', function () {
      boton.disabled = secundario.disabled = true;
      enviar(enlace, equipo, { ok: false, motivo: 'No se probó la cámara.' });
    });
  }

  function pintarUnido(enlace, equipo, cam) {
    limpiar();
    var c = tarjeta();
    c.appendChild(el('h1', null, '✅ Este equipo se unió'));
    c.appendChild(el('p', 'aviso ok', 'Ya aparece en la lista de la sesión ' + (enlace.codigo || '') + '.'));
    c.appendChild(el('h2', null, 'Lo que se informó'));
    c.appendChild(kv('Tipo de equipo', equipo.plataforma));
    if (cam.ok) {
      c.appendChild(kv('Cámara', cam.ancho && cam.alto ? cam.ancho + '×' + cam.alto : 'abierta'));
      if (cam.fps) c.appendChild(kv('Cuadros por segundo', Math.round(cam.fps)));
      c.appendChild(kv('Linterna', cam.linterna ? 'sí' : 'no'));
    } else {
      c.appendChild(kv('Cámara', 'sin probar'));
      c.appendChild(el('p', 'mini', cam.motivo || ''));
    }
    c.appendChild(el('h2', null, 'Y ahora'));
    c.appendChild(el('p', 'mini', 'Para capturar y medir con este teléfono hace falta abrir la app completa: '
      + 'esta página informa de lo que el equipo puede hacer, no mide. '
      + 'Quien lleva la sesión ya ve este equipo en su lista y puede decirte qué te toca.'));
  }

  function enviar(enlace, equipo, cam) {
    // Texto plano y pocos campos: es lo que el gateway acepta, y además es
    // todo lo que hace falta. Ningún fotograma sale de este teléfono.
    var carga = {
      codigo: String(enlace.codigo || ''),
      dispositivo: String(enlace.dispositivo || ''),
      plataforma: String(equipo.plataforma),
      pantalla: String(equipo.pantalla || ''),
      nucleos: String(equipo.nucleos || ''),
      memoriaGB: String(equipo.memoriaGB || ''),
      camaras: String(equipo.camaras == null ? '' : equipo.camaras),
      microfonos: String(equipo.microfonos == null ? '' : equipo.microfonos),
      imu: equipo.imu ? 'si' : 'no',
      gnss: equipo.gnss ? 'si' : 'no',
      bluetooth: equipo.bluetooth ? 'si' : 'no',
      nfc: equipo.nfc ? 'si' : 'no',
      seguro: equipo.seguro ? 'si' : 'no',
      camaraProbada: cam.ok ? 'si' : 'no',
      camaraAncho: String(cam.ancho || ''),
      camaraAlto: String(cam.alto || ''),
      camaraFps: cam.fps ? String(Math.round(cam.fps)) : '',
      linterna: cam.linterna ? 'si' : 'no',
      agente: String(navigator.userAgent || '').slice(0, 180),
      _hp: '',                                   // trampa antispam del gateway
    };
    fetch(API + '/api/public/app/' + encodeURIComponent(enlace.instancia) + '/submit/unir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carga),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      pintarUnido(enlace, equipo, cam);
    }).catch(function (e) {
      var c = error('No se pudo avisar a la sesión',
        'El equipo está bien y la cámara también; lo que falló fue el envío (' + e.message + ').',
        'Dile a quien lleva la sesión el código ' + (enlace.codigo || '') + ' para que te anote a mano. '
        + 'Eso funciona igual: el código corto nunca dependió de la red.');
      c.appendChild(kv('Código para dictar', enlace.codigo || '—'));
    });
  }

  /* -------------------------------- arranque -------------------------------- */

  var enlace = leerEnlace(window.location.hash || window.location.search);
  if (!enlace) {
    error('Falta el código',
      'Esta página se abre escaneando el QR de una sesión de LiDARia; sola no hace nada.',
      'Vuelve a escanear el código, o pide el código corto de seis caracteres.');
    return;
  }
  if (enlace.versionRara) {
    error('Código de otra versión',
      'Este código lo generó una versión distinta de la app (formato ' + enlace.versionRara + ').',
      'Pide un código nuevo a quien lleva la sesión.');
    return;
  }
  if (enlace.caduca && enlace.caduca < new Date()) {
    error('El código caducó',
      'Los códigos de emparejamiento valen quince minutos: van escritos en una pantalla a la vista, así que el plazo es lo que los protege.',
      'Pide uno nuevo. Se generan en un segundo.');
    return;
  }
  if (!enlace.instancia) {
    error('El código no dice a qué sesión unirse',
      'Le falta el identificador de la instancia.',
      'Pide un código nuevo: los generados con la app al día sí lo llevan.');
    return;
  }

  limpiar();
  app.appendChild(el('div', 'cargando', 'Buscando la sesión…'));

  Promise.all([
    fetch(API + '/api/public/app/' + encodeURIComponent(enlace.instancia) + '/definition')
      .then(function (r) {
        if (r.status === 403) throw new Error('cerrada');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
    mirarEquipo(),
  ]).then(function (res) {
    pintarInvitacion(enlace, res[0], res[1]);
  }).catch(function (e) {
    if (e.message === 'cerrada') {
      error('La sesión está cerrada',
        'Quien la lleva todavía no la ha abierto, o ya la cerró. El gateway responde 403 mientras no esté publicada.',
        'Pídele que pulse «Abrir sesión» en la pestaña Enlazar de LiDARia y vuelve a escanear.');
      return;
    }
    mirarEquipo().then(function (equipo) {
      var c = error('No se pudo contactar con la sesión',
        'La página cargó, pero el servidor de KIMOS no respondió (' + e.message + ').',
        'Comprueba que este teléfono esté en la misma red que KIMOS. Mientras tanto, dicta el código corto.');
      c.appendChild(kv('Código para dictar', enlace.codigo || '—'));
      c.appendChild(kv('Este equipo', equipo.plataforma + ' · ' + (equipo.camaras == null ? '?' : equipo.camaras) + ' cámara(s)'));
    });
  });
})();
