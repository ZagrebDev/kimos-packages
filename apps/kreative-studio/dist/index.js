/**
 * Kreative Studio — plataforma de campañas publicitarias cinematográficas
 * generadas con IA, nativa de KIMOS.
 *
 * QUÉ ES: el usuario sube fotos de un producto, escribe una intención en
 * lenguaje natural ("crea una campaña premium", "quiero un comercial épico",
 * "véndelo para deportistas") y el sistema produce la CAMPAÑA COMPLETA:
 * investigación, concepto creativo, plan de funnel, storyboard con dirección
 * de fotografía, prompts optimizados por proveedor de IA, guion de voz, brief
 * de música, timeline de edición con script FFmpeg, control de marca, copy
 * para todos los canales, registro de assets, versiones y analítica de costos.
 *
 * ARQUITECTURA (Clean Architecture dentro del contrato AppShell de KIMOS):
 *
 *   ┌─ Dominio (scope de módulo, SIN React, SIN IO) ─────────────────────────┐
 *   │  utils · vocabulario de dirección · presets de estilo · base de        │
 *   │  conocimiento de mercado · REGISTRO DE PROVEEDORES · reglas de negocio │
 *   └───────────────────────────────────────────────────────────────────────┘
 *   ┌─ Aplicación (scope de módulo, puro) ──────────────────────────────────┐
 *   │  12 AGENTES especializados (cada uno independiente: recibe un estado   │
 *   │  y devuelve un fragmento nuevo) + ORQUESTADOR de pipeline con DAG,     │
 *   │  estados, tiempos, reintentos y contabilidad de costos.                │
 *   └───────────────────────────────────────────────────────────────────────┘
 *   ┌─ Adaptadores + UI (dentro de mount(shell), con React del host) ────────┐
 *   │  puertos: persistencia (saveData/items), archivos (/api/v2/files),     │
 *   │  notificación, config, documentos · registro de tools para el AGENTE   │
 *   │  DE KIMOS (que es el orquestador externo) · 21 vistas de estudio.      │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * ASPECTO Y ORGANIZACIÓN: el paquete vendorizado `packages/kimos-worldskin`
 * aporta las dos formas de ver el trabajo (clásica con modos de luz, y juego
 * con tres ambientaciones) y el MAPA DE LA ORGANIZACIÓN —departamentos,
 * procesos internos y personal, agentes de IA y personas— que se recorre en la
 * vista Organización. No es una librería en tiempo de ejecución: sus
 * fragmentos (`17`, `19`, `21`, `53`) se intercalan en este bundle durante el
 * build. Ver `packages/kimos-worldskin/docs/CONTRATO.md`.
 *
 * PROVEEDORES REEMPLAZABLES (requisito central): ningún agente conoce a un
 * proveedor concreto. Los agentes producen un `PromptSpec` NEUTRAL (sujeto,
 * cámara, óptica, luz, grade, fx, audio, formato) y el registro de proveedores
 * lo TRADUCE al dialecto de cada modelo. Añadir Midjourney v8, Kling 3 o un
 * modelo propio = añadir un descriptor al registro (`registerProvider`); el
 * núcleo no se toca. Ver `docs/ARQUITECTURA.md` y `docs/PROVIDERS.md`.
 *
 * DETERMINISMO: todo el pipeline corre sin red. La calidad no depende de que
 * haya una API key configurada: las reglas creativas, la investigación por
 * categoría, los benchmarks de canal y la ingeniería de prompts están en el
 * bundle. Las llamadas a modelos generativos (imagen/vídeo/voz) son el paso
 * de PRODUCCIÓN y se despachan como trabajos: el agente de KIMOS (o el
 * usuario) los ejecuta y registra el asset resultante con REGISTER_ASSET.
 *
 * Contrato: export default function mount(shell) -> { Component, unmount }.
 * Bundle generado por `node apps/kreative-studio/build.mjs`, que concatena
 * `src/*.js` con los fragmentos de `packages/kimos-worldskin/src/*.js`
 * ordenados por su prefijo numérico, y compone `dist/index.css` a partir de
 * `style/app.css`. NO editar nada de dist/ a mano.
 */

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Utilidades puras
// ═══════════════════════════════════════════════════════════════════════════

const KS_VERSION = '1.0.0';

const s = (v) => (v == null ? '' : String(v));
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
const numOr = (v, d) => (v == null || v === '' ? d : num(v, d));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const norm = (v) => s(v).trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = (v) => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const nowIso = () => new Date().toISOString();
const uniq = (arr) => Array.from(new Set((arr || []).filter((x) => x != null && x !== '')));
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** IDs estables por semilla para que dos ejecuciones del pipeline con el mismo
 *  brief produzcan el mismo storyboard (indispensable para diffs de versión). */
let idCounter = 0;
const newId = (p) => p + '-' + Date.now().toString(36) + '-' + (idCounter++).toString(36)
  + Math.random().toString(36).slice(2, 5);

/** Hash determinista (FNV-1a 32 bits) — usado como semilla creativa. */
function hash32(str) {
  let hv = 0x811c9dc5;
  const t = s(str);
  for (let i = 0; i < t.length; i++) {
    hv ^= t.charCodeAt(i);
    hv = (hv + ((hv << 1) + (hv << 4) + (hv << 7) + (hv << 8) + (hv << 24))) >>> 0;
  }
  return hv >>> 0;
}
/** PRNG determinista (mulberry32): misma semilla ⇒ misma campaña. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (list, r) => (list && list.length ? list[Math.floor(r() * list.length) % list.length] : null);
const pickN = (list, n, r) => {
  const pool = (list || []).slice();
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
};

const round = (v, dec) => {
  const f = Math.pow(10, dec == null ? 2 : dec);
  return Math.round(num(v, 0) * f) / f;
};
const fmtMoney = (v, cur) => {
  const c = s(cur) || 'USD';
  const n = num(v, 0);
  const dec = n !== 0 && Math.abs(n) < 1 ? 3 : 2;
  return (c === 'USD' ? '$' : c === 'EUR' ? '€' : c + ' ') + n.toFixed(dec);
};
const fmtSec = (v) => {
  const n = Math.max(0, num(v, 0));
  const m = Math.floor(n / 60);
  const sec = n - m * 60;
  return m > 0 ? m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(sec % 1 ? 1 : 0)
    : sec.toFixed(sec % 1 ? 1 : 0) + 's';
};
/** Timecode SRT: 00:00:03,500 */
const fmtTc = (v) => {
  const t = Math.max(0, num(v, 0));
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  const p2 = (x) => (x < 10 ? '0' : '') + x;
  const p3 = (x) => (x < 100 ? (x < 10 ? '00' : '0') : '') + x;
  return p2(hh) + ':' + p2(mm) + ':' + p2(ss) + ',' + p3(ms);
};
const titleCase = (v) => s(v).replace(/\b([a-záéíóúñ])/gi, (m) => m.toUpperCase());
const sentence = (v) => { const t = s(v).trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
/** Cierra una frase con punto si no acaba ya en signo de puntuación. */
const punct = (v) => {
  const t = s(v).trim().replace(/[\s,;:]+$/, '');
  return t && !/[.!?…]$/.test(t) ? t + '.' : t;
};
/** Escapa un valor para CSV (RFC 4180). */
const csvCell = (v) => {
  const t = s(v).replace(/\r?\n/g, ' ');
  return /[",;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
/** Escapa un argumento para el script de shell de FFmpeg. */
const shq = (v) => "'" + s(v).replace(/'/g, "'\\''") + "'";
/** Escapa texto para filtros de FFmpeg (drawtext/subtitles). */
const ffq = (v) => s(v).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,');

/** Reparte un total entre pesos manteniendo la suma exacta. */
function splitByWeight(total, weights) {
  const ws = arr(weights).map((w) => Math.max(0, num(w, 0)));
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  const raw = ws.map((w) => (total * w) / sum);
  const out = raw.map((v) => Math.floor(v));
  let rest = Math.round(total - out.reduce((a, b) => a + b, 0));
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < order.length && rest > 0; i++, rest--) out[order[i][1]] += 1;
  return out;
}

/** Contraste WCAG aproximado entre dos hex — usado por Brand Consistency. */
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(s(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLum(rgb) {
  const c = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastRatio(a, b) {
  const ra = hexToRgb(a); const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const la = relLum(ra); const lb = relLum(rb);
  return round((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05), 2);
}
const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(s(v).trim());

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Vocabulario de dirección cinematográfica
// Lenguaje común de los agentes. El Prompt Engineer lo traduce por proveedor.
// ═══════════════════════════════════════════════════════════════════════════

const SHOTS = [
  { id: 'extreme-close', label: 'Extreme close-up', en: 'extreme close-up macro shot', weight: 'detail' },
  { id: 'macro', label: 'Macro', en: 'macro shot, razor-thin depth of field', weight: 'detail' },
  { id: 'close', label: 'Close-up', en: 'close-up shot', weight: 'detail' },
  { id: 'medium-close', label: 'Plano medio corto', en: 'medium close-up', weight: 'subject' },
  { id: 'medium', label: 'Plano medio', en: 'medium shot', weight: 'subject' },
  { id: 'cowboy', label: 'Plano americano', en: 'cowboy shot, waist up', weight: 'subject' },
  { id: 'full', label: 'Plano entero', en: 'full body shot', weight: 'subject' },
  { id: 'wide', label: 'Plano general', en: 'wide establishing shot', weight: 'context' },
  { id: 'extreme-wide', label: 'Gran plano general', en: 'extreme wide aerial establishing shot', weight: 'context' },
  { id: 'insert', label: 'Inserto de producto', en: 'product insert shot on a turntable', weight: 'product' },
  { id: 'hero', label: 'Hero shot', en: 'hero product shot, centered, monumental', weight: 'product' },
  { id: 'ots', label: 'Sobre el hombro', en: 'over-the-shoulder shot', weight: 'subject' },
  { id: 'pov', label: 'Punto de vista', en: 'first person POV shot', weight: 'subject' },
  { id: 'top', label: 'Cenital', en: 'top-down overhead shot, flat lay', weight: 'product' },
];

const ANGLES = [
  { id: 'eye', label: 'A la altura de los ojos', en: 'eye level' },
  { id: 'low', label: 'Contrapicado', en: 'low angle, heroic perspective' },
  { id: 'high', label: 'Picado', en: 'high angle looking down' },
  { id: 'dutch', label: 'Holandés', en: 'dutch angle, 12 degree tilt' },
  { id: 'worm', label: 'Nadir', en: 'worm eye view from the floor' },
  { id: 'profile', label: 'Perfil', en: 'strict profile, 90 degrees' },
];

const MOVES = [
  { id: 'static', label: 'Estático', en: 'locked off tripod shot, no camera movement', energy: 1 },
  { id: 'slow-push', label: 'Push-in lento', en: 'very slow dolly push in', energy: 2 },
  { id: 'pull-back', label: 'Retroceso', en: 'slow dolly pull back revealing the scene', energy: 2 },
  { id: 'orbit', label: 'Órbita', en: 'smooth 180 degree orbital camera move around the subject', energy: 3 },
  { id: 'crane-up', label: 'Grúa ascendente', en: 'crane shot rising up', energy: 3 },
  { id: 'tracking', label: 'Travelling lateral', en: 'lateral tracking shot on a dolly, parallel to the subject', energy: 3 },
  { id: 'handheld', label: 'Cámara en mano', en: 'handheld camera, subtle organic shake', energy: 4 },
  { id: 'whip-pan', label: 'Whip pan', en: 'fast whip pan with motion blur', energy: 5 },
  { id: 'snorricam', label: 'Snorricam', en: 'snorricam rig locked to the subject', energy: 5 },
  { id: 'fpv', label: 'Dron FPV', en: 'aggressive FPV drone fly-through', energy: 5 },
  { id: 'rack-focus', label: 'Rack focus', en: 'rack focus from foreground to the product', energy: 2 },
  { id: 'parallax', label: 'Parallax', en: 'slow parallax move with strong foreground separation', energy: 2 },
];

const LENSES = [
  { id: '14mm', label: '14 mm', en: '14mm ultra wide lens, dramatic perspective', mm: 14 },
  { id: '24mm', label: '24 mm', en: '24mm wide angle lens', mm: 24 },
  { id: '35mm', label: '35 mm', en: '35mm lens, natural documentary framing', mm: 35 },
  { id: '50mm', label: '50 mm', en: '50mm prime lens, human perspective', mm: 50 },
  { id: '85mm', label: '85 mm', en: '85mm portrait lens, creamy bokeh', mm: 85 },
  { id: '135mm', label: '135 mm', en: '135mm telephoto, compressed background', mm: 135 },
  { id: '100mm-macro', label: '100 mm macro', en: '100mm macro lens, 1:1 magnification', mm: 100 },
  { id: 'anamorphic', label: 'Anamórfico 40 mm', en: '40mm anamorphic lens, oval bokeh, horizontal blue flares', mm: 40 },
  { id: 'probe', label: 'Probe lens', en: 'laowa probe lens, extreme depth, close to the surface', mm: 24 },
];

const LIGHTING = [
  { id: 'golden', label: 'Hora dorada', en: 'golden hour backlight, warm rim light, long shadows' },
  { id: 'blue-hour', label: 'Hora azul', en: 'blue hour ambient light, cool cyan shadows' },
  { id: 'softbox', label: 'Softbox de estudio', en: 'large softbox key light, controlled falloff, seamless backdrop' },
  { id: 'hard-key', label: 'Luz dura', en: 'single hard key light, crisp defined shadows' },
  { id: 'rembrandt', label: 'Rembrandt', en: 'rembrandt lighting, triangle highlight on the cheek' },
  { id: 'rim', label: 'Contraluz', en: 'strong rim lighting, subject separated from a dark background' },
  { id: 'neon', label: 'Neón', en: 'neon practical lights, magenta and cyan spill, wet reflections' },
  { id: 'chiaroscuro', label: 'Claroscuro', en: 'chiaroscuro, single source, deep black falloff' },
  { id: 'overcast', label: 'Nublado', en: 'soft overcast daylight, even and shadowless' },
  { id: 'volumetric', label: 'Volumétrica', en: 'volumetric god rays through atmospheric haze' },
  { id: 'strobe', label: 'Flash de estudio', en: 'high speed strobe freeze, crisp specular highlights' },
  { id: 'gradient', label: 'Gradiente de color', en: 'dual gradient gel lighting, complementary colors' },
];

const GRADES = [
  { id: 'teal-orange', label: 'Teal & orange', en: 'teal and orange blockbuster grade, filmic contrast' },
  { id: 'bleach', label: 'Bleach bypass', en: 'bleach bypass, desaturated with crushed blacks' },
  { id: 'kodak', label: 'Kodak cálido', en: 'Kodak Portra emulation, warm skin, soft highlight rolloff' },
  { id: 'mono', label: 'Monocromo', en: 'high contrast black and white, silver halide grain' },
  { id: 'pastel', label: 'Pastel', en: 'low contrast pastel palette, lifted blacks' },
  { id: 'noir', label: 'Noir', en: 'noir grade, deep shadows, single warm highlight' },
  { id: 'clean', label: 'Comercial limpio', en: 'clean commercial grade, true whites, punchy saturation' },
  { id: 'cyberpunk', label: 'Cyberpunk', en: 'cyberpunk grade, magenta highlights, cyan shadows' },
  { id: 'earth', label: 'Terroso', en: 'earthy natural grade, muted greens and warm browns' },
];

const FX = [
  { id: 'slow-motion', label: 'Cámara lenta', en: 'super slow motion at 1000fps' },
  { id: 'speed-ramp', label: 'Speed ramp', en: 'speed ramp from slow motion into real time' },
  { id: 'motion-blur', label: 'Motion blur', en: 'natural motion blur, 180 degree shutter' },
  { id: 'particles', label: 'Partículas', en: 'floating dust particles catching the light' },
  { id: 'splash', label: 'Salpicadura', en: 'high speed liquid splash frozen mid air' },
  { id: 'smoke', label: 'Humo', en: 'slow drifting smoke, atmospheric haze' },
  { id: 'sparks', label: 'Chispas', en: 'sparks and embers flying past the lens' },
  { id: 'condensation', label: 'Condensación', en: 'cold condensation droplets forming on the surface' },
  { id: 'light-streaks', label: 'Estelas de luz', en: 'long exposure light streaks' },
  { id: 'explode-view', label: 'Vista explotada', en: 'exploded view, components floating apart in mid air' },
  { id: 'morph', label: 'Morphing', en: 'seamless morph transition between two states' },
  { id: 'lens-flare', label: 'Destello', en: 'anamorphic horizontal lens flare' },
  { id: 'freeze', label: 'Congelado', en: 'freeze frame with the world moving around it' },
  { id: 'none', label: 'Sin efecto', en: '' },
];

const TRANSITIONS = [
  { id: 'cut', label: 'Corte', ff: null, dur: 0 },
  { id: 'fade', label: 'Fundido', ff: 'fade', dur: 0.4 },
  { id: 'fadeblack', label: 'A negro', ff: 'fadeblack', dur: 0.5 },
  { id: 'fadewhite', label: 'A blanco', ff: 'fadewhite', dur: 0.35 },
  { id: 'dissolve', label: 'Encadenado', ff: 'dissolve', dur: 0.5 },
  { id: 'wipeleft', label: 'Barrido', ff: 'wipeleft', dur: 0.35 },
  { id: 'slideup', label: 'Deslizamiento', ff: 'slideup', dur: 0.35 },
  { id: 'smoothleft', label: 'Suave lateral', ff: 'smoothleft', dur: 0.4 },
  { id: 'circleopen', label: 'Iris', ff: 'circleopen', dur: 0.5 },
  { id: 'pixelize', label: 'Pixelado', ff: 'pixelize', dur: 0.3 },
  { id: 'zoomin', label: 'Zoom', ff: 'zoomin', dur: 0.3 },
];

const byId = (list, id, fb) => list.find((x) => x.id === id) || (fb === undefined ? list[0] : fb);
const enOf = (list, id) => { const x = byId(list, id, null); return x ? x.en : ''; };
const labelOf = (list, id) => { const x = byId(list, id, null); return x ? x.label : s(id); };

// ── Formatos de exportación ───────────────────────────────────────────────
const RESOLUTIONS = [
  { id: '1080', label: 'Full HD 1080', base: 1080 },
  { id: '2k', label: '2K', base: 1440 },
  { id: '4k', label: '4K UHD', base: 2160 },
];
const ASPECTS = [
  { id: '16:9', label: '16:9 · Horizontal', w: 16, hh: 9 },
  { id: '9:16', label: '9:16 · Vertical', w: 9, hh: 16 },
  { id: '1:1', label: '1:1 · Cuadrado', w: 1, hh: 1 },
  { id: '4:5', label: '4:5 · Vertical feed', w: 4, hh: 5 },
  { id: '2.39:1', label: '2.39:1 · Scope', w: 2.39, hh: 1 },
];
/**
 * Dimensiones en píxeles. La resolución nombra siempre el LADO CORTO, que es
 * la convención de la industria: «1080 vertical» es 1080×1920, no 607×1080.
 * Se redondea a par porque H.264 con yuv420p exige dimensiones pares.
 */
function dimsFor(aspectId, resId) {
  const a = byId(ASPECTS, aspectId);
  const r = byId(RESOLUTIONS, resId);
  const even = (n) => Math.round(n / 2) * 2;
  if (a.w >= a.hh) return { w: even((r.base * a.w) / a.hh), h: even(r.base) };
  return { w: even(r.base), h: even((r.base * a.hh) / a.w) };
}

// ── Canales / plataformas publicitarias ───────────────────────────────────
// `ctr`, `cpm` y `cvr` son BENCHMARKS DE REFERENCIA de industria usados para
// proyectar, no promesas: Analytics los etiqueta siempre como estimación.
const PLATFORMS = [
  { id: 'meta-feed', label: 'Meta · Feed', family: 'meta', aspects: ['1:1', '4:5'], maxSec: 60,
    copy: { primary: 125, headline: 40, desc: 30 }, ctr: 0.011, cpm: 8.5, cvr: 0.021, hookSec: 3 },
  { id: 'meta-reels', label: 'Meta · Reels', family: 'meta', aspects: ['9:16'], maxSec: 30,
    copy: { primary: 72, headline: 40, desc: 30 }, ctr: 0.014, cpm: 6.2, cvr: 0.018, hookSec: 2 },
  { id: 'meta-stories', label: 'Meta · Stories', family: 'meta', aspects: ['9:16'], maxSec: 15,
    copy: { primary: 60, headline: 40, desc: 25 }, ctr: 0.009, cpm: 5.4, cvr: 0.015, hookSec: 2 },
  { id: 'instagram', label: 'Instagram · Orgánico', family: 'meta', aspects: ['4:5', '9:16'], maxSec: 90,
    copy: { primary: 2200, headline: 40, desc: 0 }, ctr: 0.008, cpm: 7.1, cvr: 0.012, hookSec: 3 },
  { id: 'tiktok', label: 'TikTok Ads', family: 'tiktok', aspects: ['9:16'], maxSec: 60,
    copy: { primary: 100, headline: 40, desc: 0 }, ctr: 0.016, cpm: 4.8, cvr: 0.014, hookSec: 2 },
  { id: 'youtube-shorts', label: 'YouTube Shorts', family: 'youtube', aspects: ['9:16'], maxSec: 60,
    copy: { primary: 100, headline: 60, desc: 120 }, ctr: 0.012, cpm: 5.9, cvr: 0.013, hookSec: 2 },
  { id: 'youtube-instream', label: 'YouTube · In-stream', family: 'youtube', aspects: ['16:9'], maxSec: 30,
    copy: { primary: 90, headline: 60, desc: 120 }, ctr: 0.006, cpm: 11.2, cvr: 0.019, hookSec: 5 },
  { id: 'linkedin', label: 'LinkedIn Ads', family: 'linkedin', aspects: ['1:1', '16:9'], maxSec: 30,
    copy: { primary: 150, headline: 70, desc: 70 }, ctr: 0.005, cpm: 33.0, cvr: 0.028, hookSec: 4 },
  { id: 'google-demand', label: 'Google · Demand Gen', family: 'google', aspects: ['16:9', '1:1', '4:5'], maxSec: 30,
    copy: { primary: 90, headline: 40, desc: 90 }, ctr: 0.007, cpm: 9.4, cvr: 0.024, hookSec: 3 },
  { id: 'google-search', label: 'Google · Búsqueda', family: 'google', aspects: [], maxSec: 0,
    copy: { primary: 0, headline: 30, desc: 90 }, ctr: 0.038, cpm: 0, cvr: 0.035, hookSec: 0 },
];

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Marketplace de estilos (dirección creativa envasada)
// Un estilo define TODO el criterio estético: paleta, óptica, luz, grade,
// ritmo, música, tipografía, transiciones y tono verbal. Cambiar de estilo
// regenera la campaña entera de forma coherente.
// ═══════════════════════════════════════════════════════════════════════════

const STYLES = [
  {
    id: 'premium-cinematic', name: 'Premium Cinematic', emoji: '🥃',
    tagline: 'Lujo contenido, silencio, materia noble.',
    keywords: ['premium', 'lujo', 'elegante', 'exclusivo', 'cinematografico', 'sofisticado', 'alta gama', 'refinado'],
    palette: { primary: '#0B0B0D', secondary: '#C9A227', accent: '#E8E4DC', dark: '#000000', light: '#F5F2EC' },
    lighting: ['chiaroscuro', 'rim', 'volumetric'], grades: ['noir', 'kodak'],
    lenses: ['85mm', '100mm-macro', 'anamorphic'], moves: ['slow-push', 'orbit', 'rack-focus'],
    shots: ['macro', 'hero', 'close', 'insert'], fx: ['particles', 'smoke', 'lens-flare'],
    transitions: ['dissolve', 'fadeblack', 'smoothleft'],
    pacing: { avgShotSec: 3.2, cutsPerMin: 19, energy: 2 },
    music: { genre: 'orchestral cinematic', bpm: 72, mood: 'contenida, solemne, con crescendo final',
      instruments: ['cuerdas graves', 'piano preparado', 'coro sutil', 'sub bass'] },
    typography: { display: 'Serif de alto contraste (Didot / Playfair)', body: 'Grotesca neutra (Inter / Helvetica Now)', tracking: 'amplio' },
    voice: { tone: 'grave, pausado, con autoridad', pace: 0.86, style: 'narrador de marca' },
    tone: 'sobrio, aspiracional, sin superlativos baratos',
    filmStock: 'Kodak Vision3 500T', era: 'contemporáneo atemporal',
    negative: ['plástico', 'saturación excesiva', 'stock photo', 'tipografía comic', 'ruido visual'],
    refs: ['Apple product films', 'campañas de relojería suiza', 'Villeneuve para publicidad'],
  },
  {
    id: 'epic-sport', name: 'Épico Deportivo', emoji: '🔥',
    tagline: 'Sudor, impacto, superación. El cuerpo como épica.',
    keywords: ['epico', 'deportivo', 'deportistas', 'atleta', 'potente', 'energia', 'fuerza', 'entrenamiento', 'gym', 'rendimiento'],
    palette: { primary: '#111418', secondary: '#FF3B1F', accent: '#F2F4F7', dark: '#05070A', light: '#FFFFFF' },
    lighting: ['hard-key', 'rim', 'strobe'], grades: ['bleach', 'teal-orange'],
    lenses: ['24mm', '35mm', '135mm'], moves: ['handheld', 'whip-pan', 'fpv', 'tracking'],
    shots: ['close', 'medium', 'extreme-close', 'wide'], fx: ['slow-motion', 'speed-ramp', 'sparks', 'motion-blur'],
    transitions: ['cut', 'zoomin', 'wipeleft'],
    pacing: { avgShotSec: 1.4, cutsPerMin: 43, energy: 5 },
    music: { genre: 'trailer híbrido / drums & bass', bpm: 148, mood: 'brutal, ascendente, con drop',
      instruments: ['taikos', 'braams', 'sintetizador distorsionado', 'palmas'] },
    typography: { display: 'Sans condensada extra bold (Druk / Anton)', body: 'Sans geométrica bold', tracking: 'cerrado' },
    voice: { tone: 'intenso, entrecortado, cercano al micrófono', pace: 1.08, style: 'monólogo interior' },
    tone: 'directo, imperativo, sin adornos',
    filmStock: 'digital ARRI, alto ISO', era: 'ahora',
    negative: ['poses sonrientes de stock', 'gimnasio vacío iluminado plano', 'cámara lenta sin motivo'],
    refs: ['Nike "Winner Stays"', 'Under Armour "Rule Yourself"', 'campañas de crossfit'],
  },
  {
    id: 'nordic-minimal', name: 'Minimal Nórdico', emoji: '🕊️',
    tagline: 'Aire, luz difusa y una sola idea por plano.',
    keywords: ['minimal', 'minimalista', 'limpio', 'nordico', 'simple', 'clean', 'esencial', 'calma', 'zen'],
    palette: { primary: '#F7F5F2', secondary: '#2B2B2B', accent: '#A9B7A5', dark: '#1A1A1A', light: '#FFFFFF' },
    lighting: ['overcast', 'softbox', 'gradient'], grades: ['pastel', 'clean'],
    lenses: ['50mm', '85mm', '35mm'], moves: ['static', 'slow-push', 'parallax'],
    shots: ['top', 'insert', 'medium', 'close'], fx: ['none', 'particles'],
    transitions: ['fade', 'dissolve', 'smoothleft'],
    pacing: { avgShotSec: 4.0, cutsPerMin: 15, energy: 1 },
    music: { genre: 'ambient minimal', bpm: 84, mood: 'serena, cálida, casi silencio',
      instruments: ['piano con fieltro', 'pads', 'vinilo suave'] },
    typography: { display: 'Grotesca neutra light (Söhne / Neue Haas)', body: 'La misma familia en regular', tracking: 'normal' },
    voice: { tone: 'suave, cercano, susurrado', pace: 0.9, style: 'confidencia' },
    tone: 'honesto, breve, sin marketing',
    filmStock: 'Fuji Pro 400H', era: 'contemporáneo escandinavo',
    negative: ['fondos recargados', 'colores saturados', 'texto sobre texto', 'sombras duras'],
    refs: ['Muji', 'Aesop', 'catálogos de diseño danés'],
  },
  {
    id: 'street-energy', name: 'Street Energy', emoji: '🛹',
    tagline: 'Cultura urbana, cámara viva, imperfección deliberada.',
    keywords: ['urbano', 'street', 'joven', 'callejero', 'viral', 'ugc', 'gen z', 'tiktok', 'fresco', 'divertido'],
    palette: { primary: '#151515', secondary: '#D8FF3E', accent: '#FF4FD8', dark: '#0A0A0A', light: '#FAFAFA' },
    lighting: ['neon', 'hard-key', 'golden'], grades: ['cyberpunk', 'clean'],
    lenses: ['14mm', '24mm', '35mm'], moves: ['handheld', 'whip-pan', 'snorricam'],
    shots: ['pov', 'medium-close', 'wide', 'close'], fx: ['speed-ramp', 'light-streaks', 'freeze'],
    transitions: ['cut', 'pixelize', 'slideup', 'zoomin'],
    pacing: { avgShotSec: 1.1, cutsPerMin: 54, energy: 5 },
    music: { genre: 'hip hop / hyperpop', bpm: 132, mood: 'juguetona, con bajo dominante',
      instruments: ['808', 'hi-hats rápidos', 'sample vocal cortado'] },
    typography: { display: 'Sans display con outline (Monument Extended)', body: 'Sans bold', tracking: 'cerrado' },
    voice: { tone: 'natural, hablado, sin locución impostada', pace: 1.12, style: 'testimonial a cámara' },
    tone: 'coloquial, con humor, tuteo',
    filmStock: 'iPhone + grano añadido', era: 'ahora mismo',
    negative: ['aspecto corporativo', 'locución de radio', 'stock photo sonriente'],
    refs: ['campañas de Liquid Death', 'Duolingo social', 'skate videos'],
  },
  {
    id: 'tech-future', name: 'Tech Futurista', emoji: '⚡',
    tagline: 'Precisión, datos e ingeniería como espectáculo.',
    keywords: ['tecnologia', 'tech', 'futurista', 'innovacion', 'digital', 'software', 'saas', 'ia', 'gadget', 'moderno'],
    palette: { primary: '#05070E', secondary: '#19ACB1', accent: '#7B61FF', dark: '#000208', light: '#E9F6F7' },
    lighting: ['gradient', 'rim', 'volumetric'], grades: ['cyberpunk', 'clean'],
    lenses: ['100mm-macro', 'probe', '50mm'], moves: ['orbit', 'slow-push', 'parallax'],
    shots: ['macro', 'insert', 'hero', 'top'], fx: ['explode-view', 'light-streaks', 'morph'],
    transitions: ['smoothleft', 'circleopen', 'dissolve'],
    pacing: { avgShotSec: 2.4, cutsPerMin: 25, energy: 3 },
    music: { genre: 'synth cinematic', bpm: 110, mood: 'precisa, en construcción',
      instruments: ['arpegio analógico', 'sub pulsante', 'foley digital'] },
    typography: { display: 'Sans técnica (Space Grotesk / Suisse Intl Mono)', body: 'Sans neutra', tracking: 'normal' },
    voice: { tone: 'claro, articulado, sin dramatismo', pace: 1.0, style: 'explicativo' },
    tone: 'preciso, con cifras, sin hipérbole',
    filmStock: 'digital limpio, sin grano', era: 'próxima década',
    negative: ['personas mirando pantallas genéricas', 'hologramas azules cliché', 'circuitos de stock'],
    refs: ['keynotes de producto', 'Rimac / Tesla films', 'Framer / Linear'],
  },
  {
    id: 'gourmet-macro', name: 'Gourmet Macro', emoji: '🍯',
    tagline: 'Textura comestible: el apetito entra por el detalle.',
    keywords: ['comida', 'alimento', 'bebida', 'gourmet', 'sabor', 'restaurante', 'cafe', 'delicioso', 'receta'],
    palette: { primary: '#2A1B12', secondary: '#E0803A', accent: '#F6E7CE', dark: '#150C07', light: '#FFF8EF' },
    lighting: ['hard-key', 'rim', 'golden'], grades: ['kodak', 'earth'],
    lenses: ['100mm-macro', 'probe', '85mm'], moves: ['slow-push', 'orbit', 'rack-focus'],
    shots: ['macro', 'extreme-close', 'top', 'insert'], fx: ['slow-motion', 'splash', 'smoke', 'condensation'],
    transitions: ['dissolve', 'fade', 'smoothleft'],
    pacing: { avgShotSec: 2.2, cutsPerMin: 27, energy: 3 },
    music: { genre: 'acústico cálido', bpm: 96, mood: 'apetitosa, con foley protagonista',
      instruments: ['guitarra nylon', 'percusión de manos', 'foley de cocina'] },
    typography: { display: 'Serif humanista (Recoleta)', body: 'Sans redondeada', tracking: 'normal' },
    voice: { tone: 'cálido, apetitoso, con pausas', pace: 0.92, style: 'sensorial' },
    tone: 'sensorial, con verbos de textura',
    filmStock: 'Kodak Gold 200', era: 'artesanal contemporáneo',
    negative: ['comida fría de plástico', 'iluminación cenital plana', 'platos desordenados'],
    refs: ['Chef\'s Table', 'campañas de Häagen-Dazs', 'foodfilm de alta velocidad'],
  },
  {
    id: 'editorial-fashion', name: 'Editorial Fashion', emoji: '👗',
    tagline: 'Actitud, silueta y composición de portada.',
    keywords: ['moda', 'ropa', 'fashion', 'estilo', 'editorial', 'belleza', 'pasarela', 'coleccion', 'diseno'],
    palette: { primary: '#F2EFEA', secondary: '#111111', accent: '#B23A48', dark: '#0D0D0D', light: '#FFFFFF' },
    lighting: ['strobe', 'rembrandt', 'gradient'], grades: ['mono', 'pastel'],
    lenses: ['85mm', '135mm', '50mm'], moves: ['static', 'whip-pan', 'tracking'],
    shots: ['full', 'medium', 'close', 'cowboy'], fx: ['freeze', 'motion-blur', 'light-streaks'],
    transitions: ['cut', 'wipeleft', 'fadewhite'],
    pacing: { avgShotSec: 1.8, cutsPerMin: 33, energy: 4 },
    music: { genre: 'electrónica minimal de pasarela', bpm: 124, mood: 'fría, rítmica, repetitiva',
      instruments: ['caja seca', 'bajo sintético', 'texturas metálicas'] },
    typography: { display: 'Serif editorial extra light en caja alta', body: 'Grotesca fina', tracking: 'muy amplio' },
    voice: { tone: 'neutro, casi ausente; el silencio manda', pace: 0.95, style: 'mínimo' },
    tone: 'aforístico, pocas palabras',
    filmStock: 'Ilford HP5 push', era: 'referencia noventas',
    negative: ['sonrisas comerciales', 'fondos con logotipos', 'poses de catálogo'],
    refs: ['editoriales de Vogue Italia', 'campañas Jacquemus', 'Helmut Lang archive'],
  },
  {
    id: 'warm-lifestyle', name: 'Lifestyle Cálido', emoji: '🏡',
    tagline: 'Gente real, casas reales, luz de ventana.',
    keywords: ['hogar', 'familia', 'lifestyle', 'natural', 'cotidiano', 'bienestar', 'salud', 'bebe', 'mascota', 'cercano'],
    palette: { primary: '#FBF6F0', secondary: '#8C6A4E', accent: '#7FA36B', dark: '#2C241E', light: '#FFFFFF' },
    lighting: ['overcast', 'golden', 'softbox'], grades: ['kodak', 'earth'],
    lenses: ['35mm', '50mm', '85mm'], moves: ['handheld', 'slow-push', 'parallax'],
    shots: ['medium', 'close', 'wide', 'insert'], fx: ['particles', 'none'],
    transitions: ['dissolve', 'fade', 'smoothleft'],
    pacing: { avgShotSec: 3.0, cutsPerMin: 20, energy: 2 },
    music: { genre: 'folk acústico', bpm: 92, mood: 'luminosa, sin pretensión',
      instruments: ['guitarra acústica', 'ukelele', 'silbido', 'palmas suaves'] },
    typography: { display: 'Serif suave (Tiempos)', body: 'Sans humanista', tracking: 'normal' },
    voice: { tone: 'cercano, natural, con sonrisa audible', pace: 0.98, style: 'conversacional' },
    tone: 'cálido, en segunda persona, sin tecnicismos',
    filmStock: 'Kodak Portra 400', era: 'presente doméstico',
    negative: ['casas de catálogo sin usar', 'actores demasiado perfectos', 'luz artificial fría'],
    refs: ['campañas de IKEA', 'Airbnb films', 'documental doméstico'],
  },
  {
    id: 'retro-90s', name: 'Retro 90s', emoji: '📼',
    tagline: 'VHS, saturación y nostalgia deliberada.',
    keywords: ['retro', 'vintage', 'noventa', 'nostalgia', 'analogico', 'vhs', 'clasico', 'antiguo'],
    palette: { primary: '#1B1035', secondary: '#FF6B6B', accent: '#4ECDC4', dark: '#0E0820', light: '#FFE66D' },
    lighting: ['neon', 'hard-key', 'gradient'], grades: ['cyberpunk', 'clean'],
    lenses: ['24mm', '35mm', '50mm'], moves: ['static', 'whip-pan', 'crane-up'],
    shots: ['medium', 'wide', 'close', 'hero'], fx: ['light-streaks', 'freeze', 'morph'],
    transitions: ['wipeleft', 'pixelize', 'circleopen'],
    pacing: { avgShotSec: 2.0, cutsPerMin: 30, energy: 4 },
    music: { genre: 'synthwave', bpm: 118, mood: 'nostálgica y brillante',
      instruments: ['sintetizador FM', 'caja con reverb larga', 'bajo slap'] },
    typography: { display: 'Sans geométrica con sombra dura', body: 'Sans bold', tracking: 'amplio' },
    voice: { tone: 'entusiasta, casi de teletienda pero con ironía', pace: 1.05, style: 'presentador' },
    tone: 'divertido, exagerado con guiño',
    filmStock: 'VHS con aberración cromática', era: '1994',
    negative: ['aspecto moderno y limpio', 'tipografía actual', 'grading neutro'],
    refs: ['spots de los noventa', 'Stranger Things', 'MTV bumpers'],
  },
  {
    id: 'luxury-noir', name: 'Luxury Noir', emoji: '🖤',
    tagline: 'Deseo, sombra y una sola fuente de luz.',
    keywords: ['noir', 'oscuro', 'misterio', 'perfume', 'joyeria', 'seduccion', 'nocturno', 'exclusivo', 'deseo'],
    palette: { primary: '#000000', secondary: '#8E7B45', accent: '#C0C0C0', dark: '#000000', light: '#D9D4CA' },
    lighting: ['chiaroscuro', 'rim', 'neon'], grades: ['noir', 'mono'],
    lenses: ['85mm', 'anamorphic', '135mm'], moves: ['slow-push', 'orbit', 'rack-focus'],
    shots: ['extreme-close', 'close', 'hero', 'profile'], fx: ['smoke', 'particles', 'lens-flare'],
    transitions: ['fadeblack', 'dissolve', 'cut'],
    pacing: { avgShotSec: 2.6, cutsPerMin: 23, energy: 3 },
    music: { genre: 'trip hop oscuro', bpm: 88, mood: 'magnética, con silencios',
      instruments: ['contrabajo', 'vocal etérea', 'percusión con reverb'] },
    typography: { display: 'Serif condensada en caja alta', body: 'Grotesca fina', tracking: 'muy amplio' },
    voice: { tone: 'susurrado, íntimo, muy cerca del micrófono', pace: 0.82, style: 'seductor' },
    tone: 'evocador, elíptico, casi poético',
    filmStock: 'Cinestill 800T', era: 'noche eterna',
    negative: ['luz plana', 'fondo blanco', 'explicaciones largas', 'colores cálidos brillantes'],
    refs: ['campañas de fragancias', 'Dior films', 'Wong Kar-wai'],
  },
];

const styleById = (id) => STYLES.find((x) => x.id === id) || STYLES[0];

/** Objetivos de campaña (definen el funnel y el peso de cada mensaje). */
const OBJECTIVES = [
  { id: 'awareness', label: 'Notoriedad', kpi: 'CPM / alcance / VTR', weight: { hook: 3, proof: 1, offer: 1 } },
  { id: 'consideration', label: 'Consideración', kpi: 'CTR / tiempo de visionado', weight: { hook: 2, proof: 3, offer: 2 } },
  { id: 'conversion', label: 'Conversión', kpi: 'ROAS / CPA / CVR', weight: { hook: 2, proof: 2, offer: 3 } },
  { id: 'launch', label: 'Lanzamiento', kpi: 'alcance + CVR de preventa', weight: { hook: 3, proof: 2, offer: 2 } },
  { id: 'remarketing', label: 'Remarketing', kpi: 'ROAS / frecuencia', weight: { hook: 1, proof: 3, offer: 3 } },
];
const objectiveById = (id) => OBJECTIVES.find((x) => x.id === id) || OBJECTIVES[0];

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Base de conocimiento de mercado
// Alimenta al Research Agent sin depender de red. Es un modelo de categorías
// con sus códigos visuales, objeciones, disparadores de compra, arquetipos de
// competencia y estacionalidad. Ampliable: añadir una entrada = añadir un
// nicho soportado.
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  {
    id: 'apparel', label: 'Moda y textil', style: 'editorial-fashion',
    keywords: ['ropa', 'camisa', 'camiseta', 'polera', 'vestido', 'pantalon', 'chaqueta', 'moda', 'prenda', 'textil', 'zapatilla', 'calzado', 'bolso', 'gorra', 'sudadera'],
    trends: ['Consumo de segunda mano y reventa como norma cultural', 'Trazabilidad del material como argumento de venta', 'Drops limitados en vez de temporadas', 'Vídeo de prueba real (try-on) por encima del render'],
    audience: ['Compra por identidad, no por necesidad', 'Decide en menos de 5 segundos de scroll', 'Consulta reseñas de talla antes que el precio'],
    objections: ['¿Me quedará bien la talla?', '¿La calidad aguanta lavados?', '¿Cuánto tarda y cuánto cuesta devolver?'],
    triggers: ['Ver la prenda en movimiento sobre una persona real', 'Detalle macro de costura y tejido', 'Prueba social de gente parecida a mí'],
    visualCodes: ['Textura de tejido en macro', 'Movimiento del paño', 'Fondo neutro que no compite', 'Piel real sin retoque plástico'],
    competitors: ['Marca global de fast fashion (precio y volumen)', 'Marca de autor local (relato y escasez)', 'Marketplace agregador (surtido y logística)'],
    channels: ['meta-reels', 'instagram', 'tiktok', 'meta-feed'],
    seasonality: 'Picos en cambio de estación, Black Friday y rebajas.',
    priceLogic: 'valor por uso y durabilidad',
  },
  {
    id: 'sportswear', label: 'Deporte y rendimiento', style: 'epic-sport',
    keywords: ['deporte', 'running', 'gym', 'fitness', 'entrenamiento', 'atleta', 'ciclismo', 'futbol', 'crossfit', 'suplemento', 'proteina', 'creatina', 'padel', 'trail'],
    trends: ['Rendimiento medible: el dato como prueba', 'Comunidad y reto colectivo por encima del héroe solitario', 'Recuperación y sueño como nueva frontera', 'Híbrido fuerza + resistencia'],
    audience: ['Se identifica con el esfuerzo, no con el resultado', 'Confía en atletas de nicho más que en estrellas', 'Compra para sostener un hábito, no un capricho'],
    objections: ['¿De verdad mejora mi marca?', '¿Aguanta el uso intensivo?', '¿Está respaldado por evidencia?'],
    triggers: ['Prueba de resistencia en condiciones extremas', 'Antes/después medible', 'Testimonio de alguien de mi nivel'],
    visualCodes: ['Sudor y respiración visibles', 'Cámara lenta en el punto de máxima tensión', 'Contraluz sobre piel', 'Suelo, polvo, textura de esfuerzo'],
    competitors: ['Gigante deportivo (presupuesto y fichajes)', 'Marca técnica de nicho (credibilidad)', 'Marca directa al consumidor (precio y comunidad)'],
    channels: ['tiktok', 'meta-reels', 'youtube-shorts', 'meta-feed'],
    seasonality: 'Enero, primavera pre-verano y temporada de maratones.',
    priceLogic: 'inversión en rendimiento',
  },
  {
    id: 'tech', label: 'Tecnología y electrónica', style: 'tech-future',
    keywords: ['tecnologia', 'gadget', 'electronica', 'auricular', 'audifono', 'telefono', 'movil', 'laptop', 'computador', 'camara', 'drone', 'smartwatch', 'reloj inteligente', 'bateria', 'cargador', 'teclado', 'monitor'],
    trends: ['IA integrada como argumento por defecto', 'Autonomía y reparabilidad como diferencial', 'Diseño silencioso frente a la ostentación', 'Ecosistema por encima del dispositivo suelto'],
    audience: ['Compara especificaciones antes de decidir', 'Lee reseñas técnicas y ve unboxings', 'Teme la obsolescencia rápida'],
    objections: ['¿Es compatible con lo que ya tengo?', '¿Cuánto dura la batería de verdad?', '¿Habrá soporte y actualizaciones?'],
    triggers: ['Demostración de la función clave en 3 segundos', 'Comparativa honesta contra la alternativa', 'Detalle constructivo en macro'],
    visualCodes: ['Macro de materiales y mecanizado', 'Vista explotada de componentes', 'Interfaz real, no maqueta', 'Luz de gradiente sobre superficie mate'],
    competitors: ['Fabricante líder (marca y ecosistema)', 'Retador con mejor relación precio/prestaciones', 'Genérico blanco (solo precio)'],
    channels: ['youtube-instream', 'meta-feed', 'google-demand', 'youtube-shorts'],
    seasonality: 'Lanzamientos de otoño, Black Friday y vuelta al cole.',
    priceLogic: 'coste por año de uso',
  },
  {
    id: 'beauty', label: 'Belleza y cuidado personal', style: 'nordic-minimal',
    keywords: ['belleza', 'skincare', 'crema', 'serum', 'cosmetico', 'maquillaje', 'perfume', 'fragancia', 'shampoo', 'cabello', 'piel', 'labial', 'protector solar'],
    trends: ['Ingredientes explicados: el consumidor lee la fórmula', 'Rutinas más cortas y sinceras', 'Dermatología divulgada en vídeo corto', 'Envase recargable como señal de marca'],
    audience: ['Desconfía de promesas milagrosas', 'Busca resultados con evidencia y plazos', 'Compra por recomendación de pares y de profesionales'],
    objections: ['¿Sirve para mi tipo de piel?', '¿En cuánto tiempo se nota?', '¿Irrita o tiene ingredientes que evito?'],
    triggers: ['Textura del producto en macro', 'Antes/después con la misma luz', 'Explicación del principio activo en lenguaje simple'],
    visualCodes: ['Gotas y texturas en cámara lenta', 'Piel real con poros visibles', 'Fondo limpio de un solo color', 'Manos aplicando el producto'],
    competitors: ['Casa cosmética global (distribución)', 'Marca de farmacia/dermo (credibilidad clínica)', 'Marca indie viral (relato y comunidad)'],
    channels: ['tiktok', 'meta-reels', 'instagram', 'meta-feed'],
    seasonality: 'Verano (solar), invierno (hidratación) y campañas de regalo.',
    priceLogic: 'coste por aplicación',
  },
  {
    id: 'food', label: 'Alimentación y bebidas', style: 'gourmet-macro',
    keywords: ['comida', 'alimento', 'bebida', 'cafe', 'te', 'cerveza', 'vino', 'snack', 'chocolate', 'restaurante', 'gourmet', 'organico', 'salsa', 'panaderia', 'helado', 'jugo'],
    trends: ['Origen y productor con nombre propio', 'Menos azúcar y etiqueta legible', 'Formato listo para consumir sin renunciar a calidad', 'Ritual de consumo como contenido'],
    audience: ['Compra por antojo y confirma por etiqueta', 'Valora la historia del productor', 'Comparte lo que come si es fotogénico'],
    objections: ['¿Sabe tan bien como se ve?', '¿Qué lleva realmente?', '¿Justifica el precio frente al de siempre?'],
    triggers: ['Sonido y textura del primer bocado o sorbo', 'Vapor, hielo, goteo: señales de temperatura', 'Ver a alguien disfrutarlo de verdad'],
    visualCodes: ['Macro con contraluz sobre la textura', 'Movimiento de líquido a alta velocidad', 'Manos y vajilla con uso', 'Paleta cálida y apetitosa'],
    competitors: ['Gran marca de distribución (precio y presencia)', 'Artesano local (autenticidad)', 'Marca de nicho saludable (posicionamiento)'],
    channels: ['meta-reels', 'tiktok', 'instagram', 'meta-feed'],
    seasonality: 'Fiestas, verano para bebidas frías, otoño para cálidas.',
    priceLogic: 'precio por ración frente a la alternativa',
  },
  {
    id: 'home', label: 'Hogar y decoración', style: 'warm-lifestyle',
    keywords: ['hogar', 'mueble', 'decoracion', 'cocina', 'lampara', 'silla', 'mesa', 'sofa', 'colchon', 'textil hogar', 'jardin', 'limpieza', 'organizacion', 'electrodomestico'],
    trends: ['Espacios pequeños y muebles multifunción', 'Materiales naturales visibles', 'Compra guiada por vídeo de montaje real', 'Durabilidad frente a renovación constante'],
    audience: ['Necesita imaginarlo en su propio espacio', 'Compara medidas y materiales', 'Le frena el montaje y la logística'],
    objections: ['¿Cabe y combina en mi casa?', '¿Es difícil de montar?', '¿Cuánto aguanta el uso diario?'],
    triggers: ['Ver el producto en una casa real, no en estudio', 'Demostración de uso cotidiano', 'Detalle del material y del acabado'],
    visualCodes: ['Luz de ventana', 'Planos con vida doméstica alrededor', 'Detalle de junta y acabado', 'Paleta cálida y natural'],
    competitors: ['Cadena global de mobiliario (precio y catálogo)', 'Taller local (calidad y personalización)', 'Marketplace (variedad)'],
    channels: ['meta-feed', 'instagram', 'google-demand', 'meta-reels'],
    seasonality: 'Mudanzas de verano, otoño de renovación y rebajas de enero.',
    priceLogic: 'coste por año de vida útil',
  },
  {
    id: 'saas', label: 'Software y servicios', style: 'tech-future',
    keywords: ['software', 'saas', 'app', 'plataforma', 'servicio', 'agencia', 'consultoria', 'crm', 'erp', 'automatizacion', 'suscripcion', 'herramienta', 'api', 'formacion', 'curso'],
    trends: ['Precio por resultado y no por asiento', 'Adopción guiada por el usuario final, no por compras', 'Integraciones como criterio de selección', 'IA embebida esperada por defecto'],
    audience: ['Evalúa en equipo y necesita justificar el gasto', 'Prueba antes de comprometerse', 'Mide el tiempo hasta el primer valor'],
    objections: ['¿Cuánto tardo en migrar?', '¿Se integra con mi stack?', '¿Qué pasa con mis datos?'],
    triggers: ['Ver la tarea real resuelta en pantalla', 'Cifra concreta de ahorro de tiempo', 'Caso de una empresa parecida a la mía'],
    visualCodes: ['Interfaz real grabada en pantalla', 'Tipografía y datos legibles', 'Transiciones limpias entre pasos', 'Persona usando la herramienta, no posando'],
    competitors: ['Suite del gigante (ya instalada)', 'Especialista vertical (mejor encaje)', 'Solución casera en hoja de cálculo'],
    channels: ['linkedin', 'google-search', 'youtube-instream', 'meta-feed'],
    seasonality: 'Cierres de trimestre y presupuestos de enero.',
    priceLogic: 'retorno sobre horas ahorradas',
  },
  {
    id: 'jewelry', label: 'Joyería y relojería', style: 'luxury-noir',
    keywords: ['joya', 'joyeria', 'anillo', 'collar', 'pulsera', 'reloj', 'oro', 'plata', 'diamante', 'pendiente', 'lujo'],
    trends: ['Piezas para uso diario, no solo ceremonia', 'Origen ético de la piedra y del metal', 'Autocompra femenina como segmento dominante', 'Personalización grabada'],
    audience: ['Compra por significado y por permanencia', 'Necesita confianza absoluta en el vendedor', 'Se toma tiempo antes de decidir'],
    objections: ['¿Es auténtico y certificado?', '¿Se estropea con el uso diario?', '¿Puedo devolverlo o ajustarlo?'],
    triggers: ['Brillo real en macro con movimiento', 'Historia detrás de la pieza', 'Garantía y certificado visibles'],
    visualCodes: ['Fondo negro con una sola fuente', 'Destellos controlados en el bisel', 'Piel y metal en contacto', 'Movimiento lentísimo'],
    competitors: ['Maison histórica (prestigio)', 'Marca digital directa (precio transparente)', 'Joyero local (confianza personal)'],
    channels: ['instagram', 'meta-feed', 'google-demand', 'meta-reels'],
    seasonality: 'San Valentín, día de la madre, navidad y temporada de bodas.',
    priceLogic: 'valor permanente frente a moda pasajera',
  },
  {
    id: 'auto', label: 'Automoción y movilidad', style: 'premium-cinematic',
    keywords: ['auto', 'coche', 'vehiculo', 'moto', 'bicicleta', 'electrico', 'motor', 'neumatico', 'scooter', 'camioneta', 'suv'],
    trends: ['Electrificación y ansiedad de autonomía', 'Software del vehículo como diferencial', 'Suscripción y renting frente a propiedad', 'Seguridad demostrada con datos'],
    audience: ['Decisión larga y muy racionalizada', 'Consulta pruebas independientes', 'Compra emocional justificada con datos'],
    objections: ['¿Cuánto cuesta mantenerlo?', '¿Autonomía real en mi uso?', '¿Cuánto pierde de valor?'],
    triggers: ['Vídeo de conducción en carretera real', 'Detalle de habitáculo y materiales', 'Cifras de consumo y seguridad'],
    visualCodes: ['Travelling paralelo al vehículo', 'Reflejos de luz sobre carrocería', 'Amanecer o noche urbana', 'Detalle de rueda y suspensión'],
    competitors: ['Fabricante tradicional (red y servicio)', 'Marca eléctrica nativa (tecnología)', 'Mercado de ocasión (precio)'],
    channels: ['youtube-instream', 'meta-feed', 'google-demand', 'instagram'],
    seasonality: 'Salones de otoño, primavera de compra y cierres de año fiscal.',
    priceLogic: 'coste total de propiedad',
  },
  {
    id: 'kids', label: 'Infantil, bebé y mascotas', style: 'warm-lifestyle',
    keywords: ['bebe', 'nino', 'infantil', 'juguete', 'cuna', 'panal', 'mascota', 'perro', 'gato', 'pienso', 'colegio', 'escolar'],
    trends: ['Seguridad certificada como primer filtro', 'Materiales sin tóxicos y sostenibles', 'Recomendación de pediatras y veterinarios en vídeo', 'Diseño que agrada también al adulto'],
    audience: ['Decide con miedo a equivocarse', 'Pregunta en comunidades antes de comprar', 'Paga más por seguridad demostrada'],
    objections: ['¿Es seguro?', '¿Está certificado?', '¿Aguanta el uso y el lavado?'],
    triggers: ['Ver a un niño o mascota real usándolo', 'Certificación explícita en pantalla', 'Testimonio de otro padre o dueño'],
    visualCodes: ['Luz suave y cálida', 'Manos adultas y pequeñas juntas', 'Texturas blandas', 'Sin sobreproducción'],
    competitors: ['Marca de gran distribución (precio)', 'Marca especializada (seguridad)', 'Tienda local de barrio (consejo)'],
    channels: ['meta-feed', 'instagram', 'meta-reels', 'google-demand'],
    seasonality: 'Navidad, vuelta al cole y nacimientos todo el año.',
    priceLogic: 'tranquilidad por euro gastado',
  },
  {
    id: 'general', label: 'Producto general', style: 'premium-cinematic',
    keywords: [],
    trends: ['El vídeo corto vertical concentra el descubrimiento', 'La prueba social pesa más que el mensaje de marca', 'Los primeros 2 segundos deciden la retención', 'Se espera transparencia de precio y de origen'],
    audience: ['Decide rápido y compara', 'Necesita entender el beneficio sin esfuerzo', 'Desconfía de la promesa sin prueba'],
    objections: ['¿Para qué lo necesito?', '¿Por qué a este precio?', '¿Y si no me convence?'],
    triggers: ['Beneficio evidente en los primeros segundos', 'Demostración honesta', 'Garantía clara'],
    visualCodes: ['Producto como protagonista', 'Fondo que no compite', 'Luz que revela la forma', 'Movimiento suave y continuo'],
    competitors: ['Líder de categoría', 'Alternativa económica', 'No comprar nada'],
    channels: ['meta-reels', 'tiktok', 'meta-feed', 'google-demand'],
    seasonality: 'Picos de campaña comercial y fin de año.',
    priceLogic: 'valor percibido frente a alternativa',
  },
];

const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

/** Detecta la categoría a partir del texto libre del brief. */
function detectCategory(text) {
  const t = norm(text);
  if (!t) return categoryById('general');
  let best = null; let bestScore = 0;
  for (const c of CATEGORIES) {
    let sc = 0;
    for (const k of c.keywords) if (t.indexOf(norm(k)) >= 0) sc += k.length > 5 ? 2 : 1;
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  return best || categoryById('general');
}

/** Segmentos de público con su lenguaje y su driver dominante. */
const AUDIENCES = [
  { id: 'athletes', label: 'Deportistas', keywords: ['deportista', 'atleta', 'runner', 'gym', 'crossfit', 'ciclista', 'futbolista', 'entrena'],
    age: '18-40', driver: 'rendimiento y superación', language: 'directo, imperativo, con jerga técnica del deporte',
    proof: 'datos de rendimiento y testimonio de un igual', channelBias: ['tiktok', 'meta-reels', 'youtube-shorts'] },
  { id: 'genz', label: 'Generación Z', keywords: ['joven', 'gen z', 'adolescente', 'universitario', 'tiktok', 'zoomer'],
    age: '16-26', driver: 'identidad y pertenencia', language: 'coloquial, con humor, sin corporativismo',
    proof: 'creadores reales y comentarios', channelBias: ['tiktok', 'meta-reels', 'youtube-shorts'] },
  { id: 'professionals', label: 'Profesionales y empresas', keywords: ['profesional', 'empresa', 'b2b', 'directivo', 'pyme', 'equipo', 'negocio', 'emprendedor'],
    age: '28-55', driver: 'eficiencia y retorno', language: 'preciso, con cifras y sin adjetivos vacíos',
    proof: 'caso de éxito medible', channelBias: ['linkedin', 'google-search', 'youtube-instream'] },
  { id: 'parents', label: 'Familias', keywords: ['padre', 'madre', 'familia', 'hijo', 'bebe', 'papa', 'mama', 'crianza'],
    age: '28-45', driver: 'seguridad y tiempo', language: 'cercano, empático, en segunda persona',
    proof: 'certificaciones y opinión de otros padres', channelBias: ['meta-feed', 'instagram', 'google-demand'] },
  { id: 'luxury', label: 'Alto poder adquisitivo', keywords: ['lujo', 'premium', 'exclusivo', 'alto', 'vip', 'coleccionista'],
    age: '35-65', driver: 'distinción y permanencia', language: 'sobrio, elíptico, sin precio en primer plano',
    proof: 'artesanía, origen y escasez', channelBias: ['instagram', 'meta-feed', 'youtube-instream'] },
  { id: 'value', label: 'Compra inteligente', keywords: ['barato', 'ahorro', 'economico', 'oferta', 'descuento', 'precio', 'accesible'],
    age: '22-60', driver: 'máximo valor por su dinero', language: 'claro, con la cifra por delante',
    proof: 'comparativa de precio y garantía', channelBias: ['meta-feed', 'google-demand', 'tiktok'] },
  { id: 'creators', label: 'Creadores y creativos', keywords: ['creador', 'creativo', 'disenador', 'fotografo', 'artista', 'musico', 'streamer'],
    age: '20-40', driver: 'expresión y herramientas que no estorban', language: 'inspirador y muy visual',
    proof: 'resultado final logrado con el producto', channelBias: ['instagram', 'tiktok', 'youtube-shorts'] },
  { id: 'general', label: 'Público general', keywords: [],
    age: '25-55', driver: 'resolver un problema cotidiano', language: 'claro y sin tecnicismos',
    proof: 'demostración y reseñas', channelBias: ['meta-reels', 'meta-feed', 'tiktok'] },
];
const audienceById = (id) => AUDIENCES.find((a) => a.id === id) || AUDIENCES[AUDIENCES.length - 1];

function detectAudience(text) {
  const t = norm(text);
  let best = null; let bestScore = 0;
  for (const a of AUDIENCES) {
    let sc = 0;
    for (const k of a.keywords) if (t.indexOf(norm(k)) >= 0) sc += 2;
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best || audienceById('general');
}

/**
 * Reglas de intención: traducen la frase del usuario en decisiones.
 *
 * `objective` es una decisión EXPLÍCITA («que convierta», «lanzamiento») y
 * gana siempre. `objectiveHint` es lo que un estilo sugiere por defecto y solo
 * se aplica si la frase no dice nada del objetivo — si no, «un comercial épico
 * que convierta» acabaría siendo de notoriedad solo porque «épico» aparece
 * antes en la lista.
 */
const INTENT_RULES = [
  { re: /(premium|lujo|exclusiv|alta gama|sofistic|elegan)/, style: 'premium-cinematic', tone: 'aspiracional', objectiveHint: 'awareness' },
  { re: /(epic|epico|potente|brutal|impacto|adrenalin)/, style: 'epic-sport', tone: 'intenso', objectiveHint: 'awareness' },
  { re: /(deportist|atleta|gym|entrenar|rendimiento|fitness)/, style: 'epic-sport', audience: 'athletes', tone: 'intenso' },
  { re: /(minimal|limpio|simple|sencill|zen|calma)/, style: 'nordic-minimal', tone: 'sereno' },
  { re: /(viral|tiktok|joven|gen z|divertid|gracios|meme)/, style: 'street-energy', audience: 'genz', tone: 'desenfadado' },
  { re: /(tecnolog|futurist|innova|ia\b|inteligencia artificial|software|saas)/, style: 'tech-future', tone: 'preciso' },
  { re: /(comida|sabor|gourmet|delicios|apetit|bebida)/, style: 'gourmet-macro', tone: 'sensorial' },
  { re: /(moda|fashion|editorial|pasarela|estilismo)/, style: 'editorial-fashion', tone: 'aforistico' },
  { re: /(familiar|hogar|cotidian|cercano|natural|autentic)/, style: 'warm-lifestyle', tone: 'calido' },
  { re: /(retro|vintage|noventa|nostalg|ochenta)/, style: 'retro-90s', tone: 'nostalgico' },
  { re: /(noir|oscur|misterio|seduc|perfume|deseo|nocturn)/, style: 'luxury-noir', tone: 'evocador' },
  // «convierta», «convertir», «conversión»: la raíz cambia por diptongación.
  { re: /(vender|vende|venta|convier|convert|convers|compra|roas|cpa|checkout)/, objective: 'conversion' },
  { re: /(lanzamiento|lanzar|estreno|nuevo producto|preventa)/, objective: 'launch' },
  { re: /(remarketing|retargeting|carrito|abandon|recuperar)/, objective: 'remarketing' },
  { re: /(notoriedad|awareness|dar a conocer|marca|alcance)/, objective: 'awareness' },
  { re: /(consideracion|comparar|evaluar|educar)/, objective: 'consideration' },
  { re: /(barato|economic|ahorr|descuento|oferta)/, audience: 'value' },
  { re: /(empresa|b2b|profesional|pyme|equipos de trabajo)/, audience: 'professionals' },
  { re: /(familia|padres|madres|hijos|bebe)/, audience: 'parents' },
  { re: /(creador|creativ|fotograf|disenador|artista)/, audience: 'creators' },
];

/**
 * Traduce una intención en lenguaje natural a decisiones de campaña.
 * "Quiero un comercial épico para deportistas que convierta"
 *   → { styleId:'epic-sport', audienceId:'athletes', objectiveId:'conversion' }
 */
function parseIntent(text, brief) {
  const t = norm(text);
  const out = { styleId: null, audienceId: null, objectiveId: null, tone: null, matched: [] };
  let objectiveHint = null;
  for (const r of INTENT_RULES) {
    if (!r.re.test(t)) continue;
    out.matched.push(r.re.source);
    if (r.style && !out.styleId) out.styleId = r.style;
    if (r.audience && !out.audienceId) out.audienceId = r.audience;
    if (r.objective && !out.objectiveId) out.objectiveId = r.objective;
    if (r.objectiveHint && !objectiveHint) objectiveHint = r.objectiveHint;
    if (r.tone && !out.tone) out.tone = r.tone;
  }
  if (!out.objectiveId) out.objectiveId = objectiveHint;
  // Coincidencia directa con el nombre o las palabras clave de un estilo.
  if (!out.styleId) {
    for (const st of STYLES) {
      if (norm(st.name) && t.indexOf(norm(st.name)) >= 0) { out.styleId = st.id; break; }
      if (st.keywords.some((k) => t.indexOf(norm(k)) >= 0)) { out.styleId = st.id; break; }
    }
  }
  const cat = detectCategory([t, s(brief && brief.productName), s(brief && brief.category)].join(' '));
  if (!out.styleId) out.styleId = cat.style;
  if (!out.audienceId) out.audienceId = detectAudience(t + ' ' + s(brief && brief.audienceHint)).id;
  if (!out.objectiveId) out.objectiveId = 'awareness';
  out.categoryId = cat.id;
  // Duración deseada si el usuario la menciona ("de 15 segundos", "1 minuto").
  const mSec = /(\d{1,3})\s*(segundos|segs?|s\b)/.exec(t);
  const mMin = /(\d{1,2})\s*(minutos?|min\b)/.exec(t);
  out.durationSec = mMin ? clamp(num(mMin[1], 1) * 60, 5, 180)
    : mSec ? clamp(num(mSec[1], 20), 5, 180) : null;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · REGISTRO DE PROVEEDORES (patrón Strategy + Registry)
//
// Contrato de un proveedor:
//   {
//     id, label, vendor, capability, docs,
//     aspects: string[],            // aspectos soportados ('*' = cualquiera)
//     maxSec, minSec,               // solo vídeo/audio
//     imageInput: bool,             // acepta imagen de referencia
//     nativeAudio: bool,            // el vídeo sale con audio
//     dialect: 'natural'|'tags'|'params'|'lyrics',
//     negative: bool,               // soporta prompt negativo
//     params: [{key,label,type,default,min,max,options}],
//     cost: { unit, amount, currency },   // unit: image|second|char|minute|call
//     render(spec, opts) -> { text, negative?, params?, payload?, note? }
//   }
//
// NINGÚN agente importa un proveedor concreto: producen un PromptSpec neutral
// y `renderPrompt(providerId, spec)` lo traduce. Añadir un modelo nuevo es
// añadir un descriptor con `registerProvider(...)` — el núcleo no cambia.
// ═══════════════════════════════════════════════════════════════════════════

const CAPABILITIES = [
  { id: 'image', label: 'Imagen', emoji: '🖼️' },
  { id: 'video', label: 'Vídeo', emoji: '🎬' },
  { id: 'voice', label: 'Voz', emoji: '🎙️' },
  { id: 'music', label: 'Música', emoji: '🎵' },
  { id: 'sfx', label: 'Efectos de sonido', emoji: '🔊' },
  { id: 'text', label: 'Texto / razonamiento', emoji: '🧠' },
];

/** Une fragmentos no vacíos con separador, sin dobles comas. */
const joinP = (parts, sep) => arr(parts).map((p) => s(p).trim()).filter(Boolean).join(sep || ', ');

/** Bloque descriptivo común: sujeto + acción + entorno. */
function coreOf(spec) {
  return joinP([spec.subject, spec.action, spec.environment]);
}
/** Bloque de fotografía: encuadre, ángulo, óptica, luz, grade. */
function photoOf(spec, opts) {
  const o = obj(opts);
  return joinP([
    enOf(SHOTS, spec.shot), enOf(ANGLES, spec.angle),
    o.noLens ? '' : enOf(LENSES, spec.lens),
    enOf(LIGHTING, spec.lighting), enOf(GRADES, spec.grade),
    spec.mood, spec.paletteText,
  ]);
}
/** Bloque de movimiento + efectos (solo vídeo). */
function motionOf(spec) {
  return joinP([enOf(MOVES, spec.move), arr(spec.fx).map((f) => enOf(FX, f)).filter(Boolean).join(', ')]);
}
const negOf = (spec) => uniq(arr(spec.negative)).join(', ');

const PROVIDERS = [
  // ── IMAGEN ──────────────────────────────────────────────────────────────
  {
    id: 'openai-images', label: 'OpenAI Images (gpt-image-1)', vendor: 'OpenAI', capability: 'image',
    docs: 'https://platform.openai.com/docs/guides/image-generation',
    aspects: ['1:1', '16:9', '9:16', '4:5'], imageInput: true, dialect: 'natural', negative: false,
    params: [
      { key: 'quality', label: 'Calidad', type: 'select', options: ['low', 'medium', 'high'], default: 'high' },
      { key: 'background', label: 'Fondo', type: 'select', options: ['auto', 'transparent', 'opaque'], default: 'auto' },
    ],
    cost: { unit: 'image', amount: 0.19, currency: 'USD' },
    render(spec) {
      // Dialecto natural: una descripción de fotógrafo, en frases completas y
      // sin sintaxis de parámetros (el modelo la ignora y ensucia la salida).
      const text = joinP([
        'Professional advertising photograph.', coreOf(spec) + '.',
        photoOf(spec) + '.',
        spec.styleText ? 'Art direction: ' + spec.styleText + '.' : '',
        spec.productNote ? 'Product accuracy: ' + spec.productNote + '.' : '',
        spec.negative && spec.negative.length ? 'Avoid: ' + negOf(spec) + '.' : '',
      ], ' ');
      return { text, params: { size: sizeForOpenAI(spec.aspect) } };
    },
  },
  {
    id: 'midjourney', label: 'Midjourney v7', vendor: 'Midjourney', capability: 'image',
    docs: 'https://docs.midjourney.com',
    aspects: ['*'], imageInput: true, dialect: 'params', negative: true,
    params: [
      { key: 'stylize', label: 'Stylize', type: 'number', min: 0, max: 1000, default: 250 },
      { key: 'chaos', label: 'Chaos', type: 'number', min: 0, max: 100, default: 0 },
      { key: 'raw', label: 'Estilo raw', type: 'boolean', default: true },
      { key: 'version', label: 'Versión', type: 'select', options: ['7', '6.1'], default: '7' },
    ],
    cost: { unit: 'image', amount: 0.04, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // Dialecto de parámetros: descripción densa por comas + flags --.
      const body = joinP([coreOf(spec), photoOf(spec), spec.styleText, spec.filmStock]);
      const flags = [
        '--ar ' + s(spec.aspect || '16:9'),
        o.raw === false ? '' : '--style raw',
        '--stylize ' + numOr(o.stylize, 250),
        num(o.chaos, 0) > 0 ? '--chaos ' + num(o.chaos, 0) : '',
        '--v ' + (s(o.version) || '7'),
        spec.negative && spec.negative.length ? '--no ' + negOf(spec) : '',
      ].filter(Boolean).join(' ');
      const refs = arr(spec.refImages).length ? arr(spec.refImages).join(' ') + ' ' : '';
      return { text: refs + body + ' ' + flags, negative: negOf(spec) };
    },
  },
  {
    id: 'flux', label: 'FLUX.1 [pro]', vendor: 'Black Forest Labs', capability: 'image',
    docs: 'https://docs.bfl.ai',
    aspects: ['*'], imageInput: true, dialect: 'natural', negative: false,
    params: [
      { key: 'steps', label: 'Pasos', type: 'number', min: 10, max: 50, default: 28 },
      { key: 'guidance', label: 'Guidance', type: 'number', min: 1, max: 10, default: 3.5 },
      { key: 'raw', label: 'Modo raw', type: 'boolean', default: true },
    ],
    cost: { unit: 'image', amount: 0.05, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // FLUX responde muy bien a prosa larga y específica sobre composición.
      const text = joinP([
        coreOf(spec) + '.', photoOf(spec) + '.',
        spec.composition ? 'Composition: ' + spec.composition + '.' : '',
        spec.styleText ? spec.styleText + '.' : '',
        spec.filmStock ? 'Shot on ' + spec.filmStock + '.' : '',
      ], ' ');
      return { text, params: { steps: numOr(o.steps, 28), guidance: numOr(o.guidance, 3.5), aspect_ratio: spec.aspect, raw: o.raw !== false } };
    },
  },
  {
    id: 'stable-diffusion', label: 'Stable Diffusion 3.5 / SDXL', vendor: 'Stability AI', capability: 'image',
    docs: 'https://platform.stability.ai/docs',
    aspects: ['*'], imageInput: true, dialect: 'tags', negative: true,
    params: [
      { key: 'steps', label: 'Pasos', type: 'number', min: 10, max: 60, default: 30 },
      { key: 'cfg', label: 'CFG scale', type: 'number', min: 1, max: 15, default: 5 },
      { key: 'sampler', label: 'Sampler', type: 'select', options: ['dpmpp_2m', 'euler_a', 'ddim'], default: 'dpmpp_2m' },
      { key: 'seed', label: 'Semilla', type: 'number', min: 0, max: 999999999, default: 0 },
    ],
    cost: { unit: 'image', amount: 0.035, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // Dialecto de etiquetas: términos separados por comas, con refuerzos y
      // un negativo explícito (SD lo aprovecha de verdad).
      const tags = joinP([
        spec.subject, spec.action, spec.environment,
        enOf(SHOTS, spec.shot), enOf(LENSES, spec.lens), enOf(LIGHTING, spec.lighting), enOf(GRADES, spec.grade),
        spec.styleText, spec.filmStock,
        'advertising photography', 'highly detailed', 'sharp focus', '8k',
      ]);
      const negative = joinP(uniq(arr(spec.negative).concat(SD_BASE_NEGATIVE)));
      return { text: tags, negative, params: { steps: numOr(o.steps, 30), cfg_scale: numOr(o.cfg, 5), sampler: s(o.sampler) || 'dpmpp_2m', seed: numOr(o.seed, 0), aspect_ratio: spec.aspect } };
    },
  },
  {
    id: 'comfyui', label: 'ComfyUI (workflow local)', vendor: 'Auto-alojado', capability: 'image',
    docs: 'https://docs.comfy.org',
    aspects: ['*'], imageInput: true, dialect: 'tags', negative: true,
    params: [
      { key: 'checkpoint', label: 'Checkpoint', type: 'string', default: 'sd_xl_base_1.0.safetensors' },
      { key: 'steps', label: 'Pasos', type: 'number', min: 10, max: 60, default: 28 },
      { key: 'cfg', label: 'CFG', type: 'number', min: 1, max: 15, default: 6 },
      { key: 'lora', label: 'LoRA', type: 'string', default: '' },
    ],
    cost: { unit: 'image', amount: 0, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      const lora = s(o.lora).trim() ? '<lora:' + s(o.lora).trim() + ':0.8> ' : '';
      const text = lora + joinP([
        spec.subject, spec.action, spec.environment,
        enOf(SHOTS, spec.shot), enOf(LENSES, spec.lens), enOf(LIGHTING, spec.lighting), enOf(GRADES, spec.grade),
        spec.styleText, 'commercial product photography', 'best quality',
      ]);
      const negative = joinP(uniq(arr(spec.negative).concat(SD_BASE_NEGATIVE)));
      const dims = dimsFor(spec.aspect || '16:9', '1080');
      // Payload listo para POST /prompt de ComfyUI (nodos mínimos del grafo).
      const payload = {
        '3': { class_type: 'KSampler', inputs: { seed: 0, steps: numOr(o.steps, 28), cfg: numOr(o.cfg, 6), sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
          model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
        '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: s(o.checkpoint) || 'sd_xl_base_1.0.safetensors' } },
        '5': { class_type: 'EmptyLatentImage', inputs: { width: Math.min(dims.w, 1536), height: Math.min(dims.h, 1536), batch_size: 1 } },
        '6': { class_type: 'CLIPTextEncode', inputs: { text, clip: ['4', 1] } },
        '7': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['4', 1] } },
        '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
        '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'kreative/' + slug(spec.sceneCode || 'scene'), images: ['8', 0] } },
      };
      return { text, negative, params: { checkpoint: s(o.checkpoint) }, payload, note: 'POST del payload a /prompt de tu ComfyUI.' };
    },
  },
  {
    id: 'higgsfield-image', label: 'Higgsfield · Imagen', vendor: 'Higgsfield', capability: 'image',
    docs: 'https://higgsfield.ai',
    aspects: ['16:9', '9:16', '1:1', '4:5'], imageInput: true, dialect: 'natural', negative: false,
    params: [
      { key: 'preset', label: 'Preset visual', type: 'string', default: '' },
      { key: 'quality', label: 'Calidad', type: 'select', options: ['standard', 'high'], default: 'high' },
    ],
    cost: { unit: 'image', amount: 0.06, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      const text = joinP([coreOf(spec) + '.', photoOf(spec) + '.', spec.styleText ? spec.styleText + '.' : ''], ' ');
      return { text, params: { aspect_ratio: spec.aspect, preset: s(o.preset), quality: s(o.quality) || 'high' },
        note: 'Ejecutable vía MCP de Higgsfield (generate_image) desde el agente de KIMOS.' };
    },
  },

  // ── VÍDEO ───────────────────────────────────────────────────────────────
  {
    id: 'runway', label: 'Runway Gen-4', vendor: 'Runway', capability: 'video',
    docs: 'https://docs.dev.runwayml.com',
    aspects: ['16:9', '9:16', '1:1', '4:5'], minSec: 5, maxSec: 10, imageInput: true, nativeAudio: false,
    dialect: 'natural', negative: false,
    params: [
      { key: 'duration', label: 'Duración (s)', type: 'select', options: ['5', '10'], default: '5' },
      { key: 'motionScore', label: 'Intensidad de movimiento', type: 'number', min: 1, max: 10, default: 5 },
    ],
    cost: { unit: 'second', amount: 0.25, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // Gen-4 rinde mejor describiendo SOLO el movimiento cuando hay imagen de
      // partida: la estética ya viene dada por el fotograma inicial.
      const withRef = arr(spec.refImages).length > 0;
      const text = withRef
        ? joinP([motionOf(spec) + '.', spec.action ? 'The subject ' + spec.action + '.' : '', 'Consistent lighting and product shape throughout.'], ' ')
        : joinP([coreOf(spec) + '.', photoOf(spec) + '.', motionOf(spec) + '.'], ' ');
      return { text, params: { ratio: spec.aspect, duration: numOr(o.duration, 5), motion_score: numOr(o.motionScore, 5),
        promptImage: arr(spec.refImages)[0] || null } };
    },
  },
  {
    id: 'kling', label: 'Kling 2.1', vendor: 'Kuaishou', capability: 'video',
    docs: 'https://app.klingai.com',
    aspects: ['16:9', '9:16', '1:1'], minSec: 5, maxSec: 10, imageInput: true, nativeAudio: false,
    dialect: 'natural', negative: true,
    params: [
      { key: 'mode', label: 'Modo', type: 'select', options: ['std', 'pro'], default: 'pro' },
      { key: 'duration', label: 'Duración (s)', type: 'select', options: ['5', '10'], default: '5' },
      { key: 'cfg', label: 'Fidelidad al prompt', type: 'number', min: 0, max: 1, default: 0.5 },
    ],
    cost: { unit: 'second', amount: 0.14, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      const text = joinP([coreOf(spec) + '.', motionOf(spec) + '.', photoOf(spec, { noLens: true }) + '.'], ' ');
      return { text, negative: negOf(spec) || 'distorted product, morphing logo, extra limbs, text artifacts',
        params: { mode: s(o.mode) || 'pro', duration: numOr(o.duration, 5), cfg_scale: numOr(o.cfg, 0.5), aspect_ratio: spec.aspect,
          image: arr(spec.refImages)[0] || null } };
    },
  },
  {
    id: 'veo', label: 'Veo 3', vendor: 'Google DeepMind', capability: 'video',
    docs: 'https://ai.google.dev/gemini-api/docs/video',
    aspects: ['16:9', '9:16'], minSec: 4, maxSec: 8, imageInput: true, nativeAudio: true,
    dialect: 'natural', negative: true,
    params: [
      { key: 'generateAudio', label: 'Audio nativo', type: 'boolean', default: true },
      { key: 'personGeneration', label: 'Personas', type: 'select', options: ['allow_adult', 'dont_allow'], default: 'allow_adult' },
    ],
    cost: { unit: 'second', amount: 0.40, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // Veo entiende bloques nombrados y genera audio: se le describe el sonido.
      const lines = [
        'Subject: ' + s(spec.subject),
        spec.action ? 'Action: ' + spec.action : '',
        spec.environment ? 'Scene: ' + spec.environment : '',
        'Camera: ' + joinP([enOf(SHOTS, spec.shot), enOf(ANGLES, spec.angle), enOf(LENSES, spec.lens), enOf(MOVES, spec.move)]),
        'Lighting: ' + enOf(LIGHTING, spec.lighting),
        'Look: ' + joinP([enOf(GRADES, spec.grade), spec.styleText, spec.filmStock]),
        arr(spec.fx).length ? 'Effects: ' + arr(spec.fx).map((f) => enOf(FX, f)).filter(Boolean).join(', ') : '',
        o.generateAudio === false ? '' : 'Audio: ' + (s(spec.audioNote) || 'diegetic ambience only, no music, no dialogue'),
      ].filter(Boolean);
      return { text: lines.join('\n'), negative: negOf(spec),
        params: { aspectRatio: spec.aspect, generateAudio: o.generateAudio !== false, personGeneration: s(o.personGeneration) || 'allow_adult' } };
    },
  },
  {
    id: 'sora', label: 'Sora 2', vendor: 'OpenAI', capability: 'video',
    docs: 'https://platform.openai.com/docs/guides/video-generation',
    aspects: ['16:9', '9:16'], minSec: 4, maxSec: 20, imageInput: true, nativeAudio: true,
    dialect: 'natural', negative: false,
    params: [
      { key: 'seconds', label: 'Duración (s)', type: 'select', options: ['4', '8', '12'], default: '8' },
      { key: 'size', label: 'Resolución', type: 'select', options: ['720p', '1080p'], default: '1080p' },
    ],
    cost: { unit: 'second', amount: 0.30, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // Sora prefiere una narración continua en presente, como una acotación
      // de guion, con la cámara integrada en la prosa.
      const text = joinP([
        sentence(coreOf(spec)) + '.',
        'The camera ' + (enOf(MOVES, spec.move) || 'holds steady') + ', ' + enOf(SHOTS, spec.shot) + ' on ' + enOf(LENSES, spec.lens) + '.',
        enOf(LIGHTING, spec.lighting) ? sentence(enOf(LIGHTING, spec.lighting)) + '.' : '',
        spec.styleText ? sentence(spec.styleText) + '.' : '',
        arr(spec.fx).length ? sentence(arr(spec.fx).map((f) => enOf(FX, f)).filter(Boolean).join(', ')) + '.' : '',
        spec.audioNote ? 'Sound: ' + spec.audioNote + '.' : '',
      ], ' ');
      return { text, params: { seconds: numOr(o.seconds, 8), size: s(o.size) || '1080p', aspect: spec.aspect } };
    },
  },
  {
    id: 'higgsfield-video', label: 'Higgsfield · Vídeo (motion presets)', vendor: 'Higgsfield', capability: 'video',
    docs: 'https://higgsfield.ai',
    aspects: ['16:9', '9:16', '1:1'], minSec: 3, maxSec: 10, imageInput: true, nativeAudio: false,
    dialect: 'params', negative: false,
    params: [
      { key: 'motion', label: 'Preset de movimiento', type: 'string', default: '' },
      { key: 'strength', label: 'Intensidad', type: 'number', min: 0, max: 1, default: 0.7 },
    ],
    cost: { unit: 'second', amount: 0.18, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // Higgsfield trabaja con presets de movimiento nombrados: el spec de
      // cámara se mapea al preset más cercano y el texto describe el resto.
      const preset = s(o.motion) || HIGGS_MOTION[spec.move] || 'general';
      const text = joinP([coreOf(spec) + '.', photoOf(spec, { noLens: true }) + '.'], ' ');
      return { text, params: { motion_preset: preset, strength: numOr(o.strength, 0.7), aspect_ratio: spec.aspect,
        image: arr(spec.refImages)[0] || null },
        note: 'Ejecutable vía MCP de Higgsfield (generate_video / motion_control).' };
    },
  },

  // ── VOZ ─────────────────────────────────────────────────────────────────
  {
    id: 'elevenlabs', label: 'ElevenLabs v3', vendor: 'ElevenLabs', capability: 'voice',
    docs: 'https://elevenlabs.io/docs',
    dialect: 'params', negative: false,
    params: [
      { key: 'voiceId', label: 'Voz', type: 'string', default: '' },
      { key: 'stability', label: 'Estabilidad', type: 'number', min: 0, max: 1, default: 0.45 },
      { key: 'similarity', label: 'Similitud', type: 'number', min: 0, max: 1, default: 0.8 },
      { key: 'style', label: 'Estilo', type: 'number', min: 0, max: 1, default: 0.35 },
      { key: 'speed', label: 'Velocidad', type: 'number', min: 0.7, max: 1.2, default: 1 },
    ],
    cost: { unit: 'char', amount: 0.00018, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // v3 admite etiquetas de dirección actoral en línea: [pausa], [susurro].
      const text = s(spec.text);
      return { text, params: { voice_id: s(o.voiceId), model_id: 'eleven_v3',
        voice_settings: { stability: numOr(o.stability, 0.45), similarity_boost: numOr(o.similarity, 0.8), style: numOr(o.style, 0.35), speed: numOr(o.speed, 1) } },
        note: 'Dirección: ' + s(spec.direction) };
    },
  },
  {
    id: 'openai-audio', label: 'OpenAI TTS', vendor: 'OpenAI', capability: 'voice',
    docs: 'https://platform.openai.com/docs/guides/text-to-speech',
    dialect: 'params', negative: false,
    params: [
      { key: 'voice', label: 'Voz', type: 'select', options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], default: 'onyx' },
      { key: 'speed', label: 'Velocidad', type: 'number', min: 0.5, max: 2, default: 1 },
    ],
    cost: { unit: 'char', amount: 0.000015, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      return { text: s(spec.text), params: { model: 'gpt-4o-mini-tts', voice: s(o.voice) || 'onyx', speed: numOr(o.speed, 1),
        instructions: s(spec.direction) } };
    },
  },

  // ── MÚSICA ──────────────────────────────────────────────────────────────
  {
    id: 'suno', label: 'Suno', vendor: 'Suno', capability: 'music',
    docs: 'https://suno.com',
    dialect: 'lyrics', negative: false,
    params: [
      { key: 'instrumental', label: 'Instrumental', type: 'boolean', default: true },
      { key: 'model', label: 'Modelo', type: 'string', default: 'v4.5' },
    ],
    cost: { unit: 'call', amount: 0.10, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      // Suno separa "style" (etiquetas densas) de "lyrics" (con marcadores de
      // estructura). Para publicidad casi siempre instrumental.
      const style = joinP([spec.genre, spec.mood, arr(spec.instruments).join(', '), spec.bpm ? spec.bpm + ' bpm' : '', 'no vocals, advertising bed, clean mix']);
      const lyrics = o.instrumental === false ? s(spec.lyrics) : '[Instrumental]';
      return { text: style, params: { style, lyrics, instrumental: o.instrumental !== false, model: s(o.model) || 'v4.5',
        title: s(spec.title) }, note: 'Estructura sugerida: ' + s(spec.structure) };
    },
  },
  {
    id: 'udio', label: 'Udio', vendor: 'Udio', capability: 'music',
    docs: 'https://udio.com',
    dialect: 'lyrics', negative: true,
    params: [
      { key: 'instrumental', label: 'Instrumental', type: 'boolean', default: true },
      { key: 'clipLength', label: 'Duración (s)', type: 'number', min: 32, max: 130, default: 32 },
    ],
    cost: { unit: 'call', amount: 0.08, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      const text = joinP([spec.genre, spec.mood, arr(spec.instruments).join(', '), spec.bpm ? spec.bpm + ' bpm' : '', 'instrumental, cinematic advertising']);
      return { text, negative: 'lo-fi noise, clipping, vocals', params: { instrumental: o.instrumental !== false, clip_length: numOr(o.clipLength, 32) } };
    },
  },
  {
    id: 'elevenlabs-sfx', label: 'ElevenLabs · Sound Effects', vendor: 'ElevenLabs', capability: 'sfx',
    docs: 'https://elevenlabs.io/docs/api-reference/sound-generation',
    dialect: 'natural', negative: false,
    params: [{ key: 'duration', label: 'Duración (s)', type: 'number', min: 0.5, max: 22, default: 3 }],
    cost: { unit: 'call', amount: 0.02, currency: 'USD' },
    render(spec, opts) {
      const o = obj(opts);
      return { text: s(spec.text), params: { duration_seconds: numOr(o.duration, 3), prompt_influence: 0.4 } };
    },
  },

  // ── TEXTO (enriquecimiento opcional del pipeline) ───────────────────────
  {
    id: 'anthropic', label: 'Claude (Anthropic)', vendor: 'Anthropic', capability: 'text',
    docs: 'https://docs.claude.com', dialect: 'natural', negative: false,
    params: [{ key: 'model', label: 'Modelo', type: 'string', default: 'claude-opus-5' }],
    cost: { unit: 'ktoken', amount: 0.015, currency: 'USD' },
    render(spec, opts) { return { text: s(spec.text), params: { model: s(obj(opts).model) || 'claude-opus-5' } }; },
  },
  {
    id: 'openai-text', label: 'OpenAI GPT', vendor: 'OpenAI', capability: 'text',
    docs: 'https://platform.openai.com/docs', dialect: 'natural', negative: false,
    params: [{ key: 'model', label: 'Modelo', type: 'string', default: 'gpt-4.1' }],
    cost: { unit: 'ktoken', amount: 0.010, currency: 'USD' },
    render(spec, opts) { return { text: s(spec.text), params: { model: s(obj(opts).model) || 'gpt-4.1' } }; },
  },
  {
    id: 'gemini', label: 'Google Gemini', vendor: 'Google', capability: 'text',
    docs: 'https://ai.google.dev', dialect: 'natural', negative: false,
    params: [{ key: 'model', label: 'Modelo', type: 'string', default: 'gemini-2.5-pro' }],
    cost: { unit: 'ktoken', amount: 0.007, currency: 'USD' },
    render(spec, opts) { return { text: s(spec.text), params: { model: s(obj(opts).model) || 'gemini-2.5-pro' } }; },
  },
  {
    id: 'openrouter', label: 'OpenRouter (cualquier modelo)', vendor: 'OpenRouter', capability: 'text',
    docs: 'https://openrouter.ai/docs', dialect: 'natural', negative: false,
    params: [{ key: 'model', label: 'Modelo', type: 'string', default: 'anthropic/claude-opus-4' }],
    cost: { unit: 'ktoken', amount: 0.012, currency: 'USD' },
    render(spec, opts) { return { text: s(spec.text), params: { model: s(obj(opts).model) } }; },
  },
];

/** Negativo base para modelos de difusión (se suma al del spec). */
const SD_BASE_NEGATIVE = ['lowres', 'jpeg artifacts', 'watermark', 'signature', 'deformed product',
  'extra fingers', 'text errors', 'oversaturated', 'plastic skin'];

/** Mapa movimiento neutro → preset de movimiento de Higgsfield. */
const HIGGS_MOTION = {
  'slow-push': 'dolly-in', 'pull-back': 'dolly-out', orbit: 'orbit', 'crane-up': 'crane-up',
  tracking: 'follow', handheld: 'handheld', 'whip-pan': 'whip-pan', fpv: 'fpv-drone',
  'rack-focus': 'focus-shift', parallax: 'parallax', static: 'static', snorricam: 'snorricam',
};

/** Tamaño soportado por OpenAI Images según aspecto. */
function sizeForOpenAI(aspect) {
  if (aspect === '9:16' || aspect === '4:5') return '1024x1536';
  if (aspect === '1:1') return '1024x1024';
  return '1536x1024';
}

// ── API del registro ──────────────────────────────────────────────────────
const providerIndex = new Map(PROVIDERS.map((p) => [p.id, p]));

/** Alta de proveedor en caliente. Valida el contrato mínimo. */
function registerProvider(desc) {
  const d = obj(desc);
  if (!s(d.id).trim()) throw new Error('El proveedor necesita `id`.');
  if (!CAPABILITIES.some((c) => c.id === d.capability)) throw new Error('`capability` desconocida: ' + s(d.capability));
  if (typeof d.render !== 'function') throw new Error('El proveedor necesita `render(spec, opts)`.');
  const prev = providerIndex.get(d.id);
  if (prev) PROVIDERS.splice(PROVIDERS.indexOf(prev), 1);
  PROVIDERS.push(d);
  providerIndex.set(d.id, d);
  return d;
}
const getProvider = (id) => providerIndex.get(s(id)) || null;
const providersFor = (capability) => PROVIDERS.filter((p) => p.capability === capability);
const defaultProviderFor = (capability) => (providersFor(capability)[0] || null);

/** ¿El proveedor soporta este aspecto? */
const supportsAspect = (p, aspect) => !p || !arr(p.aspects).length
  || p.aspects.indexOf('*') >= 0 || p.aspects.indexOf(aspect) >= 0;

/**
 * Traduce un PromptSpec neutral al dialecto del proveedor.
 * Devuelve siempre { providerId, provider, text, negative, params, payload,
 * note, warnings } — nunca lanza por datos del usuario.
 */
function renderPrompt(providerId, spec, opts) {
  const p = getProvider(providerId);
  const sp = obj(spec);
  if (!p) return { providerId: s(providerId), provider: null, text: '', negative: '', params: {}, warnings: ['Proveedor desconocido: ' + s(providerId)] };
  const warnings = [];
  if (!supportsAspect(p, sp.aspect)) warnings.push('El proveedor no soporta el aspecto ' + s(sp.aspect) + ' (se exportará y reencuadrará en edición).');
  if (p.capability === 'video') {
    const d = num(sp.durationSec, 0);
    if (p.maxSec && d > p.maxSec) warnings.push('La escena dura ' + d + 's y el modelo genera máximo ' + p.maxSec + 's: se dividirá en ' + Math.ceil(d / p.maxSec) + ' tomas.');
    if (p.minSec && d && d < p.minSec) warnings.push('El modelo genera mínimo ' + p.minSec + 's: se recortará en edición.');
  }
  let out;
  try { out = obj(p.render(sp, obj(opts))); }
  catch (e) { return { providerId: p.id, provider: p, text: '', negative: '', params: {}, warnings: warnings.concat(['Error al renderizar: ' + ((e && e.message) || 'desconocido')]) }; }
  return {
    providerId: p.id, provider: p, capability: p.capability,
    text: s(out.text), negative: s(out.negative), params: obj(out.params),
    payload: out.payload || null, note: s(out.note), warnings,
  };
}

/** Coste estimado de una unidad de trabajo con este proveedor. */
function estimateCost(providerId, quantity) {
  const p = getProvider(providerId);
  if (!p || !p.cost) return 0;
  return round(num(p.cost.amount, 0) * Math.max(0, num(quantity, 0)), 4);
}
/** Cantidad facturable según la unidad del proveedor. */
function billableQty(provider, job) {
  const u = provider && provider.cost ? provider.cost.unit : 'call';
  const j = obj(job);
  if (u === 'second') return Math.max(0, num(j.durationSec, 0));
  if (u === 'char') return Math.max(0, s(j.text).length);
  if (u === 'ktoken') return Math.max(0, num(j.tokens, 0)) / 1000;
  if (u === 'minute') return Math.max(0, num(j.durationSec, 0)) / 60;
  return Math.max(1, num(j.count, 1));
}

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

  // El mapa se ajusta a lo que hay, con dos celdas de margen para crecer. Un
  // mapa por defecto mucho más alto que la organización se lee como si
  // faltaran departamentos.
  const used = wsArr(world.areas).reduce((m, a) => Math.max(m, a.y + a.h), 0);
  const fit = wsResizeGrid(world, wsObj(world.grid).w, used + 2);
  if (fit.ok) world = fit.world;
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

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Modelo de campaña (agregado raíz)
//
// Un documento de Kreative Studio = una CAMPAÑA. Cada agente escribe en su
// propia sección; ninguna sección se pisa con otra, así que se pueden
// re-ejecutar agentes sueltos sin perder el trabajo manual del resto.
// ═══════════════════════════════════════════════════════════════════════════

const MODEL_SCHEMA = 1;

function emptyBrief() {
  return {
    productName: '', category: '', priceText: '', currency: 'USD',
    usp: '', audienceHint: '', intent: '', extraNotes: '',
    budget: 3000, marketRegion: 'España / LatAm', language: 'es',
    photos: [],           // [{ id, url, caption, isHero }]
    competitorsText: '', mandatories: '', legal: '',
    sourceRef: null,      // { app:'productlab', instanceId, itemId, sku, at }
  };
}

function emptyBrand() {
  return {
    palette: { primary: '#0B0B0D', secondary: '#19ACB1', accent: '#E8E4DC', dark: '#000000', light: '#FFFFFF' },
    typography: { display: '', body: '', tracking: 'normal' },
    logoUrl: '', logoSafeArea: 12, tone: '', voiceTraits: [], forbidden: [],
    productLock: '', characterLock: '', slogan: '',
  };
}

function emptySettings() {
  return {
    providers: { image: 'openai-images', video: 'runway', voice: 'elevenlabs', music: 'suno', sfx: 'elevenlabs-sfx', text: 'anthropic' },
    providerParams: {},               // { [providerId]: { param: value } }
    targets: {                        // entregables por formato
      resolutions: ['1080', '4k'],
      aspects: ['16:9', '9:16', '1:1', '4:5'],
      platforms: ['meta-reels', 'tiktok', 'meta-feed', 'youtube-shorts'],
    },
    heroDurationSec: 30, shortDurationSec: 15, variantCount: 3,
    fps: 25, currency: 'USD', subtitles: true, safeAreas: true,
    autoRunOnBrief: true,
    theme: emptyTheme(),
    // Flujo editable: orden propio y agentes desactivados. Vacío = el de fábrica.
    workflow: { order: [], disabled: [] },
  };
}

function emptyCampaign() {
  return {
    schema: MODEL_SCHEMA, appVersion: KS_VERSION,
    id: newId('camp'), title: 'Nueva campaña', createdAt: nowIso(), updatedAt: nowIso(),
    brief: emptyBrief(),
    styleId: 'premium-cinematic', objectiveId: 'awareness', audienceId: 'general', categoryId: 'general',
    brand: emptyBrand(), settings: emptySettings(),
    research: null,      // Agente 2
    concept: null,       // Agente 1
    plan: null,          // Agente 3
    storyboard: null,    // Agente 4  { scenes: [], formats: {} }
    prompts: null,       // Agente 5  { image: [], video: [] }
    audio: null,         // Agente 6  { vo: [], music, ambience, sfx: [] }
    production: null,    // Agente 7  { jobs: [] }
    edit: null,          // Agente 8  { timeline, ffmpeg, srt, exports }
    brandCheck: null,    // Agente 9
    copy: null,          // Agente 10
    analytics: null,     // Agente 12
    // Mapa de la organización (KIMOS WorldSkin): departamentos, procesos
    // internos y personal —agentes de IA y personas— que se recorre en la
    // vista Organización. Se siembra en `migrate` desde el propio flujo.
    world: wsEmptyWorld(),
    pipeline: { runs: [], stages: {} },
    versions: [],        // [{ id, label, at, summary, snapshot }]
    log: [],             // trazas de ejecución (máx LOG_MAX)
  };
}

const LOG_MAX = 250;
const VERSIONS_MAX = 40;

/** Normaliza cualquier documento cargado (tolerante a versiones antiguas). */
function migrate(raw) {
  const base = emptyCampaign();
  const d = obj(raw);
  const out = Object.assign(base, d);
  out.schema = MODEL_SCHEMA;
  out.appVersion = KS_VERSION;
  out.brief = Object.assign(emptyBrief(), obj(d.brief));
  out.brief.photos = arr(out.brief.photos).map((p, i) => ({
    id: s(p.id) || 'photo-' + i, url: s(p.url), caption: s(p.caption), isHero: !!p.isHero,
  })).filter((p) => p.url);
  out.brief.sourceRef = obj(d.brief).sourceRef && s(obj(obj(d.brief).sourceRef).app)
    ? Object.assign({}, obj(obj(d.brief).sourceRef)) : null;
  out.brand = Object.assign(emptyBrand(), obj(d.brand));
  out.brand.palette = Object.assign(emptyBrand().palette, obj(out.brand.palette));
  out.brand.typography = Object.assign(emptyBrand().typography, obj(out.brand.typography));
  out.brand.voiceTraits = arr(out.brand.voiceTraits).map(s);
  out.brand.forbidden = arr(out.brand.forbidden).map(s);
  const st = emptySettings();
  out.settings = Object.assign(st, obj(d.settings));
  out.settings.providers = Object.assign(st.providers, obj(out.settings.providers));
  out.settings.providerParams = obj(out.settings.providerParams);
  out.settings.targets = Object.assign(st.targets, obj(out.settings.targets));
  out.settings.targets.aspects = uniq(arr(out.settings.targets.aspects)).filter((a) => ASPECTS.some((x) => x.id === a));
  if (!out.settings.targets.aspects.length) out.settings.targets.aspects = ['16:9', '9:16'];
  out.settings.targets.resolutions = uniq(arr(out.settings.targets.resolutions)).filter((r) => RESOLUTIONS.some((x) => x.id === r));
  if (!out.settings.targets.resolutions.length) out.settings.targets.resolutions = ['1080'];
  out.settings.targets.platforms = uniq(arr(out.settings.targets.platforms)).filter((p) => PLATFORMS.some((x) => x.id === p));
  const th = Object.assign(emptyTheme(), obj(out.settings.theme));
  out.settings.theme = {
    form: themeFormById(th.form).id,
    classicMode: classicModeById(th.classicMode).id,
    gameMode: gameModeById(th.gameMode).id,
  };
  const wf = Object.assign({ order: [], disabled: [] }, obj(out.settings.workflow));
  out.settings.workflow = {
    order: uniq(arr(wf.order).map(s).filter((x) => PIPELINE_ORDER.indexOf(x) >= 0)),
    disabled: uniq(arr(wf.disabled).map(s).filter((x) => PIPELINE_ORDER.indexOf(x) >= 0)),
  };
  // Proveedores desconocidos (bundle antiguo) vuelven al default de su capacidad.
  for (const cap of CAPABILITIES) {
    const cur = out.settings.providers[cap.id];
    if (!getProvider(cur) || getProvider(cur).capability !== cap.id) {
      const def = defaultProviderFor(cap.id);
      out.settings.providers[cap.id] = def ? def.id : '';
    }
  }
  out.styleId = styleById(out.styleId).id;
  out.objectiveId = objectiveById(out.objectiveId).id;
  out.audienceId = audienceById(out.audienceId).id;
  out.categoryId = categoryById(out.categoryId).id;
  // El mundo se normaliza siempre (tolera documentos viejos o manipulados) y
  // se siembra una sola vez: si el usuario vacía el mapa a propósito, se queda
  // vacío en vez de resucitar solo en la siguiente carga.
  out.world = wsMigrateWorld(d.world);
  if (!s(out.world.seededFrom) && !arr(out.world.areas).length) out.world = seedOrgWorld(out);
  out.pipeline = Object.assign({ runs: [], stages: {} }, obj(d.pipeline));
  out.pipeline.stages = obj(out.pipeline.stages);
  out.pipeline.runs = arr(out.pipeline.runs).slice(-20);
  out.versions = arr(out.versions).slice(-VERSIONS_MAX);
  out.log = arr(out.log).slice(-LOG_MAX);
  out.title = s(out.title) || s(out.brief.productName) || 'Nueva campaña';
  return out;
}

/** Semilla creativa determinista de la campaña. */
function seedOf(c) {
  return hash32([s(c.brief.productName), s(c.brief.intent), s(c.styleId), s(c.objectiveId), s(c.audienceId)].join('|'));
}

/** Resumen corto usado en snapshots del agente y en el diff de versiones. */
function summarize(c) {
  const sb = obj(c.storyboard);
  return {
    title: s(c.title),
    producto: s(c.brief.productName),
    estilo: styleById(c.styleId).name,
    objetivo: objectiveById(c.objectiveId).label,
    publico: audienceById(c.audienceId).label,
    categoria: categoryById(c.categoryId).label,
    escenas: arr(sb.scenes).length,
    duracionSeg: round(arr(sb.scenes).reduce((a, x) => a + num(x.durationSec, 0), 0), 1),
    fotos: arr(c.brief.photos).length,
    piezasCopy: arr(obj(c.copy).ads).length,
    etapasCompletas: Object.keys(obj(c.pipeline.stages)).filter((k) => obj(c.pipeline.stages[k]).status === 'done').length,
  };
}

/** Registra una traza acotada. */
function logLine(c, level, text) {
  const line = { at: nowIso(), level: s(level) || 'info', text: s(text) };
  c.log = arr(c.log).concat([line]).slice(-LOG_MAX);
  return line;
}

// ═══════════════════════════════════════════════════════════════════════════
// KIMOS WorldSkin · simulación de avatares
//
// Los avatares se mueven de verdad, pero lo que hacen NO es decorativo: sale
// del estado real del flujo de la app. Un agente que está ejecutándose camina
// a su puesto y trabaja; uno bloqueado se planta con un «!»; uno apagado se
// va a la zona común y se sienta.
//
// La simulación es una FUNCIÓN PURA por paso (`wsSimStep`): el bucle de
// animación vive en la UI y solo llama aquí. Así se puede probar sin
// navegador, y pausarla no deja nada a medias.
// ═══════════════════════════════════════════════════════════════════════════

const WS_SPEED = 1.9;          // celdas por segundo
const WS_TICK_MAX = 0.1;       // s: techo del delta, para que un frame perdido
                               // no teletransporte a nadie por medio mapa
const WS_FOOT_BIAS = 0.78;     // dónde caen los pies dentro de su celda

const WS_MOODS = {
  working: { id: 'working', bubble: '', label: 'trabajando' },
  done: { id: 'done', bubble: '✓', label: 'terminado' },
  blocked: { id: 'blocked', bubble: '!', label: 'bloqueado' },
  off: { id: 'off', bubble: '·', label: 'descansando' },
  idle: { id: 'idle', bubble: '', label: 'disponible' },
  human: { id: 'human', bubble: '', label: 'en su puesto' },
};

/** Centro de un área en coordenadas de celda. */
const wsAreaCenter = (a) => ({ x: wsNum(a.x, 0) + wsNum(a.w, 1) / 2, y: wsNum(a.y, 0) + wsNum(a.h, 1) / 2 });

/**
 * Posición de un puesto dentro de su área, repartida en rejilla.
 *
 * `slot` es el número de orden de quien ocupa ese puesto: sin él, dos personas
 * en el mismo puesto se dibujarían exactamente en el mismo píxel y solo se
 * vería a una. Se reparten en corrillo alrededor del puesto.
 */
function wsStationPos(area, stationId, slot) {
  const list = wsArr(area.stations);
  const i = Math.max(0, list.findIndex((s) => s.id === wsS(stationId)));
  const cols = Math.max(1, Math.min(list.length, Math.round(wsNum(area.w, 2))));
  const cx = i % cols;
  const cy = Math.floor(i / cols);
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const aw = wsNum(area.w, 2); const ah = wsNum(area.h, 2);
  // Los pies van en la parte baja de la celda: el avatar se dibuja HACIA
  // ARRIBA desde este punto, y centrado se le saldría la cabeza por el tejado.
  const base = {
    x: wsNum(area.x, 0) + (cx + 0.5) * (aw / cols),
    y: wsNum(area.y, 0) + (cy + WS_FOOT_BIAS) * (ah / rows),
  };
  const k = Math.max(0, wsNum(slot, 0));
  if (k) {
    // Corrillo: radio creciente cada seis, para que un puesto muy poblado no
    // acabe con todo el mundo encima de la pared.
    const ring = Math.floor((k - 1) / 6) + 1;
    const ang = (((k - 1) % 6) / 6) * Math.PI * 2;
    const r = Math.min(0.4 * ring, Math.min(aw, ah) / 2 - 0.12);
    base.x += Math.cos(ang) * r;
    base.y += Math.sin(ang) * r * 0.55;
  }
  return {
    x: wsClamp(base.x, wsNum(area.x, 0) + 0.18, wsNum(area.x, 0) + aw - 0.18),
    y: wsClamp(base.y, wsNum(area.y, 0) + WS_FOOT_BIAS, wsNum(area.y, 0) + ah - 0.08),
  };
}

/**
 * Crea el estado inicial de los avatares. Se vuelve a llamar cuando cambia el
 * mundo: conserva la posición de quien siga existiendo, para que editar un
 * área no haga saltar a todo el personal.
 */
function wsSimInit(world, prev) {
  const before = new Map(wsArr(wsObj(prev).actors).map((a) => [a.id, a]));
  const areas = wsArr(wsObj(world).areas);
  const taken = {};                    // cuántos comparten ya cada puesto
  const actors = wsArr(wsObj(world).staff).map((p) => {
    const area = areas.find((a) => a.id === p.areaId) || areas[0] || null;
    const key = (area ? area.id : '-') + '|' + wsS(p.stationId);
    const slot = taken[key] || 0;
    taken[key] = slot + 1;
    const home = area ? wsStationPos(area, p.stationId, slot) : { x: 1, y: 1 };
    const old = before.get(p.id);
    const seed = wsHash(p.id + p.name);
    return {
      id: p.id, name: p.name, kind: p.kind, role: p.role,
      agentId: p.agentId || null, areaId: area ? area.id : '',
      x: old ? old.x : home.x, y: old ? old.y : home.y,
      tx: home.x, ty: home.y,          // destino
      homeX: home.x, homeY: home.y,
      face: old ? old.face : 1,        // 1 derecha, -1 izquierda
      phase: (seed % 1000) / 1000,     // desfase de animación, para que no vayan a la vez
      hue: seed % 360,
      mood: 'idle', wait: (seed % 700) / 1000,
      bubble: '', bubbleT: 0,
    };
  });
  return { actors, t: 0, paused: false };
}

/**
 * Un paso de simulación. `dt` en segundos; `statusOf(agentId)` devuelve el
 * estado del agente en el flujo de la app anfitriona.
 * Devuelve un estado NUEVO (no muta el recibido).
 */
function wsSimStep(sim, world, dt, statusOf) {
  const s0 = wsObj(sim);
  const step = Math.min(WS_TICK_MAX, Math.max(0, wsNum(dt, 0)));
  const areas = wsArr(wsObj(world).areas);
  const plaza = areas.find((a) => a.structure === 'plaza') || null;
  const t = wsNum(s0.t, 0) + step;

  const actors = wsArr(s0.actors).map((a0) => {
    const a = Object.assign({}, a0);
    const st = a.kind === 'ai' && typeof statusOf === 'function' ? wsS(statusOf(a.agentId)) : '';
    // El humor sale del flujo real; si la app no dice nada, la persona
    // simplemente está en su puesto.
    a.mood = a.kind !== 'ai' ? 'human'
      : st === 'done' ? 'done' : st === 'error' || st === 'blocked' ? 'blocked'
        : st === 'off' || st === 'skipped' ? 'off' : st === 'running' ? 'working' : 'idle';

    // A dónde va: apagado → zona común; el resto → su puesto, con pequeños
    // paseos para que la escena esté viva sin ser un caos.
    let goX = a.homeX; let goY = a.homeY;
    if (a.mood === 'off' && plaza) { const c = wsAreaCenter(plaza); goX = c.x; goY = c.y; }
    a.wait = wsNum(a.wait, 0) - step;
    if (a.wait <= 0) {
      a.wait = 2.5 + ((wsHash(a.id + Math.floor(t / 3)) % 400) / 100);
      const wob = ((wsHash(a.id + Math.floor(t / 3) + 'w') % 100) / 100 - 0.5) * 0.9;
      const wob2 = ((wsHash(a.id + Math.floor(t / 3) + 'h') % 100) / 100 - 0.5) * 0.9;
      a.tx = goX + (a.mood === 'working' ? wob * 0.35 : wob);
      a.ty = goY + (a.mood === 'working' ? wob2 * 0.35 : wob2);
    } else if (a.mood === 'off' && plaza) { a.tx = goX; a.ty = goY; }

    const dx = a.tx - a.x; const dy = a.ty - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = WS_SPEED * (a.mood === 'working' ? 1.25 : a.mood === 'off' ? 0.6 : 1);
    if (dist > 0.02) {
      const mv = Math.min(dist, speed * step);
      a.x += (dx / dist) * mv;
      a.y += (dy / dist) * mv;
      if (Math.abs(dx) > 0.02) a.face = dx > 0 ? 1 : -1;
      a.moving = true;
    } else { a.moving = false; }

    const mood = WS_MOODS[a.mood] || WS_MOODS.idle;
    a.bubble = mood.bubble;
    return a;
  });

  return { actors, t, paused: !!s0.paused };
}

/** Un actor «habla»: burbuja temporal. Útil al seleccionarlo o al ejecutarlo. */
function wsSimSay(sim, actorId, text, seconds) {
  const s0 = wsObj(sim);
  return {
    t: wsNum(s0.t, 0), paused: !!s0.paused,
    actors: wsArr(s0.actors).map((a) => (a.id === wsS(actorId)
      ? Object.assign({}, a, { bubble: wsS(text).slice(0, 40), bubbleT: wsNum(seconds, 3) })
      : a)),
  };
}

/** Paleta del avatar, derivada de su id: siempre el mismo aspecto. */
function wsAvatarColors(actor) {
  const a = wsObj(actor);
  const hue = wsNum(a.hue, 200);
  if (a.kind === 'ai') {
    return { body: 'hsl(' + ((hue % 60) + 170) + ' 55% 52%)', head: '#E9F6F7',
      trim: 'hsl(' + ((hue % 60) + 170) + ' 70% 72%)' };
  }
  return { body: 'hsl(' + hue + ' 42% 48%)', head: 'hsl(' + ((hue * 7) % 40 + 20) + ' 45% 74%)',
    trim: 'hsl(' + hue + ' 42% 66%)' };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Motor creativo: investigación, concepto y plan
// Funciones puras: (campaña) → fragmento. Sin IO, sin React, deterministas.
// ═══════════════════════════════════════════════════════════════════════════

/** Extrae atributos del producto a partir de nombre, USP y notas. */
function deriveAttributes(c) {
  const cat = categoryById(c.categoryId);
  const txt = [c.brief.usp, c.brief.extraNotes, c.brief.productName].join(' . ');
  const fromUsp = s(txt).split(/[.;\n·•|]+/).map((x) => x.trim()).filter((x) => x.length > 3).slice(0, 8);
  const attrs = fromUsp.map((t) => ({ text: sentence(t), source: 'brief' }));
  if (attrs.length < 3) {
    for (const v of cat.visualCodes.slice(0, 3 - attrs.length)) attrs.push({ text: sentence(v), source: 'categoría' });
  }
  return attrs;
}

/**
 * Convierte atributos en BENEFICIOS (lo que gana quien compra).
 * Las plantillas son frases COMPLETAS y autosuficientes: componer un verbo
 * suelto con una cola genérica produce castellano torcido ("te permite que
 * distinción deje de ser un problema"), y eso acaba en un anuncio real.
 */
function deriveBenefits(c, attrs) {
  const aud = audienceById(c.audienceId);
  const cat = categoryById(c.categoryId);
  const r = rng(seedOf(c) ^ 0x51ed);
  const list = arr(attrs).slice(0, 5);
  const used = [];
  const out = list.map((a, i) => ({
    attribute: a.text,
    benefit: benefitPhrase(a.text, aud, cat, r, used),
    proof: cat.triggers[i % cat.triggers.length],
  }));
  if (!out.length) {
    out.push({
      attribute: s(c.brief.productName) || 'El producto',
      benefit: 'Responde de una vez a la duda de siempre: ' + cat.objections[0].replace(/^¿|\?$/g, '').toLowerCase(),
      proof: cat.triggers[0],
    });
  }
  return out;
}
function benefitPhrase(attr, aud, cat, r, used) {
  const driver = s(aud.driver);
  const templates = [
    'Notas la diferencia desde el primer uso',
    'Te quita el paso que más te frena',
    'Consigues ' + driver + ' sin pelearte con el producto',
    'Dejas de conformarte con la alternativa de siempre',
    'Llegas al resultado sin pasos intermedios',
    'Aguanta el uso diario sin pedirte nada a cambio',
    'Hace que ' + driver + ' deje de depender de la suerte',
  ];
  const free = templates.filter((t) => used.indexOf(t) < 0);
  const chosen = pick(free.length ? free : templates, r) || templates[0];
  used.push(chosen);
  return chosen;
}

/** Emociones dominantes según objetivo, estilo y público. */
function deriveEmotions(c) {
  const st = styleById(c.styleId);
  const aud = audienceById(c.audienceId);
  const map = {
    'premium-cinematic': ['deseo contenido', 'respeto', 'pertenencia a una minoría'],
    'epic-sport': ['adrenalina', 'orgullo', 'rabia productiva'],
    'nordic-minimal': ['calma', 'alivio', 'orden'],
    'street-energy': ['diversión', 'complicidad', 'sorpresa'],
    'tech-future': ['curiosidad', 'confianza técnica', 'anticipación'],
    'gourmet-macro': ['antojo', 'nostalgia', 'placer'],
    'editorial-fashion': ['admiración', 'aspiración', 'frialdad elegante'],
    'warm-lifestyle': ['ternura', 'seguridad', 'gratitud'],
    'retro-90s': ['nostalgia', 'humor', 'reconocimiento'],
    'luxury-noir': ['deseo', 'misterio', 'poder'],
  };
  const base = map[st.id] || ['deseo', 'confianza', 'urgencia'];
  return base.concat(['alivio de ' + aud.driver.split(' ')[0]]).slice(0, 4);
}

/**
 * AGENTE 2 · Research — investigación de mercado, competencia, tendencias,
 * público, nicho y códigos visuales dominantes.
 */
function buildResearch(c) {
  const cat = categoryById(c.categoryId);
  const aud = audienceById(c.audienceId);
  const obj0 = objectiveById(c.objectiveId);
  const r = rng(seedOf(c) ^ 0x2b17);
  const compTxt = s(c.brief.competitorsText).split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  const competitors = (compTxt.length ? compTxt : cat.competitors).map((name, i) => ({
    name: sentence(name),
    posture: i === 0 ? 'Líder de referencia' : i === 1 ? 'Retador' : 'Alternativa lateral',
    strength: cat.competitors[i % cat.competitors.length],
    gap: pick([
      'no muestra el producto en uso real',
      'comunica características, no consecuencias',
      'no responde a la objeción principal del comprador',
      'usa un lenguaje visual indistinguible del resto de la categoría',
      'no tiene una pieza vertical nativa, solo recortes del horizontal',
    ], r),
  }));
  const channels = uniq(aud.channelBias.concat(cat.channels)).slice(0, 5)
    .map((id) => PLATFORMS.find((p) => p.id === id)).filter(Boolean)
    .map((p) => ({ id: p.id, label: p.label, ctr: p.ctr, cpm: p.cpm, cvr: p.cvr, hookSec: p.hookSec }));
  return {
    generatedAt: nowIso(),
    market: {
      category: cat.label, region: s(c.brief.marketRegion),
      seasonality: cat.seasonality, priceLogic: cat.priceLogic,
      trends: cat.trends,
    },
    audience: {
      segment: aud.label, age: aud.age, driver: aud.driver, language: aud.language, proof: aud.proof,
      behaviours: cat.audience, objections: cat.objections, triggers: cat.triggers,
    },
    competition: competitors,
    niche: {
      statement: 'Para ' + aud.label.toLowerCase() + ' de ' + aud.age + ' que buscan ' + aud.driver
        + ', ' + (s(c.brief.productName) || 'el producto') + ' es la opción que ' + (s(c.brief.usp).split(/[.\n]/)[0] || 'resuelve el problema sin concesiones') + '.',
      whiteSpace: 'La categoría repite ' + cat.visualCodes[0].toLowerCase() + '; el hueco está en '
        + (competitors[0] ? competitors[0].gap : 'mostrar la consecuencia real de usarlo') + '.',
    },
    visualCodes: { dominant: cat.visualCodes, avoid: styleById(c.styleId).negative },
    channels,
    objectiveFit: { objective: obj0.label, kpi: obj0.kpi },
    sources: [
      'Base de conocimiento de categoría de Kreative Studio (' + cat.label + ')',
      'Benchmarks de canal por familia de plataforma',
      c.brief.competitorsText ? 'Competencia declarada en el brief' : 'Arquetipos de competencia de la categoría',
    ],
  };
}

/**
 * AGENTE 1 · Creative Director — atributos, ventajas, emociones, storytelling,
 * estilo visual, narrativa y concepto (big idea).
 */
function buildConcept(c) {
  const st = styleById(c.styleId);
  const cat = categoryById(c.categoryId);
  const aud = audienceById(c.audienceId);
  const obj0 = objectiveById(c.objectiveId);
  const r = rng(seedOf(c) ^ 0x7f31);
  const product = s(c.brief.productName) || 'El producto';
  const attributes = deriveAttributes(c);
  const benefits = deriveBenefits(c, attributes);
  const emotions = deriveEmotions(c);

  const arcs = [
    { id: 'problem-solution', name: 'Problema · Solución', beats: ['Tensión cotidiana', 'Aparece el producto', 'La fricción desaparece', 'Nueva normalidad'] },
    { id: 'hero-journey', name: 'Viaje del héroe', beats: ['Mundo ordinario', 'Llamada', 'Prueba', 'Transformación'] },
    { id: 'product-as-hero', name: 'El producto como héroe', beats: ['Revelación', 'Anatomía', 'Demostración', 'Consagración'] },
    { id: 'before-after', name: 'Antes · Después', beats: ['El antes crudo', 'El punto de giro', 'El después', 'La prueba'] },
    { id: 'ritual', name: 'El ritual', beats: ['Preparación', 'Gesto clave', 'Disfrute', 'Repetición'] },
    { id: 'manifesto', name: 'Manifiesto', beats: ['Declaración', 'Enemigo común', 'Nuestra respuesta', 'Llamada a la acción'] },
  ];
  const arcPref = { awareness: ['manifesto', 'hero-journey', 'product-as-hero'], consideration: ['problem-solution', 'before-after', 'product-as-hero'],
    conversion: ['before-after', 'problem-solution', 'ritual'], launch: ['product-as-hero', 'manifesto', 'hero-journey'], remarketing: ['before-after', 'ritual', 'problem-solution'] };
  const pref = arcPref[obj0.id] || ['problem-solution'];
  const arc = arcs.find((a) => a.id === pref[0]) || arcs[0];

  const enemy = cat.objections[0].replace(/^¿|\?$/g, '');
  const ideaTemplates = [
    product + ' no se explica: se demuestra.',
    'Lo que otros prometen, ' + product + ' lo enseña en ' + (c.settings.shortDurationSec || 15) + ' segundos.',
    'El detalle que nadie mira es el que lo cambia todo.',
    'No es ' + cat.label.toLowerCase() + '. Es ' + aud.driver + ' resuelto.',
    'Deja de preguntarte "' + enemy.toLowerCase() + '".',
    'Hecho para quien ya sabe la diferencia.',
  ];
  const bigIdea = pick(ideaTemplates, r);

  const moneyShot = {
    description: product + ' en ' + labelOf(SHOTS, st.shots[0]).toLowerCase() + ', con '
      + labelOf(LIGHTING, st.lighting[0]).toLowerCase() + ' y ' + labelOf(GRADES, st.grades[0]).toLowerCase()
      + '; el gesto que resume el beneficio ocurre dentro del plano.',
    shot: st.shots[0], lighting: st.lighting[0], grade: st.grades[0], lens: st.lenses[0], move: st.moves[0],
    fx: st.fx[0], whyItSells: benefits[0] ? benefits[0].benefit : 'Muestra la consecuencia, no la característica.',
  };

  const keyMessage = sentence((s(c.brief.usp).split(/[.\n]/)[0] || (product + ' hace evidente ' + aud.driver)).trim());
  const claims = [
    keyMessage,
    benefits[0] ? sentence(benefits[0].benefit) : '',
    'Diseñado para ' + aud.label.toLowerCase() + '.',
  ].filter(Boolean);

  const moodboard = {
    palette: st.palette,
    references: st.refs,
    textures: cat.visualCodes,
    lightingNotes: st.lighting.map((l) => labelOf(LIGHTING, l)),
    lensKit: st.lenses.map((l) => labelOf(LENSES, l)),
    typography: st.typography,
    doNot: st.negative,
  };

  return {
    generatedAt: nowIso(),
    bigIdea, keyMessage, claims,
    attributes, benefits, emotions,
    storytelling: {
      arcId: arc.id, arcName: arc.name, beats: arc.beats,
      logline: 'En ' + (c.settings.heroDurationSec || 30) + ' segundos, ' + product + ' lleva a ' + aud.label.toLowerCase()
        + ' desde la duda «' + enemy.toLowerCase() + '» hasta la certeza de que '
        + (benefits[0] ? benefits[0].benefit.toLowerCase() : 'merece la pena') + '.',
      enemy, promise: keyMessage,
    },
    direction: {
      styleId: st.id, styleName: st.name, tone: st.tone, era: st.era, filmStock: st.filmStock,
      pacing: st.pacing, rules: [
        'El producto aparece antes del segundo ' + (st.pacing.energy >= 4 ? '2' : '4') + '.',
        'Ningún plano sin una fuente de luz identificable.',
        'La paleta se limita a los cinco colores del estilo.',
        'Cada plano defiende un único beneficio.',
      ],
    },
    moneyShot, moodboard,
  };
}

/**
 * AGENTE 3 · Campaign Planner — objetivo, funnel completo, canales, reparto
 * de presupuesto, calendario y KPIs.
 */
function buildPlan(c) {
  const obj0 = objectiveById(c.objectiveId);
  const research = obj(c.research);
  const chans = arr(research.channels).length ? arr(research.channels)
    : categoryById(c.categoryId).channels.map((id) => PLATFORMS.find((p) => p.id === id)).filter(Boolean);
  const budget = Math.max(0, num(c.brief.budget, 0));
  const cur = s(c.brief.currency) || 'USD';

  // El reparto del funnel depende del objetivo declarado.
  const mix = {
    awareness: { awareness: 55, consideration: 25, conversion: 15, remarketing: 5 },
    consideration: { awareness: 30, consideration: 40, conversion: 20, remarketing: 10 },
    conversion: { awareness: 20, consideration: 25, conversion: 40, remarketing: 15 },
    launch: { awareness: 45, consideration: 25, conversion: 20, remarketing: 10 },
    remarketing: { awareness: 10, consideration: 20, conversion: 40, remarketing: 30 },
  }[obj0.id];

  const stageDefs = [
    { id: 'awareness', label: 'Notoriedad', goal: 'Que la categoría sepa que existes',
      message: 'gancho emocional, producto reconocible, cero fricción', kpi: 'CPM, alcance, VTR 3s',
      formats: ['9:16 · 15s', '16:9 · 30s'], creativeNote: 'Hook en los primeros 2 segundos, sin logo hasta el final.' },
    { id: 'consideration', label: 'Consideración', goal: 'Que entienda por qué tú y no otro',
      message: 'demostración, comparativa honesta, prueba social', kpi: 'CTR, tiempo de visionado, visitas',
      formats: ['9:16 · 30s', '1:1 · 20s'], creativeNote: 'El beneficio se demuestra en pantalla, no se afirma.' },
    { id: 'conversion', label: 'Conversión', goal: 'Que compre ahora',
      message: 'oferta, garantía, urgencia legítima', kpi: 'ROAS, CPA, CVR',
      formats: ['4:5 · 15s', '9:16 · 15s'], creativeNote: 'CTA visible desde el segundo 1 y repetido al cierre.' },
    { id: 'remarketing', label: 'Remarketing', goal: 'Recuperar al que se fue sin comprar',
      message: 'objeción resuelta + incentivo puntual', kpi: 'ROAS, frecuencia, coste por recuperación',
      formats: ['9:16 · 10s', '1:1 · 10s'], creativeNote: 'Ataca la objeción concreta: envío, talla, precio o duda técnica.' },
  ];
  const weights = stageDefs.map((sd) => mix[sd.id]);
  const money = splitByWeight(budget, weights);

  const stages = stageDefs.map((sd, i) => {
    const pct = mix[sd.id];
    const chan = chans.slice(0, 3).map((p) => p.label || s(p.id));
    const spend = money[i];
    const bench = chans[0] || { cpm: 8, ctr: 0.01, cvr: 0.02 };
    const impressions = bench.cpm > 0 ? Math.round((spend / bench.cpm) * 1000) : 0;
    return Object.assign({}, sd, {
      sharePct: pct, budget: spend, currency: cur, channels: chan,
      projection: { impressions, clicks: Math.round(impressions * num(bench.ctr, 0.01)),
        actions: Math.round(impressions * num(bench.ctr, 0.01) * num(bench.cvr, 0.02)) },
    });
  });

  const weeks = [
    { week: 1, focus: 'Notoriedad', actions: ['Publicar el hero 16:9 y los verticales', 'Activar públicos amplios', 'Medir VTR 3s por variante'] },
    { week: 2, focus: 'Consideración', actions: ['Rotar variantes ganadoras', 'Activar públicos similares', 'Publicar la landing con el vídeo hero'] },
    { week: 3, focus: 'Conversión', actions: ['Escalar la creatividad con mejor CTR', 'Activar catálogo y oferta', 'Lanzar la secuencia de email'] },
    { week: 4, focus: 'Remarketing', actions: ['Segmentar por objeción detectada', 'Refrescar creatividades saturadas', 'Cerrar informe de aprendizajes'] },
  ];

  return {
    generatedAt: nowIso(),
    objective: { id: obj0.id, label: obj0.label, kpi: obj0.kpi },
    budget: { total: budget, currency: cur, byStage: stages.map((x) => ({ id: x.id, label: x.label, amount: x.budget })) },
    funnel: stages,
    channels: chans.map((p) => ({ id: p.id, label: p.label || s(p.id), role: p.id === chans[0].id ? 'principal' : 'apoyo' })),
    calendar: weeks,
    kpis: [
      { id: 'vtr3', label: 'VTR 3 s', target: '≥ 35 %', why: 'Mide si el hook funciona.' },
      { id: 'ctr', label: 'CTR', target: '≥ ' + round((num(chans[0] && chans[0].ctr, 0.01)) * 100 * 1.2, 2) + ' %', why: '20 % sobre el benchmark del canal principal.' },
      { id: 'cpa', label: 'CPA', target: budget ? '≤ ' + fmtMoney(budget / Math.max(1, stages[2].projection.actions), cur) : 'por definir', why: 'Deriva del presupuesto y de la conversión proyectada.' },
      { id: 'roas', label: 'ROAS', target: '≥ 2,5×', why: 'Umbral de rentabilidad habitual en campaña de tráfico frío.' },
      { id: 'freq', label: 'Frecuencia', target: '≤ 3,5', why: 'Por encima, la creatividad se satura.' },
    ],
    testPlan: [
      'Prueba A/B de gancho: pregunta directa vs. demostración muda.',
      'Prueba de duración: 15 s frente a 30 s en el mismo público.',
      'Prueba de cierre: oferta explícita frente a marca pura.',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 4 · Storyboard Generator
// Convierte concepto + estilo + duración en una secuencia de escenas con
// dirección completa: encuadre, ángulo, óptica, movimiento, luz, color, FX,
// ritmo, texto en pantalla y función narrativa.
// ═══════════════════════════════════════════════════════════════════════════

/** Estructura narrativa por objetivo: peso de cada función en el metraje. */
const BEAT_ROLES = [
  { id: 'hook', label: 'Gancho', purpose: 'Detener el scroll en menos de 2 s' },
  { id: 'problem', label: 'Tensión', purpose: 'Nombrar la fricción que el público reconoce' },
  { id: 'reveal', label: 'Revelación', purpose: 'Aparece el producto como respuesta' },
  { id: 'demo', label: 'Demostración', purpose: 'Enseñar el beneficio funcionando' },
  { id: 'detail', label: 'Detalle', purpose: 'Justificar el precio con materia y precisión' },
  { id: 'proof', label: 'Prueba', purpose: 'Prueba social, dato o garantía' },
  { id: 'money', label: 'Money shot', purpose: 'El plano que se recuerda y se comparte' },
  { id: 'cta', label: 'Cierre', purpose: 'Marca, promesa y llamada a la acción' },
];

/** Plantillas de secuencia según arco narrativo. */
const ARC_SEQUENCES = {
  'problem-solution': ['hook', 'problem', 'reveal', 'demo', 'detail', 'proof', 'money', 'cta'],
  'hero-journey': ['hook', 'problem', 'reveal', 'demo', 'money', 'proof', 'detail', 'cta'],
  'product-as-hero': ['hook', 'reveal', 'detail', 'demo', 'money', 'proof', 'detail', 'cta'],
  'before-after': ['hook', 'problem', 'demo', 'reveal', 'proof', 'money', 'detail', 'cta'],
  ritual: ['hook', 'detail', 'demo', 'money', 'proof', 'reveal', 'detail', 'cta'],
  manifesto: ['hook', 'problem', 'money', 'reveal', 'demo', 'proof', 'detail', 'cta'],
};

/** Reparto de duración por función (pesos relativos). */
const ROLE_WEIGHT = { hook: 1.0, problem: 1.0, reveal: 1.1, demo: 1.5, detail: 0.9, proof: 1.1, money: 1.4, cta: 1.2 };

/**
 * Genera una secuencia de escenas para una duración objetivo.
 * `variant` desplaza la semilla para producir variantes coherentes pero
 * distintas (A/B testing real, no cambios cosméticos).
 */
function buildScenes(c, opts) {
  const o = obj(opts);
  const st = styleById(c.styleId);
  const cat = categoryById(c.categoryId);
  const aud = audienceById(c.audienceId);
  const concept = obj(c.concept);
  const product = s(c.brief.productName) || 'el producto';
  const total = clamp(num(o.durationSec, c.settings.heroDurationSec), 5, 180);
  const aspect = s(o.aspect) || '16:9';
  const variant = num(o.variant, 0);
  const r = rng((seedOf(c) ^ 0x1a2b) + variant * 7919 + hash32(aspect));

  const arcId = s(obj(concept.storytelling).arcId) || 'problem-solution';
  let roles = (ARC_SEQUENCES[arcId] || ARC_SEQUENCES['problem-solution']).slice();

  // Cuántas escenas caben: el ritmo del estilo manda, con mínimos por formato.
  const target = clamp(Math.round(total / Math.max(0.8, st.pacing.avgShotSec)), 3, 24);
  if (roles.length > target) {
    // Recorta manteniendo siempre gancho, revelación, money shot y cierre.
    const keep = new Set(['hook', 'reveal', 'money', 'cta']);
    const trimmed = roles.filter((x) => keep.has(x));
    const rest = roles.filter((x) => !keep.has(x));
    while (trimmed.length < target && rest.length) trimmed.splice(trimmed.length - 1, 0, rest.shift());
    roles = ARC_SEQUENCES[arcId].filter((x) => trimmed.indexOf(x) >= 0);
  } else if (roles.length < target) {
    const filler = ['demo', 'detail', 'proof', 'money'];
    let i = 0;
    while (roles.length < target) { roles.splice(roles.length - 1, 0, filler[i % filler.length]); i++; }
  }

  const weights = roles.map((x) => ROLE_WEIGHT[x] || 1);
  const durs = splitByWeightFloat(total, weights).map((d) => round(clamp(d, 0.8, 12), 1));
  // Reajuste fino para que la suma coincida exactamente con la duración pedida.
  const drift = round(total - durs.reduce((a, b) => a + b, 0), 1);
  if (Math.abs(drift) >= 0.1) {
    const idx = durs.indexOf(Math.max.apply(null, durs));
    durs[idx] = round(clamp(durs[idx] + drift, 0.8, 14), 1);
  }

  const benefits = arr(concept.benefits);
  let tAcc = 0;
  const scenes = roles.map((role, i) => {
    const dur = durs[i];
    const start = round(tAcc, 2); tAcc = round(tAcc + dur, 2);
    const isVertical = aspect === '9:16' || aspect === '4:5';
    const spec = shotForRole(role, st, cat, r, { vertical: isVertical, index: i, count: roles.length });
    const benefit = benefits.length ? benefits[i % benefits.length] : null;
    return {
      id: 'sc-' + (variant ? 'v' + variant + '-' : '') + slug(aspect) + '-' + (i + 1),
      n: i + 1, code: 'SC' + String(i + 1).padStart(2, '0'),
      role, roleLabel: (BEAT_ROLES.find((b) => b.id === role) || {}).label || role,
      purpose: (BEAT_ROLES.find((b) => b.id === role) || {}).purpose || '',
      startSec: start, durationSec: dur,
      description: sceneDescription(role, product, c, spec, benefit, r),
      shot: spec.shot, angle: spec.angle, lens: spec.lens, move: spec.move,
      lighting: spec.lighting, grade: spec.grade, fx: spec.fx,
      speed: spec.speed, transitionIn: spec.transitionIn,
      onScreenText: onScreenTextFor(role, c, benefit, r),
      soundNote: soundNoteFor(role, st, cat),
      productVisible: role !== 'problem' && role !== 'hook' ? true : role === 'hook' ? st.pacing.energy >= 4 : false,
      notes: '',
    };
  });
  return dedupeOnScreenText(scenes);
}

/** Reparto proporcional en coma flotante (no entero como splitByWeight). */
function splitByWeightFloat(total, weights) {
  const ws = arr(weights).map((w) => Math.max(0.01, num(w, 1)));
  const sum = ws.reduce((a, b) => a + b, 0);
  return ws.map((w) => (total * w) / sum);
}

/** Elige encuadre/óptica/luz coherentes con el estilo y la función del plano. */
function shotForRole(role, st, cat, r, ctx) {
  const c = obj(ctx);
  const detailShots = ['macro', 'extreme-close', 'insert', 'close'];
  const wideShots = ['wide', 'extreme-wide', 'full', 'medium'];
  let shot;
  if (role === 'detail' || role === 'reveal') shot = pick(intersectOr(st.shots, detailShots), r);
  else if (role === 'problem' || role === 'hook') shot = pick(intersectOr(st.shots, c.vertical ? ['medium-close', 'close', 'pov'] : wideShots), r);
  else if (role === 'money') shot = st.shots[0] || 'hero';
  else if (role === 'cta') shot = c.vertical ? 'medium' : 'hero';
  else shot = pick(st.shots, r);

  const move = role === 'money' ? (st.moves[0] || 'slow-push')
    : role === 'cta' ? 'static'
      : role === 'hook' ? pick(st.moves.slice(0, 2).concat(['whip-pan']), r)
        : pick(st.moves, r);

  const lens = role === 'detail' || role === 'reveal'
    ? pick(intersectOr(st.lenses, ['100mm-macro', 'probe', '85mm']), r)
    : pick(st.lenses, r);

  const fxPool = st.fx.filter((f) => f !== 'none');
  const fx = role === 'money' || role === 'demo'
    ? uniq([st.fx[0], pick(fxPool, r)]).filter(Boolean).slice(0, 2)
    : role === 'cta' ? [] : (r() > 0.45 ? [pick(fxPool, r)].filter(Boolean) : []);

  return {
    shot: shot || 'medium',
    angle: role === 'money' ? 'low' : pick(['eye', 'eye', 'low', 'high', 'profile'], r),
    lens: lens || '50mm',
    move: move || 'static',
    lighting: pick(st.lighting, r) || 'softbox',
    grade: st.grades[0] || 'clean',
    fx,
    speed: role === 'money' && fx.indexOf('slow-motion') >= 0 ? 0.4 : 1,
    transitionIn: c.index === 0 ? 'cut' : pick(st.transitions, r) || 'cut',
  };
}
/** Intersección; si queda vacía, devuelve la segunda lista (fallback útil). */
function intersectOr(a, b) {
  const inter = arr(a).filter((x) => arr(b).indexOf(x) >= 0);
  return inter.length ? inter : arr(b);
}

function sceneDescription(role, product, c, spec, benefit, r) {
  const cat = categoryById(c.categoryId);
  const aud = audienceById(c.audienceId);
  const concept = obj(c.concept);
  const env = pick(cat.visualCodes, r) || 'fondo neutro';
  const tpl = {
    hook: [
      'Arranque en seco: ' + (labelOf(MOVES, spec.move)).toLowerCase() + ' sobre ' + env.toLowerCase() + '. Aún no se ve ' + product + ', pero el gesto ya promete algo.',
      'Un detalle inesperado ocupa el encuadre completo y obliga a mirar antes de entender qué es.',
    ],
    problem: [
      'La fricción en estado puro: ' + s(obj(concept.storytelling).enemy || cat.objections[0]).toLowerCase() + ', mostrada sin diálogo.',
      'El personaje repite el gesto de siempre y falla; la cámara no le da tregua.',
    ],
    reveal: [
      product + ' entra en cuadro y todo se ordena a su alrededor. Primera vez que se lee la forma completa.',
      'Corte a ' + product + ' sobre ' + env.toLowerCase() + ': la luz lo descubre por partes.',
    ],
    demo: [
      (benefit ? sentence(benefit.benefit) : 'El beneficio') + ', demostrado en una sola acción continua, sin cortes tramposos.',
      product + ' en uso real: la consecuencia ocurre dentro del plano, no se cuenta después.',
    ],
    detail: [
      'Textura y precisión: ' + (benefit ? benefit.attribute.toLowerCase() : 'el acabado') + ' llenando el encuadre.',
      'La cámara recorre el borde de ' + product + ' hasta que se entiende cómo está hecho.',
    ],
    proof: [
      'Prueba en pantalla: ' + s(aud.proof) + ', integrada en la imagen y no como cartel pegado.',
      'Alguien parecido al público objetivo confirma el resultado con una sola frase.',
    ],
    money: [
      s(obj(concept.moneyShot).description) || (product + ' monumental, luz de contraste y movimiento mínimo.'),
      product + ' en el plano que se recuerda: ' + labelOf(LIGHTING, spec.lighting).toLowerCase() + ' y ' + labelOf(MOVES, spec.move).toLowerCase() + '.',
    ],
    cta: [
      'Fondo limpio de marca, logotipo, promesa en una línea y llamada a la acción legible.',
      'Cierre de marca: ' + (s(c.brand.slogan) || s(concept.keyMessage) || 'la promesa') + ' sobre color plano.',
    ],
  }[role] || ['Plano de apoyo de ' + product + '.'];
  return pick(tpl, r) || tpl[0];
}

/** Rótulo de un plano. Se recorta por palabra completa: un texto partido a
 *  media palabra queda quemado en el máster y no hay vuelta atrás. */
function onScreenTextFor(role, c, benefit, r) {
  const concept = obj(c.concept);
  const product = s(c.brief.productName) || 'El producto';
  if (role === 'hook') return fit(sentence(s(concept.bigIdea).split('.')[0] || product), 52);
  if (role === 'problem') return fit(sentence(s(obj(concept.storytelling).enemy) || ''), 46);
  if (role === 'demo' && benefit) return fit(sentence(benefit.benefit), 46);
  if (role === 'detail' && benefit) return fit(sentence(benefit.attribute), 40);
  if (role === 'proof') return fit(sentence(audienceById(c.audienceId).proof), 46);
  if (role === 'money') return fit(sentence(s(concept.keyMessage)), 48);
  if (role === 'cta') return s(c.brand.slogan) || ctaFor(c);
  return '';
}

/**
 * Quita rótulos repetidos. Con más planos que beneficios, el reparto cíclico
 * acaba mostrando el mismo texto cinco veces; en pantalla eso se lee como un
 * error de montaje. Se conservan siempre gancho, money shot y cierre.
 */
function dedupeOnScreenText(scenes) {
  const seen = new Set();
  const keep = { hook: 1, money: 1, cta: 1 };
  for (const sc of arr(scenes)) {
    const t = norm(sc.onScreenText);
    if (!t) continue;
    if (seen.has(t) && !keep[sc.role]) { sc.onScreenText = ''; continue; }
    seen.add(t);
  }
  return scenes;
}
function ctaFor(c) {
  const o = objectiveById(c.objectiveId).id;
  return o === 'conversion' ? 'Compra ahora'
    : o === 'remarketing' ? 'Termina tu compra'
      : o === 'launch' ? 'Ya disponible'
        : o === 'consideration' ? 'Descúbrelo' : 'Conócelo';
}

function soundNoteFor(role, st, cat) {
  if (role === 'hook') return 'Silencio o único golpe de foley; la música entra en el corte siguiente.';
  if (role === 'problem') return 'Ambiente seco, sin música, tensión por ausencia.';
  if (role === 'reveal') return 'Entrada de la música (' + st.music.genre + ') con un swell ascendente.';
  if (role === 'demo') return 'Foley protagonista del gesto principal, música en segundo plano.';
  if (role === 'detail') return 'Foley de textura muy cercano, casi ASMR.';
  if (role === 'proof') return 'Voz en primer plano, música bajo -18 dB.';
  if (role === 'money') return 'Clímax musical; el foley se apaga para dejar respirar la imagen.';
  return 'Resolución musical y golpe final de marca.';
}

/**
 * Storyboard completo: pieza hero + cortes por formato + variantes.
 * Devuelve `{ scenes, formats, variants }` donde `scenes` es la pieza maestra.
 */
function buildStoryboard(c) {
  const st = styleById(c.styleId);
  const hero = clamp(num(c.settings.heroDurationSec, 30), 5, 180);
  const short = clamp(num(c.settings.shortDurationSec, 15), 5, 90);
  const aspects = arr(c.settings.targets.aspects);
  const master = buildScenes(c, { durationSec: hero, aspect: aspects[0] || '16:9', variant: 0 });

  const formats = {};
  const masterAspect = aspects[0] || '16:9';
  for (const a of aspects) {
    const isVertical = a === '9:16' || a === '4:5';
    const dur = isVertical ? short : hero;
    const isMaster = a === masterAspect;
    formats[a] = {
      aspect: a, durationSec: dur, isMaster,
      dims: RESOLUTIONS.map((r) => ({ res: r.id, label: r.label, ...dimsFor(a, r.id) })),
      // El formato maestro NO duplica las escenas: apunta a `storyboard.scenes`.
      // Duplicarlas dejaba la copia obsoleta en cuanto se editaba un plano, y
      // el entregable acababa declarando una duración que no era la suya.
      scenes: isMaster ? [] : buildScenes(c, { durationSec: dur, aspect: a, variant: 0 }),
      safeArea: isVertical ? { top: 12, bottom: 20, left: 6, right: 6 } : { top: 6, bottom: 8, left: 6, right: 6 },
      note: isVertical ? 'Texto y logotipo fuera de la zona de la interfaz (arriba 12 %, abajo 20 %).'
        : 'Composición apta para recorte central a 1:1 sin perder el producto.',
    };
  }

  const nVariants = clamp(num(c.settings.variantCount, 3), 1, 8);
  const variants = [];
  for (let v = 1; v < nVariants; v++) {
    const aspect = aspects[v % Math.max(1, aspects.length)] || '9:16';
    const isVertical = aspect === '9:16' || aspect === '4:5';
    variants.push({
      id: 'var-' + v, label: 'Variante ' + String.fromCharCode(65 + v),
      hypothesis: VARIANT_HYPOTHESES[(v - 1) % VARIANT_HYPOTHESES.length],
      aspect, durationSec: isVertical ? short : hero,
      scenes: buildScenes(c, { durationSec: isVertical ? short : hero, aspect, variant: v }),
    });
  }

  return {
    generatedAt: nowIso(),
    masterAspect: aspects[0] || '16:9',
    pacing: st.pacing,
    scenes: master,
    formats, variants,
    totalSec: round(master.reduce((a, x) => a + num(x.durationSec, 0), 0), 1),
  };
}

/** Escenas de un formato: el maestro siempre lee la lista viva. */
function scenesOfFormat(sb, aspect) {
  const f = obj(obj(sb).formats)[s(aspect)];
  if (!f) return [];
  return f.isMaster || !arr(f.scenes).length ? arr(obj(sb).scenes) : arr(f.scenes);
}

const VARIANT_HYPOTHESES = [
  'El gancho con pregunta directa retiene más que la demostración muda.',
  'Adelantar el money shot al segundo 3 sube el CTR aunque baje el VTR.',
  'Cerrar con oferta explícita convierte más que cerrar con marca.',
  'La versión sin locución rinde mejor en reproducción silenciada.',
  'El testimonio en primera persona supera al narrador en off.',
  'Empezar por el precio filtra tráfico y mejora el CPA.',
  'El plano de detalle como apertura funciona mejor en vertical.',
];

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 5 · Prompt Engineer
// Construye el PromptSpec NEUTRAL de cada escena y lo hace traducir por el
// registro de proveedores. Un solo spec → todos los modelos.
// ═══════════════════════════════════════════════════════════════════════════

/** Texto de paleta legible por los modelos (nombres + hex). */
function paletteText(brand, st) {
  const p = obj(brand.palette).primary ? brand.palette : st.palette;
  const parts = ['primary ' + s(p.primary), 'secondary ' + s(p.secondary), 'accent ' + s(p.accent)];
  return 'strict color palette: ' + parts.join(', ');
}

/** Descripción del producto para que el modelo no lo reinvente. */
function productLock(c) {
  const b = c.brief;
  const lock = s(c.brand.productLock).trim();
  if (lock) return lock;
  const bits = [s(b.productName), s(b.usp).split(/[.\n]/)[0]].filter(Boolean);
  return bits.length ? 'keep the exact shape, proportions, materials and branding of ' + bits.join(' — ')
    : 'keep the product geometry and branding identical in every shot';
}

/** URLs de referencia del producto (fotos subidas por el usuario). */
function refImagesOf(c, limit) {
  const photos = arr(c.brief.photos);
  const hero = photos.filter((p) => p.isHero);
  const list = (hero.length ? hero.concat(photos.filter((p) => !p.isHero)) : photos).map((p) => s(p.url)).filter(Boolean);
  return list.slice(0, Math.max(1, num(limit, 3)));
}

/**
 * PromptSpec neutral de una escena. Es la interfaz que consumen TODOS los
 * proveedores; ningún agente escribe sintaxis de un modelo concreto.
 */
function specForScene(c, scene, opts) {
  const o = obj(opts);
  const st = styleById(c.styleId);
  const cat = categoryById(c.categoryId);
  const concept = obj(c.concept);
  const product = s(c.brief.productName) || 'the product';
  const isVideo = o.kind === 'video';
  const aspect = s(o.aspect) || s(c.storyboard && c.storyboard.masterAspect) || '16:9';

  const subject = scene.productVisible
    ? product + (s(c.brief.category) ? ' (' + s(c.brief.category) + ')' : '')
    : (scene.role === 'problem' ? 'a person from the target audience (' + audienceById(c.audienceId).label + ')' : 'the scene environment');

  return {
    sceneId: s(scene.id), sceneCode: s(scene.code), role: s(scene.role),
    subject,
    action: sceneActionEn(scene, c),
    environment: environmentEn(c, scene),
    mood: st.tone,
    shot: scene.shot, angle: scene.angle, lens: scene.lens, move: scene.move,
    lighting: scene.lighting, grade: scene.grade, fx: arr(scene.fx),
    styleText: [st.name + ' art direction', st.era, st.refs[0] ? 'in the spirit of ' + st.refs[0] : ''].filter(Boolean).join(', '),
    filmStock: st.filmStock,
    paletteText: paletteText(c.brand, st),
    composition: compositionEn(scene, aspect),
    productNote: productLock(c),
    negative: uniq(arr(st.negative).concat(arr(c.brand.forbidden)).concat(
      isVideo ? ['morphing product', 'warped logo', 'flickering', 'inconsistent lighting'] : ['text artifacts', 'distorted logo'])),
    aspect, durationSec: isVideo ? num(scene.durationSec, 5) : 0,
    refImages: refImagesOf(c, isVideo ? 1 : 3),
    audioNote: isVideo ? s(scene.soundNote) : '',
  };
}

function sceneActionEn(scene, c) {
  const role = s(scene.role);
  const product = s(c.brief.productName) || 'the product';
  const map = {
    hook: 'a sudden arresting motion that stops the scroll',
    problem: 'struggling with the everyday friction the product removes',
    reveal: product + ' entering the frame and settling into perfect position',
    demo: 'the product being used, the benefit visibly happening in a single take',
    detail: 'the camera exploring the surface, material and craftsmanship',
    proof: 'a real user reacting with genuine approval',
    money: product + ' presented monumentally, light sculpting its silhouette',
    cta: product + ' centered on a clean brand background with room for typography',
  };
  return map[role] || 'the product presented clearly';
}

function environmentEn(c, scene) {
  const cat = categoryById(c.categoryId);
  const st = styleById(c.styleId);
  const envByStyle = {
    'premium-cinematic': 'a dark minimalist set with a single sculpted light and deep negative space',
    'epic-sport': 'a raw training environment, concrete, chalk dust and hard shadows',
    'nordic-minimal': 'a bright airy space with a seamless off-white backdrop',
    'street-energy': 'a night city street with neon signage and wet asphalt',
    'tech-future': 'a matte dark studio with gradient rim lighting and reflective floor',
    'gourmet-macro': 'a warm wooden surface with soft steam and scattered ingredients',
    'editorial-fashion': 'a stark studio cyclorama with one dramatic hard light',
    'warm-lifestyle': 'a real lived-in home with window light and everyday texture',
    'retro-90s': 'a saturated retro set with primary colored props and CRT glow',
    'luxury-noir': 'total darkness with one narrow beam and drifting smoke',
  };
  const base = envByStyle[st.id] || 'a clean commercial set';
  if (s(scene.role) === 'cta') return 'a flat brand-colored background, generous empty space for typography';
  return base;
}

function compositionEn(scene, aspect) {
  const vertical = aspect === '9:16' || aspect === '4:5';
  if (s(scene.role) === 'cta') return vertical ? 'product in the lower third, headline space in the upper half' : 'product left third, headline space right';
  if (s(scene.role) === 'money') return vertical ? 'centered subject, symmetrical, generous headroom' : 'centered subject on the horizontal thirds, deep background separation';
  return vertical ? 'tight vertical composition, subject filling the central safe area'
    : 'rule of thirds, strong foreground-background separation';
}

/**
 * Genera los prompts de TODA la campaña: una imagen clave por escena
 * (fotograma inicial) y un vídeo por escena, en el proveedor configurado.
 * `overrides` permite forzar proveedor sin tocar los ajustes.
 */
function buildPrompts(c, overrides) {
  const ov = obj(overrides);
  const sb = obj(c.storyboard);
  const scenes = arr(sb.scenes);
  const imgProv = s(ov.image) || s(c.settings.providers.image);
  const vidProv = s(ov.video) || s(c.settings.providers.video);
  const params = obj(c.settings.providerParams);
  const aspect = s(sb.masterAspect) || '16:9';

  const image = scenes.map((sc) => {
    const spec = specForScene(c, sc, { kind: 'image', aspect });
    const out = renderPrompt(imgProv, spec, params[imgProv]);
    return { sceneId: sc.id, code: sc.code, role: sc.role, kind: 'image', aspect, providerId: out.providerId,
      text: out.text, negative: out.negative, params: out.params, payload: out.payload, note: out.note, warnings: out.warnings };
  });

  const video = scenes.map((sc) => {
    const spec = specForScene(c, sc, { kind: 'video', aspect });
    const out = renderPrompt(vidProv, spec, params[vidProv]);
    return { sceneId: sc.id, code: sc.code, role: sc.role, kind: 'video', aspect, durationSec: sc.durationSec,
      providerId: out.providerId, text: out.text, negative: out.negative, params: out.params, payload: out.payload,
      note: out.note, warnings: out.warnings };
  });

  // Prompts por formato adicional (verticales y cuadrados): mismo criterio,
  // reencuadre nativo en vez de recorte.
  const byFormat = {};
  for (const a of Object.keys(obj(sb.formats))) {
    if (a === aspect) continue;
    byFormat[a] = arr(scenesOfFormat(sb, a)).map((sc) => {
      const spec = specForScene(c, sc, { kind: 'video', aspect: a });
      const out = renderPrompt(vidProv, spec, params[vidProv]);
      return { sceneId: sc.id, code: sc.code, role: sc.role, kind: 'video', aspect: a, durationSec: sc.durationSec,
        providerId: out.providerId, text: out.text, negative: out.negative, params: out.params, warnings: out.warnings };
    });
  }

  return {
    generatedAt: nowIso(),
    providers: { image: imgProv, video: vidProv },
    image, video, byFormat,
    counts: { image: image.length, video: video.length,
      byFormat: Object.keys(byFormat).reduce((acc, k) => { acc[k] = byFormat[k].length; return acc; }, {}) },
  };
}

/**
 * Reescribe todos los prompts para OTRO proveedor sin recalcular nada más.
 * Es la demostración práctica de la modularidad: cambiar de Runway a Veo es
 * una llamada, no una migración.
 */
function reprompt(c, capability, providerId) {
  const ov = {};
  ov[s(capability)] = s(providerId);
  return buildPrompts(c, ov);
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 6 · Voice Director
// ═══════════════════════════════════════════════════════════════════════════

/** Palabras por segundo según velocidad de locución (castellano ≈ 2,6 p/s). */
const WPS = 2.6;

function buildAudio(c) {
  const st = styleById(c.styleId);
  const concept = obj(c.concept);
  const sb = obj(c.storyboard);
  const scenes = arr(sb.scenes);
  const aud = audienceById(c.audienceId);
  const product = s(c.brief.productName) || 'el producto';
  const r = rng(seedOf(c) ^ 0x6c1a);

  // Guion de locución: una línea por escena, AJUSTADA a su metraje. Una línea
  // que no cabe no es un aviso: es una toma inservible, así que se recorta.
  const vo = [];
  for (const sc of scenes) {
    const raw = voLineFor(sc, c, concept, r);
    if (!raw) continue;
    const budget = num(sc.durationSec, 2) + 0.35;     // margen de respiración
    const line = fitVo(raw, budget, num(st.voice.pace, 1));
    const words = line.split(/\s+/).filter(Boolean).length;
    const needed = round(words / (WPS * num(st.voice.pace, 1)), 2);
    vo.push({
      sceneId: sc.id, code: sc.code, startSec: sc.startSec, durationSec: sc.durationSec,
      text: line, words, estimatedSec: needed,
      fits: needed <= budget, trimmed: line !== punct(raw),
      original: line !== punct(raw) ? punct(raw) : '',
      direction: st.voice.tone + ' · ' + st.voice.style + (sc.role === 'cta' ? ' · cerrar con firmeza' : ''),
    });
  }
  const voChars = vo.reduce((a, x) => a + x.text.length, 0);

  const music = {
    title: s(c.title) + ' — bed',
    genre: st.music.genre, bpm: st.music.bpm, mood: st.music.mood, instruments: st.music.instruments,
    structure: musicStructure(scenes, st),
    durationSec: round(scenes.reduce((a, x) => a + num(x.durationSec, 0), 0), 1),
    lyrics: '',
    reference: st.refs[0] || '',
    mixNotes: ['Locución a -6 dB, música a -18 dB bajo la voz.',
      'Ducking automático de 300 ms en cada entrada de locución.',
      'Silencio total en el corte previo al money shot (' + (scenes.find((x) => x.role === 'money') || { code: 'SC0' }).code + ').'],
  };

  const ambience = scenes.map((sc) => ({
    sceneId: sc.id, code: sc.code,
    text: ambienceFor(sc, c), durationSec: sc.durationSec,
  }));

  const sfx = scenes.filter((sc) => ['reveal', 'demo', 'money', 'hook'].indexOf(sc.role) >= 0).map((sc) => ({
    sceneId: sc.id, code: sc.code, atSec: sc.startSec,
    text: sfxFor(sc, c), durationSec: Math.min(3, num(sc.durationSec, 2)),
  }));

  // Traducción a los proveedores configurados.
  const voiceProv = s(c.settings.providers.voice);
  const musicProv = s(c.settings.providers.music);
  const sfxProv = s(c.settings.providers.sfx);
  const params = obj(c.settings.providerParams);
  const voRendered = vo.map((v) => {
    const out = renderPrompt(voiceProv, { text: v.text, direction: v.direction }, params[voiceProv]);
    return Object.assign({}, v, { providerId: out.providerId, params: out.params, note: out.note });
  });
  const musicRendered = renderPrompt(musicProv, music, params[musicProv]);
  const sfxRendered = sfx.map((x) => {
    const out = renderPrompt(sfxProv, { text: x.text, duration: x.durationSec }, params[sfxProv]);
    return Object.assign({}, x, { providerId: out.providerId, prompt: out.text, params: out.params });
  });

  return {
    generatedAt: nowIso(),
    vo: voRendered, voChars, voWords: vo.reduce((a, x) => a + x.words, 0),
    overflow: vo.filter((x) => !x.fits).map((x) => x.code),
    trimmed: vo.filter((x) => x.trimmed).map((x) => x.code),
    music: Object.assign({}, music, { providerId: musicRendered.providerId, prompt: musicRendered.text, params: musicRendered.params }),
    ambience, sfx: sfxRendered,
    voiceProfile: { tone: st.voice.tone, pace: st.voice.pace, style: st.voice.style, language: s(c.brief.language) || 'es',
      casting: 'Voz ' + st.voice.tone + '; registro apropiado para ' + aud.label.toLowerCase() + '.' },
  };
}

/**
 * Recorta una línea de locución para que quepa en su plano. Prefiere cortar
 * por cláusulas completas (lo que un guionista haría) y solo trocea por
 * palabras si ni la primera cláusula entra.
 */
function fitVo(text, maxSec, pace) {
  const clean = punct(s(text));
  const maxWords = Math.max(2, Math.floor(maxSec * WPS * Math.max(0.5, num(pace, 1))));
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return clean;
  const parts = clean.split(/\s*[,;:]\s*/).filter(Boolean);
  const wc = (x) => s(x).split(/\s+/).filter(Boolean).length;
  // Prefijo: las primeras cláusulas que quepan enteras.
  let acc = '';
  for (const p of parts) {
    const next = acc ? acc + ', ' + p : p;
    if (wc(next) > maxWords) break;
    acc = next;
  }
  // Cláusula suelta más sustanciosa que quepa. Ante empate gana la última,
  // que en publicidad suele llevar el remate ("…lo enseña en 10 segundos").
  let best = '';
  for (const p of parts) if (wc(p) <= maxWords && wc(p) >= wc(best)) best = p;
  if (wc(best) > wc(acc)) acc = best;
  if (!acc) acc = words.slice(0, maxWords).join(' ');
  return punct(acc);
}

function voLineFor(sc, c, concept, r) {
  const product = s(c.brief.productName) || 'esto';
  const benefits = arr(concept.benefits);
  const role = s(sc.role);
  const short = num(sc.durationSec, 3) < 1.6;
  if (role === 'hook') return punct(sentence(short ? s(concept.bigIdea).split('.')[0] : s(concept.bigIdea)));
  if (role === 'problem') return punct(sentence(s(obj(concept.storytelling).enemy) || 'Siempre el mismo problema'));
  if (role === 'reveal') return punct(product);
  if (role === 'demo') return punct(sentence(benefits[0] ? benefits[0].benefit : s(concept.keyMessage)));
  if (role === 'detail') return benefits[1] ? punct(sentence(benefits[1].attribute)) : '';
  if (role === 'proof') return punct(sentence(audienceById(c.audienceId).proof));
  if (role === 'money') return punct(sentence(s(concept.keyMessage)));
  if (role === 'cta') return punct(punct(s(c.brand.slogan) || sentence(s(concept.keyMessage))) + ' ' + ctaFor(c));
  return '';
}

function musicStructure(scenes, st) {
  const total = scenes.reduce((a, x) => a + num(x.durationSec, 0), 0);
  const revealAt = (scenes.find((x) => x.role === 'reveal') || { startSec: total * 0.2 }).startSec;
  const moneyAt = (scenes.find((x) => x.role === 'money') || { startSec: total * 0.7 }).startSec;
  return [
    { at: 0, label: 'Intro', note: 'Textura mínima, sin percusión.' },
    { at: round(revealAt, 1), label: 'Build', note: 'Entra el pulso rítmico con la revelación del producto.' },
    { at: round(moneyAt, 1), label: 'Drop / clímax', note: 'Máxima densidad coincidiendo con el money shot.' },
    { at: round(total - 2, 1), label: 'Outro', note: 'Caída a una sola nota sostenida bajo el cierre de marca.' },
  ];
}

function ambienceFor(sc, c) {
  const st = styleById(c.styleId);
  const map = {
    'premium-cinematic': 'deep quiet room tone with a distant low hum',
    'epic-sport': 'gym reverb, distant impacts, heavy breathing',
    'nordic-minimal': 'soft airy room tone, faint outdoor birds',
    'street-energy': 'city night ambience, distant traffic and voices',
    'tech-future': 'clean digital room tone with a subtle electrical hum',
    'gourmet-macro': 'warm kitchen ambience, faint sizzle',
    'editorial-fashion': 'studio silence with faint strobe recycle',
    'warm-lifestyle': 'quiet home ambience, distant street',
    'retro-90s': 'analog tape hiss and CRT whine',
    'luxury-noir': 'near silence, one distant reverberant drip',
  };
  return (map[st.id] || 'neutral room tone') + ' — ' + s(sc.code);
}

function sfxFor(sc, c) {
  const role = s(sc.role);
  const map = {
    hook: 'a single sharp impact with long tail, cinematic riser cut short',
    reveal: 'a smooth mechanical click followed by an airy swell',
    demo: 'detailed foley of the product being used, close and dry',
    money: 'deep sub impact with reverse cymbal leading into it',
  };
  return map[role] || 'subtle transition whoosh';
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 7 · Video Producer
// Convierte prompts en TRABAJOS de producción ejecutables: qué modelo, con
// qué parámetros, cuántas tomas, en qué orden y a qué coste. Un trabajo es la
// unidad que el agente de KIMOS (o el operador) ejecuta y luego liquida con
// REGISTER_ASSET.
// ═══════════════════════════════════════════════════════════════════════════

const JOB_STATUS = ['pending', 'running', 'done', 'failed', 'skipped'];

function buildProduction(c) {
  const prompts = obj(c.prompts);
  const sb = obj(c.storyboard);
  const scenes = arr(sb.scenes);
  const imgProv = getProvider(s(obj(prompts.providers).image));
  const vidProv = getProvider(s(obj(prompts.providers).video));
  const voiceProv = getProvider(s(c.settings.providers.voice));
  const musicProv = getProvider(s(c.settings.providers.music));
  const sfxProv = getProvider(s(c.settings.providers.sfx));
  const audio = obj(c.audio);
  const jobs = [];
  let order = 0;

  // 1) Fotogramas clave (keyframes). Sirven de anclaje visual del vídeo:
  //    generarlos primero es lo que mantiene la consistencia de producto.
  for (const p of arr(prompts.image)) {
    jobs.push(mkJob({
      order: order++, kind: 'image', stage: 'keyframe', sceneId: p.sceneId, code: p.code,
      providerId: p.providerId, provider: imgProv,
      prompt: p.text, negative: p.negative, params: p.params, payload: p.payload,
      qty: { count: 1 },
      label: 'Keyframe ' + p.code + ' · ' + p.role,
      file: 'keyframes/' + p.code + '.png',
      dependsOn: [],
      note: 'Usa las fotos del producto como referencia; valida forma y logotipo antes de animar.',
    }));
  }

  // 2) Tomas de vídeo. Si la escena excede el máximo del modelo, se parte en
  //    varias tomas encadenadas (el último fotograma alimenta la siguiente).
  for (const p of arr(prompts.video)) {
    const maxSec = num(vidProv && vidProv.maxSec, 10) || 10;
    const takes = Math.max(1, Math.ceil(num(p.durationSec, 5) / maxSec));
    for (let t = 0; t < takes; t++) {
      const dur = Math.min(maxSec, round(num(p.durationSec, 5) - t * maxSec, 1));
      jobs.push(mkJob({
        order: order++, kind: 'video', stage: 'shot', sceneId: p.sceneId, code: p.code + (takes > 1 ? '-T' + (t + 1) : ''),
        providerId: p.providerId, provider: vidProv,
        prompt: p.text, negative: p.negative,
        params: Object.assign({}, p.params, takes > 1 ? { continuation: t > 0, take: t + 1, of: takes } : {}),
        qty: { durationSec: dur },
        label: 'Toma ' + p.code + (takes > 1 ? ' (' + (t + 1) + '/' + takes + ')' : '') + ' · ' + p.role,
        // El montaje espera un archivo por escena. Si hubo que partir la
        // escena en varias tomas, el bundle de render las une antes.
        file: takes > 1 ? 'render/' + p.code + '-T' + (t + 1) + '.mp4' : 'render/' + p.code + '.mp4',
        joinInto: takes > 1 ? 'render/' + p.code + '.mp4' : '',
        dependsOn: ['keyframe:' + p.sceneId],
        note: takes > 1 ? 'Encadenada: parte del último fotograma de la toma anterior.' : '',
      }));
    }
  }

  // 3) Locución por escena.
  for (const v of arr(audio.vo)) {
    jobs.push(mkJob({
      order: order++, kind: 'voice', stage: 'audio', sceneId: v.sceneId, code: v.code,
      providerId: v.providerId, provider: voiceProv,
      prompt: v.text, params: v.params, qty: { text: v.text },
      label: 'Locución ' + v.code, file: 'audio/vo-' + v.code + '.wav', dependsOn: [],
      note: v.fits ? '' : 'La línea excede la duración de la escena: acortar texto o alargar plano.',
    }));
  }

  // 4) Música y efectos.
  if (audio.music) {
    jobs.push(mkJob({
      order: order++, kind: 'music', stage: 'audio', sceneId: null, code: 'MUS',
      providerId: s(audio.music.providerId), provider: musicProv,
      prompt: s(audio.music.prompt), params: obj(audio.music.params), qty: { count: 1 },
      label: 'Música · ' + s(audio.music.genre), file: 'audio/music.wav', dependsOn: [],
      note: 'Pedir al menos 2 versiones y elegir la que respete el clímax del money shot.',
    }));
  }
  for (const x of arr(audio.sfx)) {
    jobs.push(mkJob({
      order: order++, kind: 'sfx', stage: 'audio', sceneId: x.sceneId, code: 'SFX-' + x.code,
      providerId: s(x.providerId), provider: sfxProv,
      prompt: s(x.prompt), params: obj(x.params), qty: { count: 1 },
      label: 'Efecto ' + x.code, file: 'audio/sfx-' + slug(x.code) + '.wav', dependsOn: [],
    }));
  }

  const totals = jobs.reduce((acc, j) => {
    acc.cost = round(acc.cost + j.estCostUsd, 4);
    acc.byKind[j.kind] = round((acc.byKind[j.kind] || 0) + j.estCostUsd, 4);
    acc.countByKind[j.kind] = (acc.countByKind[j.kind] || 0) + 1;
    return acc;
  }, { cost: 0, byKind: {}, countByKind: {} });

  return {
    generatedAt: nowIso(),
    jobs,
    totals,
    // Tiempo de máquina estimado (referencia operativa, no compromiso).
    estMinutes: round(jobs.reduce((a, j) => a + (j.kind === 'video' ? 2.5 : j.kind === 'image' ? 0.5 : 0.8), 0), 1),
    order: ['keyframe', 'shot', 'audio'],
    guidance: [
      'Genera primero TODOS los keyframes y valida el producto antes de gastar en vídeo.',
      'Bloquea la semilla del modelo de imagen para mantener la coherencia entre planos.',
      'Si un plano falla dos veces, cambia el encuadre antes que el prompt.',
      'Registra cada resultado con REGISTER_ASSET para que el coste real sustituya al estimado.',
    ],
  };
}

function mkJob(d) {
  const p = d.provider || null;
  const qty = billableQty(p, obj(d.qty));
  // El id incluye la ESCENA, no solo tipo+código. Los códigos (SC01…) se
  // reutilizan al regenerar el storyboard con otra duración o formato: sin la
  // escena, un asset de la configuración anterior cerraría un trabajo que en
  // realidad es otro plano distinto.
  const idParts = ['job', slug(s(d.kind)),
    s(d.sceneId) ? slug(s(d.sceneId)) : '', slug(s(d.code) || String(d.order))].filter(Boolean);
  return {
    id: idParts.join('-'),
    order: num(d.order, 0), kind: s(d.kind), stage: s(d.stage),
    sceneId: d.sceneId || null, code: s(d.code), label: s(d.label),
    providerId: s(d.providerId), providerLabel: p ? p.label : s(d.providerId),
    prompt: s(d.prompt), negative: s(d.negative), params: obj(d.params), payload: d.payload || null,
    // `file` es la ruta que el montaje espera encontrar: es lo que enlaza un
    // asset registrado con el script de render.
    file: s(d.file), joinInto: s(d.joinInto),
    qty: obj(d.qty), billableQty: round(qty, 4),
    costUnit: p && p.cost ? p.cost.unit : 'call',
    estCostUsd: round(estimateCost(s(d.providerId), qty), 4),
    dependsOn: arr(d.dependsOn), note: s(d.note),
    status: 'pending', assetId: null, attempts: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 8 · Video Editor
// Timeline (EDL), subtítulos SRT y script FFmpeg reproducible: cortes, color,
// fundidos, transiciones, textos, logotipo, CTA, mezcla de audio y export a
// todos los formatos y resoluciones pedidos.
// ═══════════════════════════════════════════════════════════════════════════

/** ¿El montaje usa xfade encadenado o concatenación pura? */
function usesXfade(scenes) {
  const list = arr(scenes);
  return list.length >= 2 && list.some((sc, i) => i > 0 && sc.transitionIn && sc.transitionIn !== 'cut');
}
/** Segundos que cada transición consume solapando los dos planos. */
function overlapOf(sc) {
  const tr = byId(TRANSITIONS, sc.transitionIn, TRANSITIONS[0]);
  return tr.ff ? num(tr.dur, 0) : 0.02;   // el corte se hace con un xfade mínimo
}
/**
 * Tiempos REALES en el máster montado.
 *
 * xfade SOLAPA los clips: la duración final es la suma de los planos menos la
 * de las transiciones. Calcular la locución, los rótulos y los subtítulos sobre
 * la suma nominal los desincroniza, y el desfase se acumula plano a plano
 * (con 3 transiciones de medio segundo, más de un segundo al final). Estos son
 * los tiempos contra los que se monta todo lo que va sobre la imagen.
 */
function masterTimes(scenes) {
  const list = arr(scenes);
  const xf = usesXfade(list);
  const starts = [];
  let len = 0;
  list.forEach((sc, i) => {
    if (i === 0) { starts.push(0); len = num(sc.durationSec, 0); return; }
    const d = xf ? overlapOf(sc) : 0;
    starts.push(round(len - d, 3));       // el plano entra aquí, con el solape
    len = round(len - d + num(sc.durationSec, 0), 3);
  });
  return { starts, total: round(len, 3), xfade: xf };
}

function buildEdit(c) {
  const sb = obj(c.storyboard);
  const scenes = arr(sb.scenes);
  const audio = obj(c.audio);
  const st = styleById(c.styleId);
  const fps = clamp(num(c.settings.fps, 25), 12, 60);
  const times = masterTimes(scenes);
  const total = times.total;
  const startOf = (sceneId) => {
    const i = scenes.findIndex((x) => x.id === sceneId);
    return i >= 0 ? times.starts[i] : 0;
  };

  // ── Timeline multipista (en tiempos del máster, no del storyboard) ─────
  const video = scenes.map((sc, i) => ({
    idx: i, sceneId: sc.id, code: sc.code, role: sc.role,
    startSec: times.starts[i], endSec: round(times.starts[i] + sc.durationSec, 2), durationSec: sc.durationSec,
    frames: Math.round(sc.durationSec * fps),
    source: 'render/' + sc.code + '.mp4', speed: num(sc.speed, 1),
    transitionIn: sc.transitionIn, grade: sc.grade,
  }));
  const titles = scenes.filter((sc) => s(sc.onScreenText).trim()).map((sc) => {
    const st0 = startOf(sc.id);
    return {
      sceneId: sc.id, code: sc.code, text: s(sc.onScreenText),
      startSec: round(st0 + 0.25, 2), endSec: round(st0 + sc.durationSec - 0.15, 2),
      position: sc.role === 'cta' ? 'center' : 'lower-third',
      style: sc.role === 'cta' ? 'display' : 'body',
    };
  });
  const voice = arr(audio.vo).map((v) => ({
    sceneId: v.sceneId, code: v.code, startSec: startOf(v.sceneId), durationSec: v.estimatedSec,
    source: 'audio/vo-' + v.code + '.wav', text: v.text, gainDb: -6,
  }));
  const musicTrack = { source: 'audio/music.wav', startSec: 0, durationSec: total, gainDb: -18,
    ducking: { enabled: true, thresholdDb: -30, ratio: 6, attackMs: 60, releaseMs: 300 } };
  const sfxTrack = arr(audio.sfx).map((x) => ({ sceneId: x.sceneId, code: x.code, startSec: startOf(x.sceneId),
    source: 'audio/sfx-' + slug(x.code) + '.wav', gainDb: -12 }));

  // ── Entregables ────────────────────────────────────────────────────────
  const exports = [];
  for (const a of arr(c.settings.targets.aspects)) {
    for (const rId of arr(c.settings.targets.resolutions)) {
      const d = dimsFor(a, rId);
      // La duración del entregable es la del MÁSTER de ese formato, ya con las
      // transiciones descontadas: es lo que va a medir quien reciba el archivo.
      const fmtScenes = scenesOfFormat(sb, a);
      const fmtTotal = arr(fmtScenes).length ? masterTimes(fmtScenes).total : total;
      exports.push({
        id: 'exp-' + slug(a) + '-' + rId, aspect: a, resolution: rId,
        width: d.w, height: d.h, fps,
        durationSec: fmtTotal,
        filename: slug(c.title) + '-' + slug(a) + '-' + rId + '.mp4',
        bitrateMbps: rId === '4k' ? 45 : rId === '2k' ? 22 : 12,
        codec: 'h264', profile: 'high', pixFmt: 'yuv420p',
        platforms: PLATFORMS.filter((p) => arr(c.settings.targets.platforms).indexOf(p.id) >= 0
          && arr(p.aspects).indexOf(a) >= 0).map((p) => p.label),
      });
    }
  }

  return {
    generatedAt: nowIso(),
    fps, totalSec: total,
    timeline: { video, titles, voice, music: musicTrack, sfx: sfxTrack },
    exports,
    // Subtítulos y script se construyen sobre las pistas YA remapeadas al
    // tiempo del máster; nunca sobre los tiempos del storyboard.
    srt: buildSrt(titles, voice),
    ffmpeg: buildFfmpegScript(c, { scenes, exports, fps, total, titles, voice, sfx: sfxTrack }),
    edl: buildEdl(c, video, fps),
    checklist: [
      'Comprobar que el producto no cambia de forma entre planos consecutivos.',
      'Verificar legibilidad del texto en la zona segura de cada formato vertical.',
      'Escuchar la mezcla en móvil y con el sonido apagado (subtítulos obligatorios).',
      'Revisar que el logotipo respete su área de reserva (' + num(c.brand.logoSafeArea, 12) + ' %).',
    ],
  };
}

/**
 * Subtítulos SRT. Recibe pistas ya expresadas en tiempo del máster: la
 * locución si la hay, y si no los rótulos.
 */
function buildSrt(titles, voice) {
  const lines = arr(voice).length
    ? arr(voice).map((v) => ({ start: num(v.startSec, 0), end: num(v.startSec, 0) + Math.max(1, num(v.durationSec, 1)), text: s(v.text) }))
    : arr(titles).map((x) => ({ start: num(x.startSec, 0), end: num(x.endSec, 0), text: s(x.text) }));
  return lines.filter((l) => s(l.text).trim())
    .map((l, i) => (i + 1) + '\n' + fmtTc(l.start) + ' --> ' + fmtTc(l.end) + '\n' + l.text + '\n').join('\n');
}

/** EDL en formato CMX3600 simplificado, importable en NLE. */
function buildEdl(c, video, fps) {
  const tc = (sec) => {
    const f = Math.round(sec * fps);
    const hh = Math.floor(f / (3600 * fps));
    const mm = Math.floor((f % (3600 * fps)) / (60 * fps));
    const ss = Math.floor((f % (60 * fps)) / fps);
    const ff = f % fps;
    const p = (x) => (x < 10 ? '0' : '') + x;
    return p(hh) + ':' + p(mm) + ':' + p(ss) + ':' + p(ff);
  };
  const head = 'TITLE: ' + s(c.title).toUpperCase() + '\nFCM: NON-DROP FRAME\n\n';
  const body = arr(video).map((v, i) => {
    const n = String(i + 1).padStart(3, '0');
    const trans = v.transitionIn === 'cut' || !v.transitionIn ? 'C' : 'D';
    return n + '  ' + s(v.code).padEnd(8) + ' V     ' + trans + '        '
      + tc(0) + ' ' + tc(v.durationSec) + ' ' + tc(v.startSec) + ' ' + tc(v.endSec)
      + '\n* FROM CLIP NAME: ' + v.source + '\n';
  }).join('\n');
  return head + body;
}

/**
 * Script FFmpeg completo y reproducible. Genera un .sh que, dados los clips
 * renderizados en `render/` y el audio en `audio/`, produce TODOS los
 * entregables con color, transiciones, títulos, logo, CTA y mezcla.
 */
function buildFfmpegScript(c, ctx) {
  const x = obj(ctx);
  const scenes = arr(x.scenes);
  const exportsList = arr(x.exports);
  const fps = num(x.fps, 25);
  const st = styleById(c.styleId);
  const pal = obj(c.brand.palette);
  const primary = isHex(pal.primary) ? pal.primary : '#000000';
  const light = isHex(pal.light) ? pal.light : '#FFFFFF';
  const accent = isHex(pal.secondary) ? pal.secondary : '#19ACB1';
  const useSubs = c.settings.subtitles !== false;
  const logo = s(c.brand.logoUrl);
  const L = [];

  L.push('#!/usr/bin/env bash');
  L.push('# ' + s(c.title) + ' — script de montaje generado por Kreative Studio ' + KS_VERSION);
  L.push('# Estilo: ' + st.name + ' · ' + scenes.length + ' escenas · ' + fmtSec(x.total)
    + ' (suma de planos ' + fmtSec(scenes.reduce((a, sc) => a + num(sc.durationSec, 0), 0))
    + ' menos el solape de las transiciones)');
  L.push('#');
  L.push('# Entradas esperadas:');
  L.push('#   render/SCxx.mp4  — una toma por escena (mismo fps y resolución de trabajo)');
  L.push('#   audio/vo-SCxx.wav, audio/music.wav, audio/sfx-*.wav');
  L.push('#   brand/logo.png   — logotipo con transparencia (opcional)');
  L.push('#   fonts/display.ttf, fonts/body.ttf — tipografías de marca');
  if (useSubs) L.push('#   subs.srt         — subtítulos (descárgalos desde el Editor y guárdalos así)');
  L.push('# Salida: out/*.mp4 en todos los formatos y resoluciones declarados.');
  L.push('set -euo pipefail');
  L.push('');
  L.push('FPS=' + fps);
  L.push('WORK=work');
  L.push('OUT=out');
  L.push('mkdir -p "$WORK" "$OUT"');
  L.push('');
  L.push('# ── 1. Normalizar cada toma: duración exacta, fps, color y velocidad ──');
  for (const sc of scenes) {
    const speed = num(sc.speed, 1);
    const filters = [
      'fps=' + fps,
      speed !== 1 ? 'setpts=' + round(1 / Math.max(0.05, speed), 4) + '*PTS' : '',
      gradeFilter(sc.grade),
      'trim=duration=' + sc.durationSec,
      'setpts=PTS-STARTPTS',
      'format=yuv420p',
    ].filter(Boolean).join(',');
    L.push('ffmpeg -y -i render/' + sc.code + '.mp4 -an \\');
    L.push('  -vf ' + shq(filters) + ' \\');
    L.push('  -c:v libx264 -crf 16 -preset slow "$WORK/' + sc.code + '.mp4"');
  }
  L.push('');
  L.push('# ── 2. Concatenar con transiciones ────────────────────────────────────');
  const hasTransitions = scenes.some((sc, i) => i > 0 && sc.transitionIn && sc.transitionIn !== 'cut');
  if (!hasTransitions || scenes.length < 2) {
    L.push('printf "%s\\n" \\');
    for (const sc of scenes) L.push('  "file \'' + sc.code + '.mp4\'" \\');
    L.push('  > "$WORK/concat.txt"');
    L.push('ffmpeg -y -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$WORK/edit.mp4"');
  } else {
    // xfade encadenado: cada transición consume `dur` segundos del corte.
    const inputs = scenes.map((sc) => '-i "$WORK/' + sc.code + '.mp4"').join(' ');
    const parts = [];
    let prev = '[0:v]';
    let offset = num(scenes[0].durationSec, 0);
    for (let i = 1; i < scenes.length; i++) {
      const tr = byId(TRANSITIONS, scenes[i].transitionIn, TRANSITIONS[0]);
      const dur = tr.ff ? tr.dur : 0;
      const outLbl = i === scenes.length - 1 ? '[vout]' : '[v' + i + ']';
      if (tr.ff) {
        parts.push(prev + '[' + i + ':v]xfade=transition=' + tr.ff + ':duration=' + dur + ':offset=' + round(offset - dur, 2) + outLbl);
        offset = round(offset - dur + num(scenes[i].durationSec, 0), 2);
      } else {
        parts.push(prev + '[' + i + ':v]xfade=transition=fade:duration=0.02:offset=' + round(offset - 0.02, 2) + outLbl);
        offset = round(offset + num(scenes[i].durationSec, 0) - 0.02, 2);
      }
      prev = outLbl;
    }
    L.push('ffmpeg -y ' + inputs + ' \\');
    L.push('  -filter_complex ' + shq(parts.join(';')) + ' \\');
    L.push('  -map "[vout]" -c:v libx264 -crf 16 -preset slow "$WORK/edit.mp4"');
  }
  L.push('');
  L.push('# ── 3. Mezcla de audio (locución + música con ducking + efectos) ──────');
  // Pistas en tiempo del máster (ya descontadas las transiciones).
  const voTrack = arr(x.voice);
  const sfxTrackFF = arr(x.sfx);
  const voFiles = voTrack.map((v) => 'audio/vo-' + v.code + '.wav');
  const sfxFiles = sfxTrackFF.map((v) => 'audio/sfx-' + slug(v.code) + '.wav');
  L.push('# Ajusta los delays si mueves escenas en el timeline.');
  const aInputs = ['-i audio/music.wav'].concat(voFiles.map((f) => '-i ' + f)).concat(sfxFiles.map((f) => '-i ' + f));
  const aParts = [];
  aParts.push('[0:a]volume=-18dB,aformat=sample_fmts=fltp:sample_rates=48000[music]');
  voTrack.forEach((v, i) => {
    const ms = Math.round(num(v.startSec, 0) * 1000);
    aParts.push('[' + (i + 1) + ':a]adelay=' + ms + '|' + ms + ',volume=-6dB[vo' + i + ']');
  });
  sfxTrackFF.forEach((v, i) => {
    const idx = 1 + voFiles.length + i;
    const ms = Math.round(num(v.startSec, 0) * 1000);
    aParts.push('[' + idx + ':a]adelay=' + ms + '|' + ms + ',volume=-12dB[sfx' + i + ']');
  });
  const voLbls = voFiles.map((_, i) => '[vo' + i + ']').join('');
  const sfxLbls = sfxFiles.map((_, i) => '[sfx' + i + ']').join('');
  if (voFiles.length) {
    aParts.push(voLbls + 'amix=inputs=' + voFiles.length + ':normalize=0[voall]');
    // La locución se usa DOS veces (como cadena lateral del compresor y en la
    // mezcla final). Un pad de salida solo se puede consumir una vez, así que
    // hay que duplicarlo con asplit o el filtergraph no arranca.
    aParts.push('[voall]asplit=2[vokey][vomix]');
    aParts.push('[music][vokey]sidechaincompress=threshold=0.03:ratio=6:attack=60:release=300[ducked]');
    aParts.push('[ducked][vomix]' + sfxLbls + 'amix=inputs=' + (2 + sfxFiles.length) + ':normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
  } else {
    aParts.push('[music]' + sfxLbls + 'amix=inputs=' + (1 + sfxFiles.length) + ':normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
  }
  L.push('ffmpeg -y ' + aInputs.join(' ') + ' \\');
  L.push('  -filter_complex ' + shq(aParts.join(';')) + ' \\');
  L.push('  -map "[aout]" -c:a pcm_s16le "$WORK/mix.wav"');
  L.push('');
  L.push('# ── 4. Títulos, logotipo y cierre de marca ────────────────────────────');
  const titleFilters = [];
  for (const ti of arr(x.titles)) {
    const txt = s(ti.text).trim();
    if (!txt) continue;
    const isCta = ti.style === 'display';
    const font = isCta ? 'fonts/display.ttf' : 'fonts/body.ttf';
    const size = isCta ? 'h/12' : 'h/22';
    const yPos = isCta ? '(h-text_h)/2' : 'h-(h*0.18)';
    const from = round(num(ti.startSec, 0), 2);
    const to = round(num(ti.endSec, 0), 2);
    titleFilters.push('drawtext=fontfile=' + font + ':text=' + "'" + ffq(txt) + "'"
      + ':fontcolor=' + light + ':fontsize=' + size + ':x=(w-text_w)/2:y=' + yPos
      + ':box=1:boxcolor=' + primary + '@0.35:boxborderw=18'
      + ":enable='between(t," + from + ',' + to + ")'");
  }
  if (logo) titleFilters.push('[logo]overlay=W-w-(W*0.05):H-h-(H*0.05)');
  L.push('# El logotipo se superpone en la esquina con el área de reserva del manual de marca.');
  L.push('ffmpeg -y -i "$WORK/edit.mp4" -i "$WORK/mix.wav"' + (logo ? ' -i brand/logo.png' : '') + ' \\');
  const vf = titleFilters.filter((f) => f.indexOf('[logo]') < 0).join(',');
  if (logo) {
    L.push('  -filter_complex ' + shq('[2:v]scale=iw*0.12:-1[logo];[0:v]' + (vf || 'null') + '[txt];[txt][logo]overlay=W-w-(W*0.05):H-h-(H*0.05)[vout]') + ' \\');
    L.push('  -map "[vout]" -map 1:a \\');
  } else {
    L.push('  -vf ' + shq(vf || 'null') + ' -map 0:v -map 1:a \\');
  }
  L.push('  -c:v libx264 -crf 16 -preset slow -c:a aac -b:a 320k "$WORK/master.mp4"');
  L.push('');
  if (useSubs) {
    L.push('# ── 5. Subtítulos quemados (imprescindibles: la mayoría ve sin sonido) ──');
    L.push('ffmpeg -y -i "$WORK/master.mp4" \\');
    L.push('  -vf ' + shq('subtitles=subs.srt:force_style=' + "'" + 'FontName=Inter,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Alignment=2,MarginV=60' + "'") + ' \\');
    L.push('  -c:v libx264 -crf 16 -preset slow -c:a copy "$WORK/master-subs.mp4"');
    L.push('MASTER="$WORK/master-subs.mp4"');
  } else {
    L.push('MASTER="$WORK/master.mp4"');
  }
  L.push('');
  L.push('# ── 6. Entregables por formato y resolución ───────────────────────────');
  L.push('# Reencuadre inteligente: escala para cubrir y recorta al centro, que es');
  L.push('# donde el storyboard mantiene el producto en todos los aspectos.');
  for (const e of exportsList) {
    L.push('ffmpeg -y -i "$MASTER" \\');
    L.push('  -vf ' + shq('scale=' + e.width + ':' + e.height + ':force_original_aspect_ratio=increase,crop=' + e.width + ':' + e.height + ',setsar=1') + ' \\');
    L.push('  -c:v libx264 -crf 18 -preset slow -maxrate ' + e.bitrateMbps + 'M -bufsize ' + (e.bitrateMbps * 2) + 'M \\');
    L.push('  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k \\');
    L.push('  "$OUT/' + e.filename + '"   # ' + e.aspect + ' ' + e.resolution + (e.platforms.length ? ' → ' + e.platforms.join(', ') : ''));
  }
  L.push('');
  L.push('echo "Listo: $(ls -1 "$OUT" | wc -l) entregables en $OUT/"');
  return L.join('\n');
}

/** Traducción del color grading a filtros reales de FFmpeg. */
function gradeFilter(gradeId) {
  const map = {
    'teal-orange': 'eq=contrast=1.12:saturation=1.10,colorbalance=rs=0.05:bs=-0.05:gh=0.02',
    bleach: 'eq=contrast=1.30:saturation=0.55:gamma=0.95',
    kodak: 'eq=contrast=1.06:saturation=1.08:gamma_r=1.03:gamma_b=0.98,curves=preset=lighter',
    mono: 'hue=s=0,eq=contrast=1.25',
    pastel: 'eq=contrast=0.92:saturation=0.85:brightness=0.04',
    noir: 'eq=contrast=1.35:saturation=0.75:brightness=-0.04',
    clean: 'eq=contrast=1.04:saturation=1.05',
    cyberpunk: 'colorbalance=rs=-0.08:bs=0.12:gm=0.04,eq=contrast=1.15:saturation=1.20',
    earth: 'colorbalance=rs=0.04:gm=0.03:bs=-0.04,eq=saturation=0.95',
  };
  return map[s(gradeId)] || 'eq=contrast=1.05';
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 10 · Copywriter
// Copy para todos los canales, landing y secuencia de email. Cada pieza
// respeta los límites reales de caracteres de su plataforma.
// ═══════════════════════════════════════════════════════════════════════════

const HOOK_PATTERNS = [
  { id: 'question', label: 'Pregunta directa', make: (ctx) => '¿' + sentence(ctx.enemy).replace(/^¿|\?$/g, '') + '?' },
  { id: 'contrast', label: 'Contraste', make: (ctx) => 'No es ' + ctx.category.toLowerCase() + '. Es ' + ctx.driver + '.' },
  { id: 'number', label: 'Cifra', make: (ctx) => ctx.duration + ' segundos para entender por qué ' + ctx.product + ' es distinto.' },
  { id: 'command', label: 'Imperativo', make: (ctx) => 'Deja de conformarte con lo de siempre.' },
  { id: 'secret', label: 'Revelación', make: (ctx) => 'El detalle que cambia todo está donde nadie mira.' },
  { id: 'social', label: 'Prueba social', make: (ctx) => 'Lo que dicen quienes ya lo usan a diario.' },
  { id: 'objection', label: 'Objeción frontal', make: (ctx) => 'Sí, cuesta más. Y aquí está el porqué.' },
  { id: 'story', label: 'Micro relato', make: (ctx) => 'Probé todo antes de encontrar esto.' },
  { id: 'benefit', label: 'Beneficio puro', make: (ctx) => sentence(ctx.benefit) + '.' },
  { id: 'urgency', label: 'Urgencia', make: (ctx) => 'Disponible ahora. No por mucho tiempo.' },
];

const CTA_BY_OBJECTIVE = {
  awareness: ['Descúbrelo', 'Míralo en acción', 'Conoce la historia'],
  consideration: ['Ver cómo funciona', 'Compara tú mismo', 'Ver detalles'],
  conversion: ['Comprar ahora', 'Lo quiero', 'Añadir al carrito'],
  launch: ['Ya disponible', 'Consíguelo primero', 'Reservar el mío'],
  remarketing: ['Terminar mi compra', 'Volver al carrito', 'Aprovechar antes de que acabe'],
};

/** Recorta respetando palabras y sin dejar puntuación colgando. */
function fit(text, max) {
  const t = s(text).trim();
  if (!max || t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-—]+$/, '');
}

function buildCopy(c) {
  const concept = obj(c.concept);
  const research = obj(c.research);
  const st = styleById(c.styleId);
  const cat = categoryById(c.categoryId);
  const aud = audienceById(c.audienceId);
  const obj0 = objectiveById(c.objectiveId);
  const product = s(c.brief.productName) || 'el producto';
  const r = rng(seedOf(c) ^ 0x3d90);
  const benefits = arr(concept.benefits);
  const ctx = {
    product, enemy: s(obj(concept.storytelling).enemy) || cat.objections[0],
    category: cat.label, driver: aud.driver,
    duration: num(c.settings.shortDurationSec, 15),
    benefit: benefits[0] ? benefits[0].benefit : s(concept.keyMessage),
  };

  const hooks = HOOK_PATTERNS.map((hp) => ({ id: hp.id, label: hp.label, text: sentence(hp.make(ctx)) }));
  const ctas = (CTA_BY_OBJECTIVE[obj0.id] || CTA_BY_OBJECTIVE.awareness).slice();

  // ── Anuncios por plataforma ────────────────────────────────────────────
  const targets = arr(c.settings.targets.platforms).length
    ? arr(c.settings.targets.platforms) : arr(research.channels).map((x) => x.id);
  const ads = [];
  for (const pid of uniq(targets)) {
    const p = PLATFORMS.find((x) => x.id === pid);
    if (!p) continue;
    const nVariants = clamp(num(c.settings.variantCount, 3), 1, 6);
    for (let v = 0; v < nVariants; v++) {
      const hook = hooks[(v + hash32(pid)) % hooks.length];
      const benefit = benefits.length ? benefits[v % benefits.length] : null;
      const cta = ctas[v % ctas.length];
      const primary = buildPrimary(p, hook, benefit, concept, aud, cta, c);
      ads.push({
        id: 'ad-' + slug(pid) + '-' + (v + 1),
        platform: p.id, platformLabel: p.label, variant: String.fromCharCode(65 + v),
        hookPattern: hook.id, hookLabel: hook.label,
        primary: fit(primary, p.copy.primary || 0),
        headline: fit(headlineFor(hook, benefit, concept, v), p.copy.headline || 40),
        description: p.copy.desc ? fit(descriptionFor(benefit, concept, aud), p.copy.desc) : '',
        cta,
        limits: p.copy,
        overLimit: false,
        notes: 'Gancho visible antes del segundo ' + p.hookSec + '. Tono: ' + st.tone + '.',
      });
    }
  }
  for (const a of ads) {
    a.overLimit = (a.limits.primary && a.primary.length > a.limits.primary)
      || (a.limits.headline && a.headline.length > a.limits.headline);
  }

  // ── Landing ────────────────────────────────────────────────────────────
  const landing = {
    hero: {
      eyebrow: cat.label + ' · ' + aud.label,
      headline: fit(sentence(s(concept.bigIdea)), 70),
      subheadline: fit(sentence(s(concept.keyMessage)), 140),
      cta: ctas[0], ctaSecondary: 'Ver el vídeo',
      note: 'Vídeo hero 16:9 en autoplay silenciado con subtítulos quemados.',
    },
    valueProps: benefits.slice(0, 3).map((b) => ({
      title: fit(sentence(b.attribute), 40),
      body: fit(sentence(b.benefit) + '. ' + sentence(b.proof) + '.', 160),
    })),
    proof: {
      title: 'Por qué confiar',
      items: [aud.proof, cat.triggers[0], cat.triggers[1]].filter(Boolean).map(sentence),
    },
    objections: cat.objections.map((o, i) => ({
      question: o,
      answer: sentence(objectionAnswer(o, c, benefits[i % Math.max(1, benefits.length)])),
    })),
    specs: benefits.map((b) => ({ label: fit(sentence(b.attribute), 32), value: fit(sentence(b.benefit), 90) })),
    finalCta: {
      headline: fit(sentence(s(c.brand.slogan) || s(concept.keyMessage)), 60),
      body: 'Sin letra pequeña. ' + (obj0.id === 'conversion' ? 'Envío y devolución sencillos.' : 'Descúbrelo hoy.'),
      cta: ctas[0],
    },
    seo: {
      title: fit(product + ' — ' + sentence(s(concept.keyMessage)), 60),
      description: fit(sentence(s(concept.bigIdea)) + ' ' + sentence(s(concept.keyMessage)), 155),
      keywords: uniq([slug(product), slug(cat.label), slug(aud.label)].concat(cat.keywords.slice(0, 6))),
    },
  };

  // ── Secuencia de email ─────────────────────────────────────────────────
  const emails = [
    { day: 0, stage: 'Bienvenida', subject: fit(sentence(s(concept.bigIdea)), 55),
      preheader: fit(sentence(s(concept.keyMessage)), 90),
      body: emailBody('welcome', c, concept, benefits, aud), cta: ctas[0] },
    { day: 2, stage: 'Educación', subject: fit('Cómo funciona ' + product + ' de verdad', 55),
      preheader: fit(benefits[0] ? sentence(benefits[0].benefit) : '', 90),
      body: emailBody('education', c, concept, benefits, aud), cta: ctas[1] || ctas[0] },
    { day: 5, stage: 'Prueba social', subject: fit('Lo que dicen quienes ya lo usan', 55),
      preheader: fit(sentence(aud.proof), 90),
      body: emailBody('proof', c, concept, benefits, aud), cta: ctas[0] },
    { day: 8, stage: 'Objeción', subject: fit(cat.objections[0], 55),
      preheader: 'La respuesta honesta, sin rodeos.',
      body: emailBody('objection', c, concept, benefits, aud), cta: ctas[0] },
    { day: 12, stage: 'Cierre', subject: fit((obj0.id === 'remarketing' ? 'Tu carrito sigue esperando' : 'Última llamada'), 55),
      preheader: 'Se acaba el plazo de esta campaña.',
      body: emailBody('close', c, concept, benefits, aud), cta: ctas[ctas.length - 1] },
  ];

  return {
    generatedAt: nowIso(),
    tone: st.tone, language: s(c.brief.language) || 'es',
    hooks, ctas, ads, landing, emails,
    scripts: {
      hero: arr(obj(c.audio).vo).map((v) => v.code + ': ' + v.text).join('\n'),
      elevator: sentence(s(concept.bigIdea)) + ' ' + sentence(s(concept.keyMessage)) + ' ' + ctas[0] + '.',
    },
    counts: { ads: ads.length, emails: emails.length, hooks: hooks.length },
  };
}

/**
 * Monta el texto principal AÑADIENDO bloques mientras quepan, en vez de
 * concatenar y recortar: truncar deja frases a medias ("…deje de ser un") y
 * eso es exactamente lo que no puede salir publicado.
 */
function buildPrimary(p, hook, benefit, concept, aud, cta, c) {
  const limit = num(p.copy.primary, 0);
  const ctaLine = '👉 ' + cta;
  const candidates = [punct(hook.text)];
  if (benefit) candidates.push(punct(sentence(benefit.benefit)));
  if (benefit && benefit.proof) candidates.push(punct(sentence(benefit.proof)));
  if (s(concept.keyMessage).trim()) candidates.push(punct(sentence(s(concept.keyMessage))));
  const reserve = ctaLine.length + 2;          // el CTA siempre entra
  const out = [];
  let len = 0;
  for (const line of candidates.filter(Boolean)) {
    const add = (out.length ? 2 : 0) + line.length;
    if (limit && len + add + reserve > limit) continue;
    out.push(line);
    len += add;
  }
  // Si ni la primera frase cabe, se recorta esa sola por palabra completa.
  if (!out.length) out.push(punct(fit(candidates[0], Math.max(12, limit - reserve))));
  out.push(ctaLine);
  return out.join('\n\n');
}

function headlineFor(hook, benefit, concept, v) {
  if (v === 0) return sentence(s(concept.keyMessage));
  if (benefit) return sentence(benefit.attribute);
  return sentence(s(concept.bigIdea));
}
function descriptionFor(benefit, concept, aud) {
  return sentence(benefit ? benefit.proof : aud.proof);
}
function objectionAnswer(question, c, benefit) {
  const product = s(c.brief.productName) || 'El producto';
  const q = norm(question);
  if (q.indexOf('talla') >= 0 || q.indexOf('quedar') >= 0) return 'Guía de tallas con medidas reales y cambio gratuito en la primera compra.';
  if (q.indexOf('calidad') >= 0 || q.indexOf('aguanta') >= 0 || q.indexOf('dura') >= 0) return product + ' está probado en uso intensivo; el detalle del material se ve en el vídeo, sin retoques.';
  if (q.indexOf('devol') >= 0 || q.indexOf('tarda') >= 0) return 'Envío con seguimiento y devolución sin preguntas dentro del plazo legal.';
  if (q.indexOf('precio') >= 0 || q.indexOf('justifica') >= 0 || q.indexOf('cuesta') >= 0) return 'Cuesta lo que cuesta hacerlo bien: ' + (benefit ? benefit.attribute.toLowerCase() : 'materiales y proceso') + '. El coste por uso es menor que el de la alternativa barata.';
  if (q.indexOf('segur') >= 0 || q.indexOf('certific') >= 0) return 'Certificaciones visibles en la ficha de producto y ensayos disponibles bajo petición.';
  if (q.indexOf('compatib') >= 0 || q.indexOf('integra') >= 0) return 'Compatibilidad detallada en la ficha, con la lista completa de casos soportados.';
  return benefit ? sentence(benefit.benefit) + '. ' + sentence(benefit.proof) + '.' : 'Respuesta directa, con datos verificables en la ficha de producto.';
}
function emailBody(kind, c, concept, benefits, aud) {
  const product = s(c.brief.productName) || 'el producto';
  const b0 = benefits[0]; const b1 = benefits[1];
  if (kind === 'welcome') return ['Hola,', '', sentence(s(concept.bigIdea)), '',
    b0 ? sentence(b0.benefit) + '.' : '', 'En menos de un minuto vas a entender por qué ' + product + ' no se parece a lo que ya has probado.'].filter(Boolean).join('\n');
  if (kind === 'education') return ['Sin humo: esto es lo que hace ' + product + '.', '',
    benefits.slice(0, 3).map((b, i) => (i + 1) + '. ' + sentence(b.attribute) + ' → ' + sentence(b.benefit) + '.').join('\n'), '',
    'Todo lo anterior se ve en el vídeo, en una sola toma.'].join('\n');
  if (kind === 'proof') return ['No hace falta que nos creas.', '', sentence(aud.proof) + '.', '',
    b1 ? sentence(b1.proof) + '.' : '', 'Mira las opiniones y decide tú.'].filter(Boolean).join('\n');
  if (kind === 'objection') return ['Vamos a la duda que todos tienen.', '',
    sentence(objectionAnswer(categoryById(c.categoryId).objections[0], c, b0)), '',
    'Si sigue sin encajarte, responde a este correo y te lo decimos claro.'].join('\n');
  return ['Esta campaña se cierra pronto.', '', sentence(s(concept.keyMessage)) + '.', '',
    b0 ? sentence(b0.benefit) + '.' : '', 'Después vuelve a las condiciones de siempre.'].filter(Boolean).join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 9 · Brand Consistency
// Auditoría automática: paleta, tipografía, logotipo, producto, personajes,
// tono y legibilidad. Devuelve hallazgos accionables, no un aprobado vago.
// ═══════════════════════════════════════════════════════════════════════════

const SEVERITY = { error: 3, warn: 2, info: 1 };

function buildBrandCheck(c) {
  const st = styleById(c.styleId);
  const findings = [];
  const add = (severity, area, text, fix) => findings.push({ severity, area, text: s(text), fix: s(fix) });
  const pal = obj(c.brand.palette);
  const scenes = arr(obj(c.storyboard).scenes);

  // Paleta
  for (const k of ['primary', 'secondary', 'accent', 'dark', 'light']) {
    if (!isHex(pal[k])) add('error', 'Paleta', 'El color «' + k + '» no es un hex válido (' + s(pal[k]) + ').', 'Define un valor #RRGGBB en Marca.');
  }
  const cr = contrastRatio(pal.light, pal.primary);
  if (cr != null && cr < 4.5) add('warn', 'Paleta', 'Contraste texto/fondo de ' + cr + ':1, por debajo de 4,5:1 (WCAG AA).',
    'Aclara el color de texto o oscurece el fondo de los rótulos.');
  const styleHexes = Object.keys(st.palette).map((k) => norm(st.palette[k]));
  const brandHexes = ['primary', 'secondary', 'accent'].map((k) => norm(pal[k]));
  if (!brandHexes.some((hx) => styleHexes.indexOf(hx) >= 0)) {
    add('info', 'Paleta', 'La paleta de marca no comparte ningún color con el estilo «' + st.name + '».',
      'Es válido, pero revisa que los prompts no pidan colores que luego contradicen la marca.');
  }

  // Tipografía
  if (!s(c.brand.typography.display).trim()) add('warn', 'Tipografía', 'No hay tipografía de titulares definida.',
    'Sugerencia del estilo: ' + st.typography.display);
  if (!s(c.brand.typography.body).trim()) add('info', 'Tipografía', 'No hay tipografía de texto definida.',
    'Sugerencia del estilo: ' + st.typography.body);

  // Logotipo
  if (!s(c.brand.logoUrl).trim()) add('warn', 'Logotipo', 'No hay logotipo cargado: el script de montaje omitirá la sobreimpresión.',
    'Sube un PNG con transparencia en Marca.');
  if (num(c.brand.logoSafeArea, 0) < 8) add('info', 'Logotipo', 'El área de reserva es menor del 8 %.',
    'En vertical, el logo puede quedar bajo la interfaz de la plataforma.');

  // Producto y personajes
  if (!arr(c.brief.photos).length) add('error', 'Producto', 'No hay fotografías del producto: los modelos inventarán la forma.',
    'Sube al menos 3 fotos (frontal, tres cuartos y detalle) en el Brief.');
  else if (!arr(c.brief.photos).some((p) => p.isHero)) add('info', 'Producto', 'Ninguna foto está marcada como principal.',
    'Marca la mejor toma como principal: es la referencia que se envía primero a los modelos.');
  if (!s(c.brand.productLock).trim()) add('info', 'Producto', 'No hay descripción de bloqueo del producto.',
    'Describe forma, materiales y marca en Marca → Bloqueo de producto para que los modelos no lo alteren.');
  const humanScenes = scenes.filter((x) => ['problem', 'proof'].indexOf(x.role) >= 0).length;
  if (humanScenes > 1 && !s(c.brand.characterLock).trim()) add('warn', 'Personajes', humanScenes + ' escenas muestran personas y no hay ficha de personaje.',
    'Define edad, aspecto y vestuario en Marca → Bloqueo de personaje, o el modelo cambiará de persona entre planos.');

  // Tono
  const forbidden = arr(c.brand.forbidden).map(norm).filter(Boolean);
  if (forbidden.length) {
    const hay = [];
    const scan = (label, text) => { const t = norm(text); for (const f of forbidden) if (f && t.indexOf(f) >= 0) hay.push(label + ' → «' + f + '»'); };
    for (const ad of arr(obj(c.copy).ads)) scan(ad.platformLabel + ' ' + ad.variant, ad.primary + ' ' + ad.headline);
    for (const sc of scenes) scan(sc.code, sc.onScreenText);
    if (hay.length) add('error', 'Tono', 'Aparecen términos prohibidos: ' + uniq(hay).slice(0, 6).join(', ') + '.',
      'Regenera el copy o edita esas piezas a mano.');
  }
  if (!s(c.brand.tone).trim()) add('info', 'Tono', 'No hay tono de marca declarado; se usa el del estilo.',
    'Tono del estilo: ' + st.tone);

  // Consistencia del storyboard
  const noProduct = scenes.filter((x) => !x.productVisible).length;
  if (scenes.length && noProduct / scenes.length > 0.4) add('warn', 'Producto', 'El producto no aparece en el ' + Math.round((noProduct / scenes.length) * 100) + ' % de los planos.',
    'En publicidad de resultado directo, el producto debe verse antes del segundo 3.');
  const grades = uniq(scenes.map((x) => x.grade));
  if (grades.length > 2) add('warn', 'Color', 'Se mezclan ' + grades.length + ' etalonajes distintos (' + grades.join(', ') + ').',
    'Unifica el grade: la mezcla rompe la percepción de una sola pieza.');
  const ctaScenes = scenes.filter((x) => x.role === 'cta').length;
  if (!ctaScenes) add('warn', 'Cierre', 'No hay plano de cierre de marca.', 'Añade una escena con rol «cta».');

  // Copy demasiado largo para su plataforma
  for (const ad of arr(obj(c.copy).ads)) {
    if (ad.overLimit) add('error', 'Copy', ad.platformLabel + ' variante ' + ad.variant + ' excede el límite de caracteres.',
      'Acorta el texto principal o el titular.');
  }

  const score = Math.max(0, 100 - findings.reduce((a, f) => a + SEVERITY[f.severity] * 6, 0));
  return {
    generatedAt: nowIso(),
    score, level: score >= 85 ? 'excelente' : score >= 70 ? 'aceptable' : score >= 50 ? 'revisar' : 'crítico',
    findings: findings.sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity]),
    counts: {
      error: findings.filter((f) => f.severity === 'error').length,
      warn: findings.filter((f) => f.severity === 'warn').length,
      info: findings.filter((f) => f.severity === 'info').length,
    },
    lockedRules: [
      'Paleta limitada a: ' + ['primary', 'secondary', 'accent'].map((k) => s(pal[k])).join(' · '),
      'Tipografías: ' + (s(c.brand.typography.display) || st.typography.display) + ' / ' + (s(c.brand.typography.body) || st.typography.body),
      'Tono: ' + (s(c.brand.tone) || st.tone),
      s(c.brand.productLock) ? 'Producto: ' + s(c.brand.productLock) : 'Producto: forma y marca idénticas en todos los planos',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 12 · Analytics
// Costes (estimados y reales), tiempo, tokens, consumo por proveedor y
// proyección de rendimiento por canal. Todo lo proyectado va etiquetado como
// estimación derivada de benchmarks, nunca como promesa.
// ═══════════════════════════════════════════════════════════════════════════

function buildAnalytics(c, ledger) {
  const prod = obj(c.production);
  const jobs = arr(prod.jobs);
  const entries = arr(ledger);          // costes reales registrados (items)
  const cur = s(c.settings.currency) || 'USD';

  // ── Coste estimado por proveedor y por tipo ────────────────────────────
  const estByProvider = {};
  const estByKind = {};
  for (const j of jobs) {
    estByProvider[j.providerId] = round((estByProvider[j.providerId] || 0) + num(j.estCostUsd, 0), 4);
    estByKind[j.kind] = round((estByKind[j.kind] || 0) + num(j.estCostUsd, 0), 4);
  }
  const estTotal = round(jobs.reduce((a, j) => a + num(j.estCostUsd, 0), 0), 4);

  // ── Coste real (del ledger de la instancia) ────────────────────────────
  const realByProvider = {};
  let realTotal = 0; let tokens = 0; let calls = 0; let seconds = 0; let images = 0;
  for (const e of entries) {
    const amt = num(e.amountUsd, 0);
    realTotal = round(realTotal + amt, 4);
    realByProvider[s(e.providerId)] = round((realByProvider[s(e.providerId)] || 0) + amt, 4);
    tokens += num(e.tokens, 0);
    calls += num(e.calls, 1);
    seconds += num(e.seconds, 0);
    images += num(e.images, 0);
  }

  const done = jobs.filter((j) => j.status === 'done').length;
  const progress = jobs.length ? round((done / jobs.length) * 100, 1) : 0;

  // ── Proyección de medios ───────────────────────────────────────────────
  const plan = obj(c.plan);
  const budget = num(obj(plan.budget).total, num(c.brief.budget, 0));
  const chans = arr(plan.channels).map((x) => PLATFORMS.find((p) => p.id === x.id)).filter(Boolean);
  const perChannel = chans.map((p, i) => {
    const share = i === 0 ? 0.5 : i === 1 ? 0.3 : 0.2 / Math.max(1, chans.length - 2);
    const spend = round(budget * share, 2);
    const impressions = p.cpm > 0 ? Math.round((spend / p.cpm) * 1000) : 0;
    const clicks = Math.round(impressions * p.ctr);
    const actions = Math.round(clicks * p.cvr / Math.max(0.0001, p.ctr) * p.ctr);
    return {
      id: p.id, label: p.label, spend, currency: cur,
      impressions, clicks, ctr: p.ctr, cvr: p.cvr, cpm: p.cpm,
      actions: Math.round(clicks * p.cvr),
      cpc: clicks ? round(spend / clicks, 3) : 0,
      cpa: Math.round(clicks * p.cvr) ? round(spend / Math.round(clicks * p.cvr), 2) : 0,
    };
  });
  const totProj = perChannel.reduce((a, x) => ({
    spend: round(a.spend + x.spend, 2), impressions: a.impressions + x.impressions,
    clicks: a.clicks + x.clicks, actions: a.actions + x.actions,
  }), { spend: 0, impressions: 0, clicks: 0, actions: 0 });

  // Uplift creativo: el storyboard y el copy mueven el CTR esperado.
  const uplift = creativeUplift(c);
  const projCtr = totProj.impressions ? round((totProj.clicks / totProj.impressions) * uplift.factor * 100, 3) : 0;

  const aov = num(c.brief.priceText.replace(/[^\d.,]/g, '').replace(',', '.'), 0);
  const revenue = aov ? round(totProj.actions * aov * uplift.factor, 2) : 0;
  const roas = totProj.spend && revenue ? round(revenue / totProj.spend, 2) : null;

  return {
    generatedAt: nowIso(), currency: cur,
    production: {
      jobs: jobs.length, done, progress,
      estTotalUsd: estTotal, estByProvider, estByKind,
      realTotalUsd: realTotal, realByProvider,
      varianceUsd: round(realTotal - estTotal, 4),
      estMinutes: num(prod.estMinutes, 0),
      consumption: { tokens, calls, seconds: round(seconds, 1), images },
    },
    media: {
      budget, byChannel: perChannel, totals: totProj,
      expectedCtrPct: projCtr, upliftFactor: uplift.factor, upliftReasons: uplift.reasons,
      estimatedRevenue: revenue, estimatedRoas: roas,
      cpa: totProj.actions ? round(totProj.spend / totProj.actions, 2) : 0,
    },
    disclaimer: 'Las cifras de medios son PROYECCIONES a partir de benchmarks públicos por familia de plataforma '
      + 'y del ajuste creativo del propio storyboard. No son un compromiso de resultado: sirven para dimensionar '
      + 'presupuesto y comparar variantes entre sí.',
    recommendations: analyticsAdvice(c, perChannel, uplift),
  };
}

/** Ajuste del CTR esperado según decisiones creativas medibles. */
function creativeUplift(c) {
  const scenes = arr(obj(c.storyboard).scenes);
  const reasons = [];
  let f = 1;
  const first = scenes[0];
  if (first && num(first.durationSec, 3) <= 1.6) { f *= 1.08; reasons.push('Gancho de menos de 1,6 s (+8 %).'); }
  const productBy3 = scenes.filter((x) => num(x.startSec, 99) < 3 && x.productVisible).length > 0;
  if (productBy3) { f *= 1.06; reasons.push('El producto aparece antes del segundo 3 (+6 %).'); }
  else reasons.push('El producto tarda más de 3 s en aparecer: riesgo de caída de atención.');
  if (c.settings.subtitles !== false) { f *= 1.10; reasons.push('Subtítulos quemados (+10 %: la mayoría ve sin sonido).'); }
  else { f *= 0.9; reasons.push('Sin subtítulos (−10 %).'); }
  const nVar = clamp(num(c.settings.variantCount, 1), 1, 8);
  if (nVar >= 3) { f *= 1.05; reasons.push(nVar + ' variantes para rotar (+5 % por evitar fatiga).'); }
  const vertical = arr(c.settings.targets.aspects).some((a) => a === '9:16' || a === '4:5');
  if (vertical) { f *= 1.07; reasons.push('Formato vertical nativo (+7 %).'); }
  else { f *= 0.88; reasons.push('Sin pieza vertical nativa (−12 % en feeds móviles).'); }
  const bc = obj(c.brandCheck);
  if (num(bc.score, 100) < 60) { f *= 0.94; reasons.push('Auditoría de marca por debajo de 60 (−6 %).'); }
  return { factor: round(f, 3), reasons };
}

function analyticsAdvice(c, perChannel, uplift) {
  const out = [];
  const scenes = arr(obj(c.storyboard).scenes);
  if (!arr(c.settings.targets.aspects).some((a) => a === '9:16')) out.push('Añade el formato 9:16: concentra el descubrimiento en móvil.');
  if (c.settings.subtitles === false) out.push('Activa los subtítulos quemados antes de invertir en medios.');
  if (scenes.length && num(scenes[0].durationSec, 0) > 2.5) out.push('El primer plano dura ' + fmtSec(scenes[0].durationSec) + ': acórtalo por debajo de 2 s.');
  const best = perChannel.slice().sort((a, b) => (b.actions || 0) - (a.actions || 0))[0];
  if (best) out.push('Arranca concentrando el 60 % del presupuesto en ' + best.label + ' y reasigna a los 7 días según CPA real.');
  if (clamp(num(c.settings.variantCount, 1), 1, 8) < 3) out.push('Sube a 3 variantes: por debajo, la creatividad se satura en menos de dos semanas.');
  const prod = obj(c.production);
  if (num(prod.totals && prod.totals.cost, 0) > num(c.brief.budget, 0) * 0.25) {
    out.push('La producción supera el 25 % del presupuesto total: considera un proveedor de vídeo más económico o menos tomas.');
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Exportaciones
// ═══════════════════════════════════════════════════════════════════════════

/** Biblia de campaña en Markdown: el documento que se entrega al cliente. */
function exportBible(c) {
  const st = styleById(c.styleId);
  const cn = obj(c.concept); const rs = obj(c.research); const pl = obj(c.plan);
  const sb = obj(c.storyboard); const cp = obj(c.copy); const an = obj(c.analytics);
  const L = [];
  const H = (n, t) => L.push('\n' + '#'.repeat(n) + ' ' + t + '\n');
  const li = (t) => L.push('- ' + t);

  L.push('# ' + s(c.title));
  L.push('');
  L.push('> ' + s(cn.bigIdea));
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push('| Producto | ' + s(c.brief.productName) + ' |');
  L.push('| Categoría | ' + categoryById(c.categoryId).label + ' |');
  L.push('| Estilo | ' + st.name + ' — ' + st.tagline + ' |');
  L.push('| Objetivo | ' + objectiveById(c.objectiveId).label + ' |');
  L.push('| Público | ' + audienceById(c.audienceId).label + ' |');
  L.push('| Duración hero | ' + fmtSec(num(sb.totalSec, 0)) + ' |');
  L.push('| Generado | ' + nowIso() + ' |');

  H(2, 'Concepto creativo');
  L.push('**Idea:** ' + s(cn.bigIdea));
  L.push('');
  L.push('**Mensaje clave:** ' + s(cn.keyMessage));
  L.push('');
  L.push('**Logline:** ' + s(obj(cn.storytelling).logline));
  L.push('');
  L.push('**Arco narrativo:** ' + s(obj(cn.storytelling).arcName) + ' — ' + arr(obj(cn.storytelling).beats).join(' → '));
  H(3, 'Emociones');
  for (const e of arr(cn.emotions)) li(e);
  H(3, 'Beneficios');
  for (const b of arr(cn.benefits)) li('**' + s(b.attribute) + '** → ' + s(b.benefit) + ' _(prueba: ' + s(b.proof) + ')_');
  H(3, 'Money shot');
  L.push(s(obj(cn.moneyShot).description));

  H(2, 'Investigación');
  H(3, 'Mercado');
  for (const t of arr(obj(rs.market).trends)) li(t);
  L.push('');
  L.push('_Estacionalidad:_ ' + s(obj(rs.market).seasonality));
  H(3, 'Público');
  L.push('**' + s(obj(rs.audience).segment) + '** (' + s(obj(rs.audience).age) + ') · impulso: ' + s(obj(rs.audience).driver));
  L.push('');
  L.push('_Objeciones:_ ' + arr(obj(rs.audience).objections).join(' · '));
  H(3, 'Competencia');
  for (const x of arr(rs.competition)) li('**' + s(x.name) + '** (' + s(x.posture) + ') — hueco: ' + s(x.gap));
  H(3, 'Nicho');
  L.push(s(obj(rs.niche).statement));
  L.push('');
  L.push('_Espacio libre:_ ' + s(obj(rs.niche).whiteSpace));

  H(2, 'Plan de campaña');
  L.push('| Etapa | % | Presupuesto | Canales | KPI |');
  L.push('|---|---:|---:|---|---|');
  for (const f of arr(pl.funnel)) {
    L.push('| ' + f.label + ' | ' + f.sharePct + ' % | ' + fmtMoney(f.budget, f.currency) + ' | ' + arr(f.channels).join(', ') + ' | ' + f.kpi + ' |');
  }
  H(3, 'KPIs');
  for (const k of arr(pl.kpis)) li('**' + k.label + '**: ' + k.target + ' — ' + k.why);

  H(2, 'Storyboard');
  L.push('| # | Rol | Dur. | Plano | Óptica | Movimiento | Luz | Color | FX |');
  L.push('|---|---|---:|---|---|---|---|---|---|');
  for (const sc of arr(sb.scenes)) {
    L.push('| ' + sc.code + ' | ' + sc.roleLabel + ' | ' + fmtSec(sc.durationSec) + ' | ' + labelOf(SHOTS, sc.shot)
      + ' | ' + labelOf(LENSES, sc.lens) + ' | ' + labelOf(MOVES, sc.move) + ' | ' + labelOf(LIGHTING, sc.lighting)
      + ' | ' + labelOf(GRADES, sc.grade) + ' | ' + arr(sc.fx).map((f) => labelOf(FX, f)).join(', ') + ' |');
  }
  H(3, 'Descripción de escenas');
  for (const sc of arr(sb.scenes)) {
    L.push('**' + sc.code + ' · ' + sc.roleLabel + '** (' + fmtSec(sc.durationSec) + ')');
    L.push('');
    L.push(sc.description);
    if (s(sc.onScreenText)) L.push('');
    if (s(sc.onScreenText)) L.push('_Texto en pantalla:_ « ' + sc.onScreenText + ' »');
    L.push('');
    L.push('_Sonido:_ ' + s(sc.soundNote));
    L.push('');
  }

  H(2, 'Voz y música');
  const au = obj(c.audio);
  L.push('**Perfil de voz:** ' + s(obj(au.voiceProfile).casting));
  L.push('');
  for (const v of arr(au.vo)) L.push('- `' + v.code + '` (' + fmtSec(v.startSec) + ') — ' + v.text + (v.fits ? '' : ' ⚠️ excede el plano'));
  H(3, 'Música');
  L.push('`' + s(obj(au.music).prompt) + '`');

  H(2, 'Copy');
  for (const ad of arr(cp.ads)) {
    L.push('**' + ad.platformLabel + ' · variante ' + ad.variant + '** (' + ad.hookLabel + ')');
    L.push('');
    L.push('> ' + s(ad.primary).replace(/\n+/g, '  \n> '));
    L.push('');
    L.push('_Titular:_ ' + ad.headline + (ad.description ? ' · _Descripción:_ ' + ad.description : '') + ' · _CTA:_ ' + ad.cta);
    L.push('');
  }
  H(3, 'Landing');
  L.push('**' + s(obj(obj(cp.landing).hero).headline) + '**');
  L.push('');
  L.push(s(obj(obj(cp.landing).hero).subheadline));
  for (const v of arr(obj(cp.landing).valueProps)) li('**' + v.title + '** — ' + v.body);
  H(3, 'Emails');
  for (const e of arr(cp.emails)) li('Día ' + e.day + ' · **' + e.subject + '** (' + e.stage + ')');

  H(2, 'Entregables');
  for (const e of arr(obj(c.edit).exports)) {
    li('`' + e.filename + '` — ' + e.aspect + ' ' + e.width + '×' + e.height + ' @' + e.fps + ' fps'
      + (arr(e.platforms).length ? ' → ' + e.platforms.join(', ') : ''));
  }

  H(2, 'Producción y costes');
  const pr = obj(c.production);
  L.push('Trabajos: **' + arr(pr.jobs).length + '** · Coste estimado: **' + fmtMoney(num(obj(pr.totals).cost, 0), 'USD') + '**');
  L.push('');
  L.push('| Tipo | Trabajos | Coste est. |');
  L.push('|---|---:|---:|');
  for (const k of Object.keys(obj(obj(pr.totals).countByKind))) {
    L.push('| ' + k + ' | ' + obj(pr.totals).countByKind[k] + ' | ' + fmtMoney(obj(pr.totals).byKind[k], 'USD') + ' |');
  }
  if (an.media) {
    H(3, 'Proyección de medios');
    L.push('_' + s(an.disclaimer) + '_');
    L.push('');
    L.push('| Canal | Inversión | Impresiones | Clics | Acciones | CPA |');
    L.push('|---|---:|---:|---:|---:|---:|');
    for (const x of arr(obj(an.media).byChannel)) {
      L.push('| ' + x.label + ' | ' + fmtMoney(x.spend, x.currency) + ' | ' + x.impressions.toLocaleString('es')
        + ' | ' + x.clicks.toLocaleString('es') + ' | ' + x.actions.toLocaleString('es') + ' | ' + fmtMoney(x.cpa, x.currency) + ' |');
    }
  }

  H(2, 'Control de marca');
  const bc = obj(c.brandCheck);
  L.push('Puntuación: **' + num(bc.score, 0) + '/100** (' + s(bc.level) + ')');
  L.push('');
  for (const f of arr(bc.findings)) li('`' + f.severity + '` **' + f.area + '** — ' + f.text + (f.fix ? ' → _' + f.fix + '_' : ''));

  return L.join('\n');
}

/** Todos los prompts en CSV (una fila por trabajo generativo). */
function exportPromptsCsv(c) {
  const rows = [['escena', 'rol', 'tipo', 'aspecto', 'duracion_s', 'proveedor', 'prompt', 'negativo', 'parametros']];
  const pr = obj(c.prompts);
  const push = (p) => rows.push([p.code, p.role, p.kind, p.aspect, p.durationSec || '', p.providerId,
    p.text, p.negative, JSON.stringify(obj(p.params))]);
  for (const p of arr(pr.image)) push(p);
  for (const p of arr(pr.video)) push(p);
  for (const k of Object.keys(obj(pr.byFormat))) for (const p of arr(pr.byFormat[k])) push(p);
  for (const v of arr(obj(c.audio).vo)) {
    rows.push([v.code, 'vo', 'voice', '', v.estimatedSec, v.providerId, v.text, '', JSON.stringify(obj(v.params))]);
  }
  const mu = obj(obj(c.audio).music);
  if (mu.prompt) rows.push(['MUS', 'music', 'music', '', mu.durationSec || '', s(mu.providerId), s(mu.prompt), '', JSON.stringify(obj(mu.params))]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/** Copy en CSV listo para importar en el gestor de anuncios. */
function exportCopyCsv(c) {
  const rows = [['plataforma', 'variante', 'gancho', 'texto_principal', 'titular', 'descripcion', 'cta', 'sobre_limite']];
  for (const a of arr(obj(c.copy).ads)) {
    rows.push([a.platformLabel, a.variant, a.hookLabel, a.primary, a.headline, a.description, a.cta, a.overLimit ? 'SI' : '']);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/**
 * Manifiesto de assets: qué archivo generado corresponde a cada ruta que el
 * montaje espera encontrar. Es el puente entre la Biblioteca y el render.
 */
function exportAssetsManifest(c, assets) {
  const jobs = arr(obj(c.production).jobs);
  const byId = new Map(arr(assets).map((a) => [a.id, a]));
  const files = jobs.filter((j) => s(j.file)).map((j) => {
    const a = j.assetId ? byId.get(j.assetId) : null;
    return { file: j.file, jobId: j.id, kind: j.kind, scene: j.code,
      url: a ? a.url : '', ready: !!a, joinInto: s(j.joinInto) || undefined };
  });
  return JSON.stringify({
    campaign: s(c.title), generatedAt: nowIso(),
    ready: files.filter((f) => f.ready).length, total: files.length,
    subtitles: 'subs.srt', logo: s(c.brand.logoUrl) || null,
    files,
  }, null, 2);
}

/**
 * Bundle de render: un único script que descarga todos los assets registrados
 * en las rutas que espera el montaje, une las tomas partidas, escribe los
 * subtítulos y ejecuta FFmpeg hasta los entregables finales.
 *
 * Es lo que convierte «tengo los archivos sueltos en la Biblioteca» en «tengo
 * el vídeo», sin pedirle al usuario que ordene nada a mano.
 */
function exportRenderBundle(c, assets) {
  const jobs = arr(obj(c.production).jobs);
  const byId = new Map(arr(assets).map((a) => [a.id, a]));
  const entries = jobs.filter((j) => s(j.file)).map((j) => ({ job: j, asset: j.assetId ? byId.get(j.assetId) : null }));
  const missing = entries.filter((e) => !e.asset);
  const L = [];

  L.push('#!/usr/bin/env bash');
  L.push('# ' + s(c.title) + ' — bundle de render generado por Kreative Studio ' + KS_VERSION);
  L.push('#');
  L.push('# Descarga los assets ya registrados, ordena los archivos como espera el');
  L.push('# montaje, une las tomas partidas y ejecuta FFmpeg hasta los entregables.');
  L.push('#');
  L.push('#   bash ' + slug(c.title) + '-render.sh');
  L.push('#');
  L.push('# Requiere: bash, curl y ffmpeg con libx264, xfade, sidechaincompress,');
  L.push('# loudnorm y drawtext (compilado con --enable-libfreetype).');
  if (missing.length) {
    L.push('#');
    L.push('# ⚠️  FALTAN ' + missing.length + ' DE ' + entries.length + ' ARCHIVOS. Este script descargará lo que hay');
    L.push('#    y FFmpeg fallará al llegar al primero que falte. Genera y registra:');
    for (const m of missing.slice(0, 40)) L.push('#      · ' + m.job.file + '  (' + m.job.label + ')');
    if (missing.length > 40) L.push('#      · … y ' + (missing.length - 40) + ' más');
  }
  L.push('set -euo pipefail');
  L.push('');
  L.push('mkdir -p render keyframes audio brand fonts work out');
  L.push('');
  L.push('command -v curl >/dev/null || { echo "Falta curl."; exit 1; }');
  L.push('command -v ffmpeg >/dev/null || { echo "Falta ffmpeg."; exit 1; }');
  L.push('');
  L.push('# ── Descarga de assets registrados ───────────────────────────────────');
  L.push('# `-S` deja pasar el mensaje de error de curl: si una descarga falla hay');
  L.push('# que ver POR QUÉ, no quedarse mirando un "bajando…" que no termina.');
  L.push('dl() {  # dl <destino> <url>');
  L.push('  if [ -f "$1" ]; then echo "  ya está: $1"; return 0; fi');
  L.push('  mkdir -p "$(dirname "$1")"');
  L.push('  echo "  bajando: $1"');
  L.push('  if ! curl -fsSL --show-error --retry 3 --retry-delay 2 --connect-timeout 20 -o "$1" "$2"; then');
  L.push('    rm -f "$1"');
  L.push('    echo "" >&2');
  L.push('    echo "✖ No se pudo descargar $1" >&2');
  L.push('    echo "  desde: $2" >&2');
  L.push('    echo "  Comprueba que la URL sigue siendo accesible desde esta máquina" >&2');
  L.push('    echo "  (los assets se sirven desde KIMOS y pueden requerir red o VPN)." >&2');
  L.push('    exit 1');
  L.push('  fi');
  L.push('}');
  for (const e of entries) {
    if (e.asset) L.push('dl ' + shq(e.job.file) + ' ' + shq(e.asset.url));
    else L.push('# FALTA ' + e.job.file + ' — ' + e.job.label + ' (genera y registra el asset)');
  }
  if (s(c.brand.logoUrl)) L.push('dl brand/logo.png ' + shq(s(c.brand.logoUrl)));
  L.push('');

  // Unión de tomas partidas: una escena que no cabía en el modelo llega en
  // varios archivos y el montaje espera uno solo.
  const joins = {};
  for (const e of entries) {
    const into = s(e.job.joinInto);
    if (!into) continue;
    (joins[into] = joins[into] || []).push(e.job.file);
  }
  const joinKeys = Object.keys(joins);
  if (joinKeys.length) {
    L.push('# ── Unión de tomas partidas ──────────────────────────────────────────');
    L.push('# Estas escenas superaban el máximo del modelo y se generaron por partes.');
    for (const into of joinKeys) {
      const parts = joins[into];
      L.push('printf "%s\\n" \\');
      for (const p of parts) L.push('  "file \'' + p.replace(/^render\//, '') + '\'" \\');
      L.push('  > work/join-' + slug(into) + '.txt');
      L.push('( cd render && ffmpeg -y -f concat -safe 0 -i ../work/join-' + slug(into) + '.txt -c copy '
        + shq(into.replace(/^render\//, '')) + ' )');
    }
    L.push('');
  }

  if (c.settings.subtitles !== false) {
    L.push('# ── Subtítulos ───────────────────────────────────────────────────────');
    L.push("cat > subs.srt <<'KREATIVE_SRT'");
    L.push(s(obj(c.edit).srt).replace(/\r/g, ''));
    L.push('KREATIVE_SRT');
    L.push('');
  }

  L.push('# ── Tipografías ──────────────────────────────────────────────────────');
  L.push('# El montaje rotula con fonts/display.ttf y fonts/body.ttf. Copia ahí las');
  L.push('# de tu marca (' + (s(c.brand.typography.display) || styleById(c.styleId).typography.display) + ' / '
    + (s(c.brand.typography.body) || styleById(c.styleId).typography.body) + ').');
  L.push('for f in fonts/display.ttf fonts/body.ttf; do');
  L.push('  [ -f "$f" ] || { echo "FALTA $f — copia una tipografía TTF ahí"; exit 1; }');
  L.push('done');
  L.push('');
  L.push('# ── Montaje ──────────────────────────────────────────────────────────');
  L.push(s(obj(c.edit).ffmpeg).split('\n').filter((l) => l.indexOf('#!') !== 0 && l !== 'set -euo pipefail').join('\n'));
  return L.join('\n');
}

/** Lista de trabajos de producción en CSV para operar la generación. */
function exportJobsCsv(c) {
  const rows = [['orden', 'id', 'tipo', 'etapa', 'codigo', 'proveedor', 'unidad', 'cantidad', 'coste_est_usd', 'estado', 'prompt']];
  for (const j of arr(obj(c.production).jobs)) {
    rows.push([j.order, j.id, j.kind, j.stage, j.code, j.providerId, j.costUnit, j.billableQty, j.estCostUsd, j.status, j.prompt]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// APLICACIÓN · Los 12 agentes especializados
//
// Cada agente es INDEPENDIENTE: declara qué necesita (`needs`), qué sección
// escribe (`writes`) y se ejecuta con `run(campaign, ctx)` devolviendo SOLO
// su fragmento. No conoce a los demás, no toca el DOM, no hace IO. El
// orquestador (KIMOS o el pipeline interno) decide el orden.
// ═══════════════════════════════════════════════════════════════════════════

const AGENTS = [
  {
    id: 'creative-director', n: 1, name: 'Creative Director', emoji: '🎯', dept: 'direccion',
    description: 'Analiza el producto, extrae atributos, ventajas y emociones, y define storytelling, estilo visual, narrativa y concepto creativo.',
    needs: ['brief'], writes: 'concept', requires: [],
    run: (c) => buildConcept(c),
  },
  {
    id: 'research', n: 2, name: 'Research Agent', emoji: '🔍', dept: 'marketing',
    description: 'Investiga mercado, competencia, tendencias, público objetivo, nicho y el estilo visual dominante de la categoría.',
    needs: ['brief'], writes: 'research', requires: [],
    run: (c) => buildResearch(c),
  },
  {
    id: 'planner', n: 3, name: 'Campaign Planner', emoji: '🗺️', dept: 'operaciones',
    description: 'Define objetivo y funnel completo (notoriedad, consideración, conversión y remarketing) con canales, presupuesto, calendario y KPIs.',
    needs: ['research'], writes: 'plan', requires: ['research'],
    run: (c) => buildPlan(c),
  },
  {
    id: 'storyboard', n: 4, name: 'Storyboard Generator', emoji: '🎞️', dept: 'produccion',
    description: 'Genera escenas con duración, cámara, ángulo, óptica, movimiento, iluminación, etalonaje, efectos y ritmo, por cada formato y variante.',
    needs: ['concept'], writes: 'storyboard', requires: ['concept'],
    run: (c) => buildStoryboard(c),
  },
  {
    id: 'prompt-engineer', n: 5, name: 'Prompt Engineer', emoji: '✍️', dept: 'ti',
    description: 'Traduce cada escena a prompts optimizados para el proveedor configurado (OpenAI, Midjourney, FLUX, SD, ComfyUI, Runway, Kling, Veo, Sora, Higgsfield).',
    needs: ['storyboard'], writes: 'prompts', requires: ['storyboard'],
    run: (c) => buildPrompts(c),
  },
  {
    id: 'voice-director', n: 6, name: 'Voice Director', emoji: '🎙️', dept: 'produccion',
    description: 'Escribe la locución ajustada al metraje y genera los briefs de música, ambiente y efectos para ElevenLabs, OpenAI Audio, Suno o Udio.',
    needs: ['storyboard', 'concept'], writes: 'audio', requires: ['storyboard'],
    run: (c) => buildAudio(c),
  },
  {
    id: 'video-producer', n: 7, name: 'Video Producer', emoji: '🎬', dept: 'produccion',
    description: 'Convierte prompts en trabajos de producción ejecutables: keyframes, tomas encadenadas cuando la escena excede el modelo, audio y coste estimado.',
    needs: ['prompts', 'audio'], writes: 'production', requires: ['prompts'],
    run: (c) => buildProduction(c),
  },
  {
    id: 'video-editor', n: 8, name: 'Video Editor', emoji: '✂️', dept: 'produccion',
    description: 'Construye el timeline, los subtítulos SRT, la lista EDL y el script FFmpeg completo: cortes, color, transiciones, títulos, logo, CTA, mezcla y exportación.',
    needs: ['storyboard', 'audio'], writes: 'edit', requires: ['storyboard'],
    run: (c) => buildEdit(c),
  },
  {
    id: 'copywriter', n: 10, name: 'Copywriter', emoji: '🖊️', dept: 'marketing',
    description: 'Redacta anuncios para Meta, Instagram, TikTok, LinkedIn, YouTube y Google, más landing completa y secuencia de emails, respetando los límites de cada plataforma.',
    needs: ['concept', 'research'], writes: 'copy', requires: ['concept'],
    run: (c) => buildCopy(c),
  },
  {
    id: 'brand-consistency', n: 9, name: 'Brand Consistency', emoji: '🛡️', dept: 'legal',
    description: 'Audita paleta, tipografía, logotipo, producto, personajes, tono y legibilidad, y devuelve hallazgos accionables con su severidad.',
    needs: ['storyboard', 'copy'], writes: 'brandCheck', requires: ['storyboard'],
    run: (c) => buildBrandCheck(c),
  },
  {
    id: 'analytics', n: 12, name: 'Analytics', emoji: '📊', dept: 'finanzas',
    description: 'Contabiliza costes estimados y reales, tiempo, tokens y consumo por proveedor, y proyecta CTR, CPA y ROAS por canal.',
    needs: ['production', 'plan'], writes: 'analytics', requires: ['production'],
    run: (c, ctx) => buildAnalytics(c, arr(obj(ctx).ledger)),
  },
];

/**
 * AGENTE 11 · Asset Manager — es el único agente con estado externo: vive en
 * `shell.items` (imágenes, vídeos, audio, guiones, prompts, escenas,
 * versiones e iteraciones). Sus operaciones se exponen en el adaptador de
 * persistencia dentro de mount(); aquí quedan sus reglas puras.
 */
const ASSET_KINDS = [
  { id: 'image', label: 'Imagen', emoji: '🖼️' },
  { id: 'video', label: 'Vídeo', emoji: '🎬' },
  { id: 'audio', label: 'Audio', emoji: '🎵' },
  { id: 'document', label: 'Documento', emoji: '📄' },
  { id: 'logo', label: 'Logotipo', emoji: '🏷️' },
  { id: 'reference', label: 'Referencia', emoji: '📎' },
];

/** Normaliza un asset venga de donde venga (UI, agente o importación). */
function normalizeAsset(raw, campaign) {
  const a = obj(raw);
  const kind = ASSET_KINDS.some((k) => k.id === s(a.kind)) ? s(a.kind) : guessKind(s(a.url));
  const scene = arr(obj(campaign).storyboard && campaign.storyboard.scenes)
    .find((x) => x.id === s(a.sceneId) || x.code === s(a.sceneId) || x.code === s(a.code));
  return {
    id: s(a.id) || newId('asset'),
    kind, url: s(a.url), name: s(a.name) || s(a.url).split('/').pop() || 'asset',
    sceneId: scene ? scene.id : (s(a.sceneId) || null),
    code: scene ? scene.code : s(a.code),
    jobId: s(a.jobId) || null,
    // Tipo del trabajo que lo produjo (image|video|voice|music|sfx). Es lo
    // que distingue una locución de un efecto dentro de la misma escena.
    jobKind: s(a.jobKind) || null,
    providerId: s(a.providerId) || null,
    version: Math.max(1, num(a.version, 1)),
    parentId: s(a.parentId) || null,
    costUsd: round(num(a.costUsd, 0), 4),
    durationSec: round(num(a.durationSec, 0), 2),
    prompt: s(a.prompt),
    approved: !!a.approved,
    tags: uniq(arr(a.tags).map(s)),
    note: s(a.note),
    createdAt: s(a.createdAt) || nowIso(),
  };
}
/** Familia de medio a la que pertenece un tipo de trabajo. */
const JOB_MEDIA = { image: 'image', video: 'video', voice: 'audio', music: 'audio', sfx: 'audio' };

/**
 * Marca como completados los trabajos que ya tienen su archivo registrado.
 * Sin esto, el estado de un trabajo dependería de que quien generó se
 * acordara de pasar el `jobId`, y la lista de pendientes mentiría.
 * Empareja por `jobId` y, en su defecto, por escena + familia de medio.
 */
function reconcileJobs(campaign, assets) {
  const prod = obj(campaign.production);
  const jobs = arr(prod.jobs);
  if (!jobs.length) return campaign;
  const list = arr(assets);
  const byJob = new Map();
  for (const a of list) if (s(a.jobId)) byJob.set(s(a.jobId), a);
  for (const j of jobs) {
    if (j.status === 'skipped' || j.status === 'failed') continue;
    const media = JOB_MEDIA[j.kind] || 'reference';
    let hit = byJob.get(j.id) || null;
    if (!hit && j.sceneId) {
      const cands = list.filter((a) => a.kind === media && a.sceneId === j.sceneId);
      // La locución y los efectos de una escena comparten familia de medio:
      // emparejar solo por escena cerraría los dos con un único archivo. Para
      // audio hace falta saber de qué trabajo salió; para imagen y vídeo la
      // familia ya es única dentro de la escena.
      hit = cands.find((a) => s(a.jobKind) === j.kind)
        || (media === 'audio' ? null : cands.find((a) => !s(a.jobKind))) || null;
    }
    // Música y efectos globales no cuelgan de una escena: van por código.
    if (!hit && !j.sceneId) {
      hit = list.find((a) => a.kind === media && (s(a.jobKind) === j.kind || !s(a.jobKind))
        && norm(a.code) === norm(j.code)) || null;
    }
    if (hit) { j.status = 'done'; j.assetId = hit.id; }
    else if (j.status === 'done') { j.status = 'pending'; j.assetId = null; }
  }
  return campaign;
}

/** Trabajos pendientes cuyas dependencias ya están satisfechas. */
function readyJobs(campaign, limit) {
  const jobs = arr(obj(campaign.production).jobs);
  const doneScenes = new Set(jobs.filter((j) => j.stage === 'keyframe' && j.status === 'done').map((j) => j.sceneId));
  const out = [];
  for (const j of jobs) {
    if (j.status !== 'pending') continue;
    const blocked = arr(j.dependsOn).some((d) => {
      const m = /^keyframe:(.+)$/.exec(s(d));
      return m ? !doneScenes.has(m[1]) : false;
    });
    if (blocked) continue;
    out.push(j);
    if (limit && out.length >= limit) break;
  }
  return out;
}

function guessKind(url) {
  const u = norm(url);
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(u)) return 'video';
  if (/\.(mp3|wav|aac|ogg|m4a|flac)(\?|$)/.test(u)) return 'audio';
  if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/.test(u)) return 'image';
  if (/\.(pdf|md|txt|json|csv|srt)(\?|$)/.test(u)) return 'document';
  return 'reference';
}

// ═══════════════════════════════════════════════════════════════════════════
// APLICACIÓN · Orquestador del pipeline
//
// Ejecuta los agentes respetando dependencias, registrando estado, tiempo y
// errores por etapa. Es síncrono y determinista: no hay colas ni workers
// porque cada agente es una función pura de milisegundos. La ejecución
// costosa (llamar a los modelos) vive en los TRABAJOS del Video Producer.
// ═══════════════════════════════════════════════════════════════════════════

const PIPELINE_ORDER = ['research', 'creative-director', 'planner', 'storyboard', 'prompt-engineer',
  'voice-director', 'copywriter', 'video-producer', 'video-editor', 'brand-consistency', 'analytics'];

const agentById = (id) => AGENTS.find((a) => a.id === s(id)) || null;
/** Agentes de los que depende otro (traduce `requires` a ids de agente). */
const agentDeps = (id) => {
  const a = agentById(id);
  if (!a) return [];
  return arr(a.requires).map((k) => (AGENTS.find((x) => x.writes === k) || {}).id).filter(Boolean);
};

/**
 * Orden efectivo del flujo. El usuario puede reordenar, pero un agente nunca
 * puede ir antes de aquel del que depende: si el orden guardado lo intenta, se
 * corrige en lugar de romper la ejecución.
 */
function effectiveOrder(campaign) {
  const custom = uniq(arr(obj(obj(campaign).settings).workflow && campaign.settings.workflow.order)
    .filter((x) => PIPELINE_ORDER.indexOf(x) >= 0));
  const wanted = custom.length ? custom.concat(PIPELINE_ORDER.filter((x) => custom.indexOf(x) < 0)) : PIPELINE_ORDER.slice();
  // Orden topológico estable: se respeta la preferencia salvo que rompa una
  // dependencia, en cuyo caso el que depende baja.
  const out = [];
  const pending = wanted.slice();
  let guard = 0;
  while (pending.length && guard++ < 200) {
    const i = pending.findIndex((id) => agentDeps(id).every((d) => out.indexOf(d) >= 0 || pending.indexOf(d) < 0));
    out.push(pending.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out.concat(pending);
}

/** ¿Está el agente apagado en el flujo? */
const isDisabled = (campaign, id) =>
  arr(obj(obj(campaign).settings).workflow && campaign.settings.workflow.disabled).indexOf(s(id)) >= 0;

/** El flujo tal y como se va a ejecutar, para pintarlo y para razonar sobre él. */
function workflowPlan(campaign) {
  const order = effectiveOrder(campaign);
  const stages = obj(obj(campaign).pipeline).stages;
  return order.map((id, i) => {
    const a = agentById(id);
    const off = isDisabled(campaign, id);
    const deps = agentDeps(id);
    const blocked = !off && deps.some((d) => isDisabled(campaign, d) && !campaign[(agentById(d) || {}).writes]);
    return {
      idx: i, id, n: a ? a.n : 0, name: a ? a.name : id, emoji: a ? a.emoji : '•',
      description: a ? a.description : '', writes: a ? a.writes : '',
      // Departamento al que pertenece: es lo que coloca a su avatar en el mapa
      // de la organización. Ver `wsSeedWorld`.
      departmentId: a ? a.dept : 'produccion',
      deps, disabled: off, blocked,
      status: off ? 'off' : blocked ? 'blocked' : s(obj(stages[id]).status) || 'idle',
      ms: num(obj(stages[id]).ms, 0), error: s(obj(stages[id]).error),
      hasOutput: !!campaign[a ? a.writes : ''],
    };
  });
}

// ── La organización detrás del flujo ──────────────────────────────────────
// El mapa de la empresa no se inventa: los departamentos son los mismos que
// declaran los agentes, y el personal humano es el equipo real que convive con
// ellos. Todo esto es solo la SIEMBRA inicial; a partir de ahí el usuario (o el
// agente de KIMOS) añade, edita y borra lo que quiera.

const KS_ORG_AREAS = [
  { departmentId: 'direccion', name: 'Dirección', structure: 'hq',
    stations: [{ name: 'Dirección creativa', process: 'Aprueba concepto y guion' },
      { name: 'Cuentas', process: 'Relación con el cliente' }] },
  { departmentId: 'marketing', name: 'Marketing', structure: 'office',
    stations: [{ name: 'Investigación', process: 'Mercado, competencia y tendencias' },
      { name: 'Copy', process: 'Anuncios, landing y emails' }] },
  { departmentId: 'produccion', name: 'Producción', structure: 'factory',
    stations: [{ name: 'Storyboard', process: 'Escenas, cámara y ritmo' },
      { name: 'Rodaje virtual', process: 'Keyframes y tomas' },
      { name: 'Sala de montaje', process: 'Timeline, subtítulos y render' },
      { name: 'Sonido', process: 'Locución, música y efectos' }] },
  { departmentId: 'ti', name: 'Tecnología', structure: 'lab',
    stations: [{ name: 'Prompts', process: 'Traducción a cada proveedor' },
      { name: 'Proveedores', process: 'Altas, claves y coste por unidad' }] },
  { departmentId: 'operaciones', name: 'Operaciones', structure: 'office',
    stations: [{ name: 'Planificación', process: 'Funnel, calendario y presupuesto' }] },
  { departmentId: 'finanzas', name: 'Finanzas', structure: 'office',
    stations: [{ name: 'Coste de campaña', process: 'Estimado contra real' }] },
  { departmentId: 'contabilidad', name: 'Contabilidad', structure: 'office',
    stations: [{ name: 'Facturación', process: 'Proveedores y cliente' }] },
  { departmentId: 'ventas', name: 'Ventas', structure: 'shop',
    stations: [{ name: 'Propuestas', process: 'Presupuesto y cierre' }] },
  { departmentId: 'rrhh', name: 'Recursos Humanos', structure: 'training',
    stations: [{ name: 'Formación', process: 'Onboarding y buenas prácticas' }] },
  { departmentId: 'legal', name: 'Legal y marca', structure: 'office',
    stations: [{ name: 'Cumplimiento', process: 'Legales, claims y uso de marca' }] },
];

const KS_ORG_PEOPLE = [
  { name: 'Dirección', role: 'Director creativo', departmentId: 'direccion' },
  { name: 'Cuentas', role: 'Responsable de cliente', departmentId: 'direccion' },
  { name: 'Marketing', role: 'Estratega', departmentId: 'marketing' },
  { name: 'Realización', role: 'Productor', departmentId: 'produccion' },
  { name: 'Montaje', role: 'Editor', departmentId: 'produccion' },
  { name: 'Finanzas', role: 'Controller', departmentId: 'finanzas' },
  { name: 'Contabilidad', role: 'Contable', departmentId: 'contabilidad' },
  { name: 'Ventas', role: 'Comercial', departmentId: 'ventas' },
  { name: 'Personas', role: 'Responsable de RRHH', departmentId: 'rrhh' },
  { name: 'Legal', role: 'Asesor', departmentId: 'legal' },
];

/** Mundo inicial de una campaña, sembrado desde su propio flujo de agentes. */
function seedOrgWorld(campaign) {
  return wsSeedWorld(workflowPlan(campaign), {
    appId: 'kreative-studio', groups: KS_ORG_AREAS, people: KS_ORG_PEOPLE,
  });
}

/**
 * Ejecuta el pipeline (completo o parcial) sobre una copia de la campaña.
 * Devuelve { campaign, run } — nunca muta la entrada.
 */
function runPipeline(campaign, opts) {
  const o = obj(opts);
  const only = arr(o.only).filter(Boolean);
  const order = effectiveOrder(campaign);
  const ids = only.length ? order.filter((x) => only.indexOf(x) >= 0) : order.slice();
  let c = JSON.parse(JSON.stringify(campaign));
  const t0 = Date.now();
  const run = { id: newId('run'), startedAt: nowIso(), stages: [], only: only.slice(), ok: true };

  for (const id of ids) {
    const agent = agentById(id);
    if (!agent) continue;
    // Un agente apagado no se ejecuta ni se autorresuelve: apagarlo es una
    // decisión del usuario, y saltársela «porque hacía falta» la anularía.
    if (isDisabled(c, id)) {
      const st = { agentId: id, name: agent.name, status: 'skipped', ms: 0, at: nowIso() };
      run.stages.push(st);
      c.pipeline.stages[id] = stageState(st);
      continue;
    }
    const missing = arr(agent.requires).filter((k) => !c[k]);
    if (missing.length) {
      // Autorresolución: ejecuta la dependencia que falte antes de seguir.
      for (const dep of missing) {
        const depAgent = AGENTS.find((a) => a.writes === dep);
        if (depAgent && ids.indexOf(depAgent.id) < 0 && !isDisabled(c, depAgent.id)) {
          const res = execAgent(depAgent, c, o);
          c[depAgent.writes] = res.value;
          run.stages.push(res.stage);
          c.pipeline.stages[depAgent.id] = stageState(res.stage);
        }
      }
      // Si la dependencia sigue sin datos porque está apagada, este agente no
      // puede correr: se marca bloqueado con el motivo, no se cuela un fallo.
      const still = arr(agent.requires).filter((k) => !c[k]);
      if (still.length) {
        const who = still.map((k) => (AGENTS.find((a) => a.writes === k) || {}).name || k).join(', ');
        const st = { agentId: id, name: agent.name, status: 'blocked', ms: 0, at: nowIso(),
          error: 'Necesita ' + who + ', que está desactivado en el flujo.' };
        run.stages.push(st);
        c.pipeline.stages[id] = stageState(st);
        continue;
      }
    }
    const res = execAgent(agent, c, o);
    if (res.stage.status === 'error') run.ok = false;
    else c[agent.writes] = res.value;
    run.stages.push(res.stage);
    c.pipeline.stages[agent.id] = stageState(res.stage);
  }

  run.finishedAt = nowIso();
  run.ms = Date.now() - t0;
  run.summary = summarize(c);
  c.pipeline.runs = arr(c.pipeline.runs).concat([{ id: run.id, at: run.startedAt, ms: run.ms, ok: run.ok,
    stages: run.stages.length, only: run.only }]).slice(-20);
  c.updatedAt = nowIso();
  logLine(c, run.ok ? 'success' : 'error',
    'Pipeline ' + (only.length ? '(' + only.join(', ') + ')' : 'completo') + ': ' + run.stages.length + ' etapas en ' + run.ms + ' ms.');
  return { campaign: c, run };
}

function execAgent(agent, c, o) {
  const t = Date.now();
  try {
    const value = agent.run(c, o);
    return { value, stage: { agentId: agent.id, name: agent.name, status: 'done', ms: Date.now() - t, at: nowIso() } };
  } catch (e) {
    return { value: null, stage: { agentId: agent.id, name: agent.name, status: 'error', ms: Date.now() - t,
      at: nowIso(), error: (e && e.message) || 'error desconocido' } };
  }
}
const stageState = (st) => ({ status: st.status, at: st.at, ms: st.ms, error: st.error || '' });

/**
 * Punto de entrada de alto nivel: "sube fotos + escribe una frase".
 * Interpreta la intención, fija estilo/objetivo/público y corre el pipeline.
 */
function generateCampaign(campaign, intentText, opts) {
  const c = JSON.parse(JSON.stringify(campaign));
  const text = s(intentText).trim();
  if (text) {
    c.brief.intent = text;
    const intent = parseIntent(text, c.brief);
    c.styleId = intent.styleId;
    c.objectiveId = intent.objectiveId;
    c.audienceId = intent.audienceId;
    c.categoryId = intent.categoryId;
    if (intent.durationSec) {
      c.settings.heroDurationSec = intent.durationSec;
      c.settings.shortDurationSec = Math.min(intent.durationSec, Math.max(6, Math.round(intent.durationSec / 2)));
    }
    logLine(c, 'info', 'Intención interpretada: estilo ' + styleById(c.styleId).name
      + ', objetivo ' + objectiveById(c.objectiveId).label + ', público ' + audienceById(c.audienceId).label + '.');
  }
  if (!s(c.title).trim() || c.title === 'Nueva campaña') {
    c.title = (s(c.brief.productName) || 'Campaña') + ' · ' + styleById(c.styleId).name;
  }
  return runPipeline(c, opts);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTADORES + UI · mount(shell)
// Todo lo que toca el mundo exterior (React, red, almacenamiento, agente)
// vive aquí dentro. El dominio de arriba no sabe que esto existe.
// ═══════════════════════════════════════════════════════════════════════════

export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect } = React;
  const useRef = React.useRef || ((v) => ({ current: v }));
  const useMemo = React.useMemo || ((fn) => fn());

  const instanceId = shell.app && shell.app.instanceId;
  const teamId = shell.app && shell.app.teamId;

  function apiBase() {
    try {
      const raw = typeof shell.assetUrl === 'function' ? shell.assetUrl('x').split('/api/apps/')[0] : '';
      return new URL(raw || '/', globalThis.window ? window.location.href : 'http://localhost/').toString().replace(/\/$/, '');
    } catch (e) { return globalThis.window ? window.location.origin : ''; }
  }
  const API = apiBase();

  const notify = (level, text) => {
    try { if (typeof shell.notify === 'function') shell.notify({ level, text: s(text) }); } catch (e) { /* host sin toasts */ }
  };

  // ── Estado (uno por ventana: vive en el closure, nunca en el módulo) ────
  let model = migrate(emptyCampaign());
  let assets = [];      // items kind:'asset'  (AGENTE 11)
  let ledger = [];      // items kind:'cost'   (AGENTE 12)
  let ui = { view: 'dashboard', busy: false, sceneSel: null, formatSel: null, promptCap: 'video',
    platformSel: null, assetFilter: 'all', flowSel: null, ready: false, error: '',
    worldTab: 'areas', worldArea: null, worldStaff: null };

  // ── Tema ────────────────────────────────────────────────────────────────
  // El modo Vivo depende de la hora, así que se guarda la hora actual en el
  // estado y un temporizador la refresca: sin eso, la ventana se quedaría con
  // la luz del momento en que se abrió.
  let hourNow = new Date().getHours();
  const currentTheme = () => resolveTheme(obj(model.settings).theme, hourNow);
  const clockTimer = setInterval(() => {
    const h0 = new Date().getHours();
    if (h0 === hourNow) return;
    hourNow = h0;
    if (currentTheme().live) emit();      // solo repinta si de verdad afecta
  }, 60000);

  const listeners = new Set();
  const emit = () => { listeners.forEach((l) => { try { l({}); } catch (e) { /* componente desmontado */ } }); };

  let saveTimer = null;
  function scheduleSave() {
    if (typeof shell.saveData !== 'function') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      model.updatedAt = nowIso();
      Promise.resolve(shell.saveData({ campaign: model })).catch((e) => notify('error', 'No se pudo guardar: ' + ((e && e.message) || 'error')));
    }, 700);
  }

  /** Mutación central: UI y agente pasan siempre por aquí. */
  function commit(next, opts) {
    const o = obj(opts);
    if (next) model = next;
    if (!o.noSave) scheduleSave();
    emit();
    if (typeof shell.window === 'object' && shell.window && typeof shell.window.setTitle === 'function') {
      try { shell.window.setTitle('Kreative Studio — ' + s(model.title)); } catch (e) { /* opcional */ }
    }
  }
  function setUi(patch) { ui = Object.assign({}, ui, obj(patch)); emit(); }

  // ── Puerto de persistencia de assets y costes (shell.items) ────────────
  const hasItems = shell.items && typeof shell.items.list === 'function';

  async function loadItems() {
    if (!hasItems) return;
    try {
      const list = arr(await shell.items.list());
      // `kind` es el discriminador del item en la instancia; el tipo de medio
      // del asset viaja en `assetKind` para que no se pisen entre sí.
      assets = list.filter((x) => s(x.kind) === 'asset')
        .map((x) => normalizeAsset(Object.assign({}, x, { kind: s(x.assetKind) }), model));
      ledger = list.filter((x) => s(x.kind) === 'cost');
    } catch (e) { /* sin permiso o host reducido: la app sigue funcionando */ }
  }

  async function saveAsset(raw) {
    const a = normalizeAsset(raw, model);
    const item = Object.assign({}, a, { kind: 'asset', assetKind: a.kind });
    if (!hasItems) {
      const i = assets.findIndex((x) => x.id === a.id);
      if (i >= 0) assets[i] = a; else assets.push(a);
      syncJobs(true);
      emit();
      return a;
    }
    const exists = assets.some((x) => x.id === a.id);
    try {
      if (exists) await shell.items.update(a.id, item); else await shell.items.create(item);
      const i = assets.findIndex((x) => x.id === a.id);
      if (i >= 0) assets[i] = a; else assets.push(a);
      syncJobs(true);
      emit();
      return a;
    } catch (e) { throw new Error('No se pudo guardar el asset: ' + ((e && e.message) || 'error')); }
  }

  async function removeAsset(id) {
    const i = assets.findIndex((x) => x.id === s(id));
    if (i < 0) return false;
    if (hasItems) { try { await shell.items.remove(s(id)); } catch (e) { throw new Error('No se pudo borrar: ' + ((e && e.message) || 'error')); } }
    assets.splice(i, 1);
    syncJobs(true);
    emit();
    return true;
  }

  async function addCost(entry) {
    const e = obj(entry);
    const rec = {
      id: newId('cost'), kind: 'cost', at: nowIso(),
      providerId: s(e.providerId), jobId: s(e.jobId) || null, sceneId: s(e.sceneId) || null,
      amountUsd: round(num(e.amountUsd, 0), 4), tokens: num(e.tokens, 0), calls: Math.max(1, num(e.calls, 1)),
      seconds: round(num(e.seconds, 0), 2), images: num(e.images, 0), note: s(e.note),
    };
    if (hasItems) { try { await shell.items.create(rec); } catch (err) { /* se contabiliza en memoria igualmente */ } }
    ledger.push(rec);
    return rec;
  }

  // ── Puerto de catálogo (lectura de ProductLab vía shell.data) ──────────
  // Permiso `data.read:productlab`. El RBAC del usuario es siempre el techo:
  // solo se ven instancias de equipos a los que ya tiene acceso.
  const hasData = shell.data && typeof shell.data.listInstances === 'function';

  async function listCatalogs() {
    if (!hasData) return [];
    try { return arr(await shell.data.listInstances('productlab')); } catch (e) { return []; }
  }

  /** Productos de un catálogo de ProductLab, con su moneda y marca. */
  async function readCatalog(instanceId) {
    if (!hasData || typeof shell.data.listItems !== 'function') return null;
    const items = arr(await shell.data.listItems(s(instanceId)));
    const definition = items.find((x) => s(x.kind) === 'definition') || {};
    const rules = obj(definition.rules);
    return {
      instanceId: s(instanceId),
      currency: s(rules.currency) || 'USD',
      brandName: s(definition.brandName),
      storeName: s(definition.storeName),
      products: items.filter((x) => s(x.kind) === 'producto').map((p) => ({
        id: s(p.id), name: s(p.name), sku: s(p.sku), status: s(p.status),
        price: num(p.price, 0), raw: p,
      })),
    };
  }

  /**
   * Traduce un producto de ProductLab al brief de una campaña.
   * Se mapea lo que de verdad alimenta la creatividad: nombre, precio, fotos
   * y las especificaciones (que son los atributos reales del producto). Los
   * pasos configurables se anotan porque «personalizable» es un argumento de
   * venta, no un detalle técnico.
   */
  function productToBrief(product, catalog) {
    const p = obj(obj(product).raw || product);
    const cat = obj(catalog);
    const photos = uniq(arr(p.galleryImages).map(s).concat([s(obj(p.storeRef).imageUrl)])).filter(Boolean);
    const specs = arr(obj(p.storefront).specs)
      .map((x) => [s(x.label), s(x.value)].filter(Boolean).join(': '))
      .filter((x) => x.length > 2);
    const steps = arr(p.groups).map((g) => s(g.label)).filter(Boolean);
    return {
      productName: s(p.name),
      priceText: num(p.price, 0) ? String(num(p.price, 0)) : '',
      currency: s(cat.currency) || 'USD',
      usp: specs.slice(0, 8).map((x) => punct(x)).join(' '),
      extraNotes: [
        steps.length ? 'Personalizable en: ' + steps.join(', ') + '.' : '',
        s(p.sku) ? 'SKU ' + s(p.sku) + '.' : '',
        obj(p.model3d).enabled ? 'Tiene modelo 3D y vista AR en la tienda.' : '',
        s(cat.brandName) ? 'Marca: ' + s(cat.brandName) + '.' : '',
      ].filter(Boolean).join(' '),
      photos: photos.map((url, i) => ({ id: newId('photo'), url, caption: '', isHero: i === 0 })),
      sourceRef: { app: 'productlab', instanceId: s(cat.instanceId), itemId: s(p.id), sku: s(p.sku), at: nowIso() },
    };
  }

  /** Vuelca el producto en el brief conservando lo que el usuario ya escribió. */
  function applyProductToBrief(product, catalog, opts) {
    const o = obj(opts);
    const mapped = productToBrief(product, catalog);
    if (!s(mapped.productName).trim()) throw new Error('El producto no tiene nombre en ProductLab.');
    patch((m) => {
      const keep = !!o.keepExisting;
      m.brief.productName = mapped.productName;
      if (mapped.priceText && (!keep || !s(m.brief.priceText).trim())) m.brief.priceText = mapped.priceText;
      if (mapped.currency && (!keep || !s(m.brief.currency).trim())) m.brief.currency = mapped.currency;
      if (mapped.usp && (!keep || !s(m.brief.usp).trim())) m.brief.usp = mapped.usp;
      if (mapped.extraNotes && (!keep || !s(m.brief.extraNotes).trim())) m.brief.extraNotes = mapped.extraNotes;
      const known = new Set(arr(m.brief.photos).map((x) => x.url));
      for (const ph of mapped.photos) if (!known.has(ph.url)) m.brief.photos.push(ph);
      if (arr(m.brief.photos).length && !m.brief.photos.some((x) => x.isHero)) m.brief.photos[0].isHero = true;
      m.brief.sourceRef = mapped.sourceRef;
      if (!s(m.title).trim() || m.title === 'Nueva campaña') m.title = mapped.productName;
      logLine(m, 'success', 'Producto «' + mapped.productName + '» importado desde ProductLab ('
        + mapped.photos.length + ' foto(s), ' + (mapped.usp ? 'con' : 'sin') + ' especificaciones).');
    });
    return mapped;
  }

  // ── Puerto de archivos (subida al área pública de KIMOS) ───────────────
  async function uploadFile(file, folder) {
    if (typeof shell.authFetch !== 'function') throw new Error('authFetch no disponible en este host.');
    const maxMB = 64;
    if (file.size > maxMB * 1024 * 1024) throw new Error('máximo ' + maxMB + ' MB');
    const safe = s(file.name || 'archivo').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
    const path = 'imagenes/kreative-studio/' + (s(folder) ? slug(folder) + '/' : '')
      + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-' + safe;
    const fd = new FormData();
    fd.append('path', path);
    fd.append('file', file);
    const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(s(d.detail) || 'HTTP ' + res.status);
    }
    return API + '/api/public/files/' + path;
  }

  /** Descarga a fichero local (exportaciones). */
  function download(filename, content, mime) {
    try {
      const blob = new Blob([s(content)], { type: s(mime) || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = s(filename);
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('success', 'Descargado: ' + filename);
    } catch (e) { notify('error', 'No se pudo descargar: ' + ((e && e.message) || 'error')); }
  }
  function copyText(text, what) {
    const t = s(text);
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(() => notify('success', (s(what) || 'Texto') + ' copiado.'),
          () => notify('warn', 'No se pudo copiar al portapapeles.'));
        return;
      }
    } catch (e) { /* fallback abajo */ }
    notify('info', 'Copia manual:\n' + t.slice(0, 200));
  }

  // ── Operaciones de dominio expuestas a UI y agente ─────────────────────
  /**
   * Reconcilia el estado de los trabajos con los assets ya registrados. Se
   * llama tras el pipeline y tras cualquier cambio en la Biblioteca: si no,
   * regenerar la producción borraría el progreso real y la lista de
   * pendientes mentiría.
   */
  function syncJobs(silent) {
    if (!model.production) return;
    const before = arr(model.production.jobs).map((j) => j.status + j.id).join('|');
    const next = JSON.parse(JSON.stringify(model));
    reconcileJobs(next, assets);
    const after = arr(next.production.jobs).map((j) => j.status + j.id).join('|');
    if (before !== after) commit(next, silent ? { noSave: false } : undefined);
  }

  function runStages(only, label) {
    const res = runPipeline(model, { only, ledger });
    reconcileJobs(res.campaign, assets);
    commit(res.campaign);
    const errs = res.run.stages.filter((x) => x.status === 'error');
    if (errs.length) notify('error', 'Fallaron ' + errs.length + ' etapa(s): ' + errs.map((x) => x.name).join(', '));
    else notify('success', (s(label) || 'Pipeline') + ' completado en ' + res.run.ms + ' ms.');
    return res.run;
  }

  function generateAll(intentText) {
    setUi({ busy: true });
    try {
      const res = generateCampaign(model, intentText, { ledger });
      reconcileJobs(res.campaign, assets);
      commit(res.campaign);
      const errs = res.run.stages.filter((x) => x.status === 'error');
      if (errs.length) notify('warn', 'Campaña generada con ' + errs.length + ' aviso(s).');
      else notify('success', 'Campaña completa generada en ' + res.run.ms + ' ms.');
      setUi({ busy: false, view: 'dashboard' });
      return res.run;
    } catch (e) {
      setUi({ busy: false });
      notify('error', 'Error al generar: ' + ((e && e.message) || 'desconocido'));
      return null;
    }
  }

  function patch(fn, opts) {
    const next = JSON.parse(JSON.stringify(model));
    fn(next);
    next.updatedAt = nowIso();
    commit(next, opts);
    return next;
  }

  /**
   * Aplica una mutación del mapa de la organización (WorldSkin).
   *
   * Las mutaciones del paquete no lanzan: devuelven `{ world, ok, error }`.
   * Aquí se traduce eso a la interfaz —guardar y avisar, o solo avisar— para
   * que un dato imposible (un área que no cabe, un mapa que se encogería sobre
   * un departamento) no deje el documento a medias.
   */
  function applyWorld(fn, opts) {
    const o = obj(opts);
    let r = null;
    try { r = fn(model.world); } catch (e) { r = { ok: false, error: (e && e.message) || 'error inesperado' }; }
    if (!r || !r.ok) { notify('error', s(r && r.error) || 'No se pudo cambiar el mapa.'); return false; }
    patch((m) => { m.world = r.world; logLine(m, 'info', 'Organización · ' + s(r.message)); });
    if (!o.quiet) notify('success', s(r.message));
    return true;
  }

  /** Vuelve a ejecutar las etapas que dependen de lo que acaba de cambiar. */
  function refreshFrom(stageId) {
    const idx = PIPELINE_ORDER.indexOf(s(stageId));
    if (idx < 0) return;
    const only = PIPELINE_ORDER.slice(idx).filter((id) => {
      const a = agentById(id);
      return a && arr(a.requires).every((k) => model[k] || a.writes === k);
    });
    if (only.length) runStages(only, 'Actualización');
  }

  function createVersion(label) {
    const snapshot = JSON.parse(JSON.stringify(model));
    delete snapshot.versions;
    delete snapshot.log;
    const v = { id: newId('ver'), label: s(label) || ('Versión ' + (arr(model.versions).length + 1)),
      at: nowIso(), summary: summarize(model), snapshot };
    patch((m) => { m.versions = arr(m.versions).concat([v]).slice(-VERSIONS_MAX); logLine(m, 'info', 'Versión guardada: ' + v.label); });
    notify('success', 'Versión guardada: ' + v.label);
    return v;
  }

  function restoreVersion(id) {
    const v = arr(model.versions).find((x) => x.id === s(id));
    if (!v) return false;
    const keepVersions = arr(model.versions);
    const keepLog = arr(model.log);
    const restored = migrate(Object.assign({}, v.snapshot, { versions: keepVersions, log: keepLog }));
    logLine(restored, 'info', 'Restaurada la versión «' + v.label + '».');
    commit(restored);
    notify('success', 'Versión restaurada: ' + v.label);
    return true;
  }

  // ── Carga inicial ──────────────────────────────────────────────────────
  let cancelled = false;
  (async function boot() {
    try {
      const data = typeof shell.loadData === 'function' ? await shell.loadData() : null;
      if (cancelled) return;
      if (data && data.campaign) model = migrate(data.campaign);
      else if (data && data.brief) model = migrate(data);
      await loadItems();
      if (cancelled) return;
      reconcileJobs(model, assets);
      // Campaña recién creada: se abre por la Guía. Quien ya tiene trabajo
      // hecho entra directo al Panel, que es lo que espera.
      const virgin = !s(model.brief.productName).trim() && !model.concept && !arr(model.brief.photos).length;
      setUi({ ready: true, view: virgin ? 'guide' : 'dashboard' });
      commit(null, { noSave: true });
    } catch (e) {
      if (!cancelled) { setUi({ ready: true, error: (e && e.message) || 'error de carga' }); }
    }
  })();

  // ── Config (⚙️) y Documentos (🗂️) de AppShell v2 ───────────────────────
  let offConfig = null; let offSerialize = null; let offLoad = null;
  function applySettings(cfg) {
    const c0 = obj(cfg);
    const next = JSON.parse(JSON.stringify(model));
    let touched = false;
    if (isHex(c0.accent)) { next.brand.palette.secondary = s(c0.accent).trim(); touched = true; }
    if (c0.defaultStyle && STYLES.some((x) => x.id === c0.defaultStyle) && !next.concept) { next.styleId = s(c0.defaultStyle); touched = true; }
    if (c0.currency && s(c0.currency).trim()) { next.settings.currency = s(c0.currency).trim().toUpperCase(); touched = true; }
    if (typeof c0.autoSubtitles === 'boolean') { next.settings.subtitles = c0.autoSubtitles; touched = true; }
    if (num(c0.heroDuration, 0) > 0) { next.settings.heroDurationSec = clamp(num(c0.heroDuration, 30), 5, 180); touched = true; }
    if (touched) commit(next);
  }
  try {
    if (shell.config && typeof shell.config.get === 'function') {
      Promise.resolve(shell.config.get()).then((cfg) => { if (!cancelled) applySettings(cfg); }).catch(() => {});
      if (typeof shell.config.onChange === 'function') offConfig = shell.config.onChange(applySettings);
    }
    if (shell.documents) {
      if (typeof shell.documents.onSerialize === 'function') offSerialize = shell.documents.onSerialize(() => ({ campaign: model }));
      if (typeof shell.documents.onLoad === 'function') {
        offLoad = shell.documents.onLoad((doc) => {
          const d = obj(doc);
          if (d.campaign) { model = migrate(d.campaign); commit(null, { noSave: true }); notify('info', 'Documento cargado.'); }
        });
      }
    }
  } catch (e) { /* host AppShell v1: capacidades opcionales ausentes */ }

  // ═════════════════════════════════════════════════════════════════════════
  // ORQUESTACIÓN POR KIMOS · shell.agent.register
  // El agente de la empresa es el director de orquesta: puede crear la
  // campaña entera desde una frase, ejecutar agentes sueltos, cambiar de
  // proveedor, editar escenas, registrar los assets que él mismo genera con
  // sus MCP (Higgsfield, etc.) y liquidar el coste real.
  // ═════════════════════════════════════════════════════════════════════════
  let unregisterAgent = null;

  const AGENT_TOOLS = [
    { name: 'GENERATE_CAMPAIGN',
      description: 'Genera una campaña COMPLETA desde una intención en lenguaje natural ("crea una campaña premium", "quiero un comercial épico", "véndelo para deportistas"). Interpreta estilo, objetivo y público, y ejecuta los 12 agentes. Es la acción principal de la app.',
      inputSchema: { type: 'object', properties: {
        intent: { type: 'string', description: 'Intención en lenguaje natural.' },
        productName: { type: 'string', description: 'Nombre del producto (opcional si ya está en el brief).' },
        usp: { type: 'string', description: 'Ventaja principal / propuesta de valor.' },
        photos: { type: 'array', items: { type: 'string' }, description: 'URLs o paths del storage del equipo con fotos del producto.' },
      }, required: ['intent'] } },
    { name: 'SET_BRIEF',
      description: 'Actualiza los datos del brief (producto, categoría, precio, USP, público, presupuesto, mercado, idioma, notas).',
      inputSchema: { type: 'object', properties: {
        productName: { type: 'string' }, category: { type: 'string' }, priceText: { type: 'string' },
        currency: { type: 'string' }, usp: { type: 'string' }, audienceHint: { type: 'string' },
        budget: { type: 'number' }, marketRegion: { type: 'string' }, language: { type: 'string' },
        competitorsText: { type: 'string' }, mandatories: { type: 'string' }, legal: { type: 'string' },
        extraNotes: { type: 'string' }, title: { type: 'string' },
      } } },
    { name: 'ADD_PRODUCT_PHOTO',
      description: 'Añade una foto del producto al brief. Acepta un adjunto del chat (path del File Storage del equipo), una ruta /api/… de KIMOS o una URL http(s) pública. Es lo que ancla la forma real del producto en todos los prompts.',
      inputSchema: { type: 'object', properties: {
        url: { type: 'string', description: 'path del storage, ruta /api/… o URL http(s).' },
        caption: { type: 'string' }, isHero: { type: 'boolean', description: 'Marcarla como toma principal.' },
      }, required: ['url'] } },
    { name: 'LIST_CATALOG',
      description: 'Lista los catálogos de ProductLab visibles y sus productos, para importar uno al brief sin volver a teclear nombre, precio, especificaciones y fotos.',
      inputSchema: { type: 'object', properties: {
        instanceId: { type: 'string', description: 'Catálogo concreto; vacío = lista todos.' },
        query: { type: 'string', description: 'Filtra por nombre o SKU.' },
      } } },
    { name: 'IMPORT_PRODUCT',
      description: 'Importa un producto de ProductLab al brief: nombre, precio, moneda, especificaciones (pasan a ser la propuesta de valor), pasos configurables y todas las fotos de la galería. Opcionalmente genera la campaña acto seguido.',
      inputSchema: { type: 'object', properties: {
        product: { type: 'string', description: 'Nombre, SKU o id del producto.' },
        instanceId: { type: 'string', description: 'Catálogo; vacío = se busca en todos.' },
        keepExisting: { type: 'boolean', description: 'No pisar los campos del brief que ya tengan contenido.' },
        intent: { type: 'string', description: 'Si se indica, genera la campaña completa con esta intención tras importar.' },
      }, required: ['product'] } },
    { name: 'RUN_PRODUCTION',
      description: 'PUNTO DE ENTRADA DE LA PRODUCCIÓN. Devuelve el siguiente lote de material que toca generar AHORA (respetando dependencias: primero los keyframes, luego las tomas que parten de ellos), cada uno con su proveedor, prompt, parámetros, imágenes de referencia y el archivo de destino. Genera cada elemento del lote con el modelo indicado y devuelve los resultados en UNA llamada a REGISTER_ASSETS. Repite hasta que `listo` sea true; entonces exporta render_bundle y ya tienes el vídeo.',
      inputSchema: { type: 'object', properties: {
        limit: { type: 'number', description: 'Máximo de elementos del lote (por defecto 12).' },
        kind: { type: 'string', description: 'Restringe a image, video, voice, music o sfx.' },
      } } },
    { name: 'REGISTER_ASSETS',
      description: 'Registra VARIOS resultados generados de una vez. Cada entrada cierra su trabajo, versiona el archivo por escena y contabiliza el coste real. Es la forma normal de devolver un lote de RUN_PRODUCTION.',
      inputSchema: { type: 'object', properties: {
        assets: { type: 'array', description: 'Lista de resultados.', items: { type: 'object', properties: {
          jobId: { type: 'string', description: 'Id del trabajo que cierra (lo da RUN_PRODUCTION).' },
          url: { type: 'string' }, kind: { type: 'string' }, sceneId: { type: 'string' },
          providerId: { type: 'string' }, costUsd: { type: 'number' }, durationSec: { type: 'number' },
          tokens: { type: 'number' }, note: { type: 'string' },
        }, required: ['url'] } },
      }, required: ['assets'] } },
    { name: 'SET_WORKFLOW',
      description: 'Edita el flujo de agentes: reordena y activa o desactiva agentes. Un agente no puede ir antes de aquel del que depende; si el orden lo rompe, se corrige a la posición válida más cercana. Un agente desactivado se salta, y los que dependían de él quedan bloqueados con el motivo.',
      inputSchema: { type: 'object', properties: {
        order: { type: 'array', items: { type: 'string' }, description: 'Orden deseado (parcial vale). IDs: ' + PIPELINE_ORDER.join(', ') },
        disable: { type: 'array', items: { type: 'string' }, description: 'Agentes a desactivar.' },
        enable: { type: 'array', items: { type: 'string' }, description: 'Agentes a reactivar.' },
        reset: { type: 'boolean', description: 'Volver al orden de fábrica con todos activos.' },
      } } },
    { name: 'SET_THEME',
      description: 'Cambia el aspecto de la interfaz. Forma «classic» con modos day, sunset, night o live (sigue la hora); forma «game» con modos kimoslab, jabotel o spacecraft. Es solo presentación: no toca los datos ni el resultado de los agentes.',
      inputSchema: { type: 'object', properties: {
        form: { type: 'string', description: 'classic | game' },
        classicMode: { type: 'string', description: 'day | sunset | night | live' },
        gameMode: { type: 'string', description: 'kimoslab | jabotel | spacecraft' },
      } } },
    { name: 'SET_ORG',
      description: 'Edita el mapa de la organización que se recorre en la vista Organización: áreas (departamentos), '
        + 'puestos (procesos internos de cada departamento) y personal (personas y agentes de IA). '
        + 'Es el mismo mapa en las cuatro ambientaciones: cambiar el aspecto no lo modifica. '
        + 'Los agentes del flujo ya están dentro como personal de IA; para apagarlos usa SET_WORKFLOW, no borres su avatar.',
      inputSchema: { type: 'object', properties: {
        op: { type: 'string', description: 'add_area | update_area | remove_area | add_station | update_station '
          + '| remove_station | add_staff | update_staff | remove_staff | resize | reseed' },
        areaId: { type: 'string', description: 'Id o nombre del área.' },
        stationId: { type: 'string', description: 'Id o nombre del puesto.' },
        staffId: { type: 'string', description: 'Id o nombre de la persona/agente.' },
        name: { type: 'string' },
        departmentId: { type: 'string', description: 'Uno de: ' + WS_DEPARTMENTS.map((d) => d.id).join(', ') },
        structure: { type: 'string', description: 'Uno de: ' + WS_STRUCTURES.map((x) => x.id).join(', ') },
        process: { type: 'string', description: 'Qué se hace en ese puesto.' },
        role: { type: 'string', description: 'Rol de la persona.' },
        kind: { type: 'string', description: 'human | ai' },
        note: { type: 'string' },
        x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
        gridW: { type: 'number' }, gridH: { type: 'number' },
      }, required: ['op'] } },
    { name: 'RUN_AGENT',
      description: 'Ejecuta un agente concreto y sus dependencias. IDs: ' + AGENTS.map((a) => a.id).join(', ') + '.',
      inputSchema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] } },
    { name: 'RUN_PIPELINE',
      description: 'Ejecuta el pipeline completo con la configuración actual, sin reinterpretar la intención. Útil tras cambiar estilo, proveedores o duración.',
      inputSchema: { type: 'object', properties: { only: { type: 'array', items: { type: 'string' }, description: 'IDs de agente a ejecutar; vacío = todos.' } } } },
    { name: 'SET_DIRECTION',
      description: 'Cambia estilo, objetivo, público o categoría y regenera lo que dependa de ello.',
      inputSchema: { type: 'object', properties: {
        styleId: { type: 'string', description: 'Uno de: ' + STYLES.map((x) => x.id).join(', ') },
        objectiveId: { type: 'string', description: 'Uno de: ' + OBJECTIVES.map((x) => x.id).join(', ') },
        audienceId: { type: 'string', description: 'Uno de: ' + AUDIENCES.map((x) => x.id).join(', ') },
        categoryId: { type: 'string', description: 'Uno de: ' + CATEGORIES.map((x) => x.id).join(', ') },
        regenerate: { type: 'boolean', description: 'Volver a ejecutar el pipeline (por defecto true).' },
      } } },
    { name: 'SET_PROVIDER',
      description: 'Cambia el proveedor de IA de una capacidad (image, video, voice, music, sfx, text) y reescribe los prompts a su dialecto. Demuestra la modularidad: no toca nada más.',
      inputSchema: { type: 'object', properties: {
        capability: { type: 'string', description: 'image | video | voice | music | sfx | text' },
        providerId: { type: 'string', description: 'ID del proveedor registrado.' },
        params: { type: 'object', description: 'Parámetros específicos del proveedor.' },
      }, required: ['capability', 'providerId'] } },
    { name: 'SET_SETTINGS',
      description: 'Ajusta duraciones, número de variantes, fps, subtítulos y formatos/plataformas de exportación.',
      inputSchema: { type: 'object', properties: {
        heroDurationSec: { type: 'number' }, shortDurationSec: { type: 'number' }, variantCount: { type: 'number' },
        fps: { type: 'number' }, subtitles: { type: 'boolean' },
        aspects: { type: 'array', items: { type: 'string' }, description: 'De: ' + ASPECTS.map((x) => x.id).join(', ') },
        resolutions: { type: 'array', items: { type: 'string' }, description: 'De: ' + RESOLUTIONS.map((x) => x.id).join(', ') },
        platforms: { type: 'array', items: { type: 'string' }, description: 'De: ' + PLATFORMS.map((x) => x.id).join(', ') },
      } } },
    { name: 'SET_BRAND',
      description: 'Define la identidad de marca: paleta, tipografías, logotipo, tono, eslogan, términos prohibidos y bloqueos de producto/personaje.',
      inputSchema: { type: 'object', properties: {
        primary: { type: 'string' }, secondary: { type: 'string' }, accent: { type: 'string' },
        dark: { type: 'string' }, light: { type: 'string' },
        display: { type: 'string' }, body: { type: 'string' },
        logoUrl: { type: 'string' }, tone: { type: 'string' }, slogan: { type: 'string' },
        forbidden: { type: 'array', items: { type: 'string' } },
        productLock: { type: 'string' }, characterLock: { type: 'string' },
      } } },
    { name: 'UPDATE_SCENE',
      description: 'Edita una escena del storyboard (por id o código SCxx): duración, encuadre, ángulo, óptica, movimiento, luz, color, efectos, texto en pantalla o descripción. Recalcula tiempos y avisa a edición.',
      inputSchema: { type: 'object', properties: {
        sceneId: { type: 'string', description: 'id o código (SC01).' },
        durationSec: { type: 'number' }, shot: { type: 'string' }, angle: { type: 'string' }, lens: { type: 'string' },
        move: { type: 'string' }, lighting: { type: 'string' }, grade: { type: 'string' },
        fx: { type: 'array', items: { type: 'string' } }, onScreenText: { type: 'string' },
        description: { type: 'string' }, transitionIn: { type: 'string' }, notes: { type: 'string' },
      }, required: ['sceneId'] } },
    { name: 'ADD_SCENE',
      description: 'Inserta una escena nueva en el storyboard.',
      inputSchema: { type: 'object', properties: {
        role: { type: 'string', description: 'hook, problem, reveal, demo, detail, proof, money o cta.' },
        afterCode: { type: 'string', description: 'Código de la escena tras la que insertar (vacío = al final).' },
        durationSec: { type: 'number' }, description: { type: 'string' }, onScreenText: { type: 'string' },
      }, required: ['role'] } },
    { name: 'REMOVE_SCENE',
      description: 'Elimina una escena del storyboard por id o código.',
      inputSchema: { type: 'object', properties: { sceneId: { type: 'string' } }, required: ['sceneId'] } },
    { name: 'GET_PROMPTS',
      description: 'Devuelve los prompts listos para ejecutar. Filtrable por tipo (image/video), escena y proveedor. Úsalo para generar de verdad con tus MCP (Higgsfield, etc.).',
      inputSchema: { type: 'object', properties: {
        kind: { type: 'string', description: 'image | video | voice | music' },
        sceneId: { type: 'string' }, providerId: { type: 'string', description: 'Reescribe al dialecto de ese proveedor sin cambiar los ajustes.' },
        limit: { type: 'number' },
      } } },
    { name: 'GET_JOBS',
      description: 'Lista los trabajos de producción pendientes con su prompt, parámetros y coste estimado.',
      inputSchema: { type: 'object', properties: { status: { type: 'string' }, kind: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'REGISTER_ASSET',
      description: 'Registra un archivo generado (imagen, vídeo o audio) y lo asocia a su escena y trabajo. Marca el trabajo como completado y contabiliza el coste REAL. Este es el paso que cierra el ciclo tras generar con un modelo.',
      inputSchema: { type: 'object', properties: {
        url: { type: 'string' }, kind: { type: 'string', description: 'image | video | audio | document | logo | reference' },
        sceneId: { type: 'string', description: 'id o código de escena.' },
        jobId: { type: 'string' }, providerId: { type: 'string' },
        costUsd: { type: 'number' }, durationSec: { type: 'number' }, tokens: { type: 'number' },
        name: { type: 'string' }, note: { type: 'string' }, approved: { type: 'boolean' },
      }, required: ['url'] } },
    { name: 'LIST_ASSETS',
      description: 'Lista los assets registrados de la campaña, con su escena, proveedor, versión y coste.',
      inputSchema: { type: 'object', properties: { kind: { type: 'string' }, sceneId: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'SET_JOB_STATUS',
      description: 'Cambia el estado de un trabajo de producción (pending, running, done, failed, skipped).',
      inputSchema: { type: 'object', properties: { jobId: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['jobId', 'status'] } },
    { name: 'ADD_COST',
      description: 'Registra consumo real de un proveedor (coste, tokens, segundos o imágenes) para la analítica.',
      inputSchema: { type: 'object', properties: {
        providerId: { type: 'string' }, amountUsd: { type: 'number' }, tokens: { type: 'number' },
        seconds: { type: 'number' }, images: { type: 'number' }, note: { type: 'string' },
      }, required: ['providerId'] } },
    { name: 'GET_COPY',
      description: 'Devuelve el copy generado: anuncios por plataforma, landing y secuencia de email.',
      inputSchema: { type: 'object', properties: { platform: { type: 'string' }, section: { type: 'string', description: 'ads | landing | emails | hooks' } } } },
    { name: 'EXPORT',
      description: 'Devuelve un entregable como texto. `render_bundle` es el importante: un único script que descarga todos los assets registrados en su sitio, une las tomas partidas, escribe los subtítulos y ejecuta FFmpeg hasta los entregables finales. Opciones: bible, render_bundle, assets_manifest, ffmpeg, srt, edl, prompts_csv, copy_csv, jobs_csv, json.',
      inputSchema: { type: 'object', properties: { what: { type: 'string' } }, required: ['what'] } },
    { name: 'CREATE_VERSION',
      description: 'Guarda una versión con etiqueta del estado actual de la campaña.',
      inputSchema: { type: 'object', properties: { label: { type: 'string' } } } },
    { name: 'RESTORE_VERSION',
      description: 'Restaura una versión guardada por id.',
      inputSchema: { type: 'object', properties: { versionId: { type: 'string' } }, required: ['versionId'] } },
    { name: 'REGISTER_PROVIDER',
      description: 'Da de alta un proveedor de IA nuevo en caliente sin tocar el núcleo. Se define su dialecto con una plantilla de texto donde {{campo}} se sustituye por el PromptSpec.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'string' }, label: { type: 'string' }, vendor: { type: 'string' },
        capability: { type: 'string', description: 'image | video | voice | music | sfx | text' },
        template: { type: 'string', description: 'Plantilla con {{subject}}, {{action}}, {{environment}}, {{shot}}, {{lens}}, {{lighting}}, {{grade}}, {{move}}, {{fx}}, {{style}}, {{palette}}, {{aspect}}, {{duration}}.' },
        aspects: { type: 'array', items: { type: 'string' } },
        maxSec: { type: 'number' }, costPerUnit: { type: 'number' },
        costUnit: { type: 'string', description: 'image | second | char | call | ktoken' },
        negative: { type: 'boolean' }, docs: { type: 'string' },
      }, required: ['id', 'capability', 'template'] } },
  ];

  /** Resuelve una escena por id o por código (SC01), tolerante a mayúsculas. */
  function findScene(ref) {
    const t = norm(ref);
    const scenes = arr(obj(model.storyboard).scenes);
    return scenes.find((x) => norm(x.id) === t) || scenes.find((x) => norm(x.code) === t)
      || scenes.find((x) => norm(x.code) === 'sc' + t.replace(/^sc/, '').padStart(2, '0')) || null;
  }

  /** Normaliza una URL de entrada (adjunto del chat, ruta interna o externa). */
  function resolveUrl(raw) {
    let u = s(raw).trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.indexOf('/') === 0) return API + u;
    if (!teamId) return u;
    return API + '/api/storage/teams/' + teamId + '/files/download?path=' + encodeURIComponent(u.replace(/^\/+/, ''));
  }

  /** Recalcula los tiempos de inicio tras editar duraciones. */
  function retime(scenes) {
    let t = 0;
    for (const sc of arr(scenes)) {
      sc.startSec = round(t, 2);
      sc.durationSec = round(clamp(num(sc.durationSec, 2), 0.3, 60), 2);
      t = round(t + sc.durationSec, 2);
    }
    return round(t, 2);
  }

  async function dispatch(action) {
    const a = obj(action);
    const type = s(a.type).toUpperCase();
    const p = obj(a.payload);
    try {
      // ── Generación completa ─────────────────────────────────────────────
      if (type === 'GENERATE_CAMPAIGN') {
        const intent = s(p.intent).trim();
        if (!intent) return { success: false, error: 'Indica `intent` (la frase con lo que quieres).' };
        const next = JSON.parse(JSON.stringify(model));
        if (s(p.productName).trim()) next.brief.productName = s(p.productName).trim();
        if (s(p.usp).trim()) next.brief.usp = s(p.usp).trim();
        for (const u of arr(p.photos)) {
          const url = resolveUrl(u);
          if (url && !next.brief.photos.some((x) => x.url === url)) {
            next.brief.photos.push({ id: newId('photo'), url, caption: '', isHero: next.brief.photos.length === 0 });
          }
        }
        if (!s(next.brief.productName).trim()) return { success: false, error: 'Falta el nombre del producto: pásalo en `productName` o llama antes a SET_BRIEF.' };
        model = next;
        const run = generateAll(intent);
        if (!run) return { success: false, error: 'La generación falló; revisa el registro de la app.' };
        const sm = summarize(model);
        return { success: true, message: 'Campaña «' + model.title + '» generada: ' + sm.escenas + ' escenas ('
          + sm.duracionSeg + ' s), ' + arr(obj(model.prompts).image).length + ' prompts de imagen, '
          + arr(obj(model.prompts).video).length + ' de vídeo, ' + arr(obj(model.copy).ads).length + ' anuncios y '
          + arr(obj(model.edit).exports).length + ' entregables. Coste de producción estimado: '
          + fmtMoney(num(obj(obj(model.production).totals).cost, 0), 'USD') + '. Usa GET_JOBS para ejecutar la producción.' };
      }

      if (type === 'SET_BRIEF') {
        const fields = ['productName', 'category', 'priceText', 'currency', 'usp', 'audienceHint',
          'marketRegion', 'language', 'competitorsText', 'mandatories', 'legal', 'extraNotes'];
        const touched = [];
        patch((m) => {
          for (const f of fields) if (p[f] !== undefined) { m.brief[f] = s(p[f]); touched.push(f); }
          if (p.budget !== undefined) { m.brief.budget = Math.max(0, num(p.budget, 0)); touched.push('budget'); }
          if (s(p.title).trim()) { m.title = s(p.title).trim(); touched.push('title'); }
          if (touched.indexOf('productName') >= 0 && (!s(m.title).trim() || m.title === 'Nueva campaña')) m.title = s(m.brief.productName);
          logLine(m, 'info', 'Brief actualizado por el agente: ' + touched.join(', ') + '.');
        });
        if (!touched.length) return { success: false, error: 'No se indicó ningún campo del brief.' };
        return { success: true, message: 'Brief actualizado (' + touched.join(', ') + '). Ejecuta RUN_PIPELINE para propagar los cambios.' };
      }

      if (type === 'ADD_PRODUCT_PHOTO') {
        const url = resolveUrl(p.url);
        if (!url) return { success: false, error: 'Indica `url` (adjunto del chat, ruta /api/… o URL http(s)).' };
        let dup = false;
        patch((m) => {
          if (m.brief.photos.some((x) => x.url === url)) { dup = true; return; }
          m.brief.photos.push({ id: newId('photo'), url, caption: s(p.caption),
            isHero: p.isHero === true || m.brief.photos.length === 0 });
          if (p.isHero === true) m.brief.photos.forEach((x) => { x.isHero = x.url === url; });
          logLine(m, 'info', 'Foto de producto añadida.');
        });
        if (dup) return { success: true, message: 'Esa foto ya estaba en el brief.' };
        return { success: true, message: 'Foto añadida (' + arr(model.brief.photos).length + ' en total). Se usará como referencia en todos los prompts.' };
      }

      // ── Catálogo de ProductLab ──────────────────────────────────────────
      if (type === 'LIST_CATALOG') {
        if (!hasData) return { success: false, error: 'Este host no expone shell.data, o la app no tiene el permiso data.read:productlab aprobado.' };
        const insts = await listCatalogs();
        if (!insts.length) return { success: true, message: 'No hay catálogos de ProductLab visibles para este usuario.', data: [] };
        const only = s(p.instanceId).trim();
        const q = norm(p.query);
        const out = [];
        for (const inst of insts) {
          if (only && s(inst.id) !== only) continue;
          const cat = await readCatalog(inst.id);
          if (!cat) continue;
          const prods = cat.products.filter((x) => !q || norm(x.name).indexOf(q) >= 0 || norm(x.sku).indexOf(q) >= 0);
          out.push({ catalogo: s(inst.name) || s(inst.id), instanceId: s(inst.id), moneda: cat.currency,
            productos: prods.map((x) => ({ id: x.id, nombre: x.name, sku: x.sku, precio: x.price, estado: x.status })) });
        }
        const total = out.reduce((a, x) => a + x.productos.length, 0);
        return { success: true, message: total + ' producto(s) en ' + out.length + ' catálogo(s). Impórtalo con IMPORT_PRODUCT.', data: out };
      }

      if (type === 'IMPORT_PRODUCT') {
        if (!hasData) return { success: false, error: 'Este host no expone shell.data, o falta el permiso data.read:productlab.' };
        const ref = norm(p.product);
        if (!ref) return { success: false, error: 'Indica `product` (nombre, SKU o id).' };
        const insts = await listCatalogs();
        const only = s(p.instanceId).trim();
        let found = null; let cat = null;
        for (const inst of insts) {
          if (only && s(inst.id) !== only) continue;
          const c0 = await readCatalog(inst.id);
          if (!c0) continue;
          const hit = c0.products.find((x) => norm(x.id) === ref)
            || c0.products.find((x) => norm(x.sku) === ref)
            || c0.products.find((x) => norm(x.name) === ref)
            || c0.products.find((x) => norm(x.name).indexOf(ref) >= 0);
          if (hit) { found = hit; cat = c0; break; }
        }
        if (!found) return { success: false, error: 'No se encontró «' + s(p.product) + '». Usa LIST_CATALOG para ver los productos disponibles.' };
        let mapped;
        try { mapped = applyProductToBrief(found, cat, { keepExisting: !!p.keepExisting }); }
        catch (e) { return { success: false, error: (e && e.message) || 'no se pudo importar' }; }
        const base = 'Importado «' + mapped.productName + '» desde ProductLab: ' + arr(mapped.photos).length
          + ' foto(s)' + (mapped.usp ? ', ' + mapped.usp.split('.').filter(Boolean).length + ' especificación(es)' : '')
          + (mapped.priceText ? ', precio ' + mapped.priceText + ' ' + mapped.currency : '') + '.';
        if (s(p.intent).trim()) {
          const run = generateAll(s(p.intent));
          if (!run) return { success: false, error: base + ' Pero la generación falló.' };
          return { success: true, message: base + ' Campaña generada: ' + summarize(model).escenas + ' escenas. Usa RUN_PRODUCTION para producir el material.' };
        }
        return { success: true, message: base + ' Ejecuta GENERATE_CAMPAIGN con la intención creativa que quieras.' };
      }

      // ── Producción por lotes ────────────────────────────────────────────
      if (type === 'RUN_PRODUCTION') {
        if (!model.production) return { success: false, error: 'Aún no hay producción: ejecuta GENERATE_CAMPAIGN primero.' };
        syncJobs();
        const jobs = arr(model.production.jobs);
        const limit = clamp(num(p.limit, 12), 1, 40);
        let batch = readyJobs(model, 0);
        if (s(p.kind)) batch = batch.filter((j) => j.kind === norm(p.kind));
        batch = batch.slice(0, limit);
        const pending = jobs.filter((j) => j.status === 'pending');
        const done = jobs.filter((j) => j.status === 'done').length;
        const failed = jobs.filter((j) => j.status === 'failed');
        const byKind = {};
        for (const j of pending) byKind[j.kind] = (byKind[j.kind] || 0) + 1;
        const ready = pending.length === 0;

        if (ready) {
          return { success: true,
            message: 'Producción completa: ' + done + '/' + jobs.length + ' trabajos con su archivo registrado'
              + (failed.length ? ' (' + failed.length + ' marcados como fallidos)' : '')
              + '. Exporta `render_bundle` y ejecútalo: descarga todo, une las tomas partidas y renderiza los '
              + arr(obj(model.edit).exports).length + ' entregables.',
            data: { listo: true, completados: done, total: jobs.length, siguienteLote: [] } };
        }

        const refs = refImagesOf(model, 3);
        const lote = batch.map((j) => {
          const scene = arr(obj(model.storyboard).scenes).find((x) => x.id === j.sceneId);
          // La referencia de una toma es el keyframe YA REGISTRADO de su
          // escena. Se busca por el trabajo que lo produjo, no por escena +
          // tipo: así nunca discrepa de lo que dice reconcileJobs.
          const kfJob = j.stage === 'shot'
            ? arr(obj(model.production).jobs).find((x) => x.stage === 'keyframe' && x.sceneId === j.sceneId) : null;
          const keyframe = kfJob && kfJob.assetId ? assets.find((a) => a.id === kfJob.assetId) : null;
          return {
            jobId: j.id, tipo: j.kind, etapa: j.stage, escena: j.code,
            proveedor: j.providerId, proveedorNombre: j.providerLabel,
            prompt: j.prompt, negativo: j.negative || undefined, parametros: j.params,
            // Referencias visuales: el keyframe manda sobre las fotos del brief
            // en las tomas de vídeo, porque es lo que fija la continuidad.
            imagenReferencia: keyframe ? keyframe.url : (j.kind === 'image' ? refs : undefined),
            duracionSeg: scene && j.kind === 'video' ? num(j.qty.durationSec, scene.durationSec) : undefined,
            archivoDestino: j.file,
            costeEstimadoUsd: j.estCostUsd,
          };
        });

        return { success: true,
          message: lote.length + ' elemento(s) que generar ahora (' + done + '/' + jobs.length + ' hechos). '
            + 'Genera cada uno con su proveedor y devuélvelos TODOS en una sola llamada a REGISTER_ASSETS '
            + '(pasa el `jobId` de cada uno). Luego vuelve a llamar a RUN_PRODUCTION.',
          data: {
            listo: false, completados: done, total: jobs.length,
            pendientesPorTipo: byKind,
            siguienteLote: lote,
            instrucciones: 'Sube cada archivo generado a una URL accesible y pásala en `url`. '
              + 'Si un elemento falla dos veces, márcalo con SET_JOB_STATUS failed y sigue con el resto.',
          } };
      }

      if (type === 'REGISTER_ASSETS') {
        const list = arr(p.assets);
        if (!list.length) return { success: false, error: 'Indica `assets` con al menos un resultado.' };
        const okIds = []; const errs = [];
        let costTotal = 0;
        for (const raw of list) {
          const a0 = obj(raw);
          const url = resolveUrl(a0.url);
          if (!url) { errs.push('entrada sin url'); continue; }
          const job = s(a0.jobId) ? arr(obj(model.production).jobs).find((x) => x.id === s(a0.jobId)) : null;
          const sceneRef = job ? job.sceneId : (s(a0.sceneId) ? (findScene(a0.sceneId) || {}).id : null);
          const code = job ? job.code : (findScene(a0.sceneId) || {}).code;
          const kind = s(a0.kind) || (job ? (JOB_MEDIA[job.kind] || guessKind(url)) : guessKind(url));
          const prev = assets.filter((x) => x.sceneId === sceneRef && x.kind === kind);
          try {
            const saved = await saveAsset({ url, kind, sceneId: sceneRef, code,
              jobId: s(a0.jobId) || null, jobKind: job ? job.kind : '',
              providerId: s(a0.providerId) || (job ? job.providerId : ''),
              costUsd: a0.costUsd, durationSec: a0.durationSec, note: a0.note, version: prev.length + 1 });
            okIds.push(saved.id);
            const cost = num(a0.costUsd, 0);
            if (cost > 0 || num(a0.tokens, 0) > 0) {
              costTotal += cost;
              await addCost({ providerId: s(a0.providerId) || (job ? job.providerId : ''), jobId: s(a0.jobId),
                sceneId: sceneRef, amountUsd: cost, tokens: a0.tokens, seconds: a0.durationSec,
                images: kind === 'image' ? 1 : 0, note: 'REGISTER_ASSETS ' + s(code) });
            }
          } catch (e) { errs.push(s(a0.jobId || a0.url) + ': ' + ((e && e.message) || 'error')); }
        }
        syncJobs();
        if (model.production) runStages(['analytics'], 'Analítica');
        const jobs = arr(obj(model.production).jobs);
        const pending = jobs.filter((j) => j.status === 'pending').length;
        return { success: errs.length === 0,
          message: okIds.length + ' asset(s) registrados' + (costTotal ? ' · ' + fmtMoney(costTotal, 'USD') + ' de coste real' : '')
            + '. Quedan ' + pending + ' trabajo(s) pendientes'
            + (pending ? ': vuelve a llamar a RUN_PRODUCTION.' : ': exporta `render_bundle` y renderiza.'),
          error: errs.length ? errs.join(' · ') : undefined };
      }

      // ── Flujo y aspecto ─────────────────────────────────────────────────
      if (type === 'SET_WORKFLOW') {
        const known = (x) => PIPELINE_ORDER.indexOf(s(x)) >= 0;
        const bad = arr(p.order).concat(arr(p.disable)).concat(arr(p.enable)).map(s).filter((x) => x && !known(x));
        if (bad.length) return { success: false, error: 'Agentes desconocidos: ' + uniq(bad).join(', ') + '. Válidos: ' + PIPELINE_ORDER.join(', ') + '.' };
        if (!p.reset && !arr(p.order).length && !arr(p.disable).length && !arr(p.enable).length) {
          return { success: false, error: 'Indica `order`, `disable`, `enable` o `reset`.' };
        }
        patch((m) => {
          if (p.reset) { m.settings.workflow = { order: [], disabled: [] }; return; }
          if (arr(p.order).length) m.settings.workflow.order = uniq(arr(p.order).map(s).filter(known));
          const off = new Set(arr(m.settings.workflow.disabled));
          for (const x of arr(p.disable)) if (known(x)) off.add(s(x));
          for (const x of arr(p.enable)) off.delete(s(x));
          m.settings.workflow.disabled = Array.from(off);
        });
        // effectiveOrder puede haber corregido el orden pedido: se guarda ya
        // corregido para que lo que se ve sea lo que se va a ejecutar.
        if (!p.reset && arr(p.order).length) {
          const fixed = effectiveOrder(model);
          patch((m) => { m.settings.workflow.order = fixed; });
        }
        const plan = workflowPlan(model);
        const off = plan.filter((x) => x.disabled).map((x) => x.name);
        const blocked = plan.filter((x) => x.blocked).map((x) => x.name);
        return { success: true,
          message: 'Flujo actualizado. Orden: ' + plan.map((x) => x.name).join(' → ') + '.'
            + (off.length ? ' Desactivados: ' + off.join(', ') + '.' : '')
            + (blocked.length ? ' Bloqueados por dependencia apagada: ' + blocked.join(', ') + '.' : ''),
          data: plan.map((x) => ({ orden: x.idx + 1, id: x.id, agente: x.name, estado: x.status,
            depende: arr(x.deps).map((d) => (agentById(d) || {}).name) })) };
      }

      if (type === 'SET_THEME') {
        const ch = [];
        let bad = '';
        patch((m) => {
          if (s(p.form)) {
            if (!THEME_FORMS.some((x) => x.id === s(p.form))) bad = 'form debe ser classic o game.';
            else { m.settings.theme.form = s(p.form); ch.push('forma ' + themeFormById(p.form).label); }
          }
          if (s(p.classicMode)) {
            if (!CLASSIC_MODES.some((x) => x.id === s(p.classicMode))) bad = 'classicMode debe ser day, sunset, night o live.';
            else { m.settings.theme.classicMode = s(p.classicMode); ch.push('modo ' + classicModeById(p.classicMode).label); }
          }
          if (s(p.gameMode)) {
            if (!GAME_MODES.some((x) => x.id === s(p.gameMode))) bad = 'gameMode debe ser kimoslab, jabotel o spacecraft.';
            else { m.settings.theme.gameMode = s(p.gameMode); ch.push('ambientación ' + gameModeById(p.gameMode).label); }
          }
        });
        if (bad) return { success: false, error: bad };
        if (!ch.length) return { success: false, error: 'Indica `form`, `classicMode` o `gameMode`.' };
        const th = currentTheme();
        return { success: true, message: 'Aspecto: ' + ch.join(', ') + '. Ahora se ve como «' + th.label + '».'
          + ' Es solo presentación: los datos y los resultados no cambian.' };
      }

      // ── Mapa de la organización ─────────────────────────────────────────
      if (type === 'SET_ORG') {
        const op = norm(p.op).replace(/[^a-z_]/g, '');
        // Cada operación es una mutación pura del paquete: devuelve un mundo
        // nuevo o un motivo, nunca lanza y nunca deja el documento a medias.
        const OPS = {
          add_area: (w) => wsAddArea(w, { departmentId: p.departmentId, name: p.name, structure: p.structure,
            x: p.x, y: p.y, w: p.w, h: p.h, note: p.note }),
          update_area: (w) => wsUpdateArea(w, p.areaId, p),
          remove_area: (w) => wsRemoveArea(w, p.areaId),
          add_station: (w) => wsAddStation(w, p.areaId, { name: p.name, process: p.process }),
          update_station: (w) => wsUpdateStation(w, p.areaId, p.stationId, { name: p.name, process: p.process }),
          remove_station: (w) => wsRemoveStation(w, p.areaId, p.stationId),
          add_staff: (w) => wsAddStaff(w, { name: p.name, role: p.role, kind: p.kind, areaId: p.areaId, stationId: p.stationId }),
          update_staff: (w) => wsUpdateStaff(w, p.staffId, p),
          remove_staff: (w) => wsRemoveStaff(w, p.staffId),
          resize: (w) => wsResizeGrid(w, numOr(p.gridW, obj(w.grid).w), numOr(p.gridH, obj(w.grid).h)),
        };
        if (op === 'reseed') {
          patch((m) => { m.world = seedOrgWorld(m); logLine(m, 'info', 'Organización · mapa sembrado de nuevo.'); });
          return { success: true, message: 'Mapa sembrado de nuevo desde el flujo de agentes.',
            data: wsWorldSummary(model.world) };
        }
        if (!OPS[op]) return { success: false, error: 'op desconocido. Válidos: ' + Object.keys(OPS).concat(['reseed']).join(', ') + '.' };
        // Un agente del flujo no se da de baja borrando su avatar: eso dejaría
        // el mapa mintiendo sobre quién trabaja aquí.
        if (op === 'remove_staff') {
          const who = arr(model.world.staff).find((x) => x.id === s(p.staffId) || norm(x.name) === norm(p.staffId));
          if (who && who.agentId) {
            return { success: false, error: '«' + who.name + '» es un agente del flujo. Desactívalo con '
              + 'SET_WORKFLOW { disable: ["' + who.agentId + '"] } en vez de borrarlo del mapa.' };
          }
        }
        const r = OPS[op](model.world);
        if (!r || !r.ok) return { success: false, error: s(r && r.error) || 'No se pudo cambiar el mapa.' };
        patch((m) => { m.world = r.world; logLine(m, 'info', 'Organización · ' + s(r.message)); });
        return { success: true, message: s(r.message), data: wsWorldSummary(model.world) };
      }

      // ── Ejecución de agentes ────────────────────────────────────────────
      if (type === 'RUN_AGENT') {
        const ag = agentById(p.agentId);
        if (!ag) return { success: false, error: 'Agente desconocido. Disponibles: ' + AGENTS.map((x) => x.id).join(', ') + '.' };
        const run = runStages([ag.id], ag.name);
        const st = run.stages.find((x) => x.agentId === ag.id);
        if (st && st.status === 'error') return { success: false, error: ag.name + ' falló: ' + s(st.error) };
        return { success: true, message: ag.name + ' ejecutado en ' + (st ? st.ms : 0) + ' ms.' };
      }

      if (type === 'RUN_PIPELINE') {
        const only = arr(p.only).map(s).filter((x) => agentById(x));
        const run = runStages(only.length ? only : null, 'Pipeline');
        const errs = run.stages.filter((x) => x.status === 'error');
        return { success: errs.length === 0, message: run.stages.length + ' etapas en ' + run.ms + ' ms.',
          error: errs.length ? errs.map((x) => x.name + ': ' + x.error).join(' · ') : undefined };
      }

      if (type === 'SET_DIRECTION') {
        const changes = [];
        patch((m) => {
          if (p.styleId && STYLES.some((x) => x.id === p.styleId)) { m.styleId = s(p.styleId); changes.push('estilo ' + styleById(m.styleId).name); }
          if (p.objectiveId && OBJECTIVES.some((x) => x.id === p.objectiveId)) { m.objectiveId = s(p.objectiveId); changes.push('objetivo ' + objectiveById(m.objectiveId).label); }
          if (p.audienceId && AUDIENCES.some((x) => x.id === p.audienceId)) { m.audienceId = s(p.audienceId); changes.push('público ' + audienceById(m.audienceId).label); }
          if (p.categoryId && CATEGORIES.some((x) => x.id === p.categoryId)) { m.categoryId = s(p.categoryId); changes.push('categoría ' + categoryById(m.categoryId).label); }
        });
        if (!changes.length) return { success: false, error: 'Ningún valor válido. Estilos: ' + STYLES.map((x) => x.id).join(', ') + '.' };
        if (p.regenerate !== false && model.concept) runStages(null, 'Regeneración');
        return { success: true, message: 'Dirección actualizada: ' + changes.join(', ') + (p.regenerate !== false && model.concept ? '. Campaña regenerada.' : '.') };
      }

      if (type === 'SET_PROVIDER') {
        const cap = s(p.capability).trim();
        const prov = getProvider(p.providerId);
        if (!CAPABILITIES.some((x) => x.id === cap)) return { success: false, error: 'Capacidad desconocida. Usa: ' + CAPABILITIES.map((x) => x.id).join(', ') + '.' };
        if (!prov) return { success: false, error: 'Proveedor desconocido. Para «' + cap + '»: ' + providersFor(cap).map((x) => x.id).join(', ') + '.' };
        if (prov.capability !== cap) return { success: false, error: '«' + prov.id + '» es de capacidad «' + prov.capability + '», no «' + cap + '».' };
        patch((m) => {
          m.settings.providers[cap] = prov.id;
          if (p.params && typeof p.params === 'object') m.settings.providerParams[prov.id] = Object.assign(obj(m.settings.providerParams[prov.id]), obj(p.params));
          logLine(m, 'info', 'Proveedor de ' + cap + ' → ' + prov.label + '.');
        });
        if (model.storyboard) runStages(['prompt-engineer', 'voice-director', 'video-producer', 'analytics'], 'Reescritura de prompts');
        return { success: true, message: 'Proveedor de ' + cap + ' cambiado a ' + prov.label + '. Los prompts se han reescrito a su dialecto (' + prov.dialect + ').' };
      }

      if (type === 'SET_SETTINGS') {
        const ch = [];
        patch((m) => {
          if (p.heroDurationSec !== undefined) { m.settings.heroDurationSec = clamp(num(p.heroDurationSec, 30), 5, 180); ch.push('hero ' + m.settings.heroDurationSec + 's'); }
          if (p.shortDurationSec !== undefined) { m.settings.shortDurationSec = clamp(num(p.shortDurationSec, 15), 5, 90); ch.push('corto ' + m.settings.shortDurationSec + 's'); }
          if (p.variantCount !== undefined) { m.settings.variantCount = clamp(num(p.variantCount, 3), 1, 8); ch.push(m.settings.variantCount + ' variantes'); }
          if (p.fps !== undefined) { m.settings.fps = clamp(num(p.fps, 25), 12, 60); ch.push(m.settings.fps + ' fps'); }
          if (p.subtitles !== undefined) { m.settings.subtitles = !!p.subtitles; ch.push('subtítulos ' + (m.settings.subtitles ? 'sí' : 'no')); }
          const asp = arr(p.aspects).map(s).filter((x) => ASPECTS.some((y) => y.id === x));
          if (asp.length) { m.settings.targets.aspects = uniq(asp); ch.push('formatos ' + asp.join('/')); }
          const res = arr(p.resolutions).map(s).filter((x) => RESOLUTIONS.some((y) => y.id === x));
          if (res.length) { m.settings.targets.resolutions = uniq(res); ch.push('resoluciones ' + res.join('/')); }
          const plat = arr(p.platforms).map(s).filter((x) => PLATFORMS.some((y) => y.id === x));
          if (plat.length) { m.settings.targets.platforms = uniq(plat); ch.push(plat.length + ' plataformas'); }
        });
        if (!ch.length) return { success: false, error: 'No se indicó ningún ajuste válido.' };
        if (model.storyboard) runStages(null, 'Regeneración');
        return { success: true, message: 'Ajustes: ' + ch.join(', ') + '.' };
      }

      if (type === 'SET_BRAND') {
        const bad = [];
        patch((m) => {
          for (const k of ['primary', 'secondary', 'accent', 'dark', 'light']) {
            if (p[k] === undefined) continue;
            if (isHex(p[k])) m.brand.palette[k] = s(p[k]).trim(); else bad.push(k);
          }
          if (p.display !== undefined) m.brand.typography.display = s(p.display);
          if (p.body !== undefined) m.brand.typography.body = s(p.body);
          if (p.logoUrl !== undefined) m.brand.logoUrl = resolveUrl(p.logoUrl);
          if (p.tone !== undefined) m.brand.tone = s(p.tone);
          if (p.slogan !== undefined) m.brand.slogan = s(p.slogan);
          if (p.productLock !== undefined) m.brand.productLock = s(p.productLock);
          if (p.characterLock !== undefined) m.brand.characterLock = s(p.characterLock);
          if (p.forbidden !== undefined) m.brand.forbidden = uniq(arr(p.forbidden).map(s));
          logLine(m, 'info', 'Identidad de marca actualizada.');
        });
        if (model.storyboard) runStages(['prompt-engineer', 'video-editor', 'brand-consistency'], 'Marca');
        return { success: true, message: 'Marca actualizada.' + (bad.length ? ' Colores ignorados por formato inválido (usa #RRGGBB): ' + bad.join(', ') + '.' : '') };
      }

      // ── Storyboard ──────────────────────────────────────────────────────
      if (type === 'UPDATE_SCENE') {
        const sc = findScene(p.sceneId);
        if (!sc) return { success: false, error: 'Escena no encontrada. Códigos: ' + arr(obj(model.storyboard).scenes).map((x) => x.code).join(', ') + '.' };
        const applied = [];
        const enums = { shot: SHOTS, angle: ANGLES, lens: LENSES, move: MOVES, lighting: LIGHTING, grade: GRADES, transitionIn: TRANSITIONS };
        const invalid = [];
        patch((m) => {
          const t = arr(m.storyboard.scenes).find((x) => x.id === sc.id);
          if (!t) return;
          for (const k of Object.keys(enums)) {
            if (p[k] === undefined) continue;
            if (enums[k].some((x) => x.id === s(p[k]))) { t[k] = s(p[k]); applied.push(k); }
            else invalid.push(k + ' (válidos: ' + enums[k].map((x) => x.id).slice(0, 8).join(', ') + '…)');
          }
          if (p.fx !== undefined) { t.fx = arr(p.fx).map(s).filter((x) => FX.some((y) => y.id === x)); applied.push('fx'); }
          if (p.durationSec !== undefined) { t.durationSec = clamp(num(p.durationSec, t.durationSec), 0.3, 60); applied.push('duración'); }
          if (p.onScreenText !== undefined) { t.onScreenText = s(p.onScreenText); applied.push('texto'); }
          if (p.description !== undefined) { t.description = s(p.description); applied.push('descripción'); }
          if (p.notes !== undefined) { t.notes = s(p.notes); applied.push('notas'); }
          m.storyboard.totalSec = retime(m.storyboard.scenes);
          logLine(m, 'info', 'Escena ' + t.code + ' editada por el agente.');
        });
        if (!applied.length) return { success: false, error: 'Ningún campo válido. ' + (invalid.length ? 'Rechazados: ' + invalid.join(' · ') : '') };
        runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'brand-consistency', 'analytics'], 'Escena');
        return { success: true, message: 'Escena ' + sc.code + ' actualizada (' + applied.join(', ') + '); prompts, audio y montaje regenerados.'
          + (invalid.length ? ' Ignorado: ' + invalid.join(' · ') : '') };
      }

      if (type === 'ADD_SCENE') {
        const role = s(p.role).trim();
        if (!BEAT_ROLES.some((x) => x.id === role)) return { success: false, error: 'Rol inválido. Usa: ' + BEAT_ROLES.map((x) => x.id).join(', ') + '.' };
        if (!model.storyboard) return { success: false, error: 'Aún no hay storyboard: ejecuta RUN_AGENT storyboard o GENERATE_CAMPAIGN.' };
        let code = '';
        patch((m) => {
          const st0 = styleById(m.styleId);
          const scenes = arr(m.storyboard.scenes);
          const at = s(p.afterCode) ? scenes.findIndex((x) => norm(x.code) === norm(p.afterCode)) + 1 : scenes.length;
          const r0 = rng(seedOf(m) ^ hash32(role + at));
          const spec = shotForRole(role, st0, categoryById(m.categoryId), r0, { vertical: false, index: at, count: scenes.length + 1 });
          const sc2 = {
            id: newId('sc'), n: at + 1, code: 'SC' + String(at + 1).padStart(2, '0'), role,
            roleLabel: (BEAT_ROLES.find((x) => x.id === role) || {}).label || role,
            purpose: (BEAT_ROLES.find((x) => x.id === role) || {}).purpose || '',
            startSec: 0, durationSec: clamp(num(p.durationSec, 2.5), 0.3, 60),
            description: s(p.description) || sceneDescription(role, s(m.brief.productName) || 'el producto', m, spec, null, r0),
            shot: spec.shot, angle: spec.angle, lens: spec.lens, move: spec.move,
            lighting: spec.lighting, grade: spec.grade, fx: spec.fx, speed: spec.speed, transitionIn: spec.transitionIn,
            onScreenText: p.onScreenText !== undefined ? s(p.onScreenText) : onScreenTextFor(role, m, null, r0),
            soundNote: soundNoteFor(role, st0, categoryById(m.categoryId)), productVisible: role !== 'problem', notes: '',
          };
          scenes.splice(at, 0, sc2);
          scenes.forEach((x, i) => { x.n = i + 1; x.code = 'SC' + String(i + 1).padStart(2, '0'); });
          m.storyboard.totalSec = retime(scenes);
          code = sc2.code;
          logLine(m, 'info', 'Escena ' + code + ' (' + role + ') añadida por el agente.');
        });
        runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'analytics'], 'Escena nueva');
        return { success: true, message: 'Escena ' + code + ' añadida. Duración total: ' + fmtSec(num(obj(model.storyboard).totalSec, 0)) + '.' };
      }

      if (type === 'REMOVE_SCENE') {
        const sc = findScene(p.sceneId);
        if (!sc) return { success: false, error: 'Escena no encontrada.' };
        if (arr(obj(model.storyboard).scenes).length <= 2) return { success: false, error: 'Una campaña necesita al menos 2 escenas.' };
        patch((m) => {
          m.storyboard.scenes = arr(m.storyboard.scenes).filter((x) => x.id !== sc.id);
          m.storyboard.scenes.forEach((x, i) => { x.n = i + 1; x.code = 'SC' + String(i + 1).padStart(2, '0'); });
          m.storyboard.totalSec = retime(m.storyboard.scenes);
          logLine(m, 'info', 'Escena ' + sc.code + ' eliminada.');
        });
        runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'analytics'], 'Escena eliminada');
        return { success: true, message: 'Escena ' + sc.code + ' eliminada.' };
      }

      // ── Consulta ────────────────────────────────────────────────────────
      if (type === 'GET_PROMPTS') {
        if (!model.prompts) return { success: false, error: 'Aún no hay prompts: ejecuta GENERATE_CAMPAIGN o RUN_AGENT prompt-engineer.' };
        const kind = norm(p.kind);
        const limit = clamp(num(p.limit, 12), 1, 60);
        let list = [];
        if (!kind || kind === 'image') list = list.concat(arr(model.prompts.image));
        if (!kind || kind === 'video') list = list.concat(arr(model.prompts.video));
        if (kind === 'voice') list = arr(obj(model.audio).vo).map((v) => ({ code: v.code, role: 'vo', kind: 'voice', providerId: v.providerId, text: v.text, params: v.params }));
        if (kind === 'music') { const mu = obj(obj(model.audio).music); list = mu.prompt ? [{ code: 'MUS', role: 'music', kind: 'music', providerId: mu.providerId, text: mu.prompt, params: mu.params }] : []; }
        if (s(p.sceneId)) { const sc = findScene(p.sceneId); list = sc ? list.filter((x) => x.sceneId === sc.id || x.code === sc.code) : []; }
        if (s(p.providerId)) {
          const prov = getProvider(p.providerId);
          if (!prov) return { success: false, error: 'Proveedor desconocido: ' + s(p.providerId) };
          const scenes = arr(obj(model.storyboard).scenes);
          list = list.map((x) => {
            const sc = scenes.find((y) => y.id === x.sceneId || y.code === x.code);
            if (!sc) return x;
            const spec = specForScene(model, sc, { kind: prov.capability === 'video' ? 'video' : 'image', aspect: x.aspect });
            const out = renderPrompt(prov.id, spec, obj(model.settings.providerParams)[prov.id]);
            return Object.assign({}, x, { providerId: out.providerId, text: out.text, negative: out.negative, params: out.params });
          });
        }
        const rows = list.slice(0, limit).map((x) => ({ escena: x.code, rol: x.role, tipo: x.kind, proveedor: x.providerId,
          aspecto: x.aspect, duracion: x.durationSec, prompt: x.text, negativo: x.negative, parametros: x.params }));
        return { success: true, message: rows.length + ' prompt(s) de ' + list.length + '.', data: rows };
      }

      if (type === 'GET_JOBS') {
        if (!model.production) return { success: false, error: 'Aún no hay trabajos: ejecuta RUN_AGENT video-producer.' };
        let jobs = arr(model.production.jobs);
        if (s(p.status)) jobs = jobs.filter((j) => j.status === norm(p.status));
        if (s(p.kind)) jobs = jobs.filter((j) => j.kind === norm(p.kind));
        const limit = clamp(num(p.limit, 15), 1, 80);
        return { success: true,
          message: jobs.length + ' trabajo(s). Coste estimado total: ' + fmtMoney(jobs.reduce((x, j) => x + num(j.estCostUsd, 0), 0), 'USD')
            + '. Ejecuta cada uno con el proveedor indicado y cierra con REGISTER_ASSET.',
          data: jobs.slice(0, limit).map((j) => ({ id: j.id, tipo: j.kind, etapa: j.stage, escena: j.code,
            proveedor: j.providerId, prompt: j.prompt, negativo: j.negative, parametros: j.params,
            coste_est: j.estCostUsd, estado: j.status, nota: j.note })) };
      }

      if (type === 'LIST_ASSETS') {
        let list = assets.slice();
        if (s(p.kind)) list = list.filter((x) => x.kind === norm(p.kind));
        if (s(p.sceneId)) { const sc = findScene(p.sceneId); list = sc ? list.filter((x) => x.sceneId === sc.id) : []; }
        const limit = clamp(num(p.limit, 30), 1, 100);
        return { success: true, message: list.length + ' asset(s) registrados.',
          data: list.slice(0, limit).map((x) => ({ id: x.id, tipo: x.kind, escena: x.code, url: x.url,
            proveedor: x.providerId, version: x.version, coste: x.costUsd, aprobado: x.approved })) };
      }

      if (type === 'GET_COPY') {
        if (!model.copy) return { success: false, error: 'Aún no hay copy: ejecuta RUN_AGENT copywriter.' };
        const sec = norm(p.section) || 'ads';
        if (sec === 'landing') return { success: true, message: 'Landing completa.', data: model.copy.landing };
        if (sec === 'emails') return { success: true, message: arr(model.copy.emails).length + ' emails.', data: model.copy.emails };
        if (sec === 'hooks') return { success: true, message: arr(model.copy.hooks).length + ' ganchos.', data: model.copy.hooks };
        let ads = arr(model.copy.ads);
        if (s(p.platform)) ads = ads.filter((x) => norm(x.platform).indexOf(norm(p.platform)) >= 0 || norm(x.platformLabel).indexOf(norm(p.platform)) >= 0);
        return { success: true, message: ads.length + ' anuncio(s).',
          data: ads.map((x) => ({ plataforma: x.platformLabel, variante: x.variant, gancho: x.hookLabel,
            texto: x.primary, titular: x.headline, descripcion: x.description, cta: x.cta, sobre_limite: x.overLimit })) };
      }

      // ── Producción y assets ─────────────────────────────────────────────
      if (type === 'REGISTER_ASSET') {
        const url = resolveUrl(p.url);
        if (!url) return { success: false, error: 'Indica `url`.' };
        const sc = s(p.sceneId) ? findScene(p.sceneId) : null;
        const prev = assets.filter((x) => x.sceneId === (sc ? sc.id : null) && x.kind === (s(p.kind) || guessKind(url)));
        let saved;
        try {
          const jobRef = s(p.jobId) ? arr(obj(model.production).jobs).find((x) => x.id === s(p.jobId)) : null;
          saved = await saveAsset({ url, kind: p.kind, sceneId: sc ? sc.id : s(p.sceneId), code: sc ? sc.code : s(p.sceneId),
            jobId: p.jobId, jobKind: jobRef ? jobRef.kind : '',
            providerId: p.providerId, costUsd: p.costUsd, durationSec: p.durationSec,
            name: p.name, note: p.note, approved: p.approved, version: prev.length + 1 });
        } catch (e) { return { success: false, error: (e && e.message) || 'no se pudo guardar el asset' }; }
        if (num(p.costUsd, 0) > 0 || num(p.tokens, 0) > 0) {
          await addCost({ providerId: p.providerId, jobId: p.jobId, sceneId: saved.sceneId, amountUsd: p.costUsd,
            tokens: p.tokens, seconds: p.durationSec, images: saved.kind === 'image' ? 1 : 0, note: 'REGISTER_ASSET ' + saved.code });
        }
        let jobMsg = '';
        if (s(p.jobId) && model.production) {
          patch((m) => {
            const j = arr(m.production.jobs).find((x) => x.id === s(p.jobId));
            if (j) { j.status = 'done'; j.assetId = saved.id; jobMsg = ' Trabajo ' + j.id + ' marcado como completado.'; }
          });
        }
        if (model.production) runStages(['analytics'], 'Analítica');
        return { success: true, message: 'Asset registrado (' + saved.kind + (saved.code ? ', escena ' + saved.code : '')
          + ', versión ' + saved.version + ').' + jobMsg };
      }

      if (type === 'SET_JOB_STATUS') {
        if (!model.production) return { success: false, error: 'No hay trabajos de producción.' };
        const st0 = norm(p.status);
        if (JOB_STATUS.indexOf(st0) < 0) return { success: false, error: 'Estado inválido. Usa: ' + JOB_STATUS.join(', ') + '.' };
        let found = false;
        patch((m) => {
          const j = arr(m.production.jobs).find((x) => x.id === s(p.jobId) || x.code === s(p.jobId));
          if (!j) return;
          found = true;
          j.status = st0;
          if (st0 === 'failed') j.attempts = num(j.attempts, 0) + 1;
          if (s(p.note)) j.note = s(p.note);
        });
        if (!found) return { success: false, error: 'Trabajo no encontrado: ' + s(p.jobId) };
        return { success: true, message: 'Trabajo ' + s(p.jobId) + ' → ' + st0 + '.' };
      }

      if (type === 'ADD_COST') {
        if (!s(p.providerId).trim()) return { success: false, error: 'Indica `providerId`.' };
        const rec = await addCost(p);
        if (model.production) runStages(['analytics'], 'Analítica');
        return { success: true, message: 'Coste registrado: ' + fmtMoney(rec.amountUsd, 'USD') + ' en ' + rec.providerId
          + '. Total real acumulado: ' + fmtMoney(ledger.reduce((a, x) => a + num(x.amountUsd, 0), 0), 'USD') + '.' };
      }

      // ── Entregables y versiones ─────────────────────────────────────────
      if (type === 'EXPORT') {
        const what = norm(p.what);
        const map = {
          bible: () => exportBible(model), ffmpeg: () => s(obj(model.edit).ffmpeg),
          srt: () => s(obj(model.edit).srt), edl: () => s(obj(model.edit).edl),
          prompts_csv: () => exportPromptsCsv(model), copy_csv: () => exportCopyCsv(model),
          jobs_csv: () => exportJobsCsv(model), json: () => JSON.stringify(model, null, 2),
          render_bundle: () => exportRenderBundle(model, assets),
          assets_manifest: () => exportAssetsManifest(model, assets),
        };
        if (!map[what]) return { success: false, error: 'Opciones: ' + Object.keys(map).join(', ') + '.' };
        const content = map[what]();
        if (!s(content).trim()) return { success: false, error: 'No hay contenido para «' + what + '»: ejecuta antes el pipeline.' };
        return { success: true, message: 'Exportado «' + what + '» (' + s(content).length + ' caracteres).', data: content };
      }

      if (type === 'CREATE_VERSION') {
        const v = createVersion(p.label);
        return { success: true, message: 'Versión «' + v.label + '» guardada (id ' + v.id + ').' };
      }
      if (type === 'RESTORE_VERSION') {
        if (!restoreVersion(p.versionId)) return { success: false, error: 'Versión no encontrada. IDs: ' + arr(model.versions).map((x) => x.id).join(', ') + '.' };
        return { success: true, message: 'Versión restaurada.' };
      }

      if (type === 'REGISTER_PROVIDER') {
        const tpl = s(p.template);
        if (!tpl.trim()) return { success: false, error: 'Indica `template` con marcadores {{campo}}.' };
        try {
          const desc = {
            id: slug(p.id), label: s(p.label) || s(p.id), vendor: s(p.vendor) || 'Personalizado',
            capability: s(p.capability), docs: s(p.docs), dialect: 'natural',
            negative: !!p.negative, aspects: arr(p.aspects).length ? arr(p.aspects).map(s) : ['*'],
            maxSec: num(p.maxSec, 0) || undefined, params: [], custom: true,
            cost: { unit: s(p.costUnit) || 'call', amount: num(p.costPerUnit, 0), currency: 'USD' },
            render(spec) { return { text: fillTemplate(tpl, spec), negative: p.negative ? uniq(arr(spec.negative)).join(', ') : '', params: { aspect: spec.aspect } }; },
          };
          registerProvider(desc);
        } catch (e) { return { success: false, error: (e && e.message) || 'descriptor inválido' }; }
        patch((m) => { logLine(m, 'info', 'Proveedor «' + slug(p.id) + '» registrado en caliente.'); });
        return { success: true, message: 'Proveedor «' + slug(p.id) + '» disponible para la capacidad «' + s(p.capability)
          + '». Actívalo con SET_PROVIDER. Nota: los proveedores registrados en caliente viven mientras la ventana esté abierta; '
          + 'para hacerlo permanente, añádelo al registro del bundle.' };
      }

      return { success: false, error: 'Acción desconocida: ' + type + '. Disponibles: ' + AGENT_TOOLS.map((t) => t.name).join(', ') + '.' };
    } catch (e) {
      return { success: false, error: 'Error interno en ' + type + ': ' + ((e && e.message) || 'desconocido') };
    }
  }

  /** Sustituye {{campo}} del PromptSpec en la plantilla de un proveedor custom. */
  function fillTemplate(tpl, spec) {
    const sp = obj(spec);
    const vals = {
      subject: s(sp.subject), action: s(sp.action), environment: s(sp.environment),
      shot: enOf(SHOTS, sp.shot), angle: enOf(ANGLES, sp.angle), lens: enOf(LENSES, sp.lens),
      lighting: enOf(LIGHTING, sp.lighting), grade: enOf(GRADES, sp.grade), move: enOf(MOVES, sp.move),
      fx: arr(sp.fx).map((f) => enOf(FX, f)).filter(Boolean).join(', '),
      style: s(sp.styleText), palette: s(sp.paletteText), aspect: s(sp.aspect),
      duration: s(sp.durationSec), product: s(sp.productNote), negative: uniq(arr(sp.negative)).join(', '),
      composition: s(sp.composition), mood: s(sp.mood), film: s(sp.filmStock), code: s(sp.sceneCode),
    };
    return s(tpl).replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (m0, k) => (vals[k] !== undefined ? vals[k] : m0));
  }

  if (shell.agent && typeof shell.agent.register === 'function') {
    try {
      unregisterAgent = shell.agent.register({
        label: 'Kreative Studio',
        description: 'Estudio de campañas publicitarias con IA. Genera campañas completas desde fotos de un producto '
          + 'y una frase: investigación, concepto, plan de funnel, storyboard con dirección de fotografía, prompts por '
          + 'proveedor (OpenAI, Midjourney, FLUX, SD, ComfyUI, Runway, Kling, Veo, Sora, Higgsfield), locución y música '
          + '(ElevenLabs, Suno, Udio), montaje con FFmpeg, control de marca, copy para todos los canales, assets, '
          + 'versiones y analítica de costes.\n\n'
          + 'FLUJO COMPLETO, de cero al vídeo montado:\n'
          + '1. IMPORT_PRODUCT (si el producto está en ProductLab) o SET_BRIEF + ADD_PRODUCT_PHOTO.\n'
          + '2. GENERATE_CAMPAIGN con la intención en lenguaje natural.\n'
          + '3. RUN_PRODUCTION → devuelve el lote que toca generar ahora, con proveedor, prompt, '
          + 'parámetros e imagen de referencia. Genera cada elemento CON TUS MODELOS.\n'
          + '4. REGISTER_ASSETS con todo el lote de una vez (pasando el jobId de cada uno).\n'
          + '5. Repite 3-4 hasta que RUN_PRODUCTION devuelva listo: true.\n'
          + '6. EXPORT render_bundle → un script que descarga todo, une las tomas partidas y renderiza '
          + 'los entregables finales con FFmpeg. EXPORT bible para el documento del cliente.',
        tools: AGENT_TOOLS,
        getSnapshot: () => ({
          campania: summarize(model),
          estilo: { id: model.styleId, nombre: styleById(model.styleId).name, tagline: styleById(model.styleId).tagline },
          objetivo: model.objectiveId, publico: model.audienceId, categoria: model.categoryId,
          proveedores: model.settings.providers,
          formatos: model.settings.targets,
          idea: s(obj(model.concept).bigIdea),
          mensajeClave: s(obj(model.concept).keyMessage),
          escenas: arr(obj(model.storyboard).scenes).map((x) => ({ id: x.id, code: x.code, rol: x.role,
            dur: x.durationSec, plano: x.shot, movimiento: x.move, texto: x.onScreenText })),
          trabajos: { total: arr(obj(model.production).jobs).length,
            pendientes: arr(obj(model.production).jobs).filter((j) => j.status === 'pending').length,
            hechos: arr(obj(model.production).jobs).filter((j) => j.status === 'done').length,
            fallidos: arr(obj(model.production).jobs).filter((j) => j.status === 'failed').length,
            listoParaRenderizar: !!model.production && arr(model.production.jobs).length > 0
              && arr(model.production.jobs).every((j) => j.status !== 'pending'),
            costeEstimadoUsd: num(obj(obj(model.production).totals).cost, 0) },
          catalogoProductLab: hasData ? 'disponible (LIST_CATALOG / IMPORT_PRODUCT)' : 'no disponible en este host',
          origenDelProducto: obj(model.brief.sourceRef).app || null,
          assets: assets.map((x) => ({ id: x.id, tipo: x.kind, escena: x.code, version: x.version, url: x.url })),
          costeRealUsd: round(ledger.reduce((a, x) => a + num(x.amountUsd, 0), 0), 4),
          marca: { score: num(obj(model.brandCheck).score, 0), hallazgos: arr(obj(model.brandCheck).findings).length },
          versiones: arr(model.versions).map((v) => ({ id: v.id, label: v.label, at: v.at })),
          etapas: model.pipeline.stages,
          flujo: workflowPlan(model).map((x) => ({ orden: x.idx + 1, id: x.id, agente: x.name,
            estado: x.status, desactivado: x.disabled, bloqueado: x.blocked })),
          aspecto: { forma: currentTheme().formId, modo: currentTheme().modeId, etiqueta: currentTheme().label },
          organizacion: {
            resumen: wsWorldSummary(model.world),
            areas: arr(model.world.areas).map((a) => ({ id: a.id, nombre: a.name,
              departamento: wsDepartmentById(a.departmentId).label, estructura: a.structure,
              procesos: arr(a.stations).map((x) => x.name),
              ocupantes: arr(model.world.staff).filter((x) => x.areaId === a.id).map((x) => x.name) })),
            personal: arr(model.world.staff).map((x) => ({ id: x.id, nombre: x.name, tipo: x.kind,
              rol: x.role, area: (arr(model.world.areas).find((a) => a.id === x.areaId) || {}).name || null,
              agente: x.agentId || null })),
          },
          proveedoresDisponibles: CAPABILITIES.reduce((acc, cp) => { acc[cp.id] = providersFor(cp.id).map((x) => x.id); return acc; }, {}),
        }),
        dispatchAction: dispatch,
      });
    } catch (e) { /* host sin agente: la app funciona igual desde la UI */ }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Componentes compartidos
  // ═════════════════════════════════════════════════════════════════════════

  const VIEWS = [
    { id: 'guide', label: 'Guía', emoji: '❔', group: 'Estudio' },
    { id: 'dashboard', label: 'Panel', emoji: '◎', group: 'Estudio' },
    { id: 'flow', label: 'Flujo', emoji: '⇄', group: 'Estudio' },
    { id: 'world', label: 'Organización', emoji: '🗺', group: 'Estudio' },
    { id: 'brief', label: 'Brief', emoji: '✦', group: 'Estudio' },
    { id: 'research', label: 'Investigación', emoji: '⌕', group: 'Estrategia' },
    { id: 'concept', label: 'Concepto', emoji: '✧', group: 'Estrategia' },
    { id: 'plan', label: 'Plan y funnel', emoji: '⌗', group: 'Estrategia' },
    { id: 'storyboard', label: 'Storyboard', emoji: '▦', group: 'Producción' },
    { id: 'timeline', label: 'Timeline', emoji: '▤', group: 'Producción' },
    { id: 'prompts', label: 'Prompts', emoji: '⌨', group: 'Producción' },
    { id: 'audio', label: 'Voz y música', emoji: '♪', group: 'Producción' },
    { id: 'jobs', label: 'Producción', emoji: '⚙', group: 'Producción' },
    { id: 'editor', label: 'Editor', emoji: '✂', group: 'Producción' },
    { id: 'copy', label: 'Copy', emoji: '✎', group: 'Distribución' },
    { id: 'brand', label: 'Marca', emoji: '◈', group: 'Distribución' },
    { id: 'assets', label: 'Biblioteca', emoji: '▣', group: 'Distribución' },
    { id: 'analytics', label: 'Analytics', emoji: '▲', group: 'Distribución' },
    { id: 'styles', label: 'Estilos', emoji: '✺', group: 'Sistema' },
    { id: 'versions', label: 'Versiones', emoji: '⧉', group: 'Sistema' },
    { id: 'settings', label: 'Ajustes', emoji: '⚒', group: 'Sistema' },
  ];

  const cx = (...xs) => xs.filter(Boolean).join(' ');

  function Btn(props) {
    const p = obj(props);
    return h('button', {
      className: cx('ks-btn', p.variant ? 'ks-btn-' + p.variant : '', p.size ? 'ks-btn-' + p.size : '', p.className),
      onClick: p.onClick, disabled: !!p.disabled, title: p.title || undefined, type: 'button', key: p.key,
    }, p.children);
  }

  function Field(props) {
    const p = obj(props);
    return h('label', { className: cx('ks-field', p.wide && 'ks-field-wide') }, [
      h('span', { className: 'ks-field-label', key: 'l' }, p.label),
      p.children,
      p.help ? h('span', { className: 'ks-field-help', key: 'h' }, p.help) : null,
    ]);
  }

  function TextInput(props) {
    const p = obj(props);
    return h('input', {
      className: 'ks-input', type: p.type || 'text', value: s(p.value),
      placeholder: p.placeholder || '', disabled: !!p.disabled,
      min: p.min, max: p.max, step: p.step,
      onChange: (e) => p.onChange && p.onChange(p.type === 'number' ? num(e.target.value, 0) : e.target.value),
    });
  }
  function TextArea(props) {
    const p = obj(props);
    return h('textarea', {
      className: 'ks-input ks-textarea', value: s(p.value), rows: p.rows || 3,
      placeholder: p.placeholder || '', disabled: !!p.disabled,
      onChange: (e) => p.onChange && p.onChange(e.target.value),
    });
  }
  function Select(props) {
    const p = obj(props);
    return h('select', {
      className: 'ks-input ks-select', value: s(p.value), disabled: !!p.disabled,
      onChange: (e) => p.onChange && p.onChange(e.target.value),
    }, arr(p.options).map((o) => h('option', { key: s(o.value), value: s(o.value) }, s(o.label))));
  }
  function Toggle(props) {
    const p = obj(props);
    return h('button', {
      type: 'button', className: cx('ks-toggle', p.value && 'ks-toggle-on'),
      onClick: () => p.onChange && p.onChange(!p.value), title: p.title || '',
    }, [h('span', { className: 'ks-toggle-knob', key: 'k' })]);
  }
  function ColorInput(props) {
    const p = obj(props);
    const valid = isHex(p.value);
    return h('div', { className: 'ks-color' }, [
      h('input', { key: 'c', type: 'color', className: 'ks-color-swatch',
        value: valid ? s(p.value) : '#000000', onChange: (e) => p.onChange && p.onChange(e.target.value) }),
      h('input', { key: 't', className: cx('ks-input', 'ks-color-hex', !valid && 'ks-input-bad'),
        value: s(p.value), placeholder: '#000000', onChange: (e) => p.onChange && p.onChange(e.target.value) }),
    ]);
  }

  function Card(props) {
    const p = obj(props);
    return h('section', { className: cx('ks-card', p.className) }, [
      p.title ? h('header', { className: 'ks-card-head', key: 'h' }, [
        h('h3', { className: 'ks-card-title', key: 't' }, p.title),
        p.actions ? h('div', { className: 'ks-card-actions', key: 'a' }, p.actions) : null,
      ]) : null,
      h('div', { className: cx('ks-card-body', p.flush && 'ks-card-flush'), key: 'b' }, p.children),
    ]);
  }

  function Empty(props) {
    const p = obj(props);
    return h('div', { className: 'ks-empty' }, [
      h('div', { className: 'ks-empty-icon', key: 'i' }, p.icon || '◌'),
      h('p', { className: 'ks-empty-text', key: 't' }, p.text),
      p.action ? h('div', { className: 'ks-empty-action', key: 'a' }, p.action) : null,
    ]);
  }

  function Chip(props) {
    const p = obj(props);
    return h('span', { className: cx('ks-chip', p.tone && 'ks-chip-' + p.tone, p.onClick && 'ks-chip-click'),
      onClick: p.onClick, title: p.title || undefined }, p.children);
  }

  function Bar(props) {
    const p = obj(props);
    const pct = clamp(num(p.value, 0), 0, 100);
    return h('div', { className: 'ks-bar', title: p.title || '' }, [
      h('div', { className: cx('ks-bar-fill', p.tone && 'ks-bar-' + p.tone), key: 'f', style: { width: pct + '%' } }),
    ]);
  }

  function Stat(props) {
    const p = obj(props);
    return h('div', { className: 'ks-stat' }, [
      h('span', { className: 'ks-stat-label', key: 'l' }, p.label),
      h('strong', { className: cx('ks-stat-value', p.tone && 'ks-stat-' + p.tone), key: 'v' }, p.value),
      p.hint ? h('span', { className: 'ks-stat-hint', key: 'h' }, p.hint) : null,
    ]);
  }

  /** Bloque de texto copiable (prompts, scripts, JSON). */
  function CodeBlock(props) {
    const p = obj(props);
    return h('div', { className: cx('ks-code', p.className) }, [
      h('div', { className: 'ks-code-head', key: 'h' }, [
        h('span', { className: 'ks-code-title', key: 't' }, p.title || ''),
        h('div', { className: 'ks-code-actions', key: 'a' }, [
          h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(p.content, p.title || 'Contenido') }, 'Copiar'),
          p.filename ? h(Btn, { key: 'd', size: 'xs', onClick: () => download(p.filename, p.content, p.mime) }, 'Descargar') : null,
        ]),
      ]),
      h('pre', { className: 'ks-code-body', key: 'b' }, s(p.content)),
    ]);
  }

  /** Cabecera de vista con acciones. */
  function ViewHead(props) {
    const p = obj(props);
    return h('div', { className: 'ks-viewhead' }, [
      h('div', { key: 'l' }, [
        h('h2', { className: 'ks-viewtitle', key: 't' }, p.title),
        p.subtitle ? h('p', { className: 'ks-viewsub', key: 's' }, p.subtitle) : null,
      ]),
      p.actions ? h('div', { className: 'ks-viewactions', key: 'a' }, p.actions) : null,
    ]);
  }

  /** Aviso de etapa no ejecutada, con el botón que la ejecuta. */
  function NotReady(props) {
    const p = obj(props);
    const ag = agentById(p.agentId);
    return h(Empty, {
      icon: ag ? ag.emoji : '◌',
      text: p.text || ('Todavía no se ha ejecutado ' + (ag ? ag.name : 'este agente') + '.'),
      action: h(Btn, { variant: 'primary', onClick: () => runStages([p.agentId], ag ? ag.name : '') },
        'Ejecutar ' + (ag ? ag.name : 'agente')),
    });
  }

  const swatch = (hex, label) => h('div', { className: 'ks-swatch', key: hex + label, title: label + ' ' + hex }, [
    h('span', { className: 'ks-swatch-dot', key: 'd', style: { background: isHex(hex) ? hex : '#333' } }),
    h('span', { className: 'ks-swatch-label', key: 'l' }, [label, h('code', { key: 'c' }, s(hex))]),
  ]);

  const optsOf = (list) => arr(list).map((x) => ({ value: x.id, label: x.label || x.name }));

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Estudio: Panel y Brief
  // ═════════════════════════════════════════════════════════════════════════

  function DashboardView() {
    const [intent, setIntent] = useState(s(model.brief.intent));
    const st = styleById(model.styleId);
    const stages = obj(model.pipeline.stages);
    const doneCount = PIPELINE_ORDER.filter((id) => obj(stages[id]).status === 'done').length;
    const pct = Math.round((doneCount / PIPELINE_ORDER.length) * 100);
    const prod = obj(model.production);
    const an = obj(model.analytics);
    const bc = obj(model.brandCheck);
    const hasProduct = s(model.brief.productName).trim().length > 0;

    const quick = ['Crea una campaña premium', 'Quiero un comercial épico', 'Véndelo para deportistas',
      'Algo minimal y limpio', 'Hazlo viral para TikTok', 'Campaña de conversión con oferta'];

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Panel de campaña',
        subtitle: hasProduct ? s(model.brief.productName) + ' · ' + st.name + ' · ' + objectiveById(model.objectiveId).label
          : 'Empieza por el producto: nombre y fotos.',
        actions: [
          h(Btn, { key: 'v', onClick: () => createVersion('') }, 'Guardar versión'),
          h(Btn, { key: 'r', variant: 'ghost', disabled: !model.concept, onClick: () => runStages(null, 'Pipeline') }, 'Regenerar todo'),
        ] }),

      h(Card, { key: 'gen', title: 'Generar campaña completa' }, [
        h('p', { className: 'ks-lead', key: 'p' },
          'Sube las fotos del producto en el Brief y describe con tus palabras lo que quieres. '
          + 'El sistema interpreta el estilo, el objetivo y el público, y ejecuta los doce agentes.'),
        h('div', { className: 'ks-genrow', key: 'g' }, [
          h('input', { key: 'i', className: 'ks-input ks-input-lg', value: intent,
            placeholder: 'Crea una campaña premium…',
            onChange: (e) => setIntent(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter' && hasProduct) generateAll(intent); } }),
          h(Btn, { key: 'b', variant: 'primary', size: 'lg', disabled: !hasProduct || ui.busy,
            onClick: () => generateAll(intent) }, ui.busy ? 'Generando…' : 'Generar campaña'),
        ]),
        h('div', { className: 'ks-quick', key: 'q' }, quick.map((q) => h(Chip, {
          key: q, onClick: () => { setIntent(q); generateAll(q); }, title: 'Generar con esta intención',
        }, q))),
        !hasProduct ? h('p', { className: 'ks-warn', key: 'w' },
          'Falta el nombre del producto. ') : null,
        !hasProduct ? h(Btn, { key: 'gb', size: 'sm', onClick: () => setUi({ view: 'brief' }) }, 'Ir al Brief') : null,
      ]),

      h('div', { className: 'ks-grid ks-grid-4', key: 'stats' }, [
        h(Stat, { key: 's1', label: 'Progreso del pipeline', value: pct + ' %', hint: doneCount + ' de ' + PIPELINE_ORDER.length + ' agentes' }),
        h(Stat, { key: 's2', label: 'Duración hero', value: fmtSec(num(obj(model.storyboard).totalSec, 0)),
          hint: arr(obj(model.storyboard).scenes).length + ' escenas' }),
        h(Stat, { key: 's3', label: 'Coste de producción', value: fmtMoney(num(obj(prod.totals).cost, 0), 'USD'),
          hint: arr(prod.jobs).length + ' trabajos · real ' + fmtMoney(num(obj(an.production).realTotalUsd, 0), 'USD') }),
        h(Stat, { key: 's4', label: 'Control de marca', value: model.brandCheck ? num(bc.score, 0) + '/100' : '—',
          tone: num(bc.score, 100) >= 85 ? 'ok' : num(bc.score, 100) >= 60 ? 'warn' : 'bad',
          hint: model.brandCheck ? s(bc.level) : 'sin auditar' }),
      ]),

      h(Card, { key: 'agents', title: 'Agentes' }, [
        h('div', { className: 'ks-agents', key: 'a' }, AGENTS.map((ag) => {
          const stt = obj(stages[ag.id]);
          const status = s(stt.status) || 'idle';
          return h('div', { key: ag.id, className: cx('ks-agent', 'ks-agent-' + status) }, [
            h('div', { className: 'ks-agent-top', key: 't' }, [
              h('span', { className: 'ks-agent-emoji', key: 'e' }, ag.emoji),
              h('span', { className: 'ks-agent-n', key: 'n' }, 'Agente ' + ag.n),
              h('span', { className: cx('ks-dot', 'ks-dot-' + status), key: 'd', title: status }),
            ]),
            h('strong', { className: 'ks-agent-name', key: 'nm' }, ag.name),
            h('p', { className: 'ks-agent-desc', key: 'd2' }, ag.description),
            h('div', { className: 'ks-agent-foot', key: 'f' }, [
              h('span', { className: 'ks-agent-ms', key: 'm' }, status === 'done' ? num(stt.ms, 0) + ' ms' : status === 'error' ? s(stt.error).slice(0, 40) : 'sin ejecutar'),
              h(Btn, { key: 'r', size: 'xs', onClick: () => runStages([ag.id], ag.name) }, 'Ejecutar'),
            ]),
          ]);
        }).concat([
          h('div', { key: 'asset-manager', className: 'ks-agent ks-agent-static' }, [
            h('div', { className: 'ks-agent-top', key: 't' }, [
              h('span', { className: 'ks-agent-emoji', key: 'e' }, '🗄️'),
              h('span', { className: 'ks-agent-n', key: 'n' }, 'Agente 11'),
              h('span', { className: cx('ks-dot', assets.length ? 'ks-dot-done' : 'ks-dot-idle'), key: 'd' }),
            ]),
            h('strong', { className: 'ks-agent-name', key: 'nm' }, 'Asset Manager'),
            h('p', { className: 'ks-agent-desc', key: 'd2' },
              'Almacena imágenes, vídeos, audio, guiones, prompts, escenas, versiones e iteraciones en la instancia.'),
            h('div', { className: 'ks-agent-foot', key: 'f' }, [
              h('span', { className: 'ks-agent-ms', key: 'm' }, assets.length + ' assets · ' + arr(model.versions).length + ' versiones'),
              h(Btn, { key: 'r', size: 'xs', onClick: () => setUi({ view: 'assets' }) }, 'Abrir' ),
            ]),
          ]),
        ])),
      ]),

      model.concept ? h(Card, { key: 'idea', title: 'Concepto' }, [
        h('blockquote', { className: 'ks-bigidea', key: 'b' }, s(obj(model.concept).bigIdea)),
        h('p', { className: 'ks-lead', key: 'k' }, s(obj(model.concept).keyMessage)),
        h('div', { className: 'ks-swatches', key: 'p' },
          ['primary', 'secondary', 'accent', 'dark', 'light'].map((k) => swatch(model.brand.palette[k], k))),
      ]) : null,

      arr(model.log).length ? h(Card, { key: 'log', title: 'Registro' }, [
        h('div', { className: 'ks-log', key: 'l' }, arr(model.log).slice(-14).reverse().map((l, i) => h('div', {
          key: i, className: cx('ks-log-line', 'ks-log-' + s(l.level)),
        }, [
          h('span', { className: 'ks-log-time', key: 't' }, s(l.at).slice(11, 19)),
          h('span', { key: 'x' }, s(l.text)),
        ]))),
      ]) : null,
    ]);
  }

  // ── Brief ──────────────────────────────────────────────────────────────
  function BriefView() {
    const [uploading, setUploading] = useState(false);
    const [catalogs, setCatalogs] = useState(null);   // null = sin cargar
    const [loadingCat, setLoadingCat] = useState(false);
    const b = model.brief;
    const setB = (k, v) => patch((m) => { m.brief[k] = v; });

    async function loadCatalogs() {
      setLoadingCat(true);
      try {
        const insts = await listCatalogs();
        const out = [];
        for (const inst of insts) {
          const cat = await readCatalog(inst.id);
          if (cat && cat.products.length) out.push({ name: s(inst.name) || s(inst.id), cat });
        }
        setCatalogs(out);
        if (!out.length) notify('info', 'No hay catálogos de ProductLab con productos visibles.');
      } catch (e) { notify('error', 'No se pudo leer ProductLab: ' + ((e && e.message) || 'error')); setCatalogs([]); }
      setLoadingCat(false);
    }

    function importProduct(prod, cat) {
      try {
        const mapped = applyProductToBrief(prod, cat, { keepExisting: false });
        notify('success', '«' + mapped.productName + '» importado con ' + mapped.photos.length + ' foto(s).');
        setCatalogs(null);
      } catch (e) { notify('error', (e && e.message) || 'no se pudo importar'); }
    }

    async function onFiles(files) {
      const list = Array.from(files || []);
      if (!list.length) return;
      setUploading(true);
      let ok = 0; const errs = [];
      for (const f of list) {
        try {
          const url = await uploadFile(f, 'producto');
          patch((m) => { m.brief.photos.push({ id: newId('photo'), url, caption: '', isHero: m.brief.photos.length === 0 }); });
          ok++;
        } catch (e) { errs.push(f.name + ': ' + ((e && e.message) || 'error')); }
      }
      setUploading(false);
      if (ok) notify('success', ok + ' foto(s) subidas.');
      if (errs.length) notify('error', errs.join(' · '));
    }

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Brief del producto',
        subtitle: 'Lo único obligatorio: nombre y fotos. Todo lo demás mejora la precisión del resultado.',
        actions: [h(Btn, { key: 'g', variant: 'primary', disabled: !s(b.productName).trim(),
          onClick: () => generateAll(s(b.intent) || 'Crea una campaña premium') }, 'Generar campaña')] }),

      hasData ? h(Card, { key: 'pl', title: 'Importar desde ProductLab',
        actions: [h(Btn, { key: 'l', size: 'sm', disabled: loadingCat,
          onClick: () => (catalogs === null ? loadCatalogs() : setCatalogs(null)) },
          loadingCat ? 'Leyendo…' : catalogs === null ? 'Ver catálogos' : 'Cerrar')] }, [
        h('p', { className: 'ks-hint', key: 'i' },
          'Trae el nombre, el precio, la moneda, las especificaciones (pasan a ser la propuesta de valor), '
          + 'los pasos configurables y todas las fotos de la galería. Solo lectura: no modifica el catálogo.'),
        obj(b.sourceRef).app === 'productlab' ? h('div', { className: 'ks-chips', key: 'r' }, [
          h(Chip, { key: 'c', tone: 'accent' }, 'Importado · ' + (s(obj(b.sourceRef).sku) || s(obj(b.sourceRef).itemId))),
          h(Chip, { key: 'd' }, s(obj(b.sourceRef).at).slice(0, 10)),
        ]) : null,
        catalogs && catalogs.length ? h('div', { className: 'ks-catalogs', key: 'c' }, catalogs.map((c0) => h('div', {
          key: c0.cat.instanceId, className: 'ks-catalog',
        }, [
          h('strong', { key: 'n' }, c0.name + ' · ' + c0.cat.products.length + ' productos · ' + c0.cat.currency),
          h('div', { className: 'ks-catalog-items', key: 'p' }, c0.cat.products.map((pr) => h('button', {
            key: pr.id, type: 'button', className: 'ks-catalog-item', onClick: () => importProduct(pr, c0.cat),
            title: 'Importar al brief',
          }, [
            h('span', { className: 'ks-catalog-name', key: 'n' }, pr.name),
            h('span', { className: 'ks-catalog-meta', key: 'm' },
              [pr.sku, pr.price ? fmtMoney(pr.price, c0.cat.currency) : ''].filter(Boolean).join(' · ')),
          ]))),
        ]))) : catalogs && !catalogs.length
          ? h('p', { className: 'ks-hint', key: 'e' }, 'Sin catálogos visibles para tu usuario.') : null,
      ]) : null,

      h(Card, { key: 'photos', title: 'Fotografías del producto',
        actions: [h('label', { key: 'u', className: cx('ks-btn', 'ks-btn-primary', 'ks-btn-sm') }, [
          uploading ? 'Subiendo…' : 'Subir fotos',
          h('input', { key: 'i', type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' },
            onChange: (e) => { onFiles(e.target.files); e.target.value = ''; } }),
        ])] }, [
        arr(b.photos).length ? h('div', { className: 'ks-photos', key: 'p' }, arr(b.photos).map((ph) => h('div', {
          key: ph.id, className: cx('ks-photo', ph.isHero && 'ks-photo-hero'),
        }, [
          h('img', { key: 'i', src: ph.url, alt: s(ph.caption) || 'producto', loading: 'lazy' }),
          h('div', { className: 'ks-photo-bar', key: 'b' }, [
            h(Btn, { key: 'h', size: 'xs', variant: ph.isHero ? 'primary' : 'ghost',
              onClick: () => patch((m) => { m.brief.photos.forEach((x) => { x.isHero = x.id === ph.id; }); }),
              title: 'Marcar como toma principal' }, ph.isHero ? 'Principal' : 'Hacer principal'),
            h(Btn, { key: 'd', size: 'xs', variant: 'danger',
              onClick: () => patch((m) => { m.brief.photos = m.brief.photos.filter((x) => x.id !== ph.id); }) }, '✕'),
          ]),
        ]))) : h(Empty, { key: 'e', icon: '🖼️',
          text: 'Sin fotos. Los modelos inventarán la forma del producto si no les das una referencia real.' }),
        h('p', { className: 'ks-hint', key: 'hint' },
          'Recomendado: frontal sobre fondo limpio, tres cuartos, detalle de material y producto en uso. '
          + 'La marcada como principal es la primera referencia que reciben los modelos.'),
      ]),

      h(Card, { key: 'data', title: 'Datos' }, [
        h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
          h(Field, { key: 'n', label: 'Nombre del producto' },
            h(TextInput, { value: b.productName, placeholder: 'Zapatilla Vector Pro', onChange: (v) => setB('productName', v) })),
          h(Field, { key: 'c', label: 'Categoría', help: 'Vacío = se detecta desde el nombre y la propuesta de valor.' },
            h(TextInput, { value: b.category, placeholder: 'calzado deportivo', onChange: (v) => setB('category', v) })),
          h(Field, { key: 'p', label: 'Precio' },
            h(TextInput, { value: b.priceText, placeholder: '149', onChange: (v) => setB('priceText', v) })),
          h(Field, { key: 'cu', label: 'Moneda' },
            h(TextInput, { value: b.currency, placeholder: 'EUR', onChange: (v) => setB('currency', v) })),
          h(Field, { key: 'bu', label: 'Presupuesto de medios' },
            h(TextInput, { type: 'number', value: b.budget, onChange: (v) => setB('budget', Math.max(0, v)) })),
          h(Field, { key: 'mr', label: 'Mercado' },
            h(TextInput, { value: b.marketRegion, onChange: (v) => setB('marketRegion', v) })),
        ]),
        h(Field, { key: 'u', wide: true, label: 'Propuesta de valor', help: 'Una idea por frase. De aquí salen los atributos y los beneficios.' },
          h(TextArea, { value: b.usp, rows: 3, placeholder: 'Amortiguación de carbono. 180 g. Impermeable. Fabricada en Europa.', onChange: (v) => setB('usp', v) })),
        h(Field, { key: 'a', wide: true, label: 'Público objetivo' },
          h(TextInput, { value: b.audienceHint, placeholder: 'corredores de fondo entre 25 y 45', onChange: (v) => setB('audienceHint', v) })),
        h(Field, { key: 'i', wide: true, label: 'Intención creativa', help: 'La frase que dirige toda la campaña.' },
          h(TextInput, { value: b.intent, placeholder: 'Quiero un comercial épico', onChange: (v) => setB('intent', v) })),
        h(Field, { key: 'co', wide: true, label: 'Competencia', help: 'Una por línea. Vacío = arquetipos de la categoría.' },
          h(TextArea, { value: b.competitorsText, rows: 2, onChange: (v) => setB('competitorsText', v) })),
        h('div', { className: 'ks-grid ks-grid-2', key: 'g2' }, [
          h(Field, { key: 'm', label: 'Obligatorios', help: 'Elementos que deben aparecer sí o sí.' },
            h(TextArea, { value: b.mandatories, rows: 2, onChange: (v) => setB('mandatories', v) })),
          h(Field, { key: 'l', label: 'Legal', help: 'Disclaimers y limitaciones.' },
            h(TextArea, { value: b.legal, rows: 2, onChange: (v) => setB('legal', v) })),
        ]),
        h(Field, { key: 'e', wide: true, label: 'Notas adicionales' },
          h(TextArea, { value: b.extraNotes, rows: 2, onChange: (v) => setB('extraNotes', v) })),
      ]),

      h(Card, { key: 'dir', title: 'Dirección' }, [
        h('div', { className: 'ks-grid ks-grid-4', key: 'g' }, [
          h(Field, { key: 's', label: 'Estilo' },
            h(Select, { value: model.styleId, options: STYLES.map((x) => ({ value: x.id, label: x.emoji + ' ' + x.name })),
              onChange: (v) => { patch((m) => { m.styleId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
          h(Field, { key: 'o', label: 'Objetivo' },
            h(Select, { value: model.objectiveId, options: optsOf(OBJECTIVES),
              onChange: (v) => { patch((m) => { m.objectiveId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
          h(Field, { key: 'a', label: 'Público' },
            h(Select, { value: model.audienceId, options: optsOf(AUDIENCES),
              onChange: (v) => { patch((m) => { m.audienceId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
          h(Field, { key: 'c', label: 'Categoría' },
            h(Select, { value: model.categoryId, options: optsOf(CATEGORIES),
              onChange: (v) => { patch((m) => { m.categoryId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
        ]),
      ]),
    ]);
  }

  // ── Investigación ──────────────────────────────────────────────────────
  function ResearchView() {
    const r = model.research;
    if (!r) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'research' }));
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Investigación', subtitle: 'Mercado, público, competencia y códigos visuales de ' + s(obj(r.market).category) + '.',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['research'], 'Research') }, 'Reinvestigar')] }),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'm', title: 'Mercado' }, [
          h('ul', { className: 'ks-list', key: 'l' }, arr(obj(r.market).trends).map((t, i) => h('li', { key: i }, t))),
          h('p', { className: 'ks-hint', key: 'se' }, 'Estacionalidad: ' + s(obj(r.market).seasonality)),
          h('p', { className: 'ks-hint', key: 'pl' }, 'Lógica de precio: ' + s(obj(r.market).priceLogic)),
        ]),
        h(Card, { key: 'a', title: 'Público · ' + s(obj(r.audience).segment) }, [
          h('div', { className: 'ks-kv', key: 'k' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Edad'), h('strong', { key: 'b' }, s(obj(r.audience).age))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'Impulso'), h('strong', { key: 'b' }, s(obj(r.audience).driver))]),
            h('div', { key: '3' }, [h('span', { key: 'a' }, 'Prueba'), h('strong', { key: 'b' }, s(obj(r.audience).proof))]),
          ]),
          h('h4', { className: 'ks-h4', key: 'h1' }, 'Comportamiento'),
          h('ul', { className: 'ks-list', key: 'b' }, arr(obj(r.audience).behaviours).map((t, i) => h('li', { key: i }, t))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'Objeciones'),
          h('ul', { className: 'ks-list', key: 'o' }, arr(obj(r.audience).objections).map((t, i) => h('li', { key: i }, t))),
          h('h4', { className: 'ks-h4', key: 'h3' }, 'Disparadores de compra'),
          h('ul', { className: 'ks-list', key: 't' }, arr(obj(r.audience).triggers).map((t, i) => h('li', { key: i }, t))),
        ]),
      ]),
      h(Card, { key: 'c', title: 'Competencia' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Competidor', 'Postura', 'Fortaleza', 'Hueco que deja'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(r.competition).map((x, i) => h('tr', { key: i }, [
            h('td', { key: 'a' }, h('strong', {}, s(x.name))), h('td', { key: 'b' }, s(x.posture)),
            h('td', { key: 'c' }, s(x.strength)), h('td', { key: 'd' }, h('em', {}, s(x.gap))),
          ]))),
        ]),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g2' }, [
        h(Card, { key: 'n', title: 'Nicho' }, [
          h('p', { className: 'ks-lead', key: 'a' }, s(obj(r.niche).statement)),
          h('p', { className: 'ks-hint', key: 'b' }, 'Espacio libre: ' + s(obj(r.niche).whiteSpace)),
        ]),
        h(Card, { key: 'v', title: 'Códigos visuales' }, [
          h('h4', { className: 'ks-h4', key: 'h1' }, 'Dominantes en la categoría'),
          h('div', { className: 'ks-chips', key: 'd' }, arr(obj(r.visualCodes).dominant).map((x, i) => h(Chip, { key: i }, x))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'A evitar'),
          h('div', { className: 'ks-chips', key: 'e' }, arr(obj(r.visualCodes).avoid).map((x, i) => h(Chip, { key: i, tone: 'bad' }, x))),
        ]),
      ]),
      h(Card, { key: 'ch', title: 'Canales recomendados' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Canal', 'CTR ref.', 'CPM ref.', 'CVR ref.', 'Ventana de gancho'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(r.channels).map((x) => h('tr', { key: x.id }, [
            h('td', { key: 'a' }, x.label), h('td', { key: 'b' }, round(x.ctr * 100, 2) + ' %'),
            h('td', { key: 'c' }, fmtMoney(x.cpm, 'USD')), h('td', { key: 'd' }, round(x.cvr * 100, 2) + ' %'),
            h('td', { key: 'e' }, x.hookSec + ' s'),
          ]))),
        ]),
        h('p', { className: 'ks-hint', key: 'n' }, 'Valores de referencia de industria por familia de plataforma. Sirven para dimensionar, no son garantía.'),
      ]),
    ]);
  }

  // ── Concepto ───────────────────────────────────────────────────────────
  function ConceptView() {
    const cn = model.concept;
    if (!cn) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'creative-director' }));
    const mb = obj(cn.moodboard);
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Concepto creativo', subtitle: s(obj(cn.direction).styleName) + ' · ' + s(obj(cn.direction).tone),
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['creative-director'], 'Creative Director') }, 'Regenerar concepto')] }),
      h(Card, { key: 'idea', title: 'Idea' }, [
        h('blockquote', { className: 'ks-bigidea', key: 'b' }, s(cn.bigIdea)),
        h('p', { className: 'ks-lead', key: 'k' }, s(cn.keyMessage)),
        h('p', { className: 'ks-hint', key: 'l' }, s(obj(cn.storytelling).logline)),
        h('div', { className: 'ks-chips', key: 'c' }, arr(cn.claims).map((x, i) => h(Chip, { key: i, tone: 'accent' }, x))),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'st', title: 'Storytelling · ' + s(obj(cn.storytelling).arcName) }, [
          h('div', { className: 'ks-beats', key: 'b' }, arr(obj(cn.storytelling).beats).map((x, i) => h('div', { key: i, className: 'ks-beat' }, [
            h('span', { className: 'ks-beat-n', key: 'n' }, i + 1), h('span', { key: 't' }, x),
          ]))),
          h('p', { className: 'ks-hint', key: 'e' }, 'Enemigo: ' + s(obj(cn.storytelling).enemy)),
          h('p', { className: 'ks-hint', key: 'p' }, 'Promesa: ' + s(obj(cn.storytelling).promise)),
        ]),
        h(Card, { key: 'em', title: 'Emociones' }, [
          h('div', { className: 'ks-chips', key: 'c' }, arr(cn.emotions).map((x, i) => h(Chip, { key: i, tone: 'accent' }, x))),
          h('h4', { className: 'ks-h4', key: 'h' }, 'Reglas de dirección'),
          h('ul', { className: 'ks-list', key: 'l' }, arr(obj(cn.direction).rules).map((x, i) => h('li', { key: i }, x))),
        ]),
      ]),
      h(Card, { key: 'ben', title: 'Atributos → beneficios → prueba' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Atributo', 'Beneficio', 'Prueba'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(cn.benefits).map((x, i) => h('tr', { key: i }, [
            h('td', { key: 'a' }, h('strong', {}, s(x.attribute))), h('td', { key: 'b' }, s(x.benefit)), h('td', { key: 'c' }, h('em', {}, s(x.proof))),
          ]))),
        ]),
      ]),
      h(Card, { key: 'money', title: 'Money shot' }, [
        h('p', { className: 'ks-lead', key: 'd' }, s(obj(cn.moneyShot).description)),
        h('div', { className: 'ks-chips', key: 'c' }, [
          h(Chip, { key: '1' }, labelOf(SHOTS, obj(cn.moneyShot).shot)),
          h(Chip, { key: '2' }, labelOf(LENSES, obj(cn.moneyShot).lens)),
          h(Chip, { key: '3' }, labelOf(MOVES, obj(cn.moneyShot).move)),
          h(Chip, { key: '4' }, labelOf(LIGHTING, obj(cn.moneyShot).lighting)),
          h(Chip, { key: '5' }, labelOf(GRADES, obj(cn.moneyShot).grade)),
          h(Chip, { key: '6' }, labelOf(FX, obj(cn.moneyShot).fx)),
        ]),
        h('p', { className: 'ks-hint', key: 'w' }, 'Por qué vende: ' + s(obj(cn.moneyShot).whyItSells)),
      ]),
      h(Card, { key: 'mood', title: 'Moodboard' }, [
        h('div', { className: 'ks-swatches', key: 'p' },
          Object.keys(obj(mb.palette)).map((k) => swatch(obj(mb.palette)[k], k))),
        arr(model.brief.photos).length ? h('div', { className: 'ks-moodphotos', key: 'ph' },
          arr(model.brief.photos).slice(0, 6).map((p) => h('img', { key: p.id, src: p.url, alt: '' }))) : null,
        h('div', { className: 'ks-grid ks-grid-3', key: 'g' }, [
          h('div', { key: 'r' }, [h('h4', { className: 'ks-h4', key: 'h' }, 'Referencias'),
            h('ul', { className: 'ks-list', key: 'l' }, arr(mb.references).map((x, i) => h('li', { key: i }, x)))]),
          h('div', { key: 't' }, [h('h4', { className: 'ks-h4', key: 'h' }, 'Texturas y códigos'),
            h('ul', { className: 'ks-list', key: 'l' }, arr(mb.textures).map((x, i) => h('li', { key: i }, x)))]),
          h('div', { key: 'l' }, [h('h4', { className: 'ks-h4', key: 'h' }, 'Óptica e iluminación'),
            h('div', { className: 'ks-chips', key: 'c' }, arr(mb.lensKit).concat(arr(mb.lightingNotes)).map((x, i) => h(Chip, { key: i }, x)))]),
        ]),
        h('h4', { className: 'ks-h4', key: 'h2' }, 'Prohibido'),
        h('div', { className: 'ks-chips', key: 'dn' }, arr(mb.doNot).map((x, i) => h(Chip, { key: i, tone: 'bad' }, x))),
      ]),
    ]);
  }

  // ── Plan ───────────────────────────────────────────────────────────────
  function PlanView() {
    const p = model.plan;
    if (!p) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'planner' }));
    const cur = s(obj(p.budget).currency) || 'USD';
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Plan de campaña',
        subtitle: s(obj(p.objective).label) + ' · ' + fmtMoney(num(obj(p.budget).total, 0), cur) + ' · KPI: ' + s(obj(p.objective).kpi),
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['planner'], 'Campaign Planner') }, 'Recalcular plan')] }),
      h(Card, { key: 'f', title: 'Funnel' }, [
        h('div', { className: 'ks-funnel', key: 'f' }, arr(p.funnel).map((st0) => h('div', { key: st0.id, className: 'ks-funnel-stage' }, [
          h('div', { className: 'ks-funnel-head', key: 'h' }, [
            h('strong', { key: 'l' }, st0.label),
            h('span', { className: 'ks-funnel-pct', key: 'p' }, st0.sharePct + ' %'),
          ]),
          h(Bar, { key: 'b', value: st0.sharePct * 2, tone: 'accent' }),
          h('p', { className: 'ks-funnel-goal', key: 'g' }, st0.goal),
          h('div', { className: 'ks-kv ks-kv-sm', key: 'k' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Presupuesto'), h('strong', { key: 'b' }, fmtMoney(st0.budget, st0.currency))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'Impresiones'), h('strong', { key: 'b' }, num(obj(st0.projection).impressions, 0).toLocaleString('es'))]),
            h('div', { key: '3' }, [h('span', { key: 'a' }, 'Clics'), h('strong', { key: 'b' }, num(obj(st0.projection).clicks, 0).toLocaleString('es'))]),
            h('div', { key: '4' }, [h('span', { key: 'a' }, 'Acciones'), h('strong', { key: 'b' }, num(obj(st0.projection).actions, 0).toLocaleString('es'))]),
          ]),
          h('p', { className: 'ks-hint', key: 'm' }, 'Mensaje: ' + st0.message),
          h('p', { className: 'ks-hint', key: 'c' }, st0.creativeNote),
          h('div', { className: 'ks-chips', key: 'ch' }, arr(st0.channels).map((c0, i) => h(Chip, { key: i }, c0))
            .concat(arr(st0.formats).map((f, i) => h(Chip, { key: 'f' + i, tone: 'accent' }, f)))),
        ]))),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'k', title: 'KPIs' }, [
          h('table', { className: 'ks-table', key: 't' }, [
            h('thead', { key: 'h' }, h('tr', {}, ['KPI', 'Objetivo', 'Por qué'].map((x) => h('th', { key: x }, x)))),
            h('tbody', { key: 'b' }, arr(p.kpis).map((k) => h('tr', { key: k.id }, [
              h('td', { key: 'a' }, h('strong', {}, k.label)), h('td', { key: 'b' }, k.target), h('td', { key: 'c' }, h('em', {}, k.why)),
            ]))),
          ]),
        ]),
        h(Card, { key: 'c', title: 'Calendario' }, [
          h('div', { className: 'ks-weeks', key: 'w' }, arr(p.calendar).map((w) => h('div', { key: w.week, className: 'ks-week' }, [
            h('strong', { key: 'h' }, 'Semana ' + w.week + ' · ' + w.focus),
            h('ul', { className: 'ks-list', key: 'l' }, arr(w.actions).map((a, i) => h('li', { key: i }, a))),
          ]))),
        ]),
      ]),
      h(Card, { key: 't', title: 'Plan de pruebas' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(p.testPlan).map((x, i) => h('li', { key: i }, x))),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // KIMOS WorldSkin · superficie del mundo (dentro de mount)
  //
  // Un solo modelo, tres proyecciones. La villa y el territorio son cenitales;
  // el hotel es isométrico. La MISMA área ocupa las mismas celdas en los tres:
  // cambiar de ambientación no mueve nada, solo cambia cómo se proyecta.
  //
  // Requisitos del anfitrión (ver docs/CONTRATO.md): `h`, `useState`,
  // `useEffect`, `useRef` y `cx`.
  // ═════════════════════════════════════════════════════════════════════════

  const WS_TILE = 46;

  /** Proyección celda → píxel, por ambientación. */
  function wsProjector(kind, grid) {
    const g = wsObj(grid);
    const T = WS_TILE;
    if (kind === 'hotel') {
      const originX = (wsNum(g.h, 12) * T) / 2 + 20;
      return {
        kind, T,
        to: (cx, cy) => ({ x: (cx - cy) * (T / 2) + originX, y: (cx + cy) * (T / 4) + 34 }),
        width: (wsNum(g.w, 16) + wsNum(g.h, 12)) * (T / 2) + 40,
        height: (wsNum(g.w, 16) + wsNum(g.h, 12)) * (T / 4) + 120,
      };
    }
    // El margen superior deja sitio al rótulo, que va por encima de cada
    // estructura; el inferior, al subtítulo de la última fila.
    return {
      kind, T,
      to: (cx, cy) => ({ x: cx * T + 14, y: cy * T + 22 }),
      width: wsNum(g.w, 16) * T + 28,
      height: wsNum(g.h, 12) * T + 42,
    };
  }

  /** Rombo/rectángulo del suelo de un área, según proyección. */
  function wsAreaShape(pr, a) {
    if (pr.kind === 'hotel') {
      const p1 = pr.to(a.x, a.y);
      const p2 = pr.to(a.x + a.w, a.y);
      const p3 = pr.to(a.x + a.w, a.y + a.h);
      const p4 = pr.to(a.x, a.y + a.h);
      return [p1, p2, p3, p4].map((p) => p.x + ',' + p.y).join(' ');
    }
    const o = pr.to(a.x, a.y);
    return { x: o.x, y: o.y, w: a.w * pr.T, h: a.h * pr.T };
  }

  // ── Estructuras dibujadas ──────────────────────────────────────────────
  function WsStructure(props) {
    const p = wsObj(props);
    const a = p.area; const pr = p.pr;
    const dep = wsDepartmentById(a.departmentId);
    const st = wsStructureById(a.structure);
    const sel = p.selected;
    const n = wsArr(a.stations).length;
    const sub = wsStructureName(st.id, pr.kind) + ' · ' + n + (n === 1 ? ' puesto' : ' puestos');
    if (pr.kind === 'hotel') {
      const pts = wsAreaShape(pr, a);
      const top = pr.to(a.x + a.w / 2, a.y + a.h / 2);
      const lift = 26;
      return h('g', { className: cx('ws-struct', sel && 'ws-struct-sel'), onClick: p.onClick }, [
        h('polygon', { key: 'f', points: pts, fill: dep.color, fillOpacity: 0.22, stroke: dep.color, strokeWidth: sel ? 2.5 : 1.2 }),
        h('polygon', { key: 'w', points: pts, fill: 'none', stroke: dep.color, strokeWidth: 1,
          transform: 'translate(0,' + -lift + ')', opacity: 0.75 }),
        h('line', { key: 'l1', x1: pts.split(' ')[0].split(',')[0], y1: pts.split(' ')[0].split(',')[1],
          x2: pts.split(' ')[0].split(',')[0], y2: Number(pts.split(' ')[0].split(',')[1]) - lift,
          stroke: dep.color, strokeWidth: 1, opacity: 0.6 }),
        h('text', { key: 't', x: top.x, y: top.y - lift - 12, textAnchor: 'middle', className: 'ws-struct-label' },
          dep.emoji + ' ' + a.name),
        h('text', { key: 's', x: top.x, y: top.y - lift - 2, textAnchor: 'middle', className: 'ws-struct-sub' }, sub),
      ]);
    }
    const r = wsAreaShape(pr, a);
    const round = pr.kind === 'village' ? 6 : 0;
    const roof = pr.kind === 'village';
    return h('g', { className: cx('ws-struct', sel && 'ws-struct-sel'), onClick: p.onClick }, [
      h('rect', { key: 'b', x: r.x, y: r.y + (roof ? 10 : 0), width: r.w, height: r.h - (roof ? 10 : 0),
        rx: round, fill: dep.color, fillOpacity: 0.26, stroke: dep.color, strokeWidth: sel ? 2.5 : 1.2 }),
      roof ? h('polygon', { key: 'r', points: [
        [r.x - 3, r.y + 12], [r.x + r.w / 2, r.y - 2], [r.x + r.w + 3, r.y + 12],
      ].map((q) => q.join(',')).join(' '), fill: dep.color, fillOpacity: 0.7 }) : null,
      // El chaflán es lo que hace que una estructura se lea como «desplegada»
      // y no como una caja: se rellena, no solo se contornea.
      pr.kind === 'territory' ? h('polygon', { key: 'c', points: [
        [r.x, r.y + 12], [r.x + 12, r.y], [r.x + r.w - 12, r.y], [r.x + r.w, r.y + 12],
        [r.x + r.w, r.y + r.h - 12], [r.x + r.w - 12, r.y + r.h],
        [r.x + 12, r.y + r.h], [r.x, r.y + r.h - 12],
      ].map((q) => q.join(',')).join(' '), fill: dep.color, fillOpacity: 0.18,
      stroke: dep.color, strokeWidth: 1, opacity: 0.9 }) : null,
      // Los rótulos van FUERA de la estructura: dentro los taparían los
      // avatares, que es justo lo que hay que poder mirar.
      h('text', { key: 't', x: r.x + r.w / 2, y: r.y - 4, textAnchor: 'middle', className: 'ws-struct-label' },
        dep.emoji + ' ' + a.name),
      h('text', { key: 's', x: r.x + r.w / 2, y: r.y + r.h + 11, textAnchor: 'middle', className: 'ws-struct-sub' }, sub),
    ]);
  }

  /** Avatar: dos píxeles de cuerpo y uno de cabeza, con rebote al andar. */
  function WsAvatar(props) {
    const p = wsObj(props);
    const a = p.actor;
    const col = wsAvatarColors(a);
    const bob = a.moving ? Math.sin((p.t + a.phase) * 9) * 1.6 : Math.sin((p.t + a.phase) * 2) * 0.5;
    const s = p.scale || 1;
    return h('g', {
      className: cx('ws-actor', p.selected && 'ws-actor-sel', a.mood === 'off' && 'ws-actor-off'),
      transform: 'translate(' + p.px + ',' + (p.py + bob) + ') scale(' + (a.face < 0 ? -s : s) + ',' + s + ')',
      onClick: p.onClick,
    }, [
      h('ellipse', { key: 'sh', cx: 0, cy: 1, rx: 6, ry: 2.4, fill: '#000', opacity: 0.22 }),
      h('rect', { key: 'b', x: -4, y: -11, width: 8, height: 8, rx: 2, fill: col.body }),
      h('rect', { key: 'h', x: -3.5, y: -18, width: 7, height: 7, rx: a.kind === 'ai' ? 1.5 : 3.5, fill: col.head }),
      a.kind === 'ai'
        ? h('rect', { key: 'e', x: -2.5, y: -16, width: 5, height: 1.8, fill: col.body })
        : h('rect', { key: 'e', x: 0.4, y: -15.6, width: 1.4, height: 1.4, fill: '#2A2A2A' }),
      a.kind === 'ai' ? h('rect', { key: 'a', x: -0.6, y: -21, width: 1.2, height: 3, fill: col.trim }) : null,
      a.bubble ? h('g', { key: 'bu', transform: 'translate(7,-20) scale(' + (a.face < 0 ? -1 : 1) + ',1)' }, [
        h('circle', { key: 'c', cx: 0, cy: 0, r: 5.5, fill: '#fff', opacity: 0.92 }),
        h('text', { key: 't', x: 0, y: 2.4, textAnchor: 'middle', className: 'ws-bubble' }, a.bubble),
      ]) : null,
    ]);
  }

  /**
   * Superficie del mundo. Recibe el mundo, el tema, el plan del flujo y una
   * función que traduce agente → estado. Devuelve el SVG animado.
   */
  function WsWorldSurface(props) {
    const p = wsObj(props);
    const world = wsObj(p.world);
    const pr = wsProjector(wsS(p.kind) || 'village', world.grid);
    const simRef = useRef(null);
    const rafRef = useRef(null);
    // El bucle se da de alta una sola vez por firma del mundo, así que no
    // puede cerrarse sobre `props`: se quedaría con el estado del flujo que
    // había al arrancar y los avatares no reaccionarían nunca. Aquí se deja
    // siempre lo último que ha llegado, y el bucle lo lee de aquí.
    const liveRef = useRef(null);
    const [, forceTick] = useState(0);
    liveRef.current = { world, statusOf: p.statusOf };

    // Firma del mundo: si cambia, se reconstruyen los actores conservando
    // posiciones. Sin esto, editar un área haría saltar a todo el personal.
    const sig = wsArr(world.staff).map((x) => x.id + x.areaId + x.stationId).join('|')
      + '#' + wsArr(world.areas).map((a) => a.id + a.x + a.y + a.w + a.h).join('|');

    if (!simRef.current || simRef.current.sig !== sig) {
      simRef.current = { sig, sim: wsSimInit(world, simRef.current ? simRef.current.sim : null) };
    }

    useEffect(() => {
      const reduce = (globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || false;
      if (reduce || typeof requestAnimationFrame !== 'function') return undefined;
      let last = 0; let acc = 0; let stop = false;
      const loop = (ts) => {
        if (stop) return;
        rafRef.current = requestAnimationFrame(loop);
        // Pausa real cuando la pestaña no se ve: no gastar CPU de nadie.
        if (globalThis.document && document.hidden) { last = ts; return; }
        const dt = last ? (ts - last) / 1000 : 0;
        last = ts;
        acc += dt;
        if (acc < 1 / 24) return;              // se repinta a 24 fps como techo
        const cur = simRef.current;
        const live = liveRef.current || { world, statusOf: p.statusOf };
        if (cur) cur.sim = wsSimStep(cur.sim, live.world, acc, live.statusOf);
        acc = 0;
        forceTick((x) => (x + 1) % 1000000);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => { stop = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [sig]);

    const sim = simRef.current ? simRef.current.sim : wsSimInit(world, null);
    const areas = wsArr(world.areas);
    const g = wsObj(world.grid);

    // Rejilla del suelo.
    const lines = [];
    if (pr.kind === 'hotel') {
      for (let i = 0; i <= wsNum(g.w, 16); i++) {
        const a0 = pr.to(i, 0); const b0 = pr.to(i, wsNum(g.h, 12));
        lines.push(h('line', { key: 'v' + i, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
      for (let j = 0; j <= wsNum(g.h, 12); j++) {
        const a0 = pr.to(0, j); const b0 = pr.to(wsNum(g.w, 16), j);
        lines.push(h('line', { key: 'h' + j, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
    } else {
      for (let i = 0; i <= wsNum(g.w, 16); i++) {
        const a0 = pr.to(i, 0); const b0 = pr.to(i, wsNum(g.h, 12));
        lines.push(h('line', { key: 'v' + i, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
      for (let j = 0; j <= wsNum(g.h, 12); j++) {
        const a0 = pr.to(0, j); const b0 = pr.to(wsNum(g.w, 16), j);
        lines.push(h('line', { key: 'h' + j, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
    }

    // Los avatares se pintan de arriba abajo para que el de delante tape al
    // de detrás: sin esto la escena se ve plana y desordenada.
    const actors = wsArr(sim.actors).slice().sort((a, b) => (a.y + a.x) - (b.y + b.x));

    return h('svg', {
      className: 'ws-surface', viewBox: '0 0 ' + pr.width + ' ' + pr.height,
      width: '100%', height: pr.height, role: 'img',
      'aria-label': 'Mapa de la organización con ' + areas.length + ' áreas y ' + actors.length + ' avatares',
    }, [
      h('rect', { key: 'bg', x: 0, y: 0, width: pr.width, height: pr.height, className: 'ws-ground' }),
      h('g', { key: 'grid' }, lines),
      h('g', { key: 'areas' }, areas.map((a) => h(WsStructure, {
        key: a.id, area: a, pr, selected: p.selArea === a.id,
        onClick: () => p.onSelectArea && p.onSelectArea(a.id),
      }))),
      h('g', { key: 'actors' }, actors.map((a) => {
        const q = pr.to(a.x, a.y);
        return h(WsAvatar, { key: a.id, actor: a, px: q.x, py: q.y, t: wsNum(sim.t, 0),
          scale: pr.kind === 'hotel' ? 1.15 : 1.25, selected: p.selStaff === a.id,
          onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (p.onSelectStaff) p.onSelectStaff(a.id); } });
      })),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Producción: Storyboard, Timeline, Prompts, Audio, Trabajos, Editor
  // ═════════════════════════════════════════════════════════════════════════

  function StoryboardView() {
    const sb = model.storyboard;
    if (!sb) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'storyboard' }));
    const scenes = arr(sb.scenes);
    const sel = ui.sceneSel && scenes.find((x) => x.id === ui.sceneSel) ? ui.sceneSel : (scenes[0] || {}).id;
    const scene = scenes.find((x) => x.id === sel) || null;

    const editScene = (k, v) => patch((m) => {
      const t = arr(m.storyboard.scenes).find((x) => x.id === sel);
      if (!t) return;
      t[k] = v;
      m.storyboard.totalSec = retime(m.storyboard.scenes);
    });
    const propagate = () => runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'brand-consistency', 'analytics'], 'Actualización');

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Storyboard',
        subtitle: scenes.length + ' escenas · ' + fmtSec(num(sb.totalSec, 0)) + ' · ritmo ' + num(obj(sb.pacing).cutsPerMin, 0) + ' cortes/min',
        actions: [
          h(Btn, { key: 'a', onClick: () => dispatch({ type: 'ADD_SCENE', payload: { role: 'demo', afterCode: scene ? scene.code : '' } }) }, '+ Escena'),
          h(Btn, { key: 'p', variant: 'ghost', onClick: propagate }, 'Propagar cambios'),
          h(Btn, { key: 'r', variant: 'ghost', onClick: () => runStages(['storyboard'], 'Storyboard') }, 'Regenerar'),
        ] }),

      h('div', { className: 'ks-sbgrid', key: 'g' }, [
        h('div', { className: 'ks-sbcards', key: 'c' }, scenes.map((sc) => h('div', {
          key: sc.id, className: cx('ks-scene', sc.id === sel && 'ks-scene-sel', 'ks-role-' + sc.role),
          onClick: () => setUi({ sceneSel: sc.id }),
        }, [
          h('div', { className: 'ks-scene-head', key: 'h' }, [
            h('span', { className: 'ks-scene-code', key: 'c' }, sc.code),
            h('span', { className: 'ks-scene-role', key: 'r' }, sc.roleLabel),
            h('span', { className: 'ks-scene-dur', key: 'd' }, fmtSec(sc.durationSec)),
          ]),
          h('div', { className: 'ks-scene-frame', key: 'f' }, [
            h('span', { className: 'ks-scene-shot', key: 's' }, labelOf(SHOTS, sc.shot)),
            h('span', { className: 'ks-scene-move', key: 'm' }, labelOf(MOVES, sc.move)),
          ]),
          h('p', { className: 'ks-scene-desc', key: 'd' }, sc.description),
          s(sc.onScreenText) ? h('div', { className: 'ks-scene-text', key: 't' }, '« ' + sc.onScreenText + ' »') : null,
          h('div', { className: 'ks-scene-tags', key: 'g' }, [
            h('span', { key: 'l' }, labelOf(LENSES, sc.lens)),
            h('span', { key: 'i' }, labelOf(LIGHTING, sc.lighting)),
            h('span', { key: 'c' }, labelOf(GRADES, sc.grade)),
          ].concat(arr(sc.fx).map((f, i) => h('span', { key: 'f' + i, className: 'ks-tag-fx' }, labelOf(FX, f))))),
        ]))),

        scene ? h('aside', { className: 'ks-sbside', key: 's' }, [
          h('div', { className: 'ks-sbside-head', key: 'h' }, [
            h('strong', { key: 't' }, scene.code + ' · ' + scene.roleLabel),
            h(Btn, { key: 'd', size: 'xs', variant: 'danger', disabled: scenes.length <= 2,
              onClick: () => dispatch({ type: 'REMOVE_SCENE', payload: { sceneId: scene.id } }) }, 'Eliminar'),
          ]),
          h('p', { className: 'ks-hint', key: 'p' }, scene.purpose),
          h(Field, { key: 'du', label: 'Duración (s)' },
            h(TextInput, { type: 'number', step: '0.1', value: scene.durationSec, onChange: (v) => editScene('durationSec', clamp(v, 0.3, 60)) })),
          h(Field, { key: 'sh', label: 'Encuadre' }, h(Select, { value: scene.shot, options: optsOf(SHOTS), onChange: (v) => editScene('shot', v) })),
          h(Field, { key: 'an', label: 'Ángulo' }, h(Select, { value: scene.angle, options: optsOf(ANGLES), onChange: (v) => editScene('angle', v) })),
          h(Field, { key: 'le', label: 'Óptica' }, h(Select, { value: scene.lens, options: optsOf(LENSES), onChange: (v) => editScene('lens', v) })),
          h(Field, { key: 'mo', label: 'Movimiento' }, h(Select, { value: scene.move, options: optsOf(MOVES), onChange: (v) => editScene('move', v) })),
          h(Field, { key: 'li', label: 'Iluminación' }, h(Select, { value: scene.lighting, options: optsOf(LIGHTING), onChange: (v) => editScene('lighting', v) })),
          h(Field, { key: 'gr', label: 'Etalonaje' }, h(Select, { value: scene.grade, options: optsOf(GRADES), onChange: (v) => editScene('grade', v) })),
          h(Field, { key: 'tr', label: 'Transición de entrada' }, h(Select, { value: scene.transitionIn, options: optsOf(TRANSITIONS), onChange: (v) => editScene('transitionIn', v) })),
          h(Field, { key: 'fx', label: 'Efectos' }, h('div', { className: 'ks-fxpick' }, FX.filter((f) => f.id !== 'none').map((f) => h(Chip, {
            key: f.id, tone: arr(scene.fx).indexOf(f.id) >= 0 ? 'accent' : null, onClick: () => {
              const cur = arr(scene.fx);
              editScene('fx', cur.indexOf(f.id) >= 0 ? cur.filter((x) => x !== f.id) : cur.concat([f.id]));
            },
          }, f.label)))),
          h(Field, { key: 'os', label: 'Texto en pantalla' },
            h(TextInput, { value: scene.onScreenText, onChange: (v) => editScene('onScreenText', v) })),
          h(Field, { key: 'de', label: 'Descripción' },
            h(TextArea, { value: scene.description, rows: 4, onChange: (v) => editScene('description', v) })),
          h(Field, { key: 'no', label: 'Notas de producción' },
            h(TextArea, { value: scene.notes, rows: 2, onChange: (v) => editScene('notes', v) })),
          h('label', { className: 'ks-check', key: 'pv' }, [
            h('input', { key: 'i', type: 'checkbox', checked: !!scene.productVisible, onChange: (e) => editScene('productVisible', e.target.checked) }),
            h('span', { key: 's' }, 'El producto es visible'),
          ]),
          h('p', { className: 'ks-hint', key: 'sn' }, 'Sonido: ' + s(scene.soundNote)),
        ]) : null,
      ]),

      arr(sb.variants).length ? h(Card, { key: 'v', title: 'Variantes para test A/B' }, [
        h('div', { className: 'ks-variants', key: 'v' }, arr(sb.variants).map((v) => h('div', { key: v.id, className: 'ks-variant' }, [
          h('strong', { key: 'l' }, v.label + ' · ' + v.aspect + ' · ' + fmtSec(v.durationSec)),
          h('p', { className: 'ks-hint', key: 'hy' }, 'Hipótesis: ' + v.hypothesis),
          h('div', { className: 'ks-chips', key: 'c' }, arr(v.scenes).map((sc) => h(Chip, { key: sc.id, title: sc.description }, sc.code + ' ' + sc.roleLabel))),
        ]))),
      ]) : null,

      h(Card, { key: 'f', title: 'Cortes por formato' }, [
        h('div', { className: 'ks-formats', key: 'f' }, Object.keys(obj(sb.formats)).map((a) => {
          const f = sb.formats[a];
          const fScenes = scenesOfFormat(sb, a);
          return h('div', { key: a, className: 'ks-format' }, [
            h('strong', { key: 'a' }, a + (f.isMaster ? ' · maestro' : '') + ' · '
              + fmtSec(masterTimes(fScenes).total) + ' · ' + fScenes.length + ' escenas'),
            h('div', { className: 'ks-chips', key: 'd' }, arr(f.dims).map((d) => h(Chip, { key: d.res }, d.label + ' ' + d.w + '×' + d.h))),
            h('p', { className: 'ks-hint', key: 'n' }, f.note),
          ]);
        })),
      ]),
    ]);
  }

  // ── Timeline ───────────────────────────────────────────────────────────
  function TimelineView() {
    const ed = model.edit;
    const sb = obj(model.storyboard);
    if (!ed) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'video-editor' }));
    const tl = obj(ed.timeline);
    const total = Math.max(0.1, num(ed.totalSec, 1));
    const pctOf = (v) => (num(v, 0) / total) * 100;
    const ticks = [];
    const step = total > 60 ? 10 : total > 20 ? 5 : 2;
    for (let t = 0; t <= total; t += step) ticks.push(t);

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Timeline',
        subtitle: fmtSec(total) + ' · ' + num(ed.fps, 25) + ' fps · ' + arr(tl.video).length + ' clips',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['video-editor'], 'Video Editor') }, 'Recalcular montaje')] }),
      h(Card, { key: 't', flush: true }, [
        h('div', { className: 'ks-tl', key: 'tl' }, [
          h('div', { className: 'ks-tl-ruler', key: 'r' }, ticks.map((t) => h('span', {
            key: t, className: 'ks-tl-tick', style: { left: pctOf(t) + '%' },
          }, fmtSec(t)))),
          h('div', { className: 'ks-tl-track', key: 'v' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Vídeo'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.video).map((c) => h('div', {
              key: c.sceneId, className: cx('ks-tl-clip', 'ks-role-' + c.role, ui.sceneSel === c.sceneId && 'ks-tl-sel'),
              style: { left: pctOf(c.startSec) + '%', width: Math.max(1.2, pctOf(c.durationSec)) + '%' },
              title: c.code + ' · ' + fmtSec(c.durationSec) + ' · ' + labelOf(GRADES, c.grade),
              onClick: () => setUi({ sceneSel: c.sceneId, view: 'storyboard' }),
            }, [h('span', { key: 'c' }, c.code), c.speed !== 1 ? h('em', { key: 's' }, '×' + c.speed) : null]))),
          ]),
          h('div', { className: 'ks-tl-track', key: 'ti' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Títulos'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.titles).map((t, i) => h('div', {
              key: i, className: 'ks-tl-clip ks-tl-title',
              style: { left: pctOf(t.startSec) + '%', width: Math.max(1.2, pctOf(t.endSec - t.startSec)) + '%' },
              title: t.text,
            }, h('span', { key: 't' }, t.text)))),
          ]),
          h('div', { className: 'ks-tl-track', key: 'vo' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Locución'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.voice).map((v, i) => h('div', {
              key: i, className: 'ks-tl-clip ks-tl-vo',
              style: { left: pctOf(v.startSec) + '%', width: Math.max(1.2, pctOf(v.durationSec)) + '%' },
              title: v.text,
            }, h('span', { key: 't' }, v.code)))),
          ]),
          h('div', { className: 'ks-tl-track', key: 'mu' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Música'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, [
              h('div', { key: 'm', className: 'ks-tl-clip ks-tl-music', style: { left: '0%', width: '100%' },
                title: 'Ducking automático bajo la locución' }, h('span', { key: 't' }, s(obj(model.audio).music ? model.audio.music.genre : 'música'))),
            ]),
          ]),
          arr(tl.sfx).length ? h('div', { className: 'ks-tl-track', key: 'sx' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Efectos'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.sfx).map((x, i) => h('div', {
              key: i, className: 'ks-tl-clip ks-tl-sfx', style: { left: pctOf(x.startSec) + '%', width: '1.5%' }, title: x.code,
            }))),
          ]) : null,
        ]),
      ]),
      h(Card, { key: 'l', title: 'Lista de planos' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['#', 'Entrada', 'Duración', 'Rol', 'Transición', 'Velocidad', 'Fuente'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(tl.video).map((c) => h('tr', { key: c.sceneId }, [
            h('td', { key: 'a' }, c.code), h('td', { key: 'b' }, fmtSec(c.startSec)), h('td', { key: 'c' }, fmtSec(c.durationSec)),
            h('td', { key: 'd' }, c.role), h('td', { key: 'e' }, labelOf(TRANSITIONS, c.transitionIn)),
            h('td', { key: 'f' }, '×' + c.speed), h('td', { key: 'g' }, h('code', {}, c.source)),
          ]))),
        ]),
      ]),
    ]);
  }

  // ── Prompts ────────────────────────────────────────────────────────────
  function PromptsView() {
    const pr = model.prompts;
    if (!pr) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'prompt-engineer' }));
    const cap = s(ui.promptCap) || 'video';
    const list = cap === 'image' ? arr(pr.image) : cap === 'video' ? arr(pr.video)
      : cap === 'voice' ? arr(obj(model.audio).vo).map((v) => ({ code: v.code, role: 'locución', providerId: v.providerId, text: v.text, params: v.params, negative: '' }))
        : [{ code: 'MUS', role: 'música', providerId: s(obj(obj(model.audio).music).providerId), text: s(obj(obj(model.audio).music).prompt), params: obj(obj(model.audio).music).params, negative: '' }];
    const capProv = cap === 'image' ? 'image' : cap === 'video' ? 'video' : cap === 'voice' ? 'voice' : 'music';
    const current = getProvider(model.settings.providers[capProv]);
    const warnings = uniq([].concat.apply([], list.map((x) => arr(x.warnings))));

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Prompts',
        subtitle: 'Un PromptSpec neutral por escena, traducido al dialecto del proveedor. Cambia de modelo y se reescribe todo.',
        actions: [
          h(Btn, { key: 'c', onClick: () => copyText(list.map((x) => x.code + '\n' + x.text).join('\n\n---\n\n'), 'Prompts') }, 'Copiar todos'),
          h(Btn, { key: 'd', onClick: () => download(slug(model.title) + '-prompts.csv', exportPromptsCsv(model), 'text/csv') }, 'CSV'),
        ] }),

      h(Card, { key: 'sel' }, [
        h('div', { className: 'ks-tabs', key: 't' }, [
          { id: 'image', label: '🖼️ Imagen (' + arr(pr.image).length + ')' },
          { id: 'video', label: '🎬 Vídeo (' + arr(pr.video).length + ')' },
          { id: 'voice', label: '🎙️ Voz (' + arr(obj(model.audio).vo).length + ')' },
          { id: 'music', label: '🎵 Música' },
        ].map((t) => h('button', {
          key: t.id, type: 'button', className: cx('ks-tab', cap === t.id && 'ks-tab-on'),
          onClick: () => setUi({ promptCap: t.id }),
        }, t.label))),
        h('div', { className: 'ks-provrow', key: 'p' }, [
          h(Field, { key: 'p', label: 'Proveedor de ' + capProv },
            h(Select, { value: s(model.settings.providers[capProv]),
              options: providersFor(capProv).map((x) => ({ value: x.id, label: x.label })),
              onChange: (v) => dispatch({ type: 'SET_PROVIDER', payload: { capability: capProv, providerId: v } }) })),
          current ? h('div', { className: 'ks-provinfo', key: 'i' }, [
            h('span', { key: 'd' }, 'Dialecto: ' + s(current.dialect)),
            h('span', { key: 'n' }, current.negative ? 'Soporta negativo' : 'Sin prompt negativo'),
            h('span', { key: 'a' }, 'Aspectos: ' + arr(current.aspects).join(', ')),
            current.maxSec ? h('span', { key: 's' }, 'Máx. ' + current.maxSec + ' s por toma') : null,
            current.cost ? h('span', { key: 'c' }, fmtMoney(current.cost.amount, current.cost.currency) + ' / ' + current.cost.unit) : null,
            current.docs ? h('a', { key: 'l', href: current.docs, target: '_blank', rel: 'noreferrer' }, 'Documentación') : null,
          ]) : null,
        ]),
        current && arr(current.params).length ? h('div', { className: 'ks-grid ks-grid-4', key: 'pp' },
          arr(current.params).map((pm) => h(Field, { key: pm.key, label: pm.label },
            pm.type === 'select' ? h(Select, {
              value: s(obj(obj(model.settings.providerParams)[current.id])[pm.key] !== undefined
                ? obj(obj(model.settings.providerParams)[current.id])[pm.key] : pm.default),
              options: arr(pm.options).map((o) => ({ value: s(o), label: s(o) })),
              onChange: (v) => setProviderParam(current.id, pm.key, v),
            }) : pm.type === 'boolean' ? h(Toggle, {
              value: obj(obj(model.settings.providerParams)[current.id])[pm.key] !== undefined
                ? !!obj(obj(model.settings.providerParams)[current.id])[pm.key] : !!pm.default,
              onChange: (v) => setProviderParam(current.id, pm.key, v),
            }) : h(TextInput, {
              type: pm.type === 'number' ? 'number' : 'text', min: pm.min, max: pm.max,
              value: obj(obj(model.settings.providerParams)[current.id])[pm.key] !== undefined
                ? obj(obj(model.settings.providerParams)[current.id])[pm.key] : pm.default,
              onChange: (v) => setProviderParam(current.id, pm.key, v),
            }))) ) : null,
        warnings.length ? h('div', { className: 'ks-warnbox', key: 'w' }, [
          h('strong', { key: 't' }, 'Avisos del proveedor'),
          h('ul', { className: 'ks-list', key: 'l' }, warnings.map((w, i) => h('li', { key: i }, w))),
        ]) : null,
      ]),

      h('div', { className: 'ks-prompts', key: 'l' }, list.map((p, i) => h('div', { key: p.code + i, className: 'ks-prompt' }, [
        h('div', { className: 'ks-prompt-head', key: 'h' }, [
          h('span', { className: 'ks-prompt-code', key: 'c' }, p.code),
          h('span', { className: 'ks-prompt-role', key: 'r' }, p.role),
          p.durationSec ? h('span', { className: 'ks-prompt-dur', key: 'd' }, fmtSec(p.durationSec)) : null,
          h('span', { className: 'ks-prompt-prov', key: 'p' }, p.providerId),
          h(Btn, { key: 'b', size: 'xs', onClick: () => copyText(p.text, 'Prompt ' + p.code) }, 'Copiar'),
        ]),
        h('pre', { className: 'ks-prompt-text', key: 't' }, s(p.text)),
        s(p.negative) ? h('div', { className: 'ks-prompt-neg', key: 'n' }, [h('strong', { key: 'l' }, 'Negativo: '), s(p.negative)]) : null,
        Object.keys(obj(p.params)).length ? h('div', { className: 'ks-prompt-params', key: 'p' },
          Object.keys(obj(p.params)).map((k) => h('span', { key: k }, k + ': ' + s(JSON.stringify(p.params[k])).replace(/^"|"$/g, '')))) : null,
        p.payload ? h(CodeBlock, { key: 'pl', title: 'Payload del workflow', content: JSON.stringify(p.payload, null, 2) }) : null,
      ]))),
    ]);
  }

  function setProviderParam(providerId, key, value) {
    patch((m) => {
      const bag = obj(m.settings.providerParams);
      bag[providerId] = Object.assign(obj(bag[providerId]), { [key]: value });
      m.settings.providerParams = bag;
    });
    runStages(['prompt-engineer', 'voice-director', 'video-producer'], 'Parámetros');
  }

  // ── Voz y música ───────────────────────────────────────────────────────
  function AudioView() {
    const au = model.audio;
    if (!au) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'voice-director' }));
    const mu = obj(au.music);
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Voz y música',
        subtitle: arr(au.vo).length + ' líneas · ' + num(au.voWords, 0) + ' palabras · ' + num(au.voChars, 0) + ' caracteres',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['voice-director'], 'Voice Director') }, 'Regenerar audio')] }),
      arr(au.overflow).length ? h('div', { className: 'ks-warnbox', key: 'w' },
        'Estas líneas siguen sin caber en su plano: ' + arr(au.overflow).join(', ') + '. Alarga la escena.') : null,
      arr(au.trimmed).length ? h('p', { className: 'ks-hint', key: 'tr' },
        'Ajustadas al metraje por el Voice Director: ' + arr(au.trimmed).join(', ')
        + '. Alarga esas escenas si quieres el texto completo.') : null,
      h(Card, { key: 'vo', title: 'Guion de locución' }, [
        h('p', { className: 'ks-hint', key: 'c' }, s(obj(au.voiceProfile).casting)),
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Escena', 'Entrada', 'Texto', 'Palabras', 'Estimado', 'Cabe'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(au.vo).map((v) => h('tr', { key: v.sceneId, className: v.fits ? '' : 'ks-row-bad' }, [
            h('td', { key: 'a' }, v.code), h('td', { key: 'b' }, fmtSec(v.startSec)),
            h('td', { key: 'c' }, h('input', { className: 'ks-input ks-input-inline', value: s(v.text),
              onChange: (e) => patch((m) => { const t = arr(m.audio.vo).find((x) => x.sceneId === v.sceneId); if (t) t.text = e.target.value; }) })),
            h('td', { key: 'd' }, v.words), h('td', { key: 'e' }, fmtSec(v.estimatedSec)),
            h('td', { key: 'f' }, v.fits ? '✓' : '✕'),
          ]))),
        ]),
        h('div', { className: 'ks-cardfoot', key: 'f' }, [
          h(Btn, { key: 'c', size: 'sm', onClick: () => copyText(arr(au.vo).map((v) => v.code + ': ' + v.text).join('\n'), 'Guion') }, 'Copiar guion'),
          h(Btn, { key: 's', size: 'sm', onClick: () => download(slug(model.title) + '.srt', s(obj(model.edit).srt), 'text/plain') }, 'Descargar SRT'),
        ]),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'm', title: 'Música' }, [
          h('div', { className: 'ks-kv', key: 'k' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Género'), h('strong', { key: 'b' }, s(mu.genre))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'BPM'), h('strong', { key: 'b' }, s(mu.bpm))]),
            h('div', { key: '3' }, [h('span', { key: 'a' }, 'Proveedor'), h('strong', { key: 'b' }, s(mu.providerId))]),
            h('div', { key: '4' }, [h('span', { key: 'a' }, 'Duración'), h('strong', { key: 'b' }, fmtSec(mu.durationSec))]),
          ]),
          h('p', { className: 'ks-lead', key: 'md' }, s(mu.mood)),
          h(CodeBlock, { key: 'p', title: 'Prompt de música', content: s(mu.prompt) }),
          h('h4', { className: 'ks-h4', key: 'h' }, 'Estructura'),
          h('ul', { className: 'ks-list', key: 'l' }, arr(mu.structure).map((x, i) => h('li', { key: i }, fmtSec(x.at) + ' · ' + x.label + ' — ' + x.note))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'Mezcla'),
          h('ul', { className: 'ks-list', key: 'l2' }, arr(mu.mixNotes).map((x, i) => h('li', { key: i }, x))),
        ]),
        h(Card, { key: 's', title: 'Ambiente y efectos' }, [
          h('h4', { className: 'ks-h4', key: 'h1' }, 'Efectos puntuales'),
          h('ul', { className: 'ks-list', key: 'l1' }, arr(au.sfx).map((x, i) => h('li', { key: i },
            h('span', {}, [h('code', { key: 'c' }, x.code), ' ' + fmtSec(x.atSec) + ' — ' + s(x.prompt || x.text)])))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'Ambiente por escena'),
          h('ul', { className: 'ks-list', key: 'l2' }, arr(au.ambience).map((x, i) => h('li', { key: i }, x.code + ' — ' + x.text))),
        ]),
      ]),
    ]);
  }

  // ── Trabajos de producción ─────────────────────────────────────────────
  function JobsView() {
    const pr = model.production;
    if (!pr) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'video-producer' }));
    const jobs = arr(pr.jobs);
    const byStatus = JOB_STATUS.reduce((acc, st0) => { acc[st0] = jobs.filter((j) => j.status === st0).length; return acc; }, {});
    const done = byStatus.done || 0;
    const pct = jobs.length ? Math.round((done / jobs.length) * 100) : 0;
    const pending = jobs.filter((j) => j.status === 'pending');
    const ready = jobs.length > 0 && !pending.length;
    const next = readyJobs(model, 12);
    const missingFiles = jobs.filter((j) => s(j.file) && j.status !== 'done');

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Producción',
        subtitle: done + ' de ' + jobs.length + ' archivos generados · coste estimado '
          + fmtMoney(num(obj(pr.totals).cost, 0), 'USD') + ' · ~' + num(pr.estMinutes, 0) + ' min de máquina',
        actions: [
          h(Btn, { key: 'b', variant: ready ? 'primary' : 'ghost',
            onClick: () => download(slug(model.title) + '-render.sh', exportRenderBundle(model, assets), 'text/x-shellscript'),
            title: ready ? 'Descarga, une y renderiza todo' : 'Se descargará lo que ya esté registrado' },
            'Bundle de render'),
          h(Btn, { key: 'm', onClick: () => download(slug(model.title) + '-assets.json', exportAssetsManifest(model, assets), 'application/json') }, 'Manifiesto'),
          h(Btn, { key: 'c', onClick: () => download(slug(model.title) + '-jobs.csv', exportJobsCsv(model), 'text/csv') }, 'CSV'),
          h(Btn, { key: 'r', variant: 'ghost', onClick: () => runStages(['video-producer'], 'Video Producer') }, 'Recalcular'),
        ] }),

      h(Card, { key: 'prog', title: ready ? 'Listo para renderizar' : 'Progreso' }, [
        h(Bar, { key: 'b', value: pct, tone: ready ? 'ok' : 'accent' }),
        h('p', { className: 'ks-lead', key: 'p' }, ready
          ? 'Todos los archivos están registrados. Descarga el bundle de render y ejecútalo: baja los assets, une las tomas partidas, escribe los subtítulos y monta los '
            + arr(obj(model.edit).exports).length + ' entregables.'
          : pending.length + ' archivo(s) por generar. ' + next.length + ' se pueden hacer ahora mismo'
            + (next.length && next[0].stage === 'keyframe' ? ' (keyframes: valida el producto antes de animar).' : '.')),
        h('div', { className: 'ks-grid ks-grid-4', key: 's' }, JOB_STATUS.slice(0, 4).map((st0) => h(Stat, {
          key: st0, label: st0, value: byStatus[st0] || 0,
          tone: st0 === 'done' ? 'ok' : st0 === 'failed' ? 'bad' : null,
        }))),
        ready ? null : h('p', { className: 'ks-hint', key: 'cmd' },
          'Desde el chat de KIMOS basta con: «produce el material pendiente de Kreative Studio». '
          + 'El agente llama a RUN_PRODUCTION, genera el lote con sus modelos y lo devuelve con REGISTER_ASSETS; '
          + 'repite hasta terminar.'),
      ]),

      next.length ? h(Card, { key: 'next', title: 'Siguiente lote (' + next.length + ')' }, [
        h('div', { className: 'ks-nextjobs', key: 'l' }, next.map((j) => h('div', { key: j.id, className: 'ks-nextjob' }, [
          h('span', { className: 'ks-nextjob-kind', key: 'k' }, (CAPABILITIES.find((c0) => c0.id === j.kind) || {}).emoji || '•'),
          h('div', { key: 'b' }, [
            h('strong', { key: 'l' }, j.label),
            h('span', { className: 'ks-nextjob-meta', key: 'm' }, j.providerLabel + ' → ' + j.file),
          ]),
          h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(j.prompt, 'Prompt ' + j.code) }, 'Prompt'),
        ]))),
      ]) : null,

      missingFiles.length ? h(Card, { key: 'miss', title: 'Archivos que faltan para el montaje' }, [
        h('p', { className: 'ks-hint', key: 'i' },
          'El script de render espera estas rutas. Cada una se rellena sola al registrar el asset de su trabajo.'),
        h('div', { className: 'ks-chips', key: 'c' }, missingFiles.slice(0, 40).map((j) => h(Chip, { key: j.id, tone: 'bad' }, j.file))),
      ]) : null,

      h(Card, { key: 'g', title: 'Cómo ejecutar' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(pr.guidance).map((x, i) => h('li', { key: i }, x))),
      ]),
      h(Card, { key: 'j', flush: true }, [
        h('table', { className: 'ks-table ks-table-jobs', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['#', 'Trabajo', 'Proveedor', 'Cantidad', 'Coste est.', 'Estado', ''].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, jobs.map((j) => h('tr', { key: j.id, className: 'ks-job-' + j.status }, [
            h('td', { key: 'a' }, j.order + 1),
            h('td', { key: 'b' }, [h('strong', { key: 'l' }, j.label), h('div', { className: 'ks-job-prompt', key: 'p', title: j.prompt }, s(j.prompt).slice(0, 120) + (s(j.prompt).length > 120 ? '…' : ''))]),
            h('td', { key: 'c' }, j.providerLabel),
            h('td', { key: 'd' }, j.billableQty + ' ' + j.costUnit),
            h('td', { key: 'e' }, fmtMoney(j.estCostUsd, 'USD')),
            h('td', { key: 'f' }, h(Select, { value: j.status, options: JOB_STATUS.map((x) => ({ value: x, label: x })),
              onChange: (v) => dispatch({ type: 'SET_JOB_STATUS', payload: { jobId: j.id, status: v } }) })),
            h('td', { key: 'g' }, h(Btn, { size: 'xs', onClick: () => copyText(j.prompt, 'Prompt ' + j.code) }, 'Copiar')),
          ]))),
        ]),
      ]),
    ]);
  }

  // ── Editor ─────────────────────────────────────────────────────────────
  function EditorView() {
    const ed = model.edit;
    if (!ed) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'video-editor' }));
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Editor',
        subtitle: arr(ed.exports).length + ' entregables · ' + fmtSec(num(ed.totalSec, 0)) + ' · ' + num(ed.fps, 25) + ' fps',
        actions: [
          h(Btn, { key: 'f', variant: 'primary', onClick: () => download('montaje-' + slug(model.title) + '.sh', s(ed.ffmpeg), 'text/x-shellscript') }, 'Descargar script'),
          h(Btn, { key: 's', onClick: () => download(slug(model.title) + '.srt', s(ed.srt), 'text/plain') }, 'SRT'),
          h(Btn, { key: 'e', onClick: () => download(slug(model.title) + '.edl', s(ed.edl), 'text/plain') }, 'EDL'),
        ] }),
      h(Card, { key: 'x', title: 'Entregables' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Archivo', 'Formato', 'Resolución', 'Píxeles', 'Bitrate', 'Plataformas'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(ed.exports).map((e) => h('tr', { key: e.id }, [
            h('td', { key: 'a' }, h('code', {}, e.filename)), h('td', { key: 'b' }, e.aspect),
            h('td', { key: 'c' }, byId(RESOLUTIONS, e.resolution).label), h('td', { key: 'd' }, e.width + '×' + e.height),
            h('td', { key: 'e' }, e.bitrateMbps + ' Mb/s'),
            h('td', { key: 'f' }, arr(e.platforms).length ? arr(e.platforms).join(', ') : '—'),
          ]))),
        ]),
      ]),
      h(Card, { key: 'c', title: 'Comprobaciones antes de exportar' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(ed.checklist).map((x, i) => h('li', { key: i }, x))),
      ]),
      h(CodeBlock, { key: 'ff', title: 'Script de montaje FFmpeg', content: s(ed.ffmpeg),
        filename: 'montaje-' + slug(model.title) + '.sh', mime: 'text/x-shellscript' }),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(CodeBlock, { key: 's', title: 'Subtítulos (SRT)', content: s(ed.srt), filename: slug(model.title) + '.srt' }),
        h(CodeBlock, { key: 'e', title: 'Lista de decisiones (EDL)', content: s(ed.edl), filename: slug(model.title) + '.edl' }),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Flujo de agentes — visible y editable, en dos formas
  //
  // Un único modelo (workflowPlan) y cuatro presentaciones. Las acciones son
  // las mismas en todas: seleccionar, ejecutar, apagar/encender y reordenar.
  // Cambiar de forma no cambia lo que puedes hacer, solo cómo se ve.
  // ═════════════════════════════════════════════════════════════════════════

  /** Acciones del flujo, compartidas por los cuatro renderizadores. */
  function flowActions() {
    return {
      select: (id) => setUi({ flowSel: id }),
      run: (id) => { const a = agentById(id); if (a) runStages([id], a.name); },
      toggle: (id) => {
        patch((m) => {
          const off = arr(m.settings.workflow.disabled);
          m.settings.workflow.disabled = off.indexOf(id) >= 0 ? off.filter((x) => x !== id) : off.concat([id]);
          logLine(m, 'info', 'Agente «' + (agentById(id) || {}).name + '» '
            + (off.indexOf(id) >= 0 ? 'reactivado' : 'desactivado') + ' en el flujo.');
        });
      },
      move: (id, dir) => {
        patch((m) => {
          const cur = effectiveOrder(m).slice();
          const i = cur.indexOf(id);
          const j = i + (dir < 0 ? -1 : 1);
          if (i < 0 || j < 0 || j >= cur.length) return;
          cur.splice(j, 0, cur.splice(i, 1)[0]);
          m.settings.workflow.order = cur;
        });
        // effectiveOrder corrige el orden si el movimiento rompía una
        // dependencia; se avisa para que no parezca que el botón no hizo nada.
        const after = effectiveOrder(model);
        const wanted = arr(model.settings.workflow.order);
        if (wanted.join('|') !== after.join('|')) {
          patch((m) => { m.settings.workflow.order = after; });
          notify('info', 'Ese orden rompía una dependencia; se ha colocado en la posición válida más cercana.');
        }
      },
      reset: () => {
        patch((m) => { m.settings.workflow = { order: [], disabled: [] }; });
        notify('success', 'Flujo restablecido al orden de fábrica.');
      },
    };
  }

  // ── Sprites (SVG con rejilla de píxeles; nada externo, ni una imagen) ───
  const pxRect = (x, y, w, hh, fill, key) => h('rect', { key, x, y, width: w, height: hh, fill });

  /** Laboratorio en píxeles: cuerpo, tejado, puerta y ventana. */
  function LabSprite(props) {
    const p = obj(props);
    const on = p.status === 'done';
    const wall = p.off ? '#9AA0A0' : on ? '#F0F0E0' : '#D8D8C8';
    const roof = p.off ? '#6A7070' : on ? '#D83830' : '#A85850';
    const glass = p.off ? '#586060' : on ? '#68C8F8' : '#3868A8';
    return h('svg', { className: 'ks-sprite', viewBox: '0 0 16 16', width: p.size || 48, height: p.size || 48,
      style: { shapeRendering: 'crispEdges' }, 'aria-hidden': 'true' }, [
      pxRect(2, 6, 12, 9, wall, 'w'),
      pxRect(1, 4, 14, 2, roof, 'r'),
      pxRect(3, 3, 10, 1, roof, 'r2'),
      pxRect(4, 8, 3, 3, glass, 'g1'),
      pxRect(9, 8, 3, 3, glass, 'g2'),
      pxRect(7, 11, 2, 4, p.off ? '#4A5050' : '#785840', 'd'),
      pxRect(0, 15, 16, 1, '#3A6048', 'ground'),
    ]);
  }

  /** Mueble isométrico: tapa, frente y lateral. */
  function FurniSprite(props) {
    const p = obj(props);
    const on = p.status === 'done';
    const top = p.off ? '#5B6B7B' : on ? '#7ADFA0' : '#8FB4D8';
    const front = p.off ? '#3E4C5A' : on ? '#4CB075' : '#5D82A6';
    const side = p.off ? '#32404C' : on ? '#3B8C5E' : '#476A8A';
    return h('svg', { className: 'ks-sprite', viewBox: '0 0 32 28', width: p.size || 56, height: (p.size || 56) * 0.875,
      'aria-hidden': 'true' }, [
      h('polygon', { key: 't', points: '16,2 31,10 16,18 1,10', fill: top }),
      h('polygon', { key: 'l', points: '1,10 16,18 16,26 1,18', fill: side }),
      h('polygon', { key: 'r', points: '31,10 16,18 16,26 31,18', fill: front }),
    ]);
  }

  /** Nodo de mando: hexágono con núcleo. */
  function CraftSprite(props) {
    const p = obj(props);
    const on = p.status === 'done';
    const ring = p.off ? '#33564C' : on ? '#4BE3A0' : '#2C554B';
    const core = p.off ? '#16241F' : on ? '#0E4433' : '#122A24';
    return h('svg', { className: 'ks-sprite', viewBox: '0 0 32 32', width: p.size || 50, height: p.size || 50,
      'aria-hidden': 'true' }, [
      h('polygon', { key: 'h', points: '16,2 29,9 29,23 16,30 3,23 3,9', fill: core, stroke: ring, strokeWidth: 2 }),
      h('polygon', { key: 'i', points: '16,9 23,13 23,20 16,24 9,20 9,13', fill: ring, opacity: on ? 0.9 : 0.35 }),
    ]);
  }

  const STATUS_LABEL = { done: 'completado', error: 'con error', skipped: 'saltado', blocked: 'bloqueado',
    off: 'desactivado', idle: 'sin ejecutar' };

  // ── Inspector común ────────────────────────────────────────────────────
  function FlowInspector(props) {
    const p = obj(props);
    const node = p.node;
    const act = p.actions;
    if (!node) return h('div', { className: 'ks-flow-inspector' },
      h('p', { className: 'ks-hint' }, 'Elige un agente para ver qué hace y actuar sobre él.'));
    const deps = arr(node.deps).map((d) => (agentById(d) || {}).name).filter(Boolean);
    return h('div', { className: 'ks-flow-inspector' }, [
      h('div', { className: 'ks-flow-insp-head', key: 'h' }, [
        h('span', { className: 'ks-flow-insp-emoji', key: 'e' }, node.emoji),
        h('div', { key: 'n' }, [
          h('strong', { key: 'a' }, 'Agente ' + node.n + ' · ' + node.name),
          h('span', { className: 'ks-flow-insp-status', key: 'b' }, STATUS_LABEL[node.status] || node.status),
        ]),
      ]),
      h('p', { className: 'ks-flow-insp-desc', key: 'd' }, node.description),
      h('div', { className: 'ks-kv ks-kv-sm', key: 'k' }, [
        h('div', { key: '1' }, [h('span', { key: 'a' }, 'Escribe'), h('strong', { key: 'b' }, node.writes || '—')]),
        h('div', { key: '2' }, [h('span', { key: 'a' }, 'Depende de'), h('strong', { key: 'b' }, deps.length ? deps.join(', ') : 'nada')]),
        h('div', { key: '3' }, [h('span', { key: 'a' }, 'Último tiempo'), h('strong', { key: 'b' }, node.ms ? node.ms + ' ms' : '—')]),
      ]),
      node.error ? h('p', { className: 'ks-warn', key: 'e' }, node.error) : null,
      h('div', { className: 'ks-flow-insp-actions', key: 'a' }, [
        h(Btn, { key: 'r', size: 'sm', variant: 'primary', disabled: node.disabled || node.blocked,
          onClick: () => act.run(node.id) }, 'Ejecutar'),
        h(Btn, { key: 't', size: 'sm', onClick: () => act.toggle(node.id) },
          node.disabled ? 'Activar' : 'Desactivar'),
        h(Btn, { key: 'u', size: 'sm', variant: 'ghost', onClick: () => act.move(node.id, -1) }, '↑'),
        h(Btn, { key: 'd', size: 'sm', variant: 'ghost', onClick: () => act.move(node.id, 1) }, '↓'),
      ]),
    ]);
  }

  // ── 1. Clásica: grafo de dependencias ──────────────────────────────────
  function FlowClassic(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    return h('div', { className: 'ks-flow-classic' }, plan.map((n, i) => h('div', {
      key: n.id, className: cx('ks-flownode', 'ks-fs-' + n.status, p.sel === n.id && 'ks-flownode-sel'),
      onClick: () => act.select(n.id),
    }, [
      i > 0 ? h('span', { className: 'ks-flowlink', key: 'l' }) : null,
      h('span', { className: 'ks-flownode-idx', key: 'x' }, i + 1),
      h('span', { className: 'ks-flownode-emoji', key: 'e' }, n.emoji),
      h('div', { className: 'ks-flownode-body', key: 'b' }, [
        h('strong', { key: 'n' }, n.name),
        h('span', { className: 'ks-flownode-meta', key: 'm' },
          (arr(n.deps).length ? '← ' + arr(n.deps).map((d) => (agentById(d) || {}).name).join(', ') : 'sin dependencias')
          + (n.ms ? ' · ' + n.ms + ' ms' : '')),
      ]),
      h('span', { className: cx('ks-flowdot', 'ks-fd-' + n.status), key: 'd', title: STATUS_LABEL[n.status] }),
    ])));
  }

  // ── 2. KimosLab: ruta en píxeles con caja de diálogo ───────────────────
  function FlowKimosLab(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    const sel = plan.find((x) => x.id === p.sel) || plan[0];
    const done = plan.filter((x) => x.status === 'done').length;
    return h('div', { className: 'ks-lab' }, [
      h('div', { className: 'ks-lab-hud', key: 'h' }, [
        h('span', { key: 'a' }, '★ ' + done + '/' + plan.length + ' medallas'),
        h('span', { key: 'b' }, 'Ruta de producción'),
      ]),
      h('div', { className: 'ks-lab-route', key: 'r' }, plan.map((n, i) => h('button', {
        key: n.id, type: 'button',
        className: cx('ks-lab-stop', p.sel === n.id && 'ks-lab-stop-sel', n.disabled && 'ks-lab-off'),
        onClick: () => act.select(n.id),
      }, [
        h(LabSprite, { key: 's', status: n.status, off: n.disabled, size: 44 }),
        h('span', { className: 'ks-lab-name', key: 'n' }, n.name),
        n.status === 'done' ? h('span', { className: 'ks-lab-badge', key: 'b' }, '★') : null,
        i < plan.length - 1 ? h('span', { className: 'ks-lab-path', key: 'p' }) : null,
      ]))),
      sel ? h('div', { className: 'ks-lab-dialog', key: 'd' }, [
        h('p', { key: 't' }, [
          h('b', { key: 'n' }, sel.name.toUpperCase() + ': '),
          sel.disabled ? 'Está descansando. No participa en la ruta.'
            : sel.blocked ? 'No puede salir: necesita a ' + arr(sel.deps).map((d) => (agentById(d) || {}).name).join(', ') + '.'
              : sel.status === 'done' ? '¡Listo! ' + sel.description
                : sel.description,
        ]),
        h('div', { className: 'ks-lab-cmds', key: 'c' }, [
          h('button', { key: 'r', type: 'button', className: 'ks-lab-cmd', disabled: sel.disabled || sel.blocked,
            onClick: () => act.run(sel.id) }, '▶ EJECUTAR'),
          h('button', { key: 't', type: 'button', className: 'ks-lab-cmd', onClick: () => act.toggle(sel.id) },
            sel.disabled ? '✚ ACTIVAR' : '✖ DESCANSAR'),
          h('button', { key: 'u', type: 'button', className: 'ks-lab-cmd', onClick: () => act.move(sel.id, -1) }, '↑'),
          h('button', { key: 'd', type: 'button', className: 'ks-lab-cmd', onClick: () => act.move(sel.id, 1) }, '↓'),
        ]),
      ]) : null,
    ]);
  }

  // ── 3. JABOTEL: sala isométrica ────────────────────────────────────────
  function FlowJabotel(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    const sel = plan.find((x) => x.id === p.sel) || null;
    const COLS = 4;
    const TW = 96; const TH = 48;                      // ancho y alto de baldosa
    const rows = Math.ceil(plan.length / COLS);
    const W = (COLS + rows) * (TW / 2) + 40;
    const H = (COLS + rows) * (TH / 2) + 130;
    const isoX = (cx0, cy) => (cx0 - cy) * (TW / 2) + W / 2;
    const isoY = (cx0, cy) => (cx0 + cy) * (TH / 2) + 30;
    const tiles = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        tiles.push(h('polygon', {
          key: 't' + i, className: 'ks-jab-tile',
          points: [
            [isoX(x, y), isoY(x, y) - TH / 2], [isoX(x, y) + TW / 2, isoY(x, y)],
            [isoX(x, y), isoY(x, y) + TH / 2], [isoX(x, y) - TW / 2, isoY(x, y)],
          ].map((q) => q.join(',')).join(' '),
          opacity: (x + y) % 2 ? 0.55 : 0.3,
        }));
      }
    }
    return h('div', { className: 'ks-jab' }, [
      h('div', { className: 'ks-jab-hud', key: 'h' }, [
        h('span', { key: 'a' }, '🏨 Sala de producción'),
        h('span', { key: 'b' }, plan.filter((x) => x.status === 'done').length + ' de ' + plan.length + ' listos'),
      ]),
      h('div', { className: 'ks-jab-room', key: 'r', style: { height: H + 'px' } }, [
        h('svg', { key: 'f', className: 'ks-jab-floor', viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H }, tiles),
        h('div', { key: 'i', className: 'ks-jab-items' }, plan.map((n, i) => {
          const x = i % COLS; const y = Math.floor(i / COLS);
          return h('button', {
            key: n.id, type: 'button',
            className: cx('ks-jab-furni', p.sel === n.id && 'ks-jab-furni-sel', n.disabled && 'ks-jab-off'),
            style: { left: (isoX(x, y) / W * 100) + '%', top: (isoY(x, y) - 34) + 'px' },
            onClick: () => act.select(n.id),
          }, [
            h(FurniSprite, { key: 's', status: n.status, off: n.disabled, size: 52 }),
            h('span', { className: 'ks-jab-plate', key: 'p' }, n.name),
          ]);
        })),
      ]),
      sel ? h('div', { className: 'ks-jab-chat', key: 'c' }, [
        h('span', { className: 'ks-jab-who', key: 'w' }, sel.emoji + ' ' + sel.name),
        h('p', { key: 't' }, sel.disabled ? 'Fuera de servicio en esta sala.'
          : sel.blocked ? 'Esperando a ' + arr(sel.deps).map((d) => (agentById(d) || {}).name).join(', ') + '.'
            : sel.description),
        h('div', { className: 'ks-jab-btns', key: 'b' }, [
          h(Btn, { key: 'r', size: 'sm', variant: 'primary', disabled: sel.disabled || sel.blocked, onClick: () => act.run(sel.id) }, 'Usar'),
          h(Btn, { key: 't', size: 'sm', onClick: () => act.toggle(sel.id) }, sel.disabled ? 'Poner' : 'Retirar'),
          h(Btn, { key: 'u', size: 'sm', variant: 'ghost', onClick: () => act.move(sel.id, -1) }, '↑'),
          h(Btn, { key: 'd', size: 'sm', variant: 'ghost', onClick: () => act.move(sel.id, 1) }, '↓'),
        ]),
      ]) : null,
    ]);
  }

  // ── 4. Spacecraft: consola de mando ────────────────────────────────────
  function FlowSpacecraft(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    const sel = plan.find((x) => x.id === p.sel) || null;
    const done = plan.filter((x) => x.status === 'done').length;
    const pct = plan.length ? Math.round((done / plan.length) * 100) : 0;
    return h('div', { className: 'ks-craft' }, [
      h('div', { className: 'ks-craft-bar', key: 'b' }, [
        h('span', { key: 'a' }, '▮ CADENA DE MANDO'),
        h('span', { key: 'b' }, 'OPERATIVOS ' + done + '/' + plan.length),
        h('span', { key: 'c' }, 'INTEGRIDAD ' + pct + '%'),
      ]),
      h('div', { className: 'ks-craft-grid', key: 'g' }, [
        h('div', { className: 'ks-craft-queue', key: 'q' }, [
          h('span', { className: 'ks-craft-title', key: 't' }, 'COLA DE CONSTRUCCIÓN'),
          h('div', { className: 'ks-craft-items', key: 'i' }, plan.map((n, i) => h('button', {
            key: n.id, type: 'button',
            className: cx('ks-craft-item', p.sel === n.id && 'ks-craft-item-sel', 'ks-cs-' + n.status),
            onClick: () => act.select(n.id),
          }, [
            h('span', { className: 'ks-craft-num', key: 'n' }, String(i + 1).padStart(2, '0')),
            h(CraftSprite, { key: 's', status: n.status, off: n.disabled, size: 26 }),
            h('span', { className: 'ks-craft-name', key: 'l' }, n.name),
            h('span', { className: 'ks-craft-state', key: 'x' },
              n.disabled ? 'OFF' : n.blocked ? 'HOLD' : n.status === 'done' ? 'OK' : n.status === 'error' ? 'ERR' : '···'),
          ]))),
        ]),
        h('div', { className: 'ks-craft-panel', key: 'p' }, sel ? [
          h('span', { className: 'ks-craft-title', key: 't' }, 'UNIDAD SELECCIONADA'),
          h('div', { className: 'ks-craft-unit', key: 'u' }, [
            h(CraftSprite, { key: 's', status: sel.status, off: sel.disabled, size: 76 }),
            h('div', { key: 'd' }, [
              h('strong', { key: 'n' }, sel.name.toUpperCase()),
              h('p', { key: 'x' }, sel.description),
            ]),
          ]),
          h('div', { className: 'ks-craft-stats', key: 'st' }, [
            h('span', { key: '1' }, 'REQUISITOS: ' + (arr(sel.deps).length
              ? arr(sel.deps).map((d) => (agentById(d) || {}).name).join(' · ').toUpperCase() : 'NINGUNO')),
            h('span', { key: '2' }, 'ESTADO: ' + (STATUS_LABEL[sel.status] || sel.status).toUpperCase()),
            h('span', { key: '3' }, 'CICLO: ' + (sel.ms ? sel.ms + ' MS' : '—')),
          ]),
          h('div', { className: 'ks-craft-cmds', key: 'c' }, [
            h('button', { key: 'r', type: 'button', className: 'ks-craft-cmd', disabled: sel.disabled || sel.blocked,
              onClick: () => act.run(sel.id) }, 'EJECUTAR'),
            h('button', { key: 't', type: 'button', className: 'ks-craft-cmd', onClick: () => act.toggle(sel.id) },
              sel.disabled ? 'ACTIVAR' : 'DESACTIVAR'),
            h('button', { key: 'u', type: 'button', className: 'ks-craft-cmd', onClick: () => act.move(sel.id, -1) }, '▲'),
            h('button', { key: 'd', type: 'button', className: 'ks-craft-cmd', onClick: () => act.move(sel.id, 1) }, '▼'),
          ]),
        ] : h('p', { className: 'ks-hint' }, 'Sin unidad seleccionada.')),
      ]),
    ]);
  }

  const GAME_RENDERERS = { kimoslab: FlowKimosLab, jabotel: FlowJabotel, spacecraft: FlowSpacecraft };

  // ── Selector de forma y modo ───────────────────────────────────────────
  // Vive aquí porque nació con el Flujo, pero lo usan dos vistas: el aspecto es
  // de la app entera, no de una pantalla. Cambiarlo desde cualquiera de las dos
  // afecta a las dos, porque escribe en el mismo sitio (`settings.theme`).
  function SkinPicker() {
    const theme = currentTheme();
    const setTheme = (patchTheme) => patch((m) => { m.settings.theme = Object.assign({}, m.settings.theme, patchTheme); });
    return h('div', { className: 'ks-skin' }, [
      h('div', { className: 'ks-skin-row', key: 'forms' }, THEME_FORMS.map((f) => h('button', {
        key: f.id, type: 'button', className: cx('ks-skin-form', theme.formId === f.id && 'ks-skin-on'),
        onClick: () => setTheme({ form: f.id }), title: f.help,
      }, [h('span', { key: 'e' }, f.emoji), h('span', { key: 'l' }, f.label)]))),
      h('div', { className: 'ks-skin-row', key: 'modes' },
        (theme.formId === 'game' ? GAME_MODES : CLASSIC_MODES).map((m0) => h('button', {
          key: m0.id, type: 'button',
          className: cx('ks-skin-mode', (theme.formId === 'game' ? theme.modeId : model.settings.theme.classicMode) === m0.id && 'ks-skin-on'),
          onClick: () => setTheme(theme.formId === 'game' ? { gameMode: m0.id } : { classicMode: m0.id }),
          title: m0.help || '',
        }, [h('span', { key: 'e' }, m0.emoji), h('span', { key: 'l' }, m0.label)]))),
    ]);
  }

  /** Explicación del modo activo, en una línea. */
  function skinHint(theme) {
    if (theme.live) {
      return 'Modo Vivo: ahora mismo se ve en ' + s(theme.label).split('·').pop().trim()
        + ', y cambia solo con la hora del equipo.';
    }
    return s((theme.formId === 'game' ? gameModeById(theme.modeId) : classicModeById(theme.modeId)).help
      || 'El aspecto no cambia lo que hacen los agentes, solo cómo se lee.');
  }

  // ── Vista ──────────────────────────────────────────────────────────────
  function FlowView() {
    const plan = workflowPlan(model);
    const act = flowActions();
    const theme = currentTheme();
    const sel = ui.flowSel && plan.some((x) => x.id === ui.flowSel) ? ui.flowSel : (plan[0] || {}).id;
    const node = plan.find((x) => x.id === sel) || null;
    const custom = arr(model.settings.workflow.order).length > 0 || arr(model.settings.workflow.disabled).length > 0;
    const Renderer = theme.formId === 'game' ? (GAME_RENDERERS[theme.modeId] || FlowKimosLab) : FlowClassic;

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Flujo de agentes',
        subtitle: plan.length + ' agentes · ' + plan.filter((x) => x.status === 'done').length + ' ejecutados'
          + (custom ? ' · flujo personalizado' : ' · orden de fábrica'),
        actions: [
          h(Btn, { key: 'r', variant: 'primary', onClick: () => runStages(null, 'Pipeline') }, 'Ejecutar flujo'),
          custom ? h(Btn, { key: 'z', onClick: act.reset }, 'Restablecer') : null,
        ].filter(Boolean) }),

      h(Card, { key: 'sk', title: 'Aspecto',
        actions: [h(Btn, { key: 'w', size: 'sm', variant: 'ghost', onClick: () => setUi({ view: 'world' }) },
          'Ver la organización')] }, [
        h(SkinPicker, { key: 'f' }),
        h('p', { className: 'ks-hint', key: 'n' }, skinHint(theme)),
      ]),

      h('div', { className: cx('ks-flow-stage', 'ks-flow-' + (theme.formId === 'game' ? theme.modeId : 'classic')), key: 'st' },
        h(Renderer, { plan, actions: act, sel })),

      theme.formId === 'classic' ? h(Card, { key: 'i', title: 'Agente seleccionado' },
        h(FlowInspector, { node, actions: act })) : null,

      h(Card, { key: 'help', title: 'Qué puedes cambiar aquí' }, [
        h('ul', { className: 'ks-list', key: 'l' }, [
          'Reordenar: un agente no puede ir antes de aquel del que depende; si lo intentas, se coloca en la posición válida más cercana.',
          'Desactivar: el agente se salta. Los que dependían de él quedan bloqueados con el motivo, en vez de fallar a medias.',
          'Ejecutar suelto: útil para rehacer solo el copy o solo el montaje sin tocar el resto.',
          'El aspecto es solo presentación: los datos, el orden y los resultados son los mismos en las cuatro vistas.',
        ].map((x, i) => h('li', { key: i }, x))),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Distribución y sistema: Copy, Marca, Biblioteca, Analytics,
  //       Estilos, Versiones y Ajustes
  // ═════════════════════════════════════════════════════════════════════════

  function CopyView() {
    const cp = model.copy;
    if (!cp) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'copywriter' }));
    const platforms = uniq(arr(cp.ads).map((a) => a.platform));
    const sel = ui.platformSel && platforms.indexOf(ui.platformSel) >= 0 ? ui.platformSel : (platforms[0] || '');
    const ads = arr(cp.ads).filter((a) => a.platform === sel);
    const ld = obj(cp.landing);

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Copy',
        subtitle: arr(cp.ads).length + ' anuncios · ' + platforms.length + ' plataformas · ' + arr(cp.emails).length + ' emails',
        actions: [
          h(Btn, { key: 'c', onClick: () => download(slug(model.title) + '-copy.csv', exportCopyCsv(model), 'text/csv') }, 'CSV'),
          h(Btn, { key: 'r', variant: 'ghost', onClick: () => runStages(['copywriter'], 'Copywriter') }, 'Regenerar'),
        ] }),

      h(Card, { key: 'hk', title: 'Ganchos' }, [
        h('div', { className: 'ks-hooks', key: 'h' }, arr(cp.hooks).map((x) => h('div', { key: x.id, className: 'ks-hook' }, [
          h('span', { className: 'ks-hook-label', key: 'l' }, x.label),
          h('p', { key: 't' }, x.text),
          h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(x.text, 'Gancho') }, 'Copiar'),
        ]))),
      ]),

      h(Card, { key: 'ads', title: 'Anuncios' }, [
        h('div', { className: 'ks-tabs', key: 't' }, platforms.map((pid) => {
          const p = PLATFORMS.find((x) => x.id === pid);
          return h('button', { key: pid, type: 'button', className: cx('ks-tab', sel === pid && 'ks-tab-on'),
            onClick: () => setUi({ platformSel: pid }) }, p ? p.label : pid);
        })),
        h('div', { className: 'ks-ads', key: 'a' }, ads.map((a) => h('div', { key: a.id, className: cx('ks-ad', a.overLimit && 'ks-ad-bad') }, [
          h('div', { className: 'ks-ad-head', key: 'h' }, [
            h('strong', { key: 'v' }, 'Variante ' + a.variant),
            h(Chip, { key: 'p', tone: 'accent' }, a.hookLabel),
            h(Btn, { key: 'c', size: 'xs', onClick: () => copyText([a.primary, '', a.headline, a.description, a.cta].filter(Boolean).join('\n'), 'Anuncio') }, 'Copiar'),
          ]),
          h('pre', { className: 'ks-ad-primary', key: 'p' }, s(a.primary)),
          h('div', { className: 'ks-ad-meta', key: 'm' }, [
            h('div', { key: 'h' }, [h('span', { key: 'l' }, 'Titular'), h('strong', { key: 'v' }, a.headline),
              h('em', { key: 'c' }, a.headline.length + '/' + (a.limits.headline || '∞'))]),
            a.description ? h('div', { key: 'd' }, [h('span', { key: 'l' }, 'Descripción'), h('strong', { key: 'v' }, a.description)]) : null,
            h('div', { key: 'c' }, [h('span', { key: 'l' }, 'CTA'), h('strong', { key: 'v' }, a.cta)]),
            h('div', { key: 'n' }, [h('span', { key: 'l' }, 'Texto principal'),
              h('em', { key: 'c' }, a.primary.length + '/' + (a.limits.primary || '∞'))]),
          ]),
          h('p', { className: 'ks-hint', key: 'n' }, a.notes),
          a.overLimit ? h('p', { className: 'ks-warn', key: 'w' }, 'Excede el límite de caracteres de la plataforma.') : null,
        ]))),
      ]),

      h(Card, { key: 'ld', title: 'Landing' }, [
        h('div', { className: 'ks-landing', key: 'l' }, [
          h('div', { className: 'ks-landing-hero', key: 'h' }, [
            h('span', { className: 'ks-landing-eyebrow', key: 'e' }, s(obj(ld.hero).eyebrow)),
            h('h3', { key: 'h' }, s(obj(ld.hero).headline)),
            h('p', { key: 's' }, s(obj(ld.hero).subheadline)),
            h('div', { className: 'ks-chips', key: 'c' }, [
              h(Chip, { key: '1', tone: 'accent' }, s(obj(ld.hero).cta)),
              h(Chip, { key: '2' }, s(obj(ld.hero).ctaSecondary)),
            ]),
            h('p', { className: 'ks-hint', key: 'n' }, s(obj(ld.hero).note)),
          ]),
          h('div', { className: 'ks-grid ks-grid-3', key: 'v' }, arr(ld.valueProps).map((v, i) => h('div', { key: i, className: 'ks-vp' }, [
            h('strong', { key: 't' }, v.title), h('p', { key: 'b' }, v.body),
          ]))),
          h('h4', { className: 'ks-h4', key: 'ph' }, s(obj(ld.proof).title)),
          h('ul', { className: 'ks-list', key: 'pl' }, arr(obj(ld.proof).items).map((x, i) => h('li', { key: i }, x))),
          h('h4', { className: 'ks-h4', key: 'oh' }, 'Objeciones'),
          h('div', { className: 'ks-faq', key: 'o' }, arr(ld.objections).map((o, i) => h('div', { key: i, className: 'ks-faq-item' }, [
            h('strong', { key: 'q' }, o.question), h('p', { key: 'a' }, o.answer),
          ]))),
          h('h4', { className: 'ks-h4', key: 'sh' }, 'SEO'),
          h('div', { className: 'ks-kv', key: 'seo' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Title'), h('strong', { key: 'b' }, s(obj(ld.seo).title))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'Description'), h('strong', { key: 'b' }, s(obj(ld.seo).description))]),
          ]),
          h('div', { className: 'ks-chips', key: 'kw' }, arr(obj(ld.seo).keywords).map((k, i) => h(Chip, { key: i }, k))),
        ]),
      ]),

      h(Card, { key: 'em', title: 'Secuencia de email' }, [
        h('div', { className: 'ks-emails', key: 'e' }, arr(cp.emails).map((e, i) => h('div', { key: i, className: 'ks-email' }, [
          h('div', { className: 'ks-email-head', key: 'h' }, [
            h(Chip, { key: 'd', tone: 'accent' }, 'Día ' + e.day),
            h('strong', { key: 's' }, e.subject),
            h('span', { className: 'ks-email-stage', key: 'st' }, e.stage),
          ]),
          h('p', { className: 'ks-email-pre', key: 'p' }, e.preheader),
          h('pre', { className: 'ks-email-body', key: 'b' }, s(e.body)),
          h('div', { className: 'ks-chips', key: 'c' }, [h(Chip, { key: 'c', tone: 'accent' }, e.cta)]),
        ]))),
      ]),
    ]);
  }

  // ── Marca ──────────────────────────────────────────────────────────────
  function BrandView() {
    const b = model.brand;
    const bc = model.brandCheck;
    const st = styleById(model.styleId);
    const setBrand = (fn) => patch((m) => fn(m.brand));
    const [uploadingLogo, setUploadingLogo] = useState(false);

    async function onLogo(file) {
      if (!file) return;
      setUploadingLogo(true);
      try {
        const url = await uploadFile(file, 'marca');
        setBrand((br) => { br.logoUrl = url; });
        await saveAsset({ url, kind: 'logo', name: file.name, note: 'Logotipo de marca' });
        notify('success', 'Logotipo cargado.');
      } catch (e) { notify('error', 'No se pudo subir: ' + ((e && e.message) || 'error')); }
      setUploadingLogo(false);
    }

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Marca',
        subtitle: 'Consistencia de paleta, tipografía, logotipo, producto, personajes y tono.',
        actions: [h(Btn, { key: 'a', variant: 'primary', onClick: () => runStages(['brand-consistency'], 'Brand Consistency') }, 'Auditar marca')] }),

      bc ? h(Card, { key: 'sc', title: 'Auditoría' }, [
        h('div', { className: 'ks-score', key: 's' }, [
          h('div', { className: cx('ks-score-num', num(bc.score, 0) >= 85 ? 'ks-ok' : num(bc.score, 0) >= 60 ? 'ks-warn2' : 'ks-bad'), key: 'n' }, num(bc.score, 0)),
          h('div', { key: 'd' }, [
            h('strong', { key: 'l' }, s(bc.level)),
            h('p', { className: 'ks-hint', key: 'c' }, obj(bc.counts).error + ' errores · ' + obj(bc.counts).warn + ' avisos · ' + obj(bc.counts).info + ' notas'),
          ]),
          h(Bar, { key: 'b', value: num(bc.score, 0), tone: num(bc.score, 0) >= 85 ? 'ok' : num(bc.score, 0) >= 60 ? 'warn' : 'bad' }),
        ]),
        h('div', { className: 'ks-findings', key: 'f' }, arr(bc.findings).map((f, i) => h('div', { key: i, className: cx('ks-finding', 'ks-sev-' + f.severity) }, [
          h('span', { className: 'ks-finding-area', key: 'a' }, f.area),
          h('p', { key: 't' }, f.text),
          f.fix ? h('p', { className: 'ks-finding-fix', key: 'f' }, '→ ' + f.fix) : null,
        ]))),
        h('h4', { className: 'ks-h4', key: 'lh' }, 'Reglas bloqueadas'),
        h('ul', { className: 'ks-list', key: 'lr' }, arr(bc.lockedRules).map((x, i) => h('li', { key: i }, x))),
      ]) : null,

      h(Card, { key: 'p', title: 'Paleta' }, [
        h('div', { className: 'ks-grid ks-grid-5', key: 'g' }, ['primary', 'secondary', 'accent', 'dark', 'light'].map((k) => h(Field, {
          key: k, label: k,
        }, h(ColorInput, { value: b.palette[k], onChange: (v) => setBrand((br) => { br.palette[k] = v; }) })))),
        h('div', { className: 'ks-cardfoot', key: 'f' }, [
          h(Btn, { key: 'a', size: 'sm', onClick: () => setBrand((br) => { br.palette = Object.assign({}, st.palette); }) },
            'Aplicar paleta del estilo ' + st.name),
        ]),
      ]),

      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 't', title: 'Tipografía' }, [
          h(Field, { key: 'd', wide: true, label: 'Titulares', help: 'Sugerencia del estilo: ' + st.typography.display },
            h(TextInput, { value: b.typography.display, onChange: (v) => setBrand((br) => { br.typography.display = v; }) })),
          h(Field, { key: 'b', wide: true, label: 'Texto', help: 'Sugerencia del estilo: ' + st.typography.body },
            h(TextInput, { value: b.typography.body, onChange: (v) => setBrand((br) => { br.typography.body = v; }) })),
          h(Field, { key: 'k', wide: true, label: 'Interletraje' },
            h(Select, { value: b.typography.tracking, options: ['cerrado', 'normal', 'amplio', 'muy amplio'].map((x) => ({ value: x, label: x })),
              onChange: (v) => setBrand((br) => { br.typography.tracking = v; }) })),
        ]),
        h(Card, { key: 'l', title: 'Logotipo' }, [
          b.logoUrl ? h('div', { className: 'ks-logo', key: 'i' }, h('img', { src: b.logoUrl, alt: 'logotipo' })) : null,
          h('label', { key: 'u', className: cx('ks-btn', 'ks-btn-sm') }, [
            uploadingLogo ? 'Subiendo…' : (b.logoUrl ? 'Reemplazar logotipo' : 'Subir logotipo'),
            h('input', { key: 'i', type: 'file', accept: 'image/png,image/svg+xml,image/webp', style: { display: 'none' },
              onChange: (e) => { onLogo(e.target.files && e.target.files[0]); e.target.value = ''; } }),
          ]),
          h(Field, { key: 'sa', wide: true, label: 'Área de reserva (%)' },
            h(TextInput, { type: 'number', min: 0, max: 40, value: b.logoSafeArea, onChange: (v) => setBrand((br) => { br.logoSafeArea = clamp(v, 0, 40); }) })),
          h(Field, { key: 'sl', wide: true, label: 'Eslogan' },
            h(TextInput, { value: b.slogan, onChange: (v) => setBrand((br) => { br.slogan = v; }) })),
        ]),
      ]),

      h(Card, { key: 'lock', title: 'Consistencia de producto y personajes' }, [
        h(Field, { key: 'p', wide: true, label: 'Bloqueo de producto',
          help: 'Se inyecta en todos los prompts para que el modelo no reinvente la forma ni la marca.' },
          h(TextArea, { value: b.productLock, rows: 2,
            placeholder: 'Zapatilla blanca con suela de carbono negra, logo lateral bordado en rojo, cordones planos.',
            onChange: (v) => setBrand((br) => { br.productLock = v; }) })),
        h(Field, { key: 'c', wide: true, label: 'Bloqueo de personaje',
          help: 'Edad, aspecto y vestuario, para que sea la misma persona en todos los planos.' },
          h(TextArea, { value: b.characterLock, rows: 2, onChange: (v) => setBrand((br) => { br.characterLock = v; }) })),
        h(Field, { key: 't', wide: true, label: 'Tono de marca', help: 'Vacío = tono del estilo: ' + st.tone },
          h(TextInput, { value: b.tone, onChange: (v) => setBrand((br) => { br.tone = v; }) })),
        h(Field, { key: 'f', wide: true, label: 'Términos prohibidos', help: 'Separados por comas. La auditoría marca el copy que los use.' },
          h(TextInput, { value: arr(b.forbidden).join(', '),
            onChange: (v) => setBrand((br) => { br.forbidden = uniq(s(v).split(',').map((x) => x.trim())); }) })),
      ]),
    ]);
  }

  // ── Biblioteca de assets ───────────────────────────────────────────────
  function AssetsView() {
    const [uploading, setUploading] = useState(false);
    const filter = s(ui.assetFilter) || 'all';
    const list = filter === 'all' ? assets : assets.filter((a) => a.kind === filter);
    const totalCost = round(assets.reduce((a, x) => a + num(x.costUsd, 0), 0), 2);

    async function onFiles(files) {
      const fs2 = Array.from(files || []);
      if (!fs2.length) return;
      setUploading(true);
      let ok = 0;
      for (const f of fs2) {
        try {
          const url = await uploadFile(f, 'assets');
          await saveAsset({ url, name: f.name, sceneId: ui.sceneSel || '' });
          ok++;
        } catch (e) { notify('error', f.name + ': ' + ((e && e.message) || 'error')); }
      }
      setUploading(false);
      if (ok) notify('success', ok + ' asset(s) añadidos.');
    }

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Biblioteca',
        subtitle: assets.length + ' assets · ' + fmtMoney(totalCost, 'USD') + ' de coste registrado'
          + (hasItems ? '' : ' · almacenamiento local (esta ventana)'),
        actions: [h('label', { key: 'u', className: cx('ks-btn', 'ks-btn-primary', 'ks-btn-sm') }, [
          uploading ? 'Subiendo…' : 'Subir archivos',
          h('input', { key: 'i', type: 'file', multiple: true, style: { display: 'none' },
            onChange: (e) => { onFiles(e.target.files); e.target.value = ''; } }),
        ])] }),
      h('div', { className: 'ks-tabs', key: 't' }, [{ id: 'all', label: 'Todos (' + assets.length + ')' }]
        .concat(ASSET_KINDS.map((k) => ({ id: k.id, label: k.emoji + ' ' + k.label + ' (' + assets.filter((a) => a.kind === k.id).length + ')' })))
        .map((t) => h('button', { key: t.id, type: 'button', className: cx('ks-tab', filter === t.id && 'ks-tab-on'),
          onClick: () => setUi({ assetFilter: t.id }) }, t.label))),
      list.length ? h('div', { className: 'ks-assets', key: 'a' }, list.map((a) => h('div', { key: a.id, className: 'ks-asset' }, [
        h('div', { className: 'ks-asset-thumb', key: 't' },
          a.kind === 'image' || a.kind === 'logo' ? h('img', { src: a.url, alt: '', loading: 'lazy' })
            : a.kind === 'video' ? h('video', { src: a.url, controls: true, preload: 'metadata' })
              : a.kind === 'audio' ? h('audio', { src: a.url, controls: true })
                : h('span', { className: 'ks-asset-icon' }, (ASSET_KINDS.find((k) => k.id === a.kind) || {}).emoji || '📄')),
        h('div', { className: 'ks-asset-meta', key: 'm' }, [
          h('strong', { key: 'n', title: a.name }, s(a.name).slice(0, 40)),
          h('div', { className: 'ks-chips', key: 'c' }, [
            a.code ? h(Chip, { key: 's' }, a.code) : null,
            a.providerId ? h(Chip, { key: 'p' }, a.providerId) : null,
            h(Chip, { key: 'v' }, 'v' + a.version),
            a.costUsd ? h(Chip, { key: 'co' }, fmtMoney(a.costUsd, 'USD')) : null,
          ].filter(Boolean)),
          h('div', { className: 'ks-asset-actions', key: 'a' }, [
            h(Btn, { key: 'ap', size: 'xs', variant: a.approved ? 'primary' : 'ghost',
              onClick: () => saveAsset(Object.assign({}, a, { approved: !a.approved })) }, a.approved ? 'Aprobado' : 'Aprobar'),
            h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(a.url, 'URL') }, 'URL'),
            h(Btn, { key: 'd', size: 'xs', variant: 'danger',
              onClick: () => removeAsset(a.id).catch((e) => notify('error', (e && e.message) || 'error')) }, '✕'),
          ]),
        ]),
      ]))) : h(Empty, { key: 'e', icon: '▣',
        text: 'Sin assets todavía. Sube archivos o deja que el agente registre lo que genere con REGISTER_ASSET.' }),
    ]);
  }

  // ── Analytics ──────────────────────────────────────────────────────────
  function AnalyticsView() {
    const an = model.analytics;
    if (!an) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'analytics' }));
    const pr = obj(an.production);
    const md = obj(an.media);
    const maxProv = Math.max.apply(null, [1].concat(Object.keys(obj(pr.estByProvider)).map((k) => pr.estByProvider[k])));
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Analytics',
        subtitle: 'Costes de producción, consumo por proveedor y proyección de medios.',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['analytics'], 'Analytics') }, 'Recalcular')] }),
      h('div', { className: 'ks-grid ks-grid-4', key: 's' }, [
        h(Stat, { key: '1', label: 'Coste estimado', value: fmtMoney(num(pr.estTotalUsd, 0), 'USD'), hint: num(pr.jobs, 0) + ' trabajos' }),
        h(Stat, { key: '2', label: 'Coste real', value: fmtMoney(num(pr.realTotalUsd, 0), 'USD'),
          tone: num(pr.varianceUsd, 0) > 0 ? 'bad' : 'ok',
          hint: (num(pr.varianceUsd, 0) >= 0 ? '+' : '') + fmtMoney(num(pr.varianceUsd, 0), 'USD') + ' de desviación' }),
        h(Stat, { key: '3', label: 'Progreso de producción', value: num(pr.progress, 0) + ' %', hint: num(pr.done, 0) + ' completados' }),
        h(Stat, { key: '4', label: 'Tiempo de máquina', value: num(pr.estMinutes, 0) + ' min', hint: 'estimación' }),
      ]),
      h(Card, { key: 'cons', title: 'Consumo registrado' }, [
        h('div', { className: 'ks-kv', key: 'k' }, [
          h('div', { key: '1' }, [h('span', { key: 'a' }, 'Llamadas'), h('strong', { key: 'b' }, num(obj(pr.consumption).calls, 0))]),
          h('div', { key: '2' }, [h('span', { key: 'a' }, 'Tokens'), h('strong', { key: 'b' }, num(obj(pr.consumption).tokens, 0).toLocaleString('es'))]),
          h('div', { key: '3' }, [h('span', { key: 'a' }, 'Segundos de vídeo'), h('strong', { key: 'b' }, num(obj(pr.consumption).seconds, 0))]),
          h('div', { key: '4' }, [h('span', { key: 'a' }, 'Imágenes'), h('strong', { key: 'b' }, num(obj(pr.consumption).images, 0))]),
        ]),
      ]),
      h(Card, { key: 'prov', title: 'Coste por proveedor' }, [
        h('div', { className: 'ks-bars', key: 'b' }, Object.keys(obj(pr.estByProvider)).map((k) => h('div', { key: k, className: 'ks-barrow' }, [
          h('span', { className: 'ks-barrow-label', key: 'l' }, (getProvider(k) || { label: k }).label),
          h(Bar, { key: 'b', value: (pr.estByProvider[k] / maxProv) * 100, tone: 'accent' }),
          h('span', { className: 'ks-barrow-value', key: 'v' }, fmtMoney(pr.estByProvider[k], 'USD')
            + (obj(pr.realByProvider)[k] ? ' · real ' + fmtMoney(pr.realByProvider[k], 'USD') : '')),
        ]))),
      ]),
      h(Card, { key: 'media', title: 'Proyección de medios' }, [
        h('p', { className: 'ks-hint', key: 'd' }, s(an.disclaimer)),
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Canal', 'Inversión', 'Impresiones', 'Clics', 'Acciones', 'CPC', 'CPA'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(md.byChannel).map((x) => h('tr', { key: x.id }, [
            h('td', { key: 'a' }, x.label), h('td', { key: 'b' }, fmtMoney(x.spend, x.currency)),
            h('td', { key: 'c' }, x.impressions.toLocaleString('es')), h('td', { key: 'd' }, x.clicks.toLocaleString('es')),
            h('td', { key: 'e' }, x.actions.toLocaleString('es')), h('td', { key: 'f' }, fmtMoney(x.cpc, x.currency)),
            h('td', { key: 'g' }, fmtMoney(x.cpa, x.currency)),
          ]))),
        ]),
        h('div', { className: 'ks-grid ks-grid-4', key: 's' }, [
          h(Stat, { key: '1', label: 'CTR esperado', value: num(md.expectedCtrPct, 0) + ' %', hint: 'con ajuste creativo ×' + num(md.upliftFactor, 1) }),
          h(Stat, { key: '2', label: 'CPA proyectado', value: fmtMoney(num(md.cpa, 0), an.currency) }),
          h(Stat, { key: '3', label: 'Ingreso proyectado', value: md.estimatedRevenue ? fmtMoney(md.estimatedRevenue, an.currency) : '—',
            hint: md.estimatedRevenue ? 'con el precio del brief' : 'indica el precio en el brief' }),
          h(Stat, { key: '4', label: 'ROAS proyectado', value: md.estimatedRoas != null ? md.estimatedRoas + '×' : '—',
            tone: num(md.estimatedRoas, 0) >= 2.5 ? 'ok' : 'warn' }),
        ]),
        h('h4', { className: 'ks-h4', key: 'uh' }, 'Ajuste creativo'),
        h('ul', { className: 'ks-list', key: 'ul' }, arr(md.upliftReasons).map((x, i) => h('li', { key: i }, x))),
      ]),
      arr(an.recommendations).length ? h(Card, { key: 'rec', title: 'Recomendaciones' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(an.recommendations).map((x, i) => h('li', { key: i }, x))),
      ]) : null,
    ]);
  }

  // ── Marketplace de estilos ─────────────────────────────────────────────
  function StylesView() {
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Marketplace de estilos',
        subtitle: 'Cada estilo es una dirección creativa completa: paleta, óptica, luz, color, ritmo, música, tipografía y tono. Aplicarlo regenera la campaña entera.' }),
      h('div', { className: 'ks-styles', key: 's' }, STYLES.map((st) => h('div', {
        key: st.id, className: cx('ks-style', model.styleId === st.id && 'ks-style-on'),
      }, [
        h('div', { className: 'ks-style-palette', key: 'p' },
          ['primary', 'secondary', 'accent', 'dark', 'light'].map((k) => h('span', {
            key: k, style: { background: st.palette[k] } }))),
        h('div', { className: 'ks-style-body', key: 'b' }, [
          h('div', { className: 'ks-style-head', key: 'h' }, [
            h('span', { className: 'ks-style-emoji', key: 'e' }, st.emoji),
            h('strong', { key: 'n' }, st.name),
            model.styleId === st.id ? h(Chip, { key: 'a', tone: 'accent' }, 'Activo') : null,
          ]),
          h('p', { className: 'ks-style-tag', key: 't' }, st.tagline),
          h('div', { className: 'ks-style-specs', key: 's' }, [
            h('span', { key: '1' }, st.pacing.avgShotSec + ' s/plano'),
            h('span', { key: '2' }, st.pacing.cutsPerMin + ' cortes/min'),
            h('span', { key: '3' }, st.music.genre + ' · ' + st.music.bpm + ' bpm'),
            h('span', { key: '4' }, labelOf(GRADES, st.grades[0])),
            h('span', { key: '5' }, labelOf(LENSES, st.lenses[0])),
          ]),
          h('p', { className: 'ks-hint', key: 'to' }, 'Tono: ' + st.tone),
          h('p', { className: 'ks-hint', key: 'r' }, 'Referencias: ' + st.refs.join(' · ')),
          h(Btn, { key: 'a', size: 'sm', variant: model.styleId === st.id ? 'ghost' : 'primary',
            disabled: model.styleId === st.id,
            onClick: () => dispatch({ type: 'SET_DIRECTION', payload: { styleId: st.id } }) },
            model.styleId === st.id ? 'En uso' : 'Aplicar estilo'),
        ]),
      ]))),
    ]);
  }

  // ── Versiones ──────────────────────────────────────────────────────────
  function VersionsView() {
    const [label, setLabel] = useState('');
    const vs = arr(model.versions).slice().reverse();
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Versiones',
        subtitle: vs.length + ' de ' + VERSIONS_MAX + ' · cada versión guarda la campaña completa.' }),
      h(Card, { key: 'n', title: 'Nueva versión' }, [
        h('div', { className: 'ks-genrow', key: 'g' }, [
          h(TextInput, { key: 'i', value: label, placeholder: 'Corte de 15 s para TikTok', onChange: setLabel }),
          h(Btn, { key: 'b', variant: 'primary', onClick: () => { createVersion(label); setLabel(''); } }, 'Guardar versión'),
        ]),
      ]),
      vs.length ? h('div', { className: 'ks-versions', key: 'v' }, vs.map((v) => h('div', { key: v.id, className: 'ks-version' }, [
        h('div', { className: 'ks-version-head', key: 'h' }, [
          h('strong', { key: 'l' }, v.label),
          h('span', { className: 'ks-version-date', key: 'd' }, s(v.at).replace('T', ' ').slice(0, 16)),
        ]),
        h('div', { className: 'ks-kv ks-kv-sm', key: 'k' }, Object.keys(obj(v.summary)).slice(0, 8).map((k) => h('div', { key: k }, [
          h('span', { key: 'a' }, k), h('strong', { key: 'b' }, s(obj(v.summary)[k])),
        ]))),
        h('div', { className: 'ks-version-actions', key: 'a' }, [
          h(Btn, { key: 'r', size: 'sm', variant: 'primary', onClick: () => restoreVersion(v.id) }, 'Restaurar'),
          h(Btn, { key: 'd', size: 'sm', variant: 'danger',
            onClick: () => patch((m) => { m.versions = arr(m.versions).filter((x) => x.id !== v.id); }) }, 'Eliminar'),
        ]),
      ]))) : h(Empty, { key: 'e', icon: '⧉', text: 'Sin versiones guardadas.' }),
    ]);
  }

  // ── Ajustes ────────────────────────────────────────────────────────────
  function SettingsView() {
    const st0 = model.settings;
    const setS = (fn) => patch((m) => fn(m.settings));
    const toggleIn = (listKey, id) => setS((sx) => {
      const cur = arr(sx.targets[listKey]);
      sx.targets[listKey] = cur.indexOf(id) >= 0 ? cur.filter((x) => x !== id) : cur.concat([id]);
      if (!sx.targets[listKey].length) sx.targets[listKey] = [id];
    });

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Ajustes',
        subtitle: 'Proveedores, formatos de entrega y parámetros de producción.',
        actions: [h(Btn, { key: 'r', variant: 'primary', disabled: !model.concept, onClick: () => runStages(null, 'Pipeline') }, 'Aplicar y regenerar')] }),

      h(Card, { key: 'p', title: 'Proveedores de IA' }, [
        h('p', { className: 'ks-hint', key: 'i' },
          'Cada capacidad usa un proveedor intercambiable. Los agentes producen un PromptSpec neutral; '
          + 'el registro lo traduce al dialecto de cada modelo. Cambiar de proveedor reescribe los prompts sin tocar nada más.'),
        h('div', { className: 'ks-grid ks-grid-3', key: 'g' }, CAPABILITIES.map((cap) => {
          const cur = getProvider(st0.providers[cap.id]);
          return h(Field, { key: cap.id, label: cap.emoji + ' ' + cap.label,
            help: cur ? cur.vendor + ' · ' + (cur.cost ? fmtMoney(cur.cost.amount, cur.cost.currency) + '/' + cur.cost.unit : 'sin coste') : '' },
            h(Select, { value: s(st0.providers[cap.id]), options: providersFor(cap.id).map((x) => ({ value: x.id, label: x.label })),
              onChange: (v) => dispatch({ type: 'SET_PROVIDER', payload: { capability: cap.id, providerId: v } }) }));
        })),
      ]),

      h(Card, { key: 'f', title: 'Formatos de entrega' }, [
        h(Field, { key: 'a', wide: true, label: 'Relaciones de aspecto' },
          h('div', { className: 'ks-chips' }, ASPECTS.map((a) => h(Chip, {
            key: a.id, tone: arr(st0.targets.aspects).indexOf(a.id) >= 0 ? 'accent' : null,
            onClick: () => toggleIn('aspects', a.id),
          }, a.label)))),
        h(Field, { key: 'r', wide: true, label: 'Resoluciones' },
          h('div', { className: 'ks-chips' }, RESOLUTIONS.map((r) => h(Chip, {
            key: r.id, tone: arr(st0.targets.resolutions).indexOf(r.id) >= 0 ? 'accent' : null,
            onClick: () => toggleIn('resolutions', r.id),
          }, r.label)))),
        h(Field, { key: 'p', wide: true, label: 'Plataformas' },
          h('div', { className: 'ks-chips' }, PLATFORMS.map((p) => h(Chip, {
            key: p.id, tone: arr(st0.targets.platforms).indexOf(p.id) >= 0 ? 'accent' : null,
            onClick: () => toggleIn('platforms', p.id),
          }, p.label)))),
        h('p', { className: 'ks-hint', key: 'n' },
          arr(st0.targets.aspects).length * arr(st0.targets.resolutions).length + ' entregables de vídeo por campaña.'),
      ]),

      h(Card, { key: 'pr', title: 'Producción' }, [
        h('div', { className: 'ks-grid ks-grid-4', key: 'g' }, [
          h(Field, { key: 'h', label: 'Duración hero (s)' },
            h(TextInput, { type: 'number', min: 5, max: 180, value: st0.heroDurationSec,
              onChange: (v) => setS((sx) => { sx.heroDurationSec = clamp(v, 5, 180); }) })),
          h(Field, { key: 's', label: 'Duración corto (s)' },
            h(TextInput, { type: 'number', min: 5, max: 90, value: st0.shortDurationSec,
              onChange: (v) => setS((sx) => { sx.shortDurationSec = clamp(v, 5, 90); }) })),
          h(Field, { key: 'v', label: 'Variantes' },
            h(TextInput, { type: 'number', min: 1, max: 8, value: st0.variantCount,
              onChange: (v) => setS((sx) => { sx.variantCount = clamp(v, 1, 8); }) })),
          h(Field, { key: 'f', label: 'FPS' },
            h(Select, { value: s(st0.fps), options: [24, 25, 30, 50, 60].map((x) => ({ value: String(x), label: x + ' fps' })),
              onChange: (v) => setS((sx) => { sx.fps = num(v, 25); }) })),
        ]),
        h('div', { className: 'ks-switches', key: 'sw' }, [
          h('div', { className: 'ks-switch', key: 'su' }, [
            h(Toggle, { key: 't', value: st0.subtitles !== false, onChange: (v) => setS((sx) => { sx.subtitles = v; }) }),
            h('span', { key: 'l' }, 'Subtítulos quemados en el máster'),
          ]),
          h('div', { className: 'ks-switch', key: 'sa' }, [
            h(Toggle, { key: 't', value: st0.safeAreas !== false, onChange: (v) => setS((sx) => { sx.safeAreas = v; }) }),
            h('span', { key: 'l' }, 'Respetar zonas seguras en vertical'),
          ]),
        ]),
      ]),

      h(Card, { key: 'i', title: 'Información' }, [
        h('div', { className: 'ks-kv', key: 'k' }, [
          h('div', { key: '1' }, [h('span', { key: 'a' }, 'Versión'), h('strong', { key: 'b' }, KS_VERSION)]),
          h('div', { key: '2' }, [h('span', { key: 'a' }, 'Instancia'), h('strong', { key: 'b' }, s(instanceId) || 'sin instancia')]),
          h('div', { key: '3' }, [h('span', { key: 'a' }, 'Proveedores registrados'), h('strong', { key: 'b' }, PROVIDERS.length)]),
          h('div', { key: '4' }, [h('span', { key: 'a' }, 'Agentes'), h('strong', { key: 'b' }, AGENTS.length + 1)]),
        ]),
        h('div', { className: 'ks-cardfoot', key: 'f' }, [
          h(Btn, { key: 'b', size: 'sm', onClick: () => download(slug(model.title) + '-biblia.md', exportBible(model), 'text/markdown') }, 'Exportar biblia'),
          h(Btn, { key: 'j', size: 'sm', onClick: () => download(slug(model.title) + '.json', JSON.stringify(model, null, 2), 'application/json') }, 'Exportar JSON'),
          h(Btn, { key: 'r', size: 'sm', variant: 'danger', onClick: () => {
            if (globalThis.window && !window.confirm('¿Vaciar la campaña y empezar de cero? Las versiones guardadas se conservan.')) return;
            const keep = arr(model.versions);
            const fresh = migrate(emptyCampaign());
            fresh.versions = keep;
            commit(fresh);
            notify('info', 'Campaña reiniciada.');
          } }, 'Reiniciar campaña'),
        ]),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Organización — el mapa de la empresa, editable
  //
  // La misma información que el Flujo, contada como un sitio: departamentos,
  // procesos internos y quién los atiende. En forma juego se recorre como una
  // villa, un hotel o un territorio; en forma clásica es un plano de planta.
  //
  // Lo que se ve NO es decorado: cada avatar de IA está enlazado a un agente
  // del flujo y su comportamiento sale de su estado real. Si ejecutas el
  // Storyboard Generator desde aquí, su avatar se pone a trabajar de verdad.
  // ═════════════════════════════════════════════════════════════════════════

  const KIND_LABEL = { village: 'villa', hotel: 'hotel', territory: 'territorio', plan: 'plano' };

  /** Ambientación activa: la del modo de juego, o el plano en forma clásica. */
  function worldKind(theme) {
    return theme.formId === 'game' ? (s(obj(theme.world).kind) || 'village') : 'plan';
  }

  /** «1 proceso» / «2 procesos»: contar mal se nota más que cualquier adorno. */
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  const depOptions = () => WS_DEPARTMENTS.map((d) => ({ value: d.id, label: d.emoji + '  ' + d.label }));
  const structOptions = (kind) => WS_STRUCTURES.map((x) => {
    const local = wsStructureName(x.id, kind);
    return { value: x.id, label: x.emoji + '  ' + x.label + (norm(local) === norm(x.label) ? '' : ' · ' + local) };
  });

  // ── Detalle de un área ─────────────────────────────────────────────────
  function AreaEditor(props) {
    const p = obj(props);
    const a = p.area;
    const kind = p.kind;
    const [stationName, setStationName] = useState('');
    const dep = wsDepartmentById(a.departmentId);
    const staffHere = arr(model.world.staff).filter((x) => x.areaId === a.id);

    const upd = (patchArea) => applyWorld((w) => wsUpdateArea(w, a.id, patchArea), { quiet: true });

    return h('div', { key: a.id }, [
      h('div', { className: 'ks-form ws-form', key: 'f' }, [
        h(Field, { key: 'n', label: 'Nombre' },
          h(TextInput, { value: a.name, onChange: (v) => upd({ name: v }) })),
        h(Field, { key: 'd', label: 'Departamento' },
          h(Select, { value: a.departmentId, options: depOptions(), onChange: (v) => upd({ departmentId: v }) })),
        h(Field, { key: 's', label: 'Estructura',
          help: norm(wsStructureName(a.structure, kind)) === norm(wsStructureById(a.structure).label)
            ? '' : 'Aquí se ve como «' + wsStructureName(a.structure, kind) + '».' },
          h(Select, { value: a.structure, options: structOptions(kind), onChange: (v) => upd({ structure: v }) })),
        h(Field, { key: 'w', label: 'Ancho (celdas)' },
          h(TextInput, { type: 'number', min: 1, max: 8, value: a.w, onChange: (v) => upd({ w: v }) })),
        h(Field, { key: 'h', label: 'Alto (celdas)' },
          h(TextInput, { type: 'number', min: 1, max: 8, value: a.h, onChange: (v) => upd({ h: v }) })),
        h(Field, { key: 'x', label: 'Posición X' },
          h(TextInput, { type: 'number', min: 0, value: a.x, onChange: (v) => upd({ x: v }) })),
        h(Field, { key: 'y', label: 'Posición Y' },
          h(TextInput, { type: 'number', min: 0, value: a.y, onChange: (v) => upd({ y: v }) })),
      ]),
      h(Field, { key: 'note', label: 'Nota', wide: true },
        h(TextArea, { value: a.note, rows: 2, placeholder: 'Para qué sirve este departamento',
          onChange: (v) => upd({ note: v }) })),

      h('h4', { className: 'ws-subhead', key: 'sth' }, 'Procesos internos'),
      h('p', { className: 'ws-mini', key: 'sthx' },
        'Cada puesto es un proceso del departamento. El personal se reparte entre ellos, y ahí es donde se le ve trabajar.'),
      h('div', { className: 'ks-list ws-list ws-sub', key: 'st' }, arr(a.stations).map((st) => h('div', {
        key: st.id, className: 'ws-row',
      }, [
        h('span', { className: 'ws-row-dot', key: 'd', style: { background: dep.color } }),
        h('div', { className: 'ws-row-body', key: 'b' }, [
          h(TextInput, { key: 'n', value: st.name,
            onChange: (v) => applyWorld((w) => wsUpdateStation(w, a.id, st.id, { name: v }), { quiet: true }) }),
          h(TextInput, { key: 'p', value: st.process, placeholder: 'Qué se hace en este puesto',
            onChange: (v) => applyWorld((w) => wsUpdateStation(w, a.id, st.id, { process: v }), { quiet: true }) }),
        ]),
        h(Btn, { key: 'x', size: 'xs', variant: 'ghost', title: 'Eliminar puesto',
          onClick: () => applyWorld((w) => wsRemoveStation(w, a.id, st.id)) }, '✕'),
      ]))),
      h('div', { className: 'ws-actions', key: 'sta' }, [
        h(TextInput, { key: 'i', value: stationName, placeholder: 'Nombre del nuevo puesto',
          onChange: setStationName }),
        h(Btn, { key: 'b', size: 'sm', onClick: () => {
          if (applyWorld((w) => wsAddStation(w, a.id, { name: stationName }))) setStationName('');
        } }, 'Añadir puesto'),
      ]),

      h('p', { className: 'ws-mini', key: 'who' }, staffHere.length
        ? 'Aquí trabajan ' + staffHere.map((x) => x.name).join(', ') + '.'
        : 'Todavía no hay nadie asignado a esta área.'),

      h('div', { className: 'ws-actions', key: 'del' }, [
        h(Btn, { key: 'd', size: 'sm', variant: 'danger',
          onClick: () => { if (applyWorld((w) => wsRemoveArea(w, a.id))) setUi({ worldArea: null }); } },
          'Eliminar área'),
      ]),
    ]);
  }

  // ── Detalle de una persona o agente ────────────────────────────────────
  function StaffEditor(props) {
    const p = obj(props);
    const person = p.person;
    const world = model.world;
    const area = arr(world.areas).find((x) => x.id === person.areaId) || null;
    const node = person.agentId ? arr(p.plan).find((x) => x.id === person.agentId) : null;
    const upd = (q) => applyWorld((w) => wsUpdateStaff(w, person.id, q), { quiet: true });

    return h('div', { key: person.id }, [
      h('div', { className: 'ks-form ws-form', key: 'f' }, [
        h(Field, { key: 'n', label: 'Nombre' },
          h(TextInput, { value: person.name, disabled: !!node, onChange: (v) => upd({ name: v }) })),
        h(Field, { key: 'r', label: 'Puesto o rol' },
          h(TextInput, { value: person.role, onChange: (v) => upd({ role: v }) })),
        h(Field, { key: 'k', label: 'Tipo', help: node ? 'Enlazado a un agente del flujo: no puede pasar a persona.' : '' },
          h(Select, { value: person.kind, disabled: !!node,
            options: [{ value: 'human', label: '🧑 Persona' }, { value: 'ai', label: '🤖 Agente de IA' }],
            onChange: (v) => upd({ kind: v }) })),
        h(Field, { key: 'a', label: 'Área' },
          h(Select, { value: person.areaId, options: arr(world.areas).map((x) => ({ value: x.id, label: x.name })),
            onChange: (v) => upd({ areaId: v }) })),
        area ? h(Field, { key: 's', label: 'Puesto' },
          h(Select, { value: person.stationId, options: arr(area.stations).map((x) => ({ value: x.id, label: x.name })),
            onChange: (v) => upd({ stationId: v }) })) : null,
      ]),
      node ? h('div', { className: 'ks-kv ks-kv-sm', key: 'ag' }, [
        h('div', { key: '1' }, [h('span', { key: 'a' }, 'Agente del flujo'),
          h('strong', { key: 'b' }, node.emoji + ' ' + node.name)]),
        h('div', { key: '2' }, [h('span', { key: 'a' }, 'Estado ahora'),
          h('strong', { key: 'b' }, STATUS_LABEL[node.status] || node.status)]),
        h('div', { key: '3' }, [h('span', { key: 'a' }, 'Escribe'), h('strong', { key: 'b' }, node.writes || '—')]),
      ]) : null,
      node ? h('p', { className: 'ws-mini', key: 'desc' }, node.description) : null,
      h('div', { className: 'ws-actions', key: 'a' }, [
        node ? h(Btn, { key: 'r', size: 'sm', variant: 'primary', disabled: node.disabled || node.blocked,
          onClick: () => runStages([node.id], node.name) }, 'Ponerle a trabajar') : null,
        node ? h(Btn, { key: 'f', size: 'sm', onClick: () => setUi({ view: 'flow', flowSel: node.id }) },
          'Ver en el flujo') : null,
        h(Btn, { key: 'd', size: 'sm', variant: 'danger', disabled: !!node,
          title: node ? 'Los agentes del flujo no se dan de baja aquí: desactívalos en el Flujo.' : '',
          onClick: () => { if (applyWorld((w) => wsRemoveStaff(w, person.id))) setUi({ worldStaff: null }); } },
          'Dar de baja'),
      ].filter(Boolean)),
    ]);
  }

  // ── Alta de áreas y de personal ────────────────────────────────────────
  function AreaCreator(props) {
    const kind = obj(props).kind;
    const [dep, setDep] = useState('rrhh');
    const [name, setName] = useState('');
    const [struct, setStruct] = useState('office');
    return h('div', { className: 'ws-form', key: 'new' }, [
      h(Field, { key: 'd', label: 'Departamento' },
        h(Select, { value: dep, options: depOptions(), onChange: setDep })),
      h(Field, { key: 'n', label: 'Nombre', help: 'Vacío = el del departamento.' },
        h(TextInput, { value: name, placeholder: wsDepartmentById(dep).label, onChange: setName })),
      h(Field, { key: 's', label: 'Estructura' },
        h(Select, { value: struct, options: structOptions(kind), onChange: setStruct })),
      h(Field, { key: 'b', label: ' ' },
        h(Btn, { variant: 'primary', size: 'sm', onClick: () => {
          const before = arr(model.world.areas).map((x) => x.id);
          if (applyWorld((w) => wsAddArea(w, { departmentId: dep, name, structure: struct }))) {
            const added = arr(model.world.areas).find((x) => before.indexOf(x.id) < 0);
            setName('');
            if (added) setUi({ worldTab: 'areas', worldArea: added.id, worldStaff: null });
          }
        } }, 'Añadir área')),
    ]);
  }

  function StaffCreator() {
    const world = model.world;
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [areaId, setAreaId] = useState('');
    const area = arr(world.areas).find((x) => x.id === areaId) || arr(world.areas)[0] || null;
    return h('div', { className: 'ws-form', key: 'new' }, [
      h(Field, { key: 'n', label: 'Nombre' },
        h(TextInput, { value: name, placeholder: 'Quién se incorpora', onChange: setName })),
      h(Field, { key: 'r', label: 'Puesto o rol' },
        h(TextInput, { value: role, placeholder: 'Diseñador, becaria, contable…', onChange: setRole })),
      h(Field, { key: 'a', label: 'Área' },
        h(Select, { value: area ? area.id : '', options: arr(world.areas).map((x) => ({ value: x.id, label: x.name })),
          onChange: setAreaId })),
      h(Field, { key: 'b', label: ' ' },
        h(Btn, { variant: 'primary', size: 'sm', disabled: !arr(world.areas).length, onClick: () => {
          if (!s(name).trim()) { notify('error', 'Ponle un nombre a la persona.'); return; }
          if (applyWorld((w) => wsAddStaff(w, { name, role, kind: 'human', areaId: area ? area.id : '' }))) {
            setName(''); setRole('');
          }
        } }, 'Incorporar persona')),
    ]);
  }

  // ── Vista ──────────────────────────────────────────────────────────────
  function WorldView() {
    const theme = currentTheme();
    const kind = worldKind(theme);
    const world = model.world;
    const sum = wsWorldSummary(world);
    const plan = workflowPlan(model);

    // Un mapa de estados por agente, calculado UNA vez por repintado: la
    // simulación pregunta por cada avatar y en cada fotograma.
    const statusMap = {};
    for (const n of plan) statusMap[n.id] = n.status;
    const statusOf = (agentId) => statusMap[s(agentId)] || '';

    const selArea = arr(world.areas).find((x) => x.id === ui.worldArea) || null;
    const selStaff = arr(world.staff).find((x) => x.id === ui.worldStaff) || null;
    const tab = ui.worldTab === 'staff' ? 'staff' : 'areas';

    const depsPresent = uniq(arr(world.areas).map((a) => a.departmentId)).map(wsDepartmentById);

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Organización',
        subtitle: plural(sum.areas, 'área', 'áreas') + ' · ' + plural(sum.puestos, 'proceso', 'procesos')
          + ' · ' + plural(sum.agentes, 'agente de IA', 'agentes de IA')
          + ' · ' + plural(sum.personas, 'persona', 'personas')
          + ' · mapa ' + sum.mapa + ' · ' + (KIND_LABEL[kind] || kind),
        actions: [
          h(Btn, { key: 'f', size: 'sm', onClick: () => setUi({ view: 'flow' }) }, 'Ir al flujo'),
          h(Btn, { key: 'r', size: 'sm', variant: 'primary',
            onClick: () => runStages(null, 'Pipeline') }, 'Ejecutar flujo'),
        ] }),

      h(Card, { key: 'sk', title: 'Aspecto' }, [
        h(SkinPicker, { key: 'p' }),
        h('p', { className: 'ks-hint', key: 'n' }, theme.formId === 'game'
          ? skinHint(theme)
          : 'En forma clásica la organización se ve como un plano de planta. Cambia a forma Juego para recorrerla.'),
      ]),

      h('div', { className: 'ws-stage', key: 'stage' }, [
        h('div', { className: 'ws-scroll', key: 's' }, arr(world.areas).length
          ? h(WsWorldSurface, {
            world, kind, statusOf,
            selArea: ui.worldArea, selStaff: ui.worldStaff,
            onSelectArea: (id) => setUi({ worldArea: id, worldStaff: null, worldTab: 'areas' }),
            onSelectStaff: (id) => setUi({ worldStaff: id, worldArea: null, worldTab: 'staff' }),
          })
          : h(Empty, { icon: '🗺️', text: 'El mapa está vacío. Añade un área o vuelve a sembrarlo desde el flujo.' })),
        h('div', { className: 'ws-legend', key: 'l' }, [
          h('span', { key: 'ai' }, [h('i', { key: 'd', style: { background: '#4ECDC4' } }), 'Agente de IA']),
          h('span', { key: 'hu' }, [h('i', { key: 'd', style: { background: '#C9A227' } }), 'Persona']),
        ].concat(depsPresent.map((d) => h('span', { key: d.id },
          [h('i', { key: 'd', style: { background: d.color } }), d.label])))),
      ]),

      h('div', { className: 'ws-cols', key: 'cols' }, [
        h(Card, { key: 'list', title: 'Qué hay en el mapa', flush: false }, [
          h('div', { className: 'ws-tabs', key: 't' }, [
            h('button', { key: 'a', type: 'button', className: cx('ws-tab', tab === 'areas' && 'ws-tab-on'),
              onClick: () => setUi({ worldTab: 'areas' }) }, 'Áreas · ' + sum.areas),
            h('button', { key: 's', type: 'button', className: cx('ws-tab', tab === 'staff' && 'ws-tab-on'),
              onClick: () => setUi({ worldTab: 'staff' }) }, 'Personal · ' + (sum.agentes + sum.personas)),
          ]),
          tab === 'areas'
            ? h('div', { className: 'ks-list ws-list', key: 'la' }, arr(world.areas).map((a) => {
              const dep = wsDepartmentById(a.departmentId);
              const here = arr(world.staff).filter((x) => x.areaId === a.id).length;
              return h('button', {
                key: a.id, type: 'button', className: cx('ws-row', ui.worldArea === a.id && 'ws-row-on'),
                onClick: () => setUi({ worldArea: a.id, worldStaff: null }),
              }, [
                h('span', { className: 'ws-row-dot', key: 'd', style: { background: dep.color } }),
                h('span', { className: 'ws-row-body', key: 'b' }, [
                  h('strong', { key: 'n' }, a.name),
                  h('span', { key: 'm' }, wsStructureName(a.structure, kind) + ' · '
                    + plural(arr(a.stations).length, 'proceso', 'procesos') + ' · '
                    + plural(here, 'ocupante', 'ocupantes')),
                ]),
                h('span', { className: 'ws-row-tag', key: 't' }, a.w + '×' + a.h),
              ]);
            }))
            : h('div', { className: 'ks-list ws-list', key: 'ls' }, arr(world.staff).map((x) => {
              const area = arr(world.areas).find((y) => y.id === x.areaId);
              const st = area ? arr(area.stations).find((y) => y.id === x.stationId) : null;
              const status = x.agentId ? statusOf(x.agentId) : '';
              return h('button', {
                key: x.id, type: 'button', className: cx('ws-row', ui.worldStaff === x.id && 'ws-row-on'),
                onClick: () => setUi({ worldStaff: x.id, worldArea: null }),
              }, [
                h('span', { className: 'ws-row-dot', key: 'd',
                  style: { background: x.kind === 'ai' ? '#4ECDC4' : '#C9A227' } }),
                h('span', { className: 'ws-row-body', key: 'b' }, [
                  h('strong', { key: 'n' }, (x.kind === 'ai' ? '🤖 ' : '🧑 ') + x.name),
                  h('span', { key: 'm' }, (x.role || '—') + ' · ' + (area ? area.name : 'sin área')
                    + (st ? ' · ' + st.name : '')),
                ]),
                status ? h('span', { className: 'ws-row-tag', key: 't' }, STATUS_LABEL[status] || status) : null,
              ]);
            })),
          h('h4', { className: 'ws-subhead', key: 'nh' }, tab === 'areas' ? 'Nueva área' : 'Nueva persona'),
          tab === 'areas' ? h(AreaCreator, { key: 'nc', kind }) : h(StaffCreator, { key: 'nc' }),
        ]),

        h(Card, { key: 'det', title: selArea ? 'Área seleccionada' : selStaff ? 'Ficha' : 'Detalle' },
          selArea ? h(AreaEditor, { area: selArea, kind })
            : selStaff ? h(StaffEditor, { person: selStaff, plan })
              : h('p', { className: 'ks-hint' },
                'Pincha una estructura o un avatar del mapa —o una fila de la lista— para editarlo.')),
      ]),

      h(Card, { key: 'map', title: 'Terreno' }, [
        h('div', { className: 'ws-form', key: 'f' }, [
          h(Field, { key: 'w', label: 'Ancho del mapa' },
            h(TextInput, { type: 'number', min: 6, max: 40, value: obj(world.grid).w,
              onChange: (v) => applyWorld((w) => wsResizeGrid(w, v, obj(model.world.grid).h)) })),
          h(Field, { key: 'h', label: 'Alto del mapa' },
            h(TextInput, { type: 'number', min: 6, max: 40, value: obj(world.grid).h,
              onChange: (v) => applyWorld((w) => wsResizeGrid(w, obj(model.world.grid).w, v)) })),
          h(Field, { key: 'r', label: ' ', help: 'Rehace el mapa desde los agentes del flujo. Se pierde lo que hayas editado.' },
            h(Btn, { size: 'sm', onClick: () => {
              patch((m) => { m.world = seedOrgWorld(m); logLine(m, 'info', 'Organización · mapa sembrado de nuevo.'); });
              setUi({ worldArea: null, worldStaff: null });
              notify('success', 'Mapa sembrado de nuevo desde el flujo.');
            } }, 'Sembrar de nuevo')),
        ]),
        h('p', { className: 'ks-hint', key: 'n' },
          'El mapa no se puede encoger por encima de un área ocupada: primero muévela o bórrala.'),
      ]),

      h(Card, { key: 'help', title: 'Cómo se relaciona esto con el trabajo real' }, [
        h('ul', { className: 'ks-list', key: 'l' }, [
          'Cada avatar de IA es un agente del flujo. Su comportamiento sale de su estado real: si se está ejecutando, camina a su puesto y trabaja; si está bloqueado, se planta con un «!»; si lo desactivas, se va a la zona común.',
          'Las personas son tuyas: añádelas, cámbialas de área y repártelas entre procesos. Nadie las ejecuta ni las simula como agentes; están para que se vea quién acompaña a cada máquina.',
          'Las áreas son departamentos y sus puestos son los procesos internos. Son los mismos datos en las cuatro ambientaciones: cambiar de villa a hotel o a territorio no mueve una sola celda.',
          'El movimiento se pausa cuando la ventana no está a la vista, y no arranca si tu sistema pide menos animación.',
        ].map((x, i) => h('li', { key: i }, x))),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Guía
  // Lo que la app hace y lo que NO hace, en la propia app. El punto que más
  // confunde —Kreative Studio no llama a los modelos generativos— no se
  // deduce de la interfaz, así que se dice aquí y en primera pantalla.
  // ═════════════════════════════════════════════════════════════════════════

  const go = (view) => () => setUi({ view });

  const GUIDE_STEPS = [
    {
      n: 1, title: 'Rellena el brief', view: 'brief', cta: 'Ir al Brief',
      body: 'Lo único obligatorio es el nombre del producto y las fotos. Sube frontal, tres cuartos y un detalle de material, y marca la mejor como principal: es la referencia que reciben los modelos y lo que impide que se inventen la forma del producto.',
      tip: 'Si el producto ya está en ProductLab, impórtalo: trae nombre, precio, especificaciones y toda la galería sin teclear nada.',
    },
    {
      n: 2, title: 'Escribe lo que quieres', view: 'dashboard', cta: 'Ir al Panel',
      body: 'Una frase en lenguaje natural: «crea una campaña premium», «quiero un comercial épico», «véndelo para deportistas», «algo minimal de 15 segundos». El sistema deduce estilo, objetivo, público y duración, y ejecuta los doce agentes.',
      tip: 'Puedes decir el objetivo explícitamente («que convierta», «para un lanzamiento») y manda sobre lo que sugiera el estilo.',
    },
    {
      n: 3, title: 'Revisa y ajusta', view: 'storyboard', cta: 'Ver el storyboard',
      body: 'La campaña sale completa, no a medias. Cambia lo que no te convenza —una duración, un encuadre, una óptica, un rótulo— y los prompts, el audio, el montaje y la analítica se regeneran solos.',
      tip: 'Si no te gusta la dirección entera, cambia de estilo en el Marketplace: se regenera todo de forma coherente, no solo los colores.',
    },
    {
      n: 4, title: 'Produce el material', view: 'jobs', cta: 'Ver la producción',
      body: 'Díselo al agente de KIMOS: «produce el material pendiente». Él pide el siguiente lote, genera cada imagen, vídeo y audio con sus modelos y devuelve los resultados; la app los versiona, cierra cada trabajo y contabiliza el coste real. Repite solo hasta que quede en cero.',
      tip: 'El orden no es negociable: primero los keyframes, y las tomas de vídeo parten de ellos. Un vídeo malo cuesta entre 10 y 30 veces más que la imagen que lo habría evitado.',
    },
    {
      n: 5, title: 'Renderiza', view: 'jobs', cta: 'Bundle de render',
      body: 'Cuando la producción llega al 100 %, descarga el bundle de render: un único script que baja todos los archivos generados a su sitio, une las tomas que hubo que partir, escribe los subtítulos y ejecuta FFmpeg hasta los entregables finales en cada formato.',
      tip: 'La biblia de campaña (botón «Biblia» arriba) es el documento que se le entrega al cliente: concepto, plan, storyboard, copy y costes.',
    },
  ];

  const GUIDE_DELIVERS = [
    { view: 'research', icon: '⌕', title: 'Investigación', text: 'Mercado y tendencias, público con sus objeciones y disparadores de compra, competencia con el hueco que deja cada uno, nicho y benchmarks por canal.' },
    { view: 'concept', icon: '✧', title: 'Concepto', text: 'Idea, mensaje clave, arco narrativo, emociones, atributos convertidos en beneficios con su prueba, money shot y moodboard.' },
    { view: 'plan', icon: '⌗', title: 'Plan y funnel', text: 'Cuatro etapas con reparto exacto del presupuesto, canales, calendario de cuatro semanas, KPIs razonados y plan de pruebas A/B.' },
    { view: 'storyboard', icon: '▦', title: 'Storyboard', text: 'Escenas con duración, encuadre, ángulo, óptica, movimiento, iluminación, etalonaje, efectos, rótulo y nota de sonido. Cortes por formato y variantes con hipótesis.' },
    { view: 'prompts', icon: '⌨', title: 'Prompts', text: 'Imagen y vídeo por escena, escritos en el dialecto del proveedor que elijas, con negativo y parámetros. Exportables en CSV.' },
    { view: 'audio', icon: '♪', title: 'Voz y música', text: 'Locución ajustada al metraje plano a plano, dirección actoral, brief de música con estructura y notas de mezcla, ambiente y efectos.' },
    { view: 'editor', icon: '✂', title: 'Montaje', text: 'Timeline multipista, subtítulos SRT, lista EDL y script FFmpeg completo hasta el entregable final en cada formato.' },
    { view: 'copy', icon: '✎', title: 'Copy', text: 'Anuncios por plataforma con variantes de gancho distintas y dentro del límite de caracteres real, landing completa con objeciones y SEO, y secuencia de cinco emails.' },
    { view: 'brand', icon: '◈', title: 'Control de marca', text: 'Auditoría con puntuación y hallazgos accionables: paleta, contraste, tipografía, logotipo, consistencia del producto y términos prohibidos.' },
    { view: 'analytics', icon: '▲', title: 'Analytics', text: 'Coste estimado frente al real por proveedor, consumo, y proyección de impresiones, CTR, CPA y ROAS con el ajuste creativo explicado.' },
  ];

  const GUIDE_PITFALLS = [
    { bad: 'Empezar sin fotos del producto', good: 'Sin referencia real, los modelos se inventan la forma y ningún plano casa con el siguiente. Es el error que más caro sale.' },
    { bad: 'Generar los vídeos antes que los keyframes', good: 'Valida la imagen fija primero. Un segundo de vídeo cuesta lo que veinte imágenes.' },
    { bad: 'Exportar solo en 16:9', good: 'El descubrimiento ocurre en vertical. Sin una pieza 9:16 nativa, Analytics descuenta en torno a un 12 % de rendimiento en feeds móviles.' },
    { bad: 'Quitar los subtítulos', good: 'La mayoría del vídeo social se ve sin sonido. Quitarlos descuenta otro 10 %.' },
    { bad: 'Una sola variante', good: 'Con menos de tres, la creatividad se satura en menos de dos semanas y el coste por resultado sube solo.' },
    { bad: 'Repetir el prompt cuando un plano falla', good: 'Si falla dos veces, cambia el encuadre. Suele ser el problema real y se resuelve antes.' },
  ];

  function GuideView() {
    const hasProduct = s(model.brief.productName).trim().length > 0;
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Cómo funciona Kreative Studio',
        subtitle: 'De las fotos de un producto y una frase, a la campaña completa: no solo el vídeo, también el plan, el copy, la landing, los emails y los números.',
        actions: [h(Btn, { key: 'b', variant: 'primary', onClick: go(hasProduct ? 'dashboard' : 'brief') },
          hasProduct ? 'Ir al Panel' : 'Empezar por el Brief')] }),

      // ── Lo que hace y lo que no ──────────────────────────────────────
      h('div', { className: 'ks-guide-truth', key: 'truth' }, [
        h('div', { className: 'ks-guide-does', key: 'a' }, [
          h('h3', { key: 't' }, 'Lo que hace'),
          h('ul', { className: 'ks-list', key: 'l' }, [
            'Investiga la categoría, el público y la competencia, y define el concepto creativo.',
            'Planifica el funnel y reparte el presupuesto entre etapas y canales.',
            'Dirige el storyboard plano a plano, con óptica, luz, color, movimiento y ritmo.',
            'Escribe los prompts de cada escena para el modelo que elijas.',
            'Escribe la locución ajustada al metraje y el brief de música.',
            'Genera el script de montaje, los subtítulos y la lista de decisiones.',
            'Redacta el copy de cada plataforma, la landing y la secuencia de email.',
            'Audita la consistencia de marca y contabiliza costes y proyecciones.',
          ].map((x, i) => h('li', { key: i }, x))),
        ]),
        h('div', { className: 'ks-guide-doesnt', key: 'b' }, [
          h('h3', { key: 't' }, 'Lo que NO hace'),
          h('ul', { className: 'ks-list', key: 'l' }, [
            h('li', { key: '1' }, [h('strong', { key: 's' }, 'No llama a los modelos por su cuenta. '),
              'Esta app corre en tu navegador y no puede custodiar claves de API de terceros. Quien genera es el agente de KIMOS con sus conexiones: la app le dice exactamente qué toca hacer ahora, con qué modelo y con qué referencia, y él devuelve los archivos. Tú solo tienes que pedírselo.']),
            h('li', { key: '2' }, [h('strong', { key: 's' }, 'No ejecuta el render. '),
              'Prepara el bundle completo —descarga de archivos, unión de tomas, subtítulos y FFmpeg— pero el render corre en tu máquina o en tu servidor.']),
            h('li', { key: '3' }, [h('strong', { key: 's' }, 'No compra medios ni publica. '),
              'Deja el copy y los entregables listos para subirlos al gestor de anuncios.']),
            h('li', { key: '4' }, [h('strong', { key: 's' }, 'No promete resultados. '),
              'Las cifras de Analytics son proyecciones a partir de benchmarks públicos y de las decisiones del propio storyboard. Sirven para dimensionar y comparar variantes entre sí.']),
          ]),
        ]),
      ]),

      // ── Los cinco pasos ──────────────────────────────────────────────
      h(Card, { key: 'steps', title: 'El flujo, en cinco pasos' }, [
        h('div', { className: 'ks-guide-steps', key: 's' }, GUIDE_STEPS.map((st) => h('div', {
          key: st.n, className: 'ks-guide-step',
        }, [
          h('span', { className: 'ks-guide-num', key: 'n' }, st.n),
          h('div', { className: 'ks-guide-stepbody', key: 'b' }, [
            h('strong', { key: 't' }, st.title),
            h('p', { key: 'd' }, st.body),
            h('p', { className: 'ks-guide-tip', key: 'p' }, st.tip),
            h(Btn, { key: 'c', size: 'xs', onClick: go(st.view) }, st.cta),
          ]),
        ]))),
      ]),

      // ── Qué recibes ──────────────────────────────────────────────────
      h(Card, { key: 'del', title: 'Qué recibes' }, [
        h('div', { className: 'ks-guide-grid', key: 'g' }, GUIDE_DELIVERS.map((d) => h('div', {
          key: d.view, className: 'ks-guide-card', onClick: go(d.view), title: 'Abrir ' + d.title,
        }, [
          h('span', { className: 'ks-guide-icon', key: 'i' }, d.icon),
          h('strong', { key: 't' }, d.title),
          h('p', { key: 'x' }, d.text),
        ]))),
        h('p', { className: 'ks-hint', key: 'f' },
          'Todo se exporta: biblia de campaña en Markdown, script FFmpeg, subtítulos, EDL, y CSV de prompts, de copy y de trabajos.'),
      ]),

      // ── El ciclo de producción ───────────────────────────────────────
      h(Card, { key: 'cycle', title: 'Cómo se cierra el ciclo de producción' }, [
        h('div', { className: 'ks-guide-cycle', key: 'c' }, [
          { t: 'Lote', d: 'La app entrega el siguiente bloque que toca generar, con proveedor, prompt y referencia.' },
          { t: 'Generación', d: 'El agente lo genera con sus modelos, respetando el orden: keyframes antes que vídeo.' },
          { t: 'Registro', d: 'Devuelve todo de una vez: se versiona por escena, cierra cada trabajo y suma el coste real.' },
          { t: 'Render', d: 'Al llegar a cero, el bundle baja los archivos, los ordena y monta los entregables.' },
        ].map((x, i, all) => h('div', { key: i, className: 'ks-guide-cyclestep' }, [
          h('strong', { key: 't' }, x.t),
          h('p', { key: 'd' }, x.d),
          i < all.length - 1 ? h('span', { className: 'ks-guide-arrow', key: 'a' }, '→') : null,
        ]))),
        h('p', { className: 'ks-hint', key: 'n' },
          'Desde el chat de KIMOS basta con pedirlo: «produce el material pendiente de Kreative Studio». '
          + 'El agente repite el ciclo solo hasta que no quede nada, y te avisa cuando esté lista para renderizar.'),
      ]),

      // ── Errores frecuentes ───────────────────────────────────────────
      h(Card, { key: 'pit', title: 'Errores que salen caros' }, [
        h('div', { className: 'ks-guide-pitfalls', key: 'p' }, GUIDE_PITFALLS.map((x, i) => h('div', {
          key: i, className: 'ks-guide-pitfall',
        }, [
          h('strong', { key: 'b' }, x.bad),
          h('p', { key: 'g' }, x.good),
        ]))),
      ]),

      // ── Frases de ejemplo ────────────────────────────────────────────
      h(Card, { key: 'say', title: 'Qué puedes escribir' }, [
        h('p', { className: 'ks-hint', key: 'i' },
          'En el Panel o en el chat de KIMOS. La frase decide el estilo, el objetivo, el público y hasta la duración.'),
        h('div', { className: 'ks-guide-says', key: 's' }, [
          ['Crea una campaña premium', 'estilo cinematográfico sobrio, objetivo de notoriedad'],
          ['Quiero un comercial épico que convierta', 'estilo intenso, pero el objetivo explícito manda: conversión'],
          ['Véndelo para deportistas', 'público atletas, lenguaje directo, prueba de rendimiento'],
          ['Algo minimal y limpio de 15 segundos', 'estilo nórdico, metraje ajustado a 15 s'],
          ['Hazlo viral para TikTok', 'estilo urbano, ritmo alto, vertical nativo'],
          ['Campaña de remarketing para carritos abandonados', 'funnel volcado a recuperación, mensaje de objeción'],
        ].map((x, i) => h('div', { key: i, className: 'ks-guide-say' }, [
          h('code', { key: 'q' }, '«' + x[0] + '»'),
          h('span', { key: 'w' }, x[1]),
        ]))),
      ]),

      // ── Proveedores ──────────────────────────────────────────────────
      h(Card, { key: 'prov', title: 'Los modelos son intercambiables',
        actions: [h(Btn, { key: 'b', size: 'sm', onClick: go('settings') }, 'Elegir proveedores')] }, [
        h('p', { className: 'ks-lead', key: 'p' },
          'Ningún agente conoce a un modelo concreto: describen la escena en un formato neutral y la app la traduce al dialecto de cada proveedor. '
          + 'Cambiar de Runway a Veo reescribe los prompts de toda la campaña y no toca nada más.'),
        h('div', { className: 'ks-guide-provs', key: 'g' }, CAPABILITIES.map((cap) => h('div', {
          key: cap.id, className: 'ks-guide-prov',
        }, [
          h('strong', { key: 't' }, cap.emoji + ' ' + cap.label),
          h('span', { key: 'l' }, providersFor(cap.id).map((p) => p.label).join(' · ')),
        ]))),
      ]),

      // ── Aspecto y organización ───────────────────────────────────────
      h(Card, { key: 'skin', title: 'Dos formas de ver el mismo trabajo',
        actions: [
          h(Btn, { key: 'f', size: 'sm', onClick: go('flow') }, 'Ver el flujo'),
          h(Btn, { key: 'w', size: 'sm', onClick: go('world') }, 'Ver la organización'),
        ] }, [
        h('p', { className: 'ks-lead', key: 'p' },
          'La forma clásica es un estudio profesional con modos de luz —día, atardecer, noche y «vivo», '
          + 'que sigue la hora del equipo—. La forma juego enseña lo mismo como un sitio por el que pasear: '
          + 'una villa en píxeles (KimosLab), un hotel isométrico (JABOTEL) o un territorio de estructuras (Spacecraft).'),
        h('ul', { className: 'ks-list', key: 'l' }, [
          'En el Flujo se ve la cadena de agentes: qué depende de qué, qué se ha ejecutado y qué está bloqueado. Se puede reordenar, apagar agentes y ejecutarlos sueltos.',
          'En la Organización se ve la empresa: departamentos, sus procesos internos y quién los atiende. Cada agente de IA tiene su avatar y se mueve según su estado real; junto a ellos está el personal humano que añadas.',
          'Se pueden añadir, editar y borrar áreas, procesos y personas en cualquiera de las ambientaciones. El mapa es el mismo en las cuatro: cambiar de piel no mueve una sola celda ni toca la campaña.',
          'El movimiento se pausa cuando la ventana no está a la vista y no arranca si tu sistema pide menos animación.',
        ].map((x, i) => h('li', { key: i }, x))),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI · Raíz de la aplicación
  // ═════════════════════════════════════════════════════════════════════════

  const VIEW_COMPONENTS = {
    guide: GuideView, flow: FlowView, world: WorldView,
    dashboard: DashboardView, brief: BriefView, research: ResearchView, concept: ConceptView,
    plan: PlanView, storyboard: StoryboardView, timeline: TimelineView, prompts: PromptsView,
    audio: AudioView, jobs: JobsView, editor: EditorView, copy: CopyView, brand: BrandView,
    assets: AssetsView, analytics: AnalyticsView, styles: StylesView, versions: VersionsView,
    settings: SettingsView,
  };

  /** Etapas listas por vista, para pintar el punto de estado en el menú. */
  const VIEW_STAGE = {
    research: 'research', concept: 'concept', plan: 'plan', storyboard: 'storyboard',
    timeline: 'edit', prompts: 'prompts', audio: 'audio', jobs: 'production',
    editor: 'edit', copy: 'copy', brand: 'brandCheck', analytics: 'analytics',
  };

  function Component() {
    const [, force] = useState(0);
    useEffect(() => {
      const fn = () => force((x) => x + 1);
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    }, []);

    if (!ui.ready) {
      return h('div', { className: 'kimos-kreative ks-loading' }, [
        h('div', { className: 'ks-loader', key: 'l' }),
        h('p', { key: 't' }, 'Abriendo Kreative Studio…'),
      ]);
    }

    const View = VIEW_COMPONENTS[ui.view] || DashboardView;
    const groups = [];
    for (const v of VIEWS) {
      let g = groups.find((x) => x.name === v.group);
      if (!g) { g = { name: v.group, items: [] }; groups.push(g); }
      g.items.push(v);
    }
    const st = styleById(model.styleId);
    const accent = isHex(model.brand.palette.secondary) ? model.brand.palette.secondary : '#19ACB1';
    // El tema son SOLO variables y dos clases: nada del resto de la interfaz
    // conoce el modo en el que está.
    const theme = currentTheme();
    const rootStyle = Object.assign({ '--ks-accent': accent }, themeVars(theme));

    return h('div', {
      className: cx('kimos-kreative', 'ks-form-' + theme.formId,
        'ks-mode-' + (theme.formId === 'game' ? theme.modeId : theme.effectiveId || theme.modeId)),
      style: rootStyle,
    }, [
      h('header', { className: 'ks-top', key: 't' }, [
        h('div', { className: 'ks-brandmark', key: 'b' }, [
          h('span', { className: 'ks-brandmark-dot', key: 'd' }),
          h('span', { className: 'ks-brandmark-text', key: 't' }, 'Kreative Studio'),
        ]),
        h('input', { key: 'ti', className: 'ks-title-input', value: s(model.title),
          onChange: (e) => patch((m) => { m.title = e.target.value; }), placeholder: 'Título de la campaña' }),
        h('div', { className: 'ks-top-meta', key: 'm' }, [
          h(Chip, { key: 's', tone: 'accent', title: st.tagline, onClick: () => setUi({ view: 'styles' }) }, st.emoji + ' ' + st.name),
          h(Chip, { key: 'o', onClick: () => setUi({ view: 'plan' }) }, objectiveById(model.objectiveId).label),
          h(Chip, { key: 'a', onClick: () => setUi({ view: 'brief' }) }, audienceById(model.audienceId).label),
          h(Chip, { key: 'th', onClick: () => setUi({ view: 'flow' }),
            title: 'Cambiar el aspecto en la vista Flujo' }, theme.emoji + ' ' + theme.label),
        ]),
        h('div', { className: 'ks-top-actions', key: 'a' }, [
          h(Btn, { key: 'g', variant: 'primary', size: 'sm', disabled: ui.busy || !s(model.brief.productName).trim(),
            onClick: () => generateAll(s(model.brief.intent) || 'Crea una campaña premium') },
            ui.busy ? 'Generando…' : 'Generar'),
          h(Btn, { key: 'e', size: 'sm', disabled: !model.concept,
            onClick: () => download(slug(model.title) + '-biblia.md', exportBible(model), 'text/markdown') }, 'Biblia'),
        ]),
      ]),
      h('div', { className: 'ks-body', key: 'b' }, [
        h('nav', { className: 'ks-nav', key: 'n' }, groups.map((g) => h('div', { key: g.name, className: 'ks-navgroup' }, [
          h('span', { className: 'ks-navgroup-title', key: 't' }, g.name),
          h('div', { className: 'ks-navitems', key: 'i' }, g.items.map((v) => {
            const stageKey = VIEW_STAGE[v.id];
            const ready = stageKey ? !!model[stageKey] : true;
            return h('button', {
              key: v.id, type: 'button', className: cx('ks-navitem', ui.view === v.id && 'ks-navitem-on'),
              onClick: () => setUi({ view: v.id }),
            }, [
              h('span', { className: 'ks-navitem-icon', key: 'e' }, v.emoji),
              h('span', { className: 'ks-navitem-label', key: 'l' }, v.label),
              stageKey ? h('span', { className: cx('ks-navitem-dot', ready && 'ks-navitem-dot-on'), key: 'd' }) : null,
            ]);
          })),
        ]))),
        h('main', { className: 'ks-main', key: 'm' }, [
          ui.error ? h('div', { className: 'ks-errorbar', key: 'e' }, ui.error) : null,
          h(View, { key: ui.view }),
        ]),
      ]),
    ]);
  }

  return {
    Component,
    unmount() {
      cancelled = true;
      clearTimeout(saveTimer);
      clearInterval(clockTimer);
      listeners.clear();
      try { if (typeof unregisterAgent === 'function') unregisterAgent(); } catch (e) { /* ya desregistrado */ }
      try { if (typeof offConfig === 'function') offConfig(); } catch (e) { /* opcional */ }
      try { if (typeof offSerialize === 'function') offSerialize(); } catch (e) { /* opcional */ }
      try { if (typeof offLoad === 'function') offLoad(); } catch (e) { /* opcional */ }
    },
  };
}
