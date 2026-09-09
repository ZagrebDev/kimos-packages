#!/usr/bin/env node
/**
 * build-creator-pack.mjs — genera `kimos-creator-pack.zip` en la raíz del repo.
 *
 * El pack es el kit COMPLETO para que un tercero cree contenido instalable de
 * KIMOS sin acceso a este repositorio (que será privado).
 *
 * **Creator Pack 2.0** — ahora son DOS cosas las que puede crear un tercero:
 *   · una APP instalable (.kapp): guía, contrato, empaquetador y dos ejemplos;
 *   · un PACK DE RUBRO de LiDARia (.krub): conocimiento de industria para una
 *     app que ya existe, con su guía, su empaquetador y su ejemplo.
 * Lo segundo es la puerta de entrada barata: no exige programar. Se descarga desde la Tienda de KIMOS
 * (GET /api/apps/creator-pack) o se envía directamente a quien lo necesite.
 *
 * Uso:  node tools/build-creator-pack.mjs
 * (regenerar y commitear el zip cada vez que cambie la guía o los ejemplos)
 */
import {
  readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync,
} from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'kimos-creator-pack.zip');

// Contenido del pack: [origen (relativo al repo), destino dentro del zip]
const INCLUDE = [
  // --- crear una app ---
  ['CREA-TU-APP.md', 'CREA-TU-APP.md'],
  ['APP-SPEC.md', 'APP-SPEC.md'],
  ['tools/pack.mjs', 'tools/pack.mjs'],
  ['apps/miorg.encuestas', 'ejemplos/miorg.encuestas'],
  ['apps/miorg.buzon', 'ejemplos/miorg.buzon'],
  // --- crear conocimiento para LiDARia (2.0) ---
  ['CREA-TU-RUBRO.md', 'CREA-TU-RUBRO.md'],
  ['tools/pack-rubro.mjs', 'tools/pack-rubro.mjs'],
  // El empaquetador de rubros valida con el MISMO núcleo que corre en la app,
  // y con su mismo catálogo: sin estas dos copias, un tercero no puede validar.
  ['apps/lidaria/src/nucleo.mjs', 'tools/lidaria-nucleo.mjs'],
  ['apps/lidaria/src/payload.json', 'tools/lidaria-payload.json'],
  ['apps/lidaria/packs/ejemplo-vinas.json', 'ejemplos/rubros/ejemplo-vinas.json'],
  ['apps/lidaria/packs/ejemplo-vinas.md', 'ejemplos/rubros/ejemplo-vinas.md'],
];

const README = `# KIMOS — Pack para creadores 2.0

Kit completo para crear contenido instalable de KIMOS. Dos caminos, según lo
que quieras aportar:

## A. Crear una APP (.kapp) — si vas a programar

- CREA-TU-APP.md      → EMPIEZA AQUÍ: guía paso a paso (quickstart de 10 min).
- APP-SPEC.md         → referencia técnica del contrato AppShell.
- tools/pack.mjs      → empaquetador: node tools/pack.mjs <carpeta-de-tu-app>
                        genera el archivo .kapp listo para instalar.
- ejemplos/           → dos apps de terceros completas y comentadas:
    miorg.encuestas   → encuesta incrustable (gateway público, sin backend).
    miorg.buzon       → buzón de mensajes (además lee datos de otras apps).

Flujo: copia un ejemplo → renómbralo con tu namespace (tuorg.mi-app) → edita
manifest.json y dist/index.js → node tools/pack.mjs tuorg.mi-app → en KIMOS,
Tienda → "Instalar desde archivo" (lo hace un superadmin).

## B. Crear CONOCIMIENTO para LiDARia (.krub) — sin programar

LiDARia es la app de captura 3D (LiDAR, ToF, profundidad por movimiento). Un
"pack de rubro" le enseña una industria nueva: con qué tolerancia se trabaja,
qué módulos importan y en qué orden, cómo es el flujo, qué KPI mejora, qué
normativa respetar y cómo se prepara una visita comercial de ese rubro.

- CREA-TU-RUBRO.md          → guía paso a paso (quickstart de 15 min).
- tools/pack-rubro.mjs      → empaquetador: node tools/pack-rubro.mjs mi-rubro.json
                              genera el archivo .krub listo para cargar.
- tools/lidaria-nucleo.mjs  → el validador (el MISMO que corre dentro de la app).
- tools/lidaria-payload.json→ el catálogo contra el que se valida.
- ejemplos/rubros/          → un pack real que añade un rubro y extiende otro.

Flujo: copia el ejemplo → cambia el id a tuorg.tu-rubro → describe tolerancia,
módulos, flujo, KPI y prospección → node tools/pack-rubro.mjs tu-rubro.json →
en KIMOS, LiDARia → Rubros → "Ampliar la base de conocimiento".

Un pack solo puede AÑADIR o EXTENDER: nunca borra lo que trae el producto, y
cada rubro queda marcado con su origen.

## Requisito

Node.js 18 o superior (solo para empaquetar). Una app no necesita build salvo
que uses TypeScript/JSX, en cuyo caso compila tú a un bundle ESM plano; un pack
de rubro no necesita nada: es un JSON.
`;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Recolectar entradas [contenido, rutaDestino]
const entries = [[Buffer.from(README), 'README.md']];
for (const [src, dest] of INCLUDE) {
  const abs = join(ROOT, src);
  if (statSync(abs).isDirectory()) {
    for (const f of walk(abs)) {
      entries.push([readFileSync(f), join(dest, relative(abs, f))]);
    }
  } else {
    entries.push([readFileSync(abs), dest]);
  }
}

// Staging + zip del sistema (disponible en CI/dev; sin dependencias npm).
const stage = join(ROOT, '.creator-pack-stage');
rmSync(stage, { recursive: true, force: true });
for (const [content, dest] of entries) {
  const target = join(stage, dest);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
rmSync(OUT, { force: true });
execFileSync('zip', ['-rq', OUT, '.'], { cwd: stage });
rmSync(stage, { recursive: true, force: true });
console.log(`✔ kimos-creator-pack.zip 2.0 generado (${entries.length} archivos, ${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
console.log('  · apps .kapp: CREA-TU-APP.md + APP-SPEC.md + tools/pack.mjs + 2 ejemplos');
console.log('  · rubros .krub: CREA-TU-RUBRO.md + tools/pack-rubro.mjs + validador + 1 ejemplo');
