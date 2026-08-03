
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Flujo de agentes — visible y editable, en dos formas
  //
  // Un único modelo (workflowPlan) y cuatro presentaciones. Las acciones son
  // las mismas en todas: seleccionar, ejecutar, apagar/encender y reordenar.
  // Cambiar de forma no cambia lo que puedes hacer, solo cómo se ve.
  // ═════════════════════════════════════════════════════════════════════════

  /** Acciones del flujo, compartidas por los cuatro renderizadores. */
  function flowActions() {
    return {
      select: (id) => setUi({ flowSel: id }),
      run: (id) => { const a = agentById(id); if (a) runStages([id], a.name); },
      toggle: (id) => {
        patch((m) => {
          const off = arr(m.settings.workflow.disabled);
          m.settings.workflow.disabled = off.indexOf(id) >= 0 ? off.filter((x) => x !== id) : off.concat([id]);
          logLine(m, 'info', 'Agente «' + (agentById(id) || {}).name + '» '
            + (off.indexOf(id) >= 0 ? 'reactivado' : 'desactivado') + ' en el flujo.');
        });
      },
      move: (id, dir) => {
        patch((m) => {
          const cur = effectiveOrder(m).slice();
          const i = cur.indexOf(id);
          const j = i + (dir < 0 ? -1 : 1);
          if (i < 0 || j < 0 || j >= cur.length) return;
          cur.splice(j, 0, cur.splice(i, 1)[0]);
          m.settings.workflow.order = cur;
        });
        // effectiveOrder corrige el orden si el movimiento rompía una
        // dependencia; se avisa para que no parezca que el botón no hizo nada.
        const after = effectiveOrder(model);
        const wanted = arr(model.settings.workflow.order);
        if (wanted.join('|') !== after.join('|')) {
          patch((m) => { m.settings.workflow.order = after; });
          notify('info', 'Ese orden rompía una dependencia; se ha colocado en la posición válida más cercana.');
        }
      },
      reset: () => {
        patch((m) => { m.settings.workflow = { order: [], disabled: [] }; });
        notify('success', 'Flujo restablecido al orden de fábrica.');
      },
    };
  }

  // ── Sprites (SVG con rejilla de píxeles; nada externo, ni una imagen) ───
  const pxRect = (x, y, w, hh, fill, key) => h('rect', { key, x, y, width: w, height: hh, fill });

  /** Laboratorio en píxeles: cuerpo, tejado, puerta y ventana. */
  function LabSprite(props) {
    const p = obj(props);
    const on = p.status === 'done';
    const wall = p.off ? '#9AA0A0' : on ? '#F0F0E0' : '#D8D8C8';
    const roof = p.off ? '#6A7070' : on ? '#D83830' : '#A85850';
    const glass = p.off ? '#586060' : on ? '#68C8F8' : '#3868A8';
    return h('svg', { className: 'ks-sprite', viewBox: '0 0 16 16', width: p.size || 48, height: p.size || 48,
      style: { shapeRendering: 'crispEdges' }, 'aria-hidden': 'true' }, [
      pxRect(2, 6, 12, 9, wall, 'w'),
      pxRect(1, 4, 14, 2, roof, 'r'),
      pxRect(3, 3, 10, 1, roof, 'r2'),
      pxRect(4, 8, 3, 3, glass, 'g1'),
      pxRect(9, 8, 3, 3, glass, 'g2'),
      pxRect(7, 11, 2, 4, p.off ? '#4A5050' : '#785840', 'd'),
      pxRect(0, 15, 16, 1, '#3A6048', 'ground'),
    ]);
  }

  /** Mueble isométrico: tapa, frente y lateral. */
  function FurniSprite(props) {
    const p = obj(props);
    const on = p.status === 'done';
    const top = p.off ? '#5B6B7B' : on ? '#7ADFA0' : '#8FB4D8';
    const front = p.off ? '#3E4C5A' : on ? '#4CB075' : '#5D82A6';
    const side = p.off ? '#32404C' : on ? '#3B8C5E' : '#476A8A';
    return h('svg', { className: 'ks-sprite', viewBox: '0 0 32 28', width: p.size || 56, height: (p.size || 56) * 0.875,
      'aria-hidden': 'true' }, [
      h('polygon', { key: 't', points: '16,2 31,10 16,18 1,10', fill: top }),
      h('polygon', { key: 'l', points: '1,10 16,18 16,26 1,18', fill: side }),
      h('polygon', { key: 'r', points: '31,10 16,18 16,26 31,18', fill: front }),
    ]);
  }

  /** Nodo de mando: hexágono con núcleo. */
  function CraftSprite(props) {
    const p = obj(props);
    const on = p.status === 'done';
    const ring = p.off ? '#33564C' : on ? '#4BE3A0' : '#2C554B';
    const core = p.off ? '#16241F' : on ? '#0E4433' : '#122A24';
    return h('svg', { className: 'ks-sprite', viewBox: '0 0 32 32', width: p.size || 50, height: p.size || 50,
      'aria-hidden': 'true' }, [
      h('polygon', { key: 'h', points: '16,2 29,9 29,23 16,30 3,23 3,9', fill: core, stroke: ring, strokeWidth: 2 }),
      h('polygon', { key: 'i', points: '16,9 23,13 23,20 16,24 9,20 9,13', fill: ring, opacity: on ? 0.9 : 0.35 }),
    ]);
  }

  const STATUS_LABEL = { done: 'completado', error: 'con error', skipped: 'saltado', blocked: 'bloqueado',
    off: 'desactivado', idle: 'sin ejecutar' };

  // ── Inspector común ────────────────────────────────────────────────────
  function FlowInspector(props) {
    const p = obj(props);
    const node = p.node;
    const act = p.actions;
    if (!node) return h('div', { className: 'ks-flow-inspector' },
      h('p', { className: 'ks-hint' }, 'Elige un agente para ver qué hace y actuar sobre él.'));
    const deps = arr(node.deps).map((d) => (agentById(d) || {}).name).filter(Boolean);
    return h('div', { className: 'ks-flow-inspector' }, [
      h('div', { className: 'ks-flow-insp-head', key: 'h' }, [
        h('span', { className: 'ks-flow-insp-emoji', key: 'e' }, node.emoji),
        h('div', { key: 'n' }, [
          h('strong', { key: 'a' }, 'Agente ' + node.n + ' · ' + node.name),
          h('span', { className: 'ks-flow-insp-status', key: 'b' }, STATUS_LABEL[node.status] || node.status),
        ]),
      ]),
      h('p', { className: 'ks-flow-insp-desc', key: 'd' }, node.description),
      h('div', { className: 'ks-kv ks-kv-sm', key: 'k' }, [
        h('div', { key: '1' }, [h('span', { key: 'a' }, 'Escribe'), h('strong', { key: 'b' }, node.writes || '—')]),
        h('div', { key: '2' }, [h('span', { key: 'a' }, 'Depende de'), h('strong', { key: 'b' }, deps.length ? deps.join(', ') : 'nada')]),
        h('div', { key: '3' }, [h('span', { key: 'a' }, 'Último tiempo'), h('strong', { key: 'b' }, node.ms ? node.ms + ' ms' : '—')]),
      ]),
      node.error ? h('p', { className: 'ks-warn', key: 'e' }, node.error) : null,
      h('div', { className: 'ks-flow-insp-actions', key: 'a' }, [
        h(Btn, { key: 'r', size: 'sm', variant: 'primary', disabled: node.disabled || node.blocked,
          onClick: () => act.run(node.id) }, 'Ejecutar'),
        h(Btn, { key: 't', size: 'sm', onClick: () => act.toggle(node.id) },
          node.disabled ? 'Activar' : 'Desactivar'),
        h(Btn, { key: 'u', size: 'sm', variant: 'ghost', onClick: () => act.move(node.id, -1) }, '↑'),
        h(Btn, { key: 'd', size: 'sm', variant: 'ghost', onClick: () => act.move(node.id, 1) }, '↓'),
      ]),
    ]);
  }

  // ── 1. Clásica: grafo de dependencias ──────────────────────────────────
  function FlowClassic(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    return h('div', { className: 'ks-flow-classic' }, plan.map((n, i) => h('div', {
      key: n.id, className: cx('ks-flownode', 'ks-fs-' + n.status, p.sel === n.id && 'ks-flownode-sel'),
      onClick: () => act.select(n.id),
    }, [
      i > 0 ? h('span', { className: 'ks-flowlink', key: 'l' }) : null,
      h('span', { className: 'ks-flownode-idx', key: 'x' }, i + 1),
      h('span', { className: 'ks-flownode-emoji', key: 'e' }, n.emoji),
      h('div', { className: 'ks-flownode-body', key: 'b' }, [
        h('strong', { key: 'n' }, n.name),
        h('span', { className: 'ks-flownode-meta', key: 'm' },
          (arr(n.deps).length ? '← ' + arr(n.deps).map((d) => (agentById(d) || {}).name).join(', ') : 'sin dependencias')
          + (n.ms ? ' · ' + n.ms + ' ms' : '')),
      ]),
      h('span', { className: cx('ks-flowdot', 'ks-fd-' + n.status), key: 'd', title: STATUS_LABEL[n.status] }),
    ])));
  }

  // ── 2. KimosLab: ruta en píxeles con caja de diálogo ───────────────────
  function FlowKimosLab(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    const sel = plan.find((x) => x.id === p.sel) || plan[0];
    const done = plan.filter((x) => x.status === 'done').length;
    return h('div', { className: 'ks-lab' }, [
      h('div', { className: 'ks-lab-hud', key: 'h' }, [
        h('span', { key: 'a' }, '★ ' + done + '/' + plan.length + ' medallas'),
        h('span', { key: 'b' }, 'Ruta de producción'),
      ]),
      h('div', { className: 'ks-lab-route', key: 'r' }, plan.map((n, i) => h('button', {
        key: n.id, type: 'button',
        className: cx('ks-lab-stop', p.sel === n.id && 'ks-lab-stop-sel', n.disabled && 'ks-lab-off'),
        onClick: () => act.select(n.id),
      }, [
        h(LabSprite, { key: 's', status: n.status, off: n.disabled, size: 44 }),
        h('span', { className: 'ks-lab-name', key: 'n' }, n.name),
        n.status === 'done' ? h('span', { className: 'ks-lab-badge', key: 'b' }, '★') : null,
        i < plan.length - 1 ? h('span', { className: 'ks-lab-path', key: 'p' }) : null,
      ]))),
      sel ? h('div', { className: 'ks-lab-dialog', key: 'd' }, [
        h('p', { key: 't' }, [
          h('b', { key: 'n' }, sel.name.toUpperCase() + ': '),
          sel.disabled ? 'Está descansando. No participa en la ruta.'
            : sel.blocked ? 'No puede salir: necesita a ' + arr(sel.deps).map((d) => (agentById(d) || {}).name).join(', ') + '.'
              : sel.status === 'done' ? '¡Listo! ' + sel.description
                : sel.description,
        ]),
        h('div', { className: 'ks-lab-cmds', key: 'c' }, [
          h('button', { key: 'r', type: 'button', className: 'ks-lab-cmd', disabled: sel.disabled || sel.blocked,
            onClick: () => act.run(sel.id) }, '▶ EJECUTAR'),
          h('button', { key: 't', type: 'button', className: 'ks-lab-cmd', onClick: () => act.toggle(sel.id) },
            sel.disabled ? '✚ ACTIVAR' : '✖ DESCANSAR'),
          h('button', { key: 'u', type: 'button', className: 'ks-lab-cmd', onClick: () => act.move(sel.id, -1) }, '↑'),
          h('button', { key: 'd', type: 'button', className: 'ks-lab-cmd', onClick: () => act.move(sel.id, 1) }, '↓'),
        ]),
      ]) : null,
    ]);
  }

  // ── 3. JABOTEL: sala isométrica ────────────────────────────────────────
  function FlowJabotel(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    const sel = plan.find((x) => x.id === p.sel) || null;
    const COLS = 4;
    const TW = 96; const TH = 48;                      // ancho y alto de baldosa
    const rows = Math.ceil(plan.length / COLS);
    const W = (COLS + rows) * (TW / 2) + 40;
    const H = (COLS + rows) * (TH / 2) + 130;
    const isoX = (cx0, cy) => (cx0 - cy) * (TW / 2) + W / 2;
    const isoY = (cx0, cy) => (cx0 + cy) * (TH / 2) + 30;
    const tiles = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        tiles.push(h('polygon', {
          key: 't' + i, className: 'ks-jab-tile',
          points: [
            [isoX(x, y), isoY(x, y) - TH / 2], [isoX(x, y) + TW / 2, isoY(x, y)],
            [isoX(x, y), isoY(x, y) + TH / 2], [isoX(x, y) - TW / 2, isoY(x, y)],
          ].map((q) => q.join(',')).join(' '),
          opacity: (x + y) % 2 ? 0.55 : 0.3,
        }));
      }
    }
    return h('div', { className: 'ks-jab' }, [
      h('div', { className: 'ks-jab-hud', key: 'h' }, [
        h('span', { key: 'a' }, '🏨 Sala de producción'),
        h('span', { key: 'b' }, plan.filter((x) => x.status === 'done').length + ' de ' + plan.length + ' listos'),
      ]),
      h('div', { className: 'ks-jab-room', key: 'r', style: { height: H + 'px' } }, [
        h('svg', { key: 'f', className: 'ks-jab-floor', viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H }, tiles),
        h('div', { key: 'i', className: 'ks-jab-items' }, plan.map((n, i) => {
          const x = i % COLS; const y = Math.floor(i / COLS);
          return h('button', {
            key: n.id, type: 'button',
            className: cx('ks-jab-furni', p.sel === n.id && 'ks-jab-furni-sel', n.disabled && 'ks-jab-off'),
            style: { left: (isoX(x, y) / W * 100) + '%', top: (isoY(x, y) - 34) + 'px' },
            onClick: () => act.select(n.id),
          }, [
            h(FurniSprite, { key: 's', status: n.status, off: n.disabled, size: 52 }),
            h('span', { className: 'ks-jab-plate', key: 'p' }, n.name),
          ]);
        })),
      ]),
      sel ? h('div', { className: 'ks-jab-chat', key: 'c' }, [
        h('span', { className: 'ks-jab-who', key: 'w' }, sel.emoji + ' ' + sel.name),
        h('p', { key: 't' }, sel.disabled ? 'Fuera de servicio en esta sala.'
          : sel.blocked ? 'Esperando a ' + arr(sel.deps).map((d) => (agentById(d) || {}).name).join(', ') + '.'
            : sel.description),
        h('div', { className: 'ks-jab-btns', key: 'b' }, [
          h(Btn, { key: 'r', size: 'sm', variant: 'primary', disabled: sel.disabled || sel.blocked, onClick: () => act.run(sel.id) }, 'Usar'),
          h(Btn, { key: 't', size: 'sm', onClick: () => act.toggle(sel.id) }, sel.disabled ? 'Poner' : 'Retirar'),
          h(Btn, { key: 'u', size: 'sm', variant: 'ghost', onClick: () => act.move(sel.id, -1) }, '↑'),
          h(Btn, { key: 'd', size: 'sm', variant: 'ghost', onClick: () => act.move(sel.id, 1) }, '↓'),
        ]),
      ]) : null,
    ]);
  }

  // ── 4. Spacecraft: consola de mando ────────────────────────────────────
  function FlowSpacecraft(props) {
    const p = obj(props);
    const plan = arr(p.plan);
    const act = p.actions;
    const sel = plan.find((x) => x.id === p.sel) || null;
    const done = plan.filter((x) => x.status === 'done').length;
    const pct = plan.length ? Math.round((done / plan.length) * 100) : 0;
    return h('div', { className: 'ks-craft' }, [
      h('div', { className: 'ks-craft-bar', key: 'b' }, [
        h('span', { key: 'a' }, '▮ CADENA DE MANDO'),
        h('span', { key: 'b' }, 'OPERATIVOS ' + done + '/' + plan.length),
        h('span', { key: 'c' }, 'INTEGRIDAD ' + pct + '%'),
      ]),
      h('div', { className: 'ks-craft-grid', key: 'g' }, [
        h('div', { className: 'ks-craft-queue', key: 'q' }, [
          h('span', { className: 'ks-craft-title', key: 't' }, 'COLA DE CONSTRUCCIÓN'),
          h('div', { className: 'ks-craft-items', key: 'i' }, plan.map((n, i) => h('button', {
            key: n.id, type: 'button',
            className: cx('ks-craft-item', p.sel === n.id && 'ks-craft-item-sel', 'ks-cs-' + n.status),
            onClick: () => act.select(n.id),
          }, [
            h('span', { className: 'ks-craft-num', key: 'n' }, String(i + 1).padStart(2, '0')),
            h(CraftSprite, { key: 's', status: n.status, off: n.disabled, size: 26 }),
            h('span', { className: 'ks-craft-name', key: 'l' }, n.name),
            h('span', { className: 'ks-craft-state', key: 'x' },
              n.disabled ? 'OFF' : n.blocked ? 'HOLD' : n.status === 'done' ? 'OK' : n.status === 'error' ? 'ERR' : '···'),
          ]))),
        ]),
        h('div', { className: 'ks-craft-panel', key: 'p' }, sel ? [
          h('span', { className: 'ks-craft-title', key: 't' }, 'UNIDAD SELECCIONADA'),
          h('div', { className: 'ks-craft-unit', key: 'u' }, [
            h(CraftSprite, { key: 's', status: sel.status, off: sel.disabled, size: 76 }),
            h('div', { key: 'd' }, [
              h('strong', { key: 'n' }, sel.name.toUpperCase()),
              h('p', { key: 'x' }, sel.description),
            ]),
          ]),
          h('div', { className: 'ks-craft-stats', key: 'st' }, [
            h('span', { key: '1' }, 'REQUISITOS: ' + (arr(sel.deps).length
              ? arr(sel.deps).map((d) => (agentById(d) || {}).name).join(' · ').toUpperCase() : 'NINGUNO')),
            h('span', { key: '2' }, 'ESTADO: ' + (STATUS_LABEL[sel.status] || sel.status).toUpperCase()),
            h('span', { key: '3' }, 'CICLO: ' + (sel.ms ? sel.ms + ' MS' : '—')),
          ]),
          h('div', { className: 'ks-craft-cmds', key: 'c' }, [
            h('button', { key: 'r', type: 'button', className: 'ks-craft-cmd', disabled: sel.disabled || sel.blocked,
              onClick: () => act.run(sel.id) }, 'EJECUTAR'),
            h('button', { key: 't', type: 'button', className: 'ks-craft-cmd', onClick: () => act.toggle(sel.id) },
              sel.disabled ? 'ACTIVAR' : 'DESACTIVAR'),
            h('button', { key: 'u', type: 'button', className: 'ks-craft-cmd', onClick: () => act.move(sel.id, -1) }, '▲'),
            h('button', { key: 'd', type: 'button', className: 'ks-craft-cmd', onClick: () => act.move(sel.id, 1) }, '▼'),
          ]),
        ] : h('p', { className: 'ks-hint' }, 'Sin unidad seleccionada.')),
      ]),
    ]);
  }

  const GAME_RENDERERS = { kimoslab: FlowKimosLab, jabotel: FlowJabotel, spacecraft: FlowSpacecraft };

  // ── Selector de forma y modo ───────────────────────────────────────────
  // Vive aquí porque nació con el Flujo, pero lo usan dos vistas: el aspecto es
  // de la app entera, no de una pantalla. Cambiarlo desde cualquiera de las dos
  // afecta a las dos, porque escribe en el mismo sitio (`settings.theme`).
  function SkinPicker() {
    const theme = currentTheme();
    const setTheme = (patchTheme) => patch((m) => { m.settings.theme = Object.assign({}, m.settings.theme, patchTheme); });
    return h('div', { className: 'ks-skin' }, [
      h('div', { className: 'ks-skin-row', key: 'forms' }, THEME_FORMS.map((f) => h('button', {
        key: f.id, type: 'button', className: cx('ks-skin-form', theme.formId === f.id && 'ks-skin-on'),
        onClick: () => setTheme({ form: f.id }), title: f.help,
      }, [h('span', { key: 'e' }, f.emoji), h('span', { key: 'l' }, f.label)]))),
      h('div', { className: 'ks-skin-row', key: 'modes' },
        (theme.formId === 'game' ? GAME_MODES : CLASSIC_MODES).map((m0) => h('button', {
          key: m0.id, type: 'button',
          className: cx('ks-skin-mode', (theme.formId === 'game' ? theme.modeId : model.settings.theme.classicMode) === m0.id && 'ks-skin-on'),
          onClick: () => setTheme(theme.formId === 'game' ? { gameMode: m0.id } : { classicMode: m0.id }),
          title: m0.help || '',
        }, [h('span', { key: 'e' }, m0.emoji), h('span', { key: 'l' }, m0.label)]))),
    ]);
  }

  /** Explicación del modo activo, en una línea. */
  function skinHint(theme) {
    if (theme.live) {
      return 'Modo Vivo: ahora mismo se ve en ' + s(theme.label).split('·').pop().trim()
        + ', y cambia solo con la hora del equipo.';
    }
    return s((theme.formId === 'game' ? gameModeById(theme.modeId) : classicModeById(theme.modeId)).help
      || 'El aspecto no cambia lo que hacen los agentes, solo cómo se lee.');
  }

  // ── Vista ──────────────────────────────────────────────────────────────
  function FlowView() {
    const plan = workflowPlan(model);
    const act = flowActions();
    const theme = currentTheme();
    const sel = ui.flowSel && plan.some((x) => x.id === ui.flowSel) ? ui.flowSel : (plan[0] || {}).id;
    const node = plan.find((x) => x.id === sel) || null;
    const custom = arr(model.settings.workflow.order).length > 0 || arr(model.settings.workflow.disabled).length > 0;
    const Renderer = theme.formId === 'game' ? (GAME_RENDERERS[theme.modeId] || FlowKimosLab) : FlowClassic;

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Flujo de agentes',
        subtitle: plan.length + ' agentes · ' + plan.filter((x) => x.status === 'done').length + ' ejecutados'
          + (custom ? ' · flujo personalizado' : ' · orden de fábrica'),
        actions: [
          h(Btn, { key: 'r', variant: 'primary', onClick: () => runStages(null, 'Pipeline') }, 'Ejecutar flujo'),
          custom ? h(Btn, { key: 'z', onClick: act.reset }, 'Restablecer') : null,
        ].filter(Boolean) }),

      h(Card, { key: 'sk', title: 'Aspecto',
        actions: [h(Btn, { key: 'w', size: 'sm', variant: 'ghost', onClick: () => setUi({ view: 'world' }) },
          'Ver la organización')] }, [
        h(SkinPicker, { key: 'f' }),
        h('p', { className: 'ks-hint', key: 'n' }, skinHint(theme)),
      ]),

      h('div', { className: cx('ks-flow-stage', 'ks-flow-' + (theme.formId === 'game' ? theme.modeId : 'classic')), key: 'st' },
        h(Renderer, { plan, actions: act, sel })),

      theme.formId === 'classic' ? h(Card, { key: 'i', title: 'Agente seleccionado' },
        h(FlowInspector, { node, actions: act })) : null,

      h(Card, { key: 'help', title: 'Qué puedes cambiar aquí' }, [
        h('ul', { className: 'ks-list', key: 'l' }, [
          'Reordenar: un agente no puede ir antes de aquel del que depende; si lo intentas, se coloca en la posición válida más cercana.',
          'Desactivar: el agente se salta. Los que dependían de él quedan bloqueados con el motivo, en vez de fallar a medias.',
          'Ejecutar suelto: útil para rehacer solo el copy o solo el montaje sin tocar el resto.',
          'El aspecto es solo presentación: los datos, el orden y los resultados son los mismos en las cuatro vistas.',
        ].map((x, i) => h('li', { key: i }, x))),
      ]),
    ]);
  }
