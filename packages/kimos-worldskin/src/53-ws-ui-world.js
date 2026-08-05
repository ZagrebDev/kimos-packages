
  // ═════════════════════════════════════════════════════════════════════════
  // KIMOS WorldSkin · superficie del mundo (dentro de mount)
  //
  // Un solo modelo, tres proyecciones. La villa y el territorio son cenitales;
  // el hotel es isométrico. La MISMA área ocupa las mismas celdas en los tres:
  // cambiar de ambientación no mueve nada, solo cambia cómo se proyecta.
  //
  // Requisitos del anfitrión (ver docs/CONTRATO.md): `h`, `useState`,
  // `useEffect`, `useRef` y `cx`.
  // ═════════════════════════════════════════════════════════════════════════

  const WS_TILE = 46;

  /** Proyección celda → píxel, por ambientación. */
  function wsProjector(kind, grid) {
    const g = wsObj(grid);
    const T = WS_TILE;
    if (kind === 'hotel') {
      const originX = (wsNum(g.h, 12) * T) / 2 + 20;
      return {
        kind, T,
        to: (cx, cy) => ({ x: (cx - cy) * (T / 2) + originX, y: (cx + cy) * (T / 4) + 60 }),
        width: (wsNum(g.w, 16) + wsNum(g.h, 12)) * (T / 2) + 40,
        height: (wsNum(g.w, 16) + wsNum(g.h, 12)) * (T / 4) + 146,
      };
    }
    // El margen superior deja sitio al rótulo, que va por encima de cada
    // estructura; el inferior, al subtítulo de la última fila.
    return {
      kind, T,
      to: (cx, cy) => ({ x: cx * T + 14, y: cy * T + 22 }),
      width: wsNum(g.w, 16) * T + 28,
      height: wsNum(g.h, 12) * T + 52,
    };
  }

  /** Rombo/rectángulo del suelo de un área, según proyección. */
  function wsAreaShape(pr, a) {
    if (pr.kind === 'hotel') {
      const p1 = pr.to(a.x, a.y);
      const p2 = pr.to(a.x + a.w, a.y);
      const p3 = pr.to(a.x + a.w, a.y + a.h);
      const p4 = pr.to(a.x, a.y + a.h);
      return [p1, p2, p3, p4].map((p) => p.x + ',' + p.y).join(' ');
    }
    const o = pr.to(a.x, a.y);
    return { x: o.x, y: o.y, w: a.w * pr.T, h: a.h * pr.T };
  }

  // ── Estructuras dibujadas ──────────────────────────────────────────────
  function WsStructure(props) {
    const p = wsObj(props);
    const a = p.area; const pr = p.pr;
    const dep = wsDepartmentById(a.departmentId);
    const st = wsStructureById(a.structure);
    const sel = p.selected;
    const n = wsArr(a.stations).length;
    const sub = wsStructureName(st.id, pr.kind) + ' · ' + n + (n === 1 ? ' puesto' : ' puestos');
    // Tercera línea: quién responde por esto. Si hay agentes de IA trabajando
    // y nadie al mando, se dice aquí, no en un informe que nadie abre.
    const ai = wsNum(p.ai, 0);
    const owner = wsS(a.ownerName);
    const rule = owner ? '★ ' + owner : (ai ? '⚠ sin responsable' : '');
    const ruleClass = owner ? 'ws-struct-owner' : 'ws-struct-orphan';
    if (pr.kind === 'hotel') {
      const pts = wsAreaShape(pr, a);
      const top = pr.to(a.x + a.w / 2, a.y + a.h / 2);
      const lift = 26;
      return h('g', { className: cx('ws-struct', sel && 'ws-struct-sel'), onClick: p.onClick }, [
        h('polygon', { key: 'f', points: pts, fill: dep.color, fillOpacity: 0.22, stroke: dep.color, strokeWidth: sel ? 2.5 : 1.2 }),
        h('polygon', { key: 'w', points: pts, fill: 'none', stroke: dep.color, strokeWidth: 1,
          transform: 'translate(0,' + -lift + ')', opacity: 0.75 }),
        h('line', { key: 'l1', x1: pts.split(' ')[0].split(',')[0], y1: pts.split(' ')[0].split(',')[1],
          x2: pts.split(' ')[0].split(',')[0], y2: Number(pts.split(' ')[0].split(',')[1]) - lift,
          stroke: dep.color, strokeWidth: 1, opacity: 0.6 }),
        h('text', { key: 't', x: top.x, y: top.y - lift - 22, textAnchor: 'middle', className: 'ws-struct-label' },
          dep.emoji + ' ' + a.name),
        h('text', { key: 's', x: top.x, y: top.y - lift - 12, textAnchor: 'middle', className: 'ws-struct-sub' }, sub),
        rule ? h('text', { key: 'o', x: top.x, y: top.y - lift - 2, textAnchor: 'middle',
          className: cx('ws-struct-sub', ruleClass) }, rule) : null,
      ]);
    }
    const r = wsAreaShape(pr, a);
    const round = pr.kind === 'village' ? 6 : 0;
    const roof = pr.kind === 'village';
    return h('g', { className: cx('ws-struct', sel && 'ws-struct-sel'), onClick: p.onClick }, [
      h('rect', { key: 'b', x: r.x, y: r.y + (roof ? 10 : 0), width: r.w, height: r.h - (roof ? 10 : 0),
        rx: round, fill: dep.color, fillOpacity: 0.26, stroke: dep.color, strokeWidth: sel ? 2.5 : 1.2 }),
      roof ? h('polygon', { key: 'r', points: [
        [r.x - 3, r.y + 12], [r.x + r.w / 2, r.y - 2], [r.x + r.w + 3, r.y + 12],
      ].map((q) => q.join(',')).join(' '), fill: dep.color, fillOpacity: 0.7 }) : null,
      // El chaflán es lo que hace que una estructura se lea como «desplegada»
      // y no como una caja: se rellena, no solo se contornea.
      pr.kind === 'territory' ? h('polygon', { key: 'c', points: [
        [r.x, r.y + 12], [r.x + 12, r.y], [r.x + r.w - 12, r.y], [r.x + r.w, r.y + 12],
        [r.x + r.w, r.y + r.h - 12], [r.x + r.w - 12, r.y + r.h],
        [r.x + 12, r.y + r.h], [r.x, r.y + r.h - 12],
      ].map((q) => q.join(',')).join(' '), fill: dep.color, fillOpacity: 0.18,
      stroke: dep.color, strokeWidth: 1, opacity: 0.9 }) : null,
      // Los rótulos van FUERA de la estructura: dentro los taparían los
      // avatares, que es justo lo que hay que poder mirar.
      h('text', { key: 't', x: r.x + r.w / 2, y: r.y - 4, textAnchor: 'middle', className: 'ws-struct-label' },
        dep.emoji + ' ' + a.name),
      h('text', { key: 's', x: r.x + r.w / 2, y: r.y + r.h + 11, textAnchor: 'middle', className: 'ws-struct-sub' }, sub),
      rule ? h('text', { key: 'o', x: r.x + r.w / 2, y: r.y + r.h + 21, textAnchor: 'middle',
        className: cx('ws-struct-sub', ruleClass) }, rule) : null,
    ]);
  }

  /** Avatar: dos píxeles de cuerpo y uno de cabeza, con rebote al andar. */
  function WsAvatar(props) {
    const p = wsObj(props);
    const a = p.actor;
    const col = wsAvatarColors(a);
    const bob = a.moving ? Math.sin((p.t + a.phase) * 9) * 1.6 : Math.sin((p.t + a.phase) * 2) * 0.5;
    const s = p.scale || 1;
    return h('g', {
      className: cx('ws-actor', p.selected && 'ws-actor-sel', a.mood === 'off' && 'ws-actor-off'),
      transform: 'translate(' + p.px + ',' + (p.py + bob) + ') scale(' + (a.face < 0 ? -s : s) + ',' + s + ')',
      onClick: p.onClick,
    }, [
      h('ellipse', { key: 'sh', cx: 0, cy: 1, rx: 6, ry: 2.4, fill: '#000', opacity: 0.22 }),
      h('rect', { key: 'b', x: -4, y: -11, width: 8, height: 8, rx: 2, fill: col.body }),
      h('rect', { key: 'h', x: -3.5, y: -18, width: 7, height: 7, rx: a.kind === 'ai' ? 1.5 : 3.5, fill: col.head }),
      a.kind === 'ai'
        ? h('rect', { key: 'e', x: -2.5, y: -16, width: 5, height: 1.8, fill: col.body })
        : h('rect', { key: 'e', x: 0.4, y: -15.6, width: 1.4, height: 1.4, fill: '#2A2A2A' }),
      a.kind === 'ai' ? h('rect', { key: 'a', x: -0.6, y: -21, width: 1.2, height: 3, fill: col.trim }) : null,
      // Quien responde por el departamento se distingue de un vistazo: si hay
      // que buscarlo en una lista, la responsabilidad no está a la vista.
      a.isOwner ? h('polygon', { key: 'ow', className: 'ws-owner-mark',
        points: '0,-25 1.9,-21.6 5.6,-21 2.9,-18.4 3.6,-14.8 0,-16.5 -3.6,-14.8 -2.9,-18.4 -5.6,-21 -1.9,-21.6' }) : null,
      a.bubble ? h('g', { key: 'bu', transform: 'translate(7,-20) scale(' + (a.face < 0 ? -1 : 1) + ',1)' }, [
        h('circle', { key: 'c', cx: 0, cy: 0, r: 5.5, fill: '#fff', opacity: 0.92 }),
        h('text', { key: 't', x: 0, y: 2.4, textAnchor: 'middle', className: 'ws-bubble' }, a.bubble),
      ]) : null,
    ]);
  }

  /**
   * Superficie del mundo. Recibe el mundo, el tema, el plan del flujo y una
   * función que traduce agente → estado. Devuelve el SVG animado.
   */
  function WsWorldSurface(props) {
    const p = wsObj(props);
    const world = wsObj(p.world);
    const pr = wsProjector(wsS(p.kind) || 'village', world.grid);
    const simRef = useRef(null);
    const rafRef = useRef(null);
    // El bucle se da de alta una sola vez por firma del mundo, así que no
    // puede cerrarse sobre `props`: se quedaría con el estado del flujo que
    // había al arrancar y los avatares no reaccionarían nunca. Aquí se deja
    // siempre lo último que ha llegado, y el bucle lo lee de aquí.
    const liveRef = useRef(null);
    const [, forceTick] = useState(0);
    liveRef.current = { world, statusOf: p.statusOf };

    // Firma del mundo: si cambia, se reconstruyen los actores conservando
    // posiciones. Sin esto, editar un área haría saltar a todo el personal.
    const sig = wsArr(world.staff).map((x) => x.id + x.areaId + x.stationId).join('|')
      + '#' + wsArr(world.areas).map((a) => a.id + a.x + a.y + a.w + a.h).join('|');

    if (!simRef.current || simRef.current.sig !== sig) {
      simRef.current = { sig, sim: wsSimInit(world, simRef.current ? simRef.current.sim : null) };
    }

    useEffect(() => {
      const reduce = (globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || false;
      if (reduce || typeof requestAnimationFrame !== 'function') return undefined;
      let last = 0; let acc = 0; let stop = false;
      const loop = (ts) => {
        if (stop) return;
        rafRef.current = requestAnimationFrame(loop);
        // Pausa real cuando la pestaña no se ve: no gastar CPU de nadie.
        if (globalThis.document && document.hidden) { last = ts; return; }
        const dt = last ? (ts - last) / 1000 : 0;
        last = ts;
        acc += dt;
        if (acc < 1 / 24) return;              // se repinta a 24 fps como techo
        const cur = simRef.current;
        const live = liveRef.current || { world, statusOf: p.statusOf };
        if (cur) cur.sim = wsSimStep(cur.sim, live.world, acc, live.statusOf);
        acc = 0;
        forceTick((x) => (x + 1) % 1000000);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => { stop = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [sig]);

    const sim = simRef.current ? simRef.current.sim : wsSimInit(world, null);
    const areas = wsArr(world.areas);
    const g = wsObj(world.grid);

    // Rejilla del suelo.
    const lines = [];
    if (pr.kind === 'hotel') {
      for (let i = 0; i <= wsNum(g.w, 16); i++) {
        const a0 = pr.to(i, 0); const b0 = pr.to(i, wsNum(g.h, 12));
        lines.push(h('line', { key: 'v' + i, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
      for (let j = 0; j <= wsNum(g.h, 12); j++) {
        const a0 = pr.to(0, j); const b0 = pr.to(wsNum(g.w, 16), j);
        lines.push(h('line', { key: 'h' + j, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
    } else {
      for (let i = 0; i <= wsNum(g.w, 16); i++) {
        const a0 = pr.to(i, 0); const b0 = pr.to(i, wsNum(g.h, 12));
        lines.push(h('line', { key: 'v' + i, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
      for (let j = 0; j <= wsNum(g.h, 12); j++) {
        const a0 = pr.to(0, j); const b0 = pr.to(wsNum(g.w, 16), j);
        lines.push(h('line', { key: 'h' + j, x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, className: 'ws-grid' }));
      }
    }

    // Los avatares se pintan de arriba abajo para que el de delante tape al
    // de detrás: sin esto la escena se ve plana y desordenada.
    const actors = wsArr(sim.actors).slice().sort((a, b) => (a.y + a.x) - (b.y + b.x));

    return h('svg', {
      className: 'ws-surface', viewBox: '0 0 ' + pr.width + ' ' + pr.height,
      width: '100%', height: pr.height, role: 'img',
      'aria-label': 'Mapa de la organización con ' + areas.length + ' áreas y ' + actors.length + ' avatares',
    }, [
      h('rect', { key: 'bg', x: 0, y: 0, width: pr.width, height: pr.height, className: 'ws-ground' }),
      h('g', { key: 'grid' }, lines),
      h('g', { key: 'areas' }, areas.map((a) => h(WsStructure, {
        key: a.id, area: a, pr, selected: p.selArea === a.id,
        ai: wsArr(world.staff).filter((x) => x.areaId === a.id && x.kind === 'ai').length,
        onClick: () => p.onSelectArea && p.onSelectArea(a.id),
      }))),
      h('g', { key: 'actors' }, actors.map((a) => {
        const q = pr.to(a.x, a.y);
        return h(WsAvatar, { key: a.id, actor: a, px: q.x, py: q.y, t: wsNum(sim.t, 0),
          scale: pr.kind === 'hotel' ? 1.15 : 1.25, selected: p.selStaff === a.id,
          onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (p.onSelectStaff) p.onSelectStaff(a.id); } });
      })),
    ]);
  }
