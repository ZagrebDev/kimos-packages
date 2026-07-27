/**
 * Generador de códigos QR — mínimo y sin dependencias.
 *
 * Existe por una razón concreta: en el escritorio no hay cámara, así que la
 * única forma de llevar al cliente a la realidad aumentada es que escanee un
 * código con el móvil. Y no se puede tirar de un servicio externo ni de un CDN
 * porque el theme de la tienda tiene que funcionar con lo que ya carga.
 *
 * Alcance deliberadamente corto: modo BYTE, corrección de errores nivel L y
 * versiones 1 a 10 (hasta 271 caracteres). Da de sobra para una URL de
 * producto, que es lo único que va a codificar.
 *
 * Los bits de formato y de versión NO salen de tablas copiadas: se calculan
 * con su BCH, que es más corto y no se puede transcribir mal.
 */

// ── GF(256) con el polinomio primitivo de QR (0x11D) ───────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Polinomio generador de Reed-Solomon para `grado` codewords de corrección. */
function rsGenerator(grado) {
  let poly = [1];
  for (let i = 0; i < grado; i++) {
    const next = new Array(poly.length + 1).fill(0);
    // El polinomio va de mayor a menor grado: multiplicar por (x + α^i) sube
    // un grado cada coeficiente (next[j]) y añade su producto por α^i en el
    // siguiente (next[j+1]). Al revés sale el polinomio invertido, y la
    // corrección resultante es basura que ningún lector acepta.
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(datos, grado) {
  const gen = rsGenerator(grado);
  const res = new Array(datos.length + grado).fill(0);
  for (let i = 0; i < datos.length; i++) res[i] = datos[i];
  for (let i = 0; i < datos.length; i++) {
    const coef = res[i];
    if (!coef) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], coef);
  }
  return res.slice(datos.length);
}

// ── Tablas de estructura, nivel L ──────────────────────────────────────────
// [codewords de corrección por bloque, bloques grupo 1, datos por bloque G1,
//  bloques grupo 2, datos por bloque G2]
const BLOQUES_L = {
  1: [7, 1, 19, 0, 0],
  2: [10, 1, 34, 0, 0],
  3: [15, 1, 55, 0, 0],
  4: [20, 1, 80, 0, 0],
  5: [26, 1, 108, 0, 0],
  6: [18, 2, 68, 0, 0],
  7: [20, 2, 78, 0, 0],
  8: [24, 2, 97, 0, 0],
  9: [30, 2, 116, 0, 0],
  10: [18, 2, 68, 2, 69],
};
// Centros de los patrones de alineación por versión.
const ALINEACION = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const datosDeVersion = (v) => {
  const [, b1, d1, b2, d2] = BLOQUES_L[v];
  return b1 * d1 + b2 * d2;
};

/** Versión más pequeña donde caben `bytes` en modo byte, nivel L. */
function elegirVersion(bytes) {
  for (let v = 1; v <= 10; v++) {
    const cabecera = 4 + (v <= 9 ? 8 : 16);       // modo + contador
    if (datosDeVersion(v) * 8 >= cabecera + bytes * 8) return v;
  }
  return 0; // no cabe: quien llama decide qué hacer
}

// ── Codificación de los datos ──────────────────────────────────────────────
function codificar(bytes, version) {
  const bits = [];
  const push = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1); };
  push(0b0100, 4);                                  // modo byte
  push(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));

  const capacidad = datosDeVersion(version) * 8;
  push(0, Math.min(4, capacidad - bits.length));    // terminador
  while (bits.length % 8) bits.push(0);             // a byte completo

  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  // Relleno alterno hasta llenar la capacidad.
  const relleno = [0xec, 0x11];
  for (let i = 0; cw.length < datosDeVersion(version); i++) cw.push(relleno[i % 2]);
  return cw;
}

/** Reparte en bloques, calcula su corrección e intercala como manda la norma. */
function conCorreccion(cw, version) {
  const [ec, b1, d1, b2, d2] = BLOQUES_L[version];
  const bloques = [];
  let p = 0;
  for (let i = 0; i < b1; i++) { bloques.push(cw.slice(p, p + d1)); p += d1; }
  for (let i = 0; i < b2; i++) { bloques.push(cw.slice(p, p + d2)); p += d2; }
  const correcciones = bloques.map((b) => rsRemainder(b, ec));

  const out = [];
  const maxDatos = Math.max(d1, d2);
  for (let i = 0; i < maxDatos; i++) {
    bloques.forEach((b) => { if (i < b.length) out.push(b[i]); });
  }
  for (let i = 0; i < ec; i++) correcciones.forEach((c) => out.push(c[i]));
  return out;
}

// ── Matriz ─────────────────────────────────────────────────────────────────
function nuevaMatriz(n) {
  const m = [];
  for (let i = 0; i < n; i++) m.push(new Array(n).fill(null)); // null = libre
  return m;
}

