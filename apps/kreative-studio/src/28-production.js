
// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 7 · Video Producer
// Convierte prompts en TRABAJOS de producción ejecutables: qué modelo, con
// qué parámetros, cuántas tomas, en qué orden y a qué coste. Un trabajo es la
// unidad que el agente de KIMOS (o el operador) ejecuta y luego liquida con
// REGISTER_ASSET.
// ═══════════════════════════════════════════════════════════════════════════

const JOB_STATUS = ['pending', 'running', 'done', 'failed', 'skipped'];

function buildProduction(c) {
  const prompts = obj(c.prompts);
  const sb = obj(c.storyboard);
  const scenes = arr(sb.scenes);
  const imgProv = getProvider(s(obj(prompts.providers).image));
  const vidProv = getProvider(s(obj(prompts.providers).video));
  const voiceProv = getProvider(s(c.settings.providers.voice));
  const musicProv = getProvider(s(c.settings.providers.music));
  const sfxProv = getProvider(s(c.settings.providers.sfx));
  const audio = obj(c.audio);
  const jobs = [];
  let order = 0;

  // 1) Fotogramas clave (keyframes). Sirven de anclaje visual del vídeo:
  //    generarlos primero es lo que mantiene la consistencia de producto.
  for (const p of arr(prompts.image)) {
    jobs.push(mkJob({
      order: order++, kind: 'image', stage: 'keyframe', sceneId: p.sceneId, code: p.code,
      providerId: p.providerId, provider: imgProv,
      prompt: p.text, negative: p.negative, params: p.params, payload: p.payload,
      qty: { count: 1 },
      label: 'Keyframe ' + p.code + ' · ' + p.role,
      file: 'keyframes/' + p.code + '.png',
      dependsOn: [],
      note: 'Usa las fotos del producto como referencia; valida forma y logotipo antes de animar.',
    }));
  }

  // 2) Tomas de vídeo. Si la escena excede el máximo del modelo, se parte en
  //    varias tomas encadenadas (el último fotograma alimenta la siguiente).
  for (const p of arr(prompts.video)) {
    const maxSec = num(vidProv && vidProv.maxSec, 10) || 10;
    const takes = Math.max(1, Math.ceil(num(p.durationSec, 5) / maxSec));
    for (let t = 0; t < takes; t++) {
      const dur = Math.min(maxSec, round(num(p.durationSec, 5) - t * maxSec, 1));
      jobs.push(mkJob({
        order: order++, kind: 'video', stage: 'shot', sceneId: p.sceneId, code: p.code + (takes > 1 ? '-T' + (t + 1) : ''),
        providerId: p.providerId, provider: vidProv,
        prompt: p.text, negative: p.negative,
        params: Object.assign({}, p.params, takes > 1 ? { continuation: t > 0, take: t + 1, of: takes } : {}),
        qty: { durationSec: dur },
        label: 'Toma ' + p.code + (takes > 1 ? ' (' + (t + 1) + '/' + takes + ')' : '') + ' · ' + p.role,
        // El montaje espera un archivo por escena. Si hubo que partir la
        // escena en varias tomas, el bundle de render las une antes.
        file: takes > 1 ? 'render/' + p.code + '-T' + (t + 1) + '.mp4' : 'render/' + p.code + '.mp4',
        joinInto: takes > 1 ? 'render/' + p.code + '.mp4' : '',
        dependsOn: ['keyframe:' + p.sceneId],
        note: takes > 1 ? 'Encadenada: parte del último fotograma de la toma anterior.' : '',
      }));
    }
  }

  // 3) Locución por escena.
  for (const v of arr(audio.vo)) {
    jobs.push(mkJob({
      order: order++, kind: 'voice', stage: 'audio', sceneId: v.sceneId, code: v.code,
      providerId: v.providerId, provider: voiceProv,
      prompt: v.text, params: v.params, qty: { text: v.text },
      label: 'Locución ' + v.code, file: 'audio/vo-' + v.code + '.wav', dependsOn: [],
      note: v.fits ? '' : 'La línea excede la duración de la escena: acortar texto o alargar plano.',
    }));
  }

  // 4) Música y efectos.
  if (audio.music) {
    jobs.push(mkJob({
      order: order++, kind: 'music', stage: 'audio', sceneId: null, code: 'MUS',
      providerId: s(audio.music.providerId), provider: musicProv,
      prompt: s(audio.music.prompt), params: obj(audio.music.params), qty: { count: 1 },
      label: 'Música · ' + s(audio.music.genre), file: 'audio/music.wav', dependsOn: [],
      note: 'Pedir al menos 2 versiones y elegir la que respete el clímax del money shot.',
    }));
  }
  for (const x of arr(audio.sfx)) {
    jobs.push(mkJob({
      order: order++, kind: 'sfx', stage: 'audio', sceneId: x.sceneId, code: 'SFX-' + x.code,
      providerId: s(x.providerId), provider: sfxProv,
      prompt: s(x.prompt), params: obj(x.params), qty: { count: 1 },
      label: 'Efecto ' + x.code, file: 'audio/sfx-' + slug(x.code) + '.wav', dependsOn: [],
    }));
  }

  const totals = jobs.reduce((acc, j) => {
    acc.cost = round(acc.cost + j.estCostUsd, 4);
    acc.byKind[j.kind] = round((acc.byKind[j.kind] || 0) + j.estCostUsd, 4);
    acc.countByKind[j.kind] = (acc.countByKind[j.kind] || 0) + 1;
    return acc;
  }, { cost: 0, byKind: {}, countByKind: {} });

  return {
    generatedAt: nowIso(),
    jobs,
    totals,
    // Tiempo de máquina estimado (referencia operativa, no compromiso).
    estMinutes: round(jobs.reduce((a, j) => a + (j.kind === 'video' ? 2.5 : j.kind === 'image' ? 0.5 : 0.8), 0), 1),
    order: ['keyframe', 'shot', 'audio'],
    guidance: [
      'Genera primero TODOS los keyframes y valida el producto antes de gastar en vídeo.',
      'Bloquea la semilla del modelo de imagen para mantener la coherencia entre planos.',
      'Si un plano falla dos veces, cambia el encuadre antes que el prompt.',
      'Registra cada resultado con REGISTER_ASSET para que el coste real sustituya al estimado.',
    ],
  };
}

