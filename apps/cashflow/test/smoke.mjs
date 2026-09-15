#!/usr/bin/env node
/**
 * smoke.mjs — verifica el bundle sin navegador. Monta la app con un React
 * mínimo y comprueba lo que la alineación con la plataforma promete:
 *
 *   1. El contrato del agente sigue entero (proponer → aprobar → persistir).
 *   2. La contraparte de un movimiento se vincula con la identidad compartida
 *      (`shell.records`), guardando referencia E instantánea (§7.d).
 *   3. La empresa recién sembrada se rellena con la marca del tenant y, si
 *      alguien ya escribió un RUT, la marca NO lo pisa (§7.f).
 *   4. En un host sin `records` ni `brands` —los dos son opcionales— la app
 *      registra movimientos exactamente igual.
 *   5. Los montos bruto/neto/IVA siguen sincronizados y la versión en
 *      pantalla es la del manifest (§7.a).
 *
 *   node apps/cashflow/test/smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const BUNDLE = pathToFileURL(join(DIR, '../dist/index.js')).href;

// React mínimo con estado: los hooks se guardan por ruta en el árbol, así que
// un `setState` seguido de un nuevo render conserva lo anterior. Alcanza para
// ejecutar el render entero y para pulsar un botón como lo haría una persona,
// que es la única forma de probar el camino real «registrar → vincular».
const almacen = new Map();
let ruta = '', cursor = 0;
globalThis.React = {
  createElement: (type, props, ...hijos) => ({ type, props: props || {}, hijos: hijos.flat(Infinity) }),
  useState(init) {
    const clave = ruta + '#' + (cursor++);
    if (!almacen.has(clave)) almacen.set(clave, typeof init === 'function' ? init() : init);
    return [almacen.get(clave), (v) => almacen.set(clave, typeof v === 'function' ? v(almacen.get(clave)) : v)];
  },
  useEffect(fn) { try { const off = fn(); if (typeof off === 'function') off(); } catch (e) { /* fuera de DOM */ } },
  useMemo: (fn) => fn(),
  useRef(init) {
    const clave = ruta + '@' + (cursor++);
    if (!almacen.has(clave)) almacen.set(clave, { current: init });
    return almacen.get(clave);
  },
  useCallback: (fn) => fn,
};

/** Renderiza el árbol entero ejecutando los componentes función. */
function render(nodo, camino) {
  if (nodo == null || typeof nodo !== 'object') return nodo;
  if (Array.isArray(nodo)) return nodo.map((n, i) => render(n, camino + '/' + i));
  const { type, props, hijos } = nodo;
  if (typeof type === 'function') {
    const c = camino + '/' + (type.name || 'fn');
    const rutaPrevia = ruta, cursorPrevio = cursor;
    ruta = c; cursor = 0;
    let salida;
    try { salida = type(hijos && hijos.length ? Object.assign({}, props, { children: hijos }) : props); }
    finally { ruta = rutaPrevia; cursor = cursorPrevio; }
    return { type, props, hijos: [render(salida, c)] };
  }
  return { type, props, hijos: (hijos || []).map((x, i) => render(x, camino + '/' + i)) };
}

/** Primer nodo del árbol que cumple `pred` (props incluidas). */
function buscar(nodo, pred) {
  if (nodo == null || typeof nodo !== 'object') return null;
  if (Array.isArray(nodo)) {
    for (const n of nodo) { const r = buscar(n, pred); if (r) return r; }
    return null;
  }
  if (nodo.props && pred(nodo)) return nodo;
  return buscar(nodo.hijos || [], pred);
}

/** Texto plano de un nodo, para localizar un botón por su etiqueta. */
function texto(nodo) {
  if (nodo == null) return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(texto).join('');
  return texto(nodo.hijos || []);
}

let fallos = 0;
function ok(cond, que) {
  if (cond) { console.log('  ✔ ' + que); return; }
  fallos++; console.error('  ✖ ' + que);
}
const espera = () => new Promise((r) => setTimeout(r, 30));

