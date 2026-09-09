/**
 * AIEP INSCRIPCIÓN — acreditación por RUT en el totem del Seminario
 * «IA y Protección de Datos», Sede AIEP San Joaquín.
 *
 * QUÉ HACE: el asistente llega, marca su RUT en el teclado de la pantalla y
 * queda registrado como que asistió. Nada más.
 *
 * SOLO SE ACREDITA QUIEN ESTÁ EN LA LISTA. Si el RUT no viene del formulario
 * de inscripción, el totem lo dice y ahí termina: no hay registro en el
 * momento, no hay formulario, no hay excepciones desde la pantalla. Quien no
 * esté inscrito se resuelve en el mesón, con una persona.
 *
 * CORRE EN LA VITRINA, y eso manda sobre cómo guarda. En la vitrina no hay
 * sesión: el host público le da a la app un shell EFÍMERO, donde `shell.items`
 * escribe en memoria del navegador y se pierde al recargar. Así que la
 * acreditación viaja por el gateway público del creator pack (APP-SPEC §7.b):
 *
 *     POST {api}/api/public/app/{instanceId}/submit/asistencia
 *
 * donde `{instanceId}` es la instancia de AIEP GESTIÓN. No hace falta ningún
 * endpoint nuevo en kimos-enterprice ni tocar setup-kimos.
 *
 * EL ÚNICO DATO QUE NECESITA es ese identificador, y llega en la URL de la
 * vitrina como `?aiep=ID` (después queda guardado en el equipo). El endpoint
 * del gateway se direcciona POR INSTANCIA: no hay forma de descubrirla sola.
 *
 * Y SI NO LO TIENE, NO FINGE. Un totem sin emparejar no deja acreditar: avisa
 * en la portada. Mostrar «✓ Asistencia registrada» a alguien cuyo registro no
 * va a llegar a ninguna parte es el peor fallo que puede tener esto.
 *
 * SIN RED NO SE PIERDE NADIE: lo que no sale se encola en el equipo y se
 * reintenta solo. El pie muestra cuántos quedan.
 *
 * EL AGENTE ES CONSULTIVO: busca en el padrón y explica el trámite, pero la
 * acreditación la confirma la persona con su propio toque.
 */

// Mantener en sincronía con manifest.json y con el catálogo raíz /manifest.json.
const APP_VERSION = '3.2.1';

/* ── El seminario (mismos datos que ANFITRIÓN AIEP) ───────────────────── */

const EVENTO = {
  rotulo: 'Seminario',
  titulo: 'IA y Protección de Datos',
  subtitulo: 'Lo que todo negocio debe saber para no quedarse atrás',
  dia: '03',
  mes: 'Septiembre',
  anio: '2026',
  diaSemana: 'Jueves',
  horarioTexto: '09:30 a 14:00 hrs',
  sede: 'Sede AIEP San Joaquín',
  direccion: 'Av. Vicuña Mackenna 4685, San Joaquín',
  region: 'Región Metropolitana',
  metro: 'Metro San Joaquín · Línea 5',
};

const PIE = {
  copyright: '© 2026 AIEP · Centros de Negocios SERCOTEC',
  plataforma: 'Powered by',
};

/* Canal del gateway por el que viaja cada acreditación. AIEP GESTIÓN lo
   declara en `definition.public.channels` al abrirse. */
const CANAL = 'asistencia';

const LS_COLA = 'aiep.inscripcion.cola.v3';
const LS_INSTANCIA = 'aiep.inscripcion.instancia.v3';

/* Instancia de AIEP GESTIÓN del seminario, puesta de fábrica.
 *
 * Esta app existe para UN evento y UNA gestión, así que el código va aquí y el
 * totem funciona nada más abrirlo: sin parámetros en la URL, sin pantallas de
 * emparejamiento y sin nada que pegar.
 *
 * Se puede pisar con `?aiep=OTRO-ID` en la URL de la vitrina — es lo que hay
 * que usar si en gestión se crea un documento NUEVO, porque entonces cambia el
 * identificador. El de aquí es el del documento que ya existe. */
const INSTANCIA_GESTION = 'aiep.gestion-7dc06969';

/* Topes del gateway público (backend/appPublicAPI.py), que mandan sobre cómo
   se envía esto:
   - 8 peticiones por IP+instancia cada 5 minutos. Un totem en la fila de
     acreditación se come ese tope en un minuto si manda una petición por
     persona, así que se agrupan en un LOTE por petición.
   - El saneo descarta objetos y listas anidados y recorta cada valor a 5.000
     caracteres. Por eso el lote viaja como UN campo de texto con JSON dentro,
     que AIEP GESTIÓN vuelve a abrir al leerlo.
   - Una petición por vaciado y 40 s de espaciado: 7 u 8 peticiones por
     ventana, con hasta 12 personas cada una. ~90 acreditaciones cada 5
     minutos, muy por encima del ritmo de una fila real. */
const LOTE_MAX_PERSONAS = 12;
const LOTE_MAX_CARACTERES = 4500;
/* Presupuesto real del gateway: 8 peticiones por IP+instancia cada 300 s. En
   vez de espaciar a ciegas 40 s —que hace esperar al segundo envío aunque no
   haya gastado nada— se lleva la cuenta de las peticiones de la ventana y se
   sale enseguida mientras quede presupuesto. Así la primera persona aparece en
   gestión en segundos, que es lo que se mira al probar que funciona, y en hora
   punta el ritmo se frena solo antes de chocar contra el 429. */
const VENTANA_MS = 300000;
const PETICIONES_POR_VENTANA = 6;   // 6 de 8: se deja aire para reintentos
const ENVIO_MIN_MS = 4000;          // agrupa la ráfaga de la fila sin hacer esperar
const ESPERA_429_MS = 70000;
/* Códigos en los que el envío ES el problema y reintentarlo no arregla nada.
   Todo lo demás se reintenta: ver el comentario en vaciarCola. */
const RECHAZOS_DEFINITIVOS = new Set([400, 413, 422]);
const VOLVER_MS = 12000;

/* ── RUT ──────────────────────────────────────────────────────────────── */

function normalizarRut(bruto) {
  return String(bruto || '').toUpperCase().replace(/[^0-9K]/g, '');
}

/** Dígito verificador por módulo 11, la regla del Registro Civil. */
function digitoVerificador(cuerpo) {
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

const rutValido = (b) => {
  const r = normalizarRut(b);
  return /^\d{7,8}[0-9K]$/.test(r) && digitoVerificador(r.slice(0, -1)) === r.slice(-1);
};

/** 172716067 → 17.271.606-7. Con puntos: en papel el RUT se lee así. */
function formatearRut(bruto) {
  const r = normalizarRut(bruto);
  if (!r) return '';
  if (r.length === 1) return r;
  return r.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + r.slice(-1);
}

/* ── Utilidades ───────────────────────────────────────────────────────── */

const pad2 = (n) => String(n).padStart(2, '0');
const horaDe = (ts) => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function leerLS(clave, porDefecto) {
  try {
    const bruto = globalThis.localStorage && globalThis.localStorage.getItem(clave);
    if (!bruto) return porDefecto;
    const v = JSON.parse(bruto);
    return v == null ? porDefecto : v;
  } catch (e) { return porDefecto; }
}

function escribirLS(clave, valor) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) { /* modo privado o cuota llena: la jornada sigue igual */ }
}

/* Teclado numérico en pantalla: el totem no tiene teclado físico. */
const TECLAS_NUM = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'K', '0'];

/* ── Gateway ──────────────────────────────────────────────────────────── */

/**
 * Base del backend, deducida del propio shell: `assetUrl` devuelve
 * `{api}/api/apps/{appId}/asset/…`, así que el prefijo hasta `/api/` es la
 * base del gateway. Se deduce en vez de cablearse porque la vitrina y el
 * shell de sesión no siempre viven en el mismo origen.
 */
function baseApi(shell) {
  try {
    const u = shell.assetUrl('x');
    const i = u.indexOf('/api/apps/');
    if (i > 0) return u.slice(0, i);
    if (i === 0) return '';
  } catch (e) { /* host sin assetUrl: mismo origen */ }
  return '';
}

/**
 * Instancia de AIEP GESTIÓN a la que van las acreditaciones. Llega en la URL
 * de la vitrina (`?aiep=ID`) y desde ahí queda guardada en el equipo, para que
 * una recarga sin el parámetro no deje el totem huérfano.
 */
