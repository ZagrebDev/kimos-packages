
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
