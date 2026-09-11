
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Archivos — el Cloud Storage del tenant, visible y operable
  //
  // Los bytes viven en el bucket de la organización, bajo la carpeta que el
  // host asigna a esta app (`imagenes/{appId}/{instanceId}/{carpeta}/`). La
  // campaña guarda solo el catálogo: qué es cada archivo y para qué sirve.
  //
  // Esa separación es la que permite «comprobar el almacenamiento»: si el
  // bucket y el catálogo no dicen lo mismo, aquí se ve, en vez de descubrirlo
  // cuando falta una foto en un render.
  // ═════════════════════════════════════════════════════════════════════════

  const FILE_ICONS = [
    [/^image\//, '🖼️'], [/^video\//, '🎞️'], [/^audio\//, '🔊'],
    [/pdf/, '📕'], [/zip|compressed|tar/, '🗜️'],
    [/word|document|rtf|text|markdown/, '📄'], [/sheet|excel|csv/, '📊'],
    [/presentation|powerpoint/, '📽️'],
  ];
  function fileIcon(f) {
    const hay = s(obj(f).mime) + ' ' + s(obj(f).name).split('.').pop();
    for (const [re, ico] of FILE_ICONS) if (re.test(hay)) return ico;
    return '📎';
  }
  const isImageFile = (f) => /^image\//.test(s(obj(f).mime))
    || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(s(obj(f).name));

  /** Confirmación para lo que no se puede deshacer. Sin `window`, no pregunta. */
  const confirmWipe = (text) => !globalThis.window || typeof window.confirm !== 'function' || window.confirm(text);

  function FilesView() {
    const [busy, setBusy] = useState(false);
    const [audit, setAudit] = useState(null);
    const files = arr(model.files);
    const folder = FILE_FOLDERS.some((f) => f.id === ui.fileFolder) ? ui.fileFolder : 'all';
    const list = folder === 'all' ? files : files.filter((f) => f.folder === folder);
    const bytes = files.reduce((a, f) => a + num(f.size, 0), 0);

    async function onPick(fileList, dest) {
      const picked = Array.from(fileList || []);
      if (!picked.length) return;
      setBusy(true);
      let ok = 0;
      for (const f of picked) {
        try { await uploadAndRegister(f, dest); ok++; }
        catch (e) { notify('error', ((e && e.message) || 'no se pudo subir ' + f.name)); }
      }
      setBusy(false);
      setAudit(null);
      if (ok) notify('success', ok + (ok === 1 ? ' archivo subido' : ' archivos subidos') + ' a ' + folderById(dest).label + '.');
    }

    /** Contrasta catálogo y almacenamiento, y dice en qué no coinciden. */
    async function checkStorage() {
      setBusy(true);
      const known = new Set(arr(model.files).map((f) => s(f.url)));
      const huerfanos = [];
      let leidas = 0;
      for (const f of FILE_FOLDERS) {
        const got = await listFiles(f.id);
        if (got == null) continue;
        leidas++;
        for (const x of got) if (!known.has(x.url)) huerfanos.push(Object.assign({ folder: f.id }, x));
      }
      setBusy(false);
      if (!leidas) { setAudit({ unsupported: true }); return; }
      setAudit({ huerfanos, carpetas: leidas });
    }

    async function adopt(x) {
      patch((m) => {
        m.files = arr(m.files).concat([{
          id: newId('file'), url: x.url, name: x.name || s(x.url).split('/').pop(),
          folder: x.folder, mime: '', size: num(x.size, 0), note: 'Adoptado del almacenamiento', at: nowIso(),
        }]).slice(-FILES_MAX);
        logLine(m, 'info', 'Archivo «' + (x.name || x.url) + '» adoptado del almacenamiento.');
      });
      setAudit(Object.assign({}, audit, { huerfanos: arr(audit && audit.huerfanos).filter((y) => y.url !== x.url) }));
    }

    const uploader = (dest, label, variant) => h('label', {
      key: 'u-' + dest, className: cx('ks-btn', variant || 'ks-btn-primary', 'ks-btn-sm'),
      title: hasFiles ? 'Sube al almacenamiento de la organización' : NO_FILES,
    }, [
      busy ? 'Subiendo…' : label,
      h('input', { key: 'i', type: 'file', multiple: true, disabled: busy || !hasFiles,
        accept: folderById(dest).accept || undefined, style: { display: 'none' },
        onChange: (e) => { onPick(e.target.files, dest); e.target.value = ''; } }),
    ]);

    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Archivos',
        subtitle: hasFiles
          ? plural(files.length, 'archivo', 'archivos') + ' · ' + fmtBytes(bytes)
            + ' · almacenamiento de la organización'
          : 'Este host no ofrece almacenamiento',
        actions: hasFiles ? [
          uploader('documentos', 'Subir documentos'),
          h(Btn, { key: 'c', size: 'sm', disabled: busy, onClick: checkStorage }, 'Comprobar almacenamiento'),
        ] : [] }),

      !hasFiles ? h(Empty, { key: 'no', icon: '🗄️',
        text: NO_FILES + ' Las fotos y el material se pueden seguir añadiendo pegando su URL en el Brief o en la Biblioteca.' }) : null,

      hasFiles ? h(Card, { key: 'folders', title: 'Dónde va cada cosa' }, [
        h('p', { className: 'ks-lead', key: 'p' },
          'La ruta real la decide KIMOS: cada archivo se guarda bajo la carpeta de esta app, '
          + 'en el bucket de la organización. Eso da aislamiento, cuota atribuible y limpieza al desinstalar.'),
        h('div', { className: 'ks-folders', key: 'g' }, FILE_FOLDERS.map((f) => h('div', {
          key: f.id, className: 'ks-folder',
        }, [
          h('span', { className: 'ks-folder-emoji', key: 'e' }, f.emoji),
          h('div', { className: 'ks-folder-body', key: 'b' }, [
            h('strong', { key: 'l' }, f.label),
            h('span', { key: 'm' }, plural(files.filter((x) => x.folder === f.id).length, 'archivo', 'archivos')
              + ' · hasta ' + f.maxMB + ' MB'),
          ]),
          uploader(f.id, 'Subir', 'ks-btn-ghost'),
        ]))),
      ]) : null,

      audit ? h(Card, { key: 'audit', title: 'Almacenamiento comprobado',
        actions: [h(Btn, { key: 'x', size: 'sm', variant: 'ghost', onClick: () => setAudit(null) }, 'Cerrar')] },
      audit.unsupported
        ? h('p', { className: 'ks-hint' }, 'Este host no deja listar el contenido de las carpetas, así que no se puede contrastar.')
        : arr(audit.huerfanos).length
          ? [
            h('p', { className: 'ks-warn', key: 'p' },
              plural(audit.huerfanos.length, 'archivo está', 'archivos están')
              + ' en el almacenamiento y no en el catálogo de esta campaña. '
              + 'Pueden ser de otra campaña de esta misma instancia, o haber quedado de una subida a medias.'),
            h('div', { className: 'ks-list', key: 'l' }, audit.huerfanos.slice(0, 40).map((x) => h('div', {
              key: x.url, className: 'ks-filerow',
            }, [
              h('span', { className: 'ks-filerow-ico', key: 'i' }, '❔'),
              h('div', { className: 'ks-filerow-body', key: 'b' }, [
                h('strong', { key: 'n' }, x.name || s(x.url).split('/').pop()),
                h('span', { key: 'm' }, folderById(x.folder).label + (x.size ? ' · ' + fmtBytes(x.size) : '')),
              ]),
              h(Btn, { key: 'a', size: 'xs', onClick: () => adopt(x) }, 'Añadir al catálogo'),
            ]))),
          ]
          : h('p', { className: 'ks-hint' }, 'El catálogo y el almacenamiento dicen lo mismo en las '
            + audit.carpetas + ' carpeta(s) que el host deja leer.')) : null,

      hasFiles ? h('div', { className: 'ks-tabs', key: 't' },
        [{ id: 'all', label: 'Todos (' + files.length + ')' }]
          .concat(FILE_FOLDERS.map((f) => ({ id: f.id,
            label: f.emoji + ' ' + f.label + ' (' + files.filter((x) => x.folder === f.id).length + ')' })))
          .map((t) => h('button', { key: t.id, type: 'button',
            className: cx('ks-tab', folder === t.id && 'ks-tab-on'),
            onClick: () => setUi({ fileFolder: t.id }) }, t.label))) : null,

      hasFiles ? (list.length ? h('div', { className: 'ks-list', key: 'l' }, list.slice().reverse().map((f) => h('div', {
        key: f.id, className: 'ks-filerow',
      }, [
        h('span', { className: 'ks-filerow-ico', key: 'i' }, fileIcon(f)),
        h('div', { className: 'ks-filerow-body', key: 'b' }, [
          h('strong', { key: 'n', title: f.name }, f.name),
          h('span', { key: 'm' }, folderById(f.folder).label + ' · ' + fmtBytes(f.size)
            + ' · ' + s(f.at).slice(0, 10)),
          h(TextInput, { key: 'note', value: f.note, placeholder: 'Para qué sirve este archivo',
            onChange: (v) => patch((m) => {
              const x = arr(m.files).find((y) => y.id === f.id); if (x) x.note = v;
            }) }),
        ]),
        h('div', { className: 'ks-filerow-actions', key: 'a' }, [
          h('a', { key: 'o', className: 'ks-btn ks-btn-xs', href: f.url, target: '_blank', rel: 'noreferrer' }, 'Abrir'),
          h(Btn, { key: 'c', size: 'xs', onClick: () => copyText(f.url, 'URL') }, 'URL'),
          isImageFile(f) ? h(Btn, { key: 'p', size: 'xs', onClick: () => {
            patch((m) => {
              if (arr(m.brief.photos).some((ph) => ph.url === f.url)) return;
              m.brief.photos = arr(m.brief.photos).concat([{ id: newId('photo'), url: f.url, caption: f.name, isHero: !arr(m.brief.photos).length }]);
              logLine(m, 'info', 'Foto «' + f.name + '» añadida al brief desde Archivos.');
            });
            notify('success', 'Añadida al brief como foto de producto.');
          } }, 'Usar en el brief') : null,
          h(Btn, { key: 'q', size: 'xs', variant: 'ghost', title: 'Lo quita de esta campaña; el archivo sigue en el almacenamiento',
            onClick: () => dropFile(f.id, false) }, 'Quitar'),
          h(Btn, { key: 'd', size: 'xs', variant: 'danger', title: 'Borra el archivo del almacenamiento',
            onClick: () => { if (confirmWipe('¿Borrar «' + f.name + '» del almacenamiento? No se puede deshacer.')) dropFile(f.id, true); } }, 'Borrar'),
        ].filter(Boolean)),
      ]))) : h(Empty, { key: 'e', icon: '📄',
        text: folder === 'all' ? 'Todavía no has subido ningún archivo.' : 'Nada en esta carpeta todavía.',
        action: uploader(folder === 'all' ? 'documentos' : folder, 'Subir archivos') })) : null,

      hasFiles ? h(Card, { key: 'help', title: 'Qué conviene saber' }, [
        h('ul', { className: 'ks-list', key: 'l' }, [
          'Las URLs son de lectura pública: sirven en un <img>, en un correo o en el script de render. No subas aquí nada que no pueda serlo.',
          '«Quitar» lo saca del catálogo de esta campaña y deja el archivo en el almacenamiento; «Borrar» lo elimina de verdad. Se separan porque una URL puede estar referenciada en el brief o en un asset, y borrarla dejaría un hueco silencioso.',
          'Al desinstalar la app, KIMOS limpia su carpeta: por eso la ruta la decide el host y no la app.',
          'El límite de tamaño depende de la carpeta, y lo vuelve a comprobar el servidor.',
        ].map((x, i) => h('li', { key: i }, x))),
      ]) : null,
    ].filter(Boolean));
  }
