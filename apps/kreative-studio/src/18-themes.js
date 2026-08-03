
// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Temas de la interfaz
//
// Dos FORMAS de ver el mismo trabajo:
//   · clásica — un estudio profesional, con modos de luz (día, atardecer,
//     noche y «vivo», que sigue la hora real).
//   · juego  — el flujo de agentes como un videojuego, con tres ambientaciones.
//
// Un tema es SOLO tokens: colores y unos pocos parámetros de decorado. No
// cambia ni el modelo ni lo que hacen los agentes; cambia cómo se lee. La
// vista Flujo tiene un renderizador por ambientación, pero todos operan sobre
// los mismos datos y con las mismas acciones.
// ═══════════════════════════════════════════════════════════════════════════

const THEME_FORMS = [
  { id: 'classic', label: 'Clásica', emoji: '▤', help: 'Estudio profesional. La luz cambia, el trabajo no.' },
  { id: 'game', label: 'Juego', emoji: '🕹️', help: 'El mismo flujo, jugable. Para revisarlo sin que pese.' },
];

/** Paletas de la forma clásica. */
const CLASSIC_MODES = [
  {
    id: 'day', label: 'Día', emoji: '☀️',
    tokens: {
      bg: '#F4F6F8', panel: '#FFFFFF', panel2: '#F0F3F6', line: '#DFE5EC', line2: '#C6D0DB',
      txt: '#101822', txt2: '#4A5768', txt3: '#7A8798', media: '#E8ECF1', checker: '#E2E7EE',
      ok: '#1E9E6A', warn: '#B7791F', bad: '#C6403C', shadow: '0 1px 2px rgba(16,24,34,.07)',
    },
  },
  {
    id: 'sunset', label: 'Atardecer', emoji: '🌇',
    tokens: {
      bg: '#241A1B', panel: '#2E2122', panel2: '#38292A', line: '#4A3435', line2: '#5E4241',
      txt: '#F6E8E0', txt2: '#C4A99E', txt3: '#94786F', media: '#1A1213', checker: '#332526',
      ok: '#8FBF6A', warn: '#E8A33D', bad: '#E8664F', shadow: '0 1px 2px rgba(0,0,0,.35)',
    },
  },
  {
    id: 'night', label: 'Noche', emoji: '🌙',
    tokens: {
      bg: '#0B0D10', panel: '#12151A', panel2: '#171B21', line: '#232932', line2: '#2E3641',
      txt: '#E7EBF0', txt2: '#98A2B0', txt3: '#6B7684', media: '#05070A', checker: '#1A1F26',
      ok: '#35C48A', warn: '#E5A93A', bad: '#EE5A5A', shadow: '0 1px 2px rgba(0,0,0,.4)',
    },
  },
  {
    id: 'live', label: 'Vivo', emoji: '🕰️',
    help: 'Sigue la hora del equipo: día, atardecer y noche.',
    tokens: null,      // se resuelve en tiempo de ejecución
  },
];

