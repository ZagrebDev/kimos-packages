
// ═══════════════════════════════════════════════════════════════════════════
// KIMOS WorldSkin · el MUNDO de la organización
//
// Un mundo es una rejilla con ÁREAS (departamentos y procesos internos), cada
// una con una ESTRUCTURA y unos PUESTOS, y con PERSONAL asignado: agentes de
// IA y personas. Es el mismo modelo en las tres ambientaciones — la villa, el
// hotel y el territorio son solo formas de dibujarlo.
//
// Todas las mutaciones son puras: reciben el mundo y devuelven uno nuevo con
// `{ world, ok, error }`. Nunca lanzan por datos del usuario.
// ═══════════════════════════════════════════════════════════════════════════

const WS_GRID_MAX = 40;
const WS_AREAS_MAX = 60;
const WS_STAFF_MAX = 200;

function wsEmptyWorld() {
  return { schema: 1, wsVersion: WS_VERSION, grid: { w: 16, h: 12 }, areas: [], staff: [], seededFrom: '' };
}

/** Normaliza cualquier mundo cargado. Tolerante y sin excepciones. */
function wsMigrateWorld(raw) {
  const d = wsObj(raw);
  const w = wsClamp(wsNum(wsObj(d.grid).w, 16), 6, WS_GRID_MAX);
  const h = wsClamp(wsNum(wsObj(d.grid).h, 12), 6, WS_GRID_MAX);
  const areas = wsArr(d.areas).slice(0, WS_AREAS_MAX).map((a, i) => {
    const st = wsStructureById(wsObj(a).structure);
    return {
      id: wsS(a.id) || 'area-' + i,
      name: wsS(a.name) || wsDepartmentById(a.departmentId).label,
      departmentId: wsDepartmentById(wsObj(a).departmentId).id,
      structure: st.id,
      x: wsClamp(wsNum(a.x, 0), 0, w - 1), y: wsClamp(wsNum(a.y, 0), 0, h - 1),
      w: wsClamp(wsNum(a.w, st.w), 1, 8), h: wsClamp(wsNum(a.h, st.h), 1, 8),
      note: wsS(a.note),
      stations: wsArr(a.stations).slice(0, 12).map((p, j) => ({
        id: wsS(p.id) || 'st-' + i + '-' + j,
        name: wsS(p.name) || 'Puesto ' + (j + 1),
        process: wsS(p.process),
      })),
    };
  });
  const areaIds = new Set(areas.map((a) => a.id));
  const staff = wsArr(d.staff).slice(0, WS_STAFF_MAX).map((p, i) => {
    const areaId = areaIds.has(wsS(p.areaId)) ? wsS(p.areaId) : (areas[0] ? areas[0].id : '');
    const area = areas.find((a) => a.id === areaId);
    const stIds = area ? area.stations.map((x) => x.id) : [];
    return {
      id: wsS(p.id) || 'staff-' + i,
      name: wsS(p.name) || 'Sin nombre',
      kind: wsS(p.kind) === 'ai' ? 'ai' : 'human',
      role: wsS(p.role),
      areaId,
      stationId: stIds.indexOf(wsS(p.stationId)) >= 0 ? wsS(p.stationId) : (stIds[0] || ''),
      agentId: wsS(p.agentId) || null,     // enlaza con un agente del flujo
    };
  });
  return { schema: 1, wsVersion: WS_VERSION, grid: { w, h }, areas, staff, seededFrom: wsS(d.seededFrom) };
}

/** ¿Cabe un área en esa posición sin salirse ni pisar a otra? */
function wsFits(world, area, ignoreId) {
  const g = wsObj(world.grid);
  if (area.x < 0 || area.y < 0) return 'Fuera del mapa.';
  if (area.x + area.w > g.w || area.y + area.h > g.h) return 'No cabe: se sale del mapa.';
  for (const o of wsArr(world.areas)) {
    if (o.id === ignoreId) continue;
    const sep = area.x + area.w <= o.x || o.x + o.w <= area.x
      || area.y + area.h <= o.y || o.y + o.h <= area.y;
    if (!sep) return 'Se solapa con «' + o.name + '».';
  }
  return '';
}

/**
 * Primer hueco libre para una estructura de w×h.
 *
 * Busca primero dejando una celda de separación, para que las estructuras no
 * queden pegadas unas a otras: en un mapa hecho a topes no se distingue dónde
 * acaba un departamento y empieza el siguiente. Si no cabe con margen, se
 * vuelve a intentar sin él antes de rendirse.
 */
