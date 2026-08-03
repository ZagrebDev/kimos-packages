
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
  L.push('# ── Descarga de assets registrados ───────────────────────────────────');
  L.push('dl() {  # dl <destino> <url>');
  L.push('  if [ -f "$1" ]; then echo "  ya está: $1"; return 0; fi');
  L.push('  echo "  bajando: $1"');
  L.push('  curl -fsSL --retry 3 --retry-delay 2 -o "$1" "$2"');
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
