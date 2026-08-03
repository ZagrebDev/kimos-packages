
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Estudio: Panel y Brief
  // ═════════════════════════════════════════════════════════════════════════

  function DashboardView() {
    const [intent, setIntent] = useState(s(model.brief.intent));
    const st = styleById(model.styleId);
    const stages = obj(model.pipeline.stages);
    const doneCount = PIPELINE_ORDER.filter((id) => obj(stages[id]).status === 'done').length;
    const pct = Math.round((doneCount / PIPELINE_ORDER.length) * 100);
    const prod = obj(model.production);
    const an = obj(model.analytics);
    const bc = obj(model.brandCheck);
    const hasProduct = s(model.brief.productName).trim().length > 0;

    const quick = ['Crea una campaña premium', 'Quiero un comercial épico', 'Véndelo para deportistas',
      'Algo minimal y limpio', 'Hazlo viral para TikTok', 'Campaña de conversión con oferta'];

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Panel de campaña',
        subtitle: hasProduct ? s(model.brief.productName) + ' · ' + st.name + ' · ' + objectiveById(model.objectiveId).label
          : 'Empieza por el producto: nombre y fotos.',
        actions: [
          h(Btn, { key: 'v', onClick: () => createVersion('') }, 'Guardar versión'),
          h(Btn, { key: 'r', variant: 'ghost', disabled: !model.concept, onClick: () => runStages(null, 'Pipeline') }, 'Regenerar todo'),
        ] }),

      h(Card, { key: 'gen', title: 'Generar campaña completa' }, [
        h('p', { className: 'ks-lead', key: 'p' },
          'Sube las fotos del producto en el Brief y describe con tus palabras lo que quieres. '
          + 'El sistema interpreta el estilo, el objetivo y el público, y ejecuta los doce agentes.'),
        h('div', { className: 'ks-genrow', key: 'g' }, [
          h('input', { key: 'i', className: 'ks-input ks-input-lg', value: intent,
            placeholder: 'Crea una campaña premium…',
            onChange: (e) => setIntent(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter' && hasProduct) generateAll(intent); } }),
          h(Btn, { key: 'b', variant: 'primary', size: 'lg', disabled: !hasProduct || ui.busy,
            onClick: () => generateAll(intent) }, ui.busy ? 'Generando…' : 'Generar campaña'),
        ]),
        h('div', { className: 'ks-quick', key: 'q' }, quick.map((q) => h(Chip, {
          key: q, onClick: () => { setIntent(q); generateAll(q); }, title: 'Generar con esta intención',
        }, q))),
        !hasProduct ? h('p', { className: 'ks-warn', key: 'w' },
          'Falta el nombre del producto. ') : null,
        !hasProduct ? h(Btn, { key: 'gb', size: 'sm', onClick: () => setUi({ view: 'brief' }) }, 'Ir al Brief') : null,
      ]),

      h('div', { className: 'ks-grid ks-grid-4', key: 'stats' }, [
        h(Stat, { key: 's1', label: 'Progreso del pipeline', value: pct + ' %', hint: doneCount + ' de ' + PIPELINE_ORDER.length + ' agentes' }),
        h(Stat, { key: 's2', label: 'Duración hero', value: fmtSec(num(obj(model.storyboard).totalSec, 0)),
          hint: arr(obj(model.storyboard).scenes).length + ' escenas' }),
        h(Stat, { key: 's3', label: 'Coste de producción', value: fmtMoney(num(obj(prod.totals).cost, 0), 'USD'),
          hint: arr(prod.jobs).length + ' trabajos · real ' + fmtMoney(num(obj(an.production).realTotalUsd, 0), 'USD') }),
        h(Stat, { key: 's4', label: 'Control de marca', value: model.brandCheck ? num(bc.score, 0) + '/100' : '—',
          tone: num(bc.score, 100) >= 85 ? 'ok' : num(bc.score, 100) >= 60 ? 'warn' : 'bad',
          hint: model.brandCheck ? s(bc.level) : 'sin auditar' }),
      ]),

      h(Card, { key: 'agents', title: 'Agentes' }, [
        h('div', { className: 'ks-agents', key: 'a' }, AGENTS.map((ag) => {
          const stt = obj(stages[ag.id]);
          const status = s(stt.status) || 'idle';
          return h('div', { key: ag.id, className: cx('ks-agent', 'ks-agent-' + status) }, [
            h('div', { className: 'ks-agent-top', key: 't' }, [
              h('span', { className: 'ks-agent-emoji', key: 'e' }, ag.emoji),
              h('span', { className: 'ks-agent-n', key: 'n' }, 'Agente ' + ag.n),
              h('span', { className: cx('ks-dot', 'ks-dot-' + status), key: 'd', title: status }),
            ]),
            h('strong', { className: 'ks-agent-name', key: 'nm' }, ag.name),
            h('p', { className: 'ks-agent-desc', key: 'd2' }, ag.description),
            h('div', { className: 'ks-agent-foot', key: 'f' }, [
              h('span', { className: 'ks-agent-ms', key: 'm' }, status === 'done' ? num(stt.ms, 0) + ' ms' : status === 'error' ? s(stt.error).slice(0, 40) : 'sin ejecutar'),
              h(Btn, { key: 'r', size: 'xs', onClick: () => runStages([ag.id], ag.name) }, 'Ejecutar'),
            ]),
          ]);
        }).concat([
          h('div', { key: 'asset-manager', className: 'ks-agent ks-agent-static' }, [
            h('div', { className: 'ks-agent-top', key: 't' }, [
              h('span', { className: 'ks-agent-emoji', key: 'e' }, '🗄️'),
              h('span', { className: 'ks-agent-n', key: 'n' }, 'Agente 11'),
              h('span', { className: cx('ks-dot', assets.length ? 'ks-dot-done' : 'ks-dot-idle'), key: 'd' }),
            ]),
            h('strong', { className: 'ks-agent-name', key: 'nm' }, 'Asset Manager'),
            h('p', { className: 'ks-agent-desc', key: 'd2' },
              'Almacena imágenes, vídeos, audio, guiones, prompts, escenas, versiones e iteraciones en la instancia.'),
            h('div', { className: 'ks-agent-foot', key: 'f' }, [
              h('span', { className: 'ks-agent-ms', key: 'm' }, assets.length + ' assets · ' + arr(model.versions).length + ' versiones'),
              h(Btn, { key: 'r', size: 'xs', onClick: () => setUi({ view: 'assets' }) }, 'Abrir' ),
            ]),
          ]),
        ])),
      ]),

      model.concept ? h(Card, { key: 'idea', title: 'Concepto' }, [
        h('blockquote', { className: 'ks-bigidea', key: 'b' }, s(obj(model.concept).bigIdea)),
        h('p', { className: 'ks-lead', key: 'k' }, s(obj(model.concept).keyMessage)),
        h('div', { className: 'ks-swatches', key: 'p' },
          ['primary', 'secondary', 'accent', 'dark', 'light'].map((k) => swatch(model.brand.palette[k], k))),
      ]) : null,

      arr(model.log).length ? h(Card, { key: 'log', title: 'Registro' }, [
        h('div', { className: 'ks-log', key: 'l' }, arr(model.log).slice(-14).reverse().map((l, i) => h('div', {
          key: i, className: cx('ks-log-line', 'ks-log-' + s(l.level)),
        }, [
          h('span', { className: 'ks-log-time', key: 't' }, s(l.at).slice(11, 19)),
          h('span', { key: 'x' }, s(l.text)),
        ]))),
      ]) : null,
    ]);
  }

  // ── Brief ──────────────────────────────────────────────────────────────
  function BriefView() {
    const [uploading, setUploading] = useState(false);
    const b = model.brief;
    const setB = (k, v) => patch((m) => { m.brief[k] = v; });

    async function onFiles(files) {
      const list = Array.from(files || []);
      if (!list.length) return;
      setUploading(true);
      let ok = 0; const errs = [];
      for (const f of list) {
        try {
          const url = await uploadFile(f, 'producto');
          patch((m) => { m.brief.photos.push({ id: newId('photo'), url, caption: '', isHero: m.brief.photos.length === 0 }); });
          ok++;
        } catch (e) { errs.push(f.name + ': ' + ((e && e.message) || 'error')); }
      }
      setUploading(false);
      if (ok) notify('success', ok + ' foto(s) subidas.');
      if (errs.length) notify('error', errs.join(' · '));
    }

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Brief del producto',
        subtitle: 'Lo único obligatorio: nombre y fotos. Todo lo demás mejora la precisión del resultado.',
        actions: [h(Btn, { key: 'g', variant: 'primary', disabled: !s(b.productName).trim(),
          onClick: () => generateAll(s(b.intent) || 'Crea una campaña premium') }, 'Generar campaña')] }),

      h(Card, { key: 'photos', title: 'Fotografías del producto',
        actions: [h('label', { key: 'u', className: cx('ks-btn', 'ks-btn-primary', 'ks-btn-sm') }, [
          uploading ? 'Subiendo…' : 'Subir fotos',
          h('input', { key: 'i', type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' },
            onChange: (e) => { onFiles(e.target.files); e.target.value = ''; } }),
        ])] }, [
        arr(b.photos).length ? h('div', { className: 'ks-photos', key: 'p' }, arr(b.photos).map((ph) => h('div', {
          key: ph.id, className: cx('ks-photo', ph.isHero && 'ks-photo-hero'),
        }, [
          h('img', { key: 'i', src: ph.url, alt: s(ph.caption) || 'producto', loading: 'lazy' }),
          h('div', { className: 'ks-photo-bar', key: 'b' }, [
            h(Btn, { key: 'h', size: 'xs', variant: ph.isHero ? 'primary' : 'ghost',
              onClick: () => patch((m) => { m.brief.photos.forEach((x) => { x.isHero = x.id === ph.id; }); }),
              title: 'Marcar como toma principal' }, ph.isHero ? 'Principal' : 'Hacer principal'),
            h(Btn, { key: 'd', size: 'xs', variant: 'danger',
              onClick: () => patch((m) => { m.brief.photos = m.brief.photos.filter((x) => x.id !== ph.id); }) }, '✕'),
          ]),
        ]))) : h(Empty, { key: 'e', icon: '🖼️',
          text: 'Sin fotos. Los modelos inventarán la forma del producto si no les das una referencia real.' }),
        h('p', { className: 'ks-hint', key: 'hint' },
          'Recomendado: frontal sobre fondo limpio, tres cuartos, detalle de material y producto en uso. '
          + 'La marcada como principal es la primera referencia que reciben los modelos.'),
      ]),

      h(Card, { key: 'data', title: 'Datos' }, [
        h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
          h(Field, { key: 'n', label: 'Nombre del producto' },
            h(TextInput, { value: b.productName, placeholder: 'Zapatilla Vector Pro', onChange: (v) => setB('productName', v) })),
          h(Field, { key: 'c', label: 'Categoría', help: 'Vacío = se detecta desde el nombre y la propuesta de valor.' },
            h(TextInput, { value: b.category, placeholder: 'calzado deportivo', onChange: (v) => setB('category', v) })),
          h(Field, { key: 'p', label: 'Precio' },
            h(TextInput, { value: b.priceText, placeholder: '149', onChange: (v) => setB('priceText', v) })),
          h(Field, { key: 'cu', label: 'Moneda' },
            h(TextInput, { value: b.currency, placeholder: 'EUR', onChange: (v) => setB('currency', v) })),
          h(Field, { key: 'bu', label: 'Presupuesto de medios' },
            h(TextInput, { type: 'number', value: b.budget, onChange: (v) => setB('budget', Math.max(0, v)) })),
          h(Field, { key: 'mr', label: 'Mercado' },
            h(TextInput, { value: b.marketRegion, onChange: (v) => setB('marketRegion', v) })),
        ]),
        h(Field, { key: 'u', wide: true, label: 'Propuesta de valor', help: 'Una idea por frase. De aquí salen los atributos y los beneficios.' },
          h(TextArea, { value: b.usp, rows: 3, placeholder: 'Amortiguación de carbono. 180 g. Impermeable. Fabricada en Europa.', onChange: (v) => setB('usp', v) })),
        h(Field, { key: 'a', wide: true, label: 'Público objetivo' },
          h(TextInput, { value: b.audienceHint, placeholder: 'corredores de fondo entre 25 y 45', onChange: (v) => setB('audienceHint', v) })),
        h(Field, { key: 'i', wide: true, label: 'Intención creativa', help: 'La frase que dirige toda la campaña.' },
          h(TextInput, { value: b.intent, placeholder: 'Quiero un comercial épico', onChange: (v) => setB('intent', v) })),
        h(Field, { key: 'co', wide: true, label: 'Competencia', help: 'Una por línea. Vacío = arquetipos de la categoría.' },
          h(TextArea, { value: b.competitorsText, rows: 2, onChange: (v) => setB('competitorsText', v) })),
        h('div', { className: 'ks-grid ks-grid-2', key: 'g2' }, [
          h(Field, { key: 'm', label: 'Obligatorios', help: 'Elementos que deben aparecer sí o sí.' },
            h(TextArea, { value: b.mandatories, rows: 2, onChange: (v) => setB('mandatories', v) })),
          h(Field, { key: 'l', label: 'Legal', help: 'Disclaimers y limitaciones.' },
            h(TextArea, { value: b.legal, rows: 2, onChange: (v) => setB('legal', v) })),
        ]),
        h(Field, { key: 'e', wide: true, label: 'Notas adicionales' },
          h(TextArea, { value: b.extraNotes, rows: 2, onChange: (v) => setB('extraNotes', v) })),
      ]),

      h(Card, { key: 'dir', title: 'Dirección' }, [
        h('div', { className: 'ks-grid ks-grid-4', key: 'g' }, [
          h(Field, { key: 's', label: 'Estilo' },
            h(Select, { value: model.styleId, options: STYLES.map((x) => ({ value: x.id, label: x.emoji + ' ' + x.name })),
              onChange: (v) => { patch((m) => { m.styleId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
          h(Field, { key: 'o', label: 'Objetivo' },
            h(Select, { value: model.objectiveId, options: optsOf(OBJECTIVES),
              onChange: (v) => { patch((m) => { m.objectiveId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
          h(Field, { key: 'a', label: 'Público' },
            h(Select, { value: model.audienceId, options: optsOf(AUDIENCES),
              onChange: (v) => { patch((m) => { m.audienceId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
          h(Field, { key: 'c', label: 'Categoría' },
            h(Select, { value: model.categoryId, options: optsOf(CATEGORIES),
              onChange: (v) => { patch((m) => { m.categoryId = v; }); if (model.concept) runStages(null, 'Regeneración'); } })),
        ]),
      ]),
    ]);
  }

  // ── Investigación ──────────────────────────────────────────────────────
  function ResearchView() {
    const r = model.research;
    if (!r) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'research' }));
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Investigación', subtitle: 'Mercado, público, competencia y códigos visuales de ' + s(obj(r.market).category) + '.',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['research'], 'Research') }, 'Reinvestigar')] }),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'm', title: 'Mercado' }, [
          h('ul', { className: 'ks-list', key: 'l' }, arr(obj(r.market).trends).map((t, i) => h('li', { key: i }, t))),
          h('p', { className: 'ks-hint', key: 'se' }, 'Estacionalidad: ' + s(obj(r.market).seasonality)),
          h('p', { className: 'ks-hint', key: 'pl' }, 'Lógica de precio: ' + s(obj(r.market).priceLogic)),
        ]),
        h(Card, { key: 'a', title: 'Público · ' + s(obj(r.audience).segment) }, [
          h('div', { className: 'ks-kv', key: 'k' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Edad'), h('strong', { key: 'b' }, s(obj(r.audience).age))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'Impulso'), h('strong', { key: 'b' }, s(obj(r.audience).driver))]),
            h('div', { key: '3' }, [h('span', { key: 'a' }, 'Prueba'), h('strong', { key: 'b' }, s(obj(r.audience).proof))]),
          ]),
          h('h4', { className: 'ks-h4', key: 'h1' }, 'Comportamiento'),
          h('ul', { className: 'ks-list', key: 'b' }, arr(obj(r.audience).behaviours).map((t, i) => h('li', { key: i }, t))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'Objeciones'),
          h('ul', { className: 'ks-list', key: 'o' }, arr(obj(r.audience).objections).map((t, i) => h('li', { key: i }, t))),
          h('h4', { className: 'ks-h4', key: 'h3' }, 'Disparadores de compra'),
          h('ul', { className: 'ks-list', key: 't' }, arr(obj(r.audience).triggers).map((t, i) => h('li', { key: i }, t))),
        ]),
      ]),
      h(Card, { key: 'c', title: 'Competencia' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Competidor', 'Postura', 'Fortaleza', 'Hueco que deja'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(r.competition).map((x, i) => h('tr', { key: i }, [
            h('td', { key: 'a' }, h('strong', {}, s(x.name))), h('td', { key: 'b' }, s(x.posture)),
            h('td', { key: 'c' }, s(x.strength)), h('td', { key: 'd' }, h('em', {}, s(x.gap))),
          ]))),
        ]),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g2' }, [
        h(Card, { key: 'n', title: 'Nicho' }, [
          h('p', { className: 'ks-lead', key: 'a' }, s(obj(r.niche).statement)),
          h('p', { className: 'ks-hint', key: 'b' }, 'Espacio libre: ' + s(obj(r.niche).whiteSpace)),
        ]),
        h(Card, { key: 'v', title: 'Códigos visuales' }, [
          h('h4', { className: 'ks-h4', key: 'h1' }, 'Dominantes en la categoría'),
          h('div', { className: 'ks-chips', key: 'd' }, arr(obj(r.visualCodes).dominant).map((x, i) => h(Chip, { key: i }, x))),
          h('h4', { className: 'ks-h4', key: 'h2' }, 'A evitar'),
          h('div', { className: 'ks-chips', key: 'e' }, arr(obj(r.visualCodes).avoid).map((x, i) => h(Chip, { key: i, tone: 'bad' }, x))),
        ]),
      ]),
      h(Card, { key: 'ch', title: 'Canales recomendados' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Canal', 'CTR ref.', 'CPM ref.', 'CVR ref.', 'Ventana de gancho'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(r.channels).map((x) => h('tr', { key: x.id }, [
            h('td', { key: 'a' }, x.label), h('td', { key: 'b' }, round(x.ctr * 100, 2) + ' %'),
            h('td', { key: 'c' }, fmtMoney(x.cpm, 'USD')), h('td', { key: 'd' }, round(x.cvr * 100, 2) + ' %'),
            h('td', { key: 'e' }, x.hookSec + ' s'),
          ]))),
        ]),
        h('p', { className: 'ks-hint', key: 'n' }, 'Valores de referencia de industria por familia de plataforma. Sirven para dimensionar, no son garantía.'),
      ]),
    ]);
  }

  // ── Concepto ───────────────────────────────────────────────────────────
  function ConceptView() {
    const cn = model.concept;
    if (!cn) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'creative-director' }));
    const mb = obj(cn.moodboard);
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Concepto creativo', subtitle: s(obj(cn.direction).styleName) + ' · ' + s(obj(cn.direction).tone),
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['creative-director'], 'Creative Director') }, 'Regenerar concepto')] }),
      h(Card, { key: 'idea', title: 'Idea' }, [
        h('blockquote', { className: 'ks-bigidea', key: 'b' }, s(cn.bigIdea)),
        h('p', { className: 'ks-lead', key: 'k' }, s(cn.keyMessage)),
        h('p', { className: 'ks-hint', key: 'l' }, s(obj(cn.storytelling).logline)),
        h('div', { className: 'ks-chips', key: 'c' }, arr(cn.claims).map((x, i) => h(Chip, { key: i, tone: 'accent' }, x))),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'st', title: 'Storytelling · ' + s(obj(cn.storytelling).arcName) }, [
          h('div', { className: 'ks-beats', key: 'b' }, arr(obj(cn.storytelling).beats).map((x, i) => h('div', { key: i, className: 'ks-beat' }, [
            h('span', { className: 'ks-beat-n', key: 'n' }, i + 1), h('span', { key: 't' }, x),
          ]))),
          h('p', { className: 'ks-hint', key: 'e' }, 'Enemigo: ' + s(obj(cn.storytelling).enemy)),
          h('p', { className: 'ks-hint', key: 'p' }, 'Promesa: ' + s(obj(cn.storytelling).promise)),
        ]),
        h(Card, { key: 'em', title: 'Emociones' }, [
          h('div', { className: 'ks-chips', key: 'c' }, arr(cn.emotions).map((x, i) => h(Chip, { key: i, tone: 'accent' }, x))),
          h('h4', { className: 'ks-h4', key: 'h' }, 'Reglas de dirección'),
          h('ul', { className: 'ks-list', key: 'l' }, arr(obj(cn.direction).rules).map((x, i) => h('li', { key: i }, x))),
        ]),
      ]),
      h(Card, { key: 'ben', title: 'Atributos → beneficios → prueba' }, [
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Atributo', 'Beneficio', 'Prueba'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(cn.benefits).map((x, i) => h('tr', { key: i }, [
            h('td', { key: 'a' }, h('strong', {}, s(x.attribute))), h('td', { key: 'b' }, s(x.benefit)), h('td', { key: 'c' }, h('em', {}, s(x.proof))),
          ]))),
        ]),
      ]),
      h(Card, { key: 'money', title: 'Money shot' }, [
        h('p', { className: 'ks-lead', key: 'd' }, s(obj(cn.moneyShot).description)),
        h('div', { className: 'ks-chips', key: 'c' }, [
          h(Chip, { key: '1' }, labelOf(SHOTS, obj(cn.moneyShot).shot)),
          h(Chip, { key: '2' }, labelOf(LENSES, obj(cn.moneyShot).lens)),
          h(Chip, { key: '3' }, labelOf(MOVES, obj(cn.moneyShot).move)),
          h(Chip, { key: '4' }, labelOf(LIGHTING, obj(cn.moneyShot).lighting)),
          h(Chip, { key: '5' }, labelOf(GRADES, obj(cn.moneyShot).grade)),
          h(Chip, { key: '6' }, labelOf(FX, obj(cn.moneyShot).fx)),
        ]),
        h('p', { className: 'ks-hint', key: 'w' }, 'Por qué vende: ' + s(obj(cn.moneyShot).whyItSells)),
      ]),
      h(Card, { key: 'mood', title: 'Moodboard' }, [
        h('div', { className: 'ks-swatches', key: 'p' },
          Object.keys(obj(mb.palette)).map((k) => swatch(obj(mb.palette)[k], k))),
        arr(model.brief.photos).length ? h('div', { className: 'ks-moodphotos', key: 'ph' },
          arr(model.brief.photos).slice(0, 6).map((p) => h('img', { key: p.id, src: p.url, alt: '' }))) : null,
        h('div', { className: 'ks-grid ks-grid-3', key: 'g' }, [
          h('div', { key: 'r' }, [h('h4', { className: 'ks-h4', key: 'h' }, 'Referencias'),
            h('ul', { className: 'ks-list', key: 'l' }, arr(mb.references).map((x, i) => h('li', { key: i }, x)))]),
          h('div', { key: 't' }, [h('h4', { className: 'ks-h4', key: 'h' }, 'Texturas y códigos'),
            h('ul', { className: 'ks-list', key: 'l' }, arr(mb.textures).map((x, i) => h('li', { key: i }, x)))]),
          h('div', { key: 'l' }, [h('h4', { className: 'ks-h4', key: 'h' }, 'Óptica e iluminación'),
            h('div', { className: 'ks-chips', key: 'c' }, arr(mb.lensKit).concat(arr(mb.lightingNotes)).map((x, i) => h(Chip, { key: i }, x)))]),
        ]),
        h('h4', { className: 'ks-h4', key: 'h2' }, 'Prohibido'),
        h('div', { className: 'ks-chips', key: 'dn' }, arr(mb.doNot).map((x, i) => h(Chip, { key: i, tone: 'bad' }, x))),
      ]),
    ]);
  }

  // ── Plan ───────────────────────────────────────────────────────────────
  function PlanView() {
    const p = model.plan;
    if (!p) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'planner' }));
    const cur = s(obj(p.budget).currency) || 'USD';
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Plan de campaña',
        subtitle: s(obj(p.objective).label) + ' · ' + fmtMoney(num(obj(p.budget).total, 0), cur) + ' · KPI: ' + s(obj(p.objective).kpi),
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['planner'], 'Campaign Planner') }, 'Recalcular plan')] }),
      h(Card, { key: 'f', title: 'Funnel' }, [
        h('div', { className: 'ks-funnel', key: 'f' }, arr(p.funnel).map((st0) => h('div', { key: st0.id, className: 'ks-funnel-stage' }, [
          h('div', { className: 'ks-funnel-head', key: 'h' }, [
            h('strong', { key: 'l' }, st0.label),
            h('span', { className: 'ks-funnel-pct', key: 'p' }, st0.sharePct + ' %'),
          ]),
          h(Bar, { key: 'b', value: st0.sharePct * 2, tone: 'accent' }),
          h('p', { className: 'ks-funnel-goal', key: 'g' }, st0.goal),
          h('div', { className: 'ks-kv ks-kv-sm', key: 'k' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Presupuesto'), h('strong', { key: 'b' }, fmtMoney(st0.budget, st0.currency))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'Impresiones'), h('strong', { key: 'b' }, num(obj(st0.projection).impressions, 0).toLocaleString('es'))]),
            h('div', { key: '3' }, [h('span', { key: 'a' }, 'Clics'), h('strong', { key: 'b' }, num(obj(st0.projection).clicks, 0).toLocaleString('es'))]),
            h('div', { key: '4' }, [h('span', { key: 'a' }, 'Acciones'), h('strong', { key: 'b' }, num(obj(st0.projection).actions, 0).toLocaleString('es'))]),
          ]),
          h('p', { className: 'ks-hint', key: 'm' }, 'Mensaje: ' + st0.message),
          h('p', { className: 'ks-hint', key: 'c' }, st0.creativeNote),
          h('div', { className: 'ks-chips', key: 'ch' }, arr(st0.channels).map((c0, i) => h(Chip, { key: i }, c0))
            .concat(arr(st0.formats).map((f, i) => h(Chip, { key: 'f' + i, tone: 'accent' }, f)))),
        ]))),
      ]),
      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 'k', title: 'KPIs' }, [
          h('table', { className: 'ks-table', key: 't' }, [
            h('thead', { key: 'h' }, h('tr', {}, ['KPI', 'Objetivo', 'Por qué'].map((x) => h('th', { key: x }, x)))),
            h('tbody', { key: 'b' }, arr(p.kpis).map((k) => h('tr', { key: k.id }, [
              h('td', { key: 'a' }, h('strong', {}, k.label)), h('td', { key: 'b' }, k.target), h('td', { key: 'c' }, h('em', {}, k.why)),
            ]))),
          ]),
        ]),
        h(Card, { key: 'c', title: 'Calendario' }, [
          h('div', { className: 'ks-weeks', key: 'w' }, arr(p.calendar).map((w) => h('div', { key: w.week, className: 'ks-week' }, [
            h('strong', { key: 'h' }, 'Semana ' + w.week + ' · ' + w.focus),
            h('ul', { className: 'ks-list', key: 'l' }, arr(w.actions).map((a, i) => h('li', { key: i }, a))),
          ]))),
        ]),
      ]),
      h(Card, { key: 't', title: 'Plan de pruebas' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(p.testPlan).map((x, i) => h('li', { key: i }, x))),
      ]),
    ]);
  }
