/**
 * Traductor de Banners — localiza los banners de una ficha de producto
 * manteniendo el producto intacto píxel a píxel.
 *
 * El problema: las imágenes de una página de producto son banners verticales
 * de hasta 1200 × 12000 px. Ningún modelo de imagen devuelve algo así, y
 * pedirle que «redibuje la imagen en español» degrada los renders del
 * producto — que es justo lo que la marca no puede permitirse.
 *
 * Por eso esta app **no regenera la imagen: la edita**. Por cada bloque de
 * texto:
 *
 *   1. El modelo de visión lee el panel y devuelve, por cada bloque, su caja
 *      aproximada, el texto original y su traducción.
 *   2. El motor de píxeles mide el bloque **sobre la imagen real**: recorta la
 *      caja al glifo exacto, cuenta las líneas, y saca el color, el degradado,
 *      la alineación y el interlineado de los píxeles originales — no de lo
 *      que estime el modelo, que en eso se equivoca bastante.
 *   3. Se borra sólo ese rectángulo, reconstruyendo el fondo desde sus bordes.
 *   4. Se redibuja la traducción al tamaño que reproduce el alto del texto
 *      original, reajustando si no cabe (el español suele ser ~20 % más largo).
 *
 * Consecuencia importante: **todo lo que está fuera de las cajas de texto
 * queda idéntico al original**. Los renders no se tocan, no se recomprimen y
 * no se reescalan. Los paneles son sólo la unidad de trabajo y revisión: el
 * render final se hace sobre la imagen completa, así que no hay costuras.
 *
 * Dónde corre cada cosa: la visión y la edición generativa van por
 * `shell.ai` (APP-SPEC §7.h) — la credencial no sale del backend del tenant.
 * Todo el trabajo de píxeles corre en el navegador sobre `<canvas>`: es
 * local, gratis e instantáneo, y evita mandar 12000 px de ida y vuelta por
 * cada ajuste de tipografía.
 *
 * No está atada a ningún proveedor: cada documento es un producto con su
 * propio glosario, y el glosario es lo que hace que quince banners usen los
 * mismos términos.
 */