function ponerPatrones(m, version) {
  const n = m.length;
  const buscador = (fx, fy) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const px = fx + x, py = fy + y;
        if (px < 0 || py < 0 || px >= n || py >= n) continue;
        const borde = x === -1 || x === 7 || y === -1 || y === 7;
        const anillo = (x === 0 || x === 6) && y >= 0 && y <= 6;
        const lado = (y === 0 || y === 6) && x >= 0 && x <= 6;
        const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[py][px] = borde ? 0 : (anillo || lado || centro) ? 1 : 0;
      }
    }
  };
  buscador(0, 0); buscador(n - 7, 0); buscador(0, n - 7);

  // Patrones de sincronización.
  for (let i = 8; i < n - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    if (m[6][i] === null) m[6][i] = v;
    if (m[i][6] === null) m[i][6] = v;
  }

  // Alineación (no encima de los buscadores).
  const centros = ALINEACION[version];
  centros.forEach((cy) => centros.forEach((cx) => {
    const enBuscador = (cx <= 8 && cy <= 8) || (cx >= n - 9 && cy <= 8) || (cx <= 8 && cy >= n - 9);
    if (enBuscador) return;
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        m[cy + y][cx + x] = (Math.abs(x) === 2 || Math.abs(y) === 2 || (x === 0 && y === 0)) ? 1 : 0;
      }
    }
  }));

  m[n - 8][8] = 1; // módulo oscuro, siempre

  // Zonas reservadas para el formato (se rellenan luego).
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][n - 1 - i] === null) m[8][n - 1 - i] = 0;
    if (m[n - 1 - i][8] === null) m[n - 1 - i][8] = 0;
  }
  // Y para la versión, a partir de la 7.
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) { m[n - 11 + j][i] = 0; m[i][n - 11 + j] = 0; }
    }
  }
}

/** BCH(15,5) del formato y BCH(18,6) de la versión: más corto que la tabla. */
function bch(valor, generador, bits) {
  let d = valor << (bits - 1);
  const gradoGen = generador.toString(2).length - 1;
  while (d.toString(2).length - 1 >= gradoGen) {
    d ^= generador << (d.toString(2).length - 1 - gradoGen);
  }
  return d;
}

function ponerFormato(m, mascara) {
  const n = m.length;
  const datos = (0b01 << 3) | mascara;            // 01 = nivel L
  const bits = ((datos << 10) | bch(datos, 0b10100110111, 11)) ^ 0b101010000010010;
  const leer = (i) => (bits >> (14 - i)) & 1;

  for (let i = 0; i <= 5; i++) m[8][i] = leer(i);
  m[8][7] = leer(6);
  m[8][8] = leer(7);
  m[7][8] = leer(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = leer(i);

  // Segunda copia: SIETE módulos en la columna 8 (abajo) y OCHO en la fila 8
  // (derecha). Repartirlo 8/7 pisa el módulo oscuro de (n-8, 8), que no forma
  // parte del formato y es obligatorio — y el código entero deja de leerse.
  for (let i = 0; i <= 6; i++) m[n - 1 - i][8] = leer(i);
  for (let i = 7; i <= 14; i++) m[8][n - 15 + i] = leer(i);
}

function ponerVersion(m, version) {
  if (version < 7) return;
  const n = m.length;
  const bits = (version << 12) | bch(version, 0b1111100100101, 13);
  for (let i = 0; i < 18; i++) {
    const b = (bits >> i) & 1;
    m[Math.floor(i / 3)][n - 11 + (i % 3)] = b;
    m[n - 11 + (i % 3)][Math.floor(i / 3)] = b;
  }
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function ponerDatos(m, libres, cw, mascara) {
  const n = m.length;
  let bit = 0;
  const total = cw.length * 8;
  let subir = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;                       // la columna 6 es de sincronía
    for (let k = 0; k < n; k++) {
      const y = subir ? n - 1 - k : k;
      for (let d = 0; d < 2; d++) {
        const x = col - d;
        if (!libres[y][x]) continue;
        let v = 0;
        if (bit < total) v = (cw[bit >> 3] >> (7 - (bit & 7))) & 1;
        bit++;
        m[y][x] = MASCARAS[mascara](x, y) ? v ^ 1 : v;
      }
    }
    subir = !subir;
  }
}

/** Penalizaciones de la norma: se elige la máscara que menos suma. */
function penalizacion(m) {
  const n = m.length;
  let p = 0;
  const linea = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        if (get(a, b) === get(a, b - 1)) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
  };
  linea((y, x) => m[y][x]);
  linea((x, y) => m[y][x]);
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) p += 3;
    }
  }
  let oscuros = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) oscuros += m[y][x];
  const pct = (oscuros * 100) / (n * n);
  p += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return p;
}

/**
 * Matriz del QR para `texto`: array de filas con 1 (oscuro) y 0 (claro).
 * Devuelve null si el texto no cabe (más de 271 bytes).
 */
export function qrMatrix(texto) {
  const bytes = Array.from(new TextEncoder().encode(String(texto)));
  const version = elegirVersion(bytes.length);
  if (!version) return null;
  const n = version * 4 + 17;
  const cw = conCorreccion(codificar(bytes, version), version);

  // Qué celdas quedan libres para datos: se calcula una vez con los patrones.
  const plantilla = nuevaMatriz(n);
  ponerPatrones(plantilla, version);
  const libres = plantilla.map((fila) => fila.map((v) => v === null));

  let mejor = null, mejorP = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    const m = plantilla.map((f) => f.slice());
    ponerDatos(m, libres, cw, mascara);
    ponerFormato(m, mascara);
    ponerVersion(m, version);
    const p = penalizacion(m);
    if (p < mejorP) { mejorP = p; mejor = m; }
  }
  return mejor;
}
