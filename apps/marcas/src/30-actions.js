/* ══ ACCIONES ═════════════════════════════════════════════════════════════
 *
 * Todo lo que la app puede hacer, en un solo sitio. La interfaz y el agente
 * llaman a estas funciones y a ninguna otra: es la única forma de garantizar
 * que el agente puede hacer exactamente lo mismo que una persona (APP-SPEC §6).
 */

const avisar = (level, text) => { if (shell.notify) shell.notify({ level, text }); };

// ── Navegación ──────────────────────────────────────────────────────────

function actSetTab(tab) {
  setModel({ tab: tab === 'editor' ? 'editor' : 'sistema' });
  return estado.tab;
}

function actSetSeccion(seccion) {
  const valida = SECCIONES.some((x) => x[0] === seccion) || seccion === 'identidad';
  setModel({ seccion: valida ? seccion : 'logos' });
  return estado.seccion;
}

function actSetLamina(clave) {
  const valida = LAMINAS.some((x) => x[0] === clave);
  setModel({ lamina: valida ? clave : 'identidad' });
  return estado.lamina;
}

function actSeleccionar(id) {
  const b = marcaPorId(id);
  if (!b) return null;
  // Cambiar de marca con cambios sin guardar los perdería en silencio.
  if (estado.dirty && estado.selectedId !== b.id) {
    avisar('warn', 'Tienes cambios sin guardar en «' + s((estado.draft || {}).name) + '». Guárdalos o descártalos antes de cambiar de marca.');
    return null;
  }
  setModel({ selectedId: b.id, draft: null, dirty: false });
  return b;
}

/** Qué secciones se imprimen en la hoja. Es lo «parametrizable» de la hoja. */
function actToggleSeccionHoja(clave) {
  const actual = arr(estado.hojaSecciones);
  const next = actual.indexOf(clave) >= 0
    ? actual.filter((x) => x !== clave)
    : SECCIONES.map((x) => x[0]).filter((x) => actual.indexOf(x) >= 0 || x === clave);
  setModel({ hojaSecciones: next });
  return next;
}

// ── Ciclo de vida de una marca ──────────────────────────────────────────

/** Marca nueva con lo mínimo para que sirva: un principal y un acento.
 *
 * No se crea vacía a propósito: una marca sin ningún color con rol no
 * re-marca nada, y el primer encuentro con la app sería una pantalla en
 * blanco que no explica qué falta. */
function marcaEnBlanco(nombre) {
  return normalizeBrand({
    name: s(nombre).trim() || 'Marca nueva',
    palette: [
      { name: 'Principal', hex: '#1d1d1b', role: 'base' },
      { name: 'Acento', hex: '#00e5d0', role: 'accent' },
    ],
    typography: [{ family: 'Inter', usage: 'headings', weights: ['600', '700'] }],
  });
}

async function actNuevaMarca(nombre) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para crear marcas.'); return null; }
  const cuerpo = paraGuardar(marcaEnBlanco(nombre));
  setModel({ saving: true });
  try {
    const creada = normalizeBrand(await shell.brands.create(cuerpo));
    await cargar();
    setModel({ selectedId: creada.id, tab: 'editor', seccion: 'identidad', saving: false });
    abrirBorrador(creada.id);
    avisar('success', 'Marca «' + creada.name + '» creada.');
    return creada;
  } catch (e) {
    setModel({ saving: false });
    avisar('error', 'No se pudo crear la marca: ' + ((e && e.message) || 'error'));
    return null;
  }
}

async function actGuardar() {
  if (!estado.draft) return null;
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para editar marcas.'); return null; }
  const draft = estado.draft;
  if (!s(draft.name).trim()) { avisar('warn', 'La marca necesita un nombre.'); return null; }

  setModel({ saving: true });
  try {
    const guardada = normalizeBrand(await shell.brands.update(draft.id, paraGuardar(draft)));
    await cargar(true);
    setModel({ selectedId: guardada.id, saving: false });
    const avisos = avisosDe(guardada);
    avisar(avisos.length ? 'warn' : 'success',
      avisos.length
        ? 'Marca guardada, con ' + avisos.length + ' aviso(s) por revisar.'
        : 'Marca guardada. Las apps que la usen la verán actualizada.');
    return guardada;
  } catch (e) {
    setModel({ saving: false });
    avisar('error', 'No se pudo guardar: ' + ((e && e.message) || 'error'));
    return null;
  }
}