function wsFindSpot(world, w, h) {
  const g = wsObj(world.grid);
  for (const pad of [1, 0]) {
    for (let y = 0; y + h <= g.h; y++) {
      for (let x = 0; x + w <= g.w; x++) {
        const probe = { x: Math.max(0, x - pad), y: Math.max(0, y - pad), w: w + pad * 2, h: h + pad * 2 };
        probe.w = Math.min(probe.w, g.w - probe.x);
        probe.h = Math.min(probe.h, g.h - probe.y);
        if (!wsFits(world, probe, null)) return { x, y };
      }
    }
  }
  return null;
}

const wsClone = (w) => JSON.parse(JSON.stringify(w));
const wsFail = (world, error) => ({ world, ok: false, error });
const wsDone = (world, message) => ({ world, ok: true, message });

/** Alta de área (departamento o proceso interno). */
function wsAddArea(world, spec) {
  const w0 = wsClone(world);
  const sp = wsObj(spec);
  if (wsArr(w0.areas).length >= WS_AREAS_MAX) return wsFail(world, 'El mapa ya tiene ' + WS_AREAS_MAX + ' áreas.');
  const st = wsStructureById(sp.structure);
  const dep = wsDepartmentById(sp.departmentId);
  const area = {
    id: wsId('area'),
    name: wsS(sp.name) || dep.label,
    departmentId: dep.id,
    structure: st.id,
    w: wsClamp(wsNum(sp.w, st.w), 1, 8), h: wsClamp(wsNum(sp.h, st.h), 1, 8),
    note: wsS(sp.note),
    stations: wsArr(sp.stations).length
      ? wsArr(sp.stations).map((x, j) => ({ id: wsId('st'), name: wsS(x.name) || 'Puesto ' + (j + 1), process: wsS(x.process) }))
      : [{ id: wsId('st'), name: 'Puesto 1', process: '' }],
  };
  let pos = (sp.x != null && sp.y != null) ? { x: wsNum(sp.x, 0), y: wsNum(sp.y, 0) } : wsFindSpot(w0, area.w, area.h);
  if (!pos) return wsFail(world, 'No queda sitio en el mapa. Amplíalo o borra un área.');
  area.x = pos.x; area.y = pos.y;
  const bad = wsFits(w0, area, null);
  if (bad) {
    const alt = wsFindSpot(w0, area.w, area.h);
    if (!alt) return wsFail(world, bad + ' Y no queda otro hueco.');
    area.x = alt.x; area.y = alt.y;
  }
  w0.areas.push(area);
  return wsDone(w0, 'Área «' + area.name + '» creada en (' + area.x + ',' + area.y + ').');
}

/** Edición: nombre, departamento, estructura, tamaño, posición o nota. */
function wsUpdateArea(world, areaId, patch) {
  const w0 = wsClone(world);
  const a = wsArr(w0.areas).find((x) => x.id === wsS(areaId) || wsNorm(x.name) === wsNorm(areaId));
  if (!a) return wsFail(world, 'No existe el área «' + wsS(areaId) + '».');
  const p = wsObj(patch);
  if (p.name !== undefined) a.name = wsS(p.name) || a.name;
  if (p.note !== undefined) a.note = wsS(p.note);
  if (p.departmentId !== undefined) a.departmentId = wsDepartmentById(p.departmentId).id;
  if (p.structure !== undefined) {
    const st = wsStructureById(p.structure);
    a.structure = st.id;
    if (p.w === undefined) a.w = st.w;
    if (p.h === undefined) a.h = st.h;
  }
  if (p.w !== undefined) a.w = wsClamp(wsNum(p.w, a.w), 1, 8);
  if (p.h !== undefined) a.h = wsClamp(wsNum(p.h, a.h), 1, 8);
  if (p.x !== undefined) a.x = wsNum(p.x, a.x);
  if (p.y !== undefined) a.y = wsNum(p.y, a.y);
  const bad = wsFits(w0, a, a.id);
  if (bad) return wsFail(world, bad);
  return wsDone(w0, 'Área «' + a.name + '» actualizada.');
}

/** Baja de área. El personal que la ocupaba se reubica, no desaparece. */
function wsRemoveArea(world, areaId) {
  const w0 = wsClone(world);
  const i = wsArr(w0.areas).findIndex((x) => x.id === wsS(areaId) || wsNorm(x.name) === wsNorm(areaId));
  if (i < 0) return wsFail(world, 'No existe el área «' + wsS(areaId) + '».');
  const gone = w0.areas.splice(i, 1)[0];
  const dest = w0.areas[0] || null;
  let moved = 0;
  for (const p of wsArr(w0.staff)) {
    if (p.areaId !== gone.id) continue;
    moved++;
    p.areaId = dest ? dest.id : '';
    p.stationId = dest && dest.stations[0] ? dest.stations[0].id : '';
  }
  return wsDone(w0, 'Área «' + gone.name + '» eliminada.'
    + (moved ? ' ' + moved + ' persona(s) reubicadas' + (dest ? ' en «' + dest.name + '».' : ', sin área.') : ''));
}

