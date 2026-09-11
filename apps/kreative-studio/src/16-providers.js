
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
