/**
 * unir.fuente.js — la página a la que lleva el QR. FUENTE (se compila).
 *
 * `build.mjs` la concatena con el motor de medición del núcleo y escribe
 * `assets/unir.js`. Así la geometría que usa el teléfono invitado es
 * EXACTAMENTE la misma que la del núcleo, sin una copia que se desincronice.
 *
 * Qué corrige esta versión, y conviene decirlo claro: hasta la 1.7.0 esta
 * página solo daba de alta el equipo —probaba la cámara un instante y enviaba
 * sus características—. El catálogo prometía «cámara de la sesión» y el
 * transporte que lo haría posible (`mqtt-ws`) **nunca se implementó**. No había
 * cliente MQTT, ni WebSocket, ni WebRTC en ninguna parte.
 *
 * Lo que sí se puede hacer sin montar infraestructura nueva, usando solo el
 * gateway que la plataforma ya expone: **el teléfono mide aquí mismo y envía el
 * RESULTADO**. La cámara no se transmite —eso necesitaría un broker que no
 * existe—, pero las medidas llegan a la sesión, que es para lo que se quería
 * el segundo teléfono.
 */
(function () {
  'use strict';

  var app = document.getElementById('app');
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

  function leerEnlacePagina(hash) {
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
      dispositivo: partes[1], codigo: partes[2], sesion: partes[3], transporte: partes[4],
      caduca: isFinite(min) && min > 0 ? new Date(min * 60000) : null,
      extras: extras,
      instancia: extras.i || partes[3] || '',
      // El montaje viaja en el código: lo declara quien lleva la sesión y así
      // todos los teléfonos que se unan miden con la misma referencia.
      montaje: {
        alturaCamara: Number(extras.h) || 140,
        inclinacion: Number(extras.t) || 0,
        fovH: Number(extras.f) || 70,
        aspecto: 16 / 9,
        alto: 240, ancho: 220, profundidad: 400, distanciaZona: 300,
      },
      montajeDeclarado: !!(extras.h || extras.f),
    };
  }

  /* ---------------------- qué puede hacer este equipo ---------------------- */

  function mirarEquipo() {
    var d = {
      plataforma: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios'
        : /Android/.test(navigator.userAgent) ? 'android' : 'escritorio',
      pantalla: (screen.width || 0) + 'x' + (screen.height || 0),
      nucleos: navigator.hardwareConcurrency || null,
      memoriaGB: navigator.deviceMemory || null,
      seguro: window.isSecureContext !== false,
      camaras: null, microfonos: null,
      imu: !!(window.DeviceMotionEvent || window.DeviceOrientationEvent),
      gnss: !!navigator.geolocation,
    };
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return Promise.resolve(d);
    return navigator.mediaDevices.enumerateDevices().then(function (lista) {
      d.camaras = lista.filter(function (x) { return x.kind === 'videoinput'; }).length;
      d.microfonos = lista.filter(function (x) { return x.kind === 'audioinput'; }).length;
      return d;
    }).catch(function () { return d; });
  }

  /* ---------------------------- inclinación real ---------------------------- */

  /**
   * Lee la inclinación del teléfono con su propio sensor.
   *
   * Es el error que más pesa en la medición: 1° a 2 m son 3,5 cm. En un
   * teléfono en la mano la inclinación cambia a cada momento, así que
   * declararla a mano no sirve — hay que leerla.
   */
  function vigilarInclinacion(alCambiar) {
    function manejar(ev) {
      // `beta` es el cabeceo: 0 = vertical, 90 = tumbado mirando al suelo.
      if (ev.beta == null) return;
      alCambiar(Math.round(90 - ev.beta));
    }
    function arrancar() {
      window.addEventListener('deviceorientation', manejar, true);
    }
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      // iOS exige pedirlo tras un gesto; si se niega, se sigue sin IMU.
      window.DeviceOrientationEvent.requestPermission().then(function (r) {
        if (r === 'granted') arrancar();
      }).catch(function () { /* sin IMU */ });
    } else if (window.DeviceOrientationEvent) {
      arrancar();
    }
    return function detener() { window.removeEventListener('deviceorientation', manejar, true); };
  }

  /* ------------------------------ la medición ------------------------------ */

  var FUENTES_MOTOR = {
    asset: {
      nombre: 'Servidor de KIMOS',
      modulo: API + '/api/apps/lidaria/asset/pose/vision_bundle.mjs',
      wasm: API + '/api/apps/lidaria/asset/pose/wasm',
      modelo: API + '/api/apps/lidaria/asset/pose/pose_landmarker_lite.task',
    },
    cdn: {
      nombre: 'Internet (jsDelivr)',
      modulo: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
      wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      modelo: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    },
  };

  /** Prueba las fuentes en orden y devuelve la primera que cargue. */
  function cargarMotor(orden) {
    var errores = [];
    function siguiente(i) {
      if (i >= orden.length) {
        return Promise.resolve({ ok: false, errores: errores });
      }
      var f = FUENTES_MOTOR[orden[i]];
      return import(f.modulo).then(function (mod) {
        if (!mod.FilesetResolver || !mod.PoseLandmarker) throw new Error('el módulo no expone PoseLandmarker');
        return mod.FilesetResolver.forVisionTasks(f.wasm).then(function (fileset) {
          return mod.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: f.modelo, delegate: 'GPU' },
            runningMode: 'VIDEO', numPoses: 1,
          });
        }).then(function (lm) { return { ok: true, lm: lm, fuente: f }; });
      }).catch(function (e) {
        errores.push(f.nombre + ': ' + e.message);
        return siguiente(i + 1);
      });
    }
    return siguiente(0);
  }

  function abrirCamara() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Este navegador no expone cámaras.'));
    }
    if (window.isSecureContext === false) {
      return Promise.reject(new Error('La cámara exige HTTPS. Esta página no está en contexto seguro.'));
    }
    var tam = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    return navigator.mediaDevices.getUserMedia({ video: Object.assign({ facingMode: { ideal: 'environment' } }, tam), audio: false })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: tam, audio: false }); })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: true, audio: false }); })
      .catch(function (e) {
        var n = String(e && e.name || '');
        var msg = {
          NotAllowedError: 'Permiso de cámara denegado. Acéptalo y vuelve a intentarlo.',
          NotFoundError: 'Este equipo no tiene cámara.',
          NotReadableError: 'La cámara está ocupada por otra aplicación. Ciérrala y reintenta.',
        };
        throw new Error(msg[n] || (e && e.message) || 'No se pudo abrir la cámara.');
      });
  }

  /* -------------------------------- pantallas -------------------------------- */

  function pintarInvitacion(enlace, def, equipo) {
    limpiar();
    var pub = (def && def.data) || {};
    var c = tarjeta();
    c.appendChild(el('h1', null, pub.titulo || 'Unirse a una sesión'));
    c.appendChild(el('p', 'mini', pub.descripcion || 'Este teléfono va a medir y enviar los resultados a la sesión.'));
    c.appendChild(el('h2', null, 'La sesión'));
    c.appendChild(kv('Código', enlace.codigo || '—'));
    if (pub.organizacion) c.appendChild(kv('Organización', pub.organizacion));
    if (enlace.caduca) c.appendChild(kv('El código caduca', enlace.caduca.toLocaleTimeString()));

    c.appendChild(el('h2', null, 'Este teléfono'));
    c.appendChild(kv('Tipo', equipo.plataforma));
    c.appendChild(kv('Cámaras', equipo.camaras == null ? 'se verá al abrirla' : String(equipo.camaras)));
    c.appendChild(kv('Sensor de inclinación', equipo.imu ? 'sí' : 'no'));
    c.appendChild(kv('HTTPS', equipo.seguro ? 'sí' : 'NO — la cámara no funcionará'));

    var c2 = tarjeta();
    c2.appendChild(el('h2', null, 'Qué va a pasar'));
    var ul = el('ul');
    [
      'Se abre la cámara de ESTE teléfono. El permiso es suyo: no se hereda del equipo que mostró el código.',
      'Se mide a la persona que esté delante, aquí mismo, dentro del navegador.',
      'Se envían los NÚMEROS a la sesión: distancia, estatura, alturas de trabajo. Nada más.',
      'La imagen NO se transmite ni se guarda. No sale de este teléfono.',
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    c2.appendChild(ul);

    if (!enlace.montajeDeclarado) {
      c2.appendChild(el('p', 'aviso', 'El código no trae el montaje de cámara declarado, así que los centímetros '
        + 'saldrán de valores supuestos y el error será mayor. Quien lleva la sesión puede declararlo en la pestaña Montaje y generar un código nuevo.'));
    }

    var boton = el('button', null, 'Abrir la cámara y medir');
    c2.appendChild(boton);
    var solo = el('button', 'sec', 'Solo darme de alta, sin medir');
    c2.appendChild(solo);

    boton.addEventListener('click', function () { pintarMidiendo(enlace, equipo); });
    solo.addEventListener('click', function () {
      solo.disabled = boton.disabled = true;
      enviar(enlace, equipo, null, null);
    });
  }

  function pintarMidiendo(enlace, equipo) {
    limpiar();
    var c = tarjeta();
    c.appendChild(el('h1', null, 'Midiendo'));
    var estado = el('p', 'mini', 'Abriendo la cámara…');
    c.appendChild(estado);

    var caja = el('div', 'camara');
    var video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.muted = true;
    var lienzo = document.createElement('canvas');
    caja.appendChild(video); caja.appendChild(lienzo);
    c.appendChild(caja);

    var lectura = el('div');
    c.appendChild(lectura);

    var cInc = tarjeta();
    cInc.appendChild(el('h2', null, 'Montaje de este teléfono'));
    cInc.appendChild(el('p', 'mini', 'La inclinación se lee del sensor; la altura del lente la pones tú. '
      + 'Es lo que más pesa en el resultado: 1° de error son 3,5 cm a 2 m.'));
    var filaAltura = el('label', null);
    filaAltura.appendChild(el('span', 'mini', 'Altura del lente sobre el suelo (cm)'));
    var inpAltura = document.createElement('input');
    inpAltura.type = 'number'; inpAltura.min = '30'; inpAltura.max = '250';
    inpAltura.value = String(enlace.montaje.alturaCamara);
    filaAltura.appendChild(inpAltura);
    cInc.appendChild(filaAltura);
    var infoInc = el('div');
    cInc.appendChild(infoInc);

    var montaje = Object.assign({}, enlace.montaje);
    var incLeida = null;
    inpAltura.addEventListener('input', function () {
      var v = Number(inpAltura.value);
      if (isFinite(v) && v > 20) montaje.alturaCamara = v;
    });
    var pararIMU = vigilarInclinacion(function (grados) {
      incLeida = grados;
      montaje.inclinacion = grados;
      infoInc.textContent = '';
      infoInc.appendChild(kv('Inclinación leída del sensor', grados + '°'));
    });
    if (!equipo.imu) {
      infoInc.appendChild(el('p', 'aviso', 'Este equipo no expone el sensor de inclinación: se usa '
        + enlace.montaje.inclinacion + '° del código. Sostén el teléfono lo más vertical que puedas.'));
    }

    var ultima = null;
    var boton = el('button', null, 'Enviar esta medida a la sesión');
    boton.disabled = true;
    c.appendChild(boton);
    var salir = el('button', 'sec', 'Cancelar');
    c.appendChild(salir);

    var vivo = true;
    var detenerTodo = function () {
      vivo = false;
      pararIMU();
      try { if (window.__lidStream) window.__lidStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* noop */ }
    };
    salir.addEventListener('click', function () { detenerTodo(); pintarInvitacion(enlace, null, equipo); });
    boton.addEventListener('click', function () {
      boton.disabled = true;
      detenerTodo();
      enviar(enlace, equipo, ultima, montaje);
    });

    abrirCamara().then(function (stream) {
      window.__lidStream = stream;
      video.srcObject = stream;
      return video.play().catch(function () {});
    }).then(function () {
      estado.textContent = 'Cargando el motor de medición…';
      // Primero el servidor de KIMOS: en una faena sin cobertura es la única
      // vía. Si no está ahí, se intenta internet.
      return cargarMotor(['asset', 'cdn']);
    }).then(function (motor) {
      if (!motor.ok) {
        estado.textContent = '';
        lectura.appendChild(el('p', 'aviso', 'No se pudo cargar el motor de medición. ' + motor.errores.join(' · ')));
        lectura.appendChild(el('p', 'mini', 'Se puede dar de alta el equipo igual: la cámara funciona, '
          + 'lo que falta es el modelo. Quien administra KIMOS puede dejarlo en el servidor con `node tools/descargar-pose.mjs`.'));
        boton.textContent = 'Darme de alta sin medir';
        boton.disabled = false;
        return;
      }
      estado.textContent = 'Ponte de frente, a unos 2 metros, y que se te vean los pies.';
      var ctx = lienzo.getContext('2d');
      var ultimoTs = -1, cuadros = 0, marca = performance.now(), fps = null;

      function bucle() {
        if (!vivo) return;
        var t = performance.now();
        if (video.readyState >= 2 && t - ultimoTs >= 33) {
          ultimoTs = t;
          var res = null;
          try { res = motor.lm.detectForVideo(video, t); } catch (e) { res = null; }
          var L = (res && res.landmarks && res.landmarks[0]) || null;
          cuadros++;
          if (t - marca >= 1000) { fps = Math.round(cuadros * 1000 / (t - marca)); cuadros = 0; marca = t; }

          var w = lienzo.width = video.videoWidth || 640;
          var h = lienzo.height = video.videoHeight || 480;
          ctx.clearRect(0, 0, w, h);
          var med = null;
          if (L) {
            med = medirCuerpo(L, montaje, {});
            ctx.fillStyle = med && med.ok ? '#16a34a' : '#f59e0b';
            for (var i = 0; i < L.length; i++) {
              var p = L[i];
              if (!p || (p.visibility != null && p.visibility <= 0.4)) continue;
              ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(3, w / 200), 0, 6.3); ctx.fill();
            }
          }
          var enc = encuadreDePose(L, 'completo', montaje);
          lectura.textContent = '';
          if (!L) {
            lectura.appendChild(el('p', 'mini', 'Sin persona en cuadro' + (fps == null ? '' : ' · ' + fps + ' fps')));
            boton.disabled = true;
          } else if (!enc.ok) {
            lectura.appendChild(el('p', 'aviso', enc.motivo));
            boton.disabled = true;
          } else if (!med || !med.ok) {
            lectura.appendChild(el('p', 'aviso', (med && med.motivo) || 'Sin medida'));
            boton.disabled = true;
          } else {
            ultima = med;
            lectura.appendChild(kv('Distancia', med.distancia.toFixed(0) + ' cm'));
            lectura.appendChild(kv('Estatura', med.altura == null ? 'no se ven los pies' : med.altura.toFixed(0) + ' cm'));
            lectura.appendChild(kv('Margen', '±' + med.errorCm.toFixed(0) + ' cm'));
            if (fps != null) lectura.appendChild(kv('Cuadros por segundo', String(fps)));
            boton.disabled = false;
            boton.textContent = 'Enviar esta medida a la sesión';
          }
        }
        requestAnimationFrame(bucle);
      }
      requestAnimationFrame(bucle);
    }).catch(function (e) {
      detenerTodo();
      var c3 = error('No se pudo medir', e.message,
        'Se puede dar de alta el equipo igual, para que la sesión sepa que existe.');
      var b = el('button', null, 'Darme de alta sin medir');
      c3.appendChild(b);
      b.addEventListener('click', function () { b.disabled = true; enviar(enlace, equipo, null, null); });
    });
  }

  function pintarUnido(enlace, equipo, med) {
    limpiar();
    var c = tarjeta();
    c.appendChild(el('h1', null, med ? '✅ Medida enviada' : '✅ Este equipo se unió'));
    c.appendChild(el('p', 'aviso ok', 'La sesión ' + (enlace.codigo || '') + ' ya lo tiene.'));
    if (med) {
      c.appendChild(el('h2', null, 'Lo que se envió'));
      c.appendChild(kv('Distancia', med.distancia.toFixed(0) + ' cm'));
      if (med.altura != null) c.appendChild(kv('Estatura', med.altura.toFixed(0) + ' cm'));
      c.appendChild(kv('Margen', '±' + med.errorCm.toFixed(0) + ' cm'));
      c.appendChild(el('p', 'mini', 'Solo los números. La imagen no salió de este teléfono.'));
    }
    var otra = el('button', null, med ? 'Medir a otra persona' : 'Medir ahora');
    c.appendChild(otra);
    otra.addEventListener('click', function () { pintarMidiendo(enlace, equipo); });
  }

  function enviar(enlace, equipo, med, montaje) {
    var carga = {
      codigo: String(enlace.codigo || ''),
      dispositivo: String(enlace.dispositivo || ''),
      plataforma: String(equipo.plataforma),
      pantalla: String(equipo.pantalla || ''),
      nucleos: String(equipo.nucleos || ''),
      camaras: String(equipo.camaras == null ? '' : equipo.camaras),
      imu: equipo.imu ? 'si' : 'no',
      seguro: equipo.seguro ? 'si' : 'no',
      agente: String(navigator.userAgent || '').slice(0, 150),
      _hp: '',
    };
    if (med && montaje) {
      carga.midio = 'si';
      carga.distanciaCm = String(Math.round(med.distancia));
      carga.estaturaCm = med.altura == null ? '' : String(Math.round(med.altura));
      carga.margenCm = String(Math.round(med.errorCm));
      carga.apoyo = String(med.apoyo || '');
      carga.hombrosCm = med.segmentos && med.segmentos.anchoHombros ? String(Math.round(med.segmentos.anchoHombros)) : '';
      carga.alturaHombroCm = med.alturas && med.alturas.hombro ? String(Math.round(med.alturas.hombro)) : '';
      carga.alturaCodoCm = med.alturas && med.alturas.codo ? String(Math.round(med.alturas.codo)) : '';
      carga.montajeAlturaCm = String(Math.round(montaje.alturaCamara));
      carga.montajeInclinacion = String(Math.round(montaje.inclinacion));
      carga.montajeFov = String(Math.round(montaje.fovH));
    } else {
      carga.midio = 'no';
    }
    fetch(API + '/api/public/app/' + encodeURIComponent(enlace.instancia) + '/submit/unir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(carga),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      pintarUnido(enlace, equipo, med);
    }).catch(function (e) {
      var c = error('No se pudo avisar a la sesión',
        'La medida se tomó bien; lo que falló fue el envío (' + e.message + ').',
        'Dicta el código ' + (enlace.codigo || '') + ' y los números a quien lleva la sesión.');
      if (med) {
        c.appendChild(kv('Distancia', med.distancia.toFixed(0) + ' cm'));
        if (med.altura != null) c.appendChild(kv('Estatura', med.altura.toFixed(0) + ' cm'));
      }
    });
  }

  /* -------------------------------- arranque -------------------------------- */

  var enlace = leerEnlacePagina(window.location.hash || window.location.search);
  if (!enlace) {
    error('Falta el código',
      'Esta página se abre escaneando el QR de una sesión de LiDARia; sola no hace nada.',
      'Vuelve a escanear, o pide el código corto de seis caracteres.');
    return;
  }
  if (enlace.versionRara) {
    error('Código de otra versión',
      'Lo generó una versión distinta de la app (formato ' + enlace.versionRara + ').',
      'Pide un código nuevo.');
    return;
  }
  if (enlace.caduca && enlace.caduca < new Date()) {
    error('El código caducó',
      'Los códigos valen quince minutos: van escritos en una pantalla a la vista, así que el plazo es lo que los protege.',
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
    // Sin sesión se puede medir igual: lo que no se podrá es enviar el
    // resultado, y eso se dice cuando toque.
    mirarEquipo().then(function (equipo) {
      var c = error('No se pudo contactar con la sesión',
        'La página cargó, pero el servidor de KIMOS no respondió (' + e.message + ').',
        'Comprueba que este teléfono esté en la misma red que KIMOS.');
      c.appendChild(kv('Código para dictar', enlace.codigo || '—'));
      var b = el('button', null, 'Medir de todas formas');
      c.appendChild(b);
      b.addEventListener('click', function () { pintarMidiendo(enlace, equipo); });
    });
  });
})();
