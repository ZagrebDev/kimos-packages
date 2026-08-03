
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Raíz de la aplicación
  // ═════════════════════════════════════════════════════════════════════════

  const VIEW_COMPONENTS = {
    guide: GuideView, flow: FlowView,
    dashboard: DashboardView, brief: BriefView, research: ResearchView, concept: ConceptView,
    plan: PlanView, storyboard: StoryboardView, timeline: TimelineView, prompts: PromptsView,
    audio: AudioView, jobs: JobsView, editor: EditorView, copy: CopyView, brand: BrandView,
    assets: AssetsView, analytics: AnalyticsView, styles: StylesView, versions: VersionsView,
    settings: SettingsView,
  };

  /** Etapas listas por vista, para pintar el punto de estado en el menú. */
  const VIEW_STAGE = {
    research: 'research', concept: 'concept', plan: 'plan', storyboard: 'storyboard',
    timeline: 'edit', prompts: 'prompts', audio: 'audio', jobs: 'production',
    editor: 'edit', copy: 'copy', brand: 'brandCheck', analytics: 'analytics',
  };

  function Component() {
    const [, force] = useState(0);
    useEffect(() => {
      const fn = () => force((x) => x + 1);
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    }, []);

    if (!ui.ready) {
      return h('div', { className: 'kimos-kreative ks-loading' }, [
        h('div', { className: 'ks-loader', key: 'l' }),
        h('p', { key: 't' }, 'Abriendo Kreative Studio…'),
      ]);
    }

    const View = VIEW_COMPONENTS[ui.view] || DashboardView;
    const groups = [];
    for (const v of VIEWS) {
      let g = groups.find((x) => x.name === v.group);
      if (!g) { g = { name: v.group, items: [] }; groups.push(g); }
      g.items.push(v);
    }
    const st = styleById(model.styleId);
    const accent = isHex(model.brand.palette.secondary) ? model.brand.palette.secondary : '#19ACB1';
    // El tema son SOLO variables y dos clases: nada del resto de la interfaz
    // conoce el modo en el que está.
    const theme = currentTheme();
    const rootStyle = Object.assign({ '--ks-accent': accent }, themeVars(theme));

    return h('div', {
      className: cx('kimos-kreative', 'ks-form-' + theme.formId,
        'ks-mode-' + (theme.formId === 'game' ? theme.modeId : theme.effectiveId || theme.modeId)),
      style: rootStyle,
    }, [
      h('header', { className: 'ks-top', key: 't' }, [
        h('div', { className: 'ks-brandmark', key: 'b' }, [
          h('span', { className: 'ks-brandmark-dot', key: 'd' }),
          h('span', { className: 'ks-brandmark-text', key: 't' }, 'Kreative Studio'),
        ]),
        h('input', { key: 'ti', className: 'ks-title-input', value: s(model.title),
          onChange: (e) => patch((m) => { m.title = e.target.value; }), placeholder: 'Título de la campaña' }),
        h('div', { className: 'ks-top-meta', key: 'm' }, [
          h(Chip, { key: 's', tone: 'accent', title: st.tagline, onClick: () => setUi({ view: 'styles' }) }, st.emoji + ' ' + st.name),
          h(Chip, { key: 'o', onClick: () => setUi({ view: 'plan' }) }, objectiveById(model.objectiveId).label),
          h(Chip, { key: 'a', onClick: () => setUi({ view: 'brief' }) }, audienceById(model.audienceId).label),
          h(Chip, { key: 'th', onClick: () => setUi({ view: 'flow' }),
            title: 'Cambiar el aspecto en la vista Flujo' }, theme.emoji + ' ' + theme.label),
        ]),
        h('div', { className: 'ks-top-actions', key: 'a' }, [
          h(Btn, { key: 'g', variant: 'primary', size: 'sm', disabled: ui.busy || !s(model.brief.productName).trim(),
            onClick: () => generateAll(s(model.brief.intent) || 'Crea una campaña premium') },
            ui.busy ? 'Generando…' : 'Generar'),
          h(Btn, { key: 'e', size: 'sm', disabled: !model.concept,
            onClick: () => download(slug(model.title) + '-biblia.md', exportBible(model), 'text/markdown') }, 'Biblia'),
        ]),
      ]),
      h('div', { className: 'ks-body', key: 'b' }, [
        h('nav', { className: 'ks-nav', key: 'n' }, groups.map((g) => h('div', { key: g.name, className: 'ks-navgroup' }, [
          h('span', { className: 'ks-navgroup-title', key: 't' }, g.name),
          h('div', { className: 'ks-navitems', key: 'i' }, g.items.map((v) => {
            const stageKey = VIEW_STAGE[v.id];
            const ready = stageKey ? !!model[stageKey] : true;
            return h('button', {
              key: v.id, type: 'button', className: cx('ks-navitem', ui.view === v.id && 'ks-navitem-on'),
              onClick: () => setUi({ view: v.id }),
            }, [
              h('span', { className: 'ks-navitem-icon', key: 'e' }, v.emoji),
              h('span', { className: 'ks-navitem-label', key: 'l' }, v.label),
              stageKey ? h('span', { className: cx('ks-navitem-dot', ready && 'ks-navitem-dot-on'), key: 'd' }) : null,
            ]);
          })),
        ]))),
        h('main', { className: 'ks-main', key: 'm' }, [
          ui.error ? h('div', { className: 'ks-errorbar', key: 'e' }, ui.error) : null,
          h(View, { key: ui.view }),
        ]),
      ]),
    ]);
  }

  return {
    Component,
    unmount() {
      cancelled = true;
      clearTimeout(saveTimer);
      clearInterval(clockTimer);
      listeners.clear();
      try { if (typeof unregisterAgent === 'function') unregisterAgent(); } catch (e) { /* ya desregistrado */ }
      try { if (typeof offConfig === 'function') offConfig(); } catch (e) { /* opcional */ }
      try { if (typeof offSerialize === 'function') offSerialize(); } catch (e) { /* opcional */ }
      try { if (typeof offLoad === 'function') offLoad(); } catch (e) { /* opcional */ }
    },
  };
}
