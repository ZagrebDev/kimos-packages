// Prueba de RENDER REAL del bundle de Kreative Studio.
//
// Genera una campaña, fabrica los assets con FFmpeg (patrones de prueba: no
// hace falta material de nadie), los sirve por HTTP, ejecuta el bundle de
// render SIN TOCARLO y comprueba el archivo resultante: dimensiones, fps,
// audio y —sobre todo— que la duración real coincide con la declarada.
//
//   node apps/kreative-studio/test/test-render.mjs
//
// Necesita ffmpeg en el PATH (o la variable FFMPEG). Si falta, o si al binario
// le faltan filtros, la prueba se SALTA diciendo exactamente qué falta: es una
// comprobación opcional, no un fallo del código.
//
// Existe porque el resto de los tests no la habrían encontrado: la primera
// ejecución real reveló que las transiciones xfade solapan los clips, así que
// el máster duraba menos que la suma de los planos y la locución, los rótulos
// y los subtítulos se iban desincronizando plano a plano.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync, spawn } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BUNDLE = path.join(HERE, '..', 'dist', 'index.js');
const FILTERS = ['xfade', 'sidechaincompress', 'loudnorm', 'drawtext', 'subtitles', 'asplit', 'amix', 'adelay'];

function skip(why) {
  console.log('⊘ Prueba de render OMITIDA: ' + why);
  console.log('  El resto de la suite (test-app.mjs) no la necesita.');
  process.exit(0);
}

// ── ¿Tenemos un FFmpeg utilizable? ───────────────────────────────────────
const FF = process.env.FFMPEG || 'ffmpeg';
let filterList = '';
try { filterList = execFileSync(FF, ['-hide_banner', '-filters'], { stdio: 'pipe' }).toString(); }
catch (e) { skip('no hay ffmpeg en el PATH (defínelo con FFMPEG=/ruta/a/ffmpeg)'); }
const missing = FILTERS.filter((f) => !new RegExp('\\b' + f + '\\b').test(filterList));
if (missing.length) skip('a este ffmpeg le faltan filtros: ' + missing.join(', '));

const FONT_DIRS = ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/truetype/freefont', '/Library/Fonts'];
const fontDir = FONT_DIRS.find((d) => fs.existsSync(d));
if (!fontDir) skip('no se encontró ninguna tipografía TTF del sistema');
const ttf = fs.readdirSync(fontDir).filter((f) => f.endsWith('.ttf'));
if (!ttf.length) skip('no hay .ttf en ' + fontDir);

const ff = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'pipe' });

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-render-'));
const SERVE = path.join(WORK, 'serve');
const RUN = path.join(WORK, 'run');
fs.mkdirSync(SERVE, { recursive: true });
fs.mkdirSync(path.join(RUN, 'fonts'), { recursive: true });

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '✔ ' : '✖ ') + name + (ok || !detail ? '' : ' — ' + detail));
  if (!ok) failures++;
};

// ── Campaña ──────────────────────────────────────────────────────────────
globalThis.React = { createElement: (t, p, ...c) => ({ t, p, c }), useState: (v) => [v, () => {}], useEffect: () => {}, useRef: (v) => ({ current: v }) };
globalThis.window = { location: { origin: 'http://k', href: 'http://k/' } };
let A = null;
const items = new Map();
const app = (await import(BUNDLE)).default({
  app: { appId: 'kreative-studio', instanceId: 'i1', teamId: 't1' },
  assetUrl: (p) => 'http://k/api/apps/kreative-studio/asset/' + p,
  notify: () => {}, window: { setTitle: () => {} },
  saveData: async () => {}, loadData: async () => null,
  items: { list: async () => [...items.values()], create: async (i) => { items.set(i.id, i); return i; },
    update: async (id, i) => { items.set(id, i); return i; }, remove: async (id) => { items.delete(id); } },
  agent: { register: (r) => { A = r; return () => {}; } },
});
await new Promise((r) => setTimeout(r, 40));
const call = (t, p) => A.dispatchAction({ type: t, payload: p || {} });

await call('SET_BRIEF', { productName: 'Mesa Fiordo', usp: 'Roble macizo. 140 cm. Aceite natural.', priceText: '749' });
await call('ADD_PRODUCT_PHOTO', { url: 'https://cdn.test/f.jpg', isHero: true });
await call('GENERATE_CAMPAIGN', { intent: 'campaña premium de 12 segundos' });
await call('SET_SETTINGS', { aspects: ['16:9'], resolutions: ['1080'], variantCount: 1, subtitles: true, fps: 25 });

// ── Servidor de assets (OTRO proceso: execSync bloquea el bucle de Node) ──
const PORT = 8100 + Math.floor(Math.random() * 700);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: SERVE, stdio: 'ignore', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch (e) { /* ya muerto */ } };
process.on('exit', stopServer);
await new Promise((r) => setTimeout(r, 1200));
const BASE = 'http://127.0.0.1:' + PORT + '/';

