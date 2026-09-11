/* ══ COMPONENTES BASE ═════════════════════════════════════════════════════
 *
 * Todo con `React.createElement` (sin JSX, APP-SPEC §3) y todo el color desde
 * los tokens del tema del host (§9): esta app no puede cablear un solo color,
 * porque es justo la que enseña a no hacerlo.
 */

const cx = (...xs) => xs.filter(Boolean).join(' ');

function Btn(props) {
  const p = props || {};
  const { variant, size, active, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button',
    className: cx('mk-btn', variant && 'mk-btn-' + variant, size === 'sm' && 'mk-btn-sm',
      active && 'on', className),
  }, rest), children);
}

function IconBtn(props) {
  const p = props || {};
  const { icon, className, children, ...rest } = p;
  return h('button', Object.assign({
    type: 'button', className: cx('mk-ico', className),
  }, rest), icon || children);
}

function Input(props) {
  const p = props || {};
  const { className, mono, invalid, ...rest } = p;
  return h('input', Object.assign({
    className: cx('mk-in', mono && 'mk-mono', invalid && 'mk-in-bad', className),
  }, rest));
}

function Area(props) {
  const p = props || {};
  const { className, rows, ...rest } = p;
  return h('textarea', Object.assign({
    className: cx('mk-in mk-area', className), rows: rows || 3,
  }, rest));
}

function Select(props) {
  const p = props || {};
  const { options, className, ...rest } = p;
  return h('select', Object.assign({ className: cx('mk-in mk-sel', className) }, rest),
    arr(options).map((o) => h('option', { key: o[0], value: o[0] }, o[1])));
}

function Field(props) {
  const p = props || {};
  return h('label', { className: cx('mk-field', p.wide && 'mk-field-wide', p.className) }, [
    p.label ? h('span', { key: 'l', className: 'mk-field-lbl' }, p.label) : null,
    h('span', { key: 'c', className: 'mk-field-ctl' }, p.children),
    p.help ? h('span', { key: 'h', className: 'mk-field-help' }, p.help) : null,
  ]);
}

/** Cabecera de una sección del editor o de la hoja. */
function SecHead(props) {
  const p = props || {};
  return h('div', { className: 'mk-sechead' }, [
    p.num ? h('span', { key: 'n', className: 'mk-sechead-num' }, p.num) : null,
    h('span', { key: 't', className: 'mk-sechead-t' }, p.title),
    h('span', { key: 'sp', className: 'mk-sp' }),
    p.right || null,
  ]);
}

function Empty(props) {
  const p = props || {};
  return h('div', { className: 'mk-empty' }, [
    h('div', { key: 'i', className: 'mk-empty-icon' }, p.icon || '🎨'),
    h('div', { key: 't', className: 'mk-empty-title' }, p.title),
    p.text ? h('p', { key: 'x', className: 'mk-empty-text' }, p.text) : null,
    p.action ? h('div', { key: 'a', className: 'mk-empty-action' }, p.action) : null,
  ]);
}

/**
 * Avisos de la marca. No son errores: una marca a medio construir es un
 * estado legítimo. Pero se ven, porque una marca sin color base no re-marca
 * nada y nadie sabría por qué.
 */
function Avisos(props) {
  const lista = arr((props || {}).avisos);
  if (!lista.length) return null;
  return h('ul', { className: 'mk-avisos' }, lista.map((a, i) =>
    h('li', { key: i }, a)));
}

function Modal(props) {
  const p = props || {};
  if (!p.open) return null;
  return h('div', { className: 'mk-modal-bg', onClick: (e) => { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
    h('div', { className: cx('mk-modal', p.wide && 'mk-modal-wide'), role: 'dialog', 'aria-label': p.title }, [
      h('div', { key: 'h', className: 'mk-modal-hd' }, [
        h('h3', { key: 't' }, p.title),
        h(IconBtn, { key: 'x', icon: '✕', title: 'Cerrar', onClick: p.onClose }),
      ]),
      h('div', { key: 'b', className: 'mk-modal-body' }, p.children),
      p.footer ? h('div', { key: 'f', className: 'mk-modal-ft' }, p.footer) : null,
    ]));
}

/** Muestra de color con su rol, nombre, hex y rgb — el bloque de la hoja. */
function Swatch(props) {
  const p = props || {};
  const c = p.color || {};
  return h('div', {
    className: 'mk-sw',
    style: { background: c.hex, color: c.foreground },
    title: c.name + ' · ' + c.hex,
  }, [
    h('span', { key: 'r', className: 'mk-sw-role' }, c.roleLabel || ''),
    h('span', { key: 'n', className: 'mk-sw-nm' }, c.name || ''),
    h('span', { key: 'h', className: 'mk-sw-hex' }, (c.hex || '').toUpperCase()),
    h('span', { key: 'g', className: 'mk-sw-rgb' }, c.rgb || ''),
  ]);
}

/** El logo sobre el fondo que le corresponde: así se ve si de verdad funciona. */
function LogoBox(props) {
  const p = props || {};
  const l = p.logo || {};
  const marca = p.brand || {};
  const base = colorPorRol(marca, 'base');
  const fondo = l.background === 'dark' ? (base ? base.hex : '#1d1d1b')
    : l.background === 'light' ? '#f5f5f5'
      : l.background === 'color' ? ((colorPorRol(marca, 'accent') || {}).hex || '#f5f5f5')
        : 'transparent';
  return h('div', { className: 'mk-logobox' }, [
    h('div', {
      key: 'i',
      className: cx('mk-logobox-img', l.background === 'transparent' && 'mk-tramado'),
      style: { background: fondo },
    }, l.url
      ? h('img', { src: l.url, alt: l.name || 'Logotipo' })
      : h('span', { className: 'mk-logobox-falta' }, 'Sin archivo')),
    h('div', { key: 'l', className: 'mk-logobox-lbl' }, [
      h('b', { key: 'n' }, l.name || ''),
      h('span', { key: 'b' }, l.backgroundLabel || ''),
    ]),
  ]);
}
