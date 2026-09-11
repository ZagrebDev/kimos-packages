/* ══ ARCHIVOS ═════════════════════════════════════════════════════════════
 *
 * Subida de imágenes (logo del emisor, fotos de los ítems, imágenes del
 * lienzo) al almacenamiento del tenant.
 *
 * El camino bueno es `shell.files` (APP-SPEC §7.e): la RUTA la decide el
 * host, no la app, y eso da aislamiento por app, cuota atribuible y limpieza
 * al desinstalar. Antes se hacía a mano con `authFetch` a `/api/v2/files`,
 * eligiendo nosotros la ruta; ese camino se conserva SOLO como respaldo para
 * un host que todavía no exponga `shell.files`, porque una cotización sin
 * poder subir su logo no es una cotización.
 *
 * Por qué NO se guardan como data-URI dentro del documento: una imagen de
 * medio mega dentro del item lo haría rebotar en cada guardado y viajaría
 * entero en cada sincronización. La cotización guarda solo la URL.
 */

const MAX_IMAGE_MB = 8;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/** Nombre de archivo seguro: sin rutas, sin acentos, sin espacios. */
function safeFileName(name, fallback) {
  const base = s(name).split(/[\\/]/).pop();
  const clean = canon(base.replace(/\.[a-z0-9]+$/i, '')).replace(/\s+/g, '-').slice(0, 60);
  const ext = (s(base).match(/\.([a-z0-9]{1,5})$/i) || [])[1] || '';
  return (clean || s(fallback) || 'archivo') + (ext ? '.' + ext.toLowerCase() : '');
}

/**
 * Sube un archivo y devuelve su URL pública. `folder` agrupa por uso
 * (`logos`, `items`, `lienzo`) para que el gestor de Archivos del tenant no
 * quede con un cajón de sastre.
 */
async function uploadImage(file, folder) {
  if (!file) throw new Error('No hay archivo.');
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error('La imagen supera los ' + MAX_IMAGE_MB + ' MB.');
  // El tipo lo valida la app: la plataforma no adivina qué es aceptable aquí.
  if (file.type && IMAGE_TYPES.indexOf(file.type) === -1) throw new Error('Formato no admitido: usa PNG, JPG, WEBP o SVG.');

  if (shell.files && typeof shell.files.upload === 'function') {
    return shell.files.upload(file, { folder: s(folder) || 'imagenes', maxMB: MAX_IMAGE_MB });
  }
  return subirALaAntigua(file, folder);
}

/**
 * Respaldo para un host sin `shell.files`: la app elige la ruta, que es
 * justo lo que `shell.files` vino a quitarle. Se mantiene para no dejar sin
 * logo a un tenant que no haya actualizado el shell, y debería desaparecer
 * cuando ya no queden.
 */
async function subirALaAntigua(file, folder) {
  if (!shell.authFetch) throw new Error('Este host no permite subir archivos.');
  const path = 'imagenes/cotizaciones/' + (s(folder) ? s(folder) + '/' : '')
    + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-'
    + safeFileName(file.name, 'imagen');

  const fd = new FormData();
  fd.append('path', path);
  fd.append('file', file);
  const res = await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(s(d.detail) || 'No se pudo subir (HTTP ' + res.status + ').');
  }
  return API + '/api/public/files/' + path;
}

/**
 * Campo de imagen reutilizable: URL editable + botón de subida + miniatura.
 * Se usa para el logo del emisor y para las imágenes de ítems y del lienzo.
 */
function ImageField(props) {
  const p = props || {};
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef(null);

  const elegir = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';                       // permite reelegir el mismo archivo
    if (!file) return;
    setSubiendo(true);
    try {
      const url = await uploadImage(file, p.folder);
      p.onChange(url);
      shell.notify({ level: 'success', text: 'Imagen subida.' });
    } catch (err) {
      shell.notify({ level: 'error', text: (err && err.message) || 'No se pudo subir la imagen.' });
    } finally { setSubiendo(false); }
  };

  return h('div', { className: cx('cz-imgfield', p.className) }, [
    p.value ? h('img', {
      key: 'p', className: 'cz-imgfield-thumb', src: p.value, alt: '',
      onError: (e) => { e.target.style.opacity = '.25'; },
    }) : h('div', { key: 'p', className: 'cz-imgfield-thumb cz-imgfield-empty' }, '🖼'),
    h('div', { key: 'c', className: 'cz-imgfield-ctl' }, [
      h(Input, {
        key: 'u', value: p.value || '', placeholder: p.placeholder || 'URL de la imagen',
        onChange: (e) => p.onChange(e.target.value),
      }),
      h('div', { key: 'b', className: 'cz-imgfield-btns' }, [
        h(Btn, {
          key: 's', size: 'sm', disabled: subiendo,
          onClick: () => inputRef.current && inputRef.current.click(),
        }, subiendo ? 'Subiendo…' : 'Subir…'),
        p.value ? h(Btn, { key: 'x', size: 'sm', onClick: () => p.onChange('') }, 'Quitar') : null,
      ]),
      h('input', {
        key: 'f', ref: inputRef, type: 'file', accept: 'image/*',
        style: { display: 'none' }, onChange: elegir,
      }),
    ]),
  ]);
}
