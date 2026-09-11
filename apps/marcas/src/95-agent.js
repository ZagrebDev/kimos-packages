/* ══ AGENTE IA ════════════════════════════════════════════════════════════
 *
 * El agente hace lo mismo que una persona porque llama a las mismas acciones
 * (APP-SPEC §6). No hay un camino paralelo: si una capacidad no está en
 * `30-actions.js`, el agente tampoco la tiene.
 *
 * Cuidado deliberado: cambiar una marca cambia cómo se ven las salidas de
 * TODAS las apps, así que las herramientas que escriben lo dicen en su
 * descripción y ninguna guarda sin que se le pida.
 */

const T_STR = { type: 'string' };
const T_NUM = { type: 'number' };

const tool = (name, description, properties, required) => ({
  name, description,
  inputSchema: { type: 'object', properties: properties || {}, required: required || [] },
});

const AGENT_TOOLS = [
  tool('LISTAR_MARCAS', 'Lista las marcas del tenant con su resumen: cuántos colores, logotipos y avisos tiene cada una, y cuál es la activa.',
    {}),
  tool('VER_MARCA', 'Devuelve una marca completa: identidad, paleta con roles, logotipos con su fondo, tipografías, ecosistemas y principios.',
    { marca: T_STR }, ['marca']),
  tool('ABRIR_MARCA', 'Abre una marca a la vista de la persona, en la hoja o en el editor.',
    { marca: T_STR, vista: { type: 'string', enum: ['sistema', 'editor'] } }, ['marca']),
  tool('CREAR_MARCA', 'Crea una marca nueva con un principal y un acento por defecto, lista para editar.',
    { nombre: T_STR }),
  tool('DUPLICAR_MARCA', 'Replica una marca existente con otro nombre. Es como nace una variante.',
    { marca: T_STR, nombre: T_STR }, ['marca']),
  tool('ACTUALIZAR_IDENTIDAD', 'Cambia los datos de identidad de la marca abierta: nombre, bajada, razón social, RUT, contacto, pie o datos de pago. NO guarda: usa GUARDAR_MARCA.',
    {
      nombre: T_STR, bajada: T_STR, descripcion: T_STR, razonSocial: T_STR, rut: T_STR,
      correo: T_STR, telefono: T_STR, web: T_STR, direccion: T_STR, pie: T_STR, datosDePago: T_STR,
    }),
  tool('AGREGAR_COLOR', 'Añade un color a la paleta de la marca abierta. El `rol` es lo que permite que otras apps sepan dónde usarlo.',
    {
      nombre: T_STR, hex: T_STR,
      rol: { type: 'string', enum: COLOR_ROLES.map((x) => x[0]) },
    }, ['hex']),
  tool('ACTUALIZAR_COLOR', 'Cambia un color de la paleta por su nombre o su clave.',
    { color: T_STR, nombre: T_STR, hex: T_STR, rol: { type: 'string', enum: COLOR_ROLES.map((x) => x[0]) } }, ['color']),
  tool('QUITAR_COLOR', 'Quita un color de la paleta.', { color: T_STR }, ['color']),
  tool('AGREGAR_LOGO', 'Añade un logotipo. `fondo` dice sobre qué va: sin eso, una app puede ponerlo blanco sobre blanco.',
    {
      nombre: T_STR, url: T_STR,
      fondo: { type: 'string', enum: LOGO_BACKGROUNDS.map((x) => x[0]) },
    }, ['url']),
  tool('AGREGAR_TIPOGRAFIA', 'Añade una familia tipográfica con su uso.',
    {
      familia: T_STR, uso: { type: 'string', enum: TYPE_USAGES.map((x) => x[0]) },
      pesos: { type: 'array', items: T_STR }, muestra: T_STR,
    }, ['familia']),
  tool('AGREGAR_PRINCIPIO', 'Añade una regla de la marca: lo que alguien de fuera necesita para no romperla.',
    { titulo: T_STR, texto: T_STR }, ['titulo']),
  tool('GUARDAR_MARCA', 'Guarda los cambios de la marca abierta en el registro. A partir de aquí las demás apps la ven así.',
    {}),
  tool('ACTIVAR_MARCA', 'Deja una marca como la activa del sistema: es la que usan por defecto las apps que no eligen una.',
    { marca: T_STR }, ['marca']),
  tool('REVISAR_MARCA', 'Dice qué le falta a una marca para poder aplicarse y qué tiene mal (colores sin rol, referencias rotas, acento sin contraste).',
    { marca: T_STR }),
  tool('IMPRIMIR_HOJA', 'Abre la hoja del sistema visual de la marca en una ventana lista para imprimir o guardar como PDF.',
    { marca: T_STR }),
];

const okMsg = (message, extra) => Object.assign({ success: true, message }, isObj(extra) ? extra : {});
const errMsg = (error) => ({ success: false, error });