function resolverInstancia() {
  try {
    const loc = globalThis.location || {};
    // La vitrina puede montarse como `?vitrina=TOKEN` o como `/vitrina/TOKEN`,
    // y el parámetro puede acabar en la query o tras el hash. Se mira en ambos.
    const q = new URLSearchParams(String(loc.search || ''));
    const hash = String(loc.hash || '').replace(/^#/, '');
    const qh = new URLSearchParams(hash.indexOf('?') >= 0 ? hash.slice(hash.indexOf('?') + 1) : hash);
    const deUrl = String(q.get('aiep') || qh.get('aiep') || '').trim();
    if (deUrl) { escribirLS(LS_INSTANCIA, deUrl); return deUrl; }
  } catch (e) { /* sin location */ }
  const guardada = String(leerLS(LS_INSTANCIA, '') || '').trim();
  if (guardada) return guardada;
  return INSTANCIA_GESTION;
}

/* ── Logo de la sede anfitriona, extraído del .docx del programa ─────── */
const LOGO_AIEP = 'data:image/png;base64,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';

/* ── Logotipo de Kimos para el pie (mismo que el resto de los totem) ──── */
const KIMOS_LOGO = {
  viewBox: '0 0 706 144',
  d: 'M0 0 L46 39 L46 67 L48 67 L51 63 L53 63 L57 58 L59 58 L63 53 L65 53 L69 48 L71 48 L75 43 L77 43 L81 38 L83 38 L87 33 L89 33 L93 28 L95 28 L99 23 L101 23 L105 18 L107 18 L111 13 L113 13 L113 12 L70 12 L70 29 L66 31 L62 36 L59 37 L59 0 L141 0 L133 9 L131 9 L122 19 L120 19 L101 38 L99 38 L94 44 L92 44 L86 51 L84 51 L79 57 L77 57 L71 64 L69 64 L63 71 L61 71 L56 77 L54 77 L48 84 L46 84 L37 93 L36 93 L36 44 L34 44 L29 38 L27 38 L22 32 L20 32 L16 27 L14 27 L11 24 L11 121 L13 121 L20 114 L22 114 L26 109 L28 109 L32 104 L34 104 L38 99 L40 99 L50 89 L52 89 L55 85 L57 85 L61 80 L66 79 L72 86 L74 86 L80 93 L82 93 L88 100 L90 100 L97 108 L99 108 L105 115 L107 115 L113 122 L115 122 L122 130 L124 130 L138 144 L59 144 L59 110 L61 110 L66 116 L70 118 L70 133 L71 134 L111 134 L105 127 L103 127 L99 122 L97 122 L92 116 L90 116 L86 111 L84 111 L79 105 L77 105 L66 94 L62 94 L59 98 L57 98 L54 102 L52 102 L49 106 L47 106 L44 110 L42 110 L39 114 L37 114 L34 118 L32 118 L29 122 L27 122 L24 126 L22 126 L19 130 L17 130 L14 134 L12 134 L9 138 L7 138 L4 142 L0 144ZM167 0 L185 0 L185 144 L167 144ZM209 0 L233 0 L235 4 L240 8 L240 10 L245 14 L245 16 L250 20 L250 22 L255 26 L255 28 L260 32 L260 34 L265 38 L265 40 L270 44 L270 46 L275 50 L275 52 L280 56 L280 58 L286 63 L286 65 L290 69 L292 69 L292 67 L299 61 L299 59 L306 53 L306 51 L312 46 L312 44 L319 38 L319 36 L326 30 L326 28 L333 22 L333 20 L340 14 L340 12 L347 6 L347 4 L351 0 L375 0 L375 144 L357 144 L357 22 L354 23 L354 25 L347 31 L347 33 L341 38 L341 40 L334 46 L334 48 L328 53 L328 55 L321 61 L321 63 L315 68 L315 70 L308 76 L308 78 L302 83 L302 85 L295 91 L295 93 L291 97 L282 88 L282 86 L276 81 L276 79 L271 75 L271 73 L265 68 L265 66 L259 61 L259 59 L254 55 L254 53 L248 48 L248 46 L242 41 L242 39 L237 35 L237 33 L231 28 L231 26 L226 22 L226 144 L209 144ZM409 0 L526 0 L526 1 L530 1 L534 3 L538 7 L540 14 L541 14 L541 131 L540 131 L539 136 L534 141 L530 143 L526 143 L526 144 L409 144 L409 143 L404 142 L397 135 L396 129 L395 129 L395 15 L396 15 L396 12 L399 6 L402 3 L409 1ZM581 0 L692 0 L692 1 L699 2 L700 4 L703 5 L705 12 L706 12 L706 30 L689 30 L687 21 L680 17 L583 17 L578 21 L578 25 L577 25 L577 60 L582 65 L586 65 L586 66 L693 66 L693 67 L696 67 L704 76 L705 83 L706 83 L706 130 L705 130 L705 134 L703 138 L699 142 L695 144 L576 144 L576 143 L571 142 L565 137 L562 131 L562 116 L577 116 L580 126 L585 129 L681 129 L681 128 L685 128 L689 121 L689 85 L684 81 L681 81 L681 80 L580 80 L580 79 L575 79 L569 76 L564 71 L563 66 L562 66 L562 16 L563 16 L565 9 L570 4 L576 1 L581 1ZM426 18 L418 21 L413 31 L413 116 L414 116 L415 122 L419 126 L426 128 L426 129 L508 129 L508 128 L514 128 L514 127 L519 126 L522 123 L523 118 L524 118 L524 29 L523 29 L522 24 L518 20 L511 19 L511 18Z',
};

const KIMOS_ICONO = {
  viewBox: '0 0 298 341',
  d: 'M145 0 L151 0 L151 1 L155 2 L156 5 L158 5 L159 7 L165 9 L166 11 L172 13 L173 15 L179 17 L180 19 L186 21 L187 23 L193 25 L194 27 L200 29 L201 31 L207 33 L208 35 L214 37 L215 39 L221 41 L222 43 L228 45 L229 47 L235 49 L236 51 L238 51 L238 52 L242 53 L243 55 L249 57 L250 59 L256 61 L257 63 L259 63 L262 66 L268 68 L269 70 L275 72 L276 74 L282 76 L283 78 L291 81 L296 86 L296 88 L298 90 L298 250 L297 250 L296 255 L288 263 L286 263 L285 265 L279 267 L278 269 L274 270 L273 272 L271 272 L271 273 L267 274 L266 276 L260 278 L259 280 L255 281 L254 283 L248 285 L247 287 L245 287 L242 290 L236 292 L235 294 L231 295 L230 297 L224 299 L223 301 L219 302 L218 304 L212 306 L211 308 L207 309 L206 311 L200 313 L199 315 L195 316 L194 318 L188 320 L187 322 L183 323 L182 325 L180 325 L180 326 L176 327 L175 329 L169 331 L168 333 L164 334 L163 336 L161 336 L161 337 L159 337 L155 340 L151 340 L151 341 L141 340 L141 339 L137 338 L136 336 L130 334 L129 332 L127 332 L127 331 L123 330 L122 328 L116 326 L115 324 L111 323 L110 321 L104 319 L103 317 L101 317 L101 316 L97 315 L96 313 L90 311 L89 309 L83 307 L82 305 L78 304 L77 302 L75 302 L75 301 L71 300 L70 298 L64 296 L63 294 L57 292 L56 290 L52 289 L51 287 L45 285 L44 283 L42 283 L42 282 L38 281 L37 279 L31 277 L30 275 L24 273 L23 271 L19 270 L18 268 L12 266 L11 264 L9 264 L5 261 L5 259 L3 258 L3 256 L1 254 L1 251 L0 251 L0 91 L1 91 L1 87 L9 79 L15 77 L16 75 L22 73 L23 71 L29 69 L30 67 L36 65 L37 63 L43 61 L44 59 L50 57 L51 55 L57 53 L58 51 L64 49 L65 47 L71 45 L72 43 L78 41 L79 39 L85 37 L86 35 L92 33 L93 31 L99 29 L100 27 L106 25 L107 23 L113 21 L114 19 L116 19 L116 18 L120 17 L121 15 L127 13 L128 11 L134 9 L135 7 L139 6ZM152 11 L148 14 L147 21 L146 21 L146 24 L145 24 L145 27 L144 27 L144 30 L143 30 L143 33 L142 33 L142 37 L141 37 L141 40 L140 40 L140 43 L139 43 L139 46 L138 46 L138 49 L137 49 L137 53 L136 53 L136 56 L141 60 L142 63 L157 65 L157 66 L163 66 L163 67 L176 68 L176 69 L182 69 L182 70 L188 70 L188 71 L207 73 L207 74 L213 74 L213 75 L220 75 L220 76 L226 76 L226 77 L232 77 L232 78 L238 78 L238 79 L245 79 L245 80 L251 80 L251 81 L257 81 L257 82 L263 82 L263 83 L269 83 L269 84 L283 85 L279 81 L271 78 L270 76 L264 74 L263 72 L257 70 L256 68 L250 66 L249 64 L241 61 L240 59 L234 57 L233 55 L227 53 L226 51 L220 49 L219 47 L211 44 L210 42 L204 40 L203 38 L197 36 L196 34 L190 32 L189 30 L181 27 L180 25 L174 23 L173 21 L167 19 L166 17 L160 15 L159 13 L157 13 L155 11ZM140 12 L138 14 L132 16 L131 18 L125 20 L124 22 L120 23 L119 25 L113 27 L112 29 L106 31 L105 33 L99 35 L98 37 L92 39 L91 41 L85 43 L84 45 L78 47 L77 49 L73 50 L72 52 L66 54 L65 56 L59 58 L58 60 L52 62 L51 64 L45 66 L44 68 L38 70 L37 72 L31 74 L30 76 L24 78 L23 80 L18 82 L18 85 L27 84 L27 83 L31 83 L31 82 L36 82 L36 81 L40 81 L40 80 L45 80 L45 79 L49 79 L49 78 L54 78 L54 77 L58 77 L58 76 L63 76 L63 75 L67 75 L67 74 L72 74 L72 73 L76 73 L76 72 L80 72 L80 71 L85 71 L85 70 L89 70 L89 69 L94 69 L94 68 L98 68 L98 67 L103 67 L103 66 L119 63 L124 57 L126 57 L127 55 L129 55 L131 53 L131 50 L132 50 L132 47 L133 47 L133 44 L134 44 L134 41 L135 41 L135 38 L136 38 L136 35 L137 35 L137 32 L138 32 L138 29 L139 29 L139 26 L140 26 L140 23 L141 23 L141 19 L142 19 L142 16 L143 16 L143 12ZM118 69 L108 71 L108 72 L98 73 L98 74 L94 74 L94 75 L89 75 L89 76 L85 76 L85 77 L75 78 L75 79 L71 79 L71 80 L61 81 L61 82 L57 82 L57 83 L52 83 L52 84 L48 84 L48 85 L43 85 L43 86 L38 86 L38 87 L34 87 L34 88 L20 90 L20 91 L18 91 L16 96 L14 98 L12 98 L14 106 L16 108 L16 111 L18 113 L18 116 L20 118 L20 121 L22 123 L22 126 L23 126 L24 131 L26 133 L27 139 L29 141 L29 144 L31 146 L31 149 L33 151 L33 154 L35 156 L35 159 L37 161 L37 164 L38 164 L39 169 L40 169 L41 172 L45 172 L48 169 L48 167 L51 165 L51 163 L54 161 L54 159 L57 157 L59 152 L62 150 L62 148 L65 146 L65 144 L68 142 L68 140 L71 138 L71 136 L74 134 L74 132 L77 130 L77 128 L80 126 L80 124 L83 122 L83 120 L86 118 L86 116 L89 114 L89 112 L95 106 L97 101 L100 99 L100 97 L103 95 L103 93 L106 91 L106 89 L109 87 L109 85 L112 83 L112 81 L115 79 L115 77 L121 71 L121 69ZM145 70 L144 70 L144 72 L154 81 L154 83 L166 94 L166 96 L178 107 L178 109 L191 121 L191 123 L203 134 L203 136 L216 148 L216 150 L228 162 L231 161 L231 160 L236 161 L238 159 L238 157 L241 155 L243 150 L246 148 L246 146 L249 144 L249 142 L252 140 L254 135 L257 133 L257 131 L260 129 L260 127 L263 125 L265 120 L268 118 L268 116 L271 114 L271 112 L274 110 L276 105 L279 103 L279 101 L283 97 L283 94 L282 94 L281 90 L274 90 L274 89 L268 89 L268 88 L261 88 L261 87 L255 87 L255 86 L248 86 L248 85 L242 85 L242 84 L228 83 L228 82 L222 82 L222 81 L215 81 L215 80 L209 80 L209 79 L202 79 L202 78 L196 78 L196 77 L189 77 L189 76 L182 76 L182 75 L176 75 L176 74 L169 74 L169 73ZM126 74 L122 77 L122 79 L119 81 L119 83 L116 85 L116 87 L113 89 L113 91 L110 93 L110 95 L107 97 L107 99 L104 101 L104 103 L101 105 L101 107 L98 109 L98 111 L95 113 L95 115 L92 117 L92 119 L89 121 L89 123 L86 125 L86 127 L83 129 L83 131 L80 133 L80 135 L77 137 L77 139 L74 141 L74 143 L71 145 L71 147 L68 149 L68 151 L65 153 L65 155 L62 157 L62 159 L59 161 L59 163 L56 165 L56 167 L50 173 L50 175 L51 175 L51 186 L50 187 L57 194 L59 194 L65 201 L67 201 L73 208 L75 208 L81 215 L83 215 L88 221 L90 221 L96 228 L98 228 L104 235 L106 235 L112 242 L114 242 L120 249 L122 249 L128 256 L130 256 L136 263 L138 263 L141 267 L152 267 L156 263 L156 261 L160 258 L160 256 L164 253 L164 251 L168 248 L168 246 L177 237 L177 235 L181 232 L181 230 L185 227 L185 225 L189 222 L189 220 L193 217 L193 215 L197 212 L197 210 L202 206 L202 204 L210 196 L210 194 L214 191 L214 189 L218 186 L218 184 L222 181 L222 179 L224 178 L223 177 L223 168 L224 168 L224 166 L213 156 L213 154 L202 144 L202 142 L191 132 L191 130 L180 120 L180 118 L169 108 L169 106 L158 96 L158 94 L147 84 L147 82 L139 74ZM291 97 L286 100 L286 102 L283 104 L281 109 L275 115 L273 120 L270 122 L270 124 L267 126 L265 131 L262 133 L260 138 L257 140 L257 142 L254 144 L252 149 L249 151 L249 153 L246 155 L246 157 L244 158 L244 160 L240 164 L240 167 L241 167 L240 179 L243 181 L243 183 L246 185 L246 187 L249 189 L249 191 L252 193 L252 195 L255 197 L255 199 L258 201 L258 203 L261 205 L261 207 L264 209 L264 211 L267 213 L267 215 L270 217 L270 219 L273 221 L273 223 L276 225 L276 227 L279 229 L279 231 L282 233 L282 235 L286 238 L286 240 L288 242 L291 242ZM8 102 L7 102 L7 243 L10 242 L10 240 L11 240 L11 238 L12 238 L12 236 L13 236 L13 234 L14 234 L14 232 L15 232 L15 230 L16 230 L16 228 L17 228 L17 226 L18 226 L18 224 L19 224 L19 222 L20 222 L20 220 L21 220 L21 218 L22 218 L22 216 L23 216 L23 214 L24 214 L24 212 L25 212 L25 210 L26 210 L26 208 L27 208 L27 206 L28 206 L28 204 L29 204 L29 202 L30 202 L30 200 L31 200 L31 198 L32 198 L32 196 L35 192 L34 179 L35 179 L35 175 L36 175 L35 171 L33 169 L32 163 L30 161 L30 158 L28 156 L28 153 L26 151 L26 148 L24 146 L21 135 L19 133 L19 130 L17 128 L17 125 L15 123 L15 120 L13 118 L12 112 L11 112 L10 107 L8 105ZM228 182 L223 187 L223 189 L219 192 L219 194 L215 197 L215 199 L211 202 L211 204 L206 208 L206 210 L202 213 L202 215 L198 218 L198 220 L194 223 L194 225 L190 228 L190 230 L186 233 L186 235 L182 238 L182 240 L173 249 L173 251 L169 254 L169 256 L165 259 L165 261 L161 264 L161 266 L157 269 L157 273 L170 271 L170 270 L176 270 L176 269 L182 269 L182 268 L188 268 L188 267 L194 267 L194 266 L200 266 L200 265 L206 265 L206 264 L212 264 L212 263 L218 263 L218 262 L224 262 L224 261 L230 261 L230 260 L236 260 L236 259 L242 259 L242 258 L248 258 L248 257 L254 257 L254 256 L259 256 L259 255 L282 252 L283 245 L280 243 L278 238 L275 236 L273 231 L270 229 L268 224 L265 222 L265 220 L263 219 L261 214 L258 212 L258 210 L253 205 L253 203 L248 198 L248 196 L243 191 L243 189 L238 184 L238 182ZM47 191 L44 192 L44 193 L39 193 L39 195 L38 195 L38 197 L37 197 L37 199 L36 199 L36 201 L35 201 L35 203 L34 203 L34 205 L33 205 L33 207 L32 207 L32 209 L31 209 L31 211 L30 211 L30 213 L29 213 L29 215 L28 215 L28 217 L27 217 L27 219 L26 219 L26 221 L25 221 L25 223 L24 223 L24 225 L23 225 L23 227 L22 227 L22 229 L21 229 L21 231 L20 231 L20 233 L19 233 L19 235 L18 235 L18 237 L17 237 L17 239 L16 239 L16 241 L15 241 L15 243 L12 247 L14 252 L26 253 L26 254 L32 254 L32 255 L39 255 L39 256 L45 256 L45 257 L52 257 L52 258 L58 258 L58 259 L65 259 L65 260 L71 260 L71 261 L78 261 L78 262 L85 262 L85 263 L91 263 L91 264 L98 264 L98 265 L104 265 L104 266 L111 266 L111 267 L117 267 L117 268 L124 268 L124 269 L130 269 L130 270 L136 270 L136 268 L131 263 L129 263 L124 257 L122 257 L117 251 L115 251 L110 245 L108 245 L103 239 L101 239 L96 233 L94 233 L89 227 L87 227 L82 221 L80 221 L75 215 L73 215 L68 209 L66 209 L61 203 L59 203ZM280 257 L279 258 L273 258 L273 259 L267 259 L267 260 L260 260 L260 261 L254 261 L254 262 L248 262 L248 263 L242 263 L242 264 L235 264 L235 265 L229 265 L229 266 L216 267 L216 268 L210 268 L210 269 L197 270 L197 271 L191 271 L191 272 L178 273 L178 274 L172 274 L172 275 L157 277 L155 279 L155 281 L150 285 L150 328 L158 331 L159 329 L165 327 L166 325 L172 323 L173 321 L175 321 L175 320 L179 319 L180 317 L186 315 L187 313 L193 311 L194 309 L198 308 L199 306 L205 304 L206 302 L212 300 L213 298 L219 296 L220 294 L226 292 L227 290 L233 288 L234 286 L236 286 L236 285 L240 284 L241 282 L247 280 L248 278 L254 276 L255 274 L259 273 L260 271 L262 271 L262 270 L266 269 L267 267 L273 265 L274 263 L280 261 L281 259 L283 259 L282 257ZM14 259 L13 260 L15 260 L16 262 L22 264 L23 266 L29 268 L30 270 L36 272 L37 274 L43 276 L44 278 L52 281 L53 283 L59 285 L60 287 L66 289 L67 291 L75 294 L76 296 L82 298 L83 300 L91 303 L92 305 L98 307 L99 309 L107 312 L108 314 L116 317 L117 319 L127 323 L128 325 L130 325 L130 326 L132 326 L132 327 L134 327 L134 328 L136 328 L140 331 L145 329 L145 285 L142 282 L140 282 L140 280 L137 277 L128 276 L128 275 L121 275 L121 274 L115 274 L115 273 L108 273 L108 272 L101 272 L101 271 L95 271 L95 270 L81 269 L81 268 L75 268 L75 267 L68 267 L68 266 L62 266 L62 265 L48 264 L48 263 L42 263 L42 262 L28 261 L28 260 L22 260 L22 259Z',
};

/* ── Padrón de inscritos ───────────────────────────────────────────────
   Fuente: la planilla de respuestas del formulario de inscripción del
   seminario («Respuestas 6»), del organizador. 112 personas.

   Qué se hizo con los datos, y por qué:
   - El RUT viaja normalizado (sin puntos ni guion, K mayúscula) porque es la
     única forma de comparar lo que la persona marca en el totem con lo que
     escribió en el formulario, donde aparece de seis maneras distintas.
   - La planilla guardó varios RUT como NÚMERO, y eso les comió el formato
     (17.271.606-7 quedó como 1.72716067E8). Se reconstruyeron a entero: el
     dígito verificador es el último dígito y ninguno se perdió.
   - Tres filas venían rotas y se repararon en vez de descartarse: dos RUT
     pegados en una celda, dos personas en una misma fila (se separaron) y un
     dígito repetido de más. Las tres reparaciones validan módulo 11.
   - Dos RUT tienen el dígito verificador mal tipeado en origen y uno viene
     vacío. Se conservan TAL COMO se escribieron: quien llegue con ese RUT
     igual se acredita, y gestión ve el caso. No se corrigió el RUT de nadie.
   - Las filas duplicadas (misma persona inscrita dos veces) se unificaron.

   Campos: n nombre · r RUT normalizado · e empresa · m correo · c Centro de
   Negocios SERCOTEC. */
const PADRON = [
  {"n": "Abraham Ulloa", "r": "218860966", "e": "ABRAHAM ULLOA HERNÁNDEZ MINIMARKET E.I.R.L.", "m": "abrahamesteban1920@gmail.com", "c": "Independencia"},
  {"n": "Adriana Abreu", "r": "271161190", "e": "Dall Craft Digital", "m": "adricabreuhern@gmail.com", "c": "Independencia"},
  {"n": "Alejandra Aspee", "r": "153307717", "e": "Nebulas", "m": "ale.aspee@nebulas.cl", "c": "Ñuñoa"},
  {"n": "Alexandra Correa", "r": "156672033", "e": "Frambuesa TV SPA", "m": "acorrea@frambuesa.tv", "c": "Ñuñoa"},
  {"n": "Alvaro Gutiérrez", "r": "135512176", "e": "Solo Empresas SPA", "m": "guterman2@gmail.com", "c": "Ñuñoa"},
  {"n": "Ana leigthon", "r": "19428375K", "e": "Anita studio spa", "m": "analeigthon@gmail.com", "c": "Ñuñoa"},
  {"n": "Andrea", "r": "130139280", "e": "ADN Viajes - Destinos Turisticos Radio", "m": "andrea.lima@adnviajes.cl", "c": "Independencia"},
  {"n": "Andrea Saffa", "r": "190808300", "e": "Olen", "m": "andre_saffa@hotmail.com", "c": "San Pablo"},
  {"n": "Andrea Sotelo", "r": "139306686", "e": "AMJ Ingenieria", "m": "andrea.sotelo@amjingenieria.cl", "c": "Ñuñoa"},
  {"n": "Andrés Alvarado", "r": "154104119", "e": "Óptica atelyer", "m": "andy1611982@gmail.com", "c": "Independencia"},
  {"n": "Angelina Sepúlveda", "r": "16387377K", "e": "Partner's", "m": "contacto@partner-s.cl", "c": "Ñuñoa"},
  {"n": "Astrid Yulieth cruz vargas", "r": "238879167", "e": "Saybox", "m": "yulicruzvargas@gmail.com", "c": ""},
  {"n": "Bryan Valdes", "r": "167515088", "e": "metakut spa", "m": "bvaldes@metakut.cl", "c": "Ñuñoa"},
  {"n": "Bélgica Balboa", "r": "156673781", "e": "proglassChile", "m": "balboabelgica2020@gmail.com", "c": ""},
  {"n": "Camila Drago", "r": "183937537", "e": "Frambuesa TV SPA", "m": "camidrago@frambuesa.tv", "c": "Ñuñoa"},
  {"n": "Caren Aceituno", "r": "17811607K", "e": "CEDRO", "m": "caren.aceituno.s@gmail.com", "c": "Independencia"},
  {"n": "Carlos Rodríguez", "r": "139104188", "e": "Intercos", "m": "rodriguezyessencarlos@gmail.com", "c": "San Pablo"},
  {"n": "Carmen Roman Naranjo", "r": "53797741", "e": "Memé Wine", "m": "carmenroman.naranjo@gmail.com", "c": "Independencia"},
  {"n": "Carolina Iradi", "r": "128721142", "e": "Blue", "m": "ciradiciradi@gmail.com", "c": "Independencia"},
  {"n": "Carolina Ramírez", "r": "136857819", "e": "Vasper Capacita", "m": "caro.ramirez.miranda@gmail.com", "c": ""},
  {"n": "Cecilia Deserafino Carreño", "r": "97871280", "e": "Ecoop Cono Sur", "m": "ceciliadeserafinoc@gmail.com", "c": "Independencia"},
  {"n": "Claudia Ahumada", "r": "153609772", "e": "Cortilux", "m": "cortiluxroller@gmail.com", "c": "Independencia"},
  {"n": "Claudia Orellana Calfiqueo", "r": "141636081", "e": "Konciente", "m": "corellana@icalbuco.cl", "c": "Ñuñoa"},
  {"n": "Daniel Marquez Salas", "r": "161912697", "e": "Tributa Gestion SpA", "m": "dmarquez@tributagestion.cl", "c": "San Pablo"},
  {"n": "Daniela Escobar Cortés", "r": "182745650", "e": "VitalGlow estética integral", "m": "descobar1022@gmail.com", "c": "Ñuñoa"},
  {"n": "Daniela Ugarte", "r": "150907926", "e": "impulso U - Arquitectos Industriales", "m": "daniela.ugarte@impulso-u.com", "c": "Ñuñoa"},
  {"n": "Diego Jamett", "r": "136683640", "e": "Tienda de Angélica yAmanda", "m": "diegojamett@gmail.com", "c": "San Pablo"},
  {"n": "Eduard Alberto Villegas Andara", "r": "266634161", "e": "Pana Grill SPA", "m": "eduardvillegas20@gmail.com", "c": "Independencia"},
  {"n": "Eduardo Vega", "r": "171039886", "e": "CRZS Spa", "m": "ed.vega.89@gmail.com", "c": "Ñuñoa"},
  {"n": "Elba montenegro", "r": "10388361K", "e": "Sgp seguridad y capacitación spa", "m": "elba.montenegro@sgpseguridad.cl", "c": "Independencia"},
  {"n": "Enrique Domínguez", "r": "258168135", "e": "Metakut", "m": "produccion@metakut.cl", "c": "Ñuñoa"},
  {"n": "Evelyn Nuñez", "r": "14150892K", "e": "Quimlab", "m": "evelynpeace@gmail.com", "c": "Independencia"},
  {"n": "Fabiola Dagnino", "r": "104012583", "e": "Cosmetologa Fabiola Dagnino", "m": "fabioladagninogutierrez@gmail.com", "c": "San Pablo"},
  {"n": "Fabiola Fuentes Rivas", "r": "164468739", "e": "Servicios Automotrices JRV Spa", "m": "fafuentesr@gmail.com", "c": "Ñuñoa"},
  {"n": "Federico Galvez Durand", "r": "146985998", "e": "Dos Columnas SpA", "m": "federico.a.galvezdurand@gmail.com", "c": "Ñuñoa"},
  {"n": "Felipe Apucino", "r": "16642545K", "e": "Espacio Camposano", "m": "espaciocamposano@gmail.com", "c": "Ñuñoa"},
  {"n": "Felipe Petersen", "r": "105528124", "e": "Bruder Petersen", "m": "bruderpetersen@gmail.com", "c": "Independencia"},
  {"n": "Francis Tovar", "r": "247804218", "e": "Desarrollos Pec SpA", "m": "francis@desarrollospec.com", "c": "Ñuñoa"},
  {"n": "Francisca Valderrama", "r": "161276618", "e": "Empréndete Mujer", "m": "emprendetemujer@gmail.com", "c": "Ñuñoa"},
  {"n": "Geraldine Zulian", "r": "188581579", "e": "El obsequio", "m": "zuliangeraldine5@gmail.com", "c": ""},
  {"n": "Jaime Martínez", "r": "160850795", "e": "Autoseg", "m": "ja.martinezr@hotmail.com", "c": "San Pablo"},
  {"n": "Janet Yuli Broncano Armas", "r": "147371128", "e": "Electrodomestica JB", "m": "electrodomesticajb@gmail.com", "c": "Independencia"},
  {"n": "Jannet Rodríguez López", "r": "153680973", "e": "Nahuen Productos", "m": "nahuenproductos@gmail.com", "c": "San Pablo"},
  {"n": "Jennifer Avendaño", "r": "166169127", "e": "Ohana accesorios", "m": "jenny.avendano.aguilera@gmail.com", "c": "San Pablo"},
  {"n": "Jocelyn López", "r": "163238381", "e": "López y quiero", "m": "jocymonse@gmail.com", "c": "Independencia"},
  {"n": "jordana contreras", "r": "180282793", "e": "cinelifterchile", "m": "jor.contreras@duocuc.cl", "c": ""},
  {"n": "Jorge Fernandez", "r": "17316744K", "e": "Energex", "m": "jo.fernandez.du@gmail.com", "c": "Ñuñoa"},
  {"n": "Jorge Olivares", "r": "88654927", "e": "Jota.kuero", "m": "jocoliver2@gmail.com", "c": "Independencia"},
  {"n": "Jorge Olivares", "r": "775678070", "e": "Jota.Kuero", "m": "jocoliver2@gmail.com", "c": "Independencia"},
  {"n": "Jose Adrian Jimenez", "r": "122660184", "e": "AMJ Ingenieria", "m": "ventas@amjingenieria.cl", "c": "Ñuñoa"},
  {"n": "José Barto", "r": "98072993", "e": "Comercializadora José Rómulo Barto Rojas", "m": "rom.bartor@gmail.com", "c": "Independencia"},
  {"n": "José Lisboa", "r": "13674254K", "e": "Transportes Lisboa Spa", "m": "transporteslisboaspa@gmail.com", "c": "Independencia"},
  {"n": "José Medina", "r": "137561654", "e": "José Medina", "m": "trasladostelollevo@gmail.com", "c": "Independencia"},
  {"n": "juan Ignacio Gonzalez del canto", "r": "163866706", "e": "Punto mini break", "m": "juanignaciogonzalezdc@gmail.com", "c": "Ñuñoa"},
  {"n": "Juan Pablo Saavedra", "r": "72794761", "e": "JP Broker Corredores de Seguros Spa.", "m": "jpsg.saavedra@gmail.com", "c": "Ñuñoa"},
  {"n": "Juan Pacheco", "r": "122523845", "e": "Altocerro spa", "m": "pachecosorio@gmail.com", "c": "Ñuñoa"},
  {"n": "Julio Enrique Morales Rojas", "r": "164703460", "e": "Demarcacion Vial Chile", "m": "julio.morales@demarcacionvialchile.cl", "c": "Ñuñoa"},
  {"n": "Julio Herrera", "r": "172325386", "e": "Planeta Musgo", "m": "planeta.musgoe@gmail.com", "c": "Independencia"},
  {"n": "Karis Fuenzalida", "r": "160203196", "e": "Más Calidad en Salud", "m": "mascalidadensalud@gmail.com", "c": "Ñuñoa"},
  {"n": "Karol Trautmann", "r": "126424663", "e": "Mira Consultora", "m": "karol.trautmann@gmail.com", "c": "Ñuñoa"},
  {"n": "Katherine galea", "r": "267961824", "e": "No tiene", "m": "kathygalea1@gmail.com", "c": "San Pablo"},
  {"n": "Katherine Garrido", "r": "141574663", "e": "Emporio apibees", "m": "katherine.garrido@gmail.com", "c": "Independencia"},
  {"n": "Katherine Vergara", "r": "126192525", "e": "Comercial Verval SpA", "m": "kvergaravaldivia@gmail.com", "c": "Ñuñoa"},
  {"n": "Lucía Moreno Caro", "r": "153494762", "e": "Papelería Valdivia Spa", "m": "lumorenocaro@gmail.com", "c": "Ñuñoa"},
  {"n": "Luis Contreras", "r": "141274104", "e": "Sala", "m": "lcquim@gmail.com", "c": "Ñuñoa"},
  {"n": "Luis Medina", "r": "272804907", "e": "Chocolateria Luis medina", "m": "luisage90@gmail.com", "c": "Ñuñoa"},
  {"n": "Luisa López Sáez", "r": "159394298", "e": "Luisa López", "m": "llopez.rrrhh56@gmail.com", "c": ""},
  {"n": "luz Adriana Baracaldo", "r": "26912105K", "e": "creciendo juntos", "m": "adriana2202san@gmail.com", "c": "San Pablo"},
  {"n": "Marcelo Rodriguez", "r": "125854524", "e": "Importadora OXS Ltda.", "m": "m.rodriguezdangelo@gmail.com", "c": "Ñuñoa"},
  {"n": "Maria Eugenia Diaz", "r": "282425424", "e": "Grupo Elyos SPA (Legacy)", "m": "medmisle@gmail.com", "c": "Ñuñoa"},
  {"n": "maria jose calderon", "r": "18080871K", "e": "vibramarket", "m": "mariajoseavariacalderon@gmail.com", "c": "San Pablo"},
  {"n": "Mariam villasmil", "r": "263108817", "e": "ByMvillasmil", "m": "bymvillasmil@gmail.com", "c": "Ñuñoa"},
  {"n": "Mariluz Valdebenito", "r": "116261472", "e": "Mjempaques", "m": "mariluzvaldebenito932@gmail.com", "c": "San Pablo"},
  {"n": "María de los Angeles Rojas", "r": "181489995", "e": "Luna Terra SPA", "m": "mangelesrojasg@gmail.com", "c": "Ñuñoa"},
  {"n": "María Teresa Lagos", "r": "128904980", "e": "Tapicería Gaby", "m": "tapiceriagaby@gmail.com", "c": "Ñuñoa"},
  {"n": "Mauricio Molina", "r": "154111638", "e": "Cooperativa Hunab Ku", "m": "mmolina@coophk.cl", "c": "Independencia"},
  {"n": "Mauricio Salazar / Victoria Hermida", "r": "782256041", "e": "V & M Alimentos Mauricio Salazar E.I.R.L.", "m": "mauriciosalazar555@gmail.com", "c": "San Pablo"},
  {"n": "Michael Valderrama", "r": "141302523", "e": "Comercial val", "m": "valderramautos.j@gmail.com", "c": "Independencia"},
  {"n": "Mitzy Saez", "r": "141780743", "e": "Rc y asociados ltda", "m": "info@rcarvajalyasoc.cl", "c": "Ñuñoa"},
  {"n": "Monica Galarce Fernández", "r": "77471847", "e": "Monigal SPA", "m": "mgalarcef@gmail.com", "c": "San Pablo"},
  {"n": "Mónica olea", "r": "130662587", "e": "Neko sushi", "m": "monicaolea@me.com", "c": "Independencia"},
  {"n": "Nalding Ortiz", "r": "253695714", "e": "Ferretería FC", "m": "naldiortiz1202@gmail.com", "c": "Independencia"},
  {"n": "Natacha González", "r": "162866583", "e": "Nutrete", "m": "natachagonsep@gmail.com", "c": "Ñuñoa"},
  {"n": "Natalia yupanqui", "r": "198310816", "e": "Retornables amalia", "m": "detergentesamalia@gmail.com", "c": "Independencia"},
  {"n": "Noemi Bernal", "r": "157680528", "e": "Noeliza", "m": "noemibernalc1@gmail.com", "c": "San Pablo"},
  {"n": "Olga María Valdes", "r": "86942089", "e": "Consultora MIRA", "m": "ovaldesdlt@gmail.com", "c": "Ñuñoa"},
  {"n": "Pamela Sandoval", "r": "", "e": "Como me maquillo spa", "m": "pamelasandovalhenriquez@gmail.com", "c": "Ñuñoa"},
  {"n": "Patricio Madariaga Romero", "r": "99795220", "e": "Hear Consultores Auditores SPA", "m": "p.madariaga.r@gmail.com", "c": "Ñuñoa"},
  {"n": "Paulette L’Huissier E", "r": "135299022", "e": "7.69348425E8", "m": "productorainspiracionspa@gmail.com", "c": "Ñuñoa"},
  {"n": "Raúl Mella", "r": "180634177", "e": "Planozero", "m": "raul@planozero.cl", "c": "Ñuñoa"},
  {"n": "Renato Méndez", "r": "186688031", "e": "Rincón Napolitano", "m": "pizzeriastreetrn@gmail.com", "c": "Ñuñoa"},
  {"n": "Rigoberto Gómez", "r": "172716067", "e": "Back2roots spa", "m": "rigo@flink.la", "c": "Ñuñoa"},
  {"n": "Roberto Delgado", "r": "25474171K", "e": "Viajero Migrante", "m": "viajeromigrante@gmail.com", "c": "Ñuñoa"},
  {"n": "Rodrigo Aqueveque", "r": "139187571", "e": "Full Color spa", "m": "raqueveque@fullcolorspa.cl", "c": "Ñuñoa"},
  {"n": "Romina Moya", "r": "163561689", "e": "Dolcemito", "m": "holadolcemito@gmail.com", "c": "Ñuñoa"},
  {"n": "Samuel Leal", "r": "78163526", "e": "Orbytal Editores", "m": "antoniolealsam@gmail.com", "c": "Ñuñoa"},
  {"n": "Sandra Milena Sanchez", "r": "249489778", "e": "FAcele", "m": "ssanchez@facele.cl", "c": "Ñuñoa"},
  {"n": "sebastian toledo", "r": "15500259K", "e": "curicontainer", "m": "seba.toledo@gmail.com", "c": "Ñuñoa"},
  {"n": "Sonia Melina", "r": "259214254", "e": "Comercial Sonia Melina Condori Quispe eirl", "m": "soniamelina.santiago@gmail.com", "c": "Independencia"},
  {"n": "Susagne Alviarez", "r": "268923373", "e": "Alviarez muebles y diseño spa", "m": "sunaski85@gmail.com", "c": "San Pablo"},
  {"n": "Tere Meneses", "r": "160991968", "e": "Espacio Camposano", "m": "espaciocamposano@gmail.com", "c": "Ñuñoa"},
  {"n": "Valeria Saavedra", "r": "161238120", "e": "Valeria Saavedra", "m": "valeria.saavedra.cabezas@gmail.com", "c": ""},
  {"n": "Valeska Ojeda", "r": "768687641", "e": "Mova Energia", "m": "vojeda@movaenergia.cl", "c": "Ñuñoa"},
  {"n": "Vanessa Majuan", "r": "234216341", "e": "MULTISERVICIOS CORONEL SpA", "m": "vmajuan@eclass.cl", "c": "Independencia"},
  {"n": "Vanessa Tapia", "r": "173043198", "e": "Sueños de Papel spa", "m": "vanessa.tapia.garrido@gmail.com", "c": "San Pablo"},
  {"n": "Victor jose maria asin delgado", "r": "147349262", "e": "Sofás modulares victor José maría asin delgado E.I.R.L", "m": "carmencitaluz72@gmail.com", "c": "San Pablo"},
  {"n": "Yannifer Jaramillo", "r": "261154315", "e": "Verdiabyyanni", "m": "contactoyannifer@gmail.com", "c": "Ñuñoa"},
  {"n": "Yazmin cuello", "r": "166439620", "e": "Vital glow spa", "m": "yazmin.cuello@gmail.com", "c": "Independencia"},
  {"n": "yerko balladares", "r": "81269294", "e": "maderasenuncion", "m": "yerko.a.balladares@gmail.com", "c": "Independencia"},
  {"n": "Yinibeth Paredes", "r": "271906439", "e": "PANA GRILL SPA", "m": "yinibethparedes@gmail.com", "c": "Independencia"},
  {"n": "Yuleidys López", "r": "269406461", "e": "YULE", "m": "lopezyuleidysm@gmail.com", "c": "San Pablo"},
  {"n": "Álvaro Olivares", "r": "204326983", "e": "OLEN SpA", "m": "alvarodomingo@olen.cl", "c": "San Pablo"},
];

/* ── Configuración ─────────────────────────────────────────────────────── */
/* Solo el aspecto. El emparejamiento va en la URL, no aquí. */

const DEFAULT_CONFIG = {
  modo: 'auto',
  segundosInactividad: 60,
};

/* ── mount ────────────────────────────────────────────────────────────── */

export default function mount(shell) {
  // El React es SIEMPRE el del host: dos copias rompen los hooks.
  const React = globalThis.React;
  const h = React.createElement;

  let config = Object.assign({}, DEFAULT_CONFIG);
  const instancia = resolverInstancia();
  let vista = {
    paso: 'inicio',        // inicio · rut · confirmar · fuera · listo
    rut: '',
    error: '',
    ficha: null,
    comprobante: null,
  };
  let hechos = {};                          // rut → { ts, nombre } de la jornada
  let cola = leerLS(LS_COLA, []);           // acreditaciones que aún no salieron
  const listeners = new Set();
  const emitir = () => listeners.forEach((l) => l({ vista, config, hechos, cola }));
  const setVista = (parcial) => { vista = Object.assign({}, vista, parcial); emitir(); };

  let inactividadT = null;
  let volverT = null;

  const volverAlInicio = () => {
    vista = Object.assign({}, vista, { paso: 'inicio', rut: '', error: '', ficha: null, comprobante: null });
    emitir();
  };

  const marcarActividad = () => {
    clearTimeout(inactividadT);
    const seg = Number(config.segundosInactividad);
    const espera = Number.isFinite(seg) && seg >= 15 ? seg : DEFAULT_CONFIG.segundosInactividad;
    inactividadT = setTimeout(() => { if (vista.paso !== 'inicio') volverAlInicio(); }, espera * 1000);
  };

  /* ── Envío al gateway, por lotes y con cola ────────────────────────── */

  let vaciandoT = null;
  let vaciando = false;        // un solo vaciado a la vez: dos concurrentes
  let ultimoEnvioTs = 0;       // recorrerían la misma cola y duplicarían gente
  let esperaExtraMs = 0;
  let peticiones = [];         // cuándo salió cada petición de la ventana
  /* Contador para el id de cada acreditación. NO basta con Date.now(): dos
     personas confirmadas en el mismo milisegundo compartirían id, y al enviarse
     una, el filtro que limpia la cola se llevaría las dos por delante. La
     segunda desaparecería sin rastro y sin error. */
  let secuencia = 0;

  /** Parte la cola en lotes que quepan en un campo del gateway. */
  function armarLotes(pendientes) {
    const lotes = [];
    let actual = [];
    let largo = 2;
    for (const envio of pendientes) {
      const trozo = JSON.stringify(envio.data).length + 1;
      if (actual.length && (actual.length >= LOTE_MAX_PERSONAS || largo + trozo > LOTE_MAX_CARACTERES)) {
        lotes.push(actual); actual = []; largo = 2;
      }
      actual.push(envio); largo += trozo;
    }
    if (actual.length) lotes.push(actual);
    return lotes;
  }

  async function vaciarCola() {
    if (vaciando) return;
    clearTimeout(vaciandoT);
    if (!instancia || !cola.length) { programarVaciado(); return; }
    vaciando = true;
    ultimoEnvioTs = Date.now();
    peticiones = peticiones.filter((t) => ultimoEnvioTs - t < VENTANA_MS).concat([ultimoEnvioTs]);
    const url = baseApi(shell) + '/api/public/app/' + encodeURIComponent(instancia) + '/submit/' + CANAL;
    // Foto de la cola: lo que se acredite MIENTRAS este vaciado corre no puede
    // quedar fuera al reescribirla al final.
    const foto = cola.slice();
    const enviados = new Set();
    let frenado = false;
    try {
      // UNA petición por vaciado: mandar todos los lotes de golpe agotaría el
      // presupuesto de la ventana y empezaría a chocar contra el 429.
      for (const lote of armarLotes(foto).slice(0, 1)) {
        let salio = false;
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lote: JSON.stringify(lote.map((e) => e.data)),
              personas: String(lote.length),
              evento: EVENTO.titulo,
              appVersion: APP_VERSION,
            }),
          });
          if (r.ok) { salio = true; esperaExtraMs = 0; }
          else if (r.status === 429) {
            // Tope de la plataforma, no un fallo nuestro: se espera a que se
            // abra la ventana en vez de gastar reintentos contra la pared.
            frenado = true;
            esperaExtraMs = ESPERA_429_MS;
          } else if (RECHAZOS_DEFINITIVOS.has(r.status)) {
            // El envío en sí está mal formado (400), es demasiado grande (413)
            // o va vacío (422): reintentarlo lo repetiría igual de mal.
            salio = true;
            shell.notify && shell.notify({
              level: 'error',
              text: 'La plataforma rechazó ' + lote.length + ' registro(s) (HTTP ' + r.status + ').',
            });
          } else {
            // TODO LO DEMÁS SE REINTENTA, y muy en particular el 403: ahí no
            // dice "este registro está mal", dice que la instancia de gestión
            // aún no acepta envíos. Descartar por eso tiraría a la basura a
            // cada persona que se acredite hasta que alguien se diera cuenta.
            frenado = true;
          }
        } catch (e) { frenado = true; /* sin red */ }
        if (salio) lote.forEach((e) => enviados.add(e.id));
      }
      cola = cola.filter((e) => !enviados.has(e.id));
      escribirLS(LS_COLA, cola);
      emitir();
    } finally {
      vaciando = false;
    }
    programarVaciado();
  }

  /** Próximo vaciado: en cuanto se pueda, sin salirse del presupuesto. */
  const programarVaciado = () => {
    clearTimeout(vaciandoT);
    if (!cola.length) return;
    const ahora = Date.now();
    const recientes = peticiones.filter((t) => ahora - t < VENTANA_MS);
    peticiones = recientes;
    // Si la ventana ya está llena, se espera a que caduque la más antigua.
    const porPresupuesto = recientes.length >= PETICIONES_POR_VENTANA
      ? (recientes[0] + VENTANA_MS) - ahora
      : 0;
    const espera = Math.max(
      esperaExtraMs || 0,
      ENVIO_MIN_MS - (ahora - ultimoEnvioTs),
      porPresupuesto,
      0,
    );
    vaciandoT = setTimeout(() => { vaciarCola(); }, espera);
  };

  /** Deja acreditada a una persona del padrón. Devuelve el comprobante. */
  function acreditar(p) {
    const ts = Date.now();
    const registro = {
      rut: p.r,
      rutFormateado: formatearRut(p.r),
      nombre: p.n,
      empresa: p.e || '',
      correo: p.m || '',
      cdn: p.c || '',
      acreditadoEn: new Date(ts).toISOString(),
    };
    hechos[p.r] = { ts, nombre: p.n };
    secuencia += 1;
    const id = 'e' + ts.toString(36) + '-' + secuencia.toString(36)
      + '-' + Math.random().toString(36).slice(2, 7);
    cola = cola.concat([{ id, data: registro }]);
    escribirLS(LS_COLA, cola);
    emitir();
    programarVaciado();
    return { registro, ts };
  }

  /* ── Pasos ─────────────────────────────────────────────────────────── */

  const irAPaso = (paso) => {
    if (!['inicio', 'rut', 'confirmar', 'fuera', 'listo'].includes(paso)) return false;
    // Sin emparejar no se entra al flujo: no se acredita a nadie en falso.
    if (paso !== 'inicio' && !instancia) return false;
    setVista({ paso, error: '' });
    marcarActividad();
    return true;
  };

  const escribirRut = (tecla) => {
    let r = vista.rut;
    if (tecla === 'BORRAR') r = r.slice(0, -1);
    else if (tecla === 'LIMPIAR') r = '';
    else if (r.length < 9) r = r + tecla;
    setVista({ rut: r, error: '' });
    marcarActividad();
  };

  /**
   * Busca el RUT en el padrón. No acredita: eso lo hace la persona
   * confirmando. Si no está en la lista, lo dice y no ofrece salidas.
   */
  function consultarRut(bruto) {
    if (!instancia) return { estado: 'sin-emparejar' };
    const rut = normalizarRut(bruto);
    if (rut.length < 8) {
      setVista({ error: 'El RUT está incompleto. Escríbelo con su dígito verificador.' });
      return { estado: 'incompleto' };
    }
    if (!rutValido(rut)) {
      setVista({ error: 'Ese RUT no es válido. Revísalo y vuelve a intentarlo.' });
      return { estado: 'invalido' };
    }
    const persona = PADRON.find((p) => p.r === rut) || null;
    if (!persona) {
      setVista({ paso: 'fuera', rut, ficha: null, error: '' });
      marcarActividad();
      return { estado: 'no-inscrito' };
    }
    const ya = hechos[rut] || null;
    setVista({ paso: 'confirmar', rut, ficha: persona, error: '' });
    marcarActividad();
    return { estado: ya ? 'ya-acreditado' : 'en-padron', persona, ya };
  }

  function confirmar() {
    const p = vista.ficha;
    if (!p || !instancia) return null;
    const { registro, ts } = acreditar(p);
    setVista({ paso: 'listo', comprobante: { registro, ts } });
    clearTimeout(volverT);
    volverT = setTimeout(volverAlInicio, VOLVER_MS);
    return registro;
  }

  /* ── Arranque ──────────────────────────────────────────────────────── */

  const aplicarConfig = (v) => { config = Object.assign({}, DEFAULT_CONFIG, v || {}); emitir(); marcarActividad(); };
  let offConfig = null;
  if (shell.config && shell.config.get) {
    Promise.resolve(shell.config.get()).then(aplicarConfig).catch(() => {});
    if (shell.config.onChange) offConfig = shell.config.onChange(aplicarConfig);
  }

  if (shell.window && shell.window.setTitle) shell.window.setTitle('AIEP INSCRIPCIÓN · ' + EVENTO.titulo);
  marcarActividad();
  programarVaciado();

  /* ── Agente IA (consultivo) ────────────────────────────────────────── */

  let offAgent = null;
  if (shell.agent && shell.agent.register) {
    offAgent = shell.agent.register({
      label: 'AIEP INSCRIPCIÓN · Acreditación',
      description: 'Totem de acreditación del Seminario «IA y Protección de Datos» en la Sede '
        + 'AIEP San Joaquín. Consulta si una persona viene inscrita y deja su ficha en '
        + 'pantalla. NO acredita a nadie: la acreditación la confirma la propia persona '
        + 'tocando el botón. Y solo se acredita quien está en la lista.',
      tools: [
        {
          name: 'CONSULTAR_RUT',
          description: 'Busca un RUT en el padrón y deja el resultado EN PANTALLA: la ficha de '
            + 'la persona si viene inscrita, o el aviso de que no está en la lista. No acredita.',
          inputSchema: {
            type: 'object',
            properties: { rut: { type: 'string', description: 'RUT con o sin puntos y guion, p. ej. 17.271.606-7.' } },
            required: ['rut'],
          },
        },
        {
          name: 'BUSCAR_POR_NOMBRE',
          description: 'Busca personas del padrón cuyo nombre o empresa contenga el texto dado. '
            + 'Devuelve el RUT enmascarado para que la persona lo reconozca sin exponerlo entero.',
          inputSchema: {
            type: 'object',
            properties: { texto: { type: 'string' } },
            required: ['texto'],
          },
        },
        {
          name: 'IR_A_PASO',
          description: 'Mueve el totem a un paso del flujo: inicio, rut, confirmar, fuera o listo.',
          inputSchema: {
            type: 'object',
            properties: { paso: { type: 'string', enum: ['inicio', 'rut', 'confirmar', 'fuera', 'listo'] } },
            required: ['paso'],
          },
        },
        {
          name: 'VOLVER_AL_INICIO',
          description: 'Devuelve el totem a la portada y borra lo que hubiera escrito a medias.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      getSnapshot: () => ({
        version: APP_VERSION,
        evento: {
          titulo: EVENTO.titulo,
          subtitulo: EVENTO.subtitulo,
          cuando: EVENTO.diaSemana + ' ' + EVENTO.dia + ' de ' + EVENTO.mes.toLowerCase()
            + ' de ' + EVENTO.anio + ', ' + EVENTO.horarioTexto,
          donde: EVENTO.sede + ' — ' + EVENTO.direccion + ', ' + EVENTO.region,
          comoLlegar: EVENTO.metro,
        },
        enPantalla: {
          paso: vista.paso,
          rutEscrito: vista.rut ? formatearRut(vista.rut) : '',
          fichaVisible: vista.ficha ? { nombre: vista.ficha.n, empresa: vista.ficha.e } : null,
          error: vista.error || null,
        },
        padron: { inscritos: PADRON.length },
        emparejado: !!instancia,
        acreditacionesPorSubir: cola.length,
        avisos: [
          !instancia
            ? 'ESTE TOTEM NO ESTÁ EMPAREJADO con AIEP GESTIÓN, así que NO puede acreditar a '
              + 'nadie. No le digas a nadie que quedó registrado. Avisa de que hay que llamar '
              + 'al staff y usar el mesón de acreditación.'
            : 'Eres CONSULTIVO: informas y buscas, pero NO acreditas a nadie. La acreditación la '
              + 'confirma la persona tocando el botón en el totem.',
          'SOLO se acredita quien está en el padrón. Si alguien no está, no hay forma de '
            + 'registrarlo desde el totem y no debes ofrecer ninguna: dile que se acerque al '
            + 'mesón de acreditación, que ahí lo ve una persona.',
          'El padrón lleva datos personales: no leas en voz alta RUT completos ni correos. '
            + 'BUSCAR_POR_NOMBRE ya te los devuelve enmascarados; mantenlos así.',
        ],
      }),
      dispatchAction: async (action) => {
        const tipo = action && action.type;
        const p = (action && action.payload) || {};
        try {
          if (tipo === 'CONSULTAR_RUT') {
            if (!instancia) {
              return {
                success: false,
                error: 'Este totem no está emparejado con AIEP GESTIÓN: no puede acreditar a '
                  + 'nadie. Hay que avisar al staff.',
              };
            }
            setVista({ paso: 'rut', rut: normalizarRut(p.rut).slice(0, 9) });
            const r = consultarRut(p.rut);
            if (r.estado === 'incompleto' || r.estado === 'invalido') {
              return { success: false, error: vista.error };
            }
            if (r.estado === 'no-inscrito') {
              return {
                success: true,
                message: 'Ese RUT no está en la lista de inscritos. En pantalla ya se lo dice: '
                  + 'tiene que acercarse al mesón de acreditación.',
                data: { enPadron: false },
              };
            }
            if (r.estado === 'ya-acreditado') {
              return {
                success: true,
                message: 'Ese RUT ya se acreditó en este totem a las ' + horaDe(r.ya.ts)
                  + '. Su ficha está en pantalla igual.',
                data: { enPadron: true, yaAcreditado: true, hora: horaDe(r.ya.ts), nombre: r.persona.n },
              };
            }
            return {
              success: true,
              message: 'En pantalla: la ficha de ' + r.persona.n + '. Pídele que confirme para acreditarse.',
              data: {
                enPadron: true,
                nombre: r.persona.n,
                empresa: r.persona.e || null,
                centroDeNegocios: r.persona.c || null,
              },
            };
          }
          if (tipo === 'BUSCAR_POR_NOMBRE') {
            const q = plano(p.texto).trim();
            if (q.length < 3) return { success: false, error: 'Escribe al menos 3 letras para buscar.' };
            const hits = PADRON
              .filter((x) => plano(x.n).includes(q) || plano(x.e).includes(q))
              .slice(0, 8)
              .map((x) => ({
                nombre: x.n,
                empresa: x.e || null,
                centroDeNegocios: x.c || null,
                // Enmascarado a propósito: sirve para que la persona se
                // reconozca, no para dictar el RUT de nadie en voz alta.
                rutParcial: '•••••' + x.r.slice(-4, -1) + '-' + x.r.slice(-1),
                yaAcreditado: !!hechos[x.r],
              }));
            return {
              success: true,
              message: hits.length
                ? hits.length + ' coincidencia' + (hits.length === 1 ? '' : 's') + ' en el padrón.'
                : 'Nadie en el padrón coincide con «' + p.texto + '».',
              data: { resultados: hits },
            };
          }
          if (tipo === 'IR_A_PASO') {
            if (!irAPaso(p.paso)) return { success: false, error: 'Paso desconocido: ' + p.paso };
            return { success: true, message: 'Totem en el paso "' + p.paso + '".' };
          }
          if (tipo === 'VOLVER_AL_INICIO') { volverAlInicio(); marcarActividad(); return { success: true, message: 'Totem en la portada.' }; }
          return { success: false, error: 'Acción desconocida: ' + tipo };
        } catch (e) {
          return { success: false, error: 'No se pudo completar la acción: ' + (e && e.message ? e.message : String(e)) };
        }
      },
    });
  }

  /* ── Piezas del chrome ─────────────────────────────────────────────── */

  function Rotulo() {
    return h('div', null,
      h('p', { className: 'ai-band' }, EVENTO.rotulo),
      h('h1', { className: 'ai-titulo' }, EVENTO.titulo),
      h('p', { className: 'ai-sub' }, EVENTO.subtitulo));
  }

  function Pie(props) {
    return h('footer', { className: 'ai-ft' },
      h('p', { className: 'ai-ft-c' }, PIE.copyright),
      props.pendientes
        ? h('span', { className: 'ac-cola', title: 'Acreditaciones que aún no se han subido' },
          '⟳ ', String(props.pendientes), ' por subir')
        : null,
      h('span', { className: 'ai-ft-sep', 'aria-hidden': 'true' }),
      h('div', { className: 'ai-ft-k' },
        h('span', { className: 'ai-ft-k-lbl' }, PIE.plataforma),
        h('svg', { className: 'ai-ft-k-ico', viewBox: KIMOS_ICONO.viewBox, role: 'img', 'aria-label': 'Kimos' },
          h('path', { d: KIMOS_ICONO.d, fill: 'currentColor', fillRule: 'evenodd' })),
        h('svg', { className: 'ai-ft-k-logo', viewBox: KIMOS_LOGO.viewBox, 'aria-hidden': 'true' },
          h('path', { d: KIMOS_LOGO.d, fill: 'currentColor', fillRule: 'evenodd' }))));
  }

  function Teclado(props) {
    return h('div', { className: 'ac-tec num' },
      TECLAS_NUM.map((t) => h('button', {
        key: t, type: 'button', className: 'ac-key', onClick: () => props.onTecla(t),
      }, t)),
      h('button', { type: 'button', className: 'ac-key aux', onClick: () => props.onTecla('BORRAR') }, '⌫ Borrar'),
      h('button', { type: 'button', className: 'ac-key aux ancha', onClick: () => props.onTecla('LIMPIAR') }, 'Limpiar'));
  }

  /* ── Pantallas ─────────────────────────────────────────────────────── */

  function Inicio(props) {
    return h('div', { className: 'ai-wrap ac-centro' },
      h('div', { className: 'ac-portada' },
        h(Rotulo, null),
        h('p', { className: 'ai-p', style: { marginTop: '1.2em' } },
          EVENTO.diaSemana + ' ' + EVENTO.dia + ' de ' + EVENTO.mes.toLowerCase() + ' de '
          + EVENTO.anio + ' · ' + EVENTO.horarioTexto),
        h('p', { className: 'ai-p tenue' }, EVENTO.sede, ' · ', EVENTO.direccion)),
      /* Un totem sin emparejar NO acredita, y lo dice. Fingir un «registrado»
         a alguien cuyo registro no va a llegar a ninguna parte es el peor
         fallo que puede tener esto. */
      props.emparejado
        ? h('div', { className: 'ac-centro', style: { gap: '1em' } },
          h('button', { type: 'button', className: 'ac-cta', onClick: () => irAPaso('rut') },
            '✋ Acreditarme'),
          h('p', { className: 'ai-p tenue' }, 'Toca el botón y marca tu RUT. Toma menos de un minuto.'))
        : h('div', { className: 'ac-ficha' },
          h('p', { className: 'ac-ficha-nom' }, 'Acreditación no disponible'),
          h('p', { style: { marginTop: '.6em', fontWeight: 600, lineHeight: 1.5 } },
            'Este totem todavía no está conectado con el registro del seminario. '
            + 'Acércate al mesón de acreditación.'),
          h('p', { style: { marginTop: '.9em', fontSize: 'var(--f-sm)', opacity: .7 } },
            'Staff: falta el parámetro ?aiep=ID en la URL de la vitrina. '
            + 'El identificador está en AIEP GESTIÓN.')));
  }

  function PasoRut(props) {
    const v = props.vista;
    return h('div', { className: 'ai-wrap ac-centro' },
      h('div', null,
        h('h2', { className: 'ai-h2' }, 'Marca tu RUT'),
        h('p', { className: 'ai-p tenue' }, 'Con dígito verificador, sin puntos ni guion.')),
      h('div', { className: 'ac-campo' + (v.rut ? '' : ' vacio') + (v.error ? ' malo' : '') },
        v.rut ? formatearRut(v.rut) : '00.000.000-0'),
      v.error ? h('p', { className: 'ac-error' }, v.error) : null,
      h(Teclado, { onTecla: escribirRut }),
      h('div', { className: 'ac-acciones' },
        h('button', { type: 'button', className: 'ai-btn ghost', onClick: () => irAPaso('inicio') }, '‹ Volver'),
        h('button', {
          type: 'button', className: 'ai-btn',
          disabled: v.rut.length < 8,
          onClick: () => consultarRut(v.rut),
        }, 'Continuar ›')));
  }

  function PasoConfirmar(props) {
    const v = props.vista;
    const p = v.ficha;
    if (!p) return h('div', { className: 'ai-wrap ac-centro' }, h('p', { className: 'ai-p' }, 'Sin ficha.'));
    const ya = props.hechos[p.r];
    return h('div', { className: 'ai-wrap ac-centro' },
      h('h2', { className: 'ai-h2' }, '¿Eres tú?'),
      h('div', { className: 'ac-ficha' },
        h('p', { className: 'ac-ficha-nom' }, p.n),
        h('p', { className: 'ac-ficha-rut' }, formatearRut(p.r)),
        p.e ? h('div', { className: 'ac-ficha-fila' },
          h('span', { className: 'ac-ficha-k' }, 'Empresa'),
          h('span', { className: 'ac-ficha-v' }, p.e)) : null,
        p.c ? h('div', { className: 'ac-ficha-fila' },
          h('span', { className: 'ac-ficha-k' }, 'Centro de Negocios'),
          h('span', { className: 'ac-ficha-v' }, p.c)) : null),
      ya ? h('p', { className: 'ac-ya' },
        'Este RUT ya se acreditó a las ' + horaDe(ya.ts) + '. No hace falta hacerlo de nuevo.') : null,
      h('div', { className: 'ac-acciones' },
        h('button', {
          type: 'button', className: 'ai-btn ghost',
          onClick: () => setVista({ paso: 'rut', ficha: null, error: '' }),
        }, 'No soy yo'),
        h('button', { type: 'button', className: 'ac-cta', onClick: confirmar },
          '✓ Sí, acredítame')));
  }

  /* Quien no está en la lista se resuelve en el mesón, con una persona: el
     totem no ofrece salidas ni las insinúa. */
  function PasoFuera(props) {
    return h('div', { className: 'ai-wrap ac-centro' },
      h('div', { className: 'ac-ficha' },
        h('p', { className: 'ac-ficha-nom' }, 'No estás en la lista'),
        h('p', { className: 'ac-ficha-rut' }, formatearRut(props.vista.rut)),
        h('p', { style: { marginTop: '.8em', fontWeight: 600, lineHeight: 1.5 } },
          'Este RUT no aparece entre las inscripciones del seminario. Acércate al mesón de '
          + 'acreditación y te ayudamos.')),
      h('div', { className: 'ac-acciones' },
        h('button', {
          type: 'button', className: 'ai-btn',
          onClick: () => setVista({ paso: 'rut', rut: '', error: '' }),
        }, 'Probar otro RUT'),
        h('button', { type: 'button', className: 'ai-btn ghost', onClick: volverAlInicio }, 'Inicio')));
  }

  function PasoListo(props) {
    const c = props.vista.comprobante;
    if (!c) return h('div', { className: 'ai-wrap ac-centro' }, h('p', { className: 'ai-p' }, 'Sin comprobante.'));
    return h('div', { className: 'ai-wrap ac-centro' },
      h('div', { className: 'ac-ok' },
        h('p', { className: 'ac-ok-band' }, '✓ Asistencia registrada'),
        h('div', { className: 'ac-ok-cuerpo' },
          h('p', { className: 'ac-ok-nom' }, c.registro.nombre),
          h('p', { className: 'ac-ok-rut' }, c.registro.rutFormateado),
          h('p', { className: 'ac-ok-hora' }, 'Acreditado a las ' + horaDe(c.ts)))),
      h('p', { className: 'ai-p' }, '¡Bienvenido al seminario! Pasa al salón del primer piso.'),
      h('button', { type: 'button', className: 'ai-btn', onClick: volverAlInicio }, 'Listo'));
  }

  /* ── Componente raíz ───────────────────────────────────────────────── */

  const PASOS_NAV = [
    { id: 'inicio', ico: '🏠', label: 'Inicio' },
    { id: 'rut', ico: '🪪', label: 'Mi RUT' },
  ];

  function Component() {
    const [estado, setEstado] = React.useState({ vista, config, hechos, cola });
    const [ahora, setAhora] = React.useState(() => Date.now());
    const [modo, setModo] = React.useState('escritorio');
    const raizRef = React.useRef(null);

    React.useEffect(() => {
      listeners.add(setEstado);
      return () => { listeners.delete(setEstado); };
    }, []);

    React.useEffect(() => {
      const t = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        setAhora(Date.now());
      }, 1000);
      return () => clearInterval(t);
    }, []);

    // Totem o ventana: se mide la RAÍZ, no el viewport — dentro del shell la
    // app vive en una ventana y el viewport no dice nada útil.
    React.useEffect(() => {
      const el = raizRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return undefined;
      const medir = () => {
        const forzado = estado.config.modo;
        if (forzado === 'totem' || forzado === 'escritorio') { setModo(forzado); return; }
        const { clientWidth: w, clientHeight: hgt } = el;
        setModo(hgt >= 1000 && hgt > w * 1.2 ? 'totem' : 'escritorio');
      };
      medir();
      const ro = new ResizeObserver(medir);
      ro.observe(el);
      return () => ro.disconnect();
    }, [estado.config.modo]);

    const v = estado.vista;
    const hora = new Date(ahora);

    const pantallas = {
      inicio: () => h(Inicio, { emparejado: !!instancia }),
      rut: () => h(PasoRut, { vista: v }),
      confirmar: () => h(PasoConfirmar, { vista: v, hechos: estado.hechos }),
      fuera: () => h(PasoFuera, { vista: v }),
      listo: () => h(PasoListo, { vista: v }),
    };

    return h('div', {
      ref: raizRef,
      className: 'kimos-aiep-inscripcion modo-' + modo,
      onPointerDown: marcarActividad,
      onKeyDown: marcarActividad,
    },
    h('header', { className: 'ai-hd' },
      h('div', { className: 'ai-hd-marca' },
        h('span', { className: 'ai-chip-logo' }, h('img', { src: LOGO_AIEP, alt: 'AIEP' })),
        h('p', { className: 'ai-hd-t' }, 'Acreditación · ', EVENTO.titulo)),
      h('div', { className: 'ai-hd-est' },
        h('span', { className: 'ai-pill' }, EVENTO.dia + ' ' + EVENTO.mes),
        h('span', { className: 'ai-reloj' }, pad2(hora.getHours()) + ':' + pad2(hora.getMinutes())),
        h('span', { className: 'ai-ver', title: 'AIEP INSCRIPCIÓN v' + APP_VERSION }, 'v' + APP_VERSION))),

    /* Barra bajo el header, igual que ANFITRIÓN AIEP: el pie de la pantalla
       queda para el pie de marca y para el widget de chat de la vitrina. */
    instancia ? h('nav', { className: 'ai-nav' }, PASOS_NAV.map((s) => h('button', {
      key: s.id,
      type: 'button',
      'aria-current': v.paso === s.id ? 'page' : undefined,
      className: 'ai-nav-b' + (v.paso === s.id ? ' on' : ''),
      onClick: () => irAPaso(s.id),
    }, h('span', { className: 'ai-nav-ico' }, s.ico), s.label))) : null,

    h('main', { className: 'ai-body' }, (pantallas[v.paso] || pantallas.inicio)()),

    h(Pie, { pendientes: estado.cola.length }));
  }

  return {
    Component,
    unmount() {
      clearTimeout(inactividadT);
      clearTimeout(volverT);
      clearTimeout(vaciandoT);
      listeners.clear();
      if (offAgent) { try { offAgent(); } catch (e) { /* ya desregistrado */ } }
      if (offConfig) { try { offConfig(); } catch (e) { /* ya desuscrito */ } }
    },
  };
}
