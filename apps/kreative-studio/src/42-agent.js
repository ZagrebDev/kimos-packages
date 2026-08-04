
  // ═════════════════════════════════════════════════════════════════════════
  // ORQUESTACIÓN POR KIMOS · shell.agent.register
  // El agente de la empresa es el director de orquesta: puede crear la
  // campaña entera desde una frase, ejecutar agentes sueltos, cambiar de
  // proveedor, editar escenas, registrar los assets que él mismo genera con
  // sus MCP (Higgsfield, etc.) y liquidar el coste real.
  // ═════════════════════════════════════════════════════════════════════════
  let unregisterAgent = null;

  const AGENT_TOOLS = [
    { name: 'GENERATE_CAMPAIGN',
      description: 'Genera una campaña COMPLETA desde una intención en lenguaje natural ("crea una campaña premium", "quiero un comercial épico", "véndelo para deportistas"). Interpreta estilo, objetivo y público, y ejecuta los 12 agentes. Es la acción principal de la app.',
      inputSchema: { type: 'object', properties: {
        intent: { type: 'string', description: 'Intención en lenguaje natural.' },
        productName: { type: 'string', description: 'Nombre del producto (opcional si ya está en el brief).' },
        usp: { type: 'string', description: 'Ventaja principal / propuesta de valor.' },
        photos: { type: 'array', items: { type: 'string' }, description: 'URLs o paths del storage del equipo con fotos del producto.' },
      }, required: ['intent'] } },
    { name: 'SET_BRIEF',
      description: 'Actualiza los datos del brief (producto, categoría, precio, USP, público, presupuesto, mercado, idioma, notas).',
      inputSchema: { type: 'object', properties: {
        productName: { type: 'string' }, category: { type: 'string' }, priceText: { type: 'string' },
        currency: { type: 'string' }, usp: { type: 'string' }, audienceHint: { type: 'string' },
        budget: { type: 'number' }, marketRegion: { type: 'string' }, language: { type: 'string' },
        competitorsText: { type: 'string' }, mandatories: { type: 'string' }, legal: { type: 'string' },
        extraNotes: { type: 'string' }, title: { type: 'string' },
      } } },
    { name: 'ADD_PRODUCT_PHOTO',
      description: 'Añade una foto del producto al brief. Acepta un adjunto del chat (path del File Storage del equipo), una ruta /api/… de KIMOS o una URL http(s) pública. Es lo que ancla la forma real del producto en todos los prompts.',
      inputSchema: { type: 'object', properties: {
        url: { type: 'string', description: 'path del storage, ruta /api/… o URL http(s).' },
        caption: { type: 'string' }, isHero: { type: 'boolean', description: 'Marcarla como toma principal.' },
      }, required: ['url'] } },
    { name: 'LIST_CATALOG',
      description: 'Lista los catálogos de ProductLab visibles y sus productos, para importar uno al brief sin volver a teclear nombre, precio, especificaciones y fotos.',
      inputSchema: { type: 'object', properties: {
        instanceId: { type: 'string', description: 'Catálogo concreto; vacío = lista todos.' },
        query: { type: 'string', description: 'Filtra por nombre o SKU.' },
      } } },
    { name: 'IMPORT_PRODUCT',
      description: 'Importa un producto de ProductLab al brief: nombre, precio, moneda, especificaciones (pasan a ser la propuesta de valor), pasos configurables y todas las fotos de la galería. Opcionalmente genera la campaña acto seguido.',
      inputSchema: { type: 'object', properties: {
        product: { type: 'string', description: 'Nombre, SKU o id del producto.' },
        instanceId: { type: 'string', description: 'Catálogo; vacío = se busca en todos.' },
        keepExisting: { type: 'boolean', description: 'No pisar los campos del brief que ya tengan contenido.' },
        intent: { type: 'string', description: 'Si se indica, genera la campaña completa con esta intención tras importar.' },
      }, required: ['product'] } },
    { name: 'RUN_PRODUCTION',
      description: 'PUNTO DE ENTRADA DE LA PRODUCCIÓN. Devuelve el siguiente lote de material que toca generar AHORA (respetando dependencias: primero los keyframes, luego las tomas que parten de ellos), cada uno con su proveedor, prompt, parámetros, imágenes de referencia y el archivo de destino. Genera cada elemento del lote con el modelo indicado y devuelve los resultados en UNA llamada a REGISTER_ASSETS. Repite hasta que `listo` sea true; entonces exporta render_bundle y ya tienes el vídeo.',
      inputSchema: { type: 'object', properties: {
        limit: { type: 'number', description: 'Máximo de elementos del lote (por defecto 12).' },
        kind: { type: 'string', description: 'Restringe a image, video, voice, music o sfx.' },
      } } },
    { name: 'REGISTER_ASSETS',
      description: 'Registra VARIOS resultados generados de una vez. Cada entrada cierra su trabajo, versiona el archivo por escena y contabiliza el coste real. Es la forma normal de devolver un lote de RUN_PRODUCTION.',
      inputSchema: { type: 'object', properties: {
        assets: { type: 'array', description: 'Lista de resultados.', items: { type: 'object', properties: {
          jobId: { type: 'string', description: 'Id del trabajo que cierra (lo da RUN_PRODUCTION).' },
          url: { type: 'string' }, kind: { type: 'string' }, sceneId: { type: 'string' },
          providerId: { type: 'string' }, costUsd: { type: 'number' }, durationSec: { type: 'number' },
          tokens: { type: 'number' }, note: { type: 'string' },
        }, required: ['url'] } },
      }, required: ['assets'] } },
    { name: 'SET_WORKFLOW',
      description: 'Edita el flujo de agentes: reordena y activa o desactiva agentes. Un agente no puede ir antes de aquel del que depende; si el orden lo rompe, se corrige a la posición válida más cercana. Un agente desactivado se salta, y los que dependían de él quedan bloqueados con el motivo.',
      inputSchema: { type: 'object', properties: {
        order: { type: 'array', items: { type: 'string' }, description: 'Orden deseado (parcial vale). IDs: ' + PIPELINE_ORDER.join(', ') },
        disable: { type: 'array', items: { type: 'string' }, description: 'Agentes a desactivar.' },
        enable: { type: 'array', items: { type: 'string' }, description: 'Agentes a reactivar.' },
        reset: { type: 'boolean', description: 'Volver al orden de fábrica con todos activos.' },
      } } },
    { name: 'SET_THEME',
      description: 'Cambia el aspecto de la interfaz. Forma «classic» con modos day, sunset, night o live (sigue la hora); forma «game» con modos kimoslab, jabotel o spacecraft. Es solo presentación: no toca los datos ni el resultado de los agentes.',
      inputSchema: { type: 'object', properties: {
        form: { type: 'string', description: 'classic | game' },
        classicMode: { type: 'string', description: 'day | sunset | night | live' },
        gameMode: { type: 'string', description: 'kimoslab | jabotel | spacecraft' },
      } } },
    { name: 'SET_ORG',
      description: 'Edita el mapa de la organización que se recorre en la vista Organización: áreas (departamentos), '
        + 'puestos (procesos internos de cada departamento), personal (personas y agentes de IA) y el RESPONSABLE '
        + 'de cada departamento, que tiene que ser un usuario de KIMOS. Todo departamento con agentes de IA debe '
        + 'tener responsable: `organizacion.sinResponsable` del snapshot dice cuáles no lo tienen. '
        + 'Es el mismo mapa en las cuatro ambientaciones: cambiar el aspecto no lo modifica. '
        + 'Los agentes del flujo ya están dentro como personal de IA; para apagarlos usa SET_WORKFLOW, no borres su avatar.',
      inputSchema: { type: 'object', properties: {
        op: { type: 'string', description: 'add_area | update_area | remove_area | add_station | update_station '
          + '| remove_station | add_staff | update_staff | remove_staff | set_owner | clear_owner | resize | reseed' },
        user: { type: 'string', description: 'Para set_owner: id, nombre o correo de un USUARIO DE KIMOS. '
          + 'Los usuarios disponibles vienen en el snapshot (organizacion.usuariosKimos). No vale un nombre inventado.' },
        areaId: { type: 'string', description: 'Id o nombre del área.' },
        stationId: { type: 'string', description: 'Id o nombre del puesto.' },
        staffId: { type: 'string', description: 'Id o nombre de la persona/agente.' },
        name: { type: 'string' },
        departmentId: { type: 'string', description: 'Uno de: ' + WS_DEPARTMENTS.map((d) => d.id).join(', ') },
        structure: { type: 'string', description: 'Uno de: ' + WS_STRUCTURES.map((x) => x.id).join(', ') },
        process: { type: 'string', description: 'Qué se hace en ese puesto.' },
        role: { type: 'string', description: 'Rol de la persona.' },
        kind: { type: 'string', description: 'human | ai' },
        note: { type: 'string' },
        x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
        gridW: { type: 'number' }, gridH: { type: 'number' },
      }, required: ['op'] } },
    { name: 'RUN_AGENT',
      description: 'Ejecuta un agente concreto y sus dependencias. IDs: ' + AGENTS.map((a) => a.id).join(', ') + '.',
      inputSchema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] } },
    { name: 'RUN_PIPELINE',
      description: 'Ejecuta el pipeline completo con la configuración actual, sin reinterpretar la intención. Útil tras cambiar estilo, proveedores o duración.',
      inputSchema: { type: 'object', properties: { only: { type: 'array', items: { type: 'string' }, description: 'IDs de agente a ejecutar; vacío = todos.' } } } },
    { name: 'SET_DIRECTION',
      description: 'Cambia estilo, objetivo, público o categoría y regenera lo que dependa de ello.',
      inputSchema: { type: 'object', properties: {
        styleId: { type: 'string', description: 'Uno de: ' + STYLES.map((x) => x.id).join(', ') },
        objectiveId: { type: 'string', description: 'Uno de: ' + OBJECTIVES.map((x) => x.id).join(', ') },
        audienceId: { type: 'string', description: 'Uno de: ' + AUDIENCES.map((x) => x.id).join(', ') },
        categoryId: { type: 'string', description: 'Uno de: ' + CATEGORIES.map((x) => x.id).join(', ') },
        regenerate: { type: 'boolean', description: 'Volver a ejecutar el pipeline (por defecto true).' },
      } } },
    { name: 'SET_PROVIDER',
      description: 'Cambia el proveedor de IA de una capacidad (image, video, voice, music, sfx, text) y reescribe los prompts a su dialecto. Demuestra la modularidad: no toca nada más.',
      inputSchema: { type: 'object', properties: {
        capability: { type: 'string', description: 'image | video | voice | music | sfx | text' },
        providerId: { type: 'string', description: 'ID del proveedor registrado.' },
        params: { type: 'object', description: 'Parámetros específicos del proveedor.' },
      }, required: ['capability', 'providerId'] } },
    { name: 'SET_SETTINGS',
      description: 'Ajusta duraciones, número de variantes, fps, subtítulos y formatos/plataformas de exportación.',
      inputSchema: { type: 'object', properties: {
        heroDurationSec: { type: 'number' }, shortDurationSec: { type: 'number' }, variantCount: { type: 'number' },
        fps: { type: 'number' }, subtitles: { type: 'boolean' },
        aspects: { type: 'array', items: { type: 'string' }, description: 'De: ' + ASPECTS.map((x) => x.id).join(', ') },
        resolutions: { type: 'array', items: { type: 'string' }, description: 'De: ' + RESOLUTIONS.map((x) => x.id).join(', ') },
        platforms: { type: 'array', items: { type: 'string' }, description: 'De: ' + PLATFORMS.map((x) => x.id).join(', ') },
      } } },
    { name: 'SET_BRAND',
      description: 'Define la identidad de marca: paleta, tipografías, logotipo, tono, eslogan, términos prohibidos y bloqueos de producto/personaje.',
      inputSchema: { type: 'object', properties: {
        primary: { type: 'string' }, secondary: { type: 'string' }, accent: { type: 'string' },
        dark: { type: 'string' }, light: { type: 'string' },
        display: { type: 'string' }, body: { type: 'string' },
        logoUrl: { type: 'string' }, tone: { type: 'string' }, slogan: { type: 'string' },
        forbidden: { type: 'array', items: { type: 'string' } },
        productLock: { type: 'string' }, characterLock: { type: 'string' },
      } } },
    { name: 'UPDATE_SCENE',
      description: 'Edita una escena del storyboard (por id o código SCxx): duración, encuadre, ángulo, óptica, movimiento, luz, color, efectos, texto en pantalla o descripción. Recalcula tiempos y avisa a edición.',
      inputSchema: { type: 'object', properties: {
        sceneId: { type: 'string', description: 'id o código (SC01).' },
        durationSec: { type: 'number' }, shot: { type: 'string' }, angle: { type: 'string' }, lens: { type: 'string' },
        move: { type: 'string' }, lighting: { type: 'string' }, grade: { type: 'string' },
        fx: { type: 'array', items: { type: 'string' } }, onScreenText: { type: 'string' },
        description: { type: 'string' }, transitionIn: { type: 'string' }, notes: { type: 'string' },
      }, required: ['sceneId'] } },
    { name: 'ADD_SCENE',
      description: 'Inserta una escena nueva en el storyboard.',
      inputSchema: { type: 'object', properties: {
        role: { type: 'string', description: 'hook, problem, reveal, demo, detail, proof, money o cta.' },
        afterCode: { type: 'string', description: 'Código de la escena tras la que insertar (vacío = al final).' },
        durationSec: { type: 'number' }, description: { type: 'string' }, onScreenText: { type: 'string' },
      }, required: ['role'] } },
    { name: 'REMOVE_SCENE',
      description: 'Elimina una escena del storyboard por id o código.',
      inputSchema: { type: 'object', properties: { sceneId: { type: 'string' } }, required: ['sceneId'] } },
    { name: 'GET_PROMPTS',
      description: 'Devuelve los prompts listos para ejecutar. Filtrable por tipo (image/video), escena y proveedor. Úsalo para generar de verdad con tus MCP (Higgsfield, etc.).',
      inputSchema: { type: 'object', properties: {
        kind: { type: 'string', description: 'image | video | voice | music' },
        sceneId: { type: 'string' }, providerId: { type: 'string', description: 'Reescribe al dialecto de ese proveedor sin cambiar los ajustes.' },
        limit: { type: 'number' },
      } } },
    { name: 'GET_JOBS',
      description: 'Lista los trabajos de producción pendientes con su prompt, parámetros y coste estimado.',
      inputSchema: { type: 'object', properties: { status: { type: 'string' }, kind: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'REGISTER_ASSET',
      description: 'Registra un archivo generado (imagen, vídeo o audio) y lo asocia a su escena y trabajo. Marca el trabajo como completado y contabiliza el coste REAL. Este es el paso que cierra el ciclo tras generar con un modelo.',
      inputSchema: { type: 'object', properties: {
        url: { type: 'string' }, kind: { type: 'string', description: 'image | video | audio | document | logo | reference' },
        sceneId: { type: 'string', description: 'id o código de escena.' },
        jobId: { type: 'string' }, providerId: { type: 'string' },
        costUsd: { type: 'number' }, durationSec: { type: 'number' }, tokens: { type: 'number' },
        name: { type: 'string' }, note: { type: 'string' }, approved: { type: 'boolean' },
      }, required: ['url'] } },
    { name: 'LIST_ASSETS',
      description: 'Lista los assets registrados de la campaña, con su escena, proveedor, versión y coste.',
      inputSchema: { type: 'object', properties: { kind: { type: 'string' }, sceneId: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'SET_JOB_STATUS',
      description: 'Cambia el estado de un trabajo de producción (pending, running, done, failed, skipped).',
      inputSchema: { type: 'object', properties: { jobId: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['jobId', 'status'] } },
    { name: 'ADD_COST',
      description: 'Registra consumo real de un proveedor (coste, tokens, segundos o imágenes) para la analítica.',
      inputSchema: { type: 'object', properties: {
        providerId: { type: 'string' }, amountUsd: { type: 'number' }, tokens: { type: 'number' },
        seconds: { type: 'number' }, images: { type: 'number' }, note: { type: 'string' },
      }, required: ['providerId'] } },
    { name: 'GET_COPY',
      description: 'Devuelve el copy generado: anuncios por plataforma, landing y secuencia de email.',
      inputSchema: { type: 'object', properties: { platform: { type: 'string' }, section: { type: 'string', description: 'ads | landing | emails | hooks' } } } },
    { name: 'EXPORT',
      description: 'Devuelve un entregable como texto. `render_bundle` es el importante: un único script que descarga todos los assets registrados en su sitio, une las tomas partidas, escribe los subtítulos y ejecuta FFmpeg hasta los entregables finales. Opciones: bible, render_bundle, assets_manifest, ffmpeg, srt, edl, prompts_csv, copy_csv, jobs_csv, json.',
      inputSchema: { type: 'object', properties: { what: { type: 'string' } }, required: ['what'] } },
    { name: 'CREATE_VERSION',
      description: 'Guarda una versión con etiqueta del estado actual de la campaña.',
      inputSchema: { type: 'object', properties: { label: { type: 'string' } } } },
    { name: 'RESTORE_VERSION',
      description: 'Restaura una versión guardada por id.',
      inputSchema: { type: 'object', properties: { versionId: { type: 'string' } }, required: ['versionId'] } },
    { name: 'REGISTER_PROVIDER',
      description: 'Da de alta un proveedor de IA nuevo en caliente sin tocar el núcleo. Se define su dialecto con una plantilla de texto donde {{campo}} se sustituye por el PromptSpec.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'string' }, label: { type: 'string' }, vendor: { type: 'string' },
        capability: { type: 'string', description: 'image | video | voice | music | sfx | text' },
        template: { type: 'string', description: 'Plantilla con {{subject}}, {{action}}, {{environment}}, {{shot}}, {{lens}}, {{lighting}}, {{grade}}, {{move}}, {{fx}}, {{style}}, {{palette}}, {{aspect}}, {{duration}}.' },
        aspects: { type: 'array', items: { type: 'string' } },
        maxSec: { type: 'number' }, costPerUnit: { type: 'number' },
        costUnit: { type: 'string', description: 'image | second | char | call | ktoken' },
        negative: { type: 'boolean' }, docs: { type: 'string' },
      }, required: ['id', 'capability', 'template'] } },
  ];

  /** Resuelve una escena por id o por código (SC01), tolerante a mayúsculas. */
  function findScene(ref) {
    const t = norm(ref);
    const scenes = arr(obj(model.storyboard).scenes);
    return scenes.find((x) => norm(x.id) === t) || scenes.find((x) => norm(x.code) === t)
      || scenes.find((x) => norm(x.code) === 'sc' + t.replace(/^sc/, '').padStart(2, '0')) || null;
  }

  /** Normaliza una URL de entrada (adjunto del chat, ruta interna o externa). */
  function resolveUrl(raw) {
    let u = s(raw).trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.indexOf('/') === 0) return API + u;
    if (!teamId) return u;
    return API + '/api/storage/teams/' + teamId + '/files/download?path=' + encodeURIComponent(u.replace(/^\/+/, ''));
  }

  /** Recalcula los tiempos de inicio tras editar duraciones. */
  function retime(scenes) {
    let t = 0;
    for (const sc of arr(scenes)) {
      sc.startSec = round(t, 2);
      sc.durationSec = round(clamp(num(sc.durationSec, 2), 0.3, 60), 2);
      t = round(t + sc.durationSec, 2);
    }
    return round(t, 2);
  }

  async function dispatch(action) {
    const a = obj(action);
    const type = s(a.type).toUpperCase();
    const p = obj(a.payload);
    try {
      // ── Generación completa ─────────────────────────────────────────────
      if (type === 'GENERATE_CAMPAIGN') {
        const intent = s(p.intent).trim();
        if (!intent) return { success: false, error: 'Indica `intent` (la frase con lo que quieres).' };
        const next = JSON.parse(JSON.stringify(model));
        if (s(p.productName).trim()) next.brief.productName = s(p.productName).trim();
        if (s(p.usp).trim()) next.brief.usp = s(p.usp).trim();
        for (const u of arr(p.photos)) {
          const url = resolveUrl(u);
          if (url && !next.brief.photos.some((x) => x.url === url)) {
            next.brief.photos.push({ id: newId('photo'), url, caption: '', isHero: next.brief.photos.length === 0 });
          }
        }
        if (!s(next.brief.productName).trim()) return { success: false, error: 'Falta el nombre del producto: pásalo en `productName` o llama antes a SET_BRIEF.' };
        model = next;
        const run = generateAll(intent);
        if (!run) return { success: false, error: 'La generación falló; revisa el registro de la app.' };
        const sm = summarize(model);
        return { success: true, message: 'Campaña «' + model.title + '» generada: ' + sm.escenas + ' escenas ('
          + sm.duracionSeg + ' s), ' + arr(obj(model.prompts).image).length + ' prompts de imagen, '
          + arr(obj(model.prompts).video).length + ' de vídeo, ' + arr(obj(model.copy).ads).length + ' anuncios y '
          + arr(obj(model.edit).exports).length + ' entregables. Coste de producción estimado: '
          + fmtMoney(num(obj(obj(model.production).totals).cost, 0), 'USD') + '. Usa GET_JOBS para ejecutar la producción.' };
      }

      if (type === 'SET_BRIEF') {
        const fields = ['productName', 'category', 'priceText', 'currency', 'usp', 'audienceHint',
          'marketRegion', 'language', 'competitorsText', 'mandatories', 'legal', 'extraNotes'];
        const touched = [];
        patch((m) => {
          for (const f of fields) if (p[f] !== undefined) { m.brief[f] = s(p[f]); touched.push(f); }
          if (p.budget !== undefined) { m.brief.budget = Math.max(0, num(p.budget, 0)); touched.push('budget'); }
          if (s(p.title).trim()) { m.title = s(p.title).trim(); touched.push('title'); }
          if (touched.indexOf('productName') >= 0 && (!s(m.title).trim() || m.title === 'Nueva campaña')) m.title = s(m.brief.productName);
          logLine(m, 'info', 'Brief actualizado por el agente: ' + touched.join(', ') + '.');
        });
        if (!touched.length) return { success: false, error: 'No se indicó ningún campo del brief.' };
        return { success: true, message: 'Brief actualizado (' + touched.join(', ') + '). Ejecuta RUN_PIPELINE para propagar los cambios.' };
      }

      if (type === 'ADD_PRODUCT_PHOTO') {
        const url = resolveUrl(p.url);
        if (!url) return { success: false, error: 'Indica `url` (adjunto del chat, ruta /api/… o URL http(s)).' };
        let dup = false;
        patch((m) => {
          if (m.brief.photos.some((x) => x.url === url)) { dup = true; return; }
          m.brief.photos.push({ id: newId('photo'), url, caption: s(p.caption),
            isHero: p.isHero === true || m.brief.photos.length === 0 });
          if (p.isHero === true) m.brief.photos.forEach((x) => { x.isHero = x.url === url; });
          logLine(m, 'info', 'Foto de producto añadida.');
        });
        if (dup) return { success: true, message: 'Esa foto ya estaba en el brief.' };
        return { success: true, message: 'Foto añadida (' + arr(model.brief.photos).length + ' en total). Se usará como referencia en todos los prompts.' };
      }

      // ── Catálogo de ProductLab ──────────────────────────────────────────
      if (type === 'LIST_CATALOG') {
        if (!hasData) return { success: false, error: 'Este host no expone shell.data, o la app no tiene el permiso data.read:productlab aprobado.' };
        const insts = await listCatalogs();
        if (!insts.length) return { success: true, message: 'No hay catálogos de ProductLab visibles para este usuario.', data: [] };
        const only = s(p.instanceId).trim();
        const q = norm(p.query);
        const out = [];
        for (const inst of insts) {
          if (only && s(inst.id) !== only) continue;
          const cat = await readCatalog(inst.id);
          if (!cat) continue;
          const prods = cat.products.filter((x) => !q || norm(x.name).indexOf(q) >= 0 || norm(x.sku).indexOf(q) >= 0);
          out.push({ catalogo: s(inst.name) || s(inst.id), instanceId: s(inst.id), moneda: cat.currency,
            productos: prods.map((x) => ({ id: x.id, nombre: x.name, sku: x.sku, precio: x.price, estado: x.status })) });
        }
        const total = out.reduce((a, x) => a + x.productos.length, 0);
        return { success: true, message: total + ' producto(s) en ' + out.length + ' catálogo(s). Impórtalo con IMPORT_PRODUCT.', data: out };
      }

      if (type === 'IMPORT_PRODUCT') {
        if (!hasData) return { success: false, error: 'Este host no expone shell.data, o falta el permiso data.read:productlab.' };
        const ref = norm(p.product);
        if (!ref) return { success: false, error: 'Indica `product` (nombre, SKU o id).' };
        const insts = await listCatalogs();
        const only = s(p.instanceId).trim();
        let found = null; let cat = null;
        for (const inst of insts) {
          if (only && s(inst.id) !== only) continue;
          const c0 = await readCatalog(inst.id);
          if (!c0) continue;
          const hit = c0.products.find((x) => norm(x.id) === ref)
            || c0.products.find((x) => norm(x.sku) === ref)
            || c0.products.find((x) => norm(x.name) === ref)
            || c0.products.find((x) => norm(x.name).indexOf(ref) >= 0);
          if (hit) { found = hit; cat = c0; break; }
        }
        if (!found) return { success: false, error: 'No se encontró «' + s(p.product) + '». Usa LIST_CATALOG para ver los productos disponibles.' };
        let mapped;
        try { mapped = applyProductToBrief(found, cat, { keepExisting: !!p.keepExisting }); }
        catch (e) { return { success: false, error: (e && e.message) || 'no se pudo importar' }; }
        const base = 'Importado «' + mapped.productName + '» desde ProductLab: ' + arr(mapped.photos).length
          + ' foto(s)' + (mapped.usp ? ', ' + mapped.usp.split('.').filter(Boolean).length + ' especificación(es)' : '')
          + (mapped.priceText ? ', precio ' + mapped.priceText + ' ' + mapped.currency : '') + '.';
        if (s(p.intent).trim()) {
          const run = generateAll(s(p.intent));
          if (!run) return { success: false, error: base + ' Pero la generación falló.' };
          return { success: true, message: base + ' Campaña generada: ' + summarize(model).escenas + ' escenas. Usa RUN_PRODUCTION para producir el material.' };
        }
        return { success: true, message: base + ' Ejecuta GENERATE_CAMPAIGN con la intención creativa que quieras.' };
      }

      // ── Producción por lotes ────────────────────────────────────────────
      if (type === 'RUN_PRODUCTION') {
        if (!model.production) return { success: false, error: 'Aún no hay producción: ejecuta GENERATE_CAMPAIGN primero.' };
        syncJobs();
        const jobs = arr(model.production.jobs);
        const limit = clamp(num(p.limit, 12), 1, 40);
        let batch = readyJobs(model, 0);
        if (s(p.kind)) batch = batch.filter((j) => j.kind === norm(p.kind));
        batch = batch.slice(0, limit);
        const pending = jobs.filter((j) => j.status === 'pending');
        const done = jobs.filter((j) => j.status === 'done').length;
        const failed = jobs.filter((j) => j.status === 'failed');
        const byKind = {};
        for (const j of pending) byKind[j.kind] = (byKind[j.kind] || 0) + 1;
        const ready = pending.length === 0;

        if (ready) {
          return { success: true,
            message: 'Producción completa: ' + done + '/' + jobs.length + ' trabajos con su archivo registrado'
              + (failed.length ? ' (' + failed.length + ' marcados como fallidos)' : '')
              + '. Exporta `render_bundle` y ejecútalo: descarga todo, une las tomas partidas y renderiza los '
              + arr(obj(model.edit).exports).length + ' entregables.',
            data: { listo: true, completados: done, total: jobs.length, siguienteLote: [] } };
        }

        const refs = refImagesOf(model, 3);
        const lote = batch.map((j) => {
          const scene = arr(obj(model.storyboard).scenes).find((x) => x.id === j.sceneId);
          // La referencia de una toma es el keyframe YA REGISTRADO de su
          // escena. Se busca por el trabajo que lo produjo, no por escena +
          // tipo: así nunca discrepa de lo que dice reconcileJobs.
          const kfJob = j.stage === 'shot'
            ? arr(obj(model.production).jobs).find((x) => x.stage === 'keyframe' && x.sceneId === j.sceneId) : null;
          const keyframe = kfJob && kfJob.assetId ? assets.find((a) => a.id === kfJob.assetId) : null;
          return {
            jobId: j.id, tipo: j.kind, etapa: j.stage, escena: j.code,
            proveedor: j.providerId, proveedorNombre: j.providerLabel,
            prompt: j.prompt, negativo: j.negative || undefined, parametros: j.params,
            // Referencias visuales: el keyframe manda sobre las fotos del brief
            // en las tomas de vídeo, porque es lo que fija la continuidad.
            imagenReferencia: keyframe ? keyframe.url : (j.kind === 'image' ? refs : undefined),
            duracionSeg: scene && j.kind === 'video' ? num(j.qty.durationSec, scene.durationSec) : undefined,
            archivoDestino: j.file,
            costeEstimadoUsd: j.estCostUsd,
          };
        });

        return { success: true,
          message: lote.length + ' elemento(s) que generar ahora (' + done + '/' + jobs.length + ' hechos). '
            + 'Genera cada uno con su proveedor y devuélvelos TODOS en una sola llamada a REGISTER_ASSETS '
            + '(pasa el `jobId` de cada uno). Luego vuelve a llamar a RUN_PRODUCTION.',
          data: {
            listo: false, completados: done, total: jobs.length,
            pendientesPorTipo: byKind,
            siguienteLote: lote,
            instrucciones: 'Sube cada archivo generado a una URL accesible y pásala en `url`. '
              + 'Si un elemento falla dos veces, márcalo con SET_JOB_STATUS failed y sigue con el resto.',
          } };
      }

      if (type === 'REGISTER_ASSETS') {
        const list = arr(p.assets);
        if (!list.length) return { success: false, error: 'Indica `assets` con al menos un resultado.' };
        const okIds = []; const errs = [];
        let costTotal = 0;
        for (const raw of list) {
          const a0 = obj(raw);
          const url = resolveUrl(a0.url);
          if (!url) { errs.push('entrada sin url'); continue; }
          const job = s(a0.jobId) ? arr(obj(model.production).jobs).find((x) => x.id === s(a0.jobId)) : null;
          const sceneRef = job ? job.sceneId : (s(a0.sceneId) ? (findScene(a0.sceneId) || {}).id : null);
          const code = job ? job.code : (findScene(a0.sceneId) || {}).code;
          const kind = s(a0.kind) || (job ? (JOB_MEDIA[job.kind] || guessKind(url)) : guessKind(url));
          const prev = assets.filter((x) => x.sceneId === sceneRef && x.kind === kind);
          try {
            const saved = await saveAsset({ url, kind, sceneId: sceneRef, code,
              jobId: s(a0.jobId) || null, jobKind: job ? job.kind : '',
              providerId: s(a0.providerId) || (job ? job.providerId : ''),
              costUsd: a0.costUsd, durationSec: a0.durationSec, note: a0.note, version: prev.length + 1 });
            okIds.push(saved.id);
            const cost = num(a0.costUsd, 0);
            if (cost > 0 || num(a0.tokens, 0) > 0) {
              costTotal += cost;
              await addCost({ providerId: s(a0.providerId) || (job ? job.providerId : ''), jobId: s(a0.jobId),
                sceneId: sceneRef, amountUsd: cost, tokens: a0.tokens, seconds: a0.durationSec,
                images: kind === 'image' ? 1 : 0, note: 'REGISTER_ASSETS ' + s(code) });
            }
          } catch (e) { errs.push(s(a0.jobId || a0.url) + ': ' + ((e && e.message) || 'error')); }
        }
        syncJobs();
        if (model.production) runStages(['analytics'], 'Analítica');
        const jobs = arr(obj(model.production).jobs);
        const pending = jobs.filter((j) => j.status === 'pending').length;
        return { success: errs.length === 0,
          message: okIds.length + ' asset(s) registrados' + (costTotal ? ' · ' + fmtMoney(costTotal, 'USD') + ' de coste real' : '')
            + '. Quedan ' + pending + ' trabajo(s) pendientes'
            + (pending ? ': vuelve a llamar a RUN_PRODUCTION.' : ': exporta `render_bundle` y renderiza.'),
          error: errs.length ? errs.join(' · ') : undefined };
      }

      // ── Flujo y aspecto ─────────────────────────────────────────────────
      if (type === 'SET_WORKFLOW') {
        const known = (x) => PIPELINE_ORDER.indexOf(s(x)) >= 0;
        const bad = arr(p.order).concat(arr(p.disable)).concat(arr(p.enable)).map(s).filter((x) => x && !known(x));
        if (bad.length) return { success: false, error: 'Agentes desconocidos: ' + uniq(bad).join(', ') + '. Válidos: ' + PIPELINE_ORDER.join(', ') + '.' };
        if (!p.reset && !arr(p.order).length && !arr(p.disable).length && !arr(p.enable).length) {
          return { success: false, error: 'Indica `order`, `disable`, `enable` o `reset`.' };
        }
        patch((m) => {
          if (p.reset) { m.settings.workflow = { order: [], disabled: [] }; return; }
          if (arr(p.order).length) m.settings.workflow.order = uniq(arr(p.order).map(s).filter(known));
          const off = new Set(arr(m.settings.workflow.disabled));
          for (const x of arr(p.disable)) if (known(x)) off.add(s(x));
          for (const x of arr(p.enable)) off.delete(s(x));
          m.settings.workflow.disabled = Array.from(off);
        });
        // effectiveOrder puede haber corregido el orden pedido: se guarda ya
        // corregido para que lo que se ve sea lo que se va a ejecutar.
        if (!p.reset && arr(p.order).length) {
          const fixed = effectiveOrder(model);
          patch((m) => { m.settings.workflow.order = fixed; });
        }
        const plan = workflowPlan(model);
        const off = plan.filter((x) => x.disabled).map((x) => x.name);
        const blocked = plan.filter((x) => x.blocked).map((x) => x.name);
        return { success: true,
          message: 'Flujo actualizado. Orden: ' + plan.map((x) => x.name).join(' → ') + '.'
            + (off.length ? ' Desactivados: ' + off.join(', ') + '.' : '')
            + (blocked.length ? ' Bloqueados por dependencia apagada: ' + blocked.join(', ') + '.' : ''),
          data: plan.map((x) => ({ orden: x.idx + 1, id: x.id, agente: x.name, estado: x.status,
            depende: arr(x.deps).map((d) => (agentById(d) || {}).name) })) };
      }

      if (type === 'SET_THEME') {
        const ch = [];
        let bad = '';
        patch((m) => {
          if (s(p.form)) {
            if (!THEME_FORMS.some((x) => x.id === s(p.form))) bad = 'form debe ser classic o game.';
            else { m.settings.theme.form = s(p.form); ch.push('forma ' + themeFormById(p.form).label); }
          }
          if (s(p.classicMode)) {
            if (!CLASSIC_MODES.some((x) => x.id === s(p.classicMode))) bad = 'classicMode debe ser day, sunset, night o live.';
            else { m.settings.theme.classicMode = s(p.classicMode); ch.push('modo ' + classicModeById(p.classicMode).label); }
          }
          if (s(p.gameMode)) {
            if (!GAME_MODES.some((x) => x.id === s(p.gameMode))) bad = 'gameMode debe ser kimoslab, jabotel o spacecraft.';
            else { m.settings.theme.gameMode = s(p.gameMode); ch.push('ambientación ' + gameModeById(p.gameMode).label); }
          }
        });
        if (bad) return { success: false, error: bad };
        if (!ch.length) return { success: false, error: 'Indica `form`, `classicMode` o `gameMode`.' };
        const th = currentTheme();
        return { success: true, message: 'Aspecto: ' + ch.join(', ') + '. Ahora se ve como «' + th.label + '».'
          + ' Es solo presentación: los datos y los resultados no cambian.' };
      }

      // ── Mapa de la organización ─────────────────────────────────────────
      if (type === 'SET_ORG') {
        const op = norm(p.op).replace(/[^a-z_]/g, '');
        // Cada operación es una mutación pura del paquete: devuelve un mundo
        // nuevo o un motivo, nunca lanza y nunca deja el documento a medias.
        const OPS = {
          add_area: (w) => wsAddArea(w, { departmentId: p.departmentId, name: p.name, structure: p.structure,
            x: p.x, y: p.y, w: p.w, h: p.h, note: p.note }),
          update_area: (w) => wsUpdateArea(w, p.areaId, p),
          remove_area: (w) => wsRemoveArea(w, p.areaId),
          add_station: (w) => wsAddStation(w, p.areaId, { name: p.name, process: p.process }),
          update_station: (w) => wsUpdateStation(w, p.areaId, p.stationId, { name: p.name, process: p.process }),
          remove_station: (w) => wsRemoveStation(w, p.areaId, p.stationId),
          add_staff: (w) => wsAddStaff(w, { name: p.name, role: p.role, kind: p.kind, areaId: p.areaId, stationId: p.stationId }),
          update_staff: (w) => wsUpdateStaff(w, p.staffId, p),
          remove_staff: (w) => wsRemoveStaff(w, p.staffId),
          resize: (w) => wsResizeGrid(w, numOr(p.gridW, obj(w.grid).w), numOr(p.gridH, obj(w.grid).h)),
          clear_owner: (w) => wsClearAreaOwner(w, p.areaId),
        };
        if (op === 'reseed') {
          patch((m) => { m.world = seedOrgWorld(m); logLine(m, 'info', 'Organización · mapa sembrado de nuevo.'); });
          return { success: true, message: 'Mapa sembrado de nuevo desde el flujo de agentes.',
            data: wsWorldSummary(model.world) };
        }
        // El responsable se resuelve contra el directorio de KIMOS: no se
        // acepta un nombre inventado, porque entonces la responsabilidad no
        // apuntaría a nadie con cuenta en la organización.
        if (op === 'set_owner') {
          if (!directory.loaded) return { success: false, error: 'El directorio de usuarios todavía no ha cargado. Inténtalo de nuevo.' };
          if (directory.error) return { success: false, error: directory.error };
          const who = findUser(p.user || p.staffId);
          if (!who) {
            return { success: false, error: 'No hay ningún usuario de KIMOS que case con «' + s(p.user) + '». '
              + 'Disponibles: ' + arr(directory.users).map((u) => u.name).slice(0, 25).join(', ') + '.' };
          }
          const r0 = wsSetAreaOwner(model.world, p.areaId, who);
          if (!r0.ok) return { success: false, error: s(r0.error) };
          patch((m) => { m.world = r0.world; logLine(m, 'info', 'Organización · ' + s(r0.message)); });
          return { success: true, message: s(r0.message), data: wsWorldSummary(model.world) };
        }
        if (!OPS[op]) return { success: false, error: 'op desconocido. Válidos: ' + Object.keys(OPS).concat(['set_owner', 'reseed']).join(', ') + '.' };
        // Un agente del flujo no se da de baja borrando su avatar: eso dejaría
        // el mapa mintiendo sobre quién trabaja aquí.
        if (op === 'remove_staff') {
          const who = arr(model.world.staff).find((x) => x.id === s(p.staffId) || norm(x.name) === norm(p.staffId));
          if (who && who.agentId) {
            return { success: false, error: '«' + who.name + '» es un agente del flujo. Desactívalo con '
              + 'SET_WORKFLOW { disable: ["' + who.agentId + '"] } en vez de borrarlo del mapa.' };
          }
        }
        const r = OPS[op](model.world);
        if (!r || !r.ok) return { success: false, error: s(r && r.error) || 'No se pudo cambiar el mapa.' };
        patch((m) => { m.world = r.world; logLine(m, 'info', 'Organización · ' + s(r.message)); });
        return { success: true, message: s(r.message), data: wsWorldSummary(model.world) };
      }

      // ── Ejecución de agentes ────────────────────────────────────────────
      if (type === 'RUN_AGENT') {
        const ag = agentById(p.agentId);
        if (!ag) return { success: false, error: 'Agente desconocido. Disponibles: ' + AGENTS.map((x) => x.id).join(', ') + '.' };
        const run = runStages([ag.id], ag.name);
        const st = run.stages.find((x) => x.agentId === ag.id);
        if (st && st.status === 'error') return { success: false, error: ag.name + ' falló: ' + s(st.error) };
        return { success: true, message: ag.name + ' ejecutado en ' + (st ? st.ms : 0) + ' ms.' };
      }

      if (type === 'RUN_PIPELINE') {
        const only = arr(p.only).map(s).filter((x) => agentById(x));
        const run = runStages(only.length ? only : null, 'Pipeline');
        const errs = run.stages.filter((x) => x.status === 'error');
        return { success: errs.length === 0, message: run.stages.length + ' etapas en ' + run.ms + ' ms.',
          error: errs.length ? errs.map((x) => x.name + ': ' + x.error).join(' · ') : undefined };
      }

      if (type === 'SET_DIRECTION') {
        const changes = [];
        patch((m) => {
          if (p.styleId && STYLES.some((x) => x.id === p.styleId)) { m.styleId = s(p.styleId); changes.push('estilo ' + styleById(m.styleId).name); }
          if (p.objectiveId && OBJECTIVES.some((x) => x.id === p.objectiveId)) { m.objectiveId = s(p.objectiveId); changes.push('objetivo ' + objectiveById(m.objectiveId).label); }
          if (p.audienceId && AUDIENCES.some((x) => x.id === p.audienceId)) { m.audienceId = s(p.audienceId); changes.push('público ' + audienceById(m.audienceId).label); }
          if (p.categoryId && CATEGORIES.some((x) => x.id === p.categoryId)) { m.categoryId = s(p.categoryId); changes.push('categoría ' + categoryById(m.categoryId).label); }
        });
        if (!changes.length) return { success: false, error: 'Ningún valor válido. Estilos: ' + STYLES.map((x) => x.id).join(', ') + '.' };
        if (p.regenerate !== false && model.concept) runStages(null, 'Regeneración');
        return { success: true, message: 'Dirección actualizada: ' + changes.join(', ') + (p.regenerate !== false && model.concept ? '. Campaña regenerada.' : '.') };
      }

      if (type === 'SET_PROVIDER') {
        const cap = s(p.capability).trim();
        const prov = getProvider(p.providerId);
        if (!CAPABILITIES.some((x) => x.id === cap)) return { success: false, error: 'Capacidad desconocida. Usa: ' + CAPABILITIES.map((x) => x.id).join(', ') + '.' };
        if (!prov) return { success: false, error: 'Proveedor desconocido. Para «' + cap + '»: ' + providersFor(cap).map((x) => x.id).join(', ') + '.' };
        if (prov.capability !== cap) return { success: false, error: '«' + prov.id + '» es de capacidad «' + prov.capability + '», no «' + cap + '».' };
        patch((m) => {
          m.settings.providers[cap] = prov.id;
          if (p.params && typeof p.params === 'object') m.settings.providerParams[prov.id] = Object.assign(obj(m.settings.providerParams[prov.id]), obj(p.params));
          logLine(m, 'info', 'Proveedor de ' + cap + ' → ' + prov.label + '.');
        });
        if (model.storyboard) runStages(['prompt-engineer', 'voice-director', 'video-producer', 'analytics'], 'Reescritura de prompts');
        return { success: true, message: 'Proveedor de ' + cap + ' cambiado a ' + prov.label + '. Los prompts se han reescrito a su dialecto (' + prov.dialect + ').' };
      }

      if (type === 'SET_SETTINGS') {
        const ch = [];
        patch((m) => {
          if (p.heroDurationSec !== undefined) { m.settings.heroDurationSec = clamp(num(p.heroDurationSec, 30), 5, 180); ch.push('hero ' + m.settings.heroDurationSec + 's'); }
          if (p.shortDurationSec !== undefined) { m.settings.shortDurationSec = clamp(num(p.shortDurationSec, 15), 5, 90); ch.push('corto ' + m.settings.shortDurationSec + 's'); }
          if (p.variantCount !== undefined) { m.settings.variantCount = clamp(num(p.variantCount, 3), 1, 8); ch.push(m.settings.variantCount + ' variantes'); }
          if (p.fps !== undefined) { m.settings.fps = clamp(num(p.fps, 25), 12, 60); ch.push(m.settings.fps + ' fps'); }
          if (p.subtitles !== undefined) { m.settings.subtitles = !!p.subtitles; ch.push('subtítulos ' + (m.settings.subtitles ? 'sí' : 'no')); }
          const asp = arr(p.aspects).map(s).filter((x) => ASPECTS.some((y) => y.id === x));
          if (asp.length) { m.settings.targets.aspects = uniq(asp); ch.push('formatos ' + asp.join('/')); }
          const res = arr(p.resolutions).map(s).filter((x) => RESOLUTIONS.some((y) => y.id === x));
          if (res.length) { m.settings.targets.resolutions = uniq(res); ch.push('resoluciones ' + res.join('/')); }
          const plat = arr(p.platforms).map(s).filter((x) => PLATFORMS.some((y) => y.id === x));
          if (plat.length) { m.settings.targets.platforms = uniq(plat); ch.push(plat.length + ' plataformas'); }
        });
        if (!ch.length) return { success: false, error: 'No se indicó ningún ajuste válido.' };
        if (model.storyboard) runStages(null, 'Regeneración');
        return { success: true, message: 'Ajustes: ' + ch.join(', ') + '.' };
      }

      if (type === 'SET_BRAND') {
        const bad = [];
        patch((m) => {
          for (const k of ['primary', 'secondary', 'accent', 'dark', 'light']) {
            if (p[k] === undefined) continue;
            if (isHex(p[k])) m.brand.palette[k] = s(p[k]).trim(); else bad.push(k);
          }
          if (p.display !== undefined) m.brand.typography.display = s(p.display);
          if (p.body !== undefined) m.brand.typography.body = s(p.body);
          if (p.logoUrl !== undefined) m.brand.logoUrl = resolveUrl(p.logoUrl);
          if (p.tone !== undefined) m.brand.tone = s(p.tone);
          if (p.slogan !== undefined) m.brand.slogan = s(p.slogan);
          if (p.productLock !== undefined) m.brand.productLock = s(p.productLock);
          if (p.characterLock !== undefined) m.brand.characterLock = s(p.characterLock);
          if (p.forbidden !== undefined) m.brand.forbidden = uniq(arr(p.forbidden).map(s));
          logLine(m, 'info', 'Identidad de marca actualizada.');
        });
        if (model.storyboard) runStages(['prompt-engineer', 'video-editor', 'brand-consistency'], 'Marca');
        return { success: true, message: 'Marca actualizada.' + (bad.length ? ' Colores ignorados por formato inválido (usa #RRGGBB): ' + bad.join(', ') + '.' : '') };
      }

      // ── Storyboard ──────────────────────────────────────────────────────
      if (type === 'UPDATE_SCENE') {
        const sc = findScene(p.sceneId);
        if (!sc) return { success: false, error: 'Escena no encontrada. Códigos: ' + arr(obj(model.storyboard).scenes).map((x) => x.code).join(', ') + '.' };
        const applied = [];
        const enums = { shot: SHOTS, angle: ANGLES, lens: LENSES, move: MOVES, lighting: LIGHTING, grade: GRADES, transitionIn: TRANSITIONS };
        const invalid = [];
        patch((m) => {
          const t = arr(m.storyboard.scenes).find((x) => x.id === sc.id);
          if (!t) return;
          for (const k of Object.keys(enums)) {
            if (p[k] === undefined) continue;
            if (enums[k].some((x) => x.id === s(p[k]))) { t[k] = s(p[k]); applied.push(k); }
            else invalid.push(k + ' (válidos: ' + enums[k].map((x) => x.id).slice(0, 8).join(', ') + '…)');
          }
          if (p.fx !== undefined) { t.fx = arr(p.fx).map(s).filter((x) => FX.some((y) => y.id === x)); applied.push('fx'); }
          if (p.durationSec !== undefined) { t.durationSec = clamp(num(p.durationSec, t.durationSec), 0.3, 60); applied.push('duración'); }
          if (p.onScreenText !== undefined) { t.onScreenText = s(p.onScreenText); applied.push('texto'); }
          if (p.description !== undefined) { t.description = s(p.description); applied.push('descripción'); }
          if (p.notes !== undefined) { t.notes = s(p.notes); applied.push('notas'); }
          m.storyboard.totalSec = retime(m.storyboard.scenes);
          logLine(m, 'info', 'Escena ' + t.code + ' editada por el agente.');
        });
        if (!applied.length) return { success: false, error: 'Ningún campo válido. ' + (invalid.length ? 'Rechazados: ' + invalid.join(' · ') : '') };
        runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'brand-consistency', 'analytics'], 'Escena');
        return { success: true, message: 'Escena ' + sc.code + ' actualizada (' + applied.join(', ') + '); prompts, audio y montaje regenerados.'
          + (invalid.length ? ' Ignorado: ' + invalid.join(' · ') : '') };
      }

      if (type === 'ADD_SCENE') {
        const role = s(p.role).trim();
        if (!BEAT_ROLES.some((x) => x.id === role)) return { success: false, error: 'Rol inválido. Usa: ' + BEAT_ROLES.map((x) => x.id).join(', ') + '.' };
        if (!model.storyboard) return { success: false, error: 'Aún no hay storyboard: ejecuta RUN_AGENT storyboard o GENERATE_CAMPAIGN.' };
        let code = '';
        patch((m) => {
          const st0 = styleById(m.styleId);
          const scenes = arr(m.storyboard.scenes);
          const at = s(p.afterCode) ? scenes.findIndex((x) => norm(x.code) === norm(p.afterCode)) + 1 : scenes.length;
          const r0 = rng(seedOf(m) ^ hash32(role + at));
          const spec = shotForRole(role, st0, categoryById(m.categoryId), r0, { vertical: false, index: at, count: scenes.length + 1 });
          const sc2 = {
            id: newId('sc'), n: at + 1, code: 'SC' + String(at + 1).padStart(2, '0'), role,
            roleLabel: (BEAT_ROLES.find((x) => x.id === role) || {}).label || role,
            purpose: (BEAT_ROLES.find((x) => x.id === role) || {}).purpose || '',
            startSec: 0, durationSec: clamp(num(p.durationSec, 2.5), 0.3, 60),
            description: s(p.description) || sceneDescription(role, s(m.brief.productName) || 'el producto', m, spec, null, r0),
            shot: spec.shot, angle: spec.angle, lens: spec.lens, move: spec.move,
            lighting: spec.lighting, grade: spec.grade, fx: spec.fx, speed: spec.speed, transitionIn: spec.transitionIn,
            onScreenText: p.onScreenText !== undefined ? s(p.onScreenText) : onScreenTextFor(role, m, null, r0),
            soundNote: soundNoteFor(role, st0, categoryById(m.categoryId)), productVisible: role !== 'problem', notes: '',
          };
          scenes.splice(at, 0, sc2);
          scenes.forEach((x, i) => { x.n = i + 1; x.code = 'SC' + String(i + 1).padStart(2, '0'); });
          m.storyboard.totalSec = retime(scenes);
          code = sc2.code;
          logLine(m, 'info', 'Escena ' + code + ' (' + role + ') añadida por el agente.');
        });
        runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'analytics'], 'Escena nueva');
        return { success: true, message: 'Escena ' + code + ' añadida. Duración total: ' + fmtSec(num(obj(model.storyboard).totalSec, 0)) + '.' };
      }

      if (type === 'REMOVE_SCENE') {
        const sc = findScene(p.sceneId);
        if (!sc) return { success: false, error: 'Escena no encontrada.' };
        if (arr(obj(model.storyboard).scenes).length <= 2) return { success: false, error: 'Una campaña necesita al menos 2 escenas.' };
        patch((m) => {
          m.storyboard.scenes = arr(m.storyboard.scenes).filter((x) => x.id !== sc.id);
          m.storyboard.scenes.forEach((x, i) => { x.n = i + 1; x.code = 'SC' + String(i + 1).padStart(2, '0'); });
          m.storyboard.totalSec = retime(m.storyboard.scenes);
          logLine(m, 'info', 'Escena ' + sc.code + ' eliminada.');
        });
        runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'analytics'], 'Escena eliminada');
        return { success: true, message: 'Escena ' + sc.code + ' eliminada.' };
      }

      // ── Consulta ────────────────────────────────────────────────────────
      if (type === 'GET_PROMPTS') {
        if (!model.prompts) return { success: false, error: 'Aún no hay prompts: ejecuta GENERATE_CAMPAIGN o RUN_AGENT prompt-engineer.' };
        const kind = norm(p.kind);
        const limit = clamp(num(p.limit, 12), 1, 60);
        let list = [];
        if (!kind || kind === 'image') list = list.concat(arr(model.prompts.image));
        if (!kind || kind === 'video') list = list.concat(arr(model.prompts.video));
        if (kind === 'voice') list = arr(obj(model.audio).vo).map((v) => ({ code: v.code, role: 'vo', kind: 'voice', providerId: v.providerId, text: v.text, params: v.params }));
        if (kind === 'music') { const mu = obj(obj(model.audio).music); list = mu.prompt ? [{ code: 'MUS', role: 'music', kind: 'music', providerId: mu.providerId, text: mu.prompt, params: mu.params }] : []; }
        if (s(p.sceneId)) { const sc = findScene(p.sceneId); list = sc ? list.filter((x) => x.sceneId === sc.id || x.code === sc.code) : []; }
        if (s(p.providerId)) {
          const prov = getProvider(p.providerId);
          if (!prov) return { success: false, error: 'Proveedor desconocido: ' + s(p.providerId) };
          const scenes = arr(obj(model.storyboard).scenes);
          list = list.map((x) => {
            const sc = scenes.find((y) => y.id === x.sceneId || y.code === x.code);
            if (!sc) return x;
            const spec = specForScene(model, sc, { kind: prov.capability === 'video' ? 'video' : 'image', aspect: x.aspect });
            const out = renderPrompt(prov.id, spec, obj(model.settings.providerParams)[prov.id]);
            return Object.assign({}, x, { providerId: out.providerId, text: out.text, negative: out.negative, params: out.params });
          });
        }
        const rows = list.slice(0, limit).map((x) => ({ escena: x.code, rol: x.role, tipo: x.kind, proveedor: x.providerId,
          aspecto: x.aspect, duracion: x.durationSec, prompt: x.text, negativo: x.negative, parametros: x.params }));
        return { success: true, message: rows.length + ' prompt(s) de ' + list.length + '.', data: rows };
      }

      if (type === 'GET_JOBS') {
        if (!model.production) return { success: false, error: 'Aún no hay trabajos: ejecuta RUN_AGENT video-producer.' };
        let jobs = arr(model.production.jobs);
        if (s(p.status)) jobs = jobs.filter((j) => j.status === norm(p.status));
        if (s(p.kind)) jobs = jobs.filter((j) => j.kind === norm(p.kind));
        const limit = clamp(num(p.limit, 15), 1, 80);
        return { success: true,
          message: jobs.length + ' trabajo(s). Coste estimado total: ' + fmtMoney(jobs.reduce((x, j) => x + num(j.estCostUsd, 0), 0), 'USD')
            + '. Ejecuta cada uno con el proveedor indicado y cierra con REGISTER_ASSET.',
          data: jobs.slice(0, limit).map((j) => ({ id: j.id, tipo: j.kind, etapa: j.stage, escena: j.code,
            proveedor: j.providerId, prompt: j.prompt, negativo: j.negative, parametros: j.params,
            coste_est: j.estCostUsd, estado: j.status, nota: j.note })) };
      }

      if (type === 'LIST_ASSETS') {
        let list = assets.slice();
        if (s(p.kind)) list = list.filter((x) => x.kind === norm(p.kind));
        if (s(p.sceneId)) { const sc = findScene(p.sceneId); list = sc ? list.filter((x) => x.sceneId === sc.id) : []; }
        const limit = clamp(num(p.limit, 30), 1, 100);
        return { success: true, message: list.length + ' asset(s) registrados.',
          data: list.slice(0, limit).map((x) => ({ id: x.id, tipo: x.kind, escena: x.code, url: x.url,
            proveedor: x.providerId, version: x.version, coste: x.costUsd, aprobado: x.approved })) };
      }

      if (type === 'GET_COPY') {
        if (!model.copy) return { success: false, error: 'Aún no hay copy: ejecuta RUN_AGENT copywriter.' };
        const sec = norm(p.section) || 'ads';
        if (sec === 'landing') return { success: true, message: 'Landing completa.', data: model.copy.landing };
        if (sec === 'emails') return { success: true, message: arr(model.copy.emails).length + ' emails.', data: model.copy.emails };
        if (sec === 'hooks') return { success: true, message: arr(model.copy.hooks).length + ' ganchos.', data: model.copy.hooks };
        let ads = arr(model.copy.ads);
        if (s(p.platform)) ads = ads.filter((x) => norm(x.platform).indexOf(norm(p.platform)) >= 0 || norm(x.platformLabel).indexOf(norm(p.platform)) >= 0);
        return { success: true, message: ads.length + ' anuncio(s).',
          data: ads.map((x) => ({ plataforma: x.platformLabel, variante: x.variant, gancho: x.hookLabel,
            texto: x.primary, titular: x.headline, descripcion: x.description, cta: x.cta, sobre_limite: x.overLimit })) };
      }

      // ── Producción y assets ─────────────────────────────────────────────
      if (type === 'REGISTER_ASSET') {
        const url = resolveUrl(p.url);
        if (!url) return { success: false, error: 'Indica `url`.' };
        const sc = s(p.sceneId) ? findScene(p.sceneId) : null;
        const prev = assets.filter((x) => x.sceneId === (sc ? sc.id : null) && x.kind === (s(p.kind) || guessKind(url)));
        let saved;
        try {
          const jobRef = s(p.jobId) ? arr(obj(model.production).jobs).find((x) => x.id === s(p.jobId)) : null;
          saved = await saveAsset({ url, kind: p.kind, sceneId: sc ? sc.id : s(p.sceneId), code: sc ? sc.code : s(p.sceneId),
            jobId: p.jobId, jobKind: jobRef ? jobRef.kind : '',
            providerId: p.providerId, costUsd: p.costUsd, durationSec: p.durationSec,
            name: p.name, note: p.note, approved: p.approved, version: prev.length + 1 });
        } catch (e) { return { success: false, error: (e && e.message) || 'no se pudo guardar el asset' }; }
        if (num(p.costUsd, 0) > 0 || num(p.tokens, 0) > 0) {
          await addCost({ providerId: p.providerId, jobId: p.jobId, sceneId: saved.sceneId, amountUsd: p.costUsd,
            tokens: p.tokens, seconds: p.durationSec, images: saved.kind === 'image' ? 1 : 0, note: 'REGISTER_ASSET ' + saved.code });
        }
        let jobMsg = '';
        if (s(p.jobId) && model.production) {
          patch((m) => {
            const j = arr(m.production.jobs).find((x) => x.id === s(p.jobId));
            if (j) { j.status = 'done'; j.assetId = saved.id; jobMsg = ' Trabajo ' + j.id + ' marcado como completado.'; }
          });
        }
        if (model.production) runStages(['analytics'], 'Analítica');
        return { success: true, message: 'Asset registrado (' + saved.kind + (saved.code ? ', escena ' + saved.code : '')
          + ', versión ' + saved.version + ').' + jobMsg };
      }

      if (type === 'SET_JOB_STATUS') {
        if (!model.production) return { success: false, error: 'No hay trabajos de producción.' };
        const st0 = norm(p.status);
        if (JOB_STATUS.indexOf(st0) < 0) return { success: false, error: 'Estado inválido. Usa: ' + JOB_STATUS.join(', ') + '.' };
        let found = false;
        patch((m) => {
          const j = arr(m.production.jobs).find((x) => x.id === s(p.jobId) || x.code === s(p.jobId));
          if (!j) return;
          found = true;
          j.status = st0;
          if (st0 === 'failed') j.attempts = num(j.attempts, 0) + 1;
          if (s(p.note)) j.note = s(p.note);
        });
        if (!found) return { success: false, error: 'Trabajo no encontrado: ' + s(p.jobId) };
        return { success: true, message: 'Trabajo ' + s(p.jobId) + ' → ' + st0 + '.' };
      }

      if (type === 'ADD_COST') {
        if (!s(p.providerId).trim()) return { success: false, error: 'Indica `providerId`.' };
        const rec = await addCost(p);
        if (model.production) runStages(['analytics'], 'Analítica');
        return { success: true, message: 'Coste registrado: ' + fmtMoney(rec.amountUsd, 'USD') + ' en ' + rec.providerId
          + '. Total real acumulado: ' + fmtMoney(ledger.reduce((a, x) => a + num(x.amountUsd, 0), 0), 'USD') + '.' };
      }

      // ── Entregables y versiones ─────────────────────────────────────────
      if (type === 'EXPORT') {
        const what = norm(p.what);
        const map = {
          bible: () => exportBible(model), ffmpeg: () => s(obj(model.edit).ffmpeg),
          srt: () => s(obj(model.edit).srt), edl: () => s(obj(model.edit).edl),
          prompts_csv: () => exportPromptsCsv(model), copy_csv: () => exportCopyCsv(model),
          jobs_csv: () => exportJobsCsv(model), json: () => JSON.stringify(model, null, 2),
          render_bundle: () => exportRenderBundle(model, assets),
          assets_manifest: () => exportAssetsManifest(model, assets),
        };
        if (!map[what]) return { success: false, error: 'Opciones: ' + Object.keys(map).join(', ') + '.' };
        const content = map[what]();
        if (!s(content).trim()) return { success: false, error: 'No hay contenido para «' + what + '»: ejecuta antes el pipeline.' };
        return { success: true, message: 'Exportado «' + what + '» (' + s(content).length + ' caracteres).', data: content };
      }

      if (type === 'CREATE_VERSION') {
        const v = createVersion(p.label);
        return { success: true, message: 'Versión «' + v.label + '» guardada (id ' + v.id + ').' };
      }
      if (type === 'RESTORE_VERSION') {
        if (!restoreVersion(p.versionId)) return { success: false, error: 'Versión no encontrada. IDs: ' + arr(model.versions).map((x) => x.id).join(', ') + '.' };
        return { success: true, message: 'Versión restaurada.' };
      }

      if (type === 'REGISTER_PROVIDER') {
        const tpl = s(p.template);
        if (!tpl.trim()) return { success: false, error: 'Indica `template` con marcadores {{campo}}.' };
        try {
          const desc = {
            id: slug(p.id), label: s(p.label) || s(p.id), vendor: s(p.vendor) || 'Personalizado',
            capability: s(p.capability), docs: s(p.docs), dialect: 'natural',
            negative: !!p.negative, aspects: arr(p.aspects).length ? arr(p.aspects).map(s) : ['*'],
            maxSec: num(p.maxSec, 0) || undefined, params: [], custom: true,
            cost: { unit: s(p.costUnit) || 'call', amount: num(p.costPerUnit, 0), currency: 'USD' },
            render(spec) { return { text: fillTemplate(tpl, spec), negative: p.negative ? uniq(arr(spec.negative)).join(', ') : '', params: { aspect: spec.aspect } }; },
          };
          registerProvider(desc);
        } catch (e) { return { success: false, error: (e && e.message) || 'descriptor inválido' }; }
        patch((m) => { logLine(m, 'info', 'Proveedor «' + slug(p.id) + '» registrado en caliente.'); });
        return { success: true, message: 'Proveedor «' + slug(p.id) + '» disponible para la capacidad «' + s(p.capability)
          + '». Actívalo con SET_PROVIDER. Nota: los proveedores registrados en caliente viven mientras la ventana esté abierta; '
          + 'para hacerlo permanente, añádelo al registro del bundle.' };
      }

      return { success: false, error: 'Acción desconocida: ' + type + '. Disponibles: ' + AGENT_TOOLS.map((t) => t.name).join(', ') + '.' };
    } catch (e) {
      return { success: false, error: 'Error interno en ' + type + ': ' + ((e && e.message) || 'desconocido') };
    }
  }

  /** Sustituye {{campo}} del PromptSpec en la plantilla de un proveedor custom. */
  function fillTemplate(tpl, spec) {
    const sp = obj(spec);
    const vals = {
      subject: s(sp.subject), action: s(sp.action), environment: s(sp.environment),
      shot: enOf(SHOTS, sp.shot), angle: enOf(ANGLES, sp.angle), lens: enOf(LENSES, sp.lens),
      lighting: enOf(LIGHTING, sp.lighting), grade: enOf(GRADES, sp.grade), move: enOf(MOVES, sp.move),
      fx: arr(sp.fx).map((f) => enOf(FX, f)).filter(Boolean).join(', '),
      style: s(sp.styleText), palette: s(sp.paletteText), aspect: s(sp.aspect),
      duration: s(sp.durationSec), product: s(sp.productNote), negative: uniq(arr(sp.negative)).join(', '),
      composition: s(sp.composition), mood: s(sp.mood), film: s(sp.filmStock), code: s(sp.sceneCode),
    };
    return s(tpl).replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (m0, k) => (vals[k] !== undefined ? vals[k] : m0));
  }

  if (shell.agent && typeof shell.agent.register === 'function') {
    try {
      unregisterAgent = shell.agent.register({
        label: 'Kreative Studio',
        description: 'Estudio de campañas publicitarias con IA. Genera campañas completas desde fotos de un producto '
          + 'y una frase: investigación, concepto, plan de funnel, storyboard con dirección de fotografía, prompts por '
          + 'proveedor (OpenAI, Midjourney, FLUX, SD, ComfyUI, Runway, Kling, Veo, Sora, Higgsfield), locución y música '
          + '(ElevenLabs, Suno, Udio), montaje con FFmpeg, control de marca, copy para todos los canales, assets, '
          + 'versiones y analítica de costes.\n\n'
          + 'FLUJO COMPLETO, de cero al vídeo montado:\n'
          + '1. IMPORT_PRODUCT (si el producto está en ProductLab) o SET_BRIEF + ADD_PRODUCT_PHOTO.\n'
          + '2. GENERATE_CAMPAIGN con la intención en lenguaje natural.\n'
          + '3. RUN_PRODUCTION → devuelve el lote que toca generar ahora, con proveedor, prompt, '
          + 'parámetros e imagen de referencia. Genera cada elemento CON TUS MODELOS.\n'
          + '4. REGISTER_ASSETS con todo el lote de una vez (pasando el jobId de cada uno).\n'
          + '5. Repite 3-4 hasta que RUN_PRODUCTION devuelva listo: true.\n'
          + '6. EXPORT render_bundle → un script que descarga todo, une las tomas partidas y renderiza '
          + 'los entregables finales con FFmpeg. EXPORT bible para el documento del cliente.',
        tools: AGENT_TOOLS,
        getSnapshot: () => ({
          campania: summarize(model),
          estilo: { id: model.styleId, nombre: styleById(model.styleId).name, tagline: styleById(model.styleId).tagline },
          objetivo: model.objectiveId, publico: model.audienceId, categoria: model.categoryId,
          proveedores: model.settings.providers,
          formatos: model.settings.targets,
          idea: s(obj(model.concept).bigIdea),
          mensajeClave: s(obj(model.concept).keyMessage),
          escenas: arr(obj(model.storyboard).scenes).map((x) => ({ id: x.id, code: x.code, rol: x.role,
            dur: x.durationSec, plano: x.shot, movimiento: x.move, texto: x.onScreenText })),
          trabajos: { total: arr(obj(model.production).jobs).length,
            pendientes: arr(obj(model.production).jobs).filter((j) => j.status === 'pending').length,
            hechos: arr(obj(model.production).jobs).filter((j) => j.status === 'done').length,
            fallidos: arr(obj(model.production).jobs).filter((j) => j.status === 'failed').length,
            listoParaRenderizar: !!model.production && arr(model.production.jobs).length > 0
              && arr(model.production.jobs).every((j) => j.status !== 'pending'),
            costeEstimadoUsd: num(obj(obj(model.production).totals).cost, 0) },
          catalogoProductLab: hasData ? 'disponible (LIST_CATALOG / IMPORT_PRODUCT)' : 'no disponible en este host',
          origenDelProducto: obj(model.brief.sourceRef).app || null,
          assets: assets.map((x) => ({ id: x.id, tipo: x.kind, escena: x.code, version: x.version, url: x.url })),
          costeRealUsd: round(ledger.reduce((a, x) => a + num(x.amountUsd, 0), 0), 4),
          marca: { score: num(obj(model.brandCheck).score, 0), hallazgos: arr(obj(model.brandCheck).findings).length },
          versiones: arr(model.versions).map((v) => ({ id: v.id, label: v.label, at: v.at })),
          etapas: model.pipeline.stages,
          flujo: workflowPlan(model).map((x) => ({ orden: x.idx + 1, id: x.id, agente: x.name,
            estado: x.status, desactivado: x.disabled, bloqueado: x.blocked })),
          aspecto: { forma: currentTheme().formId, modo: currentTheme().modeId, etiqueta: currentTheme().label },
          organizacion: {
            resumen: wsWorldSummary(model.world),
            areas: arr(model.world.areas).map((a) => ({ id: a.id, nombre: a.name,
              departamento: wsDepartmentById(a.departmentId).label, estructura: a.structure,
              procesos: arr(a.stations).map((x) => x.name),
              responsable: s(a.ownerId) ? { id: a.ownerId, nombre: a.ownerName } : null,
              ocupantes: arr(model.world.staff).filter((x) => x.areaId === a.id).map((x) => x.name) })),
            personal: arr(model.world.staff).map((x) => ({ id: x.id, nombre: x.name, tipo: x.kind,
              rol: x.role, area: (arr(model.world.areas).find((a) => a.id === x.areaId) || {}).name || null,
              agente: x.agentId || null, usuarioKimos: x.userId || null, responsable: !!x.isOwner })),
            sinResponsable: wsAreasWithoutOwner(model.world),
            // Con quién se puede cumplir: los usuarios de KIMOS que el host
            // deja ver a esta persona. Si está vacío, el host no lo expone.
            usuariosKimos: arr(directory.users).map((u) => ({ id: u.id, nombre: u.name, correo: u.email })),
            directorio: directory.loaded ? (directory.error || 'ok') : 'cargando',
          },
          proveedoresDisponibles: CAPABILITIES.reduce((acc, cp) => { acc[cp.id] = providersFor(cp.id).map((x) => x.id); return acc; }, {}),
        }),
        dispatchAction: dispatch,
      });
    } catch (e) { /* host sin agente: la app funciona igual desde la UI */ }
  }
