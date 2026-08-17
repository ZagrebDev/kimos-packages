#!/usr/bin/env node
/**
 * smoke.mjs — verifica el bundle sin navegador: monta la app con un React
 * mínimo, renderiza las ocho pestañas y comprueba que el motor reproduce las
 * cifras de la planilla original (que es la fuente que hay que respetar).
 *
 *   node apps/estudio-mercado/test/smoke.mjs
 */
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

let guardado = null;
let agente = null;
const shell = {
  app: { appId: 'estudio-mercado', instanceId: 'test', teamId: 'test' },
  window: { setTitle() {} },
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
ok(!!agente, 'registra agente', agente && agente.tools.length + ' tools');

console.log('\nCifras contra la planilla (supuestos por defecto)');
const s = agente.getSnapshot();
const plan = (id) => s.oferta.planes.filter((p) => p.id === id)[0];
const kit = (id) => s.oferta.kits.filter((p) => p.id === id)[0];

ok(s.oferta.suiteALaCarta === 2046, 'suite a la carta = $2.046/mes', s.oferta.suiteALaCarta);
ok(plan('core').mensual === 204, 'Core = $204/mes', plan('core').mensual);
ok(plan('starter').mensual === 246, 'Starter = $246/mes', plan('starter').mensual);
ok(plan('business').mensual === 466, 'Business = $466/mes', plan('business').mensual);
ok(plan('enterprise').mensual === 777, 'Enterprise = $777/mes', plan('enterprise').mensual);
ok(kit('comercial').mensual === 263, 'Kit Comercial = $263/mes', kit('comercial').mensual);
ok(kit('ia').mensual === 204, 'Kit IA = $204/mes', kit('ia').mensual);
ok(s.oferta.stackActualCliente === 2767, 'stack best-of-breed = $2.767/mes', s.oferta.stackActualCliente);
ok(s.oferta.kimosSobreStack === 0.28, 'KIMOS = 28% del stack actual', s.oferta.kimosSobreStack);
ok(s.demanda.samMM === 2939, 'SAM global = $2.939 MM', s.demanda.samMM);
ok(s.demanda.tamMM === 37181, 'TAM global = $37.181 MM', s.demanda.tamMM);
ok(s.demanda.indicePrecio === 0.91, 'índice de precio global = 0,91', s.demanda.indicePrecio);
ok(s.demanda.arpuAnual === 3967, 'ARPU anual = $3.967', s.demanda.arpuAnual);
ok(s.demanda.clientesVivosAnio3 === 364, '364 clientes vivos al año 3', s.demanda.clientesVivosAnio3);
ok(s.demanda.penetracionSAM === 0.0005, 'penetración del SAM = 0,05%', s.demanda.penetracionSAM);
ok(s.oferta.modulos.length === 24, '24 módulos', s.oferta.modulos.length);
ok(s.demanda.mercados === 30, '30 mercados', s.demanda.mercados);

console.log('\nRender de las ocho pestañas');
const contar = (n) => {
  if (!n || typeof n !== 'object') return 0;
  if (Array.isArray(n)) return n.reduce((a, x) => a + contar(x), 0);
  return 1 + contar(n.hijos) + (n.props && n.props.children ? contar(n.props.children) : 0);
};
for (const tab of ['resumen', 'modulos', 'competencia', 'precios', 'mercados', 'economia', 'clientes', 'decisiones']) {
  await agente.dispatchAction({ type: 'VER_PESTANA', payload: { pestana: tab } });
  try {
    const nodos = contar(app.Component());
    ok(nodos > 20, 'pestaña ' + tab, nodos + ' nodos');
  } catch (e) {
    ok(false, 'pestaña ' + tab, e.message);
  }
}

console.log('\nAcciones del agente');
let r = await agente.dispatchAction({ type: 'VER_MODULO', payload: { app: 'Prospección Comercial' } });
ok(r.success, 'VER_MODULO abre el detalle', r.message || r.error);
ok(contar(app.Component()) > 20, 'render con detalle abierto');

r = await agente.dispatchAction({ type: 'SET_ALCANCE', payload: { pais: 'Chile' } });
ok(r.success, 'SET_ALCANCE a Chile', r.message);
let s2 = agente.getSnapshot();
ok(s2.demanda.samMM === 38, 'SAM de Chile = $38 MM', s2.demanda.samMM);
ok(s2.demanda.penetracionSAM > 0.02, 'la penetración de un país chico enciende la alerta', s2.demanda.penetracionSAM);

r = await agente.dispatchAction({ type: 'SET_ALCANCE', payload: { idioma: 'Español' } });
s2 = agente.getSnapshot();
ok(r.success && s2.demanda.mercados === 7, 'SET_ALCANCE por idioma deja 7 mercados hispanos', s2.demanda.mercados);
ok(s2.demanda.samMM === 451, 'SAM hispano = $451 MM', s2.demanda.samMM);

r = await agente.dispatchAction({ type: 'SET_SUPUESTO', payload: { clave: 'factor', valor: 0.85 } });
s2 = agente.getSnapshot();
ok(r.success && s2.oferta.suiteALaCarta > 2046, 'SET_SUPUESTO factor 0,85 sube la lista', s2.oferta.suiteALaCarta);

r = await agente.dispatchAction({ type: 'SET_SUPUESTO', payload: { clave: 'noExiste', valor: 1 } });
ok(!r.success, 'SET_SUPUESTO rechaza claves desconocidas', r.error);
r = await agente.dispatchAction({ type: 'SET_DESCUENTO_PLAN', payload: { plan: 'business', descuento: 5 } });
ok(!r.success, 'SET_DESCUENTO_PLAN rechaza descuentos fuera de rango', r.error);
r = await agente.dispatchAction({ type: 'SET_ALCANCE', payload: { pais: 'Narnia' } });
ok(!r.success, 'SET_ALCANCE rechaza países inexistentes', r.error);

r = await agente.dispatchAction({ type: 'RESTAURAR_SUPUESTOS', payload: {} });
s2 = agente.getSnapshot();
ok(r.success && s2.oferta.suiteALaCarta === 2046, 'RESTAURAR_SUPUESTOS vuelve al estudio', s2.oferta.suiteALaCarta);

console.log('\nPersistencia y limpieza');
await new Promise((res) => setTimeout(res, 1000));
ok(guardado && guardado.sup && guardado.alcance, 'saveData recibe supuestos y alcance');
app.unmount();
ok(true, 'unmount sin excepciones');

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
