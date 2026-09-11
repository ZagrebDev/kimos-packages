
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Producción: Storyboard, Timeline, Prompts, Audio, Trabajos, Editor
  // ═════════════════════════════════════════════════════════════════════════

  function StoryboardView() {
    const sb = model.storyboard;
    if (!sb) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'storyboard' }));
    const scenes = arr(sb.scenes);
    const sel = ui.sceneSel && scenes.find((x) => x.id === ui.sceneSel) ? ui.sceneSel : (scenes[0] || {}).id;
    const scene = scenes.find((x) => x.id === sel) || null;

    const editScene = (k, v) => patch((m) => {
      const t = arr(m.storyboard.scenes).find((x) => x.id === sel);
      if (!t) return;
      t[k] = v;
      m.storyboard.totalSec = retime(m.storyboard.scenes);
    });
    const propagate = () => runStages(['prompt-engineer', 'voice-director', 'video-producer', 'video-editor', 'brand-consistency', 'analytics'], 'Actualización');

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Storyboard',
        subtitle: scenes.length + ' escenas · ' + fmtSec(num(sb.totalSec, 0)) + ' · ritmo ' + num(obj(sb.pacing).cutsPerMin, 0) + ' cortes/min',
        actions: [
          h(Btn, { key: 'a', onClick: () => dispatch({ type: 'ADD_SCENE', payload: { role: 'demo', afterCode: scene ? scene.code : '' } }) }, '+ Escena'),
          h(Btn, { key: 'p', variant: 'ghost', onClick: propagate }, 'Propagar cambios'),
          h(Btn, { key: 'r', variant: 'ghost', onClick: () => runStages(['storyboard'], 'Storyboard') }, 'Regenerar'),
        ] }),

      h('div', { className: 'ks-sbgrid', key: 'g' }, [
        h('div', { className: 'ks-sbcards', key: 'c' }, scenes.map((sc) => h('div', {
          key: sc.id, className: cx('ks-scene', sc.id === sel && 'ks-scene-sel', 'ks-role-' + sc.role),
          onClick: () => setUi({ sceneSel: sc.id }),
        }, [
          h('div', { className: 'ks-scene-head', key: 'h' }, [
            h('span', { className: 'ks-scene-code', key: 'c' }, sc.code),
            h('span', { className: 'ks-scene-role', key: 'r' }, sc.roleLabel),
            h('span', { className: 'ks-scene-dur', key: 'd' }, fmtSec(sc.durationSec)),
          ]),
          h('div', { className: 'ks-scene-frame', key: 'f' }, [
            h('span', { className: 'ks-scene-shot', key: 's' }, labelOf(SHOTS, sc.shot)),
            h('span', { className: 'ks-scene-move', key: 'm' }, labelOf(MOVES, sc.move)),
          ]),
          h('p', { className: 'ks-scene-desc', key: 'd' }, sc.description),
          s(sc.onScreenText) ? h('div', { className: 'ks-scene-text', key: 't' }, '« ' + sc.onScreenText + ' »') : null,
          h('div', { className: 'ks-scene-tags', key: 'g' }, [
            h('span', { key: 'l' }, labelOf(LENSES, sc.lens)),
            h('span', { key: 'i' }, labelOf(LIGHTING, sc.lighting)),
            h('span', { key: 'c' }, labelOf(GRADES, sc.grade)),
          ].concat(arr(sc.fx).map((f, i) => h('span', { key: 'f' + i, className: 'ks-tag-fx' }, labelOf(FX, f))))),
        ]))),

        scene ? h('aside', { className: 'ks-sbside', key: 's' }, [
          h('div', { className: 'ks-sbside-head', key: 'h' }, [
            h('strong', { key: 't' }, scene.code + ' · ' + scene.roleLabel),
            h(Btn, { key: 'd', size: 'xs', variant: 'danger', disabled: scenes.length <= 2,
              onClick: () => dispatch({ type: 'REMOVE_SCENE', payload: { sceneId: scene.id } }) }, 'Eliminar'),
          ]),
          h('p', { className: 'ks-hint', key: 'p' }, scene.purpose),
          h(Field, { key: 'du', label: 'Duración (s)' },
            h(TextInput, { type: 'number', step: '0.1', value: scene.durationSec, onChange: (v) => editScene('durationSec', clamp(v, 0.3, 60)) })),
          h(Field, { key: 'sh', label: 'Encuadre' }, h(Select, { value: scene.shot, options: optsOf(SHOTS), onChange: (v) => editScene('shot', v) })),
          h(Field, { key: 'an', label: 'Ángulo' }, h(Select, { value: scene.angle, options: optsOf(ANGLES), onChange: (v) => editScene('angle', v) })),
          h(Field, { key: 'le', label: 'Óptica' }, h(Select, { value: scene.lens, options: optsOf(LENSES), onChange: (v) => editScene('lens', v) })),
          h(Field, { key: 'mo', label: 'Movimiento' }, h(Select, { value: scene.move, options: optsOf(MOVES), onChange: (v) => editScene('move', v) })),
          h(Field, { key: 'li', label: 'Iluminación' }, h(Select, { value: scene.lighting, options: optsOf(LIGHTING), onChange: (v) => editScene('lighting', v) })),
          h(Field, { key: 'gr', label: 'Etalonaje' }, h(Select, { value: scene.grade, options: optsOf(GRADES), onChange: (v) => editScene('grade', v) })),
          h(Field, { key: 'tr', label: 'Transición de entrada' }, h(Select, { value: scene.transitionIn, options: optsOf(TRANSITIONS), onChange: (v) => editScene('transitionIn', v) })),
          h(Field, { key: 'fx', label: 'Efectos' }, h('div', { className: 'ks-fxpick' }, FX.filter((f) => f.id !== 'none').map((f) => h(Chip, {
            key: f.id, tone: arr(scene.fx).indexOf(f.id) >= 0 ? 'accent' : null, onClick: () => {
              const cur = arr(scene.fx);
              editScene('fx', cur.indexOf(f.id) >= 0 ? cur.filter((x) => x !== f.id) : cur.concat([f.id]));
            },
          }, f.label)))),
          h(Field, { key: 'os', label: 'Texto en pantalla' },
            h(TextInput, { value: scene.onScreenText, onChange: (v) => editScene('onScreenText', v) })),
          h(Field, { key: 'de', label: 'Descripción' },
            h(TextArea, { value: scene.description, rows: 4, onChange: (v) => editScene('description', v) })),
          h(Field, { key: 'no', label: 'Notas de producción' },
            h(TextArea, { value: scene.notes, rows: 2, onChange: (v) => editScene('notes', v) })),
          h('label', { className: 'ks-check', key: 'pv' }, [
            h('input', { key: 'i', type: 'checkbox', checked: !!scene.productVisible, onChange: (e) => editScene('productVisible', e.target.checked) }),
            h('span', { key: 's' }, 'El producto es visible'),
          ]),
          h('p', { className: 'ks-hint', key: 'sn' }, 'Sonido: ' + s(scene.soundNote)),
        ]) : null,
      ]),

      arr(sb.variants).length ? h(Card, { key: 'v', title: 'Variantes para test A/B' }, [
        h('div', { className: 'ks-variants', key: 'v' }, arr(sb.variants).map((v) => h('div', { key: v.id, className: 'ks-variant' }, [
          h('strong', { key: 'l' }, v.label + ' · ' + v.aspect + ' · ' + fmtSec(v.durationSec)),
          h('p', { className: 'ks-hint', key: 'hy' }, 'Hipótesis: ' + v.hypothesis),
          h('div', { className: 'ks-chips', key: 'c' }, arr(v.scenes).map((sc) => h(Chip, { key: sc.id, title: sc.description }, sc.code + ' ' + sc.roleLabel))),
        ]))),
      ]) : null,

      h(Card, { key: 'f', title: 'Cortes por formato' }, [
        h('div', { className: 'ks-formats', key: 'f' }, Object.keys(obj(sb.formats)).map((a) => {
          const f = sb.formats[a];
          const fScenes = scenesOfFormat(sb, a);
          return h('div', { key: a, className: 'ks-format' }, [
            h('strong', { key: 'a' }, a + (f.isMaster ? ' · maestro' : '') + ' · '
              + fmtSec(masterTimes(fScenes).total) + ' · ' + fScenes.length + ' escenas'),
            h('div', { className: 'ks-chips', key: 'd' }, arr(f.dims).map((d) => h(Chip, { key: d.res }, d.label + ' ' + d.w + '×' + d.h))),
            h('p', { className: 'ks-hint', key: 'n' }, f.note),
          ]);
        })),
      ]),
    ]);
  }

  // ── Timeline ───────────────────────────────────────────────────────────
  function TimelineView() {
    const ed = model.edit;
    const sb = obj(model.storyboard);
    if (!ed) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'video-editor' }));
    const tl = obj(ed.timeline);
    const total = Math.max(0.1, num(ed.totalSec, 1));
    const pctOf = (v) => (num(v, 0) / total) * 100;
    const ticks = [];
    const step = total > 60 ? 10 : total > 20 ? 5 : 2;
    for (let t = 0; t <= total; t += step) ticks.push(t);

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Timeline',
        subtitle: fmtSec(total) + ' · ' + num(ed.fps, 25) + ' fps · ' + arr(tl.video).length + ' clips',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['video-editor'], 'Video Editor') }, 'Recalcular montaje')] }),
      h(Card, { key: 't', flush: true }, [
        h('div', { className: 'ks-tl', key: 'tl' }, [
          h('div', { className: 'ks-tl-ruler', key: 'r' }, ticks.map((t) => h('span', {
            key: t, className: 'ks-tl-tick', style: { left: pctOf(t) + '%' },
          }, fmtSec(t)))),
          h('div', { className: 'ks-tl-track', key: 'v' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Vídeo'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.video).map((c) => h('div', {
              key: c.sceneId, className: cx('ks-tl-clip', 'ks-role-' + c.role, ui.sceneSel === c.sceneId && 'ks-tl-sel'),
              style: { left: pctOf(c.startSec) + '%', width: Math.max(1.2, pctOf(c.durationSec)) + '%' },
              title: c.code + ' · ' + fmtSec(c.durationSec) + ' · ' + labelOf(GRADES, c.grade),
              onClick: () => setUi({ sceneSel: c.sceneId, view: 'storyboard' }),
            }, [h('span', { key: 'c' }, c.code), c.speed !== 1 ? h('em', { key: 's' }, '×' + c.speed) : null]))),
          ]),
          h('div', { className: 'ks-tl-track', key: 'ti' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Títulos'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.titles).map((t, i) => h('div', {
              key: i, className: 'ks-tl-clip ks-tl-title',
              style: { left: pctOf(t.startSec) + '%', width: Math.max(1.2, pctOf(t.endSec - t.startSec)) + '%' },
              title: t.text,
            }, h('span', { key: 't' }, t.text)))),
          ]),
          h('div', { className: 'ks-tl-track', key: 'vo' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Locución'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.voice).map((v, i) => h('div', {
              key: i, className: 'ks-tl-clip ks-tl-vo',
              style: { left: pctOf(v.startSec) + '%', width: Math.max(1.2, pctOf(v.durationSec)) + '%' },
              title: v.text,
            }, h('span', { key: 't' }, v.code)))),
          ]),
          h('div', { className: 'ks-tl-track', key: 'mu' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Música'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, [
              h('div', { key: 'm', className: 'ks-tl-clip ks-tl-music', style: { left: '0%', width: '100%' },
                title: 'Ducking automático bajo la locución' }, h('span', { key: 't' }, s(obj(model.audio).music ? model.audio.music.genre : 'música'))),
            ]),
          ]),
          arr(tl.sfx).length ? h('div', { className: 'ks-tl-track', key: 'sx' }, [
            h('span', { className: 'ks-tl-name', key: 'n' }, 'Efectos'),
            h('div', { className: 'ks-tl-lane', key: 'l' }, arr(tl.sfx).map((x, i) => h('div', {
              key: i, className: 'ks-tl-clip ks-tl-sfx', style: { left: pctOf(x.startSec) + '%', width: '1.5%' }, title: x.code,
            }))),
          ]) : null,
        ]),
      ]),
      h(Card, { key: 'l', title: 'Lista de planos' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['#', 'Entrada', 'Duración', 'Rol', 'Transición', 'Velocidad', 'Fuente'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(tl.video).map((c) => h('tr', { key: c.sceneId }, [
            h('td', { key: 'a' }, c.code), h('td', { key: 'b' }, fmtSec(c.startSec)), h('td', { key: 'c' }, fmtSec(c.durationSec)),
            h('td', { key: 'd' }, c.role), h('td', { key: 'e' }, labelOf(TRANSITIONS, c.transitionIn)),
            h('td', { key: 'f' }, '×' + c.speed), h('td', { key: 'g' }, h('code', {}, c.source)),
          ]))),
        ]),
      ]),
    ]);
  }

  // ── Prompts ────────────────────────────────────────────────────────────
  function PromptsView() {
    const pr = model.prompts;
    if (!pr) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'prompt-engineer' }));
    const cap = s(ui.promptCap) || 'video';
    const list = cap === 'image' ? arr(pr.image) : cap === 'video' ? arr(pr.video)
      : cap === 'voice' ? arr(obj(model.audio).vo).map((v) => ({ code: v.code, role: 'locución', providerId: v.providerId, text: v.text, params: v.params, negative: '' }))
        : [{ code: 'MUS', role: 'música', providerId: s(obj(obj(model.audio).music).providerId), text: s(obj(obj(model.audio).music).prompt), params: obj(obj(model.audio).music).params, negative: '' }];
    const capProv = cap === 'image' ? 'image' : cap === 'video' ? 'video' : cap === 'voice' ? 'voice' : 'music';
    const current = getProvider(model.settings.providers[capProv]);
    const warnings = uniq([].concat.apply([], list.map((x) => arr(x.warnings))));

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Prompts',
        subtitle: 'Un PromptSpec neutral por escena, traducido al dialecto del proveedor. Cambia de modelo y se reescribe todo.',
        actions: [
          h(Btn, { key: 'c', onClick: () => copyText(list.map((x) => x.code + '\n' + x.text).join('\n\n---\n\n'), 'Prompts') }, 'Copiar todos'),
          h(Btn, { key: 'd', onClick: () => download(slug(model.title) + '-prompts.csv', exportPromptsCsv(model), 'text/csv') }, 'CSV'),
        ] }),

      h(Card, { key: 'sel' }, [
        h('div', { className: 'ks-tabs', key: 't' }, [
          { id: 'image', label: '🖼️ Imagen (' + arr(pr.image).length + ')' },
          { id: 'video', label: '🎬 Vídeo (' + arr(pr.video).length + ')' },
          { id: 'voice', label: '🎙️ Voz (' + arr(obj(model.audio).vo).length + ')' },
          { id: 'music', label: '🎵 Música' },
        ].map((t) => h('button', {
          key: t.id, type: 'button', className: cx('ks-tab', cap === t.id && 'ks-tab-on'),
          onClick: () => setUi({ promptCap: t.id }),
        }, t.label))),
        h('div', { className: 'ks-provrow', key: 'p' }, [
          h(Field, { key: 'p', label: 'Proveedor de ' + capProv },
            h(Select, { value: s(model.settings.providers[capProv]),
              options: providersFor(capProv).map((x) => ({ value: x.id, label: x.label })),
              onChange: (v) => dispatch({ type: 'SET_PROVIDER', payload: { capability: capProv, providerId: v } }) })),
          current ? h('div', { className: 'ks-provinfo', key: 'i' }, [
            h('span', { key: 'd' }, 'Dialecto: ' + s(current.dialect)),
            h('span', { key: 'n' }, current.negative ? 'Soporta negativo' : 'Sin prompt negativo'),
            h('span', { key: 'a' }, 'Aspectos: ' + arr(current.aspects).join(', ')),
            current.maxSec ? h('span', { key: 's' }, 'Máx. ' + current.maxSec + ' s por toma') : null,
            current.cost ? h('span', { key: 'c' }, fmtMoney(current.cost.amount, current.cost.currency) + ' / ' + current.cost.unit) : null,
            current.docs ? h('a', { key: 'l', href: current.docs, target: '_blank', rel: 'noreferrer' }, 'Documentación') : null,
          ]) : null,
        ]),
        current && arr(current.params).length ? h('div', { className: 'ks-grid ks-grid-4', key: 'pp' },
          arr(current.params).map((pm) => h(Field, { key: pm.key, label: pm.label },
            pm.type === 'select' ? h(Select, {
              value: s(obj(obj(model.settings.providerParams)[current.id])[pm.key] !== undefined
                ? obj(obj(model.settings.providerParams)[current.id])[pm.key] : pm.default),
              options: arr(pm.options).map((o) => ({ value: s(o), label: s(o) })),
              onChange: (v) => setProviderParam(current.id, pm.key, v),
            }) : pm.type === 'boolean' ? h(Toggle, {
              value: obj(obj(model.settings.providerParams)[current.id])[pm.key] !== undefined
                ? !!obj(obj(model.settings.providerParams)[current.id])[pm.key] : !!pm.default,
              onChange: (v) => setProviderParam(current.id, pm.key, v),
            }) : h(TextInput, {
              type: pm.type === 'number' ? 'number' : 'text', min: pm.min, max: pm.max,
              value: obj(obj(model.settings.providerParams)[current.id])[pm.key] !== undefined
                ? obj(obj(model.settings.providerParams)[current.id])[pm.key] : pm.default,
              onChange: (v) => setProviderParam(current.id, pm.key, v),
            }))) ) : null,
        warnings.length ? h('div', { className: 'ks-warnbox', key: 'w' }, [
          h('strong', { key: 't' }, 'Avisos del proveedor'),
          h('ul', { className: 'ks-list', key: 'l' }, warnings.map((w, i) => h('li', { key: i }, w))),
        ]) : null,
      ]),

      h('div', { className: 'ks-prompts', key: 'l' }, list.map((p, i) => h('div', { key: p.code + i, className: 'ks-prompt' }, [
        h('div', { className: 'ks-prompt-head', key: 'h' }, [
          h('span', { className: 'ks-prompt-code', key: 'c' }, p.code),
          h('span', { className: 'ks-prompt-role', key: 'r' }, p.role),
          p.durationSec ? h('span', { className: 'ks-prompt-dur', key: 'd' }, fmtSec(p.durationSec)) : null,
          h('span', { className: 'ks-prompt-prov', key: 'p' }, p.providerId),
          h(Btn, { key: 'b', size: 'xs', onClick: () => copyText(p.text, 'Prompt ' + p.code) }, 'Copiar'),
        ]),
        h('pre', { className: 'ks-prompt-text', key: 't' }, s(p.text)),
        s(p.negative) ? h('div', { className: 'ks-prompt-neg', key: 'n' }, [h('strong', { key: 'l' }, 'Negativo: '), s(p.negative)]) : null,
        Object.keys(obj(p.params)).length ? h('div', { className: 'ks-prompt-params', key: 'p' },
          Object.keys(obj(p.params)).map((k) => h('span', { key: k }, k + ': ' + s(JSON.stringify(p.params[k])).replace(/^"|"$/g, '')))) : null,
        p.payload ? h(CodeBlock, { key: 'pl', title: 'Payload del workflow', content: JSON.stringify(p.payload, null, 2) }) : null,
      ]))),
    ]);
  }

  function setProviderParam(providerId, key, value) {
    patch((m) => {
      const bag = obj(m.settings.providerParams);
      bag[providerId] = Object.assign(obj(bag[providerId]), { [key]: value });
      m.settings.providerParams = bag;
    });
    runStages(['prompt-engineer', 'voice-director', 'video-producer'], 'Parámetros');
  }

  // ── Voz y música ───────────────────────────────────────────────────────
  function AudioView() {
    const au = model.audio;
    if (!au) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'voice-director' }));
    const mu = obj(au.music);
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Voz y música',
        subtitle: arr(au.vo).length + ' líneas · ' + num(au.voWords, 0) + ' palabras · ' + num(au.voChars, 0) + ' caracteres',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['voice-director'], 'Voice Director') }, 'Regenerar audio')] }),
      arr(au.overflow).length ? h('div', { className: 'ks-warnbox', key: 'w' },
        'Estas líneas siguen sin caber en su plano: ' + arr(au.overflow).join(', ') + '. Alarga la escena.') : null,
      arr(au.trimmed).length ? h('p', { className: 'ks-hint', key: 'tr' },
        'Ajustadas al metraje por el Voice Director: ' + arr(au.trimmed).join(', ')
        + '. Alarga esas escenas si quieres el texto completo.') : null,
      h(Card, { key: 'vo', title: 'Guion de locución' }, [
        h('p', { className: 'ks-hint', key: 'c' }, s(obj(au.voiceProfile).casting)),
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Escena', 'Entrada', 'Texto', 'Palabras', 'Estimado', 'Cabe'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(au.vo).map((v) => h('tr', { key: v.sceneId, className: v.fits ? '' : 'ks-row-bad' }, [
            h('td', { key: 'a' }, v.code), h('td', { key: 'b' }, fmtSec(v.startSec)),
            h('td', { key: 'c' }, h('input', { className: 'ks-input ks-input-inline', value: s(v.text),
              onChange: (e) => patch((m) => { const t = arr(m.audio.vo).find((x) => x.sceneId === v.sceneId); if (t) t.text = e.target.value; }) })),
            h('td', { key: 'd' }, v.words), h('td', { key: 'e' }, fmtSec(v.estimatedSec)),
            h('td', { key: 'f' }, v.fits ? '✓' : '✕'),
          ]))),
        ]),
        h('div', { className: 'ks-cardfoot', key: 'f' }, [
          h(Btn, { key: 'c', size: 'sm', onClick: () => copyText(arr(au.vo).map((v) => v.code + ': ' + v.text).join('\n'), 'Guion') }, 'Copiar guion'),
          h(Btn, { key: 's', size: 'sm', onClick: () => download(slug(model.title) + '.srt', s(obj(model.edit).srt), 'text/plain') }, 'Descargar SRT'),
        ]),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'm', title: 'Música' }, [
          h('div', { className: 'ks-kv', key: 'k' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Género'), h('strong', { key: 'b' }, s(mu.genre))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'BPM'), h('strong', { key: 'b' }, s(mu.bpm))]),
            h('div', { key: '3' }, [h('span', { key: 'a' }, 'Proveedor'), h('strong', { key: 'b' }, s(mu.providerId))]),
            h('div', { key: '4' }, [h('span', { key: 'a' }, 'Duración'), h('strong', { key: 'b' }, fmtSec(mu.durationSec))]),
          ]),
          h('p', { className: 'ks-lead', key: 'md' }, s(mu.mood)),
          h(CodeBlock, { key: 'p', title: 'Prompt de música', content: s(mu.prompt) }),
          h('h4', { className: 'ks-h4', key: 'h' }, 'Estructura'),
          h('ul', { className: 'ks-list', key: 'l' }, arr(mu.structure).map((x, i) => h('li', { key: i }, fmtSec(x.at) + ' · ' + x.label + ' — ' + x.note))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'Mezcla'),
          h('ul', { className: 'ks-list', key: 'l2' }, arr(mu.mixNotes).map((x, i) => h('li', { key: i }, x))),
        ]),
        h(Card, { key: 's', title: 'Ambiente y efectos' }, [
          h('h4', { className: 'ks-h4', key: 'h1' }, 'Efectos puntuales'),
          h('ul', { className: 'ks-list', key: 'l1' }, arr(au.sfx).map((x, i) => h('li', { key: i },
            h('span', {}, [h('code', { key: 'c' }, x.code), ' ' + fmtSec(x.atSec) + ' — ' + s(x.prompt || x.text)])))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'Ambiente por escena'),
          h('ul', { className: 'ks-list', key: 'l2' }, arr(au.ambience).map((x, i) => h('li', { key: i }, x.code + ' — ' + x.text))),
        ]),
      ]),
    ]);
  }

  // ── Trabajos de producción ─────────────────────────────────────────────
  function JobsView() {
    const pr = model.production;
    if (!pr) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'video-producer' }));
    const jobs = arr(pr.jobs);
    const byStatus = JOB_STATUS.reduce((acc, st0) => { acc[st0] = jobs.filter((j) => j.status === st0).length; return acc; }, {});
    const done = byStatus.done || 0;
    const pct = jobs.length ? Math.round((done / jobs.length) * 100) : 0;
    const pending = jobs.filter((j) => j.status === 'pending');
    const ready = jobs.length > 0 && !pending.length;
    const next = readyJobs(model, 12);
    const missingFiles = jobs.filter((j) => s(j.file) && j.status !== 'done');

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Producción',
        subtitle: done + ' de ' + jobs.length + ' archivos generados · coste estimado '
          + fmtMoney(num(obj(pr.totals).cost, 0), 'USD') + ' · ~' + num(pr.estMinutes, 0) + ' min de máquina',
        actions: [
          h(Btn, { key: 'b', variant: ready ? 'primary' : 'ghost',
            onClick: () => download(slug(model.title) + '-render.sh', exportRenderBundle(model, assets), 'text/x-shellscript'),
            title: ready ? 'Descarga, une y renderiza todo' : 'Se descargará lo que ya esté registrado' },
            'Bundle de render'),
          h(Btn, { key: 'm', onClick: () => download(slug(model.title) + '-assets.json', exportAssetsManifest(model, assets), 'application/json') }, 'Manifiesto'),
          h(Btn, { key: 'c', onClick: () => download(slug(model.title) + '-jobs.csv', exportJobsCsv(model), 'text/csv') }, 'CSV'),
          h(Btn, { key: 'r', variant: 'ghost', onClick: () => runStages(['video-producer'], 'Video Producer') }, 'Recalcular'),
        ] }),

      h(Card, { key: 'prog', title: ready ? 'Listo para renderizar' : 'Progreso' }, [
        h(Bar, { key: 'b', value: pct, tone: ready ? 'ok' : 'accent' }),
        h('p', { className: 'ks-lead', key: 'p' }, ready
          ? 'Todos los archivos están registrados. Descarga el bundle de render y ejecútalo: baja los assets, une las tomas partidas, escribe los subtítulos y monta los '
            + arr(obj(model.edit).exports).length + ' entregables.'
          : pending.length + ' archivo(s) por generar. ' + next.length + ' se pueden hacer ahora mismo'
            + (next.length && next[0].stage === 'keyframe' ? ' (keyframes: valida el producto antes de animar).' : '.')),
        h('div', { className: 'ks-grid ks-grid-4', key: 's' }, JOB_STATUS.slice(0, 4).map((st0) => h(Stat, {
          key: st0, label: st0, value: byStatus[st0] || 0,
          tone: st0 === 'done' ? 'ok' : st0 === 'failed' ? 'bad' : null,
        }))),
        ready ? null : h('p', { className: 'ks-hint', key: 'cmd' },
          'Desde el chat de KIMOS basta con: «produce el material pendiente de Kreative Studio». '
          + 'El agente llama a RUN_PRODUCTION, genera el lote con sus modelos y lo devuelve con REGISTER_ASSETS; '
          + 'repite hasta terminar.'),
      ]),

      next.length ? h(Card, { key: 'next', title: 'Siguiente lote (' + next.length + ')' }, [
        h('div', { className: 'ks-nextjobs', key: 'l' }, next.map((j) => h('div', { key: j.id, className: 'ks-nextjob' }, [
          h('span', { className: 'ks-nextjob-kind', key: 'k' }, (CAPABILITIES.find((c0) => c0.id === j.kind) || {}).emoji || '•'),
          h('div', { key: 'b' }, [
            h('strong', { key: 'l' }, j.label),
            h('span', { className: 'ks-nextjob-meta', key: 'm' }, j.providerLabel + ' → ' + j.file),
          ]),
          h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(j.prompt, 'Prompt ' + j.code) }, 'Prompt'),
        ]))),
      ]) : null,

      missingFiles.length ? h(Card, { key: 'miss', title: 'Archivos que faltan para el montaje' }, [
        h('p', { className: 'ks-hint', key: 'i' },
          'El script de render espera estas rutas. Cada una se rellena sola al registrar el asset de su trabajo.'),
        h('div', { className: 'ks-chips', key: 'c' }, missingFiles.slice(0, 40).map((j) => h(Chip, { key: j.id, tone: 'bad' }, j.file))),
      ]) : null,

      h(Card, { key: 'g', title: 'Cómo ejecutar' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(pr.guidance).map((x, i) => h('li', { key: i }, x))),
      ]),
      h(Card, { key: 'j', flush: true }, [
        h('table', { className: 'ks-table ks-table-jobs', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['#', 'Trabajo', 'Proveedor', 'Cantidad', 'Coste est.', 'Estado', ''].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, jobs.map((j) => h('tr', { key: j.id, className: 'ks-job-' + j.status }, [
            h('td', { key: 'a' }, j.order + 1),
            h('td', { key: 'b' }, [h('strong', { key: 'l' }, j.label), h('div', { className: 'ks-job-prompt', key: 'p', title: j.prompt }, s(j.prompt).slice(0, 120) + (s(j.prompt).length > 120 ? '…' : ''))]),
            h('td', { key: 'c' }, j.providerLabel),
            h('td', { key: 'd' }, j.billableQty + ' ' + j.costUnit),
            h('td', { key: 'e' }, fmtMoney(j.estCostUsd, 'USD')),
            h('td', { key: 'f' }, h(Select, { value: j.status, options: JOB_STATUS.map((x) => ({ value: x, label: x })),
              onChange: (v) => dispatch({ type: 'SET_JOB_STATUS', payload: { jobId: j.id, status: v } }) })),
            h('td', { key: 'g' }, h(Btn, { size: 'xs', onClick: () => copyText(j.prompt, 'Prompt ' + j.code) }, 'Copiar')),
          ]))),
        ]),
      ]),
    ]);
  }

  // ── Editor ─────────────────────────────────────────────────────────────
  function EditorView() {
    const ed = model.edit;
    if (!ed) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'video-editor' }));
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Editor',
        subtitle: arr(ed.exports).length + ' entregables · ' + fmtSec(num(ed.totalSec, 0)) + ' · ' + num(ed.fps, 25) + ' fps',
        actions: [
          h(Btn, { key: 'f', variant: 'primary', onClick: () => download('montaje-' + slug(model.title) + '.sh', s(ed.ffmpeg), 'text/x-shellscript') }, 'Descargar script'),
          h(Btn, { key: 's', onClick: () => download(slug(model.title) + '.srt', s(ed.srt), 'text/plain') }, 'SRT'),
          h(Btn, { key: 'e', onClick: () => download(slug(model.title) + '.edl', s(ed.edl), 'text/plain') }, 'EDL'),
        ] }),
      h(Card, { key: 'x', title: 'Entregables' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Archivo', 'Formato', 'Resolución', 'Píxeles', 'Bitrate', 'Plataformas'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(ed.exports).map((e) => h('tr', { key: e.id }, [
            h('td', { key: 'a' }, h('code', {}, e.filename)), h('td', { key: 'b' }, e.aspect),
            h('td', { key: 'c' }, byId(RESOLUTIONS, e.resolution).label), h('td', { key: 'd' }, e.width + '×' + e.height),
            h('td', { key: 'e' }, e.bitrateMbps + ' Mb/s'),
            h('td', { key: 'f' }, arr(e.platforms).length ? arr(e.platforms).join(', ') : '—'),
          ]))),
        ]),
      ]),
      h(Card, { key: 'c', title: 'Comprobaciones antes de exportar' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(ed.checklist).map((x, i) => h('li', { key: i }, x))),
      ]),
      h(CodeBlock, { key: 'ff', title: 'Script de montaje FFmpeg', content: s(ed.ffmpeg),
        filename: 'montaje-' + slug(model.title) + '.sh', mime: 'text/x-shellscript' }),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(CodeBlock, { key: 's', title: 'Subtítulos (SRT)', content: s(ed.srt), filename: slug(model.title) + '.srt' }),
        h(CodeBlock, { key: 'e', title: 'Lista de decisiones (EDL)', content: s(ed.edl), filename: slug(model.title) + '.edl' }),
      ]),
    ]);
  }
