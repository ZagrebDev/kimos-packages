// ── Cobrar la propuesta ─────────────────────────────────────────────────
/**
 * src/68-payments.js — enlace de pago por cotización (`shell.payments`,
 * APP-SPEC §7.g).
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Una propuesta aceptada por teléfono se muere esperando a que alguien mande
 * los datos de transferencia. El momento en que el cliente dice que sí es el
 * momento en que hay que poder cobrarle, y no dos días después. Así que la
 * cotización lleva su propio enlace de pago: se manda con el PDF, se pega en
 * un WhatsApp, y el cliente paga con la tarjeta que ya tiene en la mano.
 *
 * QUÉ HACE Y QUÉ NO HACE ESTA APP
 *
 * No habla con Webpay ni con MercadoPago. No ve una llave. Pide un enlace a
 * la plataforma —que sí sabe de pasarelas, y guarda las credenciales en
 * Secret Manager— y guarda lo que le devuelve.
 *
 *     cotización ──> shell.payments.create() ──> url de KIMOS  ← esto se manda
 *                                                     │
 *                                       el cliente la abre y elige pasarela
 *
 * Que el enlace lo sirva KIMOS y no la pasarela es lo que hace que se pueda
 * mandar por correo: un checkout de Webpay caduca en minutos. Ver §7.g.
 *
 * TRES COSAS QUE SE DECIDEN AQUÍ Y CONVIENE NO DESHACER
 *
 *   · El importe sale de `computeTotals`, no de un campo escrito a mano. Un
 *     cobro que no cuadra con la propuesta que lo justifica es una discusión
 *     con el cliente garantizada.
 *   · El estado que se guarda en el documento es una INSTANTÁNEA. La verdad
 *     está en la plataforma, y se pregunta al abrir la cotización. Así la
 *     lista se pinta sin salir a la red por cada fila.
 *   · Un cobro pagado NO cambia el estado de la cotización a «aceptada» por
 *     su cuenta si lo pagado fue solo el abono. Un abono no es una venta
 *     cerrada, y marcarla como tal falsearía el embudo.
 */

/** '' si se puede cobrar; si no, el motivo, para poder explicarlo. */
function cobroNoDisponible() {
  if (!shell.payments || typeof shell.payments.create !== 'function') {
    return 'Este host todavía no permite cobrar desde las apps; manda los datos de transferencia como siempre.';
  }
  return '';
}

/** Lee qué pasarelas hay. Espejo de lectura, como el de marcas o catálogos. */
async function loadPayInfo(force) {
  const p = model.pay;
  if (!force && (p.loading || p.loaded)) return p;
  const motivo = cobroNoDisponible();
  if (motivo) {
    setModel({ pay: Object.assign({}, p, { loading: false, loaded: true, error: motivo, available: [], providers: [] }) });
    return model.pay;
  }
  setModel({ pay: Object.assign({}, p, { loading: true, error: null }) });
  try {
    const info = await shell.payments.info(rulesOf().currency);
    setModel({
      pay: {
        loading: false, loaded: true, error: null, at: stamp(),
        providers: arr(info && info.providers),
        available: arr(info && info.available).map(s).filter(Boolean),
      },
    });
  } catch (e) {
    setModel({
      pay: Object.assign({}, model.pay, {
        loading: false, loaded: true, providers: [], available: [],
        error: 'No se pudieron leer las pasarelas: ' + ((e && e.message) || 'error'),
      }),
    });
  }
  return model.pay;
}

/**
 * Qué se cobra de esta cotización: el total o el abono.
 *
 * Devuelve `{ amount, covers, label }`, o `amount: 0` si no hay nada que
 * cobrar — una cotización sin líneas, o con abono configurado pero sin abono
 * en este documento.
 */
function importeACobrar(doc, rules) {
  const r = normalizeRules(rules || rulesOf());
  const t = computeTotals(doc, r);
  if (r.payCharge === 'advance' && t.advance > 0) {
    return { amount: t.advance, covers: 'advance', label: 'Abono', currency: t.currency };
  }
  return { amount: t.total, covers: 'total', label: 'Total', currency: t.currency };
}

/** Lo que verá el cliente en su cartola. Que se pueda reconocer importa. */
function descripcionDeCobro(doc) {
  const num = s(doc.number);
  const marca = doc.brand && s(doc.brand.name);
  const emisor = marca || s(issuerOf().name);
  return [emisor, num || s(doc.name)].filter(Boolean).join(' · ').slice(0, 120);
}

