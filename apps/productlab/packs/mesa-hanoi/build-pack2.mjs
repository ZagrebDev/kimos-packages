/**
 * Genera un GLB con DOS unidades del modelo, cada una con sus propios
 * materiales, a partir de un GLB de una sola unidad.
 *
 * Por qué existe: en la app, cada PARTE se identifica por los nombres de
 * material del archivo. Si un pack de 2 unidades usa el mismo modelo repetido,
 * ambas comparten materiales y elegir el acabado de la unidad 2 repintaría
 * también la 1. Con materiales propios por unidad, cada paso del configurador
 * controla su unidad.
 *
 * No duplica la geometría: las mallas nuevas apuntan a los MISMOS accessors,
 * así que el archivo crece unos cientos de bytes de JSON y no al doble. Por lo
 * mismo respeta EXT_meshopt_compression sin tener que descomprimir nada.
 *
 * Uso:
 *   node build-pack2.mjs [entrada.glb] [salida.glb] [--gap 1.15]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
};
const here = path.dirname(new URL(import.meta.url).pathname);
const IN = args[0] || path.join(here, 'mesa_hanoi.glb');
const OUT = args[1] || path.join(here, 'mesa_hanoi_pack2.glb');
const GAP = flag('gap', 1.15); // separación en anchos de la pieza (1 = pegadas)

// ── Leer el GLB ───────────────────────────────────────────────────────────
const buf = fs.readFileSync(IN);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('No es un GLB: ' + IN);
let off = 12, json = null, bin = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  const chunk = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
  else if (type === 0x004e4942) bin = chunk;
  off += 8 + len;
}
if (!json) throw new Error('GLB sin chunk JSON');

// ── Matemática mínima de TRS para calcular el ancho real ─────────────────
function trsMatrix(node) {
  const t = node.translation || [0, 0, 0];
  const q = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  // Columnas de rotación escaladas + traslación (column-major, como glTF)
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0],
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1],
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2],
    t[0], t[1], t[2],
  ];
}
const apply = (m, p) => [
  m[0] * p[0] + m[3] * p[1] + m[6] * p[2] + m[9],
  m[1] * p[0] + m[4] * p[1] + m[7] * p[2] + m[10],
  m[2] * p[0] + m[5] * p[1] + m[8] * p[2] + m[11],
];

// Con KHR_mesh_quantization las posiciones se guardan como enteros
// normalizados: el min/max del accessor viene en esa escala entera y hay que
// devolverlo a [-1,1] antes de aplicar el TRS del nodo. Sin esto el modelo
// parece millones de unidades de ancho y las copias quedan lejísimos.
const NORM_DIV = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
function dequant(acc, v) {
  const div = acc.normalized ? NORM_DIV[acc.componentType] : null;
  return div ? Math.max(v / div, -1) : v;
}

const sceneNodes = (json.scenes[json.scene || 0] || json.scenes[0]).nodes;
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const ni of sceneNodes) {
  const node = json.nodes[ni];
  if (node.mesh == null) continue;
  const m = trsMatrix(node);
  for (const prim of json.meshes[node.mesh].primitives) {
    const acc = json.accessors[prim.attributes.POSITION];
    if (!acc || !acc.min || !acc.max) throw new Error('El accessor POSITION no trae min/max: no puedo medir el modelo.');
    // Las 8 esquinas de la caja local, llevadas a coordenadas de escena
    for (let c = 0; c < 8; c++) {
      const p = apply(m, [
        dequant(acc, c & 1 ? acc.max[0] : acc.min[0]),
        dequant(acc, c & 2 ? acc.max[1] : acc.min[1]),
        dequant(acc, c & 4 ? acc.max[2] : acc.min[2]),
      ]);
      for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
    }
  }
}
const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
// El pipeline deja los modelos Z-up (CAD); la app los rota a Y-up en runtime.
// El eje X del archivo queda horizontal, así que las unidades se separan ahí.
const step = size[0] * GAP;

// ── Duplicar materiales, mallas y nodos (sin tocar la geometría) ─────────
const matCount = json.materials.length;
const meshCount = json.meshes.length;
const origNames = json.materials.map((m) => m.name);

const materials = [];
const meshes = [];
const nodes = json.nodes.slice();
const roots = [];

for (const unit of [1, 2]) {
  const matBase = materials.length;
  for (let i = 0; i < matCount; i++) {
    const copy = JSON.parse(JSON.stringify(json.materials[i]));
    copy.name = origNames[i] + '_' + unit;
    materials.push(copy);
  }
  const meshBase = meshes.length;
  for (let i = 0; i < meshCount; i++) {
    const copy = JSON.parse(JSON.stringify(json.meshes[i]));
    copy.name = (json.meshes[i].name || 'mesh' + i) + '_' + unit;
    // Mismos accessors (misma geometría), material propio de la unidad.
    copy.primitives.forEach((p) => { if (p.material != null) p.material = matBase + p.material; });
    meshes.push(copy);
  }
  const dx = unit === 1 ? -step / 2 : step / 2;
  for (const ni of sceneNodes) {
    const src = json.nodes[ni];
    const copy = JSON.parse(JSON.stringify(src));
    copy.name = (src.name || 'node' + ni) + '_' + unit;
    if (copy.mesh != null) copy.mesh = meshBase + copy.mesh;
    const t = copy.translation || [0, 0, 0];
    copy.translation = [t[0] + dx, t[1], t[2]];
    roots.push(nodes.length);
    nodes.push(copy);
  }
}

const out = Object.assign({}, json, {
  materials,
  meshes,
  nodes,
  scenes: [{ name: 'Pack2', nodes: roots }],
  scene: 0,
});
// Los nodos originales quedan huérfanos (fuera de la escena); se podan para
// no dejar basura en el archivo.
const used = new Set();
const walk = (i) => { if (used.has(i)) return; used.add(i); (out.nodes[i].children || []).forEach(walk); };
roots.forEach(walk);
const remap = new Map();
const kept = [];
out.nodes.forEach((n, i) => { if (used.has(i)) { remap.set(i, kept.length); kept.push(n); } });
kept.forEach((n) => { if (n.children) n.children = n.children.map((c) => remap.get(c)); });
out.nodes = kept;
out.scenes[0].nodes = roots.map((r) => remap.get(r));

// ── Escribir el GLB ───────────────────────────────────────────────────────
const pad = (b, fill) => {
  const rem = b.length % 4;
  return rem === 0 ? b : Buffer.concat([b, Buffer.alloc(4 - rem, fill)]);
};
const jsonChunk = pad(Buffer.from(JSON.stringify(out), 'utf8'), 0x20);
const binChunk = bin ? pad(Buffer.from(bin), 0x00) : null;
const total = 12 + 8 + jsonChunk.length + (binChunk ? 8 + binChunk.length : 0);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
const parts = [header];
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
parts.push(jh, jsonChunk);
if (binChunk) {
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  parts.push(bh, binChunk);
}
fs.writeFileSync(OUT, Buffer.concat(parts, total));

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('✔ ' + path.basename(OUT) + ' (' + kb(total) + ', desde ' + kb(buf.length) + ')');
console.log('  medidas del original: ' + size.map((x) => x.toFixed(1)).join(' × ') + ' · separación aplicada en X: ' + step.toFixed(1));
console.log('  materiales: ' + materials.map((m) => m.name).join(', '));
