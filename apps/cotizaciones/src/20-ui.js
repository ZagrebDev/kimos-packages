/* ══ COMPONENTES BASE ═════════════════════════════════════════════════════
 *
 * Piezas de UI compartidas por toda la app. Ni un color cableado: todo sale
 * de las variables `--cz-*` del CSS, que a su vez cuelgan de los tokens del
 * tema del host (APP-SPEC §9), así la app cambia de día/noche y de acento
 * junto con KIMOS.
 *
 * Regla de seguridad de la casa: NADA de `dangerouslySetInnerHTML`. El texto
 * que escribe el usuario —o el que llega del catálogo de otra app— se pinta
 * siempre como elementos React.
 */

const cx = (...xs) => xs.filter(Boolean).join(' ');

/** Botón. `variant`: default (outline) · primary · ghost · danger. */
function Btn(props) {
  const p = props || {};
  const { variant, size, active, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button',
    className: cx('cz-btn', variant && 'cz-btn-' + variant, size === 'sm' && 'cz-btn-sm',
      size === 'lg' && 'cz-btn-lg', active && 'on', className),
  }, rest), children);
}

/** Botón cuadrado de solo icono; el nombre va en el tooltip. */
function IconBtn(props) {
  const p = props || {};
  const { icon, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button', className: cx('cz-ico', className),
  }, rest), icon || children);
}

/** Campo de texto controlado. */
function Input(props) {
  const p = props || {};
  const { className, mono, invalid, ...rest } = p;
  return h('input', Object.assign({
    className: cx('cz-in', mono && 'cz-mono', invalid && 'cz-in-bad', className),
  }, rest));
}

/**
 * Área de texto que crece con su contenido: en una cotización las
 * descripciones son de largo muy variable y una barra de scroll dentro de
 * una celda hace imposible leerlas.
 */
function AutoArea(props) {
  const p = props || {};
  const { className, minRows, ...rest } = p;
  const ref = useRef(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }, []);
  useEffect(fit, [p.value, fit]);
  return h('textarea', Object.assign({
    ref, rows: minRows || 1, className: cx('cz-in cz-area', className),
    onInput: fit,
  }, rest));
}

function Select(props) {
  const p = props || {};
  const { options, className, children, ...rest } = p;
  return h('select', Object.assign({ className: cx('cz-in cz-sel', className) }, rest),
    children || arr(options).map((o) => h('option', {
      key: s(o.value), value: o.value, disabled: o.disabled,
    }, s(o.label))));
}

/** Interruptor de sí/no, con la etiqueta como parte del área pulsable. */
function Toggle(props) {
  const p = props || {};
  return h('label', { className: cx('cz-toggle', p.className) }, [
    h('input', {
      key: 'i', type: 'checkbox', checked: !!p.checked, disabled: p.disabled,
      onChange: (e) => p.onChange && p.onChange(e.target.checked),
    }),
    h('span', { key: 'b', className: 'cz-toggle-box' }),
    p.label ? h('span', { key: 'l', className: 'cz-toggle-lbl' }, p.label) : null,
  ]);
}

/** Fila etiqueta + control de los formularios. */
function Field(props) {
  const p = props || {};
  return h('label', { className: cx('cz-field', p.wide && 'cz-field-wide', p.className) }, [
    h('span', { key: 'l', className: 'cz-field-lbl' }, [
      p.label,
      p.hint ? h('span', { key: 'h', className: 'cz-field-hint', title: p.hint }, ' ⓘ') : null,
    ]),
    h('span', { key: 'c', className: 'cz-field-ctl' }, p.children),
    p.help ? h('span', { key: 'e', className: 'cz-field-help' }, p.help) : null,
  ]);
}

/** Campo numérico con formato: se edita en crudo y se formatea al salir. */
function NumField(props) {
  const p = props || {};
  const [raw, setRaw] = useState(null);
  const shown = raw != null ? raw : (p.value === '' || p.value == null ? '' : numberFmt(p.value, p.decimals, p.locale));
  return h('input', {
    className: cx('cz-in cz-mono', p.align === 'right' && 'cz-right', p.className),
    inputMode: 'decimal',
    value: shown,
    placeholder: p.placeholder,
    disabled: p.disabled,
    title: p.title,
    onFocus: (e) => { setRaw(p.value === '' || p.value == null ? '' : String(p.value)); setTimeout(() => { try { e.target.select(); } catch (err) { /* no-op */ } }, 0); },
    onChange: (e) => {
      setRaw(e.target.value);
      if (p.live) p.onChange(e.target.value === '' ? '' : num(e.target.value));
    },
    onBlur: () => {
      const v = raw == null ? p.value : (s(raw).trim() === '' ? '' : num(raw));
      setRaw(null);
      if (!p.live) p.onChange(v);
      else if (s(raw).trim() === '') p.onChange('');
    },
    onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });
}

/**
 * Chip de estado. El color lo pone la clase, no un estilo en línea: así el
 * CSS puede dar una variante legible en modo noche, cosa que desde JS no se
 * puede decidir. El nombre del estado va SIEMPRE como texto, de modo que
 * nadie dependa del color para leerlo.
 */
function StatusChip(props) {
  const st = isStatus(props && props.status) ? props.status : 'draft';
  return h('span', {
    className: 'cz-chip cz-chip-status cz-st-' + st,
    title: 'Estado: ' + STATUS_LABEL.get(st),
  }, STATUS_LABEL.get(st));
}

function Chip(props) {
  const p = props || {};
  return h(p.onClick ? 'button' : 'span', {
    className: cx('cz-chip', p.on && 'on', p.className),
    onClick: p.onClick,
    title: p.title,
    type: p.onClick ? 'button' : undefined,
  }, p.children);
}