/** `true` si el cobro de este documento sigue vivo y no hace falta otro. */
function cobroVigente(doc) {
  const p = doc && doc.payment;
  if (!p || !s(p.url)) return false;
  return p.status === 'pending' || p.status === 'paid';
}

/**
 * Genera el enlace de cobro de una cotización.
 *
 * Si ya hay uno vigente no crea otro: dos enlaces vivos para la misma
 * propuesta son dos formas de cobrarla dos veces. Para rehacerlo hay que
 * anular el anterior, que es una decisión explícita.
 */
async function actCreatePaymentLink(quoteId, opts) {
  const o = isObj(opts) ? opts : {};
  const doc = docById(s(quoteId));
  if (!doc) return null;

  const motivo = cobroNoDisponible();
  if (motivo) { if (!o.silent) shell.notify({ level: 'warn', text: motivo }); return null; }

  if (cobroVigente(doc) && !o.force) {
    if (!o.silent) shell.notify({ level: 'info', text: 'Esta cotización ya tiene un enlace de cobro.' });
    return doc.payment;
  }
  if (doc.kind === KIND_TEMPLATE) {
    if (!o.silent) shell.notify({ level: 'warn', text: 'Una cotización tipo no se cobra: cóbrala en la cotización que salga de ella.' });
    return null;
  }

  const rules = rulesOf();
  const cobro = importeACobrar(doc, rules);
  if (!(cobro.amount > 0)) {
    if (!o.silent) shell.notify({ level: 'warn', text: 'Esta cotización no tiene un importe que cobrar todavía.' });
    return null;
  }

  let link;
  try {
    link = await shell.payments.create({
      amount: cobro.amount,
      currency: cobro.currency.code || rules.currency,
      description: descripcionDeCobro(doc),
      reference: doc.id,
      label: [s(doc.number) || s(doc.name), s(doc.client.name)].filter(Boolean).join(' · '),
      providers: arr(rules.payProviders),
      payerEmail: s(doc.client.email),
      payerName: s(doc.client.name),
      expiresInDays: rules.payExpiresDays,
    });
  } catch (e) {
    if (!o.silent) shell.notify({ level: 'error', text: 'No se pudo generar el enlace de cobro: ' + ((e && e.message) || 'error') });
    return null;
  }
  if (!isObj(link) || !s(link.url)) {
    if (!o.silent) shell.notify({ level: 'error', text: 'La plataforma no devolvió un enlace de cobro.' });
    return null;
  }

  const pago = normalizePayment({
    linkId: link.id, url: link.url, amount: link.amount, currency: link.currency,
    covers: cobro.covers, status: link.status || 'pending',
    expiresAt: link.expiresAt, createdAt: link.createdAt, checkedAt: stamp(),
  });
  commitDoc(doc.id, (d) => {
    d.payment = pago;
    return logEvent(d, 'payment', 'Enlace de cobro generado · ' + money(pago.amount, cobro.currency)
      + (pago.covers === 'advance' ? ' (abono)' : ''));
  });
  if (!o.silent) {
    shell.notify({ level: 'success', text: 'Enlace de cobro listo. Va en la propuesta y se puede copiar.' });
  }
  return pago;
}

/**
 * Pregunta a la plataforma si ya pagaron y actualiza la instantánea.
 *
 * Devuelve el pago actualizado. Si acaba de pasar a pagado lo registra en la
 * bitácora, que es donde después se mira quién pagó qué y cuándo.
 */
