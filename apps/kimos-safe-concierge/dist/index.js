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
  const APP_VERSION = '1.2.0';

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
    avatarStyle: 'officer', avatarName: 'Denzel Barrett', voice: true,
    cameraSensor: false, audioSensor: false, sensitivity: 'medium',
    autoWarn: true, retentionDays: 120, privacyMode: true, accent: '#19ACB1',
    // Central de monitoreo con personal humano.
    centralApproval: true,     // toda alerta automática la valida una persona
    streamMode: 'event',       // ask · event · always
    streamLevel: 3,            // desde qué nivel se abre el enlace solo
    autoAnswerCentral: true,   // la central puede abrir el canal (con aviso a la vista)
    operatorCamera: true,      // el visitante ve la cara de quien lo atiende
    turnUrl: '', turnUser: '', turnPass: '',
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
    avatar: null,                 // aspecto del conserje virtual (Estudio del avatar)
    face: { speaking: false, mood: 'idle', text: '' },
    sensor: { cam: false, mic: false, agitation: 0, sound: 0, presence: 0, error: '', lastFire: 0, focus: null },
    calls: [],                    // enlaces con la central (señalización por items)
    docs: [],                     // archivos en el Cloud Storage de KIMOS
    link: { state: 'idle', callId: '', role: '', since: 0, error: '', remote: false, mic: true, cam: true },
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
  const KEY_OF = { incident: 'incidents', access: 'accesses', parcel: 'parcels', call: 'calls', doc: 'docs' };
  const ledger = () => model.incidents.concat(model.accesses, model.parcels, model.calls, model.docs);

  async function refresh(force) {
    if (!instanceId) { setModel({ loaded: true, offline: true }); return; }
    try {
      const items = (await shell.items.list()) || [];
      const def = items.find(isDef);
      const units = items.filter((i) => i.kind === 'unit').sort((a, b) => canon(a.code) > canon(b.code) ? 1 : -1);
      const accesses = items.filter((i) => i.kind === 'access').sort(byTime);
      const parcels = items.filter((i) => i.kind === 'parcel').sort(byTime);
      const incidents = items.filter((i) => i.kind === 'incident').sort(byTime);
      const calls = items.filter((i) => i.kind === 'call').sort(byTime);
      const docs = items.filter((i) => i.kind === 'doc').sort(byTime);
      const patch = { units, accesses, parcels, incidents, calls, docs, loaded: true, offline: false };
      if (def) {
        patch.channels = Array.isArray(def.channels) && def.channels.length ? def.channels : model.channels;
        if (def.chainHead && num(def.chainHead.seq, 0) >= num(model.chainHead.seq, 0)) patch.chainHead = def.chainHead;
        if (def.counters) patch.counters = Object.assign({ person: 0 }, def.counters);
        if (def.avatar) patch.avatar = Object.assign({}, AVATAR_DEFAULT, def.avatar);
        if (def.settings && !hasHostConfig) patch.settings = Object.assign({}, DEFAULTS, def.settings);
      }
      // La cabeza de la cadena se reconstruye desde los registros: si otra
      // consola escribió mientras tanto, esta se pone al día antes de sellar.
      const top = incidents.concat(accesses, parcels, calls, docs)
        .reduce((mx, r) => (num(r.seq, 0) > num(mx.seq, 0) ? r : mx), { seq: 0, hash: 'genesis' });
      const known = num((patch.chainHead || model.chainHead).seq, 0);
      if (num(top.seq, 0) > known) patch.chainHead = { seq: num(top.seq, 0), hash: s(top.hash) || 'genesis' };
      const subs = items.filter((i) => i && i.kind === 'submission');
      if (subs.length) void processSubmissions(subs);
      const sig = JSON.stringify([units.length, accesses.length, parcels.length, incidents.length,
        accesses[0] && accesses[0].id, incidents[0] && incidents[0].id,
        incidents.map((i) => i.status + i.level + ((i.review && i.review.status) || '')).join(''),
        parcels.map((p) => p.status).join(''),
        calls.map((c) => c.id + c.status + (c.answer ? 'a' : '')).join('')]);
      if (force || sig !== lastSig || !model.loaded || model.offline) { lastSig = sig; setModel(patch); }
      else { model = Object.assign({}, model, patch); }
      // El enlace en vivo reacciona al estado recién leído (respuesta SDP,
      // llamada entrante, la otra punta que colgó), sin esperar al sondeo.
      void driveLink();
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
        avatar: model.avatar || undefined,
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
      const key = KEY_OF[sealed.kind] || 'parcels';
      setModel({ [key]: [sealed].concat(model[key]) });
      return sealed;
    }
    const created = await shell.items.create(sealed);
    const full = Object.assign({}, sealed, created || {});
    const key = KEY_OF[full.kind] || 'parcels';
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
    // Quién valida: lo declarado por una persona ya viene validado por esa
    // persona; lo que levanta un sensor o una cámara espera a la central.
    const human = !!input.declared || input.source === 'manual' || input.source === 'consola' || input.source === 'totem';
    const review = human
      ? { status: 'approved', by: input.source === 'totem' ? 'declarado en el tótem' : actorName(), at, note: 'lo declaró una persona' }
      : (model.settings.centralApproval === false
        ? { status: 'approved', by: 'validación automática (desactivada la revisión)', at, note: '' }
        : { status: 'pending', by: '', at: '', note: '' });
    const rec = await addRecord({
      kind: 'incident',
      review,
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
    const pending = rec.review && rec.review.status === 'pending';
    if (lv >= 2) {
      shell.notify({
        level: lv >= 4 ? 'error' : 'warn',
        text: levelInfo(lv).label + ' · ' + s(rec.typeLabel) + (rec.camera ? ' (' + rec.camera + ')' : '')
          + (pending ? ' — esperando validación de la central' : ''),
      });
    }
    // Transmisión por evento: la central recibe el audio y el video del acceso
    // junto con la alerta, para poder validarla mirando, no adivinando.
    if (lv >= num(model.settings.streamLevel, 3) && model.settings.streamMode !== 'ask'
        && isTotemWindow() && model.link.state === 'idle') {
      void requestLink({ to: 'central', reason: 'incidente ' + s(rec.typeLabel), incidentId: rec.id });
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
    // La central valida antes de que nadie contacte a un servicio externo.
    const rv = inc.review || {};
    if (rv.status === 'pending') {
      return { success: false, error: 'La alerta todavía no está validada. El personal de la central debe revisarla '
        + '(ver el acceso en vivo si hace falta) y aprobarla antes de contactar a ' + ch.name + '.' };
    }
    if (rv.status === 'dismissed') {
      return { success: false, error: 'Esta alerta fue descartada por ' + s(rv.by) + '. Si cambió la situación, vuelve a aprobarla antes de escalar.' };
    }
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

  /**
   * Validación humana de una alerta automática. Es la compuerta del sistema:
   * hasta que una persona de la central la aprueba, el incidente no habilita
   * ningún contacto con seguridad ni con emergencias.
   */
  async function approveIncident(id, byName, note) {
    const inc = model.incidents.find((i) => i.id === id);
    if (!inc) return { success: false, error: 'No existe ese incidente.' };
    const by = s(byName).trim() || actorName();
    const at = stamp();
    await patchRecord('incidents', id, {
      review: { status: 'approved', by, at, note: s(note) },
      status: inc.status === 'closed' ? 'closed' : 'ack',
      ackAt: inc.ackAt || at, ackBy: inc.ackBy || by, hold: true,
      actions: (inc.actions || []).concat([{ at, what: 'Alerta VALIDADA por la central' + (note ? ': ' + s(note) : ''), by }]),
    });
    return { success: true, message: 'Alerta validada. Ya se puede registrar el contacto con un canal externo.' };
  }

  async function dismissIncident(id, byName, note) {
    const inc = model.incidents.find((i) => i.id === id);
    if (!inc) return { success: false, error: 'No existe ese incidente.' };
    const by = s(byName).trim() || actorName();
    const at = stamp();
    await patchRecord('incidents', id, {
      review: { status: 'dismissed', by, at, note: s(note) },
      status: 'closed', closedAt: at, closedBy: by, outcome: s(note) || 'no corresponde',
      actions: (inc.actions || []).concat([{ at, what: 'Alerta DESCARTADA por la central' + (note ? ': ' + s(note) : ''), by }]),
    });
    return { success: true, message: 'Alerta descartada y cerrada. Queda en la bitácora con quién la revisó.' };
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
    setModel({ face: { speaking: !!line, mood: s(mood) || 'talk', text: line } });
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
    const stop = () => { speakTimer = null; setModel({ face: { speaking: false, mood: 'idle', text: line } }); };
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
            // Centro del movimiento: de ahí sale la mirada del conserje virtual.
            let focus = model.sensor.focus;
            if (ratio >= 0.015) {
              let sx = 0; let sy = 0; let n = 0;
              for (let i = 0; i < cur.length; i += 4) {
                const px2 = i / 4;
                const d = Math.abs(cur[i] - sensors.prev[i]) + Math.abs(cur[i + 1] - sensors.prev[i + 1]) + Math.abs(cur[i + 2] - sensors.prev[i + 2]);
                if (d > 60) { sx += (px2 % 64); sy += Math.floor(px2 / 64); n++; }
              }
              if (n) focus = { x: clamp((sx / n / 64 - 0.5) * 2.4, -1, 1), y: clamp((sy / n / 48 - 0.5) * 2, -1, 1), at: Date.now() };
            }
            setModel({ sensor: Object.assign({}, model.sensor, { cam: true, agitation: ema, presence: presenceSince ? now - presenceSince : 0, error: '', focus }) });
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


  // ── Enlace con la central de monitoreo ──────────────────────────────────
  /**
   * Audio y video en vivo entre el tótem y la central atendida por personas.
   *
   * Es WebRTC punto a punto y la señalización viaja por los mismos items de la
   * instancia (oferta, respuesta y estado): no hace falta un servidor a medida.
   * Se juntan todos los candidatos ICE **antes** de escribir la oferta o la
   * respuesta (sin *trickle*), porque este canal de señalización es lento: una
   * sola escritura por lado y la conexión queda hecha.
   *
   * Reglas de la casa:
   *   · La central puede abrir el canal, pero el tótem **lo anuncia en
   *     pantalla** mientras dure: nadie mira sin que se vea que está mirando.
   *   · Cada enlace queda sellado en la bitácora (quién, cuándo, por qué y
   *     cuánto duró), igual que un acceso o un incidente.
   */
  const winId = uid('win');
  const rtc = { pc: null, remote: null, op: null, pollTimer: null, lastRequest: 0 };

  const isTotemWindow = () => !!(model.kiosk || model.view === 'totem');
  const iceServers = () => {
    const list = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (s(model.settings.turnUrl).trim()) {
      list.push({
        urls: s(model.settings.turnUrl).trim(),
        username: s(model.settings.turnUser) || undefined,
        credential: s(model.settings.turnPass) || undefined,
      });
    }
    return list;
  };

  /** Pistas locales: el tótem reusa sus sensores; la central usa las suyas. */
  async function localTracks(role) {
    if (role === 'totem') {
      if (!sensors.cam) await startCamera();
      if (!sensors.mic) await startMic();
      const t = [];
      if (sensors.cam) t.push.apply(t, sensors.cam.getVideoTracks());
      if (sensors.mic) t.push.apply(t, sensors.mic.getAudioTracks());
      return t;
    }
    // Central: cámara y micrófono del operador, sin análisis de conducta
    // (si no, el sistema levantaría incidentes de la propia sala de monitoreo).
    if (!rtc.op) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) return [];
      rtc.op = await navigator.mediaDevices.getUserMedia({
        video: model.settings.operatorCamera !== false, audio: true,
      });
    }
    return rtc.op.getTracks();
  }

  function newPeer(role) {
    const PC = (typeof window !== 'undefined') && (window.RTCPeerConnection || window.webkitRTCPeerConnection);
    if (!PC) throw new Error('Este navegador no soporta WebRTC.');
    const pc = new PC({ iceServers: iceServers() });
    pc.ontrack = (ev) => {
      const stream = (ev.streams && ev.streams[0]) || null;
      rtc.remote = stream || rtc.remote;
      setModel({ link: Object.assign({}, model.link, { remote: true }) });
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') setModel({ link: Object.assign({}, model.link, { state: 'active', since: Date.now(), error: '' }) });
      if (st === 'failed' || st === 'closed' || st === 'disconnected') {
        if (model.link.state !== 'idle') void hangup(st === 'failed' ? 'falló la conexión' : 'se cortó');
      }
    };
    rtc.pc = pc;
    return pc;
  }

  /** Espera a tener todos los candidatos (o se rinde: la red ya dio lo que hay). */
  const waitIce = (pc) => new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const done = () => { clearTimeout(t); resolve(); };
    const t = setTimeout(resolve, 2600);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') done(); });
  });

  /**
   * Pide enlace a la otra punta. `to` es 'central' (lo pide el tótem) o
   * 'totem' (lo pide el operador para ver el acceso).
   */
  async function requestLink(opts) {
    const o = opts || {};
    const to = o.to === 'totem' ? 'totem' : 'central';
    const role = to === 'central' ? 'totem' : 'central';
    if (model.link.state !== 'idle') return { success: false, error: 'Ya hay un enlace abierto.' };
    if (Date.now() - rtc.lastRequest < 8000) return { success: false, error: 'Espera unos segundos antes de reintentar.' };
    rtc.lastRequest = Date.now();
    setModel({ link: { state: 'calling', callId: '', role, since: Date.now(), error: '', remote: false, mic: true, cam: true } });
    try {
      const tracks = await localTracks(role);
      if (!tracks.length) throw new Error('Sin cámara ni micrófono disponibles.');
      const pc = newPeer(role);
      const stream = role === 'totem' ? (sensors.cam || sensors.mic) : rtc.op;
      tracks.forEach((t) => pc.addTrack(t, stream || undefined));
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      await waitIce(pc);
      const rec = await addRecord({
        kind: 'call', to, from: winId, fromRole: role,
        fromName: role === 'central' ? actorName() : (avatarOf().name + ' · tótem'),
        status: 'ringing', reason: s(o.reason) || (to === 'central' ? 'petición desde el tótem' : 'supervisión desde la central'),
        incidentId: s(o.incidentId), at: stamp(),
        offer: JSON.stringify(pc.localDescription),
        summary: 'Enlace ' + role + ' → ' + to + (o.reason ? ' · ' + o.reason : ''),
      });
      setModel({ link: Object.assign({}, model.link, { callId: rec.id, state: 'calling' }) });
      pollLinkSoon();
      return { success: true, message: 'Llamando a la ' + (to === 'central' ? 'central' : 'pantalla del tótem') + '…', call: rec };
    } catch (e) {
      const why = s((e && e.message) || e);
      closePeer();
      setModel({ link: { state: 'idle', callId: '', role: '', since: 0, error: why, remote: false, mic: true, cam: true } });
      return { success: false, error: why };
    }
  }

  /** Atiende un enlace entrante. En la central lo pulsa una persona. */
  async function answerLink(call) {
    if (!call || call.status !== 'ringing') return { success: false, error: 'Ese enlace ya no está esperando.' };
    if (model.link.state !== 'idle') return { success: false, error: 'Ya hay un enlace abierto.' };
    const role = call.to === 'totem' ? 'totem' : 'central';
    setModel({ link: { state: 'connecting', callId: call.id, role, since: Date.now(), error: '', remote: false, mic: true, cam: true } });
    try {
      const tracks = await localTracks(role);
      const pc = newPeer(role);
      const stream = role === 'totem' ? (sensors.cam || sensors.mic) : rtc.op;
      tracks.forEach((t) => pc.addTrack(t, stream || undefined));
      await pc.setRemoteDescription(JSON.parse(s(call.offer)));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitIce(pc);
      await patchRecord('calls', call.id, {
        status: 'active', answeredAt: stamp(), answeredBy: role === 'central' ? actorName() : 'tótem',
        answerWin: winId, answer: JSON.stringify(pc.localDescription),
      });
      if (role === 'totem') {
        speak('Estás en contacto con la central de monitoreo. Una persona te está atendiendo.', 'talk');
      }
      pollLinkSoon();
      return { success: true, message: 'Enlace abierto.' };
    } catch (e) {
      const why = s((e && e.message) || e);
      closePeer();
      setModel({ link: { state: 'idle', callId: '', role: '', since: 0, error: why, remote: false, mic: true, cam: true } });
      return { success: false, error: why };
    }
  }

  function closePeer() {
    if (rtc.pc) { try { rtc.pc.close(); } catch (e) { /* ya cerrada */ } }
    rtc.pc = null; rtc.remote = null;
    if (rtc.pollTimer) { clearTimeout(rtc.pollTimer); rtc.pollTimer = null; }
  }

  /** Cierra el enlace por ambos lados y deja la duración en la bitácora. */
  async function hangup(reason) {
    const id = model.link.callId;
    const wasActive = model.link.state === 'active';
    closePeer();
    // La cámara del operador se apaga al colgar; la del tótem la gobiernan sus
    // propios ajustes de sensor, no la llamada.
    if (model.link.role === 'central' && rtc.op) {
      try { rtc.op.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ }
      rtc.op = null;
    }
    setModel({ link: { state: 'idle', callId: '', role: '', since: 0, error: '', remote: false, mic: true, cam: true } });
    if (id) {
      const call = model.calls.find((c) => c.id === id);
      await patchRecord('calls', id, {
        status: 'ended', endedAt: stamp(), endedBy: actorName(), endReason: s(reason) || 'cerrado',
        seconds: call && call.answeredAt ? Math.round((Date.now() - Date.parse(call.answeredAt)) / 1000) : 0,
      });
    }
    if (wasActive && isTotemWindow()) speak('La comunicación con la central terminó. Sigo aquí si necesitas algo más.', 'talk');
    return { success: true, message: 'Enlace cerrado.' };
  }

  /**
   * Motor del enlace: mira las llamadas de la instancia y reacciona. Corre
   * después de cada refresco y, mientras hay algo vivo, cada par de segundos.
   */
  let driving = false;
  async function driveLink() {
    if (driving) return;
    driving = true;
    try { await driveLinkOnce(); } finally { driving = false; }
  }
  async function driveLinkOnce() {
    const calls = model.calls || [];
    const mine = model.link.callId ? calls.find((c) => c.id === model.link.callId) : null;

    // Quien llamó aplica la respuesta en cuanto aparece.
    if (mine && rtc.pc && model.link.state === 'calling' && mine.answer && !rtc.pc.currentRemoteDescription) {
      try {
        await rtc.pc.setRemoteDescription(JSON.parse(s(mine.answer)));
        setModel({ link: Object.assign({}, model.link, { state: 'active', since: Date.now() }) });
        if (isTotemWindow()) speak('Estás en contacto con la central de monitoreo.', 'talk');
      } catch (e) { void hangup('no se pudo abrir el canal'); }
    }
    // Si la otra punta colgó, se cierra de este lado.
    if (mine && mine.status === 'ended' && model.link.state !== 'idle') { closePeer(); setModel({ link: { state: 'idle', callId: '', role: '', since: 0, error: '', remote: false, mic: true, cam: true } }); }

    // El tótem atiende solo a la central si así está configurado (y lo avisa).
    if (model.link.state === 'idle' && isTotemWindow() && model.settings.autoAnswerCentral !== false) {
      const forMe = calls.find((c) => c.to === 'totem' && c.status === 'ringing' && ms(c.at, stamp()) < 60000);
      if (forMe) await answerLink(forMe);
    }
    // Modo "siempre en vivo": el tótem mantiene el enlace abierto.
    if (model.link.state === 'idle' && isTotemWindow() && model.settings.streamMode === 'always'
        && Date.now() - rtc.lastRequest > 30000 && !calls.some((c) => c.status === 'ringing' && c.from === winId)) {
      await requestLink({ to: 'central', reason: 'transmisión permanente' });
    }
    // Limpieza: las llamadas cerradas no se quedan como basura de señalización.
    for (const c of calls) {
      if (c.status === 'ended' && ms(c.endedAt || c.at, stamp()) > 900000) await removeRecord('calls', c.id);
    }
  }
  function pollLinkSoon() {
    if (rtc.pollTimer) clearTimeout(rtc.pollTimer);
    rtc.pollTimer = setTimeout(async () => {
      rtc.pollTimer = null;
      await refresh();
      await driveLink();
      if (model.link.state !== 'idle' || (model.calls || []).some((c) => c.status === 'ringing')) pollLinkSoon();
    }, 1800);
  }


  // ── Cloud Storage de KIMOS (archivos y documentos) ──────────────────────
  /**
   * Los archivos van al almacenamiento de la plataforma, no dentro del
   * documento de la instancia: el plan de emergencia, el reglamento, la foto de
   * una encomienda o la evidencia de un incidente pueden pesar megas y tienen
   * que poder abrirse desde cualquier consola.
   *
   * Subida:   POST {API}/api/v2/files   (multipart: path + file, con la sesión
   *           del usuario vía authFetch)
   * Lectura:  {API}/api/public/files/{path}
   *
   * Cada archivo deja además un registro sellado en la bitácora (quién lo
   * subió, cuándo, a qué incidente o unidad pertenece), así la cadena de
   * custodia incluye lo que se adjunta y no solo lo que se escribe.
   */
  const DOC_FOLDERS = [
    { id: 'evidencia', label: 'Evidencia de incidentes' },
    { id: 'emergencia', label: 'Plan de emergencia y protocolos' },
    { id: 'reglamento', label: 'Reglamento y actas' },
    { id: 'unidades', label: 'Documentos de unidades' },
    { id: 'encomiendas', label: 'Encomiendas' },
    { id: 'general', label: 'General' },
  ];
  const MAX_DOC_MB = 25;

  const storagePath = (name, folder) => {
    const safe = s(name || 'archivo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'archivo';
    return 'documentos/safe-concierge/' + (instanceId || 'sin-instancia') + '/'
      + (s(folder) || 'general') + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-' + safe;
  };

  /** Sube un archivo al Cloud Storage y devuelve su ruta y su URL de lectura. */
  async function uploadToStorage(file, folder) {
    if (!file) throw new Error('No hay archivo.');
    if (!shell.authFetch) throw new Error('Este host no expone authFetch: no se puede subir al almacenamiento.');
    const mb = num(file.size, 0) / 1048576;
    if (mb > MAX_DOC_MB) throw new Error('El archivo pesa ' + mb.toFixed(1) + ' MB y el máximo son ' + MAX_DOC_MB + ' MB.');
    const path = storagePath(file.name, folder);
    const fd = new FormData();
    fd.append('path', path);
    fd.append('file', file);
    const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(s(d.detail) || ('el almacenamiento respondió HTTP ' + res.status));
    }
    return { path, url: API + '/api/public/files/' + path, name: s(file.name), size: num(file.size, 0), type: s(file.type) };
  }

  /** Sube y deja el archivo registrado (y sellado) en la bitácora. */
  async function attachDoc(file, meta) {
    const m = meta || {};
    const up = await uploadToStorage(file, m.folder);
    const rec = await addRecord({
      kind: 'doc',
      name: up.name || 'archivo', path: up.path, url: up.url, size: up.size, mime: up.type,
      folder: s(m.folder) || 'general',
      note: s(m.note),
      incidentId: s(m.incidentId), unit: s(m.unit), parcelId: s(m.parcelId),
      uploadedBy: actorName(),
      at: stamp(),
      summary: 'Archivo ' + (up.name || up.path) + (m.incidentId ? ' · incidente ' + m.incidentId : '') + (m.unit ? ' · unidad ' + m.unit : ''),
    });
    // Si pertenece a un incidente, queda además en su propia hoja de evidencia.
    if (s(m.incidentId)) {
      const inc = model.incidents.find((i) => i.id === s(m.incidentId));
      if (inc) {
        await patchRecord('incidents', inc.id, {
          hold: true,
          evidence: (inc.evidence || []).concat([{ at: rec.at, note: 'Archivo adjunto: ' + rec.name, url: rec.url, docId: rec.id }]).slice(-40),
          actions: (inc.actions || []).concat([{ at: rec.at, what: 'Adjuntó ' + rec.name, by: actorName() }]),
        });
      }
    }
    return rec;
  }

  /**
   * Captura un cuadro de la cámara del tótem y lo guarda como evidencia. Es la
   * excepción explícita a "el video no sale del dispositivo": lo dispara una
   * persona (o un incidente ya validado), queda con su sello y su autor, y el
   * tótem lo anuncia en pantalla.
   */
  async function snapshotEvidence(incidentId, note) {
    if (!sensors.videoEl || !sensors.cam) return { success: false, error: 'La cámara del tótem no está encendida.' };
    try {
      const cv = document.createElement('canvas');
      cv.width = 640; cv.height = 480;
      cv.getContext('2d').drawImage(sensors.videoEl, 0, 0, cv.width, cv.height);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.82));
      if (!blob) return { success: false, error: 'El navegador no entregó la imagen.' };
      const name = 'evidencia-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
      const file = (typeof File === 'function') ? new File([blob], name, { type: 'image/jpeg' }) : blob;
      if (!file.name) file.name = name;
      const rec = await attachDoc(file, { folder: 'evidencia', incidentId: s(incidentId), note: s(note) || 'Captura de la cámara del tótem' });
      shell.notify({ level: 'success', text: 'Evidencia guardada en el almacenamiento.' });
      return { success: true, message: 'Evidencia guardada: ' + rec.name, doc: rec };
    } catch (e) {
      return { success: false, error: s((e && e.message) || e) };
    }
  }

  const docsFor = (kind, id) => (model.docs || []).filter((d) => (kind === 'incident' ? d.incidentId === id : kind === 'unit' ? d.unit === id : d.parcelId === id));
  const fmtSize = (b) => {
    const n = num(b, 0);
    return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  };
  const docIcon = (d) => {
    const t = s(d.mime) + ' ' + s(d.name);
    if (/image|\.jpe?g|\.png|\.webp|\.gif/i.test(t)) return '🖼️';
    if (/pdf/i.test(t)) return '📕';
    if (/video|\.mp4|\.webm/i.test(t)) return '🎬';
    if (/audio|\.mp3|\.wav|\.ogg/i.test(t)) return '🔊';
    if (/sheet|excel|\.csv|\.xlsx?/i.test(t)) return '📊';
    if (/word|\.docx?/i.test(t)) return '📄';
    return '📎';
  };

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
    const mttv = avg(inc.map((i) => (i.review && i.review.at ? ms(i.openedAt, i.review.at) : null))
      .filter((v) => v != null && v >= 0));
    return {
      pendingReview: inc.filter((i) => i.review && i.review.status === 'pending').length,
      dismissed: inc.filter((i) => i.review && i.review.status === 'dismissed').length,
      mttv,
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
    const busyLink = model.link.state !== 'idle' || (model.calls || []).some((c) => c.status === 'ringing');
    const wait = busyLink ? 2500 : hidden ? 90000 : focused ? SYNC_MS : SYNC_MS * 2;
    syncTimer = setTimeout(async () => {
      if (syncSubs > 0 && !(typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
        await refresh();
        await driveLink();
      }
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
    { name: 'APPROVE_INCIDENT', description: 'Validación humana: la central confirma que la alerta corresponde. Requiere el nombre de quien la revisó. Sin esto no se puede escalar a ningún servicio.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, reviewedBy: { type: 'string' }, note: { type: 'string' } }, required: ['id', 'reviewedBy'] } },
    { name: 'DISMISS_INCIDENT', description: 'Validación humana: la central descarta la alerta (no corresponde, falso positivo). Requiere quién la revisó.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, reviewedBy: { type: 'string' }, note: { type: 'string' } }, required: ['id', 'reviewedBy'] } },
    { name: 'CLOSE_INCIDENT', description: 'Cierra un incidente con su resultado (por ejemplo "falso-positivo").', inputSchema: { type: 'object', properties: { id: { type: 'string' }, outcome: { type: 'string' } }, required: ['id'] } },
    { name: 'OPEN_LINK', description: 'Abre audio y video en vivo entre el tótem y la central de monitoreo. destino: "central" (desde el tótem) o "totem" (la central mira el acceso).',
      inputSchema: { type: 'object', properties: { to: { type: 'string' }, reason: { type: 'string' }, incidentId: { type: 'string' } } } },
    { name: 'ANSWER_LINK', description: 'Atiende el enlace en vivo que está esperando.', inputSchema: { type: 'object', properties: { id: { type: 'string' } } } },
    { name: 'END_LINK', description: 'Cierra el enlace en vivo con la central.', inputSchema: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'SNAPSHOT', description: 'Guarda en el almacenamiento una captura de la cámara del tótem como evidencia, opcionalmente ligada a un incidente.',
      inputSchema: { type: 'object', properties: { incidentId: { type: 'string' }, note: { type: 'string' } } } },
    { name: 'LIST_DOCS', description: 'Lista los archivos guardados en el Cloud Storage de esta instancia (plan de emergencia, reglamento, evidencia, documentos de unidades).',
      inputSchema: { type: 'object', properties: { folder: { type: 'string' }, incidentId: { type: 'string' }, limit: { type: 'number' } } } },
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
    APROBAR: 'APPROVE_INCIDENT', VALIDAR: 'APPROVE_INCIDENT', DESCARTAR: 'DISMISS_INCIDENT',
    ABRIR_ENLACE: 'OPEN_LINK', ATENDER: 'ANSWER_LINK', COLGAR: 'END_LINK',
    CAPTURA: 'SNAPSHOT', LISTAR_ARCHIVOS: 'LIST_DOCS',
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
          enlaceEnVivo: {
            estado: model.link.state, rol: model.link.role || null,
            esperando: (model.calls || []).filter((c) => c.status === 'ringing').map((c) => ({ id: c.id, hacia: c.to, motivo: c.reason })),
            modoTransmision: model.settings.streamMode,
          },
          validacionHumana: {
            activa: model.settings.centralApproval !== false,
            pendientes: model.incidents.filter((i) => i.review && i.review.status === 'pending')
              .map((i) => ({ id: i.id, evento: i.typeLabel, nivel: i.level, abierto: i.openedAt })),
          },
          archivos: (model.docs || []).slice(0, 20).map((d) => ({ id: d.id, nombre: d.name, carpeta: d.folder, url: d.url, incidente: d.incidentId || null })),
          niveles: LEVELS.map((l) => l.n + ' ' + l.label),
          tiposDeEvento: RISK_TYPES.map((t) => t.id),
          canales: model.channels.map((c) => ({ id: c.id, nombre: c.name, telefono: c.phone || null })),
          incidentesAbiertos: model.incidents.filter((i) => i.status !== 'closed').slice(0, 25).map((i) => ({
            id: i.id, tipo: i.type, evento: i.typeLabel, nivel: i.level, puntaje: i.score,
            confianza: Math.round(num(i.confidence, 0) * 100) + '%',
            estado: i.status, validacion: (i.review && i.review.status) || 'approved',
            validadaPor: (i.review && i.review.by) || null,
            abierto: i.openedAt, ubicacion: i.camera || null, unidad: i.unit || null,
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
          if (type === 'APPROVE_INCIDENT' || type === 'DISMISS_INCIDENT') {
            const i = resolveIncident(p.id);
            if (!i) return { success: false, error: 'No encuentro ese incidente.' };
            const by = s(p.reviewedBy || p.by).trim();
            if (!by) return { success: false, error: 'Falta el nombre de quien revisó la alerta: la validación es de una persona de la central, no del sistema.' };
            return type === 'APPROVE_INCIDENT' ? await approveIncident(i.id, by, p.note) : await dismissIncident(i.id, by, p.note);
          }
          if (type === 'CLOSE_INCIDENT') { const i = resolveIncident(p.id); return i ? await closeIncident(i.id, p.outcome) : { success: false, error: 'No encuentro ese incidente.' }; }
          if (type === 'OPEN_LINK') return await requestLink({ to: s(p.to) === 'totem' ? 'totem' : 'central', reason: s(p.reason), incidentId: s(p.incidentId) });
          if (type === 'ANSWER_LINK') {
            const call = (model.calls || []).find((c) => c.id === s(p.id) && c.status === 'ringing')
              || (model.calls || []).find((c) => c.status === 'ringing');
            if (!call) return { success: false, error: 'No hay ningún enlace esperando.' };
            return await answerLink(call);
          }
          if (type === 'END_LINK') {
            if (model.link.state === 'idle') return { success: false, error: 'No hay enlace abierto.' };
            return await hangup(s(p.reason) || 'cerrado desde el agente');
          }
          if (type === 'SNAPSHOT') return await snapshotEvidence(s(p.incidentId), s(p.note));
          if (type === 'LIST_DOCS') {
            await refresh();
            let list = model.docs || [];
            if (s(p.folder)) list = list.filter((d) => d.folder === s(p.folder));
            if (s(p.incidentId)) list = list.filter((d) => d.incidentId === s(p.incidentId));
            list = list.slice(0, clamp(num(p.limit, 20), 1, 60));
            if (!list.length) return { success: true, message: 'No hay archivos con ese filtro.' };
            return { success: true, message: list.map((d) => d.name + ' · ' + fmtSize(d.size) + ' · ' + s(d.folder)
              + ' · subido por ' + s(d.uploadedBy) + ' · ' + s(d.url)).join('\n') };
          }
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
    { id: 'central', label: 'Central', icon: '📡' },
    { id: 'incidents', label: 'Incidentes', icon: '🚨' },
    { id: 'access', label: 'Accesos', icon: '🚪' },
    { id: 'parcels', label: 'Encomiendas', icon: '📦' },
    { id: 'directory', label: 'Directorio', icon: '🏠' },
    { id: 'docs', label: 'Documentos', icon: '📁' },
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

  // ── El conserje virtual ─────────────────────────────────────────────────
  /**
   * Aspecto por defecto: "Denzel Barrett", oficial de seguridad. Todo esto es
   * editable desde el Estudio del avatar (pestaña Panel) y se guarda con la
   * instancia, así que cada comunidad puede tener el suyo.
   */
  const AVATAR_DEFAULT = {
    name: 'Denzel Barrett',
    style: 'officer',        // officer | human | cartoon | minimal
    skin: '#8A5A3B',
    hair: '#17120F',
    beard: 'short',          // none | short | full
    cap: true,
    uniform: '#1B2A3D',
    trim: '#0EA5E9',         // galones, insignia y vivos del uniforme
    eyes: '#3A2A20',
    build: 1,                // porte: 0.9 discreto · 1.15 imponente
    badge: 'DB',
  };
  const avatarOf = () => {
    const a = Object.assign({}, AVATAR_DEFAULT, model.avatar || {});
    // ⚙️ Configurar siembra nombre y estilo mientras el Estudio no los toque.
    if (!(model.avatar && model.avatar.name) && s(model.settings.avatarName)) a.name = s(model.settings.avatarName);
    if (!(model.avatar && model.avatar.style) && s(model.settings.avatarStyle)) a.style = s(model.settings.avatarStyle);
    return a;
  };

  /** Aclara u oscurece un color hex: sombras y luces salen del mismo tono. */
  function shade(hex, amount) {
    const m = /^#?([0-9a-f]{6})$/i.exec(s(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const mix = (c) => clamp(Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)), 0, 255);
    return '#' + [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
      .map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Avatar del tótem. Un retrato SVG por capas —volumen por degradados,
   * sombra propia bajo el mentón, luz de contorno y especulares— con vida
   * propia: parpadeo, respiración, micro-balanceo de cabeza, boca sincronizada
   * al habla y **mirada que sigue a la persona** (el centro de movimiento que
   * ya calcula el sensor de la cámara). Nada de esto pesa: son transformaciones
   * sobre un puñado de nodos.
   */
  function Avatar(props) {
    const a = props.look || AVATAR_DEFAULT;
    const style = s(a.style) || 'officer';
    const speaking = !!props.speaking;
    const alert = props.mood === 'alert';
    const uid2 = s(props.idSuffix) || 'a';
    const [blink, setBlink] = useState(false);
    const [phase, setPhase] = useState(0);
    const [tick, setTick] = useState(0);
    const [gaze, setGaze] = useState({ x: 0, y: 0 });

    // Parpadeo espontáneo.
    useEffect(() => {
      let alive = true;
      let t = null;
      const loop = () => {
        if (!alive) return;
        t = setTimeout(() => {
          setBlink(true);
          setTimeout(() => { if (alive) setBlink(false); }, 110);
          loop();
        }, 2400 + Math.random() * 3600);
      };
      loop();
      return () => { alive = false; if (t) clearTimeout(t); };
    }, []);

    // Boca: cuatro aperturas encadenadas mientras habla.
    useEffect(() => {
      if (!speaking) { setPhase(0); return undefined; }
      const t = setInterval(() => setPhase((p) => (p + 1) % 4), 105);
      return () => clearInterval(t);
    }, [speaking]);

    // Respiración, balanceo y mirada. Un solo temporizador para todo.
    useEffect(() => {
      const t = setInterval(() => {
        setTick((k) => k + 1);
        const f = props.focus;
        if (f && f.at && Date.now() - f.at < 2500) {
          // La cámara ve a alguien: la mirada va hacia ahí (el espejo invierte
          // la imagen, así que la coordenada también).
          setGaze({ x: clamp(-num(f.x, 0), -1, 1), y: clamp(num(f.y, 0), -1, 1) });
        } else {
          const w = Date.now() / 2600;
          setGaze({ x: Math.sin(w) * 0.35, y: Math.sin(w * 0.7) * 0.2 });
        }
      }, 140);
      return () => clearInterval(t);
    }, [props.focus]);

    const breathe = Math.sin(tick / 11) * 1.6;
    const sway = Math.sin(tick / 17) * 0.6 + gaze.x * 1.6;
    const gx = gaze.x * 4.2;
    const gy = gaze.y * 2.6;
    const build = clamp(num(a.build, 1), 0.85, 1.2);

    // Estilos heredados: siguen disponibles para quien no quiera un oficial.
    if (style === 'minimal') {
      const ring = alert ? 'var(--sc-err)' : 'var(--sc-accent)';
      return h('svg', { className: 'sc-avatar', viewBox: '0 0 320 400', 'aria-hidden': 'true' },
        h('defs', null, h('radialGradient', { id: 'orb' + uid2, cx: '40%', cy: '35%' },
          h('stop', { offset: '0%', stopColor: ring, stopOpacity: '0.95' }),
          h('stop', { offset: '100%', stopColor: ring, stopOpacity: '0.2' }))),
        h('circle', { cx: 160, cy: 190, r: 86, fill: 'url(#orb' + uid2 + ')' }),
        [0, 1, 2].map((i) => h('circle', {
          key: i, cx: 160, cy: 190, r: 98 + i * 20 + (speaking ? [0, 6, 3, 9][phase] : 0),
          fill: 'none', stroke: ring, strokeOpacity: 0.26 - i * 0.07, strokeWidth: 2.5,
        })));
    }

    const cartoon = style === 'cartoon';
    const skin = s(a.skin) || AVATAR_DEFAULT.skin;
    const skinHi = shade(skin, cartoon ? 0.34 : 0.24);
    const skinLo = shade(skin, -0.28);
    const hair = s(a.hair) || AVATAR_DEFAULT.hair;
    const uniform = s(a.uniform) || AVATAR_DEFAULT.uniform;
    const uniHi = shade(uniform, 0.16);
    const uniLo = shade(uniform, -0.3);
    const trim = alert ? '#F87171' : (s(a.trim) || AVATAR_DEFAULT.trim);
    const officer = style === 'officer';
    const beard = officer || style === 'human' ? s(a.beard) : 'none';
    const cap = officer && a.cap !== false;
    const eyeR = cartoon ? 8.5 : 7.4;
    const mouthOpen = speaking ? [3, 12, 7, 15][phase] : (alert ? 4 : 2.5);

    return h('svg', { className: 'sc-avatar', viewBox: '0 0 320 400', 'aria-hidden': 'true' },
      h('defs', null,
        h('radialGradient', { id: 'skin' + uid2, cx: '38%', cy: '28%', r: '78%' },
          h('stop', { offset: '0%', stopColor: skinHi }),
          h('stop', { offset: '62%', stopColor: skin }),
          h('stop', { offset: '100%', stopColor: skinLo })),
        h('linearGradient', { id: 'uni' + uid2, x1: '0', y1: '0', x2: '0.35', y2: '1' },
          h('stop', { offset: '0%', stopColor: uniHi }),
          h('stop', { offset: '55%', stopColor: uniform }),
          h('stop', { offset: '100%', stopColor: uniLo })),
        h('linearGradient', { id: 'cap' + uid2, x1: '0.1', y1: '0', x2: '0.9', y2: '1' },
          h('stop', { offset: '0%', stopColor: shade(uniform, 0.22) }),
          h('stop', { offset: '100%', stopColor: shade(uniform, -0.35) })),
        h('radialGradient', { id: 'iris' + uid2, cx: '40%', cy: '35%' },
          h('stop', { offset: '0%', stopColor: shade(s(a.eyes) || '#3A2A20', 0.45) }),
          h('stop', { offset: '100%', stopColor: shade(s(a.eyes) || '#3A2A20', -0.35) })),
        h('filter', { id: 'soft' + uid2, x: '-40%', y: '-40%', width: '180%', height: '180%' },
          h('feGaussianBlur', { stdDeviation: '5' })),
        h('filter', { id: 'tiny' + uid2, x: '-40%', y: '-40%', width: '180%', height: '180%' },
          h('feGaussianBlur', { stdDeviation: '1.6' })),
        h('clipPath', { id: 'eyeL' + uid2 }, h('ellipse', { cx: 126, cy: 176, rx: 17, ry: cartoon ? 12 : 9.6 })),
        h('clipPath', { id: 'eyeR' + uid2 }, h('ellipse', { cx: 194, cy: 176, rx: 17, ry: cartoon ? 12 : 9.6 })),
        h('clipPath', { id: 'head' + uid2 }, h('path', {
          d: 'M84 168C84 108 112 70 160 70C208 70 236 108 236 168C236 202 229 232 214 256C199 280 181 296 160 296C139 296 121 280 106 256C91 232 84 202 84 168Z',
        })),
      ),

      // Halo del estado: verde en calma, rojo cuando hay una alerta viva.
      h('ellipse', {
        cx: 160, cy: 214, rx: 128, ry: 138, fill: alert ? '#F87171' : trim,
        opacity: speaking ? 0.16 : 0.09, filter: 'url(#soft' + uid2 + ')',
      }),

      h('g', { transform: 'translate(160 400) scale(' + build.toFixed(3) + ') translate(-160 -400)' },
        // ── Torso y uniforme ────────────────────────────────────────────
        h('g', { transform: 'translate(0 ' + (breathe * 0.5).toFixed(2) + ')' },
          h('path', {
            d: 'M8 400C8 344 52 312 108 298L160 288L212 298C268 312 312 344 312 400Z',
            fill: 'url(#uni' + uid2 + ')',
          }),
          // Solapas y camisa
          h('path', { d: 'M126 292L160 340L194 292L212 298L196 400H124L108 298Z', fill: shade(uniform, -0.16) }),
          h('path', { d: 'M160 300L136 336L160 400L184 336Z', fill: shade(uniform, 0.3), opacity: 0.85 }),
          // Charreteras con galones
          h('path', { d: 'M40 356C58 330 84 312 110 302L124 330C98 340 74 356 58 378Z', fill: shade(uniform, 0.12) }),
          h('path', { d: 'M280 356C262 330 236 312 210 302L196 330C222 340 246 356 262 378Z', fill: shade(uniform, 0.12) }),
          [0, 1].map((i) => h('rect', { key: 'gl' + i, x: 62 + i * 14, y: 344 - i * 8, width: 26, height: 5, rx: 2.5, fill: trim, transform: 'rotate(-32 75 346)' })),
          [0, 1].map((i) => h('rect', { key: 'gr' + i, x: 232 - i * 14, y: 344 - i * 8, width: 26, height: 5, rx: 2.5, fill: trim, transform: 'rotate(32 245 346)' })),
          // Placa e identificación
          h('path', { d: 'M96 348L124 342L128 368C128 380 118 388 110 392C102 388 92 380 92 368Z', fill: trim, opacity: 0.92 }),
          h('text', {
            x: 110, y: 372, textAnchor: 'middle', fontSize: 15, fontWeight: 700,
            fill: shade(uniform, -0.4), fontFamily: 'Inter, system-ui, sans-serif',
          }, s(a.badge || '').slice(0, 2).toUpperCase() || 'DB'),
          h('rect', { x: 196, y: 352, width: 74, height: 15, rx: 3, fill: shade(uniform, -0.42) }),
          h('text', {
            x: 233, y: 363.5, textAnchor: 'middle', fontSize: 10, letterSpacing: '0.06em',
            fill: shade(uniform, 0.55), fontFamily: 'Inter, system-ui, sans-serif',
          }, s(a.name).split(' ').slice(-1)[0].slice(0, 10).toUpperCase() || 'SEGURIDAD'),
        ),

        // ── Cabeza ──────────────────────────────────────────────────────
        h('g', { transform: 'rotate(' + sway.toFixed(2) + ' 160 300) translate(0 ' + (breathe * 0.3).toFixed(2) + ')' },
          // Cuello y su sombra
          h('path', { d: 'M132 250H188V300C188 314 176 322 160 322C144 322 132 314 132 250Z', fill: shade(skin, -0.22) }),
          h('ellipse', { cx: 160, cy: 268, rx: 44, ry: 16, fill: '#000', opacity: 0.28, filter: 'url(#soft' + uid2 + ')' }),
          // Orejas
          h('ellipse', { cx: 84, cy: 186, rx: 12, ry: 20, fill: shade(skin, -0.1) }),
          h('ellipse', { cx: 236, cy: 186, rx: 12, ry: 20, fill: shade(skin, -0.1) }),
          // Rostro
          h('path', {
            d: 'M84 168C84 108 112 70 160 70C208 70 236 108 236 168C236 202 229 232 214 256C199 280 181 296 160 296C139 296 121 280 106 256C91 232 84 202 84 168Z',
            fill: 'url(#skin' + uid2 + ')',
          }),
          // Volumen: pómulos, sien y luz de contorno
          h('g', { clipPath: 'url(#head' + uid2 + ')' },
            h('ellipse', { cx: 104, cy: 214, rx: 26, ry: 34, fill: skinLo, opacity: 0.34, filter: 'url(#soft' + uid2 + ')' }),
            h('ellipse', { cx: 216, cy: 214, rx: 26, ry: 34, fill: skinLo, opacity: 0.34, filter: 'url(#soft' + uid2 + ')' }),
            h('path', { d: 'M228 120C240 160 238 214 220 256L244 256V110Z', fill: '#fff', opacity: 0.16, filter: 'url(#soft' + uid2 + ')' }),
            h('ellipse', { cx: 128, cy: 128, rx: 34, ry: 26, fill: '#fff', opacity: 0.12, filter: 'url(#soft' + uid2 + ')' }),
            beard && beard !== 'none' ? h('path', {
              d: beard === 'full'
                ? 'M92 178C92 250 118 296 160 296C202 296 228 250 228 178C228 232 202 258 160 258C118 258 92 232 92 178Z'
                : 'M104 216C110 262 130 296 160 296C190 296 210 262 216 216C206 250 186 264 160 264C134 264 114 250 104 216Z',
              fill: hair, opacity: 0.9,
            }) : null,
            beard && beard !== 'none' ? h('path', {
              d: 'M132 224C142 218 178 218 188 224C180 232 172 234 160 234C148 234 140 232 132 224Z', fill: hair, opacity: 0.92,
            }) : null,
          ),
          // Pelo (cuando no hay gorra)
          !cap ? h('path', {
            d: cartoon
              ? 'M80 154C82 96 116 62 160 62C204 62 238 96 240 154C224 122 198 106 160 106C122 106 96 122 80 154Z'
              : 'M84 150C88 100 118 68 160 68C202 68 232 100 236 150C222 116 196 100 160 100C124 100 98 116 84 150Z',
            fill: hair,
          }) : null,

          // ── Ojos ──────────────────────────────────────────────────────
          h('g', null,
            h('path', { d: 'M104 148C116 138 138 136 150 144', stroke: hair, strokeWidth: alert ? 8 : 7, strokeLinecap: 'round', fill: 'none', transform: alert ? 'rotate(-7 127 142)' : '' }),
            h('path', { d: 'M216 148C204 138 182 136 170 144', stroke: hair, strokeWidth: alert ? 8 : 7, strokeLinecap: 'round', fill: 'none', transform: alert ? 'rotate(7 193 142)' : '' }),
            ['L', 'R'].map((side) => {
              const cx = side === 'L' ? 126 : 194;
              return h('g', { key: side, clipPath: 'url(#eye' + side + uid2 + ')' },
                h('ellipse', { cx, cy: 176, rx: 17, ry: cartoon ? 12 : 9.6, fill: '#F6F1EA' }),
                h('ellipse', { cx: cx - 6, cy: 176, rx: 8, ry: 10, fill: '#000', opacity: 0.1, filter: 'url(#tiny' + uid2 + ')' }),
                h('g', { transform: 'translate(' + gx.toFixed(2) + ' ' + gy.toFixed(2) + ')' },
                  h('circle', { cx, cy: 176, r: eyeR, fill: 'url(#iris' + uid2 + ')' }),
                  h('circle', { cx, cy: 176, r: eyeR * 0.45, fill: '#0B0906' }),
                  h('circle', { cx: cx - eyeR * 0.42, cy: 172.4, r: cartoon ? 3.1 : 2.4, fill: '#fff', opacity: 0.92 }),
                  h('circle', { cx: cx + eyeR * 0.36, cy: 179.6, r: 1.3, fill: '#fff', opacity: 0.45 })),
                // Párpado: baja del todo al parpadear.
                h('rect', {
                  x: cx - 19, y: blink ? 164 : 143, width: 38, height: 26, fill: skin,
                  style: { transition: 'y .07s linear' },
                }),
                h('path', { d: 'M' + (cx - 17) + ' 168C' + (cx - 8) + ' 161 ' + (cx + 8) + ' 161 ' + (cx + 17) + ' 168', stroke: shade(skin, -0.35), strokeWidth: 1.6, fill: 'none', opacity: 0.7 }),
                h('path', { d: 'M' + (cx - 15) + ' 186C' + (cx - 6) + ' 190 ' + (cx + 6) + ' 190 ' + (cx + 15) + ' 186', stroke: shade(skin, -0.3), strokeWidth: 1.3, fill: 'none', opacity: 0.5 }),
              );
            }),
          ),

          // ── Nariz y boca ──────────────────────────────────────────────
          h('path', { d: 'M158 178C154 196 146 208 140 214C146 220 156 222 160 222C164 222 174 220 180 214C174 208 166 196 162 178Z', fill: skinLo, opacity: 0.3, filter: 'url(#tiny' + uid2 + ')' }),
          h('path', { d: 'M142 214C148 210 172 210 178 214', stroke: shade(skin, -0.4), strokeWidth: 1.5, fill: 'none', opacity: 0.55 }),
          h('ellipse', { cx: 147, cy: 214, rx: 3.2, ry: 2.1, fill: shade(skin, -0.55), opacity: 0.75 }),
          h('ellipse', { cx: 173, cy: 214, rx: 3.2, ry: 2.1, fill: shade(skin, -0.55), opacity: 0.75 }),
          h('ellipse', { cx: 152, cy: 200, rx: 5, ry: 7, fill: '#fff', opacity: 0.18, filter: 'url(#tiny' + uid2 + ')' }),
          h('g', null,
            h('path', {
              d: 'M132 240C142 232 178 232 188 240C178 248 142 248 132 240Z',
              fill: shade(skin, -0.42), opacity: 0.9,
            }),
            h('ellipse', { cx: 160, cy: 241, rx: speaking ? 17 : 14, ry: mouthOpen, fill: '#3A1D1D' }),
            mouthOpen > 6 ? h('ellipse', { cx: 160, cy: 236 + mouthOpen * 0.1, rx: 11, ry: 2.6, fill: '#F4EDE7', opacity: 0.85 }) : null,
            h('path', { d: 'M134 252C144 258 176 258 186 252', stroke: shade(skin, -0.34), strokeWidth: 1.4, fill: 'none', opacity: 0.6 }),
          ),

          // ── Gorra ─────────────────────────────────────────────────────
          cap ? h('g', null,
            h('path', { d: 'M76 132C80 88 112 56 160 56C208 56 240 88 244 132C226 118 198 108 160 108C122 108 94 118 76 132Z', fill: 'url(#cap' + uid2 + ')' }),
            h('path', { d: 'M74 130H246V152H74Z', fill: shade(uniform, -0.5) }),
            h('path', { d: 'M62 152C62 168 100 180 160 180C220 180 258 168 258 152C258 146 220 144 160 144C100 144 62 146 62 152Z', fill: shade(uniform, -0.62) }),
            h('path', { d: 'M62 152C62 162 100 172 160 172C220 172 258 162 258 152', stroke: '#fff', strokeOpacity: 0.14, strokeWidth: 3, fill: 'none' }),
            h('path', { d: 'M148 108L160 84L172 108C168 116 152 116 148 108Z', fill: trim }),
            h('rect', { x: 116, y: 132, width: 88, height: 18, rx: 3, fill: shade(uniform, -0.68) }),
            h('circle', { cx: 160, cy: 141, r: 6.5, fill: trim, opacity: 0.95 }),
          ) : null,
        ),
      ),

      // Aro de "en línea": late suave al hablar.
      h('ellipse', {
        cx: 160, cy: 216, rx: 130, ry: 142, fill: 'none',
        stroke: alert ? '#F87171' : trim, strokeOpacity: speaking ? 0.5 : 0.2,
        strokeWidth: speaking ? 3 : 2,
      }),
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

  /**
   * Estudio del avatar: el conserje virtual es 100% editable —nombre, estilo,
   * piel, pelo, barba, gorra, uniforme, vivos, porte e insignia— con la vista
   * previa al lado. Se guarda con la instancia, así que cada comunidad tiene el
   * suyo y todas las consolas lo ven igual.
   */
  function AvatarStudio(props) {
    const m = props.m;
    const [draft, setDraft] = useState(avatarOf());
    const [open, setOpen] = useState(false);
    const set = (k, v) => setDraft((d) => Object.assign({}, d, { [k]: v }));
    useEffect(() => { setDraft(avatarOf()); }, [m.avatar]);
    const PRESETS = [
      { label: 'Denzel Barrett', look: Object.assign({}, AVATAR_DEFAULT) },
      { label: 'Oficial de noche', look: Object.assign({}, AVATAR_DEFAULT, { name: 'Marco Silva', uniform: '#111827', trim: '#F59E0B', beard: 'full', skin: '#6B4230' }) },
      { label: 'Recepción corporativa', look: Object.assign({}, AVATAR_DEFAULT, { name: 'Elena Ruiz', cap: false, beard: 'none', uniform: '#334155', trim: '#22D3EE', hair: '#2B1B12', skin: '#D9A87E' }) },
      { label: 'Caricatura amable', look: Object.assign({}, AVATAR_DEFAULT, { name: 'Kimo', style: 'cartoon', cap: false, beard: 'none', trim: '#19ACB1' }) },
    ];
    const save = () => {
      const next = Object.assign({}, AVATAR_DEFAULT, draft);
      setModel({ avatar: next });
      scheduleDefinition({ avatar: next });
      shell.notify({ level: 'success', text: 'Conserje virtual actualizado: ' + next.name + '.' });
    };

    return h('section', { className: 'sc-card' },
      h('h3', null, '🎨 Conserje virtual',
        h('span', { className: 'sc-chip' }, s(draft.name)),
        h('span', { className: 'sc-spacer' }),
        btn({ onClick: () => setOpen(!open) }, open ? 'Cerrar estudio' : 'Editar aspecto')),
      h('div', { className: 'sc-studio' },
        h('div', { className: 'sc-studio-prev' },
          h(Avatar, { look: draft, idSuffix: 'std', speaking: m.face.speaking, mood: m.face.mood, focus: m.sensor.focus }),
          h('div', { className: 'sc-row' },
            btn({ onClick: () => speak('Buenas tardes. Soy ' + s(draft.name) + ', del equipo de seguridad. ¿En qué puedo ayudarte?', 'talk') }, '🔊 Probar voz'),
            open ? btn({ className: 'sc-btn sc-btn-primary', onClick: save }, 'Guardar') : null)),
        open ? h('div', { className: 'sc-studio-form' },
          h('div', { className: 'sc-form-grid' },
            field('Nombre', h('input', { className: 'sc-input', value: s(draft.name), onChange: (e) => set('name', e.target.value) })),
            field('Estilo', h('select', { className: 'sc-input', value: s(draft.style), onChange: (e) => set('style', e.target.value) },
              h('option', { value: 'officer' }, 'Oficial de seguridad (3D)'),
              h('option', { value: 'human' }, 'Humano sin uniforme'),
              h('option', { value: 'cartoon' }, 'Caricaturizado'),
              h('option', { value: 'minimal' }, 'Abstracto (sin rostro)'))),
            field('Piel', h('input', { className: 'sc-input sc-color', type: 'color', value: s(draft.skin), onChange: (e) => set('skin', e.target.value) })),
            field('Pelo', h('input', { className: 'sc-input sc-color', type: 'color', value: s(draft.hair), onChange: (e) => set('hair', e.target.value) })),
            field('Ojos', h('input', { className: 'sc-input sc-color', type: 'color', value: s(draft.eyes), onChange: (e) => set('eyes', e.target.value) })),
            field('Uniforme', h('input', { className: 'sc-input sc-color', type: 'color', value: s(draft.uniform), onChange: (e) => set('uniform', e.target.value) })),
            field('Vivos e insignia', h('input', { className: 'sc-input sc-color', type: 'color', value: s(draft.trim), onChange: (e) => set('trim', e.target.value) })),
            field('Barba', h('select', { className: 'sc-input', value: s(draft.beard), onChange: (e) => set('beard', e.target.value) },
              h('option', { value: 'none' }, 'Sin barba'),
              h('option', { value: 'short' }, 'Corta'),
              h('option', { value: 'full' }, 'Cerrada'))),
            field('Iniciales de la placa', h('input', { className: 'sc-input', maxLength: 2, value: s(draft.badge), onChange: (e) => set('badge', e.target.value.toUpperCase()) })),
            field('Porte', h('input', {
              className: 'sc-input', type: 'range', min: 0.9, max: 1.2, step: 0.01,
              value: num(draft.build, 1), onChange: (e) => set('build', Number(e.target.value)),
            }), 'Más alto = más imponente en pantalla'),
          ),
          h('label', { className: 'sc-switch' },
            h('input', { type: 'checkbox', checked: draft.cap !== false, onChange: (e) => set('cap', e.target.checked) }),
            h('span', null, 'Con gorra de servicio')),
          h('div', { className: 'sc-row sc-row-wrap' },
            PRESETS.map((p) => btn({ key: p.label, onClick: () => setDraft(p.look) }, p.label))),
          h('div', { className: 'sc-row' },
            btn({ className: 'sc-btn sc-btn-primary', onClick: save }, 'Guardar conserje'),
            btn({ onClick: () => setDraft(avatarOf()) }, 'Descartar cambios'),
            btn({ className: 'sc-btn sc-btn-no', onClick: () => { setModel({ avatar: null }); scheduleDefinition({ avatar: null }); setDraft(AVATAR_DEFAULT); } }, 'Volver al original')),
          h('p', { className: 'sc-note' }, 'El nombre y el aspecto viajan con la instancia: si tienes dos accesos, cada uno puede tener '
            + 'su propio conserje. ⚙️ Configurar solo siembra el nombre y el estilo iniciales; lo que se guarda aquí manda.'),
        ) : null,
      ),
    );
  }

  // ── Vista: centro de operaciones ────────────────────────────────────────
  function Panel(props) {
    const m = props.m;
    const k = kpis();
    const open = m.incidents.filter((i) => i.status !== 'closed').slice(0, 6);
    const pending = m.accesses.filter((a) => a.status === 'pending');
    const tiles = [
      { k: 'Esperando validación', v: k.pendingReview, sub: 'la central decide', tone: k.pendingReview ? 'warn' : 'ok' },
      { k: 'Incidentes abiertos', v: k.open, sub: k.critical + ' críticos', tone: k.critical ? 'err' : k.open ? 'warn' : 'ok' },
      { k: 'Accesos hoy', v: k.todayAccess, sub: k.pending + ' esperando decisión', tone: k.pending ? 'warn' : 'ok' },
      { k: 'Encomiendas', v: k.parcels, sub: 'por retirar', tone: 'ok' },
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
            h('tr', null, h('td', null, 'Registro → validación de la central'), h('td', null, k.mttv == null ? '—' : fmtDur(k.mttv))),
            h('tr', null, h('td', null, 'Registro → primera acción (MTTR)'), h('td', null, k.mttr == null ? '—' : fmtDur(k.mttr))),
            h('tr', null, h('td', null, 'Incidentes cerrados'), h('td', null, String(k.closed))),
            h('tr', null, h('td', null, 'Cerrados como falso positivo'), h('td', null, String(k.falsePositives))),
          )),
          h('p', { className: 'sc-note' }, 'Estos tres tiempos son los que hay que mostrar en un piloto: '
            + 'no basta con que la detección funcione, tiene que acortar la respuesta.'),
        ),
      ),

      h(AvatarStudio, { m }),

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
    const look = avatarOf();
    const live = m.link.state === 'active';
    const connecting = m.link.state === 'calling' || m.link.state === 'connecting';
    const [unitQ, setUnitQ] = useState('');
    const [who, setWho] = useState('');
    const [pin, setPin] = useState('');
    const [carrier, setCarrier] = useState('');
    const [pickCode, setPickCode] = useState('');
    const [kb, setKb] = useState({ open: false, target: '', mode: 'abc', shift: true });
    const [clock, setClock] = useState(new Date());
    useEffect(() => {
      const c = setInterval(() => setClock(new Date()), 20000);
      return () => clearInterval(c);
    }, []);
    const matches = useMemo(() => {
      const c = canon(unitQ);
      if (!c) return m.units.slice(0, 8);
      return m.units.filter((u) => canon(u.code).includes(c) || canon(u.name).includes(c) || canon(u.tower).includes(c)).slice(0, 10);
    }, [unitQ, m.units]);

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

    /** Botón grande del menú: ícono en disco, título y una línea de ayuda. */
    const bigBtn = (icon, title, hint, onClick, cls) => btn({
      className: 'sc-tot-b' + (cls ? ' ' + cls : ''), onClick,
    }, h('span', { className: 'sc-tot-b-ic' }, icon),
       h('span', { className: 'sc-tot-b-tx' }, h('strong', null, title), hint ? h('span', null, hint) : null));

    const home = h('div', { className: 'sc-tot-menu' },
      bigBtn('🚶', 'Vengo de visita', 'Aviso a la unidad y espero su respuesta',
        () => totemGo('visit', {}, '¿A qué unidad vienes? Puedes escribir el número o tocarlo en la lista.')),
      bigBtn('🔑', 'Soy residente', 'Ingreso con el código de mi unidad',
        () => totemGo('resident', {}, 'Escribe tu unidad y tu código de ingreso.')),
      bigBtn('📞', 'Llamar a una unidad', 'Citofonía desde el tótem',
        () => totemGo('call', {}, '¿A qué unidad quieres llamar?')),
      bigBtn('📦', 'Dejar una encomienda', 'Se registra y avisamos a la unidad',
        () => totemGo('parcel', {}, 'Indica la unidad de destino de la encomienda.')),
      bigBtn('🎁', 'Retirar una encomienda', 'Con el código que recibiste',
        () => totemGo('pickup', {}, 'Escribe el código de retiro que recibiste.')),
      bigBtn('🎧', 'Hablar con una persona', 'Central de monitoreo, en vivo con audio y video',
        () => { totemGo('human', {}, 'Te estoy comunicando con la central de monitoreo. Un momento, por favor.'); void requestLink({ to: 'central', reason: 'petición del visitante' }); }, 'sc-tot-human'),
      bigBtn('🆘', 'Necesito ayuda', 'Emergencia médica, fuego o seguridad',
        () => totemGo('help', {}, '¿Qué tipo de ayuda necesitas?', 'alert'), 'sc-tot-sos'),
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
        t.ctx.error ? h('p', { className: 'sc-warn' }, t.ctx.error) : null);
    } else if (step === 'call') {
      body = unitPicker((u) => { void totemCall(u.code, who); setUnitQ(''); });
    } else if (step === 'resident') {
      body = h('div', { className: 'sc-tot-form' },
        tinput('unitQ', { placeholder: 'Tu unidad' }),
        tinput('pin', { type: 'password', inputMode: 'numeric', placeholder: 'Código de ingreso' }),
        btn({ className: 'sc-btn sc-btn-primary sc-btn-big', onClick: () => { closeKb(); void totemPin(unitQ, pin); setPin(''); } }, 'Entrar'),
        t.ctx.error ? h('p', { className: 'sc-warn' }, t.ctx.error) : null,
        h('p', { className: 'sc-note' }, 'Sin biometría: el ingreso se valida con un código de la unidad.'));
    } else if (step === 'parcel') {
      body = h('div', { className: 'sc-tot-form' },
        tinput('carrier', { placeholder: 'Empresa de reparto' }),
        unitPicker(async (u) => {
          const r = await receiveParcel({ unit: u.code, carrier, receivedBy: 'Tótem' });
          setUnitQ(''); setCarrier('');
          totemGo('parcel-done', { code: r.code, unit: u.code },
            'Encomienda registrada para ' + u.code + '. Avisamos a la unidad con su código de retiro. Gracias.');
        }));
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
    } else if (step === 'human') {
      body = h('div', { className: 'sc-tot-form sc-tot-center' },
        h('p', { className: 'sc-tot-big' }, live ? 'Estás hablando con la central.' : connecting ? 'Conectando con la central…' : 'La central no respondió.'),
        h('p', { className: 'sc-note' }, live
          ? 'Te atiende una persona del equipo de monitoreo. Habla con normalidad: te escucha y te ve.'
          : 'Si nadie contesta, puedes dejar un aviso a la unidad o pedir ayuda desde el menú.'),
        live
          ? btn({ className: 'sc-btn sc-btn-danger sc-btn-big', onClick: () => { void hangup('cerrado por el visitante'); back(); } }, 'Terminar la llamada')
          : btn({ className: 'sc-btn sc-btn-big', onClick: back }, 'Volver'));
    } else if (step === 'help') {
      body = h('div', { className: 'sc-tot-menu' },
        bigBtn('🚑', 'Emergencia médica', 'Aviso inmediato y contacto con SAMU', () => totemHelp('medical'), 'sc-tot-sos'),
        bigBtn('🔥', 'Fuego o humo', 'Aviso inmediato y contacto con Bomberos', () => totemHelp('fire'), 'sc-tot-sos'),
        bigBtn('🚨', 'Me siento en peligro', 'Aviso a seguridad y a la central', () => totemHelp('security'), 'sc-tot-sos'),
        bigBtn('↩', 'Volver', '', back));
    } else if (step === 'help-done') {
      body = h('div', { className: 'sc-tot-form sc-tot-center' },
        h('p', { className: 'sc-tot-big' }, 'El personal ya fue avisado.'),
        h('p', { className: 'sc-note' }, 'Una persona de la central confirmará el contacto con el servicio de emergencia. '
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
    const firstField = step === 'visit' ? 'who'
      : step === 'resident' ? 'unitQ' : step === 'call' ? 'unitQ'
      : step === 'parcel' ? 'carrier' : step === 'pickup' ? 'pickCode' : '';
    const hhmm = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return h('div', { className: 'sc-view sc-totem' + (m.kiosk ? ' sc-kiosk' : '') },
      // Barra superior: dónde estoy, qué hora es y si la central está mirando.
      h('div', { className: 'sc-tot-top' },
        h('span', { className: 'sc-tot-place' }, '🛡️ ' + (s(m.settings.siteName) || 'Acceso')),
        h('span', { className: 'sc-tot-clock' }, hhmm),
        live
          ? h('span', { className: 'sc-tot-onair' }, h('span', { className: 'sc-dot' }), 'EN VIVO CON LA CENTRAL')
          : h('span', { className: 'sc-tot-state' }, m.sensor.cam ? '🎥 Acceso monitoreado' : 'Acceso monitoreado')),

      h('div', { className: 'sc-tot-stage' },
        h('div', { className: 'sc-tot-side' },
          // Marco del conserje: el avatar, o la cara del operador si hay enlace.
          h('div', { className: 'sc-tot-avatar' + (live ? ' sc-tot-avatar-live' : '') },
            live
              ? h(LiveVideo, { on: true, nonce: m.link.since, className: 'sc-op-video' })
              : h(Avatar, {
                look, idSuffix: 'tot',
                speaking: m.face.speaking, mood: m.face.mood, focus: m.sensor.focus,
              }),
            h('div', { className: 'sc-tot-tag' },
              h('strong', null, live ? 'Central de monitoreo' : s(look.name)),
              h('span', { className: 'sc-tot-live' + (m.face.speaking || live ? ' on' : '') },
                live ? '● en vivo · te atiende una persona'
                  : connecting ? 'llamando a la central…'
                  : m.face.speaking ? 'hablando' : 'conserje virtual · en línea'))),
          // Espejo del acceso: quien está frente a la cámara.
          h(Mirror, { on: !!m.sensor.cam }),
        ),

        h('div', { className: 'sc-tot-panelx' },
          h('div', { className: 'sc-tot-bubble' }, h('p', { className: 'sc-tot-say' }, say || HELLO())),
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
        h('span', null, '🔒 Se registran ingresos, salidas y eventos de seguridad. La cámara se analiza en este equipo y no se graba; '
          + 'si la central abre el enlace, se avisa arriba. Sin reconocimiento facial. Retención: '
          + num(m.settings.retentionDays, LEGAL_RETENTION_DAYS) + ' días.'),
        h('span', { className: 'sc-row' },
          firstField ? btn({ className: 'sc-btn' + (kb.open ? ' sc-btn-on' : ''), onClick: () => (kb.open ? closeKb() : openKb(firstField)) }, '⌨ Teclado') : null,
          btn({ className: 'sc-btn' + (m.sensor.cam ? ' sc-btn-on' : ''), onClick: () => (m.sensor.cam ? stopCamera() : startCamera()) }, m.sensor.cam ? '🎥 Cámara encendida' : '🎥 Encender cámara'),
          live ? btn({ className: 'sc-btn sc-btn-danger', onClick: () => hangup('cerrado en el tótem') }, '⏹ Cortar enlace') : null,
          btn({ className: 'sc-btn sc-btn-ghost', onClick: () => setModel({ kiosk: !m.kiosk }) }, m.kiosk ? 'Salir del modo tótem' : 'Modo tótem (pantalla completa)')),
      ),
    );
  }

  /** Video del otro extremo del enlace (la central ve el acceso y viceversa). */
  function LiveVideo(props) {
    const ref = useRef(null);
    const on = !!props.on;
    useEffect(() => {
      const el = ref.current;
      if (!el) return undefined;
      try {
        if (on && rtc.remote) {
          el.srcObject = rtc.remote;
          const pl = el.play();
          if (pl && typeof pl.catch === 'function') pl.catch(() => { /* el gesto del operador lo destraba */ });
        } else { el.srcObject = null; }
      } catch (e) { /* sin señal */ }
      return () => { try { if (el) el.srcObject = null; } catch (e) { /* noop */ } };
    }, [on, props.nonce]);
    return h('video', { ref, className: s(props.className) || 'sc-live-video', autoPlay: true, playsInline: true, muted: !!props.muted });
  }

  /** Botón de archivo: abre el selector y sube al Cloud Storage. */
  function UploadButton(props) {
    const ref = useRef(null);
    const [busy, setBusy] = useState(false);
    return h('span', { className: 'sc-upload' },
      h('input', {
        ref, type: 'file', className: 'sc-file', multiple: props.multiple !== false,
        accept: props.accept,
        onChange: async (e) => {
          const files = Array.from((e.target && e.target.files) || []);
          if (!files.length) return;
          setBusy(true);
          let ok = 0;
          for (const f of files) {
            try { await attachDoc(f, props.meta || {}); ok++; }
            catch (err) { shell.notify({ level: 'error', text: 'No se pudo subir ' + f.name + ': ' + s((err && err.message) || err) }); }
          }
          setBusy(false);
          try { e.target.value = ''; } catch (err) { /* noop */ }
          if (ok) shell.notify({ level: 'success', text: ok + ' archivo(s) en el almacenamiento.' });
          if (typeof props.onDone === 'function') props.onDone();
        },
      }),
      btn({
        className: 'sc-btn' + (props.primary ? ' sc-btn-primary' : ''), disabled: busy,
        onClick: () => { const el = ref.current; if (el && el.click) el.click(); },
      }, busy ? 'Subiendo…' : (s(props.label) || '⬆ Subir archivo')),
    );
  }

  // ── Vista: central de monitoreo ─────────────────────────────────────────
  function Central(props) {
    const m = props.m;
    const [by, setBy] = useState('');
    const [note, setNote] = useState('');
    const ringing = (m.calls || []).filter((c) => c.status === 'ringing');
    const active = (m.calls || []).find((c) => c.id === m.link.callId);
    const pend = m.incidents.filter((i) => i.review && i.review.status === 'pending');
    const history = (m.calls || []).filter((c) => c.status === 'ended').slice(0, 8);
    const linkState = m.link.state;
    const operator = s(by).trim() || actorName();

    return h('div', { className: 'sc-view' },
      h('section', { className: 'sc-card sc-card-live' },
        h('h3', null, '📡 Enlace con el acceso',
          h('span', { className: 'sc-chip sc-chip-' + (linkState === 'active' ? 'ok' : linkState === 'idle' ? '' : 'warn') },
            linkState === 'active' ? 'en vivo' : linkState === 'idle' ? 'sin enlace' : 'conectando…')),
        h('div', { className: 'sc-live-stage' },
          h('div', { className: 'sc-live-box' + (linkState === 'active' ? ' on' : '') },
            h(LiveVideo, { on: linkState === 'active', nonce: m.link.since }),
            linkState !== 'active' ? h('div', { className: 'sc-live-off' },
              h('span', null, '📺'),
              h('span', null, linkState === 'idle' ? 'Sin transmisión' : 'Estableciendo enlace…')) : null,
            h('div', { className: 'sc-live-bar' },
              h('span', null, linkState === 'active' ? '● EN VIVO · acceso' : 'acceso'),
              active && active.reason ? h('span', null, s(active.reason)) : null)),
          h('div', { className: 'sc-live-side' },
            ringing.length ? h('div', { className: 'sc-ring' },
              h('strong', null, '📞 ' + ringing.length + ' enlace(s) esperando'),
              ringing.map((c) => h('div', { key: c.id, className: 'sc-ring-row' },
                h('span', null, s(c.fromName || c.fromRole) + ' · ' + s(c.reason)),
                btn({ className: 'sc-btn sc-btn-ok', onClick: () => answerLink(c) }, 'Atender'),
                btn({ className: 'sc-btn sc-btn-no', onClick: () => patchRecord('calls', c.id, { status: 'ended', endedAt: stamp(), endedBy: operator, endReason: 'no atendido' }) }, 'Rechazar')))) : null,
            h('div', { className: 'sc-row sc-row-wrap' },
              linkState === 'idle'
                ? btn({ className: 'sc-btn sc-btn-primary', onClick: () => requestLink({ to: 'totem', reason: 'supervisión desde la central' }) }, '👁 Ver el acceso ahora')
                : btn({ className: 'sc-btn sc-btn-danger', onClick: () => hangup('cerrado por el operador') }, '⏹ Cerrar enlace'),
              linkState === 'active' ? btn({ onClick: () => snapshotEvidence('', 'Captura pedida por la central') }, '📸 Guardar captura') : null),
            m.link.error ? h('p', { className: 'sc-warn' }, m.link.error) : null,
            h('p', { className: 'sc-note' }, 'El tótem anuncia en su pantalla que la central está mirando: nadie observa sin que se vea. '
              + 'Cada enlace queda sellado en la bitácora con quién lo abrió, por qué y cuánto duró.'),
          ),
        ),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, '🧑‍✈️ Validación humana de alertas',
          pend.length ? h('span', { className: 'sc-chip sc-chip-warn' }, pend.length + ' pendiente(s)') : h('span', { className: 'sc-chip sc-chip-ok' }, 'al día')),
        h('p', { className: 'sc-note' }, 'Ninguna alerta automática habilita un contacto con seguridad o emergencias hasta que una '
          + 'persona de la central la revisa. Aprobar no llama a nadie: habilita el escalamiento, que se registra aparte con quién lo autoriza.'),
        h('div', { className: 'sc-row sc-row-wrap' },
          h('input', { className: 'sc-input', value: by, placeholder: 'Operador que revisa (por defecto: ' + actorName() + ')', onChange: (e) => setBy(e.target.value) }),
          h('input', { className: 'sc-input', value: note, placeholder: 'Nota de la revisión (opcional)', onChange: (e) => setNote(e.target.value) })),
        pend.length ? h('ul', { className: 'sc-list' }, pend.map((i) => h('li', { key: i.id, className: 'sc-list-i sc-list-review' },
          h('span', { className: 'sc-i-icon' }, riskType(i.type).icon),
          h('span', { className: 'sc-i-main' },
            h('strong', null, s(i.typeLabel)),
            h('span', { className: 'sc-i-sub' }, [fmtDateTime(i.openedAt), i.camera || i.unit,
              'confianza ' + Math.round(num(i.confidence, 0) * 100) + '%', s(i.summary)].filter(Boolean).join(' · '))),
          levelPill(i.level),
          btn({ className: 'sc-btn sc-btn-ok', onClick: async () => { const r = await approveIncident(i.id, operator, note); shell.notify({ level: r.success ? 'success' : 'error', text: r.message || r.error }); setNote(''); } }, '✓ Corresponde'),
          btn({ className: 'sc-btn sc-btn-no', onClick: async () => { const r = await dismissIncident(i.id, operator, note || 'no corresponde'); shell.notify({ level: r.success ? 'info' : 'error', text: r.message || r.error }); setNote(''); } }, '✕ Descartar'),
          btn({ onClick: () => setModel({ view: 'incidents', focus: i.id }) }, 'Abrir'))))
          : h('p', { className: 'sc-empty' }, 'No hay alertas esperando validación.'),
      ),

      history.length ? h('section', { className: 'sc-card' },
        h('h3', null, 'Enlaces recientes'),
        h('ul', { className: 'sc-mini' }, history.map((c) => h('li', { key: c.id },
          fmtDateTime(c.at) + ' · ' + s(c.fromName || c.fromRole) + ' → ' + s(c.to)
          + ' · ' + (num(c.seconds, 0) ? fmtDur(num(c.seconds, 0) * 1000) : 'sin conexión')
          + (c.answeredBy ? ' · atendió ' + s(c.answeredBy) : '') + (c.endReason ? ' · ' + s(c.endReason) : '')))),
      ) : null,
    );
  }

  // ── Vista: documentos (Cloud Storage) ───────────────────────────────────
  function Docs(props) {
    const m = props.m;
    const [folder, setFolder] = useState('general');
    const [q, setQ] = useState('');
    const list = useMemo(() => {
      const c = canon(q);
      return (m.docs || []).filter((d) => (folder === 'all' || d.folder === folder)
        && (!c || canon(d.name + ' ' + d.note + ' ' + d.unit + ' ' + d.uploadedBy).includes(c)));
    }, [m.docs, folder, q]);
    const total = (m.docs || []).reduce((a, d) => a + num(d.size, 0), 0);

    return h('div', { className: 'sc-view' },
      h('section', { className: 'sc-card' },
        h('h3', null, '📁 Archivos de la comunidad',
          h('span', { className: 'sc-chip' }, (m.docs || []).length + ' archivo(s) · ' + fmtSize(total))),
        h('p', { className: 'sc-note' }, 'Se guardan en el Cloud Storage de KIMOS, no dentro de la app: el plan de emergencia, el '
          + 'reglamento, las actas, la evidencia de un incidente o la foto de una encomienda quedan disponibles desde cualquier consola '
          + 'y con su registro sellado de quién los subió.'),
        h('div', { className: 'sc-row sc-row-wrap' },
          h('select', { className: 'sc-input', value: folder, onChange: (e) => setFolder(e.target.value) },
            DOC_FOLDERS.map((f) => h('option', { key: f.id, value: f.id }, f.label)),
            h('option', { value: 'all' }, 'Todas las carpetas')),
          h(UploadButton, { primary: true, meta: { folder: folder === 'all' ? 'general' : folder }, label: '⬆ Subir a esta carpeta' }),
          m.sensor.cam ? btn({ onClick: () => snapshotEvidence('', 'Captura manual desde Documentos') }, '📸 Capturar cámara') : null),
        h('div', { className: 'sc-drop', onDragOver: (e) => e.preventDefault(), onDrop: async (e) => {
          e.preventDefault();
          const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
          for (const f of files) {
            try { await attachDoc(f, { folder: folder === 'all' ? 'general' : folder }); }
            catch (err) { shell.notify({ level: 'error', text: s((err && err.message) || err) }); }
          }
          if (files.length) shell.notify({ level: 'success', text: files.length + ' archivo(s) subido(s).' });
        } }, 'Suelta archivos aquí · máximo ' + MAX_DOC_MB + ' MB por archivo'),
      ),

      h('section', { className: 'sc-card' },
        h('h3', null, 'Guardados'),
        h('input', { className: 'sc-input', value: q, placeholder: 'Buscar por nombre, unidad o quién lo subió', onChange: (e) => setQ(e.target.value) }),
        list.length ? h('ul', { className: 'sc-list' }, list.map((d) => h('li', { key: d.id, className: 'sc-list-i' },
          h('span', { className: 'sc-i-icon' }, docIcon(d)),
          h('span', { className: 'sc-i-main' },
            h('strong', null, s(d.name)),
            h('span', { className: 'sc-i-sub' }, [fmtDateTime(d.at), fmtSize(d.size), s(d.uploadedBy),
              d.incidentId ? 'incidente' : '', d.unit ? 'unidad ' + d.unit : '', s(d.note)].filter(Boolean).join(' · '))),
          h('a', { className: 'sc-btn sc-btn-link', href: s(d.url), target: '_blank', rel: 'noopener' }, 'Abrir'),
          d.incidentId ? btn({ onClick: () => setModel({ view: 'incidents', focus: d.incidentId }) }, 'Ver incidente') : null,
          btn({ className: 'sc-btn sc-btn-no', onClick: () => removeRecord('docs', d.id) }, 'Quitar'))))
          : h('p', { className: 'sc-empty' }, 'Nada en esta carpeta todavía.'),
        h('p', { className: 'sc-note' }, '«Quitar» borra la ficha de la bitácora; el archivo en sí sigue en el almacenamiento del '
          + 'equipo hasta que se elimine desde ahí. Es a propósito: la evidencia de un incidente no debe poder desaparecer con un clic.'),
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
      filter === 'all' ? true
        : filter === 'pending' ? (i.review && i.review.status === 'pending')
        : filter === 'open' ? i.status !== 'closed'
        : filter === 'critical' ? num(i.level, 0) >= 4
        : i.status === filter
    )), [m.incidents, filter]);
    const inc = list.find((i) => i.id === sel) || m.incidents.find((i) => i.id === sel) || list[0] || null;
    useEffect(() => { if (m.focus && m.focus !== sel) setSel(m.focus); }, [m.focus]);

    const filters = [['pending', 'Por validar'], ['open', 'Abiertos'], ['critical', 'Críticos'], ['escalated', 'Escalados'], ['closed', 'Cerrados'], ['all', 'Todos']];
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
            h('span', { className: 'sc-i-sub' }, [fmtDateTime(i.openedAt), i.camera || i.unit, i.status,
              (i.review && i.review.status === 'pending') ? 'por validar' : ''].filter(Boolean).join(' · '))),
          (i.review && i.review.status === 'pending') ? h('span', { className: 'sc-chip sc-chip-warn' }, '⏳') : null,
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

          // Compuerta: la central valida antes de que nadie contacte a nadie.
          (function () {
            const rv = inc.review || { status: 'approved' };
            if (rv.status === 'pending') {
              return h('div', { className: 'sc-review sc-review-pending' },
                h('h4', null, '🧑‍✈️ Esperando validación de la central'),
                h('p', { className: 'sc-note' }, 'Mientras una persona no confirme que la alerta corresponde, el escalamiento '
                  + 'queda bloqueado. Puedes abrir el audio y el video del acceso para revisarla.'),
                h('div', { className: 'sc-row sc-row-wrap' },
                  h('input', { className: 'sc-input', value: byName, placeholder: 'Operador que revisa', onChange: (e) => setByName(e.target.value) }),
                  btn({ className: 'sc-btn sc-btn-ok', onClick: async () => {
                    const r = await approveIncident(inc.id, byName, '');
                    shell.notify({ level: r.success ? 'success' : 'error', text: r.message || r.error });
                  } }, '✓ La alerta corresponde'),
                  btn({ className: 'sc-btn sc-btn-no', onClick: async () => {
                    const r = await dismissIncident(inc.id, byName, 'no corresponde');
                    shell.notify({ level: r.success ? 'info' : 'error', text: r.message || r.error });
                  } }, '✕ Descartar'),
                  m.link.state === 'idle'
                    ? btn({ onClick: () => requestLink({ to: 'totem', reason: 'validar ' + s(inc.typeLabel), incidentId: inc.id }) }, '👁 Ver el acceso en vivo')
                    : btn({ onClick: () => setModel({ view: 'central' }) }, 'Ir al enlace en vivo')));
            }
            return h('p', { className: 'sc-review sc-review-' + (rv.status === 'dismissed' ? 'no' : 'ok') },
              (rv.status === 'dismissed' ? '✕ Descartada por ' : '✓ Validada por ') + s(rv.by || '—')
              + (rv.at ? ' · ' + fmtDateTime(rv.at) : '') + (rv.note ? ' · ' + s(rv.note) : ''));
          })(),

          h('div', { className: 'sc-row sc-row-wrap' },
            !inc.ackAt ? btn({ className: 'sc-btn sc-btn-primary', onClick: () => ackIncident(inc.id) }, '✋ Tomar') : chip('Tomado por ' + s(inc.ackBy), 'ok'),
            inc.status !== 'closed' ? btn({ onClick: () => closeIncident(inc.id, 'resuelto') }, '✓ Cerrar') : chip('Cerrado ' + fmtDateTime(inc.closedAt), 'ok'),
            inc.status !== 'closed' ? btn({ onClick: () => closeIncident(inc.id, 'falso-positivo') }, '⌀ Falso positivo') : null,
            btn({ onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(brief(inc)); shell.notify({ level: 'info', text: 'Parte copiado.' }); } }, '📋 Copiar parte'),
          ),

          h('div', { className: 'sc-esc' },
            h('h4', null, 'Escalar a un servicio externo'),
            h('p', { className: 'sc-note' }, 'La app no llama sola. Elige el canal, escribe quién autoriza y queda sellado en la bitácora.'
              + ((inc.review || {}).status === 'pending' ? ' Bloqueado: primero la central tiene que validar la alerta.' : '')),
            h('div', { className: 'sc-row sc-row-wrap' },
              h('select', { className: 'sc-input', value: channel, onChange: (e) => setChannel(e.target.value) },
                h('option', { value: '' }, 'Canal…'),
                m.channels.map((c) => h('option', { key: c.id, value: c.id }, c.name + (c.phone ? ' · ' + c.phone : ' · sin número')))),
              h('input', { className: 'sc-input', value: byName, placeholder: 'Quién autoriza', onChange: (e) => setByName(e.target.value) }),
              btn({ className: 'sc-btn sc-btn-danger', disabled: !channel || !s(byName).trim() || (inc.review || {}).status === 'pending', onClick: async () => {
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

          h('div', { className: 'sc-esc' },
            h('h4', null, '📎 Evidencia en el almacenamiento'),
            h('div', { className: 'sc-row sc-row-wrap' },
              h(UploadButton, { meta: { folder: 'evidencia', incidentId: inc.id }, label: '⬆ Adjuntar archivo' }),
              m.sensor.cam ? btn({ onClick: () => snapshotEvidence(inc.id, 'Captura del acceso') }, '📸 Capturar cámara') : null,
              btn({ onClick: () => setModel({ view: 'docs' }) }, 'Ver todos los archivos')),
            (function () {
              const list2 = docsFor('incident', inc.id);
              return list2.length
                ? h('ul', { className: 'sc-docs' }, list2.map((d) => h('li', { key: d.id },
                    h('a', { href: s(d.url), target: '_blank', rel: 'noopener' }, docIcon(d) + ' ' + s(d.name)),
                    h('span', null, fmtSize(d.size) + ' · ' + s(d.uploadedBy) + ' · ' + fmtDateTime(d.at)))))
                : h('p', { className: 'sc-note' }, 'Sin archivos adjuntos. Las fotos, videos o partes que se suban aquí quedan '
                    + 'en el Cloud Storage con su sello en la bitácora.');
            })(),
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
      : m.view === 'central' ? h(Central, { m })
      : m.view === 'docs' ? h(Docs, { m })
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
      if (model.link.state !== 'idle') { void hangup('se cerró la ventana'); } else { closePeer(); }
      if (rtc.op) { try { rtc.op.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ } rtc.op = null; }
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
