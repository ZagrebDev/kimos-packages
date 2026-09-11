/**
 * Smoke test de Marcas: monta el bundle con un `shell` y un React simulados,
 * renderiza todas las pantallas y ejercita el modelo por las mismas acciones
 * que usan la interfaz y el agente.
 *
 *   node test/test-app.mjs
 *
 * Lo que más importa aquí: que el color se convierta bien a token del tema
 * —si eso falla, falla la marca en TODAS las apps a la vez— y que la app no
 * guarde nada que el backend vaya a rechazar.
 */

// ── React simulado ───────────────────────────────────────────────────────
const R = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
  Fragment: 'fragment',
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (init) => ({ current: init === undefined ? null : init }),
};
globalThis.React = R;

const MANIFEST_VERSION = JSON.parse(
  (await import('node:fs')).readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')).version;

const ventanas = [];
globalThis.window = {
  location: { origin: 'http://kimos.local', href: 'http://kimos.local/' },
  addEventListener: () => {}, removeEventListener: () => {},
  open: () => {
    const doc = fakeDoc();
    const w = { document: doc, focus: () => {}, print: () => { w.impreso = true; }, impreso: false };
    ventanas.push(w);
    return w;
  },
};

function fakeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), children: [], childNodes: [], dataset: {}, style: {},
    attrs: {}, textContent: '', className: '', complete: true,
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); return c; },
    addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; },
  };
}
function fakeDoc() {
  const d = {
    title: '', head: fakeEl('head'), body: fakeEl('body'),
    createElement: (t) => fakeEl(t),
    querySelectorAll: () => [],
  };
  return d;
}
globalThis.document = fakeDoc();

// ── El registro de marcas simulado ───────────────────────────────────────
// Reproduce lo que el backend hace de verdad: normaliza los colores, calcula
// los tokens y RECHAZA lo que no cumple el modelo. Sin esa última parte, las
// pruebas dirían que todo va bien y en producción el backend devolvería 400.
const REG = { marcas: [], seq: 0, falla: '', sinPermisoEscritura: false };

const ROLES_OK = ['base', 'baseAlt', 'accent', 'text', 'textMuted', 'border', 'surface', 'background', 'none'];
const FONDOS_OK = ['dark', 'light', 'color', 'transparent'];
const USOS_OK = ['headings', 'body', 'data', 'accent'];

