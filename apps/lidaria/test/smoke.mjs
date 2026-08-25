#!/usr/bin/env node
/**
 * smoke.mjs — verifica el bundle sin navegador: monta la app con un React
 * mínimo, renderiza las siete pestañas, ejercita el agente y comprueba que el
 * motor de diagnóstico embebido dice lo que tiene que decir.
 *
 *   node apps/lidaria/test/smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

// React mínimo: árbol plano, hooks sin reconciliación. Alcanza para ejecutar
// todo el código de render y que cualquier excepción salga a la luz.
const efectos = [];
globalThis.React = {
  createElement: (type, props, ...hijos) => ({ type, props, hijos }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: (fn) => { efectos.push(fn); },
  useMemo: (fn) => fn(),
};

const mount = (await import(pathToFileURL(join(DIR, '../dist/index.js')).href)).default;
const manifest = JSON.parse(readFileSync(join(DIR, '../manifest.json'), 'utf8'));

let guardado = null;
let agente = null;
let titulo = null;
const shell = {
  app: { appId: 'lidaria', instanceId: 'test', teamId: 'test' },
  window: { setTitle: (t) => { titulo = t; } },
  notify() {},
  saveData: (p) => { guardado = p; return Promise.resolve(); },
  loadData: () => Promise.resolve(null),
  agent: { register: (cfg) => { agente = cfg; return () => {}; } },
};

const app = mount(shell);
let fallos = 0;
const ok = (cond, msg, extra) => {
  if (!cond) { fallos++; console.error('  ✗ ' + msg + (extra != null ? ' → ' + extra : '')); }
  else console.log('  ✓ ' + msg + (extra != null ? ' (' + extra + ')' : ''));
};

console.log('Contrato del bundle');
ok(typeof mount === 'function', 'export default mount(shell)');
ok(typeof app.Component === 'function', 'devuelve Component');
ok(typeof app.unmount === 'function', 'devuelve unmount');
ok(titulo === 'LiDARia', 'fija el título de la ventana', titulo);
ok(!!agente, 'registra agente', agente && agente.tools.length + ' tools');
ok(agente && agente.tools.length === 9, 'nueve herramientas declaradas', agente && agente.tools.map((t) => t.name).join(', '));

console.log('\nDatos embebidos');
const snap0 = agente.getSnapshot();
ok(snap0.version === manifest.version, 'APP_VERSION coincide con el manifest', snap0.version);
ok(snap0.catalogoEquipos.length >= 15, 'catálogo de equipos embebido', snap0.catalogoEquipos.length + ' equipos');
ok(snap0.modulos.length === 11, 'catálogo de módulos embebido', snap0.modulos.length + ' módulos');
ok(!!snap0.nucleo, 'versión del núcleo a la vista', snap0.nucleo);

console.log('\nRender de las diez pestañas');
const TABS = ['panel', 'rubros', 'modulos', 'inventario', 'equipos', 'prospeccion', 'ecosistema', 'negocio', 'plan', 'licencias'];
for (const t of TABS) {
  const r = await agente.dispatchAction({ type: 'VER_PESTANA', payload: { pestana: t } });
  let arbol = null;
  try { arbol = app.Component(); } catch (e) { fallos++; console.error('  ✗ ' + t + ' lanza: ' + e.message); continue; }
  ok(r.success && arbol && arbol.props.className === 'kimos-lidaria', 'pestaña ' + t + ' renderiza');
}

console.log('\nInventario y cobertura');
let r = await agente.dispatchAction({ type: 'AGREGAR_EQUIPO', payload: { equipo: 'apple.iphone.pro.12-17', etiqueta: 'iPhone de terreno', cantidad: 2 } });
ok(r.success, 'el agente añade un iPhone Pro', r.message);
let snap = agente.getSnapshot();
ok(snap.cobertura.unidades === 2, 'cuenta las unidades', snap.cobertura.unidades);
ok(snap.cobertura.completos >= 6, 'un iPhone Pro cubre la mayoría de los módulos', snap.cobertura.completos + '/' + snap.cobertura.total);
ok(snap.modulos.find((m) => m.id === 'espacios').estadoConInventario === 'completo', 'escaneo de espacios queda completo');
ok(snap.modulos.find((m) => m.id === 'terreno').estadoConInventario !== 'completo', 'el módulo de terreno NO se cubre con un teléfono');

r = await agente.dispatchAction({ type: 'RECOMENDAR_EQUIPO', payload: { modulo: 'terreno' } });
ok(r.success && /Computador|escritorio/i.test(r.message), 'recomienda un equipo para el módulo sin cubrir', r.message);

r = await agente.dispatchAction({ type: 'QUITAR_EQUIPO', payload: { equipo: 'apple.iphone.pro.12-17' } });
ok(r.success, 'el agente quita el equipo');
ok(agente.getSnapshot().cobertura.unidades === 0, 'el inventario queda vacío');

console.log('\nEconomía');
const antes = agente.getSnapshot().economia;
r = await agente.dispatchAction({ type: 'SET_SUPUESTO', payload: { clave: 'clientesKimos', valor: 240 } });
const despues = agente.getSnapshot().economia;
ok(r.success, 'el agente mueve un supuesto', r.message);
// No es exacto al céntimo: las cuentas por módulo se redondean a entero, así
// que doblar la cartera dobla el ingreso con un margen de redondeo.
const razon = despues.ingresoMes / antes.ingresoMes;
ok(Math.abs(razon - 2) < 0.02, 'duplicar cuentas duplica el ingreso', antes.ingresoMes + ' → ' + despues.ingresoMes + ' (×' + razon.toFixed(3) + ')');
const f1 = despues.porFase.find((p) => p.fase === 1);
const f3 = despues.porFase.find((p) => p.fase === 3);
ok(f1.paybackMeses < f3.paybackMeses, 'la fase 1 se paga antes que la fase 3',
  f1.paybackMeses.toFixed(1) + ' m vs ' + f3.paybackMeses.toFixed(1) + ' m');
r = await agente.dispatchAction({ type: 'SET_SUPUESTO', payload: { clave: 'inventado', valor: 1 } });
ok(!r.success, 'rechaza un supuesto que no existe', r.error);

console.log('\nRubros: la base de conocimiento por industria');
await agente.dispatchAction({ type: 'AGREGAR_EQUIPO', payload: { equipo: 'apple.iphone.pro.12-17', cantidad: 1 } });
r = await agente.dispatchAction({ type: 'SET_RUBRO', payload: { rubro: 'construccion' } });
ok(r.success && /Escaneo de espacios/.test(r.message), 'el agente abre el plan de un rubro', r.message.slice(0, 90) + '…');
r = await agente.dispatchAction({ type: 'SET_RUBRO', payload: { rubro: 'no-existe' } });
ok(!r.success && /Disponibles/.test(r.error), 'un rubro inexistente devuelve las opciones reales');
snap = agente.getSnapshot();
ok(snap.rubros.length >= 12, 'el snapshot lista los rubros con su viabilidad', snap.rubros.length + ' rubros');
const construccion = snap.rubros.find((x) => x.id === 'construccion');
ok(construccion.toleranciaCumple === true, 'con un iPhone Pro, construcción cumple su tolerancia', construccion.toleranciaMargen);
const manufactura = snap.rubros.find((x) => x.id === 'manufactura');
ok(manufactura.toleranciaMargen === 'justo', 'fabricación cumple JUSTO: el matiz no se pierde en el bundle');

console.log('\nProspección: el parque del prospecto decide qué se le ofrece');
r = await agente.dispatchAction({
  type: 'FICHA_PROSPECTO',
  payload: { nombre: 'Mueblería Demo', rubro: 'retail-mobiliario', usuariosCampo: 4, equipos: ['apple.iphone.pro.12-17'], appsKimos: ['productlab', 'productos'] },
});
ok(r.success && /Calificación/.test(r.message), 'el agente arma la ficha del prospecto', r.message.slice(0, 100) + '…');
ok(/Demostración/.test(r.message), 'y trae la demostración que se hace en la visita');
snap = agente.getSnapshot();
ok(snap.prospecto && snap.prospecto.fuente === 'kimos-LiDARia', 'el registro para el CRM viaja en el snapshot');
ok(typeof snap.prospecto.propuestaMensualUSD === 'number' && snap.prospecto.propuestaMensualUSD > 0, 'con una propuesta en dólares', snap.prospecto.propuestaMensualUSD);
r = await agente.dispatchAction({ type: 'FICHA_PROSPECTO', payload: { rubro: 'construccion', equipos: ['equipo.inventado'] } });
ok(r.success && /ignorados/.test(r.message), 'un equipo fuera del catálogo se ignora y se avisa');

console.log('\nEcosistema KIMOS');
r = await agente.dispatchAction({ type: 'VER_INTEGRACION', payload: { app: 'productlab' } });
ok(r.success && /realSizeCm/.test(r.message), 'la integración ancla nombra el campo real que hoy falta');
r = await agente.dispatchAction({ type: 'VER_INTEGRACION', payload: { app: 'escritorio' } });
ok(r.success, 'los alias de app resuelven', r.message.slice(0, 60) + '…');
r = await agente.dispatchAction({ type: 'VER_INTEGRACION', payload: { app: 'inexistente' } });
ok(!r.success, 'una app desconocida se rechaza');
snap = agente.getSnapshot();
ok(snap.ecosistema.anclas.length >= 4, 'el snapshot conoce las anclas', snap.ecosistema.anclas.join(', '));
ok(snap.ecosistema.descartadas.length >= 3, 'y también lo descartado', snap.ecosistema.descartadas.join(', '));

console.log('\nLicencias');
r = await agente.dispatchAction({ type: 'EVALUAR_LICENCIA', payload: { licencia: 'AGPL-3.0' } });
ok(r.success && /prohibida/.test(r.message), 'AGPL queda fuera', r.message);
r = await agente.dispatchAction({ type: 'EVALUAR_LICENCIA', payload: { licencia: 'MIT OR GPL-3.0' } });
ok(r.success && /permitida/.test(r.message), 'un OR con opción permisiva entra', r.message);
const snapL = agente.getSnapshot().licencias;
ok(snapL.prohibidas.length >= 3, 'el agente sabe qué bibliotecas están vetadas', snapL.prohibidas.join(', '));

console.log('\nPersistencia y limpieza');
await new Promise((res) => setTimeout(res, 900));
ok(guardado && typeof guardado === 'object', 'guarda estado con debounce', guardado && Object.keys(guardado).join(','));
ok(!!guardado.sup && Array.isArray(guardado.inventario), 'guarda supuestos e inventario');
app.unmount();
ok(true, 'unmount sin excepciones');

console.log('');
if (fallos) {
  console.error('✖ ' + fallos + ' comprobación(es) fallida(s).');
  process.exit(1);
}
console.log('✔ smoke test en verde.');
