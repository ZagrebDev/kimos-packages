/**
 * KIMOS Cashflow — Agente Financiero Inteligente (v1.0, bundle AppShell v1).
 *
 * Módulos: Flujo de Caja · Libro Diario Inteligente · Gestor Documental ·
 * OCR + IA Financiera (extractor local + agente KIMOS, IA agnóstica) ·
 * Dashboard · Proyecciones y Presupuestos · Análisis Inteligente ·
 * Human in the Loop (la IA solo PROPONE; el usuario aprueba/edita/rechaza/
 * pospone/reinterpreta) · Multiempresa · Auditoría completa.
 *
 * Contrato: export default mount(shell) → { Component, unmount }. Usa
 * globalThis.React (sin JSX), estado por instancia en closure, persistencia
 * saveData/loadData con debounce, CSS con scope .kimos-cashflow y control por
 * agente vía shell.agent.register (permissions: agent.control).
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef } = React;

  // ── Utilidades ──────────────────────────────────────────────────────────
  const s = (v) => (v == null ? '' : String(v));
  const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const nowIso = () => new Date().toISOString();
  const pad2 = (x) => String(x).padStart(2, '0');
  const toLocalISO = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const todayISO = () => toLocalISO(new Date());
  const monthKey = (dateStr) => s(dateStr).slice(0, 7);
  const addMonths = (ym, n) => {
    const y = Number(ym.slice(0, 4)); const m = Number(ym.slice(5, 7)) - 1;
    const d = new Date(y, m + n, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  };
  const monthLabel = (ym) => {
    const NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const m = Number(s(ym).slice(5, 7)); return (NAMES[m - 1] || ym) + ' ' + s(ym).slice(2, 4);
  };
  const fmtDate = (v) => {
    if (!s(v)) return '';
    const p = s(v).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : s(v);
  };
  const escCsv = (v) => {
    const t = s(v);
    return /[",;\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };

  const instanceId = shell.app && shell.app.instanceId;

  // ── Modelo (closure: UNA copia por ventana) ─────────────────────────────
  const DEFAULT_SETTINGS = { currency: 'CLP', ivaRate: 19, liquidityDays: 30, showCents: false };
  const DEFAULT_CATEGORIES = [
    { id: 'cat-ventas', name: 'Ventas', kind: 'ingreso', color: '#16a34a' },
    { id: 'cat-servicios-in', name: 'Servicios prestados', kind: 'ingreso', color: '#0d9488' },
    { id: 'cat-otros-in', name: 'Otros ingresos', kind: 'ingreso', color: '#65a30d' },
    { id: 'cat-compras', name: 'Compras / Insumos', kind: 'egreso', color: '#dc2626' },
    { id: 'cat-arriendo', name: 'Arriendo', kind: 'egreso', color: '#ea580c' },
    { id: 'cat-sueldos', name: 'Sueldos y honorarios', kind: 'egreso', color: '#9333ea' },
    { id: 'cat-basicos', name: 'Servicios básicos', kind: 'egreso', color: '#2563eb' },
    { id: 'cat-transporte', name: 'Transporte', kind: 'egreso', color: '#0891b2' },
    { id: 'cat-marketing', name: 'Marketing', kind: 'egreso', color: '#db2777' },
    { id: 'cat-impuestos', name: 'Impuestos', kind: 'egreso', color: '#78716c' },
    { id: 'cat-otros-out', name: 'Otros egresos', kind: 'egreso', color: '#64748b' },
  ];
  function seedModel() {
    const companyId = uid('co');
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS),
      activeCompanyId: companyId,
      companies: [{ id: companyId, name: 'Mi Empresa', rut: '', giro: '', address: '' }],
      accounts: [
        { id: uid('acc'), companyId, name: 'Caja principal', type: 'caja', bank: '', number: '', initialBalance: 0 },
        { id: uid('acc'), companyId, name: 'Cuenta corriente', type: 'banco', bank: '', number: '', initialBalance: 0 },
      ],
      categories: DEFAULT_CATEGORIES.map((c) => Object.assign({}, c)),
      costCenters: [], projects: [], budgets: [],
      movements: [], documents: [], proposals: [], audit: [],
    };
  }

  let model = seedModel();
  let loaded = false;
  let loadError = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l(model));

  // ── Persistencia (saveData/loadData con debounce) ───────────────────────
  let saveTimer = null;
  let saving = false;
  function scheduleSave() {
    if (!instanceId || !shell.saveData) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 900);
  }
  async function doSave() {
    saveTimer = null;
    if (saving) { scheduleSave(); return; }
    saving = true;
    try { await shell.saveData({ cashflow: model, savedAt: nowIso() }); }
    catch (e) { shell.notify && shell.notify({ level: 'error', text: 'KIMOS Cashflow: no se pudo guardar (' + ((e && e.message) || 'error') + ').' }); }
    saving = false;
  }
  function commit(mutator, auditAction, auditDetail) {
    mutator(model);
    if (auditAction) pushAudit(auditAction, auditDetail);
    emit();
    scheduleSave();
  }
  function hydrate(payload) {
    const data = payload && payload.cashflow;
    if (data && Array.isArray(data.companies) && data.companies.length) {
      model = Object.assign(seedModel(), data);
      model.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
      ['companies', 'accounts', 'categories', 'costCenters', 'projects', 'budgets',
        'movements', 'documents', 'proposals', 'audit'].forEach((k) => {
        if (!Array.isArray(model[k])) model[k] = [];
      });
      if (!model.companies.some((c) => c.id === model.activeCompanyId)) {
        model.activeCompanyId = model.companies[0].id;
      }
    }
  }
  async function load() {
    try {
      if (instanceId && shell.loadData) hydrate(await shell.loadData());
      loaded = true; loadError = null;
    } catch (e) { loaded = true; loadError = (e && e.message) || 'No se pudo cargar los datos.'; }
    emit();
    // ⚙️ Configurar (AppShell v2): parámetros del host → settings del modelo.
    try {
      if (shell.config && shell.config.get) {
        applyHostConfig(await shell.config.get());
        if (shell.config.onChange) offConfig = shell.config.onChange(applyHostConfig) || null;
      }
    } catch (e) { /* opcional */ }
    // 🗂️ Documentos (AppShell v2): guardar versión / restaurar.
    try {
      if (shell.documents) {
        if (shell.documents.onSerialize) shell.documents.onSerialize(() => ({ cashflow: model, savedAt: nowIso() }));
        if (shell.documents.onLoad) shell.documents.onLoad((cfg) => { hydrate(cfg); emit(); });
      }
    } catch (e) { /* opcional */ }
  }
  let offConfig = null;
  function applyHostConfig(cfg) {
    if (!cfg) return;
    commit((m) => {
      if (cfg.currency) m.settings.currency = s(cfg.currency);
      if (cfg.ivaRate != null && num(cfg.ivaRate) >= 0) m.settings.ivaRate = num(cfg.ivaRate);
      if (cfg.liquidityDays != null && num(cfg.liquidityDays) > 0) m.settings.liquidityDays = num(cfg.liquidityDays);
      if (cfg.showCents != null) m.settings.showCents = cfg.showCents === true;
    });
  }

  // ── Formato de moneda ───────────────────────────────────────────────────
  function fmtMoney(n) {
    const v = num(n);
    try {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency', currency: model.settings.currency || 'CLP',
        minimumFractionDigits: 0, maximumFractionDigits: model.settings.showCents ? 2 : 0,
      }).format(v);
    } catch (e) { return '$' + Math.round(v).toLocaleString('es-CL'); }
  }

  // ── Auditoría (Trazabilidad Financiera) ─────────────────────────────────
  function pushAudit(action, detail) {
    model.audit.unshift({ id: uid('aud'), at: nowIso(), action: s(action), detail: s(detail) });
    if (model.audit.length > 500) model.audit.length = 500;
  }

  // ── Catálogos ───────────────────────────────────────────────────────────
  const activeCompany = () => model.companies.find((c) => c.id === model.activeCompanyId) || model.companies[0];
  const catById = (id) => model.categories.find((c) => c.id === id) || null;
  const accById = (id) => model.accounts.find((a) => a.id === id) || null;
  const projById = (id) => model.projects.find((p) => p.id === id) || null;
  const ccById = (id) => model.costCenters.find((c) => c.id === id) || null;
  const docById = (id) => model.documents.find((d) => d.id === id) || null;

  function addCatalogItem(kind, data, source) {
    const name = s(data && data.name).trim();
    if (!name) return { success: false, error: 'Nombre requerido.' };
    let created = null;
    commit((m) => {
      if (kind === 'category') {
        created = { id: uid('cat'), name, kind: data.kind === 'ingreso' ? 'ingreso' : 'egreso', color: s(data.color) || '#64748b' };
        m.categories.push(created);
      } else if (kind === 'project') {
        created = { id: uid('prj'), name, status: 'activo' };
        m.projects.push(created);
      } else if (kind === 'costCenter') {
        created = { id: uid('cc'), name };
        m.costCenters.push(created);
      }
    }, 'catálogo', (source || 'usuario') + ' creó ' + kind + ' «' + name + '»');
    return created ? { success: true, id: created.id } : { success: false, error: 'Tipo de catálogo desconocido.' };
  }

  // ── Movimientos (CRUD + duplicar) ───────────────────────────────────────
  function normalizeMovement(draft) {
    const d = draft || {};
    const type = d.type === 'ingreso' ? 'ingreso' : 'egreso';
    const amount = Math.abs(num(d.amount));
    const iva = Math.abs(num(d.iva));
    const neto = Math.abs(num(d.neto)) || (iva > 0 ? Math.max(0, amount - iva) : 0);
    return {
      id: s(d.id) || uid('mov'),
      type,
      status: d.status === 'pendiente' ? 'pendiente' : 'realizado',
      date: s(d.date).slice(0, 10) || todayISO(),
      time: s(d.time).slice(0, 5),
      dueDate: s(d.dueDate).slice(0, 10),
      amount, neto, iva,
      exento: Math.abs(num(d.exento)),
      discount: Math.abs(num(d.discount)),
      description: s(d.description).trim(),
      counterpart: s(d.counterpart).trim(),
      counterpartRut: s(d.counterpartRut).trim(),
      docType: s(d.docType), docNumber: s(d.docNumber),
      categoryId: catById(d.categoryId) ? d.categoryId : '',
      projectId: projById(d.projectId) ? d.projectId : '',
      costCenterId: ccById(d.costCenterId) ? d.costCenterId : '',
      companyId: model.companies.some((c) => c.id === d.companyId) ? d.companyId : model.activeCompanyId,
      accountId: accById(d.accountId) ? d.accountId : '',
      paymentMethod: s(d.paymentMethod), installments: Math.max(0, Math.round(num(d.installments))),
      bank: s(d.bank), reference: s(d.reference),
      recurrence: ['semanal', 'mensual', 'trimestral', 'anual'].indexOf(d.recurrence) >= 0 ? d.recurrence : '',
      items: Array.isArray(d.items) ? d.items.slice(0, 100).map((it) => ({
        qty: num(it && it.qty) || 1, desc: s(it && it.desc).slice(0, 200), unit: num(it && it.unit), total: num(it && it.total),
      })) : [],
      notes: s(d.notes),
      documentIds: Array.isArray(d.documentIds) ? d.documentIds.filter((x) => docById(x)) : [],
      source: s(d.source) || 'manual',
      createdAt: s(d.createdAt) || nowIso(),
      updatedAt: nowIso(),
    };
  }
  function upsertMovement(draft, source) {
    const mov = normalizeMovement(draft);
    if (!(mov.amount > 0)) return { success: false, error: 'El monto debe ser mayor que cero.' };
    const existing = model.movements.find((x) => x.id === mov.id);
    commit((m) => {
      if (existing) {
        mov.createdAt = existing.createdAt;
        m.movements = m.movements.map((x) => (x.id === mov.id ? mov : x));
      } else { m.movements.push(mov); }
      mov.documentIds.forEach((docId) => {
        const doc = m.documents.find((d) => d.id === docId);
        if (doc) { doc.status = 'vinculado'; doc.movementId = mov.id; }
      });
    }, existing ? 'movimiento editado' : 'movimiento creado',
      (source || 'usuario') + ': ' + mov.type + ' ' + fmtMoney(mov.amount) + ' — ' + (mov.description || mov.counterpart || 'sin glosa'));
    return { success: true, id: mov.id };
  }
  function deleteMovement(id) {
    const mov = model.movements.find((x) => x.id === id);
    if (!mov) return;
    commit((m) => {
      m.movements = m.movements.filter((x) => x.id !== id);
      m.documents.forEach((d) => { if (d.movementId === id) { d.movementId = ''; d.status = d.extraction ? 'procesado' : 'pendiente'; } });
    }, 'movimiento eliminado', mov.type + ' ' + fmtMoney(mov.amount) + ' — ' + (mov.description || mov.counterpart || id));
  }
  function duplicateMovement(id) {
    const mov = model.movements.find((x) => x.id === id);
    if (!mov) return null;
    const copy = normalizeMovement(Object.assign({}, mov, {
      id: '', date: todayISO(), documentIds: [], createdAt: '', source: 'manual',
      description: mov.description ? mov.description + ' (copia)' : '',
    }));
    commit((m) => { m.movements.push(copy); }, 'movimiento duplicado', 'copia de ' + (mov.description || mov.counterpart || id));
    return copy.id;
  }

  // ── Human in the Loop: propuestas de la IA ──────────────────────────────
  // Toda escritura financiera originada por IA/OCR/agente entra aquí. Nada se
  // registra en firme sin decisión explícita del usuario.
  function createProposal(draft, meta) {
    const p = {
      id: uid('prop'),
      status: 'pendiente', // pendiente | pospuesta
      createdAt: nowIso(),
      source: s(meta && meta.source) || 'ia',
      documentId: s(meta && meta.documentId),
      confidence: Math.max(0, Math.min(1, num(meta && meta.confidence))) || 0.5,
      notes: s(meta && meta.notes),
      draft: Object.assign({ type: 'egreso', date: todayISO() }, draft || {}),
    };
    commit((m) => {
      m.proposals.unshift(p);
      if (p.documentId) {
        const doc = m.documents.find((d) => d.id === p.documentId);
        if (doc && doc.status !== 'vinculado') doc.status = 'propuesto';
      }
    }, 'propuesta IA', p.source + ' propuso ' + s(p.draft.type) + ' ' + fmtMoney(num(p.draft.amount)) + ' — ' + (s(p.draft.description) || s(p.draft.counterpart) || 'sin glosa'));
    return p;
  }
  function resolveProposal(id, decision, editedDraft) {
    const p = model.proposals.find((x) => x.id === id);
    if (!p) return { success: false, error: 'Propuesta no encontrada.' };
    if (decision === 'aprobar') {
      const draft = Object.assign({}, p.draft, editedDraft || {}, { source: p.source, documentIds: p.documentId ? [p.documentId] : [] });
      const res = upsertMovement(draft, 'aprobación HITL (' + p.source + ')');
      if (!res.success) return res;
      commit((m) => { m.proposals = m.proposals.filter((x) => x.id !== id); },
        'propuesta aprobada', (editedDraft ? 'con ediciones — ' : '') + fmtMoney(num(draft.amount)) + ' ' + s(draft.description || draft.counterpart));
      return res;
    }
    if (decision === 'rechazar') {
      commit((m) => {
        m.proposals = m.proposals.filter((x) => x.id !== id);
        if (p.documentId) {
          const doc = m.documents.find((d) => d.id === p.documentId);
          if (doc && doc.status === 'propuesto') doc.status = 'procesado';
        }
      }, 'propuesta rechazada', fmtMoney(num(p.draft.amount)) + ' ' + s(p.draft.description || p.draft.counterpart) + (editedDraft && editedDraft.reason ? ' — motivo: ' + s(editedDraft.reason) : ''));
      return { success: true };
    }
    if (decision === 'posponer') {
      commit((m) => { m.proposals = m.proposals.map((x) => (x.id === id ? Object.assign({}, x, { status: x.status === 'pospuesta' ? 'pendiente' : 'pospuesta' }) : x)); },
        'propuesta pospuesta', s(p.draft.description || p.draft.counterpart || id));
      return { success: true };
    }
    if (decision === 'reinterpretar') {
      const doc = p.documentId ? docById(p.documentId) : null;
      const text = doc && (doc.textContent || (doc.extraction && doc.extraction.rawText));
      if (!text) return { success: false, error: 'El documento no tiene texto para reinterpretar; pídele al agente KIMOS una nueva lectura OCR.' };
      const ex = extractFromText(text, { fileName: doc.name });
      commit((m) => {
        m.proposals = m.proposals.map((x) => (x.id === id
          ? Object.assign({}, x, { draft: Object.assign({}, x.draft, ex.draft), confidence: ex.confidence, notes: 'Reinterpretada ' + new Date().toLocaleString() })
          : x));
      }, 'propuesta reinterpretada', s(doc.name));
      return { success: true };
    }
    return { success: false, error: 'Decisión desconocida.' };
  }

  // ── OCR + IA Financiera: extractor local (heurísticas) ──────────────────
  // Para XML DTE y texto plano/CSV la extracción es 100% local. Para imágenes
  // y PDF, el texto OCR lo aporta el agente KIMOS (PROPOSE_FROM_TEXT) — la
  // arquitectura es IA-agnóstica: OpenAI, Claude, Gemini, Ollama, MCP, etc.
  function parseAmount(raw) {
    let t = s(raw).replace(/[^\d.,-]/g, '');
    if (!t) return 0;
    const lastDot = t.lastIndexOf('.'); const lastCom = t.lastIndexOf(',');
    if (lastDot >= 0 && lastCom >= 0) {
      const decSep = lastDot > lastCom ? '.' : ',';
      const thouSep = decSep === '.' ? ',' : '.';
      t = t.split(thouSep).join('');
      if (decSep === ',') t = t.replace(',', '.');
    } else if (lastCom >= 0) {
      // solo comas: si el grupo final tiene 3 dígitos es separador de miles
      t = (t.length - lastCom === 4) ? t.split(',').join('') : t.replace(',', '.');
    } else if (lastDot >= 0) {
      t = (t.length - lastDot === 4) ? t.split('.').join('') : t;
    }
    return Math.abs(num(t));
  }
  const RUT_RE = /(\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK])/;
  const MONTHS_ES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  function parseDateFrom(text) {
    let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2}|\d{2})\b/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + pad2(m[2]) + '-' + pad2(m[1]);
    }
    m = text.toLowerCase().match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(20\d{2})\b/);
    if (m && MONTHS_ES[m[2]]) return m[3] + '-' + pad2(MONTHS_ES[m[2]]) + '-' + pad2(m[1]);
    return '';
  }
  function grabAmount(text, keys) {
    for (let i = 0; i < keys.length; i++) {
      const re = new RegExp(keys[i] + '[^\\d$-]{0,12}\\$?\\s*([\\d.,]+)', 'i');
      const m = text.match(re);
      if (m) { const v = parseAmount(m[1]); if (v > 0) return v; }
    }
    return 0;
  }
  function extractFromText(rawText, opts) {
    const text = s(rawText).slice(0, 40000);
    const low = text.toLowerCase();
    const fileName = s(opts && opts.fileName);
    let confidence = 0.35;
    const found = [];

    // Tipo de documento
    let docType = '';
    const TYPES = [
      ['nota de crédito', 'nota de crédito'], ['nota de credito', 'nota de crédito'],
      ['nota de débito', 'nota de débito'], ['nota de debito', 'nota de débito'],
      ['factura electrónica', 'factura'], ['factura electronica', 'factura'], ['factura', 'factura'],
      ['boleta electrónica', 'boleta'], ['boleta electronica', 'boleta'], ['boleta', 'boleta'],
      ['voucher', 'voucher POS'], ['comprobante de venta', 'voucher POS'],
      ['transferencia', 'transferencia'], ['comprobante de pago', 'comprobante de pago'],
    ];
    for (let i = 0; i < TYPES.length; i++) { if (low.indexOf(TYPES[i][0]) >= 0) { docType = TYPES[i][1]; break; } }
    if (docType) { confidence += 0.1; found.push('tipo'); }

    // RUT + contraparte (línea previa al RUT suele ser la razón social)
    let counterpartRut = ''; let counterpart = '';
    const rutM = text.match(RUT_RE);
    if (rutM) {
      counterpartRut = rutM[1].replace(/\s/g, '');
      confidence += 0.12; found.push('rut');
      const lines = text.split(/\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(rutM[1]) >= 0) {
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            const cand = lines[j].trim();
            if (cand.length > 3 && !RUT_RE.test(cand) && !/^(rut|r\.u\.t)/i.test(cand)) { counterpart = cand.slice(0, 80); break; }
          }
          break;
        }
      }
    }
    const senM = text.match(/(?:se[ñn]or\(?e?s?\)?|raz[oó]n social|proveedor|cliente)\s*[:.]?\s*([^\n]{3,80})/i);
    if (senM && !counterpart) counterpart = senM[1].trim();
    if (counterpart) { confidence += 0.08; found.push('contraparte'); }

    // Giro y dirección
    const giroM = text.match(/giro\s*[:.]?\s*([^\n]{3,80})/i);
    const dirM = text.match(/(?:direcci[oó]n|dir\.)\s*[:.]?\s*([^\n]{3,90})/i);

    // Fecha y hora
    const date = parseDateFrom(text);
    if (date) { confidence += 0.12; found.push('fecha'); }
    const timeM = text.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
    const time = timeM ? pad2(timeM[1]) + ':' + timeM[2] : '';

    // Folio / número de documento
    let docNumber = '';
    const folioM = text.match(/(?:folio|n[°ºo]\.?|nro\.?|no\.)\s*[:#]?\s*(\d{2,12})/i);
    if (folioM) { docNumber = folioM[1]; confidence += 0.08; found.push('folio'); }

    // Montos
    const total = grabAmount(text, ['monto\\s+total', 'total\\s+a\\s+pagar', '\\btotal\\b']);
    const neto = grabAmount(text, ['monto\\s+neto', '\\bneto\\b', '\\bsubtotal\\b', 'sub-total']);
    const iva = grabAmount(text, ['\\bi\\.?v\\.?a\\.?(?:\\s*\\(?\\d{1,2}\\s*%?\\)?)?']);
    const exento = grabAmount(text, ['\\bexento\\b', 'monto\\s+exento']);
    const discount = grabAmount(text, ['\\bdescuento\\b', '\\bdscto\\b']);
    const amount = total || (neto + iva + exento) || neto;
    if (amount > 0) { confidence += 0.15; found.push('total'); }
    if (iva > 0) found.push('iva');

    // Forma / medio de pago
    let paymentMethod = '';
    if (/efectivo/i.test(low)) paymentMethod = 'efectivo';
    else if (/(tarjeta\s+de\s+)?d[ée]bito|redcompra/i.test(low)) paymentMethod = 'débito';
    else if (/(tarjeta\s+de\s+)?cr[ée]dito/i.test(low)) paymentMethod = 'crédito';
    else if (/transferencia/i.test(low)) paymentMethod = 'transferencia';
    else if (/cheque/i.test(low)) paymentMethod = 'cheque';
    const cuotasM = low.match(/(\d{1,2})\s*cuotas?/);
    const installments = cuotasM ? Number(cuotasM[1]) : 0;
    const BANKS = ['banco de chile', 'bancoestado', 'banco estado', 'santander', 'bci', 'scotiabank', 'itaú', 'itau', 'banco falabella', 'banco ripley', 'security', 'bice', 'internacional', 'consorcio', 'coopeuch', 'tenpo', 'mach', 'mercado pago'];
    let bank = '';
    for (let i = 0; i < BANKS.length; i++) { if (low.indexOf(BANKS[i]) >= 0) { bank = BANKS[i]; break; } }
    const refM = text.match(/(?:referencia|ref\.?|operaci[oó]n|transacci[oó]n)\s*(?:n[°ºo]\.?|#)?\s*[:#]?\s*([A-Za-z0-9-]{4,24})/i);
    const reference = refM ? refM[1] : '';

    // Detalle de ítems: «cant descripción $precio» (best-effort)
    const items = [];
    const lineRe = /^\s*(\d{1,4})\s+(.{3,60}?)\s+\$?\s*([\d.,]{3,})\s*$/;
    text.split(/\n/).forEach((line) => {
      const m = line.match(lineRe);
      if (m && items.length < 30) {
        const tot = parseAmount(m[3]);
        if (tot > 0 && tot !== num(docNumber)) items.push({ qty: Number(m[1]), desc: m[2].trim(), unit: 0, total: tot });
      }
    });
    if (items.length) found.push('detalle (' + items.length + ' ítems)');

    // Dirección del flujo: si el RUT emisor es el de la empresa activa → venta.
    const myRut = s(activeCompany() && activeCompany().rut).replace(/\s/g, '');
    let type = 'egreso';
    if (docType === 'nota de crédito') type = 'ingreso';
    if (myRut && counterpartRut && myRut.toLowerCase() === counterpartRut.toLowerCase()) type = 'ingreso';

    // Categoría sugerida por palabras clave
    const KEYS = [
      [/supermercado|almac[ée]n|insumo|ferreter[ií]a|mayorista/, 'cat-compras'],
      [/arriendo|arrendamiento|alquiler/, 'cat-arriendo'],
      [/sueldo|remuneraci[oó]n|honorario/, 'cat-sueldos'],
      [/luz|electricidad|agua|gas|internet|tel[ée]fono|enel|movistar|entel|wom|vtr|claro/, 'cat-basicos'],
      [/bencina|combustible|copec|shell|peaje|uber|taxi|pasaje|estacionamiento/, 'cat-transporte'],
      [/publicidad|marketing|google ads|meta ads|facebook/, 'cat-marketing'],
      [/impuesto|tesorer[ií]a|sii|iva\s+a\s+pagar|contribuci[oó]n/, 'cat-impuestos'],
    ];
    let categoryId = '';
    for (let i = 0; i < KEYS.length; i++) { if (KEYS[i][0].test(low)) { categoryId = KEYS[i][1]; break; } }
    if (!categoryId) categoryId = type === 'ingreso' ? 'cat-ventas' : 'cat-otros-out';
    if (!catById(categoryId)) categoryId = '';

    const draft = {
      type, date: date || todayISO(), time, amount, neto, iva, exento, discount,
      description: (docType ? docType + ' ' : '') + (docNumber ? 'N°' + docNumber + ' ' : '') + (counterpart || fileName || 'documento'),
      counterpart, counterpartRut, docType, docNumber, categoryId,
      companyId: model.activeCompanyId, paymentMethod, installments, bank, reference, items,
      notes: [giroM ? 'Giro: ' + giroM[1].trim() : '', dirM ? 'Dirección: ' + dirM[1].trim() : ''].filter(Boolean).join(' · '),
    };
    return { draft, confidence: Math.min(0.95, confidence), found, rawText: text.slice(0, 6000) };
  }

  // XML DTE (factura/boleta electrónica chilena) — parse nativo, sin IA.
  function parseDteXml(xmlText) {
    try {
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      const get = (tag) => { const el = doc.getElementsByTagName(tag)[0]; return el ? s(el.textContent).trim() : ''; };
      if (!doc.getElementsByTagName('DTE').length && !doc.getElementsByTagName('Documento').length) return null;
      const tipoMap = { 33: 'factura', 34: 'factura exenta', 39: 'boleta', 41: 'boleta exenta', 61: 'nota de crédito', 56: 'nota de débito', 52: 'guía de despacho' };
      const tipo = tipoMap[Number(get('TipoDTE'))] || ('DTE ' + get('TipoDTE'));
      const emisorRut = get('RUTEmisor');
      const myRut = s(activeCompany() && activeCompany().rut).replace(/\./g, '').replace(/\s/g, '').toLowerCase();
      const norm = (r) => s(r).replace(/\./g, '').replace(/\s/g, '').toLowerCase();
      const isSale = myRut && norm(emisorRut) === myRut;
      const items = [];
      const detalles = doc.getElementsByTagName('Detalle');
      for (let i = 0; i < detalles.length && i < 60; i++) {
        const dEl = detalles[i];
        const gv = (tag) => { const el = dEl.getElementsByTagName(tag)[0]; return el ? s(el.textContent).trim() : ''; };
        items.push({ qty: num(gv('QtyItem')) || 1, desc: gv('NmbItem') || gv('DscItem'), unit: num(gv('PrcItem')), total: num(gv('MontoItem')) });
      }
      let type = isSale ? 'ingreso' : 'egreso';
      if (tipo === 'nota de crédito') type = isSale ? 'egreso' : 'ingreso';
      const counterpart = isSale ? get('RznSocRecep') : get('RznSoc');
      const counterpartRut = isSale ? get('RUTRecep') : emisorRut;
      const draft = {
        type, date: get('FchEmis') || todayISO(),
        amount: num(get('MntTotal')), neto: num(get('MntNeto')), iva: num(get('IVA')), exento: num(get('MntExe')),
        description: tipo + ' N°' + get('Folio') + ' — ' + counterpart,
        counterpart, counterpartRut, docType: tipo, docNumber: get('Folio'),
        categoryId: type === 'ingreso' ? 'cat-ventas' : 'cat-compras',
        companyId: model.activeCompanyId, items,
        notes: ['Giro: ' + (isSale ? get('GiroRecep') : get('GiroEmis')), 'Dirección: ' + (isSale ? get('DirRecep') : get('DirOrigen'))].filter((x) => x.length > 12).join(' · '),
        dueDate: get('FchVenc'),
      };
      if (!(draft.amount > 0)) return null;
      return { draft, confidence: 0.92, found: ['XML DTE completo'], rawText: '' };
    } catch (e) { return null; }
  }

  // CSV: cartola bancaria / export contable → una propuesta por fila.
  function parseCsvRows(text) {
    const rows = [];
    let cur = ['']; let inQ = false; let row = [];
    const pushCell = () => { row.push(cur.join('')); cur = ['']; };
    const pushRow = () => { pushCell(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur.push('"'); i++; } else inQ = false; }
        else cur.push(ch);
      } else if (ch === '"') inQ = true;
      else if (ch === ',' || ch === ';') pushCell();
      else if (ch === '\n') pushRow();
      else if (ch !== '\r') cur.push(ch);
    }
    pushRow();
    return rows;
  }
  function proposalsFromCsv(text, fileName, documentId) {
    const rows = parseCsvRows(text);
    if (rows.length < 2) return 0;
    const head = rows[0].map((c) => c.trim().toLowerCase());
    const idx = (names) => head.findIndex((hcell) => names.some((n) => hcell.indexOf(n) >= 0));
    const iDate = idx(['fecha', 'date']);
    const iDesc = idx(['descrip', 'glosa', 'detalle', 'concepto']);
    const iAmt = idx(['monto', 'amount', 'total', 'valor']);
    const iIn = idx(['abono', 'ingreso', 'haber', 'dep[oó]sito', 'deposito']);
    const iOut = idx(['cargo', 'egreso', 'debe', 'giro']);
    const iType = idx(['tipo']);
    if (iAmt < 0 && iIn < 0 && iOut < 0) return 0;
    let count = 0;
    for (let r = 1; r < rows.length && count < 200; r++) {
      const cells = rows[r];
      const inAmt = iIn >= 0 ? parseAmount(cells[iIn]) : 0;
      const outAmt = iOut >= 0 ? parseAmount(cells[iOut]) : 0;
      let amount = inAmt || outAmt || (iAmt >= 0 ? parseAmount(cells[iAmt]) : 0);
      if (!(amount > 0)) continue;
      let type = inAmt > 0 ? 'ingreso' : outAmt > 0 ? 'egreso' : 'egreso';
      if (iType >= 0 && /ingreso|abono|venta/i.test(s(cells[iType]))) type = 'ingreso';
      if (iAmt >= 0 && s(cells[iAmt]).indexOf('-') >= 0) type = 'egreso';
      const date = iDate >= 0 ? (parseDateFrom(s(cells[iDate])) || todayISO()) : todayISO();
      createProposal({
        type, date, amount,
        description: (iDesc >= 0 ? s(cells[iDesc]).trim().slice(0, 120) : '') || (fileName + ' fila ' + r),
        categoryId: type === 'ingreso' ? 'cat-ventas' : 'cat-otros-out',
        companyId: model.activeCompanyId,
      }, { source: 'importación CSV', documentId, confidence: 0.6, notes: fileName + ' · fila ' + r });
      count++;
    }
    return count;
  }

  // ── Gestor Documental ───────────────────────────────────────────────────
  const MAX_DOC_BYTES = 1200 * 1024; // límite por archivo dentro del modelo
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1400;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }
  const readAsText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(s(r.result)); r.onerror = () => rej(r.error); r.readAsText(file); });
  const readAsDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(s(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(file); });

  async function addFiles(fileList, opts) {
    const files = Array.from(fileList || []);
    let ok = 0; let proposals = 0; const errors = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = s(file.name) || 'documento';
      const lowName = name.toLowerCase();
      const mime = s(file.type);
      try {
        const docId = uid('doc');
        const doc = {
          id: docId, name, mime, size: file.size, uploadedAt: nowIso(),
          companyId: model.activeCompanyId, status: 'pendiente',
          dataUrl: '', textContent: '', movementId: '', extraction: null,
          origin: s(opts && opts.origin) || 'carga',
        };
        const isImage = mime.indexOf('image/') === 0;
        const isXml = mime.indexOf('xml') >= 0 || /\.xml$/.test(lowName);
        const isCsv = mime.indexOf('csv') >= 0 || /\.csv$/.test(lowName);
        const isText = mime.indexOf('text/') === 0 || /\.(txt|json)$/.test(lowName);
        const isPdf = mime === 'application/pdf' || /\.pdf$/.test(lowName);
        const isExcel = /\.(xlsx?|ods)$/.test(lowName) || mime.indexOf('spreadsheet') >= 0 || mime.indexOf('ms-excel') >= 0;

        if (isImage) {
          doc.dataUrl = await compressImage(file);
          if (doc.dataUrl.length > MAX_DOC_BYTES * 1.4) throw new Error('imagen demasiado grande incluso comprimida');
          doc.size = Math.round(doc.dataUrl.length * 0.75);
        } else if (isXml || isCsv || (isText && !isExcel)) {
          if (file.size > MAX_DOC_BYTES) throw new Error('archivo de texto supera 1,2 MB');
          doc.textContent = await readAsText(file);
        } else if (isPdf || isExcel) {
          if (file.size > MAX_DOC_BYTES) throw new Error((isPdf ? 'PDF' : 'Excel') + ' supera 1,2 MB — súbelo comprimido o como imagen');
          doc.dataUrl = await readAsDataUrl(file);
        } else {
          if (file.size > MAX_DOC_BYTES) throw new Error('archivo supera 1,2 MB');
          doc.dataUrl = await readAsDataUrl(file);
        }

        commit((m) => { m.documents.unshift(doc); }, 'documento cargado', name + ' (' + (doc.origin) + ')');
        ok++;

        // Extracción automática → SIEMPRE como propuesta (Human in the Loop).
        if (isXml && doc.textContent) {
          const dte = parseDteXml(doc.textContent);
          if (dte) {
            createProposal(dte.draft, { source: 'XML DTE', documentId: docId, confidence: dte.confidence, notes: 'Parseado localmente desde ' + name });
            proposals++;
          } else {
            const ex = extractFromText(doc.textContent, { fileName: name });
            if (num(ex.draft.amount) > 0) { createProposal(ex.draft, { source: 'extractor local', documentId: docId, confidence: ex.confidence, notes: 'Campos: ' + ex.found.join(', ') }); proposals++; }
          }
        } else if (isCsv && doc.textContent) {
          proposals += proposalsFromCsv(doc.textContent, name, docId);
        } else if (isText && doc.textContent) {
          const ex = extractFromText(doc.textContent, { fileName: name });
          if (num(ex.draft.amount) > 0) { createProposal(ex.draft, { source: 'extractor local', documentId: docId, confidence: ex.confidence, notes: 'Campos: ' + ex.found.join(', ') }); proposals++; }
        }
        // Imágenes/PDF quedan 'pendiente': el agente KIMOS (o el usuario con
        // «pegar texto») aporta el OCR → PROPOSE_FROM_TEXT referencia el doc.
      } catch (e) {
        errors.push(name + ': ' + ((e && e.message) || 'error'));
      }
    }
    if (shell.notify) {
      if (ok) shell.notify({ level: 'success', text: ok + ' documento(s) cargado(s)' + (proposals ? ' · ' + proposals + ' propuesta(s) en Revisión ✅' : '') + '.' });
      if (errors.length) shell.notify({ level: 'warn', text: 'No cargados — ' + errors.slice(0, 3).join(' · ') });
    }
    return { ok, proposals, errors };
  }
  function deleteDocument(id) {
    const doc = docById(id);
    if (!doc) return;
    commit((m) => {
      m.documents = m.documents.filter((d) => d.id !== id);
      m.proposals = m.proposals.filter((p) => p.documentId !== id);
      m.movements.forEach((mv) => { mv.documentIds = (mv.documentIds || []).filter((x) => x !== id); });
    }, 'documento eliminado', doc.name);
  }

  // ── Analítica financiera ────────────────────────────────────────────────
  function rangeFor(mode, customFrom, customTo) {
    const now = new Date();
    const y = now.getFullYear(); const mo = now.getMonth();
    if (mode === 'dia') { const t = todayISO(); return [t, t]; }
    if (mode === 'semana') {
      const dow = (now.getDay() + 6) % 7;
      const from = new Date(y, mo, now.getDate() - dow);
      const to = new Date(y, mo, now.getDate() - dow + 6);
      return [toLocalISO(from), toLocalISO(to)];
    }
    if (mode === 'mes') return [toLocalISO(new Date(y, mo, 1)), toLocalISO(new Date(y, mo + 1, 0))];
    if (mode === 'trimestre') { const q = Math.floor(mo / 3) * 3; return [toLocalISO(new Date(y, q, 1)), toLocalISO(new Date(y, q + 3, 0))]; }
    if (mode === 'anio') return [y + '-01-01', y + '-12-31'];
    if (mode === 'personalizado') return [s(customFrom) || '0000-01-01', s(customTo) || '9999-12-31'];
    return ['0000-01-01', '9999-12-31'];
  }
  function movsOf(companyId) {
    return model.movements.filter((mv) => !companyId || mv.companyId === companyId);
  }
  function inRange(mv, from, to) { return mv.date >= from && mv.date <= to; }
  function sumBy(list, pred) { return list.reduce((acc, mv) => acc + (pred(mv) ? mv.amount : 0), 0); }

  function computeKpis(companyId, from, to) {
    const all = movsOf(companyId);
    const inPeriod = all.filter((mv) => inRange(mv, from, to));
    const done = (mv) => mv.status === 'realizado';
    const income = sumBy(inPeriod, (mv) => mv.type === 'ingreso' && done(mv));
    const expense = sumBy(inPeriod, (mv) => mv.type === 'egreso' && done(mv));
    const receivable = sumBy(all, (mv) => mv.type === 'ingreso' && mv.status === 'pendiente');
    const payable = sumBy(all, (mv) => mv.type === 'egreso' && mv.status === 'pendiente');
    const initial = model.accounts.filter((a) => !companyId || a.companyId === companyId).reduce((acc, a) => acc + num(a.initialBalance), 0);
    const balance = initial + sumBy(all, (mv) => mv.type === 'ingreso' && done(mv)) - sumBy(all, (mv) => mv.type === 'egreso' && done(mv));
    // Liquidez: días de cobertura al ritmo de egresos de los últimos 90 días.
    const d90 = toLocalISO(new Date(Date.now() - 90 * 864e5));
    const spent90 = sumBy(all, (mv) => mv.type === 'egreso' && done(mv) && mv.date >= d90);
    const dailyBurn = spent90 / 90;
    const runwayDays = dailyBurn > 0 ? Math.floor(balance / dailyBurn) : Infinity;
    return { income, expense, net: income - expense, balance, receivable, payable, dailyBurn, runwayDays };
  }
  function monthlySeries(companyId, months) {
    const out = [];
    const cur = monthKey(todayISO());
    const start = addMonths(cur, -(months - 1));
    const all = movsOf(companyId).filter((mv) => mv.status === 'realizado');
    for (let i = 0; i < months; i++) {
      const ym = addMonths(start, i);
      const ms = all.filter((mv) => monthKey(mv.date) === ym);
      out.push({
        ym, label: monthLabel(ym),
        income: sumBy(ms, (mv) => mv.type === 'ingreso'),
        expense: sumBy(ms, (mv) => mv.type === 'egreso'),
      });
    }
    return out;
  }
  function groupTotals(list, keyFn, labelFn) {
    const map = new Map();
    list.forEach((mv) => {
      const k = keyFn(mv) || '__none__';
      map.set(k, (map.get(k) || 0) + mv.amount);
    });
    return Array.from(map.entries())
      .map(([k, total]) => ({ key: k, label: labelFn(k), total }))
      .sort((a, b) => b.total - a.total);
  }

  // ── Proyecciones (tendencia + recurrentes + CxC/CxP) ────────────────────
  function projection(companyId, monthsAhead) {
    const hist = monthlySeries(companyId, 6);
    const nets = hist.map((mth) => mth.income - mth.expense);
    const n = nets.length;
    // Regresión lineal simple sobre el neto mensual histórico.
    let slope = 0; let intercept = 0;
    const withData = hist.filter((mth) => mth.income || mth.expense).length;
    if (withData >= 2) {
      const xs = nets.map((_, i) => i);
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const my = nets.reduce((a, b) => a + b, 0) / n;
      let den = 0; let numr = 0;
      for (let i = 0; i < n; i++) { numr += (xs[i] - mx) * (nets[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
      slope = den ? numr / den : 0;
      intercept = my - slope * mx;
    }
    const all = movsOf(companyId);
    const recurrents = all.filter((mv) => mv.recurrence === 'mensual' && mv.status === 'realizado');
    const recNet = recurrents.reduce((acc, mv) => acc + (mv.type === 'ingreso' ? mv.amount : -mv.amount), 0);
    const kpis = computeKpis(companyId, '0000-01-01', '9999-12-31');
    const rows = [];
    let bal = kpis.balance;
    const cur = monthKey(todayISO());
    for (let i = 1; i <= monthsAhead; i++) {
      const ym = addMonths(cur, i);
      const trendNet = withData >= 2 ? intercept + slope * (n - 1 + i) : recNet;
      const cxc = sumBy(all, (mv) => mv.type === 'ingreso' && mv.status === 'pendiente' && monthKey(mv.dueDate || mv.date) === ym);
      const cxp = sumBy(all, (mv) => mv.type === 'egreso' && mv.status === 'pendiente' && monthKey(mv.dueDate || mv.date) === ym);
      const net = trendNet + cxc - cxp;
      bal += net;
      rows.push({ ym, label: monthLabel(ym), trendNet, cxc, cxp, net, balance: bal });
    }
    return { rows, basis: withData >= 2 ? 'tendencia de ' + withData + ' meses con datos' : 'recurrentes mensuales', recNet };
  }
  function budgetExecution(companyId, ym) {
    return model.budgets
      .filter((b) => b.companyId === companyId && b.period === ym)
      .map((b) => {
        const spent = sumBy(movsOf(companyId), (mv) => mv.type === 'egreso' && mv.status === 'realizado' && mv.categoryId === b.categoryId && monthKey(mv.date) === ym);
        return Object.assign({}, b, { spent, pct: b.amount > 0 ? spent / b.amount : 0 });
      });
  }

  // ── Análisis Financiero Inteligente (detección de hallazgos) ────────────
  function detectIssues(companyId) {
    const issues = [];
    const all = movsOf(companyId).filter((mv) => mv.status === 'realizado');
    const push = (sev, icon, title, detail, reco) => issues.push({ id: uid('iss'), sev, icon, title, detail, reco });

    // 1) Gastos/movimientos duplicados (mismo tipo, fecha, monto y contraparte)
    const seen = new Map();
    all.forEach((mv) => {
      const k = [mv.type, mv.date, mv.amount, (mv.counterpart || mv.description).toLowerCase().slice(0, 30)].join('|');
      if (seen.has(k)) {
        push('high', '👯', 'Posible ' + mv.type + ' duplicado',
          fmtDate(mv.date) + ' · ' + fmtMoney(mv.amount) + ' · ' + (mv.counterpart || mv.description),
          'Revisa ambos registros en Movimientos y elimina el duplicado si corresponde.');
      } else seen.set(k, mv.id);
    });

    // 2) Documentos repetidos (mismo folio+RUT o mismo nombre+tamaño)
    const docSeen = new Map();
    model.documents.forEach((d) => {
      const ex = d.extraction || {};
      const k1 = ex.docNumber && ex.counterpartRut ? 'f:' + ex.docNumber + '|' + ex.counterpartRut : '';
      const k2 = 'n:' + d.name + '|' + d.size;
      [k1, k2].filter(Boolean).forEach((k) => {
        if (docSeen.has(k) && docSeen.get(k) !== d.id) {
          push('med', '📄', 'Documento posiblemente repetido', d.name, 'Verifica en Documentos antes de aprobar propuestas asociadas.');
        } else docSeen.set(k, d.id);
      });
    });

    // 3) Inconsistencias neto+IVA+exento ≠ total
    all.forEach((mv) => {
      if (mv.neto > 0 && mv.iva > 0) {
        const calc = mv.neto + mv.iva + num(mv.exento);
        if (Math.abs(calc - mv.amount) > Math.max(2, mv.amount * 0.01)) {
          push('med', '⚖️', 'Inconsistencia de montos', (mv.description || mv.counterpart) + ': neto+IVA+exento = ' + fmtMoney(calc) + ' pero total = ' + fmtMoney(mv.amount), 'Edita el movimiento y corrige el desglose.');
        }
        const expectedIva = Math.round(mv.neto * (num(model.settings.ivaRate) / 100));
        if (expectedIva > 0 && Math.abs(expectedIva - mv.iva) > Math.max(2, expectedIva * 0.05)) {
          push('low', '🧾', 'IVA no calza con la tasa configurada (' + model.settings.ivaRate + '%)', (mv.description || mv.counterpart) + ': IVA registrado ' + fmtMoney(mv.iva) + ', esperado ' + fmtMoney(expectedIva), 'Confirma si el documento tiene impuestos adicionales o ítems exentos.');
        }
      }
    });

    // 4) Baja liquidez (runway bajo el umbral configurado)
    const kpis = computeKpis(companyId, '0000-01-01', '9999-12-31');
    if (kpis.dailyBurn > 0 && kpis.runwayDays < num(model.settings.liquidityDays)) {
      push('high', '🚨', 'Baja liquidez: ' + (kpis.runwayDays < 0 ? 'saldo negativo' : 'cobertura de ' + kpis.runwayDays + ' días'),
        'Saldo ' + fmtMoney(kpis.balance) + ' vs egreso promedio diario ' + fmtMoney(kpis.dailyBurn) + ' (umbral: ' + model.settings.liquidityDays + ' días).',
        'Acelera cobros (CxC ' + fmtMoney(kpis.receivable) + '), renegocia pagos (CxP ' + fmtMoney(kpis.payable) + ') o refuerza caja.');
    }

    // 5) Gastos inusuales (> media + 2σ de su categoría, mínimo 5 muestras)
    const byCat = new Map();
    all.filter((mv) => mv.type === 'egreso').forEach((mv) => {
      const k = mv.categoryId || 'sin';
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k).push(mv);
    });
    byCat.forEach((list, k) => {
      if (list.length < 5) return;
      const vals = list.map((mv) => mv.amount);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length);
      list.forEach((mv) => {
        if (sd > 0 && mv.amount > mean + 2 * sd) {
          const cat = catById(k);
          push('med', '📈', 'Gasto inusual en ' + (cat ? cat.name : 'sin categoría'),
            fmtDate(mv.date) + ' · ' + fmtMoney(mv.amount) + ' (' + (mv.description || mv.counterpart) + ') vs promedio ' + fmtMoney(mean),
            'Valida el documento de respaldo y su clasificación.');
        }
      });
    });

    // 6) Alza de costos / caída de ingresos (mes actual vs 3 previos)
    const hist = monthlySeries(companyId, 4);
    const prev = hist.slice(0, 3); const curM = hist[3];
    const avg = (arr, f) => arr.reduce((a, b) => a + f(b), 0) / (arr.length || 1);
    const avgExp = avg(prev, (mth) => mth.expense); const avgInc = avg(prev, (mth) => mth.income);
    if (avgExp > 0 && curM.expense > avgExp * 1.25) {
      push('med', '💸', 'Aumento del costo operacional', 'Egresos de ' + curM.label + ': ' + fmtMoney(curM.expense) + ' (+' + Math.round((curM.expense / avgExp - 1) * 100) + '% sobre el promedio trimestral).', 'Revisa Gastos por categoría en el Dashboard para ubicar el origen.');
    }
    if (avgInc > 0 && curM.income < avgInc * 0.75) {
      push('med', '📉', 'Disminución de ingresos', 'Ingresos de ' + curM.label + ': ' + fmtMoney(curM.income) + ' (−' + Math.round((1 - curM.income / avgInc) * 100) + '% bajo el promedio trimestral).', 'Cruza con tus proyectos/clientes activos y refuerza la gestión comercial.');
    }

    // 7) Presupuestos excedidos del mes en curso
    budgetExecution(companyId, monthKey(todayISO())).forEach((b) => {
      const cat = catById(b.categoryId);
      if (b.pct >= 1) push('high', '🎯', 'Presupuesto excedido: ' + (cat ? cat.name : ''), fmtMoney(b.spent) + ' de ' + fmtMoney(b.amount) + ' (' + Math.round(b.pct * 100) + '%).', 'Congela gastos de la categoría o re-presupuesta el mes.');
      else if (b.pct >= 0.85) push('med', '🎯', 'Presupuesto al límite: ' + (cat ? cat.name : ''), fmtMoney(b.spent) + ' de ' + fmtMoney(b.amount) + ' (' + Math.round(b.pct * 100) + '%).', 'Quedan ' + fmtMoney(Math.max(0, b.amount - b.spent)) + ' disponibles este mes.');
    });

    // 8) CxC / CxP vencidas
    const today = todayISO();
    movsOf(companyId).filter((mv) => mv.status === 'pendiente' && mv.dueDate && mv.dueDate < today).forEach((mv) => {
      push(mv.type === 'egreso' ? 'high' : 'med', '⏰', (mv.type === 'ingreso' ? 'Cuenta por cobrar' : 'Cuenta por pagar') + ' vencida',
        (mv.counterpart || mv.description) + ' · ' + fmtMoney(mv.amount) + ' · vencía el ' + fmtDate(mv.dueDate),
        mv.type === 'ingreso' ? 'Gestiona la cobranza y registra el pago al recibirlo.' : 'Paga o renegocia para evitar recargos.');
    });

    const order = { high: 0, med: 1, low: 2 };
    return issues.sort((a, b) => order[a.sev] - order[b.sev]).slice(0, 40);
  }

  // ── Libro Diario Inteligente (asientos derivados) ───────────────────────
  function journalEntries(companyId, from, to) {
    const movs = movsOf(companyId).filter((mv) => inRange(mv, from, to))
      .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
    let n = 0;
    return movs.map((mv) => {
      n++;
      const acc = accById(mv.accountId);
      const accName = acc ? acc.name : (mv.type === 'ingreso' ? 'Caja' : 'Caja');
      const cat = catById(mv.categoryId);
      const catName = cat ? cat.name : (mv.type === 'ingreso' ? 'Ingresos varios' : 'Gastos varios');
      const pending = mv.status === 'pendiente';
      const net = mv.neto > 0 ? mv.neto : Math.max(0, mv.amount - mv.iva - num(mv.exento));
      const lines = [];
      if (mv.type === 'ingreso') {
        lines.push({ account: pending ? 'Clientes (por cobrar)' : accName, debit: mv.amount, credit: 0 });
        lines.push({ account: catName, debit: 0, credit: mv.iva > 0 ? net + num(mv.exento) : mv.amount });
        if (mv.iva > 0) lines.push({ account: 'IVA Débito Fiscal', debit: 0, credit: mv.iva });
      } else {
        lines.push({ account: catName, debit: mv.iva > 0 ? net + num(mv.exento) : mv.amount, credit: 0 });
        if (mv.iva > 0) lines.push({ account: 'IVA Crédito Fiscal', debit: mv.iva, credit: 0 });
        lines.push({ account: pending ? 'Proveedores (por pagar)' : accName, debit: 0, credit: mv.amount });
      }
      const gloss = [
        mv.docType ? mv.docType + (mv.docNumber ? ' N°' + mv.docNumber : '') : '',
        mv.counterpart, mv.counterpartRut, mv.description,
      ].filter(Boolean).join(' · ');
      return { n, id: mv.id, date: mv.date, gloss: gloss || 'Movimiento ' + mv.type, lines, source: mv.source, pending };
    });
  }

  // ── Control por agente (shell.agent.register) ───────────────────────────
  // IA agnóstica: cualquier agente del ecosistema KIMOS (OpenAI, Claude,
  // Gemini, Ollama, modelos locales, MCP) actúa por este contrato. Las tools
  // de escritura financiera SOLO crean propuestas → Human in the Loop.
  let agentRegistered = false;
  function registerAgent() {
    if (!shell.agent || typeof shell.agent.register !== 'function') return;
    try {
      shell.agent.register({
        label: 'KIMOS Cashflow',
        description: 'Agente Financiero Inteligente: consulta KPIs y movimientos, corre el análisis financiero y PROPONE registros desde documentos/texto OCR. Ninguna propuesta se contabiliza sin aprobación humana (Human in the Loop).',
        tools: [
          {
            name: 'PROPOSE_MOVEMENT',
            description: 'Propone un ingreso o egreso. Queda en la bandeja de Revisión hasta que el usuario lo apruebe, edite o rechace.',
            inputSchema: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['ingreso', 'egreso'] },
                amount: { type: 'number', description: 'Monto total (bruto)' },
                date: { type: 'string', description: 'YYYY-MM-DD' },
                description: { type: 'string' },
                counterpart: { type: 'string', description: 'Proveedor o cliente' },
                counterpartRut: { type: 'string' },
                neto: { type: 'number' }, iva: { type: 'number' }, exento: { type: 'number' },
                docType: { type: 'string' }, docNumber: { type: 'string' },
                categoryName: { type: 'string', description: 'Nombre de categoría existente (ver snapshot)' },
                projectName: { type: 'string' }, costCenterName: { type: 'string' },
                paymentMethod: { type: 'string' }, bank: { type: 'string' }, reference: { type: 'string' },
                pending: { type: 'boolean', description: 'true = cuenta por cobrar/pagar' },
                dueDate: { type: 'string' },
                documentId: { type: 'string', description: 'ID de documento ya cargado al que se asocia' },
                confidence: { type: 'number' }, notes: { type: 'string' },
              },
              required: ['type', 'amount', 'description'],
            },
          },
          {
            name: 'PROPOSE_FROM_TEXT',
            description: 'Corre el extractor financiero de la app sobre texto OCR/plano de un documento (boleta, factura, voucher, transferencia) y crea una propuesta para revisión humana.',
            inputSchema: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Texto completo del documento' },
                documentId: { type: 'string', description: 'ID del documento cargado (opcional)' },
                fileName: { type: 'string' },
              },
              required: ['text'],
            },
          },
          {
            name: 'LIST_MOVEMENTS',
            description: 'Lista movimientos de la empresa activa con filtros.',
            inputSchema: {
              type: 'object',
              properties: {
                from: { type: 'string' }, to: { type: 'string' },
                type: { type: 'string', enum: ['ingreso', 'egreso'] },
                search: { type: 'string' }, limit: { type: 'number' },
              },
            },
          },
          {
            name: 'GET_FINANCIAL_SUMMARY',
            description: 'KPIs (ingresos, egresos, utilidad, saldo, liquidez, CxC, CxP) y top categorías de un rango de fechas.',
            inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } },
          },
          {
            name: 'RUN_ANALYSIS',
            description: 'Ejecuta el Análisis Financiero Inteligente: duplicados, inconsistencias, liquidez, gastos inusuales, tendencias y presupuestos.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'ADD_CATEGORY',
            description: 'Crea una categoría personalizada.',
            inputSchema: { type: 'object', properties: { name: { type: 'string' }, kind: { type: 'string', enum: ['ingreso', 'egreso'] }, color: { type: 'string' } }, required: ['name', 'kind'] },
          },
          {
            name: 'ADD_PROJECT',
            description: 'Crea un proyecto.',
            inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
          },
          {
            name: 'ADD_COST_CENTER',
            description: 'Crea un centro de costos.',
            inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
          },
        ],
        getSnapshot: () => {
          const [from, to] = rangeFor('mes');
          const k = computeKpis(model.activeCompanyId, from, to);
          return {
            activeCompany: activeCompany() ? { id: activeCompany().id, name: activeCompany().name, rut: activeCompany().rut } : null,
            companies: model.companies.map((c) => ({ id: c.id, name: c.name, rut: c.rut })),
            currency: model.settings.currency,
            accounts: model.accounts.filter((a) => a.companyId === model.activeCompanyId).map((a) => ({ id: a.id, name: a.name, type: a.type })),
            categories: model.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
            projects: model.projects.map((p) => ({ id: p.id, name: p.name })),
            costCenters: model.costCenters.map((c) => ({ id: c.id, name: c.name })),
            monthKpis: { income: k.income, expense: k.expense, net: k.net, balance: k.balance, receivable: k.receivable, payable: k.payable, runwayDays: k.runwayDays === Infinity ? null : k.runwayDays },
            pendingProposals: model.proposals.map((p) => ({ id: p.id, status: p.status, source: p.source, type: s(p.draft.type), amount: num(p.draft.amount), description: s(p.draft.description) })),
            documentsAwaitingOcr: model.documents.filter((d) => d.status === 'pendiente' && !d.textContent).map((d) => ({ id: d.id, name: d.name, mime: d.mime })),
            movementsCount: model.movements.length,
            humanInTheLoop: 'Las propuestas requieren aprobación del usuario en la pestaña Revisión.',
          };
        },
        dispatchAction: async (action) => {
          const type = s(action && action.type).toUpperCase();
          const p = (action && action.payload) || {};
          try {
            if (type === 'PROPOSE_MOVEMENT') {
              const byName = (list, name) => { const t = s(name).trim().toLowerCase(); return t ? (list.find((x) => x.name.toLowerCase() === t) || null) : null; };
              const cat = byName(model.categories, p.categoryName);
              const prj = byName(model.projects, p.projectName);
              const cc = byName(model.costCenters, p.costCenterName);
              const prop = createProposal({
                type: p.type, amount: p.amount, date: p.date, description: p.description,
                counterpart: p.counterpart, counterpartRut: p.counterpartRut,
                neto: p.neto, iva: p.iva, exento: p.exento, docType: p.docType, docNumber: p.docNumber,
                categoryId: cat ? cat.id : '', projectId: prj ? prj.id : '', costCenterId: cc ? cc.id : '',
                paymentMethod: p.paymentMethod, bank: p.bank, reference: p.reference,
                status: p.pending ? 'pendiente' : 'realizado', dueDate: p.dueDate,
                companyId: model.activeCompanyId,
              }, { source: 'agente KIMOS', documentId: s(p.documentId), confidence: p.confidence, notes: p.notes });
              return { success: true, message: 'Propuesta ' + prop.id + ' creada. Requiere aprobación humana en Revisión (Human in the Loop).' };
            }
            if (type === 'PROPOSE_FROM_TEXT') {
              if (!s(p.text).trim()) return { success: false, error: 'text vacío.' };
              const ex = extractFromText(p.text, { fileName: s(p.fileName) });
              if (!(num(ex.draft.amount) > 0)) return { success: false, error: 'No se pudo determinar un monto en el texto. Entrega el texto OCR completo o usa PROPOSE_MOVEMENT con los campos ya interpretados.' };
              const docId = s(p.documentId);
              if (docId && docById(docId)) {
                commit((m) => { const d = m.documents.find((x) => x.id === docId); if (d) d.extraction = Object.assign({}, ex.draft, { rawText: ex.rawText }); }, null);
              }
              const prop = createProposal(ex.draft, { source: 'OCR agente KIMOS', documentId: docId, confidence: ex.confidence, notes: 'Campos detectados: ' + ex.found.join(', ') });
              return { success: true, message: 'Propuesta ' + prop.id + ' creada desde texto (confianza ' + Math.round(ex.confidence * 100) + '%). Requiere aprobación humana.' };
            }
            if (type === 'LIST_MOVEMENTS') {
              const from = s(p.from) || '0000-01-01'; const to = s(p.to) || '9999-12-31';
              const q = s(p.search).toLowerCase();
              const list = movsOf(model.activeCompanyId)
                .filter((mv) => inRange(mv, from, to))
                .filter((mv) => !p.type || mv.type === p.type)
                .filter((mv) => !q || (mv.description + ' ' + mv.counterpart + ' ' + mv.docNumber).toLowerCase().indexOf(q) >= 0)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, Math.min(200, num(p.limit) || 50))
                .map((mv) => ({ id: mv.id, type: mv.type, status: mv.status, date: mv.date, amount: mv.amount, description: mv.description, counterpart: mv.counterpart, category: (catById(mv.categoryId) || {}).name || '', project: (projById(mv.projectId) || {}).name || '' }));
              return { success: true, message: list.length + ' movimiento(s).', movements: list };
            }
            if (type === 'GET_FINANCIAL_SUMMARY') {
              const from = s(p.from) || rangeFor('mes')[0]; const to = s(p.to) || rangeFor('mes')[1];
              const k = computeKpis(model.activeCompanyId, from, to);
              const period = movsOf(model.activeCompanyId).filter((mv) => inRange(mv, from, to) && mv.status === 'realizado');
              const topExpense = groupTotals(period.filter((mv) => mv.type === 'egreso'), (mv) => mv.categoryId, (kk) => (catById(kk) || {}).name || 'Sin categoría').slice(0, 8);
              return { success: true, summary: Object.assign({ from, to, currency: model.settings.currency }, k, { runwayDays: k.runwayDays === Infinity ? null : k.runwayDays, topExpenseCategories: topExpense }) };
            }
            if (type === 'RUN_ANALYSIS') {
              const issues = detectIssues(model.activeCompanyId).map((i) => ({ severity: i.sev, title: i.title, detail: i.detail, recommendation: i.reco }));
              return { success: true, message: issues.length + ' hallazgo(s).', issues };
            }
            if (type === 'ADD_CATEGORY') return addCatalogItem('category', p, 'agente KIMOS');
            if (type === 'ADD_PROJECT') return addCatalogItem('project', p, 'agente KIMOS');
            if (type === 'ADD_COST_CENTER') return addCatalogItem('costCenter', p, 'agente KIMOS');
            return { success: false, error: 'Acción desconocida: ' + type };
          } catch (e) { return { success: false, error: (e && e.message) || 'error interno' }; }
        },
      });
      agentRegistered = true;
    } catch (e) { /* shell sin soporte de agente: la app funciona igual */ }
  }

  // ── UI: helpers compartidos ─────────────────────────────────────────────
  const DOC_TYPES = ['', 'boleta', 'factura', 'factura exenta', 'nota de crédito', 'nota de débito', 'voucher POS', 'transferencia', 'comprobante de pago', 'guía de despacho', 'otro'];
  const PAY_METHODS = ['', 'efectivo', 'débito', 'crédito', 'transferencia', 'cheque', 'otro'];
  function Field(label, control, full) {
    return h('label', { className: 'kcf-field' + (full ? ' full' : '') }, h('span', null, label), control);
  }
  function Sel(props, options) {
    return h('select', Object.assign({ className: 'kcf-input' }, props),
      options.map((o) => h('option', { key: s(o.value), value: o.value }, o.label)));
  }
  const catOptions = (kind) => [{ value: '', label: '— categoría —' }].concat(
    model.categories.filter((c) => !kind || c.kind === kind).map((c) => ({ value: c.id, label: c.name })));
  const accOptions = () => [{ value: '', label: '— cuenta/caja —' }].concat(
    model.accounts.filter((a) => a.companyId === model.activeCompanyId).map((a) => ({ value: a.id, label: (a.type === 'banco' ? '🏦 ' : '💵 ') + a.name })));
  const projOptions = () => [{ value: '', label: '— proyecto —' }].concat(model.projects.map((p) => ({ value: p.id, label: p.name })));
  const ccOptions = () => [{ value: '', label: '— centro de costos —' }].concat(model.costCenters.map((c) => ({ value: c.id, label: c.name })));

  // ── UI: editor de movimiento (crear / editar / aprobar con ediciones) ───
  function MovementModal({ initial, title, onSave, onCancel, saveLabel }) {
    const [f, setF] = useState(() => Object.assign({
      type: 'egreso', status: 'realizado', date: todayISO(), time: '', dueDate: '',
      amount: '', neto: '', iva: '', exento: '', discount: '', description: '',
      counterpart: '', counterpartRut: '', docType: '', docNumber: '',
      categoryId: '', projectId: '', costCenterId: '', accountId: '',
      paymentMethod: '', installments: '', bank: '', reference: '', recurrence: '', notes: '',
    }, initial || {}));
    const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e && e.target ? e.target.value : e }));
    const setType = (t) => setF(Object.assign({}, f, { type: t, categoryId: '' }));
    const autoIva = () => {
      const amt = num(f.amount);
      if (amt > 0) {
        const rate = num(model.settings.ivaRate) / 100;
        const neto = Math.round(amt / (1 + rate));
        setF(Object.assign({}, f, { neto: String(neto), iva: String(amt - neto) }));
      }
    };
    return h('div', { className: 'kcf-overlay', onClick: (e) => { if (e.target === e.currentTarget) onCancel(); } },
      h('div', { className: 'kcf-modal' },
        h('div', { className: 'kcf-modal-head' },
          h('span', null, f.type === 'ingreso' ? '🟢' : '🔴'), title,
          h('span', { className: 'kcf-spacer' }),
          h('button', { className: 'kcf-mini', onClick: onCancel, title: 'Cerrar' }, '✕')),
        h('div', { className: 'kcf-modal-body' },
          h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' } },
            h('div', { className: 'kcf-seg' },
              h('button', { className: f.type === 'ingreso' ? 'active in' : '', onClick: () => setType('ingreso') }, '↑ Ingreso'),
              h('button', { className: f.type === 'egreso' ? 'active out' : '', onClick: () => setType('egreso') }, '↓ Egreso')),
            h('div', { className: 'kcf-seg' },
              h('button', { className: f.status === 'realizado' ? 'active' : '', onClick: () => setF(Object.assign({}, f, { status: 'realizado' })) }, 'Realizado'),
              h('button', { className: f.status === 'pendiente' ? 'active' : '', onClick: () => setF(Object.assign({}, f, { status: 'pendiente' })) },
                f.type === 'ingreso' ? 'Por cobrar' : 'Por pagar'))),
          h('div', { className: 'kcf-form' },
            Field('Fecha', h('input', { className: 'kcf-input', type: 'date', value: f.date, onChange: set('date') })),
            Field('Hora', h('input', { className: 'kcf-input', type: 'time', value: f.time, onChange: set('time') })),
            Field('Monto total *', h('input', { className: 'kcf-input', type: 'number', min: 0, step: 'any', value: f.amount, onChange: set('amount'), placeholder: '0' })),
            Field('Neto / IVA', h('div', { style: { display: 'flex', gap: '6px' } },
              h('input', { className: 'kcf-input', type: 'number', min: 0, step: 'any', value: f.neto, onChange: set('neto'), placeholder: 'neto', style: { width: '50%' } }),
              h('input', { className: 'kcf-input', type: 'number', min: 0, step: 'any', value: f.iva, onChange: set('iva'), placeholder: 'IVA', style: { width: '35%' } }),
              h('button', { className: 'kcf-mini', title: 'Calcular neto e IVA desde el total (' + model.settings.ivaRate + '%)', onClick: autoIva }, '🧮'))),
            Field('Glosa / descripción *', h('input', { className: 'kcf-input', value: f.description, onChange: set('description'), placeholder: 'Ej: Factura insumos de oficina' }), true),
            Field(f.type === 'ingreso' ? 'Cliente' : 'Proveedor', h('input', { className: 'kcf-input', value: f.counterpart, onChange: set('counterpart') })),
            Field('RUT', h('input', { className: 'kcf-input', value: f.counterpartRut, onChange: set('counterpartRut'), placeholder: '76.123.456-7' })),
            Field('Tipo de documento', Sel({ value: f.docType, onChange: set('docType') }, DOC_TYPES.map((t) => ({ value: t, label: t || '— documento —' })))),
            Field('N° documento / folio', h('input', { className: 'kcf-input', value: f.docNumber, onChange: set('docNumber') })),
            Field('Categoría', Sel({ value: f.categoryId, onChange: set('categoryId') }, catOptions(f.type))),
            Field('Cuenta / caja', Sel({ value: f.accountId, onChange: set('accountId') }, accOptions())),
            Field('Proyecto', Sel({ value: f.projectId, onChange: set('projectId') }, projOptions())),
            Field('Centro de costos', Sel({ value: f.costCenterId, onChange: set('costCenterId') }, ccOptions())),
            Field('Medio de pago', Sel({ value: f.paymentMethod, onChange: set('paymentMethod') }, PAY_METHODS.map((t) => ({ value: t, label: t || '— medio de pago —' })))),
            Field('Cuotas', h('input', { className: 'kcf-input', type: 'number', min: 0, value: f.installments, onChange: set('installments') })),
            Field('Banco', h('input', { className: 'kcf-input', value: f.bank, onChange: set('bank') })),
            Field('Referencia / N° operación', h('input', { className: 'kcf-input', value: f.reference, onChange: set('reference') })),
            f.status === 'pendiente'
              ? Field('Fecha de vencimiento', h('input', { className: 'kcf-input', type: 'date', value: f.dueDate, onChange: set('dueDate') }))
              : Field('Recurrencia', Sel({ value: f.recurrence, onChange: set('recurrence') }, [
                { value: '', label: '— sin recurrencia —' }, { value: 'semanal', label: 'Semanal' },
                { value: 'mensual', label: 'Mensual' }, { value: 'trimestral', label: 'Trimestral' }, { value: 'anual', label: 'Anual' }])),
            Field('Exento / descuento', h('div', { style: { display: 'flex', gap: '6px' } },
              h('input', { className: 'kcf-input', type: 'number', min: 0, step: 'any', value: f.exento, onChange: set('exento'), placeholder: 'exento', style: { width: '50%' } }),
              h('input', { className: 'kcf-input', type: 'number', min: 0, step: 'any', value: f.discount, onChange: set('discount'), placeholder: 'dscto.', style: { width: '50%' } }))),
            Field('Observaciones', h('textarea', { className: 'kcf-input', value: f.notes, onChange: set('notes') }), true))),
        h('div', { className: 'kcf-modal-foot' },
          h('button', { className: 'kcf-btn', onClick: onCancel }, 'Cancelar'),
          h('button', {
            className: 'kcf-btn kcf-btn-primary',
            onClick: () => {
              if (!(num(f.amount) > 0)) { shell.notify && shell.notify({ level: 'warn', text: 'Ingresa un monto mayor que cero.' }); return; }
              if (!s(f.description).trim()) { shell.notify && shell.notify({ level: 'warn', text: 'Ingresa una glosa o descripción.' }); return; }
              onSave(f);
            },
          }, saveLabel || 'Guardar'))));
  }

  // ── UI: gráficos SVG ────────────────────────────────────────────────────
  function BarsChart({ series }) {
    const W = 560; const H = 170; const padL = 6; const padB = 18; const top = 12;
    const max = Math.max(1, ...series.map((p) => Math.max(p.income, p.expense)));
    const bw = (W - padL * 2) / series.length;
    const bars = [];
    series.forEach((p, i) => {
      const x = padL + i * bw;
      const hIn = (p.income / max) * (H - padB - top);
      const hOut = (p.expense / max) * (H - padB - top);
      bars.push(h('rect', { key: 'i' + i, x: x + bw * 0.14, y: H - padB - hIn, width: bw * 0.3, height: Math.max(1, hIn), rx: 2, fill: 'var(--kcf-green)' }));
      bars.push(h('rect', { key: 'e' + i, x: x + bw * 0.52, y: H - padB - hOut, width: bw * 0.3, height: Math.max(1, hOut), rx: 2, fill: 'var(--kcf-red)' }));
      bars.push(h('text', { key: 't' + i, x: x + bw / 2, y: H - 5, textAnchor: 'middle' }, p.label));
      bars.push(h('title', { key: 'tt' + i }, p.label + ': +' + fmtMoney(p.income) + ' / −' + fmtMoney(p.expense)));
    });
    return h('div', null,
      h('svg', { className: 'kcf-chart', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' },
        h('line', { x1: 0, y1: H - padB, x2: W, y2: H - padB, stroke: 'var(--kcf-border)', strokeWidth: 1 }), bars),
      h('div', { className: 'kcf-legend' },
        h('span', null, h('i', { className: 'dot', style: { background: 'var(--kcf-green)' } }), 'Ingresos'),
        h('span', null, h('i', { className: 'dot', style: { background: 'var(--kcf-red)' } }), 'Egresos')));
  }
  function LineChart({ points, labels, color }) {
    const W = 560; const H = 150; const padB = 18; const top = 10;
    if (!points.length) return null;
    const min = Math.min(0, ...points); const max = Math.max(1, ...points);
    const range = max - min || 1;
    const xs = points.map((_, i) => 10 + (i * (W - 20)) / Math.max(1, points.length - 1));
    const ys = points.map((v) => top + (1 - (v - min) / range) * (H - padB - top));
    const path = xs.map((x, i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + ys[i].toFixed(1)).join(' ');
    const zeroY = top + (1 - (0 - min) / range) * (H - padB - top);
    return h('svg', { className: 'kcf-chart', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' },
      h('line', { x1: 0, y1: zeroY, x2: W, y2: zeroY, stroke: 'var(--kcf-border)', strokeDasharray: '3 3', strokeWidth: 1 }),
      h('path', { d: path, fill: 'none', stroke: color || 'var(--kcf-accent)', strokeWidth: 2.2, strokeLinejoin: 'round' }),
      xs.map((x, i) => h('g', { key: i },
        h('circle', { cx: x, cy: ys[i], r: 3, fill: color || 'var(--kcf-accent)' }),
        h('title', null, labels[i] + ': ' + fmtMoney(points[i])),
        h('text', { x, y: H - 4, textAnchor: 'middle' }, labels[i]))));
  }
  function HBars({ rows, palette }) {
    const max = Math.max(1, ...rows.map((r) => r.total));
    if (!rows.length) return h('div', { className: 'kcf-empty' }, 'Sin datos en el período.');
    return h('div', null, rows.map((r, i) => h('div', { key: r.key || i, className: 'kcf-hbar-row' },
      h('span', { className: 'kcf-hbar-label', title: r.label }, r.label),
      h('div', { className: 'kcf-hbar-track' },
        h('div', { className: 'kcf-hbar-fill', style: { width: Math.max(2, (r.total / max) * 100) + '%', background: r.color || palette || 'var(--kcf-accent)' } })),
      h('span', { className: 'kcf-hbar-val' }, fmtMoney(r.total)))));
  }

  function downloadFile(name, content, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { shell.notify && shell.notify({ level: 'error', text: 'No se pudo exportar.' }); }
  }
  function commitPatch(listKey, id, patch, label) {
    commit((m) => { m[listKey] = m[listKey].map((x) => (x.id === id ? Object.assign({}, x, patch) : x)); }, label ? 'edición ' + label : null, label ? s(patch.name || id) : null);
  }

  // ── Pestaña: Dashboard ──────────────────────────────────────────────────
  function DashboardTab({ from, to, goTab }) {
    const cid = model.activeCompanyId;
    const k = computeKpis(cid, from, to);
    const series = monthlySeries(cid, 12);
    const period = movsOf(cid).filter((mv) => inRange(mv, from, to) && mv.status === 'realizado');
    const expByCat = groupTotals(period.filter((mv) => mv.type === 'egreso'), (mv) => mv.categoryId, (kk) => (catById(kk) || { name: 'Sin categoría' }).name)
      .slice(0, 8).map((r) => Object.assign(r, { color: (catById(r.key) || {}).color }));
    const incByCat = groupTotals(period.filter((mv) => mv.type === 'ingreso'), (mv) => mv.categoryId, (kk) => (catById(kk) || { name: 'Sin categoría' }).name)
      .slice(0, 8).map((r) => Object.assign(r, { color: (catById(r.key) || {}).color }));
    const byProject = groupTotals(period.filter((mv) => mv.projectId), (mv) => mv.projectId, (kk) => (projById(kk) || { name: '—' }).name).slice(0, 8);
    const suppliers = groupTotals(period.filter((mv) => mv.type === 'egreso' && mv.counterpart), (mv) => mv.counterpart.toLowerCase(), (kk) => kk).slice(0, 6)
      .map((r) => Object.assign(r, { label: r.label.replace(/\b\w/g, (c) => c.toUpperCase()) }));
    const clients = groupTotals(period.filter((mv) => mv.type === 'ingreso' && mv.counterpart), (mv) => mv.counterpart.toLowerCase(), (kk) => kk).slice(0, 6)
      .map((r) => Object.assign(r, { label: r.label.replace(/\b\w/g, (c) => c.toUpperCase()) }));
    const budgets = budgetExecution(cid, monthKey(todayISO()));
    const issues = detectIssues(cid).slice(0, 3);
    const proj = projection(cid, 6);
    const runwayTxt = k.runwayDays === Infinity ? '∞' : k.runwayDays + ' días';
    const lowLiquidity = k.dailyBurn > 0 && k.runwayDays < num(model.settings.liquidityDays);
    const kpi = (label, value, cls, delta) => h('div', { className: 'kcf-kpi' + (cls ? ' ' + cls : '') },
      h('span', { className: 'kcf-kpi-label' }, label),
      h('span', { className: 'kcf-kpi-value' }, value),
      delta ? h('span', { className: 'kcf-kpi-delta' }, delta) : null);
    return h('div', null,
      h('div', { className: 'kcf-kpis' },
        kpi('Ingresos', fmtMoney(k.income), 'pos'),
        kpi('Egresos', fmtMoney(k.expense), 'neg'),
        kpi('Utilidad del período', fmtMoney(k.net), k.net >= 0 ? 'pos' : 'neg'),
        kpi('Saldo disponible', fmtMoney(k.balance), k.balance >= 0 ? '' : 'neg'),
        kpi('Liquidez (cobertura)', runwayTxt, lowLiquidity ? 'warn' : '', 'egreso diario prom. ' + fmtMoney(k.dailyBurn)),
        kpi('Por cobrar (CxC)', fmtMoney(k.receivable)),
        kpi('Por pagar (CxP)', fmtMoney(k.payable)),
        kpi('Flujo proyectado (6m)', fmtMoney(proj.rows.length ? proj.rows[proj.rows.length - 1].balance : k.balance), null, 'saldo estimado')),
      h('div', { className: 'kcf-grid' },
        h('div', { className: 'kcf-panel kcf-span8' }, h('h4', null, '📊 Flujo mensual (12 meses)'), h(BarsChart, { series })),
        h('div', { className: 'kcf-panel kcf-span4' },
          h('h4', null, '🔔 Alertas del análisis inteligente'),
          issues.length
            ? h('div', { className: 'kcf-alerts' }, issues.map((i) => h('div', { key: i.id, className: 'kcf-alert sev-' + i.sev },
                h('span', { className: 'ico' }, i.icon), h('div', null, h('b', null, i.title), i.detail))))
            : h('div', { className: 'kcf-empty' }, h('span', { className: 'big' }, '✅'), 'Sin alertas por ahora.'),
          h('button', { className: 'kcf-btn', style: { marginTop: '10px' }, onClick: () => goTab('analysis') }, 'Ver análisis completo →')),
        h('div', { className: 'kcf-panel kcf-span6' }, h('h4', null, '💸 Gastos por categoría'), h(HBars, { rows: expByCat, palette: 'var(--kcf-red)' })),
        h('div', { className: 'kcf-panel kcf-span6' }, h('h4', null, '💰 Ingresos por categoría'), h(HBars, { rows: incByCat, palette: 'var(--kcf-green)' })),
        h('div', { className: 'kcf-panel kcf-span4' }, h('h4', null, '📁 Por proyecto'), h(HBars, { rows: byProject })),
        h('div', { className: 'kcf-panel kcf-span4' }, h('h4', null, '🏭 Top proveedores'), h(HBars, { rows: suppliers, palette: 'var(--kcf-red)' })),
        h('div', { className: 'kcf-panel kcf-span4' }, h('h4', null, '👥 Top clientes'), h(HBars, { rows: clients, palette: 'var(--kcf-green)' })),
        h('div', { className: 'kcf-panel kcf-span12' },
          h('h4', null, '🎯 Presupuestos del mes (' + monthLabel(monthKey(todayISO())) + ')'),
          budgets.length
            ? budgets.map((b) => {
                const cat = catById(b.categoryId);
                const pct = Math.min(1.2, b.pct);
                return h('div', { key: b.id, className: 'kcf-budget-row' },
                  h('div', { className: 'kcf-budget-top' },
                    h('span', null, (cat ? cat.name : '—')),
                    h('span', null, fmtMoney(b.spent) + ' / ' + fmtMoney(b.amount) + ' (' + Math.round(b.pct * 100) + '%)')),
                  h('div', { className: 'kcf-progress' },
                    h('div', { className: b.pct >= 1 ? 'over' : b.pct >= 0.85 ? 'near' : '', style: { width: Math.min(100, pct * 100) + '%' } })));
              })
            : h('div', { className: 'kcf-empty' }, 'Define presupuestos en la pestaña Proyecciones.'))));
  }

  // ── Pestaña: Flujo de Caja (movimientos) ────────────────────────────────
  function MovementsTab({ from, to, onEdit }) {
    const [q, setQ] = useState('');
    const [fType, setFType] = useState('');
    const [fCat, setFCat] = useState('');
    const [fProj, setFProj] = useState('');
    const [fCc, setFCc] = useState('');
    const [fAcc, setFAcc] = useState('');
    const [fStatus, setFStatus] = useState('');
    const list = movsOf(model.activeCompanyId)
      .filter((mv) => inRange(mv, from, to))
      .filter((mv) => !fType || mv.type === fType)
      .filter((mv) => !fCat || mv.categoryId === fCat)
      .filter((mv) => !fProj || mv.projectId === fProj)
      .filter((mv) => !fCc || mv.costCenterId === fCc)
      .filter((mv) => !fAcc || mv.accountId === fAcc)
      .filter((mv) => !fStatus || mv.status === fStatus)
      .filter((mv) => {
        const t = q.trim().toLowerCase();
        if (!t) return true;
        return (mv.description + ' ' + mv.counterpart + ' ' + mv.counterpartRut + ' ' + mv.docNumber + ' ' + mv.reference + ' ' + ((catById(mv.categoryId) || {}).name || '')).toLowerCase().indexOf(t) >= 0;
      })
      .sort((a, b) => (b.date + s(b.time)).localeCompare(a.date + s(a.time)));
    const exportCsv = () => {
      const head = ['fecha', 'hora', 'tipo', 'estado', 'glosa', 'contraparte', 'rut', 'documento', 'folio', 'categoria', 'proyecto', 'centro_costos', 'cuenta', 'medio_pago', 'neto', 'iva', 'exento', 'total'];
      const lines = [head.join(';')].concat(list.map((mv) => [
        mv.date, mv.time, mv.type, mv.status, mv.description, mv.counterpart, mv.counterpartRut, mv.docType, mv.docNumber,
        (catById(mv.categoryId) || {}).name || '', (projById(mv.projectId) || {}).name || '', (ccById(mv.costCenterId) || {}).name || '',
        (accById(mv.accountId) || {}).name || '', mv.paymentMethod, mv.neto, mv.iva, mv.exento, mv.amount,
      ].map(escCsv).join(';')));
      downloadFile('kimos-cashflow-movimientos.csv', lines.join('\n'));
    };
    const rows = [];
    let lastDate = null;
    list.forEach((mv) => {
      if (mv.date !== lastDate) {
        lastDate = mv.date;
        const day = list.filter((x) => x.date === mv.date && x.status === 'realizado');
        const net = sumBy(day, (x) => x.type === 'ingreso') - sumBy(day, (x) => x.type === 'egreso');
        rows.push(h('tr', { key: 'day-' + mv.date, className: 'kcf-daytotal' },
          h('td', { colSpan: 5 }, fmtDate(mv.date)),
          h('td', { className: 'kcf-num ' + (net >= 0 ? 'kcf-amount-in' : 'kcf-amount-out') }, 'neto día: ' + fmtMoney(net)),
          h('td', null), h('td', null)));
      }
      const cat = catById(mv.categoryId);
      rows.push(h('tr', { key: mv.id },
        h('td', null, h('span', { className: 'kcf-chip ' + (mv.type === 'ingreso' ? 'in' : 'out') }, mv.type === 'ingreso' ? '↑ ingreso' : '↓ egreso')),
        h('td', null,
          h('div', { style: { fontWeight: 600 } }, mv.description || '—'),
          h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' } },
            mv.docType ? h('span', { className: 'kcf-chip' }, mv.docType + (mv.docNumber ? ' N°' + mv.docNumber : '')) : null,
            (mv.documentIds || []).length ? h('span', { className: 'kcf-chip acc' }, '📎 ' + mv.documentIds.length) : null,
            mv.source !== 'manual' ? h('span', { className: 'kcf-chip acc', title: 'Origen: ' + mv.source }, '🤖 ' + mv.source) : null,
            mv.recurrence ? h('span', { className: 'kcf-chip' }, '🔁 ' + mv.recurrence) : null)),
        h('td', null, mv.counterpart || '—', mv.counterpartRut ? h('div', { style: { fontSize: '11px', color: 'var(--kcf-muted)' } }, mv.counterpartRut) : null),
        h('td', null, cat ? h('span', { className: 'kcf-chip dot', style: { color: cat.color } }, cat.name) : '—',
          (projById(mv.projectId) || ccById(mv.costCenterId))
            ? h('div', { style: { fontSize: '11px', color: 'var(--kcf-muted)', marginTop: '2px' } },
                [(projById(mv.projectId) || {}).name, (ccById(mv.costCenterId) || {}).name].filter(Boolean).join(' · '))
            : null),
        h('td', null, (accById(mv.accountId) || {}).name || '—', mv.paymentMethod ? h('div', { style: { fontSize: '11px', color: 'var(--kcf-muted)' } }, mv.paymentMethod + (mv.installments ? ' ' + mv.installments + ' cuotas' : '')) : null),
        h('td', { className: 'kcf-num ' + (mv.type === 'ingreso' ? 'kcf-amount-in' : 'kcf-amount-out') },
          (mv.type === 'ingreso' ? '+' : '−') + fmtMoney(mv.amount),
          mv.iva > 0 ? h('div', { style: { fontSize: '10.5px', color: 'var(--kcf-muted)', fontWeight: 400 } }, 'IVA ' + fmtMoney(mv.iva)) : null),
        h('td', null, mv.status === 'pendiente'
          ? h('span', { className: 'kcf-chip warn' }, (mv.type === 'ingreso' ? 'por cobrar' : 'por pagar') + (mv.dueDate ? ' · ' + fmtDate(mv.dueDate) : ''))
          : h('span', { className: 'kcf-chip in' }, 'realizado')),
        h('td', { className: 'kcf-rowactions' },
          h('button', { className: 'kcf-mini', title: 'Editar', onClick: () => onEdit(mv) }, '✏️'),
          h('button', { className: 'kcf-mini', title: 'Duplicar', onClick: () => duplicateMovement(mv.id) }, '⧉'),
          h('button', {
            className: 'kcf-mini kcf-danger', title: 'Eliminar',
            onClick: () => { if (window.confirm('¿Eliminar este movimiento? La acción queda en la auditoría.')) deleteMovement(mv.id); },
          }, '🗑'))));
    });
    return h('div', null,
      h('div', { className: 'kcf-filters' },
        h('input', { className: 'kcf-search', placeholder: '🔎 Buscar glosa, contraparte, RUT, folio…', value: q, onChange: (e) => setQ(e.target.value) }),
        Sel({ value: fType, onChange: (e) => setFType(e.target.value) }, [{ value: '', label: 'Tipo: todos' }, { value: 'ingreso', label: 'Ingresos' }, { value: 'egreso', label: 'Egresos' }]),
        Sel({ value: fStatus, onChange: (e) => setFStatus(e.target.value) }, [{ value: '', label: 'Estado: todos' }, { value: 'realizado', label: 'Realizados' }, { value: 'pendiente', label: 'CxC / CxP' }]),
        Sel({ value: fCat, onChange: (e) => setFCat(e.target.value) }, [{ value: '', label: 'Categoría: todas' }].concat(model.categories.map((c) => ({ value: c.id, label: c.name })))),
        model.projects.length ? Sel({ value: fProj, onChange: (e) => setFProj(e.target.value) }, [{ value: '', label: 'Proyecto: todos' }].concat(model.projects.map((p) => ({ value: p.id, label: p.name })))) : null,
        model.costCenters.length ? Sel({ value: fCc, onChange: (e) => setFCc(e.target.value) }, [{ value: '', label: 'C. costos: todos' }].concat(model.costCenters.map((c) => ({ value: c.id, label: c.name })))) : null,
        Sel({ value: fAcc, onChange: (e) => setFAcc(e.target.value) }, [{ value: '', label: 'Cuenta: todas' }].concat(model.accounts.filter((a) => a.companyId === model.activeCompanyId).map((a) => ({ value: a.id, label: a.name })))),
        h('span', { className: 'kcf-spacer' }),
        h('button', { className: 'kcf-btn', onClick: exportCsv, disabled: !list.length }, '⬇ CSV')),
      list.length
        ? h('div', { className: 'kcf-tablewrap' }, h('table', { className: 'kcf-table' },
            h('thead', null, h('tr', null, ['Tipo', 'Glosa', 'Contraparte', 'Clasificación', 'Cuenta', 'Monto', 'Estado', ''].map((c, i) => h('th', { key: i, className: c === 'Monto' ? 'kcf-num' : '' }, c)))),
            h('tbody', null, rows)))
        : h('div', { className: 'kcf-empty' }, h('span', { className: 'big' }, '💸'),
            'Sin movimientos en el período. Registra un ingreso/egreso o carga documentos para que la IA proponga.'));
  }

  // ── Pestaña: Libro Diario Inteligente ───────────────────────────────────
  function JournalTab({ from, to }) {
    const entries = journalEntries(model.activeCompanyId, from, to);
    const totDebit = entries.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.debit, 0), 0);
    const totCredit = entries.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.credit, 0), 0);
    const exportCsv = () => {
      const lines = ['asiento;fecha;cuenta;glosa;debe;haber'];
      entries.forEach((e) => e.lines.forEach((l) => lines.push([e.n, e.date, l.account, e.gloss, l.debit || '', l.credit || ''].map(escCsv).join(';'))));
      downloadFile('kimos-cashflow-libro-diario.csv', lines.join('\n'));
    };
    if (!entries.length) return h('div', { className: 'kcf-empty' }, h('span', { className: 'big' }, '📒'), 'Sin asientos en el período: los asientos Debe/Haber se generan automáticamente desde cada movimiento (con IVA débito/crédito).');
    return h('div', null,
      h('div', { className: 'kcf-section-title' }, '📒 Libro Diario',
        h('span', { className: 'kcf-sub' }, entries.length + ' asientos generados automáticamente desde el flujo de caja'),
        h('span', { className: 'kcf-spacer' }),
        h('button', { className: 'kcf-btn', onClick: exportCsv }, '⬇ CSV')),
      h('div', { className: 'kcf-tablewrap' }, h('table', { className: 'kcf-table' },
        h('thead', null, h('tr', null,
          h('th', null, 'N°'), h('th', null, 'Fecha'), h('th', null, 'Cuenta'), h('th', null, 'Glosa'),
          h('th', { className: 'kcf-num' }, 'Debe'), h('th', { className: 'kcf-num' }, 'Haber'))),
        h('tbody', null,
          entries.map((e) => e.lines.map((l, li) => h('tr', { key: e.id + '-' + li },
            h('td', null, li === 0 ? '#' + e.n : ''),
            h('td', null, li === 0 ? fmtDate(e.date) : ''),
            h('td', { style: { paddingLeft: l.credit && !l.debit ? '22px' : undefined } }, l.account),
            h('td', null, li === 0 ? h('span', null, e.gloss, e.pending ? h('span', { className: 'kcf-chip warn', style: { marginLeft: '6px' } }, 'devengado') : null, e.source && e.source !== 'manual' ? h('span', { className: 'kcf-chip acc', style: { marginLeft: '6px' } }, '🤖 ' + e.source) : null) : ''),
            h('td', { className: 'kcf-num' }, l.debit ? fmtMoney(l.debit) : ''),
            h('td', { className: 'kcf-num' }, l.credit ? fmtMoney(l.credit) : '')))),
          h('tr', { className: 'kcf-daytotal' },
            h('td', { colSpan: 4 }, 'Totales (∑ Debe = ∑ Haber)'),
            h('td', { className: 'kcf-num' }, fmtMoney(totDebit)),
            h('td', { className: 'kcf-num' }, fmtMoney(totCredit)))))));
  }

  // ── Pestaña: Gestor Documental ──────────────────────────────────────────
  function DocsTab({ onView, onPaste }) {
    const [drag, setDrag] = useState(false);
    const fileRef = useRef(null);
    const camRef = useRef(null);
    const docs = model.documents.filter((d) => d.companyId === model.activeCompanyId);
    const iconFor = (d) => {
      if (d.mime.indexOf('image/') === 0) return '🖼️';
      if (d.mime === 'application/pdf' || /\.pdf$/i.test(d.name)) return '📕';
      if (/xml/i.test(d.mime) || /\.xml$/i.test(d.name)) return '🧾';
      if (/csv/i.test(d.mime) || /\.csv$/i.test(d.name)) return '📑';
      if (/\.(xlsx?|ods)$/i.test(d.name)) return '📊';
      return '📄';
    };
    const statusChip = (d) => {
      if (d.status === 'vinculado') return h('span', { className: 'kcf-chip in' }, '✓ contabilizado');
      if (d.status === 'propuesto') return h('span', { className: 'kcf-chip acc' }, '⏳ en revisión');
      if (d.status === 'procesado') return h('span', { className: 'kcf-chip' }, 'procesado');
      return h('span', { className: 'kcf-chip warn' }, 'pendiente OCR');
    };
    const reExtract = (d) => {
      if (!d.textContent) { onPaste(d.id); return; }
      const dte = /\.xml$/i.test(d.name) || /xml/i.test(d.mime) ? parseDteXml(d.textContent) : null;
      const ex = dte || extractFromText(d.textContent, { fileName: d.name });
      if (num(ex.draft.amount) > 0) {
        createProposal(ex.draft, { source: dte ? 'XML DTE' : 'extractor local', documentId: d.id, confidence: ex.confidence, notes: 'Reprocesado por el usuario' });
        shell.notify && shell.notify({ level: 'success', text: 'Propuesta creada en Revisión ✅.' });
      } else shell.notify && shell.notify({ level: 'warn', text: 'No se detectó un monto en el documento.' });
    };
    return h('div', null,
      h('div', {
        className: 'kcf-dropzone' + (drag ? ' drag' : ''),
        onClick: () => fileRef.current && fileRef.current.click(),
        onDragOver: (e) => { e.preventDefault(); setDrag(true); },
        onDragLeave: () => setDrag(false),
        onDrop: (e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files, { origin: 'arrastre' }); },
      },
        h('span', { className: 'big' }, '📥'),
        h('b', null, 'Arrastra documentos aquí'), ' o haz clic para elegir — PDF, JPG, PNG, XML (DTE), CSV, Excel, escaneos, boletas, facturas, notas de crédito/débito, vouchers, transferencias. Carga múltiple y masiva.',
        h('div', { className: 'kcf-dz-actions' },
          h('button', { className: 'kcf-btn', onClick: (e) => { e.stopPropagation(); camRef.current && camRef.current.click(); } }, '📷 Capturar con cámara'),
          h('button', { className: 'kcf-btn', onClick: (e) => { e.stopPropagation(); onPaste(''); } }, '📋 Pegar texto de un documento')),
        h('input', { ref: fileRef, type: 'file', multiple: true, style: { display: 'none' }, accept: '.pdf,.jpg,.jpeg,.png,.webp,.xml,.csv,.txt,.xls,.xlsx,image/*,application/pdf,text/xml,text/csv', onChange: (e) => { addFiles(e.target.files, { origin: 'selector' }); e.target.value = ''; } }),
        h('input', { ref: camRef, type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' }, onChange: (e) => { addFiles(e.target.files, { origin: 'cámara' }); e.target.value = ''; } })),
      h('div', { className: 'kcf-section-title' }, '📁 Documentos', h('span', { className: 'kcf-sub' }, docs.length + ' en ' + s((activeCompany() || {}).name))),
      docs.length
        ? h('div', { className: 'kcf-docs' }, docs.map((d) => h('div', { key: d.id, className: 'kcf-doc' },
            h('div', { className: 'kcf-doc-thumb', onClick: () => onView(d.id) },
              d.mime.indexOf('image/') === 0 && d.dataUrl ? h('img', { src: d.dataUrl, alt: d.name }) : iconFor(d)),
            h('div', { className: 'kcf-doc-name', title: d.name }, d.name),
            h('div', { className: 'kcf-doc-meta' }, fmtDate(d.uploadedAt.slice(0, 10)), '·', Math.max(1, Math.round(d.size / 1024)) + ' KB', statusChip(d)),
            h('div', { className: 'kcf-doc-actions' },
              h('button', { className: 'kcf-mini', title: 'Ver documento', onClick: () => onView(d.id) }, '👁'),
              d.status !== 'vinculado' ? h('button', { className: 'kcf-mini', title: d.textContent ? 'Reinterpretar y proponer' : 'Pegar texto OCR y proponer', onClick: () => reExtract(d) }, '🧠') : null,
              h('button', { className: 'kcf-mini kcf-danger', title: 'Eliminar', onClick: () => { if (window.confirm('¿Eliminar «' + d.name + '» y sus propuestas asociadas?')) deleteDocument(d.id); } }, '🗑')))))
        : h('div', { className: 'kcf-empty' }, h('span', { className: 'big' }, '🗂️'), 'Aún no hay documentos. Los XML DTE, CSV y textos se interpretan al instante; imágenes y PDF quedan listos para el OCR del agente KIMOS.'));
  }

  // ── Visor de documento ──────────────────────────────────────────────────
  function DocViewer({ docId, onClose }) {
    const d = docById(docId);
    if (!d) return null;
    const mov = d.movementId ? model.movements.find((x) => x.id === d.movementId) : null;
    const ex = d.extraction;
    const kv = (k, v) => (s(v) ? h('div', null, h('div', { className: 'k' }, k), h('div', { className: 'v' }, s(v))) : null);
    return h('div', { className: 'kcf-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
      h('div', { className: 'kcf-modal kcf-viewer' },
        h('div', { className: 'kcf-modal-head' }, '📄 ', d.name, h('span', { className: 'kcf-spacer' }),
          h('button', { className: 'kcf-mini', onClick: onClose }, '✕')),
        h('div', { className: 'kcf-modal-body' },
          h('div', { className: 'kcf-viewer-body' },
            h('div', { className: 'kcf-viewer-preview' },
              d.mime.indexOf('image/') === 0 && d.dataUrl ? h('img', { src: d.dataUrl, alt: d.name })
                : d.textContent ? h('pre', null, d.textContent.slice(0, 8000))
                : (d.mime === 'application/pdf' && d.dataUrl) ? h('iframe', { src: d.dataUrl, style: { width: '100%', height: '420px', border: 'none' }, title: d.name })
                : h('div', { style: { fontSize: '40px' } }, '📄')),
            h('div', { className: 'kcf-viewer-side' },
              h('div', { className: 'kcf-kv' },
                kv('Cargado', fmtDate(d.uploadedAt.slice(0, 10)) + ' (' + d.origin + ')'),
                kv('Tipo MIME', d.mime || '—'),
                kv('Tamaño', Math.max(1, Math.round(d.size / 1024)) + ' KB'),
                kv('Estado', d.status),
                mov ? kv('Movimiento vinculado', mov.description + ' · ' + fmtMoney(mov.amount)) : null),
              ex ? h('div', null,
                h('div', { className: 'kcf-section-title' }, '🤖 Datos extraídos'),
                h('div', { className: 'kcf-kv' },
                  kv('Tipo doc.', ex.docType), kv('Folio', ex.docNumber), kv('Fecha', ex.date), kv('Contraparte', ex.counterpart),
                  kv('RUT', ex.counterpartRut), kv('Neto', ex.neto ? fmtMoney(ex.neto) : ''), kv('IVA', ex.iva ? fmtMoney(ex.iva) : ''),
                  kv('Total', ex.amount ? fmtMoney(ex.amount) : ''), kv('Medio de pago', ex.paymentMethod), kv('Banco', ex.bank), kv('Referencia', ex.reference))) : null)))));
  }

  // ── Pegar texto OCR (modal) ─────────────────────────────────────────────
  function PasteModal({ docId, onClose }) {
    const [text, setText] = useState('');
    const doc = docId ? docById(docId) : null;
    return h('div', { className: 'kcf-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
      h('div', { className: 'kcf-modal' },
        h('div', { className: 'kcf-modal-head' }, '📋 Interpretar texto de documento', h('span', { className: 'kcf-spacer' }),
          h('button', { className: 'kcf-mini', onClick: onClose }, '✕')),
        h('div', { className: 'kcf-modal-body' },
          h('p', { style: { marginTop: 0, color: 'var(--kcf-muted)', fontSize: '12px' } },
            doc ? 'El texto se asociará al documento «' + doc.name + '».' : 'Pega el texto de una boleta, factura, voucher o transferencia (por ejemplo, el OCR de tu teléfono o del agente KIMOS). ',
            'La IA financiera detectará fecha, RUT, folio, montos, IVA, medio de pago y detalle, y creará una PROPUESTA que tú apruebas.'),
          h('textarea', { className: 'kcf-input', style: { width: '100%', minHeight: '180px', boxSizing: 'border-box' }, value: text, onChange: (e) => setText(e.target.value), placeholder: 'FACTURA ELECTRÓNICA N° 12345\nRUT: 76.123.456-7\nFecha: 05/07/2026\nNETO $84.034  IVA $15.966  TOTAL $100.000 …' })),
        h('div', { className: 'kcf-modal-foot' },
          h('button', { className: 'kcf-btn', onClick: onClose }, 'Cancelar'),
          h('button', {
            className: 'kcf-btn kcf-btn-primary',
            onClick: () => {
              const ex = extractFromText(text, { fileName: doc ? doc.name : 'texto pegado' });
              if (!(num(ex.draft.amount) > 0)) { shell.notify && shell.notify({ level: 'warn', text: 'No se detectó un monto en el texto.' }); return; }
              if (doc) commit((m) => { const dd = m.documents.find((x) => x.id === doc.id); if (dd) dd.extraction = Object.assign({}, ex.draft, { rawText: ex.rawText }); }, null);
              createProposal(ex.draft, { source: 'OCR pegado', documentId: doc ? doc.id : '', confidence: ex.confidence, notes: 'Campos detectados: ' + ex.found.join(', ') });
              onClose();
              shell.notify && shell.notify({ level: 'success', text: 'Propuesta creada — revísala en la pestaña Revisión ✅.' });
            },
          }, '🧠 Interpretar y proponer'))));
  }

  // ── Pestaña: Revisión (Human in the Loop) ───────────────────────────────
  function ReviewTab({ onEditApprove, onViewDoc }) {
    const props = model.proposals;
    const kv = (k, v) => (s(v) ? h('div', null, h('div', { className: 'k' }, k), h('div', { className: 'v' }, s(v))) : null);
    if (!props.length) {
      return h('div', { className: 'kcf-empty' }, h('span', { className: 'big' }, '🤝'),
        h('b', null, 'Bandeja Human in the Loop vacía.'), h('br'), h('br'),
        'Aquí llegan las propuestas de la IA (extractor local, XML DTE, CSV y agentes KIMOS). ',
        'Nada se contabiliza sin tu aprobación: puedes aprobar, editar, rechazar, posponer o pedir una nueva interpretación. ',
        'Cada decisión queda registrada en la Auditoría (pestaña Ajustes).');
    }
    return h('div', { className: 'kcf-proposals' }, props.map((p) => {
      const d = p.draft;
      const cat = catById(d.categoryId);
      const doc = p.documentId ? docById(p.documentId) : null;
      return h('div', { key: p.id, className: 'kcf-proposal' + (p.status === 'pospuesta' ? ' postponed' : '') },
        h('div', { className: 'kcf-proposal-head' },
          h('span', { className: 'kcf-chip ' + (d.type === 'ingreso' ? 'in' : 'out') }, d.type === 'ingreso' ? '↑ ingreso' : '↓ egreso'),
          h('span', { className: 'kcf-proposal-title' }, s(d.description) || s(d.counterpart) || 'Propuesta'),
          h('span', { className: 'kcf-chip acc' }, '🤖 ' + p.source),
          p.status === 'pospuesta' ? h('span', { className: 'kcf-chip warn' }, '🕓 pospuesta') : null,
          h('span', { className: 'kcf-conf' }, 'confianza ' + Math.round(num(p.confidence) * 100) + '%')),
        h('div', { className: 'kcf-kv' },
          kv('Monto', fmtMoney(num(d.amount))),
          kv('Fecha', fmtDate(d.date)),
          kv('Neto', num(d.neto) ? fmtMoney(num(d.neto)) : ''),
          kv('IVA', num(d.iva) ? fmtMoney(num(d.iva)) : ''),
          kv('Contraparte', d.counterpart),
          kv('RUT', d.counterpartRut),
          kv('Documento', s(d.docType) + (d.docNumber ? ' N°' + d.docNumber : '')),
          kv('Categoría sugerida', cat ? cat.name : ''),
          kv('Medio de pago', d.paymentMethod),
          kv('Banco / Ref.', [d.bank, d.reference].filter(Boolean).join(' · ')),
          kv('Ítems detectados', Array.isArray(d.items) && d.items.length ? d.items.length + ' líneas' : '')),
        p.notes ? h('div', { style: { fontSize: '11.5px', color: 'var(--kcf-muted)', marginBottom: '4px' } }, 'ℹ️ ' + p.notes) : null,
        h('div', { className: 'kcf-proposal-actions' },
          h('button', { className: 'kcf-btn kcf-btn-income', onClick: () => { const r = resolveProposal(p.id, 'aprobar'); if (!r.success) shell.notify && shell.notify({ level: 'warn', text: r.error }); } }, '✔ Aprobar'),
          h('button', { className: 'kcf-btn', onClick: () => onEditApprove(p) }, '✏️ Editar y aprobar'),
          h('button', { className: 'kcf-btn', onClick: () => resolveProposal(p.id, 'posponer') }, p.status === 'pospuesta' ? '⏰ Reactivar' : '🕓 Posponer'),
          h('button', { className: 'kcf-btn', onClick: () => { const r = resolveProposal(p.id, 'reinterpretar'); shell.notify && shell.notify(r.success ? { level: 'success', text: 'Documento reinterpretado.' } : { level: 'warn', text: r.error }); } }, '🔄 Reinterpretar'),
          doc ? h('button', { className: 'kcf-btn', onClick: () => onViewDoc(doc.id) }, '📄 Ver documento') : null,
          h('span', { className: 'kcf-spacer' }),
          h('button', { className: 'kcf-btn kcf-danger', onClick: () => { if (window.confirm('¿Rechazar esta propuesta?')) resolveProposal(p.id, 'rechazar'); } }, '✖ Rechazar')));
    }));
  }

  // ── Pestaña: Proyecciones y Presupuestos ────────────────────────────────
  function ProjectionsTab() {
    const cid = model.activeCompanyId;
    const proj = projection(cid, 6);
    const [bMonth, setBMonth] = useState(monthKey(todayISO()));
    const [bCat, setBCat] = useState('');
    const [bAmt, setBAmt] = useState('');
    const budgets = budgetExecution(cid, bMonth);
    const addBudget = () => {
      if (!bCat || !(num(bAmt) > 0)) { shell.notify && shell.notify({ level: 'warn', text: 'Elige categoría y monto para el presupuesto.' }); return; }
      commit((m) => { m.budgets.push({ id: uid('bud'), companyId: cid, period: bMonth, categoryId: bCat, amount: num(bAmt) }); },
        'presupuesto creado', (catById(bCat) || {}).name + ' ' + bMonth + ' = ' + fmtMoney(num(bAmt)));
      setBAmt(''); setBCat('');
    };
    return h('div', { className: 'kcf-grid' },
      h('div', { className: 'kcf-panel kcf-span12' },
        h('h4', null, '📈 Saldo proyectado a 6 meses', h('span', { className: 'kcf-sub', style: { fontWeight: 400, textTransform: 'none' } }, ' — base: ' + proj.basis + ' + recurrentes + CxC/CxP con vencimiento')),
        h(LineChart, { points: proj.rows.map((r) => r.balance), labels: proj.rows.map((r) => r.label) })),
      h('div', { className: 'kcf-panel kcf-span12' },
        h('h4', null, '🔮 Detalle de la proyección'),
        h('div', { className: 'kcf-tablewrap' }, h('table', { className: 'kcf-table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Mes'), h('th', { className: 'kcf-num' }, 'Tendencia neta'), h('th', { className: 'kcf-num' }, '+ Por cobrar'),
            h('th', { className: 'kcf-num' }, '− Por pagar'), h('th', { className: 'kcf-num' }, 'Flujo neto'), h('th', { className: 'kcf-num' }, 'Saldo proyectado'))),
          h('tbody', null, proj.rows.map((r) => h('tr', { key: r.ym },
            h('td', null, r.label),
            h('td', { className: 'kcf-num' }, fmtMoney(r.trendNet)),
            h('td', { className: 'kcf-num kcf-amount-in' }, r.cxc ? '+' + fmtMoney(r.cxc) : '—'),
            h('td', { className: 'kcf-num kcf-amount-out' }, r.cxp ? '−' + fmtMoney(r.cxp) : '—'),
            h('td', { className: 'kcf-num ' + (r.net >= 0 ? 'kcf-amount-in' : 'kcf-amount-out') }, fmtMoney(r.net)),
            h('td', { className: 'kcf-num', style: { fontWeight: 700, color: r.balance < 0 ? 'var(--kcf-red)' : undefined } }, fmtMoney(r.balance)))))))),
      h('div', { className: 'kcf-panel kcf-span12' },
        h('h4', null, '🎯 Presupuestos por categoría'),
        h('div', { className: 'kcf-addrow', style: { marginBottom: '12px' } },
          h('input', { className: 'kcf-input', type: 'month', value: bMonth, onChange: (e) => setBMonth(e.target.value) }),
          Sel({ value: bCat, onChange: (e) => setBCat(e.target.value) }, [{ value: '', label: '— categoría de egreso —' }].concat(model.categories.filter((c) => c.kind === 'egreso').map((c) => ({ value: c.id, label: c.name })))),
          h('input', { className: 'kcf-input', type: 'number', min: 0, placeholder: 'monto presupuestado', value: bAmt, onChange: (e) => setBAmt(e.target.value) }),
          h('button', { className: 'kcf-btn kcf-btn-primary', onClick: addBudget }, '＋ Presupuestar')),
        budgets.length
          ? budgets.map((b) => {
              const cat = catById(b.categoryId);
              return h('div', { key: b.id, className: 'kcf-budget-row' },
                h('div', { className: 'kcf-budget-top' },
                  h('span', null, (cat ? cat.name : '—') + ' · ' + monthLabel(b.period)),
                  h('span', null, fmtMoney(b.spent) + ' / ' + fmtMoney(b.amount) + ' (' + Math.round(b.pct * 100) + '%) ',
                    h('button', { className: 'kcf-mini kcf-danger', title: 'Eliminar presupuesto', onClick: () => commit((m) => { m.budgets = m.budgets.filter((x) => x.id !== b.id); }, 'presupuesto eliminado', (cat || {}).name + ' ' + b.period) }, '🗑'))),
                h('div', { className: 'kcf-progress' },
                  h('div', { className: b.pct >= 1 ? 'over' : b.pct >= 0.85 ? 'near' : '', style: { width: Math.min(100, b.pct * 100) + '%' } })));
            })
          : h('div', { className: 'kcf-empty' }, 'Sin presupuestos para ' + monthLabel(bMonth) + '. Crea el primero arriba.')));
  }

  // ── Pestaña: Análisis Financiero Inteligente ────────────────────────────
  function AnalysisTab() {
    const issues = detectIssues(model.activeCompanyId);
    return h('div', null,
      h('div', { className: 'kcf-section-title' }, '🔍 Análisis Financiero Inteligente',
        h('span', { className: 'kcf-sub' }, 'duplicados · inconsistencias · liquidez · gastos inusuales · tendencias · presupuestos · vencimientos')),
      issues.length
        ? h('div', { className: 'kcf-alerts' }, issues.map((i) => h('div', { key: i.id, className: 'kcf-alert sev-' + i.sev },
            h('span', { className: 'ico' }, i.icon),
            h('div', null, h('b', null, i.title), i.detail, h('div', { className: 'kcf-alert-reco' }, '💡 ' + i.reco)))))
        : h('div', { className: 'kcf-empty' }, h('span', { className: 'big' }, '✅'), 'Sin hallazgos: tus finanzas se ven consistentes en los datos actuales.'));
  }

  // ── Pestaña: Ajustes (multiempresa, cuentas, catálogos, auditoría) ──────
  function SettingsTab() {
    const [newCo, setNewCo] = useState('');
    const [newAcc, setNewAcc] = useState('');
    const [newAccType, setNewAccType] = useState('banco');
    const [newCat, setNewCat] = useState('');
    const [newCatKind, setNewCatKind] = useState('egreso');
    const [newProj, setNewProj] = useState('');
    const [newCc, setNewCc] = useState('');
    const cid = model.activeCompanyId;
    const co = activeCompany();
    const accs = model.accounts.filter((a) => a.companyId === cid);
    const exportAudit = () => {
      const lines = ['fecha_hora;accion;detalle'].concat(model.audit.map((a) => [a.at, a.action, a.detail].map(escCsv).join(';')));
      downloadFile('kimos-cashflow-auditoria.csv', lines.join('\n'));
    };
    const exportBackup = () => downloadFile('kimos-cashflow-respaldo.json', JSON.stringify({ cashflow: model, exportedAt: nowIso() }, null, 2), 'application/json');
    return h('div', { className: 'kcf-grid' },
      h('div', { className: 'kcf-panel kcf-span6' },
        h('h4', null, '🏢 Empresas (multiempresa)'),
        model.companies.map((c) => h('div', { key: c.id, className: 'kcf-cat-row' },
          h('input', { type: 'radio', name: 'kcf-active-co', checked: c.id === cid, onChange: () => commit((m) => { m.activeCompanyId = c.id; }, 'empresa activa', c.name), title: 'Empresa activa' }),
          h('input', { className: 'kcf-input grow', value: c.name, onChange: (e) => commitPatch('companies', c.id, { name: e.target.value }) }),
          h('input', { className: 'kcf-input', style: { width: '110px' }, placeholder: 'RUT', value: c.rut, onChange: (e) => commitPatch('companies', c.id, { rut: e.target.value }) }),
          h('input', { className: 'kcf-input', style: { width: '110px' }, placeholder: 'giro', value: c.giro, onChange: (e) => commitPatch('companies', c.id, { giro: e.target.value }) }),
          h('button', {
            className: 'kcf-mini kcf-danger', title: 'Eliminar empresa',
            onClick: () => {
              if (model.companies.length <= 1) { shell.notify && shell.notify({ level: 'warn', text: 'Debe existir al menos una empresa.' }); return; }
              if (model.movements.some((mv) => mv.companyId === c.id)) { shell.notify && shell.notify({ level: 'warn', text: 'La empresa tiene movimientos: trasládalos o elimínalos primero.' }); return; }
              commit((m) => {
                m.companies = m.companies.filter((x) => x.id !== c.id);
                m.accounts = m.accounts.filter((a) => a.companyId !== c.id);
                if (m.activeCompanyId === c.id) m.activeCompanyId = m.companies[0].id;
              }, 'empresa eliminada', c.name);
            },
          }, '🗑'))),
        h('div', { className: 'kcf-addrow' },
          h('input', { className: 'kcf-input', placeholder: 'Nueva empresa…', value: newCo, onChange: (e) => setNewCo(e.target.value) }),
          h('button', {
            className: 'kcf-btn', onClick: () => {
              const name = newCo.trim(); if (!name) return;
              const id = uid('co');
              commit((m) => {
                m.companies.push({ id, name, rut: '', giro: '', address: '' });
                m.accounts.push({ id: uid('acc'), companyId: id, name: 'Caja principal', type: 'caja', bank: '', number: '', initialBalance: 0 });
                m.activeCompanyId = id;
              }, 'empresa creada', name);
              setNewCo('');
            },
          }, '＋ Añadir')),
        h('p', { style: { fontSize: '11px', color: 'var(--kcf-muted)' } }, 'El RUT de la empresa permite al OCR distinguir ventas (emites tú) de compras (te emiten). Multitenant: cada instancia/equipo del shell KIMOS es un tenant aislado.')),
      h('div', { className: 'kcf-panel kcf-span6' },
        h('h4', null, '💵 Cajas y cuentas bancarias — ' + s((co || {}).name)),
        accs.map((a) => h('div', { key: a.id, className: 'kcf-cat-row' },
          h('span', null, a.type === 'banco' ? '🏦' : '💵'),
          h('input', { className: 'kcf-input grow', value: a.name, onChange: (e) => commitPatch('accounts', a.id, { name: e.target.value }) }),
          h('input', { className: 'kcf-input', style: { width: '110px' }, placeholder: 'banco', value: a.bank, onChange: (e) => commitPatch('accounts', a.id, { bank: e.target.value }) }),
          h('input', { className: 'kcf-input', style: { width: '110px' }, type: 'number', title: 'Saldo inicial', placeholder: 'saldo inicial', value: a.initialBalance, onChange: (e) => commitPatch('accounts', a.id, { initialBalance: num(e.target.value) }) }),
          h('button', { className: 'kcf-mini kcf-danger', onClick: () => commit((m) => { m.accounts = m.accounts.filter((x) => x.id !== a.id); m.movements.forEach((mv) => { if (mv.accountId === a.id) mv.accountId = ''; }); }, 'cuenta eliminada', a.name) }, '🗑'))),
        h('div', { className: 'kcf-addrow' },
          Sel({ value: newAccType, onChange: (e) => setNewAccType(e.target.value) }, [{ value: 'caja', label: '💵 Caja' }, { value: 'banco', label: '🏦 Banco' }]),
          h('input', { className: 'kcf-input', placeholder: 'Nombre de la cuenta…', value: newAcc, onChange: (e) => setNewAcc(e.target.value) }),
          h('button', { className: 'kcf-btn', onClick: () => { const name = newAcc.trim(); if (!name) return; commit((m) => { m.accounts.push({ id: uid('acc'), companyId: cid, name, type: newAccType, bank: '', number: '', initialBalance: 0 }); }, 'cuenta creada', name); setNewAcc(''); } }, '＋ Añadir'))),
      h('div', { className: 'kcf-panel kcf-span6' },
        h('h4', null, '🏷️ Categorías personalizadas'),
        model.categories.map((c) => h('div', { key: c.id, className: 'kcf-cat-row' },
          h('input', { type: 'color', value: c.color, onChange: (e) => commitPatch('categories', c.id, { color: e.target.value }) }),
          h('input', { className: 'kcf-input grow', value: c.name, onChange: (e) => commitPatch('categories', c.id, { name: e.target.value }) }),
          h('span', { className: 'kcf-chip ' + (c.kind === 'ingreso' ? 'in' : 'out') }, c.kind),
          h('button', { className: 'kcf-mini kcf-danger', onClick: () => commit((m) => { m.categories = m.categories.filter((x) => x.id !== c.id); m.movements.forEach((mv) => { if (mv.categoryId === c.id) mv.categoryId = ''; }); m.budgets = m.budgets.filter((b) => b.categoryId !== c.id); }, 'categoría eliminada', c.name) }, '🗑'))),
        h('div', { className: 'kcf-addrow' },
          h('input', { className: 'kcf-input', placeholder: 'Nueva categoría…', value: newCat, onChange: (e) => setNewCat(e.target.value) }),
          Sel({ value: newCatKind, onChange: (e) => setNewCatKind(e.target.value) }, [{ value: 'egreso', label: '↓ egreso' }, { value: 'ingreso', label: '↑ ingreso' }]),
          h('button', { className: 'kcf-btn', onClick: () => { if (addCatalogItem('category', { name: newCat, kind: newCatKind }).success) setNewCat(''); } }, '＋'))),
      h('div', { className: 'kcf-panel kcf-span6' },
        h('h4', null, '📁 Proyectos y 🎯 centros de costos'),
        model.projects.map((p) => h('div', { key: p.id, className: 'kcf-cat-row' }, h('span', null, '📁'),
          h('input', { className: 'kcf-input grow', value: p.name, onChange: (e) => commitPatch('projects', p.id, { name: e.target.value }) }),
          h('button', { className: 'kcf-mini kcf-danger', onClick: () => commit((m) => { m.projects = m.projects.filter((x) => x.id !== p.id); m.movements.forEach((mv) => { if (mv.projectId === p.id) mv.projectId = ''; }); }, 'proyecto eliminado', p.name) }, '🗑'))),
        h('div', { className: 'kcf-addrow' },
          h('input', { className: 'kcf-input', placeholder: 'Nuevo proyecto…', value: newProj, onChange: (e) => setNewProj(e.target.value) }),
          h('button', { className: 'kcf-btn', onClick: () => { if (addCatalogItem('project', { name: newProj }).success) setNewProj(''); } }, '＋')),
        model.costCenters.map((c) => h('div', { key: c.id, className: 'kcf-cat-row' }, h('span', null, '🎯'),
          h('input', { className: 'kcf-input grow', value: c.name, onChange: (e) => commitPatch('costCenters', c.id, { name: e.target.value }) }),
          h('button', { className: 'kcf-mini kcf-danger', onClick: () => commit((m) => { m.costCenters = m.costCenters.filter((x) => x.id !== c.id); m.movements.forEach((mv) => { if (mv.costCenterId === c.id) mv.costCenterId = ''; }); }, 'centro de costos eliminado', c.name) }, '🗑'))),
        h('div', { className: 'kcf-addrow' },
          h('input', { className: 'kcf-input', placeholder: 'Nuevo centro de costos…', value: newCc, onChange: (e) => setNewCc(e.target.value) }),
          h('button', { className: 'kcf-btn', onClick: () => { if (addCatalogItem('costCenter', { name: newCc }).success) setNewCc(''); } }, '＋'))),
      h('div', { className: 'kcf-panel kcf-span12' },
        h('h4', null, '🧾 Auditoría (trazabilidad financiera)',
          h('span', { className: 'kcf-spacer' }),
          h('button', { className: 'kcf-btn', onClick: exportAudit, disabled: !model.audit.length }, '⬇ CSV'),
          h('button', { className: 'kcf-btn', onClick: exportBackup, style: { marginLeft: '6px' } }, '💾 Respaldo JSON')),
        model.audit.length
          ? h('div', { style: { maxHeight: '260px', overflowY: 'auto' } }, model.audit.slice(0, 60).map((a) => h('div', { key: a.id, className: 'kcf-audit-row' },
              h('span', { className: 'kcf-audit-when' }, new Date(a.at).toLocaleString()),
              h('span', null, h('b', null, a.action + ': '), a.detail))))
          : h('div', { className: 'kcf-empty' }, 'Aún sin eventos.'),
        h('p', { style: { fontSize: '11px', color: 'var(--kcf-muted)', marginBottom: 0 } },
          'KIMOS Cashflow v1.0 · Agente ' + (agentRegistered ? 'conectado ✅ (IA agnóstica: OpenAI, Claude, Gemini, Ollama, modelos locales, MCP vía KIMOS)' : 'no disponible en este shell') +
          ' · Principios: Seguridad, Privacidad, Transparencia, Human in the Loop, IA Responsable, Modularidad y Trazabilidad Financiera. ' +
          'Los datos viven en tu instancia (local-first) y se sincronizan con KIMOS Cloud a través del shell.')));
  }

  // ── Componente raíz ─────────────────────────────────────────────────────
  function App() {
    const [, force] = useState(0);
    const [tab, setTab] = useState('dashboard');
    const [mode, setMode] = useState('mes');
    const [customFrom, setCustomFrom] = useState(todayISO().slice(0, 8) + '01');
    const [customTo, setCustomTo] = useState(todayISO());
    const [movModal, setMovModal] = useState(null); // {title, initial, saveLabel, onSave}
    const [viewerId, setViewerId] = useState('');
    const [paste, setPaste] = useState(null); // null | {docId}
    useEffect(() => {
      const l = () => force((x) => x + 1);
      listeners.add(l);
      return () => listeners.delete(l);
    }, []);
    if (!loaded) return h('div', { className: 'kimos-cashflow' }, h('div', { className: 'kcf-empty', style: { marginTop: '60px' } }, '⏳ Cargando KIMOS Cashflow…'));
    if (loadError) return h('div', { className: 'kimos-cashflow' }, h('div', { className: 'kcf-empty', style: { marginTop: '60px' } }, '⚠️ ' + loadError));

    const [from, to] = rangeFor(mode, customFrom, customTo);
    const openNew = (type) => setMovModal({
      title: type === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo egreso',
      initial: { type, accountId: (model.accounts.find((a) => a.companyId === model.activeCompanyId) || {}).id || '' },
      saveLabel: 'Registrar',
      onSave: (f) => { const r = upsertMovement(f, 'usuario'); if (r.success) setMovModal(null); else shell.notify && shell.notify({ level: 'warn', text: r.error }); },
    });
    const openEdit = (mv) => setMovModal({
      title: 'Editar movimiento', initial: Object.assign({}, mv), saveLabel: 'Guardar cambios',
      onSave: (f) => { const r = upsertMovement(Object.assign({}, mv, f), 'usuario (edición)'); if (r.success) setMovModal(null); else shell.notify && shell.notify({ level: 'warn', text: r.error }); },
    });
    const openEditApprove = (p) => setMovModal({
      title: '✏️ Editar propuesta y aprobar', initial: Object.assign({}, p.draft), saveLabel: '✔ Aprobar con ediciones',
      onSave: (f) => { const r = resolveProposal(p.id, 'aprobar', f); if (r.success) setMovModal(null); else shell.notify && shell.notify({ level: 'warn', text: r.error }); },
    });

    const pending = model.proposals.filter((p) => p.status === 'pendiente').length;
    const TABS = [
      ['dashboard', '📊', 'Dashboard', 0],
      ['movs', '💸', 'Flujo de Caja', 0],
      ['journal', '📒', 'Libro Diario', 0],
      ['docs', '📁', 'Documentos', 0],
      ['review', '✅', 'Revisión', pending],
      ['proj', '📈', 'Proyecciones', 0],
      ['analysis', '🔍', 'Análisis', 0],
      ['settings', '⚙️', 'Ajustes', 0],
    ];
    const MODES = [
      ['dia', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['trimestre', 'Trimestre'],
      ['anio', 'Año'], ['todo', 'Todo'], ['personalizado', 'Personalizado'],
    ];
    return h('div', { className: 'kimos-cashflow' },
      h('div', { className: 'kcf-toolbar' },
        h('span', { className: 'kcf-brand' }, '💰 KIMOS Cashflow ', h('small', null, 'Agente Financiero Inteligente')),
        h('select', {
          className: 'kcf-select', value: model.activeCompanyId, title: 'Empresa activa',
          onChange: (e) => commit((m) => { m.activeCompanyId = e.target.value; }, 'empresa activa', s((model.companies.find((c) => c.id === e.target.value) || {}).name)),
        }, model.companies.map((c) => h('option', { key: c.id, value: c.id }, '🏢 ' + c.name))),
        h('select', { className: 'kcf-select', value: mode, title: 'Período', onChange: (e) => setMode(e.target.value) },
          MODES.map(([v, l]) => h('option', { key: v, value: v }, '📅 ' + l))),
        mode === 'personalizado' ? h('input', { className: 'kcf-input', type: 'date', value: customFrom, onChange: (e) => setCustomFrom(e.target.value) }) : null,
        mode === 'personalizado' ? h('input', { className: 'kcf-input', type: 'date', value: customTo, onChange: (e) => setCustomTo(e.target.value) }) : null,
        h('span', { className: 'kcf-spacer' }),
        h('button', { className: 'kcf-btn kcf-btn-income', onClick: () => openNew('ingreso') }, '＋ Ingreso'),
        h('button', { className: 'kcf-btn kcf-btn-expense', onClick: () => openNew('egreso') }, '－ Egreso')),
      h('div', { className: 'kcf-tabs' }, TABS.map(([id, icon, label, badge]) =>
        h('button', { key: id, className: 'kcf-tab' + (tab === id ? ' active' : ''), onClick: () => setTab(id) },
          icon + ' ' + label, badge ? h('span', { className: 'kcf-badge' }, badge) : null))),
      h('div', { className: 'kcf-body' },
        tab === 'dashboard' ? h(DashboardTab, { from, to, goTab: setTab }) : null,
        tab === 'movs' ? h(MovementsTab, { from, to, onEdit: openEdit }) : null,
        tab === 'journal' ? h(JournalTab, { from, to }) : null,
        tab === 'docs' ? h(DocsTab, { onView: setViewerId, onPaste: (docId) => setPaste({ docId }) }) : null,
        tab === 'review' ? h(ReviewTab, { onEditApprove: openEditApprove, onViewDoc: setViewerId }) : null,
        tab === 'proj' ? h(ProjectionsTab, null) : null,
        tab === 'analysis' ? h(AnalysisTab, null) : null,
        tab === 'settings' ? h(SettingsTab, null) : null),
      movModal ? h(MovementModal, { initial: movModal.initial, title: movModal.title, saveLabel: movModal.saveLabel, onSave: movModal.onSave, onCancel: () => setMovModal(null) }) : null,
      viewerId ? h(DocViewer, { docId: viewerId, onClose: () => setViewerId('') }) : null,
      paste ? h(PasteModal, { docId: paste.docId, onClose: () => setPaste(null) }) : null);
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────
  try { shell.window && shell.window.setTitle && shell.window.setTitle('KIMOS Cashflow'); } catch (e) { /* opcional */ }
  registerAgent();
  load();

  return {
    Component: App,
    unmount() {
      listeners.clear();
      if (offConfig) { try { offConfig(); } catch (e) { /* noop */ } offConfig = null; }
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; doSave(); }
    },
  };
}
