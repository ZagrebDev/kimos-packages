
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
