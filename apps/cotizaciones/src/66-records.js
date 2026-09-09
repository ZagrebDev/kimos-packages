// ── El cliente de la cotización, ligado al resto de KIMOS ───────────────
/**
 * src/66-records.js — identidad compartida del cliente (`shell.records`).
 *
 * El problema que resuelve: hasta ahora cada cotización guardaba su copia del
 * cliente ("Acme SpA", su RUT, su correo). Clientes guardaba la suya y
 * Prospección guardaría la tercera. Tres Acmes y ninguna vista completa.
 *
 * La solución NO es que la cotización deje de guardar el cliente. Es guardar
 * DOS cosas:
 *
 *   · `client.recordRef` — la referencia a la identidad de la plataforma
 *     (`kimos:record/account/…`). Es lo que permite decir «esta cotización y
 *     ese proyecto son del mismo cliente».
 *   · `client.name`, `taxId`, `email`… — la instantánea, como hasta ahora.
 *
 * La instantánea NO es redundancia: es lo que hace que una cotización enviada
 * hace ocho meses siga imprimiéndose igual aunque el registro se renombre o
 * desaparezca. Una propuesta que se envió al cliente no cambia sola
 * (mismo criterio que las revisiones en 45-templates.js).
 *
 * Todo esto es opcional en los dos sentidos: si el host no expone
 * `shell.records`, la app funciona exactamente como antes y el cliente se
 * escribe a mano. Ver APP-SPEC §7.d.
 */

const RECORD_TYPE = 'account';

/** '' si se puede usar el registro; si no, el motivo, para poder explicarlo. */
function registroNoDisponible() {
  if (!shell.records || typeof shell.records.findOrCreate !== 'function') {
    return 'Este host todavía no expone el registro de identidades, así que el cliente se guarda solo en esta cotización.';
  }
  return '';
}

/**
 * Claves con las que se reconoce a un cliente, en orden de fiabilidad.
 *
 * El RUT identifica a la empresa; el correo, a menudo, solo a la persona que
 * escribió. Se mandan las dos y la plataforma normaliza («77.718.188-2» y
 * «777181882» son la misma), pero el orden importa cuando apuntan a sitios
 * distintos.
 */
function clavesDeCliente(client) {
  const c = isObj(client) ? client : {};
  const keys = {};
  if (s(c.taxId).trim()) keys.taxId = s(c.taxId).trim();
  if (s(c.email).trim()) keys.email = s(c.email).trim();
  return keys;
}

/** Un cliente sin nombre ni claves no es vinculable: no hay a quién apuntar. */
function clienteVinculable(client) {
  const c = isObj(client) ? client : {};
  if (!s(c.name).trim()) return 'Escribe primero el nombre del cliente.';
  return '';
}

/**
 * Vincula el cliente de una cotización con la identidad del sistema.
 *
 * `findOrCreate` REUTILIZA si ya existe: eso es exactamente lo que evita el
 * segundo «Acme SpA». Devuelve `{ ref, created, warning }` o `null` si no se
 * pudo (y en ese caso ya avisó por pantalla: la cotización sigue siendo
 * válida sin vínculo).
 */
async function actLinkClientRecord(quoteId, opts) {
  const o = isObj(opts) ? opts : {};
  const doc = docById(s(quoteId));
  if (!doc) return null;

  const motivo = registroNoDisponible();
  if (motivo) {
    if (!o.silent) shell.notify({ level: 'warn', text: motivo });
    return null;
  }
  const falta = clienteVinculable(doc.client);
  if (falta) {
    if (!o.silent) shell.notify({ level: 'warn', text: falta });
    return null;
  }

  const keys = clavesDeCliente(doc.client);
  let res;
  try {
    res = await shell.records.findOrCreate(RECORD_TYPE, { keys, label: s(doc.client.name).trim() });
  } catch (e) {
    if (!o.silent) {
      shell.notify({ level: 'error', text: 'No se pudo vincular con el directorio: ' + ((e && e.message) || 'error') });
    }
    return null;
  }
  if (!isObj(res) || !s(res.ref)) return null;

  const registro = isObj(res.record) ? res.record : {};
  commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient(Object.assign({}, d.client, { recordRef: s(res.ref) }));
    return d;
  });

  // Anotar el vínculo inverso: es lo que después responde «dame todo lo de
  // Acme» desde cualquier app. Si falla, el vínculo directo ya está guardado
  // y la cotización es utilizable, así que no se convierte en un error.
  try {
    if (typeof shell.records.link === 'function' && s(shell.app && shell.app.instanceId)) {
      await shell.records.link(s(res.ref), {
        instanceId: s(shell.app.instanceId),
        itemId: s(quoteId),
        kind: doc.kind === KIND_TEMPLATE ? 'plantilla' : 'cotizacion',
        label: s(doc.number) || s(doc.title) || s(doc.client.name),
      });
    }
  } catch (e) { /* el índice inverso es una comodidad, no una condición */ }

  if (!o.silent) {
    // El aviso de la plataforma (claves que apuntaban a registros distintos,
    // o un cliente sin ninguna clave natural) es la única señal temprana de
    // un duplicado: se muestra tal cual, no se traga.
    if (s(res.warning)) shell.notify({ level: 'warn', text: s(res.warning) });
    else if (res.created) shell.notify({ level: 'success', text: 'Cliente registrado en el directorio del sistema.' });
    else {
      shell.notify({
        level: 'success',
        text: 'Vinculado con «' + (s(registro.label) || s(doc.client.name)) + '», que ya existía en el sistema.',
      });
    }
  }
  return { ref: s(res.ref), created: !!res.created, warning: s(res.warning), record: registro };
}