function actDescartar() {
  if (!estado.draft) return;
  setModel({ draft: null, dirty: false });
  avisar('info', 'Cambios descartados.');
}

async function actActivar(id) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para cambiar la marca activa.'); return false; }
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return false;
  try {
    await shell.brands.setDefault(b.id);
    await cargar(true);
    avisar('success', '«' + b.name + '» es ahora la marca activa del sistema.');
    return true;
  } catch (e) {
    avisar('error', 'No se pudo activar: ' + ((e && e.message) || 'error'));
    return false;
  }
}

async function actBorrar(id) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para borrar marcas.'); return false; }
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return false;
  try {
    await shell.brands.remove(b.id);
    await cargar();
    avisar('success', 'Marca «' + b.name + '» eliminada.');
    return true;
  } catch (e) {
    avisar('error', 'No se pudo eliminar: ' + ((e && e.message) || 'error'));
    return false;
  }
}

/** Replica una marca. Es como nace una variante: misma base, otro nombre. */
async function actDuplicar(id, nombre) {
  if (!puedeEditar()) { avisar('warn', 'No tienes permiso para crear marcas.'); return null; }
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return null;
  const copia = paraGuardar(Object.assign({}, b, {
    name: s(nombre).trim() || (b.name + ' (copia)'),
  }));
  try {
    const creada = normalizeBrand(await shell.brands.create(copia));
    await cargar();
    setModel({ selectedId: creada.id });
    avisar('success', 'Marca duplicada como «' + creada.name + '».');
    return creada;
  } catch (e) {
    avisar('error', 'No se pudo duplicar: ' + ((e && e.message) || 'error'));
    return null;
  }
}

// ── Identidad ───────────────────────────────────────────────────────────

function actSetCampo(campo, valor) {
  return editarBorrador((d) => Object.assign({}, d, { [campo]: valor }));
}

// ── Paleta ──────────────────────────────────────────────────────────────

function actAddColor(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    palette: d.palette.concat([normalizeColor(Object.assign({
      name: 'Color ' + (d.palette.length + 1), hex: '#cccccc', role: 'none',
    }, patch || {}), d.palette.length)]),
  }));
}

function actSetColor(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    palette: d.palette.map((c, i) => (c.key === s(key) ? normalizeColor(Object.assign({}, c, patch, {
      // La clave NO cambia al renombrar: los ecosistemas apuntan a ella y
      // renombrar un color no debería romper una referencia en silencio.
      key: c.key,
    }), i) : c)),
  }));
}

function actRemoveColor(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    palette: d.palette.filter((c) => c.key !== s(key)),
  }));
}

function actMoveColor(key, delta) {
  return editarBorrador((d) => {
    const i = d.palette.findIndex((c) => c.key === s(key));
    if (i < 0) return d;
    const j = clamp(i + (delta < 0 ? -1 : 1), 0, d.palette.length - 1);
    if (i === j) return d;
    const lista = d.palette.slice();
    const [x] = lista.splice(i, 1);
    lista.splice(j, 0, x);
    return Object.assign({}, d, { palette: lista });
  });
}

// ── Logotipos ───────────────────────────────────────────────────────────

function actAddLogo(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    logos: d.logos.concat([normalizeLogo(Object.assign({
      name: 'Logo ' + (d.logos.length + 1), background: 'transparent',
    }, patch || {}), d.logos.length)]),
  }));
}

function actSetLogo(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    logos: d.logos.map((l, i) => (l.key === s(key) ? normalizeLogo(Object.assign({}, l, patch, { key: l.key }), i) : l)),
  }));
}

function actRemoveLogo(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    logos: d.logos.filter((l) => l.key !== s(key)),
  }));
}

