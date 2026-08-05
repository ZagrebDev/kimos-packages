
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Distribución y sistema: Copy, Marca, Biblioteca, Analytics,
  //       Estilos, Versiones y Ajustes
  // ═════════════════════════════════════════════════════════════════════════

  function CopyView() {
    const cp = model.copy;
    if (!cp) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'copywriter' }));
    const platforms = uniq(arr(cp.ads).map((a) => a.platform));
    const sel = ui.platformSel && platforms.indexOf(ui.platformSel) >= 0 ? ui.platformSel : (platforms[0] || '');
    const ads = arr(cp.ads).filter((a) => a.platform === sel);
    const ld = obj(cp.landing);

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Copy',
        subtitle: arr(cp.ads).length + ' anuncios · ' + platforms.length + ' plataformas · ' + arr(cp.emails).length + ' emails',
        actions: [
          h(Btn, { key: 'c', onClick: () => download(slug(model.title) + '-copy.csv', exportCopyCsv(model), 'text/csv') }, 'CSV'),
          h(Btn, { key: 'r', variant: 'ghost', onClick: () => runStages(['copywriter'], 'Copywriter') }, 'Regenerar'),
        ] }),

      h(Card, { key: 'hk', title: 'Ganchos' }, [
        h('div', { className: 'ks-hooks', key: 'h' }, arr(cp.hooks).map((x) => h('div', { key: x.id, className: 'ks-hook' }, [
          h('span', { className: 'ks-hook-label', key: 'l' }, x.label),
          h('p', { key: 't' }, x.text),
          h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(x.text, 'Gancho') }, 'Copiar'),
        ]))),
      ]),

      h(Card, { key: 'ads', title: 'Anuncios' }, [
        h('div', { className: 'ks-tabs', key: 't' }, platforms.map((pid) => {
          const p = PLATFORMS.find((x) => x.id === pid);
          return h('button', { key: pid, type: 'button', className: cx('ks-tab', sel === pid && 'ks-tab-on'),
            onClick: () => setUi({ platformSel: pid }) }, p ? p.label : pid);
        })),
        h('div', { className: 'ks-ads', key: 'a' }, ads.map((a) => h('div', { key: a.id, className: cx('ks-ad', a.overLimit && 'ks-ad-bad') }, [
          h('div', { className: 'ks-ad-head', key: 'h' }, [
            h('strong', { key: 'v' }, 'Variante ' + a.variant),
            h(Chip, { key: 'p', tone: 'accent' }, a.hookLabel),
            h(Btn, { key: 'c', size: 'xs', onClick: () => copyText([a.primary, '', a.headline, a.description, a.cta].filter(Boolean).join('\n'), 'Anuncio') }, 'Copiar'),
          ]),
          h('pre', { className: 'ks-ad-primary', key: 'p' }, s(a.primary)),
          h('div', { className: 'ks-ad-meta', key: 'm' }, [
            h('div', { key: 'h' }, [h('span', { key: 'l' }, 'Titular'), h('strong', { key: 'v' }, a.headline),
              h('em', { key: 'c' }, a.headline.length + '/' + (a.limits.headline || '∞'))]),
            a.description ? h('div', { key: 'd' }, [h('span', { key: 'l' }, 'Descripción'), h('strong', { key: 'v' }, a.description)]) : null,
            h('div', { key: 'c' }, [h('span', { key: 'l' }, 'CTA'), h('strong', { key: 'v' }, a.cta)]),
            h('div', { key: 'n' }, [h('span', { key: 'l' }, 'Texto principal'),
              h('em', { key: 'c' }, a.primary.length + '/' + (a.limits.primary || '∞'))]),
          ]),
          h('p', { className: 'ks-hint', key: 'n' }, a.notes),
          a.overLimit ? h('p', { className: 'ks-warn', key: 'w' }, 'Excede el límite de caracteres de la plataforma.') : null,
        ]))),
      ]),

      h(Card, { key: 'ld', title: 'Landing' }, [
        h('div', { className: 'ks-landing', key: 'l' }, [
          h('div', { className: 'ks-landing-hero', key: 'h' }, [
            h('span', { className: 'ks-landing-eyebrow', key: 'e' }, s(obj(ld.hero).eyebrow)),
            h('h3', { key: 'h' }, s(obj(ld.hero).headline)),
            h('p', { key: 's' }, s(obj(ld.hero).subheadline)),
            h('div', { className: 'ks-chips', key: 'c' }, [
              h(Chip, { key: '1', tone: 'accent' }, s(obj(ld.hero).cta)),
              h(Chip, { key: '2' }, s(obj(ld.hero).ctaSecondary)),
            ]),
            h('p', { className: 'ks-hint', key: 'n' }, s(obj(ld.hero).note)),
          ]),
          h('div', { className: 'ks-grid ks-grid-3', key: 'v' }, arr(ld.valueProps).map((v, i) => h('div', { key: i, className: 'ks-vp' }, [
            h('strong', { key: 't' }, v.title), h('p', { key: 'b' }, v.body),
          ]))),
          h('h4', { className: 'ks-h4', key: 'ph' }, s(obj(ld.proof).title)),
          h('ul', { className: 'ks-list', key: 'pl' }, arr(obj(ld.proof).items).map((x, i) => h('li', { key: i }, x))),
          h('h4', { className: 'ks-h4', key: 'oh' }, 'Objeciones'),
          h('div', { className: 'ks-faq', key: 'o' }, arr(ld.objections).map((o, i) => h('div', { key: i, className: 'ks-faq-item' }, [
            h('strong', { key: 'q' }, o.question), h('p', { key: 'a' }, o.answer),
          ]))),
          h('h4', { className: 'ks-h4', key: 'sh' }, 'SEO'),
          h('div', { className: 'ks-kv', key: 'seo' }, [
            h('div', { key: '1' }, [h('span', { key: 'a' }, 'Title'), h('strong', { key: 'b' }, s(obj(ld.seo).title))]),
            h('div', { key: '2' }, [h('span', { key: 'a' }, 'Description'), h('strong', { key: 'b' }, s(obj(ld.seo).description))]),
          ]),
          h('div', { className: 'ks-chips', key: 'kw' }, arr(obj(ld.seo).keywords).map((k, i) => h(Chip, { key: i }, k))),
        ]),
      ]),

      h(Card, { key: 'em', title: 'Secuencia de email' }, [
        h('div', { className: 'ks-emails', key: 'e' }, arr(cp.emails).map((e, i) => h('div', { key: i, className: 'ks-email' }, [
          h('div', { className: 'ks-email-head', key: 'h' }, [
            h(Chip, { key: 'd', tone: 'accent' }, 'Día ' + e.day),
            h('strong', { key: 's' }, e.subject),
            h('span', { className: 'ks-email-stage', key: 'st' }, e.stage),
          ]),
          h('p', { className: 'ks-email-pre', key: 'p' }, e.preheader),
          h('pre', { className: 'ks-email-body', key: 'b' }, s(e.body)),
          h('div', { className: 'ks-chips', key: 'c' }, [h(Chip, { key: 'c', tone: 'accent' }, e.cta)]),
        ]))),
      ]),
    ]);
  }

  // ── Marca ──────────────────────────────────────────────────────────────
  function BrandView() {
    const b = model.brand;
    const bc = model.brandCheck;
    const st = styleById(model.styleId);
    const setBrand = (fn) => patch((m) => fn(m.brand));
    const [uploadingLogo, setUploadingLogo] = useState(false);

    async function onLogo(file) {
      if (!file) return;
      setUploadingLogo(true);
      try {
        const url = await uploadFile(file, 'marca');
        setBrand((br) => { br.logoUrl = url; });
        await saveAsset({ url, kind: 'logo', name: file.name, note: 'Logotipo de marca' });
        notify('success', 'Logotipo cargado.');
      } catch (e) { notify('error', 'No se pudo subir: ' + ((e && e.message) || 'error')); }
      setUploadingLogo(false);
    }

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Marca',
        subtitle: 'Consistencia de paleta, tipografía, logotipo, producto, personajes y tono.',
        actions: [h(Btn, { key: 'a', variant: 'primary', onClick: () => runStages(['brand-consistency'], 'Brand Consistency') }, 'Auditar marca')] }),

      bc ? h(Card, { key: 'sc', title: 'Auditoría' }, [
        h('div', { className: 'ks-score', key: 's' }, [
          h('div', { className: cx('ks-score-num', num(bc.score, 0) >= 85 ? 'ks-ok' : num(bc.score, 0) >= 60 ? 'ks-warn2' : 'ks-bad'), key: 'n' }, num(bc.score, 0)),
          h('div', { key: 'd' }, [
            h('strong', { key: 'l' }, s(bc.level)),
            h('p', { className: 'ks-hint', key: 'c' }, obj(bc.counts).error + ' errores · ' + obj(bc.counts).warn + ' avisos · ' + obj(bc.counts).info + ' notas'),
          ]),
          h(Bar, { key: 'b', value: num(bc.score, 0), tone: num(bc.score, 0) >= 85 ? 'ok' : num(bc.score, 0) >= 60 ? 'warn' : 'bad' }),
        ]),
        h('div', { className: 'ks-findings', key: 'f' }, arr(bc.findings).map((f, i) => h('div', { key: i, className: cx('ks-finding', 'ks-sev-' + f.severity) }, [
          h('span', { className: 'ks-finding-area', key: 'a' }, f.area),
          h('p', { key: 't' }, f.text),
          f.fix ? h('p', { className: 'ks-finding-fix', key: 'f' }, '→ ' + f.fix) : null,
        ]))),
        h('h4', { className: 'ks-h4', key: 'lh' }, 'Reglas bloqueadas'),
        h('ul', { className: 'ks-list', key: 'lr' }, arr(bc.lockedRules).map((x, i) => h('li', { key: i }, x))),
      ]) : null,

      h(Card, { key: 'p', title: 'Paleta' }, [
        h('div', { className: 'ks-grid ks-grid-5', key: 'g' }, ['primary', 'secondary', 'accent', 'dark', 'light'].map((k) => h(Field, {
          key: k, label: k,
        }, h(ColorInput, { value: b.palette[k], onChange: (v) => setBrand((br) => { br.palette[k] = v; }) })))),
        h('div', { className: 'ks-cardfoot', key: 'f' }, [
          h(Btn, { key: 'a', size: 'sm', onClick: () => setBrand((br) => { br.palette = Object.assign({}, st.palette); }) },
            'Aplicar paleta del estilo ' + st.name),
        ]),
      ]),

      h('div', { className: 'ks-grid ks-grid-2', key: 'g' }, [
        h(Card, { key: 't', title: 'Tipografía' }, [
          h(Field, { key: 'd', wide: true, label: 'Titulares', help: 'Sugerencia del estilo: ' + st.typography.display },
            h(TextInput, { value: b.typography.display, onChange: (v) => setBrand((br) => { br.typography.display = v; }) })),
          h(Field, { key: 'b', wide: true, label: 'Texto', help: 'Sugerencia del estilo: ' + st.typography.body },
            h(TextInput, { value: b.typography.body, onChange: (v) => setBrand((br) => { br.typography.body = v; }) })),
          h(Field, { key: 'k', wide: true, label: 'Interletraje' },
            h(Select, { value: b.typography.tracking, options: ['cerrado', 'normal', 'amplio', 'muy amplio'].map((x) => ({ value: x, label: x })),
              onChange: (v) => setBrand((br) => { br.typography.tracking = v; }) })),
        ]),
        h(Card, { key: 'l', title: 'Logotipo' }, [
          b.logoUrl ? h('div', { className: 'ks-logo', key: 'i' }, h('img', { src: b.logoUrl, alt: 'logotipo' })) : null,
          h('label', { key: 'u', className: cx('ks-btn', 'ks-btn-sm') }, [
            uploadingLogo ? 'Subiendo…' : (b.logoUrl ? 'Reemplazar logotipo' : 'Subir logotipo'),
            h('input', { key: 'i', type: 'file', accept: 'image/png,image/svg+xml,image/webp', style: { display: 'none' },
              onChange: (e) => { onLogo(e.target.files && e.target.files[0]); e.target.value = ''; } }),
          ]),
          h(Field, { key: 'sa', wide: true, label: 'Área de reserva (%)' },
            h(TextInput, { type: 'number', min: 0, max: 40, value: b.logoSafeArea, onChange: (v) => setBrand((br) => { br.logoSafeArea = clamp(v, 0, 40); }) })),
          h(Field, { key: 'sl', wide: true, label: 'Eslogan' },
            h(TextInput, { value: b.slogan, onChange: (v) => setBrand((br) => { br.slogan = v; }) })),
        ]),
      ]),

      h(Card, { key: 'lock', title: 'Consistencia de producto y personajes' }, [
        h(Field, { key: 'p', wide: true, label: 'Bloqueo de producto',
          help: 'Se inyecta en todos los prompts para que el modelo no reinvente la forma ni la marca.' },
          h(TextArea, { value: b.productLock, rows: 2,
            placeholder: 'Zapatilla blanca con suela de carbono negra, logo lateral bordado en rojo, cordones planos.',
            onChange: (v) => setBrand((br) => { br.productLock = v; }) })),
        h(Field, { key: 'c', wide: true, label: 'Bloqueo de personaje',
          help: 'Edad, aspecto y vestuario, para que sea la misma persona en todos los planos.' },
          h(TextArea, { value: b.characterLock, rows: 2, onChange: (v) => setBrand((br) => { br.characterLock = v; }) })),
        h(Field, { key: 't', wide: true, label: 'Tono de marca', help: 'Vacío = tono del estilo: ' + st.tone },
          h(TextInput, { value: b.tone, onChange: (v) => setBrand((br) => { br.tone = v; }) })),
        h(Field, { key: 'f', wide: true, label: 'Términos prohibidos', help: 'Separados por comas. La auditoría marca el copy que los use.' },
          h(TextInput, { value: arr(b.forbidden).join(', '),
            onChange: (v) => setBrand((br) => { br.forbidden = uniq(s(v).split(',').map((x) => x.trim())); }) })),
      ]),
    ]);
  }

  // ── Biblioteca de assets ───────────────────────────────────────────────
  function AssetsView() {
    const [uploading, setUploading] = useState(false);
    const filter = s(ui.assetFilter) || 'all';
    const list = filter === 'all' ? assets : assets.filter((a) => a.kind === filter);
    const totalCost = round(assets.reduce((a, x) => a + num(x.costUsd, 0), 0), 2);

    async function onFiles(files) {
      const fs2 = Array.from(files || []);
      if (!fs2.length) return;
      setUploading(true);
      let ok = 0;
      for (const f of fs2) {
        try {
          const url = await uploadFile(f, 'assets');
          await saveAsset({ url, name: f.name, sceneId: ui.sceneSel || '' });
          ok++;
        } catch (e) { notify('error', f.name + ': ' + ((e && e.message) || 'error')); }
      }
      setUploading(false);
      if (ok) notify('success', ok + ' asset(s) añadidos.');
    }

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Biblioteca',
        subtitle: assets.length + ' assets · ' + fmtMoney(totalCost, 'USD') + ' de coste registrado'
          + (hasItems ? '' : ' · almacenamiento local (esta ventana)'),
        actions: [h('label', { key: 'u', className: cx('ks-btn', 'ks-btn-primary', 'ks-btn-sm') }, [
          uploading ? 'Subiendo…' : 'Subir archivos',
          h('input', { key: 'i', type: 'file', multiple: true, style: { display: 'none' },
            onChange: (e) => { onFiles(e.target.files); e.target.value = ''; } }),
        ])] }),
      h('div', { className: 'ks-tabs', key: 't' }, [{ id: 'all', label: 'Todos (' + assets.length + ')' }]
        .concat(ASSET_KINDS.map((k) => ({ id: k.id, label: k.emoji + ' ' + k.label + ' (' + assets.filter((a) => a.kind === k.id).length + ')' })))
        .map((t) => h('button', { key: t.id, type: 'button', className: cx('ks-tab', filter === t.id && 'ks-tab-on'),
          onClick: () => setUi({ assetFilter: t.id }) }, t.label))),
      list.length ? h('div', { className: 'ks-assets', key: 'a' }, list.map((a) => h('div', { key: a.id, className: 'ks-asset' }, [
        h('div', { className: 'ks-asset-thumb', key: 't' },
          a.kind === 'image' || a.kind === 'logo' ? h('img', { src: a.url, alt: '', loading: 'lazy' })
            : a.kind === 'video' ? h('video', { src: a.url, controls: true, preload: 'metadata' })
              : a.kind === 'audio' ? h('audio', { src: a.url, controls: true })
                : h('span', { className: 'ks-asset-icon' }, (ASSET_KINDS.find((k) => k.id === a.kind) || {}).emoji || '📄')),
        h('div', { className: 'ks-asset-meta', key: 'm' }, [
          h('strong', { key: 'n', title: a.name }, s(a.name).slice(0, 40)),
          h('div', { className: 'ks-chips', key: 'c' }, [
            a.code ? h(Chip, { key: 's' }, a.code) : null,
            a.providerId ? h(Chip, { key: 'p' }, a.providerId) : null,
            h(Chip, { key: 'v' }, 'v' + a.version),
            a.costUsd ? h(Chip, { key: 'co' }, fmtMoney(a.costUsd, 'USD')) : null,
          ].filter(Boolean)),
          h('div', { className: 'ks-asset-actions', key: 'a' }, [
            h(Btn, { key: 'ap', size: 'xs', variant: a.approved ? 'primary' : 'ghost',
              onClick: () => saveAsset(Object.assign({}, a, { approved: !a.approved })) }, a.approved ? 'Aprobado' : 'Aprobar'),
            h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(a.url, 'URL') }, 'URL'),
            h(Btn, { key: 'd', size: 'xs', variant: 'danger',
              onClick: () => removeAsset(a.id).catch((e) => notify('error', (e && e.message) || 'error')) }, '✕'),
          ]),
        ]),
      ]))) : h(Empty, { key: 'e', icon: '▣',
        text: 'Sin assets todavía. Sube archivos o deja que el agente registre lo que genere con REGISTER_ASSET.' }),
    ]);
  }

  // ── Analytics ──────────────────────────────────────────────────────────
  function AnalyticsView() {
    const an = model.analytics;
    if (!an) return h('div', { className: 'ks-view' }, h(NotReady, { agentId: 'analytics' }));
    const pr = obj(an.production);
    const md = obj(an.media);
    const maxProv = Math.max.apply(null, [1].concat(Object.keys(obj(pr.estByProvider)).map((k) => pr.estByProvider[k])));
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Analytics',
        subtitle: 'Costes de producción, consumo por proveedor y proyección de medios.',
        actions: [h(Btn, { key: 'r', onClick: () => runStages(['analytics'], 'Analytics') }, 'Recalcular')] }),
      h('div', { className: 'ks-grid ks-grid-4', key: 's' }, [
        h(Stat, { key: '1', label: 'Coste estimado', value: fmtMoney(num(pr.estTotalUsd, 0), 'USD'), hint: num(pr.jobs, 0) + ' trabajos' }),
        h(Stat, { key: '2', label: 'Coste real', value: fmtMoney(num(pr.realTotalUsd, 0), 'USD'),
          tone: num(pr.varianceUsd, 0) > 0 ? 'bad' : 'ok',
          hint: (num(pr.varianceUsd, 0) >= 0 ? '+' : '') + fmtMoney(num(pr.varianceUsd, 0), 'USD') + ' de desviación' }),
        h(Stat, { key: '3', label: 'Progreso de producción', value: num(pr.progress, 0) + ' %', hint: num(pr.done, 0) + ' completados' }),
        h(Stat, { key: '4', label: 'Tiempo de máquina', value: num(pr.estMinutes, 0) + ' min', hint: 'estimación' }),
      ]),
      h(Card, { key: 'cons', title: 'Consumo registrado' }, [
        h('div', { className: 'ks-kv', key: 'k' }, [
          h('div', { key: '1' }, [h('span', { key: 'a' }, 'Llamadas'), h('strong', { key: 'b' }, num(obj(pr.consumption).calls, 0))]),
          h('div', { key: '2' }, [h('span', { key: 'a' }, 'Tokens'), h('strong', { key: 'b' }, num(obj(pr.consumption).tokens, 0).toLocaleString('es'))]),
          h('div', { key: '3' }, [h('span', { key: 'a' }, 'Segundos de vídeo'), h('strong', { key: 'b' }, num(obj(pr.consumption).seconds, 0))]),
          h('div', { key: '4' }, [h('span', { key: 'a' }, 'Imágenes'), h('strong', { key: 'b' }, num(obj(pr.consumption).images, 0))]),
        ]),
      ]),
      h(Card, { key: 'prov', title: 'Coste por proveedor' }, [
        h('div', { className: 'ks-bars', key: 'b' }, Object.keys(obj(pr.estByProvider)).map((k) => h('div', { key: k, className: 'ks-barrow' }, [
          h('span', { className: 'ks-barrow-label', key: 'l' }, (getProvider(k) || { label: k }).label),
          h(Bar, { key: 'b', value: (pr.estByProvider[k] / maxProv) * 100, tone: 'accent' }),
          h('span', { className: 'ks-barrow-value', key: 'v' }, fmtMoney(pr.estByProvider[k], 'USD')
            + (obj(pr.realByProvider)[k] ? ' · real ' + fmtMoney(pr.realByProvider[k], 'USD') : '')),
        ]))),
      ]),
      h(Card, { key: 'media', title: 'Proyección de medios' }, [
        h('p', { className: 'ks-hint', key: 'd' }, s(an.disclaimer)),
        h('table', { className: 'ks-table', key: 't' }, [
          h('thead', { key: 'h' }, h('tr', {}, ['Canal', 'Inversión', 'Impresiones', 'Clics', 'Acciones', 'CPC', 'CPA'].map((x) => h('th', { key: x }, x)))),
          h('tbody', { key: 'b' }, arr(md.byChannel).map((x) => h('tr', { key: x.id }, [
            h('td', { key: 'a' }, x.label), h('td', { key: 'b' }, fmtMoney(x.spend, x.currency)),
            h('td', { key: 'c' }, x.impressions.toLocaleString('es')), h('td', { key: 'd' }, x.clicks.toLocaleString('es')),
            h('td', { key: 'e' }, x.actions.toLocaleString('es')), h('td', { key: 'f' }, fmtMoney(x.cpc, x.currency)),
            h('td', { key: 'g' }, fmtMoney(x.cpa, x.currency)),
          ]))),
        ]),
        h('div', { className: 'ks-grid ks-grid-4', key: 's' }, [
          h(Stat, { key: '1', label: 'CTR esperado', value: num(md.expectedCtrPct, 0) + ' %', hint: 'con ajuste creativo ×' + num(md.upliftFactor, 1) }),
          h(Stat, { key: '2', label: 'CPA proyectado', value: fmtMoney(num(md.cpa, 0), an.currency) }),
          h(Stat, { key: '3', label: 'Ingreso proyectado', value: md.estimatedRevenue ? fmtMoney(md.estimatedRevenue, an.currency) : '—',
            hint: md.estimatedRevenue ? 'con el precio del brief' : 'indica el precio en el brief' }),
          h(Stat, { key: '4', label: 'ROAS proyectado', value: md.estimatedRoas != null ? md.estimatedRoas + '×' : '—',
            tone: num(md.estimatedRoas, 0) >= 2.5 ? 'ok' : 'warn' }),
        ]),
        h('h4', { className: 'ks-h4', key: 'uh' }, 'Ajuste creativo'),
        h('ul', { className: 'ks-list', key: 'ul' }, arr(md.upliftReasons).map((x, i) => h('li', { key: i }, x))),
      ]),
      arr(an.recommendations).length ? h(Card, { key: 'rec', title: 'Recomendaciones' }, [
        h('ul', { className: 'ks-list', key: 'l' }, arr(an.recommendations).map((x, i) => h('li', { key: i }, x))),
      ]) : null,
    ]);
  }

  // ── Marketplace de estilos ─────────────────────────────────────────────
  function StylesView() {
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Marketplace de estilos',
        subtitle: 'Cada estilo es una dirección creativa completa: paleta, óptica, luz, color, ritmo, música, tipografía y tono. Aplicarlo regenera la campaña entera.' }),
      h('div', { className: 'ks-styles', key: 's' }, STYLES.map((st) => h('div', {
        key: st.id, className: cx('ks-style', model.styleId === st.id && 'ks-style-on'),
      }, [
        h('div', { className: 'ks-style-palette', key: 'p' },
          ['primary', 'secondary', 'accent', 'dark', 'light'].map((k) => h('span', {
            key: k, style: { background: st.palette[k] } }))),
        h('div', { className: 'ks-style-body', key: 'b' }, [
          h('div', { className: 'ks-style-head', key: 'h' }, [
            h('span', { className: 'ks-style-emoji', key: 'e' }, st.emoji),
            h('strong', { key: 'n' }, st.name),
            model.styleId === st.id ? h(Chip, { key: 'a', tone: 'accent' }, 'Activo') : null,
          ]),
          h('p', { className: 'ks-style-tag', key: 't' }, st.tagline),
          h('div', { className: 'ks-style-specs', key: 's' }, [
            h('span', { key: '1' }, st.pacing.avgShotSec + ' s/plano'),
            h('span', { key: '2' }, st.pacing.cutsPerMin + ' cortes/min'),
            h('span', { key: '3' }, st.music.genre + ' · ' + st.music.bpm + ' bpm'),
            h('span', { key: '4' }, labelOf(GRADES, st.grades[0])),
            h('span', { key: '5' }, labelOf(LENSES, st.lenses[0])),
          ]),
          h('p', { className: 'ks-hint', key: 'to' }, 'Tono: ' + st.tone),
          h('p', { className: 'ks-hint', key: 'r' }, 'Referencias: ' + st.refs.join(' · ')),
          h(Btn, { key: 'a', size: 'sm', variant: model.styleId === st.id ? 'ghost' : 'primary',
            disabled: model.styleId === st.id,
            onClick: () => dispatch({ type: 'SET_DIRECTION', payload: { styleId: st.id } }) },
            model.styleId === st.id ? 'En uso' : 'Aplicar estilo'),
        ]),
      ]))),
    ]);
  }

  // ── Versiones ──────────────────────────────────────────────────────────
  function VersionsView() {
    const [label, setLabel] = useState('');
    const vs = arr(model.versions).slice().reverse();
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Versiones',
        subtitle: vs.length + ' de ' + VERSIONS_MAX + ' · cada versión guarda la campaña completa.' }),
      h(Card, { key: 'n', title: 'Nueva versión' }, [
        h('div', { className: 'ks-genrow', key: 'g' }, [
          h(TextInput, { key: 'i', value: label, placeholder: 'Corte de 15 s para TikTok', onChange: setLabel }),
          h(Btn, { key: 'b', variant: 'primary', onClick: () => { createVersion(label); setLabel(''); } }, 'Guardar versión'),
        ]),
      ]),
      vs.length ? h('div', { className: 'ks-versions', key: 'v' }, vs.map((v) => h('div', { key: v.id, className: 'ks-version' }, [
        h('div', { className: 'ks-version-head', key: 'h' }, [
          h('strong', { key: 'l' }, v.label),
          h('span', { className: 'ks-version-date', key: 'd' }, s(v.at).replace('T', ' ').slice(0, 16)),
        ]),
        h('div', { className: 'ks-kv ks-kv-sm', key: 'k' }, Object.keys(obj(v.summary)).slice(0, 8).map((k) => h('div', { key: k }, [
          h('span', { key: 'a' }, k), h('strong', { key: 'b' }, s(obj(v.summary)[k])),
        ]))),
        h('div', { className: 'ks-version-actions', key: 'a' }, [
          h(Btn, { key: 'r', size: 'sm', variant: 'primary', onClick: () => restoreVersion(v.id) }, 'Restaurar'),
          h(Btn, { key: 'd', size: 'sm', variant: 'danger',
            onClick: () => patch((m) => { m.versions = arr(m.versions).filter((x) => x.id !== v.id); }) }, 'Eliminar'),
        ]),
      ]))) : h(Empty, { key: 'e', icon: '⧉', text: 'Sin versiones guardadas.' }),
    ]);
  }

  // ── Ajustes ────────────────────────────────────────────────────────────
  function SettingsView() {
    const st0 = model.settings;
    const setS = (fn) => patch((m) => fn(m.settings));
    const toggleIn = (listKey, id) => setS((sx) => {
      const cur = arr(sx.targets[listKey]);
      sx.targets[listKey] = cur.indexOf(id) >= 0 ? cur.filter((x) => x !== id) : cur.concat([id]);
      if (!sx.targets[listKey].length) sx.targets[listKey] = [id];
    });

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Ajustes',
        subtitle: 'Proveedores, formatos de entrega y parámetros de producción.',
        actions: [h(Btn, { key: 'r', variant: 'primary', disabled: !model.concept, onClick: () => runStages(null, 'Pipeline') }, 'Aplicar y regenerar')] }),

      h(Card, { key: 'p', title: 'Proveedores de IA' }, [
        h('p', { className: 'ks-hint', key: 'i' },
          'Cada capacidad usa un proveedor intercambiable. Los agentes producen un PromptSpec neutral; '
          + 'el registro lo traduce al dialecto de cada modelo. Cambiar de proveedor reescribe los prompts sin tocar nada más.'),
        h('div', { className: 'ks-grid ks-grid-3', key: 'g' }, CAPABILITIES.map((cap) => {
          const cur = getProvider(st0.providers[cap.id]);
          return h(Field, { key: cap.id, label: cap.emoji + ' ' + cap.label,
            help: cur ? cur.vendor + ' · ' + (cur.cost ? fmtMoney(cur.cost.amount, cur.cost.currency) + '/' + cur.cost.unit : 'sin coste') : '' },
            h(Select, { value: s(st0.providers[cap.id]), options: providersFor(cap.id).map((x) => ({ value: x.id, label: x.label })),
              onChange: (v) => dispatch({ type: 'SET_PROVIDER', payload: { capability: cap.id, providerId: v } }) }));
        })),
      ]),

      h(Card, { key: 'f', title: 'Formatos de entrega' }, [
        h(Field, { key: 'a', wide: true, label: 'Relaciones de aspecto' },
          h('div', { className: 'ks-chips' }, ASPECTS.map((a) => h(Chip, {
            key: a.id, tone: arr(st0.targets.aspects).indexOf(a.id) >= 0 ? 'accent' : null,
            onClick: () => toggleIn('aspects', a.id),
          }, a.label)))),
        h(Field, { key: 'r', wide: true, label: 'Resoluciones' },
          h('div', { className: 'ks-chips' }, RESOLUTIONS.map((r) => h(Chip, {
            key: r.id, tone: arr(st0.targets.resolutions).indexOf(r.id) >= 0 ? 'accent' : null,
            onClick: () => toggleIn('resolutions', r.id),
          }, r.label)))),
        h(Field, { key: 'p', wide: true, label: 'Plataformas' },
          h('div', { className: 'ks-chips' }, PLATFORMS.map((p) => h(Chip, {
            key: p.id, tone: arr(st0.targets.platforms).indexOf(p.id) >= 0 ? 'accent' : null,
            onClick: () => toggleIn('platforms', p.id),
          }, p.label)))),
        h('p', { className: 'ks-hint', key: 'n' },
          arr(st0.targets.aspects).length * arr(st0.targets.resolutions).length + ' entregables de vídeo por campaña.'),
      ]),

      h(Card, { key: 'pr', title: 'Producción' }, [
        h('div', { className: 'ks-grid ks-grid-4', key: 'g' }, [
          h(Field, { key: 'h', label: 'Duración hero (s)' },
            h(TextInput, { type: 'number', min: 5, max: 180, value: st0.heroDurationSec,
              onChange: (v) => setS((sx) => { sx.heroDurationSec = clamp(v, 5, 180); }) })),
          h(Field, { key: 's', label: 'Duración corto (s)' },
            h(TextInput, { type: 'number', min: 5, max: 90, value: st0.shortDurationSec,
              onChange: (v) => setS((sx) => { sx.shortDurationSec = clamp(v, 5, 90); }) })),
          h(Field, { key: 'v', label: 'Variantes' },
            h(TextInput, { type: 'number', min: 1, max: 8, value: st0.variantCount,
              onChange: (v) => setS((sx) => { sx.variantCount = clamp(v, 1, 8); }) })),
          h(Field, { key: 'f', label: 'FPS' },
            h(Select, { value: s(st0.fps), options: [24, 25, 30, 50, 60].map((x) => ({ value: String(x), label: x + ' fps' })),
              onChange: (v) => setS((sx) => { sx.fps = num(v, 25); }) })),
        ]),
        h('div', { className: 'ks-switches', key: 'sw' }, [
          h('div', { className: 'ks-switch', key: 'su' }, [
            h(Toggle, { key: 't', value: st0.subtitles !== false, onChange: (v) => setS((sx) => { sx.subtitles = v; }) }),
            h('span', { key: 'l' }, 'Subtítulos quemados en el máster'),
          ]),
          h('div', { className: 'ks-switch', key: 'sa' }, [
            h(Toggle, { key: 't', value: st0.safeAreas !== false, onChange: (v) => setS((sx) => { sx.safeAreas = v; }) }),
            h('span', { key: 'l' }, 'Respetar zonas seguras en vertical'),
          ]),
        ]),
      ]),

      h(Card, { key: 'i', title: 'Información' }, [
        h('div', { className: 'ks-kv', key: 'k' }, [
          h('div', { key: '1' }, [h('span', { key: 'a' }, 'Versión'), h('strong', { key: 'b' }, KS_VERSION)]),
          h('div', { key: '2' }, [h('span', { key: 'a' }, 'Instancia'), h('strong', { key: 'b' }, s(instanceId) || 'sin instancia')]),
          h('div', { key: '3' }, [h('span', { key: 'a' }, 'Proveedores registrados'), h('strong', { key: 'b' }, PROVIDERS.length)]),
          h('div', { key: '4' }, [h('span', { key: 'a' }, 'Agentes'), h('strong', { key: 'b' }, AGENTS.length + 1)]),
        ]),
        h('div', { className: 'ks-cardfoot', key: 'f' }, [
          h(Btn, { key: 'b', size: 'sm', onClick: () => download(slug(model.title) + '-biblia.md', exportBible(model), 'text/markdown') }, 'Exportar biblia'),
          h(Btn, { key: 'j', size: 'sm', onClick: () => download(slug(model.title) + '.json', JSON.stringify(model, null, 2), 'application/json') }, 'Exportar JSON'),
          h(Btn, { key: 'r', size: 'sm', variant: 'danger', onClick: () => {
            if (globalThis.window && !window.confirm('¿Vaciar la campaña y empezar de cero? Las versiones guardadas se conservan.')) return;
            const keep = arr(model.versions);
            const fresh = migrate(emptyCampaign());
            fresh.versions = keep;
            commit(fresh);
            notify('info', 'Campaña reiniciada.');
          } }, 'Reiniciar campaña'),
        ]),
      ]),
    ]);
  }