/** Puestos dentro de un área: los procesos internos del departamento. */
function wsAddStation(world, areaId, spec) {
  const w0 = wsClone(world);
  const a = wsArr(w0.areas).find((x) => x.id === wsS(areaId) || wsNorm(x.name) === wsNorm(areaId));
  if (!a) return wsFail(world, 'No existe el área «' + wsS(areaId) + '».');
  if (a.stations.length >= 12) return wsFail(world, 'Un área admite hasta 12 puestos.');
  const sp = wsObj(spec);
  a.stations.push({ id: wsId('st'), name: wsS(sp.name) || 'Puesto ' + (a.stations.length + 1), process: wsS(sp.process) });
  return wsDone(w0, 'Puesto añadido a «' + a.name + '».');
}
function wsUpdateStation(world, areaId, stationId, patch) {
  const w0 = wsClone(world);
  const a = wsArr(w0.areas).find((x) => x.id === wsS(areaId) || wsNorm(x.name) === wsNorm(areaId));
  if (!a) return wsFail(world, 'No existe el área.');
  const st = wsArr(a.stations).find((x) => x.id === wsS(stationId) || wsNorm(x.name) === wsNorm(stationId));
  if (!st) return wsFail(world, 'No existe el puesto «' + wsS(stationId) + '».');
  const p = wsObj(patch);
  if (p.name !== undefined) st.name = wsS(p.name) || st.name;
  if (p.process !== undefined) st.process = wsS(p.process);
  return wsDone(w0, 'Puesto «' + st.name + '» actualizado.');
}
function wsRemoveStation(world, areaId, stationId) {
  const w0 = wsClone(world);
  const a = wsArr(w0.areas).find((x) => x.id === wsS(areaId));
  if (!a) return wsFail(world, 'No existe el área.');
  if (a.stations.length <= 1) return wsFail(world, 'Un área necesita al menos un puesto.');
  const i = a.stations.findIndex((x) => x.id === wsS(stationId));
  if (i < 0) return wsFail(world, 'No existe el puesto.');
  const gone = a.stations.splice(i, 1)[0];
  for (const p of wsArr(w0.staff)) if (p.stationId === gone.id) p.stationId = a.stations[0].id;
  return wsDone(w0, 'Puesto «' + gone.name + '» eliminado.');
}

