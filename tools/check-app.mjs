#!/usr/bin/env node
/**
 * check-app.mjs — revisa una app contra el contrato de KIMOS y dice qué le
 * falta para estar alineada con la arquitectura compartida.
 *
 * Para qué existe: `pack.mjs` valida lo que impide empaquetar (manifest,
 * permisos, `dataSchema`). Eso deja fuera lo que más caro sale: una app que
 * empaqueta perfectamente pero se inventa su propia base de clientes, sube
 * archivos a mano o cablea los colores de la marca. Eso no falla al instalar
 * — falla seis meses después, cuando hay tres «Acme SpA» en el sistema y
 * cambiar el logo son cinco sitios.
 *
 * Dos tipos de hallazgo, y la diferencia importa:
 *
 *   ✖ ERROR   — verificable y objetivo. Impide empaquetar o instalar bien.
 *   ! REVISAR — una señal, no un veredicto. Se detecta leyendo el bundle
 *               como texto, así que puede equivocarse. Nunca dice «está
 *               mal»: dice «esto parece X, compruébalo».
 *
 * Un revisor que da falsos positivos con tono de error se ignora entero, y
 * entonces deja de servir. De ahí la separación.
 *
 * Uso:
 *   node tools/check-app.mjs apps/mi-app          # una app
 *   node tools/check-app.mjs                      # todas las de apps/
 *
 * Sale con 1 si hay ERRORES. Los avisos no rompen la salida: son para leer,
 * no para bloquear un pipeline.
 *
 * Ver APP-SPEC.md §7 y ALINEA-TU-APP.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMISSIONS_HELP, validateManifest } from './app-contract.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');

const leer = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const existe = (p) => fs.existsSync(p);

/**
 * El código sin comentarios, para las señales que se buscan como texto.
 *
 * Sin esto el revisor señalaba a una app por el comentario que PROHÍBE lo que
 * se está buscando («Nunca `dangerouslySetInnerHTML`»), que es la peor clase
 * de falso positivo: castiga justo a quien lo documentó.
 *
 * Se quitan los bloques `/* … *\/` y las líneas que EMPIEZAN por `//`. Los
 * `//` a media línea se dejan, porque quitarlos rompería cualquier `https://`
 * y eso sí escondería hallazgos de verdad.
 */
function sinComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

/** Hex que NO están detrás de un token con nombre (`--algo: #hex`).
 *
 * La distinción es la que hace útil el aviso: un color detrás de un token
 * nombrado es una decisión semántica deliberada y en un solo sitio (`--ok`,
 * `--error`). Un hex suelto dentro de una regla es identidad visual cableada,
 * que es justo lo que impide que la marca del tenant se aplique (§9 y §7.f).
 */