/** Sube el archivo por `shell.files` y lo deja en el logo. */
async function actSubirLogo(key, file) {
  if (!shell.files || typeof shell.files.upload !== 'function') {
    avisar('warn', 'Este host no permite subir archivos; pega la URL del logo.');
    return null;
  }
  if (!file) return null;
  try {
    const url = await shell.files.upload(file, { folder: 'logos', maxMB: 5 });
    actSetLogo(key, { url });
    return url;
  } catch (e) {
    avisar('error', 'No se pudo subir el logo: ' + ((e && e.message) || 'error'));
    return null;
  }
}

// ── Tipografías ─────────────────────────────────────────────────────────

function actAddFont(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    typography: d.typography.concat([normalizeFont(Object.assign({
      family: 'Inter', usage: 'body',
    }, patch || {}), d.typography.length)]),
  }));
}

function actSetFont(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    typography: d.typography.map((t, i) => (t.key === s(key) ? normalizeFont(Object.assign({}, t, patch, { key: t.key }), i) : t)),
  }));
}

function actRemoveFont(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    typography: d.typography.filter((t) => t.key !== s(key)),
  }));
}

// ── Ecosistemas ─────────────────────────────────────────────────────────

function actAddEco(patch) {
  return editarBorrador((d) => {
    const base = colorPorRol(d, 'base');
    const acento = colorPorRol(d, 'accent');
    return Object.assign({}, d, {
      ecosystems: d.ecosystems.concat([normalizeEcosystem(Object.assign({
        name: 'Ecosistema ' + (d.ecosystems.length + 1),
        baseColorKey: base ? base.key : '',
        accentColorKey: acento ? acento.key : '',
      }, patch || {}), d.ecosystems.length)]),
    });
  });
}

function actSetEco(key, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    ecosystems: d.ecosystems.map((e, i) => (e.key === s(key) ? normalizeEcosystem(Object.assign({}, e, patch, { key: e.key }), i) : e)),
  }));
}

function actRemoveEco(key) {
  return editarBorrador((d) => Object.assign({}, d, {
    ecosystems: d.ecosystems.filter((e) => e.key !== s(key)),
  }));
}

// ── Forma ───────────────────────────────────────────────────────────────
// Cambiar la forma cambia las esquinas del shell, del chat de agentes y de
// todas las apps. Por eso vive en el borrador como todo lo demás y no se
// aplica hasta guardar.

function actSetForm(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    form: normalizeForm(Object.assign({}, d.form || formaPorDefecto(), patch || {})),
  }));
}

/** Aplica una plantilla de forma entera. Es un punto de partida, no un
 *  candado: después se ajusta campo a campo. */
function actAplicarPlantillaForma(clave) {
  const tpl = PLANTILLAS_FORMA.find((x) => x[0] === s(clave));
  if (!tpl) { avisar('warn', 'No conozco esa plantilla de forma.'); return null; }
  const out = editarBorrador((d) => Object.assign({}, d, { form: normalizeForm(tpl[3]) }));
  if (out) avisar('info', 'Plantilla «' + tpl[1] + '» aplicada. Ajusta lo que haga falta y guarda.');
  return out;
}

/** Quita la forma: la marca deja de imponer una y manda el tema del tenant. */
function actQuitarForma() {
  return editarBorrador((d) => Object.assign({}, d, { form: null }));
}

// ── Principios ──────────────────────────────────────────────────────────

function actAddPrincipio(patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    principles: d.principles.concat([normalizePrincipio(Object.assign({
      title: 'Principio ' + (d.principles.length + 1),
    }, patch || {}), d.principles.length)]),
  }));
}

function actSetPrincipio(i, patch) {
  return editarBorrador((d) => Object.assign({}, d, {
    principles: d.principles.map((p, j) => (j === Number(i) ? normalizePrincipio(Object.assign({}, p, patch), j) : p)),
  }));
}

function actRemovePrincipio(i) {
  return editarBorrador((d) => Object.assign({}, d, {
    principles: d.principles.filter((p, j) => j !== Number(i)),
  }));
}
