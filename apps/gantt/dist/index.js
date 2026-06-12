/**
 * Gantt — app instalable de Kimos.
 *
 * Bundle ESM autocontenido. Usa React desde globalThis (lo expone el shell).
 *
 * Contrato:
 *   export default function mount(shell): { Component }
 *
 * Persistencia: shell.saveData/loadData ↔ instance.json (config.periods + config.tasks).
 */

const STATUS = [
  { id: 'pending', label: 'Pendiente', color: '#94a3b8' },
  { id: 'in_progress', label: 'En curso', color: '#3b82f6' },
  { id: 'completed', label: 'Hecho', color: '#22c55e' },
  { id: 'blocked', label: 'Bloqueado', color: '#ef4444' },
];

function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4);
}

function defaultPeriods(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: uid('p'),
      name: 'Período ' + (i + 1),
      shortName: 'P' + (i + 1),
    });
  }
  return out;
}

function normalizePeriods(input) {
  if (!Array.isArray(input) || input.length === 0) return defaultPeriods(4);
  const out = [];
  const seen = new Set();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || uid('p')).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: typeof raw.name === 'string' && raw.name ? raw.name : id,
      shortName: typeof raw.shortName === 'string' && raw.shortName ? raw.shortName : id.slice(0, 3),
      startDate: typeof raw.startDate === 'string' ? raw.startDate : undefined,
      endDate: typeof raw.endDate === 'string' ? raw.endDate : undefined,
    });
  }
  return out.length ? out : defaultPeriods(4);
}

