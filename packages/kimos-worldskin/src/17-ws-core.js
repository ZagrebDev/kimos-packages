
// ═══════════════════════════════════════════════════════════════════════════
// KIMOS WorldSkin · núcleo
//
// Paquete de FUENTES reutilizable: da a cualquier app de KIMOS con flujos de
// trabajo y agentes dos formas de verse —clásica y juego— y un mundo editable
// donde la organización se representa como áreas, estructuras y avatares.
//
// NO es una librería en tiempo de ejecución: las apps de KIMOS son bundles
// autónomos y no existe runtime compartido. Cada app incorpora estos
// fragmentos en su propio build (ver docs/CONTRATO.md). Por eso todo aquí es
// autosuficiente y va prefijado `ws`/`WS_`: se puede pegar en una app que no
// comparta ninguna utilidad con esta.
//
// Versión del paquete: 1.0.0
// ═══════════════════════════════════════════════════════════════════════════

const WS_VERSION = '1.0.0';

// ── Utilidades propias (sin depender del anfitrión) ──────────────────────
const wsS = (v) => (v == null ? '' : String(v));
const wsNum = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
const wsArr = (v) => (Array.isArray(v) ? v : []);
const wsObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const wsClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wsNorm = (v) => wsS(v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const wsSlug = (v) => wsNorm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const wsUniq = (a) => Array.from(new Set(wsArr(a).filter((x) => x != null && x !== '')));
let wsCounter = 0;
const wsId = (p) => p + '-' + Date.now().toString(36) + '-' + (wsCounter++).toString(36)
  + Math.random().toString(36).slice(2, 5);
/** Hash determinista: mismo nombre ⇒ mismo aspecto de avatar en toda sesión. */
function wsHash(str) {
  let h = 0x811c9dc5;
  const t = wsS(str);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return h >>> 0;
}

// ── Formas y modos ────────────────────────────────────────────────────────
const THEME_FORMS = [
  { id: 'classic', label: 'Clásica', emoji: '▤', help: 'Estudio profesional. La luz cambia, el trabajo no.' },
  { id: 'game', label: 'Juego', emoji: '🕹️', help: 'La organización como un mundo jugable, con avatares en movimiento.' },
];

const CLASSIC_MODES = [
  { id: 'day', label: 'Día', emoji: '☀️',
    tokens: { bg: '#F4F6F8', panel: '#FFFFFF', panel2: '#F0F3F6', line: '#DFE5EC', line2: '#C6D0DB',
      txt: '#101822', txt2: '#4A5768', txt3: '#7A8798', media: '#E8ECF1', checker: '#E2E7EE',
      ok: '#1E9E6A', warn: '#B7791F', bad: '#C6403C', shadow: '0 1px 2px rgba(16,24,34,.07)' } },
  { id: 'sunset', label: 'Atardecer', emoji: '🌇',
    tokens: { bg: '#241A1B', panel: '#2E2122', panel2: '#38292A', line: '#4A3435', line2: '#5E4241',
      txt: '#F6E8E0', txt2: '#C4A99E', txt3: '#94786F', media: '#1A1213', checker: '#332526',
      ok: '#8FBF6A', warn: '#E8A33D', bad: '#E8664F', shadow: '0 1px 2px rgba(0,0,0,.35)' } },
  { id: 'night', label: 'Noche', emoji: '🌙',
    tokens: { bg: '#0B0D10', panel: '#12151A', panel2: '#171B21', line: '#232932', line2: '#2E3641',
      txt: '#E7EBF0', txt2: '#98A2B0', txt3: '#6B7684', media: '#05070A', checker: '#1A1F26',
      ok: '#35C48A', warn: '#E5A93A', bad: '#EE5A5A', shadow: '0 1px 2px rgba(0,0,0,.4)' } },
  { id: 'live', label: 'Vivo', emoji: '🕰️', help: 'Sigue la hora del equipo: día, atardecer y noche.', tokens: null },
];

const GAME_MODES = [
  {
    id: 'kimoslab', label: 'KimosLab', emoji: '🔬',
    help: 'Villa en píxeles: cada departamento es un edificio de la ruta.',
    world: { kind: 'village', tile: 64, structureLabel: 'edificio', areaLabel: 'zona' },
    tokens: { bg: '#184C3C', panel: '#F8F8F0', panel2: '#E8E8D8', line: '#282828', line2: '#585858',
      txt: '#282828', txt2: '#484848', txt3: '#787878', media: '#103828', checker: '#D8D8C8',
      ok: '#38A048', warn: '#E8A020', bad: '#D83830', shadow: '0 3px 0 rgba(0,0,0,.35)' },
    decor: { grid: '#1E5C48', accentInk: '#3860A8', ground: '#2E7A54', path: '#C8B888',
      font: 'ui-monospace, "Courier New", monospace' },
  },
  {
    id: 'jabotel', label: 'JABOTEL', emoji: '🏨',
    help: 'Hotel isométrico: cada departamento es una sala con sus puestos.',
    world: { kind: 'hotel', tile: 64, structureLabel: 'sala', areaLabel: 'planta' },
    tokens: { bg: '#1B2A3A', panel: '#26384C', panel2: '#2F455C', line: '#3E5975', line2: '#52708F',
      txt: '#EAF2FA', txt2: '#A9C0D6', txt3: '#7C93AA', media: '#14212E', checker: '#223448',
      ok: '#5BD07A', warn: '#F2B33D', bad: '#EE6A5A', shadow: '0 2px 0 rgba(0,0,0,.4)' },
    decor: { grid: '#33506D', accentInk: '#FFCC33', ground: '#2B4055', path: '#3E5975',
      font: 'Verdana, Geneva, sans-serif' },
  },
  {
    id: 'spacecraft', label: 'Spacecraft', emoji: '🛸',
    help: 'Territorio táctico: cada departamento es una estructura desplegada en el terreno.',
    world: { kind: 'territory', tile: 64, structureLabel: 'estructura', areaLabel: 'sector' },
    tokens: { bg: '#07110E', panel: '#0E1D1A', panel2: '#132823', line: '#1E3B34', line2: '#2C554B',
      txt: '#D6F5E6', txt2: '#7FC4A8', txt3: '#4F8B76', media: '#040B09', checker: '#0C1916',
      ok: '#4BE3A0', warn: '#E8C24A', bad: '#FF6B5B', shadow: '0 0 0 1px rgba(75,227,160,.12)' },
    decor: { grid: '#123029', accentInk: '#7FE3C4', ground: '#0A1A16', path: '#1E3B34',
      font: 'ui-monospace, Menlo, monospace' },
  },
];

const themeFormById = (id) => THEME_FORMS.find((x) => x.id === id) || THEME_FORMS[0];
const classicModeById = (id) => CLASSIC_MODES.find((x) => x.id === id) || CLASSIC_MODES[2];
const gameModeById = (id) => GAME_MODES.find((x) => x.id === id) || GAME_MODES[0];

function modeForHour(hour) {
  const h = wsClamp(wsNum(hour, 12), 0, 23);
  if (h >= 7 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'sunset';
  return 'night';
}

function resolveTheme(themeCfg, hour) {
  const t = wsObj(themeCfg);
  if (themeFormById(t.form).id === 'game') {
    const m = gameModeById(t.gameMode);
    return { formId: 'game', modeId: m.id, label: m.label, emoji: m.emoji,
      tokens: m.tokens, decor: wsObj(m.decor), world: wsObj(m.world), live: false };
  }
  const chosen = classicModeById(t.classicMode);
  const live = chosen.id === 'live';
  const actual = live ? classicModeById(modeForHour(hour)) : chosen;
  return { formId: 'classic', modeId: chosen.id, effectiveId: actual.id,
    label: chosen.label + (live ? ' · ' + actual.label : ''), emoji: live ? chosen.emoji : actual.emoji,
    tokens: actual.tokens, decor: {}, world: {}, live };
}

function themeVars(theme) {
  const tk = wsObj(wsObj(theme).tokens);
  const out = {};
  const map = { bg: '--ks-bg', panel: '--ks-panel', panel2: '--ks-panel2', line: '--ks-line',
    line2: '--ks-line2', txt: '--ks-txt', txt2: '--ks-txt2', txt3: '--ks-txt3',
    media: '--ks-media', checker: '--ks-checker', ok: '--ks-ok', warn: '--ks-warn', bad: '--ks-bad',
    shadow: '--ks-shadow' };
  for (const k of Object.keys(map)) if (tk[k]) out[map[k]] = tk[k];
  const dc = wsObj(wsObj(theme).decor);
  if (dc.grid) out['--ks-grid'] = dc.grid;
  if (dc.accentInk) out['--ks-ink'] = dc.accentInk;
  if (dc.ground) out['--ks-ground'] = dc.ground;
  if (dc.path) out['--ks-path'] = dc.path;
  if (dc.font) out['--ks-gamefont'] = dc.font;
  return out;
}

const emptyTheme = () => ({ form: 'classic', classicMode: 'night', gameMode: 'kimoslab' });

// ── Catálogo de departamentos ─────────────────────────────────────────────
// Genérico a cualquier empresa. Una app puede añadir los suyos con
// `wsRegisterDepartment`; el mundo no valida contra esta lista, solo la usa
// para sugerir y para colorear.
const WS_DEPARTMENTS = [
  { id: 'direccion', label: 'Dirección', emoji: '🧭', color: '#8E7B45' },
  { id: 'rrhh', label: 'Recursos Humanos', emoji: '👥', color: '#4ECDC4' },
  { id: 'finanzas', label: 'Finanzas', emoji: '💹', color: '#35C48A' },
  { id: 'contabilidad', label: 'Contabilidad', emoji: '🧾', color: '#7FA36B' },
  { id: 'marketing', label: 'Marketing', emoji: '📣', color: '#FF4FD8' },
  { id: 'ventas', label: 'Ventas', emoji: '🤝', color: '#E5A93A' },
  { id: 'produccion', label: 'Producción', emoji: '🏭', color: '#19ACB1' },
  { id: 'operaciones', label: 'Operaciones', emoji: '⚙️', color: '#7B61FF' },
  { id: 'ti', label: 'Tecnología', emoji: '💻', color: '#3860A8' },
  { id: 'compras', label: 'Compras', emoji: '📦', color: '#C9A227' },
  { id: 'legal', label: 'Legal', emoji: '⚖️', color: '#94786F' },
  { id: 'atencion', label: 'Atención al cliente', emoji: '🎧', color: '#EE5A5A' },
];
const wsDepartmentById = (id) => WS_DEPARTMENTS.find((d) => d.id === wsS(id)) || WS_DEPARTMENTS[0];
function wsRegisterDepartment(d) {
  const x = wsObj(d);
  if (!wsS(x.id).trim()) throw new Error('El departamento necesita `id`.');
  const prev = WS_DEPARTMENTS.findIndex((y) => y.id === x.id);
  const rec = { id: wsSlug(x.id), label: wsS(x.label) || wsS(x.id), emoji: wsS(x.emoji) || '🏷️',
    color: /^#[0-9a-f]{6}$/i.test(wsS(x.color)) ? wsS(x.color) : '#19ACB1' };
  if (prev >= 0) WS_DEPARTMENTS[prev] = rec; else WS_DEPARTMENTS.push(rec);
  return rec;
}

// ── Catálogo de estructuras ───────────────────────────────────────────────
// Cada estructura se dibuja distinto en cada ambientación, pero es la MISMA
// entidad del modelo: cambiar de modo no cambia el mundo, solo cómo se ve.
const WS_STRUCTURES = [
  { id: 'hq', label: 'Sede', emoji: '🏛️', w: 3, h: 2, capacity: 6,
    village: 'centro', hotel: 'recepción', territory: 'centro de mando' },
  { id: 'office', label: 'Oficina', emoji: '🏢', w: 2, h: 2, capacity: 4,
    village: 'casa', hotel: 'oficina', territory: 'puesto' },
  { id: 'lab', label: 'Laboratorio', emoji: '🔬', w: 2, h: 2, capacity: 3,
    village: 'laboratorio', hotel: 'sala técnica', territory: 'laboratorio' },
  { id: 'factory', label: 'Planta', emoji: '🏭', w: 3, h: 2, capacity: 8,
    village: 'fábrica', hotel: 'taller', territory: 'refinería' },
  { id: 'warehouse', label: 'Almacén', emoji: '📦', w: 2, h: 2, capacity: 3,
    village: 'granero', hotel: 'depósito', territory: 'depósito' },
  { id: 'shop', label: 'Tienda', emoji: '🛍️', w: 2, h: 1, capacity: 2,
    village: 'tienda', hotel: 'mostrador', territory: 'mercado' },
  { id: 'training', label: 'Formación', emoji: '🎓', w: 2, h: 2, capacity: 4,
    village: 'gimnasio', hotel: 'aula', territory: 'academia' },
  { id: 'support', label: 'Soporte', emoji: '🎧', w: 2, h: 1, capacity: 3,
    village: 'centro médico', hotel: 'conserjería', territory: 'estación de apoyo' },
  { id: 'plaza', label: 'Zona común', emoji: '🌳', w: 2, h: 2, capacity: 6,
    village: 'plaza', hotel: 'cafetería', territory: 'zona franca' },
];
const wsStructureById = (id) => WS_STRUCTURES.find((x) => x.id === wsS(id)) || WS_STRUCTURES[1];
/** Cómo se llama esa estructura en la ambientación activa. */
const wsStructureName = (id, worldKind) => {
  const st = wsStructureById(id);
  return wsS(st[wsS(worldKind) || 'village']) || st.label;
};