async function actRefreshPayment(quoteId, opts) {
  const o = isObj(opts) ? opts : {};
  const doc = docById(s(quoteId));
  if (!doc || !doc.payment || !s(doc.payment.linkId)) return null;
  if (cobroNoDisponible() || typeof shell.payments.get !== 'function') return null;

  let link;
  try {
    link = await shell.payments.get(s(doc.payment.linkId));
  } catch (e) {
    if (!o.silent) shell.notify({ level: 'error', text: 'No se pudo consultar el cobro: ' + ((e && e.message) || 'error') });
    return null;
  }
  if (!isObj(link)) return null;

  const antes = s(doc.payment.status);
  const ahora = s(link.status) || 'pending';
  const pago = normalizePayment(Object.assign({}, doc.payment, {
    status: ahora, paidAt: link.paidAt, paidWith: link.paidWith,
    amount: link.amount, expiresAt: link.expiresAt, checkedAt: stamp(),
  }));

  commitDoc(doc.id, (d) => {
    d.payment = pago;
    if (ahora === 'paid' && antes !== 'paid') {
      return logEvent(d, 'payment', 'Pagado · ' + money(pago.amount, currencyOf(d, rulesOf()))
        + (pago.covers === 'advance' ? ' (abono)' : '') + (s(pago.paidWith) ? ' · ' + s(pago.paidWith) : ''));
    }
    return d;
  });

  // Un pago del TOTAL cierra la venta y así se dice en el embudo. Un abono
  // no: se ha cobrado la señal, la propuesta sigue en juego, y marcarla como
  // aceptada haría que el pipeline contase como ganado lo que no lo está.
  if (ahora === 'paid' && antes !== 'paid') {
    if (pago.covers === 'total' && docById(doc.id).status !== 'accepted') {
      actSetStatus(doc.id, 'accepted', 'Pagada en línea');
    }
    if (!o.silent) {
      shell.notify({
        level: 'success',
        text: pago.covers === 'advance'
          ? 'Abono recibido. La cotización sigue abierta por el saldo.'
          : 'Cotización pagada.',
      });
    }
  } else if (!o.silent) {
    shell.notify({ level: 'info', text: 'Todavía no hay pago registrado en esta cotización.' });
  }
  return pago;
}

/** Anula el cobro pendiente. Uno pagado no se anula: eso es una devolución. */
async function actCancelPayment(quoteId) {
  const doc = docById(s(quoteId));
  if (!doc || !doc.payment || !s(doc.payment.linkId)) return null;
  if (cobroNoDisponible() || typeof shell.payments.cancel !== 'function') return null;
  if (doc.payment.status === 'paid') {
    shell.notify({ level: 'warn', text: 'Este cobro ya está pagado: la devolución se hace en la pasarela.' });
    return null;
  }
  try {
    await shell.payments.cancel(s(doc.payment.linkId));
  } catch (e) {
    shell.notify({ level: 'error', text: 'No se pudo anular el cobro: ' + ((e && e.message) || 'error') });
    return null;
  }
  const out = commitDoc(doc.id, (d) => {
    d.payment = normalizePayment(Object.assign({}, d.payment, { status: 'cancelled', checkedAt: stamp() }));
    return logEvent(d, 'payment', 'Enlace de cobro anulado');
  });
  shell.notify({ level: 'success', text: 'Enlace de cobro anulado. Puedes generar otro.' });
  return out;
}

/**
 * «Marcar como enviada» sin mandar el correo desde aquí.
 *
 * Es el camino de quien manda la propuesta por WhatsApp, la imprime o la
 * adjunta desde su propio correo: hasta ahora tenía que cambiar el estado a
 * mano y el enlace de cobro no existía. Ahora, en un gesto:
 *
 *   1. genera el enlace de cobro (si el cotizador lo tiene activado),
 *   2. exporta el PDF, que es lo que se va a mandar,
 *   3. deja la cotización en «enviada», con su nota en la bitácora.
 *
 * El orden importa: el enlace primero, porque tiene que salir DENTRO del PDF.
 * Generarlo después dejaría un PDF sin forma de pagar, que es justo lo que
 * esto viene a evitar.
 */
async function actMarkSent(quoteId, opts) {
  const o = isObj(opts) ? opts : {};
  const doc = docById(s(quoteId));
  if (!doc) return null;
  if (doc.kind === KIND_TEMPLATE) {
    shell.notify({ level: 'warn', text: 'Una cotización tipo no se envía: crea una cotización desde ella.' });
    return null;
  }

  const rules = rulesOf();
  const conCobro = o.withPayment != null ? o.withPayment !== false : rules.payEnabled && rules.payOnSend;
  if (conCobro && !cobroNoDisponible() && !cobroVigente(doc)) {
    await actCreatePaymentLink(doc.id, { silent: true });
  }

  let pdf = true;
  if (o.pdf !== false) {
    pdf = await actExportPdf(doc.id);
  }

  const pago = docById(doc.id).payment;
  const nota = [
    o.pdf === false ? 'Marcada a mano' : 'PDF exportado',
    pago && s(pago.url) ? 'con enlace de cobro' : '',
    s(o.detail),
  ].filter(Boolean).join(' · ');
  actSetStatus(doc.id, 'sent', nota);

  shell.notify({
    level: 'success',
    text: pago && s(pago.url)
      ? 'Marcada como enviada, con su enlace de cobro listo para mandar.'
      : 'Marcada como enviada.',
  });
  return { doc: docById(doc.id), pdf: pdf !== false, payment: pago || null };
}