/**
 * Vuelve a leer el registro y refresca la instantánea del cliente.
 *
 * Dos casos que importan:
 *   · El registro cambió de nombre → se actualiza lo que se imprimirá.
 *   · El registro se fusionó con otro (`replaces`) → se reapunta la
 *     referencia, o quedaría colgando de una identidad que ya no es la buena.
 *
 * Si el registro ya no existe NO se borra nada: la cotización conserva su
 * instantánea y solo se avisa.
 */
async function actRefreshClientRecord(quoteId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const ref = s(doc.client.recordRef);
  if (!ref) return null;

  const motivo = registroNoDisponible();
  if (motivo || typeof shell.records.resolve !== 'function') {
    shell.notify({ level: 'warn', text: motivo || 'Este host no permite refrescar el cliente.' });
    return null;
  }

  let lista;
  try {
    lista = arr(await shell.records.resolve([ref]));
  } catch (e) {
    shell.notify({ level: 'error', text: 'No se pudo leer el directorio: ' + ((e && e.message) || 'error') });
    return null;
  }
  const r = lista[0];
  if (!isObj(r) || r.resolved === false) {
    shell.notify({
      level: 'warn',
      text: 'Ese cliente ya no está en el directorio; la cotización conserva los datos con los que se hizo.',
    });
    return null;
  }

  const keys = isObj(r.keys) ? r.keys : {};
  const next = commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient(Object.assign({}, d.client, {
      name: s(r.label) || s(d.client.name),
      // El registro solo guarda claves: lo que no conoce no se pisa.
      taxId: s(keys.taxid) || s(d.client.taxId),
      email: s(keys.email) || s(d.client.email),
      recordRef: s(r.ref) || ref,
    }));
    return d;
  });

  if (s(r.replaces)) {
    shell.notify({ level: 'info', text: 'Ese cliente se había fusionado con otro; la cotización ya apunta al correcto.' });
  } else {
    shell.notify({ level: 'success', text: 'Cliente actualizado desde el directorio.' });
  }
  return next;
}

/**
 * Guarda el cliente escrito a mano en la app Clientes.
 *
 * Es lo que cierra el círculo: cotizar a alguien nuevo deja de ser un callejón
 * sin salida donde el cliente vive solo dentro de una cotización.
 *
 * Requiere `data.write:customers` en el manifest Y que la app Clientes
 * publique su `dataSchema` (APP-SPEC §7.c). Si no cumple una de las dos, la
 * plataforma lo rechaza y aquí solo se explica.
 */
