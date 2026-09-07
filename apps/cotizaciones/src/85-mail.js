/* ══ CORREO ═══════════════════════════════════════════════════════════════
 *
 * Mandar la cotización por correo con el SMTP del tenant
 * (`POST /api/integrations/email/send`), desde plantillas de correo
 * editables y reutilizables con variables.
 *
 * Sobre el adjunto, que tiene una limitación real que conviene tener a la
 * vista: el PDF lo produce el diálogo de impresión del navegador y lo
 * escribe el usuario en su disco — la página NO recibe ese archivo, así que
 * la app no puede adjuntarlo sola. De ahí los tres caminos, por orden de
 * comodidad:
 *
 *   1. Enlace a la propuesta publicada. Siempre funciona, no pesa, y el
 *      cliente ve la propuesta tal cual en el navegador.
 *   2. La propuesta como archivo HTML autocontenido, generada aquí mismo y
 *      adjuntada con un clic.
 *   3. El PDF: se exporta primero (👁 Vista previa → Exportar PDF), se
 *      guarda, y se adjunta desde el disco con «Añadir archivo».
 */

const MAIL_SEND_URL = API + '/api/integrations/email/send';
const MAIL_STATUS_URL = API + '/api/integrations/email/status';

/**
 * Variables de las plantillas. Cada una sabe resolverse desde la cotización,
 * así que la plantilla se escribe una vez y sirve para todas.
 */
const MAIL_VARS = [
  ['cliente', 'Nombre del cliente', (d) => s(d.client.name)],
  ['contacto', 'Persona de contacto', (d) => s(d.client.contact) || s(d.client.name)],
  ['numero', 'Número de la cotización', (d) => s(d.number)],
  ['titulo', 'Nombre de la cotización', (d) => s(d.name)],
  ['asunto', 'Asunto de la propuesta', (d) => s(d.subtitle)],
  ['fecha', 'Fecha de emisión', (d) => fechaLarga(d.date)],
  ['validez', 'Fecha de vencimiento', (d, c) => fechaLarga(c.until)],
  ['dias', 'Días de vigencia que quedan', (d, c) => {
    const n = diasHasta(c.until);
    return n == null ? '' : String(Math.max(0, n));
  }],
  ['total', 'Total con impuesto', (d, c) => money(c.totals.total, c.cur)],
  ['neto', 'Total neto', (d, c) => money(c.totals.net, c.cur)],
  ['abono', 'Abono', (d, c) => (c.totals.advanceEnabled ? money(c.totals.advance, c.cur) : '')],
  ['saldo', 'Saldo', (d, c) => (c.totals.advanceEnabled ? money(c.totals.balance, c.cur) : '')],
  ['emisor', 'Razón social del emisor', (d, c) => s(c.issuer.name)],
  ['firma', 'Firma del emisor', (d, c) => [s(c.issuer.name), s(c.issuer.email), s(c.issuer.phone)].filter(Boolean).join('\n')],
  ['enlace', 'Enlace a la propuesta publicada', (d) => s(d.publicUrl)],
  ['yo', 'Quien envía', () => meLabel()],
];
const MAIL_VAR_MAP = new Map(MAIL_VARS.map(([k, , fn]) => [k, fn]));

/**
 * Sustituye `{{variable}}` por su valor. Una variable desconocida se deja
 * como está a propósito: es más fácil ver el error en la previsualización
 * que descubrir un hueco en blanco en el correo que ya salió.
 */
function aplicarVars(texto, doc, ctx) {
  return s(texto).replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (todo, clave) => {
    const fn = MAIL_VAR_MAP.get(s(clave).toLowerCase());
    return fn ? s(fn(doc, ctx)) : todo;
  });
}

/** Resuelve una plantilla contra una cotización: lo que se va a mandar. */
function resolverCorreo(tpl, doc) {
  const t = normalizeMail(tpl || {});
  const ctx = contextoDe(doc, model.def);
  const r = (v) => aplicarVars(v, doc, ctx);
  return {
    templateId: t.id,
    to: r(t.to) || s(doc.client.email),
    cc: r(t.cc),
    bcc: r(t.bcc),
    replyTo: r(t.replyTo) || s(ctx.issuer.email),
    subject: r(t.subject) || ((s(doc.number) ? s(doc.number) + ' · ' : '') + s(doc.name)),
    body: r(t.body),
    attachProposal: t.attachProposal,
    includeLink: t.includeLink,
  };
}

/**
 * Cuerpo del correo en HTML.
 *
 * Se arma con `escapeHtml()` en cada trozo de texto de la persona, no
 * dejándoselo al navegador: así la función no depende del DOM (se puede
 * probar), y el escapado es explícito y está a la vista de quien lea esto en
 * vez de ser un efecto secundario de `textContent`.
 */
