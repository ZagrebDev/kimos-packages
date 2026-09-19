/**
 * Comprueba que un estado exportado se importe de verdad, sobre imágenes
 * emparejadas por nombre de archivo.
 *
 * Importa el trabajo es lo que evita volver a pagar el análisis: un documento
 * de quince banners lleva decenas de llamadas al modelo detrás. Si la
 * importación falla en silencio —o se traga la mitad de los bloques— eso no
 * se nota hasta que ya se pagó otra vez.
 *
 *   ESTADO_JSON=/ruta/a/estado.json node apps/banners-translator/test/importar.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BUNDLE = path.join(RAIZ, 'dist/index.js');
// Un estado real convertido desde la herramienta local. Sin `ESTADO` puesto,
// la prueba se salta: es la única parte que necesita un archivo de fuera.
const ESTADO = process.env.ESTADO_JSON;
if (!ESTADO) {
  console.log('(saltada: define ESTADO_JSON con un estado exportado para probar la importación)');
  process.exit(0);
}

const fuente = readFileSync(BUNDLE, 'utf8');
const cuerpo = fuente
  .slice(fuente.indexOf('export default function mount(shell) {') + 'export default function mount(shell) {'.length)
  .replace(/\n  return \{\n    Component: App,[\s\S]*$/, '\n');
const estado = readFileSync(ESTADO, 'utf8');

const navegador = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const pagina = await navegador.newPage();
await pagina.goto('data:text/html,<html><body></body></html>');

const res = await pagina.evaluate(({ cuerpo, estado }) => {
  const salida = [];
  const ok = (n, c, e) => salida.push({ n, ok: !!c, e });
  const eq = (a, b, n) => ok(n, a === b, a === b ? '' : `esperado ${b}, obtenido ${a}`);

  const noop = () => {};
  globalThis.React = {
    createElement: () => null, useState: (v) => [v, noop], useEffect: noop,
    useRef: () => ({ current: null }), useReducer: (f, i) => [i, noop], Fragment: 'f',
  };
  const notificaciones = [];
  const shell = {
    app: { appId: 'bt', instanceId: 'i1', teamId: 't1' },
    window: { setTitle: noop }, notify: (m) => notificaciones.push(m),
    agent: { register: () => noop },
    saveData: async () => {}, loadData: async () => null,
  };
  // eslint-disable-next-line no-new-func
  const M = new Function('shell', cuerpo + '\n; return { importarEstado, model, commit, serializar, medidas };')(shell);

  // Las imágenes ya subidas en el tenant: sólo tres de las nueve, a propósito,
  // para comprobar que las que faltan se reporten en vez de perderse en silencio.
  M.commit((m) => {
    m.imagenes = [
      { id: 'x1', nombre: '07_85wh_battery', url: 'u1', ancho: 1200, alto: 2875, paneles: [], hecha: false, urlFinal: '' },
      { id: 'x2', nombre: '02_meet_onexplayer3', url: 'u2', ancho: 1200, alto: 6000, paneles: [], hecha: false, urlFinal: '' },
      { id: 'x3', nombre: '12_button_port_layout', url: 'u3', ancho: 1200, alto: 3000, paneles: [], hecha: false, urlFinal: '' },
    ];
  });

  const r = M.importarEstado(estado);
  eq(r.emparejadas, 3, 'empareja por nombre las imágenes ya subidas');
  eq(r.total, 9, 'y cuenta cuántas traía el archivo');
  eq(r.huerfanas.length, 6, 'las que no están subidas se reportan, no se pierden en silencio');

  const bateria = M.model.imagenes.find((i) => i.nombre === '07_85wh_battery');
  eq(bateria.paneles.length, 2, 'restaura los paneles de la imagen');
  eq(bateria.paneles[0].y0, 0, 'con los cortes que traía el JSON…');
  eq(bateria.paneles[0].y1, 1600, '…sin recalcularlos (si no, los bloques caerían en otro panel)');
  eq(bateria.paneles.reduce((a, p) => a + p.bloques.length, 0), 11, 'y sus once bloques analizados');
  ok('la URL de la imagen subida NO se pisa con la del JSON',
    bateria.url === 'u1', bateria.url);

  const b0 = bateria.paneles[0].bloques[0];
  eq(b0.en, 'Massive 85Wh Battery', 'el texto original llega intacto');
  eq(b0.es, 'Batería masiva de 85 Wh', 'y la traducción ya revisada también');
  eq(b0.peso, 'extrabold', 'con sus decisiones tipográficas');
  ok('y la caja en coordenadas de la imagen', Array.isArray(b0.caja) && b0.caja.length === 4, JSON.stringify(b0.caja));
  eq(b0.parcheIA, null, 'los parches de IA de otra instalación no se arrastran');

  const meet = M.model.imagenes.find((i) => i.nombre === '02_meet_onexplayer3');
  eq(meet.paneles.reduce((a, p) => a + p.bloques.length, 0), 50, 'los 50 bloques de la otra imagen también');

  eq(M.model.glosario.noTraducir.length, 49, 'el glosario llega entero: 49 términos sin traducir');
  eq(Object.keys(M.model.glosario.terminos).length, 47, 'y 47 equivalencias fijas');
  ok('con las equivalencias correctas', M.model.glosario.terminos.handheld === 'consola portátil',
    M.model.glosario.terminos.handheld);
  ok('ONEXPLAYER sigue sin traducirse', M.model.glosario.noTraducir.includes('ONEXPLAYER'));
  eq(M.model.producto, 'ONEXPLAYER 3 · Consola gaming portátil', 'y el producto queda puesto');

  // Lo importado tiene que volver a salir: si serializar() lo pierde, el
  // trabajo se evapora en el primer guardado.
  const vuelta = M.serializar();
  const bat2 = vuelta.imagenes.find((i) => i.nombre === '07_85wh_battery');
  eq(bat2.paneles.reduce((a, p) => a + p.bloques.length, 0), 11,
    'lo importado sobrevive a serializar(): si no, se evaporaría al guardar');
  eq(vuelta.glosario.noTraducir.length, 49, 'y el glosario también');

  // Un archivo que no es lo que dice ser no debe dejar el documento a medias.
  let lanzo = '';
  try { M.importarEstado('{"hola": 1}'); } catch (e) { lanzo = e.message; }
  ok('un JSON que no es un estado se rechaza con un motivo', /imágenes/i.test(lanzo), lanzo);
  let lanzo2 = '';
  try { M.importarEstado('no soy json'); } catch (e) { lanzo2 = e.message; }
  ok('y un archivo que ni siquiera es JSON, también', /JSON válido/i.test(lanzo2), lanzo2);
  eq(M.model.glosario.noTraducir.length, 49, 'y ninguno de los dos deja el documento a medias');

  return salida;
}, { cuerpo, estado });

await navegador.close();

let fallos = 0;
console.log('\nImportar el trabajo de la herramienta local');
for (const r of res) {
  console.log(`  ${r.ok ? '✔' : '✘'} ${r.n}${r.e ? '  · ' + r.e : ''}`);
  if (!r.ok) fallos++;
}
console.log();
if (fallos) { console.log(`✘ ${fallos} fallo(s)`); process.exit(1); }
console.log('✔ todo en verde');
