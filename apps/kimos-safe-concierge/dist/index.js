/**
 * KIMOS Safe Concierge — consejería virtual con IA para comunidades
 * residenciales, edificios corporativos y porterías (v1.0).
 *
 * Dos caras de la misma ventana:
 *
 *   · **Tótem** — la pantalla que ve quien llega al acceso: un avatar
 *     (humanizado, caricaturizado o abstracto) que atiende visitas, residentes,
 *     proveedores, encomiendas, citofonía y pedidos de auxilio, con voz y
 *     botones grandes. Funciona 24/7 sin depender de que haya alguien en la
 *     conserjería.
 *   · **Consola** — el centro de operaciones del personal: accesos,
 *     encomiendas, directorio, bitácora forense de incidentes, protocolos de
 *     emergencia y cumplimiento normativo.
 *
 * Principios de diseño (no son adorno: están cableados en el código):
 *
 *   1. **La IA propone, la persona decide.** Ninguna detección llama sola a un
 *      servicio de emergencia ni abre un acceso. El motor de riesgo clasifica y
 *      escala hasta "requiere validación humana"; el contacto con SAMU,
 *      Bomberos, Carabineros, PDI o la central queda registrado con quién lo
 *      autorizó.
 *   2. **Privacidad por diseño.** Sin biometría. El análisis de cámara y
 *      micrófono ocurre en el dispositivo (diferencia de cuadros y energía
 *      acústica): no se suben imágenes ni audio, no se transcriben
 *      conversaciones y en modo privacidad las personas se registran como
 *      "Persona N" hasta que alguien justifique identificarlas.
 *   3. **Trazabilidad.** Cada acceso e incidente entra en una bitácora
 *      encadenada con SHA-256 (cada registro sella el anterior), verificable
 *      desde la pestaña Cumplimiento y exportable para el Ministerio Público.
 *   4. **Detección honesta.** El tótem detecta *patrones compatibles* con
 *      agitación, forcejeo, gritos o impactos — nunca "delitos". Cada
 *      detección lleva su confianza y su margen de error a la vista.
 *
 * Contrato AppShellV1: bundle ESM puro, `globalThis.React` del host, sin JSX,
 * estado dentro del closure (una copia por ventana). Las capacidades v2
 * (`shell.config`, `shell.documents`) se usan solo si existen.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef } = React;

  // Mantener en sincronía con manifest.json y con el catálogo raíz.
  const APP_VERSION = '1.1.0';

  const instanceId = shell.app && shell.app.instanceId;

  // ── Utilidades ──────────────────────────────────────────────────────────
  const s = (v) => (v == null ? '' : String(v));
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const stamp = () => new Date().toISOString();
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const canon = (v) => s(v).trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const ms = (a, b) => { const x = Date.parse(s(a)), y = Date.parse(s(b)); return (Number.isFinite(x) && Number.isFinite(y)) ? y - x : null; };
  const fmtTime = (v) => { if (!s(v)) return ''; try { return new Date(s(v)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return s(v); } };
  const fmtDateTime = (v) => { if (!s(v)) return ''; try { return new Date(s(v)).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s(v); } };
  const fmtDur = (millis) => {
    if (millis == null) return '—';
    const sec = Math.max(0, Math.round(millis / 1000));
    if (sec < 60) return sec + ' s';
    const m = Math.floor(sec / 60);
    if (m < 60) return m + ' min ' + (sec % 60) + ' s';
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  };
  const ago = (v) => { const d = ms(v, stamp()); return d == null ? '' : fmtDur(d); };
  const SYNC_MS = 20000;

  /** Código numérico de un solo uso: legible en voz alta y por teléfono. */
  function otp(len) {
    const n = num(len, 6);
    let out = '';
    const rnd = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
      : () => Math.random();
    for (let i = 0; i < n; i++) out += String(Math.floor(rnd() * 10));
    return out;
  }

  // ── Configuración ───────────────────────────────────────────────────────
  const DEFAULTS = {
    siteName: '', siteAddress: '', startView: 'panel',
    avatarStyle: 'human', avatarName: 'Kim', voice: true,
    cameraSensor: false, audioSensor: false, sensitivity: 'medium',
    autoWarn: true, retentionDays: 120, privacyMode: true, accent: '#19ACB1',
    // Solo desde la consola (no es parte del formulario ⚙️ del host): abre el
    // gateway público para que las cámaras de la comunidad publiquen eventos.
    ingestEnabled: false,
  };
  // Mínimo legal de conservación de registros de vigilancia (Ley 21.659).
  const LEGAL_RETENTION_DAYS = 120;

  const SENSITIVITY = {
    low: { motion: 0.20, sustain: 4200, sound: 0.42, spike: 0.30, conf: 0.85 },
    medium: { motion: 0.14, sustain: 3000, sound: 0.34, spike: 0.24, conf: 1 },
    high: { motion: 0.09, sustain: 2000, sound: 0.27, spike: 0.18, conf: 1.15 },
  };
  const tuning = () => SENSITIVITY[model.settings.sensitivity] || SENSITIVITY.medium;

  // ── Catálogo de riesgo ──────────────────────────────────────────────────
  // `sev` = severidad 0-100 del tipo de evento. El nivel final sale de
  // severidad × confianza × contexto (ver `assess`).
  const RISK_TYPES = [
    { id: 'panic', label: 'Botón de auxilio del tótem', sev: 88, icon: '🆘', family: 'emergencia' },
    { id: 'medical', label: 'Emergencia médica', sev: 90, icon: '🚑', family: 'emergencia' },
    { id: 'fire', label: 'Humo o fuego', sev: 96, icon: '🔥', family: 'emergencia' },
    { id: 'fall', label: 'Persona en el suelo (posible caída)', sev: 80, icon: '🧍', family: 'emergencia' },
    { id: 'weapon', label: 'Objeto peligroso a la vista', sev: 95, icon: '⚠️', family: 'seguridad' },
    { id: 'aggression', label: 'Patrón compatible con agresión o forcejeo', sev: 85, icon: '🥊', family: 'seguridad' },
    { id: 'threat', label: 'Amenaza verbal', sev: 70, icon: '🗣️', family: 'seguridad' },
    { id: 'shout', label: 'Grito o pedido de auxilio', sev: 72, icon: '📢', family: 'seguridad' },
    { id: 'impact', label: 'Impacto, rotura o detonación', sev: 66, icon: '💥', family: 'seguridad' },
    { id: 'forced', label: 'Intento de forzar el acceso', sev: 78, icon: '🔨', family: 'seguridad' },
    { id: 'unauthorized', label: 'Acceso no autorizado', sev: 74, icon: '🚫', family: 'seguridad' },
    { id: 'tailgating', label: 'Ingreso detrás de una persona autorizada', sev: 55, icon: '👣', family: 'anomalía' },
    { id: 'loitering', label: 'Permanencia prolongada en el acceso', sev: 45, icon: '🕒', family: 'anomalía' },
    { id: 'object', label: 'Objeto abandonado en el acceso', sev: 50, icon: '📦', family: 'anomalía' },
    { id: 'vandalism', label: 'Daño a la infraestructura', sev: 58, icon: '🧨', family: 'anomalía' },
    { id: 'other', label: 'Otro evento de seguridad', sev: 40, icon: '📌', family: 'anomalía' },
  ];
  const riskType = (id) => RISK_TYPES.find((t) => t.id === id) || RISK_TYPES[RISK_TYPES.length - 1];

  const LEVELS = [
    { n: 0, label: 'Normal', color: 'ok', action: 'Sin acción.' },
    { n: 1, label: 'Observación', color: 'ok', action: 'Queda registrado en la bitácora.' },
    { n: 2, label: 'Preventivo', color: 'warn', action: 'Se avisa al personal de turno.' },
    { n: 3, label: 'Alerta', color: 'warn', action: 'Requiere que una persona lo revise ahora.' },
    { n: 4, label: 'Crítico', color: 'err', action: 'Activar el protocolo del edificio.' },
    { n: 5, label: 'Emergencia', color: 'err', action: 'Escalamiento inmediato a un servicio externo.' },
  ];
  const levelInfo = (n) => LEVELS[clamp(num(n, 0), 0, 5)];

  /** Canales de escalamiento por defecto (Chile). El operador los edita. */
  const DEFAULT_CHANNELS = [
    { id: 'samu', name: 'SAMU — Ambulancia', phone: '131', kind: 'medical' },
    { id: 'bomberos', name: 'Bomberos de Chile', phone: '132', kind: 'fire' },
    { id: 'carabineros', name: 'Carabineros de Chile', phone: '133', kind: 'security' },
    { id: 'pdi', name: 'PDI — Policía de Investigaciones', phone: '134', kind: 'security' },
    { id: 'municipal', name: 'Seguridad municipal', phone: '', kind: 'security' },
    { id: 'cra', name: 'Central receptora de alarmas', phone: '', kind: 'security' },
    { id: 'admin', name: 'Administración del edificio', phone: '', kind: 'internal' },
  ];
  const CHANNEL_FOR = {
    medical: ['samu', 'admin'], fall: ['samu', 'admin'], fire: ['bomberos', 'admin'],
    weapon: ['carabineros', 'cra'], aggression: ['carabineros', 'cra', 'municipal'],
    threat: ['carabineros', 'cra'], shout: ['carabineros', 'cra'], impact: ['cra', 'municipal'],
    forced: ['carabineros', 'cra'], unauthorized: ['cra', 'municipal'], vandalism: ['municipal', 'cra'],
    panic: ['cra', 'carabineros', 'samu'],
  };

  // ── Estado del módulo (closure: una copia por ventana) ──────────────────
  let model = {
    view: 'panel', loaded: false, offline: false, busy: false,
    settings: Object.assign({}, DEFAULTS),
    units: [], accesses: [], parcels: [], incidents: [], channels: DEFAULT_CHANNELS.slice(),
    counters: { person: 0 },
    chainHead: { seq: 0, hash: 'genesis' },
    totem: { step: 'home', ctx: {}, message: '', busy: false },
    avatar: { speaking: false, mood: 'idle', text: '' },
    sensor: { cam: false, mic: false, agitation: 0, sound: 0, presence: 0, error: '', lastFire: 0 },
    kiosk: false,
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l(Object.assign({}, model)));
  const setModel = (patch) => { model = Object.assign({}, model, patch); emit(); };

  // ── Bitácora encadenada (integridad de los registros) ────────────────────
  /** Campos que sella el hash: si alguien edita uno, la cadena deja de cuadrar. */
  const sealPayload = (rec) => JSON.stringify({
    id: rec.id, kind: rec.kind, at: rec.at || rec.openedAt || rec.createdAt || '',
    type: rec.type || '', level: rec.level != null ? rec.level : null,
    subject: rec.subject || '', unit: rec.unit || '', summary: rec.summary || rec.description || '',
  });
  async function sha256(text) {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* contexto sin WebCrypto: se usa el respaldo */ }
    // Respaldo FNV-1a (no criptográfico): la cadena sigue detectando ediciones
    // accidentales, y la pestaña Cumplimiento avisa que el sello es débil.
    let x = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { x ^= text.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return 'fnv' + x.toString(16).padStart(8, '0');
  }
  const strongSeal = () => (typeof crypto !== 'undefined' && !!(crypto.subtle));

  /** Sella un registro contra la cabeza de la cadena conocida por esta consola. */
  async function seal(rec) {
    const head = model.chainHead || { seq: 0, hash: 'genesis' };
    const seq = num(head.seq, 0) + 1;
    const prevHash = s(head.hash) || 'genesis';
    const hash = await sha256(prevHash + '|' + seq + '|' + sealPayload(Object.assign({}, rec, { seq })));
    model.chainHead = { seq, hash };
    return Object.assign({}, rec, { seq, prevHash, hash });
  }

  /** Recalcula la cadena completa y reporta cortes, bifurcaciones y ediciones. */
  async function verifyChain() {
    const recs = ledger().slice().sort((a, b) => num(a.seq, 0) - num(b.seq, 0));
    const problems = [];
    let prev = 'genesis';
    let expected = 1;
    for (const r of recs) {
      const seq = num(r.seq, 0);
      if (!r.hash) { problems.push({ id: r.id, why: 'registro sin sello' }); continue; }
      if (seq !== expected) problems.push({ id: r.id, why: 'salto de secuencia (esperado ' + expected + ', llegó ' + seq + ')' });
      if (s(r.prevHash) !== prev) problems.push({ id: r.id, why: 'no encadena con el registro anterior' });
      const recomputed = await sha256(s(r.prevHash) + '|' + seq + '|' + sealPayload(r));
      if (recomputed !== s(r.hash)) problems.push({ id: r.id, why: 'el contenido cambió después de sellarse' });
      prev = s(r.hash);
      expected = seq + 1;
    }
    return { total: recs.length, problems, strong: strongSeal() };
  }

  // ── Persistencia (un item por registro: nadie se pisa) ───────────────────
  const isDef = (it) => it && it.kind === 'definition';
  const byTime = (a, b) => (s(b.at || b.openedAt || '') > s(a.at || a.openedAt || '') ? 1 : -1);
  // Todo lo sellado: incidentes, accesos y movimientos de encomiendas comparten
  // una sola cadena, así que la verificación tiene que mirarlos juntos.
  const ledger = () => model.incidents.concat(model.accesses, model.parcels);

  async function refresh(force) {
    if (!instanceId) { setModel({ loaded: true, offline: true }); return; }
    try {
      const items = (await shell.items.list()) || [];
      const def = items.find(isDef);
      const units = items.filter((i) => i.kind === 'unit').sort((a, b) => canon(a.code) > canon(b.code) ? 1 : -1);
      const accesses = items.filter((i) => i.kind === 'access').sort(byTime);
      const parcels = items.filter((i) => i.kind === 'parcel').sort(byTime);
      const incidents = items.filter((i) => i.kind === 'incident').sort(byTime);
      const patch = { units, accesses, parcels, incidents, loaded: true, offline: false };
      if (def) {
        patch.channels = Array.isArray(def.channels) && def.channels.length ? def.channels : model.channels;
        if (def.chainHead && num(def.chainHead.seq, 0) >= num(model.chainHead.seq, 0)) patch.chainHead = def.chainHead;
        if (def.counters) patch.counters = Object.assign({ person: 0 }, def.counters);
        if (def.settings && !hasHostConfig) patch.settings = Object.assign({}, DEFAULTS, def.settings);
      }
      // La cabeza de la cadena se reconstruye desde los registros: si otra
      // consola escribió mientras tanto, esta se pone al día antes de sellar.
      const top = incidents.concat(accesses, parcels)
        .reduce((mx, r) => (num(r.seq, 0) > num(mx.seq, 0) ? r : mx), { seq: 0, hash: 'genesis' });
      const known = num((patch.chainHead || model.chainHead).seq, 0);
      if (num(top.seq, 0) > known) patch.chainHead = { seq: num(top.seq, 0), hash: s(top.hash) || 'genesis' };
      const subs = items.filter((i) => i && i.kind === 'submission');
      if (subs.length) void processSubmissions(subs);
      const sig = JSON.stringify([units.length, accesses.length, parcels.length, incidents.length,
        accesses[0] && accesses[0].id, incidents[0] && incidents[0].id,
        incidents.map((i) => i.status + i.level).join(''), parcels.map((p) => p.status).join('')]);
      if (force || sig !== lastSig || !model.loaded || model.offline) { lastSig = sig; setModel(patch); }
      else { model = Object.assign({}, model, patch); }
    } catch (e) {
      setModel({ loaded: true, offline: true });
    }
  }
  let lastSig = '';

  /**
   * Detecciones publicadas por las cámaras de la comunidad. Llegan por el
   * gateway público (`public.submit`, canal "deteccion") como items
   * `submission`; aquí se traducen al mismo motor de riesgo que usan los
   * sensores del tótem y el envío original se descarta para no duplicar datos.
   */
  let ingesting = false;
  async function processSubmissions(subs) {
    if (ingesting) return;
    ingesting = true;
    try {
      for (const sub of subs.slice(0, 20)) {
        const d = Object.assign({}, sub.data || sub.values || {}, sub);
        const type = RISK_TYPES.some((t) => t.id === s(d.type)) ? s(d.type) : 'other';
        await raise({
          type, source: 'ingest',
          camera: s(d.camera) || 'Cámara de la comunidad',
          unit: s(d.unit),
          confidence: clamp(num(d.confidence, 0.6), 0.05, 1),
          note: s(d.note) || ('Detección publicada por ' + (s(d.camera) || 'una cámara de la comunidad') + '.'),
          detectedAt: s(d.at) || s(sub.createdAt),
          restricted: !!d.restricted,
        });
        try { await shell.items.remove(sub.id); } catch (e) { /* ya no está */ }
      }
    } finally { ingesting = false; }
  }

  /** Escribe la parte compartida que no es un registro (canales, cadena, contadores). */
  let defId = null;
  async function saveDefinition(patch) {
    if (!instanceId) return;
    try {
      const items = (await shell.items.list()) || [];
      const def = items.find(isDef);
      const body = Object.assign({
        kind: 'definition',
        channels: model.channels,
        chainHead: model.chainHead,
        counters: model.counters,
        settings: hasHostConfig ? undefined : model.settings,
        // Compuerta del gateway público (APP-SPEC §7.b): las cámaras y la VMS
        // de la comunidad publican detecciones por aquí, sin backend a medida.
        public: {
          enabled: !!model.settings.ingestEnabled,
          channels: ['deteccion'],
          data: {
            title: model.settings.siteName || 'KIMOS Safe Concierge',
            version: APP_VERSION,
            fields: [
              { key: 'type', label: 'Tipo de evento', options: RISK_TYPES.map((t) => t.id) },
              { key: 'confidence', label: 'Confianza 0-1' },
              { key: 'camera', label: 'Cámara o zona' },
              { key: 'note', label: 'Descripción' },
            ],
          },
        },
      }, patch || {});
      if (def) await shell.items.update(def.id, body);
      else { const created = await shell.items.create(body); defId = created && created.id; }
    } catch (e) { /* el registro no depende de esto */ }
  }
  let defSaveTimer = null;
  function scheduleDefinition(patch) {
    if (patch) model = Object.assign({}, model, patch);
    if (defSaveTimer) clearTimeout(defSaveTimer);
    defSaveTimer = setTimeout(() => { defSaveTimer = null; void saveDefinition(); }, 800);
  }

  /** Crea un registro sellado y lo mete en la bitácora. */
  async function addRecord(rec) {
    const sealed = await seal(Object.assign({ id: uid(rec.kind || 'rec') }, rec));
    if (!instanceId) {
      // Sin instancia (host v1 sin persistencia): al menos se ve en pantalla.
      const key = sealed.kind === 'incident' ? 'incidents' : sealed.kind === 'access' ? 'accesses' : 'parcels';
      setModel({ [key]: [sealed].concat(model[key]) });
      return sealed;
    }
    const created = await shell.items.create(sealed);
    const full = Object.assign({}, sealed, created || {});
    const key = full.kind === 'incident' ? 'incidents' : full.kind === 'access' ? 'accesses' : 'parcels';
    setModel({ [key]: [full].concat(model[key]) });
    scheduleDefinition();
    return full;
  }

  async function patchRecord(kindKey, id, patch) {
    const list = model[kindKey] || [];
    const cur = list.find((r) => r.id === id);
    if (!cur) return null;
    const next = Object.assign({}, cur, patch, { updatedAt: stamp() });
    setModel({ [kindKey]: list.map((r) => (r.id === id ? next : r)) });
    if (instanceId) { try { await shell.items.update(id, patch); } catch (e) { setModel({ offline: true }); } }
    return next;
  }

  async function removeRecord(kindKey, id) {
    setModel({ [kindKey]: (model[kindKey] || []).filter((r) => r.id !== id) });
    if (instanceId) { try { await shell.items.remove(id); } catch (e) { /* ya no está */ } }
  }

  // ── Retención: lo que vence, se borra solo ──────────────────────────────
  /**
   * Purga los registros más antiguos que la retención configurada, salvo los
   * marcados con retención legal (`hold`) o con un incidente abierto. Se
   * ejecuta al montar y una vez al día mientras la ventana esté abierta.
   */
  async function purgeExpired() {
    const days = clamp(num(model.settings.retentionDays, LEGAL_RETENTION_DAYS), 30, 3650);
    const limit = Date.now() - days * 86400000;
    const expired = (list) => list.filter((r) => {
      if (r.hold) return false;
      if (r.kind === 'incident' && r.status !== 'closed') return false;
      const t = Date.parse(s(r.at || r.openedAt || r.createdAt));
      return Number.isFinite(t) && t < limit;
    });
    const gone = expired(model.incidents).concat(expired(model.accesses)).concat(expired(model.parcels));
    if (!gone.length) return 0;
    for (const r of gone) {
      await removeRecord(r.kind === 'incident' ? 'incidents' : r.kind === 'access' ? 'accesses' : 'parcels', r.id);
    }
    return gone.length;
  }

  // ── Motor de riesgo ─────────────────────────────────────────────────────
  /**
   * Nivel = severidad del tipo × confianza de la detección × contexto.
   *
   * El contexto es lo que separa a esta app de una cámara con analítica: la
   * misma silueta a las 14:00 con visita registrada y a las 03:00 tras cuatro
   * intentos de acceso no valen lo mismo.
   */
  function assess(input) {
    const t = riskType(input.type);
    const confidence = clamp(num(input.confidence, 0.6), 0.05, 1);
    const factors = [];
    let ctx = 1;
    const hour = new Date(s(input.at) || stamp()).getHours();
    if (hour >= 0 && hour < 6) { ctx *= 1.25; factors.push('horario nocturno'); }
    else if (hour >= 22) { ctx *= 1.12; factors.push('horario de baja circulación'); }
    if (input.attempts && num(input.attempts, 0) >= 3) { ctx *= 1.2; factors.push(num(input.attempts, 0) + ' intentos de acceso'); }
    if (input.restricted) { ctx *= 1.15; factors.push('zona restringida'); }
    if (input.noVisitRegistered) { ctx *= 1.1; factors.push('sin visita registrada'); }
    if (input.repeated) { ctx *= 1.1; factors.push('se repite en la última hora'); }
    if (input.unattended) { ctx *= 1.08; factors.push('sin personal en el acceso'); }
    if (input.declared) { ctx *= 1.3; factors.push('lo declaró una persona en el tótem'); }
    ctx = clamp(ctx, 0.6, 1.6);
    const score = clamp(Math.round(t.sev * confidence * ctx), 0, 100);
    // Un pedido de auxilio declarado por una persona nunca baja de Crítico:
    // el motor puede dudar de un patrón, no de alguien pidiendo ayuda.
    let level = score >= 78 ? 5 : score >= 58 ? 4 : score >= 38 ? 3 : score >= 20 ? 2 : score >= 8 ? 1 : 0;
    if (input.declared && level < 4) level = 4;
    return { score, level, confidence, factors, typeLabel: t.label, icon: t.icon };
  }

  const suggestedChannels = (type) => (CHANNEL_FOR[type] || ['admin'])
    .map((id) => model.channels.find((c) => c.id === id)).filter(Boolean);

  /** Da de alta un incidente ya evaluado y dispara la respuesta del nivel. */
  async function raise(input) {
    const at = s(input.at) || stamp();
    const recent = model.incidents.filter((i) => i.type === input.type && ms(i.openedAt, at) != null && ms(i.openedAt, at) < 3600000);
    const verdict = assess(Object.assign({ at, repeated: recent.length > 0 }, input));
    // Anti-ruido: la misma detección automática dentro de 90 s suma evidencia
    // al incidente abierto en vez de crear uno nuevo.
    const open = recent.find((i) => i.status !== 'closed' && ms(i.openedAt, at) < 90000);
    if (open && input.source !== 'manual') {
      const hits = num(open.hits, 1) + 1;
      const next = await patchRecord('incidents', open.id, {
        hits,
        level: Math.max(num(open.level, 0), verdict.level),
        score: Math.max(num(open.score, 0), verdict.score),
        evidence: (open.evidence || []).concat([{ at, note: s(input.note) || 'nueva señal del sensor', confidence: verdict.confidence }]).slice(-20),
      });
      return next;
    }
    const rec = await addRecord({
      kind: 'incident',
      type: s(input.type) || 'other',
      typeLabel: verdict.typeLabel,
      level: verdict.level,
      score: verdict.score,
      confidence: verdict.confidence,
      factors: verdict.factors,
      source: s(input.source) || 'manual',
      detectedAt: s(input.detectedAt) || '',
      camera: s(input.camera),
      unit: s(input.unit),
      subject: s(input.subject) || (model.settings.privacyMode ? nextPersonLabel() : ''),
      summary: s(input.note) || verdict.typeLabel,
      openedAt: at,
      at,
      status: 'open',
      hits: 1,
      hold: verdict.level >= 4,
      evidence: input.evidence || [],
      actions: [{ at, what: 'Registrado por ' + (input.source === 'sensor' ? 'el sensor del tótem'
        : input.source === 'ingest' ? 'una cámara de la comunidad'
        : input.source === 'totem' ? 'el tótem (lo declaró una persona)' : 'la consola'), by: 'sistema' }],
      escalations: [],
    });
    respond(rec);
    return rec;
  }

  /** Respuesta automática por nivel. Nunca incluye llamar a un servicio. */
  function respond(rec) {
    const lv = num(rec.level, 0);
    if (lv >= 2) {
      shell.notify({ level: lv >= 4 ? 'error' : 'warn', text: levelInfo(lv).label + ' · ' + s(rec.typeLabel) + (rec.camera ? ' (' + rec.camera + ')' : '') });
    }
    if (lv >= 3 && model.settings.autoWarn) {
      // Aviso disuasivo: el tótem habla. No acusa a nadie ni afirma un delito.
      speak('Atención. Se ha detectado una situación que requiere revisión. '
        + 'El personal de seguridad está siendo informado y este acceso queda registrado.', 'alert');
    }
    // Saltar a Incidentes solo si quien mira es el personal: si la ventana está
    // en el tótem, la pantalla es del visitante y no se le cambia debajo.
    if (lv >= 4 && model.view !== 'totem') setModel({ view: 'incidents' });
  }

  function nextPersonLabel() {
    const n = num(model.counters.person, 0) + 1;
    model.counters = Object.assign({}, model.counters, { person: n });
    scheduleDefinition();
    return 'Persona ' + n;
  }

  const actorName = () => s(model.me && (model.me.name || model.me.id)) || 'operador';

  async function ackIncident(id) {
    const inc = model.incidents.find((i) => i.id === id);
    if (!inc) return { success: false, error: 'No existe ese incidente.' };
    if (inc.ackAt) return { success: true, message: 'Ya estaba tomado.' };
    await patchRecord('incidents', id, {
      ackAt: stamp(), ackBy: actorName(), status: inc.status === 'closed' ? 'closed' : 'ack',
      actions: (inc.actions || []).concat([{ at: stamp(), what: 'Tomado por una persona', by: actorName() }]),
    });
    return { success: true, message: 'Incidente tomado.' };
  }

  async function addAction(id, what) {
    const inc = model.incidents.find((i) => i.id === id);
    if (!inc) return { success: false, error: 'No existe ese incidente.' };
    if (!s(what).trim()) return { success: false, error: 'Escribe qué se hizo.' };
    await patchRecord('incidents', id, {
      actions: (inc.actions || []).concat([{ at: stamp(), what: s(what).trim(), by: actorName() }]),
      ackAt: inc.ackAt || stamp(), ackBy: inc.ackBy || actorName(),
      status: inc.status === 'closed' ? 'closed' : 'ack',
    });
    return { success: true, message: 'Acción registrada.' };
  }

  /**
   * Escalamiento a un canal externo. Requiere que una persona lo confirme:
   * la app no marca teléfonos por su cuenta, deja el enlace listo y sella
   * quién autorizó el contacto, a qué hora y con qué parte.
   */
  async function escalate(id, channelId, byName) {
    const inc = model.incidents.find((i) => i.id === id);
    if (!inc) return { success: false, error: 'No existe ese incidente.' };
    const ch = model.channels.find((c) => c.id === channelId);
    if (!ch) return { success: false, error: 'Canal desconocido: ' + channelId + '.' };
    const by = s(byName).trim() || actorName();
    const entry = { at: stamp(), channel: ch.id, channelName: ch.name, phone: ch.phone, by };
    await patchRecord('incidents', id, {
      escalations: (inc.escalations || []).concat([entry]),
      actions: (inc.actions || []).concat([{ at: entry.at, what: 'Escalado a ' + ch.name + (ch.phone ? ' (' + ch.phone + ')' : ''), by }]),
      status: 'escalated', hold: true,
      ackAt: inc.ackAt || entry.at, ackBy: inc.ackBy || by,
    });
    shell.notify({ level: 'warn', text: 'Escalado a ' + ch.name + '. Confirmado por ' + by + '.' });
    return { success: true, message: 'Escalado a ' + ch.name + '.', phone: ch.phone, brief: brief(inc) };
  }

  /** Parte estructurado: lo que pide quien contesta el 131, 132 o 133. */
  function brief(inc) {
    const st = model.settings;
    return [
      (st.siteName || 'Comunidad') + (st.siteAddress ? ' — ' + st.siteAddress.replace(/\n+/g, ', ') : ''),
      'Evento: ' + s(inc.typeLabel || riskType(inc.type).label),
      'Nivel: ' + levelInfo(inc.level).label + ' (' + num(inc.score, 0) + '/100, confianza ' + Math.round(num(inc.confidence, 0) * 100) + '%)',
      'Hora: ' + fmtDateTime(inc.openedAt),
      inc.camera ? 'Ubicación: ' + inc.camera : '',
      inc.unit ? 'Unidad: ' + inc.unit : '',
      inc.summary ? 'Detalle: ' + inc.summary : '',
      'Registro: ' + s(inc.id) + ' · sello ' + s(inc.hash).slice(0, 12),
    ].filter(Boolean).join('\n');
  }

  async function closeIncident(id, outcome) {
    const inc = model.incidents.find((i) => i.id === id);
    if (!inc) return { success: false, error: 'No existe ese incidente.' };
    await patchRecord('incidents', id, {
      status: 'closed', closedAt: stamp(), closedBy: actorName(), outcome: s(outcome) || '',
      actions: (inc.actions || []).concat([{ at: stamp(), what: 'Cierre' + (outcome ? ': ' + s(outcome) : ''), by: actorName() }]),
    });
    return { success: true, message: 'Incidente cerrado.' };
  }

  // ── Accesos, unidades y encomiendas ─────────────────────────────────────
  const findUnit = (q) => {
    const c = canon(q);
    if (!c) return null;
    return model.units.find((u) => canon(u.code) === c)
      || model.units.find((u) => canon(u.code).replace(/ /g, '') === c.replace(/ /g, ''))
      || model.units.find((u) => canon(u.code).includes(c) || canon(u.name).includes(c))
      || null;
  };

  async function upsertUnit(data) {
    const code = s(data.code).trim();
    if (!code) return { success: false, error: 'La unidad necesita un número o nombre.' };
    const exists = data.id ? model.units.find((u) => u.id === data.id) : findUnit(code);
    const body = {
      kind: 'unit', code,
      name: s(data.name).trim(), tower: s(data.tower).trim(),
      phone: s(data.phone).trim(), email: s(data.email).trim(),
      notes: s(data.notes).trim(),
      // Código de ingreso de la unidad: es lo que reemplaza a la biometría en
      // el tótem. Se guarda con el resto de la unidad, no con las personas.
      pin: s(data.pin).trim(),
      autoAllow: !!data.autoAllow,
      updatedAt: stamp(),
    };
    if (exists) {
      const next = Object.assign({}, exists, body);
      setModel({ units: model.units.map((u) => (u.id === exists.id ? next : u)) });
      if (instanceId) { try { await shell.items.update(exists.id, body); } catch (e) { setModel({ offline: true }); } }
      return { success: true, message: 'Unidad ' + code + ' actualizada.', unit: next };
    }
    const rec = Object.assign({ id: uid('unit'), createdAt: stamp() }, body);
    if (instanceId) { try { const c = await shell.items.create(rec); Object.assign(rec, c || {}); } catch (e) { setModel({ offline: true }); } }
    setModel({ units: model.units.concat([rec]).sort((a, b) => (canon(a.code) > canon(b.code) ? 1 : -1)) });
    return { success: true, message: 'Unidad ' + code + ' creada.', unit: rec };
  }

  /** Registra un movimiento de acceso (ingreso o salida) en la bitácora. */
  async function logAccess(data) {
    const rec = await addRecord({
      kind: 'access',
      direction: data.direction === 'out' ? 'out' : 'in',
      profile: s(data.profile) || 'visit',      // resident | visit | provider | delivery | staff
      subject: s(data.subject).trim() || (model.settings.privacyMode ? nextPersonLabel() : 'Sin identificar'),
      unit: s(data.unit).trim(),
      method: s(data.method) || 'totem',        // totem | code | qr | citofono | consola
      authorizedBy: s(data.authorizedBy).trim(),
      status: s(data.status) || 'granted',      // granted | denied | pending
      plate: s(data.plate).trim().toUpperCase(),
      company: s(data.company).trim(),
      note: s(data.note).trim(),
      at: s(data.at) || stamp(),
      summary: (data.direction === 'out' ? 'Salida' : 'Ingreso') + ' · ' + (s(data.subject) || 'sin identificar') + (data.unit ? ' → ' + data.unit : ''),
    });
    return rec;
  }

  async function decideAccess(id, ok, by) {
    const acc = model.accesses.find((a) => a.id === id);
    if (!acc) return { success: false, error: 'No existe ese acceso.' };
    const next = await patchRecord('accesses', id, {
      status: ok ? 'granted' : 'denied',
      authorizedBy: s(by).trim() || actorName(),
      decidedAt: stamp(),
    });
    if (!ok) {
      // Una visita rechazada no es un delito, pero sí un dato de contexto:
      // queda como observación para que se vea el patrón si se repite.
      await raise({
        type: 'unauthorized', confidence: 0.45, source: 'consola',
        note: 'Visita rechazada por el destino' + (acc.unit ? ' (' + acc.unit + ')' : ''),
        unit: acc.unit, subject: acc.subject, noVisitRegistered: true,
      });
    }
    return { success: true, message: ok ? 'Acceso autorizado.' : 'Acceso rechazado.', access: next };
  }

  async function receiveParcel(data) {
    const code = otp(6);
    const rec = await addRecord({
      kind: 'parcel',
      unit: s(data.unit).trim(),
      carrier: s(data.carrier).trim(),
      tracking: s(data.tracking).trim(),
      locker: s(data.locker).trim(),
      code,
      status: 'stored',
      at: stamp(), receivedAt: stamp(), receivedBy: s(data.receivedBy).trim() || actorName(),
      summary: 'Encomienda para ' + s(data.unit) + (data.carrier ? ' (' + data.carrier + ')' : ''),
    });
    return { success: true, message: 'Encomienda registrada. Código de retiro ' + code + '.', code, parcel: rec };
  }

  async function releaseParcel(id, code, who) {
    const p = model.parcels.find((x) => x.id === id);
    if (!p) return { success: false, error: 'No existe esa encomienda.' };
    if (p.status === 'delivered') return { success: false, error: 'Ya fue retirada el ' + fmtDateTime(p.deliveredAt) + '.' };
    if (s(code).trim() && s(code).trim() !== s(p.code)) return { success: false, error: 'El código de retiro no coincide.' };
    const next = await patchRecord('parcels', id, {
      status: 'delivered', deliveredAt: stamp(), deliveredTo: s(who).trim() || s(p.unit), releasedBy: actorName(),
    });
    return { success: true, message: 'Retiro registrado.', parcel: next };
  }

  // ── Voz y avatar ────────────────────────────────────────────────────────
  let speakTimer = null;
  /** Habla por el parlante del tótem con la síntesis del navegador (sin red). */
  function speak(text, mood) {
    const line = s(text).trim();
    setModel({ avatar: { speaking: !!line, mood: s(mood) || 'talk', text: line } });
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
    const stop = () => { speakTimer = null; setModel({ avatar: { speaking: false, mood: 'idle', text: line } }); };
    try {
      if (model.settings.voice && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new window.SpeechSynthesisUtterance(line);
        u.lang = 'es-CL';
        u.rate = mood === 'alert' ? 1.05 : 0.98;
        u.pitch = model.settings.avatarStyle === 'cartoon' ? 1.25 : 1;
        const voices = window.speechSynthesis.getVoices() || [];
        const es = voices.find((v) => /es[-_]CL/i.test(v.lang)) || voices.find((v) => /^es/i.test(v.lang));
        if (es) u.voice = es;
        u.onend = stop; u.onerror = stop;
        window.speechSynthesis.speak(u);
        // Respaldo: si el motor de voz no avisa el fin, el avatar no se queda
        // hablando para siempre.
        speakTimer = setTimeout(stop, clamp(line.length * 75, 2000, 15000));
        return;
      }
    } catch (e) { /* sin voz: solo se muestra el texto */ }
    speakTimer = setTimeout(stop, clamp(line.length * 55, 1600, 9000));
  }

  // ── Sensores locales (el video y el audio no salen del dispositivo) ─────
  /**
   * Cámara: diferencia de cuadros sobre un lienzo de 64×48. No hay
   * reconocimiento de personas ni biometría — se mide *cuánto* y *cómo* cambia
   * la escena. Agitación sostenida por encima del umbral durante varios
   * segundos = patrón compatible con forcejeo o agresión; movimiento bajo pero
   * continuo durante minutos = permanencia prolongada (merodeo).
   *
   * Lo que sale de aquí es una *hipótesis con confianza*, nunca una conclusión:
   * el motor de riesgo la pondera y una persona decide.
   */
  const sensors = { cam: null, mic: null, videoEl: null, canvas: null, ctx: null, prev: null, timer: null, audio: null, raf: null };
  const fired = {};
  function canFire(type, everyMs) {
    const now = Date.now();
    if (fired[type] && now - fired[type] < num(everyMs, 20000)) return false;
    fired[type] = now;
    return true;
  }

  async function startCamera() {
    if (sensors.cam) return { success: true, message: 'La cámara ya está analizando.' };
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setModel({ sensor: Object.assign({}, model.sensor, { error: 'Este navegador no entrega la cámara.' }) });
      return { success: false, error: 'Este navegador no entrega la cámara.' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream; video.muted = true; video.playsInline = true;
      await video.play().catch(() => {});
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 48;
      sensors.cam = stream; sensors.videoEl = video; sensors.canvas = canvas;
      sensors.ctx = canvas.getContext('2d', { willReadFrequently: true });
      sensors.prev = null;
      let motionSince = 0; let presenceSince = 0; let ema = 0;
      sensors.timer = setInterval(() => {
        try {
          const t = tuning();
          sensors.ctx.drawImage(video, 0, 0, 64, 48);
          const cur = sensors.ctx.getImageData(0, 0, 64, 48).data;
          if (sensors.prev) {
            let changed = 0; let energy = 0;
            for (let i = 0; i < cur.length; i += 4) {
              const d = Math.abs(cur[i] - sensors.prev[i]) + Math.abs(cur[i + 1] - sensors.prev[i + 1]) + Math.abs(cur[i + 2] - sensors.prev[i + 2]);
              if (d > 60) { changed++; energy += d; }
            }
            const px = cur.length / 4;
            const ratio = changed / px;
            const intensity = changed ? energy / changed / 765 : 0;
            // Agitación = cuánta escena cambia × qué tan brusco es el cambio.
            const agitation = clamp(ratio * (0.6 + intensity), 0, 1);
            ema = ema * 0.6 + agitation * 0.4;
            const now = Date.now();
            if (ema >= t.motion) { if (!motionSince) motionSince = now; } else motionSince = 0;
            if (ratio >= 0.02) { if (!presenceSince) presenceSince = now; } else presenceSince = 0;
            setModel({ sensor: Object.assign({}, model.sensor, { cam: true, agitation: ema, presence: presenceSince ? now - presenceSince : 0, error: '' }) });
            if (motionSince && now - motionSince >= t.sustain && canFire('aggression', 30000)) {
              const over = clamp((ema - t.motion) / Math.max(0.001, t.motion), 0, 2);
              void raise({
                type: 'aggression', source: 'sensor', camera: 'Tótem (cámara local)',
                confidence: clamp((0.42 + over * 0.22) * t.conf, 0.3, 0.9),
                note: 'Agitación sostenida durante ' + Math.round((now - motionSince) / 1000) + ' s frente al tótem. '
                  + 'Patrón compatible con forcejeo o agresión; requiere validación humana.',
                unattended: true,
              });
              motionSince = 0;
            }
            if (presenceSince && now - presenceSince >= 120000 && canFire('loitering', 180000)) {
              void raise({
                type: 'loitering', source: 'sensor', camera: 'Tótem (cámara local)', confidence: 0.55,
                note: 'Presencia continua de más de 2 minutos en el acceso sin gestionar ingreso.',
                noVisitRegistered: !model.accesses.some((a) => ms(a.at, stamp()) != null && ms(a.at, stamp()) < 180000),
              });
              presenceSince = 0;
            }
          }
          sensors.prev = cur;
        } catch (e) { /* un cuadro perdido no rompe el análisis */ }
      }, 200);
      setModel({ sensor: Object.assign({}, model.sensor, { cam: true, error: '' }) });
      return { success: true, message: 'Cámara analizando en el dispositivo.' };
    } catch (e) {
      const why = /NotAllowed/i.test(s(e && e.name)) ? 'Falta el permiso de cámara del navegador.' : s((e && e.message) || e);
      setModel({ sensor: Object.assign({}, model.sensor, { cam: false, error: why }) });
      return { success: false, error: why };
    }
  }

  function stopCamera() {
    if (sensors.timer) { clearInterval(sensors.timer); sensors.timer = null; }
    if (sensors.cam) { try { sensors.cam.getTracks().forEach((t) => t.stop()); } catch (e) { /* ya cerrada */ } }
    if (sensors.videoEl) { try { sensors.videoEl.srcObject = null; } catch (e) { /* noop */ } }
    sensors.cam = null; sensors.videoEl = null; sensors.prev = null;
    setModel({ sensor: Object.assign({}, model.sensor, { cam: false, agitation: 0, presence: 0 }) });
  }

  /**
   * Micrófono: energía y variación espectral. No transcribe, no reconoce voz y
   * no guarda audio — solo mira la envolvente para distinguir un grito
   * sostenido de un golpe seco.
   */
  async function startMic() {
    if (sensors.mic) return { success: true, message: 'El micrófono ya está analizando.' };
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { success: false, error: 'Este navegador no entrega el micrófono.' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ac = new Ctx();
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 1024; an.smoothingTimeConstant = 0.6;
      src.connect(an);
      const time = new Uint8Array(an.fftSize);
      const freq = new Uint8Array(an.frequencyBinCount);
      let prevFreq = new Uint8Array(an.frequencyBinCount);
      let loudSince = 0;
      sensors.mic = stream; sensors.audio = { ac, an, src };
      const tick = () => {
        if (!sensors.mic) return;
        const t = tuning();
        an.getByteTimeDomainData(time);
        an.getByteFrequencyData(freq);
        let sum = 0;
        for (let i = 0; i < time.length; i++) { const v = (time[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / time.length);
        let flux = 0;
        for (let i = 0; i < freq.length; i++) { const d = freq[i] - prevFreq[i]; if (d > 0) flux += d; }
        flux = flux / (freq.length * 255);
        prevFreq = freq.slice();
        const now = Date.now();
        setModel({ sensor: Object.assign({}, model.sensor, { mic: true, sound: rms }) });
        // Golpe/rotura: subida brusca de energía en un solo cuadro.
        if (flux > t.spike && rms > t.sound * 0.9 && canFire('impact', 15000)) {
          void raise({
            type: 'impact', source: 'sensor', camera: 'Tótem (micrófono local)',
            confidence: clamp((0.4 + flux) * t.conf, 0.3, 0.85),
            note: 'Sonido de impacto o rotura frente al acceso (energía acústica, sin grabación).',
          });
        }
        // Grito: energía alta sostenida más de un segundo y medio.
        if (rms >= t.sound) { if (!loudSince) loudSince = now; } else loudSince = 0;
        if (loudSince && now - loudSince > 1500 && canFire('shout', 25000)) {
          void raise({
            type: 'shout', source: 'sensor', camera: 'Tótem (micrófono local)',
            confidence: clamp((0.45 + rms) * t.conf, 0.3, 0.88),
            note: 'Voz alzada o grito sostenido junto al tótem. No se transcribe ni se guarda audio.',
            unattended: true,
          });
          loudSince = 0;
        }
        sensors.raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(tick) : setTimeout(tick, 100);
      };
      tick();
      return { success: true, message: 'Micrófono analizando en el dispositivo.' };
    } catch (e) {
      const why = /NotAllowed/i.test(s(e && e.name)) ? 'Falta el permiso de micrófono del navegador.' : s((e && e.message) || e);
      setModel({ sensor: Object.assign({}, model.sensor, { mic: false, error: why }) });
      return { success: false, error: why };
    }
  }

  function stopMic() {
    if (sensors.raf) { try { cancelAnimationFrame(sensors.raf); } catch (e) { clearTimeout(sensors.raf); } sensors.raf = null; }
    if (sensors.mic) { try { sensors.mic.getTracks().forEach((t) => t.stop()); } catch (e) { /* ya cerrada */ } }
    if (sensors.audio && sensors.audio.ac) { try { void sensors.audio.ac.close(); } catch (e) { /* noop */ } }
    sensors.mic = null; sensors.audio = null;
    setModel({ sensor: Object.assign({}, model.sensor, { mic: false, sound: 0 }) });
  }

  // ── Indicadores (lo que se mide en el piloto) ───────────────────────────
  function kpis() {
    const inc = model.incidents;
    const avg = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
    const mttd = avg(inc.map((i) => (i.detectedAt ? ms(i.detectedAt, i.openedAt) : 0)).filter((v) => v != null));
    const mtte = avg(inc.map((i) => ms(i.openedAt, i.ackAt)).filter((v) => v != null && v >= 0));
    const mttr = avg(inc.map((i) => {
      const first = (i.actions || []).find((a) => a.by && a.by !== 'sistema');
      return first ? ms(i.openedAt, first.at) : null;
    }).filter((v) => v != null && v >= 0));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const since = today.toISOString();
    return {
      open: inc.filter((i) => i.status !== 'closed').length,
      critical: inc.filter((i) => i.status !== 'closed' && num(i.level, 0) >= 4).length,
      todayAccess: model.accesses.filter((a) => s(a.at) >= since).length,
      pending: model.accesses.filter((a) => a.status === 'pending').length,
      parcels: model.parcels.filter((p) => p.status !== 'delivered').length,
      escalated: inc.filter((i) => (i.escalations || []).length).length,
      mttd, mtte, mttr,
      falsePositives: inc.filter((i) => i.outcome === 'falso-positivo').length,
      closed: inc.filter((i) => i.status === 'closed').length,
    };
  }

  // ── Carga, identidad y sincronización ───────────────────────────────────
  function apiBase() {
    try {
      const raw = shell.assetUrl ? shell.assetUrl('x').split('/api/apps/')[0] : '';
      return new URL(raw || '/', window.location.href).toString().replace(/\/$/, '');
    } catch (e) { return window.location.origin; }
  }
  const API = apiBase();
  const req = (url, init) => (shell.authFetch ? shell.authFetch(url, init) : fetch(url, init));

  let hasHostConfig = false;
  const teardown = [];
  let loadedOnce = false;

  async function load() {
    if (loadedOnce) return;
    loadedOnce = true;

    if (shell.config && typeof shell.config.get === 'function') {
      hasHostConfig = true;
      try {
        const cfg = await shell.config.get();
        if (cfg) model.settings = Object.assign({}, DEFAULTS, model.settings, cfg);
      } catch (e) { hasHostConfig = false; }
      if (typeof shell.config.onChange === 'function') {
        try {
          const off = shell.config.onChange((cfg) => {
            const next = Object.assign({}, DEFAULTS, model.settings, cfg || {});
            setModel({ settings: next });
            syncSensorsWithSettings();
          });
          if (typeof off === 'function') teardown.push(off);
        } catch (e) { /* opcional */ }
      }
    }

    await refresh(true);

    const start = s(model.settings.startView) || 'panel';
    if (VIEWS.some((v) => v.id === start)) setModel({ view: start, kiosk: start === 'totem' });

    try {
      const res = await req(API + '/api/identity/me', { cache: 'no-store' });
      if (res.ok) {
        const me = await res.json();
        setModel({ me: { id: s(me.id), name: s(me.displayName || me.name || me.email || me.id) } });
      }
    } catch (e) { /* opcional */ }

    if (instanceId) {
      try {
        const res = await req(API + '/api/app-instances/' + instanceId, { cache: 'no-store' });
        if (res.ok) {
          const name = s(((await res.json()) || {}).name);
          if (name) { setModel({ docName: name }); try { shell.window.setTitle(name + ' · Safe Concierge'); } catch (e) { /* noop */ } }
        }
      } catch (e) { /* opcional */ }
    }

    syncSensorsWithSettings();
    void purgeExpired();
    purgeTimer = setInterval(() => { void purgeExpired(); }, 6 * 3600000);
  }
  let purgeTimer = null;

  function syncSensorsWithSettings() {
    if (model.settings.cameraSensor && !sensors.cam) void startCamera();
    if (!model.settings.cameraSensor && sensors.cam) stopCamera();
    if (model.settings.audioSensor && !sensors.mic) void startMic();
    if (!model.settings.audioSensor && sensors.mic) stopMic();
  }

  // Sincronización periódica: rápido con la ventana enfocada, lento de fondo,
  // en pausa si la pestaña no se ve (patrón de la casa, APP-SPEC §5.1).
  let syncTimer = null;
  let syncSubs = 0;
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    const hidden = (typeof document !== 'undefined' && document.visibilityState === 'hidden');
    const focused = (typeof document !== 'undefined' && document.hasFocus && document.hasFocus());
    const wait = hidden ? 90000 : focused ? SYNC_MS : SYNC_MS * 2;
    syncTimer = setTimeout(async () => {
      if (syncSubs > 0 && !(typeof document !== 'undefined' && document.visibilityState === 'hidden')) await refresh();
      scheduleSync();
    }, wait);
  }
  const onWake = () => { if (syncSubs > 0) void refresh(); };

  // ── Flujos del tótem ────────────────────────────────────────────────────
  const HELLO = () => 'Hola, soy ' + (s(model.settings.avatarName) || 'Kim') + '. '
    + (model.settings.siteName ? 'Bienvenido a ' + model.settings.siteName + '. ' : '')
    + '¿En qué puedo ayudarte?';

  const totemGo = (step, ctx, say, mood) => {
    setModel({ totem: { step, ctx: Object.assign({}, ctx || {}), message: s(say), busy: false } });
    if (say) speak(say, mood);
  };

  const pinFails = {};

  /** Visita: avisa a la unidad y deja la decisión en manos de quien vive ahí. */
  async function totemAnnounce(unitCode, visitorName, note) {
    const unit = findUnit(unitCode);
    if (!unit) return totemGo('visit', { error: 'No encuentro esa unidad. Revisa el número.' }, 'No encuentro esa unidad. ¿Puedes revisar el número?');
    setModel({ totem: Object.assign({}, model.totem, { busy: true }) });
    const acc = await logAccess({
      direction: 'in', profile: 'visit', method: 'totem', status: 'pending',
      subject: s(visitorName).trim() || (model.settings.privacyMode ? '' : 'Visita sin identificar'),
      unit: unit.code, note: s(note),
    });
    shell.notify({ level: 'info', text: 'Visita en el acceso para ' + unit.code + (visitorName ? ' (' + visitorName + ')' : '') });
    totemGo('waiting', { accessId: acc.id, unit: unit.code },
      'Estoy avisando a ' + unit.code + '. Espera un momento, por favor.');
    return acc;
  }

  /** Residente: PIN de la unidad. Tres fallos seguidos dejan rastro. */
  async function totemPin(unitCode, pin) {
    const unit = findUnit(unitCode);
    const ok = unit && s(unit.pin) && s(unit.pin) === s(pin).trim();
    const key = canon(unitCode) || 'sin-unidad';
    if (ok) {
      pinFails[key] = 0;
      await logAccess({ direction: 'in', profile: 'resident', method: 'code', status: 'granted', unit: unit.code, subject: unit.name || unit.code });
      totemGo('done', { ok: true }, 'Ingreso registrado. Que tengas un buen día.');
      return { success: true };
    }
    pinFails[key] = num(pinFails[key], 0) + 1;
    if (pinFails[key] >= 3) {
      await raise({
        type: 'forced', source: 'totem', confidence: 0.6, attempts: pinFails[key],
        unit: unit ? unit.code : s(unitCode),
        note: 'Tres o más códigos incorrectos seguidos en el tótem.',
        noVisitRegistered: true,
      });
      pinFails[key] = 0;
    }
    totemGo('resident', { unit: s(unitCode), error: 'El código no coincide.' }, 'Ese código no coincide. Puedes intentar de nuevo o avisar a tu unidad.');
    return { success: false };
  }

  /** Pedido de auxilio: lo declara una persona, así que nunca baja de crítico. */
  async function totemHelp(kind, note) {
    const type = kind === 'fire' ? 'fire' : kind === 'medical' ? 'medical' : kind === 'security' ? 'panic' : 'panic';
    const inc = await raise({
      type, source: 'totem', declared: true, confidence: 0.95,
      note: s(note) || 'Pedido de auxilio desde el tótem (' + kind + ').',
    });
    const lines = {
      medical: 'Entendido. Estoy avisando al personal y preparando el aviso al SAMU. Si la persona no responde, no la muevas. Quédate con ella.',
      fire: 'Entendido. Estoy avisando al personal y preparando el aviso a Bomberos. No uses los ascensores y aléjate de la zona.',
      security: 'Entendido. Estoy avisando al personal de seguridad. Si puedes, ponte a resguardo. Este acceso queda registrado.',
    };
    totemGo('help-done', { incidentId: inc && inc.id, kind }, lines[kind] || lines.security, 'alert');
    return inc;
  }

  /** Citofonía: el tótem deja el contacto pedido y registrado. */
  async function totemCall(unitCode, whoName) {
    const unit = findUnit(unitCode);
    if (!unit) return totemGo('call', { error: 'No encuentro esa unidad.' }, 'No encuentro esa unidad.');
    const acc = await logAccess({
      direction: 'in', profile: 'visit', method: 'citofono', status: 'pending',
      subject: s(whoName).trim(), unit: unit.code, note: 'Llamada de citofonía desde el tótem',
    });
    shell.notify({ level: 'info', text: 'Citófono: llamada para ' + unit.code });
    totemGo('waiting', { accessId: acc.id, unit: unit.code, call: true },
      'Estoy llamando a ' + unit.code + '. Un momento.');
    return acc;
  }

  // ── Control por agente IA ───────────────────────────────────────────────
  const TOOLS = [
    { name: 'STATUS', description: 'Resumen del acceso: incidentes abiertos, accesos del día, encomiendas pendientes e indicadores.', inputSchema: { type: 'object', properties: {} } },
    { name: 'LIST_INCIDENTS', description: 'Lista los incidentes. Filtros opcionales por estado (open/ack/escalated/closed) y nivel mínimo.',
      inputSchema: { type: 'object', properties: { status: { type: 'string' }, minLevel: { type: 'number' }, limit: { type: 'number' } } } },
    { name: 'RAISE_INCIDENT', description: 'Registra un evento de seguridad. El motor de riesgo calcula el nivel; no llama a nadie.',
      inputSchema: { type: 'object', properties: { type: { type: 'string' }, note: { type: 'string' }, camera: { type: 'string' }, unit: { type: 'string' }, confidence: { type: 'number' } }, required: ['type'] } },
    { name: 'ACK_INCIDENT', description: 'Marca un incidente como tomado por una persona.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'ADD_ACTION', description: 'Anota en el incidente qué se hizo.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, what: { type: 'string' } }, required: ['id', 'what'] } },
    { name: 'ESCALATE_INCIDENT', description: 'Registra el contacto con un canal externo (samu, bomberos, carabineros, pdi, municipal, cra, admin). Requiere el nombre de la persona que lo autoriza: la app no llama sola.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, channel: { type: 'string' }, authorizedBy: { type: 'string' } }, required: ['id', 'channel', 'authorizedBy'] } },
    { name: 'CLOSE_INCIDENT', description: 'Cierra un incidente con su resultado (por ejemplo "falso-positivo").', inputSchema: { type: 'object', properties: { id: { type: 'string' }, outcome: { type: 'string' } }, required: ['id'] } },
    { name: 'LOG_ACCESS', description: 'Registra un ingreso o salida.',
      inputSchema: { type: 'object', properties: { direction: { type: 'string' }, profile: { type: 'string' }, subject: { type: 'string' }, unit: { type: 'string' }, plate: { type: 'string' }, company: { type: 'string' }, status: { type: 'string' } } } },
    { name: 'DECIDE_ACCESS', description: 'Autoriza o rechaza una visita que está esperando en el acceso.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, allow: { type: 'boolean' }, by: { type: 'string' } }, required: ['id', 'allow'] } },
    { name: 'RECEIVE_PARCEL', description: 'Recibe una encomienda y devuelve el código de retiro.',
      inputSchema: { type: 'object', properties: { unit: { type: 'string' }, carrier: { type: 'string' }, tracking: { type: 'string' }, locker: { type: 'string' } }, required: ['unit'] } },
    { name: 'RELEASE_PARCEL', description: 'Registra el retiro de una encomienda por id o por código.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, code: { type: 'string' }, who: { type: 'string' } } } },
    { name: 'UPSERT_UNIT', description: 'Crea o actualiza una unidad del directorio (departamento, oficina, casa).',
      inputSchema: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' }, tower: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, pin: { type: 'string' } }, required: ['code'] } },
    { name: 'SPEAK', description: 'Hace hablar al avatar del tótem (aviso, instrucción o bienvenida).', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'SET_SENSORS', description: 'Enciende o apaga el análisis local de cámara y micrófono del tótem.',
      inputSchema: { type: 'object', properties: { camera: { type: 'boolean' }, audio: { type: 'boolean' } } } },
    { name: 'VERIFY_LEDGER', description: 'Verifica la cadena de sellos de la bitácora y reporta cortes o ediciones.', inputSchema: { type: 'object', properties: {} } },
    { name: 'SET_VIEW', description: 'Cambia de pestaña: panel, totem, access, parcels, incidents, directory, emergency, compliance.',
      inputSchema: { type: 'object', properties: { view: { type: 'string' } }, required: ['view'] } },
  ];
  const ACTION_ALIASES = {
    RESUMEN: 'STATUS', ESTADO: 'STATUS', LISTAR_INCIDENTES: 'LIST_INCIDENTS', CREAR_INCIDENTE: 'RAISE_INCIDENT',
    TOMAR_INCIDENTE: 'ACK_INCIDENT', ESCALAR: 'ESCALATE_INCIDENT', CERRAR_INCIDENTE: 'CLOSE_INCIDENT',
    REGISTRAR_ACCESO: 'LOG_ACCESS', RECIBIR_ENCOMIENDA: 'RECEIVE_PARCEL', ENTREGAR_ENCOMIENDA: 'RELEASE_PARCEL',
    HABLAR: 'SPEAK', VERIFICAR_BITACORA: 'VERIFY_LEDGER',
  };

  /** Resuelve un incidente por id exacto, por sufijo o por "el último". */
  function resolveIncident(ref) {
    const r = s(ref).trim();
    if (!r) return null;
    if (/^(ultimo|último|el ultimo|el último|last)$/i.test(r)) return model.incidents[0] || null;
    return model.incidents.find((i) => i.id === r)
      || model.incidents.find((i) => s(i.id).endsWith(r))
      || model.incidents.find((i) => canon(i.typeLabel).includes(canon(r)))
      || null;
  }

  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'KIMOS Safe Concierge',
      description: 'Consejería virtual y consola de seguridad del acceso: incidentes con nivel de riesgo, '
        + 'accesos, encomiendas, directorio, avisos por el tótem y escalamiento a servicios de emergencia '
        + '(siempre con una persona que lo autoriza).',
      tools: TOOLS,
      getSnapshot: () => {
        const k = kpis();
        return {
          version: APP_VERSION,
          comunidad: model.settings.siteName || null,
          direccion: model.settings.siteAddress || null,
          indicadores: k,
          sensores: { camara: !!model.sensor.cam, microfono: !!model.sensor.mic, sensibilidad: model.settings.sensitivity },
          niveles: LEVELS.map((l) => l.n + ' ' + l.label),
          tiposDeEvento: RISK_TYPES.map((t) => t.id),
          canales: model.channels.map((c) => ({ id: c.id, nombre: c.name, telefono: c.phone || null })),
          incidentesAbiertos: model.incidents.filter((i) => i.status !== 'closed').slice(0, 25).map((i) => ({
            id: i.id, tipo: i.type, evento: i.typeLabel, nivel: i.level, puntaje: i.score,
            confianza: Math.round(num(i.confidence, 0) * 100) + '%',
            estado: i.status, abierto: i.openedAt, ubicacion: i.camera || null, unidad: i.unit || null,
            detalle: i.summary, escalamientos: (i.escalations || []).map((e) => e.channelName),
          })),
          accesosPendientes: model.accesses.filter((a) => a.status === 'pending').map((a) => ({
            id: a.id, unidad: a.unit, quien: a.subject || null, desde: a.at, via: a.method,
          })),
          encomiendasPendientes: model.parcels.filter((p) => p.status !== 'delivered').map((p) => ({
            id: p.id, unidad: p.unit, transportista: p.carrier || null, recibida: p.receivedAt,
          })),
          unidades: model.units.map((u) => ({ id: u.id, codigo: u.code, nombre: u.name || null, torre: u.tower || null })),
        };
      },
      dispatchAction: async (action) => {
        const type = ACTION_ALIASES[s(action && action.type).toUpperCase()] || s(action && action.type).toUpperCase();
        const p = (action && action.payload) || {};
        try {
          if (type === 'STATUS') {
            const k = kpis();
            return { success: true, message: 'Incidentes abiertos: ' + k.open + ' (' + k.critical + ' críticos). '
              + 'Accesos hoy: ' + k.todayAccess + ', ' + k.pending + ' esperando decisión. '
              + 'Encomiendas por retirar: ' + k.parcels + '. '
              + 'Tiempo medio hasta que alguien toma un incidente: ' + (k.mtte == null ? 'sin datos' : fmtDur(k.mtte)) + '.' };
          }
          if (type === 'LIST_INCIDENTS') {
            await refresh();
            const min = num(p.minLevel, 0);
            let list = model.incidents.filter((i) => num(i.level, 0) >= min);
            if (p.status) list = list.filter((i) => i.status === s(p.status));
            list = list.slice(0, clamp(num(p.limit, 15), 1, 60));
            if (!list.length) return { success: true, message: 'No hay incidentes con ese filtro.' };
            return { success: true, message: list.map((i) => '[' + levelInfo(i.level).label + '] ' + s(i.typeLabel)
              + ' · ' + fmtDateTime(i.openedAt) + ' · ' + i.status + ' · id ' + i.id).join('\n') };
          }
          if (type === 'RAISE_INCIDENT') {
            const known = RISK_TYPES.some((t) => t.id === s(p.type));
            if (!known) return { success: false, error: 'Tipo desconocido. Válidos: ' + RISK_TYPES.map((t) => t.id).join(', ') + '.' };
            const inc = await raise({
              type: s(p.type), note: s(p.note), camera: s(p.camera), unit: s(p.unit),
              confidence: clamp(num(p.confidence, 0.7), 0.05, 1), source: 'agente',
            });
            return { success: true, message: 'Incidente ' + inc.id + ' · ' + levelInfo(inc.level).label
              + ' (' + num(inc.score, 0) + '/100). ' + levelInfo(inc.level).action };
          }
          if (type === 'ACK_INCIDENT') { const i = resolveIncident(p.id); return i ? await ackIncident(i.id) : { success: false, error: 'No encuentro ese incidente.' }; }
          if (type === 'ADD_ACTION') { const i = resolveIncident(p.id); return i ? await addAction(i.id, p.what) : { success: false, error: 'No encuentro ese incidente.' }; }
          if (type === 'ESCALATE_INCIDENT') {
            const i = resolveIncident(p.id);
            if (!i) return { success: false, error: 'No encuentro ese incidente.' };
            const by = s(p.authorizedBy || p.by).trim();
            if (!by) return { success: false, error: 'Falta quién autoriza el contacto. Contactar a un servicio de emergencia lo decide una persona, no el sistema.' };
            const r = await escalate(i.id, s(p.channel).toLowerCase(), by);
            if (!r.success) return r;
            return { success: true, message: r.message + (r.phone ? ' Marcar ' + r.phone + '.' : ' (sin teléfono configurado)') + '\nParte:\n' + r.brief };
          }
          if (type === 'CLOSE_INCIDENT') { const i = resolveIncident(p.id); return i ? await closeIncident(i.id, p.outcome) : { success: false, error: 'No encuentro ese incidente.' }; }
          if (type === 'LOG_ACCESS') {
            const acc = await logAccess({
              direction: s(p.direction) === 'out' ? 'out' : 'in', profile: s(p.profile) || 'visit',
              subject: s(p.subject), unit: s(p.unit), plate: s(p.plate), company: s(p.company),
              method: 'consola', status: s(p.status) || 'granted', authorizedBy: actorName(),
            });
            return { success: true, message: 'Acceso registrado (' + acc.id + ').' };
          }
          if (type === 'DECIDE_ACCESS') {
            const acc = model.accesses.find((a) => a.id === s(p.id)) || model.accesses.find((a) => a.status === 'pending');
            if (!acc) return { success: false, error: 'No hay ningún acceso esperando decisión.' };
            return await decideAccess(acc.id, !!p.allow, s(p.by));
          }
          if (type === 'RECEIVE_PARCEL') {
            if (!s(p.unit).trim()) return { success: false, error: 'Falta la unidad de destino.' };
            const r = await receiveParcel(p);
            return { success: true, message: r.message };
          }
          if (type === 'RELEASE_PARCEL') {
            const target = model.parcels.find((x) => x.id === s(p.id))
              || model.parcels.find((x) => s(x.code) === s(p.code).trim() && x.status !== 'delivered');
            if (!target) return { success: false, error: 'No encuentro esa encomienda pendiente.' };
            return await releaseParcel(target.id, p.code, p.who);
          }
          if (type === 'UPSERT_UNIT') return await upsertUnit(p);
          if (type === 'SPEAK') {
            if (!s(p.text).trim()) return { success: false, error: 'Falta el texto.' };
            speak(s(p.text).trim(), 'talk');
            return { success: true, message: 'El tótem dijo: "' + s(p.text).trim() + '".' };
          }
          if (type === 'SET_SENSORS') {
            const out = [];
            if (p.camera === true) out.push((await startCamera()).message || 'cámara encendida');
            if (p.camera === false) { stopCamera(); out.push('cámara apagada'); }
            if (p.audio === true) out.push((await startMic()).message || 'micrófono encendido');
            if (p.audio === false) { stopMic(); out.push('micrófono apagado'); }
            if (!out.length) return { success: false, error: 'Indica camera y/o audio (true o false).' };
            return { success: true, message: out.join(' · ') };
          }
          if (type === 'VERIFY_LEDGER') {
            const r = await verifyChain();
            return { success: true, message: r.problems.length
              ? ('La bitácora tiene ' + r.problems.length + ' inconsistencia(s) sobre ' + r.total + ' registros: '
                 + r.problems.slice(0, 5).map((x) => x.id + ' (' + x.why + ')').join('; '))
              : ('Bitácora íntegra: ' + r.total + ' registros encadenados' + (r.strong ? ' con SHA-256.' : ' (sello de respaldo, sin WebCrypto).')) };
          }
          if (type === 'SET_VIEW') {
            const v = VIEWS.find((x) => x.id === s(p.view));
            if (!v) return { success: false, error: 'Vistas: ' + VIEWS.map((x) => x.id).join(', ') + '.' };
            setModel({ view: v.id, kiosk: v.id === 'totem' ? model.kiosk : false });
            return { success: true, message: 'Mostrando ' + v.label + '.' };
          }
          return { success: false, error: 'Acción desconocida: ' + s(action && action.type) + '. Válidas: ' + TOOLS.map((t) => t.name).join(', ') + '.' };
        } catch (e) {
          return { success: false, error: s((e && e.message) || e) };
        }
      },
    });
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  const VIEWS = [
    { id: 'panel', label: 'Panel', icon: '📊' },
    { id: 'totem', label: 'Tótem', icon: '🪧' },
    { id: 'incidents', label: 'Incidentes', icon: '🚨' },
    { id: 'access', label: 'Accesos', icon: '🚪' },
    { id: 'parcels', label: 'Encomiendas', icon: '📦' },
    { id: 'directory', label: 'Directorio', icon: '🏠' },
    { id: 'emergency', label: 'Emergencias', icon: '📞' },
    { id: 'compliance', label: 'Cumplimiento', icon: '⚖️' },
  ];

  function download(filename, text, mime) {
    try {
      const safe = s(filename).replace(/[^\w.\- ]+/g, '_').trim().slice(0, 120) || 'registro';
      const blob = new Blob([s(text)], { type: (mime || 'text/plain') + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = safe; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      return true;
    } catch (e) { shell.notify({ level: 'error', text: 'El navegador bloqueó la descarga.' }); return false; }
  }

  const btn = (props, ...kids) => h('button', Object.assign({ type: 'button', className: 'sc-btn' }, props), ...kids);
  const field = (label, input, hint) => h('label', { className: 'sc-field' },
    h('span', { className: 'sc-field-l' }, label), input,
    hint ? h('span', { className: 'sc-field-h' }, hint) : null);
  const chip = (text, tone) => h('span', { className: 'sc-chip' + (tone ? ' sc-chip-' + tone : '') }, text);

  /** Avatar del tótem. Tres estilos, mismo esqueleto SVG. */
  function Avatar(props) {
    const style = s(props.style) || 'human';
    const speaking = !!props.speaking;
    const alert = props.mood === 'alert';
    const [blink, setBlink] = useState(false);
    const [phase, setPhase] = useState(0);
    useEffect(() => {
      let alive = true;
      let t = null;
      const loop = () => {
        if (!alive) return;
        t = setTimeout(() => {
          setBlink(true);
          setTimeout(() => { if (alive) setBlink(false); }, 120);
          loop();
        }, 2600 + Math.random() * 3800);
      };
      loop();
      return () => { alive = false; if (t) clearTimeout(t); };
    }, []);
    useEffect(() => {
      if (!speaking) { setPhase(0); return undefined; }
      const t = setInterval(() => setPhase((p) => (p + 1) % 4), 110);
      return () => clearInterval(t);
    }, [speaking]);

    const mouthH = speaking ? [3, 10, 6, 13][phase] : (alert ? 4 : 5);
    const skin = style === 'cartoon' ? '#FFD9B3' : '#EEC9A8';
    const eyeR = style === 'cartoon' ? 7 : 4.6;
    const ring = alert ? 'var(--sc-err)' : 'var(--sc-accent)';

    if (style === 'minimal') {
      // Sin rostro: un orbe con anillos que laten al hablar. Para instituciones
      // que prefieren no antropomorfizar la atención.
      return h('svg', { className: 'sc-avatar', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
        h('defs', null, h('radialGradient', { id: 'scOrb', cx: '40%', cy: '35%' },
          h('stop', { offset: '0%', stopColor: ring, stopOpacity: '0.95' }),
          h('stop', { offset: '100%', stopColor: ring, stopOpacity: '0.25' }))),
        h('circle', { cx: 100, cy: 100, r: 54, fill: 'url(#scOrb)' }),
        [0, 1, 2].map((i) => h('circle', {
          key: i, cx: 100, cy: 100, r: 62 + i * 13 + (speaking ? [0, 4, 2, 6][phase] : 0),
          fill: 'none', stroke: ring, strokeOpacity: 0.28 - i * 0.07, strokeWidth: 2,
        })),
      );
    }
    return h('svg', { className: 'sc-avatar', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
      h('ellipse', { cx: 100, cy: 178, rx: 62, ry: 34, fill: ring, opacity: 0.22 }),
      h('path', { d: 'M46 200c0-30 24-46 54-46s54 16 54 46z', fill: ring, opacity: 0.55 }),
      h('ellipse', { cx: 100, cy: 96, rx: style === 'cartoon' ? 56 : 48, ry: style === 'cartoon' ? 54 : 58, fill: skin }),
      style === 'cartoon'
        ? h('path', { d: 'M44 78c6-30 34-44 56-44s50 14 56 44c-16-12-34-16-56-16s-40 4-56 16z', fill: '#3B2E2A' })
        : h('path', { d: 'M52 74c8-26 30-38 48-38s40 12 48 38c-14-14-30-20-48-20s-34 6-48 20z', fill: '#4A3A33' }),
      // Ojos: se cierran al parpadear.
      blink
        ? [h('rect', { key: 'l', x: 68, y: 94, width: 20, height: 3, rx: 1.5, fill: '#2A2320' }),
           h('rect', { key: 'r', x: 112, y: 94, width: 20, height: 3, rx: 1.5, fill: '#2A2320' })]
        : [h('circle', { key: 'l', cx: 78, cy: 95, r: eyeR, fill: '#2A2320' }),
           h('circle', { key: 'r', cx: 122, cy: 95, r: eyeR, fill: '#2A2320' }),
           style === 'cartoon' ? h('circle', { key: 'lh', cx: 80.5, cy: 92.5, r: 2.4, fill: '#fff' }) : null,
           style === 'cartoon' ? h('circle', { key: 'rh', cx: 124.5, cy: 92.5, r: 2.4, fill: '#fff' }) : null],
      // Cejas: la única señal de "estado de ánimo" del avatar.
      h('path', { d: alert ? 'M66 80l24 8' : 'M66 84h24', stroke: '#3B2E2A', strokeWidth: 3.4, strokeLinecap: 'round', fill: 'none' }),
      h('path', { d: alert ? 'M134 80l-24 8' : 'M110 84h24', stroke: '#3B2E2A', strokeWidth: 3.4, strokeLinecap: 'round', fill: 'none' }),
      style === 'cartoon' ? h('circle', { cx: 64, cy: 112, r: 8, fill: '#F7A9A0', opacity: 0.6 }) : null,
      style === 'cartoon' ? h('circle', { cx: 136, cy: 112, r: 8, fill: '#F7A9A0', opacity: 0.6 }) : null,
      // Boca: se abre al hablar (sincronía simple, sin fonemas).
      h('rect', { x: 100 - (speaking ? 15 : 13), y: 124, width: (speaking ? 30 : 26), height: mouthH, rx: mouthH / 2, fill: '#8C4B4B' }),
      h('circle', { cx: 100, cy: 96, r: style === 'cartoon' ? 58 : 52, fill: 'none', stroke: ring, strokeOpacity: speaking ? 0.5 : 0.22, strokeWidth: 2 }),
    );
  }

  /** Medidor lineal 0-1 con etiqueta (sensores, puntaje de riesgo). */
  const meter = (label, value, tone) => h('div', { className: 'sc-meter' },
    h('span', { className: 'sc-meter-l' }, label),
    h('span', { className: 'sc-meter-track' },
      h('span', { className: 'sc-meter-fill' + (tone ? ' sc-meter-' + tone : ''), style: { width: clamp(num(value, 0) * 100, 0, 100) + '%' } })),
    h('span', { className: 'sc-meter-v' }, Math.round(clamp(num(value, 0), 0, 1) * 100) + '%'));

  const levelPill = (lv) => h('span', { className: 'sc-lv sc-lv-' + levelInfo(lv).color },
    'N' + clamp(num(lv, 0), 0, 5) + ' · ' + levelInfo(lv).label);

  // ── Vista: centro de operaciones ────────────────────────────────────────
  function Panel(props) {
    const m = props.m;
    const k = kpis();
    const open = m.incidents.filter((i) => i.status !== 'closed').slice(0, 6);
    const pending = m.accesses.filter((a) => a.status === 'pending');
    const tiles = [
      { k: 'Incidentes abiertos', v: k.open, sub: k.critical + ' críticos', tone: k.critical ? 'err' : k.open ? 'warn' : 'ok' },
      { k: 'Accesos hoy', v: k.todayAccess, sub: k.pending + ' esperando decisión', tone: k.pending ? 'warn' : 'ok' },
      { k: 'Encomiendas', v: k.parcels, sub: 'por retirar', tone: 'ok' },
      { k: 'Escalamientos', v: k.escalated, sub: 'con servicio externo', tone: k.escalated ? 'warn' : 'ok' },
    ];
    return h('div', { className: 'sc-view sc-panel' },
      h('div', { className: 'sc-tiles' }, tiles.map((t) => h('div', { key: t.k, className: 'sc-tile sc-tile-' + t.tone },
        h('div', { className: 'sc-tile-v' }, String(t.v)),
        h('div', { className: 'sc-tile-k' }, t.k),
        h('div', { className: 'sc-tile-s' }, t.sub)))),

      h('div', { className: 'sc-cols' },
        h('section', { className: 'sc-card' },
          h('h3', null, 'Estado del acceso'),
          h('div', { className: 'sc-state sc-state-' + (k.critical ? 'err' : k.open ? 'warn' : 'ok') },
            h('span', { className: 'sc-state-dot' }),
            k.critical ? 'Atención: hay ' + k.critical + ' incidente(s) crítico(s) sin cerrar'
              : k.open ? 'Con novedades: ' + k.open + ' incidente(s) en revisión'
              : 'Normal · sin incidentes abiertos'),
          h('div', { className: 'sc-sensors' },
            meter('Agitación (cámara del tótem)', m.sensor.agitation, m.sensor.agitation > (tuning().motion) ? 'err' : 'ok'),
            meter('Energía acústica (micrófono)', m.sensor.sound, m.sensor.sound > tuning().sound ? 'err' : 'ok'),
            h('div', { className: 'sc-row' },
              btn({ className: 'sc-btn' + (m.sensor.cam ? ' sc-btn-on' : ''), onClick: () => (m.sensor.cam ? stopCamera() : startCamera()) },
                (m.sensor.cam ? '⏹ Detener' : '▶ Analizar') + ' cámara'),
              btn({ className: 'sc-btn' + (m.sensor.mic ? ' sc-btn-on' : ''), onClick: () => (m.sensor.mic ? stopMic() : startMic()) },
                (m.sensor.mic ? '⏹ Detener' : '▶ Analizar') + ' micrófono'),
            ),
            m.sensor.error ? h('p', { className: 'sc-warn' }, m.sensor.error) : null,
            h('p', { className: 'sc-note' }, 'El análisis ocurre en este dispositivo: no se suben imágenes ni audio, '
              + 'no hay biometría y no se transcriben conversaciones. Sensibilidad: ' + s(m.settings.sensitivity) + '.'),
          ),
        ),

        h('section', { className: 'sc-card' },
          h('h3', null, 'Tiempos de respuesta'),
          h('table', { className: 'sc-kpi' }, h('tbody', null,
            h('tr', null, h('td', null, 'Detección → registro (MTTD)'), h('td', null, k.mttd == null ? '—' : fmtDur(k.mttd))),
            h('tr', null, h('td', null, 'Registro → alguien lo toma (MTTE)'), h('td', null, k.mtte == null ? '—' : fmtDur(k.mtte))),
            h('tr', null, h('td', null, 'Registro → primera acción (MTTR)'), h('td', null, k.mttr == null ? '—' : fmtDur(k.mttr))),
            h('tr', null, h('td', null, 'Incidentes cerrados'), h('td', null, String(k.closed))),
            h('tr', null, h('td', null, 'Cerrados como falso positivo'), h('td', null, String(k.falsePositives))),
          )),
          h('p', { className: 'sc-note' }, 'Estos tres tiempos son los que hay que mostrar en un piloto: '
            + 'no basta con que la detección funcione, tiene que acortar la respuesta.'),
        ),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Incidentes en curso'),
        open.length ? h('ul', { className: 'sc-list' }, open.map((i) => h('li', { key: i.id, className: 'sc-list-i', onClick: () => setModel({ view: 'incidents', focus: i.id }) },
          h('span', { className: 'sc-i-icon' }, riskType(i.type).icon),
          h('span', { className: 'sc-i-main' },
            h('strong', null, s(i.typeLabel)),
            h('span', { className: 'sc-i-sub' }, [fmtDateTime(i.openedAt), i.camera, i.unit, 'confianza ' + Math.round(num(i.confidence, 0) * 100) + '%'].filter(Boolean).join(' · '))),
          levelPill(i.level))))
          : h('p', { className: 'sc-empty' }, 'Sin incidentes abiertos.'),
      ),

      pending.length ? h('section', { className: 'sc-card' },
        h('h3', null, 'Esperando en el acceso'),
        h('ul', { className: 'sc-list' }, pending.map((a) => h('li', { key: a.id, className: 'sc-list-i' },
          h('span', { className: 'sc-i-icon' }, a.method === 'citofono' ? '📞' : '🚶'),
          h('span', { className: 'sc-i-main' },
            h('strong', null, (s(a.subject) || 'Sin identificar') + ' → ' + s(a.unit)),
            h('span', { className: 'sc-i-sub' }, 'desde hace ' + ago(a.at))),
          btn({ className: 'sc-btn sc-btn-ok', onClick: () => decideAccess(a.id, true) }, 'Autorizar'),
          btn({ className: 'sc-btn sc-btn-no', onClick: () => decideAccess(a.id, false) }, 'Rechazar')))),
      ) : null,
    );
  }

  /**
   * Espejo del acceso: lo que ve la cámara del tótem, en vivo, junto al
   * conserje virtual. Es la misma señal que analiza el sensor — no se graba ni
   * se sube — y sirve para dos cosas: que la persona se vea (un acceso que te
   * devuelve la mirada disuade más que un cartel) y que sepa exactamente qué
   * está mirando el sistema.
   */
  function Mirror(props) {
    const ref = useRef(null);
    const on = !!props.on;
    useEffect(() => {
      const el = ref.current;
      if (!el) return undefined;
      try {
        if (on && sensors.cam) {
          el.srcObject = sensors.cam;
          const p = el.play();
          if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay bloqueado: queda el póster */ });
        } else { el.srcObject = null; }
      } catch (e) { /* el navegador no entrega la señal */ }
      return () => { try { if (el) el.srcObject = null; } catch (e) { /* noop */ } };
    }, [on]);

    return h('div', { className: 'sc-mirror' + (on ? ' sc-mirror-on' : '') },
      h('video', { ref, className: 'sc-mirror-video', muted: true, playsInline: true, autoPlay: true }),
      on ? null : h('div', { className: 'sc-mirror-off' },
        h('span', { className: 'sc-mirror-icon' }, '🎥'),
        h('span', null, 'Cámara apagada'),
        btn({ className: 'sc-btn', onClick: () => startCamera() }, 'Activar cámara')),
      h('div', { className: 'sc-mirror-bar' },
        h('span', { className: 'sc-mirror-tag' }, on ? 'Usted · vista en vivo' : 'Sin señal'),
        on ? h('span', { className: 'sc-mirror-live' }, '● en vivo · no se graba') : null),
    );
  }

  /** Teclado en pantalla: el tótem no supone que haya un teclado físico. */
  function Keyboard(props) {
    const mode = props.mode === '123' ? '123' : 'abc';
    const shift = !!props.shift;
    const cap = (c) => (shift ? c.toUpperCase() : c);
    const key = (label, onClick, cls) => h('button', {
      key: 'k-' + label, type: 'button', className: 'sc-key' + (cls ? ' ' + cls : ''),
      // El foco se queda en el campo: así el cursor no se pierde al teclear.
      onMouseDown: (e) => { if (e && e.preventDefault) e.preventDefault(); },
      onClick,
    }, label);
    const rows = mode === '123'
      ? [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']]
      : [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
         ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
         ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'á', 'é', 'í'],
         ['ó', 'ú', 'ü', '@', '.', '-', '_', "'"]];
    return h('div', { className: 'sc-kb' + (mode === '123' ? ' sc-kb-num' : '') },
      h('div', { className: 'sc-kb-hd' },
        h('span', { className: 'sc-kb-target' }, s(props.label) || 'Escribiendo'),
        h('span', { className: 'sc-kb-val' }, s(props.value) ? (props.secret ? '•'.repeat(s(props.value).length) : s(props.value)) : '…'),
        btn({ className: 'sc-btn sc-btn-ghost', onClick: props.onClose }, '✕ Cerrar')),
      h('div', { className: 'sc-kb-rows' }, rows.map((row, ri) => h('div', { className: 'sc-kb-row', key: 'r' + ri },
        row.map((c) => key(mode === '123' ? c : cap(c), () => props.onType(mode === '123' ? c : cap(c))))))),
      h('div', { className: 'sc-kb-row sc-kb-bar' },
        mode === 'abc' ? key(shift ? '⇧' : '⇧', props.onShift, shift ? 'sc-key-on sc-key-wide' : 'sc-key-wide') : null,
        key(mode === '123' ? 'ABC' : '123', props.onMode, 'sc-key-wide'),
        mode === 'abc' ? key('espacio', () => props.onType(' '), 'sc-key-space') : null,
        key('⌫', props.onBack, 'sc-key-wide'),
        key('✓ Listo', props.onClose, 'sc-key-ok'),
      ),
    );
  }

  // ── Vista: tótem (lo que ve quien llega) ────────────────────────────────
  function Totem(props) {
    const m = props.m;
    const t = m.totem;
    const [unitQ, setUnitQ] = useState('');
    const [who, setWho] = useState('');
    const [pin, setPin] = useState('');
    const [carrier, setCarrier] = useState('');
    const [pickCode, setPickCode] = useState('');
    const [kb, setKb] = useState({ open: false, target: '', mode: 'abc', shift: true });
    const matches = useMemo(() => {
      const c = canon(unitQ);
      if (!c) return m.units.slice(0, 6);
      return m.units.filter((u) => canon(u.code).includes(c) || canon(u.name).includes(c) || canon(u.tower).includes(c)).slice(0, 8);
    }, [unitQ, m.units]);

    // Campos que puede escribir el teclado en pantalla.
    const FIELDS = {
      who: { value: who, set: setWho, mode: 'abc', label: 'Tu nombre' },
      unitQ: { value: unitQ, set: setUnitQ, mode: '123', label: 'Unidad' },
      pin: { value: pin, set: setPin, mode: '123', label: 'Código de ingreso', secret: true },
      carrier: { value: carrier, set: setCarrier, mode: 'abc', label: 'Empresa de reparto' },
      pickCode: { value: pickCode, set: setPickCode, mode: '123', label: 'Código de retiro' },
    };
    const openKb = (name) => {
      const f = FIELDS[name];
      if (!f) return;
      setKb({ open: true, target: name, mode: f.mode, shift: f.mode === 'abc' });
    };
    const closeKb = () => setKb((k) => Object.assign({}, k, { open: false }));
    const kbType = (ch) => {
      const f = FIELDS[kb.target];
      if (!f) return;
      f.set(s(f.value) + ch);
      if (kb.mode === 'abc' && kb.shift) setKb((k) => Object.assign({}, k, { shift: false }));
    };
    const kbBack = () => { const f = FIELDS[kb.target]; if (f) f.set(s(f.value).slice(0, -1)); };

    /**
     * Campo del tótem. En modo tótem (pantalla del acceso) tocarlo despliega el
     * teclado en pantalla; en la consola no, porque ahí sí hay teclado físico.
     */
    const tinput = (name, extra) => h('div', { className: 'sc-tot-input' },
      h('input', Object.assign({
        className: 'sc-input sc-input-big' + (kb.open && kb.target === name ? ' sc-input-kb' : ''),
        value: s(FIELDS[name].value),
        onChange: (e) => FIELDS[name].set(e.target.value),
        onFocus: () => { if (m.kiosk) openKb(name); },
      }, extra || {})),
      btn({ className: 'sc-btn sc-btn-kb', title: 'Teclado en pantalla', onClick: () => (kb.open && kb.target === name ? closeKb() : openKb(name)) }, '⌨'),
    );

    const say = t.message || (t.step === 'home' ? HELLO() : '');
    const back = () => { closeKb(); totemGo('home', {}, ''); };

    const home = h('div', { className: 'sc-tot-menu' },
      btn({ className: 'sc-tot-b', onClick: () => totemGo('visit', {}, '¿A qué unidad vienes? Puedes escribir el número.') }, h('span', null, '🚶'), 'Vengo de visita'),
      btn({ className: 'sc-tot-b', onClick: () => totemGo('resident', {}, 'Escribe tu unidad y tu código de ingreso.') }, h('span', null, '🔑'), 'Soy residente'),
      btn({ className: 'sc-tot-b', onClick: () => totemGo('call', {}, '¿A qué unidad quieres llamar?') }, h('span', null, '📞'), 'Llamar a una unidad'),
      btn({ className: 'sc-tot-b', onClick: () => totemGo('parcel', {}, 'Indica la unidad de destino de la encomienda.') }, h('span', null, '📦'), 'Dejar una encomienda'),
      btn({ className: 'sc-tot-b', onClick: () => totemGo('pickup', {}, 'Escribe el código de retiro que recibiste.') }, h('span', null, '🎁'), 'Retirar una encomienda'),
      btn({ className: 'sc-tot-b sc-tot-sos', onClick: () => totemGo('help', {}, '¿Qué tipo de ayuda necesitas?', 'alert') }, h('span', null, '🆘'), 'Necesito ayuda'),
    );

    const unitPicker = (onPick) => h('div', { className: 'sc-tot-form' },
      tinput('unitQ', { placeholder: 'Número de departamento, oficina o casa', autoFocus: true }),
      h('div', { className: 'sc-tot-units' }, matches.length
        ? matches.map((u) => btn({ key: u.id, className: 'sc-tot-unit', onClick: () => { closeKb(); onPick(u); } },
            h('strong', null, s(u.code)), u.tower ? h('span', null, s(u.tower)) : null))
        : h('p', { className: 'sc-empty' }, m.units.length ? 'No hay coincidencias.' : 'El directorio está vacío: cárgalo en la pestaña Directorio.')),
    );

    const step = t.step;
    let body = home;
    if (step === 'visit') {
      body = h('div', { className: 'sc-tot-form' },
        tinput('who', { placeholder: '¿Cuál es tu nombre? (opcional)' }),
        unitPicker((u) => { void totemAnnounce(u.code, who); setUnitQ(''); }),
        t.ctx.error ? h('p', { className: 'sc-warn' }, t.ctx.error) : null,
      );
    } else if (step === 'call') {
      body = unitPicker((u) => { void totemCall(u.code, who); setUnitQ(''); });
    } else if (step === 'resident') {
      body = h('div', { className: 'sc-tot-form' },
        tinput('unitQ', { placeholder: 'Tu unidad' }),
        tinput('pin', { type: 'password', inputMode: 'numeric', placeholder: 'Código de ingreso' }),
        btn({ className: 'sc-btn sc-btn-primary sc-btn-big', onClick: () => { closeKb(); void totemPin(unitQ, pin); setPin(''); } }, 'Entrar'),
        t.ctx.error ? h('p', { className: 'sc-warn' }, t.ctx.error) : null,
        h('p', { className: 'sc-note' }, 'Sin biometría: el ingreso se valida con un código de la unidad.'),
      );
    } else if (step === 'parcel') {
      body = h('div', { className: 'sc-tot-form' },
        tinput('carrier', { placeholder: 'Empresa de reparto' }),
        unitPicker(async (u) => {
          const r = await receiveParcel({ unit: u.code, carrier, receivedBy: 'Tótem' });
          setUnitQ(''); setCarrier('');
          totemGo('parcel-done', { code: r.code, unit: u.code },
            'Encomienda registrada para ' + u.code + '. Avisamos a la unidad con su código de retiro. Gracias.');
        }),
      );
    } else if (step === 'parcel-done') {
      body = h('div', { className: 'sc-tot-form sc-tot-center' },
        h('div', { className: 'sc-code' }, s(t.ctx.code)),
        h('p', null, 'Código de retiro de la unidad ' + s(t.ctx.unit) + '.'),
        btn({ className: 'sc-btn sc-btn-primary sc-btn-big', onClick: back }, 'Listo'));
    } else if (step === 'pickup') {
      body = h('div', { className: 'sc-tot-form' },
        tinput('pickCode', { inputMode: 'numeric', placeholder: 'Código de retiro' }),
        btn({ className: 'sc-btn sc-btn-primary sc-btn-big', onClick: async () => {
          closeKb();
          const p = m.parcels.find((x) => s(x.code) === s(pickCode).trim() && x.status !== 'delivered');
          if (!p) { totemGo('pickup', { error: 'Ese código no corresponde a una encomienda pendiente.' }, 'Ese código no corresponde a una encomienda pendiente.'); return; }
          await releaseParcel(p.id, pickCode, s(p.unit));
          setPickCode('');
          totemGo('done', { ok: true }, 'Retiro registrado. Gracias.');
        } }, 'Retirar'),
        t.ctx.error ? h('p', { className: 'sc-warn' }, t.ctx.error) : null);
    } else if (step === 'help') {
      body = h('div', { className: 'sc-tot-menu' },
        btn({ className: 'sc-tot-b sc-tot-sos', onClick: () => totemHelp('medical') }, h('span', null, '🚑'), 'Emergencia médica'),
        btn({ className: 'sc-tot-b sc-tot-sos', onClick: () => totemHelp('fire') }, h('span', null, '🔥'), 'Fuego o humo'),
        btn({ className: 'sc-tot-b sc-tot-sos', onClick: () => totemHelp('security') }, h('span', null, '🚨'), 'Me siento en peligro'),
        btn({ className: 'sc-tot-b', onClick: back }, h('span', null, '↩'), 'Volver'));
    } else if (step === 'help-done') {
      body = h('div', { className: 'sc-tot-form sc-tot-center' },
        h('p', { className: 'sc-tot-big' }, 'El personal ya fue avisado.'),
        h('p', { className: 'sc-note' }, 'Una persona del equipo confirmará el contacto con el servicio de emergencia. '
          + 'Si puedes, quédate aquí: el tótem mantiene el canal abierto.'),
        btn({ className: 'sc-btn sc-btn-big', onClick: back }, 'Volver'));
    } else if (step === 'waiting') {
      const acc = m.accesses.find((a) => a.id === t.ctx.accessId);
      const st = acc && acc.status;
      body = h('div', { className: 'sc-tot-form sc-tot-center' },
        st === 'granted' ? h('p', { className: 'sc-tot-big sc-ok' }, 'Autorizado. Puedes pasar.')
          : st === 'denied' ? h('p', { className: 'sc-tot-big sc-err' }, 'La unidad no autoriza el ingreso.')
          : h('p', { className: 'sc-tot-big' }, 'Esperando respuesta de ' + s(t.ctx.unit) + '…'),
        btn({ className: 'sc-btn sc-btn-big', onClick: back }, 'Volver al inicio'));
    } else if (step === 'done') {
      body = h('div', { className: 'sc-tot-form sc-tot-center' },
        h('p', { className: 'sc-tot-big sc-ok' }, '✓ Listo'),
        btn({ className: 'sc-btn sc-btn-big', onClick: back }, 'Volver'));
    }

    const kbField = FIELDS[kb.target];
    // El botón de teclado del pie escribe en el primer campo del paso.
    const firstField = step === 'visit' ? 'who'
      : step === 'resident' ? 'unitQ' : step === 'call' ? 'unitQ'
      : step === 'parcel' ? 'carrier' : step === 'pickup' ? 'pickCode' : '';

    return h('div', { className: 'sc-view sc-totem' + (m.kiosk ? ' sc-kiosk' : '') },
      h('div', { className: 'sc-tot-stage' },
        h('div', { className: 'sc-tot-side' },
          h('div', { className: 'sc-tot-avatar' },
            h(Avatar, { style: m.settings.avatarStyle, speaking: m.avatar.speaking, mood: m.avatar.mood }),
            h('div', { className: 'sc-tot-name' }, s(m.settings.avatarName) || 'Kim',
              h('span', { className: 'sc-tot-live' + (m.avatar.speaking ? ' on' : '') },
                m.avatar.speaking ? 'hablando' : 'conserje virtual · en línea')),
          ),
          h(Mirror, { on: !!m.sensor.cam }),
        ),
        h('div', { className: 'sc-tot-panelx' },
          h('p', { className: 'sc-tot-say' }, say || HELLO()),
          body,
          kb.open && kbField ? h(Keyboard, {
            mode: kb.mode, shift: kb.shift, value: kbField.value, label: kbField.label, secret: kbField.secret,
            onType: kbType, onBack: kbBack, onClose: closeKb,
            onShift: () => setKb((k) => Object.assign({}, k, { shift: !k.shift })),
            onMode: () => setKb((k) => Object.assign({}, k, { mode: k.mode === '123' ? 'abc' : '123' })),
          }) : null,
          step !== 'home' ? btn({ className: 'sc-btn sc-btn-ghost', onClick: back }, '← Inicio') : null,
        ),
      ),
      h('div', { className: 'sc-tot-foot' },
        h('span', null, '🔒 Acceso monitoreado. Se registran ingresos, salidas y eventos de seguridad. '
          + 'La cámara se analiza en este equipo y no se graba. Sin reconocimiento facial. Retención: '
          + num(m.settings.retentionDays, LEGAL_RETENTION_DAYS) + ' días.'),
        h('span', { className: 'sc-row' },
          firstField ? btn({ className: 'sc-btn' + (kb.open ? ' sc-btn-on' : ''), onClick: () => (kb.open ? closeKb() : openKb(firstField)) }, '⌨ Teclado') : null,
          btn({ className: 'sc-btn' + (m.sensor.cam ? ' sc-btn-on' : ''), onClick: () => (m.sensor.cam ? stopCamera() : startCamera()) }, m.sensor.cam ? '🎥 Cámara encendida' : '🎥 Encender cámara'),
          btn({ className: 'sc-btn sc-btn-ghost', onClick: () => setModel({ kiosk: !m.kiosk }) }, m.kiosk ? 'Salir del modo tótem' : 'Modo tótem (pantalla completa)')),
      ),
    );
  }

  // ── Vista: incidentes (bitácora forense) ────────────────────────────────
  function Incidents(props) {
    const m = props.m;
    const [filter, setFilter] = useState('open');
    const [sel, setSel] = useState(m.focus || null);
    const [what, setWhat] = useState('');
    const [byName, setByName] = useState('');
    const [channel, setChannel] = useState('');
    const list = useMemo(() => m.incidents.filter((i) => (
      filter === 'all' ? true : filter === 'open' ? i.status !== 'closed' : filter === 'critical' ? num(i.level, 0) >= 4 : i.status === filter
    )), [m.incidents, filter]);
    const inc = list.find((i) => i.id === sel) || m.incidents.find((i) => i.id === sel) || list[0] || null;
    useEffect(() => { if (m.focus && m.focus !== sel) setSel(m.focus); }, [m.focus]);

    const filters = [['open', 'Abiertos'], ['critical', 'Críticos'], ['escalated', 'Escalados'], ['closed', 'Cerrados'], ['all', 'Todos']];
    return h('div', { className: 'sc-view sc-inc' },
      h('div', { className: 'sc-row sc-row-wrap' },
        filters.map(([id, label]) => btn({ key: id, className: 'sc-btn sc-btn-tab' + (filter === id ? ' sc-btn-on' : ''), onClick: () => setFilter(id) }, label)),
        h('span', { className: 'sc-spacer' }),
        btn({ onClick: () => download('incidentes-' + new Date().toISOString().slice(0, 10) + '.csv', incidentsCsv(), 'text/csv') }, '⬇ Exportar CSV'),
      ),
      h('div', { className: 'sc-split' },
        h('ul', { className: 'sc-list sc-list-tall' }, list.length ? list.map((i) => h('li', {
          key: i.id, className: 'sc-list-i' + (inc && inc.id === i.id ? ' sc-sel' : ''), onClick: () => setSel(i.id),
        },
          h('span', { className: 'sc-i-icon' }, riskType(i.type).icon),
          h('span', { className: 'sc-i-main' },
            h('strong', null, s(i.typeLabel)),
            h('span', { className: 'sc-i-sub' }, [fmtDateTime(i.openedAt), i.camera || i.unit, i.status].filter(Boolean).join(' · '))),
          levelPill(i.level))) : h('li', { className: 'sc-empty' }, 'Sin incidentes con este filtro.')),

        inc ? h('section', { className: 'sc-card sc-detail' },
          h('h3', null, riskType(inc.type).icon + ' ' + s(inc.typeLabel), levelPill(inc.level)),
          h('p', { className: 'sc-detail-sub' }, [fmtDateTime(inc.openedAt), inc.camera, inc.unit, inc.subject].filter(Boolean).join(' · ')),
          h('p', null, s(inc.summary)),
          meter('Puntaje de riesgo', num(inc.score, 0) / 100, num(inc.level, 0) >= 4 ? 'err' : num(inc.level, 0) >= 3 ? 'warn' : 'ok'),
          h('p', { className: 'sc-note' }, 'Confianza de la detección: ' + Math.round(num(inc.confidence, 0) * 100) + '%'
            + ((inc.factors || []).length ? ' · Contexto: ' + inc.factors.join(', ') : '')
            + ' · Origen: ' + s(inc.source) + (num(inc.hits, 1) > 1 ? ' · ' + inc.hits + ' señales agrupadas' : '')),
          num(inc.level, 0) >= 3 ? h('p', { className: 'sc-warn' }, 'Esto es una hipótesis del motor, no una conclusión: '
            + 'confírmala antes de escalar. ' + levelInfo(inc.level).action) : null,

          h('div', { className: 'sc-row sc-row-wrap' },
            !inc.ackAt ? btn({ className: 'sc-btn sc-btn-primary', onClick: () => ackIncident(inc.id) }, '✋ Tomar') : chip('Tomado por ' + s(inc.ackBy), 'ok'),
            inc.status !== 'closed' ? btn({ onClick: () => closeIncident(inc.id, 'resuelto') }, '✓ Cerrar') : chip('Cerrado ' + fmtDateTime(inc.closedAt), 'ok'),
            inc.status !== 'closed' ? btn({ onClick: () => closeIncident(inc.id, 'falso-positivo') }, '⌀ Falso positivo') : null,
            btn({ onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(brief(inc)); shell.notify({ level: 'info', text: 'Parte copiado.' }); } }, '📋 Copiar parte'),
          ),

          h('div', { className: 'sc-esc' },
            h('h4', null, 'Escalar a un servicio externo'),
            h('p', { className: 'sc-note' }, 'La app no llama sola. Elige el canal, escribe quién autoriza y queda sellado en la bitácora.'),
            h('div', { className: 'sc-row sc-row-wrap' },
              h('select', { className: 'sc-input', value: channel, onChange: (e) => setChannel(e.target.value) },
                h('option', { value: '' }, 'Canal…'),
                m.channels.map((c) => h('option', { key: c.id, value: c.id }, c.name + (c.phone ? ' · ' + c.phone : ' · sin número')))),
              h('input', { className: 'sc-input', value: byName, placeholder: 'Quién autoriza', onChange: (e) => setByName(e.target.value) }),
              btn({ className: 'sc-btn sc-btn-danger', disabled: !channel || !s(byName).trim(), onClick: async () => {
                const r = await escalate(inc.id, channel, byName);
                if (!r.success) shell.notify({ level: 'error', text: r.error });
                setChannel('');
              } }, '📞 Registrar escalamiento'),
            ),
            h('div', { className: 'sc-row sc-row-wrap' }, suggestedChannels(inc.type).map((c) => h('a', {
              key: c.id, className: 'sc-btn sc-btn-link', href: c.phone ? 'tel:' + c.phone : undefined,
              title: c.phone ? 'Marcar ' + c.phone : 'Sin número configurado (pestaña Emergencias)',
            }, '☎ ' + c.name + (c.phone ? ' ' + c.phone : '')))),
            (inc.escalations || []).length ? h('ul', { className: 'sc-mini' }, inc.escalations.map((e, ix) => h('li', { key: ix },
              fmtDateTime(e.at) + ' · ' + s(e.channelName) + ' · autorizó ' + s(e.by)))) : null,
          ),

          h('div', { className: 'sc-esc' },
            h('h4', null, 'Bitácora del incidente'),
            h('ul', { className: 'sc-mini' }, (inc.actions || []).map((a, ix) => h('li', { key: ix },
              fmtTime(a.at) + ' · ' + s(a.what) + (a.by ? ' (' + a.by + ')' : '')))),
            h('div', { className: 'sc-row' },
              h('input', { className: 'sc-input', value: what, placeholder: 'Qué se hizo…', onChange: (e) => setWhat(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter') { void addAction(inc.id, what); setWhat(''); } } }),
              btn({ onClick: () => { void addAction(inc.id, what); setWhat(''); } }, 'Anotar')),
            h('p', { className: 'sc-seal' }, 'Sello ' + s(inc.hash).slice(0, 16) + '… · registro ' + num(inc.seq, 0)
              + (inc.hold ? ' · retención legal activa' : '')),
          ),
        ) : h('section', { className: 'sc-card' }, h('p', { className: 'sc-empty' }, 'Elige un incidente.')),
      ),
    );
  }

  const csvCell = (v) => '"' + s(v).replace(/"/g, '""').replace(/\n/g, ' ') + '"';
  function incidentsCsv() {
    const head = ['id', 'seq', 'abierto', 'tipo', 'evento', 'nivel', 'puntaje', 'confianza', 'origen', 'ubicacion', 'unidad', 'detalle', 'estado', 'tomado_por', 'escalado_a', 'cerrado', 'sello'];
    const rows = model.incidents.map((i) => [i.id, i.seq, i.openedAt, i.type, i.typeLabel, i.level, i.score,
      Math.round(num(i.confidence, 0) * 100) + '%', i.source, i.camera, i.unit, i.summary, i.status, i.ackBy,
      (i.escalations || []).map((e) => e.channelName + '/' + e.by).join(' | '), i.closedAt, i.hash]);
    return [head].concat(rows).map((r) => r.map(csvCell).join(';')).join('\n');
  }
  function accessCsv() {
    const head = ['id', 'seq', 'fecha', 'sentido', 'perfil', 'persona', 'unidad', 'via', 'estado', 'autorizado_por', 'patente', 'empresa', 'sello'];
    const rows = model.accesses.map((a) => [a.id, a.seq, a.at, a.direction === 'out' ? 'salida' : 'ingreso', a.profile,
      a.subject, a.unit, a.method, a.status, a.authorizedBy, a.plate, a.company, a.hash]);
    return [head].concat(rows).map((r) => r.map(csvCell).join(';')).join('\n');
  }

  // ── Vista: accesos ──────────────────────────────────────────────────────
  function Access(props) {
    const m = props.m;
    const [form, setForm] = useState({ direction: 'in', profile: 'visit', subject: '', unit: '', plate: '', company: '' });
    const [q, setQ] = useState('');
    const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
    const pending = m.accesses.filter((a) => a.status === 'pending');
    const rows = useMemo(() => {
      const c = canon(q);
      return m.accesses.filter((a) => !c || canon(a.subject + ' ' + a.unit + ' ' + a.company + ' ' + a.plate).includes(c)).slice(0, 120);
    }, [m.accesses, q]);
    const PROFILES = [['visit', 'Visita'], ['resident', 'Residente'], ['provider', 'Proveedor'], ['delivery', 'Reparto'], ['staff', 'Personal']];
    return h('div', { className: 'sc-view' },
      pending.length ? h('section', { className: 'sc-card' },
        h('h3', null, 'Esperando decisión (' + pending.length + ')'),
        h('ul', { className: 'sc-list' }, pending.map((a) => h('li', { key: a.id, className: 'sc-list-i' },
          h('span', { className: 'sc-i-icon' }, a.method === 'citofono' ? '📞' : '🚶'),
          h('span', { className: 'sc-i-main' },
            h('strong', null, (s(a.subject) || 'Sin identificar') + ' → ' + s(a.unit)),
            h('span', { className: 'sc-i-sub' }, 'hace ' + ago(a.at) + ' · ' + s(a.method))),
          btn({ className: 'sc-btn sc-btn-ok', onClick: () => decideAccess(a.id, true) }, 'Autorizar'),
          btn({ className: 'sc-btn sc-btn-no', onClick: () => decideAccess(a.id, false) }, 'Rechazar')))),
      ) : null,

      h('section', { className: 'sc-card' },
        h('h3', null, 'Registrar movimiento'),
        h('div', { className: 'sc-form-grid' },
          field('Sentido', h('select', { className: 'sc-input', value: form.direction, onChange: (e) => set('direction', e.target.value) },
            h('option', { value: 'in' }, 'Ingreso'), h('option', { value: 'out' }, 'Salida'))),
          field('Perfil', h('select', { className: 'sc-input', value: form.profile, onChange: (e) => set('profile', e.target.value) },
            PROFILES.map(([v, l]) => h('option', { key: v, value: v }, l)))),
          field('Persona', h('input', { className: 'sc-input', value: form.subject, placeholder: m.settings.privacyMode ? 'Opcional (modo privacidad)' : 'Nombre', onChange: (e) => set('subject', e.target.value) })),
          field('Unidad', h('input', { className: 'sc-input', value: form.unit, placeholder: 'Depto / oficina', onChange: (e) => set('unit', e.target.value) })),
          field('Patente', h('input', { className: 'sc-input', value: form.plate, placeholder: 'AA·BB·11', onChange: (e) => set('plate', e.target.value) })),
          field('Empresa', h('input', { className: 'sc-input', value: form.company, onChange: (e) => set('company', e.target.value) })),
        ),
        h('div', { className: 'sc-row' },
          btn({ className: 'sc-btn sc-btn-primary', onClick: async () => {
            await logAccess(Object.assign({}, form, { method: 'consola', status: 'granted', authorizedBy: actorName() }));
            setForm({ direction: 'in', profile: 'visit', subject: '', unit: '', plate: '', company: '' });
            shell.notify({ level: 'success', text: 'Movimiento registrado.' });
          } }, 'Registrar'),
          btn({ onClick: () => download('accesos-' + new Date().toISOString().slice(0, 10) + '.csv', accessCsv(), 'text/csv') }, '⬇ Exportar CSV'),
        ),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Últimos movimientos'),
        h('input', { className: 'sc-input', value: q, placeholder: 'Buscar por persona, unidad, empresa o patente', onChange: (e) => setQ(e.target.value) }),
        h('div', { className: 'sc-tablewrap' }, h('table', { className: 'sc-table' },
          h('thead', null, h('tr', null, ['Hora', 'Sentido', 'Persona', 'Unidad', 'Vía', 'Estado'].map((c) => h('th', { key: c }, c)))),
          h('tbody', null, rows.map((a) => h('tr', { key: a.id },
            h('td', null, fmtDateTime(a.at)),
            h('td', null, a.direction === 'out' ? '↑ Salida' : '↓ Ingreso'),
            h('td', null, s(a.subject) || '—'),
            h('td', null, s(a.unit) || '—'),
            h('td', null, s(a.method)),
            h('td', null, chip(a.status === 'granted' ? 'Autorizado' : a.status === 'denied' ? 'Rechazado' : 'Esperando',
              a.status === 'granted' ? 'ok' : a.status === 'denied' ? 'err' : 'warn'))))))),
      ),
    );
  }

  // ── Vista: encomiendas ──────────────────────────────────────────────────
  function Parcels(props) {
    const m = props.m;
    const [f, setF] = useState({ unit: '', carrier: '', tracking: '', locker: '' });
    const set = (k, v) => setF((x) => Object.assign({}, x, { [k]: v }));
    const pend = m.parcels.filter((p) => p.status !== 'delivered');
    const done = m.parcels.filter((p) => p.status === 'delivered').slice(0, 30);
    return h('div', { className: 'sc-view' },
      h('section', { className: 'sc-card' },
        h('h3', null, 'Recibir encomienda'),
        h('div', { className: 'sc-form-grid' },
          field('Unidad', h('input', { className: 'sc-input', value: f.unit, onChange: (e) => set('unit', e.target.value) })),
          field('Transportista', h('input', { className: 'sc-input', value: f.carrier, onChange: (e) => set('carrier', e.target.value) })),
          field('Seguimiento', h('input', { className: 'sc-input', value: f.tracking, onChange: (e) => set('tracking', e.target.value) })),
          field('Casillero', h('input', { className: 'sc-input', value: f.locker, onChange: (e) => set('locker', e.target.value) })),
        ),
        btn({ className: 'sc-btn sc-btn-primary', onClick: async () => {
          if (!s(f.unit).trim()) { shell.notify({ level: 'warn', text: 'Falta la unidad.' }); return; }
          const r = await receiveParcel(Object.assign({}, f, { receivedBy: actorName() }));
          setF({ unit: '', carrier: '', tracking: '', locker: '' });
          shell.notify({ level: 'success', text: r.message });
        } }, 'Registrar y generar código'),
        h('p', { className: 'sc-note' }, 'La cadena queda completa: recepción → código → notificación → retiro validado, '
          + 'sin que el repartidor entre a las áreas comunes.'),
      ),
      h('section', { className: 'sc-card' },
        h('h3', null, 'Por retirar (' + pend.length + ')'),
        pend.length ? h('ul', { className: 'sc-list' }, pend.map((p) => h('li', { key: p.id, className: 'sc-list-i' },
          h('span', { className: 'sc-i-icon' }, '📦'),
          h('span', { className: 'sc-i-main' },
            h('strong', null, s(p.unit) + (p.carrier ? ' · ' + p.carrier : '')),
            h('span', { className: 'sc-i-sub' }, 'recibida ' + fmtDateTime(p.receivedAt) + (p.locker ? ' · casillero ' + p.locker : '') + ' · código ' + s(p.code))),
          btn({ className: 'sc-btn sc-btn-ok', onClick: () => releaseParcel(p.id, p.code, s(p.unit)) }, 'Marcar retirada'))))
          : h('p', { className: 'sc-empty' }, 'Nada pendiente.'),
      ),
      done.length ? h('section', { className: 'sc-card' },
        h('h3', null, 'Retiradas'),
        h('ul', { className: 'sc-mini' }, done.map((p) => h('li', { key: p.id },
          fmtDateTime(p.deliveredAt) + ' · ' + s(p.unit) + ' · ' + s(p.carrier || '—')))),
      ) : null,
    );
  }

  // ── Vista: directorio ───────────────────────────────────────────────────
  function Directory(props) {
    const m = props.m;
    const [f, setF] = useState({ code: '', name: '', tower: '', phone: '', email: '', pin: '' });
    const [q, setQ] = useState('');
    const set = (k, v) => setF((x) => Object.assign({}, x, { [k]: v }));
    const list = useMemo(() => {
      const c = canon(q);
      return m.units.filter((u) => !c || canon(u.code + ' ' + u.name + ' ' + u.tower).includes(c));
    }, [m.units, q]);
    return h('div', { className: 'sc-view' },
      h('section', { className: 'sc-card' },
        h('h3', null, f.id ? 'Editar unidad' : 'Nueva unidad'),
        h('div', { className: 'sc-form-grid' },
          field('Unidad', h('input', { className: 'sc-input', value: f.code, placeholder: '1204', onChange: (e) => set('code', e.target.value) })),
          field('Nombre o razón social', h('input', { className: 'sc-input', value: f.name, onChange: (e) => set('name', e.target.value) })),
          field('Torre / piso', h('input', { className: 'sc-input', value: f.tower, onChange: (e) => set('tower', e.target.value) })),
          field('Teléfono', h('input', { className: 'sc-input', value: f.phone, onChange: (e) => set('phone', e.target.value) })),
          field('Correo', h('input', { className: 'sc-input', value: f.email, onChange: (e) => set('email', e.target.value) })),
          field('Código de ingreso', h('input', { className: 'sc-input', value: f.pin, onChange: (e) => set('pin', e.target.value) }), 'Numérico, lo usa el residente en el tótem'),
        ),
        h('div', { className: 'sc-row' },
          btn({ className: 'sc-btn sc-btn-primary', onClick: async () => {
            const r = await upsertUnit(f);
            if (!r.success) { shell.notify({ level: 'warn', text: r.error }); return; }
            setF({ code: '', name: '', tower: '', phone: '', email: '', pin: '' });
            shell.notify({ level: 'success', text: r.message });
          } }, 'Guardar'),
          f.id ? btn({ onClick: () => setF({ code: '', name: '', tower: '', phone: '', email: '', pin: '' }) }, 'Cancelar') : null),
      ),
      h('section', { className: 'sc-card' },
        h('h3', null, 'Unidades (' + m.units.length + ')'),
        h('input', { className: 'sc-input', value: q, placeholder: 'Buscar', onChange: (e) => setQ(e.target.value) }),
        h('div', { className: 'sc-tablewrap' }, h('table', { className: 'sc-table' },
          h('thead', null, h('tr', null, ['Unidad', 'Nombre', 'Torre', 'Teléfono', 'Código', ''].map((c) => h('th', { key: c }, c)))),
          h('tbody', null, list.map((u) => h('tr', { key: u.id },
            h('td', null, s(u.code)), h('td', null, s(u.name)), h('td', null, s(u.tower)),
            h('td', null, u.phone ? h('a', { href: 'tel:' + s(u.phone) }, s(u.phone)) : '—'),
            h('td', null, u.pin ? '••••' : '—'),
            h('td', null,
              btn({ onClick: () => setF({ id: u.id, code: s(u.code), name: s(u.name), tower: s(u.tower), phone: s(u.phone), email: s(u.email), pin: s(u.pin) }) }, 'Editar'),
              btn({ className: 'sc-btn sc-btn-no', onClick: () => removeRecord('units', u.id) }, 'Eliminar'))))))),
      ),
    );
  }

  // ── Vista: emergencias ──────────────────────────────────────────────────
  function Emergency(props) {
    const m = props.m;
    const [rows, setRows] = useState(m.channels);
    useEffect(() => { setRows(m.channels); }, [m.channels]);
    const critical = m.incidents.filter((i) => i.status !== 'closed' && num(i.level, 0) >= 4);
    const setRow = (id, k, v) => setRows((list) => list.map((c) => (c.id === id ? Object.assign({}, c, { [k]: v }) : c)));
    return h('div', { className: 'sc-view' },
      critical.length ? h('section', { className: 'sc-card sc-card-alert' },
        h('h3', null, '🔴 ' + critical.length + ' incidente(s) crítico(s) sin cerrar'),
        h('ul', { className: 'sc-list' }, critical.map((i) => h('li', { key: i.id, className: 'sc-list-i', onClick: () => setModel({ view: 'incidents', focus: i.id }) },
          h('span', { className: 'sc-i-icon' }, riskType(i.type).icon),
          h('span', { className: 'sc-i-main' }, h('strong', null, s(i.typeLabel)),
            h('span', { className: 'sc-i-sub' }, fmtDateTime(i.openedAt) + ' · ' + s(i.camera || i.unit || ''))),
          levelPill(i.level)))),
        h('p', { className: 'sc-note' }, 'Abre el incidente para registrar el escalamiento con el nombre de quien lo autoriza.'),
      ) : null,

      h('section', { className: 'sc-card' },
        h('h3', null, 'Canales de escalamiento'),
        h('p', { className: 'sc-note' }, 'Los números de emergencia de Chile vienen cargados; completa los propios de la comunidad '
          + '(seguridad municipal, central de alarmas, administración). El tótem nunca marca solo: deja el enlace listo y sella quién autorizó.'),
        h('div', { className: 'sc-tablewrap' }, h('table', { className: 'sc-table' },
          h('thead', null, h('tr', null, ['Canal', 'Teléfono', 'Marcar'].map((c) => h('th', { key: c }, c)))),
          h('tbody', null, rows.map((c) => h('tr', { key: c.id },
            h('td', null, h('input', { className: 'sc-input', value: s(c.name), onChange: (e) => setRow(c.id, 'name', e.target.value) })),
            h('td', null, h('input', { className: 'sc-input', value: s(c.phone), placeholder: '—', onChange: (e) => setRow(c.id, 'phone', e.target.value) })),
            h('td', null, c.phone ? h('a', { className: 'sc-btn sc-btn-link', href: 'tel:' + s(c.phone) }, '☎ ' + s(c.phone)) : '—')))))),
        h('div', { className: 'sc-row' },
          btn({ className: 'sc-btn sc-btn-primary', onClick: () => { scheduleDefinition({ channels: rows }); shell.notify({ level: 'success', text: 'Canales guardados.' }); } }, 'Guardar canales'),
          btn({ onClick: () => setRows(DEFAULT_CHANNELS.slice()) }, 'Restablecer'),
        ),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Protocolo por tipo de evento'),
        h('div', { className: 'sc-tablewrap' }, h('table', { className: 'sc-table' },
          h('thead', null, h('tr', null, ['Evento', 'Severidad', 'Canal sugerido', 'Qué hace la app'].map((c) => h('th', { key: c }, c)))),
          h('tbody', null, RISK_TYPES.map((t) => h('tr', { key: t.id },
            h('td', null, t.icon + ' ' + t.label),
            h('td', null, String(t.sev)),
            h('td', null, (CHANNEL_FOR[t.id] || ['admin']).map((id) => (m.channels.find((c) => c.id === id) || { name: id }).name).join(', ')),
            h('td', null, t.sev >= 78 ? 'Alerta, aviso por el parlante y propone escalar' : t.sev >= 55 ? 'Alerta al personal y pide revisión' : 'Registra y avisa'))))),
        ),
        h('p', { className: 'sc-note' }, 'El nivel final no sale solo de esta tabla: la severidad se pondera por la confianza '
          + 'de la detección y por el contexto (hora, intentos, zona, si hay visita registrada).'),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Parte para el servicio de emergencia'),
        h('p', { className: 'sc-note' }, 'Esto es lo que se copia al escalar. Complétalo en ⚙️ Configurar: sin dirección exacta, '
          + 'cada minuto de la llamada se va en explicar dónde queda el acceso.'),
        h('pre', { className: 'sc-pre' }, [
          (m.settings.siteName || '⚠️ Falta el nombre de la comunidad'),
          (m.settings.siteAddress || '⚠️ Falta la dirección exacta del acceso'),
          'Evento · nivel · hora · ubicación · unidad · detalle',
          'Registro sellado con su identificador de bitácora',
        ].join('\n')),
      ),
    );
  }

  // ── Vista: cumplimiento ─────────────────────────────────────────────────
  function Compliance(props) {
    const m = props.m;
    const [check, setCheck] = useState(null);
    const [busy, setBusy] = useState(false);
    const days = num(m.settings.retentionDays, LEGAL_RETENTION_DAYS);
    const shortRetention = days < LEGAL_RETENTION_DAYS;
    return h('div', { className: 'sc-view' },
      h('section', { className: 'sc-card' },
        h('h3', null, 'Integridad de la bitácora'),
        h('p', { className: 'sc-note' }, 'Cada acceso e incidente se sella con SHA-256 sobre el sello del registro anterior. '
          + 'Si alguien edita un registro guardado, la cadena deja de cuadrar y aparece aquí.'),
        h('div', { className: 'sc-row' },
          btn({ className: 'sc-btn sc-btn-primary', disabled: busy, onClick: async () => {
            setBusy(true);
            try { setCheck(await verifyChain()); } finally { setBusy(false); }
          } }, busy ? 'Verificando…' : '🔐 Verificar cadena'),
          btn({ onClick: () => download('bitacora-' + new Date().toISOString().slice(0, 10) + '.json',
            JSON.stringify({ site: m.settings.siteName, exportedAt: stamp(), version: APP_VERSION,
              incidents: m.incidents, accesses: m.accesses, parcels: m.parcels }, null, 2), 'application/json') }, '⬇ Exportar bitácora'),
        ),
        check ? h('div', { className: check.problems.length ? 'sc-warn' : 'sc-ok-box' },
          check.problems.length
            ? h('div', null, h('strong', null, check.problems.length + ' inconsistencia(s) sobre ' + check.total + ' registros'),
                h('ul', { className: 'sc-mini' }, check.problems.slice(0, 12).map((p, i) => h('li', { key: i }, p.id + ' — ' + p.why))))
            : h('div', null, '✓ ' + check.total + ' registros encadenados sin alteraciones'
                + (check.strong ? ' (SHA-256).' : ' (sello de respaldo: este navegador no expone WebCrypto).')),
        ) : null,
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Retención de datos'),
        h('table', { className: 'sc-kpi' }, h('tbody', null,
          h('tr', null, h('td', null, 'Retención configurada'), h('td', null, days + ' días')),
          h('tr', null, h('td', null, 'Mínimo legal (Ley 21.659)'), h('td', null, LEGAL_RETENTION_DAYS + ' días')),
          h('tr', null, h('td', null, 'Registros en la bitácora'), h('td', null, String(m.incidents.length + m.accesses.length))),
          h('tr', null, h('td', null, 'Con retención legal activa'), h('td', null, String(m.incidents.filter((i) => i.hold).length))),
        )),
        shortRetention ? h('p', { className: 'sc-warn' }, 'La retención configurada está por debajo del mínimo de 120 días que exige '
          + 'la Ley 21.659 para registros de vigilancia. Súbela en ⚙️ Configurar.') : null,
        h('div', { className: 'sc-row' },
          btn({ onClick: async () => { const n = await purgeExpired(); shell.notify({ level: 'info', text: n ? n + ' registro(s) vencido(s) eliminados.' : 'No hay nada vencido.' }); } }, '🧹 Purgar vencidos ahora'),
        ),
        h('p', { className: 'sc-note' }, 'La purga corre sola al abrir la ventana y cada seis horas. Nunca borra un incidente abierto '
          + 'ni uno marcado con retención legal (todo lo escalado o crítico queda marcado).'),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Qué se guarda y qué no'),
        h('div', { className: 'sc-tablewrap' }, h('table', { className: 'sc-table' },
          h('thead', null, h('tr', null, ['Dato', 'Se guarda', 'Dónde'].map((c) => h('th', { key: c }, c)))),
          h('tbody', null, [
            ['Imágenes de la cámara del tótem', 'No', 'Se procesan en el dispositivo cuadro a cuadro y se descartan'],
            ['Audio del micrófono', 'No', 'Solo se mide energía acústica; no se graba ni se transcribe'],
            ['Rasgos biométricos', 'No', 'La app no hace reconocimiento facial ni de voz'],
            ['Nombre de visitas', m.settings.privacyMode ? 'Solo si lo dicen' : 'Sí', 'Item de acceso de la instancia'],
            ['Unidad de destino', 'Sí', 'Item de acceso de la instancia'],
            ['Códigos de ingreso de unidades', 'Sí', 'Item de unidad (no es un dato biométrico)'],
            ['Incidentes y acciones', 'Sí', 'Bitácora sellada de la instancia'],
            ['Escalamientos y quién los autorizó', 'Sí', 'Bitácora sellada de la instancia'],
          ].map((r, i) => h('tr', { key: i }, r.map((c, j) => h('td', { key: j }, c))))))),
        h('p', { className: 'sc-note' }, 'Modo privacidad ' + (m.settings.privacyMode ? 'activo' : 'desactivado')
          + ': las personas no identificadas se registran como «Persona N». La Ley 21.719 trata los datos biométricos como '
          + 'sensibles; por eso la app funciona entera sin biometría.'),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Marco normativo (Chile)'),
        h('ul', { className: 'sc-mini sc-mini-wide' },
          h('li', null, h('strong', null, 'Ley 21.442 (Copropiedad Inmobiliaria)'), ' — la comunidad debe tener un plan de emergencia '
            + 'y un registro de ocupantes. El directorio y los protocolos de esta app son el soporte de ese plan, no lo reemplazan.'),
          h('li', null, h('strong', null, 'Ley 21.659 (Seguridad Privada)'), ' — la seguridad privada es coadyuvante de la pública: '
            + 'los registros se conservan al menos 120 días y quedan a disposición del Ministerio Público, tribunales o policías. '
            + 'Para eso está el sello y la exportación de la bitácora.'),
          h('li', null, h('strong', null, 'Ley 21.719 (Protección de Datos Personales)'), ' — licitud, finalidad, proporcionalidad y '
            + 'seguridad. Sin biometría, con minimización por defecto, retención acotada y borrado automático al vencer.'),
        ),
        h('p', { className: 'sc-note' }, 'Esto orienta la configuración; no es asesoría legal. El reglamento interno y los quórums '
          + 'de la asamblea siguen siendo de la comunidad.'),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Cámaras de la comunidad (ingesta)'),
        h('p', { className: 'sc-note' }, 'La VMS o las cámaras con analítica pueden publicar sus detecciones en esta instancia '
          + 'por el gateway público de KIMOS, sin backend a medida. Llegan al mismo motor de riesgo que los sensores del tótem: '
          + 'tipo de evento, confianza, cámara y descripción.'),
        h('label', { className: 'sc-switch' },
          h('input', { type: 'checkbox', checked: !!m.settings.ingestEnabled,
            onChange: (e) => { const next = Object.assign({}, m.settings, { ingestEnabled: e.target.checked }); scheduleDefinition({ settings: next }); setModel({ settings: next }); } }),
          h('span', null, 'Aceptar detecciones de cámaras externas en esta instancia')),
        m.settings.ingestEnabled && instanceId ? h('pre', { className: 'sc-pre' },
          'POST /api/public/app/' + instanceId + '/submit/deteccion\n'
          + '{ "type": "aggression", "confidence": 0.8, "camera": "Estacionamiento -2", "note": "…" }') : null,
      ),
    );
  }

  // ── Raíz ────────────────────────────────────────────────────────────────
  function Component() {
    const [m, setM] = useState(Object.assign({}, model));
    useEffect(() => {
      listeners.add(setM);
      syncSubs++;
      if (syncSubs === 1) scheduleSync();
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake);
      if (typeof window !== 'undefined') window.addEventListener('focus', onWake);
      void load();
      return () => {
        listeners.delete(setM);
        syncSubs = Math.max(0, syncSubs - 1);
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
        if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
      };
    }, []);

    const accent = s(m.settings.accent) || '#19ACB1';
    const kpi = kpis();
    const body = m.view === 'totem' ? h(Totem, { m })
      : m.view === 'incidents' ? h(Incidents, { m })
      : m.view === 'access' ? h(Access, { m })
      : m.view === 'parcels' ? h(Parcels, { m })
      : m.view === 'directory' ? h(Directory, { m })
      : m.view === 'emergency' ? h(Emergency, { m })
      : m.view === 'compliance' ? h(Compliance, { m })
      : h(Panel, { m });

    if (m.kiosk && m.view === 'totem') {
      // Modo tótem: sin cromo de consola, la pantalla es del visitante.
      return h('div', { className: 'kimos-safe sc-kioskroot', style: { '--sc-accent-user': accent } }, body);
    }

    return h('div', { className: 'kimos-safe', style: { '--sc-accent-user': accent } },
      h('header', { className: 'sc-hd' },
        h('div', { className: 'sc-hd-title' },
          h('span', null, '🛡️ ' + (s(m.settings.siteName) || s(m.docName) || 'Safe Concierge')),
          h('span', { className: 'sc-ver', title: 'KIMOS Safe Concierge v' + APP_VERSION }, 'v' + APP_VERSION)),
        h('nav', { className: 'sc-tabs' }, VIEWS.map((v) => btn({
          key: v.id, className: 'sc-tab' + (m.view === v.id ? ' sc-tab-on' : ''),
          onClick: () => setModel({ view: v.id, kiosk: v.id === 'totem' && model.kiosk }),
        }, h('span', { className: 'sc-tab-i' }, v.icon), h('span', { className: 'sc-tab-l' }, v.label),
          v.id === 'incidents' && kpi.open ? h('span', { className: 'sc-badge' + (kpi.critical ? ' sc-badge-err' : '') }, String(kpi.open)) : null,
          v.id === 'access' && kpi.pending ? h('span', { className: 'sc-badge' }, String(kpi.pending)) : null))),
        h('div', { className: 'sc-hd-right' },
          h('span', { className: 'sc-live' + (m.offline ? ' sc-live-off' : ''), title: m.offline ? 'Sin conexión: reintentando' : 'La consola se actualiza sola' },
            h('span', { className: 'sc-live-dot' }), m.offline ? 'Sin conexión' : 'En vivo'),
          (m.sensor.cam || m.sensor.mic) ? h('span', { className: 'sc-sensing', title: 'Análisis local activo (no sale del dispositivo)' },
            (m.sensor.cam ? '🎥' : '') + (m.sensor.mic ? '🎙️' : '')) : null),
      ),
      !m.loaded ? h('div', { className: 'sc-empty' }, 'Cargando…') : body,
    );
  }

  void load();

  return {
    Component,
    unmount() {
      listeners.clear();
      syncSubs = 0;
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      if (purgeTimer) { clearInterval(purgeTimer); purgeTimer = null; }
      if (defSaveTimer) { clearTimeout(defSaveTimer); defSaveTimer = null; }
      if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
      try { if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
      stopCamera();
      stopMic();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
      teardown.forEach((off) => { try { off(); } catch (e) { /* noop */ } });
      teardown.length = 0;
      if (typeof unregisterAgent === 'function') { try { unregisterAgent(); } catch (e) { /* noop */ } }
    },
  };
}
