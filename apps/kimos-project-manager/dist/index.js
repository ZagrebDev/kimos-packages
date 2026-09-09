/**
 * Gestor de Proyectos (Kimos Project Manager) — app instalable de KIMOS.
 *
 * Qué hace: lleva una cartera de proyectos separada POR CLIENTE, con un
 * tablero global en vivo en la portada y un tablero propio por proyecto;
 * plan de trabajo (fases, tareas con dependencias e hitos) sobre línea
 * temporal; matriz de riesgos 5×5; biblioteca de documentos (imágenes,
 * video, PDF, planos y enlaces) alimentada desde el disco local, desde una
 * carpeta conectada (File System Access API), desde Google Drive u otro
 * enlace; un analista que lee esa documentación y PROPONE un plan de trabajo
 * estructurado; bitácora, evaluación de desempeño y enlace con las apps
 * Planificación, Kanban y Cotizaciones del ecosistema KIMOS.
 *
 * Contrato AppShell v1:
 *   - React del host (globalThis.React), sin JSX ni paso de build.
 *   - Estado dentro del closure de mount(): una copia por ventana.
 *   - Persistencia por instancia con shell.saveData()/loadData(), guardado con
 *     debounce y sincronización periódica con FUSIÓN por entidad (§5.1 del
 *     APP-SPEC): cada cliente/proyecto/tarea/riesgo/documento lleva su
 *     `updatedAt` y gana la edición más reciente; las bajas viajan como
 *     lápidas para que lo borrado no reaparezca desde la pantalla de otra
 *     persona.
 *   - Agente IA con paridad sobre lo que se puede hacer en la interfaz.
 *
 * Los archivos NO se copian al servidor: la app indexa su ficha (nombre,
 * tipo, tamaño, ruta, carpeta de origen) y guarda una miniatura de las
 * imágenes; el contenido completo solo se incrusta si la persona lo pide
 * expresamente y el archivo es pequeño. Así la biblioteca es útil sin
 * convertir el documento de la instancia en un depósito de binarios.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef } = React;

  // Mantener en sincronía con manifest.json (y con el catálogo raíz).
  const APP_VERSION = '1.1.0';
  const MODEL_VERSION = 1;

  const instanceId = shell.app && shell.app.instanceId;

  // ── Utilidades base ─────────────────────────────────────────────────────
  const s = (v) => (v == null ? '' : String(v));
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : (d || 0); };
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const stamp = () => new Date().toISOString();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const uniq = (list) => Array.from(new Set(list));
  const sum = (list, f) => list.reduce((a, x) => a + n(f ? f(x) : x, 0), 0);
  /** Normaliza para comparar sin acentos ni mayúsculas. */
  const canon = (v) => s(v).trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const byUpdated = (a, b) => (n(b && b.updatedAt && Date.parse(b.updatedAt)) - n(a && a.updatedAt && Date.parse(a.updatedAt)));

  const DAY = 86400000;
  const pad2 = (x) => String(x).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const today = () => ymd(new Date());
  const parseDay = (v) => {
    const t = s(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    const d = new Date(t + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const addDays = (v, days) => {
    const d = parseDay(v); if (!d) return '';
    return ymd(new Date(d.getTime() + days * DAY));
  };
  const daysBetween = (a, b) => {
    const da = parseDay(a), db = parseDay(b);
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / DAY);
  };
  const daysFromToday = (v) => daysBetween(today(), v);
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fmtDay = (v) => {
    const d = parseDay(v); if (!d) return '—';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };
  const fmtDayShort = (v) => {
    const d = parseDay(v); if (!d) return '—';
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  };
  const fmtWhen = (iso) => {
    const t = Date.parse(s(iso)); if (!Number.isFinite(t)) return '';
    const diff = Math.round((Date.now() - t) / 1000);
    if (diff < 45) return 'recién';
    if (diff < 3600) return 'hace ' + Math.round(diff / 60) + ' min';
    if (diff < 86400) return 'hace ' + Math.round(diff / 3600) + ' h';
    if (diff < 604800) return 'hace ' + Math.round(diff / 86400) + ' d';
    try { return new Date(t).toLocaleDateString(); } catch (e) { return ''; }
  };
  const fmtNum = (v, dec) => {
    const x = n(v, 0);
    try { return x.toLocaleString('es-CL', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }
    catch (e) { return String(Math.round(x)); }
  };
  const fmtMoney = (v, cur) => {
    const x = n(v, 0);
    const abs = Math.abs(x);
    const short = abs >= 1e9 ? (x / 1e9).toFixed(1).replace('.0', '') + 'MM'
      : abs >= 1e6 ? (x / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace('.0', '') + 'M'
      : abs >= 1e4 ? fmtNum(Math.round(x / 1000)) + 'k'
      : fmtNum(x);
    return short + ' ' + s(cur || 'CLP');
  };
  const fmtBytes = (v) => {
    const x = n(v, 0);
    if (!x) return '';
    if (x < 1024) return x + ' B';
    if (x < 1048576) return (x / 1024).toFixed(0) + ' KB';
    if (x < 1073741824) return (x / 1048576).toFixed(1) + ' MB';
    return (x / 1073741824).toFixed(2) + ' GB';
  };
  const pct = (v) => Math.round(clamp(n(v, 0), 0, 100)) + '%';

  /** Días hábiles entre dos fechas y avance de N días hábiles saltando
   *  fines de semana y las ventanas bloqueadas del proyecto (p. ej. un mes
   *  en que el cliente no permite trabajos). */
  const isBlocked = (dayStr, blackouts) => {
    const d = parseDay(dayStr); if (!d) return false;
    if (d.getDay() === 0 || d.getDay() === 6) return true;
    for (const b of arr(blackouts)) {
      if (!b || !b.from || !b.to) continue;
      if (dayStr >= s(b.from) && dayStr <= s(b.to)) return true;
    }
    return false;
  };
  const nextWorkday = (dayStr, blackouts) => {
    let cur = s(dayStr) || today();
    for (let i = 0; i < 900 && isBlocked(cur, blackouts); i++) cur = addDays(cur, 1);
    return cur;
  };
  const addWorkdays = (dayStr, count, blackouts) => {
    let cur = nextWorkday(dayStr, blackouts);
    for (let i = 0; i < Math.max(0, count); i++) cur = nextWorkday(addDays(cur, 1), blackouts);
    return cur;
  };

  // ── Catálogos ───────────────────────────────────────────────────────────
  const PROJECT_STATUS = [
    ['discovery', 'Prospecto', 's5'],
    ['planning', 'En planificación', 's1'],
    ['active', 'En ejecución', 's3'],
    ['hold', 'En pausa', 's4'],
    ['closing', 'En cierre', 's2'],
    ['done', 'Cerrado', 's6'],
    ['lost', 'No adjudicado', 'muted'],
  ];
  const OPEN_STATUS = ['discovery', 'planning', 'active', 'hold', 'closing'];
  const RUNNING_STATUS = ['planning', 'active', 'closing'];
  const HEALTH = [
    ['auto', 'Automática'],
    ['on_track', 'En rumbo'],
    ['at_risk', 'En riesgo'],
    ['critical', 'Crítica'],
  ];
  const TASK_STATUS = [
    ['pending', 'Pendiente'],
    ['in_progress', 'En curso'],
    ['blocked', 'Bloqueada'],
    ['done', 'Completada'],
  ];
  const PRIORITY = [['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta'], ['critical', 'Crítica']];
  const RISK_STATUS = [['open', 'Abierto'], ['watch', 'En vigilancia'], ['mitigated', 'Mitigado'], ['closed', 'Cerrado'], ['hit', 'Materializado']];
  const RISK_CATEGORY = ['Plazo', 'Costo', 'Alcance', 'Calidad', 'Contractual', 'Técnico', 'Proveedor', 'Normativo', 'Personas', 'Cliente'];
  const DOC_KINDS = [
    ['image', 'Imagen'], ['video', 'Video'], ['pdf', 'PDF'], ['plan', 'Plano / CAD'],
    ['sheet', 'Planilla'], ['doc', 'Documento'], ['slide', 'Presentación'],
    ['link', 'Enlace'], ['other', 'Otro'],
  ];
  const SOURCE_KINDS = [
    ['folder', 'Carpeta local'], ['drive', 'Google Drive'], ['cloud', 'Otra nube / enlace'],
  ];
  const CURRENCIES = ['CLP', 'COP', 'USD', 'PEN', 'MXN', 'EUR', 'BRL', 'ARS'];
  const LOG_KINDS = [
    ['note', 'Nota'], ['decision', 'Decisión'], ['meeting', 'Reunión'],
    ['issue', 'Problema'], ['milestone', 'Hito'], ['system', 'Sistema'],
  ];
  const SERIES = ['s1', 's2', 's3', 's4', 's5', 's6'];
  const seriesColor = (i) => 'var(--kp-' + SERIES[((i % SERIES.length) + SERIES.length) % SERIES.length] + ')';
  const tokenColor = (t) => (t === 'muted' ? 'var(--kp-muted)' : 'var(--kp-' + t + ')');

  const labelOf = (table, key, fallback) => {
    const row = table.find((r) => r[0] === key);
    return row ? row[1] : (fallback != null ? fallback : s(key));
  };
  const statusLabel = (k) => labelOf(PROJECT_STATUS, k, 'Sin estado');
  const statusColor = (k) => tokenColor((PROJECT_STATUS.find((r) => r[0] === k) || [, , 'muted'])[2]);

  /** Deduce el tipo de documento por extensión o mimetype. */
  function docKindOf(name, mime) {
    const ext = (s(name).match(/\.([a-z0-9]{1,6})$/i) || [, ''])[1].toLowerCase();
    const m = s(mime).toLowerCase();
    if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff'].includes(ext)) return 'image';
    if (m.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) return 'video';
    if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (['dwg', 'dxf', 'rvt', 'ifc', 'skp', 'step', 'stp', 'iges'].includes(ext)) return 'plan';
    if (['xls', 'xlsx', 'xlsm', 'csv', 'tsv', 'ods'].includes(ext)) return 'sheet';
    if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'doc';
    if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'slide';
    return 'other';
  }

  // ── Iconos (SVG en línea, trazo 1.6, heredan currentColor) ──────────────
  const icon = (paths, size) => h('svg', {
    width: size || 15, height: size || 15, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, paths.map((d, i) => (typeof d === 'string'
    ? h('path', { key: i, d })
    : h(d.tag, Object.assign({ key: i }, d.attrs)))));
  const I = {
    compass: (z) => icon([{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, 'm15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3z'], z),
    dashboard: (z) => icon(['M3 13h6V3H3zM15 21h6V11h-6zM3 21h6v-4H3zM15 7h6V3h-6z'], z),
    users: (z) => icon(['M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20', { tag: 'circle', attrs: { cx: 9, cy: 7, r: 3.2 } }, 'M22 20v-1.5a4 4 0 0 0-3-3.85M16.5 4.2a3.2 3.2 0 0 1 0 5.6'], z),
    folders: (z) => icon(['M21 18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2z'], z),
    docs: (z) => icon(['M14 3v5h5', 'M19 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1 0 2z', 'M9 13h6M9 17h4'], z),
    risk: (z) => icon(['m12 3 9.5 16.5H2.5z', 'M12 10v4M12 17.5v.01'], z),
    plan: (z) => icon(['M3 6h9M3 12h13M3 18h7', 'M17 5h4M19 3v4', 'M18 16.5h3'], z),
    chart: (z) => icon(['M4 20V10M10 20V4M16 20v-7M22 20H2'], z),
    clock: (z) => icon([{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, 'M12 7.5V12l3 2'], z),
    flag: (z) => icon(['M4 21V4M4 5h10l-1.5 3.5L14 12H4'], z),
    check: (z) => icon(['m4.5 12.5 5 5L20 7'], z),
    plus: (z) => icon(['M12 5v14M5 12h14'], z),
    minus: (z) => icon(['M5 12h14'], z),
    x: (z) => icon(['M6 6l12 12M18 6L6 18'], z),
    search: (z) => icon([{ tag: 'circle', attrs: { cx: 11, cy: 11, r: 6.5 } }, 'm16 16 4.5 4.5'], z),
    pencil: (z) => icon(['M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z'], z),
    trash: (z) => icon(['M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13'], z),
    upload: (z) => icon(['M12 16V4M8 8l4-4 4 4', 'M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16'], z),
    link: (z) => icon(['M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.3 1.3', 'M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.3-1.3'], z),
    cloud: (z) => icon(['M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.2 9.6 4.2 4.2 0 0 0 7 18z'], z),
    drive: (z) => icon(['m8.2 3.5 7.6 13.2M3 16.7 10.6 3.5M3.2 16.9h17.6', 'M12 10.2 8.4 16.9'], z),
    sparkles: (z) => icon(['M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z', 'M18.5 4v3M20 5.5h-3'], z),
    refresh: (z) => icon(['M20 11a8 8 0 0 0-13.6-5.3L4 8', 'M4 5v3h3', 'M4 13a8 8 0 0 0 13.6 5.3L20 16', 'M20 19v-3h-3'], z),
    arrowLeft: (z) => icon(['M19 12H5M11 6l-6 6 6 6'], z),
    arrowRight: (z) => icon(['M5 12h14M13 6l6 6-6 6'], z),
    chevron: (z) => icon(['m9 6 6 6-6 6'], z),
    info: (z) => icon([{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, 'M12 11v5M12 8v.01'], z),
    alert: (z) => icon([{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, 'M12 7.5V13M12 16.5v.01'], z),
    play: (z) => icon(['m7 4.5 12 7.5-12 7.5z'], z),
    image: (z) => icon([{ tag: 'rect', attrs: { x: 3, y: 4, width: 18, height: 16, rx: 2.5 } }, { tag: 'circle', attrs: { cx: 9, cy: 10, r: 1.6 } }, 'm4 18 5.5-5 4 3.2 3-2.7L20 18'], z),
    film: (z) => icon([{ tag: 'rect', attrs: { x: 3, y: 4, width: 18, height: 16, rx: 2.5 } }, 'M8 4v16M16 4v16M3 12h18'], z),
    pdf: (z) => icon(['M14 3v5h5', 'M19 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1 0 2z', 'M9.5 17v-4h1.3a1.3 1.3 0 0 1 0 2.6H9.5'], z),
    ruler: (z) => icon(['M3.5 15.5 15.5 3.5l5 5-12 12z', 'M7 12l2 2M10 9l2 2M13 6l2 2'], z),
    grid: (z) => icon([{ tag: 'rect', attrs: { x: 3, y: 3, width: 7.5, height: 7.5, rx: 1.6 } }, { tag: 'rect', attrs: { x: 13.5, y: 3, width: 7.5, height: 7.5, rx: 1.6 } }, { tag: 'rect', attrs: { x: 3, y: 13.5, width: 7.5, height: 7.5, rx: 1.6 } }, { tag: 'rect', attrs: { x: 13.5, y: 13.5, width: 7.5, height: 7.5, rx: 1.6 } }], z),
    book: (z) => icon(['M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M8 7h7M8 11h5'], z),
    target: (z) => icon([{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 8.5 } }, { tag: 'circle', attrs: { cx: 12, cy: 12, r: 4.5 } }, { tag: 'circle', attrs: { cx: 12, cy: 12, r: 1 } }], z),
    money: (z) => icon([{ tag: 'rect', attrs: { x: 2.5, y: 5.5, width: 19, height: 13, rx: 2.5 } }, { tag: 'circle', attrs: { cx: 12, cy: 12, r: 2.8 } }, 'M6 9.5v5M18 9.5v5'], z),
    briefcase: (z) => icon([{ tag: 'rect', attrs: { x: 2.5, y: 7, width: 19, height: 13, rx: 2.5 } }, 'M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7', 'M2.5 12.5h19'], z),
    download: (z) => icon(['M12 4v12M8 12l4 4 4-4', 'M4 18v.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V18'], z),
    copy: (z) => icon([{ tag: 'rect', attrs: { x: 8.5, y: 8.5, width: 12, height: 12, rx: 2.2 } }, 'M15.5 5.5A2 2 0 0 0 13.5 3.5h-8A2 2 0 0 0 3.5 5.5v8a2 2 0 0 0 2 2'], z),
    filter: (z) => icon(['M3 5h18l-7 8v6l-4 2v-8z'], z),
  };
  const docIcon = (kind, z) => (kind === 'image' ? I.image(z) : kind === 'video' ? I.film(z)
    : kind === 'pdf' ? I.pdf(z) : kind === 'plan' ? I.ruler(z) : kind === 'sheet' ? I.grid(z)
    : kind === 'link' ? I.link(z) : I.docs(z));

  // ════════════════════════════════════════════════════════════════════════
  // 1. MODELO
  // ════════════════════════════════════════════════════════════════════════
  const emptyModel = () => ({
    modelVersion: MODEL_VERSION,
    seeded: false,
    clients: [],
    projects: [],
    sources: [],
    deleted: [],           // lápidas: [{ id, at }]
    settings: { workspace: 'Cartera de proyectos' },
    updatedAt: stamp(),
  });

  const newClient = (patch) => Object.assign({
    id: uid('cli'), name: '', code: '', industry: '', country: '',
    contactName: '', contactEmail: '', contactPhone: '', notes: '',
    colorIndex: 0, createdAt: stamp(), updatedAt: stamp(),
  }, patch || {});

  const newProject = (patch) => Object.assign({
    id: uid('prj'), clientId: '', name: '', code: '', status: 'planning',
    healthMode: 'auto', priority: 'medium', objective: '', scope: '',
    manager: '', team: [], tags: [], type: '',
    startDate: today(), endDate: addDays(today(), 90),
    currency: 'CLP', budget: 0, manualProgress: null,
    blackouts: [], phases: [], tasks: [], milestones: [], risks: [],
    documents: [], budgetLines: [], log: [], questions: [], links: [],
    centers: [], baseline: null, pricing: null, service: null,
    createdAt: stamp(), updatedAt: stamp(),
  }, patch || {});

  const newTask = (patch) => Object.assign({
    id: uid('tsk'), phaseId: '', name: '', description: '', status: 'pending',
    progress: 0, weight: 1, priority: 'medium', owner: '',
    startDate: '', endDate: '', dependsOn: [], deliverable: '',
    updatedAt: stamp(),
  }, patch || {});

  const newMilestone = (patch) => Object.assign({
    id: uid('mil'), name: '', date: '', status: 'pending', critical: false,
    notes: '', updatedAt: stamp(),
  }, patch || {});

  const newRisk = (patch) => Object.assign({
    id: uid('rsk'), title: '', category: 'Plazo', probability: 3, impact: 3,
    mitigation: '', owner: '', status: 'open', notes: '', updatedAt: stamp(),
  }, patch || {});

  const newDoc = (patch) => Object.assign({
    id: uid('doc'), name: '', kind: 'other', mime: '', size: 0, path: '',
    sourceId: '', origin: 'upload', url: '', thumb: '', dataUrl: '',
    tags: [], notes: '', reviewed: false, addedAt: stamp(), updatedAt: stamp(),
  }, patch || {});

  const newSource = (patch) => Object.assign({
    id: uid('src'), kind: 'folder', label: '', path: '', url: '',
    projectId: '', fileCount: 0, lastScan: '', notes: '',
    createdAt: stamp(), updatedAt: stamp(),
  }, patch || {});

  const newLog = (patch) => Object.assign({
    id: uid('log'), kind: 'note', text: '', author: '', at: stamp(), updatedAt: stamp(),
  }, patch || {});

  /** Centro de costo / sede: la unidad por la que se separa la oferta. Cada
   *  uno tiene su moneda local y su tipo de cambio contra la moneda de
   *  gestión del proyecto, porque el precio se presenta donde se firma. */
  const newCenter = (patch) => Object.assign({
    id: uid('ctr'), name: '', code: '', country: '', currency: 'CLP',
    fx: 1, fxNote: '', units: 0, notes: '', colorIndex: 0, updatedAt: stamp(),
  }, patch || {});

  /** Partida de costeo. `kind` separa la inversión del servicio recurrente:
   *  en CAPEX, unitCost es el costo unitario y qty la cantidad; en OPEX,
   *  unitCost es el costo MENSUAL y qty los meses de servicio. */
  const newLine = (patch) => Object.assign({
    id: uid('bl'), item: '', kind: 'capex', category: 'equipamiento',
    centerId: 'shared', qty: 1, unitCost: 0, note: '', baselineRef: '',
    updatedAt: stamp(),
  }, patch || {});

  const LINE_KINDS = [['capex', 'CAPEX · inversión'], ['opex', 'OPEX · servicio recurrente']];
  const LINE_CATEGORIES = [
    ['equipamiento', 'Equipamiento'], ['instalacion', 'Instalación y terreno'],
    ['software', 'Software y plataformas'], ['logistica', 'Logística y repuestos'],
    ['administrativo', 'Garantías, pólizas y administración'], ['contingencia', 'Contingencia'],
    ['servicio', 'Servicio post-venta'], ['otros', 'Otros'],
  ];
  const ALLOC_RULES = [['units', 'Por unidades del centro'], ['cost', 'Por costo directo'], ['equal', 'Partes iguales']];
  const ESCALATION_INDEX = [['ninguno', 'Sin reajuste'], ['UF', 'UF (Chile)'], ['IPC', 'IPC'], ['USD', 'Indexado a USD']];
  const MARGIN_MODES = [['sale', 'Margen sobre venta'], ['cost', 'Margen sobre costo']];

  /** Política de precio: cómo se pasa del costo al precio ofertable. */
  const defaultPricing = () => ({
    marginMode: 'sale',
    capexMarginPct: null,      // null = usar la recomendación del motor
    opexMarginPct: null,
    allocation: 'units',       // cómo se reparten las partidas compartidas
    contractType: 'llave_en_mano',
    autoPenalties: true,
    fxBufferPct: 0,
    notes: '',
    updatedAt: stamp(),
  });

  /** Modelo de costeo del servicio post-venta. Todos los valores unitarios
   *  son supuestos de modelación editables: la app deja a la vista de dónde
   *  sale cada peso para que se reemplacen por cotizaciones reales. */
  const defaultService = () => ({
    termMonths: 12,
    escalationIndex: 'ninguno',
    escalationPct: 0,
    slaOnSiteHours: 4,
    slaCoverage: '24x7',
    availabilityPct: 99.5,
    availabilityScope: 'unit',      // 'unit' | 'fleet'
    monthHours: 720,
    levels: [],                     // [{name, availabilityPct, onSiteHours}]
    penalties: [],                  // [{label, pctOfFee}]
    techMonthlyCost: [],            // [{centerId, cost}]
    guardPremiumPct: 50,
    partnerPerUnit: [],             // [{centerId, usd}]
    partnerNightFactor: 0.75,
    nocMonthly: 500,
    platformCapexLineId: '',        // partida de CAPEX que se amortiza en el fee
    sparesAnnualPct: 2.9,
    preventivesPerYear: 2,
    hoursPerPreventive: 4,
    hoursPerFte: 1800,
    crewBreakevenMin: 150,
    crewBreakevenMax: 400,
    updatedAt: stamp(),
  });

  const normalizeService = (raw) => {
    const svc = Object.assign(defaultService(), raw || {});
    svc.levels = arr(svc.levels).filter(Boolean);
    svc.penalties = arr(svc.penalties).filter(Boolean);
    svc.techMonthlyCost = arr(svc.techMonthlyCost).filter(Boolean);
    svc.partnerPerUnit = arr(svc.partnerPerUnit).filter(Boolean);
    return svc;
  };

  /** Rellena lo que falte al leer un documento guardado por una versión
   *  anterior de la app (o escrito por el agente). */
  function normalizeModel(raw) {
    const base = emptyModel();
    if (!raw || typeof raw !== 'object') return base;
    const m = Object.assign(base, raw);
    m.clients = arr(raw.clients).filter(Boolean).map((c) => newClient(c));
    m.sources = arr(raw.sources).filter(Boolean).map((x) => newSource(x));
    m.deleted = arr(raw.deleted).filter((d) => d && d.id);
    m.settings = Object.assign({ workspace: 'Cartera de proyectos' }, raw.settings || {});
    m.projects = arr(raw.projects).filter(Boolean).map((p) => {
      const proj = newProject(p);
      proj.phases = arr(p.phases).filter(Boolean).map((f, i) => Object.assign({ id: uid('fas'), name: 'Fase', order: i, updatedAt: stamp() }, f));
      proj.tasks = arr(p.tasks).filter(Boolean).map((t) => newTask(t));
      proj.milestones = arr(p.milestones).filter(Boolean).map((x) => newMilestone(x));
      proj.risks = arr(p.risks).filter(Boolean).map((x) => newRisk(x));
      proj.documents = arr(p.documents).filter(Boolean).map((x) => newDoc(x));
      proj.budgetLines = arr(p.budgetLines).filter(Boolean).map((x) => newLine(x));
      proj.centers = arr(p.centers).filter(Boolean).map((x) => newCenter(x));
      proj.pricing = Object.assign(defaultPricing(), p.pricing || {});
      proj.service = normalizeService(p.service);
      proj.baseline = p.baseline && arr(p.baseline.lines).length
        ? Object.assign({ label: 'Presupuesto de referencia', capturedAt: stamp() }, p.baseline, {
          lines: arr(p.baseline.lines).filter(Boolean).map((x) => newLine(x)),
        })
        : null;
      proj.log = arr(p.log).filter(Boolean).map((x) => newLog(x));
      proj.questions = arr(p.questions).filter(Boolean).map((x) => Object.assign({ id: uid('qst'), text: '', answer: '', status: 'open', owner: '', updatedAt: stamp() }, x));
      proj.links = arr(p.links).filter(Boolean).map((x) => Object.assign({ id: uid('lnk'), app: '', instanceId: '', label: '', updatedAt: stamp() }, x));
      proj.blackouts = arr(p.blackouts).filter(Boolean);
      proj.tags = arr(p.tags).map(s).filter(Boolean);
      proj.team = arr(p.team).map(s).filter(Boolean);
      return proj;
    });
    return m;
  }

  // ── Proyecto semilla: Parque Arauco ─────────────────────────────────────
  /* Cargado desde el "Informe Consolidado de Licitación — Directorios PAK y
   * PLC" (proceso PA-128-2026-DCL). Sirve de primer proyecto real de la
   * cartera y de ejemplo completo de lo que la app sabe llevar: fases,
   * tareas, hitos, riesgos, presupuesto, consultas abiertas y documentos. */
  function seedParqueArauco() {
    const cli = newClient({
      id: 'cli-parque-arauco', name: 'Parque Arauco', code: 'PA',
      industry: 'Retail / Centros comerciales', country: 'Chile · Colombia',
      contactName: 'Benjamín Marambio — Ingeniero Corporativo de Compras',
      contactEmail: 'bmarambio@parauco.com',
      contactPhone: 'c.c. Osman Herrera — Category Manager (oherrera@parauco.com)',
      notes: 'Canal oficial único: toda comunicación fuera de ese canal se considera falta grave y faculta a excluir al participante. Mandantes: Parque Arauco S.A. Chile (RUT 94.627.000-8) y Administradora Parque Arauco S.A.S Colombia (NIT 901.394.357-2).',
      colorIndex: 0,
    });

    const P = (name, order) => ({ id: 'fas-pa-' + order, name, order, updatedAt: stamp() });
    const phases = [
      P('1 · Evaluación y segunda ronda', 0),
      P('2 · Adjudicación y contrato', 1),
      P('3 · Ingeniería de detalle', 2),
      P('4 · Fabricación e importación', 3),
      P('5 · Instalación PAK (Chile)', 4),
      P('6 · Instalación PLC (Colombia)', 5),
      P('7 · Puesta en marcha y cierre', 6),
      P('8 · Operación y servicio post-venta', 7),
    ];

    const T = (id, phaseId, name, start, end, opts) => newTask(Object.assign({
      id: 'tsk-pa-' + id, phaseId, name, startDate: start, endDate: end,
    }, opts || {}));

    const tasks = [
      T('01', 'fas-pa-0', 'Confirmar con el canal oficial el estado de la evaluación y la fecha efectiva de adjudicación (05 vs. 12 de octubre)', '2026-09-08', '2026-09-12', { owner: 'Gerencia comercial', priority: 'critical', status: 'in_progress', progress: 40, weight: 2, deliverable: 'Correo formal respondido por el canal oficial' }),
      T('02', 'fas-pa-0', 'Solicitar formalmente los documentos faltantes: Anexo Técnico 03 (Estándar Salas de Datos v1.2), Anexo Técnico 2 (Red Multiservicio), Formulario Económico y plano eléctrico PLC piso 2 sur', '2026-09-08', '2026-09-12', { owner: 'Coordinación técnica', priority: 'critical', status: 'in_progress', progress: 25, weight: 2, deliverable: 'Solicitud enviada y acuse recibido' }),
      T('03', 'fas-pa-0', 'Reconstruir el costeo: quitar obra civil y puntos eléctricos/red; incorporar health check, tótem de laboratorio, certificaciones, stock de repuestos y provisión de garantía', '2026-09-14', '2026-09-25', { owner: 'Control de gestión', priority: 'critical', status: 'pending', weight: 3, deliverable: 'Costeo v2 en CLP y COP', dependsOn: ['tsk-pa-02'] }),
      T('04', 'fas-pa-0', 'Recalcular el OPEX y preparar una escala de SLA alternativa amparada en la respuesta 70', '2026-09-14', '2026-09-25', { owner: 'Operaciones y servicio', priority: 'high', status: 'pending', weight: 2, deliverable: 'Modelo de servicio con dos escalas de SLA' }),
      T('05', 'fas-pa-0', 'Preparar el paquete de mejora para una eventual segunda ronda: Gantt con bloqueo de diciembre, propuesta de accesibilidad universal y arquitectura de datos conforme a ley chilena y colombiana', '2026-09-14', '2026-09-25', { owner: 'Preventa técnica', priority: 'high', status: 'pending', weight: 3, deliverable: 'Dossier técnico de segunda ronda' }),
      T('06', 'fas-pa-0', 'Redactar el pliego de condiciones contractuales a negociar (§12.2) para tenerlo listo el día de la adjudicación', '2026-09-21', '2026-10-02', { owner: 'Legal y gerencia', priority: 'high', status: 'pending', weight: 2, deliverable: 'Pliego de 10 puntos innegociables' }),
      T('07', 'fas-pa-0', 'Conciliar el listado de posiciones de PLC por ID con Operaciones de La Colina (15 vs. 19 posiciones)', '2026-09-21', '2026-10-02', { owner: 'Coordinación técnica', priority: 'critical', status: 'pending', weight: 2, deliverable: 'Anexo de posiciones firmado' }),
      T('08', 'fas-pa-1', 'Negociar y firmar el contrato incorporando las respuestas 77, 78 y 110 (obras y puntos a cargo del mall)', '2026-10-13', '2026-10-31', { owner: 'Legal y gerencia', priority: 'critical', weight: 3, deliverable: 'Contrato firmado por ambos países' }),
      T('09', 'fas-pa-1', 'Constituir garantías: fiel cumplimiento 20%, anticipo 30% y pólizas de RC (USD 300.000) y TRC/CAR', '2026-10-13', '2026-11-07', { owner: 'Finanzas', priority: 'high', weight: 2, deliverable: 'Instrumentos emitidos y entregados' }),
      T('10', 'fas-pa-1', 'Cobrar el anticipo del 30% contra boleta de garantía y liberar la orden de compra de fabricación', '2026-11-03', '2026-11-10', { owner: 'Finanzas', priority: 'critical', weight: 2, dependsOn: ['tsk-pa-09'] }),
      T('11', 'fas-pa-2', 'Levantamiento en terreno de PAK Zonas C y D: conciliar punto por punto con Operaciones y validar FC4 y FC5', '2026-10-20', '2026-11-07', { owner: 'Ingeniería', priority: 'high', weight: 2, deliverable: 'Layout definitivo por punto' }),
      T('12', 'fas-pa-2', 'Verificar disponibilidad real de puertos y U libres en los ~60 racks del catastro Netlan; dimensionar racks nuevos o ampliaciones', '2026-10-20', '2026-11-14', { owner: 'Ingeniería', priority: 'high', weight: 2, deliverable: 'Matriz de puertos y destinos' }),
      T('13', 'fas-pa-2', 'Diseño industrial del chasis modular (frentes A, B, AA y AB) con capa de accesibilidad universal certificable', '2026-10-13', '2026-11-21', { owner: 'Diseño', priority: 'high', weight: 3, deliverable: 'Planos de fabricación y prototipo digital' }),
      T('14', 'fas-pa-2', 'Arquitectura de analítica en el borde: inferencia en dispositivo, sin persistencia de imagen, exportando solo metadatos agregados', '2026-10-13', '2026-11-14', { owner: 'Preventa técnica', priority: 'critical', weight: 3, deliverable: 'Documento de arquitectura y flujo de datos' }),
      T('15', 'fas-pa-2', 'Especificar la plataforma de health check y monitoreo remoto (salud de pantalla, temperatura, conectividad, toma de control, alertas SNMP)', '2026-10-13', '2026-11-21', { owner: 'Ingeniería de software', priority: 'critical', weight: 3, deliverable: 'Plataforma de monitoreo con licenciamiento' }),
      T('16', 'fas-pa-3', 'Fabricación de 27 tótems + 1 tótem de laboratorio', '2026-11-10', '2027-01-16', { owner: 'Producción', priority: 'critical', weight: 4, deliverable: '28 unidades en fábrica' }),
      T('17', 'fas-pa-3', 'Compra de media players N100, pantallas indoor, táctiles capacitivos, cámaras y UPS con tarjeta SNMP', '2026-11-10', '2026-12-19', { owner: 'Abastecimiento', priority: 'critical', weight: 3 }),
      T('18', 'fas-pa-3', 'Importación y nacionalización a Chile y Colombia', '2027-01-05', '2027-02-13', { owner: 'Logística', priority: 'critical', weight: 3, dependsOn: ['tsk-pa-16'] }),
      T('19', 'fas-pa-3', 'Stock inicial de repuestos críticos en Santiago y Bogotá (16 familias del §2.2.4)', '2027-01-05', '2027-02-13', { owner: 'Logística', priority: 'high', weight: 2 }),
      T('20', 'fas-pa-4', 'Certificación de puntos de red y electricidad en PAK; recableado de los puntos que no aprueben', '2027-01-05', '2027-01-23', { owner: 'Instalación CL', priority: 'high', weight: 2 }),
      T('21', 'fas-pa-4', 'Montaje y anclaje a piso de 9 tótems Zona C (niveles -2, +1, +2, +3, FC4 y FC5)', '2027-02-16', '2027-03-13', { owner: 'Instalación CL', priority: 'critical', weight: 3, dependsOn: ['tsk-pa-18'] }),
      T('22', 'fas-pa-4', 'Montaje y anclaje de 3 tótems Zona D (niveles +1, +2 y +4)', '2027-03-02', '2027-03-13', { owner: 'Instalación CL', priority: 'high', weight: 2 }),
      T('23', 'fas-pa-4', 'Conectorización a la Red Multiservicio y enrolamiento de cámaras y UPS en el monitoreo', '2027-03-09', '2027-03-27', { owner: 'Instalación CL', priority: 'high', weight: 2 }),
      T('24', 'fas-pa-5', 'Certificación de los puntos actuales de red y electricidad de PLC (§3.6, partida separada)', '2027-01-12', '2027-01-30', { owner: 'Instalación CO', priority: 'critical', weight: 2 }),
      T('25', 'fas-pa-5', 'Desinstalación y disposición de los tótems ViaDirect y M4D existentes', '2027-02-16', '2027-03-06', { owner: 'Instalación CO', priority: 'high', weight: 2 }),
      T('26', 'fas-pa-5', 'Montaje nocturno con centro cerrado de los 15 tótems de recambio, con fijación a piso e impermeabilización', '2027-02-23', '2027-04-03', { owner: 'Instalación CO', priority: 'critical', weight: 4, dependsOn: ['tsk-pa-25'] }),
      T('27', 'fas-pa-6', 'Pruebas de aceptación (UAT) y pruebas de estabilidad por centro comercial', '2027-04-06', '2027-04-24', { owner: 'Calidad', priority: 'critical', weight: 3 }),
      T('28', 'fas-pa-6', 'Dossier as-built, memorias, fichas técnicas y manuales de operación y mantenimiento', '2027-03-16', '2027-04-24', { owner: 'Calidad', priority: 'critical', weight: 3, deliverable: 'Dossier completo (libera la retención del 10%)' }),
      T('29', 'fas-pa-6', 'Capacitación a los equipos de operación de PAK y PLC', '2027-04-13', '2027-04-24', { owner: 'Servicio', priority: 'medium', weight: 1 }),
      T('30', 'fas-pa-7', 'Puesta en régimen del monitoreo proactivo 24/7 y del tablero de disponibilidad propio (evidencia para impugnar indicadores)', '2027-04-27', '2027-05-15', { owner: 'Servicio', priority: 'high', weight: 2 }),
      T('31', 'fas-pa-7', 'Programa de mantenimiento preventivo: 2 visitas al año por centro comercial con las 11 rutinas del §2.2.2', '2027-05-04', '2027-05-29', { owner: 'Servicio', priority: 'medium', weight: 2 }),
    ];

    const milestones = [
      newMilestone({ id: 'mil-pa-1', name: 'Entrega de ofertas (cumplido)', date: '2026-08-31', status: 'done', critical: true, notes: 'Enviada por correo al canal oficial en carpeta ZIP.' }),
      newMilestone({ id: 'mil-pa-2', name: 'Adjudicación', date: '2026-10-12', status: 'pending', critical: true, notes: '05.10.2026 según Bases y 12.10.2026 según la respuesta oficial N°13/37 del Anexo BA-06.' }),
      newMilestone({ id: 'mil-pa-3', name: 'Firma de contratos (Chile y Colombia)', date: '2026-10-31', status: 'pending', critical: true }),
      newMilestone({ id: 'mil-pa-4', name: 'Anticipo del 30% cobrado y OC de fabricación liberada', date: '2026-11-10', status: 'pending', critical: true }),
      newMilestone({ id: 'mil-pa-5', name: 'Bloqueo total de trabajos en PAK (todo diciembre)', date: '2026-12-01', status: 'pending', critical: true, notes: 'Respuesta 107: en diciembre no se pueden realizar trabajos en los centros comerciales.' }),
      newMilestone({ id: 'mil-pa-6', name: 'Equipos nacionalizados en Chile y Colombia', date: '2027-02-13', status: 'pending', critical: true }),
      newMilestone({ id: 'mil-pa-7', name: 'PAK operativo (12 tótems)', date: '2027-03-27', status: 'pending', critical: true }),
      newMilestone({ id: 'mil-pa-8', name: 'PLC operativo (15 tótems de recambio)', date: '2027-04-03', status: 'pending', critical: true }),
      newMilestone({ id: 'mil-pa-9', name: 'UAT y as-built aprobados — libera la retención del 10%', date: '2027-04-24', status: 'pending', critical: true }),
    ];

    const R = (id, title, category, p, i, mitigation, status) => newRisk({
      id: 'rsk-pa-' + id, title, category, probability: p, impact: i, mitigation, status: status || 'open',
    });
    const risks = [
      R('01', 'Atraso de fabricación e importación que gatille la multa de 0,5% diario (tope 20% del contrato)', 'Plazo', 4, 5, 'Emitir órdenes de compra inmediatamente tras la adjudicación y financiar la compra con el anticipo del 30%. Negociar que el conteo de la multa inicie desde la fecha de la Gantt aprobada y no desde una fecha unilateral. Flete con holgura y lote parcial adelantado.'),
      R('02', 'Bloqueo total de trabajos en diciembre en PAK', 'Plazo', 5, 4, 'Construir la Gantt reconociendo el bloqueo desde la oferta, concentrar montaje en noviembre y enero, y obtener por escrito que el período bloqueado no computa para la multa por atraso de instalación.'),
      R('03', 'Condiciones ocultas que obliguen a obras no previstas (respuesta 75 dejó el pago abierto a "mutuo acuerdo")', 'Contractual', 3, 5, 'Fijar en el contrato la definición de condición oculta, el procedimiento de notificación, precios unitarios preacordados y plazo máximo de respuesta del mandante.'),
      R('04', 'SLA de 4 horas en sitio 24x7 en dos países con repuestos incluidos', 'Costo', 4, 4, 'Ejercer la respuesta 70 y ofertar una escala de SLA sostenible. Si se mantiene el SLA exigido, precificar cuadrilla dedicada, stock local en Santiago y Bogotá y monitoreo SNMP proactivo que anticipe la falla.'),
      R('05', 'Adjudicación parcial: PAK y PLC a proveedores distintos (§8.8 lo permite)', 'Cliente', 3, 3, 'Estructurar el precio desagregado por centro comercial y verificar que el margen resista la pérdida de economías de escala.'),
      R('06', 'Discrepancia de cantidades en PLC: 15 según Bases vs. 19 posiciones del plano', 'Alcance', 3, 3, 'Conciliar por ID de posición antes de la firma y dejar el anexo de posiciones como parte integrante del contrato.'),
      R('07', 'Cambio de layout por necesidad de Operaciones (respuesta 17 lo anticipa)', 'Alcance', 3, 3, 'Incluir en el contrato un mecanismo de cambio de ubicación con impacto reconocido en plazo y costo.'),
      R('08', 'Incumplimiento normativo de datos: nueva ley chilena (dic-2026) y prohibición de imágenes/rostros en Colombia', 'Normativo', 3, 5, 'Arquitectura de analítica en el borde sin persistencia de imagen. Documentar el flujo de datos, el hardening del hardware y las políticas de retención en la oferta técnica.'),
      R('09', 'Multa de 1,5% diario sobre "gestión de contenido", servicio que la respuesta 65 dejó fuera del alcance', 'Contractual', 3, 3, 'Solicitar su eliminación citando las respuestas 65 y 67, o acotarla a lo que el oferente controla: disponibilidad del media player y de la plataforma de monitoreo.'),
      R('10', 'Retención del 10% por documentación as-built o UAT incompletas', 'Calidad', 3, 3, 'Preparar el dossier as-built y el protocolo UAT desde el mes 1, no al cierre, y acordar el checklist de aceptación con el mandante.'),
      R('11', 'Póliza TRC/CAR por el 100% del valor del contrato pese a que la obra civil es del mall', 'Costo', 5, 3, 'Negociar proporcionalidad; en su defecto, incorporar el costo real de la prima en la oferta.'),
      R('12', 'Prevalencia de los indicadores de disponibilidad calculados por Parque Arauco ante discrepancia', 'Contractual', 5, 3, 'Acordar la fórmula de cálculo y la fuente de datos en el contrato, y mantener registro propio desde el sistema de monitoreo para poder impugnar con evidencia.'),
      R('13', 'Exposición cambiaria: hardware importado en USD y contrato a suma alzada en moneda local', 'Costo', 4, 4, 'Cláusula de reajuste, cobertura financiera o prima cambiaria incorporada al precio.'),
    ];

    const D = (id, name, kind, notes) => newDoc({
      id: 'doc-pa-' + id, name, kind, origin: 'registro', notes, reviewed: true,
      tags: ['licitación', 'PA-128-2026'],
    });
    const documents = [
      D('01', 'Términos y Condiciones — Proceso de Compra Directorios PAK y PLC (agosto 2026).pdf', 'pdf', 'Documento rector, 23 pp.: alcance, especificaciones técnicas, SLA, multas, garantías, cronograma, criterios de evaluación y condiciones administrativas.'),
      D('02', 'Consolidado BA_ANEXO_06 — Preguntas y Respuestas Directorios.xlsx', 'sheet', '113 consultas respondidas. Es el documento más importante después de las Bases: donde contradice al cuerpo de las Bases, PREVALECE el Anexo.'),
      D('03', 'Parque Arauco Kennedy Zona C — eléctrica y red.docx', 'doc', '6 planos. Rojo = punto con acometida eléctrica y red existentes; verde = requiere habilitación. Cubre niveles -2, +1, +2, +3, FC piso 4 y FC piso 5.'),
      D('04', '03 — Informe Levantamiento PAKO: Estatus de Gabinetes y Equipos (Netlan, jun-2025).pdf', 'pdf', '224 pp. Catastro de ~60 racks entre los pisos -3 y 5, con fotografías, ubicación en plano y detalle de equipos por unidad de rack.'),
      D('05', 'ARQ Niveles -2 al +5 / ELEC Niveles -2 al +3 (PAK).zip', 'plan', 'Planimetría arquitectónica y eléctrica de referencia de Kennedy.'),
      D('06', 'INFRAESTRUCTURA-PLC-NI1/NI2/NS1/NS2/NS3.pdf', 'plan', '5 planos: racks SSE/SSOE/SNE/SNOE/SCENTRO anclados a muro, backbone de fibra multimodo 12 hilos y asignación de puertos por patch panel (p. ej. NS2-RA01-PP1-P09).'),
      D('07', 'IE-CCC-N 1,2,3-ACOMT (PLC).pdf + .dwg', 'plan', 'Acometidas eléctricas de La Colina: piso 1 norte y sur, piso 2 norte, piso 3 norte. FALTA el plano de piso 2 zona sur.'),
      D('08', 'Parque La Colina.png', 'image', 'Plano de identificación de las 19 posiciones actuales, distinguiendo "ID Directorio ViaDirect" e "ID Publicidad M4D" por piso.'),
      D('09', 'Ubicaciones racks comunicaciones Piso 1 (PLC).dwg', 'plan', 'Ubicación de racks de comunicaciones del piso 1 de La Colina.'),
      D('10', 'Análisis Parque Arauco (documento interno).pdf', 'pdf', '6 pp. Análisis propio previo: resumen de bases, cronograma, riesgos y presupuesto de referencia en USD.'),
      D('11', 'Informe Consolidado de Licitación — Directorios PAK y PLC (KIMOS, sep-2026).pdf', 'pdf', 'Informe que consolida las Bases, las 113 respuestas oficiales y la documentación de terreno. Fuente de este proyecto.'),
    ];

    // ── Centros: la oferta se firma por centro comercial y en su moneda ──
    const centers = [
      newCenter({
        id: 'ctr-pak', name: 'Parque Arauco Kennedy', code: 'PAK', country: 'Chile',
        currency: 'CLP', fx: 950, units: 12, colorIndex: 0,
        fxNote: 'Supuesto de modelación: 950 CLP por USD. Actualízalo con el tipo de cambio del día de la oferta.',
        notes: 'Av. Presidente Kennedy 5413, Santiago. Zonas C y D: instalación desde cero de 12 tótems indoor.',
      }),
      newCenter({
        id: 'ctr-plc', name: 'Parque La Colina', code: 'PLC', country: 'Colombia',
        currency: 'COP', fx: 4100, units: 15, colorIndex: 1,
        fxNote: 'Supuesto de modelación: 4.100 COP por USD. Actualízalo con el tipo de cambio del día de la oferta.',
        notes: 'Carrera 58D # 146-51, Bogotá. Recambio completo de los tótems existentes; trabajos solo nocturnos con el centro cerrado.',
      }),
    ];

    // ── Línea base: el presupuesto de referencia del análisis interno ────
    const BB = (id, item, qty, unitCost, kind) => newLine({
      id: 'blb-pa-' + id, item, qty, unitCost, kind: kind || 'capex', centerId: 'shared',
    });
    const baseline = {
      label: 'Presupuesto de referencia (Análisis Parque Arauco, interno)',
      capturedAt: '2026-09-01T12:00:00.000Z',
      note: 'Costeo previo en USD, presentado como base de negociación antes de leer las 113 respuestas oficiales del Anexo BA-06.',
      lines: [
        BB('1', 'Hardware PAK (Chile) — tótems indoor interactivos', 12, 5500),
        BB('2', 'Hardware PLC (Colombia) — tótems indoor interactivos', 15, 5500),
        BB('3', 'Cómputo y software — Nano PC N100 + SSD + licencia', 27, 480),
        BB('4', 'Integración analítica (CPM) — cámaras y setup', 27, 350),
        BB('5', 'Instalación y obras (PAK+PLC) — redes y certificaciones', 27, 1500),
        BB('6', 'Energía y respaldo — UPS con tarjeta SNMP', 27, 300),
        BB('7', 'Gastos administrativos — pólizas y garantías', 1, 15000),
        BB('8', 'Reserva de contingencia (8% sobre equipos)', 1, 11840),
        BB('9', 'OPEX anual (servicio post venta) — soporte y mantenimiento', 12, 3200, 'opex'),
      ],
    };

    // ── Costeo vivo: corregido con las respuestas oficiales ─────────────
    const BL = (id, item, qty, unitCost, opts) => newLine(Object.assign({
      id: 'bl-pa-' + id, item, qty, unitCost,
    }, opts || {}));
    const budgetLines = [
      BL('01', 'Hardware PAK (Chile) — tótems indoor interactivos', 12, 5500, { centerId: 'ctr-pak', category: 'equipamiento', baselineRef: 'blb-pa-1', note: 'Consistente con el alcance de 12 unidades.' }),
      BL('02', 'Hardware PLC (Colombia) — tótems indoor interactivos', 15, 5500, { centerId: 'ctr-plc', category: 'equipamiento', baselineRef: 'blb-pa-2', note: 'Sujeto a la discrepancia 15 vs. 17-19 unidades.' }),
      BL('03', 'Cómputo — Nano PC N100 + SSD', 27, 438, { category: 'equipamiento', baselineRef: 'blb-pa-3', note: 'La licencia Porteus la adquiere Parque Arauco (resp. 63): descontados USD 42 por unidad.' }),
      BL('04', 'Integración analítica (CPM) — cámaras y enrolamiento', 27, 350, { category: 'equipamiento', baselineRef: 'blb-pa-4', note: 'Solo hardware de captura y configuración: la plataforma la provee PA (resp. 62).' }),
      BL('05', 'Montaje, anclaje, conectorización y puesta en marcha', 27, 900, { category: 'instalacion', baselineRef: 'blb-pa-5', note: 'Reformulada: obras civiles y puntos eléctricos/de red salen del alcance (resp. 77 y 78).' }),
      BL('06', 'Certificación de puntos de red y electricidad (PLC §3.6 y PAK resp. 101)', 27, 180, { category: 'instalacion', baselineRef: 'blb-pa-5', note: 'Partida separada exigida por las Bases; incluye recableado si un punto no aprueba.' }),
      BL('07', 'Energía y respaldo — UPS con tarjeta SNMP', 10, 300, { category: 'equipamiento', baselineRef: 'blb-pa-6', note: 'Las Bases permiten centralizar hasta 3 tótems por UPS.' }),
      BL('08', 'Plataforma de health check y monitoreo remoto (licenciamiento y operación)', 1, 24000, { category: 'software', note: 'PARTIDA AUSENTE en el costeo original: "el oferente debe suministrar la solución completa" (resp. 64).' }),
      BL('09', 'Tótem de laboratorio completo', 1, 6400, { category: 'equipamiento', note: 'PARTIDA AUSENTE: exigido por la resp. 56, con su cómputo, pantallas y cámaras.' }),
      BL('10', 'Stock inicial de repuestos críticos en Chile y Colombia', 1, 18000, { category: 'logistica', note: 'Condición necesaria para sostener el SLA comprometido.' }),
      BL('11', 'Desmontaje y disposición de los tótems existentes en PLC', 15, 220, { centerId: 'ctr-plc', category: 'instalacion', note: 'A cargo del oferente; no estaba en el costeo de referencia.' }),
      BL('12', 'Gastos administrativos — pólizas y garantías', 1, 15000, { category: 'administrativo', baselineRef: 'blb-pa-7', note: 'Revisar contra el costo real de TRC/CAR al 100% del contrato y RC por USD 300.000.' }),
      BL('13', 'Provisión por garantía de 3 años (pantallas, touch, NUC, cámaras y UPS)', 1, 14000, { category: 'administrativo', note: 'PARTIDA AUSENTE en el costeo original.' }),
      BL('14', 'Reserva de contingencia', 1, 16000, { category: 'contingencia', baselineRef: 'blb-pa-8', note: 'Elevada por el riesgo de condiciones ocultas aún no asignado (resp. 75).' }),
      BL('15', 'Servicio post-venta: monitoreo 24/7, preventivos y correctivo con repuestos', 12, 3200, { kind: 'opex', category: 'servicio', baselineRef: 'blb-pa-9', note: 'USD 118 por tótem/mes en dos países con SLA de 4 h en sitio 24x7: es el punto más frágil del presupuesto y debe recalcularse.' }),
    ];

    // ── Modelo de costeo del servicio y política de precio ───────────────
    const service = normalizeService({
      termMonths: 12,
      escalationIndex: 'ninguno', escalationPct: 0,
      slaOnSiteHours: 4, slaCoverage: '24x7', availabilityPct: 99.5, availabilityScope: 'unit', monthHours: 720,
      levels: [
        { name: 'Crítico — falla masiva o de acceso principal', availabilityPct: 99.5, onSiteHours: 4 },
        { name: 'Alto — falla de un tótem o del táctil', availabilityPct: 99.0, onSiteHours: 8 },
        { name: 'Medio — falla parcial (sensor o cámara)', availabilityPct: 98.0, onSiteHours: 24 },
      ],
      penalties: [
        { label: 'Disponibilidad de equipos bajo el SLA comprometido', pctOfFee: 2.5 },
        { label: 'Incumplimiento de la programación de mantenimientos preventivos', pctOfFee: 5 },
      ],
      techMonthlyCost: [{ centerId: 'ctr-pak', cost: 1700 }, { centerId: 'ctr-plc', cost: 1150 }],
      partnerPerUnit: [{ centerId: 'ctr-pak', usd: 110 }, { centerId: 'ctr-plc', usd: 85 }],
      platformCapexLineId: 'bl-pa-08',
      guardPremiumPct: 50, partnerNightFactor: 0.75, nocMonthly: 500,
      sparesAnnualPct: 2.9, preventivesPerYear: 2, hoursPerPreventive: 4, hoursPerFte: 1800,
      crewBreakevenMin: 150, crewBreakevenMax: 400,
    });

    const pricing = Object.assign(defaultPricing(), {
      contractType: 'llave_en_mano', marginMode: 'sale', allocation: 'units',
      notes: 'La oferta se presenta en moneda local por centro comercial, a valor neto y con los impuestos cuantificados por separado (§8.1 de las Bases).',
    });

    const Q = (id, text, owner) => ({ id: 'qst-pa-' + id, text, answer: '', status: 'open', owner, updatedAt: stamp() });
    const questions = [
      Q('01', '¿Las cámaras de monitoreo de reproducción publicitaria y las de analítica son dispositivos separados o una solución integrada? (consultas 22 y 46)', 'Preventa técnica'),
      Q('02', '¿Cómo debe extraerse y entregarse la data de analítica: API, dashboard propio del proveedor o integración a un DMP/CDP existente? (consultas 23 y 47)', 'Preventa técnica'),
      Q('03', '¿Existe hoy un proveedor o plataforma de analítica de audiencia que deba mantenerse o reemplazarse en PLC? (consulta 48)', 'Coordinación técnica'),
      Q('04', '¿Formato y periodicidad del reporte de audiencia en PLC? (consulta 49; en PAK la resp. 25 fijó periodicidad diaria)', 'Preventa técnica'),
      Q('05', '¿Parque Arauco probó marcas/modelos de cámara y espera cubrir los tres requerimientos con un único modelo? (consultas 29 y 53)', 'Ingeniería'),
      Q('06', '¿La cámara es para evaluar el estado de la pantalla o para medir audiencia de la pauta? (consulta 83)', 'Ingeniería'),
      Q('07', 'Aclaración escrita del alcance de analítica en PAK, dada la tensión entre las respuestas 62 ("la plataforma la provee PA") y 98 ("no se incluye software para el directorio, solo la analítica")', 'Gerencia comercial'),
      Q('08', 'Horario de trabajo en PAK: la respuesta 14 dice solo nocturno y la 107 admite día y noche. Debe cerrarse por escrito con Operaciones PAK', 'Coordinación técnica'),
      Q('09', 'Indicador único de disponibilidad con su fórmula: §3.4.1 fija 99,5/99,0/98,0% por nivel y §3.5 un 99% para el cluster', 'Legal y gerencia'),
      Q('10', 'Frontera de repuestos incluidos en el fee frente a los cotizables (la respuesta 71 la devolvió a la oferta)', 'Operaciones y servicio'),
    ];

    const log = [
      newLog({ id: 'log-pa-1', kind: 'milestone', at: '2026-08-06T12:00:00.000Z', author: 'Parque Arauco', text: 'Lanzamiento del proceso PA-128-2026-DCL: envío de documentos y anexos a los proveedores invitados.' }),
      newLog({ id: 'log-pa-2', kind: 'meeting', at: '2026-08-11T14:00:00.000Z', author: 'KIMOS', text: 'Visita técnica obligatoria a Parque Arauco Kennedy (11:00 hrs). Asistencia acreditada.' }),
      newLog({ id: 'log-pa-3', kind: 'meeting', at: '2026-08-12T13:00:00.000Z', author: 'KIMOS', text: 'Visita técnica obligatoria a Parque La Colina, Bogotá (09:00 hrs). Asistencia acreditada.' }),
      newLog({ id: 'log-pa-4', kind: 'decision', at: '2026-08-21T18:00:00.000Z', author: 'Parque Arauco', text: 'Publicación del Anexo BA-06 con las 113 consultas respondidas. Reasigna alcance: obras civiles, puntos eléctricos y de red pasan al mall; CMS, ad-server, SSP y analítica los provee Parque Arauco.' }),
      newLog({ id: 'log-pa-5', kind: 'milestone', at: '2026-08-31T20:00:00.000Z', author: 'KIMOS', text: 'Oferta entregada por el canal oficial en carpeta ZIP con los tres bloques exigidos (técnico, administrativo y económico).' }),
      newLog({ id: 'log-pa-6', kind: 'note', at: '2026-09-08T13:00:00.000Z', author: 'KIMOS', text: 'Informe consolidado del proceso terminado. Conclusión central: el alcance real es menor que el que sugieren las Bases, pero la exposición contractual es mayor. Recomendación: avanzar con tres condiciones contractuales innegociables.' }),
    ];

    const project = newProject({
      id: 'prj-pa-directorios',
      clientId: cli.id,
      name: 'Licitación Directorios Digitales PAK y PLC',
      code: 'PA-128-2026-DCL',
      status: 'planning',
      priority: 'critical',
      type: 'licitacion',
      objective: 'Adjudicar y ejecutar el suministro, instalación, puesta en marcha y mantenimiento de 27 tótems/directorios digitales interactivos y pantallas de retail media en Parque Arauco Kennedy (Chile) y Parque La Colina (Colombia), bajo un contrato único llave en mano a suma alzada, habilitando el ecosistema de publicidad inteligente (audience-based) comercializable por CPM.',
      scope: '12 tótems nuevos en PAK (Zonas C y D) + 15 en recambio en PLC — cifra a conciliar por ID de posición. Incluye: chasis modular con frentes A/B/AA/AB, media players N100 con Porteus Kiosk, pantallas indoor con táctil capacitivo, cámaras de captura, UPS con tarjeta SNMP, plataforma propia de health check y monitoreo remoto, tótem de laboratorio, certificación de puntos y servicio post-venta con SLA. EXCLUIDO por el Anexo BA-06: obras civiles, puntos eléctricos y de red (los entrega el mall), CMS Broadsign, ad-server, SSP, plataforma de analítica, hosting y licencia Porteus.',
      manager: 'Bryan Valdés — KIMOS',
      team: ['Gerencia comercial', 'Coordinación técnica', 'Control de gestión', 'Preventa técnica', 'Operaciones y servicio', 'Legal y gerencia', 'Ingeniería', 'Logística'],
      tags: ['licitación', 'retail media', 'Chile', 'Colombia', 'llave en mano', 'suma alzada'],
      startDate: '2026-09-08',
      endDate: '2027-05-29',
      currency: 'USD',
      budget: 285000,
      blackouts: [{ id: 'blk-pa-dic', from: '2026-12-01', to: '2026-12-31', label: 'Diciembre bloqueado en PAK (resp. 107): no se pueden realizar trabajos en los centros comerciales' }],
      phases, tasks, milestones, risks, documents, budgetLines, questions, log,
      centers, baseline, service, pricing,
    });

    return { client: cli, project };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. ESTADO, PERSISTENCIA Y FUSIÓN
  // ════════════════════════════════════════════════════════════════════════
  let model = emptyModel();
  let loaded = false;
  let loadError = null;
  let saving = false;
  let lastSync = '';
  const listeners = new Set();
  const emit = () => { const snap = { model, loaded, loadError, saving, lastSync }; listeners.forEach((l) => l(snap)); };

  const TOMB_TTL = 45 * DAY;
  const SAVE_DEBOUNCE = 700;
  const SYNC_ACTIVE = 8000;
  const SYNC_IDLE = 30000;

  const deletedMap = (m) => {
    const map = new Map();
    for (const d of arr(m && m.deleted)) if (d && d.id) map.set(d.id, Date.parse(d.at) || 0);
    return map;
  };

  /** Fusiona dos listas de entidades por id: gana la más reciente por
   *  `updatedAt`, y todo id con lápida más nueva que su edición desaparece. */
  function mergeList(local, remote, tombs) {
    const out = new Map();
    const put = (x) => {
      if (!x || !x.id) return;
      const prev = out.get(x.id);
      if (!prev) { out.set(x.id, x); return; }
      const a = Date.parse(prev.updatedAt) || 0;
      const b = Date.parse(x.updatedAt) || 0;
      if (b > a) out.set(x.id, x);
    };
    arr(local).forEach(put);
    arr(remote).forEach(put);
    const res = [];
    out.forEach((x, id) => {
      const tomb = tombs.get(id);
      if (tomb && tomb >= (Date.parse(x.updatedAt) || 0)) return;
      res.push(x);
    });
    return res;
  }

  function mergeProjects(local, remote, tombs) {
    const merged = mergeList(local, remote, tombs);
    const localById = new Map(arr(local).map((p) => [p.id, p]));
    const remoteById = new Map(arr(remote).map((p) => [p.id, p]));
    return merged.map((p) => {
      const a = localById.get(p.id);
      const b = remoteById.get(p.id);
      if (!a || !b) return p;
      const win = (Date.parse(b.updatedAt) || 0) > (Date.parse(a.updatedAt) || 0) ? b : a;
      return Object.assign({}, win, {
        phases: mergeList(a.phases, b.phases, tombs),
        tasks: mergeList(a.tasks, b.tasks, tombs),
        milestones: mergeList(a.milestones, b.milestones, tombs),
        risks: mergeList(a.risks, b.risks, tombs),
        documents: mergeList(a.documents, b.documents, tombs),
        budgetLines: mergeList(a.budgetLines, b.budgetLines, tombs),
        centers: mergeList(a.centers, b.centers, tombs),
        questions: mergeList(a.questions, b.questions, tombs),
        links: mergeList(a.links, b.links, tombs),
        log: mergeList(a.log, b.log, tombs),
      });
    });
  }

  function mergeModels(local, remote) {
    if (!remote || typeof remote !== 'object') return local;
    const tombs = new Map([...deletedMap(local), ...deletedMap(remote)].map(([k, v]) => [k, v]));
    for (const [k, v] of deletedMap(local)) tombs.set(k, Math.max(v, tombs.get(k) || 0));
    const cut = Date.now() - TOMB_TTL;
    const deleted = [...new Map([...arr(local.deleted), ...arr(remote.deleted)]
      .filter((d) => d && d.id && (Date.parse(d.at) || 0) > cut)
      .map((d) => [d.id, d])).values()];
    const newer = (Date.parse(remote.updatedAt) || 0) > (Date.parse(local.updatedAt) || 0);
    return Object.assign({}, newer ? remote : local, {
      modelVersion: MODEL_VERSION,
      seeded: local.seeded || remote.seeded,
      clients: mergeList(local.clients, remote.clients, tombs),
      projects: mergeProjects(local.projects, remote.projects, tombs),
      sources: mergeList(local.sources, remote.sources, tombs),
      settings: Object.assign({}, remote.settings, local.settings),
      deleted,
    });
  }

  /** Toda la red mutante va en una sola cadena de promesas: nunca se cruza
   *  un guardado con una sincronización. */
  let chain = Promise.resolve();
  const queue = (fn) => { chain = chain.then(fn).catch(() => {}); return chain; };

  async function readRemote() {
    if (!shell.loadData) return null;
    try {
      const raw = await shell.loadData();
      if (!raw || typeof raw !== 'object') return null;
      const payload = raw.pmModel && typeof raw.pmModel === 'object' ? raw.pmModel : raw;
      if (!payload || (!payload.projects && !payload.clients && !payload.modelVersion)) return null;
      return normalizeModel(payload);
    } catch (e) { return null; }
  }

  async function writeRemote(next) {
    if (!shell.saveData) throw new Error('El host no expone saveData: esta app necesita ser multiInstance.');
    await shell.saveData({ pmModel: next, appVersion: APP_VERSION, savedAt: stamp() });
  }

  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saving = true; emit();
      queue(async () => {
        try {
          const remote = await readRemote();
          const next = remote ? mergeModels(model, remote) : model;
          next.updatedAt = stamp();
          model = next;
          await writeRemote(next);
          lastSync = stamp();
          loadError = null;
        } catch (e) {
          loadError = (e && e.message) || 'No se pudo guardar.';
          shell.notify && shell.notify({ level: 'error', text: 'No se pudo guardar el cambio: ' + loadError });
        }
        saving = false; emit();
      });
    }, SAVE_DEBOUNCE);
  }

  /** Firma de lo visible: evita repintar cada pocos segundos si nada cambió. */
  function signature(m) {
    const parts = [m.clients.length, m.sources.length, m.projects.length];
    for (const p of m.projects) {
      parts.push(p.id, p.updatedAt, p.tasks.length, p.risks.length, p.documents.length,
        p.milestones.length, p.log.length,
        p.tasks.reduce((a, t) => a + (Date.parse(t.updatedAt) || 0) + n(t.progress), 0));
    }
    for (const c of m.clients) parts.push(c.id, c.updatedAt);
    return parts.join('|');
  }

  function syncNow() {
    if (saveTimer) return Promise.resolve();
    return queue(async () => {
      const remote = await readRemote();
      if (!remote) return;
      const before = signature(model);
      const next = mergeModels(model, remote);
      model = next;
      lastSync = stamp();
      if (signature(next) !== before) emit();
    });
  }

  /** Mutación: aplica el cambio, sella `updatedAt` y agenda el guardado. */
  function commit(fn, opts) {
    const next = fn(model);
    if (next === false) return;
    model = Object.assign({}, next && typeof next === 'object' ? next : model, { updatedAt: stamp() });
    emit();
    if (!(opts && opts.silent)) scheduleSave();
  }
  const touch = (obj) => Object.assign(obj, { updatedAt: stamp() });
  function tombstone(...ids) {
    model.deleted = arr(model.deleted).concat(ids.filter(Boolean).map((id) => ({ id, at: stamp() })));
  }

  const findProject = (id) => model.projects.find((p) => p.id === id) || null;
  const findClient = (id) => model.clients.find((c) => c.id === id) || null;
  const clientName = (id) => (findClient(id) || {}).name || 'Sin cliente';

  /** Escribe una entrada en la bitácora del proyecto (máx. 400 entradas). */
  function addLog(projectId, kind, text, author) {
    const p = findProject(projectId);
    if (!p || !s(text)) return null;
    const entry = newLog({ kind, text: s(text), author: s(author || '') });
    p.log = [entry].concat(arr(p.log)).slice(0, 400);
    touch(p);
    return entry;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. MÉTRICAS DERIVADAS
  // ════════════════════════════════════════════════════════════════════════
  const taskDone = (t) => t.status === 'done' || n(t.progress) >= 100;
  const taskProgress = (t) => (t.status === 'done' ? 100 : clamp(n(t.progress), 0, 100));

  /** Avance esperado de una tarea a día de hoy según su ventana de fechas.
   *  Es la referencia contra la que se mide la desviación del proyecto. */
  function expectedProgress(t, ref) {
    const st = parseDay(t.startDate), en = parseDay(t.endDate);
    if (!st || !en) return null;
    const now = parseDay(ref || today());
    if (!now) return null;
    if (now <= st) return 0;
    if (now >= en) return 100;
    const total = Math.max(1, en.getTime() - st.getTime());
    return clamp(((now.getTime() - st.getTime()) / total) * 100, 0, 100);
  }

  function riskScore(r) { return clamp(n(r.probability, 3), 1, 5) * clamp(n(r.impact, 3), 1, 5); }
  function riskLevel(r) {
    const sc = riskScore(r);
    if (r.status === 'closed' || r.status === 'mitigated') return 'closed';
    if (sc >= 15) return 'critical';
    if (sc >= 9) return 'serious';
    if (sc >= 5) return 'warn';
    return 'ok';
  }
  const RISK_LEVEL_LABEL = { critical: 'Crítico', serious: 'Alto', warn: 'Medio', ok: 'Bajo', closed: 'Controlado' };
  const riskLevelColor = (lvl) => (lvl === 'critical' ? 'var(--kp-err)' : lvl === 'serious' ? 'var(--kp-serious)'
    : lvl === 'warn' ? 'var(--kp-warn)' : lvl === 'ok' ? 'var(--kp-ok)' : 'var(--kp-muted)');

  function computeProject(p, cfg) {
    const alertDays = n((cfg || {}).alertDays, 7) || 7;
    const tasks = arr(p.tasks);
    const totalWeight = sum(tasks, (t) => Math.max(0.1, n(t.weight, 1)));
    const realWeighted = totalWeight > 0
      ? sum(tasks, (t) => taskProgress(t) * Math.max(0.1, n(t.weight, 1))) / totalWeight
      : null;
    const progress = p.manualProgress != null && p.manualProgress !== ''
      ? clamp(n(p.manualProgress), 0, 100)
      : (realWeighted == null ? 0 : realWeighted);

    let expWeight = 0, expAcc = 0;
    for (const t of tasks) {
      const e = expectedProgress(t);
      if (e == null) continue;
      const w = Math.max(0.1, n(t.weight, 1));
      expWeight += w; expAcc += e * w;
    }
    const expected = expWeight > 0 ? expAcc / expWeight : null;
    const deviation = expected == null ? null : progress - expected;

    const done = tasks.filter(taskDone);
    const overdue = tasks.filter((t) => !taskDone(t) && t.endDate && daysFromToday(t.endDate) < 0);
    const dueSoon = tasks.filter((t) => {
      if (taskDone(t) || !t.endDate) return false;
      const d = daysFromToday(t.endDate);
      return d != null && d >= 0 && d <= alertDays;
    });
    const blocked = tasks.filter((t) => t.status === 'blocked');
    const running = tasks.filter((t) => t.status === 'in_progress');

    const openRisks = arr(p.risks).filter((r) => r.status !== 'closed' && r.status !== 'mitigated');
    const topRisks = openRisks.slice().sort((a, b) => riskScore(b) - riskScore(a));
    const criticalRisks = openRisks.filter((r) => riskScore(r) >= 15);
    const seriousRisks = openRisks.filter((r) => riskScore(r) >= 9 && riskScore(r) < 15);

    const milestones = arr(p.milestones).slice().sort((a, b) => s(a.date).localeCompare(s(b.date)));
    const nextMilestone = milestones.find((mm) => mm.status !== 'done' && mm.date && daysFromToday(mm.date) >= 0)
      || milestones.find((mm) => mm.status !== 'done');
    const lateMilestones = milestones.filter((mm) => mm.status !== 'done' && mm.date && daysFromToday(mm.date) < 0);

    const budgetLines = arr(p.budgetLines);
    const budgetPlanned = sum(budgetLines, (b) => n(b.qty, 0) * n(b.unitCost, 0));
    const budget = n(p.budget, 0) || budgetPlanned;
    // Desvío del costeo contra el presupuesto declarado a mano. El umbral lo
    // fija la configuración de la app: por debajo se vigila, por encima se
    // marca en rojo, porque a esa altura ya no es ruido.
    const declared = n(p.budget, 0);
    const alertPct = n((cfg || {}).budgetAlertPct, 10) || 10;
    const overrun = declared > 0 ? budgetPlanned - declared : null;
    const overrunPct = declared > 0 ? (overrun / declared) * 100 : null;
    const budgetState = declared <= 0 || !budgetLines.length ? 'none'
      : overrunPct > alertPct ? 'over'
        : overrunPct > 0 ? 'watch'
          : 'ok';

    const openQuestions = arr(p.questions).filter((q) => q.status !== 'closed');
    const daysLeft = p.endDate ? daysFromToday(p.endDate) : null;
    const elapsed = (() => {
      const a = daysBetween(p.startDate, today());
      const total = daysBetween(p.startDate, p.endDate);
      if (a == null || total == null || total <= 0) return null;
      return clamp((a / total) * 100, 0, 100);
    })();

    let health = p.healthMode;
    if (!health || health === 'auto') {
      const bad = (deviation != null && deviation <= -20) || criticalRisks.length >= 2
        || (overdue.length >= 5) || (daysLeft != null && daysLeft < 0 && progress < 100);
      const warn = (deviation != null && deviation <= -8) || criticalRisks.length >= 1
        || overdue.length >= 1 || blocked.length >= 1 || lateMilestones.length >= 1;
      health = bad ? 'critical' : warn ? 'at_risk' : 'on_track';
    }

    const docs = arr(p.documents);
    return {
      progress, expected, deviation, elapsed, health,
      tasksTotal: tasks.length, tasksDone: done.length, tasksRunning: running.length,
      tasksOverdue: overdue.length, tasksDueSoon: dueSoon.length, tasksBlocked: blocked.length,
      overdue, dueSoon, blocked,
      risksOpen: openRisks.length, risksCritical: criticalRisks.length, risksSerious: seriousRisks.length,
      topRisks, nextMilestone, lateMilestones: lateMilestones.length,
      milestonesTotal: milestones.length, milestonesDone: milestones.filter((mm) => mm.status === 'done').length,
      milestones, budget, budgetPlanned, docs: docs.length,
      overrun, overrunPct, budgetState, budgetAlertPct: alertPct,
      docsReviewed: docs.filter((d) => d.reviewed).length,
      openQuestions: openQuestions.length, daysLeft,
      isOpen: OPEN_STATUS.includes(p.status),
      isRunning: RUNNING_STATUS.includes(p.status),
    };
  }

  const HEALTH_LABEL = { on_track: 'En rumbo', at_risk: 'En riesgo', critical: 'Crítica' };
  const HEALTH_TOKEN = { on_track: 'ok', at_risk: 'warn', critical: 'err' };
  const healthColor = (hv) => 'var(--kp-' + (HEALTH_TOKEN[hv] || 'muted') + ')';

  function computePortfolio(m, cfg) {
    const projects = arr(m.projects);
    const stats = new Map(projects.map((p) => [p.id, computeProject(p, cfg)]));
    const running = projects.filter((p) => RUNNING_STATUS.includes(p.status));
    const open = projects.filter((p) => OPEN_STATUS.includes(p.status));
    const weightOf = (p) => Math.max(1, n(p.budget, 0) || 1);
    const wTotal = sum(running, weightOf);
    const globalProgress = running.length
      ? (wTotal > 0 ? sum(running, (p) => stats.get(p.id).progress * weightOf(p)) / wTotal
        : sum(running, (p) => stats.get(p.id).progress) / running.length)
      : 0;
    const expectedList = running.map((p) => stats.get(p.id)).filter((x) => x.expected != null);
    const globalExpected = expectedList.length ? sum(expectedList, (x) => x.expected) / expectedList.length : null;

    const byStatus = PROJECT_STATUS.map(([key, label, tok]) => ({
      key, label, tok, value: projects.filter((p) => p.status === key).length,
    })).filter((x) => x.value > 0);
    const byHealth = ['on_track', 'at_risk', 'critical'].map((k) => ({
      key: k, label: HEALTH_LABEL[k], value: running.filter((p) => stats.get(p.id).health === k).length,
    }));

    const upcoming = [];
    for (const p of open) {
      for (const mm of arr(p.milestones)) {
        if (mm.status === 'done' || !mm.date) continue;
        const d = daysFromToday(mm.date);
        if (d == null || d > 60) continue;
        upcoming.push({ project: p, milestone: mm, days: d });
      }
    }
    upcoming.sort((a, b) => a.days - b.days);

    const alerts = [];
    for (const p of open) {
      const st = stats.get(p.id);
      for (const t of st.overdue.slice(0, 4)) {
        alerts.push({ level: 'err', project: p, text: 'Tarea vencida hace ' + Math.abs(daysFromToday(t.endDate)) + ' días: ' + t.name, at: t.endDate });
      }
      for (const r of st.topRisks.filter((x) => riskScore(x) >= 15).slice(0, 3)) {
        alerts.push({ level: 'err', project: p, text: 'Riesgo crítico abierto: ' + r.title, at: '' });
      }
      for (const t of st.blocked.slice(0, 3)) {
        alerts.push({ level: 'warn', project: p, text: 'Tarea bloqueada: ' + t.name, at: '' });
      }
      for (const t of st.dueSoon.slice(0, 3)) {
        alerts.push({ level: 'warn', project: p, text: 'Vence en ' + daysFromToday(t.endDate) + ' días: ' + t.name, at: t.endDate });
      }
      if (st.lateMilestones) {
        alerts.push({ level: 'err', project: p, text: st.lateMilestones + ' hito(s) con fecha vencida sin cerrar', at: '' });
      }
      if (st.openQuestions >= 5) {
        alerts.push({ level: 'warn', project: p, text: st.openQuestions + ' consultas abiertas sin respuesta del cliente', at: '' });
      }
      if (st.budgetState === 'over') {
        alerts.push({
          level: 'err', project: p, at: '',
          text: 'El costeo supera el presupuesto en ' + fmtNum(st.overrunPct, 1) + '% (' + fmtMoney(st.overrun, p.currency) + ')',
        });
      }
    }
    alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'err' ? -1 : 1));

    const budgetByCurrency = new Map();
    for (const p of open) {
      const cur = s(p.currency) || 'CLP';
      budgetByCurrency.set(cur, n(budgetByCurrency.get(cur), 0) + n(p.budget, 0));
    }

    const activity = [];
    for (const p of projects) {
      for (const e of arr(p.log).slice(0, 8)) activity.push({ project: p, entry: e });
    }
    activity.sort((a, b) => s(b.entry.at).localeCompare(s(a.entry.at)));

    return {
      stats, projects, running, open,
      totalProjects: projects.length,
      totalClients: arr(m.clients).length,
      globalProgress, globalExpected,
      byStatus, byHealth, upcoming, alerts,
      budgetByCurrency: [...budgetByCurrency.entries()].map(([cur, val]) => ({ cur, val })),
      tasksOverdue: sum(open, (p) => stats.get(p.id).tasksOverdue),
      tasksDueSoon: sum(open, (p) => stats.get(p.id).tasksDueSoon),
      tasksOpen: sum(open, (p) => stats.get(p.id).tasksTotal - stats.get(p.id).tasksDone),
      risksCritical: sum(open, (p) => stats.get(p.id).risksCritical),
      risksOpen: sum(open, (p) => stats.get(p.id).risksOpen),
      docsTotal: sum(projects, (p) => arr(p.documents).length),
      budgetOver: open.filter((p) => stats.get(p.id).budgetState === 'over').length,
      budgetWatch: open.filter((p) => stats.get(p.id).budgetState === 'watch').length,
      openQuestions: sum(open, (p) => stats.get(p.id).openQuestions),
      activity: activity.slice(0, 40),
    };
  }


  // ════════════════════════════════════════════════════════════════════════
  // 3.b ECONOMÍA: CAPEX, OPEX, CENTROS, MARGEN Y PRECIO
  // ════════════════════════════════════════════════════════════════════════
  /* Un proyecto tiene DOS números que la gente confunde y que aquí nunca se
   * suman a ciegas: el CAPEX es un desembolso único (un stock) y el OPEX un
   * flujo mensual con plazo y reajuste. Y tiene TRES cifras distintas que
   * conviven: el presupuesto escrito a mano en la ficha, la línea base con
   * la que se partió, y el costeo vivo que suman las partidas. La app las
   * mantiene separadas, las compara y explica la diferencia. */

  const lineTotal = (b) => n(b.qty, 0) * n(b.unitCost, 0);
  const isOpex = (b) => s(b.kind) === 'opex';
  const centerOf = (p, id) => arr(p.centers).find((c) => c.id === id) || null;

  /** Reparte una partida compartida entre los centros según la regla del
   *  proyecto: por unidades instaladas, por costo directo o en partes
   *  iguales. Sin centros declarados, todo queda en un único bloque. */
  function allocationWeights(p, rule, directByCenter) {
    const centers = arr(p.centers);
    if (!centers.length) return new Map();
    const w = new Map();
    if (rule === 'equal') {
      centers.forEach((c) => w.set(c.id, 1));
    } else if (rule === 'cost') {
      centers.forEach((c) => w.set(c.id, Math.max(0, n((directByCenter || new Map()).get(c.id), 0))));
    } else {
      centers.forEach((c) => w.set(c.id, Math.max(0, n(c.units, 0))));
    }
    const total = sum([...w.values()]);
    if (total <= 0) { centers.forEach((c) => w.set(c.id, 1 / centers.length)); return w; }
    centers.forEach((c) => w.set(c.id, n(w.get(c.id), 0) / total));
    return w;
  }

  /** Margen recomendado: sale de la envergadura del proyecto y de los
   *  riesgos que el propio proyecto ya declara. Cada sumando lleva su razón
   *  a la vista para poder defenderlo (o bajarlo) frente al cliente. */
  function recommendMargin(p, capexCost, opexMonthly) {
    const size = capexCost + opexMonthly * 12;
    const base = size < 100000 ? 18 : size < 500000 ? 14 : size < 2000000 ? 11 : 9;
    const parts = [{ label: 'Base por envergadura (' + fmtMoney(size, p.currency) + ' a 12 meses)', pts: base }];

    const contract = s((p.pricing || {}).contractType);
    if (contract === 'llave_en_mano' || contract === 'suma_alzada') {
      parts.push({ label: 'Llave en mano a suma alzada: el desvío de alcance lo absorbe el oferente', pts: 3 });
    }
    const offerCurrencies = uniq(arr(p.centers).map((c) => s(c.currency)).filter(Boolean));
    const fxMismatch = offerCurrencies.filter((c) => c !== s(p.currency));
    if (fxMismatch.length) {
      parts.push({ label: 'Exposición cambiaria: se costea en ' + p.currency + ' y se oferta en ' + fxMismatch.join(' y '), pts: 3 });
    }
    if (arr((p.service || {}).penalties).length) {
      parts.push({ label: 'Multas de descuento automático sobre las facturas', pts: 2 });
    }
    const months = n(daysBetween(p.startDate, p.endDate), 0) / 30;
    if (months > 12) parts.push({ label: 'Plazo de ejecución mayor a 12 meses', pts: 1 });
    const criticals = arr(p.risks).filter((r) => r.status !== 'closed' && r.status !== 'mitigated' && riskScore(r) >= 15);
    if (criticals.length) {
      parts.push({ label: criticals.length + ' riesgo(s) crítico(s) abiertos en la matriz', pts: Math.min(3, criticals.length) });
    }
    const openScope = arr(p.risks).some((r) => r.status !== 'closed' && canon(r.title + ' ' + r.mitigation).includes('condicion oculta'));
    if (openScope) parts.push({ label: 'Adicionales por condiciones ocultas sin mecanismo de pago cerrado', pts: 2 });

    const capexPct = clamp(sum(parts, (x) => x.pts), 6, 45);
    // El servicio carga la guardia, el stock y el riesgo de SLA: siempre pide
    // más margen que la inversión, y no menos de 20 puntos en términos absolutos.
    const opexPct = clamp(capexPct + 7, 20, 55);
    return {
      capexPct, opexPct, parts,
      range: [Math.max(6, capexPct - 5), Math.min(50, capexPct + 5)],
    };
  }

  /** Del costo al precio. `sale` = margen sobre venta (precio = costo / (1-m));
   *  `cost` = margen sobre costo (precio = costo × (1+m)). */
  const priceFrom = (cost, pct, mode) => {
    const m = clamp(n(pct, 0), 0, 95) / 100;
    if (mode === 'cost') return cost * (1 + m);
    return m >= 1 ? cost : cost / (1 - m);
  };

  /** El modelo de costeo del servicio: tres escenarios construidos de abajo
   *  hacia arriba, con cada componente a la vista. */
  function serviceModel(p, econ) {
    const svc = normalizeService(p.service);
    const centers = arr(p.centers);
    const units = centers.length ? sum(centers, (c) => n(c.units, 0)) : n(econ.unitCount, 0);
    const techCost = (centerId) => n((arr(svc.techMonthlyCost).find((x) => x.centerId === centerId) || {}).cost, 0);
    const partnerRate = (centerId) => n((arr(svc.partnerPerUnit).find((x) => x.centerId === centerId) || {}).usd, 0);
    const techBase = sum(centers, (c) => techCost(c.id));
    const partnerFull = sum(centers, (c) => partnerRate(c.id) * n(c.units, 0));
    const platformCapex = svc.platformCapexLineId
      ? lineTotal(arr(p.budgetLines).find((b) => b.id === svc.platformCapexLineId) || {})
      : 0;
    const term = Math.max(1, n(svc.termMonths, 12));
    const platform = platformCapex / term;
    const equipment = n(econ.equipmentCost, 0);
    const spares = (equipment * (n(svc.sparesAnnualPct, 0) / 100)) / 12;
    const noc = n(svc.nocMonthly, 0);
    const premium = 1 + n(svc.guardPremiumPct, 0) / 100;

    const comp = (label, value, note) => ({ label, value, note });
    const scenarios = [
      {
        id: 'A', name: 'SLA literal con cuadrilla propia',
        summary: 'Dos técnicos por centro en rotación de guardia para sostener ' + n(svc.slaOnSiteHours, 4) + ' h en sitio ' + s(svc.slaCoverage) + '.',
        components: [
          comp('Técnicos propios (2 por centro, con recargo de guardia del ' + fmtNum(svc.guardPremiumPct) + '%)', techBase * 2 * premium, 'costo empresa mensual por técnico, editable por centro'),
          comp('NOC / monitoreo proactivo', noc, 'prorrateo de un centro de monitoreo compartido'),
          comp('Amortización de la plataforma de monitoreo', platform, platformCapex ? 'ya pagada en CAPEX, se recupera en ' + term + ' meses' : 'sin partida de plataforma enlazada'),
          comp('Reposición de repuestos', spares, fmtNum(svc.sparesAnnualPct, 1) + '% anual sobre el equipamiento'),
        ],
      },
      {
        id: 'B', name: 'Híbrido: propio en horario, partner en guardia',
        summary: 'Un técnico propio por centro en horario de operación y un partner local para la noche y el fin de semana.',
        components: [
          comp('Técnicos propios (1 por centro)', techBase, 'sin recargo de guardia permanente'),
          comp('Partner local para guardia nocturna y fin de semana', partnerFull * clamp(n(svc.partnerNightFactor, 0.75), 0, 2), 'fracción del tarifario por unidad'),
          comp('NOC / monitoreo proactivo', noc, ''),
          comp('Amortización de la plataforma de monitoreo', platform, ''),
          comp('Reposición de repuestos', spares, ''),
        ],
      },
      {
        id: 'C', name: 'Servicio subcontratado por unidad',
        summary: 'Field service local por centro, con supervisión propia parcial. El más barato y el que más riesgo de cumplimiento traslada.',
        components: [
          comp('Partner de field service por unidad', partnerFull, 'tarifa mensual por equipo, por centro'),
          comp('Supervisión propia (0,25 FTE)', techBase * 0.25, 'alguien tiene que responder por el SLA ante el cliente'),
          comp('NOC / monitoreo proactivo', noc, ''),
          comp('Amortización de la plataforma de monitoreo', platform, ''),
          comp('Reposición de repuestos', spares, ''),
        ],
      },
    ].map((sc) => {
      const monthly = sum(sc.components, (c) => c.value);
      return Object.assign(sc, {
        monthly,
        perUnit: units ? monthly / units : 0,
        vsCurrent: econ.opexMonthly ? monthly / econ.opexMonthly : null,
      });
    });

    // Trabajo efectivo del preventivo: lo que de verdad se ejecuta al año.
    const preventiveHours = n(svc.preventivesPerYear, 0) * units * n(svc.hoursPerPreventive, 0);
    const fte = n(svc.hoursPerFte, 1800) > 0 ? preventiveHours / n(svc.hoursPerFte, 1800) : 0;

    // El chequeo top-down que engaña: % anual del fee sobre el equipamiento.
    const annualOpex = econ.opexMonthly * 12;
    const pctOfEquipment = equipment ? (annualOpex / equipment) * 100 : null;

    // Densidad: una guardia 24x7 se amortiza a partir de cierto parque por ciudad.
    const density = centers.map((c) => ({
      center: c, units: n(c.units, 0),
      ratio: n(c.units, 0) / Math.max(1, n(svc.crewBreakevenMin, 150)),
    }));

    // Aritmética del SLA: dónde se contradice el contrato consigo mismo.
    const monthHours = Math.max(1, n(svc.monthHours, 720));
    const levels = (arr(svc.levels).length ? svc.levels : [{ name: 'Comprometido', availabilityPct: n(svc.availabilityPct, 99), onSiteHours: n(svc.slaOnSiteHours, 4) }])
      .map((lv) => {
        const allowedUnit = monthHours * (1 - clamp(n(lv.availabilityPct, 99), 0, 100) / 100);
        const allowedFleet = allowedUnit * Math.max(1, units);
        const hours = n(lv.onSiteHours, n(svc.slaOnSiteHours, 4));
        return {
          name: lv.name, availabilityPct: n(lv.availabilityPct, 99), onSiteHours: hours,
          allowedUnit, allowedFleet,
          survives: hours <= allowedUnit,
          incidentsFleet: hours > 0 ? Math.floor(allowedFleet / hours) : 0,
        };
      });
    const contradiction = levels.find((lv) => !lv.survives) || null;

    const penalties = arr(svc.penalties).map((pn) => ({
      label: pn.label, pctOfFee: n(pn.pctOfFee, 0),
      amount: econ.opexMonthly * (n(pn.pctOfFee, 0) / 100),
    }));

    return {
      svc, units, scenarios, platform, platformCapex, spares, noc, term,
      preventiveHours, fte, pctOfEquipment, annualOpex, density, levels, contradiction, penalties,
      cheapest: scenarios.slice().sort((a, b) => a.monthly - b.monthly)[0],
      recommended: scenarios.find((x) => x.id === 'B') || scenarios[0],
      gapVsCurrent: econ.opexMonthly ? (scenarios.find((x) => x.id === 'B') || scenarios[0]).monthly - econ.opexMonthly : null,
    };
  }

  /** Puente entre la línea base y el costeo vivo: qué bajó, qué subió y por
   *  qué el total terminó donde terminó. Es la respuesta a "explícame esta
   *  diferencia" sin que nadie tenga que rehacer la planilla. */
  function costBridge(p) {
    const baseline = p.baseline && arr(p.baseline.lines).length ? p.baseline : null;
    if (!baseline) return null;
    const lines = arr(p.budgetLines);
    const baseTotal = sum(baseline.lines, lineTotal);
    const currentTotal = sum(lines, lineTotal);
    const rows = [];
    for (const bl of baseline.lines) {
      const matched = lines.filter((x) => x.baselineRef === bl.id);
      const now = sum(matched, lineTotal);
      rows.push({
        id: bl.id, label: bl.item, before: lineTotal(bl), after: now,
        delta: now - lineTotal(bl), lines: matched,
        gone: !matched.length,
      });
    }
    const added = lines.filter((x) => !s(x.baselineRef)).map((x) => ({
      id: x.id, label: x.item, before: 0, after: lineTotal(x), delta: lineTotal(x), lines: [x], isNew: true,
    }));
    const all = rows.concat(added);
    const down = all.filter((r) => r.delta < -0.5).sort((a, b) => a.delta - b.delta);
    const up = all.filter((r) => r.delta > 0.5).sort((a, b) => b.delta - a.delta);
    const flat = all.filter((r) => Math.abs(r.delta) <= 0.5);
    return {
      baseline, baseTotal, currentTotal,
      delta: currentTotal - baseTotal,
      deltaPct: baseTotal ? ((currentTotal - baseTotal) / baseTotal) * 100 : null,
      down, up, flat,
      downTotal: Math.abs(sum(down, (r) => r.delta)),
      upTotal: sum(up, (r) => r.delta),
    };
  }

  /** Todo el cuadro económico del proyecto en una pasada. */
  function computeEconomics(p, cfg) {
    const lines = arr(p.budgetLines);
    const capexLines = lines.filter((b) => !isOpex(b));
    const opexLines = lines.filter(isOpex);
    const capexCost = sum(capexLines, lineTotal);
    const opexMonthly = sum(opexLines, (b) => n(b.unitCost, 0));
    const svc = normalizeService(p.service);
    const term = Math.max(1, n(svc.termMonths, 12));
    // El OPEX del costeo vive con los meses que declara cada línea; el del
    // contrato, con el plazo del servicio. Si difieren, hay que decirlo.
    const opexMonthsDeclared = opexLines.length ? Math.max.apply(null, opexLines.map((b) => n(b.qty, 0))) : 0;
    const opexCostDeclared = sum(opexLines, lineTotal);
    const opexCostTerm = opexMonthly * term;
    const costingTotal = capexCost + opexCostDeclared;

    const equipmentCost = sum(capexLines.filter((b) => s(b.category) === 'equipamiento'), lineTotal);
    const byCategory = LINE_CATEGORIES.map(([key, label]) => ({
      key, label,
      capex: sum(capexLines.filter((b) => s(b.category) === key), lineTotal),
      opex: sum(opexLines.filter((b) => s(b.category) === key), (b) => n(b.unitCost, 0)),
    })).filter((x) => x.capex || x.opex);

    const centers = arr(p.centers);
    const unitCount = centers.length ? sum(centers, (c) => n(c.units, 0)) : 0;

    // Directo por centro y prorrateo de lo compartido.
    const directCapex = new Map();
    const directOpex = new Map();
    centers.forEach((c) => { directCapex.set(c.id, 0); directOpex.set(c.id, 0); });
    let sharedCapex = 0, sharedOpex = 0;
    for (const b of lines) {
      const target = centerOf(p, b.centerId);
      if (!target) {
        if (isOpex(b)) sharedOpex += n(b.unitCost, 0); else sharedCapex += lineTotal(b);
        continue;
      }
      if (isOpex(b)) directOpex.set(target.id, n(directOpex.get(target.id), 0) + n(b.unitCost, 0));
      else directCapex.set(target.id, n(directCapex.get(target.id), 0) + lineTotal(b));
    }
    const rule = s((p.pricing || {}).allocation) || 'units';
    const weights = allocationWeights(p, rule, directCapex);

    const pricing = Object.assign(defaultPricing(), p.pricing || {});
    const recommendation = recommendMargin(p, capexCost, opexMonthly);
    const capexMarginPct = pricing.capexMarginPct == null ? recommendation.capexPct : n(pricing.capexMarginPct, 0);
    const opexMarginPct = pricing.opexMarginPct == null ? recommendation.opexPct : n(pricing.opexMarginPct, 0);
    const mode = s(pricing.marginMode) === 'cost' ? 'cost' : 'sale';

    const byCenter = centers.map((c) => {
      const w = n(weights.get(c.id), 0);
      const capex = n(directCapex.get(c.id), 0) + sharedCapex * w;
      const opex = n(directOpex.get(c.id), 0) + sharedOpex * w;
      const capexPrice = priceFrom(capex, capexMarginPct, mode);
      const opexPrice = priceFrom(opex, opexMarginPct, mode);
      const fx = n(c.fx, 0) || 1;
      return {
        center: c, units: n(c.units, 0), share: w,
        capexCost: capex, opexCost: opex,
        capexPrice, opexPrice,
        capexLocal: capexPrice * fx, opexLocal: opexPrice * fx,
        contractCost: capex + opex * term,
        contractPrice: capexPrice + opexPrice * term,
        contractLocal: (capexPrice + opexPrice * term) * fx,
        perUnit: n(c.units, 0) ? capexPrice / n(c.units, 0) : null,
      };
    });

    const capexPrice = priceFrom(capexCost, capexMarginPct, mode);
    const opexPrice = priceFrom(opexMonthly, opexMarginPct, mode);
    const contractCost = capexCost + opexMonthly * term;
    const contractPrice = capexPrice + opexPrice * term;

    const budget = n(p.budget, 0);
    const alertPct = n((cfg || {}).budgetAlertPct, 10) || 10;
    const overrun = budget > 0 ? costingTotal - budget : null;
    const overrunPct = budget > 0 ? (overrun / budget) * 100 : null;
    const budgetState = budget <= 0 ? 'none'
      : overrunPct > alertPct ? 'over'
        : overrunPct > 0 ? 'watch'
          : 'ok';

    const econ = {
      lines, capexLines, opexLines,
      capexCost, opexMonthly, opexCostDeclared, opexCostTerm, opexMonthsDeclared,
      costingTotal, equipmentCost, byCategory, byCenter, centers, unitCount,
      sharedCapex, sharedOpex, allocationRule: rule,
      pricing, recommendation, capexMarginPct, opexMarginPct, marginMode: mode,
      capexPrice, opexPrice, contractCost, contractPrice, term,
      capexMarginAmount: capexPrice - capexCost,
      opexMarginAmount: (opexPrice - opexMonthly) * term,
      budget, overrun, overrunPct, budgetState, alertPct,
      currency: s(p.currency) || 'USD',
      escalation: { index: s(svc.escalationIndex), pct: n(svc.escalationPct, 0) },
    };
    econ.bridge = costBridge(p);
    econ.service = serviceModel(p, econ);
    return econ;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. ANALISTA: PROPUESTA DE PLAN DE TRABAJO
  // ════════════════════════════════════════════════════════════════════════
  /* El analista lee lo que hay (nombres y tipos de los documentos indexados,
   * las carpetas conectadas, el objetivo y el alcance escritos, las etiquetas
   * y el tipo declarado) y propone un plan de trabajo estructurado: fases,
   * tareas con duración y responsable sugerido, hitos, riesgos típicos y el
   * checklist de documentos que faltan para poder trabajar.
   *
   * Es determinista y explicable: cada propuesta viene con la evidencia que
   * la produjo, y nada se aplica al proyecto hasta que la persona lo aprueba.
   * El agente IA puede llamar a las mismas funciones (PROPOSE_PLAN /
   * APPLY_PLAN) que el botón de la interfaz. */

  const TPL = (id, name, icon, keywords, phases, milestones, risks, expects, note) =>
    ({ id, name, icon, keywords, phases, milestones, risks, expects, note });
  const TK = (name, days, opts) => Object.assign({ name, days: days || 5, weight: 1, priority: 'medium' }, opts || {});
  const PH = (name, offset, tasks) => ({ name, offset, tasks });

  const PLAN_TEMPLATES = [
    TPL('licitacion', 'Licitación / propuesta formal a un cliente', 'briefcase',
      ['licitacion', 'licitación', 'bases', 'rfp', 'rfi', 'pliego', 'terminos y condiciones', 'terminos', 'oferta',
        'propuesta', 'anexo', 'adjudicacion', 'adjudicación', 'consulta', 'respuesta', 'cotizacion', 'suma alzada',
        'llave en mano', 'garantia de seriedad', 'boleta', 'evaluacion tecnica'],
      [
        PH('1 · Estudio de las bases', 0, [
          TK('Inventariar y jerarquizar toda la documentación del proceso', 3, { owner: 'Coordinación técnica', weight: 2, priority: 'high', deliverable: 'Índice documental con jerarquía de prevalencia' }),
          TK('Extraer alcance, exclusiones y frontera de responsabilidades', 4, { owner: 'Preventa técnica', weight: 3, priority: 'critical', deliverable: 'Matriz de alcance: qué provee el cliente y qué el oferente' }),
          TK('Levantar contradicciones entre las bases y las aclaraciones oficiales', 3, { owner: 'Preventa técnica', weight: 2, priority: 'high', deliverable: 'Matriz de contradicciones con el criterio a aplicar' }),
          TK('Listar los documentos faltantes y solicitarlos formalmente por el canal oficial', 2, { owner: 'Gerencia comercial', weight: 2, priority: 'critical' }),
        ]),
        PH('2 · Estrategia y costeo', 8, [
          TK('Construir el costeo por partidas con las exclusiones ya aplicadas', 8, { owner: 'Control de gestión', weight: 3, priority: 'critical', deliverable: 'Costeo por partida en la moneda exigida' }),
          TK('Dimensionar el servicio post-venta y el modelo de SLA sostenible', 6, { owner: 'Operaciones y servicio', weight: 2, priority: 'high' }),
          TK('Cuantificar garantías, pólizas, multas y costo financiero', 4, { owner: 'Finanzas', weight: 2, priority: 'high' }),
          TK('Definir la estrategia de diferenciación y las ventajas competitivas', 5, { owner: 'Gerencia comercial', weight: 2, priority: 'high' }),
        ]),
        PH('3 · Preparación de la oferta', 18, [
          TK('Redactar la oferta técnica con casos de éxito y certificaciones', 8, { owner: 'Preventa técnica', weight: 3, priority: 'critical', deliverable: 'Oferta técnica en PDF' }),
          TK('Construir la carta Gantt de ejecución con la ruta crítica explícita', 4, { owner: 'Coordinación técnica', weight: 2, priority: 'critical', deliverable: 'Carta Gantt' }),
          TK('Preparar la oferta económica en el formulario exigido', 5, { owner: 'Control de gestión', weight: 3, priority: 'critical' }),
          TK('Reunir la documentación administrativa y las garantías', 5, { owner: 'Legal y gerencia', weight: 2, priority: 'high' }),
          TK('Revisión cruzada y control de completitud antes de enviar', 2, { owner: 'Gerencia comercial', weight: 2, priority: 'critical' }),
        ]),
        PH('4 · Entrega, aclaraciones y rondas', 32, [
          TK('Entregar la oferta por el canal oficial y confirmar recepción', 1, { owner: 'Gerencia comercial', weight: 2, priority: 'critical' }),
          TK('Atender consultas, aclaraciones y eventuales rondas adicionales', 10, { owner: 'Preventa técnica', weight: 2, priority: 'high' }),
          TK('Preparar el paquete de mejora para una segunda ronda', 6, { owner: 'Preventa técnica', weight: 2 }),
        ]),
        PH('5 · Negociación y contrato', 46, [
          TK('Redactar el pliego de condiciones contractuales a negociar', 5, { owner: 'Legal y gerencia', weight: 2, priority: 'high' }),
          TK('Negociar y firmar el contrato', 10, { owner: 'Legal y gerencia', weight: 3, priority: 'critical' }),
          TK('Constituir garantías y activar el arranque del proyecto', 5, { owner: 'Finanzas', weight: 2, priority: 'high' }),
        ]),
      ],
      [
        { name: 'Consultas enviadas por el canal oficial', phase: 0 },
        { name: 'Oferta entregada', phase: 2 },
        { name: 'Adjudicación', phase: 3 },
        { name: 'Contrato firmado', phase: 4 },
      ],
      [
        { title: 'Alcance interpretado de más por leer solo las bases y no las aclaraciones oficiales', category: 'Alcance', p: 4, i: 4, mitigation: 'Construir la matriz de alcance sobre las aclaraciones oficiales, que prevalecen, y dejarlas incorporadas literalmente en el contrato.' },
        { title: 'Partidas obligatorias omitidas en el costeo', category: 'Costo', p: 3, i: 4, mitigation: 'Revisar el costeo contra la matriz de alcance partida por partida antes de cerrar el precio.' },
        { title: 'Plazo comprometido que no resiste las ventanas reales de trabajo del cliente', category: 'Plazo', p: 3, i: 4, mitigation: 'Construir la Gantt con las restricciones y bloqueos del cliente reconocidos desde la oferta.' },
        { title: 'Régimen de multas sin tope acumulado ni tolerancia', category: 'Contractual', p: 3, i: 4, mitigation: 'Negociar un tope global de multas y excluir del cómputo los días de bloqueo operacional del propio cliente.' },
        { title: 'Criterios de evaluación reservados por el mandante', category: 'Cliente', p: 3, i: 3, mitigation: 'Cubrir con exceso los ejes que el propio proceso revela como valiosos: plazo, diseño, servicio y cumplimiento normativo.' },
      ],
      [
        { label: 'Bases o términos y condiciones del proceso', keywords: ['bases', 'terminos', 'condiciones', 'rfp', 'pliego'] },
        { label: 'Consultas y respuestas oficiales', keywords: ['respuesta', 'consulta', 'preguntas', 'anexo', 'aclaracion'] },
        { label: 'Formulario económico de cotización', keywords: ['economic', 'cotizacion', 'formulario', 'presupuesto', 'precio'] },
        { label: 'Planos o levantamiento técnico del sitio', keywords: ['plano', 'planimetria', 'levantamiento', 'arq', 'elec', 'infraestructura'] },
        { label: 'Anexos técnicos y estándares del cliente', keywords: ['anexo tecnico', 'estandar', 'norma', 'especificacion'] },
      ],
      'Plan orientado a ganar un proceso formal de compra: primero se entiende qué se pide de verdad, después se costea y recién al final se escribe la oferta.'),

    TPL('implementacion', 'Implementación / despliegue en terreno', 'ruler',
      ['instalacion', 'instalación', 'implementacion', 'despliegue', 'montaje', 'obra', 'terreno', 'plano', 'rack',
        'hardware', 'equipo', 'puesta en marcha', 'as built', 'as-built', 'uat', 'certificacion', 'acometida',
        'canalizacion', 'suministro', 'totem', 'tótem', 'pantalla', 'kiosco'],
      [
        PH('1 · Levantamiento en terreno', 0, [
          TK('Visita técnica y validación punto por punto del layout', 6, { owner: 'Ingeniería', weight: 3, priority: 'critical', deliverable: 'Layout definitivo validado con Operaciones' }),
          TK('Verificar infraestructura existente: energía, red, canalizaciones y espacio', 6, { owner: 'Ingeniería', weight: 3, priority: 'critical' }),
          TK('Registrar condiciones ocultas y levantar los adicionales que correspondan', 3, { owner: 'Coordinación técnica', weight: 2, priority: 'high' }),
        ]),
        PH('2 · Ingeniería de detalle', 8, [
          TK('Diseño de detalle y planos de fabricación', 12, { owner: 'Diseño', weight: 3, priority: 'high', deliverable: 'Planos aprobados' }),
          TK('Especificación de equipamiento y matriz de puertos y destinos', 7, { owner: 'Ingeniería', weight: 2, priority: 'high' }),
          TK('Protocolo de pruebas y criterios de aceptación acordados con el cliente', 5, { owner: 'Calidad', weight: 2, priority: 'high', deliverable: 'Protocolo UAT firmado' }),
        ]),
        PH('3 · Abastecimiento y fabricación', 20, [
          TK('Emisión de órdenes de compra y fabricación', 4, { owner: 'Abastecimiento', weight: 2, priority: 'critical' }),
          TK('Fabricación y control de calidad en origen', 30, { owner: 'Producción', weight: 4, priority: 'critical' }),
          TK('Logística, importación y nacionalización', 20, { owner: 'Logística', weight: 3, priority: 'critical' }),
          TK('Stock inicial de repuestos críticos', 10, { owner: 'Logística', weight: 2 }),
        ]),
        PH('4 · Ejecución en terreno', 55, [
          TK('Habilitación y certificación de puntos', 10, { owner: 'Instalación', weight: 2, priority: 'high' }),
          TK('Montaje, anclaje y conectorización', 20, { owner: 'Instalación', weight: 4, priority: 'critical' }),
          TK('Configuración, enrolamiento y pruebas unitarias por equipo', 10, { owner: 'Instalación', weight: 3, priority: 'high' }),
        ]),
        PH('5 · Puesta en marcha y cierre', 80, [
          TK('Pruebas de aceptación (UAT) y pruebas de estabilidad', 10, { owner: 'Calidad', weight: 3, priority: 'critical' }),
          TK('Dossier as-built, memorias, fichas técnicas y manuales', 12, { owner: 'Calidad', weight: 3, priority: 'critical', deliverable: 'Dossier as-built completo' }),
          TK('Capacitación a los equipos de operación del cliente', 4, { owner: 'Servicio', weight: 1 }),
          TK('Acta de recepción y liberación de retenciones', 3, { owner: 'Gerencia comercial', weight: 2, priority: 'high' }),
        ]),
        PH('6 · Operación y garantía', 95, [
          TK('Puesta en régimen del monitoreo y del tablero de disponibilidad', 8, { owner: 'Servicio', weight: 2, priority: 'high' }),
          TK('Programa de mantenimiento preventivo', 10, { owner: 'Servicio', weight: 2 }),
        ]),
      ],
      [
        { name: 'Layout definitivo aprobado', phase: 0 },
        { name: 'Ingeniería aprobada', phase: 1 },
        { name: 'Equipos en destino', phase: 2 },
        { name: 'Instalación terminada', phase: 3 },
        { name: 'UAT y as-built aprobados', phase: 4 },
      ],
      [
        { title: 'Atraso de fabricación o importación que gatille multas por día', category: 'Plazo', p: 4, i: 5, mitigation: 'Liberar las órdenes de compra apenas se firme, financiar con anticipo y negociar que el conteo parta de la Gantt aprobada.' },
        { title: 'Condiciones ocultas en terreno que obliguen a obras no previstas', category: 'Alcance', p: 3, i: 4, mitigation: 'Definir en el contrato qué constituye condición oculta, con precios unitarios preacordados y plazo de respuesta del cliente.' },
        { title: 'Ventanas de trabajo restringidas o bloqueos de temporada del cliente', category: 'Plazo', p: 4, i: 3, mitigation: 'Reconocer los bloqueos en el cronograma y excluirlos por escrito del cómputo de atraso.' },
        { title: 'Retención de pago por documentación de cierre incompleta', category: 'Contractual', p: 3, i: 3, mitigation: 'Preparar el dossier as-built desde el mes 1 y acordar el checklist de aceptación al inicio.' },
      ],
      [
        { label: 'Planos y planimetría del sitio', keywords: ['plano', 'planimetria', 'arq', 'elec', 'dwg', 'cad'] },
        { label: 'Levantamiento de infraestructura existente', keywords: ['levantamiento', 'catastro', 'infraestructura', 'rack', 'gabinete'] },
        { label: 'Especificación técnica del equipamiento', keywords: ['especificacion', 'ficha', 'datasheet', 'tecnic'] },
        { label: 'Cronograma acordado con el cliente', keywords: ['gantt', 'cronograma', 'programa', 'calendario'] },
      ],
      'Plan de terreno: nada se fabrica antes de que el levantamiento cierre el layout, y el dossier de cierre se arma desde el primer mes.'),

    TPL('software', 'Desarrollo de software o producto digital', 'grid',
      ['software', 'desarrollo', 'app', 'aplicacion', 'plataforma', 'api', 'backlog', 'sprint', 'release',
        'frontend', 'backend', 'base de datos', 'integracion', 'ux', 'wireframe', 'mockup', 'repositorio'],
      [
        PH('1 · Descubrimiento', 0, [
          TK('Entrevistas con usuarios y mapa de procesos actuales', 5, { owner: 'Producto', weight: 2, priority: 'high' }),
          TK('Definición de alcance funcional y criterios de éxito', 4, { owner: 'Producto', weight: 3, priority: 'critical', deliverable: 'Alcance funcional acordado' }),
          TK('Arquitectura técnica e integraciones necesarias', 5, { owner: 'Arquitectura', weight: 2, priority: 'high' }),
        ]),
        PH('2 · Diseño', 7, [
          TK('Flujos, wireframes y diseño de interfaz', 10, { owner: 'Diseño', weight: 3, priority: 'high' }),
          TK('Modelo de datos y contratos de API', 6, { owner: 'Arquitectura', weight: 2, priority: 'high' }),
          TK('Backlog priorizado y estimado', 4, { owner: 'Producto', weight: 2, priority: 'high', deliverable: 'Backlog listo para construir' }),
        ]),
        PH('3 · Construcción', 18, [
          TK('Iteración 1: núcleo funcional', 15, { owner: 'Desarrollo', weight: 4, priority: 'critical' }),
          TK('Iteración 2: funciones de soporte e integraciones', 15, { owner: 'Desarrollo', weight: 4, priority: 'high' }),
          TK('Iteración 3: refinamiento y casos borde', 10, { owner: 'Desarrollo', weight: 3 }),
        ]),
        PH('4 · Calidad y aceptación', 52, [
          TK('Pruebas funcionales, de carga y de seguridad', 10, { owner: 'QA', weight: 3, priority: 'high' }),
          TK('Pruebas de aceptación con usuarios reales', 6, { owner: 'Producto', weight: 3, priority: 'critical' }),
        ]),
        PH('5 · Despliegue y estabilización', 65, [
          TK('Despliegue a producción y migración de datos', 5, { owner: 'Infraestructura', weight: 3, priority: 'critical' }),
          TK('Capacitación y documentación de operación', 5, { owner: 'Producto', weight: 2 }),
          TK('Estabilización y corrección post-lanzamiento', 15, { owner: 'Desarrollo', weight: 2, priority: 'high' }),
        ]),
      ],
      [
        { name: 'Alcance funcional aprobado', phase: 0 },
        { name: 'Diseño aprobado', phase: 1 },
        { name: 'Versión candidata lista', phase: 2 },
        { name: 'Aceptación de usuarios', phase: 3 },
        { name: 'En producción', phase: 4 },
      ],
      [
        { title: 'Alcance que crece durante la construcción', category: 'Alcance', p: 4, i: 4, mitigation: 'Backlog congelado por iteración y control de cambios con impacto explícito en plazo y costo.' },
        { title: 'Integración con sistemas de terceros fuera de control del equipo', category: 'Técnico', p: 3, i: 4, mitigation: 'Probar la integración en la primera iteración, no en la última; acordar ambientes y credenciales al inicio.' },
        { title: 'Aceptación de usuarios sin disponibilidad para probar', category: 'Personas', p: 3, i: 3, mitigation: 'Reservar la agenda de los usuarios que prueban desde la planificación.' },
      ],
      [
        { label: 'Requerimientos o alcance funcional escrito', keywords: ['requerimiento', 'alcance', 'funcional', 'historia', 'backlog'] },
        { label: 'Diseño o wireframes de referencia', keywords: ['diseno', 'wireframe', 'mockup', 'figma', 'ux'] },
        { label: 'Documentación de sistemas a integrar', keywords: ['api', 'integracion', 'documentacion', 'swagger'] },
      ],
      'Plan iterativo: la integración riesgosa se prueba temprano y la aceptación de usuarios tiene fecha propia.'),

    TPL('estudio', 'Estudio, informe o consultoría', 'book',
      ['estudio', 'informe', 'analisis', 'análisis', 'diagnostico', 'diagnóstico', 'investigacion', 'consultoria',
        'reporte', 'auditoria', 'evaluacion', 'benchmark', 'mercado'],
      [
        PH('1 · Encuadre', 0, [
          TK('Acordar preguntas de investigación, alcance y entregables', 3, { owner: 'Dirección del estudio', weight: 3, priority: 'critical' }),
          TK('Plan de trabajo y fuentes de información', 3, { owner: 'Equipo de estudio', weight: 2, priority: 'high' }),
        ]),
        PH('2 · Recolección', 5, [
          TK('Recopilar y ordenar la documentación disponible', 6, { owner: 'Equipo de estudio', weight: 2, priority: 'high' }),
          TK('Entrevistas y levantamiento en terreno', 8, { owner: 'Equipo de estudio', weight: 3 }),
          TK('Validar la calidad y los vacíos de la información', 3, { owner: 'Dirección del estudio', weight: 2, priority: 'high' }),
        ]),
        PH('3 · Análisis', 15, [
          TK('Análisis cruzado y construcción de hallazgos', 10, { owner: 'Equipo de estudio', weight: 4, priority: 'critical', deliverable: 'Hallazgos con evidencia trazable' }),
          TK('Matriz de riesgos y recomendaciones priorizadas', 5, { owner: 'Dirección del estudio', weight: 3, priority: 'high' }),
        ]),
        PH('4 · Redacción y entrega', 27, [
          TK('Redacción del informe con resumen ejecutivo', 8, { owner: 'Dirección del estudio', weight: 4, priority: 'critical', deliverable: 'Informe final' }),
          TK('Revisión editorial y control de consistencia de cifras', 3, { owner: 'Calidad', weight: 2, priority: 'high' }),
          TK('Presentación de resultados y próximos pasos', 2, { owner: 'Dirección del estudio', weight: 2, priority: 'high' }),
        ]),
      ],
      [
        { name: 'Alcance del estudio acordado', phase: 0 },
        { name: 'Información completa recolectada', phase: 1 },
        { name: 'Hallazgos validados', phase: 2 },
        { name: 'Informe entregado', phase: 3 },
      ],
      [
        { title: 'Información incompleta o no entregada por el cliente a tiempo', category: 'Cliente', p: 4, i: 4, mitigation: 'Listar los documentos faltantes al inicio, con responsable y fecha, y escalar apenas se atrasen.' },
        { title: 'Conclusiones sin evidencia trazable', category: 'Calidad', p: 2, i: 4, mitigation: 'Cada hallazgo cita su fuente; revisión cruzada antes de entregar.' },
      ],
      [
        { label: 'Documentación base del objeto de estudio', keywords: ['informe', 'documento', 'antecedente', 'base'] },
        { label: 'Datos o planillas para analizar', keywords: ['data', 'datos', 'planilla', 'csv', 'xls'] },
      ],
      'Plan de estudio: la recolección tiene fecha de cierre propia para que el análisis no arranque con información a medias.'),

    TPL('campana', 'Campaña o lanzamiento comercial', 'sparkles',
      ['campana', 'campaña', 'marketing', 'lanzamiento', 'publicidad', 'contenido', 'redes', 'brief',
        'creatividad', 'pauta', 'evento', 'marca'],
      [
        PH('1 · Brief y estrategia', 0, [
          TK('Brief, objetivos medibles y público objetivo', 3, { owner: 'Marketing', weight: 3, priority: 'critical' }),
          TK('Estrategia de medios y presupuesto', 4, { owner: 'Marketing', weight: 2, priority: 'high' }),
        ]),
        PH('2 · Concepto y producción', 5, [
          TK('Concepto creativo y piezas clave', 8, { owner: 'Creatividad', weight: 3, priority: 'high' }),
          TK('Producción de piezas y adaptaciones por formato', 10, { owner: 'Producción', weight: 3 }),
          TK('Aprobación del cliente y ajustes', 4, { owner: 'Marketing', weight: 2, priority: 'high' }),
        ]),
        PH('3 · Publicación', 20, [
          TK('Carga, programación y control de calidad de las piezas', 4, { owner: 'Medios', weight: 2, priority: 'high' }),
          TK('Salida al aire y monitoreo diario', 20, { owner: 'Medios', weight: 3, priority: 'critical' }),
        ]),
        PH('4 · Medición y cierre', 42, [
          TK('Informe de resultados contra los objetivos del brief', 5, { owner: 'Marketing', weight: 3, priority: 'high', deliverable: 'Informe de campaña' }),
          TK('Aprendizajes y recomendaciones para el próximo ciclo', 2, { owner: 'Marketing', weight: 1 }),
        ]),
      ],
      [
        { name: 'Brief aprobado', phase: 0 },
        { name: 'Piezas aprobadas', phase: 1 },
        { name: 'Campaña al aire', phase: 2 },
        { name: 'Resultados entregados', phase: 3 },
      ],
      [
        { title: 'Aprobaciones del cliente que se atrasan y comprimen la producción', category: 'Cliente', p: 4, i: 3, mitigation: 'Fijar fechas de aprobación en el cronograma y acordar qué ocurre si no llegan.' },
        { title: 'Piezas que no cumplen las especificaciones del medio', category: 'Calidad', p: 3, i: 3, mitigation: 'Validar especificaciones técnicas por formato antes de producir.' },
      ],
      [
        { label: 'Brief o lineamientos de marca', keywords: ['brief', 'marca', 'manual', 'lineamiento'] },
        { label: 'Piezas o material gráfico de referencia', keywords: ['pieza', 'grafica', 'imagen', 'video', 'render'] },
      ],
      'Plan de campaña: las aprobaciones tienen fecha propia porque son la causa más común de atraso.'),

    TPL('generico', 'Proyecto general (inicio, planificación, ejecución, control y cierre)', 'target',
      [],
      [
        PH('1 · Inicio', 0, [
          TK('Acta de constitución: objetivo, alcance, restricciones y patrocinador', 3, { owner: 'Dirección de proyecto', weight: 3, priority: 'critical', deliverable: 'Acta de constitución' }),
          TK('Mapa de partes interesadas y plan de comunicación', 3, { owner: 'Dirección de proyecto', weight: 2, priority: 'high' }),
        ]),
        PH('2 · Planificación', 5, [
          TK('Estructura de desglose del trabajo y cronograma', 6, { owner: 'Dirección de proyecto', weight: 3, priority: 'critical', deliverable: 'Cronograma con ruta crítica' }),
          TK('Presupuesto y plan de recursos', 5, { owner: 'Control de gestión', weight: 3, priority: 'high' }),
          TK('Matriz de riesgos con responsables de mitigación', 4, { owner: 'Dirección de proyecto', weight: 2, priority: 'high' }),
          TK('Plan de calidad y criterios de aceptación', 3, { owner: 'Calidad', weight: 2 }),
        ]),
        PH('3 · Ejecución', 14, [
          TK('Ejecución del trabajo comprometido', 30, { owner: 'Equipo', weight: 4, priority: 'critical' }),
          TK('Coordinación del equipo y gestión de proveedores', 30, { owner: 'Dirección de proyecto', weight: 2, priority: 'high' }),
        ]),
        PH('4 · Seguimiento y control', 14, [
          TK('Reunión de avance y actualización del tablero', 40, { owner: 'Dirección de proyecto', weight: 2, priority: 'high' }),
          TK('Control de cambios, plazo y presupuesto', 40, { owner: 'Control de gestión', weight: 2, priority: 'high' }),
        ]),
        PH('5 · Cierre', 56, [
          TK('Aceptación formal de los entregables', 5, { owner: 'Dirección de proyecto', weight: 3, priority: 'critical' }),
          TK('Documentación final y traspaso a operación', 5, { owner: 'Equipo', weight: 2, priority: 'high' }),
          TK('Lecciones aprendidas y cierre administrativo', 3, { owner: 'Dirección de proyecto', weight: 2 }),
        ]),
      ],
      [
        { name: 'Proyecto constituido', phase: 0 },
        { name: 'Plan aprobado', phase: 1 },
        { name: 'Entregables completos', phase: 2 },
        { name: 'Proyecto cerrado', phase: 4 },
      ],
      [
        { title: 'Objetivo o alcance sin acuerdo escrito con el patrocinador', category: 'Alcance', p: 3, i: 4, mitigation: 'Cerrar el acta de constitución antes de comprometer fechas o presupuesto.' },
        { title: 'Recursos comprometidos en varios proyectos a la vez', category: 'Personas', p: 4, i: 3, mitigation: 'Confirmar la disponibilidad real del equipo en la planificación y reflejarla en el cronograma.' },
        { title: 'Avance informado sin evidencia de entregables', category: 'Calidad', p: 3, i: 3, mitigation: 'Cada tarea tiene un entregable verificable; el avance se mide contra él.' },
      ],
      [
        { label: 'Objetivo y alcance escritos', keywords: ['alcance', 'objetivo', 'acta', 'contrato'] },
        { label: 'Cronograma o carta Gantt', keywords: ['gantt', 'cronograma', 'plan'] },
        { label: 'Presupuesto', keywords: ['presupuesto', 'costo', 'economic'] },
      ],
      'Plan general en cinco fases: sirve cuando el proyecto todavía no declara su tipo o la documentación no alcanza para deducirlo.'),
  ];

  const templateById = (id) => PLAN_TEMPLATES.find((t) => t.id === id) || PLAN_TEMPLATES[PLAN_TEMPLATES.length - 1];

  /** Puntúa cada plantilla contra el texto disponible del proyecto. */
  function detectTemplate(project) {
    const docs = arr(project.documents);
    const haystack = [
      project.name, project.code, project.objective, project.scope, project.type,
      arr(project.tags).join(' '),
      docs.map((d) => d.name + ' ' + d.notes + ' ' + arr(d.tags).join(' ')).join(' '),
      arr(model.sources).filter((x) => !x.projectId || x.projectId === project.id).map((x) => x.label + ' ' + x.path).join(' '),
    ].map(canon).join(' ');

    const scored = PLAN_TEMPLATES.map((tpl) => {
      const hits = [];
      for (const kw of tpl.keywords) {
        const c = canon(kw);
        if (!c) continue;
        let count = 0, from = 0;
        while (from >= 0) {
          const at = haystack.indexOf(c, from);
          if (at < 0) break;
          count++; from = at + c.length;
          if (count > 20) break;
        }
        if (count) hits.push({ word: kw, count });
      }
      hits.sort((a, b) => b.count - a.count);
      const score = sum(hits, (x) => Math.min(6, x.count)) + (canon(project.type) === canon(tpl.id) ? 25 : 0);
      return { tpl, score, hits };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0];
    const runnerUp = scored[1];
    const confidence = best.score <= 0 ? 0
      : clamp(Math.round(((best.score - n(runnerUp && runnerUp.score, 0)) / Math.max(1, best.score)) * 55 + Math.min(45, best.score * 3)), 5, 99);
    return { best: best.score > 0 ? best.tpl : templateById('generico'), score: best.score, hits: best.hits.slice(0, 8), confidence, ranking: scored.slice(0, 4) };
  }

  /** Construye la propuesta completa: fases, tareas fechadas, hitos, riesgos
   *  y checklist de documentos faltantes. No toca el proyecto. */
  function proposePlan(project, opts) {
    const options = Object.assign({ startDate: '', templateId: '', scale: 1 }, opts || {});
    const detected = detectTemplate(project);
    const tpl = options.templateId ? templateById(options.templateId) : detected.best;
    const start = nextWorkday(options.startDate || project.startDate || today(), project.blackouts);
    const scale = clamp(n(options.scale, 1) || 1, 0.25, 4);

    const phases = [];
    const tasks = [];
    const milestones = [];
    let maxEnd = start;

    tpl.phases.forEach((ph, pi) => {
      const phaseId = uid('fas');
      phases.push({ id: phaseId, name: ph.name, order: pi, updatedAt: stamp() });
      const phaseStart = addWorkdays(start, Math.round(n(ph.offset, 0) * scale), project.blackouts);
      let cursor = phaseStart;
      ph.tasks.forEach((tk, ti) => {
        const dur = Math.max(1, Math.round(n(tk.days, 5) * scale));
        // Dentro de una fase las tareas arrancan escalonadas, no en serie
        // estricta: así el plan refleja el trabajo real en paralelo.
        const lag = ti === 0 ? 0 : Math.max(1, Math.round(dur * 0.35));
        const st = addWorkdays(cursor, lag, project.blackouts);
        const en = addWorkdays(st, dur - 1, project.blackouts);
        cursor = st;
        if (en > maxEnd) maxEnd = en;
        tasks.push(newTask({
          phaseId, name: tk.name, startDate: st, endDate: en,
          owner: tk.owner || '', weight: n(tk.weight, 1), priority: tk.priority || 'medium',
          deliverable: tk.deliverable || '',
        }));
      });
    });

    for (const ms of arr(tpl.milestones)) {
      const phaseId = phases[ms.phase] && phases[ms.phase].id;
      const phaseTasks = tasks.filter((t) => t.phaseId === phaseId);
      const date = phaseTasks.length ? phaseTasks.map((t) => t.endDate).sort().pop() : maxEnd;
      milestones.push(newMilestone({ name: ms.name, date, critical: true }));
    }

    const risks = arr(tpl.risks).map((r) => newRisk({
      title: r.title, category: r.category, probability: r.p, impact: r.i, mitigation: r.mitigation,
    }));

    // Documentos esperados que no aparecen en la biblioteca del proyecto.
    const docText = arr(project.documents).map((d) => canon(d.name + ' ' + d.notes + ' ' + arr(d.tags).join(' '))).join(' | ');
    const missing = arr(tpl.expects).filter((ex) => !ex.keywords.some((k) => docText.includes(canon(k))))
      .map((ex) => ({ label: ex.label, why: 'Ningún documento de la biblioteca coincide con ' + ex.keywords.slice(0, 3).map((k) => '"' + k + '"').join(', ') + '.' }));

    const docs = arr(project.documents);
    const byKind = DOC_KINDS.map(([k, label]) => ({ k, label, count: docs.filter((d) => d.kind === k).length }))
      .filter((x) => x.count > 0);

    const notes = [];
    if (!docs.length) notes.push('El proyecto todavía no tiene documentos indexados: el plan se propuso solo con el nombre, el objetivo y las etiquetas. Conecta una carpeta o carga documentos y vuelve a analizar para afinar la propuesta.');
    if (arr(project.blackouts).length) notes.push('Se respetaron ' + arr(project.blackouts).length + ' ventana(s) bloqueada(s) del proyecto: ninguna tarea cae dentro de ellas.');
    notes.push('Las fechas evitan sábados y domingos. La duración total propuesta es de ' + (daysBetween(start, maxEnd) || 0) + ' días corridos, del ' + fmtDay(start) + ' al ' + fmtDay(maxEnd) + '.');
    if (arr(project.tasks).length) notes.push('El proyecto ya tiene ' + arr(project.tasks).length + ' tarea(s). Puedes añadir el plan propuesto sin tocarlas o reemplazar el plan completo.');

    return {
      templateId: tpl.id, templateName: tpl.name, templateIcon: tpl.icon, templateNote: tpl.note,
      confidence: options.templateId && options.templateId !== detected.best.id ? null : detected.confidence,
      evidence: detected.hits, ranking: detected.ranking.map((r) => ({ id: r.tpl.id, name: r.tpl.name, score: r.score })),
      docsByKind: byKind, docsTotal: docs.length,
      phases, tasks, milestones, risks, missing, notes,
      start, end: maxEnd, generatedAt: stamp(),
    };
  }

  /** Aplica una propuesta al proyecto. mode: 'append' | 'replace'. */
  function applyProposal(projectId, proposal, mode, parts) {
    const p = findProject(projectId);
    if (!p || !proposal) return false;
    const want = Object.assign({ plan: true, milestones: true, risks: true }, parts || {});
    if (mode === 'replace' && want.plan) {
      tombstone(...arr(p.phases).map((x) => x.id), ...arr(p.tasks).map((x) => x.id));
      p.phases = []; p.tasks = [];
    }
    if (want.plan) {
      const base = arr(p.phases).length;
      const phases = proposal.phases.map((f, i) => Object.assign({}, f, { order: base + i }));
      p.phases = arr(p.phases).concat(phases);
      p.tasks = arr(p.tasks).concat(proposal.tasks.map((t) => Object.assign({}, t, { updatedAt: stamp() })));
    }
    if (want.milestones) {
      const known = new Set(arr(p.milestones).map((mm) => canon(mm.name)));
      p.milestones = arr(p.milestones).concat(proposal.milestones.filter((mm) => !known.has(canon(mm.name))));
    }
    if (want.risks) {
      const known = new Set(arr(p.risks).map((r) => canon(r.title)));
      p.risks = arr(p.risks).concat(proposal.risks.filter((r) => !known.has(canon(r.title))));
    }
    if (want.plan && arr(p.tasks).length) {
      const ends = arr(p.tasks).map((t) => t.endDate).filter(Boolean).sort();
      const starts = arr(p.tasks).map((t) => t.startDate).filter(Boolean).sort();
      if (starts.length && (!p.startDate || starts[0] < p.startDate)) p.startDate = starts[0];
      if (ends.length && (!p.endDate || ends[ends.length - 1] > p.endDate)) p.endDate = ends[ends.length - 1];
    }
    p.type = p.type || proposal.templateId;
    touch(p);
    addLog(projectId, 'system', 'El analista propuso un plan del tipo "' + proposal.templateName + '" y se ' +
      (mode === 'replace' ? 'reemplazó el plan existente' : 'añadió al plan existente') + ': ' +
      proposal.phases.length + ' fases, ' + proposal.tasks.length + ' tareas, ' +
      proposal.milestones.length + ' hitos y ' + proposal.risks.length + ' riesgos tipo.', 'Analista');
    return true;
  }


  // ════════════════════════════════════════════════════════════════════════
  // 4.b ANALISTA: PREGUNTAS SOBRE EL PROYECTO
  // ════════════════════════════════════════════════════════════════════════
  /* El analista responde preguntas sobre el proyecto con los números del
   * proyecto. No inventa: cada cifra de cada respuesta sale de las partidas,
   * las tareas, los riesgos o los parámetros del modelo de servicio, y las
   * conclusiones son reglas explícitas sobre esas cifras. Las respuestas se
   * arman con bloques que se pintan en pantalla y también se serializan a
   * texto plano, para que el agente IA de KIMOS entregue exactamente el
   * mismo análisis cuando le preguntan por chat. */

  const B = {
    h: (text) => ({ t: 'h', text }),
    p: (text) => ({ t: 'p', text }),
    note: (text, tone) => ({ t: 'note', text, tone }),
    list: (items, ordered) => ({ t: 'list', items: arr(items).filter(Boolean), ordered }),
    kv: (items) => ({ t: 'kv', items: arr(items).filter(Boolean) }),
    table: (head, rows, opts) => Object.assign({ t: 'table', head, rows: arr(rows).filter(Boolean) }, opts || {}),
    concl: (text) => ({ t: 'concl', text }),
    bars: (items, opts) => Object.assign({ t: 'bars', items: arr(items).filter(Boolean) }, opts || {}),
  };

  /** Serializa una respuesta a texto plano (lo que recibe el agente IA). */
  function blocksToText(blocks) {
    const out = [];
    for (const b of arr(blocks)) {
      if (!b) continue;
      if (b.t === 'h') out.push('\n## ' + b.text);
      else if (b.t === 'p') out.push(b.text);
      else if (b.t === 'note') out.push('> ' + b.text);
      else if (b.t === 'concl') out.push('\nLO QUE ESTO SIGNIFICA\n' + b.text);
      else if (b.t === 'list') out.push(b.items.map((x, i) => (b.ordered ? (i + 1) + '. ' : '- ') + x).join('\n'));
      else if (b.t === 'kv') out.push(b.items.map((x) => x.k + ': ' + x.v).join('\n'));
      else if (b.t === 'table') {
        out.push([b.head.join(' | ')].concat(b.rows.map((r) => r.map((c) => s(c && c.v != null ? c.v : c)).join(' | '))).join('\n'));
      } else if (b.t === 'bars') {
        out.push(b.items.map((x) => x.label + ': ' + (x.display || fmtNum(x.value))).join('\n'));
      }
    }
    return out.join('\n\n').trim();
  }

  const money0 = (v, cur) => fmtNum(Math.round(n(v, 0))) + (cur ? ' ' + cur : '');
  const signed = (v) => (n(v, 0) >= 0 ? '+' : '−') + fmtNum(Math.abs(Math.round(n(v, 0))));

  // ── Análisis 1: presupuesto vs. costeo por líneas ───────────────────────
  function analysisBudgetVsCosting(p, ctx) {
    const e = ctx.econ;
    const cur = e.currency;
    const out = [];
    const budget = e.budget;
    const bridge = e.bridge;

    out.push(B.h('Qué es cada uno'));
    out.push(B.p('**Presupuesto (' + money0(budget) + ')**: es un campo manual que se escribe en la ficha del proyecto. ' +
      (bridge
        ? 'Quedó cargado con el presupuesto de referencia de «' + bridge.baseline.label + '» — ' + money0(bridge.baseTotal) + ' ' + cur +
          (Math.abs(budget - bridge.baseTotal) > 0.5 ? ', redondeado a ' + money0(budget) + '.' : '.')
        : 'No hay línea base guardada contra la cual contrastarlo.')));
    out.push(B.p('**Costeo por líneas (' + money0(e.costingTotal) + ')**: es la suma automática de las ' + e.lines.length +
      ' partidas de la tabla de costeo: Σ (cantidad × costo unitario). Ese total es el costeo vivo, el que se mueve cada vez que se corrige una partida.'));
    out.push(B.note('En el modelo son variables independientes: el presupuesto solo se reemplaza por el costeo cuando el campo está vacío. ' +
      'Con un valor cargado a mano, la app nunca lo sobrescribe — la leyenda bajo el campo es un comparador, no una validación. Por eso conviven.'));

    const diff = e.costingTotal - budget;
    if (budget > 0) {
      out.push(B.kv([
        { k: 'Presupuesto declarado', v: money0(budget, cur) },
        { k: 'Costeo por líneas', v: money0(e.costingTotal, cur) },
        { k: 'Diferencia', v: signed(diff) + ' ' + cur + (e.overrunPct == null ? '' : ' (' + (e.overrunPct >= 0 ? '+' : '') + fmtNum(e.overrunPct, 1) + '%)') },
      ]));
    }

    if (bridge) {
      out.push(B.h('De dónde sale la diferencia'));
      if (bridge.down.length) {
        out.push(B.p('**Bajan ' + bridge.down.length + ' partida(s), por ' + money0(bridge.downTotal, cur) + ':**'));
        out.push(B.table(['Ajuste', 'Antes', 'Ahora', 'Δ'],
          bridge.down.map((r) => [
            r.gone ? r.label + ' (eliminada)' : r.label + (r.lines.length > 1 ? ' → ' + r.lines.map((x) => x.item.split(' — ')[0]).join(' + ') : ''),
            { v: money0(r.before), num: true },
            { v: money0(r.after), num: true },
            { v: signed(r.delta), num: true, tone: 'ok' },
          ]),
          { footer: ['Total que baja', '', '', { v: '−' + money0(bridge.downTotal), num: true, tone: 'ok' }] }));
      }
      if (bridge.up.length) {
        out.push(B.p('**Suben ' + bridge.up.length + ' partida(s), por ' + money0(bridge.upTotal, cur) + ':**'));
        out.push(B.table(['Partida', 'Monto', 'Origen'],
          bridge.up.map((r) => [
            r.isNew ? r.label + ' (nueva)' : r.label,
            { v: signed(r.delta), num: true, tone: 'err' },
            (r.lines[0] && r.lines[0].note) || (r.isNew ? 'partida ausente en la línea base' : 'ajuste sobre la línea base'),
          ]),
          { footer: ['Total que sube', { v: '+' + money0(bridge.upTotal), num: true, tone: 'err' }, ''] }));
      }
      out.push(B.p(money0(bridge.baseTotal) + ' − ' + money0(bridge.downTotal) + ' + ' + money0(bridge.upTotal) + ' = **' + money0(bridge.currentTotal) + '**'));

      out.push(B.bars([
        { key: 'base', label: bridge.baseline.label, value: Math.round(bridge.baseTotal), display: money0(bridge.baseTotal), color: 'var(--kp-muted)' },
        { key: 'now', label: 'Costeo vivo', value: Math.round(bridge.currentTotal), display: money0(bridge.currentTotal), color: 'var(--kp-s1)' },
        budget > 0 ? { key: 'bud', label: 'Presupuesto en la ficha', value: Math.round(budget), display: money0(budget), color: 'var(--kp-s2)' } : null,
      ]));

      const ratio = bridge.downTotal > 0 ? bridge.upTotal / bridge.downTotal : null;
      out.push(B.concl('Lo que se sacó del alcance ahorra ' + money0(bridge.downTotal, cur) + ', pero las partidas que faltaban cuestan ' +
        money0(bridge.upTotal, cur) + '. El neto es ' + (bridge.deltaPct >= 0 ? '+' : '') + fmtNum(bridge.deltaPct, 0) + '% sobre la referencia. ' +
        (ratio && ratio > 1.5
          ? 'Dicho de otro modo: el costeo previo no estaba caro por lo que sobraba, estaba barato por lo que faltaba — y lo que faltaba pesa ' +
            fmtNum(ratio, 1) + ' veces más que lo que sobraba.'
          : 'Las correcciones en ambos sentidos son del mismo orden: la referencia estaba bien dimensionada y lo que cambió fue la composición.')));
    } else {
      out.push(B.note('Este proyecto todavía no tiene línea base guardada. Con el botón «Fijar línea base» de la pestaña Economía se congela el costeo actual como referencia; ' +
        'desde ahí, cada corrección queda explicada partida por partida.', 'warn'));
    }

    if (e.opexLines.length) {
      out.push(B.h('Un aviso sobre ese total'));
      out.push(B.p('Los ' + money0(e.costingTotal, cur) + ' mezclan dos cosas que no se suman: **' + money0(e.capexCost, cur) +
        ' de CAPEX** (un desembolso único) y **' + money0(e.opexCostDeclared, cur) + ' de OPEX** (' + fmtNum(e.opexMonthly) + ' al mes por ' +
        fmtNum(e.opexMonthsDeclared) + ' meses). Es un stock más un flujo: sirve para dimensionar, no para decidir. La pregunta «¿cuánto cuesta el contrato?» se responde en la pestaña Economía, con el plazo de servicio real.'));
    }
    return out;
  }

  // ── Análisis 2: CAPEX, OPEX y el modelo de servicio ─────────────────────
  function analysisCapexOpex(p, ctx) {
    const e = ctx.econ;
    const sm = e.service;
    const cur = e.currency;
    const out = [];

    out.push(B.h('Costo no es precio'));
    out.push(B.p('Las ' + e.lines.length + ' líneas suman ' + money0(e.costingTotal, cur) + ' de **costo**. Ahí no hay margen, ni utilidad, ni cobertura del riesgo cambiario, ni prima por el tipo de contrato. ' +
      'Ofertar ese número es trabajar gratis en el mejor escenario y perder en el escenario probable. El precio se arma en «Precio final».'));
    out.push(B.kv([
      { k: 'CAPEX (desembolso único)', v: money0(e.capexCost, cur) },
      { k: 'OPEX (flujo mensual)', v: money0(e.opexMonthly, cur) + ' / mes' },
      { k: 'Plazo de servicio declarado', v: sm.term + ' meses' + (e.opexMonthsDeclared && e.opexMonthsDeclared !== sm.term ? ' · las líneas de OPEX están cargadas a ' + fmtNum(e.opexMonthsDeclared) + ' meses' : '') },
      { k: 'Costo del contrato completo', v: money0(e.contractCost, cur) },
    ]));
    if (e.opexMonthsDeclared && sm.term && e.opexMonthsDeclared !== sm.term) {
      out.push(B.note('El plazo del servicio (' + sm.term + ' meses) y los meses cargados en las líneas de OPEX (' + fmtNum(e.opexMonthsDeclared) +
        ') no coinciden. Mientras difieran, el costeo y el contrato hablan de cosas distintas.', 'warn'));
    }

    if (!e.opexLines.length) {
      out.push(B.note('Este proyecto no tiene líneas de OPEX declaradas: no hay servicio recurrente que analizar. Marca como OPEX las partidas de servicio en la pestaña Economía.', 'warn'));
      return out;
    }

    out.push(B.h('Por qué el OPEX es la línea que menos resiste'));
    if (sm.pctOfEquipment != null) {
      const band = sm.pctOfEquipment >= 12 && sm.pctOfEquipment <= 20;
      out.push(B.p('**El chequeo que engaña.** ' + money0(sm.annualOpex, cur) + ' al año sobre ' + money0(e.equipmentCost, cur) +
        ' de equipamiento es ' + fmtNum(sm.pctOfEquipment, 1) + '% anual. En contratos de mantenimiento con repuestos incluidos, la banda normal va de 12% a 20%. ' +
        (band || sm.pctOfEquipment > 20
          ? 'A primera vista el número está dentro de rango —o incluso alto— y uno lo da por bueno. Ese chequeo de arriba hacia abajo no aplica acá, y esa es exactamente la trampa.'
          : 'El número queda por debajo de la banda, lo que ya es una señal.')));
    }
    out.push(B.p('**El problema real es la densidad, no el volumen de trabajo.** La regla del porcentaje supone que el costo escala con la cantidad de equipos. ' +
      'Con un SLA de ' + fmtNum(sm.svc.slaOnSiteHours) + ' horas en sitio ' + s(sm.svc.slaCoverage) + ', el costo no lo manda el trabajo: lo manda tener a alguien de guardia. ' +
      'Y la guardia se paga igual con ' + fmtNum(sm.units) + ' equipos que con 200.'));
    if (sm.density.length) {
      out.push(B.table(['Centro', 'Equipos', 'Punto de equilibrio de una cuadrilla 24x7', 'Distancia'],
        sm.density.map((d) => [
          d.center.name + (d.center.country ? ' · ' + d.center.country : ''),
          { v: fmtNum(d.units), num: true },
          fmtNum(sm.svc.crewBreakevenMin) + '–' + fmtNum(sm.svc.crewBreakevenMax) + ' equipos por ciudad',
          { v: d.units ? fmtNum(sm.svc.crewBreakevenMin / Math.max(1, d.units), 0) + '× por debajo' : '—', tone: 'err' },
        ])));
    }
    out.push(B.p('El trabajo efectivo lo confirma: los ' + fmtNum(sm.svc.preventivesPerYear) + ' preventivos anuales sobre ' + fmtNum(sm.units) +
      ' equipos son ' + fmtNum(sm.preventiveHours) + ' horas-hombre al año, es decir ' + fmtNum(sm.fte, 1) + ' FTE. ' +
      'Pero para cumplir ' + fmtNum(sm.svc.slaOnSiteHours) + ' horas en sitio un domingo de madrugada hace falta gente disponible los 365 días. Se paga capacidad instalada, no horas trabajadas.'));

    out.push(B.h('Modelo bottom-up'));
    out.push(B.p('Tres formas de sostener el servicio. Los valores unitarios son **supuestos de modelación** editables en la pestaña Economía: hay que reemplazarlos por cotizaciones reales antes de ofertar.'));
    out.push(B.table(['Escenario', 'Estructura', cur + '/mes', 'vs. fee actual', 'Por equipo/mes'],
      sm.scenarios.map((sc) => [
        sc.id + ' — ' + sc.name,
        sc.summary,
        { v: money0(sc.monthly), num: true, strong: true },
        { v: sc.vsCurrent == null ? '—' : fmtNum(sc.vsCurrent, 1) + '×', num: true, tone: sc.vsCurrent > 1.1 ? 'err' : 'ok' },
        { v: money0(sc.perUnit), num: true },
      ])));
    out.push(B.p('El fee cargado hoy en el costeo son ' + money0(e.opexMonthly, cur) + ' al mes, equivalentes a ' +
      money0(sm.units ? e.opexMonthly / sm.units : 0, cur) + ' por equipo al mes. ' +
      (sm.cheapest && sm.cheapest.monthly > e.opexMonthly
        ? 'Ni siquiera el escenario más barato (' + sm.cheapest.id + ', ' + money0(sm.cheapest.monthly) + ') llega ahí — y ese escenario tiene su propio riesgo: a ese precio un partner rara vez honra de verdad el SLA de madrugada.'
        : 'El fee cargado alcanza para el escenario más barato; conviene igual verificar que el partner honre el SLA comprometido.')));
    return out;
  }

  // ── Análisis 3: la aritmética del SLA ───────────────────────────────────
  function analysisSla(p, ctx) {
    const e = ctx.econ;
    const sm = e.service;
    const out = [];
    if (!sm.levels.length) {
      out.push(B.note('Este proyecto no declara niveles de servicio. Cárgalos en el modelo de servicio de la pestaña Economía y la app calcula si el SLA se sostiene.', 'warn'));
      return out;
    }
    out.push(B.h('La contradicción que nadie mira'));
    out.push(B.p('En un mes de ' + fmtNum(sm.svc.monthHours) + ' horas, una disponibilidad comprometida deja un margen de caída muy chico. ' +
      'Si el tiempo de resolución en sitio es mayor que ese margen, **un solo incidente resuelto exactamente en el plazo comprometido ya incumple el indicador de disponibilidad**: el SLA se contradice a sí mismo.'));
    out.push(B.table(['Nivel', 'Disponibilidad', 'Caída permitida/mes', 'Resolución comprometida', '¿Sobrevive un incidente en plazo?'],
      sm.levels.map((lv) => [
        lv.name,
        { v: fmtNum(lv.availabilityPct, 1) + '%', num: true },
        { v: fmtNum(lv.allowedUnit, 1) + ' h', num: true },
        { v: fmtNum(lv.onSiteHours, 1) + ' h', num: true },
        { v: lv.survives ? 'Sí' : 'No — ' + fmtNum(lv.onSiteHours, 1) + ' h ya lo rompe', tone: lv.survives ? 'ok' : 'err' },
      ])));
    out.push(B.h('Por equipo o sobre la flota: el factor que lo decide todo'));
    const lv0 = sm.contradiction || sm.levels[0];
    out.push(B.p('Todo depende de una definición que las bases del contrato normalmente no dan: **¿la disponibilidad se mide por equipo o sobre la flota completa?**'));
    out.push(B.list([
      'Por equipo: ' + fmtNum(lv0.allowedUnit, 1) + ' h al mes. ' + (lv0.survives ? 'Alcanza para un incidente en plazo.' : 'Inalcanzable por construcción.'),
      'Sobre la flota: ' + fmtNum(sm.units) + ' × ' + fmtNum(sm.svc.monthHours) + ' h = ' + fmtNum(sm.units * sm.svc.monthHours) +
        ' equipo-hora, y el ' + fmtNum(100 - lv0.availabilityPct, 1) + '% son ' + fmtNum(lv0.allowedFleet, 0) +
        ' horas al mes. Equivale a unos ' + fmtNum(lv0.incidentsFleet) + ' incidentes de ' + fmtNum(lv0.onSiteHours, 0) + ' horas. Holgado.',
    ]));
    out.push(B.p('Entre una lectura y la otra hay un factor de **' + fmtNum(sm.units) + '**. Es el punto más importante que cerrar por escrito, y va antes que cualquier discusión de precio.'));
    if (sm.penalties.length) {
      out.push(B.h('Y las multas, en perspectiva'));
      out.push(B.table(['Multa', '% del fee mensual', 'Monto'],
        sm.penalties.map((pn) => [pn.label, { v: fmtNum(pn.pctOfFee, 1) + '%', num: true }, { v: money0(pn.amount, e.currency), num: true }])));
      const maxPen = Math.max.apply(null, sm.penalties.map((x) => x.amount));
      const gap = sm.gapVsCurrent;
      if (gap != null && gap > maxPen) {
        out.push(B.concl('La multa más cara son ' + money0(maxPen, e.currency) + ' al mes. Sostener el SLA comprometido cuesta ' + money0(gap, e.currency) +
          ' al mes más de lo que hay cargado. Lo caro nunca fue la multa: es el costo de cumplir. Y eso invierte la lógica — no se está comprando un seguro contra multas, se está vendiendo una capacidad operativa que hoy no está pagada.'));
      }
    }
    return out;
  }

  // ── Análisis 4: palancas y vacíos del servicio ──────────────────────────
  function analysisServiceLevers(p, ctx) {
    const e = ctx.econ;
    const sm = e.service;
    const out = [];
    out.push(B.h('Las palancas, en orden de rendimiento'));
    const levers = [];
    if (sm.contradiction) {
      levers.push('**Definir la fórmula de disponibilidad a nivel de flota.** No cuesta nada y vale un factor ' + fmtNum(sm.units) + '.');
    }
    levers.push('**Renegociar la escala de SLA.** Contraoferta natural: el tiempo comprometido en horario de operación y una ventana mayor fuera de horario, ' +
      'y distinguir *restauración de servicio* (vuelve a operar) de *reparación definitiva* (queda como nuevo). El SLA se mide contra la primera.');
    levers.push('**Diseñar la redundancia en el CAPEX para bajar el OPEX.** Equipo de reemplazo en caliente, respaldo con bypass, unidades con dos reproductores independientes. ' +
      'Una falla deja de ser caída total y pasa a ser degradación — que no computa igual, si el contrato lo dice.');
    if (sm.platformCapex) {
      levers.push('**Cobrar el retorno de los ' + money0(sm.platformCapex, e.currency) + ' de la plataforma de monitoreo.** Buena parte de los incidentes se resuelven en remoto, sin mover a nadie. ' +
        'Esa plataforma ya está pagada en CAPEX y es lo que hace viable el correctivo: úsala como argumento técnico y como reductor de visitas.');
    }
    levers.push('**Comprar densidad prestada.** Un partner que ya tiene cuadrilla ' + s(sm.svc.slaCoverage) + ' para otros clientes en las mismas ciudades vende el margen de su densidad. ' +
      'Es la única forma de acercarse al escenario subcontratado sin regalar el SLA.');
    const stock = e.capexLines.find((b) => s(b.category) === 'logistica');
    if (stock) {
      levers.push('**Aprovechar el stock de repuestos que ya está en CAPEX** (' + money0(lineTotal(stock), e.currency) + '). Evita compras de urgencia y flete aéreo; ' +
        'solo la reposición del consumo (≈' + money0(sm.spares, e.currency) + '/mes) es recurrente.');
    }
    out.push(B.list(levers, true));

    out.push(B.h('Dos cosas que faltan definir'));
    const gaps = [];
    gaps.push('**El plazo del servicio.** Está en ' + sm.term + ' meses. Lo lógico es que sea coterminal con la garantía del equipamiento, para que garantía y servicio venzan juntos ' +
      'y no se termine cubriendo con fee un período de garantía ya vencido. Si el plazo sube, la línea de OPEX del costeo deja de ser ' +
      fmtNum(e.opexMonthsDeclared) + ' meses y pasa a ser ' + sm.term + '.');
    gaps.push('**El reajuste.** ' + (s(sm.svc.escalationIndex) === 'ninguno' || !n(sm.svc.escalationPct, 0)
      ? 'Hoy no hay cláusula de reajuste declarada. Un fee mensual en moneda local durante ' + sm.term + ' meses sin reajuste (UF o IPC) pierde valor real todos los meses: sin esa cláusula, el último año se presta a pérdida aunque el primero esté bien calculado.'
      : 'Declarado: ' + s(sm.svc.escalationIndex) + ' al ' + fmtNum(sm.svc.escalationPct, 1) + '% anual. Verifica que el contrato lo recoja con la misma fórmula y periodicidad.'));
    out.push(B.list(gaps));
    return out;
  }

  // ── Análisis 5: precio final, margen y monedas ──────────────────────────
  function analysisPrice(p, ctx) {
    const e = ctx.econ;
    const cur = e.currency;
    const out = [];
    const rec = e.recommendation;
    const modeLabel = e.marginMode === 'cost' ? 'sobre costo' : 'sobre venta';

    out.push(B.h('Del costo al precio'));
    out.push(B.p('El costeo entrega ' + money0(e.costingTotal, cur) + '. El precio se construye aplicando margen **' + modeLabel +
      '** por separado a la inversión y al servicio, porque no cargan el mismo riesgo: el CAPEX se ejecuta una vez y el fee se sostiene ' + e.term + ' meses.'));
    out.push(B.table(['Concepto', 'Costo', 'Margen', 'Precio'],
      [
        ['CAPEX', { v: money0(e.capexCost, cur), num: true }, { v: fmtNum(e.capexMarginPct, 1) + '%', num: true }, { v: money0(e.capexPrice, cur), num: true, strong: true }],
        ['Fee mensual', { v: money0(e.opexMonthly, cur), num: true }, { v: fmtNum(e.opexMarginPct, 1) + '%', num: true }, { v: money0(e.opexPrice, cur), num: true, strong: true }],
        ['Fee anual', { v: money0(e.opexMonthly * 12, cur), num: true }, '', { v: money0(e.opexPrice * 12, cur), num: true }],
        ['Contrato completo (' + e.term + ' meses)', { v: money0(e.contractCost, cur), num: true }, '', { v: money0(e.contractPrice, cur), num: true, strong: true }],
      ],
      { footer: ['Utilidad esperada del contrato', '', '', { v: money0(e.contractPrice - e.contractCost, cur), num: true, tone: 'ok', strong: true }] }));

    out.push(B.h('Por qué ese margen y no otro'));
    out.push(B.p('La app propone **' + fmtNum(rec.capexPct, 1) + '% para el CAPEX** y **' + fmtNum(rec.opexPct, 1) + '% para el servicio** ' +
      '(rango razonable de negociación: ' + fmtNum(rec.range[0], 0) + '% a ' + fmtNum(rec.range[1], 0) + '%). Cada sumando sale de algo que el propio proyecto ya declara:'));
    out.push(B.table(['Factor', 'Puntos'],
      rec.parts.map((x) => [x.label, { v: '+' + fmtNum(x.pts, 1) + ' pts', num: true }]),
      { footer: ['Margen recomendado para el CAPEX', { v: fmtNum(rec.capexPct, 1) + '%', num: true, strong: true }] }));
    out.push(B.p('El servicio va ' + fmtNum(rec.opexPct - rec.capexPct, 0) + ' puntos por encima: carga la guardia, el stock local y el riesgo de incumplir el SLA, ' +
      'que son costos de capacidad instalada y no de trabajo ejecutado.'));
    if (n(e.pricing.capexMarginPct) !== null && e.pricing.capexMarginPct != null && Math.abs(n(e.pricing.capexMarginPct) - rec.capexPct) > 0.01) {
      out.push(B.note('El proyecto tiene un margen fijado a mano (' + fmtNum(e.capexMarginPct, 1) + '%) distinto del recomendado (' + fmtNum(rec.capexPct, 1) + '%). Manda el fijado a mano.', 'warn'));
    }

    if (e.byCenter.length) {
      out.push(B.h('El precio donde se firma: por centro y en su moneda'));
      out.push(B.p('El proyecto se gestiona en ' + cur + ', pero la oferta se presenta por centro y en moneda local. ' +
        'Las partidas compartidas se reparten ' + labelOf(ALLOC_RULES, e.allocationRule).toLowerCase() + '.'));
      out.push(B.table(['Centro', 'Equipos', 'CAPEX ' + cur, 'Fee/mes ' + cur, 'Tipo de cambio', 'CAPEX local', 'Fee/mes local'],
        e.byCenter.map((r) => [
          r.center.name + (r.center.country ? ' · ' + r.center.country : ''),
          { v: fmtNum(r.units), num: true },
          { v: money0(r.capexPrice), num: true },
          { v: money0(r.opexPrice), num: true },
          { v: fmtNum(r.center.fx, 2) + ' ' + r.center.currency + '/' + cur, num: true },
          { v: money0(r.capexLocal, r.center.currency), num: true, strong: true },
          { v: money0(r.opexLocal, r.center.currency), num: true, strong: true },
        ])));
      const fxCur = uniq(e.byCenter.map((r) => r.center.currency).filter((c) => c !== cur));
      if (fxCur.length) {
        out.push(B.note('Exposición cambiaria real: el costo se compra en ' + cur + ' y el contrato se firma en ' + fxCur.join(' y ') +
          '. A suma alzada, cada punto de devaluación del tipo de cambio sale del margen. Se cubre con cláusula de reajuste, con cobertura financiera o con prima en el precio — pero hay que elegir una.', 'warn'));
      }
    } else {
      out.push(B.note('El proyecto no tiene centros declarados: el precio queda en una sola moneda. Si la oferta se presenta por sede y en moneda local, ' +
        'declara los centros en la pestaña Economía y la app arma el precio de cada uno.', 'warn'));
    }

    const sm = e.service;
    if (sm.gapVsCurrent != null && sm.gapVsCurrent > 0) {
      out.push(B.concl('Ojo con el orden: el precio de arriba se construyó sobre el costo cargado hoy. El modelo de servicio dice que sostener el SLA comprometido cuesta ' +
        money0(sm.recommended.monthly, cur) + ' al mes y no ' + money0(e.opexMonthly, cur) + '. Con ese costo corregido, el fee ofertable sube a ' +
        money0(priceFrom(sm.recommended.monthly, e.opexMarginPct, e.marginMode), cur) + ' al mes. La conversación con el cliente no es «su SLA es caro»: es «este es el costo del SLA que pidieron, aquí está el desglose, y aquí una alternativa que da el mismo resultado operativo por menos».'));
    }
    return out;
  }

  // ── Análisis 6: estado general del proyecto ─────────────────────────────
  function analysisStatus(p, ctx) {
    const st = ctx.st;
    const e = ctx.econ;
    const out = [];
    out.push(B.h('Cómo va ' + p.name));
    out.push(B.kv([
      { k: 'Estado', v: statusLabel(p.status) + ' · salud ' + (HEALTH_LABEL[st.health] || '—').toLowerCase() },
      { k: 'Avance real', v: pct(st.progress) + (st.expected == null ? '' : ' · esperado a hoy ' + pct(st.expected)) },
      { k: 'Desviación', v: st.deviation == null ? 'sin fechas suficientes' : (st.deviation >= 0 ? '+' : '') + fmtNum(st.deviation, 0) + ' puntos' },
      { k: 'Ventana', v: fmtDay(p.startDate) + ' → ' + fmtDay(p.endDate) + (st.daysLeft == null ? '' : st.daysLeft < 0 ? ' · ' + Math.abs(st.daysLeft) + ' días vencido' : ' · ' + st.daysLeft + ' días restantes') },
      { k: 'Tareas', v: st.tasksDone + ' de ' + st.tasksTotal + ' completadas · ' + st.tasksOverdue + ' vencidas · ' + st.tasksBlocked + ' bloqueadas' },
      { k: 'Riesgos', v: st.risksOpen + ' abiertos · ' + st.risksCritical + ' críticos' },
      e.costingTotal ? { k: 'Economía', v: 'CAPEX ' + money0(e.capexCost, e.currency) + ' · fee ' + money0(e.opexMonthly, e.currency) + '/mes · precio propuesto ' + money0(e.contractPrice, e.currency) } : null,
    ]));
    if (st.deviation != null && st.deviation < -8) {
      out.push(B.note('El proyecto va ' + Math.abs(Math.round(st.deviation)) + ' puntos por debajo de lo esperado. Con ' + st.tasksOverdue +
        ' tareas vencidas, la causa está en la ejecución, no en la planificación.', st.deviation < -20 ? 'err' : 'warn'));
    }
    if (st.overdue.length) {
      out.push(B.h('Lo que está atrasado'));
      out.push(B.table(['Tarea', 'Responsable', 'Vencía', 'Atraso', 'Avance'],
        st.overdue.slice(0, 8).map((t) => [
          t.name, t.owner || '—', fmtDayShort(t.endDate),
          { v: Math.abs(daysFromToday(t.endDate)) + ' d', num: true, tone: 'err' },
          { v: pct(taskProgress(t)), num: true },
        ])));
    }
    if (st.nextMilestone) {
      const d = daysFromToday(st.nextMilestone.date);
      out.push(B.p('**Próximo hito:** ' + st.nextMilestone.name + ' — ' + fmtDay(st.nextMilestone.date) +
        (d == null ? '' : d < 0 ? ' (vencido hace ' + Math.abs(d) + ' días)' : ' (en ' + d + ' días)') + '.'));
    }
    if (st.openQuestions) {
      out.push(B.p('Hay **' + st.openQuestions + ' consulta(s) abiertas** con el cliente. Lo que el cliente no ha respondido es riesgo sin dueño: cada una debería tener responsable y fecha.'));
    }
    return out;
  }

  // ── Análisis 7: riesgos y qué negociar ──────────────────────────────────
  function analysisRisks(p, ctx) {
    const st = ctx.st;
    const out = [];
    if (!st.topRisks.length) {
      out.push(B.note('No hay riesgos abiertos registrados en este proyecto. Un proyecto sin riesgos anotados no es un proyecto sin riesgos.', 'warn'));
      return out;
    }
    out.push(B.h('Los riesgos que mandan'));
    out.push(B.table(['Riesgo', 'Categoría', 'P', 'I', 'Severidad', 'Nivel'],
      st.topRisks.slice(0, 10).map((r) => {
        const lvl = riskLevel(r);
        return [
          r.title, r.category,
          { v: n(r.probability, 3), num: true }, { v: n(r.impact, 3), num: true },
          { v: riskScore(r) + '/25', num: true, strong: true },
          { v: RISK_LEVEL_LABEL[lvl], tone: lvl === 'critical' ? 'err' : lvl === 'serious' ? 'warn' : 'ok' },
        ];
      })));
    const crit = st.topRisks.filter((r) => riskScore(r) >= 15);
    if (crit.length) {
      out.push(B.h('Lo que hay que cerrar por escrito'));
      out.push(B.list(crit.slice(0, 6).map((r) => '**' + r.title + '** — ' + (r.mitigation || 'sin mitigación definida todavía.'))));
    }
    const noMit = st.topRisks.filter((r) => !s(r.mitigation).trim());
    if (noMit.length) {
      out.push(B.note(noMit.length + ' riesgo(s) abiertos no tienen mitigación escrita. Un riesgo sin mitigación es una lista de deseos, no gestión.', 'warn'));
    }
    const openQ = arr(p.questions).filter((q) => q.status !== 'closed');
    if (openQ.length) {
      out.push(B.p('Además hay **' + openQ.length + ' consulta(s) sin respuesta del cliente**, que son riesgo de alcance puro mientras sigan abiertas.'));
    }
    return out;
  }

  // ── Análisis 8: plazo y cronograma ──────────────────────────────────────
  function analysisSchedule(p, ctx) {
    const st = ctx.st;
    const out = [];
    out.push(B.h('El plazo'));
    out.push(B.kv([
      { k: 'Ventana del proyecto', v: fmtDay(p.startDate) + ' → ' + fmtDay(p.endDate) },
      { k: 'Transcurrido', v: st.elapsed == null ? '—' : pct(st.elapsed) + ' del calendario' },
      { k: 'Avance del trabajo', v: pct(st.progress) },
      { k: 'Días restantes', v: st.daysLeft == null ? '—' : st.daysLeft < 0 ? Math.abs(st.daysLeft) + ' días vencido' : st.daysLeft + ' días' },
    ]));
    if (st.elapsed != null && st.progress < st.elapsed - 8) {
      out.push(B.note('Se consumió ' + pct(st.elapsed) + ' del calendario y se lleva ' + pct(st.progress) + ' del trabajo. La brecha se cierra recuperando ' +
        fmtNum(st.elapsed - st.progress, 0) + ' puntos o moviendo la fecha de término: no hay una tercera opción.', 'warn'));
    }
    if (arr(p.blackouts).length) {
      out.push(B.h('Ventanas en que no se puede trabajar'));
      out.push(B.table(['Desde', 'Hasta', 'Días', 'Motivo'],
        arr(p.blackouts).map((b) => [
          fmtDay(b.from), fmtDay(b.to),
          { v: fmtNum(n(daysBetween(b.from, b.to), 0) + 1), num: true },
          b.label || 'sin motivo declarado',
        ])));
      out.push(B.p('Estas ventanas parten la ruta crítica: el plan las respeta al agendar, pero el contrato tiene que excluirlas del cómputo de atraso o se pagan multas por días en que el propio cliente impide trabajar.'));
    }
    const upcoming = arr(p.milestones).filter((m2) => m2.status !== 'done' && m2.date).sort((a, b) => s(a.date).localeCompare(s(b.date)));
    if (upcoming.length) {
      out.push(B.h('Hitos pendientes'));
      out.push(B.table(['Hito', 'Fecha', 'Faltan'],
        upcoming.slice(0, 8).map((m2) => {
          const d = daysFromToday(m2.date);
          return [m2.name, fmtDayShort(m2.date), { v: d == null ? '—' : d < 0 ? 'vencido hace ' + Math.abs(d) + ' d' : d + ' d', num: true, tone: d != null && d < 0 ? 'err' : d != null && d < 15 ? 'warn' : null }];
        })));
    }
    return out;
  }

  // ── Análisis 9: documentación ───────────────────────────────────────────
  function analysisDocs(p, ctx) {
    const out = [];
    const docs = arr(p.documents);
    out.push(B.h('Con qué información se está trabajando'));
    if (!docs.length) {
      out.push(B.note('La biblioteca del proyecto está vacía. Conecta la carpeta del prospecto o carga los documentos: el analista los usa para proponer el plan y para responder con datos.', 'warn'));
      return out;
    }
    const byKind = DOC_KINDS.map(([k, label]) => ({ k, label, count: docs.filter((d) => d.kind === k).length })).filter((x) => x.count);
    out.push(B.kv([
      { k: 'Documentos indexados', v: fmtNum(docs.length) },
      { k: 'Revisados', v: fmtNum(docs.filter((d) => d.reviewed).length) + ' de ' + docs.length },
      { k: 'Fuentes conectadas', v: fmtNum(arr(model.sources).filter((x) => x.projectId === p.id).length) },
    ]));
    out.push(B.bars(byKind.map((x, i) => ({ key: x.k, label: x.label, value: x.count, display: fmtNum(x.count), color: seriesColor(i) }))));
    const proposal = proposePlan(p, {});
    if (proposal.missing.length) {
      out.push(B.h('Lo que falta para trabajar bien'));
      out.push(B.list(proposal.missing.map((mm) => '**' + mm.label + '** — ' + mm.why)));
      out.push(B.p('Pedir por escrito lo que falta, con responsable y fecha, es más barato que descubrir en ejecución que nunca estuvo.'));
    } else {
      out.push(B.p('Para un proyecto del tipo «' + proposal.templateName + '», la documentación esperada está cubierta.'));
    }
    const unreviewed = docs.filter((d) => !d.reviewed);
    if (unreviewed.length > 3) {
      out.push(B.note(unreviewed.length + ' documento(s) siguen sin marcarse como revisados.', 'warn'));
    }
    return out;
  }

  // ── Registro de análisis y enrutador de preguntas ───────────────────────
  const ANALYSES = [
    {
      id: 'presupuesto-costeo', title: 'Presupuesto vs. costeo por líneas',
      question: '¿Explícame la diferencia entre el presupuesto y el costeo por líneas?',
      icon: 'money', build: analysisBudgetVsCosting,
      keywords: ['presupuesto', 'costeo', 'diferencia', 'linea', 'lineas', 'partidas', 'por que no cuadra', 'descuadre', 'costo total', 'baseline', 'linea base', 'referencia'],
    },
    {
      id: 'capex-opex', title: 'CAPEX, OPEX y el modelo de servicio',
      question: '¿Explícame el OPEX y el CAPEX?',
      icon: 'chart', build: (p, ctx) => analysisCapexOpex(p, ctx).concat(analysisSla(p, ctx), analysisServiceLevers(p, ctx)),
      keywords: ['capex', 'opex', 'inversion', 'servicio', 'fee', 'mantenimiento', 'post venta', 'postventa', 'recurrente', 'mensual', 'soporte'],
    },
    {
      id: 'sla', title: 'Aritmética del SLA y disponibilidad',
      question: '¿El SLA que nos piden es alcanzable?',
      icon: 'clock', build: (p, ctx) => analysisSla(p, ctx).concat(analysisServiceLevers(p, ctx)),
      keywords: ['sla', 'disponibilidad', 'uptime', 'multa', 'multas', 'penalidad', 'tiempo de respuesta', 'guardia', 'nivel de servicio'],
    },
    {
      id: 'precio', title: 'Precio final, margen y monedas',
      question: '¿Cuál es el precio final que deberíamos ofertar?',
      icon: 'target', build: analysisPrice,
      keywords: ['precio', 'ofertar', 'oferta', 'margen', 'utilidad', 'ganancia', 'cuanto cobrar', 'cuanto cobramos', 'venta', 'moneda', 'cambiaria', 'clp', 'cop', 'usd', 'tipo de cambio', 'negociar'],
    },
    {
      id: 'estado', title: 'Estado general del proyecto',
      question: '¿Cómo va el proyecto?',
      icon: 'dashboard', build: analysisStatus,
      keywords: ['como va', 'estado', 'avance', 'salud', 'resumen', 'situacion', 'al dia', 'atrasado', 'desviacion'],
    },
    {
      id: 'riesgos', title: 'Riesgos y qué negociar',
      question: '¿Qué riesgos debo negociar antes de firmar?',
      icon: 'risk', build: analysisRisks,
      keywords: ['riesgo', 'riesgos', 'peligro', 'contrato', 'firmar', 'negociar', 'exposicion', 'mitigacion'],
    },
    {
      id: 'plazo', title: 'Plazo, hitos y ventanas bloqueadas',
      question: '¿Llegamos con el plazo?',
      icon: 'clock', build: analysisSchedule,
      keywords: ['plazo', 'cronograma', 'fecha', 'fechas', 'hito', 'hitos', 'gantt', 'calendario', 'llegamos', 'atraso', 'bloqueo', 'diciembre'],
    },
    {
      id: 'documentos', title: 'Documentación disponible y faltante',
      question: '¿Qué documentación tenemos y qué falta?',
      icon: 'docs', build: analysisDocs,
      keywords: ['documento', 'documentos', 'documentacion', 'informacion', 'antecedentes', 'falta', 'carpeta', 'archivos', 'planos'],
    },
  ];

  /** Enruta una pregunta libre al análisis que mejor la cubre. Puntúa por
   *  coincidencia de palabras clave y por el título del análisis. */
  function routeQuestion(text) {
    const q = canon(text);
    if (!q) return { analysis: null, score: 0, ranking: [] };
    const scored = ANALYSES.map((a) => {
      let score = 0;
      const hits = [];
      for (const kw of a.keywords) {
        const c = canon(kw);
        if (c && q.includes(c)) { score += c.split(' ').length * 2 + Math.min(4, c.length / 4); hits.push(kw); }
      }
      if (q.includes(canon(a.title))) score += 6;
      return { a, score, hits };
    }).sort((x, y) => y.score - x.score);
    return {
      analysis: scored[0] && scored[0].score > 0 ? scored[0].a : null,
      score: scored[0] ? scored[0].score : 0,
      hits: scored[0] ? scored[0].hits : [],
      ranking: scored.filter((x) => x.score > 0).slice(0, 3).map((x) => ({ id: x.a.id, title: x.a.title, score: x.score })),
    };
  }

  /** Responde una pregunta sobre un proyecto. Devuelve bloques + texto. */
  function answerQuestion(p, question, cfg, forcedId) {
    const econ = computeEconomics(p, cfg);
    const st = computeProject(p, cfg);
    const ctx = { econ, st, cfg };
    const routed = forcedId ? { analysis: ANALYSES.find((a) => a.id === forcedId) || null, hits: [], ranking: [] } : routeQuestion(question);
    if (!routed.analysis) {
      const blocks = [
        B.h('No reconocí la pregunta'),
        B.p('Puedo analizar este proyecto en profundidad sobre estos temas, con los números del propio proyecto:'),
        B.list(ANALYSES.map((a) => '**' + a.title + '** — por ejemplo: «' + a.question + '»')),
        B.p('También puedes preguntarle al agente IA de KIMOS en lenguaje natural: usa la misma máquina de análisis.'),
      ];
      return { ok: false, analysis: null, blocks, text: blocksToText(blocks), econ, st };
    }
    let blocks;
    try {
      blocks = routed.analysis.build(p, ctx);
    } catch (err2) {
      blocks = [B.note('No pude completar el análisis: ' + ((err2 && err2.message) || 'error inesperado'), 'err')];
    }
    return {
      ok: true, analysis: routed.analysis, hits: routed.hits, ranking: routed.ranking,
      blocks, text: blocksToText(blocks), econ, st,
      title: routed.analysis.title, project: p.name,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. DOCUMENTOS: CARGA, CARPETAS LOCALES Y NUBE
  // ════════════════════════════════════════════════════════════════════════
  /* Los archivos NO viajan al servidor. La app indexa la ficha de cada uno
   * (nombre, tipo, tamaño, ruta relativa, carpeta de origen) y guarda una
   * miniatura de las imágenes; solo incrusta el archivo completo cuando la
   * persona lo pide y pesa poco. Así la biblioteca sirve para trabajar —el
   * analista lee esos nombres y tipos— sin convertir el documento de la
   * instancia en un depósito de binarios. */

  const MAX_EMBED = 1.5 * 1024 * 1024;   // incrustar solo archivos pequeños
  const THUMB_PX = 128;
  /** Handles de carpeta viva (File System Access API). Solo en memoria: un
   *  handle no es serializable, así que al reabrir la ventana hay que volver
   *  a conectar la carpeta para re-sincronizarla. */
  const folderHandles = new Map();
  const objectUrls = new Set();

  const readAsDataUrl = (file) => new Promise((resolve) => {
    try {
      const fr = new FileReader();
      fr.onload = () => resolve(s(fr.result));
      fr.onerror = () => resolve('');
      fr.readAsDataURL(file);
    } catch (e) { resolve(''); }
  });

  async function makeThumb(file) {
    if (!file || !s(file.type).startsWith('image/') || s(file.type) === 'image/svg+xml') return '';
    if (n(file.size) > 25 * 1024 * 1024) return '';
    let url = '';
    try {
      url = URL.createObjectURL(file);
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const scale = Math.min(1, THUMB_PX / Math.max(1, Math.max(img.width, img.height)));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * scale));
      cv.height = Math.max(1, Math.round(img.height * scale));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      return cv.toDataURL('image/jpeg', 0.62);
    } catch (e) { return ''; }
    finally { if (url) URL.revokeObjectURL(url); }
  }

  /** Convierte archivos del navegador en fichas de documento del proyecto. */
  async function ingestFiles(files, projectId, opts) {
    const o = Object.assign({ sourceId: '', origin: 'upload', embedSmall: false, tags: [] }, opts || {});
    const p = findProject(projectId);
    if (!p) return { added: 0, skipped: 0 };
    const known = new Set(arr(p.documents).map((d) => canon(d.name) + '|' + n(d.size)));
    let added = 0, skipped = 0;
    const list = Array.from(files || []).slice(0, 800);
    for (const file of list) {
      if (!file || !s(file.name)) continue;
      const key = canon(file.name) + '|' + n(file.size);
      if (known.has(key)) { skipped++; continue; }
      known.add(key);
      const kind = docKindOf(file.name, file.type);
      const thumb = await makeThumb(file);
      let dataUrl = '';
      if (o.embedSmall && n(file.size) <= MAX_EMBED) dataUrl = await readAsDataUrl(file);
      p.documents = arr(p.documents).concat([newDoc({
        name: file.name, kind, mime: s(file.type), size: n(file.size),
        path: s(file.webkitRelativePath || (o.pathPrefix || '') + file.name),
        sourceId: o.sourceId, origin: o.origin, thumb, dataUrl, tags: arr(o.tags),
      })]);
      added++;
    }
    if (added) {
      touch(p);
      addLog(projectId, 'system', 'Se indexaron ' + added + ' documento(s)' +
        (o.origin === 'folder' ? ' desde una carpeta conectada' : '') +
        (skipped ? ' (' + skipped + ' ya estaban en la biblioteca)' : '') + '.', 'Biblioteca');
    }
    return { added, skipped };
  }

  /** Selector de archivos sueltos (imágenes, video, PDF u otros). */
  function pickFiles(projectId, opts, done) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (opts && opts.directory) {
      input.webkitdirectory = true;
      try { input.setAttribute('webkitdirectory', ''); input.setAttribute('directory', ''); } catch (e) { /* no soportado */ }
    }
    input.style.display = 'none';
    input.onchange = async () => {
      const res = await ingestFiles(input.files, projectId, opts);
      commit((m) => m);
      if (done) done(res);
      try { document.body.removeChild(input); } catch (e) { /* ya removido */ }
    };
    document.body.appendChild(input);
    input.click();
  }

  const FSA_AVAILABLE = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

  /** Recorre una carpeta conectada con la File System Access API. */
  async function scanHandle(dirHandle, prefix, out, depth) {
    if (!dirHandle || out.length >= 1200 || depth > 8) return;
    for await (const [name, entry] of dirHandle.entries()) {
      if (out.length >= 1200) break;
      if (s(name).startsWith('.')) continue;
      if (entry.kind === 'directory') {
        await scanHandle(entry, prefix + name + '/', out, depth + 1);
      } else {
        try {
          const file = await entry.getFile();
          Object.defineProperty(file, 'webkitRelativePath', { value: prefix + name, configurable: true });
          out.push(file);
        } catch (e) { /* archivo no legible */ }
      }
    }
  }

  /** Conecta una carpeta del disco (C:\ u otra) al proyecto. Con la File
   *  System Access API queda un enlace vivo re-sincronizable; sin ella, el
   *  navegador entrega el contenido de la carpeta una vez. */
  async function connectLocalFolder(projectId, existingSourceId) {
    const p = findProject(projectId);
    if (!p) return null;
    if (!FSA_AVAILABLE) {
      pickFiles(projectId, { directory: true, origin: 'folder' });
      return null;
    }
    let handle;
    try { handle = await window.showDirectoryPicker({ mode: 'read' }); }
    catch (e) { return null; }
    const files = [];
    try { await scanHandle(handle, '', files, 0); }
    catch (e) {
      shell.notify && shell.notify({ level: 'error', text: 'No se pudo leer la carpeta: ' + ((e && e.message) || 'permiso denegado') });
      return null;
    }
    let source = existingSourceId ? arr(model.sources).find((x) => x.id === existingSourceId) : null;
    if (!source) {
      source = newSource({ kind: 'folder', label: s(handle.name) || 'Carpeta local', path: s(handle.name), projectId });
      model.sources = arr(model.sources).concat([source]);
    }
    folderHandles.set(source.id, handle);
    const res = await ingestFiles(files, projectId, { sourceId: source.id, origin: 'folder' });
    Object.assign(source, { fileCount: files.length, lastScan: stamp(), projectId });
    touch(source);
    commit((m) => m);
    shell.notify && shell.notify({
      level: 'success',
      text: 'Carpeta "' + source.label + '" conectada: ' + files.length + ' archivo(s) leídos, ' + res.added + ' nuevos en la biblioteca.',
    });
    return source;
  }

  /** Vuelve a leer una carpeta ya conectada en esta sesión. */
  async function rescanSource(sourceId) {
    const source = arr(model.sources).find((x) => x.id === sourceId);
    if (!source) return;
    const handle = folderHandles.get(sourceId);
    if (!handle) {
      shell.notify && shell.notify({ level: 'info', text: 'Vuelve a conectar la carpeta: el permiso de lectura no sobrevive al cierre de la ventana.' });
      await connectLocalFolder(source.projectId, sourceId);
      return;
    }
    try {
      if (handle.queryPermission) {
        const st = await handle.queryPermission({ mode: 'read' });
        if (st !== 'granted' && handle.requestPermission) await handle.requestPermission({ mode: 'read' });
      }
    } catch (e) { /* el navegador decide */ }
    const files = [];
    await scanHandle(handle, '', files, 0);
    const res = await ingestFiles(files, source.projectId, { sourceId: source.id, origin: 'folder' });
    Object.assign(source, { fileCount: files.length, lastScan: stamp() });
    touch(source);
    commit((m) => m);
    shell.notify && shell.notify({
      level: 'success',
      text: res.added ? res.added + ' documento(s) nuevos desde "' + source.label + '".' : 'Sin novedades en "' + source.label + '".',
    });
  }

  const DRIVE_FOLDER_RE = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/;
  const DRIVE_FILE_RE = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/;

  /** Registra una carpeta de Google Drive, OneDrive, Dropbox o cualquier
   *  otro enlace como fuente del proyecto. */
  function connectCloudFolder(projectId, url, label, kind) {
    const clean = s(url).trim();
    if (!clean) return null;
    const isDrive = /drive\.google\.com|docs\.google\.com/.test(clean);
    const source = newSource({
      kind: kind || (isDrive ? 'drive' : 'cloud'),
      label: s(label).trim() || (isDrive ? 'Carpeta de Google Drive' : 'Carpeta en la nube'),
      url: clean,
      path: (clean.match(DRIVE_FOLDER_RE) || [, ''])[1] || '',
      projectId,
    });
    model.sources = arr(model.sources).concat([source]);
    addLog(projectId, 'system', 'Fuente conectada: ' + source.label + ' (' + labelOf(SOURCE_KINDS, source.kind) + ').', 'Biblioteca');
    commit((m) => m);
    return source;
  }

  /** Importa un listado pegado (una línea por archivo, con enlace opcional)
   *  desde Drive, SharePoint o cualquier gestor que permita copiar nombres. */
  function importListing(projectId, text, sourceId) {
    const p = findProject(projectId);
    if (!p) return 0;
    const lines = s(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const known = new Set(arr(p.documents).map((d) => canon(d.name)));
    const docs = [];
    for (const line of lines.slice(0, 400)) {
      const urlMatch = line.match(/https?:\/\/\S+/);
      const url = urlMatch ? urlMatch[0] : '';
      let name = line.replace(/https?:\/\/\S+/, '').replace(/[\t|;,]+/g, ' ').trim();
      if (!name && url) {
        name = (url.match(DRIVE_FILE_RE) || [, ''])[1] || url.split('/').filter(Boolean).pop() || url;
      }
      if (!name || known.has(canon(name))) continue;
      known.add(canon(name));
      docs.push(newDoc({
        name, kind: url && !/\.[a-z0-9]{2,5}$/i.test(name) ? 'link' : docKindOf(name, ''),
        url, sourceId: s(sourceId), origin: 'listado',
      }));
    }
    if (docs.length) {
      p.documents = arr(p.documents).concat(docs);
      touch(p);
      addLog(projectId, 'system', 'Se importaron ' + docs.length + ' fichas de documento desde un listado pegado.', 'Biblioteca');
      commit((m) => m);
    }
    return docs.length;
  }

  function removeSource(sourceId, alsoDocs) {
    const source = arr(model.sources).find((x) => x.id === sourceId);
    if (!source) return;
    model.sources = arr(model.sources).filter((x) => x.id !== sourceId);
    folderHandles.delete(sourceId);
    tombstone(sourceId);
    if (alsoDocs) {
      for (const p of model.projects) {
        const before = arr(p.documents).length;
        const gone = arr(p.documents).filter((d) => d.sourceId === sourceId).map((d) => d.id);
        if (!gone.length) continue;
        p.documents = arr(p.documents).filter((d) => d.sourceId !== sourceId);
        tombstone(...gone);
        if (before !== p.documents.length) touch(p);
      }
    }
    commit((m) => m);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. GRÁFICOS (SVG en línea)
  // ════════════════════════════════════════════════════════════════════════
  /* Marcas finas, rejilla de un tono sobre la superficie, sin ejes dobles y
   * con etiqueta directa en vez de un número sobre cada punto. Cada marca
   * lleva su <title>: el navegador lo muestra al pasar el cursor. */

  const svgTitle = (text) => h('title', null, text);

  /** Anillo de avance: un solo número, con la referencia de avance esperado
   *  marcada sobre el arco. */
  function Ring(props) {
    const size = n(props.size, 132);
    const stroke = n(props.stroke, 11);
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const value = clamp(n(props.value, 0), 0, 100);
    const expected = props.expected == null ? null : clamp(n(props.expected), 0, 100);
    const color = props.color || 'var(--kp-accent)';
    const cx = size / 2;
    const expAngle = expected == null ? null : (-90 + (expected / 100) * 360) * (Math.PI / 180);
    return h('svg', { className: 'kp-chart', width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, role: 'img', 'aria-label': (props.caption || 'Avance') + ': ' + pct(value) },
      svgTitle((props.caption || 'Avance') + ': ' + pct(value) + (expected != null ? ' · esperado ' + pct(expected) : '')),
      h('circle', { cx, cy: cx, r, fill: 'none', stroke: 'var(--kp-silver)', strokeWidth: stroke }),
      h('circle', {
        cx, cy: cx, r, fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round',
        strokeDasharray: c, strokeDashoffset: c * (1 - value / 100),
        transform: 'rotate(-90 ' + cx + ' ' + cx + ')',
        style: { transition: 'stroke-dashoffset .5s ease' },
      }),
      expAngle == null ? null : h('line', {
        x1: cx + Math.cos(expAngle) * (r - stroke / 2 - 1), y1: cx + Math.sin(expAngle) * (r - stroke / 2 - 1),
        x2: cx + Math.cos(expAngle) * (r + stroke / 2 + 1), y2: cx + Math.sin(expAngle) * (r + stroke / 2 + 1),
        stroke: 'var(--kp-fg)', strokeWidth: 2, strokeLinecap: 'round', opacity: 0.75,
      }),
      h('text', { x: cx, y: cx + 2, textAnchor: 'middle', className: 'kp-ring-num' }, Math.round(value) + '%'),
      props.caption ? h('text', { x: cx, y: cx + 20, textAnchor: 'middle', className: 'kp-ring-cap' }, String(props.caption).toUpperCase()) : null,
    );
  }

  /** Barras horizontales con etiqueta directa: una serie, un color. */
  function BarsH(props) {
    const items = arr(props.items);
    if (!items.length) return h('div', { className: 'kp-empty kp-muted' }, 'Sin datos que mostrar todavía.');
    const rowH = n(props.rowH, 30);
    const labelW = n(props.labelW, 148);
    const valueW = 52;
    const width = 640;
    const plotW = width - labelW - valueW;
    const max = Math.max(1, n(props.max, Math.max.apply(null, items.map((x) => n(x.value, 0)))));
    const height = items.length * rowH + 6;
    return h('svg', {
      className: 'kp-chart', viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'xMinYMin meet', style: { height: height + 'px', maxHeight: height + 'px' }, role: 'img',
    },
      [0.25, 0.5, 0.75, 1].map((f) => h('line', {
        key: 'g' + f, className: 'kp-gridline',
        x1: labelW + plotW * f, x2: labelW + plotW * f, y1: 2, y2: height - 6,
      })),
      items.map((it, i) => {
        const y = i * rowH + 4;
        const w = Math.max(2, (n(it.value, 0) / max) * plotW);
        const color = it.color || 'var(--kp-s1)';
        return h('g', { key: it.key || i, className: 'kp-gantt-row' },
          svgTitle(s(it.label) + ': ' + (it.display || fmtNum(it.value)) + (it.note ? ' · ' + it.note : '')),
          h('text', { x: 0, y: y + rowH / 2 + 1, dominantBaseline: 'middle', className: 'kp-ax-strong' },
            s(it.label).length > 24 ? s(it.label).slice(0, 23) + '…' : s(it.label)),
          h('rect', { x: labelW, y: y + 4, width: plotW, height: rowH - 14, rx: 4, fill: 'var(--kp-silver)', opacity: 0.5 }),
          h('rect', { x: labelW, y: y + 4, width: w, height: rowH - 14, rx: 4, fill: color }),
          it.marker == null ? null : h('line', {
            x1: labelW + (clamp(n(it.marker), 0, max) / max) * plotW, x2: labelW + (clamp(n(it.marker), 0, max) / max) * plotW,
            y1: y + 1, y2: y + rowH - 7, stroke: 'var(--kp-fg)', strokeWidth: 2, opacity: 0.6, strokeLinecap: 'round',
          }),
          h('text', { x: width, y: y + rowH / 2 + 1, textAnchor: 'end', dominantBaseline: 'middle', className: 'kp-ax-strong' },
            it.display || fmtNum(it.value)),
        );
      }),
    );
  }

  /** Dona de composición: máximo 6 segmentos, siempre con leyenda y valores. */
  function Donut(props) {
    const items = arr(props.items).filter((x) => n(x.value, 0) > 0);
    const total = sum(items, (x) => n(x.value, 0));
    const size = n(props.size, 128);
    const stroke = n(props.stroke, 16);
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const cx = size / 2;
    let acc = 0;
    return h('div', { className: 'kp-ring-wrap' },
      h('svg', { className: 'kp-chart', width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, style: { flex: '0 0 auto' }, role: 'img' },
        h('circle', { cx, cy: cx, r, fill: 'none', stroke: 'var(--kp-silver)', strokeWidth: stroke }),
        items.map((it, i) => {
          const frac = n(it.value, 0) / Math.max(1, total);
          // 2px de superficie entre segmentos: separan sin dibujar un borde.
          const gap = items.length > 1 ? 2 : 0;
          const len = Math.max(0, c * frac - gap);
          const el = h('circle', {
            key: it.key || i, cx, cy: cx, r, fill: 'none', stroke: it.color || seriesColor(i),
            strokeWidth: stroke, strokeDasharray: len + ' ' + (c - len),
            strokeDashoffset: -c * acc, transform: 'rotate(-90 ' + cx + ' ' + cx + ')',
          }, svgTitle(it.label + ': ' + fmtNum(it.value) + ' (' + Math.round(frac * 100) + '%)'));
          acc += frac;
          return el;
        }),
        h('text', { x: cx, y: cx - 2, textAnchor: 'middle', className: 'kp-ring-num' }, fmtNum(total)),
        h('text', { x: cx, y: cx + 15, textAnchor: 'middle', className: 'kp-ring-cap' }, String(props.caption || 'TOTAL').toUpperCase()),
      ),
      h('div', { className: 'kp-legend', style: { marginTop: 0, flexDirection: 'column', gap: '5px' } },
        items.map((it, i) => h('span', { key: it.key || i, className: 'kp-legend-it' },
          h('span', { className: 'kp-legend-sw', style: { background: it.color || seriesColor(i) } }),
          h('span', null, it.label),
          h('span', { className: 'kp-legend-val' }, fmtNum(it.value)),
        )),
      ),
    );
  }

  /** Barra apilada fina para una composición de estados. */
  function StackBar(props) {
    const items = arr(props.items).filter((x) => n(x.value, 0) > 0);
    const total = sum(items, (x) => n(x.value, 0));
    if (!total) return h('div', { className: 'kp-bar' }, h('span', { className: 'kp-bar-fill', style: { width: 0 } }));
    return h('div', { style: { display: 'flex', gap: '2px', height: (props.height || 9) + 'px', width: '100%' } },
      items.map((it, i) => h('span', {
        key: it.key || i, title: it.label + ': ' + fmtNum(it.value),
        style: {
          width: (n(it.value, 0) / total) * 100 + '%', background: it.color || seriesColor(i),
          borderRadius: '99px', display: 'block',
        },
      })),
    );
  }

  /** Línea temporal del plan: una barra por tarea, agrupadas por fase, con
   *  la línea de hoy, los hitos y las ventanas bloqueadas. */
  function Timeline(props) {
    const project = props.project;
    const tasks = arr(props.tasks).filter((t) => t.startDate && t.endDate);
    if (!tasks.length) return h('div', { className: 'kp-empty' },
      h('div', { className: 'kp-empty-icon' }, I.plan(28)),
      h('div', { className: 'kp-empty-title' }, 'Todavía no hay tareas con fechas'),
      h('div', { className: 'kp-empty-txt' }, 'Ponles fecha de inicio y término a las tareas —o pide una propuesta de plan al analista— y la línea temporal se dibuja sola.'));

    const phases = arr(project.phases).slice().sort((a, b) => n(a.order) - n(b.order));
    const groups = phases.map((f) => ({ phase: f, tasks: tasks.filter((t) => t.phaseId === f.id) }))
      .filter((g) => g.tasks.length);
    const loose = tasks.filter((t) => !phases.some((f) => f.id === t.phaseId));
    if (loose.length) groups.push({ phase: { id: '', name: 'Sin fase' }, tasks: loose });

    const allDates = tasks.map((t) => t.startDate).concat(tasks.map((t) => t.endDate)).filter(Boolean).sort();
    const min = allDates[0];
    const max = allDates[allDates.length - 1];
    const span = Math.max(1, n(daysBetween(min, max), 1));
    const width = 900;
    const labelW = 250;
    const plotW = width - labelW - 12;
    const rowH = 22;
    const headH = 26;
    const rows = groups.reduce((a, g) => a + g.tasks.length + 1, 0);
    const height = headH + rows * rowH + 10;
    const xOf = (d) => labelW + clamp(n(daysBetween(min, d), 0) / span, 0, 1) * plotW;

    // Marcas de mes en la escala temporal.
    const ticks = [];
    const first = parseDay(min);
    if (first) {
      const cursor = new Date(first.getFullYear(), first.getMonth(), 1, 12);
      for (let i = 0; i < 60; i++) {
        const dayStr = ymd(cursor);
        if (dayStr > max) break;
        if (dayStr >= min) ticks.push({ x: xOf(dayStr), label: MONTHS[cursor.getMonth()] + (cursor.getMonth() === 0 ? ' ' + cursor.getFullYear() : '') });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    const todayX = today() >= min && today() <= max ? xOf(today()) : null;
    let y = headH;

    return h('div', { className: 'kp-gantt' },
      h('svg', {
        className: 'kp-chart', viewBox: '0 0 ' + width + ' ' + height,
        preserveAspectRatio: 'xMinYMin meet', style: { minWidth: '620px', height: height + 'px' }, role: 'img',
      },
        arr(project.blackouts).map((b, i) => {
          if (!b.from || !b.to || b.to < min || b.from > max) return null;
          const x1 = xOf(b.from < min ? min : b.from);
          const x2 = xOf(b.to > max ? max : b.to);
          return h('rect', { key: 'bo' + i, x: x1, y: headH - 4, width: Math.max(2, x2 - x1), height: height - headH, fill: 'var(--kp-err)', opacity: 0.07 },
            svgTitle('Ventana bloqueada: ' + (b.label || '') + ' (' + fmtDay(b.from) + ' → ' + fmtDay(b.to) + ')'));
        }),
        ticks.map((t, i) => h('g', { key: 'tk' + i },
          h('line', { className: 'kp-gridline', x1: t.x, x2: t.x, y1: headH - 6, y2: height - 8 }),
          h('text', { x: t.x + 3, y: 12, className: 'kp-ax' }, t.label))),
        todayX == null ? null : h('line', { className: 'kp-today', x1: todayX, x2: todayX, y1: headH - 8, y2: height - 8 },
          svgTitle('Hoy: ' + fmtDay(today()))),
        todayX == null ? null : h('text', { x: todayX + 3, y: headH - 11, className: 'kp-ax', fill: 'var(--kp-err)' }, 'hoy'),
        groups.map((g) => {
          const gy = y; y += rowH;
          const gStart = g.tasks.map((t) => t.startDate).sort()[0];
          const gEnd = g.tasks.map((t) => t.endDate).sort().pop();
          const rowsEls = g.tasks.slice().sort((a, b) => s(a.startDate).localeCompare(s(b.startDate))).map((t) => {
            const ty = y; y += rowH;
            const x1 = xOf(t.startDate), x2 = xOf(t.endDate);
            const w = Math.max(4, x2 - x1);
            const prog = taskProgress(t);
            const late = !taskDone(t) && daysFromToday(t.endDate) < 0;
            const color = t.status === 'blocked' ? 'var(--kp-err)' : late ? 'var(--kp-serious)'
              : taskDone(t) ? 'var(--kp-s3)' : 'var(--kp-s1)';
            return h('g', { key: t.id, className: 'kp-gantt-row' },
              svgTitle(t.name + '\n' + fmtDay(t.startDate) + ' → ' + fmtDay(t.endDate) + ' · ' + pct(prog) +
                (t.owner ? ' · ' + t.owner : '') + (late ? ' · VENCIDA' : '')),
              h('rect', { className: 'kp-gantt-bg', x: 0, y: ty, width, height: rowH - 2, fill: 'transparent' }),
              h('text', { x: 14, y: ty + rowH / 2, dominantBaseline: 'middle', className: 'kp-gantt-lbl' },
                (t.name.length > 40 ? t.name.slice(0, 39) + '…' : t.name)),
              h('rect', { x: x1, y: ty + 4, width: w, height: rowH - 11, rx: 4, fill: color, opacity: 0.24 }),
              h('rect', { x: x1, y: ty + 4, width: Math.max(2, (w * prog) / 100), height: rowH - 11, rx: 4, fill: color }),
            );
          });
          return h('g', { key: g.phase.id || 'loose' },
            h('text', { x: 4, y: gy + rowH / 2, dominantBaseline: 'middle', className: 'kp-ax-strong' },
              g.phase.name.length > 34 ? g.phase.name.slice(0, 33) + '…' : g.phase.name),
            gStart && gEnd ? h('rect', {
              x: xOf(gStart), y: gy + rowH / 2 - 2, width: Math.max(3, xOf(gEnd) - xOf(gStart)), height: 4, rx: 2,
              fill: 'var(--kp-muted)', opacity: 0.5,
            }, svgTitle(g.phase.name + ': ' + fmtDay(gStart) + ' → ' + fmtDay(gEnd))) : null,
            rowsEls,
          );
        }),
        arr(project.milestones).filter((mm) => mm.date && mm.date >= min && mm.date <= max).map((mm, i) => {
          const x = xOf(mm.date);
          return h('g', { key: 'ms' + i },
            svgTitle('Hito: ' + mm.name + ' · ' + fmtDay(mm.date)),
            h('path', {
              d: 'M' + x + ' ' + (headH - 20) + ' l5 5 -5 5 -5 -5 z',
              fill: mm.status === 'done' ? 'var(--kp-ok)' : 'var(--kp-accent)',
              stroke: 'var(--kp-bg)', strokeWidth: 1.5,
            }));
        }),
      ),
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. ACCIONES (las mismas que usan la interfaz y el agente)
  // ════════════════════════════════════════════════════════════════════════
  const upsertIn = (list, item) => {
    const i = arr(list).findIndex((x) => x.id === item.id);
    if (i < 0) return arr(list).concat([touch(item)]);
    const next = arr(list).slice();
    next[i] = touch(Object.assign({}, next[i], item));
    return next;
  };

  const actions = {
    createClient(data) {
      const c = newClient(Object.assign({ colorIndex: model.clients.length % SERIES.length }, data));
      if (!s(c.name)) return null;
      commit((m) => { m.clients = arr(m.clients).concat([c]); return m; });
      return c;
    },
    saveClient(id, patch) {
      const c = findClient(id); if (!c) return null;
      commit((m) => { m.clients = upsertIn(m.clients, Object.assign({}, c, patch, { id })); return m; });
      return findClient(id);
    },
    deleteClient(id, moveTo) {
      commit((m) => {
        m.clients = arr(m.clients).filter((c) => c.id !== id);
        for (const p of m.projects) if (p.clientId === id) { p.clientId = s(moveTo); touch(p); }
        tombstone(id);
        return m;
      });
    },
    createProject(data) {
      const cfgCur = s((currentConfig() || {}).defaultCurrency) || 'CLP';
      const p = newProject(Object.assign({ currency: cfgCur }, data));
      if (!s(p.name)) return null;
      commit((m) => { m.projects = arr(m.projects).concat([p]); return m; });
      addLog(p.id, 'system', 'Proyecto creado.', 'Gestor');
      commit((m) => m, { silent: true });
      return p;
    },
    saveProject(id, patch) {
      const p = findProject(id); if (!p) return null;
      commit((m) => { m.projects = upsertIn(m.projects, Object.assign({}, p, patch, { id })); return m; });
      return findProject(id);
    },
    deleteProject(id) {
      const p = findProject(id); if (!p) return;
      commit((m) => {
        m.projects = arr(m.projects).filter((x) => x.id !== id);
        tombstone(id, ...arr(p.tasks).map((x) => x.id), ...arr(p.risks).map((x) => x.id),
          ...arr(p.documents).map((x) => x.id), ...arr(p.milestones).map((x) => x.id));
        return m;
      });
    },
    /** CRUD genérico sobre una colección del proyecto. */
    upsert(projectId, key, item) {
      const p = findProject(projectId); if (!p || !item) return null;
      commit((m) => { p[key] = upsertIn(p[key], item); touch(p); return m; });
      return arr(findProject(projectId)[key]).find((x) => x.id === item.id) || null;
    },
    remove(projectId, key, id) {
      const p = findProject(projectId); if (!p) return;
      commit((m) => {
        p[key] = arr(p[key]).filter((x) => x.id !== id);
        tombstone(id); touch(p);
        return m;
      });
    },
    log(projectId, kind, text, author) {
      commit((m) => { addLog(projectId, kind, text, author); return m; });
    },
    /** Marca el avance de una tarea y sincroniza su estado. */
    setTaskProgress(projectId, taskId, progress) {
      const p = findProject(projectId); if (!p) return;
      const t = arr(p.tasks).find((x) => x.id === taskId); if (!t) return;
      const v = clamp(n(progress, 0), 0, 100);
      const patch = { progress: v };
      if (v >= 100) patch.status = 'done';
      else if (v > 0 && (t.status === 'pending' || t.status === 'done')) patch.status = 'in_progress';
      else if (v === 0 && t.status === 'done') patch.status = 'pending';
      actions.upsert(projectId, 'tasks', Object.assign({}, t, patch));
    },
    setTaskStatus(projectId, taskId, status) {
      const p = findProject(projectId); if (!p) return;
      const t = arr(p.tasks).find((x) => x.id === taskId); if (!t) return;
      const patch = { status };
      if (status === 'done') patch.progress = 100;
      if (status === 'pending' && n(t.progress) >= 100) patch.progress = 0;
      if (status === 'in_progress' && n(t.progress) >= 100) patch.progress = 50;
      actions.upsert(projectId, 'tasks', Object.assign({}, t, patch));
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // 8. INTERFAZ
  // ════════════════════════════════════════════════════════════════════════
  let liveConfig = {};
  const currentConfig = () => liveConfig;

  const cx = (...parts) => parts.filter(Boolean).join(' ');

  const Chip = (label, opts) => {
    const o = opts || {};
    return h('span', {
      key: o.key, className: cx('kp-chip', o.tone && 'kp-chip-' + o.tone, o.on && 'kp-chip-on', o.onClick && 'kp-chip-btn'),
      title: o.title || '', onClick: o.onClick,
      role: o.onClick ? 'button' : undefined,
    }, o.color ? h('span', { className: 'kp-chip-dot', style: { background: o.color } }) : null,
      o.icon || null, label);
  };

  const Bar = (value, opts) => {
    const o = opts || {};
    return h('div', { className: 'kp-bar-row' },
      h('div', { className: cx('kp-bar', o.large && 'kp-bar-lg'), title: o.title || pct(value) },
        h('span', { className: 'kp-bar-fill', style: { width: clamp(n(value), 0, 100) + '%', background: o.color || 'var(--kp-accent)' } })),
      o.hideNumber ? null : h('span', { className: 'kp-bar-num' }, pct(value)));
  };

  const Kpi = (label, value, opts) => {
    const o = opts || {};
    return h('div', { key: o.key, className: cx('kp-kpi', o.tone && 'kp-kpi-' + o.tone), title: o.title || '' },
      h('div', { className: 'kp-kpi-top' }, o.icon || null, h('span', { className: 'kp-kpi-label' }, label)),
      h('div', { className: 'kp-kpi-value' }, value, o.unit ? h('small', null, o.unit) : null),
      o.foot ? h('div', { className: 'kp-kpi-foot' }, o.foot) : null,
      o.bar != null ? Bar(o.bar, { color: o.barColor, hideNumber: true }) : null);
  };

  const SectionHead = (title, note, actionsEls) => h('div', { className: 'kp-sec-hd' },
    h('span', { className: 'kp-sec-title' }, title),
    note ? h('span', { className: 'kp-sec-note' }, note) : null,
    actionsEls ? h('div', { className: 'kp-sec-actions' }, actionsEls) : null);

  const Empty = (iconEl, title, text, actionEl) => h('div', { className: 'kp-empty' },
    h('div', { className: 'kp-empty-icon' }, iconEl),
    h('div', { className: 'kp-empty-title' }, title),
    text ? h('div', { className: 'kp-empty-txt' }, text) : null,
    actionEl || null);

  const Note = (text, tone, iconEl) => h('div', { className: cx('kp-note', tone && 'kp-note-' + tone) },
    iconEl || I.info(15), h('div', null, text));

  const Field = (label, control, help) => h('label', { className: 'kp-label' },
    label, control, help ? h('span', { className: 'kp-field-help' }, help) : null);

  const Select = (value, options, onChange, opts) => h('select', Object.assign({
    className: 'kp-select', value: s(value), onChange: (e) => onChange(e.target.value),
  }, opts || {}), options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])));

  const Input = (value, onChange, opts) => h('input', Object.assign({
    className: 'kp-input', value: s(value), onChange: (e) => onChange(e.target.value),
  }, opts || {}));

  const TextArea = (value, onChange, opts) => h('textarea', Object.assign({
    className: 'kp-textarea', value: s(value), onChange: (e) => onChange(e.target.value),
  }, opts || {}));

  const IconBtn = (iconEl, title, onClick, opts) => h('button', Object.assign({
    className: cx('kp-btn', 'kp-btn-icon', (opts || {}).tone === 'danger' && 'kp-btn-danger', (opts || {}).ghost && 'kp-btn-ghost'),
    title, 'aria-label': title, onClick,
  }, (opts || {}).attrs || {}), iconEl);

  const TaskStatusChip = (t) => {
    const late = !taskDone(t) && t.endDate && daysFromToday(t.endDate) < 0;
    const tone = t.status === 'done' ? 'ok' : t.status === 'blocked' ? 'err' : late ? 'serious' : t.status === 'in_progress' ? 'on' : null;
    return Chip(labelOf(TASK_STATUS, t.status) + (late && t.status !== 'done' ? ' · vencida' : ''), { tone });
  };

  const HealthChip = (health) => Chip(HEALTH_LABEL[health] || '—', {
    tone: health === 'on_track' ? 'ok' : health === 'at_risk' ? 'warn' : 'err',
  });

  const StatusChip = (status) => Chip(statusLabel(status), { color: statusColor(status) });

  const ClientDot = (client) => h('span', {
    className: 'kp-proj-mark',
    style: { background: seriesColor(n(client && client.colorIndex, 0)) },
  }, s((client && client.name) || '—').trim().slice(0, 2).toUpperCase());

  /** Panel lateral reutilizable para los editores. */
  const Panel = (title, bodyEls, footEls, onClose, opts) => h('div', {
    className: cx('kp-overlay', (opts || {}).center && 'kp-overlay-center'),
    onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); },
  },
    h('div', { className: (opts || {}).center ? 'kp-modal' : 'kp-panel' },
      h('div', { className: 'kp-panel-hd' },
        h('span', { className: 'kp-panel-title' }, title),
        IconBtn(I.x(16), 'Cerrar', onClose, { ghost: true })),
      h('div', { className: 'kp-panel-body' }, bodyEls),
      footEls ? h('div', { className: 'kp-panel-foot' }, footEls) : null));

  // ── Portada: tablero global de la cartera ───────────────────────────────
  function viewDashboard(ctx) {
    const { m, port, cfg, go, setUi } = ctx;
    const money = cfg.showFinance !== false;

    if (!m.projects.length) {
      return h('div', { className: 'kp-scroll' },
        Empty(I.compass(34), 'Tu cartera todavía está vacía',
          'Crea el primer cliente y su proyecto, o conecta una carpeta con la documentación del prospecto y deja que el analista proponga el plan de trabajo.',
          h('div', { className: 'kp-chips', style: { marginTop: '10px' } },
            h('button', { className: 'kp-btn kp-btn-primary', onClick: () => setUi((u) => ({ ...u, editor: { type: 'project', data: newProject({ clientId: (m.clients[0] || {}).id || '' }), isNew: true } })) }, I.plus(15), 'Nuevo proyecto'),
            h('button', { className: 'kp-btn', onClick: () => setUi((u) => ({ ...u, editor: { type: 'client', data: newClient(), isNew: true } })) }, I.users(15), 'Nuevo cliente'))));
    }

    const progressItems = port.running.slice().sort((a, b) => port.stats.get(b.id).progress - port.stats.get(a.id).progress)
      .slice(0, 10).map((p) => {
        const st = port.stats.get(p.id);
        return {
          key: p.id, label: p.name, value: Math.round(st.progress),
          display: Math.round(st.progress) + '%',
          marker: st.expected == null ? null : Math.round(st.expected),
          color: st.health === 'critical' ? 'var(--kp-err)' : st.health === 'at_risk' ? 'var(--kp-warn)' : 'var(--kp-s1)',
          note: (st.expected == null ? '' : 'esperado ' + Math.round(st.expected) + '% · ') + clientName(p.clientId),
        };
      });

    const byClient = m.clients.map((c, i) => {
      const list = m.projects.filter((p) => p.clientId === c.id && OPEN_STATUS.includes(p.status));
      return { key: c.id, label: c.name, value: list.length, color: seriesColor(n(c.colorIndex, i)) };
    }).filter((x) => x.value > 0);

    const healthBar = ['on_track', 'at_risk', 'critical'].map((k) => ({
      key: k, label: HEALTH_LABEL[k], value: port.byHealth.find((x) => x.key === k).value,
      color: healthColor(k),
    }));

    return h('div', { className: 'kp-scroll' },
      // Encabezado del tablero: el número que manda + los indicadores
      h('div', { className: 'kp-sec' },
        h('div', { className: 'kp-card kp-card-pad', style: { display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' } },
          h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', minWidth: '260px', flex: '1 1 260px' } },
            Ring({ value: port.globalProgress, expected: port.globalExpected, caption: 'avance global', size: 128 }),
            h('div', { style: { minWidth: 0 } },
              h('div', { style: { font: '600 15px/1.3 Inter, sans-serif' } }, port.running.length + ' proyecto' + (port.running.length === 1 ? '' : 's') + ' en ejecución'),
              h('div', { className: 'kp-sec-note', style: { marginBottom: '8px' } },
                port.globalExpected == null
                  ? 'Ponle fechas a las tareas para comparar el avance real con el esperado.'
                  : (port.globalProgress >= port.globalExpected
                    ? 'La cartera va ' + Math.round(port.globalProgress - port.globalExpected) + ' puntos por sobre lo esperado a hoy.'
                    : 'La cartera va ' + Math.round(port.globalExpected - port.globalProgress) + ' puntos por debajo de lo esperado a hoy.')),
              h('div', { style: { marginBottom: '6px' } }, StackBar({ items: healthBar })),
              h('div', { className: 'kp-legend' }, healthBar.map((x) => h('span', { key: x.key, className: 'kp-legend-it' },
                h('span', { className: 'kp-legend-sw', style: { background: x.color } }), x.label,
                h('span', { className: 'kp-legend-val' }, x.value)))))),
          h('div', { className: 'kp-grid kp-grid-3', style: { flex: '2 1 420px' } },
            Kpi('Clientes', fmtNum(port.totalClients), { key: 'k1', icon: I.users(14), foot: port.totalProjects + ' proyectos en total' }),
            Kpi('Tareas abiertas', fmtNum(port.tasksOpen), { key: 'k2', icon: I.plan(14), foot: port.tasksDueSoon + ' por vencer' }),
            Kpi('Tareas vencidas', fmtNum(port.tasksOverdue), { key: 'k3', icon: I.clock(14), tone: port.tasksOverdue ? 'err' : 'ok', foot: port.tasksOverdue ? 'requieren decisión hoy' : 'nada atrasado' }),
            Kpi('Riesgos críticos', fmtNum(port.risksCritical), { key: 'k4', icon: I.risk(14), tone: port.risksCritical ? 'err' : 'ok', foot: port.risksOpen + ' riesgos abiertos' }),
            Kpi('Consultas abiertas', fmtNum(port.openQuestions), { key: 'k5', icon: I.alert(14), tone: port.openQuestions ? 'warn' : undefined, foot: 'esperando respuesta del cliente' }),
            money
              ? Kpi('Cartera', port.budgetByCurrency.length
                ? port.budgetByCurrency.map((b) => fmtMoney(b.val, b.cur)).join(' · ')
                : '—', {
                key: 'k6', icon: I.money(14),
                tone: port.budgetOver ? 'err' : port.budgetWatch ? 'warn' : undefined,
                foot: port.budgetOver
                  ? port.budgetOver + ' proyecto(s) con el costeo sobre el presupuesto'
                  : port.budgetWatch
                    ? port.budgetWatch + ' proyecto(s) rozando su presupuesto'
                    : 'presupuesto de los proyectos abiertos',
              })
              : Kpi('Documentos', fmtNum(port.docsTotal), { key: 'k6', icon: I.docs(14), foot: 'en la biblioteca de la cartera' })))),

      // Avance por proyecto + composición
      h('div', { className: 'kp-sec kp-split' },
        h('div', { className: 'kp-card kp-card-pad' },
          SectionHead('Avance por proyecto', 'La marca vertical es el avance esperado a hoy según las fechas del plan.'),
          BarsH({ items: progressItems, max: 100 }),
          progressItems.length ? h('div', { className: 'kp-legend' },
            h('span', { className: 'kp-legend-it' }, h('span', { className: 'kp-legend-sw', style: { background: 'var(--kp-s1)' } }), 'En rumbo'),
            h('span', { className: 'kp-legend-it' }, h('span', { className: 'kp-legend-sw', style: { background: 'var(--kp-warn)' } }), 'En riesgo'),
            h('span', { className: 'kp-legend-it' }, h('span', { className: 'kp-legend-sw', style: { background: 'var(--kp-err)' } }), 'Crítico')) : null),
        h('div', { style: { display: 'grid', gap: '12px', alignContent: 'start' } },
          h('div', { className: 'kp-card kp-card-pad' },
            SectionHead('Proyectos por estado'),
            Donut({
              caption: 'proyectos',
              items: port.byStatus.map((x) => ({ key: x.key, label: x.label, value: x.value, color: tokenColor(x.tok) })),
            })),
          byClient.length ? h('div', { className: 'kp-card kp-card-pad' },
            SectionHead('Proyectos abiertos por cliente'),
            Donut({ caption: 'abiertos', items: byClient })) : null)),

      // Hitos y alertas
      h('div', { className: 'kp-sec kp-split' },
        h('div', { className: 'kp-card kp-card-pad' },
          SectionHead('Próximos hitos', 'Los siguientes 60 días de toda la cartera'),
          port.upcoming.length
            ? h('div', { className: 'kp-feed' }, port.upcoming.slice(0, 8).map((x) => h('div', { key: x.project.id + x.milestone.id, className: 'kp-feed-it' },
              h('span', {
                className: 'kp-feed-dot',
                style: x.days <= 7 ? { color: 'var(--kp-err)', borderColor: 'var(--kp-err)' } : null,
              }, I.flag(14)),
              h('div', { className: 'kp-feed-txt', style: { flex: 1 } },
                h('div', { className: 'kp-strong' }, x.milestone.name),
                h('div', { className: 'kp-feed-when' },
                  h('button', { className: 'kp-crumb-btn', onClick: () => go(x.project.id, 'plan') }, x.project.name),
                  ' · ', fmtDay(x.milestone.date), ' · ',
                  x.days === 0 ? 'hoy' : 'en ' + x.days + ' día' + (x.days === 1 ? '' : 's'))))))
            : Empty(I.flag(24), 'Sin hitos en los próximos 60 días', 'Los hitos marcan las fechas que el cliente mira: agrégalos en la pestaña Plan de cada proyecto.')),
        h('div', { className: 'kp-card kp-card-pad' },
          SectionHead('Alertas', port.alerts.length ? port.alerts.length + ' cosas piden atención' : 'Todo bajo control'),
          port.alerts.length
            ? h('div', { className: 'kp-feed' }, port.alerts.slice(0, 9).map((a, i) => h('div', { key: i, className: 'kp-feed-it' },
              h('span', { className: 'kp-feed-dot', style: { color: a.level === 'err' ? 'var(--kp-err)' : 'var(--kp-warn)' } },
                a.level === 'err' ? I.alert(14) : I.info(14)),
              h('div', { className: 'kp-feed-txt', style: { flex: 1 } }, a.text,
                h('div', { className: 'kp-feed-when' },
                  h('button', { className: 'kp-crumb-btn', onClick: () => go(a.project.id, 'resumen') }, a.project.name))))))
            : Empty(I.check(24), 'Ninguna alerta activa', 'No hay tareas vencidas, hitos atrasados ni riesgos críticos abiertos en la cartera.'))),

      // Actividad
      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Actividad reciente', 'Bitácora combinada de todos los proyectos'),
        port.activity.length
          ? h('div', { className: 'kp-feed' }, port.activity.slice(0, 12).map((a) => h('div', { key: a.entry.id, className: 'kp-feed-it' },
            h('span', { className: 'kp-feed-dot' }, a.entry.kind === 'decision' ? I.check(14) : a.entry.kind === 'issue' ? I.alert(14)
              : a.entry.kind === 'milestone' ? I.flag(14) : a.entry.kind === 'meeting' ? I.users(14) : I.book(14)),
            h('div', { className: 'kp-feed-txt', style: { flex: 1 } }, a.entry.text,
              h('div', { className: 'kp-feed-when' },
                h('button', { className: 'kp-crumb-btn', onClick: () => go(a.project.id, 'bitacora') }, a.project.name),
                ' · ', fmtWhen(a.entry.at), a.entry.author ? ' · ' + a.entry.author : '')))))
          : h('div', { className: 'kp-sec-note' }, 'Todavía no hay movimientos registrados.')));
  }

  // ── Clientes ────────────────────────────────────────────────────────────
  function viewClients(ctx) {
    const { m, port, ui, setUi, go } = ctx;
    const q = canon(ui.q);
    const clients = m.clients.filter((c) => !q || canon(c.name + ' ' + c.industry + ' ' + c.code + ' ' + c.country).includes(q));

    return h('div', { className: 'kp-scroll' },
      !m.clients.length
        ? Empty(I.users(34), 'Sin clientes todavía',
          'Cada proyecto vive bajo un cliente: así la cartera se lee por cuenta y los tableros suman por cliente.',
          h('button', { className: 'kp-btn kp-btn-primary', style: { marginTop: '8px' }, onClick: () => setUi((u) => ({ ...u, editor: { type: 'client', data: newClient(), isNew: true } })) }, I.plus(15), 'Nuevo cliente'))
        : h('div', { className: 'kp-grid kp-grid-auto' }, clients.map((c) => {
          const list = m.projects.filter((p) => p.clientId === c.id);
          const open = list.filter((p) => OPEN_STATUS.includes(p.status));
          const running = list.filter((p) => RUNNING_STATUS.includes(p.status));
          const prog = running.length ? sum(running, (p) => port.stats.get(p.id).progress) / running.length : 0;
          const risks = sum(open, (p) => port.stats.get(p.id).risksCritical);
          const overdue = sum(open, (p) => port.stats.get(p.id).tasksOverdue);
          return h('div', { key: c.id, className: 'kp-card kp-card-pad', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            h('div', { className: 'kp-proj-hd' },
              ClientDot(c),
              h('div', { style: { minWidth: 0, flex: 1 } },
                h('div', { className: 'kp-proj-name' }, c.name),
                h('div', { className: 'kp-proj-client' }, [c.industry, c.country].filter(Boolean).join(' · ') || 'Sin rubro declarado')),
              IconBtn(I.pencil(14), 'Editar cliente', () => setUi((u) => ({ ...u, editor: { type: 'client', data: Object.assign({}, c) } })), { ghost: true })),
            c.contactName ? h('div', { className: 'kp-sec-note' }, c.contactName) : null,
            c.contactEmail ? h('div', { className: 'kp-sec-note kp-mono' }, c.contactEmail) : null,
            h('div', { className: 'kp-chips' },
              Chip(list.length + ' proyecto' + (list.length === 1 ? '' : 's'), { icon: I.briefcase(12) }),
              open.length ? Chip(open.length + ' abierto' + (open.length === 1 ? '' : 's'), { tone: 'on' }) : null,
              overdue ? Chip(overdue + ' tarea(s) vencida(s)', { tone: 'err' }) : null,
              risks ? Chip(risks + ' riesgo(s) crítico(s)', { tone: 'err' }) : null),
            running.length ? h('div', null,
              h('div', { className: 'kp-sec-note', style: { marginBottom: '4px' } }, 'Avance medio de sus proyectos en ejecución'),
              Bar(prog, { large: true })) : null,
            h('div', { style: { display: 'flex', gap: '6px', marginTop: 'auto', flexWrap: 'wrap' } },
              h('button', { className: 'kp-btn kp-btn-sm', onClick: () => setUi((u) => ({ ...u, tab: 'proyectos', filterClient: c.id, q: '' })) }, 'Ver proyectos'),
              h('button', {
                className: 'kp-btn kp-btn-sm',
                onClick: () => setUi((u) => ({ ...u, editor: { type: 'project', data: newProject({ clientId: c.id }), isNew: true } })),
              }, I.plus(13), 'Proyecto'),
              list.length === 1 ? h('button', { className: 'kp-btn kp-btn-sm', onClick: () => go(list[0].id, 'resumen') }, 'Abrir') : null));
        })));
  }

  // ── Cartera de proyectos ────────────────────────────────────────────────
  function viewProjects(ctx) {
    const { m, port, ui, setUi, go, cfg } = ctx;
    const q = canon(ui.q);
    let list = m.projects.filter((p) => {
      if (ui.filterClient && p.clientId !== ui.filterClient) return false;
      if (ui.filterStatus && p.status !== ui.filterStatus) return false;
      if (ui.filterHealth && port.stats.get(p.id).health !== ui.filterHealth) return false;
      if (!q) return true;
      return canon([p.name, p.code, p.objective, clientName(p.clientId), arr(p.tags).join(' ')].join(' ')).includes(q);
    });
    const order = { critical: 0, at_risk: 1, on_track: 2 };
    list = list.slice().sort((a, b) => {
      const sa = port.stats.get(a.id), sb = port.stats.get(b.id);
      const oa = (OPEN_STATUS.includes(a.status) ? 0 : 10) + n(order[sa.health], 3);
      const ob = (OPEN_STATUS.includes(b.status) ? 0 : 10) + n(order[sb.health], 3);
      if (oa !== ob) return oa - ob;
      return s(a.endDate).localeCompare(s(b.endDate));
    });

    if (!list.length) {
      return h('div', { className: 'kp-scroll' },
        Empty(I.briefcase(34), m.projects.length ? 'Ningún proyecto coincide con el filtro' : 'Sin proyectos todavía',
          m.projects.length ? 'Prueba a limpiar la búsqueda o los filtros de cliente, estado y salud.'
            : 'Crea el primero: nombre, cliente y fechas bastan para empezar; el plan lo puede proponer el analista.',
          h('button', {
            className: 'kp-btn kp-btn-primary', style: { marginTop: '8px' },
            onClick: () => setUi((u) => ({ ...u, editor: { type: 'project', data: newProject({ clientId: ui.filterClient || (m.clients[0] || {}).id || '' }), isNew: true } })),
          }, I.plus(15), 'Nuevo proyecto')));
    }

    return h('div', { className: 'kp-scroll' },
      h('div', { className: 'kp-grid kp-grid-auto' }, list.map((p) => {
        const st = port.stats.get(p.id);
        const client = findClient(p.clientId);
        const days = st.daysLeft;
        return h('div', {
          key: p.id, className: 'kp-proj', role: 'button', tabIndex: 0,
          onClick: () => go(p.id, 'resumen'),
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(p.id, 'resumen'); } },
        },
          h('div', { className: 'kp-proj-hd' },
            ClientDot(client),
            h('div', { style: { minWidth: 0, flex: 1 } },
              h('div', { className: 'kp-proj-name' }, p.name),
              h('div', { className: 'kp-proj-client' }, clientName(p.clientId) + (p.code ? ' · ' + p.code : ''))),
            HealthChip(st.health)),
          h('div', null,
            Bar(st.progress, { large: true, color: st.health === 'critical' ? 'var(--kp-err)' : st.health === 'at_risk' ? 'var(--kp-warn)' : 'var(--kp-accent)' }),
            st.expected == null ? null : h('div', { className: 'kp-sec-note', style: { marginTop: '3px' } },
              'Esperado a hoy ' + pct(st.expected) + ' · ' + (st.deviation >= 0 ? '+' : '') + Math.round(st.deviation) + ' pts')),
          h('div', { className: 'kp-chips' },
            StatusChip(p.status),
            st.tasksTotal ? Chip(st.tasksDone + '/' + st.tasksTotal + ' tareas', { icon: I.check(12) }) : null,
            st.tasksOverdue ? Chip(st.tasksOverdue + ' vencida(s)', { tone: 'err' }) : null,
            st.risksCritical ? Chip(st.risksCritical + ' riesgo(s) crítico(s)', { tone: 'err' }) : null,
            st.docs ? Chip(st.docs + ' doc.', { icon: I.docs(12) }) : null),
          h('div', { className: 'kp-proj-meta' },
            h('span', null, st.nextMilestone ? I.flag(12) : I.clock(12), ' ',
              st.nextMilestone ? st.nextMilestone.name.slice(0, 28) + (st.nextMilestone.name.length > 28 ? '…' : '') : 'Sin hitos'),
            h('span', { className: days != null && days < 0 ? 'kp-strong' : '', style: days != null && days < 0 ? { color: 'var(--kp-err)' } : null },
              days == null ? '' : days < 0 ? Math.abs(days) + ' d. vencido' : days + ' d. restantes')),
          cfg.showFinance !== false && n(p.budget) ? h('div', { className: 'kp-sec-note' }, I.money(12), ' ', fmtMoney(p.budget, p.currency)) : null);
      })));
  }

  // ── Proyecto · Resumen (tablero propio del proyecto) ────────────────────
  function viewProjectSummary(ctx, p, st) {
    const { cfg, setUi, setPTab } = ctx;
    const money = cfg.showFinance !== false;
    const tasks = arr(p.tasks);
    const byStatus = TASK_STATUS.map(([k, label]) => ({
      key: k, label, value: tasks.filter((t) => t.status === k).length,
      color: k === 'done' ? 'var(--kp-ok)' : k === 'blocked' ? 'var(--kp-err)' : k === 'in_progress' ? 'var(--kp-s1)' : 'var(--kp-silver)',
    })).filter((x) => x.value > 0);

    const phases = arr(p.phases).slice().sort((a, b) => n(a.order) - n(b.order));
    const phaseItems = phases.map((f) => {
      const list = tasks.filter((t) => t.phaseId === f.id);
      const w = sum(list, (t) => Math.max(0.1, n(t.weight, 1)));
      const prog = w ? sum(list, (t) => taskProgress(t) * Math.max(0.1, n(t.weight, 1))) / w : 0;
      return {
        key: f.id, label: f.name, value: Math.round(prog), display: Math.round(prog) + '%',
        note: list.length + ' tareas', color: 'var(--kp-s1)',
      };
    }).filter((x) => x.note !== '0 tareas');

    const attention = st.overdue.map((t) => ({ t, tone: 'err', why: 'vencida hace ' + Math.abs(daysFromToday(t.endDate)) + ' d' }))
      .concat(st.blocked.filter((t) => !st.overdue.includes(t)).map((t) => ({ t, tone: 'err', why: 'bloqueada' })))
      .concat(st.dueSoon.map((t) => ({ t, tone: 'warn', why: 'vence en ' + daysFromToday(t.endDate) + ' d' })))
      .slice(0, 10);

    return h('div', { className: 'kp-scroll' },
      h('div', { className: 'kp-sec kp-card kp-card-pad', style: { display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' } },
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', flex: '1 1 260px', minWidth: 0 } },
          Ring({
            value: st.progress, expected: st.expected, caption: 'avance', size: 124,
            color: st.health === 'critical' ? 'var(--kp-err)' : st.health === 'at_risk' ? 'var(--kp-warn)' : 'var(--kp-accent)',
          }),
          h('div', { style: { minWidth: 0 } },
            h('div', { className: 'kp-chips', style: { marginBottom: '6px' } }, StatusChip(p.status), HealthChip(st.health),
              Chip(labelOf(PRIORITY, p.priority) + ' prioridad', {})),
            h('div', { className: 'kp-sec-note' },
              st.deviation == null ? 'Sin fechas suficientes para calcular la desviación.'
                : st.deviation >= 0
                  ? 'Va ' + Math.round(st.deviation) + ' puntos por sobre el avance esperado a hoy (' + pct(st.expected) + ').'
                  : 'Va ' + Math.abs(Math.round(st.deviation)) + ' puntos por debajo del avance esperado a hoy (' + pct(st.expected) + ').'),
            h('div', { className: 'kp-sec-note', style: { marginTop: '4px' } },
              fmtDay(p.startDate) + ' → ' + fmtDay(p.endDate) +
              (st.daysLeft == null ? '' : st.daysLeft < 0 ? ' · ' + Math.abs(st.daysLeft) + ' días vencido' : ' · ' + st.daysLeft + ' días restantes')))),
        h('div', { className: 'kp-grid kp-grid-3', style: { flex: '2 1 420px' } },
          Kpi('Tareas', st.tasksDone + '/' + st.tasksTotal, { key: 'p1', icon: I.check(14), foot: st.tasksRunning + ' en curso · ' + st.tasksBlocked + ' bloqueadas', bar: st.tasksTotal ? (st.tasksDone / st.tasksTotal) * 100 : 0 }),
          Kpi('Vencidas', fmtNum(st.tasksOverdue), { key: 'p2', icon: I.clock(14), tone: st.tasksOverdue ? 'err' : 'ok', foot: st.tasksDueSoon + ' por vencer' }),
          Kpi('Hitos', st.milestonesDone + '/' + st.milestonesTotal, { key: 'p3', icon: I.flag(14), tone: st.lateMilestones ? 'err' : undefined, foot: st.nextMilestone ? 'próximo: ' + fmtDayShort(st.nextMilestone.date) : 'sin hitos pendientes' }),
          Kpi('Riesgos abiertos', fmtNum(st.risksOpen), { key: 'p4', icon: I.risk(14), tone: st.risksCritical ? 'err' : st.risksSerious ? 'warn' : undefined, foot: st.risksCritical + ' críticos · ' + st.risksSerious + ' altos' }),
          Kpi('Documentos', fmtNum(st.docs), { key: 'p5', icon: I.docs(14), foot: st.docsReviewed + ' revisados' }),
          money
            ? Kpi('Presupuesto', n(p.budget) ? fmtMoney(p.budget, p.currency) : '—', {
              key: 'p6', icon: I.money(14),
              tone: st.budgetState === 'over' ? 'err' : st.budgetState === 'watch' ? 'warn' : undefined,
              foot: st.budgetPlanned
                ? 'costeo: ' + fmtMoney(st.budgetPlanned, p.currency) +
                  (st.overrunPct == null ? '' : ' · ' + (st.overrunPct >= 0 ? '+' : '') + fmtNum(st.overrunPct, 1) + '%')
                : 'sin líneas de costeo',
            })
            : Kpi('Consultas', fmtNum(st.openQuestions), { key: 'p6', icon: I.alert(14), foot: 'abiertas con el cliente' }))),

      st.budgetState === 'over' || st.budgetState === 'watch'
        ? h('div', { className: 'kp-sec' },
          Note(h('span', null,
            h('strong', null, 'El costeo por líneas supera el presupuesto en ' + fmtMoney(st.overrun, p.currency) +
              ' (' + fmtNum(st.overrunPct, 1) + '%).'),
            ' ' + (st.budgetState === 'over'
              ? 'Está por encima del umbral de alerta. Revisa el puente contra la línea base en la pestaña Economía: dice exactamente qué partidas lo movieron.'
              : 'Todavía dentro del umbral de alerta, pero conviene mirarlo.')),
          st.budgetState === 'over' ? 'err' : 'warn', I.alert(15)))
        : null,

      p.objective ? h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Objetivo'),
        h('div', { style: { font: '400 13px/1.6 Inter, sans-serif' } }, p.objective)) : null,

      h('div', { className: 'kp-sec kp-split' },
        h('div', { className: 'kp-card kp-card-pad' },
          SectionHead('Avance por fase', phaseItems.length ? null : 'Sin fases con tareas todavía',
            h('button', { className: 'kp-btn kp-btn-sm', onClick: () => setPTab('plan') }, 'Ver plan', I.arrowRight(13))),
          phaseItems.length ? BarsH({ items: phaseItems, max: 100, labelW: 170 })
            : h('div', { className: 'kp-sec-note' }, 'Cuando el plan tenga fases con tareas, aquí se ve cuánto lleva cada una.')),
        h('div', { style: { display: 'grid', gap: '12px', alignContent: 'start' } },
          byStatus.length ? h('div', { className: 'kp-card kp-card-pad' },
            SectionHead('Tareas por estado'),
            Donut({ caption: 'tareas', items: byStatus })) : null,
          st.nextMilestone ? h('div', { className: 'kp-card kp-card-pad' },
            SectionHead('Próximo hito'),
            h('div', { className: 'kp-strong', style: { marginBottom: '4px' } }, st.nextMilestone.name),
            h('div', { className: 'kp-sec-note' }, fmtDay(st.nextMilestone.date) +
              (daysFromToday(st.nextMilestone.date) != null
                ? ' · ' + (daysFromToday(st.nextMilestone.date) < 0
                  ? 'vencido hace ' + Math.abs(daysFromToday(st.nextMilestone.date)) + ' días'
                  : 'en ' + daysFromToday(st.nextMilestone.date) + ' días') : '')),
            st.nextMilestone.notes ? h('div', { className: 'kp-sec-note', style: { marginTop: '6px' } }, st.nextMilestone.notes) : null) : null)),

      h('div', { className: 'kp-sec kp-split' },
        h('div', { className: 'kp-card kp-card-pad' },
          SectionHead('Requiere atención', attention.length ? attention.length + ' tarea(s)' : 'Nada atrasado ni bloqueado'),
          attention.length
            ? h('div', { className: 'kp-feed' }, attention.map((x) => h('div', { key: x.t.id, className: 'kp-feed-it' },
              h('span', { className: 'kp-feed-dot', style: { color: x.tone === 'err' ? 'var(--kp-err)' : 'var(--kp-warn)' } },
                x.tone === 'err' ? I.alert(14) : I.clock(14)),
              h('div', { className: 'kp-feed-txt', style: { flex: 1 } },
                h('button', {
                  className: 'kp-crumb-btn kp-strong', style: { color: 'var(--kp-fg)' },
                  onClick: () => setUi((u) => ({ ...u, editor: { type: 'task', data: Object.assign({}, x.t), projectId: p.id } })),
                }, x.t.name),
                h('div', { className: 'kp-feed-when' }, x.why + (x.t.owner ? ' · ' + x.t.owner : '') + ' · ' + pct(taskProgress(x.t)))))))
            : Empty(I.check(24), 'Al día', 'Ninguna tarea vencida, bloqueada ni por vencer en la ventana de alerta.')),
        h('div', { className: 'kp-card kp-card-pad' },
          SectionHead('Riesgos principales', st.risksOpen + ' abiertos',
            h('button', { className: 'kp-btn kp-btn-sm', onClick: () => setPTab('riesgos') }, 'Ver matriz', I.arrowRight(13))),
          st.topRisks.length
            ? h('div', { className: 'kp-feed' }, st.topRisks.slice(0, 6).map((r) => {
              const lvl = riskLevel(r);
              return h('div', { key: r.id, className: 'kp-feed-it' },
                h('span', { className: 'kp-feed-dot', style: { color: riskLevelColor(lvl) } }, I.risk(14)),
                h('div', { className: 'kp-feed-txt', style: { flex: 1 } },
                  h('button', {
                    className: 'kp-crumb-btn', style: { color: 'var(--kp-fg)', textAlign: 'left' },
                    onClick: () => setUi((u) => ({ ...u, editor: { type: 'risk', data: Object.assign({}, r), projectId: p.id } })),
                  }, r.title),
                  h('div', { className: 'kp-feed-when' }, RISK_LEVEL_LABEL[lvl] + ' · severidad ' + riskScore(r) + '/25 · ' + r.category)));
            }))
            : Empty(I.check(24), 'Sin riesgos abiertos', 'Registrar riesgos temprano es lo que separa un proyecto dirigido de uno improvisado.'))));
  }

  // ── Proyecto · Plan ─────────────────────────────────────────────────────
  function viewProjectPlan(ctx, p, st) {
    const { ui, setUi, cfg } = ctx;
    const phases = arr(p.phases).slice().sort((a, b) => n(a.order) - n(b.order));
    const fTask = (t) => {
      if (ui.planStatus && t.status !== ui.planStatus) return false;
      if (ui.planOwner && canon(t.owner) !== canon(ui.planOwner)) return false;
      if (ui.q && !canon(t.name + ' ' + t.owner + ' ' + t.deliverable).includes(canon(ui.q))) return false;
      return true;
    };
    const visible = arr(p.tasks).filter(fTask);
    const owners = uniq(arr(p.tasks).map((t) => s(t.owner)).filter(Boolean)).sort();
    const groups = phases.map((f) => ({ phase: f, tasks: visible.filter((t) => t.phaseId === f.id) }));
    const loose = visible.filter((t) => !phases.some((f) => f.id === t.phaseId));
    if (loose.length) groups.push({ phase: { id: '', name: 'Sin fase' }, tasks: loose });

    const addTask = (phaseId) => setUi((u) => ({
      ...u, editor: { type: 'task', isNew: true, projectId: p.id, data: newTask({ phaseId, startDate: today(), endDate: addDays(today(), 7) }) },
    }));

    const taskRow = (t) => {
      const late = !taskDone(t) && t.endDate && daysFromToday(t.endDate) < 0;
      return h('tr', { key: t.id },
        h('td', { style: { maxWidth: '340px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
            h('input', {
              type: 'checkbox', checked: taskDone(t), title: 'Marcar como completada',
              onChange: () => actions.setTaskStatus(p.id, t.id, taskDone(t) ? 'pending' : 'done'),
            }),
            h('button', {
              className: 'kp-crumb-btn', style: { color: 'var(--kp-fg)', textAlign: 'left', fontWeight: 500 },
              onClick: () => setUi((u) => ({ ...u, editor: { type: 'task', data: Object.assign({}, t), projectId: p.id } })),
            }, t.name)),
          t.deliverable ? h('div', { className: 'kp-sec-note', style: { paddingLeft: '22px' } }, 'Entregable: ' + t.deliverable) : null),
        h('td', null, h('input', {
          className: 'kp-cellinput', value: s(t.owner), placeholder: 'Responsable',
          onChange: (e) => actions.upsert(p.id, 'tasks', Object.assign({}, t, { owner: e.target.value })),
        })),
        h('td', null, h('input', {
          className: 'kp-cellinput', type: 'date', value: s(t.startDate),
          onChange: (e) => actions.upsert(p.id, 'tasks', Object.assign({}, t, { startDate: e.target.value })),
        })),
        h('td', { style: late ? { color: 'var(--kp-err)' } : null }, h('input', {
          className: 'kp-cellinput', type: 'date', value: s(t.endDate),
          onChange: (e) => actions.upsert(p.id, 'tasks', Object.assign({}, t, { endDate: e.target.value })),
        })),
        h('td', null, Select(t.status, TASK_STATUS, (v) => actions.setTaskStatus(p.id, t.id, v), { className: 'kp-cellinput' })),
        h('td', { style: { minWidth: '150px' } },
          h('div', { className: 'kp-bar-row' },
            h('input', {
              type: 'range', min: 0, max: 100, step: 5, value: taskProgress(t), style: { width: '90px' },
              title: 'Avance de la tarea',
              onChange: (e) => actions.setTaskProgress(p.id, t.id, e.target.value),
            }),
            h('span', { className: 'kp-bar-num' }, pct(taskProgress(t))))),
        h('td', { className: 'kp-td-act' },
          IconBtn(I.trash(13), 'Eliminar tarea', () => setUi((u) => ({
            ...u, editor: { type: 'confirm', title: 'Eliminar la tarea', text: '¿Eliminar "' + t.name + '"? No se puede deshacer.', onOk: () => actions.remove(p.id, 'tasks', t.id) },
          })), { ghost: true, tone: 'danger' })));
    };

    return h('div', { className: 'kp-body' },
      h('div', { className: 'kp-toolbar' },
        h('div', { className: 'kp-search kp-toolbar-grow' }, I.search(14),
          Input(ui.q, (v) => setUi((u) => ({ ...u, q: v })), { placeholder: 'Buscar tarea, responsable o entregable…' })),
        Select(ui.planStatus, [['', 'Todos los estados']].concat(TASK_STATUS), (v) => setUi((u) => ({ ...u, planStatus: v })), { style: { width: 'auto' } }),
        owners.length ? Select(ui.planOwner, [['', 'Todos los responsables']].concat(owners.map((o) => [o, o])), (v) => setUi((u) => ({ ...u, planOwner: v })), { style: { width: 'auto' } }) : null,
        h('button', { className: 'kp-btn kp-btn-sm', onClick: () => setUi((u) => ({ ...u, editor: { type: 'phase', isNew: true, projectId: p.id, data: { id: uid('fas'), name: '', order: phases.length } } })) }, I.plus(13), 'Fase'),
        h('button', { className: 'kp-btn kp-btn-sm', onClick: () => setUi((u) => ({ ...u, editor: { type: 'milestone', isNew: true, projectId: p.id, data: newMilestone({ date: today() }) } })) }, I.flag(13), 'Hito'),
        h('button', { className: 'kp-btn kp-btn-sm kp-btn-primary', onClick: () => addTask((phases[0] || {}).id || '') }, I.plus(13), 'Tarea')),

      h('div', { className: cx('kp-scroll', cfg.denseTables && 'kp-dense') },
        h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Línea temporal', 'Barras por tarea, rombos en los hitos, la línea roja es hoy y las franjas rojas son ventanas bloqueadas.'),
          Timeline({ project: p, tasks: visible })),

        arr(p.milestones).length ? h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Hitos', st.milestonesDone + ' de ' + st.milestonesTotal + ' cumplidos'),
          h('div', { className: 'kp-chips' }, arr(p.milestones).slice().sort((a, b) => s(a.date).localeCompare(s(b.date))).map((mm) => {
            const late = mm.status !== 'done' && mm.date && daysFromToday(mm.date) < 0;
            return Chip(mm.name + ' · ' + fmtDayShort(mm.date), {
              key: mm.id, tone: mm.status === 'done' ? 'ok' : late ? 'err' : undefined,
              icon: I.flag(12), title: mm.notes || '',
              onClick: () => setUi((u) => ({ ...u, editor: { type: 'milestone', data: Object.assign({}, mm), projectId: p.id } })),
            });
          }))) : null,

        !arr(p.tasks).length
          ? Empty(I.plan(30), 'El plan está vacío',
            'Puedes crear las fases y tareas a mano, o pedirle al analista que proponga un plan completo a partir de la documentación del proyecto.',
            h('div', { className: 'kp-chips', style: { marginTop: '10px' } },
              h('button', { className: 'kp-btn kp-btn-primary', onClick: () => ctx.setPTab('analista') }, I.sparkles(15), 'Proponer un plan'),
              h('button', { className: 'kp-btn', onClick: () => addTask('') }, I.plus(15), 'Crear tarea')))
          : groups.map((g) => (!g.tasks.length && (ui.q || ui.planStatus || ui.planOwner) ? null :
            h('div', { key: g.phase.id || 'loose', className: 'kp-sec' },
              SectionHead(g.phase.name, g.tasks.length + ' tarea' + (g.tasks.length === 1 ? '' : 's'),
                h('div', { className: 'kp-chips' },
                  g.phase.id ? IconBtn(I.pencil(13), 'Renombrar fase', () => setUi((u) => ({ ...u, editor: { type: 'phase', projectId: p.id, data: Object.assign({}, g.phase) } })), { ghost: true }) : null,
                  h('button', { className: 'kp-btn kp-btn-sm', onClick: () => addTask(g.phase.id) }, I.plus(12), 'Tarea'))),
              g.tasks.length ? h('div', { className: 'kp-tablewrap' },
                h('table', { className: 'kp-table' },
                  h('thead', null, h('tr', null,
                    h('th', null, 'Tarea'), h('th', null, 'Responsable'), h('th', null, 'Inicio'),
                    h('th', null, 'Término'), h('th', null, 'Estado'), h('th', null, 'Avance'), h('th', null, ''))),
                  h('tbody', null, g.tasks.slice().sort((a, b) => s(a.startDate).localeCompare(s(b.startDate))).map(taskRow))))
                : h('div', { className: 'kp-sec-note' }, 'Sin tareas en esta fase.'))))));
  }

  // ── Proyecto · Riesgos ──────────────────────────────────────────────────
  function viewProjectRisks(ctx, p) {
    const { ui, setUi, cfg } = ctx;
    const risks = arr(p.risks);
    const cell = (prob, imp) => risks.filter((r) => n(r.probability, 3) === prob && n(r.impact, 3) === imp
      && r.status !== 'closed' && r.status !== 'mitigated');
    const cellTone = (score) => (score >= 15 ? 'var(--kp-err)' : score >= 9 ? 'var(--kp-serious)' : score >= 5 ? 'var(--kp-warn)' : 'var(--kp-ok)');
    const filtered = risks.filter((r) => {
      if (ui.riskCell) {
        const [pp, ii] = ui.riskCell.split(':').map(Number);
        if (n(r.probability, 3) !== pp || n(r.impact, 3) !== ii) return false;
      }
      if (ui.riskStatus && r.status !== ui.riskStatus) return false;
      if (ui.q && !canon(r.title + ' ' + r.mitigation + ' ' + r.category + ' ' + r.owner).includes(canon(ui.q))) return false;
      return true;
    }).sort((a, b) => riskScore(b) - riskScore(a));

    const SCALE = ['Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'];
    const IMPACT = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'];

    return h('div', { className: 'kp-body' },
      h('div', { className: 'kp-toolbar' },
        h('div', { className: 'kp-search kp-toolbar-grow' }, I.search(14),
          Input(ui.q, (v) => setUi((u) => ({ ...u, q: v })), { placeholder: 'Buscar riesgo, mitigación o responsable…' })),
        Select(ui.riskStatus, [['', 'Todos los estados']].concat(RISK_STATUS), (v) => setUi((u) => ({ ...u, riskStatus: v })), { style: { width: 'auto' } }),
        ui.riskCell ? h('button', { className: 'kp-btn kp-btn-sm', onClick: () => setUi((u) => ({ ...u, riskCell: '' })) }, I.x(13), 'Quitar filtro de la matriz') : null,
        h('button', {
          className: 'kp-btn kp-btn-sm kp-btn-primary',
          onClick: () => setUi((u) => ({ ...u, editor: { type: 'risk', isNew: true, projectId: p.id, data: newRisk() } })),
        }, I.plus(13), 'Riesgo')),

      h('div', { className: cx('kp-scroll', cfg.denseTables && 'kp-dense') },
        h('div', { className: 'kp-sec kp-split' },
          h('div', { className: 'kp-card kp-card-pad' },
            SectionHead('Matriz de riesgos', 'Probabilidad × impacto. Haz clic en una celda para filtrar la tabla.'),
            h('div', { className: 'kp-matrix' },
              h('div', { className: 'kp-matrix-ax' }, ''),
              [1, 2, 3, 4, 5].map((prob) => h('div', { key: 'hp' + prob, className: 'kp-matrix-ax' }, SCALE[prob - 1])),
              [5, 4, 3, 2, 1].map((imp) => [
                h('div', { key: 'hi' + imp, className: 'kp-matrix-ax' }, IMPACT[imp - 1]),
                [1, 2, 3, 4, 5].map((prob) => {
                  const list = cell(prob, imp);
                  const score = prob * imp;
                  const on = ui.riskCell === prob + ':' + imp;
                  return h('div', {
                    key: 'c' + prob + imp,
                    className: cx('kp-matrix-cell', list.length && 'kp-has'),
                    title: 'Probabilidad ' + SCALE[prob - 1].toLowerCase() + ' · impacto ' + IMPACT[imp - 1].toLowerCase()
                      + ' · severidad ' + score + '/25' + (list.length ? ' · ' + list.length + ' riesgo(s)' : ''),
                    style: {
                      background: cellTone(score), opacity: list.length ? 0.92 : 0.16,
                      color: '#fff', borderColor: on ? 'var(--kp-fg)' : 'transparent',
                    },
                    onClick: () => (list.length ? setUi((u) => ({ ...u, riskCell: on ? '' : prob + ':' + imp })) : null),
                  }, list.length || '');
                }),
              ]),
              h('div', { className: 'kp-matrix-ax' }, ''),
              h('div', { className: 'kp-matrix-ax', style: { gridColumn: 'span 5' } }, 'PROBABILIDAD →')),
            h('div', { className: 'kp-legend' },
              [['Bajo', 'var(--kp-ok)'], ['Medio', 'var(--kp-warn)'], ['Alto', 'var(--kp-serious)'], ['Crítico', 'var(--kp-err)']]
                .map(([label, color]) => h('span', { key: label, className: 'kp-legend-it' },
                  h('span', { className: 'kp-legend-sw', style: { background: color } }), label))),
            h('div', { className: 'kp-sec-note', style: { marginTop: '6px' } }, 'El eje vertical es el impacto: arriba, el más alto.')),
          h('div', { style: { display: 'grid', gap: '12px', alignContent: 'start' } },
            h('div', { className: 'kp-card kp-card-pad' },
              SectionHead('Riesgos por categoría'),
              (() => {
                const cats = uniq(risks.map((r) => r.category)).map((c, i) => ({
                  key: c, label: c, value: risks.filter((r) => r.category === c).length, color: seriesColor(i),
                })).sort((a, b) => b.value - a.value).slice(0, 6);
                return cats.length ? Donut({ caption: 'riesgos', items: cats })
                  : h('div', { className: 'kp-sec-note' }, 'Sin riesgos registrados.');
              })()),
            h('div', { className: 'kp-card kp-card-pad' },
              SectionHead('Estado de la gestión'),
              h('div', { className: 'kp-chips' }, RISK_STATUS.map(([k, label]) => {
                const c = risks.filter((r) => r.status === k).length;
                return c ? Chip(label + ': ' + c, { key: k, tone: k === 'hit' ? 'err' : k === 'mitigated' || k === 'closed' ? 'ok' : undefined }) : null;
              }))))),

        h('div', { className: 'kp-sec' },
          SectionHead('Registro de riesgos', filtered.length + ' de ' + risks.length),
          filtered.length ? h('div', { className: 'kp-tablewrap' },
            h('table', { className: 'kp-table' },
              h('thead', null, h('tr', null,
                h('th', null, 'Riesgo'), h('th', null, 'Categoría'), h('th', { className: 'kp-td-num' }, 'Prob.'),
                h('th', { className: 'kp-td-num' }, 'Impacto'), h('th', { className: 'kp-td-num' }, 'Sev.'),
                h('th', null, 'Nivel'), h('th', null, 'Estado'), h('th', null, ''))),
              h('tbody', null, filtered.map((r) => {
                const lvl = riskLevel(r);
                return h('tr', { key: r.id },
                  h('td', { style: { maxWidth: '420px' } },
                    h('button', {
                      className: 'kp-crumb-btn kp-strong', style: { color: 'var(--kp-fg)', textAlign: 'left' },
                      onClick: () => setUi((u) => ({ ...u, editor: { type: 'risk', data: Object.assign({}, r), projectId: p.id } })),
                    }, r.title),
                    r.mitigation ? h('div', { className: 'kp-sec-note' }, 'Mitigación: ' + r.mitigation) : null),
                  h('td', { className: 'kp-nowrap' }, r.category),
                  h('td', { className: 'kp-td-num' }, n(r.probability, 3)),
                  h('td', { className: 'kp-td-num' }, n(r.impact, 3)),
                  h('td', { className: 'kp-td-num kp-strong' }, riskScore(r)),
                  h('td', null, Chip(RISK_LEVEL_LABEL[lvl], { color: riskLevelColor(lvl) })),
                  h('td', null, Select(r.status, RISK_STATUS, (v) => actions.upsert(p.id, 'risks', Object.assign({}, r, { status: v })), { className: 'kp-cellinput' })),
                  h('td', { className: 'kp-td-act' }, IconBtn(I.trash(13), 'Eliminar riesgo', () => setUi((u) => ({
                    ...u, editor: { type: 'confirm', title: 'Eliminar el riesgo', text: '¿Eliminar "' + r.title + '"?', onOk: () => actions.remove(p.id, 'risks', r.id) },
                  })), { ghost: true, tone: 'danger' })));
              }))))
            : Empty(I.risk(28), risks.length ? 'Ningún riesgo coincide con el filtro' : 'Sin riesgos registrados',
              risks.length ? 'Quita el filtro de la matriz o del estado.' : 'Un proyecto sin riesgos anotados no es un proyecto sin riesgos.'))));
  }

  // ── Proyecto · Documentos y fuentes ─────────────────────────────────────
  function viewProjectDocs(ctx, p) {
    const { ui, setUi } = ctx;
    const docs = arr(p.documents);
    const sources = arr(model.sources).filter((x) => x.projectId === p.id);
    const filtered = docs.filter((d) => {
      if (ui.docKind && d.kind !== ui.docKind) return false;
      if (ui.docSource && d.sourceId !== ui.docSource) return false;
      if (ui.q && !canon(d.name + ' ' + d.notes + ' ' + d.path + ' ' + arr(d.tags).join(' ')).includes(canon(ui.q))) return false;
      return true;
    }).sort((a, b) => s(b.addedAt).localeCompare(s(a.addedAt)));
    const kinds = DOC_KINDS.map(([k, label]) => ({ k, label, count: docs.filter((d) => d.kind === k).length })).filter((x) => x.count);
    const totalSize = sum(docs, (d) => n(d.size));

    const onDrop = async (e) => {
      e.preventDefault();
      setUi((u) => ({ ...u, dropOn: false }));
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      const res = await ingestFiles(files, p.id, { origin: 'upload' });
      commit((m) => m);
      shell.notify && shell.notify({ level: 'success', text: res.added + ' documento(s) añadidos a la biblioteca.' });
    };

    return h('div', { className: 'kp-body' },
      h('div', { className: 'kp-toolbar' },
        h('div', { className: 'kp-search kp-toolbar-grow' }, I.search(14),
          Input(ui.q, (v) => setUi((u) => ({ ...u, q: v })), { placeholder: 'Buscar documento, ruta o etiqueta…' })),
        kinds.length ? Select(ui.docKind, [['', 'Todos los tipos']].concat(kinds.map((x) => [x.k, x.label + ' (' + x.count + ')'])), (v) => setUi((u) => ({ ...u, docKind: v })), { style: { width: 'auto' } }) : null,
        sources.length ? Select(ui.docSource, [['', 'Todas las fuentes']].concat(sources.map((x) => [x.id, x.label])), (v) => setUi((u) => ({ ...u, docSource: v })), { style: { width: 'auto' } }) : null,
        h('button', { className: 'kp-btn kp-btn-sm', onClick: () => pickFiles(p.id, { origin: 'upload' }) }, I.upload(13), 'Cargar archivos'),
        h('button', { className: 'kp-btn kp-btn-sm', onClick: () => connectLocalFolder(p.id) }, I.folders(13), 'Conectar carpeta'),
        h('button', {
          className: 'kp-btn kp-btn-sm',
          onClick: () => setUi((u) => ({ ...u, editor: { type: 'cloud', projectId: p.id, data: { url: '', label: '', kind: 'drive', listing: '' } } })),
        }, I.drive(13), 'Drive / nube'),
        h('button', {
          className: 'kp-btn kp-btn-sm kp-btn-primary',
          onClick: () => setUi((u) => ({ ...u, editor: { type: 'doc', isNew: true, projectId: p.id, data: newDoc({ kind: 'link' }) } })),
        }, I.plus(13), 'Ficha manual')),

      h('div', { className: 'kp-scroll' },
        h('div', { className: 'kp-sec' },
          SectionHead('Fuentes conectadas', sources.length ? null : 'Ninguna todavía'),
          sources.length ? h('div', { className: 'kp-grid kp-grid-3' }, sources.map((src) => h('div', { key: src.id, className: 'kp-card kp-card-pad' },
            h('div', { style: { display: 'flex', gap: '9px', alignItems: 'flex-start' } },
              h('span', { className: 'kp-hd-mark' }, src.kind === 'drive' ? I.drive(15) : src.kind === 'cloud' ? I.cloud(15) : I.folders(15)),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { className: 'kp-strong kp-ellip' }, src.label),
                h('div', { className: 'kp-sec-note' }, labelOf(SOURCE_KINDS, src.kind) +
                  (src.fileCount ? ' · ' + src.fileCount + ' archivos' : '') +
                  (src.lastScan ? ' · leída ' + fmtWhen(src.lastScan) : '')),
                src.url ? h('a', { className: 'kp-sec-note kp-ellip', href: src.url, target: '_blank', rel: 'noreferrer noopener', style: { display: 'block', color: 'var(--kp-accent)' } }, src.url) : null),
              h('div', { style: { display: 'flex', gap: '4px' } },
                src.kind === 'folder' ? IconBtn(I.refresh(13), 'Volver a leer la carpeta', () => rescanSource(src.id), { ghost: true }) : null,
                IconBtn(I.trash(13), 'Quitar la fuente', () => setUi((u) => ({
                  ...u,
                  editor: {
                    type: 'confirm', title: 'Quitar la fuente',
                    text: 'Se quita "' + src.label + '" de la lista de fuentes. Los documentos ya indexados se conservan.',
                    onOk: () => removeSource(src.id, false),
                  },
                })), { ghost: true, tone: 'danger' })))))) : null,
          !sources.length ? Note(FSA_AVAILABLE
            ? 'Conecta una carpeta del disco (C:\\ u otra) y la app indexa su contenido: nombres, tipos, tamaños y rutas quedan disponibles para el analista. También puedes registrar una carpeta de Google Drive o cualquier enlace compartido. Los archivos no se copian al servidor.'
            : 'Este navegador no expone la File System Access API: al conectar una carpeta se leerá su contenido una vez (sin enlace vivo para re-sincronizar). También puedes registrar una carpeta de Google Drive o cualquier enlace compartido.', 'accent', I.folders(15)) : null),

        h('div', {
          className: cx('kp-sec', 'kp-drop', ui.dropOn && 'kp-drop-on'),
          onDragOver: (e) => { e.preventDefault(); if (!ui.dropOn) setUi((u) => ({ ...u, dropOn: true })); },
          onDragLeave: () => setUi((u) => ({ ...u, dropOn: false })),
          onDrop,
        },
          h('div', { className: 'kp-drop-title' }, 'Suelta aquí imágenes, videos, PDF, planos o planillas'),
          h('div', null, 'También puedes usar "Cargar archivos" o conectar una carpeta completa. ' +
            (docs.length ? docs.length + ' documento(s) indexados' + (totalSize ? ' · ' + fmtBytes(totalSize) + ' en disco' : '') + '.' : ''))),

        filtered.length
          ? h('div', { className: 'kp-grid kp-grid-3' }, filtered.map((d) => h('div', { key: d.id, className: 'kp-doc' },
            h('div', { className: 'kp-doc-thumb' }, d.thumb ? h('img', { src: d.thumb, alt: '' }) : docIcon(d.kind, 20)),
            h('div', { className: 'kp-doc-main' },
              h('button', {
                className: 'kp-crumb-btn kp-doc-name', style: { color: 'var(--kp-fg)', textAlign: 'left' },
                onClick: () => setUi((u) => ({ ...u, editor: { type: 'doc', data: Object.assign({}, d), projectId: p.id } })),
              }, d.name),
              h('div', { className: 'kp-doc-meta' },
                labelOf(DOC_KINDS, d.kind) + (d.size ? ' · ' + fmtBytes(d.size) : '') + ' · ' + fmtWhen(d.addedAt)),
              d.path && d.path !== d.name ? h('div', { className: 'kp-doc-meta kp-mono kp-ellip', title: d.path }, d.path) : null,
              h('div', { className: 'kp-chips' },
                d.reviewed ? Chip('Revisado', { tone: 'ok', icon: I.check(11) }) : null,
                d.dataUrl ? Chip('Incrustado', { icon: I.download(11) }) : null,
                d.url ? h('a', { key: 'lnk', className: 'kp-chip kp-chip-btn', href: d.url, target: '_blank', rel: 'noreferrer noopener' }, I.link(11), 'Abrir') : null,
                arr(d.tags).slice(0, 3).map((t) => Chip(t, { key: t }))))))) 
          : Empty(I.docs(28), docs.length ? 'Ningún documento coincide con el filtro' : 'La biblioteca está vacía',
            docs.length ? 'Prueba a limpiar la búsqueda o el filtro de tipo.'
              : 'Carga los documentos del prospecto o conecta su carpeta: el analista los lee para proponer el plan de trabajo.')));
  }


  // ── Render de una respuesta del analista ────────────────────────────────
  /** Convierte **negritas** en elementos React sin meter HTML crudo. */
  function richText(text) {
    const parts = s(text).split(/(\*\*[^*]+\*\*)/g).filter((x) => x !== '');
    return parts.map((chunk, i) => (chunk.startsWith('**') && chunk.endsWith('**')
      ? h('strong', { key: i }, chunk.slice(2, -2))
      : h('span', { key: i }, chunk)));
  }

  const cellOf = (c) => (c && typeof c === 'object' && !Array.isArray(c) ? c : { v: c });
  const toneStyle = (tone) => (tone === 'ok' ? { color: 'var(--kp-ok)' } : tone === 'err' ? { color: 'var(--kp-err)' }
    : tone === 'warn' ? { color: 'var(--kp-warn)' } : null);

  function renderBlocks(blocks) {
    return arr(blocks).map((b, i) => {
      if (!b) return null;
      if (b.t === 'h') return h('div', { key: i, className: 'kp-ans-h' }, b.text);
      if (b.t === 'p') return h('p', { key: i, className: 'kp-ans-p' }, richText(b.text));
      if (b.t === 'note') return h('div', { key: i, className: 'kp-ans-block' }, Note(richText(b.text), b.tone, b.tone === 'err' || b.tone === 'warn' ? I.alert(15) : I.info(15)));
      if (b.t === 'concl') {
        return h('div', { key: i, className: 'kp-ans-concl' },
          h('div', { className: 'kp-ans-concl-hd' }, I.target(13), 'LO QUE ESTO SIGNIFICA'),
          h('p', { className: 'kp-ans-p', style: { margin: 0 } }, richText(b.text)));
      }
      if (b.t === 'list') {
        return h(b.ordered ? 'ol' : 'ul', { key: i, className: 'kp-ans-list' },
          b.items.map((x, j) => h('li', { key: j }, richText(x))));
      }
      if (b.t === 'kv') {
        return h('div', { key: i, className: 'kp-ans-kv' }, b.items.map((x, j) => h('div', { key: j, className: 'kp-ans-kv-it' },
          h('span', { className: 'kp-ans-kv-k' }, x.k),
          h('span', { className: 'kp-ans-kv-v' }, x.v))));
      }
      if (b.t === 'bars') {
        return h('div', { key: i, className: 'kp-ans-block' }, BarsH({ items: b.items, labelW: 190 }));
      }
      if (b.t === 'table') {
        return h('div', { key: i, className: 'kp-tablewrap kp-ans-block' },
          h('table', { className: 'kp-table' },
            h('thead', null, h('tr', null, b.head.map((hd, j) => h('th', { key: j, className: j ? 'kp-td-num' : '' }, hd)))),
            h('tbody', null,
              b.rows.map((r, j) => h('tr', { key: j }, r.map((c, k) => {
                const cell = cellOf(c);
                return h('td', {
                  key: k,
                  className: cell.num ? 'kp-td-num' : '',
                  style: Object.assign({}, toneStyle(cell.tone), cell.strong ? { fontWeight: 600 } : null),
                }, s(cell.v));
              }))),
              b.footer ? h('tr', { className: 'kp-ans-foot' }, b.footer.map((c, k) => {
                const cell = cellOf(c);
                return h('td', {
                  key: k, className: cell.num ? 'kp-td-num' : '',
                  style: Object.assign({ fontWeight: 600 }, toneStyle(cell.tone)),
                }, s(cell.v));
              })) : null)));
      }
      return null;
    });
  }

  // ── Proyecto · Economía ─────────────────────────────────────────────────
  function viewProjectEconomics(ctx, p) {
    const { ui, setUi, cfg } = ctx;
    const e = computeEconomics(p, cfg);
    const cur = e.currency;
    const set = (patch) => actions.saveProject(p.id, patch);
    const setPricing = (patch) => set({ pricing: Object.assign({}, e.pricing, patch, { updatedAt: stamp() }) });
    const svc = e.service.svc;
    const setSvc = (patch) => set({ service: Object.assign({}, svc, patch, { updatedAt: stamp() }) });
    const lines = arr(p.budgetLines);
    const setLines = (next) => set({ budgetLines: next });
    const sub = ui.econTab || 'costeo';
    const setSub = (v) => setUi((u) => ({ ...u, econTab: v }));

    const overTone = e.budgetState === 'over' ? 'err' : e.budgetState === 'watch' ? 'warn' : 'ok';
    const kpis = h('div', { className: 'kp-grid kp-grid-4 kp-sec' },
      Kpi('CAPEX · inversión', money0(e.capexCost, cur), { key: 'e1', icon: I.money(14), foot: e.capexLines.length + ' partidas · precio ' + money0(e.capexPrice, cur) }),
      Kpi('OPEX · fee mensual', money0(e.opexMonthly, cur), { key: 'e2', icon: I.refresh(14), foot: e.term + ' meses · precio ' + money0(e.opexPrice, cur) + '/mes' }),
      Kpi('Costeo total', money0(e.costingTotal, cur), {
        key: 'e3', icon: I.chart(14), tone: e.budgetState === 'over' ? 'err' : e.budgetState === 'watch' ? 'warn' : undefined,
        foot: e.budget > 0
          ? 'presupuesto ' + money0(e.budget, cur) + ' · ' + (e.overrun >= 0 ? '+' : '') + fmtNum(e.overrunPct, 1) + '%'
          : 'sin presupuesto declarado en la ficha',
      }),
      Kpi('Precio propuesto', money0(e.contractPrice, cur), { key: 'e4', icon: I.target(14), foot: 'contrato completo · utilidad ' + money0(e.contractPrice - e.contractCost, cur) }));

    // Aviso de desvío: el punto en que el costeo se comió el presupuesto.
    const overrunNote = e.budgetState === 'over'
      ? Note(h('span', null, h('strong', null, 'El costeo supera el presupuesto en ' + money0(e.overrun, cur) + ' (' + fmtNum(e.overrunPct, 1) + '%)'),
        ', por encima del umbral de alerta del ' + fmtNum(e.alertPct, 0) + '%. ',
        e.bridge ? 'Revisa el puente contra la línea base para ver exactamente qué partidas lo movieron, y decide si sube el presupuesto o baja el alcance.' : 'Fija una línea base para poder explicar partida por partida de dónde viene la diferencia.'), 'err', I.alert(15))
      : e.budgetState === 'watch'
        ? Note('El costeo va ' + fmtNum(e.overrunPct, 1) + '% sobre el presupuesto, dentro del umbral de alerta (' + fmtNum(e.alertPct, 0) + '%). Vigílalo.', 'warn', I.alert(15))
        : null;

    const subTabs = [['costeo', 'Costeo'], ['centros', 'Centros y monedas'], ['servicio', 'Modelo de servicio'], ['precio', 'Precio final']];

    // ── Costeo ────────────────────────────────────────────────────────────
    const viewCosteo = () => {
      const filtered = lines.filter((b) => (!ui.lineKind || s(b.kind) === ui.lineKind)
        && (!ui.lineCenter || s(b.centerId) === ui.lineCenter));
      const capexRows = filtered.filter((b) => !isOpex(b));
      const opexRows = filtered.filter(isOpex);
      const row = (b) => {
        const upd = (patch) => setLines(lines.map((x) => (x.id === b.id ? touch(Object.assign({}, x, patch)) : x)));
        return h('tr', { key: b.id },
          h('td', { style: { minWidth: '240px' } },
            h('input', { className: 'kp-cellinput', value: s(b.item), placeholder: 'Descripción de la partida', onChange: (ev) => upd({ item: ev.target.value }) }),
            b.note ? h('div', { className: 'kp-sec-note' }, b.note) : null),
          h('td', null, Select(b.category, LINE_CATEGORIES, (v) => upd({ category: v }), { className: 'kp-cellinput' })),
          h('td', null, Select(b.centerId, [['shared', 'Compartida']].concat(arr(p.centers).map((c) => [c.id, c.code || c.name])), (v) => upd({ centerId: v }), { className: 'kp-cellinput' })),
          h('td', { className: 'kp-td-num' }, h('input', { className: 'kp-cellinput', type: 'number', min: 0, step: 'any', value: n(b.qty, 0), style: { textAlign: 'right', width: '70px' }, onChange: (ev) => upd({ qty: n(ev.target.value, 0) }) })),
          h('td', { className: 'kp-td-num' }, h('input', { className: 'kp-cellinput', type: 'number', min: 0, step: 'any', value: n(b.unitCost, 0), style: { textAlign: 'right', width: '96px' }, onChange: (ev) => upd({ unitCost: n(ev.target.value, 0) }) })),
          h('td', { className: 'kp-td-num kp-strong' }, fmtNum(lineTotal(b))),
          h('td', { className: 'kp-td-act' },
            IconBtn(I.trash(13), 'Quitar la partida', () => setLines(lines.filter((x) => x.id !== b.id)), { ghost: true, tone: 'danger' })));
      };
      const table = (title, rows, note, isOpexTable) => h('div', { className: 'kp-sec' },
        SectionHead(title, note,
          h('button', {
            className: 'kp-btn kp-btn-sm',
            onClick: () => setLines(lines.concat([newLine({
              kind: isOpexTable ? 'opex' : 'capex',
              category: isOpexTable ? 'servicio' : 'equipamiento',
              qty: isOpexTable ? e.term : 1,
            })])),
          }, I.plus(12), 'Partida')),
        rows.length ? h('div', { className: 'kp-tablewrap' },
          h('table', { className: 'kp-table' },
            h('thead', null, h('tr', null,
              h('th', null, 'Partida'), h('th', null, 'Categoría'), h('th', null, 'Centro'),
              h('th', { className: 'kp-td-num' }, isOpexTable ? 'Meses' : 'Cant.'),
              h('th', { className: 'kp-td-num' }, isOpexTable ? 'Costo/mes' : 'Unitario'),
              h('th', { className: 'kp-td-num' }, 'Total'), h('th', null, ''))),
            h('tbody', null, rows.map(row),
              h('tr', null,
                h('td', { className: 'kp-strong' }, isOpexTable ? 'Fee mensual · costo del período' : 'Total CAPEX'),
                h('td', null), h('td', null), h('td', null),
                h('td', { className: 'kp-td-num kp-strong' }, isOpexTable ? fmtNum(sum(rows, (b) => n(b.unitCost, 0))) : ''),
                h('td', { className: 'kp-td-num kp-strong' }, fmtNum(sum(rows, lineTotal))),
                h('td', null)))))
          : h('div', { className: 'kp-sec-note' }, 'Sin partidas en este bloque.'));

      return h('div', null,
        h('div', { className: 'kp-toolbar', style: { paddingLeft: 0, paddingRight: 0, borderBottom: 'none' } },
          Select(ui.lineKind, [['', 'CAPEX y OPEX']].concat(LINE_KINDS), (v) => setUi((u) => ({ ...u, lineKind: v })), { style: { width: 'auto' } }),
          arr(p.centers).length ? Select(ui.lineCenter, [['', 'Todos los centros'], ['shared', 'Solo compartidas']].concat(arr(p.centers).map((c) => [c.id, c.name])), (v) => setUi((u) => ({ ...u, lineCenter: v })), { style: { width: 'auto' } }) : null,
          h('button', {
            className: 'kp-btn kp-btn-sm',
            onClick: () => setUi((u) => ({
              ...u,
              editor: {
                type: 'confirm', title: 'Fijar la línea base',
                text: 'Se guarda el costeo actual (' + money0(e.costingTotal, cur) + ') como presupuesto de referencia. Desde ahí, cada cambio de partida queda explicado en el puente. Reemplaza la línea base anterior si existe.',
                onOk: () => {
                  const snapshot = lines.map((b) => newLine(Object.assign({}, b, { id: 'blb-' + b.id })));
                  set({
                    baseline: { label: 'Línea base ' + fmtDay(today()), capturedAt: stamp(), note: 'Congelada desde el costeo vivo.', lines: snapshot },
                    budgetLines: lines.map((b) => touch(Object.assign({}, b, { baselineRef: 'blb-' + b.id }))),
                  });
                },
              },
            })),
          }, I.copy(13), p.baseline ? 'Refijar línea base' : 'Fijar línea base')),
        table('CAPEX · inversión', capexRows, money0(sum(capexRows, lineTotal), cur), false),
        table('OPEX · servicio recurrente', opexRows, e.opexMonthly ? money0(e.opexMonthly, cur) + '/mes durante ' + fmtNum(e.opexMonthsDeclared) + ' meses' : null, true),
        e.byCategory.length ? h('div', { className: 'kp-sec kp-split' },
          h('div', { className: 'kp-card kp-card-pad' },
            SectionHead('CAPEX por categoría'),
            BarsH({
              items: e.byCategory.filter((c) => c.capex).sort((a, b) => b.capex - a.capex).map((c, i) => ({
                key: c.key, label: c.label, value: Math.round(c.capex), display: money0(c.capex), color: seriesColor(i),
              })),
              labelW: 190,
            })),
          h('div', { className: 'kp-card kp-card-pad' },
            SectionHead('Composición del costo'),
            Donut({
              caption: cur,
              items: [
                { key: 'capex', label: 'CAPEX (único)', value: Math.round(e.capexCost), color: 'var(--kp-s1)' },
                { key: 'opex', label: 'OPEX (' + fmtNum(e.opexMonthsDeclared) + ' meses)', value: Math.round(e.opexCostDeclared), color: 'var(--kp-s2)' },
              ],
            }),
            h('div', { className: 'kp-sec-note', style: { marginTop: '8px' } },
              'Un stock más un flujo: sirve para dimensionar, no para decidir. El contrato completo se calcula en «Precio final».'))) : null,
        e.bridge ? h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Puente contra la línea base', e.bridge.baseline.label,
            h('button', {
              className: 'kp-btn kp-btn-sm',
              onClick: () => setUi((u) => ({ ...u, ptab: 'analista', analystMode: 'preguntas', question: '¿Explícame la diferencia entre el presupuesto y el costeo por líneas?', answer: null })),
            }, I.sparkles(13), 'Explicación completa')),
          h('div', { className: 'kp-ans-kv', style: { marginBottom: '10px' } },
            h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'Línea base'), h('span', { className: 'kp-ans-kv-v' }, money0(e.bridge.baseTotal, cur))),
            h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'Bajan'), h('span', { className: 'kp-ans-kv-v', style: { color: 'var(--kp-ok)' } }, '−' + money0(e.bridge.downTotal))),
            h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'Suben'), h('span', { className: 'kp-ans-kv-v', style: { color: 'var(--kp-err)' } }, '+' + money0(e.bridge.upTotal))),
            h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'Costeo vivo'), h('span', { className: 'kp-ans-kv-v' }, money0(e.bridge.currentTotal, cur)))),
          BarsH({
            labelW: 190,
            items: e.bridge.down.concat(e.bridge.up).map((r) => ({
              key: r.id, label: r.label, value: Math.abs(Math.round(r.delta)),
              display: signed(r.delta), color: r.delta < 0 ? 'var(--kp-ok)' : 'var(--kp-err)',
              note: money0(r.before) + ' → ' + money0(r.after),
            })),
          })) : null);
    };

    // ── Centros y monedas ─────────────────────────────────────────────────
    const viewCentros = () => h('div', null,
      h('div', { className: 'kp-sec' },
        SectionHead('Centros de la oferta', 'El precio se presenta donde se firma: por centro y en su moneda',
          h('button', {
            className: 'kp-btn kp-btn-sm',
            onClick: () => set({ centers: arr(p.centers).concat([newCenter({ currency: cur, fx: 1, colorIndex: arr(p.centers).length })]) }),
          }, I.plus(12), 'Centro')),
        arr(p.centers).length ? h('div', { className: 'kp-tablewrap' },
          h('table', { className: 'kp-table' },
            h('thead', null, h('tr', null,
              h('th', null, 'Centro'), h('th', null, 'Código'), h('th', null, 'País'), h('th', null, 'Moneda'),
              h('th', { className: 'kp-td-num' }, 'Tipo de cambio'), h('th', { className: 'kp-td-num' }, 'Equipos'), h('th', null, ''))),
            h('tbody', null, arr(p.centers).map((c) => {
              const upd = (patch) => set({ centers: arr(p.centers).map((x) => (x.id === c.id ? touch(Object.assign({}, x, patch)) : x)) });
              return h('tr', { key: c.id },
                h('td', { style: { minWidth: '180px' } },
                  h('input', { className: 'kp-cellinput', value: s(c.name), placeholder: 'Nombre del centro', onChange: (ev) => upd({ name: ev.target.value }) }),
                  c.fxNote ? h('div', { className: 'kp-sec-note' }, c.fxNote) : null),
                h('td', null, h('input', { className: 'kp-cellinput', value: s(c.code), style: { width: '70px' }, onChange: (ev) => upd({ code: ev.target.value }) })),
                h('td', null, h('input', { className: 'kp-cellinput', value: s(c.country), style: { width: '110px' }, onChange: (ev) => upd({ country: ev.target.value }) })),
                h('td', null, Select(c.currency, CURRENCIES.map((x) => [x, x]), (v) => upd({ currency: v }), { className: 'kp-cellinput' })),
                h('td', { className: 'kp-td-num' },
                  h('input', { className: 'kp-cellinput', type: 'number', min: 0, step: 'any', value: n(c.fx, 1), style: { textAlign: 'right', width: '92px' }, onChange: (ev) => upd({ fx: n(ev.target.value, 1) }) }),
                  h('div', { className: 'kp-sec-note' }, s(c.currency) + ' por 1 ' + cur)),
                h('td', { className: 'kp-td-num' }, h('input', { className: 'kp-cellinput', type: 'number', min: 0, value: n(c.units, 0), style: { textAlign: 'right', width: '64px' }, onChange: (ev) => upd({ units: n(ev.target.value, 0) }) })),
                h('td', { className: 'kp-td-act' }, IconBtn(I.trash(13), 'Quitar el centro', () => set({
                  centers: arr(p.centers).filter((x) => x.id !== c.id),
                  budgetLines: lines.map((b) => (b.centerId === c.id ? touch(Object.assign({}, b, { centerId: 'shared' })) : b)),
                }), { ghost: true, tone: 'danger' })));
            }))))
          : Empty(I.money(28), 'Sin centros declarados',
            'Si la oferta se presenta por sede y en moneda local —un centro comercial en Chile en CLP y otro en Colombia en COP—, declara aquí cada uno con su tipo de cambio y sus equipos. La app arma el precio de cada centro por separado.')),

      arr(p.centers).length ? h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Reparto de las partidas compartidas', 'Regla aplicada a las ' + lines.filter((b) => !centerOf(p, b.centerId)).length + ' partidas sin centro asignado'),
        h('div', { className: 'kp-row' },
          Field('Regla de prorrateo', Select(e.allocationRule, ALLOC_RULES, (v) => setPricing({ allocation: v })),
            'Por unidades reparte según los equipos de cada centro; por costo directo, según lo que ya carga cada uno.'),
          Field('Moneda de gestión del proyecto', Select(p.currency, CURRENCIES.map((c) => [c, c]), (v) => set({ currency: v })),
            'Es la moneda en que se costea. La oferta se convierte a la moneda de cada centro.')),
        h('div', { className: 'kp-tablewrap', style: { marginTop: '12px' } },
          h('table', { className: 'kp-table' },
            h('thead', null, h('tr', null,
              h('th', null, 'Centro'), h('th', { className: 'kp-td-num' }, 'Equipos'), h('th', { className: 'kp-td-num' }, 'Reparto'),
              h('th', { className: 'kp-td-num' }, 'CAPEX ' + cur), h('th', { className: 'kp-td-num' }, 'Fee/mes ' + cur),
              h('th', { className: 'kp-td-num' }, 'Costo del contrato'))),
            h('tbody', null, e.byCenter.map((r) => h('tr', { key: r.center.id },
              h('td', null, h('span', { className: 'kp-chip', style: { borderColor: seriesColor(n(r.center.colorIndex, 0)) } },
                h('span', { className: 'kp-chip-dot', style: { background: seriesColor(n(r.center.colorIndex, 0)) } }), r.center.name)),
              h('td', { className: 'kp-td-num' }, fmtNum(r.units)),
              h('td', { className: 'kp-td-num' }, pct(r.share * 100)),
              h('td', { className: 'kp-td-num' }, money0(r.capexCost)),
              h('td', { className: 'kp-td-num' }, money0(r.opexCost)),
              h('td', { className: 'kp-td-num kp-strong' }, money0(r.contractCost)))),
              h('tr', null,
                h('td', { className: 'kp-strong' }, 'Total'),
                h('td', { className: 'kp-td-num kp-strong' }, fmtNum(e.unitCount)),
                h('td', null),
                h('td', { className: 'kp-td-num kp-strong' }, money0(e.capexCost)),
                h('td', { className: 'kp-td-num kp-strong' }, money0(e.opexMonthly)),
                h('td', { className: 'kp-td-num kp-strong' }, money0(e.contractCost))))))) : null);

    // ── Modelo de costeo del servicio ─────────────────────────────────────
    const viewServicio = () => {
      const sm = e.service;
      return h('div', null,
        h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Contrato de servicio', 'Plazo, reajuste y nivel comprometido'),
          h('div', { className: 'kp-row-3' },
            Field('Plazo del servicio (meses)', Input(svc.termMonths, (v) => setSvc({ termMonths: clamp(n(v, 12), 1, 240) }), { type: 'number', min: 1, max: 240 }),
              'Lo lógico es que termine junto con la garantía del equipamiento.'),
            Field('Índice de reajuste', Select(svc.escalationIndex, ESCALATION_INDEX, (v) => setSvc({ escalationIndex: v })),
              'Sin reajuste, el fee pierde valor real todos los meses.'),
            Field('Reajuste anual (%)', Input(svc.escalationPct, (v) => setSvc({ escalationPct: n(v, 0) }), { type: 'number', min: 0, max: 50, step: 0.5 }))),
          h('div', { className: 'kp-row-3', style: { marginTop: '12px' } },
            Field('Resolución en sitio (horas)', Input(svc.slaOnSiteHours, (v) => setSvc({ slaOnSiteHours: n(v, 4) }), { type: 'number', min: 0, step: 0.5 })),
            Field('Cobertura', Input(svc.slaCoverage, (v) => setSvc({ slaCoverage: v }), { placeholder: '24x7, horario de operación…' })),
            Field('Disponibilidad comprometida (%)', Input(svc.availabilityPct, (v) => setSvc({ availabilityPct: clamp(n(v, 99), 0, 100) }), { type: 'number', min: 0, max: 100, step: 0.1 }))),
          n(svc.escalationPct, 0) <= 0 && n(svc.termMonths, 0) > 12
            ? h('div', { style: { marginTop: '12px' } }, Note('Un fee de ' + fmtNum(svc.termMonths) + ' meses sin cláusula de reajuste pierde valor real cada mes. En moneda local, el último año se presta a pérdida aunque el primero esté bien calculado.', 'warn', I.alert(15)))
            : null),

        h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Supuestos de modelación', 'Reemplázalos por cotizaciones reales antes de ofertar'),
          h('div', { className: 'kp-row-3' },
            Field('NOC / monitoreo mensual (' + cur + ')', Input(svc.nocMonthly, (v) => setSvc({ nocMonthly: n(v, 0) }), { type: 'number', min: 0 })),
            Field('Recargo por guardia 24x7 (%)', Input(svc.guardPremiumPct, (v) => setSvc({ guardPremiumPct: n(v, 0) }), { type: 'number', min: 0, max: 200 })),
            Field('Repuestos: % anual del equipamiento', Input(svc.sparesAnnualPct, (v) => setSvc({ sparesAnnualPct: n(v, 0) }), { type: 'number', min: 0, step: 0.1 }))),
          h('div', { className: 'kp-row-3', style: { marginTop: '12px' } },
            Field('Preventivos al año', Input(svc.preventivesPerYear, (v) => setSvc({ preventivesPerYear: n(v, 0) }), { type: 'number', min: 0 })),
            Field('Horas por preventivo y equipo', Input(svc.hoursPerPreventive, (v) => setSvc({ hoursPerPreventive: n(v, 0) }), { type: 'number', min: 0, step: 0.5 })),
            Field('Partida de plataforma que se amortiza',
              Select(svc.platformCapexLineId, [['', 'Ninguna']].concat(e.capexLines.map((b) => [b.id, b.item.slice(0, 46)])), (v) => setSvc({ platformCapexLineId: v })),
              sm.platformCapex ? money0(sm.platformCapex, cur) + ' en ' + sm.term + ' meses = ' + money0(sm.platform, cur) + '/mes' : '')),
          arr(p.centers).length ? h('div', { className: 'kp-tablewrap', style: { marginTop: '12px' } },
            h('table', { className: 'kp-table' },
              h('thead', null, h('tr', null, h('th', null, 'Centro'),
                h('th', { className: 'kp-td-num' }, 'Costo empresa de un técnico (' + cur + '/mes)'),
                h('th', { className: 'kp-td-num' }, 'Partner de field service (' + cur + '/equipo/mes)'))),
              h('tbody', null, arr(p.centers).map((c) => {
                const tech = n((arr(svc.techMonthlyCost).find((x) => x.centerId === c.id) || {}).cost, 0);
                const partner = n((arr(svc.partnerPerUnit).find((x) => x.centerId === c.id) || {}).usd, 0);
                const setTech = (v) => setSvc({ techMonthlyCost: arr(p.centers).map((cc) => ({ centerId: cc.id, cost: cc.id === c.id ? n(v, 0) : n((arr(svc.techMonthlyCost).find((x) => x.centerId === cc.id) || {}).cost, 0) })) });
                const setPartner = (v) => setSvc({ partnerPerUnit: arr(p.centers).map((cc) => ({ centerId: cc.id, usd: cc.id === c.id ? n(v, 0) : n((arr(svc.partnerPerUnit).find((x) => x.centerId === cc.id) || {}).usd, 0) })) });
                return h('tr', { key: c.id },
                  h('td', null, c.name + (c.country ? ' · ' + c.country : '')),
                  h('td', { className: 'kp-td-num' }, h('input', { className: 'kp-cellinput', type: 'number', min: 0, value: tech, style: { textAlign: 'right', width: '100px' }, onChange: (ev) => setTech(ev.target.value) })),
                  h('td', { className: 'kp-td-num' }, h('input', { className: 'kp-cellinput', type: 'number', min: 0, value: partner, style: { textAlign: 'right', width: '100px' }, onChange: (ev) => setPartner(ev.target.value) })));
              })))) : null),

        h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Escenarios de servicio', 'Construidos de abajo hacia arriba, con cada componente a la vista',
            h('button', {
              className: 'kp-btn kp-btn-sm',
              onClick: () => setUi((u) => ({ ...u, ptab: 'analista', analystMode: 'preguntas', question: '¿Explícame el OPEX y el CAPEX?', answer: null })),
            }, I.sparkles(13), 'Análisis completo')),
          h('div', { className: 'kp-tablewrap' },
            h('table', { className: 'kp-table' },
              h('thead', null, h('tr', null, h('th', null, 'Escenario'), h('th', null, 'Estructura'),
                h('th', { className: 'kp-td-num' }, cur + '/mes'), h('th', { className: 'kp-td-num' }, 'vs. fee actual'), h('th', { className: 'kp-td-num' }, 'Por equipo/mes'))),
              h('tbody', null, sm.scenarios.map((sc) => h('tr', { key: sc.id },
                h('td', { className: 'kp-strong' }, sc.id + ' — ' + sc.name),
                h('td', { className: 'kp-muted', style: { maxWidth: '320px' } }, sc.summary),
                h('td', { className: 'kp-td-num kp-strong' }, money0(sc.monthly)),
                h('td', { className: 'kp-td-num', style: sc.vsCurrent > 1.1 ? { color: 'var(--kp-err)' } : { color: 'var(--kp-ok)' } }, sc.vsCurrent == null ? '—' : fmtNum(sc.vsCurrent, 1) + '×'),
                h('td', { className: 'kp-td-num' }, money0(sc.perUnit)))),
                h('tr', null,
                  h('td', { className: 'kp-strong' }, 'Fee cargado hoy en el costeo'),
                  h('td', null), h('td', { className: 'kp-td-num kp-strong' }, money0(e.opexMonthly)),
                  h('td', { className: 'kp-td-num' }, '1,0×'),
                  h('td', { className: 'kp-td-num' }, money0(sm.units ? e.opexMonthly / sm.units : 0)))))),
          h('div', { className: 'kp-grid kp-grid-3', style: { marginTop: '12px' } },
            sm.scenarios.map((sc) => h('div', { key: sc.id, className: 'kp-card kp-card-pad' },
              h('div', { className: 'kp-strong', style: { marginBottom: '6px' } }, sc.id + ' · ' + money0(sc.monthly, cur) + '/mes'),
              sc.components.map((c2, i2) => h('div', { key: i2, className: 'kp-sec-note', style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
                h('span', null, c2.label), h('span', { className: 'kp-strong kp-nowrap' }, money0(c2.value))))))),
          h('div', { style: { marginTop: '12px' } },
            Note('Trabajo efectivo del preventivo: ' + fmtNum(sm.preventiveHours) + ' horas-hombre al año (' + fmtNum(sm.fte, 1) +
              ' FTE). Lo que se paga no son esas horas: es la capacidad de tener a alguien disponible ' + s(svc.slaCoverage) + '.' +
              (sm.pctOfEquipment != null ? ' El fee actual equivale al ' + fmtNum(sm.pctOfEquipment, 1) + '% anual del equipamiento.' : ''), 'accent', I.info(15)))),

        h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Aritmética del SLA', 'Disponibilidad comprometida contra tiempo de resolución'),
          h('div', { className: 'kp-tablewrap' },
            h('table', { className: 'kp-table' },
              h('thead', null, h('tr', null, h('th', null, 'Nivel'), h('th', { className: 'kp-td-num' }, 'Disponib.'),
                h('th', { className: 'kp-td-num' }, 'Caída permitida/mes'), h('th', { className: 'kp-td-num' }, 'Resolución'),
                h('th', null, '¿Sobrevive un incidente en plazo?'), h('th', { className: 'kp-td-num' }, 'Incidentes si se mide por flota'))),
              h('tbody', null, sm.levels.map((lv, i2) => h('tr', { key: i2 },
                h('td', null, lv.name),
                h('td', { className: 'kp-td-num' }, fmtNum(lv.availabilityPct, 1) + '%'),
                h('td', { className: 'kp-td-num' }, fmtNum(lv.allowedUnit, 1) + ' h'),
                h('td', { className: 'kp-td-num' }, fmtNum(lv.onSiteHours, 1) + ' h'),
                h('td', { style: lv.survives ? { color: 'var(--kp-ok)' } : { color: 'var(--kp-err)' } },
                  lv.survives ? 'Sí' : 'No — ' + fmtNum(lv.onSiteHours, 1) + ' h ya lo rompe'),
                h('td', { className: 'kp-td-num' }, fmtNum(lv.incidentsFleet))))))),
          sm.contradiction ? h('div', { style: { marginTop: '10px' } },
            Note(h('span', null, h('strong', null, 'El SLA se contradice a sí mismo en el nivel «' + sm.contradiction.name + '».'),
              ' Un solo incidente resuelto exactamente en el plazo comprometido (' + fmtNum(sm.contradiction.onSiteHours, 1) +
              ' h) ya rompe la disponibilidad del ' + fmtNum(sm.contradiction.availabilityPct, 1) + '% (permite ' +
              fmtNum(sm.contradiction.allowedUnit, 1) + ' h al mes). Medido sobre la flota, en cambio, caben ' +
              fmtNum(sm.contradiction.incidentsFleet) + ' incidentes: entre una lectura y otra hay un factor de ' + fmtNum(sm.units) + '.'), 'err', I.alert(15))) : null,
          sm.penalties.length ? h('div', { className: 'kp-chips', style: { marginTop: '10px' } },
            sm.penalties.map((pn, i2) => Chip(pn.label + ': ' + fmtNum(pn.pctOfFee, 1) + '% = ' + money0(pn.amount, cur), { key: i2 }))) : null));
    };

    // ── Precio final ──────────────────────────────────────────────────────
    const viewPrecio = () => {
      const rec = e.recommendation;
      return h('div', null,
        h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Política de margen', 'Del costo al precio ofertable'),
          h('div', { className: 'kp-row-3' },
            Field('Modo de margen', Select(e.marginMode, MARGIN_MODES, (v) => setPricing({ marginMode: v })),
              e.marginMode === 'sale' ? 'Precio = costo ÷ (1 − margen).' : 'Precio = costo × (1 + margen).'),
            Field('Tipo de contrato', Select(e.pricing.contractType, [
              ['llave_en_mano', 'Llave en mano / suma alzada'], ['precio_unitario', 'Precios unitarios'],
              ['tiempo_materiales', 'Tiempo y materiales'], ['otro', 'Otro'],
            ], (v) => setPricing({ contractType: v })), 'Cambia el margen recomendado: a suma alzada el desvío lo absorbe el oferente.'),
            Field('Margen del CAPEX (%)',
              Input(e.pricing.capexMarginPct == null ? '' : e.pricing.capexMarginPct,
                (v) => setPricing({ capexMarginPct: s(v).trim() === '' ? null : clamp(n(v, 0), 0, 90) }),
                { type: 'number', min: 0, max: 90, step: 0.5, placeholder: 'Recomendado: ' + fmtNum(rec.capexPct, 1) }),
              e.pricing.capexMarginPct == null ? 'Vacío = se usa la recomendación (' + fmtNum(rec.capexPct, 1) + '%).' : 'Fijado a mano.')),
          h('div', { className: 'kp-row-3', style: { marginTop: '12px' } },
            Field('Margen del servicio (%)',
              Input(e.pricing.opexMarginPct == null ? '' : e.pricing.opexMarginPct,
                (v) => setPricing({ opexMarginPct: s(v).trim() === '' ? null : clamp(n(v, 0), 0, 90) }),
                { type: 'number', min: 0, max: 90, step: 0.5, placeholder: 'Recomendado: ' + fmtNum(rec.opexPct, 1) }),
              'El servicio carga guardia, stock y riesgo de SLA: siempre pide más margen que la inversión.'),
            Field('Margen recomendado', h('div', { className: 'kp-chips', style: { paddingTop: '4px' } },
              Chip('CAPEX ' + fmtNum(rec.capexPct, 1) + '%', { tone: 'on' }),
              Chip('Servicio ' + fmtNum(rec.opexPct, 1) + '%', { tone: 'on' }),
              Chip('Rango ' + fmtNum(rec.range[0], 0) + '–' + fmtNum(rec.range[1], 0) + '%', {})),
              'Calculado desde la envergadura y los riesgos que declara el proyecto.'),
            Field('Aplicar la recomendación',
              h('button', { className: 'kp-btn', onClick: () => setPricing({ capexMarginPct: null, opexMarginPct: null }) }, I.refresh(14), 'Volver al recomendado'),
              e.pricing.capexMarginPct != null || e.pricing.opexMarginPct != null ? 'Hay margen fijado a mano.' : 'Se está usando la recomendación.')),
          h('div', { className: 'kp-tablewrap', style: { marginTop: '12px' } },
            h('table', { className: 'kp-table' },
              h('thead', null, h('tr', null, h('th', null, 'Factor del margen recomendado'), h('th', { className: 'kp-td-num' }, 'Puntos'))),
              h('tbody', null, rec.parts.map((x, i2) => h('tr', { key: i2 },
                h('td', null, x.label), h('td', { className: 'kp-td-num' }, '+' + fmtNum(x.pts, 1)))),
                h('tr', null, h('td', { className: 'kp-strong' }, 'Margen recomendado para el CAPEX'),
                  h('td', { className: 'kp-td-num kp-strong' }, fmtNum(rec.capexPct, 1) + '%')))))),

        h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('Precio propuesto', 'Costo + margen, separando la inversión del servicio'),
          h('div', { className: 'kp-tablewrap' },
            h('table', { className: 'kp-table' },
              h('thead', null, h('tr', null, h('th', null, 'Concepto'), h('th', { className: 'kp-td-num' }, 'Costo'),
                h('th', { className: 'kp-td-num' }, 'Margen'), h('th', { className: 'kp-td-num' }, 'Precio'), h('th', { className: 'kp-td-num' }, 'Utilidad'))),
              h('tbody', null,
                h('tr', null, h('td', null, 'CAPEX · inversión'),
                  h('td', { className: 'kp-td-num' }, money0(e.capexCost)),
                  h('td', { className: 'kp-td-num' }, fmtNum(e.capexMarginPct, 1) + '%'),
                  h('td', { className: 'kp-td-num kp-strong' }, money0(e.capexPrice)),
                  h('td', { className: 'kp-td-num', style: { color: 'var(--kp-ok)' } }, money0(e.capexMarginAmount))),
                h('tr', null, h('td', null, 'Fee mensual · servicio'),
                  h('td', { className: 'kp-td-num' }, money0(e.opexMonthly)),
                  h('td', { className: 'kp-td-num' }, fmtNum(e.opexMarginPct, 1) + '%'),
                  h('td', { className: 'kp-td-num kp-strong' }, money0(e.opexPrice)),
                  h('td', { className: 'kp-td-num', style: { color: 'var(--kp-ok)' } }, money0(e.opexPrice - e.opexMonthly))),
                h('tr', null, h('td', null, 'Servicio completo (' + e.term + ' meses)'),
                  h('td', { className: 'kp-td-num' }, money0(e.opexMonthly * e.term)),
                  h('td', { className: 'kp-td-num' }, ''),
                  h('td', { className: 'kp-td-num' }, money0(e.opexPrice * e.term)),
                  h('td', { className: 'kp-td-num', style: { color: 'var(--kp-ok)' } }, money0(e.opexMarginAmount))),
                h('tr', null, h('td', { className: 'kp-strong' }, 'Contrato completo'),
                  h('td', { className: 'kp-td-num kp-strong' }, money0(e.contractCost)),
                  h('td', { className: 'kp-td-num' }, ''),
                  h('td', { className: 'kp-td-num kp-strong' }, money0(e.contractPrice, cur)),
                  h('td', { className: 'kp-td-num kp-strong', style: { color: 'var(--kp-ok)' } }, money0(e.contractPrice - e.contractCost)))))),
          e.service.gapVsCurrent != null && e.service.gapVsCurrent > 0
            ? h('div', { style: { marginTop: '10px' } }, Note('Este precio se construyó sobre el fee cargado hoy (' + money0(e.opexMonthly, cur) +
              '/mes). El modelo de servicio dice que sostener el SLA comprometido cuesta ' + money0(e.service.recommended.monthly, cur) +
              '/mes: con ese costo corregido, el fee ofertable sube a ' + money0(priceFrom(e.service.recommended.monthly, e.opexMarginPct, e.marginMode), cur) + '/mes.', 'warn', I.alert(15)))
            : null),

        e.byCenter.length ? h('div', { className: 'kp-sec kp-card kp-card-pad' },
          SectionHead('La oferta, por centro y en su moneda', 'Valores netos, sin impuestos'),
          h('div', { className: 'kp-tablewrap' },
            h('table', { className: 'kp-table' },
              h('thead', null, h('tr', null, h('th', null, 'Centro'), h('th', null, 'Moneda'),
                h('th', { className: 'kp-td-num' }, 'CAPEX'), h('th', { className: 'kp-td-num' }, 'Fee mensual'),
                h('th', { className: 'kp-td-num' }, 'Contrato ' + e.term + ' meses'), h('th', { className: 'kp-td-num' }, 'Por equipo'))),
              h('tbody', null, e.byCenter.map((r) => h('tr', { key: r.center.id },
                h('td', { className: 'kp-strong' }, r.center.name),
                h('td', null, r.center.currency),
                h('td', { className: 'kp-td-num kp-strong' }, money0(r.capexLocal, r.center.currency)),
                h('td', { className: 'kp-td-num kp-strong' }, money0(r.opexLocal, r.center.currency)),
                h('td', { className: 'kp-td-num' }, money0(r.contractLocal, r.center.currency)),
                h('td', { className: 'kp-td-num' }, r.perUnit ? money0(r.perUnit * n(r.center.fx, 1), r.center.currency) : '—')))))),
          h('div', { className: 'kp-grid kp-grid-2', style: { marginTop: '12px' } },
            e.byCenter.map((r) => h('div', { key: r.center.id, className: 'kp-card kp-card-pad' },
              h('div', { className: 'kp-kpi-label', style: { marginBottom: '4px' } }, r.center.name + ' · ' + r.center.currency),
              h('div', { className: 'kp-kpi-value' }, money0(r.capexLocal, r.center.currency)),
              h('div', { className: 'kp-kpi-foot' }, 'más ' + money0(r.opexLocal, r.center.currency) + ' al mes de servicio · ' +
                fmtNum(r.units) + ' equipos · tipo de cambio ' + fmtNum(r.center.fx, 2))))),
          h('div', { style: { marginTop: '10px' } },
            Note('Los importes locales salen del tipo de cambio declarado en cada centro. A suma alzada, la devaluación entre la oferta y la entrega sale del margen: cúbrela con cláusula de reajuste, con cobertura financiera o con prima en el precio.', 'accent', I.money(15)))) : null);
    };

    return h('div', { className: cx('kp-scroll', cfg.denseTables && 'kp-dense') },
      kpis,
      overrunNote ? h('div', { className: 'kp-sec' }, overrunNote) : null,
      h('div', { className: 'kp-sec' },
        h('div', { className: 'kp-tabs' }, subTabs.map(([key, label]) => h('button', {
          key, className: cx('kp-tab', sub === key && 'kp-tab-on'), onClick: () => setSub(key),
        }, label)))),
      sub === 'centros' ? viewCentros() : sub === 'servicio' ? viewServicio() : sub === 'precio' ? viewPrecio() : viewCosteo());
  }

  // ── Proyecto · Analista: modo plan de trabajo ───────────────────────────
  function viewAnalystPlan(ctx, p) {
    const { ui, setUi, setPTab } = ctx;
    const proposal = ui.proposal && ui.proposal.projectId === p.id ? ui.proposal.data : null;
    const opts = ui.proposalOpts || { templateId: '', scale: 1, startDate: '' };
    const run = () => setUi((u) => ({
      ...u,
      proposal: { projectId: p.id, data: proposePlan(p, Object.assign({}, opts, { startDate: opts.startDate || p.startDate })) },
    }));

    return h('div', { className: 'kp-scroll' },
      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Analista de proyecto', 'Lee la documentación indexada, el objetivo y el alcance, y propone un plan de trabajo estructurado.'),
        h('div', { className: 'kp-row-3' },
          Field('Tipo de proyecto',
            Select(opts.templateId, [['', 'Detectar automáticamente']].concat(PLAN_TEMPLATES.map((t) => [t.id, t.name])),
              (v) => setUi((u) => ({ ...u, proposalOpts: Object.assign({}, opts, { templateId: v }) }))),
            'Si lo dejas en automático, el analista deduce el tipo desde los nombres de los documentos y el texto del proyecto.'),
          Field('Fecha de arranque',
            Input(opts.startDate || p.startDate, (v) => setUi((u) => ({ ...u, proposalOpts: Object.assign({}, opts, { startDate: v }) })), { type: 'date' }),
            'Las tareas evitan fines de semana y las ventanas bloqueadas del proyecto.'),
          Field('Escala de duración',
            Select(String(opts.scale), [['0.5', 'Comprimido (mitad)'], ['0.75', 'Ajustado'], ['1', 'Normal'], ['1.5', 'Holgado'], ['2', 'Extendido (doble)']],
              (v) => setUi((u) => ({ ...u, proposalOpts: Object.assign({}, opts, { scale: Number(v) }) }))),
            'Multiplica la duración de todas las tareas propuestas.')),
        h('div', { className: 'kp-chips', style: { marginTop: '10px' } },
          h('button', { className: 'kp-btn kp-btn-primary', onClick: run }, I.sparkles(15), proposal ? 'Volver a analizar' : 'Analizar y proponer plan'),
          Chip(arr(p.documents).length + ' documento(s) en la biblioteca', { icon: I.docs(12) }),
          Chip(arr(model.sources).filter((x) => x.projectId === p.id).length + ' fuente(s) conectada(s)', { icon: I.folders(12) }),
          !arr(p.documents).length ? h('button', { key: 'go', className: 'kp-btn kp-btn-sm', onClick: () => setPTab('documentos') }, I.upload(13), 'Cargar documentos primero') : null)),

      !proposal
        ? Empty(I.sparkles(30), 'Sin propuesta todavía',
          'El analista revisa los nombres y tipos de los documentos, las carpetas conectadas, el objetivo, el alcance y las etiquetas del proyecto; deduce de qué tipo de trabajo se trata y arma fases, tareas fechadas, hitos, riesgos típicos y el checklist de lo que falta. Nada se aplica al proyecto hasta que tú lo apruebes.')
        : h('div', null,
          h('div', { className: 'kp-sec kp-card kp-card-pad' },
            SectionHead('Diagnóstico', 'Generado ' + fmtWhen(proposal.generatedAt)),
            h('div', { className: 'kp-chips', style: { marginBottom: '10px' } },
              Chip(proposal.templateName, { tone: 'on', icon: (I[proposal.templateIcon] || I.target)(12) }),
              proposal.confidence == null ? Chip('Tipo elegido a mano', {}) : Chip('Confianza ' + proposal.confidence + '%', { tone: proposal.confidence >= 60 ? 'ok' : 'warn' }),
              Chip(proposal.phases.length + ' fases', {}), Chip(proposal.tasks.length + ' tareas', {}),
              Chip(proposal.milestones.length + ' hitos', {}), Chip(proposal.risks.length + ' riesgos tipo', {})),
            h('div', { className: 'kp-sec-note', style: { marginBottom: '10px' } }, proposal.templateNote),
            proposal.evidence.length ? h('div', { style: { marginBottom: '10px' } },
              h('div', { className: 'kp-sec-note', style: { marginBottom: '4px' } }, 'Evidencia que llevó a este tipo de plan:'),
              h('div', { className: 'kp-chips' }, proposal.evidence.map((e) => Chip('"' + e.word + '" ×' + e.count, { key: e.word })))) : null,
            proposal.docsByKind.length ? h('div', { style: { marginBottom: '10px' } },
              h('div', { className: 'kp-sec-note', style: { marginBottom: '4px' } }, 'Documentación leída:'),
              h('div', { className: 'kp-chips' }, proposal.docsByKind.map((x) => Chip(x.label + ': ' + x.count, { key: x.k })))) : null,
            proposal.notes.map((note, i) => h('div', { key: i, style: { marginBottom: '6px' } }, Note(note))),
            proposal.missing.length ? h('div', { style: { marginTop: '10px' } },
              h('div', { className: 'kp-sec-title', style: { marginBottom: '6px' } }, 'Documentos que faltan para trabajar bien'),
              proposal.missing.map((mm, i) => h('div', { key: i, style: { marginBottom: '6px' } },
                Note(h('span', null, h('span', { className: 'kp-strong' }, mm.label), ' — ', mm.why), 'warn', I.alert(15))))) : null),

          h('div', { className: 'kp-sec kp-card kp-card-pad' },
            SectionHead('Plan propuesto', fmtDay(proposal.start) + ' → ' + fmtDay(proposal.end)),
            Timeline({ project: Object.assign({}, p, { phases: proposal.phases, milestones: proposal.milestones }), tasks: proposal.tasks }),
            h('div', { className: 'kp-tablewrap', style: { marginTop: '12px' } },
              h('table', { className: 'kp-table' },
                h('thead', null, h('tr', null, h('th', null, 'Fase'), h('th', null, 'Tarea'), h('th', null, 'Responsable sugerido'), h('th', null, 'Inicio'), h('th', null, 'Término'), h('th', null, 'Entregable'))),
                h('tbody', null, proposal.tasks.map((t) => h('tr', { key: t.id },
                  h('td', { className: 'kp-nowrap kp-muted' }, (proposal.phases.find((f) => f.id === t.phaseId) || {}).name),
                  h('td', null, t.name),
                  h('td', { className: 'kp-nowrap' }, t.owner || '—'),
                  h('td', { className: 'kp-nowrap' }, fmtDayShort(t.startDate)),
                  h('td', { className: 'kp-nowrap' }, fmtDayShort(t.endDate)),
                  h('td', { className: 'kp-muted' }, t.deliverable || '—')))))),
            h('div', { className: 'kp-chips', style: { marginTop: '12px' } },
              h('button', {
                className: 'kp-btn kp-btn-primary',
                onClick: () => {
                  commit((m) => { applyProposal(p.id, proposal, 'append'); return m; });
                  setUi((u) => ({ ...u, proposal: null, ptab: 'plan' }));
                  shell.notify && shell.notify({ level: 'success', text: 'Plan añadido al proyecto.' });
                },
              }, I.plus(15), 'Añadir al plan actual'),
              h('button', {
                className: 'kp-btn',
                onClick: () => setUi((u) => ({
                  ...u,
                  editor: {
                    type: 'confirm', title: 'Reemplazar el plan',
                    text: 'Se eliminan las ' + arr(p.tasks).length + ' tarea(s) y ' + arr(p.phases).length + ' fase(s) actuales y se dejan las propuestas. Los hitos y riesgos existentes se conservan.',
                    onOk: () => {
                      commit((m) => { applyProposal(p.id, proposal, 'replace'); return m; });
                      setUi((u2) => ({ ...u2, proposal: null, ptab: 'plan', editor: null }));
                    },
                  },
                })),
              }, I.refresh(15), 'Reemplazar el plan actual'),
              h('button', { className: 'kp-btn kp-btn-ghost', onClick: () => setUi((u) => ({ ...u, proposal: null })) }, 'Descartar propuesta')))));
  }


  // ── Proyecto · Analista: modo preguntas ─────────────────────────────────
  function viewAnalystQuestions(ctx, p) {
    const { ui, setUi, cfg } = ctx;
    const answer = ui.answer && ui.answer.projectId === p.id ? ui.answer.data : null;
    const ask = (text, forcedId) => {
      const q = s(text).trim();
      if (!q && !forcedId) return;
      const res = answerQuestion(p, q, cfg, forcedId);
      setUi((u) => ({ ...u, question: q || (res.analysis ? res.analysis.question : ''), answer: { projectId: p.id, data: res } }));
    };

    return h('div', { className: 'kp-scroll' },
      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Pregúntale al analista', 'Responde con los números de este proyecto: partidas, tareas, riesgos y parámetros del modelo de servicio.'),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' } },
          h('div', { className: 'kp-toolbar-grow', style: { minWidth: '240px' } },
            TextArea(ui.question, (v) => setUi((u) => ({ ...u, question: v })), {
              placeholder: '¿Explícame la diferencia entre el presupuesto y el costeo por líneas?',
              style: { minHeight: '58px' },
              onKeyDown: (ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ask(ui.question); } },
            })),
          h('button', { className: 'kp-btn kp-btn-primary', onClick: () => ask(ui.question), disabled: !s(ui.question).trim() }, I.sparkles(15), 'Analizar')),
        h('div', { className: 'kp-sec-note', style: { margin: '8px 0 6px' } }, 'O parte por una de estas:'),
        h('div', { className: 'kp-chips' }, ANALYSES.map((a) => Chip(a.question, {
          key: a.id, icon: (I[a.icon] || I.sparkles)(12),
          on: answer && answer.analysis && answer.analysis.id === a.id,
          onClick: () => ask(a.question, a.id),
        })))),

      !answer
        ? Empty(I.sparkles(30), 'Pregunta lo que necesites decidir',
          'El analista cruza el costeo, el plan, los riesgos y el modelo de servicio del proyecto, y responde con las cifras del propio proyecto: de dónde sale cada número, qué significa y qué conviene hacer. Nada de lo que responde es invento: si un dato no está cargado, lo dice.')
        : h('div', { className: 'kp-sec kp-card kp-card-pad kp-answer' },
          h('div', { className: 'kp-ans-hd' },
            h('span', { className: 'kp-hd-mark' }, (answer.analysis && I[answer.analysis.icon] ? I[answer.analysis.icon](15) : I.sparkles(15))),
            h('div', { style: { minWidth: 0, flex: 1 } },
              h('div', { className: 'kp-ans-title' }, answer.analysis ? answer.analysis.title : 'Sin coincidencia'),
              h('div', { className: 'kp-sec-note' }, s(ui.question) ? '«' + s(ui.question) + '»' : '')),
            IconBtn(I.copy(14), 'Copiar la respuesta como texto', () => {
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(answer.text);
                  shell.notify && shell.notify({ level: 'success', text: 'Respuesta copiada al portapapeles.' });
                }
              } catch (err3) { /* el navegador puede bloquearlo */ }
            }, { ghost: true })),
          h('div', { className: 'kp-ans-body' }, renderBlocks(answer.blocks)),
          answer.ranking && answer.ranking.length > 1
            ? h('div', { className: 'kp-chips', style: { marginTop: '14px' } },
              h('span', { className: 'kp-sec-note' }, 'También puede interesarte:'),
              answer.ranking.slice(1).map((r) => Chip(r.title, { key: r.id, onClick: () => ask('', r.id) })))
            : null));
  }

  function viewProjectAnalyst(ctx, p) {
    const { ui, setUi } = ctx;
    const mode = ui.analystMode || 'plan';
    return h('div', { className: 'kp-body' },
      h('div', { className: 'kp-toolbar' },
        h('div', { className: 'kp-tabs' },
          [['plan', 'Plan de trabajo', 'plan'], ['preguntas', 'Preguntas y análisis', 'sparkles']].map(([key, label, ic]) => h('button', {
            key, className: cx('kp-tab', mode === key && 'kp-tab-on'),
            onClick: () => setUi((u) => ({ ...u, analystMode: key })),
          }, (I[ic] || I.grid)(14), label))),
        h('span', { className: 'kp-sec-note' }, mode === 'plan'
          ? 'Propone fases, tareas, hitos y riesgos a partir de la documentación.'
          : 'Explica el proyecto con sus propios números.')),
      mode === 'preguntas' ? viewAnalystQuestions(ctx, p) : viewAnalystPlan(ctx, p));
  }

  // ── Proyecto · Bitácora ─────────────────────────────────────────────────
  function viewProjectLog(ctx, p) {
    const { ui, setUi } = ctx;
    const draft = ui.logDraft || { kind: 'note', text: '', author: '' };
    const entries = arr(p.log).filter((e) => !ui.q || canon(e.text + ' ' + e.author).includes(canon(ui.q)));
    return h('div', { className: 'kp-scroll' },
      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Nueva entrada', 'La bitácora es la memoria del proyecto: decisiones, reuniones, problemas y acuerdos.'),
        h('div', { className: 'kp-row-3', style: { marginBottom: '10px' } },
          Field('Tipo', Select(draft.kind, LOG_KINDS.filter((x) => x[0] !== 'system'), (v) => setUi((u) => ({ ...u, logDraft: Object.assign({}, draft, { kind: v }) })))),
          Field('Autor', Input(draft.author, (v) => setUi((u) => ({ ...u, logDraft: Object.assign({}, draft, { author: v }) })), { placeholder: 'Quién lo registra' }))),
        TextArea(draft.text, (v) => setUi((u) => ({ ...u, logDraft: Object.assign({}, draft, { text: v }) })), { placeholder: 'Qué pasó, qué se decidió y qué se hará al respecto…' }),
        h('div', { className: 'kp-chips', style: { marginTop: '10px' } },
          h('button', {
            className: 'kp-btn kp-btn-primary', disabled: !s(draft.text).trim(),
            onClick: () => {
              actions.log(p.id, draft.kind, draft.text, draft.author);
              setUi((u) => ({ ...u, logDraft: { kind: draft.kind, text: '', author: draft.author } }));
            },
          }, I.plus(15), 'Registrar'))),
      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Historial', entries.length + ' entrada' + (entries.length === 1 ? '' : 's')),
        entries.length
          ? h('div', { className: 'kp-feed' }, entries.map((e) => h('div', { key: e.id, className: 'kp-feed-it' },
            h('span', { className: 'kp-feed-dot' }, e.kind === 'decision' ? I.check(14) : e.kind === 'issue' ? I.alert(14)
              : e.kind === 'milestone' ? I.flag(14) : e.kind === 'meeting' ? I.users(14) : e.kind === 'system' ? I.refresh(14) : I.book(14)),
            h('div', { className: 'kp-feed-txt', style: { flex: 1 } }, e.text,
              h('div', { className: 'kp-feed-when' }, labelOf(LOG_KINDS, e.kind) + ' · ' + fmtWhen(e.at) + (e.author ? ' · ' + e.author : ''))),
            IconBtn(I.trash(13), 'Eliminar entrada', () => actions.remove(p.id, 'log', e.id), { ghost: true, tone: 'danger' }))))
          : h('div', { className: 'kp-sec-note' }, 'Todavía no hay entradas.')));
  }

  // ── Ecosistema KIMOS: leer datos de otras apps con shell.data ───────────
  const ECO_APPS = [
    ['gantt', 'Planificación', 'plan'],
    ['kanban', 'Kanban', 'grid'],
    ['cotizaciones', 'Cotizaciones', 'money'],
  ];
  let eco = { loading: false, error: '', ready: false, instances: [] };
  async function loadEcosystem() {
    if (!shell.data || !shell.data.listInstances) {
      eco = { loading: false, ready: true, error: 'Este host no expone shell.data: la lectura de otras apps no está disponible.', instances: [] };
      emit(); return;
    }
    eco = Object.assign({}, eco, { loading: true, error: '' }); emit();
    const found = [];
    for (const [appId, name] of ECO_APPS) {
      try {
        const list = await shell.data.listInstances(appId);
        for (const it of arr(list)) found.push({ app: appId, appName: name, id: s(it.id), label: s(it.name || it.title || it.id) });
      } catch (e) { /* permiso denegado o app no instalada: se omite */ }
    }
    eco = { loading: false, ready: true, error: found.length ? '' : 'No se encontraron instancias legibles de Planificación, Kanban ni Cotizaciones.', instances: found };
    emit();
  }

  // ── Proyecto · Ficha ────────────────────────────────────────────────────
  function viewProjectSheet(ctx, p, st) {
    const { m, ui, setUi, cfg } = ctx;
    const set = (patch) => actions.saveProject(p.id, patch);
    const lines = arr(p.budgetLines);
    const linesTotal = sum(lines, (b) => n(b.qty, 0) * n(b.unitCost, 0));
    const questions = arr(p.questions);

    return h('div', { className: cx('kp-scroll', cfg.denseTables && 'kp-dense') },
      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Datos del proyecto', 'Los cambios se guardan solos'),
        h('div', { className: 'kp-row', style: { marginBottom: '12px' } },
          Field('Nombre', Input(p.name, (v) => set({ name: v }))),
          Field('Código / correlativo', Input(p.code, (v) => set({ code: v }), { placeholder: 'Ej: PA-128-2026' }))),
        h('div', { className: 'kp-row-3', style: { marginBottom: '12px' } },
          Field('Cliente', Select(p.clientId, [['', 'Sin cliente']].concat(m.clients.map((c) => [c.id, c.name])), (v) => set({ clientId: v }))),
          Field('Estado', Select(p.status, PROJECT_STATUS.map((r) => [r[0], r[1]]), (v) => set({ status: v }))),
          Field('Prioridad', Select(p.priority, PRIORITY, (v) => set({ priority: v })))),
        h('div', { className: 'kp-row-3', style: { marginBottom: '12px' } },
          Field('Inicio', Input(p.startDate, (v) => set({ startDate: v }), { type: 'date' })),
          Field('Término', Input(p.endDate, (v) => set({ endDate: v }), { type: 'date' })),
          Field('Salud', Select(p.healthMode || 'auto', HEALTH, (v) => set({ healthMode: v })),
            p.healthMode === 'auto' || !p.healthMode ? 'Calculada: hoy está "' + HEALTH_LABEL[st.health] + '".' : 'Fijada a mano.')),
        h('div', { className: 'kp-row-3', style: { marginBottom: '12px' } },
          Field('Dirección del proyecto', Input(p.manager, (v) => set({ manager: v }), { placeholder: 'Quién responde por este proyecto' })),
          Field('Moneda', Select(p.currency, CURRENCIES.map((c) => [c, c]), (v) => set({ currency: v }))),
          Field('Presupuesto', Input(p.budget, (v) => set({ budget: n(v, 0) }), { type: 'number', min: 0 }),
            linesTotal ? 'Costeo por líneas: ' + fmtMoney(linesTotal, p.currency) : '')),
        h('div', { style: { marginBottom: '12px' } },
          Field('Objetivo', TextArea(p.objective, (v) => set({ objective: v }), { placeholder: 'Qué resultado concreto persigue este proyecto…' }))),
        h('div', { style: { marginBottom: '12px' } },
          Field('Alcance', TextArea(p.scope, (v) => set({ scope: v }), { placeholder: 'Qué entra y, sobre todo, qué NO entra…' }))),
        h('div', { className: 'kp-row' },
          Field('Equipo', Input(arr(p.team).join(', '), (v) => set({ team: v.split(',').map((x) => x.trim()).filter(Boolean) }), { placeholder: 'Separados por coma' })),
          Field('Etiquetas', Input(arr(p.tags).join(', '), (v) => set({ tags: v.split(',').map((x) => x.trim()).filter(Boolean) }), { placeholder: 'licitación, retail, Chile…' }),
            'El analista también las lee para deducir el tipo de proyecto.'))),

      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Ventanas bloqueadas', 'Períodos en que no se puede trabajar: el analista no agenda tareas dentro de ellos',
          h('button', {
            className: 'kp-btn kp-btn-sm',
            onClick: () => set({ blackouts: arr(p.blackouts).concat([{ id: uid('blk'), from: today(), to: addDays(today(), 7), label: '' }]) }),
          }, I.plus(13), 'Añadir')),
        arr(p.blackouts).length
          ? arr(p.blackouts).map((b, i) => h('div', { key: b.id || i, className: 'kp-row-3', style: { marginBottom: '8px', gridTemplateColumns: '1fr 1fr 2fr auto', alignItems: 'end' } },
            Field('Desde', Input(b.from, (v) => set({ blackouts: arr(p.blackouts).map((x, j) => (j === i ? Object.assign({}, x, { from: v }) : x)) }), { type: 'date' })),
            Field('Hasta', Input(b.to, (v) => set({ blackouts: arr(p.blackouts).map((x, j) => (j === i ? Object.assign({}, x, { to: v }) : x)) }), { type: 'date' })),
            Field('Motivo', Input(b.label, (v) => set({ blackouts: arr(p.blackouts).map((x, j) => (j === i ? Object.assign({}, x, { label: v }) : x)) }), { placeholder: 'Ej: diciembre bloqueado por el cliente' })),
            IconBtn(I.trash(13), 'Quitar', () => set({ blackouts: arr(p.blackouts).filter((x, j) => j !== i) }), { ghost: true, tone: 'danger' })))
          : h('div', { className: 'kp-sec-note' }, 'Ninguna. Si el cliente cierra la operación en alguna fecha, decláralo aquí y el plan lo respeta.')),

      cfg.showFinance !== false ? h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Economía del proyecto', 'El costeo, los centros, el modelo de servicio y el precio viven en su propia pestaña',
          h('button', { className: 'kp-btn kp-btn-sm', onClick: () => ctx.setPTab('economia') }, I.money(13), 'Abrir Economía')),
        (() => {
          const e2 = computeEconomics(p, cfg);
          return h('div', null,
            h('div', { className: 'kp-ans-kv' },
              h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'CAPEX'), h('span', { className: 'kp-ans-kv-v' }, fmtMoney(e2.capexCost, e2.currency))),
              h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'Fee mensual'), h('span', { className: 'kp-ans-kv-v' }, fmtMoney(e2.opexMonthly, e2.currency))),
              h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'Costeo total'),
                h('span', { className: 'kp-ans-kv-v', style: e2.budgetState === 'over' ? { color: 'var(--kp-err)' } : null }, fmtMoney(e2.costingTotal, e2.currency))),
              h('div', { className: 'kp-ans-kv-it' }, h('span', { className: 'kp-ans-kv-k' }, 'Precio propuesto'), h('span', { className: 'kp-ans-kv-v' }, fmtMoney(e2.contractPrice, e2.currency)))),
            e2.budgetState === 'over'
              ? h('div', { style: { marginTop: '10px' } }, Note('El costeo supera el presupuesto declarado arriba en ' + fmtNum(e2.overrunPct, 1) + '%.', 'err', I.alert(15)))
              : null);
        })()) : null,

      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Consultas abiertas con el cliente', questions.filter((q) => q.status !== 'closed').length + ' sin cerrar',
          h('button', {
            className: 'kp-btn kp-btn-sm',
            onClick: () => set({ questions: questions.concat([{ id: uid('qst'), text: '', answer: '', status: 'open', owner: '', updatedAt: stamp() }]) }),
          }, I.plus(13), 'Consulta')),
        questions.length ? h('div', { className: 'kp-tablewrap' },
          h('table', { className: 'kp-table' },
            h('thead', null, h('tr', null, h('th', null, 'Consulta'), h('th', null, 'Responsable'), h('th', null, 'Respuesta'), h('th', null, 'Estado'), h('th', null, ''))),
            h('tbody', null, questions.map((q, i) => {
              const upd = (patch) => set({ questions: questions.map((x, j) => (j === i ? touch(Object.assign({}, x, patch)) : x)) });
              return h('tr', { key: q.id },
                h('td', { style: { minWidth: '280px' } }, h('input', { className: 'kp-cellinput', value: s(q.text), placeholder: 'Qué hay que aclarar…', onChange: (e) => upd({ text: e.target.value }) })),
                h('td', null, h('input', { className: 'kp-cellinput', value: s(q.owner), placeholder: 'Quién la persigue', onChange: (e) => upd({ owner: e.target.value }) })),
                h('td', { style: { minWidth: '200px' } }, h('input', { className: 'kp-cellinput', value: s(q.answer), placeholder: 'Respuesta recibida', onChange: (e) => upd({ answer: e.target.value }) })),
                h('td', null, Select(q.status, [['open', 'Abierta'], ['sent', 'Enviada'], ['closed', 'Cerrada']], (v) => upd({ status: v }), { className: 'kp-cellinput' })),
                h('td', { className: 'kp-td-act' }, IconBtn(I.trash(13), 'Quitar', () => set({ questions: questions.filter((x, j) => j !== i) }), { ghost: true, tone: 'danger' })));
            }))))
          : h('div', { className: 'kp-sec-note' }, 'Lo que el cliente no ha respondido es riesgo puro: anótalo aquí y persíguelo.')),

      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Enlaces con el ecosistema KIMOS', 'Planificación, Kanban y Cotizaciones del mismo espacio de trabajo',
          h('button', { className: 'kp-btn kp-btn-sm', onClick: loadEcosystem, disabled: eco.loading }, I.refresh(13), eco.loading ? 'Buscando…' : 'Buscar instancias')),
        arr(p.links).length ? h('div', { className: 'kp-chips', style: { marginBottom: '10px' } }, arr(p.links).map((l) => Chip(l.label + ' · ' + l.app, {
          key: l.id, icon: I.link(12),
          onClick: () => set({ links: arr(p.links).filter((x) => x.id !== l.id) }),
          title: 'Clic para quitar el enlace',
        }))) : null,
        !eco.ready ? h('div', { className: 'kp-sec-note' }, 'Pulsa "Buscar instancias" para listar los tableros y planes que este usuario ya puede ver.')
          : eco.error ? Note(eco.error, 'warn', I.info(15))
            : h('div', { className: 'kp-chips' }, eco.instances.map((it) => Chip(it.label + ' · ' + it.appName, {
              key: it.app + it.id,
              on: arr(p.links).some((l) => l.instanceId === it.id),
              onClick: () => {
                if (arr(p.links).some((l) => l.instanceId === it.id)) return;
                set({ links: arr(p.links).concat([{ id: uid('lnk'), app: it.appName, instanceId: it.id, label: it.label, updatedAt: stamp() }]) });
              },
            })))),

      h('div', { className: 'kp-sec kp-card kp-card-pad' },
        SectionHead('Zona de riesgo'),
        h('div', { className: 'kp-chips' },
          h('button', {
            className: 'kp-btn kp-btn-danger',
            onClick: () => setUi((u) => ({
              ...u,
              editor: {
                type: 'confirm', title: 'Eliminar el proyecto',
                text: 'Se elimina "' + p.name + '" con sus ' + arr(p.tasks).length + ' tareas, ' + arr(p.risks).length + ' riesgos y ' + arr(p.documents).length + ' fichas de documento. No se puede deshacer.',
                onOk: () => { actions.deleteProject(p.id); setUi((u2) => ({ ...u2, projectId: '', tab: 'proyectos', editor: null })); },
              },
            })),
          }, I.trash(14), 'Eliminar este proyecto'))));
  }

  // ── Editores (paneles laterales y diálogos) ─────────────────────────────
  function renderEditor(ctx) {
    const { m, ui, setUi } = ctx;
    const ed = ui.editor;
    if (!ed) return null;
    const close = () => setUi((u) => ({ ...u, editor: null }));
    const data = ed.data || {};
    const upd = (patch) => setUi((u) => ({ ...u, editor: Object.assign({}, u.editor, { data: Object.assign({}, u.editor.data, patch) }) }));
    const project = ed.projectId ? findProject(ed.projectId) : null;

    if (ed.type === 'confirm') {
      return Panel(ed.title || 'Confirmar', [Note(ed.text || '¿Continuar?', 'warn', I.alert(15))], [
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', {
          key: 'ok', className: 'kp-btn kp-btn-danger',
          onClick: () => { if (ed.onOk) ed.onOk(); if (findProject(ed.projectId) || true) setUi((u) => (u.editor === ed ? { ...u, editor: null } : u)); },
        }, 'Sí, continuar'),
      ], close, { center: true });
    }

    if (ed.type === 'client') {
      const save = () => {
        if (!s(data.name).trim()) return;
        if (ed.isNew) actions.createClient(data); else actions.saveClient(data.id, data);
        close();
      };
      return Panel(ed.isNew ? 'Nuevo cliente' : 'Cliente', [
        Field('Nombre', Input(data.name, (v) => upd({ name: v }), { placeholder: 'Razón social o nombre comercial', autoFocus: true })),
        h('div', { className: 'kp-row' },
          Field('Código', Input(data.code, (v) => upd({ code: v }))),
          Field('País / mercado', Input(data.country, (v) => upd({ country: v })))),
        Field('Rubro', Input(data.industry, (v) => upd({ industry: v }), { placeholder: 'Retail, minería, educación…' })),
        Field('Contraparte', Input(data.contactName, (v) => upd({ contactName: v }), { placeholder: 'Nombre y cargo' })),
        h('div', { className: 'kp-row' },
          Field('Correo', Input(data.contactEmail, (v) => upd({ contactEmail: v }), { type: 'email' })),
          Field('Teléfono / notas de contacto', Input(data.contactPhone, (v) => upd({ contactPhone: v })))),
        Field('Color en los gráficos', Select(String(n(data.colorIndex, 0)), SERIES.map((_, i) => [String(i), 'Serie ' + (i + 1)]), (v) => upd({ colorIndex: n(v, 0) }))),
        Field('Notas', TextArea(data.notes, (v) => upd({ notes: v }), { placeholder: 'Contexto de la cuenta, condiciones, canal oficial…' })),
      ], [
        !ed.isNew ? h('button', {
          key: 'del', className: 'kp-btn kp-btn-danger kp-panel-foot-l',
          onClick: () => setUi((u) => ({
            ...u,
            editor: {
              type: 'confirm', title: 'Eliminar el cliente',
              text: 'Se elimina "' + data.name + '". Sus proyectos quedan sin cliente asignado.',
              onOk: () => actions.deleteClient(data.id, ''),
            },
          })),
        }, I.trash(14), 'Eliminar') : null,
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', { key: 's', className: 'kp-btn kp-btn-primary', onClick: save, disabled: !s(data.name).trim() }, ed.isNew ? 'Crear cliente' : 'Guardar'),
      ], close);
    }

    if (ed.type === 'project') {
      const save = () => {
        if (!s(data.name).trim()) return;
        const created = ed.isNew ? actions.createProject(data) : actions.saveProject(data.id, data);
        close();
        if (ed.isNew && created) setUi((u) => ({ ...u, projectId: created.id, ptab: 'ficha', editor: null }));
      };
      return Panel(ed.isNew ? 'Nuevo proyecto' : 'Proyecto', [
        Field('Nombre', Input(data.name, (v) => upd({ name: v }), { placeholder: 'Ej: Licitación directorios digitales', autoFocus: true })),
        h('div', { className: 'kp-row' },
          Field('Cliente', Select(data.clientId, [['', 'Sin cliente']].concat(m.clients.map((c) => [c.id, c.name])), (v) => upd({ clientId: v }))),
          Field('Código', Input(data.code, (v) => upd({ code: v })))),
        h('div', { className: 'kp-row' },
          Field('Estado', Select(data.status, PROJECT_STATUS.map((r) => [r[0], r[1]]), (v) => upd({ status: v }))),
          Field('Prioridad', Select(data.priority, PRIORITY, (v) => upd({ priority: v })))),
        h('div', { className: 'kp-row' },
          Field('Inicio', Input(data.startDate, (v) => upd({ startDate: v }), { type: 'date' })),
          Field('Término', Input(data.endDate, (v) => upd({ endDate: v }), { type: 'date' }))),
        h('div', { className: 'kp-row' },
          Field('Moneda', Select(data.currency, CURRENCIES.map((c) => [c, c]), (v) => upd({ currency: v }))),
          Field('Presupuesto', Input(data.budget, (v) => upd({ budget: n(v, 0) }), { type: 'number', min: 0 }))),
        Field('Objetivo', TextArea(data.objective, (v) => upd({ objective: v }), { placeholder: 'Qué resultado concreto persigue…' })),
        Field('Tipo de trabajo', Select(data.type, [['', 'Que lo deduzca el analista']].concat(PLAN_TEMPLATES.map((t) => [t.id, t.name])), (v) => upd({ type: v })),
          'Si lo declaras, el analista usa esa plantilla al proponer el plan.'),
        Note('Después de crearlo podrás conectar su carpeta de documentos y pedirle al analista una propuesta de plan de trabajo completa.', 'accent', I.sparkles(15)),
      ], [
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', { key: 's', className: 'kp-btn kp-btn-primary', onClick: save, disabled: !s(data.name).trim() }, ed.isNew ? 'Crear proyecto' : 'Guardar'),
      ], close);
    }

    if (ed.type === 'task' && project) {
      const phases = arr(project.phases).slice().sort((a, b) => n(a.order) - n(b.order));
      const save = () => {
        if (!s(data.name).trim()) return;
        actions.upsert(project.id, 'tasks', data);
        close();
      };
      return Panel(ed.isNew ? 'Nueva tarea' : 'Tarea', [
        Field('Nombre', Input(data.name, (v) => upd({ name: v }), { placeholder: 'Qué hay que hacer', autoFocus: true })),
        h('div', { className: 'kp-row' },
          Field('Fase', Select(data.phaseId, [['', 'Sin fase']].concat(phases.map((f) => [f.id, f.name])), (v) => upd({ phaseId: v }))),
          Field('Responsable', Input(data.owner, (v) => upd({ owner: v })))),
        h('div', { className: 'kp-row' },
          Field('Inicio', Input(data.startDate, (v) => upd({ startDate: v }), { type: 'date' })),
          Field('Término', Input(data.endDate, (v) => upd({ endDate: v }), { type: 'date' }))),
        h('div', { className: 'kp-row-3' },
          Field('Estado', Select(data.status, TASK_STATUS, (v) => upd({ status: v, progress: v === 'done' ? 100 : n(data.progress) }))),
          Field('Prioridad', Select(data.priority, PRIORITY, (v) => upd({ priority: v }))),
          Field('Peso', Input(data.weight, (v) => upd({ weight: n(v, 1) }), { type: 'number', min: 0.1, step: 0.5 }))),
        Field('Avance: ' + pct(n(data.progress)),
          h('input', { type: 'range', min: 0, max: 100, step: 5, value: n(data.progress), onChange: (e) => upd({ progress: n(e.target.value) }) })),
        Field('Entregable', Input(data.deliverable, (v) => upd({ deliverable: v }), { placeholder: 'Qué se puede mostrar cuando esté lista' }),
          'El avance se mide contra algo verificable, no contra una sensación.'),
        Field('Descripción', TextArea(data.description, (v) => upd({ description: v }))),
      ], [
        !ed.isNew ? h('button', {
          key: 'del', className: 'kp-btn kp-btn-danger kp-panel-foot-l',
          onClick: () => { actions.remove(project.id, 'tasks', data.id); close(); },
        }, I.trash(14), 'Eliminar') : null,
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', { key: 's', className: 'kp-btn kp-btn-primary', onClick: save, disabled: !s(data.name).trim() }, 'Guardar'),
      ], close);
    }

    if (ed.type === 'phase' && project) {
      const save = () => {
        if (!s(data.name).trim()) return;
        actions.upsert(project.id, 'phases', data);
        close();
      };
      return Panel(ed.isNew ? 'Nueva fase' : 'Fase', [
        Field('Nombre', Input(data.name, (v) => upd({ name: v }), { placeholder: 'Ej: 2 · Ingeniería de detalle', autoFocus: true })),
        Field('Orden', Input(data.order, (v) => upd({ order: n(v, 0) }), { type: 'number', min: 0 })),
      ], [
        !ed.isNew ? h('button', {
          key: 'del', className: 'kp-btn kp-btn-danger kp-panel-foot-l',
          onClick: () => { actions.remove(project.id, 'phases', data.id); close(); },
        }, I.trash(14), 'Eliminar fase') : null,
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', { key: 's', className: 'kp-btn kp-btn-primary', onClick: save, disabled: !s(data.name).trim() }, 'Guardar'),
      ], close, { center: true });
    }

    if (ed.type === 'milestone' && project) {
      const save = () => { if (!s(data.name).trim()) return; actions.upsert(project.id, 'milestones', data); close(); };
      return Panel(ed.isNew ? 'Nuevo hito' : 'Hito', [
        Field('Nombre', Input(data.name, (v) => upd({ name: v }), { placeholder: 'Ej: Adjudicación', autoFocus: true })),
        h('div', { className: 'kp-row' },
          Field('Fecha', Input(data.date, (v) => upd({ date: v }), { type: 'date' })),
          Field('Estado', Select(data.status, [['pending', 'Pendiente'], ['done', 'Cumplido'], ['missed', 'No cumplido']], (v) => upd({ status: v })))),
        Field('Notas', TextArea(data.notes, (v) => upd({ notes: v }))),
      ], [
        !ed.isNew ? h('button', {
          key: 'del', className: 'kp-btn kp-btn-danger kp-panel-foot-l',
          onClick: () => { actions.remove(project.id, 'milestones', data.id); close(); },
        }, I.trash(14), 'Eliminar') : null,
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', { key: 's', className: 'kp-btn kp-btn-primary', onClick: save, disabled: !s(data.name).trim() }, 'Guardar'),
      ], close, { center: true });
    }

    if (ed.type === 'risk' && project) {
      const save = () => { if (!s(data.title).trim()) return; actions.upsert(project.id, 'risks', data); close(); };
      const lvl = riskLevel(data);
      return Panel(ed.isNew ? 'Nuevo riesgo' : 'Riesgo', [
        Field('Riesgo', TextArea(data.title, (v) => upd({ title: v }), { placeholder: 'Qué puede salir mal y por qué', autoFocus: true, style: { minHeight: '60px' } })),
        h('div', { className: 'kp-row' },
          Field('Categoría', Select(data.category, RISK_CATEGORY.map((c) => [c, c]), (v) => upd({ category: v }))),
          Field('Estado', Select(data.status, RISK_STATUS, (v) => upd({ status: v })))),
        h('div', { className: 'kp-row' },
          Field('Probabilidad (1-5)', Select(String(n(data.probability, 3)), [['1', '1 · Muy baja'], ['2', '2 · Baja'], ['3', '3 · Media'], ['4', '4 · Alta'], ['5', '5 · Muy alta']], (v) => upd({ probability: n(v, 3) }))),
          Field('Impacto (1-5)', Select(String(n(data.impact, 3)), [['1', '1 · Muy bajo'], ['2', '2 · Bajo'], ['3', '3 · Medio'], ['4', '4 · Alto'], ['5', '5 · Muy alto']], (v) => upd({ impact: n(v, 3) })))),
        h('div', { className: 'kp-chips' }, Chip('Severidad ' + riskScore(data) + '/25 · ' + RISK_LEVEL_LABEL[lvl], { color: riskLevelColor(lvl) })),
        Field('Mitigación', TextArea(data.mitigation, (v) => upd({ mitigation: v }), { placeholder: 'Qué se hace para que no ocurra, y qué si ocurre' })),
        Field('Responsable', Input(data.owner, (v) => upd({ owner: v }))),
      ], [
        !ed.isNew ? h('button', {
          key: 'del', className: 'kp-btn kp-btn-danger kp-panel-foot-l',
          onClick: () => { actions.remove(project.id, 'risks', data.id); close(); },
        }, I.trash(14), 'Eliminar') : null,
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', { key: 's', className: 'kp-btn kp-btn-primary', onClick: save, disabled: !s(data.title).trim() }, 'Guardar'),
      ], close);
    }

    if (ed.type === 'doc' && project) {
      const save = () => { if (!s(data.name).trim()) return; actions.upsert(project.id, 'documents', data); close(); };
      return Panel(ed.isNew ? 'Nueva ficha de documento' : 'Documento', [
        data.thumb ? h('img', { src: data.thumb, alt: '', style: { maxWidth: '100%', borderRadius: 'var(--kp-radius-lg)', border: '1px solid var(--kp-soft)' } }) : null,
        Field('Nombre', Input(data.name, (v) => upd({ name: v }), { autoFocus: true })),
        h('div', { className: 'kp-row' },
          Field('Tipo', Select(data.kind, DOC_KINDS, (v) => upd({ kind: v }))),
          Field('Revisado', Select(data.reviewed ? '1' : '0', [['0', 'Pendiente de revisar'], ['1', 'Revisado']], (v) => upd({ reviewed: v === '1' })))),
        Field('Enlace', Input(data.url, (v) => upd({ url: v }), { placeholder: 'https://…' })),
        data.path ? Field('Ruta de origen', Input(data.path, (v) => upd({ path: v }), { className: 'kp-input kp-mono' })) : null,
        Field('Etiquetas', Input(arr(data.tags).join(', '), (v) => upd({ tags: v.split(',').map((x) => x.trim()).filter(Boolean) }))),
        Field('Notas', TextArea(data.notes, (v) => upd({ notes: v }), { placeholder: 'Qué contiene y para qué sirve en este proyecto' }),
          'El analista lee estas notas: describir bien un documento mejora la propuesta de plan.'),
        data.size ? h('div', { className: 'kp-sec-note' }, 'Tamaño en disco: ' + fmtBytes(data.size) + (data.dataUrl ? ' · contenido incrustado en el documento de la app' : ' · el archivo permanece en su ubicación original')) : null,
      ], [
        !ed.isNew ? h('button', {
          key: 'del', className: 'kp-btn kp-btn-danger kp-panel-foot-l',
          onClick: () => { actions.remove(project.id, 'documents', data.id); close(); },
        }, I.trash(14), 'Quitar de la biblioteca') : null,
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', { key: 's', className: 'kp-btn kp-btn-primary', onClick: save, disabled: !s(data.name).trim() }, 'Guardar'),
      ], close);
    }

    if (ed.type === 'cloud' && project) {
      return Panel('Conectar Google Drive u otra nube', [
        Note('Pega el enlace de la carpeta compartida. La app registra la fuente y guarda el enlace; para que los archivos aparezcan en la biblioteca, pega abajo su listado (un archivo por línea, con su enlace si lo tienes).', 'accent', I.drive(15)),
        Field('Tipo de fuente', Select(data.kind, SOURCE_KINDS.filter((x) => x[0] !== 'folder'), (v) => upd({ kind: v }))),
        Field('Nombre de la fuente', Input(data.label, (v) => upd({ label: v }), { placeholder: 'Ej: Drive — Carpeta del proceso' })),
        Field('Enlace de la carpeta', Input(data.url, (v) => upd({ url: v }), { placeholder: 'https://drive.google.com/drive/folders/…', autoFocus: true })),
        Field('Listado de archivos (opcional)', TextArea(data.listing, (v) => upd({ listing: v }), {
          placeholder: 'Bases del proceso.pdf\nAnexo BA-06.xlsx https://drive.google.com/file/d/…\nPlano zona C.dwg',
          style: { minHeight: '120px' },
        }), 'Una línea por archivo. Si la línea trae un enlace, queda guardado en la ficha.'),
      ], [
        h('button', { key: 'c', className: 'kp-btn', onClick: close }, 'Cancelar'),
        h('button', {
          key: 's', className: 'kp-btn kp-btn-primary', disabled: !s(data.url).trim() && !s(data.listing).trim(),
          onClick: () => {
            const src = s(data.url).trim() ? connectCloudFolder(project.id, data.url, data.label, data.kind) : null;
            const added = s(data.listing).trim() ? importListing(project.id, data.listing, src && src.id) : 0;
            shell.notify && shell.notify({
              level: 'success',
              text: 'Fuente registrada' + (added ? ' · ' + added + ' documento(s) importados del listado.' : '.'),
            });
            close();
          },
        }, 'Conectar'),
      ], close);
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 9. COMPONENTE RAÍZ
  // ════════════════════════════════════════════════════════════════════════
  const GLOBAL_TABS = [
    ['panel', 'Panel', 'dashboard'],
    ['clientes', 'Clientes', 'users'],
    ['proyectos', 'Proyectos', 'briefcase'],
  ];
  const PROJECT_TABS = [
    ['resumen', 'Resumen', 'dashboard'],
    ['plan', 'Plan', 'plan'],
    ['riesgos', 'Riesgos', 'risk'],
    ['documentos', 'Documentos', 'docs'],
    ['economia', 'Economía', 'money'],
    ['analista', 'Analista', 'sparkles'],
    ['bitacora', 'Bitácora', 'book'],
    ['ficha', 'Ficha', 'pencil'],
  ];

  const initialUi = () => ({
    tab: 'panel', projectId: '', ptab: 'resumen', q: '',
    filterClient: '', filterStatus: '', filterHealth: '',
    planStatus: '', planOwner: '', riskCell: '', riskStatus: '',
    docKind: '', docSource: '', dropOn: false,
    econTab: 'costeo', lineKind: '', lineCenter: '',
    analystMode: 'plan', question: '', answer: null,
    editor: null, proposal: null, proposalOpts: { templateId: '', scale: 1, startDate: '' },
    logDraft: null,
  });
  /** Petición de navegación hecha desde fuera de React (el agente). */
  let navRequest = null;

  function Component() {
    const [snap, setSnap] = useState({ model, loaded, loadError, saving, lastSync });
    const [ui, setUi] = useState(initialUi);
    const [, setTick] = useState(0);
    const [cfg, setCfg] = useState(() => Object.assign({ accent: '', defaultCurrency: 'CLP', alertDays: 7, budgetAlertPct: 10, denseTables: false, showFinance: true }, liveConfig));
    const uiRef = useRef(ui);
    uiRef.current = ui;

    useEffect(() => {
      listeners.add(setSnap);
      return () => { listeners.delete(setSnap); };
    }, []);

    // Reloj: mantiene vivos los "hace X" y los cálculos que dependen de hoy.
    useEffect(() => {
      const t = setInterval(() => setTick((x) => x + 1), 30000);
      return () => clearInterval(t);
    }, []);

    // Sincronización con lo que escriban otras personas en la misma instancia.
    useEffect(() => {
      let stop = false;
      let timer = null;
      const loop = () => {
        if (stop) return;
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        if (!hidden) void syncNow();
        timer = setTimeout(loop, hidden ? SYNC_IDLE : SYNC_ACTIVE);
      };
      timer = setTimeout(loop, SYNC_ACTIVE);
      return () => { stop = true; if (timer) clearTimeout(timer); };
    }, []);

    // Preferencias del host (botón ⚙️ Configurar de la barra de título).
    useEffect(() => {
      let off = null;
      const apply = (settings) => {
        liveConfig = Object.assign({}, settings || {});
        setCfg(Object.assign({ defaultCurrency: 'CLP', alertDays: 7, budgetAlertPct: 10, denseTables: false, showFinance: true }, liveConfig));
      };
      if (shell.config && shell.config.get) {
        Promise.resolve(shell.config.get()).then(apply).catch(() => {});
        if (shell.config.onChange) off = shell.config.onChange(apply);
      }
      return () => { if (typeof off === 'function') off(); };
    }, []);

    // Navegación pedida por el agente.
    useEffect(() => {
      const t = setInterval(() => {
        if (!navRequest) return;
        const req = navRequest; navRequest = null;
        setUi((u) => Object.assign({}, u, req));
      }, 400);
      return () => clearInterval(t);
    }, []);

    const m = snap.model;
    const port = useMemo(() => computePortfolio(m, cfg), [m, cfg, snap.lastSync, ui.tab]);
    const project = ui.projectId ? m.projects.find((p) => p.id === ui.projectId) : null;
    const st = project ? port.stats.get(project.id) || computeProject(project, cfg) : null;

    const go = (projectId, ptab) => setUi((u) => ({ ...u, projectId, ptab: ptab || 'resumen', q: '', editor: null, proposal: null }));
    const setPTab = (ptab) => setUi((u) => ({ ...u, ptab, q: '' }));
    const ctx = { m, port, cfg, ui, setUi, go, setPTab };

    useEffect(() => {
      if (shell.window && shell.window.setTitle) {
        shell.window.setTitle(project ? 'Proyectos · ' + project.name : 'Gestor de Proyectos');
      }
    }, [project && project.id]);

    if (!snap.loaded) {
      return h('div', { className: 'kimos-pm' },
        h('div', { className: 'kp-scroll' }, Empty(I.compass(30), 'Abriendo la cartera…', 'Cargando clientes, proyectos y documentos de esta instancia.')));
    }

    const tabs = project ? PROJECT_TABS : GLOBAL_TABS;
    const activeTab = project ? ui.ptab : ui.tab;
    const tabCount = (key) => {
      if (project) {
        if (key === 'plan') return arr(project.tasks).length;
        if (key === 'riesgos') return arr(project.risks).filter((r) => r.status !== 'closed' && r.status !== 'mitigated').length;
        if (key === 'documentos') return arr(project.documents).length;
        if (key === 'economia') return arr(project.budgetLines).length;
        if (key === 'bitacora') return arr(project.log).length;
        return 0;
      }
      if (key === 'clientes') return m.clients.length;
      if (key === 'proyectos') return m.projects.length;
      return 0;
    };

    let body = null;
    if (project) {
      body = activeTab === 'plan' ? viewProjectPlan(ctx, project, st)
        : activeTab === 'riesgos' ? viewProjectRisks(ctx, project)
          : activeTab === 'documentos' ? viewProjectDocs(ctx, project)
            : activeTab === 'economia' ? viewProjectEconomics(ctx, project)
              : activeTab === 'analista' ? viewProjectAnalyst(ctx, project)
                : activeTab === 'bitacora' ? viewProjectLog(ctx, project)
                  : activeTab === 'ficha' ? viewProjectSheet(ctx, project, st)
                    : viewProjectSummary(ctx, project, st);
    } else {
      body = ui.tab === 'clientes' ? viewClients(ctx)
        : ui.tab === 'proyectos' ? viewProjects(ctx)
          : viewDashboard(ctx);
    }

    const searchInHeader = !project && (ui.tab === 'clientes' || ui.tab === 'proyectos');

    return h('div', { className: 'kimos-pm', style: cfg.accent ? { '--primary-override': cfg.accent } : null },
      h('div', { className: 'kp-hd' },
        h('div', { className: 'kp-hd-title' },
          project
            ? IconBtn(I.arrowLeft(15), 'Volver a la cartera', () => setUi((u) => ({ ...u, projectId: '', tab: 'proyectos', q: '', proposal: null })), { ghost: true })
            : h('span', { className: 'kp-hd-mark' }, I.compass(15)),
          h('div', { style: { minWidth: 0 } },
            h('div', { className: 'kp-hd-name' }, project ? project.name : 'Gestor de Proyectos'),
            h('div', { className: 'kp-hd-sub' }, project
              ? h('span', { className: 'kp-crumbs' },
                h('button', { className: 'kp-crumb-btn', onClick: () => setUi((u) => ({ ...u, projectId: '', tab: 'proyectos' })) }, 'Cartera'),
                ' / ',
                h('button', { className: 'kp-crumb-btn', onClick: () => setUi((u) => ({ ...u, projectId: '', tab: 'proyectos', filterClient: project.clientId })) }, clientName(project.clientId)),
                project.code ? ' / ' + project.code : '')
              : m.projects.length + ' proyectos · ' + m.clients.length + ' clientes')),
          h('span', { className: 'kp-ver', title: 'Gestor de Proyectos v' + APP_VERSION }, 'v' + APP_VERSION)),

        h('div', { className: 'kp-tabs' }, tabs.map(([key, label, ic]) => {
          const count = tabCount(key);
          return h('button', {
            key, className: cx('kp-tab', activeTab === key && 'kp-tab-on'),
            onClick: () => (project ? setPTab(key) : setUi((u) => ({ ...u, tab: key, q: '' }))),
          }, (I[ic] || I.grid)(14), label, count ? h('span', { className: 'kp-tab-count' }, count) : null);
        })),

        h('div', { className: 'kp-hd-actions' },
          searchInHeader ? h('div', { className: 'kp-search', style: { width: '180px' } }, I.search(14),
            Input(ui.q, (v) => setUi((u) => ({ ...u, q: v })), { placeholder: 'Buscar…' })) : null,
          !project && ui.tab === 'proyectos' && m.clients.length
            ? Select(ui.filterClient, [['', 'Todos los clientes']].concat(m.clients.map((c) => [c.id, c.name])), (v) => setUi((u) => ({ ...u, filterClient: v })), { style: { width: 'auto' } })
            : null,
          h('span', { className: 'kp-live', title: snap.lastSync ? 'Última sincronización ' + fmtWhen(snap.lastSync) : 'En vivo' },
            h('span', { className: 'kp-live-dot', style: snap.saving ? { background: 'var(--kp-warn)' } : null }),
            snap.saving ? 'Guardando' : 'En vivo'),
          project
            ? h('button', { className: 'kp-btn kp-btn-sm kp-btn-primary', onClick: () => setPTab('analista') }, I.sparkles(14), 'Analista')
            : h('button', {
              className: 'kp-btn kp-btn-sm kp-btn-primary',
              onClick: () => setUi((u) => ({
                ...u,
                editor: ui.tab === 'clientes'
                  ? { type: 'client', isNew: true, data: newClient() }
                  : { type: 'project', isNew: true, data: newProject({ clientId: ui.filterClient || (m.clients[0] || {}).id || '' }) },
              })),
            }, I.plus(14), ui.tab === 'clientes' ? 'Cliente' : 'Proyecto'))),

      snap.loadError ? h('div', { style: { padding: '0 16px', marginTop: '10px' } }, Note(snap.loadError, 'err', I.alert(15))) : null,
      h('div', { className: 'kp-body' }, body),
      renderEditor(ctx));
  }

  // ════════════════════════════════════════════════════════════════════════
  // 10. AGENTE IA
  // ════════════════════════════════════════════════════════════════════════
  const agentProposals = new Map();
  const resolveProject = (ref) => {
    const t = s(ref).trim();
    if (!t) return model.projects.length === 1 ? model.projects[0] : null;
    return findProject(t) || model.projects.find((p) => canon(p.name) === canon(t))
      || model.projects.find((p) => canon(p.code) === canon(t))
      || model.projects.find((p) => canon(p.name).includes(canon(t))) || null;
  };
  const resolveClient = (ref) => {
    const t = s(ref).trim();
    if (!t) return null;
    return findClient(t) || model.clients.find((c) => canon(c.name) === canon(t))
      || model.clients.find((c) => canon(c.name).includes(canon(t))) || null;
  };
  const findTask = (project, ref) => {
    const t = s(ref).trim();
    if (!project || !t) return null;
    return arr(project.tasks).find((x) => x.id === t)
      || arr(project.tasks).find((x) => canon(x.name) === canon(t))
      || arr(project.tasks).find((x) => canon(x.name).includes(canon(t))) || null;
  };
  const ok = (message, extra) => Object.assign({ success: true, message }, extra || {});
  const err = (error) => ({ success: false, error });

  const AGENT_TOOLS = [
    { name: 'CREATE_CLIENT', description: 'Crea un cliente en la cartera.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, industry: { type: 'string' }, country: { type: 'string' }, contactName: { type: 'string' }, contactEmail: { type: 'string' }, notes: { type: 'string' } }, required: ['name'] } },
    { name: 'CREATE_PROJECT', description: 'Crea un proyecto bajo un cliente. client acepta id o nombre. type acepta: licitacion, implementacion, software, estudio, campana, generico.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, client: { type: 'string' }, code: { type: 'string' }, status: { type: 'string' }, priority: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, objective: { type: 'string' }, scope: { type: 'string' }, budget: { type: 'number' }, currency: { type: 'string' }, type: { type: 'string' }, manager: { type: 'string' } }, required: ['name'] } },
    { name: 'UPDATE_PROJECT', description: 'Edita campos de un proyecto (project = id, código o nombre).',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, name: { type: 'string' }, status: { type: 'string' }, priority: { type: 'string' }, healthMode: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, objective: { type: 'string' }, scope: { type: 'string' }, budget: { type: 'number' }, currency: { type: 'string' }, manager: { type: 'string' }, manualProgress: { type: 'number' } }, required: ['project'] } },
    { name: 'ADD_TASK', description: 'Añade una tarea al plan de un proyecto. phase acepta el nombre de una fase existente o crea una nueva.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, name: { type: 'string' }, phase: { type: 'string' }, owner: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, priority: { type: 'string' }, weight: { type: 'number' }, deliverable: { type: 'string' }, description: { type: 'string' } }, required: ['project', 'name'] } },
    { name: 'UPDATE_TASK', description: 'Actualiza una tarea: avance (0-100), estado (pending, in_progress, blocked, done), fechas o responsable.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, task: { type: 'string' }, progress: { type: 'number' }, status: { type: 'string' }, owner: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, name: { type: 'string' } }, required: ['project', 'task'] } },
    { name: 'ADD_MILESTONE', description: 'Añade un hito con fecha al proyecto.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' }, notes: { type: 'string' } }, required: ['project', 'name', 'date'] } },
    { name: 'ADD_RISK', description: 'Registra un riesgo con probabilidad e impacto de 1 a 5.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, title: { type: 'string' }, category: { type: 'string' }, probability: { type: 'number' }, impact: { type: 'number' }, mitigation: { type: 'string' }, owner: { type: 'string' } }, required: ['project', 'title'] } },
    { name: 'UPDATE_RISK', description: 'Actualiza un riesgo por id o por título (estado: open, watch, mitigated, closed, hit).',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, risk: { type: 'string' }, status: { type: 'string' }, probability: { type: 'number' }, impact: { type: 'number' }, mitigation: { type: 'string' } }, required: ['project', 'risk'] } },
    { name: 'ADD_DOCUMENT', description: 'Registra la ficha de un documento o enlace en la biblioteca del proyecto (no sube archivos).',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string' }, url: { type: 'string' }, notes: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['project', 'name'] } },
    { name: 'ADD_LOG', description: 'Escribe una entrada en la bitácora del proyecto (kind: note, decision, meeting, issue, milestone).',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, text: { type: 'string' }, kind: { type: 'string' }, author: { type: 'string' } }, required: ['project', 'text'] } },
    { name: 'PROPOSE_PLAN', description: 'Analiza la documentación y los datos del proyecto y devuelve una propuesta de plan de trabajo, sin aplicarla.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, templateId: { type: 'string' }, startDate: { type: 'string' }, scale: { type: 'number' } }, required: ['project'] } },
    { name: 'APPLY_PLAN', description: 'Aplica al proyecto la última propuesta generada. mode: append (por defecto) o replace.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, mode: { type: 'string' } }, required: ['project'] } },
    { name: 'OPEN_VIEW', description: 'Cambia lo que se ve en pantalla. tab: panel, clientes, proyectos. ptab: resumen, plan, riesgos, documentos, economia, analista, bitacora, ficha.',
      inputSchema: { type: 'object', properties: { tab: { type: 'string' }, project: { type: 'string' }, ptab: { type: 'string' } } } },
    { name: 'ASK', description: 'Analiza el proyecto y responde una pregunta con SUS PROPIOS NÚMEROS: diferencia entre presupuesto y costeo por líneas, CAPEX vs OPEX y modelo de costeo del servicio, aritmética del SLA y la disponibilidad, precio final y margen por centro y moneda, estado y desviación, riesgos a negociar, plazo y ventanas bloqueadas, y documentación faltante. Devuelve el análisis completo en texto para relatarlo o ampliarlo. Úsala SIEMPRE antes de responder cualquier pregunta económica o de estado sobre un proyecto: los números salen del proyecto, no de una estimación.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, question: { type: 'string' }, analysisId: { type: 'string', description: 'Opcional: fuerza un análisis concreto (presupuesto-costeo, capex-opex, sla, precio, estado, riesgos, plazo, documentos).' } }, required: ['project'] } },
    { name: 'ADD_BUDGET_LINE', description: 'Añade una partida al costeo. kind: capex (unitCost = costo unitario, qty = cantidad) u opex (unitCost = costo MENSUAL, qty = meses). center acepta el nombre o código de un centro, o "shared" para compartida.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, item: { type: 'string' }, kind: { type: 'string' }, category: { type: 'string' }, center: { type: 'string' }, qty: { type: 'number' }, unitCost: { type: 'number' }, note: { type: 'string' } }, required: ['project', 'item', 'unitCost'] } },
    { name: 'ADD_CENTER', description: 'Declara un centro de la oferta con su moneda local, su tipo de cambio contra la moneda de gestión y sus equipos, para que el precio se calcule por sede.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, name: { type: 'string' }, code: { type: 'string' }, country: { type: 'string' }, currency: { type: 'string' }, fx: { type: 'number' }, units: { type: 'number' } }, required: ['project', 'name'] } },
    { name: 'UPDATE_COSTING', description: 'Ajusta la política de precio y el modelo de servicio: margen del CAPEX y del servicio, modo de margen (sale/cost), regla de prorrateo, plazo del servicio, reajuste, horas de SLA y disponibilidad comprometida.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, capexMarginPct: { type: 'number' }, opexMarginPct: { type: 'number' }, marginMode: { type: 'string' }, allocation: { type: 'string' }, contractType: { type: 'string' }, termMonths: { type: 'number' }, escalationIndex: { type: 'string' }, escalationPct: { type: 'number' }, slaOnSiteHours: { type: 'number' }, availabilityPct: { type: 'number' }, nocMonthly: { type: 'number' } }, required: ['project'] } },
    { name: 'SET_BASELINE', description: 'Congela el costeo actual como línea base (presupuesto de referencia). Desde ahí, cada cambio de partida queda explicado en el puente presupuesto vs. costeo.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, label: { type: 'string' } }, required: ['project'] } },
  ];

  function agentSnapshot() {
    const cfg = Object.assign({ alertDays: 7, budgetAlertPct: 10 }, liveConfig);
    const port = computePortfolio(model, cfg);
    return {
      app: 'Gestor de Proyectos', version: APP_VERSION,
      resumen: {
        proyectos: model.projects.length, clientes: model.clients.length,
        enEjecucion: port.running.length,
        avanceGlobal: Math.round(port.globalProgress),
        avanceEsperado: port.globalExpected == null ? null : Math.round(port.globalExpected),
        tareasAbiertas: port.tasksOpen, tareasVencidas: port.tasksOverdue,
        riesgosAbiertos: port.risksOpen, riesgosCriticos: port.risksCritical,
        consultasAbiertas: port.openQuestions, documentos: port.docsTotal,
      },
      clientes: model.clients.map((c) => ({ id: c.id, nombre: c.name, rubro: c.industry, proyectos: model.projects.filter((p) => p.clientId === c.id).length })),
      proyectos: model.projects.map((p) => {
        const st = port.stats.get(p.id);
        return {
          id: p.id, nombre: p.name, codigo: p.code, cliente: clientName(p.clientId),
          estado: statusLabel(p.status), salud: HEALTH_LABEL[st.health], prioridad: labelOf(PRIORITY, p.priority),
          inicio: p.startDate, termino: p.endDate, diasRestantes: st.daysLeft,
          avance: Math.round(st.progress), avanceEsperado: st.expected == null ? null : Math.round(st.expected),
          tareas: st.tasksTotal, tareasCompletadas: st.tasksDone, tareasVencidas: st.tasksOverdue,
          riesgosAbiertos: st.risksOpen, riesgosCriticos: st.risksCritical,
          hitoProximo: st.nextMilestone ? { nombre: st.nextMilestone.name, fecha: st.nextMilestone.date } : null,
          documentos: st.docs, consultasAbiertas: st.openQuestions,
          presupuesto: n(p.budget) ? n(p.budget) + ' ' + p.currency : null,
          economia: (() => {
            const e2 = computeEconomics(p, cfg);
            return {
              moneda: e2.currency,
              capex: Math.round(e2.capexCost),
              feeMensual: Math.round(e2.opexMonthly),
              plazoServicioMeses: e2.term,
              costeoTotal: Math.round(e2.costingTotal),
              presupuestoDeclarado: Math.round(e2.budget),
              desvio: e2.overrun == null ? null : Math.round(e2.overrun),
              desvioPct: e2.overrunPct == null ? null : Math.round(e2.overrunPct * 10) / 10,
              estadoPresupuesto: e2.budgetState,
              margenCapexPct: Math.round(e2.capexMarginPct * 10) / 10,
              margenServicioPct: Math.round(e2.opexMarginPct * 10) / 10,
              precioContrato: Math.round(e2.contractPrice),
              centros: e2.byCenter.map((r) => ({
                nombre: r.center.name, moneda: r.center.currency, equipos: r.units,
                tipoCambio: n(r.center.fx, 1),
                capexLocal: Math.round(r.capexLocal), feeMensualLocal: Math.round(r.opexLocal),
              })),
              servicio: {
                slaHorasEnSitio: n(e2.service.svc.slaOnSiteHours, 0),
                disponibilidadPct: n(e2.service.svc.availabilityPct, 0),
                contradiccionSla: !!e2.service.contradiction,
                escenarios: e2.service.scenarios.map((sc) => ({ id: sc.id, nombre: sc.name, mensual: Math.round(sc.monthly), vsFeeActual: sc.vsCurrent == null ? null : Math.round(sc.vsCurrent * 10) / 10 })),
              },
              lineaBase: e2.bridge ? { total: Math.round(e2.bridge.baseTotal), suben: Math.round(e2.bridge.upTotal), bajan: Math.round(e2.bridge.downTotal) } : null,
            };
          })(),
          fases: arr(p.phases).slice().sort((a, b) => n(a.order) - n(b.order)).map((f) => ({ id: f.id, nombre: f.name })),
          tareasDetalle: arr(p.tasks).slice(0, 60).map((t) => ({
            id: t.id, nombre: t.name, estado: t.status, avance: taskProgress(t),
            responsable: t.owner, inicio: t.startDate, termino: t.endDate,
          })),
          riesgosDetalle: arr(p.risks).slice(0, 30).map((r) => ({
            id: r.id, titulo: r.title, categoria: r.category, probabilidad: n(r.probability, 3),
            impacto: n(r.impact, 3), severidad: riskScore(r), estado: r.status,
          })),
        };
      }),
      fuentes: arr(model.sources).map((x) => ({ id: x.id, tipo: x.kind, nombre: x.label, proyecto: (findProject(x.projectId) || {}).name || '', archivos: x.fileCount })),
      plantillasDePlan: PLAN_TEMPLATES.map((t) => ({ id: t.id, nombre: t.name })),
    };
  }

  async function dispatchAction(action) {
    const type = s(action && action.type).toUpperCase();
    const pl = (action && action.payload) || {};
    try {
      if (type === 'CREATE_CLIENT') {
        const c = actions.createClient({
          name: s(pl.name).trim(), industry: s(pl.industry), country: s(pl.country),
          contactName: s(pl.contactName), contactEmail: s(pl.contactEmail), notes: s(pl.notes),
        });
        return c ? ok('Cliente "' + c.name + '" creado.', { clientId: c.id }) : err('El cliente necesita un nombre.');
      }
      if (type === 'CREATE_PROJECT') {
        const client = resolveClient(pl.client);
        const p = actions.createProject({
          name: s(pl.name).trim(), clientId: client ? client.id : '', code: s(pl.code),
          status: PROJECT_STATUS.some((r) => r[0] === pl.status) ? pl.status : 'planning',
          priority: PRIORITY.some((r) => r[0] === pl.priority) ? pl.priority : 'medium',
          startDate: s(pl.startDate) || today(), endDate: s(pl.endDate) || addDays(today(), 90),
          objective: s(pl.objective), scope: s(pl.scope), manager: s(pl.manager),
          budget: n(pl.budget, 0), currency: s(pl.currency) || s(liveConfig.defaultCurrency) || 'CLP',
          type: s(pl.type),
        });
        if (!p) return err('El proyecto necesita un nombre.');
        if (s(pl.client) && !client) return ok('Proyecto "' + p.name + '" creado, pero no encontré al cliente "' + pl.client + '": quedó sin cliente asignado.', { projectId: p.id });
        return ok('Proyecto "' + p.name + '" creado.', { projectId: p.id });
      }
      const needsProject = ['UPDATE_PROJECT', 'ADD_TASK', 'UPDATE_TASK', 'ADD_MILESTONE', 'ADD_RISK', 'UPDATE_RISK', 'ADD_DOCUMENT', 'ADD_LOG', 'PROPOSE_PLAN', 'APPLY_PLAN', 'ASK', 'ADD_BUDGET_LINE', 'ADD_CENTER', 'UPDATE_COSTING', 'SET_BASELINE'];
      const p = needsProject.includes(type) ? resolveProject(pl.project) : null;
      if (needsProject.includes(type) && !p) return err('No encontré el proyecto "' + s(pl.project) + '". Usa su id, su código o su nombre exacto.');

      if (type === 'UPDATE_PROJECT') {
        const patch = {};
        ['name', 'objective', 'scope', 'manager', 'currency', 'startDate', 'endDate'].forEach((k) => { if (pl[k] != null) patch[k] = s(pl[k]); });
        if (pl.status != null && PROJECT_STATUS.some((r) => r[0] === pl.status)) patch.status = pl.status;
        if (pl.priority != null && PRIORITY.some((r) => r[0] === pl.priority)) patch.priority = pl.priority;
        if (pl.healthMode != null && HEALTH.some((r) => r[0] === pl.healthMode)) patch.healthMode = pl.healthMode;
        if (pl.budget != null) patch.budget = n(pl.budget, 0);
        if (pl.manualProgress != null) patch.manualProgress = clamp(n(pl.manualProgress, 0), 0, 100);
        if (!Object.keys(patch).length) return err('No indicaste ningún campo válido que actualizar.');
        actions.saveProject(p.id, patch);
        return ok('Proyecto "' + p.name + '" actualizado (' + Object.keys(patch).join(', ') + ').');
      }
      if (type === 'ADD_TASK') {
        if (!s(pl.name).trim()) return err('La tarea necesita un nombre.');
        let phaseId = '';
        if (s(pl.phase).trim()) {
          const found = arr(p.phases).find((f) => canon(f.name) === canon(pl.phase) || f.id === pl.phase);
          if (found) phaseId = found.id;
          else {
            const nf = { id: uid('fas'), name: s(pl.phase).trim(), order: arr(p.phases).length, updatedAt: stamp() };
            actions.upsert(p.id, 'phases', nf);
            phaseId = nf.id;
          }
        }
        const t = newTask({
          name: s(pl.name).trim(), phaseId, owner: s(pl.owner),
          startDate: s(pl.startDate), endDate: s(pl.endDate),
          priority: PRIORITY.some((r) => r[0] === pl.priority) ? pl.priority : 'medium',
          weight: n(pl.weight, 1) || 1, deliverable: s(pl.deliverable), description: s(pl.description),
        });
        actions.upsert(p.id, 'tasks', t);
        return ok('Tarea "' + t.name + '" añadida a "' + p.name + '".', { taskId: t.id });
      }
      if (type === 'UPDATE_TASK') {
        const t = findTask(p, pl.task);
        if (!t) return err('No encontré la tarea "' + s(pl.task) + '" en "' + p.name + '".');
        const patch = {};
        ['owner', 'startDate', 'endDate', 'name'].forEach((k) => { if (pl[k] != null) patch[k] = s(pl[k]); });
        if (pl.status != null && TASK_STATUS.some((r) => r[0] === pl.status)) patch.status = pl.status;
        if (pl.progress != null) patch.progress = clamp(n(pl.progress, 0), 0, 100);
        if (patch.progress != null && patch.progress >= 100) patch.status = 'done';
        if (patch.status === 'done' && patch.progress == null) patch.progress = 100;
        if (!Object.keys(patch).length) return err('No indicaste ningún campo válido que actualizar.');
        actions.upsert(p.id, 'tasks', Object.assign({}, t, patch));
        return ok('Tarea "' + t.name + '" actualizada.');
      }
      if (type === 'ADD_MILESTONE') {
        if (!parseDay(pl.date)) return err('La fecha del hito debe venir como AAAA-MM-DD.');
        const mm = newMilestone({ name: s(pl.name).trim(), date: s(pl.date).slice(0, 10), notes: s(pl.notes), critical: true });
        actions.upsert(p.id, 'milestones', mm);
        return ok('Hito "' + mm.name + '" agendado para el ' + fmtDay(mm.date) + '.', { milestoneId: mm.id });
      }
      if (type === 'ADD_RISK') {
        const r = newRisk({
          title: s(pl.title).trim(),
          category: RISK_CATEGORY.includes(s(pl.category)) ? s(pl.category) : 'Plazo',
          probability: clamp(n(pl.probability, 3), 1, 5), impact: clamp(n(pl.impact, 3), 1, 5),
          mitigation: s(pl.mitigation), owner: s(pl.owner),
        });
        if (!r.title) return err('El riesgo necesita un título.');
        actions.upsert(p.id, 'risks', r);
        return ok('Riesgo registrado con severidad ' + riskScore(r) + '/25 (' + RISK_LEVEL_LABEL[riskLevel(r)] + ').', { riskId: r.id });
      }
      if (type === 'UPDATE_RISK') {
        const ref = s(pl.risk);
        const r = arr(p.risks).find((x) => x.id === ref) || arr(p.risks).find((x) => canon(x.title).includes(canon(ref)));
        if (!r) return err('No encontré el riesgo "' + ref + '".');
        const patch = {};
        if (pl.status != null && RISK_STATUS.some((x) => x[0] === pl.status)) patch.status = pl.status;
        if (pl.probability != null) patch.probability = clamp(n(pl.probability, 3), 1, 5);
        if (pl.impact != null) patch.impact = clamp(n(pl.impact, 3), 1, 5);
        if (pl.mitigation != null) patch.mitigation = s(pl.mitigation);
        if (!Object.keys(patch).length) return err('No indicaste ningún campo válido que actualizar.');
        actions.upsert(p.id, 'risks', Object.assign({}, r, patch));
        return ok('Riesgo actualizado.');
      }
      if (type === 'ADD_DOCUMENT') {
        const d = newDoc({
          name: s(pl.name).trim(), url: s(pl.url), notes: s(pl.notes), origin: 'agente',
          kind: DOC_KINDS.some((x) => x[0] === pl.kind) ? pl.kind : docKindOf(pl.name, ''),
          tags: arr(pl.tags).map(s).filter(Boolean),
        });
        if (!d.name) return err('El documento necesita un nombre.');
        actions.upsert(p.id, 'documents', d);
        return ok('Documento "' + d.name + '" registrado en la biblioteca de "' + p.name + '".', { documentId: d.id });
      }
      if (type === 'ADD_LOG') {
        if (!s(pl.text).trim()) return err('La entrada necesita texto.');
        actions.log(p.id, LOG_KINDS.some((x) => x[0] === pl.kind) ? pl.kind : 'note', pl.text, s(pl.author) || 'Agente');
        return ok('Entrada registrada en la bitácora de "' + p.name + '".');
      }
      if (type === 'PROPOSE_PLAN') {
        const proposal = proposePlan(p, {
          templateId: PLAN_TEMPLATES.some((t) => t.id === pl.templateId) ? pl.templateId : '',
          startDate: s(pl.startDate), scale: n(pl.scale, 1) || 1,
        });
        agentProposals.set(p.id, proposal);
        navRequest = { projectId: p.id, ptab: 'analista', proposal: { projectId: p.id, data: proposal } };
        return ok('Propuesta lista para "' + p.name + '": ' + proposal.templateName + '.', {
          propuesta: {
            tipo: proposal.templateName, confianza: proposal.confidence,
            desde: proposal.start, hasta: proposal.end,
            fases: proposal.phases.map((f) => f.name),
            tareas: proposal.tasks.map((t) => ({ fase: (proposal.phases.find((f) => f.id === t.phaseId) || {}).name, nombre: t.name, inicio: t.startDate, termino: t.endDate, responsable: t.owner })),
            hitos: proposal.milestones.map((mm) => ({ nombre: mm.name, fecha: mm.date })),
            riesgos: proposal.risks.map((r) => r.title),
            documentosQueFaltan: proposal.missing.map((x) => x.label),
          },
          nota: 'Nada se aplicó todavía: usa APPLY_PLAN para incorporarla al proyecto.',
        });
      }
      if (type === 'APPLY_PLAN') {
        const proposal = agentProposals.get(p.id) || proposePlan(p, {});
        const mode = s(pl.mode) === 'replace' ? 'replace' : 'append';
        let done = false;
        commit((m) => { done = applyProposal(p.id, proposal, mode); return m; });
        if (!done) return err('No pude aplicar la propuesta.');
        agentProposals.delete(p.id);
        navRequest = { projectId: p.id, ptab: 'plan', proposal: null };
        return ok('Plan ' + (mode === 'replace' ? 'reemplazado' : 'añadido') + ' en "' + p.name + '": ' +
          proposal.phases.length + ' fases y ' + proposal.tasks.length + ' tareas.');
      }
      if (type === 'ASK') {
        const cfgNow = Object.assign({ alertDays: 7, budgetAlertPct: 10 }, liveConfig);
        const res = answerQuestion(p, s(pl.question), cfgNow, s(pl.analysisId) || '');
        navRequest = {
          projectId: p.id, ptab: 'analista', analystMode: 'preguntas',
          question: s(pl.question) || (res.analysis ? res.analysis.question : ''),
          answer: { projectId: p.id, data: res },
        };
        if (!res.ok) {
          return ok('No reconocí la pregunta para "' + p.name + '".', {
            analisisDisponibles: ANALYSES.map((a) => ({ id: a.id, titulo: a.title, ejemplo: a.question })),
            respuesta: res.text,
          });
        }
        return ok('Análisis «' + res.analysis.title + '» de "' + p.name + '".', {
          analisis: res.analysis.id, titulo: res.analysis.title,
          respuesta: res.text,
          nota: 'Las cifras salen del costeo, el plan y los riesgos de este proyecto. Relátalas tal cual o amplíalas, pero no las recalcules por tu cuenta.',
        });
      }
      if (type === 'ADD_BUDGET_LINE') {
        if (!s(pl.item).trim()) return err('La partida necesita una descripción.');
        const center = s(pl.center) && s(pl.center) !== 'shared'
          ? arr(p.centers).find((c) => c.id === pl.center || canon(c.name) === canon(pl.center) || canon(c.code) === canon(pl.center))
          : null;
        const line = newLine({
          item: s(pl.item).trim(),
          kind: s(pl.kind) === 'opex' ? 'opex' : 'capex',
          category: LINE_CATEGORIES.some((c) => c[0] === pl.category) ? pl.category : (s(pl.kind) === 'opex' ? 'servicio' : 'equipamiento'),
          centerId: center ? center.id : 'shared',
          qty: n(pl.qty, s(pl.kind) === 'opex' ? n(normalizeService(p.service).termMonths, 12) : 1),
          unitCost: n(pl.unitCost, 0), note: s(pl.note),
        });
        actions.upsert(p.id, 'budgetLines', line);
        const e2 = computeEconomics(findProject(p.id), Object.assign({ budgetAlertPct: 10 }, liveConfig));
        return ok('Partida añadida (' + labelOf(LINE_KINDS, line.kind) + '): ' + money0(lineTotal(line), p.currency) + '. ' +
          'CAPEX ahora ' + money0(e2.capexCost, p.currency) + ' y fee ' + money0(e2.opexMonthly, p.currency) + '/mes.', { lineId: line.id });
      }
      if (type === 'ADD_CENTER') {
        if (!s(pl.name).trim()) return err('El centro necesita un nombre.');
        const c = newCenter({
          name: s(pl.name).trim(), code: s(pl.code), country: s(pl.country),
          currency: s(pl.currency) || s(p.currency) || 'CLP',
          fx: n(pl.fx, 1) || 1, units: n(pl.units, 0),
          colorIndex: arr(p.centers).length,
        });
        actions.saveProject(p.id, { centers: arr(p.centers).concat([c]) });
        return ok('Centro "' + c.name + '" declarado en ' + c.currency + ' (tipo de cambio ' + fmtNum(c.fx, 2) + ') con ' + fmtNum(c.units) + ' equipos.', { centerId: c.id });
      }
      if (type === 'UPDATE_COSTING') {
        const pricePatch = {};
        if (pl.capexMarginPct != null) pricePatch.capexMarginPct = clamp(n(pl.capexMarginPct, 0), 0, 90);
        if (pl.opexMarginPct != null) pricePatch.opexMarginPct = clamp(n(pl.opexMarginPct, 0), 0, 90);
        if (pl.marginMode != null && MARGIN_MODES.some((x) => x[0] === pl.marginMode)) pricePatch.marginMode = pl.marginMode;
        if (pl.allocation != null && ALLOC_RULES.some((x) => x[0] === pl.allocation)) pricePatch.allocation = pl.allocation;
        if (pl.contractType != null) pricePatch.contractType = s(pl.contractType);
        const svcPatch = {};
        if (pl.termMonths != null) svcPatch.termMonths = clamp(n(pl.termMonths, 12), 1, 240);
        if (pl.escalationIndex != null && ESCALATION_INDEX.some((x) => x[0] === pl.escalationIndex)) svcPatch.escalationIndex = pl.escalationIndex;
        if (pl.escalationPct != null) svcPatch.escalationPct = clamp(n(pl.escalationPct, 0), 0, 50);
        if (pl.slaOnSiteHours != null) svcPatch.slaOnSiteHours = Math.max(0, n(pl.slaOnSiteHours, 4));
        if (pl.availabilityPct != null) svcPatch.availabilityPct = clamp(n(pl.availabilityPct, 99), 0, 100);
        if (pl.nocMonthly != null) svcPatch.nocMonthly = Math.max(0, n(pl.nocMonthly, 0));
        if (!Object.keys(pricePatch).length && !Object.keys(svcPatch).length) return err('No indicaste ningún parámetro válido que actualizar.');
        const patch = {};
        if (Object.keys(pricePatch).length) patch.pricing = Object.assign(defaultPricing(), p.pricing || {}, pricePatch, { updatedAt: stamp() });
        if (Object.keys(svcPatch).length) patch.service = Object.assign(normalizeService(p.service), svcPatch, { updatedAt: stamp() });
        actions.saveProject(p.id, patch);
        const e2 = computeEconomics(findProject(p.id), Object.assign({ budgetAlertPct: 10 }, liveConfig));
        return ok('Costeo actualizado. Precio del contrato: ' + money0(e2.contractPrice, p.currency) +
          ' (margen CAPEX ' + fmtNum(e2.capexMarginPct, 1) + '%, servicio ' + fmtNum(e2.opexMarginPct, 1) + '%, plazo ' + e2.term + ' meses).');
      }
      if (type === 'SET_BASELINE') {
        const lines = arr(p.budgetLines);
        if (!lines.length) return err('No hay partidas de costeo que congelar.');
        const snapshot = lines.map((b) => newLine(Object.assign({}, b, { id: 'blb-' + b.id })));
        actions.saveProject(p.id, {
          baseline: { label: s(pl.label) || 'Línea base ' + fmtDay(today()), capturedAt: stamp(), note: 'Congelada por el agente.', lines: snapshot },
          budgetLines: lines.map((b) => touch(Object.assign({}, b, { baselineRef: 'blb-' + b.id }))),
        });
        return ok('Línea base fijada con ' + snapshot.length + ' partidas por ' + money0(sum(snapshot, lineTotal), p.currency) + '.');
      }
      if (type === 'OPEN_VIEW') {
        const target = s(pl.project) ? resolveProject(pl.project) : null;
        navRequest = {
          projectId: target ? target.id : '',
          tab: GLOBAL_TABS.some((t) => t[0] === pl.tab) ? pl.tab : (target ? 'proyectos' : 'panel'),
          ptab: PROJECT_TABS.some((t) => t[0] === pl.ptab) ? pl.ptab : 'resumen',
        };
        return ok(target ? 'Abriendo "' + target.name + '".' : 'Vista cambiada.');
      }
      return err('Acción no reconocida: ' + type);
    } catch (e) {
      return err((e && e.message) || 'Error inesperado al ejecutar la acción.');
    }
  }

  const offAgent = shell.agent && shell.agent.register ? shell.agent.register({
    label: 'Gestor de Proyectos',
    description: 'Cartera de proyectos por cliente: crear clientes y proyectos, llevar el plan (fases, tareas, hitos), registrar y actualizar riesgos, indexar documentos, escribir la bitácora y proponer o aplicar planes de trabajo completos con el analista.',
    tools: AGENT_TOOLS,
    getSnapshot: agentSnapshot,
    dispatchAction,
  }) : null;

  // ════════════════════════════════════════════════════════════════════════
  // 11. ARRANQUE
  // ════════════════════════════════════════════════════════════════════════
  (async () => {
    try {
      const remote = await readRemote();
      if (remote && (remote.projects.length || remote.clients.length || remote.seeded)) {
        model = remote;
      } else {
        // Primera apertura: se siembra el primer cliente y su proyecto.
        const seed = seedParqueArauco();
        model = Object.assign(emptyModel(), {
          seeded: true, clients: [seed.client], projects: [seed.project], updatedAt: stamp(),
        });
        if (instanceId && shell.saveData) { try { await writeRemote(model); lastSync = stamp(); } catch (e) { /* se reintenta al primer cambio */ } }
      }
      loadError = instanceId ? null : 'Esta ventana no tiene instancia: abre la app desde 🗂️ Documentos → Nuevo para que los cambios se guarden.';
    } catch (e) {
      loadError = (e && e.message) || 'No se pudieron cargar los datos.';
    }
    loaded = true;
    emit();
  })();

  return {
    Component,
    unmount() {
      if (offAgent) offAgent();
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      listeners.clear();
      folderHandles.clear();
      objectUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* ya liberado */ } });
      objectUrls.clear();
    },
  };
}