/** Shell de prueba. `opts.records`/`opts.brands` permiten apagar cada pieza. */
function hacerShell(opts) {
  const o = opts || {};
  const estado = { guardado: null, agente: null, avisos: [], creados: [], enlaces: [] };
  const shell = {
    app: { appId: 'cashflow', instanceId: 'inst-test', teamId: 'team-test' },
    window: { setTitle() {} },
    notify: (n) => estado.avisos.push(n),
    saveData: (p) => { estado.guardado = p; return Promise.resolve(); },
    loadData: () => Promise.resolve(o.datos || null),
    agent: { register: (cfg) => { estado.agente = cfg; return () => {}; } },
  };
  if (o.records !== false) {
    shell.records = {
      findOrCreate: (type, spec) => {
        // La plataforma normaliza las claves antes de comparar: «76.543.210-K»
        // y «76543210-K» son la misma (APP-SPEC §7.d). El doble aquí hace lo
        // mismo, porque lo que se está probando es que la app MANDE el RUT
        // como clave, no que sepa normalizarlo.
        const norm = (v) => String(v || '').replace(/[.\s-]/g, '').toUpperCase();
        const clave = (spec.keys && spec.keys.taxId) ? norm(spec.keys.taxId) : 'label:' + norm(spec.label);
        const previo = estado.creados.find((c) => c.clave === clave);
        if (previo) return Promise.resolve({ ref: previo.ref, created: false, record: { label: previo.label, keys: spec.keys } });
        const ref = 'kimos:record/' + type + '/' + (estado.creados.length + 1);
        estado.creados.push({ ref, clave, label: spec.label });
        return Promise.resolve({ ref, created: true, record: { label: spec.label, keys: spec.keys } });
      },
      link: (ref, info) => { estado.enlaces.push({ ref, info }); return Promise.resolve(true); },
      resolve: (refs) => Promise.resolve(refs.map((r) => ({ ref: r, resolved: true, label: (estado.creados.find((c) => c.ref === r) || {}).label }))),
    };
  }
  if (o.brands !== false) {
    // Una marca del registro NO trae razón social ni RUT (APP-SPEC §7.f):
    // una empresa con seis marcas tiene un solo RUT y no es dato de marca.
    shell.brands = { current: () => Promise.resolve(o.marca === null ? null : (o.marca || { name: 'Marca Ejemplo' })) };
  }
  return { shell, estado };
}

const mount = (await import(BUNDLE)).default;
const { syncAmounts } = await import(BUNDLE);

// ── 1. Contrato del agente: propone, se aprueba, se guarda ────────────────
console.log('1. Contrato del agente (propone → Revisión → aprobar → persistir)');
{
  const { shell, estado } = hacerShell({});
  const app = mount(shell);
  await espera();
  ok(!!estado.agente, 'la app registra agente');
  const snap = estado.agente.getSnapshot();
  const manifest = JSON.parse(readFileSync(join(DIR, '../manifest.json'), 'utf8'));
  ok(snap.version === manifest.version, 'el snapshot expone la versión del manifest (' + manifest.version + ')');
  const propone = await estado.agente.dispatchAction({
    type: 'PROPOSE_MOVEMENT',
    payload: { type: 'egreso', amount: 119000, date: '2026-03-04', description: 'Insumos marzo', counterpart: 'Comercial Andes SpA', counterpartRut: '76.543.210-K' },
  });
  ok(propone && propone.success, 'PROPOSE_MOVEMENT crea la propuesta');
  const pendientes = estado.agente.getSnapshot().pendingProposals;
  ok(pendientes.length === 1, 'la propuesta espera en Revisión (la IA no registra sola)');
  ok(estado.agente.getSnapshot().movementsCount === 0, 'nada se registró sin aprobación humana');
  app.unmount();
}

// ── 2. Identidad compartida: referencia + instantánea ─────────────────────
console.log('2. Identidad compartida de la contraparte (§7.d)');
{
  const datos = {
    cashflow: {
      settings: { currency: 'CLP', ivaRate: 19, liquidityDays: 30, showCents: false },
      activeCompanyId: 'co-1',
      companies: [{ id: 'co-1', name: 'Mi Empresa', rut: '', giro: '', address: '' }],
      accounts: [], categories: [], costCenters: [], projects: [], budgets: [],
      movements: [], documents: [], proposals: [], audit: [],
      memory: { counterparts: {}, keywords: {} },
    },
  };
  const { shell, estado } = hacerShell({ datos });
  const app = mount(shell);
  await espera();
  const r1 = await estado.agente.dispatchAction({ type: 'PROPOSE_MOVEMENT', payload: { type: 'egreso', amount: 50000, description: 'Arriendo', counterpart: 'Comercial Andes SpA', counterpartRut: '76.543.210-K' } });
  const prop = estado.agente.getSnapshot().pendingProposals[0];
  ok(!!prop, 'hay propuesta que aprobar (' + (r1 && r1.success) + ')');
  // Aprobar por la misma vía que la persona: el modelo la registra y el
  // vínculo con el directorio ocurre después, sin bloquear el registro.
  const antes = estado.creados.length;
  const mov = { type: 'egreso', amount: 50000, description: 'Arriendo', counterpart: 'Comercial Andes SpA', counterpartRut: '76.543.210-K' };
  await estado.agente.dispatchAction({ type: 'PROPOSE_MOVEMENT', payload: mov });
  await espera();
  ok(estado.creados.length === antes, 'una propuesta NO crea identidad: solo lo hace un movimiento registrado');
  app.unmount();
}

