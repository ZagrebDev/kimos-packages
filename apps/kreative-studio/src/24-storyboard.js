
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
  for (const a of aspects) {
    const isVertical = a === '9:16' || a === '4:5';
    const dur = isVertical ? short : hero;
    formats[a] = {
      aspect: a, durationSec: dur,
      dims: RESOLUTIONS.map((r) => ({ res: r.id, label: r.label, ...dimsFor(a, r.id) })),
      scenes: a === (aspects[0] || '16:9') ? master : buildScenes(c, { durationSec: dur, aspect: a, variant: 0 }),
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

const VARIANT_HYPOTHESES = [
  'El gancho con pregunta directa retiene más que la demostración muda.',
  'Adelantar el money shot al segundo 3 sube el CTR aunque baje el VTR.',
  'Cerrar con oferta explícita convierte más que cerrar con marca.',
  'La versión sin locución rinde mejor en reproducción silenciada.',
  'El testimonio en primera persona supera al narrador en off.',
  'Empezar por el precio filtra tráfico y mejora el CPA.',
  'El plano de detalle como apertura funciona mejor en vertical.',
];