function hexSueltos(css) {
  const sinTokens = css.replace(/--[a-z0-9-]+\s*:\s*#[0-9a-fA-F]{3,8}\b/gi, '');
  return (sinTokens.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
}

/**
 * Señales de que la app guarda su propia ficha de cliente o contacto. Cada
 * una lleva su nombre en castellano: enseñarle la expresión regular a quien
 * escribe una app no le dice nada, y el aviso se lee como ruido.
 */
const PISTAS_CLIENTE = [
  ['una razón social', /\braz[oó]n\s*social\b/i],
  ['un RUT', /['"`]?\brut\b['"`]?\s*[:=]/i],
  ['un identificador fiscal (`taxId`)', /\btaxId\b/],
  ['un nombre de cliente', /\bnombreCliente\b/i],
  ['una lista de clientes', /\b(clientes?|customers?)\b\s*[:=]\s*\[/i],
];

const PISTAS_MARCA = [
  ['un logo propio (`logoUrl`)', /\blogoUrl\b/],
  ['un emisor', /\bemisor\b/i],
  ['un emisor (`issuer`)', /\bissuer\b/],
  ['datos bancarios', /\b(datosBancarios|bankDetails)\b/i],
];

function revisarApp(dir, catalogo) {
  const errores = [];
  const avisos = [];
  const bien = [];

  const manifestPath = path.join(dir, 'manifest.json');
  if (!existe(manifestPath)) return { errores: [`No existe ${dir}/manifest.json`], avisos, bien, id: path.basename(dir) };

  let manifest;
  try { manifest = JSON.parse(leer(manifestPath)); }
  catch (e) { return { errores: ['manifest.json no es JSON válido: ' + e.message], avisos, bien, id: path.basename(dir) }; }

  const id = String(manifest.id || path.basename(dir));
  const version = String(manifest.version || '');
  const perms = Array.isArray(manifest.permissions) ? manifest.permissions.map(String) : [];
  const tiene = (p) => perms.includes(p);
  const entry = String(manifest.entry || 'dist/index.js');
  const bundleCrudo = leer(path.join(dir, entry));
  // Las comprobaciones de contrato miran el archivo tal cual (`APP_VERSION`,
  // `export default`); las señales de alineación miran el código sin
  // comentarios, para no señalar a nadie por lo que documentó.
  const bundle = sinComentarios(bundleCrudo);
  const css = leer(path.join(dir, String(manifest.css || 'dist/index.css')));
  const readme = leer(path.join(dir, 'README.md'));

  // ── ERRORES: el contrato, tal cual ────────────────────────────────────
  errores.push(...validateManifest(manifest));

  if (!bundleCrudo) {
    errores.push(`No existe el bundle '${entry}'.`);
  } else {
    if (!/export\s+default/.test(bundle)) {
      errores.push('El bundle no tiene `export default`: el contrato pide `default mount(shell)` (APP-SPEC §3).');
    }
    // Un import de red en runtime rompe la app en un tenant sin salida a
    // internet, y no se nota hasta que se abre allí.
    const importRemoto = bundle.match(/\bfrom\s+['"]https?:\/\/[^'"]+['"]/);
    if (importRemoto) {
      errores.push(`El bundle importa de la red en runtime (${importRemoto[0].slice(0, 60)}…). Debe viajar completo (APP-SPEC §8).`);
    }
    if (/\bimport\s+React\b|from\s+['"]react['"]/.test(bundle)) {
      errores.push('El bundle trae su propio React. Debe usar `globalThis.React` (APP-SPEC §3).');
    }
  }

  // La versión, en los cuatro sitios (APP-SPEC §7.a). `check-versions.mjs`
  // cubre esto para el repo; aquí se repite porque un tercero revisa SU app
  // suelta, sin catálogo raíz.
  const enCatalogo = catalogo ? catalogo.get(id) : null;
  if (catalogo && !enCatalogo) {
    avisos.push('No aparece en el catálogo raíz `manifest.json`: la Tienda no ofrecerá la actualización (APP-SPEC §7.a).');
  } else if (enCatalogo && String(enCatalogo.version || '') !== version) {
    errores.push(`La versión del catálogo raíz (v${enCatalogo.version}) no coincide con la de la app (v${version}). La Tienda ofrece la del catálogo (APP-SPEC §7.a).`);
  }
  const declarada = (bundle.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  if (!declarada) {
    avisos.push('El bundle no declara `APP_VERSION`: no hay forma de ver en pantalla qué build quedó instalado (APP-SPEC §7.a).');
  } else if (declarada !== version) {
    errores.push(`\`APP_VERSION\` del bundle (${declarada}) no coincide con el manifest (${version}).`);
  }
  const enReadme = (readme.match(/Versi[oó]n actual:\s*\**\s*([0-9][0-9A-Za-z.\-]*)/i) || [])[1];
  if (enReadme && enReadme !== version) {
    avisos.push(`El README dice v${enReadme} y el manifest v${version}.`);
  }

  // Persistencia: sin `multiInstance` no hay `teamId`/`instanceId`, así que
  // `saveData` y `shell.items` no pueden funcionar (APP-SPEC §2).
  const persiste = /shell\.(saveData|loadData|items)\b/.test(bundle);
  if (persiste && !manifest.multiInstance) {
    errores.push('Usa `saveData`/`shell.items` pero no declara `multiInstance: true`: sin eso no hay instancia donde guardar y la app no persiste (APP-SPEC §2).');
  }

  // ── REVISAR: alineación con la arquitectura compartida ─────────────────

  // 1. Archivos a mano en vez de shell.files (§7.e).
  const subeAMano = /authFetch\([^)]*\/api\/v2\/files/.test(bundle) || /['"`][^'"`]*\/api\/v2\/files/.test(bundle);
  const usaFiles = /shell\.files\b/.test(bundle);
  if (subeAMano && !usaFiles) {
    avisos.push('Sube archivos con `authFetch` a `/api/v2/files`. Con `shell.files` la ruta la gestiona el host: aislamiento por app, cuota atribuible y limpieza al desinstalar (APP-SPEC §7.e).');
  }
  if (usaFiles && !tiene('files.write')) {
    errores.push('Usa `shell.files` pero no declara `files.write` en el manifest: el backend rechazará las subidas.');
  }
  if (tiene('files.write') && !usaFiles) {
    avisos.push('Declara `files.write` pero no se ve uso de `shell.files`. Pide solo los permisos que uses: el instalador los lee.');
  }

  // 2. Base de clientes propia en vez de shell.records (§7.d).
  //    Una app que declara `recordType` en su `dataSchema` SE DECLARA fuente
  //    de esa identidad —Clientes lo es de `account`—, así que guardar la
  //    ficha es exactamente su trabajo y no hay nada que señalar.
  const esFuente = !!(manifest.dataSchema && manifest.dataSchema.recordType);
  const pistaCliente = PISTAS_CLIENTE.find(([, re]) => re.test(bundle));
  const usaRecords = /shell\.records\b/.test(bundle);
  if (pistaCliente && !usaRecords && !esFuente) {
    avisos.push(`Parece guardar ${pistaCliente[0]} por su cuenta. Si la app maneja clientes o contactos, \`shell.records\` evita que el sistema acabe con tres «Acme SpA» y ninguna vista completa. Si es la app DUEÑA de esa ficha, declara \`recordType\` en su \`dataSchema\` (APP-SPEC §7.c y §7.d).`);
  }
  if (usaRecords && !tiene('records.link')) {
    errores.push('Usa `shell.records` pero no declara `records.link` en el manifest: el backend lo rechazará.');
  }
  if (tiene('records.link') && !usaRecords) {
    avisos.push('Declara `records.link` pero no se ve uso de `shell.records`.');
  }

  // 3. Marca propia en vez de shell.brand (§7.f).
  const pistaMarca = PISTAS_MARCA.find(([, re]) => re.test(bundle));
  const usaBrand = /shell\.brand\b/.test(bundle);
  if (pistaMarca && !usaBrand) {
    avisos.push(`Parece definir ${pistaMarca[0]} por su cuenta. Con \`shell.brand\` el logo y la razón social se definen una vez para todo KIMOS, en vez de en cada app (APP-SPEC §7.f).`);
  }
  if (usaBrand && !tiene('brand.read')) {
    errores.push('Usa `shell.brand` pero no declara `brand.read` en el manifest.');
  }

  // 4. Colores cableados: lo que impide que la marca del tenant se aplique.
  const hex = hexSueltos(css);
  if (hex > 0) {
    avisos.push(`El CSS tiene ${hex} color(es) hex fuera de un token con nombre. Mientras existan, la app NO se re-marca con la marca del tenant: todo color debe salir de los tokens del tema del host (APP-SPEC §9 y §7.f).`);
  } else if (css) {
    bien.push('Sin colores cableados: se re-marca sola con la marca del tenant.');
  }

  // 5. Los miembros opcionales, comprobados antes de usarlos.
  for (const miembro of ['records', 'files', 'brand']) {
    const usa = new RegExp(`shell\\.${miembro}\\b`).test(bundle);
    const comprueba = new RegExp(`(if\\s*\\(\\s*!?\\s*shell\\.${miembro}\\b|shell\\.${miembro}\\s*(&&|\\?\\.|\\?))`).test(bundle);
    if (usa && !comprueba) {
      avisos.push(`Usa \`shell.${miembro}\` sin comprobar que exista. Es opcional en el contrato: en un host anterior la app se rompería (APP-SPEC §7).`);
    }
  }

  // 6. Escribir en otra app sin que se pueda escribir en la tuya.
  const escribeEnOtras = perms.some((p) => p.startsWith('data.write:'));
  if (escribeEnOtras && !/shell\.data\.(create|update)\b/.test(bundle)) {
    avisos.push('Declara `data.write:` pero no se ve `shell.data.create/update`.');
  }
  // Solo se pregunta a las apps que YA están en el grafo compartido: a una
  // app aislada, «¿deberían otras poder escribirte?» es ruido.
  const enElGrafo = /shell\.data\b/.test(bundle) || tiene('records.link');
  if (persiste && enElGrafo && !manifest.dataSchema) {
    avisos.push('¿Debería otra app poder alimentarla? Sin `dataSchema` publicado, no puede (falla cerrado). Si sus datos son solo suyos, está bien así (APP-SPEC §7.c).');
  }

  // 7. innerHTML: solo cuando se ESCRIBE. Leerlo para serializar la salida de
  //    React (una hoja de impresión, una página publicada) es legítimo, y
  //    marcarlo convertiría el aviso en ruido.
  if (/\.innerHTML\s*(=[^=]|\+=)/.test(bundle) || /dangerouslySetInnerHTML/.test(bundle)) {
    avisos.push('Escribe HTML con `innerHTML`/`dangerouslySetInnerHTML`. El texto que escribe una persona —o que llega del catálogo de otra app— debe pintarse como elementos, no como HTML.');
  }

  // 8. CSS sin clase raíz: se filtra al shell.
  if (css && !new RegExp(`\\.(kimos-|${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).test(css)) {
    avisos.push('El CSS no parece tener una clase raíz propia (`.kimos-tuapp …`): sin scope, los estilos se filtran al shell (APP-SPEC §9).');
  }

  // Lo que ya está bien, para que se vea que se comprobó.
  if (usaRecords) bien.push('Usa la base compartida de identidades (`shell.records`).');
  if (usaFiles) bien.push('Guarda archivos con `shell.files`.');
  if (usaBrand) bien.push('Lee la marca del tenant (`shell.brand`).');
  if (manifest.dataSchema) bien.push('Publica su `dataSchema`: otras apps pueden alimentarla.');

  return { errores, avisos, bien, id, version, perms };
}

// ── Main ──────────────────────────────────────────────────────────────────
const arg = process.argv[2];

let catalogo = null;
const catalogoPath = path.join(RAIZ, 'manifest.json');
if (existe(catalogoPath)) {
  try {
    const cat = JSON.parse(leer(catalogoPath));
    catalogo = new Map((cat.apps || []).map((a) => [a.id, a]));
  } catch { /* sin catálogo: un tercero revisa su app suelta */ }
}

let dirs;
if (arg) {
  dirs = [arg];
} else {
  const appsDir = path.join(RAIZ, 'apps');
  if (!existe(appsDir)) {
    console.error('✖ Uso: node tools/check-app.mjs <carpeta-de-tu-app>');
    process.exit(1);
  }
  dirs = fs.readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existe(path.join(appsDir, d.name, 'manifest.json')))
    .map((d) => path.join('apps', d.name));
}

let totalErrores = 0;
let totalAvisos = 0;
const limpias = [];

for (const dir of dirs) {
  const r = revisarApp(dir, catalogo);
  totalErrores += r.errores.length;
  totalAvisos += r.avisos.length;

  if (!r.errores.length && !r.avisos.length) { limpias.push(`${r.id} v${r.version || '?'}`); continue; }

  console.log(`\n${r.errores.length ? '✖' : '!'} ${r.id}${r.version ? ' v' + r.version : ''}  (${dir})`);
  for (const e of r.errores) console.log('    ✖ ' + e);
  for (const a of r.avisos) console.log('    ! ' + a);
  if (dirs.length === 1) for (const b of r.bien) console.log('    ✔ ' + b);
}

if (limpias.length) {
  console.log(`\n✔ Sin nada que señalar: ${limpias.join(', ')}`);
}

console.log();
if (totalErrores) {
  console.log(`✖ ${totalErrores} error(es) y ${totalAvisos} aviso(s) en ${dirs.length} app(s).`);
  console.log(`  ${PERMISSIONS_HELP}`);
  console.log('  Los ✖ hay que corregirlos; los ! son señales para revisar (pueden equivocarse).');
  process.exit(1);
}
console.log(`✔ Sin errores. ${totalAvisos} aviso(s) para revisar en ${dirs.length} app(s).`);
console.log('  Un aviso no es un error: se detecta leyendo el bundle como texto y puede equivocarse.');
console.log('  Cómo alinearla: ALINEA-TU-APP.md');