function cuerpoHtml(texto, enlace, etiquetaEnlace) {
  const partes = ['<div style="font: 14px/1.65 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #16181d;">'];
  for (const linea of s(texto).split(/\n/)) {
    partes.push('<div>' + (escapeHtml(linea) || '&nbsp;') + '</div>');
  }
  const url = s(enlace).trim();
  // Solo http(s): un `javascript:` en el href de un correo no tiene por qué
  // llegar nunca, aunque los clientes de correo lo ignoren.
  if (/^https?:\/\//i.test(url)) {
    partes.push(
      '<div style="margin-top: 22px;">'
      + '<a href="' + escapeHtml(url) + '"'
      + ' style="display: inline-block; padding: 11px 20px; border-radius: 6px;'
      + ' background: #16181d; color: #fff; text-decoration: none; font-weight: 600;">'
      + escapeHtml(s(etiquetaEnlace) || 'Ver la propuesta')
      + '</a></div>',
    );
  }
  partes.push('</div>');
  return partes.join('');
}

// ── Estado de la integración ────────────────────────────────────────────
/**
 * ¿Está configurado el correo del tenant? Se consulta una vez y se cachea:
 * la respuesta decide si el botón de enviar se ofrece o se explica por qué
 * no, en vez de fallar al pulsarlo.
 */
let mailStatusCache = null;
async function mailStatus(force) {
  if (mailStatusCache && !force) return mailStatusCache;
  if (!shell.authFetch) {
    mailStatusCache = { configured: false, reason: 'Este host no permite llamar al backend.' };
    return mailStatusCache;
  }
  try {
    const res = await shell.authFetch(MAIL_STATUS_URL, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    mailStatusCache = res.ok && data.configured
      ? { configured: true, fromEmail: s(data.fromEmail), fromName: s(data.fromName) }
      : { configured: false, reason: 'El correo del tenant no está configurado. Un superadministrador lo activa en Ajustes → Integraciones → Email.' };
  } catch (e) {
    mailStatusCache = { configured: false, reason: 'No se pudo consultar la integración de correo.' };
  }
  return mailStatusCache;
}

// ── Acciones ────────────────────────────────────────────────────────────
const actUpsertMailTemplate = (tpl) => (isObj(tpl) ? upsertMail(tpl) : null);
const actRemoveMailTemplate = (id) => removeMail(s(id));
const defaultMailTemplate = () => model.mails.find((m) => m.isDefault) || model.mails[0] || null;

function actSetDefaultMailTemplate(id) {
  const target = s(id);
  for (const m of model.mails) {
    const debe = m.id === target;
    if (m.isDefault !== debe) upsertMail(Object.assign({}, m, { isDefault: debe }));
  }
  return mailById(target);
}

/** Deja preparado en la cotización el correo con el que va a salir. */
function actPrepareMail(quoteId, templateId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const tpl = templateId ? mailById(s(templateId)) : defaultMailTemplate();
  const correo = resolverCorreo(tpl, doc);
  actPatchDoc(doc.id, { mail: correo });
  return correo;
}

/**
 * Envía la cotización. `payload` es lo que se ve en el diálogo, ya resuelto:
 * lo que se manda es exactamente lo que la persona leyó antes de pulsar.
 */
async function actSendMail(quoteId, payload) {
  const doc = docById(s(quoteId));
  if (!doc) return { ok: false, error: 'La cotización ya no existe.' };
  const p = isObj(payload) ? payload : {};

  const to = s(p.to).trim();
  if (!to) return { ok: false, error: 'Falta el destinatario.' };
  const subject = s(p.subject).trim();
  if (!subject) return { ok: false, error: 'Falta el asunto.' };

  const estado = await mailStatus();
  if (!estado.configured) return { ok: false, error: estado.reason };

  const enlace = p.includeLink ? s(p.link || doc.publicUrl) : '';
  const cuerpo = {
    to,
    cc: s(p.cc),
    bcc: s(p.bcc),
    replyTo: s(p.replyTo),
    subject,
    text: s(p.body) + (enlace ? '\n\n' + enlace : ''),
    html: cuerpoHtml(p.body, enlace, p.linkLabel),
    attachments: arr(p.attachments).map((a) => ({
      filename: s(a.filename),
      contentType: s(a.contentType) || 'application/octet-stream',
      contentBase64: s(a.contentBase64),
    })),
  };

  try {
    const res = await shell.authFetch(MAIL_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: s(data.detail) || 'No se pudo enviar (HTTP ' + res.status + ').' };

    const destinos = [to, s(p.cc)].filter(Boolean).join(', ');
    commitDoc(doc.id, (d) => {
      d.mail = Object.assign({}, isObj(d.mail) ? d.mail : {}, {
        to, cc: s(p.cc), subject, body: s(p.body), sentAt: stamp(), sentBy: meLabel(),
      });
      return logEvent(d, 'mail', 'Enviada por correo a ' + destinos
        + (arr(p.attachments).length ? ' · ' + arr(p.attachments).length + ' adjunto(s)' : '')
        + (enlace ? ' · con enlace' : ''));
    });
    // Mandar una cotización es, justamente, enviarla: el estado lo refleja.
    if (doc.status === 'draft') actSetStatus(doc.id, 'sent', 'por correo');
    shell.notify({ level: 'success', text: 'Cotización enviada a ' + to });
    return { ok: true, to };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'No se pudo enviar el correo.' };
  }
}

