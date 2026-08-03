
  // ═════════════════════════════════════════════════════════════════════════
  // UI · Guía
  // Lo que la app hace y lo que NO hace, en la propia app. El punto que más
  // confunde —Kreative Studio no llama a los modelos generativos— no se
  // deduce de la interfaz, así que se dice aquí y en primera pantalla.
  // ═════════════════════════════════════════════════════════════════════════

  const go = (view) => () => setUi({ view });

  const GUIDE_STEPS = [
    {
      n: 1, title: 'Rellena el brief', view: 'brief', cta: 'Ir al Brief',
      body: 'Lo único obligatorio es el nombre del producto y las fotos. Sube frontal, tres cuartos y un detalle de material, y marca la mejor como principal: es la referencia que reciben los modelos y lo que impide que se inventen la forma del producto.',
      tip: 'Si el producto ya está en ProductLab, impórtalo: trae nombre, precio, especificaciones y toda la galería sin teclear nada.',
    },
    {
      n: 2, title: 'Escribe lo que quieres', view: 'dashboard', cta: 'Ir al Panel',
      body: 'Una frase en lenguaje natural: «crea una campaña premium», «quiero un comercial épico», «véndelo para deportistas», «algo minimal de 15 segundos». El sistema deduce estilo, objetivo, público y duración, y ejecuta los doce agentes.',
      tip: 'Puedes decir el objetivo explícitamente («que convierta», «para un lanzamiento») y manda sobre lo que sugiera el estilo.',
    },
    {
      n: 3, title: 'Revisa y ajusta', view: 'storyboard', cta: 'Ver el storyboard',
      body: 'La campaña sale completa, no a medias. Cambia lo que no te convenza —una duración, un encuadre, una óptica, un rótulo— y los prompts, el audio, el montaje y la analítica se regeneran solos.',
      tip: 'Si no te gusta la dirección entera, cambia de estilo en el Marketplace: se regenera todo de forma coherente, no solo los colores.',
    },
    {
      n: 4, title: 'Produce el material', view: 'jobs', cta: 'Ver la producción',
      body: 'Díselo al agente de KIMOS: «produce el material pendiente». Él pide el siguiente lote, genera cada imagen, vídeo y audio con sus modelos y devuelve los resultados; la app los versiona, cierra cada trabajo y contabiliza el coste real. Repite solo hasta que quede en cero.',
      tip: 'El orden no es negociable: primero los keyframes, y las tomas de vídeo parten de ellos. Un vídeo malo cuesta entre 10 y 30 veces más que la imagen que lo habría evitado.',
    },
    {
      n: 5, title: 'Renderiza', view: 'jobs', cta: 'Bundle de render',
      body: 'Cuando la producción llega al 100 %, descarga el bundle de render: un único script que baja todos los archivos generados a su sitio, une las tomas que hubo que partir, escribe los subtítulos y ejecuta FFmpeg hasta los entregables finales en cada formato.',
      tip: 'La biblia de campaña (botón «Biblia» arriba) es el documento que se le entrega al cliente: concepto, plan, storyboard, copy y costes.',
    },
  ];

  const GUIDE_DELIVERS = [
    { view: 'research', icon: '⌕', title: 'Investigación', text: 'Mercado y tendencias, público con sus objeciones y disparadores de compra, competencia con el hueco que deja cada uno, nicho y benchmarks por canal.' },
    { view: 'concept', icon: '✧', title: 'Concepto', text: 'Idea, mensaje clave, arco narrativo, emociones, atributos convertidos en beneficios con su prueba, money shot y moodboard.' },
    { view: 'plan', icon: '⌗', title: 'Plan y funnel', text: 'Cuatro etapas con reparto exacto del presupuesto, canales, calendario de cuatro semanas, KPIs razonados y plan de pruebas A/B.' },
    { view: 'storyboard', icon: '▦', title: 'Storyboard', text: 'Escenas con duración, encuadre, ángulo, óptica, movimiento, iluminación, etalonaje, efectos, rótulo y nota de sonido. Cortes por formato y variantes con hipótesis.' },
    { view: 'prompts', icon: '⌨', title: 'Prompts', text: 'Imagen y vídeo por escena, escritos en el dialecto del proveedor que elijas, con negativo y parámetros. Exportables en CSV.' },
    { view: 'audio', icon: '♪', title: 'Voz y música', text: 'Locución ajustada al metraje plano a plano, dirección actoral, brief de música con estructura y notas de mezcla, ambiente y efectos.' },
    { view: 'editor', icon: '✂', title: 'Montaje', text: 'Timeline multipista, subtítulos SRT, lista EDL y script FFmpeg completo hasta el entregable final en cada formato.' },
    { view: 'copy', icon: '✎', title: 'Copy', text: 'Anuncios por plataforma con variantes de gancho distintas y dentro del límite de caracteres real, landing completa con objeciones y SEO, y secuencia de cinco emails.' },
    { view: 'brand', icon: '◈', title: 'Control de marca', text: 'Auditoría con puntuación y hallazgos accionables: paleta, contraste, tipografía, logotipo, consistencia del producto y términos prohibidos.' },
    { view: 'analytics', icon: '▲', title: 'Analytics', text: 'Coste estimado frente al real por proveedor, consumo, y proyección de impresiones, CTR, CPA y ROAS con el ajuste creativo explicado.' },
  ];

  const GUIDE_PITFALLS = [
    { bad: 'Empezar sin fotos del producto', good: 'Sin referencia real, los modelos se inventan la forma y ningún plano casa con el siguiente. Es el error que más caro sale.' },
    { bad: 'Generar los vídeos antes que los keyframes', good: 'Valida la imagen fija primero. Un segundo de vídeo cuesta lo que veinte imágenes.' },
    { bad: 'Exportar solo en 16:9', good: 'El descubrimiento ocurre en vertical. Sin una pieza 9:16 nativa, Analytics descuenta en torno a un 12 % de rendimiento en feeds móviles.' },
    { bad: 'Quitar los subtítulos', good: 'La mayoría del vídeo social se ve sin sonido. Quitarlos descuenta otro 10 %.' },
    { bad: 'Una sola variante', good: 'Con menos de tres, la creatividad se satura en menos de dos semanas y el coste por resultado sube solo.' },
    { bad: 'Repetir el prompt cuando un plano falla', good: 'Si falla dos veces, cambia el encuadre. Suele ser el problema real y se resuelve antes.' },
  ];

  function GuideView() {
    const hasProduct = s(model.brief.productName).trim().length > 0;
    return h('div', { className: 'ks-view' }, [
      h(ViewHead, { key: 'h', title: 'Cómo funciona Kreative Studio',
        subtitle: 'De las fotos de un producto y una frase, a la campaña completa: no solo el vídeo, también el plan, el copy, la landing, los emails y los números.',
        actions: [h(Btn, { key: 'b', variant: 'primary', onClick: go(hasProduct ? 'dashboard' : 'brief') },
          hasProduct ? 'Ir al Panel' : 'Empezar por el Brief')] }),

      // ── Lo que hace y lo que no ──────────────────────────────────────
      h('div', { className: 'ks-guide-truth', key: 'truth' }, [
        h('div', { className: 'ks-guide-does', key: 'a' }, [
          h('h3', { key: 't' }, 'Lo que hace'),
          h('ul', { className: 'ks-list', key: 'l' }, [
            'Investiga la categoría, el público y la competencia, y define el concepto creativo.',
            'Planifica el funnel y reparte el presupuesto entre etapas y canales.',
            'Dirige el storyboard plano a plano, con óptica, luz, color, movimiento y ritmo.',
            'Escribe los prompts de cada escena para el modelo que elijas.',
            'Escribe la locución ajustada al metraje y el brief de música.',
            'Genera el script de montaje, los subtítulos y la lista de decisiones.',
            'Redacta el copy de cada plataforma, la landing y la secuencia de email.',
            'Audita la consistencia de marca y contabiliza costes y proyecciones.',
          ].map((x, i) => h('li', { key: i }, x))),
        ]),
        h('div', { className: 'ks-guide-doesnt', key: 'b' }, [
          h('h3', { key: 't' }, 'Lo que NO hace'),
          h('ul', { className: 'ks-list', key: 'l' }, [
            h('li', { key: '1' }, [h('strong', { key: 's' }, 'No llama a los modelos por su cuenta. '),
              'Esta app corre en tu navegador y no puede custodiar claves de API de terceros. Quien genera es el agente de KIMOS con sus conexiones: la app le dice exactamente qué toca hacer ahora, con qué modelo y con qué referencia, y él devuelve los archivos. Tú solo tienes que pedírselo.']),
            h('li', { key: '2' }, [h('strong', { key: 's' }, 'No ejecuta el render. '),
              'Prepara el bundle completo —descarga de archivos, unión de tomas, subtítulos y FFmpeg— pero el render corre en tu máquina o en tu servidor.']),
            h('li', { key: '3' }, [h('strong', { key: 's' }, 'No compra medios ni publica. '),
              'Deja el copy y los entregables listos para subirlos al gestor de anuncios.']),
            h('li', { key: '4' }, [h('strong', { key: 's' }, 'No promete resultados. '),
              'Las cifras de Analytics son proyecciones a partir de benchmarks públicos y de las decisiones del propio storyboard. Sirven para dimensionar y comparar variantes entre sí.']),
          ]),
        ]),
      ]),

      // ── Los cinco pasos ──────────────────────────────────────────────
      h(Card, { key: 'steps', title: 'El flujo, en cinco pasos' }, [
        h('div', { className: 'ks-guide-steps', key: 's' }, GUIDE_STEPS.map((st) => h('div', {
          key: st.n, className: 'ks-guide-step',
        }, [
          h('span', { className: 'ks-guide-num', key: 'n' }, st.n),
          h('div', { className: 'ks-guide-stepbody', key: 'b' }, [
            h('strong', { key: 't' }, st.title),
            h('p', { key: 'd' }, st.body),
            h('p', { className: 'ks-guide-tip', key: 'p' }, st.tip),
            h(Btn, { key: 'c', size: 'xs', onClick: go(st.view) }, st.cta),
          ]),
        ]))),
      ]),

      // ── Qué recibes ──────────────────────────────────────────────────
      h(Card, { key: 'del', title: 'Qué recibes' }, [
        h('div', { className: 'ks-guide-grid', key: 'g' }, GUIDE_DELIVERS.map((d) => h('div', {
          key: d.view, className: 'ks-guide-card', onClick: go(d.view), title: 'Abrir ' + d.title,
        }, [
          h('span', { className: 'ks-guide-icon', key: 'i' }, d.icon),
          h('strong', { key: 't' }, d.title),
          h('p', { key: 'x' }, d.text),
        ]))),
        h('p', { className: 'ks-hint', key: 'f' },
          'Todo se exporta: biblia de campaña en Markdown, script FFmpeg, subtítulos, EDL, y CSV de prompts, de copy y de trabajos.'),
      ]),

      // ── El ciclo de producción ───────────────────────────────────────
      h(Card, { key: 'cycle', title: 'Cómo se cierra el ciclo de producción' }, [
        h('div', { className: 'ks-guide-cycle', key: 'c' }, [
          { t: 'Lote', d: 'La app entrega el siguiente bloque que toca generar, con proveedor, prompt y referencia.' },
          { t: 'Generación', d: 'El agente lo genera con sus modelos, respetando el orden: keyframes antes que vídeo.' },
          { t: 'Registro', d: 'Devuelve todo de una vez: se versiona por escena, cierra cada trabajo y suma el coste real.' },
          { t: 'Render', d: 'Al llegar a cero, el bundle baja los archivos, los ordena y monta los entregables.' },
        ].map((x, i, all) => h('div', { key: i, className: 'ks-guide-cyclestep' }, [
          h('strong', { key: 't' }, x.t),
          h('p', { key: 'd' }, x.d),
          i < all.length - 1 ? h('span', { className: 'ks-guide-arrow', key: 'a' }, '→') : null,
        ]))),
        h('p', { className: 'ks-hint', key: 'n' },
          'Desde el chat de KIMOS basta con pedirlo: «produce el material pendiente de Kreative Studio». '
          + 'El agente repite el ciclo solo hasta que no quede nada, y te avisa cuando esté lista para renderizar.'),
      ]),

      // ── Errores frecuentes ───────────────────────────────────────────
      h(Card, { key: 'pit', title: 'Errores que salen caros' }, [
        h('div', { className: 'ks-guide-pitfalls', key: 'p' }, GUIDE_PITFALLS.map((x, i) => h('div', {
          key: i, className: 'ks-guide-pitfall',
        }, [
          h('strong', { key: 'b' }, x.bad),
          h('p', { key: 'g' }, x.good),
        ]))),
      ]),

      // ── Frases de ejemplo ────────────────────────────────────────────
      h(Card, { key: 'say', title: 'Qué puedes escribir' }, [
        h('p', { className: 'ks-hint', key: 'i' },
          'En el Panel o en el chat de KIMOS. La frase decide el estilo, el objetivo, el público y hasta la duración.'),
        h('div', { className: 'ks-guide-says', key: 's' }, [
          ['Crea una campaña premium', 'estilo cinematográfico sobrio, objetivo de notoriedad'],
          ['Quiero un comercial épico que convierta', 'estilo intenso, pero el objetivo explícito manda: conversión'],
          ['Véndelo para deportistas', 'público atletas, lenguaje directo, prueba de rendimiento'],
          ['Algo minimal y limpio de 15 segundos', 'estilo nórdico, metraje ajustado a 15 s'],
          ['Hazlo viral para TikTok', 'estilo urbano, ritmo alto, vertical nativo'],
          ['Campaña de remarketing para carritos abandonados', 'funnel volcado a recuperación, mensaje de objeción'],
        ].map((x, i) => h('div', { key: i, className: 'ks-guide-say' }, [
          h('code', { key: 'q' }, '«' + x[0] + '»'),
          h('span', { key: 'w' }, x[1]),
        ]))),
      ]),

      // ── Proveedores ──────────────────────────────────────────────────
      h(Card, { key: 'prov', title: 'Los modelos son intercambiables',
        actions: [h(Btn, { key: 'b', size: 'sm', onClick: go('settings') }, 'Elegir proveedores')] }, [
        h('p', { className: 'ks-lead', key: 'p' },
          'Ningún agente conoce a un modelo concreto: describen la escena en un formato neutral y la app la traduce al dialecto de cada proveedor. '
          + 'Cambiar de Runway a Veo reescribe los prompts de toda la campaña y no toca nada más.'),
        h('div', { className: 'ks-guide-provs', key: 'g' }, CAPABILITIES.map((cap) => h('div', {
          key: cap.id, className: 'ks-guide-prov',
        }, [
          h('strong', { key: 't' }, cap.emoji + ' ' + cap.label),
          h('span', { key: 'l' }, providersFor(cap.id).map((p) => p.label).join(' · ')),
        ]))),
      ]),
    ]);
  }
