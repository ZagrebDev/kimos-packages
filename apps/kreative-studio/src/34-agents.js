
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
    id: 'creative-director', n: 1, name: 'Creative Director', emoji: '🎯',
    description: 'Analiza el producto, extrae atributos, ventajas y emociones, y define storytelling, estilo visual, narrativa y concepto creativo.',
    needs: ['brief'], writes: 'concept', requires: [],
    run: (c) => buildConcept(c),
  },
  {
    id: 'research', n: 2, name: 'Research Agent', emoji: '🔍',
    description: 'Investiga mercado, competencia, tendencias, público objetivo, nicho y el estilo visual dominante de la categoría.',
    needs: ['brief'], writes: 'research', requires: [],
    run: (c) => buildResearch(c),
  },
  {
    id: 'planner', n: 3, name: 'Campaign Planner', emoji: '🗺️',
    description: 'Define objetivo y funnel completo (notoriedad, consideración, conversión y remarketing) con canales, presupuesto, calendario y KPIs.',
    needs: ['research'], writes: 'plan', requires: ['research'],
    run: (c) => buildPlan(c),
  },
  {
    id: 'storyboard', n: 4, name: 'Storyboard Generator', emoji: '🎞️',
    description: 'Genera escenas con duración, cámara, ángulo, óptica, movimiento, iluminación, etalonaje, efectos y ritmo, por cada formato y variante.',
    needs: ['concept'], writes: 'storyboard', requires: ['concept'],
    run: (c) => buildStoryboard(c),
  },
  {
    id: 'prompt-engineer', n: 5, name: 'Prompt Engineer', emoji: '✍️',
    description: 'Traduce cada escena a prompts optimizados para el proveedor configurado (OpenAI, Midjourney, FLUX, SD, ComfyUI, Runway, Kling, Veo, Sora, Higgsfield).',
    needs: ['storyboard'], writes: 'prompts', requires: ['storyboard'],
    run: (c) => buildPrompts(c),
  },
  {
    id: 'voice-director', n: 6, name: 'Voice Director', emoji: '🎙️',
    description: 'Escribe la locución ajustada al metraje y genera los briefs de música, ambiente y efectos para ElevenLabs, OpenAI Audio, Suno o Udio.',
    needs: ['storyboard', 'concept'], writes: 'audio', requires: ['storyboard'],
    run: (c) => buildAudio(c),
  },
  {
    id: 'video-producer', n: 7, name: 'Video Producer', emoji: '🎬',
    description: 'Convierte prompts en trabajos de producción ejecutables: keyframes, tomas encadenadas cuando la escena excede el modelo, audio y coste estimado.',
    needs: ['prompts', 'audio'], writes: 'production', requires: ['prompts'],
    run: (c) => buildProduction(c),
  },
  {
    id: 'video-editor', n: 8, name: 'Video Editor', emoji: '✂️',
    description: 'Construye el timeline, los subtítulos SRT, la lista EDL y el script FFmpeg completo: cortes, color, transiciones, títulos, logo, CTA, mezcla y exportación.',
    needs: ['storyboard', 'audio'], writes: 'edit', requires: ['storyboard'],
    run: (c) => buildEdit(c),
  },
  {
    id: 'copywriter', n: 10, name: 'Copywriter', emoji: '🖊️',
    description: 'Redacta anuncios para Meta, Instagram, TikTok, LinkedIn, YouTube y Google, más landing completa y secuencia de emails, respetando los límites de cada plataforma.',
    needs: ['concept', 'research'], writes: 'copy', requires: ['concept'],
    run: (c) => buildCopy(c),
  },
  {
    id: 'brand-consistency', n: 9, name: 'Brand Consistency', emoji: '🛡️',
    description: 'Audita paleta, tipografía, logotipo, producto, personajes, tono y legibilidad, y devuelve hallazgos accionables con su severidad.',
    needs: ['storyboard', 'copy'], writes: 'brandCheck', requires: ['storyboard'],
    run: (c) => buildBrandCheck(c),
  },
  {
    id: 'analytics', n: 12, name: 'Analytics', emoji: '📊',
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
      deps, disabled: off, blocked,
      status: off ? 'off' : blocked ? 'blocked' : s(obj(stages[id]).status) || 'idle',
      ms: num(obj(stages[id]).ms, 0), error: s(obj(stages[id]).error),
      hasOutput: !!campaign[a ? a.writes : ''],
    };
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