// ── Pestaña Correos ─────────────────────────────────────────────────────
function MailsTab(props) {
  const m = props.m;
  const [editando, setEditando] = useState(null);
  const [estado, setEstado] = useState(null);
  const [ask, confirmNode] = useConfirm();
  useEffect(() => { mailStatus().then(setEstado); }, []);

  const banner = estado ? h('div', {
    className: cx('cz-banner', estado.configured ? 'ok' : 'warn'),
  }, estado.configured
    ? 'El correo del tenant está configurado: los envíos salen desde ' + (estado.fromEmail || 'el buzón de la empresa') + '.'
    : estado.reason) : null;

  return h('div', { className: 'cz-tab' }, [
    banner,
    h('div', { key: 'bar', className: 'cz-listbar' }, [
      h('span', { key: 't', className: 'cz-card-note' },
        'Plantillas reutilizables para mandar cotizaciones. Las variables se sustituyen al enviar.'),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, { key: 'n', variant: 'primary', onClick: () => setEditando(normalizeMail({})) }, '+ Nueva plantilla'),
    ]),
    !m.mails.length
      ? h(Empty, {
        key: 'e', icon: '✉️',
        title: 'Aún no hay plantillas de correo',
        text: 'Escribe una vez el correo con el que mandas las cotizaciones —con variables como {{cliente}} o {{total}}— y reutilízalo en todas.',
        action: h('div', { className: 'cz-inline' }, [
          h(Btn, { key: 'n', variant: 'primary', onClick: () => setEditando(normalizeMail({})) }, 'Crear plantilla'),
          h(Btn, { key: 'e', onClick: () => setEditando(normalizeMail(plantillaCorreoEjemplo())) }, 'Empezar desde un ejemplo'),
        ]),
      })
      : h('div', { key: 'l', className: 'cz-tablewrap' }, h('table', { className: 'cz-table' }, [
        h('thead', { key: 'h' }, h('tr', null, [
          h('th', { key: 'n', className: 'cz-th' }, 'Plantilla'),
          h('th', { key: 's', className: 'cz-th' }, 'Asunto'),
          h('th', { key: 'a', className: 'cz-th cz-th-acts' }, ''),
        ])),
        h('tbody', { key: 'b' }, m.mails.map((t) => h('tr', {
          key: t.id, className: 'cz-tr', onClick: () => setEditando(t),
        }, [
          h('td', { key: 'n' }, [
            h('div', { key: 'a', className: 'cz-cell-title' }, [
              t.name,
              t.isDefault ? h('span', { key: 'd', className: 'cz-star', title: 'Plantilla de correo predeterminada' }, ' ⭐') : null,
            ]),
            h('div', { key: 'b', className: 'cz-cell-sub' }, [
              t.attachProposal ? 'adjunta la propuesta' : null,
              t.includeLink ? 'incluye el enlace' : null,
            ].filter(Boolean).join(' · ')),
          ]),
          h('td', { key: 's', className: 'cz-dim' }, t.subject || '—'),
          h('td', { key: 'a', className: 'cz-td-acts', onClick: (e) => e.stopPropagation() }, [
            h(IconBtn, {
              key: 'd', icon: t.isDefault ? '⭐' : '☆',
              className: t.isDefault ? 'on' : '',
              title: t.isDefault ? 'Es la predeterminada' : 'Usar como predeterminada al enviar',
              onClick: () => actSetDefaultMailTemplate(t.isDefault ? '' : t.id),
            }),
            h(IconBtn, {
              key: 'x', icon: '🗑', title: 'Eliminar plantilla',
              onClick: async () => {
                const ok = await ask({ title: 'Eliminar plantilla', danger: true, okLabel: 'Eliminar', text: '¿Eliminar «' + t.name + '»?' });
                if (ok) actRemoveMailTemplate(t.id);
              },
            }),
          ]),
        ]))),
      ])),
    editando ? h(MailTemplateModal, {
      key: 'ed', tpl: editando, m,
      onClose: () => setEditando(null),
      onSave: (t) => { actUpsertMailTemplate(t); setEditando(null); },
    }) : null,
    confirmNode,
  ]);
}

