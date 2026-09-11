/* ══ DIÁLOGO DE ENVÍO ═════════════════════════════════════════════════════
 *
 * Lo último que ve la persona antes de que el correo salga, así que muestra
 * exactamente lo que se va a mandar: destinatarios, asunto, cuerpo ya con las
 * variables sustituidas y la lista de adjuntos.
 *
 * Sobre el adjunto, otra vez porque es la duda que aparece siempre: el PDF lo
 * genera el diálogo de impresión del navegador y lo guarda el usuario en su
 * disco — la página nunca lo recibe. Por eso se ofrece adjuntar la propuesta
 * como HTML de un clic (eso sí se puede generar aquí), enlazarla publicada, o
 * añadir a mano el PDF que se acaba de exportar.
 */

/** Lee un archivo del disco como base64, que es como viaja el adjunto. */
function leerArchivoBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const res = s(fr.result);
      resolve({
        filename: s(file.name) || 'adjunto',
        contentType: s(file.type) || 'application/octet-stream',
        contentBase64: res.indexOf(',') >= 0 ? res.slice(res.indexOf(',') + 1) : res,
        size: file.size,
      });
    };
    fr.onerror = () => reject(new Error('No se pudo leer ' + s(file.name)));
    fr.readAsDataURL(file);
  });
}

const MAX_ADJUNTO_MB = 10;
const MAX_TOTAL_MB = 20;
const pesoTotal = (lista) => arr(lista).reduce((a, x) => a + num(x.size), 0);
const enMb = (bytes) => (num(bytes) / (1024 * 1024)).toFixed(1);