// ── Producir: cada trabajo genera un archivo sintético ───────────────────
let made = 0;
function makeAsset(job) {
  const name = job.jobId + (job.tipo === 'image' ? '.png' : job.tipo === 'video' ? '.mp4' : '.wav');
  const out = path.join(SERVE, name);
  if (job.tipo === 'image') {
    ff(['-f', 'lavfi', '-i', 'color=c=gray:s=1920x1080', '-frames:v', '1', '-y', out]);
  } else if (job.tipo === 'video') {
    const d = Math.max(1, Number(job.duracionSeg) || 2);
    // testsrc lleva contador de fotogramas: un recorte mal calculado se ve.
    ff(['-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=25:duration=' + (d + 1),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-y', out]);
  } else {
    ff(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=' + (job.tipo === 'music' ? 30 : 2), '-ar', '48000', '-y', out]);
  }
  made++;
  return BASE + name;
}

let rondas = 0;
for (;;) {
  const res = await call('RUN_PRODUCTION', { limit: 20 });
  if (res.data.listo) break;
  if (!res.data.siguienteLote.length) { check('el ciclo de producción avanza', false, 'lote vacío'); break; }
  const assets = res.data.siguienteLote.map((j) => ({ jobId: j.jobId, url: makeAsset(j),
    costUsd: j.costeEstimadoUsd, durationSec: j.duracionSeg }));
  const reg = await call('REGISTER_ASSETS', { assets });
  if (!reg.success) { check('REGISTER_ASSETS', false, reg.error); break; }
  if (++rondas > 15) { check('el ciclo termina', false, 'demasiadas rondas'); break; }
}
check('producción completa (' + made + ' assets en ' + rondas + ' rondas)', made > 0 && rondas > 0);

ff(['-f', 'lavfi', '-i', 'color=c=white@0.85:s=400x140,format=rgba', '-frames:v', '1', '-y', path.join(SERVE, 'logo.png')]);
await call('SET_BRAND', { logoUrl: BASE + 'logo.png' });

// ── Ejecutar el bundle tal cual ──────────────────────────────────────────
const bundle = (await call('EXPORT', { what: 'render_bundle' })).data;
check('el bundle no declara archivos faltantes', !/FALTAN \d+ DE/.test(bundle));
fs.writeFileSync(path.join(RUN, 'render.sh'), bundle);
const bold = ttf.find((f) => /Bold/i.test(f)) || ttf[0];
fs.copyFileSync(path.join(fontDir, bold), path.join(RUN, 'fonts/display.ttf'));
fs.copyFileSync(path.join(fontDir, ttf.find((f) => !/Bold|Oblique|Italic/i.test(f)) || ttf[0]), path.join(RUN, 'fonts/body.ttf'));

const env = { ...process.env };
if (process.env.FFMPEG) {                       // que el script encuentre ESE ffmpeg
  const shim = path.join(WORK, 'bin');
  fs.mkdirSync(shim, { recursive: true });
  fs.writeFileSync(path.join(shim, 'ffmpeg'), '#!/usr/bin/env bash\nexec ' + process.env.FFMPEG + ' "$@"\n');
  fs.chmodSync(path.join(shim, 'ffmpeg'), 0o755);
  env.PATH = shim + ':' + env.PATH;
}

const t0 = Date.now();
let ok = true;
try {
  execSync('bash render.sh', { cwd: RUN, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 900000 });
} catch (e) {
  ok = false;
  check('el bundle se ejecuta sin errores', false);
  console.log(String(e.stdout || '').slice(-800));
  console.log(String(e.stderr || '').slice(-2500));
}
if (ok) check('el bundle se ejecuta sin errores (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)', true);
stopServer();

// ── Comprobar el entregable ──────────────────────────────────────────────
function probe(f) {
  let out = '';
  try { execFileSync(FF, ['-hide_banner', '-i', f], { stdio: 'pipe' }); }
  catch (e) { out = String(e.stderr || ''); }
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  const vid = /Video: (\w+).*?, (\d+)x(\d+)/.exec(out);
  return {
    duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
    width: vid ? Number(vid[2]) : null, height: vid ? Number(vid[3]) : null,
    audio: /Audio: (\w+)/.test(out) ? /Audio: (\w+)/.exec(out)[1] : null,
    fps: /, ([\d.]+) fps/.test(out) ? Number(/, ([\d.]+) fps/.exec(out)[1]) : null,
  };
}

if (ok) {
  const expected = JSON.parse((await call('EXPORT', { what: 'json' })).data).edit.exports;
  for (const e of expected) {
    const f = path.join(RUN, 'out', e.filename);
    if (!fs.existsSync(f)) { check('se generó ' + e.filename, false); continue; }
    const p2 = probe(f);
    check(e.filename + ' tiene las dimensiones declaradas',
      p2.width === e.width && p2.height === e.height, p2.width + '×' + p2.height + ' vs ' + e.width + '×' + e.height);
    check(e.filename + ' va a ' + e.fps + ' fps', p2.fps && Math.abs(p2.fps - e.fps) < 0.5, String(p2.fps));
    check(e.filename + ' lleva audio', !!p2.audio);
    // El corazón de la prueba: xfade solapa los clips, así que la duración
    // declarada tiene que llevar ya descontadas las transiciones.
    check(e.filename + ' dura lo que declara (transiciones descontadas)',
      p2.duration !== null && Math.abs(p2.duration - e.durationSec) < 0.25,
      'real ' + (p2.duration || 0).toFixed(2) + 's vs declarado ' + e.durationSec + 's');
  }
  check('se quemaron los subtítulos sobre el máster', fs.existsSync(path.join(RUN, 'work/master-subs.mp4')));
}

fs.rmSync(WORK, { recursive: true, force: true });
console.log('\n' + (failures ? '✖ ' + failures + ' fallo(s)' : '✔ Render de extremo a extremo correcto.'));
process.exit(failures ? 1 : 0);
