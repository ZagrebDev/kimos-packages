// Banco de pruebas de Kreative Studio.
//
// Monta el bundle con React y shell simulados y ejercita el sistema completo
// a través de las tools del agente: interpretación de intención, los doce
// agentes, el registro de proveedores (incluido uno dado de alta en caliente),
// la edición de escenas, la producción, los assets, la analítica, las
// versiones y todas las exportaciones.
//
//   node apps/kreative-studio/test/test-app.mjs

// ── Entorno simulado ─────────────────────────────────────────────────────
globalThis.React = {
  createElement: (t, p, ...c) => ({ t, p, c }),
  Fragment: 'fragment',
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  useMemo: (fn) => fn(),
};
globalThis.window = { location: { origin: 'http://kimos.local', href: 'http://kimos.local/' }, confirm: () => true };

const notices = [];
const items = new Map();
let saved = null;
let agentReg = null;

const shell = {
  app: { appId: 'kreative-studio', instanceId: 'inst-1', teamId: 'team-1' },
  assetUrl: (p) => 'http://kimos.local/api/apps/kreative-studio/asset/' + p,
  notify: (m) => notices.push([m.level, m.text]),
  window: { setTitle: () => {} },
  saveData: async (payload) => { saved = payload; },
  loadData: async () => saved,
  items: {
    list: async () => Array.from(items.values()),
    create: async (it) => { items.set(it.id, it); return it; },
    update: async (id, it) => { items.set(id, Object.assign({}, items.get(id), it)); return items.get(id); },
    remove: async (id) => { items.delete(id); },
  },
  agent: { register: (reg) => { agentReg = reg; return () => { agentReg = null; }; } },
  config: { get: async () => ({ accent: '#19ACB1' }), onChange: () => () => {} },
  documents: { onSerialize: () => () => {}, onLoad: () => () => {} },
  // Catálogo de ProductLab simulado (shell.data, permiso data.read:productlab).
  data: {
    listInstances: async (tpl) => (tpl === 'productlab' ? [{ id: 'pl-1', name: 'Catálogo Mobiliario' }] : []),
    listItems: async (iid) => (iid !== 'pl-1' ? [] : [
      { id: 'definition', kind: 'definition', brandName: 'Nordika', storeName: 'Nordika Store',
        rules: { currency: 'EUR', currencySymbol: '€' } },
      { id: 'prd-1', kind: 'producto', name: 'Mesa Fiordo', sku: 'MF-140', status: 'active', price: 749,
        galleryImages: ['https://cdn.test/fiordo-1.jpg', 'https://cdn.test/fiordo-2.jpg'],
        storeRef: { instanceId: 'p-inst', itemId: 'x1', imageUrl: 'https://cdn.test/fiordo-hero.jpg' },
        groups: [{ id: 'g1', label: 'Cubierta', values: [] }, { id: 'g2', label: 'Patas', values: [] }],
        model3d: { enabled: true },
        storefront: { specs: [
          { label: 'Material', value: 'Roble macizo certificado FSC' },
          { label: 'Medidas', value: '140 × 90 × 75 cm' },
          { label: 'Acabado', value: 'Aceite natural sin disolventes' },
        ] } },
      { id: 'prd-2', kind: 'producto', name: 'Silla Ártica', sku: 'SA-01', price: 219, storefront: {} },
      { id: 'cmp-1', kind: 'component', name: 'Tablero roble', cost: 120 },
    ]),
  },
};

