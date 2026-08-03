
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Componentes compartidos
  // ═════════════════════════════════════════════════════════════════════════

  const VIEWS = [
    { id: 'guide', label: 'Guía', emoji: '❔', group: 'Estudio' },
    { id: 'dashboard', label: 'Panel', emoji: '◎', group: 'Estudio' },
    { id: 'brief', label: 'Brief', emoji: '✦', group: 'Estudio' },
    { id: 'research', label: 'Investigación', emoji: '⌕', group: 'Estrategia' },
    { id: 'concept', label: 'Concepto', emoji: '✧', group: 'Estrategia' },
    { id: 'plan', label: 'Plan y funnel', emoji: '⌗', group: 'Estrategia' },
    { id: 'storyboard', label: 'Storyboard', emoji: '▦', group: 'Producción' },
    { id: 'timeline', label: 'Timeline', emoji: '▤', group: 'Producción' },
    { id: 'prompts', label: 'Prompts', emoji: '⌨', group: 'Producción' },
    { id: 'audio', label: 'Voz y música', emoji: '♪', group: 'Producción' },
    { id: 'jobs', label: 'Producción', emoji: '⚙', group: 'Producción' },
    { id: 'editor', label: 'Editor', emoji: '✂', group: 'Producción' },
    { id: 'copy', label: 'Copy', emoji: '✎', group: 'Distribución' },
    { id: 'brand', label: 'Marca', emoji: '◈', group: 'Distribución' },
    { id: 'assets', label: 'Biblioteca', emoji: '▣', group: 'Distribución' },
    { id: 'analytics', label: 'Analytics', emoji: '▲', group: 'Distribución' },
    { id: 'styles', label: 'Estilos', emoji: '✺', group: 'Sistema' },
    { id: 'versions', label: 'Versiones', emoji: '⧉', group: 'Sistema' },
    { id: 'settings', label: 'Ajustes', emoji: '⚒', group: 'Sistema' },
  ];

  const cx = (...xs) => xs.filter(Boolean).join(' ');

  function Btn(props) {
    const p = obj(props);
    return h('button', {
      className: cx('ks-btn', p.variant ? 'ks-btn-' + p.variant : '', p.size ? 'ks-btn-' + p.size : '', p.className),
      onClick: p.onClick, disabled: !!p.disabled, title: p.title || undefined, type: 'button', key: p.key,
    }, p.children);
  }

  function Field(props) {
    const p = obj(props);
    return h('label', { className: cx('ks-field', p.wide && 'ks-field-wide') }, [
      h('span', { className: 'ks-field-label', key: 'l' }, p.label),
      p.children,
      p.help ? h('span', { className: 'ks-field-help', key: 'h' }, p.help) : null,
    ]);
  }

  function TextInput(props) {
    const p = obj(props);
    return h('input', {
      className: 'ks-input', type: p.type || 'text', value: s(p.value),
      placeholder: p.placeholder || '', disabled: !!p.disabled,
      min: p.min, max: p.max, step: p.step,
      onChange: (e) => p.onChange && p.onChange(p.type === 'number' ? num(e.target.value, 0) : e.target.value),
    });
  }
  function TextArea(props) {
    const p = obj(props);
    return h('textarea', {
      className: 'ks-input ks-textarea', value: s(p.value), rows: p.rows || 3,
      placeholder: p.placeholder || '', disabled: !!p.disabled,
      onChange: (e) => p.onChange && p.onChange(e.target.value),
    });
  }
  function Select(props) {
    const p = obj(props);
    return h('select', {
      className: 'ks-input ks-select', value: s(p.value), disabled: !!p.disabled,
      onChange: (e) => p.onChange && p.onChange(e.target.value),
    }, arr(p.options).map((o) => h('option', { key: s(o.value), value: s(o.value) }, s(o.label))));
  }
  function Toggle(props) {
    const p = obj(props);
    return h('button', {
      type: 'button', className: cx('ks-toggle', p.value && 'ks-toggle-on'),
      onClick: () => p.onChange && p.onChange(!p.value), title: p.title || '',
    }, [h('span', { className: 'ks-toggle-knob', key: 'k' })]);
  }
  function ColorInput(props) {
    const p = obj(props);
    const valid = isHex(p.value);
    return h('div', { className: 'ks-color' }, [
      h('input', { key: 'c', type: 'color', className: 'ks-color-swatch',
        value: valid ? s(p.value) : '#000000', onChange: (e) => p.onChange && p.onChange(e.target.value) }),
      h('input', { key: 't', className: cx('ks-input', 'ks-color-hex', !valid && 'ks-input-bad'),
        value: s(p.value), placeholder: '#000000', onChange: (e) => p.onChange && p.onChange(e.target.value) }),
    ]);
  }

  function Card(props) {
    const p = obj(props);
    return h('section', { className: cx('ks-card', p.className) }, [
      p.title ? h('header', { className: 'ks-card-head', key: 'h' }, [
        h('h3', { className: 'ks-card-title', key: 't' }, p.title),
        p.actions ? h('div', { className: 'ks-card-actions', key: 'a' }, p.actions) : null,
      ]) : null,
      h('div', { className: cx('ks-card-body', p.flush && 'ks-card-flush'), key: 'b' }, p.children),
    ]);
  }

  function Empty(props) {
    const p = obj(props);
    return h('div', { className: 'ks-empty' }, [
      h('div', { className: 'ks-empty-icon', key: 'i' }, p.icon || '◌'),
      h('p', { className: 'ks-empty-text', key: 't' }, p.text),
      p.action ? h('div', { className: 'ks-empty-action', key: 'a' }, p.action) : null,
    ]);
  }

  function Chip(props) {
    const p = obj(props);
    return h('span', { className: cx('ks-chip', p.tone && 'ks-chip-' + p.tone, p.onClick && 'ks-chip-click'),
      onClick: p.onClick, title: p.title || undefined }, p.children);
  }

  function Bar(props) {
    const p = obj(props);
    const pct = clamp(num(p.value, 0), 0, 100);
    return h('div', { className: 'ks-bar', title: p.title || '' }, [
      h('div', { className: cx('ks-bar-fill', p.tone && 'ks-bar-' + p.tone), key: 'f', style: { width: pct + '%' } }),
    ]);
  }

  function Stat(props) {
    const p = obj(props);
    return h('div', { className: 'ks-stat' }, [
      h('span', { className: 'ks-stat-label', key: 'l' }, p.label),
      h('strong', { className: cx('ks-stat-value', p.tone && 'ks-stat-' + p.tone), key: 'v' }, p.value),
      p.hint ? h('span', { className: 'ks-stat-hint', key: 'h' }, p.hint) : null,
    ]);
  }

  /** Bloque de texto copiable (prompts, scripts, JSON). */
  function CodeBlock(props) {
    const p = obj(props);
    return h('div', { className: cx('ks-code', p.className) }, [
      h('div', { className: 'ks-code-head', key: 'h' }, [
        h('span', { className: 'ks-code-title', key: 't' }, p.title || ''),
        h('div', { className: 'ks-code-actions', key: 'a' }, [
          h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(p.content, p.title || 'Contenido') }, 'Copiar'),
          p.filename ? h(Btn, { key: 'd', size: 'xs', onClick: () => download(p.filename, p.content, p.mime) }, 'Descargar') : null,
        ]),
      ]),
      h('pre', { className: 'ks-code-body', key: 'b' }, s(p.content)),
    ]);
  }

  /** Cabecera de vista con acciones. */
  function ViewHead(props) {
    const p = obj(props);
    return h('div', { className: 'ks-viewhead' }, [
      h('div', { key: 'l' }, [
        h('h2', { className: 'ks-viewtitle', key: 't' }, p.title),
        p.subtitle ? h('p', { className: 'ks-viewsub', key: 's' }, p.subtitle) : null,
      ]),
      p.actions ? h('div', { className: 'ks-viewactions', key: 'a' }, p.actions) : null,
    ]);
  }

  /** Aviso de etapa no ejecutada, con el botón que la ejecuta. */
  function NotReady(props) {
    const p = obj(props);
    const ag = agentById(p.agentId);
    return h(Empty, {
      icon: ag ? ag.emoji : '◌',
      text: p.text || ('Todavía no se ha ejecutado ' + (ag ? ag.name : 'este agente') + '.'),
      action: h(Btn, { variant: 'primary', onClick: () => runStages([p.agentId], ag ? ag.name : '') },
        'Ejecutar ' + (ag ? ag.name : 'agente')),
    });
  }

  const swatch = (hex, label) => h('div', { className: 'ks-swatch', key: hex + label, title: label + ' ' + hex }, [
    h('span', { className: 'ks-swatch-dot', key: 'd', style: { background: isHex(hex) ? hex : '#333' } }),
    h('span', { className: 'ks-swatch-label', key: 'l' }, [label, h('code', { key: 'c' }, s(hex))]),
  ]);

  const optsOf = (list) => arr(list).map((x) => ({ value: x.id, label: x.label || x.name }));
