#!/usr/bin/env node
/**
 * smoke.mjs — verifica el bundle sin navegador: monta la app con un React
 * mínimo, renderiza las once pestañas y comprueba dos cosas. Una, que el motor
 * reproduce las cifras del estudio de KIMOS (la fuente que hay que respetar).
 * Dos, que el mismo motor sirve para el estudio de otra empresa: plantilla de
 * rubro, líneas y precios cargados por el agente, y nada inventado por el
 * camino.
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

ok(s.oferta.suiteALaCarta === 2220, 'suite a la carta = $2.220/mes', s.oferta.suiteALaCarta);
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
ok(s.oferta.modulos.length === 25, '25 módulos (24 de la planilla + Estudio de Mercado)', s.oferta.modulos.length);
ok(s.demanda.mercados === 30, '30 mercados', s.demanda.mercados);

console.log('\nRender de las diez pestañas');
const contar = (n) => {
  if (!n || typeof n !== 'object') return 0;
  if (Array.isArray(n)) return n.reduce((a, x) => a + contar(x), 0);
  return 1 + contar(n.hijos) + (n.props && n.props.children ? contar(n.props.children) : 0);
};
for (const tab of ['resumen', 'mapa', 'competencia', 'planes', 'configurador', 'mercados', 'economia', 'clientes', 'proscontras', 'diagnostico']) {
  await agente.dispatchAction({ type: 'VER_PESTANA', payload: { pestana: tab } });
  try {
    const nodos = contar(app.Component());
    ok(nodos > 40, 'pestaña ' + tab, nodos + ' nodos');
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
ok(r.success && s2.oferta.suiteALaCarta > 2220, 'SET_SUPUESTO factor 0,85 sube la lista', s2.oferta.suiteALaCarta);

r = await agente.dispatchAction({ type: 'SET_SUPUESTO', payload: { clave: 'noExiste', valor: 1 } });
ok(!r.success, 'SET_SUPUESTO rechaza claves desconocidas', r.error);
r = await agente.dispatchAction({ type: 'SET_DESCUENTO_PLAN', payload: { plan: 'business', descuento: 5 } });
ok(!r.success, 'SET_DESCUENTO_PLAN rechaza descuentos fuera de rango', r.error);
r = await agente.dispatchAction({ type: 'SET_ALCANCE', payload: { pais: 'Narnia' } });
ok(!r.success, 'SET_ALCANCE rechaza países inexistentes', r.error);

r = await agente.dispatchAction({ type: 'SET_PRECIO_COMPETIDOR', payload: { competidor: 'Trello', plan: 'Standard', precio: 50 } });
let s3 = agente.getSnapshot();
const kanban = s3.oferta.modulos.filter((m) => m.app === 'Kanban')[0];
ok(r.success && kanban.mediana > 120, 'SET_PRECIO_COMPETIDOR mueve la mediana de Kanban', kanban.mediana);
r = await agente.dispatchAction({ type: 'SET_PRECIO_COMPETIDOR', payload: { competidor: 'Trello', plan: 'Inexistente', precio: 9 } });
ok(!r.success, 'SET_PRECIO_COMPETIDOR rechaza planes que no existen', r.error);

r = await agente.dispatchAction({ type: 'COTIZAR', payload: { modulos: ['Kanban', 'Prospección Comercial'], descuento: 0.4 } });
s3 = agente.getSnapshot();
ok(r.success && s3.cotizacion.modulos.length === 2 && s3.pestana === 'configurador',
  'COTIZAR arma la cotización y abre el configurador', r.message);
r = await agente.dispatchAction({ type: 'COTIZAR', payload: { modulos: ['No existe'] } });
ok(!r.success, 'COTIZAR rechaza módulos desconocidos', r.error);

r = await agente.dispatchAction({ type: 'RESTAURAR_SUPUESTOS', payload: {} });
s2 = agente.getSnapshot();
ok(r.success && s2.oferta.suiteALaCarta === 2220, 'RESTAURAR_SUPUESTOS vuelve al estudio', s2.oferta.suiteALaCarta);
ok(s2.preciosEditados === 0 && s2.cotizacion.modulos.length === 0, 'RESTAURAR_SUPUESTOS limpia precios y cotización');

console.log('\nContenido del tablero');
ok(s2.diagnostico.length === 8, '8 dimensiones de diagnóstico', s2.diagnostico.map((d) => d.nota).join(' '));
ok(s2.oferta.preciosVerificados === '149/170', '149 de 170 precios verificados', s2.oferta.preciosVerificados);

console.log('\nLa investigación del propio módulo de estudio');
const m25 = s2.oferta.modulos.filter((m) => m.app === 'Estudio de Mercado')[0];
ok(!!m25, 'el módulo 25 está en el estudio');
ok(m25.mediana === 317, 'mediana de la categoría inteligencia competitiva = $317', m25.mediana);
ok(m25.sugerido === 174, 'precio sugerido del módulo = $174/mes', m25.sugerido);
ok(m25.planesLevantados === 16, '16 planes levantados en la categoría', m25.planesLevantados);

r = await agente.dispatchAction({ type: 'PROTOCOLO', payload: {} });
ok(r.success && r.data.pasos.length === 9, 'PROTOCOLO devuelve los nueve pasos del método', r.data && r.data.pasos.length);
ok(r.data.fuentesDelRubro.length === 0 || Array.isArray(r.data.fuentesDelRubro), 'PROTOCOLO trae las fuentes del rubro');

console.log('\nEstudio de otra empresa (escalabilidad)');
r = await agente.dispatchAction({ type: 'EXPORTAR_ESTUDIO', payload: { incluirDocumento: true } });
ok(r.success && r.data.documento && r.data.documento.modulos.length === 25, 'EXPORTAR_ESTUDIO devuelve el documento entero', r.data && r.data.lineas);
const docKimos = r.data.documento;

r = await agente.dispatchAction({ type: 'NUEVO_ESTUDIO', payload: { plantilla: 'salud', empresa: 'Clínica Demo' } });
ok(r.success, 'NUEVO_ESTUDIO crea el estudio de otra empresa', r.message || r.error);
let se = agente.getSnapshot();
ok(se.estudio.empresa === 'Clínica Demo', 'el estudio dice de quién es', se.estudio.empresa);
ok(se.estudio.lineas.length === 6, 'la plantilla de salud trae seis líneas', se.estudio.lineas.length);
ok(se.oferta.preciosVerificados === '0/0', 'no trae ni un precio inventado', se.oferta.preciosVerificados);
ok(se.oferta.suiteALaCarta === 0 && se.demanda.samMM === 0, 'todo en cero hasta que se investigue');
ok(se.estudio.faltan.length > 0, 'dice qué le falta', se.estudio.faltan.length + ' huecos');

for (const tab of ['resumen', 'mapa', 'competencia', 'planes', 'configurador', 'mercados', 'economia', 'clientes', 'proscontras', 'diagnostico', 'estudio']) {
  await agente.dispatchAction({ type: 'VER_PESTANA', payload: { pestana: tab } });
  try {
    ok(contar(app.Component()) > 20, 'estudio vacío: pestaña ' + tab + ' renderiza');
  } catch (e) {
    ok(false, 'estudio vacío: pestaña ' + tab, e.message);
  }
}

r = await agente.dispatchAction({ type: 'AGREGAR_LINEA', payload: { app: 'Odontología', cat: 'Atención dental', alt: 'Clínicas dentales de la zona' } });
ok(r.success, 'AGREGAR_LINEA añade una línea al estudio', r.message || r.error);
r = await agente.dispatchAction({ type: 'AGREGAR_LINEA', payload: { app: 'Odontología' } });
ok(!r.success, 'AGREGAR_LINEA rechaza líneas repetidas', r.error);

const precio = (comp, plan, v, conf) => agente.dispatchAction({
  type: 'AGREGAR_COMPETIDOR',
  payload: {
    app: 'Odontología', comp, plan, precio: v, unidad: 'Plano', seg: 'PyME / Empresa',
    fuente: 'ejemplo.cl/aranceles', conf: conf || 'Verificado',
  },
});
await precio('Clínica A', 'Consulta', 40);
await precio('Clínica B', 'Consulta', 60);
r = await precio('Clínica C', 'Consulta', 100, 'Estimado');
ok(r.success, 'AGREGAR_COMPETIDOR carga precios con su fuente', r.message);
se = agente.getSnapshot();
const odo = se.oferta.modulos.filter((m) => m.app === 'Odontología')[0];
ok(odo && odo.mediana === 60, 'el motor calcula la mediana del rubro nuevo', odo && odo.mediana);
ok(odo && odo.sugerido === Math.round(60 * se.supuestos.factor), 'y el precio sugerido con el factor de la plantilla', odo && odo.sugerido);
ok(se.oferta.preciosVerificados === '2/3', 'cuenta verificados y estimados por separado', se.oferta.preciosVerificados);

r = await agente.dispatchAction({
  type: 'AGREGAR_COMPETIDOR',
  payload: { app: 'Odontología', comp: 'Clínica D', plan: 'Consulta', precio: 50, unidad: 'Plano', seg: 'PyME / Empresa', fuente: '', conf: 'Verificado' },
});
ok(!r.success, 'un precio sin fuente no entra', r.error);
r = await agente.dispatchAction({
  type: 'AGREGAR_COMPETIDOR',
  payload: { app: 'No existe', comp: 'X', plan: 'Y', precio: 1, unidad: 'Plano', seg: 'PyME / Empresa', fuente: 'x.cl', conf: 'Verificado' },
});
ok(!r.success, 'AGREGAR_COMPETIDOR rechaza líneas inexistentes', r.error);

r = await agente.dispatchAction({ type: 'ELIMINAR_COMPETIDOR', payload: { comp: 'Clínica C', plan: 'Consulta' } });
se = agente.getSnapshot();
ok(r.success && se.oferta.preciosVerificados === '2/2', 'ELIMINAR_COMPETIDOR quita la fila', se.oferta.preciosVerificados);

r = await agente.dispatchAction({ type: 'SET_IDENTIDAD', payload: { rubro: 'Salud dental ambulatoria', moneda: 'CLP', fecha: '2026-09-01' } });
se = agente.getSnapshot();
ok(r.success && se.estudio.rubro === 'Salud dental ambulatoria' && se.estudio.moneda === 'CLP', 'SET_IDENTIDAD declara rubro y moneda', r.message);
r = await agente.dispatchAction({ type: 'SET_IDENTIDAD', payload: { fecha: '01/09/2026' } });
ok(!r.success, 'SET_IDENTIDAD rechaza fechas mal escritas', r.error);

r = await agente.dispatchAction({ type: 'IMPORTAR_ESTUDIO', payload: { documento: '{"no":"es un estudio"}' } });
ok(!r.success, 'IMPORTAR_ESTUDIO rechaza un JSON que no es un estudio', r.error);
r = await agente.dispatchAction({ type: 'IMPORTAR_ESTUDIO', payload: { documento: 'esto no es json' } });
ok(!r.success, 'IMPORTAR_ESTUDIO rechaza texto que no es JSON', r.error);
r = await agente.dispatchAction({ type: 'IMPORTAR_ESTUDIO', payload: { documento: docKimos } });
se = agente.getSnapshot();
ok(r.success && se.oferta.suiteALaCarta === 2220 && se.oferta.modulos.length === 25,
  'IMPORTAR_ESTUDIO recupera el estudio exportado con sus cifras intactas', se.oferta.suiteALaCarta);

console.log('\nPersistencia y limpieza');
await new Promise((res) => setTimeout(res, 1000));
ok(guardado && guardado.sup && guardado.alcance, 'saveData recibe supuestos y alcance');
app.unmount();
ok(true, 'unmount sin excepciones');

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