/** Ambientaciones de la forma juego. */
const GAME_MODES = [
  {
    id: 'kimoslab', label: 'KimosLab', emoji: '🔬',
    help: 'Ruta de laboratorio en píxeles, con caja de diálogo. Homenaje al RPG de bolsillo.',
    tokens: {
      bg: '#184C3C', panel: '#F8F8F0', panel2: '#E8E8D8', line: '#282828', line2: '#585858',
      txt: '#282828', txt2: '#484848', txt3: '#787878', media: '#103828', checker: '#D8D8C8',
      ok: '#38A048', warn: '#E8A020', bad: '#D83830', shadow: '0 3px 0 rgba(0,0,0,.35)',
    },
    decor: { grid: '#1E5C48', accentInk: '#3860A8', pixel: 4, font: 'ui-monospace, "Courier New", monospace' },
  },
  {
    id: 'jabotel', label: 'JABOTEL', emoji: '🏨',
    help: 'Habitación isométrica: cada agente es un mueble de la sala.',
    tokens: {
      bg: '#1B2A3A', panel: '#26384C', panel2: '#2F455C', line: '#3E5975', line2: '#52708F',
      txt: '#EAF2FA', txt2: '#A9C0D6', txt3: '#7C93AA', media: '#14212E', checker: '#223448',
      ok: '#5BD07A', warn: '#F2B33D', bad: '#EE6A5A', shadow: '0 2px 0 rgba(0,0,0,.4)',
    },
    decor: { grid: '#33506D', accentInk: '#FFCC33', pixel: 3, font: 'Verdana, Geneva, sans-serif' },
  },
  {
    id: 'spacecraft', label: 'Spacecraft', emoji: '🛸',
    help: 'Consola de mando: cola de construcción, paneles angulares y rejilla táctica.',
    tokens: {
      bg: '#07110E', panel: '#0E1D1A', panel2: '#132823', line: '#1E3B34', line2: '#2C554B',
      txt: '#D6F5E6', txt2: '#7FC4A8', txt3: '#4F8B76', media: '#040B09', checker: '#0C1916',
      ok: '#4BE3A0', warn: '#E8C24A', bad: '#FF6B5B', shadow: '0 0 0 1px rgba(75,227,160,.12)',
    },
    decor: { grid: '#123029', accentInk: '#7FE3C4', pixel: 2, font: 'ui-monospace, Menlo, monospace' },
  },
];

const themeFormById = (id) => THEME_FORMS.find((x) => x.id === id) || THEME_FORMS[0];
const classicModeById = (id) => CLASSIC_MODES.find((x) => x.id === id) || CLASSIC_MODES[2];
const gameModeById = (id) => GAME_MODES.find((x) => x.id === id) || GAME_MODES[0];

/** Qué luz toca según la hora local (para el modo Vivo). */
function modeForHour(hour) {
  const h = clamp(num(hour, 12), 0, 23);
  if (h >= 7 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'sunset';
  return 'night';
}

/**
 * Resuelve el tema efectivo. Devuelve siempre algo utilizable, aunque los
 * ajustes vengan de un bundle antiguo o con valores inventados.
 */
function resolveTheme(themeCfg, hour) {
  const t = obj(themeCfg);
  const form = themeFormById(t.form);
  if (form.id === 'game') {
    const mode = gameModeById(t.gameMode);
    return { formId: 'game', modeId: mode.id, label: mode.label, emoji: mode.emoji,
      tokens: mode.tokens, decor: obj(mode.decor), live: false };
  }
  const chosen = classicModeById(t.classicMode);
  const live = chosen.id === 'live';
  const actual = live ? classicModeById(modeForHour(hour)) : chosen;
  return { formId: 'classic', modeId: chosen.id, effectiveId: actual.id,
    label: chosen.label + (live ? ' · ' + actual.label : ''), emoji: live ? chosen.emoji : actual.emoji,
    tokens: actual.tokens, decor: {}, live };
}

/** Variables CSS del tema, listas para el atributo `style` de la raíz. */
function themeVars(theme) {
  const tk = obj(obj(theme).tokens);
  const out = {};
  const map = { bg: '--ks-bg', panel: '--ks-panel', panel2: '--ks-panel2', line: '--ks-line',
    line2: '--ks-line2', txt: '--ks-txt', txt2: '--ks-txt2', txt3: '--ks-txt3',
    media: '--ks-media', checker: '--ks-checker', ok: '--ks-ok', warn: '--ks-warn', bad: '--ks-bad',
    shadow: '--ks-shadow' };
  for (const k of Object.keys(map)) if (tk[k]) out[map[k]] = tk[k];
  const dc = obj(obj(theme).decor);
  if (dc.grid) out['--ks-grid'] = dc.grid;
  if (dc.accentInk) out['--ks-ink'] = dc.accentInk;
  if (dc.font) out['--ks-gamefont'] = dc.font;
  return out;
}

const emptyTheme = () => ({ form: 'classic', classicMode: 'night', gameMode: 'kimoslab' });
