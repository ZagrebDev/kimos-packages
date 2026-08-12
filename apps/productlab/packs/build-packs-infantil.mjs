#!/usr/bin/env node
/**
 * Genera un PACK por cada mueble infantil del repo `personalizador`
 * (terciado de abedul CNC) listo para cargarlo en ProductLab.
 *
 * Cada pack trae:
 *   model3d.json  → payload de la tool SET_MODEL3D (partes, acabados, rotación,
 *                   realSizeCm medido del propio GLB → habilita AR)
 *   pasos.json    → payload de SET_PRODUCTO_STEPS: un paso por parte, un valor
 *                   por acabado, ya vinculados al 3D (`model3d` por valor)
 *   README.md     → los 6 pasos del demo para ESTE producto
 *
 * Las medidas salen de medir el GLB con sus transformaciones de nodo
 * (los modelos vienen cuantizados: el bbox del accessor NO es la medida real).
 *
 *   node packs/build-packs-infantil.mjs [ruta-al-repo-personalizador]
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = process.argv[2] || join(AQUI, '../../../../personalizador');
const MODELOS = join(REPO, 'public/models');

// ── Catálogo: mismo contenido que personalizador/src/catalog.ts ────────────
// (los `materials` son los nombres de material DENTRO del GLB: aquí cada
// parte usa un material homónimo, como los deja el pipeline CNC).
const ACABADOS = [
  { id: 'natural',  label: 'Natural',  color: '#f0dfc2', roughness: 0.65, grain: 0.25 },
  { id: 'blanco',   label: 'Blanco',   color: '#f2f1ee', roughness: 0.55, grain: 0.12 },
  { id: 'rosa',     label: 'Rosa',     color: '#f0a8b8', roughness: 0.55, grain: 0.12 },
  { id: 'celeste',  label: 'Celeste',  color: '#8fc3e8', roughness: 0.55, grain: 0.12 },
  { id: 'verde',    label: 'Verde',    color: '#9ec9a3', roughness: 0.55, grain: 0.12 },
  { id: 'amarillo', label: 'Amarillo', color: '#f2cf75', roughness: 0.55, grain: 0.12 },
];

const R = -Math.PI / 2;
const PRODUCTOS = [
  { id: 'balancin',          label: 'Balancín',              partes: [['laterales', 'Laterales'], ['peldanos', 'Peldaños']] },
  { id: 'banca_estrellas',   label: 'Banca Estrellas y Luna', partes: [['laterales', 'Laterales'], ['asiento', 'Asiento']] },
  { id: 'baul_sofa',         label: 'Baúl Sofá',             partes: [['laterales', 'Laterales'], ['cuerpo', 'Cuerpo']] },
  { id: 'camarote',          label: 'Camarote',              partes: [['madera', 'Madera']], rotation: [R, 0, Math.PI / 2] },
  { id: 'contenedor',        label: 'Contenedor Pequeño',    partes: [['laterales', 'Laterales'], ['cuerpo', 'Cuerpo']] },
  { id: 'juguetera',         label: 'Juguetera',             partes: [['madera', 'Madera']], rotation: [R, 0, -Math.PI / 2] },
  { id: 'mecedora_cuna',     label: 'Mecedora Cuna',         partes: [['madera', 'Madera']], rotation: [R, 0, Math.PI / 2] },
  { id: 'mini_silla',        label: 'Mini Silla',            partes: [['asiento', 'Asiento'], ['estructura', 'Estructura']] },
  { id: 'panel_ranurado',    label: 'Panel Ranurado',        partes: [['paneles', 'Paneles'], ['accesorios', 'Accesorios']] },
  { id: 'pieza_union',       label: 'Pieza de Unión',        partes: [['madera', 'Madera']], rotation: [0, 0, 0] },
  { id: 'resbalin',          label: 'Resbalín',              partes: [['deslizador', 'Deslizador'], ['laterales', 'Laterales'], ['peldanos', 'Peldaños']] },
  { id: 'ropero',            label: 'Ropero Organizador',    partes: [['repisas', 'Repisas'], ['ganchos', 'Ganchos'], ['estructura', 'Estructura']] },
  { id: 'torre_aprendizaje', label: 'Torre de Aprendizaje',  partes: [['peldanos', 'Peldaños'], ['estructura', 'Estructura']] },
  { id: 'triangulo_pickler', label: 'Triángulo Pickler',     partes: [['laterales', 'Laterales'], ['tablas', 'Tablas'], ['estructura', 'Estructura']] },
];

// ── Medida real del GLB (con transformaciones de nodo) ─────────────────────
function matMul(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j];
    o[i * 4 + j] = s;
  }
  return o;
}
function nodeMatrix(n) {
  if (n.matrix) {
    const m = n.matrix;   // glTF viene en column-major
    return [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]];
  }
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const Rm = [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0,
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0,
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];
  const S = [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
  const T = [1, 0, 0, tx, 0, 1, 0, ty, 0, 0, 1, tz, 0, 0, 0, 1];
  return matMul(T, matMul(Rm, S));
}
function ladoMayorCm(glbPath) {
  const buf = readFileSync(glbPath);
  const len = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const walk = (i, parent) => {
    const nd = gltf.nodes[i];
    const M = matMul(parent, nodeMatrix(nd));
    if (nd.mesh != null) {
      for (const p of (gltf.meshes[nd.mesh].primitives || [])) {
        const a = gltf.accessors[p.attributes.POSITION];
        if (!a.min) continue;
        for (const cx of [a.min[0], a.max[0]]) for (const cy of [a.min[1], a.max[1]]) for (const cz of [a.min[2], a.max[2]]) {
          const w = [
            M[0] * cx + M[1] * cy + M[2] * cz + M[3],
            M[4] * cx + M[5] * cy + M[6] * cz + M[7],
            M[8] * cx + M[9] * cy + M[10] * cz + M[11],
          ];
          for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]); }
        }
      }
    }
    for (const c of (nd.children || [])) walk(c, M);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const sc of (gltf.scenes || [])) for (const r of (sc.nodes || [])) walk(r, I);
  return Math.round(Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 100);
}

const TEX = 'REEMPLAZAR_URL_DE_plywood_col.webp';
const GLB = (id) => `REEMPLAZAR_URL_DE_${id}.glb`;

let hechos = 0;
for (const p of PRODUCTOS) {
  const glb = join(MODELOS, `${p.id}.glb`);
  if (!existsSync(glb)) { console.warn(`· ${p.id}: sin GLB en ${MODELOS} (omitido)`); continue; }
  const cm = ladoMayorCm(glb);
  const dir = join(AQUI, p.id.replace(/_/g, '-'));
  mkdirSync(dir, { recursive: true });

  const model3d = {
    _comentario: [
      `Payload de SET_MODEL3D para "${p.label}" (mueble infantil de terciado).`,
      'ANTES DE USARLO: sube el .glb y la textura desde la app (pestaña Visor 3D)',
      'y reemplaza las URLs REEMPLAZAR_… por las que devuelve la plataforma.',
      `realSizeCm (${cm}) se midió del propio GLB: es lo que habilita "Ver en tu espacio" (AR).`,
    ],
    producto: p.label,
    url: GLB(p.id),
    enabled: true,
    publish: true,
    rotation: p.rotation || [R, 0, 0],
    realSizeCm: cm,
    parts: p.partes.map(([id, label]) => ({
      id, label, materials: [id],
      defaultColor: '#e8dcc8',
      defaultFinish: 'natural',
    })),
    finishes: ACABADOS.map((f) => ({
      id: f.id, label: f.label, color: f.color,
      texture: TEX,
      roughness: f.roughness,
      textureScale: 2,
      grain: f.grain,
      triplanar: true,
    })),
  };

  const pasos = {
    _comentario: [
      `Payload de SET_PRODUCTO_STEPS para "${p.label}": un paso por parte, un valor`,
      'por acabado, cada uno vinculado al 3D — la elección del cliente repinta el modelo.',
      'Los valores con efectos `model3d` son acabados del visor: no necesitan componentes.',
      'Si quieres cobrar un acabado, agrégale "priceDelta" (o enlázale un componente).',
    ],
    producto: p.label,
    steps: p.partes.map(([id, label]) => ({
      label: `Color ${label.toLowerCase()}`,
      default: 'Natural',
      values: ACABADOS.map((f) => ({
        label: f.label,
        swatchColor: f.color,
        model3d: [{ partId: id, type: 'finish', finishId: f.id }],
      })),
    })),
  };

  const readme = `# Pack ${p.label} — del personalizador a ProductLab

Mueble infantil de **terciado de abedul** (${cm} cm de lado mayor, medido del GLB).
Partes tintables: ${p.partes.map(([, l]) => `**${l}**`).join(', ')} · 6 acabados.

| Archivo | Qué es |
|---|---|
| \`model3d.json\` | Payload de \`SET_MODEL3D\` (partes, acabados, rotación y \`realSizeCm\` → AR) |
| \`pasos.json\` | Payload de \`SET_PRODUCTO_STEPS\` (un paso por parte, un valor por acabado) |

**Archivos que hay que subir** (viven en el repo \`personalizador\`):
\`public/models/${p.id}.glb\` y \`public/textures/plywood_col.webp\` (una sola vez, sirve para todos).

## Pasos del demo

1. **Crear el producto** \`${p.label}\` en ProductLab (pestaña Productos → + Añadir).
2. **Pestaña Visor 3D** → activar → **Subir .glb** (\`${p.id}.glb\`). Copia la URL.
3. En **Acabados**, sube \`plywood_col.webp\` una vez y copia su URL.
4. Reemplaza en \`model3d.json\` las dos URLs \`REEMPLAZAR_…\` y pásaselo al agente:
   *"Aplica este SET_MODEL3D"* + el JSON. (O llena la pestaña a mano con esos valores.)
5. Lo mismo con \`pasos.json\`: *"Aplica este SET_PRODUCTO_STEPS"*.
   → El Estudio ya muestra el modelo repintándose al cambiar de paso.
6. **Publicar** (y *Aplicar a la tienda* si quieres venderlo). En el móvil aparece
   **Ver en tu espacio** (AR) porque \`realSizeCm\` viene declarado.

> Precio: estos pasos son acabados (no suman costo). Para vender, dale al producto
> sus **componentes base** (la plancha, los herrajes, la mano de obra) en el Paso 00,
> o pon \`priceDelta\` en los acabados premium.
`;

  writeFileSync(join(dir, 'model3d.json'), JSON.stringify(model3d, null, 2) + '\n');
  writeFileSync(join(dir, 'pasos.json'), JSON.stringify(pasos, null, 2) + '\n');
  writeFileSync(join(dir, 'README.md'), readme);
  console.log(`✔ ${p.label.padEnd(24)} ${cm} cm · ${p.partes.length} parte(s) · packs/${p.id.replace(/_/g, '-')}/`);
  hechos++;
}
console.log(`\n${hechos} pack(s) generados.`);
