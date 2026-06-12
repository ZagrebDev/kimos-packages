/**
 * Kanban — app instalable de Kimos.
 *
 * Bundle ESM autocontenido. Usa React desde globalThis (lo expone el shell).
 *
 * Contrato:
 *   export default function mount(shell): { Component }
 *
 * Persistencia: shell.saveData/loadData ↔ instance.json (config.columns + config.cards).
 * Drag & drop nativo HTML5 — sin dependencias externas.
 */

const DEFAULT_COLUMNS = [
  { id: 'col-todo', name: 'Por hacer', color: '#94a3b8' },
  { id: 'col-doing', name: 'En curso', color: '#3b82f6' },
  { id: 'col-done', name: 'Hecho', color: '#22c55e' },
];

const COLUMN_COLORS = ['#94a3b8', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6'];

function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4);
}

function normalizeColumns(input) {
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_COLUMNS.map((c) => ({ ...c }));
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || uid('col')).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : id,
      color: typeof raw.color === 'string' ? raw.color : '#94a3b8',
    });
  }
  return out.length ? out : DEFAULT_COLUMNS.map((c) => ({ ...c }));
}

function normalizeCards(input, columnIds) {
  if (!Array.isArray(input)) return [];
  const valid = new Set(columnIds);
  const fallback = columnIds[0];
  const out = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || uid('card')).trim();
    if (!id) continue;
    const column = raw.column && valid.has(String(raw.column)) ? String(raw.column) : fallback;
    out.push({
      id,
      name: typeof raw.name === 'string' && raw.name ? raw.name : 'Sin título',
      description: typeof raw.description === 'string' ? raw.description : '',
      column,
      order: typeof raw.order === 'number' ? raw.order : 0,
    });
  }
  // Orden estable por (columna, order, índice).
  out.sort((a, b) => {
    if (a.column !== b.column) return 0;
    return (a.order || 0) - (b.order || 0);
  });
  return out;
}