function mkJob(d) {
  const p = d.provider || null;
  const qty = billableQty(p, obj(d.qty));
  // El id incluye la ESCENA, no solo tipo+código. Los códigos (SC01…) se
  // reutilizan al regenerar el storyboard con otra duración o formato: sin la
  // escena, un asset de la configuración anterior cerraría un trabajo que en
  // realidad es otro plano distinto.
  const idParts = ['job', slug(s(d.kind)),
    s(d.sceneId) ? slug(s(d.sceneId)) : '', slug(s(d.code) || String(d.order))].filter(Boolean);
  return {
    id: idParts.join('-'),
    order: num(d.order, 0), kind: s(d.kind), stage: s(d.stage),
    sceneId: d.sceneId || null, code: s(d.code), label: s(d.label),
    providerId: s(d.providerId), providerLabel: p ? p.label : s(d.providerId),
    prompt: s(d.prompt), negative: s(d.negative), params: obj(d.params), payload: d.payload || null,
    // `file` es la ruta que el montaje espera encontrar: es lo que enlaza un
    // asset registrado con el script de render.
    file: s(d.file), joinInto: s(d.joinInto),
    qty: obj(d.qty), billableQty: round(qty, 4),
    costUnit: p && p.cost ? p.cost.unit : 'call',
    estCostUsd: round(estimateCost(s(d.providerId), qty), 4),
    dependsOn: arr(d.dependsOn), note: s(d.note),
    status: 'pending', assetId: null, attempts: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · AGENTE 8 · Video Editor
// Timeline (EDL), subtítulos SRT y script FFmpeg reproducible: cortes, color,
// fundidos, transiciones, textos, logotipo, CTA, mezcla de audio y export a
// todos los formatos y resoluciones pedidos.
// ═══════════════════════════════════════════════════════════════════════════

/** ¿El montaje usa xfade encadenado o concatenación pura? */
function usesXfade(scenes) {
  const list = arr(scenes);
  return list.length >= 2 && list.some((sc, i) => i > 0 && sc.transitionIn && sc.transitionIn !== 'cut');
}
/** Segundos que cada transición consume solapando los dos planos. */
function overlapOf(sc) {
  const tr = byId(TRANSITIONS, sc.transitionIn, TRANSITIONS[0]);
  return tr.ff ? num(tr.dur, 0) : 0.02;   // el corte se hace con un xfade mínimo
}
/**
 * Tiempos REALES en el máster montado.
 *
 * xfade SOLAPA los clips: la duración final es la suma de los planos menos la
 * de las transiciones. Calcular la locución, los rótulos y los subtítulos sobre
 * la suma nominal los desincroniza, y el desfase se acumula plano a plano
 * (con 3 transiciones de medio segundo, más de un segundo al final). Estos son
 * los tiempos contra los que se monta todo lo que va sobre la imagen.
 */
function masterTimes(scenes) {
  const list = arr(scenes);
  const xf = usesXfade(list);
  const starts = [];
  let len = 0;
  list.forEach((sc, i) => {
    if (i === 0) { starts.push(0); len = num(sc.durationSec, 0); return; }
    const d = xf ? overlapOf(sc) : 0;
    starts.push(round(len - d, 3));       // el plano entra aquí, con el solape
    len = round(len - d + num(sc.durationSec, 0), 3);
  });
  return { starts, total: round(len, 3), xfade: xf };
}

function buildEdit(c) {
  const sb = obj(c.storyboard);
  const scenes = arr(sb.scenes);
  const audio = obj(c.audio);
  const st = styleById(c.styleId);
  const fps = clamp(num(c.settings.fps, 25), 12, 60);
  const times = masterTimes(scenes);
  const total = times.total;
  const startOf = (sceneId) => {
    const i = scenes.findIndex((x) => x.id === sceneId);
    return i >= 0 ? times.starts[i] : 0;
  };

  // ── Timeline multipista (en tiempos del máster, no del storyboard) ─────
  const video = scenes.map((sc, i) => ({
    idx: i, sceneId: sc.id, code: sc.code, role: sc.role,
    startSec: times.starts[i], endSec: round(times.starts[i] + sc.durationSec, 2), durationSec: sc.durationSec,
    frames: Math.round(sc.durationSec * fps),
    source: 'render/' + sc.code + '.mp4', speed: num(sc.speed, 1),
    transitionIn: sc.transitionIn, grade: sc.grade,
  }));
  const titles = scenes.filter((sc) => s(sc.onScreenText).trim()).map((sc) => {
    const st0 = startOf(sc.id);
    return {
      sceneId: sc.id, code: sc.code, text: s(sc.onScreenText),
      startSec: round(st0 + 0.25, 2), endSec: round(st0 + sc.durationSec - 0.15, 2),
      position: sc.role === 'cta' ? 'center' : 'lower-third',
      style: sc.role === 'cta' ? 'display' : 'body',
    };
  });
  const voice = arr(audio.vo).map((v) => ({
    sceneId: v.sceneId, code: v.code, startSec: startOf(v.sceneId), durationSec: v.estimatedSec,
    source: 'audio/vo-' + v.code + '.wav', text: v.text, gainDb: -6,
  }));
  const musicTrack = { source: 'audio/music.wav', startSec: 0, durationSec: total, gainDb: -18,
    ducking: { enabled: true, thresholdDb: -30, ratio: 6, attackMs: 60, releaseMs: 300 } };
  const sfxTrack = arr(audio.sfx).map((x) => ({ sceneId: x.sceneId, code: x.code, startSec: startOf(x.sceneId),
    source: 'audio/sfx-' + slug(x.code) + '.wav', gainDb: -12 }));

  // ── Entregables ────────────────────────────────────────────────────────
  const exports = [];
  for (const a of arr(c.settings.targets.aspects)) {
    for (const rId of arr(c.settings.targets.resolutions)) {
      const d = dimsFor(a, rId);
      // La duración del entregable es la del MÁSTER de ese formato, ya con las
      // transiciones descontadas: es lo que va a medir quien reciba el archivo.
      const fmtScenes = scenesOfFormat(sb, a);
      const fmtTotal = arr(fmtScenes).length ? masterTimes(fmtScenes).total : total;
      exports.push({
        id: 'exp-' + slug(a) + '-' + rId, aspect: a, resolution: rId,
        width: d.w, height: d.h, fps,
        durationSec: fmtTotal,
        filename: slug(c.title) + '-' + slug(a) + '-' + rId + '.mp4',
        bitrateMbps: rId === '4k' ? 45 : rId === '2k' ? 22 : 12,
        codec: 'h264', profile: 'high', pixFmt: 'yuv420p',
        platforms: PLATFORMS.filter((p) => arr(c.settings.targets.platforms).indexOf(p.id) >= 0
          && arr(p.aspects).indexOf(a) >= 0).map((p) => p.label),
      });
    }
  }

  return {
    generatedAt: nowIso(),
    fps, totalSec: total,
    timeline: { video, titles, voice, music: musicTrack, sfx: sfxTrack },
    exports,
    // Subtítulos y script se construyen sobre las pistas YA remapeadas al
    // tiempo del máster; nunca sobre los tiempos del storyboard.
    srt: buildSrt(titles, voice),
    ffmpeg: buildFfmpegScript(c, { scenes, exports, fps, total, titles, voice, sfx: sfxTrack }),
    edl: buildEdl(c, video, fps),
    checklist: [
      'Comprobar que el producto no cambia de forma entre planos consecutivos.',
      'Verificar legibilidad del texto en la zona segura de cada formato vertical.',
      'Escuchar la mezcla en móvil y con el sonido apagado (subtítulos obligatorios).',
      'Revisar que el logotipo respete su área de reserva (' + num(c.brand.logoSafeArea, 12) + ' %).',
    ],
  };
}

/**
 * Subtítulos SRT. Recibe pistas ya expresadas en tiempo del máster: la
 * locución si la hay, y si no los rótulos.
 */
function buildSrt(titles, voice) {
  const lines = arr(voice).length
    ? arr(voice).map((v) => ({ start: num(v.startSec, 0), end: num(v.startSec, 0) + Math.max(1, num(v.durationSec, 1)), text: s(v.text) }))
    : arr(titles).map((x) => ({ start: num(x.startSec, 0), end: num(x.endSec, 0), text: s(x.text) }));
  return lines.filter((l) => s(l.text).trim())
    .map((l, i) => (i + 1) + '\n' + fmtTc(l.start) + ' --> ' + fmtTc(l.end) + '\n' + l.text + '\n').join('\n');
}

/** EDL en formato CMX3600 simplificado, importable en NLE. */
function buildEdl(c, video, fps) {
  const tc = (sec) => {
    const f = Math.round(sec * fps);
    const hh = Math.floor(f / (3600 * fps));
    const mm = Math.floor((f % (3600 * fps)) / (60 * fps));
    const ss = Math.floor((f % (60 * fps)) / fps);
    const ff = f % fps;
    const p = (x) => (x < 10 ? '0' : '') + x;
    return p(hh) + ':' + p(mm) + ':' + p(ss) + ':' + p(ff);
  };
  const head = 'TITLE: ' + s(c.title).toUpperCase() + '\nFCM: NON-DROP FRAME\n\n';
  const body = arr(video).map((v, i) => {
    const n = String(i + 1).padStart(3, '0');
    const trans = v.transitionIn === 'cut' || !v.transitionIn ? 'C' : 'D';
    return n + '  ' + s(v.code).padEnd(8) + ' V     ' + trans + '        '
      + tc(0) + ' ' + tc(v.durationSec) + ' ' + tc(v.startSec) + ' ' + tc(v.endSec)
      + '\n* FROM CLIP NAME: ' + v.source + '\n';
  }).join('\n');
  return head + body;
}

/**
 * Script FFmpeg completo y reproducible. Genera un .sh que, dados los clips
 * renderizados en `render/` y el audio en `audio/`, produce TODOS los
 * entregables con color, transiciones, títulos, logo, CTA y mezcla.
 */
function buildFfmpegScript(c, ctx) {
  const x = obj(ctx);
  const scenes = arr(x.scenes);
  const exportsList = arr(x.exports);
  const fps = num(x.fps, 25);
  const st = styleById(c.styleId);
  const pal = obj(c.brand.palette);
  const primary = isHex(pal.primary) ? pal.primary : '#000000';
  const light = isHex(pal.light) ? pal.light : '#FFFFFF';
  const accent = isHex(pal.secondary) ? pal.secondary : '#19ACB1';
  const useSubs = c.settings.subtitles !== false;
  const logo = s(c.brand.logoUrl);
  const L = [];

  L.push('#!/usr/bin/env bash');
  L.push('# ' + s(c.title) + ' — script de montaje generado por Kreative Studio ' + KS_VERSION);
  L.push('# Estilo: ' + st.name + ' · ' + scenes.length + ' escenas · ' + fmtSec(x.total)
    + ' (suma de planos ' + fmtSec(scenes.reduce((a, sc) => a + num(sc.durationSec, 0), 0))
    + ' menos el solape de las transiciones)');
  L.push('#');
  L.push('# Entradas esperadas:');
  L.push('#   render/SCxx.mp4  — una toma por escena (mismo fps y resolución de trabajo)');
  L.push('#   audio/vo-SCxx.wav, audio/music.wav, audio/sfx-*.wav');
  L.push('#   brand/logo.png   — logotipo con transparencia (opcional)');
  L.push('#   fonts/display.ttf, fonts/body.ttf — tipografías de marca');
  if (useSubs) L.push('#   subs.srt         — subtítulos (descárgalos desde el Editor y guárdalos así)');
  L.push('# Salida: out/*.mp4 en todos los formatos y resoluciones declarados.');
  L.push('set -euo pipefail');
  L.push('');
  L.push('FPS=' + fps);
  L.push('WORK=work');
  L.push('OUT=out');
  L.push('mkdir -p "$WORK" "$OUT"');
  L.push('');
  L.push('# ── 1. Normalizar cada toma: duración exacta, fps, color y velocidad ──');
  for (const sc of scenes) {
    const speed = num(sc.speed, 1);
    const filters = [
      'fps=' + fps,
      speed !== 1 ? 'setpts=' + round(1 / Math.max(0.05, speed), 4) + '*PTS' : '',
      gradeFilter(sc.grade),
      'trim=duration=' + sc.durationSec,
      'setpts=PTS-STARTPTS',
      'format=yuv420p',
    ].filter(Boolean).join(',');
    L.push('ffmpeg -y -i render/' + sc.code + '.mp4 -an \\');
    L.push('  -vf ' + shq(filters) + ' \\');
    L.push('  -c:v libx264 -crf 16 -preset slow "$WORK/' + sc.code + '.mp4"');
  }
  L.push('');
  L.push('# ── 2. Concatenar con transiciones ────────────────────────────────────');
  const hasTransitions = scenes.some((sc, i) => i > 0 && sc.transitionIn && sc.transitionIn !== 'cut');
  if (!hasTransitions || scenes.length < 2) {
    L.push('printf "%s\\n" \\');
    for (const sc of scenes) L.push('  "file \'' + sc.code + '.mp4\'" \\');
    L.push('  > "$WORK/concat.txt"');
    L.push('ffmpeg -y -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$WORK/edit.mp4"');
  } else {
    // xfade encadenado: cada transición consume `dur` segundos del corte.
    const inputs = scenes.map((sc) => '-i "$WORK/' + sc.code + '.mp4"').join(' ');
    const parts = [];
    let prev = '[0:v]';
    let offset = num(scenes[0].durationSec, 0);
    for (let i = 1; i < scenes.length; i++) {
      const tr = byId(TRANSITIONS, scenes[i].transitionIn, TRANSITIONS[0]);
      const dur = tr.ff ? tr.dur : 0;
      const outLbl = i === scenes.length - 1 ? '[vout]' : '[v' + i + ']';
      if (tr.ff) {
        parts.push(prev + '[' + i + ':v]xfade=transition=' + tr.ff + ':duration=' + dur + ':offset=' + round(offset - dur, 2) + outLbl);
        offset = round(offset - dur + num(scenes[i].durationSec, 0), 2);
      } else {
        parts.push(prev + '[' + i + ':v]xfade=transition=fade:duration=0.02:offset=' + round(offset - 0.02, 2) + outLbl);
        offset = round(offset + num(scenes[i].durationSec, 0) - 0.02, 2);
      }
      prev = outLbl;
    }
    L.push('ffmpeg -y ' + inputs + ' \\');
    L.push('  -filter_complex ' + shq(parts.join(';')) + ' \\');
    L.push('  -map "[vout]" -c:v libx264 -crf 16 -preset slow "$WORK/edit.mp4"');
  }
  L.push('');
  L.push('# ── 3. Mezcla de audio (locución + música con ducking + efectos) ──────');
  // Pistas en tiempo del máster (ya descontadas las transiciones).
  const voTrack = arr(x.voice);
  const sfxTrackFF = arr(x.sfx);
  const voFiles = voTrack.map((v) => 'audio/vo-' + v.code + '.wav');
  const sfxFiles = sfxTrackFF.map((v) => 'audio/sfx-' + slug(v.code) + '.wav');
  L.push('# Ajusta los delays si mueves escenas en el timeline.');
  const aInputs = ['-i audio/music.wav'].concat(voFiles.map((f) => '-i ' + f)).concat(sfxFiles.map((f) => '-i ' + f));
  const aParts = [];
  aParts.push('[0:a]volume=-18dB,aformat=sample_fmts=fltp:sample_rates=48000[music]');
  voTrack.forEach((v, i) => {
    const ms = Math.round(num(v.startSec, 0) * 1000);
    aParts.push('[' + (i + 1) + ':a]adelay=' + ms + '|' + ms + ',volume=-6dB[vo' + i + ']');
  });
  sfxTrackFF.forEach((v, i) => {
    const idx = 1 + voFiles.length + i;
    const ms = Math.round(num(v.startSec, 0) * 1000);
    aParts.push('[' + idx + ':a]adelay=' + ms + '|' + ms + ',volume=-12dB[sfx' + i + ']');
  });
  const voLbls = voFiles.map((_, i) => '[vo' + i + ']').join('');
  const sfxLbls = sfxFiles.map((_, i) => '[sfx' + i + ']').join('');
  if (voFiles.length) {
    aParts.push(voLbls + 'amix=inputs=' + voFiles.length + ':normalize=0[voall]');
    // La locución se usa DOS veces (como cadena lateral del compresor y en la
    // mezcla final). Un pad de salida solo se puede consumir una vez, así que
    // hay que duplicarlo con asplit o el filtergraph no arranca.
    aParts.push('[voall]asplit=2[vokey][vomix]');
    aParts.push('[music][vokey]sidechaincompress=threshold=0.03:ratio=6:attack=60:release=300[ducked]');
    aParts.push('[ducked][vomix]' + sfxLbls + 'amix=inputs=' + (2 + sfxFiles.length) + ':normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
  } else {
    aParts.push('[music]' + sfxLbls + 'amix=inputs=' + (1 + sfxFiles.length) + ':normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
  }
  L.push('ffmpeg -y ' + aInputs.join(' ') + ' \\');
  L.push('  -filter_complex ' + shq(aParts.join(';')) + ' \\');
  L.push('  -map "[aout]" -c:a pcm_s16le "$WORK/mix.wav"');
  L.push('');
  L.push('# ── 4. Títulos, logotipo y cierre de marca ────────────────────────────');
  const titleFilters = [];
  for (const ti of arr(x.titles)) {
    const txt = s(ti.text).trim();
    if (!txt) continue;
    const isCta = ti.style === 'display';
    const font = isCta ? 'fonts/display.ttf' : 'fonts/body.ttf';
    const size = isCta ? 'h/12' : 'h/22';
    const yPos = isCta ? '(h-text_h)/2' : 'h-(h*0.18)';
    const from = round(num(ti.startSec, 0), 2);
    const to = round(num(ti.endSec, 0), 2);
    titleFilters.push('drawtext=fontfile=' + font + ':text=' + "'" + ffq(txt) + "'"
      + ':fontcolor=' + light + ':fontsize=' + size + ':x=(w-text_w)/2:y=' + yPos
      + ':box=1:boxcolor=' + primary + '@0.35:boxborderw=18'
      + ":enable='between(t," + from + ',' + to + ")'");
  }
  if (logo) titleFilters.push('[logo]overlay=W-w-(W*0.05):H-h-(H*0.05)');
  L.push('# El logotipo se superpone en la esquina con el área de reserva del manual de marca.');
  L.push('ffmpeg -y -i "$WORK/edit.mp4" -i "$WORK/mix.wav"' + (logo ? ' -i brand/logo.png' : '') + ' \\');
  const vf = titleFilters.filter((f) => f.indexOf('[logo]') < 0).join(',');
  if (logo) {
    L.push('  -filter_complex ' + shq('[2:v]scale=iw*0.12:-1[logo];[0:v]' + (vf || 'null') + '[txt];[txt][logo]overlay=W-w-(W*0.05):H-h-(H*0.05)[vout]') + ' \\');
    L.push('  -map "[vout]" -map 1:a \\');
  } else {
    L.push('  -vf ' + shq(vf || 'null') + ' -map 0:v -map 1:a \\');
  }
  L.push('  -c:v libx264 -crf 16 -preset slow -c:a aac -b:a 320k "$WORK/master.mp4"');
  L.push('');
  if (useSubs) {
    L.push('# ── 5. Subtítulos quemados (imprescindibles: la mayoría ve sin sonido) ──');
    L.push('ffmpeg -y -i "$WORK/master.mp4" \\');
    L.push('  -vf ' + shq('subtitles=subs.srt:force_style=' + "'" + 'FontName=Inter,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Alignment=2,MarginV=60' + "'") + ' \\');
    L.push('  -c:v libx264 -crf 16 -preset slow -c:a copy "$WORK/master-subs.mp4"');
    L.push('MASTER="$WORK/master-subs.mp4"');
  } else {
    L.push('MASTER="$WORK/master.mp4"');
  }
  L.push('');
  L.push('# ── 6. Entregables por formato y resolución ───────────────────────────');
  L.push('# Reencuadre inteligente: escala para cubrir y recorta al centro, que es');
  L.push('# donde el storyboard mantiene el producto en todos los aspectos.');
  for (const e of exportsList) {
    L.push('ffmpeg -y -i "$MASTER" \\');
    L.push('  -vf ' + shq('scale=' + e.width + ':' + e.height + ':force_original_aspect_ratio=increase,crop=' + e.width + ':' + e.height + ',setsar=1') + ' \\');
    L.push('  -c:v libx264 -crf 18 -preset slow -maxrate ' + e.bitrateMbps + 'M -bufsize ' + (e.bitrateMbps * 2) + 'M \\');
    L.push('  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k \\');
    L.push('  "$OUT/' + e.filename + '"   # ' + e.aspect + ' ' + e.resolution + (e.platforms.length ? ' → ' + e.platforms.join(', ') : ''));
  }
  L.push('');
  L.push('echo "Listo: $(ls -1 "$OUT" | wc -l) entregables en $OUT/"');
  return L.join('\n');
}

/** Traducción del color grading a filtros reales de FFmpeg. */
function gradeFilter(gradeId) {
  const map = {
    'teal-orange': 'eq=contrast=1.12:saturation=1.10,colorbalance=rs=0.05:bs=-0.05:gh=0.02',
    bleach: 'eq=contrast=1.30:saturation=0.55:gamma=0.95',
    kodak: 'eq=contrast=1.06:saturation=1.08:gamma_r=1.03:gamma_b=0.98,curves=preset=lighter',
    mono: 'hue=s=0,eq=contrast=1.25',
    pastel: 'eq=contrast=0.92:saturation=0.85:brightness=0.04',
    noir: 'eq=contrast=1.35:saturation=0.75:brightness=-0.04',
    clean: 'eq=contrast=1.04:saturation=1.05',
    cyberpunk: 'colorbalance=rs=-0.08:bs=0.12:gm=0.04,eq=contrast=1.15:saturation=1.20',
    earth: 'colorbalance=rs=0.04:gm=0.03:bs=-0.04,eq=saturation=0.95',
  };
  return map[s(gradeId)] || 'eq=contrast=1.05';
}