// Mantener en sincronía con manifest.json y con el manifest raíz del repo.
const APP_VERSION = '1.0.0';

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  // ══════════════════════════════════════════════════════════════════
  // Estado
  // ══════════════════════════════════════════════════════════════════

  const nuevoGlosario = () => ({
    noTraducir: [],
    terminos: {},
  });

  const modeloInicial = () => ({
    producto: '',
    idioma: 'español neutro de Chile',
    tono: 'marketing de ecommerce, claro y directo, sin regionalismos',
    glosario: nuevoGlosario(),
    // Alto objetivo de cada panel. Los cortes se buscan en franjas de fondo
    // limpio, así que nunca parten un texto por la mitad.
    altoPanel: 1600,
    modeloVision: '',
    modeloImagen: '',
    imagenes: [],       // { id, nombre, url, ancho, alto, paneles[], hecha }
    seleccionada: '',
    gastoTokens: 0,
    llamadas: 0,
  });

  let model = modeloInicial();
  const listeners = new Set();

  let guardadoPendiente;
  const guardar = () => {
    clearTimeout(guardadoPendiente);
    guardadoPendiente = setTimeout(() => {
      shell.saveData(serializar()).catch(() => {});
    }, 700);
  };

  /** Lo que se persiste. Los canvas y los bitmaps NO: se rehacen al abrir. */
  function serializar() {
    return {
      producto: model.producto,
      idioma: model.idioma,
      tono: model.tono,
      glosario: model.glosario,
      altoPanel: model.altoPanel,
      modeloVision: model.modeloVision,
      modeloImagen: model.modeloImagen,
      seleccionada: model.seleccionada,
      gastoTokens: model.gastoTokens,
      llamadas: model.llamadas,
      imagenes: model.imagenes.map((im) => ({
        id: im.id,
        nombre: im.nombre,
        url: im.url,
        ancho: im.ancho,
        alto: im.alto,
        hecha: !!im.hecha,
        urlFinal: im.urlFinal || '',
        paneles: (im.paneles || []).map((p) => ({
          y0: p.y0,
          y1: p.y1,
          aprobado: !!p.aprobado,
          analizado: !!p.analizado,
          usarIA: !!p.usarIA,
          urlIA: p.urlIA || '',
          bloques: (p.bloques || []).map(limpiarBloque),
        })),
      })),
    };
  }

  /** Un bloque sin nada derivado: lo medido se vuelve a medir al abrir. */
  function limpiarBloque(b) {
    return {
      id: b.id,
      caja: b.caja,
      en: b.en,
      es: b.es,
      rol: b.rol,
      peso: b.peso,
      alinear: b.alinear,
      traducir: b.traducir !== false,
      nota: b.nota || '',
      // Ajustes del usuario: estos SÍ se guardan, son sus decisiones.
      escala: b.escala || 1,
      dx: b.dx || 0,
      dy: b.dy || 0,
      anchoExtra: b.anchoExtra || 0,
      colorForzado: b.colorForzado || '',
      fondoForzado: b.fondoForzado || '',
      descartado: !!b.descartado,
      // El parche generado se persiste: está pagado, y perderlo al recargar
      // obligaría a volver a pagarlo.
      parcheIA: b.parcheIA || null,
      historial: (b.historial || []).slice(-6),
    };
  }

  function commit(fn) {
    fn(model);
    listeners.forEach((l) => l({}));
    guardar();
  }

  /** Repinta sin marcar el documento como cambiado (progreso, previews). */
  function repintar() {
    listeners.forEach((l) => l({}));
  }

  const imagenActual = () => model.imagenes.find((i) => i.id === model.seleccionada) || null;

  // ══════════════════════════════════════════════════════════════════
  // Utilidades de canvas
  // ══════════════════════════════════════════════════════════════════

  /** Bitmaps ya descargados, por URL. Una imagen de 12000 px no se recarga. */
  const bitmaps = new Map();

  async function cargarBitmap(url) {
    if (bitmaps.has(url)) return bitmaps.get(url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const listo = new Promise((res, rej) => {
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('No se pudo cargar la imagen.'));
    });
    img.src = url;
    const cargada = await listo;
    bitmaps.set(url, cargada);
    return cargada;
  }

  function lienzo(w, ht) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(ht));
    return c;
  }

  /** Recorte de una imagen como canvas nuevo. */
  function recortar(fuente, x0, y0, x1, y1) {
    const c = lienzo(x1 - x0, y1 - y0);
    c.getContext('2d').drawImage(fuente, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
    return c;
  }

  const base64De = (canvas, tipo = 'image/png') =>
    canvas.toDataURL(tipo).split(',')[1];

  function canvasABlob(canvas, tipo = 'image/png') {
    return new Promise((res) => canvas.toBlob(res, tipo));
  }

  const limita = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function acotarCaja(caja, w, ht) {
    let [x0, y0, x1, y1] = caja.map((v) => Math.round(v));
    x0 = limita(x0, 0, w - 1);
    y0 = limita(y0, 0, ht - 1);
    x1 = limita(x1, x0 + 1, w);
    y1 = limita(y1, y0 + 1, ht);
    return [x0, y0, x1, y1];
  }

  const aHex = (c) =>
    '#' + [c[0], c[1], c[2]].map((v) => Math.round(limita(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();

  function deHex(hex) {
    let s = String(hex || '#FFFFFF').replace('#', '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    const n = parseInt(s, 16);
    if (Number.isNaN(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const mediana = (xs) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const percentil = (xs, p) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[limita(Math.floor((p / 100) * s.length), 0, s.length - 1)];
  };

  const desviacion = (xs) => {
    if (xs.length < 2) return 0;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  };

  // ══════════════════════════════════════════════════════════════════
  // Cortar la imagen en paneles
  // ══════════════════════════════════════════════════════════════════

  /**
   * Corta una imagen alta en paneles, buscando el corte en franjas de fondo
   * limpio.
   *
   * Cortar cada N píxeles a ciegas parte un titular por la mitad, y entonces
   * el modelo de visión ve media frase en cada panel y traduce dos trozos que
   * no pegan. Se busca, alrededor del alto objetivo, la fila con menos
   * variación horizontal: esa es una franja de fondo, no una de texto.
   */
  function cortarPaneles(bitmap, objetivo, minimo = 700, maximo = 2400) {
    const W = bitmap.width;
    const H = bitmap.height;
    if (H <= objetivo * 1.35) return [{ y0: 0, y1: H }];

    // Se mide sobre una versión estrecha: para saber si una fila es fondo
    // limpio no hacen falta 1200 px, y con la imagen completa esto tardaría
    // segundos en cada apertura.
    const anchoMuestra = Math.min(160, W);
    const c = lienzo(anchoMuestra, H);
    c.getContext('2d').drawImage(bitmap, 0, 0, W, H, 0, 0, anchoMuestra, H);
    const datos = c.getContext('2d').getImageData(0, 0, anchoMuestra, H).data;

    // Variación horizontal de cada fila: alta = hay algo dibujado.
    const variacion = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      let suma = 0;
      let suma2 = 0;
      const base = y * anchoMuestra * 4;
      for (let x = 0; x < anchoMuestra; x++) {
        const i = base + x * 4;
        const l = (datos[i] * 299 + datos[i + 1] * 587 + datos[i + 2] * 114) / 1000;
        suma += l;
        suma2 += l * l;
      }
      const media = suma / anchoMuestra;
      variacion[y] = Math.sqrt(Math.max(0, suma2 / anchoMuestra - media * media));
    }

    const cortes = [0];
    let y = 0;
    while (H - y > maximo) {
      const ideal = y + objetivo;
      const desde = Math.max(y + minimo, ideal - Math.round(objetivo * 0.45));
      const hasta = Math.min(H - minimo, ideal + Math.round(objetivo * 0.45));
      let mejor = ideal;
      let mejorV = Infinity;
      for (let k = desde; k <= hasta; k++) {
        // Se premia la franja limpia y, a igualdad, la más cercana al ideal:
        // sin eso el corte se va al extremo del rango buscando un óptimo
        // marginal y los paneles quedan de tamaños dispares.
        const v = variacion[k] + Math.abs(k - ideal) * 0.004;
        if (v < mejorV) { mejorV = v; mejor = k; }
      }
      cortes.push(mejor);
      y = mejor;
    }
    cortes.push(H);

    const paneles = [];
    for (let i = 0; i < cortes.length - 1; i++) {
      paneles.push({ y0: cortes[i], y1: cortes[i + 1] });
    }
    return paneles;
  }

  // ══════════════════════════════════════════════════════════════════
  // Medir un bloque sobre los píxeles reales
  // ══════════════════════════════════════════════════════════════════

  /**
   * Todo lo observable de un bloque de texto, medido sobre la imagen.
   *
   * El modelo de visión acierta bastante con QUÉ dice un texto y bastante
   * poco con su caja exacta, su color y su interlineado. Eso segundo está
   * escrito en los píxeles, que no opinan: se mide y se acabó.
   */
  function medirBloque(bitmap, caja) {
    const FW = bitmap.width;
    const FH = bitmap.height;
    const abox = acotarCaja(caja, FW, FH);
    const bh = abox[3] - abox[1];

    // Ventana de trabajo: sólo la franja necesaria. Las imágenes llegan a
    // 12000 px de alto y volcar el canvas completo por cada bloque sería
    // inviable.
    const mx = Math.max(240, Math.round(bh * 4));
    const my = Math.max(28, Math.round(bh * 1.2));
    const wx0 = Math.max(0, abox[0] - mx);
    const wy0 = Math.max(0, abox[1] - my);
    const wx1 = Math.min(FW, abox[2] + mx);
    const wy1 = Math.min(FH, abox[3] + my);

    const W = wx1 - wx0;
    const H = wy1 - wy0;
    const ctx = recortar(bitmap, wx0, wy0, wx1, wy1).getContext('2d');
    const px = ctx.getImageData(0, 0, W, H).data;

    const leer = (x, y) => {
      const i = (y * W + x) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    };

    const box = [abox[0] - wx0, abox[1] - wy0, abox[2] - wx0, abox[3] - wy0];
    const [x0, y0, x1, y1] = box;
    const pad = Math.max(6, Math.round(bh * 0.35));

    const a = {
      ajustada: abox,
      modoFondo: 'flat',
      colorFondo: [0, 0, 0],
      ruidoFondo: 0,
      tipoColor: 'solid',
      color: '#FFFFFF',
      paradas: [],
      lineas: [],
      altoLinea: Math.max(8, bh),
      interlineado: 1.3,
      alinear: 'left',
      confianza: 1,
      aviso: '',
    };

    // ── El fondo se estima desde el marco EXTERIOR, nunca desde el texto ──
    // La caja del modelo suele quedar corta, así que el anillo cae sobre los
    // glifos. La dispersión se mide con un percentil y no con la desviación
    // estándar, para que unos pocos píxeles de texto no la disparen.
    const anillo = [];
    const tomar = (ax0, ay0, ax1, ay1) => {
      const paso = Math.max(1, Math.round(((ax1 - ax0) * (ay1 - ay0)) / 4000));
      let n = 0;
      for (let y = ay0; y < ay1; y++) {
        for (let x = ax0; x < ax1; x++) {
          if (n++ % paso) continue;
          anillo.push(leer(x, y));
        }
      }
    };
    const ox0 = Math.max(0, x0 - pad);
    const oy0 = Math.max(0, y0 - pad);
    const ox1 = Math.min(W, x1 + pad);
    const oy1 = Math.min(H, y1 + pad);
    if (oy0 < y0) tomar(ox0, oy0, ox1, y0);
    if (y1 < oy1) tomar(ox0, y1, ox1, oy1);
    if (ox0 < x0) tomar(ox0, oy0, x0, oy1);
    if (x1 < ox1) tomar(x1, oy0, ox1, oy1);
    if (!anillo.length) anillo.push([0, 0, 0]);

    const bg = [0, 1, 2].map((k) => mediana(anillo.map((c) => c[k])));
    a.colorFondo = bg.map(Math.round);
    const dist = (c) => Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2]);
    a.ruidoFondo = percentil(anillo.map(dist), 70);

    // ¿Degradado vertical? Se compara el marco superior con el inferior.
    const franja = (fy0, fy1) => {
      const out = [];
      const paso = Math.max(1, Math.round((x1 - x0) / 60));
      for (let y = fy0; y < fy1; y += 1) {
        for (let x = x0; x < x1; x += paso) out.push(leer(x, y));
      }
      return out;
    };
    const arriba = franja(Math.max(0, y0 - pad), y0);
    const abajo = franja(y1, Math.min(H, y1 + pad));
    let dv = 0;
    if (arriba.length && abajo.length) {
      const ma = [0, 1, 2].map((k) => mediana(arriba.map((c) => c[k])));
      const mb = [0, 1, 2].map((k) => mediana(abajo.map((c) => c[k])));
      dv = Math.hypot(ma[0] - mb[0], ma[1] - mb[1], ma[2] - mb[2]);
    }
    if (a.ruidoFondo > 30) a.modoFondo = 'photo';
    else if (dv > 14 || a.ruidoFondo > 11) a.modoFondo = 'vgradient';
    else a.modoFondo = 'flat';

    // ── Pasada 1: estructura de líneas, en una ventana ESTRECHA ──────────
    // Ensanchar aquí sería contraproducente: el análisis alcanzaría elementos
    // vecinos (marcas de agua, columnas contiguas) cuya tinta rellena los
    // huecos entre renglones y funde el párrafo en un solo bloque.
    const sx0 = Math.max(0, x0 - Math.round(bh * 0.35));
    const sy0 = Math.max(0, y0 - Math.round(bh * 0.25));
    const sx1 = Math.min(W, x1 + Math.round(bh * 0.35));
    const sy1 = Math.min(H, y1 + Math.round(bh * 0.25));

    const distancias = [];
    const pasoM = Math.max(1, Math.round((sx1 - sx0) / 80));
    for (let y = sy0; y < sy1; y++) {
      for (let x = sx0; x < sx1; x += pasoM) distancias.push(dist(leer(x, y)));
    }
    const thr = Math.max(34, percentil(distancias, 82) * 0.55);
    const thrLo = Math.max(11, thr * 0.42);   // borde suavizado del glifo

    let tinta = 0;
    const filaTiene = new Uint8Array(sy1 - sy0);
    for (let y = sy0; y < sy1; y++) {
      for (let x = sx0; x < sx1; x++) {
        if (dist(leer(x, y)) > thr) { filaTiene[y - sy0] = 1; tinta++; break; }
      }
    }

    if (tinta < 2) {
      // Nada medible: se confía en la caja del modelo y se dice que se confía.
      a.ajustada = abox;
      a.altoLinea = Math.max(8, bh);
      a.lineas = [[abox[1], abox[3]]];
      a.confianza = 0.35;
      const claro = (bg[0] + bg[1] + bg[2]) / 3 < 128;
      a.color = claro ? '#FFFFFF' : '#000000';
      return a;
    }

    const minHueco = Math.max(2, Math.round(bh * 0.04));
    const tramos = [];
    let ini = null;
    let hueco = 0;
    for (let i = 0; i < filaTiene.length; i++) {
      if (filaTiene[i]) { if (ini === null) ini = i; hueco = 0; }
      else if (ini !== null) {
        hueco++;
        if (hueco >= minHueco) { tramos.push([sy0 + ini, sy0 + i - hueco + 1]); ini = null; }
      }
    }
    if (ini !== null) tramos.push([sy0 + ini, sy0 + filaTiene.length]);
    const largos = tramos.filter((r) => r[1] - r[0] >= 4);

    // Sólo cuentan las líneas de ESTE bloque: las que solapan la caja del
    // modelo. Así un bloque no se roba el renglón del bloque de al lado.
    const propia = (r) => {
      const ov = Math.min(r[1], y1) - Math.max(r[0], y0);
      return ov > 0.32 * (r[1] - r[0]) || (r[0] <= ((y0 + y1) >> 1) && ((y0 + y1) >> 1) < r[1]);
    };
    const suyas = largos.filter(propia);
    a.lineas = (suyas.length ? suyas : largos).length ? (suyas.length ? suyas : largos) : [[y0, y1]];

    let ry0 = a.lineas[0][0];
    let ry1 = a.lineas[a.lineas.length - 1][1];
    const lh = Math.max(6, Math.round(mediana(a.lineas.map((r) => r[1] - r[0]))));

    // ── Pasada 2: ancho real de los glifos ───────────────────────────────
    // Ventana ANCHA pero ya acotada al alto de renglón. Se crece desde la
    // caja del modelo mientras la tinta siga contigua (huecos menores a un
    // espacio), de modo que se recuperan los glifos que el modelo dejó fuera
    // sin tragarse lo que hay al lado.
    const gm = Math.max(140, Math.round(lh * 6));
    const gx0 = Math.max(0, x0 - gm);
    const gx1 = Math.min(W, x1 + gm);
    const colTiene = new Uint8Array(gx1 - gx0);
    for (let x = gx0; x < gx1; x++) {
      for (let y = ry0; y < ry1; y++) {
        if (dist(leer(x, y)) > thrLo) { colTiene[x - gx0] = 1; break; }
      }
    }

    const maxHueco = Math.max(3, Math.round(lh * 0.62));
    let cx0 = limita(x0 - gx0, 0, colTiene.length - 1);
    let cx1 = limita(x1 - gx0, cx0 + 1, colTiene.length);
    for (let i = cx0 - 1, g = 0; i >= 0 && g <= maxHueco; i--) {
      if (colTiene[i]) { cx0 = i; g = 0; } else g++;
    }
    for (let i = cx1, g = 0; i < colTiene.length && g <= maxHueco; i++) {
      if (colTiene[i]) { cx1 = i + 1; g = 0; } else g++;
    }
    let primera = -1;
    let ultima = -1;
    for (let i = cx0; i < cx1; i++) {
      if (colTiene[i]) { if (primera < 0) primera = i; ultima = i; }
    }
    if (primera >= 0) { cx0 = primera; cx1 = ultima + 1; }

    // Con el ancho real ya conocido, se reajusta el alto: las ascendentes y
    // descendentes de las últimas palabras caen fuera de la ventana estrecha
    // y, si no se incluyen, el borrado deja colgando la cola de una «y».
    const vpad = Math.max(3, Math.round(lh * 0.6));
    const vy0 = Math.max(0, ry0 - vpad);
    const vy1 = Math.min(H, ry1 + vpad);
    const filaAncha = new Uint8Array(vy1 - vy0);
    for (let y = vy0; y < vy1; y++) {
      for (let x = gx0 + cx0; x < gx0 + cx1; x++) {
        if (dist(leer(x, y)) > thrLo) { filaAncha[y - vy0] = 1; break; }
      }
    }
    const maxVHueco = Math.max(1, Math.round(lh * 0.14));
    for (let t = ry0 - vy0 - 1, g = 0; t >= 0 && g <= maxVHueco; t--) {
      if (filaAncha[t]) { ry0 = vy0 + t; g = 0; } else g++;
    }
    for (let t = ry1 - vy0, g = 0; t < filaAncha.length && g <= maxVHueco; t++) {
      if (filaAncha[t]) { ry1 = vy0 + t + 1; g = 0; } else g++;
    }

    // ── Guarda de desborde ───────────────────────────────────────────────
    // Sobre una foto la tinta no se distingue del fondo: la máscara se llena,
    // el crecimiento se dispara y el borrado terminaría promediando la foto
    // entera. Cuando eso pasa no se intenta adivinar: se vuelve a la caja del
    // modelo y el bloque se marca para que lo resuelva el modelo de imagen.
    let relleno = 0;
    let total = 0;
    const pasoR = Math.max(1, Math.round((cx1 - cx0) / 60));
    for (let y = ry0; y < ry1; y++) {
      for (let x = gx0 + cx0; x < gx0 + cx1; x += pasoR) {
        total++;
        if (dist(leer(x, y)) > thr) relleno++;
      }
    }
    const proporcion = total ? relleno / total : 0;
    const desbordado =
      proporcion > 0.5 ||
      (ry1 - ry0) > (y1 - y0) * 1.8 + 8 ||
      (cx1 - cx0) > (x1 - x0) * 2.2 + 80;

    if (desbordado) {
      const n = Math.max(1, a.lineas.filter((r) => r[0] < y1 && r[1] > y0).length);
      a.modoFondo = 'photo';
      a.confianza = 0.3;
      a.aviso = 'fondo tipo foto: la medición automática no es fiable, conviene redibujar este bloque con IA';
      a.lineas = [];
      for (let i = 0; i < n; i++) {
        a.lineas.push([y0 + Math.round((i * (y1 - y0)) / n), y0 + Math.round(((i + 1) * (y1 - y0)) / n)]);
      }
      ry0 = y0; ry1 = y1;
      cx0 = x0 - gx0; cx1 = x1 - gx0;
    }

    a.ajustada = [gx0 + cx0 + wx0, ry0 + wy0, gx0 + cx1 + wx0, ry1 + wy0];

    const alturas = a.lineas.map((r) => r[1] - r[0]);
    // Con una sola línea el alto de referencia es el de la caja ya ajustada
    // (incluye tildes y descendentes); con varias, la mediana de los renglones.
    a.altoLinea = (a.lineas.length === 1 && !a.aviso)
      ? Math.max(6, ry1 - ry0)
      : Math.round(mediana(alturas)) || bh;
    if (a.lineas.length > 1) {
      const pasos = [];
      for (let i = 0; i < a.lineas.length - 1; i++) pasos.push(a.lineas[i + 1][0] - a.lineas[i][0]);
      a.interlineado = Math.max(1, mediana(pasos) / Math.max(1, a.altoLinea));
    }

    // ── Alineación y color, sobre la ventana ANCHA ───────────────────────
    // Es la única que contiene el bloque completo. Medirlos en la estrecha
    // truncaría el texto y, con él, el extremo final de un degradado.
    if (a.lineas.length > 1) {
      const izq = [];
      const der = [];
      for (const [ly0, ly1] of a.lineas) {
        let p = -1;
        let u = -1;
        for (let x = gx0; x < gx1; x++) {
          let hay = false;
          for (let y = Math.max(0, ly0); y < Math.min(H, Math.max(ly0 + 1, ly1)); y++) {
            if (dist(leer(x, y)) > thrLo) { hay = true; break; }
          }
          if (hay) { if (p < 0) p = x; u = x; }
        }
        if (p >= 0) { izq.push(p); der.push(u); }
      }
      if (izq.length > 1) {
        const centros = izq.map((l, i) => (l + der[i]) / 2);
        const ds = [desviacion(izq), desviacion(der), desviacion(centros)];
        a.alinear = ['left', 'right', 'center'][ds.indexOf(Math.min(...ds))];
      }
    }

    // ── Color del texto: mediana de los píxeles con más tinta ────────────
    const fuertes = [];
    for (let y = ry0; y < ry1; y++) {
      for (let x = gx0 + cx0; x < gx0 + cx1; x++) {
        const c = leer(x, y);
        if (dist(c) > thr) fuertes.push({ x, c });
      }
    }
    if (fuertes.length >= 10) {
      a.color = aHex([0, 1, 2].map((k) => mediana(fuertes.map((f) => f.c[k]))));
      // ¿Degradado horizontal? Se compara el cuarto izquierdo con el derecho.
      fuertes.sort((p, q) => p.x - q.x);
      const n = fuertes.length;
      const k = Math.max(6, n >> 2);
      const med = (arr) => aHex([0, 1, 2].map((j) => mediana(arr.map((f) => f.c[j]))));
      const ci = med(fuertes.slice(0, k));
      const cd = med(fuertes.slice(-k));
      const cm = med(fuertes.slice(Math.max(0, (n >> 1) - (k >> 1)), (n >> 1) + (k >> 1)));
      const vi = deHex(ci);
      const vd = deHex(cd);
      if (Math.hypot(vi[0] - vd[0], vi[1] - vd[1], vi[2] - vd[2]) > 58) {
        a.tipoColor = 'gradient';
        a.paradas = [ci, cm, cd];
      }
    }

    return a;
  }

  // ══════════════════════════════════════════════════════════════════
  // Borrar el texto original
  // ══════════════════════════════════════════════════════════════════

  /**
   * Borra una caja reconstruyendo el fondo desde sus bordes. Modifica el
   * contexto in situ.
   *
   *   flat      → color plano (fondo uniforme)
   *   vgradient → interpolación fila a fila entre el borde izquierdo y el derecho
   *   photo     → lo mismo, desenfocado (aproximación: mejor redibujar con IA)
   *
   * El corte se desvanece de forma gradual. Uno seco secciona el fondo con
   * una línea recta bien visible, y en un degradado se nota aún más que el
   * texto que se quitó.
   */
  function borrarZona(ctx, caja, modo, relleno, plumaExtra) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    let [x0, y0, x1, y1] = acotarCaja(caja, W, H);
    const margen = relleno != null ? relleno : Math.max(5, Math.round((y1 - y0) * 0.22));
    [x0, y0, x1, y1] = acotarCaja([x0 - margen, y0 - margen, x1 + margen, y1 + margen], W, H);
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw < 1 || bh < 1) return;

    const k = Math.max(2, Math.min(8, x0, W - x1));
    const fuera = ctx.getImageData(
      Math.max(0, x0 - k), Math.max(0, y0 - k),
      Math.min(W, x1 + k) - Math.max(0, x0 - k),
      Math.min(H, y1 + k) - Math.max(0, y0 - k),
    );
    const fx0 = Math.max(0, x0 - k);
    const fy0 = Math.max(0, y0 - k);
    const fw = fuera.width;
    const leerFuera = (x, y) => {
      const i = ((y - fy0) * fw + (x - fx0)) * 4;
      return [fuera.data[i], fuera.data[i + 1], fuera.data[i + 2]];
    };

    const parche = ctx.createImageData(bw, bh);
    if (modo === 'flat') {
      // Mediana del marco exterior. La media se la lleva cualquier resto de
      // glifo que quedara dentro del anillo; la mediana no.
      const anillo = [];
      for (let x = fx0; x < fx0 + fw; x += 2) {
        if (y0 - 1 >= fy0) anillo.push(leerFuera(x, y0 - 1));
        if (y1 < fy0 + fuera.height) anillo.push(leerFuera(x, y1));
      }
      for (let y = fy0; y < fy0 + fuera.height; y += 2) {
        if (x0 - 1 >= fx0) anillo.push(leerFuera(x0 - 1, y));
        if (x1 < fx0 + fw) anillo.push(leerFuera(x1, y));
      }
      const c = anillo.length ? [0, 1, 2].map((j) => mediana(anillo.map((p) => p[j]))) : [0, 0, 0];
      for (let i = 0; i < bw * bh; i++) {
        parche.data[i * 4] = c[0];
        parche.data[i * 4 + 1] = c[1];
        parche.data[i * 4 + 2] = c[2];
        parche.data[i * 4 + 3] = 255;
      }
    } else {
      // Fila a fila: se interpola entre el píxel exterior izquierdo y el
      // derecho. Un degradado vertical se reconstruye exacto así, sin tener
      // que saber que era un degradado.
      for (let y = 0; y < bh; y++) {
        const ay = limita(y0 + y, fy0, fy0 + fuera.height - 1);
        const li = x0 - 1 >= fx0 ? leerFuera(x0 - 1, ay) : leerFuera(limita(x0, fx0, fx0 + fw - 1), ay);
        const de = x1 < fx0 + fw ? leerFuera(x1, ay) : li;
        for (let x = 0; x < bw; x++) {
          const t = bw > 1 ? x / (bw - 1) : 0;
          const i = (y * bw + x) * 4;
          parche.data[i] = li[0] * (1 - t) + de[0] * t;
          parche.data[i + 1] = li[1] * (1 - t) + de[1] * t;
          parche.data[i + 2] = li[2] * (1 - t) + de[2] * t;
          parche.data[i + 3] = 255;
        }
      }
    }

    const cp = lienzo(bw, bh);
    cp.getContext('2d').putImageData(parche, 0, 0);
    if (modo === 'photo') {
      const desenfocado = lienzo(bw, bh);
      const dctx = desenfocado.getContext('2d');
      dctx.filter = `blur(${Math.max(2, bh / 22)}px)`;
      dctx.drawImage(cp, 0, 0);
      dctx.filter = 'none';
      cp.getContext('2d').clearRect(0, 0, bw, bh);
      cp.getContext('2d').drawImage(desenfocado, 0, 0);
    }

    // Máscara de bordes suaves, para que el parche no deje costura.
    const pluma = Math.max(1, plumaExtra != null ? plumaExtra : 3);
    const mascara = lienzo(bw, bh);
    const mctx = mascara.getContext('2d');
    mctx.filter = `blur(${pluma}px)`;
    mctx.fillStyle = '#fff';
    mctx.fillRect(pluma, pluma, Math.max(1, bw - pluma * 2), Math.max(1, bh - pluma * 2));
    mctx.filter = 'none';

    const compuesto = lienzo(bw, bh);
    const cctx = compuesto.getContext('2d');
    cctx.drawImage(cp, 0, 0);
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(mascara, 0, 0);
    cctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(compuesto, x0, y0);
  }

  // ══════════════════════════════════════════════════════════════════
  // Redibujar el texto
  // ══════════════════════════════════════════════════════════════════

  const PESOS = {
    thin: 250, light: 300, regular: 400, medium: 500,
    semibold: 600, bold: 700, extrabold: 800, black: 900,
  };

  // La familia sale de los tokens del tema del host: si el tenant cambia su
  // tipografía de marca, los banners salen con ella sin tocar esta app.
  function familia() {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--font-sans');
      if (v && v.trim()) return v.trim();
    } catch { /* fuera del DOM: se usa la de reserva */ }
    return 'Inter, Roboto, system-ui, sans-serif';
  }

  const fuenteCss = (tam, peso) => `${PESOS[peso] || 400} ${Math.max(6, Math.round(tam))}px ${familia()}`;

  /** Alto de tinta real del texto, no el alto nominal de la fuente. */
  function altoTinta(ctx, texto, tam, peso) {
    ctx.font = fuenteCss(tam, peso);
    const m = ctx.measureText(texto || 'Hg');
    const asc = m.actualBoundingBoxAscent;
    const desc = m.actualBoundingBoxDescent;
    if (Number.isFinite(asc) && Number.isFinite(desc)) return Math.max(1, asc + desc);
    return Math.max(1, tam * 0.72);
  }

  const anchoTexto = (ctx, texto, tam, peso) => {
    ctx.font = fuenteCss(tam, peso);
    return Math.max(1, ctx.measureText(texto || '').width);
  };

  function partirEnLineas(ctx, texto, tam, peso, anchoMax) {
    const palabras = String(texto || '').split(/\s+/).filter(Boolean);
    if (!palabras.length) return [''];
    const lineas = [];
    let actual = palabras[0];
    for (let i = 1; i < palabras.length; i++) {
      const tentativa = actual + ' ' + palabras[i];
      if (anchoTexto(ctx, tentativa, tam, peso) <= anchoMax) actual = tentativa;
      else { lineas.push(actual); actual = palabras[i]; }
    }
    lineas.push(actual);
    return lineas;
  }

  /**
   * El tamaño que reproduce el alto de glifo original sin desbordar la caja.
   *
   * Arranca en el que reproduce el alto medido en el original y encoge
   * mientras el español —que suele ser ~20 % más largo que el inglés— no
   * entre. La medida se toma sobre el propio texto en español y no sobre una
   * «H», para que el alto de referencia (que ya incluye tildes y
   * descendentes) sea comparable.
   */
  function ajustarTamano(ctx, texto, peso, anchoCaja, altoCaja, altoRef, interlineado, maxLineas, escala) {
    const muestra = (String(texto || 'Hg').split('\n')[0] || 'Hg').slice(0, 60);
    const ref100 = altoTinta(ctx, muestra, 100, peso);
    let tam = Math.max(7, Math.round((altoRef * 100) / Math.max(1, ref100) * (escala || 1)));

    let ultimo = null;
    for (let i = 0; i < 46; i++) {
      const lineas = partirEnLineas(ctx, texto, tam, peso, anchoCaja);
      const lh = altoTinta(ctx, 'Hg', tam, peso);
      const alto = Math.round(lh * interlineado * (lineas.length - 1)) + lh;
      const masAncha = Math.max(...lineas.map((l) => anchoTexto(ctx, l, tam, peso)));
      const cabeAncho = masAncha <= anchoCaja;
      const cabeAlto = alto <= altoCaja;
      const cabenLineas = !maxLineas || lineas.length <= maxLineas + 1;
      ultimo = { tam, lineas, lh };
      if (cabeAncho && cabeAlto && cabenLineas) return ultimo;
      if (tam <= 7) break;
      tam = Math.max(7, Math.round(tam * 0.94));
    }
    return ultimo;
  }

  /** Pinta un bloque ya medido y traducido sobre el contexto. */
  function pintarBloque(ctx, bloque, medida) {
    const texto = (bloque.es || '').trim();
    if (!texto) return;

    const [ax0, ay0, ax1, ay1] = medida.ajustada;
    const anchoCaja = Math.max(8, ax1 - ax0 + (bloque.anchoExtra || 0));
    const nLineas = Math.max(1, medida.lineas.length);
    // Se deja crecer en alto un poco: si el español necesita una línea más,
    // apretarlo al alto exacto del inglés lo deja ilegible.
    const altoCaja = Math.max(10, (ay1 - ay0) * 1.45);

    const ajuste = ajustarTamano(
      ctx, texto, bloque.peso || 'regular',
      anchoCaja, altoCaja, medida.altoLinea, medida.interlineado, nLineas,
      bloque.escala || 1,
    );
    if (!ajuste) return;

    const { tam, lineas, lh } = ajuste;
    const paso = lh * medida.interlineado;
    const alineacion = bloque.alinear || medida.alinear || 'left';

    // Se pinta desde el mismo borde que ocupaba el original: el alto total
    // del español puede diferir, y centrarlo verticalmente sobre la caja
    // original es lo que evita que el bloque «baile» respecto de sus vecinos.
    const altoTotal = paso * (lineas.length - 1) + lh;
    const centroY = (ay0 + ay1) / 2 + (bloque.dy || 0);
    let y = centroY - altoTotal / 2 + lh;

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.font = fuenteCss(tam, bloque.peso || 'regular');

    const color = bloque.colorForzado || medida.color;
    if (!bloque.colorForzado && medida.tipoColor === 'gradient' && medida.paradas.length >= 3) {
      const g = ctx.createLinearGradient(ax0, 0, ax1, 0);
      g.addColorStop(0, medida.paradas[0]);
      g.addColorStop(0.5, medida.paradas[1]);
      g.addColorStop(1, medida.paradas[2]);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = color;
    }

    for (const linea of lineas) {
      const w = anchoTexto(ctx, linea, tam, bloque.peso || 'regular');
      let x = ax0 + (bloque.dx || 0);
      if (alineacion === 'center') x = (ax0 + ax1) / 2 - w / 2 + (bloque.dx || 0);
      else if (alineacion === 'right') x = ax1 - w + (bloque.dx || 0);
      ctx.fillText(linea, x, y);
      y += paso;
    }
    ctx.restore();
  }

  /**
   * Compone un panel: el original, con cada bloque activo borrado y
   * redibujado en español.
   *
   * Los bloques desactivados, descartados o sin traducción no se tocan: su
   * inglés queda intacto, que es exactamente lo que se quiere para un logo,
   * una sigla o la letra legal.
   */
  function componerPanel(bitmap, panel, medidas) {
    const c = recortar(bitmap, 0, panel.y0, bitmap.width, panel.y1);
    const ctx = c.getContext('2d');
    for (const b of panel.bloques || []) {
      if (b.descartado || b.traducir === false || !(b.es || '').trim()) continue;
      const m = medidas[b.id];
      if (!m) continue;
      const rel = {
        ...m,
        ajustada: [m.ajustada[0], m.ajustada[1] - panel.y0, m.ajustada[2], m.ajustada[3] - panel.y0],
        lineas: m.lineas.map(([a2, b2]) => [a2 - panel.y0, b2 - panel.y0]),
      };
      const modo = b.fondoForzado || m.modoFondo;
      borrarZona(ctx, rel.ajustada, modo);
      pintarBloque(ctx, b, rel);
    }
    return c;
  }

  // ══════════════════════════════════════════════════════════════════
  // La IA: visión con esquema y edición de imagen
  // ══════════════════════════════════════════════════════════════════

  const hayIA = () => !!(shell.ai && shell.ai.analyzeImage);

  /** Suma lo gastado. Un botón sin precio es un botón que nadie audita. */
  function apuntarGasto(uso) {
    const t = (uso && uso.total) || 0;
    commit((m) => { m.gastoTokens += t; m.llamadas += 1; });
    return t;
  }

  /** Esquema de detección: lo que convierte la visión en algo recorrible. */
  const ESQUEMA_BLOQUES = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        box_2d: {
          type: 'ARRAY',
          items: { type: 'INTEGER' },
          description: '[ymin,xmin,ymax,xmax] normalizado 0-1000',
        },
        text: { type: 'STRING', description: 'texto exacto tal como aparece' },
        es: { type: 'STRING', description: 'traducción' },
        role: {
          type: 'STRING',
          enum: ['headline', 'subheadline', 'body', 'stat_number', 'stat_label',
                 'caption', 'button', 'list_item', 'spec_key', 'spec_value',
                 'logo_or_brand', 'watermark'],
        },
        weight: {
          type: 'STRING',
          enum: ['thin', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'],
        },
        align: { type: 'STRING', enum: ['left', 'center', 'right'] },
        translate: {
          type: 'BOOLEAN',
          description: 'false si es marca, modelo, sigla técnica o marca de agua',
        },
        note: { type: 'STRING', description: 'aviso breve si algo es dudoso' },
      },
      required: ['box_2d', 'text', 'es', 'role', 'weight', 'align', 'translate'],
    },
  };

  function textoGlosario() {
    const g = model.glosario || nuevoGlosario();
    const noTr = (g.noTraducir || []).join(', ') || '(ninguno)';
    const terminos = Object.entries(g.terminos || {})
      .map(([k, v]) => `  ${k} -> ${v}`).join('\n') || '  (ninguno)';
    return { noTr, terminos };
  }

  function promptDeteccion(extra = '') {
    const { noTr, terminos } = textoGlosario();
    const producto = model.producto ? ` del producto "${model.producto}"` : '';
    return `Eres un especialista en localización de imágenes de marketing de ecommerce.

Esta imagen es un panel vertical de una página de producto${producto}, en otro idioma.
Tu tarea: detectar CADA bloque de texto legible y traducirlo a ${model.idioma}.

REGLAS DE DETECCIÓN
- Un bloque = una unidad visual de texto: un titular, un párrafo, o un número
  grande con su etiqueta van SEPARADOS; cada ítem de una lista va separado.
- box_2d debe ceñirse al texto, sin márgenes generosos: [ymin,xmin,ymax,xmax] en 0-1000.
- Incluye también el texto incrustado dentro de fotos o renders del producto.
- Marca translate=false para: logos, marcas de agua, nombres de marca y modelo,
  siglas técnicas y unidades. Igual reporta el bloque, con es = igual al original.

REGLAS DE TRADUCCIÓN
- Tono: ${model.tono}.
- El español es más largo: prefiere la versión más CORTA y natural que conserve
  el sentido. Los titulares deben sonar a titular, no a traducción literal.
- Respeta mayúsculas y minúsculas del original (si va en MAYÚSCULAS, traduce en MAYÚSCULAS).
- Conserva números, unidades y símbolos exactamente: 85Wh, 144Hz, 8.8", 1TB, 25+.
- NUNCA traducir: ${noTr}
- Glosario obligatorio:
${terminos}
${extra}
Devuelve solo el JSON del array de bloques, ordenado de arriba hacia abajo.`;
  }

  /** Analiza un panel: detecta bloques y los traduce. Una llamada. */
  async function analizarPanel(imagen, panel, extra = '') {
    const bitmap = await cargarBitmap(imagen.url);
    const c = recortar(bitmap, 0, panel.y0, bitmap.width, panel.y1);
    const res = await shell.ai.analyzeImage({
      images: [base64De(c)],
      prompt: promptDeteccion(extra),
      schema: ESQUEMA_BLOQUES,
      model: model.modeloVision || undefined,
    });
    apuntarGasto(res.usage);

    const crudos = Array.isArray(res.data) ? res.data : [];
    if (!crudos.length && !res.data) {
      throw new Error('El modelo no devolvió bloques legibles. Prueba de nuevo o con otro modelo de visión.');
    }

    const W = bitmap.width;
    const alto = panel.y1 - panel.y0;
    return crudos.map((b, i) => {
      // box_2d viene normalizado 0-1000 y en orden [ymin,xmin,ymax,xmax]:
      // confundir ese orden es el error clásico y deja todo girado 90°.
      const [ymin, xmin, ymax, xmax] = (b.box_2d || [0, 0, 100, 100]).map(Number);
      return {
        id: `b${Date.now().toString(36)}${i}`,
        caja: [
          Math.round((xmin / 1000) * W),
          Math.round(panel.y0 + (ymin / 1000) * alto),
          Math.round((xmax / 1000) * W),
          Math.round(panel.y0 + (ymax / 1000) * alto),
        ],
        en: String(b.text || ''),
        es: String(b.es || b.text || ''),
        rol: String(b.role || 'body'),
        peso: String(b.weight || 'regular'),
        alinear: String(b.align || 'left'),
        traducir: b.translate !== false,
        nota: String(b.note || ''),
        escala: 1, dx: 0, dy: 0, anchoExtra: 0,
        colorForzado: '', fondoForzado: '', descartado: false, historial: [],
      };
    });
  }

  /**
   * Reescribe la traducción de un bloque siguiendo una indicación libre.
   *
   * Se le manda el recorte real del bloque, no sólo el texto: viendo el
   * espacio que hay el modelo juzga mucho mejor si una versión cabe, que es
   * justo lo que se le suele estar pidiendo («que quepa en una línea»).
   */
  async function reescribir(bitmap, bloque, medida, instruccion, maxCaracteres = 0) {
    const { noTr, terminos } = textoGlosario();
    const limite = maxCaracteres
      ? `\nLÍMITE DURO: la respuesta debe tener ${maxCaracteres} caracteres o menos.`
      : '';
    const [x0, y0, x1, y1] = medida ? medida.ajustada : bloque.caja;
    const mx = Math.round((x1 - x0) * 0.2) + 20;
    const my = Math.round((y1 - y0) * 0.5) + 16;
    const recorte = recortar(
      bitmap,
      Math.max(0, x0 - mx), Math.max(0, y0 - my),
      Math.min(bitmap.width, x1 + mx), Math.min(bitmap.height, y1 + my),
    );

    const res = await shell.ai.analyzeImage({
      images: [base64De(recorte)],
      prompt: `En esta imagen hay un texto de un banner de producto. Ajusta su traducción.

ORIGINAL: ${bloque.en}
TRADUCCIÓN ACTUAL: ${bloque.es}
INDICACIÓN: ${instruccion}

Fíjate en el espacio disponible que se ve en la imagen: la traducción tiene
que caber ahí sin encogerse hasta ser ilegible.

Tono: ${model.tono}. Idioma: ${model.idioma}.
Conserva números y unidades exactos. NUNCA traducir: ${noTr}
Glosario obligatorio:
${terminos}${limite}

Responde SOLO con el texto final, sin comillas ni explicación.`,
      model: model.modeloVision || undefined,
      temperature: 0.4,
    });
    apuntarGasto(res.usage);
    return (res.text || bloque.es).trim().replace(/^["']|["']$/g, '');
  }

  /**
   * Redibuja un recorte con el texto en español usando el modelo de imagen.
   *
   * Se usa cuando el texto va sobre foto y el borrado local no queda limpio.
   * El recorte se amplía antes de mandarlo: estos modelos degradan mucho la
   * tipografía pequeña y darles más píxeles por glifo mejora bastante la
   * legibilidad. Aun así, con letra fina o párrafos largos el texto puede
   * salir deformado — hay que leerlo antes de aprobar.
   */
  async function redibujarRegion(bitmap, bloque, medida) {
    const [x0, y0, x1, y1] = medida.ajustada;
    // Contexto real alrededor: sin él, el modelo no sabe sobre qué está
    // pintando y devuelve un parche que no pega con su entorno.
    const mx = Math.round((x1 - x0) * 0.25) + 24;
    const my = Math.round((y1 - y0) * 0.6) + 20;
    const cx0 = Math.max(0, x0 - mx);
    const cy0 = Math.max(0, y0 - my);
    const cx1 = Math.min(bitmap.width, x1 + mx);
    const cy1 = Math.min(bitmap.height, y1 + my);

    let recorte = recortar(bitmap, cx0, cy0, cx1, cy1);
    const tamOriginal = { w: recorte.width, h: recorte.height };
    const factor = Math.min(3, Math.max(1, 900 / Math.max(1, Math.min(recorte.width, recorte.height))));
    if (factor > 1.05) {
      const grande = lienzo(Math.min(2048, recorte.width * factor), Math.min(2048, recorte.height * factor));
      const gctx = grande.getContext('2d');
      gctx.imageSmoothingQuality = 'high';
      gctx.drawImage(recorte, 0, 0, grande.width, grande.height);
      recorte = grande;
    }

    const res = await shell.ai.editImage({
      images: [base64De(recorte)],
      prompt: `Edita esta imagen. Es un recorte de un banner de producto.

Reemplaza el texto "${bloque.en}" por el texto en español "${bloque.es}".

OBLIGATORIO:
- Copia el texto en español CARÁCTER POR CARÁCTER, con sus tildes y su
  puntuación exactas. No inventes, no abrevies y no cambies ninguna palabra.
- Mantén idéntico TODO lo demás: fondo, producto, iluminación, texturas, encuadre.
- Usa exactamente la misma tipografía, peso, tamaño, color, degradado, sombra,
  inclinación y posición que tenía el texto original.
- No agregues ni quites ningún elemento. No cambies el encuadre ni los márgenes.
- No dejes rastros del texto original.`,
      // Sin fijar el encuadre el modelo re-encuadra y el parche ya no calza.
      aspect: 'auto',
      width: recorte.width,
      height: recorte.height,
      model: model.modeloImagen || undefined,
      // Se guarda en el almacén de la app en vez de volver en base64: el
      // parche ya está pagado, y un data URL que sólo vive en memoria se
      // pierde al recargar la ventana.
      store: true,
      folder: 'parches-ia',
      name: bloque.id,
    });
    apuntarGasto(res.usage);
    if (!res.url) throw new Error(res.text || 'El modelo no devolvió imagen.');

    // El tamaño de destino viaja con el parche: el modelo puede devolver
    // otras dimensiones, y al componer se reescala a las del recorte original
    // para que pegue exactamente donde iba.
    return { url: res.url, x: cx0, y: cy0, w: tamOriginal.w, h: tamOriginal.h };
  }

  /**
   * Redibuja un panel entero en una sola llamada.
   *
   * Sale mucho más barato que ir bloque por bloque: el coste lo domina la
   * imagen de salida, que es casi el mismo se regenere un recorte chico o el
   * panel completo. Si ibas a redibujar tres o más bloques, conviene esto.
   *
   * **El precio no se paga en créditos, se paga en fidelidad.** El modelo
   * resintetiza TODA la imagen, renders del producto incluidos: a tamaño de
   * pantalla se nota poco y el texto sale muy limpio, pero el detalle fino ya
   * no es la foto original. Por eso la versión IA se guarda aparte y no
   * reemplaza al overlay: se comparan y se elige al exportar.
   */
  async function redibujarPanel(imagen, panel, instruccion = '') {
    const bitmap = await cargarBitmap(imagen.url);
    const c = recortar(bitmap, 0, panel.y0, bitmap.width, panel.y1);
    const pares = (panel.bloques || [])
      .filter((b) => !b.descartado && (b.es || '').trim())
      .map((b, i) => `  ${i + 1}. "${b.en}"  ->  "${b.es}"`)
      .join('\n') || '  (sin textos detectados: traduce todo el texto visible)';

    const res = await shell.ai.editImage({
      images: [base64De(c)],
      prompt: `Esta imagen es un panel de una página de producto.
Devuelve la MISMA imagen con todos sus textos en ${model.idioma}.

TRADUCCIONES EXACTAS A USAR (cópialas carácter por carácter, con sus tildes):
${pares}

OBLIGATORIO:
- No cambies NADA que no sea texto: fondo, producto, fotos, iconos, colores,
  iluminación, texturas, encuadre, márgenes y posición de cada elemento se
  mantienen idénticos.
- Cada texto conserva su tipografía, peso, tamaño, color, degradado y posición.
- Respeta los saltos de línea y la cantidad de líneas de cada bloque original.
- No traduzcas marcas, modelos ni siglas técnicas: déjalas igual.
- No agregues ni quites elementos. No dejes ningún rastro del texto original.
${instruccion}`,
      aspect: 'auto',
      width: c.width,
      height: c.height,
      model: model.modeloImagen || undefined,
      store: true,
      folder: 'paneles-ia',
      name: `${imagen.nombre}-p${(imagen.paneles || []).indexOf(panel) + 1}`,
    });
    apuntarGasto(res.usage);
    if (!res.url) throw new Error(res.text || 'El modelo no devolvió imagen.');
    return res.url;
  }


  // ══════════════════════════════════════════════════════════════════
  // Medidas: el puente entre los píxeles y la pantalla
  // ══════════════════════════════════════════════════════════════════

  // Lo medido NO se persiste: se vuelve a medir sobre la imagen al abrir. Es
  // barato, y guardarlo sería guardar una copia que envejece en cuanto se
  // cambia una caja a mano.
  const medidas = new Map();   // bloqueId → medida

  async function medirPanel(imagen, panel) {
    const bitmap = await cargarBitmap(imagen.url);
    for (const b of panel.bloques || []) {
      if (!medidas.has(b.id)) medidas.set(b.id, medirBloque(bitmap, b.caja));
    }
    return bitmap;
  }

  function medidasDe(panel) {
    const out = {};
    for (const b of panel.bloques || []) {
      const m = medidas.get(b.id);
      if (m) out[b.id] = m;
    }
    return out;
  }

  const remedir = async (imagen, bloque) => {
    const bitmap = await cargarBitmap(imagen.url);
    medidas.set(bloque.id, medirBloque(bitmap, bloque.caja));
  };

  // ══════════════════════════════════════════════════════════════════
  // Acciones
  // ══════════════════════════════════════════════════════════════════

  const estado = {
    ocupado: '',      // texto de lo que está corriendo, '' si nada
    error: '',
    panelActivo: 0,
    mostrarCajas: false,
    vistaIA: false,   // overlay | IA, por panel
    previewUrl: '',
  };

  function ocupar(texto) {
    estado.ocupado = texto;
    estado.error = '';
    repintar();
  }

  function liberar(err) {
    estado.ocupado = '';
    estado.error = err ? String(err.message || err) : '';
    if (err) shell.notify({ level: 'error', text: estado.error });
    repintar();
  }

  /** Añade imágenes desde el selector de archivos. */
  async function agregarImagenes(archivos) {
    if (!shell.files) {
      shell.notify({ level: 'error', text: 'Este KIMOS no ofrece almacenamiento de archivos a las apps.' });
      return;
    }
    ocupar('Subiendo imágenes…');
    try {
      for (const archivo of archivos) {
        if (!/^image\//.test(archivo.type)) continue;
        const url = await shell.files.upload(archivo, { folder: 'originales', maxMB: 25 });
        const bitmap = await cargarBitmap(url);
        const paneles = cortarPaneles(bitmap, model.altoPanel).map((p) => ({
          ...p, bloques: [], aprobado: false, analizado: false, usarIA: false, urlIA: '',
        }));
        commit((m) => {
          m.imagenes.push({
            id: `im${Date.now().toString(36)}${m.imagenes.length}`,
            nombre: archivo.name.replace(/\.[^.]+$/, ''),
            url, ancho: bitmap.width, alto: bitmap.height,
            paneles, hecha: false, urlFinal: '',
          });
          if (!m.seleccionada) m.seleccionada = m.imagenes[m.imagenes.length - 1].id;
        });
      }
      liberar();
      shell.notify({ level: 'success', text: 'Imágenes cargadas.' });
    } catch (e) { liberar(e); }
  }

  /** Vuelve a cortar los paneles de una imagen con otro alto objetivo. */
  async function recortarPaneles(imagen, alto) {
    ocupar('Recortando paneles…');
    try {
      const bitmap = await cargarBitmap(imagen.url);
      const nuevos = cortarPaneles(bitmap, alto);
      commit((m) => {
        const im = m.imagenes.find((i) => i.id === imagen.id);
        if (!im) return;
        // Se pierde el trabajo de los paneles: las cajas estaban referidas a
        // otros cortes. Se avisa antes desde la UI, no aquí.
        im.paneles = nuevos.map((p) => ({
          ...p, bloques: [], aprobado: false, analizado: false, usarIA: false, urlIA: '',
        }));
        m.altoPanel = alto;
      });
      medidas.clear();
      estado.panelActivo = 0;
      liberar();
    } catch (e) { liberar(e); }
  }

  async function accionAnalizar(imagen, panel) {
    if (!hayIA()) {
      shell.notify({ level: 'error', text: 'Esta instalación de KIMOS no ofrece imagen generativa a las apps (permiso ai.image).' });
      return;
    }
    ocupar('Analizando el panel…');
    try {
      const bloques = await analizarPanel(imagen, panel);
      const bitmap = await cargarBitmap(imagen.url);
      for (const b of bloques) medidas.set(b.id, medirBloque(bitmap, b.caja));
      commit(() => {
        panel.bloques = bloques;
        panel.analizado = true;
        panel.aprobado = false;
      });
      liberar();
    } catch (e) { liberar(e); }
  }

  async function accionRedibujarBloque(imagen, bloque) {
    ocupar('Redibujando el bloque con IA…');
    try {
      const bitmap = await cargarBitmap(imagen.url);
      const medida = medidas.get(bloque.id) || medirBloque(bitmap, bloque.caja);
      const parche = await redibujarRegion(bitmap, bloque, medida);
      // El parche se guarda aparte y se aplica al componer: así se puede
      // descartar sin haber tocado el original.
      commit(() => { bloque.parcheIA = parche; });
      liberar();
    } catch (e) { liberar(e); }
  }

  async function accionRedibujarPanel(imagen, panel) {
    ocupar('Redibujando el panel entero con IA…');
    try {
      const url = await redibujarPanel(imagen, panel);
      commit(() => { panel.urlIA = url; panel.usarIA = true; });
      estado.vistaIA = true;
      liberar();
    } catch (e) { liberar(e); }
  }

  async function accionReescribir(imagen, bloque, instruccion, maxCaracteres) {
    ocupar('Reescribiendo…');
    try {
      const bitmap = await cargarBitmap(imagen.url);
      const nuevo = await reescribir(bitmap, bloque, medidas.get(bloque.id), instruccion, maxCaracteres);
      commit(() => {
        // Antes de sobrescribir, la versión anterior se archiva: regenerar es
        // una apuesta y volver atrás no debería costar otra llamada.
        bloque.historial = [...(bloque.historial || []), bloque.es].slice(-6);
        bloque.es = nuevo;
      });
      liberar();
    } catch (e) { liberar(e); }
  }

  /**
   * Exporta la imagen completa en español.
   *
   * El render final se hace sobre la imagen ENTERA, no pegando paneles: así
   * no hay costuras, y lo que está fuera de las cajas de texto queda idéntico
   * al original. Los paneles son sólo la unidad de trabajo y de revisión.
   */
  async function exportar(imagen) {
    ocupar('Componiendo la imagen final…');
    try {
      const bitmap = await cargarBitmap(imagen.url);
      const salida = lienzo(bitmap.width, bitmap.height);
      const ctx = salida.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      for (const panel of imagen.paneles || []) {
        if (panel.usarIA && panel.urlIA) {
          // Panel regenerado: se pega tal cual, reescalado al alto exacto del
          // panel por si el modelo devolvió otro tamaño.
          const ia = await cargarBitmap(panel.urlIA);
          ctx.drawImage(ia, 0, panel.y0, bitmap.width, panel.y1 - panel.y0);
          continue;
        }
        for (const b of panel.bloques || []) {
          if (b.descartado || b.traducir === false || !(b.es || '').trim()) continue;
          const m = medidas.get(b.id) || medirBloque(bitmap, b.caja);
          if (b.parcheIA) {
            const parche = await cargarBitmap(b.parcheIA.url);
            ctx.drawImage(parche, b.parcheIA.x, b.parcheIA.y, b.parcheIA.w, b.parcheIA.h);
            continue;
          }
          borrarZona(ctx, m.ajustada, b.fondoForzado || m.modoFondo);
          pintarBloque(ctx, b, m);
        }
      }

      const blob = await canvasABlob(salida);
      const archivo = new File([blob], `${imagen.nombre}-es.png`, { type: 'image/png' });
      const url = await shell.files.upload(archivo, { folder: 'traducidas', maxMB: 25 });
      commit(() => {
        const im = model.imagenes.find((i) => i.id === imagen.id);
        if (im) { im.hecha = true; im.urlFinal = url; }
      });
      liberar();
      shell.notify({ level: 'success', text: `Exportada: ${imagen.nombre}-es.png` });
      return url;
    } catch (e) { liberar(e); return ''; }
  }

  // ══════════════════════════════════════════════════════════════════
  // El agente
  // ══════════════════════════════════════════════════════════════════

  // El agente opera las MISMAS funciones que la UI, así que la pantalla se
  // repinta sola cuando actúa. Todo lo que llega de fuera se valida: un
  // agente puede mandar un índice fuera de rango o un id que no existe.
  const desregistrar = shell.agent && shell.agent.register ? shell.agent.register({
    label: 'Traductor de Banners',
    description:
      'Localiza los banners de una ficha de producto. Cada documento es un ' +
      'producto con su glosario. El flujo por imagen es: analizar cada panel, ' +
      'revisar y corregir las traducciones, aprobar, y exportar. Analizar y ' +
      'redibujar CUESTAN dinero (cuota de Vertex del tenant): no los repitas ' +
      'sin que te lo pidan.',
    tools: [
      { name: 'LISTAR_IMAGENES', description: 'Las imágenes del documento y en qué va cada una.',
        inputSchema: { type: 'object', properties: {} } },
      { name: 'SELECCIONAR_IMAGEN', description: 'Abre una imagen por su nombre o su id.',
        inputSchema: { type: 'object', properties: { imagen: { type: 'string' } }, required: ['imagen'] } },
      { name: 'ANALIZAR_PANEL', description: 'Detecta y traduce los textos de un panel. CUESTA una llamada al modelo.',
        inputSchema: { type: 'object', properties: { panel: { type: 'number', description: '1 = primero' } } } },
      { name: 'LEER_BLOQUES', description: 'Los bloques del panel activo, con su texto original y su traducción.',
        inputSchema: { type: 'object', properties: { panel: { type: 'number' } } } },
      { name: 'EDITAR_BLOQUE', description: 'Cambia la traducción de un bloque, o lo activa/desactiva. Gratis.',
        inputSchema: { type: 'object', properties: {
          bloqueId: { type: 'string' }, es: { type: 'string' },
          traducir: { type: 'boolean' }, alinear: { type: 'string', enum: ['left', 'center', 'right'] },
        }, required: ['bloqueId'] } },
      { name: 'APROBAR_PANEL', description: 'Da por bueno el panel y pasa al siguiente. Gratis.',
        inputSchema: { type: 'object', properties: { panel: { type: 'number' } } } },
      { name: 'EDITAR_GLOSARIO', description: 'Añade términos fijos o palabras que no se traducen. Es lo que hace que todos los banners usen los mismos términos.',
        inputSchema: { type: 'object', properties: {
          noTraducir: { type: 'array', items: { type: 'string' } },
          terminos: { type: 'object', description: '{ "handheld": "consola portátil" }' },
        } } },
      { name: 'EXPORTAR_IMAGEN', description: 'Compone y guarda la imagen final en español. Gratis (no llama al modelo).',
        inputSchema: { type: 'object', properties: { imagen: { type: 'string' } } } },
    ],
    getSnapshot: () => {
      const im = imagenActual();
      const panel = im && (im.paneles || [])[estado.panelActivo];
      return {
        producto: model.producto,
        idioma: model.idioma,
        glosario: model.glosario,
        gasto: { tokens: model.gastoTokens, llamadas: model.llamadas },
        imagenes: model.imagenes.map((i) => ({
          id: i.id, nombre: i.nombre, hecha: !!i.hecha,
          paneles: (i.paneles || []).length,
          aprobados: (i.paneles || []).filter((p) => p.aprobado).length,
        })),
        imagenActiva: im ? { id: im.id, nombre: im.nombre } : null,
        panelActivo: im ? estado.panelActivo + 1 : null,
        bloques: (panel && panel.bloques || []).map((b) => ({
          id: b.id, en: b.en, es: b.es, traducir: b.traducir !== false,
          rol: b.rol, aviso: (medidas.get(b.id) || {}).aviso || '',
        })),
      };
    },
    dispatchAction: async (accion) => {
      const p = accion.payload || {};
      const im = imagenActual();
      const buscarImagen = (ref) => {
        const s = String(ref || '').trim().toLowerCase();
        return model.imagenes.find((i) => i.id === s || i.nombre.toLowerCase() === s)
          || model.imagenes.find((i) => i.nombre.toLowerCase().includes(s));
      };
      const panelDe = (n) => {
        if (!im) return null;
        const paneles = im.paneles || [];
        const i = Number.isFinite(Number(n)) && Number(n) > 0
          ? Math.round(Number(n)) - 1 : estado.panelActivo;
        return paneles[limita(i, 0, paneles.length - 1)] || null;
      };

      try {
        switch (accion.type) {
          case 'LISTAR_IMAGENES':
            return { success: true, message: model.imagenes.length
              ? model.imagenes.map((i) => {
                  const ap = (i.paneles || []).filter((x) => x.aprobado).length;
                  return `${i.nombre}: ${ap}/${(i.paneles || []).length} paneles aprobados${i.hecha ? ' · exportada' : ''}`;
                }).join(' · ')
              : 'Todavía no hay imágenes cargadas.' };

          case 'SELECCIONAR_IMAGEN': {
            const encontrada = buscarImagen(p.imagen);
            if (!encontrada) return { success: false, error: `No encuentro la imagen "${p.imagen}".` };
            commit((m) => { m.seleccionada = encontrada.id; });
            estado.panelActivo = 0;
            return { success: true, message: `Abierta "${encontrada.nombre}" (${(encontrada.paneles || []).length} paneles).` };
          }

          case 'ANALIZAR_PANEL': {
            if (!im) return { success: false, error: 'No hay ninguna imagen abierta.' };
            const panel = panelDe(p.panel);
            if (!panel) return { success: false, error: 'Ese panel no existe.' };
            await accionAnalizar(im, panel);
            if (estado.error) return { success: false, error: estado.error };
            return { success: true, message: `Detectados ${panel.bloques.length} bloques de texto.` };
          }

          case 'LEER_BLOQUES': {
            const panel = panelDe(p.panel);
            if (!panel) return { success: false, error: 'No hay panel abierto.' };
            if (!panel.bloques.length) return { success: true, message: 'Ese panel aún no se ha analizado.' };
            return { success: true, message: panel.bloques.map((b) =>
              `[${b.id}] "${b.en}" → "${b.es}"${b.traducir === false ? ' (se deja igual)' : ''}`).join('\n') };
          }

          case 'EDITAR_BLOQUE': {
            let objetivo = null;
            for (const i of model.imagenes) {
              for (const pa of i.paneles || []) {
                const b = (pa.bloques || []).find((x) => x.id === p.bloqueId);
                if (b) { objetivo = b; break; }
              }
              if (objetivo) break;
            }
            if (!objetivo) return { success: false, error: `No existe el bloque "${p.bloqueId}".` };
            commit(() => {
              if (typeof p.es === 'string' && p.es.trim()) {
                objetivo.historial = [...(objetivo.historial || []), objetivo.es].slice(-6);
                objetivo.es = p.es.trim();
              }
              if (typeof p.traducir === 'boolean') objetivo.traducir = p.traducir;
              if (['left', 'center', 'right'].includes(p.alinear)) objetivo.alinear = p.alinear;
            });
            return { success: true, message: `Bloque actualizado: "${objetivo.es}".` };
          }

          case 'APROBAR_PANEL': {
            if (!im) return { success: false, error: 'No hay ninguna imagen abierta.' };
            const panel = panelDe(p.panel);
            if (!panel) return { success: false, error: 'Ese panel no existe.' };
            commit(() => { panel.aprobado = true; });
            const i = (im.paneles || []).indexOf(panel);
            estado.panelActivo = limita(i + 1, 0, (im.paneles || []).length - 1);
            repintar();
            const faltan = (im.paneles || []).filter((x) => !x.aprobado).length;
            return { success: true, message: faltan
              ? `Panel aprobado. Quedan ${faltan}.`
              : 'Panel aprobado. Ya están todos: se puede exportar.' };
          }

          case 'EDITAR_GLOSARIO': {
            commit((m) => {
              if (Array.isArray(p.noTraducir)) {
                const set = new Set([...(m.glosario.noTraducir || []), ...p.noTraducir.map(String)]);
                m.glosario.noTraducir = [...set];
              }
              if (p.terminos && typeof p.terminos === 'object' && !Array.isArray(p.terminos)) {
                for (const [k, v] of Object.entries(p.terminos)) {
                  if (k && typeof v === 'string') m.glosario.terminos[String(k)] = v;
                }
              }
            });
            return { success: true, message:
              `Glosario: ${(model.glosario.noTraducir || []).length} sin traducir, ` +
              `${Object.keys(model.glosario.terminos || {}).length} equivalencias. ` +
              'Se aplica en los PRÓXIMOS análisis: los paneles ya analizados hay que rehacerlos.' };
          }

          case 'EXPORTAR_IMAGEN': {
            const objetivo = p.imagen ? buscarImagen(p.imagen) : im;
            if (!objetivo) return { success: false, error: 'No encuentro esa imagen.' };
            const url = await exportar(objetivo);
            if (!url) return { success: false, error: estado.error || 'La exportación falló.' };
            return { success: true, message: `Exportada "${objetivo.nombre}-es.png".` };
          }

          default:
            return { success: false, error: `Acción desconocida: ${accion.type}` };
        }
      } catch (e) {
        return { success: false, error: String(e.message || e) };
      }
    },
  }) : null;

  // ══════════════════════════════════════════════════════════════════
  // La interfaz
  // ══════════════════════════════════════════════════════════════════

  const cls = (...xs) => xs.filter(Boolean).join(' ');

  function Boton({ onClick, children, variante, titulo, disabled, ancho }) {
    return h('button', {
      className: cls('bt-btn', variante && `bt-btn-${variante}`, ancho && 'bt-btn-ancho'),
      onClick, title: titulo, disabled,
    }, children);
  }

  /** El lienzo de revisión: el panel compuesto, con las cajas si se piden. */
  function Vista({ imagen, panel, version }) {
    const ref = React.useRef(null);
    const [cargando, setCargando] = React.useState(true);

    React.useEffect(() => {
      let vivo = true;
      setCargando(true);
      (async () => {
        try {
          const bitmap = await medirPanel(imagen, panel);
          if (!vivo) return;
          let compuesto;
          if (panel.usarIA && panel.urlIA && estado.vistaIA) {
            const ia = await cargarBitmap(panel.urlIA);
            compuesto = lienzo(bitmap.width, panel.y1 - panel.y0);
            compuesto.getContext('2d').drawImage(ia, 0, 0, compuesto.width, compuesto.height);
          } else {
            compuesto = componerPanel(bitmap, panel, medidasDe(panel));
            // Los parches de IA por bloque se pegan encima del overlay.
            const ctx = compuesto.getContext('2d');
            for (const b of panel.bloques || []) {
              if (!b.parcheIA || b.descartado) continue;
              const parche = await cargarBitmap(b.parcheIA.url);
              ctx.drawImage(parche, b.parcheIA.x, b.parcheIA.y - panel.y0, b.parcheIA.w, b.parcheIA.h);
            }
          }
          if (!vivo) return;

          if (estado.mostrarCajas) {
            const ctx = compuesto.getContext('2d');
            ctx.save();
            ctx.lineWidth = Math.max(2, compuesto.width / 500);
            for (const b of panel.bloques || []) {
              const m = medidas.get(b.id);
              if (!m) continue;
              ctx.strokeStyle = b.descartado ? '#94A3B8'
                : (b.traducir === false ? '#F59E0B' : (m.aviso ? '#EF4444' : '#22C55E'));
              ctx.strokeRect(m.ajustada[0], m.ajustada[1] - panel.y0,
                m.ajustada[2] - m.ajustada[0], m.ajustada[3] - m.ajustada[1]);
            }
            ctx.restore();
          }

          const destino = ref.current;
          if (!destino) return;
          destino.width = compuesto.width;
          destino.height = compuesto.height;
          destino.getContext('2d').drawImage(compuesto, 0, 0);
          setCargando(false);
        } catch (e) {
          if (vivo) { setCargando(false); estado.error = String(e.message || e); repintar(); }
        }
      })();
      return () => { vivo = false; };
    }, [imagen.id, panel.y0, panel.y1, version]);

    return h('div', { className: 'bt-vista' },
      cargando && h('div', { className: 'bt-vista-cargando' }, 'Componiendo…'),
      h('canvas', { ref, className: 'bt-lienzo' }),
    );
  }

  /** La ficha de edición de un bloque. */
  function FichaBloque({ imagen, bloque, medida, onCambio, onRehacer }) {
    const [abierto, setAbierto] = React.useState(false);
    const [instruccion, setInstruccion] = React.useState('');
    const aviso = medida && medida.aviso;
    const inactivo = bloque.descartado || bloque.traducir === false;

    const set = (patch) => { Object.assign(bloque, patch); onCambio(); };

    return h('div', { className: cls('bt-bloque', inactivo && 'bt-bloque-off', aviso && 'bt-bloque-aviso') },
      h('div', { className: 'bt-bloque-cab' },
        h('input', {
          type: 'checkbox', checked: bloque.traducir !== false,
          onChange: (e) => set({ traducir: e.target.checked }),
          title: 'Desactívalo para dejar este texto en el idioma original',
        }),
        h('span', { className: 'bt-bloque-en', title: bloque.en }, bloque.en || '(vacío)'),
        h('span', { className: 'bt-bloque-rol' }, bloque.rol),
        h('button', {
          className: 'bt-icono', title: abierto ? 'Cerrar ajustes' : 'Ajustes finos',
          onClick: () => setAbierto(!abierto),
        }, abierto ? '▾' : '▸'),
        h('button', {
          className: 'bt-icono', title: 'Descartar el bloque (el texto original queda intacto)',
          onClick: () => set({ descartado: !bloque.descartado }),
        }, bloque.descartado ? '↺' : '✕'),
      ),

      aviso && h('div', { className: 'bt-aviso' }, '⚠ ', aviso),

      h('textarea', {
        className: 'bt-texto', value: bloque.es, rows: 2,
        onChange: (e) => set({ es: e.target.value }),
        disabled: bloque.traducir === false,
      }),

      abierto && h('div', { className: 'bt-ajustes' },
        h('label', null, 'tam',
          h('input', {
            type: 'range', min: 0.6, max: 1.6, step: 0.02, value: bloque.escala || 1,
            onChange: (e) => set({ escala: Number(e.target.value) }),
          })),
        h('label', null, 'alin',
          h('select', {
            value: bloque.alinear || 'left',
            onChange: (e) => set({ alinear: e.target.value }),
          }, ['left', 'center', 'right'].map((v) =>
            h('option', { key: v, value: v }, { left: 'izq', center: 'centro', right: 'der' }[v])))),
        h('label', null, 'peso',
          h('select', {
            value: bloque.peso || 'regular',
            onChange: (e) => set({ peso: e.target.value }),
          }, Object.keys(PESOS).map((v) => h('option', { key: v, value: v }, v)))),
        h('label', null, 'color',
          h('input', {
            type: 'color', value: bloque.colorForzado || (medida && medida.color) || '#FFFFFF',
            onChange: (e) => set({ colorForzado: e.target.value }),
          }),
          bloque.colorForzado && h('button', {
            className: 'bt-icono', title: 'Volver al color medido en la imagen',
            onClick: () => set({ colorForzado: '' }),
          }, '↺')),
        h('label', null, 'fondo',
          h('select', {
            value: bloque.fondoForzado || '',
            onChange: (e) => set({ fondoForzado: e.target.value }),
            title: 'Cómo se borra el texto original. Si queda un fantasma, prueba otro.',
          },
            h('option', { value: '' }, `auto (${medida ? medida.modoFondo : '—'})`),
            h('option', { value: 'flat' }, 'plano'),
            h('option', { value: 'vgradient' }, 'degradado'),
            h('option', { value: 'photo' }, 'foto'))),
        h('label', null, 'mover x',
          h('input', {
            type: 'number', value: bloque.dx || 0, step: 2,
            onChange: (e) => set({ dx: Number(e.target.value) || 0 }),
          })),
        h('label', null, 'mover y',
          h('input', {
            type: 'number', value: bloque.dy || 0, step: 2,
            onChange: (e) => set({ dy: Number(e.target.value) || 0 }),
          })),
        h('label', null, 'ancho +',
          h('input', {
            type: 'number', value: bloque.anchoExtra || 0, step: 10,
            onChange: (e) => set({ anchoExtra: Number(e.target.value) || 0 }),
          })),

        h('div', { className: 'bt-ajustes-acciones' },
          h('input', {
            className: 'bt-instruccion', placeholder: 'Reescribir: «más corto», «más formal»…',
            value: instruccion, onChange: (e) => setInstruccion(e.target.value),
          }),
          h(Boton, {
            onClick: () => { if (instruccion.trim()) { accionReescribir(imagen, bloque, instruccion.trim(), 0); setInstruccion(''); } },
            disabled: !!estado.ocupado || !instruccion.trim(),
            titulo: 'Pide al modelo otra versión del texto. Cuesta una llamada.',
          }, 'Reescribir'),
          h(Boton, {
            onClick: () => accionReescribir(imagen, bloque, 'acórtalo todo lo que puedas sin perder el sentido',
              Math.max(8, Math.round((bloque.en || '').length * 1.05))),
            disabled: !!estado.ocupado,
            titulo: 'Una versión más corta, con tope de caracteres. Cuesta una llamada.',
          }, 'Acortar'),
          h(Boton, {
            onClick: () => onRehacer(bloque),
            disabled: !!estado.ocupado,
            titulo: 'Vuelve a medir color y caja sobre los píxeles. Gratis.',
          }, 'Remedir'),
          h(Boton, {
            onClick: () => accionRedibujarBloque(imagen, bloque),
            disabled: !!estado.ocupado,
            variante: 'ia',
            titulo: 'Manda este recorte al modelo de imagen. Cuesta una llamada.',
          }, '✨ Redibujar'),
          bloque.parcheIA && h(Boton, {
            onClick: () => { bloque.parcheIA = null; onCambio(); },
            titulo: 'Descarta el parche generado y vuelve al overlay',
          }, '✕ IA'),
        ),

        (bloque.historial || []).length > 0 && h('div', { className: 'bt-historial' },
          h('span', null, 'Antes: '),
          bloque.historial.slice().reverse().slice(0, 3).map((v, i) =>
            h('button', {
              key: i, className: 'bt-hist-item', title: 'Recuperar esta versión (gratis)',
              onClick: () => set({
                historial: [...(bloque.historial || []), bloque.es].slice(-6),
                es: v,
              }),
            }, v.length > 40 ? v.slice(0, 40) + '…' : v)),
        ),
      ),
    );
  }

  function ModalGlosario({ onCerrar }) {
    const g = model.glosario || nuevoGlosario();
    const [noTr, setNoTr] = React.useState((g.noTraducir || []).join('\n'));
    const [term, setTerm] = React.useState(
      Object.entries(g.terminos || {}).map(([k, v]) => `${k} = ${v}`).join('\n'));

    const guardarGlosario = () => {
      const lista = noTr.split('\n').map((s) => s.trim()).filter(Boolean);
      const mapa = {};
      for (const linea of term.split('\n')) {
        const i = linea.indexOf('=');
        if (i < 1) continue;
        const k = linea.slice(0, i).trim();
        const v = linea.slice(i + 1).trim();
        if (k && v) mapa[k] = v;
      }
      commit((m) => { m.glosario = { noTraducir: lista, terminos: mapa }; });
      onCerrar();
      shell.notify({ level: 'info', text: 'Glosario guardado. Se aplica en los próximos análisis.' });
    };

    return h('div', { className: 'bt-modal-fondo', onClick: onCerrar },
      h('div', { className: 'bt-modal', onClick: (e) => e.stopPropagation() },
        h('h3', null, 'Glosario del producto'),
        h('p', { className: 'bt-nota' },
          'Se aplica en CADA análisis y en cada reescritura: es lo que hace que ' +
          'todos los banners usen los mismos términos. Si cambias algo a mitad ' +
          'de camino, hay que volver a analizar los paneles afectados.'),
        h('label', { className: 'bt-campo' }, 'No traducir (uno por línea)',
          h('textarea', { rows: 6, value: noTr, onChange: (e) => setNoTr(e.target.value),
            placeholder: 'ONEXPLAYER\nIntel Arc\nAMOLED\nWh' })),
        h('label', { className: 'bt-campo' }, 'Equivalencias fijas (término = traducción)',
          h('textarea', { rows: 8, value: term, onChange: (e) => setTerm(e.target.value),
            placeholder: 'handheld = consola portátil\nbattery life = autonomía' })),
        h('div', { className: 'bt-modal-pie' },
          h(Boton, { onClick: onCerrar }, 'Cancelar'),
          h(Boton, { onClick: guardarGlosario, variante: 'principal' }, 'Guardar'),
        ),
      ));
  }

  function ModalAjustes({ onCerrar }) {
    const [prod, setProd] = React.useState(model.producto);
    const [idioma, setIdioma] = React.useState(model.idioma);
    const [tono, setTono] = React.useState(model.tono);
    const [alto, setAlto] = React.useState(model.altoPanel);
    const [modelos, setModelos] = React.useState(null);
    const [mv, setMv] = React.useState(model.modeloVision);
    const [mi, setMi] = React.useState(model.modeloImagen);

    React.useEffect(() => {
      if (!hayIA() || !shell.ai.models) return;
      shell.ai.models().then(setModelos).catch(() => {});
    }, []);

    return h('div', { className: 'bt-modal-fondo', onClick: onCerrar },
      h('div', { className: 'bt-modal', onClick: (e) => e.stopPropagation() },
        h('h3', null, 'Ajustes del documento'),
        h('label', { className: 'bt-campo' }, 'Producto',
          h('input', { value: prod, onChange: (e) => setProd(e.target.value),
            placeholder: 'ONEXPLAYER 3 · Consola portátil' })),
        h('label', { className: 'bt-campo' }, 'Idioma de destino',
          h('input', { value: idioma, onChange: (e) => setIdioma(e.target.value) })),
        h('label', { className: 'bt-campo' }, 'Tono',
          h('input', { value: tono, onChange: (e) => setTono(e.target.value) })),
        h('label', { className: 'bt-campo' }, `Alto objetivo de panel (${alto} px)`,
          h('input', { type: 'range', min: 700, max: 2400, step: 50, value: alto,
            onChange: (e) => setAlto(Number(e.target.value)) }),
          h('span', { className: 'bt-nota' },
            'Cambiarlo vuelve a cortar los paneles de la imagen abierta y pierde ' +
            'su trabajo: las cajas estaban referidas a los cortes anteriores.')),

        modelos && h('div', null,
          h('label', { className: 'bt-campo' }, 'Modelo de visión (detectar y traducir)',
            h('select', { value: mv, onChange: (e) => setMv(e.target.value) },
              h('option', { value: '' }, `por defecto (${modelos.defaults.vision})`),
              modelos.vision.map((m) => h('option', { key: m, value: m }, m)))),
          h('label', { className: 'bt-campo' }, 'Modelo de imagen (redibujar)',
            h('select', { value: mi, onChange: (e) => setMi(e.target.value) },
              h('option', { value: '' }, `por defecto (${modelos.defaults.image})`),
              modelos.image.map((m) => h('option', { key: m, value: m }, m))),
            h('span', { className: 'bt-nota' },
              'El «pro» reproduce mejor la tipografía pequeña; el «flash» va cuatro ' +
              'veces más rápido y cuesta una fracción.')),
        ),

        h('div', { className: 'bt-modal-pie' },
          h(Boton, { onClick: onCerrar }, 'Cancelar'),
          h(Boton, {
            variante: 'principal',
            onClick: () => {
              const cambioAlto = alto !== model.altoPanel;
              commit((m) => {
                m.producto = prod; m.idioma = idioma; m.tono = tono;
                m.modeloVision = mv; m.modeloImagen = mi;
              });
              const im = imagenActual();
              if (cambioAlto && im) recortarPaneles(im, alto);
              else if (cambioAlto) commit((m) => { m.altoPanel = alto; });
              onCerrar();
            },
          }, 'Guardar'),
        ),
      ));
  }

  function App() {
    const [, forzar] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => {
      const l = () => forzar();
      listeners.add(l);
      return () => listeners.delete(l);
    }, []);

    const [glosarioAbierto, setGlosarioAbierto] = React.useState(false);
    const [ajustesAbiertos, setAjustesAbiertos] = React.useState(false);
    const [version, setVersion] = React.useState(0);
    const refrescar = () => { setVersion((v) => v + 1); guardar(); };
    const entrada = React.useRef(null);

    const imagen = imagenActual();
    const paneles = (imagen && imagen.paneles) || [];
    const panel = paneles[limita(estado.panelActivo, 0, Math.max(0, paneles.length - 1))] || null;

    // Atajos: el trabajo es repetitivo y son quince imágenes por producto.
    React.useEffect(() => {
      const alTeclear = (e) => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || estado.ocupado) return;
        if (e.key === 'a' && imagen && panel) { e.preventDefault(); accionAnalizar(imagen, panel); }
        else if (e.key === 'Enter' && panel) { e.preventDefault(); commit(() => { panel.aprobado = true; }); irA(estado.panelActivo + 1); }
        else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); irA(estado.panelActivo + 1); }
        else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); irA(estado.panelActivo - 1); }
        else if (e.key === 'b') { e.preventDefault(); estado.mostrarCajas = !estado.mostrarCajas; setVersion((v) => v + 1); }
      };
      window.addEventListener('keydown', alTeclear);
      return () => window.removeEventListener('keydown', alTeclear);
    });

    const irA = (i) => {
      if (!paneles.length) return;
      estado.panelActivo = limita(i, 0, paneles.length - 1);
      estado.vistaIA = false;
      repintar();
    };

    const sinIA = !hayIA();
    const aprobados = paneles.filter((p) => p.aprobado).length;

    return h('div', { className: 'kimos-banners-translator' },

      // ── Cabecera ──────────────────────────────────────────────────
      h('header', { className: 'bt-cab' },
        h('div', { className: 'bt-cab-izq' },
          h('span', { className: 'bt-titulo' }, '🈯 Traductor de Banners'),
          h('span', { className: 'bt-ver' }, 'v' + APP_VERSION),
          model.producto && h('span', { className: 'bt-producto' }, model.producto),
        ),
        h('div', { className: 'bt-cab-centro' },
          imagen && h(React.Fragment, null,
            h('span', { className: 'bt-progreso' }, `Panel ${estado.panelActivo + 1}/${paneles.length}`),
            h('span', { className: 'bt-progreso bt-suave' }, `${aprobados} aprobados`),
          ),
        ),
        h('div', { className: 'bt-cab-der' },
          model.llamadas > 0 && h('span', {
            className: 'bt-gasto',
            title: 'Tokens de Vertex consumidos en este documento. Cada análisis y cada redibujado gastan cuota del proyecto de la empresa.',
          }, `${model.llamadas} llamadas · ${model.gastoTokens.toLocaleString('es-CL')} tokens`),
          h(Boton, { onClick: () => setGlosarioAbierto(true), titulo: 'Términos fijos del producto' }, 'Glosario'),
          h(Boton, { onClick: () => setAjustesAbiertos(true), titulo: 'Producto, idioma, tono y modelos' }, 'Ajustes'),
        ),
      ),

      sinIA && h('div', { className: 'bt-alerta' },
        'Esta instalación de KIMOS no le ofrece imagen generativa a las apps. ',
        'Revisa que la app tenga concedido el permiso ',
        h('code', null, 'ai.image'), ' (se aprueba al instalar; si se instaló antes de que ',
        'este KIMOS lo conociera, hay que actualizarla desde la Tienda).'),

      estado.error && h('div', { className: 'bt-alerta bt-alerta-error' }, estado.error),

      h('div', { className: 'bt-cuerpo' },

        // ── Columna izquierda: las imágenes ───────────────────────────
        h('aside', { className: 'bt-imagenes' },
          h('div', { className: 'bt-imagenes-cab' },
            h('span', null, `Imágenes (${model.imagenes.length})`),
            h('button', {
              className: 'bt-icono', title: 'Añadir imágenes',
              onClick: () => entrada.current && entrada.current.click(),
            }, '+'),
          ),
          h('input', {
            ref: entrada, type: 'file', accept: 'image/*', multiple: true,
            style: { display: 'none' },
            onChange: (e) => { agregarImagenes([...e.target.files]); e.target.value = ''; },
          }),
          h('div', { className: 'bt-imagenes-lista' },
            model.imagenes.length === 0 && h('p', { className: 'bt-vacio' },
              'Sube los banners del producto. Se cortan en paneles automáticamente, ' +
              'buscando el corte en franjas de fondo limpio para no partir un texto.'),
            model.imagenes.map((im) => {
              const ap = (im.paneles || []).filter((p) => p.aprobado).length;
              const tot = (im.paneles || []).length;
              return h('button', {
                key: im.id,
                className: cls('bt-imagen', im.id === model.seleccionada && 'bt-imagen-activa'),
                onClick: () => { commit((m) => { m.seleccionada = im.id; }); estado.panelActivo = 0; estado.vistaIA = false; },
              },
                h('img', { src: im.url, alt: '', className: 'bt-miniatura', loading: 'lazy' }),
                h('div', { className: 'bt-imagen-info' },
                  h('span', { className: 'bt-imagen-nombre' }, im.nombre),
                  h('span', { className: 'bt-imagen-meta' },
                    im.hecha ? '✓ exportada' : (tot ? `${ap}/${tot} paneles` : '—')),
                ),
              );
            }),
          ),
          imagen && h('div', { className: 'bt-imagenes-pie' },
            h(Boton, {
              ancho: true, variante: 'principal',
              onClick: () => exportar(imagen),
              disabled: !!estado.ocupado || !paneles.some((p) => (p.bloques || []).length || p.usarIA),
              titulo: 'Compone la imagen completa en español. No llama al modelo: es gratis.',
            }, '⤓ Exportar imagen final'),
            imagen.urlFinal && h('a', {
              className: 'bt-enlace', href: imagen.urlFinal, target: '_blank', rel: 'noreferrer',
            }, 'Ver la última exportada'),
          ),
        ),

        // ── Centro: el panel ──────────────────────────────────────────
        h('main', { className: 'bt-centro' },
          !imagen && h('div', { className: 'bt-vacio-centro' },
            h('p', null, 'Sube una imagen para empezar.'),
            h('p', { className: 'bt-nota' },
              'Esta app no regenera la imagen: la edita. Todo lo que está fuera ' +
              'de las cajas de texto queda idéntico al original, así que los ' +
              'renders del producto no se tocan.'),
          ),
          imagen && panel && h(React.Fragment, null,
            h('div', { className: 'bt-barra' },
              h(Boton, { onClick: () => irA(estado.panelActivo - 1), disabled: estado.panelActivo === 0, titulo: '↑ / k' }, '↑'),
              h(Boton, { onClick: () => irA(estado.panelActivo + 1), disabled: estado.panelActivo >= paneles.length - 1, titulo: '↓ / j' }, '↓'),
              h(Boton, {
                onClick: () => accionAnalizar(imagen, panel),
                disabled: !!estado.ocupado || sinIA, variante: 'principal', titulo: 'Detecta y traduce los textos. Cuesta 1 llamada. (a)',
              }, panel.analizado ? 'Reanalizar panel' : 'Analizar panel'),
              h(Boton, {
                onClick: () => { commit(() => { panel.aprobado = true; }); irA(estado.panelActivo + 1); },
                disabled: !panel.analizado, titulo: 'Da por bueno el panel y pasa al siguiente. (Enter)',
              }, panel.aprobado ? '✓ Aprobado' : 'Aprobar panel ✓'),
              h('span', { className: 'bt-sep' }),
              h(Boton, {
                onClick: () => { estado.mostrarCajas = !estado.mostrarCajas; setVersion((v) => v + 1); },
                titulo: 'Mostrar las cajas detectadas. (b)',
              }, estado.mostrarCajas ? '▣ Cajas' : '▢ Cajas'),
              h(Boton, {
                onClick: () => accionRedibujarPanel(imagen, panel),
                disabled: !!estado.ocupado || sinIA || !panel.analizado, variante: 'ia',
                titulo: 'Manda el panel entero al modelo de imagen. 1 llamada, pero resintetiza TODA la imagen: el producto se redibuja.',
              }, '✨ Generar panel con IA'),
              panel.urlIA && h('div', { className: 'bt-selector-ia' },
                h('button', {
                  className: cls('bt-pestana', !estado.vistaIA && 'bt-pestana-activa'),
                  onClick: () => { estado.vistaIA = false; commit(() => { panel.usarIA = false; }); },
                }, 'overlay'),
                h('button', {
                  className: cls('bt-pestana', estado.vistaIA && 'bt-pestana-activa'),
                  onClick: () => { estado.vistaIA = true; commit(() => { panel.usarIA = true; }); },
                }, 'IA'),
                h('button', {
                  className: 'bt-icono', title: 'Descartar la versión generada',
                  onClick: () => { estado.vistaIA = false; commit(() => { panel.urlIA = ''; panel.usarIA = false; }); },
                }, '✕'),
              ),
            ),
            estado.ocupado && h('div', { className: 'bt-ocupado' }, estado.ocupado),
            h(Vista, { imagen, panel, version: version + (estado.vistaIA ? 1e6 : 0) }),
          ),
        ),

        // ── Columna derecha: los bloques ──────────────────────────────
        h('aside', { className: 'bt-bloques' },
          h('div', { className: 'bt-bloques-cab' },
            h('span', null, `Textos (${panel ? (panel.bloques || []).length : 0})`),
            panel && panel.analizado && h('button', {
              className: 'bt-icono', title: 'Añadir a mano un bloque que el modelo no detectó',
              onClick: () => {
                const w = imagen.ancho;
                commit(() => {
                  panel.bloques.push({
                    id: `b${Date.now().toString(36)}m`,
                    caja: [Math.round(w * 0.2), panel.y0 + 40, Math.round(w * 0.8), panel.y0 + 120],
                    en: '', es: '', rol: 'body', peso: 'regular', alinear: 'left',
                    traducir: true, nota: '', escala: 1, dx: 0, dy: 0, anchoExtra: 0,
                    colorForzado: '', fondoForzado: '', descartado: false, historial: [],
                  });
                });
                refrescar();
              },
            }, '+'),
          ),
          h('div', { className: 'bt-bloques-lista' },
            (!panel || !(panel.bloques || []).length) && h('p', { className: 'bt-vacio' },
              panel && panel.analizado
                ? 'El modelo no encontró texto en este panel.'
                : 'Analiza el panel para detectar y traducir sus textos.'),
            panel && (panel.bloques || []).map((b) =>
              h(FichaBloque, {
                key: b.id, imagen, bloque: b, medida: medidas.get(b.id),
                onCambio: refrescar,
                onRehacer: async (bl) => { await remedir(imagen, bl); refrescar(); },
              })),
          ),
        ),
      ),

      glosarioAbierto && h(ModalGlosario, { onCerrar: () => setGlosarioAbierto(false) }),
      ajustesAbiertos && h(ModalAjustes, { onCerrar: () => setAjustesAbiertos(false) }),
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // Arranque
  // ══════════════════════════════════════════════════════════════════

  shell.loadData().then((guardado) => {
    if (!guardado || typeof guardado !== 'object') return;
    commit((m) => {
      Object.assign(m, {
        ...m,
        ...guardado,
        glosario: { ...nuevoGlosario(), ...(guardado.glosario || {}) },
        imagenes: Array.isArray(guardado.imagenes) ? guardado.imagenes : [],
      });
    });
  }).catch(() => {});

  if (shell.window && shell.window.setTitle) {
    shell.window.setTitle('Traductor de Banners');
  }

  // El menú 🗂️ Documentos del host guarda y restaura versiones sin que la
  // app haga nada más que decir qué es «su estado».
  if (shell.documents) {
    shell.documents.onSerialize(() => serializar());
    shell.documents.onLoad((cfg) => {
      if (!cfg || typeof cfg !== 'object') return;
      medidas.clear();
      commit((m) => Object.assign(m, modeloInicial(), cfg));
      estado.panelActivo = 0;
    });
  }

  return {
    Component: App,
    unmount() {
      clearTimeout(guardadoPendiente);
      listeners.clear();
      bitmaps.clear();
      medidas.clear();
      if (desregistrar) desregistrar();
    },
  };
}
