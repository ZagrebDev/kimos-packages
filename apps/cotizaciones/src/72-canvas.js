/* ══ LIENZO: EDICIÓN VISUAL ═══════════════════════════════════════════════
 *
 * El editor de la maqueta: los bloques se ven **tal como se imprimirán** y se
 * manipulan encima. Se arrastra para reordenar, se tira del borde derecho
 * para cambiar cuántas columnas ocupa un bloque, y el panel de la derecha
 * ajusta lo suyo (tamaño de texto, imagen, aire, tono).
 *
 * El estado de interacción —qué bloque está seleccionado, cuál se está
 * arrastrando— vive en el componente y NO en el documento: no tiene por qué
 * viajar al resto de las personas que tengan la cotización abierta.
 */

// ── Acciones sobre los bloques ──────────────────────────────────────────
/** Escribe la lista completa de bloques en el documento. */
function actSetBlocks(quoteId, blocks) {
  return actPatchDoc(s(quoteId), { blocks: arr(blocks).map(normalizeBlock) });
}

function actAddBlock(quoteId, type, atIndex, props) {
  const doc = docById(s(quoteId));
  if (!doc) return null;
  const def = BLOCK_BY_TYPE.get(s(type));
  if (!def) return null;
  const b = normalizeBlock(Object.assign({ type: def.type, w: def.w }, isObj(props) ? props : {}));
  b.updatedAt = stamp();
  b.updatedBy = meLabel();
  const list = bloquesDe(doc);
  const at = atIndex == null ? list.length : clamp(Math.round(num(atIndex)), 0, list.length);
  list.splice(at, 0, b);
  actSetBlocks(quoteId, list);
  return b;
}

function actUpdateBlock(quoteId, blockId, patch) {
  const doc = docById(s(quoteId));
  if (!doc || !isObj(patch)) return null;
  let out = null;
  const list = bloquesDe(doc).map((b) => {
    if (b.id !== s(blockId)) return b;
    out = normalizeBlock(Object.assign({}, b, patch, { id: b.id, updatedAt: stamp(), updatedBy: meLabel() }));
    return out;
  });
  if (out) actSetBlocks(quoteId, list);
  return out;
}

function actRemoveBlock(quoteId, blockId) {
  const doc = docById(s(quoteId));
  if (!doc) return false;
  const list = bloquesDe(doc);
  const next = list.filter((b) => b.id !== s(blockId));
  if (next.length === list.length) return false;
  actSetBlocks(quoteId, next);
  return true;
}

function actMoveBlock(quoteId, blockId, toIndex) {
  const doc = docById(s(quoteId));
  if (!doc) return false;
  const list = bloquesDe(doc);
  const from = list.findIndex((b) => b.id === s(blockId));
  if (from < 0) return false;
  const to = clamp(Math.round(num(toIndex)), 0, list.length - 1);
  if (to === from) return false;
  const [it] = list.splice(from, 1);
  list.splice(to, 0, it);
  actSetBlocks(quoteId, list);
  return true;
}

/** Vuelve a la maqueta de la casa, perdiendo los bloques propios del lienzo. */
function actResetBlocks(quoteId) {
  return actSetBlocks(quoteId, bloquesPorDefecto());
}