/** Resuelve una marca por id o por nombre. Con varias coincidencias no elige:
 *  aplicar la marca equivocada sale caro y en silencio. */
function resolverMarca(ref) {
  const raw = s(ref).trim();
  if (!raw) {
    const sel = seleccionada();
    return sel ? { marca: sel } : { error: 'No hay ninguna marca abierta y no me dijiste cuál.' };
  }
  const porId = marcaPorId(raw);
  if (porId) return { marca: porId };
  const n = slug(raw);
  const coinciden = estado.brands.filter((b) => slug(b.name) === n);
  if (coinciden.length === 1) return { marca: coinciden[0] };
  if (coinciden.length > 1) return { error: 'Hay varias marcas llamadas «' + raw + '». Precisa cuál por su id.' };
  const parciales = estado.brands.filter((b) => slug(b.name).indexOf(n) >= 0);
  if (parciales.length === 1) return { marca: parciales[0] };
  if (parciales.length > 1) {
    return { error: 'Varias marcas coinciden con «' + raw + '»: ' + parciales.map((b) => b.name).join(', ') + '. Precisa cuál.' };
  }
  return { error: 'No encontré ninguna marca que se llame «' + raw + '».' };
}

/** Un color por su clave o su nombre, dentro del borrador abierto. */
function resolverColor(b, ref) {
  const n = slug(ref);
  return arr(b.palette).find((c) => c.key === s(ref)) || arr(b.palette).find((c) => slug(c.name) === n) || null;
}

function agentSnapshot() {
  const b = seleccionada();
  return {
    version: APP_VERSION,
    marcas: estado.brands.map(resumenDe),
    activa: s(estado.currentId),
    abierta: b ? Object.assign(resumenDe(b), { sinGuardar: !!estado.dirty }) : null,
    puedeEditar: puedeEditar(),
    rolesDeColor: COLOR_ROLES.map((x) => ({ id: x[0], nombre: x[1], para: x[2] })),
    fondosDeLogo: LOGO_BACKGROUNDS.map((x) => ({ id: x[0], nombre: x[1] })),
  };
}

/** Exige que haya una marca abierta para las acciones que editan. */
function exigeBorrador() {
  const b = seleccionada();
  if (!b) return { error: 'No hay ninguna marca abierta. Usa ABRIR_MARCA primero.' };
  if (!puedeEditar()) return { error: 'No tienes permiso para editar marcas.' };
  return { b };
}

