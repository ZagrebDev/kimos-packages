
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