/** Un punto de partida razonable, para no mirar un cuadro en blanco. */
function plantillaCorreoEjemplo() {
  return {
    name: 'Envío de cotización',
    subject: 'Cotización {{numero}} · {{emisor}}',
    body: 'Estimado/a {{contacto}}:\n\n'
      + 'Junto con saludar, adjuntamos la cotización {{numero}} por un total de {{total}}, '
      + 'con vigencia hasta el {{validez}}.\n\n'
      + 'Quedamos atentos a sus comentarios.\n\n'
      + 'Saludos cordiales,\n{{firma}}',
    includeLink: true,
    attachProposal: false,
  };
}

function MailTemplateModal(props) {
  const { tpl, onClose, onSave } = props;
  const [t, setT] = useState(() => normalizeMail(tpl));
  const set = (p) => setT(Object.assign({}, t, p));
  const bodyRef = useRef(null);

  /** Inserta la variable donde está el cursor del cuerpo. */
  const insertar = (clave) => {
    const el = bodyRef.current;
    const token = '{{' + clave + '}}';
    if (!el || el.selectionStart == null) { set({ body: t.body + token }); return; }
    const i = el.selectionStart;
    const j = el.selectionEnd;
    set({ body: t.body.slice(0, i) + token + t.body.slice(j) });
    setTimeout(() => { try { el.focus(); el.setSelectionRange(i + token.length, i + token.length); } catch (e) { /* no-op */ } }, 0);
  };

  return h(Modal, {
    open: true, wide: true, title: tpl.name ? 'Editar plantilla de correo' : 'Nueva plantilla de correo', onClose,
    footer: [
      h(Btn, { key: 'c', onClick: onClose }, 'Cancelar'),
      h(Btn, { key: 's', variant: 'primary', disabled: !s(t.name).trim(), onClick: () => onSave(t) }, 'Guardar'),
    ],
  }, [
    h('div', { key: 'g', className: 'cz-grid2' }, [
      h(Field, { key: 'n', label: 'Nombre de la plantilla' },
        h(Input, { value: t.name, autoFocus: true, placeholder: 'Envío de cotización', onChange: (e) => set({ name: e.target.value }) })),
      h(Field, { key: 'to', label: 'Para', help: 'Vacío = el correo del cliente de la cotización.' },
        h(Input, { value: t.to, placeholder: '{{cliente}}', onChange: (e) => set({ to: e.target.value }) })),
      h(Field, { key: 'cc', label: 'Copia (Cc)' },
        h(Input, { value: t.cc, placeholder: 'ventas@empresa.cl', onChange: (e) => set({ cc: e.target.value }) })),
      h(Field, { key: 'bcc', label: 'Copia oculta (Cco)' },
        h(Input, { value: t.bcc, placeholder: 'registro@empresa.cl', onChange: (e) => set({ bcc: e.target.value }) })),
      h(Field, { key: 'rt', label: 'Responder a', help: 'Vacío = el correo del emisor.' },
        h(Input, { value: t.replyTo, onChange: (e) => set({ replyTo: e.target.value }) })),
      h(Field, { key: 's', label: 'Asunto', wide: true },
        h(Input, { value: t.subject, placeholder: 'Cotización {{numero}} · {{emisor}}', onChange: (e) => set({ subject: e.target.value }) })),
      h(Field, { key: 'b', label: 'Cuerpo', wide: true },
        h('textarea', {
          ref: bodyRef, className: 'cz-in cz-mailbody', rows: 10, value: t.body,
          placeholder: 'Estimado/a {{contacto}}: …',
          onChange: (e) => set({ body: e.target.value }),
        })),
    ]),
    h('div', { key: 'v', className: 'cz-vars' }, [
      h('div', { key: 't', className: 'cz-vars-t' }, 'Variables — pulsa para insertarla donde esté el cursor'),
      h('div', { key: 'l', className: 'cz-vars-l' }, MAIL_VARS.map(([k, label]) => h(Chip, {
        key: k, title: label, onClick: () => insertar(k),
      }, '{{' + k + '}}'))),
    ]),
    h('div', { key: 'o', className: 'cz-grid2' }, [
      h(Field, { key: 'l', label: 'Enlace a la propuesta' }, h(Toggle, {
        checked: t.includeLink, label: t.includeLink ? 'Se añade un botón al final' : 'Sin enlace',
        onChange: (v) => set({ includeLink: v }),
      })),
      h(Field, { key: 'a', label: 'Adjuntar la propuesta' }, h(Toggle, {
        checked: t.attachProposal, label: t.attachProposal ? 'Se adjunta como archivo HTML' : 'Sin adjunto automático',
        onChange: (v) => set({ attachProposal: v }),
      })),
    ]),
  ]);
}