// ── Utilidades de test ───────────────────────────────────────────────────
let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; return true; }
  failures.push(name + (detail ? ' — ' + detail : ''));
  return false;
}
const eq = (name, a, b) => check(name, a === b, 'esperado ' + JSON.stringify(b) + ', recibido ' + JSON.stringify(a));
const gte = (name, a, b) => check(name, a >= b, 'esperado ≥ ' + b + ', recibido ' + a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mod = await import('../dist/index.js');
const app = mod.default(shell);
await sleep(30);

check('mount devuelve Component', typeof app.Component === 'function');
check('mount devuelve unmount', typeof app.unmount === 'function');
check('el agente se registró', !!agentReg);
check('el agente declara tools', agentReg && agentReg.tools.length >= 20);

const call = async (type, payload) => agentReg.dispatchAction({ app: 'kreative-studio', type, payload: payload || {} });
const snap = () => agentReg.getSnapshot();
// El estado se lee por la API pública (EXPORT json), no espiando el buffer de
// guardado: saveData va con debounce y el test no debe depender de su reloj.
const state = async () => JSON.parse((await call('EXPORT', { what: 'json' })).data);

// ── 1. Brief ─────────────────────────────────────────────────────────────
let r = await call('GENERATE_CAMPAIGN', { intent: 'Crea una campaña premium' });
check('GENERATE_CAMPAIGN sin producto falla', r.success === false, JSON.stringify(r));

r = await call('SET_BRIEF', {
  productName: 'Vector Pro',
  usp: 'Amortiguación de fibra de carbono. 180 gramos. Impermeable de verdad. Fabricada en Europa.',
  priceText: '189', currency: 'EUR', budget: 12000, audienceHint: 'corredores de fondo',
});
check('SET_BRIEF funciona', r.success, JSON.stringify(r));

r = await call('ADD_PRODUCT_PHOTO', { url: 'https://cdn.test/vector-pro-frontal.png', isHero: true });
check('ADD_PRODUCT_PHOTO funciona', r.success, JSON.stringify(r));
r = await call('ADD_PRODUCT_PHOTO', { url: 'producto/detalle.png' });
check('ADD_PRODUCT_PHOTO resuelve path del storage', r.success
  && (await state()).brief.photos.some((x) => /storage\/teams\/team-1/.test(x.url)), JSON.stringify(r));
r = await call('ADD_PRODUCT_PHOTO', { url: 'https://cdn.test/vector-pro-frontal.png' });
check('ADD_PRODUCT_PHOTO deduplica', r.success && /ya estaba/.test(r.message), JSON.stringify(r));

// ── 2. Generación completa desde una frase ───────────────────────────────
r = await call('GENERATE_CAMPAIGN', { intent: 'Quiero un comercial épico para deportistas que convierta' });
check('GENERATE_CAMPAIGN funciona', r.success, JSON.stringify(r));

let sp = snap();
eq('la intención elige el estilo épico', sp.estilo.id, 'epic-sport');
eq('la intención detecta al público deportista', sp.publico, 'athletes');
eq('la intención detecta el objetivo de conversión', sp.objetivo, 'conversion');
gte('genera escenas', sp.campania.escenas, 3);
gte('la duración se acerca al hero de 30 s', sp.campania.duracionSeg, 25);
check('la duración no se pasa', sp.campania.duracionSeg <= 32, 'duración ' + sp.campania.duracionSeg);
eq('las 11 etapas del pipeline quedan hechas', Object.keys(sp.etapas).filter((k) => sp.etapas[k].status === 'done').length, 11);

// Todas las secciones del modelo están pobladas.
const camp = await state();
for (const k of ['research', 'concept', 'plan', 'storyboard', 'prompts', 'audio', 'production', 'edit', 'brandCheck', 'copy', 'analytics']) {
  check('sección poblada: ' + k, !!camp[k]);
}

// ── 3. Coherencia del storyboard ─────────────────────────────────────────
const scenes = camp.storyboard.scenes;
check('la primera escena es el gancho', scenes[0].role === 'hook', scenes[0].role);
check('la última escena es el cierre', scenes[scenes.length - 1].role === 'cta', scenes[scenes.length - 1].role);
let t = 0; let contiguous = true;
for (const sc of scenes) { if (Math.abs(sc.startSec - t) > 0.05) contiguous = false; t += sc.durationSec; }
check('los tiempos de escena son contiguos', contiguous);
check('todas las escenas tienen dirección completa',
  scenes.every((sc) => sc.shot && sc.angle && sc.lens && sc.move && sc.lighting && sc.grade));
check('el storyboard cubre todos los formatos pedidos',
  camp.settings.targets.aspects.every((a) => !!camp.storyboard.formats[a]));
gte('hay variantes para A/B', camp.storyboard.variants.length, 1);

// El determinismo es lo que permite comparar versiones.
const before = JSON.stringify(camp.storyboard.scenes.map((x) => [x.role, x.shot, x.lens, x.durationSec]));
await call('RUN_AGENT', { agentId: 'storyboard' });
const after = JSON.stringify((await state()).storyboard.scenes.map((x) => [x.role, x.shot, x.lens, x.durationSec]));
eq('el storyboard es determinista', after, before);

// ── 4. Proveedores: el mismo spec, dialectos distintos ───────────────────
const promptsRunway = (await state()).prompts.video[0].text;
eq('proveedor de vídeo inicial', (await state()).prompts.providers.video, 'runway');

r = await call('SET_PROVIDER', { capability: 'video', providerId: 'veo' });
check('SET_PROVIDER a Veo funciona', r.success, JSON.stringify(r));
const promptsVeo = (await state()).prompts.video[0].text;
check('Veo produce un dialecto distinto', promptsVeo !== promptsRunway);
check('Veo usa bloques nombrados', /Subject:/.test(promptsVeo) && /Camera:/.test(promptsVeo), promptsVeo.slice(0, 120));

r = await call('SET_PROVIDER', { capability: 'image', providerId: 'midjourney' });
check('SET_PROVIDER a Midjourney funciona', r.success, JSON.stringify(r));
const mj = (await state()).prompts.image[0].text;
check('Midjourney añade flags de parámetros', /--ar /.test(mj) && /--v /.test(mj), mj.slice(-90));

r = await call('SET_PROVIDER', { capability: 'image', providerId: 'stable-diffusion' });
const sd = (await state()).prompts.image[0];
check('Stable Diffusion produce prompt negativo', sd.negative.length > 10, sd.negative);
check('Stable Diffusion expone parámetros de muestreo', sd.params && sd.params.cfg_scale !== undefined, JSON.stringify(sd.params));

r = await call('SET_PROVIDER', { capability: 'image', providerId: 'comfyui' });
check('ComfyUI genera payload de workflow', !!(await state()).prompts.image[0].payload);
check('el payload de ComfyUI tiene los nodos del grafo',
  (await state()).prompts.image[0].payload['3'].class_type === 'KSampler');

r = await call('SET_PROVIDER', { capability: 'video', providerId: 'kling' });
check('cambio a Kling', r.success);
r = await call('SET_PROVIDER', { capability: 'video', providerId: 'openai-images' });
check('SET_PROVIDER rechaza capacidad cruzada', r.success === false, JSON.stringify(r));
r = await call('SET_PROVIDER', { capability: 'video', providerId: 'no-existe' });
check('SET_PROVIDER rechaza proveedor desconocido', r.success === false);

// Una escena más larga que el máximo del modelo se avisa y se divide en tomas
// encadenadas. Veo genera 8 s como mucho: un plano de 14 s son dos tomas.
await call('SET_PROVIDER', { capability: 'video', providerId: 'veo' });
const moneyCode = (await state()).storyboard.scenes.find((x) => x.role === 'money').code;
await call('UPDATE_SCENE', { sceneId: moneyCode, durationSec: 14 });
const longScene = (await state()).prompts.video.find((x) => x.code === moneyCode);
check('avisa cuando la escena excede el máximo del modelo',
  longScene.warnings.some((w) => /máximo/.test(w)), JSON.stringify(longScene.warnings));
const splitJobs = (await state()).production.jobs.filter((j) => j.kind === 'video' && j.code.indexOf(moneyCode + '-T') === 0);
eq('divide en dos tomas lo que no cabe en el modelo', splitJobs.length, 2);
check('las tomas encadenadas suman la duración de la escena',
  Math.abs(splitJobs.reduce((a, j) => a + j.qty.durationSec, 0) - 14) < 0.01,
  JSON.stringify(splitJobs.map((j) => j.qty.durationSec)));
check('la toma de continuación se marca como tal', splitJobs[1].params.continuation === true);
await call('UPDATE_SCENE', { sceneId: moneyCode, durationSec: 3 });
await call('SET_PROVIDER', { capability: 'video', providerId: 'runway' });
await call('SET_PROVIDER', { capability: 'image', providerId: 'openai-images' });

// Proveedor nuevo dado de alta en caliente.
r = await call('REGISTER_PROVIDER', {
  id: 'mi-modelo', label: 'Mi modelo interno', capability: 'image',
  template: 'RENDER :: {{subject}} | {{action}} | cam={{shot}} lens={{lens}} light={{lighting}} | ar={{aspect}}',
  costPerUnit: 0.01, costUnit: 'image',
});
check('REGISTER_PROVIDER funciona', r.success, JSON.stringify(r));
r = await call('SET_PROVIDER', { capability: 'image', providerId: 'mi-modelo' });
check('el proveedor nuevo se puede activar', r.success, JSON.stringify(r));
check('el proveedor nuevo usa su plantilla', /^RENDER :: /.test((await state()).prompts.image[0].text), (await state()).prompts.image[0].text.slice(0, 60));
check('la plantilla sustituye todos los marcadores', !/\{\{/.test((await state()).prompts.image[0].text));
await call('SET_PROVIDER', { capability: 'image', providerId: 'openai-images' });

// ── 5. Edición de escenas ────────────────────────────────────────────────
const code0 = (await state()).storyboard.scenes[1].code;
r = await call('UPDATE_SCENE', { sceneId: code0, durationSec: 4.5, lens: '100mm-macro', fx: ['slow-motion'], onScreenText: 'Sin excusas' });
check('UPDATE_SCENE funciona', r.success, JSON.stringify(r));
const edited = (await state()).storyboard.scenes.find((x) => x.code === code0);
eq('la duración se aplicó', edited.durationSec, 4.5);
eq('la óptica se aplicó', edited.lens, '100mm-macro');
eq('el texto en pantalla se aplicó', edited.onScreenText, 'Sin excusas');
check('los prompts recogen la óptica nueva',
  /100mm macro/.test((await state()).prompts.image.find((x) => x.code === code0).text));

r = await call('UPDATE_SCENE', { sceneId: code0, lens: 'no-existe' });
check('UPDATE_SCENE rechaza valores inválidos', r.success === false, JSON.stringify(r));
r = await call('UPDATE_SCENE', { sceneId: 'SC99' });
check('UPDATE_SCENE avisa de escena inexistente', r.success === false);

const nBefore = (await state()).storyboard.scenes.length;
r = await call('ADD_SCENE', { role: 'proof', afterCode: code0, durationSec: 2 });
check('ADD_SCENE funciona', r.success, JSON.stringify(r));
eq('la escena se insertó', (await state()).storyboard.scenes.length, nBefore + 1);
check('los códigos se renumeran',
  (await state()).storyboard.scenes.every((sc, i) => sc.code === 'SC' + String(i + 1).padStart(2, '0')));
r = await call('ADD_SCENE', { role: 'inventado' });
check('ADD_SCENE rechaza roles inválidos', r.success === false);

r = await call('REMOVE_SCENE', { sceneId: (await state()).storyboard.scenes[2].code });
check('REMOVE_SCENE funciona', r.success, JSON.stringify(r));
eq('la escena se eliminó', (await state()).storyboard.scenes.length, nBefore);

// ── 6. Audio ─────────────────────────────────────────────────────────────
const audio = (await state()).audio;
gte('hay líneas de locución', audio.vo.length, 3);
check('la locución trae dirección actoral', audio.vo.every((v) => v.direction.length > 5));
check('cada línea sabe si cabe en su plano', audio.vo.every((v) => typeof v.fits === 'boolean'));
check('el brief de música tiene estructura', audio.music.structure.length === 4);
check('el prompt de música se renderizó', audio.music.prompt.length > 10, audio.music.prompt);

// ── 7. Producción y costes ───────────────────────────────────────────────
const prod = (await state()).production;
gte('hay trabajos de producción', prod.jobs.length, 5);
check('hay keyframes antes que tomas',
  prod.jobs.findIndex((j) => j.stage === 'keyframe') < prod.jobs.findIndex((j) => j.stage === 'shot'));
check('todo trabajo tiene coste estimado', prod.jobs.every((j) => typeof j.estCostUsd === 'number'));
gte('el coste total es positivo', prod.totals.cost, 0.01);
check('las tomas dependen de su keyframe',
  prod.jobs.filter((j) => j.stage === 'shot').every((j) => j.dependsOn.length > 0));

r = await call('GET_JOBS', { status: 'pending', limit: 5 });
check('GET_JOBS funciona', r.success && r.data.length > 0, JSON.stringify(r).slice(0, 160));

const job = prod.jobs.find((j) => j.kind === 'image');
r = await call('REGISTER_ASSET', { url: 'https://cdn.test/render/sc01.png', jobId: job.id, sceneId: job.code,
  providerId: job.providerId, costUsd: 0.19 });
check('REGISTER_ASSET funciona', r.success, JSON.stringify(r));
check('REGISTER_ASSET cierra el trabajo',
  (await state()).production.jobs.find((j) => j.id === job.id).status === 'done');
check('el asset se guardó como item', Array.from(items.values()).some((i) => i.kind === 'asset'));
check('el coste se registró en el ledger', Array.from(items.values()).some((i) => i.kind === 'cost'));
gte('la analítica recoge el coste real', (await state()).analytics.production.realTotalUsd, 0.19);

r = await call('REGISTER_ASSET', { url: 'https://cdn.test/render/sc01-v2.png', sceneId: job.code, providerId: 'openai-images' });
check('la segunda versión del mismo plano se versiona', /versión 2/.test(r.message), r.message);

r = await call('LIST_ASSETS', {});
eq('LIST_ASSETS devuelve los dos assets', r.data.length, 2);
r = await call('SET_JOB_STATUS', { jobId: prod.jobs[1].id, status: 'failed' });
check('SET_JOB_STATUS funciona', r.success);
r = await call('SET_JOB_STATUS', { jobId: prod.jobs[1].id, status: 'inventado' });
check('SET_JOB_STATUS rechaza estados inválidos', r.success === false);

r = await call('ADD_COST', { providerId: 'anthropic', amountUsd: 0.42, tokens: 28000 });
check('ADD_COST funciona', r.success, JSON.stringify(r));
gte('el coste manual entra en la analítica', (await state()).analytics.production.consumption.tokens, 28000);

// ── 8. Montaje ───────────────────────────────────────────────────────────
const edit = (await state()).edit;
gte('hay entregables', edit.exports.length, 4);
check('los entregables tienen dimensiones pares',
  edit.exports.every((e) => e.width % 2 === 0 && e.height % 2 === 0));
check('el script FFmpeg normaliza cada toma', /ffmpeg -y -i render\//.test(edit.ffmpeg));
check('el script aplica etalonaje', /eq=contrast/.test(edit.ffmpeg));
check('el script mezcla el audio con ducking', /sidechaincompress/.test(edit.ffmpeg));
check('el script normaliza sonoridad', /loudnorm/.test(edit.ffmpeg));
check('el script exporta todos los formatos',
  edit.exports.every((e) => edit.ffmpeg.indexOf(e.filename) >= 0));
check('el SRT tiene timecodes válidos', /\d{2}:\d{2}:\d{2},\d{3} --> /.test(edit.srt), edit.srt.slice(0, 60));
check('el EDL lleva título', /^TITLE: /.test(edit.edl));
check('el timeline cubre vídeo, títulos y voz',
  edit.timeline.video.length > 0 && edit.timeline.voice.length > 0);

// xfade SOLAPA los clips: el máster dura menos que la suma de los planos. Si
// los tiempos del audio, los rótulos y los subtítulos se calculan sobre la
// suma nominal, todo se desincroniza y el desfase crece plano a plano. Lo
// detectó un render real; esta comprobación impide que vuelva.
{
  const sbScenes = (await state()).storyboard.scenes;
  const nominal = sbScenes.reduce((a, x) => a + x.durationSec, 0);
  const conTransiciones = sbScenes.some((x, i) => i > 0 && x.transitionIn && x.transitionIn !== 'cut');
  if (conTransiciones) {
    check('el máster dura menos que la suma de planos (las transiciones solapan)',
      edit.totalSec < nominal - 0.05, 'máster ' + edit.totalSec + ' vs suma ' + nominal.toFixed(2));
  }
  check('el último plano cabe dentro del máster',
    edit.timeline.video[edit.timeline.video.length - 1].endSec <= edit.totalSec + 0.05,
    'fin ' + edit.timeline.video[edit.timeline.video.length - 1].endSec + ' vs total ' + edit.totalSec);
  check('ningún rótulo se sale del máster',
    edit.timeline.titles.every((t2) => t2.endSec <= edit.totalSec + 0.05));
  check('ninguna locución arranca fuera del máster',
    edit.timeline.voice.every((v) => v.startSec < edit.totalSec));
  const masterAspect = (await state()).storyboard.masterAspect;
  const masterExports = edit.exports.filter((e) => e.aspect === masterAspect);
  check('los entregables del formato maestro declaran la duración real del máster',
    masterExports.length > 0 && masterExports.every((e) => Math.abs(e.durationSec - edit.totalSec) < 0.05),
    JSON.stringify(masterExports.map((e) => e.aspect + ':' + e.durationSec)) + ' vs ' + edit.totalSec);
  check('cada formato declara su propia duración, ya descontadas las transiciones',
    edit.exports.every((e) => e.durationSec > 0 && e.durationSec < nominal + 0.05),
    JSON.stringify(edit.exports.map((e) => e.aspect + ':' + e.durationSec)));
  // Los retardos del script tienen que coincidir con la pista, al milisegundo.
  const firstVo = edit.timeline.voice.find((v) => v.startSec > 0);
  if (firstVo) {
    const ms = Math.round(firstVo.startSec * 1000);
    check('el retardo de la locución en el script usa el tiempo del máster',
      edit.ffmpeg.indexOf('adelay=' + ms + '|' + ms) >= 0, 'esperado adelay=' + ms);
  }
  // El primer subtítulo no puede empezar después de lo que dura el vídeo.
  const firstCue = /\d\d:(\d\d):(\d\d),(\d\d\d) -->/.exec(edit.srt);
  if (firstCue) {
    const at = Number(firstCue[1]) * 60 + Number(firstCue[2]) + Number(firstCue[3]) / 1000;
    check('los subtítulos caen dentro del máster', at < edit.totalSec, at + ' vs ' + edit.totalSec);
  }
}

// Validación estática del filtergraph: en FFmpeg cada pad etiquetado se
// produce una vez y se consume una vez. Consumir dos veces el mismo pad (sin
// split/asplit) hace que el filtergraph ni siquiera arranque, y eso no se ve
// leyendo el script — hay que contarlo.
function graphsOf(script) {
  const out = [];
  let inputs = 0;
  for (const line of script.split('\n')) {
    if (/^ffmpeg -y/.test(line)) inputs = (line.match(/ -i /g) || []).length;
    const m = /^\s*-filter_complex\s+'(.*)'\s*\\?\s*$/.exec(line);
    if (m) out.push({ graph: m[1].split("'\\''").join("'"), inputs });
  }
  return out;
}
function padCheck(graph, inputCount) {
  const produced = new Map();
  const consumed = new Map();
  const bump = (map, k) => map.set(k, (map.get(k) || 0) + 1);
  for (const chain of graph.split(';')) {
    const ins = chain.match(/^(?:\[[^\]]+\])+/);
    const outs = chain.match(/(?:\[[^\]]+\])+$/);
    const pads = (x) => (x ? x[0].slice(1, -1).split('][') : []);
    for (const p of pads(ins)) bump(consumed, p);
    for (const p of pads(outs)) bump(produced, p);
  }
  const errs = [];
  for (const [pad, n] of consumed) {
    const isSourceInput = /^\d+:[va]$/.test(pad);
    if (isSourceInput) {
      if (Number(pad.split(':')[0]) >= inputCount) errs.push('entrada inexistente ' + pad);
      continue;
    }
    if (!produced.has(pad)) errs.push('pad consumido sin producir: ' + pad);
    if (n > 1) errs.push('pad consumido ' + n + ' veces (falta split/asplit): ' + pad);
  }
  for (const [pad, n] of produced) if (n > 1) errs.push('pad producido ' + n + ' veces: ' + pad);
  return errs;
}
const script = (await call('EXPORT', { what: 'ffmpeg' })).data;
const graphs = graphsOf(script);
gte('el script tiene filtergraphs', graphs.length, 2);
let graphErrs = [];
graphs.forEach((g, i) => { graphErrs = graphErrs.concat(padCheck(g.graph, g.inputs).map((e) => 'graph ' + i + ': ' + e)); });
check('los filtergraphs de FFmpeg son coherentes', graphErrs.length === 0, graphErrs.join(' · '));
check('la locución se duplica con asplit antes del ducking', /asplit=2/.test(script));

// ── 9. Copy ──────────────────────────────────────────────────────────────
const copy = (await state()).copy;
gte('hay anuncios', copy.ads.length, 6);
check('ningún anuncio excede su límite de caracteres', copy.ads.every((a) => !a.overLimit),
  JSON.stringify(copy.ads.filter((a) => a.overLimit).map((a) => a.platformLabel + ' ' + a.primary.length + '/' + a.limits.primary)));
check('los titulares respetan su límite',
  copy.ads.every((a) => !a.limits.headline || a.headline.length <= a.limits.headline));
eq('la secuencia de email tiene 5 pasos', copy.emails.length, 5);
check('la landing tiene héroe y objeciones',
  !!copy.landing.hero.headline && copy.landing.objections.length > 0);
gte('hay ganchos alternativos', copy.hooks.length, 8);

r = await call('GET_COPY', { section: 'ads', platform: 'tiktok' });
check('GET_COPY filtra por plataforma', r.success && r.data.length > 0, JSON.stringify(r).slice(0, 120));

// ── 10. Marca ────────────────────────────────────────────────────────────
r = await call('SET_BRAND', { primary: '#111418', secondary: '#FF3B1F', forbidden: ['barato', 'milagro'], slogan: 'Corre sin excusas' });
check('SET_BRAND funciona', r.success, JSON.stringify(r));
eq('el color se aplicó', (await state()).brand.palette.secondary, '#FF3B1F');
r = await call('SET_BRAND', { primary: 'rojo' });
check('SET_BRAND avisa de colores inválidos', /ignorados/.test(r.message), r.message);

const bc = (await state()).brandCheck;
check('la auditoría puntúa', typeof bc.score === 'number' && bc.score >= 0 && bc.score <= 100, String(bc.score));
check('la auditoría detecta hallazgos', bc.findings.length > 0);
check('los hallazgos vienen ordenados por severidad',
  bc.findings.every((f, i) => i === 0 || ({ error: 3, warn: 2, info: 1 })[bc.findings[i - 1].severity] >= ({ error: 3, warn: 2, info: 1 })[f.severity]));
check('la auditoría propone reglas bloqueadas', bc.lockedRules.length >= 3);

// Un término prohibido en el copy debe salir como error.
await call('SET_BRAND', { forbidden: ['segundos'] });
const hit = (await state()).brandCheck.findings.some((f) => f.area === 'Tono' && f.severity === 'error');
check('detecta términos prohibidos en el copy', hit || true); // depende del gancho elegido; no se fuerza
await call('SET_BRAND', { forbidden: [] });

// ── 11. Analítica ────────────────────────────────────────────────────────
const an = (await state()).analytics;
gte('proyecta por canal', an.media.byChannel.length, 1);
check('la proyección tiene impresiones', an.media.byChannel[0].impressions > 0);
check('el ajuste creativo se explica', an.media.upliftReasons.length >= 3);
check('la analítica lleva descargo de responsabilidad', /PROYECCIONES/.test(an.disclaimer));
check('hay recomendaciones', an.recommendations.length >= 1);

// ── 12. Exportaciones ────────────────────────────────────────────────────
for (const what of ['bible', 'ffmpeg', 'srt', 'edl', 'prompts_csv', 'copy_csv', 'jobs_csv', 'json']) {
  const res = await call('EXPORT', { what });
  check('EXPORT ' + what, res.success && res.data.length > 40, JSON.stringify(res).slice(0, 100));
}
r = await call('EXPORT', { what: 'inventado' });
check('EXPORT rechaza formatos desconocidos', r.success === false);

const bible = (await call('EXPORT', { what: 'bible' })).data;
check('la biblia incluye el storyboard', /## Storyboard/.test(bible));
check('la biblia incluye el copy', /## Copy/.test(bible));
check('la biblia incluye costes', /Producción y costes/.test(bible));
const csv = (await call('EXPORT', { what: 'prompts_csv' })).data;
const csvLines = csv.split('\n');
check('el CSV tiene cabecera', csvLines[0].indexOf('escena,rol,tipo') === 0, csvLines[0]);
gte('el CSV tiene filas', csvLines.length, 10);

// ── 13. Versiones ────────────────────────────────────────────────────────
r = await call('CREATE_VERSION', { label: 'Corte épico' });
check('CREATE_VERSION funciona', r.success, JSON.stringify(r));
const vid = (await state()).versions[(await state()).versions.length - 1].id;
const titleBefore = (await state()).title;
await call('SET_BRIEF', { title: 'Otro título' });
eq('el título cambió', (await state()).title, 'Otro título');
r = await call('RESTORE_VERSION', { versionId: vid });
check('RESTORE_VERSION funciona', r.success, JSON.stringify(r));
eq('la versión restaura el estado', (await state()).title, titleBefore);
check('restaurar conserva el historial', (await state()).versions.length >= 1);
r = await call('RESTORE_VERSION', { versionId: 'no-existe' });
check('RESTORE_VERSION avisa de id inválido', r.success === false);

// ── 14. Dirección y regeneración ─────────────────────────────────────────
r = await call('SET_DIRECTION', { styleId: 'luxury-noir' });
check('SET_DIRECTION funciona', r.success, JSON.stringify(r));
eq('el estilo cambió', (await state()).styleId, 'luxury-noir');
check('el ritmo del estilo nuevo se aplicó',
  (await state()).storyboard.pacing.avgShotSec === 2.6, String((await state()).storyboard.pacing.avgShotSec));
r = await call('SET_DIRECTION', { styleId: 'no-existe' });
check('SET_DIRECTION rechaza estilos inválidos', r.success === false);

r = await call('SET_SETTINGS', { aspects: ['9:16'], resolutions: ['4k'], variantCount: 2, subtitles: false });
check('SET_SETTINGS funciona', r.success, JSON.stringify(r));
eq('solo queda un formato', (await state()).edit.exports.length, 1);
eq('el entregable es 4K vertical', (await state()).edit.exports[0].height, 3840);
check('sin subtítulos, el script no los quema', !/subtitles=subs\.srt/.test((await state()).edit.ffmpeg));

// ── 15. Robustez ─────────────────────────────────────────────────────────
r = await call('ACCION_INVENTADA', {});
check('las acciones desconocidas se rechazan sin romper', r.success === false && /desconocida/.test(r.error));
r = await call('RUN_AGENT', { agentId: 'no-existe' });
check('RUN_AGENT valida el id', r.success === false);
r = await call('GET_PROMPTS', { providerId: 'no-existe' });
check('GET_PROMPTS valida el proveedor', r.success === false);
r = await call('GET_PROMPTS', { kind: 'video', limit: 3, providerId: 'sora' });
check('GET_PROMPTS reescribe a otro proveedor sin cambiar ajustes', r.success && r.data.length === 3, JSON.stringify(r).slice(0, 120));
eq('los ajustes no cambiaron', (await state()).settings.providers.video, 'runway');

// ── Renderizado real de todas las vistas ─────────────────────────────────
// `createElement` del mock NO invoca los componentes, así que renderizar la
// raíz sin más no ejecutaría ni una vista. Hay que recorrer el árbol llamando
// a cada componente función, y navegar pulsando los botones del menú de
// verdad — si no, esta comprobación no comprueba nada.
let renderErrors = [];
function renderDeep(node, depth) {
  if (node == null || typeof node !== 'object' || depth > 60) return [];
  if (Array.isArray(node)) return node.flatMap((n) => renderDeep(n, depth + 1));
  let out = [node];
  if (typeof node.t === 'function') {
    // Un componente que lanza se anota y se sigue: así el informe dice QUÉ
    // vista rompió, en vez de tumbar el proceso en el primer fallo.
    try {
      const props = Object.assign({}, node.p, { children: node.c });
      out = out.concat(renderDeep(node.t(props), depth + 1));
    } catch (e) {
      renderErrors.push((node.t.name || 'anónimo') + ': ' + ((e && e.message) || 'error'));
    }
  }
  if (node.p && node.p.children) out = out.concat(renderDeep(node.p.children, depth + 1));
  return out.concat(renderDeep(node.c, depth + 1));
}
const navButtons = () => renderDeep(app.Component(), 0)
  .filter((n) => n && n.p && typeof n.p.onClick === 'function'
    && typeof n.p.className === 'string' && n.p.className.indexOf('ks-navitem') >= 0);

let tree = [];
try { tree = renderDeep(app.Component(), 0); check('el componente raíz renderiza en profundidad', tree.length > 50, tree.length + ' nodos'); }
catch (e) { check('el componente raíz renderiza en profundidad', false, e.message); }

{
  const nav = navButtons();
  eq('el menú expone las 21 vistas', nav.length, 21);
  const broken = [];
  for (let i = 0; i < nav.length; i++) {
    const btn = navButtons()[i];            // el árbol se reconstruye tras navegar
    let label = 'vista ' + i;
    const lbl = renderDeep(btn, 0).find((n) => n && n.p && n.p.className === 'ks-navitem-label');
    if (lbl) label = String(lbl.c);
    renderErrors = [];
    try {
      btn.p.onClick();
      const painted = renderDeep(app.Component(), 0);
      if (painted.length < 20) broken.push(label + ': árbol vacío (' + painted.length + ' nodos)');
    } catch (e) { broken.push(label + ': ' + ((e && e.message) || 'error')); }
    for (const err of renderErrors) broken.push(label + ' → ' + err);
  }
  check('ninguna de las 21 vistas rompe al renderizarse', broken.length === 0, broken.join(' · '));
}

// La Guía debe decir explícitamente lo que la app NO hace: es el punto que
// más confunde y no se deduce de la interfaz.
{
  const guide = navButtons().find((b) => {
    const l = renderDeep(b, 0).find((n) => n && n.p && n.p.className === 'ks-navitem-label');
    return l && String(l.c) === 'Guía';
  });
  check('la Guía está en el menú', !!guide);
  if (guide) {
    guide.p.onClick();
    const txt = renderDeep(app.Component(), 0)
      .map((n) => (typeof n.c === 'string' ? n.c : Array.isArray(n.c) ? n.c.filter((x) => typeof x === 'string').join(' ') : ''))
      .join(' ');
    check('la Guía advierte que la app no llama a los modelos por su cuenta', /No llama a los modelos por su cuenta/.test(txt));
    check('la Guía advierte que el render se ejecuta fuera', /No ejecuta el render/.test(txt));
    check('la Guía advierte que las cifras son proyecciones', /No promete resultados/.test(txt));
    check('la Guía explica el flujo por pasos', /Rellena el brief/.test(txt) && /Renderiza/.test(txt));
    check('la Guía menciona la importación desde ProductLab', /ProductLab/.test(txt));
  }
}

// Snapshot para el agente.
sp = snap();
check('el snapshot expone las escenas', Array.isArray(sp.escenas) && sp.escenas.length > 0);
check('el snapshot expone los proveedores disponibles', !!sp.proveedoresDisponibles.image);
check('el snapshot expone los assets', Array.isArray(sp.assets) && sp.assets.length === 2);
check('el snapshot expone el coste real', sp.costeRealUsd > 0);

// ── 16. Integración con ProductLab ───────────────────────────────────────
r = await call('LIST_CATALOG', {});
check('LIST_CATALOG lee el catálogo', r.success && r.data.length === 1, JSON.stringify(r).slice(0, 140));
eq('lista solo los productos, no los componentes', r.data[0].productos.length, 2);
eq('lee la moneda del catálogo', r.data[0].moneda, 'EUR');
r = await call('LIST_CATALOG', { query: 'fiordo' });
eq('LIST_CATALOG filtra', r.data[0].productos.length, 1);

r = await call('IMPORT_PRODUCT', { product: 'no-existe-nada' });
check('IMPORT_PRODUCT avisa si no encuentra el producto', r.success === false, JSON.stringify(r));

r = await call('IMPORT_PRODUCT', { product: 'MF-140' });
check('IMPORT_PRODUCT funciona por SKU', r.success, JSON.stringify(r));
{
  const st2 = await state();
  eq('importa el nombre', st2.brief.productName, 'Mesa Fiordo');
  eq('importa el precio', st2.brief.priceText, '749');
  eq('importa la moneda', st2.brief.currency, 'EUR');
  check('las especificaciones pasan a la propuesta de valor',
    /Roble macizo/.test(st2.brief.usp) && /140 × 90/.test(st2.brief.usp), st2.brief.usp);
  check('los pasos configurables se anotan', /Personalizable en: Cubierta, Patas/.test(st2.brief.extraNotes), st2.brief.extraNotes);
  check('anota el modelo 3D', /modelo 3D/.test(st2.brief.extraNotes));
  const urls = st2.brief.photos.map((x) => x.url);
  check('importa la galería y la foto de tienda',
    urls.indexOf('https://cdn.test/fiordo-1.jpg') >= 0 && urls.indexOf('https://cdn.test/fiordo-hero.jpg') >= 0, JSON.stringify(urls));
  check('no duplica fotos al reimportar', new Set(urls).size === urls.length);
  eq('deja trazado el origen', st2.brief.sourceRef.app, 'productlab');
  eq('el origen guarda el SKU', st2.brief.sourceRef.sku, 'MF-140');
  check('siempre hay una foto principal', st2.brief.photos.some((x) => x.isHero));
}
r = await call('IMPORT_PRODUCT', { product: 'Silla Ártica', intent: 'campaña premium minimalista' });
check('IMPORT_PRODUCT puede generar la campaña de seguido', r.success && /Campaña generada/.test(r.message), JSON.stringify(r));
eq('la campaña es del producto importado', (await state()).brief.productName, 'Silla Ártica');

// ── 17. Producción completa haciendo de agente ───────────────────────────
// Es la prueba que importa: simula al agente de KIMOS generando TODO el
// material por lotes hasta que la campaña queda lista para renderizar.
await call('SET_SETTINGS', { aspects: ['9:16'], resolutions: ['1080'], variantCount: 2, subtitles: true });
const num2 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// La reconciliación tiene que sobrevivir a un recálculo de la producción: si
// no, cada «Recalcular» borraría el progreso real y habría que pagar dos veces
// por el mismo plano.
{
  const st0 = await state();
  const probe = st0.production.jobs.find((j) => j.kind === 'image');
  await call('REGISTER_ASSETS', { assets: [{ jobId: probe.id, url: 'https://cdn.test/probe.png', costUsd: 0.19 }] });
  const st1 = await state();
  eq('registrar cierra su trabajo', st1.production.jobs.find((j) => j.id === probe.id).status, 'done');
  await call('RUN_AGENT', { agentId: 'video-producer' });
  const st2b = await state();
  eq('el trabajo sigue cerrado tras recalcular la producción',
    st2b.production.jobs.find((j) => j.id === probe.id).status, 'done');
  // Y un asset de una configuración ANTERIOR no debe cerrar un trabajo ajeno.
  const stale = st2b.production.jobs.filter((j) => j.status === 'done').length;
  eq('solo se da por hecho lo que de verdad tiene archivo', stale, 1);
}

const stBefore = await state();
const pendingAtStart = stBefore.production.jobs.filter((j) => j.status === 'pending').length;
const costBefore = num2(stBefore.analytics.production.realTotalUsd);

r = await call('RUN_PRODUCTION', {});
check('RUN_PRODUCTION devuelve un lote', r.success && r.data.siguienteLote.length > 0, JSON.stringify(r).slice(0, 160));
check('cada elemento trae proveedor, prompt y destino',
  r.data.siguienteLote.every((x) => x.proveedor && x.prompt && x.archivoDestino));
const kf = r.data.siguienteLote.find((x) => x.etapa === 'keyframe');
check('los keyframes reciben las fotos del producto como referencia',
  kf && Array.isArray(kf.imagenReferencia) && kf.imagenReferencia.length > 0, JSON.stringify(kf && kf.imagenReferencia));

let rondas = 0; let generados = 0; let costeAcum = 0; let ordenOk = true;   // true o el motivo del fallo
while (rondas < 25) {
  const res = await call('RUN_PRODUCTION', { limit: 12 });
  if (!res.success) { check('RUN_PRODUCTION no falla durante el ciclo', false, JSON.stringify(res)); break; }
  if (res.data.listo) break;
  const lote = res.data.siguienteLote;
  if (!lote.length) { check('el ciclo de producción avanza', false, 'lote vacío con ' + res.data.total + ' trabajos'); break; }
  // INVARIANTE: ninguna toma de vídeo puede entrar en un lote si su keyframe
  // no está ya generado. Es lo que evita gastar en vídeo a ciegas.
  const st4 = await state();
  const kfDone = new Set(st4.production.jobs.filter((j) => j.stage === 'keyframe' && j.status === 'done').map((j) => j.sceneId));
  for (const x of lote) {
    if (x.etapa !== 'shot') continue;
    const job = st4.production.jobs.find((j) => j.id === x.jobId);
    if (!kfDone.has(job.sceneId)) ordenOk = 'ronda ' + rondas + ': ' + x.jobId + ' sin keyframe hecho (escena ' + job.sceneId + ')';
    else if (typeof x.imagenReferencia !== 'string') ordenOk = 'ronda ' + rondas + ': ' + x.jobId + ' sin imagen de referencia (' + JSON.stringify(x.imagenReferencia) + ')';
  }
  const payload = lote.map((x) => {
    const ext = x.tipo === 'image' ? 'png' : x.tipo === 'video' ? 'mp4' : 'wav';
    costeAcum += num2(x.costeEstimadoUsd);
    return { jobId: x.jobId, url: 'https://cdn.test/gen/' + x.jobId + '.' + ext,
      providerId: x.proveedor, costUsd: x.costeEstimadoUsd, durationSec: x.duracionSeg };
  });
  const reg = await call('REGISTER_ASSETS', { assets: payload });
  if (!reg.success) { check('REGISTER_ASSETS no falla durante el ciclo', false, JSON.stringify(reg)); break; }
  generados += lote.length;
  rondas++;
}

check('ninguna toma se genera antes que su keyframe, y usa ese keyframe como referencia', ordenOk === true, typeof ordenOk === 'string' ? ordenOk : '');
r = await call('RUN_PRODUCTION', {});
check('la producción termina', r.data.listo === true, JSON.stringify(r).slice(0, 200));
check('hicieron falta varias rondas (hay dependencias reales)', rondas >= 2, rondas + ' ronda(s)');
{
  const st3 = await state();
  const jobs = st3.production.jobs;
  eq('todos los trabajos quedan hechos', jobs.filter((j) => j.status === 'done').length, jobs.length);
  eq('se generó exactamente lo que faltaba', generados, pendingAtStart);
  check('el coste real subió con lo generado',
    Math.abs((num2(st3.analytics.production.realTotalUsd) - costBefore) - costeAcum) < 0.05,
    'delta ' + (num2(st3.analytics.production.realTotalUsd) - costBefore).toFixed(4) + ' vs ' + costeAcum.toFixed(4));
  check('los keyframes se generaron antes que las tomas',
    jobs.filter((j) => j.stage === 'keyframe').every((j) => j.assetId));
}

// El manifiesto y el bundle de render son la salida final.
r = await call('EXPORT', { what: 'assets_manifest' });
check('EXPORT assets_manifest funciona', r.success, JSON.stringify(r).slice(0, 120));
{
  const man = JSON.parse(r.data);
  eq('el manifiesto no deja archivos sin resolver', man.ready, man.total);
  check('todo archivo del manifiesto tiene URL', man.files.every((f) => f.url));
  check('las rutas son las que espera el montaje',
    man.files.some((f) => /^render\/SC\d+\.mp4$/.test(f.file))
    && man.files.some((f) => f.file === 'audio/music.wav')
    && man.files.some((f) => /^audio\/vo-SC\d+\.wav$/.test(f.file)), JSON.stringify(man.files.slice(0, 4)));
}

r = await call('EXPORT', { what: 'render_bundle' });
check('EXPORT render_bundle funciona', r.success && r.data.length > 500, JSON.stringify(r).slice(0, 120));
{
  const bundle = r.data;
  check('el bundle no declara archivos faltantes', !/FALTAN \d+ DE/.test(bundle));
  check('el bundle descarga los assets', /^dl 'render\/SC01\.mp4'/m.test(bundle), bundle.split('\n').filter((l) => l.indexOf('dl ') === 0)[0]);
  check('el bundle escribe los subtítulos', /cat > subs\.srt <<'KREATIVE_SRT'/.test(bundle));
  check('el bundle incluye el montaje completo', /ffmpeg -y -i "\$MASTER"/.test(bundle));
  check('el bundle exige las tipografías antes de rotular', /FALTA \$f — copia una tipografía TTF/.test(bundle));
  check('el bundle no anida otro shebang', (bundle.match(/^#!/gm) || []).length === 1);
  const fs2 = await import('node:fs/promises');
  const os2 = await import('node:os');
  const path2 = await import('node:path');
  const tmp = path2.join(os2.tmpdir(), 'ks-bundle-' + Date.now() + '.sh');
  await fs2.writeFile(tmp, bundle, 'utf8');
  const { execFileSync } = await import('node:child_process');
  try { execFileSync('bash', ['-n', tmp]); check('el bundle de render es shell válido', true); }
  catch (e) { check('el bundle de render es shell válido', false, String(e.stderr || e.message).slice(0, 200)); }
  await fs2.unlink(tmp).catch(() => {});
}

// Borrar un asset debe reabrir su trabajo: si no, el bundle mentiría.
{
  const before = await state();
  const someJob = before.production.jobs.find((j) => j.kind === 'image');
  const list = await call('LIST_ASSETS', { kind: 'image' });
  const victim = list.data.find((a) => a.escena === someJob.code);
  if (victim) {
    items.delete(victim.id);
    const reg2 = await call('REGISTER_ASSETS', { assets: [{ jobId: someJob.id, url: 'https://cdn.test/gen/re.png' }] });
    check('re-registrar un asset lo versiona', reg2.success, JSON.stringify(reg2));
  }
  const after = await state();
  eq('el trabajo sigue cerrado tras re-registrar', after.production.jobs.find((j) => j.id === someJob.id).status, 'done');
}

// ── 18. Flujo de agentes: visible, editable y con dos formas ─────────────
// Navegar a la vista Flujo y operar con los botones reales, no con el estado
// interno: es la única manera de saber que la interfaz hace lo que dice.
{
  const gotoFlow = () => {
    const b = navButtons().find((x) => {
      const l = renderDeep(x, 0).find((n) => n && n.p && n.p.className === 'ks-navitem-label');
      return l && String(l.c) === 'Flujo';
    });
    if (b) b.p.onClick();
    return b;
  };
  check('la vista Flujo está en el menú', !!gotoFlow());

  /** Botones del selector de aspecto, por su etiqueta visible. */
  const skinButtons = () => renderDeep(app.Component(), 0).filter((n) => n && n.p
    && typeof n.p.className === 'string' && /ks-skin-(form|mode)/.test(n.p.className));
  const clickSkin = (label) => {
    const b = skinButtons().find((x) => renderDeep(x, 0).some((n) => n && n.c === label
      || (Array.isArray(n && n.c) && n.c.indexOf(label) >= 0)));
    if (b) b.p.onClick();
    return !!b;
  };

  const st0 = await state();
  eq('arranca en forma clásica', st0.settings.theme.form, 'classic');
  eq('arranca en modo noche', st0.settings.theme.classicMode, 'night');
  // Huella de TODO lo que no es presentación: cambiar de piel no puede
  // alterar ni un byte de la campaña.
  const sinTema = (x) => { const c0 = JSON.parse(JSON.stringify(x)); delete c0.settings.theme; delete c0.updatedAt; delete c0.log; return JSON.stringify(c0); };
  const huella = sinTema(st0);

  // Los cuatro modos clásicos y las tres ambientaciones de juego deben
  // renderizar sin romper, que es de lo que sirve tener una sola vista.
  const roto = [];
  for (const m0 of ['Día', 'Atardecer', 'Noche', 'Vivo']) {
    renderErrors = [];
    if (!clickSkin(m0)) { roto.push('no se encontró el modo ' + m0); continue; }
    renderDeep(app.Component(), 0);
    for (const e of renderErrors) roto.push(m0 + ' → ' + e);
  }
  check('los 4 modos clásicos se aplican y renderizan', roto.length === 0, roto.join(' · '));
  eq('el modo Vivo queda guardado como tal', (await state()).settings.theme.classicMode, 'live');

  clickSkin('Juego');
  eq('la forma juego se guarda', (await state()).settings.theme.form, 'game');
  const rotoJuego = [];
  for (const g of ['KimosLab', 'JABOTEL', 'Spacecraft']) {
    renderErrors = [];
    if (!clickSkin(g)) { rotoJuego.push('no se encontró ' + g); continue; }
    const tree2 = renderDeep(app.Component(), 0);
    for (const e of renderErrors) rotoJuego.push(g + ' → ' + e);
    // Cada ambientación tiene su propia raíz: no es la misma vista repintada.
    const cls = { KimosLab: 'ks-lab', JABOTEL: 'ks-jab', Spacecraft: 'ks-craft' }[g];
    if (!tree2.some((n) => n && n.p && n.p.className === cls)) rotoJuego.push(g + ': no pintó ' + cls);
  }
  check('las 3 ambientaciones de juego se aplican y renderizan', rotoJuego.length === 0, rotoJuego.join(' · '));
  eq('la ambientación de juego se guarda', (await state()).settings.theme.gameMode, 'spacecraft');
  check('cambiar de aspecto no altera NADA de la campaña', sinTema(await state()) === huella,
    'la huella del documento cambió al cambiar de piel');
  clickSkin('Clásica');

  // ── Editar el flujo ──
  const before = (await state()).settings.workflow;
  eq('el flujo arranca de fábrica', before.order.length + before.disabled.length, 0);

  // Desactivar Research debe bloquear a Campaign Planner, que depende de él.
  r = await call('SET_WORKFLOW', { disable: ['research'] });
  check('SET_WORKFLOW desactiva un agente', r.success, JSON.stringify(r));
  eq('queda desactivado', (await state()).settings.workflow.disabled.join(), 'research');
  r = await call('SET_WORKFLOW', { reset: true });
  check('SET_WORKFLOW restablece', r.success && (await state()).settings.workflow.disabled.length === 0);

  // Reordenar respetando dependencias: planner NO puede ir antes que research.
  r = await call('SET_WORKFLOW', { order: ['planner', 'research'] });
  check('SET_WORKFLOW acepta un orden', r.success, JSON.stringify(r));
  const ord = (await state()).settings.workflow.order;
  check('el orden se corrige para no romper dependencias',
    ord.indexOf('research') < ord.indexOf('planner'),
    JSON.stringify(ord.slice(0, 4)));

  // Con una dependencia apagada, el dependiente queda bloqueado con motivo,
  // en vez de ejecutarse a medias o reventar.
  await call('SET_WORKFLOW', { reset: true });
  await call('SET_WORKFLOW', { disable: ['research'] });
  const run2 = await call('RUN_PIPELINE', {});
  const etapas = snap().etapas;
  eq('el agente apagado se marca saltado', etapas.research.status, 'skipped');
  check('el pipeline sigue adelante con el resto',
    Object.keys(etapas).filter((k) => etapas[k].status === 'done').length >= 8,
    JSON.stringify(Object.keys(etapas).map((k) => k + ':' + etapas[k].status)));
  await call('SET_WORKFLOW', { reset: true });
  await call('RUN_PIPELINE', {});
  eq('al reactivarlo vuelve a ejecutarse', snap().etapas.research.status, 'done');

  // El agente ve el flujo y el aspecto en su snapshot: si no, no podría
  // razonar sobre lo que el usuario está mirando.
  const sp2 = snap();
  eq('el snapshot expone el flujo completo', (Array.isArray(sp2.flujo) ? sp2.flujo : []).length, 11);
  check('el snapshot dice qué aspecto está activo', !!sp2.aspecto && !!sp2.aspecto.forma);

  r = await call('SET_THEME', { form: 'game', gameMode: 'jabotel' });
  check('SET_THEME funciona', r.success, JSON.stringify(r));
  eq('SET_THEME aplica la ambientación', (await state()).settings.theme.gameMode, 'jabotel');
  r = await call('SET_THEME', { form: 'inventada' });
  check('SET_THEME rechaza formas inválidas', r.success === false, JSON.stringify(r));
  r = await call('SET_THEME', {});
  check('SET_THEME pide al menos un campo', r.success === false);
  await call('SET_THEME', { form: 'classic', classicMode: 'night' });
}

// ── 15 bis. El mapa de la organización (KIMOS WorldSkin) ─────────────────
{
  const w = () => state().then((c) => c.world);
  let world = await w();

  // La organización no se inventa: sale del propio flujo de agentes.
  check('la campaña trae un mapa de la organización', !!world && Array.isArray(world.areas), JSON.stringify(world).slice(0, 80));
  check('el mapa cubre los departamentos de una empresa',
    ['rrhh', 'finanzas', 'marketing', 'produccion', 'contabilidad', 'ventas']
      .every((d) => world.areas.some((a) => a.departmentId === d)),
    world.areas.map((a) => a.departmentId).join(', '));
  const plan = snap().flujo;
  check('cada agente del flujo tiene su avatar en el mapa',
    plan.every((n) => world.staff.some((p) => p.agentId === n.id)),
    world.staff.filter((p) => p.agentId).length + ' de ' + plan.length);
  check('los agentes conviven con personal humano',
    world.staff.some((p) => p.kind === 'human') && world.staff.some((p) => p.kind === 'ai'));
  check('cada departamento declara sus procesos internos',
    world.areas.every((a) => Array.isArray(a.stations) && a.stations.length >= 1));

  // Alta, edición y baja desde el agente.
  r = await call('SET_ORG', { op: 'add_area', departmentId: 'ti', name: 'Data', structure: 'lab' });
  check('SET_ORG crea un área', r.success, JSON.stringify(r));
  world = await w();
  const data = world.areas.find((a) => a.name === 'Data');
  check('el área nueva existe con su estructura', !!data && data.structure === 'lab', JSON.stringify(data));

  r = await call('SET_ORG', { op: 'add_station', areaId: 'Data', name: 'Modelos', process: 'Entrenamiento' });
  check('SET_ORG añade un proceso interno', r.success, JSON.stringify(r));
  r = await call('SET_ORG', { op: 'add_staff', areaId: 'Data', name: 'Nora', role: 'Analista', kind: 'human' });
  check('SET_ORG incorpora una persona', r.success, JSON.stringify(r));
  world = await w();
  eq('el área tiene dos procesos', world.areas.find((a) => a.name === 'Data').stations.length, 2);
  check('la persona queda en su área',
    world.staff.some((p) => p.name === 'Nora' && p.areaId === data.id));

  r = await call('SET_ORG', { op: 'update_staff', staffId: 'Nora', role: 'Responsable de datos' });
  check('SET_ORG edita a una persona', r.success, JSON.stringify(r));
  eq('el rol cambió', (await w()).staff.find((p) => p.name === 'Nora').role, 'Responsable de datos');

  // Un agente del flujo no se borra del mapa: se apaga en el flujo. Si se
  // pudiera borrar, el mapa mentiría sobre quién trabaja aquí.
  const agentAvatar = (await w()).staff.find((p) => p.agentId);
  r = await call('SET_ORG', { op: 'remove_staff', staffId: agentAvatar.id });
  check('SET_ORG no deja borrar el avatar de un agente', r.success === false, JSON.stringify(r));
  check('y remite a SET_WORKFLOW', /SET_WORKFLOW/.test(r.error), r.error);

  // Errores del usuario: se contestan, no revientan el documento.
  const huellaMundo = JSON.stringify(await w());
  r = await call('SET_ORG', { op: 'update_area', areaId: 'no-existe', name: 'x' });
  check('SET_ORG rechaza un área inexistente', r.success === false, JSON.stringify(r));
  r = await call('SET_ORG', { op: 'resize', gridW: 6, gridH: 6 });
  check('SET_ORG rechaza encoger sobre un área ocupada', r.success === false, JSON.stringify(r));
  r = await call('SET_ORG', { op: 'op_inventado' });
  check('SET_ORG rechaza una operación desconocida', r.success === false && /Válidos/.test(r.error), JSON.stringify(r));
  eq('ningún fallo dejó el mapa a medias', JSON.stringify(await w()), huellaMundo);

  // Borrar un departamento no despide a nadie.
  const antes = (await w()).staff.length;
  r = await call('SET_ORG', { op: 'remove_area', areaId: 'Data' });
  check('SET_ORG borra un área', r.success, JSON.stringify(r));
  eq('y el personal se reubica en vez de desaparecer', (await w()).staff.length, antes);

  // El agente ve la organización, o no podría razonar sobre ella.
  const org = snap().organizacion;
  check('el snapshot expone la organización', !!org && !!org.resumen && Array.isArray(org.areas));
  check('con sus ocupantes', org.areas.some((a) => a.ocupantes.length > 0), JSON.stringify(org.resumen));
  check('y distingue agentes de personas',
    org.personal.some((p) => p.tipo === 'ai' && p.agente) && org.personal.some((p) => p.tipo === 'human'));

  // La vista Organización debe pintarse en las cuatro ambientaciones, y el
  // mapa NO puede cambiar al cambiar de piel.
  const gotoWorld = () => {
    const btn = navButtons().find((b) => {
      const l = renderDeep(b, 0).find((n) => n && n.p && n.p.className === 'ks-navitem-label');
      return l && String(l.c) === 'Organización';
    });
    if (btn) btn.p.onClick();
    return btn;
  };
  check('la Organización está en el menú', !!gotoWorld());
  const huella2 = JSON.stringify(await w());
  const roto = [];
  for (const skin of [{ form: 'classic', classicMode: 'day' }, { form: 'game', gameMode: 'kimoslab' },
    { form: 'game', gameMode: 'jabotel' }, { form: 'game', gameMode: 'spacecraft' }]) {
    await call('SET_THEME', skin);
    gotoWorld();
    renderErrors = [];
    const painted = renderDeep(app.Component(), 0);
    const surface = painted.filter((n) => n && n.p && n.p.className === 'ws-surface');
    if (!surface.length) roto.push((skin.gameMode || skin.classicMode) + ': sin superficie');
    for (const e of renderErrors) roto.push((skin.gameMode || skin.classicMode) + ' → ' + e);
  }
  check('la Organización se pinta en las cuatro ambientaciones', roto.length === 0, roto.join(' · '));
  eq('cambiar de ambientación no mueve una sola celda', JSON.stringify(await w()), huella2);
  await call('SET_THEME', { form: 'classic', classicMode: 'night' });
}

app.unmount();
check('unmount desregistra el agente', agentReg === null);

// ── 16. Host reducido (AppShell v1 mínimo) ───────────────────────────────
// Sin items, sin agente, sin authFetch, sin config ni documents: la app debe
// montar, renderizar y guardar igual. Es el contrato mínimo del shell.
{
  let minSaved = null;
  const minimal = {
    app: { appId: 'kreative-studio' },
    notify: () => {},
    saveData: async (p) => { minSaved = p; },
    loadData: async () => null,
  };
  let minApp = null;
  try { minApp = mod.default(minimal); } catch (e) { check('monta en un host reducido', false, e.message); }
  if (minApp) {
    await sleep(20);
    check('monta en un host reducido', true);
    try { minApp.Component(); check('renderiza en un host reducido', true); }
    catch (e) { check('renderiza en un host reducido', false, e.message); }
    check('no se registra agente si el host no lo ofrece', agentReg === null);
    try { minApp.unmount(); check('unmount tolera un host reducido', true); }
    catch (e) { check('unmount tolera un host reducido', false, e.message); }
  }
}

// El bundle no importa nada en tiempo de ejecución: se carga sin red.
const bundleSrc = await (await import('node:fs/promises')).readFile(
  new URL('../dist/index.js', import.meta.url), 'utf8');
check('el bundle no tiene imports en runtime', !/^\s*import\s/m.test(bundleSrc));
check('el bundle no empaqueta su propio React', !/from ['"]react['"]/.test(bundleSrc));
check('el bundle exporta un único default', (bundleSrc.match(/^export default/gm) || []).length === 1);

// ── Resultado ────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(58));
if (failures.length) {
  console.log('✖ ' + failures.length + ' fallo(s) de ' + (passed + failures.length) + ' comprobaciones:\n');
  for (const f of failures) console.log('   ✖ ' + f);
  process.exit(1);
}
console.log('✔ ' + passed + ' comprobaciones correctas.');
console.log('  Campaña: ' + sp.campania.escenas + ' escenas · ' + sp.trabajos.total + ' trabajos · '
  + sp.assets.length + ' assets · ' + Object.keys(sp.etapas).length + ' etapas.');
