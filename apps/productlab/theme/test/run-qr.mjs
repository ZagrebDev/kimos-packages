/**
 * El generador de QR se valida DECODIFICANDO lo que produce con un lector
 * independiente (jsQR). Es la única comprobación que vale: un QR mal formado
 * se ve perfectamente normal y solo falla cuando un cliente lo apunta con el
 * móvil, que es justo cuando ya no lo puedes arreglar.
 *
 *   npm i && node theme/test/run-qr.mjs
 */
import { createRequire } from 'node:module';
import { qrMatrix } from '../../engine-src/qr.js';

const require = createRequire(import.meta.url);
let jsQR;
try { jsQR = require('jsqr').default || require('jsqr'); }
catch (e) {
  console.error('Falta jsqr (solo para pruebas). Ejecuta: npm install');
  process.exit(1);
}

// El QR se pinta con un módulo = `escala` píxeles, en RGBA para jsQR. El
// margen blanco de 4 módulos NO es decorativo: la norma lo exige y los
// lectores no encuentran el código sin él. Quien lo pinte en pantalla tiene
// que dejarlo también.
const QUIETO = 4;
function aImagen(m, escala) {
  const n = m.length + QUIETO * 2;
  const lado = n * escala;
  const datos = new Uint8ClampedArray(lado * lado * 4);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const my = Math.floor(y / escala) - QUIETO;
      const mx = Math.floor(x / escala) - QUIETO;
      const dentro = my >= 0 && mx >= 0 && my < m.length && mx < m.length;
      const v = dentro && m[my][mx] ? 0 : 255;
      const i = (y * lado + x) * 4;
      datos[i] = datos[i + 1] = datos[i + 2] = v;
      datos[i + 3] = 255;
    }
  }
  return { datos, lado };
}

const fallos = [];
const probar = (nombre, texto) => {
  const m = qrMatrix(texto);
  if (!m) { console.log('✘ ' + nombre + ' · no cabe'); fallos.push(nombre); return; }
  const { datos, lado } = aImagen(m, 4);
  const leido = jsQR(datos, lado, lado);
  const ok = leido && leido.data === texto;
  console.log((ok ? '✔ ' : '✘ ') + nombre + ' · ' + m.length + '×' + m.length
    + ' módulos · leído: ' + (leido ? JSON.stringify(leido.data.slice(0, 46)) : 'ILEGIBLE'));
  if (!ok) fallos.push(nombre);
};

// Casos que importan de verdad: URLs de producto reales, con acentos y con el
// parámetro que lleva directo a la experiencia de AR.
probar('URL corta', 'https://bosquenegro.com/piso-hanoi');
probar('URL de producto real',
  'https://bosquenegro.com/piso-hanoi-taburete-de-madera-carbonizada-yakisugi-%E5%BA%8A-copia?kimos_ar=1');
probar('con acentos y ñ', 'https://tienda.cl/sillón-roble-añejo?kimos_ar=1');
probar('un solo carácter', 'x');
probar('límite largo (200 caracteres)', 'https://t.cl/' + 'a'.repeat(187));

// Y que avise en vez de devolver basura cuando no cabe.
const excesivo = qrMatrix('x'.repeat(400));
console.log((excesivo === null ? '✔ ' : '✘ ') + 'texto demasiado largo → null (no un QR ilegible)');
if (excesivo !== null) fallos.push('límite');

if (fallos.length) { console.error('\n✘ ' + fallos.length + ' fallo(s): ' + fallos.join(', ')); process.exit(1); }
console.log('\nQR OK ✔ — todos los códigos se decodifican y devuelven el texto exacto');