function SendMailModal(props) {
  const { m, doc, onClose } = props;
  const [estado, setEstado] = useState(null);
  const [tplId, setTplId] = useState(() => {
    const d = defaultMailTemplate();
    return d ? d.id : '';
  });
  const [correo, setCorreo] = useState(() => resolverCorreo(defaultMailTemplate(), doc));
  const [adjuntos, setAdjuntos] = useState([]);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [verHtml, setVerHtml] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { mailStatus().then(setEstado); }, []);

  const set = (p) => setCorreo(Object.assign({}, correo, p));
  const cambiarPlantilla = (id) => {
    setTplId(id);
    setCorreo(resolverCorreo(id ? mailById(id) : null, doc));
  };

  const añadirArchivos = async (files) => {
    setError('');
    const nuevos = [];
    for (const f of Array.from(files || [])) {
      if (f.size > MAX_ADJUNTO_MB * 1024 * 1024) {
        setError('«' + f.name + '» pesa ' + enMb(f.size) + ' MB y el máximo por adjunto es ' + MAX_ADJUNTO_MB + ' MB.');
        continue;
      }
      try { nuevos.push(await leerArchivoBase64(f)); } catch (e) { setError(e.message); }
    }
    const total = pesoTotal(adjuntos) + pesoTotal(nuevos);
    if (total > MAX_TOTAL_MB * 1024 * 1024) {
      setError('Los adjuntos suman ' + enMb(total) + ' MB y el máximo es ' + MAX_TOTAL_MB + ' MB.');
      return;
    }
    setAdjuntos(adjuntos.concat(nuevos));
  };

  /** Genera la propuesta como HTML autocontenido y la deja adjunta. */
  const adjuntarPropuesta = async () => {
    setOcupado('html');
    setError('');
    try {
      const html = await construirHtmlPropuesta(doc, exportOpts());
      const bytes = new TextEncoder().encode(html);
      let bin = '';
      // En trozos: con una propuesta grande, un solo apply desborda la pila.
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      setAdjuntos(adjuntos.concat([{
        filename: nombreArchivo(doc) + '.html',
        contentType: 'text/html',
        contentBase64: btoa(bin),
        size: bytes.length,
      }]));
    } catch (e) {
      setError((e && e.message) || 'No se pudo generar la propuesta.');
    } finally { setOcupado(''); }
  };

  const publicar = async () => {
    setOcupado('link');
    const url = await actPublishQuote(doc.id);
    setOcupado('');
    if (url) set({ includeLink: true });
  };

  const enviar = async () => {
    setOcupado('send');
    setError('');
    const res = await actSendMail(doc.id, Object.assign({}, correo, {
      attachments: adjuntos,
      link: doc.publicUrl,
      linkLabel: 'Ver la propuesta ' + (doc.number || ''),
    }));
    setOcupado('');
    if (res.ok) onClose();
    else setError(res.error);
  };

  const enlaceListo = !!s(doc.publicUrl);
  const puedeEnviar = estado && estado.configured && s(correo.to).trim() && s(correo.subject).trim() && !ocupado;

  return h(Modal, {
    open: true, wide: true, title: 'Enviar por correo · ' + (doc.number || doc.name), onClose,
    footer: [
      error ? h('span', { key: 'e', className: 'cz-send-err' }, error) : null,
      h('div', { key: 'sp', className: 'cz-spacer' }),
      h(Btn, { key: 'c', onClick: onClose }, 'Cancelar'),
      h(Btn, {
        key: 's', variant: 'primary', disabled: !puedeEnviar, onClick: enviar,
      }, ocupado === 'send' ? 'Enviando…' : '✉ Enviar ahora'),
    ],
  }, [
    estado && !estado.configured
      ? h('div', { key: 'w', className: 'cz-banner warn' }, estado.reason)
      : null,
    estado && estado.configured
      ? h('div', { key: 'f', className: 'cz-banner ok' }, 'Sale desde ' + (estado.fromEmail || 'el buzón de la empresa') + ' (SMTP del tenant).')
      : null,

    h('div', { key: 'g', className: 'cz-grid2' }, [
      h(Field, { key: 't', label: 'Plantilla' }, h(Select, {
        value: tplId, onChange: (e) => cambiarPlantilla(e.target.value),
        options: [{ value: '', label: m.mails.length ? 'Sin plantilla (escribir a mano)' : 'No hay plantillas todavía' }]
          .concat(m.mails.map((x) => ({ value: x.id, label: x.name + (x.isDefault ? ' ⭐' : '') }))),
      })),
      h(Field, { key: 'to', label: 'Para' },
        h(Input, {
          value: correo.to, placeholder: 'cliente@empresa.cl',
          invalid: !!s(correo.to).trim() && s(correo.to).indexOf('@') === -1,
          onChange: (e) => set({ to: e.target.value }),
        })),
      h(Field, { key: 'cc', label: 'Copia (Cc)' },
        h(Input, { value: correo.cc, onChange: (e) => set({ cc: e.target.value }) })),
      h(Field, { key: 'bcc', label: 'Copia oculta (Cco)' },
        h(Input, { value: correo.bcc, onChange: (e) => set({ bcc: e.target.value }) })),
      h(Field, { key: 'rt', label: 'Responder a' },
        h(Input, { value: correo.replyTo, onChange: (e) => set({ replyTo: e.target.value }) })),
      h(Field, { key: 's', label: 'Asunto', wide: true },
        h(Input, { value: correo.subject, onChange: (e) => set({ subject: e.target.value }) })),
      h(Field, { key: 'b', label: 'Mensaje', wide: true },
        h('textarea', {
          className: 'cz-in cz-mailbody', rows: 10, value: correo.body,
          placeholder: 'Escribe el mensaje…',
          onChange: (e) => set({ body: e.target.value }),
        })),
    ]),

    // ── La propuesta: enlace y adjuntos ──────────────────────────────
    h('div', { key: 'adj', className: 'cz-send-adj' }, [
      h('div', { key: 't', className: 'cz-vars-t' }, 'La propuesta'),
      h('div', { key: 'l', className: 'cz-inline' }, [
        h(Toggle, {
          key: 'lk', checked: !!correo.includeLink && enlaceListo, disabled: !enlaceListo,
          label: enlaceListo ? 'Incluir el botón con el enlace publicado' : 'Aún no está publicada',
          onChange: (v) => set({ includeLink: v }),
        }),
        h(Btn, {
          key: 'pb', size: 'sm', disabled: !!ocupado, onClick: publicar,
        }, ocupado === 'link' ? 'Publicando…' : (enlaceListo ? '🔗 Volver a publicar' : '🔗 Publicar enlace')),
        h(Btn, {
          key: 'ht', size: 'sm', disabled: !!ocupado, onClick: adjuntarPropuesta,
          title: 'Genera la propuesta como archivo HTML autocontenido y la adjunta',
        }, ocupado === 'html' ? 'Generando…' : '📎 Adjuntar propuesta (HTML)'),
        h(Btn, {
          key: 'fi', size: 'sm', disabled: !!ocupado,
          onClick: () => fileRef.current && fileRef.current.click(),
        }, '📎 Añadir archivo…'),
        h('input', {
          key: 'in', ref: fileRef, type: 'file', multiple: true, style: { display: 'none' },
          onChange: (e) => { void añadirArchivos(e.target.files); e.target.value = ''; },
        }),
      ]),
      adjuntos.length ? h('ul', { key: 'ls', className: 'cz-adjlist' }, adjuntos.map((a, i) => h('li', { key: i, className: 'cz-adj' }, [
        h('span', { key: 'n', className: 'cz-adj-n' }, a.filename),
        h('span', { key: 's', className: 'cz-adj-s cz-mono' }, enMb(a.size) + ' MB'),
        h(IconBtn, { key: 'x', icon: '✕', title: 'Quitar adjunto', onClick: () => setAdjuntos(adjuntos.filter((_, j) => j !== i)) }),
      ]))) : null,
      h('div', { key: 'h', className: 'cz-inspector-help' },
        'El PDF lo genera el diálogo de impresión del navegador y lo guardas tú en tu disco: la app no lo recibe, '
        + 'así que para adjuntarlo, expórtalo primero desde 👁 Vista previa y añádelo con «Añadir archivo». '
        + 'El enlace y el HTML sí se generan aquí.'),
    ]),

    // ── Cómo se verá ─────────────────────────────────────────────────
    h('div', { key: 'pv', className: 'cz-send-prev' }, [
      h('button', {
        key: 'b', type: 'button', className: 'cz-send-prev-t', onClick: () => setVerHtml(!verHtml),
      }, (verHtml ? '▾ ' : '▸ ') + 'Cómo lo verá el cliente'),
      verHtml ? h('div', { key: 'p', className: 'cz-send-prev-body' }, [
        h('div', { key: 's', className: 'cz-send-prev-sub' }, correo.subject),
        ...s(correo.body).split('\n').map((linea, i) => h('div', { key: 'l' + i }, linea || ' ')),
        correo.includeLink && enlaceListo
          ? h('div', { key: 'cta', className: 'cz-send-prev-cta' }, 'Ver la propuesta ' + (doc.number || ''))
          : null,
      ]) : null,
    ]),
  ]);
}