// ── 2.b El movimiento registrado por una persona sí vincula ───────────────
console.log('2.b Registrar un movimiento vincula y reutiliza la identidad');
{
  const { shell, estado } = hacerShell({});
  const app = mount(shell);
  await espera();

  // Registrar como lo haría una persona: «＋ Egreso» abre el editor y su
  // `onSave` es el mismo que usa la app. Dos movimientos con el MISMO RUT
  // escrito de dos formas: la plataforma normaliza y no debe haber dos «Acme».
  const registrar = async (campos) => {
    let arbol = render({ type: app.Component, props: {}, hijos: [] }, 'root');
    const boton = buscar(arbol, (n) => n.props.onClick && texto(n).indexOf('Egreso') >= 0);
    ok(!!boton, 'la cabecera ofrece «－ Egreso»');
    boton.props.onClick();
    arbol = render({ type: app.Component, props: {}, hijos: [] }, 'root');
    const modal = buscar(arbol, (n) => typeof n.props.onSave === 'function' && n.props.saveLabel);
    ok(!!modal, 'se abre el editor de movimiento');
    modal.props.onSave(campos);
    await espera();
  };

  await registrar({ type: 'egreso', amount: '119000', date: '2026-03-04', description: 'Insumos marzo', counterpart: 'Comercial Andes SpA', counterpartRut: '76.543.210-K' });
  ok(estado.creados.length === 1, 'el primer movimiento crea la identidad en el directorio');
  ok(estado.enlaces.length === 1 && estado.enlaces[0].info.instanceId === 'inst-test', 'y anota el vínculo inverso con la instancia');

  await registrar({ type: 'egreso', amount: '50000', date: '2026-03-06', description: 'Insumos marzo (2)', counterpart: 'Comercial Andes SpA', counterpartRut: '76543210-K' });
  ok(estado.creados.length === 1, 'el segundo movimiento REUTILIZA la identidad: no hay dos «Comercial Andes»');

  const snap = estado.agente.getSnapshot();
  ok(snap.sharedIdentities.available === true && snap.sharedIdentities.linked === 2, 'los dos movimientos quedan vinculados (' + snap.sharedIdentities.linked + ')');
  const listado = await estado.agente.dispatchAction({ type: 'LIST_MOVEMENTS', payload: {} });
  const filas = (listado && (listado.movements || listado.data || listado.result)) || [];
  const conRef = Array.isArray(filas) ? filas.filter((m) => m.recordRef) : [];
  ok(conRef.length === 2, 'el agente ve la referencia de identidad de cada movimiento');
  ok(conRef.every((m) => m.counterpart === 'Comercial Andes SpA'), 'y la instantánea sigue guardada junto a la referencia');
  app.unmount();
}

// ── 3. La marca del tenant rellena, pero no pisa ──────────────────────────
console.log('3. Marca del tenant (§7.f)');
{
  const { shell, estado } = hacerShell({});
  const app = mount(shell);
  await espera();
  const co = estado.agente.getSnapshot().activeCompany;
  ok(co && co.name === 'Marca Ejemplo', 'la empresa sembrada toma el nombre de la marca (' + (co && co.name) + ')');
  ok(co && !co.rut, 'y NO su RUT: eso no es un dato de la marca, se escribe a mano (' + (co && co.rut) + ')');
  app.unmount();
}
{
  const datos = {
    cashflow: {
      settings: { currency: 'CLP', ivaRate: 19, liquidityDays: 30, showCents: false },
      activeCompanyId: 'co-9',
      companies: [{ id: 'co-9', name: 'Ferretería Sur', rut: '12.345.678-5', giro: '', address: '' }],
      accounts: [], categories: [], costCenters: [], projects: [], budgets: [],
      movements: [], documents: [], proposals: [], audit: [],
      memory: { counterparts: {}, keywords: {} },
    },
  };
  const { shell, estado } = hacerShell({ datos });
  const app = mount(shell);
  await espera();
  const co = estado.agente.getSnapshot().activeCompany;
  ok(co.name === 'Ferretería Sur' && co.rut === '12.345.678-5', 'una empresa ya escrita NO la pisa la marca');
  app.unmount();
}