function normalizeTasks(input, periodsCount) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || uid('t')).trim();
    if (!id) continue;
    const periods = Array.from({ length: periodsCount }, (_, i) =>
      Array.isArray(raw.periods) ? Boolean(raw.periods[i]) : false,
    );
    const status = STATUS.find((s) => s.id === raw.status) ? raw.status : 'pending';
    const progress = typeof raw.progress === 'number' ? Math.max(0, Math.min(100, raw.progress)) : 0;
    out.push({
      id,
      name: typeof raw.name === 'string' && raw.name ? raw.name : 'Sin título',
      periods,
      progress,
      status,
      notes: typeof raw.notes === 'string' ? raw.notes : '',
    });
  }
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

  function PeriodHeader({ period, onRename, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(period.name);
    const commit = () => {
      const next = draft.trim();
      if (next && next !== period.name) onRename(period.id, next);
      setEditing(false);
    };
    return h(
      'th',
      { className: 'kg-period' },
      h(
        'div',
        { className: 'kg-period-inner' },
        editing
          ? h('input', {
              className: 'kg-period-input',
              value: draft,
              autoFocus: true,
              onChange: (e) => setDraft(e.target.value),
              onBlur: commit,
              onKeyDown: (e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') { setDraft(period.name); setEditing(false); }
              },
            })
          : h(
              'span',
              {
                className: 'kg-period-label',
                onDoubleClick: () => { setDraft(period.name); setEditing(true); },
                title: 'Doble click para renombrar',
              },
              period.name,
            ),
        h(
          'button',
          {
            className: 'kg-icon-btn kg-danger',
            title: 'Eliminar período',
            onClick: () => {
              if (confirm('¿Eliminar período "' + period.name + '"?')) onDelete(period.id);
            },
          },
          '×',
        ),
      ),
    );
  }

  function TaskRow({ task, periods, onToggle, onRangeStart, onRangeOver, onRangeEnd, onEdit, onDelete, isDraggingRange }) {
    const statusDef = STATUS.find((s) => s.id === task.status) || STATUS[0];
    return h(
      'tr',
      { className: 'kg-task-row' },
      h(
        'td',
        { className: 'kg-task-cell' },
        h(
          'div',
          { className: 'kg-task-meta' },
          h('span', { className: 'kg-status-dot', style: { background: statusDef.color }, title: statusDef.label }),
          h('span', { className: 'kg-task-name', onClick: () => onEdit(task) }, task.name),
          h(
            'button',
            {
              className: 'kg-icon-btn kg-danger',
              title: 'Eliminar tarea',
              onClick: () => { if (confirm('¿Eliminar tarea "' + task.name + '"?')) onDelete(task.id); },
            },
            '×',
          ),
        ),
      ),
      periods.map((p, idx) => {
        const filled = !!task.periods[idx];
        return h(
          'td',
          {
            key: p.id,
            className: 'kg-cell' + (filled ? ' kg-cell-filled' : ''),
            onMouseDown: (e) => { e.preventDefault(); onRangeStart(task.id, idx, !filled); },
            onMouseEnter: () => { if (isDraggingRange) onRangeOver(task.id, idx); },
            onMouseUp: () => onRangeEnd(),
            onClick: () => onToggle(task.id, idx),
            style: filled ? { background: statusDef.color } : undefined,
            title: p.name + (filled ? ' — incluido' : ''),
          },
          filled ? h('span', { className: 'kg-cell-bar' }) : null,
        );
      }),
    );
  }

  function TaskEditor({ task, onSave, onDelete, onClose }) {
    const [name, setName] = useState(task.name);
    const [status, setStatus] = useState(task.status);
    const [progress, setProgress] = useState(task.progress);
    const [notes, setNotes] = useState(task.notes || '');
    return h(
      'div',
      { className: 'kg-modal-overlay', onClick: onClose },
      h(
        'div',
        { className: 'kg-modal', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'kg-modal-header' }, 'Editar tarea'),
        h('label', { className: 'kg-modal-label' }, 'Nombre'),
        h('input', { className: 'kg-modal-input', value: name, autoFocus: true, onChange: (e) => setName(e.target.value) }),
        h('label', { className: 'kg-modal-label' }, 'Estado'),
        h(
          'select',
          { className: 'kg-modal-input', value: status, onChange: (e) => setStatus(e.target.value) },
          STATUS.map((s) => h('option', { key: s.id, value: s.id }, s.label)),
        ),
        h('label', { className: 'kg-modal-label' }, 'Progreso: ' + progress + '%'),
        h('input', {
          type: 'range', min: 0, max: 100, step: 5,
          value: progress, onChange: (e) => setProgress(Number(e.target.value)),
          className: 'kg-modal-range',
        }),
        h('label', { className: 'kg-modal-label' }, 'Notas'),
        h('textarea', { className: 'kg-modal-textarea', value: notes, onChange: (e) => setNotes(e.target.value) }),
        h(
          'div',
          { className: 'kg-modal-actions' },
          h('button', { className: 'kg-btn kg-btn-danger', onClick: () => { if (confirm('¿Eliminar tarea?')) onDelete(task.id); } }, 'Eliminar'),
          h('div', { style: { flex: 1 } }),
          h('button', { className: 'kg-btn kg-btn-ghost', onClick: onClose }, 'Cancelar'),
          h('button', {
            className: 'kg-btn kg-btn-primary',
            onClick: () => onSave({ ...task, name: name.trim() || 'Sin título', status, progress, notes: notes.trim() }),
          }, 'Guardar'),
        ),
      ),
    );
  }

  function Component() {
    const [periods, setPeriods] = useState(defaultPeriods(4));
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTask, setEditingTask] = useState(null);
    const saveTimerRef = useRef(null);
    const skipSaveRef = useRef(true);
    const rangeRef = useRef({ active: false, taskId: null, fill: true, anchor: -1 });
    const [, forceRender] = useState(0);

    useEffect(() => {
      let cancelled = false;
      shell.loadData().then((data) => {
        if (cancelled) return;
        const cfg = (data && typeof data === 'object') ? data : {};
        const ps = normalizePeriods(cfg.periods);
        const ts = normalizeTasks(cfg.tasks, ps.length);
        setPeriods(ps);
        setTasks(ts);
      }).catch(() => {}).finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => { cancelled = true; };
    }, []);

    useEffect(() => {
      if (loading) return;
      if (skipSaveRef.current) { skipSaveRef.current = false; return; }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        shell.saveData({ periods, tasks }).catch((err) => {
          notify('error', (err && err.message) || 'No se pudo guardar el plan');
        });
      }, 600);
      return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [periods, tasks, loading]);

    // Mantener los arrays de `periods` por tarea alineados con el largo real.
    useEffect(() => {
      setTasks((prev) => prev.map((t) => {
        if (t.periods.length === periods.length) return t;
        const next = Array.from({ length: periods.length }, (_, i) => Boolean(t.periods[i]));
        return { ...t, periods: next };
      }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periods.length]);

    const handleAddTask = useCallback(() => {
      const task = {
        id: uid('t'),
        name: 'Nueva tarea',
        periods: Array.from({ length: periods.length }, () => false),
        progress: 0,
        status: 'pending',
        notes: '',
      };
      setTasks((prev) => [...prev, task]);
      setEditingTask(task);
    }, [periods.length]);

    const handleSaveTask = useCallback((updated) => {
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTask(null);
    }, []);

    const handleDeleteTask = useCallback((taskId) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setEditingTask(null);
    }, []);

    const handleAddPeriod = useCallback(() => {
      setPeriods((prev) => [
        ...prev,
        { id: uid('p'), name: 'Período ' + (prev.length + 1), shortName: 'P' + (prev.length + 1) },
      ]);
    }, []);

    const handleRenamePeriod = useCallback((periodId, name) => {
      setPeriods((prev) => prev.map((p) => (p.id === periodId ? { ...p, name } : p)));
    }, []);

    const handleDeletePeriod = useCallback((periodId) => {
      setPeriods((prev) => {
        if (prev.length === 1) {
          notify('warn', 'No puedes eliminar el último período');
          return prev;
        }
        const idx = prev.findIndex((p) => p.id === periodId);
        if (idx === -1) return prev;
        setTasks((ts) => ts.map((t) => ({
          ...t,
          periods: t.periods.filter((_, i) => i !== idx),
        })));
        return prev.filter((p) => p.id !== periodId);
      });
    }, []);

    const handleToggleCell = useCallback((taskId, idx) => {
      // Se llama tras mouseup si no hubo arrastre real; el range click ya
      // hizo el cambio. Lo evitamos para no toggle doble.
      if (rangeRef.current.anchor === idx && rangeRef.current.taskId === taskId) return;
      setTasks((prev) => prev.map((t) => {
        if (t.id !== taskId) return t;
        const periods = [...t.periods];
        periods[idx] = !periods[idx];
        return { ...t, periods };
      }));
    }, []);

    const handleRangeStart = useCallback((taskId, idx, fill) => {
      rangeRef.current = { active: true, taskId, fill, anchor: idx };
      setTasks((prev) => prev.map((t) => {
        if (t.id !== taskId) return t;
        const periods = [...t.periods];
        periods[idx] = fill;
        return { ...t, periods };
      }));
      forceRender((v) => v + 1);
    }, []);

    const handleRangeOver = useCallback((taskId, idx) => {
      const r = rangeRef.current;
      if (!r.active || r.taskId !== taskId) return;
      setTasks((prev) => prev.map((t) => {
        if (t.id !== taskId) return t;
        const periods = [...t.periods];
        const from = Math.min(r.anchor, idx);
        const to = Math.max(r.anchor, idx);
        for (let i = from; i <= to; i++) periods[i] = r.fill;
        return { ...t, periods };
      }));
    }, []);

    const handleRangeEnd = useCallback(() => {
      rangeRef.current = { active: false, taskId: null, fill: true, anchor: -1 };
    }, []);

    useEffect(() => {
      const up = () => handleRangeEnd();
      window.addEventListener('mouseup', up);
      return () => window.removeEventListener('mouseup', up);
    }, [handleRangeEnd]);

    const stats = useMemo(() => {
      const total = tasks.length;
      const done = tasks.filter((t) => t.status === 'completed').length;
      return { total, done };
    }, [tasks]);

    if (loading) {
      return h('div', { className: 'kimos-gantt kg-loading' }, 'Cargando plan…');
    }

    return h(
      'div',
      { className: 'kimos-gantt' },
      h(
        'div',
        { className: 'kg-toolbar' },
        h('span', { className: 'kg-title' }, 'Gantt'),
        h('span', { className: 'kg-stats' },
          stats.total + ' tarea' + (stats.total === 1 ? '' : 's') + ' · ' + stats.done + ' hechas'),
        h('button', { className: 'kg-btn kg-btn-ghost', onClick: handleAddPeriod }, '+ Período'),
        h('button', { className: 'kg-btn kg-btn-primary', onClick: handleAddTask }, '+ Tarea'),
      ),
      h(
        'div',
        { className: 'kg-table-wrap' },
        h(
          'table',
          { className: 'kg-table' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { className: 'kg-task-col' }, 'Tarea'),
              periods.map((p) =>
                h(PeriodHeader, { key: p.id, period: p, onRename: handleRenamePeriod, onDelete: handleDeletePeriod }),
              ),
            ),
          ),
          h(
            'tbody',
            null,
            tasks.length === 0
              ? h(
                  'tr',
                  null,
                  h(
                    'td',
                    { colSpan: periods.length + 1, className: 'kg-empty' },
                    'No hay tareas todavía. Pulsa "+ Tarea" para crear una.',
                  ),
                )
              : tasks.map((task) =>
                  h(TaskRow, {
                    key: task.id,
                    task,
                    periods,
                    isDraggingRange: rangeRef.current.active,
                    onToggle: handleToggleCell,
                    onRangeStart: handleRangeStart,
                    onRangeOver: handleRangeOver,
                    onRangeEnd: handleRangeEnd,
                    onEdit: setEditingTask,
                    onDelete: handleDeleteTask,
                  }),
                ),
          ),
        ),
      ),
      editingTask
        ? h(TaskEditor, {
            task: editingTask,
            onSave: handleSaveTask,
            onDelete: handleDeleteTask,
            onClose: () => setEditingTask(null),
          })
        : null,
    );
  }

  return { Component };
}