// ── El lienzo ───────────────────────────────────────────────────────────
function CanvasEditor(props) {
  const { m, doc } = props;
  const [selId, setSelId] = useState('');
  const [dragId, setDragId] = useState('');
  const [overId, setOverId] = useState('');
  const [menu, setMenu] = useState(false);
  const [ask, confirmNode] = useConfirm();
  const gridRef = useRef(null);

  const blocks = bloquesDe(doc);
  const sel = blocks.find((b) => b.id === selId) || null;
  const ctx = contextoDe(doc, m.def);

  // La primera vez que se abre el lienzo se siembra la maqueta por defecto,
  // para que quede guardada y editable en vez de ser un cálculo implícito.
  useEffect(() => {
    if (!arr(doc.blocks).length) actSetBlocks(doc.id, bloquesPorDefecto());
  }, [doc.id]);

  const soltar = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(''); setOverId(''); return; }
    const to = blocks.findIndex((b) => b.id === targetId);
    if (to >= 0) actMoveBlock(doc.id, dragId, to);
    setDragId(''); setOverId('');
  };

  /**
   * Redimensionado: se sigue el puntero y se traduce la distancia recorrida a
   * columnas usando el ancho real de la cuadrícula, así el bloque encaja
   * siempre en la rejilla y nunca queda a mitad de columna.
   */
  const empezarResize = (b, ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const anchoCol = grid.getBoundingClientRect().width / GRID_COLS;
    const x0 = ev.clientX;
    const w0 = b.w;
    let ultimo = w0;
    const mover = (e) => {
      const cols = clamp(w0 + Math.round((e.clientX - x0) / anchoCol), 1, GRID_COLS);
      if (cols !== ultimo) { ultimo = cols; actUpdateBlock(doc.id, b.id, { w: cols }); }
    };
    const soltarPuntero = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltarPuntero);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltarPuntero);
  };

  return h('div', { className: 'cz-canvas' }, [
    // ── Barra del lienzo ─────────────────────────────────────────────
    h('div', { key: 'tb', className: 'cz-canvas-tb' }, [
      h('div', { key: 'add', className: 'cz-menu-wrap' }, [
        h(Btn, { key: 'b', size: 'sm', variant: 'primary', onClick: () => setMenu(!menu) }, '+ Añadir bloque'),
        menu ? h('div', { key: 'm', className: 'cz-menu' }, BLOCK_TYPES.map((t) => h('button', {
          key: t.type, type: 'button', className: 'cz-menu-it',
          title: t.help,
          onClick: () => {
            const at = sel ? blocks.findIndex((b) => b.id === sel.id) + 1 : blocks.length;
            const nuevo = actAddBlock(doc.id, t.type, at);
            if (nuevo) setSelId(nuevo.id);
            setMenu(false);
          },
        }, [
          h('span', { key: 'i', className: 'cz-menu-ico' }, t.icon),
          h('span', { key: 'l', className: 'cz-menu-lbl' }, t.label),
          t.linked ? h('span', { key: 'v', className: 'cz-menu-tag', title: 'Toma su contenido de los datos de la cotización' }, 'vinculado') : null,
        ]))) : null,
      ]),
      h('span', { key: 'n', className: 'cz-canvas-note' },
        'Arrastra para reordenar · tira del borde derecho para cambiar el ancho'),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, {
        key: 'r', size: 'sm',
        title: 'Volver a la maqueta por defecto (se pierden los bloques añadidos)',
        onClick: async () => {
          const ok = await ask({
            title: 'Restablecer la maqueta', danger: true, okLabel: 'Restablecer',
            text: 'Se vuelve a la maqueta por defecto y se pierden los textos e imágenes que hayas añadido al lienzo. Los datos de la cotización no se tocan.',
          });
          if (ok) { actResetBlocks(doc.id); setSelId(''); }
        },
      }, '↺ Restablecer'),
    ]),

    // ── Hoja y panel ─────────────────────────────────────────────────
    h('div', { key: 'body', className: 'cz-canvas-body' }, [
      h('div', { key: 'paper', className: 'cz-paper', onMouseDown: (e) => { if (e.target === e.currentTarget) setSelId(''); } },
        h('div', { key: 'g', ref: gridRef, className: 'cz-sheet cz-sheet-edit' }, blocks.map((b, i) => h('div', {
          key: b.id,
          className: cx('cz-cell', 'cz-cell-edit', selId === b.id && 'sel', dragId === b.id && 'dragging', overId === b.id && 'over'),
          style: { gridColumn: 'span ' + b.w },
          onMouseDown: () => setSelId(b.id),
          onDragOver: (e) => { e.preventDefault(); setOverId(b.id); },
          onDrop: (e) => { e.preventDefault(); soltar(b.id); },
        }, [
          h('div', {
            key: 'h', className: 'cz-cell-handle', draggable: true,
            title: (BLOCK_BY_TYPE.get(b.type) || {}).label + ' — arrastra para mover',
            onDragStart: () => setDragId(b.id),
            onDragEnd: () => { setDragId(''); setOverId(''); },
          }, [
            h('span', { key: 'i' }, (BLOCK_BY_TYPE.get(b.type) || {}).icon),
            h('span', { key: 'w', className: 'cz-cell-w' }, b.w + '/' + GRID_COLS),
          ]),
          h(Block, {
            key: 'b', block: b, ctx, mode: 'edit',
            onChange: (patch) => actUpdateBlock(doc.id, b.id, patch),
          }),
          h('div', {
            key: 'r', className: 'cz-cell-resize', title: 'Arrastra para cambiar el ancho',
            onPointerDown: (e) => empezarResize(b, e),
          }),
        ])))),
      h('aside', { key: 'insp', className: 'cz-inspector' },
        sel ? h(BlockInspector, { doc, block: sel, m, onClose: () => setSelId('') })
          : h('div', { className: 'cz-inspector-empty' }, [
            h('div', { key: 't', className: 'cz-inspector-empty-t' }, 'Nada seleccionado'),
            h('div', { key: 'x', className: 'cz-dim' }, 'Pulsa un bloque de la hoja para ajustarlo, o añade uno nuevo.'),
          ])),
    ]),
    confirmNode,
  ]);
}