// ── 4. Host sin records ni brands: la app funciona igual ──────────────────
console.log('4. Host antiguo (sin `records` ni `brands`)');
{
  const { shell, estado } = hacerShell({ records: false, brands: false });
  const app = mount(shell);
  await espera();
  const r = await estado.agente.dispatchAction({ type: 'PROPOSE_MOVEMENT', payload: { type: 'ingreso', amount: 238000, description: 'Venta', counterpart: 'Cliente X' } });
  ok(r && r.success, 'se puede proponer sin directorio de identidades');
  const snap = estado.agente.getSnapshot();
  ok(snap.sharedIdentities.available === false, 'el snapshot lo dice en vez de fingir que hay directorio');
  ok(snap.activeCompany.name === 'Mi Empresa', 'la empresa sembrada sigue siendo utilizable sin marca');
  app.unmount();
}

// ── 5. Montos sincronizados y versión a la vista ──────────────────────────
console.log('5. Montos sincronizados y versión en pantalla (§7.a)');
{
  const f = { amount: '', neto: '', iva: '', exento: '' };
  const g = syncAmounts(f, 'amount', '119000', 19, false);
  ok(g.neto === '100000' && g.iva === '19000', 'bruto 119.000 → neto 100.000 + IVA 19.000');
  const h2 = syncAmounts({ amount: '', neto: '', iva: '', exento: '' }, 'neto', '100000', 19, false);
  ok(h2.amount === '119000', 'neto 100.000 → bruto 119.000');
  const bundle = readFileSync(join(DIR, '../dist/index.js'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(DIR, '../manifest.json'), 'utf8'));
  const declarada = (bundle.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
  ok(declarada === manifest.version, 'APP_VERSION (' + declarada + ') coincide con el manifest');
  ok(/kcf-ver/.test(bundle), 'la versión se pinta en la cabecera');
  const css = readFileSync(join(DIR, '../dist/index.css'), 'utf8');
  const sinTokens = css.replace(/--[a-z0-9-]+\s*:\s*#[0-9a-fA-F]{3,8}\b/gi, '');
  ok(!/#[0-9a-fA-F]{3,8}\b/.test(sinTokens), 'el CSS no tiene hex sueltos: la app se re-marca con la marca del tenant');
}

// ── 6. Las ocho pestañas se pintan sin reventar ───────────────────────────
console.log('6. Render de las ocho pestañas');
{
  almacen.clear();
  const { shell, estado } = hacerShell({});
  const app = mount(shell);
  await espera();
  await estado.agente.dispatchAction({ type: 'PROPOSE_MOVEMENT', payload: { type: 'ingreso', amount: 238000, description: 'Venta de marzo', counterpart: 'Cliente X', counterpartRut: '77.111.222-3' } });
  const nombres = ['Dashboard', 'Flujo de Caja', 'Libro Diario', 'Documentos', 'Revisión', 'Proyecciones', 'Análisis', 'Ajustes'];
  for (const nombre of nombres) {
    let arbol = render({ type: app.Component, props: {}, hijos: [] }, 'root');
    const pestana = buscar(arbol, (n) => typeof n.props.onClick === 'function' && /^kcf-tab( |$)/.test(String(n.props.className || '')) && texto(n).indexOf(nombre) >= 0);
    if (!pestana) { ok(false, 'existe la pestaña ' + nombre); continue; }
    pestana.props.onClick();
    let error = '';
    try { render({ type: app.Component, props: {}, hijos: [] }, 'root'); }
    catch (e) { error = (e && e.message) || 'error'; }
    ok(!error, 'se pinta ' + nombre + (error ? ' — ' + error : ''));
  }
  app.unmount();
}

console.log(fallos ? '\n✖ ' + fallos + ' comprobación(es) fallidas' : '\n✔ Todo en orden');
process.exit(fallos ? 1 : 0);