export default function mount(shell) {
  const R = globalThis.React;
  if (!R) {
    return { Component() { return null; } };
  }
  const { useEffect, useState, useCallback, useRef, useMemo } = R;
  const h = R.createElement;

  function notify(level, text) {
    try { shell.notify({ level, text }); } catch { /* no-op */ }
  }

  function CardView({ card, dragHandlers }) {
    return h(
      'div',
      {
        className: 'kk-card',
        draggable: true,
        ...dragHandlers,
        title: card.description || card.name,
      },
      h('div', { className: 'kk-card-title' }, card.name),
      card.description ? h('div', { className: 'kk-card-desc' }, card.description) : null,
    );
  }

  function ColumnView({ col, cards, onAddCard, onEditCard, onDeleteCard, onRenameColumn, onChangeColor, onDeleteColumn, dragApi }) {
    const [editingHeader, setEditingHeader] = useState(false);
    const [draftName, setDraftName] = useState(col.name);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const commitName = () => {
      const next = draftName.trim();
      if (next && next !== col.name) onRenameColumn(col.id, next);
      setEditingHeader(false);
    };

    return h(
      'div',
      {
        className: 'kk-col',
        onDragOver: (e) => { e.preventDefault(); dragApi.onColumnDragOver(col.id); },
        onDrop: (e) => { e.preventDefault(); dragApi.onColumnDrop(col.id); },
      },
      h(
        'div',
        { className: 'kk-col-header' },
        h('span', { className: 'kk-col-dot', style: { background: col.color } }),
        editingHeader
          ? h('input', {
              className: 'kk-col-name-input',
              value: draftName,
              autoFocus: true,
              onChange: (e) => setDraftName(e.target.value),
              onBlur: commitName,
              onKeyDown: (e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') { setDraftName(col.name); setEditingHeader(false); }
              },
            })
          : h(
              'span',
              {
                className: 'kk-col-name',
                onDoubleClick: () => { setDraftName(col.name); setEditingHeader(true); },
                title: 'Doble click para renombrar',
              },
              col.name,
            ),
        h('span', { className: 'kk-col-count' }, cards.length),
        h(
          'div',
          { className: 'kk-col-actions' },
          h(
            'button',
            {
              className: 'kk-icon-btn',
              title: 'Cambiar color',
              onClick: () => setShowColorPicker((v) => !v),
            },
            '🎨',
          ),
          h(
            'button',
            {
              className: 'kk-icon-btn kk-danger',
              title: 'Eliminar columna',
              onClick: () => {
                if (confirm('¿Eliminar columna "' + col.name + '"? Las tarjetas se moverán a la primera columna.')) {
                  onDeleteColumn(col.id);
                }
              },
            },
            '×',
          ),
        ),
      ),
      showColorPicker
        ? h(
            'div',
            { className: 'kk-color-picker' },
            COLUMN_COLORS.map((c) =>
              h('button', {
                key: c,
                className: 'kk-color-swatch' + (c === col.color ? ' kk-color-active' : ''),
                style: { background: c },
                onClick: () => { onChangeColor(col.id, c); setShowColorPicker(false); },
              }),
            ),
          )
        : null,
      h(
        'div',
        { className: 'kk-col-body' },
        cards.map((card) =>
          h(
            'div',
            { key: card.id, className: 'kk-card-wrap' },
            h(CardView, {
              card,
              dragHandlers: {
                onDragStart: (e) => { dragApi.onCardDragStart(card.id); e.dataTransfer.effectAllowed = 'move'; },
                onDragEnd: dragApi.onCardDragEnd,
                onDragOver: (e) => { e.preventDefault(); dragApi.onCardDragOver(card.id, col.id); },
                onDrop: (e) => { e.preventDefault(); dragApi.onCardDrop(card.id, col.id); },
                onClick: () => onEditCard(card),
              },
            }),
          ),
        ),
        h('button', { className: 'kk-add-card', onClick: () => onAddCard(col.id) }, '+ Nueva tarjeta'),
      ),
    );
  }

  function CardEditor({ card, onSave, onDelete, onClose }) {
    const [name, setName] = useState(card.name);
    const [description, setDescription] = useState(card.description || '');
    return h(
      'div',
      { className: 'kk-modal-overlay', onClick: onClose },
      h(
        'div',
        { className: 'kk-modal', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'kk-modal-header' }, 'Editar tarjeta'),
        h('label', { className: 'kk-modal-label' }, 'Título'),
        h('input', {
          className: 'kk-modal-input',
          value: name,
          autoFocus: true,
          onChange: (e) => setName(e.target.value),
        }),
        h('label', { className: 'kk-modal-label' }, 'Descripción'),
        h('textarea', {
          className: 'kk-modal-textarea',
          value: description,
          onChange: (e) => setDescription(e.target.value),
        }),
        h(
          'div',
          { className: 'kk-modal-actions' },
          h('button', { className: 'kk-btn kk-btn-danger', onClick: () => { if (confirm('¿Eliminar tarjeta?')) onDelete(card.id); } }, 'Eliminar'),
          h('div', { style: { flex: 1 } }),
          h('button', { className: 'kk-btn kk-btn-ghost', onClick: onClose }, 'Cancelar'),
          h('button', {
            className: 'kk-btn kk-btn-primary',
            onClick: () => onSave({ ...card, name: name.trim() || 'Sin título', description: description.trim() }),
          }, 'Guardar'),
        ),
      ),
    );
  }

  function Component() {
    const [columns, setColumns] = useState(DEFAULT_COLUMNS.map((c) => ({ ...c })));
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCard, setEditingCard] = useState(null);
    const saveTimerRef = useRef(null);
    const dragStateRef = useRef({ cardId: null, overCol: null, overCard: null });
    const skipSaveRef = useRef(true);

    useEffect(() => {
      let cancelled = false;
      shell.loadData().then((data) => {
        if (cancelled) return;
        const cfg = (data && typeof data === 'object') ? data : {};
        const cols = normalizeColumns(cfg.columns);
        const cds = normalizeCards(cfg.cards, cols.map((c) => c.id));
        setColumns(cols);
        setCards(cds);
      }).catch(() => {}).finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => { cancelled = true; };
    }, []);

    // Persistir con debounce de 600ms tras cualquier cambio.
    useEffect(() => {
      if (loading) return;
      if (skipSaveRef.current) { skipSaveRef.current = false; return; }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        shell.saveData({ columns, cards }).catch((err) => {
          notify('error', (err && err.message) || 'No se pudo guardar el tablero');
        });
      }, 600);
      return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [columns, cards, loading]);

    const cardsByColumn = useMemo(() => {
      const out = {};
      for (const col of columns) out[col.id] = [];
      for (const card of cards) {
        if (out[card.column]) out[card.column].push(card);
      }
      for (const id of Object.keys(out)) out[id].sort((a, b) => (a.order || 0) - (b.order || 0));
      return out;
    }, [columns, cards]);

    const handleAddCard = useCallback((columnId) => {
      const order = cards.filter((c) => c.column === columnId).length;
      const card = { id: uid('card'), name: 'Nueva tarjeta', description: '', column: columnId, order };
      setCards((prev) => [...prev, card]);
      setEditingCard(card);
    }, [cards]);

    const handleSaveCard = useCallback((updated) => {
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCard(null);
    }, []);

    const handleDeleteCard = useCallback((cardId) => {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setEditingCard(null);
    }, []);

    const handleAddColumn = useCallback(() => {
      const id = uid('col');
      setColumns((prev) => [
        ...prev,
        { id, name: 'Nueva columna', color: COLUMN_COLORS[prev.length % COLUMN_COLORS.length] },
      ]);
    }, []);

    const handleRenameColumn = useCallback((columnId, name) => {
      setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name } : c)));
    }, []);

    const handleChangeColumnColor = useCallback((columnId, color) => {
      setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, color } : c)));
    }, []);

    const handleDeleteColumn = useCallback((columnId) => {
      setColumns((prev) => {
        if (prev.length === 1) {
          notify('warn', 'No puedes eliminar la última columna');
          return prev;
        }
        const remaining = prev.filter((c) => c.id !== columnId);
        const target = remaining[0].id;
        setCards((cs) => cs.map((c) => (c.column === columnId ? { ...c, column: target } : c)));
        return remaining;
      });
    }, []);

    // ── Drag & drop nativo ───────────────────────────────────────────
    const dragApi = useMemo(() => ({
      onCardDragStart(cardId) { dragStateRef.current = { cardId, overCol: null, overCard: null }; },
      onCardDragEnd() { dragStateRef.current = { cardId: null, overCol: null, overCard: null }; },
      onColumnDragOver(columnId) { dragStateRef.current.overCol = columnId; },
      onCardDragOver(cardId, columnId) { dragStateRef.current.overCard = cardId; dragStateRef.current.overCol = columnId; },
      onColumnDrop(columnId) {
        const { cardId } = dragStateRef.current;
        if (!cardId) return;
        setCards((prev) => {
          const src = prev.find((c) => c.id === cardId);
          if (!src) return prev;
          const next = prev.filter((c) => c.id !== cardId);
          const inCol = next.filter((c) => c.column === columnId);
          next.push({ ...src, column: columnId, order: inCol.length });
          return next.map((c, idx) => ({ ...c, order: idx }));
        });
      },
      onCardDrop(targetCardId, columnId) {
        const { cardId } = dragStateRef.current;
        if (!cardId || cardId === targetCardId) return;
        setCards((prev) => {
          const src = prev.find((c) => c.id === cardId);
          const target = prev.find((c) => c.id === targetCardId);
          if (!src || !target) return prev;
          const others = prev.filter((c) => c.id !== cardId);
          const targetIdx = others.findIndex((c) => c.id === targetCardId);
          const moved = { ...src, column: columnId };
          others.splice(targetIdx, 0, moved);
          // Reasignar order dentro de cada columna.
          const byCol = {};
          for (const c of others) {
            if (!byCol[c.column]) byCol[c.column] = 0;
            c.order = byCol[c.column]++;
          }
          return others.map((c) => ({ ...c }));
        });
      },
    }), []);

    if (loading) {
      return h('div', { className: 'kimos-kanban kk-loading' }, 'Cargando tablero…');
    }

    return h(
      'div',
      { className: 'kimos-kanban' },
      h(
        'div',
        { className: 'kk-toolbar' },
        h('span', { className: 'kk-title' }, 'Kanban'),
        h('span', { className: 'kk-stats' }, cards.length + ' tarjeta' + (cards.length === 1 ? '' : 's')),
        h('button', { className: 'kk-btn kk-btn-primary', onClick: handleAddColumn }, '+ Columna'),
      ),
      h(
        'div',
        { className: 'kk-board' },
        columns.map((col) =>
          h(ColumnView, {
            key: col.id,
            col,
            cards: cardsByColumn[col.id] || [],
            dragApi,
            onAddCard: handleAddCard,
            onEditCard: setEditingCard,
            onDeleteCard: handleDeleteCard,
            onRenameColumn: handleRenameColumn,
            onChangeColor: handleChangeColumnColor,
            onDeleteColumn: handleDeleteColumn,
          }),
        ),
      ),
      editingCard
        ? h(CardEditor, {
            card: editingCard,
            onSave: handleSaveCard,
            onDelete: handleDeleteCard,
            onClose: () => setEditingCard(null),
          })
        : null,
    );
  }

  return { Component };
}