// ── Panel del bloque seleccionado ───────────────────────────────────────
function BlockInspector(props) {
  const { doc, block: b, m } = props;
  const meta = BLOCK_BY_TYPE.get(b.type) || {};
  const set = (patch) => actUpdateBlock(doc.id, b.id, patch);
  const blocks = bloquesDe(doc);
  const idx = blocks.findIndex((x) => x.id === b.id);

  return h('div', { className: 'cz-inspector-in' }, [
    h('div', { key: 'h', className: 'cz-inspector-hd' }, [
      h('span', { key: 'i', className: 'cz-inspector-ico' }, meta.icon),
      h('span', { key: 't', className: 'cz-inspector-t' }, meta.label),
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(IconBtn, { key: 'u', icon: '↑', title: 'Subir', disabled: idx <= 0, onClick: () => actMoveBlock(doc.id, b.id, idx - 1) }),
      h(IconBtn, { key: 'd', icon: '↓', title: 'Bajar', disabled: idx >= blocks.length - 1, onClick: () => actMoveBlock(doc.id, b.id, idx + 1) }),
      h(IconBtn, {
        key: 'c', icon: '⧉', title: 'Duplicar bloque',
        onClick: () => actAddBlock(doc.id, b.type, idx + 1, Object.assign({}, b, { id: undefined })),
      }),
      h(IconBtn, { key: 'x', icon: '🗑', title: 'Quitar bloque', onClick: () => { actRemoveBlock(doc.id, b.id); props.onClose(); } }),
    ]),
    meta.help ? h('div', { key: 'help', className: 'cz-inspector-help' }, meta.help) : null,

    h(Field, { key: 'w', label: 'Ancho', help: b.w + ' de ' + GRID_COLS + ' columnas' }, h('input', {
      type: 'range', min: 1, max: GRID_COLS, value: b.w, className: 'cz-range',
      onChange: (e) => set({ w: num(e.target.value) }),
    })),
    h(Field, { key: 'a', label: 'Alineación' }, h('div', { className: 'cz-segmented' }, ALIGNS.map(([k, label]) => h('button', {
      key: k, type: 'button', className: cx('cz-seg', b.align === k && 'on'), title: label,
      onClick: () => set({ align: k }),
    }, k === 'left' ? '⯇' : (k === 'center' ? '≡' : '⯈'))))),
    h(Field, { key: 'to', label: 'Tono' }, h(Select, {
      value: b.tone, onChange: (e) => set({ tone: e.target.value }),
      options: TONES.map(([k, label]) => ({ value: k, label })),
    })),
    h(Field, { key: 'ti', label: 'Encabezado del bloque', help: 'Opcional: un título encima del contenido.' },
      h(Input, { value: b.title, placeholder: '—', onChange: (e) => set({ title: e.target.value }) })),
    h(Field, { key: 'p', label: 'Margen interior', help: b.pad + ' px' }, h('input', {
      type: 'range', min: 0, max: 48, step: 2, value: b.pad, className: 'cz-range',
      onChange: (e) => set({ pad: num(e.target.value) }),
    })),

    // ── Propiedades del tipo ─────────────────────────────────────────
    b.type === 'text' ? h(Field, { key: 'sz', label: 'Tamaño del texto' }, h(Select, {
      value: b.size, onChange: (e) => set({ size: e.target.value }),
      options: TEXT_SIZES.map(([k, label]) => ({ value: k, label })),
    })) : null,
    b.type === 'text' ? h(Field, { key: 'tx', label: 'Texto', wide: true },
      h(AutoArea, { minRows: 4, value: b.text, placeholder: 'También puedes escribir directamente sobre la hoja.', onChange: (e) => set({ text: e.target.value }) })) : null,

    b.type === 'image' ? h(Field, { key: 'im', label: 'Imagen', wide: true },
      h(ImageField, { value: b.url, folder: 'lienzo', onChange: (v) => set({ url: v }) })) : null,
    b.type === 'image' ? h(Field, { key: 'cp', label: 'Pie de foto' },
      h(Input, { value: b.caption, onChange: (e) => set({ caption: e.target.value }) })) : null,
    b.type === 'image' ? h(Field, { key: 'fi', label: 'Encaje' }, h(Select, {
      value: b.fit, onChange: (e) => set({ fit: e.target.value }),
      options: [{ value: 'cover', label: 'Recortar para llenar' }, { value: 'contain', label: 'Ver completa' }],
    })) : null,
    b.type === 'image' || b.type === 'spacer' ? h(Field, {
      key: 'he', label: 'Alto', help: b.height + ' px',
    }, h('input', {
      type: 'range', min: 40, max: 700, step: 10, value: b.height, className: 'cz-range',
      onChange: (e) => set({ height: num(e.target.value) }),
    })) : null,

    b.type === 'items' ? h(Field, { key: 'si', label: 'Fotos de los ítems' }, h(Toggle, {
      checked: b.showImages, label: b.showImages ? 'Se muestran' : 'Solo texto',
      onChange: (v) => set({ showImages: v }),
    })) : null,

    meta.linked ? h(Field, { key: 'hv', label: 'Si no hay contenido' }, h(Toggle, {
      checked: b.hideEmpty, label: b.hideEmpty ? 'No se imprime el bloque' : 'Se imprime vacío',
      onChange: (v) => set({ hideEmpty: v }),
    })) : null,

    meta.linked ? h('div', { key: 'lk', className: 'cz-inspector-help' },
      'Este bloque toma su contenido de los datos de la cotización: edítalo en la pestaña Datos y aquí se actualiza solo.') : null,
  ]);
}
