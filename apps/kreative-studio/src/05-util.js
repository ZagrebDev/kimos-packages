
// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Utilidades puras
// ═══════════════════════════════════════════════════════════════════════════

const KS_VERSION = '1.0.0';

const s = (v) => (v == null ? '' : String(v));
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
const numOr = (v, d) => (v == null || v === '' ? d : num(v, d));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const norm = (v) => s(v).trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = (v) => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const nowIso = () => new Date().toISOString();
const uniq = (arr) => Array.from(new Set((arr || []).filter((x) => x != null && x !== '')));
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** IDs estables por semilla para que dos ejecuciones del pipeline con el mismo
 *  brief produzcan el mismo storyboard (indispensable para diffs de versión). */
let idCounter = 0;
const newId = (p) => p + '-' + Date.now().toString(36) + '-' + (idCounter++).toString(36)
  + Math.random().toString(36).slice(2, 5);

/** Hash determinista (FNV-1a 32 bits) — usado como semilla creativa. */
function hash32(str) {
  let hv = 0x811c9dc5;
  const t = s(str);
  for (let i = 0; i < t.length; i++) {
    hv ^= t.charCodeAt(i);
    hv = (hv + ((hv << 1) + (hv << 4) + (hv << 7) + (hv << 8) + (hv << 24))) >>> 0;
  }
  return hv >>> 0;
}
/** PRNG determinista (mulberry32): misma semilla ⇒ misma campaña. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (list, r) => (list && list.length ? list[Math.floor(r() * list.length) % list.length] : null);
const pickN = (list, n, r) => {
  const pool = (list || []).slice();
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
};

const round = (v, dec) => {
  const f = Math.pow(10, dec == null ? 2 : dec);
  return Math.round(num(v, 0) * f) / f;
};
const fmtMoney = (v, cur) => {
  const c = s(cur) || 'USD';
  const n = num(v, 0);
  const dec = n !== 0 && Math.abs(n) < 1 ? 3 : 2;
  return (c === 'USD' ? '$' : c === 'EUR' ? '€' : c + ' ') + n.toFixed(dec);
};
const fmtSec = (v) => {
  const n = Math.max(0, num(v, 0));
  const m = Math.floor(n / 60);
  const sec = n - m * 60;
  return m > 0 ? m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(sec % 1 ? 1 : 0)
    : sec.toFixed(sec % 1 ? 1 : 0) + 's';
};
/** Timecode SRT: 00:00:03,500 */
const fmtTc = (v) => {
  const t = Math.max(0, num(v, 0));
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  const p2 = (x) => (x < 10 ? '0' : '') + x;
  const p3 = (x) => (x < 100 ? (x < 10 ? '00' : '0') : '') + x;
  return p2(hh) + ':' + p2(mm) + ':' + p2(ss) + ',' + p3(ms);
};
const titleCase = (v) => s(v).replace(/\b([a-záéíóúñ])/gi, (m) => m.toUpperCase());
const sentence = (v) => { const t = s(v).trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
/** Cierra una frase con punto si no acaba ya en signo de puntuación. */
const punct = (v) => {
  const t = s(v).trim().replace(/[\s,;:]+$/, '');
  return t && !/[.!?…]$/.test(t) ? t + '.' : t;
};
/** Escapa un valor para CSV (RFC 4180). */
const csvCell = (v) => {
  const t = s(v).replace(/\r?\n/g, ' ');
  return /[",;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
/** Escapa un argumento para el script de shell de FFmpeg. */
const shq = (v) => "'" + s(v).replace(/'/g, "'\\''") + "'";
/** Escapa texto para filtros de FFmpeg (drawtext/subtitles). */
const ffq = (v) => s(v).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,');

/** Reparte un total entre pesos manteniendo la suma exacta. */
function splitByWeight(total, weights) {
  const ws = arr(weights).map((w) => Math.max(0, num(w, 0)));
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  const raw = ws.map((w) => (total * w) / sum);
  const out = raw.map((v) => Math.floor(v));
  let rest = Math.round(total - out.reduce((a, b) => a + b, 0));
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < order.length && rest > 0; i++, rest--) out[order[i][1]] += 1;
  return out;
}

/** Contraste WCAG aproximado entre dos hex — usado por Brand Consistency. */
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(s(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLum(rgb) {
  const c = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastRatio(a, b) {
  const ra = hexToRgb(a); const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const la = relLum(ra); const lb = relLum(rb);
  return round((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05), 2);
}
const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(s(v).trim());