async function actPushClientToDirectory(quoteId, instanceId) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  if (!shell.data || typeof shell.data.create !== 'function') {
    shell.notify({ level: 'warn', text: 'Este host no permite escribir en otras apps.' });
    return null;
  }
  const falta = clienteVinculable(doc.client);
  if (falta) { shell.notify({ level: 'warn', text: falta }); return null; }

  // La instancia destino: la que se indique, o la única que haya. Con varias
  // y ninguna elegida no se adivina: escribir en el directorio equivocado es
  // peor que no escribir.
  let destino = s(instanceId);
  if (!destino) {
    const fuentes = arr(model.ext.customerSources);
    if (fuentes.length === 1) destino = s(fuentes[0].id);
  }
  if (!destino) {
    shell.notify({ level: 'warn', text: 'Elige a qué directorio de clientes quieres añadirlo.' });
    return null;
  }

  const c = doc.client;
  const payload = { name: s(c.name).trim() };
  if (s(c.taxId)) payload.taxId = s(c.taxId).trim();
  if (s(c.email)) payload.email = s(c.email).trim();
  if (s(c.phone)) payload.phone = s(c.phone).trim();

  let item;
  try {
    item = await shell.data.create(destino, payload);
  } catch (e) {
    shell.notify({ level: 'error', text: 'No se pudo añadir al directorio: ' + ((e && e.message) || 'error') });
    return null;
  }
  if (!isObj(item)) return null;

  commitDoc(s(quoteId), (d) => {
    d.client = normalizeClient(Object.assign({}, d.client, {
      sourceApp: 'customers', sourceInstanceId: destino, sourceItemId: s(item.id),
    }));
    return d;
  });
  // El espejo de lectura queda viejo en cuanto se escribe: se refresca para
  // que el selector de clientes lo encuentre sin recargar la app.
  loadCustomers(true);
  shell.notify({ level: 'success', text: 'Cliente añadido al directorio.' });

  // Y se le da identidad, que es de lo que va todo esto.
  await actLinkClientRecord(s(quoteId), { silent: true });
  return item;
}

/** Estado del vínculo, para pintarlo sin repetir la lógica en la vista. */
function estadoVinculo(doc) {
  const c = (doc && doc.client) || {};
  if (s(c.recordRef)) return { estado: 'vinculado', texto: 'Cliente del sistema' };
  if (s(c.sourceApp) === 'customers') return { estado: 'directorio', texto: 'Del directorio, sin identidad' };
  return { estado: 'suelto', texto: 'Solo en esta cotización' };
}

// ── Marca del tenant ────────────────────────────────────────────────────
/**
 * El emisor de las cotizaciones puede venir de la marca del sistema
 * (`shell.brand`, APP-SPEC §7.f) en vez de reescribirse aquí.
 *
 * La marca RELLENA, no impone: se copia a los ajustes del cotizador y desde
 * ahí se puede cambiar. Un tenant con dos unidades de negocio necesita poder
 * cotizar con una razón social distinta de la marca por defecto, y quitarle
 * esa posibilidad para «mantenerlo sincronizado» sería resolver un problema
 * que no tiene a costa de uno que sí.
 */
function marcaNoDisponible() {
  if (!shell.brand || typeof shell.brand.current !== 'function') {
    return 'Este host todavía no expone la marca del sistema; el emisor se escribe aquí.';
  }
  return '';
}

/** Copia la marca activa del tenant a los ajustes del emisor. */
async function actImportBrand() {
  const motivo = marcaNoDisponible();
  if (motivo) { shell.notify({ level: 'warn', text: motivo }); return null; }

  let marca;
  try {
    marca = await shell.brand.current();
  } catch (e) {
    shell.notify({ level: 'error', text: 'No se pudo leer la marca: ' + ((e && e.message) || 'error') });
    return null;
  }
  if (!isObj(marca)) {
    shell.notify({
      level: 'warn',
      text: 'Este KIMOS todavía no tiene una marca configurada. La define un administrador y luego se trae desde aquí.',
    });
    return null;
  }

  const logos = isObj(marca.logos) ? marca.logos : {};
  // Solo se pisa lo que la marca SÍ trae: si no tiene teléfono, no se borra
  // el que ya estaba escrito aquí.
  const patch = {};
  const poner = (campo, valor) => { if (s(valor).trim()) patch[campo] = s(valor).trim(); };
  poner('name', marca.legalName || marca.name);
  poner('taxId', marca.taxId);
  poner('email', marca.email);
  poner('phone', marca.phone);
  poner('web', marca.website);
  poner('address', marca.address);
  poner('logoUrl', logos.light || logos.mark || logos.dark);
  poner('paymentInfo', marca.bankDetails);
  if (!Object.keys(patch).length) {
    shell.notify({ level: 'warn', text: 'La marca del sistema no tiene datos que traer todavía.' });
    return null;
  }

  const out = actPatchIssuer(patch);
  shell.notify({
    level: 'success',
    text: 'Emisor traído de la marca del sistema (' + s(marca.name) + '). Puedes ajustarlo para este cotizador.',
  });
  return out;
}