/** Pantalla de estado vacío: qué falta y qué hacer al respecto. */
function Empty(props) {
  const p = props || {};
  return h('div', { className: 'cz-empty' }, [
    h('div', { key: 'i', className: 'cz-empty-ico' }, p.icon || '🧾'),
    h('div', { key: 't', className: 'cz-empty-title' }, p.title),
    p.text ? h('div', { key: 'x', className: 'cz-empty-text' }, p.text) : null,
    p.action ? h('div', { key: 'a', className: 'cz-empty-action' }, p.action) : null,
  ]);
}

/**
 * Diálogo modal. Se monta dentro de la ventana de la app (no en el body) para
 * que herede el tema y quede recortado por la ventana del shell.
 */
function Modal(props) {
  const p = props || {};
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && p.onClose) p.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.onClose]);
  if (!p.open) return null;
  return h('div', {
    className: 'cz-modal-back',
    onMouseDown: (e) => { if (e.target === e.currentTarget && p.onClose) p.onClose(); },
  }, h('div', { className: cx('cz-modal', p.wide && 'cz-modal-wide', p.full && 'cz-modal-full') }, [
    h('div', { key: 'h', className: 'cz-modal-hd' }, [
      h('div', { key: 't', className: 'cz-modal-title' }, p.title),
      h(IconBtn, { key: 'x', icon: '✕', title: 'Cerrar', onClick: p.onClose }),
    ]),
    h('div', { key: 'b', className: 'cz-modal-body' }, p.children),
    p.footer ? h('div', { key: 'f', className: 'cz-modal-ft' }, p.footer) : null,
  ]));
}

/**
 * Confirmación. Devuelve una promesa que resuelve a true/false, para poder
 * escribir `if (await confirm(...))` en los manejadores sin encadenar estados.
 */
function useConfirm() {
  const [state, setState] = useState(null);
  const ask = useCallback((opts) => new Promise((resolve) => {
    setState(Object.assign({ resolve }, isObj(opts) ? opts : { text: s(opts) }));
  }), []);
  const close = (val) => { if (state && state.resolve) state.resolve(val); setState(null); };
  const node = h(Modal, {
    open: !!state,
    title: (state && state.title) || 'Confirmar',
    onClose: () => close(false),
    footer: [
      h(Btn, { key: 'c', onClick: () => close(false) }, (state && state.cancelLabel) || 'Cancelar'),
      h(Btn, {
        key: 'o',
        variant: state && state.danger ? 'danger' : 'primary',
        onClick: () => close(true),
      }, (state && state.okLabel) || 'Confirmar'),
    ],
  }, h('div', { className: 'cz-confirm-text' }, (state && state.text) || ''));
  return [ask, node];
}

/** Buscador con el aspa para limpiar. */
function SearchBox(props) {
  const p = props || {};
  return h('div', { className: 'cz-search' }, [
    h('span', { key: 'i', className: 'cz-search-ico' }, '🔎'),
    h('input', {
      key: 'in', className: 'cz-in cz-search-in', value: p.value || '',
      placeholder: p.placeholder || 'Buscar…',
      onChange: (e) => p.onChange(e.target.value),
    }),
    p.value ? h(IconBtn, { key: 'x', icon: '✕', title: 'Limpiar', onClick: () => p.onChange('') }) : null,
  ]);
}

/** Indicador de sincronización: guardando · al día · sin conexión. */
function SyncDot(props) {
  const sy = (props && props.sync) || {};
  const state = sy.offline ? 'off' : (sy.saving > 0 ? 'busy' : 'ok');
  const label = sy.offline
    ? 'Sin conexión con el servidor: los cambios se reintentan solos.'
    : (sy.saving > 0 ? 'Guardando…' : (sy.at ? 'Al día · última sincronización ' + new Date(sy.at).toLocaleTimeString() : 'Al día'));
  return h('span', { className: cx('cz-sync', 'cz-sync-' + state), title: label }, [
    h('span', { key: 'd', className: 'cz-sync-dot' }),
    h('span', { key: 't', className: 'cz-sync-txt' }, sy.offline ? 'Sin conexión' : (sy.saving > 0 ? 'Guardando' : 'Guardado')),
  ]);
}

/** Editor de una lista de textos (las notas de la propuesta). */
function TextList(props) {
  const p = props || {};
  const items = arr(p.value);
  const set = (i, v) => { const next = items.slice(); next[i] = v; p.onChange(next); };
  const del = (i) => p.onChange(items.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    const t = next[i]; next[i] = next[j]; next[j] = t;
    p.onChange(next);
  };
  return h('div', { className: 'cz-textlist' }, [
    ...items.map((t, i) => h('div', { key: 'r' + i, className: 'cz-textlist-row' }, [
      h('span', { key: 'b', className: 'cz-textlist-bullet' }, '–'),
      h(AutoArea, {
        key: 'a', value: t, placeholder: p.placeholder || 'Nota…',
        onChange: (e) => set(i, e.target.value),
      }),
      h('div', { key: 'x', className: 'cz-textlist-acts' }, [
        h(IconBtn, { key: 'u', icon: '↑', title: 'Subir', disabled: i === 0, onClick: () => move(i, -1) }),
        h(IconBtn, { key: 'd', icon: '↓', title: 'Bajar', disabled: i === items.length - 1, onClick: () => move(i, 1) }),
        h(IconBtn, { key: 'r', icon: '🗑', title: 'Quitar', onClick: () => del(i) }),
      ]),
    ])),
    h(Btn, {
      key: 'add', size: 'sm', className: 'cz-textlist-add',
      onClick: () => p.onChange(items.concat([''])),
    }, '+ Añadir nota'),
  ]);
}
