
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
