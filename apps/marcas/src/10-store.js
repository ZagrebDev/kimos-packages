/* ══ ESTADO Y RED ═════════════════════════════════════════════════════════
 *
 * El estado de la app es un espejo del registro de la plataforma más lo que
 * se está editando. No hay persistencia propia: `shell.brands` es la fuente.
 *
 * Por qué hay un borrador (`draft`) en vez de escribir en cada tecla: editar
 * una marca cambia cómo se ven las propuestas de TODAS las apps. Guardar a
 * cada pulsación convertiría un tanteo de color en un cambio en producción.
 * Se guarda cuando la persona lo pide, y mientras tanto se ve el resultado.
 */

const model = {
  loading: true,
  error: '',
  /** Solo lectura: sin `brand.write` la app se ve pero no se edita. */
  readonly: false,
  brands: [],
  currentId: '',
  selectedId: '',
  /** La marca en edición. `null` = no hay nada abierto. */
  draft: null,
  dirty: false,
  saving: false,
  tab: 'sistema',        // 'sistema' (la hoja) | 'editor'
  seccion: 'logos',      // sección abierta del editor
  hojaSecciones: SECCIONES.map((x) => x[0]),
  lamina: 'identidad',   // la plana que se está viendo
};

let estado = model;
const listeners = new Set();
const emit = () => listeners.forEach((l) => { try { l(Object.assign({}, estado)); } catch (e) { /* un oyente roto no rompe al resto */ } });

const getModel = () => estado;
const setModel = (patch) => { estado = Object.assign({}, estado, patch); emit(); };
const suscribir = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const marcaPorId = (id) => arr(estado.brands).find((b) => b.id === s(id)) || null;
const seleccionada = () => estado.draft || marcaPorId(estado.selectedId);

/** '' si se puede usar el registro; si no, el motivo, para poder explicarlo. */
function registroNoDisponible() {
  if (!shell.brands || typeof shell.brands.list !== 'function') {
    return 'Este host todavía no expone el registro de marcas. Actualiza KIMOS para usar esta app.';
  }
  return '';
}

const puedeEditar = () => !!(shell.brands && typeof shell.brands.update === 'function') && !estado.readonly;

/**
 * Lee el registro. `mantener` conserva la selección tras guardar, para que la
 * pantalla no salte al principio cada vez que se pulsa Guardar.
 */
async function cargar(mantener) {
  const motivo = registroNoDisponible();
  if (motivo) { setModel({ loading: false, error: motivo }); return []; }

  setModel({ loading: true, error: '' });
  try {
    const data = await shell.brands.list();
    const brands = arr(data.brands).map(normalizeBrand);
    const antes = mantener ? s(estado.selectedId) : '';
    const sigue = brands.find((b) => b.id === antes);
    const elegida = sigue || brands.find((b) => b.id === s(data.currentId)) || brands[0] || null;
    setModel({
      loading: false,
      error: '',
      readonly: !(shell.brands && typeof shell.brands.update === 'function'),
      brands,
      currentId: s(data.currentId),
      selectedId: elegida ? elegida.id : '',
      draft: null,
      dirty: false,
    });
    return brands;
  } catch (e) {
    setModel({
      loading: false,
      error: (e && e.message) || 'No se pudo leer el registro de marcas.',
    });
    return [];
  }
}

/** Abre una marca para editarla: el borrador es una copia, no la del listado. */
function abrirBorrador(id) {
  const b = marcaPorId(id || estado.selectedId);
  if (!b) return null;
  const copia = normalizeBrand(JSON.parse(JSON.stringify(b)));
  setModel({ selectedId: b.id, draft: copia, dirty: false });
  return copia;
}

/** Cambia el borrador. Si no había, lo abre: editar es un gesto, no dos. */
function editarBorrador(mutar) {
  const base = estado.draft || (() => {
    const b = marcaPorId(estado.selectedId);
    return b ? normalizeBrand(JSON.parse(JSON.stringify(b))) : null;
  })();
  if (!base) return null;
  const next = normalizeBrand(mutar(base) || base);
  setModel({ draft: next, dirty: true });
  return next;
}

function teardown() {
  listeners.clear();
  if (typeof desregistrarAgente === 'function') desregistrarAgente();
}
