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
  const APP_VERSION = '1.0.0';
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
      proj.budgetLines = arr(p.budgetLines).filter(Boolean).map((x) => Object.assign({ id: uid('bl'), item: '', qty: 1, unitCost: 0, note: '', updatedAt: stamp() }, x));
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

    const BL = (id, item, qty, unitCost, note) => ({ id: 'bl-pa-' + id, item, qty, unitCost, note, updatedAt: stamp() });
    const budgetLines = [
      BL('01', 'Hardware PAK (Chile) — tótems indoor interactivos', 12, 5500, 'Consistente con el alcance de 12 unidades.'),
      BL('02', 'Hardware PLC (Colombia) — tótems indoor interactivos', 15, 5500, 'Sujeto a la discrepancia 15 vs. 17-19 unidades.'),
      BL('03', 'Cómputo — Nano PC N100 + SSD', 27, 438, 'La licencia Porteus la adquiere Parque Arauco (resp. 63): descontados USD 42 por unidad.'),
      BL('04', 'Integración analítica (CPM) — cámaras y enrolamiento', 27, 350, 'Solo hardware de captura y configuración: la plataforma la provee PA (resp. 62).'),
      BL('05', 'Montaje, anclaje, conectorización y puesta en marcha', 27, 900, 'Reformulada: obras civiles y puntos eléctricos/de red salen del alcance (resp. 77 y 78).'),
      BL('06', 'Certificación de puntos de red y electricidad (PLC §3.6 y PAK resp. 101)', 27, 180, 'Partida separada exigida por las Bases; incluye recableado si un punto no aprueba.'),
      BL('07', 'Energía y respaldo — UPS con tarjeta SNMP', 10, 300, 'Las Bases permiten centralizar hasta 3 tótems por UPS.'),
      BL('08', 'Plataforma de health check y monitoreo remoto (licenciamiento y operación)', 1, 24000, 'PARTIDA AUSENTE en el costeo original: "el oferente debe suministrar la solución completa" (resp. 64).'),
      BL('09', 'Tótem de laboratorio completo', 1, 6400, 'PARTIDA AUSENTE: exigido por la resp. 56, con su cómputo, pantallas y cámaras.'),
      BL('10', 'Stock inicial de repuestos críticos en Chile y Colombia', 1, 18000, 'Condición necesaria para sostener el SLA comprometido.'),
      BL('11', 'Desmontaje y disposición de los tótems existentes en PLC', 15, 220, 'A cargo del oferente.'),
      BL('12', 'Gastos administrativos — pólizas y garantías', 1, 15000, 'Revisar contra el costo real de TRC/CAR al 100% del contrato y RC por USD 300.000.'),
      BL('13', 'Provisión por garantía de 3 años (pantallas, touch, NUC, cámaras y UPS)', 1, 14000, 'PARTIDA AUSENTE en el costeo original.'),
      BL('14', 'Reserva de contingencia', 1, 16000, 'Elevada por el riesgo de condiciones ocultas aún no asignado (resp. 75).'),
      BL('15', 'OPEX anual de servicio post-venta (12 meses)', 12, 3200, 'USD 118 por tótem/mes en dos países con SLA de 4 h en sitio 24x7: es el punto más frágil del presupuesto y debe recalcularse.'),
    ];

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
      openQuestions: sum(open, (p) => stats.get(p.id).openQuestions),
      activity: activity.slice(0, 40),
    };
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
                : '—', { key: 'k6', icon: I.money(14), foot: 'presupuesto de los proyectos abiertos' })
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
            ? Kpi('Presupuesto', n(p.budget) ? fmtMoney(p.budget, p.currency) : '—', { key: 'p6', icon: I.money(14), foot: st.budgetPlanned ? 'costeo: ' + fmtMoney(st.budgetPlanned, p.currency) : 'sin líneas de costeo' })
            : Kpi('Consultas', fmtNum(st.openQuestions), { key: 'p6', icon: I.alert(14), foot: 'abiertas con el cliente' }))),

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

  // ── Proyecto · Analista ─────────────────────────────────────────────────
  function viewProjectAnalyst(ctx, p) {
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
        SectionHead('Costeo por partidas', linesTotal ? 'Total: ' + fmtMoney(linesTotal, p.currency) : 'Sin líneas todavía',
          h('button', {
            className: 'kp-btn kp-btn-sm',
            onClick: () => set({ budgetLines: lines.concat([{ id: uid('bl'), item: '', qty: 1, unitCost: 0, note: '', updatedAt: stamp() }]) }),
          }, I.plus(13), 'Línea')),
        lines.length ? h('div', { className: 'kp-tablewrap' },
          h('table', { className: 'kp-table' },
            h('thead', null, h('tr', null, h('th', null, 'Partida'), h('th', { className: 'kp-td-num' }, 'Cant.'),
              h('th', { className: 'kp-td-num' }, 'Unitario'), h('th', { className: 'kp-td-num' }, 'Total'), h('th', null, 'Observación'), h('th', null, ''))),
            h('tbody', null, lines.map((b, i) => {
              const upd = (patch) => set({ budgetLines: lines.map((x, j) => (j === i ? touch(Object.assign({}, x, patch)) : x)) });
              return h('tr', { key: b.id },
                h('td', { style: { minWidth: '220px' } }, h('input', { className: 'kp-cellinput', value: s(b.item), placeholder: 'Descripción de la partida', onChange: (e) => upd({ item: e.target.value }) })),
                h('td', { className: 'kp-td-num' }, h('input', { className: 'kp-cellinput', type: 'number', min: 0, step: 'any', value: n(b.qty, 0), style: { textAlign: 'right', width: '72px' }, onChange: (e) => upd({ qty: n(e.target.value, 0) }) })),
                h('td', { className: 'kp-td-num' }, h('input', { className: 'kp-cellinput', type: 'number', min: 0, step: 'any', value: n(b.unitCost, 0), style: { textAlign: 'right', width: '100px' }, onChange: (e) => upd({ unitCost: n(e.target.value, 0) }) })),
                h('td', { className: 'kp-td-num kp-strong' }, fmtNum(n(b.qty, 0) * n(b.unitCost, 0))),
                h('td', { style: { minWidth: '200px' } }, h('input', { className: 'kp-cellinput', value: s(b.note), onChange: (e) => upd({ note: e.target.value }) })),
                h('td', { className: 'kp-td-act' }, IconBtn(I.trash(13), 'Quitar la línea', () => set({ budgetLines: lines.filter((x, j) => j !== i) }), { ghost: true, tone: 'danger' })));
            }),
            h('tr', null, h('td', { className: 'kp-strong' }, 'Total del costeo'), h('td', null), h('td', null),
              h('td', { className: 'kp-td-num kp-strong' }, fmtNum(linesTotal)), h('td', { className: 'kp-muted' }, s(p.currency)), h('td', null)))))
          : h('div', { className: 'kp-sec-note' }, 'Agrega las partidas para que el presupuesto sea trazable y no un número suelto.')) : null,

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
    ['analista', 'Analista', 'sparkles'],
    ['bitacora', 'Bitácora', 'book'],
    ['ficha', 'Ficha', 'pencil'],
  ];

  const initialUi = () => ({
    tab: 'panel', projectId: '', ptab: 'resumen', q: '',
    filterClient: '', filterStatus: '', filterHealth: '',
    planStatus: '', planOwner: '', riskCell: '', riskStatus: '',
    docKind: '', docSource: '', dropOn: false,
    editor: null, proposal: null, proposalOpts: { templateId: '', scale: 1, startDate: '' },
    logDraft: null,
  });
  /** Petición de navegación hecha desde fuera de React (el agente). */
  let navRequest = null;

  function Component() {
    const [snap, setSnap] = useState({ model, loaded, loadError, saving, lastSync });
    const [ui, setUi] = useState(initialUi);
    const [, setTick] = useState(0);
    const [cfg, setCfg] = useState(() => Object.assign({ accent: '', defaultCurrency: 'CLP', alertDays: 7, denseTables: false, showFinance: true }, liveConfig));
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
        setCfg(Object.assign({ defaultCurrency: 'CLP', alertDays: 7, denseTables: false, showFinance: true }, liveConfig));
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
    { name: 'OPEN_VIEW', description: 'Cambia lo que se ve en pantalla. tab: panel, clientes, proyectos. ptab: resumen, plan, riesgos, documentos, analista, bitacora, ficha.',
      inputSchema: { type: 'object', properties: { tab: { type: 'string' }, project: { type: 'string' }, ptab: { type: 'string' } } } },
  ];

  function agentSnapshot() {
    const cfg = Object.assign({ alertDays: 7 }, liveConfig);
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
      const needsProject = ['UPDATE_PROJECT', 'ADD_TASK', 'UPDATE_TASK', 'ADD_MILESTONE', 'ADD_RISK', 'UPDATE_RISK', 'ADD_DOCUMENT', 'ADD_LOG', 'PROPOSE_PLAN', 'APPLY_PLAN'];
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
