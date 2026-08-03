// Banco de pruebas de KIMOS WorldSkin.
//
// El paquete no es un módulo: son fragmentos que la app anfitriona concatena en
// su propio ámbito. Así que aquí se hace lo mismo —concatenar y ejecutar en una
// función con los símbolos que el contrato exige del anfitrión— y se prueba lo
// que de verdad importa: que el mundo aguante datos imposibles sin romperse,
// que las mutaciones sean puras, que la simulación sea determinista y que las
// garantías de docs/CONTRATO.md se cumplan de verdad.
//
//   node packages/kimos-worldskin/test/test-worldskin.mjs

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const pkg = path.join(here, '..');
const srcDir = path.join(pkg, 'src');
const repo = path.join(pkg, '..', '..');

// ── Utilidades de test ───────────────────────────────────────────────────
let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; return true; }
  failures.push(name + (detail ? ' — ' + detail : ''));
  return false;
}
const eq = (name, a, b) => check(name, a === b, 'esperado ' + JSON.stringify(b) + ', recibido ' + JSON.stringify(a));
const near = (name, a, b, tol) => check(name, Math.abs(a - b) <= tol, 'esperado ≈' + b + ', recibido ' + a);
const J = (x) => JSON.stringify(x);

// ── Entorno mínimo que el contrato exige del anfitrión ───────────────────
const h = (t, p, ...c) => ({ t, p: p || {}, c: c.length === 1 ? c[0] : c });
const cx = (...xs) => xs.filter(Boolean).join(' ');
let effects = [];
const useState = (v) => [typeof v === 'function' ? v() : v, () => {}];
const useEffect = (fn, deps) => { effects.push({ fn, deps }); };
const refs = [];
let refIdx = 0;
const useRef = (v) => { if (!refs[refIdx]) refs[refIdx] = { current: v }; return refs[refIdx++]; };

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
const sources = files.map((f) => ({ name: f, code: fs.readFileSync(path.join(srcDir, f), 'utf8') }));
const EXPORTS = ['WS_VERSION', 'WS_GRID_MAX', 'WS_AREAS_MAX', 'WS_STAFF_MAX', 'WS_SPEED', 'WS_TICK_MAX',
  'THEME_FORMS', 'CLASSIC_MODES', 'GAME_MODES', 'WS_DEPARTMENTS', 'WS_STRUCTURES',
  'resolveTheme', 'themeVars', 'emptyTheme', 'modeForHour', 'wsRegisterDepartment',
  'wsDepartmentById', 'wsStructureById', 'wsStructureName', 'wsHash',
  'wsEmptyWorld', 'wsMigrateWorld', 'wsFits', 'wsFindSpot', 'wsAddArea', 'wsUpdateArea', 'wsRemoveArea',
  'wsAddStation', 'wsUpdateStation', 'wsRemoveStation', 'wsAddStaff', 'wsUpdateStaff', 'wsRemoveStaff',
  'wsResizeGrid', 'wsSeedWorld', 'wsWorldSummary',
  'wsSimInit', 'wsSimStep', 'wsSimSay', 'wsAvatarColors', 'wsAreaCenter', 'wsStationPos',
  'wsProjector', 'wsAreaShape', 'WsStructure', 'WsAvatar', 'WsWorldSurface'];

const body = sources.map((x) => x.code).join('\n')
  + '\nreturn { ' + EXPORTS.join(', ') + ' };\n';
// eslint-disable-next-line no-new-func
const ws = new Function('h', 'cx', 'useState', 'useEffect', 'useRef', body)(h, cx, useState, useEffect, useRef);

check('los cuatro fragmentos están presentes', files.length === 4, files.join(', '));
check('el paquete se ejecuta con solo los símbolos del contrato', typeof ws.wsEmptyWorld === 'function');
eq('versión del paquete', ws.WS_VERSION, '1.0.0');

// ── 1. Formas, modos y paletas ───────────────────────────────────────────
eq('dos formas', ws.THEME_FORMS.length, 2);
eq('cuatro modos clásicos', ws.CLASSIC_MODES.length, 4);
eq('tres ambientaciones de juego', ws.GAME_MODES.length, 3);