function validaEnServidor(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') throw new Error('El cuerpo debe ser un objeto JSON.');
  for (const c of cuerpo.palette || []) {
    if (!/^#[0-9a-f]{6}$/.test(String(c.hex || ''))) throw new Error("'" + c.hex + "' no es un color hexadecimal.");
    if (c.role && ROLES_OK.indexOf(c.role) < 0) throw new Error('Rol de color no válido: ' + c.role);
  }
  for (const l of cuerpo.logos || []) {
    if (!l.url) throw new Error('Cada logo necesita una `url`.');
    if (!/^(https?:\/\/|\/)/.test(String(l.url))) throw new Error('El logo debe ser una URL http(s) o una ruta absoluta.');
    if (l.background && FONDOS_OK.indexOf(l.background) < 0) throw new Error('Fondo de logo no válido: ' + l.background);
  }
  for (const t of cuerpo.typography || []) {
    if (!t.family) throw new Error('Cada tipografía necesita una `family`.');
    if (t.usage && USOS_OK.indexOf(t.usage) < 0) throw new Error('Uso tipográfico no válido: ' + t.usage);
  }
  // Campos que el backend NO acepta: si la app los manda, se entera aquí.
  const permitidos = new Set([
    'name', 'tagline', 'description', 'legalName', 'taxId', 'address', 'email', 'phone',
    'website', 'footer', 'bankDetails', 'palette', 'logos', 'typography', 'ecosystems', 'principles',
  ]);
  for (const k of Object.keys(cuerpo)) {
    if (!permitidos.has(k)) throw new Error("El registro no acepta el campo '" + k + "'.");
  }
}

const salida = (d) => JSON.parse(JSON.stringify(d));

const registroSimulado = {
  list: async () => ({
    brands: REG.marcas.map(salida),
    currentId: (REG.marcas.find((b) => b.isDefault) || REG.marcas[0] || {}).id || '',
  }),
  get: async (id) => (REG.marcas.find((b) => b.id === id) ? salida(REG.marcas.find((b) => b.id === id)) : null),
  current: async () => {
    const b = REG.marcas.find((x) => x.isDefault) || REG.marcas[0];
    return b ? salida(b) : null;
  },
  create: async (cuerpo) => {
    if (REG.falla) throw new Error(REG.falla);
    validaEnServidor(cuerpo);
    const b = Object.assign({ id: 'brand' + (++REG.seq), isDefault: !REG.marcas.length }, cuerpo);
    REG.marcas.push(b);
    return salida(b);
  },
  update: async (id, patch) => {
    if (REG.falla) throw new Error(REG.falla);
    validaEnServidor(patch);
    const b = REG.marcas.find((x) => x.id === id);
    if (!b) throw new Error("Marca '" + id + "' no encontrada.");
    Object.assign(b, patch, { updatedAt: '2026-09-11T00:00:00Z' });
    return salida(b);
  },
  setDefault: async (id) => {
    if (!REG.marcas.some((b) => b.id === id)) throw new Error('no existe');
    REG.marcas.forEach((b) => { b.isDefault = b.id === id; });
  },
  remove: async (id) => {
    if (REG.marcas.length === 1) throw new Error('Es la única marca del tenant.');
    REG.marcas = REG.marcas.filter((b) => b.id !== id);
  },
};

const notices = [];
const ARCHIVOS = [];
let agentReg = null;

const shell = {
  app: { appId: 'marcas', teamId: 'team-1' },
  assetUrl: (p) => 'http://kimos.local/api/apps/marcas/asset/' + p,
  notify: (m) => notices.push(m.level + ': ' + m.text),
  window: { setTitle: () => {}, requestClose: () => {}, requestMinimize: () => {} },
  agent: { register: (reg) => { agentReg = reg; return () => { agentReg = null; }; } },
  brands: registroSimulado,
  files: {
    upload: async (file, opts) => {
      const url = 'http://kimos.local/api/public/files/imagenes/marcas/'
        + ((opts && opts.folder) || 'x') + '/abc-' + ((file && file.name) || 'f.png');
      ARCHIVOS.push({ url, folder: opts && opts.folder });
      return url;
    },
  },
};

// ── Utilidades de prueba ─────────────────────────────────────────────────
let fallos = 0;
let pruebas = 0;
function ok(cond, label, extra) {
  pruebas++;
  if (cond) { console.log('  ✔ ' + label); return true; }
  fallos++;
  console.error('  ✖ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  return false;
}
const eq = (a, b, label) => ok(a === b, label, { esperado: b, obtenido: a });
const seccion = (t) => console.log('\n' + t);

function render(node, path) {
  if (node == null || node === false) return 0;
  if (Array.isArray(node)) return node.reduce((n, c, i) => n + render(c, path + '/' + i), 0);
  if (typeof node !== 'object') return 0;
  let n = 1;
  if (typeof node.type === 'function') {
    const out = node.type(Object.assign({}, node.props, { children: node.children }));
    n += render(out, path + '/' + (node.type.name || 'fn'));
  } else {
    n += render(node.children, path + '/' + node.type);
    if (node.props && node.props.children) n += render(node.props.children, path + '/ch');
  }
  return n;
}
const esperar = () => new Promise((r) => setTimeout(r, 20));

// ── Ejecución ────────────────────────────────────────────────────────────
const mod = await import('../dist/index.js');
const mounted = mod.default(shell);
const T = mounted.__test;
ok(typeof mounted.Component === 'function', 'mount() devuelve un Component');
ok(typeof mounted.unmount === 'function', 'mount() devuelve unmount()');

seccion('Color: la conversión de la que depende todo lo demás');
{
  eq(T.hexToHslToken('#ffffff'), '0 0% 100%', 'el blanco');
  eq(T.hexToHslToken('#ff0000'), '0 100% 50%', 'el rojo puro');
  eq(T.hexToHslToken('#0000ff'), '240 100% 50%', 'y el azul puro');
  eq(T.hexToHslToken('#00e5d0'), '174 100% 45%', 'un color de marca real');
  ok(T.hexToHslToken('#00e5d0').indexOf('hsl') < 0,
    'el token es una TRIPLETA, sin hsl(), para poder modular la opacidad');
  eq(T.hexToRgb('#1D1D1B'), '29·29·27', 'el RGB se imprime en la hoja');
  eq(T.normalizeHex('#0E5'), '#00ee55', 'la forma corta se expande');
  eq(T.normalizeHex('azul'), '', 'y lo que no es color no se convierte en uno');

  // El error que el ojo no ve venir: un amarillo de marca es clarísimo.
  eq(T.textoLegible('#ffe600'), '#111111', 'sobre un amarillo de marca el texto va oscuro');
  eq(T.textoLegible('#0b1020'), '#ffffff', 'y sobre un azul muy oscuro, claro');
  ok(T.contraste('#000000', '#ffffff') === 21, 'el contraste máximo es 21:1');
  ok(T.contraste('#777777', '#7a7a7a') < 1.1, 'y dos grises casi iguales, casi 1:1');

  eq(T.slug('Azul Marino'), 'azul-marino', 'la clave de un color sale de su nombre');
  eq(T.slug('Tipografía Ñ'), 'tipografia-n', 'sin acentos, para que sea estable');
}

seccion('El registro es la fuente: la app no guarda nada por su cuenta');
{
  await T.cargar();
  eq(T.getModel().brands.length, 0, 'al principio el tenant no tiene marcas');
  ok(T.puedeEditar(), 'y con `brand.write` se puede crear');

  const creada = await T.actNuevaMarca('PlayerPro');
  ok(!!creada, 'se crea la primera marca');
  eq(REG.marcas.length, 1, 'y queda en el REGISTRO, no en la app');
  ok(creada.isDefault, 'la primera marca del tenant es la activa sin que nadie lo pida');
  ok(T.colorPorRol(creada, 'base') && T.colorPorRol(creada, 'accent'),
    'nace con un principal y un acento: una marca vacía no re-marca nada y no explica qué falta');
}

seccion('Editar es un borrador, no un cambio en producción');
{
  const antes = JSON.stringify(REG.marcas[0]);
  T.actSetCampo('tagline', 'Computadores que rinden');
  ok(T.getModel().dirty, 'tocar un campo marca la marca como sin guardar');
  eq(JSON.stringify(REG.marcas[0]), antes,
    'pero NO llega al registro: editar un color no puede cambiar las propuestas de todos al teclear');

  await T.actGuardar();
  eq(REG.marcas[0].tagline, 'Computadores que rinden', 'al guardar sí');
  ok(!T.getModel().dirty, 'y deja de estar sucia');

  T.actSetCampo('tagline', 'otra cosa');
  T.actDescartar();
  eq(T.getModel().draft, null, 'descartar tira el borrador');
  eq(REG.marcas[0].tagline, 'Computadores que rinden', 'y el registro conserva lo guardado');
}

seccion('Paleta con roles');
{
  const id = T.getModel().brands[0].id;
  T.abrirBorrador(id);
  T.actAddColor({ name: 'Fucsia', hex: '#F800FF', role: 'accent' });
  T.actAddColor({ name: 'Azul Marino', hex: '#00295D', role: 'baseAlt' });
  const d = T.getModel().draft;
  const fucsia = d.palette.find((c) => c.key === 'fucsia');
  ok(!!fucsia, 'el color se añade con su clave, que es por la que lo referencian los ecosistemas');
  eq(fucsia.token, T.hexToHslToken('#F800FF'), 'y con su token ya calculado');
  eq(fucsia.roleLabel, 'Acento', 'y el rol con su etiqueta legible');

  // Renombrar NO cambia la clave: un ecosistema que apunta a ella no debe
  // romperse en silencio por un cambio de nombre.
  T.actSetColor('fucsia', { name: 'Magenta' });
  const tras = T.getModel().draft.palette.find((c) => c.name === 'Magenta');
  eq(tras.key, 'fucsia', 'renombrar un color NO cambia su clave: rompería las referencias en silencio');

  T.actMoveColor('fucsia', -1);
  ok(T.getModel().draft.palette.findIndex((c) => c.key === 'fucsia') < 2, 'los colores se reordenan');

  const n = T.getModel().draft.palette.length;
  T.actRemoveColor('azul-marino');
  eq(T.getModel().draft.palette.length, n - 1, 'y se quitan');

  T.actAddColor({ name: 'Azul Marino', hex: '#00295D', role: 'baseAlt' });
  await T.actGuardar();
  ok(REG.marcas[0].palette.some((c) => c.role === 'baseAlt'), 'la paleta llega al registro con sus roles');
  ok(!('token' in REG.marcas[0].palette[0]),
    'pero NO se manda lo derivado: el token lo calcula el registro, no la app');
}

seccion('Logotipos: cada uno dice sobre qué fondo va');
{
  const id = T.getModel().brands[0].id;
  T.abrirBorrador(id);
  T.actAddLogo({ name: 'Principal', url: 'https://cdn/logo-blanco.png', background: 'dark' });
  T.actAddLogo({ name: 'Secundario', url: 'https://cdn/logo-negro.png', background: 'light' });
  await T.actGuardar();

  const b = T.getModel().brands[0];
  eq(T.logoParaFondo(b, 'dark').name, 'Principal', 'se pide el logo por el fondo sobre el que va');
  eq(T.logoParaFondo(b, 'light').name, 'Secundario', 'y devuelve el que corresponde');

  const soloAdaptable = T.normalizeBrand({ logos: [{ name: 'Único', url: '/x.svg', background: 'transparent' }] });
  eq(T.logoParaFondo(soloAdaptable, 'dark').name, 'Único',
    'si no hay uno para ese fondo se usa el adaptable, antes que dejar un hueco en la propuesta de alguien');
  eq(T.logoParaFondo(T.normalizeBrand({}), 'dark'), null, 'y sin logos devuelve null, no algo inventado');

  const antes = ARCHIVOS.length;
  await T.actSubirLogo(b.logos[0].key, { name: 'nuevo.png' });
  eq(ARCHIVOS.length, antes + 1, 'subir un logo pasa por `shell.files`');
  eq(ARCHIVOS[ARCHIVOS.length - 1].folder, 'logos', 'a la carpeta lógica de logos');
}

seccion('Lo que la app manda es exactamente lo que el registro acepta');
{
  const b = T.getModel().brands[0];
  const cuerpo = T.paraGuardar(b);
  ok(!('id' in cuerpo) && !('isDefault' in cuerpo) && !('updatedAt' in cuerpo),
    'no se mandan los campos que gestiona la plataforma');
  ok(cuerpo.palette.every((c) => !('token' in c) && !('rgb' in c) && !('foreground' in c)),
    'ni lo derivado de los colores');
  let err = '';
  try { validaEnServidor(cuerpo); } catch (e) { err = e.message; }
  eq(err, '', 'y el registro simulado lo acepta tal cual');
}

seccion('Avisos: lo que impide que la marca se aplique');
{
  const vacia = T.normalizeBrand({ name: '' });
  const av = T.avisosDe(vacia);
  ok(av.some((x) => x.indexOf('nombre') >= 0), 'una marca sin nombre se avisa');
  ok(av.some((x) => x.indexOf('paleta') >= 0), 'y sin paleta también');

  const sinBase = T.normalizeBrand({
    name: 'X', palette: [{ name: 'A', hex: '#123456', role: 'none' }], logos: [{ url: '/x.png' }],
  });
  ok(T.avisosDe(sinBase).some((x) => x.indexOf('Principal') >= 0),
    'una paleta sin ningún color «Principal» se avisa: las apps no sabrán cuál usar de base');

  const roto = T.normalizeBrand({
    name: 'X',
    palette: [{ name: 'Negro', hex: '#000000', role: 'base' }],
    logos: [{ url: '/x.png' }],
    ecosystems: [{ name: 'Retail', baseColorKey: 'ya-no-existe' }],
  });
  ok(T.avisosDe(roto).some((x) => x.indexOf('ya-no-existe') >= 0),
    'un ecosistema que apunta a un color que ya no está se avisa, sin invalidar la marca');

  const sinContraste = T.normalizeBrand({
    name: 'X', logos: [{ url: '/x.png' }],
    palette: [
      { name: 'Base', hex: '#3b3b3b', role: 'base' },
      { name: 'Acento', hex: '#454545', role: 'accent' },
    ],
  });
  ok(T.avisosDe(sinContraste).some((x) => x.indexOf('contraste') >= 0),
    'un acento que no se distingue del principal se avisa: un botón así desaparece');

  const buena = T.getModel().brands[0];
  eq(T.avisosDe(buena).length, 0, 'y una marca completa no tiene avisos', T.avisosDe(buena));
}

seccion('La hoja del sistema visual');
{
  const b = T.getModel().brands[0];
  T.abrirBorrador(b.id);
  T.actAddFont({ family: 'Inter', usage: 'headings', weights: ['600', '700'], sample: 'Computadores que rinden.' });
  T.actAddFont({ family: 'JetBrains Mono', usage: 'data', sample: 'SKU · PPRO-N1-2026' });
  T.actAddEco({ name: 'Retail' });
  T.actAddEco({ name: 'B2B', baseColorKey: 'azul-marino' });
  T.actAddPrincipio({ title: 'Limpio y directo', text: 'Fondo blanco, jerarquía clara.' });
  const guardada = await T.actGuardar();

  const ctx = T.hojaContexto(guardada, {});
  eq(ctx.secciones.length, 5, 'la hoja trae las cinco secciones cuando la marca las tiene');
  eq(ctx.secciones[0], 'logos', 'y en el orden en que se leen');
  ok(!!ctx.base && !!ctx.acento, 'con el principal y el acento resueltos');

  const parcial = T.hojaContexto(guardada, { secciones: ['palette', 'principles'] });
  eq(parcial.secciones.join(','), 'palette,principles', 'se puede elegir qué secciones salen');

  // Vacío es vacío: una sección que la marca no tiene NO se pinta con un hueco.
  const flaca = T.hojaContexto(T.normalizeBrand({ name: 'Flaca', palette: [{ name: 'A', hex: '#123456' }] }), {});
  eq(flaca.secciones.join(','), 'palette',
    'una sección que la marca no tiene desaparece, en vez de dejar un recuadro vacío');
  ok(T.hojaContexto(T.normalizeBrand({ name: 'Nada' }), {}).secciones.length === 0,
    'y una marca sin nada no dibuja una hoja de huecos');

  const n = render(R.createElement(T.dialogos.Hoja, { brand: guardada }), 'hoja');
  ok(n > 40, 'la hoja se renderiza entera (' + n + ' nodos)');
  ok(render(R.createElement(T.dialogos.Hoja, { brand: T.normalizeBrand({ name: 'Vacía' }) }), 'v') > 0,
    'y una marca vacía no la rompe');
}

seccion('Render de todas las pantallas');
{
  const m = T.getModel();
  const b = T.getModel().brands[0];
  for (const [nombre, extra] of [
    ['Cartera', { m }], ['Barra', { m, b }], ['HojaOpciones', { m, b }],
    ['EdIdentidad', { b, ro: false }], ['EdPaleta', { b, ro: false }], ['EdLogos', { b, ro: false }],
    ['EdTipografias', { b, ro: false }], ['EdEcosistemas', { b, ro: false }], ['EdPrincipios', { b, ro: false }],
  ]) {
    const C = T.dialogos[nombre];
    ok(typeof C === 'function', 'existe ' + nombre);
    const n = render(R.createElement(C, extra), nombre);
    ok(n > 0, 'y se renderiza sin romperse (' + nombre + ', ' + n + ' nodos)');
  }
  for (const sec of ['identidad', 'logos', 'palette', 'typography', 'ecosystems', 'principles']) {
    T.actSetSeccion(sec);
    ok(render(R.createElement(T.dialogos.Editor, { m: T.getModel(), b }), 'ed-' + sec) > 0,
      'el editor se renderiza en la sección ' + sec);
  }
  ok(render(R.createElement(mounted.Component, {}), 'app') > 0, 'y la app entera');
}

seccion('Imprimir la hoja');
{
  const antes = ventanas.length;
  const okp = await T.actImprimirHoja();
  ok(okp === false || ventanas.length === antes + 1,
    'imprimir abre una ventana o dice que no pudo, sin romperse', { okp });
  ok(T.nombreArchivo(T.getModel().brands[0]).indexOf(' ') < 0, 'el nombre de archivo no lleva espacios');
  ok(T.printCss({}).indexOf('A4 landscape') >= 0, 'la hoja se imprime apaisada');
  ok(T.printCss({}).indexOf('#fff') >= 0, 'y sobre papel blanco aunque KIMOS esté en modo noche');
}

seccion('Varias marcas');
{
  const copia = await T.actDuplicar(T.getModel().brands[0].id, 'PlayerPro Labs');
  ok(!!copia, 'una marca se duplica: es como nace una variante');
  eq(REG.marcas.length, 2, 'y el registro tiene dos');
  ok(!copia.isDefault, 'la copia no roba la marca activa');
  eq(copia.palette.length, T.getModel().brands[0].palette.length, 'con la misma paleta');

  await T.actActivar(copia.id);
  ok(REG.marcas.find((b) => b.id === copia.id).isDefault, 'se puede cambiar la marca activa');
  ok(!REG.marcas.find((b) => b.id !== copia.id).isDefault, 'y solo hay una a la vez');

  // Cambiar de marca con cambios sin guardar los perdería en silencio.
  T.actSeleccionar(REG.marcas[0].id);
  T.actSetCampo('tagline', 'a medio escribir');
  const antes = notices.length;
  const bloqueado = T.actSeleccionar(copia.id);
  eq(bloqueado, null, 'con cambios sin guardar no se cambia de marca');
  ok(notices.slice(antes).some((n) => n.indexOf('sin guardar') >= 0), 'y se dice por qué');
  T.actDescartar();
  ok(!!T.actSeleccionar(copia.id), 'tras descartar, sí');

  await T.actBorrar(copia.id);
  eq(REG.marcas.length, 1, 'una marca se borra');
  let err = '';
  try { await registroSimulado.remove(REG.marcas[0].id); } catch (e) { err = e.message; }
  ok(err.indexOf('única') >= 0, 'pero el registro no deja borrar la última');
}

seccion('Errores del registro');
{
  await T.cargar();
  REG.falla = 'Solo un administrador puede cambiar la marca.';
  const antes = notices.length;
  T.abrirBorrador(T.getModel().brands[0].id);
  T.actSetCampo('tagline', 'x');
  const r = await T.actGuardar();
  REG.falla = '';
  eq(r, null, 'si el registro rechaza, no se finge que se guardó');
  ok(notices.slice(antes).some((n) => n.indexOf('administrador') >= 0),
    'y el motivo llega a quien está editando');
  ok(T.getModel().dirty, 'el borrador se conserva: perder el trabajo por un 403 sería peor');
}

seccion('Agente IA');
{
  await T.cargar();
  const off = T.registrarAgente();
  ok(!!agentReg, 'la app se registra en el puente de agentes');
  ok(agentReg.tools.length >= 12, 'con sus herramientas (' + agentReg.tools.length + ')');
  ok(agentReg.tools.every((x) => x.name && x.description && x.inputSchema),
    'y cada una con nombre, descripción y esquema');
  ok(agentReg.description.indexOf('TODAS las apps') >= 0,
    'la descripción avisa de que cambiar una marca cambia las salidas de todas las apps');

  const snap = agentReg.getSnapshot();
  eq(snap.version, MANIFEST_VERSION, 'el retrato dice qué build está corriendo');
  ok(Array.isArray(snap.marcas) && snap.marcas.length > 0, 'lista las marcas');
  ok(Array.isArray(snap.rolesDeColor) && snap.rolesDeColor.length > 5,
    'y los roles disponibles, para que el agente no invente uno');

  const call = (type, payload) => agentReg.dispatchAction({ app: 'marcas', type, payload: payload || {} });

  let r = await call('LISTAR_MARCAS');
  ok(r.success && r.marcas.length >= 1, 'el agente lista las marcas', r.error);

  r = await call('CREAR_MARCA', { nombre: 'Marca del agente' });
  ok(r.success, 'crea una marca', r.error);
  const id = r.id;

  r = await call('AGREGAR_COLOR', { nombre: 'Verde', hex: 'no-es-color', rol: 'accent' });
  ok(!r.success && r.error.indexOf('hexadecimal') >= 0, 'un color inválido se rechaza antes de tocar nada', r.error);

  r = await call('AGREGAR_COLOR', { nombre: 'Verde', hex: '#00aa66' });
  ok(r.success && r.message.indexOf('sin rol') >= 0,
    'un color sin rol se acepta pero se avisa: ninguna app sabría dónde usarlo', r.message);

  r = await call('ACTUALIZAR_COLOR', { color: 'Verde', rol: 'accent' });
  ok(r.success, 'un color se referencia por su nombre', r.error);

  r = await call('AGREGAR_LOGO', { url: 'javascript:alert(1)' });
  ok(!r.success, 'una URL que no es http(s) ni ruta se rechaza');

  r = await call('GUARDAR_MARCA');
  ok(r.success, 'y el agente guarda cuando se le pide', r.error);
  r = await call('GUARDAR_MARCA');
  ok(!r.success && r.error.indexOf('cambios') >= 0, 'guardar dos veces no finge un guardado');

  r = await call('REVISAR_MARCA', { marca: id });
  ok(r.success && Array.isArray(r.avisos), 'revisa una marca y dice qué le falta', r.error);

  r = await call('VER_MARCA', { marca: 'no existe' });
  ok(!r.success && r.error.indexOf('No encontré') >= 0, 'una marca que no existe se dice', r.error);

  await call('CREAR_MARCA', { nombre: 'Marca del agente' });
  r = await call('VER_MARCA', { marca: 'Marca del agente' });
  ok(!r.success && r.error.indexOf('Precisa') >= 0,
    'con dos marcas del mismo nombre pide precisar en vez de elegir una: aplicar la marca equivocada sale caro', r.error);

  r = await call('INVENTADA', {});
  ok(!r.success && r.error.indexOf('Disponibles') >= 0, 'una acción inventada lista las que sí existen');

  if (off) off();
  ok(agentReg === null, 'y al desregistrar se suelta el puente');
}

seccion('Sin permiso de escritura la app se ve pero no se edita');
{
  const soloLectura = Object.assign({}, shell, {
    brands: { list: registroSimulado.list, get: registroSimulado.get, current: registroSimulado.current },
  });
  const app2 = soloLectura.brands.update === undefined ? mod.default(soloLectura) : null;
  const V = app2.__test;
  await V.cargar();
  ok(!V.puedeEditar(), 'sin `brand.write` la app sabe que es de solo lectura');
  const antes = notices.length;
  const r = await V.actNuevaMarca('No debería');
  eq(r, null, 'y no deja crear');
  ok(notices.slice(antes).some((n) => n.indexOf('permiso') >= 0), 'diciendo por qué');
  ok(V.getModel().brands.length > 0, 'pero las marcas se leen igual');
  app2.unmount();
}

seccion('En un host sin registro de marcas');
{
  const viejo = Object.assign({}, shell);
  delete viejo.brands;
  const app3 = mod.default(viejo);
  const V = app3.__test;
  await V.cargar();
  ok(V.registroNoDisponible() !== '', 'la app detecta que este host no tiene registro');
  ok(V.getModel().error.indexOf('Actualiza') >= 0,
    'y lo explica en pantalla en vez de quedarse cargando para siempre', V.getModel().error);
  ok(render(R.createElement(app3.Component, {}), 'sin-registro') > 0, 'la pantalla se pinta igual');
  app3.unmount();
}

console.log();
if (fallos) {
  console.error('✖ ' + fallos + ' de ' + pruebas + ' pruebas fallaron');
  process.exit(1);
}
console.log('✔ ' + pruebas + ' pruebas en verde');
