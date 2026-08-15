
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