/** Personal: agentes de IA y personas. */
function wsAddStaff(world, spec) {
  const w0 = wsClone(world);
  if (wsArr(w0.staff).length >= WS_STAFF_MAX) return wsFail(world, 'Demasiado personal en el mapa.');
  const sp = wsObj(spec);
  if (!wsArr(w0.areas).length) return wsFail(world, 'Crea un área antes de asignar personal.');
  const area = wsArr(w0.areas).find((x) => x.id === wsS(sp.areaId) || wsNorm(x.name) === wsNorm(sp.areaId)) || w0.areas[0];
  const p = {
    id: wsId('staff'), name: wsS(sp.name) || 'Sin nombre',
    kind: wsS(sp.kind) === 'ai' ? 'ai' : 'human',
    role: wsS(sp.role), areaId: area.id,
    stationId: (area.stations.find((x) => x.id === wsS(sp.stationId)) || area.stations[0] || {}).id || '',
    agentId: wsS(sp.agentId) || null,
  };
  w0.staff.push(p);
  return wsDone(w0, (p.kind === 'ai' ? 'Agente' : 'Persona') + ' «' + p.name + '» en «' + area.name + '».');
}
function wsUpdateStaff(world, staffId, patch) {
  const w0 = wsClone(world);
  const p = wsArr(w0.staff).find((x) => x.id === wsS(staffId) || wsNorm(x.name) === wsNorm(staffId));
  if (!p) return wsFail(world, 'No existe «' + wsS(staffId) + '» en el personal.');
  const q = wsObj(patch);
  if (q.name !== undefined) p.name = wsS(q.name) || p.name;
  if (q.role !== undefined) p.role = wsS(q.role);
  if (q.kind !== undefined) p.kind = wsS(q.kind) === 'ai' ? 'ai' : 'human';
  if (q.areaId !== undefined) {
    const a = wsArr(w0.areas).find((x) => x.id === wsS(q.areaId) || wsNorm(x.name) === wsNorm(q.areaId));
    if (!a) return wsFail(world, 'No existe el área destino.');
    p.areaId = a.id;
    p.stationId = (a.stations[0] || {}).id || '';
  }
  if (q.stationId !== undefined) {
    const a = wsArr(w0.areas).find((x) => x.id === p.areaId);
    if (a && a.stations.some((x) => x.id === wsS(q.stationId))) p.stationId = wsS(q.stationId);
  }
  return wsDone(w0, '«' + p.name + '» actualizado.');
}
function wsRemoveStaff(world, staffId) {
  const w0 = wsClone(world);
  const i = wsArr(w0.staff).findIndex((x) => x.id === wsS(staffId) || wsNorm(x.name) === wsNorm(staffId));
  if (i < 0) return wsFail(world, 'No existe en el personal.');
  const gone = w0.staff.splice(i, 1)[0];
  return wsDone(w0, '«' + gone.name + '» dado de baja del mapa.');
}
function wsResizeGrid(world, w, h) {
  const w0 = wsClone(world);
  const nw = wsClamp(wsNum(w, w0.grid.w), 6, WS_GRID_MAX);
  const nh = wsClamp(wsNum(h, w0.grid.h), 6, WS_GRID_MAX);
  const out = wsArr(w0.areas).filter((a) => a.x + a.w > nw || a.y + a.h > nh);
  if (out.length) return wsFail(world, 'No se puede encoger: ' + out.length + ' área(s) quedarían fuera ('
    + out.map((a) => a.name).join(', ') + ').');
  w0.grid = { w: nw, h: nh };
  return wsDone(w0, 'Mapa de ' + nw + '×' + nh + '.');
}

/**
 * Siembra el mundo desde el flujo de agentes de la app anfitriona.
 *
 * Es lo que hace que esto NO sea un juguete separado: cada agente del flujo
 * entra como personal de IA en el área que le corresponde, y los
 * departamentos que la app declare se convierten en edificios.
 */
function wsSeedWorld(plan, opts) {
  const o = wsObj(opts);
  let world = wsEmptyWorld();
  world.seededFrom = wsS(o.appId) || 'app';
  const groups = wsArr(o.groups).length ? wsArr(o.groups) : [
    { departmentId: 'produccion', name: 'Producción', structure: 'factory' },
  ];
  for (const g of groups) {
    const r = wsAddArea(world, g);
    if (r.ok) world = r.world;
  }
  // Zona común: siempre viene bien un sitio donde los avatares se crucen.
  const plaza = wsAddArea(world, { departmentId: 'direccion', name: 'Plaza', structure: 'plaza' });
  if (plaza.ok) world = plaza.world;

  const areas = wsArr(world.areas);
  const place = (i, departmentId) => areas.find((a) => wsS(a.departmentId) === wsS(departmentId))
    || areas[i % Math.max(1, areas.length)] || null;

  wsArr(plan).forEach((node, i) => {
    const target = place(i, node.departmentId);
    if (!target) return;
    const r = wsAddStaff(world, { name: node.name, kind: 'ai', role: 'Agente ' + (node.n || i + 1),
      areaId: target.id, agentId: node.id });
    if (r.ok) world = r.world;
  });

  // Personal humano. Sin él el mapa sería una fábrica automática, y la idea es
  // justo la contraria: que se vea quién hace qué junto a qué agente.
  wsArr(o.people).forEach((p, i) => {
    const target = place(i, p.departmentId);
    if (!target) return;
    const r = wsAddStaff(world, { name: p.name, kind: 'human', role: p.role, areaId: target.id });
    if (r.ok) world = r.world;
  });
  return world;
}

/** Resumen para la interfaz y para el snapshot del agente. */
function wsWorldSummary(world) {
  const w = wsObj(world);
  const byDep = {};
  for (const a of wsArr(w.areas)) byDep[a.departmentId] = (byDep[a.departmentId] || 0) + 1;
  return {
    areas: wsArr(w.areas).length,
    puestos: wsArr(w.areas).reduce((n, a) => n + wsArr(a.stations).length, 0),
    personas: wsArr(w.staff).filter((p) => p.kind === 'human').length,
    agentes: wsArr(w.staff).filter((p) => p.kind === 'ai').length,
    mapa: wsObj(w.grid).w + '×' + wsObj(w.grid).h,
    departamentos: Object.keys(byDep).map((k) => wsDepartmentById(k).label),
  };
}