async function agentDispatch(action) {
  const a = isObj(action) ? action : {};
  const tipo = s(a.type);
  const pl = isObj(a.payload) ? a.payload : {};

  switch (tipo) {
    case 'LISTAR_MARCAS':
      return okMsg(estado.brands.length + ' marca(s) en el sistema.', { marcas: estado.brands.map(resumenDe) });

    case 'VER_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      return okMsg('Marca «' + r.marca.name + '».', { marca: r.marca, avisos: avisosDe(r.marca) });
    }

    case 'ABRIR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const abierta = actSeleccionar(r.marca.id);
      if (!abierta) return errMsg('Hay cambios sin guardar en la marca abierta.');
      actSetTab(s(pl.vista) === 'editor' ? 'editor' : 'sistema');
      if (s(pl.vista) === 'editor') abrirBorrador(r.marca.id);
      return okMsg('Marca «' + r.marca.name + '» abierta.');
    }

    case 'CREAR_MARCA': {
      const creada = await actNuevaMarca(pl.nombre);
      return creada ? okMsg('Marca «' + creada.name + '» creada y abierta para editar.', { id: creada.id })
        : errMsg('No se pudo crear la marca.');
    }

    case 'DUPLICAR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const copia = await actDuplicar(r.marca.id, pl.nombre);
      return copia ? okMsg('Duplicada como «' + copia.name + '».', { id: copia.id })
        : errMsg('No se pudo duplicar.');
    }

    case 'ACTUALIZAR_IDENTIDAD': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const campos = {
        nombre: 'name', bajada: 'tagline', descripcion: 'description', razonSocial: 'legalName',
        rut: 'taxId', correo: 'email', telefono: 'phone', web: 'website', direccion: 'address',
        pie: 'footer', datosDePago: 'bankDetails',
      };
      const puestos = [];
      for (const [entrada, campo] of Object.entries(campos)) {
        if (pl[entrada] !== undefined) { actSetCampo(campo, s(pl[entrada])); puestos.push(campo); }
      }
      if (!puestos.length) return errMsg('No mandaste ningún dato de identidad.');
      return okMsg('Identidad actualizada (' + puestos.join(', ') + '). Sin guardar todavía: usa GUARDAR_MARCA.');
    }

    case 'AGREGAR_COLOR': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      if (!esHexValido(pl.hex)) return errMsg('«' + s(pl.hex) + '» no es un color hexadecimal (#RGB o #RRGGBB).');
      actAddColor({ name: s(pl.nombre), hex: s(pl.hex), role: s(pl.rol) || 'none' });
      const aviso = !s(pl.rol) || pl.rol === 'none'
        ? ' Ojo: sin rol, ninguna app sabrá dónde usarlo.' : '';
      return okMsg('Color añadido.' + aviso + ' Sin guardar todavía.');
    }

    case 'ACTUALIZAR_COLOR': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const c = resolverColor(g.b, pl.color);
      if (!c) return errMsg('No encontré el color «' + s(pl.color) + '» en la paleta.');
      if (pl.hex !== undefined && !esHexValido(pl.hex)) return errMsg('«' + s(pl.hex) + '» no es un color hexadecimal.');
      const patch = {};
      if (pl.nombre !== undefined) patch.name = s(pl.nombre);
      if (pl.hex !== undefined) patch.hex = s(pl.hex);
      if (pl.rol !== undefined) patch.role = s(pl.rol);
      if (!Object.keys(patch).length) return errMsg('No mandaste nada que cambiar del color.');
      actSetColor(c.key, patch);
      return okMsg('Color «' + c.name + '» actualizado. Sin guardar todavía.');
    }

    case 'QUITAR_COLOR': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const c = resolverColor(g.b, pl.color);
      if (!c) return errMsg('No encontré el color «' + s(pl.color) + '».');
      actRemoveColor(c.key);
      return okMsg('Color «' + c.name + '» quitado. Sin guardar todavía.');
    }

    case 'AGREGAR_LOGO': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      const url = s(pl.url).trim();
      if (!/^(https?:\/\/|\/)/.test(url)) return errMsg('La URL del logo debe empezar por http(s):// o por /.');
      actAddLogo({ name: s(pl.nombre), url, background: s(pl.fondo) || 'transparent' });
      return okMsg('Logotipo añadido. Sin guardar todavía.');
    }

    case 'AGREGAR_TIPOGRAFIA': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      actAddFont({
        family: s(pl.familia), usage: s(pl.uso) || 'body',
        weights: arr(pl.pesos), sample: s(pl.muestra),
      });
      return okMsg('Tipografía añadida. Sin guardar todavía.');
    }

    case 'AGREGAR_PRINCIPIO': {
      const g = exigeBorrador();
      if (!g.b) return errMsg(g.error);
      actAddPrincipio({ title: s(pl.titulo), text: s(pl.texto) });
      return okMsg('Principio añadido. Sin guardar todavía.');
    }

    case 'GUARDAR_MARCA': {
      if (!estado.dirty) return errMsg('No hay cambios que guardar.');
      const guardada = await actGuardar();
      if (!guardada) return errMsg('No se pudo guardar la marca.');
      const avisos = avisosDe(guardada);
      return okMsg('Marca «' + guardada.name + '» guardada. Las demás apps ya la ven así.', { avisos });
    }

    case 'ACTIVAR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const ok = await actActivar(r.marca.id);
      return ok ? okMsg('«' + r.marca.name + '» es ahora la marca activa del sistema.')
        : errMsg('No se pudo activar la marca.');
    }

    case 'REVISAR_MARCA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const avisos = avisosDe(r.marca);
      return okMsg(avisos.length
        ? 'La marca «' + r.marca.name + '» tiene ' + avisos.length + ' cosa(s) que revisar.'
        : 'La marca «' + r.marca.name + '» está completa y se puede aplicar.', { avisos });
    }

    case 'IMPRIMIR_HOJA': {
      const r = resolverMarca(pl.marca);
      if (!r.marca) return errMsg(r.error);
      const ok = await actImprimirHoja(r.marca.id);
      return ok ? okMsg('Hoja de «' + r.marca.name + '» abierta para imprimir.')
        : errMsg('No se pudo abrir la hoja.');
    }

    default:
      return errMsg('No conozco la acción «' + tipo + '». Disponibles: ' + AGENT_TOOLS.map((t) => t.name).join(', ') + '.');
  }
}

let desregistrarAgente = null;

function registrarAgente() {
  if (!shell.agent || typeof shell.agent.register !== 'function') return null;
  desregistrarAgente = shell.agent.register({
    appId: 'marcas',
    name: 'Marcas',
    description: 'El sistema visual de la empresa: logotipos, paleta con roles, tipografías, '
      + 'ecosistemas y principios de cada marca. Cambiar una marca cambia cómo se ven las '
      + 'propuestas, fichas y correos de TODAS las apps, así que nada se guarda hasta '
      + 'GUARDAR_MARCA. Un color sin rol no lo usará ninguna app: pregunta el rol si no te lo dan.',
    tools: AGENT_TOOLS,
    getSnapshot: agentSnapshot,
    dispatchAction: agentDispatch,
  });
  return desregistrarAgente;
}