eq('la madrugada es noche', ws.modeForHour(3), 'night');
eq('las 7 ya son de día', ws.modeForHour(7), 'day');
eq('las 17:00 siguen siendo de día', ws.modeForHour(17), 'day');
eq('las 18:00 son atardecer', ws.modeForHour(18), 'sunset');
eq('las 21:00 son noche', ws.modeForHour(21), 'night');
eq('una hora imposible no rompe', ws.modeForHour('cualquier cosa'), 'day');

{
  const t = ws.resolveTheme({ form: 'classic', classicMode: 'live' }, 20);
  eq('el modo Vivo se declara vivo', t.live, true);
  eq('el modo Vivo a las 20:00 pinta atardecer', t.effectiveId, 'sunset');
  const g = ws.resolveTheme({ form: 'game', gameMode: 'jabotel' }, 3);
  eq('la forma juego resuelve su ambientación', g.modeId, 'jabotel');
  eq('el hotel es isométrico', g.world.kind, 'hotel');
  eq('un tema corrupto cae en algo utilizable', ws.resolveTheme({ form: 'ﬀ', classicMode: 'ﬀ' }, 12).formId, 'classic');
  eq('un tema nulo también', ws.resolveTheme(null, 12).formId, 'classic');
}

{
  // Regresión: en una revisión anterior se colaron valores de color rotos
  // (`#527architecture`) que el navegador ignora en silencio.
  const bad = [];
  const walk = (obj0, where) => {
    for (const [k, v] of Object.entries(obj0 || {})) {
      if (typeof v === 'string' && v.startsWith('#') && !/^#[0-9a-fA-F]{3,8}$/.test(v)) bad.push(where + '.' + k + ' = ' + v);
      else if (v && typeof v === 'object') walk(v, where + '.' + k);
    }
  };
  for (const m of ws.CLASSIC_MODES) walk(m.tokens, m.id);
  for (const m of ws.GAME_MODES) { walk(m.tokens, m.id); walk(m.decor, m.id + '.decor'); }
  for (const d of ws.WS_DEPARTMENTS) walk({ color: d.color }, d.id);
  check('todos los colores de las paletas son hexadecimales válidos', bad.length === 0, bad.join(' · '));
}

{
  const vars = ws.themeVars(ws.resolveTheme({ form: 'game', gameMode: 'kimoslab' }, 12));
  check('themeVars produce variables CSS', vars['--ks-bg'] && vars['--ks-ground'] && vars['--ks-gamefont'], J(vars));
  eq('themeVars con basura no revienta', Object.keys(ws.themeVars(null)).length, 0);
}

// ── 2. Departamentos y estructuras ───────────────────────────────────────
check('el catálogo cubre los departamentos de una empresa real',
  ['rrhh', 'finanzas', 'marketing', 'produccion', 'contabilidad', 'ventas']
    .every((id) => ws.WS_DEPARTMENTS.some((d) => d.id === id)),
  ws.WS_DEPARTMENTS.map((d) => d.id).join(', '));
eq('un departamento desconocido cae en uno válido', ws.wsDepartmentById('inventado').id, 'direccion');
{
  const r = ws.wsRegisterDepartment({ id: 'I+D', label: 'Innovación', emoji: '🧪', color: '#123456' });
  eq('se puede dar de alta un departamento propio', r.id, 'i-d');
  eq('y queda recuperable', ws.wsDepartmentById('i-d').label, 'Innovación');
  let threw = false;
  try { ws.wsRegisterDepartment({ label: 'sin id' }); } catch (e) { threw = true; }
  check('un departamento sin id se rechaza', threw);
}
// Cada estructura se llama distinto en cada ambientación: es lo que hace que
// el mismo modelo se lea como villa, hotel o territorio.
{
  const names = ws.WS_STRUCTURES.map((x) => [x.village, x.hotel, x.territory]);
  check('cada estructura tiene nombre en las tres ambientaciones',
    names.every((n) => n.every((x) => typeof x === 'string' && x.length > 2)));
  eq('la sede es «recepción» en el hotel', ws.wsStructureName('hq', 'hotel'), 'recepción');
  eq('y «centro de mando» en el territorio', ws.wsStructureName('hq', 'territory'), 'centro de mando');
  eq('en el plano se usa el nombre neutro', ws.wsStructureName('hq', 'plan'), 'Sede');
}

// ── 3. El mundo aguanta cualquier cosa ───────────────────────────────────
{
  const w = ws.wsMigrateWorld(undefined);
  eq('un mundo indefinido sale vacío y válido', ws.wsWorldSummary(w).areas, 0);
  const w2 = ws.wsMigrateWorld({ grid: { w: 9999, h: -4 }, areas: 'no soy un array', staff: 42 });
  check('la rejilla se acota', w2.grid.w === ws.WS_GRID_MAX && w2.grid.h === 6, J(w2.grid));
  const w3 = ws.wsMigrateWorld({
    grid: { w: 10, h: 10 },
    areas: [{ id: 'a1', name: 'Área', departmentId: 'ventas', structure: 'shop', x: 99, y: 99, w: 2, h: 1,
      stations: [{ id: 's1', name: 'P1' }] }],
    staff: [{ id: 'p1', name: 'Huérfano', kind: 'ai', areaId: 'no-existe', stationId: 'tampoco' }],
  });
  check('un área fuera del mapa se recoloca dentro', w3.areas[0].x < 10 && w3.areas[0].y < 10, J(w3.areas[0]));
  eq('el personal huérfano se reubica en un área real', w3.staff[0].areaId, 'a1');
  eq('y en un puesto real', w3.staff[0].stationId, 's1');
}

// ── 4. Mutaciones: puras, acotadas y explicadas ──────────────────────────
let W = ws.wsEmptyWorld();
{
  const before = J(W);
  const r = ws.wsAddArea(W, { departmentId: 'marketing', name: 'Marketing', structure: 'office' });
  check('añadir área funciona', r.ok, J(r));
  eq('no muta la entrada', J(W), before);
  check('el mensaje dice dónde ha caído', /\(\d+,\d+\)/.test(r.message), r.message);
  W = r.world;
}
{
  const r = ws.wsAddArea(W, { departmentId: 'produccion', name: 'Producción', structure: 'factory' });
  W = r.world;
  const a = W.areas[0]; const b = W.areas[1];
  check('dos áreas no se solapan',
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, J([a, b]));
  check('y quedan separadas por al menos una celda',
    b.x >= a.x + a.w + 1 || a.x >= b.x + b.w + 1 || b.y >= a.y + a.h + 1 || a.y >= b.y + b.h + 1, J([a, b]));

  const bad = ws.wsUpdateArea(W, b.id, { x: a.x, y: a.y });
  eq('mover un área encima de otra se rechaza', bad.ok, false);
  check('y el motivo nombra a la otra área', /Marketing/.test(bad.error), bad.error);
  eq('el mundo devuelto en el fallo es el de entrada', J(bad.world), J(W));

  const out = ws.wsUpdateArea(W, b.id, { x: 40 });
  eq('sacar un área del mapa se rechaza', out.ok, false);
  eq('editar un área inexistente se rechaza', ws.wsUpdateArea(W, 'fantasma', { name: 'x' }).ok, false);
}
{
  // Se puede referir a un área por su nombre: es lo que hace usable la tool
  // del agente sin obligarle a manejar identificadores opacos.
  const r = ws.wsUpdateArea(W, 'Marketing', { note: 'Campañas y contenidos' });
  check('las áreas se pueden nombrar por su nombre', r.ok, J(r));
  W = r.world;
  eq('la nota se guarda', W.areas[0].note, 'Campañas y contenidos');
}
{
  const r = ws.wsAddStation(W, W.areas[0].id, { name: 'Investigación', process: 'Mercado y competencia' });
  check('añadir puesto funciona', r.ok, J(r));
  W = r.world;
  eq('el área tiene ahora dos puestos', W.areas[0].stations.length, 2);
  const up = ws.wsUpdateStation(W, W.areas[0].id, W.areas[0].stations[1].id, { process: 'Tendencias' });
  check('editar puesto funciona', up.ok, J(up));
  W = up.world;
  eq('el proceso se guarda', W.areas[0].stations[1].process, 'Tendencias');
  const rm = ws.wsRemoveStation(W, W.areas[0].id, W.areas[0].stations[1].id);
  W = rm.world;
  eq('borrar puesto funciona', W.areas[0].stations.length, 1);
  eq('no se puede dejar un área sin puestos', ws.wsRemoveStation(W, W.areas[0].id, W.areas[0].stations[0].id).ok, false);
}
{
  const r = ws.wsAddStaff(W, { name: 'Ada', role: 'Estratega', kind: 'human', areaId: 'Marketing' });
  check('incorporar persona funciona', r.ok, J(r));
  W = r.world;
  eq('queda en el área pedida', W.staff[0].areaId, W.areas[0].id);
  eq('y en un puesto concreto', W.staff[0].stationId, W.areas[0].stations[0].id);

  const mv = ws.wsUpdateStaff(W, 'Ada', { areaId: 'Producción' });
  W = mv.world;
  eq('cambiar de área reasigna el puesto', W.staff[0].stationId, W.areas[1].stations[0].id);
  eq('mover a un área inexistente se rechaza', ws.wsUpdateStaff(W, 'Ada', { areaId: 'Marte' }).ok, false);
  eq('dar de baja a quien no existe se rechaza', ws.wsRemoveStaff(W, 'Nadie').ok, false);
}
{
  // Borrar un departamento no debe hacer desaparecer a su gente.
  const r = ws.wsRemoveArea(W, 'Producción');
  check('borrar área funciona', r.ok, J(r));
  check('el mensaje avisa de la reubicación', /reubicad/.test(r.message), r.message);
  eq('nadie desaparece con el área', r.world.staff.length, W.staff.length);
  eq('y acaba en el área que queda', r.world.staff[0].areaId, r.world.areas[0].id);
}
{
  const big = ws.wsResizeGrid(W, 24, 20);
  check('ampliar el mapa funciona', big.ok, J(big));
  // Se lleva un área al fondo del mapa ampliado y se intenta encoger sobre ella.
  const far = ws.wsUpdateArea(big.world, 'Producción', { x: 18, y: 15 });
  check('mover un área al fondo del mapa ampliado funciona', far.ok, J(far));
  const small = ws.wsResizeGrid(far.world, 8, 8);
  eq('encoger sobre un área ocupada se rechaza', small.ok, false);
  check('y el motivo dice cuáles estorban', /Producción/.test(small.error), small.error);
  eq('los límites del mapa se respetan', ws.wsResizeGrid(W, 500, 500).world.grid.w, ws.WS_GRID_MAX);
}
{
  // Cotas duras: un documento manipulado no puede pedir un mapa infinito.
  let w = ws.wsResizeGrid(ws.wsEmptyWorld(), 40, 40).world;
  let added = 0;
  for (let i = 0; i < ws.WS_AREAS_MAX + 5; i++) {
    const r = ws.wsAddArea(w, { departmentId: 'ti', structure: 'shop', name: 'A' + i });
    if (!r.ok) break;
    w = r.world; added++;
  }
  check('el número de áreas está acotado', added <= ws.WS_AREAS_MAX, 'creadas ' + added);
  check('y al llegar al tope se explica', !ws.wsAddArea(w, { departmentId: 'ti', structure: 'shop' }).ok);
}

// ── 5. Siembra desde el flujo de agentes ─────────────────────────────────
const PLAN = [
  { id: 'research', name: 'Research', n: 1, departmentId: 'marketing' },
  { id: 'director', name: 'Creative Director', n: 2, departmentId: 'direccion' },
  { id: 'storyboard', name: 'Storyboard', n: 3, departmentId: 'produccion' },
  { id: 'editor', name: 'Editor', n: 4, departmentId: 'produccion' },
  { id: 'huerfano', name: 'Sin depto', n: 5, departmentId: 'no-existe-aqui' },
];
const SEED = {
  appId: 'app-de-prueba',
  groups: [
    { departmentId: 'direccion', name: 'Dirección', structure: 'hq' },
    { departmentId: 'marketing', name: 'Marketing', structure: 'office' },
    { departmentId: 'produccion', name: 'Producción', structure: 'factory' },
  ],
  people: [
    { name: 'Ada', role: 'Estratega', departmentId: 'marketing' },
    { name: 'Bruno', role: 'Productor', departmentId: 'produccion' },
  ],
};
{
  const w = ws.wsSeedWorld(PLAN, SEED);
  const sum = ws.wsWorldSummary(w);
  eq('la siembra crea un área por grupo más la zona común', sum.areas, 4);
  check('siempre hay zona común', w.areas.some((a) => a.structure === 'plaza'), J(w.areas.map((a) => a.structure)));
  eq('todos los agentes del flujo entran como personal de IA', sum.agentes, PLAN.length);
  eq('y las personas también', sum.personas, SEED.people.length);
  check('cada agente queda enlazado a su nodo del flujo',
    PLAN.every((n) => w.staff.some((p) => p.agentId === n.id)));
  const research = w.staff.find((p) => p.agentId === 'research');
  const marketing = w.areas.find((a) => a.departmentId === 'marketing');
  eq('el agente va al departamento que declara', research.areaId, marketing.id);
  check('un agente con departamento inventado también encuentra sitio',
    !!w.staff.find((p) => p.agentId === 'huerfano').areaId);
  eq('la siembra anota de qué app viene', w.seededFrom, 'app-de-prueba');
  eq('sembrar sin flujo no rompe', ws.wsWorldSummary(ws.wsSeedWorld(null, {})).agentes, 0);
}

// ── 6. Simulación: pura, determinista y guiada por el flujo real ─────────
const WORLD = ws.wsSeedWorld(PLAN, SEED);
const statusOf = (id) => ({ research: 'running', director: 'done', storyboard: 'error', editor: 'off' })[id] || 'idle';
{
  const s0 = ws.wsSimInit(WORLD, null);
  eq('hay un avatar por cada persona y agente', s0.actors.length, WORLD.staff.length);
  check('todos empiezan dentro del mapa',
    s0.actors.every((a) => a.x >= 0 && a.y >= 0 && a.x <= WORLD.grid.w && a.y <= WORLD.grid.h));

  // Si dos compañeros de puesto compartieran píxel, solo se vería a uno: el
  // mapa diría que hay una persona donde hay tres.
  const spots = s0.actors.map((a) => a.homeX.toFixed(3) + ',' + a.homeY.toFixed(3));
  eq('nadie se dibuja encima de otro', new Set(spots).size, spots.length);
  check('y todos siguen dentro de su área', s0.actors.every((a) => {
    const area = WORLD.areas.find((x) => x.id === a.areaId);
    return a.homeX >= area.x && a.homeX <= area.x + area.w && a.homeY >= area.y && a.homeY <= area.y + area.h;
  }));

  const a1 = ws.wsSimStep(s0, WORLD, 0.05, statusOf);
  const a2 = ws.wsSimStep(s0, WORLD, 0.05, statusOf);
  eq('un paso es determinista', J(a1.actors), J(a2.actors));
  eq('y no muta el estado recibido', J(s0.actors[0]), J(ws.wsSimInit(WORLD, null).actors[0]));

  const moods = {};
  for (const a of a1.actors) moods[a.agentId || a.name] = a.mood;
  eq('un agente ejecutándose trabaja', moods.research, 'working');
  eq('uno terminado se marca terminado', moods.director, 'done');
  eq('uno con error se marca bloqueado', moods.storyboard, 'blocked');
  eq('uno apagado descansa', moods.editor, 'off');
  eq('las personas no heredan estado de agente', moods.Ada, 'human');
  check('el bloqueado enseña un aviso', a1.actors.find((a) => a.agentId === 'storyboard').bubble === '!');

  // Un fotograma perdido no puede teletransportar a nadie.
  const jump = ws.wsSimStep(s0, WORLD, 60, statusOf);
  const dist = Math.max(...jump.actors.map((a, i) => Math.hypot(a.x - s0.actors[i].x, a.y - s0.actors[i].y)));
  check('un delta enorme se acota', dist <= ws.WS_SPEED * ws.WS_TICK_MAX * 1.3 + 0.001, 'saltó ' + dist.toFixed(2));

  // El apagado se va a la zona común y llega.
  let sim = s0;
  for (let i = 0; i < 400; i++) sim = ws.wsSimStep(sim, WORLD, 0.05, statusOf);
  const plaza = WORLD.areas.find((a) => a.structure === 'plaza');
  const c = ws.wsAreaCenter(plaza);
  const off = sim.actors.find((a) => a.agentId === 'editor');
  near('el agente apagado acaba en la zona común', Math.hypot(off.x - c.x, off.y - c.y), 0, 1.6);

  // Y quien trabaja se queda en su puesto, no deambulando.
  const work = sim.actors.find((a) => a.agentId === 'research');
  near('el que trabaja se queda en su puesto', Math.hypot(work.x - work.homeX, work.y - work.homeY), 0, 0.8);

  // Editar el mundo no debe hacer saltar a nadie.
  const moved = ws.wsAddArea(WORLD, { departmentId: 'rrhh', name: 'Personas', structure: 'training' }).world;
  const s2 = ws.wsSimInit(moved, sim);
  const keep = s2.actors.find((a) => a.agentId === 'research');
  eq('editar el mapa conserva las posiciones', J([keep.x, keep.y]), J([work.x, work.y]));

  const said = ws.wsSimSay(sim, off.id, 'me tomo un café que dura demasiado tiempo escrito', 3);
  check('una burbuja se recorta', said.actors.find((a) => a.id === off.id).bubble.length <= 40);

  const colA = ws.wsAvatarColors(s0.actors[0]);
  const colB = ws.wsAvatarColors(s0.actors[0]);
  eq('el aspecto de un avatar es estable', J(colA), J(colB));
  check('los agentes y las personas no se pintan igual',
    J(ws.wsAvatarColors({ kind: 'ai', hue: 10 })) !== J(ws.wsAvatarColors({ kind: 'human', hue: 10 })));
}
{
  eq('el mismo texto da siempre el mismo hash', ws.wsHash('Kreative'), ws.wsHash('Kreative'));
  check('textos distintos dan hashes distintos', ws.wsHash('a') !== ws.wsHash('b'));
}

// ── 7. Proyecciones: un modelo, tres formas de verlo ─────────────────────
{
  const grid = { w: 10, h: 8 };
  const orth = ws.wsProjector('village', grid);
  const iso = ws.wsProjector('hotel', grid);
  check('la villa es cenital', orth.to(1, 0).y === orth.to(0, 0).y, J([orth.to(1, 0), orth.to(0, 0)]));
  check('el hotel es isométrico', iso.to(1, 0).y > iso.to(0, 0).y, J([iso.to(1, 0), iso.to(0, 0)]));
  check('el territorio es cenital como la villa',
    J(ws.wsProjector('territory', grid).to(3, 2)) === J(orth.to(3, 2)));
  check('el lienzo tiene tamaño positivo en las tres',
    [orth, iso, ws.wsProjector('territory', grid)].every((p) => p.width > 0 && p.height > 0));

  const area = { x: 2, y: 1, w: 3, h: 2 };
  const rect = ws.wsAreaShape(orth, area);
  eq('en cenital el área es un rectángulo de su tamaño', rect.w, 3 * orth.T);
  check('en isométrico el área es un polígono de cuatro vértices',
    ws.wsAreaShape(iso, area).split(' ').length === 4);
}
{
  // La superficie completa se renderiza sin tocar el DOM: el bucle vive en un
  // efecto, y el efecto no se ejecuta aquí.
  effects = []; refIdx = 0; refs.length = 0;
  let tree = null;
  try {
    tree = ws.WsWorldSurface({ world: WORLD, kind: 'village', statusOf, selArea: WORLD.areas[0].id });
  } catch (e) { check('la superficie renderiza', false, e.message); }
  if (tree) {
    check('la superficie renderiza un SVG', tree.t === 'svg', tree.t);
    check('y se describe para lectores de pantalla', /Mapa de la organización/.test(tree.p['aria-label']), tree.p['aria-label']);
    const flat = [];
    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      flat.push(n);
      walk(n.c);
    }(tree));
    check('pinta una estructura por área',
      flat.filter((n) => n.t === ws.WsStructure).length === WORLD.areas.length);
    check('y un avatar por persona o agente',
      flat.filter((n) => n.t === ws.WsAvatar).length === WORLD.staff.length);
    // Los de delante deben taparse con los de detrás, o la escena se ve plana.
    const order = flat.filter((n) => n.t === ws.WsAvatar).map((n) => n.p.px + n.p.py);
    check('los avatares se ordenan en profundidad',
      order.every((v, i) => i === 0 || v >= order[i - 1] - 0.001), J(order));
    check('el bucle de animación se registra como efecto', effects.length === 1);
  }
  // Y las piezas sueltas también se dibujan.
  const st = ws.WsStructure({ area: WORLD.areas[0], pr: ws.wsProjector('hotel', WORLD.grid), selected: true });
  check('la estructura isométrica se dibuja', st && st.t === 'g');
  const av = ws.WsAvatar({ actor: ws.wsSimInit(WORLD, null).actors[0], px: 10, py: 10, t: 1 });
  check('el avatar se dibuja', av && av.t === 'g');
}
{
  // Garantía 5 del contrato: con `prefers-reduced-motion` el bucle ni arranca.
  effects = []; refIdx = 0; refs.length = 0;
  ws.WsWorldSurface({ world: WORLD, kind: 'village', statusOf });
  let raf = 0;
  globalThis.requestAnimationFrame = () => { raf++; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.matchMedia = () => ({ matches: true });
  const cleanup = effects[0].fn();
  eq('con movimiento reducido no se pide ni un fotograma', raf, 0);
  eq('y no hay nada que cancelar', cleanup, undefined);

  effects = []; refIdx = 0; refs.length = 0;
  ws.WsWorldSurface({ world: WORLD, kind: 'village', statusOf });
  globalThis.matchMedia = () => ({ matches: false });
  let cancelled = 0;
  let frame = null;
  globalThis.requestAnimationFrame = (fn) => { raf++; frame = fn; return raf; };
  globalThis.cancelAnimationFrame = () => { cancelled++; };
  const stop = effects[0].fn();
  check('sin movimiento reducido el bucle arranca', raf > 0, 'fotogramas ' + raf);
  check('y se puede parar', typeof stop === 'function');

  // El bucle se da de alta UNA vez, así que si se cerrara sobre las props se
  // quedaría con el estado del flujo del primer fotograma y los avatares no
  // reaccionarían nunca. Aquí se cambia el estado entre repintados y se
  // comprueba que el siguiente fotograma ya lo refleja.
  const moodOf = () => {
    const sim = refs.find((x) => x.current && x.current.sim);
    const a = sim.current.sim.actors.find((x) => x.agentId === 'research');
    return a ? a.mood : '';
  };
  frame(100); frame(1100);
  eq('el primer estado llega al avatar', moodOf(), 'working');
  refIdx = 0;
  ws.WsWorldSurface({ world: WORLD, kind: 'village', statusOf: () => 'blocked' });
  frame(2100);
  eq('un cambio de estado del flujo llega al fotograma siguiente', moodOf(), 'blocked');

  stop();
  eq('parar cancela el fotograma pendiente', cancelled, 1);
  delete globalThis.matchMedia;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
}

// ── 8. Garantías del contrato, comprobadas sobre el código ───────────────
const allCode = sources.map((x) => x.code).join('\n');
{
  const forbidden = [
    [/\bfetch\s*\(/, 'fetch'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bnew\s+Image\b/, 'new Image'],
    [/\bimport\s*\(/, 'import() dinámico'],
    [/https?:\/\//, 'URL absoluta'],
    [/@import|url\s*\(/, 'recurso externo'],
    [/globalThis\.[A-Za-z_$][\w$]*\s*=/, 'escritura en globalThis'],
    [/\blocalStorage\b|\bsessionStorage\b/, 'almacenamiento del navegador'],
  ];
  const hits = forbidden.filter(([re]) => re.test(allCode)).map(([, n]) => n);
  check('el paquete no toca la red ni recursos externos ni el estado global', hits.length === 0, hits.join(', '));

  // `document` solo se puede usar para saber si la pestaña está a la vista.
  const docUses = (allCode.match(/document\.\w+/g) || []).filter((u) => u !== 'document.hidden');
  check('del documento solo se consulta si la pestaña está oculta', docUses.length === 0, docUses.join(', '));
  check('el bucle se pausa con la pestaña oculta', /document\.hidden/.test(allCode));
  check('el bucle tiene techo de fotogramas', /1\s*\/\s*24/.test(allCode));
}
{
  const css = fs.readFileSync(path.join(pkg, 'style', 'worldskin.css'), 'utf8');
  const selectors = css.split('}').map((b) => b.split('{')[0])
    .map((x) => x.replace(/\/\*[\s\S]*?\*\//g, '').trim())
    .filter((x) => x && !x.startsWith('@') && !x.startsWith('/*'));
  const unscoped = selectors.filter((sel) => sel.split(',').some((one) => !one.trim().startsWith('%ROOT%')));
  check('todo el CSS del paquete está enclaustrado bajo la raíz de la app', unscoped.length === 0, unscoped.join(' | '));
  check('el CSS no declara recursos externos', !/@import|url\s*\(/.test(css));
  check('el CSS cubre las tres ambientaciones',
    ['kimoslab', 'jabotel', 'spacecraft'].every((m) => css.includes('ks-mode-' + m)));
}
{
  const contrato = fs.readFileSync(path.join(pkg, 'docs', 'CONTRATO.md'), 'utf8');
  check('el contrato exige flujo y agentes', /flujo de trabajo/i.test(contrato) && /agentes/i.test(contrato));
  check('el contrato declara los símbolos que pone el anfitrión',
    ['`h`', '`useState`', '`useEffect`', '`useRef`', '`cx`'].every((x) => contrato.includes(x)));
  for (const f of files) check('el contrato documenta ' + f, contrato.includes(f));
}

// ── 9. La adopción real: el bundle de Kreative Studio ────────────────────
{
  const appDir = path.join(repo, 'apps', 'kreative-studio');
  const bundle = path.join(appDir, 'dist', 'index.js');
  if (!fs.existsSync(bundle)) {
    check('bundle de Kreative Studio presente', false, 'ejecuta antes `node apps/kreative-studio/build.mjs`');
  } else {
    const js = fs.readFileSync(bundle, 'utf8');
    const missing = sources.filter((x) => !js.includes(x.code.trim())).map((x) => x.name);
    check('el bundle incorpora los fragmentos del paquete tal cual', missing.length === 0, missing.join(', '));
    // El orden importa: el dominio antes del modelo, la UI dentro de mount.
    check('el núcleo va antes que el modelo de la app',
      js.indexOf('const WS_VERSION') < js.indexOf('function emptyCampaign'));
    check('la superficie va después de las utilidades de UI',
      js.indexOf('function WsWorldSurface') > js.indexOf('function Card'));

    const css = fs.readFileSync(path.join(appDir, 'dist', 'index.css'), 'utf8');
    check('el CSS del paquete llega al bundle con la raíz sustituida',
      css.includes('.kimos-kreative .ws-surface') && !css.includes('%ROOT%'));
  }
}

// ── Resultado ────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(58));
if (failures.length) {
  console.log('✖ ' + failures.length + ' fallo(s) de ' + (passed + failures.length) + ' comprobaciones:\n');
  for (const f of failures) console.log('   ✖ ' + f);
  process.exit(1);
}
console.log('✔ ' + passed + ' comprobaciones correctas.');
console.log('  WorldSkin ' + ws.WS_VERSION + ' · ' + ws.WS_DEPARTMENTS.length + ' departamentos · '
  + ws.WS_STRUCTURES.length + ' estructuras · ' + (ws.CLASSIC_MODES.length + ws.GAME_MODES.length) + ' modos.');
