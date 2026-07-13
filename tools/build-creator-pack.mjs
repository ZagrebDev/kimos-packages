#!/usr/bin/env node
/**
 * build-creator-pack.mjs — genera `kimos-creator-pack.zip` en la raíz del repo.
 *
 * El pack es el kit COMPLETO para que un tercero cree apps instalables de
 * KIMOS sin acceso a este repositorio (que será privado): guía pública,
 * referencia del contrato, el empaquetador .kapp y dos apps de ejemplo
 * funcionales. Se descarga desde la Tienda de KIMOS
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
  ['CREA-TU-APP.md', 'CREA-TU-APP.md'],
  ['APP-SPEC.md', 'APP-SPEC.md'],
  ['tools/pack.mjs', 'tools/pack.mjs'],
  ['apps/miorg.encuestas', 'ejemplos/miorg.encuestas'],
  ['apps/miorg.buzon', 'ejemplos/miorg.buzon'],
];

const README = `# KIMOS — Pack para creadores de apps

Kit completo para crear apps instalables de KIMOS.

## Contenido

- CREA-TU-APP.md      → EMPIEZA AQUÍ: guía paso a paso (quickstart de 10 min).
- APP-SPEC.md         → referencia técnica del contrato AppShell.
- tools/pack.mjs      → empaquetador: node tools/pack.mjs <carpeta-de-tu-app>
                        genera el archivo .kapp listo para instalar.
- ejemplos/           → dos apps de terceros completas y comentadas:
    miorg.encuestas   → encuesta incrustable (gateway público, sin backend).
    miorg.buzon       → buzón de mensajes (además lee datos de otras apps).

## Flujo resumido

1. Copia un ejemplo y renómbralo con tu namespace (tuorg.mi-app).
2. Edita manifest.json y dist/index.js según la guía.
3. node tools/pack.mjs tuorg.mi-app   →   tuorg.mi-app-1.0.0.kapp
4. En KIMOS: Tienda → "Instalar desde archivo" (lo hace un superadmin).

Requisito: Node.js 18 o superior (solo para empaquetar; la app en sí no
necesita build salvo que uses TypeScript/JSX, en cuyo caso compila tú a un
bundle ESM plano).
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
console.log(`✔ kimos-creator-pack.zip generado (${entries.length} archivos, ${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
