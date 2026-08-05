
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Organización — el mapa de la empresa, editable
  //
  // La misma información que el Flujo, contada como un sitio: departamentos,
  // procesos internos y quién los atiende. En forma juego se recorre como una
  // villa, un hotel o un territorio; en forma clásica es un plano de planta.
  //
  // Lo que se ve NO es decorado: cada avatar de IA está enlazado a un agente
  // del flujo y su comportamiento sale de su estado real. Si ejecutas el
  // Storyboard Generator desde aquí, su avatar se pone a trabajar de verdad.
  // ═════════════════════════════════════════════════════════════════════════

  const KIND_LABEL = { village: 'villa', hotel: 'hotel', territory: 'territorio', plan: 'plano' };

  /** Ambientación activa: la del modo de juego, o el plano en forma clásica. */
  function worldKind(theme) {
    return theme.formId === 'game' ? (s(obj(theme.world).kind) || 'village') : 'plan';
  }

  /** «1 proceso» / «2 procesos»: contar mal se nota más que cualquier adorno. */
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  const depOptions = () => WS_DEPARTMENTS.map((d) => ({ value: d.id, label: d.emoji + '  ' + d.label }));
  const structOptions = (kind) => WS_STRUCTURES.map((x) => {
    const local = wsStructureName(x.id, kind);
    return { value: x.id, label: x.emoji + '  ' + x.label + (norm(local) === norm(x.label) ? '' : ' · ' + local) };
  });

  // ── Responsable del departamento ───────────────────────────────────────
  // Un equipo de agentes de IA sin nadie que responda por él es el problema
  // que esto evita. Y el responsable no se escribe a mano: se elige de los
  // usuarios de KIMOS, para que sea una persona de verdad con su cuenta.

  const aiIn = (areaId) => arr(model.world.staff).filter((x) => x.areaId === areaId && x.kind === 'ai').length;

  function ownerHelp(area, ai) {
    const n = ai == null ? aiIn(area.id) : ai;
    if (s(area.ownerId)) return 'Responde por este departamento' + (n ? ' y por sus ' + n + ' agente(s) de IA.' : '.');
    return n ? 'Este departamento tiene ' + n + ' agente(s) de IA y nadie que responda por ellos.'
      : 'Opcional mientras no haya agentes de IA trabajando aquí.';
  }

  function OwnerPicker(props) {
    const area = obj(props).area;
    const dir = directory;
    const opts = [{ value: '', label: '— Sin responsable —' }]
      .concat(arr(dir.users).map((u) => ({ value: u.id, label: u.name + (u.email ? '  ·  ' + u.email : '') })));
    // Si el responsable guardado ya no está en el directorio (se dio de baja,
    // o el host no responde) se conserva y se dice: perder el dato en
    // silencio sería peor que enseñarlo desactualizado.
    const known = arr(dir.users).some((u) => u.id === s(area.ownerId));
    if (s(area.ownerId) && !known) {
      opts.push({ value: s(area.ownerId), label: s(area.ownerName) + '  ·  (fuera del directorio)' });
    }
    return h('div', { className: 'ws-owner' }, [
      h(Select, { key: 's', value: s(area.ownerId), options: opts, disabled: !dir.loaded,
        onChange: (v) => {
          if (!s(v)) { applyWorld((w) => wsClearAreaOwner(w, area.id)); return; }
          const u = arr(dir.users).find((x) => x.id === s(v));
          if (!u) { notify('error', 'Ese usuario ya no está en el directorio.'); return; }
          applyWorld((w) => wsSetAreaOwner(w, area.id, u));
        } }),
      !dir.loaded ? h('span', { className: 'ws-mini', key: 'l' }, 'Cargando usuarios de KIMOS…') : null,
      dir.loaded && dir.error ? h('span', { className: 'ks-warn ws-mini', key: 'e' }, dir.error) : null,
    ]);
  }

  /** Aviso de departamentos con agentes de IA y sin nadie al mando. */
  function OwnerGaps() {
    const gaps = wsAreasWithoutOwner(model.world);
    if (!gaps.length) return null;
    return h(Card, { className: 'ws-gaps', title: 'Departamentos sin responsable',
      actions: [h(Chip, { key: 'n', tone: 'bad' }, gaps.length + ' de ' + arr(model.world.areas).length)] }, [
      h('p', { className: 'ks-lead', key: 'p' },
        'Estos departamentos tienen agentes de IA trabajando y ninguna persona que responda por ellos. '
        + 'El responsable se elige entre los usuarios de KIMOS.'),
      h('div', { className: 'ks-list ws-list', key: 'l' }, gaps.map((g) => h('button', {
        key: g.id, type: 'button', className: 'ws-row',
        onClick: () => setUi({ worldArea: g.id, worldStaff: null, worldTab: 'areas' }),
      }, [
        h('span', { className: 'ws-row-dot', key: 'd', style: { background: 'var(--ks-bad)' } }),
        h('span', { className: 'ws-row-body', key: 'b' }, [
          h('strong', { key: 'n' }, g.name),
          h('span', { key: 'm' }, plural(g.agentes, 'agente de IA sin responsable', 'agentes de IA sin responsable')),
        ]),
        h('span', { className: 'ws-row-tag', key: 't' }, 'Asignar'),
      ]))),
    ]);
  }

  // ── Detalle de un área ─────────────────────────────────────────────────
  function AreaEditor(props) {
    const p = obj(props);
    const a = p.area;
    const kind = p.kind;
    const [stationName, setStationName] = useState('');
    const dep = wsDepartmentById(a.departmentId);
    const staffHere = arr(model.world.staff).filter((x) => x.areaId === a.id);

    const upd = (patchArea) => applyWorld((w) => wsUpdateArea(w, a.id, patchArea), { quiet: true });

    return h('div', { key: a.id }, [
      h('div', { className: 'ks-form ws-form', key: 'f' }, [
        h(Field, { key: 'n', label: 'Nombre' },
          h(TextInput, { value: a.name, onChange: (v) => upd({ name: v }) })),
        h(Field, { key: 'd', label: 'Departamento' },
          h(Select, { value: a.departmentId, options: depOptions(), onChange: (v) => upd({ departmentId: v }) })),
        h(Field, { key: 'own', label: 'Responsable', wide: true, help: ownerHelp(a) },
          h(OwnerPicker, { area: a })),
        h(Field, { key: 's', label: 'Estructura',
          help: norm(wsStructureName(a.structure, kind)) === norm(wsStructureById(a.structure).label)
            ? '' : 'Aquí se ve como «' + wsStructureName(a.structure, kind) + '».' },
          h(Select, { value: a.structure, options: structOptions(kind), onChange: (v) => upd({ structure: v }) })),
        h(Field, { key: 'w', label: 'Ancho (celdas)' },
          h(TextInput, { type: 'number', min: 1, max: 8, value: a.w, onChange: (v) => upd({ w: v }) })),
        h(Field, { key: 'h', label: 'Alto (celdas)' },
          h(TextInput, { type: 'number', min: 1, max: 8, value: a.h, onChange: (v) => upd({ h: v }) })),
        h(Field, { key: 'x', label: 'Posición X' },
          h(TextInput, { type: 'number', min: 0, value: a.x, onChange: (v) => upd({ x: v }) })),
        h(Field, { key: 'y', label: 'Posición Y' },
          h(TextInput, { type: 'number', min: 0, value: a.y, onChange: (v) => upd({ y: v }) })),
      ]),
      h(Field, { key: 'note', label: 'Nota', wide: true },
        h(TextArea, { value: a.note, rows: 2, placeholder: 'Para qué sirve este departamento',
          onChange: (v) => upd({ note: v }) })),

      h('h4', { className: 'ws-subhead', key: 'sth' }, 'Procesos internos'),
      h('p', { className: 'ws-mini', key: 'sthx' },
        'Cada puesto es un proceso del departamento. El personal se reparte entre ellos, y ahí es donde se le ve trabajar.'),
      h('div', { className: 'ks-list ws-list ws-sub', key: 'st' }, arr(a.stations).map((st) => h('div', {
        key: st.id, className: 'ws-row',
      }, [
        h('span', { className: 'ws-row-dot', key: 'd', style: { background: dep.color } }),
        h('div', { className: 'ws-row-body', key: 'b' }, [
          h(TextInput, { key: 'n', value: st.name,
            onChange: (v) => applyWorld((w) => wsUpdateStation(w, a.id, st.id, { name: v }), { quiet: true }) }),
          h(TextInput, { key: 'p', value: st.process, placeholder: 'Qué se hace en este puesto',
            onChange: (v) => applyWorld((w) => wsUpdateStation(w, a.id, st.id, { process: v }), { quiet: true }) }),
        ]),
        h(Btn, { key: 'x', size: 'xs', variant: 'ghost', title: 'Eliminar puesto',
          onClick: () => applyWorld((w) => wsRemoveStation(w, a.id, st.id)) }, '✕'),
      ]))),
      h('div', { className: 'ws-actions', key: 'sta' }, [
        h(TextInput, { key: 'i', value: stationName, placeholder: 'Nombre del nuevo puesto',
          onChange: setStationName }),
        h(Btn, { key: 'b', size: 'sm', onClick: () => {
          if (applyWorld((w) => wsAddStation(w, a.id, { name: stationName }))) setStationName('');
        } }, 'Añadir puesto'),
      ]),

      h('p', { className: 'ws-mini', key: 'who' }, staffHere.length
        ? 'Aquí trabajan ' + staffHere.map((x) => x.name).join(', ') + '.'
        : 'Todavía no hay nadie asignado a esta área.'),

      h('div', { className: 'ws-actions', key: 'del' }, [
        h(Btn, { key: 'd', size: 'sm', variant: 'danger',
          onClick: () => { if (applyWorld((w) => wsRemoveArea(w, a.id))) setUi({ worldArea: null }); } },
          'Eliminar área'),
      ]),
    ]);
  }

  // ── Detalle de una persona o agente ────────────────────────────────────
  function StaffEditor(props) {
    const p = obj(props);
    const person = p.person;
    const world = model.world;
    const area = arr(world.areas).find((x) => x.id === person.areaId) || null;
    const node = person.agentId ? arr(p.plan).find((x) => x.id === person.agentId) : null;
    const upd = (q) => applyWorld((w) => wsUpdateStaff(w, person.id, q), { quiet: true });

    return h('div', { key: person.id }, [
      h('div', { className: 'ks-form ws-form', key: 'f' }, [
        h(Field, { key: 'n', label: 'Nombre' },
          h(TextInput, { value: person.name, disabled: !!node, onChange: (v) => upd({ name: v }) })),
        h(Field, { key: 'r', label: 'Puesto o rol' },
          h(TextInput, { value: person.role, onChange: (v) => upd({ role: v }) })),
        h(Field, { key: 'k', label: 'Tipo', help: node ? 'Enlazado a un agente del flujo: no puede pasar a persona.' : '' },
          h(Select, { value: person.kind, disabled: !!node,
            options: [{ value: 'human', label: '🧑 Persona' }, { value: 'ai', label: '🤖 Agente de IA' }],
            onChange: (v) => upd({ kind: v }) })),
        h(Field, { key: 'a', label: 'Área' },
          h(Select, { value: person.areaId, options: arr(world.areas).map((x) => ({ value: x.id, label: x.name })),
            onChange: (v) => upd({ areaId: v }) })),
        area ? h(Field, { key: 's', label: 'Puesto' },
          h(Select, { value: person.stationId, options: arr(area.stations).map((x) => ({ value: x.id, label: x.name })),
            onChange: (v) => upd({ stationId: v }) })) : null,
      ]),
      node ? h('div', { className: 'ks-kv ks-kv-sm', key: 'ag' }, [
        h('div', { key: '1' }, [h('span', { key: 'a' }, 'Agente del flujo'),
          h('strong', { key: 'b' }, node.emoji + ' ' + node.name)]),
        h('div', { key: '2' }, [h('span', { key: 'a' }, 'Estado ahora'),
          h('strong', { key: 'b' }, STATUS_LABEL[node.status] || node.status)]),
        h('div', { key: '3' }, [h('span', { key: 'a' }, 'Escribe'), h('strong', { key: 'b' }, node.writes || '—')]),
      ]) : null,
      node ? h('p', { className: 'ws-mini', key: 'desc' }, node.description) : null,
      // Quién responde por esta persona o por este agente. Para un agente de
      // IA es lo primero que hay que poder contestar.
      area ? h('p', { key: 'own', className: s(area.ownerId) ? 'ws-mini ws-owned' : 'ws-mini ws-orphan' },
        person.isOwner ? '★ Responde por «' + area.name + '»' + (aiIn(area.id) ? ' y por sus ' + aiIn(area.id) + ' agente(s) de IA.' : '.')
          : s(area.ownerId) ? '★ Responsable de «' + area.name + '»: ' + s(area.ownerName)
            : '⚠ «' + area.name + '» no tiene responsable asignado.') : null,
      area && !s(area.ownerId) ? h(Btn, { key: 'goa', size: 'sm', variant: 'ghost',
        onClick: () => setUi({ worldArea: area.id, worldStaff: null, worldTab: 'areas' }) },
        'Asignar responsable') : null,
      h('div', { className: 'ws-actions', key: 'a' }, [
        node ? h(Btn, { key: 'r', size: 'sm', variant: 'primary', disabled: node.disabled || node.blocked,
          onClick: () => runStages([node.id], node.name) }, 'Ponerle a trabajar') : null,
        node ? h(Btn, { key: 'f', size: 'sm', onClick: () => setUi({ view: 'flow', flowSel: node.id }) },
          'Ver en el flujo') : null,
        h(Btn, { key: 'd', size: 'sm', variant: 'danger', disabled: !!node,
          title: node ? 'Los agentes del flujo no se dan de baja aquí: desactívalos en el Flujo.' : '',
          onClick: () => { if (applyWorld((w) => wsRemoveStaff(w, person.id))) setUi({ worldStaff: null }); } },
          'Dar de baja'),
      ].filter(Boolean)),
    ]);
  }

  // ── Alta de áreas y de personal ────────────────────────────────────────
  function AreaCreator(props) {
    const kind = obj(props).kind;
    const [dep, setDep] = useState('rrhh');
    const [name, setName] = useState('');
    const [struct, setStruct] = useState('office');
    return h('div', { className: 'ws-form', key: 'new' }, [
      h(Field, { key: 'd', label: 'Departamento' },
        h(Select, { value: dep, options: depOptions(), onChange: setDep })),
      h(Field, { key: 'n', label: 'Nombre', help: 'Vacío = el del departamento.' },
        h(TextInput, { value: name, placeholder: wsDepartmentById(dep).label, onChange: setName })),
      h(Field, { key: 's', label: 'Estructura' },
        h(Select, { value: struct, options: structOptions(kind), onChange: setStruct })),
      h(Field, { key: 'b', label: ' ' },
        h(Btn, { variant: 'primary', size: 'sm', onClick: () => {
          const before = arr(model.world.areas).map((x) => x.id);
          if (applyWorld((w) => wsAddArea(w, { departmentId: dep, name, structure: struct }))) {
            const added = arr(model.world.areas).find((x) => before.indexOf(x.id) < 0);
            setName('');
            if (added) setUi({ worldTab: 'areas', worldArea: added.id, worldStaff: null });
          }
        } }, 'Añadir área')),
    ]);
  }

  function StaffCreator() {
    const world = model.world;
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [areaId, setAreaId] = useState('');
    const area = arr(world.areas).find((x) => x.id === areaId) || arr(world.areas)[0] || null;
    return h('div', { className: 'ws-form', key: 'new' }, [
      h(Field, { key: 'n', label: 'Nombre' },
        h(TextInput, { value: name, placeholder: 'Quién se incorpora', onChange: setName })),
      h(Field, { key: 'r', label: 'Puesto o rol' },
        h(TextInput, { value: role, placeholder: 'Diseñador, becaria, contable…', onChange: setRole })),
      h(Field, { key: 'a', label: 'Área' },
        h(Select, { value: area ? area.id : '', options: arr(world.areas).map((x) => ({ value: x.id, label: x.name })),
          onChange: setAreaId })),
      h(Field, { key: 'b', label: ' ' },
        h(Btn, { variant: 'primary', size: 'sm', disabled: !arr(world.areas).length, onClick: () => {
          if (!s(name).trim()) { notify('error', 'Ponle un nombre a la persona.'); return; }
          if (applyWorld((w) => wsAddStaff(w, { name, role, kind: 'human', areaId: area ? area.id : '' }))) {
            setName(''); setRole('');
          }
        } }, 'Incorporar persona')),
    ]);
  }

  // ── Vista ──────────────────────────────────────────────────────────────
  function WorldView() {
    const theme = currentTheme();
    const kind = worldKind(theme);
    const world = model.world;
    const sum = wsWorldSummary(world);
    const plan = workflowPlan(model);

    // Un mapa de estados por agente, calculado UNA vez por repintado: la
    // simulación pregunta por cada avatar y en cada fotograma.
    const statusMap = {};
    for (const n of plan) statusMap[n.id] = n.status;
    const statusOf = (agentId) => statusMap[s(agentId)] || '';

    const selArea = arr(world.areas).find((x) => x.id === ui.worldArea) || null;
    const selStaff = arr(world.staff).find((x) => x.id === ui.worldStaff) || null;
    const tab = ui.worldTab === 'staff' ? 'staff' : 'areas';

    const depsPresent = uniq(arr(world.areas).map((a) => a.departmentId)).map(wsDepartmentById);

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Organización',
        subtitle: plural(sum.areas, 'área', 'áreas') + ' · ' + plural(sum.puestos, 'proceso', 'procesos')
          + ' · ' + plural(sum.agentes, 'agente de IA', 'agentes de IA')
          + ' · ' + plural(sum.personas, 'persona', 'personas')
          + ' · ' + sum.conResponsable + '/' + sum.areas + ' con responsable'
          + ' · mapa ' + sum.mapa + ' · ' + (KIND_LABEL[kind] || kind),
        actions: [
          h(Btn, { key: 'f', size: 'sm', onClick: () => setUi({ view: 'flow' }) }, 'Ir al flujo'),
          h(Btn, { key: 'r', size: 'sm', variant: 'primary',
            onClick: () => runStages(null, 'Pipeline') }, 'Ejecutar flujo'),
        ] }),

      h(Card, { key: 'sk', title: 'Aspecto' }, [
        h(SkinPicker, { key: 'p' }),
        h('p', { className: 'ks-hint', key: 'n' }, theme.formId === 'game'
          ? skinHint(theme)
          : 'En forma clásica la organización se ve como un plano de planta. Cambia a forma Juego para recorrerla.'),
      ]),

      h('div', { className: 'ws-stage', key: 'stage' }, [
        h('div', { className: 'ws-scroll', key: 's' }, arr(world.areas).length
          ? h(WsWorldSurface, {
            world, kind, statusOf,
            selArea: ui.worldArea, selStaff: ui.worldStaff,
            onSelectArea: (id) => setUi({ worldArea: id, worldStaff: null, worldTab: 'areas' }),
            onSelectStaff: (id) => setUi({ worldStaff: id, worldArea: null, worldTab: 'staff' }),
          })
          : h(Empty, { icon: '🗺️', text: 'El mapa está vacío. Añade un área o vuelve a sembrarlo desde el flujo.' })),
        h('div', { className: 'ws-legend', key: 'l' }, [
          h('span', { key: 'ai' }, [h('i', { key: 'd', style: { background: '#4ECDC4' } }), 'Agente de IA']),
          h('span', { key: 'hu' }, [h('i', { key: 'd', style: { background: '#C9A227' } }), 'Persona']),
        ].concat(depsPresent.map((d) => h('span', { key: d.id },
          [h('i', { key: 'd', style: { background: d.color } }), d.label])))),
      ]),

      h(OwnerGaps, { key: 'gaps' }),

      h('div', { className: 'ws-cols', key: 'cols' }, [
        h(Card, { key: 'list', title: 'Qué hay en el mapa', flush: false }, [
          h('div', { className: 'ws-tabs', key: 't' }, [
            h('button', { key: 'a', type: 'button', className: cx('ws-tab', tab === 'areas' && 'ws-tab-on'),
              onClick: () => setUi({ worldTab: 'areas' }) }, 'Áreas · ' + sum.areas),
            h('button', { key: 's', type: 'button', className: cx('ws-tab', tab === 'staff' && 'ws-tab-on'),
              onClick: () => setUi({ worldTab: 'staff' }) }, 'Personal · ' + (sum.agentes + sum.personas)),
          ]),
          tab === 'areas'
            ? h('div', { className: 'ks-list ws-list', key: 'la' }, arr(world.areas).map((a) => {
              const dep = wsDepartmentById(a.departmentId);
              const here = arr(world.staff).filter((x) => x.areaId === a.id).length;
              const ai = aiIn(a.id);
              const orphan = !s(a.ownerId) && ai > 0;
              return h('button', {
                key: a.id, type: 'button', className: cx('ws-row', ui.worldArea === a.id && 'ws-row-on'),
                onClick: () => setUi({ worldArea: a.id, worldStaff: null }),
              }, [
                h('span', { className: 'ws-row-dot', key: 'd', style: { background: dep.color } }),
                h('span', { className: 'ws-row-body', key: 'b' }, [
                  h('strong', { key: 'n' }, a.name),
                  h('span', { key: 'm' }, wsStructureName(a.structure, kind) + ' · '
                    + plural(arr(a.stations).length, 'proceso', 'procesos') + ' · '
                    + plural(here, 'ocupante', 'ocupantes')),
                  // Un área sin agentes tampoco necesita responsable: decir
                  // «sin responsable» en todas convertiría el aviso en ruido.
                  s(a.ownerId) || orphan
                    ? h('span', { key: 'o', className: orphan ? 'ws-orphan' : 'ws-owned' },
                      orphan ? '⚠ sin responsable' : '★ ' + s(a.ownerName))
                    : null,
                ]),
                h('span', { className: 'ws-row-tag', key: 't' }, a.w + '×' + a.h),
              ]);
            }))
            : h('div', { className: 'ks-list ws-list', key: 'ls' }, arr(world.staff).map((x) => {
              const area = arr(world.areas).find((y) => y.id === x.areaId);
              const st = area ? arr(area.stations).find((y) => y.id === x.stationId) : null;
              const status = x.agentId ? statusOf(x.agentId) : '';
              return h('button', {
                key: x.id, type: 'button', className: cx('ws-row', ui.worldStaff === x.id && 'ws-row-on'),
                onClick: () => setUi({ worldStaff: x.id, worldArea: null }),
              }, [
                h('span', { className: 'ws-row-dot', key: 'd',
                  style: { background: x.kind === 'ai' ? '#4ECDC4' : '#C9A227' } }),
                h('span', { className: 'ws-row-body', key: 'b' }, [
                  h('strong', { key: 'n' }, (x.kind === 'ai' ? '🤖 ' : '🧑 ') + x.name),
                  h('span', { key: 'm' }, (x.role || '—') + ' · ' + (area ? area.name : 'sin área')
                    + (st ? ' · ' + st.name : '')),
                ]),
                status ? h('span', { className: 'ws-row-tag', key: 't' }, STATUS_LABEL[status] || status) : null,
              ]);
            })),
          h('h4', { className: 'ws-subhead', key: 'nh' }, tab === 'areas' ? 'Nueva área' : 'Nueva persona'),
          tab === 'areas' ? h(AreaCreator, { key: 'nc', kind }) : h(StaffCreator, { key: 'nc' }),
        ]),

        h(Card, { key: 'det', title: selArea ? 'Área seleccionada' : selStaff ? 'Ficha' : 'Detalle' },
          selArea ? h(AreaEditor, { area: selArea, kind })
            : selStaff ? h(StaffEditor, { person: selStaff, plan })
              : h('p', { className: 'ks-hint' },
                'Pincha una estructura o un avatar del mapa —o una fila de la lista— para editarlo.')),
      ]),

      h(Card, { key: 'map', title: 'Terreno' }, [
        h('div', { className: 'ws-form', key: 'f' }, [
          h(Field, { key: 'w', label: 'Ancho del mapa' },
            h(TextInput, { type: 'number', min: 6, max: 40, value: obj(world.grid).w,
              onChange: (v) => applyWorld((w) => wsResizeGrid(w, v, obj(model.world.grid).h)) })),
          h(Field, { key: 'h', label: 'Alto del mapa' },
            h(TextInput, { type: 'number', min: 6, max: 40, value: obj(world.grid).h,
              onChange: (v) => applyWorld((w) => wsResizeGrid(w, obj(model.world.grid).w, v)) })),
          h(Field, { key: 'r', label: ' ', help: 'Rehace el mapa desde los agentes del flujo. Se pierde lo que hayas editado.' },
            h(Btn, { size: 'sm', onClick: () => {
              patch((m) => { m.world = seedOrgWorld(m); logLine(m, 'info', 'Organización · mapa sembrado de nuevo.'); });
              setUi({ worldArea: null, worldStaff: null });
              notify('success', 'Mapa sembrado de nuevo desde el flujo.');
            } }, 'Sembrar de nuevo')),
        ]),
        h('p', { className: 'ks-hint', key: 'n' },
          'El mapa no se puede encoger por encima de un área ocupada: primero muévela o bórrala.'),
      ]),

      h(Card, { key: 'help', title: 'Cómo se relaciona esto con el trabajo real' }, [
        h('ul', { className: 'ks-list', key: 'l' }, [
          'Cada avatar de IA es un agente del flujo. Su comportamiento sale de su estado real: si se está ejecutando, camina a su puesto y trabaja; si está bloqueado, se planta con un «!»; si lo desactivas, se va a la zona común.',
          'Las personas son tuyas: añádelas, cámbialas de área y repártelas entre procesos. Nadie las ejecuta ni las simula como agentes; están para que se vea quién acompaña a cada máquina.',
          'Cada departamento con agentes de IA tiene que tener una persona responsable, y esa persona es un usuario de KIMOS: se elige del directorio de la organización, no se escribe a mano. Su avatar lleva una estrella y el mapa marca en rojo los departamentos que se han quedado sin nadie al mando.',
          'Las áreas son departamentos y sus puestos son los procesos internos. Son los mismos datos en las cuatro ambientaciones: cambiar de villa a hotel o a territorio no mueve una sola celda.',
          'El movimiento se pausa cuando la ventana no está a la vista, y no arranca si tu sistema pide menos animación.',
        ].map((x, i) => h('li', { key: i }, x))),
      ]),
    ]);
  }
